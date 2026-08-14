# packages/i18n

JSON catalogs in `messages/` are the source of truth. Do not edit generated files under `src/paraglide`. Compile with this package's `typecheck` script before relying on types.

Use semantic keys such as `auth.signIn.title`. Locales are a closed set. This package ships `en` only until another locale is added in `project.inlang`.

Apps import `messages` and `runtime` from this package. Catalogs live in Git. There is no localization SaaS.
