import { useState } from “react”;
import {
Zap, Mail, KeyRound, Eye, EyeOff,
LogIn, AlertCircle, ShieldCheck, ArrowRight
} from “lucide-react”;

export default function AuthScreen({ onAuth }) {
const [mode, setMode] = useState(“login”);
const [showPass, setShowPass] = useState(false);
const [email, setEmail] = useState(””);
const [password, setPassword] = useState(””);
const [error, setError] = useState(””);
const [loading, setLoading] = useState(false);

async function handleSubmit(e) {
e.preventDefault();
if (!email || !password) {
setError(“Preencha e-mail e senha.”);
return;
}
setLoading(true);
setError(””);
await new Promise(r => setTimeout(r, 900));
setLoading(false);
onAuth && onAuth();
}

const inputBase = {
width: “100%”,
background: “transparent”,
border: “none”,
borderBottom: “1px solid rgba(255,255,255,0.12)”,
padding: “12px 36px 12px 36px”,
color: “#fff”,
fontSize: 14,
outline: “none”,
transition: “border-color 0.2s”,
boxSizing: “border-box”,
letterSpacing: 0.3,
};

return (
<div style={{
minHeight: “100vh”,
background: “#0A0A0A”,
display: “flex”,
flexDirection: “column”,
alignItems: “center”,
justifyContent: “center”,
fontFamily: “‘Barlow’, ‘DM Sans’, sans-serif”,
padding: “40px 24px”,
}}>

```
  {/* ── LOGO ── */}
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
    <div style={{
      width: 52, height: 52, borderRadius: 16,
      background: "linear-gradient(135deg, #FF6B00, #FF9A3C)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 0 40px rgba(255,107,0,0.25)",
      marginBottom: 16,
    }}>
      <Zap size={26} color="#fff" fill="#fff" />
    </div>

    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: 28, fontWeight: 900, letterSpacing: 3,
        color: "#fff", fontFamily: "'Barlow Condensed', 'Barlow', sans-serif",
      }}>
        TITAN <span style={{ color: "#FF6B00" }}>PRO</span>
      </div>
      <div style={{
        fontSize: 12, color: "rgba(255,255,255,0.22)",
        letterSpacing: 2, marginTop: 4, textTransform: "uppercase",
      }}>
        Sistema de Gestão Fisiológica
      </div>

      {/* ── CHAMADA ATRATIVA ── */}
      <div style={{
        marginTop: 20,
        padding: "16px 20px",
        background: "rgba(255,107,0,0.07)",
        border: "1px solid rgba(255,107,0,0.18)",
        borderRadius: 14,
        maxWidth: 300,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 900, color: "#fff",
          lineHeight: 1.25, letterSpacing: -0.3,
          marginBottom: 8,
        }}>
          Treine com inteligência.<br />
          <span style={{ color: "#FF6B00" }}>Evolua com dados.</span>
        </div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.35)",
          lineHeight: 1.6,
        }}>
          O único app que combina treino, nutrição e IA em tempo real — tudo no seu bolso.
        </div>
      </div>
    </div>
  </div>

  {/* ── CARD ── */}
  <div style={{
    width: "100%",
    maxWidth: 360,
  }}>

    {/* Título do form */}
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 18, fontWeight: 800, color: "#fff",
        margin: "0 0 4px", letterSpacing: 0.3,
      }}>
        {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
      </h2>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", margin: 0 }}>
        {mode === "login"
          ? "Entre com seu e-mail e senha"
          : "Cadastre-se gratuitamente"}
      </p>
    </div>

    {/* ── FORM ── */}
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* E-mail */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>
          E-MAIL
        </label>
        <div style={{ position: "relative" }}>
          <Mail size={14} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ ...inputBase }}
            onFocus={e => e.target.style.borderBottomColor = "#FF6B00"}
            onBlur={e => e.target.style.borderBottomColor = "rgba(255,255,255,0.12)"}
          />
        </div>
      </div>

      {/* Senha */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>
          SENHA
        </label>
        <div style={{ position: "relative" }}>
          <KeyRound size={14} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type={showPass ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inputBase, paddingRight: 44 }}
            onFocus={e => e.target.style.borderBottomColor = "#FF6B00"}
            onBlur={e => e.target.style.borderBottomColor = "rgba(255,255,255,0.12)"}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            style={{
              position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.2)", padding: 0,
            }}
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Esqueci senha */}
      {mode === "login" && (
        <div style={{ textAlign: "right", marginTop: -16 }}>
          <button type="button" style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "rgba(255,107,0,0.6)",
            letterSpacing: 0.3,
          }}>
            Esqueci minha senha
          </button>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          color: "#EF4444", fontSize: 12,
          padding: "10px 14px",
          background: "rgba(239,68,68,0.07)",
          borderRadius: 10,
          border: "1px solid rgba(239,68,68,0.18)",
        }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: "15px",
          background: loading
            ? "rgba(255,107,0,0.45)"
            : "linear-gradient(135deg, #FF6B00, #FF9A3C)",
          border: "none",
          borderRadius: 14,
          cursor: loading ? "not-allowed" : "pointer",
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 0.8,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: loading ? "none" : "0 6px 28px rgba(255,107,0,0.28)",
          transition: "all 0.2s",
          marginTop: 4,
        }}
      >
        {loading
          ? <><Zap size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Entrando...</>
          : <><LogIn size={16} /> {mode === "login" ? "Entrar" : "Criar conta"}</>
        }
      </button>
    </form>

    {/* Trocar modo */}
    <div style={{ textAlign: "center", marginTop: 28, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
      {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
      <button
        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#FF6B00", fontWeight: 700, fontSize: 13,
        }}
      >
        {mode === "login" ? "Criar gratuitamente" : "Entrar"}
      </button>
    </div>

    {/* LGPD */}
    <div style={{
      textAlign: "center", marginTop: 40,
      fontSize: 10, color: "rgba(255,255,255,0.12)",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}>
      <ShieldCheck size={10} /> Protegido conforme a LGPD · titanpro.app.br
    </div>
  </div>

  <style>{`
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    input::placeholder { color: rgba(255,255,255,0.18); }
    * { box-sizing: border-box; }
  `}</style>
</div>
```

);
}
