# Marketing home

The guest landing at `/` identifies the product as zstack and offers Sign in and Sign up. A signed-in visitor sees Open app instead.

## Sub-features

- `home-guest` shows the zstack heading plus Sign in and Get started when no session cookie is present.
- `home-header-nav` exposes the same destinations in the header.
- `home-to-signup` follows Get started to Create account.
- `home-to-signin` follows Sign in to the Sign in form.

## How to get to it (user POV)

- Open `http://localhost:3000/`.
- Choose `Get started` or header `Sign up` to create an account.
- Choose `Sign in` in the header or next to the heading.

## Driving it with the Cursor browser

Preconditions:

- `control-zstack doctor` reports the expected web URL.
- The browser has no zstack session on `localhost:3000`. If a user menu is visible, run the Sign out feature first.

- **Open landing.** Navigate to `http://localhost:3000/`. Run `browser_navigate` with that URL, then `browser_lock`, then `browser_snapshot`. The heading `zstack` is visible. `Get started` and `Sign in` are links (shadcn Button rendered as `Link`, not native buttons).
- **Header nav.** Confirm the header also has `Sign in` and `Sign up` links.
- **Sign up CTA.** Choose `Get started` in the main region. Run `browser_click` on the `Get started` link. Describe it as a link, not a button, or the click tool rejects the ref. The heading reads `Create account` and the path is `/sign-up`.
- **Sign in CTA.** Navigate back to `/` and choose the main `Sign in` link (`nth: 1` in the snapshot). Run `browser_navigate` to `http://localhost:3000/` then `browser_click` on that `Sign in` link. The heading reads `Sign in` and labeled `Email` and `Password` fields are present.
- **Proof.** Save `browser_snapshot` to `artifacts/<runId>/marketing-home.aria.yml` and `browser_take_screenshot` to `artifacts/<runId>/marketing-home.png` on the guest landing before leaving it. Both show `zstack` plus `Get started`.

## Gotchas

- `/` duplicates Sign in and Sign up. Click the main `Get started` / `Sign in` beside the heading, not whichever ref is first in the snapshot, unless you are proving the header path.
- A signed-in session replaces those CTAs with `Open app`. That is a different state. Do not treat it as guest home.
- Theme toggle lives on this page. Ignore it unless you are specifically proving theme.
- Use `localhost`, not `127.0.0.1`. Auth cookies are bound to `BETTER_AUTH_URL`.
- The landing can log a Base UI `nativeButton` warning and a root `notFoundError` warning. The page still renders. Do not treat the console as a failed home. Do not copy `web.log` in full.
- `Get started` / `Sign in` / `Sign up` are links, not buttons. If `browser_click` says it expected a button, describe the target as a link and snapshot again.
- Client-side clicks can change the URL before the new route paints. Wait for the `Create account` or `Sign in` heading. If you see `Failed to parse URL from /api/auth/get-session`, the web SSR auth client lost its absolute `API_ORIGIN` (see `apps/web/src/lib/auth-client.ts`). Stop and fix that before calling sign-up verified.
