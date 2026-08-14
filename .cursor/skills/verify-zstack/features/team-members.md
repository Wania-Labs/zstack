# Team members

The owner can see who is in the team and invite someone by email. Local email is printed to the API log unless Bento is configured.

## Sub-features

- `members-open` opens Members from the sidebar or team home.
- `members-list` shows the signed-in owner as a current member.
- `members-invite` accepts an email and shows Invite sent.
- `members-invite-persist` still lists the owner after the invite (invitees are not members until they accept).

## How to get to it (user POV)

- Choose `Members` in the workspace sidebar.
- Choose `View members` on the team home.
- Open `http://localhost:3000/t/{slug}/members` when already in that team.

## Driving it with the Cursor browser

Preconditions:

- Signed in as the owner from this run. `account.txt` has the slug.
- Team home at `/t/{slug}` is reachable.

- **Open from home.** On team home, choose `View members`. Run `browser_click` on that button. Heading is `Members`. Path ends with `/members`.
- **Open from sidebar.** Go back via sidebar `Home`, then choose sidebar `Members`. Same Members heading.
- **Owner row.** Under `Current members`, a row shows `Verify User` and `zstack-verify-<runId>@example.com` with role `owner`.
- **Send invite.** Fill `Email` (id `invite-email`, labeled Email on this page) with `zstack-verify-<runId>-guest@example.com`. Choose `Send invite`. Run `browser_fill` then `browser_click`. An alert titled `Invite sent` appears. The owner row is still listed. The guest is not a current member.
- **Log side effect.** Copy the invite URL from `.run/api.log` (console EmailService). Proof of send is the alert plus that log line. Do not mark invitation _accept_ as verified unless you also run a second account through `/accept-invitation/{id}`.
- **Proof.** Save snapshot and screenshot of Members after the invite as `artifacts/<runId>/team-members.aria.yml` and `.png`. They show `Members`, the owner email, and `Invite sent`.

## Gotchas

- This page has an Email field for invites, not sign-in. Do not fill the owner's password here.
- Invitees do not appear under Current members until they accept. Looking for the guest in the list is the wrong assertion.
- If Bento keys are set in `.dev.vars`, the invite leaves the machine. On the default console transport, the URL is only in `api.log`.
- Accepting an invite is a different user. Use a second account and the accept-invitation route. That path is not covered by this file until you add it.
