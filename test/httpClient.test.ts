import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UNAUTHORIZED_EVENT,
  readErrorMessage,
  reportUnauthorized,
} from "../src/services/httpClient";

const TOKEN = "signed.jwt.token";

function stubWindow() {
  const target = new EventTarget();
  vi.stubGlobal("window", target);
  const received: string[] = [];
  target.addEventListener(UNAUTHORIZED_EVENT, (event) => {
    received.push((event as CustomEvent<{ token: string }>).detail.token);
  });
  return received;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readErrorMessage", () => {
  it("uses the server's error text", async () => {
    const response = new Response(JSON.stringify({ error: "You do not have access to this project" }), {
      status: 403,
    });
    await expect(readErrorMessage(response, "Request failed (403)")).resolves.toMatchObject({
      message: "You do not have access to this project",
    });
  });

  it("falls back when the body is empty", async () => {
    await expect(readErrorMessage(new Response(null, { status: 502 }), "Request failed (502)")).resolves.toEqual({
      message: "Request failed (502)",
      text: "",
    });
  });

  it("uses a plain-text body as the message", async () => {
    const response = new Response("Bad gateway", { status: 502 });
    await expect(readErrorMessage(response, "fallback")).resolves.toMatchObject({ message: "Bad gateway" });
  });
});

describe("reportUnauthorized", () => {
  it("announces a rejected token so the session can be renewed or dropped", () => {
    const received = stubWindow();
    reportUnauthorized(401, TOKEN);
    expect(received).toEqual([TOKEN]);
  });

  it("stays quiet for other failures and for anonymous requests", () => {
    const received = stubWindow();
    reportUnauthorized(403, TOKEN);
    reportUnauthorized(500, TOKEN);
    reportUnauthorized(401, undefined);
    expect(received).toEqual([]);
  });
});
