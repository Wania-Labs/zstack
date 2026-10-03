import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/**
 * One Workers compatibility date for api / web / admin. Keep the
 * `compatibility_date` in each app's `wrangler.jsonc` in sync.
 */
export const compatibility = {
  date: "2026-08-07",
  flags: ["nodejs_compat"],
};

const configError = (message: string) => new Config.ConfigError(new SourceError({ message }));

/**
 * A public browser origin (e.g. `BETTER_AUTH_URL`, `ADMIN_URL`).
 *
 * - `alchemy dev`: optional, defaults to the local Vite port.
 * - deploy / plan: required and must be `https://` (Secure cookies, no
 *   localhost in Better Auth `trustedOrigins`).
 *
 * Not derived from `web.url` / `admin.url`: web and admin bind the API Worker
 * (`API` service binding), so the API cannot also take their URLs as inputs
 * without a resource cycle. Set these to your custom domains, or to the
 * `workers.dev` URLs printed as `webUrl` / `adminUrl` stack outputs.
 */
export const publicOrigin = (name: string, devDefault: string) =>
  Config.all({
    dev: Alchemy.ALCHEMY_DEV,
    value: Config.option(Config.String(name)),
  }).pipe(
    Config.mapEffect(({ dev, value }) => {
      const raw = Option.getOrElse(value, () => "").trim();
      if (raw === "") {
        return dev
          ? Effect.succeed(devDefault)
          : Effect.fail(
              configError(
                `${name} is required for deploy: set it to the public https:// origin ` +
                  `(custom domain or the workers.dev URL). See .agent/playbooks/deploy-alchemy.md.`,
              ),
            );
      }

      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return Effect.fail(configError(`${name} must be an absolute URL, got "${raw}".`));
      }
      if (!dev && url.protocol !== "https:") {
        return Effect.fail(
          configError(`${name} must use https:// outside alchemy dev, got "${url.origin}".`),
        );
      }
      return Effect.succeed(url.origin);
    }),
  );
