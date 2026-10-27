export interface TradeInput { balance: number; entry: number; stop: number; target: number; riskPct: number; feePct: number }
export interface TradeResult { side: 'long' | 'short'; riskAmount: number; size: number; notional: number; grossLoss: number; grossProfit: number; fees: number; netProfit: number; netLoss: number; rr: number }
/** Returns an error string or a result. feePct is per side, in percent (0.1 = 0.1%). */
export function planTrade(i: TradeInput): TradeResult | { error: string } {
  const { balance, entry, stop, target, riskPct, feePct } = i;
  if (![balance, entry, stop, target, riskPct, feePct].every(Number.isFinite)) return { error: 'Enter numbers in every field.' };
  if (balance <= 0 || entry <= 0 || stop <= 0 || target <= 0) return { error: 'Balance and prices must be above zero.' };
  if (riskPct <= 0 || riskPct > 100) return { error: 'Risk must be between 0 and 100%.' };
  if (feePct < 0) return { error: 'Fee cannot be negative.' };
  const side = stop < entry ? 'long' : 'short';
  if (stop === entry) return { error: 'Stop-loss cannot equal entry.' };
  if (side === 'long' ? target <= entry : target >= entry) return { error: 'Take-profit must be on the opposite side of entry from the stop-loss.' };
  const riskAmount = balance * riskPct / 100, perUnitRisk = Math.abs(entry - stop);
  const size = riskAmount / perUnitRisk, notional = size * entry;
  if (notional > balance) return { error: `Position (${notional.toFixed(2)}) exceeds balance without leverage. Lower risk % or widen the stop.` };
  const grossLoss = size * perUnitRisk, grossProfit = size * Math.abs(target - entry);
  const f = (p: number) => size * p * feePct / 100;
  return { side, riskAmount, size, notional, grossLoss, grossProfit,
    fees: f(entry) + f(target), netProfit: grossProfit - f(entry) - f(target), netLoss: grossLoss + f(entry) + f(stop), rr: grossProfit / grossLoss };
}
