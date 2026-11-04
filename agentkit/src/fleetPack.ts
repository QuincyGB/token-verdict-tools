/**
 * The fleet function-calling pack, embedded verbatim.
 *
 * `function-tools.json` beside this file is a byte-for-byte copy of the
 * Item 4 schema pack (verdict-row-function-tools/v1), GENERATED from the
 * fleet's canonical route registry by the fleet-checker's
 * function_tools.py: every route priced <= $0.05 (50000 Base USDC atomic
 * units), with its stable snake_case name, exact price, resource URL and
 * verbatim request schema. The same pack is served at
 * https://verdictrow.com/function-tools.json.
 *
 * The fleet AgentKit provider builds its entire action set FROM this
 * pack — names, descriptions, prices and schemas are read out of it,
 * never hand-typed — and the test suite pins the provider's action
 * inventory to it, so the AgentKit surface cannot drift from the
 * registry truth. To refresh: regenerate the pack from the registry and
 * replace the JSON copy; the pin tests fail until the provider matches.
 */

import packJson from "./function-tools.json";

export interface FleetRoute {
  name: string;
  stall: string;
  path: string;
  method: string;
  resource: string;
  price_display: string;
  price_usd: string;
  amount_units_base: string;
}

export interface FleetToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface FleetPack {
  kind: string;
  version: number;
  generated_by: string;
  generator: string;
  registry_generated_at: string;
  price_cap: { usd: string; amount_units_base: string; note: string };
  payment: {
    protocol: string;
    scheme: string;
    network: string;
    asset: string;
    pay_to: string;
    note: string;
  };
  tool_count: number;
  routes: FleetRoute[];
  anthropic: FleetToolDef[];
  openai: unknown[];
  [key: string]: unknown;
}

/** The full embedded pack: route index, payment terms, both formats. */
export const FLEET_PACK = packJson as unknown as FleetPack;

/** One entry per tool: stall, path, resource URL and exact price. */
export const FLEET_ROUTES: FleetRoute[] = FLEET_PACK.routes;

/** Anthropic-format tool definitions (name / description / input_schema). */
export const FLEET_TOOLS: FleetToolDef[] = FLEET_PACK.anthropic;

/** The fleet payTo every route in the pack settles to (Base USDC). */
export const FLEET_PAY_TO: string = FLEET_PACK.payment.pay_to;

/** USDC asset contract on Base, per the pack's payment terms. */
export const FLEET_ASSET: string = FLEET_PACK.payment.asset;

/** Look up one route by its stable snake_case tool name. */
export function getFleetRoute(name: string): FleetRoute | undefined {
  return FLEET_ROUTES.find((r) => r.name === name);
}

/** Look up one tool definition by its stable snake_case name. */
export function getFleetTool(name: string): FleetToolDef | undefined {
  return FLEET_TOOLS.find((t) => t.name === name);
}
