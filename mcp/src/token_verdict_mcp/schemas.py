"""JSON Schemas for POST /v1/verdict — copied verbatim from the Token
Verdict service's own discovery module (app/discovery.py in
QuincyGB/token-verdict), which the service's test suite pins against the
real engine output. Keep these in sync with the service, never fork them.
"""

VERDICT_INPUT_SCHEMA = {
    "type": "object",
    "required": ["address"],
    "properties": {
        "address": {
            "type": "string",
            "description": "Token contract address (0x...)",
        },
        "chain": {
            "type": "string",
            "enum": ["base", "ethereum", "solana"],
            "default": "base",
            "description": "Chain label: base | ethereum | solana",
        },
    },
}

VERDICT_OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["token", "verdict", "score", "signals", "take", "market"],
    "properties": {
        "token": {
            "type": "object",
            "required": ["address", "symbol", "name", "chain"],
            "properties": {
                "address": {"type": "string"},
                "symbol": {"type": "string"},
                "name": {"type": "string"},
                "chain": {"type": "string"},
            },
        },
        "verdict": {"type": "string", "enum": ["SOLID", "CAUTION", "DANGER"]},
        "score": {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "description": "Risk score: 0 (safest) to 100 (riskiest)",
        },
        "signals": {
            "type": "array",
            "minItems": 6,
            "maxItems": 6,
            "items": {
                "type": "object",
                "required": ["name", "score", "weight", "detail"],
                "properties": {
                    "name": {"type": "string"},
                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                    "weight": {"type": "number"},
                    "detail": {"type": "string"},
                },
            },
        },
        "take": {"type": "string", "description": "Written analyst summary"},
        "market": {
            "type": "object",
            "required": [
                "price_usd",
                "liquidity_usd",
                "volume_24h_usd",
                "price_change_24h_pct",
                "txns_24h",
                "dex",
                "pair_url",
            ],
            "properties": {
                "price_usd": {"type": ["string", "null"]},
                "liquidity_usd": {"type": ["number", "null"]},
                "volume_24h_usd": {"type": ["number", "null"]},
                "price_change_24h_pct": {"type": ["number", "null"]},
                "txns_24h": {
                    "type": "object",
                    "properties": {
                        "buys": {"type": "integer"},
                        "sells": {"type": "integer"},
                    },
                },
                "dex": {"type": ["string", "null"]},
                "pair_url": {"type": ["string", "null"]},
            },
        },
    },
}
