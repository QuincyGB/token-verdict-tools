# token-verdict-agentkit

A [Coinbase AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
action provider that gives any AgentKit agent a native **`token_verdict`**
action: a pay-per-call token risk screen.

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
is the complementary piece: a dedicated, typed action for one specific
service, with its real request/response contract and a price guard.

## Tests

```bash
npm test   # builds with tsc, then runs vitest
```

8 tests, all payments mocked: fetch is stubbed (first call replays the
real 402 challenge captured from production; second returns the service
engine's published example verdict) and the wallet is a throwaway
account generated at test time. The paid-flow test verifies the EIP-712
signature recovers to the wallet address. No key material lives in this
repo and no test touches the network.

> Why do the provider tests import from `dist/`? AgentKit's
> `CreateAction` decorator reads TypeScript `design:paramtypes`
> metadata, which only the real `tsc` build emits (vitest's esbuild
> transform does not). Testing the built output also tests exactly
> what consumers install.
