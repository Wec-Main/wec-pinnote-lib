import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "../../userManagement/components/ConfirmDialog";

interface DataModelLeaveGuardValue {
  setUnsavedAiDiscard: (discard: (() => Promise<void>) | null) => void;
}

const DataModelLeaveGuardContext = createContext<DataModelLeaveGuardValue | null>(null);

export function useDataModelLeaveGuard(): DataModelLeaveGuardValue | null {
  return useContext(DataModelLeaveGuardContext);
}

export function useDataModelLeaveGuardHost(): {
  guard: (proceed: () => void) => void;
  provider: (children: ReactNode) => ReactNode;
  dialog: ReactNode;
} {
  const discardRef = useRef<(() => Promise<void>) | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const value = useMemo<DataModelLeaveGuardValue>(
    () => ({
      setUnsavedAiDiscard: (discard) => {
        discardRef.current = discard;
      },
    }),
    [],
  );
  const guard = useCallback((proceed: () => void) => {
    if (discardRef.current) setPending(() => proceed);
    else proceed();
  }, []);
  const provider = useCallback(
    (children: ReactNode) => (
      <DataModelLeaveGuardContext.Provider value={value}>
        {children}
      </DataModelLeaveGuardContext.Provider>
    ),
    [value],
  );
  const dialog = pending ? (
    <ConfirmDialog
      title="Unsaved AI changes"
      description="The AI changes on this data model are not saved. If you leave now, they are discarded."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      destructive
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const proceed = pending;
        const discard = discardRef.current;
        setPending(null);
        discardRef.current = null;
        void (discard ? discard().catch(() => undefined) : Promise.resolve()).then(proceed);
      }}
    />
  ) : null;
  return { guard, provider, dialog };
}
