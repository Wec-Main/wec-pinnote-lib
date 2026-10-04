import type {
  AiConnector,
  AiConnectorAuth,
  AiConnectorStatus,
  AiProviderId,
} from "../../../types/ai.types";
import { Icon } from "../../../components/primitives/Icon";
import { Spinner } from "../../../components/primitives/Spinner";
import { isConnected, providerDescription, providerLabel } from "./aiHelpers";
import { ProviderLogo } from "./ProviderLogo";

const STATUS_LABELS: Record<AiConnectorStatus, string> = {
  connected: "Connected",
  signed_out: "Not connected",
  not_installed: "Not connected",
  error: "Needs attention",
};

export function connectorStatusLabel(status: AiConnectorStatus): string {
  return STATUS_LABELS[status] ?? "Not connected";
}

export function ConnectorStatusBadge({ status }: { status: AiConnectorStatus }) {
  return (
    <span className={`wpn-ai-status wpn-ai-status--${status}`}>
      <span className="wpn-ai-status__dot" aria-hidden="true" />
      {connectorStatusLabel(status)}
    </span>
  );
}

export function ConnectorAuthBadge({ auth }: { auth: AiConnectorAuth }) {
  if (!auth) return <span className="wpn-ai-muted">—</span>;
  return (
    <span className={`wpn-ai-auth-badge wpn-ai-auth-badge--${auth}`}>
      <Icon name={auth === "api_key" ? "key" : "users"} />
      {auth === "api_key" ? "API key" : "Subscription"}
    </span>
  );
}

export function connectorAccountText(connector: AiConnector | null): string | null {
  if (!connector) return null;
  if (connector.account?.email) return connector.account.email;
  if (connector.auth === "api_key") return "Your API key";
  return null;
}

export function usageText(personal: AiConnector | null): {
  tone: "user" | "none";
  text: string;
} {
  return isConnected(personal)
    ? { tone: "user", text: "Using your account" }
    : { tone: "none", text: "Not connected" };
}

export interface ProviderCardProps {
  provider: AiProviderId;
  connector: AiConnector | null;
  allowed: boolean;
  busy?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

function AccountLine({ connector }: { connector: AiConnector }) {
  const account = connectorAccountText(connector);
  return (
    <span className="wpn-ai-provider__who">
      {account ? <strong>{account}</strong> : "Connected"}
      {connector.account?.plan ? (
        <span className="wpn-ai-muted"> · {connector.account.plan}</span>
      ) : null}
    </span>
  );
}

export function ProviderCard({
  provider,
  connector,
  allowed,
  busy = false,
  onConnect,
  onDisconnect,
}: ProviderCardProps) {
  const label = providerLabel(provider);
  const personalStatus: AiConnectorStatus = connector?.status ?? "signed_out";
  const personalOn = personalStatus === "connected";
  const usage = usageText(connector);
  const status = personalStatus;

  if (!allowed) {
    return (
      <article
        className="wpn-ai-provider wpn-ai-provider--disabled"
        aria-label={`${label}: Turned off`}
      >
        <div className="wpn-ai-provider__top">
          <ProviderLogo provider={provider} size={40} />
          <div className="wpn-ai-provider__title">
            <span className="wpn-ai-provider__name">{label}</span>
            <span className="wpn-ai-provider__tagline">{providerDescription(provider)}</span>
          </div>
        </div>
        <div className="wpn-ai-provider__body">
          <p className="wpn-ai-provider__hint">Not enabled on this Pinnote server.</p>
        </div>
      </article>
    );
  }

  let personal;
  if (personalOn && connector) {
    personal = (
      <div className="wpn-ai-provider__row">
        <div className="wpn-ai-provider__row-text">
          <span className="wpn-ai-provider__row-label">Your account</span>
          <AccountLine connector={connector} />
        </div>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost wpn-ai-provider__action"
          disabled={busy}
          aria-label={`Disconnect ${label}`}
          onClick={onDisconnect}
        >
          {busy ? <Spinner /> : <Icon name="logout" className="wpn-btn__icon" />}
          Disconnect
        </button>
      </div>
    );
  } else {
    const failed = personalStatus === "error";
    const notInstalled = personalStatus === "not_installed";
    personal = (
      <div className="wpn-ai-provider__row">
        <div className="wpn-ai-provider__row-text">
          <span className="wpn-ai-provider__row-label">Your account</span>
          {failed ? (
            <span className="wpn-ai-provider__error">
              {connector?.error ?? `${label} stopped working. Connect it again.`}
            </span>
          ) : notInstalled ? (
            <span className="wpn-ai-provider__hint">
              {label}'s subscription sign-in isn't set up on this server. Connect with your own API
              key instead.
            </span>
          ) : (
            <span className="wpn-ai-provider__hint">Use your own subscription or an API key.</span>
          )}
        </div>
        <button
          type="button"
          className="wpn-btn wpn-btn--primary wpn-ai-provider__action"
          aria-label={`${failed ? "Reconnect" : "Connect"} ${label}`}
          onClick={onConnect}
        >
          <Icon name="plug" className="wpn-btn__icon" />
          {failed ? "Reconnect" : "Connect"}
        </button>
      </div>
    );
  }

  return (
    <article
      className={`wpn-ai-provider wpn-ai-provider--${status}`}
      aria-label={`${label}: ${usage.text}`}
    >
      <div className="wpn-ai-provider__top">
        <ProviderLogo provider={provider} size={40} />
        <div className="wpn-ai-provider__title">
          <span className="wpn-ai-provider__name">{label}</span>
          <span className="wpn-ai-provider__tagline">{providerDescription(provider)}</span>
        </div>
        <ConnectorStatusBadge status={status} />
      </div>
      <div className="wpn-ai-provider__body">
        <p className={`wpn-ai-provider__usage wpn-ai-provider__usage--${usage.tone}`}>
          <Icon
            name={usage.tone === "user" ? "check" : "info"}
            className="wpn-ai-provider__usage-icon"
          />
          <span>{usage.text}</span>
        </p>
        {personal}
      </div>
    </article>
  );
}
