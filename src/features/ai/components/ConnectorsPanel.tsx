import { useState, type ReactNode } from "react";
import { useAiRuntime } from "../AiRuntimeContext";
import { useClientPagination } from "../../../hooks/useClientPagination";
import { useSkeletonGate } from "../../../hooks/useSkeletonGate";
import { ConnectorsSkeleton } from "../../../components/Loading/ScreenSkeletons";
import { fetchAiConnectors, logoutConnector } from "../../../services/aiService";
import type { AiConnector, AiProviderId } from "../../../types/ai.types";
import { formatTimestamp } from "../../../utils/format";
import { ListSearchBar } from "../../../components/primitives/ListSearchBar";
import { RefreshButton } from "../../../components/primitives/RefreshButton";
import { TablePagination } from "../../../components/primitives/TablePagination";
import { Icon } from "../../../components/primitives/Icon";
import { Spinner } from "../../../components/primitives/Spinner";
import { ConfirmDialog } from "../../userManagement/components/ConfirmDialog";
import { ConnectDialog } from "./ConnectDialog";
import {
  providerLabel,
  connectorFor,
  describeAiError,
  enabledProviders,
  formatAgo,
  formatDate,
  listedProviders,
} from "./aiHelpers";
import {
  ConnectorAuthBadge,
  ConnectorStatusBadge,
  ProviderCard,
  connectorAccountText,
} from "./ProviderCard";
import { ProviderLogo } from "./ProviderLogo";

function useConnectorActions() {
  const { apiBaseUrl, getToken, projectId, mergeConnectors, me } = useAiRuntime();
  const [connecting, setConnecting] = useState<AiProviderId | null>(null);
  const [disconnecting, setDisconnecting] = useState<AiProviderId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async (provider: AiProviderId) => {
    setBusy(true);
    setError(null);
    try {
      const connector = await logoutConnector(apiBaseUrl, await getToken(), projectId, provider);
      mergeConnectors([connector]);
      setDisconnecting(null);
    } catch (err) {
      setError(describeAiError(err, `Could not disconnect ${providerLabel(provider)}`));
      setDisconnecting(null);
    } finally {
      setBusy(false);
    }
  };

  let confirm = null;
  if (disconnecting) {
    const label = providerLabel(disconnecting);
    const email = connectorFor(me, disconnecting)?.account?.email;
    const who = email ? email : `your ${label} account`;
    confirm = (
      <ConfirmDialog
        title={`Disconnect ${label}?`}
        description={`This signs ${who} out of Pinnote. You'll need to sign in to ${label} again to use it here. Your past AI chats stay.`}
        confirmLabel="Disconnect"
        confirmIcon="logout"
        destructive
        busy={busy}
        onCancel={() => setDisconnecting(null)}
        onConfirm={() => void disconnect(disconnecting)}
      />
    );
  }

  const dialogs = (
    <>
      {connecting ? (
        <ConnectDialog
          provider={connecting}
          initialMethod={connectorFor(me, connecting)?.cliVersion ? undefined : "api_key"}
          onClose={() => setConnecting(null)}
        />
      ) : null}
      {confirm}
    </>
  );

  return {
    connect: (provider: AiProviderId) => setConnecting(provider),
    askDisconnect: (provider: AiProviderId) => setDisconnecting(provider),
    isBusy: (provider: AiProviderId): boolean => busy && disconnecting === provider,
    error,
    setError,
    dialogs,
  };
}

function LoadingOrError() {
  const { meError, enabled, projectId } = useAiRuntime();
  const pending = enabled && Boolean(projectId) && !meError;
  const showSkeleton = useSkeletonGate(pending);
  if (pending) {
    return showSkeleton ? (
      <div role="status" aria-label="Loading connectors" data-wpn-loading="skeleton">
        <ConnectorsSkeleton />
      </div>
    ) : (
      <div className="wpn-ai-connectors" aria-busy="true" style={{ minHeight: 240 }} />
    );
  }
  return (
    <div className="wpn-ai-connectors">
      <p className="wpn-ai-muted">{meError ?? "AI integrations are not available."}</p>
    </div>
  );
}

export function ConnectorsPanel() {
  const { me } = useAiRuntime();
  const actions = useConnectorActions();

  if (!me) return <LoadingOrError />;

  const enabled = enabledProviders(me);

  return (
    <div className="wpn-ai-connectors">
      <p className="wpn-ai-connectors__intro">
        Bring your own AI. Connect Claude, Codex or another agent with your own subscription or API
        key, and Pinnote's AI chat, editor suggestions and reply drafts run on your account.
      </p>
      {actions.error ? (
        <div className="wpn-ai-error" role="alert">
          {actions.error}
        </div>
      ) : null}
      <div className="wpn-ai-connectors__grid">
        {listedProviders(me).map((provider) => (
          <ProviderCard
            key={provider}
            provider={provider}
            connector={connectorFor(me, provider)}
            allowed={enabled.includes(provider)}
            busy={actions.isBusy(provider)}
            onConnect={() => actions.connect(provider)}
            onDisconnect={() => actions.askDisconnect(provider)}
          />
        ))}
      </div>
      {actions.dialogs}
    </div>
  );
}

export function connectionRows(connectors: readonly AiConnector[] | undefined): AiConnector[] {
  return (connectors ?? []).filter(
    (connector) =>
      connector.status === "connected" || (connector.status === "error" && connector.auth !== null),
  );
}

interface ConnectionsPanelProps {
  onGoToConnectors: () => void;
}

interface ConnectionTableProps {
  rows: AiConnector[];
  checking: AiProviderId | "all" | null;
  isBusy: (provider: AiProviderId) => boolean;
  onCheck: (provider: AiProviderId) => void;
  onReconnect: (provider: AiProviderId) => void;
  onDisconnect: (provider: AiProviderId) => void;
  empty: ReactNode;
  pagination: ReactNode;
}

const CONNECTION_COLUMNS = 8;

function ConnectionTable({
  rows,
  checking,
  isBusy,
  onCheck,
  onReconnect,
  onDisconnect,
  empty,
  pagination,
}: ConnectionTableProps) {
  return (
    <div className="wpn-table-card">
      <div className="wpn-users-table-wrap">
        <table className="wpn-users-table wpn-ai-connections__table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Signed in as</th>
              <th scope="col">Plan</th>
              <th scope="col">Method</th>
              <th scope="col">Connected since</th>
              <th scope="col">Last used</th>
              <th scope="col">Status</th>
              <th scope="col" className="wpn-users-table__actions-head">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={CONNECTION_COLUMNS} className="wpn-users-table__empty">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((connector) => {
                const provider = connector.provider;
                const label = providerLabel(provider);
                return (
                  <tr key={provider}>
                    <td>
                      <span className="wpn-ai-connections__agent">
                        <ProviderLogo provider={provider} size={28} />
                        <span className="wpn-ai-connections__name">{label}</span>
                      </span>
                    </td>
                    <td>{connectorAccountText(connector) ?? "—"}</td>
                    <td className="wpn-users-table__muted">{connector.account?.plan ?? "—"}</td>
                    <td>
                      <ConnectorAuthBadge auth={connector.auth} />
                    </td>
                    <td
                      className="wpn-users-table__muted"
                      title={
                        connector.connectedAt ? formatTimestamp(connector.connectedAt) : undefined
                      }
                    >
                      {formatDate(connector.connectedAt)}
                    </td>
                    <td
                      className="wpn-users-table__muted"
                      title={
                        connector.lastUsedAt ? formatTimestamp(connector.lastUsedAt) : undefined
                      }
                    >
                      {connector.lastUsedAt ? formatAgo(connector.lastUsedAt) : "Not yet"}
                    </td>
                    <td title={connector.error ?? undefined}>
                      <ConnectorStatusBadge status={connector.status} />
                    </td>
                    <td className="wpn-users-table__version-settings-cell">
                      <span className="wpn-ai-connections__actions">
                        <button
                          type="button"
                          className="wpn-btn wpn-btn--ghost wpn-ai-connections__btn"
                          aria-label={`Check ${label} now`}
                          disabled={checking !== null}
                          onClick={() => onCheck(provider)}
                        >
                          {checking === provider || checking === "all" ? (
                            <Spinner />
                          ) : (
                            <Icon name="refresh" className="wpn-btn__icon" />
                          )}
                          Check
                        </button>
                        <button
                          type="button"
                          className="wpn-btn wpn-btn--ghost wpn-ai-connections__btn"
                          aria-label={`Reconnect ${label}`}
                          onClick={() => onReconnect(provider)}
                        >
                          <Icon name="plug" className="wpn-btn__icon" />
                          Reconnect
                        </button>
                        <button
                          type="button"
                          className="wpn-btn wpn-btn--ghost wpn-ai-connections__btn wpn-ai-connections__btn--danger"
                          aria-label={`Disconnect ${label}`}
                          disabled={isBusy(provider)}
                          onClick={() => onDisconnect(provider)}
                        >
                          <Icon name="logout" className="wpn-btn__icon" />
                          Disconnect
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}

export function ConnectionsPanel({ onGoToConnectors }: ConnectionsPanelProps) {
  const { me, apiBaseUrl, getToken, projectId, mergeConnectors } = useAiRuntime();
  const actions = useConnectorActions();
  const [checking, setChecking] = useState<AiProviderId | "all" | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const allRows = connectionRows(me?.connectors);
  const needle = searchQuery.trim().toLowerCase();
  const rows = needle
    ? allRows.filter((connector) =>
        [
          providerLabel(connector.provider),
          connectorAccountText(connector),
          connector.account?.plan,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : allRows;
  const { pageItems, paginationProps } = useClientPagination(rows);

  if (!me) return <LoadingOrError />;

  const checkNow = async (provider: AiProviderId | "all") => {
    setChecking(provider);
    actions.setError(null);
    try {
      const fresh = await fetchAiConnectors(apiBaseUrl, await getToken(), projectId, true);
      mergeConnectors(fresh);
    } catch (err) {
      actions.setError(describeAiError(err, "Could not check the connection"));
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="wpn-ai-connections wpn-settings-tab">
      <ListSearchBar
        value={searchInput}
        onValueChange={setSearchInput}
        onSubmit={() => setSearchQuery(searchInput)}
        onClear={() => {
          setSearchInput("");
          setSearchQuery("");
        }}
        placeholder="Search agent, account or plan"
        trailing={
          <RefreshButton
            label="Check all connections"
            loading={checking !== null}
            onRefresh={() => void checkNow("all")}
          />
        }
      />
      {actions.error ? (
        <div className="wpn-ai-error" role="alert">
          {actions.error}
        </div>
      ) : null}
      <ConnectionTable
        rows={pageItems}
        checking={checking}
        isBusy={actions.isBusy}
        onCheck={(provider) => void checkNow(provider)}
        onReconnect={actions.connect}
        onDisconnect={actions.askDisconnect}
        pagination={<TablePagination {...paginationProps} itemLabel="connections" />}
        empty={
          needle ? (
            <>
              <Icon name="search" className="wpn-users-table__empty-icon" />
              <span>No connections match your search</span>
            </>
          ) : (
            <>
              <Icon name="plug" className="wpn-users-table__empty-icon" />
              <span>You haven't connected an agent yet</span>
              <button type="button" className="wpn-btn wpn-btn--primary" onClick={onGoToConnectors}>
                <Icon name="sparkles" className="wpn-btn__icon" />
                Go to Connectors
              </button>
            </>
          )
        }
      />
      {actions.dialogs}
    </div>
  );
}
