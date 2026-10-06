import "react-native-get-random-values";
import "@walletconnect/react-native-compat";
import React, { useMemo } from "react";
import Constants from "expo-constants";
import { AppKitProvider, createAppKit, useAccount, useAppKit, useProvider } from "@reown/appkit-react-native";
import { EthersAdapter } from "@reown/appkit-ethers-react-native";
import { serializeWalletTypedData, WalletContext, type EvmTransaction, type WalletContextValue } from "./WalletContext";

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID || "";
const configuredScheme = Constants.expoConfig?.scheme;
const appScheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme || "wolvapp";
const appUrl = process.env.EXPO_PUBLIC_APP_URL || "https://wolvapp.vercel.app";
const bsc = {
  id: 56,
  name: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.EXPO_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org"] } },
  blockExplorers: { default: { name: "BscScan", url: "https://bscscan.com" } },
  chainNamespace: "eip155",
  caipNetworkId: "eip155:56",
} as any;

const appKit = projectId
  ? createAppKit({
      projectId,
      metadata: {
        name: "WOLV",
        description: "Tokenized stock market data and user-signed BSC spot execution",
        url: appUrl,
        icons: [],
        redirect: { native: `${appScheme}://`, universal: appUrl },
      },
      networks: [bsc],
      adapters: [new EthersAdapter()],
      enableAnalytics: false,
    } as any)
  : null;

function parseChainId(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const parsed = value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function transactionHex(value: string | number | undefined) {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "string" && value.startsWith("0x")) return value;
  try { return `0x${BigInt(value).toString(16)}`; } catch { return undefined; }
}

function ConnectedWalletProvider({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  const { provider } = useProvider();
  const modal = useAppKit();
  const chainId = parseChainId(account.chainId);
  const address = account.address || null;
  const value = useMemo<WalletContextValue>(() => ({
    address,
    chainId,
    isConnected: Boolean(account.isConnected && address),
    connector: "Reown / WalletConnect",
    projectIdConfigured: true,
    connect: async () => { await modal.open({ view: "Connect" }); },
    disconnect: async () => { await modal.disconnect(); },
    switchToBsc: async () => { await modal.switchNetwork("eip155:56"); },
    sendTransaction: async (transaction: EvmTransaction) => {
      if (!address || chainId !== 56) throw new Error("Connect a wallet on BNB Smart Chain before signing.");
      const rpc = provider as any;
      if (!rpc?.request) throw new Error("The connected wallet does not expose an EVM request provider.");
      const tx = {
        from: address,
        to: transaction.to,
        ...(transaction.data ? { data: transaction.data } : {}),
        ...(transactionHex(transaction.value) ? { value: transactionHex(transaction.value) } : {}),
        ...(transactionHex(transaction.gas) ? { gas: transactionHex(transaction.gas) } : {}),
        ...(transactionHex(transaction.gasPrice) ? { gasPrice: transactionHex(transaction.gasPrice) } : {}),
        ...(transactionHex(transaction.maxFeePerGas) ? { maxFeePerGas: transactionHex(transaction.maxFeePerGas) } : {}),
        ...(transactionHex(transaction.maxPriorityFeePerGas) ? { maxPriorityFeePerGas: transactionHex(transaction.maxPriorityFeePerGas) } : {}),
      };
      return String(await rpc.request({ method: "eth_sendTransaction", params: [tx] }));
    },
    signTypedData: async (typedData: any) => {
      if (!address || chainId !== 56) throw new Error("Connect a wallet on BNB Smart Chain before signing.");
      const rpc = provider as any;
      if (!rpc?.request) throw new Error("The connected wallet does not expose EIP-712 signing.");
      return String(await rpc.request({ method: "eth_signTypedData_v4", params: [address, serializeWalletTypedData(typedData)] }));
    },
    waitForTransaction: async (hash: string, timeoutMs = 90000) => {
      const rpc = provider as any;
      if (!rpc?.request) return "pending";
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const receipt = await rpc.request({ method: "eth_getTransactionReceipt", params: [hash] });
        if (receipt) return receipt.status === "0x0" ? "reverted" : "success";
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      return "pending";
    },
  }), [account.isConnected, address, chainId, modal, provider]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  if (!appKit) {
    const unavailable: WalletContextValue = {
      address: null, chainId: null, isConnected: false, connector: null, projectIdConfigured: false,
      connect: async () => { throw new Error("Set EXPO_PUBLIC_REOWN_PROJECT_ID in the native build environment to enable WalletConnect."); },
      disconnect: async () => {},
      switchToBsc: async () => { throw new Error("WalletConnect is not configured."); },
      sendTransaction: async (_transaction: EvmTransaction) => { throw new Error("WalletConnect is not configured."); },
      signTypedData: async () => { throw new Error("WalletConnect is not configured."); },
      waitForTransaction: async () => "pending",
    };
    return <WalletContext.Provider value={unavailable}>{children}</WalletContext.Provider>;
  }
  return <AppKitProvider instance={appKit}><ConnectedWalletProvider>{children}</ConnectedWalletProvider></AppKitProvider>;
}
