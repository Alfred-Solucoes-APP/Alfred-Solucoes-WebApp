import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { message?: string } | null | undefined;
    if (state?.message) {
      setInfoMsg(state.message);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const toggleMostrarSenha = () => {
    setMostrarSenha((prev) => !prev);
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error || !data.user) {
        setErrorMsg(error?.message ?? "Não foi possível realizar o login");
        return;
      }

      const roleFromUserMetadata = (data.user.user_metadata as Record<string, unknown> | null | undefined)?.role;
      const roleFromAppMetadata = (data.user.app_metadata as Record<string, unknown> | null | undefined)?.role;
      const role = (roleFromUserMetadata ?? roleFromAppMetadata) as string | undefined;

      const destination = role === "admin" ? "/admin" : "/dashboard";
      navigate(destination, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao entrar";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container text-center">
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div style={{ position: "relative", width: "100%" }}>
          <input
            type={mostrarSenha ? "text" : "password"}
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            style={{ paddingRight: "2.5rem" }}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={toggleMostrarSenha}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            style={{
              position: "absolute",
              top: "50%",
              right: "0.75rem",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4b5563",
            }}
          >
            {mostrarSenha ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
          </button>
        </div>
        <button type="submit" className="btnLogin" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <button
          type="button"
          className="login-recovery-button"
          onClick={() => navigate("/forgot-password")}
          disabled={loading}
        >
          Esqueci minha senha
        </button>
      </form>

      {errorMsg && <p className="login-message text-red-500">{errorMsg}</p>}
      {!errorMsg && infoMsg && (
        <p
          className="login-message"
          style={{
            background: "rgba(34, 197, 94, 0.18)",
            border: "1px solid rgba(34, 197, 94, 0.32)",
            color: "#bbf7d0",
          }}
        >
          {infoMsg}
        </p>
      )}
    </div>
  );
}
