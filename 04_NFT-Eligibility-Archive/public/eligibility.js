

    const output = document.getElementById("archiveOutput");
    const form = document.getElementById("archiveForm");
    const input = document.getElementById("archiveInput");

    const NFT_TERMINAL_URL =
      "https://nft-mint-tracker-z76h.onrender.com/";

    const marketPriceStatus =
      document.getElementById("marketPriceStatus");
    const marketCapStatus =
      document.getElementById("marketCapStatus");
    const marketHoldersStatus =
      document.getElementById("marketHoldersStatus");
    const marketVolumeStatus =
      document.getElementById("marketVolumeStatus");
    const marketUpdatedStatus =
      document.getElementById("marketUpdatedStatus");
    const marketPrice =
      document.getElementById("marketPrice");
    const marketCap =
      document.getElementById("marketCap");
    const marketHolders =
      document.getElementById("marketHolders");
    const marketVolume =
      document.getElementById("marketVolume");
    const marketUpdated =
      document.getElementById("marketUpdated");

    const sleep = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function write(html = "&nbsp;") {
      const div = document.createElement("div");
      div.className = "archive-line";
      div.innerHTML = html;
      output.appendChild(div);
      div.scrollIntoView({ block: "nearest" });
    }

    const MARKET_REFRESH_MS = 30_000;
    let hasMarketData = false;

    function formatWidgetTime(date) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

    function setMarketStatus(text, state = "") {
      for (const element of [
        marketPriceStatus,
        marketCapStatus,
        marketHoldersStatus,
        marketVolumeStatus,
        marketUpdatedStatus,
      ]) {
        element.textContent = `[ ${text} ]`;
        element.classList.toggle(
          "error",
          state === "error"
        );
      }
    }

    async function getLiveMarket() {
      const response = await fetch("/api/price", {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    }

    async function refreshMarketPanel() {
      setMarketStatus(
        hasMarketData ? "REFRESHING" : "CONNECTING"
      );

      try {
        const market = await getLiveMarket();

        marketPrice.textContent =
          `$${market.priceUsd} USD / ` +
          `${market.priceEth} ETH`;

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
      } catch (error) {
        setMarketStatus("UNAVAILABLE", "error");

        if (!hasMarketData) {
          marketPrice.textContent = "UNAVAILABLE";
          marketCap.textContent = "UNAVAILABLE";
          marketHolders.textContent = "UNAVAILABLE";
          marketVolume.textContent = "UNAVAILABLE";
          marketUpdated.textContent = "—";
        }
      }
    }

    async function bootArchive() {
      const lines = [
        [
          '[ <span class="ok">OK</span> ] Initializing HOODRAT Community Terminal',
          220
        ],
        [
          '[ <span class="ok">OK</span> ] Loading archived eligibility terminal',
          220
        ],
        [
          '[ <span class="ok">OK</span> ] Snapshot already taken',
          220
        ],
        [
          '[ <span class="ok">OK</span> ] Eligibility campaign completed',
          220
        ],
        [
          '[ <span class="ok">OK</span> ] Status: <span class="accent">ARCHIVE MODE</span>',
          260
        ],
        ["", 110],
        [
          '[ <span class="ready">READY</span> ] Type <span class="help">help</span> for available options.',
          0
        ]
      ];

      for (const [text, delay] of lines) {
        await sleep(delay);
        write(text || "&nbsp;");
      }

      input.focus();
    }

    function showHelp() {
      write('<span class="accent">Available commands</span>');

      const width = 10;
      const commandLine = (command, description) => {
        const padded = command.padEnd(width, " ");
        write(
          `<span class="archive-command-list"><span class="cyan">${padded}</span>${description}</span>`
        );
      };

      commandLine("help", "Show available commands");
      commandLine("about", "About this archive");
      commandLine("nft", "Open NFT Collection Terminal");
      commandLine("clear", "Clear terminal output");
    }

    function showAbout() {
      write('<span class="accent">NFT Eligibility Archive</span>');
      write(
        'Status: <span class="accent">ARCHIVE MODE</span>'
      );
      write("&nbsp;");
      write("Mission Status: COMPLETE");
      write("&nbsp;");
      write(
        "This terminal was created to help the HOODRAT community"
      );
      write(
        "verify NFT eligibility before the official mint."
      );
      write("&nbsp;");
      write(
        "It has been preserved as the first project"
      );
      write(
        "of the HOODRAT Projects ecosystem."
      );
    }

    function openNftTerminal() {
      write(
        '<span class="accent">NFT Collection Terminal</span>'
      );
      write(
        'Status: <span class="archive-green">COMPLETE</span>'
      );
      write("&nbsp;");
      write("Opening the NFT Collection Terminal in a new tab...");
      write(
        `<a class="archive-link" href="${NFT_TERMINAL_URL}" ` +
        'target="_blank" rel="noopener noreferrer">' +
        "Open NFT Collection Terminal</a>"
      );

      window.open(
        NFT_TERMINAL_URL,
        "_blank",
        "noopener,noreferrer"
      );
    }

    async function execute(raw) {
      const command = raw.trim();
      const lower = command.toLowerCase();

      if (!command) return;

      write(
        `<span class="prompt">hoodrat@robinhood:~$</span> ${escapeHtml(command)}`
      );

      if (lower === "help") {
        showHelp();
      } else if (lower === "about") {
        showAbout();
      } else if (lower === "nft" || lower === "mint") {
        openNftTerminal();
      } else if (lower === "clear") {
        output.innerHTML = "";
      } else {
        write(
          `<span class="red">Command not found:</span> ${escapeHtml(command)}`
        );
        write(
          'Type <span class="help">help</span> for available options.'
        );
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const command = input.value;
      input.value = "";
      input.disabled = true;

      try {
        await execute(command);
      } finally {
        input.disabled = false;
        input.focus();
      }
    });

    refreshMarketPanel();
    setInterval(refreshMarketPanel, MARKET_REFRESH_MS);
    bootArchive();
  
