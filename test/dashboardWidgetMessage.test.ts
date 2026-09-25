import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  WidgetMessage,
  WidgetMessageRow,
} from "../src/components/Settings/Dashboard/DashboardWidgetMessage";

describe("WidgetMessage", () => {
  it("renders the empty tone with its title and detail and no users notice", () => {
    const html = renderToString(
      createElement(WidgetMessage, {
        tone: "empty",
        icon: "layers",
        title: "No page visits yet",
        detail: "Visits appear once signed-in users browse pages in this range.",
      }),
    );

    expect(html).toContain("wpn-dashboard-message--empty");
    expect(html).toContain('role="status"');
    expect(html).toContain("No page visits yet");
    expect(html).toContain("Visits appear once signed-in users browse pages in this range.");
    expect(html).not.toContain("wpn-users-notice");
  });

  it("renders the error tone as an alert with the message", () => {
    const html = renderToString(
      createElement(WidgetMessage, { tone: "error", icon: "alert", title: "boom" }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("wpn-dashboard-message--error");
    expect(html).toContain("boom");
  });

  it("wraps the message in a table row spanning the given columns", () => {
    const html = renderToString(
      createElement(
        "table",
        null,
        createElement(
          "tbody",
          null,
          createElement(WidgetMessageRow, {
            colSpan: 4,
            tone: "empty",
            icon: "history",
            title: "No visits match these filters",
          }),
        ),
      ),
    );

    expect(html.toLowerCase()).toContain('colspan="4"');
    expect(html).toContain("No visits match these filters");
  });
});
