/*
 * Pure-function tests for the filter predicate + operator coercion. Written
 * in vitest style; runnable from apps/frontend's vitest or any future runner
 * wired up in packages/ui. The imports avoid React so the file can execute
 * in a plain Node runtime as well.
 */

import { describe, expect, it } from "vitest";

import {
  coerceValueForOperator,
  evaluateFilter,
} from "./use-data-table-filters";
import type { ColumnConfig, FilterState } from "./types";

type Row = {
  status: "pass" | "fail" | "partial" | "pending";
  owners: string[];
  title: string;
  turns: number;
};

const statusCol: ColumnConfig<Row> = {
  id: "status",
  label: "Status",
  type: "option",
  accessor: (r) => r.status,
  options: [
    { value: "pass", label: "Pass" },
    { value: "fail", label: "Fail" },
    { value: "partial", label: "Partial" },
    { value: "pending", label: "Pending" },
  ],
};

const ownersCol: ColumnConfig<Row> = {
  id: "owners",
  label: "Owners",
  type: "multiOption",
  accessor: (r) => r.owners,
  options: [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "c", label: "C" },
  ],
};

const titleCol: ColumnConfig<Row> = {
  id: "title",
  label: "Title",
  type: "text",
  accessor: (r) => r.title,
};

const turnsCol: ColumnConfig<Row> = {
  id: "turns",
  label: "Turns",
  type: "number",
  accessor: (r) => r.turns,
};

const row: Row = {
  status: "fail",
  owners: ["a", "b"],
  title: "Refund escalation — wrong address",
  turns: 11,
};

function f(partial: Partial<FilterState>): FilterState {
  return {
    id: "t",
    columnId: partial.columnId ?? "x",
    operator: partial.operator ?? "is",
    value: partial.value,
  } as FilterState;
}

describe("option operators", () => {
  it("is matches exact value", () => {
    expect(
      evaluateFilter(statusCol, f({ operator: "is", value: "fail" }), row),
    ).toBe(true);
    expect(
      evaluateFilter(statusCol, f({ operator: "is", value: "pass" }), row),
    ).toBe(false);
  });
  it("isNot negates", () => {
    expect(
      evaluateFilter(statusCol, f({ operator: "isNot", value: "pass" }), row),
    ).toBe(true);
    expect(
      evaluateFilter(statusCol, f({ operator: "isNot", value: "fail" }), row),
    ).toBe(false);
  });
  it("empty value is a no-op match", () => {
    expect(
      evaluateFilter(statusCol, f({ operator: "is", value: undefined }), row),
    ).toBe(true);
  });
});

describe("multiOption operators", () => {
  it("isAnyOf matches on intersection", () => {
    expect(
      evaluateFilter(
        ownersCol,
        f({ operator: "isAnyOf", value: ["b", "c"] }),
        row,
      ),
    ).toBe(true);
    expect(
      evaluateFilter(
        ownersCol,
        f({ operator: "isAnyOf", value: ["c"] }),
        row,
      ),
    ).toBe(false);
  });
  it("isNoneOf inverts the intersection test", () => {
    expect(
      evaluateFilter(
        ownersCol,
        f({ operator: "isNoneOf", value: ["c"] }),
        row,
      ),
    ).toBe(true);
    expect(
      evaluateFilter(
        ownersCol,
        f({ operator: "isNoneOf", value: ["a"] }),
        row,
      ),
    ).toBe(false);
  });
  it("empty target array is a no-op match", () => {
    expect(
      evaluateFilter(
        ownersCol,
        f({ operator: "isAnyOf", value: [] }),
        row,
      ),
    ).toBe(true);
  });
});

describe("text operators", () => {
  it("contains is case-insensitive and trims", () => {
    expect(
      evaluateFilter(
        titleCol,
        f({ operator: "contains", value: "  REFUND " }),
        row,
      ),
    ).toBe(true);
  });
  it("doesNotContain inverts", () => {
    expect(
      evaluateFilter(
        titleCol,
        f({ operator: "doesNotContain", value: "refund" }),
        row,
      ),
    ).toBe(false);
  });
  it("is / isNot compare full value (lowercased)", () => {
    expect(
      evaluateFilter(titleCol, f({ operator: "is", value: row.title }), row),
    ).toBe(true);
    expect(
      evaluateFilter(
        titleCol,
        f({ operator: "isNot", value: row.title }),
        row,
      ),
    ).toBe(false);
  });
});

describe("number operators", () => {
  const cases: Array<[FilterState["operator"], unknown, boolean]> = [
    ["eq", 11, true],
    ["eq", 12, false],
    ["neq", 12, true],
    ["gt", 10, true],
    ["gt", 11, false],
    ["lt", 20, true],
    ["lt", 11, false],
    ["gte", 11, true],
    ["lte", 11, true],
  ];
  for (const [op, value, expected] of cases) {
    it(`${op}(${String(value)}) against 11`, () => {
      expect(
        evaluateFilter(turnsCol, f({ operator: op, value }), row),
      ).toBe(expected);
    });
  }

  it("between is inclusive on both ends", () => {
    expect(
      evaluateFilter(
        turnsCol,
        f({ operator: "between", value: [10, 12] }),
        row,
      ),
    ).toBe(true);
    expect(
      evaluateFilter(
        turnsCol,
        f({ operator: "between", value: [12, 20] }),
        row,
      ),
    ).toBe(false);
  });

  it("between treats undefined bounds as open-ended", () => {
    expect(
      evaluateFilter(
        turnsCol,
        f({ operator: "between", value: [undefined, 20] }),
        row,
      ),
    ).toBe(true);
    expect(
      evaluateFilter(
        turnsCol,
        f({ operator: "between", value: [20, undefined] }),
        row,
      ),
    ).toBe(false);
    expect(
      evaluateFilter(
        turnsCol,
        f({ operator: "between", value: [undefined, undefined] }),
        row,
      ),
    ).toBe(true);
  });

  it("undefined / empty-string values are no-op matches", () => {
    expect(
      evaluateFilter(turnsCol, f({ operator: "eq", value: undefined }), row),
    ).toBe(true);
    expect(
      evaluateFilter(turnsCol, f({ operator: "eq", value: "" }), row),
    ).toBe(true);
  });
});

describe("coerceValueForOperator", () => {
  it("keeps multiOption values as arrays", () => {
    expect(coerceValueForOperator("multiOption", "isAnyOf", "isNoneOf", undefined))
      .toEqual([]);
    expect(
      coerceValueForOperator(
        "multiOption",
        "isAnyOf",
        "isNoneOf",
        ["a", "b"],
      ),
    ).toEqual(["a", "b"]);
  });

  it("lifts a single number into a range when switching to between", () => {
    expect(coerceValueForOperator("number", "eq", "between", 5)).toEqual([
      5,
      undefined,
    ]);
  });

  it("drops the upper bound when leaving between", () => {
    expect(
      coerceValueForOperator("number", "between", "eq", [3, 7]),
    ).toBe(3);
  });

  it("passes through unrelated values", () => {
    expect(coerceValueForOperator("text", "contains", "is", "hello")).toBe(
      "hello",
    );
    expect(coerceValueForOperator("option", "is", "isNot", "pass")).toBe(
      "pass",
    );
  });
});
