import {
  DATA_MODEL_ENGINES,
  ERD_DOCUMENT_VERSION,
  ERD_INDEX_METHODS,
  type DataModelEngine,
  type ErdCardinality,
  type ErdDocumentJSON,
  type ErdDocumentMeta,
  type ErdEntity,
  type ErdEnum,
  type ErdField,
  type ErdIndex,
  type ErdIndexMethod,
  type ErdNote,
  type ErdPoint,
  type ErdReferentialAction,
  type ErdRelationship,
  type ErdViewport,
} from "../../types/dataModel.types";
import { ERD_DEFAULT_MODEL_NAME, NOTE_DEFAULT_SIZE } from "./erdConstants";

export class ErdParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ErdParseError";
  }
}

type RawRecord = Record<string, unknown>;

const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);
const CARDINALITIES: readonly ErdCardinality[] = ["one-to-one", "one-to-many", "many-to-many"];
const ACTIONS: readonly ErdReferentialAction[] = ["cascade", "restrict", "set-null", "no-action"];

function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return requireArray(value, path).map((entry, i) => requireString(entry, `${path}[${i}]`));
}

function optionalStringRecord(value: unknown, path: string): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  const record = requireRecord(value, path);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (UNSAFE_KEYS.has(key)) continue;
    out[key] = requireString(entry, `${path}.${key}`);
  }
  return out;
}

function parseGenerated(
  value: unknown,
  path: string,
): { expression: string; stored?: boolean } | undefined {
  if (value === undefined || value === null) return undefined;
  const record = requireRecord(value, path);
  const generated: { expression: string; stored?: boolean } = {
    expression: requireString(record.expression, `${path}.expression`),
  };
  if (record.stored !== undefined) {
    generated.stored = booleanOr(record.stored, false, `${path}.stored`);
  }
  return generated;
}

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function fail(path: string, expectation: string): never {
  throw new ErdParseError(`${path} must be ${expectation}`);
}

function requireRecord(value: unknown, path: string): RawRecord {
  return isRecord(value) ? value : fail(path, "an object");
}

function requireString(value: unknown, path: string): string {
  return typeof value === "string" ? value : fail(path, "a string");
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined || value === null ? undefined : requireString(value, path);
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : fail(path, "a number");
}

function booleanOr(value: unknown, fallback: boolean, path: string): boolean {
  if (value === undefined) return fallback;
  return typeof value === "boolean" ? value : fail(path, "a boolean");
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  path: string,
): T {
  if (value === undefined) return fallback;
  const match = allowed.find((candidate) => candidate === value);
  return match ?? fail(path, `one of ${allowed.join(", ")}`);
}

function requireArray(value: unknown, path: string): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : fail(path, "an array");
}

function parsePoint(value: unknown, path: string): ErdPoint {
  if (value === undefined) return { x: 0, y: 0 };
  const record = requireRecord(value, path);
  return {
    x: optionalNumber(record.x, `${path}.x`) ?? 0,
    y: optionalNumber(record.y, `${path}.y`) ?? 0,
  };
}

function parseField(value: unknown, path: string): ErdField {
  const record = requireRecord(value, path);
  const field: ErdField = {
    id: requireString(record.id, `${path}.id`),
    name: optionalString(record.name, `${path}.name`) ?? "",
    type: optionalString(record.type, `${path}.type`) ?? "text",
    nullable: booleanOr(record.nullable, true, `${path}.nullable`),
    primaryKey: booleanOr(record.primaryKey, false, `${path}.primaryKey`),
    unique: booleanOr(record.unique, false, `${path}.unique`),
  };
  const length = optionalNumber(record.length, `${path}.length`);
  const precision = optionalNumber(record.precision, `${path}.precision`);
  const scale = optionalNumber(record.scale, `${path}.scale`);
  const defaultValue = optionalString(record.defaultValue, `${path}.defaultValue`);
  const enumId = optionalString(record.enumId, `${path}.enumId`);
  const comment = optionalString(record.comment, `${path}.comment`);
  const check = optionalString(record.check, `${path}.check`);
  const generated = parseGenerated(record.generated, `${path}.generated`);
  if (length !== undefined) field.length = length;
  if (precision !== undefined) field.precision = precision;
  if (scale !== undefined) field.scale = scale;
  if (defaultValue !== undefined) field.defaultValue = defaultValue;
  if (enumId !== undefined) field.enumId = enumId;
  if (comment !== undefined) field.comment = comment;
  if (check !== undefined) field.check = check;
  if (generated !== undefined) field.generated = generated;
  return field;
}

function parseIndexMethod(value: unknown, path: string): ErdIndexMethod | undefined {
  if (value === undefined || value === null) return undefined;
  const match = ERD_INDEX_METHODS.find((method) => method === value);
  return match ?? fail(path, `one of ${ERD_INDEX_METHODS.join(", ")}`);
}

function parseIndex(value: unknown, path: string): ErdIndex {
  const record = requireRecord(value, path);
  const index: ErdIndex = {
    id: requireString(record.id, `${path}.id`),
    name: optionalString(record.name, `${path}.name`) ?? "",
    fieldIds: requireArray(record.fieldIds, `${path}.fieldIds`).map((id, i) =>
      requireString(id, `${path}.fieldIds[${i}]`),
    ),
    unique: booleanOr(record.unique, false, `${path}.unique`),
  };
  const method = parseIndexMethod(record.method, `${path}.method`);
  const where = optionalString(record.where, `${path}.where`);
  if (method !== undefined) index.method = method;
  if (where !== undefined) index.where = where;
  return index;
}

function parseEntity(value: unknown, path: string): ErdEntity {
  const record = requireRecord(value, path);
  const entity: ErdEntity = {
    id: requireString(record.id, `${path}.id`),
    name: optionalString(record.name, `${path}.name`) ?? "",
    position: parsePoint(record.position, `${path}.position`),
    fields: requireArray(record.fields, `${path}.fields`).map((field, i) =>
      parseField(field, `${path}.fields[${i}]`),
    ),
    indexes: requireArray(record.indexes, `${path}.indexes`).map((index, i) =>
      parseIndex(index, `${path}.indexes[${i}]`),
    ),
  };
  const schema = optionalString(record.schema, `${path}.schema`);
  const comment = optionalString(record.comment, `${path}.comment`);
  const width = optionalNumber(record.width, `${path}.width`);
  const color = optionalString(record.color, `${path}.color`);
  const group = optionalString(record.group, `${path}.group`);
  if (schema !== undefined) entity.schema = schema;
  if (comment !== undefined) entity.comment = comment;
  if (width !== undefined) entity.width = width;
  if (color !== undefined) entity.color = color;
  if (group !== undefined) entity.group = group;
  if (record.collapsed !== undefined) {
    entity.collapsed = booleanOr(record.collapsed, false, `${path}.collapsed`);
  }
  if (record.locked !== undefined) {
    entity.locked = booleanOr(record.locked, false, `${path}.locked`);
  }
  return entity;
}

function parseRelationship(value: unknown, path: string): ErdRelationship {
  const record = requireRecord(value, path);
  const relationship: ErdRelationship = {
    id: requireString(record.id, `${path}.id`),
    sourceEntityId: requireString(record.sourceEntityId, `${path}.sourceEntityId`),
    targetEntityId: requireString(record.targetEntityId, `${path}.targetEntityId`),
    cardinality: oneOf(record.cardinality, CARDINALITIES, "one-to-many", `${path}.cardinality`),
    sourceOptional: booleanOr(record.sourceOptional, false, `${path}.sourceOptional`),
    targetOptional: booleanOr(record.targetOptional, true, `${path}.targetOptional`),
    onDelete: oneOf(record.onDelete, ACTIONS, "no-action", `${path}.onDelete`),
    onUpdate: oneOf(record.onUpdate, ACTIONS, "no-action", `${path}.onUpdate`),
  };
  const name = optionalString(record.name, `${path}.name`);
  const sourceFieldId = optionalString(record.sourceFieldId, `${path}.sourceFieldId`);
  const targetFieldId = optionalString(record.targetFieldId, `${path}.targetFieldId`);
  const sourceFieldIds = optionalStringArray(record.sourceFieldIds, `${path}.sourceFieldIds`);
  const targetFieldIds = optionalStringArray(record.targetFieldIds, `${path}.targetFieldIds`);
  if (name !== undefined) relationship.name = name;
  if (sourceFieldId !== undefined) relationship.sourceFieldId = sourceFieldId;
  if (targetFieldId !== undefined) relationship.targetFieldId = targetFieldId;
  if (sourceFieldIds !== undefined) relationship.sourceFieldIds = sourceFieldIds;
  if (targetFieldIds !== undefined) relationship.targetFieldIds = targetFieldIds;
  return relationship;
}

function parseEnum(value: unknown, path: string): ErdEnum {
  const record = requireRecord(value, path);
  const entry: ErdEnum = {
    id: requireString(record.id, `${path}.id`),
    name: optionalString(record.name, `${path}.name`) ?? "",
    values: requireArray(record.values, `${path}.values`).map((item, i) =>
      requireString(item, `${path}.values[${i}]`),
    ),
  };
  const descriptions = optionalStringRecord(record.descriptions, `${path}.descriptions`);
  if (descriptions !== undefined) entry.descriptions = descriptions;
  return entry;
}

function parseNote(value: unknown, path: string): ErdNote {
  const record = requireRecord(value, path);
  const note: ErdNote = {
    id: requireString(record.id, `${path}.id`),
    text: optionalString(record.text, `${path}.text`) ?? "",
    position: parsePoint(record.position, `${path}.position`),
    width: optionalNumber(record.width, `${path}.width`) ?? NOTE_DEFAULT_SIZE.width,
    height: optionalNumber(record.height, `${path}.height`) ?? NOTE_DEFAULT_SIZE.height,
  };
  const color = optionalString(record.color, `${path}.color`);
  if (color !== undefined) note.color = color;
  return note;
}

function parseViewport(value: unknown): ErdViewport | undefined {
  if (value === undefined || value === null) return undefined;
  const record = requireRecord(value, "viewport");
  return {
    x: optionalNumber(record.x, "viewport.x") ?? 0,
    y: optionalNumber(record.y, "viewport.y") ?? 0,
    zoom: optionalNumber(record.zoom, "viewport.zoom") ?? 1,
  };
}

function parseMeta(value: unknown): ErdDocumentMeta {
  if (value === undefined || value === null) return {};
  const record = requireRecord(value, "meta");
  const meta: ErdDocumentMeta = {};
  for (const [key, entry] of Object.entries(record)) {
    if (!UNSAFE_KEYS.has(key)) meta[key] = entry;
  }
  const name = optionalString(record.name, "meta.name");
  if (name !== undefined) meta.name = name;
  return meta;
}

function parseEngine(value: unknown): DataModelEngine {
  const match = DATA_MODEL_ENGINES.find((engine) => engine === value);
  return match ?? fail("engine", `one of ${DATA_MODEL_ENGINES.join(", ")}`);
}

export function parseErdDocument(input: unknown): ErdDocumentJSON {
  let raw = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      throw new ErdParseError("Document is not valid JSON", { cause: error });
    }
  }
  const record = requireRecord(raw, "document");
  if (record.version !== ERD_DOCUMENT_VERSION) {
    throw new ErdParseError(`Unsupported document version ${String(record.version)}`);
  }
  const document: ErdDocumentJSON = {
    version: ERD_DOCUMENT_VERSION,
    engine: parseEngine(record.engine),
    entities: requireArray(record.entities, "entities").map((entity, i) =>
      parseEntity(entity, `entities[${i}]`),
    ),
    relationships: requireArray(record.relationships, "relationships").map((rel, i) =>
      parseRelationship(rel, `relationships[${i}]`),
    ),
    enums: requireArray(record.enums, "enums").map((entry, i) => parseEnum(entry, `enums[${i}]`)),
    notes: requireArray(record.notes, "notes").map((note, i) => parseNote(note, `notes[${i}]`)),
    meta: parseMeta(record.meta),
  };
  const viewport = parseViewport(record.viewport);
  if (viewport) document.viewport = viewport;
  return document;
}

export function createEmptyErdDocument(
  engine: DataModelEngine = "na",
  name: string = ERD_DEFAULT_MODEL_NAME,
): ErdDocumentJSON {
  return {
    version: ERD_DOCUMENT_VERSION,
    engine,
    entities: [],
    relationships: [],
    enums: [],
    notes: [],
    meta: { name },
  };
}

export function stringifyErdDocument(document: ErdDocumentJSON): string {
  return JSON.stringify(document, null, 2);
}
