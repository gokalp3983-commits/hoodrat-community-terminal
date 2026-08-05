# HOODRAT Landing Page

Terminal-style launcher for HOODRAT Projects.

## Modules

- `holders` — NFT Eligibility Checker
- `whales` — Whale Activity Tracker
- `intel` — Meme Intelligence Terminal
- `about` — About HOODRAT Projects
- `clear` — Clear terminal output

The project cards are also clickable and place the corresponding command into
the prompt.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Railway

Deploy this repository as a Node.js service. Railway will run:

```bash
npm start
```

The server automatically uses Railway's `PORT` environment variable.

## Module URLs

Module destinations are defined near the top of:

```text
public/script.js
```

Current destinations:

- NFT Eligibility Checker:
  `https://hoodrat-holder-checker-production.up.railway.app/`
- Whale Activity Tracker:
  `https://whale-activity-tracker-production.up.railway.app/`

## v1.1.0 — Whale Tracker visual alignment

- Updated the landing page to match the Whale Activity Tracker’s terminal theme.
- Aligned typography, proportions, borders, spacing, prompt and footer treatment.
- Reduced the mascot and header scale for the same compact terminal rhythm.
- Updated the boot sequence and version to v1.1.0.

## v1.2.0 — Developing module preview

- Added `mint` — NFT Mint Tracker.
- Displays the module with yellow `[ DEVELOPING ]` status.
- Added the developing module to boot output and `help`.
- The `mint` command shows planned features without redirecting.
- Kept the product header as `HOODRAT Projects`.

## v1.2.1 — Eligibility command rename

- Renamed the official NFT Eligibility Checker command from `holders` to
  `eligibility`.
- Updated the module card and `help` output.
- Kept `holders` and `checker` as hidden aliases for backward compatibility.

## v1.2.2
- Modules now open in a new browser tab.

## v1.2.3
- Startup console now prints clickable localhost URL.

Development branding keeps UI at v1.0 until public Railway release.


## Render deployment links

- Eligibility Checker:
  `https://hoodrat-holder-checker.onrender.com/`
- Whale Activity Tracker:
  `https://whale-activity-tracker-xnj8.onrender.com/`
- Meme Intelligence Terminal:
  `https://zero5-meme-intel.onrender.com/`

Startup and card statuses use `READY` and `COMING SOON`.


## Live market summary

The landing-page startup now displays:

- Current HOODRAT price in USD and ETH
- Current market capitalization

Market data comes from the highest-liquidity
HOODRAT/WETH pair returned by DexScreener and is
cached by the server for 30 seconds.


## Floating market widget

- Added one persistent `$HOODRAT MARKET` box.
- It remains visible while terminal commands and output scroll.
- It displays USD/ETH price, market cap, live status, and update time.
- It refreshes through the existing cached `/api/price` endpoint every 30 seconds.
- Removed the duplicated price and market-cap lines from terminal startup.
- Market data is not repeated in HELP or command output.
- On mobile, the widget moves into normal page flow so it cannot cover the prompt.


## Top-right market widget

- Moved the persistent market widget from bottom-right to top-right on desktop.
- Reduced its width slightly so it stays informative without dominating the page.
- Mobile behavior remains unchanged: the widget moves into normal document flow.


## Inline market panel

- Replaced the floating market widget with an inline terminal market panel.
- The panel appears beneath the header and above the boot sequence.
- Price, market cap, and update time are left-aligned and orange.
- Each row uses terminal-style `[ LIVE ]` status labels.
- No fixed positioning is used, so the panel cannot overlap the terminal at 100% zoom.
- Market data continues refreshing through the cached `/api/price` endpoint every 30 seconds.


## NFT Mint Tracker live

- Mint Tracker status changed from `COMING SOON` to `LIVE`.
- `mint` now opens the deployed tracker in a new tab.
- Mint Tracker URL: `https://nft-mint-tracker-z76h.onrender.com/`
- Boot sequence, HELP output, and module status were updated.


## NFT collection command

- Primary command changed from `mint` to `nft`.
- `nft` opens the HOODRATS NFT Collection Terminal.
- `mint` remains as a hidden compatibility alias.
- Landing-page card and HELP output now use `nft`.
- Module status is `COMPLETE`.


## v1.1.1

- Fixed the visible NFT module command label from `mint` to `nft`.
- Preserved `mint` as a hidden compatibility alias.
- Updated the module description for the post-mint Collection Terminal.


## v1.2.1 community header

- Replaced the original title block with the HOODRATS Community Terminal header.
- Added a compact mascot, orange terminal dividers, and pulsing ONLINE status.
- Added the subtitle: `Independent Community Tools • Robinhood Chain Ecosystem`.
- Expanded the live market strip with holder count and 24-hour volume.


## v1.2.2 branding refinement

- Changed `HOODRATS COMMUNITY TERMINAL` to `HOODRAT COMMUNITY TERMINAL`.
- Updated the footer branding to `HOODRAT Community Terminal v1`.
- Matched the live `Updated` row font size and line height to the other market rows.


## v1.2.3 live-panel alignment

- Converted the live market panel to a fixed terminal-style grid.
- All colons now align in one vertical column.
- All values begin at the same horizontal position.
- Preserved equal font sizing for Price, Market Cap, Holders, 24h Volume, and Updated.
- Added a compact responsive grid for small screens.


## v1.4 — Canonical terminal shell

Shared outer structure:

- `terminal-frame` — entire green outline
- `terminal-header` — mascot, title, ONLINE state, subtitle and module title
- `terminal-live-panel` — aligned live market data
- `terminal-application` — all page-specific content
  - `terminal-output-area`
  - `terminal-modules`
- `terminal-prompt` — command input
- `terminal-footer` — version and disclaimer

Landing module card order is fixed directly in HTML:

1. `whales`
2. `nft`
3. `eligibility`

The original styling and functionality remain intact.


## v1.4.1 — Final landing-page polish

- Removed the excess vertical gap between the READY output and module-card area.
- Changed the visible command hint from `HELP` to lowercase `help`.
- Brightened the footer disclaimer for improved readability.
- Preserved the canonical master-shell regions and module order:
  `whales`, `nft`, `eligibility`.


## v1.4.2 — Visible spacing fixes

- Removed the fixed 190px minimum height from the boot area.
- Empty command output no longer reserves 78px of blank space.
- Module cards now begin directly after the READY output.
- Footer disclaimer now uses a clearly brighter readable color.


## v1.4.3 — Eligibility archive status

The landing-page module cards now reflect their current lifecycle state:

- `whales` — `[ READY ]`
- `nft` — `[ COMPLETE ]`
- `eligibility` — `[ ARCHIVE ]`

All v1.4.2 spacing, lowercase `help`, footer readability, and master-shell fixes are preserved.


## Meme Intelligence Terminal

- Added the visible `intel` command and module card.
- `intel` opens `https://zero5-meme-intel.onrender.com/` in a new tab.
- Added the module to startup status, `help`, and the canonical card order.
- The landing page now displays four modules in a balanced 2×2 grid.


## Module order update

The landing page presents modules in this order:

1. `whales` — Whale Activity Tracker
2. `intel` — Meme Intelligence Terminal
3. `nft` — HOODRATS NFT Collection Terminal
4. `eligibility` — NFT Eligibility Checker Archive
