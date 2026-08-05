

const boot=document.getElementById("boot");
const history=document.getElementById("history");
const promptRow=document.getElementById("promptRow");
const input=document.getElementById("commandInput");
const marketPriceStatus=document.getElementById("marketPriceStatus");
const marketCapStatus=document.getElementById("marketCapStatus");
const marketHoldersStatus=document.getElementById("marketHoldersStatus");
const marketVolumeStatus=document.getElementById("marketVolumeStatus");
const marketUpdatedStatus=document.getElementById("marketUpdatedStatus");
const marketPrice=document.getElementById("marketPrice");
const marketCap=document.getElementById("marketCap");
const marketHolders=document.getElementById("marketHolders");
const marketVolume=document.getElementById("marketVolume");
const marketUpdated=document.getElementById("marketUpdated");
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

function esc(v){
  return String(v??"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function short(a){
  const v=String(a||"");
  return v.length>14?`${v.slice(0,8)}...${v.slice(-6)}`:v;
}

function walletWithCopy(address){
  const full=String(address||"");

  return `
    <span class="wallet-cell" title="${esc(full)}">
      <span class="cyan">${esc(short(full))}</span>
      <button
        type="button"
        class="copy-wallet"
        data-wallet="${esc(full)}"
        aria-label="Copy full wallet address"
        title="Copy full wallet address"
      >⧉</button>
    </span>
  `;
}

function labeledAddress(address,label="",tag=""){
  if(!label)return walletWithCopy(address);

  return `
    <span class="wallet-cell">
      <span class="orange">[ ${esc(tag||"INFRA")} ]</span>
      <span class="yellow">${esc(label)}</span>
      ${walletWithCopy(address)}
    </span>
  `;
}

function showCopyNotice(){
  const notice=document.createElement("div");
  notice.className="copy-notice";
  notice.textContent="[ OK ] Wallet address copied to clipboard.";
  history.append(notice);
  notice.scrollIntoView({behavior:"smooth",block:"nearest"});
  setTimeout(()=>notice.remove(),2000);
}

async function copyWallet(address){
  try{
    await navigator.clipboard.writeText(address);
  }catch{
    const area=document.createElement("textarea");
    area.value=address;
    area.setAttribute("readonly","");
    area.style.position="absolute";
    area.style.left="-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  showCopyNotice();
}
async function getJson(url){
  const response=await fetch(url,{cache:"no-store",headers:{Accept:"application/json"}});
  const data=await response.json();

  if(!response.ok){
    const error=new Error(data.error||"Request failed.");
    error.status=response.status;
    error.warming=Boolean(data.warming);
    error.hours=data.hours;
    throw error;
  }

  return data;
}

function cacheWarmingMessage(command,hours){
  const period=Number(hours)===12?"12-hour":"24-hour";
  block(`
    <div class="yellow">[ CACHE BUILDING ] ${period} activity data is being assembled.</div>
    <div class="muted">The tracker is fetching and classifying several Blockscout pages while pacing requests to avoid HTTP 429 rate limits. A cold Render start can take a few minutes. Use <span class="cyan">status</span> to see progress, then retry <span class="cyan">${esc(command)}</span> when the cache is READY.</div>
  `);
}
function echo(command){
  const line=document.createElement("div");
  line.className="line";
  line.innerHTML=`<span class="green">hoodrat@whales:~$</span> ${esc(command)}`;
  history.append(line);
}
function showProgress(message){
  const line=document.createElement("div");
  line.className="line muted";
  line.innerHTML=`<span class="orange">⟳</span> ${esc(message)}`;
  history.append(line);
  line.scrollIntoView({behavior:"smooth",block:"nearest"});
  return line;
}
function block(html){
  const el=document.createElement("div");
  el.className="block";el.innerHTML=html;history.append(el);
  el.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function help(){
  block(`
    <div>
      [ <span class="green">READY</span> ] Command panel opened.
    </div>
    <div class="help-open-copy">
      Click any command on the right to place it into the prompt.<br>
      Type a command manually or select one from the sidebar.
    </div>
  `);
}
function whaleTable(data,title,limit=30){
  const rows=data.whales.slice(0,limit).map(w=>`
    <tr>
      <td>#${w.rank}</td><td>${walletWithCopy(w.address)}</td>
      <td>${formatTokenAmount(w.balance)}</td>
      <td class="${w.movement.status==="ACCUMULATING"?"green":w.movement.status==="DISTRIBUTING"?"red":""}">
        ${esc(w.movement.status)}
      </td>
      <td>${data.snapshot.comparisonAvailable?formatSignedTokenAmount(w.movement.signedDelta):"baseline"}</td>
    </tr>`).join("");
  block(`
    <div class="yellow">${title}</div>
    <div class="muted">${
      data.snapshot.comparisonAvailable
      ?"Compared with the previous server snapshot."
      :`Baseline created. Movement appears after the next ${data.snapshot.intervalMinutes}-minute snapshot.`
    }</div>
    <table>
      <thead><tr><th>Rank</th><th>Wallet</th><th>Balance</th><th>Status</th><th>Change</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}
async function rank(wallet){
  const d=await getJson(`/api/rank?wallet=${encodeURIComponent(wallet)}`);
  if(d.excluded){
    block(`
      <div class="orange">Labeled Infrastructure Address</div>
      <div class="kv"><span>Address</span>${labeledAddress(d.wallet,d.label,d.tag)}</div>
      <div class="kv"><span>Type</span><span>${esc(d.type)}</span></div>
      <div class="muted">${esc(d.reason)}</div>
    `);
    return;
  }

  if(!d.found){
    block(`<div class="red">Wallet not found in the current holder list.</div>`);
    return;
  }
  block(`
    <div class="yellow">Wallet Rank</div>
    <div class="kv"><span>Wallet</span>${walletWithCopy(d.wallet)}</div>
    <div class="kv"><span>Current Rank</span><span>#${d.rank}</span></div>
    <div class="kv"><span>Balance</span><span>${formatTokenAmount(d.balance)} HOODRAT</span></div>
    <div class="kv"><span>Status</span><span>${esc(d.movement.status)}</span></div>
    <div class="kv"><span>Balance Change</span><span>${formatSignedTokenAmount(d.movement.signedDelta)}</span></div>
    <div class="kv"><span>Rank Change</span><span>${d.movement.rankChange>0?"▲ +":d.movement.rankChange<0?"▼ ":"="}${Math.abs(d.movement.rankChange)}</span></div>
  `);
}

async function whaleProfile(rankNumber){
  const d=await getJson(`/api/whale/${encodeURIComponent(rankNumber)}`);

  block(`
    <div class="yellow">Whale #${d.whaleRank}</div>
    <div class="kv"><span>Wallet</span><span>${walletWithCopy(d.wallet)}</span></div>
    <div class="kv"><span>Current Rank</span><span>#${d.whaleRank}</span></div>
    <div class="kv"><span>Current Balance</span><span>${formatTokenAmount(d.balance)} HOODRAT</span></div>
    <div class="kv"><span>Status</span><span class="${
      d.movement.status==="ACCUMULATING"
        ?"green"
        :d.movement.status==="DISTRIBUTING"
          ?"red"
          :""
    }">${esc(d.movement.status)}</span></div>
    <div class="kv"><span>Balance Change</span><span>${formatSignedTokenAmount(d.movement.signedDelta)}</span></div>
    <div class="kv"><span>Previous Rank</span><span>#${d.movement.previousRank}</span></div>
    <div class="kv"><span>Rank Change</span><span>${d.movement.rankChange>0?"▲ +":d.movement.rankChange<0?"▼ ":"="}${Math.abs(d.movement.rankChange)}</span></div>
    <div class="muted">${
      d.snapshot.comparisonAvailable
        ?"Compared with the previous server snapshot."
        :"Baseline snapshot only. Movement data will appear after the next snapshot."
    }</div>
  `);
}



function cacheNotice(data){
  const response=data?.responseCache;
  const sources=data?.cache;

  if(!response?.stale&&!sources?.stale)return "";

  const age=response?.ageSeconds ?? Math.max(
    Number(sources?.holders?.ageSeconds||0),
    Number(sources?.market?.ageSeconds||0),
    Number(sources?.transfers?.ageSeconds||0)
  );

  return `
    <div class="yellow">
      [ CACHE ] Background activity data is ${formatAge(age)} old.
    </div>
  `;
}


function cleanNumber(value){
  const number=Number(value);
  return Number.isFinite(number)?number:0;
}

function formatTokenAmount(value,maximumFractionDigits=2){
  const number=cleanNumber(value);
  const normalized=Math.abs(number)<0.005?0:number;

  return normalized.toLocaleString(undefined,{
    minimumFractionDigits:0,
    maximumFractionDigits
  });
}

function formatSignedTokenAmount(value,maximumFractionDigits=2){
  const number=cleanNumber(value);
  const normalized=Math.abs(number)<0.005?0:number;
  const absolute=formatTokenAmount(Math.abs(normalized),maximumFractionDigits);

  if(normalized>0)return `+${absolute}`;
  if(normalized<0)return `-${absolute}`;
  return "0";
}

function formatCompactBalance(value){
  const number=cleanNumber(value);
  const absolute=Math.abs(number);
  const units=[
    [1e12,"T"],
    [1e9,"B"],
    [1e6,"M"],
    [1e3,"K"]
  ];

  for(const [threshold,suffix] of units){
    if(absolute>=threshold){
      const compact=number/threshold;
      return `${compact.toLocaleString(undefined,{
        minimumFractionDigits:0,
        maximumFractionDigits:2
      })}${suffix}`;
    }
  }

  return formatTokenAmount(number);
}

function holderRank(value,rankLabel=""){
  const numeric=Number(value);
  const rank=Number.isFinite(numeric)
    ?Math.trunc(numeric)
    :NaN;

  if(Number.isInteger(rank)&&rank>0){
    return `#${rank.toLocaleString()}`;
  }

  if(rankLabel){
    const className=rankLabel.includes("Contract")
      ?"orange"
      :rankLabel.includes("No Balance")
        ?"muted"
        :"yellow";

    return `<span class="${className}">${esc(rankLabel)}</span>`;
  }

  return `<span class="muted">N/A</span>`;
}


function formatAge(totalSeconds){
  const seconds=Math.max(0,Math.floor(Number(totalSeconds)||0));
  if(seconds<60)return `${seconds}s`;
  if(seconds<3600)return `${Math.floor(seconds/60)}m`;
  if(seconds<86400)return `${Math.floor(seconds/3600)}h`;
  return `${Math.floor(seconds/86400)}d`;
}

function compactTimeAgo(timestamp){
  return timeAgo(timestamp).replace(/\s+ago$/,"");
}

function timeAgo(timestamp){
  const seconds=Math.max(0,Math.floor((Date.now()-Number(timestamp))/1000));
  if(seconds<60)return `${seconds}s ago`;
  if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;
  if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`;
  return `${Math.floor(seconds/86400)}d ago`;
}
function tradeRows(rows,mode){
  return rows.map((row,index)=>`
    <tr>
      <td>#${index+1}</td>
      <td>${walletWithCopy(row.wallet)}</td>
      <td class="rank-col">${holderRank(row.holderRank,row.rankLabel)}</td>
      ${mode==="both"?`
        <td class="green">${formatTokenAmount(row.bought)}</td>
        <td class="red">${formatTokenAmount(row.sold)}</td>
      `:`<td class="${mode==="buy"?"green":"red"}">${formatTokenAmount(mode==="buy"?row.bought:row.sold)}</td>`}
      <td>${formatSignedTokenAmount(row.net)}</td>
      <td>${timeAgo(row.lastActivityAt)}</td>
    </tr>`).join("");
}
function traderTable(rows,title,mode="both"){
  block(`
    <div class="orange">${title}</div>
    <table>
      <thead><tr><th>#</th><th>Wallet</th><th class="rank-col">Holder Rank</th>${mode==="both"?"<th>Bought</th><th>Sold</th>":`<th>${mode==="buy"?"Bought":"Sold"}</th>`}<th>Net</th><th>Last</th></tr></thead>
      <tbody>${tradeRows(rows,mode)||`<tr><td colspan="${mode==="both"?7:6}" class="muted">No matching DEX activity found.</td></tr>`}</tbody>
    </table>`);
}
async function activityDashboard(){
  const d=await getJson("/api/activity?hours=24");
  const largest=(trade,label,klass)=>trade?`
    <div class="kv"><span>${label}</span><span class="${klass}">${formatTokenAmount(trade.amount)} HOODRAT</span></div>
    <div class="kv"><span>Wallet</span>${walletWithCopy(trade.wallet)}</div>
    <div class="kv"><span>Current Holder Rank</span><span>${holderRank(trade.holderRank,trade.rankLabel)}</span></div>
    <div class="kv"><span>Time</span><span>${timeAgo(trade.timestamp)}</span></div>`:`<div class="muted">No ${label.toLowerCase()} detected.</div>`;
  block(`
    ${cacheNotice(d)}
    <div class="orange">24h On-Chain Whale Activity</div>
    ${largest(d.largestBuy,"Largest Buy","green")}
    ${largest(d.largestSell,"Largest Sell","red")}
    <div class="kv"><span>DEX Pair</span>${
      labeledAddress(
        d.pairAddress,
        d.pairLabel?.label || "HOODRAT/WETH Liquidity Pool",
        d.pairLabel?.tag || "LP"
      )
    }</div>
    <div class="muted">Buys and sells are classified from transfers involving the highest-liquidity HOODRAT/WETH pair.</div>
    ${d.cache?.rankCoverage==="top-300-immediate"
      ?'<div class="yellow">[ RANKS ] Showing immediate Top-300 ranks while the complete holder-rank cache refreshes in the background.</div>'
      :d.cache?.rankCoverage==="full-cache"
        ?'<div class="muted">[ RANKS ] Complete participant-holder rank cache active.</div>'
        :''}`);
  traderTable(d.topAccumulators,"Top 10 Net Accumulators — 24h","both");
  traderTable(d.topDistributors,"Top 10 Net Distributors — 24h","both");
}

async function whales12(){
  let d;

  try{
    d=await getJson("/api/whales12");
  }catch(error){
    if(error.warming||String(error.message||"").includes("warming up")){
      block(`
        <div class="yellow">[ CACHE ] Top-30 whale activity is warming up.</div>
        <div class="muted">Please run <span class="cyan">whales12</span> again in a few seconds.</div>
      `);
      return;
    }

    throw error;
  }
  const summary=d.summary||{};
  const rows=(d.whales||[]).map((whale)=>`
    <tr class="${Number(whale.rank)===21?"whales12-tier-break":""}">
      <td class="rank-col">#${Number(whale.rank).toLocaleString()}</td>
      <td>${walletWithCopy(whale.wallet)}</td>
      <td class="amount-col balance-col">${formatCompactBalance(whale.balance)}</td>
      <td class="amount-col">${formatTokenAmount(whale.bought)}</td>
      <td class="amount-col">${formatTokenAmount(whale.sold)}</td>
      <td class="amount-col ${Number(whale.netRaw)>0?"green":Number(whale.netRaw)<0?"red":"muted"}">${formatSignedTokenAmount(whale.net)}</td>
      <td class="rank-col">${Number(whale.trades).toLocaleString()}</td>
      <td class="status-col status-${String(whale.status||"").toLowerCase()}">${esc(whale.statusLabel||whale.status)}</td>
    </tr>
  `).join("");

  block(`
    ${cacheNotice(d)}
    <div class="orange">Top-30 Whale Activity — Last 12 Hours</div>
    <div class="whales12-summary">
      <div><span class="muted">Accumulating</span> <span class="green">${Number(summary.accumulating||0)}</span></div>
      <div><span class="muted">Distributing</span> <span class="red">${Number(summary.distributing||0)}</span></div>
      <div><span class="muted">Balanced</span> <span class="yellow">${Number(summary.balanced||0)}</span></div>
      <div><span class="muted">Dormant</span> <span>${Number(summary.dormant||0)}</span></div>
      <div><span class="muted">Net Top-30 Flow</span> <span class="${Number(summary.netFlowRaw)>0?"green":Number(summary.netFlowRaw)<0?"red":"muted"}">${formatSignedTokenAmount(summary.netFlow||0)}</span></div>
      <div><span class="muted">Trades</span> <span>${Number(summary.trades||0).toLocaleString()}</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="rank-col">Rank</th>
          <th>Wallet</th>
          <th class="amount-col">Balance</th>
          <th class="amount-col">Bought</th>
          <th class="amount-col">Sold</th>
          <th class="amount-col">Net</th>
          <th class="rank-col">Trades</th>
          <th class="status-col">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="muted">
      DEX buys and sells only. Wallet-to-wallet transfers are not mixed into this signal.
    </div>
  `);
}

async function traders12(){
  const d=await getJson("/api/traders12");
  if(cacheNotice(d))block(cacheNotice(d));
  if(d.cache?.rankCoverage==="top-300-immediate"){
    block(`<div class="yellow">[ RANKS ] Immediate Top-300 ranks shown. Complete ranks are refreshing in the background.</div>`);
  }
  traderTable(d.topBuyers,"Top 10 HOODRAT Buyers — Last 12 Hours","buy");
  traderTable(d.topSellers,"Top 10 HOODRAT Sellers — Last 12 Hours","sell");
}
async function recentTransactions(){
  const d=await getJson("/api/activity?hours=24");
  const rows=d.recentWhaleTransactions.map(t=>`
    <tr>
      <td class="type-col">
        <span class="trade-type ${t.type==="BUY"?"green":"red"}">${esc(t.type)}</span>
      </td>
      <td class="rank-col">${holderRank(t.holderRank,t.rankLabel)}</td>
      <td>${walletWithCopy(t.wallet)}</td>
      <td class="amount-col">${formatTokenAmount(t.amount)}</td>
      <td class="time-col">${compactTimeAgo(t.timestamp)}</td>
    </tr>`).join("");
  block(`<div class="orange">Recent Top-30 Whale Trades</div><table class="recent-trades-table">
  <thead>
    <tr>
      <th class="type-col">Type</th>
      <th class="rank-col">Holder Rank</th>
      <th>Wallet</th>
      <th class="amount-col">HOODRAT</th>
      <th class="time-col">Time</th>
    </tr>
  </thead>
  <tbody>${rows||`<tr><td colspan="5" class="muted">No recent Top-30 whale trades found.</td></tr>`}</tbody>
</table>`);
}
async function newWhales(){
  const d=await getJson("/api/activity?hours=24");
  if(!d.snapshot.comparisonAvailable){
    block(`<div class="yellow">New-whale comparison is not ready yet.</div><div class="muted">A baseline has been created. Re-run after ${d.snapshot.intervalMinutes} minutes.</div>`);return;
  }
  const rows=d.newWhales.map(w=>`<tr><td>#${w.rank}</td><td>${walletWithCopy(w.address)}</td><td>${formatTokenAmount(w.balance)}</td></tr>`).join("");
  block(`<div class="orange">New Top-30 Whale Wallets</div><table><thead><tr><th>Rank</th><th>Wallet</th><th>Balance</th></tr></thead><tbody>${rows||`<tr><td colspan="3" class="muted">No new Top-30 entrants since the previous snapshot.</td></tr>`}</tbody></table>`);
}

async function infrastructure(){
  const d=await getJson("/api/infrastructure");
  const rows=d.addresses.map(item=>`
    <tr>
      <td class="orange">[ ${esc(item.tag)} ]</td>
      <td>${esc(item.label)}</td>
      <td>${walletWithCopy(item.address)}</td>
      <td>${item.excludeFromWhaleStats
        ?'<span class="green">EXCLUDED</span>'
        :'<span class="muted">INCLUDED</span>'}</td>
    </tr>`).join("");

  block(`
    <div class="orange">Labeled Infrastructure Addresses</div>
    <table>
      <thead><tr><th>Tag</th><th>Label</th><th>Address</th><th>Whale Stats</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="muted">${esc(d.note)}</div>
  `);
}

async function cacheStatus(){
  const d=await getJson("/api/cache-status");
  const row=(label,item,extra="")=>`
    <div class="kv"><span>${esc(label)}</span><span class="${item.state==="READY"?"green":item.state==="ERROR"?"red":item.state==="BUILDING"?"yellow":"muted"}">${esc(item.state)}${extra}</span></div>`;

  const progress=d.transfers?.progress;
  const transferExtra=progress
    ?` — ${Number(progress.pagesFetched||0).toLocaleString()} pages / ${Number(progress.transfersFetched||0).toLocaleString()} transfers`
    :(d.transfers?.pagesFetched?` — ${Number(d.transfers.pagesFetched).toLocaleString()} pages cached`:"");
  const cooldown=d.transfers?.cooldownSeconds>0
    ?`<div class="muted">Blockscout cooldown: ${Number(d.transfers.cooldownSeconds)} seconds</div>`:"";
  const errors=[d.activity12?.error,d.activity24?.error,d.transfers?.error].filter(Boolean);

  block(`
    <div class="yellow">[ WHALE CACHE STATUS ]</div>
    ${row("12h activity",d.activity12)}
    ${row("24h activity",d.activity24)}
    ${row("Holder data",d.holders)}
    ${row("Transfer data",d.transfers,transferExtra)}
    ${row("Market data",d.market)}
    <div class="kv"><span>Background worker</span><span class="${d.backgroundWorker?"green":"red"}">${d.backgroundWorker?"RUNNING":"STOPPED"}</span></div>
    ${cooldown}
    ${d.transfers?.truncated?`<div class="muted">Initial transfer cache is bounded (${esc(d.transfers.partialReason||"safety limit")}) and remains usable while later refreshes continue.</div>`:""}
    ${errors.length?`<div class="red">Latest error: ${esc(errors[0])}</div>`:""}
    <div class="muted">READY means usable cached data exists. BUILDING means the background worker is fetching data. ERROR means the latest request failed without a usable cache.</div>
  `);
}

async function execute(command){
  const text=command.trim(),lower=text.toLowerCase();
  if(!text)return;
  highlightActiveCommand(lower);
  echo(text);

  let progress=null;

  try{
    if(lower==="help"){
      revealCommandPanel();
      help();
    }
    else if(lower==="clear"){
      history.innerHTML="";
    }
    else if(lower==="status"){
      progress=showProgress("Checking whale cache and Blockscout scan progress... Please wait.");
      await cacheStatus();
      progress.remove();
    }
    else if(lower==="whales12"){
      progress=showProgress("Loading Top-30 whale activity for the last 12 hours... Please wait.");
      await whales12();
      progress.remove();
    }
    else if(lower==="whales"){
      progress=showProgress("Retrieving Top 30 whale activities... Please wait.");
      const data=await getJson("/api/whales?limit=30");
      progress.remove();
      whaleTable(data,"Current Whale List (Top 30 Participant Wallets)",30);
    }
    else if(lower==="leaderboard"){
      progress=showProgress("Retrieving current tracked-holder rankings... Please wait.");
      const data=await getJson("/api/whales?limit=250");
      progress.remove();
      whaleTable(data,"Tracked Holder Leaderboard",50);
    }
    else if(/^whale\s+\d+$/i.test(text)){
      const rankNumber=Number(text.split(/\s+/)[1]);

      if(rankNumber<1||rankNumber>30){
        block(`<div class="red">Whale rank must be between 1 and 30.</div>`);
      }else{
        progress=showProgress(`Retrieving Whale #${rankNumber} profile... Please wait.`);
        await whaleProfile(rankNumber);
        progress.remove();
      }
    }
    else if(lower==="activity"){
      progress=showProgress("Analyzing 24-hour HOODRAT DEX activity... Please wait.");
      await activityDashboard();progress.remove();
    }
    else if(lower==="traders12"||lower==="activity12"){
      progress=showProgress("Ranking HOODRAT buyers and sellers from the last 12 hours... Please wait.");
      await traders12();progress.remove();
    }
    else if(lower==="accumulators"){
      progress=showProgress("Calculating 24-hour net accumulation... Please wait.");
      const d=await getJson("/api/activity?hours=24");progress.remove();
      traderTable(d.topAccumulators,"Top 10 Net Accumulators — 24h","both");
    }
    else if(lower==="distributors"){
      progress=showProgress("Calculating 24-hour net distribution... Please wait.");
      const d=await getJson("/api/activity?hours=24");progress.remove();
      traderTable(d.topDistributors,"Top 10 Net Distributors — 24h","both");
    }
    else if(lower==="transactions"){
      progress=showProgress("Retrieving recent Top-30 whale trades... Please wait.");
      await recentTransactions();progress.remove();
    }
    else if(lower==="newwhales"){
      progress=showProgress("Checking for new Top-30 whale wallets... Please wait.");
      await newWhales();progress.remove();
    }
    else if(lower==="movers"){
      progress=showProgress("Comparing tracked-holder snapshots... Please wait.");
      const d=await getJson("/api/whales?limit=250");
      progress.remove();

      if(!d.snapshot.comparisonAvailable){
        block(`<div class="yellow">Movement data is not ready yet.</div><div class="muted">Re-run after ${d.snapshot.intervalMinutes} minutes.</div>`);
      }else{
        d.whales.sort((a,b)=>Math.abs(b.movement.rankChange)-Math.abs(a.movement.rankChange));
        whaleTable(d,"Biggest Tracked-Holder Movers",30);
      }
    }
    else if(lower==="stats"){
      progress=showProgress("Calculating whale statistics... Please wait.");
      const d=await getJson("/api/stats");
      progress.remove();

      const l=d.stats.largestHolder;
      block(`
        <div class="yellow">Whale Statistics</div>
        <div class="kv"><span>Defined Whales</span><span>Top-30 whales</span></div>
        <div class="kv"><span>On-Chain Holders</span><span>${Number(d.metadata.holdersCount).toLocaleString()}</span></div>
        <div class="kv"><span>Participant Holders</span><span>${Number(d.metadata.participantHoldersCount||d.metadata.holdersCount).toLocaleString()}</span></div>
        <div class="kv"><span>Top 10 Control</span><span>${Number(d.stats.top10ControlPct).toFixed(2)}%</span></div>
        <div class="kv"><span>Top 100 Control</span><span>${Number(d.stats.top100ControlPct).toFixed(2)}%</span></div>
        <div class="kv"><span>Largest Holder</span><span>${l?walletWithCopy(l.address):"Unavailable"}</span></div>
        <div class="kv"><span>Largest Balance</span><span>${l?formatTokenAmount(l.balance):"Unavailable"}</span></div>
        <div class="kv"><span>Net Tracked Flow</span><span>${formatSignedTokenAmount(d.stats.netWhaleFlowSigned)}</span></div>
        <div class="kv"><span>Overall Status</span><span>${esc(d.stats.sentiment)}</span></div>
        <div class="kv"><span>Excluded Infrastructure</span><span>${Number(d.metadata.excludedInfrastructureCount||0)}</span></div>`);
    }
    else if(lower==="infrastructure"||lower==="infra"){
      progress=showProgress("Loading labeled infrastructure addresses... Please wait.");
      await infrastructure();
      progress.remove();
    }
    else if(lower.startsWith("rank ")){
      progress=showProgress("Retrieving wallet rank... Please wait.");
      await rank(text.slice(5).trim());
      progress.remove();
    }
    else if(/^0x[a-fA-F0-9]{40}$/.test(text)){
      progress=showProgress("Retrieving wallet rank... Please wait.");
      await rank(text);
      progress.remove();
    }
    else{
      block(`<div class="red">Unknown command.</div><div class="muted">Type help.</div>`);
    }
  }catch(error){
    if(progress)progress.remove();

    if(error.warming){
      const retryCommand=(lower==="activity12")?"traders12":lower;
      cacheWarmingMessage(retryCommand,error.hours);
      return;
    }

    block(`<div class="red">${esc(error.message)}</div>`);
  }
}
const MARKET_REFRESH_MS=30_000;
let hasMarketData=false;

function formatMarketTime(date){
  return date.toLocaleTimeString([], {
    hour:"2-digit",
    minute:"2-digit",
    second:"2-digit"
  });
}

function setMarketStatus(text,state=""){
  for(const element of[
    marketPriceStatus,
    marketCapStatus,
    marketHoldersStatus,
    marketVolumeStatus,
    marketUpdatedStatus
  ]){
    element.textContent=`[ ${text} ]`;
    element.classList.toggle("error",state==="error");
  }
}

async function refreshMarketPanel(){
  setMarketStatus(hasMarketData?"REFRESHING":"CONNECTING");

  try{
    const d=await getJson("/api/market");
    marketPrice.textContent=`$${d.priceUsd} USD / ${d.priceEth} ETH`;
    marketCap.textContent=d.marketCapDisplay||"UNAVAILABLE";
    marketHolders.textContent=d.holdersDisplay||"UNAVAILABLE";
    marketVolume.textContent=d.volume24hDisplay||"UNAVAILABLE";
    marketUpdated.textContent=formatMarketTime(new Date());
    setMarketStatus("LIVE");
    hasMarketData=true;
  }catch{
    setMarketStatus("UNAVAILABLE","error");
    if(!hasMarketData){
      marketPrice.textContent="UNAVAILABLE";
      marketCap.textContent="UNAVAILABLE";
      marketHolders.textContent="UNAVAILABLE";
      marketVolume.textContent="UNAVAILABLE";
      marketUpdated.textContent="—";
    }
  }
}

async function start(){
  const lines=[
    `[ <span class="green">OK</span> ] Initializing Robinhood Chain, HOODRAT Whale Terminal`,
    `[ <span class="green">OK</span> ] Connecting to Robinhood Chain services`,
    `[ <span class="green">OK</span> ] Loading current holder rankings`,
    `[ <span class="green">OK</span> ] Whale database synchronized`
  ];
  for(const html of lines){
    const line=document.createElement("div");
    line.className="line boot-line";line.innerHTML=html;boot.append(line);
    requestAnimationFrame(()=>line.classList.add("visible"));await sleep(180);
  }
  const spacer=document.createElement("div");spacer.className="line";spacer.innerHTML="&nbsp;";boot.append(spacer);
  const ready=document.createElement("div");ready.className="line";
  ready.innerHTML=`[ <span class="green">READY</span> ] Type help for available commands.`;
  boot.append(ready);promptRow.classList.add("visible");input.focus();
}
input.addEventListener("keydown",async(event)=>{
  if(event.key!=="Enter")return;
  event.preventDefault();
  const command=input.value;input.value="";input.disabled=true;
  await execute(command);input.disabled=false;input.focus();
});

history.addEventListener("click",async(event)=>{
  const button=event.target.closest(".copy-wallet");
  if(!button)return;

  const address=button.dataset.wallet;
  if(address)await copyWallet(address);
});


function verifyFrontendIntegrity(){
  const checks=[
    ["esc",typeof esc],
    ["walletWithCopy",typeof walletWithCopy],
    ["getJson",typeof getJson],
    ["block",typeof block],
    ["formatAge",typeof formatAge],
    ["timeAgo",typeof timeAgo],
    ["compactTimeAgo",typeof compactTimeAgo],
    ["holderRank",typeof holderRank],
    ["activityDashboard",typeof activityDashboard],
    ["traders12",typeof traders12],
    ["recentTransactions",typeof recentTransactions],
    ["execute",typeof execute],
    ["revealCommandPanel",typeof revealCommandPanel],
    ["placeCommandInPrompt",typeof placeCommandInPrompt]
  ];

  const missing=checks
    .filter(([,type])=>type!=="function")
    .map(([name])=>name);

  if(missing.length){
    throw new Error(
      `Frontend integrity check failed: ${missing.join(", ")}`
    );
  }
}

verifyFrontendIntegrity();
refreshMarketPanel();
setInterval(refreshMarketPanel,MARKET_REFRESH_MS);
start();

const appLayout=document.getElementById("appLayout");
const commandPanel=document.getElementById("commandPanel");
commandPanel.hidden = true;
  document.body.classList.remove("command-panel-open");

function revealCommandPanel(){
  if(!appLayout||!commandPanel||commandPanel.classList.contains("visible")){
    return;
  }

  appLayout.closest(".shell")?.classList.add("panel-open");
  appLayout.classList.add("commands-visible");
  commandPanel.hidden = false;
  document.body.classList.add("command-panel-open");
  commandPanel.classList.add("visible");
  commandPanel.setAttribute("aria-hidden","false");
}

function activePromptInput(){
  return input || document.getElementById("commandInput");
}


function commandRoot(command){
  return String(command||"")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
}

function highlightActiveCommand(command){
  const root=commandRoot(command);

  commandPanel?.querySelectorAll("button[data-command]").forEach((button)=>{
    const buttonRoot=commandRoot(button.dataset.command||"");
    button.classList.toggle("active",buttonRoot===root);
  });
}

function placeCommandInPrompt(command){
  const promptInput=activePromptInput();

  if(!promptInput)return;

  promptRow.classList.add("visible");
  promptInput.disabled=false;
  promptInput.value=String(command||"");
  promptInput.focus();

  const end=promptInput.value.length;
  promptInput.setSelectionRange?.(end,end);

  promptInput.dispatchEvent(
    new Event("input",{bubbles:true})
  );
}

commandPanel?.addEventListener("click",(event)=>{
  const button=event.target.closest("button[data-command]");

  if(!button)return;

  event.preventDefault();
  event.stopPropagation();
  const command=button.dataset.command||"";
  placeCommandInPrompt(command);
  highlightActiveCommand(command);
});


