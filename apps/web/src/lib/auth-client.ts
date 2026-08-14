import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

function authClientBaseURL(): string | undefined {
  if (typeof window !== "undefined") {
    return undefined;
  }
  return process.env.API_ORIGIN ?? "http://127.0.0.1:8787";
}

/**
 * Browser: same-origin `/api` proxy. Server: absolute API origin so
 * `getSession` is not `fetch("/api/auth/get-session")` (Node rejects relative URLs).
 */
export const authClient = createAuthClient({
  baseURL: authClientBaseURL(),
  plugins: [organizationClient(), adminClient()],
});
