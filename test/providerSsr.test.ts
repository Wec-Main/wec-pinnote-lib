import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnnotationProvider } from "../src/context/AnnotationProvider";
import type { AnnotationConfig } from "../src/types/annotation.types";

const config: AnnotationConfig = {
  apiBaseUrl: "https://api.example.test/api/v1/pinnote",
  projectId: "project-ssr",
  currentUser: { id: "user-ssr", name: "Server Render" },
};

describe("AnnotationProvider server rendering", () => {
  it("renders to a string without browser globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");

    const html = renderToString(
      createElement(AnnotationProvider, { config }, createElement("main", null, "host content")),
    );

    expect(html).toContain("host content");
  });

  it("renders with tracking enabled and a host token getter", () => {
    const html = renderToString(
      createElement(
        AnnotationProvider,
        { config: { ...config, trackPageVisits: true, getAuthToken: () => "host-token" } },
        createElement("main", null, "tracked content"),
      ),
    );

    expect(html).toContain("tracked content");
  });
});
