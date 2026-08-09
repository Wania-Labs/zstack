import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppContract } from "@zstack/contracts/router";

function rpcUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/rpc`;
  }

  // SSR cannot use the Vite proxy; talk to the API Worker directly.
  return process.env.ORPC_URL ?? "http://127.0.0.1:8787/api/rpc";
}

const link = new RPCLink({
  url: rpcUrl,
  fetch: (request, init) =>
    globalThis.fetch(request, {
      ...init,
      credentials: "include",
    }),
});

export const orpcClient: ContractRouterClient<AppContract> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(orpcClient);
