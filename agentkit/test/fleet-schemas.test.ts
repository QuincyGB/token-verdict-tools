/**
 * Fleet schema tests: every zod schema in FLEET_ACTION_SCHEMAS is
 * generated from the embedded pack's input_schema for that tool, so
 * these tests validate the generated schemas against the pack itself —
 * required fields, defaults, enums, nullable unions and bounds all come
 * from the pack, and a pack/schema drift fails here.
 */
import { describe, expect, it } from "vitest";
import { FLEET_ACTION_SCHEMAS } from "../src/fleetSchemas";
import { FLEET_PACK, FLEET_ROUTES, FLEET_TOOLS } from "../src/fleetPack";

interface PropSchema {
  type?: string | string[];
  enum?: string[];
  items?: PropSchema;
  [key: string]: unknown;
}

/** A minimal valid value for one pack property schema. */
function dummyFor(prop: PropSchema): unknown {
  if (prop.enum) return prop.enum[0];
  const raw = prop.type ?? "string";
  const types = Array.isArray(raw) ? raw : [raw];
  const t = types.find((x) => x !== "null") ?? "string";
  switch (t) {
    case "integer":
      return 1;
    case "number":
      return 1;
    case "boolean":
      return true;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "test-value";
  }
}

/** Minimal valid args for a tool: exactly its pack-required fields. */
function minimalArgs(name: string): Record<string, unknown> {
  const tool = FLEET_TOOLS.find((t) => t.name === name)!;
  const schema = tool.input_schema as {
    properties?: Record<string, PropSchema>;
    required?: string[];
  };
  const args: Record<string, unknown> = {};
  for (const key of schema.required ?? []) {
    args[key] = dummyFor(schema.properties![key]);
  }
  return args;
}

describe("FLEET_ACTION_SCHEMAS (generated from the embedded pack)", () => {
  it("has exactly one schema per pack tool, keyed by the pack names", () => {
    expect(Object.keys(FLEET_ACTION_SCHEMAS).sort()).toEqual(
      FLEET_ROUTES.map((r) => r.name).sort(),
    );
    expect(Object.keys(FLEET_ACTION_SCHEMAS)).toHaveLength(FLEET_PACK.tool_count);
  });

  it("accepts minimal valid args for every tool in the pack", () => {
    for (const route of FLEET_ROUTES) {
      const schema = FLEET_ACTION_SCHEMAS[route.name];
      expect(() => schema.parse(minimalArgs(route.name)), route.name).not.toThrow();
    }
  });

  it("rejects {} for every tool with required fields, accepts it for the rest", () => {
    for (const tool of FLEET_TOOLS) {
      const required =
        (tool.input_schema as { required?: string[] }).required ?? [];
      const schema = FLEET_ACTION_SCHEMAS[tool.name];
      if (required.length > 0) {
        expect(() => schema.parse({}), tool.name).toThrow();
      } else {
        expect(() => schema.parse({}), tool.name).not.toThrow();
      }
    }
  });

  it("applies the pack defaults (token chain defaults to base)", () => {
    const token = "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b";
    const verdict = FLEET_ACTION_SCHEMAS.token_verdict_verdict.parse({
      address: token,
    }) as { chain?: string };
    expect(verdict.chain).toBe("base");
    const preTrade = FLEET_ACTION_SCHEMAS.token_verdict_pre_trade.parse({
      token_address: token,
    }) as { chain?: string };
    expect(preTrade.chain).toBe("base");
  });

  it("enforces the pack enums", () => {
    const token = "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b";
    expect(() =>
      FLEET_ACTION_SCHEMAS.token_verdict_verdict.parse({
        address: token,
        chain: "bitcoin",
      }),
    ).toThrow();
    expect(() =>
      FLEET_ACTION_SCHEMAS.token_verdict_pre_trade.parse({
        token_address: token,
        mode: "verbose",
      }),
    ).toThrow();
    expect(
      FLEET_ACTION_SCHEMAS.token_verdict_pre_trade.parse({
        token_address: token,
        mode: "compact",
      }),
    ).toBeDefined();
  });

  it("honours the pack's nullable unions and bounds", () => {
    // amount: [integer, string, null]; network/resource: [string, null]
    const guard = FLEET_ACTION_SCHEMAS.stall_row_pre_trade_guard;
    const payTo = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F";
    expect(guard.parse({ pay_to: payTo, amount: 5000 }).amount).toBe(5000);
    expect(guard.parse({ pay_to: payTo, amount: "5000" }).amount).toBe("5000");
    expect(guard.parse({ pay_to: payTo, amount: null }).amount).toBeNull();
    expect(() => guard.parse({ pay_to: payTo, amount: 1.5 })).toThrow();
    // max_results: integer 1..20
    const tube = FLEET_ACTION_SCHEMAS.stall_row_tube_search;
    expect(tube.parse({ query: "x", max_results: 20 })).toBeDefined();
    expect(() => tube.parse({ query: "x", max_results: 21 })).toThrow();
    expect(() => tube.parse({ query: "x", max_results: 0 })).toThrow();
    // agent_id: [integer, null], all fields optional
    const card = FLEET_ACTION_SCHEMAS.stall_row_agent_card_verify;
    expect(card.parse({})).toEqual({});
    expect(card.parse({ agent_id: 97809 }).agent_id).toBe(97809);
    expect(card.parse({ agent_id: null }).agent_id).toBeNull();
    expect(() => card.parse({ agent_id: "97809" })).toThrow();
  });
});
