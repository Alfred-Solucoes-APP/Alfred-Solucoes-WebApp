export type AdminSection = "registerUser" | "graphs" | "tables" | "docs";

export type PrimitiveOption = "string" | "number" | "date" | "boolean";
export type ParameterType = PrimitiveOption | "array";

export type AlignOption = "left" | "center" | "right";

export interface DbCompanyOption {
	id_user: string;
	company_name: string | null;
	db_name: string;
}

export interface ParameterFormValues {
	name: string;
	type: ParameterType;
	arrayItemType: PrimitiveOption;
	required: boolean;
	description?: string;
	enumValues?: string;
	defaultValue?: string;
}

export interface ResultFieldFormValues {
	key: string;
	label?: string;
	type: PrimitiveOption;
}

export interface TableColumnFormValues {
	key: string;
	label?: string;
	type: PrimitiveOption;
	align: AlignOption;
	width?: string;
	isToggle: boolean;
	hidden: boolean;
}

export interface GraphFormValues {
	companyId: string;
	slug: string;
	title: string;
	description: string;
	queryTemplate: string;
	parameters: ParameterFormValues[];
	resultFields: ResultFieldFormValues[];
	isActive: boolean;
}

export interface TableFormValues {
	companyId: string;
	slug: string;
	title: string;
	description: string;
	queryTemplate: string;
	primaryKey: string;
	columns: TableColumnFormValues[];
	parameters: ParameterFormValues[];
	isActive: boolean;
}

export type JsonRecord = Record<string, unknown>;
