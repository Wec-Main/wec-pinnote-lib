import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAnnotationCollection } from "../../src/hooks/useAnnotations";
import type {
  Annotation,
  AnnotationApiClient,
  AnnotationUser,
  CreateAnnotationRequest,
} from "../../src/types/annotation.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const anchor = {
  selector: "body",
  elementIdentifier: "email",
  relativeX: 0.5,
  relativeY: 0.5,
  fallbackX: 0,
  fallbackY: 0,
  viewportWidth: 1024,
  viewportHeight: 768,
};

function createFakeApi(): AnnotationApiClient {
  return {
    listAnnotations: async () => [],
    getAnnotation: async () => {
      throw new Error("unused");
    },
    createAnnotation: (request: CreateAnnotationRequest) =>
      Promise.resolve({
        id: "server-1",
        projectId: request.projectId,
        projectVersionId: request.projectVersionId,
        pageKey: request.pageKey,
        number: 1,
        anchor: request.anchor,
        status: "open",
        comments: [
          {
            id: "server-comment-1",
            message: request.comment.message,
            createdBy: { id: request.comment.authorId ?? "", name: "" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdBy: { id: request.comment.authorId ?? "", name: "" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies Annotation),
    createComment: async () => {
      throw new Error("unused");
    },
    updateAnnotation: async () => {
      throw new Error("unused");
    },
    deleteAnnotation: async () => undefined,
    updateComment: async () => {
      throw new Error("unused");
    },
    deleteComment: async () => undefined,
  };
}

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useAnnotationCollection> | null = null;
let setCurrentUser: ((user: AnnotationUser) => void) | null = null;
let api: AnnotationApiClient;

function Harness({ initialUser }: { initialUser: AnnotationUser }) {
  const [currentUser, setUser] = useState(initialUser);
  setCurrentUser = setUser;
  latest = useAnnotationCollection({
    api,
    projectId: "project-1",
    projectVersionId: undefined,
    pageKey: "/home",
    currentUser,
    authenticated: true,
    apiBaseUrl: "",
    getAuthToken: undefined,
    sessionKey: "session",
    events: {},
    onFlowPinEvent: () => undefined,
  });
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
  setCurrentUser = null;
  api = createFakeApi();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useAnnotationCollection ref sync", () => {
  it("reads the current user synchronously from the render that just committed, not a tick later via an effect", async () => {
    const userA: AnnotationUser = { id: "user-a", name: "User A" };
    const userB: AnnotationUser = { id: "user-b", name: "User B" };

    act(() => root.render(createElement(Harness, { initialUser: userA })));
    await flush();

    let createdPromise: Promise<Annotation> | undefined;
    act(() => {
      // flushSync forces the currentUser prop change through render and
      // commit before the next line runs. annotationsRef/currentUserRef are
      // now assigned directly in the render body (this regression test's
      // target), so an action started immediately afterwards must already
      // see the new user — not the previous render's value.
      flushSync(() => setCurrentUser!(userB));
      createdPromise = latest!.createAnnotation({
        projectId: "project-1",
        pageKey: "/home",
        anchor,
        comment: { message: "hello", authorId: userB.id },
      });
    });

    await flush();
    const created = await createdPromise!;

    expect(created.createdBy.id).toBe(userB.id);
    expect(latest!.annotations.find((item) => item.id === created.id)?.createdBy.id).toBe(userB.id);
  });
});
