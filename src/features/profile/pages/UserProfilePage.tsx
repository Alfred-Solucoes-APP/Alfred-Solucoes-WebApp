import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../shared/services/supabase/client";
import { useAuth } from "../../../shared/state/auth/context";

type FetchUserDataResponse = {
	company_name?: string | null;
};

export function UserProfilePage() {
	const navigate = useNavigate();
	const { user, loading: authLoading } = useAuth();
	const [companyName, setCompanyName] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [profileLoading, setProfileLoading] = useState(true);
	const [isUpdatingName, setIsUpdatingName] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		if (authLoading) {
			return;
		}

		if (!user) {
			setProfileLoading(false);
			return;
		}

		const initialDisplayName =
			(typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
			(typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
			"";
		setDisplayName(initialDisplayName);

		let isMounted = true;

		async function loadProfileDetails() {
			setProfileLoading(true);
			setErrorMessage("");
			try {
				const { data, error } = await supabase.functions.invoke<FetchUserDataResponse>("fetchUserData");
				if (error) {
					throw new Error(error.message ?? "Não foi possível carregar os dados do perfil.");
				}
				if (!isMounted) return;
				const fetchedCompanyName = data?.company_name ?? "";
				setCompanyName(fetchedCompanyName);
			} catch (err) {
				if (!isMounted) return;
				const message = err instanceof Error ? err.message : "Erro inesperado ao carregar o perfil.";
				setErrorMessage(message);
			} finally {
				if (isMounted) {
					setProfileLoading(false);
				}
			}
		}

		loadProfileDetails();

		return () => {
			isMounted = false;
		};
	}, [authLoading, user]);

	const formattedLastSignIn = useMemo(() => {
		if (!user?.last_sign_in_at) return "—";
		return new Date(user.last_sign_in_at).toLocaleString("pt-BR", {
			dateStyle: "long",
			timeStyle: "short",
		});
	}, [user?.last_sign_in_at]);

	const formattedCreatedAt = useMemo(() => {
		if (!user?.created_at) return "—";
		return new Date(user.created_at).toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
		});
	}, [user?.created_at]);

	async function handleDisplayNameSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!user) return;
		setIsUpdatingName(true);
		setSuccessMessage("");
		setErrorMessage("");
		const trimmedName = displayName.trim();

		try {
			const { error } = await supabase.auth.updateUser({
				data: {
					full_name: trimmedName || null,
				},
			});

			if (error) {
				throw new Error(error.message ?? "Não foi possível atualizar o nome.");
			}

			setSuccessMessage("Nome atualizado com sucesso.");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Erro inesperado ao atualizar o nome.";
			setErrorMessage(message);
		} finally {
			setIsUpdatingName(false);
		}
	}

	function handleContactSupport() {
		const subject = encodeURIComponent("Ajuda com minha conta Alfred");
		const body = encodeURIComponent(
			`Olá equipe Alfred,%0D%0A%0D%0APreciso de ajuda com a minha conta.${companyName ? `%0D%0AEmpresa: ${companyName}` : ""}%0D%0AEmail: ${user?.email ?? ""}`,
		);
		window.location.href = `mailto:suporte@alfred.com?subject=${subject}&body=${body}`;
	}

	if (authLoading) {
		return <div className="user-profile-loading">Carregando perfil...</div>;
	}

	if (!user) {
		return <div className="user-profile-loading">Sessão expirada. Por favor, faça login novamente.</div>;
	}

	return (
		<div className="user-profile-page">
			<header className="user-profile-header">
				<div>
					<button type="button" className="user-profile-back" onClick={() => navigate("/dashboard")}>
						Voltar para o dashboard
					</button>
					<h1>Perfil do usuário</h1>
					<p>Gerencie suas informações pessoais, segurança e suporte.</p>
				</div>
			</header>

			{errorMessage && <div className="user-profile-alert error">{errorMessage}</div>}
			{successMessage && <div className="user-profile-alert success">{successMessage}</div>}

			<div className="user-profile-grid">
				<section className="user-profile-card">
					<h2>Informações básicas</h2>
					<div className="user-profile-info">
						<div className="info-row">
							<span className="info-label">Nome completo</span>
							<span className="info-value">{displayName || "Não informado"}</span>
						</div>
						<div className="info-row">
							<span className="info-label">Email</span>
							<span className="info-value">{user.email}</span>
						</div>
						<div className="info-row">
							<span className="info-label">Empresa</span>
							<span className="info-value">{profileLoading ? "Carregando..." : companyName || "Não informado"}</span>
						</div>
					</div>

					<form className="user-profile-form" onSubmit={handleDisplayNameSubmit}>
						<label>
							Atualizar nome completo
							<input
								type="text"
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
								placeholder="Digite como prefere ser chamado"
							/>
						</label>
						<button type="submit" className="btn-green" disabled={isUpdatingName}>
							{isUpdatingName ? "Salvando..." : "Salvar alterações"}
						</button>
					</form>
				</section>

				<section className="user-profile-card">
					<h2>Segurança</h2>
					<div className="user-profile-info">
						<div className="info-row">
							<span className="info-label">Último acesso</span>
							<span className="info-value">{formattedLastSignIn}</span>
						</div>
						<div className="info-row">
							<span className="info-label">Conta criada em</span>
							<span className="info-value">{formattedCreatedAt}</span>
						</div>
					</div>
					<button type="button" className="user-profile-secondary" onClick={() => navigate("/change-password")}>
						Trocar senha agora
					</button>
				</section>

				<section className="user-profile-card">
					<h2>Precisa de ajuda?</h2>
					<p className="user-profile-description">
						Nossa equipe está pronta para ajudar com questões técnicas, acesso ou dúvidas gerais sobre o Alfred.
					</p>
					<div className="user-profile-actions">
						<button type="button" className="user-profile-outline" onClick={handleContactSupport}>
							Falar com o suporte
						</button>
					</div>
				</section>
			</div>
		</div>
	);
}

export default UserProfilePage;
