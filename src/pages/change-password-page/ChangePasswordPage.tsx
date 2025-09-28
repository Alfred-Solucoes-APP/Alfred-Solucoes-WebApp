import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../assets/styles/change-password.css";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../state/auth/context";

type PasswordFormState = {
	currentPassword: string;
	newPassword: string;
	confirmNewPassword: string;
};

const INITIAL_FORM: PasswordFormState = {
	currentPassword: "",
	newPassword: "",
	confirmNewPassword: "",
};

export default function ChangePasswordPage() {
	const navigate = useNavigate();
	const { user, loading } = useAuth();
	const [form, setForm] = useState<PasswordFormState>(INITIAL_FORM);
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	const isFormEmpty = useMemo(() => {
		return !form.currentPassword || !form.newPassword || !form.confirmNewPassword;
	}, [form]);

	function handleChange(event: FormEvent<HTMLInputElement>) {
		const { name, value } = event.currentTarget;
		setForm((prev) => ({ ...prev, [name]: value }));
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!user?.email) {
			setErrorMessage("Não foi possível identificar o usuário atual.");
			return;
		}

		setErrorMessage("");
		const { currentPassword, newPassword, confirmNewPassword } = form;

		if (!currentPassword || !newPassword || !confirmNewPassword) {
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

		if (newPassword === currentPassword) {
			setErrorMessage("Use uma senha diferente da atual.");
			return;
		}

		setSubmitting(true);

		try {
			const { error: reauthError } = await supabase.auth.signInWithPassword({
				email: user.email,
				password: currentPassword,
			});

			if (reauthError) {
				throw new Error("Senha atual incorreta.");
			}

			const { error: updateError } = await supabase.auth.updateUser({
				password: newPassword,
			});

			if (updateError) {
				throw new Error(updateError.message ?? "Não foi possível atualizar a senha.");
			}

			await supabase.auth.signOut();
			navigate("/login", {
				replace: true,
				state: { message: "Senha alterada com sucesso. Faça login novamente." },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Erro inesperado ao alterar a senha.";
			setErrorMessage(message);
		} finally {
			setSubmitting(false);
			setForm(INITIAL_FORM);
		}
	}

	if (loading) {
		return <div className="change-password-loading">Carregando...</div>;
	}

	if (!user) {
		return (
			<div className="change-password-loading">
				Sessão expirada. Faça login novamente para alterar sua senha.
			</div>
		);
	}

	return (
		<div className="change-password-page">
			<header className="change-password-header">
				<button type="button" className="change-password-back" onClick={() => navigate("/perfil")}>
					Voltar para o perfil
				</button>
			</header>
			<main className="change-password-main">
				<section className="change-password-card">
					<h1>Trocar senha</h1>
					<p>Por segurança, confirme sua senha atual antes de definir uma nova.</p>

					<form className="change-password-form" onSubmit={handleSubmit}>
						<label>
							Senha atual
							<input
								type="password"
								name="currentPassword"
								value={form.currentPassword}
								onInput={handleChange}
								autoComplete="current-password"
							/>
						</label>
						<label>
							Nova senha
							<input
								type="password"
								name="newPassword"
								value={form.newPassword}
								onInput={handleChange}
								autoComplete="new-password"
							/>
						</label>
						<label>
							Confirmar nova senha
							<input
								type="password"
								name="confirmNewPassword"
								value={form.confirmNewPassword}
								onInput={handleChange}
								autoComplete="new-password"
							/>
						</label>

						{errorMessage && <div className="change-password-error">{errorMessage}</div>}

						<button type="submit" className="btn-green" disabled={submitting || isFormEmpty}>
							{submitting ? "Atualizando..." : "Trocar senha"}
						</button>
					</form>
				</section>
			</main>
		</div>
	);
}
