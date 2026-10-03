import type { Dimensions, Rect, XYPosition } from "../../types/flowchart.types";
import {
  ERD_DOCUMENT_VERSION,
  type DataModelEngine,
  type ErdDocumentJSON,
  type ErdDocumentMeta,
  type ErdEntity,
  type ErdEnum,
  type ErdField,
  type ErdIndex,
  type ErdNote,
  type ErdRelationship,
  type ErdViewport,
} from "../../types/dataModel.types";
import { clamp, getBounds, rectsIntersect, screenToFlow } from "../flowchart/geometry";
import { FIT_VIEW_TOP_OFFSET } from "../flowchart/constants";
import { EventEmitter } from "../flowchart/eventEmitter";
import { HistoryManager } from "../flowchart/historyManager";
import { createId } from "../flowchart/id";
import { Store } from "../flowchart/store";
import {
  ERD_DEFAULT_MODEL_NAME,
  ERD_HISTORY_LIMIT,
  ERD_MAX_ZOOM,
  ERD_MIN_ZOOM,
  NOTE_DEFAULT_SIZE,
} from "./erdConstants";
import { getEntityRect, getNoteRect } from "./erdGeometry";
import { layoutErd, type ErdLayoutMode } from "./erdLayout";
import { validateErd, type ErdIssueSeverity, type ErdValidationResult } from "./erdValidator";

export type { ErdLayoutMode } from "./erdLayout";

export interface ErdSnapshot {
  engine: DataModelEngine;
  entities: ErdEntity[];
  relationships: ErdRelationship[];
  enums: ErdEnum[];
  notes: ErdNote[];
}

export interface FieldRef {
  entityId: string;
  fieldId: string;
}

export interface ErdSelection {
  entityIds: ReadonlySet<string>;
  noteIds: ReadonlySet<string>;
  relationshipIds: ReadonlySet<string>;
  enumId: string | null;
}

export interface ErdSelectionInput {
  entityIds?: Iterable<string>;
  noteIds?: Iterable<string>;
  relationshipIds?: Iterable<string>;
  enumId?: string | null;
}

export type ErdSelectionKind = "entity" | "note" | "relationship" | "enum";

export interface ErdConnectionCheck {
  valid: boolean;
  reason?: string;
}

export interface ErdConnectionState {
  fromEntityId: string;
  pointer: XYPosition;
  candidate: string | null;
  valid: boolean;
  reason?: string;
}

export interface ErdState extends ErdSnapshot {
  name: string;
  entityLookup: ReadonlyMap<string, ErdEntity>;
  relationshipLookup: ReadonlyMap<string, ErdRelationship>;
  noteLookup: ReadonlyMap<string, ErdNote>;
  enumLookup: ReadonlyMap<string, ErdEnum>;
  selection: ErdSelection;
  viewport: ErdViewport;
  canvasSize: Dimensions;
  connection: ErdConnectionState | null;
  selectionRect: Rect | null;
  activeFieldId: string | null;
  validation: ErdValidationResult | null;
  issueEntityIds: ReadonlyMap<string, ErdIssueSeverity>;
  issueRelationshipIds: ReadonlyMap<string, ErdIssueSeverity>;
  issueFieldIds: ReadonlyMap<string, ErdIssueSeverity>;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface ErdEngineEvents extends Record<string, unknown> {
  change: ErdSnapshot;
  selectionChange: ErdSelection;
  viewportChange: ErdViewport;
}

export interface ErdEngineOptions {
  initialDocument?: Partial<ErdDocumentJSON>;
  readOnly?: boolean;
  historyLimit?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface NewEntityInput {
  id?: string;
  name?: string;
  position?: XYPosition;
}

export type ErdEntityPatch = Partial<Omit<ErdEntity, "id">>;
export type ErdFieldInput = Partial<Omit<ErdField, "id">>;
export type ErdIndexInput = Partial<Omit<ErdIndex, "id">>;
export type ErdEnumInput = Partial<Omit<ErdEnum, "id">>;
export type ErdNoteInput = Partial<Omit<ErdNote, "id">>;
export type ErdRelationshipInput = Partial<
  Omit<ErdRelationship, "id" | "sourceEntityId" | "targetEntityId">
>;
export type ErdRelationshipPatch = Partial<Omit<ErdRelationship, "id">>;

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_ISSUES: ReadonlyMap<string, ErdIssueSeverity> = new Map();
const EMPTY_SELECTION: ErdSelection = {
  entityIds: EMPTY_SET,
  noteIds: EMPTY_SET,
  relationshipIds: EMPTY_SET,
  enumId: null,
};
const DEFAULT_DUPLICATE_OFFSET: XYPosition = { x: 40, y: 40 };

function nextName(prefix: string, taken: readonly string[]): string {
  const used = new Set(taken.map((name) => name.toLowerCase()));
  let n = taken.length + 1;
  while (used.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function severityMap(
  entries: readonly { id: string | undefined; severity: ErdIssueSeverity }[],
): ReadonlyMap<string, ErdIssueSeverity> {
  const map = new Map<string, ErdIssueSeverity>();
  for (const { id, severity } of entries) {
    if (id !== undefined && map.get(id) !== "error") map.set(id, severity);
  }
  return map;
}

export class ErdEngine {
  readonly store: Store<ErdState>;
  readonly history: HistoryManager<ErdSnapshot>;
  private readonly events = new EventEmitter<ErdEngineEvents>();
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private meta: ErdDocumentMeta;
  private interactionDepth = 0;
  private interactionStart: ErdSnapshot | null = null;
  private pendingFitView = false;
  private unsubscribeStore: (() => void) | null = null;

  constructor(options: ErdEngineOptions = {}) {
    const initial = options.initialDocument ?? {};
    this.history = new HistoryManager(options.historyLimit ?? ERD_HISTORY_LIMIT);
    this.minZoom = options.minZoom ?? ERD_MIN_ZOOM;
    this.maxZoom = options.maxZoom ?? ERD_MAX_ZOOM;
    this.meta = { ...initial.meta };
    const entities = initial.entities ?? [];
    const relationships = initial.relationships ?? [];
    const enums = initial.enums ?? [];
    const notes = initial.notes ?? [];
    this.store = new Store<ErdState>({
      engine: initial.engine ?? "na",
      entities,
      relationships,
      enums,
      notes,
      name: initial.meta?.name ?? ERD_DEFAULT_MODEL_NAME,
      entityLookup: new Map(entities.map((entity) => [entity.id, entity])),
      relationshipLookup: new Map(relationships.map((rel) => [rel.id, rel])),
      noteLookup: new Map(notes.map((note) => [note.id, note])),
      enumLookup: new Map(enums.map((entry) => [entry.id, entry])),
      selection: EMPTY_SELECTION,
      viewport: initial.viewport ?? { x: 0, y: 0, zoom: 1 },
      canvasSize: { width: 0, height: 0 },
      connection: null,
      selectionRect: null,
      activeFieldId: null,
      validation: null,
      issueEntityIds: EMPTY_ISSUES,
      issueRelationshipIds: EMPTY_ISSUES,
      issueFieldIds: EMPTY_ISSUES,
      readOnly: options.readOnly ?? false,
      canUndo: false,
      canRedo: false,
    });
    this.pendingFitView = !initial.viewport && entities.length + notes.length > 0;
    this.watchStore();
  }

  private watchStore(): void {
    let previous = this.store.getState();
    this.unsubscribeStore = this.store.subscribe(() => {
      const current = this.store.getState();
      const before = previous;
      previous = current;
      const changed =
        current.entities !== before.entities ||
        current.relationships !== before.relationships ||
        current.enums !== before.enums ||
        current.notes !== before.notes ||
        current.engine !== before.engine;
      if (changed) this.events.emit("change", this.getSnapshot());
      if (current.selection !== before.selection) {
        this.events.emit("selectionChange", current.selection);
      }
      if (current.viewport !== before.viewport)
        this.events.emit("viewportChange", current.viewport);
    });
  }

  dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.events.clear();
    this.history.clear();
    this.interactionDepth = 0;
    this.interactionStart = null;
  }

  getState = (): ErdState => this.store.getState();
  getEntity = (id: string): ErdEntity | undefined => this.getState().entityLookup.get(id);
  getNote = (id: string): ErdNote | undefined => this.getState().noteLookup.get(id);
  getEnum = (id: string): ErdEnum | undefined => this.getState().enumLookup.get(id);
  getRelationship = (id: string): ErdRelationship | undefined =>
    this.getState().relationshipLookup.get(id);

  getSnapshot = (): ErdSnapshot => {
    const { engine, entities, relationships, enums, notes } = this.getState();
    return { engine, entities, relationships, enums, notes };
  };

  on<K extends keyof ErdEngineEvents>(
    event: K,
    handler: (payload: ErdEngineEvents[K]) => void,
  ): () => void {
    return this.events.on(event, handler);
  }

  toJSON(): ErdDocumentJSON {
    const state = this.getState();
    return {
      version: ERD_DOCUMENT_VERSION,
      engine: state.engine,
      entities: state.entities,
      relationships: state.relationships,
      enums: state.enums,
      notes: state.notes,
      viewport: state.viewport,
      meta: { ...this.meta, name: state.name },
    };
  }

  loadDocument(document: Partial<ErdDocumentJSON>): void {
    this.history.clear();
    this.interactionDepth = 0;
    this.interactionStart = null;
    this.meta = { ...document.meta };
    const entities = document.entities ?? [];
    const relationships = document.relationships ?? [];
    const enums = document.enums ?? [];
    const notes = document.notes ?? [];
    this.pendingFitView = !document.viewport && entities.length + notes.length > 0;
    this.store.setState({
      engine: document.engine ?? "na",
      entities,
      relationships,
      enums,
      notes,
      name: document.meta?.name ?? ERD_DEFAULT_MODEL_NAME,
      entityLookup: new Map(entities.map((entity) => [entity.id, entity])),
      relationshipLookup: new Map(relationships.map((rel) => [rel.id, rel])),
      noteLookup: new Map(notes.map((note) => [note.id, note])),
      enumLookup: new Map(enums.map((entry) => [entry.id, entry])),
      selection: EMPTY_SELECTION,
      connection: null,
      selectionRect: null,
      activeFieldId: null,
      validation: null,
      issueEntityIds: EMPTY_ISSUES,
      issueRelationshipIds: EMPTY_ISSUES,
      issueFieldIds: EMPTY_ISSUES,
      viewport: document.viewport ?? { x: 0, y: 0, zoom: 1 },
      canUndo: false,
      canRedo: false,
    });
    if (this.pendingFitView) this.fitViewWhenSized();
  }

  applyDocument(
    document: Partial<ErdDocumentJSON>,
    options: { recordHistory?: boolean } = {},
  ): void {
    this.interactionDepth = 0;
    this.interactionStart = null;
    if (document.meta) this.meta = { ...document.meta };
    const name = document.meta?.name ?? this.getState().name;
    const next: ErdSnapshot = {
      engine: document.engine ?? this.getState().engine,
      entities: document.entities ?? [],
      relationships: document.relationships ?? [],
      enums: document.enums ?? [],
      notes: document.notes ?? [],
    };
    if (options.recordHistory) {
      this.commit(next);
    } else {
      this.history.clear();
      this.applySnapshot(next);
    }
    this.store.setState({
      name,
      connection: null,
      selectionRect: null,
      activeFieldId: null,
      validation: null,
      issueEntityIds: EMPTY_ISSUES,
      issueRelationshipIds: EMPTY_ISSUES,
      issueFieldIds: EMPTY_ISSUES,
    });
  }

  setName(name: string): void {
    this.store.setState({ name });
  }

  setReadOnly(readOnly: boolean): void {
    this.store.setState({ readOnly });
  }

  setEngine(engine: DataModelEngine): void {
    this.commit({ engine });
  }

  private applySnapshot(next: ErdSnapshot): void {
    const s = this.getState();
    const entityLookup =
      next.entities === s.entities
        ? s.entityLookup
        : new Map(next.entities.map((entity) => [entity.id, entity]));
    const relationshipLookup =
      next.relationships === s.relationships
        ? s.relationshipLookup
        : new Map(next.relationships.map((rel) => [rel.id, rel]));
    const noteLookup =
      next.notes === s.notes ? s.noteLookup : new Map(next.notes.map((note) => [note.id, note]));
    const enumLookup =
      next.enums === s.enums ? s.enumLookup : new Map(next.enums.map((entry) => [entry.id, entry]));
    this.store.setState({
      ...next,
      entityLookup,
      relationshipLookup,
      noteLookup,
      enumLookup,
      selection: this.pruneSelection(s.selection, {
        entityLookup,
        relationshipLookup,
        noteLookup,
        enumLookup,
      }),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });
  }

  private pruneSelection(
    selection: ErdSelection,
    lookups: Pick<ErdState, "entityLookup" | "relationshipLookup" | "noteLookup" | "enumLookup">,
  ): ErdSelection {
    const keep = (ids: ReadonlySet<string>, lookup: ReadonlyMap<string, unknown>) =>
      [...ids].every((id) => lookup.has(id))
        ? ids
        : new Set([...ids].filter((id) => lookup.has(id)));
    const entityIds = keep(selection.entityIds, lookups.entityLookup);
    const noteIds = keep(selection.noteIds, lookups.noteLookup);
    const relationshipIds = keep(selection.relationshipIds, lookups.relationshipLookup);
    const enumId =
      selection.enumId !== null && lookups.enumLookup.has(selection.enumId)
        ? selection.enumId
        : null;
    const unchanged =
      entityIds === selection.entityIds &&
      noteIds === selection.noteIds &&
      relationshipIds === selection.relationshipIds &&
      enumId === selection.enumId;
    return unchanged ? selection : { entityIds, noteIds, relationshipIds, enumId };
  }

  private commit(patch: Partial<ErdSnapshot>): void {
    const s = this.getState();
    if (s.readOnly) return;
    const next: ErdSnapshot = {
      engine: patch.engine ?? s.engine,
      entities: patch.entities ?? s.entities,
      relationships: patch.relationships ?? s.relationships,
      enums: patch.enums ?? s.enums,
      notes: patch.notes ?? s.notes,
    };
    const current = this.getSnapshot();
    const unchanged =
      next.engine === current.engine &&
      next.entities === current.entities &&
      next.relationships === current.relationships &&
      next.enums === current.enums &&
      next.notes === current.notes;
    if (unchanged) return;
    if (this.interactionDepth === 0) this.history.push(current);
    this.applySnapshot(next);
  }

  private static differs(a: ErdSnapshot, b: ErdSnapshot): boolean {
    return (
      a.engine !== b.engine ||
      a.entities !== b.entities ||
      a.relationships !== b.relationships ||
      a.enums !== b.enums ||
      a.notes !== b.notes
    );
  }

  beginInteraction(): void {
    if (this.interactionDepth++ === 0) this.interactionStart = this.getSnapshot();
  }

  endInteraction(): void {
    if (this.interactionDepth === 0) return;
    if (--this.interactionDepth > 0) return;
    const start = this.interactionStart;
    this.interactionStart = null;
    if (start && ErdEngine.differs(start, this.getSnapshot())) {
      this.history.push(start);
      this.store.setState({ canUndo: this.history.canUndo, canRedo: this.history.canRedo });
    }
  }

  cancelInteraction(): void {
    if (this.interactionDepth === 0) return;
    this.interactionDepth = 0;
    const start = this.interactionStart;
    this.interactionStart = null;
    if (start) this.applySnapshot(start);
  }

  undo(): void {
    if (this.interactionDepth > 0) return;
    const previous = this.history.undo(this.getSnapshot());
    if (previous) this.applySnapshot(previous);
  }

  redo(): void {
    if (this.interactionDepth > 0) return;
    const next = this.history.redo(this.getSnapshot());
    if (next) this.applySnapshot(next);
  }

  private updateEntities(
    ids: ReadonlySet<string>,
    change: (entity: ErdEntity) => ErdEntity,
  ): ErdEntity[] {
    const s = this.getState();
    if (![...ids].some((id) => s.entityLookup.has(id))) return s.entities;
    return s.entities.map((entity) => (ids.has(entity.id) ? change(entity) : entity));
  }

  addEntity(input: NewEntityInput = {}): ErdEntity {
    const s = this.getState();
    const entity: ErdEntity = {
      id: input.id ?? createId("entity"),
      name:
        input.name ??
        nextName(
          "entity",
          s.entities.map((e) => e.name),
        ),
      schema: "public",
      position: { ...(input.position ?? { x: 0, y: 0 }) },
      fields: [
        {
          id: createId("field"),
          name: "id",
          type: "integer",
          nullable: false,
          primaryKey: true,
          unique: false,
        },
      ],
      indexes: [],
    };
    if (s.entityLookup.has(entity.id)) throw new Error(`Entity id "${entity.id}" already exists`);
    this.commit({ entities: [...s.entities, entity] });
    return entity;
  }

  updateEntity(id: string, patch: ErdEntityPatch): void {
    const entities = this.updateEntities(new Set([id]), (entity) => ({ ...entity, ...patch, id }));
    this.commit({ entities });
  }

  removeEntities(ids: readonly string[]): void {
    const remove = new Set(ids);
    const s = this.getState();
    if (![...remove].some((id) => s.entityLookup.has(id))) return;
    this.commit({
      entities: s.entities.filter((entity) => !remove.has(entity.id)),
      relationships: s.relationships.filter(
        (rel) => !remove.has(rel.sourceEntityId) && !remove.has(rel.targetEntityId),
      ),
    });
  }

  duplicateEntities(
    ids: readonly string[],
    offset: XYPosition = DEFAULT_DUPLICATE_OFFSET,
  ): ErdEntity[] {
    const s = this.getState();
    const sources = s.entities.filter((entity) => ids.includes(entity.id));
    if (sources.length === 0) return [];
    const names = s.entities.map((entity) => entity.name);
    const copies = sources.map((source): ErdEntity => {
      const fieldIds = new Map(source.fields.map((field) => [field.id, createId("field")]));
      const name = nextName(`${source.name}_copy`, names);
      names.push(name);
      return {
        ...source,
        id: createId("entity"),
        name,
        position: { x: source.position.x + offset.x, y: source.position.y + offset.y },
        fields: source.fields.map((field) => ({
          ...field,
          id: fieldIds.get(field.id) as string,
        })),
        indexes: source.indexes.map((index) => ({
          ...index,
          id: createId("index"),
          fieldIds: index.fieldIds.flatMap((id) => fieldIds.get(id) ?? []),
        })),
      };
    });
    this.commit({ entities: [...s.entities, ...copies] });
    this.setSelection({ entityIds: copies.map((copy) => copy.id) });
    return copies;
  }

  setNodePositions(positions: Record<string, XYPosition>): void {
    const s = this.getState();
    const moved = (id: string, current: XYPosition): XYPosition | null => {
      const target = positions[id];
      return target && (target.x !== current.x || target.y !== current.y) ? target : null;
    };
    let entitiesMoved = false;
    let notesMoved = false;
    const entities = s.entities.map((entity) => {
      const position = moved(entity.id, entity.position);
      if (!position) return entity;
      entitiesMoved = true;
      return { ...entity, position: { ...position } };
    });
    const notes = s.notes.map((note) => {
      const position = moved(note.id, note.position);
      if (!position) return note;
      notesMoved = true;
      return { ...note, position: { ...position } };
    });
    this.commit({
      entities: entitiesMoved ? entities : s.entities,
      notes: notesMoved ? notes : s.notes,
    });
  }

  addField(entityId: string, input: ErdFieldInput = {}): ErdField | null {
    const entity = this.getEntity(entityId);
    if (!entity) return null;
    const field: ErdField = {
      name: nextName(
        "field",
        entity.fields.map((f) => f.name),
      ),
      type: "text",
      nullable: true,
      primaryKey: false,
      unique: false,
      ...input,
      id: createId("field"),
    };
    this.updateEntity(entityId, { fields: [...entity.fields, field] });
    return field;
  }

  updateField(entityId: string, fieldId: string, patch: ErdFieldInput): void {
    const entity = this.getEntity(entityId);
    if (!entity?.fields.some((field) => field.id === fieldId)) return;
    this.updateEntity(entityId, {
      fields: entity.fields.map((field) =>
        field.id === fieldId ? { ...field, ...patch, id: fieldId } : field,
      ),
    });
  }

  removeField(entityId: string, fieldId: string): void {
    const s = this.getState();
    const entity = s.entityLookup.get(entityId);
    if (!entity?.fields.some((field) => field.id === fieldId)) return;
    const updated: ErdEntity = {
      ...entity,
      fields: entity.fields.filter((field) => field.id !== fieldId),
      indexes: entity.indexes.map((index) =>
        index.fieldIds.includes(fieldId)
          ? { ...index, fieldIds: index.fieldIds.filter((id) => id !== fieldId) }
          : index,
      ),
    };
    this.commit({ entities: s.entities.map((e) => (e.id === entityId ? updated : e)) });
  }

  moveField(entityId: string, fieldId: string, toIndex: number): void {
    const entity = this.getEntity(entityId);
    const from = entity?.fields.findIndex((field) => field.id === fieldId) ?? -1;
    if (!entity || from < 0) return;
    const target = clamp(toIndex, 0, entity.fields.length - 1);
    if (target === from) return;
    const fields = [...entity.fields];
    const [moving] = fields.splice(from, 1);
    fields.splice(target, 0, moving as ErdField);
    this.updateEntity(entityId, { fields });
  }

  addIndex(entityId: string, input: ErdIndexInput = {}): ErdIndex | null {
    const entity = this.getEntity(entityId);
    if (!entity) return null;
    const index: ErdIndex = {
      name: nextName(
        `idx_${entity.name}`,
        entity.indexes.map((i) => i.name),
      ),
      fieldIds: [],
      unique: false,
      ...input,
      id: createId("index"),
    };
    this.updateEntity(entityId, { indexes: [...entity.indexes, index] });
    return index;
  }

  updateIndex(entityId: string, indexId: string, patch: ErdIndexInput): void {
    const entity = this.getEntity(entityId);
    if (!entity?.indexes.some((index) => index.id === indexId)) return;
    this.updateEntity(entityId, {
      indexes: entity.indexes.map((index) =>
        index.id === indexId ? { ...index, ...patch, id: indexId } : index,
      ),
    });
  }

  removeIndex(entityId: string, indexId: string): void {
    const entity = this.getEntity(entityId);
    if (!entity?.indexes.some((index) => index.id === indexId)) return;
    this.updateEntity(entityId, {
      indexes: entity.indexes.filter((index) => index.id !== indexId),
    });
  }

  addEnum(input: ErdEnumInput = {}): ErdEnum {
    const s = this.getState();
    const entry: ErdEnum = {
      name: nextName(
        "enum",
        s.enums.map((e) => e.name),
      ),
      values: [],
      ...input,
      id: createId("enum"),
    };
    this.commit({ enums: [...s.enums, entry] });
    return entry;
  }

  updateEnum(id: string, patch: ErdEnumInput): void {
    const s = this.getState();
    if (!s.enumLookup.has(id)) return;
    this.commit({
      enums: s.enums.map((entry) => (entry.id === id ? { ...entry, ...patch, id } : entry)),
    });
  }

  removeEnum(id: string): void {
    const s = this.getState();
    if (!s.enumLookup.has(id)) return;
    const usesEnum = (entity: ErdEntity) => entity.fields.some((field) => field.enumId === id);
    this.commit({
      enums: s.enums.filter((entry) => entry.id !== id),
      entities: s.entities.some(usesEnum)
        ? s.entities.map((entity) =>
            usesEnum(entity)
              ? {
                  ...entity,
                  fields: entity.fields.map((field) => {
                    if (field.enumId !== id) return field;
                    const { enumId: _removed, ...rest } = field;
                    return rest;
                  }),
                }
              : entity,
          )
        : s.entities,
    });
  }

  addNote(input: ErdNoteInput = {}): ErdNote {
    const s = this.getState();
    const note: ErdNote = {
      text: "",
      width: NOTE_DEFAULT_SIZE.width,
      height: NOTE_DEFAULT_SIZE.height,
      ...input,
      position: { ...(input.position ?? { x: 0, y: 0 }) },
      id: createId("note"),
    };
    this.commit({ notes: [...s.notes, note] });
    return note;
  }

  updateNote(id: string, patch: ErdNoteInput): void {
    const s = this.getState();
    if (!s.noteLookup.has(id)) return;
    this.commit({
      notes: s.notes.map((note) => (note.id === id ? { ...note, ...patch, id } : note)),
    });
  }

  removeNotes(ids: readonly string[]): void {
    const remove = new Set(ids);
    const s = this.getState();
    if (![...remove].some((id) => s.noteLookup.has(id))) return;
    this.commit({ notes: s.notes.filter((note) => !remove.has(note.id)) });
  }

  canConnect(sourceEntityId: string, targetEntityId: string): ErdConnectionCheck {
    const s = this.getState();
    if (!s.entityLookup.has(sourceEntityId) || !s.entityLookup.has(targetEntityId)) {
      return { valid: false, reason: "Unknown entity" };
    }
    const duplicate = s.relationships.some(
      (rel) =>
        (rel.sourceEntityId === sourceEntityId && rel.targetEntityId === targetEntityId) ||
        (rel.sourceEntityId === targetEntityId && rel.targetEntityId === sourceEntityId),
    );
    if (duplicate) return { valid: false, reason: "These entities are already related" };
    return { valid: true };
  }

  addRelationship(
    sourceEntityId: string,
    targetEntityId: string,
    input: ErdRelationshipInput = {},
  ): ErdRelationship | null {
    if (!this.canConnect(sourceEntityId, targetEntityId).valid) return null;
    const s = this.getState();
    const relationship: ErdRelationship = {
      cardinality: "one-to-many",
      sourceOptional: false,
      targetOptional: true,
      onDelete: "no-action",
      onUpdate: "no-action",
      ...input,
      id: createId("rel"),
      sourceEntityId,
      targetEntityId,
    };
    this.commit({ relationships: [...s.relationships, relationship] });
    return relationship;
  }

  updateRelationship(id: string, patch: ErdRelationshipPatch): void {
    const s = this.getState();
    if (!s.relationshipLookup.has(id)) return;
    this.commit({
      relationships: s.relationships.map((rel) => (rel.id === id ? { ...rel, ...patch, id } : rel)),
    });
  }

  removeRelationships(ids: readonly string[]): void {
    const remove = new Set(ids);
    const s = this.getState();
    if (![...remove].some((id) => s.relationshipLookup.has(id))) return;
    this.commit({ relationships: s.relationships.filter((rel) => !remove.has(rel.id)) });
  }

  startConnection(fromEntityId: string, pointer: XYPosition): void {
    if (this.getState().readOnly) return;
    this.store.setState({ connection: { fromEntityId, pointer, candidate: null, valid: false } });
  }

  updateConnection(pointer: XYPosition, candidateEntityId: string | null = null): void {
    const connection = this.getState().connection;
    if (!connection) return;
    const check = candidateEntityId
      ? this.canConnect(connection.fromEntityId, candidateEntityId)
      : { valid: false };
    this.store.setState({
      connection: {
        fromEntityId: connection.fromEntityId,
        pointer,
        candidate: candidateEntityId,
        valid: check.valid,
        reason: "reason" in check ? check.reason : undefined,
      },
    });
  }

  endConnection(): ErdRelationship | null {
    const connection = this.getState().connection;
    this.store.setState({ connection: null });
    if (!connection?.candidate || !connection.valid) return null;
    return this.addRelationship(connection.fromEntityId, connection.candidate);
  }

  cancelConnection(): void {
    this.store.setState({ connection: null });
  }

  setSelection(input: ErdSelectionInput = {}): void {
    const s = this.getState();
    this.store.setState({
      activeFieldId: null,
      selection: this.pruneSelection(
        {
          entityIds: new Set(input.entityIds),
          noteIds: new Set(input.noteIds),
          relationshipIds: new Set(input.relationshipIds),
          enumId: input.enumId ?? null,
        },
        s,
      ),
    });
  }

  select(kind: ErdSelectionKind, id: string, additive = false): void {
    const { selection } = this.getState();
    if (kind === "enum") return this.setSelection({ enumId: id });
    const base: ErdSelectionInput = additive
      ? {
          entityIds: selection.entityIds,
          noteIds: selection.noteIds,
          relationshipIds: selection.relationshipIds,
        }
      : {};
    if (kind === "entity") {
      return this.setSelection({
        ...base,
        entityIds: additive ? toggled(selection.entityIds, id) : [id],
      });
    }
    if (kind === "note") {
      return this.setSelection({
        ...base,
        noteIds: additive ? toggled(selection.noteIds, id) : [id],
      });
    }
    this.setSelection({
      ...base,
      relationshipIds: additive ? toggled(selection.relationshipIds, id) : [id],
    });
  }

  focusField(entityId: string, fieldId: string): void {
    const entity = this.getEntity(entityId);
    if (!entity?.fields.some((field) => field.id === fieldId)) return;
    this.setSelection({ entityIds: [entityId] });
    this.store.setState({ activeFieldId: fieldId });
  }

  clearSelection(): void {
    if (this.getState().selection !== EMPTY_SELECTION) this.setSelection();
  }

  selectAll(): void {
    const s = this.getState();
    this.setSelection({
      entityIds: s.entities.map((entity) => entity.id),
      noteIds: s.notes.map((note) => note.id),
      relationshipIds: s.relationships.map((rel) => rel.id),
    });
  }

  selectInRect(rect: Rect, additive = false): void {
    const s = this.getState();
    const entityHits = s.entities
      .filter((entity) => rectsIntersect(rect, getEntityRect(entity)))
      .map((entity) => entity.id);
    const noteHits = s.notes
      .filter((note) => rectsIntersect(rect, getNoteRect(note)))
      .map((note) => note.id);
    this.setSelection({
      entityIds: additive ? [...s.selection.entityIds, ...entityHits] : entityHits,
      noteIds: additive ? [...s.selection.noteIds, ...noteHits] : noteHits,
      relationshipIds: additive ? s.selection.relationshipIds : [],
    });
  }

  setSelectionRect(rect: Rect | null): void {
    this.store.setState({ selectionRect: rect });
  }

  deleteSelection(): void {
    const { selection } = this.getState();
    this.beginInteraction();
    this.removeRelationships([...selection.relationshipIds]);
    this.removeEntities([...selection.entityIds]);
    this.removeNotes([...selection.noteIds]);
    if (selection.enumId !== null) this.removeEnum(selection.enumId);
    this.endInteraction();
  }

  setViewport(viewport: ErdViewport): void {
    this.store.setState({
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: clamp(viewport.zoom, this.minZoom, this.maxZoom),
      },
    });
  }

  panBy(dx: number, dy: number): void {
    const v = this.getState().viewport;
    this.setViewport({ ...v, x: v.x + dx, y: v.y + dy });
  }

  zoomAt(factor: number, point?: XYPosition): void {
    const { viewport: v, canvasSize } = this.getState();
    const p = point ?? { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    const zoom = clamp(v.zoom * factor, this.minZoom, this.maxZoom);
    const k = zoom / v.zoom;
    this.setViewport({ zoom, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k });
  }

  zoomTo(zoom: number): void {
    this.zoomAt(zoom / this.getState().viewport.zoom);
  }

  zoomIn = () => this.zoomAt(1.2);
  zoomOut = () => this.zoomAt(1 / 1.2);

  fitView(options: { padding?: number; ids?: readonly string[]; maxZoom?: number } = {}): void {
    const s = this.getState();
    if (!s.canvasSize.width || !s.canvasSize.height) {
      this.pendingFitView = true;
      return;
    }
    const wanted = options.ids ? new Set(options.ids) : null;
    const inScope = (id: string) => !wanted || wanted.has(id);
    const bounds = getBounds([
      ...s.entities.filter((entity) => inScope(entity.id)).map(getEntityRect),
      ...s.notes.filter((note) => inScope(note.id)).map(getNoteRect),
    ]);
    if (!bounds) {
      this.setViewport({ x: s.canvasSize.width / 2, y: s.canvasSize.height / 3, zoom: 1 });
      return;
    }
    const padding = options.padding ?? 60;
    const zoom = clamp(
      Math.min(
        (s.canvasSize.width - padding * 2) / bounds.width,
        (s.canvasSize.height - padding * 2) / bounds.height,
      ),
      this.minZoom,
      options.maxZoom ?? 1.25,
    );
    const topAligned = Math.min(padding, FIT_VIEW_TOP_OFFSET) - bounds.y * zoom;
    const centered = s.canvasSize.height / 2 - (bounds.y + bounds.height / 2) * zoom;
    this.setViewport({
      zoom,
      x: s.canvasSize.width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: Math.min(topAligned, centered),
    });
  }

  private fitViewWhenSized(): void {
    const { canvasSize } = this.getState();
    if (!canvasSize.width || !canvasSize.height) return;
    this.pendingFitView = false;
    this.fitView();
  }

  centerOn(point: XYPosition, zoom = this.getState().viewport.zoom): void {
    const { canvasSize } = this.getState();
    this.setViewport({
      zoom,
      x: canvasSize.width / 2 - point.x * zoom,
      y: canvasSize.height / 2 - point.y * zoom,
    });
  }

  setCanvasSize(size: Dimensions): void {
    this.store.setState({ canvasSize: size });
    if (this.pendingFitView && size.width && size.height) {
      this.pendingFitView = false;
      this.fitView();
    }
  }

  screenToFlow = (point: XYPosition): XYPosition => screenToFlow(point, this.getState().viewport);

  applyLayout(mode: ErdLayoutMode): void {
    const s = this.getState();
    this.setNodePositions(
      layoutErd(mode, s.entities, s.relationships, (entity) => {
        const { width, height } = getEntityRect(entity);
        return { width, height };
      }),
    );
    this.fitView();
  }

  validate(): ErdValidationResult {
    const result = validateErd(this.getSnapshot());
    this.store.setState({
      validation: result,
      issueEntityIds: severityMap(
        result.issues.map((issue) => ({ id: issue.entityId, severity: issue.severity })),
      ),
      issueRelationshipIds: severityMap(
        result.issues.map((issue) => ({ id: issue.relationshipId, severity: issue.severity })),
      ),
      issueFieldIds: severityMap(
        result.issues.map((issue) => ({ id: issue.fieldId, severity: issue.severity })),
      ),
    });
    return result;
  }

  clearValidation(): void {
    this.store.setState({
      validation: null,
      issueEntityIds: EMPTY_ISSUES,
      issueRelationshipIds: EMPTY_ISSUES,
      issueFieldIds: EMPTY_ISSUES,
    });
  }
}
