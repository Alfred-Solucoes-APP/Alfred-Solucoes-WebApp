// DashboardPage.tsx

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../assets/styles/dashboard.css";
import { supabase } from "../../supabaseClient";
import { toggleCustomerPaused } from "../../services/api/tables";

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

type PrimitiveType = "string" | "number" | "date" | "array" | "boolean";

type ParamSchemaEntry = {
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

type ParamSchema = Record<string, ParamSchemaEntry>;

type GraphicsConfig = {
  id: number;
  type: string;
  slug: string;
  title: string | null;
  description: string | null;
  param_schema: ParamSchema | null;
  default_params: Record<string, unknown> | null;
  result_shape: Record<string, unknown> | null;
};

type DatasetDatum = Record<string, string | number | boolean | null>;
type DatasetMap = Record<number, DatasetDatum[]>;

type FetchPayload = {
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

type TableColumnConfig = {
  key: string;
  label: string;
  type?: "string" | "number" | "date" | "boolean";
  is_toggle?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  hidden?: boolean;
};

type TableConfig = {
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

export default function DashboardPage() {
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

		const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
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
			const { data, error: functionError } = await supabase.functions.invoke<FetchPayload>(
				"fetchUserData",
			);

			if (functionError) {
				throw new Error(functionError.message ?? "Erro ao carregar dados do usuário");
			}

			if (!data) {
				throw new Error("Resposta vazia ao carregar dados do usuário");
			}

      console.log("fetchUserData raw response", data);

			setCompanyName(data.company_name ?? "");
			setGraphics(Array.isArray(data.graphics) ? data.graphics : []);
			const normalizedDatasets = normalizeDatasetMap(
				(data.datasets ?? {}) as Record<number | string, Record<string, unknown>[]>,
			);
      console.log("fetchUserData normalized datasets", normalizedDatasets);
      console.log("fetchUserData per-graph debug", data.debug);
      console.log("fetchUserData errors", data.errors);
			setDatasets(normalizedDatasets);
      const tablesList = Array.isArray(data.tables) ? data.tables : [];
      setTables(tablesList);
      const normalizedTableRows = normalizeDatasetMap(
        (data.tableRows ?? {}) as Record<number | string, Record<string, unknown>[]>,
      );
      setTableRows(normalizedTableRows);
      setTableErrors(
        data.tableErrors && typeof data.tableErrors === "object" && data.tableErrors !== null
          ? data.tableErrors
          : {},
      );
      setGraphErrors(
        data.errors && typeof data.errors === "object" && data.errors !== null ? data.errors : {},
      );
      setGraphDebug(
        data.debug && typeof data.debug === "object" && data.debug !== null ? data.debug : {},
      );
      setTableActionError(null);

			const firstGraphId = data.graphics?.[0]?.id ?? null;
      console.log("fetchUserData firstGraphId", firstGraphId);
			setSelectedGraphId(firstGraphId);
      const tableIdsFromRows = Object.keys(normalizedTableRows)
        .map((key) => Number(key))
        .filter((key) => Number.isFinite(key));
      const firstTableId = tablesList[0]?.id ?? tableIdsFromRows[0] ?? null;
      setSelectedTableId(firstTableId);
		} catch (fetchError) {
			console.error("fetchData error:", fetchError);
			setError("Não foi possível carregar os dados dos gráficos.");
		} finally {
			setLoading(false);
		}
    }

    fetchData();
  }, []);

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

  const badgeSource = selectedGraph?.slug && selectedGraph.slug.trim().length > 0
    ? selectedGraph.slug
    : selectedGraph
    ? selectedGraph.type
    : "";

  const graphBadgeLabel = badgeSource ? formatGraphName(badgeSource) : "";
  const showGraphBadge = graphBadgeLabel !== "" && graphTitle !== "" && graphBadgeLabel.toLowerCase() !== graphTitle.toLowerCase();

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
  const currentTableRows = selectedTableId !== null ? tableRows[selectedTableId] ?? [] : [];
  const visibleTableColumns = selectedTable
    ? selectedTable.columns.filter((column) => !column.hidden)
    : [];

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

  const parseBooleanValue = (value: unknown): boolean => {
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

  const formatWhatsappNumber = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "—";
    }
    const digits = String(value).replace(/\D/g, "");
    if (digits === "") {
      return "—";
    }

    let localDigits = digits;
    let prefix = "";

    if (localDigits.startsWith("55") && localDigits.length > 2) {
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

    if (!prefix && digits.startsWith("55")) {
      return `+55 ${localDigits}`;
    }

    return (prefix + localDigits).trim();
  };

  const formatTableCellValue = (value: unknown, column: TableColumnConfig): string => {
    if (value === null || value === undefined) {
      return "—";
    }
    if (column.is_toggle) {
      return parseBooleanValue(value) ? "Desativado" : "Ativado";
    }
    if (column.key === "whatsapp" || column.key === "whatsapp_digits") {
      return formatWhatsappNumber(value);
    }
    if (typeof value === "boolean") {
      return value ? "Sim" : "Não";
    }
    if (value instanceof Date) {
      return value.toLocaleString("pt-BR");
    }
    return String(value);
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

    if (rowIdentifier === null) {
      setTableActionError("Identificador do cliente inválido.");
      return;
    }

    setTableActionError(null);
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
            return { ...entry, paused: nextPaused };
          }
          return entry;
        });
        return clone;
      });
    } catch (actionError) {
      setTableActionError((actionError as Error).message ?? "Não foi possível atualizar o status.");
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
        </div>
      </header>

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
                      {showGraphBadge && <span className="graph-type-badge">{graphBadgeLabel}</span>}
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
                      {selectedTable.slug !== "clientes" && (
                        <span className="table-type-badge">Tabela</span>
                      )}
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

                  {!loading && !activeTableErrorMessage && selectedTable && currentTableRows.length > 0 && (
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
                          {currentTableRows.map((row, rowIndex) => {
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

                  {!loading && !activeTableErrorMessage && selectedTable && currentTableRows.length === 0 && (
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
