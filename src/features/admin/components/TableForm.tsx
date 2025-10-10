import { useEffect, useMemo, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { invokeFunction } from "../../../shared/services/supabase/functions";
import { formatRateLimitError, toRateLimitError } from "../../../shared/utils/errors";
import {
	ARRAY_ITEM_TYPE_OPTIONS,
	COLUMN_ALIGN_OPTIONS,
	DEFAULT_ALLOWED_ROLES,
	PARAM_TYPE_OPTIONS,
} from "../constants";
import type { DbCompanyOption } from "../types";
import {
	buildColumnConfig,
	buildDefaultParams,
	buildParamSchema,
	buildTableResultShape,
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

const columnSchema = z.object({
	key: z.string().min(1, "Informe a chave da coluna."),
	label: z.string().optional(),
	type: z.enum(["string", "number", "date", "boolean"] as const),
	align: z.enum(["left", "center", "right"] as const),
	width: z.string().optional(),
	isToggle: z.boolean(),
	hidden: z.boolean(),
});

const tableFormSchema = z.object({
	companyId: z.string().min(1, "Selecione a empresa."),
	slug: z.string().min(1, "Informe o slug."),
	title: z.string().optional(),
	description: z.string().optional(),
	queryTemplate: z.string().min(1, "Informe a query."),
	primaryKey: z.string().optional(),
	columns: z.array(columnSchema),
	parameters: z.array(parameterSchema),
	isActive: z.boolean(),
});

type TableFormSchema = z.infer<typeof tableFormSchema>;

const DEFAULT_TABLE_VALUES: TableFormSchema = {
	companyId: "",
	slug: "",
	title: "",
	description: "",
	queryTemplate: "",
	primaryKey: "id",
	columns: [
		{
			key: "",
			label: "",
			type: "string",
			align: "left",
			width: "",
			isToggle: false,
			hidden: false,
		},
	],
	parameters: [],
	isActive: true,
};

type TableFormProps = {
	companies: DbCompanyOption[];
	selectedCompanyId: string;
	onSelectCompany: (companyId: string) => void;
	loading: boolean;
	error: string;
};

export function TableForm({ companies, selectedCompanyId, onSelectCompany, loading, error }: TableFormProps) {
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
	} = useForm<TableFormSchema>({
		resolver: zodResolver(tableFormSchema),
		defaultValues: {
			...DEFAULT_TABLE_VALUES,
			companyId: selectedCompanyId ?? "",
		},
		mode: "onChange",
	});

	const {
		fields: columnFields,
		append: appendColumn,
		remove: removeColumn,
	} = useFieldArray({ control, name: "columns" });

	const {
		fields: parameterFields,
		append: appendParameter,
		remove: removeParameter,
	} = useFieldArray({ control, name: "parameters" });

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

	const onSubmit: SubmitHandler<TableFormSchema> = async (values) => {
		setServerError("");
		setSuccessMessage("");

		let columnConfig;
		let paramSchema;
		let defaultParams;
		let resultShape;

		try {
			columnConfig = buildColumnConfig(values.columns);
			paramSchema = buildParamSchema(values.parameters);
			defaultParams = buildDefaultParams(values.parameters);
			resultShape = buildTableResultShape(values.columns);
		} catch (transformationError) {
			const message =
				transformationError instanceof Error ? transformationError.message : String(transformationError);
			setServerError(message);
			return;
		}

		try {
			const trimmedSlug = values.slug.trim();
			const trimmedTitle = values.title?.trim();
			const trimmedDescription = values.description?.trim();
			const trimmedPrimaryKey = values.primaryKey?.trim();

			const { data, error: supabaseError } = await invokeFunction("manageTable", {
				body: {
					company_id: values.companyId,
					slug: trimmedSlug,
					title: trimmedTitle || null,
					description: trimmedDescription || null,
					query_template: values.queryTemplate,
					column_config: columnConfig,
					param_schema: paramSchema,
					default_params: defaultParams,
					result_shape: resultShape,
					allowed_roles: sanitizeRoles([...DEFAULT_ALLOWED_ROLES]),
					primary_key: trimmedPrimaryKey || null,
					is_active: values.isActive,
				},
			});

			if (supabaseError) {
				const rateLimitError = await toRateLimitError(supabaseError);
				if (rateLimitError) {
					setServerError(formatRateLimitError(rateLimitError, "Muitas requisições ao salvar tabelas."));
					return;
				}
				setServerError(supabaseError.message ?? "Não foi possível salvar a tabela.");
				return;
			}

			const response = (data ?? {}) as { message?: string; error?: string };
			if (response.error) {
				setServerError(response.error);
				return;
			}

			setSuccessMessage(response.message ?? "Tabela cadastrada com sucesso.");
			reset({ ...DEFAULT_TABLE_VALUES, companyId: values.companyId });
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
					<input {...register("slug")} placeholder="ex.: clientes" />
					{errors.slug && <small className="form-error">{errors.slug.message}</small>}
				</label>

				<label>
					Título
					<input {...register("title")} placeholder="Nome amigável da tabela" />
				</label>

				<label className="span-full">
					Descrição
					<textarea
						{...register("description")}
						rows={3}
						placeholder="Detalhe de que dados a tabela apresenta"
					/>
				</label>

				<label className="span-full">
					Query template*
					<textarea
						{...register("queryTemplate")}
						rows={8}
						placeholder="SELECT ... FROM clientes WHERE ..."
					/>
					{errors.queryTemplate && <small className="form-error">{errors.queryTemplate.message}</small>}
				</label>

				<label>
					Chave primária
					<input {...register("primaryKey")} placeholder="id" />
				</label>
			</div>

			<div className="admin-form__section">
				<div className="admin-form__section-header">
					<h3>Colunas da tabela</h3>
					<p>Defina quais campos serão exibidos e suas configurações.</p>
				</div>
				{columnFields.map((field, index) => (
					<div key={field.id} className="form-grid dynamic-card">
						<label>
							Chave*
							<input {...register(`columns.${index}.key` as const)} />
							{errors.columns?.[index]?.key && (
								<small className="form-error">{errors.columns[index]?.key?.message}</small>
							)}
						</label>

						<label>
							Rótulo
							<input {...register(`columns.${index}.label` as const)} />
						</label>

						<label>
							Tipo
							<select {...register(`columns.${index}.type` as const)}>
								{ARRAY_ITEM_TYPE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>

						<label>
							Alinhamento
							<select {...register(`columns.${index}.align` as const)}>
								{COLUMN_ALIGN_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>

						<label>
							Largura (opcional)
							<input {...register(`columns.${index}.width` as const)} placeholder="160px" />
						</label>

						<label className="checkbox-inline">
							<input type="checkbox" {...register(`columns.${index}.isToggle` as const)} />
							<span>Campo é um toggle</span>
						</label>

						<label className="checkbox-inline">
							<input type="checkbox" {...register(`columns.${index}.hidden` as const)} />
							<span>Ocultar por padrão</span>
						</label>

						<div className="span-full">
							<button type="button" onClick={() => removeColumn(index)}>
								Remover coluna
							</button>
						</div>
					</div>
				))}

				<button
					type="button"
					onClick={() =>
						appendColumn({
							key: "",
							label: "",
							type: "string",
							align: "left",
							width: "",
							isToggle: false,
							hidden: false,
						})
					}
				>
					Adicionar coluna
				</button>
			</div>

			<div className="admin-form__section">
				<div className="admin-form__section-header">
					<h3>Parâmetros da query (opcional)</h3>
					<p>Use quando a query precisar de filtros dinâmicos.</p>
				</div>
				{parameterFields.length === 0 && <p className="form-hint">Nenhum parâmetro definido.</p>}
				{parameterFields.map((field, index) => {
					const currentType = watchedParameters?.[index]?.type ?? "string";
					return (
						<div key={field.id} className="form-grid dynamic-card">
							<label>
								Nome*
								<input {...register(`parameters.${index}.name` as const)} />
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
								<input {...register(`parameters.${index}.description` as const)} />
							</label>

							<label className="span-full">
								Valores permitidos (opcional)
								<input {...register(`parameters.${index}.enumValues` as const)} />
							</label>

							<label className="span-full">
								Valor padrão (opcional)
								<input {...register(`parameters.${index}.defaultValue` as const)} />
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

			{loading && <p className="form-hint">Carregando empresas...</p>}
			{error && <p className="form-error">{error}</p>}
			{!loading && !error && companies.length === 0 && <p className="form-hint">Nenhuma empresa cadastrada até o momento.</p>}
			{firstValidationError && !serverError && <p className="form-error">{firstValidationError}</p>}
			{serverError && <p className="form-error">{serverError}</p>}
			{successMessage && <p className="form-success">{successMessage}</p>}

			<button type="submit" className="btn-green" disabled={isSubmitting || !isValid || loading}>
				{isSubmitting ? "Salvando..." : "Criar tabela"}
			</button>
		</form>
	);
}

export default TableForm;
