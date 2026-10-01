import { describe, expect, it } from "vitest";
import { ErdEngine } from "../src/utils/erd/erdEngine";
import { generateDdl } from "../src/utils/erd/ddl/generateDdl";
import { typeCatalogFor } from "../src/utils/erd/erdTypes";
import { createEmptyErdDocument } from "../src/utils/erd/erdSerialization";

const documentWith = (type: string) => {
  const base = createEmptyErdDocument("na", "m");
  return {
    ...base,
    entities: [
      {
        id: "e1",
        name: "t",
        position: { x: 0, y: 0 },
        indexes: [],
        fields: [
          {
            id: "f1",
            name: "id",
            type: "integer",
            nullable: false,
            primaryKey: true,
            unique: false,
          },
          {
            id: "f2",
            name: "col",
            type,
            length: 10,
            precision: 10,
            scale: 2,
            nullable: true,
            primaryKey: false,
            unique: false,
          },
        ],
      },
    ],
  };
};

const columnLine = (sql: string) =>
  sql.split("\n").find((line) => /\bcol\b|`col`|"col"/.test(line)) ?? "";

describe("every catalog type renders for its dialect", () => {
  for (const dialect of ["postgres", "mysql"] as const) {
    it(`${dialect} produces a column definition for each type`, () => {
      for (const option of typeCatalogFor(dialect)) {
        const line = columnLine(generateDdl(documentWith(option.value), dialect));
        expect(line, `${dialect}:${option.value}`).not.toBe("");
      }
    });
  }

  it("mysql never emits postgres-only type names", () => {
    for (const option of typeCatalogFor("mysql")) {
      const line = columnLine(generateDdl(documentWith(option.value), "mysql")).toLowerCase();
      expect(line, option.value).not.toMatch(/\b(bytea|jsonb|timestamptz|serial|tsvector|inet)\b/);
    }
  });

  it("postgres never emits mysql-only type names", () => {
    for (const option of typeCatalogFor("postgres")) {
      const line = columnLine(generateDdl(documentWith(option.value), "postgres")).toLowerCase();
      expect(line, option.value).not.toMatch(
        /\b(datetime|tinytext|mediumtext|longtext|year|blob|varbinary)\b/,
      );
    }
  });
});

describe("focusField", () => {
  it("selects the entity and marks the field active until selection changes", () => {
    const engine = new ErdEngine({ initialDocument: documentWith("text") });
    engine.focusField("e1", "f2");
    expect(engine.getState().activeFieldId).toBe("f2");
    expect([...engine.getState().selection.entityIds]).toEqual(["e1"]);
    engine.clearSelection();
    expect(engine.getState().activeFieldId).toBeNull();
  });

  it("ignores unknown fields", () => {
    const engine = new ErdEngine({ initialDocument: documentWith("text") });
    engine.focusField("e1", "nope");
    expect(engine.getState().activeFieldId).toBeNull();
  });
});
