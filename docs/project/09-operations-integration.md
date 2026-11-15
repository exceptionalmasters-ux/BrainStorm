# Operations integration and document tabs

BrainStorm is the drawing module of EMC Operations. Collaborative editing is deferred; this delivery does not broadcast diagrams or introduce shared drawing sessions.

## Documents and UI

The web workbench has a bottom strip of open documents (maximum eight). New diagram creates an internal document tab, not a browser popup. Recent diagrams focuses an already open document or opens another tab. A local file opens into an empty starter or a separate document tab when work already exists. Each additional document keeps its own same-origin workspace iframe, React state, native draw.io undo stack, conversation and draft. Switching tabs hides rather than reloads those workspaces. Native draw.io page tabs still represent pages within one file.

The phone Canvas/Chat footer is removed. The header's assistant toggle switches between drawing and conversation. Closing a document saves its changed diagram/conversation before disposing it. Closing the whole Operations editor requests a save acknowledgement from every open document; failure keeps it open unless the user explicitly chooses to discard. Unsent text is retained across tab switches in sessionStorage, scoped by user in Operations, but is not a server-saved conversation message. Reload restores the selected saved document; the full set of open tabs is not restored.

The initial document lives in the shell, and additional documents use `?documentFrame=1&workbenchId=...`. This also provides a single-document surface for editor regression tests; dedicated workbench tests exercise the real shell. Each document uses one draw.io instance. Eight documents may use substantially more memory than one; inactive frames remain mounted to preserve undo.

## Authenticated integration

EMC opens BrainStorm in a separate browser window from the Technical Brief attachments in Client Request and Project. The root workspace uses `window.opener`; additional document frames retain their same-origin parent bridge. The parent owns the selected entity and all Supabase Storage operations. The child never supplies a different Request/Project to the parent. Both sides validate exact origin and window source; requests have unique IDs and timeouts. The shell relays additional document requests and validates their source window as well.

Operations mode uses the parent bridge exclusively for list/read/save/archive; it never falls back to IndexedDB or applies the local fifty-session eviction policy. Cloud failures retain the current document. A revision mismatch is an error, not an automatic overwrite. Reopen the saved version after exporting any local changes that must be preserved.

The parent obtains the current Supabase access token for same-origin BrainStorm API calls. Only that access token enters request-scoped editor memory; refresh tokens remain in Operations, and neither token appears in a URL, document payload, IndexedDB or localStorage. The BrainStorm proxy rechecks `brainstorm_context` with that user's JWT on every API call, including the existing Operations MFA/member guard. A read-only workspace cannot run diagram-changing chat requests. The editor's graph is disabled for read-only workspaces. Configure Operations-only mode to deny unauthenticated direct use.

Storage uses the private `brainstorm-files` bucket, with immutable `.drawio` XML and companion `.json` session files per revision. Database metadata and revision pointers are committed only after both uploads exist and belong to the current uploader. Compare-and-swap prevents an old window from overwriting a newer revision. A lost response is reconciled by the exact immutable revision path. Failed/uncommitted uploads are private staging objects; a future retention job must use the Storage API, never SQL deletion of storage.objects.

Request-to-Project conversion is resolved by the database. Project lists include drawings originating in its Request; the next save attaches that document to the authoritative Project. Legacy closed Requests and COMPLETED/CANCELLED Projects are read-only. Editing remains restricted to Operations membership with existing MFA checks. EMC extends the existing Expert Project Access package with selected drawing revisions. Experts can download only approved XML attachments; conversation JSON is never disclosed. The current request, leader approval, notification and revocation flow is reused.

## Deployment

1. EMC schema migration was applied on 15 November 2026 as `20261115172205_brainstorm_operations_documents` in project `fzwiphplhspsoktugoqo`. Its source is archived in emc-website `supabase/applied`; do not reapply it.
2. Deploy this BrainStorm branch with these build/runtime variables:
   - `NEXT_PUBLIC_EMC_OPERATIONS_ORIGIN=https://exceptionalmasters.co.uk` (exact Operations origin; configure preview origins separately).
   - `EMC_OPERATIONS_ONLY=1` (needed during build as well as at runtime).
   - `EMC_SUPABASE_URL=https://fzwiphplhspsoktugoqo.supabase.co`.
   - `EMC_SUPABASE_PUBLISHABLE_KEY` = the existing project's publishable key, never service_role.
   - Existing server model variables, including the server-only provider key.
3. Set EMC's build-time `NEXT_PUBLIC_BRAINSTORM_URL` to the actual deployed HTTPS editor URL including `/en`, and rebuild EMC. Its header-generation script allows exactly this frame origin on normal pages while preserving private-chat isolation.
4. BrainStorm sets frame-ancestors to self plus the configured Operations origin. No broad Cloudflare wildcard is needed.

The confirmed deployment is `https://brainstorm-worker.exceptionalmasters.workers.dev/`, using the existing `brainstorm-worker` service. EMC defaults to its `/en` route. Keep the Operations opener page open while editing.

## Verification

Local production builds for both repositories passed. All 1,292 root unit tests passed with unmocked fetch and TCP transports disabled. The targeted editor tests cover tab state/origin checks, cloud-only persistence and stale revisions, API authorization, the editor bridge, XML context and toolbox. EMC tests cover SQL/RLS/MFA, terminal locks, conversion, immutable files (including a deliberately broad unrelated Storage policy), stale saves, audit, upload size/path validation, response reconciliation, parent context and CSP. The full EMC panel suite passed.

Local Chromium could not start because the execution environment denies its singleton socket; the checked-in Playwright cases verify desktop/phone tabs, independent drafts and native undo across switches in CI. A quota regression's missing redirect-transport mock was repaired, and the root unit suite now blocks unmocked fetch/TCP transport before fixture data can reach Ollama, Bedrock or other external services. Final Cloudflare/browser acceptance requires the configured live deployments and signed-in Operations access.

## Technical Brief context

Operations first displays a selection/edit dialog. `OPEN WITH BRIEF` passes only the approved text; `SKIP BRIEF` passes an empty string. The complete raw Brief is never returned by the bridge by default. Context is visible as an expandable reference panel, separate from the composer. Every model request carries `conceptBrief`; the route bounds it to 30,000 characters and adds it to the newest user message as reference data, never a system instruction. No generation occurs on launch. Operations saves the selected concept snapshot with the document session JSON. The OpenAI API account/key connection is deferred.

The popup bridge validates the exact opener window and configured Operations origin, and retains all-document flush acknowledgements before `SAVE & CLOSE EDITOR`. Missing/closed openers fail immediately. Storage remains private Supabase Storage; there is no local-storage fallback.

## Drawing toolbar and contextual formatting

The web workspace adds a horizontally scrollable toolbar below its menu: zoom, fit, native insertion and connector menus, fill/line colour, and direct Style/Text/Arrange shortcuts. Controls call the pinned draw.io actions and menus; the native model transactions own undo/redo and autosave. On small screens the tools scroll inside their row rather than widening the workspace. The MCP canvas shell is unchanged.

The right-hand native panel is contextual: no selection shows Diagram/Style, selecting a shape or connector exposes Style/Text/Arrange, and in-place text editing shows Text. Text/Arrange shortcuts are disabled without a selection, with a visible selection hint. The adapter selects translated native tabs by their resource title rather than hard-coded tab indices. Operations read-only and busy states disable mutation tools.
