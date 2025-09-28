import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../assets/styles/forgot-password.css";
import { supabase } from "../../supabaseClient";

export default function ForgotPasswordPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedEmail = email.trim();

		if (!trimmedEmail) {
			setErrorMessage("Informe um email válido para continuar.");
			setSuccessMessage("");
			return;
		}

		setSubmitting(true);
		setErrorMessage("");
		setSuccessMessage("");

		try {
			const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
				redirectTo: `${window.location.origin}/reset-password`,
			});

			if (error) {
				throw new Error(error.message ?? "Não foi possível enviar o email de recuperação.");
			}

			setSuccessMessage(
				"Se o email estiver cadastrado, enviaremos um link de recuperação em instantes. Confira também a caixa de spam."
			);
			setEmail("");
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Erro inesperado ao solicitar a recuperação de senha.";
			setErrorMessage(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="forgot-password-page">
			<header className="forgot-password-header">
				<button type="button" className="forgot-password-back" onClick={() => navigate("/login")}
				>
					Voltar para o login
				</button>
			</header>
			<main className="forgot-password-main">
				<section className="forgot-password-card">
					<h1>Recuperar senha</h1>
					<p>
						Informe o email associado à sua conta para receber um link de redefinição de senha.
					</p>

					<form className="forgot-password-form" onSubmit={handleSubmit}>
						<label>
							Email
							<input
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								placeholder="nome@empresa.com"
								autoComplete="email"
								required
							/>
						</label>

						{errorMessage && <div className="forgot-password-alert error">{errorMessage}</div>}
						{successMessage && <div className="forgot-password-alert success">{successMessage}</div>}

						<button type="submit" className="btn-green" disabled={submitting}>
							{submitting ? "Enviando..." : "Enviar link de recuperação"}
						</button>
					</form>
				</section>
			</main>
		</div>
	);
}
