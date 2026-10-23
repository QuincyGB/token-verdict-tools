// pay-once.mjs — generic ONE-SHOT x402 paid call (Base, exact scheme).
// Usage: node pay-once.mjs <url> <jsonBody> <capUSD e.g. 0.05>
// Signer key read from ~/.evm-wallet/key (never printed).
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const [url, bodyJson, cap] = process.argv.slice(2);
if (!url || !bodyJson || !cap) { console.error("usage: node pay-once.mjs <url> <jsonBody> <capUSD>"); process.exit(1); }

let key = readFileSync(process.env.HOME + "/.evm-wallet/key", "utf8").trim();
if (!key.startsWith("0x")) key = "0x" + key;
const account = privateKeyToAccount(key);
console.log("payer:", account.address);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  spendControls: { maxAmountPerPayment: `$${cap}` },
});

const res = await fetchWithPayment(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: bodyJson,
});
console.log("HTTP", res.status);
const text = await res.text();
console.log(text.slice(0, 3000));
const receipt = res.headers.get("PAYMENT-RESPONSE");
if (receipt) {
  try {
    const d = JSON.parse(Buffer.from(receipt, "base64").toString("utf8"));
    console.log("SETTLEMENT:", JSON.stringify(d));
  } catch { console.log("PAYMENT-RESPONSE header present (undecodable)"); }
} else {
  console.log("NO PAYMENT-RESPONSE HEADER");
}
