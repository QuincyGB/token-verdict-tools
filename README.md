# Token Verdict Tools — MCP servers moved

This repository is now a **signpost and historical archive** for the three
Verdict Row MCP servers. On 2026-10-25, each server was split into its own
GitHub repository so directories that ingest and claim servers per repository
— notably Glama — can process them independently.

## Current homes

| MCP server | PyPI package | Current GitHub repository | Install |
|---|---|---|---|
| Token Verdict | `token-verdict-mcp` | [QuincyGB/token-verdict-mcp](https://github.com/QuincyGB/token-verdict-mcp) | `pip install token-verdict-mcp` |
| RouteVerdict | `route-verdict-mcp` | [QuincyGB/route-verdict-mcp](https://github.com/QuincyGB/route-verdict-mcp) | `pip install route-verdict-mcp` |
| ListSmith | `list-smith-mcp` | [QuincyGB/list-smith-mcp](https://github.com/QuincyGB/list-smith-mcp) | `pip install list-smith-mcp` |

**The PyPI package names and install commands did not change.** Only the
GitHub home of each MCP server moved. Use the repositories above for current
source code, issues, documentation, and publishing workflows.

## What remains here

Nothing was deleted. This repository retains the pre-split monorepo history,
the AgentKit wrapper, and the submission notes for historical reference. Its
copies of the three MCP servers are no longer the canonical source.

The live services wrapped by these MCP servers are Token Verdict,
RouteVerdict, and ListSmith — pay-per-call x402 services settling in USDC on
Base. The Token Verdict service source remains at
[QuincyGB/token-verdict](https://github.com/QuincyGB/token-verdict).

MIT licensed.
