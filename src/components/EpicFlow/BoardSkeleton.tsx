const SKELETON_COLUMNS: ReadonlyArray<{ title: string; cards: number }> = [
  { title: "Epic", cards: 4 },
  { title: "User Story", cards: 3 },
  { title: "Notes", cards: 1 },
];

export function BoardSkeleton() {
  return (
    <div className="wpn-epicflow-panel__columns" aria-busy="true" aria-live="polite">
      <span className="wpn-epicflow-skeleton__label">Loading EpicFlow…</span>
      {SKELETON_COLUMNS.map((column) => (
        <div key={column.title} className="wpn-epicflow-pane" style={{ flexGrow: 1 }}>
          <div className="wpn-epicflow-column">
            <div className="wpn-epicflow-column__header">
              <span className="wpn-epicflow-column__title">{column.title}</span>
              <span className="wpn-epicflow-skeleton wpn-epicflow-skeleton--pill" />
            </div>
            <div className="wpn-epicflow-column__body">
              {Array.from({ length: column.cards }, (_, index) => (
                <div key={index} className="wpn-epicflow-card wpn-epicflow-skeleton-card">
                  <span className="wpn-epicflow-skeleton wpn-epicflow-skeleton--title" />
                  <span className="wpn-epicflow-skeleton wpn-epicflow-skeleton--line" />
                  <span className="wpn-epicflow-skeleton wpn-epicflow-skeleton--line wpn-epicflow-skeleton--short" />
                  <span className="wpn-epicflow-skeleton wpn-epicflow-skeleton--meta" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
