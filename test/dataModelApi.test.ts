import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDataModel,
  deleteDataModel,
  fetchDataModel,
  fetchDataModelDocument,
  fetchDataModelVersion,
  listDataModelVersions,
  listDataModels,
  publishDataModel,
  saveDataModelDocument,
  updateDataModel,
} from "../src/services/erdService";
import { createEmptyErdDocument } from "../src/utils/erd/erdSerialization";

const BASE = "https://api.example.com";
const PREFIX = `${BASE}/api/v1/pinnote`;

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi
    .fn()
    .mockImplementation(
      async () => new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dataModelApi", () => {
  it("lists data models for a project", async () => {
    const fetchMock = stubFetch(200, [{ id: "d1" }]);
    const result = await listDataModels(BASE, "tok", "proj 1");
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`${PREFIX}/data-models?projectId=proj+1`);
    expect(init.method).toBeUndefined();
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(result).toEqual([{ id: "d1" }]);
  });

  it("creates a data model with the project id folded into the body", async () => {
    const fetchMock = stubFetch(201, { id: "d1" });
    await createDataModel(BASE, "tok", "p1", { name: "Shop", description: "x", engine: "mysql" });
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`${PREFIX}/data-models`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      projectId: "p1",
      name: "Shop",
      description: "x",
      engine: "mysql",
    });
  });

  it("always sends the engine, defaulting to na", async () => {
    const fetchMock = stubFetch(201, { id: "d1" });
    await createDataModel(BASE, "tok", "p1", { name: "Shop", engine: "na" });
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({
      projectId: "p1",
      name: "Shop",
      engine: "na",
    });
  });

  it("fetches, updates and deletes one data model with an encoded id", async () => {
    const fetchMock = stubFetch(200, { id: "a/b" });
    await fetchDataModel(BASE, "tok", "a/b");
    expect(lastCall(fetchMock).url).toBe(`${PREFIX}/data-models/a%2Fb`);

    await updateDataModel(BASE, "tok", "a/b", { engine: "sqlite" });
    expect(lastCall(fetchMock).init.method).toBe("PATCH");
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({ engine: "sqlite" });

    const noContent = stubFetch(204, null);
    await expect(deleteDataModel(BASE, "tok", "d1")).resolves.toBeUndefined();
    expect(lastCall(noContent).init.method).toBe("DELETE");
    expect(lastCall(noContent).url).toBe(`${PREFIX}/data-models/d1`);
  });

  it("reads and writes the document with its revision", async () => {
    const document = createEmptyErdDocument("postgres", "M");
    const fetchMock = stubFetch(200, { revision: 4, document });
    await fetchDataModelDocument(BASE, "tok", "d1");
    expect(lastCall(fetchMock).url).toBe(`${PREFIX}/data-models/d1/document`);

    await saveDataModelDocument(BASE, "tok", "d1", 4, document);
    const { init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ revision: 4, document });
  });

  it("publishes and reads versions", async () => {
    const fetchMock = stubFetch(201, { version: 1 });
    await publishDataModel(BASE, "tok", "d1");
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(lastCall(fetchMock).url).toBe(`${PREFIX}/data-models/d1/versions`);

    await listDataModelVersions(BASE, "tok", "d1");
    expect(lastCall(fetchMock).url).toBe(`${PREFIX}/data-models/d1/versions`);

    await fetchDataModelVersion(BASE, "tok", "d1", 3);
    expect(lastCall(fetchMock).url).toBe(`${PREFIX}/data-models/d1/versions/3`);
  });

  it("surfaces the server error message and status", async () => {
    stubFetch(409, { error: "Revision conflict" });
    await expect(
      saveDataModelDocument(BASE, "tok", "d1", 1, createEmptyErdDocument("postgres", "M")),
    ).rejects.toMatchObject({
      message: "Revision conflict",
      status: 409,
    });
  });
});
