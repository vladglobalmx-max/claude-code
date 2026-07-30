import "./style.css";

(function () {
  var entry = document.getElementById("entryField");
  var goBtn = document.getElementById("goBtn");
  var said = document.getElementById("saidLine");

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      entry.value = chip.getAttribute("data-fill");
      entry.focus();
      entry.setSelectionRange(entry.value.length, entry.value.length);
      sync();
    });
  });

  function sync() {
    goBtn.classList.toggle("ready", entry.value.trim().length > 2);
  }
  entry.addEventListener("input", sync);
  entry.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && entry.value.trim().length > 2) start();
  });
  goBtn.addEventListener("click", start);

  function extractIdentity(text) {
    var raw = text;
    var deMatch = text.match(/\bde\s+(.+)$/i);
    var commaMatch = text.match(/,\s*(.+)$/);
    if (deMatch) raw = deMatch[1];
    else if (commaMatch) raw = commaMatch[1];
    raw = raw.replace(/[.;].*$/, "").trim();
    return raw || "Ti";
  }
  function initials(name) {
    var entities = name.split(/\s*(?:&|,|\by\b)\s*/i).filter(Boolean);
    var words;
    if (entities.length > 1) {
      words = entities.slice(0, 2);
    } else {
      words = entities[0].split(/\s+/).filter(Boolean).slice(0, 2);
    }
    var letters = words.map(function (w) { return w.trim().charAt(0).toUpperCase(); }).filter(Boolean);
    return letters.join(entities.length > 1 ? "&" : "") || "T";
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    document.getElementById(id).classList.add("active");
  }

  function start() {
    var text = entry.value.trim();
    if (text.length < 3) return;
    var name = extractIdentity(text);
    var init = initials(name);

    said.textContent = '"' + text + '"';
    said.classList.add("show");

    show("screen-thinking");

    setTimeout(function () { populateProposals(name, init); }, 900);
  }

  var chosenStyle = null;

  function populateProposals(name, init) {
    document.querySelectorAll("#cardsRow .seal span").forEach(function (span) {
      span.textContent = init;
    });
    show("screen-proposals");
    var cards = document.querySelectorAll(".card");
    cards.forEach(function (card, i) {
      card.classList.remove("arrived", "selected", "dimmed");
      setTimeout(function () { card.classList.add("arrived"); }, 250 + i * 380);
    });

    var chooseBtn = document.getElementById("chooseBtn");
    chooseBtn.classList.remove("ready");
    chosenStyle = null;

    cards.forEach(function (card) {
      card.onclick = function () {
        chosenStyle = card.getAttribute("data-style");
        cards.forEach(function (c) {
          c.classList.toggle("selected", c === card);
          c.classList.toggle("dimmed", c !== card);
        });
        chooseBtn.classList.add("ready");
      };
    });

    chooseBtn.onclick = function () {
      if (!chosenStyle) return;
      revealChosen(name, init, chosenStyle);
    };
  }

  var sealPalettes = {
    "1": { bg: "radial-gradient(circle at 40% 35%, #fbeedb, #ecd3ab 78%)", ink: "#7d3520", download: "#f3ead9" },
    "2": { bg: "linear-gradient(160deg, #f3ead9, #dcc79f)", ink: "#6b4a2a", download: "#f3ead9" },
    "3": { bg: "#1c1917", ink: "#f2ede4", download: "#1c1917" },
  };

  function revealChosen(name, init, style) {
    show("screen-reveal");
    var caption = document.getElementById("revealCaption");
    var seal = document.getElementById("revealSeal");
    var obtain = document.getElementById("obtainBtn");
    caption.textContent = name;
    caption.classList.remove("show");
    seal.classList.remove("show");
    obtain.classList.remove("ready");

    var palette = sealPalettes[style] || sealPalettes["1"];
    seal.style.background = palette.bg;
    seal.querySelector("span").style.color = palette.ink;
    seal.querySelector("span").textContent = init;

    setTimeout(function () { caption.classList.add("show"); }, 200);
    setTimeout(function () { seal.classList.add("show"); }, 500);
    setTimeout(function () { obtain.classList.add("ready"); }, 1500);

    obtain.onclick = function () { obtainDesign(name, init, palette); };
  }

  function obtainDesign(name, init, palette) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">' +
      '<rect width="600" height="600" fill="#faf6ef"/>' +
      '<circle cx="300" cy="300" r="220" fill="' + palette.download + '" stroke="' + palette.ink + '" stroke-width="3"/>' +
      '<text x="300" y="318" font-family="Georgia, serif" font-size="72" font-weight="600" fill="' + palette.ink + '" text-anchor="middle">' + init + "</text>" +
      "</svg>";
    var blob = new Blob([svg], { type: "image/svg+xml" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "thoren-" + init.toLowerCase().replace("&", "-") + ".svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    said.classList.remove("show");
    show("screen-done");
    document.getElementById("doneLine").textContent = "Esto ya es tuyo.";
    document.getElementById("printAsk").classList.remove("show");
    document.getElementById("closingLine").classList.remove("show");

    setTimeout(function () {
      document.getElementById("printAsk").classList.add("show");
    }, 1300);
  }

  document.querySelectorAll(".print-choices button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.getElementById("printAsk").classList.remove("show");
      var line = document.getElementById("doneLine");
      line.textContent = btn.getAttribute("data-ans") === "yes"
        ? "Perfecto. Ya quedó listo también para eso."
        : "Esto ya es tuyo.";
      setTimeout(function () {
        document.getElementById("closingLine").classList.add("show");
      }, 500);
    });
  });

  function resetExperience() {
    entry.value = "";
    sync();
    said.classList.remove("show");
    show("screen-start");
    entry.focus();
  }

  // ---------------------------------------------------------------------
  // Modo beta (?beta=true) — panel discreto de versión/fecha/tiempo y el
  // botón "Beta Reset". Ninguno de los dos existe en la experiencia normal:
  // el enlace que se comparte con un participante externo nunca lleva este
  // parámetro, así que nunca los ve.
  // ---------------------------------------------------------------------
  var betaMode = new URLSearchParams(location.search).get("beta") === "true";
  if (betaMode) {
    var panel = document.getElementById("betaPanel");
    var resetBtn = document.getElementById("betaReset");
    panel.hidden = false;
    panel.removeAttribute("aria-hidden");
    resetBtn.hidden = false;

    document.getElementById("betaVersion").textContent = "v" + __APP_VERSION__;
    var buildDate = new Date(__BUILD_DATE__);
    document.getElementById("betaBuildDate").textContent = buildDate.toLocaleDateString("es-MX", {
      year: "numeric", month: "short", day: "numeric",
    });

    var elapsedEl = document.getElementById("betaElapsed");
    var startedAt = Date.now();
    function tick() {
      var s = Math.floor((Date.now() - startedAt) / 1000);
      var mm = Math.floor(s / 60);
      var ss = String(s % 60).padStart(2, "0");
      elapsedEl.textContent = mm + ":" + ss;
    }
    tick();
    setInterval(tick, 1000);

    resetBtn.addEventListener("click", function () {
      resetExperience();
      startedAt = Date.now();
      tick();
    });
  }
})();
