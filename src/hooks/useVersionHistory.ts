import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnotationContext } from "../context/AnnotationContext";

export interface VersionRecordBase {
  id: string;
  version: number;
  publishedByUser: string | null;
  publishedAt: string;
}

interface UseVersionHistoryOptions<TRecord extends VersionRecordBase, TDocument> {
  documentId: string | null;
  listVersions: (
    apiBaseUrl: string,
    authToken: string | undefined,
    documentId: string,
  ) => Promise<TRecord[]>;
  fetchVersionDocument: (
    apiBaseUrl: string,
    authToken: string | undefined,
    documentId: string,
    version: TRecord,
  ) => Promise<TDocument | null | undefined>;
}

export interface VersionHistoryState<TRecord extends VersionRecordBase, TDocument> {
  versionsOpen: boolean;
  versions: TRecord[];
  versionsLoading: boolean;
  versionsError: string | null;
  hasVersions: boolean;
  previewVersion: TRecord | null;
  previewDocument: TDocument | null;
  previewLoading: boolean;
  previewError: string | null;
  toggleVersions: () => Promise<void>;
  closeVersions: () => void;
  refreshVersions: () => Promise<TRecord[] | null>;
  previewVersionRecord: (version: TRecord) => Promise<void>;
  exitPreview: () => void;
  dismissPreviewError: () => void;
  markPublished: () => void;
}

export function useVersionHistory<TRecord extends VersionRecordBase, TDocument>({
  documentId,
  listVersions,
  fetchVersionDocument,
}: UseVersionHistoryOptions<TRecord, TDocument>): VersionHistoryState<TRecord, TDocument> {
  const { config } = useAnnotationContext();
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<TRecord[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [hasVersions, setHasVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<TRecord | null>(null);
  const [previewDocument, setPreviewDocument] = useState<TDocument | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const listVersionsRef = useRef(listVersions);
  listVersionsRef.current = listVersions;
  const fetchVersionDocumentRef = useRef(fetchVersionDocument);
  fetchVersionDocumentRef.current = fetchVersionDocument;

  const authToken = useCallback(
    async () =>
      configRef.current.getAuthToken ? await configRef.current.getAuthToken() : undefined,
    [],
  );

  const refreshVersions = useCallback(async () => {
    if (!documentId) return null;
    setVersionsError(null);
    try {
      const token = await authToken();
      const raw = await listVersionsRef.current(configRef.current.apiBaseUrl, token, documentId);
      const list = Array.isArray(raw) ? raw : [];
      setVersions(list);
      setHasVersions(list.length > 0);
      return list;
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Could not load version history";
      setVersionsError(msg);
      return null;
    }
  }, [authToken, documentId]);

  useEffect(() => {
    let cancelled = false;
    void refreshVersions().then((list) => {
      if (cancelled || !list) return;
      setVersions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshVersions]);

  const toggleVersions = useCallback(async () => {
    if (versionsOpen) {
      setVersionsOpen(false);
      return;
    }
    setVersionsOpen(true);
    setVersionsLoading(true);
    await refreshVersions();
    setVersionsLoading(false);
  }, [versionsOpen, refreshVersions]);

  const closeVersions = useCallback(() => setVersionsOpen(false), []);

  const previewVersionRecord = useCallback(
    async (version: TRecord) => {
      if (!documentId || previewLoading) return;
      if (previewVersion?.id === version.id) return;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const token = await authToken();
        const document = await fetchVersionDocumentRef.current(
          configRef.current.apiBaseUrl,
          token,
          documentId,
          version,
        );
        if (!document) throw new Error("Version document is empty");
        setPreviewVersion(version);
        setPreviewDocument(document);
      } catch (e) {
        setPreviewError(
          e instanceof Error && e.message ? e.message : "Could not load this version",
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [authToken, documentId, previewLoading, previewVersion],
  );

  const exitPreview = useCallback(() => {
    setPreviewVersion(null);
    setPreviewDocument(null);
    setPreviewError(null);
  }, []);

  const dismissPreviewError = useCallback(() => setPreviewError(null), []);

  const markPublished = useCallback(() => {
    setHasVersions(true);
    setVersionsError(null);
    void refreshVersions();
  }, [refreshVersions]);

  return {
    versionsOpen,
    versions,
    versionsLoading,
    versionsError,
    hasVersions,
    previewVersion,
    previewDocument,
    previewLoading,
    previewError,
    toggleVersions,
    closeVersions,
    refreshVersions,
    previewVersionRecord,
    exitPreview,
    dismissPreviewError,
    markPublished,
  };
}
