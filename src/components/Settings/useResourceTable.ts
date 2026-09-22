import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, validationDetailsFrom, type ValidationDetails } from "./validationError";

const NOTICE_DISMISS_MS = 4000;

export interface ResourceTableOptions<T, Draft> {
  load: (query: string, signal: AbortSignal) => Promise<T[]>;
  create: (draft: Draft) => Promise<unknown>;
  update: (id: string, draft: Draft) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
  getId: (item: T) => string;
  draftLabel: (draft: Draft) => string;
  itemLabel: (item: T) => string;
  deps?: unknown[];
}

export interface ResourceTableState<T, Draft> {
  items: T[];
  visible: T[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  notice: string | null;
  busy: boolean;
  formOpen: boolean;
  editTarget: T | null;
  pendingDelete: T | null;
  submitDetails: ValidationDetails | null;
  search: string;
  query: string;
  setSearch: (value: string) => void;
  setQuery: (value: string) => void;
  open: (target?: T | null) => void;
  closeForm: () => void;
  askDelete: (target: T) => void;
  cancelDelete: () => void;
  submit: (draft: Draft) => Promise<void>;
  confirmDelete: () => Promise<void>;
  dismissNotice: () => void;
  reload: () => void;
}

export function useResourceTable<T, Draft>({
  load,
  create,
  update,
  remove,
  getId,
  draftLabel,
  itemLabel,
  deps = [],
}: ResourceTableOptions<T, Draft>): ResourceTableState<T, Draft> {
  const [items, setItems] = useState<T[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<T | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitDetails, setSubmitDetails] = useState<ValidationDetails | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_DISMISS_MS);
  }, []);

  const dismissNotice = useCallback(() => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    setNotice(null);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    load(query, controller.signal)
      .then((result) => {
        setItems(result);
        setLoading(false);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(errorMessage(err));
        setLoading(false);
        setLoaded(true);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, reloadToken, ...deps]);

  const visible = items;

  const open = useCallback((target: T | null = null) => {
    setEditTarget(target);
    setFormOpen(true);
    setSubmitDetails(null);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditTarget(null);
    setSubmitDetails(null);
  }, []);

  const askDelete = useCallback((target: T) => setPendingDelete(target), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const submit = useCallback(
    async (draft: Draft) => {
      setBusy(true);
      setError(null);
      setSubmitDetails(null);
      try {
        if (editTarget) {
          await update(getId(editTarget), draft);
          showNotice(`${draftLabel(draft)} updated.`);
        } else {
          await create(draft);
          showNotice(`${draftLabel(draft)} created.`);
        }
        closeForm();
        reload();
      } catch (err) {
        showNotice(errorMessage(err));
        setSubmitDetails(validationDetailsFrom(err));
      } finally {
        setBusy(false);
      }
    },
    [editTarget, update, create, getId, draftLabel, showNotice, closeForm, reload],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    try {
      await remove(getId(pendingDelete));
      showNotice(`${itemLabel(pendingDelete)} deleted.`);
      setPendingDelete(null);
      reload();
    } catch (err) {
      showNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, remove, getId, itemLabel, showNotice, reload]);

  return useMemo(
    () => ({
      items,
      visible,
      loading,
      loaded,
      error,
      notice,
      busy,
      formOpen,
      editTarget,
      pendingDelete,
      submitDetails,
      search,
      query,
      setSearch,
      setQuery,
      open,
      closeForm,
      askDelete,
      cancelDelete,
      submit,
      confirmDelete,
      dismissNotice,
      reload,
    }),
    [
      items,
      visible,
      loading,
      loaded,
      error,
      notice,
      busy,
      formOpen,
      editTarget,
      pendingDelete,
      submitDetails,
      search,
      query,
      open,
      closeForm,
      askDelete,
      cancelDelete,
      submit,
      confirmDelete,
      dismissNotice,
      reload,
    ],
  );
}
