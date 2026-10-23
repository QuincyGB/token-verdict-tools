import { describe, expect, it } from "vitest";
import { TokenVerdictSchema } from "../src/schemas";

const TOKEN = "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b";

describe("TokenVerdictSchema (mirrors POST /v1/verdict)", () => {
  it("accepts a bare address and defaults chain to base", () => {
    const parsed = TokenVerdictSchema.parse({ address: TOKEN });
    expect(parsed.address).toBe(TOKEN);
    expect(parsed.chain).toBe("base");
  });

  it("accepts every chain label the service accepts", () => {
    for (const chain of ["base", "ethereum", "solana"] as const) {
      expect(TokenVerdictSchema.parse({ address: TOKEN, chain }).chain).toBe(chain);
    }
  });

  it("rejects malformed addresses", () => {
    for (const address of [
      "0x123", // too short
      "2821d96B5FC81aEC3763340b375a846a89A3Ec1b", // missing 0x
      "0xZZ21d96B5FC81aEC3763340b375a846a89A3Ec1b", // non-hex
      "",
    ]) {
      expect(() => TokenVerdictSchema.parse({ address })).toThrow();
    }
  });

  it("rejects unknown chain labels and a missing address", () => {
    expect(() => TokenVerdictSchema.parse({ address: TOKEN, chain: "bitcoin" })).toThrow();
    expect(() => TokenVerdictSchema.parse({})).toThrow();
    expect(() => TokenVerdictSchema.parse({ chain: "base" })).toThrow();
  });
});
