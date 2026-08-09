import { Context, Effect, Layer, ManagedRuntime } from "effect";

import type { RequestContext } from "../../http/context";
import { Database, databaseLayer } from "../db/database";

/**
 * Per-request transport context as an Effect service.
 * Provided at the Hono edge; never constructed inside domain modules.
 */
export class CurrentRequestContext extends Context.Service<CurrentRequestContext, RequestContext>()(
  "@zstack/api/platform/CurrentRequestContext",
) {}

const appMemoMap = Layer.makeMemoMapUnsafe();

/**
 * Application Layer grows as platform capabilities are selected.
 * Alchemy will later bind Hyperdrive and other Worker resources into this graph.
 */
export const AppLayer = Layer.empty;

export const runtime = ManagedRuntime.make(AppLayer, {
  memoMap: appMemoMap,
});

export async function runRequestEffect<A, E>(
  effect: Effect.Effect<A, E, CurrentRequestContext | Database>,
  requestContext: RequestContext,
  connectionString: string,
): Promise<A> {
  return runtime.runPromise(
    effect.pipe(
      Effect.provide(Layer.succeed(CurrentRequestContext, requestContext)),
      Effect.provide(databaseLayer(connectionString)),
    ),
  );
}
