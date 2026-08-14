# Sign in

A returning user signs in with email and password and lands in their existing team workspace.

## Sub-features

- `signin-open` opens the Sign in form from `/` or `/login`.
- `signin-success` authenticates and opens the team home.
- `signin-reject` shows Could not sign in for a bad password.
- `signin-guest-guard` sends an already-signed-in user away from `/login` toward the app.

## How to get to it (user POV)

- Choose `Sign in` on `/`.
- Open `http://localhost:3000/login`.
- Follow `Sign in` from the Create account page.

## Driving it with the Cursor browser

Preconditions:

- `control-zstack doctor` reports the expected web URL.
- An account from this run exists. Read `artifacts/<runId>/account.txt` (created by Sign up and create a team). If that file is missing, run that feature first.
- No session, or sign out first.

- **Open form.** Navigate to `http://localhost:3000/login`. Run `browser_snapshot`. Heading is `Sign in`. Fields are `Email` and `Password`.
- **Reject.** Fill Email with the run account and Password with `wrong-password`. Choose `Sign in`. Run `browser_click`. An alert titled `Could not sign in` appears. The path stays `/login`.
- **Success.** Fill Email and Password from `account.txt`. Choose `Sign in`. Wait until the app shell shows the team name from `account.txt` and subtitle `/{slug}` matching that file.
- **Proof.** Save snapshot and screenshot of the team home as `artifacts/<runId>/sign-in.aria.yml` and `.png`. Then navigate to `http://localhost:3000/login` again. The app must not show the Sign in form. It should bounce toward `/app` or the team home.

## Gotchas

- Main `Sign in` on `/` and header `Sign in` both work. Record which one you used.
- `Signing in…` is in-flight. Wait for either the error alert or the team heading.
- A session from a previous browser tab will skip the form. Check the snapshot before filling.
