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
