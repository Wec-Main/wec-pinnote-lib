import { useEffect, useMemo, useRef, useState } from "react";
import type { Annotation } from "../types/annotation.types";
import { isLibraryElement, resolveElement } from "../utils/dom/elementResolver";

const MUTATION_DEBOUNCE_MS = 120;
const MUTATION_MAX_WAIT_MS = 400;

function computePresentIds(annotations: Annotation[]): Set<string> {
  const present = new Set<string>();
  for (const annotation of annotations) {
    if (resolveElement(annotation.anchor)) {
      present.add(annotation.id);
    }
  }
  return present;
}

function idsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }
  return true;
}

export function useAnnotationPresence(annotations: Annotation[]): Set<string> {
  const [present, setPresent] = useState<Set<string>>(() => computePresentIds(annotations));
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const anchorsKey = useMemo(
    () =>
      annotations.map((annotation) => `${annotation.id}:${annotation.anchor.selector}`).join("|"),
    [annotations],
  );

  useEffect(() => {
    let debounceTimer = 0;
    let maxWaitTimer = 0;

    const compute = () => {
      window.clearTimeout(maxWaitTimer);
      maxWaitTimer = 0;
      const next = computePresentIds(annotationsRef.current);
      setPresent((current) => (idsEqual(current, next) ? current : next));
    };

    const scheduleDebounced = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(compute, MUTATION_DEBOUNCE_MS);
      if (!maxWaitTimer) {
        maxWaitTimer = window.setTimeout(compute, MUTATION_MAX_WAIT_MS);
      }
    };

    const scheduleFromTransitionEvent = (event: Event) => {
      if (!isLibraryElement(event.target)) {
        scheduleDebounced();
      }
    };

    compute();

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((mutations) => {
            const relevant = mutations.some((mutation) => !isLibraryElement(mutation.target));
            if (relevant) {
              scheduleDebounced();
            }
          });
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    document.addEventListener("transitionend", scheduleFromTransitionEvent, true);
    document.addEventListener("animationend", scheduleFromTransitionEvent, true);

    return () => {
      window.clearTimeout(debounceTimer);
      window.clearTimeout(maxWaitTimer);
      mutationObserver?.disconnect();
      document.removeEventListener("transitionend", scheduleFromTransitionEvent, true);
      document.removeEventListener("animationend", scheduleFromTransitionEvent, true);
    };
  }, [anchorsKey]);

  return present;
}
