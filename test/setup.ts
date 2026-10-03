import { beforeAll, beforeEach } from "vitest";
import { loadErdOpsRunner, loadFlowOpsRunner } from "../src/ai/opBatchApplier";
import { clearResources } from "../src/utils/resourceCache";

beforeAll(async () => {
  await Promise.all([loadErdOpsRunner(), loadFlowOpsRunner()]);
});

beforeEach(() => {
  clearResources();
});
