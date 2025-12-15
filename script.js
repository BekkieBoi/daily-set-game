/* ============================================================
   CONFIG
============================================================ */
const supabaseUrl = "https://xmqstvgrqtllyvdehync.supabase.co";
const supabaseKey = "sb_publishable_3T1HdY_Di2xD4p_Vgfk4rQ_NDAhG8-P";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const AUTH_COOLDOWN_HOURS = 1;

/* ============================================================
   ELEMENTS — unified IDs
============================================================ */
const authCard      = document.getElementById("authCard");
const gameCard      = document.getElementById("gameCard");
const adminCard     = document.getElementById("adminCard");

const authEmail     = document.getElementById("authEmail");
const authPassword  = document.getElementById("authPassword");
const authMessage   = document.getElementById("authMessage");

const btnSignIn     = document.getElementById("btnSignIn");
const btnSignUp     = document.getElementById("btnSignUp");
const btnSignOut    = document.getElementById("btnSignOut");

const btnSubmitScore = document.getElementById("btnSubmitScore");
const btnBackToGame  = document.getElementById("btnBackToGame");

const timerEl       = document.getElementById("timer");
const errorsEl      = document.getElementById("errors");
const setsFoundEl   = document.getElementById("setsFound");
const dailyStatus   = document.getElementById("dailyStatus");

const gridEl        = document.getElementById("grid");

const adminScores   = document.getElementById("adminScores");

/* ============================================================
   GAME STATE
============================================================ */
let deck = [];
let cards = [];
let selected = [];
let mistakes = 0;
let setsFound = 0;

let timer = 0;
let timerInterval = null;

const shapes = ["circle", "square", "triangle"];
const colors = ["red", "green", "blue"];
const fills  = ["empty", "stripe", "solid"];
const counts = [1, 2, 3];

function generateDeck() {
  const d = [];
  for (let s of shapes)
    for (let c of colors)
      for (let f of fills)
        for (let n of counts)
          d.push({ shape: s, color: c, fill: f, count: n });
  return d;
}

/* ============================================================
   AUTH — SIGN IN / SIGN UP / SIGN OUT
============================================================ */
btnSignIn.onclick = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail.value,
    password: authPassword.value
  });
  authMessage.textContent = error ? error.message : "Logged in!";
  if (!error) loadSession();
};

btnSignUp.onclick = async () => {
  const { error } = await supabase.auth.signUp({
    email: authEmail.value,
    password: authPassword.value
  });
  authMessage.textContent = error ? error.message : "Account created!";
};

btnSignOut.onclick = async () => {
  await supabase.auth.signOut();
  showAuth();
};

/* ============================================================
   SESSION CHECK
============================================================ */
async function loadSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return showAuth();

  if (user.user_metadata?.role === "admin") showAdmin();
  else showGame();
}

function showAuth() {
  authCard.classList.remove("hidden");
  gameCard.classList.add("hidden");
  adminCard.classList.add("hidden");
}

function showGame() {
  authCard.classList.add("hidden");
  adminCard.classList.add("hidden");
  gameCard.classList.remove("hidden");

  startGame();
}

function showAdmin() {
  authCard.classList.add("hidden");
  gameCard.classList.add("hidden");
  adminCard.classList.remove("hidden");
  loadAdminScores();
}

btnBackToGame.onclick = showGame;

/* ============================================================
   ONE-HOUR WRITE COOLDOWN
============================================================ */
function canWrite() {
  const last = localStorage.getItem("lastWrite");
  if (!last) return true;

  const diff = (Date.now() - Number(last)) / (1000 * 60 * 60);
  return diff >= AUTH_COOLDOWN_HOURS;
}

function recordWrite() {
  localStorage.setItem("lastWrite", Date.now());
}

/* ============================================================
   GAME LOGIC — OPTION E (6 SETS NEEDED)
============================================================ */
function startGame() {
  mistakes = 0;
  setsFound = 0;
  errorsEl.textContent = "0";
  setsFoundEl.textContent = "0/6";

  deck = generateDeck();
  shuffle(deck);

  cards = deck.slice(0, 12);

  renderGrid();

  startTimer();
}

function renderGrid() {
  gridEl.innerHTML = cards.map((c, i) => renderCard(c, i)).join("");

  document.querySelectorAll(".cardItem").forEach(el =>
    el.onclick = onCardClick
  );
}

/* --- Render one card --- */
function renderCard(card, index) {
  return `
    <div class="cardItem" data-i="${index}">
      <div class="symbols">${renderSymbols(card)}</div>
    </div>
  `;
}

function renderSymbols(card) {
  let out = "";
  for (let i = 0; i < card.count; i++) out += renderSymbol(card);
  return out;
}

function renderSymbol(card) {
  const color = {
    red: "#ff5f5f",
    green: "#6dff6a",
    blue: "#5fa8ff"
  }[card.color];

  const fill = card.fill === "empty"
    ? "none"
    : card.fill === "solid"
    ? color
    : `url(#stripe-${card.color})`;

  let shape;
  if (card.shape === "circle")
    shape = `<circle cx="25" cy="25" r="20" stroke="${color}" fill="${fill}" stroke-width="4"/>`;
  if (card.shape === "square")
    shape = `<rect x="5" y="5" width="40" height="40" stroke="${color}" fill="${fill}" stroke-width="4"/>`;
  if (card.shape === "triangle")
    shape = `<polygon points="25,5 45,45 5,45" stroke="${color}" fill="${fill}" stroke-width="4"/>`;

  return `
    <svg class="symbol" width="50" height="50">${shape}
      <defs>
        <pattern id="stripe-${card.color}" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6" stroke="${color}" stroke-width="2"/>
        </pattern>
      </defs>
    </svg>
  `;
}

/* --- Card selection --- */
function onCardClick(e) {
  const i = Number(e.currentTarget.dataset.i);
  if (selected.includes(i)) return;

  selected.push(i);
  e.currentTarget.classList.add("selected");

  if (selected.length === 3) checkSet();
}

function isSet(a, b, c) {
  return check(a.shape, b.shape, c.shape) &&
    check(a.color, b.color, c.color) &&
    check(a.fill, b.fill, c.fill) &&
    check(a.count, b.count, c.count);
}

function check(a, b, c) {
  return (a === b && b === c) || (a !== b && a !== c && b !== c);
}

function checkSet() {
  const [i1, i2, i3] = selected;
  const els = selected.map(i => document.querySelector(`[data-i="${i}"]`));

  if (isSet(cards[i1], cards[i2], cards[i3])) {
    els.forEach(e => e.classList.add("correct"));
    setsFound++;
    setsFoundEl.textContent = `${setsFound}/6`;

    setTimeout(() => {
      els.forEach(e => e.classList.add("hidden"));
    }, 300);

    if (setsFound === 6) winGame();

  } else {
    mistakes++;
    errorsEl.textContent = mistakes;
    els.forEach(e => e.classList.add("wrong"));
    setTimeout(() => els.forEach(e => e.classList.remove("wrong", "selected")), 300);
  }

  selected = [];
}

/* ============================================================
   TIMER
============================================================ */
function startTimer() {
  timer = 0;
  clearInterval(timerInterval);
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

  if (!canWrite()) {
    dailyStatus.textContent = "⏳ You already submitted within 1 hour.";
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);

  await supabase.from("daily_scores").insert({
    user_id: user.id,
    date: today,
    time: timer,
    mistakes
  });

  recordWrite();

  dailyStatus.textContent = "🎉 Score saved!";
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
   ADMIN
============================================================ */
async function loadAdminScores() {
  const { data } = await supabase
    .from("daily_scores")
    .select("*")
    .order("date", { ascending: false });

  adminScores.innerHTML = data
    .map(s => `<p>${s.date}: ${s.time}s — ${s.mistakes} mistakes</p>`)
    .join("");
}

/* ============================================================
   STARTUP
============================================================ */
loadSession();
