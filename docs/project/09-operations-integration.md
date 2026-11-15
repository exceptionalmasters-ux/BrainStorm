# Operations integration and document tabs

BrainStorm is the drawing module of EMC Operations. Collaborative editing is deferred; this delivery does not broadcast diagrams or introduce shared drawing sessions.

## Documents and UI

The web workbench has a bottom strip of open documents (maximum eight). New diagram creates an internal document tab, not a browser popup. Recent diagrams focuses an already open document or opens another tab. A local file opens into an empty starter or a separate document tab when work already exists. Each additional document keeps its own same-origin workspace iframe, React state, native draw.io undo stack, conversation and draft. Switching tabs hides rather than reloads those workspaces. Native draw.io page tabs still represent pages within one file.

The phone Canvas/Chat footer is removed. The header's assistant toggle switches between drawing and conversation. Closing a document saves its changed diagram/conversation before disposing it. Closing the whole Operations editor requests a save acknowledgement from every open document; failure keeps it open unless the user explicitly chooses to discard. Unsent text is retained across tab switches in sessionStorage, scoped by user in Operations, but is not a server-saved conversation message. Reload restores the selected saved document; the full set of open tabs is not restored.

The initial document lives in the shell, and additional documents use `?documentFrame=1&workbenchId=...`. This also provides a single-document surface for editor regression tests; dedicated workbench tests exercise the real shell. Each document uses one draw.io instance. Eight documents may use substantially more memory than one; inactive frames remain mounted to preserve undo.

## Authenticated integration

EMC embeds BrainStorm from Client Request and Project Drawings sections. The parent owns the selected entity and all Supabase Storage operations. The child never supplies a different Request/Project to the parent. Both sides validate exact origin and window source; requests have unique IDs and timeouts. The shell relays additional document requests and validates their source window as well.

Operations mode uses the parent bridge exclusively for list/read/save/archive; it never falls back to IndexedDB or applies the local fifty-session eviction policy. Cloud failures retain the current document. A revision mismatch is an error, not an automatic overwrite. Reopen the saved version after exporting any local changes that must be preserved.

The parent obtains the current Supabase access token for same-origin BrainStorm API calls. Only that access token enters request-scoped editor memory; refresh tokens remain in Operations, and neither token appears in a URL, document payload, IndexedDB or localStorage. The BrainStorm proxy rechecks `brainstorm_context` with that user's JWT on every API call, including the existing Operations MFA/member guard. A read-only workspace cannot run diagram-changing chat requests. The editor's graph is disabled for read-only workspaces. Configure Operations-only mode to deny unauthenticated direct use.

Storage uses the private `brainstorm-files` bucket, with immutable `.drawio` XML and companion `.json` session files per revision. Database metadata and revision pointers are committed only after both uploads exist and belong to the current uploader. Compare-and-swap prevents an old window from overwriting a newer revision. A lost response is reconciled by the exact immutable revision path. Failed/uncommitted uploads are private staging objects; a future retention job must use the Storage API, never SQL deletion of storage.objects.

Request-to-Project conversion is resolved by the database. Project lists include drawings originating in its Request; the next save attaches that document to the authoritative Project. Legacy closed Requests and COMPLETED/CANCELLED Projects are read-only. Access is Operations membership with the existing MFA checks; Expert disclosure is not added by this delivery.

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

The supplied target name was `brainstorm-workers`; GitHub's latest dev check still links to the existing `brainstorm-worker` service. The checked-in worker name is retained until the intended target URL/service is confirmed; do not create/rename a worker just to configure the iframe URL.

## Verification

Local production builds for both repositories passed. The targeted editor tests cover tab state/origin checks, cloud-only persistence and stale revisions, API authorization, the editor bridge, XML context and toolbox. EMC tests cover SQL/RLS/MFA, terminal locks, conversion, immutable files (including a deliberately broad unrelated Storage policy), stale saves, audit, upload size/path validation, response reconciliation, parent context and CSP. The full EMC panel suite passed.

Local Chromium could not start because the execution environment denies its singleton socket; the checked-in Playwright cases verify desktop/phone tabs, independent drafts and native undo across switches in CI. A quota regression's missing redirect-transport mock was repaired so its fake Ollama endpoint cannot trigger real network requests. Final Cloudflare/browser acceptance requires the configured live deployments and signed-in Operations access.
