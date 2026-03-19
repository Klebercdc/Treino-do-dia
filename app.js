/* ═══════════════════════════════════════════════════
   TITAN PRO - CORE DE AUTENTICAÇÃO E CONEXÃO IA
   ═══════════════════════════════════════════════════ */

// Inicialização Global do Supabase
const _sb = supabase.createClient(
  'https://twxoddzogbmaysebhour.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eG9kZHpvZ2JtYXlzZWJob3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk4MzgsImV4cCI6MjA4OTA3NTgzOH0.8xXiTS863_rtKOE3g2wDn7PdQVKCFj2hxhtnya3Wa5E'
);

// Controle de telas
let _appUnlocked = false;

/* ═══════════════════════════════════════════════════
   O MOTOR DA IA (apiFetch) - RESOLVE O ERRO
   ═══════════════════════════════════════════════════ */
async function apiFetch(url, opts = {}) {
  // 1. Busca os headers de segurança
  opts.headers = opts.headers || await getAuthHeaders();
  
  // 2. Faz a chamada para o Groq/IA
  let resp = await fetch(url, opts);

  // 3. Se o token expirou (401), tenta renovar automaticamente
  if (resp.status === 401) {
    try {
      const { data } = await _sb.auth.refreshSession();
      if (data?.session?.access_token) {
        opts.headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + data.session.access_token
        };
        resp = await fetch(url, opts); // Tenta de novo
      }
    } catch (e) { console.error("Erro no refresh da sessão"); }

    if (resp.status === 401) {
      await _sb.auth.signOut();
      location.reload(); 
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  }
  return resp;
}

/* ═══════════════════════════════════════════════════
   LOGINS: GOOGLE E E-MAIL
   ═══════════════════════════════════════════════════ */

// Login com Google
async function authSignInGoogle() {
  try {
    const { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://titanpro.app.br' }
    });
    if (error) throw error;
  } catch (e) {
    console.error("Erro Google:", e.message);
    if (typeof showToast === 'function') showToast('Erro ao conectar com Google.', 'error');
  }
}

// Login/Cadastro com E-mail
async function authSignInEmail() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.textContent = '';

  if (!email || !password) { if(errEl) errEl.textContent = 'Preencha tudo.'; return; }

  try {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.session) {
      location.reload(); // Recarrega para entrar no app
    }
  } catch (e) {
    if(errEl) errEl.textContent = e.message === 'Invalid login credentials' ? 'Dados incorretos.' : e.message;
  }
}

async function getAuthHeaders() {
  const { data: { session } } = await _sb.auth.getSession();
  const token = session?.access_token;
  return token 
    ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    : { 'Content-Type': 'application/json' };
}

/* ═══════════════════════════════════════════════════
   SINCRONIZAÇÃO DE DADOS (BACKUP)
   ═══════════════════════════════════════════════════ */
const _dbSync = {
  async pushHistory() {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session?.user) return;
      // Fallback caso STORAGE não esteja carregado
      const key = (typeof STORAGE !== 'undefined') ? STORAGE.historyKey : 'titanpro_history_v2';
      const hist = JSON.parse(localStorage.getItem(key) || '[]');
      if (!hist.length) return;

      const rows = hist.map(s => ({
        id: s.id,
        user_id: session.user.id,
        session_data: s,
        trained_at: s.createdAt || new Date().toISOString()
      }));
      await _sb.from('workout_history').upsert(rows, { onConflict: 'id' });
    } catch (e) { console.warn("Erro no Sync"); }
  },

  async pullAll(userId) {
    try {
      const { data: histRows } = await _sb.from('workout_history')
        .select('session_data')
        .eq('user_id', userId)
        .order('trained_at', { ascending: false }).limit(50);

      if (histRows?.length > 0) {
        const key = (typeof STORAGE !== 'undefined') ? STORAGE.historyKey : 'titanpro_history_v2';
        localStorage.setItem(key, JSON.stringify(histRows.map(r => r.session_data)));
      }
    } catch (e) { console.warn("Erro no Pull"); }
  }
};

/* ═══════════════════════════════════════════════════
   MONITORAMENTO DE SESSÃO
   ═══════════════════════════════════════════════════ */
_sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    if (typeof updateAuthUI === 'function') updateAuthUI(session.user);
    if (typeof showApp === 'function') showApp();
    _dbSync.pullAll(session.user.id);
  } else {
    if (typeof showLogin === 'function') showLogin();
  }
});

// Checagem ao carregar a página
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await _sb.auth.getSession();
  if (session?.user) {
    if (typeof showApp === 'function') showApp();
  } else {
    if (typeof showLogin === 'function') showLogin();
  }
});
