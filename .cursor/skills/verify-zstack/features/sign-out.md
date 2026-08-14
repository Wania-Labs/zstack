# Sign out

A signed-in user ends the session from the app shell and returns to the Sign in page. Guest routes become available again.

## Sub-features

- `signout-menu` opens the user menu in the sidebar footer.
- `signout-submit` chooses Sign out and lands on Sign in.
- `signout-clears-app` refuses `/app` and `/t/{slug}` until the user signs in again.

## How to get to it (user POV)

- Choose the user button in the sidebar footer (shows the account name `Verify User`).
- Choose `Sign out`.
- Open `http://localhost:3000/logout` directly.

## Driving it with the Cursor browser

Preconditions:

- Signed in. Team home is visible. The sidebar footer shows `Verify User`.

- **Open menu.** Choose the button that includes `Verify User`. Run `browser_click` on that button. A menu lists the email and `Sign out`.
- **Sign out.** Choose `Sign out`. Run `browser_click`. Brief `Signing out` / `Ending your session…` is ok. Wait until the heading is `Sign in`.
- **App is closed.** Navigate to `http://localhost:3000/app`. The app must not show the team home. It should redirect to `/login`.
- **Guest home.** Navigate to `http://localhost:3000/`. `Get started` and `Sign in` are back. `Open app` is absent.
- **Proof.** Save snapshot and screenshot of `/login` after sign-out as `artifacts/<runId>/sign-out.aria.yml` and `.png`, plus a snapshot of `/` showing guest CTAs as `artifacts/<runId>/sign-out-home.aria.yml`.

## Gotchas

- `/logout` signs out on load. Waiting on that page forever means `signOut` failed. Read the heading. An error string replaces `Ending your session…`.
- The user menu is a dropdown. If `Sign out` is not in the snapshot, the menu did not open. Click the name button again, then snapshot.
- Signing out does not delete the account. Sign in still works with `account.txt`.
