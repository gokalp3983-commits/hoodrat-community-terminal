"use strict";
const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);

const TOKEN_CONTRACT =
  "0x8e62F281f282686fCa6dCB39288069a93fC23F1c";
const DEXSCREENER_CHAIN_ID = "robinhood";
const PRICE_CACHE_TTL_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

let priceCache = null;

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));

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
      "User-Agent": "HOODRAT-NFT-Mint-Tracker/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function getHoodratPrice() {
  if (
    priceCache &&
    Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL_MS
  ) {
    return {
      ...priceCache,
      source: "memory",
      ageSeconds: Math.floor(
        (Date.now() - priceCache.fetchedAt) / 1000
      ),
    };
  }

  const url =
    `https://api.dexscreener.com/token-pairs/v1/` +
    `${DEXSCREENER_CHAIN_ID}/${TOKEN_CONTRACT}`;

  const pairs = await fetchJson(url);

  if (!Array.isArray(pairs)) {
    throw new Error("Unexpected DexScreener pair response");
  }

  const tokenLower = TOKEN_CONTRACT.toLowerCase();

  const selected = pairs
    .filter((pair) => {
      const baseAddress =
        String(pair?.baseToken?.address ?? "").toLowerCase();

      const quoteSymbol =
        String(pair?.quoteToken?.symbol ?? "").toUpperCase();

      return (
        baseAddress === tokenLower &&
        ["WETH", "ETH"].includes(quoteSymbol) &&
        Number(pair?.priceUsd) > 0 &&
        Number(pair?.priceNative) > 0
      );
    })
    .sort(
      (a, b) =>
        Number(b?.liquidity?.usd ?? 0) -
        Number(a?.liquidity?.usd ?? 0)
    )[0];

  if (!selected) {
    throw new Error("No liquid HOODRAT/WETH market was found");
  }

  let holdersCount = null;

  try {
    const tokenInfo = await fetchJson(
      `https://robinhoodchain.blockscout.com/api/v2/tokens/${TOKEN_CONTRACT}`
    );

    const parsedHolders = Number(tokenInfo?.holders_count);
    holdersCount = Number.isFinite(parsedHolders)
      ? Math.trunc(parsedHolders)
      : null;
  } catch (error) {
    console.error("[holders] failed:", error);
  }

  priceCache = {
    fetchedAt: Date.now(),
    priceUsd: Number(selected.priceUsd),
    priceEth: Number(selected.priceNative),
    marketCapUsd: Number(
      selected?.marketCap ??
      selected?.fdv ??
      0
    ),
    volume24hUsd: Number(selected?.volume?.h24 ?? 0),
    holdersCount,
  };

  return {
    ...priceCache,
    source: "fresh",
    ageSeconds: 0,
  };
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "NFT Mint Tracker Simulation",
    version: "2.4.2",
  });
});

app.get("/api/price", async (_req, res) => {
  try {
    const market = await getHoodratPrice();

    res.json({
      priceUsd: formatPriceUsd(market.priceUsd),
      priceEth: formatPriceEth(market.priceEth),
      marketCapDisplay:
        formatCompactUsd(market.marketCapUsd) || "UNAVAILABLE",
      holdersDisplay:
        Number.isFinite(market.holdersCount)
          ? market.holdersCount.toLocaleString("en-US")
          : "UNAVAILABLE",
      volume24hDisplay:
        formatCompactUsd(market.volume24hUsd) || "UNAVAILABLE",
      source: market.source,
      ageSeconds: market.ageSeconds,
    });
  } catch (error) {
    console.error("[price] failed:", error);
    res.status(502).json({
      error: "Unable to load current HOODRAT market data.",
    });
  }
});


const NFT_CONTRACT =
  "0xc06a2fa2dc084017e5c06a1ed0941042ab363784";
const NFT_MAX_SUPPLY = 2222;
const BLOCKSCOUT_API_BASE =
  "https://robinhoodchain.blockscout.com/api/v2";
const MINT_STATS_CACHE_TTL_MS = 15 * 1000;
const MINT_RATE_WINDOW_MS = 10 * 60 * 1000;
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

let mintStatsCache = null;
let mintStatsRefreshPromise = null;

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAddressHash(value) {
  if (!value) return "";
  if (typeof value === "string") return value.toLowerCase();

  return String(
    value.hash ??
    value.address_hash ??
    value.address ??
    ""
  ).toLowerCase();
}

function getTransferTimestamp(item) {
  const raw =
    item?.timestamp ??
    item?.block_timestamp ??
    item?.transaction?.timestamp ??
    null;

  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTransferTokenId(item) {
  const value =
    item?.token_id ??
    item?.total?.token_id ??
    item?.token_ids?.[0] ??
    item?.token?.id ??
    null;

  return value == null ? null : String(value);
}

function getTransferTxHash(item) {
  return String(
    item?.transaction_hash ??
    item?.transaction?.hash ??
    item?.tx_hash ??
    ""
  );
}

function isMintTransfer(item) {
  return getAddressHash(item?.from) === ZERO_ADDRESS;
}

function shortenAddress(address) {
  const value = String(address || "");
  if (value.length < 12) return value || "—";

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function fetchBlockscoutJson(pathname, attempt = 0) {
  const response = await fetch(
    `${BLOCKSCOUT_API_BASE}${pathname}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "HOODRAT-NFT-Mint-Tracker/1.3",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (response.status === 429 && attempt < 3) {
    const retryAfterSeconds =
      Number(response.headers.get("retry-after")) || 0;

    const waitMs = retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 1000 * (2 ** attempt);

    await new Promise((resolve) =>
      setTimeout(resolve, waitMs)
    );

    return fetchBlockscoutJson(pathname, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(
      `Blockscout request failed: HTTP ${response.status}`
    );
  }

  return response.json();
}

function buildTransfersPath(nextPageParams = null) {
  const base =
    `/tokens/${NFT_CONTRACT}/transfers`;

  if (!nextPageParams) return base;

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(
    nextPageParams
  )) {
    if (value !== null && value !== undefined) {
      query.set(key, String(value));
    }
  }

  return `${base}?${query.toString()}`;
}

async function fetchRecentMintTransfers() {
  const cutoff = Date.now() - MINT_RATE_WINDOW_MS;
  const mints = [];
  let nextPageParams = null;

  // A few recent pages are enough for rate and latest-mint data.
  // This deliberately avoids crawling the full collection every refresh.
  for (let page = 0; page < 6; page += 1) {
    const payload = await fetchBlockscoutJson(
      buildTransfersPath(nextPageParams)
    );

    const items = Array.isArray(payload?.items)
      ? payload.items
      : [];

    let reachedOldTransfer = false;

    for (const item of items) {
      if (!isMintTransfer(item)) continue;

      const timestamp = getTransferTimestamp(item);

      if (timestamp && timestamp.getTime() < cutoff) {
        reachedOldTransfer = true;
      }

      mints.push({
        timestamp,
        tokenId: getTransferTokenId(item),
        to: getAddressHash(item?.to),
        txHash: getTransferTxHash(item),
      });
    }

    nextPageParams = payload?.next_page_params ?? null;

    if (
      reachedOldTransfer ||
      !nextPageParams ||
      items.length === 0
    ) {
      break;
    }

    // Keep requests spaced to reduce rate-limit pressure.
    await new Promise((resolve) =>
      setTimeout(resolve, 300)
    );
  }

  return mints;
}

async function loadLiveMintStats() {
  const [tokenInfo, counters, recentMints] =
    await Promise.all([
      fetchBlockscoutJson(
        `/tokens/${NFT_CONTRACT}`
      ),
      fetchBlockscoutJson(
        `/tokens/${NFT_CONTRACT}/counters`
      ).catch(() => null),
      fetchRecentMintTransfers().catch(() => []),
    ]);

  const minted = Math.max(
    0,
    Math.min(
      NFT_MAX_SUPPLY,
      Math.trunc(asNumber(tokenInfo?.total_supply))
    )
  );

  const remaining = Math.max(
    0,
    NFT_MAX_SUPPLY - minted
  );

  const progressPercent =
    NFT_MAX_SUPPLY > 0
      ? (minted / NFT_MAX_SUPPLY) * 100
      : 0;

  const holders = Math.max(
    0,
    Math.trunc(
      asNumber(
        tokenInfo?.holders_count ??
        counters?.token_holders_count
      )
    )
  );

  const windowStart =
    Date.now() - MINT_RATE_WINDOW_MS;

  const mintsInWindow = recentMints.filter(
    (mint) =>
      mint.timestamp &&
      mint.timestamp.getTime() >= windowStart
  );

  const mintRatePerMinute =
    mintsInWindow.length / (
      MINT_RATE_WINDOW_MS / 60_000
    );

  const latest = recentMints
    .filter((mint) => mint.timestamp)
    .sort(
      (a, b) =>
        b.timestamp.getTime() -
        a.timestamp.getTime()
    )[0] ?? recentMints[0] ?? null;

  let status = "WAITING";

  if (minted >= NFT_MAX_SUPPLY) {
    status = "COMPLETE";
  } else if (minted > 0) {
    status = "LIVE";
  }

  return {
    connected: true,
    source: "Robinhood Chain Blockscout",
    status,
    totalSupply: NFT_MAX_SUPPLY,
    minted,
    remaining,
    progressPercent:
      Number(progressPercent.toFixed(2)),
    uniqueHolders: holders,
    mintRatePerMinute:
      Number(mintRatePerMinute.toFixed(1)),
    latestMint: latest
      ? {
          tokenId: latest.tokenId,
          to: latest.to,
          toDisplay: shortenAddress(latest.to),
          txHash: latest.txHash,
          timestamp:
            latest.timestamp?.toISOString() ?? null,
        }
      : null,
    updatedAt: new Date().toISOString(),
  };
}

async function getLiveMintStats() {
  if (
    mintStatsCache &&
    Date.now() - mintStatsCache.fetchedAt <
      MINT_STATS_CACHE_TTL_MS
  ) {
    return {
      ...mintStatsCache.data,
      cacheAgeSeconds: Math.floor(
        (Date.now() - mintStatsCache.fetchedAt) /
        1000
      ),
    };
  }

  if (mintStatsRefreshPromise) {
    return mintStatsRefreshPromise;
  }

  mintStatsRefreshPromise = (async () => {
    try {
      const data = await loadLiveMintStats();

      mintStatsCache = {
        fetchedAt: Date.now(),
        data,
      };

      return {
        ...data,
        cacheAgeSeconds: 0,
      };
    } finally {
      mintStatsRefreshPromise = null;
    }
  })();

  return mintStatsRefreshPromise;
}

app.get("/api/mint-stats", async (_req, res) => {
  try {
    const stats = await getLiveMintStats();
    res.json(stats);
  } catch (error) {
    console.error("[mint-stats] failed:", error);

    if (mintStatsCache?.data) {
      res.json({
        ...mintStatsCache.data,
        stale: true,
        error:
          "Live refresh failed; serving last successful data.",
      });
      return;
    }

    res.status(502).json({
      connected: false,
      status: "UNAVAILABLE",
      totalSupply: NFT_MAX_SUPPLY,
      minted: null,
      remaining: null,
      progressPercent: null,
      uniqueHolders: null,
      mintRatePerMinute: null,
      latestMint: null,
      updatedAt: null,
      error:
        "Unable to load live mint data from Blockscout.",
    });
  }
});


const OPENSEA_COLLECTION_SLUG = "hoodrats-nft";
const OPENSEA_API_KEY =
  String(process.env.OPENSEA_API_KEY || "").trim();
const OPENSEA_STATS_CACHE_TTL_MS = 60 * 1000;

let openSeaStatsCache = null;
let openSeaStatsPromise = null;

function formatEthValue(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  if (amount >= 1000) return amount.toFixed(0);
  if (amount >= 100) return amount.toFixed(1);
  if (amount >= 1) return amount.toFixed(3);

  return amount
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

async function loadOpenSeaCollectionStats() {
  if (!OPENSEA_API_KEY) {
    return {
      connected: false,
      requiresApiKey: true,
      floorPriceEth: null,
      totalVolumeEth: null,
      sales: null,
      owners: null,
      listed: null,
      source: "OpenSea",
      updatedAt: null,
    };
  }

  const response = await fetch(
    `https://api.opensea.io/api/v2/collections/` +
    `${OPENSEA_COLLECTION_SLUG}/stats`,
    {
      headers: {
        Accept: "application/json",
        "X-API-KEY": OPENSEA_API_KEY,
        "User-Agent": "HOODRATS-NFT-Collection-Terminal/2.0",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(
      `OpenSea stats request failed: HTTP ${response.status}`
    );
  }

  const payload = await response.json();
  const total = payload?.total ?? payload ?? {};

  const floorPriceEth = firstFiniteNumber(
    total?.floor_price,
    total?.floorPrice,
    payload?.floor_price,
    payload?.floorPrice
  );

  const totalVolumeEth = firstFiniteNumber(
    total?.volume,
    total?.total_volume,
    total?.totalVolume,
    payload?.total_volume
  );

  const sales = firstFiniteNumber(
    total?.sales,
    total?.total_sales,
    total?.totalSales
  );

  const owners = firstFiniteNumber(
    total?.num_owners,
    total?.numOwners,
    total?.owners
  );

  const listed = firstFiniteNumber(
    total?.num_listed,
    total?.numListed,
    total?.listed
  );

  return {
    connected: true,
    requiresApiKey: false,
    floorPriceEth,
    floorPriceDisplay:
      floorPriceEth == null
        ? "UNAVAILABLE"
        : `${formatEthValue(floorPriceEth)} ETH`,
    totalVolumeEth,
    totalVolumeDisplay:
      totalVolumeEth == null
        ? "UNAVAILABLE"
        : `${formatEthValue(totalVolumeEth)} ETH`,
    sales,
    owners,
    listed,
    source: "OpenSea",
    updatedAt: new Date().toISOString(),
  };
}

async function getOpenSeaCollectionStats() {
  if (
    openSeaStatsCache &&
    Date.now() - openSeaStatsCache.fetchedAt <
      OPENSEA_STATS_CACHE_TTL_MS
  ) {
    return {
      ...openSeaStatsCache.data,
      cacheAgeSeconds: Math.floor(
        (Date.now() - openSeaStatsCache.fetchedAt) /
        1000
      ),
    };
  }

  if (openSeaStatsPromise) {
    return openSeaStatsPromise;
  }

  openSeaStatsPromise = (async () => {
    try {
      const data = await loadOpenSeaCollectionStats();

      openSeaStatsCache = {
        fetchedAt: Date.now(),
        data,
      };

      return {
        ...data,
        cacheAgeSeconds: 0,
      };
    } finally {
      openSeaStatsPromise = null;
    }
  })();

  return openSeaStatsPromise;
}

app.get("/api/collection-stats", async (_req, res) => {
  try {
    const stats = await getOpenSeaCollectionStats();
    res.json(stats);
  } catch (error) {
    console.error("[collection-stats] failed:", error);

    if (openSeaStatsCache?.data) {
      res.json({
        ...openSeaStatsCache.data,
        stale: true,
        error:
          "OpenSea refresh failed; serving last successful data.",
      });
      return;
    }

    res.status(502).json({
      connected: false,
      requiresApiKey: !OPENSEA_API_KEY,
      floorPriceEth: null,
      floorPriceDisplay: "UNAVAILABLE",
      totalVolumeEth: null,
      totalVolumeDisplay: "UNAVAILABLE",
      sales: null,
      owners: null,
      listed: null,
      source: "OpenSea",
      updatedAt: null,
      error:
        "Unable to load OpenSea collection statistics.",
    });
  }
});


const NFT_HOLDERS_CACHE_TTL_MS = 2 * 60 * 1000;
const NFT_WHALE_TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const NFT_WHALE_TOKEN_REQUEST_DELAY_MS = 350;
const HOODRAT_TOKEN_CONTRACT =
  "0x8e62F281f282686fCa6dCB39288069a93fC23F1c";
let nftWhaleTokenCache = null;
let nftWhaleTokenPromise = null;

const NFT_WHALE_THRESHOLD = 10;
let nftHoldersCache = null;
let nftHoldersPromise = null;

async function fetchLegacyBlockscoutJson(params, attempt = 0) {
  const query = new URLSearchParams(params);
  const url =
    `https://robinhoodchain.blockscout.com/api?${query}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "HOODRATS-NFT-Collection-Terminal/2.1",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 429 && attempt < 3) {
    const retryAfter =
      Number(response.headers.get("retry-after")) || 0;
    const waitMs = retryAfter > 0
      ? retryAfter * 1000
      : 1000 * (2 ** attempt);

    await new Promise((resolve) =>
      setTimeout(resolve, waitMs)
    );

    return fetchLegacyBlockscoutJson(
      params,
      attempt + 1
    );
  }

  if (!response.ok) {
    throw new Error(
      `Blockscout holders request failed: HTTP ${response.status}`
    );
  }

  const payload = await response.json();

  if (
    payload?.status !== "1" ||
    !Array.isArray(payload?.result)
  ) {
    throw new Error(
      payload?.message ||
      "Unexpected Blockscout holders response"
    );
  }

  return payload.result;
}

function normalizeHolder(item) {
  const address = String(
    item?.address?.hash ??
    item?.address ??
    item?.address_hash?.hash ??
    item?.address_hash ??
    ""
  ).toLowerCase();

  const rawValue =
    item?.value ??
    item?.balance ??
    1;

  const count = Math.max(
    0,
    Math.trunc(Number(rawValue))
  );

  return { address, count };
}

function distributionBucket(count) {
  if (count === 1) return "1";
  if (count === 2) return "2";
  if (count <= 5) return "3-5";
  if (count <= 9) return "6-9";
  return "10+";
}

async function fetchAllNftHoldersV2() {
  const aggregated = new Map();
  let nextPageParams = null;

  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams();

    if (nextPageParams) {
      for (const [key, value] of Object.entries(
        nextPageParams
      )) {
        if (
          value !== null &&
          value !== undefined
        ) {
          query.set(key, String(value));
        }
      }
    }

    const suffix = query.toString()
      ? `?${query.toString()}`
      : "";

    const payload = await fetchBlockscoutJson(
      `/tokens/${NFT_CONTRACT}/holders${suffix}`
    );

    const items = Array.isArray(payload?.items)
      ? payload.items
      : [];

    for (const item of items) {
      const holder = normalizeHolder(item);

      if (
        !/^0x[a-f0-9]{40}$/.test(holder.address) ||
        holder.count <= 0
      ) {
        continue;
      }

      aggregated.set(
        holder.address,
        (aggregated.get(holder.address) || 0) +
        holder.count
      );
    }

    nextPageParams =
      payload?.next_page_params ?? null;

    if (!nextPageParams || items.length === 0) {
      break;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 120)
    );
  }

  return Array.from(
    aggregated,
    ([address, count]) => ({
      address,
      count,
    })
  );
}

async function loadNftHolderAnalytics() {
  const holders = (await fetchAllNftHoldersV2())
    .filter(
      (holder) =>
        /^0x[a-f0-9]{40}$/.test(holder.address) &&
        holder.count > 0
    )
    .sort((a, b) => b.count - a.count);

  if (holders.length === 0) {
    throw new Error(
      "Blockscout returned no NFT holders."
    );
  }

  const totalHeld = holders.reduce(
    (sum, holder) => sum + holder.count,
    0
  );

  const distribution = {
    "1": 0,
    "2": 0,
    "3-5": 0,
    "6-9": 0,
    "10+": 0,
  };

  for (const holder of holders) {
    distribution[distributionBucket(holder.count)] += 1;
  }

  const top10Held = holders
    .slice(0, 10)
    .reduce((sum, holder) => sum + holder.count, 0);

  return {
    connected: true,
    totalHolders: holders.length,
    totalHeld,
    largestHolder: holders[0]?.count ?? 0,
    averageHeld:
      holders.length > 0
        ? Number((totalHeld / holders.length).toFixed(2))
        : 0,
    whaleThreshold: NFT_WHALE_THRESHOLD,
    whaleCount: holders.filter(
      (holder) =>
        holder.count >= NFT_WHALE_THRESHOLD
    ).length,
    top10ConcentrationPercent:
      totalHeld > 0
        ? Number(
            ((top10Held / totalHeld) * 100).toFixed(2)
          )
        : 0,
    distribution,
    holders,
    updatedAt: new Date().toISOString(),
  };
}

async function getNftHolderAnalytics() {
  if (
    nftHoldersCache &&
    Date.now() - nftHoldersCache.fetchedAt <
      NFT_HOLDERS_CACHE_TTL_MS
  ) {
    return nftHoldersCache.data;
  }

  if (nftHoldersPromise) return nftHoldersPromise;

  nftHoldersPromise = (async () => {
    try {
      const data = await loadNftHolderAnalytics();
      nftHoldersCache = {
        fetchedAt: Date.now(),
        data,
      };
      return data;
    } finally {
      nftHoldersPromise = null;
    }
  })();

  return nftHoldersPromise;
}


function formatTokenAmount(rawValue, decimals = 18) {
  try {
    const raw = BigInt(String(rawValue ?? "0"));
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;

    const fractionText = fraction
      .toString()
      .padStart(decimals, "0")
      .slice(0, 6)
      .replace(/0+$/, "");

    return Number(
      fractionText
        ? `${whole}.${fractionText}`
        : whole.toString()
    );
  } catch {
    return 0;
  }
}

async function fetchAddressTokenBalances(address) {
  const response = await fetch(
    `${BLOCKSCOUT_API_BASE}/addresses/` +
    `${address}/token-balances`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "HOODRATS-NFT-Collection-Terminal/2.2.1",
      },
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Token balance request failed: HTTP ${response.status}`
    );
  }

  return response.json();
}

async function fetchSingleHoodratBalance(address) {
  const query = new URLSearchParams({
    module: "account",
    action: "tokenbalance",
    contractaddress: HOODRAT_TOKEN_CONTRACT,
    address,
    tag: "latest",
  });

  const response = await fetch(
    `https://robinhoodchain.blockscout.com/api?${query}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "HOODRATS-NFT-Collection-Terminal/2.2.1",
      },
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Single token balance request failed: HTTP ${response.status}`
    );
  }

  const payload = await response.json();

  if (
    payload?.status !== "1" ||
    typeof payload?.result !== "string"
  ) {
    throw new Error(
      payload?.message ||
      "Unexpected single token balance response"
    );
  }

  return formatTokenAmount(payload.result, 18);
}

async function loadTopHolderTokenBalances(addresses) {
  const balances = {};

  for (const address of addresses) {
    try {
      const payload = await fetchAddressTokenBalances(
        address
      );

      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
        ? payload.items
        : [];

      const token = items.find((item) => {
        const tokenAddress = String(
          item?.token?.address ??
          item?.token?.address_hash ??
          item?.token?.hash ??
          item?.token_address ??
          item?.address ??
          ""
        ).toLowerCase();

        return (
          tokenAddress ===
          HOODRAT_TOKEN_CONTRACT.toLowerCase()
        );
      });

      const decimals = Math.max(
        0,
        Math.trunc(
          Number(
            token?.token?.decimals ??
            token?.decimals ??
            18
          )
        )
      );

      const rawBalance =
        token?.value ??
        token?.balance ??
        token?.raw_value ??
        token?.token?.value ??
        token?.token?.balance ??
        "0";

      if (token) {
        balances[address] = formatTokenAmount(
          rawBalance,
          decimals
        );
      } else {
        balances[address] =
          await fetchSingleHoodratBalance(
            address
          );
      }
    } catch (error) {
      balances[address] = null;
    }

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        NFT_WHALE_TOKEN_REQUEST_DELAY_MS
      )
    );
  }

  return balances;
}

async function getTopHolderTokenBalances(addresses) {
  const cacheKey = addresses.join(",");

  if (
    nftWhaleTokenCache &&
    nftWhaleTokenCache.cacheKey === cacheKey &&
    Date.now() - nftWhaleTokenCache.fetchedAt <
      NFT_WHALE_TOKEN_CACHE_TTL_MS
  ) {
    return nftWhaleTokenCache.balances;
  }

  if (nftWhaleTokenPromise) {
    return nftWhaleTokenPromise;
  }

  nftWhaleTokenPromise = (async () => {
    try {
      const balances =
        await loadTopHolderTokenBalances(addresses);

      nftWhaleTokenCache = {
        cacheKey,
        fetchedAt: Date.now(),
        balances,
      };

      return balances;
    } finally {
      nftWhaleTokenPromise = null;
    }
  })();

  return nftWhaleTokenPromise;
}

app.get("/api/nft-whales", async (req, res) => {
  try {
    const analytics = await getNftHolderAnalytics();
    const requestedAddress = String(
      req.query.address || ""
    ).trim().toLowerCase();

    let wallet = null;

    if (/^0x[a-f0-9]{40}$/.test(requestedAddress)) {
      const index = analytics.holders.findIndex(
        (holder) =>
          holder.address === requestedAddress
      );

      wallet = index >= 0
        ? {
            found: true,
            address: requestedAddress,
            rank: index + 1,
            count: analytics.holders[index].count,
            isWhale:
              analytics.holders[index].count >=
              analytics.whaleThreshold,
          }
        : {
            found: false,
            address: requestedAddress,
            rank: null,
            count: 0,
            isWhale: false,
          };
    }

    const top25 = analytics.holders.slice(0, 25);
    const top25Addresses =
      top25.map((holder) => holder.address);

    const cacheKey = top25Addresses.join(",");
    const hasMatchingTokenCache =
      nftWhaleTokenCache?.cacheKey === cacheKey;

    const tokenBalances =
      hasMatchingTokenCache
        ? nftWhaleTokenCache.balances
        : {};

    // Return rankings immediately. Warm token balances separately.
    if (
      !hasMatchingTokenCache &&
      !nftWhaleTokenPromise
    ) {
      getTopHolderTokenBalances(top25Addresses)
        .catch((error) => {
          console.error(
            "[nft-whale-token-balances] failed:",
            error
          );
        });
    }

    res.json({
      connected: true,
      totalHolders: analytics.totalHolders,
      totalHeld: analytics.totalHeld,
      largestHolder: analytics.largestHolder,
      averageHeld: analytics.averageHeld,
      whaleThreshold: analytics.whaleThreshold,
      whaleCount: analytics.whaleCount,
      top10ConcentrationPercent:
        analytics.top10ConcentrationPercent,
      distribution: analytics.distribution,
      topHolders: top25.map((holder, index) => ({
        rank: index + 1,
        address: holder.address,
        count: holder.count,
        sharePercent:
          NFT_MAX_SUPPLY > 0
            ? Number(
                (
                  holder.count /
                  NFT_MAX_SUPPLY *
                  100
                ).toFixed(2)
              )
            : 0,
        hoodratTokens:
          tokenBalances[holder.address] ?? null,
      })),
      wallet,
      updatedAt: analytics.updatedAt,
      tokenBalancesReady:
        hasMatchingTokenCache,
      tokenBalancesUpdatedAt:
        hasMatchingTokenCache &&
        nftWhaleTokenCache?.fetchedAt
          ? new Date(
              nftWhaleTokenCache.fetchedAt
            ).toISOString()
          : null,
    });
  } catch (error) {
    console.error("[nft-whales] failed:", error);

    if (nftHoldersCache?.data) {
      res.json({
        connected: true,
        stale: true,
        error:
          "Refresh failed; serving last successful holder snapshot.",
        ...nftHoldersCache.data,
        holders: undefined,
        topHolders:
          nftHoldersCache.data.holders
            .slice(0, 25)
            .map((holder, index) => ({
              rank: index + 1,
              address: holder.address,
              count: holder.count,
              sharePercent:
                NFT_MAX_SUPPLY > 0
                  ? Number(
                      (
                        holder.count /
                        NFT_MAX_SUPPLY *
                        100
                      ).toFixed(2)
                    )
                  : 0,
              hoodratTokens:
                nftWhaleTokenCache?.balances?.[
                  holder.address
                ] ?? null,
            })),
        tokenBalancesReady:
          Boolean(nftWhaleTokenCache?.balances),
        tokenBalancesUpdatedAt:
          nftWhaleTokenCache?.fetchedAt
            ? new Date(
                nftWhaleTokenCache.fetchedAt
              ).toISOString()
            : null,
      });
      return;
    }

    res.status(502).json({
      connected: false,
      error:
        "Unable to load NFT holder analytics.",
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log("");
  console.log("[ OK ] HOODRAT NFT Mint Tracker simulation started.");
  console.log(`[ READY ] Open: http://localhost:${port}`);
  console.log("");
});
