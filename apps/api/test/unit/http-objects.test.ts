import { describe, expect, it } from "vitest";

import {
  MAX_OBJECT_UPLOAD_BYTES,
  mimeEssence,
  objectResponseHeaders,
  readBodyWithLimit,
} from "../../src/http/objects";
import { authorizeObjectKey, isWellFormedObjectKey } from "../../src/modules/objects/access";
import type { RequestContext } from "../../src/http/context";
import { fakeSession, testApp, testEnv } from "./support/app-harness";

const alice = fakeSession({ userId: "alice", activeOrganizationId: "org_a", memberRole: "member" });
const bob = fakeSession({ userId: "bob" });

function objectUrl(key: string): string {
  return `http://localhost/api/objects/${encodeURIComponent(key)}`;
}

describe("object access scoping", () => {
  const request: RequestContext = {
    requestId: "req",
    releaseId: "local",
    actor: { type: "user", userId: "alice" },
    effectiveUserId: "alice",
    organizationId: "org_a",
    locale: "en",
  };

  it("allows the caller's user and active-org prefixes only", () => {
    expect(authorizeObjectKey("user/alice/avatar.png", request)).toBe("allowed");
    expect(authorizeObjectKey("org/org_a/report.pdf", request)).toBe("allowed");
    expect(authorizeObjectKey("user/bob/avatar.png", request)).toBe("forbidden");
    expect(authorizeObjectKey("org/org_b/report.pdf", request)).toBe("forbidden");
    expect(authorizeObjectKey("user/alice/", request)).toBe("invalid");
    expect(authorizeObjectKey("avatar.png", request)).toBe("forbidden");
  });

  it("does not let prefix tricks escape scope", () => {
    expect(authorizeObjectKey("user/alicex/file", request)).toBe("forbidden");
    expect(authorizeObjectKey("user/alice/../bob/file", request)).toBe("invalid");
    expect(authorizeObjectKey("user/alice//file", request)).toBe("invalid");
    expect(isWellFormedObjectKey("user/alice/a\\b")).toBe(false);
    expect(isWellFormedObjectKey("user/alice/a\nb")).toBe(false);
  });

  it("allows nothing without an identity", () => {
    expect(
      authorizeObjectKey("user/alice/file", {
        requestId: "req",
        releaseId: "local",
        actor: { type: "system" },
        locale: "en",
      }),
    ).toBe("forbidden");
  });
});

describe("object response headers", () => {
  it("renders only safe raster images inline", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      expect(objectResponseHeaders(type).get("content-disposition")).toBe("inline");
    }
    for (const type of ["image/svg+xml", "text/html", "application/xhtml+xml", undefined]) {
      expect(objectResponseHeaders(type).get("content-disposition")).toBe("attachment");
    }
  });

  it("always sets nosniff and a sandbox CSP", () => {
    const headers = objectResponseHeaders("text/html; charset=utf-8");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("content-security-policy")).toBe("sandbox");
    expect(headers.get("content-type")).toBe("text/html");
  });

  it("normalizes or drops malformed content types", () => {
    expect(mimeEssence("Image/PNG; foo=bar")).toBe("image/png");
    expect(mimeEssence("not a mime")).toBeUndefined();
    expect(objectResponseHeaders("garbage").get("content-type")).toBe("application/octet-stream");
  });
});

describe("readBodyWithLimit", () => {
  it("rejects a declared oversize content-length before reading", async () => {
    const request = new Request("http://localhost/x", {
      method: "PUT",
      body: "small",
      headers: { "content-length": "100" },
    });
    await expect(readBodyWithLimit(request, 10)).resolves.toEqual({ kind: "too_large" });
  });

  it("aborts a streamed body that exceeds the cap", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(4));
        if (pulls > 100) {
          controller.close();
        }
      },
    });
    const request = new Request("http://localhost/x", {
      method: "PUT",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBodyWithLimit(request, 10)).resolves.toEqual({ kind: "too_large" });
    expect(pulls).toBeLessThan(10);
  });

  it("returns the full body under the cap", async () => {
    const request = new Request("http://localhost/x", { method: "PUT", body: "hello" });
    const result = await readBodyWithLimit(request, 10);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(new TextDecoder().decode(result.body)).toBe("hello");
    }
  });
});

describe("/api/objects/* over HTTP", () => {
  it("requires a session", async () => {
    const app = testApp();
    const response = await app.request(objectUrl("user/alice/a.txt"), {}, testEnv);
    expect(response.status).toBe(401);
  });

  it("round-trips the caller's own object as a hardened attachment", async () => {
    const app = testApp({ session: alice });
    const key = "user/alice/page.html";

    const put = await app.request(
      objectUrl(key),
      {
        method: "PUT",
        body: "<script>alert(1)</script>",
        headers: { "content-type": "text/html" },
      },
      testEnv,
    );
    expect(put.status).toBe(204);

    const get = await app.request(objectUrl(key), {}, testEnv);
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toBe("text/html");
    expect(get.headers.get("content-disposition")).toBe("attachment");
    expect(get.headers.get("x-content-type-options")).toBe("nosniff");
    expect(get.headers.get("content-security-policy")).toBe("sandbox");
    expect(await get.text()).toBe("<script>alert(1)</script>");

    const del = await app.request(objectUrl(key), { method: "DELETE" }, testEnv);
    expect(del.status).toBe(204);
    const missing = await app.request(objectUrl(key), {}, testEnv);
    expect(missing.status).toBe(404);
  });

  it("serves PNG inline but SVG as an attachment", async () => {
    const app = testApp({ session: alice });
    await app.request(
      objectUrl("user/alice/a.png"),
      { method: "PUT", body: "png", headers: { "content-type": "image/png" } },
      testEnv,
    );
    await app.request(
      objectUrl("user/alice/a.svg"),
      { method: "PUT", body: "<svg/>", headers: { "content-type": "image/svg+xml" } },
      testEnv,
    );
    const png = await app.request(objectUrl("user/alice/a.png"), {}, testEnv);
    const svg = await app.request(objectUrl("user/alice/a.svg"), {}, testEnv);
    expect(png.headers.get("content-disposition")).toBe("inline");
    expect(svg.headers.get("content-disposition")).toBe("attachment");
  });

  it("forbids reading, writing, or deleting another tenant's keys", async () => {
    const owner = testApp({ session: alice });
    await owner.request(
      objectUrl("user/alice/secret.txt"),
      { method: "PUT", body: "secret" },
      testEnv,
    );

    const intruder = testApp({ session: bob });
    const read = await intruder.request(objectUrl("user/alice/secret.txt"), {}, testEnv);
    const write = await intruder.request(
      objectUrl("user/alice/secret.txt"),
      { method: "PUT", body: "overwrite" },
      testEnv,
    );
    const remove = await intruder.request(
      objectUrl("user/alice/secret.txt"),
      { method: "DELETE" },
      testEnv,
    );
    const orgRead = await intruder.request(objectUrl("org/org_a/file.txt"), {}, testEnv);
    expect([read.status, write.status, remove.status, orgRead.status]).toEqual([
      403, 403, 403, 403,
    ]);

    const stillThere = await owner.request(objectUrl("user/alice/secret.txt"), {}, testEnv);
    expect(await stillThere.text()).toBe("secret");
  });

  it("allows active-org keys only when membership is confirmed", async () => {
    const member = testApp({ session: alice });
    const put = await member.request(
      objectUrl("org/org_a/shared.txt"),
      { method: "PUT", body: "team" },
      testEnv,
    );
    expect(put.status).toBe(204);

    // Session still points at org_a but the member row is gone (removed from Team).
    const removed = testApp({
      session: fakeSession({ userId: "carol", activeOrganizationId: "org_a" }),
    });
    const read = await removed.request(objectUrl("org/org_a/shared.txt"), {}, testEnv);
    expect(read.status).toBe(403);
  });

  it("rejects malformed percent-encoding with 400", async () => {
    const app = testApp({ session: alice });
    const response = await app.request(
      "http://localhost/api/objects/user/alice/%E0%A4%A",
      {},
      testEnv,
    );
    expect(response.status).toBe(400);
  });

  it("rejects uploads over the size cap with 413", async () => {
    const app = testApp({ session: alice });
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > MAX_OBJECT_UPLOAD_BYTES) {
          controller.close();
          return;
        }
        sent += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const response = await app.request(
      objectUrl("user/alice/huge.bin"),
      { method: "PUT", body: stream, duplex: "half" } as RequestInit,
      testEnv,
    );
    expect(response.status).toBe(413);
  });
});
