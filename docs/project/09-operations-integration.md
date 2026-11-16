# Operations integration and document tabs

BrainStorm is the drawing module of EMC Operations. Collaborative editing is deferred; this delivery does not broadcast diagrams or introduce shared drawing sessions.

## Documents and UI

The web workbench has a bottom strip of open documents (maximum eight). New diagram creates an internal document tab, not a browser popup. Recent diagrams focuses an already open document or opens another tab. A local file opens into an empty starter or a separate document tab when work already exists. Each additional document keeps its own same-origin workspace iframe, React state, native draw.io undo stack, conversation and draft. Switching tabs hides rather than reloads those workspaces. Native draw.io page tabs still represent pages within one file.

The phone Canvas/Chat footer is removed. The header's assistant toggle switches between drawing and conversation. Closing a changed document offers Save, Discard and Cancel before disposing it. Closing the whole Operations editor requests a save acknowledgement from every open document; failure keeps it open unless the user explicitly chooses to discard. Unsent text is retained across tab switches in sessionStorage, scoped by user in Operations, but is not a server-saved conversation message. Reload restores the selected saved document; the full set of open tabs is not restored.

The initial document lives in the shell, and additional documents use `?documentFrame=1&workbenchId=...`. This also provides a single-document surface for editor regression tests; dedicated workbench tests exercise the real shell. Each document uses one draw.io instance. Eight documents may use substantially more memory than one; inactive frames remain mounted to preserve undo.

## Authenticated integration

EMC opens BrainStorm in a separate browser window from the Technical Brief attachments in Client Request and Project. The root workspace uses `window.opener`; additional document frames retain their same-origin parent bridge. The parent owns the selected entity and all Supabase Storage operations. The child never supplies a different Request/Project to the parent. Both sides validate exact origin and window source; requests have unique IDs and timeouts. The shell relays additional document requests and validates their source window as well.

Operations mode uses the parent bridge exclusively for list/read/save/archive; it never falls back to IndexedDB or applies the local fifty-session eviction policy. Cloud failures retain the current document. A revision mismatch is an error, not an automatic overwrite. Reopen the saved version after exporting any local changes that must be preserved.

The parent obtains the current Supabase access token for same-origin BrainStorm API calls. Only that access token enters request-scoped editor memory; refresh tokens remain in Operations, and neither token appears in a URL, document payload, IndexedDB or localStorage. The BrainStorm proxy rechecks `brainstorm_context` with that user's JWT on every API call, including the existing Operations MFA/member guard. A read-only workspace cannot run diagram-changing chat requests. The editor's graph is disabled for read-only workspaces. Configure Operations-only mode to deny unauthenticated direct use.

Storage uses the private `brainstorm-files` bucket, with immutable `.drawio` XML and companion `.json` session files per revision. Database metadata and revision pointers are committed only after both uploads exist and belong to the current uploader. Compare-and-swap prevents an old window from overwriting a newer revision. A lost response is reconciled by the exact immutable revision path. Failed/uncommitted uploads are private staging objects; a future retention job must use the Storage API, never SQL deletion of storage.objects.

Request-to-Project conversion is resolved by the database. Project lists include drawings originating in its Request; the next save attaches that document to the authoritative Project. Legacy closed Requests and COMPLETED/CANCELLED Projects are read-only. Editing remains restricted to Operations membership with existing MFA checks. EMC extends the existing Expert Project Access package with selected drawing revisions. Experts can download only approved XML attachments; conversation JSON is never disclosed. The current request, leader approval, notification and revocation flow is reused.

## Deployment

1. EMC schema migration was applied on 15 November 2026 as `20261115172205_brainstorm_operations_documents` in project `fzwiphplhspsoktugoqo`. Its source is archived in emc-website `supabase/applied`; do not reapply it.
2. Deploy this BrainStorm branch. Production defaults to Operations-only; the Worker also declares `EMC_OPERATIONS_ONLY=1`. `lib/emc-deployment.ts` supplies the exact EMC origin, Supabase URL and enabled publishable (public, RLS-bound) key. Deployment variables may override them for another environment. No service-role or user tokens are stored in source. CI explicitly builds/runs with `EMC_OPERATIONS_ONLY=0` for standalone regressions. OpenAI credentials remain a separate later step.
3. Set EMC's build-time `NEXT_PUBLIC_BRAINSTORM_URL` to the actual deployed HTTPS editor URL including `/en`, and rebuild EMC. Its header-generation script allows exactly this frame origin on normal pages while preserving private-chat isolation.
4. BrainStorm sets frame-ancestors to self plus the configured Operations origin. No broad Cloudflare wildcard is needed.

The confirmed deployment is `https://brainstorm-worker.exceptionalmasters.workers.dev/`, using the existing `brainstorm-worker` service. EMC defaults to its `/en` route. Keep the Operations opener page open while editing.

## Verification

Local production builds for both repositories passed. All 1,292 root unit tests passed with unmocked fetch and TCP transports disabled. The targeted editor tests cover tab state/origin checks, cloud-only persistence and stale revisions, API authorization, the editor bridge, XML context and toolbox. EMC tests cover SQL/RLS/MFA, terminal locks, conversion, immutable files (including a deliberately broad unrelated Storage policy), stale saves, audit, upload size/path validation, response reconciliation, parent context and CSP. The full EMC panel suite passed.

Local Chromium could not start because the execution environment denies its singleton socket; the checked-in Playwright cases verify desktop/phone tabs, independent drafts and native undo across switches in CI. A quota regression's missing redirect-transport mock was repaired, and the root unit suite now blocks unmocked fetch/TCP transport before fixture data can reach Ollama, Bedrock or other external services. Final Cloudflare/browser acceptance requires the configured live deployments and signed-in Operations access.

## Technical Brief context

Operations first displays a selection/edit dialog. `OPEN WITH BRIEF` passes only the approved text; `SKIP BRIEF` passes an empty string. The complete raw Brief is never returned by the bridge by default. Operations opens directly into the drawing canvas. With a selected Brief, a new file is named Drawing from brief and the existing brief-drawing prompt plus selected text is prepared in the AI composer for review. Skip Brief opens a blank canvas with the assistant collapsed. There is no Brief banner above the workspace. Every model request carries `conceptBrief`; the route bounds it to 30,000 characters and adds it to the newest user message as reference data, never a system instruction. No generation occurs on launch. Operations saves the selected concept snapshot with the document session JSON. The OpenAI API account/key connection is deferred.

The popup bridge validates the exact opener window and configured Operations origin, and retains all-document flush acknowledgements before `SAVE & CLOSE EDITOR`. Missing/closed openers fail immediately. Storage remains private Supabase Storage; there is no local-storage fallback.

## Drawing toolbar and contextual formatting

The web workspace adds a horizontally scrollable toolbar below its menu: zoom, fit, native insertion and connector menus, fill/line colour, and direct Style/Text/Arrange shortcuts. Controls call the pinned draw.io actions and menus; the native model transactions own undo/redo and autosave. On small screens the tools scroll inside their row rather than widening the workspace. The MCP canvas shell is unchanged.

The right-hand native panel is contextual: no selection shows Diagram/Style, selecting a shape or connector exposes Style/Text/Arrange, and in-place text editing shows Text. Text/Arrange shortcuts are disabled without a selection, with icon tooltips. The adapter selects translated native tabs by their resource title rather than hard-coded tab indices. Operations read-only and busy states disable mutation tools.

## Pointer tools

The toolbar begins with Select and Edit Polygon. Select stops native freehand, hides its window, commits in-place text and calls the graph's native escape/reset without broadcasting the application Escape shortcut or clearing selected objects. Edit Polygon delegates to draw.io's native vertex editor and is enabled only for a supported `mxgraph.basic.polygon` selection. Draw.io does not expose a universal vertex-edit mode for all stencil shapes. Edit > Edit connection points is separate and edits attachment constraints rather than the polygon outline. These operations retain native undo/autosave and graph permission checks.


## AutoSave and closing documents

Each open document has an independent AutoSave switch next to its filename. AutoSave uses the same storage adapter as manual session saving: Supabase Storage through the authenticated Operations opener in Operations mode, IndexedDB in the standalone editor. Operations uses its default save target without a Browser/Cloud selector; standalone mode is labelled Local; opening a standalone preview does not authenticate it to Operations or Supabase.

Before a new unnamed drawing is first saved, the editor asks for a filename. Cancelling keeps its changes in memory and pauses repeated automatic name prompts until AutoSave is re-enabled or the user saves manually. AutoSave Off suppresses automatic writes, including visibility-change saving. Save remains available. The header keeps Unsaved until a successful write acknowledges the current changes; failures retain the drawing. Native format/tool menus are compact icon controls with accessible names.

Close drawing and document-tab X offer Save, Discard and Cancel when there are pending changes. A failed or cancelled save retains the document. Closing/reloading the browser tab or window uses the browser's standard beforeunload confirmation, including unsaved background workbench documents. Browsers control its text and may suppress it without prior user interaction; a tab-close event cannot reliably await a network upload.


## Production rollout

The Operations popup test drives the real draw.io workspace through a cross-origin opener, saves/reopens a named file through a mocked authenticated parent, checks the Cloud status and verifies that no diagram IndexedDB database is created. It also verifies that reopening with Skip Brief supplies no old concept context. EMC tests separately exercise its actual Storage adapter, origin/source validation, latest-brief preparation and the deployed SQL permission model in isolated fixtures. These do not replace a signed-in live acceptance save in a real Request/Project.

The web drawing controls are consolidated in one row above the canvas. After a successful same-origin connection, the redundant native simple toolbar is hidden. Undo/redo, delete, view/zoom/page controls, basic shapes, text, freehand and native menus remain reachable; fallback editors retain their original toolbar.


## Save commands

In Operations, Save commits the current document through the authenticated parent. Save As opens a dedicated filename dialog and creates a new document with the current drawing and conversation, leaving the original unchanged. Successful Save As adopts the new document ID and invalidates writes queued for the original generation. Failure retains the original document and keeps the dialog open. Export opens the separate file-format/download dialog. Ctrl/Cmd+S saves; Ctrl/Cmd+Shift+S opens Save As in Operations.

## EMC OpenAI, Web research and reusable symbols

Production adds `server:emc-openai:default` as the default, labelled **EMC OpenAI**.
Existing personal and other server models remain selectable; a saved user choice
is preserved. The actual model is resolved by the Supabase `brainstorm-ai` gateway
from `OPENAI_BRAINSTORM_MODEL` or the existing `OPENAI_MODEL` secret. BrainStorm
never needs a copy of `OPENAI_API_KEY`: the SDK's Responses requests use the current
Operations JWT to authenticate the fixed gateway, which checks the user, MFA,
workspace and rate reservation before calling OpenAI with the existing server key.

The assistant panel has a Web switch with explicit enable consent and a red border
plus WEB ACTIVE label. While enabled, AI tools research only; native manual drawing
remains available. Turning Web off aborts research/draft requests and stops the AI
turn. Subsequent AI drawing requests have no research tool. Search is also directly
available in the Research field. Web research always uses the managed EMC model,
including when the user selects a different drawing model.

`search_device` is a client tool that calls the protected research endpoint with
only the device query and puts the results in the panel. Ambiguous model/package
information prompts clarification. Results contain up to five cited sources and
optional actual thumbnails from hosted image search results. A result's Create symbol button requests a
source-backed draft; missing pin evidence returns questions. The approval modal
shows a vector preview, pin labels, side controls and per-pin evidence links. Cancel
performs no library write or canvas insertion. Approve saves through Operations
checks and inserts native cells in one undoable graph transaction. Library symbols
can be filtered and inserted again with Web off. A failed insertion after a
successful save reports that the symbol is available in the library.

Server relay: `/api/emc/{research,draft,approve,library,symbol}`. Supabase migration,
Edge gateway, SQL/ACL tests and deployment notes live in the EMC repository. Drawing
requests never enable hosted Web search, so the full brief, canvas, conversation
and attachments are not forwarded as search input. No secret belongs in a public
Next.js variable, localStorage, sessionStorage, diagram, URL or window message.

Verification: unit tests exercise native port geometry, unsafe/duplicate inputs,
model selection, actual SDK gateway headers, Web opt-in and late-result cancellation.
The Operations popup browser test exercises consent/cancel, clarification, five
references, rejected/approved previews and repeated library insertion using mocked
API boundaries and the real native draw.io editor. No real user data or paid model
requests are used by these tests.

### Mobile/background Operations tabs

The context handshake now includes the current access token and expiry, pinned to
its canonical workspace. Only that access token is retained in module memory;
refresh tokens stay in Operations. It is stripped from the public chat context
and is never saved in a document, browser storage or URL. A valid in-memory lease
avoids a postMessage authorisation round trip before each API call. API middleware
and the Supabase gateway still verify current Operations permissions on every
request. A 401 clears the lease; expiry requires renewal from Operations.

Document list/get/save/archive requests use `/api/operations-documents` while a
valid lease exists. This user-JWT-only adapter preserves the existing private
Storage policies, canonical context, read-only checks, immutable uploads, CAS
revision checks and exact-revision reconciliation. No service key is used. The
legacy parent bridge remains available for older Operations pages. Known child
frames can bootstrap their context/lease through the active workspace instead of
waking the external Operations tab. After access expires the message explicitly
asks the user to activate Operations and retry, keeping the drawing open.

Regression coverage freezes the parent bridge after bootstrap, then exercises the
actual popup, API-backed saves, Web research, symbol approval and library reuse.
Unit tests verify memory-only credentials, invalidation on 401, user-scoped Storage,
canonical paths, read-only refusal, upload failure and lost-commit reconciliation.

### Managed reply deadlines

EMC OpenAI now has a 125-second server request deadline and no automatic transport
retries. The gateway fetch preserves both the SDK cancellation signal and the
client disconnect signal. Device research/draft relay requests also have a
125-second deadline. The client independently stops a managed reply after three
minutes of wall-clock time, including when a suspended mobile tab resumes. SSE
keep-alives and reasoning chunks do not reset this limit. The drawing remains in
the editor and retry is explicit. Other configured providers retain their existing
settings. The Supabase SSE relay records failed/interrupted/cancelled responses,
not only clean end-of-stream events; a missing final usage report is unknown cost,
not a zero-token response.
