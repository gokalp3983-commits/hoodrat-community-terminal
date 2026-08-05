# Whale Activity Tracker

A terminal-style HOODRAT whale tracker for Robinhood Chain.

## Commands

- `help`
- `whales`
- `leaderboard`
- `movers`
- `rank <wallet>`
- `stats`
- `price`
- `marketcap`
- `clear`

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Snapshot behavior

The first whale-data request creates an in-memory baseline. After five minutes,
the next request rotates the snapshot and enables movement comparisons. A
server restart clears snapshot history.

## Disclaimer

Independent community-built analytics tool. Not affiliated with or endorsed by
the official HOODRAT team.


## Performance update

- `whale`, `whales`, `leaderboard`, `movers`, and `stats` fetch only the top
  250 holders.
- `rank <wallet>` keeps the full-holder scan because the wallet may be anywhere
  in the ranking.
- The top-holder analytics cache is separate from the full-ranking cache.


## Whale definition

- Whales are the current Top 20 holders.
- `whales` lists the Top 20.
- `whale <rank>` opens a profile for Whale #1–20.
- Copy buttons copy full wallet addresses.


## v2.1 — Real on-chain activity

New terminal commands:

- `activity` — 24-hour largest buy/sell and net activity dashboard.
- `traders12` — top 10 HOODRAT buyers and top 10 sellers in the last 12 hours.
- `accumulators` / `distributors` — 24-hour net rankings.
- `transactions` — recent trades involving current Top-20 wallets.
- `newwhales` — new entrants to the Top 20 since the previous server snapshot.

Buy/sell classification uses actual HOODRAT transfers to and from the highest-liquidity HOODRAT/WETH pair returned by DexScreener. Ordinary wallet-to-wallet transfers are excluded from buy/sell rankings. Transfer results are cached for 60 seconds.


## v2.2 — Labeled infrastructure filtering

The tracker now uses a centralized labeled-address registry.

Excluded from participant whale rankings and statistics:

- HOODRAT/WETH liquidity pool
- Burn address
- Zero address

The liquidity pool remains active internally for DEX buy/sell classification.
Use `infrastructure` or `infra` to review labeled addresses and exclusion status.


## v2.3 — Current participant-holder ranks in activity reports

Activity wallets are now matched against the complete, infrastructure-filtered
participant holder list. Current holder rank is displayed in:

- 24-hour accumulators
- 24-hour distributors
- `traders12` buyers and sellers
- largest buy and largest sell
- recent Top-20 whale transactions

`N/A` means the wallet is not currently in the participant holder list, usually
because it no longer holds HOODRAT.


## v2.4 — Resilient activity loading

The activity loader now:

- caches full participant ranks for 10 minutes;
- caches transfer history for 2 minutes;
- keeps the last successful holder, market and transfer responses for up to 1 hour;
- prevents concurrent users from launching duplicate refreshes;
- caches complete 12-hour and 24-hour activity reports;
- falls back to Top-300 ranks if the complete holder list is temporarily unavailable;
- shows a `[ CACHE ]` notice rather than failing when stale data is used.

This prevents temporary Blockscout or DexScreener failures from taking down
`activity`, `traders12`, `accumulators`, `distributors`, and `transactions`.


## v2.5 — Non-blocking holder-rank enrichment

`activity` and `traders12` no longer wait for the complete holder list.

- Market data, transfers and the filtered Top-300 holder list load in parallel.
- A completed full-rank cache is used when already available.
- Otherwise, the report returns immediately with Top-300 ranks.
- The complete holder list refreshes in the background for later requests.
- Background full-rank failures are logged but cannot fail the activity report.

This removes the multi-minute first-request delay introduced by exact rank
enrichment.


## v2.6 — Background activity service and compact rank labels

- Activity data refreshes in the background every 60 seconds.
- User commands read from memory and do not trigger Blockscout bulk-transfer
  requests.
- 12-hour and 24-hour reports are precomputed.
- Missing ranks are classified compactly:
  - `N/A (Contract)`
  - `N/A (No Balance)`
  - `N/A (Unranked)`
- Address classification results are cached for 10 minutes.
- Only a cold server start may perform one synchronous initial refresh.


## v2.7 — Persistent command panel

- The first `help` command reveals a right-side Available Commands panel.
- The panel stays visible for the remainder of the session.
- It uses sticky positioning on desktop and moves below the terminal on small screens.
- Clicking a command places it into the active prompt without executing it.
- Argument-based commands insert a ready-to-complete prefix such as `rank ` or `whale `.


## v2.8 — Detached command panel and reliable command insertion

- Increased the desktop application width only while the command panel is open.
- Added a clear 32px gap between the terminal and the panel.
- Reduced the panel width slightly to preserve terminal table space.
- The panel stacks below the terminal below 1180px, preventing overlap.
- Command buttons now target `#commandInput` directly.
- Clicking a command reveals, focuses, and fills the prompt without executing it.


## v2.9 — Command-panel polish and rank formatting

- Increased the detached command-panel gap to 44px.
- Shortened command descriptions for faster scanning.
- Added a visible `HOODRAT Terminal v2.9` badge.
- Highlights the last selected or executed command.
- Forces holder ranks to positive integers only.
- Right-aligns holder-rank columns.


## v3.0 — Persistent command manual and global build identity

- `help` now opens the command panel without duplicating the command list.
- The terminal prints only a concise confirmation and usage guidance.
- Removed version information from the sidebar.
- Added an always-visible version/build line above the creator footer:
  `HOODRAT Terminal v3.0 • Build 2026.08.02`.


## v3.1 — Recent whale-trade table hierarchy

- Reordered recent trade columns to:
  `Type → Holder Rank → Wallet → HOODRAT → Time`.
- Centered Type, Holder Rank and Time.
- Right-aligned HOODRAT values.
- Added fixed-width BUY/SELL labels.
- Shortened relative times in this table from `9m ago` to `9m`.


## v3.1.1 — Cache-age formatter hotfix

- Restored the missing `formatAge()` frontend helper used by cache notices.
- Fixed `activity` and `traders12` failing with `Can't find variable: formatAge`.
- Removed an accidental duplicate table header in trader rankings.


## v3.1.2 — Frontend integrity audit

- Audited every shared frontend helper used by all terminal commands.
- Confirmed each required helper is defined exactly once.
- Restored and verified the global `formatAge()` helper.
- Added a startup integrity check for core rendering and command helpers.
- Updated package and visible application version to v3.1.2.


## v3.2 — Top-30 whale scope and `whales12`

- Expanded all whale-focused features from Top 20 to Top 30 participant wallets.
- Added `whales12`, showing current Top-30 whale DEX activity over 12 hours.
- Includes Bought, Sold, Net, Trades and behavior status for all 30 whales.
- Adds Accumulating, Distributing, Balanced and Dormant summary counts.
- Adds net Top-30 flow.
- Reorganized the command panel into WHALES, MARKET, TOKEN and SYSTEM groups.


## v3.2.1 — Top-30 whales hotfix

- Fixed the `whales` command request, which still asked the backend for 20 wallets.
- Changed the shared whale-table default limit from 20 to 30.
- Audited the runtime code for remaining hard-coded Top-20 limits.


## v3.3 — Flagship Top-30 whale terminal

- Added NFT-checker-style header using the existing HOODRAT JPEG, blue divider,
  terminal title and Whale Activity Tracker subtitle.
- Redesigned `whales12` as:
  `Rank | Wallet | Balance | Bought | Sold | Net | Trades | Status`.
- Added compact balances such as `45.01M`.
- Centralized token formatting to a maximum of two decimal places.
- Applied clean number formatting across whale lists, profiles, ranks, activity,
  transactions, accumulators, distributors, new whales and statistics.
- Centered Rank, Trades and Status; right-aligned numeric columns.
- Completed Top-30 whale-profile range consistency.


## v3.3.1 — Shared analytics cache hotfix

- `whales12` no longer triggers a new Blockscout transfer refresh.
- All 12h/24h report endpoints read from the same background activity cache.
- Added in-flight refresh deduplication for the shared analytics engine.
- Cold-start requests return a clear cache-warming response instead of causing
  duplicate upstream API calls.


## v3.3.2 — Whale profile Top-30 hotfix

- Fixed `whale <rank>` validation for ranks 21–30.
- Audited frontend and backend whale-profile limits.
- Removed remaining hidden Top-20 caps from the whale lookup flow.


## Cache warm-up behavior (v3.3.4)

During the first background refresh, activity commands return immediately with a
`[ CACHE ]` status rather than keeping the browser prompt blocked. Re-run the
command shortly afterward to read the completed shared cache.


## v3.3.5 — Shared inline market layout
The Whale Tracker now uses the same inline orange live-market panel as the HOODRAT landing page. Market data appears once beneath the header and is not duplicated in startup output or the HELP command panel.


## v3.4 — Shared Community Terminal design

- Applied the HOODRAT Community Terminal master header.
- Added the green `Whale Activity Tracker` module identifier.
- Aligned the LIVE market rows with the landing-page grid.
- Updated boot branding and suite footer.
- Preserved all whale commands, transaction feeds, caches, and rate-limit handling.


## v3.5 — Shared master shell

The Whale Activity Tracker now uses the same frame, header, LIVE panel,
application area, prompt, and footer structure as the Landing Page and NFT Terminal.
All whale analytics and command functionality remain intact.


## v3.5.1

- Removed the duplicated inner header and mascot.
- Kept only the shared master header.
- Moved the available-commands panel outside the main terminal frame.
- HELP opens the same command panel as a floating external sidebar.


## v3.5.2 — HELP panel polish

- Changed all visible `HELP` prompts to lowercase `help`.
- The command panel now matches the terminal frame's full viewport height.
- Reduced the space between the terminal and command panel to 10px.
- The command panel remains outside the main terminal frame.
- Added a responsive mobile layout where the panel opens above the bottom edge.


## v4.0 — True Landing master-shell rebuild

- The complete Landing Page HTML/CSS shell is now authoritative.
- Header, outer frame, orange LIVE panel and footer come directly from the Landing Page.
- Only Whale application content and Whale commands are module-specific.
- Whale CSS cannot override the shared header or LIVE component.
- `help` reveals the existing command panel beside the master frame with a fixed 4px gap.
- The shared LIVE endpoint returns Price, Market Cap, Holders, 24h Volume and Updated data.


## v4.0.2 — Centered split view

- Opening `help` no longer stretches the interface to fill the screen.
- The terminal and command panel remain centered as one combined layout.
- The main terminal keeps the Landing Page master width.
- The command panel has its own viewport-height scroll area.
- The main page and command panel now scroll independently.
