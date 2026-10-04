import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchProject,
  updateProjectVersionSettings,
  type ProjectVersionSettingsPatch,
} from "../../../services/settingsService";
import { createProjectVersionsApi } from "../../../services/versioningService";
import type { Project } from "../../../types/organization.types";
import type { ProjectVersion } from "../../../types/projectVersion.types";
import { errorMessage } from "./validationError";

const NOTICE_DISMISS_MS = 4000;

export interface ProjectVersioningState {
  project: Project | null;
  versions: ProjectVersion[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  busy: boolean;
  progress: string | null;
  notice: string | null;
  dismissNotice: () => void;
  reload: () => void;
  addVersion: () => Promise<void>;
  publishVersion: (versionId: string) => Promise<void>;
  setActiveVersion: (versionId: string) => Promise<void>;
  updateVersionSettings: (patch: ProjectVersionSettingsPatch) => Promise<void>;
}

export function useProjectVersioning(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  onVersionChanged?: () => void,
): ProjectVersioningState {
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useMemo(
    () =>
      createProjectVersionsApi({
        apiBaseUrl,
        getAuthToken: async () => authToken ?? "",
      }),
    [apiBaseUrl, authToken],
  );

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
    if (!projectId) {
      setLoading(false);
      setLoaded(true);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      fetchProject(apiBaseUrl, authToken, projectId, controller.signal),
      api.listProjectVersions(projectId, controller.signal),
    ])
      .then(([projectResult, versionsResult]) => {
        setProject(projectResult);
        setVersions(versionsResult);
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
  }, [apiBaseUrl, authToken, projectId, api, reloadToken]);

  const addVersion = useCallback(async () => {
    setBusy(true);
    setProgress("Creating a new draft version…");
    try {
      await api.createProjectVersion(projectId, {});
      showNotice("New draft version created and set as active.");
      onVersionChanged?.();
      reload();
    } catch (err) {
      showNotice(errorMessage(err));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }, [api, projectId, showNotice, reload, onVersionChanged]);

  const publishVersion = useCallback(
    async (versionId: string) => {
      setBusy(true);
      setProgress("Publishing version…");
      try {
        await api.updateProjectVersion(projectId, versionId, { status: "published" });
        showNotice("Version published. The next draft version is ready.");
        onVersionChanged?.();
        reload();
      } catch (err) {
        showNotice(errorMessage(err));
        reload();
      } finally {
        setProgress(null);
        setBusy(false);
      }
    },
    [api, projectId, showNotice, reload, onVersionChanged],
  );

  const setActiveVersion = useCallback(
    async (versionId: string) => {
      setBusy(true);
      try {
        await api.updateProjectVersion(projectId, versionId, { setCurrent: true });
        showNotice("Active version updated.");
        reload();
        onVersionChanged?.();
      } catch (err) {
        showNotice(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [api, projectId, showNotice, reload, onVersionChanged],
  );

  const updateVersionSettings = useCallback(
    async (patch: ProjectVersionSettingsPatch) => {
      setBusy(true);
      try {
        await updateProjectVersionSettings(apiBaseUrl, authToken, projectId, patch);
        showNotice("Version settings updated.");
        reload();
      } catch (err) {
        showNotice(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [apiBaseUrl, authToken, projectId, showNotice, reload],
  );

  return useMemo(
    () => ({
      project,
      versions,
      loading,
      loaded,
      error,
      busy,
      progress,
      notice,
      dismissNotice,
      reload,
      addVersion,
      publishVersion,
      setActiveVersion,
      updateVersionSettings,
    }),
    [
      project,
      versions,
      loading,
      loaded,
      error,
      busy,
      progress,
      notice,
      dismissNotice,
      reload,
      addVersion,
      publishVersion,
      setActiveVersion,
      updateVersionSettings,
    ],
  );
}
