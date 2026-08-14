import { Context, Effect, Layer, Schema } from "effect";

export class BillingError extends Schema.TaggedError<BillingError>()("BillingError", {
  message: Schema.String,
}) {}

export type PolarServer = "sandbox" | "production";

export type PolarCredentials = {
  accessToken: string;
  server: PolarServer;
};

export type CreateCheckoutInput = {
  customerId: string;
  productSlug: string;
  successUrl?: string;
};

export type CheckoutIntent = { kind: "unconfigured" } | { kind: "url"; url: string };

export type CustomerPortalInput = {
  customerId: string;
};

export type PortalIntent = { kind: "unconfigured" } | { kind: "url"; url: string };

export type CanUseInput = {
  customerId: string;
  capability: string;
};

export type LimitInput = {
  customerId: string;
  name: string;
};

/**
 * Application billing boundary. The billable customer is the organization id.
 * Callers use product slugs and entitlement vocabulary. Adapters own Polar.
 */
export class BillingService extends Context.Service<
  BillingService,
  {
    createCheckout(input: CreateCheckoutInput): Effect.Effect<CheckoutIntent, BillingError>;
    customerPortal(input: CustomerPortalInput): Effect.Effect<PortalIntent, BillingError>;
    canUse(input: CanUseInput): Effect.Effect<boolean, BillingError>;
    limit(input: LimitInput): Effect.Effect<number, BillingError>;
  }
>()("@zstack/api/platform/billing/BillingService") {}

function requireOpaque(value: string, label: string): Effect.Effect<string, BillingError> {
  const trimmed = value.trim();
  if (!trimmed) {
    return Effect.fail(
      new BillingError({
        message: `${label} must be a non-empty opaque string`,
      }),
    );
  }
  return Effect.succeed(trimmed);
}

function makeBillingService(backend: BillingService["Service"]): BillingService["Service"] {
  return BillingService.of({
    createCheckout: (input) =>
      Effect.gen(function* () {
        const customerId = yield* requireOpaque(input.customerId, "customer id");
        const productSlug = yield* requireOpaque(input.productSlug, "product slug");
        return yield* backend.createCheckout({
          ...input,
          customerId,
          productSlug,
        });
      }),
    customerPortal: (input) =>
      Effect.gen(function* () {
        const customerId = yield* requireOpaque(input.customerId, "customer id");
        return yield* backend.customerPortal({ customerId });
      }),
    canUse: (input) =>
      Effect.gen(function* () {
        const customerId = yield* requireOpaque(input.customerId, "customer id");
        const capability = yield* requireOpaque(input.capability, "capability");
        return yield* backend.canUse({ customerId, capability });
      }),
    limit: (input) =>
      Effect.gen(function* () {
        const customerId = yield* requireOpaque(input.customerId, "customer id");
        const name = yield* requireOpaque(input.name, "limit name");
        return yield* backend.limit({ customerId, name });
      }),
  });
}

function makeFakeBackend(): BillingService["Service"] {
  return {
    createCheckout: () => Effect.succeed({ kind: "unconfigured" }),
    customerPortal: () => Effect.succeed({ kind: "unconfigured" }),
    canUse: () => Effect.succeed(false),
    limit: () => Effect.succeed(0),
  };
}

/**
 * Local/dev billing when Polar credentials are absent.
 */
export const FakeBillingLive = Layer.succeed(BillingService, makeBillingService(makeFakeBackend()));

function makePolarBackend(credentials: PolarCredentials): BillingService["Service"] {
  const message = `polar ${credentials.server} adapter is not wired`;
  return {
    createCheckout: () =>
      Effect.fail(
        new BillingError({
          message,
        }),
      ),
    customerPortal: () =>
      Effect.fail(
        new BillingError({
          message,
        }),
      ),
    canUse: () => Effect.succeed(false),
    limit: () => Effect.succeed(0),
  };
}

/**
 * Polar transport. Selected only when POLAR_ACCESS_TOKEN is non-empty.
 * Checkout and portal fail closed until the Polar HTTP adapter is connected.
 */
export function PolarBillingLive(credentials: PolarCredentials): Layer.Layer<BillingService> {
  return Layer.succeed(BillingService, makeBillingService(makePolarBackend(credentials)));
}

export function readPolarCredentials(env: {
  POLAR_ACCESS_TOKEN?: string;
  POLAR_SERVER?: string;
}): PolarCredentials | undefined {
  const accessToken = env.POLAR_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return undefined;
  }

  return {
    accessToken,
    server: env.POLAR_SERVER?.trim() === "production" ? "production" : "sandbox",
  };
}

export function billingLiveFromEnv(env: {
  POLAR_ACCESS_TOKEN?: string;
  POLAR_SERVER?: string;
}): Layer.Layer<BillingService> {
  const credentials = readPolarCredentials(env);
  return credentials ? PolarBillingLive(credentials) : FakeBillingLive;
}

export async function runBillingEffect<A, E>(
  effect: Effect.Effect<A, E, BillingService>,
  live: Layer.Layer<BillingService> = FakeBillingLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
