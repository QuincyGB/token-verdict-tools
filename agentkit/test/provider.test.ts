/**
 * Provider tests. ALL payments are mocked: fetch is stubbed (first call
 * replays the REAL 402 challenge captured from production on 2026-10-23,
 * second returns the service engine's published example verdict), and
 * the wallet is a throwaway account generated at test time. No key
 * material lives in this repo and no test touches the network.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";
import type { EvmWalletProvider } from "@coinbase/agentkit";
// Import the BUILT package: AgentKit's CreateAction decorator reads
// TypeScript design:paramtypes metadata, which only the real tsc build
// emits (vitest's esbuild transform does not). Testing dist also tests
// exactly what consumers install. `npm test` builds first.
import { tokenVerdictActionProvider } from "../dist/index.js";

const CHALLENGE = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/payment_required.json", import.meta.url)), "utf8"),
);
const VERDICT = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/verdict_example.json", import.meta.url)), "utf8"),
);

const TOKEN = "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b";
const PAY_TO = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");

interface RecordedCall {
  url: string;
  headers: Headers;
}

function mockFetch(account: { address: string }) {
  const calls: RecordedCall[] = [];
  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    calls.push({ url: request.url, headers: request.headers });
    if (calls.length === 1) {
      return new Response("{}", {
        status: 402,
        headers: {
          "content-type": "application/json",
          "payment-required": b64(CHALLENGE),
        },
      });
    }
    return new Response(JSON.stringify(VERDICT), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "payment-response": b64({
          success: true,
          transaction: `0x${"ab".repeat(32)}`,
          network: "eip155:8453",
          payer: account.address,
        }),
      },
    });
  };
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function fakeWalletProvider(account: ReturnType<typeof privateKeyToAccount>) {
  return {
    getName: () => "token-verdict-test-wallet",
    getAddress: async () => account.address,
    toSigner: () => account,
    getNetwork: () => ({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
  } as unknown as EvmWalletProvider;
}

describe("TokenVerdictActionProvider", () => {
  it("exposes exactly one action (AgentKit prefixes it with the class name)", () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const provider = tokenVerdictActionProvider();
    const actions = provider.getActions(fakeWalletProvider(account));
    expect(actions.map((a) => a.name)).toEqual([
      "TokenVerdictActionProvider_token_verdict",
    ]);
  });

  it("supports Base EVM only", () => {
    const provider = tokenVerdictActionProvider();
    expect(
      provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" }),
    ).toBe(true);
    expect(
      provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
    ).toBe(true);
    expect(
      provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" }),
    ).toBe(false);
    expect(
      provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" }),
    ).toBe(false);
  });

  it("pays the real 402 challenge (EIP-3009) and returns the verdict", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockFetch(account);
    const provider = tokenVerdictActionProvider({ fetchImpl });
    const [action] = provider.getActions(fakeWalletProvider(account));

    const output = await action.invoke({ address: TOKEN, chain: "base" });
    const verdict = JSON.parse(output);
    expect(verdict.verdict).toBe("CAUTION");
    expect(verdict.score).toBe(35.0);
    expect(verdict.signals).toHaveLength(6);

    // Exactly two HTTP calls: unpaid probe, then the paid retry.
    expect(calls).toHaveLength(2);
    expect(calls[0].headers.get("payment-signature")).toBeNull();
    const header = calls[1].headers.get("payment-signature");
    expect(header).toBeTruthy();

    const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
    expect(payload.x402Version).toBe(2);
    expect(payload.accepted.amount).toBe("20000"); // $0.02 in micro-USDC
    expect(payload.accepted.asset).toBe(USDC);
    expect(payload.accepted.network).toBe("eip155:8453");

    const auth = payload.payload.authorization;
    expect(auth.from).toBe(account.address);
    expect(auth.to).toBe(PAY_TO);
    expect(auth.value).toBe("20000");
    expect(auth.validAfter).toBe("0");

    // The signature must verify as the wallet's EIP-712 signature over
    // the TransferWithAuthorization — not just exist.
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        verifyingContract: USDC,
      },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: auth.from,
        to: auth.to,
        value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore),
        nonce: auth.nonce,
      },
      signature: payload.payload.signature,
    });
    expect(recovered).toBe(account.address);
  });

  it("surfaces upstream errors as an error string, not a throw", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const failingFetch = (async () =>
      new Response(JSON.stringify({ error: "token not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const provider = tokenVerdictActionProvider({ fetchImpl: failingFetch });
    const [action] = provider.getActions(fakeWalletProvider(account));
    const output = await action.invoke({ address: TOKEN, chain: "base" });
    expect(output).toContain("Error getting token verdict");
    expect(output).toContain("404");
  });
});
