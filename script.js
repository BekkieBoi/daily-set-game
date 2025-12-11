/* =========== script.js =========== */
/* Replace these with your Supabase values */
const SUPABASE_URL = "REPLACE_WITH_SUPABASE_URL";
const SUPABASE_ANON_KEY = "REPLACE_WITH_SUPABASE_ANON_KEY";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- simple theme toggle ---------- */
const darkToggle = document.getElementById('darkToggle');
darkToggle?.addEventListener('click', () => {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  darkToggle.textContent = next === 'dark' ? 'Dark' : 'Light';
});

/* ---------- avatars ---------- */
const PRESETS = [
  "https://api.dicebear.com/6.x/thumbs/svg?seed=star",
  "https://api.dicebear.com/6.x/thumbs/svg?seed=fox",
  "https://api.dicebear.com/6.x/thumbs/svg?seed=cat",
  "https://api.dicebear.com/6.x/thumbs/svg?seed=robot"
];
let chosenAvatar = PRESETS[0];

function renderPresets(){
  const root = document.getElementById('presetAvatars'); if(!root) return; root.innerHTML='';
  PRESETS.forEach(url=>{
    const d = document.createElement('div');
    d.style.width='44px'; d.style.height='44px'; d.style.borderRadius='50%'; d.style.overflow='hidden'; d.style.cursor='pointer';
    d.innerHTML = `<img src="${url}" style="width:44px;height:44px;display:block" />`;
    d.onclick = ()=>{ chosenAvatar = url; root.querySelectorAll('div').forEach(x=>x.style.outline='none'); d.style.outline='3px solid rgba(59,130,246,0.18)'; };
    root.appendChild(d);
  });
}
renderPresets();

document.getElementById('uploadAvatar')?.addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  if(!currentUser){
    const reader = new FileReader(); reader.onload=()=> { chosenAvatar = reader.result; }; reader.readAsDataURL(f); return;
  }
  try{
    const path = `avatars/${currentUser.id}/${Date.now()}_${f.name}`;
    const up = await supabase.storage.from('avatars').upload(path, f, { upsert: true });
    if(up.error) throw up.error;
    const publicRes = supabase.storage.from('avatars').getPublicUrl(path);
    const publicURL = publicRes?.data?.publicUrl || null;
    if(!publicURL) throw new Error('No public URL');
    await supabase.from('profiles').upsert({ email: currentUser.email, avatar_url: publicURL }, { onConflict: ['email'] });
    profile = { ...(profile||{}), avatar_url: publicURL }; chosenAvatar = publicURL; renderUserInfo();
    alert('Avatar uploaded');
  }catch(err){ console.warn('upload failed',err); alert('Avatar upload failed'); }
});

/* ---------- Auth wiring ---------- */
const btnSignUp = document.getElementById('btnSignUp');
const btnSignIn = document.getElementById('btnSignIn');
const btnSignOut = document.getElementById('btnSignOut');
const authMsg = document.getElementById('authMsg');

let currentUser = null;
let profile = null;

function showAuth(msg, error=false){ if(!authMsg) return; authMsg.textContent = msg; authMsg.style.color = error? 'crimson':'var(--muted)'; }

/* sign up */
btnSignUp?.addEventListener('click', async ()=>{
  const email = document.getElementById('email').value.trim();
  const pw = document.getElementById('password').value;
  if(!email || !pw){ showAuth('Enter email and password', true); return; }
  showAuth('Creating account...');
  try{
    const res = await supabase.auth.signUp({ email, password: pw, options: { data: { avatar: chosenAvatar } } });
    if(res.error){ showAuth(res.error.message, true); return; }
    await supabase.from('profiles').upsert({ email, avatar_url: chosenAvatar, streak:0 }, { onConflict: ['email'] });
    showAuth('Account created — confirm email then sign in (disable confirmations in Supabase for instant).');
  }catch(e){ console.error(e); showAuth('Sign up failed', true); }
});

/* sign in */
btnSignIn?.addEventListener('click', async ()=>{
  const email = document.getElementById('email').value.trim();
  const pw = document.getElementById('password').value;
  if(!email || !pw){ showAuth('Enter email and password', true); return; }
  showAuth('Signing in...');
  try{
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if(error){ showAuth(error.message, true); return; }
    currentUser = data.user; await loadProfile(); onSignedIn(); showAuth('Signed in');
  }catch(e){ console.error('signIn err', e); showAuth('Sign in failed', true); }
});

/* sign out */
btnSignOut?.addEventListener('click', async ()=>{
  try{
    await supabase.auth.signOut();
    currentUser = null; profile = null;
    document.getElementById('authCard').style.display=''; document.getElementById('gameCard').style.display='none';
    btnSignOut.style.display='none'; btnSignIn.style.display=''; btnSignUp.style.display='';
    showAuth('Signed out');
  }catch(e){ console.warn('signOut err', e); showAuth('Sign out failed', true); }
});

/* auth state */
supabase.auth.onAuthStateChange((event, session) => {
  if(session?.user){ currentUser = session.user; loadProfile().then(()=> onSignedIn()).catch(e=>console.warn(e)); }
  else { currentUser = null; }
});

async function loadProfile(){
  if(!currentUser) return;
  try{
    const { data, error } = await supabase.from('profiles').select('*').eq('email', currentUser.email).maybeSingle();
    if(error) console.warn('profile fetch error', error);
    if(!data){ await supabase.from('profiles').insert({ email: currentUser.email, avatar_url: chosenAvatar, streak:0 }); profile = { email: currentUser.email, avatar_url: chosenAvatar, streak:0, is_admin:false }; }
    else profile = data;
  }catch(e){ console.warn('loadProfile error', e); }
}

/* ---------- Game logic (same core) ---------- */
const numbers=["One","Two","Three"], shapes=["Oval","Diamond","Squiggle"], colors=["Red","Green","Purple"], fills=["Solid","Striped","Open"];
let cards=[], selected=[], validSets=[], setsFound=0, dailySeed=0, adminMode=false;
let timerInterval=null, startTime=null, elapsedSeconds=0;

function startTimer(){ stopTimer(); startTime=Date.now(); elapsedSeconds=0; document.getElementById('timerDisplay').textContent='0s'; timerInterval=setInterval(()=>{ elapsedSeconds=Math.floor((Date.now()-startTime)/1000); document.getElementById('timerDisplay').textContent=elapsedSeconds+'s'; },250); }
function stopTimer(){ if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } }

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function buildDeck(){ let d=[]; for(let n=0;n<3;n++)for(let s=0;s<3;s++)for(let c=0;c<3;c++)for(let f=0;f<3;f++)d.push({num:n,shape:s,color:c,fill:f}); return d; }
function isSet(a,b,c){ function ch(x,y,z){ return (x===y&&y===z)||(x!==y&&x!==z&&y!==z);} return ch(a.num,b.num,c.num)&&ch(a.shape,b.shape,c.shape)&&ch(a.color,b.color,c.color)&&ch(a.fill,b.fill,c.fill); }
function loadDailySeed(){ const t=new Date(); dailySeed=t.getFullYear()*10000+(t.getMonth()+1)*100+t.getDate(); }

function generateBoard(){
  const deck = buildDeck(); let rng = mulberry32(dailySeed);
  while(true){
    const board = []; for(let i=0;i<12;i++) board.push(deck[Math.floor(rng()*deck.length)]);
    const found=[]; for(let i=0;i<12;i++) for(let j=i+1;j<12;j++) for(let k=j+1;k<12;k++) if(isSet(board[i],board[j],board[k])) found.push([i,j,k]);
    if(found.length===6){ cards=board; validSets=found; return; }
    dailySeed++; rng = mulberry32(dailySeed);
  }
}

function renderBoard(){
  const grid = document.getElementById('cardGrid'); grid.innerHTML=''; document.getElementById('foundCount').textContent=setsFound;
  cards.forEach((c,i)=>{
    const btn = document.createElement('div'); btn.className='cardTile';
    btn.dataset.index = i; btn.innerHTML = `<div style="font-weight:700">${numbers[c.num]}</div><div>${shapes[c.shape]}</div><div class="muted">${colors[c.color]} • ${fills[c.fill]}</div>`;
    btn.onclick = ()=> { btn.classList.add('pop'); setTimeout(()=>btn.classList.remove('pop'),220); selectCard(i); };
    grid.appendChild(btn);
  });
  document.getElementById('adminTools').style.display = (profile?.is_admin)?'block':'none';
  renderUserInfo();
}

function selectCard(i){
  const el = document.querySelector(`[data-index="${i}"]`); if(!el) return;
  if(selected.includes(i)){ selected = selected.filter(x=>x!==i); el.classList.remove('selected'); return; }
  if(selected.length < 3){ selected.push(i); el.classList.add('selected'); }
  if(selected.length === 3) checkSelected();
}

function checkSelected(){
  const chosen = selected.map(i=>cards[i]); const els = selected.map(i=>document.querySelector(`[data-index="${i}"]`)).filter(Boolean);
  if(isSet(...chosen)){
    els.forEach(e=>e.classList.add('correct'));
    setsFound++; document.getElementById('foundCount').textContent=setsFound;
    if(setsFound===6){ stopTimer(); onWin(); }
  } else els.forEach(e=>e.classList.add('wrong'));
  setTimeout(()=> els.forEach(e=>e.classList.remove('selected','wrong','correct')),700);
  selected = [];
}

/* ---------- Confetti + sound ---------- */
function fireConfetti(){
  // small canvas confetti (visual)
  const canvas = document.getElementById('confetti'); if(!canvas) return;
  const ctx = canvas.getContext('2d'); canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
  const pieces = []; const colorsArr=['#ff4757','#ffa502','#2ed573','#1e90ff','#9b59b6'];
  for(let i=0;i<110;i++) pieces.push({x:Math.random()*canvas.width,y:Math.random()*-canvas.height,vx:(Math.random()-0.5)*6,vy:Math.random()*6+2,size:Math.random()*8+4,color:colorsArr[Math.floor(Math.random()*colorsArr.length)]});
  let t=0; function frame(){ ctx.clearRect(0,0,canvas.width,canvas.height); pieces.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size*0.6); }); t++; if(t<180) requestAnimationFrame(frame); else ctx.clearRect(0,0,canvas.width,canvas.height); } requestAnimationFrame(frame);
  playConfettiSound();
}

/* simple confetti sound via WebAudio */
function playConfettiSound(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    for(let i=0;i<6;i++){
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = Math.random() > 0.5 ? 'sine' : 'square';
      o.frequency.setValueAtTime(600 + Math.random()*800, now + i*0.02);
      g.gain.setValueAtTime(0.02, now + i*0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i*0.02 + 0.18 + Math.random()*0.12);
      o.connect(g); g.connect(ctx.destination); o.start(now + i*0.02); o.stop(now + i*0.02 + 0.3 + Math.random()*0.3);
    }
  }catch(e){ /* ignore */ }
}

/* ---------- Win handler ---------- */
async function onWin(){
  document.getElementById('status').textContent="🎉 You found all 6 sets!";
  const seconds = elapsedSeconds || (startTime?Math.floor((Date.now()-startTime)/1000):0);
  document.getElementById('winDetail').textContent = `Great job, ${profile?.email || currentUser?.email || 'player'} — time: ${seconds}s`;
  document.getElementById('winOverlay').classList.remove('hidden'); document.getElementById('winOverlay').setAttribute('aria-hidden','false');
  fireConfetti();
  const overlaySave = document.getElementById('overlaySave'); overlaySave.disabled = false; overlaySave.dataset.seconds = seconds;
}

/* overlay buttons */
document.getElementById('overlayClose').addEventListener('click', ()=> { document.getElementById('winOverlay').classList.add('hidden'); document.getElementById('winOverlay').setAttribute('aria-hidden','true'); } );

/* share: generates an image and uses navigator.share if available */
document.getElementById('overlayShare').addEventListener('click', async ()=>{
  const seconds = document.getElementById('overlaySave').dataset.seconds || elapsedSeconds || 0;
  const canvas = document.getElementById('shareCanvas');
  canvas.width = 800; canvas.height = 420;
  const ctx = canvas.getContext('2d');
  // background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#0f1724';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // avatar
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = profile?.avatar_url || chosenAvatar;
  img.onload = async ()=>{
    ctx.drawImage(img, 40, 40, 120, 120);
    ctx.fillStyle = '#fff'; ctx.font = '36px Inter, Arial'; ctx.fillText('Daily Set — 6/6', 180, 80);
    ctx.font = '28px Inter, Arial'; ctx.fillText(`${profile?.email || currentUser?.email || 'Player'}`, 180, 120);
    ctx.font = '28px Inter, Arial'; ctx.fillText(`Time: ${seconds}s`, 180, 170);
    // small footer
    ctx.globalAlpha = .6; ctx.font = '16px Inter, Arial'; ctx.fillText('Play Daily Set', 40, canvas.height - 40);
    canvas.toBlob(async (blob)=>{
      if(navigator.canShare && navigator.canShare({ files: [new File([blob], 'dailyset.png', { type: 'image/png' })] })){
        try{
          await navigator.share({ files: [new File([blob], 'dailyset.png', { type: 'image/png' })], title: 'Daily Set Score', text: `I solved Daily Set in ${seconds}s!` });
          return;
        }catch(e){ console.warn('share failed', e); }
      }
      // fallback: open image in new tab
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }, 'image/png');
  };
  img.onerror = ()=> alert('Could not load avatar to create share image.');
});

/* overlaySave click handled later near submitScore */

/* ---------- Leaderboard / streaks / server ---------- */
async function submitScore(username, secondsTaken=0){
  const today = new Date().toISOString().split('T')[0];
  try{
    await supabase.from('leaderboard').insert([{ username, avatar_url: profile?.avatar_url || null, score:6, sets_found:6, seconds_taken: secondsTaken, game_date: today }]);
    await fetchLeaderboard();
  }catch(e){ console.warn('submitScore', e); alert('Failed to save score'); }
}

async function updateStreak(username){
  const today = new Date().toISOString().split('T')[0];
  try{
    const { data } = await supabase.from('streaks').select('*').eq('username', username).maybeSingle();
    if(!data){ await supabase.from('streaks').insert([{ username, last_played: today, streak_count: 1 }]); return 1; }
    const last = data.last_played;
    const diff = Math.floor((new Date(today) - new Date(last)) / (1000*60*60*24));
    let newStreak = 1;
    if(diff === 1) newStreak = data.streak_count + 1;
    else if(diff === 0) newStreak = data.streak_count;
    else newStreak = 1;
    await supabase.from('streaks').update({ streak_count: newStreak, last_played: today }).eq('username', username);
    return newStreak;
  }catch(e){ console.warn('updateStreak', e); return null; }
}

async function fetchLeaderboard(){
  try{
    const { data } = await supabase.from('leaderboard').select('*').order('seconds_taken',{ascending:true}).order('inserted_at',{ascending:true}).limit(50);
    animateLeaderboard(data || []);
    return data;
  }catch(e){ console.warn('fetchLeaderboard', e); return []; }
}

/* animated rendering of leaderboard with stagger */
function animateLeaderboard(rows){
  const ol = document.getElementById('leaderboardList'); if(!ol) return; ol.innerHTML='';
  rows.forEach((r,i)=>{
    const li = document.createElement('li'); li.className='lb-item';
    li.innerHTML = `${r.avatar_url?`<img src="${r.avatar_url}" class="avatarSmall">` : ''}<strong>${r.username}</strong> — <strong>${r.seconds_taken}s</strong> <span class="muted">(${new Date(r.inserted_at).toLocaleDateString()})</span>`;
    ol.appendChild(li);
    // stagger reveal
    setTimeout(()=> li.classList.add('visible'), 50 + i*70);
  });
}

/* admin helpers (same as previous) */
async function renderAdminLeaderboard(){ const container=document.getElementById('adminLeaderboard'); if(!container) return; container.innerHTML='Loading...'; try{ const { data } = await supabase.from('leaderboard').select('*').order('inserted_at',{ascending:false}).limit(200); container.innerHTML=''; data.forEach(row=>{ const d=document.createElement('div'); d.style.marginBottom='6px'; d.innerHTML = `${row.avatar_url?`<img src="${row.avatar_url}" class="avatarSmall">` : ''}<strong>${row.username}</strong> — ${row.seconds_taken}s <button onclick="adminDeleteScore(${row.id})" style="margin-left:8px;background:#e11d48">Delete</button>`; container.appendChild(d); }); }catch(e){ console.warn(e); container.innerHTML='<div class="muted">Failed</div>'; } }
window.adminDeleteScore = async function(id){ if(!confirm('Delete?')) return; try{ await supabase.from('leaderboard').delete().eq('id', id); renderAdminLeaderboard(); fetchLeaderboard(); }catch(e){ console.warn(e); alert('Delete failed'); } }

/* admin user list */
async function renderAdminUserList(){
  if(!profile?.is_admin) return;
  const container=document.getElementById('adminUserList'); if(!container) return; container.innerHTML='Loading users...';
  try{
    const { data } = await supabase.from('profiles').select('*').limit(200);
    container.innerHTML=''; data.forEach(u=>{ const row=document.createElement('div'); row.style.marginBottom='6px'; row.innerHTML = `${u.avatar_url ? `<img src="${u.avatar_url}" class="avatarSmall">` : ''}<strong>${u.email}</strong> Streak: ${u.streak || 0} <button style="margin-left:8px" onclick="adminResetPw('${u.email}')">Send reset</button>`; container.appendChild(row); });
  }catch(e){ console.warn(e); container.innerHTML='<div class="muted">Failed</div>'; }
}
window.adminResetPw = function(email){ if(!confirm(`Send password reset to ${email}?`)) return; supabase.auth.resetPasswordForEmail(email).then(()=> alert('Email sent')).catch(e=>{ console.warn(e); alert('Failed'); }); }

/* render user info */
function renderUserInfo(){
  const ui=document.getElementById('userInfo'); if(!ui) return;
  const avatar = profile?.avatar_url ? `<img src="${profile.avatar_url}" class="avatar">` : (currentUser?.user_metadata?.avatar ? `<img src="${currentUser.user_metadata.avatar}" class="avatar">` : '');
  const email = profile?.email || currentUser?.email || '';
  ui.innerHTML = `${avatar}<strong>${email}</strong>`;
  const si=document.getElementById('streakInfo'); if(si) si.textContent = profile ? `Streak: ${profile.streak || 0}` : '';
}

/* onSignedIn transition */
function onSignedIn(){
  document.getElementById('authCard').style.display='none'; document.getElementById('gameCard').style.display='';
  btnSignOut.style.display=''; btnSignIn.style.display='none'; btnSignUp.style.display='none';
  document.getElementById('btnShare').style.display=''; document.getElementById('btnSaveScore').style.display='';
  renderUserInfo(); fetchLeaderboard();
  supabase.from('profiles').upsert({ email: profile.email, avatar_url: profile.avatar_url || chosenAvatar }, { onConflict: ['email'] }).then(()=>{});
  startGame(!!profile?.is_admin);
}

/* admin keyboard toggle */
document.addEventListener('keydown',(e)=>{ if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='a'){ if(!profile?.is_admin){ alert('Admin only'); return; } adminMode=!adminMode; document.getElementById('adminTools').style.display = adminMode ? 'block' : 'none'; if(adminMode){ renderAdminUserList(); renderAdminLeaderboard(); } } });

/* startGame */
function startGame(isAdminFlag){
  adminMode=false; setsFound=0; loadDailySeed(); generateBoard(); renderBoard(); startTimer();
}

/* overlaySave click */
document.getElementById('overlaySave').addEventListener('click', async ()=>{
  if(!currentUser){ alert('Sign in first'); return; }
  const seconds = parseInt(document.getElementById('overlaySave').dataset.seconds || elapsedSeconds || 0);
  await submitScore(currentUser.email, seconds);
  const newStreak = await updateStreak(currentUser.email);
  profile = { ...(profile||{}), streak: newStreak };
  document.getElementById('streakInfo').textContent = `Streak: ${newStreak}`;
  alert('Saved! Streak: ' + newStreak);
  document.getElementById('winOverlay').classList.add('hidden');
});

/* admin UI buttons */
document.getElementById('btnRefreshLB').addEventListener('click', fetchLeaderboard);
document.getElementById('btnReroll').addEventListener('click', ()=>{ generateBoard(); renderBoard(); startTimer(); setsFound=0; });
document.getElementById('btnResetProgress').addEventListener('click', ()=>{ setsFound=0; renderBoard(); });
document.getElementById('btnHighlight').addEventListener('click', ()=>{ validSets.forEach(s=> s.forEach(i=> document.querySelector(`[data-index="${i}"]`)?.classList.add('highlighted'))); setTimeout(()=>document.querySelectorAll('.highlighted').forEach(x=>x.classList.remove('highlighted')),5000); });

/* initial load */
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    const { data } = await supabase.auth.getSession();
    if(data?.session?.user) { currentUser = data.session.user; await loadProfile(); onSignedIn(); }
  }catch(e){ console.warn(e); }
  fetchLeaderboard();
  setInterval(fetchLeaderboard, 60_000);
});
/* =========== end script.js =========== */
