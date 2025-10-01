import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import "../../assets/styles/change-password.css";
import { supabase } from "../../supabaseClient";

type ResetFormState = {
	newPassword: string;
	confirmNewPassword: string;
};

type PasswordVisibility = {
	newPassword: boolean;
	confirmNewPassword: boolean;
};

const INITIAL_FORM: ResetFormState = {
	newPassword: "",
	confirmNewPassword: "",
};

export default function ResetPasswordPage() {
	const navigate = useNavigate();
	const [form, setForm] = useState<ResetFormState>(INITIAL_FORM);
	const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");
	const [errorMessage, setErrorMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [mostrarSenha, setMostrarSenha] = useState<PasswordVisibility>({
		newPassword: false,
		confirmNewPassword: false,
	});

	const toggleMostrarSenha = (field: keyof PasswordVisibility) => {
		setMostrarSenha((prev) => ({ ...prev, [field]: !prev[field] }));
	};

	function handleNavigateToDashboard() {
		if (status === "ready") {
			const confirmed = window.confirm(
				"Tem certeza de que deseja sair sem redefinir a sua senha?\n\n" +
					"Se continuar, sua senha atual será mantida e você seguirá para o dashboard."
			);
			if (!confirmed) {
				return;
			}
		}

		navigate("/login");
	}

	useEffect(() => {
		async function prepareSession() {
			const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
			const searchParams = new URLSearchParams(window.location.search);
			const type = hashParams.get("type") ?? searchParams.get("type");
			const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");
			const refreshToken = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");

			if (type !== "recovery" || !accessToken || !refreshToken) {
				setErrorMessage("Link de recuperação inválido ou expirado. Solicite um novo e-mail.");
				setStatus("error");
				return;
			}

			try {
				const { error } = await supabase.auth.setSession({
					access_token: accessToken,
					refresh_token: refreshToken,
				});

				if (error) {
					throw error;
				}

				setStatus("ready");
				window.history.replaceState({}, document.title, window.location.pathname);
			} catch (err) {
				const message =
					err instanceof Error
						? err.message
						: "Não foi possível validar o link de recuperação. Solicite um novo e-mail.";
				setErrorMessage(message);
				setStatus("error");
			}
		}

		prepareSession();
	}, []);

	function handleChange(event: FormEvent<HTMLInputElement>) {
		const { name, value } = event.currentTarget;
		setForm((prev) => ({ ...prev, [name]: value }));
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const { newPassword, confirmNewPassword } = form;

		if (!newPassword || !confirmNewPassword) {
			setErrorMessage("Preencha todos os campos.");
			return;
		}

		if (newPassword !== confirmNewPassword) {
			setErrorMessage("A confirmação precisa ser igual à nova senha.");
			return;
		}

		if (newPassword.length < 8) {
			setErrorMessage("A nova senha precisa ter pelo menos 8 caracteres.");
			return;
		}

		setSubmitting(true);
		setErrorMessage("");

		try {
			const { error } = await supabase.auth.updateUser({ password: newPassword });
			if (error) {
				throw new Error(error.message ?? "Não foi possível redefinir a senha.");
			}

			await supabase.auth.signOut();
			navigate("/login", {
				replace: true,
				state: { message: "Senha redefinida com sucesso. Faça login novamente." },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Erro inesperado ao redefinir a senha.";
			setErrorMessage(message);
		} finally {
			setSubmitting(false);
			setForm(INITIAL_FORM);
		}
	}

	if (status === "checking") {
		return <div className="change-password-loading">Validando link de recuperação...</div>;
	}

	if (status === "error") {
		return (
			<div className="change-password-page">
				<header className="change-password-header">
					<button type="button" className="change-password-back" onClick={() => navigate("/login")}
					>
						Voltar para o login
					</button>
				</header>
				<main className="change-password-main">
					<section className="change-password-card">
						<h1>Link inválido</h1>
						<p>{errorMessage}</p>
						<div className="change-password-actions">
							<button type="button" className="btn-green" onClick={() => navigate("/forgot-password")}
							>
								Solicitar novo e-mail
							</button>
							<button
								type="button"
								className="change-password-secondary"
								onClick={() => navigate("/login")}
							>
								Ir para o login
							</button>
						</div>
					</section>
				</main>
			</div>
		);
	}

	return (
		<div className="change-password-page">
			<header className="change-password-header">
				<button type="button" className="change-password-back" onClick={handleNavigateToDashboard}
				>
					Ir para o dashboard
				</button>
			</header>
			<main className="change-password-main">
				<section className="change-password-card">
					<h1>Definir nova senha</h1>
					<p>Digite e confirme a nova senha para concluir a recuperação.</p>

					<form className="change-password-form" onSubmit={handleSubmit}>
						<label>
							Nova senha
							<div className="password-input-wrapper">
								<input
									type={mostrarSenha.newPassword ? "text" : "password"}
									name="newPassword"
									value={form.newPassword}
									onInput={handleChange}
									className="password-field"
									autoComplete="new-password"
								/>
								<button
									type="button"
									className="password-toggle-button"
									onClick={() => toggleMostrarSenha("newPassword")}
									aria-label={mostrarSenha.newPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
									title={mostrarSenha.newPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
								>
									{mostrarSenha.newPassword ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
								</button>
							</div>
						</label>
						<label>
							Confirmar nova senha
							<div className="password-input-wrapper">
								<input
									type={mostrarSenha.confirmNewPassword ? "text" : "password"}
									name="confirmNewPassword"
									value={form.confirmNewPassword}
									onInput={handleChange}
									className="password-field"
									autoComplete="new-password"
								/>
								<button
									type="button"
									className="password-toggle-button"
									onClick={() => toggleMostrarSenha("confirmNewPassword")}
									aria-label={
										mostrarSenha.confirmNewPassword
											? "Ocultar confirmação de senha"
											: "Mostrar confirmação de senha"
									}
									title={
										mostrarSenha.confirmNewPassword
											? "Ocultar confirmação de senha"
											: "Mostrar confirmação de senha"
									}
								>
									{mostrarSenha.confirmNewPassword ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
								</button>
							</div>
						</label>

						{errorMessage && <div className="change-password-error">{errorMessage}</div>}

						<button type="submit" className="btn-green" disabled={submitting}>
							{submitting ? "Atualizando..." : "Redefinir senha"}
						</button>
					</form>
				</section>
			</main>
		</div>
	);
}
