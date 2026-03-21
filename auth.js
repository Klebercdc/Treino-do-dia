/* ═══════════════════════════════════════════════════
   SUPABASE AUTH — Google OAuth
═══════════════════════════════════════════════════ */
const _sb = supabase.createClient(
  'https://twxoddzogbmaysebhour.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eG9kZHpvZ2JtYXlzZWJob3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk4MzgsImV4cCI6MjA4OTA3NTgzOH0.8xXiTS863_rtKOE3g2wDn7PdQVKCFj2hxhtnya3Wa5E'
);

// ══════════════════════════════════════════════════════
// TOKEN DE AUTENTICAÇÃO — enviado em todas as chamadas à API
// ══════════════════════════════════════════════════════
async function getAuthHeaders() {
  const { data: { session } } = await _sb.auth.getSession();
  const token = session?.access_token;
  return token
    ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    : { 'Content-Type': 'application/json' };
}

/**
 * Wrapper de fetch com tratamento automático de falha de token (401).
 * Em caso de 401: força refresh da sessão e tenta uma vez mais.
 * Se ainda 401 após retry (sessão expirada), faz logout e exibe aviso.
 */
async function apiFetch(url, opts = {}) {
  opts.headers = opts.headers || await getAuthHeaders();
  let resp = await fetch(url, opts);

  if (resp.status === 401) {
    // Força refresh e tenta novamente
    try {
      const { data } = await _sb.auth.refreshSession();
      if (data?.session?.access_token) {
        opts.headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + data.session.access_token
        };
        resp = await fetch(url, opts);
      }
    } catch {}

    // Se ainda 401, sessão inválida — logout automático
    if (resp.status === 401) {
      await _sb.auth.signOut();
      _appUnlocked = false;
      const loginScreen = document.getElementById('loginScreen');
      if (loginScreen) loginScreen.style.display = 'flex';
      if (typeof showToast === 'function') {
        showToast('Sessão expirada. Faça login novamente.', 'error', 4000);
      }
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  }

  return resp;
}

// ══════════════════════════════════════════════════════
// SINCRONIZAÇÃO COM SUPABASE (backup em nuvem)
// ══════════════════════════════════════════════════════
const _dbSync = {
  // Envia histórico de treinos para o banco em background
  async pushHistory() {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;
      const hist = safeJSON(STORAGE.historyKey, []);
      if (!hist.length) return;
      // Upsert: envia cada sessão nova (usa id como chave única)
      const rows = hist.map(s => ({
        id: s.id,
        user_id: userId,
        session_data: s,
        trained_at: s.createdAt || new Date().toISOString(),
        synced_at: new Date().toISOString()
      }));
      await _sb.from('workout_history').upsert(rows, { onConflict: 'id' });
    } catch (e) { /* sync é silencioso — não interrompe o usuário */ }
  },

  // Envia perfil/config do usuário para o banco em background
  async pushConfig() {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;
      const config = safeJSON('kronia_config', {});
      await _sb.from('profiles').upsert({
        id: userId,
        config: config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) { /* silencioso */ }
  },

  // Ao fazer login: puxa dados do banco e mescla com localStorage
  async pullAll(userId) {
    try {
      // Puxa histórico
      const { data: histRows } = await _sb
        .from('workout_history')
        .select('session_data, trained_at')
        .eq('user_id', userId)
        .order('trained_at', { ascending: false })
        .limit(STORAGE.maxHistory);

      if (histRows && histRows.length > 0) {
        const localHist = safeJSON(STORAGE.historyKey, []);
        const localIds = new Set(localHist.map(s => s.id));
        const novas = histRows
          .map(r => r.session_data)
          .filter(s => s && !localIds.has(s.id));
        if (novas.length > 0) {
          const merged = [...localHist, ...novas]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, STORAGE.maxHistory);
          localStorage.setItem(STORAGE.historyKey, JSON.stringify(merged));
        }
      }

      // Puxa config/perfil
      const { data: profile } = await _sb
        .from('profiles')
        .select('config')
        .eq('id', userId)
        .single();

      if (profile?.config && Object.keys(profile.config).length > 0) {
        const localCfg = safeJSON('kronia_config', {});
        // Nuvem tem prioridade apenas se local estiver vazio
        if (!Object.keys(localCfg).length) {
          localStorage.setItem('kronia_config', JSON.stringify(profile.config));
        }
      }
    } catch (e) { /* silencioso */ }
  }
};

let _authMenuOpen = false;
let _appUnlocked = false;

function hideSplash() {
  const el = document.getElementById('splashScreen');
  if (!el || el.style.display === 'none') return;
  el.style.animation = 'splashAutoHide 0.4s ease forwards';
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function showApp() {
  if (_appUnlocked) return;
  _appUnlocked = true;
  hideSplash();
  document.getElementById('loginScreen').style.display = 'none';
}

function showLogin() {
  hideSplash();
  const login = document.getElementById('loginScreen');
  login.style.display = 'flex';
}

function updateAuthUI(user) {
  const btn    = document.getElementById('authBtn');
  const label  = document.getElementById('authLabel');
  const avatar = document.getElementById('userAvatar');
  if (!btn) return;
  if (user) {
    const pic = user.user_metadata?.avatar_url || '';
    label.textContent = user.user_metadata?.name?.split(' ')[0] || 'Conta';
    if (pic) { avatar.src = pic; avatar.style.display = 'block'; }
    btn.style.borderColor = 'var(--accent)';
    const menuAvatar = document.getElementById('authMenuAvatar');
    if (menuAvatar && pic) menuAvatar.src = pic;
    const menuName = document.getElementById('authMenuName');
    if (menuName) menuName.textContent = user.user_metadata?.full_name || user.email;
    const menuEmail = document.getElementById('authMenuEmail');
    if (menuEmail) menuEmail.textContent = user.email;
  } else {
    label.textContent = 'Entrar';
    avatar.style.display = 'none';
    btn.style.borderColor = '';
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
    localStorage.setItem('userAvatarPhoto', dataUrl);
    applyAvatarPhoto(dataUrl);
  };
  reader.readAsDataURL(file);
}

function applyAvatarPhoto(dataUrl) {
  const perfilEl = document.getElementById('perfilAvatar');
  const homeEl   = document.getElementById('homeCardAvatar');
  const navEl    = document.getElementById('userAvatar');
  if (perfilEl) {
    perfilEl.style.backgroundImage = `url(${dataUrl})`;
    perfilEl.style.backgroundSize  = 'cover';
    perfilEl.style.backgroundPosition = 'center';
    perfilEl.textContent = '';
  }
  if (homeEl) {
    homeEl.style.backgroundImage = `url(${dataUrl})`;
    homeEl.style.backgroundSize  = 'cover';
    homeEl.style.backgroundPosition = 'center';
    homeEl.textContent = '';
  }
  if (navEl) { navEl.src = dataUrl; navEl.style.display = 'block'; }
}

let _loginIsRegister = false;

function showEmailLogin(isRegister) {
  _loginIsRegister = !!isRegister;
  const screen = document.getElementById('emailLoginScreen');
  screen.classList.add('show');
  document.getElementById('emailLoginBodyTitle').textContent = isRegister ? 'Criar conta' : 'Entrar na conta';
  document.getElementById('btnEmail').textContent = isRegister ? 'Criar conta' : 'Entrar';
  document.getElementById('loginToggleLabel').textContent = isRegister ? 'Já tenho conta' : 'Criar conta';
  document.getElementById('emailLoginHeaderTitle').textContent = isRegister ? 'Criar conta' : 'Login';
  document.getElementById('loginPassword').placeholder = isRegister ? 'Criar senha (mín. 6 caracteres)' : 'Senha (mínimo 6 caracteres)';
  document.getElementById('loginPassword').autocomplete = isRegister ? 'new-password' : 'current-password';
  document.getElementById('loginError').textContent = '';
  document.getElementById('forgotPassLink').style.display = isRegister ? 'none' : 'block';
}

function showEmailLoginRegister() {
  showEmailLogin(true);
}

function hideEmailLogin() {
  document.getElementById('emailLoginScreen').classList.remove('show');
}

function toggleLoginMode() {
  showEmailLogin(!_loginIsRegister);
}

async function authForgotPassword() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { document.getElementById('loginError').textContent = 'Digite seu e-mail primeiro.'; return; }
  const { error } = await _sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  if (error) { document.getElementById('loginError').textContent = error.message; }
  else { document.getElementById('loginError').style.color = '#22c55e'; document.getElementById('loginError').textContent = 'E-mail de recuperação enviado!'; }
}

async function authSignInEmail() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Preencha e-mail e senha.'; return; }
  if (password.length < 6) { errEl.textContent = 'Senha deve ter pelo menos 6 caracteres.'; return; }

  const btn = document.getElementById('btnEmail');
  btn.textContent = '...'; btn.disabled = true;

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
  } catch (e) {
    errEl.style.color = '#f87171';
    errEl.textContent = e.message === 'Invalid login credentials'
      ? 'E-mail ou senha incorretos.'
      : e.message;
  } finally {
    btn.textContent = _loginIsRegister ? 'Criar conta' : 'Entrar';
    btn.disabled = false;
  }
}

async function authSignInGoogle() {
  const btn = document.getElementById('btnGoogle');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }
  try {
    const { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      const errEl = document.getElementById('loginError');
      if (errEl) { errEl.style.color = '#f87171'; errEl.textContent = error.message; }
      else alert('Erro Google: ' + error.message);
    }
    // Se OK, Supabase redireciona — não precisa fazer nada
  } catch(e) {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    alert('Erro ao conectar com Google: ' + e.message);
  }
}

function toggleAuthMenu() {
  const menu = document.getElementById('authMenu');
  if (!menu) return;
  _authMenuOpen = !_authMenuOpen;
  menu.style.display = _authMenuOpen ? 'block' : 'none';
}

function closeAuthMenu() {
  _authMenuOpen = false;
  const menu = document.getElementById('authMenu');
  if (menu) menu.style.display = 'none';
}

async function authSignOut() {
  await _sb.auth.signOut();
  closeAuthMenu();
  _appUnlocked = false;
  document.getElementById('loginScreen').style.display = 'flex';
  showToast('Saiu da conta.', 'success', 3000);
}

document.addEventListener('click', function(e) {
  if (_authMenuOpen && !e.target.closest('#authMenu') && !e.target.closest('#authBtn')) {
    closeAuthMenu();
  }
});

// Splash: imagem estática tela cheia

// Ouvir mudanças de sessão
_sb.auth.onAuthStateChange((_event, session) => {
  updateAuthUI(session?.user || null);
  if (session?.user) {
    const firstLoad = !_appUnlocked;
    showApp();
    if (firstLoad) { navTo('inicio'); openHome(); }
    // Puxa dados da nuvem ao logar (fire & forget)
    _dbSync.pullAll(session.user.id);
  } else if (_appUnlocked) {
    _appUnlocked = false;
    document.getElementById('loginScreen').style.display = 'flex';
  }
});

// Checar sessão ao carregar — após splash (mín 2.5s)
Promise.all([
  _sb.auth.getSession(),
  new Promise(r => setTimeout(r, 800))
]).then(([{ data: { session } }]) => {
  updateAuthUI(session?.user || null);
  if (session?.user) { showApp(); navTo('inicio'); openHome(); }
  else showLogin();
}).catch(() => {
  showLogin();
});