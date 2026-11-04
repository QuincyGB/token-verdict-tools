/**
 * Fleet Check Framework Pack action tests (Next-20 Item 13).
 *
 * These three actions are HAND-WRITTEN, not pack-generated: Fleet
 * Check is priced ABOVE the <= $0.05 cap of the Item 4 pack
 * ($5.00 pack / $0.10 single sweep), so they live outside the
 * pack inventory pinned in fleet-provider.test.ts.
 *
 * ALL payments are mocked: fetch is stubbed (first call returns a
 * 402 challenge at the action's own price, second returns a fixture
 * delivery; the pack-credit run is a single plain call), and the
 * wallet is a throwaway account generated at test time. No test
 * touches the network or spends anything. Imports the BUILT package
 * (dist/), like the other suites — `npm test` builds first.
 */
import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { EvmWalletProvider } from "@coinbase/agentkit";
import { fleetActionProvider } from "../dist/index.js";

const PAY_TO = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE = "https://stall-row-production.up.railway.app";
const PREFIX = "FleetActionProvider_";

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");

function challengeFor(path: string, amount: string) {
  return {
    x402Version: 2,
    error: "Payment required",
    resource: { url: `${BASE}${path}`, mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        asset: USDC,
        amount,
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

function mockPaidFetch(path: string, amount: string, delivery: Record<string, unknown>, amountOverride?: string) {
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
          "payment-required": b64(challengeFor(path, amountOverride ?? amount)),
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

function mockPlainFetch(delivery: Record<string, unknown>) {
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
    return new Response(JSON.stringify(delivery), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function fakeWalletProvider(account: ReturnType<typeof privateKeyToAccount>) {
  return {
    getName: () => "fleet-check-test-wallet",
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

const FRAMEWORK_LOG = [
  {
    tool: "fleet_check_route_probe",
    action: "fleet_check_route_probe",
    resource: "https://service.example.com/v1/endpoint",
    verdict: "OK",
    defect: null,
    defects: [],
    http_status: 402,
    message:
      "fleet_check_route_probe https://service.example.com/v1/endpoint: OK — answers 402 with a parseable challenge, no defect found",
  },
];

describe("Fleet Check actions — inventory + honest pricing", () => {
  it("adds exactly the three hand-written actions, prices stated in full", () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const provider = fleetActionProvider();
    const actions = provider.getActions(fakeWalletProvider(account));
    // 24 pack-generated + 3 hand-written Fleet Check actions.
    expect(actions).toHaveLength(27);

    const buy = actionByName(provider, account, "buy_fleet_check_pack");
    expect(buy.description).toContain("$5.00");
    expect(buy.description).toContain("5000000");
    expect(buy.description).toContain("100 sweep credits");
    expect(buy.description).toContain("90-day");

    const sweep = actionByName(provider, account, "fleet_check_sweep");
    expect(sweep.description).toContain("$0.10");
    expect(sweep.description).toContain("100000");

    const run = actionByName(provider, account, "run_fleet_check_sweep");
    expect(run.description).toContain("ONE sweep credit");
    expect(run.description).toContain("$5.00");
  });
});

describe("Fleet Check actions — mocked invokes", () => {
  it("buy_fleet_check_pack pays exactly $5.00 (5000000 units) to the pack URL", async () => {
    const delivery = {
      pack_id: "fcpack_test",
      credits_total: 100,
      credits_remaining: 100,
      renewal: { renewal_cycle_days: 90, renewal_price_units: 5000000, days_remaining: 90 },
    };
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockPaidFetch("/v1/fleet-check/pack", "5000000", delivery);
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, "buy_fleet_check_pack");

    const output = await action.invoke({ origins: ["https://service.example.com"] });
    expect(JSON.parse(output)).toEqual(delivery);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${BASE}/v1/fleet-check/pack`);
    expect(JSON.parse(calls[0].body)).toEqual({ origins: ["https://service.example.com"] });
    const header = calls[1].headers.get("payment-signature");
    const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
    expect(payload.accepted.amount).toBe("5000000");
    expect(payload.payload.authorization.to).toBe(PAY_TO);
    expect(payload.payload.authorization.value).toBe("5000000");
  });

  it("fleet_check_sweep pays exactly $0.10 (100000 units) and returns framework_log", async () => {
    const delivery = { summary: { resources: 1, ok: 1 }, framework_log: FRAMEWORK_LOG };
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockPaidFetch("/v1/fleet-check", "100000", delivery);
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, "fleet_check_sweep");

    const output = await action.invoke({ resources: ["https://service.example.com/v1/endpoint"] });
    const parsed = JSON.parse(output);
    expect(parsed.framework_log).toEqual(FRAMEWORK_LOG);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${BASE}/v1/fleet-check`);
    const header = calls[1].headers.get("payment-signature");
    const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
    expect(payload.payload.authorization.value).toBe("100000");
  });

  it("run_fleet_check_sweep spends a pack credit — one plain call, no payment", async () => {
    const delivery = {
      pack_id: "fcpack_test",
      status: "swept",
      credits_remaining: 99,
      framework_log: FRAMEWORK_LOG,
    };
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockPlainFetch(delivery);
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, "run_fleet_check_sweep");

    const output = await action.invoke({ pack_id: "fcpack_test" });
    expect(JSON.parse(output)).toEqual(delivery);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE}/v1/fleet-check/run`);
    expect(calls[0].headers.get("payment-signature")).toBeNull();
    expect(JSON.parse(calls[0].body)).toEqual({ pack_id: "fcpack_test" });
  });

  it("refuses an over-price pack challenge ($6.00) under the $5.00 spend guard", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockPaidFetch(
      "/v1/fleet-check/pack",
      "5000000",
      { should: "never arrive" },
      "6000000",
    );
    const provider = fleetActionProvider({ fetchImpl });
    const action = actionByName(provider, account, "buy_fleet_check_pack");

    const output = await action.invoke({ origins: ["https://service.example.com"] });
    expect(output).toContain("Error calling buy_fleet_check_pack");
    expect(output).toContain("$5.00");
    expect(output).toContain(PAY_TO);
    expect(output).not.toContain("never arrive");
    for (const call of calls) {
      const sig = call.headers.get("payment-signature");
      if (sig) {
        const payload = JSON.parse(Buffer.from(sig, "base64").toString("utf8"));
        expect(payload.payload.authorization.value).not.toBe("6000000");
      }
    }
  });
});
