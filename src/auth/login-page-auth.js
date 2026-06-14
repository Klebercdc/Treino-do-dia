(function () {
  'use strict';

  var SUPABASE_URL = 'https://twxoddzogbmaysebhour.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eG9kZHpvZ2JtYXlzZWJob3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk4MzgsImV4cCI6MjA4OTA3NTgzOH0.8xXiTS863_rtKOE3g2wDn7PdQVKCFj2hxhtnya3Wa5E';

  var _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── UI helpers ──────────────────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  function showErro(msg) {
    var e = el('erro');
    if (!e) return;
    e.textContent = msg || '';
    e.style.display = msg ? 'block' : 'none';
  }

  function showInfo(msg) {
    var e = el('info');
    if (!e) return;
    e.textContent = msg || '';
    e.style.display = msg ? 'block' : 'none';
  }

  function setLoadingEntrar(on) {
    var btn = el('btnEntrar');
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? 'Entrando…' : 'Entrar na conta';
  }

  function setLoadingRecuperar(on) {
    var btn = el('btnRecuperar');
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? 'Enviando…' : 'Enviar link de recuperação';
  }

  // ── Seções ──────────────────────────────────────────────────────────────────

  window.irParaRecuperar = function () {
    showErro('');
    showInfo('');
    var login = el('loginSection');
    var rec = el('recoverySection');
    if (login) login.style.display = 'none';
    if (rec) rec.style.display = '';
    var emailRec = el('emailRecuperar');
    if (emailRec) emailRec.focus();
  };

  window.voltarLogin = function () {
    showErro('');
    showInfo('');
    var login = el('loginSection');
    var rec = el('recoverySection');
    if (login) login.style.display = '';
    if (rec) rec.style.display = 'none';
    var emailInput = el('email');
    if (emailInput) emailInput.focus();
  };

  // ── Login ───────────────────────────────────────────────────────────────────

  window.entrar = async function () {
    showErro('');

    var email = (el('email').value || '').trim();
    var senha = (el('senha').value || '').trim();

    if (!email || !senha) {
      showErro('Preencha email e senha.');
      return;
    }

    setLoadingEntrar(true);
    try {
      var result = await _sb.auth.signInWithPassword({ email: email, password: senha });
      if (result.error) {
        showErro('Email ou senha incorretos.');
        return;
      }
      window.location.replace('/');
    } catch (err) {
      showErro('Erro de conexão. Tente novamente.');
      console.warn('[login] signInWithPassword falhou:', err);
    } finally {
      setLoadingEntrar(false);
    }
  };

  // ── Recuperação de senha ─────────────────────────────────────────────────────

  window.recuperarSenha = async function () {
    showErro('');
    showInfo('');

    var email = (el('emailRecuperar').value || '').trim();
    if (!email) {
      showErro('Digite seu email.');
      return;
    }

    setLoadingRecuperar(true);
    try {
      var result = await _sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/'
      });
      if (result.error) {
        showErro('Não consegui enviar. Verifique o email e tente novamente.');
      } else {
        showErro('');
        showInfo('Link enviado! Verifique sua caixa de entrada.');
      }
    } catch (err) {
      showErro('Erro de conexão. Tente novamente.');
      console.warn('[login] resetPasswordForEmail falhou:', err);
    } finally {
      setLoadingRecuperar(false);
    }
  };

  // ── Tecla Enter ─────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    function onKeyEnter(e) {
      if (e.key !== 'Enter') return;
      var recVisible = el('recoverySection') && el('recoverySection').style.display !== 'none';
      if (recVisible) {
        window.recuperarSenha();
      } else {
        window.entrar();
      }
    }

    ['email', 'senha', 'emailRecuperar'].forEach(function (id) {
      var input = el(id);
      if (input) input.addEventListener('keydown', onKeyEnter);
    });
  });
})();
