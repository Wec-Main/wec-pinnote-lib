import { describe, expect, it } from "vitest";
import {
  buildExportFiles,
  exportVersionToken,
  filterAnnotationsForContext,
} from "../src/utils/exportBundle";
import type { Annotation, AnnotationComment } from "../src/types/annotation.types";
import type { ProjectVersion } from "../src/types/projectVersion.types";

const user = { id: "u", name: "U" };
function comment(id: string, addToContext?: boolean): AnnotationComment {
  return { id, message: id, createdBy: user, createdAt: "", updatedAt: "", addToContext };
}
function annotation(id: string, comments: AnnotationComment[]): Annotation {
  return { id, comments } as unknown as Annotation;
}
const version = { id: "v", versionNumber: 2, name: "Release 1/2" } as ProjectVersion;

describe("filterAnnotationsForContext", () => {
  it("keeps only flagged comments and drops empty threads", () => {
    const result = filterAnnotationsForContext([
      annotation("a", [comment("c1", true), comment("c2"), comment("c3", false)]),
      annotation("b", [comment("c4")]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].comments.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("exportVersionToken", () => {
  it("sanitizes the label", () => {
    expect(exportVersionToken(version)).toBe("Release_1_2");
    expect(exportVersionToken({ ...version, name: undefined })).toBe("Version_2");
  });
});

describe("buildExportFiles", () => {
  const base = {
    version,
    annotations: [annotation("a", [comment("c1", true), comment("c2")])],
    flows: [],
    epics: [],
    userStories: [],
    dataModels: [],
  };
  it("emits four named files", () => {
    const files = buildExportFiles({ ...base, addToContextOnly: false });
    expect(files.map((f) => f.filename)).toEqual([
      "comments_Release_1_2.json",
      "flow_Release_1_2.json",
      "draft_board.json",
      "datamodel.json",
    ]);
    expect((files[0].data as Annotation[])[0].comments).toHaveLength(2);
  });
  it("filters comments when addToContextOnly", () => {
    const files = buildExportFiles({ ...base, addToContextOnly: true });
    expect((files[0].data as Annotation[])[0].comments).toHaveLength(1);
  });
});
