import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { getInitials } from "../../utils/format";
import { Icon, SearchableSelect, Tooltip, type SelectOption } from "../primitives";
import { LoginDialog } from "./LoginDialog";
import type { LoginOption } from "../../types/auth.types";

export function ToolbarAuthControl() {
  const {
    config,
    accounts,
    activeAccount,
    hostAuthenticated,
    loginOptions,
    loginOptionsLoading,
    loginOptionsError,
    reloadLoginOptions,
    login,
    logout,
    switchAccount,
    revokeError,
    clearRevokeError,
  } = useAnnotationContext();

  const [pendingUser, setPendingUser] = useState<LoginOption | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const closeSwitcher = () => {
    setSwitcherOpen(false);
    triggerRef.current?.focus();
  };

  useEscapeKey(closeSwitcher, switcherOpen);

  useEffect(() => {
    if (!switcherOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [switcherOpen]);

  useEffect(() => {
    if (!switcherOpen) {
      clearRevokeError();
    }
  }, [switcherOpen, clearRevokeError]);

  const loggedInIds = useMemo(() => new Set(accounts.map((item) => item.id)), [accounts]);

  const selectOptions = useMemo<SelectOption[]>(
    () =>
      loginOptions
        .filter((option) => !loggedInIds.has(option.id))
        .map((option) => ({
          value: option.id,
          label: option.name,
        })),
    [loginOptions, loggedInIds],
  );

  const picker = (
    <SearchableSelect
      options={selectOptions}
      value=""
      onChange={(userId) => {
        const option = loginOptions.find((item) => item.id === userId);
        if (option) {
          setPendingUser(option);
        }
      }}
      placeholder={loginOptionsLoading ? "Loading users..." : "Select your name"}
      searchPlaceholder="Search users"
      ariaLabel="Select user to log in"
    />
  );

  const dialog = pendingUser
    ? createPortal(
        <div className="wpn-root wpn-login-portal" style={{ zIndex: config.zIndex }}>
          <LoginDialog
            user={pendingUser}
            onCancel={() => setPendingUser(null)}
            onSubmit={async (password) => {
              await login(pendingUser.id, password);
              setPendingUser(null);
              setAddingAccount(false);
              setSwitcherOpen(false);
            }}
          />
        </div>,
        document.body,
      )
    : null;

  if (hostAuthenticated) {
    return null;
  }

  if (!activeAccount) {
    return (
      <span className="wpn-toolbar__auth">
        {loginOptionsError ? (
          <Tooltip label={loginOptionsError} placement="bottom">
            <button type="button" className="wpn-toolbar__auth-retry" onClick={reloadLoginOptions}>
              <Icon name="refresh" className="wpn-toolbar__auth-retry-icon" />
              Retry
            </button>
          </Tooltip>
        ) : (
          picker
        )}
        {dialog}
      </span>
    );
  }

  return (
    <span className="wpn-toolbar__auth" ref={switcherRef}>
      <button
        ref={triggerRef}
        type="button"
        className="wpn-toolbar__account"
        aria-haspopup="true"
        aria-expanded={switcherOpen}
        aria-controls={switcherOpen ? menuId : undefined}
        aria-label={`Signed in as ${activeAccount.name}`}
        onClick={() => setSwitcherOpen((open) => !open)}
      >
        <span className="wpn-avatar wpn-avatar--fallback wpn-toolbar__account-avatar">
          {getInitials(activeAccount.name)}
        </span>
        <span className="wpn-toolbar__account-name">{activeAccount.name}</span>
        {accounts.length > 1 ? (
          <span className="wpn-toolbar__account-count">{accounts.length}</span>
        ) : null}
        <svg viewBox="0 0 16 16" className="wpn-toolbar__account-chevron" aria-hidden="true">
          <path fill="currentColor" d="M4.2 6.2 8 10l3.8-3.8L13 7.4 8 12.4 3 7.4z" />
        </svg>
      </button>

      {switcherOpen ? (
        <div id={menuId} className="wpn-account-menu">
          <span className="wpn-account-menu__label">Signed in</span>
          {revokeError ? (
            <span className="wpn-account-menu__error" role="alert">
              {revokeError}
            </span>
          ) : null}
          {accounts.map((account) => (
            <div
              key={account.id}
              className={[
                "wpn-account-menu__row",
                account.id === activeAccount.id ? "wpn-account-menu__row--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="wpn-account-menu__pick"
                onClick={() => {
                  switchAccount(account.id);
                  setSwitcherOpen(false);
                }}
              >
                <span className="wpn-avatar wpn-avatar--fallback wpn-account-menu__avatar">
                  {getInitials(account.name)}
                </span>
                <span className="wpn-account-menu__copy">
                  <span className="wpn-account-menu__name">{account.name}</span>
                  <span className="wpn-account-menu__email">{account.email}</span>
                </span>
                {account.id === activeAccount.id ? (
                  <Icon name="check" className="wpn-account-menu__check" />
                ) : null}
              </button>
              <Tooltip label="Log out" placement="left">
                <button
                  type="button"
                  className="wpn-account-menu__logout"
                  aria-label={`Log out ${account.name}`}
                  onClick={() => {
                    logout(account.id).catch(() => undefined);
                  }}
                >
                  <Icon name="close" />
                </button>
              </Tooltip>
            </div>
          ))}

          <div className="wpn-account-menu__footer">
            {addingAccount ? (
              picker
            ) : (
              <button
                type="button"
                className="wpn-account-menu__add"
                onClick={() => setAddingAccount(true)}
              >
                <Icon name="plus" className="wpn-account-menu__add-icon" />
                Add another account
              </button>
            )}
          </div>
        </div>
      ) : null}
      {dialog}
    </span>
  );
}
