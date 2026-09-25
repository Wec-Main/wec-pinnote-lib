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
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
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
        "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
        "message": "Change this button color to blue.",
        "createdBy": {
          "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          "name": "Sarath",
          "avatarUrl": "https://example.com/a.png"
        },
        "createdAt": "2026-09-19T10:00:00.000Z",
        "updatedAt": "2026-09-19T10:00:00.000Z"
      }
    ],
    "createdBy": { "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "name": "Sarath" },
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
    "authorName": "Sarath"
  }
}
```

`comment.authorName` is the commenter's display name, taken from the toolbar's "Your name" field. It is
optional; the backend falls back to a generic name (e.g. "Unknown user") when omitted.

`comment.authorId`, if sent, is ignored by the server. `createdBy.id` is never taken from the request
body: the server derives it from the verified bearer token (`Authorization: Bearer <token>`, decoded to
a `users.user_id`), and stores `null` when the request is unauthenticated or the token does not decode
to a UUID. The UI's edit/delete visibility check compares `createdBy.id` to the current session's user
id, not the display name — a request built with no valid bearer token will never see its own
comment/annotation as editable after the fact, because the server has no verified identity to compare
against.

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
  "authorName": "Sarath"
}
```

`authorName` is optional, same fallback behavior as on annotation creation. An `authorId` field, if
sent, is ignored the same way — `createdBy.id` always comes from the verified bearer token.

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

Non-2xx responses become `AnnotationApiError` with `status` and the response body text attached.
The JSON body itself is `{ "error": string, "details"?: unknown }` — `error` is a short message,
and `details` is present on `400` validation failures as the flattened Zod issue shape,
`{ "formErrors": string[], "fieldErrors": Record<string, string[]> }`. The library's own error
parsing falls back to a `message` field only for the SSE stream's capacity responses (see
[`GET /events`](#stream-live-updates-sse)), which use `{ "message": string }` instead.

The backend remains responsible for authorization (403/401). The UI only shows edit/delete for
comments whose `createdBy.id` matches the current session's `currentUser.id`.

# EpicFlow API contract

EpicFlow is a lightweight Epic → User Story workspace, scoped by `projectId` (the same project
concept used above). An Epic has many User Stories. Deleting an Epic cascades to its User Stories.

There is no separate Notes entity or endpoint. The EpicFlow UI's "Notes" panel is a read-only detail
view of whichever Epic or User Story is currently selected — it only ever displays that item's own
`title` and `description`, so no additional API beyond epics/user-stories is needed to power it.

`createdByUser` and `updatedByUser` are read-only: the server joins them from `users` rather than
storing a copy, so a renamed user is reflected everywhere at once. They are not accepted in a
request body. `createdById` is derived from the same unverified bearer token as annotations
(`req.userId`); it is a `users.user_id` FK, so an anonymous or non-UUID caller stores `null` and
`createdByUser` reads `"Unknown"`. `updatedById` / `updatedByUser` stay `null` until the first
update.

Every create, update and delete writes an `audit_log` row (`epic.created`, `user_story.updated`,
and so on) inside the same transaction as the change, so the Audit History panel shows EpicFlow
activity alongside annotations and users.

`organizationId` and `projectId` are server-derived — an epic inherits them from its project, a
user story from its epic — and are never accepted from the client. `status` is one of `backlog`,
`in_progress`, `done`, `archived` (default `backlog`), validated in the API and enforced by a
database CHECK, so changing the vocabulary needs a migration. `position` is the board sort key,
assigned as `max(position) + 1` within the project (epics) or epic (stories) on create.

## List epics

```http
GET /epics?projectId={projectId}
```

Response: `Epic[]`, ordered by `position` ascending, then most recently created first.

```json
[
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    "projectId": "project-001",
    "title": "AI-Powered Shopping Experience",
    "description": "Personalized product discovery using AI.",
    "status": "backlog",
    "position": 1,
    "createdByUser": "Sarath",
    "createdById": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    "updatedByUser": null,
    "updatedById": null,
    "createdAt": "2026-09-22T10:00:00.000Z",
    "updatedAt": "2026-09-22T10:00:00.000Z"
  }
]
```

## Create epic

```http
POST /epics
```

```json
{
  "projectId": "project-001",
  "title": "AI-Powered Shopping Experience",
  "description": "Personalized product discovery using AI.",
  "status": "backlog"
}
```

Response: `201` with the created `Epic`.

## Get epic

```http
GET /epics/{epicId}
```

## Update epic

```http
PATCH /epics/{epicId}
```

```json
{ "title": "...", "description": "...", "status": "in_progress", "position": 2 }
```

`status` and `position` are optional; omitting either leaves the stored value unchanged.

Response: the updated `Epic`. `status` is one of `backlog`, `in_progress`, `done`, `archived`
(default `backlog`), the same vocabulary as User Story `status` — see the note above the epics
endpoints.

## Delete epic

```http
DELETE /epics/{epicId}
```

Cascades to the epic's user stories. Response: `204`.

## List user stories

```http
GET /user-stories?epicId={epicId}
GET /user-stories?projectId={projectId}
```

Exactly one of `epicId` or `projectId` is required; supplying both or neither is a `400`. The
`projectId` form returns every story in the project in one request, which is what the board loads —
fetching per epic would make a board of N epics cost N+1 round trips.

Response: `UserStory[]`, ordered by `position` ascending, then most recently created first.

```json
[
  {
    "id": "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
    "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    "projectId": "project-001",
    "epicId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "title": "As a customer, I want personalized recommendations",
    "description": "Surface products based on browsing and purchase history.",
    "status": "backlog",
    "position": 1,
    "createdByUser": "Sarath",
    "createdById": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    "updatedByUser": null,
    "updatedById": null,
    "createdAt": "2026-09-22T10:05:00.000Z",
    "updatedAt": "2026-09-22T10:05:00.000Z"
  }
]
```

## Create user story

```http
POST /user-stories
```

```json
{
  "epicId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "title": "As a customer, I want personalized recommendations",
  "description": "Surface products based on browsing and purchase history.",
  "status": "backlog"
}
```

Response: `201` with the created `UserStory`. `404` if `epicId` does not exist.

## Get user story

```http
GET /user-stories/{userStoryId}
```

## Update user story

```http
PATCH /user-stories/{userStoryId}
```

```json
{ "title": "...", "description": "...", "status": "in_progress", "position": 2 }
```

`status` and `position` are optional; omitting either leaves the stored value unchanged.

## Delete user story

```http
DELETE /user-stories/{userStoryId}
```

Response: `204`.

# Flow API contract

A flow is a flowchart owned by a project. The Flow panel edits the project's default flow; each
flow pin placed on a page element owns a flow of its own. Flow documents use the editor's own JSON
shape (`FlowJSON`), so the client sends and receives exactly what the editor produces.

Every flow endpoint requires a signed-in project member. `organizationId` and `projectId` are
derived on the server from the project or flow and are never taken from the client.

## Resolve the default flow

```http
POST /flows/default
```

```json
{ "projectId": "project-001" }
```

Response: the project's most recently updated active flow that does not belong to a pin, or a new
`Untitled Flow` when it has none. Concurrent calls for the same project return the same flow.

## Get a flow document

```http
GET /flows/{flowId}/document
```

```json
{
  "flow": { "id": "0b1c…", "projectId": "project-001", "name": "Checkout", "updatedAt": "…" },
  "pageId": "5d2e…",
  "revision": 4,
  "document": {
    "version": 1,
    "nodes": [
      {
        "id": "start_k3j9x2a1",
        "type": "start",
        "position": { "x": 120, "y": 40 },
        "width": 180,
        "height": 56,
        "data": { "label": "Start", "description": "", "properties": {} }
      }
    ],
    "edges": [
      {
        "id": "edge_p0q1r2s3",
        "source": "start_k3j9x2a1",
        "target": "process_a1b2c3d4",
        "sourceHandle": "out",
        "type": "step"
      }
    ],
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "meta": { "name": "Checkout", "edgeType": "step" }
  }
}
```

Node and edge `id`s are the editor's own ids and are kept as sent. `meta.name` is the flow name and
`meta.edgeType` its default edge style; any other `meta` keys are stored and returned unchanged.

## Save a flow document

```http
PUT /flows/{flowId}/document
```

```json
{ "revision": 4, "document": { "version": 1, "nodes": [], "edges": [], "meta": { "name": "Checkout" } } }
```

Replaces the flow's nodes and edges in one transaction and returns the same shape as the get, with
`revision` incremented. Send the `revision` from the last get or save: a stale revision returns
`409` without changing anything, so one editor never silently overwrites another. Omitting
`revision` skips the check.

A document is rejected with `400` when a node id repeats, an edge points at a node that is not in
the document, an edge connects a node to itself, or a key is `__proto__`, `constructor` or
`prototype`. A document holds at most 2000 nodes and 4000 edges.

## Publish a flow

```http
POST /flows/{flowId}/versions
```

Snapshots the saved document as the next version (1, 2, 3 …). Response: `201` with the version,
including its `document`.

## List and get versions

```http
GET /flows/{flowId}/versions
GET /flows/{flowId}/versions/{version}
```

The list returns the 100 newest versions without their documents, newest first:

```json
[
  {
    "id": "9f8e…",
    "flowId": "0b1c…",
    "version": 2,
    "publishedById": "dd199b4d-d950-446a-b339-b93910500a32",
    "publishedByUser": "Kaviyarasu",
    "publishedAt": "2026-09-23T10:00:00.000Z"
  }
]
```

## Flow pins

```http
GET /flow-pins?projectId={projectId}&pageKey={pageKey}
POST /flow-pins
PATCH /flow-pins/{flowPinId}
DELETE /flow-pins/{flowPinId}
```

Create body, anchored the same way as annotations:

```json
{
  "projectId": "project-001",
  "pageKey": "/checkout",
  "name": "Payment retry flow",
  "selector": "form.payment > button.submit",
  "elementIdentifier": "Pay now button",
  "relativeX": 0.5,
  "relativeY": 0.5,
  "fallbackX": 640,
  "fallbackY": 420,
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

Creating a pin also creates its flow. The response carries `flowId`, which the pin's panel loads
and saves through the flow document endpoints above. `PATCH` takes `{ "name": "…" }` and renames
both the pin and its flow; saving the flow under a new name renames the pin too. Deleting a pin
deletes its flow, and is allowed for the pin's author or an admin. Pin flows are left out of
`GET /flows`.

# Settings API contract

The Settings panel (Users, Organizations, Projects, Tags, Audit history) and the login picker each
talk to their own set of endpoints below. All of them require the same bearer token described at
the top of this document; the sections note the additional role each one requires.

Roles are `super_admin`, `admin`, `contributor`, `reviewer`, `developer`. Organizations and
Projects are restricted to `super_admin`. Users and Tags are restricted to `admin` and
`super_admin` for anything beyond a user's own record. Audit history requires `admin` or
`super_admin`.

## Authentication

### List login options

```http
GET /auth/users?projectId={projectId}
```

No bearer token required. Returns the reduced picker shape used by the login dialog, not the full
`ManagedUser` record.

```json
{
  "users": [
    {
      "id": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
      "name": "Sarath",
      "avatarUrl": "https://example.com/a.png"
    }
  ]
}
```

### Log in

```http
POST /auth/login
```

```json
{
  "projectId": "project-001",
  "userId": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  "password": "correct horse battery staple"
}
```

Response: `200` with the authenticated session.

```json
{
  "user": {
    "id": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    "name": "Sarath",
    "email": "sarath@example.com",
    "roleId": "admin",
    "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    "avatarUrl": "https://example.com/a.png"
  }
}
```

`401` with `"Incorrect password."` when the password does not match. The library signs its own
placeholder bearer token from the resulting `user.id` (see the note at the top of this document);
it does not receive a token from this endpoint.

### Log out

```http
POST /auth/logout
```

```json
{ "projectId": "project-001", "userId": "6ba7b812-9dad-11d1-80b4-00c04fd430c8" }
```

Send the session's bearer token: the server identifies who is logging out from it and revokes that
user's sessions. Response: `204`, or `401` when the token is missing or no longer valid. On a `401`
the client refreshes the token once and retries; if that is also rejected the server session is
already dead, so the client just drops the local session. Either way the account is removed from
the browser.

## Organizations

Every route below requires `super_admin`.

### List organizations

```http
GET /organizations
```

```json
{
  "organizations": [
    {
      "id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "companyName": "Acme Industries",
      "slug": "acme-industries",
      "countryCode": "IN",
      "status": "active",
      "createdAt": "2026-09-19T10:00:00.000Z",
      "updatedAt": "2026-09-19T10:00:00.000Z"
    }
  ]
}
```

### Create organization

```http
POST /organizations
```

```json
{
  "companyName": "Acme Industries",
  "slug": "acme-industries",
  "countryCode": "IN",
  "status": "active"
}
```

`slug` must match `^[a-z0-9][a-z0-9-]*$`. Response: `201` with the created organization. `409` if
the slug is already taken.

### Get organization

```http
GET /organizations/{organizationId}
```

### Update organization

```http
PUT /organizations/{organizationId}
```

Same body as create. Response: the updated organization. `404` if it does not exist.

### Delete organization

```http
DELETE /organizations/{organizationId}
```

Response: `204`. Deletes the organization's projects, users and tags with it.

## Projects

Every route below requires `super_admin`.

### List projects

```http
GET /projects?organizationId={organizationId}
```

`organizationId` is optional; omit it to list every project the caller's organization scope
allows.

```json
{
  "projects": [
    {
      "id": "acme-web",
      "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "name": "Acme Web",
      "description": "Marketing site and app shell.",
      "status": "active",
      "createdAt": "2026-09-19T10:00:00.000Z",
      "updatedAt": "2026-09-19T10:00:00.000Z"
    }
  ]
}
```

### Create project

```http
POST /projects
```

```json
{
  "projectId": "acme-web",
  "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  "name": "Acme Web",
  "description": "Marketing site and app shell.",
  "status": "active"
}
```

`projectId` must match `^[A-Za-z0-9][A-Za-z0-9._-]*$` and becomes the `projectId` used by every
other endpoint in this document (the client's `VITE_ANNOTATION_PROJECT_ID`). Response: `201` with
the created project. `409` if the id is already taken.

### Get project

```http
GET /projects/{projectId}
```

### Update project

```http
PUT /projects/{projectId}
```

Same body as create, without `projectId` (the id cannot change after creation). Response: the
updated project. `404` if it does not exist.

### Delete project

```http
DELETE /projects/{projectId}
```

Response: `204`. Deletes the project's annotations, tags and user memberships with it.

## Users

`GET`/`PUT`/`DELETE` on a specific user allow the user to act on their own record; every other
case — listing every user, creating one, or acting on someone else's — requires `admin` or
`super_admin`.

### List users

```http
GET /users?projectId={projectId}&search=&roleId=&status=&category=&limit=50&offset=0
```

`projectId` is required; `limit` defaults to `50` (max `200`), `offset` to `0`.

```json
{
  "users": [
    {
      "id": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
      "firstName": "Sarath",
      "lastName": "Kumar",
      "email": "sarath@example.com",
      "phone": "+91 80 4718 2210",
      "roleId": "admin",
      "category": "internal",
      "status": "active",
      "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "countryCode": "IN",
      "avatarUrl": "https://example.com/a.png",
      "lastActiveAt": "2026-09-19T10:00:00.000Z",
      "projects": [{ "id": "acme-web", "name": "Acme Web" }],
      "createdAt": "2026-09-19T10:00:00.000Z",
      "updatedAt": "2026-09-19T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### Create user

```http
POST /users
```

```json
{
  "projectId": "acme-web",
  "firstName": "Sarath",
  "lastName": "Kumar",
  "email": "sarath@example.com",
  "phone": "+91 80 4718 2210",
  "roleId": "admin",
  "category": "internal",
  "status": "active",
  "countryCode": "IN",
  "password": "correct horse battery staple",
  "projectIds": ["acme-web"]
}
```

`category` is required unless `roleId` is `super_admin`. `password` is optional; when omitted the
server generates one and returns it once.

Response: `201`.

```json
{
  "user": { "...": "ManagedUser, as in the list response" },
  "generatedPassword": "correct horse battery staple"
}
```

`generatedPassword` is present only when `password` was omitted from the request. The client shows
it once, in a dedicated modal, and never persists or re-requests it — the server does not return it
again on any later call.

### Get user

```http
GET /users/{userId}?projectId={projectId}
```

### Update user

```http
PUT /users/{userId}
```

Same body as create, minus `password` — this endpoint never changes a password (use the
password-reset endpoint below). Response: the updated `ManagedUser`.

### Delete user

```http
DELETE /users/{userId}?projectId={projectId}
```

Response: `204`.

### Reset password

```http
POST /users/{userId}/password-reset
```

```json
{ "projectId": "acme-web", "password": "correct horse battery staple" }
```

`password` is optional; when omitted the server generates one and returns it. Response:

```json
{
  "user": { "...": "ManagedUser" },
  "password": "correct horse battery staple"
}
```

Unlike `generatedPassword` on create, `password` here is always present — this endpoint always
returns the password now in effect, generated or supplied — and the client always shows it once in
the same dedicated modal.

## Tags

Create, update and delete require `admin` or `super_admin`. List and get are open to any
authenticated user, since tagging an element is a normal annotator action, not an admin one.

### List tags

```http
GET /tags?organizationId=&projectId=&status=
```

All three query parameters are optional.

```json
{
  "tags": [
    {
      "id": "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
      "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "projectId": "acme-web",
      "name": "Accessibility",
      "color": "#6366f1",
      "status": "active",
      "createdById": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
      "createdByName": "Sarath",
      "createdAt": "2026-09-19T10:00:00.000Z",
      "updatedAt": "2026-09-19T10:00:00.000Z"
    }
  ]
}
```

### Create tag

```http
POST /tags
```

```json
{ "projectId": "acme-web", "name": "Accessibility", "color": "#6366f1", "status": "active" }
```

`color` must be one of the nine swatches the Settings panel offers
(`#ef4444 #f97316 #f59e0b #10b981 #0ea5e9 #6366f1 #a855f7 #ec4899 #64748b`); `status` is `active` or
`inactive`. Response: `201` with the created tag.

### Get tag

```http
GET /tags/{tagId}
```

### Update tag

```http
PUT /tags/{tagId}
```

Same body as create, without `projectId` (a tag cannot move to another project). Response: the
updated tag.

### Delete tag

```http
DELETE /tags/{tagId}
```

Response: `204`.

## Audit history

```http
GET /audit?projectId=&scope=project&actorUserId=&action=&entityType=&entityId=&pageKey=&search=&from=&to=&limit=50&offset=0
```

Requires `admin` or `super_admin`. `projectId` is required; `scope` is `project` (default) or
`organization`, and switches whether the query is confined to that project or spans every project
in the caller's organization. `from`/`to` are ISO 8601 timestamps with an explicit offset. `limit`
defaults to `50` (max `200`).

```json
{
  "entries": [
    {
      "auditId": "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
      "actorUserId": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
      "actorName": "Sarath",
      "action": "tag.created",
      "entityType": "tag",
      "entityId": "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
      "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "projectId": "acme-web",
      "pageKey": null,
      "beforeData": null,
      "afterData": { "name": "Accessibility", "color": "#6366f1" },
      "ipAddress": "203.0.113.4",
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2026-09-19T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

Every create, update and delete across annotations, comments, users, organizations, projects,
tags, epics and user stories writes one row here in the same transaction as the change, so this
endpoint is the single feed for all of them.

## Live updates (SSE)

```http
GET /events?projectId={projectId}&pageKey={pageKey}&lastEventId={id}
```

Requires a bearer token (`requireAuthenticated`); `lastEventId` is optional and also accepted as
the standard `Last-Event-ID` header for automatic reconnection. Response is
`text/event-stream`: a replay of missed events since `lastEventId` (capped at 500, in batches),
then a `ready` event, then live events as they occur, plus periodic `: keep-alive` comments and an
occasional `resync` event carrying the latest event id.

Each event line is `id: <eventId>`, `event: <eventType>`, `data: <json>`. If the number of active
subscribers or the number of connections from the same caller exceeds a server-configured limit,
the endpoint responds `503` before upgrading to a stream:

```json
{ "message": "Live update capacity reached; retry shortly." }
```

This is the one response in the API that uses `{ "message": string }` instead of
`{ "error": string, "details"?: unknown }` — the connection never reaches the point where the
usual JSON error body would apply.

# Analytics API contract

Every endpoint below requires a `super_admin` actor except `POST /analytics/ingest-token` and
`POST /analytics/visits`, which authenticate a page-visit tracker instead of a dashboard viewer.
Analytics tables (`page_visits`, `login_events`, `user_presence`, `page_visit_daily`,
`user_visit_daily`) live in the same database as every other table; a request fails only if those
tables have not been applied yet.

## Ingest token

```http
POST /analytics/ingest-token
Authorization: Bearer <token>
Content-Type: application/json

{ "projectId": "proj_123" }
```

Requires a signed-in project member. Returns a short-lived token the tracker can carry in a
`text/plain` body, where an `Authorization` header cannot travel:

```json
{ "token": "<jwt>", "expiresAt": "2026-09-24T10:10:00.000Z" }
```

The token is a `typ: "ingest"` JWT that expires in 600 seconds and is rejected by every other
authentication check in the API (`extractUserId`, `verifyRefreshToken`).

## Visit ingest

```http
POST /analytics/visits
Content-Type: text/plain

{ "token": "<jwt>", "visits": [ { "clientVisitId": "a1b2c3d4", "sessionId": "s1t2u3v4", "pageKey": "/board", "urlPath": "/board", "title": "Board", "referrer": null, "enteredAt": "2026-09-24T10:00:00.000Z", "durationMs": 4200, "maxScrollDepth": 80, "viewportWidth": 1440, "viewportHeight": 900, "language": "en-US", "timezone": "UTC", "continuation": false } ] }
```

The body is `text/plain`, not JSON, because a cross-origin `Authorization` header would force a
CORS preflight that `navigator.sendBeacon` and an unload-time `fetch` cannot rely on. Up to 50
visits and 64 KB per request. Identity, IP address and user agent are taken from the verified
token and the request, never from the body. Responses:

| Status | Meaning |
|---|---|
| 204 | Accepted; an empty `visits` array still refreshes presence |
| 400 | Body is not valid JSON, or fails the visit schema |
| 401 | Missing, invalid or expired ingest token |
| 413 | Body exceeds 64 KB |
| 415 | `Content-Type` is not `text/plain` |
| 429 | More than 240 requests/minute from the caller's IP |

## Summary

```http
GET /analytics/summary?organizationId={id}&projectId={id}&from=2026-08-25&to=2026-09-24
```

`from`/`to` are UTC `YYYY-MM-DD` dates, `to` inclusive, defaulting to the last 30 days, with a
366-day maximum span.

```json
{
  "range": { "from": "2026-08-25", "to": "2026-09-24" },
  "users": { "total": 42 },
  "activeNow": 3,
  "activeUsers": { "dau": 12, "wau": 30, "mau": 40 },
  "logins": { "total": 58, "unique": 20, "failed": 4 },
  "comments": { "total": 15 },
  "annotations": {
    "total": 90,
    "byStatus": { "open": 20, "re-open": 5, "dev-inprogress": 10, "completed": 40, "closed": 15 }
  },
  "visits": { "total": 320 }
}
```

## Page visits

```http
GET /analytics/pages?organizationId={id}&projectId={id}&from=2026-08-25&to=2026-09-24&limit=50&offset=0
```

`limit` is 1–200 (default 50). Rows are ordered by visits descending, then project id, then page
key; `total` is only computed on the first page (`offset=0`).

```json
{
  "pages": [
    { "projectId": "proj_123", "pageKey": "/board", "visits": 120, "totalDurationMs": 480000, "avgDurationMs": 4000 }
  ],
  "total": 34,
  "limit": 50,
  "offset": 0
}
```

## Trends

```http
GET /analytics/trends?organizationId={id}&projectId={id}&from=2026-08-25&to=2026-09-24
```

One entry per UTC day in the range, zero-filled where a day has no rows.

```json
{
  "days": [
    { "day": "2026-08-25", "visits": 12, "logins": 3, "comments": 1 },
    { "day": "2026-08-26", "visits": 0, "logins": 0, "comments": 0 }
  ]
}
```

## Top users

```http
GET /analytics/users?organizationId={id}&projectId={id}&from=2026-08-25&to=2026-09-24&limit=50&offset=0
```

`limit` is 1–200 (default 50). Rows are ordered by visits descending, then user id; `total` is
only computed on the first page (`offset=0`).

```json
{
  "users": [
    { "userId": "6ba7b812-9dad-11d1-80b4-00c04fd430c8", "userName": "Sarath", "visits": 40, "activeDays": 6, "lastVisitDay": "2026-09-24" }
  ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

## Visit log

```http
GET /analytics/visits?organizationId={id}&projectId={id}&from=2026-08-25&to=2026-09-24&userId={id}&pageKey=/board&limit=50&offset=0
```

`userId` and `pageKey` are optional filters. `limit` is 1–200 (default 50); `limit=201` is a `400`.
Rows are the raw visit log, ordered by `visitId` descending.

```json
{
  "visits": [
    {
      "visitId": "482910",
      "sessionId": "s1t2u3v4",
      "userId": "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
      "userName": "Sarath",
      "organizationId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "projectId": "proj_123",
      "pageKey": "/board",
      "urlPath": "/board",
      "title": "Board",
      "referrer": null,
      "enteredAt": "2026-09-24T10:00:00.000Z",
      "durationMs": 4200,
      "maxScrollDepth": 80,
      "viewportWidth": 1440,
      "viewportHeight": 900,
      "language": "en-US",
      "timezone": "UTC",
      "isContinuation": false,
      "ipAddress": "203.0.113.4",
      "userAgent": "Mozilla/5.0 ...",
      "receivedAt": "2026-09-24T10:00:04.200Z"
    }
  ],
  "total": 320,
  "limit": 50,
  "offset": 0
}
```

## Visit log export

```http
GET /analytics/visits/export?organizationId={id}&projectId={id}&from=2026-08-25&to=2026-09-24&userId={id}&pageKey=/board
```

Same filters as the visit log, without pagination. Streams `text/csv; charset=utf-8` with
`Content-Disposition: attachment; filename="page-visits-<from>-<to>.csv"` — a header row followed
by every matching visit. Formula-leading cells are neutralized. The library's own client fetches
this through `requestBlob`, since the response is a file rather than JSON, and records an
`analytics.visits-exported` audit row before it starts streaming.

## Analytics live updates (SSE)

The dashboard opens a stream that says "something changed, refetch" rather than carrying rows.
A connection takes two steps: mint a single-use ticket with the bearer token, then open the
stream with that ticket in the query string, since `EventSource` cannot send headers.

```http
POST /analytics/events/ticket?organizationId={id}&projectId={id}
```

Both filters are optional and become the stream's scope; the date range is not part of it. A
filter change mints a new ticket and opens a new stream.

```json
{ "ticket": "<opaque string>", "expiresInSeconds": 60 }
```

```http
GET /analytics/events?ticket={ticket}
```

A ticket is redeemed once and expires after 60 seconds, so every reconnect mints a fresh one.
The response is `text/event-stream`. It starts with a `retry:` hint and a `ready` event, then
sends change events as they occur, with a `: keep-alive` comment every 25 seconds. Events carry
no `id`, and there is no replay: a reconnect is followed by a full refetch.

| Event | Data | Meaning |
|---|---|---|
| `ready` | `{}` | The stream is subscribed |
| `analytics.changed` | `{ "kinds": ["visits", "logins"] }` | Data in the stream's scope changed |
| `resync` | `{}` | Changes may have been missed; refetch everything |

The server coalesces changes into one `analytics.changed` event per scope every 5 seconds at
most. It sends `resync` after its database listener reconnects, when a slow client's buffer
drains, or when too many changes arrive in one window. The client maps each kind to the
dashboard sections it refetches:

| Kind | Sections refetched |
|---|---|
| `visits` | Summary, page visits, trends, top pages, top users, visit log |
| `presence` | Summary |
| `logins` | Summary, trends |

An unknown kind or malformed payload is ignored. A reconnect after the first successful open
refetches every section.

| Status | Route | Cause |
|---|---|---|
| `401` | both | Missing or invalid bearer token on the ticket request; missing, expired or already-used ticket on the stream |
| `403` | both | The actor is not a `super_admin` |
| `503` | stream | Subscriber capacity or the per-user limit of 5 connections is reached (`{ "message": "Live update capacity reached; retry shortly." }` or `{ "message": "Live update connection limit reached for this user." }`) |

The library stops retrying after a `401`, `403` or `503` on the ticket request and shows "Live
updates off" until the tab comes back online or becomes visible; any other failure retries with
a backoff from 2 to 30 seconds. The stream carries no PII: events contain only change kinds,
never a user id, name, IP address, page key or row data, and the ticket is never logged.
