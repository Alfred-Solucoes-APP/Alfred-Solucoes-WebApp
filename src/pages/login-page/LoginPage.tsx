import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { /*data,*/ error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // Login bem sucedido → redireciona para dashboard
    navigate("/dashboard");
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
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button type="submit" className="btnLogin" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {errorMsg && <p className="login-message text-red-500">{errorMsg}</p>}
    </div>
  );
}
