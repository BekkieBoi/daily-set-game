/* ============================================================
   CONFIG
============================================================ */
const supabaseUrl = "https://xmqstvgrqtllyvdehync.supabase.co";
const supabaseKey = "sb_publishable_3T1HdY_Di2xD4p_Vgfk4rQ_NDAhG8-P";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

/* ============================================================
   ELEMENTS
============================================================ */
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("btnLogin");
const signupBtn = document.getElementById("btnSignup");
const logoutBtn = document.getElementById("btnLogout");
const submitBtn = document.getElementById("btnSubmitScore");

const authCard = document.getElementById("authCard");
const gameCard = document.getElementById("gameCard");
const leaderboardCard = document.getElementById("leaderboardCard");

const usernameEl = document.getElementById("username");
const mistakesEl = document.getElementById("mistakes");
const timerEl = document.getElementById("timer");

const adminLinkContainer = document.getElementById("adminLinkContainer");

/* Admin page elements (if present) */
const adminScores = document.getElementById("adminScores");
const adminLogout = document.getElementById("btnAdminLogout");
const adminStatus = document.getElementById("adminStatus");

/* ============================================================
   AUTH EVENTS
============================================================ */
if (loginBtn) loginBtn.onclick = login;
if (signupBtn) signupBtn.onclick = signup;
if (logoutBtn) logoutBtn.onclick = logout;
if (adminLogout) adminLogout.onclick = logout;

/* ============================================================
   SIGNUP — assigns role: "player"
============================================================ */
async function signup() {
  const { data, error } = await supabase.auth.signUp({
    email: emailEl.value,
    password: passEl.value,
    options: { data: { role: "player" } }
  });

  if (error) alert(error.message);
  else alert("Account created!");
}

/* ============================================================
   LOGIN
============================================================ */
async function login() {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailEl.value,
    password: passEl.value
  });
  if (error) alert(error.message);
}

/* ============================================================
   LOGOUT
============================================================ */
async function logout() {
  await supabase.auth.signOut();
  location.href = "index.html";
}

/* ============================================================
   STATE CHANGE HANDLER
============================================================ */
supabase.auth.onAuthStateChange(async (_, session) => {
  if (!session) {
    // logged out
    authCard.classList.remove("hidden");
    gameCard.classList.add("hidden");
    adminLinkContainer?.classList.add("hidden");
    return;
  }

  const user = session.user;
  const role = user.user_metadata?.role || "player";

  usernameEl.textContent = user.email;

  authCard.classList.add("hidden");
  gameCard.classList.remove("hidden");

  if (role === "admin") {
    adminLinkContainer.classList.remove("hidden");
  }

  startGame();
});

/* ============================================================
   GAME ENGINE
============================================================ */
const shapes = ["circle", "square", "triangle"];
const colors = ["red", "green", "blue"];
const fills = ["empty", "stripe", "solid"];
const counts = [1, 2, 3];

const gameGrid = document.getElementById("gameGrid");

let cards = [];
let selected = [];
let mistakes = 0;
let timer = 0;
let timerInterval = null;

/* Generate deck */
function generateDeck() {
  const deck = [];
  for (let s of shapes)
    for (let c of colors)
      for (let f of fills)
        for (let n of counts)
          deck.push({ shape: s, color: c, fill: f, count: n });
  return deck;
}

/* Valid set */
function allSame(a, b, c) { return a === b && b === c; }
function allDiff(a, b, c) { return a !== b && a !== c && b !== c; }

function isSet(a, b, c) {
  return (
    (allSame(a.shape, b.shape, c.shape) || allDiff(a.shape, b.shape, c.shape)) &&
    (allSame(a.color, b.color, c.color) || allDiff(a.color, b.color, c.color)) &&
    (allSame(a.fill, b.fill, c.fill) || allDiff(a.fill, b.fill, c.fill)) &&
    (allSame(a.count, b.count, c.count) || allDiff(a.count, b.count, c.count))
  );
}

/* Render card */
function renderSymbol(card) {
  const colorsHex = { red: "#ff5f5f", green: "#6dff6a", blue: "#5fa8ff" };
  const fillsMap = {
    empty: "none",
    solid: colorsHex[card.color],
    stripe: `url(#stripe-${card.color})`
  };

  let symbol;
  if (card.shape === "circle")
    symbol = `<circle cx="25" cy="25" r="20" fill="${fillsMap[card.fill]}" stroke="${colorsHex[card.color]}" stroke-width="4"/>`;
  else if (card.shape === "square")
    symbol = `<rect x="5" y="5" width="40" height="40" fill="${fillsMap[card.fill]}" stroke="${colorsHex[card.color]}" stroke-width="4" rx="6"/>`;
  else
    symbol = `<polygon points="25,5 45,45 5,45" fill="${fillsMap[card.fill]}" stroke="${colorsHex[card.color]}" stroke-width="4"/>`;

  return `
    <svg class="symbol" width="50" height="50" viewBox="0 0 50 50">
      ${symbol}
      <defs>
        <pattern id="stripe-${card.color}" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6 M-3 3 L3 9 M3 -3 L9 3" stroke="${colorsHex[card.color]}" stroke-width="2"/>
        </pattern>
      </defs>
    </svg>
  `;
}

function renderCard(c, index) {
  return `<div class="card" data-i="${index}">${renderSymbol(c).repeat(c.count)}</div>`;
}

/* Start game */
function startGame() {
  const deck = generateDeck();
  shuffle(deck);
  cards = deck.slice(0, 12);

  gameGrid.innerHTML = cards.map(renderCard).join("");

  document.querySelectorAll(".card").forEach(c =>
    c.onclick = onCardClick
  );

  mistakes = 0;
  mistakesEl.textContent = "0";

  startTimer();
}

function onCardClick(e) {
  const i = parseInt(e.currentTarget.dataset.i);
  if (selected.includes(i)) return;

  selected.push(i);
  e.currentTarget.classList.add("selected");

  if (selected.length === 3) checkSet();
}

function checkSet() {
  const [a, b, c] = selected.map(i => cards[i]);
  const els = selected.map(i => document.querySelector(`.card[data-i="${i}"]`));

  if (isSet(a, b, c)) {
    els.forEach(e => e.classList.add("correct"));
    setTimeout(() => els.forEach(e => e.classList.add("removed")), 400);
    triggerConfetti();

    setTimeout(() => {
      if (document.querySelectorAll(".card:not(.removed)").length === 0)
        winGame();
    }, 500);

  } else {
    mistakes++;
    mistakesEl.textContent = mistakes;
    els.forEach(e => e.classList.add("wrong"));
  }

  setTimeout(() => els.forEach(e => e.className = "card"), 300);
  selected = [];
}

/* Timer */
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

/* Winning */
async function winGame() {
  stopTimer();
  triggerConfetti();
  submitDailyScore();
  submitBtn.classList.remove("hidden");
}

/* Submit score */
async function submitDailyScore() {
  const today = new Date().toISOString().split("T")[0];
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  await supabase.from("daily_scores").insert({
    user_id: user.user.id,
    date: today,
    time: timer,
    mistakes
  });
}

/* Confetti */
function triggerConfetti() {
  confetti({
    particleCount: 70,
    spread: 70,
    origin: { y: 0.7 }
  });
}

/* Utils */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ============================================================
   ADMIN DASHBOARD
============================================================ */
async function loadAdminPage() {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return location.href = "index.html";

  const role = user.user.user_metadata?.role;
  if (role !== "admin") {
    adminStatus.textContent = "You are NOT an admin.";
    return;
  }

  adminStatus.textContent = `Logged in as admin: ${user.user.email}`;

  const { data } = await supabase.from("daily_scores").select(`
    time,
    mistakes,
    date,
    profiles:user_id ( email )
  `);

  adminScores.innerHTML = data.map(row => `
    <div class="mini">
      <b>${row.profiles.email}</b><br>
      Date: ${row.date}<br>
      Time: ${row.time}s<br>
      Mistakes: ${row.mistakes}
      <hr>
    </div>
  `).join("");
}

if (adminScores) loadAdminPage();
