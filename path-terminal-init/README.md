# path-terminal-init

One-line setup for Path Terminal SDK + MCP + Cursor rules (`npx path-terminal-init`).

## Develop locally

```bash
npm install
npm run build
node dist/cli.js --help
```

## Publish to npm (required for `npx`)

The Dashboard and docs assume **`npx path-terminal-init`**. That only resolves after this package is published:

```bash
npm login
npm publish --access public
```

Until then, partners can run from a checkout:

```bash
node /path/to/path-terminal-init/dist/cli.js
# or
npm exec --prefix /path/to/path-terminal-init path-terminal-init
```

Verify after publish:

```bash
npm view path-terminal-init version
```
