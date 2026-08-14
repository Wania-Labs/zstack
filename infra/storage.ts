import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

/**
 * R2 bucket bound onto the API Worker as `OBJECTS`.
 * `alchemy:dev` uses Alchemy's local R2 simulator (no cloud bucket).
 * Deploy generates a physical name from the stack; it does not pin an account bucket.
 */
export const Objects = Effect.gen(function* () {
  return yield* Cloudflare.R2.Bucket("Objects");
});
