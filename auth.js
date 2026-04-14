// ============================================================
//  TaqwaSteps — Supabase Authentication
//  auth.js — Complete Auth System (Vanilla JS)
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL      = "YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";

// Load Supabase client (loaded via CDN in HTML)
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── HELPERS ──────────────────────────────────────────────────
function g(id)          { return document.getElementById(id); }
function show(id)       { const e = g(id); if (e) e.style.display = 'flex'; }
function hide(id)       { const e = g(id); if (e) e.style.display = 'none'; }
function showErr(id, m) { const e = g(id); if (e) { e.textContent = m; e.style.display = 'block'; } }
function clearErr(id)   { const e = g(id); if (e) { e.textContent = ''; e.style.display = 'none'; } }
function setBtn(id, txt, disabled) {
  const b = g(id);
  if (!b) return;
  b.textContent = txt;
  b.disabled = disabled;
}

// ── SESSION CHECK ─────────────────────────────────────────────
// Called on every page load — redirects appropriately
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();

  // On auth page (index.html / login page)
  if (document.body.dataset.page === 'auth') {
    if (session) {
      // Already logged in → go to app
      window.location.href = 'app.html';
    }
    // else — stay on auth page, attach listeners
    attachAuthListeners();
    handleOAuthCallback(); // handle Google redirect
    return;
  }

  // On app page (app.html)
  if (document.body.dataset.page === 'app') {
    if (!session) {
      window.location.href = 'index.html';
      return;
    }
    // Logged in — load user and render app
    await loadAndRenderUser(session.user);
  }
}

// ── LOAD USER PROFILE ─────────────────────────────────────────
async function loadAndRenderUser(authUser) {
  const { data: profile, error } = await sb
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error || !profile) {
    // Profile missing — might be new Google user
    showDobScreen(authUser);
    return;
  }

  // Merge auth + profile data
  const user = {
    id:       authUser.id,
    email:    authUser.email,
    name:     profile.name     || authUser.user_metadata?.full_name || 'Friend',
    dob:      profile.dob      || null,
    joined:   profile.created_at
  };

  // Hand off to app (defined in app.html's script)
  if (typeof window.onUserReady === 'function') {
    window.onUserReady(user);
  }
}

// ── SIGN UP ───────────────────────────────────────────────────
async function doSignUp() {
  clearErr('su-err');
  const name  = g('su-name')?.value.trim();
  const email = g('su-email')?.value.trim().toLowerCase();
  const pass  = g('su-pass')?.value;
  const dob   = g('su-dob')?.value;

  // Validation
  if (!name)                        return showErr('su-err', 'Please enter your name.');
  if (!email || !email.includes('@')) return showErr('su-err', 'Please enter a valid email.');
  if (!pass || pass.length < 8)     return showErr('su-err', 'Password must be at least 8 characters.');
  if (!dob)                         return showErr('su-err', 'Please enter your date of birth.');

  setBtn('su-btn', 'PLEASE WAIT…', true);

  // 1. Create auth user
  const { data: authData, error: authErr } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { full_name: name } }
  });

  if (authErr) {
    setBtn('su-btn', 'CREATE ACCOUNT · BISMILLAH', false);
    return showErr('su-err', authErr.message);
  }

  const userId = authData.user?.id;
  if (!userId) {
    setBtn('su-btn', 'CREATE ACCOUNT · BISMILLAH', false);
    return showErr('su-err', 'Signup failed. Please try again.');
  }

  // 2. Insert profile into users table
  const { error: dbErr } = await sb.from('users').insert({
    id:    userId,
    name,
    email,
    dob,
  });

  if (dbErr) {
    setBtn('su-btn', 'CREATE ACCOUNT · BISMILLAH', false);
    return showErr('su-err', 'Profile save failed: ' + dbErr.message);
  }

  setBtn('su-btn', 'CREATE ACCOUNT · BISMILLAH', false);

  // Show hadith modal then redirect
  showHadithModal(dob, function() {
    window.location.href = 'app.html';
  });
}

// ── SIGN IN ───────────────────────────────────────────────────
async function doSignIn() {
  clearErr('si-err');
  const email = g('si-email')?.value.trim().toLowerCase();
  const pass  = g('si-pass')?.value;

  if (!email || !email.includes('@')) return showErr('si-err', 'Please enter a valid email.');
  if (!pass)                          return showErr('si-err', 'Please enter your password.');

  setBtn('si-btn', 'SIGNING IN…', true);

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    setBtn('si-btn', 'SIGN IN · BISMILLAH', false);
    const msg = error.message.includes('Invalid')
      ? 'Incorrect email or password. Please try again.'
      : error.message;
    return showErr('si-err', msg);
  }

  setBtn('si-btn', 'SIGN IN · BISMILLAH', false);
  window.location.href = 'app.html';
}

// ── GOOGLE OAUTH ──────────────────────────────────────────────
async function doGoogleSignIn() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/index.html'
    }
  });
  if (error) showErr('si-err', error.message);
}

// Handle redirect back from Google
async function handleOAuthCallback() {
  const { data: { session }, error } = await sb.auth.getSession();
  if (!session || error) return;

  const user = session.user;

  // Check if profile exists
  const { data: profile } = await sb
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // New Google user — need DOB
    showDobScreen(user);
  } else {
    // Existing user → app
    window.location.href = 'app.html';
  }
}

// ── DOB SCREEN (for new Google users) ────────────────────────
function showDobScreen(authUser) {
  // Show a DOB collection overlay
  const overlay = g('dob-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.dataset.userId    = authUser.id;
    overlay.dataset.userEmail = authUser.email;
    overlay.dataset.userName  = authUser.user_metadata?.full_name || '';
  }
}

async function saveDobFromGoogle() {
  clearErr('dob-err');
  const overlay = g('dob-overlay');
  const dob     = g('dob-input')?.value;

  if (!dob) return showErr('dob-err', 'Please enter your date of birth.');

  const userId    = overlay.dataset.userId;
  const userEmail = overlay.dataset.userEmail;
  const userName  = overlay.dataset.userName;

  setBtn('dob-btn', 'SAVING…', true);

  const { error } = await sb.from('users').upsert({
    id:    userId,
    name:  userName,
    email: userEmail,
    dob,
  });

  if (error) {
    setBtn('dob-btn', 'CONTINUE · BISMILLAH', false);
    return showErr('dob-err', error.message);
  }

  setBtn('dob-btn', 'CONTINUE · BISMILLAH', false);

  showHadithModal(dob, function() {
    window.location.href = 'app.html';
  });
}

// ── HADITH MODAL (age 7 rule) ────────────────────────────────
function showHadithModal(dob, onOk) {
  const modal = g('hadith-modal');
  if (!modal) { onOk(); return; }

  const dobDate = new Date(dob);
  const start7  = new Date(dobDate);
  start7.setFullYear(start7.getFullYear() + 7);

  const mn   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const str  = start7.getDate() + ' ' + mn[start7.getMonth()] + ' ' + start7.getFullYear();
  const past = start7 <= new Date();
  const info = g('hadith-info');

  if (info) {
    info.textContent = past
      ? 'Your Salah history starts from ' + str + ' — when you turned 7. May Allah accept every prayer. 🤍'
      : 'You will reach age 7 on ' + str + '. TaqwaSteps will track your Salah from that day. 🤍';
  }

  modal.style.display = 'flex';
  modal._onOk = onOk;
}

// ── SIGN OUT ──────────────────────────────────────────────────
async function doSignOut() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// ── ATTACH LISTENERS ─────────────────────────────────────────
function attachAuthListeners() {
  // Tab switching
  g('tab-signin')?.addEventListener('click', function() {
    g('tab-signin').classList.add('active');
    g('tab-signup').classList.remove('active');
    g('panel-signin').style.display = 'flex';
    g('panel-signup').style.display = 'none';
  });
  g('tab-signup')?.addEventListener('click', function() {
    g('tab-signup').classList.add('active');
    g('tab-signin').classList.remove('active');
    g('panel-signup').style.display = 'flex';
    g('panel-signin').style.display = 'none';
  });
  g('go-signup')?.addEventListener('click', function() { g('tab-signup')?.click(); });
  g('go-signin')?.addEventListener('click', function() { g('tab-signin')?.click(); });

  // Sign in / Sign up
  g('si-btn')?.addEventListener('click', doSignIn);
  g('su-btn')?.addEventListener('click', doSignUp);
  g('si-pass')?.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSignIn(); });
  g('su-pass')?.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSignUp(); });

  // Google
  g('google-btn-si')?.addEventListener('click', doGoogleSignIn);
  g('google-btn-su')?.addEventListener('click', doGoogleSignIn);

  // Password show/hide
  attachPassToggle('si-pass', 'si-pass-eye');
  attachPassToggle('su-pass', 'su-pass-eye');

  // DOB overlay
  g('dob-btn')?.addEventListener('click', saveDobFromGoogle);

  // Hadith modal OK
  g('hadith-ok')?.addEventListener('click', function() {
    const modal = g('hadith-modal');
    if (!modal) return;
    modal.style.display = 'none';
    if (typeof modal._onOk === 'function') modal._onOk();
  });

  // Sign out (on app page)
  g('signout-btn')?.addEventListener('click', doSignOut);
}

function attachPassToggle(inputId, eyeId) {
  const eye = g(eyeId);
  if (!eye) return;
  eye.addEventListener('click', function() {
    const inp  = g(inputId);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    eye.textContent = show ? 'Hide' : 'Show';
    eye.style.opacity = show ? '0.85' : '0.45';
  });
}

// ── BOOT ──────────────────────────────────────────────────────
initAuth();
