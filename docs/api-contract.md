# Annotation API contract

The host backend implements these REST endpoints. `wec-pinnote-lib` only issues HTTP requests. It does not open a database connection.

All JSON fields use camelCase. Authentication is optional from the library’s point of view. When `getAuthToken()` returns a value, requests include:

```http
Authorization: Bearer <token>
```

Comment `message` values are plain text. Do not return HTML that the client is expected to render as markup.

## List annotations

```http
GET /annotations?projectId={projectId}&pageKey={pageKey}
```

Response: an array, or `{ "annotations": [...] }`.

Page status is not part of this response. It is a separate page-level resource.

```json
[
  {
    "id": "ann-1",
    "projectId": "project-001",
    "pageKey": "/login",
    "number": 1,
    "anchor": {
      "selector": "[data-annotation-id=\"login-submit\"]",
      "elementIdentifier": "login-submit",
      "relativeX": 0.5,
      "relativeY": 0.5,
      "fallbackX": 820,
      "fallbackY": 520,
      "viewportWidth": 1440,
      "viewportHeight": 900
    },
    "status": "open",
    "comments": [
      {
        "id": "c-1",
        "message": "Change this button color to blue.",
        "createdBy": { "id": "u-1", "name": "Sarath", "avatarUrl": "https://example.com/a.png" },
        "createdAt": "2026-09-19T10:00:00.000Z",
        "updatedAt": "2026-09-19T10:00:00.000Z"
      }
    ],
    "createdBy": { "id": "u-1", "name": "Sarath" },
    "createdAt": "2026-09-19T10:00:00.000Z",
    "updatedAt": "2026-09-19T10:00:00.000Z"
  }
]
```

## Get page status

```http
GET /page-status?projectId={projectId}&pageKey={pageKey}
```

This is the current screen status shown in the toolbar (`Review` / `Approved`). It is scoped to `projectId` + `pageKey`, not to a single annotation.

Supported `status` values:

- `review`
- `approved`

If the page has never been updated, return `review`.

```json
{
  "projectId": "project-001",
  "pageKey": "/login",
  "status": "review",
  "updatedAt": "2026-09-19T10:00:00.000Z"
}
```

## Update page status

```http
PATCH /page-status
```

```json
{
  "projectId": "project-001",
  "pageKey": "/login",
  "status": "approved"
}
```

Response: the updated page status record.

```json
{
  "projectId": "project-001",
  "pageKey": "/login",
  "status": "approved",
  "updatedAt": "2026-09-19T10:05:00.000Z"
}
```

## Create annotation

```http
POST /annotations
```

```json
{
  "projectId": "project-001",
  "pageKey": "/login",
  "anchor": {
    "selector": "#login-button",
    "elementIdentifier": "login-button",
    "relativeX": 0.5,
    "relativeY": 0.5,
    "fallbackX": 820,
    "fallbackY": 520,
    "viewportWidth": 1440,
    "viewportHeight": 900
  },
  "comment": {
    "message": "Change this button color to blue.",
    "authorId": "Sarath",
    "authorName": "Sarath"
  }
}
```

`comment.authorName` is the commenter's display name, taken from the toolbar's "Your name" field. It is
optional; the backend falls back to a generic name (e.g. "Anonymous") when omitted.

`comment.authorId` is the commenter's identity for this name, taken from the same "Your name" field
(the library has no real auth, so it uses the entered name as the id). The client does not rely on the
backend to echo this back correctly: since `createdBy.id` may come back as a shared placeholder (e.g.
`"anonymous"`), the UI's edit/delete visibility check compares `createdBy.name` to the current
`currentUser.name` instead of comparing ids.

Response: the created `Annotation`, including generated `id`, `number`, and the first comment.

## Get annotation

```http
GET /annotations/{annotationId}
```

Response: a single `Annotation`.

## Create comment

```http
POST /annotations/{annotationId}/comments
```

```json
{
  "message": "Updated as requested.",
  "authorId": "Sarath",
  "authorName": "Sarath"
}
```

`authorName` is optional, same fallback behavior as on annotation creation. `authorId` follows the same
rule as on annotation creation — use it for `createdBy.id` rather than a shared placeholder.

Response: the created `AnnotationComment`.

## Update annotation

```http
PATCH /annotations/{annotationId}
```

Supported `status` values:

- `open`
- `re-open`
- `dev-inprogress`
- `completed`
- `closed`

```json
{ "status": "dev-inprogress" }
```

Response: the updated `Annotation`.

## Delete annotation

```http
DELETE /annotations/{annotationId}
```

Response: `204` or an empty body.

## Update comment

```http
PATCH /annotations/{annotationId}/comments/{commentId}
```

```json
{ "message": "Updated wording." }
```

Response: the updated `AnnotationComment`.

## Delete comment

```http
DELETE /annotations/{annotationId}/comments/{commentId}
```

Response: `204` or an empty body.

## Errors

Non-2xx responses become `AnnotationApiError` with `status` and response body text. The backend remains responsible for authorization (403/401). The UI only shows edit/delete for comments whose `createdBy.name` matches `currentUser.name` (name-based, not id-based, since the id is not reliably populated by the backend).
