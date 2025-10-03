import type {
	JsonRecord,
	ParameterFormValues,
	ParameterType,
	PrimitiveOption,
	ResultFieldFormValues,
	TableColumnFormValues,
} from "../types";

function convertStringToPrimitive(value: string | undefined, type: PrimitiveOption): unknown {
	const trimmed = value?.trim() ?? "";
	if (trimmed.length === 0) {
		return undefined;
	}

	switch (type) {
		case "number": {
			const numeric = Number(trimmed);
			if (Number.isNaN(numeric)) {
				throw new Error(`O valor '${value}' não é um número válido.`);
			}
			return numeric;
		}
		case "boolean": {
			const normalized = trimmed.toLowerCase();
			if (["true", "1", "sim", "yes", "verdadeiro"].includes(normalized)) {
				return true;
			}
			if (["false", "0", "não", "nao", "no", "falso"].includes(normalized)) {
				return false;
			}
			throw new Error(`O valor '${value}' não é um booleano válido.`);
		}
		case "date":
			return trimmed;
		case "string":
		default:
			return trimmed;
	}
}

function parseEnumValues(raw: string | undefined, type: ParameterType, arrayItemType: PrimitiveOption): unknown[] {
	const trimmed = raw?.trim() ?? "";
	if (!trimmed) {
		return [];
	}

	const entries = trimmed
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	if (entries.length === 0) {
		return [];
	}

	return entries.map((entry) => {
		if (type === "array") {
			return convertStringToPrimitive(entry, arrayItemType);
		}
		return convertStringToPrimitive(entry, type as PrimitiveOption);
	});
}

function parseArrayDefault(value: string | undefined, itemType: PrimitiveOption): unknown[] {
	const trimmed = value?.trim() ?? "";
	if (!trimmed) {
		return [];
	}

	return trimmed
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.map((entry) => convertStringToPrimitive(entry, itemType));
}

export function buildParamSchema(parameters: ParameterFormValues[]): JsonRecord | undefined {
	const schema: JsonRecord = {};

	for (const parameter of parameters) {
		const name = parameter.name.trim();
		if (!name) {
			continue;
		}

		const entry: JsonRecord = { type: parameter.type };
		if (parameter.required) {
			entry.required = true;
		}
		const description = parameter.description?.trim();
		if (description) {
			entry.description = description;
		}

		if (parameter.type === "array") {
			const items: JsonRecord = { type: parameter.arrayItemType };
			const enumValues = parseEnumValues(parameter.enumValues, parameter.type, parameter.arrayItemType);
			if (enumValues.length > 0) {
				items.enum = enumValues;
			}
			entry.items = items;
		} else {
			const enumValues = parseEnumValues(parameter.enumValues, parameter.type, parameter.arrayItemType);
			if (enumValues.length > 0) {
				entry.enum = enumValues;
			}
		}

		schema[name] = entry;
	}

	return Object.keys(schema).length > 0 ? schema : undefined;
}

export function buildDefaultParams(parameters: ParameterFormValues[]): JsonRecord | undefined {
	const defaults: JsonRecord = {};

	for (const parameter of parameters) {
		const name = parameter.name.trim();
		if (!name) {
			continue;
		}

		const trimmedDefault = parameter.defaultValue?.trim() ?? "";
		if (!trimmedDefault) {
			continue;
		}

		if (parameter.type === "array") {
			defaults[name] = parseArrayDefault(trimmedDefault, parameter.arrayItemType);
		} else {
			const parsedValue = convertStringToPrimitive(trimmedDefault, parameter.type as PrimitiveOption);
			if (parsedValue !== undefined) {
				defaults[name] = parsedValue;
			}
		}
	}

	return Object.keys(defaults).length > 0 ? defaults : undefined;
}

export function buildResultShape(fields: ResultFieldFormValues[]): JsonRecord | undefined {
	const normalized = fields
		.map((field) => {
			const key = field.key.trim();
			if (!key) {
				return null;
			}
			const label = field.label?.trim();
			return {
				key,
				label: label || key,
				type: field.type,
			};
		})
		.filter((field): field is { key: string; label: string; type: PrimitiveOption } => field !== null);

	return normalized.length > 0 ? { fields: normalized } : undefined;
}

export function buildColumnConfig(columns: TableColumnFormValues[]): JsonRecord[] {
	const normalized = columns
		.map((column) => {
			const key = column.key.trim();
			if (!key) {
				return null;
			}
			const config: JsonRecord = {
				key,
				label: column.label?.trim() || key,
			};
			if (column.type !== "string") {
				config.type = column.type;
			}
			if (column.isToggle) {
				config.is_toggle = true;
			}
			if (column.align !== "left") {
				config.align = column.align;
			}
			const width = column.width?.trim();
			if (width) {
				config.width = width;
			}
			if (column.hidden) {
				config.hidden = true;
			}
			return config;
		})
		.filter((column): column is JsonRecord => column !== null);

	if (normalized.length === 0) {
		throw new Error("Adicione pelo menos uma coluna à tabela.");
	}

	return normalized;
}

export function buildTableResultShape(columns: TableColumnFormValues[]): JsonRecord | undefined {
	const normalized = columns
		.map((column) => {
			const key = column.key.trim();
			if (!key) {
				return null;
			}
			const label = column.label?.trim();
			return {
				key,
				label: label || key,
				type: column.type,
			};
		})
		.filter((column): column is { key: string; label: string; type: PrimitiveOption } => column !== null);

	return normalized.length > 0 ? { columns: normalized } : undefined;
}

export function sanitizeRoles(roles: string[]): string[] {
	const unique = Array.from(new Set(roles.filter((role) => role.trim().length > 0)));
	return unique.length > 0 ? unique : ["client"];
}
