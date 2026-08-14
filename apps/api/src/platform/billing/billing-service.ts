import { Context, Effect, Layer, Schema } from "effect";
import { createPolar } from "@polar-sh/sdk/2026-04";

export class BillingError extends Schema.TaggedError<BillingError>()("BillingError", {
  message: Schema.String,
}) {}

export type PolarServer = "sandbox" | "production";

export type PolarCredentials = {
  accessToken: string;
  server: PolarServer;
};

/**
 * Product catalog mapping product slugs to Polar product IDs.
 * Configure via environment variables (e.g., POLAR_PRODUCT_PRO=<product_id>).
 * Empty map when credentials are absent.
 */
export type ProductCatalog = Map<string, string>;

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

function makePolarBackend(
  credentials: PolarCredentials,
  catalog: ProductCatalog,
  successUrl?: string,
): BillingService["Service"] {
  const polar = createPolar({
    accessToken: credentials.accessToken,
    environment: credentials.server,
  });

  return {
    createCheckout: (input) =>
      Effect.gen(function* () {
        const productId = catalog.get(input.productSlug);
        if (!productId) {
          return yield* Effect.fail(
            new BillingError({
              message: `product slug "${input.productSlug}" not found in catalog`,
            }),
          );
        }

        const checkout = yield* Effect.tryPromise({
          try: () =>
            polar.checkouts.create({
              products: [productId],
              external_customer_id: input.customerId,
              success_url: successUrl ?? null,
            }),
          catch: (error) =>
            new BillingError({
              message: `polar checkout failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        if (!checkout.url) {
          return yield* Effect.fail(
            new BillingError({
              message: "polar checkout session returned no url",
            }),
          );
        }

        return { kind: "url", url: checkout.url };
      }),

    customerPortal: (input) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () =>
            polar.customerSessions.create({
              external_customer_id: input.customerId,
            }),
          catch: (error) =>
            new BillingError({
              message: `polar customer portal failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        if (!session.customer_portal_url) {
          return yield* Effect.fail(
            new BillingError({
              message: "polar customer session returned no portal url",
            }),
          );
        }

        return { kind: "url", url: session.customer_portal_url };
      }),

    canUse: () => Effect.succeed(false),
    limit: () => Effect.succeed(0),
  };
}

/**
 * Polar transport. Selected only when POLAR_ACCESS_TOKEN is non-empty.
 * Requires product catalog (env: POLAR_PRODUCT_<SLUG>=<product_id>).
 */
export function PolarBillingLive(
  credentials: PolarCredentials,
  catalog: ProductCatalog,
  successUrl?: string,
): Layer.Layer<BillingService> {
  return Layer.succeed(
    BillingService,
    makeBillingService(makePolarBackend(credentials, catalog, successUrl)),
  );
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

/**
 * Read product catalog from environment variables.
 * Format: POLAR_PRODUCT_<SLUG_UPPERCASE>=<product_id>
 * Example: POLAR_PRODUCT_PRO=prod_abc123 → slug "pro" maps to "prod_abc123"
 */
export function readProductCatalog(env: Record<string, string | undefined>): ProductCatalog {
  const catalog = new Map<string, string>();
  const prefix = "POLAR_PRODUCT_";

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(prefix) && value?.trim()) {
      const slug = key.slice(prefix.length).toLowerCase();
      catalog.set(slug, value.trim());
    }
  }

  return catalog;
}

export function billingLiveFromEnv(env: {
  POLAR_ACCESS_TOKEN?: string;
  POLAR_SERVER?: string;
  POLAR_CHECKOUT_SUCCESS_URL?: string;
  [key: string]: string | undefined;
}): Layer.Layer<BillingService> {
  const credentials = readPolarCredentials(env);
  if (!credentials) {
    return FakeBillingLive;
  }

  const catalog = readProductCatalog(env);
  const successUrl = env.POLAR_CHECKOUT_SUCCESS_URL?.trim();
  return PolarBillingLive(credentials, catalog, successUrl);
}

/**
 * Select billing layer from Worker env bindings (like AiLive).
 * Use this at the Worker edge to wire the adapter.
 */
export function BillingLive(env: {
  POLAR_ACCESS_TOKEN?: string;
  POLAR_SERVER?: string;
  POLAR_CHECKOUT_SUCCESS_URL?: string;
  [key: string]: unknown;
}): Layer.Layer<BillingService> {
  return billingLiveFromEnv(env as Record<string, string | undefined>);
}

export async function runBillingEffect<A, E>(
  effect: Effect.Effect<A, E, BillingService>,
  live: Layer.Layer<BillingService> = FakeBillingLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
