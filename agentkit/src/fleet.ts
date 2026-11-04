import type { ClientEvmSigner } from "@x402/evm";
import { createPayingFetch } from "./tokenVerdict";
import {
  FLEET_PAY_TO,
  getFleetRoute,
  type FleetRoute,
} from "./fleetPack";
import { FLEET_ACTION_SCHEMAS, type FleetToolName } from "./fleetSchemas";

export interface FleetOptions {
  /**
   * Per-stall origin override (key = the pack's stall id, e.g.
   * "stall-row"), replacing the origin of the pack's resource URL.
   * Default: the production resource URLs from the pack.
   */
  baseUrls?: Partial<Record<string, string>>;
  /**
   * Spend-guard override. By default each call is capped at its own
   * route's pack price, so a repriced or hostile endpoint can never
   * silently charge more than the registry truth for that route.
   */
  maxAmountPerPayment?: string;
  /** fetch implementation override (used by tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Call one fleet route with automatic x402 payment and return the
 * stall's JSON delivery verbatim — including any `verdict_row_loop`
 * block the stall attaches for repeat monitoring.
 *
 * The arguments are validated against the pack-derived zod schema for
 * the route first (defaults applied, unknown keys stripped). Payment
 * runs through the exact client stack this package already uses for
 * Token Verdict (@x402/fetch's wrapFetchWithPaymentFromConfig +
 * @x402/evm's ExactEvmScheme), with the spend guard capped at the
 * route's own pack price.
 *
 * Throws on any non-200 response. A 402 the signer could not or would
 * not settle (for example a challenge amount above the route's price
 * cap) is NEVER swallowed: the error names the route, its pack price
 * and the fleet payTo so the caller can see exactly what was asked.
 */
export async function fetchFleetRoute(
  signer: ClientEvmSigner,
  routeName: FleetToolName,
  args: Record<string, unknown>,
  options: FleetOptions = {},
): Promise<Record<string, unknown>> {
  const route: FleetRoute | undefined = getFleetRoute(routeName);
  if (!route) {
    throw new Error(`Unknown fleet route "${routeName}" (not in the embedded pack)`);
  }
  const parsed = FLEET_ACTION_SCHEMAS[routeName].parse(args ?? {});
  const origin = options.baseUrls?.[route.stall]?.replace(/\/$/, "");
  const url = origin ? `${origin}${route.path}` : route.resource;
  const payingFetch = createPayingFetch(signer, {
    fetchImpl: options.fetchImpl,
    maxAmountPerPayment: options.maxAmountPerPayment ?? route.price_display,
  });
  const response = await payingFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Fleet route ${route.name} request failed: HTTP ${response.status}. ` +
        `This route costs ${route.price_display} (${route.amount_units_base} USDC atomic units) ` +
        `payable to ${FLEET_PAY_TO} on Base via x402. Response: ${text.slice(0, 500)}`,
    );
  }
  return JSON.parse(text) as Record<string, unknown>;
}
