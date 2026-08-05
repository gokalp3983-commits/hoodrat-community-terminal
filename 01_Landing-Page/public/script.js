const MODULES = {
  eligibility: {
    title: "NFT Eligibility Checker",
    url: "https://nft-eligibility-checker-archive.onrender.com/",
  },
  whales: {
    title: "Whale Activity Tracker",
    url: "https://whale-activity-tracker-xnj8.onrender.com/",
  },
  intel: {
    title: "Meme Intelligence Terminal",
    url: "https://zero5-meme-intel.onrender.com/",
  },
  nft: {
    title: "HOODRATS NFT Collection Terminal",
    url: "https://nft-mint-tracker-z76h.onrender.com/",
  },
};

const boot = document.getElementById("boot");
const output = document.getElementById("output");
const promptRow = document.getElementById("promptRow");
const input = document.getElementById("commandInput");

const marketPriceStatus = document.getElementById("marketPriceStatus");
const marketCapStatus = document.getElementById("marketCapStatus");
const marketHoldersStatus = document.getElementById("marketHoldersStatus");
const marketVolumeStatus = document.getElementById("marketVolumeStatus");
const marketUpdatedStatus = document.getElementById("marketUpdatedStatus");
const marketPrice = document.getElementById("marketPrice");
const marketCap = document.getElementById("marketCap");
const marketHolders = document.getElementById("marketHolders");
const marketVolume = document.getElementById("marketVolume");
const marketUpdated = document.getElementById("marketUpdated");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function write(target, html){
  const line = document.createElement("div");
  line.className = "line";
  line.innerHTML = html;
  target.appendChild(line);
  line.scrollIntoView({block:"nearest"});
}


async function getLiveMarket(){
  const response = await fetch("/api/price", {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.available) {
    throw new Error(
      data.error || "Live market data unavailable."
    );
  }

  return data;
}

const MARKET_REFRESH_MS = 30_000;
let hasMarketData = false;

function formatWidgetTime(date){
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setMarketStatus(text, state = ""){
  for(const element of [
    marketPriceStatus,
    marketCapStatus,
    marketHoldersStatus,
    marketVolumeStatus,
    marketUpdatedStatus,
  ]){
    element.textContent = `[ ${text} ]`;
    element.classList.toggle("error", state === "error");
  }
}

async function refreshMarketWidget(){
  setMarketStatus(hasMarketData ? "REFRESHING" : "CONNECTING");

  try{
    const market = await getLiveMarket();

    marketPrice.textContent =
      `$${market.priceUsd} USD / ${market.priceEth} ETH`;

    marketCap.textContent =
      market.marketCapDisplay || "UNAVAILABLE";

    marketHolders.textContent =
      market.holdersDisplay || "UNAVAILABLE";

    marketVolume.textContent =
      market.volume24hDisplay || "UNAVAILABLE";

    marketUpdated.textContent =
      formatWidgetTime(new Date());

    setMarketStatus("LIVE");
    hasMarketData = true;
  }catch(error){
    setMarketStatus("UNAVAILABLE", "error");

    if(!hasMarketData){
      marketPrice.textContent = "UNAVAILABLE";
      marketCap.textContent = "UNAVAILABLE";
      marketHolders.textContent = "UNAVAILABLE";
      marketVolume.textContent = "UNAVAILABLE";
      marketUpdated.textContent = "—";
    }
  }
}

async function bootSequence(){
  const sequence = [
    ["Initializing Robinhood Chain, HOODRAT Community Terminal v1 v1 Terminal...", 250],
    ["Loading Robinhood Chain...", 300],
    ["Loading project registry...", 280],
    ["Loading available project modules...", 320],
    ["", 120],
    ['[ <span class="green">READY</span> ] Whale Activity Tracker', 260],
    ['[ <span class="green">READY</span> ] Meme Intelligence Terminal', 250],
    ['[ <span class="green">COMPLETE</span> ] HOODRATS NFT Collection Terminal', 240],
    ['[ <span class="yellow">ARCHIVE</span> ] NFT Eligibility Checker Archive', 240],
    ["", 120],
    [
      '[ <span class="green">READY</span> ] ' +
      'Type <span class="red">help</span> for available modules.',
      0
    ],
  ];

  for(const [line,delay] of sequence){
    await sleep(delay);
    write(boot,line || "&nbsp;");
  }

  promptRow.hidden = false;
  input.focus();
}

function echoCommand(command){
  write(
    output,
    `<span class="green">hoodrat@projects:~$</span> ${escapeHtml(command)}`
  );
}

function showHelp(){
  const WIDTH = 14;
  const line = (cmd, desc) => {
    const padded = cmd.padEnd(WIDTH, " ");
    write(output, `<span class="cyan">${padded}</span>${desc}`);
  };

  write(output,'<span class="yellow">Available modules</span>');
  line("whales","Whale Activity Tracker");
  line("intel","Meme Intelligence Terminal");
  line("nft","HOODRATS NFT Collection Terminal");
  line("eligibility","NFT Eligibility Checker Archive");
  line("about","About HOODRAT Community Terminal");
  line("clear","Clear terminal output");
}

function showAbout(){
  write(output,'<span class="yellow">HOODRAT Community Terminal</span>');
  write(output,'Independent terminal-style tools created for the HOODRAT community.');
}

function showMintPreview(){
  write(output,'<span class="yellow">HOODRATS NFT Collection Terminal</span>');
  write(output,'Status: <span class="yellow">LIVE</span>');
  write(output,'&nbsp;');
  write(output,'Planned module features:');
  write(output,'• Live mint progress');
  write(output,'• NFT holder analytics');
  write(output,'• Mint statistics');
  write(output,'• Mint-related market activity');
  write(output,'&nbsp;');
  write(output,'<span class="muted"></span>');
}

async function launchModule(key){
  const module = MODULES[key];
  if(!module)return;

  write(output,`Loading module: <span class="yellow">${module.title}</span>...`);
  await sleep(350);
  write(output,'Establishing secure connection...');
  await sleep(350);
  write(output,'<span class="green">Launching module in new tab...</span>');
  await sleep(300);
  window.open(module.url, "_blank", "noopener");
}

async function execute(raw){
  const command = raw.trim();
  const lower = command.toLowerCase();

  if(!command)return;
  echoCommand(command);

  if(lower === "help"){
    showHelp();
  }else if(
    lower === "eligibility" ||
    lower === "holders" ||
    lower === "checker"
  ){
    await launchModule("eligibility");
  }else if(lower === "whales"){
    await launchModule("whales");
  }else if(lower === "intel" || lower === "intelligence"){
    await launchModule("intel");
  }else if(lower === "nft" || lower === "mint"){
    await launchModule("nft");
  }else if(lower === "about"){
    showAbout();
  }else if(lower === "clear"){
    output.innerHTML = "";
  }else if(lower === "sudo whales"){
    write(output,'<span class="red">Permission denied.</span>');
    await sleep(350);
    write(output,'<span class="muted">...just kidding.</span>');
    await launchModule("whales");
  }else{
    write(
      output,
      `<span class="red">Command not found:</span> ${escapeHtml(command)}`
    );
    write(
      output,
      'Type <span class="cyan">help</span> to list available modules.'
    );
  }
}

document.querySelectorAll("[data-module]").forEach((button)=>{
  button.addEventListener("click",()=>{
    const command = button.dataset.module || "";
    input.value = command;
    input.focus();
    input.setSelectionRange(command.length,command.length);
  });
});

document.getElementById("terminalForm").addEventListener("submit",async(event)=>{
  event.preventDefault();
  const command = input.value;
  input.value = "";
  input.disabled = true;

  try{
    await execute(command);
  }finally{
    input.disabled = false;
    input.focus();
  }
});

refreshMarketWidget();
setInterval(refreshMarketWidget, MARKET_REFRESH_MS);
bootSequence();
