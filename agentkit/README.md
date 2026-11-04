# token-verdict-agentkit

[Coinbase AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
action providers for the Verdict Row x402 fleet, in one package:

- **`tokenVerdictActionProvider`** (since 0.1.0) — a native
  **`token_verdict`** action: a pay-per-call token risk screen.
- **`fleetActionProvider`** (since 0.2.0) — **every fleet route priced
  ≤ $0.05 as a native AgentKit action** (24 actions: StallRow wallet /
  guard / recheck / grading checks, the RouteVerdict check, and both
  Token Verdict routes), each with the x402 payment leg handled inside.

The package keeps its original name for backwards compatibility — it is
the published npm identity of the Token Verdict provider, and the
original provider and action are unchanged.

Token Verdict: send a token contract address, get back a verdict
(**SOLID / CAUTION / DANGER**), a 0–100 risk score, six weighted
market-structure signals, and a written analyst take. It costs **$0.02
USDC per call on Base**, paid via the [x402 protocol](https://x402.org)
from the agent's own wallet provider — no accounts, no API keys.

## Install

```bash
npm install token-verdict-agentkit   # once published; or from a checkout:
npm install ./agentkit               # (this directory)
```

`@coinbase/agentkit` is a peer dependency — your AgentKit app provides
it (developed and tested against AgentKit 0.10.x).

## Usage

Register the provider alongside your wallet provider:

```ts
import { AgentKit } from "@coinbase/agentkit";
import { tokenVerdictActionProvider } from "token-verdict-agentkit";

const agentKit = await AgentKit.configureWithWallet({
  walletProvider, // any EvmWalletProvider on Base (CDP, Viem, ...)
  actionProviders: [
    tokenVerdictActionProvider(),
    // ...your other providers
  ],
});

// The agent can now call the action (AgentKit names it
// "TokenVerdictActionProvider_token_verdict" in its action list).
const actions = agentKit.getActions();
```

The action's arguments (zod schema = the service's real request
contract for `POST /v1/verdict`):

| Arg | Type | Notes |
|---|---|---|
| `address` | `0x...` string (required) | Token contract address. |
| `chain` | `"base" \| "ethereum" \| "solana"`, default `"base"` | Which token market to analyze. Payment always settles in USDC on Base. |

Returns the verdict JSON as a string (AgentKit action convention):
`token`, `verdict`, `score`, `signals` (exactly six), `take`, `market`.

## How payment works

The provider adapts the AgentKit wallet provider into an x402 signer
(`EvmWalletProvider.toSigner()` → viem `LocalAccount`) and runs the
standard x402 v2 client flow — `@x402/fetch`'s
`wrapFetchWithPaymentFromConfig` + `@x402/evm`'s `ExactEvmScheme`, the
same stack used for the service's live cataloging payment:

1. Unpaid `POST /v1/verdict` → HTTP 402 challenge.
2. The client signs an EIP-3009 `TransferWithAuthorization` for $0.02
   USDC on Base with the agent wallet and retries with the
   `PAYMENT-SIGNATURE` header.
3. The service verifies and settles through its facilitator (PayAI)
   server-side.

A spend guard caps each call at the known price: the provider passes
`spendControls.maxAmountPerPayment = "$0.02"` by default, so a repriced
or hostile endpoint can never silently charge the agent more. Override
via options if the service price changes.

`supportsNetwork` returns true only for EVM wallets on Base mainnet —
payment settles on Base regardless of which chain's token is analyzed.

## Options

```ts
tokenVerdictActionProvider({
  baseUrl: "https://token-verdict-production.up.railway.app", // default
  maxAmountPerPayment: "$0.02",                               // spend guard
  // fetchImpl: custom fetch (testing)
});
```

AgentKit also ships a generic x402 *discovery* provider
(`x402ActionProvider`, listing services by facilitator). This package
is the complementary piece: dedicated, typed actions for specific
services, with their real request/response contracts and price guards.

## The fleet provider (0.2.0+)

```ts
import { AgentKit } from "@coinbase/agentkit";
import { fleetActionProvider } from "token-verdict-agentkit";

const agentKit = await AgentKit.configureWithWallet({
  walletProvider, // any EvmWalletProvider on Base
  actionProviders: [fleetActionProvider()],
});
```

The fleet provider's action set is built **from the fleet's
function-calling schema pack** (`src/function-tools.json`, generated
from the canonical route registry — the same pack served at
verdictrow.com/function-tools.json): action names, descriptions,
prices and zod schemas are read out of the pack, never hand-typed, and
the test suite pins the provider's inventory to the pack so the
AgentKit surface cannot drift from the registry truth.

All 24 actions (AgentKit prefixes each with `FleetActionProvider_`):

| Stall | Actions |
|---|---|
| stall-row (21) | `stall_row_wallet_snapshot` ($0.005), `stall_row_allowance_audit` ($0.005), `stall_row_tx_decoder` ($0.002), `stall_row_gas_oracle` ($0.001), `stall_row_wallet_verdict` ($0.02), `stall_row_pre_trade_guard` ($0.005), `stall_row_grade_my_stall` ($0.005), `stall_row_receipt_verify` ($0.002), `stall_row_flagged_paytos` ($0.005), `stall_row_agent_card_verify` ($0.005), `stall_row_tube_search` ($0.01), `stall_row_page_to_markdown` ($0.01), `stall_row_repo_vitals` ($0.005), `stall_row_price_check` ($0.05), `stall_row_job_scout` ($0.05), `stall_row_recheck` ($0.005), `stall_row_sign_read` ($0.01), `stall_row_score_book` ($0.01), `stall_row_guard` ($0.01), `stall_row_physical` ($0.05), `stall_row_payto_pin_verify` ($0.01) |
| route-verdict (1) | `route_verdict_check` ($0.05) |
| token-verdict (2) | `token_verdict_verdict` ($0.02), `token_verdict_pre_trade` ($0.05) |

Each action validates its arguments against the pack-derived zod
schema, pays its route's 402 challenge from the agent wallet through
the same `@x402/fetch` + `@x402/evm` stack as the Token Verdict
provider, caps its spend guard at its own route's pack price, and
returns the stall's JSON delivery verbatim (including any
`verdict_row_loop` block). A payment that cannot settle — for example
a challenge amount above the route's price — surfaces as an error
string naming the route's price and the fleet payTo
(`0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F`); it is never silently
swallowed.

Options mirror the Token Verdict provider's shape:

```ts
fleetActionProvider({
  baseUrls: { "stall-row": "https://staging.example.com" }, // per-stall origin override
  maxAmountPerPayment: "$0.05",                             // spend-guard override
  // fetchImpl: custom fetch (testing)
});
```

The pack itself is exported for inspection: `FLEET_PACK`,
`FLEET_ROUTES`, `FLEET_TOOLS`, `FLEET_ACTION_SCHEMAS`,
`getFleetRoute()`, `getFleetTool()`, plus the standalone
`fetchFleetRoute(signer, routeName, args, options)` helper.

## Fleet Check Framework Pack actions (0.3.0+)

Three additional actions on `fleetActionProvider` are **hand-written,
not pack-generated** — Fleet Check is priced *above* the ≤ $0.05 cap
of the pack above, and is kept out of that inventory deliberately:

| Action | Terms |
|---|---|
| `buy_fleet_check_pack` | **$5.00** USDC via x402 — 100 sweep credits bound to ONE fixed fleet definition, 90-day expiry (renewal cycle) |
| `fleet_check_sweep` | **$0.10** USDC via x402 — one sweep of a caller-named fleet |
| `run_fleet_check_sweep` | one pack credit, no x402 payment — sweep the pack's fixed fleet now |

Each paid leg caps its spend guard at exactly its own price. Fleet
Check deliveries carry the service's `framework_log` section —
framework-style run-log entries (tool, resource, verdict, defect,
one-line message) a runner can drop into its own run log — and pack
deliveries carry `renewal` terms derived server-side from the pack
constants. Standalone helpers are also exported: `buyFleetCheckPack`,
`fleetCheckSweep`, `runFleetCheckSweep`, `fleetCheckStatus` (free),
with the `FLEET_CHECK_*` price/path constants. The machine-readable
descriptor lives at
<https://verdictrow.com/fleet-check-framework-pack.json>.

## Tests

```bash
npm test   # builds with tsc, then runs vitest
```

All payments mocked: fetch is stubbed (first call replays a 402
challenge — for Token Verdict, the real one captured from production;
for fleet routes, one built from the pack's own terms for the route
under test; second returns a fixture delivery) and the wallet is a
throwaway account generated at test time. The Token Verdict paid-flow
test verifies the EIP-712 signature recovers to the wallet address;
the fleet tests pin all 24 action names/prices to the embedded pack,
validate every pack-derived zod schema, run mocked paid invokes for
one action per stall family (stall-row, route-verdict, token-verdict),
and prove an over-cap 402 surfaces with the route's price and payTo
instead of being paid. No key material lives in this repo and no test
touches the network.

> Why do the provider tests import from `dist/`? AgentKit's
> `CreateAction` decorator reads TypeScript `design:paramtypes`
> metadata, which only the real `tsc` build emits (vitest's esbuild
> transform does not). Testing the built output also tests exactly
> what consumers install.
