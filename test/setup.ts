import { beforeEach } from "vitest";
import { clearResources } from "../src/utils/resourceCache";

beforeEach(() => {
  clearResources();
});
