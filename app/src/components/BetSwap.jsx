import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { PANCAKE_ROUTER, WBNB } from "../config";
import { ROUTER_ABI } from "../abi/router";

export function BetSwap({ market, onClose }) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const { isPending: isConfirming } = useWaitForTransactionReceipt({ hash });

  const isPending = isWritePending || isConfirming;

  const buy = (yesSide) => {
    const value = parseEther(amount || "0");
    if (value <= 0n) return;
    const path = [WBNB, yesSide ? market.yesToken : market.noToken];
    writeContract({
      address: PANCAKE_ROUTER,
      abi: ROUTER_ABI,
      functionName: "swapExactETHForTokens",
      args: [0n, path, address, BigInt(Math.floor(Date.now() / 1000) + 1200)],
      value,
    });
  };

  return (
    <div className="bet-panel">
      <div className="close-row">
        <h2>Bet on market #{market.id}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Swap testnet BNB for Yes or No tokens. Ensure the pool has liquidity (add via script).
      </p>
      <div className="bet-form">
        <input
          type="text"
          inputMode="decimal"
          placeholder="BNB amount (e.g. 0.01)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="bet-buttons">
          <button
            type="button"
            className="btn bet-yes"
            disabled={isPending || !amount || market.resolved}
            onClick={() => buy(true)}
          >
            Buy Yes
          </button>
          <button
            type="button"
            className="btn bet-no"
            disabled={isPending || !amount || market.resolved}
            onClick={() => buy(false)}
          >
            Buy No
          </button>
        </div>
        {writeError && <p className="error">{writeError.message}</p>}
        {hash && (
          <p className="hint">
            Tx:{" "}
            <a
              href={`https://testnet.bscscan.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {hash.slice(0, 10)}…
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
