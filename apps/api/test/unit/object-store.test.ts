import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  FakeObjectStoreLive,
  ObjectStore,
  makeFakeObjectStoreLive,
  objectStoreLiveFromEnv,
  runObjectStoreEffect,
} from "../../src/platform/object-store/object-store-service";

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
        expect(upload.method).toBe("PUT");
        expect(upload.url.startsWith("memory://objects/upload/")).toBe(true);
        const download = yield* store.signDownload({ key: "obj_sign_1" });
        expect(download.method).toBe("GET");
        expect(download.url.startsWith("memory://objects/download/")).toBe(true);
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
