# Token Verdict — agent distribution wrappers

Native tool wrappers for **[Token Verdict](https://token-verdict-production.up.railway.app)**,
the pay-per-call token risk screen for AI agents ($0.02 USDC per call on
Base, via the [x402 protocol](https://x402.org)).

Token Verdict's buyers are other agents. These packages put the service
on the shelves agents actually shop from, in the formats they call
natively — payment handled by each agent's **own** wallet, with a spend
guard at the known price:

| Package | Stack | What it gives an agent |
|---|---|---|
| [`mcp/`](mcp/) | Python · MCP (stdio) | A `token_verdict` tool in any MCP host (Claude Desktop, Cursor, custom runtimes), paying via an operator-configured EVM signer. |
| [`agentkit/`](agentkit/) | TypeScript · Coinbase AgentKit | A `token_verdict` action in any AgentKit agent, paying from the agent's `EvmWalletProvider`. |

Both wrap the same real contract — `POST /v1/verdict`:

```json
{ "address": "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b", "chain": "base" }
```

→ `{ token, verdict: SOLID|CAUTION|DANGER, score (0–100), signals (six
weighted market-structure signals), take, market }`.

Both implement the standard x402 v2 `exact`-scheme flow (402 → sign an
EIP-3009 USDC authorization → retry with `PAYMENT-SIGNATURE`), the same
flow used for the service's live cataloging payment; the service settles
through its PayAI facilitator server-side. Neither package contains or
transmits any private key: keys stay in the operator's environment /
wallet provider, and every test payment is mocked — the test fixtures
are the **real 402 challenge captured from production** (2026-10-23)
and the service engine's own published example verdict.

Service source: [QuincyGB/token-verdict](https://github.com/QuincyGB/token-verdict)
(discovery manifest at `/.well-known/x402`, agent docs at `/skill.md`).

MIT licensed.
