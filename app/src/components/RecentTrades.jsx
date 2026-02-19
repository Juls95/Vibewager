import { useState, useEffect, useMemo, useCallback } from "react";
import { usePublicClient, useReadContracts, useReadContract } from "wagmi";
import { parseAbiItem, formatEther } from "viem";
import { formatDistanceToNow } from "date-fns";
import { PANCAKE_ROUTER, WBNB, BSCSCAN_TESTNET, isZeroAddress } from "../config";

const ROUTER_FACTORY_ABI = [
  {
    inputs: [],
    name: "factory",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

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
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
);

function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function RecentTrades({ market }) {
  const yesToken = market?.yesToken;
  const noToken = market?.noToken;

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const publicClient = usePublicClient();

  const { data: factoryAddress } = useReadContract({
    address: PANCAKE_ROUTER,
    abi: ROUTER_FACTORY_ABI,
    functionName: "factory",
  });

  const pairReads = useMemo(
    () =>
      yesToken && noToken && factoryAddress
        ? [
            {
              address: factoryAddress,
              abi: FACTORY_ABI,
              functionName: "getPair",
              args: [yesToken, WBNB],
            },
            {
              address: factoryAddress,
              abi: FACTORY_ABI,
              functionName: "getPair",
              args: [noToken, WBNB],
            },
          ]
        : [],
    [yesToken, noToken, factoryAddress]
  );

  const { data: pairResults } = useReadContracts({ contracts: pairReads });
  const yesPair =
    pairResults?.[0]?.status === "success" && pairResults[0].result
      ? pairResults[0].result
      : null;
  const noPair =
    pairResults?.[1]?.status === "success" && pairResults[1].result
      ? pairResults[1].result
      : null;

  const token0Reads = useMemo(() => {
    const out = [];
    if (yesPair && !isZeroAddress(yesPair)) {
      out.push({ address: yesPair, abi: PAIR_ABI, functionName: "token0" });
    }
    if (noPair && !isZeroAddress(noPair)) {
      out.push({ address: noPair, abi: PAIR_ABI, functionName: "token0" });
    }
    return out;
  }, [yesPair, noPair]);

  const { data: token0Results } = useReadContracts({ contracts: token0Reads });
  const yesToken0 =
    token0Reads.length >= 1 && token0Results?.[0]?.status === "success"
      ? token0Results[0].result
      : null;
  const noToken0 =
    token0Reads.length >= 2 && token0Results?.[1]?.status === "success"
      ? token0Results[1].result
      : null;

  const hasPairs =
    yesPair &&
    noPair &&
    !isZeroAddress(yesPair) &&
    !isZeroAddress(noPair);

  const fetchTrades = useCallback(async () => {
      if (!publicClient || !hasPairs || yesToken0 == null || noToken0 == null) {
        setLoading(false);
        setError("No pairs available");
        return;
      }

      try {
        setError(null);
        const wbnbLower = String(WBNB).toLowerCase();

        const [yesLogs, noLogs] = await Promise.all([
          publicClient.getLogs({
            address: yesPair,
            event: SWAP_EVENT,
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: noPair,
            event: SWAP_EVENT,
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ]);

        const parseSwap = (log, pairType, token0Addr) => {
          const { args, blockNumber } = log;
          const token0Lower = String(token0Addr).toLowerCase();
          const isWBNBToken0 = token0Lower === wbnbLower;

          let side = null;
          let action = null;
          let tokenAmount = 0n;
          let bnbAmount = 0n;

          if (isWBNBToken0) {
            if (args.amount0In > 0n && args.amount1Out > 0n) {
              side = pairType === "yes" ? "Yes" : "No";
              action = "bought";
              tokenAmount = args.amount1Out;
              bnbAmount = args.amount0In;
            } else if (args.amount1In > 0n && args.amount0Out > 0n) {
              side = pairType === "yes" ? "Yes" : "No";
              action = "sold";
              tokenAmount = args.amount1In;
              bnbAmount = args.amount0Out;
            }
          } else {
            if (args.amount1In > 0n && args.amount0Out > 0n) {
              side = pairType === "yes" ? "Yes" : "No";
              action = "bought";
              tokenAmount = args.amount0Out;
              bnbAmount = args.amount1In;
            } else if (args.amount0In > 0n && args.amount1Out > 0n) {
              side = pairType === "yes" ? "Yes" : "No";
              action = "sold";
              tokenAmount = args.amount0In;
              bnbAmount = args.amount1Out;
            }
          }

          if (!side || !action) return null;

          const user = args.to || args.sender;
          return {
            user: String(user).toLowerCase(),
            side,
            action,
            tokenAmount: formatEther(tokenAmount),
            bnbAmount: formatEther(bnbAmount),
            blockNumber: Number(blockNumber),
          };
        };

        const yesParsed = yesLogs.map((log) => parseSwap(log, "yes", yesToken0));
        const noParsed = noLogs.map((log) => parseSwap(log, "no", noToken0));

        const allRaw = [...yesParsed, ...noParsed].filter(Boolean);

        const uniqueBlocks = [...new Set(allRaw.map((t) => t.blockNumber))];
        const blocks = await Promise.all(
          uniqueBlocks.map((bn) => publicClient.getBlock({ blockNumber: BigInt(bn) }))
        );
        const blockMap = new Map(
          blocks.map((b) => [Number(b.number), Number(b.timestamp) * 1000])
        );

        const all = allRaw
          .map((t) => ({
            ...t,
            timestamp: blockMap.get(t.blockNumber) || Date.now(),
          }))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);

        setTrades(all);
        setLoading(false);
      } catch (e) {
        setError("No trades yet");
        setTrades([]);
        setLoading(false);
      }
  }, [publicClient, hasPairs, yesPair, noPair, yesToken0, noToken0, yesToken, noToken]);

  const bothPairsLoaded =
    pairReads.length === 2 &&
    pairResults?.length === 2 &&
    pairResults.every((r) => r.status === "success" || r.status === "error");

  useEffect(() => {
    if (!yesToken || !noToken) {
      setLoading(false);
      setError("No market");
      return;
    }
    if (!factoryAddress) {
      return;
    }
    if (!bothPairsLoaded) {
      return;
    }

    const r0 = pairResults[0]?.result;
    const r1 = pairResults[1]?.result;
    if (isZeroAddress(r0) || isZeroAddress(r1)) {
      setLoading(false);
      setError("No pairs available");
      return;
    }

    if (yesToken0 == null || noToken0 == null) {
      return;
    }

    setLoading(true);
    setError(null);
    fetchTrades();

    const interval = setInterval(() => {
      fetchTrades();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchTrades, hasPairs, yesToken0, noToken0, bothPairsLoaded, factoryAddress, yesToken, noToken, pairResults]);

  if (loading) {
    return (
      <div className="recent-trades-wrap">
        <div className="recent-trades-header">
          <h3 className="recent-trades-title">Recent Trades</h3>
          <span className="chart-spinner" style={{ width: "16px", height: "16px" }} />
        </div>
        <p className="hint" style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (error && trades.length === 0) {
    return (
      <div className="recent-trades-wrap">
        <h3 className="recent-trades-title">Recent Trades</h3>
        <p className="hint" style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="recent-trades-wrap">
      <div className="recent-trades-header">
        <h3 className="recent-trades-title">Recent Trades</h3>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={fetchTrades}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
        >
          Refresh
        </button>
      </div>
      {trades.length === 0 ? (
        <p className="hint" style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}>
          No trades yet
        </p>
      ) : (
        <ul className="recent-trades-list">
          {trades.map((trade, i) => (
            <li key={`${trade.blockNumber}-${i}`} className="recent-trade-item">
              <div className="recent-trade-main">
                <a
                  href={`${BSCSCAN_TESTNET}/address/${trade.user}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="recent-trade-user"
                >
                  {shortenAddress(trade.user)}
                </a>
                <span className="recent-trade-action">
                  {trade.action} {trade.side}
                </span>
                <span className="recent-trade-amount">
                  {Number(trade.tokenAmount).toFixed(2)} {trade.side} for{" "}
                  {Number(trade.bnbAmount).toFixed(4)} BNB
                </span>
              </div>
              <div className="recent-trade-time">
                {formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
