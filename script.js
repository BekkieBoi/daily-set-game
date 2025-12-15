/* ---------- SUPABASE ---------- */
const supabase = window.supabase.createClient(
  "https://xmqstvgrqtllyvdehync.supabase.co",
  "sb_publishable_3T1HdY_Di2xD4p_Vgfk4rQ_NDAhG8-P"
);

/* ---------- ELEMENTS ---------- */
const authCard = document.getElementById("authCard");
const gameCard = document.getElementById("gameCard");
const grid = document.getElementById("grid");
const btnLogin = document.getElementById("btnLogin");
const btnSignup = document.getElementById("btnSignup");
const btnLogout = document.getElementById("btnLogout");
const btnSubmit = document.getElementById("btnSubmit");
const status = document.getElementById("status");
const authMsg = document.getElementById("authMsg");

/* ---------- HELPERS ---------- */
function msg(text) { authMsg.textContent = text; }

/* Confetti (tiny lightweight version) */
function explodeConfetti() {
  const duration = 700;
  const end = Date.now() + duration;
  const colors = ["#60a5fa","#22c55e","#fbbf24"];

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      colors: colors
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/* SFX */
const ding = new Audio("https://assets.mixkit.co/active_storage/sfx/2008/2008-preview.mp3");

/* ---------- CARD ATTRIBUTES ---------- */
const COLORS = ["red","green","purple"];
const SHAPES = ["diamond","oval","squiggle"];
const FILLS = ["solid","striped","empty"];
const COUNTS = [1,2,3];

/* Generate 1 card */
function makeCard() {
  return {
    color: COLORS[Math.floor(Math.random()*3)],
    shape: SHAPES[Math.floor(Math.random()*3)],
    fill: FILLS[Math.floor(Math.random()*3)],
    count: COUNTS[Math.floor(Math.random()*3)]
  };
}

/* Generate puzzle (12 cards) */
let cards = [];
function generatePuzzle() {
  cards = Array.from({ length: 12 }, makeCard);
}

/* Render SVG shape */
function renderShape(card) {
  const colorMap = { red:"#ef4444", green:"#22c55e", purple:"#a855f7" };
  const fill = card.fill === "solid"
    ? colorMap[card.color]
    : card.fill === "striped"
    ? "url(#stripe)"
    : "none";

  let shapeSVG = "";
  if (card.shape === "oval") {
    shapeSVG = `<rect rx="20" ry="20" width="40" height="40" stroke="${colorMap[card.color]}" stroke-width="4" fill="${fill}"/>`;
  } else if (card.shape === "diamond") {
    shapeSVG = `<polygon points="20,0 40,20 20,40 0,20" stroke="${colorMap[card.color]}" stroke-width="4" fill="${fill}"/>`;
  } else {
    shapeSVG = `<path d="M5 20 Q20 -5 35 20 Q20 45 5 20" stroke="${colorMap[card.color]}" stroke-width="4" fill="${fill}"/>`;
  }

  return shapeSVG;
}

/* Render grid */
let selected = [];
function renderGrid() {
  grid.innerHTML = "";

  cards.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "cardItem";
    if (selected.includes(i)) el.classList.add("selected");

    el.innerHTML = Array(card.count).fill(null).map(() =>
      `<svg class="shape" viewBox="0 0 40 40">${renderShape(card)}</svg>`
    ).join("");

    el.onclick = () => selectCard(i);
    grid.appendChild(el);
  });
}

/* ---------- SELECT + VALIDATE ---------- */
function allSameOrAllDiff(a,b,c) {
  return (a===b && b===c) || (a!==b && b!==c && a!==c);
}

function isSet(a,b,c) {
  return (
    allSameOrAllDiff(a.color,b.color,c.color) &&
    allSameOrAllDiff(a.shape,b.shape,c.shape) &&
    allSameOrAllDiff(a.fill,b.fill,c.fill) &&
    allSameOrAllDiff(a.count,b.count,c.count)
  );
}

function selectCard(i) {
  if (selected.includes(i)) {
    selected = selected.filter(x => x !== i);
  } else {
    selected.push(i);
  }

  if (selected.length === 3) {
    const [a,b,c] = selected.map(i => cards[i]);
    if (isSet(a,b,c)) {
      ding.play();
      explodeConfetti();

      // Replace with new cards
      selected.sort((a,b)=>b-a).forEach(i => {
        cards.splice(i,1,makeCard());
      });

      status.textContent = "✔ Set found!";
    } else {
      status.textContent = "✖ Not a set.";
    }

    selected = [];
  }

  renderGrid();
}

/* ---------- DAILY SUBMISSION ---------- */
async function checkDaily(userId) {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("daily_scores")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (data) {
    status.textContent = "You already played today.";
    btnSubmit.classList.add("hidden");
    return false;
  }

  btnSubmit.classList.remove("hidden");
  status.textContent = "Find as many sets as you can!";
  return true;
}

btnSubmit.onclick = async () => {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  const today = new Date().toISOString().split("T")[0];
  await supabase.from("daily_scores").insert({
    user_id: user.id,
    date: today,
    score: 1
  });

  status.textContent = "Score submitted!";
  btnSubmit.classList.add("hidden");
};

/* ---------- AUTH ---------- */
btnSignup.onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const pw = document.getElementById("password").value;
  const { error } = await supabase.auth.signUp({ email, password: pw });
  if (error) msg(error.message);
};

btnLogin.onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const pw = document.getElementById("password").value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) return msg(error.message);
  start();
};

btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

/* ---------- START ---------- */
async function start() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  authCard.classList.add("hidden");
  gameCard.classList.remove("hidden");

  const allowed = await checkDaily(data.user.id);
  if (allowed) {
    generatePuzzle();
    renderGrid();
  }
}

start();
