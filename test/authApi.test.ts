import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthApi } from "../src/services/authApi";
import { AnnotationApiError } from "../src/types/annotation.types";

const API_BASE = "http://localhost:4000/api/v1/pinnote";
const TOKEN = "signed.jwt.token";

function stubFetch(status: number, body = "") {
  const fetchMock = vi.fn(async () => new Response(body || null, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authApi.logout", () => {
  it("sends the session's bearer token so the server knows who is logging out", async () => {
    const fetchMock = stubFetch(204);

    await createAuthApi(API_BASE).logout("fidelity-poc", "user-1", undefined, TOKEN);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/auth/logout`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        body: JSON.stringify({ projectId: "fidelity-poc", userId: "user-1" }),
      }),
    );
  });

  it("reports a rejected token as a 401 error", async () => {
    stubFetch(401, JSON.stringify({ error: "Authentication required" }));

    const result = createAuthApi(API_BASE).logout("fidelity-poc", "user-1", undefined, TOKEN);

    await expect(result).rejects.toBeInstanceOf(AnnotationApiError);
    await expect(result).rejects.toMatchObject({ status: 401, message: "Authentication required" });
  });
});
