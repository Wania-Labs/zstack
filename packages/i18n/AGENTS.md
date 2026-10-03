# packages/i18n

JSON catalogs in `messages/` are the source of truth. Do not edit generated files under `src/paraglide` (gitignored). `pnpm install` compiles them via this package's `prepare` script; after editing catalogs run `pnpm --filter @zstack/i18n build` (turbo `build` / `dev` / `typecheck` also compile first). The message-format plugin is a pinned devDependency loaded from `node_modules`, so compiling never hits the network.

Use semantic keys such as `auth.signIn.title`. Locales are a closed set. This package ships `en` only until another locale is added in `project.inlang`.

Apps import `messages` and `runtime` from this package. Catalogs live in Git. There is no localization SaaS.
