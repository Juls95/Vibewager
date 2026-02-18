import { http, createConfig } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { injected, walletConnect } from "@wagmi/connectors";
import { CHAIN_ID, RPC_URL } from "./config";

const chain = {
  ...bscTestnet,
  id: CHAIN_ID,
  rpcUrls: { default: { http: [RPC_URL] } },
};

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo";

export const config = createConfig({
  chains: [chain],
  connectors: [
    injected(),
    walletConnect({ projectId, showQrModal: true }),
  ],
  transports: {
    [chain.id]: http(RPC_URL),
  },
});
