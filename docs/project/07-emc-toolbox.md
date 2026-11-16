# EMC shape toolbox

The web editor reserves a 52 px left rail for grouped icons: basic shapes (including text), lines/arrows, flowcharts/UML/BPMN/ER, technical libraries, network/cloud, search and recently inserted shapes. All libraries opens draw.io's complete built-in catalogue; the small initial palette does not restrict the catalogue.

Groups use draw.io's existing sidebar, templates, search and drag handlers in the iframe's own document. The flyout header adds pin, full catalogue and close actions, styled in EMC black/gold/green. Unpinned flyouts close after a canvas pointer gesture completes, preserving the native drag operation. Escape closes the flyout when no draw.io popup/dialog is open. Pinned flyouts remain while working on the canvas.

Group filters are temporary and do not write a restricted list to draw.io settings. Closing restores the saved library selection. Recent templates are deep copies of the last twelve insertion groups in the open editor, held in memory only. They are not sent to AI or stored on a server.

The original draw.io toolbar remains available. The shared MCP canvas and external cross-origin editors retain their existing layout; the EMC rail is enabled only for the web workspace with direct editor access. Its adapter checks for the expected APIs of pinned draw.io v32.0.2.

Validation: shape-toolbox unit tests cover filters, restoration, pin/dismiss, native search/catalogue, copied recent templates, listener cleanup and unavailable editor APIs. Chromium tests cover real shape dragging and recent shapes, pinning, technical groups, search focus, full library dialogue and phone flyout controls without reloading the iframe.

### Incomplete research proposals, retries and mobile assistant

If research cannot provide a full pin map, Create symbol shows missing-information questions plus **Create anyway** / **Dismiss**. Create anyway requests an explicitly incomplete preview, including only source-backed pins or a port-free device block. Unknown physical pin assignments are never guessed. The approval dialog warns, and incomplete metadata and an unverified label persist in the EMC library and inserted cells. Approval is still required separately.

Operations writes serialize per document with a stable logical revision UUID and retained immutable retry payload. A lost acknowledgement is reconciled before saving newer edits. Other-window conflicts remain protected and report Save As recovery instead of advising browser-history deletion. First-save retries retain the provisional document ID.

On mobile, AI requests leave chat visible. Use the hide control to return to the canvas and the assistant control to reopen it.

### Visual datasheet analysis

Symbol drafts attach the cited direct PDF to Responses as an `input_file` with high image detail, or the retrieved full-size source image as `input_image`. The source remains public research data; no brief or Operations credentials are forwarded with it. A source-kind indicator distinguishes actual PDF/image input from a summary-only result. The model inspects the mechanical/pin drawing, pad labels, side, order and orientation. Numeric numbering is optional: a documented signal label can be the stable pad identifier without fabricated sequential numbers. Optional bounded body dimensions, antenna region and normalized edge positions survive approval, library storage, preview and native insertion. Previously confirmed partial maps are retained through an incomplete retry.

### Private source attachments and independent EMC access

Use **From file · attachments** to upload PDF, PNG/JPEG/WebP, TXT/MD or DOCX (10 MB maximum) into private Supabase Storage. The upload uses the short-lived Operations user JWT and a row-locking RLS guard, not a reusable upload ticket. Completion validates size and file signature before activation. File analysis and subsequent symbol drafting work with Web off, use the shared managed model and record zero Web-search calls. PDF/image input includes visuals; DOCX/text input supplies text. Pending uploads can be completed or moved to trash. Source links request short-lived private downloads.

The file panel has active/trash views, restore and explicit permanent-delete confirmation. Trashed files cannot be analysed or downloaded. Permanent deletion serializes against upload/restore, removes the Storage object and then its record; failed purges remain retryable. Already approved symbols/drawings are separate derived artifacts.

The editor no longer needs the source Operations tab after bootstrap. Navigating away does not close it. Cached in-memory access supports independent saves and API calls. **Reconnect EMC** opens a narrow platform session-handoff page, verifies the existing EMC login/MFA and pinned workspace and returns only a short-lived JWT to the exact configured editor origin/window/nonce. Refresh credentials never leave EMC or enter editor persistence/URLs. The context ID/type in the URL are nonsecret routing data and permit reconnect after reload; a workspace still starts from Client Requests/Projects. Account changes require a new editor to avoid cross-account writes. Server-side context checks verify the originating Auth session still exists, so sign-out/revocation does not depend on the source tab.

### Drawing duration and Worker library docs

Drawing/chat and local-file analysis/drafting have no application wall-clock deadline. Stop, disconnect and account/session checks still cancel requests. Web lookup alone retains its upstream/network deadline and the Web-mode UI watchdog. This does not remove provider or host CPU, memory, request or token limits: Cloudflare 1102 is a resource failure, not a drawing timeout.

The Workers get_shape_library tool reads a bundled snapshot of all 30 library documents, including electrical, instead of process.cwd()/filesystem paths. MCP filesystem lookup remains compatible. Regression tests compare the bundled docs with the source documents; update the snapshot with doc changes.
