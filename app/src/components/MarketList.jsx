import { useReadContract, useReadContracts } from "wagmi";
import { useMemo } from "react";
import { VIBEWAGER_ADDRESS } from "../config";
import { VIBEWAGER_ABI } from "../abi/vibeWagerMarket";

export function MarketList({ onSelectMarket }) {
  const { data: countBig, isPending: countPending } = useReadContract({
    address: VIBEWAGER_ADDRESS,
    abi: VIBEWAGER_ABI,
    functionName: "marketCount",
  });

  const count = countBig != null ? Number(countBig) : 0;

  const readConfigs = useMemo(
    () =>
      count > 0
        ? Array.from({ length: count }, (_, i) => ({
            address: VIBEWAGER_ADDRESS,
            abi: VIBEWAGER_ABI,
            functionName: "getMarket",
            args: [BigInt(i + 1)],
          }))
        : [],
    [count]
  );

  const { data: results, isPending: marketsPending } = useReadContracts({
    contracts: readConfigs,
  });

  const markets = useMemo(() => {
    if (!results?.length) return [];
    return results.map((r, i) => {
      if (r.status !== "success" || !r.result) return null;
      const [yesToken, noToken, endTime, resolved, outcome] = r.result;
      return {
        id: i + 1,
        yesToken,
        noToken,
        endTime,
        resolved,
        outcome,
      };
    }).filter(Boolean);
  }, [results]);

  const isPending = countPending || marketsPending;

  if (isPending && markets.length === 0) {
    return <p className="loading">Loading markets…</p>;
  }

  if (count === 0) {
    return (
      <p className="hint">
        No markets yet. Use the interact script to create one (owner only).
      </p>
    );
  }

  return (
    <ul className="market-list">
      {markets.map((m) => (
        <li
          key={m.id}
          className={`market-card ${m.resolved ? "resolved" : ""}`}
          onClick={() => onSelectMarket(m)}
        >
          <div className="market-id">Market #{m.id}</div>
          <div>
            Yes: <code className="addr">{m.yesToken?.slice(0, 10)}…</code>
          </div>
          <div>
            No: <code className="addr">{m.noToken?.slice(0, 10)}…</code>
          </div>
          {m.resolved && (
            <div className="market-outcome">
              Winner: {m.outcome ? "Yes" : "No"}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
