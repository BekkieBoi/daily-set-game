/* ============================================================
   DAILY SET — OPTION C3
   Full interactive puzzle engine + Supabase integration
   ============================================================ */

/* ---------- CONFIG ---------- */
const supabaseUrl = "YOUR_URL";
const supabaseKey = "YOUR_PUBLIC_KEY";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

/* ---------- ELEMENTS ---------- */
const gameGrid = document.getElementById("gameGrid");
const timerEl = document.getElementById("timer");
const mistakesEl = document.getElementById("mistakes");
const confettiCanvas = document.getElementById("confettiCanvas");

let cards = [];
let selected = [];
let mistakes = 0;
let timer = 0;
let timerInterval = null;

/* ============================================================
   CARD GENERATION
   Each card has:
   • shape: circle / square / triangle
   • color: red / green / blue
   • fill: empty / stripe / solid
   • count: 1 / 2 / 3
   ============================================================ */

const shapes = ["circle", "square", "triangle"];
const colors = ["red", "green", "blue"];
const fills = ["empty", "stripe", "solid"];
const counts = [1, 2, 3];

function generateDeck() {
  const deck = [];
  for (let s of shapes) {
    for (let c of colors) {
      for (let f of fills) {
        for (let n of counts) {
          deck.push({ shape: s, color: c, fill: f, count: n });
        }
      }
    }
  }
  return deck;
}

/* ============================================================
   SET VALIDATION
   A valid set checks that each attribute is either:
   • all the same, or
   • all different
   ============================================================ */

function allSame(a, b, c) {
  return a === b && b === c;
}

function allDiff(a, b, c) {
  return a !== b && a !== c && b !== c;
}

function isSet(a, b, c) {
  return (
    (allSame(a.shape, b.shape, c.shape) || allDiff(a.shape, b.shape, c.shape)) &&
    (allSame(a.color, b.color, c.color) || allDiff(a.color, b.color, c.color)) &&
    (allSame(a.fill, b.fill, c.fill) || allDiff(a.fill, b.fill, c.fill)) &&
    (allSame(a.count, b.count, c.count) || allDiff(a.count, b.count, c.count))
  );
}

/* ============================================================
   RENDER CARD
   Cards use SVG artwork
   ============================================================ */

function renderCard(card, index) {
  return `
    <div class="card" data-i="${index}">
      ${renderSymbols(card)}
    </div>
  `;
}

function renderSymbols(card) {
  let svg = "";
  for (let i = 0; i < card.count; i++) {
    svg += renderSymbol(card);
  }
  return `<div class="symbols">${svg}</div>`;
}

function renderSymbol(card) {
  const colorMap = {
    red: "#ff5f5f",
    green: "#6dff6a",
    blue: "#5fa8ff"
  };

  const fillMap = {
    empty: "none",
    solid: colorMap[card.color],
    stripe: `url(#stripe-${card.color})`
  };

  const size = 45;

  let shape;
  if (card.shape === "circle") {
    shape = `<circle cx="25" cy="25" r="20" fill="${fillMap[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4"/>`;
  } else if (card.shape === "square") {
    shape = `<rect x="5" y="5" width="40" height="40" fill="${fillMap[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4" rx="6"/>`;
  } else {
    shape = `<polygon points="25,5 45,45 5,45" fill="${fillMap[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4"/>`;
  }

  return `
    <svg class="symbol" width="${size}" height="${size}" viewBox="0 0 50 50">
      ${shape}
      <defs>
        <pattern id="stripe-${card.color}" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6 M-3 3 L3 9 M3 -3 L9 3" stroke="${colorMap[card.color]}" stroke-width="2"/>
        </pattern>
      </defs>
    </svg>
  `;
}

/* ============================================================
   GAME INITIALIZATION
   ============================================================ */

async function startGame() {
  const deck = generateDeck();
  shuffle(deck);
  cards = deck.slice(0, 12);
  gameGrid.innerHTML = cards.map(renderCard).join("");

  document.querySelectorAll(".card").forEach(card =>
    card.addEventListener("click", onCardClick)
  );

  mistakes = 0;
  mistakesEl.textContent = "0";
  startTimer();
}

/* ============================================================
   CARD SELECTION LOGIC
   ============================================================ */

function onCardClick(e) {
  const index = parseInt(e.currentTarget.dataset.i);
  if (selected.includes(index)) return;

  selected.push(index);
  e.currentTarget.classList.add("selected");

  if (selected.length === 3) {
    checkSet();
  }
}

function checkSet() {
  const a = cards[selected[0]];
  const b = cards[selected[1]];
  const c = cards[selected[2]];

  const cardEls = selected.map(i =>
    document.querySelector(`.card[data-i="${i}"]`)
  );

  if (isSet(a, b, c)) {
    cardEls.forEach(c => c.classList.add("correct"));
    setTimeout(() => {
      cardEls.forEach(c => c.classList.remove("selected", "correct"));
      cardEls.forEach(c => c.classList.add("removed"));
    }, 400);

    playSFX("correct");
    triggerConfetti();

    // Check if puzzle finished
    setTimeout(() => {
      if (document.querySelectorAll(".card:not(.removed)").length === 0) {
        winGame();
      }
    }, 500);

  } else {
    mistakes++;
    mistakesEl.textContent = mistakes;
    cardEls.forEach(c => c.classList.add("wrong"));
    playSFX("wrong");

    setTimeout(() => {
      cardEls.forEach(c =>
        c.classList.remove("selected", "wrong")
      );
    }, 300);
  }

  selected = [];
}

/* ============================================================
   TIMER
   ============================================================ */

function startTimer() {
  timer = 0;
  timerInterval = setInterval(() => {
    timer++;
    timerEl.textContent = timer + "s";
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

/* ============================================================
   FINISH GAME
   ============================================================ */

async function winGame() {
  stopTimer();
  playSFX("win");
  triggerConfetti();

  await submitDailyScore(timer, mistakes);
}

/* ============================================================
   SUBMIT SCORE TO SUPABASE
   ============================================================ */

async function submitDailyScore(time, mistakes) {
  const today = new Date().toISOString().split("T")[0];
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  await supabase.from("daily_scores").insert({
    user_id: user.user.id,
    date: today,
    time,
    mistakes
  });
}

/* ============================================================
   CONFETTI + SOUND
   ============================================================ */

function triggerConfetti() {
  confetti({
    particleCount: 70,
    spread: 70,
    origin: { y: 0.7 }
  });
}

function playSFX(type) {
  const sounds = {
    correct: new Audio("sfx/correct.wav"),
    wrong: new Audio("sfx/wrong.wav"),
    win: new Audio("sfx/win.wav")
  };
  sounds[type].play();
}

/* ============================================================
   UTILS
   ============================================================ */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ============================================================
   START
   ============================================================ */

startGame();
