import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { getProvider } from "../../ai/providerRegistry";
import type { AiConnector, AiConnectorAuth, AiProviderId } from "../../types/ai.types";
import { Icon, ModalShell, Spinner, Tooltip } from "../primitives";
import { formatCountdown, providerLabel, providerSignInLabel } from "./aiHelpers";
import { ProviderLogo } from "./ProviderLogo";
import { useConnectorLogin } from "./useConnectorLogin";
import { useAiDefaults, useCopy, useCountdown } from "./useAiPreferences";

export type ConnectMethod = "subscription" | "api_key";

export interface ConnectDialogProps {
  provider: AiProviderId;
  initialMethod?: ConnectMethod;
  onClose: () => void;
  onConnected?: (connector: AiConnector) => void;
}

const EXPIRY_WARN_MS = 2 * 60 * 1000;

function authText(auth: AiConnectorAuth): string {
  return auth === "api_key" ? "an API key" : "a subscription";
}

function openInNewTab(url: string): void {
  if (typeof window === "undefined") return;
  try {
    const tab = window.open(url, "_blank");
    if (tab) tab.opener = null;
  } catch {
    return;
  }
}

async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === "undefined") return null;
  const clipboard = navigator.clipboard;
  if (!clipboard || typeof clipboard.readText !== "function") return null;
  try {
    return await clipboard.readText();
  } catch {
    return null;
  }
}

function AccountLine({ connector, prefix }: { connector: AiConnector | null; prefix: string }) {
  const account = connector?.account;
  if (!account?.email) return <>{`Connected with ${authText(connector?.auth ?? null)}.`}</>;
  return (
    <>
      {prefix} <strong>{account.email}</strong>
      {account.plan ? <span className="wpn-ai-muted"> · {account.plan}</span> : null}
    </>
  );
}

function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

type StepState = "todo" | "active" | "done";

function Step({
  index,
  state,
  title,
  description,
  last = false,
  children,
}: {
  index: number;
  state: StepState;
  title: string;
  description?: ReactNode;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li
      className={cx("wpn-ai-step", `wpn-ai-step--${state}`, last && "wpn-ai-step--last")}
      aria-current={state === "active" ? "step" : undefined}
    >
      <span className="wpn-ai-step__marker" aria-hidden="true">
        {state === "done" ? <Icon name="check" /> : index}
      </span>
      <div className="wpn-ai-step__content">
        <p className="wpn-ai-step__title">
          {title}
          {state === "done" ? <span className="wpn-sr-only"> (done)</span> : null}
        </p>
        {description ? <p className="wpn-ai-step__desc">{description}</p> : null}
        {children}
      </div>
    </li>
  );
}

function ExpiryChip({
  expiresAt,
  onRenew,
}: {
  expiresAt: string | null | undefined;
  onRenew?: () => void;
}) {
  const msLeft = useCountdown(expiresAt);
  if (msLeft === null) return null;
  if (msLeft <= 0) {
    return (
      <span className="wpn-ai-connect__expiry wpn-ai-connect__expiry--expired">
        <span className="wpn-ai-connect__expiry-chip">
          <Icon name="alert" />
          Link expired
        </span>
        {onRenew ? (
          <button type="button" className="wpn-ai-link" onClick={onRenew}>
            Get a new link
          </button>
        ) : null}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "wpn-ai-connect__expiry",
        msLeft < EXPIRY_WARN_MS && "wpn-ai-connect__expiry--soon",
      )}
    >
      <span className="wpn-ai-connect__expiry-chip">
        <Icon name="history" />
        Link expires in {formatCountdown(msLeft)}
      </span>
    </span>
  );
}

function useExpired(expiresAt: string | null | undefined): boolean {
  const msLeft = useCountdown(expiresAt);
  return msLeft !== null && msLeft <= 0;
}

export function ConnectDialog({
  provider,
  initialMethod,
  onClose,
  onConnected,
}: ConnectDialogProps) {
  const label = providerLabel(provider);
  const signInLabel = providerSignInLabel(provider);
  const descriptor = getProvider(provider);
  const [method, setMethod] = useState<ConnectMethod>(initialMethod ?? "subscription");
  const flow = useConnectorLogin(provider);
  const { phase, login, connector, error, start, cancel } = flow;
  const [, setDefaults] = useAiDefaults();
  const [code, setCode] = useState("");
  const [codeHint, setCodeHint] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keyHint, setKeyHint] = useState(false);
  const [revealKey, setRevealKey] = useState(false);
  const [opened, setOpened] = useState(false);
  const [copied, copy] = useCopy();
  const ids = { code: useId(), key: useId(), form: useId(), codeHelp: useId(), keyHelp: useId() };
  const methodRef = useRef<HTMLButtonElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const connected = phase === "connected";
  const verifying = phase === "verifying";
  const starting = phase === "starting";
  const busy = starting || verifying;
  const deviceFlow = login
    ? login.method !== "link_paste"
    : (descriptor?.auth.subscription?.method ?? "link_paste") !== "link_paste";
  const linkExpired = useExpired(login?.needsCode ? login.expiresAt : null);

  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  useEffect(() => {
    if (!connected || !connector) return;
    setDefaults({ provider: connector.provider, model: null, effort: null });
    onConnectedRef.current?.(connector);
  }, [connected, connector, setDefaults]);

  const wantsLogin = method === "subscription";
  const closingRef = useRef(false);
  useEffect(() => {
    if (wantsLogin && phase === "idle" && !closingRef.current) {
      setOpened(false);
      void start();
    }
  }, [wantsLogin, phase, start]);

  useEffect(() => {
    if (connected) doneRef.current?.focus();
  }, [connected]);

  const close = useCallback(() => {
    closingRef.current = true;
    cancel();
    onClose();
  }, [cancel, onClose]);

  const switchMethod = (next: ConnectMethod) => {
    if (next === method || verifying) return;
    cancel();
    setOpened(false);
    setMethod(next);
    if (next === "api_key") requestAnimationFrame(() => keyRef.current?.focus());
  };

  const openSignIn = () => {
    if (!login?.url) return;
    openInNewTab(login.url);
    setOpened(true);
  };

  const renewLink = () => {
    setCode("");
    setOpened(false);
    void start();
  };

  const pasteFromClipboard = async () => {
    const text = (await readClipboardText())?.trim();
    if (text) {
      setCode(text);
      setCodeHint(false);
    }
    codeRef.current?.focus();
  };

  const canSubmitCode = Boolean(login?.needsCode) && code.trim() !== "" && !linkExpired;
  const submitCode = () => {
    if (busy || !login?.needsCode || linkExpired) return;
    if (!code.trim()) {
      setCodeHint(true);
      codeRef.current?.focus();
      return;
    }
    void flow.submitCode(code);
  };

  const submitKey = () => {
    if (busy) return;
    if (!apiKey.trim()) {
      setKeyHint(true);
      keyRef.current?.focus();
      return;
    }
    void flow.saveApiKey(apiKey);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (method === "api_key") submitKey();
    else submitCode();
  };

  const retry = () => {
    if (method === "api_key") {
      submitKey();
    } else if (phase === "failed") {
      setOpened(false);
      void start();
    } else {
      submitCode();
    }
  };

  let liveText = "";
  if (connected) liveText = `${label} is connected.`;
  else if (verifying) liveText = method === "api_key" ? "Checking your key…" : "Connecting…";
  else if (starting) liveText = "Getting a sign-in link…";
  else if (phase === "waiting" && deviceFlow)
    liveText = `Waiting for you to approve in ${signInLabel}.`;
  else if (phase === "waiting" && opened) liveText = "Waiting for you to authorize.";

  const showError = error && !(method === "subscription" && login?.needsCode && linkExpired);
  const errorBox = showError ? (
    <div className="wpn-ai-connect__alert" role="alert">
      <Icon name="alert" className="wpn-ai-connect__alert-icon" />
      <div className="wpn-ai-connect__alert-text">
        <strong>{phase === "failed" ? "That didn't work" : "Check that and try again"}</strong>
        <span>{error}</span>
      </div>
      <button
        type="button"
        className="wpn-btn wpn-btn--ghost wpn-ai-connect__retry"
        onClick={retry}
      >
        <Icon name="refresh" className="wpn-btn__icon" />
        Try again
      </button>
    </div>
  ) : null;

  let body: ReactNode;
  let footerMeta: ReactNode = null;
  let primary: ReactNode = null;

  if (connected) {
    body = (
      <div className="wpn-ai-connect__success wpn-ai-connect__success--animate">
        <span className="wpn-ai-connect__success-icon" aria-hidden="true">
          <span className="wpn-ai-connect__success-ring" />
          <Icon name="check" />
        </span>
        <p className="wpn-ai-connect__success-title">{label} is connected</p>
        <p className="wpn-ai-connect__success-account">
          <AccountLine connector={connector} prefix="Signed in as" />
        </p>
        <p className="wpn-ai-muted wpn-ai-connect__success-note">
          {label} is now your default model for Pinnote's AI chat and editors.
        </p>
      </div>
    );
    primary = (
      <button ref={doneRef} type="button" className="wpn-btn wpn-btn--primary" onClick={onClose}>
        Done
      </button>
    );
  } else if (method === "api_key") {
    const key = descriptor?.auth.apiKey ?? {
      name: "API key",
      placeholder: "",
      host: "",
      url: "",
    };
    const empty = !apiKey.trim();
    body = (
      <form id={ids.form} className="wpn-ai-connect__form" onSubmit={submit} noValidate>
        <label className="wpn-ai-connect__label" htmlFor={ids.key}>
          {key.name}
        </label>
        <div className="wpn-ai-connect__field">
          <input
            ref={keyRef}
            id={ids.key}
            className="wpn-ai-connect__input wpn-ai-connect__input--mono"
            type={revealKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder={key.placeholder}
            value={apiKey}
            readOnly={verifying}
            aria-describedby={ids.keyHelp}
            aria-invalid={keyHint && empty ? true : undefined}
            onChange={(event) => {
              setApiKey(event.target.value);
              setKeyHint(false);
            }}
          />
          <Tooltip label={revealKey ? "Hide key" : "Show key"} placement="top">
            <button
              type="button"
              className="wpn-ai-connect__field-btn"
              aria-label={revealKey ? "Hide key" : "Show key"}
              aria-pressed={revealKey}
              onClick={() => setRevealKey((value) => !value)}
            >
              <Icon name={revealKey ? "eyeOff" : "eye"} />
            </button>
          </Tooltip>
        </div>
        <p id={ids.keyHelp} className="wpn-ai-connect__help">
          {keyHint && empty ? (
            <span className="wpn-ai-connect__help--warn">Paste your key to continue.</span>
          ) : (
            <>
              Create one at{" "}
              <a href={key.url} target="_blank" rel="noopener noreferrer" className="wpn-ai-link">
                {key.host}
              </a>
              . Stored on the Pinnote server and used only to run {label} for you.
            </>
          )}
        </p>
        {verifying ? (
          <p className="wpn-ai-connect__progress">
            <Spinner /> Checking your key…
          </p>
        ) : null}
      </form>
    );
    primary = (
      <DisabledHint show={empty && !verifying} hint="Paste your API key first">
        <button
          type="submit"
          form={ids.form}
          className={cx("wpn-btn wpn-btn--primary", empty && "wpn-btn--inert")}
          aria-disabled={empty || verifying ? true : undefined}
          disabled={verifying}
        >
          {verifying ? <Spinner /> : null}
          {verifying ? "Connecting…" : "Save and connect"}
        </button>
      </DisabledHint>
    );
  } else if (!deviceFlow) {
    const linkReady = Boolean(login?.url) && !starting;
    const hasCode = code.trim() !== "";
    const step1: StepState = opened || hasCode ? "done" : "active";
    const step2: StepState = hasCode ? "done" : opened ? "active" : "todo";
    const step3: StepState = hasCode || verifying ? "active" : "todo";
    body = (
      <form id={ids.form} className="wpn-ai-connect__form" onSubmit={submit} noValidate>
        <ol className="wpn-ai-steps wpn-ai-tracker">
          <Step
            index={1}
            state={step1}
            title={`Open ${label} sign-in`}
            description="It opens in a new tab. Sign in and click Authorize."
          >
            {opened ? (
              <p className="wpn-ai-step__ok">
                <Icon name="check" />
                Opened in a new tab
                <button
                  type="button"
                  className="wpn-ai-link"
                  disabled={!linkReady || linkExpired}
                  onClick={openSignIn}
                >
                  Open again
                </button>
              </p>
            ) : (
              <button
                type="button"
                className="wpn-btn wpn-btn--primary wpn-ai-step__cta"
                disabled={!linkReady || linkExpired}
                onClick={openSignIn}
              >
                {starting ? <Spinner /> : null}
                {starting ? "Getting your sign-in link…" : `Open ${label} sign-in`}
                {starting ? null : <Icon name="arrowUpRight" className="wpn-btn__icon" />}
              </button>
            )}
          </Step>
          <Step
            index={2}
            state={step2}
            title={`Copy the code ${label} shows you`}
            description="It includes everything after #."
          />
          <Step index={3} state={step3} title="Paste it here" last>
            <div className="wpn-ai-connect__field wpn-ai-connect__field--code">
              <label className="wpn-sr-only" htmlFor={ids.code}>
                Code from {label}
              </label>
              <input
                ref={codeRef}
                id={ids.code}
                className="wpn-ai-connect__input wpn-ai-connect__input--mono"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Paste the code here"
                value={code}
                readOnly={verifying}
                aria-describedby={ids.codeHelp}
                aria-invalid={codeHint && !hasCode ? true : undefined}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeHint(false);
                }}
              />
              <button
                type="button"
                className="wpn-ai-connect__field-btn"
                disabled={verifying || linkExpired}
                onClick={() => void pasteFromClipboard()}
              >
                <Icon name="copy" />
                Paste
              </button>
            </div>
            <p id={ids.codeHelp} className="wpn-ai-connect__help">
              {codeHint && !hasCode ? (
                <span className="wpn-ai-connect__help--warn">
                  Paste the code from {label} to continue.
                </span>
              ) : (
                "Includes everything after #"
              )}
            </p>
            {verifying ? (
              <p className="wpn-ai-connect__progress">
                <Spinner /> Connecting…
              </p>
            ) : null}
          </Step>
        </ol>
      </form>
    );
    footerMeta = login ? <ExpiryChip expiresAt={login.expiresAt} onRenew={renewLink} /> : null;
    const why = linkExpired
      ? "The sign-in link expired. Get a new link first."
      : `Paste the code from ${label} first`;
    primary =
      phase === "failed" && !linkExpired ? null : (
        <DisabledHint show={!canSubmitCode && !verifying} hint={why}>
          <button
            type="submit"
            form={ids.form}
            className={cx("wpn-btn wpn-btn--primary", !canSubmitCode && "wpn-btn--inert")}
            aria-disabled={!canSubmitCode || verifying ? true : undefined}
            disabled={verifying}
          >
            {verifying ? <Spinner /> : null}
            {verifying ? "Connecting…" : "Connect"}
          </button>
        </DisabledHint>
      );
  } else {
    const browserFlow = login?.method === "browser";
    const ready = Boolean(browserFlow ? login?.url : login?.userCode) && !starting;
    const waiting = (phase === "waiting" || verifying) && ready;
    body = browserFlow ? (
      <ol className="wpn-ai-steps wpn-ai-tracker">
        <Step
          index={1}
          state={!ready ? "active" : opened ? "done" : "active"}
          title={`Sign in with ${signInLabel}`}
          description={`Sign in with the ${signInLabel} account you want Pinnote to use.`}
        >
          <button
            type="button"
            className={cx(
              "wpn-btn wpn-ai-step__cta",
              opened ? "wpn-btn--ghost" : "wpn-btn--primary",
            )}
            disabled={!ready}
            onClick={openSignIn}
          >
            {starting ? <Spinner /> : null}
            {opened
              ? `Open ${signInLabel} again`
              : starting
                ? "Getting your sign-in link…"
                : `Open ${signInLabel}`}
            <Icon name="arrowUpRight" className="wpn-btn__icon" />
          </button>
        </Step>
        <Step index={2} state={waiting && opened ? "active" : "todo"} title="Approve access" last>
          {waiting && opened ? (
            <div className="wpn-ai-connect__waiting wpn-ai-authwait">
              <span className="wpn-ai-authwait__dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <div>
                <p>
                  {verifying
                    ? "Approved. Finishing up…"
                    : `Waiting for you to approve in ${signInLabel}…`}
                </p>
                <p className="wpn-ai-muted">
                  This finishes by itself once {signInLabel} sends you back. Keep this window open.
                </p>
              </div>
            </div>
          ) : null}
        </Step>
      </ol>
    ) : (
      <>
        <ol className="wpn-ai-steps wpn-ai-tracker">
          <Step
            index={1}
            state={ready ? "done" : "active"}
            title="Your one-time code"
            description={copied ? "Copied to your clipboard." : undefined}
          >
            <div className="wpn-ai-connect__code-row">
              {ready ? (
                <code className="wpn-ai-connect__code" aria-label="One-time code">
                  {login?.userCode}
                </code>
              ) : (
                <span className="wpn-ai-connect__code wpn-ai-connect__code--loading">
                  {starting ? (
                    <>
                      <Spinner /> Getting your code…
                    </>
                  ) : (
                    "No code yet"
                  )}
                </span>
              )}
              <button
                type="button"
                className="wpn-btn wpn-btn--ghost wpn-ai-connect__copy"
                aria-label="Copy code"
                disabled={!ready}
                onClick={() => copy(login?.userCode ?? "")}
              >
                <Icon name={copied ? "check" : "copy"} className="wpn-btn__icon" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </Step>
          <Step
            index={2}
            state={!ready ? "todo" : opened ? "done" : "active"}
            title={`Paste it in ${signInLabel}`}
            description={`Sign in with the ${signInLabel} account you want Pinnote to use.`}
          >
            <button
              type="button"
              className={cx(
                "wpn-btn wpn-ai-step__cta",
                opened ? "wpn-btn--ghost" : "wpn-btn--primary",
              )}
              disabled={!ready}
              onClick={openSignIn}
            >
              {opened ? `Open ${signInLabel} again` : `Open ${signInLabel}`}
              <Icon name="arrowUpRight" className="wpn-btn__icon" />
            </button>
          </Step>
          <Step index={3} state={waiting ? "active" : "todo"} title="Approve access" last>
            {waiting ? (
              <div className="wpn-ai-connect__waiting wpn-ai-authwait">
                <span className="wpn-ai-authwait__dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <div>
                  <p>
                    {verifying
                      ? "Approved. Finishing up…"
                      : `Waiting for you to approve in ${signInLabel}…`}
                  </p>
                  <p className="wpn-ai-muted">This finishes by itself. Keep this window open.</p>
                </div>
              </div>
            ) : null}
          </Step>
        </ol>
        {opened && descriptor?.auth.subscription?.deviceHelp ? (
          <div className="wpn-ai-connect__help" role="note">
            <strong>{descriptor.auth.subscription.deviceHelp.heading}</strong>
            <p>
              Turn on device code authorization for {label} in{" "}
              <a
                href={descriptor.auth.subscription.deviceHelp.settingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="wpn-ai-link"
              >
                {descriptor.auth.subscription.deviceHelp.settingsLabel}
              </a>
              , then click &quot;Open {signInLabel} again&quot;. On a Team or Enterprise plan, a
              workspace admin has to switch it on.
            </p>
            <button type="button" className="wpn-ai-link" onClick={() => switchMethod("api_key")}>
              {descriptor.auth.subscription.deviceHelp.toggleLabel}
            </button>
          </div>
        ) : null}
      </>
    );
    footerMeta = login && waiting ? <ExpiryChip expiresAt={login.expiresAt} /> : null;
  }

  return (
    <ModalShell
      title={`Connect ${label}`}
      subtitle="Only you will use this connection"
      leading={<ProviderLogo provider={provider} size={40} />}
      onClose={close}
      initialFocusRef={methodRef}
      className="wpn-ai-modal wpn-ai-connect"
      footer={
        <>
          {footerMeta ? <div className="wpn-ai-connect__footer-meta">{footerMeta}</div> : null}
          <div className="wpn-ai-connect__footer-actions">
            {connected ? null : (
              <button type="button" className="wpn-btn wpn-btn--ghost" onClick={close}>
                Cancel
              </button>
            )}
            {primary}
          </div>
        </>
      }
    >
      <p className="wpn-sr-only" role="status" aria-live="polite">
        {liveText}
      </p>
      {connected ? null : (
        <div className="wpn-ai-connect__methods" role="radiogroup" aria-label="How to connect">
          {(["subscription", "api_key"] as const).map((value) => {
            const copyText = (value === "subscription"
              ? descriptor?.auth.subscription
              : descriptor?.auth.apiKey) ?? {
              title: "API key",
              description: "",
              icon: "key" as const,
            };
            const on = method === value;
            return (
              <button
                key={value}
                ref={on ? methodRef : undefined}
                type="button"
                role="radio"
                aria-checked={on}
                className={cx("wpn-ai-method", on && "wpn-ai-method--on")}
                disabled={verifying && !on}
                onClick={() => switchMethod(value)}
              >
                <span className="wpn-ai-method__icon" aria-hidden="true">
                  <Icon name={copyText.icon} />
                </span>
                <span className="wpn-ai-method__text">
                  <span className="wpn-ai-method__title">{copyText.title}</span>
                  <span className="wpn-ai-method__desc">{copyText.description}</span>
                </span>
                <span className="wpn-ai-method__radio" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      {errorBox}
      <div className="wpn-ai-connect__body">{body}</div>
    </ModalShell>
  );
}

function DisabledHint({
  show,
  hint,
  children,
}: {
  show: boolean;
  hint: string;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  if (!show) return children;
  return (
    <Tooltip label={hint} placement="top">
      {children}
    </Tooltip>
  );
}
