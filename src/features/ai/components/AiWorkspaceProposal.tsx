import { useId, useMemo, useState } from "react";
import type { WorkspaceApplyItem } from "../ops/workspaceOps";
import { useAnnotationAuth, useAnnotationData } from "../../../context/AnnotationContext";
import { useEpicFlowApi } from "../../../hooks/useEpicFlowApi";
import { useSharedFetch } from "../../../hooks/useSharedFetch";
import { Icon, type IconName } from "../../../components/primitives/Icon";
import { Spinner } from "../../../components/primitives/Spinner";
import { describeWorkspaceTree, type WorkspaceTreeNode } from "./aiOpChanges";
import type { AiWorkspaceBatch } from "./useAiWorkspaceApplier";

export type Phase = "idle" | "applying" | "applied" | "partial" | "failed" | "discarded";

export interface WorkspaceRunView {
  phase: Phase;
  items: WorkspaceApplyItem[];
  summary: string;
  error: string | null;
}

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Proposed",
  applying: "Creating…",
  applied: "Done",
  partial: "Partly done",
  failed: "Failed",
  discarded: "Discarded",
};

const PHASE_CHIP: Record<Phase, string> = {
  idle: "proposed",
  applying: "pending",
  applied: "saved",
  partial: "pending",
  failed: "rejected",
  discarded: "discarded",
};

const KIND_ICON: Record<WorkspaceTreeNode["kind"], IconName> = {
  epic: "epic",
  user_story: "list",
  flow: "flow",
  data_model: "dataModel",
};

const KIND_LABEL: Record<WorkspaceTreeNode["kind"], [string, string]> = {
  epic: ["epic", "epics"],
  user_story: ["user story", "user stories"],
  flow: ["flow", "flows"],
  data_model: ["data model", "data models"],
};

function countNodes(nodes: readonly WorkspaceTreeNode[], out: Map<string, number> = new Map()) {
  for (const node of nodes) {
    out.set(node.kind, (out.get(node.kind) ?? 0) + 1);
    countNodes(node.children, out);
  }
  return out;
}

const TAB_ORDER: WorkspaceTreeNode["kind"][] = ["epic", "user_story", "flow", "data_model"];

const TAB_LABEL: Record<WorkspaceTreeNode["kind"], string> = {
  epic: "Epics",
  user_story: "User stories",
  flow: "Flows",
  data_model: "Data models",
};

function groupByKind(
  tree: readonly WorkspaceTreeNode[],
): Map<WorkspaceTreeNode["kind"], WorkspaceTreeNode[]> {
  const groups = new Map<WorkspaceTreeNode["kind"], WorkspaceTreeNode[]>();
  const add = (kind: WorkspaceTreeNode["kind"], node: WorkspaceTreeNode) =>
    groups.set(kind, [...(groups.get(kind) ?? []), node]);
  const visit = (node: WorkspaceTreeNode, parent: WorkspaceTreeNode | null) => {
    if (node.kind === "epic") {
      const stories = node.children.length;
      add("epic", {
        ...node,
        children: [],
        hint:
          node.hint ??
          (stories > 0 ? `${stories} ${stories === 1 ? "story" : "stories"}` : undefined),
      });
    } else {
      add(node.kind, {
        ...node,
        children: [],
        hint: node.kind === "user_story" && parent ? parent.title : node.hint,
      });
    }
    node.children.forEach((child) => visit(child, node));
  };
  tree.forEach((node) => visit(node, null));
  return groups;
}

function useExistingEpicTitle(batch: AiWorkspaceBatch): (id: string) => string | undefined {
  const { config } = useAnnotationData();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const epicApi = useEpicFlowApi(config);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const needed = useMemo(() => {
    const temp = new Set<string>();
    for (const op of batch.ops) if (op.op === "createEpic" && op.tempId) temp.add(op.tempId);
    return batch.ops.some((op) => op.op === "createUserStory" && !temp.has(op.epic));
  }, [batch.ops]);
  const epics = useSharedFetch(
    needed && sessionKey
      ? `epics-list:${config.apiBaseUrl}:${sessionKey}:${config.projectId}`
      : null,
    (signal) => epicApi.getEpics(config.projectId, signal),
  );
  return useMemo(() => {
    const titles = new Map((epics.data ?? []).map((epic) => [epic.id, epic.title]));
    return (id: string) => titles.get(id);
  }, [epics.data]);
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 140).trimEnd()}…` : flat;
}

interface RowProps {
  node: WorkspaceTreeNode;
  depth: number;
  open: ReadonlySet<number>;
  toggle: (index: number) => void;
  items: readonly WorkspaceApplyItem[];
  busy: boolean;
  onOpen: (item: WorkspaceApplyItem) => void;
}

function Row({ node, depth, open, toggle, items, busy, onOpen }: RowProps) {
  const item = items.find((candidate) => candidate.index === node.index);
  const expandable = Boolean(node.notes || node.details.length > 0 || node.children.length > 0);
  const hasProblem = (n: WorkspaceTreeNode): boolean =>
    items.some((entry) => entry.index === n.index && entry.status !== "done") ||
    n.children.some(hasProblem);
  const expanded = open.has(node.index) || hasProblem(node);
  const pending = busy && !item;
  return (
    <li className="wpn-ai-ws__node" data-depth={depth}>
      <div
        className={[
          "wpn-ai-ws__row",
          item ? `wpn-ai-ws__row--${item.status}` : "",
          pending ? "wpn-ai-ws__row--pending" : "",
        ].join(" ")}
      >
        <button
          type="button"
          className="wpn-ai-ws__toggle"
          aria-expanded={expandable ? expanded : undefined}
          disabled={!expandable}
          onClick={() => toggle(node.index)}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${node.title}`}
        >
          <Icon
            name="chevronRight"
            className={["wpn-ai-ws__chevron", expanded ? "wpn-ai-ws__chevron--open" : ""].join(" ")}
          />
        </button>
        <span className={`wpn-ai-ws__kind wpn-ai-ws__kind--${node.kind}`} aria-hidden="true">
          <Icon name={KIND_ICON[node.kind]} />
        </span>
        <span className="wpn-ai-ws__title">
          <span className="wpn-ai-ws__name">{node.title}</span>
          {node.hint ? <span className="wpn-ai-muted"> · {node.hint}</span> : null}
          {node.children.length > 0 ? (
            <span className="wpn-ai-muted">
              {" "}
              · {node.children.length} {node.children.length === 1 ? "story" : "stories"}
            </span>
          ) : null}
          {!expanded && node.notes ? (
            <span className="wpn-ai-ws__snippet">{snippet(node.notes)}</span>
          ) : null}
        </span>
        <span className={`wpn-ai-ws__badge wpn-ai-ws__badge--${node.action}`}>
          {node.action === "create" ? "New" : "Update"}
        </span>
        <span className="wpn-ai-ws__state" aria-hidden="true">
          {item ? (
            item.status === "done" ? (
              <Icon name="check" />
            ) : (
              "✕"
            )
          ) : pending ? (
            <Spinner />
          ) : null}
        </span>
        {item?.status === "done" && item.id && item.kind !== "user_story" ? (
          <button type="button" className="wpn-ai-link" onClick={() => onOpen(item)}>
            Open
          </button>
        ) : null}
      </div>
      {item?.error ? <p className="wpn-ai-ws__error">{item.error}</p> : null}
      {expanded ? (
        <div className="wpn-ai-ws__detail">
          {node.notes ? <p className="wpn-ai-ws__notes">{node.notes}</p> : null}
          {node.details.length > 0 ? (
            <ul className="wpn-ai-ws__tags" aria-label="Contents">
              {node.details.map((detail, i) => (
                <li key={`${detail}-${i}`}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {node.children.length > 0 ? (
            <ul className="wpn-ai-ws__tree">
              {node.children.map((child) => (
                <Row
                  key={child.index}
                  node={child}
                  depth={depth + 1}
                  open={open}
                  toggle={toggle}
                  items={items}
                  busy={busy}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export interface WorkspaceProposalProps {
  batch: AiWorkspaceBatch;
  entry: WorkspaceRunView;
  canApply: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  onOpen: (item: WorkspaceApplyItem) => void;
}

export function WorkspaceProposal({
  batch,
  entry,
  canApply,
  onApprove,
  onDiscard,
  onOpen,
}: WorkspaceProposalProps) {
  const tabsId = useId();
  const epicTitleOf = useExistingEpicTitle(batch);
  const tree = useMemo(
    () => describeWorkspaceTree(batch.ops, epicTitleOf),
    [batch.ops, epicTitleOf],
  );
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const busy = entry.phase === "applying";
  const actionable = entry.phase === "idle" || entry.phase === "failed";
  const counts = useMemo(() => countNodes(tree), [tree]);
  const groups = useMemo(() => groupByKind(tree), [tree]);
  const tabs = useMemo(() => TAB_ORDER.filter((kind) => groups.has(kind)), [groups]);
  const [picked, setPicked] = useState<WorkspaceTreeNode["kind"] | null>(null);
  const problemKinds = useMemo(() => {
    const bad = new Set(entry.items.filter((item) => item.status !== "done").map((i) => i.index));
    const kinds = new Set<WorkspaceTreeNode["kind"]>();
    for (const [kind, nodes] of groups)
      if (nodes.some((node) => bad.has(node.index))) kinds.add(kind);
    return kinds;
  }, [entry.items, groups]);
  const firstProblem = tabs.find((kind) => problemKinds.has(kind));
  const tab = picked && tabs.includes(picked) ? picked : (firstProblem ?? tabs[0] ?? "epic");
  const shown = tabs.length > 1 ? (groups.get(tab) ?? []) : tree;
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  return (
    <article className={`wpn-ai-card wpn-ai-ws__proposal wpn-ai-ws__proposal--${entry.phase}`}>
      <header className="wpn-ai-card__head">
        <Icon name="sparkles" />
        <span className="wpn-ai-card__title">{batch.title || "Proposed changes"}</span>
        <span className={`wpn-ai-chip wpn-ai-chip--${PHASE_CHIP[entry.phase]}`}>
          {PHASE_LABELS[entry.phase]}
        </span>
      </header>
      {batch.rationale ? <p className="wpn-ai-card__body">{batch.rationale}</p> : null}
      {tabs.length > 1 ? null : (
        <div className="wpn-ai-ws__bar">
          <ul className="wpn-ai-ws__counts" aria-label="Summary">
            {([...counts.entries()] as [WorkspaceTreeNode["kind"], number][]).map(([kind, n]) => (
              <li key={kind} className={`wpn-ai-ws__count wpn-ai-ws__kind--${kind}`}>
                <Icon name={KIND_ICON[kind]} />
                {n} {KIND_LABEL[kind][n === 1 ? 0 : 1]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tabs.length > 1 ? (
        <div className="wpn-ai-ws__tabs" role="tablist" aria-label="Proposed items">
          {tabs.map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              id={`${tabsId}-${kind}`}
              aria-selected={tab === kind}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab === kind ? 0 : -1}
              className={["wpn-ai-ws__tab", tab === kind ? "wpn-ai-ws__tab--on" : ""].join(" ")}
              onClick={() => setPicked(kind)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const at = tabs.indexOf(kind);
                const next =
                  tabs[(at + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
                if (next) {
                  setPicked(next);
                  document.getElementById(`${tabsId}-${next}`)?.focus();
                }
              }}
            >
              <Icon name={KIND_ICON[kind]} className="wpn-ai-ws__tab-icon" />
              {TAB_LABEL[kind]}
              <span className="wpn-ai-ws__tab-count">{counts.get(kind) ?? 0}</span>
              {problemKinds.has(kind) ? (
                <span className="wpn-ai-ws__tab-alert" role="img" aria-label="Needs attention" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      <ul
        className="wpn-ai-ws__tree"
        key={tab}
        id={`${tabsId}-panel`}
        role={tabs.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={tabs.length > 1 ? `${tabsId}-${tab}` : undefined}
      >
        {shown.map((node) => (
          <Row
            key={node.index}
            node={node}
            depth={0}
            open={open}
            toggle={toggle}
            items={entry.items}
            busy={busy}
            onOpen={onOpen}
          />
        ))}
      </ul>
      {entry.summary ? <p className="wpn-ai-ws__summary">{entry.summary}</p> : null}
      {entry.error ? (
        <p className="wpn-ai-card__warn" role="alert">
          {entry.error}
        </p>
      ) : null}
      {actionable || busy ? (
        <div className="wpn-ai-card__actions">
          <button
            type="button"
            className="wpn-btn wpn-btn--primary"
            disabled={!canApply || busy}
            title={canApply ? undefined : "Your role cannot apply AI changes"}
            onClick={onApprove}
          >
            {busy ? (
              <Spinner className="wpn-btn__icon" />
            ) : (
              <Icon name="check" className="wpn-btn__icon" />
            )}
            {busy ? "Creating…" : entry.phase === "failed" ? "Try again" : "Approve & create"}
          </button>
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            disabled={busy}
            onClick={onDiscard}
          >
            <Icon name="x" className="wpn-btn__icon" />
            Discard
          </button>
        </div>
      ) : null}
    </article>
  );
}
