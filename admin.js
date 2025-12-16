const supabase = supabase.createClient("YOUR_URL","YOUR_KEY");

const adminName = document.getElementById("adminName");
const scoreList = document.getElementById("scoreList");
const seedDisplay = document.getElementById("seedDisplay");
const btnGenerate = document.getElementById("btnGenerateSeed");

const themeToggle = document.getElementById("themeToggle");

/* ---- THEME ---- */
themeToggle.onclick = () => {
  let t = localStorage.getItem("theme") || "auto";
  if (t === "auto") t = "light";
  else if (t === "light") t = "dark";
  else t = "auto";
  localStorage.setItem("theme", t);
  document.documentElement.setAttribute("data-theme", t);
};

/* ---- AUTH ---- */
initAdmin();

async function initAdmin() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    location.href = "index.html";
    return;
  }

  adminName.textContent = data.user.email;

  loadScores();
  loadSeed();
}

/* ---- SEED ---- */
async function loadSeed() {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("daily_seed")
    .select("*")
    .eq("date", today)
    .single();

  seedDisplay.textContent = data ? data.seed : "No seed yet.";
}

btnGenerate.onclick = async () => {
  const today = new Date().toISOString().split("T")[0];
  const newSeed = Math.floor(Math.random()*999999);

  await supabase.from("daily_seed").upsert({
    date: today,
    seed: newSeed
  });

  seedDisplay.textContent = newSeed;
};

/* ---- SCORES ---- */
async function loadScores() {
  const { data } = await supabase
    .from("daily_scores")
    .select("*")
    .order("time");

  scoreList.innerHTML = data
    .map(s => `<p>${s.user_id} — ${s.time}s (${s.errors} errors)</p>`)
    .join("");
}
