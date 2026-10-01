import { describe, expect, it } from "vitest";
import { generateDdl } from "../src/utils/erd/ddl/generateDdl";
import { quoteIdentifier, quoteLiteral, renderDefault } from "../src/utils/erd/ddl/ddlCommon";
import type { ErdRelationship } from "../src/types/dataModel.types";
import { blogDocument, entity, field, relationship } from "./erdFixtures";

describe("generateDdl postgres", () => {
  it("renders the blog model", () => {
    expect(generateDdl(blogDocument(), "postgres")).toMatchInlineSnapshot(`
      "CREATE TYPE "user_role" AS ENUM ('admin', 'member');

      CREATE TABLE "users" (
        "id" integer NOT NULL,
        "email" varchar(255) NOT NULL UNIQUE,
        "role" "user_role" DEFAULT 'member',
        PRIMARY KEY ("id")
      );

      CREATE TABLE "posts" (
        "id" integer NOT NULL,
        "author_id" integer NOT NULL,
        "title" varchar(120) NOT NULL,
        "score" numeric(10,2) DEFAULT 0,
        "published" boolean DEFAULT FALSE,
        PRIMARY KEY ("id")
      );

      CREATE TABLE "tags" (
        "id" integer NOT NULL,
        "label" text,
        PRIMARY KEY ("id")
      );

      CREATE TABLE "posts_tags" (
        "posts_id" integer NOT NULL,
        "tags_id" integer NOT NULL,
        PRIMARY KEY ("posts_id", "tags_id")
      );

      CREATE INDEX "idx_posts_author" ON "posts" ("author_id");

      ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_author_id" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE RESTRICT;

      ALTER TABLE "posts_tags" ADD CONSTRAINT "fk_posts_tags_posts_id" FOREIGN KEY ("posts_id") REFERENCES "posts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

      ALTER TABLE "posts_tags" ADD CONSTRAINT "fk_posts_tags_tags_id" FOREIGN KEY ("tags_id") REFERENCES "tags" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

      COMMENT ON TABLE "users" IS 'App users';
      "
    `);
  });
});

describe("generateDdl mysql", () => {
  it("renders the blog model", () => {
    expect(generateDdl(blogDocument(), "mysql")).toMatchInlineSnapshot(`
      "CREATE TABLE \`users\` (
        \`id\` INT NOT NULL,
        \`email\` varchar(255) NOT NULL UNIQUE,
        \`role\` ENUM('admin', 'member') DEFAULT 'member',
        PRIMARY KEY (\`id\`)
      ) COMMENT='App users';

      CREATE TABLE \`posts\` (
        \`id\` INT NOT NULL,
        \`author_id\` INT NOT NULL,
        \`title\` varchar(120) NOT NULL,
        \`score\` DECIMAL(10,2) DEFAULT 0,
        \`published\` TINYINT(1) DEFAULT FALSE,
        PRIMARY KEY (\`id\`)
      );

      CREATE TABLE \`tags\` (
        \`id\` INT NOT NULL,
        \`label\` text,
        PRIMARY KEY (\`id\`)
      );

      CREATE TABLE \`posts_tags\` (
        \`posts_id\` INT NOT NULL,
        \`tags_id\` INT NOT NULL,
        PRIMARY KEY (\`posts_id\`, \`tags_id\`)
      );

      CREATE INDEX \`idx_posts_author\` ON \`posts\` (\`author_id\`);

      ALTER TABLE \`posts\` ADD CONSTRAINT \`fk_posts_author_id\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT;

      ALTER TABLE \`posts_tags\` ADD CONSTRAINT \`fk_posts_tags_posts_id\` FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION;

      ALTER TABLE \`posts_tags\` ADD CONSTRAINT \`fk_posts_tags_tags_id\` FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION;
      "
    `);
  });
});

describe("generateDdl behaviour", () => {
  const parent = () =>
    entity("p", [field("pid", { name: "id", primaryKey: true, nullable: false })], {
      name: "parents",
    });
  const child = () =>
    entity("c", [field("cid", { name: "id", primaryKey: true, nullable: false })], {
      name: "children",
    });
  const pair = (
    cardinality: "one-to-one" | "one-to-many",
    overrides: Partial<ErdRelationship> = {},
  ) => ({
    ...blogDocument(),
    entities: [parent(), child()],
    relationships: [
      relationship("r", "p", "c", { cardinality, onDelete: "set-null", ...overrides }),
    ],
    enums: [],
  });

  it("derives a foreign key column named after the parent table and primary key", () => {
    const sql = generateDdl(pair("one-to-many"), "postgres");
    expect(sql).toContain('"parents_id" integer');
    expect(sql).not.toContain('"parents_id" integer NOT NULL');
    expect(sql).toContain(
      'ALTER TABLE "children" ADD CONSTRAINT "fk_children_parents_id" FOREIGN KEY ("parents_id") REFERENCES "parents" ("id")',
    );
  });

  it("makes the derived column NOT NULL when the child side is mandatory", () => {
    const sql = generateDdl(pair("one-to-many", { targetOptional: false }), "postgres");
    expect(sql).toContain('"parents_id" integer NOT NULL');
  });

  it("reuses an existing column with the derived name", () => {
    const document = pair("one-to-many");
    document.entities[1] = entity(
      "c",
      [
        field("cid", { name: "id", primaryKey: true, nullable: false }),
        field("cp", { name: "parents_id", nullable: false }),
      ],
      { name: "children" },
    );
    const sql = generateDdl(document, "postgres");
    expect(sql.match(/"parents_id"/g)).toHaveLength(2);
    expect(sql).toContain('"parents_id" integer NOT NULL');
  });

  it("maps serial parents onto integer foreign key columns", () => {
    const document = pair("one-to-many");
    document.entities[0] = entity(
      "p",
      [field("pid", { name: "id", type: "bigserial", primaryKey: true, nullable: false })],
      { name: "parents" },
    );
    const sql = generateDdl(document, "postgres");
    expect(sql).toContain('"id" bigserial NOT NULL');
    expect(sql).toContain('"parents_id" bigint');
  });

  it("derives one column per composite primary key column", () => {
    const document = pair("one-to-many");
    document.entities[0] = entity(
      "p",
      [
        field("a", { name: "tenant", primaryKey: true, nullable: false }),
        field("b", { name: "code", type: "varchar", length: 8, primaryKey: true, nullable: false }),
      ],
      { name: "parents" },
    );
    const sql = generateDdl(document, "postgres");
    expect(sql).toContain('"parents_tenant" integer');
    expect(sql).toContain('"parents_code" varchar(8)');
    expect(sql).toContain('FOREIGN KEY ("parents_tenant", "parents_code")');
  });

  it("uses explicit relationship fields instead of derived columns", () => {
    const document = pair("one-to-many", { sourceFieldId: "pid", targetFieldId: "cp" });
    document.entities[1] = entity(
      "c",
      [
        field("cid", { name: "id", primaryKey: true, nullable: false }),
        field("cp", { name: "owner_id" }),
      ],
      { name: "children" },
    );
    const sql = generateDdl(document, "postgres");
    expect(sql).toContain('FOREIGN KEY ("owner_id") REFERENCES "parents" ("id")');
    expect(sql).not.toContain("parents_id");
  });

  it("adds a unique constraint on the foreign key only for one-to-one", () => {
    expect(generateDdl(pair("one-to-one"), "postgres")).toContain(
      'ALTER TABLE "children" ADD CONSTRAINT "uq_children_parents_id" UNIQUE ("parents_id");',
    );
    expect(generateDdl(pair("one-to-many"), "postgres")).not.toContain("UNIQUE (");
  });

  it("builds a junction table with derived columns for many-to-many", () => {
    const document = pair("one-to-many", { cardinality: "many-to-many" });
    const sql = generateDdl(document, "postgres");
    expect(sql).toContain(
      'CREATE TABLE "parents_children" (\n  "parents_id" integer NOT NULL,\n  "children_id" integer NOT NULL,\n  PRIMARY KEY ("parents_id", "children_id")\n);',
    );
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(2);
  });

  it("supports a self-referencing one-to-many", () => {
    const document = {
      ...pair("one-to-many"),
      entities: [parent()],
      relationships: [relationship("r", "p", "p")],
    };
    const sql = generateDdl(document, "postgres");
    expect(sql).toContain('"parents_id" integer');
    expect(sql).toContain('FOREIGN KEY ("parents_id") REFERENCES "parents" ("id")');
  });

  it("emits foreign keys after every table and uses the declared referential actions", () => {
    const sql = generateDdl(pair("one-to-many"), "mysql");
    expect(sql.lastIndexOf("CREATE TABLE")).toBeLessThan(sql.indexOf("ALTER TABLE"));
    expect(sql).toContain("ON DELETE SET NULL ON UPDATE NO ACTION");
  });

  it("skips relationships whose ends no longer exist and entities without fields", () => {
    const document = {
      ...pair("one-to-many"),
      entities: [...pair("one-to-many").entities, entity("e", [], { name: "empty" })],
      relationships: [relationship("bad", "p", "gone")],
    };
    const sql = generateDdl(document, "postgres");
    expect(sql).not.toContain("ALTER TABLE");
    expect(sql).not.toContain('"empty"');
  });

  it("qualifies Postgres tables with any schema and MySQL only with a non-public one", () => {
    const document = (schema: string | undefined) => ({
      ...blogDocument(),
      entities: [
        entity("e", [field("f", { name: "id", primaryKey: true })], { name: "t", schema }),
      ],
      relationships: [],
      enums: [],
    });
    expect(generateDdl(document("app"), "postgres")).toContain('CREATE TABLE "app"."t"');
    expect(generateDdl(document("public"), "postgres")).toContain('CREATE TABLE "public"."t"');
    expect(generateDdl(document(undefined), "postgres")).toContain('CREATE TABLE "t"');
    expect(generateDdl(document("app"), "mysql")).toContain("CREATE TABLE `app`.`t`");
    expect(generateDdl(document("public"), "mysql")).toContain("CREATE TABLE `t`");
    expect(generateDdl(document(undefined), "mysql")).toContain("CREATE TABLE `t`");
  });

  it("returns an empty script for an empty model and is deterministic", () => {
    expect(
      generateDdl({ ...blogDocument(), entities: [], relationships: [], enums: [] }, "postgres"),
    ).toBe("");
    expect(generateDdl(blogDocument(), "mysql")).toBe(generateDdl(blogDocument(), "mysql"));
  });

  const typedDocument = (types: string[]) => ({
    ...blogDocument(),
    relationships: [],
    enums: [],
    entities: [
      entity(
        "e",
        types.map((type, index) => field(`f${index}`, { name: `c_${type}`, type })),
        { name: "t" },
      ),
    ],
  });

  it("maps portable types onto MySQL equivalents", () => {
    const sql = generateDdl(
      typedDocument(["uuid", "jsonb", "varchar", "serial", "money", "array", "timestamptz"]),
      "mysql",
    );
    expect(sql).toContain("`c_uuid` CHAR(36)");
    expect(sql).toContain("`c_jsonb` JSON");
    expect(sql).toContain("`c_varchar` VARCHAR(255)");
    expect(sql).toContain("`c_serial` INT");
    expect(sql).toContain("`c_money` DECIMAL(19,4)");
    expect(sql).toContain("`c_array` JSON");
    expect(sql).toContain("`c_timestamptz` TIMESTAMP");
  });

  it("maps MySQL-only types onto Postgres equivalents", () => {
    const sql = generateDdl(
      typedDocument(["datetime", "longtext", "blob", "double", "year", "array", "serial"]),
      "postgres",
    );
    expect(sql).toContain('"c_datetime" timestamp');
    expect(sql).toContain('"c_longtext" text');
    expect(sql).toContain('"c_blob" bytea');
    expect(sql).toContain('"c_double" double precision');
    expect(sql).toContain('"c_year" smallint');
    expect(sql).toContain('"c_array" text[]');
    expect(sql).toContain('"c_serial" serial');
  });

  it("never emits identity or auto-increment clauses", () => {
    const sql = generateDdl(blogDocument(), "postgres") + generateDdl(blogDocument(), "mysql");
    expect(sql).not.toMatch(/IDENTITY|AUTO_INCREMENT/);
  });
});

describe("ddl quoting", () => {
  it("doubles embedded quote characters", () => {
    expect(quoteIdentifier('a"b', "postgres")).toBe('"a""b"');
    expect(quoteIdentifier("a`b", "mysql")).toBe("`a``b`");
    expect(quoteLiteral("it's", "postgres")).toBe("'it''s'");
    expect(quoteLiteral("a\\b", "mysql")).toBe("'a\\\\b'");
  });

  it("renders defaults as literals, numbers or expressions", () => {
    expect(renderDefault("42", "postgres")).toBe("42");
    expect(renderDefault("now()", "postgres")).toBe("now()");
    expect(renderDefault("current_timestamp", "postgres")).toBe("CURRENT_TIMESTAMP");
    expect(renderDefault("hello", "postgres")).toBe("'hello'");
    expect(renderDefault("'x'", "postgres")).toBe("'x'");
  });
});
