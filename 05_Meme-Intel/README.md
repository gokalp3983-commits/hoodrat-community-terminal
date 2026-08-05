# HOODRAT Meme Intelligence Terminal

A separate intelligence module for the HOODRAT Community Terminal. It complements—not duplicates—the Whale Activity Tracker.

## Commands

- `scan` — cross-signal market snapshot
- `pulse` — deterministic market-state interpretation
- `pressure` — classified 12-hour buy/sell pressure
- `fresh` — newly observed/unranked buyer flow
- `holders` — holder distribution and snapshot movement
- `risk` — transparent rule-based risk metrics
- `live` — notable recent activity
- `methodology` — definitions and limitations

## Render

- Root Directory: `05_Meme-Intel`
- Build Command: `npm install`
- Start Command: `npm start`

No wallet connection, transaction signing, private key, or financial recommendation is involved.


## Cache warm-up

The `scan`, `pulse`, `pressure`, `fresh`, `holders`, `risk`, and `live` commands depend on a background intelligence cache. After a cold Render start, the service fetches multiple Blockscout holder and transfer pages, classifies addresses and DEX activity, and deliberately spaces requests to reduce HTTP 429 rate-limit errors. The first complete cache may therefore take a few minutes. Use the `status` command to see whether each data source is `READY`, `BUILDING`, `EMPTY`, or `ERROR`. Transfer data is loaded from Blockscout’s v2 token-transfer endpoint with cursor pagination; the scan stops once it reaches the 24-hour cutoff.


## Initial cache safeguard

The first transfer scan is intentionally bounded to 30 pages or 120 seconds. It publishes a usable partial 12h/24h intelligence cache instead of keeping the terminal blocked during prolonged Blockscout throttling. Later background refreshes replace it with newer data.


## Responsiveness and status fixes

Commands that may require network or processing time immediately display a `[ PROCESSING ]` notice and remove it when the result or error is printed. The cache-status endpoint uses the same string keys as the activity cache, so completed 12-hour and 24-hour reports correctly appear as `READY`.


## Cache-state priority fix

The status endpoint now prioritizes usable cached data over an in-progress background refresh. If a holder, transfer, market, 12-hour, or 24-hour snapshot is already available, `status` reports `READY` even while a newer snapshot is being refreshed. Commands that may take noticeable time immediately display a `[ PROCESSING ]` notice.
