import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AdminHeader } from "../../components/layout/AdminHeader";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../state/auth/context";

type RegisterUserPayload = {
	email: string;
	password: string;
	db_host: string;
	db_name: string;
	db_user: string;
	db_password: string;
	company_name: string;
};

const initialFormState: RegisterUserPayload = {
	email: "",
	password: "",
	db_host: "",
	db_name: "",
	db_user: "",
	db_password: "",
	company_name: "",
};

export default function AdminPage() {
	const { user } = useAuth();
	const [form, setForm] = useState<RegisterUserPayload>(initialFormState);
	const [submitting, setSubmitting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [logoutLoading, setLogoutLoading] = useState(false);
	const navigate = useNavigate();

	const isFormValid = useMemo(() => {
		return (
			!!form.email.trim() &&
			!!form.password.trim() &&
			!!form.db_host.trim() &&
			!!form.db_name.trim() &&
			!!form.db_user.trim() &&
			!!form.db_password.trim()
		);
	}, [form]);

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		const { name, value } = event.target;
		setForm((prev) => ({
			...prev,
			[name]: value,
		}));
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!isFormValid) {
			setErrorMessage("Preencha todos os campos obrigatórios");
			return;
		}

		setSubmitting(true);
		setErrorMessage("");
		setSuccessMessage("");

		try {
			const { data, error } = await supabase.functions.invoke("registerUser", {
				body: {
					...form,
					company_name: form.company_name.trim() || null,
				},
			});

			if (error) {
				setErrorMessage(error.message ?? "Não foi possível registrar o usuário");
				return;
			}

			const message = (data as { message?: string } | null)?.message ?? "Usuário cadastrado com sucesso.";
			setSuccessMessage(message);
			setForm(initialFormState);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Erro inesperado ao registrar usuário";
			setErrorMessage(message);
		} finally {
			setSubmitting(false);
		}
	}

	async function handleLogout() {
		setLogoutLoading(true);
		setErrorMessage("");
		try {
			await supabase.auth.signOut();
			navigate("/login", { replace: true });
		} catch (err) {
			console.error("Erro ao encerrar sessão", err);
			setErrorMessage("Não foi possível encerrar a sessão. Tente novamente.");
		} finally {
			setLogoutLoading(false);
		}
	}

	return (
		<div className="admin-page">
			<AdminHeader userLabel={user?.email ?? null} onLogout={handleLogout} isLoggingOut={logoutLoading} />

			<main className="admin-content">
				<header className="admin-content__header">
					<h1>Área Administrativa</h1>
					{user?.email && (
						<p>
							Logado como: <strong>{user.email}</strong>
						</p>
					)}
				</header>
				<h2>Registrar novo usuário</h2>
				<p>Preencha as informações abaixo para criar o usuário de acesso e vincular ao banco de dados do cliente.</p>

				<form className="admin-form" onSubmit={handleSubmit}>
					<div className="form-grid">
						<label>
							Email*
							<input type="email" name="email" value={form.email} onChange={handleChange} required autoComplete="off" />
						</label>

						<label>
							Senha temporária*
							<input
								type="text"
								name="password"
								value={form.password}
								onChange={handleChange}
								required
								autoComplete="new-password"
							/>
						</label>

						<label>
							Host do banco*
							<input type="text" name="db_host" value={form.db_host} onChange={handleChange} required />
						</label>

						<label>
							Nome do banco*
							<input type="text" name="db_name" value={form.db_name} onChange={handleChange} required />
						</label>

						<label>
							Usuário do banco*
							<input type="text" name="db_user" value={form.db_user} onChange={handleChange} required />
						</label>

						<label>
							Senha do banco*
							<input type="text" name="db_password" value={form.db_password} onChange={handleChange} required />
						</label>

						<label className="span-full">
							Nome da empresa (opcional)
							<input type="text" name="company_name" value={form.company_name} onChange={handleChange} />
						</label>
					</div>

					{errorMessage && <p className="form-error">{errorMessage}</p>}
					{successMessage && <p className="form-success">{successMessage}</p>}

					<button type="submit" className="btn-green" disabled={submitting || !isFormValid}>
						{submitting ? "Registrando..." : "Registrar usuário"}
					</button>
				</form>
			</main>
		</div>
	);
}
