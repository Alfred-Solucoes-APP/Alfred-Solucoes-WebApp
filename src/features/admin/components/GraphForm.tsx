import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { invokeFunction } from "../../../shared/services/supabase/functions";
import { formatRateLimitError, toRateLimitError } from "../../../shared/utils/errors";
import {
	ARRAY_ITEM_TYPE_OPTIONS,
	DEFAULT_ALLOWED_ROLES,
	PARAM_TYPE_OPTIONS,
} from "../constants";
import type { DbCompanyOption } from "../types";
import {
	buildDefaultParams,
	buildParamSchema,
	buildResultShape,
	sanitizeRoles,
} from "../utils/formBuilders";

const parameterSchema = z.object({
	name: z.string().min(1, "Informe o nome do parâmetro."),
	type: z.enum(["string", "number", "date", "boolean", "array"] as const),
	arrayItemType: z.enum(["string", "number", "date", "boolean"] as const),
	required: z.boolean(),
	description: z.string().optional(),
	enumValues: z.string().optional(),
	defaultValue: z.string().optional(),
});

const resultFieldSchema = z.object({
	key: z.string().min(1, "Informe a chave do campo."),
	label: z.string().optional(),
	type: z.enum(["string", "number", "date", "boolean"] as const),
});

const graphFormSchema = z.object({
	companyId: z.string().min(1, "Selecione a empresa."),
	slug: z.string().min(1, "Informe o slug."),
	title: z.string().optional(),
	description: z.string().optional(),
	queryTemplate: z.string().min(1, "Informe a query."),
	parameters: z.array(parameterSchema),
	resultFields: z.array(resultFieldSchema),
	isActive: z.boolean(),
});

type GraphFormSchema = z.infer<typeof graphFormSchema>;

const DEFAULT_GRAPH_VALUES: GraphFormSchema = {
	companyId: "",
	slug: "",
	title: "",
	description: "",
	queryTemplate: "",
	parameters: [],
	resultFields: [],
	isActive: true,
};

type GraphFormProps = {
	companies: DbCompanyOption[];
	selectedCompanyId: string;
	onSelectCompany: (companyId: string) => void;
	loading: boolean;
	error: string;
};

export function GraphForm({ companies, selectedCompanyId, onSelectCompany, loading, error }: GraphFormProps) {
	const [serverError, setServerError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	const {
		control,
		handleSubmit,
		register,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting, isValid },
	} = useForm<GraphFormSchema>({
		resolver: zodResolver(graphFormSchema),
		defaultValues: {
			...DEFAULT_GRAPH_VALUES,
			companyId: selectedCompanyId ?? "",
		},
		mode: "onChange",
	});

	const {
		fields: parameterFields,
		append: appendParameter,
		remove: removeParameter,
	} = useFieldArray({ control, name: "parameters" });

	const {
		fields: resultFieldFields,
		append: appendResultField,
		remove: removeResultField,
	} = useFieldArray({ control, name: "resultFields" });

	const watchedParameters = watch("parameters");

	useEffect(() => {
		setValue("companyId", selectedCompanyId ?? "");
	}, [selectedCompanyId, setValue]);

	useEffect(() => {
		setServerError("");
		setSuccessMessage("");
	}, [selectedCompanyId]);

	const firstValidationError = useMemo(() => {
		const messages: string[] = [];
		if (errors.companyId?.message) messages.push(errors.companyId.message);
		if (errors.slug?.message) messages.push(errors.slug.message);
		if (errors.queryTemplate?.message) messages.push(errors.queryTemplate.message);
		return messages[0] ?? "";
	}, [errors]);

	const onSubmit: SubmitHandler<GraphFormSchema> = async (values) => {
		setServerError("");
		setSuccessMessage("");

		let paramSchema;
		let defaultParams;
		let resultShape;

		try {
			paramSchema = buildParamSchema(values.parameters);
			defaultParams = buildDefaultParams(values.parameters);
			resultShape = buildResultShape(values.resultFields);
		} catch (transformationError) {
			const message = transformationError instanceof Error ? transformationError.message : String(transformationError);
			setServerError(message);
			return;
		}

		try {
			const trimmedSlug = values.slug.trim();
			const trimmedTitle = values.title?.trim();
			const trimmedDescription = values.description?.trim();

			const { data, error: supabaseError } = await invokeFunction("manageGraph", {
				body: {
					company_id: values.companyId,
					slug: trimmedSlug,
					title: trimmedTitle || null,
					description: trimmedDescription || null,
					query_template: values.queryTemplate,
					param_schema: paramSchema,
					default_params: defaultParams,
					result_shape: resultShape,
					allowed_roles: sanitizeRoles([...DEFAULT_ALLOWED_ROLES]),
					is_active: values.isActive,
				},
			});

			if (supabaseError) {
				const rateLimitError = await toRateLimitError(supabaseError);
				if (rateLimitError) {
					setServerError(formatRateLimitError(rateLimitError, "Muitas requisições ao criar gráficos."));
					return;
				}
				setServerError(supabaseError.message ?? "Não foi possível salvar o gráfico.");
				return;
			}

			const response = (data ?? {}) as { message?: string; error?: string };
			if (response.error) {
				setServerError(response.error);
				return;
			}

			setSuccessMessage(response.message ?? "Gráfico cadastrado com sucesso.");
			reset({ ...DEFAULT_GRAPH_VALUES, companyId: values.companyId });
		} catch (submitError) {
			const message = submitError instanceof Error ? submitError.message : String(submitError);
			setServerError(message);
		}
	};

	return (
		<form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
			<div className="form-grid">
				<label className="span-full">
					Empresa*
					<select
						{...register("companyId")}
						onChange={(event) => {
							onSelectCompany(event.target.value);
							setValue("companyId", event.target.value, { shouldValidate: true, shouldDirty: true });
						}}
						disabled={loading}
					>
						<option value="">Selecione a empresa</option>
						{companies.map((company) => (
							<option key={company.id_user} value={company.id_user}>
								{company.company_name ?? company.db_name}
							</option>
						))}
					</select>
					{errors.companyId && <small className="form-error">{errors.companyId.message}</small>}
				</label>

				<label>
					Slug*
					<input {...register("slug")} placeholder="ex.: quartos_mais_reservados" />
					{errors.slug && <small className="form-error">{errors.slug.message}</small>}
				</label>

				<label>
					Título
					<input {...register("title")} placeholder="Nome amigável do gráfico" />
				</label>

				<label className="span-full">
					Descrição
					<textarea
						{...register("description")}
						rows={3}
						placeholder="Resumo exibido para o time interno"
					/>
				</label>

				<label className="span-full">
					Query template*
					<textarea
						{...register("queryTemplate")}
						rows={8}
						placeholder="SELECT ... WHERE data_checkin BETWEEN {{data_inicio}} AND {{data_fim}}"
					/>
					{errors.queryTemplate && <small className="form-error">{errors.queryTemplate.message}</small>}
				</label>
			</div>

			<div className="admin-form__section">
				<div className="admin-form__section-header">
					<h3>Parâmetros da query (opcional)</h3>
					<p>Adicione parâmetros para usar como placeholders na query (ex.: {"{{data_inicio}}"}).</p>
				</div>
				{parameterFields.length === 0 && (
					<p className="form-hint">Nenhum parâmetro adicionado. Clique em “Adicionar parâmetro”.</p>
				)}
				{parameterFields.map((field, index) => {
					const currentType = watchedParameters?.[index]?.type ?? "string";
					return (
						<div key={field.id} className="form-grid dynamic-card">
							<label>
								Nome*
								<input
									{...register(`parameters.${index}.name` as const)}
									placeholder="data_inicio"
								/>
								{errors.parameters?.[index]?.name && (
									<small className="form-error">{errors.parameters[index]?.name?.message}</small>
								)}
							</label>

							<label>
								Tipo*
								<select {...register(`parameters.${index}.type` as const)}>
									{PARAM_TYPE_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</label>

							{currentType === "array" && (
								<label>
									Tipo dos itens*
									<select {...register(`parameters.${index}.arrayItemType` as const)}>
										{ARRAY_ITEM_TYPE_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</label>
							)}

							<label className="checkbox-inline">
								<input type="checkbox" {...register(`parameters.${index}.required` as const)} />
								<span>Obrigatório</span>
							</label>

							<label className="span-full">
								Descrição
								<input
									{...register(`parameters.${index}.description` as const)}
									placeholder="Ex.: Período inicial para filtrar as reservas"
								/>
							</label>

							<label className="span-full">
								Valores permitidos (separados por vírgula)
								<input {...register(`parameters.${index}.enumValues` as const)} placeholder="ativo,inativo" />
							</label>

							<label className="span-full">
								Valor padrão (opcional)
								<input {...register(`parameters.${index}.defaultValue` as const)} placeholder={currentType === "date" ? "2025-01-01" : ""} />
							</label>

							<div className="span-full">
								<button type="button" onClick={() => removeParameter(index)}>
									Remover parâmetro
								</button>
							</div>
						</div>
					);
				})}

				<button
					type="button"
					onClick={() =>
						appendParameter({
							name: "",
							type: "string",
							arrayItemType: "string",
							required: false,
							description: "",
							enumValues: "",
							defaultValue: "",
						})
					}
				>
					Adicionar parâmetro
				</button>
			</div>

			<div className="admin-form__section">
				<div className="admin-form__section-header">
					<h3>Campos esperados no resultado (opcional)</h3>
					<p>Ajuda o time a lembrar a estrutura gerada pela query.</p>
				</div>
				{resultFieldFields.length === 0 && <p className="form-hint">Ainda não há campos cadastrados.</p>}
				{resultFieldFields.map((field, index) => (
					<div key={field.id} className="form-grid dynamic-card">
						<label>
							Chave*
							<input {...register(`resultFields.${index}.key` as const)} />
							{errors.resultFields?.[index]?.key && (
								<small className="form-error">{errors.resultFields[index]?.key?.message}</small>
							)}
						</label>

						<label>
							Rótulo
							<input {...register(`resultFields.${index}.label` as const)} />
						</label>

						<label>
							Tipo
							<select {...register(`resultFields.${index}.type` as const)}>
								{ARRAY_ITEM_TYPE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>

						<div className="span-full">
							<button type="button" onClick={() => removeResultField(index)}>
								Remover campo
							</button>
						</div>
					</div>
				))}

				<button
					type="button"
					onClick={() =>
						appendResultField({
							key: "",
							label: "",
							type: "string",
						})
					}
				>
					Adicionar campo
				</button>
			</div>

			{loading && <p className="form-hint">Carregando empresas...</p>}
			{error && <p className="form-error">{error}</p>}
			{!loading && !error && companies.length === 0 && (
				<p className="form-hint">Nenhuma empresa cadastrada até o momento.</p>
			)}
			{firstValidationError && !serverError && <p className="form-error">{firstValidationError}</p>}
			{serverError && <p className="form-error">{serverError}</p>}
			{successMessage && <p className="form-success">{successMessage}</p>}

			<button type="submit" className="btn-green" disabled={isSubmitting || !isValid || loading}>
				{isSubmitting ? "Salvando..." : "Criar gráfico"}
			</button>
		</form>
	);
}
