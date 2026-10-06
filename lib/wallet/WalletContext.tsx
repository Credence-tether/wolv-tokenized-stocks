import { createContext, useContext } from "react";

export type EvmTransaction = {
  from?: string;
  to: string;
  data?: string;
  value?: string | number;
  gas?: string | number;
  gasPrice?: string | number;
  maxFeePerGas?: string | number;
  maxPriorityFeePerGas?: string | number;
};

export type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  connector: string | null;
  projectIdConfigured: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToBsc: () => Promise<void>;
  sendTransaction: (transaction: EvmTransaction) => Promise<string>;
  signTypedData: (typedData: unknown) => Promise<string>;
  waitForTransaction: (hash: string, timeoutMs?: number) => Promise<"success" | "reverted" | "pending">;
};

export function serializeWalletTypedData(typedData: unknown) {
  if (typeof typedData === "string") {
    let parsed: unknown;
    try { parsed = JSON.parse(typedData); } catch {
      throw new Error("The RFQ response did not include JSON EIP-712 data that a wallet can safely sign. No signature was requested.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("The RFQ response did not include an EIP-712 typed-data object. No signature was requested.");
    }
    return JSON.stringify(parsed);
  }
  if (!typedData || typeof typedData !== "object" || Array.isArray(typedData)) {
    throw new Error("The RFQ response did not include an EIP-712 typed-data object. No signature was requested.");
  }
  return JSON.stringify(typedData);
}

export const WalletContext = createContext<WalletContextValue>({
  address: null,
  chainId: null,
  isConnected: false,
  connector: null,
  projectIdConfigured: false,
  connect: async () => { throw new Error("Wallet connection is unavailable."); },
  disconnect: async () => {},
  switchToBsc: async () => { throw new Error("Wallet network switching is unavailable."); },
  sendTransaction: async () => { throw new Error("Wallet transaction signing is unavailable."); },
  signTypedData: async () => { throw new Error("Wallet typed-data signing is unavailable."); },
  waitForTransaction: async () => "pending",
});

export function useWallet() {
  return useContext(WalletContext);
}
