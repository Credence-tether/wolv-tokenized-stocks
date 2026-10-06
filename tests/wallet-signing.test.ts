import { describe, expect, it } from "vitest";
import { serializeWalletTypedData } from "../lib/wallet/WalletContext";

describe("wallet EIP-712 payload safety", () => {
  it("serializes typed-data objects for eth_signTypedData_v4", () => {
    const payload = { domain: { chainId: 56 }, types: { Order: [{ name: "nonce", type: "uint256" }] }, primaryType: "Order", message: { nonce: "1" } };
    expect(JSON.parse(serializeWalletTypedData(payload))).toEqual(payload);
  });

  it("accepts a JSON-encoded EIP-712 object returned by an API", () => {
    const payload = JSON.stringify({ domain: { chainId: 56 }, types: { Order: [] }, primaryType: "Order", message: {} });
    expect(JSON.parse(serializeWalletTypedData(payload))).toEqual(JSON.parse(payload));
  });

  it("refuses opaque bytes and non-object payloads without asking the wallet to sign", () => {
    expect(() => serializeWalletTypedData("0x1901deadbeef")).toThrow(/No signature was requested/);
    expect(() => serializeWalletTypedData("\"not a typed-data object\"")).toThrow(/EIP-712 typed-data object/);
    expect(() => serializeWalletTypedData(null)).toThrow(/EIP-712 typed-data object/);
  });
});
