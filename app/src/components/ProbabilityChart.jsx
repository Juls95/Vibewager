import { useState, useEffect, useMemo } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { parseAbiItem } from "viem";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PANCAKE_FACTORY, WBNB } from "../config";

/*
  Example chart data (mock when no events):
  [
    { date: 'Feb 14', probability: 50 },
    { date: 'Feb 15', probability: 50 },
    { date: 'Feb 16', probability: 52 },
    { date: 'Feb 17', probability: 48 },
    { date: 'Feb 18', probability: 55 },
  ]
*/

const BLOCKS_PER_DAY = Math.floor((24 * 60 * 60) / 3); // ~28800, BNB ~3s block time
const FIVE_DAYS_BLOCKS = 5 * BLOCKS_PER_DAY;

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

const SYNC_EVENT = parseAbiItem(
  "event Sync(uint112 reserve0, uint112 reserve1)"
);

function formatChartDate(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mockDataFiveDays() {
  const out = [];
  const now = Date.now() / 1000;
  for (let i = 4; i >= 0; i--) {
    const t = now - i * 24 * 3600;
    out.push({
      date: formatChartDate(Math.floor(t)),
      probability: 50,
    });
  }
  return out;
}

export function ProbabilityChart({ market }) {
  const yesToken = market?.yesToken;
  const noToken = market?.noToken;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const publicClient = usePublicClient();

  const pairReads = useMemo(
    () =>
      yesToken && noToken
        ? [
            {
              address: PANCAKE_FACTORY,
              abi: FACTORY_ABI,
              functionName: "getPair",
              args: [yesToken, WBNB],
            },
            {
              address: PANCAKE_FACTORY,
              abi: FACTORY_ABI,
              functionName: "getPair",
              args: [noToken, WBNB],
            },
          ]
        : [],
    [yesToken, noToken]
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
    if (yesPair && yesPair !== "0x0000000000000000000000000000000000000000") {
      out.push({ address: yesPair, abi: PAIR_ABI, functionName: "token0" });
    }
    if (noPair && noPair !== "0x0000000000000000000000000000000000000000") {
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
    yesPair !== "0x0000000000000000000000000000000000000000" &&
    noPair !== "0x0000000000000000000000000000000000000000";

  useEffect(() => {
    if (!publicClient || !hasPairs || yesToken0 == null || noToken0 == null) {
      setLoading(false);
      setData(mockDataFiveDays());
      setError(hasPairs ? null : "No history yet");
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const blockNumber = await publicClient.getBlockNumber();
        const fromBlock =
          blockNumber > BigInt(FIVE_DAYS_BLOCKS)
            ? blockNumber - BigInt(FIVE_DAYS_BLOCKS)
            : 0n;

        const [yesLogs, noLogs] = await Promise.all([
          publicClient.getLogs({
            address: yesPair,
            event: SYNC_EVENT,
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: noPair,
            event: SYNC_EVENT,
            fromBlock,
            toBlock: "latest",
          }),
        ]);

        if (cancelled) return;

        const wbnbLower = String(WBNB).toLowerCase();

        const getReserveToken = (args, token0Addr) => {
          const t0 = String(token0Addr).toLowerCase();
          return t0 === wbnbLower ? args.reserve1 : args.reserve0;
        };

        const yesEvents = yesLogs.map((log) => ({
          blockNumber: log.blockNumber,
          reserve: getReserveToken(log.args, yesToken0),
          side: "yes",
        }));
        const noEvents = noLogs.map((log) => ({
          blockNumber: log.blockNumber,
          reserve: getReserveToken(log.args, noToken0),
          side: "no",
        }));

        const all = [...yesEvents, ...noEvents].sort(
          (a, b) => Number(a.blockNumber - b.blockNumber)
        );

        if (all.length === 0) {
          setData(mockDataFiveDays());
          setError("No history yet");
          setLoading(false);
          return;
        }

        let lastYes = 1n;
        let lastNo = 1n;
        const points = [];

        for (const ev of all) {
          if (ev.side === "yes") lastYes = ev.reserve;
          else lastNo = ev.reserve;
          const total = lastYes + lastNo;
          const p = total === 0n ? 50 : Number((lastYes * 10000n) / total) / 100;
          const blockNum = Number(ev.blockNumber);
          const approxTs =
            Math.floor(Date.now() / 1000) -
            (blockNumber - ev.blockNumber) * 3;
          points.push({
            blockNumber: blockNum,
            timestamp: approxTs,
            date: formatChartDate(approxTs),
            probability: Math.min(100, Math.max(0, p)),
          });
        }

        const byDate = {};
        for (const p of points) {
          if (!byDate[p.date]) byDate[p.date] = { sum: 0, n: 0, timestamp: p.timestamp };
          byDate[p.date].sum += p.probability;
          byDate[p.date].n += 1;
        }
        const chartData = Object.entries(byDate)
          .map(([date, { sum, n, timestamp }]) => ({
            date,
            probability: Math.round((sum / n) * 100) / 100,
            timestamp,
          }))
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(({ date, probability }) => ({ date, probability }));

        if (chartData.length === 0) {
          setData(mockDataFiveDays());
          setError("No history yet");
        } else {
          setData(chartData);
        }
      } catch (e) {
        if (!cancelled) {
          setError("No history yet");
          setData(mockDataFiveDays());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [
    publicClient,
    hasPairs,
    yesPair,
    noPair,
    yesToken0,
    noToken0,
    yesToken,
    noToken,
  ]);

  if (loading) {
    return (
      <div className="probability-chart-wrap">
        <h3 className="probability-chart-title">Yes probability (last 5 days)</h3>
        <div className="probability-chart-loading" aria-busy="true">
          <span className="chart-spinner" />
          <span>Loading history…</span>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="probability-chart-wrap">
        <h3 className="probability-chart-title">Yes probability (last 5 days)</h3>
        <p className="hint probability-chart-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="probability-chart-wrap">
      <h3 className="probability-chart-title">Yes probability (last 5 days)</h3>
      {error && (
        <p className="hint probability-chart-error" style={{ marginBottom: "0.5rem" }}>
          {error}
        </p>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
        >
          <XAxis
            dataKey="date"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            stroke="#475569"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            stroke="#475569"
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "6px",
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Yes"]}
            labelFormatter={(label) => label}
          />
          <Line
            type="monotone"
            dataKey="probability"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: "#22c55e", r: 3 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
