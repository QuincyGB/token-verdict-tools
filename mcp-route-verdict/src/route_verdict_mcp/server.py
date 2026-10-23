"""MCP server (stdio) exposing RouteVerdict as a single tool.

Run it with an MCP host (Claude Desktop, Cursor, any MCP client):

    route-verdict-mcp            # after pip install
    python -m route_verdict_mcp  # from a checkout

Configuration is entirely from the environment of whoever runs it:

    AGENT_PRIVATE_KEY   EVM private key (0x...) of YOUR wallet holding
                        USDC on Base — used to pay the $0.05/call x402
                        charge automatically. Never shared with the tool
                        author; the key stays on your machine.
    AGENT_KEY_FILE      Alternative: path to a file containing the key.
    ROUTE_VERDICT_URL   Override the service base URL
                        (default: production).
    ROUTE_VERDICT_MAX_AMOUNT_UNITS
                        Spend guard per call, in USDC micro-units
                        (default 50000 = $0.05, the known price).

With no signer configured the tool never pays: it returns the parsed
402 challenge as a structured error so the calling agent can see the
price, asset, network and payTo and decide what to do.
"""

from __future__ import annotations

import os
from typing import Any

from mcp.server.fastmcp import FastMCP

from .client import (
    DEFAULT_BASE_URL,
    DEFAULT_MAX_AMOUNT_UNITS,
    PaymentRequiredError,
    RouteVerdictClient,
    RouteVerdictError,
    load_account_from_env,
)

mcp = FastMCP("route-verdict")


def build_client(env: dict | None = None) -> RouteVerdictClient:
    env = os.environ if env is None else env
    max_units_raw = (env.get("ROUTE_VERDICT_MAX_AMOUNT_UNITS") or "").strip()
    return RouteVerdictClient(
        base_url=(env.get("ROUTE_VERDICT_URL") or DEFAULT_BASE_URL),
        account=load_account_from_env(env),
        max_amount_units=int(max_units_raw) if max_units_raw else DEFAULT_MAX_AMOUNT_UNITS,
    )


def run_check(
    resource_url: str, client: RouteVerdictClient | None = None
) -> dict[str, Any]:
    """The tool's logic, kept transport-free so tests can drive it with a
    mock HTTP client. Returns the check JSON, or a structured error
    dict (payment_required / upstream_error)."""
    client = client or build_client()
    try:
        return client.get_check(resource_url)
    except PaymentRequiredError as exc:
        return exc.structured_error()
    except RouteVerdictError as exc:
        return {
            "error": "upstream_error",
            "status": exc.status,
            "detail": exc.detail,
        }


@mcp.tool()
def route_check(resource_url: str) -> dict[str, Any]:
    """Audit an x402 endpoint's trust and liveness before paying or relying on it.

    Calls RouteVerdict (POST /v1/check, $0.05 USDC on Base via x402).
    Returns a verdict (TRUSTED / CAUTION / AVOID) with a 0-100 trust
    score, an itemized deduction list, a live 402 probe of the target
    (the target is never paid), its published terms, discovery-schema
    quality, catalog presence in the CDP Bazaar and PayAI indexes, and
    a diff against the last check of the same URL.

    Args:
        resource_url: Full URL of the x402 resource to audit.
    """
    return run_check(resource_url)


def main() -> None:
    mcp.run()  # stdio transport


if __name__ == "__main__":
    main()
