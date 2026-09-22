import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Icon } from "../primitives";
import type { Epic, EpicNote } from "../../types/epicFlow.types";

const TITLE_MAX = 150;
const CONTENT_MAX = 2000;

const TIPS = [
  "Capture key ideas and insights",
  "Link to relevant user stories or designs",
  "Keep it clear and actionable",
  "Use tags to organize notes",
  "Convert to a user story later (if relevant)",
];

interface CreateEpicNoteModalProps {
  epic: Epic;
  createdBy: string;
  onClose: () => void;
  onCreate: (note: Omit<EpicNote, "id" | "epicId" | "createdAt" | "updatedAt">) => void;
}

export function CreateEpicNoteModal({
  epic,
  createdBy,
  onClose,
  onCreate,
}: CreateEpicNoteModalProps) {
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [contentText, setContentText] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const hadContentRef = useRef(false);

  const syncContent = () => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    setContentHtml(el.innerHTML);
    setContentText(el.textContent ?? "");
  };

  // Only formats an existing text selection. A collapsed cursor is a no-op:
  // toggling "typing style" on an empty caret is what makes Chromium
  // auto-wrap the next-typed character(s) in <b>/<i>/<u> (see onContentInput).
  const applyFormat = (command: "bold" | "italic" | "underline") => {
    const editor = contentRef.current;
    if (!editor) {
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.getRangeAt(0).collapsed) {
      return;
    }
    editor.focus();
    document.execCommand(command);
    syncContent();
  };

  const onContentPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    syncContent();
  };

  const onContentInput = () => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const wasEmpty = !hadContentRef.current;
    hadContentRef.current = (el.textContent?.length ?? 0) > 0;

    // Chromium can auto-wrap the very first character typed into a
    // completely empty note field in <b>, with no formatting requested.
    // Undo that; applyFormat never sets typing style on a collapsed
    // selection, so any wrap seen here is always this browser quirk.
    const first = el.firstChild;
    if (
      wasEmpty &&
      el.childNodes.length === 1 &&
      first?.nodeType === Node.ELEMENT_NODE &&
      (first as HTMLElement).tagName === "B"
    ) {
      const text = el.textContent ?? "";
      el.textContent = text;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    syncContent();
  };

  const trimmedTitle = title.trim();
  const trimmedContent = contentText.trim();
  const canSubmit = Boolean(trimmedTitle) && Boolean(trimmedContent);

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
      content: contentHtml.trim(),
      createdBy,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" onClick={onClose}>
      <form
        className="wpn-epicflow-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <div>
            <h2 className="wpn-epicflow-modal__title">Create Epic Note</h2>
            <p className="wpn-epicflow-modal__subtitle">
              Add a note to capture ideas, discussion points, or important context for this epic.
            </p>
          </div>
          <button
            type="button"
            className="wpn-icon-btn"
            aria-label="Close create epic note"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="wpn-epicflow-modal__body">
          <div className="wpn-epicflow-modal__fields">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Epic</span>
              <div className="wpn-epicflow-modal__readonly">{epic.title}</div>
            </div>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Note Title <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={title}
                maxLength={TITLE_MAX}
                placeholder="e.g. Go big (or go home)."
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
              <span className="wpn-epicflow-modal__counter">
                {title.length}/{TITLE_MAX}
              </span>
            </label>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Note Content <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <div className="wpn-epicflow-modal__format-toolbar">
                <button
                  type="button"
                  className="wpn-epicflow-modal__format-btn wpn-epicflow-modal__format-btn--bold"
                  aria-label="Bold"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("bold")}
                >
                  B
                </button>
                <button
                  type="button"
                  className="wpn-epicflow-modal__format-btn wpn-epicflow-modal__format-btn--italic"
                  aria-label="Italic"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("italic")}
                >
                  I
                </button>
                <button
                  type="button"
                  className="wpn-epicflow-modal__format-btn wpn-epicflow-modal__format-btn--underline"
                  aria-label="Underline"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("underline")}
                >
                  U
                </button>
              </div>
              <div
                ref={contentRef}
                className="wpn-epicflow-modal__input wpn-epicflow-modal__textarea wpn-epicflow-modal__textarea--tall wpn-epicflow-modal__richtext"
                contentEditable
                role="textbox"
                aria-multiline="true"
                aria-label="Note Content"
                data-placeholder="Write your note, ideas, or thoughts..."
                onInput={onContentInput}
                onPaste={onContentPaste}
                suppressContentEditableWarning
              />
              <span className="wpn-epicflow-modal__counter">
                {contentText.length}/{CONTENT_MAX}
              </span>
            </label>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Tags (Optional)</span>
              <input
                className="wpn-epicflow-modal__input"
                value={tagsInput}
                placeholder="Add tags (e.g. UI, Research, Idea)"
                onChange={(event) => setTagsInput(event.target.value)}
              />
            </label>
          </div>

          <aside className="wpn-epicflow-modal__tips">
            <p className="wpn-epicflow-modal__tips-title">Tips for effective notes</p>
            <ul className="wpn-epicflow-modal__tips-list">
              {TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <p className="wpn-epicflow-modal__tips-example-label">Example</p>
            <div className="wpn-epicflow-modal__tips-example">
              <strong>Go big (or go home).</strong>
              <span>
                Think bold, differentiated experiences that make shopping feel magical.
              </span>
              <span className="wpn-epicflow-modal__tips-example-tag">Strategy</span>
            </div>
          </aside>
        </div>

        <div className="wpn-epicflow-modal__footer">
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="wpn-btn wpn-btn--primary" disabled={!canSubmit}>
            Create Note
          </button>
        </div>
      </form>
    </div>
  );
}
