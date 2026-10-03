import type { AuthSession } from "../types/auth.types";

export interface StoredAuthRecord {
  accounts: AuthSession[];
  activeId: string | null;
}

// Single seam for persisting auth sessions (bearer token + refresh token)
// across reloads. Everything that reads or writes a session on disk goes
// through this module, so that storage can be swapped out later without
// touching call sites.
//
// Current tradeoff: this stores plain JSON in window.localStorage, which is
// readable by any script able to execute on this origin — an injected
// script, a third-party script, or an XSS payload. It protects against
// losing the session on a reload, not against a compromised page.
// In-browser encryption was deliberately not added here: an attacker who
// can read localStorage from this origin can equally read whatever key this
// code would use to decrypt it, so encryption would only obscure the risk,
// not reduce it.
//
// A future hardening pass would replace this module's body with a
// server-issued httpOnly, Secure, SameSite cookie (so the token never
// touches JS-readable storage) plus a short-lived in-memory token for
// requests — that needs coordinated API changes this library doesn't
// control, so it's out of scope here.
export const tokenStorage = {
  read(key: string): StoredAuthRecord | null {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as StoredAuthRecord;
    } catch {
      return null;
    }
  },
  write(key: string, value: StoredAuthRecord): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  },
  clear(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return;
    }
  },
};
