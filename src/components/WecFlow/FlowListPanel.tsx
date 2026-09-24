import { useCallback, useState } from "react";
import { useAnnotationAuth, useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Spinner, Tooltip } from "../primitives";
import { AuthorBadge } from "../EpicFlow/AuthorBadge";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { useSharedFetch, invalidateSharedFetch } from "../../hooks/useSharedFetch";
import { useTokenGetter } from "../../hooks/useTokenGetter";
import { createFlow, deleteFlow, listFlows, updateFlow } from "../../services/flowApi";
import { canDeleteBoardItem } from "../../utils/boardPermissions";
import { formatTimestamp } from "../../utils/format";
import type { Flow } from "../../types/flowPin.types";
import { FlowFormModal } from "./FlowFormModal";

type FormModalState = { mode: "create" } | { mode: "edit"; flow: Flow } | null;

function describeApiError(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not reach the Flow API.";
}

interface FlowListPanelProps {
  onOpen: (flowId: string) => void;
}

export function FlowListPanel({ onOpen }: FlowListPanelProps) {
  const { config } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const getToken = useTokenGetter(config.getAuthToken);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const flowsKey = sessionKey
    ? `flows-list:${config.apiBaseUrl}:${sessionKey}:${config.projectId}`
    : null;

  const {
    data: flows,
    loading,
    error,
    reload,
  } = useSharedFetch(flowsKey, (signal) =>
    getToken().then((authToken) =>
      listFlows(config.apiBaseUrl, authToken, config.projectId, signal),
    ),
  );

  const [formModal, setFormModal] = useState<FormModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<Flow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (flowsKey) {
      invalidateSharedFetch(flowsKey);
    }
    reload();
  }, [flowsKey, reload]);

  const handleSubmit = async (data: { name: string; description: string }) => {
    setBusy(true);
    setActionError(null);
    try {
      const authToken = await getToken();
      if (formModal?.mode === "edit") {
        await updateFlow(config.apiBaseUrl, authToken, formModal.flow.id, data);
      } else {
        await createFlow(config.apiBaseUrl, authToken, { projectId: config.projectId, ...data });
      }
      refresh();
      setFormModal(null);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const authToken = await getToken();
      await deleteFlow(config.apiBaseUrl, authToken, pendingDelete.id);
      refresh();
      setPendingDelete(null);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const list = flows ?? [];

  return (
    <div className="wpn-flow-list">
      <div className="wpn-flow-list__header">
        <span className="wpn-flow-list__title">
          Flows
          <span className="wpn-flow-list__count">{list.length}</span>
        </span>
        <button
          type="button"
          className="wpn-btn wpn-btn--primary"
          onClick={() => setFormModal({ mode: "create" })}
        >
          <Icon name="plus" className="wpn-btn__icon" />
          New Flow
        </button>
      </div>

      {loading ? (
        <p className="wpn-flow-list__empty">Loading flows…</p>
      ) : list.length === 0 ? (
        <p className="wpn-flow-list__empty">
          No flows yet. Create one to start mapping out a flow chart.
        </p>
      ) : (
        <>
          <section className="wpn-flow-list__section">
            <h3 className="wpn-flow-list__section-title">Flow</h3>
            <table className="wpn-flow-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Author</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((flow) => (
                  <tr key={flow.id}>
                    <td className="wpn-flow-table__name">{flow.name}</td>
                    <td>
                      <AuthorBadge name={flow.createdByUser} />
                    </td>
                    <td className="wpn-flow-table__meta">
                      {formatTimestamp(flow.updatedAt)}
                    </td>
                    <td>
                      <div className="wpn-flow-table__actions">
                        <Tooltip label="Edit flow" placement="bottom">
                          <button
                            type="button"
                            className="wpn-icon-btn"
                            aria-label="Edit flow"
                            onClick={() => setFormModal({ mode: "edit", flow })}
                          >
                            <Icon name="edit" />
                          </button>
                        </Tooltip>
                        {canDeleteBoardItem(flow.createdById, config.currentUser) ? (
                          <Tooltip label="Delete flow" placement="bottom">
                            <button
                              type="button"
                              className="wpn-icon-btn wpn-icon-btn--danger"
                              aria-label="Delete flow"
                              onClick={() => setPendingDelete(flow)}
                            >
                              <Icon name="trash" />
                            </button>
                          </Tooltip>
                        ) : null}
                        <button
                          type="button"
                          className="wpn-btn wpn-btn--ghost wpn-flow-table__open"
                          onClick={() => onOpen(flow.id)}
                        >
                          Open
                          <Icon name="chevronRight" className="wpn-btn__icon" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="wpn-flow-list__section">
            <h3 className="wpn-flow-list__section-title">Notes</h3>
            <table className="wpn-flow-table">
              <thead>
                <tr>
                  <th>Notes</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((flow) => (
                  <tr key={flow.id}>
                    <td className="wpn-flow-table__notes">
                      {flow.description ? (
                        flow.description
                      ) : (
                        <span className="wpn-muted">No notes</span>
                      )}
                    </td>
                    <td>
                      <div className="wpn-flow-table__actions">
                        <button
                          type="button"
                          className="wpn-btn wpn-btn--ghost wpn-flow-table__open"
                          onClick={() => onOpen(flow.id)}
                        >
                          Open
                          <Icon name="chevronRight" className="wpn-btn__icon" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {error ? (
        <div className="wpn-flow-panel__notice" role="alert">
          <span>{describeApiError(error)}</span>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
            Retry
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="wpn-flow-panel__notice" role="alert">
          <span>{actionError}</span>
          <button
            type="button"
            className="wpn-icon-btn"
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
          >
            {busy ? <Spinner /> : <Icon name="close" />}
          </button>
        </div>
      ) : null}

      {formModal ? (
        <FlowFormModal
          mode={formModal.mode}
          initialFlow={formModal.mode === "edit" ? formModal.flow : undefined}
          busy={busy}
          onClose={() => setFormModal(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete flow"
          description={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}
