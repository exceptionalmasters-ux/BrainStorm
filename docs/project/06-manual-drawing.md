# Manual drawing — first delivery

The start screen offers three illustrated choices before the AI composer: Blank drawing, Drawing from brief with AI, and Draw on the fly. Existing examples, the composer, local file opening and recent diagrams remain available.

Blank drawing dismisses the start screen, closes the desktop assistant and selects Canvas on phones. No model or API key is required. Draw on the fly opens and focuses the assistant without sending a request. The brief starter accepts a pasted Technical Brief and prepares an editable prompt for review, replacing the current prompt. No AI call is made until Send. Direct import of selected fields from EMC Client Requests/Projects is a later authenticated integration stage.

When the assistant is hidden, the canvas toolbar provides the current diagram's menu, local file import, export and settings. On phones these controls are available in Canvas. Existing draw.io drawing tools, undo and redo remain available.

Diagrams currently use the existing browser-local session storage and file export. This delivery does not claim project attachment, Supabase persistence, cross-device access or a completed EMC project header. Those need the next integration stage and authenticated project permissions.

Validation: tests/e2e/manual-drawing.spec.ts checks desktop and phone entry without model credentials, local import, export dialog and optional assistant access, with model endpoints blocked and monitored.
