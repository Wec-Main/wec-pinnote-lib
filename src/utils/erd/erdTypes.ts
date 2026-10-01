import type { DataModelEngine, ErdField } from "../../types/dataModel.types";

export type ErdTypeGroup =
  | "Numeric"
  | "Text"
  | "Boolean"
  | "Date/Time"
  | "Binary"
  | "JSON/XML"
  | "Identifiers"
  | "Network/Geo/Other";

export interface ErdTypeOption {
  value: string;
  label: string;
  group: ErdTypeGroup;
}

const GROUPED_TYPES: ReadonlyArray<readonly [ErdTypeGroup, readonly string[]]> = [
  [
    "Numeric",
    [
      "smallint",
      "integer",
      "bigint",
      "serial",
      "bigserial",
      "decimal",
      "numeric",
      "real",
      "double",
      "float",
      "money",
    ],
  ],
  ["Text", ["char", "varchar", "text", "tinytext", "mediumtext", "longtext"]],
  ["Boolean", ["boolean"]],
  [
    "Date/Time",
    ["date", "time", "timetz", "timestamp", "timestamptz", "datetime", "year", "interval"],
  ],
  ["Binary", ["bytea", "blob", "varbinary", "binary"]],
  ["JSON/XML", ["json", "jsonb", "xml"]],
  ["Identifiers", ["uuid"]],
  ["Network/Geo/Other", ["inet", "cidr", "macaddr", "point", "geometry", "tsvector", "array"]],
];

const TYPE_LABELS: Readonly<Record<string, string>> = {
  timestamptz: "TIMESTAMP WITH TIME ZONE",
  timetz: "TIME WITH TIME ZONE",
  double: "DOUBLE PRECISION",
  macaddr: "MAC ADDRESS",
  inet: "INET",
  tsvector: "TSVECTOR",
  uuid: "UUID",
  json: "JSON",
  jsonb: "JSONB",
  xml: "XML",
};

const ALL_TYPES: readonly ErdTypeOption[] = GROUPED_TYPES.flatMap(([group, values]) =>
  values.map((value) => ({ value, label: TYPE_LABELS[value] ?? value.toUpperCase(), group })),
);

const EXCLUDED_BY_ENGINE: Record<"postgres" | "mysql", ReadonlySet<string>> = {
  postgres: new Set([
    "datetime",
    "year",
    "tinytext",
    "mediumtext",
    "longtext",
    "blob",
    "varbinary",
    "binary",
  ]),
  mysql: new Set([
    "serial",
    "bigserial",
    "bytea",
    "jsonb",
    "timestamptz",
    "timetz",
    "interval",
    "money",
    "inet",
    "cidr",
    "macaddr",
    "tsvector",
    "array",
    "xml",
  ]),
};

const SQLITE_TYPES: ReadonlySet<string> = new Set([
  "integer",
  "real",
  "text",
  "blob",
  "numeric",
  "boolean",
  "date",
  "datetime",
  "timestamp",
  "json",
  "varchar",
  "char",
  "decimal",
  "double",
  "float",
  "bigint",
  "smallint",
]);

const TYPE_ALIASES: Record<string, string> = {
  int: "integer",
  int4: "integer",
  mediumint: "integer",
  int2: "smallint",
  smallserial: "smallint",
  int8: "bigint",
  bool: "boolean",
  "character varying": "varchar",
  character: "char",
  float4: "real",
  float8: "double",
  "double precision": "double",
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
};

const LENGTH_TYPES: ReadonlySet<string> = new Set([
  "varchar",
  "char",
  "varbinary",
  "binary",
  "bit",
]);
const PRECISION_TYPES: ReadonlySet<string> = new Set(["decimal", "numeric"]);

export function typeCatalogFor(engine: DataModelEngine): readonly ErdTypeOption[] {
  if (engine === "na") return ALL_TYPES;
  if (engine === "sqlite") return ALL_TYPES.filter((option) => SQLITE_TYPES.has(option.value));
  const excluded = EXCLUDED_BY_ENGINE[engine];
  return ALL_TYPES.filter((option) => !excluded.has(option.value));
}

export function normalizeType(value: string): string {
  const base = value.trim().toLowerCase().replace(/\s+/g, " ");
  return TYPE_ALIASES[base] ?? base;
}

export function needsLength(value: string): boolean {
  return LENGTH_TYPES.has(normalizeType(value));
}

export function needsPrecision(value: string): boolean {
  return PRECISION_TYPES.has(normalizeType(value));
}

export function formatFieldType(
  field: Pick<ErdField, "type" | "length" | "precision" | "scale">,
  typeName: string = field.type,
): string {
  if (needsLength(field.type) && field.length !== undefined) {
    return `${typeName}(${field.length})`;
  }
  if (needsPrecision(field.type) && field.precision !== undefined) {
    const scale = field.scale === undefined ? "" : `,${field.scale}`;
    return `${typeName}(${field.precision}${scale})`;
  }
  return typeName;
}

export function typesCompatible(a: Pick<ErdField, "type">, b: Pick<ErdField, "type">): boolean {
  return normalizeType(a.type) === normalizeType(b.type);
}
