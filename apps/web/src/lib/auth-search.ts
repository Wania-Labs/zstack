import { safeInternalPath } from "./session";

export type AuthRedirectSearch = {
  redirect?: string;
};

export type TokenSearch = {
  token?: string;
  error?: string;
};

export function parseAuthRedirectSearch(search: Record<string, unknown>): AuthRedirectSearch {
  const redirect = safeInternalPath(search.redirect);
  return redirect ? { redirect } : {};
}

export function parseTokenSearch(search: Record<string, unknown>): TokenSearch {
  const result: TokenSearch = {};
  if (typeof search.token === "string" && search.token.length > 0) {
    result.token = search.token;
  }
  if (typeof search.error === "string" && search.error.length > 0) {
    result.error = search.error;
  }
  return result;
}
