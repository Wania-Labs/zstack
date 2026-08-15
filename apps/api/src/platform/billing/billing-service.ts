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

export type PolarCustomerState = {
  grantedBenefits: ReadonlyArray<{
    benefitId?: string;
    feature?: string;
  }>;
  meters: ReadonlyArray<{
    name: string;
    balance: number;
  }>;
};

export type PolarTransport = {
  createCheckout(input: {
    productId: string;
    customerId: string;
    successUrl?: string;
  }): Promise<{ url?: string | null }>;
  createCustomerSession(input: { customerId: string }): Promise<{
    customer_portal_url?: string | null;
  }>;
  getCustomerState(customerId: string): Promise<PolarCustomerState | undefined>;
  ingestUsage(input: {
    customerId: string;
    name: string;
    operationId: string;
  }): Promise<{ polarEventId?: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotFound(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const status = error.status ?? error.statusCode ?? error.status_code;
  if (status === 404) {
    return true;
  }
  const nested = error.error;
  if (isRecord(nested) && (nested.status === 404 || nested.statusCode === 404)) {
    return true;
  }
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return message.includes("not found") || message.includes("404");
}

function readFeature(metadata: unknown): string | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }
  const feature = metadata.feature;
  return typeof feature === "string" && feature.trim() ? feature.trim() : undefined;
}

function normalizeCustomerState(value: unknown): PolarCustomerState {
  if (!isRecord(value)) {
    return { grantedBenefits: [], meters: [] };
  }

  const rawBenefits = Array.isArray(value.granted_benefits)
    ? value.granted_benefits
    : Array.isArray(value.grantedBenefits)
      ? value.grantedBenefits
      : [];
  const grantedBenefits: PolarCustomerState["grantedBenefits"] = rawBenefits.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const benefitId =
      typeof entry.benefit_id === "string"
        ? entry.benefit_id
        : typeof entry.benefitId === "string"
          ? entry.benefitId
          : undefined;
    const feature =
      readFeature(entry.benefit_metadata) ??
      readFeature(entry.benefitMetadata) ??
      (typeof entry.benefit_type === "string" ? entry.benefit_type : undefined);
    return [
      {
        ...(benefitId ? { benefitId } : {}),
        ...(feature ? { feature } : {}),
      },
    ];
  });

  const rawMeters = Array.isArray(value.active_meters)
    ? value.active_meters
    : Array.isArray(value.activeMeters)
      ? value.activeMeters
      : [];
  const meters = rawMeters.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const name =
      typeof entry.meter_id === "string"
        ? entry.meter_id
        : typeof entry.meterId === "string"
          ? entry.meterId
          : typeof entry.name === "string"
            ? entry.name
            : undefined;
    const balance = typeof entry.balance === "number" ? entry.balance : undefined;
    if (!name || balance === undefined) {
      return [];
    }
    return [{ name, balance }];
  });

  return { grantedBenefits, meters };
}

function canUseFromState(state: PolarCustomerState, capability: string): boolean {
  return state.grantedBenefits.some(
    (benefit) => benefit.feature === capability || benefit.benefitId === capability,
  );
}

function limitFromState(state: PolarCustomerState, name: string): number {
  return state.meters.find((meter) => meter.name === name)?.balance ?? 0;
}

export function makePolarSdkTransport(polar: ReturnType<typeof createPolar>): PolarTransport {
  return {
    createCheckout: async (input) => {
      const checkout = await polar.checkouts.create({
        products: [input.productId],
        external_customer_id: input.customerId,
        success_url: input.successUrl ?? null,
      });
      return { url: checkout.url };
    },
    createCustomerSession: async (input) => {
      const session = await polar.customerSessions.create({
        external_customer_id: input.customerId,
      });
      return { customer_portal_url: session.customer_portal_url };
    },
    getCustomerState: async (customerId) => {
      try {
        const state = await polar.customers.getStateExternal(customerId);
        return normalizeCustomerState(state);
      } catch (error) {
        if (isNotFound(error)) {
          return undefined;
        }
        throw error;
      }
    },
    ingestUsage: async (input) => {
      await polar.events.ingest({
        events: [
          {
            name: input.name,
            external_customer_id: input.customerId,
            external_id: input.operationId,
          },
        ],
      });
      return { polarEventId: input.operationId };
    },
  };
}

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

export type RemainingInput = LimitInput;

export type EntitlementInput = {
  customerId: string;
  name: string;
};

export type EntitlementResult = {
  granted: boolean;
  remaining: number;
};

export type ReportUsageInput = {
  customerId: string;
  name: string;
  operationId: string;
};

export type CustomerSnapshot = {
  capabilities: string[];
  limits: Record<string, number>;
};

export type IngestUsageInput = ReportUsageInput;

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
    remaining(input: RemainingInput): Effect.Effect<number, BillingError>;
    entitlement(input: EntitlementInput): Effect.Effect<EntitlementResult, BillingError>;
    customerSnapshot(customerId: string): Effect.Effect<CustomerSnapshot, BillingError>;
    ingestUsage(input: IngestUsageInput): Effect.Effect<{ polarEventId?: string }, BillingError>;
    isConfigured(): Effect.Effect<boolean>;
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
    remaining: (input) =>
      Effect.gen(function* () {
        const customerId = yield* requireOpaque(input.customerId, "customer id");
        const name = yield* requireOpaque(input.name, "limit name");
        return yield* backend.remaining({ customerId, name });
      }),
    entitlement: (input) =>
      Effect.gen(function* () {
        const customerId = yield* requireOpaque(input.customerId, "customer id");
        const name = yield* requireOpaque(input.name, "entitlement name");
        return yield* backend.entitlement({ customerId, name });
      }),
    customerSnapshot: (customerId) =>
      Effect.gen(function* () {
        const id = yield* requireOpaque(customerId, "customer id");
        return yield* backend.customerSnapshot(id);
      }),
    ingestUsage: (input) =>
      Effect.gen(function* () {
        const customerId = yield* requireOpaque(input.customerId, "customer id");
        const name = yield* requireOpaque(input.name, "usage name");
        const operationId = yield* requireOpaque(input.operationId, "operation id");
        return yield* backend.ingestUsage({ customerId, name, operationId });
      }),
    isConfigured: () => backend.isConfigured(),
  });
}

function makeFakeBackend(): BillingService["Service"] {
  return {
    createCheckout: () => Effect.succeed({ kind: "unconfigured" }),
    customerPortal: () => Effect.succeed({ kind: "unconfigured" }),
    canUse: () => Effect.succeed(false),
    limit: () => Effect.succeed(0),
    remaining: () => Effect.succeed(0),
    entitlement: () => Effect.succeed({ granted: false, remaining: 0 }),
    customerSnapshot: () => Effect.succeed({ capabilities: [], limits: {} }),
    ingestUsage: () => Effect.succeed({}),
    isConfigured: () => Effect.succeed(false),
  };
}

/**
 * Local/dev billing when Polar credentials are absent.
 */
export const FakeBillingLive = Layer.succeed(BillingService, makeBillingService(makeFakeBackend()));

function makePolarBackend(
  transport: PolarTransport,
  catalog: ProductCatalog,
  successUrl?: string,
): BillingService["Service"] {
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

        const resolvedSuccess = successUrl ?? input.successUrl;
        const checkout = yield* Effect.tryPromise({
          try: () =>
            transport.createCheckout({
              productId,
              customerId: input.customerId,
              ...(resolvedSuccess ? { successUrl: resolvedSuccess } : {}),
            }),
          catch: () =>
            new BillingError({
              message: "polar checkout failed",
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
          try: () => transport.createCustomerSession({ customerId: input.customerId }),
          catch: () =>
            new BillingError({
              message: "polar customer portal failed",
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

    canUse: (input) =>
      Effect.gen(function* () {
        const state = yield* Effect.tryPromise({
          try: () => transport.getCustomerState(input.customerId),
          catch: () =>
            new BillingError({
              message: "polar customer state failed",
            }),
        });
        if (!state) {
          return false;
        }
        return canUseFromState(state, input.capability);
      }),

    limit: (input) =>
      Effect.gen(function* () {
        const state = yield* Effect.tryPromise({
          try: () => transport.getCustomerState(input.customerId),
          catch: () =>
            new BillingError({
              message: "polar customer state failed",
            }),
        });
        if (!state) {
          return 0;
        }
        return limitFromState(state, input.name);
      }),

    remaining: (input) =>
      Effect.gen(function* () {
        const state = yield* Effect.tryPromise({
          try: () => transport.getCustomerState(input.customerId),
          catch: () =>
            new BillingError({
              message: "polar customer state failed",
            }),
        });
        if (!state) {
          return 0;
        }
        return limitFromState(state, input.name);
      }),

    entitlement: (input) =>
      Effect.gen(function* () {
        const state = yield* Effect.tryPromise({
          try: () => transport.getCustomerState(input.customerId),
          catch: () =>
            new BillingError({
              message: "polar customer state failed",
            }),
        });
        if (!state) {
          return { granted: false, remaining: 0 };
        }
        return {
          granted: canUseFromState(state, input.name),
          remaining: limitFromState(state, input.name),
        };
      }),

    customerSnapshot: (customerId) =>
      Effect.gen(function* () {
        const state = yield* Effect.tryPromise({
          try: () => transport.getCustomerState(customerId),
          catch: () =>
            new BillingError({
              message: "polar customer state failed",
            }),
        });
        if (!state) {
          return { capabilities: [], limits: {} };
        }
        return {
          capabilities: [
            ...new Set(
              state.grantedBenefits.flatMap((benefit) => {
                const values = [benefit.feature, benefit.benefitId].filter(
                  (value): value is string => typeof value === "string" && value.length > 0,
                );
                return values;
              }),
            ),
          ],
          limits: Object.fromEntries(state.meters.map((meter) => [meter.name, meter.balance])),
        };
      }),

    ingestUsage: (input) =>
      Effect.tryPromise({
        try: () => transport.ingestUsage(input),
        catch: () =>
          new BillingError({
            message: "polar usage ingest failed",
          }),
      }),

    isConfigured: () => Effect.succeed(true),
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
  transport?: PolarTransport,
): Layer.Layer<BillingService> {
  const polarTransport =
    transport ??
    makePolarSdkTransport(
      createPolar({
        accessToken: credentials.accessToken,
        environment: credentials.server,
      }),
    );
  return Layer.succeed(
    BillingService,
    makeBillingService(makePolarBackend(polarTransport, catalog, successUrl)),
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
