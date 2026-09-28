import { describe, expect, it } from "vitest";
import { visibleSettingsTabs } from "../src/components/Settings/settingsTabs";

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

  it("shows versioning directly after projects for a super_admin", () => {
    const ids = tabIds("super_admin");
    expect(ids.indexOf("versioning")).toBe(ids.indexOf("projects") + 1);
  });

  it("shows versioning to every role, unlike projects", () => {
    for (const role of ["admin", "contributor", "reviewer", "developer"] as const) {
      expect(tabIds(role)).toContain("versioning");
      expect(tabIds(role)).not.toContain("projects");
    }
  });
});
