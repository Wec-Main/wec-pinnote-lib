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
});
