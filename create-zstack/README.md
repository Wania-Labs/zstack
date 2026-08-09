# create-zstack

Authoring-only CLI. `create-zstack` is **excluded** from consumer clones (see root `AUTHORING.md`).

Scaffold a product with citty + giget + nypm:

```bash
pnpm --filter create-zstack start my-app
# or locally against this tree:
ZSTACK_TEMPLATE=file:$(pwd) pnpm --filter create-zstack start /tmp/zstack-smoke --force
```

Defaults to `gh:zain/zstack` (override with `--template` or `ZSTACK_TEMPLATE`). Always strips authoring paths via giget `ignore`.
