import { Context, Effect, Layer, Schema } from "effect";

export class ObjectStoreError extends Schema.TaggedError<ObjectStoreError>()("ObjectStoreError", {
  message: Schema.String,
}) {}

export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType?: string;
};

export type StoredObject = {
  key: string;
  body: Uint8Array;
  contentType: string | undefined;
};

export type SignObjectInput = {
  key: string;
  expiresInSeconds?: number;
};

export type SignedObjectIntent = {
  key: string;
  url: string;
  method: "PUT" | "GET";
  expiresAt: Date;
};

const DEFAULT_SIGN_TTL_SECONDS = 3600;

/**
 * Application object-storage boundary. Domain code uses opaque keys;
 * adapters own R2 vs in-memory bytes.
 */
export class ObjectStore extends Context.Service<
  ObjectStore,
  {
    put(input: PutObjectInput): Effect.Effect<void, ObjectStoreError>;
    get(key: string): Effect.Effect<StoredObject | undefined, ObjectStoreError>;
    delete(key: string): Effect.Effect<void, ObjectStoreError>;
    signUpload(input: SignObjectInput): Effect.Effect<SignedObjectIntent, ObjectStoreError>;
    signDownload(input: SignObjectInput): Effect.Effect<SignedObjectIntent, ObjectStoreError>;
  }
>()("@zstack/api/platform/object-store/ObjectStore") {}

function requireKey(key: string): Effect.Effect<string, ObjectStoreError> {
  const trimmed = key.trim();
  if (!trimmed) {
    return Effect.fail(
      new ObjectStoreError({
        message: "object key must be a non-empty opaque string",
      }),
    );
  }
  return Effect.succeed(trimmed);
}

function expiryDate(expiresInSeconds: number | undefined): Date {
  const ttl = expiresInSeconds ?? DEFAULT_SIGN_TTL_SECONDS;
  return new Date(Date.now() + ttl * 1000);
}

function makeObjectStore(backend: ObjectStore["Service"]): ObjectStore["Service"] {
  return ObjectStore.of({
    put: (input) =>
      Effect.gen(function* () {
        const key = yield* requireKey(input.key);
        yield* backend.put({ ...input, key });
      }),
    get: (rawKey) =>
      Effect.gen(function* () {
        const key = yield* requireKey(rawKey);
        return yield* backend.get(key);
      }),
    delete: (rawKey) =>
      Effect.gen(function* () {
        const key = yield* requireKey(rawKey);
        yield* backend.delete(key);
      }),
    signUpload: (input) =>
      Effect.gen(function* () {
        const key = yield* requireKey(input.key);
        return yield* backend.signUpload({ ...input, key });
      }),
    signDownload: (input) =>
      Effect.gen(function* () {
        const key = yield* requireKey(input.key);
        return yield* backend.signDownload({ ...input, key });
      }),
  });
}

type MemoryObject = {
  body: Uint8Array;
  contentType: string | undefined;
};

function makeFakeBackend(): ObjectStore["Service"] {
  const objects = new Map<string, MemoryObject>();

  const sign = (input: SignObjectInput, method: "PUT" | "GET"): SignedObjectIntent => {
    const expiresAt = expiryDate(input.expiresInSeconds);
    const token = crypto.randomUUID();
    const kind = method === "PUT" ? "upload" : "download";
    return {
      key: input.key,
      url: `memory://objects/${kind}/${token}`,
      method,
      expiresAt,
    };
  };

  return {
    put: (input) =>
      Effect.sync(() => {
        objects.set(input.key, {
          body: Uint8Array.from(input.body),
          contentType: input.contentType,
        });
      }),
    get: (key) =>
      Effect.sync(() => {
        const stored = objects.get(key);
        if (!stored) {
          return undefined;
        }
        return {
          key,
          body: Uint8Array.from(stored.body),
          contentType: stored.contentType,
        };
      }),
    delete: (key) =>
      Effect.sync(() => {
        objects.delete(key);
      }),
    signUpload: (input) => Effect.sync(() => sign(input, "PUT")),
    signDownload: (input) => Effect.sync(() => sign(input, "GET")),
  };
}

/**
 * Local/dev store when the Worker R2 binding is absent.
 */
export function makeFakeObjectStoreLive(): Layer.Layer<ObjectStore> {
  return Layer.succeed(ObjectStore, makeObjectStore(makeFakeBackend()));
}

export const FakeObjectStoreLive = makeFakeObjectStoreLive();

function makeR2Backend(bucket: R2Bucket): ObjectStore["Service"] {
  const sign = (input: SignObjectInput, method: "PUT" | "GET"): SignedObjectIntent => {
    const expiresAt = expiryDate(input.expiresInSeconds);
    const kind = method === "PUT" ? "upload" : "download";
    return {
      key: input.key,
      url: `r2-intent://${kind}/${encodeURIComponent(input.key)}?exp=${expiresAt.getTime()}`,
      method,
      expiresAt,
    };
  };

  return {
    put: (input) =>
      Effect.tryPromise({
        try: async () => {
          if (input.contentType) {
            await bucket.put(input.key, input.body, {
              httpMetadata: { contentType: input.contentType },
            });
            return;
          }
          await bucket.put(input.key, input.body);
        },
        catch: (cause) =>
          new ObjectStoreError({
            message:
              cause instanceof Error ? `object put failed: ${cause.message}` : "object put failed",
          }),
      }),
    get: (key) =>
      Effect.tryPromise({
        try: async () => {
          const object = await bucket.get(key);
          if (!object) {
            return undefined;
          }
          const buffer = await object.arrayBuffer();
          return {
            key,
            body: new Uint8Array(buffer),
            contentType: object.httpMetadata?.contentType,
          };
        },
        catch: (cause) =>
          new ObjectStoreError({
            message:
              cause instanceof Error ? `object get failed: ${cause.message}` : "object get failed",
          }),
      }),
    delete: (key) =>
      Effect.tryPromise({
        try: async () => {
          await bucket.delete(key);
        },
        catch: (cause) =>
          new ObjectStoreError({
            message:
              cause instanceof Error
                ? `object delete failed: ${cause.message}`
                : "object delete failed",
          }),
      }),
    signUpload: (input) => Effect.sync(() => sign(input, "PUT")),
    signDownload: (input) => Effect.sync(() => sign(input, "GET")),
  };
}

export function R2ObjectStoreLive(bucket: R2Bucket): Layer.Layer<ObjectStore> {
  return Layer.succeed(ObjectStore, makeObjectStore(makeR2Backend(bucket)));
}

export function isR2BucketBinding(value: unknown): value is R2Bucket {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("put" in value) || !("get" in value) || !("delete" in value)) {
    return false;
  }
  return (
    typeof value.put === "function" &&
    typeof value.get === "function" &&
    typeof value.delete === "function"
  );
}

export function objectStoreLiveFromEnv(env: { OBJECTS?: R2Bucket }): Layer.Layer<ObjectStore> {
  return isR2BucketBinding(env.OBJECTS) ? R2ObjectStoreLive(env.OBJECTS) : FakeObjectStoreLive;
}

export async function runObjectStoreEffect<A>(
  effect: Effect.Effect<A, ObjectStoreError, ObjectStore>,
  live: Layer.Layer<ObjectStore> = FakeObjectStoreLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
