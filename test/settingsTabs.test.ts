import { describe, expect, it } from "vitest";
import { visibleSettingsTabs } from "../src/features/settings/components/settingsTabs";

const tabIds = (role: Parameters<typeof visibleSettingsTabs>[0]) =>
  visibleSettingsTabs(role).map((tab) => tab.id);

describe("visibleSettingsTabs", () => {
  it("shows the dashboard last for a super_admin", () => {
    expect(tabIds("super_admin").at(-1)).toBe("dashboard");
  });

  it("hides the dashboard from admins", () => {
    expect(tabIds("admin")).not.toContain("dashboard");
  });

  it("hides the dashboard from contributors", () => {
    expect(tabIds("contributor")).not.toContain("dashboard");
  });

  it("shows admins the projects tab alongside users", () => {
    expect(tabIds("admin")).toEqual(["users", "projects", "integrations"]);
  });

  it("shows the integrations tab to every role", () => {
    for (const role of ["super_admin", "admin", "contributor", "reviewer", "developer"] as const) {
      expect(tabIds(role)).toContain("integrations");
    }
  });

  it("keeps projects hidden from contributors", () => {
    expect(tabIds("contributor")).not.toContain("projects");
  });
});
