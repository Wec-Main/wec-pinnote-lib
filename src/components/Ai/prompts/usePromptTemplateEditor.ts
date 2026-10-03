import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOptionalAiRuntime } from "../../../context/AiRuntimeContext";
import {
  listAiActionTemplates,
  previewAiActionTemplate,
  resetAiActionTemplate,
  saveAiActionTemplate,
} from "../../../services/aiApi";
import type {
  AiActionTemplate,
  AiActionTemplatePreview,
  AiProviderId,
} from "../../../types/ai.types";
import {
  aiErrorCode,
  aiErrorText,
  describeAiError,
  resolveRoute,
  type AiRoute,
} from "../aiHelpers";
import {
  TEMPLATE_EFFORTS,
  draftFromTemplate,
  draftToRequest,
  insertAt,
  isDraftDirty,
  parseSchema,
  targetKindFor,
  validateDraft,
  type TemplateDraft,
} from "../promptTemplateLogic";
import { useAiAction } from "../useAiAction";
import { samplesFor } from "./promptSamples";
import { useAiDefaults } from "../useAiPreferences";
import type { TemplateTarget } from "../PromptTemplatesPanel";

export type PromptField = "systemPrompt" | "userTemplate";

export interface EditorMessage {
  tone: "ok" | "error";
  text: string;
}

interface UsePromptTemplateEditorOptions {
  template: AiActionTemplate;
  targets: TemplateTarget[];
  onSaved: (template: AiActionTemplate) => void;
}

export function usePromptTemplateEditor({
  template,
  targets,
  onSaved,
}: UsePromptTemplateEditorOptions) {
  const runtime = useOptionalAiRuntime();
  const [prefs] = useAiDefaults();
  const test = useAiAction();
  const [draft, setDraft] = useState<TemplateDraft>(() => draftFromTemplate(template));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<EditorMessage | null>(null);
  const [preview, setPreview] = useState<AiActionTemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [testPrompt, setTestPrompt] = useState(() => samplesFor(template)[0] ?? "");
  const lastField = useRef<{ field: PromptField; el: HTMLTextAreaElement } | null>(null);

  useEffect(() => {
    setDraft(draftFromTemplate(template));
  }, [template]);

  const targetKind = targetKindFor(template);
  const kindTargets = useMemo(
    () => targets.filter((item) => item.kind === targetKind),
    [targetKind, targets],
  );
  const target = kindTargets.find((item) => item.id === targetId) ?? kindTargets[0] ?? null;
  const errors = useMemo(() => validateDraft(draft, template), [draft, template]);
  const dirty = isDraftDirty(draft, template);
  const schemaCheck = draft.outputFormat === "json" ? parseSchema(draft.schemaText) : null;
  const fallbackRoute = resolveRoute(runtime?.me ?? null, prefs);
  const userChoice = draft.provider === null;
  const switcherValue: AiRoute | null =
    draft.provider && draft.model
      ? { provider: draft.provider as AiProviderId, model: draft.model, effort: draft.effort }
      : fallbackRoute;
  const isImprove = template.actionKey === "comment.improve";

  const update = useCallback((patch: Partial<TemplateDraft>) => {
    setMessage(null);
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const trackField = useCallback((field: PromptField, el: HTMLTextAreaElement) => {
    lastField.current = { field, el };
  }, []);

  const insertPlaceholder = (name: string) => {
    const last = lastField.current;
    const field = last?.field ?? "systemPrompt";
    const el = last?.el ?? null;
    const text = draft[field];
    const next = insertAt(
      text,
      el ? el.selectionStart : text.length,
      el ? el.selectionEnd : text.length,
      `{{${name}}}`,
    );
    update({ [field]: next.text } as Partial<TemplateDraft>);
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      });
    }
  };

  const withToken = async () => {
    if (!runtime) throw new Error("AI is not available");
    return { rt: runtime, token: await runtime.getToken() };
  };

  const reloadAfterConflict = async () => {
    const text = aiErrorText("template_conflict", "This prompt was changed by someone else.");
    try {
      const { rt, token } = await withToken();
      const fresh = (await listAiActionTemplates(rt.apiBaseUrl, token, rt.projectId)).find(
        (item) => item.actionKey === template.actionKey,
      );
      if (fresh) onSaved(fresh);
    } catch {
      setMessage({ tone: "error", text });
      return;
    }
    setMessage({ tone: "error", text });
  };

  const save = async (): Promise<boolean> => {
    if (errors.length > 0 || saving) return false;
    setSaving(true);
    setMessage(null);
    try {
      const { rt, token } = await withToken();
      const saved = await saveAiActionTemplate(
        rt.apiBaseUrl,
        token,
        rt.projectId,
        template.actionKey,
        { ...draftToRequest(draft), expectedVersion: template.version },
      );
      onSaved(saved);
      setMessage({ tone: "ok", text: "Saved. New runs use this template." });
      return true;
    } catch (err) {
      if (aiErrorCode(err) === "template_conflict") {
        await reloadAfterConflict();
        return false;
      }
      setMessage({ tone: "error", text: describeAiError(err, "Could not save the template") });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraft(draftFromTemplate(template));
    setMessage(null);
  };

  const reset = async () => {
    setResetting(true);
    try {
      const { rt, token } = await withToken();
      onSaved(await resetAiActionTemplate(rt.apiBaseUrl, token, rt.projectId, template.actionKey));
    } catch (err) {
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
      setPreview(
        await previewAiActionTemplate(rt.apiBaseUrl, token, rt.projectId, template.actionKey, {
          template: draftToRequest(draft),
          ...testInputs(),
        }),
      );
    } catch (err) {
      setPreviewError(describeAiError(err, "Could not render the preview"));
    } finally {
      setPreviewing(false);
    }
  };

  const runTest = () => {
    void test.run(template.actionKey, {
      ...testInputs(),
      template: draftToRequest(draft),
      ...(userChoice && fallbackRoute
        ? {
            provider: fallbackRoute.provider,
            model: fallbackRoute.model,
            effort: fallbackRoute.effort,
          }
        : {}),
    });
  };

  const chooseRoute = (next: AiRoute) =>
    update({
      provider: next.provider,
      model: next.model,
      effort:
        next.effort && (TEMPLATE_EFFORTS as readonly string[]).includes(next.effort)
          ? next.effort
          : draft.effort,
    });

  const clearRoute = () => update({ provider: null, model: null, effort: null });

  return {
    draft,
    update,
    errors,
    dirty,
    schemaCheck,
    message,
    saving,
    resetting,
    save,
    discard,
    reset,
    trackField,
    insertPlaceholder,
    userChoice,
    switcherValue,
    chooseRoute,
    clearRoute,
    targetKind,
    kindTargets,
    target,
    setTargetId,
    testPrompt,
    setTestPrompt,
    isImprove,
    preview,
    previewing,
    previewError,
    renderPreview,
    test,
    runTest,
  };
}
