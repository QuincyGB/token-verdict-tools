# Glama (glama.ai)

Status: **PREPARED-BLOCKED** — owner sign-in needed to claim/admin; indexing itself is automatic.

## Verified current process (2026-10-23)

- Glama indexes MCP servers from public GitHub repositories automatically ("Glama indexes every MCP server in the ecosystem"), and also ingests the Official MCP Registry. No manual submission form is required for a listing to appear; the repo `QuincyGB/token-verdict-tools` was created 2026-10-23, so its crawl may lag by days. (Checked 2026-10-23: no Token Verdict listing found in Glama's index yet; Glama's data API now requires an API key, so absence was checked via web search of glama.ai.)
- Maintainers manage a listing through its **Admin** area (Glama's own advertising page references a listing's "Admin → Advertising" page), which requires being signed in as the owner.
- The `server.json` now committed at the repo root is the standard manifest Glama and other directories read.

## Owner click-path

1. Go to https://glama.ai and **Sign in with GitHub** (the `QuincyGB` account that owns the repo).
2. Search Glama's MCP directory for "Token Verdict" (or open the servers list under your account) and open the listing for `QuincyGB/token-verdict-tools`.
3. Use the listing's **Claim / Admin** action to claim it, then confirm the description and install config match [`listing-copy.md`](listing-copy.md).

If no listing exists after ~a week, publishing to the Official MCP Registry (see [`pypi-and-npm.md`](pypi-and-npm.md)) is the reliable trigger, since Glama ingests the registry.
