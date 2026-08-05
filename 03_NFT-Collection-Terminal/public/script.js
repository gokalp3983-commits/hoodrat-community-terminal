const MARKET_REFRESH_MS = 30_000;

const elements = {
  boot: document.getElementById("boot"),  mintStatus: document.getElementById("mintStatus"),
  promptText: document.getElementById("promptText"),
  marketPriceStatus:
    document.getElementById("marketPriceStatus"),
  marketCapStatus:
    document.getElementById("marketCapStatus"),
  marketHoldersStatus:
    document.getElementById("marketHoldersStatus"),
  marketVolumeStatus:
    document.getElementById("marketVolumeStatus"),
  marketUpdatedStatus:
    document.getElementById("marketUpdatedStatus"),
  marketPrice:
    document.getElementById("marketPrice"),
  marketCap:
    document.getElementById("marketCap"),
  marketHolders:
    document.getElementById("marketHolders"),
  marketVolume:
    document.getElementById("marketVolume"),
  marketUpdated:
    document.getElementById("marketUpdated"),
  dataConnection:
    document.getElementById("dataConnection"),
  progressPercent:
    document.getElementById("progressPercent"),
  progressFill:
    document.getElementById("progressFill"),
  mintedCount:
    document.getElementById("mintedCount"),
  remainingCount:
    document.getElementById("remainingCount"),
  uniqueMinters:
    document.getElementById("uniqueMinters"),
  mintRate:
    document.getElementById("mintRate"),
  latestMint:
    document.getElementById("latestMint"),
  collectionDataStatus:
    document.getElementById("collectionDataStatus"),
  floorPrice:
    document.getElementById("floorPrice"),
  totalVolume:
    document.getElementById("totalVolume"),
  collectionOwners:
    document.getElementById("collectionOwners"),
  collectionSales:
    document.getElementById("collectionSales"),
  collectionListed:
    document.getElementById("collectionListed"),
  openSeaKeyNote:
    document.getElementById("openSeaKeyNote"),
  collectionUpdated:
    document.getElementById("collectionUpdated"),
  nftSalesStatus:
    document.getElementById("nftSalesStatus"),
  nftSalesUpdated:
    document.getElementById("nftSalesUpdated"),
  nftSalesRows:
    document.getElementById("nftSalesRows"),
  nftWhalesStatus:
    document.getElementById("nftWhalesStatus"),
  nftWhalesUpdated:
    document.getElementById("nftWhalesUpdated"),
  nftWhaleCount:
    document.getElementById("nftWhaleCount"),
  largestNftHolder:
    document.getElementById("largestNftHolder"),
  top10Concentration:
    document.getElementById("top10Concentration"),
  nftWhaleRows:
    document.getElementById("nftWhaleRows"),
  nftDistribution:
    document.getElementById("nftDistribution"),
  nftWalletForm:
    document.getElementById("nftWalletForm"),
  nftWalletInput:
    document.getElementById("nftWalletInput"),
  nftWalletResult:
    document.getElementById("nftWalletResult"),
};

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function writeBoot(html) {
  const line = document.createElement("div");
  line.className = "line";
  line.innerHTML = html || "&nbsp;";
  elements.boot.appendChild(line);
}

async function boot() {
  const sequence = [
    [
      '[ <span class="green">OK</span> ] ' +
      'Initializing HOODRAT Community Terminal',
      180,
    ],
    [
      '[ <span class="green">OK</span> ] ' +
      'NFT Collection Terminal module loaded',
      180,
    ],
    [
      '[ <span class="green">OK</span> ] ' +
      'NFT contract reference loaded',
      180,
    ],
    [
      '[ <span class="green">COMPLETE</span> ] ' +
      'Final on-chain mint record loaded',
      180,
    ],
    ["", 100],
    [
      '[ <span class="green">READY</span> ] ' +
      'View the completed collection on OpenSea.',
      0,
    ],
  ];

  for (const [line, delay] of sequence) {
    await sleep(delay);
    writeBoot(line);
  }
}

let hasMarketData = false;

function setMarketStatus(text, state = "") {
  for (const element of [
    elements.marketPriceStatus,
    elements.marketCapStatus,
    elements.marketHoldersStatus,
    elements.marketVolumeStatus,
    elements.marketUpdatedStatus,
  ]) {
    element.textContent = `[ ${text} ]`;
    element.classList.toggle(
      "error",
      state === "error"
    );
  }
}

function formatMarketTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function refreshMarketPanel() {
  setMarketStatus(
    hasMarketData ? "REFRESHING" : "CONNECTING"
  );

  try {
    const response = await fetch("/api/price", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const market = await response.json();

    elements.marketPrice.textContent =
      `$${market.priceUsd} USD / ` +
      `${market.priceEth} ETH`;

    elements.marketCap.textContent =
      market.marketCapDisplay || "UNAVAILABLE";

    elements.marketHolders.textContent =
      market.holdersDisplay || "UNAVAILABLE";

    elements.marketVolume.textContent =
      market.volume24hDisplay || "UNAVAILABLE";

    elements.marketUpdated.textContent =
      formatMarketTime(new Date());

    setMarketStatus("LIVE");
    hasMarketData = true;
  } catch (error) {
    setMarketStatus("UNAVAILABLE", "error");

    if (!hasMarketData) {
      elements.marketPrice.textContent =
        "UNAVAILABLE";
      elements.marketCap.textContent =
        "UNAVAILABLE";
      elements.marketHolders.textContent =
        "UNAVAILABLE";
      elements.marketVolume.textContent =
        "UNAVAILABLE";
      elements.marketUpdated.textContent = "—";
    }
  }
}

const MINT_STATS_REFRESH_MS = 10_000;

function setDisconnectedMintStats(){
  elements.dataConnection.textContent = "WAITING FOR DATA";
  elements.dataConnection.classList.remove("live");

  elements.progressPercent.textContent = "—";
  elements.progressFill.style.width = "0%";

  elements.mintedCount.textContent = "— / 2,222";
  elements.remainingCount.textContent = "—";
  elements.uniqueMinters.textContent = "—";
  elements.mintRate.textContent = "— NFT/min";
  elements.latestMint.textContent = "—";
}

function renderMintStats(stats){
  if(!stats?.connected){
    setDisconnectedMintStats();
    return;
  }

  const progress = Number(stats.progressPercent ?? 0);
  const safeProgress = Math.max(0, Math.min(100, progress));

  elements.dataConnection.textContent = "COMPLETE";
  elements.dataConnection.classList.add("live");

  elements.progressPercent.textContent =
    `${safeProgress.toFixed(2)}%`;

  elements.progressFill.style.width =
    `${safeProgress}%`;

  elements.mintedCount.textContent =
    `${stats.minted ?? "—"} / ${stats.totalSupply ?? 2222}`;

  elements.remainingCount.textContent =
    stats.remaining ?? "—";

  elements.uniqueMinters.textContent =
    stats.uniqueHolders ?? "—";

  elements.mintRate.textContent =
    `${stats.mintRatePerMinute ?? "—"} NFT/min`;

  if(stats.latestMint){
    const token =
      stats.latestMint.tokenId
        ? `#${stats.latestMint.tokenId}`
        : "NFT";

    const owner =
      stats.latestMint.toDisplay || "unknown";

    elements.latestMint.textContent =
      `${token} → ${owner}`;
  }else{
    elements.latestMint.textContent = "—";
  }

  if(stats.status){
    elements.mintStatus.textContent = stats.status;

    elements.mintStatus.classList.remove(
      "status-waiting",
      "status-live"
    );

    if(
      stats.status === "LIVE" ||
      stats.status === "COMPLETE"
    ){
      elements.mintStatus.classList.add(
        "status-live"
      );
    }else{
      elements.mintStatus.classList.add(
        "status-waiting"
      );
    }
  }
}

async function refreshMintStats(){
  try{
    const response = await fetch("/api/mint-stats", {
      headers: {
        Accept: "application/json",
      },
    });

    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }

    const stats = await response.json();
    renderMintStats(stats);
  }catch(error){
    setDisconnectedMintStats();
  }
}

const COLLECTION_STATS_REFRESH_MS = 60_000;

function formatCount(value){
  const amount = Number(value);

  if(!Number.isFinite(amount)){
    return "—";
  }

  return Math.trunc(amount).toLocaleString();
}

function setCollectionUnavailable(requiresApiKey = false){
  elements.collectionDataStatus.textContent =
    requiresApiKey ? "CONNECTING" : "UNAVAILABLE";

  elements.collectionDataStatus.classList.remove("live");

  elements.floorPrice.textContent = "—";
  elements.totalVolume.textContent = "—";
  elements.collectionOwners.textContent = "—";
  elements.collectionSales.textContent = "—";
  elements.collectionListed.textContent = "—";
  elements.collectionUpdated.textContent = "Updated —";
  elements.openSeaKeyNote.hidden = false;
  elements.openSeaKeyNote.textContent =
    requiresApiKey
      ? "Waiting for OpenSea marketplace data."
      : "OpenSea marketplace data is temporarily unavailable.";
}

function renderCollectionStats(stats){
  if(!stats?.connected){
    setCollectionUnavailable(
      Boolean(stats?.requiresApiKey)
    );
    return;
  }

  elements.collectionDataStatus.textContent = "LIVE";
  elements.collectionDataStatus.classList.add("live");
  elements.openSeaKeyNote.hidden = true;

  elements.floorPrice.textContent =
    stats.floorPriceDisplay || "UNAVAILABLE";

  elements.totalVolume.textContent =
    stats.totalVolumeDisplay || "UNAVAILABLE";

  elements.collectionOwners.textContent =
    formatCount(stats.owners);

  elements.collectionSales.textContent =
    formatCount(stats.sales);

  elements.collectionListed.textContent =
    formatCount(stats.listed);

  const updatedAt =
    stats.updatedAt
      ? new Date(stats.updatedAt)
      : new Date();

  elements.collectionUpdated.textContent =
    `Updated ${updatedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
}

async function refreshCollectionStats(){
  try{
    const response = await fetch(
      "/api/collection-stats",
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const stats = await response.json();

    if(!response.ok && !stats){
      throw new Error(`HTTP ${response.status}`);
    }

    renderCollectionStats(stats);
  }catch(error){
    setCollectionUnavailable(false);
  }
}


const NFT_SALES_REFRESH_MS = 60_000;
let hasNftSalesData = false;

function shortSaleAddress(address){
  const value = String(address || "");
  if(!/^0x[a-fA-F0-9]{40}$/.test(value)) return "UNAVAILABLE";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function relativeSaleTime(value){
  const timestamp = new Date(value).getTime();
  if(!Number.isFinite(timestamp)) return "time unavailable";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if(seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if(hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function setNftSalesStatus(text, state = ""){
  elements.nftSalesStatus.textContent = text;
  elements.nftSalesStatus.classList.toggle("live", state === "live");
  elements.nftSalesStatus.classList.toggle("stale", state === "stale");
  elements.nftSalesStatus.classList.toggle("error", state === "error");
}

function createSaleText(label, value, className = ""){
  const row = document.createElement("div");
  row.className = "nft-sale-detail";
  const key = document.createElement("span");
  key.textContent = label;
  const data = document.createElement("strong");
  data.textContent = value;
  if(className) data.className = className;
  row.append(key, data);
  return row;
}

function renderNftSales(data){
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  elements.nftSalesRows.replaceChildren();

  if(!data?.connected){
    const note = document.createElement("div");
    note.className = "nft-sale-placeholder";
    note.textContent = data?.requiresApiKey
      ? "Waiting for the OpenSea API connection."
      : "Recent OpenSea sales are temporarily unavailable.";
    elements.nftSalesRows.appendChild(note);
    setNftSalesStatus("UNAVAILABLE", "error");
    return;
  }

  if(!sales.length){
    const note = document.createElement("div");
    note.className = "nft-sale-placeholder";
    note.textContent = "No recent OpenSea sales were returned for this collection.";
    elements.nftSalesRows.appendChild(note);
  }else{
    for(const sale of sales){
      const article = document.createElement("article");
      article.className = "nft-sale-row";

      const header = document.createElement("div");
      header.className = "nft-sale-header";

      const token = document.createElement("strong");
      token.className = "nft-sale-token";
      token.textContent = sale.tokenId ? `HOODRAT #${sale.tokenId}` : "HOODRAT NFT";

      const price = document.createElement("strong");
      price.className = "nft-sale-price";
      price.textContent = sale.priceDisplay || "Price unavailable";

      const time = document.createElement("span");
      time.className = "nft-sale-time";
      time.textContent = relativeSaleTime(sale.occurredAt);

      header.append(token, price, time);
      article.appendChild(header);
      article.appendChild(createSaleText("Buyer", shortSaleAddress(sale.buyer)));
      article.appendChild(createSaleText("Seller", shortSaleAddress(sale.seller)));

      const link = document.createElement("a");
      link.className = "nft-sale-link";
      link.href = sale.openSeaUrl || "https://opensea.io/collection/hoodrats-nft/overview";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View sale on OpenSea →";
      article.appendChild(link);

      elements.nftSalesRows.appendChild(article);
    }
  }

  elements.nftSalesUpdated.textContent = data.updatedAt
    ? `Updated ${formatMarketTime(new Date(data.updatedAt))}`
    : "Updated —";

  setNftSalesStatus(data.stale ? "STALE" : "LIVE", data.stale ? "stale" : "live");
  hasNftSalesData = true;
}

async function refreshNftSales(){
  setNftSalesStatus(hasNftSalesData ? "UPDATING" : "CONNECTING");

  try{
    const response = await fetch("/api/nft-sales", {
      headers: { Accept: "application/json" },
    });
    const data = await response.json();

    if(!response.ok && !data?.sales?.length){
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    renderNftSales(data);
  }catch(error){
    if(!hasNftSalesData){
      elements.nftSalesRows.innerHTML =
        '<div class="nft-sale-placeholder">Unable to load recent OpenSea sales.</div>';
    }
    setNftSalesStatus(hasNftSalesData ? "STALE" : "ERROR", hasNftSalesData ? "stale" : "error");
  }
}

const NFT_WHALES_REFRESH_MS = 2 * 60 * 1000;
let nftWhaleSnapshot = null;

function shortWallet(address){
  const value = String(address || "");
  return value.length >= 12
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value || "—";
}

function formatHoodratTokens(value){
  const amount = Number(value);

  if(!Number.isFinite(amount)){
    return "—";
  }

  if(amount >= 1_000_000_000){
    return `${(amount / 1_000_000_000).toFixed(2)}B`;
  }

  if(amount >= 1_000_000){
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }

  if(amount >= 1_000){
    return `${(amount / 1_000).toFixed(2)}K`;
  }

  return amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

async function copyTextToClipboard(text){
  if(
    navigator.clipboard &&
    window.isSecureContext
  ){
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if(!copied){
    throw new Error("Clipboard copy failed");
  }
}

function showCopyFeedback(button, success){
  const icon = button.querySelector("span");
  const original = "⧉";

  button.classList.toggle(
    "copied",
    success
  );

  button.classList.toggle(
    "copy-error",
    !success
  );

  icon.textContent = success ? "✓" : "!";

  button.title = success
    ? "Copied"
    : "Copy failed";

  window.setTimeout(() => {
    icon.textContent = original;
    button.classList.remove(
      "copied",
      "copy-error"
    );
    button.title = "Copy wallet address";
  }, 1400);
}

function renderNftDistribution(distribution){
  const labels = [
    ["1", "1 NFT"],
    ["2", "2 NFTs"],
    ["3-5", "3–5 NFTs"],
    ["6-9", "6–9 NFTs"],
    ["10+", "10+ NFTs"],
  ];

  const totalWallets = labels.reduce(
    (sum, [key]) =>
      sum + Number(distribution?.[key] || 0),
    0
  );

  elements.nftDistribution.innerHTML = "";

  for(const [key, label] of labels){
    const count = Number(distribution?.[key] || 0);
    const percent = totalWallets > 0
      ? count / totalWallets * 100
      : 0;

    const row = document.createElement("div");
    row.className = "distribution-row";
    row.innerHTML = `
      <div class="distribution-label">
        <span>${label}</span>
        <strong>${count.toLocaleString()} wallets</strong>
      </div>
      <div class="distribution-track">
        <div
          class="distribution-fill"
          style="width:${percent.toFixed(2)}%"
        ></div>
      </div>
    `;
    elements.nftDistribution.appendChild(row);
  }
}

function renderNftWhales(data){
  nftWhaleSnapshot = data;
  elements.nftWhalesStatus.textContent =
    data.tokenBalancesReady
      ? "LIVE"
      : "RANKINGS LIVE · TOKENS WARMING";

  elements.nftWhalesStatus.classList.add("live");

  elements.nftWhalesUpdated.textContent =
    `Updated ${new Date(
      data.updatedAt || Date.now()
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;

  elements.nftWhaleCount.textContent =
    Number(data.whaleCount || 0).toLocaleString();

  elements.largestNftHolder.textContent =
    `${Number(data.largestHolder || 0)} NFTs`;

  elements.top10Concentration.textContent =
    `${Number(
      data.top10ConcentrationPercent || 0
    ).toFixed(2)}%`;

  const holders = Array.isArray(data.topHolders)
    ? data.topHolders
    : [];

  elements.nftWhaleRows.innerHTML = holders.length
    ? holders.map((holder) => `
        <tr>
          <td>#${holder.rank}</td>
          <td>
            <span class="wallet-address-cell">
              <span
                class="wallet-address"
                title="${holder.address}"
              >
                ${shortWallet(holder.address)}
              </span>
              <button
                type="button"
                class="copy-wallet-button"
                data-copy-address="${holder.address}"
                aria-label="Copy wallet address ${holder.address}"
                title="Copy wallet address"
              >
                <span aria-hidden="true">⧉</span>
              </button>
            </span>
          </td>
          <td class="numeric-cell">${holder.count}</td>
          <td class="numeric-cell">${Number(
            holder.sharePercent || 0
          ).toFixed(2)}%</td>
          <td class="numeric-cell token-holding">
            ${formatHoodratTokens(
              holder.hoodratTokens
            )}
          </td>
        </tr>
      `).join("")
    : '<tr><td colspan="5">No holder data available.</td></tr>';

  renderNftDistribution(data.distribution);
}

async function fetchNftWhales(address = ""){
  const query = address
    ? `?address=${encodeURIComponent(address)}`
    : "";

  const response = await fetch(
    `/api/nft-whales${query}`,
    { headers: { Accept: "application/json" } }
  );

  const data = await response.json();

  if(!response.ok || !data.connected){
    throw new Error(
      data.error || `HTTP ${response.status}`
    );
  }

  return data;
}

async function refreshNftWhales(){
  try{
    const data = await fetchNftWhales();
    renderNftWhales(data);

    if(!data.tokenBalancesReady){
      window.setTimeout(
        refreshNftWhales,
        15_000
      );
    }
  }catch(error){
    elements.nftWhalesStatus.textContent =
      "UNAVAILABLE";
    elements.nftWhalesStatus.classList.remove("live");
    elements.nftWhaleRows.innerHTML =
      '<tr><td colspan="5">Unable to load NFT holder rankings.</td></tr>';
  }
}

elements.nftWhaleRows.addEventListener(
  "click",
  async (event) => {
    const button = event.target.closest(
      ".copy-wallet-button"
    );

    if(!button) return;

    const address =
      button.dataset.copyAddress || "";

    try{
      await copyTextToClipboard(address);
      showCopyFeedback(button, true);
    }catch(error){
      showCopyFeedback(button, false);
    }
  }
);

elements.nftWalletForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const address =
      elements.nftWalletInput.value.trim();

    if(!/^0x[a-fA-F0-9]{40}$/.test(address)){
      elements.nftWalletResult.textContent =
        "Enter a valid 0x wallet address.";
      return;
    }

    elements.nftWalletResult.textContent =
      "Checking wallet...";

    try{
      const data = await fetchNftWhales(address);
      const wallet = data.wallet;

      if(!wallet?.found){
        elements.nftWalletResult.textContent =
          "No HOODRATS NFTs currently held by this wallet.";
        return;
      }

      elements.nftWalletResult.innerHTML = `
        <strong>${shortWallet(wallet.address)}</strong><br>
        Rank: #${wallet.rank}<br>
        NFTs owned: ${wallet.count}<br>
        Status: ${wallet.isWhale
          ? '<span class="green">NFT WHALE</span>'
          : 'NFT COLLECTOR'}
      `;
    }catch(error){
      elements.nftWalletResult.textContent =
        "Unable to check this wallet right now.";
    }
  }
);

refreshMarketPanel();
setInterval(
  refreshMarketPanel,
  MARKET_REFRESH_MS
);

refreshMintStats();
setInterval(
  refreshMintStats,
  MINT_STATS_REFRESH_MS
);

refreshNftSales();
setInterval(
  refreshNftSales,
  NFT_SALES_REFRESH_MS
);

refreshNftWhales();
setInterval(
  refreshNftWhales,
  NFT_WHALES_REFRESH_MS
);

refreshCollectionStats();
setInterval(
  refreshCollectionStats,
  COLLECTION_STATS_REFRESH_MS
);

boot();
