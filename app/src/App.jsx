import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { MarketList } from "./components/MarketList";
import { BetSwap } from "./components/BetSwap";
import { AdminPanel } from "./components/AdminPanel";
import { VIBEWAGER_ADDRESS } from "./config";
import { VIBEWAGER_ABI } from "./abi/vibeWagerMarket";
import { useState } from "react";
import "./App.css";

function App() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [marketListRefresh, setMarketListRefresh] = useState(0);

  // Support both number and string chain id (e.g. 97 or "97")
  const isCorrectChain = Number(chain?.id) === 97;

  const closeAdmin = () => {
    setShowAdmin(false);
    setMarketListRefresh((n) => n + 1); // Refetch market list so new markets appear
  };

  // Check if connected address is owner (read from contract)
  const {
    data: ownerAddress,
    isPending: ownerLoading,
    error: ownerError,
  } = useReadContract({
    address: VIBEWAGER_ADDRESS,
    abi: VIBEWAGER_ABI,
    functionName: "owner",
    query: {
      enabled: isConnected,
    },
  });

  // Normalize addresses for comparison (contract returns checksummed; wallet may vary)
  const norm = (a) => String(a ?? "").toLowerCase().replace(/^0x/, "").padStart(40, "0").slice(-40);
  const ownerStr = norm(ownerAddress);
  const addressStr = norm(address);
  const isOwner = ownerStr.length === 40 && addressStr.length === 40 && ownerStr === addressStr;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo">VibeWager</h1>
          <p className="tagline">Prediction markets on BNB Testnet</p>
          <div className="wallet-row">
            {!isConnected ? (
              <div className="connect-buttons">
                {connectors.map((c) => (
                  <button
                    key={c.uid}
                    className="btn btn-primary"
                    onClick={() => connect({ connector: c })}
                    disabled={isPending}
                  >
                    {isPending ? "Connecting…" : c.name === "Injected" ? "MetaMask" : "WalletConnect"}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <span className="chain-badge">
                  {isCorrectChain ? "BNB Testnet" : "Wrong network"}
                </span>
                <span className="address">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                <button type="button" className={`admin-btn btn ${isOwner ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowAdmin(true)}>
                  Admin
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => disconnect()}>
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        {!isConnected ? (
          <div className="main-card">
            <p className="hint-block">Connect a wallet to view markets and bet.</p>
          </div>
        ) : !isCorrectChain ? (
          <div className="main-card">
            <p className="hint-block">Switch to BNB Testnet (chain 97) in your wallet.</p>
          </div>
        ) : showAdmin ? (
          <AdminPanel onClose={closeAdmin} />
        ) : (
          <div className="main-card">
            {isConnected && isCorrectChain && (
              <p className="owner-status" title="Contract owner from chain vs your address">
                Contract owner: {ownerLoading ? "…" : ownerError ? "Error" : ownerStr ? `0x${ownerStr.slice(0, 8)}…` : "—"} · You: {addressStr ? `0x${addressStr.slice(0, 8)}…` : "—"} · {ownerLoading ? "Checking…" : isOwner ? "You are owner ✓" : "Not owner"}
              </p>
            )}
            {!isOwner && isConnected && isCorrectChain && !ownerLoading && (
              <p className="hint-block" style={{ marginBottom: "1rem" }}>
                Only the contract owner can create markets. Use Admin to create if you are the owner.
              </p>
            )}
            <MarketList onSelectMarket={setSelectedMarket} refreshTrigger={marketListRefresh} />
            {selectedMarket && (
              <BetSwap
                market={selectedMarket}
                onClose={() => setSelectedMarket(null)}
              />
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <a href="https://testnet.bnbchain.org/faucet-smart" target="_blank" rel="noopener noreferrer">
          Get testnet BNB
        </a>
        <span> · </span>
        <a
          href={`https://testnet.bscscan.com/address/${import.meta.env.VITE_CONTRACT_ADDRESS || "0x4760e21a40F8F3B2bC7965124B57736C97bcCAC5"}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Contract on BscScan
        </a>
      </footer>
    </div>
  );
}

export default App;
