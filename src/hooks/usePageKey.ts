import { useEffect, useRef, useState } from "react";
import { resolvePageKey, subscribeToPageKey } from "../utils/pageKey";

export function usePageKey(getPageKey?: () => string): string {
  const getterRef = useRef(getPageKey);
  getterRef.current = getPageKey;
  const [pageKey, setPageKey] = useState(() => resolvePageKey(getPageKey));

  useEffect(() => {
    const sync = () => {
      setPageKey((current) => {
        const next = resolvePageKey(getterRef.current);
        return current === next ? current : next;
      });
    };

    sync();
    return subscribeToPageKey(sync);
  }, []);

  return pageKey;
}
