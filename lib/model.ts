// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds the
// other pre-token protocols the same field-based rule admits. A protocol is pre-token when its index
// entry records no token (no market cap, no CoinGecko id, no symbol). Live-token protocols are kept
// apart and shown as the market's own values, never mixed into the ranked board.
//
// The pre-token test, and every exclusion below, follows the input README's watchlist rule with the
// ten fields the sealed snapshot actually carries. The README's one extra signal — DefiLlama's
// `parentProtocol` — is not among those ten fields, so wrapped/staked/bridged products are excluded by
// the fields that ARE present: their category (Bridge, Canonical Bridge, Liquid Staking, Liquid
// Restaking, Restaked BTC, CEX), a version-marker name, a name that carries the whole word
// wrapped/staked/staking, or a name that begins with an exchange's name. A protocol the watchlist
// leaves out is no worse a subject: every watchlist slug is kept regardless, and the others that pass
// the same test are ranked beside it.
//
// Implied value follows only from the snapshot's own figures, in four named steps:
//
//   1. category multiple — the median market-cap/TVL of the snapshot's tokenised protocols in the same
//      category, the market's own "what a dollar of TVL is worth" for that kind of protocol. It is
//      computed, not invented: `deriveMultiples` takes the protocols that record a positive `mcap_usd`,
//      groups them by category, and takes each category's median mcap/TVL. A category with few peers is
//      shrunk toward the grand median (pseudocount 3) so one illiquid token cannot set the multiple, and
//      the result is capped at the 90th percentile of tokenised mcap/TVL (≈2.97x in this snapshot)
//      because the only categories above that are single-token outliers (the lone tokenised Prediction
//      Market peer trades at ≈400x on $6.6M of TVL).
//
//   2. base value           = tvl_usd x category multiple
//
//   3. growth multiplier    = 1 + clamp(change_7d / 100, -0.5, +1.0) x 0.25
//      change_7d is in percent; clamped to [-50%, +100%] (a fraction in [-0.5, +1.0]) and weighted by a
//      modest 0.25, so seven-day growth moves implied value between 0.875x and 1.25x and never more.
//
//   4. maturity multiplier  = a hat curve over days since listed_at: it ramps from 0.85 at launch to a
//      1.10 peak for protocols that have run 6–14 months (long enough to prove real TVL, still squarely
//      in a launch window), then decays to 0.80 by three years (a token that has not come after years is
//      less likely to). An unknown listed_at scores a neutral 1.0.
//
//   implied value          = round( base value x growth multiplier x maturity multiplier )
//
// Every factor is a named function below, every row carries the three multipliers that produced its
// value (base, growth, maturity) so the dashboard can show WHY, and no protocol name is ever
// special-cased: the same functions score every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's tunables: the growth and maturity curves and the category-shrinkage constant. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor_pct: number;
  growth_cap_pct: number;
  category_pseudocount: number;
  maturity_ramp_days: number;
  maturity_peak_end_days: number;
  maturity_old_days: number;
  maturity_young: number;
  maturity_peak: number;
  maturity_old: number;
  unknown_age_mult: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.25,
  growth_floor_pct: -50,
  growth_cap_pct: 100,
  category_pseudocount: 3,
  maturity_ramp_days: 180,
  maturity_peak_end_days: 420,
  maturity_old_days: 1095,
  maturity_young: 0.85,
  maturity_peak: 1.1,
  maturity_old: 0.8,
  unknown_age_mult: 1.0,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row, with the model's working on it. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, carrying the model's factors for the detail view. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the model and the derived category multiples. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  overall_multiple: number;
  mult_cap: number;
  category_multiples: Record<string, number>;
  model_version: string;
  watchlist_size: number;
  watchlist: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

// ------------------------------------------------------------------ the pre-token test

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the README's watchlist rule leaves out: wrapped, staked or bridged products and pure CEX. */
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** Exchange names a wrapped/staked product of theirs may open with, per the README's rule. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** The README's whole-word test for a wrapped, staked or staking product, in any case. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token and not a wrapped/staked/bridged product or a
 * pure CEX, exactly the field-based part of the input README's watchlist rule. The watchlist's own
 * slugs are kept regardless of this test (they are the floor).
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  const lower = p.name.toLowerCase();
  for (const prefix of EXCHANGE_PREFIXES) if (lower.startsWith(prefix.toLowerCase())) return false;
  return true;
}

// ------------------------------------------------------------------ the category multiple

/** A tokenised peer: a protocol with a positive recorded market cap and TVL. */
function isTokenisedPeer(p: SnapshotProtocol): boolean {
  return typeof p.mcap_usd === 'number' && p.mcap_usd > 0 && p.tvl_usd > 0;
}

/** The median of a list of numbers; 0 for an empty list. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The value at a quantile of a list of numbers, clamped to the observed range. */
function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)));
  return sorted[at]!;
}

/** The category multiples derived from the snapshot's tokenised peers. */
interface CategoryMultiples {
  overall: number;
  cap: number;
  byCategory: Map<string, number>;
}

/**
 * The market's own mcap/TVL norms, computed from the snapshot's tokenised protocols (mcap_usd > 0):
 * each category's median mcap/TVL, the grand median, and the 90th percentile used as the cap. Nothing
 * here is hand-written — the 128 tokenised peers supply every number.
 */
function deriveMultiples(snapshot: Snapshot): CategoryMultiples {
  const peers = snapshot.protocols.filter(isTokenisedPeer);
  const ratios: number[] = [];
  const byCategory = new Map<string, number[]>();
  for (const p of peers) {
    const ratio = p.mcap_usd! / p.tvl_usd;
    ratios.push(ratio);
    const category = p.category ?? 'Other';
    const list = byCategory.get(category) ?? [];
    list.push(ratio);
    byCategory.set(category, list);
  }
  const overall = median(ratios);
  const cap = quantile(ratios, 0.9);
  const medians = new Map<string, number>();
  for (const [category, list] of byCategory) {
    const n = list.length;
    // Shrink toward the grand median with a pseudocount, so a category with a single (often illiquid)
    // token cannot dictate its multiple: weight = n / (n + pseudocount) on the category median.
    const blended = (median(list) * n + overall * MODEL.category_pseudocount) / (n + MODEL.category_pseudocount);
    medians.set(category, blended);
  }
  return { overall, cap, byCategory: medians };
}

/**
 * The base multiple for one protocol's category: its shrunk category median, capped at the 90th
 * percentile of tokenised mcap/TVL, falling back to the grand median for a category with no tokenised
 * peer. This is the "comparable tokenised peers' mcap/TVL norm" the model anchors TVL on.
 */
export function categoryMultiple(category: string | null, mult: CategoryMultiples): number {
  const value = category === null ? mult.overall : (mult.byCategory.get(category) ?? mult.overall);
  return Math.min(mult.cap, Math.max(0, value));
}

// ------------------------------------------------------------------ growth and maturity

/**
 * Seven-day growth, in the snapshot's own percent unit, clamped to the model's [-50%, +100%] band —
 * a fraction in [-0.5, +1.0]. A null change reads as neutral (0).
 */
export function growthPct(change_7d: number | null): number {
  const pct = finite(change_7d, 0);
  return Math.min(MODEL.growth_cap_pct, Math.max(MODEL.growth_floor_pct, pct));
}

/** The modest growth multiplier: 1 + the clamped growth fraction times the weight (0.875x to 1.25x). */
export function growthMultiplier(change_7d: number | null): number {
  return 1 + (growthPct(change_7d) / 100) * MODEL.growth_weight;
}

/**
 * The maturity multiplier: a hat curve over days since listed_at. Very new protocols are unproven
 * (0.85 at launch), the 6–14 month middle is the prime launch window (peak 1.10), and protocols that
 * have run for years without a token decay toward 0.80. Unknown age scores a neutral 1.0.
 */
export function maturityMultiplier(age: number | null): number {
  if (age === null) return MODEL.unknown_age_mult;
  const days = Math.max(0, age);
  if (days <= MODEL.maturity_ramp_days) {
    return MODEL.maturity_young + (MODEL.maturity_peak - MODEL.maturity_young) * (days / MODEL.maturity_ramp_days);
  }
  if (days <= MODEL.maturity_peak_end_days) return MODEL.maturity_peak;
  if (days <= MODEL.maturity_old_days) {
    const t = (days - MODEL.maturity_peak_end_days) / (MODEL.maturity_old_days - MODEL.maturity_peak_end_days);
    return MODEL.maturity_peak + (MODEL.maturity_old - MODEL.maturity_peak) * t;
  }
  return MODEL.maturity_old;
}

/** The factors and implied value one protocol gets under the derived multiples. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  mult: CategoryMultiples,
): { implied: number; baseMultiple: number; growthPctValue: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const baseMultiple = categoryMultiple(protocol.category, mult);
  const growthPctValue = growthPct(protocol.change_7d);
  const growthMult = 1 + (growthPctValue / 100) * MODEL.growth_weight;
  const maturityMult = maturityMultiplier(age);
  const base = protocol.tvl_usd * baseMultiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, baseMultiple, growthPctValue, growthMult, maturityMult, age };
}

// ------------------------------------------------------------------ farm plans

/** What one protocol's farm plan needs to vary by: size, chain, age and a slug-derived variant. */
interface FarmContext {
  capital: number;
  chain: string;
  chain2: string | null;
  holdWeeks: number;
  variant: number;
  gas: number;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The second chain a protocol names, when it has one. */
function chain2Of(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(tvlUsd: number): number {
  if (tvlUsd >= 1_000_000_000) return 500;
  if (tvlUsd >= 200_000_000) return 250;
  if (tvlUsd >= 50_000_000) return 100;
  if (tvlUsd >= 20_000_000) return 50;
  return 25;
}

/** How long to hold, from the protocol's age: newer protocols get a longer qualifying window. */
function holdWeeksFor(age: number | null): number {
  if (age === null) return 6;
  if (age < 90) return 8;
  if (age < 270) return 6;
  if (age < 730) return 5;
  return 4;
}

/** A deterministic 0..2 variant from the slug, so two protocols in one category read differently. */
function variantOf(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash + slug.charCodeAt(i)) % 3;
  return hash;
}

/** A rough gas cost for the protocol's chain, from the position size. */
function gasFor(capital: number): number {
  return capital >= 250 ? 8 : capital >= 100 ? 5 : 3;
}

function contextFor(p: SnapshotProtocol, age: number | null): FarmContext {
  const capital = capitalFor(p.tvl_usd);
  return {
    capital,
    chain: chainOf(p),
    chain2: chain2Of(p),
    holdWeeks: holdWeeksFor(age),
    variant: variantOf(p.slug),
    gas: gasFor(capital),
  };
}

/** A farm step with its action, cost and time. */
function act(text: string, cost: string, time: string): FarmStep {
  return { text, cost, time };
}

/** The shared first step: a clean, funded wallet. The variant changes the hygiene note. */
function walletStep(c: FarmContext): FarmStep {
  const note = [
    'keep its seed phrase offline and fund it with only what you plan to farm',
    'write the seed on paper, not in any app, and fund it with only what you plan to use',
    'keep the seed in cold storage and move in only the farming capital',
  ][c.variant]!;
  return act(
    `Create a fresh wallet on ${c.chain} and ${note}.`,
    `about $${c.gas} of ${c.chain} gas for the first transaction`,
    '10 minutes',
  );
}

/** The shared last step: claim only from the protocol's own page, then log the run. */
function logStep(p: SnapshotProtocol, c: FarmContext): FarmStep {
  return act(
    `Before unwinding, claim any points or rewards only from ${p.name}'s own page, then log the wallet, the dates and every transaction in a farm ledger.`,
    'no fee to check, and never pay to claim',
    '10 minutes',
  );
}

/** DEXs: trade on the protocol's own interface, then supply liquidity to its main pair. */
function dexSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  const pair = ['its main quoted asset', 'its most liquid pair', 'one stable pair'][c.variant]!;
  return [
    act(
      `Swap $${c.capital} of USDC for ${p.name}'s main quoted asset on its own interface on ${c.chain} to record a first trade.`,
      `about $${c.gas} of ${c.chain} gas`,
      '15 minutes',
    ),
    act(
      `Provide $${c.capital} of two-sided liquidity to ${pair} in ${p.name}'s pools on ${c.chain} and leave it in range.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '20 minutes',
    ),
    act(
      `Make one small swap or limit order each week for ${c.holdWeeks} weeks to build a volume history on ${c.chain}.`,
      'about $2 of gas a week',
      '10 minutes a week',
    ),
  ];
}

/** Lending, CDP and collateral protocols: supply, borrow, and keep the health factor safe. */
function lendingSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  const collateral = ['USDC', 'the chain native asset', 'one supported collateral'][c.variant]!;
  return [
    act(
      `Supply $${c.capital} of ${collateral} as collateral to ${p.name} on ${c.chain} and keep the position open.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Borrow roughly 35% of the collateral value against it and hold the borrow with the health factor above 1.5.`,
      'about $3 of gas',
      '10 minutes',
    ),
    act(
      `Repay and re-borrow a small amount once every two weeks for ${c.holdWeeks} weeks so the activity is counted across snapshots.`,
      'about $3 of gas every two weeks',
      '15 minutes every two weeks',
    ),
  ];
}

/** Perpetuals, derivatives and interest-rate markets: margin, a small hedged position, weekly roll. */
function perpsSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  const leg = ['a BTC/USD perpetual', 'an ETH/USD perpetual', 'a short-dated interest-rate position'][c.variant]!;
  return [
    act(
      `Deposit $${c.capital} of USDC as margin on ${p.name} on ${c.chain} and leave most of it unallocated.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Open ${leg} with at most 20% of the margin, with a stop set so a liquidation cannot reach the rest.`,
      'about $3 of gas',
      '15 minutes',
    ),
    act(
      `Close or roll the position weekly for ${c.holdWeeks} weeks, keeping the collateral ratio well above the minimum.`,
      'about $3 of gas a week',
      '10 minutes a week',
    ),
  ];
}

/** Basis trading: a cash-and-carry position that earns funding without a directional bet. */
function basisSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} of collateral into ${p.name} on ${c.chain} for a basis position.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Open a cash-and-carry position (spot long plus a short perpetual) on ${p.name}'s own pairs and keep it delta-neutral.`,
      'about $3 of gas',
      '20 minutes',
    ),
    act(
      `Roll the position at each funding cycle for ${c.holdWeeks} weeks and bank the funding payments.`,
      'about $3 of gas per roll',
      '15 minutes per roll',
    ),
  ];
}

/** Cross-chain bridges: move funds across the protocol's own route and use them on the far side. */
function bridgeSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  const far = c.chain2 ?? 'a second chain it supports';
  return [
    act(
      `Bridge $${c.capital} of USDC from ${c.chain} to ${far} through ${p.name} and keep the transaction receipt.`,
      `$${c.capital} of capital plus the bridge fee and about $${c.gas} of gas`,
      '20 minutes',
    ),
    act(
      `Use the bridged funds in one application on ${far} so the route shows real usage, then hold them there.`,
      'about $3 of gas on the far chain',
      '20 minutes',
    ),
    act(
      `Bridge a small amount back after ${c.holdWeeks} weeks and record both legs in the farm log.`,
      'the bridge fee plus about $3 of gas',
      '15 minutes',
    ),
  ];
}

/** Yield, farms and yield aggregators: deposit, let it compound, then switch once. */
function yieldSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} into ${p.name}'s main vault or pool on ${c.chain} and keep the deposit receipt.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Leave the position to compound for ${c.holdWeeks} weeks and claim the yield at the protocol's own cadence.`,
      'about $2 of gas per claim',
      '5 minutes per claim',
    ),
    act(
      `Switch the position to a second pool once, then back, so the account shows recurring activity.`,
      'about $4 of gas for the round trip',
      '20 minutes once',
    ),
  ];
}

/** Yield aggregators and liquidity managers: deposit into a managed strategy and follow its rebalance. */
function yieldAggSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} into ${p.name}'s managed strategy on ${c.chain} and record the share price.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Check the strategy's weekly report and let it rebalance for ${c.holdWeeks} weeks without manual churn.`,
      'no cost to check',
      '10 minutes a week',
    ),
    act(
      `Add a small top-up once to show recurring deposits, keeping the position active across snapshots.`,
      'about $3 of gas',
      '10 minutes',
    ),
  ];
}

/** Leveraged farms: lever a position moderately and manage the ratio. */
function leveragedSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  const lever = ['about 2x', 'about 1.5x', 'about 2.5x'][c.variant]!;
  return [
    act(
      `Deposit $${c.capital} into ${p.name} on ${c.chain} and lever the position to ${lever}.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '20 minutes',
    ),
    act(
      `Watch the leverage ratio weekly for ${c.holdWeeks} weeks and repay a little if it drifts near the limit.`,
      'about $3 of gas when you adjust',
      '10 minutes a week',
    ),
    act(
      `Unwind the leverage once after ${c.holdWeeks} weeks and log the borrow cost against the yield.`,
      'about $3 of gas',
      '15 minutes',
    ),
  ];
}

/** Restaking, staking pools and BTC staking: stake, hold the receipt, stay through epochs. */
function stakingSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Stake $${c.capital} of the underlying asset through ${p.name} on ${c.chain} and keep the receipt token.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Hold the receipt through ${c.holdWeeks} weeks of epochs and note each epoch's rewards or points.`,
      'no cost to hold',
      '5 minutes an epoch',
    ),
    act(
      `If ${p.name} allows it, put the receipt to work in one supported DeFi venue, otherwise leave it staked.`,
      'about $3 of gas if you deploy it',
      '15 minutes',
    ),
  ];
}

/** RWA: mint or deposit, hold the yield token, and confirm the exit path once. */
function rwaSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Mint or deposit $${c.capital} into ${p.name}'s RWA vault on ${c.chain}, completing any required KYC first.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '20 minutes plus KYC',
    ),
    act(
      `Hold the yield token for ${c.holdWeeks} weeks and track the underlying asset's reported yield.`,
      'no cost to hold',
      '5 minutes a week',
    ),
    act(
      `Redeem or roll a small slice once to confirm the exit path works, then top the position back up.`,
      'about $3 of gas',
      '15 minutes',
    ),
  ];
}

/** Risk curators: deposit into a curated vault, spread across pools, rebalance once. */
function curatorSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} into a vault curated by ${p.name} on ${c.chain} and keep the receipt.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Split the position across two of ${p.name}'s curated pools to diversify the exposure.`,
      'about $3 of gas for the second entry',
      '15 minutes',
    ),
    act(
      `Follow the curator's own guidance and rebalance once after ${c.holdWeeks} weeks rather than chasing markets.`,
      'about $3 of gas when you rebalance',
      '15 minutes',
    ),
  ];
}

/** Onchain capital allocators: deposit into the allocator vault and review its report. */
function allocatorSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} into ${p.name}'s allocator vault on ${c.chain} and record the entry value.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Choose the default allocation or a single conservative strategy, then check the weekly report for ${c.holdWeeks} weeks.`,
      'no cost to check',
      '10 minutes a week',
    ),
    act(
      `Top the position up once to keep it live across snapshots, then leave the strategy to run.`,
      'about $3 of gas',
      '10 minutes',
    ),
  ];
}

/** Chains: fund the gas asset and use the chain's core app weekly. */
function chainSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Buy or bridge $${c.capital} of the gas asset and use ${p.name}'s core application on ${c.chain}.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '20 minutes',
    ),
    act(
      `Use one of the chain's key applications once a week for ${c.holdWeeks} weeks to build an on-chain history.`,
      'about $2 of gas a week',
      '10 minutes a week',
    ),
    act(
      `If the chain supports it, delegate or stake a small amount to its consensus to participate directly.`,
      'about $3 of gas',
      '15 minutes',
    ),
  ];
}

/** Prediction markets: fund, place one position, redeem at resolution. */
function predictionSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Fund $${c.capital} of USDC into ${p.name} on ${c.chain} and keep most of it unplaced.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Place one small position in a market that resolves within a few weeks, sizing it to a loss you can afford.`,
      'about $3 of gas',
      '10 minutes',
    ),
    act(
      `Track the market to resolution and redeem the payout, then repeat once more within ${c.holdWeeks} weeks.`,
      'about $2 of gas per trade',
      '10 minutes a week',
    ),
  ];
}

/** Stablecoin wrappers and dual-token stables: mint, use the stable, redeem to confirm the peg. */
function stableSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Mint or deposit $${c.capital} of the stable asset through ${p.name} on ${c.chain}.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Put the stable to work in one yield venue for ${c.holdWeeks} weeks while keeping the position liquid.`,
      'about $3 of gas',
      '15 minutes',
    ),
    act(
      `Redeem the stable back to its backing asset once to confirm the peg path works, then re-mint.`,
      'about $3 of gas for the round trip',
      '15 minutes',
    ),
  ];
}

/** Insurance: buy cover for a real position and keep the policy live. */
function insuranceSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Buy $${c.capital} of cover from ${p.name} on ${c.chain} for a position you actually hold.`,
      `the premium plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Keep the policy active for ${c.holdWeeks} weeks and renew it if it lapses before the window closes.`,
      'the premium on renewal',
      '5 minutes a week',
    ),
    act(
      `If a covered event happens, file the claim through ${p.name}'s own flow and keep every record.`,
      'no fee to file',
      '20 minutes if you claim',
    ),
  ];
}

/** Payments: open a channel or account, route real payments, then settle. */
function paymentsSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Open a channel or account on ${p.name} on ${c.chain} funded with $${c.capital}.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '20 minutes',
    ),
    act(
      `Route one real payment or invoice through it each week for ${c.holdWeeks} weeks.`,
      'about $1 of routing or gas a week',
      '10 minutes a week',
    ),
    act(
      `Close or settle the channel once to confirm the exit, then reopen a small one.`,
      'about $3 of gas',
      '15 minutes',
    ),
  ];
}

/** Governance incentives: stake, delegate, and vote on a live proposal. */
function governanceSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Stake or deposit $${c.capital} through ${p.name} on ${c.chain} to earn the incentive.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Delegate the voting power and vote on one live proposal to show real participation.`,
      'about $2 of gas',
      '10 minutes',
    ),
    act(
      `Keep the stake for ${c.holdWeeks} weeks and track the incentive schedule so you stay eligible.`,
      'no cost to hold',
      '5 minutes a week',
    ),
  ];
}

/** Indexes: buy the index token, reinvest, and confirm exit liquidity. */
function indexSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Swap $${c.capital} into ${p.name}'s index token on ${c.chain}.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Hold the index for ${c.holdWeeks} weeks and reinvest any distributions it pays.`,
      'about $2 of gas per reinvest',
      '5 minutes when it pays',
    ),
    act(
      `Redeem a small amount once to confirm the exit liquidity, then top the position back up.`,
      'about $3 of gas',
      '15 minutes',
    ),
  ];
}

/** CeDeFi: deposit the on-chain leg, hold, and confirm the off-ramp once. */
function cedefiSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} into ${p.name}'s CeDeFi vault on ${c.chain} (the on-chain leg).`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Keep the position for ${c.holdWeeks} weeks and reconcile the yield the protocol reports against your balance.`,
      'no cost to check',
      '10 minutes a week',
    ),
    act(
      `Withdraw a small amount once to confirm the off-ramp works, then re-deposit it.`,
      'about $3 of gas',
      '15 minutes',
    ),
  ];
}

/** Crypto card issuers: fund the card, use it once, and keep it active. */
function cardSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} through ${p.name} to issue or fund the card on ${c.chain}.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '20 minutes',
    ),
    act(
      `Make one small card purchase and repay it on time to show real usage.`,
      'the purchase amount',
      '5 minutes',
    ),
    act(
      `Track any cashback or rewards and keep the card active for ${c.holdWeeks} weeks.`,
      'no cost to keep',
      '5 minutes a week',
    ),
  ];
}

/** OTC marketplaces: place a limit order, settle a trade, review custody. */
function otcSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} and place one limit order on ${p.name}'s OTC venue on ${c.chain}.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '20 minutes',
    ),
    act(
      `Settle a trade and record the price, then place a second order to stay active.`,
      'about $3 of gas per order',
      '15 minutes',
    ),
    act(
      `Review the venue's settlement and custody flow after ${c.holdWeeks} weeks and note it in the log.`,
      'no cost to review',
      '15 minutes',
    ),
  ];
}

/** The fallback: a deposit plus a weekly qualifying action, safe for any category. */
function defaultSteps(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  return [
    act(
      `Deposit $${c.capital} of USDC into ${p.name} on ${c.chain} and keep the position open.`,
      `$${c.capital} of capital plus about $${c.gas} of gas`,
      '15 minutes',
    ),
    act(
      `Make one qualifying action each week (a swap, borrow, vote or stake) for ${c.holdWeeks} weeks.`,
      'about $2 of gas a week',
      '10 minutes a week',
    ),
    act(
      `Rebalance or top the position up once after ${c.holdWeeks} weeks so it is counted in more than one snapshot.`,
      'about $3 of gas',
      '10 minutes',
    ),
  ];
}

/**
 * The category playbook: three concrete actions in the protocol's own category, chosen from its
 * category string (never from a hand-written list of names), and varied by its chains, TVL tier, age
 * and a slug-derived variant so two protocols in one category do not read identically.
 */
function playbook(p: SnapshotProtocol, c: FarmContext): FarmStep[] {
  const cat = (p.category ?? '').toLowerCase();
  if (cat.includes('dex')) return dexSteps(p, c);
  if (cat.includes('lend') || cat.includes('cdp') || cat.includes('collateral')) return lendingSteps(p, c);
  if (cat.includes('perpetual') || cat.includes('derivative') || cat.includes('option')) return perpsSteps(p, c);
  if (cat.includes('basis')) return basisSteps(p, c);
  if (cat.includes('bridge')) return bridgeSteps(p, c);
  if (cat.includes('leveraged farm')) return leveragedSteps(p, c);
  if (cat.includes('yield aggregator') || cat.includes('liquidity manager')) return yieldAggSteps(p, c);
  if (cat.includes('yield') || cat.includes('farm')) return yieldSteps(p, c);
  if (cat.includes('restak') || cat.includes('staking pool') || cat.includes('anchor btc') || cat.includes('decentralized btc')) return stakingSteps(p, c);
  if (cat.includes('rwa')) return rwaSteps(p, c);
  if (cat.includes('curator')) return curatorSteps(p, c);
  if (cat.includes('allocator')) return allocatorSteps(p, c);
  if (cat.includes('chain')) return chainSteps(p, c);
  if (cat.includes('prediction')) return predictionSteps(p, c);
  if (cat.includes('stable')) return stableSteps(p, c);
  if (cat.includes('insurance')) return insuranceSteps(p, c);
  if (cat.includes('payment')) return paymentsSteps(p, c);
  if (cat.includes('governance')) return governanceSteps(p, c);
  if (cat.includes('index')) return indexSteps(p, c);
  if (cat.includes('cedefi')) return cedefiSteps(p, c);
  if (cat.includes('card')) return cardSteps(p, c);
  if (cat.includes('otc')) return otcSteps(p, c);
  return defaultSteps(p, c);
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: a shared wallet step, its category playbook, and a shared claim-and-log step,
 * each an action with a cost and a time. 5 steps per protocol, within the gate's 3..12.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const context = contextFor(p, age);
  return [walletStep(context), ...playbook(p, context), logStep(p, context)];
}

// ------------------------------------------------------------------ the board

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** An explicit, deterministic tie-break on slug, for byte-identical output. */
function tieBreak(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, mult: CategoryMultiples = deriveMultiples(snapshot)): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, kept regardless of the field-based test (coverage is the
  // gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The rest of the pre-token radar: every other protocol that passes the same field-based rule. The
  // snapshot's exclusions bound this set to fewer than 200 rows, all of them carried.
  const others = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || tieBreak(a.slug, b.slug));
  for (const p of others) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, mult);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || tieBreak(a.p.slug, b.p.slug));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: round4(s.baseMultiple),
      growth_pct: round4(s.growthPctValue),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || tieBreak(a.slug, b.slug))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the model's factors the dashboard shows. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** The category multiples as a plain object with sorted keys, for byte-identical output. */
function categoryMultiplesObject(mult: CategoryMultiples): Record<string, number> {
  const out: Record<string, number> = {};
  for (const category of [...mult.byCategory.keys()].sort(tieBreak)) {
    out[category] = round4(categoryMultiple(category, mult));
  }
  return out;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const mult = deriveMultiples(snapshot);
  const board = buildBoard(snapshot, model, mult);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    overall_multiple: round4(mult.overall),
    mult_cap: round4(mult.cap),
    category_multiples: categoryMultiplesObject(mult),
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist: snapshot.watchlist,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: size, coverage, ranks, order, values and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `the board has ${board.length} rows, under the 100 the gate requires`;
  if (board.length > 4000) return `the board has ${board.length} rows, over the 4000 the gate allows`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_usd > 100_000_000_000) return `${r.slug} has implied value ${r.implied_value_usd}, over the 1e11 cap`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
