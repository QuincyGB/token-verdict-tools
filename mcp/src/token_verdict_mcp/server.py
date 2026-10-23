"""MCP server (stdio) exposing Token Verdict as a single tool.

Run it with an MCP host (Claude Desktop, Cursor, any MCP client):

    token-verdict-mcp            # after pip install
    python -m token_verdict_mcp  # from a checkout

Configuration is entirely from the environment of whoever runs it:

    AGENT_PRIVATE_KEY   EVM private key (0x...) of YOUR wallet holding
                        USDC on Base — used to pay the $0.02/call x402
                        charge automatically. Never shared with the tool
                        author; the key stays on your machine.
    AGENT_KEY_FILE      Alternative: path to a file containing the key.
    TOKEN_VERDICT_URL   Override the service base URL
                        (default: production).
    TOKEN_VERDICT_MAX_AMOUNT_UNITS
                        Spend guard per call, in USDC micro-units
                        (default 20000 = $0.02, the known price).

With no signer configured the tool never pays: it returns the parsed
402 challenge as a structured error so the calling agent can see the
price, asset, network and payTo and decide what to do.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from mcp.server.fastmcp import FastMCP

from .client import (
    DEFAULT_BASE_URL,
    DEFAULT_MAX_AMOUNT_UNITS,
    PaymentRequiredError,
    TokenVerdictClient,
    TokenVerdictError,
    load_account_from_env,
)

mcp = FastMCP("token-verdict")

_CHAINS = ("base", "ethereum", "solana")


def build_client(env: dict | None = None) -> TokenVerdictClient:
    env = os.environ if env is None else env
    max_units_raw = (env.get("TOKEN_VERDICT_MAX_AMOUNT_UNITS") or "").strip()
    return TokenVerdictClient(
        base_url=(env.get("TOKEN_VERDICT_URL") or DEFAULT_BASE_URL),
        account=load_account_from_env(env),
        max_amount_units=int(max_units_raw) if max_units_raw else DEFAULT_MAX_AMOUNT_UNITS,
    )


def run_verdict(
    address: str, chain: str = "base", client: TokenVerdictClient | None = None
) -> dict[str, Any]:
    """The tool's logic, kept transport-free so tests can drive it with a
    mock HTTP client. Returns the verdict JSON, or a structured error
    dict (payment_required / invalid_chain / upstream_error)."""
    if chain not in _CHAINS:
        return {
            "error": "invalid_chain",
            "detail": f"chain must be one of {_CHAINS}, got {chain!r}",
        }
    client = client or build_client()
    try:
        return client.get_verdict(address, chain)
    except PaymentRequiredError as exc:
        return exc.structured_error()
    except TokenVerdictError as exc:
        return {
            "error": "upstream_error",
            "status": exc.status,
            "detail": exc.detail,
        }


@mcp.tool()
def token_verdict(
    address: str, chain: Literal["base", "ethereum", "solana"] = "base"
) -> dict[str, Any]:
    """Get a risk verdict for a token before buying, swapping, or routing funds into it.

    Calls Token Verdict (POST /v1/verdict, $0.02 USDC on Base via x402).
    Returns verdict (SOLID / CAUTION / DANGER), a 0-100 risk score, six
    weighted market-structure signals (liquidity depth, volume churn,
    sell pressure, price action, trader breadth, pair age), a written
    analyst take, and the raw market data the verdict derives from.

    Args:
        address: Token contract address (0x...).
        chain: Chain label — "base" (default), "ethereum", or "solana".
    """
    return run_verdict(address, chain)


def main() -> None:
    mcp.run()  # stdio transport


if __name__ == "__main__":
    main()
