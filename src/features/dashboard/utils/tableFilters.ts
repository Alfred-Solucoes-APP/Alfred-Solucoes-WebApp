import type { DatasetDatum, TableColumnConfig } from "../pages/DashboardPage";

const WHATSAPP_COUNTRY_CODE = "55";

const toComparableNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const sanitizeDigits = (value: unknown): string => String(value ?? "").replace(/\D/g, "");

const formatLocalizedString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("pt-BR");
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }
  return String(value ?? "");
};

export const formatWhatsappNumber = (value: unknown): string => {
  const digits = sanitizeDigits(value);
  if (!digits) {
    return "—";
  }

  let localDigits = digits;
  let prefix = "";

  if (localDigits.startsWith(WHATSAPP_COUNTRY_CODE) && localDigits.length > 2) {
    prefix = "+55 ";
    localDigits = localDigits.slice(2);
  }

  if (localDigits.length > 11) {
    localDigits = localDigits.slice(-11);
  }

  if (localDigits.length === 11) {
    const area = localDigits.slice(0, 2);
    const first = localDigits.slice(2, 7);
    const second = localDigits.slice(7);
    return `${prefix}(${area}) ${first}-${second}`.trim();
  }

  if (localDigits.length === 10) {
    const area = localDigits.slice(0, 2);
    const first = localDigits.slice(2, 6);
    const second = localDigits.slice(6);
    return `${prefix}(${area}) ${first}-${second}`.trim();
  }

  if (!prefix && digits.startsWith(WHATSAPP_COUNTRY_CODE)) {
    return `+55 ${localDigits}`;
  }

  return (prefix + localDigits).trim();
};

export const parseBooleanValue = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "sim", "yes", "ativo", "ativado", "on"].includes(normalized);
  }
  return false;
};

export const formatTableCellValue = (value: unknown, column: TableColumnConfig): string => {
  if (value === null || value === undefined) {
    return "—";
  }
  if (column.is_toggle) {
    return parseBooleanValue(value) ? "Desativado" : "Ativado";
  }
  if (column.key === "whatsapp" || column.key === "whatsapp_digits") {
    return formatWhatsappNumber(value);
  }
  if (value instanceof Date) {
    return value.toLocaleString("pt-BR");
  }
  if (column.type === "date") {
    const parseCandidate = (candidate: unknown) => {
      if (candidate instanceof Date) {
        return candidate;
      }
      if (typeof candidate === "string" || typeof candidate === "number") {
        const parsed = new Date(candidate);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      return null;
    };

    const parsedDate = parseCandidate(value);
    if (parsedDate) {
      return parsedDate.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  return formatLocalizedString(value);
};

export type TableStatusFilter = "all" | "active" | "inactive";
export type TableSortDirection = "asc" | "desc";

export type TableFilterOptions = {
  searchTerm: string;
  statusFilter: TableStatusFilter;
  sortKey: string | null;
  sortDirection: TableSortDirection;
};

type FilterDependencies = {
  parseBooleanValue: (value: unknown) => boolean;
  formatTableCellValue: (value: unknown, column: TableColumnConfig) => string;
};

const compareValues = (a: unknown, b: unknown): number => {
  if (a === b) {
    return 0;
  }

  const isNullish = (value: unknown) => value === null || value === undefined;

  if (isNullish(a)) {
    return 1;
  }
  if (isNullish(b)) {
    return -1;
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  const numericA = toComparableNumber(a);
  const numericB = toComparableNumber(b);
  if (numericA !== null && numericB !== null) {
    return numericA - numericB;
  }

  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
};

const getComparableValue = (
  value: unknown,
  column: TableColumnConfig | undefined,
  deps: FilterDependencies,
): unknown => {
  if (column?.is_toggle) {
    return deps.parseBooleanValue(value) ? 1 : 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const maybeNumber = toComparableNumber(value);
    if (maybeNumber !== null) {
      return maybeNumber;
    }
    return value.toLowerCase();
  }
  const numeric = toComparableNumber(value);
  if (numeric !== null) {
    return numeric;
  }
  if (column) {
    return deps.formatTableCellValue(value, column).toLowerCase();
  }
  return String(value ?? "").toLowerCase();
};

export const filterAndSortRows = (
  rows: DatasetDatum[],
  visibleColumns: TableColumnConfig[],
  toggleColumnKey: string | null,
  options: TableFilterOptions,
  deps: FilterDependencies,
): DatasetDatum[] => {
  const { searchTerm, statusFilter, sortKey, sortDirection } = options;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  let working = [...rows];

  if (toggleColumnKey && statusFilter !== "all") {
    working = working.filter((row) => {
      const value = row[toggleColumnKey];
      const isInactive = deps.parseBooleanValue(value);
      return statusFilter === "inactive" ? isInactive : !isInactive;
    });
  }

  if (normalizedSearch) {
    working = working.filter((row) =>
      visibleColumns.some((column) =>
        deps
          .formatTableCellValue(row[column.key], column)
          .toLowerCase()
          .includes(normalizedSearch),
      ),
    );
  }

  const effectiveSortKey = sortKey ?? null;
  if (effectiveSortKey) {
    const targetColumn = visibleColumns.find((column) => column.key === effectiveSortKey);
    working = [...working].sort((a, b) => {
      const aComparable = getComparableValue(a[effectiveSortKey], targetColumn, deps);
      const bComparable = getComparableValue(b[effectiveSortKey], targetColumn, deps);
      const comparison = compareValues(aComparable, bComparable);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }

  return working;
};
