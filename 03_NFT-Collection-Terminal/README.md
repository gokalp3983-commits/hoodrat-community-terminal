# HOODRATS NFT Collection Terminal v2.0

Post-mint collection dashboard for the completed HOODRATS NFT mint.

## Preserved final mint data

- Final mint status
- Minted / 2,222
- Remaining supply
- Final progress percentage
- Unique holders
- Latest mint
- Final Blockscout-backed on-chain record

## OpenSea collection data

The page includes a collection market panel for:

- Floor price
- Total volume
- Owners
- Sales
- Listed items
- Official OpenSea collection link

Set this environment variable in Render:

```text
OPENSEA_API_KEY=your_key_here
```

The backend then calls:

```text
https://api.opensea.io/api/v2/collections/hoodrats-nft/stats
```

Collection data is cached for 60 seconds. Without the API key, the page
shows `API KEY REQUIRED` instead of displaying invented values.

Official collection:
https://opensea.io/collection/hoodrats-nft/overview


## v2.0.1 polish

- Replaced `API KEY REQUIRED` with a visitor-friendly `CONNECTING` state.
- Added an OpenSea collection-statistics `Updated` timestamp.
- Added `[ INFO ] Collection statistics powered by OpenSea API.`
- Expanded the independent-tool disclaimer.
- Live marketplace data still activates automatically when `OPENSEA_API_KEY` is configured.


## v2.1 — NFT Whale Analytics

- Top 25 current NFT holders
- NFT whale count (10+ NFTs)
- Largest holder
- Top-10 ownership concentration
- Ownership distribution buckets
- Wallet rank and holdings lookup
- Two-minute server-side holder cache
- Blockscout 429 retry handling

The holder analytics use Blockscout's token-holder API and contain no simulated values.


## v2.1.1

- Added a copy button beside every Top-25 NFT whale wallet address.
- Added success and failure feedback directly on the copy icon.
- Included a clipboard fallback for browsers without the modern Clipboard API.
- Standardized typography to the same monospace font stack used by the Landing Page and other HOODRAT tools.


## v2.2 — NFT whale token holdings

- Renamed `Share` to `NFT Share`.
- Added `HOODRAT Tokens` as the final table column.
- Centered NFT count, NFT share, and token-holding columns.
- NFT holder rankings refresh every 2 minutes.
- Top-25 HOODRAT token balances refresh every 5 minutes.
- Token balances are loaded sequentially with a delay to reduce Blockscout rate-limit pressure.
- Individual failed token-balance reads display `—`.


## v2.2.1 bug fixes

- Fixed NFT Share to use the total collection supply of 2,222.
- Improved Blockscout v2 token-balance response parsing.
- Added a single-token balance fallback for HOODRAT.
- Preserved the existing 2-minute and 5-minute cache intervals.


## v2.2.2

- NFT rankings return immediately instead of waiting for Top-25 token balances.
- HOODRAT balances warm asynchronously in the background.
- The page retries after 15 seconds while token balances are warming.
- Token-balance failures no longer take down NFT rankings.
- Stale-cache responses preserve NFT Share and cached token balances.


## v2.2.3

- Moved the completed-mint notice directly above the Final Mint Record.
- Removed the misplaced notice from the bottom of the page.


## v2.2.4 holder API fix

- Replaced the older legacy `getTokenHolders` request with Blockscout v2 `/tokens/<contract>/holders`.
- Added pagination through all current holder pages.
- Aggregates duplicate holder rows safely for ERC-721 data.
- Supports current Blockscout address response shapes.
- Keeps HOODRAT token balances asynchronous, so they cannot block rankings.


## v2.3 — Shared Community Terminal design

- Applied the Landing Page's HOODRAT Community Terminal header.
- Added the green `NFT Collection Terminal` module identifier immediately before the LIVE panel.
- Aligned every LIVE-panel colon and value in fixed terminal columns.
- Updated the boot copy and shared suite footer.
- Preserved mint records, OpenSea integration, NFT whales, token holdings, and wallet lookup.


## v2.4 — Landing Page master shell

The NFT Collection Terminal now uses the polished Landing Page as its structural and visual source:

- `terminal-frame`
- `terminal-header`
- `terminal-live-panel`
- `terminal-application`
- `terminal-prompt`
- `terminal-footer`

All NFT-specific content remains inside `terminal-application`.
OpenSea, mint statistics, whale analytics, wallet lookup, and existing API logic are preserved.


## v2.4.2

- Matched the landing-page outer green frame.
- Fixed LIVE-panel grid alignment.
- Added live Holders and 24h Volume fields.
- Standardized the footer version block.
- Preserved: `Collection statistics powered by OpenSea API.`
- Restored NFT-specific disclaimer and OpenSea link wording.


## NFT Sales Tracker

The NFT terminal includes an always-visible, text-only OpenSea sales feed. Sales strictly above 0.5 ETH (or WETH) receive an animated high-value highlight and badge; reduced-motion browser preferences disable the animation. The server polls the OpenSea collection events endpoint every 90 seconds, caches the latest sales, and exposes them through `/api/nft-sales`. The browser refreshes the panel every 60 seconds and retains the last successful feed if OpenSea is temporarily unavailable. The existing `OPENSEA_API_KEY` Render environment variable is required.

## 12-hour floor trend

The OpenSea floor-price card records lightweight snapshots and compares the current floor with the latest snapshot that is at least 12 hours old. It displays an up/down indicator and highlights moves of 25% or more. The first comparison becomes available after a 12-hour baseline has been collected.

By default, snapshots are stored at `data/floor-history.json`. Render's normal filesystem is ephemeral, so for a baseline that survives redeploys/restarts, attach a small Render persistent disk and set:

```text
FLOOR_HISTORY_FILE=/var/data/floor-history.json
```

If no persistent disk is configured, the indicator still works while the current Render instance remains alive, but its baseline restarts after a redeploy or cold replacement.
