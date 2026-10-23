"""Server-level tests: the tool is registered with the real endpoint's
input schema, and tool calls route through the (mocked) client logic."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from token_verdict_mcp.schemas import VERDICT_INPUT_SCHEMA, VERDICT_OUTPUT_SCHEMA
from token_verdict_mcp.server import mcp, run_verdict

FIXTURES = Path(__file__).parent / "fixtures"
VERDICT = json.loads((FIXTURES / "verdict_example.json").read_text())


def test_tool_registered_with_real_input_schema():
    tools = asyncio.run(mcp.list_tools())
    by_name = {t.name: t for t in tools}
    assert "token_verdict" in by_name
    schema = by_name["token_verdict"].inputSchema
    # FastMCP generates the tool schema from the Python signature, so it
    # can't be byte-identical to the service's wire schema — assert the
    # substantive contract matches instead: same fields, same types,
    # same chain enum, address required.
    props = schema["properties"]
    assert set(props) == set(VERDICT_INPUT_SCHEMA["properties"])
    assert props["address"]["type"] == "string"
    assert props["chain"]["enum"] == VERDICT_INPUT_SCHEMA["properties"]["chain"]["enum"]
    assert schema["required"] == VERDICT_INPUT_SCHEMA["required"]


def test_output_schema_matches_service_contract():
    # The wrapper advertises exactly the service's response shape.
    assert VERDICT_OUTPUT_SCHEMA["required"] == [
        "token",
        "verdict",
        "score",
        "signals",
        "take",
        "market",
    ]
    # And the service's own example output satisfies the required keys.
    for key in VERDICT_OUTPUT_SCHEMA["required"]:
        assert key in VERDICT
    assert len(VERDICT["signals"]) == 6


def test_tool_call_via_run_verdict_happy_path(monkeypatch):
    class FakeClient:
        def get_verdict(self, address, chain="base"):
            assert address.startswith("0x") and len(address) == 42
            return VERDICT

    result = run_verdict(
        "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b", client=FakeClient()
    )
    assert result["verdict"] in ("SOLID", "CAUTION", "DANGER")
    assert isinstance(result["score"], (int, float))
