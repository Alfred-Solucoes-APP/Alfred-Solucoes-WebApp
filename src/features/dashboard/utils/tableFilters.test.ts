import { describe, expect, it } from "vitest";
import {
  filterAndSortRows,
  formatTableCellValue,
  parseBooleanValue,
  type TableFilterOptions,
} from "./tableFilters";
import type { DatasetDatum, TableColumnConfig } from "../pages/DashboardPage";

const baseColumns: TableColumnConfig[] = [
  { key: "nome", label: "Nome", type: "string" },
  { key: "reservas", label: "Reservas", type: "number" },
  { key: "paused", label: "Status", is_toggle: true, align: "center" },
];

const sampleRows: DatasetDatum[] = [
  { id: 1, nome: "Ana Lima", reservas: 10, paused: false },
  { id: 2, nome: "Bruno Souza", reservas: 5, paused: true },
  { id: 3, nome: "Carlos Mota", reservas: 20, paused: false },
];

const deps = {
  parseBooleanValue,
  formatTableCellValue,
};

const buildOptions = (overrides: Partial<TableFilterOptions> = {}): TableFilterOptions => ({
  searchTerm: "",
  statusFilter: "all",
  sortKey: "paused",
  sortDirection: "asc",
  ...overrides,
});

describe("filterAndSortRows", () => {
  it("retorna linhas ativas antes das inativas quando ordenado pelo status", () => {
    const result = filterAndSortRows(sampleRows, baseColumns, "paused", buildOptions(), deps);
    expect(result.map((row) => row.id)).toEqual([1, 3, 2]);
  });

  it("filtra linhas pela busca em qualquer coluna visível", () => {
    const result = filterAndSortRows(
      sampleRows,
      baseColumns,
      "paused",
      buildOptions({ searchTerm: "bruno" }),
      deps,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("filtra por status ativo e inativo corretamente", () => {
    const active = filterAndSortRows(
      sampleRows,
      baseColumns,
      "paused",
      buildOptions({ statusFilter: "active" }),
      deps,
    );
    const inactive = filterAndSortRows(
      sampleRows,
      baseColumns,
      "paused",
      buildOptions({ statusFilter: "inactive" }),
      deps,
    );

    expect(active.map((row) => row.id)).toEqual([1, 3]);
    expect(inactive.map((row) => row.id)).toEqual([2]);
  });

  it("permite ordenar por outra coluna em ordem crescente e decrescente", () => {
    const asc = filterAndSortRows(
      sampleRows,
      baseColumns,
      "paused",
      buildOptions({ sortKey: "nome", sortDirection: "asc" }),
      deps,
    );
    const desc = filterAndSortRows(
      sampleRows,
      baseColumns,
      "paused",
      buildOptions({ sortKey: "nome", sortDirection: "desc" }),
      deps,
    );

    expect(asc.map((row) => row.nome)).toEqual(["Ana Lima", "Bruno Souza", "Carlos Mota"]);
    expect(desc.map((row) => row.nome)).toEqual(["Carlos Mota", "Bruno Souza", "Ana Lima"]);
  });

  it("não muta o array original de dados", () => {
    const cloneBefore = sampleRows.map((row) => ({ ...row }));
    filterAndSortRows(sampleRows, baseColumns, "paused", buildOptions(), deps);
    expect(sampleRows).toEqual(cloneBefore);
  });
});

describe("formatTableCellValue", () => {
  it("formata datas ISO sem manter o caractere 'T'", () => {
    const formatted = formatTableCellValue("2025-09-26T14:00:00Z", {
      key: "ultima_reserva",
      label: "Última reserva",
      type: "date",
    });

    expect(formatted).not.toContain("T");
  });
});
