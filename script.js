/* ============================================================
   CONFIG
============================================================ */
const supabaseUrl = "https://xmqstvgrqtllyvdehync.supabase.co"; 
const supabaseKey = "sb_publishable_3T1HdY_Di2xD4p_Vgfk4rQ_NDAhG8-P";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

/* ============================================================
   ELEMENTS
============================================================ */
const authPanel = document.getElementById("authPanel");
const gamePanel = document.getElementById("gamePanel");
const leaderboardPanel = document.getElementById("leaderboardPanel");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const authMsg = document.getElementById("authMsg");

const btnLogin = document.getElementById("btnLogin");
const btnSignup = document.getElementById("btnSignup");
const btnLogout = document.getElementById("btnLogout");
const btnSubmit = document.getElementById("btnSubmitScore");

const timerEl = document.getElementById("timer");
const mistakesEl = document.getElementById("mistakes");
const foundCountEl = document.getElementById("foundCount");
const grid = document.getElementById("grid");

/* ============================================================
   GAME STATE
============================================================ */
let deck = [];
let selected = [];
let mistakes = 0;
let foundSets = 0;
let timer = 0;
let timerInterval = null;

const shapes = ["circle", "square", "triangle"];
const colors = ["red", "green", "blue"];
const fills = ["empty", "stripe", "solid"];
const counts = [1, 2, 3];

/* ============================================================
   LOGIN / SIGNUP
============================================================ */
btnLogin.onclick = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailEl.value,
    password: passEl.value
  });
  if (error) authMsg.textContent = error.message;
};

btnSignup.onclick = async () => {
  const { error } = await supabase.auth.signUp({
    email: emailEl.value,
    password: passEl.value
  });
  if (error) authMsg.textContent = error.message;
};

/* ============================================================
   AUTH STATE
============================================================ */
supabase.auth.onAuthStateChange(async (_, session) => {
  if (session && session.user)
    showGame();
  else
    showAuth();
});

function showAuth() {
  authPanel.classList.remove("hidden");
  gamePanel.classList.add("hidden");
}

function showGame() {
  authPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  startDaily();
}

btnLogout.onclick = () => supabase.auth.signOut();

/* ============================================================
   CARD GENERATION
============================================================ */
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
   SET CHECK
============================================================ */
function eq(a,b,c){ return a===b && b===c; }
function diff(a,b,c){ return a!==b && a!==c && b!==c; }

function isSet(a,b,c) {
  return (
    (eq(a.shape,b.shape,c.shape)||diff(a.shape,b.shape,c.shape)) &&
    (eq(a.color,b.color,c.color)||diff(a.color,b.color,c.color)) &&
    (eq(a.fill,b.fill,c.fill)||diff(a.fill,b.fill,c.fill)) &&
    (eq(a.count,b.count,c.count)||diff(a.count,b.count,c.count))
  );
}

function countSets(cards) {
  let total = 0;
  for (let i=0;i<12;i++)
    for (let j=i+1;j<12;j++)
      for (let k=j+1;k<12;k++)
        if (isSet(cards[i], cards[j], cards[k])) total++;
  return total;
}

/* ============================================================
   GENERATE A GRID WITH EXACTLY 6 SETS
============================================================ */
function generateSixSetBoard() {
  let deck = generateDeck();
  shuffle(deck);

  while (true) {
    const board = shuffle([...deck]).slice(0, 12);
    if (countSets(board) === 6)
      return board;
  }
}

/* ============================================================
   RENDER
============================================================ */
function renderSymbol(card) {
  const colorMap = { red:"#ff5f5f", green:"#6dff6a", blue:"#5fa8ff" };
  const fillColor = {
    empty: "none",
    solid: colorMap[card.color],
    stripe: `url(#stripe-${card.color})`
  };

  const shape = card.shape === "circle"
    ? `<circle cx="25" cy="25" r="20" fill="${fillColor[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4"/>`
    : card.shape === "square"
      ? `<rect x="5" y="5" width="40" height="40" rx="6" fill="${fillColor[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4"/>`
      : `<polygon points="25,5 45,45 5,45" fill="${fillColor[card.fill]}" stroke="${colorMap[card.color]}" stroke-width="4"/>`;

  return `
    <svg width="50" height="50" viewBox="0 0 50 50">
      ${shape}
      <defs>
        <pattern id="stripe-${card.color}" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6 M-3 3 L3 9 M3 -3 L9 3"
            stroke="${colorMap[card.color]}" stroke-width="2"/>
        </pattern>
      </defs>
    </svg>
  `;
}

function renderCard(card, i) {
  return `
    <div class="gameCard" data-i="${i}">
      ${Array(card.count).fill(0).map(()=>renderSymbol(card)).join("")}
    </div>
  `;
}

/* ============================================================
   GAME LOGIC
============================================================ */
async function startDaily() {
  selected = [];
  mistakes = 0;
  foundSets = 0;

  mistakesEl.textContent = 0;
  foundCountEl.textContent = 0;

  deck = generateSixSetBoard();
  grid.innerHTML = deck.map(renderCard).join("");

  document.querySelectorAll(".gameCard").forEach(el => {
    el.onclick = onCardClick;
  });

  startTimer();
}

function onCardClick(e) {
  const el = e.currentTarget;
  const i = parseInt(el.dataset.i);

  if (selected.includes(i)) return;

  el.classList.add("selected");
  selected.push(i);

  if (selected.length === 3)
    checkSet();
}

function checkSet() {
  const [i,j,k] = selected;
  const a = deck[i], b = deck[j], c = deck[k];

  const els = selected.map(n => document.querySelector(`.gameCard[data-i="${n}"]`));

  if (isSet(a,b,c)) {
    foundSets++;
    foundCountEl.textContent = foundSets;

    els.forEach(el=>el.classList.add("correct"));
    setTimeout(()=>els.forEach(el=>el.classList.add("removed")),300);

    if (foundSets === 6)
      winGame();
  } else {
    mistakes++;
    mistakesEl.textContent = mistakes;
    els.forEach(el=>el.classList.add("wrong"));
    setTimeout(()=>els.forEach(el=>el.classList.remove("selected","wrong")),300);
  }

  selected = [];
}

/* ============================================================
   TIMER
============================================================ */
function startTimer() {
  timer = 0;
  timerEl.textContent = 0;
  clearInterval(timerInterval);

  timerInterval = setInterval(()=>{
    timer++;
    timerEl.textContent = timer;
  },1000);
}

function stopTimer() { clearInterval(timerInterval); }

/* ============================================================
   END OF GAME
============================================================ */
async function winGame() {
  stopTimer();
  btnSubmit.classList.remove("hidden");

  btnSubmit.onclick = async () => {
    await submitScore(timer, mistakes);
  };
}

/* ============================================================
   SUPABASE WRITE THROTTLE
============================================================ */
async function submitScore(time, mistakes) {

  const last = localStorage.getItem("lastSubmit");
  const now = Date.now();

  if (last && now - last < 3600000)
    return alert("You can submit only once per hour.");

  localStorage.setItem("lastSubmit", now);

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const today = new Date().toISOString().split("T")[0];

  await supabase.from("daily_scores").insert({
    user_id: user.user.id,
    date: today,
    time,
    mistakes
  });

  alert("Score submitted!");
}

/* ============================================================
   UTILS
============================================================ */
function shuffle(arr) {
  for (let i=arr.length-1; i>0; i--) {
    const j = Math.floor(Math.random()* (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
