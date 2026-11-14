# Manual drawing — first delivery

The start screen offers Draw manually before the AI composer. It dismisses the start screen, closes the desktop assistant and selects Canvas on phones. No model or API key is required. The existing secondary entry opens the canvas with the assistant, and the assistant can be opened later without sending a request.

When the assistant is hidden, the canvas toolbar provides the current diagram's menu, local file import, export and settings. On phones these controls are available in Canvas. Existing draw.io drawing tools, undo and redo remain available.

Diagrams currently use the existing browser-local session storage and file export. This delivery does not claim project attachment, Supabase persistence, cross-device access or a completed EMC project header. Those need the next integration stage and authenticated project permissions.

Validation: tests/e2e/manual-drawing.spec.ts checks desktop and phone entry without model credentials, local import, export dialog and optional assistant access, with model endpoints blocked and monitored.
