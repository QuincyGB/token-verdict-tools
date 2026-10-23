# Canonical listing copy — Token Verdict MCP server

Canonical copy pack for directory submissions. Every statement below is taken from the repo's own READMEs (`README.md`, `mcp/README.md`, `mcp/pyproject.toml`) — reuse verbatim; do not embellish.

- **Name:** Token Verdict
- **Package name (PyPI):** `token-verdict-mcp` (v0.1.0)
- **Registry name (reserved in `../server.json`):** `io.github.quincygb/token-verdict-mcp`
- **One-line description (94 chars, from `mcp/pyproject.toml`):** MCP server for Token Verdict — pay-per-call token risk verdicts over x402 ($0.02 USDC on Base)
- **Repository:** https://github.com/QuincyGB/token-verdict-tools (MCP server in `mcp/`)
- **Service:** https://token-verdict-production.up.railway.app
- **License:** MIT
- **Type:** Local MCP server over stdio (Python, MCP v1 SDK)

---

# Token Verdict MCP Server

An [MCP](https://modelcontextprotocol.io) server (stdio transport) that exposes **Token Verdict** as a native tool for any MCP host — Claude Desktop, Cursor, or your own agent runtime.

Token Verdict is a pay-per-call token risk screen for AI agents: send a token contract address, get back a verdict (**SOLID / CAUTION / DANGER**), a 0–100 risk score, six weighted market-structure signals explained in plain English, and a written analyst take. It costs **$0.02 USDC per call on Base**, paid via the [x402 protocol](https://x402.org) — no accounts, no API keys; the payment is the authentication.

## The tool

**`token_verdict`**

| Input | Type | Notes |
|---|---|---|
| `address` | string (required) | Token contract address (`0x...`) |
| `chain` | string, default `"base"` | `base` · `ethereum` · `solana` — which token market to analyze. Payment always settles in USDC on Base. |

Output is the service's verdict JSON: `token`, `verdict`, `score`, `signals` (exactly six), `take`, and `market`.

## Install

```bash
pip install token-verdict-mcp     # once published on PyPI; until then, from a checkout:
pip install ./mcp                  # (the mcp/ directory of QuincyGB/token-verdict-tools)
```

Requires Python ≥ 3.10. The server pins the MCP v1 SDK API (`mcp>=1.2,<2`).

## MCP host configuration

```json
{
  "mcpServers": {
    "token-verdict": {
      "command": "token-verdict-mcp",
      "env": {
        "AGENT_PRIVATE_KEY": "0xYOUR_OWN_WALLET_KEY"
      }
    }
  }
}
```

From a checkout instead of an install:

```json
{
  "mcpServers": {
    "token-verdict": {
      "command": "python",
      "args": ["-m", "token_verdict_mcp"],
      "env": {
        "PYTHONPATH": "/path/to/token-verdict-tools/mcp/src",
        "AGENT_KEY_FILE": "/path/to/your/agent.key"
      }
    }
  }
}
```

## Configuration

All configuration is the operator's own environment — whoever runs this server supplies their own wallet. No key material ships in this package.

| Env var | Required | Purpose |
|---|---|---|
| `AGENT_PRIVATE_KEY` | for paid calls | EVM private key (`0x...`) of a wallet holding USDC on Base. Used locally to sign the x402 EIP-3009 authorization. |
| `AGENT_KEY_FILE` | alternative | Path to a file containing that key. |
| `TOKEN_VERDICT_URL` | no | Service base URL override (default: production). |
| `TOKEN_VERDICT_MAX_AMOUNT_UNITS` | no | Spend guard per call in USDC micro-units (default `20000` = $0.02, the known price). The client refuses to sign anything priced above it. |

Without a signer configured the tool never pays. On a 402 it returns the parsed challenge as a structured error — `error: "payment_required"` with the full `accepts` array — so the calling agent can see the price and decide what to do, or settle the challenge with its own x402 client.

## License

MIT
