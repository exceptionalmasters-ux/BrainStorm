# Editor workbench

The start page contains the three drawing starters, Open file and recent diagrams. Its embedded chat composer, promotional MCP video and example tiles are removed. Choosing the assistant or preparing a brief opens the editor without sending an AI request.

The editor has a file-title row and File/Edit/View/Insert/Arrange/Tools/Window/Help menus. Commands dispatch to the pinned draw.io action registry and honour its enabled state and toggle callbacks. Existing native quick tools remain below the menu; the floating local-file toolbar is replaced by the header. File Save downloads an editable .drawio file. Save as/Export use the existing format/name dialog. Browser-local autosave remains separate from file downloads; no project/server save is claimed.

Storage, import/export and assistant callbacks belong to the workspace rather than the native action adapter. Future authenticated project storage, brief import and additional insert/layout tools can extend those callbacks and existing menu groups. There are no simulated project operations.

Native palettes now float above the drawing instead of reducing the graph viewport. This avoids draw.io renormalising page padding when the available width changes. The adapter also preserves the complete drawing-to-screen transform (scale, translation and scroll) on both opening and closing, including zero scroll and user zoom/pan while open. The native sidebar's scroll adjustment alone did not undo changes to view translation. Regression tests repeat opening/closing and compare drawing and paper coordinates.

Validation includes adapter unit tests, live Chromium menu commands/local download, clean-start assertions, repeated native palette cycles and the existing drawing/AI workflows. Shared E2E setup explicitly enters the assistant workspace by default; start-screen cases opt into the start screen. Removed UI-only example/video tests correspond to removed home features; cached-response and assistant attachment behavior remain tested separately.
