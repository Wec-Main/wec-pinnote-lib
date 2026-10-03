import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalAiRuntime } from "../../../context/AiRuntimeContext";
import { listAiActionTemplates } from "../../../services/aiApi";
import type { AiActionTemplate } from "../../../types/ai.types";
import { describeAiError } from "../aiHelpers";

export interface UsePromptTemplatesResult {
  templates: AiActionTemplate[];
  selected: AiActionTemplate | null;
  selectedKey: string | null;
  select: (actionKey: string) => void;
  replace: (template: AiActionTemplate) => void;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function usePromptTemplates(): UsePromptTemplatesResult {
  const runtime = useOptionalAiRuntime();
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const [templates, setTemplates] = useState<AiActionTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rt = runtimeRef.current;
    if (!rt) return;
    setLoading(true);
    setError(null);
    try {
      const token = await rt.getToken();
      const list = await listAiActionTemplates(rt.apiBaseUrl, token, rt.projectId);
      setTemplates(list);
      setSelectedKey((current) =>
        list.some((item) => item.actionKey === current) ? current : (list[0]?.actionKey ?? null),
      );
    } catch (err) {
      setError(describeAiError(err, "Could not load prompt templates"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const replace = useCallback((next: AiActionTemplate) => {
    setTemplates((current) =>
      current.map((item) => (item.actionKey === next.actionKey ? next : item)),
    );
  }, []);

  return {
    templates,
    selected: templates.find((item) => item.actionKey === selectedKey) ?? null,
    selectedKey,
    select: setSelectedKey,
    replace,
    loading,
    error,
    reload,
  };
}
