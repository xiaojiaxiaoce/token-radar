# BRIEF — make.fun bounty token-radar-01: build the best token launch radar

You are the coding agent building this entry. Work in this repository (the repo root is your
working directory). Read this whole brief before writing code. Work phase by phase; the human
operator will tell you which phase to run in each session. Commit with git at the end of each
phase (repo-local identity is already set).

## What the entry is

A program plus the dashboard it writes. `main.ts` (Node, standard library ONLY — no npm
dependencies, no network access at runtime) reads a sealed DefiLlama snapshot at
`/input/snapshot.json` (locally: `--input ..\\input\\snapshot.json`, output via the
`MAKEFUN_OUTPUT_DIR` env var, see main.ts's header comment), and writes:

- `/output/board.json` — the ranked board (`{ rows: [...] }`)
- `/output/data.js` — the dashboard's data, written by the program from the same board
- `/output/dashboard/` — a copy of this repo's `dashboard/` (static page: index.html, app.js,
  app.css; NO framework, NO external/network resources of any kind)
- `/output/screenshots/` — a copy of this repo's `screenshots/` (3 PNGs: board, detail, filtered)
- `/output/dossier.json` — written last by `main.ts` via `buildDossier` from
  `vendor/makefun-board.ts`. NEVER modify anything under `vendor/`.

Keep `main.ts`'s CLI and output contract exactly as shipped; change the model, the farm
plans and the page. Keep `LICENSE` as is.

## The sealed gate (hard limits — violating any one voids the entry)

- Board: 100 to 4000 rows. Every row's slug must be a protocol in the snapshot.
- The board MUST include every protocol on the snapshot's `watchlist` (40 slugs) — coverage is
  checked. The watchlist is a floor, not a ceiling: carry other pre-token protocols too.
- Farm steps per row: 3 to 12 steps, each a single string of 20 to 600 characters.
- Implied value per row: at most 100,000,000,000 (1e11) USD, and it must be stated on the row.
- Dashboard: at most 400 files and 4 MiB total; no network references (no http/https URLs,
  no CDN, no web fonts — everything inline/local).
- Screenshots: 3 or 4 PNGs, each at most 512 KiB, long side at most 1440 px, short side at
  least 800 px. They must show THIS dashboard: 1 = the board, 2 = one protocol's detail view,
  3 = a filtered view.
- Dossier text cap: 65,536 bytes — `main.ts` already enforces the shape; keep the dashboard
  source lean enough to fit.

## The snapshot (fields you may use — nothing else exists)

`{ as_of, source, floor_usd, protocols[], watchlist[] }`; each protocol:
`slug, name, category, chains[], tvl_usd, change_7d (fraction, e.g. -0.0399), mcap_usd
(null when no token), listed_at (date string or null), gecko_id (null when no token),
symbol (null when no token)`. 758 protocols, 629 with `mcap_usd: null`.
The snapshot contains NO score, NO yield, NO airdrop flag: deriving the ranking is your work.

## How the entry is judged (AI judge, pairwise, criteria in this order)

1. A working radar: covers the whole watchlist, ranks pre-token protocols by a stated implied
   value, screenshots and code agree (a screen with no data behind it counts for nothing).
2. The value model: implied value derived from the snapshot's own figures — TVL, 7-day
   growth, how long the protocol has run with no token — never from hardcoded names. The
   board separates protocols whose token already trades from those still to come.
3. Farm plans: concrete steps with what they cost and how long they take. No slogans.
4. The dashboard as a page: sortable and filterable, readable at a glance, a detail view for
   every protocol.
5. It looks made: a chosen palette, consistent spacing, type that reads — not a framework
   pasted wholesale.

## PHASE 1 — the value model and farm plans (`lib/model.ts`)

Rebuild the model in `lib/model.ts` (keep its exported function signatures that `main.ts`
uses: `parseSnapshot`, `buildRadar`, `boardIssue`, `dataScript` and the board row shape the
dashboard consumes — read `dashboard/app.js` before changing any field it reads).

Model requirements:
- Pre-token test from the data: a protocol is pre-token when it records no token
  (`mcap_usd`, `gecko_id`, `symbol` all null). Exclude wrapped/staked/bridged products of
  tokens that already trade and pure CEX entries from the ranked board, the way the input
  README describes the watchlist rule; keep every watchlist protocol regardless.
- Implied value: a defensible multiple-of-TVL model. Anchor on TVL; adjust by category
  (comparable tokenised peers' mcap/TVL norms per category, derived as constants you justify
  in comments from the snapshot's own tokenised protocols — compute the per-category median
  mcap/TVL from the 129 protocols that DO have an mcap, do not invent numbers); adjust by
  7-day growth (bounded, e.g. clamp change_7d to [-0.5, +1.0] and map to a modest multiplier);
  adjust by maturity (days since listed_at: very new and very old both differ from the
  middle; state the curve). Every factor must be a named function the judge can read.
- Rank the board by implied value descending, ranks 1..N contiguous. Board size: aim for
  roughly 220–320 rows (all 40 watchlist + the strongest other pre-token protocols).
- Each row must carry the model's working: the factor values that produced its implied value
  (base multiple, growth multiplier, maturity multiplier) so the dashboard can show WHY.
- Also keep a separate small "already trading" set aside in the data (the starter's
  live_size concept) — the dashboard shows pre-token only, but the model must visibly
  separate the two.

Farm plans (this is scored hard — make them real):
- Generate per-protocol steps from its category, chains and size. Write category playbooks
  (Dexs, Lending, Perpetuals/Derivatives, Bridge, Yield, Liquid Staking, RWA, Gaming, etc. —
  cover every category that appears among board rows) whose steps name concrete actions:
  e.g. for a DEX: swap on the protocol's own interface on its main chain, provide liquidity
  to a named pair type, vote/lock if the category does that; for lending: supply, borrow,
  repay cycles; for a bridge: move funds across its supported chains.
- Every step states an action, an approximate cost (USD or gas estimate) and a time
  commitment (minutes per session, sessions per week, or weeks to run). Vary the steps by
  the protocol's chains and TVL tier so two protocols in one category do not read identically.
- 4–7 steps per protocol. Each step one string, 20–600 chars (the gate checks this).

Validate before ending the phase (PowerShell, from the repo root):
`$env:MAKEFUN_OUTPUT_DIR='out'; node main.ts --input ..\\input\\snapshot.json`
Fix every error until the run exits 0 and prints its summary line. Sanity-check `out/board.json`:
row count, watchlist coverage (all 40 slugs present), step lengths inside 20–600, implied
values under the cap, ranks contiguous. Then `git add -A; git commit`.

## PHASE 2 — the dashboard (`dashboard/`)

Rebuild the page into a radar an airdrop farmer would actually use, keeping the starter's
architecture: `index.html` + `app.js` + `app.css`, data from `../data.js` (the program writes
it beside the page), hash-based state (`location.hash` params drive filters and the detail
view — keep that mechanism, screenshots depend on it). No network, no framework, no external
fonts. Design targets:
- Dark "radar" theme, one deliberate accent colour, tabular numerals, dense but readable
  table; sticky header; rank, name, category, chains, TVL, 7d change, implied value,
  implied/TVL multiple, age — sortable by every numeric column.
- Filters: text search, category select, chain select, watchlist-only toggle, TVL range;
  a results count; an "as of" stamp from the snapshot.
- Detail view per protocol (the hash opens it): stats grid, the model's factor breakdown
  (why this rank — the numbers from the row), and the full farm plan as numbered steps with
  cost/time chips.
- A short "How this radar ranks" panel stating the model in plain words (the judge reads
  the page source — the model must be stated, not hidden).
- Keep total dashboard size small (the dossier text cap covers the source).

Validate with the same run command; open the generated `out/dashboard/index.html` data path
mentally — app.js must read `window.DATA` from data.js exactly as `dataScript` writes it.

## PHASE 3 — screenshots and final validation

- Serve or open the built dashboard from `out/` and capture 3 PNGs with a headless browser
  (Edge or Chrome `--headless --screenshot`), window size 1440x900:
  1. `screenshots/1-board.png` — the board, first screenful.
  2. `screenshots/2-detail.png` — the detail view of the #1 ranked protocol (use the hash
     state that opens it).
  3. `screenshots/3-filtered.png` — a filtered view (e.g. one category + watchlist-only).
  Each PNG ≤ 512 KiB (compress/quantise if needed), long side ≤ 1440, short side ≥ 800.
  The screenshots must show the final dashboard exactly as built — no mock-ups.
- Delete the starter's old screenshots. Final full run; verify `out/` contains board.json,
  data.js, dashboard/ (3 files), screenshots/ (3 images), dossier.json; verify board.json
  once more against every gate limit in this brief. Commit.

## Working rules

- Node standard library only, everywhere. No `npm install` of anything.
- Deterministic output: same snapshot in → same bytes out (sort with explicit tie-breaks).
- If a requirement in this brief conflicts with what `main.ts`'s gate-shape code enforces,
  the code wins and you note the conflict in your phase report.
- End each phase with a short report: what changed, the validation run's output line, and
  the board stats (rows, watchlist coverage, top 5 by implied value).
