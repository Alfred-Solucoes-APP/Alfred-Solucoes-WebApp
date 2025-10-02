import { useEffect, useMemo, useState } from "react";
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

type DbCompanyOption = {
	id_user: string;
	company_name: string | null;
	db_name: string;
};

type GraphFormState = {
	slug: string;
	title: string;
	description: string;
	query_template: string;
	param_schema: string;
	default_params: string;
	result_shape: string;
	allowed_roles: string;
	is_active: boolean;
};

const initialGraphFormState: GraphFormState = {
	slug: "",
	title: "",
	description: "",
	query_template: "",
	param_schema: "",
	default_params: "",
	result_shape: "",
	allowed_roles: "user,gestor,admin",
	is_active: true,
};

type JsonRecord = Record<string, unknown>;

function parseJsonInput(value: string, fieldLabel: string): JsonRecord | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(trimmed);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as JsonRecord;
		}
		throw new Error("O JSON deve representar um objeto");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Erro ao interpretar ${fieldLabel}: ${message}`);
	}
}

function parseAllowedRolesInput(value: string): string[] | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const roles = trimmed
		.split(",")
		.map((role) => role.trim())
		.filter((role) => role.length > 0);
	return roles.length > 0 ? roles : undefined;
}

export default function AdminPage() {
	const { user } = useAuth();
	const [form, setForm] = useState<RegisterUserPayload>(initialFormState);
	const [submitting, setSubmitting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [logoutLoading, setLogoutLoading] = useState(false);
	const [companies, setCompanies] = useState<DbCompanyOption[]>([]);
	const [selectedCompanyId, setSelectedCompanyId] = useState("");
	const [companiesLoading, setCompaniesLoading] = useState(true);
	const [companiesError, setCompaniesError] = useState("");
	const [graphForm, setGraphForm] = useState<GraphFormState>(initialGraphFormState);
	const [graphSubmitting, setGraphSubmitting] = useState(false);
	const [graphSuccessMessage, setGraphSuccessMessage] = useState("");
	const [graphErrorMessage, setGraphErrorMessage] = useState("");
	const navigate = useNavigate();

	const isFormValid = useMemo(() => {
		return (
			!!form.email.trim() &&
			!!form.password.trim() &&
			!!form.db_host.trim() &&
			!!form.db_name.trim() &&
			!!form.db_user.trim() &&
			!!form.db_password.trim() &&
			!!form.company_name.trim()
		);
	}, [form]);

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		const { name, value } = event.target;
		setForm((prev) => ({
			...prev,
			[name]: value,
		}));
	}

	useEffect(() => {
		let isMounted = true;
		async function loadCompanies() {
			setCompaniesLoading(true);
			setCompaniesError("");
			try {
				const { data, error } = await supabase.functions.invoke<{
					companies?: DbCompanyOption[];
					error?: string;
				}>("listCompanies");

				if (!isMounted) {
					return;
				}

				if (error) {
					setCompaniesError(error.message ?? "Não foi possível carregar os clientes.");
					setCompanies([]);
					return;
				}

				const payload = data ?? {};
				if (payload?.error) {
					setCompaniesError(payload.error);
					setCompanies([]);
					return;
				}

				const companiesData = Array.isArray(payload?.companies) ? payload.companies : [];
				setCompanies(companiesData);
				setSelectedCompanyId((prev) =>
					prev && companiesData.some((company) => company.id_user === prev) ? prev : ""
				);
			} catch (loadError) {
				if (isMounted) {
					const message = loadError instanceof Error ? loadError.message : String(loadError);
					setCompaniesError(message);
				}
			} finally {
				if (isMounted) {
					setCompaniesLoading(false);
				}
			}
		}

		loadCompanies();
		return () => {
			isMounted = false;
		};
	}, []);

	function handleCompanySelect(event: ChangeEvent<HTMLSelectElement>) {
		setSelectedCompanyId(event.target.value);
		setGraphErrorMessage("");
		setGraphSuccessMessage("");
	}

	function handleGraphChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
		const { name, value, type } = event.target;
		const inputValue = type === "checkbox" && event.target instanceof HTMLInputElement ? event.target.checked : value;
		setGraphForm((prev) => ({
			...prev,
			[name]: inputValue,
		}));
	}

	async function handleGraphSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setGraphErrorMessage("");
		setGraphSuccessMessage("");

		if (!selectedCompanyId) {
			setGraphErrorMessage("Selecione uma empresa antes de cadastrar o gráfico.");
			return;
		}

		if (!graphForm.slug.trim()) {
			setGraphErrorMessage("Informe um slug para o gráfico.");
			return;
		}

		if (!graphForm.query_template.trim()) {
			setGraphErrorMessage("Informe a query template do gráfico.");
			return;
		}

		let parsedParamSchema: JsonRecord | undefined;
		let parsedDefaultParams: JsonRecord | undefined;
		let parsedResultShape: JsonRecord | undefined;

		try {
			parsedParamSchema = parseJsonInput(graphForm.param_schema, "schema de parâmetros");
			parsedDefaultParams = parseJsonInput(graphForm.default_params, "parâmetros padrão");
			parsedResultShape = parseJsonInput(graphForm.result_shape, "estrutura de resultado");
		} catch (jsonError) {
			const message = jsonError instanceof Error ? jsonError.message : String(jsonError);
			setGraphErrorMessage(message);
			return;
		}

		const allowedRoles = parseAllowedRolesInput(graphForm.allowed_roles);

		setGraphSubmitting(true);
		try {
			const { data, error } = await supabase.functions.invoke("manageGraph", {
				body: {
					company_id: selectedCompanyId,
					slug: graphForm.slug.trim(),
					title: graphForm.title.trim() || null,
					description: graphForm.description.trim() || null,
					query_template: graphForm.query_template,
					param_schema: parsedParamSchema,
					default_params: parsedDefaultParams,
					result_shape: parsedResultShape,
					allowed_roles: allowedRoles,
					is_active: graphForm.is_active,
				},
			});

			if (error) {
				setGraphErrorMessage(error.message ?? "Não foi possível salvar o gráfico.");
				return;
			}

			const response = (data ?? {}) as { message?: string; error?: string };
			if (response.error) {
				setGraphErrorMessage(response.error);
				return;
			}

			setGraphSuccessMessage(response.message ?? "Gráfico cadastrado com sucesso.");
			setGraphForm(initialGraphFormState);
		} catch (submitError) {
			const message = submitError instanceof Error ? submitError.message : String(submitError);
			setGraphErrorMessage(message);
		} finally {
			setGraphSubmitting(false);
		}
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
					company_name: form.company_name.trim(),
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
							Nome da empresa*
							<input type="text" name="company_name" value={form.company_name} onChange={handleChange} required />
						</label>
					</div>

					{errorMessage && <p className="form-error">{errorMessage}</p>}
					{successMessage && <p className="form-success">{successMessage}</p>}

					<button type="submit" className="btn-green" disabled={submitting || !isFormValid}>
						{submitting ? "Registrando..." : "Registrar usuário"}
					</button>
				</form>

				<section className="admin-graphs">
					<h2>Cadastrar gráfico para empresa</h2>
					<p>Selecione uma empresa para inserir um novo gráfico na tabela <code>graficos_dashboard</code> do banco dedicado.</p>

					<form className="admin-form" onSubmit={handleGraphSubmit}>
							<div className="form-grid">
								<label className="span-full">
									Empresa*
									<select value={selectedCompanyId} onChange={handleCompanySelect} required disabled={companiesLoading}>
										<option value="">Selecione a empresa</option>
										{companies.map((company) => (
											<option key={company.id_user} value={company.id_user}>
												{company.company_name ?? company.db_name}
											</option>
										))}
									</select>
								</label>

								<label>
									Slug*
									<input name="slug" value={graphForm.slug} onChange={handleGraphChange} required placeholder="ex.: quartos_mais_reservados" />
								</label>

								<label>
									Título
									<input name="title" value={graphForm.title} onChange={handleGraphChange} placeholder="Nome amigável do gráfico" />
								</label>

								<label className="span-full">
									Descrição
									<textarea
										name="description"
										value={graphForm.description}
										onChange={handleGraphChange}
										rows={3}
										placeholder="Resumo exibido para o time interno"
									/>
								</label>

								<label className="span-full">
									Query template*
									<textarea
										name="query_template"
										value={graphForm.query_template}
										onChange={handleGraphChange}
										rows={8}
										placeholder="SELECT ... WHERE data_checkin BETWEEN {{data_inicio}} AND {{data_fim}}"
										required
									/>
								</label>

								<label className="span-full">
									Schema de parâmetros (JSON)
									<textarea
										name="param_schema"
										value={graphForm.param_schema}
										onChange={handleGraphChange}
										rows={6}
										placeholder='{"data_inicio": {"type": "date", "required": true}}'
									/>
								</label>

								<label className="span-full">
									Parâmetros padrão (JSON)
									<textarea
										name="default_params"
										value={graphForm.default_params}
										onChange={handleGraphChange}
										rows={4}
										placeholder='{"limite": 5}'
									/>
								</label>

								<label className="span-full">
									Estrutura esperada (JSON)
									<textarea
										name="result_shape"
										value={graphForm.result_shape}
										onChange={handleGraphChange}
										rows={4}
										placeholder='{"fields": [{"key": "total", "label": "Total"}]}'
									/>
								</label>

								<label>
									Roles permitidos
									<input
										name="allowed_roles"
										value={graphForm.allowed_roles}
										onChange={handleGraphChange}
										placeholder="user,gestor,admin"
									/>
									<small className="form-hint">Separe por vírgula. Inclua "user" para permitir acesso geral.</small>
								</label>

								<label className="checkbox-inline">
									<input
										type="checkbox"
										name="is_active"
										checked={graphForm.is_active}
										onChange={handleGraphChange}
									/>
									<span>Ativo</span>
								</label>
							</div>

							{companiesLoading && <p className="form-hint">Carregando empresas...</p>}
							{companiesError && <p className="form-error">{companiesError}</p>}
						{!companiesLoading && !companiesError && companies.length === 0 && (
							<p className="form-hint">Nenhuma empresa cadastrada até o momento.</p>
						)}
							{graphErrorMessage && <p className="form-error">{graphErrorMessage}</p>}
							{graphSuccessMessage && <p className="form-success">{graphSuccessMessage}</p>}

						<button
							type="submit"
							className="btn-green"
							disabled={graphSubmitting || !selectedCompanyId || companiesLoading}
						>
							{graphSubmitting ? "Salvando..." : "Criar gráfico"}
						</button>
					</form>
				</section>
			</main>
		</div>
	);
}
