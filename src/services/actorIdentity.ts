/**
 * The API identifies the caller from a bearer token it decodes but does not
 * verify, so every request must carry the signed-in user's id for the
 * server-side role checks to resolve an actor at all.
 */
function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function actorToken(userId: string): string {
  const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ sub: userId }));
  return `${header}.${payload}.`;
}

export function actorHeaders(userId: string | undefined): Record<string, string> {
  return userId ? { Authorization: `Bearer ${actorToken(userId)}` } : {};
}
