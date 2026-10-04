import { useMemo } from "react";
import { AI_EFFORTS } from "../../modelValidation";
import { useOptionalAiRuntime } from "../../AiRuntimeContext";
import type { AiProviderId } from "../../../../types/ai.types";
import { Icon } from "../../../../components/primitives/Icon";
import {
  SearchableSelect,
  type SelectOption,
} from "../../../../components/primitives/SearchableSelect";
import { Tooltip } from "../../../../components/primitives/Tooltip";
import { providerLabel } from "../aiHelpers";
import { TIER_LABELS, buildProviderCatalogs, pickRecommended } from "./modelCatalog";
import { EFFORT_DETAILS, recommendationFor, type PromptEffort } from "./promptRecommendations";

interface PromptModelPickerProps {
  actionKey: string;
  provider: string | null;
  model: string | null;
  effort: string | null;
  onChange: (patch: {
    provider?: AiProviderId | null;
    model?: string | null;
    effort?: string | null;
  }) => void;
}

const EFFORTS: PromptEffort[] = AI_EFFORTS.filter((value) => value !== "default");
const SENDERS_CHOICE = "";

export function PromptModelPicker({
  actionKey,
  provider,
  model,
  effort,
  onChange,
}: PromptModelPickerProps) {
  const runtime = useOptionalAiRuntime();
  const catalogs = useMemo(() => buildProviderCatalogs(runtime?.me ?? null), [runtime?.me]);
  const recommendation = recommendationFor(actionKey);
  const active = catalogs.find((item) => item.provider === provider);
  const recommendedModel = pickRecommended(active, recommendation.tier);

  const providerOptions: SelectOption[] = [
    { value: SENDERS_CHOICE, label: "Sender's choice" },
    ...catalogs.map((item) => ({
      value: item.provider,
      label: providerLabel(item.provider),
      description: item.connected ? "Connected" : "Not connected",
    })),
  ];

  const modelOptions: SelectOption[] = (active?.families ?? []).flatMap((family) =>
    family.models.map((item) => ({
      value: item.id,
      label: item.label,
      group: family.family,
      description: `${TIER_LABELS[item.tier]}${recommendedModel?.id === item.id ? " · Recommended" : ""}`,
    })),
  );

  const effortOptions: SelectOption[] = [
    { value: "", label: "Default" },
    ...EFFORTS.map((value) => ({
      value,
      label: EFFORT_DETAILS[value].label,
      description: recommendation.effort === value ? "Recommended" : EFFORT_DETAILS[value].hint,
    })),
  ];

  const chooseProvider = (next: string) => {
    if (next === SENDERS_CHOICE) {
      onChange({ provider: null, model: null });
      return;
    }
    const catalog = catalogs.find((item) => item.provider === next);
    onChange({
      provider: next as AiProviderId,
      model: pickRecommended(catalog, recommendation.tier)?.id ?? null,
    });
  };

  const applyRecommendation = () => {
    const target = active ?? catalogs.find((item) => item.connected) ?? catalogs[0];
    onChange({
      provider: target?.provider ?? null,
      model: pickRecommended(target, recommendation.tier)?.id ?? null,
      effort: recommendation.effort,
    });
  };

  return (
    <div className="wpn-pm">
      <div className="wpn-pm__row">
        <div className="wpn-pw-field">
          <span className="wpn-pw-label">Provider</span>
          <SearchableSelect
            options={providerOptions}
            value={provider ?? SENDERS_CHOICE}
            onChange={chooseProvider}
            ariaLabel="Provider"
            searchable={false}
          />
        </div>
        <div className="wpn-pw-field">
          <span className="wpn-pw-label">Model and version</span>
          <SearchableSelect
            options={modelOptions}
            value={model ?? ""}
            onChange={(next) => onChange({ model: next })}
            ariaLabel="Model and version"
            placeholder={active ? "Choose a model" : "Pick a provider first"}
            searchPlaceholder="Search models"
            emptyMessage="No models found."
          />
        </div>
        <div className="wpn-pw-field">
          <span className="wpn-pw-label">Effort</span>
          <SearchableSelect
            options={effortOptions}
            value={effort ?? ""}
            onChange={(next) => onChange({ effort: next || null })}
            ariaLabel="Effort"
            searchable={false}
          />
        </div>
        <div className="wpn-pw-field wpn-pm__use">
          <span className="wpn-pw-label" aria-hidden="true">
            &nbsp;
          </span>
          <Tooltip label={recommendation.reason} placement="top">
            <button type="button" className="wpn-btn wpn-btn--ghost" onClick={applyRecommendation}>
              <Icon name="sparkles" className="wpn-btn__icon" />
              Use recommended
            </button>
          </Tooltip>
        </div>
      </div>
      {active && !active.connected ? (
        <p className="wpn-pw-alert wpn-pw-alert--warn">
          {providerLabel(active.provider)} isn't connected on your account. Anyone using this prompt
          needs it connected.
        </p>
      ) : null}
    </div>
  );
}
