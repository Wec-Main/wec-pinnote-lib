import type {
  ErdDocumentJSON,
  ErdEntity,
  ErdField,
  ErdRelationship,
} from "../src/types/dataModel.types";

export function field(id: string, overrides: Partial<ErdField> = {}): ErdField {
  return {
    id,
    name: id,
    type: "integer",
    nullable: true,
    primaryKey: false,
    unique: false,
    ...overrides,
  };
}

export function entity(
  id: string,
  fields: ErdField[],
  overrides: Partial<ErdEntity> = {},
): ErdEntity {
  return { id, name: id, position: { x: 0, y: 0 }, fields, indexes: [], ...overrides };
}

export function relationship(
  id: string,
  sourceEntityId: string,
  targetEntityId: string,
  overrides: Partial<ErdRelationship> = {},
): ErdRelationship {
  return {
    id,
    sourceEntityId,
    targetEntityId,
    cardinality: "one-to-many",
    sourceOptional: false,
    targetOptional: true,
    onDelete: "no-action",
    onUpdate: "no-action",
    ...overrides,
  };
}

export function blogDocument(): ErdDocumentJSON {
  return {
    version: 1,
    engine: "postgres",
    entities: [
      entity(
        "users",
        [
          field("users_id", { name: "id", primaryKey: true, nullable: false }),
          field("users_email", {
            name: "email",
            type: "varchar",
            length: 255,
            nullable: false,
            unique: true,
          }),
          field("users_role", {
            name: "role",
            type: "text",
            enumId: "role_enum",
            defaultValue: "member",
          }),
        ],
        { name: "users", comment: "App users" },
      ),
      entity(
        "posts",
        [
          field("posts_id", { name: "id", primaryKey: true, nullable: false }),
          field("posts_author", { name: "author_id", nullable: false }),
          field("posts_title", {
            name: "title",
            type: "varchar",
            length: 120,
            nullable: false,
          }),
          field("posts_score", {
            name: "score",
            type: "numeric",
            precision: 10,
            scale: 2,
            defaultValue: "0",
          }),
          field("posts_flag", { name: "published", type: "boolean", defaultValue: "false" }),
        ],
        {
          name: "posts",
          indexes: [
            { id: "idx1", name: "idx_posts_author", fieldIds: ["posts_author"], unique: false },
          ],
        },
      ),
      entity(
        "tags",
        [
          field("tags_id", { name: "id", primaryKey: true, nullable: false }),
          field("tags_label", { name: "label", type: "text" }),
        ],
        { name: "tags" },
      ),
    ],
    relationships: [
      relationship("r1", "users", "posts", {
        sourceFieldId: "users_id",
        targetFieldId: "posts_author",
        onDelete: "cascade",
        onUpdate: "restrict",
      }),
      relationship("r2", "posts", "tags", {
        cardinality: "many-to-many",
      }),
    ],
    enums: [{ id: "role_enum", name: "user_role", values: ["admin", "member"] }],
    notes: [],
    meta: { name: "Blog" },
  };
}
