# v3.3.4 — Immediate cache feedback

- Activity commands no longer wait for an in-progress background refresh.
- `activity`, `transactions`, `traders12`, and `whales12` immediately report a clear `[ CACHE ]` warming message when data is not ready.
- The shared background refresh continues without launching duplicate Blockscout requests.
- Preserves the v3.3.3 request queue, retry/backoff, stale-cache, and rate-limit protections.

# Changelog

## 1.0.0

- Initial Whale Activity Tracker release


## 1.3.0

- Added fast top-250 holder path for whale analytics
- Kept full-holder scan only for wallet-rank lookup
- Added separate caches for top-holder and full-holder data


## 2.0.0

- Defined whales as Top 20 holders
- Added `whale <rank>` profiles
- Added full-address copy controls
- Added localhost startup banner


## 2.1.0
- Added real 24-hour DEX buy/sell analysis via Blockscout token transfers.
- Added `traders12` for top 10 buyers and sellers over 12 hours.
- Added largest buy/sell, accumulators, distributors, recent whale transactions, new whale entrants, and holder-change data.


## 2.2.0

- Added centralized labeled infrastructure-address registry.
- Excluded the HOODRAT/WETH LP, burn address and zero address from whale rankings,
  concentration statistics, snapshots, movers and new-whale detection.
- Preserved the LP for DEX trade classification.
- Added `infrastructure` / `infra` command.
- Rank lookup explains when an address is excluded infrastructure.


## 2.3.0

- Added current participant-holder rank to all DEX activity records.
- Added Holder Rank columns to accumulators, distributors and `traders12`.
- Added current rank to largest-buy/sell summaries and recent whale trades.
- Activity rank matching now uses the complete filtered holder list.
- Displays `N/A` for wallets no longer holding HOODRAT.


## 2.4.0

- Added stale-cache fallback for holders, market data, transfers and activity.
- Increased full-holder rank cache to 10 minutes.
- Added in-flight request deduplication.
- Added complete activity-report cache.
- Added Top-300 rank fallback when full rank refresh fails.
- Added visible `[ CACHE ]` and rank-coverage notices.
- Prevented temporary upstream failures from causing hard command failures.


## 2.5.0

- Removed blocking complete-holder refresh from activity reports.
- Activity now returns immediately with Top-300 participant ranks.
- Complete participant ranks warm asynchronously in the background.
- Reuses the complete rank cache on later reports when available.
- Added rank-coverage notices to `activity` and `traders12`.


## 2.6.0

- Replaced request-driven activity loading with a background refresh service.
- Precomputes 12h and 24h activity reports every 60 seconds.
- User commands now read cached reports and no longer trigger bulk transfer fetches.
- Added compact missing-rank classifications:
  `N/A (Contract)`, `N/A (No Balance)`, and `N/A (Unranked)`.
- Added cached contract and current-balance classification.


## 2.7.0

- Added persistent Available Commands panel.
- Panel appears after the first `help` command.
- Added sticky desktop layout and responsive mobile fallback.
- Added click-to-fill command shortcuts without automatic execution.


## 2.8.0

- Visually detached the help panel from the main terminal.
- Prevented the command panel from obstructing wide activity tables.
- Fixed click-to-fill command shortcuts.
- Added direct prompt targeting, focus restoration, and cursor placement.


## 2.9.0

- Increased command-panel spacing.
- Shortened command descriptions.
- Added visible version badge.
- Added active-command highlighting.
- Fixed decimal holder-rank rendering.
- Right-aligned holder-rank columns.


## 3.0.0

- Simplified `help` output to a concise panel-open confirmation.
- Removed duplicated command documentation from terminal output.
- Removed version information from the sidebar.
- Added persistent version/build identification above the creator footer.


## 3.1.0

- Improved recent whale-trade information hierarchy.
- Moved Holder Rank before Wallet.
- Centered type, rank and time columns.
- Right-aligned HOODRAT amounts.
- Added compact trade timestamps.
- Updated visible version to v1.0.


## 3.1.1

- Fixed missing `formatAge()` frontend function.
- Restored `activity` and `traders12` commands.
- Removed duplicate trader-table header markup.


## 3.1.2

- Completed a full shared-helper audit across all command handlers.
- Verified missing and duplicate helper definitions at build time.
- Added a runtime frontend-integrity check.
- Confirmed all `formatAge()` call sites use the restored global helper.
- Updated visible build to `2026.08.03.2`.


## 3.2.0

- Expanded whale scope from Top 20 to Top 30.
- Added cached `whales12` analytics command.
- Added Top-30 behavior summary and status strength arrows.
- Reorganized sidebar commands into logical groups.
- Updated visible version to v1.0.


## 3.2.1

- Fixed `whales` returning only 20 participant wallets.
- Updated `/api/whales?limit=20` to `limit=30`.
- Updated the shared whale-table default to 30.


## 3.3.0

- Added unified token-terminal header matching the NFT Eligibility Checker.
- Added Balance to `whales12`.
- Added global token and compact-balance formatters.
- Removed raw blockchain precision from displayed analytics.
- Standardized whales12 alignment and status presentation.
- Fixed `whale <rank>` validation to support ranks 1–30.
- Updated visible version to v1.0.


## 3.3.1

- Fixed duplicate transfer refreshes behind `whales12`.
- Added cache-only activity report reads.
- Added shared in-flight refresh deduplication.
- Added cache-warming response and terminal notice.
- Updated visible build to `2026.08.03.6`.


## 3.3.2

- Fixed `whale 21` through `whale 30`.
- Updated whale-profile validation and lookup limits to Top 30.
- Updated visible build to `2026.08.03.7`.

## 3.3.3 - Blockscout rate-limit hardening

- Added a global Blockscout request queue with minimum spacing.
- Added HTTP 429 retry/backoff and `Retry-After` support.
- Prevented overlapping background activity refresh cycles.
- Changed 12h/24h cache refreshes to controlled sequential jobs.
- Bounded and serialized unknown-wallet classification requests.
- Preserved the last successful activity cache when refresh fails.
- Delayed initial cache warm-up by five seconds after startup.
- Fixed the activity classifier token constant reference.


## v3.3.5
- Added the shared inline orange HOODRAT market panel beneath the header.
- Removed duplicate market data from terminal startup output.
- Removed the TOKEN section and price/marketcap commands from the HELP sidebar.
- Preserved all whale analytics, caching, and rate-limit behavior.
