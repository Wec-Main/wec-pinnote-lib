export const DATA_MODEL_ENGINES = ["na", "postgres", "mysql", "sqlite"] as const;
export type DataModelEngine = (typeof DATA_MODEL_ENGINES)[number];
export type ErdEngineName = DataModelEngine;

export const ERD_DOCUMENT_VERSION = 1;

export type ErdCardinality = "one-to-one" | "one-to-many" | "many-to-many";
export type ErdReferentialAction = "cascade" | "restrict" | "set-null" | "no-action";

export interface ErdPoint {
  x: number;
  y: number;
}

export interface ErdViewport extends ErdPoint {
  zoom: number;
}

export interface ErdField {
  id: string;
  name: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string;
  enumId?: string;
  comment?: string;
  check?: string;
  generated?: { expression: string; stored?: boolean };
}

export const ERD_INDEX_METHODS = ["btree", "gin", "gist", "hash", "brin"] as const;
export type ErdIndexMethod = (typeof ERD_INDEX_METHODS)[number];

export interface ErdIndex {
  id: string;
  name: string;
  fieldIds: string[];
  unique: boolean;
  method?: ErdIndexMethod;
  where?: string;
}

export interface ErdEntity {
  id: string;
  name: string;
  schema?: string;
  comment?: string;
  position: ErdPoint;
  width?: number;
  collapsed?: boolean;
  fields: ErdField[];
  indexes: ErdIndex[];
  color?: string;
  fillColor?: string;
  group?: string;
  locked?: boolean;
}

export interface ErdRelationship {
  id: string;
  name?: string;
  sourceEntityId: string;
  sourceFieldId?: string;
  sourceFieldIds?: string[];
  targetEntityId: string;
  targetFieldId?: string;
  targetFieldIds?: string[];
  cardinality: ErdCardinality;
  sourceOptional: boolean;
  targetOptional: boolean;
  onDelete: ErdReferentialAction;
  onUpdate: ErdReferentialAction;
}

export interface ErdEnum {
  id: string;
  name: string;
  values: string[];
  descriptions?: Record<string, string>;
}

export interface ErdNote {
  id: string;
  text: string;
  position: ErdPoint;
  width: number;
  height: number;
  color?: string;
  titleColor?: string;
}

export interface ErdDocumentMeta {
  name?: string;
  [key: string]: unknown;
}

export interface ErdDocumentJSON {
  version: 1;
  engine: DataModelEngine;
  entities: ErdEntity[];
  relationships: ErdRelationship[];
  enums: ErdEnum[];
  notes: ErdNote[];
  viewport?: ErdViewport;
  meta: ErdDocumentMeta;
}

export interface DataModelSummary {
  id: string;
  projectId: string;
  name: string;
  engine: DataModelEngine;
  updatedAt: string;
}

export interface DataModel {
  id: string;
  projectId: string;
  name: string;
  description: string;
  engine: DataModelEngine;
  status: string;
  createdByUser: string;
  createdById: string | null;
  updatedByUser: string | null;
  updatedById: string | null;
  entityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataModelDraft {
  name: string;
  description?: string;
  engine: DataModelEngine;
}

export interface DataModelDocumentRecord {
  dataModel: DataModelSummary;
  revision: number;
  document: ErdDocumentJSON;
}

export interface DataModelVersionRecord {
  id: string;
  dataModelId: string;
  version: number;
  publishedById: string | null;
  publishedByUser: string | null;
  publishedAt: string;
}

export interface DataModelVersionDetail extends DataModelVersionRecord {
  document: ErdDocumentJSON;
}
