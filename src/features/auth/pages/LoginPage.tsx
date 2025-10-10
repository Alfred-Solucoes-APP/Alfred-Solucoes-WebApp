import { useEffect, useState } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../../shared/services/supabase/client";
import { invokeFunction } from "../../../shared/services/supabase/functions";
import { collectDeviceMetadata } from "../../../shared/utils/device";
import { formatRateLimitError, toRateLimitError } from "../../../shared/utils/errors";

type RegisterLoginResponse = {
  status: "approved" | "pending";
  requiresConfirmation: boolean;
  device: {
    id: string;
    name: string | null;
    confirmedAt: string | null;
    lastSeenAt: string | null;
  };
};

export function LoginPage() {
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

      const deviceMetadata = collectDeviceMetadata();
      if (!deviceMetadata.deviceId) {
        setErrorMsg("Não conseguimos identificar este dispositivo. Verifique as permissões do navegador e tente novamente.");
        await supabase.auth.signOut();
        return;
      }

      const { data: securityData, error: securityError } = await invokeFunction<RegisterLoginResponse>(
        "registerLoginEvent",
        {
          body: {
            deviceId: deviceMetadata.deviceId,
            deviceName: deviceMetadata.deviceName,
            userAgent: deviceMetadata.userAgent,
            locale: deviceMetadata.locale,
            timezone: deviceMetadata.timezone,
            screen: deviceMetadata.screen,
          },
        },
      );

      if (securityError) {
        const rateLimitError = await toRateLimitError(securityError);
        if (rateLimitError) {
          setErrorMsg(formatRateLimitError(rateLimitError, "Muitas tentativas de login em sequência."));
        } else {
          setErrorMsg(securityError.message ?? "Não foi possível registrar o novo login.");
        }
        await supabase.auth.signOut();
        return;
      }

      if (!securityData) {
        setErrorMsg("Resposta inesperada ao registrar o login.");
        await supabase.auth.signOut();
        return;
      }

      if (securityData.status !== "approved" || securityData.requiresConfirmation) {
        navigate("/device-verification", {
          replace: true,
          state: {
            nextPath: destination,
            message: "Precisamos confirmar este dispositivo antes de liberar o acesso.",
            deviceId: deviceMetadata.deviceId,
          },
        });
        return;
      }

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
      <button
        type="button"
        className="login-back-button"
        onClick={() => navigate("/")}
        aria-label="Voltar para a página inicial"
      >
        Voltar para a página inicial
      </button>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="password-input-wrapper">
          <input
            type={mostrarSenha ? "text" : "password"}
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="password-field"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={toggleMostrarSenha}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            className="password-toggle-button"
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

export default LoginPage;
