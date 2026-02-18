import { useReadContract, useReadContracts } from "wagmi";
import { useMemo, useEffect } from "react";
import { VIBEWAGER_ADDRESS } from "../config";
import { VIBEWAGER_ABI } from "../abi/vibeWagerMarket";
import { ERC20_NAME_ABI } from "../abi/erc20Name";

export function MarketList({ onSelectMarket, refreshTrigger }) {
  const { data: countBig, isPending: countPending, refetch: refetchCount } = useReadContract({
    address: VIBEWAGER_ADDRESS,
    abi: VIBEWAGER_ABI,
    functionName: "marketCount",
  });

  // Refetch when parent signals (e.g. after closing admin panel)
  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0) {
      refetchCount();
    }
  }, [refreshTrigger, refetchCount]);

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

  const { data: results, isPending: marketsPending, refetch: refetchMarkets } = useReadContracts({
    contracts: readConfigs,
  });

  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0 && readConfigs.length > 0) {
      refetchMarkets();
    }
  }, [refreshTrigger, readConfigs.length, refetchMarkets]);

  const markets = useMemo(() => {
    if (!results?.length) return [];
    return results.map((r, i) => {
      if (r.status !== "success" || r.result == null) return null;
      const res = r.result;
      const yesToken = typeof res === "object" && "yesToken" in res ? res.yesToken : res[0];
      const noToken = typeof res === "object" && "noToken" in res ? res.noToken : res[1];
      const endTime = typeof res === "object" && "endTime" in res ? res.endTime : res[2];
      const resolved = typeof res === "object" && "resolved" in res ? res.resolved : res[3];
      const outcome = typeof res === "object" && "outcome" in res ? res.outcome : res[4];
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

  const nameReadConfigs = useMemo(
    () =>
      markets.map((m) => ({
        address: m.yesToken,
        abi: ERC20_NAME_ABI,
        functionName: "name",
      })),
    [markets]
  );

  const { data: nameResults } = useReadContracts({
    contracts: nameReadConfigs,
  });

  const marketNames = useMemo(() => {
    if (!nameResults?.length) return {};
    const out = {};
    nameResults.forEach((r, i) => {
      const name = r.status === "success" && typeof r.result === "string" ? r.result : null;
      const marketId = markets[i]?.id;
      if (marketId && name) {
        out[marketId] = name.startsWith("Yes: ") ? name.slice(5) : name;
      }
    });
    return out;
  }, [nameResults, markets]);

  const isPending = countPending || marketsPending;

  if (isPending && markets.length === 0) {
    return <p className="loading">Loading markets…</p>;
  }

  if (count === 0) {
    return (
      <div style={{ textAlign: "center" }}>
        <p className="hint-block">
          No markets yet. Create one via <strong>Admin</strong> (owner) or the interact script.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => { refetchCount(); refetchMarkets(); }} style={{ marginTop: "0.5rem" }}>
          Refresh
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="market-list-header">
        <button type="button" className="btn btn-ghost" onClick={() => { refetchCount(); refetchMarkets(); }} style={{ fontSize: "0.85rem" }}>
          Refresh list
        </button>
      </div>
      <ul className="market-list">
      {markets.map((m) => (
        <li
          key={m.id}
          className={`market-card ${m.resolved ? "resolved" : ""}`}
          onClick={() => onSelectMarket(m)}
        >
          <div className="market-id">
            Market #{m.id}
            {marketNames[m.id] ? ` · ${marketNames[m.id]}` : ""}
          </div>
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
    </>
  );
}
