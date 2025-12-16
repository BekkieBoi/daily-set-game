/* ====== CONFIG ====== */
const supabase = supabase.createClient("YOUR_URL", "YOUR_KEY");

/* ====== ELEMENTS ====== */
const emailEl = document.getElementById("authEmail");
const passEl  = document.getElementById("authPassword");
const msgEl   = document.getElementById("authMessage");

const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");

const authPanel = document.getElementById("authPanel");
const gamePanel = document.getElementById("gamePanel");

const grid = document.getElementById("cardGrid");
const timeDisplay = document.getElementById("timeDisplay");
const errDisplay = document.getElementById("errorDisplay");
const btnSubmit = document.getElementById("btnSubmitScore");
const adminLink = document.getElementById("adminLink");

const themeToggle = document.getElementById("themeToggle");

/* ====== THEME SYSTEM (Option C: Auto + Manual Override) ====== */
let storedTheme = localStorage.getItem("theme");

applyTheme(storedTheme || "auto");

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
}

themeToggle.onclick = () => {
  let t = localStorage.getItem("theme") || "auto";
  if (t === "auto") applyTheme("light");
  else if (t === "light") applyTheme("dark");
  else applyTheme("auto");
};

/* ====== GAME LOGIC ====== */
let deck = [];
let selected = [];
let errors = 0;
let time = 0;
let timer = null;
let setsFound = 0;

const shapes = ["circle", "square", "triangle"];
const colors = ["red", "green", "blue"];
const fills  = ["solid", "stripe", "empty"];
const counts = [1, 2, 3];

function generateDeck() {
  const out = [];
  for (let s of shapes)
    for (let c of colors)
      for (let f of fills)
        for (let n of counts)
          out.push({shape: s, color: c, fill: f, count: n});
  return out;
}

function shuffle(a) {
  for (let i = a.length-1; i > 0; i--) {
    let j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ====== RENDER CARDS (as buttons) ====== */
function renderCard(card, i) {
  return `
  <button class="cardBtn" data-i="${i}">
    ${renderSymbols(card)}
  </button>`;
}

function renderSymbols(card) {
  let svg = "";
  for (let i = 0; i < card.count; i++) {
    svg += `
    <svg width="35" height="35" viewBox="0 0 50 50">
      <${shapePath(card)} stroke="${color(card)}" stroke-width="4"
           fill="${fill(card)}" />
    </svg>`;
  }
  return svg;
}

function shapePath(card) {
  if (card.shape === "circle")
    return `circle cx="25" cy="25" r="20"`;
  if (card.shape === "square")
    return `rect x="5" y="5" width="40" height="40" rx="6"`;
  return `polygon points="25,5 45,45 5,45"`;
}

function color(card) {
  return card.color === "red" ? "#ff5f5f" :
         card.color === "green" ? "#5fff77" :
         "#5fa8ff";
}

function fill(card) {
  if (card.fill === "empty") return "none";
  if (card.fill === "solid") return color(card);
  return `url(#stripe-${card.color})`;
}

/* ====== SET CHECK ====== */
function allSame(a,b,c){ return a===b && b===c; }
function allDiff(a,b,c){ return a!==b && a!==c && b!==c; }

function isSet(a,b,c){
  return (
    (allSame(a.shape,b.shape,c.shape) || allDiff(a.shape,b.shape,c.shape)) &&
    (allSame(a.color,b.color,c.color) || allDiff(a.color,b.color,c.color)) &&
    (allSame(a.fill,b.fill,c.fill) || allDiff(a.fill,b.fill,c.fill)) &&
    (allSame(a.count,b.count,c.count) || allDiff(a.count,b.count,c.count))
  );
}

/* ====== GAME INIT ====== */
async function loadGame() {
  authPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");

  deck = shuffle(generateDeck()).slice(0, 12);
  setsFound = 0;
  errors = 0;
  errDisplay.textContent = errors;

  grid.innerHTML = deck.map(renderCard).join("");

  document.querySelectorAll(".cardBtn").forEach(btn =>
    btn.addEventListener("click", onCardClick)
  );

  startTimer();
}

/* ====== CLICK ====== */
function onCardClick(e) {
  const index = +e.currentTarget.dataset.i;
  if (selected.includes(index)) return;

  selected.push(index);
  e.currentTarget.classList.add("selected");

  if (selected.length === 3) checkSet();
}

function checkSet() {
  const [a,b,c] = selected.map(i => deck[i]);
  const btns = selected.map(i => document.querySelector(`[data-i="${i}"]`));

  if (isSet(a,b,c)) {
    btns.forEach(b => b.classList.add("correct"));
    setsFound++;

    if (setsFound === 6) finishGame();

  } else {
    errors++;
    errDisplay.textContent = errors;
    btns.forEach(b => b.classList.add("wrong"));
  }

  setTimeout(() => {
    btns.forEach(b =>
      b.classList.remove("selected","correct","wrong")
    );
  }, 350);

  selected = [];
}

/* ====== TIMER ====== */
function startTimer() {
  time = 0;
  timer = setInterval(() => {
    time++;
    timeDisplay.textContent = `${time}s`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
}

/* ====== FINISH ====== */
async function finishGame() {
  stopTimer();
  await submitScore();
  btnSubmit.classList.remove("hidden");
}

async function submitScore() {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const today = new Date().toISOString().split("T")[0];

  const last = localStorage.getItem("lastUpload");
  if (last && Date.now() - +last < 3600_000) return;

  localStorage.setItem("lastUpload", Date.now());

  await supabase.from("daily_scores").insert({
    user_id: user.user.id,
    date: today,
    time,
    errors
  });
}

/* ====== AUTH ====== */
btnLogin.onclick = async () => {
  let { error } = await supabase.auth.signInWithPassword({
    email: emailEl.value,
    password: passEl.value
  });
  msgEl.textContent = error ? error.message : "Logged in!";
  if (!error) afterLogin();
};

btnRegister.onclick = async () => {
  let { error } = await supabase.auth.signUp({
    email: emailEl.value,
    password: passEl.value
  });
  msgEl.textContent = error ? error.message : "Account created!";
};

btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

async function afterLogin() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) return;

  document.getElementById("userName").textContent = user.email;

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (role && role.role === "admin") {
    adminLink.classList.remove("hidden");
  }

  loadGame();
}
