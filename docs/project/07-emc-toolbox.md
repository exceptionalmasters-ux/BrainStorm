# EMC shape toolbox

The web editor reserves a 52 px left rail for grouped icons: basic shapes (including text), lines/arrows, flowcharts/UML/BPMN/ER, technical libraries, network/cloud, search and recently inserted shapes. All libraries opens draw.io's complete built-in catalogue; the small initial palette does not restrict the catalogue.

Groups use draw.io's existing sidebar, templates, search and drag handlers in the iframe's own document. The flyout header adds pin, full catalogue and close actions, styled in EMC black/gold/green. Unpinned flyouts close after a canvas pointer gesture completes, preserving the native drag operation. Escape closes the flyout when no draw.io popup/dialog is open. Pinned flyouts remain while working on the canvas.

Group filters are temporary and do not write a restricted list to draw.io settings. Closing restores the saved library selection. Recent templates are deep copies of the last twelve insertion groups in the open editor, held in memory only. They are not sent to AI or stored on a server.

The original draw.io toolbar remains available. The shared MCP canvas and external cross-origin editors retain their existing layout; the EMC rail is enabled only for the web workspace with direct editor access. Its adapter checks for the expected APIs of pinned draw.io v32.0.2.

Validation: shape-toolbox unit tests cover filters, restoration, pin/dismiss, native search/catalogue, copied recent templates, listener cleanup and unavailable editor APIs. Chromium tests cover real shape dragging and recent shapes, pinning, technical groups, search focus, full library dialogue and phone flyout controls without reloading the iframe.
