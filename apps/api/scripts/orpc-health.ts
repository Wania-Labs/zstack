/**
 * Smoke-test the oRPC health procedure over HTTP (RPC protocol).
 * Usage: pnpm --filter @zstack/api exec tsx scripts/orpc-health.ts
 */
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { AppContract } from "@zstack/contracts/router";

const baseUrl = process.env.ORPC_URL ?? "http://127.0.0.1:8787/api/rpc";

const link = new RPCLink({
  url: baseUrl,
});

const client: ContractRouterClient<AppContract> = createORPCClient(link);

const result = await client.health();
console.log(JSON.stringify(result, null, 2));

if (result.ok !== true || result.database !== "up" || !result.requestId) {
  throw new Error("unexpected health payload");
}

console.log("orpc health ok");
