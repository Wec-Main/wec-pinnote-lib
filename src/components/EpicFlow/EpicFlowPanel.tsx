import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  useAnnotationAuth,
  useAnnotationData,
  useAnnotationUi,
} from "../../context/AnnotationContext";
import { Icon, ListSearchBar, RefreshButton, Tooltip } from "../primitives";
import { Icons } from "../../assets/icons";
import { useEpicFlowApi } from "../../hooks/useEpicFlowApi";
import { useEpicFlowStream } from "../../hooks/useEpicFlowStream";
import { EpicFlowApiError } from "../../services/epicFlowApi";
import { applyEpicFlowStreamEvent } from "../../utils/applyEpicFlowStreamEvent";
import type { Epic, UserStory } from "../../types/epicFlow.types";
import type { StreamEvent } from "../../types/stream.types";
import { EpicColumn } from "./EpicColumn";
import { UserStoryColumn } from "./UserStoryColumn";
import { NotesPanel, type NotesPanelTarget } from "./NotesPanel";
import { EpicFormModal } from "./EpicFormModal";
import { UserStoryFormModal } from "./UserStoryFormModal";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { ResizeHandle } from "./ResizeHandle";
import { BoardSkeleton } from "./BoardSkeleton";

type EpicModalState = { mode: "create" } | { mode: "edit"; epic: Epic } | null;
type StoryModalState = { mode: "create" } | { mode: "edit"; story: UserStory } | null;
type PendingDelete = { kind: "epic"; epic: Epic } | { kind: "userStory"; story: UserStory } | null;

const MIN_PANE_WIDTH = 160;
const RESIZING_BODY_CLASS = "wpn-epicflow-resizing";

function describeApiError(err: unknown): string {
  return err instanceof EpicFlowApiError
    ? err.message
    : "Could not reach the EpicFlow API. Please try again.";
}

export function EpicFlowPanel() {
  const { config } = useAnnotationData();
  const { setEpicFlowOpen } = useAnnotationUi();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const api = useEpicFlowApi(config);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [allUserStories, setAllUserStories] = useState<UserStory[]>([]);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [selectedUserStoryId, setSelectedUserStoryId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [epicModal, setEpicModal] = useState<EpicModalState>(null);
  const [storyModal, setStoryModal] = useState<StoryModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [busy, setBusy] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [colWeights, setColWeights] = useState<[number, number, number]>([1, 1, 1]);
  const paneRefA = useRef<HTMLDivElement>(null);
  const paneRefB = useRef<HTMLDivElement>(null);
  const paneRefC = useRef<HTMLDivElement>(null);
  const paneRefs: [typeof paneRefA, typeof paneRefB, typeof paneRefC] = [
    paneRefA,
    paneRefB,
    paneRefC,
  ];
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const epicsRef = useRef(epics);
  const allUserStoriesRef = useRef(allUserStories);
  const selectedEpicIdRef = useRef(selectedEpicId);
  const selectedUserStoryIdRef = useRef(selectedUserStoryId);
  const reloadGenerationRef = useRef(0);
  epicsRef.current = epics;
  allUserStoriesRef.current = allUserStories;
  selectedEpicIdRef.current = selectedEpicId;
  selectedUserStoryIdRef.current = selectedUserStoryId;

  const normalizedQuery = query.trim().toLowerCase();

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

  const reloadAll = useCallback(
    async (signal?: AbortSignal) => {
      const generation = ++reloadGenerationRef.current;
      const [nextEpics, nextStories] = await Promise.all([
        api.getEpics(config.projectId, signal),
        api.getUserStoriesByProject(config.projectId, signal),
      ]);
      if (generation === reloadGenerationRef.current) {
        setEpics(nextEpics);
        setAllUserStories(nextStories);
      }
      return { nextEpics, nextStories };
    },
    [api, config.projectId],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setApiError(null);
    void reloadAll()
      .catch((err: unknown) => setApiError(describeApiError(err)))
      .finally(() => setRefreshing(false));
  }, [reloadAll]);

  const onStreamEvent = useCallback((event: StreamEvent) => {
    setEpics((currentEpics) => {
      const result = applyEpicFlowStreamEvent(currentEpics, allUserStoriesRef.current, event);
      if (
        result.epics !== currentEpics &&
        selectedEpicIdRef.current &&
        !result.epics.some((epic) => epic.id === selectedEpicIdRef.current)
      ) {
        setSelectedEpicId(null);
        setSelectedUserStoryId(null);
      }
      return result.epics;
    });
    setAllUserStories((currentUserStories) => {
      const result = applyEpicFlowStreamEvent(epicsRef.current, currentUserStories, event);
      if (
        result.userStories !== currentUserStories &&
        selectedUserStoryIdRef.current &&
        !result.userStories.some((story) => story.id === selectedUserStoryIdRef.current)
      ) {
        setSelectedUserStoryId(null);
      }
      return result.userStories;
    });
  }, []);

  const connectionState = useEpicFlowStream({
    apiBaseUrl: config.apiBaseUrl,
    projectId: config.projectId,
    getAuthToken: config.getAuthToken,
    sessionKey: hostAuthenticated ? "host" : (activeAccount?.id ?? ""),
    enabled: true,
    onEvent: onStreamEvent,
    onResync: handleRefresh,
  });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const { nextEpics } = await reloadAll(controller.signal);
        setSelectedEpicId((current) => current ?? nextEpics[0]?.id ?? null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setApiError(describeApiError(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      controller.abort();
    };
  }, [reloadAll]);

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

  const handleSubmitEpic = async (data: { title: string; description: string }) => {
    setBusy(true);
    try {
      if (epicModal?.mode === "edit") {
        await api.updateEpic(epicModal.epic.id, data);
      } else {
        const created = await api.createEpic({ ...data, projectId: config.projectId });
        setSelectedEpicId(created.id);
        setSelectedUserStoryId(null);
      }
      await reloadAll();
      setEpicModal(null);
    } catch (err) {
      setApiError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteEpic = async (epic: Epic) => {
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitStory = async (data: { title: string; description: string }) => {
    setBusy(true);
    try {
      if (storyModal?.mode === "edit") {
        await api.updateUserStory(storyModal.story.id, data);
      } else if (selectedEpicId) {
        const created = await api.createUserStory(selectedEpicId, data);
        setSelectedUserStoryId(created.id);
      }
      await reloadAll();
      setStoryModal(null);
    } catch (err) {
      setApiError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteStory = async (story: UserStory) => {
    setBusy(true);
    try {
      await api.deleteUserStory(story.id);
      if (selectedUserStoryId === story.id) {
        setSelectedUserStoryId(null);
      }
      await reloadAll();
      setPendingDelete(null);
    } catch (err) {
      setApiError(describeApiError(err));
    } finally {
      setBusy(false);
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
      className={["wpn-epicflow-panel", minimized ? "wpn-epicflow-panel--minimized" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="wpn-epicflow-panel__header">
        <span className="wpn-epicflow-panel__brand">
          <img src={Icons.epic} alt="" className="wpn-epicflow-panel__brand-icon" />
          <span className="wpn-panel__title">EpicFlow</span>
        </span>
        <div className="wpn-epicflow-panel__header-actions">
          {connectionState === "reconnecting" ? (
            <Tooltip label="Reconnecting to live updates" placement="bottom">
              <span
                className="wpn-toolbar__live wpn-toolbar__live--reconnecting"
                role="status"
                aria-label="Reconnecting to live updates"
              >
                <span className="wpn-toolbar__live-dot" />
              </span>
            </Tooltip>
          ) : connectionState === "unauthenticated" ? (
            <Tooltip label="Live updates paused, sign in again" placement="bottom">
              <span
                className="wpn-toolbar__live wpn-toolbar__live--unauthenticated"
                role="status"
                aria-label="Live updates paused, sign in again"
              >
                <span className="wpn-toolbar__live-dot" />
              </span>
            </Tooltip>
          ) : null}
          <Tooltip label={minimized ? "Maximize" : "Minimize"} placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label={minimized ? "Maximize EpicFlow" : "Minimize EpicFlow"}
              onClick={() => setMinimized((current) => !current)}
            >
              <Icon name={minimized ? "expand" : "windowMinimize"} />
            </button>
          </Tooltip>
          <Tooltip label="Close" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close EpicFlow"
              onClick={() => setEpicFlowOpen(false)}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>
      <ListSearchBar
        value={searchInput}
        onValueChange={setSearchInput}
        onSubmit={() => setQuery(searchInput)}
        onClear={() => {
          setSearchInput("");
          setQuery("");
        }}
        placeholder="Search epics or user stories"
        trailing={
          <RefreshButton label="Refresh EpicFlow" loading={refreshing} onRefresh={handleRefresh} />
        }
      />
      {loading ? (
        <BoardSkeleton />
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
              key={normalizedQuery}
              epics={filteredEpics}
              hasAnyEpics={epics.length > 0}
              selectedEpicId={selectedEpicId}
              storyCounts={storyCounts}
              currentUser={config.currentUser}
              onSelect={selectEpic}
              onCreate={() => setEpicModal({ mode: "create" })}
              onEdit={(epic) => setEpicModal({ mode: "edit", epic })}
              onDelete={(epic) => setPendingDelete({ kind: "epic", epic })}
            />
          </div>
          <ResizeHandle onMouseDown={onHandleMouseDown(0, 1)} />
          <div ref={paneRefs[1]} className="wpn-epicflow-pane" style={{ flexGrow: colWeights[1] }}>
            <UserStoryColumn
              key={`${selectedEpicId ?? ""}:${normalizedQuery}`}
              stories={filteredStories}
              hasStoriesForEpic={storiesForSelectedEpic.length > 0}
              epicSelected={Boolean(selectedEpicId)}
              selectedUserStoryId={selectedUserStoryId}
              currentUser={config.currentUser}
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
          busy={busy}
          onClose={() => setEpicModal(null)}
          onSubmit={handleSubmitEpic}
        />
      ) : null}

      {storyModal && selectedEpic ? (
        <UserStoryFormModal
          mode={storyModal.mode}
          epic={selectedEpic}
          initialStory={storyModal.mode === "edit" ? storyModal.story : undefined}
          busy={busy}
          onClose={() => setStoryModal(null)}
          onSubmit={handleSubmitStory}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={pendingDelete.kind === "epic" ? "Delete epic" : "Delete user story"}
          description={
            pendingDelete.kind === "epic"
              ? `This epic and its ${storyCounts[pendingDelete.epic.id] ?? 0} user ${
                  (storyCounts[pendingDelete.epic.id] ?? 0) === 1 ? "story" : "stories"
                } will be permanently deleted. This cannot be undone.`
              : "This user story will be permanently deleted. This cannot be undone."
          }
          detail={
            pendingDelete.kind === "epic" ? pendingDelete.epic.title : pendingDelete.story.title
          }
          confirmLabel="Delete"
          confirmIcon="trash"
          destructive
          busy={busy}
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
