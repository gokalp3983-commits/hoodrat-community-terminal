"use strict";

const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);

const TOKEN_CONTRACT =
  "0x8e62F281f282686fCa6dCB39288069a93fC23F1c";
const DEXSCREENER_CHAIN_ID = "robinhood";
const PRICE_CACHE_TTL_MS = 30 * 1000;
const BLOCKSCOUT_API_BASE =
  "https://robinhoodchain.blockscout.com/api/v2";
const REQUEST_TIMEOUT_MS = 15_000;

let priceCache = null;

app.disable("x-powered-by");

app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html"],
    maxAge: "1h",
  })
);

function formatPriceUsd(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price <= 0) return null;
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(6);
  return price.toFixed(8);
}

function formatPriceEth(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price <= 0) return null;

  return price
    .toFixed(10)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatCompactUsd(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }

  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }

  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(2)}K`;
  }

  return `$${amount.toFixed(2)}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "HOODRAT-Projects-Terminal/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function getHoodratMarket() {
  if (
    priceCache &&
    Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL_MS
  ) {
    return priceCache;
  }

  const url =
    `https://api.dexscreener.com/token-pairs/v1/` +
    `${DEXSCREENER_CHAIN_ID}/${TOKEN_CONTRACT}`;

  const pairs = await fetchJson(url);

  if (!Array.isArray(pairs)) {
    throw new Error("Unexpected DexScreener response");
  }

  const tokenLower = TOKEN_CONTRACT.toLowerCase();

  const selected = pairs
    .filter((pair) => {
      const baseAddress = String(
        pair?.baseToken?.address || ""
      ).toLowerCase();

      const quoteSymbol = String(
        pair?.quoteToken?.symbol || ""
      ).toUpperCase();

      return (
        baseAddress === tokenLower &&
        ["WETH", "ETH"].includes(quoteSymbol) &&
        Number(pair?.priceUsd) > 0 &&
        Number(pair?.priceNative) > 0
      );
    })
    .sort(
      (a, b) =>
        Number(b?.liquidity?.usd || 0) -
        Number(a?.liquidity?.usd || 0)
    )[0];

  if (!selected) {
    throw new Error("No liquid HOODRAT/WETH pair found");
  }

  let holdersCount = null;

  try {
    const tokenInfo = await fetchJson(
      `${BLOCKSCOUT_API_BASE}/tokens/${TOKEN_CONTRACT}`
    );

    const parsedHolders = Number(
      tokenInfo?.holders_count
    );

    holdersCount = Number.isFinite(parsedHolders)
      ? Math.trunc(parsedHolders)
      : null;
  } catch (error) {
    console.error(
      "Holder-count lookup failed:",
      error
    );
  }

  priceCache = {
    fetchedAt: Date.now(),
    priceUsd: Number(selected.priceUsd),
    priceEth: Number(selected.priceNative),
    marketCapUsd: Number(
      selected.marketCap ||
      selected.fdv ||
      0
    ),
    volume24hUsd: Number(
      selected?.volume?.h24 || 0
    ),
    holdersCount,
  };

  return priceCache;
}

app.get("/api/price", async (_req, res) => {
  try {
    const market = await getHoodratMarket();

    res.json({
      available: true,
      priceUsd: formatPriceUsd(market.priceUsd),
      priceEth: formatPriceEth(market.priceEth),
      marketCapDisplay: formatCompactUsd(
        market.marketCapUsd
      ),
      holdersDisplay:
        Number.isFinite(market.holdersCount)
          ? market.holdersCount.toLocaleString("en-US")
          : "UNAVAILABLE",
      volume24hDisplay:
        formatCompactUsd(market.volume24hUsd) ||
        "UNAVAILABLE",
    });
  } catch (error) {
    console.error("Market lookup failed:", error);

    res.status(503).json({
      available: false,
      error: "Live HOODRAT market data is unavailable.",
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "HOODRAT Projects",
    version: "1.4.3",
  });
});

app.get("*", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(port, "0.0.0.0", () => {
  console.log("");
  console.log("[ OK ] HOODRAT Projects server started.");
  console.log(`[ READY ] Open: http://localhost:${port}`);
  console.log("");
});
