import { DATA_MODEL_ENGINES } from "../../types/dataModel.types";
import { AI_ERD_LIMITS, AI_FLOW_LIMITS } from "./limits";
import { toJsonSchema, type Shape } from "./shape";
import type { ErdOp, ErdOpName, FlowOp, FlowOpName } from "./types";

type OpKeys<U, N> = Exclude<keyof Extract<U, { op: N }>, "op"> & string;

export interface OpSpec<K extends string = string> {
  description: string;
  properties: Readonly<Record<K, Shape>>;
  required: readonly K[];
}

export type ErdOpSpecs = { readonly [N in ErdOpName]: OpSpec<OpKeys<ErdOp, N>> };
export type FlowOpSpecs = { readonly [N in FlowOpName]: OpSpec<OpKeys<FlowOp, N>> };

const ref = (description: string): Shape => ({
  type: "string",
  minLength: 1,
  description: `${description}: an id, a "$tempId" from an earlier op in this batch, or the exact name`,
});
const tempId: Shape = {
  type: "string",
  minLength: 1,
  description: 'Temporary id such as "$orders" that later ops in the batch can refer to',
};
const name = (description: string): Shape => ({ type: "string", minLength: 1, description });
const text = (description: string): Shape => ({ type: "string", description });
const flag = (description: string): Shape => ({ type: "boolean", description });
const nullable = (inner: Shape): Shape => ({ type: "nullable", inner });

const CARDINALITY: Shape = { type: "enum", values: ["one-to-one", "one-to-many", "many-to-many"] };
const ACTION: Shape = { type: "enum", values: ["cascade", "restrict", "set-null", "no-action"] };

const FIELD_PROPERTIES = {
  name: name("Column name, unique within the entity"),
  type: name('SQL-ish type as the editor shows it: "uuid", "varchar", "int", "timestamp", ...'),
  length: { type: "integer", minimum: 0 },
  precision: { type: "integer", minimum: 0 },
  scale: { type: "integer", minimum: 0 },
  nullable: flag("Default: true, or false for a primary key"),
  primaryKey: flag("Default: false"),
  unique: flag("Default: false"),
  defaultValue: nullable(text("SQL default expression")),
  enum: nullable(ref("Enum used by this field")),
} as const satisfies Record<string, Shape>;

const FIELD_INPUT: Shape = {
  type: "object",
  properties: FIELD_PROPERTIES,
  required: ["name", "type"],
};

const FIELD_PATCH: Shape = { type: "object", properties: FIELD_PROPERTIES };

export const ERD_OP_SPECS: ErdOpSpecs = {
  addEntity: {
    description:
      "Add an entity (table). Without fields it gets an integer `id` primary key. It is placed next to `near` or right of the right-most entity.",
    properties: {
      tempId,
      name: name("Entity name, unique in the model"),
      schema: text('Database schema; default "public"'),
      comment: text("Description of the entity"),
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: { ...FIELD_PROPERTIES, tempId },
          required: ["name", "type"],
        },
      },
      near: ref("Entity to place the new one next to"),
    },
    required: ["name"],
  },
  updateEntity: {
    description: "Rename an entity or change its schema or comment. null clears a value.",
    properties: {
      entity: ref("Entity"),
      patch: {
        type: "object",
        properties: {
          name: name("New entity name"),
          schema: nullable(text("Database schema")),
          comment: nullable(text("Description")),
        },
      },
    },
    required: ["entity", "patch"],
  },
  removeEntity: {
    description: "Remove an entity and every relationship that uses it.",
    properties: { entity: ref("Entity") },
    required: ["entity"],
  },
  addField: {
    description: "Add a field (column) to an entity.",
    properties: {
      entity: ref("Entity"),
      tempId,
      field: FIELD_INPUT,
      index: { type: "integer", minimum: 0, description: "Insert position; default: the end" },
    },
    required: ["entity", "field"],
  },
  updateField: {
    description: "Change a field. null clears defaultValue or enum.",
    properties: { entity: ref("Entity"), field: ref("Field of that entity"), patch: FIELD_PATCH },
    required: ["entity", "field", "patch"],
  },
  removeField: {
    description:
      "Remove a field, along with the index entries and relationship field links that use it.",
    properties: { entity: ref("Entity"), field: ref("Field of that entity") },
    required: ["entity", "field"],
  },
  moveField: {
    description: "Move a field to a new position within its entity.",
    properties: {
      entity: ref("Entity"),
      field: ref("Field of that entity"),
      toIndex: { type: "integer", minimum: 0 },
    },
    required: ["entity", "field", "toIndex"],
  },
  addRelationship: {
    description:
      "Relate two entities. Two entities can share only one relationship. Defaults: source required, target optional, no-action.",
    properties: {
      tempId,
      name: text("Relationship (constraint) name"),
      source: ref("Source (parent) entity"),
      sourceField: ref("Field of the source entity, usually its primary key"),
      target: ref("Target (child) entity"),
      targetField: ref("Field of the target entity, usually the foreign key"),
      cardinality: CARDINALITY,
      sourceOptional: flag("Default: false"),
      targetOptional: flag("Default: true"),
      onDelete: ACTION,
      onUpdate: ACTION,
    },
    required: ["source", "target", "cardinality"],
  },
  updateRelationship: {
    description: "Change a relationship. null clears sourceField or targetField.",
    properties: {
      relationship: ref("Relationship"),
      patch: {
        type: "object",
        properties: {
          name: text("Relationship name"),
          cardinality: CARDINALITY,
          sourceField: nullable(ref("Field of the source entity")),
          targetField: nullable(ref("Field of the target entity")),
          sourceOptional: { type: "boolean" },
          targetOptional: { type: "boolean" },
          onDelete: ACTION,
          onUpdate: ACTION,
        },
      },
    },
    required: ["relationship", "patch"],
  },
  removeRelationship: {
    description: "Remove a relationship.",
    properties: { relationship: ref("Relationship") },
    required: ["relationship"],
  },
  addIndex: {
    description: "Add an index on one or more fields of an entity.",
    properties: {
      entity: ref("Entity"),
      tempId,
      name: text("Index name; default idx_<entity>_<n>"),
      fields: { type: "array", items: ref("Field of that entity"), minItems: 1 },
      unique: flag("Default: false"),
    },
    required: ["entity", "fields"],
  },
  updateIndex: {
    description: "Change an index.",
    properties: {
      entity: ref("Entity"),
      index: ref("Index of that entity"),
      patch: {
        type: "object",
        properties: {
          name: name("Index name"),
          fields: { type: "array", items: ref("Field of that entity"), minItems: 1 },
          unique: { type: "boolean" },
        },
      },
    },
    required: ["entity", "index", "patch"],
  },
  removeIndex: {
    description: "Remove an index.",
    properties: { entity: ref("Entity"), index: ref("Index of that entity") },
    required: ["entity", "index"],
  },
  addEnum: {
    description: "Add an enum type.",
    properties: {
      tempId,
      name: name("Enum name, unique in the model"),
      values: { type: "array", items: name("Enum value") },
    },
    required: ["name", "values"],
  },
  updateEnum: {
    description: "Rename an enum or replace its values.",
    properties: {
      enum: ref("Enum"),
      patch: {
        type: "object",
        properties: {
          name: name("Enum name"),
          values: { type: "array", items: name("Enum value") },
        },
      },
    },
    required: ["enum", "patch"],
  },
  removeEnum: {
    description: "Remove an enum; fields using it keep their type but lose the enum link.",
    properties: { enum: ref("Enum") },
    required: ["enum"],
  },
  addNote: {
    description: "Add a sticky note to the canvas.",
    properties: {
      tempId,
      text: text("Note text"),
      near: ref("Entity or note to place the note next to"),
      color: text("CSS color"),
    },
    required: ["text"],
  },
  updateNote: {
    description: "Change a note.",
    properties: {
      note: ref("Note (id, $tempId or exact text)"),
      patch: { type: "object", properties: { text: text("Note text"), color: text("CSS color") } },
    },
    required: ["note", "patch"],
  },
  removeNote: {
    description: "Remove a note.",
    properties: { note: ref("Note (id, $tempId or exact text)") },
    required: ["note"],
  },
  setEngine: {
    description: "Change the target database engine.",
    properties: { engine: { type: "enum", values: DATA_MODEL_ENGINES } },
    required: ["engine"],
  },
  setModelName: {
    description:
      "Rename the data model (its title). Use a short, specific title that names the system, e.g. \"Online Shop Orders\".",
    properties: { name: name("Data model title, 2 to 6 words") },
    required: ["name"],
  },
  setModelDescription: {
    description:
      "Set the data model's overview description: what the system is, its main areas and key rules.",
    properties: { description: text("Overview text, 2 to 5 sentences") },
    required: ["description"],
  },
  autoLayout: {
    description: "Re-arrange every entity. Default mode: layered.",
    properties: { mode: { type: "enum", values: ["grid", "layered"] } },
    required: [],
  },
};

const EDGE_KIND: Shape = { type: "enum", values: ["bezier", "straight", "step"] };
const PROPERTIES: Shape = {
  type: "map",
  values: { type: "scalar" },
  description: "Node properties (string, number, boolean or null)",
};
const NODE_TYPE = name(
  "Node type: start, process, decision, end, subprocess, integration, circle, square, rectangle, roundedRectangle, ellipse, triangle, hexagon, cylinder, text, actor, swimlane, swimlaneVertical",
);

export const FLOW_OP_SPECS: FlowOpSpecs = {
  addNode: {
    description:
      "Add a node. It is placed relative to `near` (default: right of the last node added in this batch).",
    properties: {
      tempId,
      type: NODE_TYPE,
      label: name("Text shown on the node"),
      description: text("Longer description"),
      properties: PROPERTIES,
      near: ref("Node to place the new one next to (matched by id, $tempId or label)"),
      placement: { type: "enum", values: ["right", "below", "left", "above"] },
      lane: ref("Swimlane this step belongs to (its $tempId or exact label)"),
    },
    required: ["type", "label"],
  },
  updateNode: {
    description: "Change a node. properties are merged; a null value removes that key.",
    properties: {
      node: ref("Node"),
      patch: {
        type: "object",
        properties: {
          type: NODE_TYPE,
          label: name("Text shown on the node"),
          description: nullable(text("Longer description")),
          properties: PROPERTIES,
        },
      },
    },
    required: ["node", "patch"],
  },
  removeNode: {
    description: "Remove a node and its connections.",
    properties: { node: ref("Node") },
    required: ["node"],
  },
  addEdge: {
    description:
      'Connect two nodes. A decision node\'s outgoing edge needs sourceHandle "yes" or "no". Handles are chosen from the layout when omitted.',
    properties: {
      tempId,
      source: ref("Source node"),
      target: ref("Target node"),
      sourceHandle: text('Output handle, e.g. "yes" / "no" on a decision node'),
      targetHandle: text("Input handle"),
      label: text("Edge label"),
      type: EDGE_KIND,
    },
    required: ["source", "target"],
  },
  updateEdge: {
    description: "Change an edge. null clears the label.",
    properties: {
      edge: ref("Edge (id, $tempId or exact label)"),
      patch: {
        type: "object",
        properties: {
          label: nullable(text("Edge label")),
          type: EDGE_KIND,
          animated: { type: "boolean" },
        },
      },
    },
    required: ["edge", "patch"],
  },
  removeEdge: {
    description: "Remove an edge.",
    properties: { edge: ref("Edge (id, $tempId or exact label)") },
    required: ["edge"],
  },
  insertNodeOnEdge: {
    description: "Split an edge with a new node: source -> new node -> target.",
    properties: {
      edge: ref("Edge (id, $tempId or exact label)"),
      tempId,
      type: NODE_TYPE,
      label: name("Text shown on the node"),
      description: text("Longer description"),
    },
    required: ["edge", "type", "label"],
  },
  setFlowName: {
    description: "Rename the flow.",
    properties: { name: name("Flow name") },
    required: ["name"],
  },
  setFlowNotes: {
    description: "Replace the flow's notes.",
    properties: { notes: text("Notes text") },
    required: ["notes"],
  },
  autoLayout: {
    description: "Re-arrange every node in layers. Default direction: LR (left to right).",
    properties: { direction: { type: "enum", values: ["LR", "TB"] } },
    required: [],
  },
};

function opsSchema(
  title: string,
  specs: Readonly<Record<string, OpSpec>>,
  maxItems: number,
): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title,
    type: "array",
    maxItems,
    items: {
      oneOf: Object.entries(specs).map(([op, spec]) => ({
        type: "object",
        title: op,
        description: spec.description,
        properties: {
          op: { const: op },
          ...Object.fromEntries(
            Object.entries(spec.properties).map(([key, shape]) => [key, toJsonSchema(shape)]),
          ),
        },
        required: ["op", ...spec.required],
        additionalProperties: false,
      })),
    },
  };
}

export const ERD_OPS_JSON_SCHEMA = opsSchema("ErdOp[]", ERD_OP_SPECS, AI_ERD_LIMITS.maxOpsPerBatch);
export const FLOW_OPS_JSON_SCHEMA = opsSchema(
  "FlowOp[]",
  FLOW_OP_SPECS,
  AI_FLOW_LIMITS.maxOpsPerBatch,
);
