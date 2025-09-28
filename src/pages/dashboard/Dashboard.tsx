// DashboardPage.tsx

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../assets/styles/dashboard.css";
import { supabase } from "../../supabaseClient";

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

type GraphicsConfig = {
  id: number;
  type: string;
  config: Record<string, unknown>;
};

type DatasetDatum = Record<string, string | number | null>;
type DatasetMap = Record<number, DatasetDatum[]>;

type FetchPayload = {
  company_name: string;
  graphics: GraphicsConfig[];
  datasets: Record<number | string, Record<string, unknown>[]>;
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
  const [selectedGraphId, setSelectedGraphId] = useState<number | null>(null);
  const [tab, setTab] = useState<"graficos" | "chat" | "tabela">("graficos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      console.log("fetchUserData global debug", (data as Record<string, unknown>).globalDebug);
      console.log("fetchUserData per-graph debug", data.debug);
			setDatasets(normalizedDatasets);

			const firstGraphId = data.graphics?.[0]?.id ?? null;
      console.log("fetchUserData firstGraphId", firstGraphId);
			setSelectedGraphId(firstGraphId);
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
                      <span className="graph-type-badge">{formatGraphName(selectedGraph.type)}</span>
                      <h2 className="graph-card__title">{formatGraphName(selectedGraph.type)}</h2>
                    </div>
                  </div>
                )}

                <div className="graph-card__body">
                  {loading && <div className="graph-card__status">Carregando dados...</div>}

                  {error && !loading && <div className="error">{error}</div>}

                  {!loading && !error && selectedGraph && chartConfig && chartData.length > 0 && (
                    <div className="graph-card__chart">
                      <ResponsiveContainer width="100%" height={360}>
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

                  {!loading && !error && selectedGraph && chartConfig && chartData.length === 0 && (
                    <div className="graph-card__empty">
                      <strong>Sem dados por aqui…</strong>
                      <p>Não encontramos registros para este gráfico no período configurado.</p>
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
          <div className="tabela-page">
            <h2>Tabela</h2>
            <p>Em breve!</p>
          </div>
        )}
      </main>
    </div>
  );
}
