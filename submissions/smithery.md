# Smithery (smithery.ai)

Status: **PREPARED-BLOCKED** — account gate.

## Verified current process (from Smithery's own docs, 2026-10-23)

- Publishing is done via Smithery's API/dashboard using a Smithery account: the official API reference (`smithery.ai/docs/api-reference/servers/publish-a-server`) shows releases are submitted with the `@smithery/api` client authenticated by a **`SMITHERY_API_KEY`**.
- Release types: hosted (JS module upload), external (URL), and **stdio (MCPB bundle upload)**. Token Verdict's MCP server is a Python stdio server, so its Smithery release type is the stdio/MCPB one.
- No `SMITHERY_API_KEY` exists on this machine and no Smithery account is signed in — per the account rule, this stops here.

## Owner click-path

1. Go to https://smithery.ai and **Sign in** (GitHub) — create the account under your own identity.
2. Create/select your namespace, then open account **Settings → API Keys** and create an API key.
3. Either:
   - use the dashboard's server creation/deploy flow for a stdio (MCPB) release, using the copy in [`listing-copy.md`](listing-copy.md), or
   - hand the API key to the agent machine (as the `SMITHERY_API_KEY` env var) and the release can be submitted programmatically with the payload prepared from `listing-copy.md`.

## Listing copy

Use [`listing-copy.md`](listing-copy.md) verbatim (name, one-line description, install/config blocks, env-var table).
