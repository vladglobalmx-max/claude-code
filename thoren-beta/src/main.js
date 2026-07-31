import "./style.css";
import { markJourneyCompleted, markProposalRendered, markProposalSelected, runJourney } from "./engine.js";
import { atLeast, getTelemetry } from "./telemetry.js";

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

  function show(id) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    document.getElementById(id).classList.add("active");
  }

  /**
   * Fase 3 (Experience Integration): el mismo ritmo aprobado del
   * Experience Blueprint (900ms de "pulso" antes de revelar propuestas) es
   * ahora un PISO, no una duración fija — `atLeast` corre el Motor
   * Creativo real en paralelo y solo avanza cuando ambos terminan: nunca
   * se acelera la narrativa, y nunca se agrega una espera artificial si el
   * motor necesita más tiempo del mínimo.
   */
  var THINKING_MIN_MS = 900;

  function start() {
    var text = entry.value.trim();
    if (text.length < 3) return;

    said.textContent = '"' + text + '"';
    said.classList.add("show");

    show("screen-thinking");

    atLeast(runJourney(text), THINKING_MIN_MS)
      .then(function (proposals) {
        populateProposals(proposals);
      })
      .catch(function (err) {
        // Sin pantalla nueva de error en esta fase (fuera de alcance) —
        // se registra y se regresa al inicio en vez de dejar la
        // experiencia colgada en "pensando" indefinidamente.
        console.error("THÖREN: el Motor Creativo no pudo generar propuestas.", err);
        resetExperience();
      });
  }

  var currentProposals = [];
  var chosenProposal = null;

  function populateProposals(proposals) {
    currentProposals = proposals;
    show("screen-proposals");
    renderBetaTelemetry();

    var cards = document.querySelectorAll("#cardsRow .card");
    cards.forEach(function (card, i) {
      card.classList.remove("arrived", "selected", "dimmed");
      var proposal = proposals[i];
      card.querySelector(".seal").innerHTML = proposal.svg;
      setTimeout(function () {
        card.classList.add("arrived");
        markProposalRendered(proposal.archetypeId);
        if (i === cards.length - 1) renderBetaTelemetry();
      }, 250 + i * 380);
    });

    var chooseBtn = document.getElementById("chooseBtn");
    chooseBtn.classList.remove("ready");
    chosenProposal = null;

    cards.forEach(function (card, i) {
      card.onclick = function () {
        chosenProposal = proposals[i];
        markProposalSelected(chosenProposal.archetypeId);
        renderBetaTelemetry();
        cards.forEach(function (c) {
          c.classList.toggle("selected", c === card);
          c.classList.toggle("dimmed", c !== card);
        });
        chooseBtn.classList.add("ready");
      };
    });

    chooseBtn.onclick = function () {
      if (!chosenProposal) return;
      revealChosen(chosenProposal);
    };
  }

  function revealChosen(proposal) {
    show("screen-reveal");
    var caption = document.getElementById("revealCaption");
    var seal = document.getElementById("revealSeal");
    var obtain = document.getElementById("obtainBtn");
    caption.textContent = "Tu propuesta";
    caption.classList.remove("show");
    seal.classList.remove("show");
    obtain.classList.remove("ready");

    seal.innerHTML = proposal.svg;

    setTimeout(function () { caption.classList.add("show"); }, 200);
    setTimeout(function () { seal.classList.add("show"); }, 500);
    setTimeout(function () { obtain.classList.add("ready"); }, 1500);

    obtain.onclick = function () { obtainDesign(proposal); };
  }

  function obtainDesign(proposal) {
    var blob = new Blob([proposal.svg], { type: "image/svg+xml" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "thoren-" + proposal.archetypeId + ".svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    markJourneyCompleted();
    renderBetaTelemetry();

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
    currentProposals = [];
    chosenProposal = null;
    show("screen-start");
    entry.focus();
  }

  // ---------------------------------------------------------------------
  // Modo beta (?beta=true) — panel discreto de versión/fecha/tiempo, la
  // instrumentación silenciosa (eventos + tiempos, ver telemetry.js) y el
  // botón "Beta Reset". Ninguno existe en la experiencia normal: el
  // enlace que se comparte con un participante externo nunca lleva este
  // parámetro, así que nunca los ve.
  // ---------------------------------------------------------------------
  var betaMode = new URLSearchParams(location.search).get("beta") === "true";

  function renderBetaTelemetry() {
    if (!betaMode) return;
    var telemetry = getTelemetry();
    var lines = [];
    lines.push("tiempos:");
    Object.keys(telemetry.timings).forEach(function (key) {
      lines.push("  " + key + ": " + telemetry.timings[key] + "ms");
    });
    lines.push("eventos:");
    telemetry.events.forEach(function (event) {
      lines.push("  +" + event.at + "ms  " + event.name);
    });
    document.getElementById("betaTelemetry").textContent = lines.join("\n");
  }

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
      renderBetaTelemetry();
    });
  }
})();
