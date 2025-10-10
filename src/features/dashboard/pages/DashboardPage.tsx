import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Label, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "../../../shared/services/supabase/client";
import { invokeFunction } from "../../../shared/services/supabase/functions";
import { toggleCustomerPaused } from "../../../shared/api/tables";
import { formatRateLimitError, RateLimitError, toRateLimitError } from "../../../shared/utils/errors";
import "../../../shared/assets/styles/dashboard.css";
import {
  filterAndSortRows,
  formatTableCellValue,
  parseBooleanValue,
} from "../utils/tableFilters";
import type { TableSortDirection, TableStatusFilter } from "../utils/tableFilters";

export type PrimitiveType = "string" | "number" | "date" | "array" | "boolean";

export type ParamSchemaEntry = {
  type: PrimitiveType;
  required?: boolean;
  description?: string;
  enum?: (string | number | boolean)[];
  minimum?: number;
  maximum?: number;
  items?: {
    type: PrimitiveType;
    enum?: (string | number | boolean)[];
    minimum?: number;
    maximum?: number;
  };
  default?: unknown;
};

export type ParamSchema = Record<string, ParamSchemaEntry>;

export type GraphicsConfig = {
  id: number;
  type: string;
  slug: string;
  title: string | null;
  description: string | null;
  param_schema: ParamSchema | null;
  default_params: Record<string, unknown> | null;
  result_shape: Record<string, unknown> | null;
};

export type DatasetDatum = Record<string, string | number | boolean | null>;
type DatasetMap = Record<number, DatasetDatum[]>;

export type FetchPayload = {
  company_name: string;
  graphics: GraphicsConfig[];
  datasets: Record<number | string, Record<string, unknown>[]>;
  debug?: Record<number | string, unknown>;
  errors?: Record<string, unknown>;
  tables?: TableConfig[];
  tableRows?: Record<number | string, Record<string, unknown>[]>;
  tableDebug?: Record<number | string, unknown>;
  tableErrors?: Record<string, unknown>;
};

type GraphViewConfig = {
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  color: string;
  xTickFormatter?: (value: string | number) => string;
  labelFormatter?: (value: string | number) => string;
  tooltipFormatter?: (value: string | number) => string;
};

export type TableColumnConfig = {
  key: string;
  label: string;
  type?: "string" | "number" | "date" | "boolean";
  is_toggle?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  hidden?: boolean;
};

export type TableConfig = {
  id: number;
  slug: string;
  title: string | null;
  description: string | null;
  columns: TableColumnConfig[];
  primary_key: string | null;
  param_schema: ParamSchema | null;
  default_params: Record<string, unknown> | null;
  result_shape: Record<string, unknown> | null;
};

export type DashboardPageProps = {
  demoPayload?: FetchPayload | null;
};

const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const numberFromUnknown = (value: unknown): number | null => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

function formatGraphName(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMonthLabel(value: string | number): string {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 12) {
    return MONTH_NAMES[numericValue - 1];
  }
  return String(value);
}

function normalizeDatasetRow(row: Record<string, unknown>): DatasetDatum {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value === null || value === undefined) {
        return [key, null];
      }
      if (typeof value === "boolean") {
        return [key, value];
      }
      const numeric = numberFromUnknown(value);
      if (numeric !== null) {
        return [key, numeric];
      }
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }
      return [key, String(value)];
    })
  );
}

function normalizeDatasetMap(
  raw: Record<number | string, Record<string, unknown>[]> = {}
): DatasetMap {
  const result: DatasetMap = {};
  for (const [graphId, rows] of Object.entries(raw)) {
    result[Number(graphId)] = rows.map((row) => normalizeDatasetRow(row));
  }
  return result;
}

function getGraphViewConfig(graph: GraphicsConfig, dataset: DatasetDatum[]): GraphViewConfig {
  const type = graph.type.toLowerCase();

  if (type === "quartos_mais_reservados") {
    const hasRoomNumber = dataset.some((row) => Object.hasOwn(row, "numero_quarto"));
    const xKey = hasRoomNumber ? "numero_quarto" : "quarto_id";
    return {
      xKey,
      yKey: "total_reservas",
      xLabel: hasRoomNumber ? "Número do quarto" : "Quarto",
      yLabel: "Reservas",
      color: "#6366f1",
      labelFormatter: (value) => `${hasRoomNumber ? "Quarto" : "ID"} ${value}`,
      tooltipFormatter: (value) => `${value} reservas`,
    };
  }

  if (type === "reservas_por_mes") {
    return {
      xKey: "mes",
      yKey: "total",
      xLabel: "Mês",
      yLabel: "Reservas",
      color: "#22d3ee",
      xTickFormatter: formatMonthLabel,
      labelFormatter: (value) => formatMonthLabel(value),
      tooltipFormatter: (value) => `${value} reservas`,
    };
  }

  if (type === "clientes_por_mes") {
    return {
      xKey: "mes",
      yKey: "total_clientes",
      xLabel: "Mês",
      yLabel: "Clientes",
      color: "#10b981",
      xTickFormatter: formatMonthLabel,
      labelFormatter: (value) => formatMonthLabel(value),
      tooltipFormatter: (value) => `${value} clientes`,
    };
  }

  if (type === "taxa_ocupacao") {
    return {
      xKey: "mes",
      yKey: "taxa",
      xLabel: "Mês",
      yLabel: "Taxa (%)",
      color: "#f97316",
      xTickFormatter: formatMonthLabel,
      labelFormatter: (value) => formatMonthLabel(value),
      tooltipFormatter: (value) => `${value}% de ocupação`,
    };
  }

  if (type === "origem_reservas") {
    return {
      xKey: "canal",
      yKey: "total",
      xLabel: "Canal",
      yLabel: "Reservas",
      color: "#8b5cf6",
      tooltipFormatter: (value) => `${value} reservas`,
    };
  }

  const [firstRow] = dataset;
  const keys = firstRow ? Object.keys(firstRow) : [];
  const [xKey = "categoria", yKey = "valor"] = keys;

  return {
    xKey,
    yKey,
    xLabel: formatGraphName(graph.type),
    yLabel: "Valor",
    color: "#4f46e5",
  };
}

export function DashboardPage(props: DashboardPageProps = {}) {
  const { demoPayload = null } = props;
  const isDemoMode = demoPayload !== null;
  const [companyName, setCompanyName] = useState("");
  const [graphics, setGraphics] = useState<GraphicsConfig[]>([]);
  const [datasets, setDatasets] = useState<DatasetMap>({});
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [tableRows, setTableRows] = useState<DatasetMap>({});
  const [selectedGraphId, setSelectedGraphId] = useState<number | null>(null);
  const [graphErrors, setGraphErrors] = useState<Record<string, unknown>>({});
  const [graphDebug, setGraphDebug] = useState<Record<number | string, unknown>>({});
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tab, setTab] = useState<"graficos" | "chat" | "tabela">("graficos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableErrors, setTableErrors] = useState<Record<string, unknown>>({});
  const [tableActionError, setTableActionError] = useState<string | null>(null);
  const [tableActionLoadingId, setTableActionLoadingId] = useState<string | null>(null);
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState<TableStatusFilter>("all");
  const [tableSortKey, setTableSortKey] = useState<string | null>(null);
  const [tableSortDirection, setTableSortDirection] = useState<TableSortDirection>("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const applyPayload = useCallback((payload: FetchPayload) => {
    setCompanyName(payload.company_name ?? "");
    const graphicsList = Array.isArray(payload.graphics) ? payload.graphics : [];
    setGraphics(graphicsList);

    const normalizedDatasets = normalizeDatasetMap(
      (payload.datasets ?? {}) as Record<number | string, Record<string, unknown>[]>,
    );
    setDatasets(normalizedDatasets);

    const tablesList = Array.isArray(payload.tables) ? payload.tables : [];
    setTables(tablesList);

    const normalizedTableRows = normalizeDatasetMap(
      (payload.tableRows ?? {}) as Record<number | string, Record<string, unknown>[]>,
    );
    setTableRows(normalizedTableRows);

    setTableErrors(
      payload.tableErrors && typeof payload.tableErrors === "object" && payload.tableErrors !== null
        ? payload.tableErrors
        : {},
    );

    setGraphErrors(
      payload.errors && typeof payload.errors === "object" && payload.errors !== null
        ? payload.errors
        : {},
    );

    setGraphDebug(
      payload.debug && typeof payload.debug === "object" && payload.debug !== null
        ? payload.debug
        : {},
    );

    setTableActionError(null);
    setTableActionLoadingId(null);

    const firstGraphId = graphicsList[0]?.id ?? null;
    setSelectedGraphId(firstGraphId);

    const tableIdsFromRows = Object.keys(normalizedTableRows)
      .map((key) => Number(key))
      .filter((key) => Number.isFinite(key));
    const firstTableId = tablesList[0]?.id ?? tableIdsFromRows[0] ?? null;
    setSelectedTableId(firstTableId);
  }, []);

  useEffect(() => {
    let isActive = true;

    if (demoPayload) {
      setLoading(true);
      setError(null);
      try {
        applyPayload(demoPayload);
      } catch (demoError) {
        console.error("Erro ao carregar dados de demonstração:", demoError);
        if (isActive) {
          setError("Não foi possível carregar os dados da demonstração.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
      return () => {
        isActive = false;
      };
    }

    async function fetchData() {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!isActive) {
        return;
      }

      if (sessionError) {
        setError("Erro de sessão.");
        setLoading(false);
        return;
      }

      if (!sessionData?.session) {
        setError("Usuário não está logado.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: functionError } = await invokeFunction<FetchPayload>(
          "fetchUserData",
        );

        if (functionError) {
          const rateLimitError = await toRateLimitError(functionError);
          if (rateLimitError) {
            throw new RateLimitError(
              formatRateLimitError(rateLimitError, "Muitas requisições para carregar os dados."),
              rateLimitError.retryAfterSeconds,
            );
          }
          throw new Error(functionError.message ?? "Erro ao carregar dados do usuário");
        }

        if (!data) {
          throw new Error("Resposta vazia ao carregar dados do usuário");
        }

        console.log("fetchUserData raw response", data);
        const normalizedDatasets = normalizeDatasetMap(
          (data.datasets ?? {}) as Record<number | string, Record<string, unknown>[]>,
        );
        console.log("fetchUserData normalized datasets", normalizedDatasets);
        console.log("fetchUserData per-graph debug", data.debug);
        console.log("fetchUserData errors", data.errors);
        applyPayload({
          ...data,
          datasets: data.datasets ?? {},
          tableRows: data.tableRows ?? {},
          tables: data.tables ?? [],
        });
      } catch (fetchError) {
        console.error("fetchData error:", fetchError);
        if (isActive) {
          if (fetchError instanceof RateLimitError) {
            setError(fetchError.message);
          } else {
            setError("Não foi possível carregar os dados dos gráficos.");
          }
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isActive = false;
    };
  }, [applyPayload, demoPayload]);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen]);

  function handleLogout() {
    setDropdownOpen(false);
    supabase.auth.signOut();
  }

  function toggleDropdown() {
    setDropdownOpen((prev) => !prev);
  }

  function handleDropdownSelect(callback?: () => void) {
    setDropdownOpen(false);
    callback?.();
  }

  const selectedGraph =
    selectedGraphId !== null ? graphics.find((graph) => graph.id === selectedGraphId) ?? null : null;
  const chartData = selectedGraphId !== null ? datasets[selectedGraphId] ?? [] : [];
  const chartConfig = selectedGraph ? getGraphViewConfig(selectedGraph, chartData) : null;
  const selectedGraphError = selectedGraph && selectedGraph.slug
    ? graphErrors[selectedGraph.slug]
    : null;
  const resolveGraphErrorMessage = (value: unknown): string | null => {
    if (!value) {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof Error) {
      return value.message;
    }
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn("Não foi possível serializar erro do gráfico", error);
      return String(value);
    }
  };
  const selectedGraphErrorMessage = resolveGraphErrorMessage(selectedGraphError);
  const selectedGraphDebug = selectedGraphId !== null ? graphDebug[selectedGraphId] : null;
  const resolveGraphDebugDetails = (value: unknown): { rowCount?: number; query?: string } | null => {
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      const rowCount = typeof candidate.rowCount === "number" ? candidate.rowCount : undefined;
      const query = typeof candidate.query === "string" ? candidate.query : undefined;
      return rowCount === undefined && !query ? null : { rowCount, query };
    }
    return null;
  };
  const selectedGraphDebugDetails = resolveGraphDebugDetails(selectedGraphDebug);
  const graphTitle = selectedGraph?.title && selectedGraph.title.trim().length > 0
    ? selectedGraph.title.trim()
    : selectedGraph
    ? formatGraphName(selectedGraph.type)
    : "";

  const chartYAxisDomain = chartConfig
    ? (() => {
        const values = chartData
          .map((row) => row[chartConfig.yKey])
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

        if (values.length === 0) {
          return [0, 1] as [number, number];
        }

        const maxValue = Math.max(...values);
        if (maxValue <= 0) {
          return [0, 1] as [number, number];
        }

        const paddedMax = Math.ceil(maxValue * 1.15);
        return [0, Math.max(1, paddedMax)] as [number, number];
      })()
    : null;

  const selectedTable =
    selectedTableId !== null ? tables.find((table) => table.id === selectedTableId) ?? null : null;
  const currentTableRows = useMemo(
    () => (selectedTableId !== null ? tableRows[selectedTableId] ?? [] : []),
    [selectedTableId, tableRows],
  );
  const visibleTableColumns = useMemo(
    () =>
      selectedTable
        ? selectedTable.columns.filter(
            (column) =>
              !column.hidden
              && column.key.trim().toLowerCase() !== "id",
          )
        : [],
    [selectedTable],
  );
  const tableToggleColumn = useMemo(
    () => visibleTableColumns.find((column) => column.is_toggle) ?? null,
    [visibleTableColumns],
  );
  const toggleColumnKey = tableToggleColumn?.key ?? null;

  const filteredTableRows = useMemo(
    () =>
      filterAndSortRows(
        currentTableRows,
        visibleTableColumns,
        toggleColumnKey,
        {
          searchTerm: tableSearchTerm,
          statusFilter: tableStatusFilter,
          sortKey: tableSortKey,
          sortDirection: tableSortDirection,
        },
        { parseBooleanValue, formatTableCellValue },
      ),
    [
      currentTableRows,
      visibleTableColumns,
      toggleColumnKey,
      tableSearchTerm,
      tableStatusFilter,
      tableSortKey,
      tableSortDirection,
    ],
  );

  const totalTableRowCount = currentTableRows.length;
  const filteredTableRowCount = filteredTableRows.length;
  const hasActiveTableFilters = useMemo(
    () =>
      tableSearchTerm.trim() !== ""
      || tableStatusFilter !== "all"
      || tableSortDirection !== "asc"
      || (tableSortKey ?? null) !== toggleColumnKey,
    [tableSearchTerm, tableStatusFilter, tableSortDirection, tableSortKey, toggleColumnKey],
  );

  useEffect(() => {
    const defaultSortKey = toggleColumnKey ?? null;
    setTableSearchTerm("");
    setTableStatusFilter("all");
    setTableSortDirection("asc");
    setTableSortKey(defaultSortKey);
  }, [selectedTableId, toggleColumnKey]);

  const searchInputId = selectedTable ? `table-search-${selectedTable.id}` : "table-search";
  const sortSelectId = selectedTable ? `table-sort-${selectedTable.id}` : "table-sort";
  const statusFilterLabel =
    tableStatusFilter === "active"
      ? "Ativos"
      : tableStatusFilter === "inactive"
      ? "Desativados"
      : "Todos";
  const activeSortColumn =
    tableSortKey !== null
      ? visibleTableColumns.find((column) => column.key === tableSortKey) ?? null
      : tableToggleColumn;
  const hasSortApplied = (tableSortKey ?? null) !== null;
  const sortDirectionLabel = tableSortDirection === "asc" ? "Ascendente" : "Descendente";

  const handleClearTableFilters = () => {
    setTableSearchTerm("");
    setTableStatusFilter("all");
    setTableSortDirection("asc");
    setTableSortKey(toggleColumnKey);
  };

  const resolveTableErrorMessage = (value: unknown): string | null => {
    if (!value) {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof Error) {
      return value.message;
    }
    try {
      return JSON.stringify(value);
    } catch (stringifyError) {
      console.warn("Não foi possível serializar erro da tabela", stringifyError);
      return String(value);
    }
  };

  const metadataTableError = resolveTableErrorMessage(tableErrors?.["__metadata"]);
  const activeTableErrorMessage = selectedTable ? resolveTableErrorMessage(tableErrors?.[selectedTable.slug]) : null;

  const resolveRowId = (row: DatasetDatum, primaryKey: string | null): string | null => {
    const key = primaryKey ?? "id";
    const raw = row[key] ?? (key !== "id" ? row.id : undefined);

    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed === "" ? null : trimmed;
    }

    if (typeof raw === "number" && Number.isFinite(raw)) {
      return String(raw);
    }

    return String(raw);
  };

  function handleSelectTable(tableId: number) {
    setSelectedTableId(tableId);
    setTableActionError(null);
    setTableActionLoadingId(null);
  }

  async function handleTogglePaused(row: DatasetDatum) {
    if (!selectedTable) {
      return;
    }

    if (selectedTable.slug !== "clientes") {
      return;
    }

    const primaryKey = selectedTable.primary_key ?? "id";
    const rowIdentifier = resolveRowId(row, primaryKey);
    const toggleKey = tableToggleColumn?.key ?? "paused";

    if (rowIdentifier === null) {
      setTableActionError("Identificador do cliente inválido.");
      return;
    }

    setTableActionError(null);

    if (isDemoMode) {
      const currentPaused = parseBooleanValue(row[toggleKey]);
      const nextPaused = !currentPaused;

      setTableRows((prev) => {
        const clone = { ...prev };
        const current = clone[selectedTable.id] ?? [];
        clone[selectedTable.id] = current.map((entry) => {
          const entryId = resolveRowId(entry, primaryKey);
          if (entryId !== null && entryId === rowIdentifier) {
            return { ...entry, [toggleKey]: nextPaused };
          }
          return entry;
        });
        return clone;
      });
      return;
    }

    setTableActionLoadingId(rowIdentifier);

    try {
      const response = await toggleCustomerPaused(rowIdentifier);
      const nextPaused = Boolean(response.paused);

      setTableRows((prev) => {
        const clone = { ...prev };
        const current = clone[selectedTable.id] ?? [];
        clone[selectedTable.id] = current.map((entry) => {
          const entryId = resolveRowId(entry, primaryKey);
          if (entryId !== null && entryId === rowIdentifier) {
            return { ...entry, [toggleKey]: nextPaused };
          }
          return entry;
        });
        return clone;
      });
    } catch (actionError) {
      if (actionError instanceof RateLimitError) {
        setTableActionError(actionError.message);
      } else {
        setTableActionError((actionError as Error).message ?? "Não foi possível atualizar o status.");
      }
    } finally {
      setTableActionLoadingId(null);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <img src="/icone-empresa.png" alt="Ícone da Empresa" className="logo" />
          <button
            type="button"
            className={`dashboard-tab ${tab === "graficos" ? "dashboard-tab--active" : ""}`}
            onClick={() => setTab("graficos")}
          >
            Gráficos
          </button>
          <button
            type="button"
            className={`dashboard-tab ${tab === "chat" ? "dashboard-tab--active" : ""}`}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={`dashboard-tab ${tab === "tabela" ? "dashboard-tab--active" : ""}`}
            onClick={() => setTab("tabela")}
          >
            Tabela
          </button>
        </div>
        <div className="header-right">
          {isDemoMode ? (
            <button type="button" className="demo-exit-button" onClick={() => navigate("/")}>
              Sair da demonstração
            </button>
          ) : (
            <div
              className={`profile-dropdown ${dropdownOpen ? "is-open" : ""}`}
              ref={dropdownRef}
            >
              <button
                type="button"
                className="profile-dropdown__trigger"
                onClick={toggleDropdown}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                <span className="profile-name">{companyName || "Cliente"}</span>
                <span className="profile-dropdown__caret" aria-hidden="true" />
              </button>
              <div className="dropdown-content" role="menu">
                <button
                  type="button"
                  onClick={() => handleDropdownSelect(handleLogout)}
                  role="menuitem"
                >
                  Logout
                </button>
                <button
                  type="button"
                  onClick={() => handleDropdownSelect(() => navigate("/perfil"))}
                  role="menuitem"
                >
                  Perfil
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {isDemoMode && (
        <div className="demo-banner" role="status">
          <strong>Modo demonstração.</strong> Estes dados são fictícios para testar filtros e interações.
        </div>
      )}

      <main className="dashboard-main">
        {tab === "graficos" && (
          <div className="graficos-page">
            <aside className="sidebar-graphics">
              <h2 className="sidebar-title">Visualizações</h2>
              {loading && <div className="graph-placeholder">Carregando gráficos...</div>}
              {error && <div className="error">{error}</div>}
              {!loading && !error && graphics.length === 0 && (
                <div className="graph-placeholder">Nenhum gráfico configurado para este cliente.</div>
              )}
              {!loading && !error && graphics.length > 0 && (
                <ul className="sidebar-graphics__list">
                  {graphics.map((graph) => {
                    const isActive = graph.id === selectedGraphId;
                    return (
                      <li key={graph.id}>
                        <button
                          type="button"
                          className={`sidebar-graphics__item ${isActive ? "is-active" : ""}`}
                          onClick={() => setSelectedGraphId(graph.id)}
                        >
                          <span>{formatGraphName(graph.type)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <section className="graph-area">
              <div className="graph-card">
                {selectedGraph && chartConfig && (
                  <div className="graph-card__header">
                    <div>
                      <h2 className="graph-card__title">{graphTitle}</h2>
                    </div>
                  </div>
                )}

                <div className="graph-card__body">
                  {loading && <div className="graph-card__status">Carregando dados...</div>}

                  {error && !loading && <div className="error">{error}</div>}

                  {!loading && !error && selectedGraph && selectedGraphErrorMessage && (
                    <div className="graph-card__error">
                      <strong>Erro ao carregar este gráfico.</strong>
                      <p>{selectedGraphErrorMessage}</p>
                    </div>
                  )}

                  {!loading
                    && !error
                    && selectedGraph
                    && chartConfig
                    && !selectedGraphErrorMessage
                    && chartData.length > 0 && (
                    <div className="graph-card__chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 24, left: 12, bottom: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.25)" />
                          <XAxis
                            dataKey={chartConfig.xKey}
                            tickFormatter={chartConfig.xTickFormatter}
                            tick={{ fill: "#cbd5f5", fontSize: 12 }}
                          >
                            <Label
                              value={chartConfig.xLabel}
                              offset={-12}
                              position="insideBottom"
                              style={{ fill: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}
                            />
                          </XAxis>
                          <YAxis
                            tick={{ fill: "#cbd5f5", fontSize: 12 }}
                            allowDecimals={false}
                            domain={chartYAxisDomain ?? undefined}
                            tickFormatter={(value) =>
                              typeof value === "number"
                                ? value.toLocaleString("pt-BR")
                                : String(value)
                            }
                          >
                            <Label
                              angle={-90}
                              position="insideLeft"
                              style={{ fill: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}
                            >
                              {chartConfig.yLabel}
                            </Label>
                          </YAxis>
                          <Tooltip
                            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                            formatter={(value) => [
                              chartConfig.tooltipFormatter?.(value as number | string) ?? value,
                              chartConfig.yLabel,
                            ]}
                            labelFormatter={(value) =>
                              chartConfig.labelFormatter?.(value as number | string) ??
                              `${chartConfig.xLabel}: ${value}`
                            }
                          />
                          <Bar dataKey={chartConfig.yKey} fill={chartConfig.color} radius={[10, 10, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {!loading
                    && !error
                    && selectedGraph
                    && chartConfig
                    && !selectedGraphErrorMessage
                    && chartData.length === 0 && (
                    <div className="graph-card__empty">
                      <strong>Sem dados por aqui…</strong>
                      <p>Não encontramos registros para este gráfico no período configurado.</p>
                      {selectedGraphDebugDetails ? (
                        <p className="graph-card__empty-hint">
                          {typeof selectedGraphDebugDetails.rowCount === "number"
                            ? `A consulta executou com ${selectedGraphDebugDetails.rowCount} linha(s).`
                            : "A consulta foi executada, mas não retornou registros."}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {!loading && !error && !selectedGraph && (
                    <div className="graph-card__empty">
                      <strong>Selecione um gráfico</strong>
                      <p>Escolha uma opção no painel à esquerda para visualizar os dados.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === "chat" && (
          <div className="chat-page">
            <h2>Chat</h2>
            <p>Em breve!</p>
          </div>
        )}

        {tab === "tabela" && (
          <div className="tables-page">
            <aside className="sidebar-tables">
              <h2 className="sidebar-title">Tabelas</h2>
              {loading && <div className="table-placeholder">Carregando tabelas...</div>}
              {!loading && metadataTableError && (
                <div className="error error--inline">{metadataTableError}</div>
              )}
              {!loading && tables.length === 0 && (
                <div className="table-placeholder">Nenhuma tabela configurada para este cliente.</div>
              )}
              {!loading && tables.length > 0 && (
                <ul className="sidebar-tables__list">
                  {tables.map((table) => {
                    const isActive = table.id === selectedTableId;
                    return (
                      <li key={table.id}>
                        <button
                          type="button"
                          className={`sidebar-tables__item ${isActive ? "is-active" : ""}`}
                          onClick={() => handleSelectTable(table.id)}
                        >
                          <span>{table.title?.trim() || formatGraphName(table.slug)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <section className="table-area">
              <div className="table-card">
                {selectedTable && (
                  <div className="table-card__header">
                    <div>
                      <h2 className="table-card__title">
                        {selectedTable.title?.trim() || formatGraphName(selectedTable.slug)}
                      </h2>
                      {selectedTable.description && (
                        <p className="table-card__description">{selectedTable.description}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="table-card__body">
                  {loading && <div className="table-card__status">Carregando dados...</div>}

                  {!loading && activeTableErrorMessage && (
                    <div className="error error--inline">{activeTableErrorMessage}</div>
                  )}

                  {tableActionError && (
                    <div className="error error--inline">{tableActionError}</div>
                  )}

                  {!loading && !activeTableErrorMessage && selectedTable && (
                    <div className="table-card__controls">
                      <div className="table-card__control table-card__control--search">
                        <label htmlFor={searchInputId}>Buscar</label>
                        <input
                          id={searchInputId}
                          type="search"
                          placeholder="Filtrar por qualquer coluna..."
                          value={tableSearchTerm}
                          onChange={(event) => setTableSearchTerm(event.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                      {tableToggleColumn && (
                        <div className="table-card__control table-card__control--status">
                          <span className="table-card__control-label">Status</span>
                          <div className="table-status-filter" role="group" aria-label="Filtrar por status">
                            <button
                              type="button"
                              className={`table-status-filter__option ${tableStatusFilter === "all" ? "is-active" : ""}`}
                              onClick={() => setTableStatusFilter("all")}
                            >
                              Todos
                            </button>
                            <button
                              type="button"
                              className={`table-status-filter__option ${tableStatusFilter === "active" ? "is-active" : ""}`}
                              onClick={() => setTableStatusFilter("active")}
                            >
                              Ativos
                            </button>
                            <button
                              type="button"
                              className={`table-status-filter__option ${tableStatusFilter === "inactive" ? "is-active" : ""}`}
                              onClick={() => setTableStatusFilter("inactive")}
                            >
                              Desativados
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="table-card__control table-card__control--sort">
                        <label htmlFor={sortSelectId}>Ordenar por</label>
                        <div className="table-sort">
                          <select
                            id={sortSelectId}
                            value={tableSortKey ?? "__none__"}
                            onChange={(event) => {
                              const { value } = event.target;
                              if (value === "__none__") {
                                setTableSortKey(null);
                              } else {
                                setTableSortKey(value);
                              }
                            }}
                          >
                            {tableToggleColumn && (
                              <option value={tableToggleColumn.key}>
                                {(tableToggleColumn.label || formatGraphName(tableToggleColumn.key))} (ativos primeiro)
                              </option>
                            )}
                            <option value="__none__">Sem ordenação</option>
                            {visibleTableColumns
                              .filter((column) => column.key !== tableToggleColumn?.key)
                              .map((column) => (
                                <option key={column.key} value={column.key}>
                                  {column.label || formatGraphName(column.key)}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            className="table-sort__direction"
                            onClick={() =>
                              setTableSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                            }
                            disabled={!hasSortApplied}
                          >
                            <span aria-hidden="true">{tableSortDirection === "asc" ? "↑" : "↓"}</span>
                            <span className="sr-only">Alternar direção</span>
                          </button>
                        </div>
                      </div>
                      {hasActiveTableFilters && (
                        <button
                          type="button"
                          className="table-card__control table-card__control--clear"
                          onClick={handleClearTableFilters}
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  )}

                  {!loading && !activeTableErrorMessage && selectedTable && (
                    <div className="table-card__meta">
                      <span>
                        <strong>{filteredTableRowCount}</strong>{" "}
                        {filteredTableRowCount === 1 ? "registro exibido" : "registros exibidos"}
                        {totalTableRowCount !== filteredTableRowCount ? ` de ${totalTableRowCount}` : ""}
                      </span>
                      {hasActiveTableFilters && (
                        <>
                          {tableSearchTerm.trim() !== "" && (
                            <span>
                              Busca por <strong>“{tableSearchTerm}”</strong>
                            </span>
                          )}
                          {tableStatusFilter !== "all" && (
                            <span>
                              Status: <strong>{statusFilterLabel}</strong>
                            </span>
                          )}
                          {hasSortApplied && activeSortColumn && (
                            <span>
                              Ordenado por{" "}
                              <strong>{activeSortColumn.label || formatGraphName(activeSortColumn.key)}</strong>{" "}
                              ({sortDirectionLabel})
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {!loading && !activeTableErrorMessage && selectedTable && filteredTableRows.length > 0 && (
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {visibleTableColumns.map((column) => (
                              <th
                                key={column.key}
                                style={{ textAlign: column.align ?? "left", width: column.width }}
                              >
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTableRows.map((row, rowIndex) => {
                            const primaryKey = selectedTable.primary_key ?? "id";
                            const rowIdentifier = resolveRowId(row, primaryKey);
                            const rowKey = `${selectedTable.slug}-${rowIdentifier ?? row[primaryKey] ?? row.id ?? rowIndex}`;

                            return (
                              <tr key={rowKey}>
                                {visibleTableColumns.map((column) => {
                                  const cellValue = row[column.key];

                                  if (column.is_toggle && selectedTable.slug === "clientes") {
                                    const boolValue = parseBooleanValue(cellValue);
                                    const isLoading = rowIdentifier !== null && tableActionLoadingId === rowIdentifier;
                                    return (
                                      <td key={column.key} style={{ textAlign: column.align ?? "center" }}>
                                        <button
                                          type="button"
                                          className={`table-toggle ${boolValue ? "is-off" : "is-on"}`}
                                          onClick={() => handleTogglePaused(row)}
                                          disabled={isLoading || loading || rowIdentifier === null}
                                        >
                                          {isLoading ? "..." : boolValue ? "Desativado" : "Ativado"}
                                        </button>
                                      </td>
                                    );
                                  }

                                  return (
                                    <td key={column.key} style={{ textAlign: column.align ?? "left" }}>
                                      {formatTableCellValue(cellValue, column)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!loading
                    && !activeTableErrorMessage
                    && selectedTable
                    && filteredTableRows.length === 0
                    && totalTableRowCount > 0 && (
                      <div className="table-card__empty table-card__empty--filters">
                        <strong>Nenhum resultado encontrado</strong>
                        <p>Ajuste os filtros ou limpe a busca para visualizar mais registros.</p>
                        {hasActiveTableFilters && (
                          <button
                            type="button"
                            className="table-card__empty-clear"
                            onClick={handleClearTableFilters}
                          >
                            Limpar filtros
                          </button>
                        )}
                      </div>
                    )}

                  {!loading
                    && !activeTableErrorMessage
                    && selectedTable
                    && totalTableRowCount === 0 && (
                      <div className="table-card__empty">
                        <strong>Sem dados por aqui…</strong>
                        <p>Não encontramos registros para esta tabela.</p>
                      </div>
                    )}

                  {!loading && !selectedTable && (
                    <div className="table-card__empty">
                      <strong>Selecione uma tabela</strong>
                      <p>Escolha uma opção no painel à esquerda para visualizar os dados.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;
