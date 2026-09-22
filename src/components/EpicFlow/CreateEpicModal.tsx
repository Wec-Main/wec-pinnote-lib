import { useState, type FormEvent } from "react";
import type { Epic, EpicPriority, EpicStatus } from "../../types/epicFlow.types";
import { Icon, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

const PRIORITY_OPTIONS: { value: EpicPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_OPTIONS: { value: EpicStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const TIPS = [
  "Keep it concise and clear",
  "Focus on the value to the user or business",
  "Avoid implementation details",
  "Break it down into smaller user stories later",
  "Use clear and descriptive title",
];

interface CreateEpicModalProps {
  onClose: () => void;
  onCreate: (epic: Omit<Epic, "id">) => void;
}

export function CreateEpicModal({ onClose, onCreate }: CreateEpicModalProps) {
  useEscapeKey(onClose);
  const scrimProps = useScrimDismiss(onClose);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<EpicPriority>("high");
  const [status, setStatus] = useState<EpicStatus>("planned");
  const [targetRelease, setTargetRelease] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const canSubmit = Boolean(trimmedTitle) && Boolean(trimmedDescription);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onCreate({
      title: trimmedTitle,
      description: trimmedDescription,
      priority,
      status,
      targetRelease: targetRelease.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        className="wpn-epicflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-create-epic-title"
        onSubmit={onSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <div>
            <h2 className="wpn-epicflow-modal__title" id="wpn-create-epic-title">Create Epic</h2>
            <p className="wpn-epicflow-modal__subtitle">
              Define a high-level goal that delivers significant value.
            </p>
          </div>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close create epic"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-epicflow-modal__body">
          <div className="wpn-epicflow-modal__fields">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Epic Title <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={title}
                maxLength={TITLE_MAX}
                placeholder="e.g. AI-Powered Shopping Experience"
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
              <span className="wpn-epicflow-modal__counter">
                {title.length}/{TITLE_MAX}
              </span>
            </label>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Description <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <textarea
                className="wpn-epicflow-modal__input wpn-epicflow-modal__textarea"
                value={description}
                maxLength={DESCRIPTION_MAX}
                placeholder="Describe the epic, its goals and expected outcomes..."
                rows={4}
                onChange={(event) => setDescription(event.target.value)}
              />
              <span className="wpn-epicflow-modal__counter">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </label>

            <div className="wpn-epicflow-modal__row">
              <label className="wpn-epicflow-modal__field">
                <span className="wpn-epicflow-modal__label">Priority</span>
                <select
                  className="wpn-epicflow-modal__input wpn-epicflow-modal__select"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as EpicPriority)}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wpn-epicflow-modal__field">
                <span className="wpn-epicflow-modal__label">Status</span>
                <select
                  className="wpn-epicflow-modal__input wpn-epicflow-modal__select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as EpicStatus)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Target Release (Optional)</span>
              <input
                className="wpn-epicflow-modal__input"
                value={targetRelease}
                placeholder="Select release"
                onChange={(event) => setTargetRelease(event.target.value)}
              />
            </label>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Tags (Optional)</span>
              <input
                className="wpn-epicflow-modal__input"
                value={tagsInput}
                placeholder="Add tags (e.g. AI, Customer Experience, Q4)"
                onChange={(event) => setTagsInput(event.target.value)}
              />
            </label>
          </div>

          <aside className="wpn-epicflow-modal__tips">
            <p className="wpn-epicflow-modal__tips-title">Tips for a great epic</p>
            <ul className="wpn-epicflow-modal__tips-list">
              {TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <p className="wpn-epicflow-modal__tips-example-label">Example</p>
            <div className="wpn-epicflow-modal__tips-example">
              <strong>AI-Powered Shopping Experience</strong>
              <span>
                Personalized product discovery using AI to improve customer engagement and sales.
              </span>
            </div>
          </aside>
        </div>

        <div className="wpn-epicflow-modal__footer">
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onClose}>
            <Icon name="close" className="wpn-btn__icon" />
            Cancel
          </button>
          <button type="submit" className="wpn-btn wpn-btn--primary" disabled={!canSubmit}>
            <Icon name="plus" className="wpn-btn__icon" />
            Create Epic
          </button>
        </div>
      </form>
    </div>
  );
}
