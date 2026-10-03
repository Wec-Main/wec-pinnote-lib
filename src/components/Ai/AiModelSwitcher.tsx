import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { isAiEffort } from "../../ai/modelValidation";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { AiConnector, AiMe, AiModelInfo, AiProviderId } from "../../types/ai.types";
import { Icon } from "../primitives/Icon";
import { useAiUi } from "./AiUiContext";
import {
  providerLabel,
  connectedProviders,
  defaultEffortFor,
  effectiveConnector,
  resolveRoute,
  type AiRoute,
} from "./aiHelpers";
import { ProviderLogo } from "./ProviderLogo";
import { useAiDefaults } from "./useAiPreferences";

export interface AiModelSwitcherProps {
  me?: AiMe | null;
  value?: AiRoute | null;
  onChange?: (route: AiRoute) => void;
  persist?: boolean;
  disabled?: boolean;
  compact?: boolean;
  placement?: "top" | "bottom" | "auto";
  className?: string;
}

interface ModelOption {
  key: string;
  provider: AiProviderId;
  model: AiModelInfo;
}

type NavItem =
  | { kind: "option"; option: ModelOption }
  | { kind: "more"; provider: AiProviderId; count: number }
  | { kind: "effort" };

type Flyout = { kind: "more"; provider: AiProviderId } | { kind: "effort" };

interface ProviderSection {
  provider: AiProviderId;
  connector: AiConnector;
  options: ModelOption[];
  primaryCount: number;
}

const PRIMARY_MODELS = 4;
const FLYOUT_WIDTH_PX = 200;
const TYPEAHEAD_RESET_MS = 600;
const MENU_ROOM_PX = 320;
const MENU_GAP_PX = 6;
const MENU_EDGE_PX = 12;
const MENU_WIDTH_PX = 340;
const MENU_MAX_HEIGHT_PX = 460;

function menuGeometry(trigger: HTMLElement, preferred: "top" | "bottom" | "auto") {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - MENU_EDGE_PX;
  const above = rect.top - MENU_EDGE_PX;
  const side: "top" | "bottom" =
    preferred === "auto" ? (below >= MENU_ROOM_PX || below >= above ? "bottom" : "top") : preferred;
  const room = Math.max(160, side === "bottom" ? below : above);
  const left = Math.max(
    MENU_EDGE_PX,
    Math.min(rect.left, window.innerWidth - MENU_WIDTH_PX - MENU_EDGE_PX),
  );
  const style: CSSProperties = { left, maxHeight: Math.min(MENU_MAX_HEIGHT_PX, room) };
  if (side === "bottom") style.top = rect.bottom + MENU_GAP_PX;
  else style.bottom = window.innerHeight - rect.top + MENU_GAP_PX;
  return { side, style };
}

function fallbackModel(): AiModelInfo {
  return {
    id: "default",
    label: "Default model",
    description: "",
    efforts: [],
    defaultEffort: null,
    isDefault: true,
  };
}

const isFamily = (option: ModelOption, family: string) =>
  `${option.model.id} ${option.model.label}`.toLowerCase().includes(family);

function arrangeModels(provider: AiProviderId, options: ModelOption[]) {
  if (provider !== "claude") return { options, primaryCount: PRIMARY_MODELS };
  const haikuIndex = options.findIndex((option) => isFamily(option, "haiku"));
  const sonnetIndex = options.findIndex((option) => isFamily(option, "sonnet"));
  if (haikuIndex === -1 || sonnetIndex === -1) {
    return { options, primaryCount: PRIMARY_MODELS };
  }
  const arranged = options.slice();
  const [haiku] = arranged.splice(haikuIndex, 1);
  arranged.splice(
    arranged.findIndex((option) => isFamily(option, "sonnet")),
    0,
    haiku!,
  );
  const lastPinned = Math.max(
    arranged.findIndex((option) => isFamily(option, "sonnet")),
    arranged.indexOf(haiku!),
  );
  return { options: arranged, primaryCount: Math.max(PRIMARY_MODELS, lastPinned + 1) };
}

export function buildModelSections(me: AiMe | null | undefined): ProviderSection[] {
  return connectedProviders(me).flatMap((provider) => {
    const connector = effectiveConnector(me, provider);
    if (!connector) return [];
    const models = connector.models.length > 0 ? connector.models : [fallbackModel()];
    const arranged = arrangeModels(
      provider,
      models.map((model) => ({ key: `${provider}:${model.id}`, provider, model })),
    );
    return [{ provider, connector, ...arranged }];
  });
}

export function routeForModel(
  current: AiRoute | null,
  provider: AiProviderId,
  model: AiModelInfo,
): AiRoute {
  const effort =
    current?.effort && model.efforts.includes(current.effort)
      ? current.effort
      : defaultEffortFor(model);
  return { provider, model: model.id, effort };
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function AiModelSwitcher({
  me: meProp,
  value,
  onChange,
  persist,
  disabled = false,
  compact = false,
  placement = "auto",
  className,
}: AiModelSwitcherProps) {
  const runtime = useOptionalAiRuntime();
  const ui = useAiUi();
  const me = meProp !== undefined ? meProp : (runtime?.me ?? null);
  const [defaults, setDefaults] = useAiDefaults();
  const controlled = value !== undefined;
  const route = controlled ? value : resolveRoute(me, defaults);
  const shouldPersist = persist ?? !controlled;

  const sections = useMemo(() => buildModelSections(me), [me]);
  const [toggled, setToggled] = useState<ReadonlySet<AiProviderId>>(() => new Set());
  const collapsed = useMemo(() => {
    const result = new Set<AiProviderId>();
    sections.forEach((section, index) => {
      const byDefault = index > 0 && section.provider !== route?.provider;
      if (byDefault !== toggled.has(section.provider)) result.add(section.provider);
    });
    return result;
  }, [sections, toggled, route?.provider]);
  const allOptions = useMemo(() => sections.flatMap((section) => section.options), [sections]);
  const selectedKey = route ? `${route.provider}:${route.model}` : null;
  const selected =
    allOptions.find((option) => option.key === selectedKey) ??
    allOptions.find((option) => option.provider === route?.provider && option.model.isDefault) ??
    null;
  const efforts = (selected?.model.efforts ?? []).filter(isAiEffort);

  const items = useMemo<NavItem[]>(() => {
    const list: NavItem[] = [];
    for (const section of sections) {
      if (collapsed.has(section.provider)) continue;
      for (const option of section.options.slice(0, section.primaryCount)) {
        list.push({ kind: "option", option });
      }
      if (section.options.length > section.primaryCount) {
        list.push({
          kind: "more",
          provider: section.provider,
          count: section.options.length - section.primaryCount,
        });
      }
    }
    if (efforts.length > 0) list.push({ kind: "effort" });
    return list;
  }, [sections, collapsed, efforts.length]);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const [flyoutIndex, setFlyoutIndex] = useState(0);
  const [flyoutStyle, setFlyoutStyle] = useState<CSSProperties>({});
  const [side, setSide] = useState<"top" | "bottom">(placement === "bottom" ? "bottom" : "top");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const flyoutEntries = useMemo(() => {
    if (!flyout) return [];
    if (flyout.kind === "effort") {
      return efforts.map((effort) => ({
        key: effort,
        label: capitalize(effort),
        checked: route?.effort === effort,
      }));
    }
    const section = sections.find((entry) => entry.provider === flyout.provider);
    return (section ? section.options.slice(section.primaryCount) : []).map((option) => ({
      key: option.key,
      label: option.model.label,
      checked: option.key === selected?.key,
    }));
  }, [flyout, efforts, route?.effort, sections, selected?.key]);

  const commit = useCallback(
    (next: AiRoute) => {
      onChange?.(next);
      if (shouldPersist) {
        setDefaults({ provider: next.provider, model: next.model, effort: next.effort });
      }
    },
    [onChange, setDefaults, shouldPersist],
  );

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setFlyout(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(
    (at?: "first" | "last") => {
      if (disabled || items.length === 0) return;
      const current = items.findIndex(
        (item) => item.kind === "option" && item.option.key === selected?.key,
      );
      setActiveIndex(at === "first" ? 0 : at === "last" ? items.length - 1 : Math.max(0, current));
      setFlyout(null);
      if (triggerRef.current && typeof window !== "undefined") {
        const geometry = menuGeometry(triggerRef.current, placement);
        setSide(geometry.side);
        setMenuStyle(geometry.style);
      }
      setOpen(true);
    },
    [disabled, items, placement, selected?.key],
  );

  const openFlyout = useCallback(
    (next: Flyout, index: number, focusFirst = false) => {
      const row = document.getElementById(optionId(index));
      const menu = menuRef.current;
      if (!row || !menu) return;
      const rowRect = row.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const fitsRight = menuRect.right + MENU_GAP_PX + FLYOUT_WIDTH_PX <= window.innerWidth - 8;
      const style: CSSProperties = {
        left: fitsRight
          ? menuRect.right + MENU_GAP_PX
          : Math.max(8, menuRect.left - FLYOUT_WIDTH_PX - MENU_GAP_PX),
        top: Math.max(8, Math.min(rowRect.top - 6, window.innerHeight - 8 - 320)),
        maxHeight: 320,
      };
      setFlyoutStyle(style);
      setFlyout(next);
      setActiveIndex(index);
      setFlyoutIndex(focusFirst ? 0 : -1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseId],
  );

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const reposition = () => {
      if (!triggerRef.current) return;
      const geometry = menuGeometry(triggerRef.current, placement);
      setSide(geometry.side);
      setMenuStyle(geometry.style);
      setFlyout(null);
    };
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open, placement]);

  useEscapeKey(() => (flyout ? setFlyout(null) : close(true)), open);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !menuRef.current?.contains(target) &&
        !flyoutRef.current?.contains(target)
      ) {
        close(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  useLayoutEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, baseId]);

  const selectOption = (option: ModelOption) => {
    commit(routeForModel(route ?? null, option.provider, option.model));
    close(true);
  };

  const selectFlyoutEntry = (key: string) => {
    if (!flyout) return;
    if (flyout.kind === "effort") {
      if (route) commit({ ...route, effort: key });
      close(true);
      return;
    }
    const option = allOptions.find((entry) => entry.key === key);
    if (option) selectOption(option);
  };

  const activate = (index: number, viaKeyboard: boolean) => {
    const item = items[index];
    if (!item) return;
    if (item.kind === "option") {
      selectOption(item.option);
    } else if (item.kind === "more") {
      openFlyout({ kind: "more", provider: item.provider }, index, viaKeyboard);
    } else {
      openFlyout({ kind: "effort" }, index, viaKeyboard);
    }
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowUp" ? "last" : undefined);
    }
  };

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (flyout && flyoutIndex >= 0) {
      const last = flyoutEntries.length - 1;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFlyoutIndex((index) => Math.min(last, index + 1));
          return;
        case "ArrowUp":
          event.preventDefault();
          setFlyoutIndex((index) => Math.max(0, index - 1));
          return;
        case "Enter":
        case " ":
          event.preventDefault();
          if (flyoutEntries[flyoutIndex]) selectFlyoutEntry(flyoutEntries[flyoutIndex]!.key);
          return;
        case "ArrowLeft":
          event.preventDefault();
          setFlyout(null);
          return;
        default:
          return;
      }
    }
    const last = items.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFlyout(null);
        setActiveIndex((index) => Math.min(last, index + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setFlyout(null);
        setActiveIndex((index) => Math.max(0, index - 1));
        return;
      case "Home":
        event.preventDefault();
        setFlyout(null);
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setFlyout(null);
        setActiveIndex(last);
        return;
      case "ArrowRight": {
        const item = items[activeIndex];
        if (item && item.kind !== "option") {
          event.preventDefault();
          activate(activeIndex, true);
        }
        return;
      }
      case "Enter":
      case " ":
        if (event.key === " " && typeahead.current.text) break;
        event.preventDefault();
        activate(activeIndex, true);
        return;
      case "Tab":
        close(false);
        return;
      default:
        break;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const state = typeahead.current;
      state.text = now - state.at > TYPEAHEAD_RESET_MS ? event.key : state.text + event.key;
      state.at = now;
      const query = state.text.toLowerCase();
      const matches = (item: NavItem) =>
        item.kind === "option" &&
        (item.option.model.label.toLowerCase().startsWith(query) ||
          providerLabel(item.option.provider).toLowerCase().startsWith(query) ||
          item.option.model.id.toLowerCase().startsWith(query));
      const from = state.text.length === 1 ? activeIndex + 1 : activeIndex;
      for (let step = 0; step < items.length; step++) {
        const index = (from + step) % items.length;
        if (matches(items[index] as NavItem)) {
          setActiveIndex(index);
          setFlyout(null);
          break;
        }
      }
      event.preventDefault();
    }
  };

  const rootClass = [
    "wpn-ai-switcher",
    compact ? "wpn-ai-switcher--compact" : "",
    open ? "wpn-ai-switcher--open" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!route || sections.length === 0) {
    return ui ? (
      <button
        type="button"
        className={[rootClass, "wpn-ai-switcher__trigger", "wpn-ai-switcher--empty"].join(" ")}
        onClick={() => ui.openIntegrations("connectors")}
        disabled={disabled}
      >
        <Icon name="plug" />
        <span>Connect an agent</span>
      </button>
    ) : (
      <span className="wpn-ai-route wpn-ai-route--empty">No agent connected</span>
    );
  }

  const triggerLabel = selected?.model.label ?? route.model;
  const rowHandlers = (index: number, item: NavItem) => ({
    id: optionId(index),
    "data-active": index === activeIndex || undefined,
    onPointerMove: () => {
      if (index === activeIndex) return;
      setActiveIndex(index);
      if (item.kind === "option") setFlyout(null);
    },
  });
  let itemIndex = -1;

  return (
    <div className={rootClass} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="wpn-ai-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Model: ${providerLabel(route.provider)} ${triggerLabel}${
          route.effort ? `, ${route.effort} effort` : ""
        }`}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <ProviderLogo provider={route.provider} size={compact ? 16 : 18} />
        <span className="wpn-ai-switcher__label">{triggerLabel}</span>
        {route.effort ? <span className="wpn-ai-switcher__effort">{route.effort}</span> : null}
        <Icon name="chevronDown" className="wpn-ai-switcher__chevron" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="wpn-ai-scope wpn-ai-switcher__portal" data-theme="dark">
              <div
                ref={menuRef}
                className={`wpn-ai-switcher__menu wpn-ai-switcher__menu--${side}`}
                style={menuStyle}
              >
                <div
                  ref={listRef}
                  id={listId}
                  role="listbox"
                  tabIndex={-1}
                  aria-label="Choose a model"
                  aria-activedescendant={optionId(activeIndex)}
                  className="wpn-ai-switcher__list"
                  onKeyDown={onListKeyDown}
                >
                  {sections.map((section) => {
                    const headingId = `${baseId}-${section.provider}`;
                    const isCollapsed = collapsed.has(section.provider);
                    const primary = isCollapsed
                      ? []
                      : section.options.slice(0, section.primaryCount);
                    const extra = section.options.length - section.primaryCount;
                    return (
                      <div
                        key={section.provider}
                        role="group"
                        aria-labelledby={headingId}
                        className="wpn-ai-switcher__group"
                      >
                        {sections.length > 1 ? (
                          <button
                            type="button"
                            id={headingId}
                            tabIndex={-1}
                            className="wpn-ai-switcher__group-head"
                            aria-expanded={!isCollapsed}
                            onClick={() => {
                              setToggled((current) => {
                                const next = new Set(current);
                                if (next.has(section.provider)) next.delete(section.provider);
                                else next.add(section.provider);
                                return next;
                              });
                              setActiveIndex(0);
                              setFlyout(null);
                              listRef.current?.focus();
                            }}
                          >
                            <ProviderLogo provider={section.provider} size={16} />
                            <span className="wpn-ai-switcher__group-name">
                              {providerLabel(section.provider)}
                            </span>
                            <span className="wpn-ai-switcher__group-count">
                              {section.options.length}
                            </span>
                            <span
                              className={`wpn-ai-switcher__dot wpn-ai-switcher__dot--${section.connector.status}`}
                              title={
                                section.connector.status === "connected"
                                  ? "Connected"
                                  : section.connector.status
                              }
                            />
                            <Icon
                              name="chevronDown"
                              className={[
                                "wpn-ai-switcher__group-chevron",
                                isCollapsed ? "wpn-ai-switcher__group-chevron--closed" : "",
                              ].join(" ")}
                            />
                          </button>
                        ) : (
                          <span id={headingId} className="wpn-sr-only">
                            {providerLabel(section.provider)}
                          </span>
                        )}
                        {primary.map((option) => {
                          itemIndex++;
                          const index = itemIndex;
                          const isSelected = option.key === selected?.key;
                          return (
                            <div
                              key={option.key}
                              role="option"
                              aria-selected={isSelected}
                              className="wpn-ai-switcher__option"
                              {...rowHandlers(index, { kind: "option", option })}
                              onClick={() => selectOption(option)}
                            >
                              <span className="wpn-ai-switcher__option-text">
                                <span className="wpn-ai-switcher__option-label">
                                  {option.model.label}
                                  {option.model.isDefault ? (
                                    <span className="wpn-ai-switcher__badge">Default</span>
                                  ) : null}
                                </span>
                                {option.model.description ? (
                                  <span className="wpn-ai-switcher__option-desc">
                                    {option.model.description}
                                  </span>
                                ) : null}
                              </span>
                              {isSelected ? (
                                <Icon name="check" className="wpn-ai-switcher__check" />
                              ) : null}
                            </div>
                          );
                        })}
                        {!isCollapsed && extra > 0
                          ? (() => {
                              itemIndex++;
                              const index = itemIndex;
                              const item: NavItem = {
                                kind: "more",
                                provider: section.provider,
                                count: extra,
                              };
                              const expanded =
                                flyout?.kind === "more" && flyout.provider === section.provider;
                              return (
                                <div
                                  role="option"
                                  aria-selected={false}
                                  aria-haspopup="menu"
                                  aria-expanded={expanded}
                                  className="wpn-ai-switcher__row"
                                  {...rowHandlers(index, item)}
                                  onClick={() => activate(index, false)}
                                >
                                  <span className="wpn-ai-switcher__row-label">More models</span>
                                  <span className="wpn-ai-switcher__row-value">{extra}</span>
                                  <Icon
                                    name="chevronRight"
                                    className="wpn-ai-switcher__row-chevron"
                                  />
                                </div>
                              );
                            })()
                          : null}
                      </div>
                    );
                  })}
                  {efforts.length > 0
                    ? (() => {
                        itemIndex++;
                        const index = itemIndex;
                        const item: NavItem = { kind: "effort" };
                        return (
                          <div
                            role="option"
                            aria-selected={false}
                            aria-haspopup="menu"
                            aria-expanded={flyout?.kind === "effort"}
                            className="wpn-ai-switcher__row wpn-ai-switcher__row--effort"
                            {...rowHandlers(index, item)}
                            onClick={() => activate(index, false)}
                          >
                            <span className="wpn-ai-switcher__row-label">Effort</span>
                            <span className="wpn-ai-switcher__row-value">
                              {capitalize(route.effort ?? defaultEffortFor(selected?.model) ?? "")}
                            </span>
                            <Icon name="chevronRight" className="wpn-ai-switcher__row-chevron" />
                          </div>
                        );
                      })()
                    : null}
                </div>
                {ui ? (
                  <button
                    type="button"
                    className="wpn-ai-switcher__footer"
                    onClick={() => {
                      close(false);
                      ui.openIntegrations("connectors");
                    }}
                  >
                    <Icon name="plus" />
                    Connect another agent
                  </button>
                ) : null}
              </div>
              {flyout ? (
                <div
                  ref={flyoutRef}
                  role="menu"
                  aria-label={flyout.kind === "effort" ? "Effort" : "More models"}
                  className="wpn-ai-switcher__flyout"
                  style={flyoutStyle}
                >
                  {flyoutEntries.map((entry, index) => (
                    <button
                      key={entry.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={entry.checked}
                      tabIndex={-1}
                      data-active={index === flyoutIndex || undefined}
                      className="wpn-ai-switcher__flyout-item"
                      onClick={() => selectFlyoutEntry(entry.key)}
                    >
                      <span>{entry.label}</span>
                      {entry.checked ? (
                        <Icon name="check" className="wpn-ai-switcher__check" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
