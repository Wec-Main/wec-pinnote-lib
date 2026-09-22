import { useMemo, useState } from "react";
import { AnnotationProvider, type AnnotationUser } from "wec-pinnote-lib";
import { DEMO_CONFIG } from "./config";
import { createInMemoryAnnotationApi } from "./mock/inMemoryAnnotationApi";
import { createInMemoryAuthApi } from "./mock/inMemoryAuthApi";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";

const ANONYMOUS_USER: AnnotationUser = { id: "anonymous", name: "" };

function currentPath(): "/login" | "/home" {
  return window.location.pathname === "/home" ? "/home" : "/login";
}

export function App() {
  const [page, setPage] = useState<"/login" | "/home">(currentPath);

  const mockApi = useMemo(
    () => (DEMO_CONFIG.useMockApi ? createInMemoryAnnotationApi(() => ANONYMOUS_USER) : undefined),
    [],
  );
  const mockAuthApi = useMemo(
    () => (DEMO_CONFIG.useMockApi ? createInMemoryAuthApi() : undefined),
    [],
  );

  const go = (path: "/login" | "/home") => {
    window.history.pushState({}, "", path);
    setPage(path);
  };

  const config = {
    apiBaseUrl: DEMO_CONFIG.apiBaseUrl,
    projectId: DEMO_CONFIG.projectId,
    currentUser: ANONYMOUS_USER,
    getPageKey: () => window.location.pathname,
    ...(mockApi ? { apiClient: mockApi } : {}),
    ...(mockAuthApi ? { authClient: mockAuthApi } : {}),
  };

  return (
    <AnnotationProvider config={config}>
      {page === "/home" ? (
        <HomePage onGoLogin={() => go("/login")} />
      ) : (
        <LoginPage onGoHome={() => go("/home")} />
      )}
    </AnnotationProvider>
  );
}
