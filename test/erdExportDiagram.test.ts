import { describe, expect, it } from "vitest";
import { generateDiagramSvg } from "../src/utils/erd/export/exportDiagram";
import { blogDocument } from "./erdFixtures";

describe("generateDiagramSvg", () => {
  it("renders a self-contained svg with an entity per table and a relationship line", () => {
    const svg = generateDiagramSvg(blogDocument());
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox=");
    expect(svg).toContain(">users<");
    expect(svg).toContain(">posts<");
    expect(svg).toContain(">tags<");
    expect(svg).toContain("PK");
    expect(svg).toContain("<line");
  });

  it("returns a placeholder svg for an empty document", () => {
    const svg = generateDiagramSvg({ ...blogDocument(), entities: [], relationships: [] });
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<line");
  });

  it("uses the entity color for the header fill when set", () => {
    const document = blogDocument();
    const [first, ...rest] = document.entities;
    document.entities = [{ ...first!, color: "#ff00ff" }, ...rest];
    const svg = generateDiagramSvg(document);
    expect(svg).toContain('fill="#ff00ff"');
  });
});
