import React, { useCallback, useEffect, useMemo, useState } from "react";
import { serializeWalletTypedData, WalletContext, type EvmTransaction, type WalletContextValue } from "./WalletContext";

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<any>; on?: (event: string, cb: (...args: any[]) => void) => void; removeListener?: (event: string, cb: (...args: any[]) => void) => void };
const injected = () => (globalThis as any).ethereum as Eip1193 | undefined;
const chainNumber = (chain: unknown) => typeof chain === "string" ? Number.parseInt(chain, chain.startsWith("0x") ? 16 : 10) : typeof chain === "number" ? chain : null;
const asHex = (v: string | number | undefined) => {
  if (v === undefined || v === "") return undefined;
  if (typeof v === "string" && v.startsWith("0x")) return v;
  try { return `0x${BigInt(v).toString(16)}`; } catch { return undefined; }
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const provider = injected();
    if (!provider) return;
    try {
      const accounts = await provider.request({ method: "eth_accounts" });
      const chain = await provider.request({ method: "eth_chainId" });
      setAddress(Array.isArray(accounts) && accounts[0] ? accounts[0] : null);
      setChainId(chainNumber(chain));
    } catch { /* no wallet response; remain disconnected */ }
  }, []);

  useEffect(() => {
    void refresh();
    const provider = injected();
    if (!provider?.on) return;
    const accountsChanged = (accounts: string[]) => setAddress(accounts?.[0] || null);
    const chainChanged = (chain: string) => setChainId(chainNumber(chain));
    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [refresh]);

  const value = useMemo<WalletContextValue>(() => ({
    address,
    chainId,
    isConnected: Boolean(address),
    connector: address ? "Injected EVM wallet" : null,
    projectIdConfigured: true,
    connect: async () => {
      const provider = injected();
      if (!provider) throw new Error("No browser wallet detected. Open this site in a BSC wallet browser or use the native WalletConnect app.");
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const chain = await provider.request({ method: "eth_chainId" });
      setAddress(Array.isArray(accounts) ? accounts[0] || null : null);
      setChainId(chainNumber(chain));
    },
    disconnect: async () => { setAddress(null); },
    switchToBsc: async () => {
      const provider = injected();
      if (!provider) throw new Error("No browser wallet detected.");
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
      } catch (switchError: any) {
        if (switchError?.code !== 4902) throw switchError;
        await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x38", chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: [process.env.EXPO_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org"], blockExplorerUrls: ["https://bscscan.com"] }] });
      }
      await refresh();
    },
    sendTransaction: async (transaction: EvmTransaction) => {
      const provider = injected();
      if (!provider || !address || chainId !== 56) throw new Error("Connect an injected wallet on BNB Smart Chain before signing.");
      const tx = { from: address, to: transaction.to, ...(transaction.data ? { data: transaction.data } : {}), ...(asHex(transaction.value) ? { value: asHex(transaction.value) } : {}), ...(asHex(transaction.gas) ? { gas: asHex(transaction.gas) } : {}), ...(asHex(transaction.gasPrice) ? { gasPrice: asHex(transaction.gasPrice) } : {}), ...(asHex(transaction.maxFeePerGas) ? { maxFeePerGas: asHex(transaction.maxFeePerGas) } : {}), ...(asHex(transaction.maxPriorityFeePerGas) ? { maxPriorityFeePerGas: asHex(transaction.maxPriorityFeePerGas) } : {}) };
      return String(await provider.request({ method: "eth_sendTransaction", params: [tx] }));
    },
    signTypedData: async (typedData: unknown) => {
      const provider = injected();
      if (!provider || !address || chainId !== 56) throw new Error("Connect an injected wallet on BNB Smart Chain before signing.");
      return String(await provider.request({ method: "eth_signTypedData_v4", params: [address, serializeWalletTypedData(typedData)] }));
    },
    waitForTransaction: async (hash: string, timeoutMs = 90000) => {
      const provider = injected();
      if (!provider) return "pending";
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] });
        if (receipt) return receipt.status === "0x0" ? "reverted" : "success";
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      return "pending";
    },
  }), [address, chainId, refresh]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
