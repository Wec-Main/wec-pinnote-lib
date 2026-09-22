import { useState, type FormEvent } from "react";
import type { Epic, EpicPriority, UserStory, UserStoryStatus } from "../../types/epicFlow.types";
import { Icon, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 500;

const PRIORITY_OPTIONS: { value: EpicPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_OPTIONS: { value: UserStoryStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const TIPS = [
  "Use a clear format: As a [user], I want [goal] so that [benefit]",
  "Keep it concise and specific",
  "Focus on user value",
  "Add acceptance criteria if needed",
];

interface CreateUserStoryModalProps {
  epic: Epic;
  onClose: () => void;
  onCreate: (story: Omit<UserStory, "id" | "epicId">) => void;
}

export function CreateUserStoryModal({ epic, onClose, onCreate }: CreateUserStoryModalProps) {
  useEscapeKey(onClose);
  const scrimProps = useScrimDismiss(onClose);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<EpicPriority>("high");
  const [status, setStatus] = useState<UserStoryStatus>("todo");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const trimmedTitle = title.trim();
  const canSubmit = Boolean(trimmedTitle);

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
      description: description.trim() || undefined,
      status,
      priority,
      assignee: assignee.trim() || undefined,
      sprint: sprint.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        className="wpn-epicflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-create-story-title"
        onSubmit={onSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <div>
            <h2 className="wpn-epicflow-modal__title" id="wpn-create-story-title">Create User Story</h2>
            <p className="wpn-epicflow-modal__subtitle">
              Capture a clear and concise user story for this epic.
            </p>
          </div>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close create user story"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-epicflow-modal__body">
          <div className="wpn-epicflow-modal__fields">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Epic</span>
              <div className="wpn-epicflow-modal__readonly">{epic.title}</div>
            </div>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                User Story Title <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={title}
                maxLength={TITLE_MAX}
                placeholder="e.g. As a customer, I want personalized product recommendations"
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
              <span className="wpn-epicflow-modal__counter">
                {title.length}/{TITLE_MAX}
              </span>
            </label>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Description (Optional)</span>
              <textarea
                className="wpn-epicflow-modal__input wpn-epicflow-modal__textarea"
                value={description}
                maxLength={DESCRIPTION_MAX}
                placeholder="Add more details about the story, acceptance criteria, or context..."
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
                  onChange={(event) => setStatus(event.target.value as UserStoryStatus)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="wpn-epicflow-modal__row">
              <label className="wpn-epicflow-modal__field">
                <span className="wpn-epicflow-modal__label">Assignee (Optional)</span>
                <input
                  className="wpn-epicflow-modal__input"
                  value={assignee}
                  placeholder="Select assignee"
                  onChange={(event) => setAssignee(event.target.value)}
                />
              </label>
              <label className="wpn-epicflow-modal__field">
                <span className="wpn-epicflow-modal__label">Sprint / Release (Optional)</span>
                <input
                  className="wpn-epicflow-modal__input"
                  value={sprint}
                  placeholder="Select sprint"
                  onChange={(event) => setSprint(event.target.value)}
                />
              </label>
            </div>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Labels / Tags (Optional)</span>
              <input
                className="wpn-epicflow-modal__input"
                value={tagsInput}
                placeholder="Add tags (e.g. UI, AI, Mobile, etc.)"
                onChange={(event) => setTagsInput(event.target.value)}
              />
            </label>
          </div>

          <aside className="wpn-epicflow-modal__tips">
            <p className="wpn-epicflow-modal__tips-title">Writing a good user story</p>
            <ul className="wpn-epicflow-modal__tips-list">
              {TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <p className="wpn-epicflow-modal__tips-example-label">Example</p>
            <div className="wpn-epicflow-modal__tips-example">
              <span>
                As a customer, I want personalized product recommendations so that I can discover
                products that match my interests.
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
            Create Story
          </button>
        </div>
      </form>
    </div>
  );
}
