import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  FakeObjectStoreLive,
  ObjectStore,
  makeFakeObjectStoreLive,
  objectStoreLiveFromEnv,
  runObjectStoreEffect,
} from "../../src/platform/object-store/object-store-service";
import {
  readR2PresignCredentials,
  signR2ObjectUrl,
} from "../../src/platform/object-store/r2-presign";

describe("FakeObjectStoreLive", () => {
  it("put/get/delete roundtrips", async () => {
    const live = makeFakeObjectStoreLive();
    const key = "obj_opaque_1";
    const body = new TextEncoder().encode("hello-objects");

    await runObjectStoreEffect(
      Effect.gen(function* () {
        const store = yield* ObjectStore;
        yield* store.put({ key, body, contentType: "text/plain" });
        const got = yield* store.get(key);
        expect(got?.key).toBe(key);
        expect(got?.contentType).toBe("text/plain");
        expect(Array.from(got?.body ?? [])).toEqual(Array.from(body));

        yield* store.delete(key);
        const missing = yield* store.get(key);
        expect(missing).toBeUndefined();
      }),
      live,
    );
  });

  it("signs upload and download without throwing", async () => {
    const live = makeFakeObjectStoreLive();
    await runObjectStoreEffect(
      Effect.gen(function* () {
        const store = yield* ObjectStore;
        const upload = yield* store.signUpload({ key: "obj_sign_1" });
        expect(upload).toMatchObject({
          kind: "worker",
          method: "PUT",
          path: "/api/objects/obj_sign_1",
        });
        const download = yield* store.signDownload({ key: "obj_sign_1" });
        expect(download).toMatchObject({
          kind: "worker",
          method: "GET",
          path: "/api/objects/obj_sign_1",
        });
      }),
      live,
    );
  });
});

describe("objectStoreLiveFromEnv", () => {
  it("uses the in-memory fake when OBJECTS is missing", async () => {
    const live = objectStoreLiveFromEnv({});
    expect(live).toBe(FakeObjectStoreLive);

    await runObjectStoreEffect(
      Effect.gen(function* () {
        const store = yield* ObjectStore;
        yield* store.put({
          key: "obj_unbound",
          body: new TextEncoder().encode("ok"),
        });
        const got = yield* store.get("obj_unbound");
        expect(got).toBeDefined();
      }),
      live,
    );
  });
});

describe("readR2PresignCredentials", () => {
  it("returns undefined until every S3 field is set", () => {
    expect(
      readR2PresignCredentials({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        OBJECTS_BUCKET_NAME: "bucket",
      }),
    ).toBeUndefined();
  });

  it("reads complete S3 credentials", () => {
    expect(
      readR2PresignCredentials({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        OBJECTS_BUCKET_NAME: "bucket",
      }),
    ).toEqual({
      accountId: "acct",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucketName: "bucket",
    });
  });
});

describe("signR2ObjectUrl", () => {
  it("returns an S3 query-signed URL", async () => {
    const url = await signR2ObjectUrl({
      credentials: {
        accountId: "acct",
        accessKeyId: "AKIAEXAMPLE",
        secretAccessKey: "secret",
        bucketName: "bucket",
      },
      key: "obj/key",
      method: "PUT",
      expiresInSeconds: 60,
    });
    expect(url).toContain("https://acct.r2.cloudflarestorage.com/bucket/obj/key");
    expect(url).toContain("X-Amz-Expires=60");
    expect(url).toContain("X-Amz-Signature=");
  });
});
