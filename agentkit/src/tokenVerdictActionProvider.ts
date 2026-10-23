import { z } from "zod";
import {
  ActionProvider,
  CreateAction,
  EvmWalletProvider,
  type Network,
} from "@coinbase/agentkit";
import { TokenVerdictSchema } from "./schemas";
import { fetchTokenVerdict, type TokenVerdictOptions } from "./tokenVerdict";

/**
 * TokenVerdictActionProvider — gives any AgentKit agent a native
 * `token_verdict` action: a pay-per-call token risk screen.
 *
 * The action calls Token Verdict (POST /v1/verdict, $0.02 USDC on Base
 * via x402 v2) and pays the 402 challenge from the agent's own wallet
 * provider — EvmWalletProvider.toSigner() supplies the EIP-712 signer
 * for the @x402/evm exact scheme, the same client stack used for the
 * service's live cataloging payment. The service settles through its
 * PayAI facilitator server-side.
 *
 * Usage:
 *   const agentKit = await AgentKit.configureWithWallet({
 *     walletProvider,
 *     actionProviders: [tokenVerdictActionProvider()],
 *   });
 */
export class TokenVerdictActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly options: TokenVerdictOptions;

  constructor(options: TokenVerdictOptions = {}) {
    super("token-verdict", []);
    this.options = options;
  }

  /**
   * Get a risk verdict for a token before buying, swapping, or routing
   * funds into it.
   *
   * @param walletProvider - The agent's EVM wallet provider (pays $0.02).
   * @param args - The token address and chain label.
   * @returns A JSON string with the verdict (SOLID / CAUTION / DANGER),
   * 0-100 score, six weighted market-structure signals, a written analyst
   * take, and the raw market data — or an error message string.
   */
  @CreateAction({
    name: "token_verdict",
    description:
      "Get a risk verdict for a token before buying, swapping, or routing funds into it. " +
      "Costs $0.02 USDC on Base (paid automatically from the agent wallet via x402). " +
      "Returns SOLID / CAUTION / DANGER with a 0-100 score, six weighted market-structure " +
      "signals (liquidity depth, volume churn, sell pressure, price action, trader " +
      "breadth, pair age) and a written analyst take. Use this when about to interact " +
      "with a token whose market quality is unknown.",
    schema: TokenVerdictSchema,
  })
  async tokenVerdict(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenVerdictSchema>,
  ): Promise<string> {
    try {
      const signer = walletProvider.toSigner();
      const verdict = await fetchTokenVerdict(signer, args, this.options);
      return JSON.stringify(verdict, null, 2);
    } catch (error) {
      return `Error getting token verdict: ${error}`;
    }
  }

  /**
   * Payment settles in USDC on Base, so the wallet must be an EVM
   * wallet on Base mainnet.
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      (network.chainId === "8453" || network.networkId === "base-mainnet")
    );
  }
}

/**
 * Factory for the Token Verdict action provider (AgentKit idiom).
 *
 * @param options - Optional base URL / spend-guard overrides.
 */
export const tokenVerdictActionProvider = (
  options: TokenVerdictOptions = {},
): TokenVerdictActionProvider => new TokenVerdictActionProvider(options);
