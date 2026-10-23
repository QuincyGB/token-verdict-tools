"""Client payment-flow tests. ALL payments are mocked — the HTTP layer is
an httpx MockTransport and the signer is a throwaway account generated
at test time. No key material lives in this repo, and no test touches
the network or spends anything.

The 402 fixture (fixtures/payment_required.json) is real: captured from
an unpaid probe of production on 2026-10-23. The verdict fixture is the
service engine's own published example output.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import httpx
import pytest
from eth_account import Account
from eth_account.messages import encode_typed_data

from token_verdict_mcp.client import (
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    PaymentRequiredError,
    TokenVerdictClient,
    TokenVerdictError,
    build_authorization,
    load_account_from_env,
    parse_payment_required,
    select_requirement,
)
from token_verdict_mcp.server import run_verdict

FIXTURES = Path(__file__).parent / "fixtures"
CHALLENGE = json.loads((FIXTURES / "payment_required.json").read_text())
VERDICT = json.loads((FIXTURES / "verdict_example.json").read_text())
USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
PAY_TO = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F"
TOKEN = "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b"


def challenge_response(challenge: dict | None = None) -> httpx.Response:
    challenge = CHALLENGE if challenge is None else challenge
    header = base64.b64encode(json.dumps(challenge).encode()).decode()
    return httpx.Response(
        402, headers={"payment-required": header}, json={}, request=_req()
    )


def _req() -> httpx.Request:
    return httpx.Request("POST", "https://example.test/v1/verdict")


class Recorder:
    """MockTransport handler: replays queued responses, records requests."""

    def __init__(self, responses: list[httpx.Response]):
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.responses.pop(0)


def mock_client(recorder: Recorder, **kwargs) -> TokenVerdictClient:
    http = httpx.Client(transport=httpx.MockTransport(recorder))
    return TokenVerdictClient(base_url="https://example.test", http=http, **kwargs)


# --- challenge parsing -------------------------------------------------------


def test_parse_real_production_challenge():
    parsed = parse_payment_required(challenge_response())
    assert parsed["x402Version"] == 2
    req = select_requirement(parsed)
    assert req["scheme"] == "exact"
    assert req["network"] == "eip155:8453"
    assert req["asset"] == USDC_ADDRESS
    assert req["amount"] == "20000"  # $0.02 in USDC micro-units
    assert req["payTo"] == PAY_TO
    assert req["extra"] == {"name": "USD Coin", "version": "2"}


def test_select_requirement_rejects_foreign_network():
    challenge = {"accepts": [{"scheme": "exact", "network": "eip155:1"}]}
    with pytest.raises(ValueError):
        select_requirement(challenge)


# --- no signer: structured error, never a payment ----------------------------


def test_no_signer_returns_structured_error_and_never_retries():
    recorder = Recorder([challenge_response()])
    client = mock_client(recorder, account=None)
    result = run_verdict(TOKEN, client=client)
    assert result["error"] == "payment_required"
    assert result["accepts"][0]["amount"] == "20000"
    assert result["accepts"][0]["payTo"] == PAY_TO
    assert len(recorder.requests) == 1  # no paid retry was attempted


def test_no_signer_client_raises_with_challenge_attached():
    recorder = Recorder([challenge_response()])
    client = mock_client(recorder, account=None)
    with pytest.raises(PaymentRequiredError) as excinfo:
        client.get_verdict(TOKEN)
    assert excinfo.value.challenge["accepts"][0]["asset"] == USDC_ADDRESS


# --- signer flow: sign EIP-3009, retry with PAYMENT-SIGNATURE ---------------


def test_paid_flow_signs_eip3009_and_retries():
    account = Account.create()  # throwaway, generated at test time
    receipt = base64.b64encode(
        json.dumps(
            {
                "success": True,
                "transaction": "0x" + "ab" * 32,
                "network": "eip155:8453",
                "payer": account.address,
            }
        ).encode()
    ).decode()
    ok = httpx.Response(
        200, headers={"payment-response": receipt}, json=VERDICT, request=_req()
    )
    recorder = Recorder([challenge_response(), ok])
    client = mock_client(recorder, account=account)

    result = client.get_verdict(TOKEN, "base")
    assert result["verdict"] == "CAUTION"
    assert result["score"] == 35.0
    assert client.last_receipt["transaction"] == "0x" + "ab" * 32
    assert len(recorder.requests) == 2

    retry = recorder.requests[1]
    header = retry.headers.get("PAYMENT-SIGNATURE")
    assert header, "paid retry must carry the PAYMENT-SIGNATURE header"
    payload = json.loads(base64.b64decode(header))

    assert payload["x402Version"] == 2
    assert payload["accepted"]["amount"] == "20000"
    assert payload["accepted"]["asset"] == USDC_ADDRESS
    auth = payload["payload"]["authorization"]
    assert auth["from"] == account.address
    assert auth["to"] == PAY_TO
    assert auth["value"] == "20000"
    assert auth["validAfter"] == "0"
    assert int(auth["validBefore"]) > int(auth["validAfter"])

    # The signature must actually verify as this account's EIP-712
    # signature over the TransferWithAuthorization — not just exist.
    req = select_requirement(CHALLENGE)
    domain = {
        "name": req["extra"]["name"],
        "version": req["extra"]["version"],
        "chainId": 8453,
        "verifyingContract": req["asset"],
    }
    message = {
        "from": auth["from"],
        "to": auth["to"],
        "value": int(auth["value"]),
        "validAfter": int(auth["validAfter"]),
        "validBefore": int(auth["validBefore"]),
        "nonce": bytes.fromhex(auth["nonce"].removeprefix("0x")),
    }
    encoded = encode_typed_data(domain, TRANSFER_WITH_AUTHORIZATION_TYPES, message)
    recovered = Account.recover_message(encoded, signature=payload["payload"]["signature"])
    assert recovered == account.address


def test_spend_guard_refuses_to_sign_above_cap():
    expensive = json.loads(json.dumps(CHALLENGE))
    expensive["accepts"][0]["amount"] = "50000"  # $0.05 > $0.02 guard
    recorder = Recorder([challenge_response(expensive)])
    client = mock_client(recorder, account=Account.create())
    with pytest.raises(PaymentRequiredError) as excinfo:
        client.get_verdict(TOKEN)
    assert "spend guard" in excinfo.value.reason
    assert len(recorder.requests) == 1  # refused before any retry


def test_paid_retry_still_402_raises():
    recorder = Recorder([challenge_response(), challenge_response()])
    client = mock_client(recorder, account=Account.create())
    with pytest.raises(PaymentRequiredError) as excinfo:
        client.get_verdict(TOKEN)
    assert "still returned 402" in excinfo.value.reason
    assert len(recorder.requests) == 2


# --- non-payment failures -----------------------------------------------------


def test_upstream_error_maps_to_structured_error():
    not_found = httpx.Response(404, json={"error": "token not found"}, request=_req())
    recorder = Recorder([not_found])
    client = mock_client(recorder, account=None)
    result = run_verdict(TOKEN, client=client)
    assert result == {
        "error": "upstream_error",
        "status": 404,
        "detail": {"error": "token not found"},
    }
    with pytest.raises(TokenVerdictError):
        mock_client(Recorder([httpx.Response(404, json={}, request=_req())])).get_verdict(TOKEN)


def test_invalid_chain_short_circuits():
    def boom(request):  # pragma: no cover - must never be called
        raise AssertionError("HTTP must not be called for an invalid chain")

    http = httpx.Client(transport=httpx.MockTransport(boom))
    client = TokenVerdictClient(base_url="https://example.test", http=http)
    result = run_verdict(TOKEN, chain="bitcoin", client=client)
    assert result["error"] == "invalid_chain"


# --- signer loading ------------------------------------------------------------


def test_load_account_from_env_variants(tmp_path):
    assert load_account_from_env({}) is None
    account = Account.create()
    key = account.key.hex()
    loaded = load_account_from_env({"AGENT_PRIVATE_KEY": key})
    assert loaded is not None and loaded.address == account.address
    key_file = tmp_path / "agent.key"
    key_file.write_text(key + "\n")
    loaded = load_account_from_env({"AGENT_KEY_FILE": str(key_file)})
    assert loaded is not None and loaded.address == account.address


def test_build_authorization_window():
    req = select_requirement(CHALLENGE)
    auth = build_authorization("0x" + "11" * 20, req, now=1_000_000)
    assert auth["validAfter"] == "0"
    assert auth["validBefore"] == str(1_000_000 + 300)  # maxTimeoutSeconds
    assert auth["value"] == "20000"
    assert auth["to"] == PAY_TO
    assert auth["nonce"].startswith("0x") and len(auth["nonce"]) == 66
