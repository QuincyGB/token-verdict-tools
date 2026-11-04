/**
 * Zod schemas for every fleet action, GENERATED from the embedded pack.
 *
 * Each tool's JSON Schema (the pack's `input_schema`, copied verbatim
 * from the route registry) is converted to a zod object at module load
 * by the small converter below — the pack shapes are simple (strings,
 * integers, nullable unions, one string array, string enums, defaults,
 * one min/max pair), and the converter covers exactly those, failing
 * loudly on anything else rather than silently loosening a contract.
 * The per-tool consts are emitted mechanically from the pack's tool
 * list; regenerating the pack and rebuilding refreshes them.
 */

import { z } from "zod";
import { getFleetTool } from "./fleetPack";

interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

function scalarToZod(type: string, schema: JsonSchema): z.ZodTypeAny {
  switch (type) {
    case "string":
      return z.string();
    case "integer": {
      let n = z.number().int();
      if (schema.minimum !== undefined) n = n.min(schema.minimum);
      if (schema.maximum !== undefined) n = n.max(schema.maximum);
      return n;
    }
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(jsonSchemaToZod(schema.items ?? {}));
    case "object":
      return z.record(z.string(), z.unknown());
    default:
      throw new Error(`fleet schema converter: unsupported type "${type}"`);
  }
}

/** Convert one pack property schema to zod. */
export function jsonSchemaToZod(schema: JsonSchema): z.ZodTypeAny {
  if (schema.enum) {
    return z.enum(schema.enum as [string, ...string[]]);
  }
  const rawType = schema.type ?? "string";
  const types = Array.isArray(rawType) ? rawType : [rawType];
  const nonNull = types.filter((t) => t !== "null");
  let inner: z.ZodTypeAny;
  if (nonNull.length === 1) {
    inner = scalarToZod(nonNull[0], schema);
  } else if (nonNull.length > 1) {
    inner = z.union(
      nonNull.map((t) => scalarToZod(t, schema)) as [
        z.ZodTypeAny,
        z.ZodTypeAny,
        ...z.ZodTypeAny[],
      ],
    );
  } else {
    inner = z.null();
  }
  let out: z.ZodTypeAny = types.includes("null") ? inner.nullable() : inner;
  if (schema.description) out = out.describe(schema.description);
  return out;
}

/** Convert a pack tool input_schema (a JSON object schema) to zod. */
export function jsonSchemaObjectToZod(
  schema: JsonSchema,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    let field = jsonSchemaToZod(prop);
    if (prop.default !== undefined) {
      field = field.default(prop.default as never);
    } else if (!required.has(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }
  return z.object(shape);
}

function toolSchema(name: string) {
  const tool = getFleetTool(name);
  if (!tool) throw new Error(`fleet pack is missing tool "${name}"`);
  return jsonSchemaObjectToZod(tool.input_schema as JsonSchema);
}

export const stallRowWalletSnapshotSchema = toolSchema("stall_row_wallet_snapshot");
export const stallRowAllowanceAuditSchema = toolSchema("stall_row_allowance_audit");
export const stallRowTxDecoderSchema = toolSchema("stall_row_tx_decoder");
export const stallRowGasOracleSchema = toolSchema("stall_row_gas_oracle");
export const stallRowWalletVerdictSchema = toolSchema("stall_row_wallet_verdict");
export const stallRowPreTradeGuardSchema = toolSchema("stall_row_pre_trade_guard");
export const stallRowGradeMyStallSchema = toolSchema("stall_row_grade_my_stall");
export const stallRowReceiptVerifySchema = toolSchema("stall_row_receipt_verify");
export const stallRowFlaggedPaytosSchema = toolSchema("stall_row_flagged_paytos");
export const stallRowAgentCardVerifySchema = toolSchema("stall_row_agent_card_verify");
export const stallRowTubeSearchSchema = toolSchema("stall_row_tube_search");
export const stallRowPageToMarkdownSchema = toolSchema("stall_row_page_to_markdown");
export const stallRowRepoVitalsSchema = toolSchema("stall_row_repo_vitals");
export const stallRowPriceCheckSchema = toolSchema("stall_row_price_check");
export const stallRowJobScoutSchema = toolSchema("stall_row_job_scout");
export const stallRowRecheckSchema = toolSchema("stall_row_recheck");
export const stallRowSignReadSchema = toolSchema("stall_row_sign_read");
export const stallRowScoreBookSchema = toolSchema("stall_row_score_book");
export const stallRowGuardSchema = toolSchema("stall_row_guard");
export const stallRowPhysicalSchema = toolSchema("stall_row_physical");
export const stallRowPaytoPinVerifySchema = toolSchema("stall_row_payto_pin_verify");
export const routeVerdictCheckSchema = toolSchema("route_verdict_check");
export const tokenVerdictVerdictSchema = toolSchema("token_verdict_verdict");
export const tokenVerdictPreTradeSchema = toolSchema("token_verdict_pre_trade");

/** Every fleet action schema, keyed by the pack's stable tool name. */
export const FLEET_ACTION_SCHEMAS = {
  stall_row_wallet_snapshot: stallRowWalletSnapshotSchema,
  stall_row_allowance_audit: stallRowAllowanceAuditSchema,
  stall_row_tx_decoder: stallRowTxDecoderSchema,
  stall_row_gas_oracle: stallRowGasOracleSchema,
  stall_row_wallet_verdict: stallRowWalletVerdictSchema,
  stall_row_pre_trade_guard: stallRowPreTradeGuardSchema,
  stall_row_grade_my_stall: stallRowGradeMyStallSchema,
  stall_row_receipt_verify: stallRowReceiptVerifySchema,
  stall_row_flagged_paytos: stallRowFlaggedPaytosSchema,
  stall_row_agent_card_verify: stallRowAgentCardVerifySchema,
  stall_row_tube_search: stallRowTubeSearchSchema,
  stall_row_page_to_markdown: stallRowPageToMarkdownSchema,
  stall_row_repo_vitals: stallRowRepoVitalsSchema,
  stall_row_price_check: stallRowPriceCheckSchema,
  stall_row_job_scout: stallRowJobScoutSchema,
  stall_row_recheck: stallRowRecheckSchema,
  stall_row_sign_read: stallRowSignReadSchema,
  stall_row_score_book: stallRowScoreBookSchema,
  stall_row_guard: stallRowGuardSchema,
  stall_row_physical: stallRowPhysicalSchema,
  stall_row_payto_pin_verify: stallRowPaytoPinVerifySchema,
  route_verdict_check: routeVerdictCheckSchema,
  token_verdict_verdict: tokenVerdictVerdictSchema,
  token_verdict_pre_trade: tokenVerdictPreTradeSchema,
} as const;

/** The pack's stable tool names — the fleet provider's action names. */
export type FleetToolName = keyof typeof FLEET_ACTION_SCHEMAS;
