import { describe, expect, it } from "vitest";
import { generateTypeScript } from "../src/utils/erd/codegen/typescript";
import { generatePrismaSchema } from "../src/utils/erd/codegen/prisma";
import { generateDrizzleSchema } from "../src/utils/erd/codegen/drizzle";
import { generateOpenApiSchemas } from "../src/utils/erd/codegen/openapi";
import { blogDocument } from "./erdFixtures";

describe("generateTypeScript", () => {
  it("emits an interface, a zod schema and an enum type per entity", () => {
    const code = generateTypeScript(blogDocument());
    expect(code).toContain('import { z } from "zod";');
    expect(code).toContain('export type UserRole = "admin" | "member";');
    expect(code).toContain("export interface Users {");
    expect(code).toContain("  id: number;");
    expect(code).toContain("  role?: UserRole | null;");
    expect(code).toContain("export const usersSchema = z.object({");
    expect(code).toContain('role: z.enum(["admin", "member"]).nullable().optional(),');
    expect(code).toContain("export interface Tags {");
    expect(code).toContain("  label?: string | null;");
  });

  it("returns an empty string for an empty document", () => {
    expect(
      generateTypeScript({ ...blogDocument(), entities: [], relationships: [], enums: [] }),
    ).toBe("");
  });
});

describe("generatePrismaSchema", () => {
  it("emits the datasource, models, relations and enum", () => {
    const schema = generatePrismaSchema(blogDocument());
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain("model Users {");
    expect(schema).toContain("model Posts {");
    expect(schema).toContain(
      "users Users? @relation(fields: [author_id], references: [id], onDelete: Cascade, onUpdate: Restrict)",
    );
    expect(schema).toContain("posts Posts[]");
    expect(schema).toContain("enum UserRole {");
    expect(schema).toContain("@default(member)");
  });

  it("maps the sqlite engine onto the sqlite datasource provider", () => {
    const schema = generatePrismaSchema({ ...blogDocument(), engine: "sqlite" });
    expect(schema).toContain('provider = "sqlite"');
  });
});

describe("generateDrizzleSchema", () => {
  it("emits pg-core table definitions with a foreign key reference", () => {
    const code = generateDrizzleSchema(blogDocument());
    expect(code).toContain('from "drizzle-orm/pg-core"');
    expect(code).toContain('export const users = pgTable("users", {');
    expect(code).toContain('id: integer("id").primaryKey(),');
    expect(code).toContain('email: varchar("email", { length: 255 }).notNull().unique(),');
    expect(code).toContain('author_id: integer("author_id").notNull().references(() => users.id),');
  });

  it("switches to sqlite-core builders for a sqlite engine document", () => {
    const code = generateDrizzleSchema({ ...blogDocument(), engine: "sqlite" });
    expect(code).toContain('from "drizzle-orm/sqlite-core"');
    expect(code).toContain("sqliteTable(");
  });

  it("returns an empty string for an empty document", () => {
    expect(
      generateDrizzleSchema({ ...blogDocument(), entities: [], relationships: [], enums: [] }),
    ).toBe("");
  });
});

describe("generateOpenApiSchemas", () => {
  it("emits a components.schemas object with required fields and enum values", () => {
    const json = JSON.parse(generateOpenApiSchemas(blogDocument()));
    expect(json.components.schemas.Users).toEqual({
      type: "object",
      properties: {
        id: { type: "integer" },
        email: { type: "string" },
        role: { type: ["string", "null"], enum: ["admin", "member"] },
      },
      required: ["id", "email"],
    });
    expect(json.components.schemas.Posts.properties.published).toEqual({
      type: ["boolean", "null"],
    });
  });
});
