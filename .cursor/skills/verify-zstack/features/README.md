# zstack verification map

This directory is the maintained source for verifying user-facing behavior of the zstack customer web app. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `.cursor/skills/verify-zstack/control-zstack launch`.
- Require `.cursor/skills/verify-zstack/control-zstack doctor` to print `doctor ok` against `http://localhost:3000` and `http://localhost:8787/health`.
- Never drive an instance that this run did not start.
- Create accounts with `zstack-verify-<runId>@example.com` and password `Verify-<runId>-9x`. Do not reuse a human's inbox.
- Leave Postgres running. Do not `pnpm dev:reset`.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position.
- Treat every command as literal. Keep quoted names and URLs unchanged.
- Run process control through `control-zstack`.
- Run UI actions through the Cursor browser MCP (`browser_snapshot`, `browser_click`, `browser_fill`).
- Restore nothing in the shared database except by creating unique rows. Do not delete other users. Keep proof artifacts.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with the word `zstack` visible.
- Mutation proof includes a second read of the stored value from another screen or a reload.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with the Cursor browser` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Marketing home](./marketing-home.md) covers the guest landing, header and main CTAs, and reaching sign-in and sign-up.
- [Sign up and create a team](./sign-up-and-team.md) covers account creation, onboarding, and landing in a team workspace.
- [Sign in](./sign-in.md) covers returning to an existing account and landing in the right workspace.
- [Team members](./team-members.md) covers listing the owner and sending an invite.
- [Sign out](./sign-out.md) covers ending the session from the app shell and returning to sign-in.
