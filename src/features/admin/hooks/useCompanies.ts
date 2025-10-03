import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../shared/services/supabase/client";
import type { DbCompanyOption } from "../types";

interface CompaniesPayload {
	companies?: DbCompanyOption[];
	error?: string;
}

export function useCompanies() {
	const [companies, setCompanies] = useState<DbCompanyOption[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const loadCompanies = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const { data, error: invokeError } = await supabase.functions.invoke<CompaniesPayload>("listCompanies");
			if (invokeError) {
				setError(invokeError.message ?? "Não foi possível carregar os clientes.");
				setCompanies([]);
				return;
			}

			const payload = data ?? {};
			if (payload.error) {
				setError(payload.error);
				setCompanies([]);
				return;
			}

			const companiesData = Array.isArray(payload.companies) ? payload.companies : [];
			setCompanies(companiesData);
		} catch (loadError) {
			const message = loadError instanceof Error ? loadError.message : String(loadError);
			setError(message);
			setCompanies([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (!cancelled) {
				await loadCompanies();
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [loadCompanies]);

	return {
		companies,
		loading,
		error,
		reload: loadCompanies,
	};
}
