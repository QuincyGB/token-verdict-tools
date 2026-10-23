import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, type ClientEvmSigner } from "@x402/evm";
import type { TokenVerdictArgs } from "./schemas";

/** Production Token Verdict service. */
export const TOKEN_VERDICT_BASE_URL =
  "https://token-verdict-production.up.railway.app";

/** The paid route, and its price: $0.02 USDC per call on Base. */
export const TOKEN_VERDICT_PATH = "/v1/verdict";
export const TOKEN_VERDICT_PRICE = "$0.02";
export const BASE_NETWORK = "eip155:8453" as const;

export interface TokenVerdictOptions {
  /** Service base URL override (default: production). */
  baseUrl?: string;
  /**
   * Spend guard passed to the x402 client: the maximum amount authorized
   * for a single call. Defaults to the known price ($0.02) so a hostile
   * or repriced endpoint can never silently charge more.
   */
  maxAmountPerPayment?: string;
  /** fetch implementation override (used by tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Build a fetch that pays Token Verdict's x402 challenges automatically.
 *
 * This is the exact client stack used for Token Verdict's live cataloging
 * payment: @x402/fetch's wrapFetchWithPaymentFromConfig + @x402/evm's
 * ExactEvmScheme (x402 v2, `exact` scheme, EIP-3009 USDC authorization
 * on Base). The only difference is the signer: there it was a local key;
 * here it is whatever signer the caller supplies — in the AgentKit
 * provider, the wallet provider's own account (EvmWalletProvider
 * .toSigner()). Settlement is verified by the service through its
 * facilitator (PayAI) server-side, exactly as with any x402 client.
 */
export function createPayingFetch(
  signer: ClientEvmSigner,
  options: TokenVerdictOptions = {},
): typeof fetch {
  return wrapFetchWithPaymentFromConfig(options.fetchImpl ?? fetch, {
    schemes: [{ network: BASE_NETWORK, client: new ExactEvmScheme(signer) }],
    spendControls: {
      maxAmountPerPayment: options.maxAmountPerPayment ?? TOKEN_VERDICT_PRICE,
    },
  });
}

/**
 * Call POST /v1/verdict with automatic x402 payment and return the
 * verdict JSON:
 * { token, verdict: SOLID|CAUTION|DANGER, score, signals[6], take, market }.
 *
 * Throws on a non-200 response (including a 402 the signer could not or
 * would not settle, e.g. price above the spend guard).
 */
export async function fetchTokenVerdict(
  signer: ClientEvmSigner,
  args: TokenVerdictArgs,
  options: TokenVerdictOptions = {},
): Promise<Record<string, unknown>> {
  const baseUrl = (options.baseUrl ?? TOKEN_VERDICT_BASE_URL).replace(/\/$/, "");
  const payingFetch = createPayingFetch(signer, options);
  const response = await payingFetch(`${baseUrl}${TOKEN_VERDICT_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: args.address, chain: args.chain ?? "base" }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Token Verdict request failed: HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}
