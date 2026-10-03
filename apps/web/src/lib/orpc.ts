import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppContract } from "@zstack/contracts/router";

import { SSR_API_PLACEHOLDER_ORIGIN, apiFetch } from "./api-fetch";

function rpcUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/rpc`;
  }

  // SSR: `apiFetch` keeps only the path and forwards the incoming cookies
  // through the `API` service binding (or `API_ORIGIN` locally).
  return `${SSR_API_PLACEHOLDER_ORIGIN}/api/rpc`;
}

const link = new RPCLink({
  url: rpcUrl,
  fetch: (request, init) => apiFetch(request, init),
});

export const orpcClient: ContractRouterClient<AppContract> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(orpcClient);
