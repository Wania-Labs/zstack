import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

/**
 * Cloudflare Queue bound onto the API Worker as `JOBS`.
 * `alchemy:dev` uses Alchemy's local queue; deploy creates a named queue.
 */
export const Jobs = Effect.gen(function* () {
  return yield* Cloudflare.Queues.Queue("Jobs");
});
