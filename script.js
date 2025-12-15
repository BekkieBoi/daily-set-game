/* ============================================================
   DAILY SET 
   ============================================================ */

/* --------- SUPABASE ---------- */
const supabaseUrl = "YOUR_URL";
const supabaseKey = "YOUR_PUBLIC_KEY";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

/* ---------- DOM ELEMENTS ---------- */
const authCard = document.getElementById("authCard");
const gameCard = document.getElementById("gameCard");
const leaderboardCard = document.getElementById("leaderboardCard");

const btnSignIn = document.getElementById("btnSignIn");
const btnSignUp = document.getElementById("btnSignUp");
const btnSignOut = document.getElementById("btnSignOut");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const authMsg = document.getElementById("authMsg");

const grid = document.getElementById("grid");  // FIX B
const timerEl = document.getElementById("timer");
const mistakesEl = document.getElementById("mistakes");
const confettiCanvas = document.getElementById("confettiCanvas");

/* GAME STATE */
let cards = [];
let selected = [];
let mistakes = 0;
let timer = 0;
let timerInterval = null;

/* ============================================================
   AUTH EVENTS (FIX B)
   ============================================================ */

btnSignIn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailEl.value,
    password: passEl.value
  });

  authMsg.textContent = error ? error.message : "";
  if (!error) loadUser();
});

btnSignUp.addEventListener("click", async () => {
  const { error } = await supabase.auth.signUp({
    email: emailEl.value,
    password: passEl.value
  });

  authMsg.textContent = error ? error.message : "Account created!";
});

btnSignOut.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuth();
});

/* ============================================================
   LOAD USER + SHOW GAME
   ============================================================ */
async function loadUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return showAuth();

  document.getElementById("username").textContent = data.user.email;
  showGame();
  startGame();
}

function showAuth() {
  authCard.classList.remove("hidden");
  gameCard.classList.add("hidden");
  leaderboardCard.classList.add("hidden");
}

function showGame() {
  authCard.classList.add("hidden");
  gameCard.classList.remove("hidden");
}

/* ============================================================
   CARD DATA
   ============================================================ */

const shapes = ["circle", "square", "triangle"];
const colors = ["red", "green", "blue"];
const fills = ["empty", "stripe", "solid"];
const counts = [1, 2, 3];

function generateDeck() {
  const deck = [];
  for (let s of shapes)
    for (let c of colors)
      for (let f of fills)
        for (let n of counts)
          deck.push({ shape: s, color: c, fill: f, count: n });
  return deck;
}

/* ============================================================
   SET CHECKING
   ============================================================ */
function allSame(a, b, c) { return a === b && b === c; }
function allDiff(a, b, c) { return a !== b && a !== c && b !== c; }

function isSet(a, b, c) {
  return (
    (allSame(a.shape,b.shape,c.shape)||allDiff(a.shape,b.shape,c.shape)) &&
    (allSame(a.color,b.color,c.color)||allDiff(a.color,b.color,c.color)) &&
    (allSame(a.fill,b.fill,c.fill)||allDiff(a.fill,b.fill,c.fill)) &&
    (allSame(a.count,b.count,c.count)||allDiff(a.count,b.count,c.count))
  );
}

/* ============================================================
   CARD RENDERING
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
  for (let i = 0; i < card.count; i++) svg += renderSymbol(card);
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

  let shape;
  if (card.shape === "circle") {
    shape = `<circle cx="25" cy="25" r="20" fill="${fillMap[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4"/>`;
  } else if (card.shape === "square") {
    shape = `<rect x="5" y="5" width="40" height="40" fill="${fillMap[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4" rx="6"/>`;
  } else {
    shape = `<polygon points="25,5 45,45 5,45" fill="${fillMap[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4"/>`;
  }

  return `
    <svg class="symbol" width="50" height="50" viewBox="0 0 50 50">
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
   GAME START
   ============================================================ */
async function startGame() {
  const deck = generateDeck();
  shuffle(deck);

  cards = deck.slice(0, 12); // 12-card layout
  grid.innerHTML = cards.map(renderCard).join("");

  document.querySelectorAll(".card").forEach(card =>
    card.addEventListener("click", onCardClick)
  );

  mistakes = 0;
  mistakesEl.textContent = "0";

  startTimer();
}

/* ============================================================
   CARD SELECTION
   ============================================================ */
function onCardClick(e) {
  const index = parseInt(e.currentTarget.dataset.i);

  if (selected.includes(index)) return;

  selected.push(index);
  e.currentTarget.classList.add("selected");

  if (selected.length === 3) checkSet();
}

function checkSet() {
  const a = cards[selected[0]];
  const b = cards[selected[1]];
  const c = cards[selected[2]];

  const cardEls = selected.map(i => document.querySelector(`.card[data-i="${i}"]`));

  if (isSet(a, b, c)) {
    cardEls.forEach(el => el.classList.add("correct"));
    playSFX("correct");
    triggerConfetti();

    setTimeout(() => {
      cardEls.forEach(el => el.classList.add("removed"));
    }, 300);

    setTimeout(() => {
      if (document.querySelectorAll(".card:not(.removed)").length === 0)
        winGame();
    }, 500);
  } else {
    mistakes++;
    mistakesEl.textContent = mistakes;
    playSFX("wrong");

    cardEls.forEach(el => el.classList.add("wrong"));
    setTimeout(() => cardEls.forEach(el => el.classList.remove("wrong","selected")), 350);
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
   WIN GAME
   ============================================================ */
async function winGame() {
  stopTimer();
  playSFX("win");
  triggerConfetti();
  await submitDailyScore(timer, mistakes);
}

/* ============================================================
   SUBMIT SCORE
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
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 }
  });
}

function playSFX(type) {
  const sfx = {
    correct: new Audio("sfx/correct.wav"),
    wrong: new Audio("sfx/wrong.wav"),
    win: new Audio("sfx/win.wav")
  };
  sfx[type].play();
}

/* ============================================================
   UTIL
   ============================================================ */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ============================================================
   AUTO LOAD AUTH STATE
   ============================================================ */
loadUser();
