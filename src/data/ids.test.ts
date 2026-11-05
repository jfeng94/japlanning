import { describe, expect, it } from "vitest";
import { formatIdReport, idReport } from "./ids.ts";
import { parseLayerCsv } from "./parse.ts";
import type { LayerConfig, LayerId } from "./types.ts";

const layer: LayerConfig = {
  id: "stub-ids" as LayerId,
  region: "tokyo",
  label: "Stub",
  csvUrl: "https://example.invalid/ids.csv",
  color: "#333",
  icon: "coffee",
  hasHours: false,
  facets: [],
};

const csv = (lines: string[]) => lines.join("\n") + "\n";

describe("idReport", () => {
  it("reports a sheet without the column", () => {
    const result = parseLayerCsv(csv(["Name,Latitude,Longitude", "A,35.6,139.7"]), layer);
    const report = idReport(layer, result);
    expect(report).toEqual({ hasIdColumn: false, problems: [], nextId: 1 });
    expect(formatIdReport(layer, report)[0]).toContain("no ID column");
  });

  it("finds the next free id and lists each bad row", () => {
    const result = parseLayerCsv(
      csv([
        "ID,Name,Latitude,Longitude",
        "3,A,35.6,139.7",
        "12,B,35.6,139.7",
        ",C,35.6,139.7",
        "12,D,35.6,139.7",
        "x7,E,35.6,139.7",
      ]),
      layer,
    );
    const report = idReport(layer, result);
    expect(report.hasIdColumn).toBe(true);
    expect(report.nextId).toBe(13);
    expect(report.problems.map((w) => w.row)).toEqual([3, 4, 5]);
    const lines = formatIdReport(layer, report);
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("stub-ids: 3 ID problem(s); next free ID is 13");
  });
});
