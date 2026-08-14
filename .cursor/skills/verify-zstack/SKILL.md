---
name: verify-zstack
description: Drive the zstack customer web app in a real browser to prove user-facing behavior. Use when you need to launch the local stack, exercise a mapped feature the way a user would, and keep screenshots plus snapshots as evidence.
---

# Verify zstack

zstack is a product starter. A user touches the customer web app at `http://localhost:3000` (TanStack Start). The Hono API on `:8787` sits behind the Vite `/api` proxy. The staff console on `:3001` is a second app; do not start it unless the feature map says so.

There is no Playwright project. Drive the UI with the Cursor browser MCP. Start and stop the stack with `control-zstack`. Read `features/README.md` before clicking anything.

This checkout shares Postgres on `127.0.0.1:5432` with ordinary local dev. Ports `3000` and `8787` are fixed. Two stacks cannot run side by side. If those ports already belong to someone else, refuse. Do not drive `alchemy:dev` or a leftover Vite/wrangler session you did not start.

## Launch

From the repo root:

```bash
.cursor/skills/verify-zstack/control-zstack launch
.cursor/skills/verify-zstack/control-zstack doctor
```

Ready means `GET http://localhost:8787/health` returns JSON with `"ok": true` and `"database": "up"`, and `GET http://localhost:3000/` returns HTML that contains `zstack`.

`launch` will:

1. Refuse if `:3000` or `:8787` is already listening and is not this verification run.
2. Start Compose Postgres only when `:5432` is empty (`pnpm dev:services`). It never stops Postgres.
3. Create `apps/api/.dev.vars` from the example only when that file is missing. It records that fact and cleanup may remove only a file it created.
4. Run `pnpm db:migrate`. It never runs `pnpm dev:reset` or `docker compose down`.
5. Start detached `pnpm --filter @zstack/api dev` and `pnpm --filter @zstack/web dev` (double-fork so they survive the agent shell), logging to `.cursor/skills/verify-zstack/.run/`.

Staff console (only when a feature file asks):

```bash
.cursor/skills/verify-zstack/control-zstack launch --with-admin
```

Do not use `pnpm alchemy:dev` for verification. Alchemy wants Cloudflare login and is harder to attribute PIDs to.

If `launch` is run from a Cursor agent sandbox, wrangler dies with `EPERM` writing `~/Library/Preferences/.wrangler/logs` or `uv_interface_addresses` errors. Re-run `control-zstack launch` with sandbox disabled (`required_permissions: ["all"]`). Vite can start inside the sandbox. Wrangler cannot.

Teardown is `control-zstack cleanup`. See Cleanup.

## Doctor

```bash
.cursor/skills/verify-zstack/control-zstack doctor
```

Exit 0 only when `.run/meta.json` exists, health JSON is ok, the web origin answers, and the listeners on `:8787` and `:3000` are the PIDs recorded at launch.

If doctor fails, stop. Do not click around in whatever happens to be bound to those ports. Dump `.run/api.log` and `.run/web.log` into the artifact directory, then `cleanup`.

## Drive

Use `http://localhost:3000`, not `http://127.0.0.1:3000`. `BETTER_AUTH_URL` is localhost. Mixing hosts drops the session cookie.

Cursor browser MCP tools: `browser_tabs`, `browser_navigate`, `browser_lock`, `browser_snapshot`, `browser_click`, `browser_fill`, `browser_type`, `browser_press_key`, `browser_take_screenshot`, then `browser_lock` with `unlock` when finished.

Order:

1. `control-zstack doctor`
2. `browser_tabs` with `action: list`. If a tab is already on `localhost:3000`, lock it. Otherwise `browser_navigate` to the URL in the feature file, then lock.
3. `browser_snapshot`. Click and fill by accessible name from that snapshot. Prefer role + name (`Sign in`, `Email`, `Create account`) over CSS or coordinates.
4. After each meaningful action, snapshot again. Do not assume the next screen.

Stable handles live in the feature files. Recurring ones:

| Name                                  | Kind                 | Where                               |
| ------------------------------------- | -------------------- | ----------------------------------- |
| `zstack`                              | heading and nav link | marketing, auth shells, app sidebar |
| `Sign in` / `Sign up` / `Get started` | buttons and links    | `/`                                 |
| `Email`, `Password`, `Name`           | labeled textboxes    | `/login`, `/sign-up`                |
| `Create account`                      | submit               | `/sign-up`                          |
| `Sign in`                             | submit               | `/login`                            |
| `Team name`                           | textbox              | `/onboarding`                       |
| `Create Team`                         | submit               | `/onboarding`                       |
| `Home`, `Members`                     | sidebar              | `/t/$slug`                          |
| `Send invite`                         | submit               | `/t/$slug/members`                  |
| `Sign out`                            | menu item            | user menu in the sidebar footer     |

`/` shows Sign in / Sign up twice (header and main). Prefer the main `Get started` and `Sign in` next to the heading. Snapshot refs distinguish them.

Create a unique user per run. Never log into an account you did not create in this run.

```text
email:    zstack-verify-<runId>@example.com
password: Verify-<runId>-9x
name:     Verify User
team:     Verify <runId>
```

`runId` is in `.run/meta.json` and in `control-zstack launch` stdout. Team slugs append a random 4-character suffix (`createTeamSlug` in `apps/web/src/lib/session.ts`). After onboarding, read the slug from the app header subtitle `/{slug}`. Do not guess `/t/verify-<runId>`.

Write the email, password, team name, and observed slug into `artifacts/<runId>/account.txt`. Keep that file out of git (the artifacts directory is ignored).

## Evidence

Artifact directory:

```bash
.cursor/skills/verify-zstack/control-zstack artifact-dir
```

That prints `.cursor/skills/verify-zstack/artifacts/<runId>/` and creates it. Proof stays there after cleanup. `.run/` does not.

For every feature you claim:

- Record the feature file id and the entry point you used (`features/README.md`).
- Capture the action and the result. A final screenshot with no prior snapshot is not a proof.
- Save an ARIA snapshot (`browser_snapshot` written to `*.aria.yml`) and a screenshot (`browser_take_screenshot` to `*.png`) that show the product name `zstack` plus the thing you asserted.
- For mutations, prove persistence from a second user-facing view (reload, navigate Home then back, or sign out and sign in). Do not trust a toast alone.
- Side effects: a new member row, a new `/t/{slug}` header, a user row in the members list. Invites also log a URL in `.run/api.log` because local email is console-only unless Bento keys are set.
- Exercise the real UI. Do not call Better Auth or oRPC from curl and call that a user proof. `GET /health` is only for doctor.
- If a mapped entry point is blocked, report the click you attempted and the unmet precondition. Do not mark it verified via a different path.

Copy a tail of `.run/api.log` into the artifact dir at the end of the run (cleanup does this, last 200KB only). Do not copy `web.log` wholesale. Button-as-Link warnings can inflate it to gigabytes.

## Cleanup

```bash
.cursor/skills/verify-zstack/control-zstack cleanup
```

Kills only the PIDs recorded under `.run/` (launcher pid plus the listen pids captured after ready). It does not `killall node`, `pkill wrangler`, or `docker compose down`.

Leaves in place:

- `artifacts/<runId>/`
- Compose Postgres and volume `zstack_pg_data`
- `apps/api/.dev.vars` unless this run created that file
- Users you signed up (shared DB). That is fine. Use unique emails so you do not collide.

If launch or doctor fails, run `cleanup` before trying again so ports are not stranded.

## Helpers

Script: `.cursor/skills/verify-zstack/control-zstack` (executable).

```bash
.cursor/skills/verify-zstack/control-zstack launch
.cursor/skills/verify-zstack/control-zstack launch --with-admin
.cursor/skills/verify-zstack/control-zstack doctor
.cursor/skills/verify-zstack/control-zstack artifact-dir
.cursor/skills/verify-zstack/control-zstack urls
.cursor/skills/verify-zstack/control-zstack cleanup
```

Do not invent flags. Read the script if stdout is confusing.

Feature recipes: `features/`.
