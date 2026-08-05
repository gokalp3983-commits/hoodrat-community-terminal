"use strict";

const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_BASE =
  process.env.BLOCKSCOUT_API_BASE ||
  "https://robinhoodchain.blockscout.com/api/v2";
const TOKEN =
  process.env.HOODRAT_CONTRACT ||
  "0x8e62F281f282686fCa6dCB39288069a93fC23F1c";
const DEX_CHAIN = process.env.DEXSCREENER_CHAIN_ID || "robinhood";

const STATIC_LABELED_ADDRESSES = {
  "0x000000000000000000000000000000000000dead": {
    label: "Burn Address",
    tag: "BURN",
    type: "burn",
    excludeFromWhaleStats: true,
  },
  "0x0000000000000000000000000000000000000000": {
    label: "Zero Address",
    tag: "NULL",
    type: "system",
    excludeFromWhaleStats: true,
  },
};

const TOP_HOLDER_TTL = 2 * 60_000;
const FULL_HOLDER_TTL = 10 * 60_000;
const MARKET_TTL = 60_000;
const SNAPSHOT_INTERVAL = 5 * 60_000;
const TRANSFER_TTL = 2 * 60_000;
const ACTIVITY_TTL = 2 * 60_000;
const BACKGROUND_ACTIVITY_REFRESH_MS = 5 * 60_000;
const ACTIVITY_REPORT_GAP_MS = 2_000;
const BLOCKSCOUT_MIN_INTERVAL_MS = Number(process.env.BLOCKSCOUT_MIN_INTERVAL_MS || 2_000);
const BLOCKSCOUT_MAX_ATTEMPTS = Number(process.env.BLOCKSCOUT_MAX_ATTEMPTS || 7);
const BLOCKSCOUT_MAX_BACKOFF_MS = Number(process.env.BLOCKSCOUT_MAX_BACKOFF_MS || 60_000);
const ADDRESS_CLASSIFICATION_TTL = 10 * 60_000;
const MAX_STALE_AGE = 60 * 60_000;
const TRANSFER_LOOKBACK_HOURS = 24;
const TRANSFER_MAX_PAGES = Number(process.env.TRANSFER_MAX_PAGES || 120);

let topHolderCache = null;
let fullHolderCache = null;
let marketCache = null;
let currentSnapshot = null;
let previousSnapshot = null;
let transferCache = null;
let topHolderRefresh = null;
let fullHolderRefresh = null;
let marketRefresh = null;
let transferRefresh = null;
let transferLastError = null;
let transferLastAttemptAt = null;
let transferLastSuccessAt = null;
const activityCache = new Map();
const activityRefreshes = new Map();
const addressClassificationCache = new Map();
let activityBackgroundTimer = null;
let activityBackgroundStarted = false;
let activityRefreshAllPromise = null;
let blockscoutQueue = Promise.resolve();
let lastBlockscoutRequestAt = 0;
let blockscoutCooldownUntil = 0;
let transferProgress = { pagesFetched: 0, transfersFetched: 0, startedAt: null };

app.use(express.static(path.join(__dirname, "public")));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isBlockscoutUrl(url) {
  try {
    const target = new URL(url);
    const base = new URL(API_BASE);
    return target.hostname === base.hostname;
  } catch {
    return false;
  }
}

function retryAfterMs(response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return 0;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(raw);
  return Number.isFinite(date)
    ? Math.max(0, date - Date.now())
    : 0;
}

function queueBlockscoutRequest(task) {
  const run = async () => {
    const wait = Math.max(
      0,
      BLOCKSCOUT_MIN_INTERVAL_MS - (Date.now() - lastBlockscoutRequestAt),
      blockscoutCooldownUntil - Date.now()
    );

    if (wait > 0) await sleep(wait);
    lastBlockscoutRequestAt = Date.now();
    return task();
  };

  const queued = blockscoutQueue.then(run, run);
  blockscoutQueue = queued.catch(() => {});
  return queued;
}

async function fetchJson(url, attempts = BLOCKSCOUT_MAX_ATTEMPTS) {
  let lastError;
  const blockscout = isBlockscoutUrl(url);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const request = async () => {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "hoodrat-meme-intelligence-terminal/1.0",
          },
          signal: AbortSignal.timeout(20_000),
        });

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          error.retryAfterMs = retryAfterMs(response);
          if (response.status === 429) {
            const cooldown = Math.max(error.retryAfterMs || 0, 15_000);
            blockscoutCooldownUntil = Math.max(blockscoutCooldownUntil, Date.now() + cooldown);
          }
          throw error;
        }

        return response.json();
      };

      return blockscout
        ? await queueBlockscoutRequest(request)
        : await request();
    } catch (error) {
      lastError = error;

      if (attempt >= attempts) break;

      const retryable =
        error?.status === 429 ||
        error?.status >= 500 ||
        error?.name === "TimeoutError" ||
        error?.name === "AbortError" ||
        error instanceof TypeError;

      if (!retryable) break;

      const exponential = Math.min(
        BLOCKSCOUT_MAX_BACKOFF_MS,
        1_000 * 2 ** (attempt - 1)
      );
      const jitter = Math.floor(Math.random() * 350);
      const delay = Math.max(
        Number(error?.retryAfterMs || 0),
        exponential + jitter
      );

      console.warn(
        `[fetch] ${error?.message || error}; retry ${attempt}/${attempts - 1} in ${delay}ms`
      );
      await sleep(delay);
    }
  }

  throw new Error(`Request failed: ${lastError?.message || lastError}`);
}


function cacheAgeMs(cache, timestampField = "generatedAt") {
  return cache
    ? Math.max(0, Date.now() - Number(cache[timestampField] || 0))
    : Infinity;
}

function withCacheState(
  value,
  source,
  stale = false,
  timestampField = "generatedAt"
) {
  return {
    ...value,
    cacheState: {
      source,
      stale,
      ageSeconds: Math.floor(
        cacheAgeMs(value, timestampField) / 1000
      ),
    },
  };
}

function canUseStale(cache, timestampField = "generatedAt") {
  return Boolean(
    cache &&
    cacheAgeMs(cache, timestampField) <= MAX_STALE_AGE
  );
}

function formatUnits(rawValue, decimals) {
  const raw = BigInt(rawValue || "0");
  const places = Math.max(0, Number(decimals || 0));
  const divisor = 10n ** BigInt(places);
  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (fraction === 0n) return whole.toString();

  return `${whole}.${fraction
    .toString()
    .padStart(places, "0")
    .replace(/0+$/, "")}`;
}

function compact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}


function infrastructureRegistry(market = null) {
  const entries = { ...STATIC_LABELED_ADDRESSES };
  const pairAddress = String(market?.pairAddress || "").toLowerCase();

  if (pairAddress) {
    entries[pairAddress] = {
      label: "HOODRAT/WETH Liquidity Pool",
      tag: "LP",
      type: "liquidity_pool",
      excludeFromWhaleStats: true,
    };
  }

  return entries;
}

function labelForAddress(address, market = null) {
  return infrastructureRegistry(market)[
    String(address || "").toLowerCase()
  ] || null;
}

function infrastructureList(market = null) {
  return Object.entries(infrastructureRegistry(market)).map(
    ([address, details]) => ({ address, ...details })
  );
}

function applyInfrastructureFilter(cache, market) {
  const registry = infrastructureRegistry(market);
  const excludedInfrastructure = [];
  const participantHolders = [];

  for (const holder of cache.holders) {
    const label = registry[holder.address.toLowerCase()] || null;

    if (label?.excludeFromWhaleStats) {
      excludedInfrastructure.push({
        ...holder,
        label: label.label,
        tag: label.tag,
        type: label.type,
      });
    } else {
      participantHolders.push({
        ...holder,
        label: null,
        tag: "WALLET",
        type: "wallet",
      });
    }
  }

  return {
    ...cache,
    metadata: {
      ...cache.metadata,
      excludedInfrastructureCount: excludedInfrastructure.length,
      participantHoldersCount: Math.max(
        0,
        Number(cache.metadata.holdersCount || 0) -
          excludedInfrastructure.length
      ),
    },
    infrastructure: infrastructureList(market),
    excludedInfrastructure,
    holders: participantHolders.map((holder, index) => ({
      ...holder,
      rank: index + 1,
    })),
  };
}

function addressOf(item) {
  return String(
    item?.address?.hash ??
    item?.address_hash ??
    item?.address ??
    ""
  );
}

function balanceOf(item) {
  return String(item?.value ?? item?.balance ?? "0");
}

async function loadHolders(maxHolders = null) {
  const token = await fetchJson(`${API_BASE}/tokens/${TOKEN}`);
  const metadata = {
    decimals: Number(token?.decimals || 18),
    holdersCount: Number(token?.holders_count || 0),
    totalSupplyRaw: String(token?.total_supply || "0"),
  };

  const holders = [];
  let params = new URLSearchParams({ items_count: "50" });

  for (let page = 0; page < 500; page += 1) {
    const data = await fetchJson(
      `${API_BASE}/tokens/${TOKEN}/holders?${params.toString()}`
    );
    const items = Array.isArray(data?.items) ? data.items : [];

    for (const item of items) {
      const address = addressOf(item);

      if (address) {
        holders.push({
          address,
          rawBalance: balanceOf(item),
        });
      }

      if (maxHolders && holders.length >= maxHolders) {
        break;
      }
    }

    if (maxHolders && holders.length >= maxHolders) {
      break;
    }

    const next = data?.next_page_params;

    if (!next || items.length === 0) {
      break;
    }

    params = new URLSearchParams();

    for (const [key, value] of Object.entries(next)) {
      if (value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    }
  }

  holders.sort((a, b) => {
    const x = BigInt(a.rawBalance);
    const y = BigInt(b.rawBalance);

    return x === y ? 0 : x > y ? -1 : 1;
  });

  return {
    generatedAt: Date.now(),
    metadata,
    holders: holders.map((holder, index) => ({
      ...holder,
      rank: index + 1,
      balance: formatUnits(
        holder.rawBalance,
        metadata.decimals
      ),
    })),
  };
}

async function getTopHolders() {
  if (
    topHolderCache &&
    cacheAgeMs(topHolderCache) < TOP_HOLDER_TTL
  ) {
    return withCacheState(topHolderCache, "memory");
  }

  if (topHolderRefresh) return topHolderRefresh;

  topHolderRefresh = (async () => {
    try {
      const market = await getMarket();
      const rawCache = await loadHolders(300);

      topHolderCache = applyInfrastructureFilter(rawCache, market);
      return withCacheState(topHolderCache, "fresh");
    } catch (error) {
      console.error("Top-holder refresh failed:", error);

      if (canUseStale(topHolderCache)) {
        return withCacheState(topHolderCache, "stale-fallback", true);
      }

      throw error;
    } finally {
      topHolderRefresh = null;
    }
  })();

  return topHolderRefresh;
}

async function getFullHolders() {
  if (
    fullHolderCache &&
    cacheAgeMs(fullHolderCache) < FULL_HOLDER_TTL
  ) {
    return withCacheState(fullHolderCache, "memory");
  }

  if (fullHolderRefresh) return fullHolderRefresh;

  fullHolderRefresh = (async () => {
    try {
      const market = await getMarket();
      const rawCache = await loadHolders();

      fullHolderCache = applyInfrastructureFilter(rawCache, market);
      return withCacheState(fullHolderCache, "fresh");
    } catch (error) {
      console.error("Full-holder refresh failed:", error);

      if (canUseStale(fullHolderCache)) {
        return withCacheState(fullHolderCache, "stale-fallback", true);
      }

      throw error;
    } finally {
      fullHolderRefresh = null;
    }
  })();

  return fullHolderRefresh;
}

async function getMarket() {
  if (
    marketCache &&
    cacheAgeMs(marketCache, "fetchedAt") < MARKET_TTL
  ) {
    return withCacheState(
      marketCache,
      "memory",
      false,
      "fetchedAt"
    );
  }

  if (marketRefresh) return marketRefresh;

  marketRefresh = (async () => {
    try {
        const pairs = await fetchJson(
          `https://api.dexscreener.com/token-pairs/v1/${DEX_CHAIN}/${TOKEN}`
        );

        const tokenLower = TOKEN.toLowerCase();
        const pair = (Array.isArray(pairs) ? pairs : [])
          .filter((item) => {
            const base = String(item?.baseToken?.address || "").toLowerCase();
            const quote = String(item?.quoteToken?.symbol || "").toUpperCase();

            return (
              base === tokenLower &&
              ["WETH", "ETH"].includes(quote) &&
              Number(item?.priceUsd) > 0
            );
          })
          .sort(
            (a, b) =>
              Number(b?.liquidity?.usd || 0) -
              Number(a?.liquidity?.usd || 0)
          )[0];

        if (!pair) throw new Error("No liquid HOODRAT/WETH market found");

        marketCache = {
          fetchedAt: Date.now(),
          priceUsd: Number(pair.priceUsd || 0),
          priceEth: Number(pair.priceNative || 0),
          marketCapUsd: Number(pair.marketCap || pair.fdv || 0),
          liquidityUsd: Number(pair?.liquidity?.usd || 0),
          volume24hUsd: Number(pair?.volume?.h24 || 0),
          priceChange24h: Number(pair?.priceChange?.h24 || 0),
          pairAddress: String(pair?.pairAddress || ""),
          dexId: String(pair?.dexId || ""),
        };

        return marketCache;
    } catch (error) {
      console.error("Market refresh failed:", error);

      if (canUseStale(marketCache, "fetchedAt")) {
        return withCacheState(
          marketCache,
          "stale-fallback",
          true,
          "fetchedAt"
        );
      }

      throw error;
    } finally {
      marketRefresh = null;
    }
  })();

  return marketRefresh;
}


function transferTimestamp(item) {
  const raw = item?.timeStamp ?? item?.timestamp ?? item?.block_timestamp;

  if (typeof raw === "number" || /^\d+$/.test(String(raw || ""))) {
    const n = Number(raw);
    return n > 10_000_000_000 ? n : n * 1000;
  }

  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function transferAddress(item, side) {
  const value = item?.[side];
  return String(
    value?.hash ??
    value?.address_hash ??
    value?.address ??
    value ??
    ""
  );
}

function transferRawValue(item) {
  return String(
    item?.value ??
    item?.total?.value ??
    item?.amount ??
    "0"
  );
}

function transferHash(item) {
  return String(item?.hash ?? item?.transaction_hash ?? "");
}

async function loadRecentTokenTransfers() {
  if (transferCache && cacheAgeMs(transferCache) < TRANSFER_TTL) {
    return withCacheState(transferCache, "memory");
  }

  if (transferRefresh) return transferRefresh;

  transferRefresh = (async () => {
    transferLastAttemptAt = Date.now();
    transferLastError = null;

    try {
      transferProgress = { pagesFetched: 0, transfersFetched: 0, startedAt: Date.now() };
      const cutoff = Date.now() - TRANSFER_LOOKBACK_HOURS * 60 * 60_000;
      const collected = [];
      let nextPageParams = null;
      let page = 0;
      let reachedCutoff = false;

      do {
        const url = new URL(`${API_BASE}/tokens/${TOKEN}/transfers`);
        if (nextPageParams && typeof nextPageParams === "object") {
          for (const [key, value] of Object.entries(nextPageParams)) {
            if (value !== null && value !== undefined) {
              url.searchParams.set(key, String(value));
            }
          }
        }

        const data = await fetchJson(url.toString());
        const items = Array.isArray(data?.items) ? data.items : [];
        page += 1;
        transferProgress.pagesFetched = page;
        transferProgress.transfersFetched += items.length;

        for (const item of items) {
          const timestamp = transferTimestamp(item);
          if (timestamp && timestamp < cutoff) {
            reachedCutoff = true;
            continue;
          }

          collected.push({
            from: transferAddress(item, "from"),
            to: transferAddress(item, "to"),
            rawValue: transferRawValue(item),
            timestamp,
            hash: transferHash(item),
          });
        }

        nextPageParams = data?.next_page_params || null;

        // Results are newest-first. Once a page reaches the lookback cutoff,
        // older pages cannot contribute to the 24-hour intelligence window.
        if (reachedCutoff || items.length === 0) break;
      } while (nextPageParams && page < TRANSFER_MAX_PAGES);

      transferCache = {
        generatedAt: Date.now(),
        source: "Blockscout v2 token transfers",
        pagesFetched: page,
        truncated: Boolean(nextPageParams) && !reachedCutoff,
        items: collected
          .filter((item) => item.timestamp >= cutoff)
          .sort((a, b) => b.timestamp - a.timestamp),
      };

      transferLastSuccessAt = Date.now();
      return transferCache;
    } catch (error) {
      console.error("Transfer refresh failed:", error);
      transferLastError = {
        message: String(error?.message || error || "Unknown transfer error"),
        status: Number(error?.status || 0) || null,
        at: Date.now(),
      };

      if (canUseStale(transferCache)) {
        return withCacheState(transferCache, "stale-fallback", true);
      }

      throw error;
    } finally {
      transferRefresh = null;
    }
  })();

  return transferRefresh;
}

function formatSignedRaw(raw, decimals) {
  const value = BigInt(raw);
  if (value > 0n) return `+${formatUnits(value, decimals)}`;
  if (value < 0n) return `-${formatUnits(-value, decimals)}`;
  return "0";
}

function aggregateDexActivity(transfers, pairAddress, decimals, hours) {
  const cutoff = Date.now() - hours * 60 * 60_000;
  const pair = String(pairAddress || "").toLowerCase();
  const wallets = new Map();
  const trades = [];

  if (!pair) return { wallets: [], trades: [] };

  const entry = (address) => {
    const key = address.toLowerCase();
    if (!wallets.has(key)) {
      wallets.set(key, {
        wallet: address,
        boughtRaw: 0n,
        soldRaw: 0n,
        buyCount: 0,
        sellCount: 0,
        lastActivityAt: 0,
      });
    }
    return wallets.get(key);
  };

  for (const transfer of transfers) {
    if (transfer.timestamp < cutoff) continue;

    const from = transfer.from.toLowerCase();
    const to = transfer.to.toLowerCase();
    const raw = BigInt(transfer.rawValue || "0");

    if (raw <= 0n) continue;

    if (from === pair && to && to !== pair) {
      const row = entry(transfer.to);
      row.boughtRaw += raw;
      row.buyCount += 1;
      row.lastActivityAt = Math.max(row.lastActivityAt, transfer.timestamp);
      trades.push({ ...transfer, wallet: transfer.to, type: "BUY" });
    } else if (to === pair && from && from !== pair) {
      const row = entry(transfer.from);
      row.soldRaw += raw;
      row.sellCount += 1;
      row.lastActivityAt = Math.max(row.lastActivityAt, transfer.timestamp);
      trades.push({ ...transfer, wallet: transfer.from, type: "SELL" });
    }
  }

  return {
    wallets: [...wallets.values()].map((row) => {
      const netRaw = row.boughtRaw - row.soldRaw;
      return {
        wallet: row.wallet,
        bought: formatUnits(row.boughtRaw, decimals),
        sold: formatUnits(row.soldRaw, decimals),
        net: formatSignedRaw(netRaw, decimals),
        boughtRaw: row.boughtRaw.toString(),
        soldRaw: row.soldRaw.toString(),
        netRaw: netRaw.toString(),
        buyCount: row.buyCount,
        sellCount: row.sellCount,
        lastActivityAt: row.lastActivityAt,
      };
    }),
    trades: trades
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((trade) => ({
        ...trade,
        amount: formatUnits(trade.rawValue, decimals),
      })),
  };
}

async function activityPayload(hours = 24) {
  const safeHours = Math.min(Math.max(Number(hours) || 24, 1), 168);
  // Keep Blockscout-heavy work sequential. The global request queue also
  // spaces individual requests, preventing burst traffic on cold starts.
  const market = await getMarket();
  const recent = await loadRecentTokenTransfers();
  const topHolders = await getTopHolders();

  // Never block an activity report on the complete holder-list refresh.
  // Use a previously completed full-rank cache when available; otherwise
  // return immediately with Top-300 participant ranks.
  const fullRanksUsable = canUseStale(fullHolderCache);
  const holders = fullRanksUsable
    ? withCacheState(
        fullHolderCache,
        cacheAgeMs(fullHolderCache) < FULL_HOLDER_TTL
          ? "full-rank-cache"
          : "full-rank-stale-cache",
        cacheAgeMs(fullHolderCache) >= FULL_HOLDER_TTL
      )
    : topHolders;

  const rankCoverage = fullRanksUsable
    ? "full-cache"
    : "top-300-immediate";

  // Do not start a full-holder pagination job while activity caches are
  // warming. It creates avoidable Blockscout pressure. Full ranks are loaded
  // only by commands that explicitly need the complete holder list.

  rotateSnapshots(holders);

  const currentRankByAddress = new Map(
    holders.holders.map((holder) => [
      holder.address.toLowerCase(),
      holder.rank,
    ])
  );

  const withCurrentRank = (row) => ({
    ...row,
    holderRank:
      currentRankByAddress.get(
        String(row.wallet || "").toLowerCase()
      ) ?? null,
  });

  const activity = aggregateDexActivity(
    recent.items,
    market.pairAddress,
    holders.metadata.decimals,
    safeHours
  );
  const currentTop30 = new Set(
    holders.holders.slice(0, 30).map((h) => h.address.toLowerCase())
  );
  const previousTop30 = new Set(
    previousSnapshot
      ? [...previousSnapshot.map.entries()]
          .filter(([, value]) => value.rank <= 20)
          .map(([address]) => address)
      : []
  );

  const sortRawDesc = (field) => (a, b) => {
    const x = BigInt(a[field]);
    const y = BigInt(b[field]);
    return x === y ? 0 : x > y ? -1 : 1;
  };
  const rankedWalletActivity = activity.wallets.map(withCurrentRank);
  const activityByWallet = new Map(
    rankedWalletActivity.map((row) => [
      row.wallet.toLowerCase(),
      row,
    ])
  );

  const classifyWhaleActivity = (boughtRaw, soldRaw) => {
    const bought = BigInt(boughtRaw);
    const sold = BigInt(soldRaw);
    const gross = bought + sold;
    const net = bought - sold;

    if (gross === 0n) {
      return {
        status: "DORMANT",
        statusLabel: "DORMANT",
        strength: 0,
      };
    }

    const imbalanceBps =
      Number((net < 0n ? -net : net) * 10_000n / gross);

    if (imbalanceBps <= 1_000) {
      return {
        status: "BALANCED",
        statusLabel: "BALANCED",
        strength: 0,
      };
    }

    const strength =
      imbalanceBps >= 7_000 ? 3 :
      imbalanceBps >= 4_000 ? 2 : 1;

    if (net > 0n) {
      return {
        status: "ACCUMULATING",
        statusLabel: `ACCUMULATING ${"▲".repeat(strength)}`,
        strength,
      };
    }

    return {
      status: "DISTRIBUTING",
      statusLabel: `DISTRIBUTING ${"▼".repeat(strength)}`,
      strength,
    };
  };

  const top30Activity = holders.holders.slice(0, 30).map((holder) => {
    const row = activityByWallet.get(holder.address.toLowerCase());
    const boughtRaw = row?.boughtRaw || "0";
    const soldRaw = row?.soldRaw || "0";
    const netRaw = (BigInt(boughtRaw) - BigInt(soldRaw)).toString();
    const classification = classifyWhaleActivity(
      boughtRaw,
      soldRaw
    );

    return {
      rank: holder.rank,
      wallet: holder.address,
      balance: holder.balance,
      bought: formatUnits(boughtRaw, holders.metadata.decimals),
      sold: formatUnits(soldRaw, holders.metadata.decimals),
      net: formatSignedRaw(
        BigInt(netRaw),
        holders.metadata.decimals
      ),
      boughtRaw,
      soldRaw,
      netRaw,
      trades:
        Number(row?.buyCount || 0) +
        Number(row?.sellCount || 0),
      buyCount: Number(row?.buyCount || 0),
      sellCount: Number(row?.sellCount || 0),
      lastActivityAt: row?.lastActivityAt || null,
      ...classification,
    };
  });

  const top30Summary = top30Activity.reduce(
    (summary, whale) => {
      summary[whale.status.toLowerCase()] += 1;
      summary.netRaw += BigInt(whale.netRaw);
      summary.trades += whale.trades;
      return summary;
    },
    {
      accumulating: 0,
      distributing: 0,
      balanced: 0,
      dormant: 0,
      netRaw: 0n,
      trades: 0,
    }
  );

  const byBought = [...rankedWalletActivity].sort(sortRawDesc("boughtRaw"));
  const bySold = [...rankedWalletActivity].sort(sortRawDesc("soldRaw"));
  const byNetPositive = [...rankedWalletActivity]
    .filter((row) => BigInt(row.netRaw) > 0n)
    .sort(sortRawDesc("netRaw"));
  const byNetNegative = [...rankedWalletActivity]
    .filter((row) => BigInt(row.netRaw) < 0n)
    .sort((a, b) => {
      const x = BigInt(a.netRaw);
      const y = BigInt(b.netRaw);
      return x === y ? 0 : x < y ? -1 : 1;
    });

  const rankedTrades = activity.trades.map(withCurrentRank);

  const recentWhaleTransactions = rankedTrades
    .filter((trade) => currentTop30.has(trade.wallet.toLowerCase()))
    .slice(0, 25);

  const newWhales = previousSnapshot
    ? holders.holders
        .slice(0, 30)
        .filter((h) => !previousTop30.has(h.address.toLowerCase()))
        .map((h) => ({ address: h.address, rank: h.rank, balance: h.balance }))
    : [];

  const holderChanges = holders.holders
    .slice(0, 250)
    .map((holder) => ({
      ...holder,
      movement: movement(holder, holders.metadata.decimals),
    }))
    .filter((holder) => holder.movement.rankChange !== 0)
    .sort(
      (a, b) =>
        Math.abs(b.movement.rankChange) -
        Math.abs(a.movement.rankChange)
    )
    .slice(0, 30);

  return {
    hours: safeHours,
    generatedAt: Date.now(),
    pairAddress: market.pairAddress,
    pairLabel: labelForAddress(market.pairAddress, market),
    infrastructure: infrastructureList(market),
    dexId: market.dexId,
    source: recent.source,
    truncated: recent.truncated,
    cache: {
      stale: Boolean(
        holders.cacheState?.stale ||
        market.cacheState?.stale ||
        recent.cacheState?.stale
      ),
      rankCoverage,
      holders: holders.cacheState || null,
      market: market.cacheState || null,
      transfers: recent.cacheState || null,
    },
    largestBuy: rankedTrades
      .filter((t) => t.type === "BUY")
      .sort((a, b) => BigInt(a.rawValue) > BigInt(b.rawValue) ? -1 : 1)[0] || null,
    largestSell: rankedTrades
      .filter((t) => t.type === "SELL")
      .sort((a, b) => BigInt(a.rawValue) > BigInt(b.rawValue) ? -1 : 1)[0] || null,
    topBuyers: byBought.filter((r) => BigInt(r.boughtRaw) > 0n).slice(0, 10),
    topSellers: bySold.filter((r) => BigInt(r.soldRaw) > 0n).slice(0, 10),
    topAccumulators: byNetPositive.slice(0, 10),
    topDistributors: byNetNegative.slice(0, 10),
    top30Activity,
    top30Summary: {
      accumulating: top30Summary.accumulating,
      distributing: top30Summary.distributing,
      balanced: top30Summary.balanced,
      dormant: top30Summary.dormant,
      trades: top30Summary.trades,
      netFlow: formatSignedRaw(
        top30Summary.netRaw,
        holders.metadata.decimals
      ),
      netFlowRaw: top30Summary.netRaw.toString(),
    },
    recentWhaleTransactions,
    newWhales,
    holderChanges,
    snapshot: {
      comparisonAvailable: Boolean(previousSnapshot),
      intervalMinutes: SNAPSHOT_INTERVAL / 60_000,
    },
  };
}



function getCachedActivityPayload(hours) {
  const safeHours = Math.min(
    Math.max(Number(hours) || 24, 1),
    168
  );
  const key = String(safeHours);
  const cached = activityCache.get(key);

  if (!cached) return null;

  return {
    ...cached.payload,
    responseCache: {
      source: "background-cache",
      stale:
        Date.now() - cached.generatedAt >
        BACKGROUND_ACTIVITY_REFRESH_MS * 2,
      ageSeconds: Math.floor(
        (Date.now() - cached.generatedAt) / 1000
      ),
    },
  };
}

async function getActivityPayload(hours = 24) {
  const safeHours = Math.min(
    Math.max(Number(hours) || 24, 1),
    168
  );

  const cached = getCachedActivityPayload(safeHours);

  if (cached) return cached;

  // User commands must never wait on the long background Blockscout job.
  // The shared refresh continues independently while the API immediately
  // reports a warming state to the terminal.
  const error = new Error(
    `Activity cache for ${safeHours}h is warming up.`
  );
  error.code = "ACTIVITY_CACHE_WARMING";
  throw error;
}


async function classifyActivityAddress(wallet) {
  const key = String(wallet || "").toLowerCase();

  if (!key) {
    return {
      holderRank: null,
      rankLabel: "N/A",
      classification: "unknown",
      currentBalance: "0",
    };
  }

  const cached = addressClassificationCache.get(key);

  if (
    cached &&
    Date.now() - cached.fetchedAt < ADDRESS_CLASSIFICATION_TTL
  ) {
    return cached.value;
  }

  let classification = "no_balance";
  let currentBalance = "0";

  try {
    const balances = await fetchJson(
      `${API_BASE}/addresses/${key}/token-balances`
    );

    if (Array.isArray(balances)) {
      const tokenLower = TOKEN.toLowerCase();
      const match = balances.find((item) => {
        const address = String(
          item?.token?.address_hash ??
          item?.token?.address ??
          item?.token_address ??
          ""
        ).toLowerCase();

        return address === tokenLower;
      });

      currentBalance = String(match?.value ?? match?.balance ?? "0");
    }
  } catch (error) {
    console.error(`Balance classification failed for ${key}:`, error);
  }

  try {
    const addressInfo = await fetchJson(`${API_BASE}/addresses/${key}`);

    if (
      addressInfo?.is_contract === true ||
      addressInfo?.is_verified_contract === true ||
      addressInfo?.contract_code
    ) {
      classification = "contract";
    } else if (BigInt(currentBalance || "0") > 0n) {
      classification = "unranked_holder";
    }
  } catch (error) {
    console.error(`Address classification failed for ${key}:`, error);

    if (BigInt(currentBalance || "0") > 0n) {
      classification = "unranked_holder";
    }
  }

  const rankLabel =
    classification === "contract"
      ? "N/A (Contract)"
      : classification === "no_balance"
        ? "N/A (No Balance)"
        : classification === "unranked_holder"
          ? "N/A (Unranked)"
          : "N/A";

  const value = {
    holderRank: null,
    rankLabel,
    classification,
    currentBalance,
  };

  addressClassificationCache.set(key, {
    fetchedAt: Date.now(),
    value,
  });

  return value;
}

async function enrichActivityRows(groups) {
  const rows = groups.flat().filter(Boolean);
  const uniqueWallets = [
    ...new Set(
      rows
        .filter((row) => row.holderRank == null)
        .map((row) => String(row.wallet || "").toLowerCase())
        .filter(Boolean)
    ),
  ].slice(0, 12);

  const classifications = new Map();

  // Deliberately sequential: one unknown address at a time. Each underlying
  // Blockscout request is additionally governed by the global request queue.
  for (const wallet of uniqueWallets) {
    try {
      classifications.set(
        wallet,
        await classifyActivityAddress(wallet)
      );
    } catch (error) {
      console.error(`Classification skipped for ${wallet}:`, error);
    }
  }

  return (input) => input.map((row) => {
    if (row.holderRank != null) {
      return {
        ...row,
        rankLabel: `#${row.holderRank}`,
        classification: "ranked_holder",
      };
    }

    const info = classifications.get(
      String(row.wallet || "").toLowerCase()
    );

    return {
      ...row,
      rankLabel: info?.rankLabel || "N/A",
      classification: info?.classification || "unknown",
      currentBalance: info?.currentBalance || "0",
    };
  });
}

async function refreshActivityCache(hours) {
  const safeHours = Math.min(
    Math.max(Number(hours) || 24, 1),
    168
  );
  const key = String(safeHours);

  if (activityRefreshes.has(key)) {
    return activityRefreshes.get(key);
  }

  const refreshPromise = (async () => {

      const payload = await activityPayload(hours);

      const enrich = await enrichActivityRows([
        payload.topBuyers || [],
        payload.topSellers || [],
        payload.topAccumulators || [],
        payload.topDistributors || [],
        payload.largestBuy ? [payload.largestBuy] : [],
        payload.largestSell ? [payload.largestSell] : [],
        payload.recentWhaleTransactions || [],
      ]);

      const enrichedTopBuyers = enrich(payload.topBuyers || []);
      const enrichedTopSellers = enrich(payload.topSellers || []);
      const enrichedAccumulators = enrich(payload.topAccumulators || []);
      const enrichedDistributors = enrich(payload.topDistributors || []);
      const enrichedLargestBuy = payload.largestBuy
        ? enrich([payload.largestBuy])[0]
        : null;
      const enrichedLargestSell = payload.largestSell
        ? enrich([payload.largestSell])[0]
        : null;
      const enrichedRecent = enrich(
        payload.recentWhaleTransactions || []
      );

      const enriched = {
        ...payload,
        topBuyers: enrichedTopBuyers,
        topSellers: enrichedTopSellers,
        topAccumulators: enrichedAccumulators,
        topDistributors: enrichedDistributors,
        largestBuy: enrichedLargestBuy,
        largestSell: enrichedLargestSell,
        recentWhaleTransactions: enrichedRecent,
      };

      activityCache.set(key, {
        generatedAt: Date.now(),
        payload: enriched,
      });

      return enriched;
  })();

  activityRefreshes.set(key, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    activityRefreshes.delete(key);
  }
}

async function refreshAllActivityCaches() {
  if (activityRefreshAllPromise) {
    return activityRefreshAllPromise;
  }

  activityRefreshAllPromise = (async () => {
    for (const hours of [12, 24]) {
      try {
        await refreshActivityCache(hours);
        console.log(
          `[activity-cache] refreshed ${hours}h report`
        );
      } catch (error) {
        const cached = getCachedActivityPayload(hours);
        console.error(
          `[activity-cache] failed to refresh ${hours}h report; ` +
          `${cached ? "serving previous cache" : "no previous cache"}:`,
          error
        );
      }

      if (hours !== 24) {
        await sleep(ACTIVITY_REPORT_GAP_MS);
      }
    }
  })();

  try {
    return await activityRefreshAllPromise;
  } finally {
    activityRefreshAllPromise = null;
  }
}

function startActivityBackgroundRefresh() {
  if (activityBackgroundStarted) return;

  activityBackgroundStarted = true;

  const initialWarmup = setTimeout(() => {
    void refreshAllActivityCaches();
  }, 5_000);
  initialWarmup.unref?.();

  activityBackgroundTimer = setInterval(() => {
    void refreshAllActivityCaches();
  }, BACKGROUND_ACTIVITY_REFRESH_MS);

  activityBackgroundTimer.unref?.();
}

function snapshot(cache, limit = 250) {
  const map = new Map();

  for (const holder of cache.holders.slice(0, limit)) {
    map.set(holder.address.toLowerCase(), {
      rank: holder.rank,
      rawBalance: holder.rawBalance,
    });
  }

  return { capturedAt: Date.now(), map };
}

function rotateSnapshots(cache) {
  if (!currentSnapshot) {
    currentSnapshot = snapshot(cache);
    return;
  }

  if (
    Date.now() - currentSnapshot.capturedAt >= SNAPSHOT_INTERVAL
  ) {
    previousSnapshot = currentSnapshot;
    currentSnapshot = snapshot(cache);
  }
}

function movement(holder, decimals) {
  const previous = previousSnapshot?.map.get(
    holder.address.toLowerCase()
  );
  const currentRaw = BigInt(holder.rawBalance);
  const previousRaw = previous
    ? BigInt(previous.rawBalance)
    : currentRaw;
  const delta = currentRaw - previousRaw;

  return {
    status:
      delta > 0n
        ? "ACCUMULATING"
        : delta < 0n
          ? "DISTRIBUTING"
          : "HOLDING",
    signedDelta:
      delta > 0n
        ? `+${formatUnits(delta, decimals)}`
        : delta < 0n
          ? `-${formatUnits(-delta, decimals)}`
          : "0",
    previousRank: previous?.rank ?? holder.rank,
    rankChange: previous ? previous.rank - holder.rank : 0,
  };
}

async function whalePayload(limit = 100) {
  const cache = await getTopHolders();
  rotateSnapshots(cache);

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const whales = cache.holders.slice(0, safeLimit).map((holder) => ({
    ...holder,
    movement: movement(holder, cache.metadata.decimals),
  }));

  const totalSupply = BigInt(cache.metadata.totalSupplyRaw || "0");
  const sum = (list) =>
    list.reduce((acc, holder) => acc + BigInt(holder.rawBalance), 0n);
  const pct = (raw) =>
    totalSupply > 0n
      ? Number((raw * 10_000n) / totalSupply) / 100
      : 0;

  const netFlow = whales.reduce((acc, holder) => {
    const value = holder.movement.signedDelta;
    if (value === "0") return acc;

    const raw = previousSnapshot?.map.get(
      holder.address.toLowerCase()
    )?.rawBalance;

    return raw
      ? acc + BigInt(holder.rawBalance) - BigInt(raw)
      : acc;
  }, 0n);

  return {
    dataScope: "top-250-participant-wallets",
    metadata: cache.metadata,
    infrastructure: cache.infrastructure,
    excludedInfrastructure: cache.excludedInfrastructure,
    generatedAt: cache.generatedAt,
    snapshot: {
      comparisonAvailable: Boolean(previousSnapshot),
      previousAt: previousSnapshot?.capturedAt || null,
      currentAt: currentSnapshot?.capturedAt || null,
      intervalMinutes: SNAPSHOT_INTERVAL / 60_000,
    },
    whales,
    stats: {
      top10ControlPct: pct(sum(whales.slice(0, 10))),
      top100ControlPct: pct(sum(whales.slice(0, 100))),
      largestHolder: whales[0] || null,
      netWhaleFlowSigned:
        netFlow > 0n
          ? `+${formatUnits(netFlow, cache.metadata.decimals)}`
          : netFlow < 0n
            ? `-${formatUnits(-netFlow, cache.metadata.decimals)}`
            : "0",
      sentiment:
        netFlow > 0n
          ? "ACCUMULATING"
          : netFlow < 0n
            ? "DISTRIBUTING"
            : "HOLDING",
    },
  };
}



app.get("/api/cache-status", (_req, res) => {
  const state = (ready, building) => ready ? "READY" : building ? "BUILDING" : "EMPTY";
  res.json({
    activity12: {
      state: state(activityCache.has(12), activityRefreshes.has(12) || Boolean(activityRefreshAllPromise)),
    },
    activity24: {
      state: state(activityCache.has(24), activityRefreshes.has(24) || Boolean(activityRefreshAllPromise)),
    },
    holders: {
      state: state(Boolean(topHolderCache || fullHolderCache), Boolean(topHolderRefresh || fullHolderRefresh)),
    },
    transfers: {
      state: transferCache
        ? "READY"
        : transferRefresh
          ? "BUILDING"
          : transferLastError
            ? "ERROR"
            : "EMPTY",
      error: transferLastError?.message || null,
      httpStatus: transferLastError?.status || null,
      lastAttemptAt: transferLastAttemptAt ? new Date(transferLastAttemptAt).toISOString() : null,
      lastSuccessAt: transferLastSuccessAt ? new Date(transferLastSuccessAt).toISOString() : null,
      progress: transferRefresh ? transferProgress : null,
      cooldownSeconds: Math.max(0, Math.ceil((blockscoutCooldownUntil - Date.now()) / 1000)),
    },
    market: {
      state: state(Boolean(marketCache), Boolean(marketRefresh)),
    },
    backgroundWorker: activityBackgroundStarted,
    checkedAt: new Date().toISOString(),
  });
});

app.get("/api/activity", async (req, res) => {
  try {
    res.json(await getActivityPayload(req.query.hours));
  } catch (error) {
    if (error?.code === "ACTIVITY_CACHE_WARMING") {
      return res.status(503).json({
        error:
          "Intelligence cache is building in the background. This can take a few minutes after a cold start because holder and transfer pages are fetched and classified with rate-limit protection.",
        warming: true,
        hours: Number(req.query.hours) || 24,
      });
    }

    console.error(error);
    res.status(500).json({
      error: "Unable to load on-chain whale activity.",
    });
  }
});


app.get("/api/whales12", async (_req, res) => {
  try {
    const data = await getActivityPayload(12);

    res.json({
      hours: 12,
      generatedAt: data.generatedAt,
      source: data.source,
      truncated: data.truncated,
      cache: data.cache,
      responseCache: data.responseCache,
      summary: data.top30Summary,
      whales: data.top30Activity,
    });
  } catch (error) {
    if (error?.code === "ACTIVITY_CACHE_WARMING") {
      return res.status(503).json({
        error:
          "Top-30 whale activity cache is warming up. Please try again shortly.",
        warming: true,
      });
    }

    console.error(error);
    res.status(500).json({
      error: "Unable to load Top-30 whale activity.",
    });
  }
});

app.get("/api/traders12", async (_req, res) => {
  try {
    const data = await getActivityPayload(12);
    res.json({
      hours: 12,
      generatedAt: data.generatedAt,
      pairAddress: data.pairAddress,
      source: data.source,
      truncated: data.truncated,
      cache: data.cache,
      responseCache: data.responseCache,
      topBuyers: data.topBuyers,
      topSellers: data.topSellers,
    });
  } catch (error) {
    if (error?.code === "ACTIVITY_CACHE_WARMING") {
      return res.status(503).json({
        error:
          "12-hour buyer/seller cache is warming up. Please try again shortly.",
        warming: true,
        hours: 12,
      });
    }

    console.error(error);
    res.status(500).json({
      error: "Unable to load 12-hour buyer/seller rankings.",
    });
  }
});

app.get("/api/infrastructure", async (_req, res) => {
  try {
    const market = await getMarket();

    res.json({
      addresses: infrastructureList(market),
      note:
        "Infrastructure addresses are excluded from whale rankings, " +
        "concentration statistics, holder snapshots and whale movement reports. " +
        "The liquidity pool remains active internally for DEX buy/sell classification.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Unable to load labeled infrastructure addresses.",
    });
  }
});

app.get("/api/market", async (_req, res) => {
  try {
    const market = await getMarket();
    const token = await fetchJson(`${API_BASE}/tokens/${TOKEN}`);
    const holdersCount = Number(token?.holders_count || 0);

    res.json({
      priceUsd: market.priceUsd,
      priceEth: market.priceEth,
      marketCapDisplay: `$${compact(market.marketCapUsd)}`,
      liquidityDisplay: `$${compact(market.liquidityUsd)}`,
      volume24hDisplay: `$${compact(market.volume24hUsd)}`,
      holdersDisplay:
        Number.isFinite(holdersCount) && holdersCount > 0
          ? holdersCount.toLocaleString("en-US")
          : "UNAVAILABLE",
      priceChange24h: market.priceChange24h,
    });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Live market data unavailable." });
  }
});

app.get("/api/whales", async (req, res) => {
  try {
    res.json(await whalePayload(req.query.limit));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load whale activity." });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const data = await whalePayload(100);
    res.json({
      metadata: data.metadata,
      infrastructure: data.infrastructure,
      excludedInfrastructure: data.excludedInfrastructure,
      generatedAt: data.generatedAt,
      snapshot: data.snapshot,
      stats: data.stats,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load whale statistics." });
  }
});

app.get("/api/rank", async (req, res) => {
  const wallet = String(req.query.wallet || "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({
      error: "Enter a valid EVM wallet address.",
    });
  }

  try {
    const cache = await getFullHolders();
    rotateSnapshots(cache);

    const infrastructure = cache.infrastructure.find(
      (item) => item.address.toLowerCase() === wallet.toLowerCase()
    );

    if (infrastructure?.excludeFromWhaleStats) {
      return res.json({
        found: false,
        excluded: true,
        wallet,
        label: infrastructure.label,
        tag: infrastructure.tag,
        type: infrastructure.type,
        reason:
          "Infrastructure addresses are excluded from participant whale rankings.",
      });
    }

    const holder = cache.holders.find(
      (item) =>
        item.address.toLowerCase() === wallet.toLowerCase()
    );

    if (!holder) {
      return res.json({
        found: false,
        wallet,
        rank: null,
        balance: "0",
      });
    }

    return res.json({
      found: true,
      wallet: holder.address,
      rank: holder.rank,
      balance: holder.balance,
      movement: movement(holder, cache.metadata.decimals),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Unable to load wallet rank.",
    });
  }
});


app.get("/api/whale/:rank", async (req, res) => {
  try {
    const rank = Number(req.params.rank);

    if (!Number.isInteger(rank) || rank < 1 || rank > 30) {
      return res.status(400).json({
        error: "Whale rank must be between 1 and 30.",
      });
    }

    const cache = await getTopHolders();
    rotateSnapshots(cache);

    const holder = cache.holders[rank - 1];

    if (!holder) {
      return res.status(404).json({
        error: "Whale not found.",
      });
    }

    return res.json({
      whaleRank: rank,
      wallet: holder.address,
      balance: holder.balance,
      movement: movement(holder, cache.metadata.decimals),
      snapshot: {
        comparisonAvailable: Boolean(previousSnapshot),
        previousAt: previousSnapshot?.capturedAt || null,
        currentAt: currentSnapshot?.capturedAt || null,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to load whale profile.",
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.clear();

startActivityBackgroundRefresh();
  console.log("");
  console.log("🧠 HOODRAT Meme Intelligence Terminal");
  console.log("--------------------------------");
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Ready on port ${PORT}`);
  console.log("");
});
