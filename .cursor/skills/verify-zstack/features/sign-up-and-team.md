# Sign up and create a team

A new user creates an email account, names a Team, and lands in that team's workspace. Email verification is not required on the local stack.

## Sub-features

- `signup-open` opens the Create account form from Get started or `/sign-up`.
- `signup-submit` creates the account and moves the user into onboarding when they have no team.
- `signup-reject` shows Could not sign up when the email is already taken.
- `onboard-create` creates a Team from a name and opens `/t/{slug}`.

## How to get to it (user POV)

- Choose `Get started` on `/`.
- Choose header `Sign up` on `/`.
- Open `http://localhost:3000/sign-up` directly.
- After a successful sign-up with no team, the app sends the user to `/onboarding`.

## Driving it with the Cursor browser

Preconditions:

- `control-zstack doctor` reports the expected web URL.
- No session on `localhost:3000`.
- `runId` from `.run/meta.json`. Email `zstack-verify-<runId>@example.com` is unused.

- **Open form.** Choose `Get started` from `/`, or navigate to `http://localhost:3000/sign-up`. Run `browser_snapshot`. Heading is `Create account`. Textboxes are named `Name`, `Email`, and `Password`.
- **Fill account.** Run `browser_fill` on `Name` with `Verify User`, `Email` with `zstack-verify-<runId>@example.com`, and `Password` with `Verify-<runId>-9x`.
- **Submit.** Choose `Create account`. Run `browser_click` on that button. Wait until the heading is `Name your Team` (onboarding) or a team home heading. Do not treat `Creating…` as success.
- **Name team.** On `/onboarding`, fill `Team name` with `Verify <runId>` and choose `Create Team`. Run `browser_fill` then `browser_click`. The app shell appears. The header shows team name `Verify <runId>` and a subtitle `/{slug}` where slug starts with `verify-` and ends with a 4-character suffix.
- **Confirm workspace.** The sidebar includes `Home` and `Members`. The main heading matches the team name. Write email, password, team name, and the observed slug into `artifacts/<runId>/account.txt`.
- **Proof.** Save snapshot and screenshot of the team home as `artifacts/<runId>/sign-up-and-team.aria.yml` and `.png`. Both show `zstack`, the team name, and `/{slug}`. Reload `http://localhost:3000/app` and confirm it returns to the same `/t/{slug}`.

## Gotchas

- Password must be at least 8 characters. The form says so.
- Duplicate email shows an alert titled `Could not sign up`. Pick a new runId rather than guessing recovery.
- The team URL is not `/t/verify-<runId>`. The slug adds a random suffix. Read it from the header subtitle.
- `/app` is a spinner that redirects. Wait for the destination heading, not the word `Opening app…`.
- If sign-up lands on `/login` instead of onboarding, the session did not stick. Check `api.log` and stop. Do not keep submitting.
- Direct `/sign-up` SSR needs an absolute auth base URL on the server (`apps/web/src/lib/auth-client.ts`). Relative `fetch("/api/auth/get-session")` becomes `Failed to parse URL from /api/auth/get-session`.
