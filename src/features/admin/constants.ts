import type { AlignOption, ParameterType, PrimitiveOption } from "./types";

export const PARAM_TYPE_OPTIONS: { value: ParameterType; label: string }[] = [
	{ value: "string", label: "Texto" },
	{ value: "number", label: "Número" },
	{ value: "date", label: "Data" },
	{ value: "boolean", label: "Booleano" },
	{ value: "array", label: "Lista" },
];

export const ARRAY_ITEM_TYPE_OPTIONS: { value: PrimitiveOption; label: string }[] = [
	{ value: "string", label: "Texto" },
	{ value: "number", label: "Número" },
	{ value: "date", label: "Data" },
	{ value: "boolean", label: "Booleano" },
];

export const COLUMN_ALIGN_OPTIONS: { value: AlignOption; label: string }[] = [
	{ value: "left", label: "Esquerda" },
	{ value: "center", label: "Centro" },
	{ value: "right", label: "Direita" },
];

export const DEFAULT_ALLOWED_ROLES = ["client"] as const;
