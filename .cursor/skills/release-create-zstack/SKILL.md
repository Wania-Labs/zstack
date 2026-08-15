---
name: release-create-zstack
description: Bump, GitHub-release, and npm-publish @wanialabs/create-zstack through trusted-publisher CI. Use when the user wants to release, publish, or bump create-zstack, cut an npm version, or run the trusted publisher flow.
---

# Release create-zstack

Do not `npm publish` from this machine. Do not add `NPM_TOKEN`. Trusted publisher is already configured on npm for workflow `publish-create-zstack.yml`.

CI bumps `create-zstack/package.json`, publishes `@wanialabs/create-zstack`, pushes tag `create-zstack@x.y.z`, and opens a GitHub release.

## Do this

1. Working tree clean and on `main`, matching `origin/main`. If the user has uncommitted release-worthy work, commit and push it first, then continue.
2. Default bump is `patch`. Use `minor` or `major` only if the user said so.
3. Run from the repo root:

```bash
.cursor/skills/release-create-zstack/release patch
```

Replace `patch` with `minor` or `major` when asked. Dry run (no bump, no npm, no tag):

```bash
.cursor/skills/release-create-zstack/release patch --dry-run
```

4. Wait until the script exits. Report the Actions URL, the `create-zstack@x.y.z` tag, the GitHub release URL, and `https://www.npmjs.com/package/@wanialabs/create-zstack/v/<version>`.

## Stop

- Dirty tree, wrong branch, or `main` behind/ahead of origin in a way you did not just push: stop and say so.
- Failed Actions job: paste the failure, do not retry a bump blindly (a successful npm publish cannot be overwritten).
- Never publish from a laptop, never create an npm token, never retag an existing `create-zstack@*` version.
