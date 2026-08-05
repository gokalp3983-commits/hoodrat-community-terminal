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

The `scan`, `pulse`, `pressure`, `fresh`, `holders`, `risk`, and `live` commands depend on a background intelligence cache. After a cold Render start, the service fetches multiple Blockscout holder and transfer pages, classifies addresses and DEX activity, and deliberately spaces requests to reduce HTTP 429 rate-limit errors. The first complete cache may therefore take a few minutes. Use the `status` command to see whether each data source is `READY`, `BUILDING`, or `EMPTY`.
