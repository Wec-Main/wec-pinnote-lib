import { useMemo, useState } from "react";
import { AnnotationProvider, type AnnotationUser } from "wec-pinnote-lib";
import { createInMemoryAnnotationApi } from "./mock/inMemoryAnnotationApi";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";

const ANONYMOUS_USER: AnnotationUser = { id: "anonymous", name: "" };

function currentPath(): "/login" | "/home" {
  return window.location.pathname === "/home" ? "/home" : "/login";
}

const useMockApi = import.meta.env.VITE_USE_MOCK_API === "true";

export function App() {
  const [page, setPage] = useState<"/login" | "/home">(currentPath);

  const mockApi = useMemo(
    () => (useMockApi ? createInMemoryAnnotationApi(() => ANONYMOUS_USER) : undefined),
    [],
  );

  const go = (path: "/login" | "/home") => {
    window.history.pushState({}, "", path);
    setPage(path);
  };

  const config = {
    apiBaseUrl: import.meta.env.VITE_ANNOTATION_API_URL ?? "http://localhost:4000/api/v1/pinnote",
    projectId: import.meta.env.VITE_ANNOTATION_PROJECT_ID ?? "wec-lib",
    currentUser: ANONYMOUS_USER,
    getPageKey: () => window.location.pathname,
    ...(mockApi ? { apiClient: mockApi } : {}),
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
