import { useState, useRef, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { VIBEWAGER_ADDRESS, BSCSCAN_TESTNET } from "../config";
import { VIBEWAGER_ABI } from "../abi/vibeWagerMarket";

export function AdminPanel({ onClose }) {
  const [question, setQuestion] = useState("");
  const [endTime, setEndTime] = useState("");
  const [initialLiquidityBNB, setInitialLiquidityBNB] = useState("");
  const [tokenAmount, setTokenAmount] = useState("1000");
  const [step, setStep] = useState("form"); // form | creating | adding-liquidity | success
  const [createdMarketId, setCreatedMarketId] = useState(null);
  const [txHashes, setTxHashes] = useState([]);

  const fallbackRunRef = useRef(false);

  // Read marketCount to get new market ID after creation
  const { data: marketCount, refetch: refetchMarketCount } = useReadContract({
    address: VIBEWAGER_ADDRESS,
    abi: VIBEWAGER_ABI,
    functionName: "marketCount",
  });

  const {
    writeContract: writeCreateMarket,
    data: createHash,
    isPending: isCreating,
    error: createError,
  } = useWriteContract();

  const {
    writeContract: writeAddLiquidity,
    data: liquidityHash,
    isPending: isAddingLiquidity,
    error: liquidityError,
  } = useWriteContract();

  const [liquidityStep, setLiquidityStep] = useState(null); // null | "yes" | "no"
  const liquidityStepRef = useRef(null);
  const createdMarketIdRef = useRef(null);

  const addLiquidityRef = useRef(null);

  const { isLoading: isConfirmingCreate } = useWaitForTransactionReceipt({
    hash: createHash,
    onSuccess: (receipt) => {
      let newMarketId = null;
      const contractLog = receipt?.logs?.find(
        (l) => l.address?.toLowerCase() === VIBEWAGER_ADDRESS.toLowerCase() && l.topics?.[1]
      );
      if (contractLog?.topics?.[1]) {
        newMarketId = Number(BigInt(contractLog.topics[1]));
      }
      if (newMarketId == null) {
        setTimeout(() => {
          refetchMarketCount().then(({ data: newCount }) => {
            const id = newCount ? Number(newCount) : null;
            if (id != null) proceedAfterCreate(createHash, id);
          });
        }, 2000);
        return;
      }
      proceedAfterCreate(createHash, newMarketId);
    },
  });

  function proceedAfterCreate(hash, newMarketId) {
    createdMarketIdRef.current = newMarketId;
    liquidityStepRef.current = "yes";
    setCreatedMarketId(newMarketId);
    setTxHashes((prev) => [...prev, hash]);
    setStep("adding-liquidity");
    setLiquidityStep("yes");
    addLiquidityRef.current?.(true, newMarketId);
  }

  // Fallback: if create tx is confirmed but we're still on "creating" (e.g. onSuccess didn't run), refetch count and move to liquidity
  useEffect(() => {
    if (step !== "creating" || !createHash || isConfirmingCreate || fallbackRunRef.current) return;
    const t = setTimeout(() => {
      fallbackRunRef.current = true;
      refetchMarketCount().then(({ data: newCount }) => {
        const id = newCount ? Number(newCount) : null;
        if (id != null) proceedAfterCreate(createHash, id);
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [step, createHash, isConfirmingCreate, refetchMarketCount]);

  const { isLoading: isConfirmingLiquidity } = useWaitForTransactionReceipt({
    hash: liquidityHash,
    onSuccess: () => {
      setTxHashes((prev) => [...prev, liquidityHash]);
      const stepCur = liquidityStepRef.current;
      const marketId = createdMarketIdRef.current;
      if (stepCur === "yes" && marketId != null) {
        liquidityStepRef.current = "no";
        setLiquidityStep("no");
        addLiquidityRef.current?.(false, marketId);
      } else {
        setStep("success");
        setLiquidityStep(null);
        liquidityStepRef.current = null;
      }
    },
  });

  const addLiquidity = (yesSide, marketId) => {
    if (!marketId || !initialLiquidityBNB) return;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const tokenAmountWei = parseEther(tokenAmount);
    const bnbAmountWei = parseEther(initialLiquidityBNB);

    writeAddLiquidity({
      address: VIBEWAGER_ADDRESS,
      abi: VIBEWAGER_ABI,
      functionName: "addLiquidityBNB",
      args: [
        BigInt(marketId),
        yesSide,
        tokenAmountWei,
        tokenAmountWei / 2n,
        0n,
        deadline,
      ],
      value: bnbAmountWei,
    });
  };

  addLiquidityRef.current = addLiquidity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStep("creating");
    const endTimeValue = endTime ? BigInt(Math.floor(new Date(endTime).getTime() / 1000)) : 0n;

    writeCreateMarket({
      address: VIBEWAGER_ADDRESS,
      abi: VIBEWAGER_ABI,
      functionName: "createMarket",
      args: [question, endTimeValue],
    });
  };

  // No client-side owner check: form is always shown. Contract reverts with NotOwner if signer is not owner.
  const error = createError || liquidityError;
  const isPending = isCreating || isConfirmingCreate || isAddingLiquidity || isConfirmingLiquidity;

  return (
    <div className="bet-panel">
      <div className="close-row">
        <h2>Create Market</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="hint" style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
        Only the contract owner can create markets. If you’re not the owner, the transaction will revert (e.g. “NotOwner”).
      </p>

      {step === "form" && (
        <form className="bet-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="question">Event Description *</label>
            <input
              id="question"
              type="text"
              placeholder='e.g. "Will Team Vibes win DeFi track?"'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              disabled={isPending}
            />
            <p className="hint" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Token names will be auto-generated: "Yes: {question}" and "No: {question}"
            </p>
          </div>

          <div>
            <label htmlFor="endTime">End Time (optional)</label>
            <input
              id="endTime"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="tokenAmount">Token Amount per Pool</label>
            <input
              id="tokenAmount"
              type="text"
              inputMode="decimal"
              placeholder="1000"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              required
              disabled={isPending}
            />
            <p className="hint" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Amount of Yes/No tokens to mint for each liquidity pool
            </p>
          </div>

          <div>
            <label htmlFor="liquidity">Initial Liquidity (BNB per pool) *</label>
            <input
              id="liquidity"
              type="text"
              inputMode="decimal"
              placeholder="0.01"
              value={initialLiquidityBNB}
              onChange={(e) => setInitialLiquidityBNB(e.target.value)}
              required
              disabled={isPending}
            />
            <p className="hint" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
              BNB amount to add to both Yes/WBNB and No/WBNB pools (total: {initialLiquidityBNB ? (parseFloat(initialLiquidityBNB) * 2).toFixed(4) : "0"} BNB)
            </p>
          </div>

          {error && (
            <p className="error" role="alert">
              {error.shortMessage ?? error.message ?? "Transaction failed"}
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={isPending || !question || !initialLiquidityBNB}>
            {isPending ? "Processing..." : "Create Market & Add Liquidity"}
          </button>
        </form>
      )}

      {step === "creating" && (
        <div>
          {!createHash && isCreating && (
            <p className="loading">
              Confirm the transaction in your wallet (MetaMask, etc.).
            </p>
          )}
          {createHash && (
            <>
              <p className="loading">
                {isConfirmingCreate ? "Waiting for confirmation…" : "Setting up liquidity…"}
              </p>
              <p className="hint" style={{ fontSize: "0.8rem" }}>
                You will get <strong>two more</strong> wallet prompts (Yes pool, then No pool). If nothing appears, wait ~3s—we’ll retry and prompt again.
              </p>
              <p className="hint">
                <a href={`${BSCSCAN_TESTNET}/tx/${createHash}`} target="_blank" rel="noopener noreferrer">
                  View transaction on BscScan →
                </a>
              </p>
            </>
          )}
          {!createHash && !isCreating && createError && (
            <>
              <p className="error">{createError.shortMessage ?? createError.message}</p>
              <button type="button" className="btn btn-primary" onClick={() => setStep("form")} style={{ marginTop: "0.75rem" }}>
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {step === "adding-liquidity" && (
        <div>
          {!liquidityHash && isAddingLiquidity && (
            <p className="loading">
              Confirm the liquidity transaction in your wallet ({liquidityStep === "yes" ? "Yes" : "No"} pool).
            </p>
          )}
          {liquidityHash && (
            <>
              <p className="loading">
                {isConfirmingLiquidity ? "Waiting for confirmation…" : liquidityStep === "no" ? "Adding No pool…" : "Done with Yes. Confirm No pool in your wallet."}
              </p>
              <p className="hint">
                <a href={`${BSCSCAN_TESTNET}/tx/${liquidityHash}`} target="_blank" rel="noopener noreferrer">
                  View transaction on BscScan →
                </a>
              </p>
            </>
          )}
          {liquidityError && (
            <p className="error">{liquidityError.shortMessage ?? liquidityError.message}</p>
          )}
        </div>
      )}

      {step === "success" && (
        <div>
          <p className="hint" style={{ color: "#22c55e", fontSize: "1rem" }}>
            ✅ Market #{createdMarketId} created successfully!
          </p>
          <p className="hint">Transaction hashes:</p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem" }}>
            {txHashes.map((hash, i) => (
              <li key={hash} style={{ marginBottom: "0.5rem" }}>
                <a href={`${BSCSCAN_TESTNET}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
                  {i === 0 ? "Create Market" : i === 1 ? "Add Yes Liquidity" : "Add No Liquidity"}: {hash.slice(0, 10)}…
                </a>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary" onClick={onClose} style={{ marginTop: "1rem" }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
