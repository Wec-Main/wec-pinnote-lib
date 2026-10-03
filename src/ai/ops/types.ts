import type {
  DataModelEngine,
  ErdCardinality,
  ErdReferentialAction,
} from "../../types/dataModel.types";
import type { PropertyValue } from "../../types/flowchart.types";
import type { NodeTypeDefinition } from "../../utils/flowchart/nodeTypes";

export type OpRef = string;

export type WorkspaceOp =
  | { op: "createEpic"; tempId?: string; title: string; description: string }
  | { op: "updateEpic"; epic: OpRef; title?: string; description?: string; label?: string }
  | {
      op: "createUserStory";
      tempId?: string;
      epic: OpRef;
      title: string;
      description: string;
      label?: string;
    }
  | { op: "updateUserStory"; story: OpRef; title?: string; description?: string; label?: string }
  | { op: "createFlow"; tempId?: string; name: string; description?: string; ops: FlowOp[] }
  | {
      op: "createDataModel";
      tempId?: string;
      name: string;
      description?: string;
      engine?: DataModelEngine;
      ops: ErdOp[];
    };

export type WorkspaceOpName = WorkspaceOp["op"];

export interface ErdOpFieldInput {
  name: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string | null;
  enum?: OpRef | null;
}

export type ErdFieldPatch = Partial<ErdOpFieldInput>;

export type ErdOp =
  | {
      op: "addEntity";
      tempId?: string;
      name: string;
      schema?: string;
      comment?: string;
      fields?: (ErdOpFieldInput & { tempId?: string })[];
      near?: OpRef;
    }
  | {
      op: "updateEntity";
      entity: OpRef;
      patch: { name?: string; schema?: string | null; comment?: string | null };
    }
  | { op: "removeEntity"; entity: OpRef }
  | {
      op: "addField";
      entity: OpRef;
      tempId?: string;
      field: ErdOpFieldInput;
      index?: number;
    }
  | { op: "updateField"; entity: OpRef; field: OpRef; patch: ErdFieldPatch }
  | { op: "removeField"; entity: OpRef; field: OpRef }
  | { op: "moveField"; entity: OpRef; field: OpRef; toIndex: number }
  | {
      op: "addRelationship";
      tempId?: string;
      name?: string;
      source: OpRef;
      sourceField?: OpRef;
      target: OpRef;
      targetField?: OpRef;
      cardinality: ErdCardinality;
      sourceOptional?: boolean;
      targetOptional?: boolean;
      onDelete?: ErdReferentialAction;
      onUpdate?: ErdReferentialAction;
    }
  | {
      op: "updateRelationship";
      relationship: OpRef;
      patch: {
        name?: string;
        cardinality?: ErdCardinality;
        sourceField?: OpRef | null;
        targetField?: OpRef | null;
        sourceOptional?: boolean;
        targetOptional?: boolean;
        onDelete?: ErdReferentialAction;
        onUpdate?: ErdReferentialAction;
      };
    }
  | { op: "removeRelationship"; relationship: OpRef }
  | {
      op: "addIndex";
      entity: OpRef;
      tempId?: string;
      name?: string;
      fields: OpRef[];
      unique?: boolean;
    }
  | {
      op: "updateIndex";
      entity: OpRef;
      index: OpRef;
      patch: { name?: string; fields?: OpRef[]; unique?: boolean };
    }
  | { op: "removeIndex"; entity: OpRef; index: OpRef }
  | { op: "addEnum"; tempId?: string; name: string; values: string[] }
  | { op: "updateEnum"; enum: OpRef; patch: { name?: string; values?: string[] } }
  | { op: "removeEnum"; enum: OpRef }
  | { op: "addNote"; tempId?: string; text: string; near?: OpRef; color?: string }
  | { op: "updateNote"; note: OpRef; patch: { text?: string; color?: string } }
  | { op: "removeNote"; note: OpRef }
  | { op: "setEngine"; engine: DataModelEngine }
  | { op: "setModelName"; name: string }
  | { op: "setModelDescription"; description: string }
  | { op: "autoLayout"; mode?: "grid" | "layered" };

export type ErdOpName = ErdOp["op"];

export type FlowEdgeKind = "bezier" | "straight" | "step";
export type FlowPlacement = "right" | "below" | "left" | "above";

export type FlowOp =
  | {
      op: "addNode";
      tempId?: string;
      type: string;
      label: string;
      description?: string;
      properties?: Record<string, PropertyValue>;
      near?: OpRef;
      placement?: FlowPlacement;
      lane?: OpRef;
    }
  | {
      op: "updateNode";
      node: OpRef;
      patch: {
        type?: string;
        label?: string;
        description?: string | null;
        properties?: Record<string, PropertyValue>;
      };
    }
  | { op: "removeNode"; node: OpRef }
  | {
      op: "addEdge";
      tempId?: string;
      source: OpRef;
      target: OpRef;
      sourceHandle?: string;
      targetHandle?: string;
      label?: string;
      type?: FlowEdgeKind;
    }
  | {
      op: "updateEdge";
      edge: OpRef;
      patch: { label?: string | null; type?: FlowEdgeKind; animated?: boolean };
    }
  | { op: "removeEdge"; edge: OpRef }
  | {
      op: "insertNodeOnEdge";
      edge: OpRef;
      tempId?: string;
      type: string;
      label: string;
      description?: string;
    }
  | { op: "setFlowName"; name: string }
  | { op: "setFlowNotes"; notes: string }
  | { op: "autoLayout"; direction?: "LR" | "TB" };

export type FlowOpName = FlowOp["op"];

export type OpErrorCode =
  | "invalid_shape"
  | "unknown_op"
  | "not_found"
  | "ambiguous_ref"
  | "duplicate_name"
  | "duplicate_temp_id"
  | "invalid_value"
  | "invalid_connection"
  | "limit_exceeded";

export interface OpError {
  index: number;
  op: string;
  code: OpErrorCode;
  message: string;
}

export interface DocDiff {
  added: string[];
  changed: string[];
  removed: string[];
}

export type ApplyOpsResult<D> =
  | {
      ok: true;
      document: D;
      idMap: Record<string, string>;
      diff: DocDiff;
      warnings: string[];
    }
  | { ok: false; errors: OpError[] };

export type ParseOpsResult<O> = { ok: true; ops: O[] } | { ok: false; errors: OpError[] };

export interface ApplyOpsOptions {
  createId?: (prefix: string) => string;
}

export interface ApplyFlowOpsOptions extends ApplyOpsOptions {
  nodeTypes?: readonly NodeTypeDefinition[];
}

export interface ErdSummaryField {
  id: string;
  name: string;
  type: string;
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
  enum?: string;
}

export interface ErdSummaryEntity {
  id: string;
  name: string;
  schema?: string;
  fieldCount: number;
  fieldNames: string[];
  fields?: ErdSummaryField[];
}

export interface ErdSummaryRelationship {
  id: string;
  name?: string;
  source: string;
  target: string;
  cardinality: string;
}

export interface ErdSummary {
  name: string;
  engine: string;
  entityCount: number;
  relationshipCount: number;
  enumCount: number;
  noteCount: number;
  truncated: boolean;
  entities: ErdSummaryEntity[];
  relationships: ErdSummaryRelationship[];
  enums: { id: string; name: string; values: string[] }[];
}

export interface FlowSummary {
  name: string | null;
  nodeCount: number;
  edgeCount: number;
  nodes: { id: string; type: string; label: string }[];
  edges: { id: string; source: string; target: string; sourceHandle?: string; label?: string }[];
}
