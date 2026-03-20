/* ═══════════════════════════════════════════════════
SUPABASE AUTH — Google OAuth
═══════════════════════════════════════════════════ */
const _sb = supabase.createClient(
‘https://twxoddzogbmaysebhour.supabase.co’,
‘eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eG9kZHpvZ2JtYXlzZWJob3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk4MzgsImV4cCI6MjA4OTA3NTgzOH0.8xXiTS863_rtKOE3g2wDn7PdQVKCFj2hxhtnya3Wa5E’
);

async function getAuthHeaders() {
try {
const { data: refreshData } = await _sb.auth.refreshSession();
if (refreshData?.session?.access_token) {
return {
‘Content-Type’: ‘application/json’,
‘Authorization’: ’Bearer ’ + refreshData.session.access_token
};
}
} catch {}
const { data: { session } } = await _sb.auth.getSession();
const token = session?.access_token;
return token
? { ‘Content-Type’: ‘application/json’, ‘Authorization’: ’Bearer ’ + token }
: { ‘Content-Type’: ‘application/json’ };
}

async function apiFetch(url, opts = {}) {
opts.headers = opts.headers || await getAuthHeaders();
let resp = await fetch(url, opts);
if (resp.status === 401) {
try {
const { data } = await _sb.auth.refreshSession();
if (data?.session?.access_token) {
opts.headers = {
‘Content-Type’: ‘application/json’,
‘Authorization’: ’Bearer ’ + data.session.access_token
};
resp = await fetch(url, opts);
}
} catch {}
if (resp.status === 401) {
await _sb.auth.signOut();
_appUnlocked = false;
const loginScreen = document.getElementById(‘loginScreen’);
if (loginScreen) loginScreen.style.display = ‘flex’;
if (typeof showToast === ‘function’) {
showToast(‘Sessão expirada. Faça login novamente.’, ‘error’, 4000);
}
throw new Error(‘Sessão expirada. Faça login novamente.’);
}
}
return resp;
}

const _dbSync = {
async pushHistory() {
try {
const { data: { session } } = await _sb.auth.getSession();
if (!session?.user) return;
const userId = session.user.id;
const hist = safeJSON(STORAGE.historyKey, []);
if (!hist.length) return;
const rows = hist.map(s => ({
id: s.id,
user_id: userId,
session_data: s,
trained_at: s.createdAt || new Date().toISOString(),
synced_at: new Date().toISOString()
}));
await _sb.from(‘workout_history’).upsert(rows, { onConflict: ‘id’ });
} catch (e) {}
},
async pushConfig() {
try {
const { data: { session } } = await _sb.auth.getSession();
if (!session?.user) return;
const userId = session.user.id;
const config = safeJSON(‘titanpro_config’, {});
await _sb.from(‘profiles’).upsert({
id: userId,
config: config,
updated_at: new Date().toISOString()
}, { onConflict: ‘id’ });
} catch (e) {}
},
async pullAll(userId) {
try {
const { data: histRows } = await _sb
.from(‘workout_history’)
.select(‘session_data, trained_at’)
.eq(‘user_id’, userId)
.order(‘trained_at’, { ascending: false })
.limit(STORAGE.maxHistory);
if (histRows && histRows.length > 0) {
const localHist = safeJSON(STORAGE.historyKey, []);
const localIds = new Set(localHist.map(s => s.id));
const novas = histRows.map(r => r.session_data).filter(s => s && !localIds.has(s.id));
if (novas.length > 0) {
const merged = […localHist, …novas]
.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
.slice(0, STORAGE.maxHistory);
localStorage.setItem(STORAGE.historyKey, JSON.stringify(merged));
}
}
const { data: profile } = await _sb
.from(‘profiles’)
.select(‘config’)
.eq(‘id’, userId)
.single();
if (profile?.config && Object.keys(profile.config).length > 0) {
const localCfg = safeJSON(‘titanpro_config’, {});
if (!Object.keys(localCfg).length) {
localStorage.setItem(‘titanpro_config’, JSON.stringify(profile.config));
}
}
} catch (e) {}
}
};

let _authMenuOpen = false;
let _appUnlocked = false;

function showApp() {
if (_appUnlocked) return;
_appUnlocked = true;
document.getElementById(‘splashScreen’).style.display = ‘none’;
document.getElementById(‘loginScreen’).style.display = ‘none’;
}

function showLogin() {
document.getElementById(‘splashScreen’).style.display = ‘none’;
const login = document.getElementById(‘loginScreen’);
login.style.display = ‘flex’;
}

function updateAuthUI(user) {
const btn    = document.getElementById(‘authBtn’);
const label  = document.getElementById(‘authLabel’);
const avatar = document.getElementById(‘userAvatar’);
if (!btn) return;
if (user) {
const pic = user.user_metadata?.avatar_url || ‘’;
label.textContent = user.user_metadata?.name?.split(’ ’)[0] || ‘Conta’;
if (pic) { avatar.src = pic; avatar.style.display = ‘block’; }
btn.style.borderColor = ‘var(–accent)’;
const menuAvatar = document.getElementById(‘authMenuAvatar’);
if (menuAvatar && pic) menuAvatar.src = pic;
const menuName = document.getElementById(‘authMenuName’);
if (menuName) menuName.textContent = user.user_metadata?.full_name || user.email;
const menuEmail = document.getElementById(‘authMenuEmail’);
if (menuEmail) menuEmail.textContent = user.email;
} else {
label.textContent = ‘Entrar’;
avatar.style.display = ‘none’;
btn.style.borderColor = ‘’;
closeAuthMenu();
}
}

function handleAuthClick() {
_sb.auth.getSession().then(({ data: { session } }) => {
if (session?.user) toggleAuthMenu();
});
}

function handleAvatarUpload(event) {
const file = event.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = function(e) {
const dataUrl = e.target.result;
localStorage.setItem(‘userAvatarPhoto’, dataUrl);
applyAvatarPhoto(dataUrl);
};
reader.readAsDataURL(file);
}

function applyAvatarPhoto(dataUrl) {
const perfilEl = document.getElementById(‘perfilAvatar’);
const homeEl   = document.getElementById(‘homeCardAvatar’);
const navEl    = document.getElementById(‘userAvatar’);
if (perfilEl) {
perfilEl.style.backgroundImage = `url(${dataUrl})`;
perfilEl.style.backgroundSize  = ‘cover’;
perfilEl.style.backgroundPosition = ‘center’;
perfilEl.textContent = ‘’;
}
if (homeEl) {
homeEl.style.backgroundImage = `url(${dataUrl})`;
homeEl.style.backgroundSize  = ‘cover’;
homeEl.style.backgroundPosition = ‘center’;
homeEl.textContent = ‘’;
}
if (navEl) { navEl.src = dataUrl; navEl.style.display = ‘block’; }
}

let _loginIsRegister = false;

function showEmailLogin(isRegister) {
_loginIsRegister = !!isRegister;
const screen = document.getElementById(‘emailLoginScreen’);
screen.classList.add(‘show’);
document.getElementById(‘emailLoginBodyTitle’).textContent = isRegister ? ‘Criar conta’ : ‘Entrar na conta’;
document.getElementById(‘btnEmail’).textContent = isRegister ? ‘Criar conta’ : ‘Entrar’;
document.getElementById(‘loginToggleLabel’).textContent = isRegister ? ‘Já tenho conta’ : ‘Criar conta’;
document.getElementById(‘emailLoginHeaderTitle’).textContent = isRegister ? ‘Criar conta’ : ‘Login’;
document.getElementById(‘loginPassword’).placeholder = isRegister ? ‘Criar senha (mín. 6 caracteres)’ : ‘Senha (mínimo 6 caracteres)’;
document.getElementById(‘loginPassword’).autocomplete = isRegister ? ‘new-password’ : ‘current-password’;
document.getElementById(‘loginError’).textContent = ‘’;
document.getElementById(‘forgotPassLink’).style.display = isRegister ? ‘none’ : ‘block’;
}

function showEmailLoginRegister() { showEmailLogin(true); }
function hideEmailLogin() { document.getElementById(‘emailLoginScreen’).classList.remove(‘show’); }
function toggleLoginMode() { showEmailLogin(!_loginIsRegister); }

async function authSignInGoogle() {
try {
const { error } = await _sb.auth.signInWithOAuth({
provider: ‘google’,
options: {
redirectTo: window.location.origin + window.location.pathname
}
});
if (error) showToast(’Erro ao entrar com Google: ’ + error.message, ‘error’, 4000);
} catch(e) {
showToast(‘Erro ao entrar com Google.’, ‘error’, 4000);
}
}

async function authForgotPassword() {
const email = document.getElementById(‘loginEmail’).value.trim();
if (!email) { document.getElementById(‘loginError’).textContent = ‘Digite seu e-mail primeiro.’; return; }
const { error } = await _sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
if (error) { document.getElementById(‘loginError’).textContent = error.message; }
else {
document.getElementById(‘loginError’).style.color = ‘#22c55e’;
document.getElementById(‘loginError’).textContent = ‘E-mail de recuperação enviado!’;
}
}

async function authSignInEmail() {
const email = document.getElementById(‘loginEmail’).value.trim();
const password = document.getElementById(‘loginPassword’).value;
const errEl = document.getElementById(‘loginError’);
errEl.textContent = ‘’;
if (!email || !password) { errEl.textContent = ‘Preencha e-mail e senha.’; return; }
if (password.length < 6) { errEl.textContent = ‘Senha deve ter pelo menos 6 caracteres.’; return; }
const btn = document.getElementById(‘btnEmail’);
btn.textContent = ‘…’; btn.disabled = true;
try {
let result;
if (_loginIsRegister) {
result = await _sb.auth.signUp({ email, password });
if (result.error) throw result.error;
if (!result.data.session) {
result = await _sb.auth.signInWithPassword({ email, password });
if (result.error) throw result.error;
}
} else {
result = await _sb.auth.signInWithPassword({ email, password });
if (result.error) throw result.error;
}
if (result.data?.session) {
updateAuthUI(result.data.session.user);
hideEmailLogin();
showApp();
navTo(‘inicio’);
openHome();
_dbSync.pullAll(result.data.session.user.id);
}
} catch (e) {
errEl.style.color = ‘#f87171’;
errEl.textContent = e.message === ‘Invalid login credentials’
? ‘E-mail ou senha incorretos.’
: e.message;
} finally {
btn.textContent = _loginIsRegister ? ‘Criar conta’ : ‘Entrar’;
btn.disabled = false;
}
}

function toggleAuthMenu() {
const menu = document.getElementById(‘authMenu’);
if (!menu) return;
_authMenuOpen = !_authMenuOpen;
menu.style.display = _authMenuOpen ? ‘block’ : ‘none’;
}

function closeAuthMenu() {
_authMenuOpen = false;
const menu = document.getElementById(‘authMenu’);
if (menu) menu.style.display = ‘none’;
}

async function authSignOut() {
await _sb.auth.signOut();
closeAuthMenu();
_appUnlocked = false;
document.getElementById(‘loginScreen’).style.display = ‘flex’;
showToast(‘Saiu da conta.’, ‘success’, 3000);
}

document.addEventListener(‘click’, function(e) {
if (_authMenuOpen && !e.target.closest(’#authMenu’) && !e.target.closest(’#authBtn’)) {
closeAuthMenu();
}
});

_sb.auth.onAuthStateChange((_event, session) => {
updateAuthUI(session?.user || null);
if (session?.user) {
const firstLoad = !_appUnlocked;
showApp();
if (firstLoad) { navTo(‘inicio’); openHome(); }
_dbSync.pullAll(session.user.id);
} else if (_appUnlocked) {
_appUnlocked = false;
document.getElementById(‘loginScreen’).style.display = ‘flex’;
}
});

/* ═══════════════════════════════════════════════════
FIX: splash dura 2.5s para sincronizar com a animação CSS
(era 800ms — app abria antes do splash terminar)
═══════════════════════════════════════════════════ */
Promise.all([
_sb.auth.getSession(),
new Promise(r => setTimeout(r, 2500))
]).then(([{ data: { session } }]) => {
updateAuthUI(session?.user || null);
if (session?.user) { showApp(); navTo(‘inicio’); openHome(); }
else showLogin();
}).catch(() => {
// Fallback: se Supabase falhar, mostra login mesmo assim
showLogin();
});

/* Fallback de segurança: se após 4s o splash ainda estiver visível, força saída */
setTimeout(() => {
const splash = document.getElementById(‘splashScreen’);
if (splash && splash.style.display !== ‘none’) {
splash.style.display = ‘none’;
const login = document.getElementById(‘loginScreen’);
if (login && login.style.display !== ‘flex’) login.style.display = ‘flex’;
}
}, 4000)