import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../../components/primitives/Icon";
import { SearchableSelect } from "../../../../components/primitives/SearchableSelect";
import { Spinner } from "../../../../components/primitives/Spinner";
import { ConfirmDialog } from "../../../userManagement/components/ConfirmDialog";
import type { AiActionTemplate } from "../../../../types/ai.types";
import { AiActivity } from "../AiActivity";
import { useTemplateTargets, type TemplateTarget } from "../PromptTemplatesPanel";
import { SYSTEM_PROMPT_LIMIT, templatePlaceholders } from "../promptTemplateLogic";
import { PromptModelPicker } from "./PromptModelPicker";
import { PromptSection } from "./PromptSection";
import { humanize, samplesFor } from "./promptSamples";
import { usePromptTemplateEditor } from "./usePromptTemplateEditor";
import { usePromptTemplates } from "./usePromptTemplates";

const SURFACE_LABELS: Record<string, string> = {
  workspace: "Workspace",
  data_model: "Data model",
  flow: "Flow",
};

const SURFACE_ORDER = Object.keys(SURFACE_LABELS);

const TARGET_LABELS = {
  data_model: "data model",
  flow: "flow",
  annotation: "comment thread",
  workspace: "workspace",
} as const;

const surfaceLabel = (surface: string) => SURFACE_LABELS[surface] ?? surface;

function PromptsSkeleton() {
  return (
    <div className="wpn-pw" role="status" aria-label="Loading prompts" aria-busy="true">
      <div className="wpn-pw-sk-row">
        {[64, 88, 96, 84, 70].map((width, index) => (
          <span key={index} className="wpn-skeleton wpn-pw-sk-pill" style={{ width }} />
        ))}
      </div>
      <div className="wpn-pw-sk-row">
        {[150, 170, 140, 160, 130, 150].map((width, index) => (
          <span key={index} className="wpn-skeleton wpn-pw-sk-chip" style={{ width }} />
        ))}
      </div>
      {[0, 1].map((index) => (
        <div key={index} className="wpn-pw-section">
          <div className="wpn-pw-section__head">
            <span className="wpn-skeleton wpn-pw-sk-title" />
            <span className="wpn-skeleton wpn-pw-sk-btn" />
          </div>
          <div className="wpn-pw-section__body">
            <span className="wpn-skeleton wpn-pw-sk-line" style={{ width: "28%" }} />
            <span className="wpn-skeleton wpn-pw-sk-block" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PromptsWorkbench() {
  const targets = useTemplateTargets();
  return <PromptsWorkbenchView targets={targets} />;
}

export function PromptsWorkbenchView({ targets }: { targets: TemplateTarget[] }) {
  const store = usePromptTemplates();
  const [chosenSurface, setSurface] = useState(SURFACE_ORDER[0] as string);

  const surfaces = useMemo(
    () =>
      SURFACE_ORDER.filter((value) =>
        store.templates.some((template) => template.surface === value),
      ),
    [store.templates],
  );
  const surface = surfaces.includes(chosenSurface) ? chosenSurface : (surfaces[0] ?? "");
  const visible = store.templates.filter((template) => template.surface === surface);
  const firstVisible = visible[0]?.actionKey;
  const selectedVisible = visible.some((template) => template.actionKey === store.selectedKey);
  const { select } = store;

  useEffect(() => {
    if (firstVisible && !selectedVisible) select(firstVisible);
  }, [firstVisible, select, selectedVisible]);

  if (store.loading && store.templates.length === 0) {
    return <PromptsSkeleton />;
  }
  if (store.error && store.templates.length === 0) {
    return (
      <div className="wpn-inline-error" role="alert">
        <span>{store.error}</span>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={() => void store.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="wpn-pw">
      <header className="wpn-pw-intro">
        <h2 className="wpn-pw-intro__title">Prompts</h2>
        <p className="wpn-ai-muted">
          Choose an AI feature below and change how it behaves. Anything you don't change keeps the
          built-in default.
        </p>
      </header>

      <div className="wpn-pw-picker">
        <div className="wpn-pw-picker__surfaces" role="tablist" aria-label="Filter by area">
          {surfaces.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={surface === value}
              className="wpn-pw-pill"
              onClick={() => setSurface(value)}
            >
              {surfaceLabel(value)}
            </button>
          ))}
        </div>
        <ul className="wpn-pw-picker__actions" aria-label="AI actions">
          {visible.map((template) => (
            <li key={template.actionKey}>
              <button
                type="button"
                className="wpn-pw-action"
                aria-current={template.actionKey === store.selectedKey ? "true" : undefined}
                data-off={!template.enabled || undefined}
                onClick={() => store.select(template.actionKey)}
              >
                <span
                  className={[
                    "wpn-pw-dot",
                    template.isDefault ? "" : "wpn-pw-dot--custom",
                    template.enabled ? "" : "wpn-pw-dot--off",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                />
                <span className="wpn-pw-action__name">{template.name || template.actionKey}</span>
                <span className="wpn-sr-only">
                  {template.isDefault ? "Default" : "Customised"}
                  {template.enabled ? "" : ", off"}
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 ? <li className="wpn-ai-muted">No actions in this area.</li> : null}
        </ul>
      </div>

      {store.selected ? (
        <TemplateWorkbench
          key={store.selected.actionKey}
          template={store.selected}
          targets={targets}
          onSaved={store.replace}
        />
      ) : (
        <p className="wpn-ai-muted">No AI actions are available.</p>
      )}
    </div>
  );
}

interface TemplateWorkbenchProps {
  template: AiActionTemplate;
  targets: TemplateTarget[];
  onSaved: (template: AiActionTemplate) => void;
}

type PendingAction = "save" | "discard" | "reset";

function TemplateWorkbench({ template, targets, onSaved }: TemplateWorkbenchProps) {
  const editor = usePromptTemplateEditor({ template, targets, onSaved });
  const { draft, update, errors } = editor;
  const [pending, setPending] = useState<PendingAction | null>(null);

  const variables = templatePlaceholders(template);
  const samples = samplesFor(template);
  const testRunning = editor.test.state.status === "running";
  const targetOptions = useMemo(
    () => editor.kindTargets.map((item) => ({ value: item.id, label: item.label })),
    [editor.kindTargets],
  );
  const name = template.name || humanize(template.actionKey);
  const canSave = editor.dirty && errors.length === 0 && !editor.saving;
  const testBlocked = !template.runnable
    ? "This prompt is used by chat and can't be run on its own. Use Preview to check it."
    : errors.length > 0
      ? "Fix the problems above to run a test."
      : editor.targetKind && !editor.target
        ? `Add a ${TARGET_LABELS[editor.targetKind]} to this project to test with.`
        : null;

  const confirm = async () => {
    const action = pending;
    if (action === "save") await editor.save();
    if (action === "discard") editor.discard();
    if (action === "reset") await editor.reset();
    setPending(null);
  };

  const dialogCopy: Record<PendingAction, { title: string; description: string; label: string }> = {
    save: {
      title: `Save changes to "${name}"?`,
      description: "From now on, everyone in your organisation uses this prompt.",
      label: "Save changes",
    },
    discard: {
      title: "Discard your changes?",
      description: "Your unsaved edits to this prompt will be lost.",
      label: "Discard changes",
    },
    reset: {
      title: "Reset to the default prompt?",
      description:
        "Your organisation's changes to this prompt will be deleted and the built-in default will be used again. This cannot be undone.",
      label: "Reset to default",
    },
  };

  const instructionActions = (
    <>
      {editor.dirty ? (
        <span className="wpn-pw-status wpn-pw-status--dirty">Unsaved changes</span>
      ) : null}
      {template.isDefault ? null : (
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          disabled={editor.resetting}
          onClick={() => setPending("reset")}
        >
          <Icon name="reset" className="wpn-btn__icon" />
          Reset to default
        </button>
      )}
      <button
        type="button"
        className="wpn-btn wpn-btn--ghost"
        disabled={!editor.dirty || editor.saving}
        onClick={() => setPending("discard")}
      >
        <Icon name="close" className="wpn-btn__icon" />
        Cancel
      </button>
      <button
        type="button"
        className="wpn-btn wpn-btn--primary"
        disabled={!canSave}
        onClick={() => setPending("save")}
      >
        {editor.saving ? <Spinner /> : <Icon name="save" className="wpn-btn__icon" />}
        Save
      </button>
    </>
  );

  return (
    <div className="wpn-pw-editor">
      <PromptSection title="Instructions" actions={instructionActions} defaultOpen>
        {errors.length > 0 ? (
          <ul className="wpn-pw-alert wpn-pw-alert--error" role="alert">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {editor.message ? (
          <p
            className={`wpn-pw-alert wpn-pw-alert--${editor.message.tone}`}
            role={editor.message.tone === "ok" ? "status" : "alert"}
          >
            {editor.message.text}
          </p>
        ) : null}
        {variables.length > 0 ? (
          <div className="wpn-pw-palette" role="toolbar" aria-label="Insert a variable">
            <span className="wpn-ai-muted">Insert variable</span>
            {variables.map((variable) => (
              <button
                key={variable}
                type="button"
                className="wpn-pw-token"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.insertPlaceholder(variable)}
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        ) : null}
        <label className="wpn-pw-field">
          <span className="wpn-pw-label">
            Prompt
            <span className="wpn-pw-count">
              {draft.systemPrompt.length.toLocaleString()} / {SYSTEM_PROMPT_LIMIT.toLocaleString()}
            </span>
          </span>
          <textarea
            className="wpn-pw-code"
            spellCheck={false}
            rows={16}
            value={draft.systemPrompt}
            onFocus={(event) => editor.trackField("systemPrompt", event.currentTarget)}
            onChange={(event) => update({ systemPrompt: event.target.value })}
          />
        </label>
      </PromptSection>

      <PromptSection title="AI model" defaultOpen>
        <PromptModelPicker
          actionKey={template.actionKey}
          provider={draft.provider}
          model={draft.model}
          effort={draft.effort}
          onChange={update}
        />
      </PromptSection>

      <PromptSection title="Try it out" defaultOpen>
        {editor.targetKind ? (
          <div className="wpn-pw-field">
            <span className="wpn-pw-label">Test on</span>
            <SearchableSelect
              options={targetOptions}
              value={editor.target?.id ?? ""}
              onChange={editor.setTargetId}
              ariaLabel={`Test on ${TARGET_LABELS[editor.targetKind]}`}
              placeholder={`Choose a ${TARGET_LABELS[editor.targetKind]}`}
              searchPlaceholder={`Search ${TARGET_LABELS[editor.targetKind]}s`}
              emptyMessage={`No ${TARGET_LABELS[editor.targetKind]}s in this project yet.`}
            />
          </div>
        ) : null}
        <div className="wpn-pw-field">
          <span className="wpn-pw-label">
            Test message
            {samples.length > 0 ? (
              <span className="wpn-pw-samples">
                <span className="wpn-ai-muted">Sample:</span>
                {samples.map((sample, index) => (
                  <button
                    key={sample}
                    type="button"
                    className="wpn-pw-token"
                    title={sample}
                    onClick={() => editor.setTestPrompt(sample)}
                  >
                    {samples.length === 1 ? "Fill in" : `Example ${index + 1}`}
                  </button>
                ))}
              </span>
            ) : null}
          </span>
          <textarea
            className="wpn-pw-input wpn-pw-input--area"
            rows={3}
            placeholder="Type something to test with, or use a sample"
            value={editor.testPrompt}
            onChange={(event) => editor.setTestPrompt(event.target.value)}
          />
        </div>
        <div className="wpn-pw-row">
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            disabled={editor.previewing}
            onClick={() => void editor.renderPreview()}
          >
            {editor.previewing ? <Spinner /> : <Icon name="eye" className="wpn-btn__icon" />}
            Preview what the AI receives
          </button>
          {testRunning ? (
            <button type="button" className="wpn-btn wpn-btn--primary" onClick={editor.test.stop}>
              <Icon name="stop" className="wpn-btn__icon" />
              Stop test
            </button>
          ) : (
            <button
              type="button"
              className="wpn-btn wpn-btn--primary"
              disabled={Boolean(testBlocked)}
              title={testBlocked ?? undefined}
              onClick={editor.runTest}
            >
              <Icon name="sparkles" className="wpn-btn__icon" />
              Test with sample data
            </button>
          )}
        </div>
        {testBlocked && !testRunning ? (
          <p className="wpn-pw-note" role="note">
            {testBlocked}
          </p>
        ) : null}
        {editor.previewError ? (
          <p className="wpn-pw-alert wpn-pw-alert--error" role="alert">
            {editor.previewError}
          </p>
        ) : null}
        {editor.preview && editor.preview.errors.length > 0 ? (
          <ul
            className="wpn-pw-alert wpn-pw-alert--error"
            role="alert"
            aria-label="Preview problems"
          >
            {editor.preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {editor.test.state.status !== "idle" ? (
          <div className="wpn-pw-result">
            <span className="wpn-pw-label">AI response</span>
            <AiActivity state={editor.test.state} hideText />
            {editor.test.state.status === "done" && editor.test.state.result?.kind === "json" ? (
              <pre className="wpn-pw-pre">
                {JSON.stringify(editor.test.state.result.value, null, 2)}
              </pre>
            ) : null}
            {editor.test.state.status === "done" &&
            editor.test.state.result?.kind === "op_batch" ? (
              <pre className="wpn-pw-pre">
                {JSON.stringify(editor.test.state.result.batch.ops, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
        {editor.preview ? (
          <details className="wpn-pw-details">
            <summary>What the AI receives</summary>
            <span className="wpn-pw-label">Instructions</span>
            <pre className="wpn-pw-pre">{editor.preview.systemPrompt}</pre>
            <span className="wpn-pw-label">Message</span>
            <pre className="wpn-pw-pre">{editor.preview.userPrompt}</pre>
          </details>
        ) : null}
      </PromptSection>

      {pending ? (
        <ConfirmDialog
          title={dialogCopy[pending].title}
          description={dialogCopy[pending].description}
          confirmLabel={dialogCopy[pending].label}
          destructive={pending !== "save"}
          busy={editor.saving || editor.resetting}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirm()}
        />
      ) : null}
    </div>
  );
}
