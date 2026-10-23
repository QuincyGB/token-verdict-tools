# token-verdict-mcp

An [MCP](https://modelcontextprotocol.io) server (stdio transport) that
exposes **Token Verdict** as a native tool for any MCP host — Claude
Desktop, Cursor, or your own agent runtime.

Token Verdict is a pay-per-call token risk screen for AI agents: send a
token contract address, get back a verdict (**SOLID / CAUTION /
DANGER**), a 0–100 risk score, six weighted market-structure signals
explained in plain English, and a written analyst take. It costs
**$0.02 USDC per call on Base**, paid via the
[x402 protocol](https://x402.org) — no accounts, no API keys; the
payment is the authentication.

## The tool

**`token_verdict`** — one tool, the service's real contract:

| Input | Type | Notes |
|---|---|---|
| `address` | string (required) | Token contract address (`0x...`) |
| `chain` | string, default `"base"` | `base` · `ethereum` · `solana` — which token market to analyze. Payment always settles in USDC on Base. |

Output is the service's verdict JSON: `token`, `verdict`, `score`,
`signals` (exactly six), `take`, and `market` (the raw data the verdict
derives from, so callers can re-check the math). Market-structure
analysis only — honeypot simulation and holder concentration are not
checked, and the product says so in every take.

## Install

```bash
pip install token-verdict-mcp     # once published; or from a checkout:
pip install ./mcp                  # (this directory)
```

Requires Python ≥ 3.10. The server pins the MCP v1 SDK API
(`mcp>=1.2,<2`).

## Configuration

All configuration is the **operator's own environment** — whoever runs
this server supplies their own wallet. No key material ships in this
package, and the package author never sees your key.

| Env var | Required | Purpose |
|---|---|---|
| `AGENT_PRIVATE_KEY` | for paid calls | EVM private key (`0x...`) of a wallet holding USDC on Base. Used locally to sign the x402 EIP-3009 authorization. |
| `AGENT_KEY_FILE` | alternative | Path to a file containing that key. |
| `TOKEN_VERDICT_URL` | no | Service base URL override (default: production). |
| `TOKEN_VERDICT_MAX_AMOUNT_UNITS` | no | Spend guard per call in USDC micro-units (default `20000` = $0.02, the known price). The client refuses to sign anything priced above it. |

**Without a signer configured the tool never pays.** On a 402 it
returns the parsed challenge as a structured error — `error:
"payment_required"` with the full `accepts` array (scheme, network,
asset, amount, payTo) — so the calling agent can see the price and
decide what to do, or settle the challenge with its own x402 client.

## MCP host configuration

Claude Desktop (`claude_desktop_config.json`) — same shape for other
stdio MCP hosts:

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

Prefer `AGENT_KEY_FILE` over inlining a key in a config file when your
host setup allows it.

## How payment works

The client mirrors the standard x402 v2 flow (the same flow used for
the service's own live cataloging payment):

1. `POST /v1/verdict` unpaid → HTTP 402, challenge base64-encoded in the
   `payment-required` header.
2. Pick the `exact` / `eip155:8453` entry from `accepts`.
3. Build an EIP-3009 `TransferWithAuthorization` (`validAfter: 0`,
   `validBefore: now + maxTimeoutSeconds`, random 32-byte nonce) and
   sign it as EIP-712 typed data against the USDC domain the challenge
   advertises (`extra.name` / `extra.version`).
4. Retry the identical POST with the payload in the `PAYMENT-SIGNATURE`
   header. The service verifies and settles through its facilitator
   (PayAI) server-side; the settlement receipt comes back in the
   `payment-response` header.

## Tests

```bash
pip install -e ".[dev]"
pytest
```

14 tests, all payments mocked (httpx `MockTransport`, throwaway signer
generated at test time). The 402 fixture is the real challenge captured
from production; the paid-flow test verifies the EIP-712 signature
actually recovers to the signer address.

## Security notes

- Your private key is read from your environment at runtime and used
  only to sign payment authorizations locally. It is never transmitted —
  the x402 payload contains a signature, not a key.
- The spend guard caps any single call at the configured amount
  (default: exactly the $0.02 price).
- Run this with a dedicated agent wallet holding only working funds,
  the same way you would fund any agent.
