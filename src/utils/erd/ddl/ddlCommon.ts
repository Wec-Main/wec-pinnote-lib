import type {
  ErdDocumentJSON,
  ErdEntity,
  ErdField,
  ErdReferentialAction,
} from "../../../types/dataModel.types";
import { normalizeType } from "../erdTypes";

export type DdlDialect = "postgres" | "mysql";

export interface DdlForeignKey {
  table: ErdEntity;
  columns: ErdField[];
  referencedTable: ErdEntity;
  referencedColumns: ErdField[];
  name: string;
  onDelete: ErdReferentialAction;
  onUpdate: ErdReferentialAction;
  uniqueConstraint: string | null;
}

export interface DdlModel {
  tables: ErdEntity[];
  foreignKeys: DdlForeignKey[];
}

const ACTION_SQL: Record<ErdReferentialAction, string> = {
  cascade: "CASCADE",
  restrict: "RESTRICT",
  "set-null": "SET NULL",
  "no-action": "NO ACTION",
};

const NUMERIC_LITERAL = /^-?\d+(\.\d+)?$/;
const KEYWORD_LITERAL = /^(null|true|false|current_timestamp|current_date|current_time)$/i;
const FUNCTION_CALL = /^[A-Za-z_][A-Za-z0-9_]*\(.*\)$/;
const QUOTED_LITERAL = /^'.*'$/s;

export function quoteIdentifier(name: string, dialect: DdlDialect): string {
  if (dialect === "mysql") return `\`${name.replaceAll("`", "``")}\``;
  return `"${name.replaceAll('"', '""')}"`;
}

export function quoteLiteral(value: string, dialect: DdlDialect): string {
  const escaped = dialect === "mysql" ? value.replaceAll("\\", "\\\\") : value;
  return `'${escaped.replaceAll("'", "''")}'`;
}

export function renderDefault(value: string, dialect: DdlDialect): string {
  const trimmed = value.trim();
  if (KEYWORD_LITERAL.test(trimmed)) return trimmed.toUpperCase();
  if (
    NUMERIC_LITERAL.test(trimmed) ||
    FUNCTION_CALL.test(trimmed) ||
    QUOTED_LITERAL.test(trimmed)
  ) {
    return trimmed;
  }
  return quoteLiteral(trimmed, dialect);
}

function schemaQualifies(schema: string | undefined, dialect: DdlDialect): schema is string {
  if (!schema) return false;
  return dialect === "postgres" || schema !== "public";
}

export function qualifiedTableName(entity: ErdEntity, dialect: DdlDialect): string {
  const table = quoteIdentifier(entity.name, dialect);
  return schemaQualifies(entity.schema, dialect)
    ? `${quoteIdentifier(entity.schema, dialect)}.${table}`
    : table;
}

export function referentialAction(action: ErdReferentialAction): string {
  return ACTION_SQL[action];
}

export function junctionTableName(sourceEntityName: string, targetEntityName: string): string {
  return `${sourceEntityName}_${targetEntityName}`;
}

export function fkName(tableName: string, columnNames: string, explicitName?: string): string {
  return explicitName && explicitName.trim() !== ""
    ? explicitName
    : `fk_${tableName}_${columnNames}`;
}

export function primaryKeyFields(entity: ErdEntity): ErdField[] {
  return entity.fields.filter((field) => field.primaryKey);
}

function uniqueName(base: string, taken: Set<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}_${n}`;
  taken.add(candidate);
  return candidate;
}

const SERIAL_BASE_TYPES: Record<string, string> = { serial: "integer", bigserial: "bigint" };

function referencingColumn(
  parent: ErdEntity,
  field: ErdField,
  taken: Set<string>,
  options: { nullable: boolean; primaryKey: boolean },
): ErdField {
  const column: ErdField = {
    id: `${parent.id}:${field.id}`,
    name: uniqueName(`${parent.name}_${field.name}`, taken),
    type: SERIAL_BASE_TYPES[normalizeType(field.type)] ?? field.type,
    nullable: options.nullable,
    primaryKey: options.primaryKey,
    unique: false,
  };
  if (field.length !== undefined) column.length = field.length;
  if (field.precision !== undefined) column.precision = field.precision;
  if (field.scale !== undefined) column.scale = field.scale;
  return column;
}

function explicitField(entity: ErdEntity, fieldId: string | undefined): ErdField | undefined {
  return fieldId === undefined ? undefined : entity.fields.find((field) => field.id === fieldId);
}

function referencedColumnsOf(parent: ErdEntity, fieldId: string | undefined): ErdField[] {
  const explicit = explicitField(parent, fieldId);
  return explicit ? [explicit] : primaryKeyFields(parent);
}

function coversPrimaryKey(entity: ErdEntity, columns: readonly ErdField[]): boolean {
  const keys = primaryKeyFields(entity);
  return keys.length === columns.length && columns.every((column) => column.primaryKey);
}

export function buildDdlModel(document: ErdDocumentJSON): DdlModel {
  const lookup = new Map(document.entities.map((entity) => [entity.id, entity]));
  const tableById = new Map<string, ErdEntity>();
  for (const entity of document.entities) {
    if (entity.fields.length > 0)
      tableById.set(entity.id, { ...entity, fields: [...entity.fields] });
  }
  const junctions: ErdEntity[] = [];
  const foreignKeys: DdlForeignKey[] = [];
  const names = new Set<string>();
  const addForeignKey = (
    table: ErdEntity,
    columns: ErdField[],
    referencedTable: ErdEntity,
    referencedColumns: ErdField[],
    relationship: ErdDocumentJSON["relationships"][number],
    uniqueConstraint: string | null,
  ) => {
    const columnNames = columns.map((column) => column.name).join("_");
    foreignKeys.push({
      table,
      columns,
      referencedTable,
      referencedColumns,
      name: uniqueName(fkName(table.name, columnNames, relationship.name), names),
      onDelete: relationship.onDelete,
      onUpdate: relationship.onUpdate,
      uniqueConstraint,
    });
  };
  for (const relationship of document.relationships) {
    const source = lookup.get(relationship.sourceEntityId);
    const target = lookup.get(relationship.targetEntityId);
    if (!source || !target) continue;
    const parentColumns = referencedColumnsOf(source, relationship.sourceFieldId);
    if (relationship.cardinality === "many-to-many") {
      const targetColumns = referencedColumnsOf(target, relationship.targetFieldId);
      if (parentColumns.length === 0 || targetColumns.length === 0) continue;
      const taken = new Set<string>();
      const options = { nullable: false, primaryKey: true };
      const sourceJunctionColumns = parentColumns.map((field) =>
        referencingColumn(source, field, taken, options),
      );
      const targetJunctionColumns = targetColumns.map((field) =>
        referencingColumn(target, field, taken, options),
      );
      const junction: ErdEntity = {
        id: `junction:${relationship.id}`,
        name: junctionTableName(source.name, target.name),
        position: { x: 0, y: 0 },
        fields: [...sourceJunctionColumns, ...targetJunctionColumns],
        indexes: [],
      };
      junctions.push(junction);
      addForeignKey(junction, sourceJunctionColumns, source, parentColumns, relationship, null);
      addForeignKey(junction, targetJunctionColumns, target, targetColumns, relationship, null);
      continue;
    }
    const child = tableById.get(target.id);
    if (!child || parentColumns.length === 0) continue;
    const explicitChild =
      parentColumns.length === 1 ? explicitField(target, relationship.targetFieldId) : undefined;
    const childColumns = explicitChild
      ? [explicitChild]
      : parentColumns.map((field) => {
          const name = `${source.name}_${field.name}`;
          const existing = child.fields.find((candidate) => candidate.name === name);
          if (existing) return existing;
          const column = referencingColumn(source, field, new Set(), {
            nullable: relationship.targetOptional,
            primaryKey: false,
          });
          child.fields.push(column);
          return column;
        });
    const single = childColumns.length === 1 ? childColumns[0] : undefined;
    const needsUnique =
      relationship.cardinality === "one-to-one" &&
      !(single?.unique ?? false) &&
      !coversPrimaryKey(child, childColumns);
    const uniqueConstraint = needsUnique
      ? `uq_${child.name}_${childColumns.map((column) => column.name).join("_")}`
      : null;
    addForeignKey(child, childColumns, source, parentColumns, relationship, uniqueConstraint);
  }
  return { tables: [...tableById.values(), ...junctions], foreignKeys };
}

export function renderIndexes(model: DdlModel, dialect: DdlDialect): string[] {
  return model.tables.flatMap((table) =>
    table.indexes.flatMap((index) => {
      const columns = index.fieldIds
        .map((id) => table.fields.find((field) => field.id === id))
        .filter((field): field is ErdField => field !== undefined);
      if (columns.length === 0) return [];
      const name =
        index.name.trim() === ""
          ? `idx_${table.name}_${columns.map((column) => column.name).join("_")}`
          : index.name;
      const list = columns.map((column) => quoteIdentifier(column.name, dialect)).join(", ");
      const keyword = index.unique ? "CREATE UNIQUE INDEX" : "CREATE INDEX";
      return [
        `${keyword} ${quoteIdentifier(name, dialect)} ON ${qualifiedTableName(table, dialect)} (${list});`,
      ];
    }),
  );
}

export function renderForeignKeys(model: DdlModel, dialect: DdlDialect): string[] {
  const list = (columns: readonly ErdField[]) =>
    columns.map((column) => quoteIdentifier(column.name, dialect)).join(", ");
  return model.foreignKeys.flatMap((key) => {
    const table = qualifiedTableName(key.table, dialect);
    const unique = key.uniqueConstraint
      ? [
          `ALTER TABLE ${table} ADD CONSTRAINT ${quoteIdentifier(key.uniqueConstraint, dialect)} UNIQUE (${list(key.columns)});`,
        ]
      : [];
    const reference = `${qualifiedTableName(key.referencedTable, dialect)} (${list(key.referencedColumns)})`;
    return [
      ...unique,
      `ALTER TABLE ${table} ADD CONSTRAINT ${quoteIdentifier(key.name, dialect)} FOREIGN KEY (${list(key.columns)}) REFERENCES ${reference} ON DELETE ${referentialAction(key.onDelete)} ON UPDATE ${referentialAction(key.onUpdate)};`,
    ];
  });
}

export function joinStatements(statements: readonly string[]): string {
  return statements.length === 0 ? "" : `${statements.join("\n\n")}\n`;
}
