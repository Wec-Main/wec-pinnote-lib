import { useCallback, useEffect, useState } from "react";
import { useAnnotationAuth, useAnnotationContext } from "../../../context/AnnotationContext";
import { useDataModelDocument } from "../../../hooks/useDataModelDocument";
import { useDataModelStream } from "../../../hooks/useDataModelStream";
import { useTokenGetter } from "../../../hooks/useTokenGetter";
import { fetchDataModel, updateDataModel } from "../../../services/erdService";
import type { ErdEngineName } from "../../../types/dataModel.types";
import type { StreamEvent } from "../../../types/stream.types";
import { DataModelDocumentEditor } from "./DataModelDocumentEditor";

const DEFAULT_NAME = "Untitled data model";

function errorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }
  return error instanceof Error && error.message ? error.message : "Could not load the data model";
}

function remoteRevision(event: StreamEvent, dataModelId: string): number | null {
  if (
    event.eventType !== "data_model_document.saved" ||
    event.payload.dataModelId !== dataModelId
  ) {
    return null;
  }
  return event.payload.revision;
}

interface DataModelEditorPaneProps {
  dataModelId: string;
}

export function DataModelEditorPane({ dataModelId }: DataModelEditorPaneProps) {
  const { config } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const getToken = useTokenGetter(config.getAuthToken);
  const signedIn = Boolean(config.getAuthToken);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const [name, setName] = useState(DEFAULT_NAME);
  const [description, setDescription] = useState("");
  const [holdAi, setHoldAi] = useState(false);
  const dataModelDocument = useDataModelDocument({
    apiBaseUrl: config.apiBaseUrl,
    getAuthToken: config.getAuthToken,
    sessionKey,
    dataModelId,
    onSaved: setName,
    holdAutosave: holdAi,
  });
  const { applyRemoteRevision, reload } = dataModelDocument;
  const currentUserId = activeAccount?.id;

  useEffect(() => {
    if (!sessionKey) {
      return undefined;
    }
    const controller = new AbortController();
    getToken()
      .then((authToken) =>
        fetchDataModel(config.apiBaseUrl, authToken, dataModelId, controller.signal),
      )
      .then((dataModel) => {
        setName(dataModel.name);
        setDescription(dataModel.description ?? "");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [config.apiBaseUrl, dataModelId, getToken, sessionKey]);

  const onStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.eventType === "data_model.deleted" && event.payload.dataModelId === dataModelId) {
        reload();
        return;
      }
      if (event.eventType === "data_model.updated" && event.payload.dataModel.id === dataModelId) {
        setName(event.payload.dataModel.name);
        setDescription(event.payload.dataModel.description ?? "");
        return;
      }
      const revision = remoteRevision(event, dataModelId);
      if (revision !== null && event.actorUserId !== currentUserId) {
        applyRemoteRevision(revision);
      }
    },
    [applyRemoteRevision, currentUserId, dataModelId, reload],
  );

  const reloadIfIdle = useCallback(
    () => applyRemoteRevision(Number.POSITIVE_INFINITY),
    [applyRemoteRevision],
  );

  useDataModelStream({
    apiBaseUrl: config.apiBaseUrl,
    projectId: config.projectId,
    getAuthToken: config.getAuthToken,
    sessionKey,
    enabled: Boolean(sessionKey),
    onEvent: onStreamEvent,
    onResync: reloadIfIdle,
  });

  const handleMetaChange = useCallback(
    (patch: { name?: string; description?: string; engine?: ErdEngineName }) => {
      if (patch.name !== undefined) {
        setName(patch.name);
      }
      if (patch.description !== undefined) {
        setDescription(patch.description);
      }
      getToken()
        .then((authToken) => updateDataModel(config.apiBaseUrl, authToken, dataModelId, patch))
        .catch(() => undefined);
    },
    [config.apiBaseUrl, dataModelId, getToken],
  );

  return (
    <DataModelDocumentEditor
      dataModelId={dataModelId}
      onUnsavedAiChangesChange={setHoldAi}
      dataModelDocument={dataModelDocument}
      name={name}
      signedIn={signedIn}
      resolveError={errorMessage(dataModelDocument.error)}
      description={description}
      onMetaChange={handleMetaChange}
    />
  );
}
