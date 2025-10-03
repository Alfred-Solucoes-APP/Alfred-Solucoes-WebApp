import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminHeader } from "../../../shared/components/layout/AdminHeader";
import { supabase } from "../../../shared/services/supabase/client";
import { useAuth } from "../../../shared/state/auth/context";
import type { AdminSection } from "../types";
import { RegisterUserForm } from "../components/RegisterUserForm";
import { GraphForm } from "../components/GraphForm";
import { TableForm } from "../components/TableForm";
import { DocsPanel } from "../components/DocsPanel";
import { useCompanies } from "../hooks/useCompanies";

export function AdminPage() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const { companies, loading: companiesLoading, error: companiesError } = useCompanies();

	const [activeSection, setActiveSection] = useState<AdminSection>("registerUser");
	const [selectedCompanyId, setSelectedCompanyId] = useState("");
	const [logoutLoading, setLogoutLoading] = useState(false);
	const [logoutError, setLogoutError] = useState("");

	useEffect(() => {
		if (!selectedCompanyId) {
			return;
		}
		const stillExists = companies.some((company) => company.id_user === selectedCompanyId);
		if (!stillExists) {
			setSelectedCompanyId("");
		}
	}, [companies, selectedCompanyId]);

	const handleSectionChange = (section: AdminSection) => {
		setActiveSection(section);
	};

	const handleCompanySelect = (companyId: string) => {
		setSelectedCompanyId(companyId);
	};

	async function handleLogout() {
		setLogoutLoading(true);
		setLogoutError("");
		try {
			await supabase.auth.signOut();
			navigate("/login", { replace: true });
		} catch (error) {
			console.error("Erro ao encerrar sessão", error);
			setLogoutError("Não foi possível encerrar a sessão. Tente novamente.");
		} finally {
			setLogoutLoading(false);
		}
	}

	const getSidebarButtonClass = (section: AdminSection): string => {
		const classes = ["admin-sidebar__button"];
		if (section === "docs") {
			classes.push("admin-sidebar__button--docs");
		}
		if (activeSection === section) {
			classes.push("is-active");
		}
		return classes.join(" ");
	};

	const sidebarButtons = useMemo(() => {
		const buttons: Array<{ key: AdminSection; label: string }> = [
			{ key: "registerUser", label: "Registrar novo usuário" },
			{ key: "graphs", label: "Cadastrar gráficos" },
			{ key: "tables", label: "Cadastrar tabelas" },
			{ key: "docs", label: "Documentação" },
		];
		return buttons;
	}, []);

	return (
		<div className="admin-page">
			<AdminHeader userLabel={user?.email ?? null} onLogout={handleLogout} isLoggingOut={logoutLoading} />

			<main className="admin-content">
				<div className="admin-layout">
					<aside className="admin-sidebar">
						<div className="admin-content__header admin-sidebar__header">
							<h1>Área Administrativa</h1>
							<p>
								Logado como: <strong>{user?.email ?? "usuário autenticado"}</strong>
							</p>
						</div>
						<nav className="admin-sidebar__nav">
							{sidebarButtons.map((button) => (
								<button
									key={button.key}
									type="button"
									className={getSidebarButtonClass(button.key)}
									onClick={() => handleSectionChange(button.key)}
								>
									{button.label}
								</button>
							))}
						</nav>
					</aside>

					<section className="admin-main">
						{logoutError && <p className="form-error">{logoutError}</p>}

						{activeSection === "registerUser" && (
							<div className="admin-main__section">
								<div className="admin-main__heading">
									<h2>Registrar novo usuário</h2>
									<p>Preencha as informações abaixo para criar o usuário de acesso e vincular ao banco de dados do cliente.</p>
								</div>
								<RegisterUserForm />
							</div>
						)}

						{activeSection === "graphs" && (
							<div className="admin-main__section">
								<div className="admin-main__heading">
									<h2>Cadastrar gráfico para empresa</h2>
									<p>
										Selecione uma empresa para inserir um novo gráfico na tabela <code>graficos_dashboard</code> do banco dedicado.
									</p>
								</div>
								<GraphForm
									companies={companies}
									selectedCompanyId={selectedCompanyId}
									onSelectCompany={handleCompanySelect}
									loading={companiesLoading}
									error={companiesError}
								/>
							</div>
						)}

						{activeSection === "tables" && (
							<div className="admin-main__section">
								<div className="admin-main__heading">
									<h2>Cadastrar tabela para empresa</h2>
									<p>Crie uma entrada na tabela <code>dashboard_tables</code> do banco dedicado.</p>
								</div>
								<TableForm
									companies={companies}
									selectedCompanyId={selectedCompanyId}
									onSelectCompany={handleCompanySelect}
									loading={companiesLoading}
									error={companiesError}
								/>
							</div>
						)}

						{activeSection === "docs" && <DocsPanel />}
					</section>
				</div>
			</main>
		</div>
	);
}

export default AdminPage;
