import { beforeAll, beforeEach } from "vitest";
import { loadErdOpsRunner, loadFlowOpsRunner } from "../src/features/ai/opBatchApplier";
import { clearResources } from "../src/utils/resourceCache";

beforeAll(async () => {
  await Promise.all([loadErdOpsRunner(), loadFlowOpsRunner()]);
});

beforeEach(() => {
  clearResources();
});
