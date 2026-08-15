import { Context } from "effect";

import type { RequestContext } from "../../http/context";

/**
 * Per-request transport context as an Effect service.
 * Provided at the Hono edge; never constructed inside domain modules.
 */
export class CurrentRequestContext extends Context.Service<CurrentRequestContext, RequestContext>()(
  "@zstack/api/platform/CurrentRequestContext",
) {}
