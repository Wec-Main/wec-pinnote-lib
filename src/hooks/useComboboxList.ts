import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useOutsidePointerDown } from "./useOutsidePointerDown";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface UseComboboxListArgs {
  options: ComboboxOption[];
  activeValue: string | null;
  onOpenChange?: (open: boolean) => void;
}

export function useComboboxList({ options, activeValue, onOpenChange }: UseComboboxListArgs) {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const setOpen = (next: boolean) => {
    if (!next && rootRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus();
    }
    setOpenState(next);
    onOpenChange?.(next);
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""} ${option.value}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [options, query]);

  useOutsidePointerDown(rootRef, () => setOpen(false), open);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const activeDescendant =
    open && filtered.length > 0 && activeIndex >= 0 && activeIndex < filtered.length
      ? optionId(activeIndex)
      : undefined;

  const openMenu = () => {
    setQuery("");
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === activeValue),
      ),
    );
    setOpen(true);
  };

  const closeMenu = () => setOpen(false);

  const onInputChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
  };

  const onRootKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    onCommit: (option: ComboboxOption) => void,
  ) => {
    if (event.key === "Escape") {
      if (open) {
        event.stopPropagation();
      }
      setOpen(false);
      return;
    }
    if (!open && (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) {
        onCommit(option);
      }
    }
  };

  return {
    open,
    setOpen,
    query,
    activeIndex,
    setActiveIndex,
    filtered,
    rootRef,
    inputRef,
    triggerRef,
    listboxId,
    optionId,
    activeDescendant,
    openMenu,
    closeMenu,
    onInputChange,
    onRootKeyDown,
  };
}
