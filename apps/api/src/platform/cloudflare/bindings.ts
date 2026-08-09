export type ApiBindings = {
  HYPERDRIVE: Hyperdrive;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Verified sender used by Bento (`from`). Absent → console transport. */
  EMAIL_FROM?: string;
  BENTO_SITE_UUID?: string;
  BENTO_PUBLISHABLE_KEY?: string;
  BENTO_SECRET_KEY?: string;
};
