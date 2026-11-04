/**
 * Fleet provider tests. ALL payments are mocked: fetch is stubbed
 * (first call returns a 402 challenge built from the embedded pack's
 * own terms for the route under test, second returns a fixture
 * delivery), and the wallet is a throwaway account generated at test
 * time. No key material lives in this repo and no test touches the
 * network or spends anything.
 *
 * Like provider.test.ts, these import the BUILT package (dist/):
 * AgentKit's CreateAction decorator reads TypeScript
 * design:paramtypes metadata, which only the real tsc build emits.
 * `npm test` builds first.
 */
import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { EvmWalletProvider } from "@coinbase/agentkit";
import {
  fleetActionProvider,
  FLEET_PACK,
  FLEET_ROUTES,
  getFleetRoute,
  type FleetRoute,
} from "../dist/index.js";

const PAY_TO = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PREFIX = "FleetActionProvider_";

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");

function challengeFor(route: FleetRoute, amountOverride?: string) {
  return {
    x402Version: 2,
    error: "Payment required",
    resource: { url: route.resource, mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        asset: USDC,
        amount: amountOverride ?? route.amount_units_base,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
  };
}

interface RecordedCall {
  url: string;
  headers: Headers;
  body: string;
}

function mockFetch(
  route: FleetRoute,
  delivery: Record<string, unknown>,
  amountOverride?: string,
) {
  const calls: RecordedCall[] = [];
  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    calls.push({
      url: request.url,
      headers: request.headers,
      body: await request.clone().text(),
    });
    if (calls.length === 1) {
      return new Response("{}", {
        status: 402,
        headers: {
          "content-type": "application/json",
          "payment-required": b64(challengeFor(route, amountOverride)),
        },
      });
    }
    return new Response(JSON.stringify(delivery), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function fakeWalletProvider(account: ReturnType<typeof privateKeyToAccount>) {
  return {
    getName: () => "fleet-test-wallet",
    getAddress: async () => account.address,
    toSigner: () => account,
    getNetwork: () => ({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
  } as unknown as EvmWalletProvider;
}

function actionByName(
  provider: ReturnType<typeof fleetActionProvider>,
  account: ReturnType<typeof privateKeyToAccount>,
  name: string,
) {
  const action = provider
    .getActions(fakeWalletProvider(account))
    .find((a) => a.name === `${PREFIX}${name}`);
  if (!action) throw new Error(`action ${name} not found`);
  return action;
}

describe("FleetActionProvider — inventory pinned to the embedded pack", () => {
  it("exposes exactly the pack's 24 tools as actions (names + prices)", () => {
    expect(FLEET_PACK.kind).toBe("verdict-row-function-tools/v1");
    expect(FLEET_PACK.payment.pay_to).toBe(PAY_TO);
    expect(FLEET_ROUTES).toHaveLength(24);
    expect(FLEET_PACK.tool_count).toBe(24);

    const account = privateKeyToAccount(generatePrivateKey());
    const provider = fleetActionProvider();
    const actions = provider.getActions(fakeWalletProvider(account));

    expect(actions).toHaveLength(24);
    expect(actions.map((a) => a.name).sort()).toEqual(
      FLEET_ROUTES.map((r) => `${PREFIX}${r.name}`).sort(),
    );
    // Prices pinned to the pack: every action's description carries its
    // route's exact pack price (display + atomic units), and no route
    // in the pack exceeds the $0.05 cap.
    for (const route of FLEET_ROUTES) {
      expect(Number(route.amount_units_base)).toBeLessThanOrEqual(50000);
      const action = actions.find((a) => a.name === `${PREFIX}${route.name}`);
      expect(action, route.name).toBeDefined();
      expect(action!.description).toContain(route.price_display);
      expect(action!.description).toContain(route.amount_units_base);
    }
  });

  it("supports Base EVM only", () => {
    const provider = fleetActionProvider();
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
});

describe("FleetActionProvider — mocked paid invokes, one per stall family", () => {
  it("stall-row: gas_oracle pays 1000 units to the pack resource and returns the delivery", async () => {
    const route = getFleetRoute("stall_row_gas_oracle")!;
    const delivery = { chain: "base", gas_price_gwei: "0.005", trend: "flat" };
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockFetch(route, delivery);
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, route.name);

    const output = await action.invoke({});
    expect(JSON.parse(output)).toEqual(delivery);

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(route.resource);
    expect(calls[0].headers.get("payment-signature")).toBeNull();
    const header = calls[1].headers.get("payment-signature");
    expect(header).toBeTruthy();
    const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
    expect(payload.accepted.amount).toBe("1000");
    expect(payload.accepted.asset).toBe(USDC);
    expect(payload.accepted.network).toBe("eip155:8453");
    expect(payload.payload.authorization.from).toBe(account.address);
    expect(payload.payload.authorization.to).toBe(PAY_TO);
    expect(payload.payload.authorization.value).toBe("1000");
  });

  it("route-verdict: check pays 50000 units and returns the delivery incl. verdict_row_loop", async () => {
    const route = getFleetRoute("route_verdict_check")!;
    const delivery = {
      resource_url: "https://service.example.com/v1/endpoint",
      verdict: "TRUSTED",
      score: 92,
      verdict_row_loop: { pack: { price: "$1" }, note: "fixture loop block" },
    };
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockFetch(route, delivery);
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, route.name);

    const output = await action.invoke({
      resource_url: "https://service.example.com/v1/endpoint",
    });
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(delivery);
    expect(parsed.verdict_row_loop).toBeDefined();

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(route.resource);
    expect(JSON.parse(calls[0].body)).toEqual({
      resource_url: "https://service.example.com/v1/endpoint",
    });
    const header = calls[1].headers.get("payment-signature");
    const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
    expect(payload.accepted.amount).toBe("50000");
    expect(payload.payload.authorization.to).toBe(PAY_TO);
    expect(payload.payload.authorization.value).toBe("50000");
  });

  it("token-verdict: pre_trade pays 50000 units and returns the delivery", async () => {
    const route = getFleetRoute("token_verdict_pre_trade")!;
    const token = "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b";
    const delivery = { verdict: "PROCEED", score: 12, mode: "full", legs: {} };
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockFetch(route, delivery);
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, route.name);

    const output = await action.invoke({ token_address: token });
    expect(JSON.parse(output)).toEqual(delivery);

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(route.resource);
    // The pack schema's chain default is applied before the call.
    expect(JSON.parse(calls[0].body)).toEqual({
      token_address: token,
      chain: "base",
    });
    const header = calls[1].headers.get("payment-signature");
    const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
    expect(payload.accepted.amount).toBe("50000");
    expect(payload.payload.authorization.to).toBe(PAY_TO);
    expect(payload.payload.authorization.value).toBe("50000");
  });
});

describe("FleetActionProvider — honest payment failure", () => {
  it("surfaces an over-cap 402 with the route price and payTo, and never pays it", async () => {
    const route = getFleetRoute("stall_row_gas_oracle")!;
    const account = privateKeyToAccount(generatePrivateKey());
    // Challenge demands 999999 units; the route's pack price is 1000.
    const { calls, fetchImpl } = mockFetch(route, { should: "never arrive" }, "999999");
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, route.name);

    const output = await action.invoke({});
    expect(output).toContain("Error calling stall_row_gas_oracle");
    expect(output).toContain("$0.001");
    expect(output).toContain(PAY_TO);
    expect(output).not.toContain("never arrive");
    // No call ever carried a payment signature for the inflated amount.
    for (const call of calls) {
      const sig = call.headers.get("payment-signature");
      if (sig) {
        const payload = JSON.parse(Buffer.from(sig, "base64").toString("utf8"));
        expect(payload.payload.authorization.value).not.toBe("999999");
      }
    }
  });

  it("surfaces upstream errors with the route price and payTo, not a bare throw", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const failingFetch = (async () =>
      new Response(JSON.stringify({ error: "bad target" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const provider = fleetActionProvider({ fetchImpl: failingFetch });
    const action = actionByName(provider, account, "stall_row_guard");
    const output = await action.invoke({ url: "https://service.example.com/x" });
    expect(output).toContain("Error calling stall_row_guard");
    expect(output).toContain("$0.01");
    expect(output).toContain(PAY_TO);
    expect(output).toContain("422");
  });
});
