import { z } from "zod";
import {
  ActionProvider,
  CreateAction,
  EvmWalletProvider,
  type Network,
} from "@coinbase/agentkit";
import {
  stallRowWalletSnapshotSchema,
  stallRowAllowanceAuditSchema,
  stallRowTxDecoderSchema,
  stallRowGasOracleSchema,
  stallRowWalletVerdictSchema,
  stallRowPreTradeGuardSchema,
  stallRowGradeMyStallSchema,
  stallRowReceiptVerifySchema,
  stallRowFlaggedPaytosSchema,
  stallRowAgentCardVerifySchema,
  stallRowTubeSearchSchema,
  stallRowPageToMarkdownSchema,
  stallRowRepoVitalsSchema,
  stallRowPriceCheckSchema,
  stallRowJobScoutSchema,
  stallRowRecheckSchema,
  stallRowSignReadSchema,
  stallRowScoreBookSchema,
  stallRowGuardSchema,
  stallRowPhysicalSchema,
  stallRowPaytoPinVerifySchema,
  routeVerdictCheckSchema,
  tokenVerdictVerdictSchema,
  tokenVerdictPreTradeSchema,
  type FleetToolName,
} from "./fleetSchemas";
import { FLEET_PAY_TO, getFleetRoute } from "./fleetPack";
import { fetchFleetRoute, type FleetOptions } from "./fleet";
import {
  buyFleetCheckPack,
  fleetCheckSweep,
  runFleetCheckSweep,
  buyFleetCheckPackSchema,
  fleetCheckSweepSchema,
  fleetCheckPackIdSchema,
  FLEET_CHECK_PACK_PRICE,
  FLEET_CHECK_PACK_PRICE_UNITS,
  FLEET_CHECK_SWEEP_PRICE,
  FLEET_CHECK_SWEEP_PRICE_UNITS,
} from "./fleetCheck";

/**
 * FleetActionProvider — every cheap route of the Verdict Row x402
 * fleet (all 24 routes priced <= $0.05) as a native AgentKit action,
 * with the x402 payment leg handled inside each action.
 *
 * The action set is built FROM the embedded function-calling pack
 * (src/function-tools.json, generated from the fleet's route
 * registry): names, descriptions, prices and zod schemas all come
 * from the pack, and the test suite pins this provider's inventory to
 * it. An AgentKit-built agent that registers this provider inherits
 * the fleet's checks — wallet snapshots and verdicts, pre-trade
 * guards, stall grading, rechecks, sign reads, route and token
 * verdicts — as parts of its own loop, paying per call from its own
 * wallet provider (EvmWalletProvider.toSigner() supplies the EIP-712
 * signer for the @x402/evm exact scheme, exactly as in
 * TokenVerdictActionProvider).
 *
 * Every action caps its spend guard at its route's pack price, and a
 * payment that cannot settle surfaces as an error string naming the
 * route's price and the fleet payTo — never a silent failure.
 *
 * Usage:
 *   const agentKit = await AgentKit.configureWithWallet({
 *     walletProvider,
 *     actionProviders: [fleetActionProvider()],
 *   });
 */
export class FleetActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly options: FleetOptions;

  constructor(options: FleetOptions = {}) {
    super("verdict-row-fleet", []);
    this.options = options;
  }

  private async invokeRoute(
    name: FleetToolName,
    walletProvider: EvmWalletProvider,
    args: Record<string, unknown>,
  ): Promise<string> {
    const route = getFleetRoute(name);
    const priceNote = route
      ? `this route costs ${route.price_display} USDC on Base (paid via x402 to ${FLEET_PAY_TO})`
      : `fleet payTo ${FLEET_PAY_TO}`;
    try {
      const signer = walletProvider.toSigner();
      const delivery = await fetchFleetRoute(signer, name, args, this.options);
      return JSON.stringify(delivery, null, 2);
    } catch (error) {
      return `Error calling ${name}: ${priceNote} and the payment/delivery did not complete: ${error}`;
    }
  }

  /**
   * stall-row /v1/wallet-snapshot — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_wallet_snapshot",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Snapshot one Base wallet in a single call: ETH balance, top token holdings, first and last activity, and outgoing transaction count. Use this when an agent needs a wallet's shape before deciding to pay, trust, or transact with it. Explorer fields that cannot be supplied come back marked unknown, never invented. Returns: a JSON object with fields: address, eth_balance, eth_balance_source, eth_balance_wei, first_activity, is_contract, last_activity, note, outgoing_tx_count_nonce, sources, token_balances.",
    schema: stallRowWalletSnapshotSchema,
  })
  async stallRowWalletSnapshot(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowWalletSnapshotSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_wallet_snapshot", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/allowance-audit — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_allowance_audit",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Audit one Base wallet's ERC-20 approvals against a curated list of major spenders (Permit2, Uniswap, Aerodrome, aggregators): active approvals are listed and unlimited ones flagged high risk. Use this when an agent or its owner wants to know what a wallet has already authorized before it holds or moves funds. When the explorer cannot supply the held-token list, the token-dependent fields come back marked unknown rather than the call failing. Returns: a JSON object with fields: active_approvals, address, allowance_checks_performed, coverage_note, note, spender_coverage, spenders_checked, summary, tokens_held_checked, unlimited_approvals.",
    schema: stallRowAllowanceAuditSchema,
  })
  async stallRowAllowanceAudit(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowAllowanceAuditSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_allowance_audit", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/tx-decoder — $0.002 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_tx_decoder",
    description: "$0.002 USDC per call via x402 on Base (2000 atomic units). Decode one Base transaction into plain English: sender, receiver, ETH value, status, the known method behind the selector, every ERC-20 transfer it made, and a one-sentence summary. Use this when an agent needs to explain or verify what a transaction actually did before acting on it. Returns: a JSON object with fields: block_number, erc20_transfers, from, gas_used, method, method_description, method_id, status, summary, to, tx_hash, value_eth.",
    schema: stallRowTxDecoderSchema,
  })
  async stallRowTxDecoder(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowTxDecoderSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_tx_decoder", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/gas-oracle — $0.001 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_gas_oracle",
    description: "$0.001 USDC per call via x402 on Base (1000 atomic units). Current Base gas in one call: the live gas price, the current base fee, the base-fee range across the last 20 blocks, whether fees are rising, falling, or flat, and a cheap-window hint drawn from that data. Use this when an agent wants to time a transaction instead of paying whatever the moment charges. Returns: a JSON object with fields: as_of_epoch, base_fee_gwei, base_fee_max_gwei_20_blocks, base_fee_min_gwei_20_blocks, blocks_sampled, chain, cheapest_window_hint, gas_price_gwei, latest_block, note, trend.",
    schema: stallRowGasOracleSchema,
  })
  async stallRowGasOracle(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowGasOracleSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_gas_oracle", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/wallet-verdict — $0.02 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_wallet_verdict",
    description: "$0.02 USDC per call via x402 on Base (20000 atomic units). A trust verdict for one Base wallet: OFAC SDN exact-match against a dated snapshot, wallet age, activity level, and an address-poisoning scan of its recent token transfers, combined into SAFE, CAUTION, or AVOID with a 0-100 score and itemized reasons. Use this when an agent must decide whether a wallet is safe to pay or take instructions from. Returns: a JSON object with fields: address, first_activity, limits, outgoing_tx_count_nonce, poisoning, reasons, sanctions, score, verdict, wallet_age_days.",
    schema: stallRowWalletVerdictSchema,
  })
  async stallRowWalletVerdict(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowWalletVerdictSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_wallet_verdict", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/pre-trade-guard — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_pre_trade_guard",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Pre-Trade Guard \u2014 before you pay an x402 listing, screen the payTo you are about to pay: its Verdict Index catalog history (first seen, payTo rotations, listings added or removed across the snapshots held), an OFAC SDN exact-match check, and the wallet's Base age and activity, combined into PROCEED, CAUTION, or ABORT with itemized reasons. Use this when an agent is about to pay a payTo it has never paid before. Returns: a JSON object with fields: amount, index, limits, network, not_checked, pay_to, reasons, resource, risk_score, sanctions, unknown_legs, verdict, wallet.",
    schema: stallRowPreTradeGuardSchema,
  })
  async stallRowPreTradeGuard(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowPreTradeGuardSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_pre_trade_guard", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/grade-my-stall — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_grade_my_stall",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Grade My Stall \u2014 a seller-side report card for one x402 resource: a live unpaid probe (does it answer 402 with a parseable challenge?), the description measured against the 500-character limit, CDP listing presence in the newest catalog snapshot, Settled's record, the origin's x402scan ownership declaration, and payTo consistency across sources. Checks that cannot be performed report unverified, never a guess. Use this when you run a stall and want to know how buyers' tools see it. Returns: a JSON object with fields: checks, limits, overall, pay_to_supplied, resource, summary.",
    schema: stallRowGradeMyStallSchema,
  })
  async stallRowGradeMyStall(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowGradeMyStallSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_grade_my_stall", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/receipt-verify — $0.002 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_receipt_verify",
    description: "$0.002 USDC per call via x402 on Base (2000 atomic units). Receipt Verifier \u2014 a Base transaction hash in, a normalized verified receipt out: payer, payTo and amount from the USDC Transfer log, asset and network, settled status and confirmations. When the payTo is this fleet's own and the amount matches a priced route, routes at that price are listed as candidates \u2014 an amount alone never proves which route was called. Unknown transactions error honestly, unsettled. Use this when someone claims they paid and you want the chain's version. Base only. Returns: a JSON object with fields: amount_units, amount_usd, asset, asset_symbol, block_number, chain, confirmations, fleet_route_candidates, limits, network, pay_to, payer, receipt_status, settled, tx_hash, tx_sender, usdc_transfers.",
    schema: stallRowReceiptVerifySchema,
  })
  async stallRowReceiptVerify(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowReceiptVerifySchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_receipt_verify", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/flagged-paytos — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_flagged_paytos",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Bad-payTo Registry Feed \u2014 the currently flagged payTos, each with its evidence: every address in the bundled OFAC SDN snapshot, payTos the newest catalog snapshot pair shows rotated away from live listings, and payTos of listings that vanished between snapshots. Built from the same two sources the Pre-Trade Guard screens against. No entry without evidence; entry and evidence caps are stated, never silent. Use this when a router or guard wants the fleet's current avoid-list in one cheap call. Returns: a JSON object with fields: baseline_at, counts, current_at, entries, generated_at, index_note, limits, truncation.",
    schema: stallRowFlaggedPaytosSchema,
  })
  async stallRowFlaggedPaytos(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowFlaggedPaytosSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_flagged_paytos", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/agent-card-verify — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_agent_card_verify",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Agent-Card Verifier \u2014 an ERC-8004 agent id (resolved on Base via the registry) or an agent.json URL in; the card is fetched and checked against live reality: declared endpoints probed unpaid (402 is correct for a paid service), challenge payTos compared with the card's declared wallets, declared prices with live challenge amounts. Undeclared fields report not_checked, never a guess; an unreachable card errors honestly, unsettled. Use this when an agent's card claims more than its endpoints do. Returns: a JSON object with fields: agent_id, card_name, card_url, checks, limits, overall, source, summary.",
    schema: stallRowAgentCardVerifySchema,
  })
  async stallRowAgentCardVerify(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowAgentCardVerifySchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_agent_card_verify", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/tube-search — $0.01 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_tube_search",
    description: "$0.01 USDC per call via x402 on Base (10000 atomic units). YouTube search results as clean JSON: title, video id, URL, channel, duration, and views for each result, scraped from the public results page with no API key. Use this when an agent needs to find a video mid-task and cannot drive a browser or hold a Google API key. Returns: a JSON object with fields: count, query, results.",
    schema: stallRowTubeSearchSchema,
  })
  async stallRowTubeSearch(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowTubeSearchSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_tube_search", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/page-to-markdown — $0.01 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_page_to_markdown",
    description: "$0.01 USDC per call via x402 on Base (10000 atomic units). Fetch one web page and return its main content as clean Markdown with title and word count, extracted server-side. Private and loopback targets are refused. Use this when an agent needs to read a page inside a workflow without a browser and without wading through navigation and boilerplate. Returns: a JSON object with fields: final_url, markdown, title, url, word_count.",
    schema: stallRowPageToMarkdownSchema,
  })
  async stallRowPageToMarkdown(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowPageToMarkdownSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_page_to_markdown", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/repo-vitals — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_repo_vitals",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Vital signs for one GitHub repository in a single call: stars, forks, open issues, license, last push, archived flag, and a 0-100 health score with a verdict line. Use this when an agent is choosing a dependency, a repo to contribute to, or a project to trust, and needs the quick read before the deep one. Returns: a JSON object with fields: archived, created_at, description, forks, health_notes, health_score, license, open_issues, pushed_at, repo, stars, url, verdict.",
    schema: stallRowRepoVitalsSchema,
  })
  async stallRowRepoVitals(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowRepoVitalsSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_repo_vitals", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/price-check — $0.05 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_price_check",
    description: "$0.05 USDC per call via x402 on Base (50000 atomic units). Pricing comps for an x402 listing, read live from the CDP Bazaar public catalog: how many resources match your keywords, their price distribution, the closest comparables, and a recommended listing price with its rationale. Use this when you operate an x402 route and are setting or changing its price. Returns: a JSON object with fields: catalog_status, comparables, keywords, matches_found, price_distribution, rationale, recommended_price_usd.",
    schema: stallRowPriceCheckSchema,
  })
  async stallRowPriceCheck(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowPriceCheckSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_price_check", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/job-scout — $0.05 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_job_scout",
    description: "$0.05 USDC per call via x402 on Base (50000 atomic units). A digest of currently open agent jobs from the marketplaces we sweep daily, filtered by the capabilities you name and sorted by budget: platform, budget, capability tags, deadline, and source snapshot time on every row, with a stale flag when the snapshot ages past 24 hours. Use this when your agent is looking for paid work. Returns: a JSON object with fields: count, data_stale, jobs, note, snapshot_age_hours, snapshot_fetched_at, snapshot_source.",
    schema: stallRowJobScoutSchema,
  })
  async stallRowJobScout(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowJobScoutSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_job_scout", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/recheck — $0.005 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_recheck",
    description: "$0.005 USDC per call via x402 on Base (5000 atomic units). Probe one x402 resource or page WITHOUT paying it: BASELINE / UNCHANGED / CHANGED with a diff (price, asset, payTo, schema, body) vs the last check. Use this when a scheduled agent must know what changed first. Watch and pack state persist across redeploys on the service volume. Checking the same endpoint on a schedule? Buy the pack instead \u2014 POST /v1/recheck/pack is $1 for 250 checks (90 days) and this route spends pack credits when you send pack_id, so a loop makes one payment, not hundreds. Returns: a JSON object with fields: changes, checked_at, current, kind, status, summary, url, watch_id.",
    schema: stallRowRecheckSchema,
  })
  async stallRowRecheck(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowRecheckSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_recheck", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/sign-read — $0.01 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_sign_read",
    description: "$0.01 USDC per call via x402 on Base (10000 atomic units). Sign Reader \u2014 read one x402 endpoint's 402 challenge: both wire formats (v2 PAYMENT-REQUIRED header, v1 JSON body) parsed and normalized (network, asset, amount atomic and exact decimal, payTo, scheme), malformed fields named, declared-vs-live mismatches (method included) when you pass your catalogue entry, and a compatibility verdict for the official Python and TypeScript x402 SDKs. Probe is unpaid. Use this when a checker's parser keeps choking on sellers' signs. Returns: a JSON object with fields: accepts, challenge_found, defects, http_status, limits, mismatches, origin, read_at, sdk_compat, url, x402_version.",
    schema: stallRowSignReadSchema,
  })
  async stallRowSignRead(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowSignReadSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_sign_read", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/score-book — $0.01 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_score_book",
    description: "$0.01 USDC per call via x402 on Base (10000 atomic units). Score Book \u2014 an x402 target's track record from our records: check history, prices/payTos carried, catalogue presence, and \u2014 for url/origin \u2014 patrol facts from the patrol snapshot (open defects by class, first/last seen; recoveries with receipt ids; snapshot provenance). Patrol is periodic \u2014 facts are as of the snapshot, never live; it holds no payTo data, so payTo patrol sections are empty. Unknown: found=false. Use this when judging a stall needs its history, not just its current sign. Returns: a JSON object with fields: computed_at, found, limits, target.",
    schema: stallRowScoreBookSchema,
  })
  async stallRowScoreBook(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowScoreBookSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_score_book", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/guard — $0.01 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_guard",
    description: "$0.01 USDC per call via x402 on Base (10000 atomic units). Guard \u2014 one pay / caution / avoid verdict for one x402 endpoint, composed from the row's inspector tools: the live 402 sign read and SDK-checked, the payTo screened against the bad-payTo registry (OFAC plus rotation/vanishing flags, evidence attached), and the resource's recorded history \u2014 unknown history caps the verdict at CAUTION. Every verdict carries its reasons; the one probe inside is unpaid. Use this when your agent is about to pay an endpoint it does not know. Returns: a JSON object with fields: limits, payto_flag, reasons, terms, url, verdict.",
    schema: stallRowGuardSchema,
  })
  async stallRowGuard(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowGuardSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_guard", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/physical — $0.05 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_physical",
    description: "$0.05 USDC per call via x402 on Base (50000 atomic units). Inspector Physical \u2014 the full pre-pay workup for one x402 resource in ONE $0.05 call (the singles sum to $0.075): Sign Reader's challenge report, Score Book's track record, Guard's PROCEED/CAUTION/ABORT verdict as the headline, and a Recheck that probes and records the target (BASELINE/UNCHANGED/CHANGED, in the public feed). No RouteVerdict leg. Bad targets are delivered reports; only SSRF refusals are 422. Use this when your agent wants one endpoint's complete picture before paying it. Returns: a JSON object with fields: book, guard, limits, recheck, sign, summary, url, verdict.",
    schema: stallRowPhysicalSchema,
  })
  async stallRowPhysical(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowPhysicalSchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_physical", walletProvider, args as Record<string, unknown>);
  }

  /**
   * stall-row /v1/payto-pin/verify — $0.01 USDC on Base via x402.
   */
  @CreateAction({
    name: "stall_row_payto_pin_verify",
    description: "$0.01 USDC per call via x402 on Base (10000 atomic units). PayTo Pin Verify \u2014 check one pinned x402 route against its first-seen payTo set: a fresh unpaid probe compares the live payTo set with the pin's hash-committed baseline, answering MATCH, MOVED with before/after sets, or ROUTE_GONE as a delivered report. A swap fires one signed PAYTO_MOVED webhook per distinct new set. Pins are created free at POST /v1/payto-pin. Use this when a payTo swap must be caught before you pay the route again. Returns: a JSON object with fields: alert_queued, commitment, commitment_verified, current_payto_set, evidence, limits, observed_at, pin_created, pin_id, pinned_payto_set, status, url.",
    schema: stallRowPaytoPinVerifySchema,
  })
  async stallRowPaytoPinVerify(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof stallRowPaytoPinVerifySchema>,
  ): Promise<string> {
    return this.invokeRoute("stall_row_payto_pin_verify", walletProvider, args as Record<string, unknown>);
  }

  /**
   * route-verdict /v1/check — $0.05 USDC on Base via x402.
   */
  @CreateAction({
    name: "route_verdict_check",
    description: "$0.05 USDC per call via x402 on Base (50000 atomic units). Trust & liveness check for one x402 resource URL: live 402 probe (never pays the target), terms, discovery-schema quality, catalog presence, diff. Use this when auditing an unfamiliar x402 endpoint before paying or relying on it. Returns: a JSON object with fields: catalog, checked_at, diff, liveness, reasons, resource_url, schema_quality, score, terms, verdict.",
    schema: routeVerdictCheckSchema,
  })
  async routeVerdictCheck(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof routeVerdictCheckSchema>,
  ): Promise<string> {
    return this.invokeRoute("route_verdict_check", walletProvider, args as Record<string, unknown>);
  }

  /**
   * token-verdict /v1/verdict — $0.02 USDC on Base via x402.
   */
  @CreateAction({
    name: "token_verdict_verdict",
    description: "$0.02 USDC per call via x402 on Base (20000 atomic units). Token risk verdict: SOLID / CAUTION / DANGER with score, six signals and a written take. Send a contract address. Use this when screening a token before buying, swapping, or routing funds into it. Returns: a JSON object with fields: market, score, signals, take, token, verdict.",
    schema: tokenVerdictVerdictSchema,
  })
  async tokenVerdictVerdict(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof tokenVerdictVerdictSchema>,
  ): Promise<string> {
    return this.invokeRoute("token_verdict_verdict", walletProvider, args as Record<string, unknown>);
  }

  /**
   * token-verdict /v1/pre-trade — $0.05 USDC on Base via x402.
   */
  @CreateAction({
    name: "token_verdict_pre_trade",
    description: "$0.05 USDC per call via x402 on Base (50000 atomic units). Combined go/no-go before a trade: PROCEED / CAUTION / ABORT from the token's market verdict, the wallet's sanctions/age/poisoning check, and (with a spender) its ERC-20 approvals. Mode 'compact' returns the decision plus per-leg summaries. Use this when an agent is about to swap or pay and needs token + wallet + allowance risk in one call. Payable in USDC on Base or Solana. Returns: a JSON object with fields: abort_reasons, degraded, legs, mode, not_checked, score, spender, token, verdict, wallet, worst_leg.",
    schema: tokenVerdictPreTradeSchema,
  })
  async tokenVerdictPreTrade(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof tokenVerdictPreTradeSchema>,
  ): Promise<string> {
    return this.invokeRoute("token_verdict_pre_trade", walletProvider, args as Record<string, unknown>);
  }

  // ------------------------------------------------------------------
  // Fleet Check Framework Pack actions (Next-20 Item 13).
  //
  // These three actions are HAND-WRITTEN, not pack-generated: Fleet
  // Check is priced ABOVE the <= $0.05 cap of the Item 4 pack this
  // provider's other 24 actions are built from ($5.00 pack / $0.10
  // single sweep), so it is deliberately kept out of the pack
  // inventory and its prices are stated in full in each description.
  // Deliveries carry the service's framework_log run-log entries.
  // ------------------------------------------------------------------

  private fleetCheckOptions() {
    return {
      baseUrl: this.options.baseUrls?.["stall-row"],
      maxAmountPerPayment: this.options.maxAmountPerPayment,
      fetchImpl: this.options.fetchImpl,
    };
  }

  /**
   * stall-row /v1/fleet-check/pack — $5.00 USDC on Base via x402.
   * Hand-written Fleet Check action (NOT one of the <= $0.05
   * pack-generated actions above).
   */
  @CreateAction({
    name: "buy_fleet_check_pack",
    description:
      "$5.00 USDC per purchase via x402 on Base (5000000 atomic units) — ABOVE the $0.05 cap of this provider's pack-generated actions; this is a separate hand-written Fleet Check Framework Pack action. Buy the Fleet Check pack: 100 sweep credits bound to ONE fixed fleet definition (resources and/or origins), 90-day expiry (renewal cycle: buy a new $5.00 pack). Sweeps probe every route in the fleet unpaid and classify each OK / DEGRADED / DOWN with its defect; deliveries include framework_log run-log entries and renewal terms. Use this when an agent should sweep the same fleet of x402 routes repeatedly on its own schedule.",
    schema: buyFleetCheckPackSchema,
  })
  async buyFleetCheckPack(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof buyFleetCheckPackSchema>,
  ): Promise<string> {
    try {
      const delivery = await buyFleetCheckPack(
        walletProvider.toSigner(),
        args,
        this.fleetCheckOptions(),
      );
      return JSON.stringify(delivery, null, 2);
    } catch (error) {
      return `Error calling buy_fleet_check_pack: this pack costs ${FLEET_CHECK_PACK_PRICE} USDC on Base (${FLEET_CHECK_PACK_PRICE_UNITS} atomic units, paid via x402 to ${FLEET_PAY_TO}) and the payment/delivery did not complete: ${error}`;
    }
  }

  /**
   * stall-row /v1/fleet-check — $0.10 USDC on Base via x402.
   * Hand-written Fleet Check action (NOT pack-generated; $0.10 is
   * above the <= $0.05 pack cap).
   */
  @CreateAction({
    name: "fleet_check_sweep",
    description:
      "$0.10 USDC per call via x402 on Base (100000 atomic units) — ABOVE the $0.05 cap of this provider's pack-generated actions; this is a separate hand-written Fleet Check Framework Pack action. One Fleet Check sweep: probe every named resource / every priced resource of every named origin unpaid, classify each OK / DEGRADED / DOWN with its defect, grade each origin, and return the table plus framework_log run-log entries. Use this for a one-off whole-fleet health sweep; for repeated sweeps of the same fleet, buy_fleet_check_pack is cheaper per sweep.",
    schema: fleetCheckSweepSchema,
  })
  async fleetCheckSweep(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof fleetCheckSweepSchema>,
  ): Promise<string> {
    try {
      const delivery = await fleetCheckSweep(
        walletProvider.toSigner(),
        args,
        this.fleetCheckOptions(),
      );
      return JSON.stringify(delivery, null, 2);
    } catch (error) {
      return `Error calling fleet_check_sweep: this sweep costs ${FLEET_CHECK_SWEEP_PRICE} USDC on Base (${FLEET_CHECK_SWEEP_PRICE_UNITS} atomic units, paid via x402 to ${FLEET_PAY_TO}) and the payment/delivery did not complete: ${error}`;
    }
  }

  /**
   * stall-row /v1/fleet-check/run — one pack credit, no x402 payment.
   * Hand-written Fleet Check action (NOT pack-generated).
   */
  @CreateAction({
    name: "run_fleet_check_sweep",
    description:
      "No x402 payment on this call: it spends ONE sweep credit from a Fleet Check pack bought with buy_fleet_check_pack ($5.00 for 100 sweeps, 90-day expiry). Run one sweep of the pack's fixed fleet definition right now: every route probed unpaid, classified OK / DEGRADED / DOWN with its defect, diffed against the previous sweep (new failures and recoveries are pushed to the pack's webhook), and returned with framework_log run-log entries and credits_remaining. Use this when a framework runner sweeps its fleet on its own clock.",
    schema: fleetCheckPackIdSchema,
  })
  async runFleetCheckSweep(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof fleetCheckPackIdSchema>,
  ): Promise<string> {
    void walletProvider;
    try {
      const delivery = await runFleetCheckSweep(
        args.pack_id,
        this.fleetCheckOptions(),
      );
      return JSON.stringify(delivery, null, 2);
    } catch (error) {
      return `Error calling run_fleet_check_sweep: this call spends one credit from a Fleet Check pack (bought via buy_fleet_check_pack, $5.00 for 100 sweeps payable to ${FLEET_PAY_TO} on Base) and did not complete: ${error}`;
    }
  }

  /**
   * All payments settle in USDC on Base, so the wallet must be an EVM
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
 * Factory for the fleet action provider (AgentKit idiom).
 *
 * @param options - Optional per-stall origin / spend-guard overrides.
 */
export const fleetActionProvider = (
  options: FleetOptions = {},
): FleetActionProvider => new FleetActionProvider(options);
