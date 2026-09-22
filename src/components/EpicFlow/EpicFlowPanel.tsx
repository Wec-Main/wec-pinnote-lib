import { useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon } from "../primitives";
import { createClientId } from "../../utils/format";
import type { Epic, EpicNote, UserStory } from "../../types/epicFlow.types";
import {
  EPIC_FLOW_SEED_EPICS,
  EPIC_FLOW_SEED_NOTES,
  EPIC_FLOW_SEED_STORIES,
} from "../../data/epicFlowSeedData";
import { EpicColumn } from "./EpicColumn";
import { UserStoryColumn } from "./UserStoryColumn";
import { EpicNotesColumn } from "./EpicNotesColumn";
import { CreateEpicModal } from "./CreateEpicModal";
import { CreateUserStoryModal } from "./CreateUserStoryModal";
import { CreateEpicNoteModal } from "./CreateEpicNoteModal";

export function EpicFlowPanel() {
  const { setEpicFlowOpen, activeAccount } = useAnnotationContext();
  const [epics, setEpics] = useState<Epic[]>(EPIC_FLOW_SEED_EPICS);
  const [allStories, setAllStories] = useState<UserStory[]>(EPIC_FLOW_SEED_STORIES);
  const [allNotes, setAllNotes] = useState<EpicNote[]>(EPIC_FLOW_SEED_NOTES);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(
    EPIC_FLOW_SEED_EPICS[0]?.id ?? null,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [showCreateEpic, setShowCreateEpic] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

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

  const handleCreateEpic = (data: Omit<Epic, "id">) => {
    const epic: Epic = { ...data, id: createClientId("epic") };
    setEpics((current) => [epic, ...current]);
    setSelectedEpicId(epic.id);
    setShowCreateEpic(false);
  };

  const handleCreateStory = (data: Omit<UserStory, "id" | "epicId">) => {
    if (!selectedEpicId) {
      return;
    }
    const story: UserStory = { ...data, id: createClientId("story"), epicId: selectedEpicId };
    setAllStories((current) => [story, ...current]);
    setShowCreateStory(false);
  };

  const handleCreateNote = (data: Omit<EpicNote, "id" | "epicId" | "createdAt" | "updatedAt">) => {
    if (!selectedEpicId) {
      return;
    }
    const now = new Date().toISOString();
    const note: EpicNote = {
      ...data,
      id: createClientId("note"),
      epicId: selectedEpicId,
      createdAt: now,
      updatedAt: now,
    };
    setAllNotes((current) => [note, ...current]);
    setShowCreateNote(false);
  };

  const storyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const story of allStories) {
      counts[story.epicId] = (counts[story.epicId] ?? 0) + 1;
    }
    return counts;
  }, [allStories]);

  const stories = useMemo(() => {
    if (!selectedEpicId) {
      return [];
    }
    return allStories.filter((story) => story.epicId === selectedEpicId).filter(
      (story) =>
        !normalizedQuery ||
        story.title.toLowerCase().includes(normalizedQuery) ||
        (story.description?.toLowerCase().includes(normalizedQuery) ?? false),
    );
  }, [allStories, selectedEpicId, normalizedQuery]);

  const notes = useMemo(() => {
    if (!selectedEpicId) {
      return [];
    }
    return allNotes.filter((note) => note.epicId === selectedEpicId).filter(
      (note) =>
        !normalizedQuery ||
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.content.toLowerCase().includes(normalizedQuery),
    );
  }, [allNotes, selectedEpicId, normalizedQuery]);

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
            className="wpn-icon-btn wpn-icon-btn--danger"
            aria-label="Close EpicFlow"
            onClick={() => setEpicFlowOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
      </div>
      <input
        className="wpn-epicflow-panel__search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search epics, stories or notes..."
        aria-label="Search EpicFlow"
      />
      <div className="wpn-epicflow-panel__columns">
        <EpicColumn
          epics={filteredEpics}
          selectedEpicId={selectedEpicId}
          storyCounts={storyCounts}
          onSelect={setSelectedEpicId}
          onCreate={() => setShowCreateEpic(true)}
        />
        <UserStoryColumn
          stories={stories}
          epicSelected={Boolean(selectedEpicId)}
          onCreate={() => setShowCreateStory(true)}
        />
        <EpicNotesColumn
          notes={notes}
          epicSelected={Boolean(selectedEpicId)}
          onCreate={() => setShowCreateNote(true)}
        />
      </div>
      {showCreateEpic ? (
        <CreateEpicModal onClose={() => setShowCreateEpic(false)} onCreate={handleCreateEpic} />
      ) : null}
      {showCreateStory && selectedEpic ? (
        <CreateUserStoryModal
          epic={selectedEpic}
          onClose={() => setShowCreateStory(false)}
          onCreate={handleCreateStory}
        />
      ) : null}
      {showCreateNote && selectedEpic ? (
        <CreateEpicNoteModal
          epic={selectedEpic}
          createdBy={activeAccount?.name ?? "You"}
          onClose={() => setShowCreateNote(false)}
          onCreate={handleCreateNote}
        />
      ) : null}
    </div>
  );
}
