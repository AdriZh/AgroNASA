// Deterministic costing and cash-feasibility checks (03_Implementation_Plan §5, Step 7).
import type { ConfirmedInflow, CostItemDef } from '../domain/types';
import { addDays } from '../domain/dates';
import { fromMinor, toMinor } from '../domain/units';

export interface CostLine {
  season: 1 | 2; cropId: string; key: string; category: CostItemDef['category']; label: string;
  qty: number; unit: string; unitPrice: number | null; total: number | null;
  dueDate: string; essential: boolean; cash: boolean; overridden: boolean; synthetic: boolean;
}

export function costLine(item: CostItemDef, season: 1 | 2, cropId: string, areaHa: number, sowing: string, override?: number | null, synthetic = true): CostLine {
  const overridden = override !== undefined;
  const unitPrice = overridden ? override! : item.unitPrice;
  const qty = item.qtyPerHa * areaHa;
  // integer minor units for the money arithmetic
  const total = unitPrice == null ? null : fromMinor(Math.round(qty * toMinor(unitPrice)));
  return {
    season, cropId, key: item.key, category: item.category, label: item.label, qty, unit: item.unit, unitPrice, total,
    dueDate: addDays(sowing, item.dueOffsetDays), essential: item.essential, cash: item.cash, overridden, synthetic: synthetic && !overridden,
  };
}

export type Affordability = 'affordable' | 'unaffordable' | 'unverified' | 'timing';

export interface BudgetResult {
  lines: CostLine[];
  totalCash: number;           // known cash costs
  totalNonCash: number;
  bySeason: [number, number];
  upfront: number;             // cash due on or before season-1 sowing
  cap: number;                 // funds − reserve
  inflowsTotal: number;
  headroom: number;            // cap + inflows − totalCash
  missingEssential: CostLine[];
  status: Affordability;
  timingViolation: { date: string; needed: number; available: number } | null;
  cumulative: { date: string; outflow: number; available: number }[];
}

export function evaluateBudget(lines: CostLine[], funds: number, reserve: number, inflows: ConfirmedInflow[], season1Sowing: string): BudgetResult {
  const cash = lines.filter((l) => l.cash);
  const missingEssential = cash.filter((l) => l.essential && l.total == null);
  const sumMinor = (ls: CostLine[]) => ls.reduce((a, l) => a + (l.total == null ? 0 : toMinor(l.total)), 0);
  const totalCashM = sumMinor(cash);
  const capM = toMinor(funds) - toMinor(reserve);
  const inflowM = inflows.reduce((a, f) => a + toMinor(f.amount), 0);
  const s1 = sumMinor(cash.filter((l) => l.season === 1)), s2 = sumMinor(cash.filter((l) => l.season === 2));
  const upfront = sumMinor(cash.filter((l) => l.dueDate <= season1Sowing));

  // cumulative cash check at each due date (only confirmed, dated inflows count; never harvest proceeds or credit)
  const dates = [...new Set(cash.map((l) => l.dueDate))].sort();
  let out = 0;
  const cumulative: BudgetResult['cumulative'] = [];
  let timingViolation: BudgetResult['timingViolation'] = null;
  for (const d of dates) {
    out += sumMinor(cash.filter((l) => l.dueDate === d));
    const avail = capM + inflows.filter((f) => f.date <= d).reduce((a, f) => a + toMinor(f.amount), 0);
    cumulative.push({ date: d, outflow: fromMinor(out), available: fromMinor(avail) });
    if (out > avail && !timingViolation) timingViolation = { date: d, needed: fromMinor(out), available: fromMinor(avail) };
  }

  let status: Affordability;
  if (missingEssential.length) status = 'unverified';
  else if (totalCashM > capM + inflowM) status = 'unaffordable';
  else if (timingViolation) status = 'timing';
  else status = 'affordable';

  return {
    lines, totalCash: fromMinor(totalCashM), totalNonCash: lines.filter((l) => !l.cash).reduce((a, l) => a + (l.total ?? 0), 0),
    bySeason: [fromMinor(s1), fromMinor(s2)], upfront: fromMinor(upfront), cap: fromMinor(capM), inflowsTotal: fromMinor(inflowM),
    headroom: fromMinor(capM + inflowM - totalCashM), missingEssential, status, timingViolation, cumulative,
  };
}

// ---------- Placeholder budget for new / custom farms ----------
// A new farm has no real cash figure yet. A flat per-hectare default (previously 900 USD/ha) is unrelated to what
// the plans cost there, so in most places either everything fits — the affordability trade-off vanishes — or
// nothing does. Instead the placeholder is sized from the usual plan's own cash cost, to reproduce a typical
// pre-season squeeze like the Bambey demo (spendable cash ≈ 84% of the usual plan's cost):
//   spendable = 90% of the usual plan's cash cost   → the usual plan is ~10% over budget;
//   reserve   = 10% of funds                         (the demo farms keep 9–10%);
// and once the engine has screened the alternatives, spendable is raised just enough that the cheapest
// rule-passing alternative fits if none fits at 90% (so the first screen is never an empty "nothing fits").
// Amounts are rounded to steps of 5 in the third significant digit of the local currency. The result is always
// flagged as a placeholder (BUDGET_PLACEHOLDER note) until the farmer enters real figures.
export const PLACEHOLDER_SPEND_SHARE = 0.9;
export const PLACEHOLDER_RESERVE_SHARE = 0.1;

/** Round to a "nice" amount: steps of 5 in the third significant digit (471,234 → 470,000; 1,049 → 1,050). */
export function niceRound(x: number, mode: 'nearest' | 'up' = 'nearest'): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  const step = Math.max(1, 5 * 10 ** (Math.floor(Math.log10(x)) - 2));
  return (mode === 'up' ? Math.ceil(x / step) : Math.round(x / step)) * step;
}

export interface PlaceholderBudget { funds: number; reserve: number; spendable: number }

/**
 * Placeholder funds and reserve (scenario currency) from the usual plan's cash cost and, optionally,
 * the cash costs of the rule-passing alternatives.
 */
export function placeholderBudget(usualCost: number, altCosts: number[] = []): PlaceholderBudget {
  const alts = altCosts.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  const usual = usualCost > 0 ? usualCost : alts[0] ?? 0;
  if (!(usual > 0)) return { funds: 0, reserve: 0, spendable: 0 };
  const target = Math.max(usual * PLACEHOLDER_SPEND_SHARE, alts[0] ?? 0);
  const reserveOf = (f: number) => niceRound(f * PLACEHOLDER_RESERVE_SHARE);
  let funds = niceRound(target / (1 - PLACEHOLDER_RESERVE_SHARE));
  // rounding must not push the cheapest alternative out of the budget
  for (let i = 0; alts.length && funds - reserveOf(funds) < alts[0] && i < 100; i++) funds = niceRound(funds * 1.002 + 1, 'up');
  const reserve = reserveOf(funds);
  return { funds, reserve, spendable: funds - reserve };
}
