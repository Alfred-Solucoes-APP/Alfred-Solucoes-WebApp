import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../../shared/services/supabase/client";
import { invokeFunction } from "../../../shared/services/supabase/functions";
import { collectDeviceMetadata, ensureDeviceId } from "../../../shared/utils/device";
import { useAuth } from "../../../shared/state/auth/context";
import { formatRateLimitError, toRateLimitError } from "../../../shared/utils/errors";

const POLL_INTERVAL_MS = 5000;

type DeviceStatusResponse = {
  status: "approved" | "pending" | "unregistered";
  requiresConfirmation: boolean;
  device?: {
    id: string;
    name: string | null;
    confirmedAt: string | null;
    lastSeenAt: string | null;
  };
};

type LocationState = {
  nextPath?: string;
  message?: string;
  deviceId?: string;
};

export function DeviceVerificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};

  const [deviceId, setDeviceId] = useState<string | null>(state.deviceId ?? null);
  const [status, setStatus] = useState<DeviceStatusResponse["status"]>("pending");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string>(
    state.message
      ?? "Enviamos um e-mail para confirmar este dispositivo. Abra a mensagem e finalize a verificação para continuar."
  );
  const [resendLoading, setResendLoading] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  const nextPath = useMemo(() => state.nextPath ?? "/dashboard", [state.nextPath]);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    if (!deviceId) {
      return;
    }
    try {
      const { data, error: fnError } = await invokeFunction<DeviceStatusResponse>("checkDeviceStatus", {
        body: { deviceId },
      });

      if (fnError) {
        const rateLimitError = await toRateLimitError(fnError);
        if (rateLimitError) {
          setError(formatRateLimitError(rateLimitError, "Muitas verificações em sequência."));
          return;
        }
        setError(fnError.message ?? "Não foi possível verificar o dispositivo.");
        return;
      }

      if (!data) {
        setError("Resposta vazia ao verificar o dispositivo.");
        return;
      }

      setStatus(data.status);
      if (data.status === "approved") {
        setError(null);
        setInfo("Dispositivo confirmado. Redirecionando...");
        clearPollTimer();
        setTimeout(() => {
          navigate(nextPath, { replace: true, state: null });
        }, 1500);
      } else if (data.status === "unregistered") {
        setError("Não encontramos este dispositivo. Faça login novamente para solicitar uma nova verificação.");
        clearPollTimer();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao verificar o dispositivo.";
      setError(message);
    }
  }, [clearPollTimer, deviceId, navigate, nextPath]);

  useEffect(() => {
    const ensuredDeviceId = state.deviceId ?? ensureDeviceId();
    if (ensuredDeviceId) {
      setDeviceId(ensuredDeviceId);
    }
    const metadata = collectDeviceMetadata();
    if (!metadata.deviceId && ensuredDeviceId) {
      setDeviceId(ensuredDeviceId);
    }
  }, [state.deviceId]);

  useEffect(() => {
    if (!deviceId) {
      setError("Não conseguimos identificar este dispositivo. Verifique as permissões do navegador e tente novamente.");
      return undefined;
    }

    checkStatus();
    pollTimerRef.current = window.setInterval(checkStatus, POLL_INTERVAL_MS);

    return () => {
      clearPollTimer();
    };
  }, [checkStatus, clearPollTimer, deviceId]);

  const handleResend = useCallback(async () => {
    if (!deviceId) {
      return;
    }
    setResendLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await invokeFunction<DeviceStatusResponse>("checkDeviceStatus", {
        body: { deviceId, resend: true },
      });
      if (fnError) {
        const rateLimitError = await toRateLimitError(fnError);
        if (rateLimitError) {
          setError(formatRateLimitError(rateLimitError, "Aguarde um instante antes de reenviar."));
          return;
        }
        setError(fnError.message ?? "Não foi possível reenviar.");
        return;
      }

      if (data?.status === "approved") {
        setStatus("approved");
        setInfo("Dispositivo confirmado. Redirecionando...");
        clearPollTimer();
        setTimeout(() => navigate(nextPath, { replace: true, state: null }), 1500);
      } else {
        setInfo("Um novo e-mail de confirmação foi enviado.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao reenviar.";
      setError(message);
    } finally {
      setResendLoading(false);
    }
  }, [clearPollTimer, deviceId, navigate, nextPath]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    clearPollTimer();
    navigate("/login", { replace: true });
  }, [clearPollTimer, navigate]);

  const maskedEmail = useMemo(() => {
    if (!user?.email) return "seu e-mail";
    const [name, domain] = user.email.split("@");
    if (!domain) return user.email;
    const visible = name.slice(0, 2);
    return `${visible}***@${domain}`;
  }, [user?.email]);

  return (
    <div className="device-verification-page">
      <header className="device-verification-header">
        <h1>Confirme seu dispositivo</h1>
        <p>
          Para proteger sua conta, precisamos confirmar que este dispositivo pertence a você. Verifique o e-mail enviado
          para <strong>{maskedEmail}</strong> e siga as instruções.
        </p>
      </header>

      <section className="device-verification-card">
        <p className="device-verification-status">
          {info}
        </p>
        {status !== "approved" && (
          <>
            <p className="device-verification-hint">
              Abra o e-mail "Confirme o novo dispositivo" e clique no botão de confirmação. Assim que finalizarmos a
              validação, você será redirecionado automaticamente.
            </p>
            <button
              type="button"
              className="device-verification-resend"
              onClick={handleResend}
              disabled={resendLoading}
            >
              {resendLoading ? "Reenviando..." : "Reenviar e-mail"}
            </button>
          </>
        )}
        {error && <p className="device-verification-error">{error}</p>}
      </section>

      <footer className="device-verification-footer">
        <button type="button" className="device-verification-logout" onClick={handleLogout}>
          Sair da conta
        </button>
      </footer>
    </div>
  );
}

export default DeviceVerificationPage;
