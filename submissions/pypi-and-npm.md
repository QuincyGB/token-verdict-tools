# PyPI + npm publishing, then the Official MCP Registry

Status: **PREPARED-BLOCKED.** No PyPI (`~/.pypirc`, token) or npm (`npm whoami` → ENEEDAUTH) session exists on this machine, and accounts must be created by the owner.

## A. Publish `token-verdict-mcp` to PyPI (owner)

1. Register at https://pypi.org/account/register/ (email verification + mandatory 2FA setup).
2. **Required pre-upload edit (MCP Registry ownership proof):** add this exact HTML comment to `mcp/README.md` (it becomes the package's long description), then commit:
   ```
   <!-- mcp-name: io.github.quincygb/token-verdict-mcp -->
   ```
3. Build and upload (from this repo):
   ```bash
   cd mcp
   python -m pip install build twine
   python -m build
   python -m twine upload dist/*
   ```
   First upload uses account credentials (or an account-wide API token from https://pypi.org/manage/account/token/). Afterwards, prefer a project-scoped token or Trusted Publishing (PyPI → project → Publishing → GitHub: `QuincyGB/token-verdict-tools`).
4. Verify: https://pypi.org/project/token-verdict-mcp/ shows v0.1.0.

## B. Publish to the Official MCP Registry (owner, after A)

`server.json` is already in this repo's root and validates against the official schema (`https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`). It declares name `io.github.quincygb/token-verdict-mcp` and the PyPI package above.

```bash
# install mcp-publisher (GitHub releases: modelcontextprotocol/registry)
./mcp-publisher login github   # device-code flow: open the URL, enter the code, authorize
./mcp-publisher publish        # run from the repo root (reads ./server.json)
```

Verify afterwards:
```
https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.quincygb/token-verdict-mcp
```

Note: the registry validates that the referenced PyPI package exists and that its long description carries the `mcp-name` comment from step A2 — publish to the registry only after the PyPI page is live.

## C. Publish `token-verdict-agentkit` to npm (owner, optional)

The AgentKit action package (`agentkit/`, name `token-verdict-agentkit`, v0.1.0) has no registry dependency; npm is its distribution channel.

1. Register at https://www.npmjs.com/signup (enable 2FA).
2. ```bash
   cd agentkit
   npm login
   npm publish --access public
   ```
