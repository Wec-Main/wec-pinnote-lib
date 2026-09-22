import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icons } from "../../assets/icons";
import { useEpicFlowApi } from "../../hooks/useEpicFlowApi";
import { EpicFlowApiError } from "../../services/epicFlowApi";
import type { Epic, UserStory } from "../../types/epicFlow.types";
import { EpicColumn } from "./EpicColumn";
import { UserStoryColumn } from "./UserStoryColumn";
import { NotesPanel, type NotesPanelTarget } from "./NotesPanel";
import { EpicFormModal } from "./EpicFormModal";
import { UserStoryFormModal } from "./UserStoryFormModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { ResizeHandle } from "./ResizeHandle";

type EpicModalState = { mode: "create" } | { mode: "edit"; epic: Epic } | null;
type StoryModalState = { mode: "create" } | { mode: "edit"; story: UserStory } | null;
type PendingDelete = { kind: "epic"; epic: Epic } | { kind: "userStory"; story: UserStory } | null;

const MIN_PANE_WIDTH = 160;
const RESIZING_BODY_CLASS = "wpn-epicflow-resizing";

function describeApiError(err: unknown): string {
  return err instanceof EpicFlowApiError
    ? `EpicFlow request failed (${err.status}). Please try again.`
    : "Could not reach the EpicFlow API. Please try again.";
}

export function EpicFlowPanel() {
  const { setEpicFlowOpen, activeAccount, config } = useAnnotationContext();
  const api = useEpicFlowApi(config);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [allUserStories, setAllUserStories] = useState<UserStory[]>([]);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [selectedUserStoryId, setSelectedUserStoryId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [query, setQuery] = useState("");
  const [epicModal, setEpicModal] = useState<EpicModalState>(null);
  const [storyModal, setStoryModal] = useState<StoryModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [colWeights, setColWeights] = useState<[number, number, number]>([1, 1, 1]);
  const paneRefA = useRef<HTMLDivElement>(null);
  const paneRefB = useRef<HTMLDivElement>(null);
  const paneRefC = useRef<HTMLDivElement>(null);
  const paneRefs: [typeof paneRefA, typeof paneRefB, typeof paneRefC] = [paneRefA, paneRefB, paneRefC];
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  // Dragging the handle between pane `indexA` and `indexB` (always adjacent)
  // only trades width between those two panes (their combined width, and
  // thus the third pane's width, stays fixed) — standard split-pane resize.
  const onHandleMouseDown =
    (indexA: 0 | 1, indexB: 1 | 2) => (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const paneA = paneRefs[indexA].current;
      const paneB = paneRefs[indexB].current;
      if (!paneA || !paneB) {
        return;
      }
      const startX = event.clientX;
      const widthA = paneA.getBoundingClientRect().width;
      const widthB = paneB.getBoundingClientRect().width;
      const totalWidth = widthA + widthB;
      const totalWeight = colWeights[indexA] + colWeights[indexB];
      const pxPerWeight = totalWidth / totalWeight;

      const handleMove = (moveEvent: MouseEvent) => {
        let newWidthA = widthA + (moveEvent.clientX - startX);
        newWidthA = Math.max(MIN_PANE_WIDTH, Math.min(totalWidth - MIN_PANE_WIDTH, newWidthA));
        const newWidthB = totalWidth - newWidthA;
        setColWeights((prev) => {
          const next = [...prev] as [number, number, number];
          next[indexA] = newWidthA / pxPerWeight;
          next[indexB] = newWidthB / pxPerWeight;
          return next;
        });
      };

      const handleUp = () => {
        document.body.classList.remove(RESIZING_BODY_CLASS);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        dragCleanupRef.current = null;
      };

      document.body.classList.add(RESIZING_BODY_CLASS);
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      dragCleanupRef.current = handleUp;
    };

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const reloadAll = useCallback(async () => {
    const nextEpics = await api.getEpics(config.projectId);
    const storiesByEpic = await Promise.all(
      nextEpics.map((epic) => api.getUserStoriesByEpic(epic.id)),
    );
    const nextStories = storiesByEpic.flat();
    setEpics(nextEpics);
    setAllUserStories(nextStories);
    return { nextEpics, nextStories };
  }, [api, config.projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { nextEpics } = await reloadAll();
        if (!cancelled) {
          setSelectedEpicId((current) => current ?? nextEpics[0]?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setApiError(describeApiError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadAll]);

  const displayName = () => activeAccount?.name.trim() || undefined;

  const filteredEpics = useMemo(() => {
    if (!normalizedQuery) {
      return epics;
    }
    return epics.filter(
      (epic) =>
        epic.title.toLowerCase().includes(normalizedQuery) ||
        epic.description.toLowerCase().includes(normalizedQuery),
    );
  }, [epics, normalizedQuery]);

  const selectedEpic = useMemo(
    () => epics.find((epic) => epic.id === selectedEpicId) ?? null,
    [epics, selectedEpicId],
  );

  const storyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const story of allUserStories) {
      counts[story.epicId] = (counts[story.epicId] ?? 0) + 1;
    }
    return counts;
  }, [allUserStories]);

  const storiesForSelectedEpic = useMemo(() => {
    if (!selectedEpicId) {
      return [];
    }
    return allUserStories.filter((story) => story.epicId === selectedEpicId);
  }, [allUserStories, selectedEpicId]);

  const filteredStories = useMemo(() => {
    if (!normalizedQuery) {
      return storiesForSelectedEpic;
    }
    return storiesForSelectedEpic.filter(
      (story) =>
        story.title.toLowerCase().includes(normalizedQuery) ||
        story.description.toLowerCase().includes(normalizedQuery),
    );
  }, [storiesForSelectedEpic, normalizedQuery]);

  const selectedStory = useMemo(
    () => allUserStories.find((story) => story.id === selectedUserStoryId) ?? null,
    [allUserStories, selectedUserStoryId],
  );

  const notesTarget: NotesPanelTarget | null = useMemo(() => {
    if (selectedStory) {
      return { type: "userStory", story: selectedStory };
    }
    if (selectedEpic) {
      return { type: "epic", epic: selectedEpic };
    }
    return null;
  }, [selectedEpic, selectedStory]);

  const selectEpic = (epicId: string) => {
    setSelectedEpicId(epicId);
    setSelectedUserStoryId(null);
  };

  const selectStory = (storyId: string) => {
    setSelectedUserStoryId(storyId);
  };

  // ---- Epic actions ----
  const handleSubmitEpic = async (data: { title: string; description: string }) => {
    try {
      if (epicModal?.mode === "edit") {
        await api.updateEpic(epicModal.epic.id, data);
      } else {
        const created = await api.createEpic({
          ...data,
          projectId: config.projectId,
          createdByUser: displayName(),
        });
        setSelectedEpicId(created.id);
        setSelectedUserStoryId(null);
      }
      await reloadAll();
      setEpicModal(null);
    } catch (err) {
      setApiError(describeApiError(err));
    }
  };

  const confirmDeleteEpic = async (epic: Epic) => {
    try {
      await api.deleteEpic(epic.id);
      if (selectedEpicId === epic.id) {
        setSelectedEpicId(null);
        setSelectedUserStoryId(null);
      }
      await reloadAll();
      setPendingDelete(null);
    } catch (err) {
      setApiError(describeApiError(err));
    }
  };

  // ---- User story actions ----
  const handleSubmitStory = async (data: { title: string; description: string }) => {
    try {
      if (storyModal?.mode === "edit") {
        await api.updateUserStory(storyModal.story.id, data);
      } else if (selectedEpicId) {
        const created = await api.createUserStory(selectedEpicId, {
          ...data,
          createdByUser: displayName(),
        });
        setSelectedUserStoryId(created.id);
      }
      await reloadAll();
      setStoryModal(null);
    } catch (err) {
      setApiError(describeApiError(err));
    }
  };

  const confirmDeleteStory = async (story: UserStory) => {
    try {
      await api.deleteUserStory(story.id);
      if (selectedUserStoryId === story.id) {
        setSelectedUserStoryId(null);
      }
      await reloadAll();
      setPendingDelete(null);
    } catch (err) {
      setApiError(describeApiError(err));
    }
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    if (pendingDelete.kind === "epic") {
      void confirmDeleteEpic(pendingDelete.epic);
    } else {
      void confirmDeleteStory(pendingDelete.story);
    }
  };

  // ---- Notes panel edit/delete (acts on whichever Epic or User Story is selected) ----
  const handleEditFromNotes = () => {
    if (notesTarget?.type === "epic") {
      setEpicModal({ mode: "edit", epic: notesTarget.epic });
    } else if (notesTarget?.type === "userStory") {
      setStoryModal({ mode: "edit", story: notesTarget.story });
    }
  };

  const handleDeleteFromNotes = () => {
    if (notesTarget?.type === "epic") {
      setPendingDelete({ kind: "epic", epic: notesTarget.epic });
    } else if (notesTarget?.type === "userStory") {
      setPendingDelete({ kind: "userStory", story: notesTarget.story });
    }
  };

  return (
    <div
      className={["wpn-epicflow-panel", fullscreen ? "wpn-epicflow-panel--fullscreen" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="wpn-epicflow-panel__header">
        <span className="wpn-panel__title">EpicFlow</span>
        <div className="wpn-epicflow-panel__header-actions">
          <button
            type="button"
            className="wpn-icon-btn"
            aria-label={fullscreen ? "Exit fullscreen" : "Expand EpicFlow"}
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? (
              <svg viewBox="0 0 24 24" className="wpn-epicflow-panel__header-icon" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M4 10V5h5M4 14v5h5M20 10V5h-5M20 14v5h-5"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="wpn-epicflow-panel__header-icon" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="wpn-icon-btn"
            aria-label="Close EpicFlow"
            onClick={() => setEpicFlowOpen(false)}
          >
            <span
              aria-hidden="true"
              className="wpn-epicflow-panel__close-icon"
              style={{
                WebkitMaskImage: `url(${Icons.close})`,
                maskImage: `url(${Icons.close})`,
              }}
            />
          </button>
        </div>
      </div>
      <input
        className="wpn-epicflow-panel__search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search epics or user stories..."
        aria-label="Search EpicFlow"
      />
      {loading ? (
        <div className="wpn-epicflow-panel__columns">
          <p className="wpn-epicflow-empty">Loading EpicFlow…</p>
        </div>
      ) : notesExpanded ? (
        <div className="wpn-epicflow-panel__columns">
          <div className="wpn-epicflow-pane" style={{ flexGrow: 1 }}>
            <NotesPanel
              target={notesTarget}
              expanded
              onToggleExpand={() => setNotesExpanded(false)}
              onEdit={handleEditFromNotes}
              onDelete={handleDeleteFromNotes}
            />
          </div>
        </div>
      ) : (
        <div className="wpn-epicflow-panel__columns">
          <div ref={paneRefs[0]} className="wpn-epicflow-pane" style={{ flexGrow: colWeights[0] }}>
            <EpicColumn
              epics={filteredEpics}
              hasAnyEpics={epics.length > 0}
              selectedEpicId={selectedEpicId}
              storyCounts={storyCounts}
              onSelect={selectEpic}
              onCreate={() => setEpicModal({ mode: "create" })}
              onEdit={(epic) => setEpicModal({ mode: "edit", epic })}
              onDelete={(epic) => setPendingDelete({ kind: "epic", epic })}
            />
          </div>
          <ResizeHandle onMouseDown={onHandleMouseDown(0, 1)} />
          <div ref={paneRefs[1]} className="wpn-epicflow-pane" style={{ flexGrow: colWeights[1] }}>
            <UserStoryColumn
              stories={filteredStories}
              hasStoriesForEpic={storiesForSelectedEpic.length > 0}
              epicSelected={Boolean(selectedEpicId)}
              selectedUserStoryId={selectedUserStoryId}
              onSelect={selectStory}
              onCreate={() => setStoryModal({ mode: "create" })}
              onEdit={(story) => setStoryModal({ mode: "edit", story })}
              onDelete={(story) => setPendingDelete({ kind: "userStory", story })}
            />
          </div>
          <ResizeHandle onMouseDown={onHandleMouseDown(1, 2)} />
          <div ref={paneRefs[2]} className="wpn-epicflow-pane" style={{ flexGrow: colWeights[2] }}>
            <NotesPanel
              target={notesTarget}
              expanded={false}
              onToggleExpand={() => setNotesExpanded(true)}
              onEdit={handleEditFromNotes}
              onDelete={handleDeleteFromNotes}
            />
          </div>
        </div>
      )}

      {epicModal ? (
        <EpicFormModal
          mode={epicModal.mode}
          initialEpic={epicModal.mode === "edit" ? epicModal.epic : undefined}
          onClose={() => setEpicModal(null)}
          onSubmit={handleSubmitEpic}
        />
      ) : null}

      {storyModal && selectedEpic ? (
        <UserStoryFormModal
          mode={storyModal.mode}
          epic={selectedEpic}
          initialStory={storyModal.mode === "edit" ? storyModal.story : undefined}
          onClose={() => setStoryModal(null)}
          onSubmit={handleSubmitStory}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={pendingDelete.kind === "epic" ? "Delete Epic" : "Delete User Story"}
          message={
            pendingDelete.kind === "epic"
              ? `Delete "${pendingDelete.epic.title}"? This also permanently deletes its ${
                  storyCounts[pendingDelete.epic.id] ?? 0
                } user ${
                  (storyCounts[pendingDelete.epic.id] ?? 0) === 1 ? "story" : "stories"
                }. This cannot be undone.`
              : `Delete "${pendingDelete.story.title}"? This cannot be undone.`
          }
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {apiError ? (
        <div className="wpn-toast" role="alert">
          <span>{apiError}</span>
          <button
            type="button"
            className="wpn-icon-btn"
            onClick={() => setApiError(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
