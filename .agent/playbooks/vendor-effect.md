# Playbook: vendor Effect source for coding agents

Effect’s guidance: give agents real library source, not just docs. Preferred mechanism is **git subtree** under `repos/effect` (not a submodule). See [Effect blog](https://www.effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive).

Day-to-day, `node_modules/effect/AGENTS.md` + `node_modules/effect/src` already ship with the npm package and are enough for most tasks. Vendor the full git tree when agents keep guessing wrong APIs or you want tests/examples from upstream.

## Default: subtree

```bash
pnpm agent:vendor-effect
# equivalent:
node scripts/vendor-effect.mjs
```

This runs (approximately):

```bash
git subtree add --prefix=repos/effect https://github.com/Effect-TS/effect.git effect@<root package.json effect version> --squash
```

Then updates `.vscode/settings.json` excludes so humans do not auto-import from `repos/**`.

Consumer clones skip `repos/**` (giget ignore + strip). Clones that want the tree run the same command locally. Do not import application code from `repos/`.

## Alternative: submodule

```bash
pnpm agent:vendor-effect -- --submodule
```

Submodules need `git submodule update --init` after clone. Effect prefers subtree so agents see a normal directory without an extra init step.

## After vendoring

Confirm root `AGENTS.md` already points agents at `repos/effect/` when present. Agents should read `repos/effect/LLMS.md` before writing Effect code. Do not import application code from `repos/`. Do not edit vendored trees unless explicitly updating upstream.

## Refresh

```bash
pnpm agent:vendor-effect -- --pull
```
