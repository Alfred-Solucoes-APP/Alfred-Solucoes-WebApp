import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invokeFunction } from "../../../shared/services/supabase/functions";
import { formatRateLimitError, toRateLimitError } from "../../../shared/utils/errors";

const SUCCESS_REDIRECT_DELAY = 4000;

type ConfirmResponse = {
  status?: "approved";
};

export function ConfirmDevicePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirmando dispositivo...");

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token")?.trim();

    if (!token) {
      setStatus("error");
      setMessage("Token ausente ou inválido. Solicite um novo e-mail de verificação.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await invokeFunction<ConfirmResponse>("confirmDevice", {
          body: { token },
        });

        if (cancelled) return;

        if (error) {
          const rateLimitError = await toRateLimitError(error);
          if (rateLimitError) {
            setStatus("error");
            setMessage(formatRateLimitError(rateLimitError, "Tente abrir este link novamente em instantes."));
            return;
          }
          setStatus("error");
          setMessage(error.message ?? "Não foi possível confirmar o dispositivo.");
          return;
        }

        if (data?.status === "approved") {
          setStatus("success");
          setMessage("Dispositivo confirmado com sucesso. Você pode retornar ao aplicativo.");
          setTimeout(() => navigate("/device-verification", { replace: true }), SUCCESS_REDIRECT_DELAY);
        } else {
          setStatus("success");
          setMessage("Dispositivo confirmado. Você pode fechar esta aba.");
        }
      } catch (err) {
        if (cancelled) return;
        const text = err instanceof Error ? err.message : "Erro inesperado ao confirmar o dispositivo.";
        setStatus("error");
        setMessage(text);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="confirm-device-page">
      <div className={`confirm-device-card confirm-device-card--${status}`}>
        <h1>{status === "success" ? "Tudo certo!" : status === "error" ? "Ops" : "Confirmando"}</h1>
        <p>{message}</p>
        <div className="confirm-device-actions">
          <button type="button" onClick={() => navigate("/login", { replace: true })}>
            Ir para a tela de login
          </button>
          <button type="button" onClick={() => navigate("/device-verification", { replace: true })}>
            Voltar para a verificação
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDevicePage;
