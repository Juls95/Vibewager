import { useState, useMemo, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from "wagmi";
import { parseEther, formatEther } from "viem";
import { PANCAKE_ROUTER, PANCAKE_FACTORY, WBNB } from "../config";
import { ROUTER_ABI } from "../abi/routerAbi";

function parseAmount(input) {
  const s = String(input ?? "").replace(/,/g, ".").trim();
  if (!s) return NaN;
  const n = Number(s);
  return Number.isNaN(n) ? NaN : n;
}

const FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ internalType: "address", name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

const PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { internalType: "uint112", name: "reserve0", type: "uint112" },
      { internalType: "uint112", name: "reserve1", type: "uint112" },
      { internalType: "uint32", name: "blockTimestampLast", type: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

function usePairLiquidity(yesToken, noToken) {
  const pairReads = useMemo(
    () =>
      yesToken && noToken
        ? [
            { address: PANCAKE_FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [yesToken, WBNB] },
            { address: PANCAKE_FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [noToken, WBNB] },
          ]
        : [],
    [yesToken, noToken]
  );
  const { data: pairResults } = useReadContracts({ contracts: pairReads });
  const yesPair = pairResults?.[0]?.status === "success" && pairResults[0].result ? pairResults[0].result : null;
  const noPair = pairResults?.[1]?.status === "success" && pairResults[1].result ? pairResults[1].result : null;

  const reserveReads = useMemo(() => {
    const out = [];
    if (yesPair && yesPair !== "0x0000000000000000000000000000000000000000") {
      out.push(
        { address: yesPair, abi: PAIR_ABI, functionName: "getReserves" },
        { address: yesPair, abi: PAIR_ABI, functionName: "token0" },
        { address: yesPair, abi: PAIR_ABI, functionName: "token1" }
      );
    }
    if (noPair && noPair !== "0x0000000000000000000000000000000000000000") {
      out.push(
        { address: noPair, abi: PAIR_ABI, functionName: "getReserves" },
        { address: noPair, abi: PAIR_ABI, functionName: "token0" },
        { address: noPair, abi: PAIR_ABI, functionName: "token1" }
      );
    }
    return out;
  }, [yesPair, noPair]);

  const { data: reserveResults } = useReadContracts({ contracts: reserveReads });
  const liquidity = useMemo(() => {
    if (!reserveResults?.length) return { yes: null, no: null };
    const fmt = (r) => (r != null ? formatEther(BigInt(r)) : "0");
    const yesHasPair = yesPair && yesPair !== "0x0000000000000000000000000000000000000000";
    const noHasPair = noPair && noPair !== "0x0000000000000000000000000000000000000000";
    const parseReserves = (baseIdx) => {
      if (
        reserveResults[baseIdx]?.status !== "success" ||
        reserveResults[baseIdx + 1]?.status !== "success" ||
        reserveResults[baseIdx + 2]?.status !== "success"
      )
        return null;
      const res = reserveResults[baseIdx].result;
      const r0 = res?.reserve0 ?? res?.[0];
      const r1 = res?.reserve1 ?? res?.[1];
      const t0 = reserveResults[baseIdx + 1].result;
      const wbnbReserve = String(t0).toLowerCase() === WBNB.toLowerCase() ? r0 : r1;
      const tokenReserve = String(t0).toLowerCase() === WBNB.toLowerCase() ? r1 : r0;
      return { wbnb: fmt(wbnbReserve), tokens: fmt(tokenReserve) };
    };
    let idx = 0;
    const yes = yesHasPair ? parseReserves(idx) : null;
    if (yesHasPair) idx += 3;
    const no = noHasPair ? parseReserves(idx) : null;
    return { yes, no };
  }, [reserveResults, yesPair, noPair]);

  return liquidity;
}

export function BetSwap({ market, onClose }) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const {
    writeContract,
    reset: resetWrite,
    data: hash,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  // Clear any stuck pending state when opening this modal
  useEffect(() => {
    if (market) resetWrite();
  }, [market?.id, resetWrite]);

  const { isPending: isConfirming } = useWaitForTransactionReceipt({ hash });
  // Only treat as "pending" when we actually have a tx hash (user submitted and we're waiting).
  // This avoids buttons staying disabled when wagmi reports a stuck isPending with no real tx.
  const reallyPending = Boolean(hash) && (isWritePending || isConfirming);

  const numAmount = parseAmount(amount);
  const validAmount = !Number.isNaN(numAmount) && numAmount > 0;
  const isResolved = Boolean(market?.resolved);
  const disabled = !address || reallyPending || !validAmount || isResolved;

  const whyDisabled = !address
    ? "Wallet address not available."
    : reallyPending
      ? "Confirm transaction in your wallet…"
      : isResolved
        ? "This market is resolved."
        : !validAmount
          ? "Enter a positive BNB amount (e.g. 0.01)."
          : null;

  const liquidity = usePairLiquidity(market?.yesToken, market?.noToken);

  const buy = (yesSide) => {
    const normalized = String(amount ?? "").replace(/,/g, ".").trim() || "0";
    const value = parseEther(normalized);
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
      {isResolved && (
        <p className="hint error-block" style={{ marginTop: 0 }}>
          This market is resolved. Betting is closed.
        </p>
      )}
      <p className="hint" style={{ marginTop: 0 }}>
        Swap testnet BNB for Yes or No tokens. Add liquidity via Admin when creating the market or via the script.
      </p>
      {liquidity.yes != null || liquidity.no != null ? (
        <div className="liquidity-block">
          <strong>Pool liquidity</strong>
          {liquidity.yes != null && (
            <div>Yes: {liquidity.yes.wbnb} WBNB, {liquidity.yes.tokens} YES</div>
          )}
          {liquidity.no != null && (
            <div>No: {liquidity.no.wbnb} WBNB, {liquidity.no.tokens} NO</div>
          )}
        </div>
      ) : (
        <p className="hint liquidity-none">No liquidity in pools yet. Add liquidity via Admin or script.</p>
      )}
      <div className="bet-form">
        <input
          type="text"
          inputMode="decimal"
          placeholder="BNB amount (e.g. 0.01)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {whyDisabled && (
          <p className="hint why-disabled" role="status">
            {whyDisabled}
          </p>
        )}
        <div className="bet-buttons">
          <button
            type="button"
            className="btn bet-yes"
            disabled={disabled}
            onClick={() => buy(true)}
          >
            Buy Yes
          </button>
          <button
            type="button"
            className="btn bet-no"
            disabled={disabled}
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
