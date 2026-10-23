# Directory submission status — Token Verdict MCP server

Prepared 2026-10-23. Canonical copy: [`listing-copy.md`](listing-copy.md). Registry manifest: [`../server.json`](../server.json).

| # | Target | Status | Detail |
|---|---|---|---|
| 1 | Official MCP Registry | **PREPARED-BLOCKED** | `server.json` written + validated against the official schema. Publishing needs (a) the PyPI package to exist and (b) an interactive `mcp-publisher login github`. Steps: [`pypi-and-npm.md`](pypi-and-npm.md) |
| 2 | Smithery | **PREPARED-BLOCKED** | Publishing runs through Smithery's API/dashboard with a `SMITHERY_API_KEY` from a Smithery account. No key exists on this machine. Steps: [`smithery.md`](smithery.md) |
| 3 | mcp.so | **SUBMITTED** (free GitHub route) | [Issue #5974 on chatmcp/mcpso](https://github.com/chatmcp/mcpso/issues/5974). mcp.so's web form is a $39 paid listing — not used. |
| 4 | Glama | **PREPARED-BLOCKED** | Glama auto-indexes GitHub repos; claiming/admin needs the owner signed in to glama.ai. Steps: [`glama.md`](glama.md) |
| 5 | PulseMCP | **SKIPPED** | PulseMCP has paused new submissions and directs publishers to the official MCP Registry, which it will ingest. Note: [`pulsemcp.md`](pulsemcp.md) |
| 6 | awesome-mcp-servers | **SUBMITTED** | [PR #17338](https://github.com/punkpeye/awesome-mcp-servers/pull/17338) to `punkpeye/awesome-mcp-servers`, Finance & Fintech section. |
| 7 | PyPI / npm publishing | **PREPARED-BLOCKED** | No authenticated PyPI or npm session exists on this machine, and new accounts must be created by the owner. Steps: [`pypi-and-npm.md`](pypi-and-npm.md) |

## What only the owner can do (in order)

1. **Create a PyPI account** and publish `token-verdict-mcp` — full click-path in [`pypi-and-npm.md`](pypi-and-npm.md). This unblocks the Official MCP Registry (#1) and, downstream, PulseMCP's ingestion (#5).
2. **Run `mcp-publisher login github` + `publish`** (device-code flow, ~2 minutes) once the PyPI package is live.
3. **Smithery**: sign in at smithery.ai, create an API key — [`smithery.md`](smithery.md).
4. **Glama**: sign in at glama.ai with GitHub and claim the listing once it appears — [`glama.md`](glama.md).
5. **npm** (optional, for the AgentKit action package): create an npm account and publish `token-verdict-agentkit` — [`pypi-and-npm.md`](pypi-and-npm.md).
