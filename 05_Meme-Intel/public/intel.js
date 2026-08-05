"use strict";

const input = document.getElementById("commandInput");
const history = document.getElementById("history");
const boot = document.getElementById("boot");
const commandPanel = document.getElementById("commandPanel");
const PROMPT = "hoodrat@intel:~$";
let commandHistory = [];
let historyIndex = 0;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const short = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
const num = (v) => Number(String(v ?? 0).replace(/[^0-9.-]/g, "")) || 0;
const fmt = (v, digits = 2) => Number(v || 0).toLocaleString("en-US", {maximumFractionDigits: digits});
const signed = (v) => `${Number(v) >= 0 ? "+" : ""}${fmt(v)}`;

function print(html, cls = "") {
  const line = document.createElement("div");
  line.className = cls;
  line.innerHTML = html;
  history.appendChild(line);
  history.scrollTop = history.scrollHeight;
}
function block(title, rows, note = "") {
  print(`<div class="intel-block"><div class="intel-title">[ ${esc(title)} ]</div>${rows.map(([k,v,c=""]) => `<div class="intel-row"><span>${esc(k)}</span><strong class="${esc(c)}">${v}</strong></div>`).join("")}${note ? `<div class="intel-note">${esc(note)}</div>` : ""}</div>`);
}
function echo(cmd) { print(`<span class="prompt-echo">${PROMPT}</span> ${esc(cmd)}`, "command-echo"); }
async function api(url) {
  const response = await fetch(url, {headers:{Accept:"application/json"}});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const e = new Error(data.error || `HTTP ${response.status}`); e.warming = data.warming; throw e; }
  return data;
}
async function activity(hours = 12) { return api(`/api/activity?hours=${hours}`); }
function warming(error) { print(error.warming ? "[ CACHE ] Intelligence data is warming up. Run the command again shortly." : `[ ERROR ] ${esc(error.message)}`, error.warming ? "status-warning" : "status-error"); }

async function marketHeader() {
  try {
    const m = await api("/api/market");
    const set = (id, value) => document.getElementById(id).textContent = value;
    set("marketPrice", m.priceUsd ? `$${m.priceUsd}` : "UNAVAILABLE");
    set("marketCap", m.marketCapDisplay || "UNAVAILABLE");
    set("marketHolders", m.holdersDisplay || "UNAVAILABLE");
    set("marketVolume", m.volume24hDisplay || "UNAVAILABLE");
    set("marketUpdated", new Date().toLocaleTimeString());
    ["marketPriceStatus","marketCapStatus","marketHoldersStatus","marketVolumeStatus","marketUpdatedStatus"].forEach(id => set(id,"[ LIVE ]"));
  } catch {
    ["marketPriceStatus","marketCapStatus","marketHoldersStatus","marketVolumeStatus","marketUpdatedStatus"].forEach(id => document.getElementById(id).textContent="[ OFFLINE ]");
  }
}

async function cmdScan() {
  try {
    const [m, s, a] = await Promise.all([api("/api/market"), api("/api/stats"), activity(12)]);
    const buys = a.topBuyers?.reduce((x,r)=>x+num(r.bought),0) || 0;
    const sells = a.topSellers?.reduce((x,r)=>x+num(r.sold),0) || 0;
    const ratio = sells > 0 ? buys / sells : buys > 0 ? 99 : 0;
    const top = s.stats || {};
    block("MEME INTELLIGENCE SCAN", [
      ["Price", m.priceUsd ? `$${esc(m.priceUsd)}` : "UNAVAILABLE"],
      ["24h change", `${signed(m.priceChange24h)}%`, m.priceChange24h >= 0 ? "positive" : "negative"],
      ["Liquidity", esc(m.liquidityDisplay || "UNAVAILABLE")],
      ["24h volume", esc(m.volume24hDisplay || "UNAVAILABLE")],
      ["Holders", esc(m.holdersDisplay || "UNAVAILABLE")],
      ["12h pressure ratio", ratio ? `${fmt(ratio)}× buy/sell` : "NO FLOW"],
      ["Top-30 net flow", esc(a.top30Summary?.netFlow || "0"), num(a.top30Summary?.netFlow) >= 0 ? "positive" : "negative"],
      ["Active Top-30", `${(a.top30Summary?.accumulating||0)+(a.top30Summary?.distributing||0)} wallets`],
      ["Top-10 concentration", top.top10Percentage != null ? `${fmt(top.top10Percentage)}%` : "UNAVAILABLE"]
    ], "A compact cross-signal view. Use individual commands for evidence and limitations.");
  } catch (e) { warming(e); }
}

async function cmdPressure() {
  try {
    const a = await activity(12);
    const buys = a.topBuyers || [], sells = a.topSellers || [];
    const buyVol = buys.reduce((x,r)=>x+num(r.bought),0), sellVol = sells.reduce((x,r)=>x+num(r.sold),0);
    const ratio = sellVol ? buyVol/sellVol : buyVol ? 99 : 0;
    const state = ratio >= 1.35 ? "BUY DOMINANT" : ratio <= .74 ? "SELL DOMINANT" : "BALANCED";
    block("BUY / SELL PRESSURE — 12H", [
      ["Observed buyers", String(buys.length)], ["Observed sellers", String(sells.length)],
      ["Buyer volume", fmt(buyVol)], ["Seller volume", fmt(sellVol)],
      ["Pressure ratio", ratio ? `${fmt(ratio)}×` : "NO FLOW"],
      ["State", state, state === "BUY DOMINANT" ? "positive" : state === "SELL DOMINANT" ? "negative" : ""]
    ], "Computed from classified DEX transfers available in the current activity window; not full exchange-wide order flow.");
  } catch (e) { warming(e); }
}

async function cmdFresh() {
  try {
    const a = await activity(24);
    const rows = (a.topBuyers || []).filter(r => r.holderRank == null || r.classification === "unranked_holder").slice(0,10);
    block("NEWLY OBSERVED BUYER FLOW — 24H", [
      ["Unranked buyer wallets", String(rows.length)],
      ["Observed inflow", fmt(rows.reduce((x,r)=>x+num(r.bought),0))],
      ...rows.slice(0,6).map((r,i)=>[`#${i+1} ${short(r.wallet)}`, `${fmt(num(r.bought))} HOODRAT`])
    ], "Fresh means newly observed/unranked in this dataset. It does not prove the wallet itself was newly created.");
  } catch (e) { warming(e); }
}

async function cmdHolders() {
  try {
    const [s,a] = await Promise.all([api("/api/stats"), activity(24)]);
    const st=s.stats||{};
    block("HOLDER DISTRIBUTION", [
      ["Tracked holders", esc(s.metadata?.holdersCount ?? s.metadata?.totalHolders ?? "UNAVAILABLE")],
      ["Top-10 concentration", st.top10Percentage != null ? `${fmt(st.top10Percentage)}%` : "UNAVAILABLE"],
      ["Top-30 concentration", st.top30Percentage != null ? `${fmt(st.top30Percentage)}%` : "UNAVAILABLE"],
      ["New Top-30 entrants", String(a.newWhales?.length || 0)],
      ["Rank movers", String(a.holderChanges?.length || 0)],
      ["Accumulating Top-30", String(a.top30Summary?.accumulating || 0)],
      ["Distributing Top-30", String(a.top30Summary?.distributing || 0)]
    ], "Infrastructure, burn and liquidity addresses are excluded where identified.");
  } catch(e){ warming(e); }
}

async function cmdRisk() {
  try {
    const [m,s,a]=await Promise.all([api("/api/market"),api("/api/stats"),activity(24)]);
    const st=s.stats||{}; const conc=num(st.top10Percentage); const sellers=a.top30Summary?.distributing||0;
    const liq=num(m.liquidityDisplay); const cap=num(m.marketCapDisplay); const liqRatio=cap?liq/cap*100:0;
    let score=0; if(conc>35)score+=2; else if(conc>20)score++; if(liqRatio&&liqRatio<5)score+=2; else if(liqRatio&&liqRatio<10)score++; if(sellers>=6)score+=2; else if(sellers>=3)score++;
    const level=score>=5?"ELEVATED":score>=3?"MODERATE":"LOWER";
    block("TRANSPARENT RISK CHECK", [
      ["Top-10 concentration", conc?`${fmt(conc)}%`:"UNAVAILABLE", conc>35?"negative":""],
      ["Liquidity / market cap", liqRatio?`${fmt(liqRatio)}%`:"UNAVAILABLE", liqRatio&&liqRatio<5?"negative":""],
      ["Top-30 distributors (24h)", String(sellers), sellers>=6?"negative":""],
      ["Transfer coverage", a.truncated?"PARTIAL / TRUNCATED":"CURRENT WINDOW"],
      ["Composite level", level, level==="ELEVATED"?"negative":level==="LOWER"?"positive":""]
    ], "This is not a scam detector. The level is a simple rule-based summary of visible metrics.");
  } catch(e){ warming(e); }
}

async function cmdPulse() {
  try {
    const [m,a]=await Promise.all([api("/api/market"),activity(12)]);
    const buy=a.topBuyers?.reduce((x,r)=>x+num(r.bought),0)||0, sell=a.topSellers?.reduce((x,r)=>x+num(r.sold),0)||0;
    const ratio=sell?buy/sell:buy?99:0; const net=num(a.top30Summary?.netFlow);
    const state=(ratio>=1.2&&net>0)?"ACCUMULATION":(ratio<=.8&&net<0)?"DISTRIBUTION":"MIXED / NEUTRAL";
    block("MARKET PULSE", [
      ["Market state", state, state==="ACCUMULATION"?"positive":state==="DISTRIBUTION"?"negative":""],
      ["Buy pressure", ratio>=1.35?"STRONG":ratio>=1.05?"POSITIVE":ratio<=.74?"WEAK":"BALANCED"],
      ["Whale net flow", net>0?"POSITIVE":net<0?"NEGATIVE":"FLAT", net>0?"positive":net<0?"negative":""],
      ["24h price trend", num(m.priceChange24h)>0?"UP":num(m.priceChange24h)<0?"DOWN":"FLAT", num(m.priceChange24h)>0?"positive":"negative"],
      ["Confidence", a.truncated?"LIMITED":"NORMAL"]
    ], "Interpretation is deterministic and based only on currently available on-chain and market inputs.");
  } catch(e){ warming(e); }
}

async function cmdLive() {
  try {
    const a=await activity(24); const tx=(a.recentWhaleTransactions||[]).slice(0,12);
    if(!tx.length){ print("[ LIVE ] No notable classified activity in the current cache."); return; }
    print(`<div class="intel-block"><div class="intel-title">[ NOTABLE ACTIVITY ]</div>${tx.map(t=>`<div class="intel-event"><span>${new Date(t.timestamp||t.blockTimestamp||Date.now()).toLocaleTimeString()}</span> <b class="${t.type==='BUY'?'positive':'negative'}">${esc(t.type||'TRANSFER')}</b> ${esc(short(t.wallet||t.from||t.to))} <strong>${esc(t.value||t.amount||'')}</strong></div>`).join("")}<div class="intel-note">For detailed whale rankings and profiles, use the dedicated Whale Activity Tracker.</div></div>`);
  } catch(e){ warming(e); }
}

function cmdMethodology(){ block("METHODOLOGY", [["scan","Market + holder + pressure summary"],["pressure","Classified DEX buy/sell transfers"],["fresh","Unranked/newly observed buyers; not wallet age"],["holders","Current distribution plus snapshot movement"],["risk","Rule-based concentration/liquidity/distribution flags"],["pulse","Deterministic synthesis; no AI prediction"]], "Data can be delayed, cached, incomplete or rate-limited. Never treat a terminal label as a recommendation."); }
function cmdHelp(){ block("COMMAND GUIDE", [["scan","Complete intelligence snapshot"],["pulse","Compact market-state interpretation"],["pressure","12h buy/sell pressure"],["fresh","24h newly observed buyer flow"],["holders","Distribution and holder movement"],["risk","Transparent risk metrics"],["live","Recent notable activity"],["methodology","Rules, definitions and limitations"],["clear","Clear output"]]); }

async function run(raw){ const cmd=raw.trim().toLowerCase(); if(!cmd)return; echo(raw); commandHistory.push(raw); historyIndex=commandHistory.length; input.disabled=true; try{ if(cmd==="help")cmdHelp(); else if(cmd==="scan")await cmdScan(); else if(cmd==="pressure")await cmdPressure(); else if(cmd==="fresh")await cmdFresh(); else if(cmd==="holders")await cmdHolders(); else if(cmd==="risk")await cmdRisk(); else if(cmd==="pulse")await cmdPulse(); else if(cmd==="live")await cmdLive(); else if(cmd==="methodology")cmdMethodology(); else if(cmd==="clear")history.innerHTML=""; else print(`[ UNKNOWN COMMAND ] ${esc(raw)} — type help`,"status-error"); } finally { input.disabled=false; input.value=""; input.focus(); } }

input.addEventListener("keydown",e=>{ if(e.key==="Enter"){run(input.value);} else if(e.key==="ArrowUp"){e.preventDefault(); if(historyIndex>0)input.value=commandHistory[--historyIndex]||"";} else if(e.key==="ArrowDown"){e.preventDefault(); if(historyIndex<commandHistory.length-1)input.value=commandHistory[++historyIndex]||""; else {historyIndex=commandHistory.length; input.value="";}}});
document.querySelectorAll("[data-command]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.command;input.focus();}));

boot.innerHTML=`<div class="boot-line">[ SYSTEM ] HOODRAT Meme Intelligence Terminal ver 1.0</div><div class="boot-line">[ READY ] Type <strong>help</strong> to inspect available intelligence commands.</div>`;
marketHeader(); setInterval(marketHeader,60000); input.focus();
