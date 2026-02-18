import { useAccount, useConnect, useDisconnect } from "wagmi";
import { MarketList } from "./components/MarketList";
import { BetSwap } from "./components/BetSwap";
import { useState } from "react";
import "./App.css";

function App() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [selectedMarket, setSelectedMarket] = useState(null);

  const isCorrectChain = chain?.id === 97;

  return (
    <div className="app">
      <header className="header">
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
              <button className="btn btn-ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </header>

      <main className="main">
        {!isConnected ? (
          <p className="hint">Connect a wallet to view markets and bet.</p>
        ) : !isCorrectChain ? (
          <p className="hint">Switch to BNB Testnet (chain 97) in your wallet.</p>
        ) : (
          <>
            <MarketList onSelectMarket={setSelectedMarket} />
            {selectedMarket && (
              <BetSwap
                market={selectedMarket}
                onClose={() => setSelectedMarket(null)}
              />
            )}
          </>
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
