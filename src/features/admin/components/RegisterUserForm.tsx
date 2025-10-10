import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invokeFunction } from "../../../shared/services/supabase/functions";
import { formatRateLimitError, toRateLimitError } from "../../../shared/utils/errors";

const registerUserSchema = z.object({
	email: z.string().min(1, "Informe o email corporativo.").email("Email inválido."),
	password: z.string().min(8, "Use ao menos 8 caracteres."),
	db_host: z.string().min(1, "Informe o host do banco."),
	db_name: z.string().min(1, "Informe o nome do banco."),
	db_user: z.string().min(1, "Informe o usuário do banco."),
	db_password: z.string().min(1, "Informe a senha do banco."),
	company_name: z.string().min(1, "Informe o nome da empresa."),
});

export type RegisterUserFormValues = z.infer<typeof registerUserSchema>;

const DEFAULT_VALUES: RegisterUserFormValues = {
	email: "",
	password: "",
	db_host: "",
	db_name: "",
	db_user: "",
	db_password: "",
	company_name: "",
};

export function RegisterUserForm() {
	const {
		handleSubmit,
		register,
		reset,
		formState: { errors, isSubmitting, isValid },
	} = useForm<RegisterUserFormValues>({
		resolver: zodResolver(registerUserSchema),
		defaultValues: DEFAULT_VALUES,
		mode: "onChange",
	});

	const [serverError, setServerError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	async function onSubmit(values: RegisterUserFormValues) {
		setServerError("");
		setSuccessMessage("");

		try {
			const { data, error } = await invokeFunction("registerUser", {
				body: {
					...values,
					company_name: values.company_name.trim(),
				},
			});

			if (error) {
				const rateLimitError = await toRateLimitError(error);
				if (rateLimitError) {
					setServerError(formatRateLimitError(rateLimitError, "Muitas requisições ao registrar usuários."));
					return;
				}
				setServerError(error.message ?? "Não foi possível registrar o usuário.");
				return;
			}

			const message = (data as { message?: string } | null)?.message ?? "Usuário cadastrado com sucesso.";
			setSuccessMessage(message);
			reset(DEFAULT_VALUES);
		} catch (submitError) {
			const message =
				submitError instanceof Error ? submitError.message : "Erro inesperado ao registrar usuário.";
			setServerError(message);
		}
	}

	return (
		<form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
			<div className="form-grid">
				<label>
					Email*
					<input type="email" autoComplete="off" {...register("email")} />
					{errors.email && <small className="form-error">{errors.email.message}</small>}
				</label>

				<label>
					Senha temporária*
					<input type="text" autoComplete="new-password" {...register("password")} />
					{errors.password && <small className="form-error">{errors.password.message}</small>}
				</label>

				<label>
					Host do banco*
					<input type="text" {...register("db_host")} />
					{errors.db_host && <small className="form-error">{errors.db_host.message}</small>}
				</label>

				<label>
					Nome do banco*
					<input type="text" {...register("db_name")} />
					{errors.db_name && <small className="form-error">{errors.db_name.message}</small>}
				</label>

				<label>
					Usuário do banco*
					<input type="text" {...register("db_user")} />
					{errors.db_user && <small className="form-error">{errors.db_user.message}</small>}
				</label>

				<label>
					Senha do banco*
					<input type="text" {...register("db_password")} />
					{errors.db_password && <small className="form-error">{errors.db_password.message}</small>}
				</label>

				<label className="span-full">
					Nome da empresa*
					<input type="text" {...register("company_name")} />
					{errors.company_name && <small className="form-error">{errors.company_name.message}</small>}
				</label>
			</div>

			{serverError && <p className="form-error">{serverError}</p>}
			{successMessage && <p className="form-success">{successMessage}</p>}

			<button type="submit" className="btn-green" disabled={isSubmitting || !isValid}>
				{isSubmitting ? "Registrando..." : "Registrar usuário"}
			</button>
		</form>
	);
}

export default RegisterUserForm;
