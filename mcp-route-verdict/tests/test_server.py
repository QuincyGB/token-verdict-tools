"""Server-level tests: the tool is registered with the real endpoint's
input schema, and tool calls route through the (mocked) client logic."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from route_verdict_mcp.schemas import CHECK_INPUT_SCHEMA, CHECK_OUTPUT_SCHEMA
from route_verdict_mcp.server import mcp, run_check

FIXTURES = Path(__file__).parent / "fixtures"
CHECK = json.loads((FIXTURES / "check_example.json").read_text())


def test_tool_registered_with_real_input_schema():
    tools = asyncio.run(mcp.list_tools())
    by_name = {t.name: t for t in tools}
    assert "route_check" in by_name
    schema = by_name["route_check"].inputSchema
    # FastMCP generates the tool schema from the Python signature, so it
    # can't be byte-identical to the service's wire schema — assert the
    # substantive contract matches instead: same fields, same types,
    # resource_url required.
    props = schema["properties"]
    assert set(props) == set(CHECK_INPUT_SCHEMA["properties"])
    assert props["resource_url"]["type"] == "string"
    assert schema["required"] == CHECK_INPUT_SCHEMA["required"]


def test_output_schema_matches_service_contract():
    # The wrapper advertises exactly the service's response shape.
    assert CHECK_OUTPUT_SCHEMA["required"] == [
        "resource_url",
        "checked_at",
        "verdict",
        "score",
        "reasons",
        "liveness",
        "terms",
        "schema_quality",
        "catalog",
        "diff",
    ]
    # And the example output satisfies the required keys.
    for key in CHECK_OUTPUT_SCHEMA["required"]:
        assert key in CHECK
    assert CHECK["verdict"] in ("TRUSTED", "CAUTION", "AVOID")


def test_tool_call_via_run_check_happy_path():
    class FakeClient:
        def get_check(self, resource_url):
            assert resource_url.startswith("https://")
            return CHECK

    result = run_check(
        "https://token-verdict-production.up.railway.app/v1/verdict",
        client=FakeClient(),
    )
    assert result["verdict"] in ("TRUSTED", "CAUTION", "AVOID")
    assert isinstance(result["score"], (int, float))
