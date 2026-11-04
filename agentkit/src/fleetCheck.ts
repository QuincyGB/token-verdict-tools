import { z } from "zod";
import type { ClientEvmSigner } from "@x402/evm";
import { createPayingFetch } from "./tokenVerdict";
import { FLEET_PAY_TO } from "./fleetPack";

/**
 * Fleet Check Framework Pack actions (Next-20 Item 13).
 *
 * IMPORTANT — these are NOT pack-generated actions. The
 * FleetActionProvider's 24 actions are built mechanically from the
 * Item 4 function-calling pack, which caps at routes priced
 * <= $0.05. Fleet Check sits ABOVE that cap ($5.00 pack, $0.10
 * single sweep), so the three actions here are hand-written,
 * separately from the pack, with their prices stated honestly in
 * every name/description:
 *
 *   buy_fleet_check_pack   POST /v1/fleet-check/pack  $5.00
 *     100 sweep credits bound to ONE fixed fleet definition,
 *     90-day expiry (the pack's renewal cycle).
 *   fleet_check_sweep      POST /v1/fleet-check       $0.10
 *     One sweep of a caller-named fleet, paid per call.
 *   run_fleet_check_sweep  POST /v1/fleet-check/run   pack credit
 *     One sweep of the pack's fixed fleet, spending ONE pack
 *     credit — no x402 payment on this call.
 *   fleet_check_status     POST /v1/fleet-check/status  free
 *
 * Deliveries carry the service's `framework_log` section (Item 13):
 * framework-style run-log entries a runner can drop into its own
 * run log verbatim. Pack purchase/status deliveries also carry
 * `renewal` terms derived server-side from the pack constants.
 *
 * The paid legs run through the package's existing paying-fetch
 * stack with a spend guard capped at exactly the action's own
 * price ($5.00 / $0.10) — an over-price challenge is refused by
 * the x402 client and surfaces as an error, never paid.
 */

/** StallRow production origin (Fleet Check lives on StallRow). */
export const FLEET_CHECK_BASE_URL =
  "https://stall-row-production.up.railway.app";

export const FLEET_CHECK_PACK_PATH = "/v1/fleet-check/pack";
export const FLEET_CHECK_PACK_PRICE = "$5.00";
export const FLEET_CHECK_PACK_PRICE_UNITS = "5000000";
export const FLEET_CHECK_PACK_CREDITS = 100;
export const FLEET_CHECK_PACK_TTL_DAYS = 90;

export const FLEET_CHECK_SWEEP_PATH = "/v1/fleet-check";
export const FLEET_CHECK_SWEEP_PRICE = "$0.10";
export const FLEET_CHECK_SWEEP_PRICE_UNITS = "100000";

export const FLEET_CHECK_RUN_PATH = "/v1/fleet-check/run";
export const FLEET_CHECK_STATUS_PATH = "/v1/fleet-check/status";

export const buyFleetCheckPackSchema = z.object({
  resources: z
    .array(z.string())
    .optional()
    .describe("Resource URLs in this pack's FIXED fleet definition (max 40)"),
  origins: z
    .array(z.string())
    .optional()
    .describe(
      "Origins in this pack's FIXED fleet definition (max 10); each origin's /.well-known/x402 priced resources join every sweep",
    ),
  webhook_url: z
    .string()
    .optional()
    .describe("Public http(s) URL that receives new-failure / recovery pushes"),
  email: z.string().optional().describe("Optional contact email"),
  heartbeat: z
    .boolean()
    .optional()
    .describe("Also POST a heartbeat to the webhook on sweeps with no changes"),
  interval_s: z
    .number()
    .int()
    .min(300)
    .max(86400)
    .optional()
    .describe("Seconds between automatic sweeps (300-86400, default 3600)"),
});

export const fleetCheckSweepSchema = z.object({
  resources: z
    .array(z.string())
    .optional()
    .describe("Resource URLs to probe (max 40 across the whole sweep)"),
  origins: z
    .array(z.string())
    .optional()
    .describe("Origins whose /.well-known/x402 priced resources join the sweep (max 10)"),
});

export const fleetCheckPackIdSchema = z.object({
  pack_id: z.string().describe("Pack id returned by buy_fleet_check_pack"),
});

export interface FleetCheckOptions {
  /** StallRow origin override (default: production). */
  baseUrl?: string;
  /** Spend-guard override for the paid legs; defaults to each action's own exact price. */
  maxAmountPerPayment?: string;
  /** fetch implementation override (used by tests). */
  fetchImpl?: typeof fetch;
}

function base(options: FleetCheckOptions): string {
  return (options.baseUrl ?? FLEET_CHECK_BASE_URL).replace(/\/$/, "");
}

async function paidPost(
  signer: ClientEvmSigner,
  path: string,
  price: string,
  priceUnits: string,
  body: Record<string, unknown>,
  options: FleetCheckOptions,
): Promise<Record<string, unknown>> {
  const payingFetch = createPayingFetch(signer, {
    fetchImpl: options.fetchImpl,
    maxAmountPerPayment: options.maxAmountPerPayment ?? price,
  });
  const response = await payingFetch(`${base(options)}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Fleet Check ${path} request failed: HTTP ${response.status}. ` +
        `This call costs ${price} (${priceUnits} USDC atomic units) payable to ` +
        `${FLEET_PAY_TO} on Base via x402. Response: ${text.slice(0, 500)}`,
    );
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function plainPost(
  path: string,
  body: Record<string, unknown>,
  options: FleetCheckOptions,
): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${base(options)}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Fleet Check ${path} request failed: HTTP ${response.status}. Response: ${text.slice(0, 500)}`,
    );
  }
  return JSON.parse(text) as Record<string, unknown>;
}

/** Buy the $5.00 Fleet Check pack (100 sweeps, one fixed fleet, 90 days). */
export async function buyFleetCheckPack(
  signer: ClientEvmSigner,
  args: z.infer<typeof buyFleetCheckPackSchema>,
  options: FleetCheckOptions = {},
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) if (v !== undefined) body[k] = v;
  return paidPost(
    signer,
    FLEET_CHECK_PACK_PATH,
    FLEET_CHECK_PACK_PRICE,
    FLEET_CHECK_PACK_PRICE_UNITS,
    body,
    options,
  );
}

/** One $0.10 Fleet Check sweep of a caller-named fleet. */
export async function fleetCheckSweep(
  signer: ClientEvmSigner,
  args: z.infer<typeof fleetCheckSweepSchema>,
  options: FleetCheckOptions = {},
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) if (v !== undefined) body[k] = v;
  return paidPost(
    signer,
    FLEET_CHECK_SWEEP_PATH,
    FLEET_CHECK_SWEEP_PRICE,
    FLEET_CHECK_SWEEP_PRICE_UNITS,
    body,
    options,
  );
}

/** Run one pack sweep, spending ONE pack credit (no x402 payment). */
export async function runFleetCheckSweep(
  packId: string,
  options: FleetCheckOptions = {},
): Promise<Record<string, unknown>> {
  return plainPost(FLEET_CHECK_RUN_PATH, { pack_id: packId }, options);
}

/** Free pack status: definition, credits, renewal terms, latest sweep + its framework_log. */
export async function fleetCheckStatus(
  packId: string,
  options: FleetCheckOptions = {},
): Promise<Record<string, unknown>> {
  return plainPost(FLEET_CHECK_STATUS_PATH, { pack_id: packId }, options);
}
