import { useRef } from "react";

export function useTokenGetter(
  getAuthToken: (() => string | Promise<string>) | undefined,
): () => Promise<string | undefined> {
  const tokenRef = useRef(getAuthToken);
  tokenRef.current = getAuthToken;

  const getterRef = useRef<() => Promise<string | undefined>>();
  if (!getterRef.current) {
    getterRef.current = async () => tokenRef.current?.();
  }
  return getterRef.current;
}
