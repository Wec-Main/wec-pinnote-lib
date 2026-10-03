import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import { useAnnotationData } from "../../context/AnnotationContext";
import { useReferenceCandidates } from "../../hooks/useReferenceCandidates";
import {
  listAiActionTemplates,
  previewAiActionTemplate,
  resetAiActionTemplate,
  saveAiActionTemplate,
} from "../../services/aiApi";
import type {
  AiActionTarget,
  AiActionTemplate,
  AiActionTemplatePreview,
  AiProviderId,
} from "../../types/ai.types";
import { annotationLabel } from "../../utils/annotationLabel";
import { Icon, Spinner } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { AiActivity } from "./AiActivity";
import { describeAiError, resolveRoute, type AiRoute } from "./aiHelpers";
import { AiModelSwitcher } from "./AiModelSwitcher";
import {
  SYSTEM_PROMPT_LIMIT,
  TEMPLATE_EFFORTS,
  draftFromTemplate,
  draftToRequest,
  inputFieldOptions,
  insertAt,
  isDraftDirty,
  lineDiff,
  outputFormatOptions,
  parseSchema,
  targetKindFor,
  templatePlaceholders,
  validateDraft,
  type TemplateDraft,
} from "./promptTemplateLogic";
import { useAiAction } from "./useAiAction";
import { useAiDefaults } from "./useAiPreferences";

export interface TemplateTarget {
  kind: AiActionTarget["kind"];
  id: string;
  label: string;
}

const TARGET_KIND_LABELS: Record<AiActionTarget["kind"], string> = {
  data_model: "data model",
  flow: "flow",
  annotation: "comment thread",
  workspace: "workspace",
};

export function useTemplateTargets(): TemplateTarget[] {
  const { allAnnotations, config } = useAnnotationData();
  const references = useReferenceCandidates();
  const request = references.request;
  useEffect(() => {
    request();
  }, [request]);
  return useMemo(() => {
    const list: TemplateTarget[] = [
      { kind: "workspace", id: config.projectId, label: "This project's workspace" },
    ];
    for (const reference of references.references) {
      if (reference.kind === "dataModel") {
        list.push({ kind: "data_model", id: reference.id, label: reference.name });
      } else if (reference.kind === "flow") {
        list.push({ kind: "flow", id: reference.id, label: reference.name });
      }
    }
    for (const annotation of allAnnotations) {
      list.push({
        kind: "annotation",
        id: annotation.id,
        label: `#${annotation.number} · ${annotationLabel(annotation)}`,
      });
    }
    return list;
  }, [allAnnotations, config.projectId, references.references]);
}

export function PromptTemplatesPanel() {
  const targets = useTemplateTargets();
  return <PromptTemplatesView targets={targets} />;
}

export function PromptTemplatesView({ targets }: { targets: TemplateTarget[] }) {
  const runtime = useOptionalAiRuntime();
  const [templates, setTemplates] = useState<AiActionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  const load = useCallback(async (keep?: string | null) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    setLoading(true);
    setLoadError(null);
    try {
      const token = await rt.getToken();
      const list = await listAiActionTemplates(rt.apiBaseUrl, token, rt.projectId);
      setTemplates(list);
      setSelectedKey((current) => {
        const wanted = keep ?? current;
        return list.some((item) => item.actionKey === wanted)
          ? (wanted as string)
          : (list[0]?.actionKey ?? null);
      });
    } catch (err) {
      setLoadError(describeAiError(err, "Could not load prompt templates"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = templates.find((item) => item.actionKey === selectedKey) ?? null;

  const replaceTemplate = useCallback((next: AiActionTemplate) => {
    setTemplates((current) =>
      current.map((item) => (item.actionKey === next.actionKey ? next : item)),
    );
  }, []);

  if (loading && templates.length === 0) {
    return <Spinner label="Loading prompt templates" />;
  }
  if (loadError && templates.length === 0) {
    return (
      <div className="wpn-inline-error" role="alert">
        <span>{loadError}</span>
        <button type="button" className="wpn-btn wpn-btn--ghost" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="wpn-ai-prompts">
      <nav className="wpn-ai-prompts__list" aria-label="AI actions">
        <ul>
          {templates.map((template) => (
            <li key={template.actionKey}>
              <button
                type="button"
                className="wpn-ai-prompts__item"
                aria-current={template.actionKey === selectedKey ? "true" : undefined}
                onClick={() => setSelectedKey(template.actionKey)}
              >
                <span className="wpn-ai-prompts__item-name">
                  {template.name || template.actionKey}
                </span>
                <span className="wpn-ai-prompts__item-key">{template.actionKey}</span>
                <span
                  className={[
                    "wpn-ai-prompts__badge",
                    template.isDefault ? "" : "wpn-ai-prompts__badge--override",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {template.isDefault ? "Default" : "Overridden"}
                </span>
                {!template.enabled ? (
                  <span className="wpn-ai-prompts__badge wpn-ai-prompts__badge--off">Off</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {selected ? (
        <TemplateEditor
          key={selected.actionKey}
          template={selected}
          targets={targets}
          onSaved={replaceTemplate}
          onReset={replaceTemplate}
        />
      ) : (
        <p className="wpn-ai-muted">No AI actions are available.</p>
      )}
    </div>
  );
}

interface TemplateEditorProps {
  template: AiActionTemplate;
  targets: TemplateTarget[];
  onSaved: (template: AiActionTemplate) => void;
  onReset: (template: AiActionTemplate) => void;
}

function TemplateEditor({ template, targets, onSaved, onReset }: TemplateEditorProps) {
  const runtime = useOptionalAiRuntime();
  const [prefs] = useAiDefaults();
  const baseId = useId();
  const [draft, setDraft] = useState<TemplateDraft>(() => draftFromTemplate(template));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [preview, setPreview] = useState<AiActionTemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const targetKind = targetKindFor(template);
  const kindTargets = targets.filter((target) => target.kind === targetKind);
  const [targetId, setTargetId] = useState<string>("");
  const [testPrompt, setTestPrompt] = useState("");
  const test = useAiAction();
  const lastField = useRef<{
    field: "systemPrompt" | "userTemplate";
    el: HTMLTextAreaElement;
  } | null>(null);

  useEffect(() => {
    setDraft(draftFromTemplate(template));
  }, [template]);

  const errors = useMemo(() => validateDraft(draft, template), [draft, template]);
  const dirty = isDraftDirty(draft, template);
  const schemaCheck = draft.outputFormat === "json" ? parseSchema(draft.schemaText) : null;
  const fieldOptions = inputFieldOptions(template);
  const placeholders = templatePlaceholders(template);
  const formats = outputFormatOptions(template);
  const isImprove = template.actionKey === "comment.improve";
  const limits = draft.inputSpec.limits ?? {};
  const target = kindTargets.find((item) => item.id === targetId) ?? kindTargets[0] ?? null;
  const userChoice = draft.provider === null;
  const fallbackRoute = resolveRoute(runtime?.me ?? null, prefs);
  const switcherValue: AiRoute | null =
    draft.provider && draft.model
      ? { provider: draft.provider as AiProviderId, model: draft.model, effort: draft.effort }
      : fallbackRoute;

  const update = (patch: Partial<TemplateDraft>) => {
    setMessage(null);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const insertPlaceholder = (name: string) => {
    const token = `{{${name}}}`;
    const last = lastField.current;
    const field = last?.field ?? "userTemplate";
    const el = last?.el ?? null;
    const text = draft[field];
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const next = insertAt(text, start, end, token);
    update({ [field]: next.text } as Partial<TemplateDraft>);
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      });
    }
  };

  const withToken = async () => {
    const rt = runtime;
    if (!rt) throw new Error("AI is not available");
    return { rt, token: await rt.getToken() };
  };

  const save = async () => {
    if (errors.length > 0 || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const { rt, token } = await withToken();
      const saved = await saveAiActionTemplate(
        rt.apiBaseUrl,
        token,
        rt.projectId,
        template.actionKey,
        draftToRequest(draft),
      );
      onSaved(saved);
      setMessage({ tone: "ok", text: "Saved. New runs use this template." });
    } catch (err) {
      setMessage({ tone: "error", text: describeAiError(err, "Could not save the template") });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      const { rt, token } = await withToken();
      const next = await resetAiActionTemplate(
        rt.apiBaseUrl,
        token,
        rt.projectId,
        template.actionKey,
      );
      setConfirmReset(false);
      onReset(next);
    } catch (err) {
      setConfirmReset(false);
      setMessage({ tone: "error", text: describeAiError(err, "Could not reset the template") });
    } finally {
      setResetting(false);
    }
  };

  const testInputs = () => {
    const prompt = testPrompt.trim();
    return {
      ...(target ? { targetId: target.id } : {}),
      ...(prompt ? { prompt } : {}),
      ...(isImprove && prompt ? { inputs: { draft: prompt } } : {}),
    };
  };

  const renderPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const { rt, token } = await withToken();
      const result = await previewAiActionTemplate(
        rt.apiBaseUrl,
        token,
        rt.projectId,
        template.actionKey,
        { template: draftToRequest(draft), ...testInputs() },
      );
      setPreview(result);
    } catch (err) {
      setPreviewError(describeAiError(err, "Could not render the preview"));
    } finally {
      setPreviewing(false);
    }
  };

  const runTest = () => {
    void test.run(template.actionKey, {
      ...testInputs(),
      ...(fallbackRoute
        ? {
            provider: fallbackRoute.provider,
            model: fallbackRoute.model,
            effort: fallbackRoute.effort,
          }
        : {}),
    });
  };

  const defaults = template.defaults ?? null;
  const testRunning = test.state.status === "running";

  return (
    <section className="wpn-ai-prompts__editor" aria-labelledby={`${baseId}-title`}>
      <header className="wpn-ai-prompts__head">
        <div>
          <h3 id={`${baseId}-title`} className="wpn-ai-prompts__title">
            {template.name || template.actionKey}
          </h3>
          <p className="wpn-ai-muted">
            <code>{template.actionKey}</code> · {template.surface} · v{template.version}
            {template.description ? ` · ${template.description}` : ""}
          </p>
        </div>
        <label className="wpn-ai-prompts__toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          Enabled
        </label>
      </header>

      <div className="wpn-ai-prompts__palette" role="toolbar" aria-label="Insert placeholder">
        <span className="wpn-ai-muted">Insert</span>
        {placeholders.map((name) => (
          <button
            key={name}
            type="button"
            className="wpn-ai-prompts__token"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertPlaceholder(name)}
          >
            {`{{${name}}}`}
          </button>
        ))}
      </div>

      <label className="wpn-ai-prompts__field">
        <span className="wpn-ai-prompts__label">
          System prompt
          <span className="wpn-ai-prompts__count">
            {draft.systemPrompt.length.toLocaleString()} / {SYSTEM_PROMPT_LIMIT.toLocaleString()}
          </span>
        </span>
        <textarea
          className="wpn-ai-prompts__code"
          spellCheck={false}
          rows={12}
          value={draft.systemPrompt}
          onFocus={(event) => {
            lastField.current = { field: "systemPrompt", el: event.currentTarget };
          }}
          onChange={(event) => update({ systemPrompt: event.target.value })}
        />
      </label>

      <label className="wpn-ai-prompts__field">
        <span className="wpn-ai-prompts__label">User template</span>
        <textarea
          className="wpn-ai-prompts__code"
          spellCheck={false}
          rows={6}
          value={draft.userTemplate}
          onFocus={(event) => {
            lastField.current = { field: "userTemplate", el: event.currentTarget };
          }}
          onChange={(event) => update({ userTemplate: event.target.value })}
        />
      </label>

      {fieldOptions.length > 0 || Object.keys(limits).length > 0 ? (
        <fieldset className="wpn-ai-prompts__group">
          <legend>Input</legend>
          <div className="wpn-ai-prompts__checks">
            {fieldOptions.map((field) => (
              <label key={field} className="wpn-ai-prompts__check">
                <input
                  type="checkbox"
                  checked={draft.inputSpec.include.includes(field)}
                  onChange={(event) =>
                    update({
                      inputSpec: {
                        ...draft.inputSpec,
                        include: event.target.checked
                          ? [...draft.inputSpec.include, field]
                          : draft.inputSpec.include.filter((item) => item !== field),
                      },
                    })
                  }
                />
                {field}
              </label>
            ))}
          </div>
          {fieldOptions.length > 0 && draft.inputSpec.include.length === 0 ? (
            <p className="wpn-ai-muted wpn-ai-prompts__hint">
              Nothing ticked means every field is sent.
            </p>
          ) : null}
          {Object.keys(limits).length > 0 ? (
            <div className="wpn-ai-prompts__limits">
              {Object.entries(limits).map(([key, value]) =>
                typeof value === "boolean" ? (
                  <label key={key} className="wpn-ai-prompts__check">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        update({
                          inputSpec: {
                            ...draft.inputSpec,
                            limits: { ...limits, [key]: event.target.checked },
                          },
                        })
                      }
                    />
                    {key}
                  </label>
                ) : (
                  <label key={key} className="wpn-ai-prompts__limit">
                    <span>{key}</span>
                    <input
                      type="number"
                      min={0}
                      className="wpn-ai-prompts__number"
                      value={Number.isFinite(value) ? value : ""}
                      onChange={(event) =>
                        update({
                          inputSpec: {
                            ...draft.inputSpec,
                            limits: { ...limits, [key]: event.target.valueAsNumber },
                          },
                        })
                      }
                    />
                  </label>
                ),
              )}
            </div>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="wpn-ai-prompts__group">
        <legend>Output</legend>
        <div role="radiogroup" aria-label="Output format" className="wpn-ai-segmented">
          {formats.map((format) => (
            <button
              key={format.id}
              type="button"
              role="radio"
              aria-checked={draft.outputFormat === format.id}
              className="wpn-ai-segmented__item"
              onClick={() => update({ outputFormat: format.id })}
            >
              {format.label}
            </button>
          ))}
        </div>
        {draft.outputFormat === "json" ? (
          <label className="wpn-ai-prompts__field">
            <span className="wpn-ai-prompts__label">
              JSON schema
              {schemaCheck ? (
                <span
                  className={schemaCheck.ok ? "wpn-ai-prompts__valid" : "wpn-ai-prompts__invalid"}
                >
                  {schemaCheck.ok ? "Valid JSON" : "Invalid"}
                </span>
              ) : null}
            </span>
            <textarea
              className="wpn-ai-prompts__code"
              aria-label="JSON schema"
              aria-invalid={schemaCheck ? !schemaCheck.ok : undefined}
              spellCheck={false}
              rows={8}
              value={draft.schemaText}
              onChange={(event) => update({ schemaText: event.target.value })}
            />
            {schemaCheck && !schemaCheck.ok ? (
              <span className="wpn-ai-prompts__invalid" role="alert">
                {schemaCheck.error}
              </span>
            ) : null}
          </label>
        ) : null}
      </fieldset>

      <fieldset className="wpn-ai-prompts__group">
        <legend>Model</legend>
        <label className="wpn-ai-prompts__check">
          <input
            type="checkbox"
            checked={userChoice}
            onChange={(event) =>
              update(
                event.target.checked
                  ? { provider: null, model: null }
                  : {
                      provider: fallbackRoute?.provider ?? null,
                      model: fallbackRoute?.model ?? null,
                    },
              )
            }
          />
          Use each user's choice
        </label>
        {!userChoice ? (
          <AiModelSwitcher
            value={switcherValue}
            persist={false}
            placement="bottom"
            onChange={(next) =>
              update({
                provider: next.provider,
                model: next.model,
                effort:
                  next.effort && (TEMPLATE_EFFORTS as readonly string[]).includes(next.effort)
                    ? next.effort
                    : draft.effort,
              })
            }
          />
        ) : null}
        <div className="wpn-ai-prompts__limits">
          <label className="wpn-ai-prompts__limit">
            <span>Effort</span>
            <select
              className="wpn-ai-prompts__number"
              value={draft.effort ?? ""}
              onChange={(event) => update({ effort: event.target.value || null })}
            >
              <option value="">Default</option>
              {TEMPLATE_EFFORTS.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </label>
          <label className="wpn-ai-prompts__limit">
            <span>Max tokens</span>
            <input
              type="number"
              min={64}
              max={64000}
              placeholder="Default"
              className="wpn-ai-prompts__number"
              value={draft.maxTokens ?? ""}
              onChange={(event) =>
                update({
                  maxTokens: event.target.value === "" ? null : event.target.valueAsNumber,
                })
              }
            />
          </label>
        </div>
      </fieldset>

      {errors.length > 0 ? (
        <ul className="wpn-ai-prompts__errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p
          className={message.tone === "ok" ? "wpn-ai-prompts__ok" : "wpn-ai-card__warn"}
          role={message.tone === "ok" ? "status" : "alert"}
        >
          {message.text}
        </p>
      ) : null}

      <div className="wpn-ai-prompts__actions">
        <button
          type="button"
          className="wpn-btn wpn-btn--primary"
          disabled={!dirty || errors.length > 0 || saving}
          onClick={() => void save()}
        >
          {saving ? <Spinner /> : null}
          Save
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          disabled={!dirty || saving}
          onClick={() => {
            setDraft(draftFromTemplate(template));
            setMessage(null);
          }}
        >
          Revert edits
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          disabled={template.isDefault || resetting}
          onClick={() => setConfirmReset(true)}
        >
          <Icon name="reset" className="wpn-btn__icon" />
          Reset to default
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          aria-expanded={showDiff}
          disabled={!defaults}
          onClick={() => setShowDiff((value) => !value)}
        >
          {showDiff ? "Hide diff" : "Diff vs default"}
        </button>
      </div>

      {showDiff && defaults ? (
        <div className="wpn-ai-prompts__diffs">
          <DiffView
            title="System prompt"
            before={defaults.systemPrompt ?? ""}
            after={draft.systemPrompt}
          />
          <DiffView
            title="User template"
            before={defaults.userTemplate ?? ""}
            after={draft.userTemplate}
          />
        </div>
      ) : null}

      <fieldset className="wpn-ai-prompts__group wpn-ai-prompts__test">
        <legend>Try it</legend>
        <div className="wpn-ai-prompts__limits">
          {targetKind ? (
            <label className="wpn-ai-prompts__limit">
              <span>Target {TARGET_KIND_LABELS[targetKind]}</span>
              <select
                className="wpn-ai-prompts__number"
                value={target?.id ?? ""}
                onChange={(event) => setTargetId(event.target.value)}
              >
                {kindTargets.length === 0 ? (
                  <option value="">No {TARGET_KIND_LABELS[targetKind]}s found</option>
                ) : null}
                {kindTargets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="wpn-ai-prompts__limit wpn-ai-prompts__limit--grow">
            <span>{isImprove ? "Draft text" : "Prompt"}</span>
            <input
              className="wpn-ai-prompts__number"
              value={testPrompt}
              onChange={(event) => setTestPrompt(event.target.value)}
            />
          </label>
        </div>
        <div className="wpn-ai-prompts__actions">
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            disabled={previewing}
            onClick={() => void renderPreview()}
          >
            {previewing ? <Spinner /> : <Icon name="eye" className="wpn-btn__icon" />}
            Render preview (with edits)
          </button>
          {!template.runnable ? null : testRunning ? (
            <button type="button" className="wpn-btn wpn-btn--ghost" onClick={test.stop}>
              <Icon name="stop" className="wpn-btn__icon" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="wpn-btn wpn-btn--ghost"
              disabled={Boolean(targetKind) && !target}
              onClick={runTest}
            >
              <Icon name="sparkles" className="wpn-btn__icon" />
              Test run (saved version)
            </button>
          )}
        </div>
        {template.runnable ? (
          <p className="wpn-ai-muted wpn-ai-prompts__hint">
            The preview renders your current edits without calling the AI. Test runs call the AI
            with the <strong>saved</strong> template
            {dirty ? " — save your edits first to test them" : ""}.
          </p>
        ) : (
          <p className="wpn-ai-muted wpn-ai-prompts__hint">
            The preview renders your current edits without calling the AI. This prompt is used by
            chat, so it cannot be test run here.
          </p>
        )}
        {previewError ? (
          <p className="wpn-ai-card__warn" role="alert">
            {previewError}
          </p>
        ) : null}
        {preview && preview.errors.length > 0 ? (
          <ul className="wpn-ai-prompts__errors" role="alert" aria-label="Preview problems">
            {preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {preview ? (
          <div className="wpn-ai-prompts__preview">
            <span className="wpn-ai-prompts__label">Rendered system prompt</span>
            <pre className="wpn-ai-prompts__pre">{preview.systemPrompt}</pre>
            <span className="wpn-ai-prompts__label">Rendered user message</span>
            <pre className="wpn-ai-prompts__pre">{preview.userPrompt}</pre>
          </div>
        ) : null}
        {test.state.status !== "idle" ? <AiActivity state={test.state} hideText /> : null}
        {test.state.status === "done" && test.state.result?.kind === "json" ? (
          <pre className="wpn-ai-prompts__pre">
            {JSON.stringify(test.state.result.value, null, 2)}
          </pre>
        ) : null}
        {test.state.status === "done" && test.state.result?.kind === "op_batch" ? (
          <pre className="wpn-ai-prompts__pre">
            {JSON.stringify(test.state.result.batch.ops, null, 2)}
          </pre>
        ) : null}
      </fieldset>

      {confirmReset ? (
        <ConfirmDialog
          title="Reset to the default prompt?"
          description="Your organisation's override for this action will be deleted and the global default will be used again. This cannot be undone."
          confirmLabel="Reset to default"
          destructive
          busy={resetting}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => void reset()}
        />
      ) : null}
    </section>
  );
}

function DiffView({ title, before, after }: { title: string; before: string; after: string }) {
  const lines = useMemo(() => lineDiff(before, after), [after, before]);
  const changed = lines.some((line) => line.kind !== "same");
  return (
    <div className="wpn-ai-prompts__diff">
      <span className="wpn-ai-prompts__label">{title}</span>
      {changed ? (
        <pre className="wpn-ai-prompts__pre">
          {lines.map((line, index) => (
            <div
              key={index}
              className={`wpn-ai-prompts__diff-line wpn-ai-prompts__diff-line--${line.kind}`}
            >
              <span aria-hidden="true">
                {line.kind === "add" ? "+ " : line.kind === "remove" ? "- " : "  "}
              </span>
              <span className="wpn-sr-only">
                {line.kind === "add" ? "Added: " : line.kind === "remove" ? "Removed: " : ""}
              </span>
              {line.text}
            </div>
          ))}
        </pre>
      ) : (
        <p className="wpn-ai-muted">Same as default.</p>
      )}
    </div>
  );
}
