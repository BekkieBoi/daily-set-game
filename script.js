/* ---------- INIT SUPABASE ---------- */
const SUPABASE_URL = "https://xmqstvgrqtllyvdehync.supabase.co";
const SUPABASE_KEY = "sb_publishable_3T1HdY_Di2xD4p_Vgfk4rQ_NDAhG8-P";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* DOM */
const authCard = document.getElementById("authCard");
const gameCard = document.getElementById("gameCard");
const lbList   = document.getElementById("leaderboardList");

const btnSignIn  = document.getElementById("btnSignIn");
const btnSignUp  = document.getElementById("btnSignUp");
const btnSignOut = document.getElementById("btnSignOut");

const authMsg = document.getElementById("authMsg");
const playerEmail = document.getElementById("playerEmail");

let currentUser = null;

/* ---------- helpers ---------- */
function showAuth(msg, error=false){
  authMsg.textContent = msg;
  authMsg.style.color = error ? "crimson" : "var(--muted)";
}

function showGameUI(){
  authCard.style.display = "none";
  gameCard.style.display = "";
}
function showAuthUI(){
  authCard.style.display = "";
  gameCard.style.display = "none";
}

/* ---------- SIGN UP ---------- */
btnSignUp.addEventListener("click", async ()=>{
  const email = document.getElementById("email").value.trim();
  const pw    = document.getElementById("password").value;

  if(!email || !pw){ showAuth("Enter email & password", true); return; }

  showAuth("Creating account...");

  const { data, error } = await supabase.auth.signUp({
    email, password: pw
  });

  if(error){ showAuth(error.message, true); return; }

  showAuth("Account created! Now sign in.");
});

/* ---------- SIGN IN ---------- */
btnSignIn.addEventListener("click", async ()=>{
  const email = document.getElementById("email").value.trim();
  const pw    = document.getElementById("password").value;

  if(!email || !pw){ showAuth("Enter email & password", true); return; }

  showAuth("Signing in...");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });

  if(error){ showAuth(error.message, true); return; }

  currentUser = data.user;
  playerEmail.textContent = currentUser.email;

  loadLeaderboard();
  showGameUI();

  btnSignIn.style.display = "none";
  btnSignUp.style.display = "none";
  btnSignOut.style.display = "";
});

/* ---------- SIGN OUT ---------- */
btnSignOut.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
  currentUser = null;

  btnSignOut.style.display = "none";
  btnSignIn.style.display = "";
  btnSignUp.style.display = "";

  showAuthUI();
});

/* ---------- LEADERBOARD ---------- */
async function loadLeaderboard(){
  lbList.innerHTML = "";

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("streak", { ascending:false })
    .limit(20);

  data.forEach((p, i)=>{
    const li = document.createElement("li");
    li.className = "lb-item";
    li.innerHTML = `${i+1}. <strong>${p.email}</strong> — ${p.streak}`;
    lbList.appendChild(li);

    setTimeout(()=> li.classList.add("visible"), 50*(i+1));
  });
}

/* ---------- DARK MODE ---------- */
document.getElementById("darkToggle").addEventListener("click", ()=>{
  const root = document.documentElement;
  const cur = root.getAttribute("data-theme") || "dark";
  root.setAttribute("data-theme", cur==="dark" ? "light" : "dark");
});
