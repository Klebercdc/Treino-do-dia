/* ═══════════════════════════════════════════════════
   TITAN PRO - SISTEMA DE AUTENTICAÇÃO (SUPABASE + GOOGLE)
   ═══════════════════════════════════════════════════ */

// Inicialização do Cliente Supabase
const _sb = supabase.createClient(
  'https://twxoddzogbmaysebhour.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eG9kZHpvZ2JtYXlzZWJob3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk4MzgsImV4cCI6MjA4OTA3NTgzOH0.8xXiTS863_rtKOE3g2wDn7PdQVKCFj2hxhtnya3Wa5E'
);

// Variáveis de Controle de Estado do App
let _authMenuOpen = false;
let _appUnlocked = false;
let _loginIsRegister = false;

/* ═══════════════════════════════════════════════════
   FUNÇÕES DE LOGIN SOCIAL (GOOGLE)
   ═══════════════════════════════════════════════════ */
async function authSignInGoogle() {
  try {
    const { data, error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redireciona o usuário de volta para o domínio oficial
        redirectTo: 'https://titanpro.app.br'
      }
    });
    if (error) throw error;
  } catch (e) {
    console.error("Erro Google Auth:", e.message);
    if (typeof showToast === 'function') showToast('Erro ao conectar com Google.', 'error');
  }
}

/* ═══════════════════════════════════════════════════
   GESTÃO DE TOKENS E HEADERS (API)
   ═══════════════════════════════════════════════════ */
async function getAuthHeaders() {
  try {
    const { data: refreshData } = await _sb.auth.refreshSession();
    if (refreshData?.session?.access_token) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + refreshData.session.access_token
      };
    }
  } catch {}
  
  const { data: { session } } = await _sb.auth.getSession();
  const token = session?.access_token;
  return token 
    ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    : { 'Content-Type': 'application/json' };
}

/* ═══════════════════════════════════════════════════
   SINCRONIZAÇÃO DE DADOS (BACKUP EM NUVEM)
   ═══════════════════════════════════════════════════ */
const _dbSync = {
  async pushHistory() {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;
      const hist = typeof safeJSON === 'function' ? safeJSON(STORAGE.historyKey, []) : JSON.parse(localStorage.getItem(STORAGE.historyKey) || '[]');
      if (!hist.length) return;

      const rows = hist.map(s => ({
        id: s.id,
        user_id: userId,
        session_data: s,
        trained_at: s.createdAt || new Date().toISOString(),
        synced_at: new Date().toISOString()
      }));
      await _sb.from('workout_history').upsert(rows, { onConflict: 'id' });
    } catch (e) { console.warn("Sync History Error", e); }
  },

  async pushConfig() {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session?.user) return;
      const config = localStorage.getItem('titanpro_config') || '{}';
      await _sb.from('profiles').upsert({
        id: session.user.id,
        config: JSON.parse(config),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) { console.warn("Sync Config Error", e); }
  },

  async pullAll(userId) {
    try {
      const { data: histRows } = await _sb.from('workout_history')
        .select('session_data, trained_at')
        .eq('user_id', userId)
        .order('trained_at', { ascending: false })
        .limit(50); // Ajuste conforme seu STORAGE.maxHistory

      if (histRows?.length > 0) {
        localStorage.setItem('titanpro_history', JSON.stringify(histRows.map(r => r.session_data)));
      }
    } catch (e) { console.warn("Pull Data Error", e); }
  }
};

/* ═══════════════════════════════════════════════════
   INTERFACE E NAVEGAÇÃO
   ═══════════════════════════════════════════════════ */
function showApp() {
  if (_appUnlocked) return;
  _appUnlocked = true;
  document.getElementById('splashScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'none';
}

function showLogin() {
  document.getElementById('splashScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

function updateAuthUI(user) {
  const btn = document.getElementById('authBtn');
  const label = document.getElementById('authLabel');
  const avatar = document.getElementById('userAvatar');
  if (!btn) return;

  if (user) {
    const pic = user.user_metadata?.avatar_url || '';
    label.textContent = user.user_metadata?.full_name?.split(' ')[0] || 'Conta';
    if (pic) { avatar.src = pic; avatar.style.display = 'block'; }
    btn.style.borderColor = 'var(--accent)';
  } else {
    label.textContent = 'Entrar';
    avatar.style.display = 'none';
    btn.style.borderColor = '';
  }
}

/* ═══════════════════════════════════════════════════
   LOGIN POR E-MAIL E SENHA
   ═══════════════════════════════════════════════════ */
async function authSignInEmail() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Preencha e-mail e senha.'; return; }
  
  const btn = document.getElementById('btnEmail');
  btn.textContent = '...'; btn.disabled = true;

  try {
    let result;
    if (_loginIsRegister) {
      result = await _sb.auth.signUp({ email, password });
      if (result.error) throw result.error;
    } else {
      result = await _sb.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
    }

    if (result.data?.session) {
      updateAuthUI(result.data.session.user);
      if (typeof hideEmailLogin === 'function') hideEmailLogin();
      showApp();
      _dbSync.pullAll(result.data.session.user.id);
    }
  } catch (e) {
    errEl.textContent = e.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : e.message;
  } finally {
    btn.textContent = _loginIsRegister ? 'Criar conta' : 'Entrar';
    btn.disabled = false;
  }
}

async function authSignOut() {
  await _sb.auth.signOut();
  _appUnlocked = false;
  location.reload(); // Recarrega para limpar estados da memória
}

/* ═══════════════════════════════════════════════════
   OBSERVADORES DE ESTADO (LISTENERS)
   ═══════════════════════════════════════════════════ */
_sb.auth.onAuthStateChange((event, session) => {
  updateAuthUI(session?.user || null);
  if (session?.user) {
    showApp();
    _dbSync.pullAll(session.user.id);
  } else {
    showLogin();
  }
});

// Checagem Inicial de Sessão
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await _sb.auth.getSession();
  updateAuthUI(session?.user || null);
  // Timer para o Splash Screen (mínimo 1.5s para visibilidade da marca)
  setTimeout(() => {
    if (session?.user) showApp();
    else showLogin();
  }, 1500);
});
