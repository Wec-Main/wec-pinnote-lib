import { describe, expect, it } from "vitest";
import {
  ErdParseError,
  createEmptyErdDocument,
  parseErdDocument,
} from "../src/utils/erd/erdSerialization";
import { blogDocument } from "./erdFixtures";

describe("parseErdDocument", () => {
  it("round-trips a complete document", () => {
    const document = blogDocument();
    expect(parseErdDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
  });

  it("accepts a JSON string", () => {
    const parsed = parseErdDocument(JSON.stringify(createEmptyErdDocument("mysql", "Shop")));
    expect(parsed.engine).toBe("mysql");
    expect(parsed.meta.name).toBe("Shop");
  });

  it("fills defaults for omitted optional properties", () => {
    const parsed = parseErdDocument({
      version: 1,
      engine: "postgres",
      entities: [{ id: "e1", name: "t", fields: [{ id: "f1", name: "c" }] }],
      relationships: [
        {
          id: "r",
          sourceEntityId: "a",
          targetEntityId: "c",
        },
      ],
      notes: [{ id: "n" }],
    });
    expect(parsed.entities[0]?.position).toEqual({ x: 0, y: 0 });
    expect(parsed.entities[0]?.indexes).toEqual([]);
    expect(parsed.relationships[0]?.sourceFieldId).toBeUndefined();
    expect(parsed.relationships[0]?.targetFieldId).toBeUndefined();
    expect(parsed.entities[0]?.fields[0]).toMatchObject({
      type: "text",
      nullable: true,
      primaryKey: false,
      unique: false,
    });
    expect(parsed.relationships[0]).toMatchObject({
      cardinality: "one-to-many",
      sourceOptional: false,
      targetOptional: true,
      onDelete: "no-action",
      onUpdate: "no-action",
    });
    expect(parsed.notes[0]).toMatchObject({ text: "", width: 200, height: 120 });
    expect(parsed.enums).toEqual([]);
    expect(parsed.meta).toEqual({});
  });

  it("strips legacy field and entity keys", () => {
    const parsed = parseErdDocument({
      version: 1,
      engine: "na",
      entities: [
        {
          id: "e",
          name: "t",
          color: "#fff",
          fields: [{ id: "f", name: "c", autoIncrement: true, comment: "old" }],
        },
      ],
    });
    expect(parsed.engine).toBe("na");
    expect(parsed.entities[0]).not.toHaveProperty("color");
    expect(parsed.entities[0]?.fields[0]).not.toHaveProperty("autoIncrement");
    expect(parsed.entities[0]?.fields[0]).not.toHaveProperty("comment");
  });

  it("keeps relationships that point at missing entities for the validator", () => {
    const parsed = parseErdDocument({
      version: 1,
      engine: "postgres",
      relationships: [
        {
          id: "r",
          sourceEntityId: "gone",
          targetEntityId: "gone2",
        },
      ],
    });
    expect(parsed.relationships).toHaveLength(1);
  });

  it.each([
    ["an unsupported version", { version: 2, engine: "postgres" }],
    ["an unknown engine", { version: 1, engine: "oracle" }],
    ["entities that are not an array", { version: 1, engine: "postgres", entities: {} }],
    ["an entity without an id", { version: 1, engine: "postgres", entities: [{ name: "x" }] }],
    [
      "a bad cardinality",
      {
        version: 1,
        engine: "postgres",
        relationships: [
          {
            id: "r",
            sourceEntityId: "a",
            targetEntityId: "c",
            cardinality: "many",
          },
        ],
      },
    ],
    [
      "a non-boolean flag",
      {
        version: 1,
        engine: "postgres",
        entities: [{ id: "e", fields: [{ id: "f", nullable: "yes" }] }],
      },
    ],
  ])("rejects %s", (_label, raw) => {
    expect(() => parseErdDocument(raw)).toThrow(ErdParseError);
  });

  it("rejects non-object input and invalid JSON text", () => {
    expect(() => parseErdDocument(null)).toThrow(ErdParseError);
    expect(() => parseErdDocument("[1,2")).toThrow(ErdParseError);
    expect(() => parseErdDocument([])).toThrow(ErdParseError);
  });

  it("drops prototype-polluting keys from meta", () => {
    const parsed = parseErdDocument(
      JSON.parse(
        '{"version":1,"engine":"postgres","meta":{"__proto__":{"polluted":true},"name":"A","custom":1}}',
      ),
    );
    expect(parsed.meta.name).toBe("A");
    expect(parsed.meta.custom).toBe(1);
    expect(Object.keys(parsed.meta)).not.toContain("__proto__");
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe("createEmptyErdDocument", () => {
  it("defaults the engine to na", () => {
    expect(createEmptyErdDocument(undefined, "Draft").engine).toBe("na");
  });

  it("creates an empty versioned document carrying the name", () => {
    expect(createEmptyErdDocument("sqlite", "Draft")).toEqual({
      version: 1,
      engine: "sqlite",
      entities: [],
      relationships: [],
      enums: [],
      notes: [],
      meta: { name: "Draft" },
    });
  });
});
