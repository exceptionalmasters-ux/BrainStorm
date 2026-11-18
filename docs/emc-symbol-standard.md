# EMC symbol layout

This is an EMC drawing convention aligned with the installed draw.io Electronics shapes, not a claim of formal IEC/IEEE certification. It applies to newly generated source-backed symbols. Existing drawings and legacy symbols retain their geometry.

| Property | Default |
| --- | --- |
| Drawing grid | 10 draw.io units |
| Fine adjustment | 5 units, when selected in the native editor |
| Adjacent pin pitch | 20 units; larger when a long identifier needs clearance |
| Recommended manual separation of functional groups | 40 units |
| External pin stem | Approximately 20 units |
| Pin number and name | Helvetica 12 |
| Reference | Helvetica 12 bold |
| Symbol title | Helvetica 14 |
| Body and leads | Black, 1-unit stroke |
| Connection point | Filled black 6-unit circle, one connection constraint at its centre |
| Compact preset | Font 10, minimum pitch 20 |
| Spacious preset | Font 12, minimum pitch 30 |

At the native document conversion of 100 units per inch, 10 units is 2.54 mm. This describes document size, not real component dimensions or apparent size on a particular screen. Symbols are schematic representations, not PCB footprints.

The bundled Electronics library uses approximately 100×20 for a resistor, 100×50 for a relay, 100×200 for DIP and 200×200 for QFP, with 20-unit IC pin spacing and font 12. Dense ICs need more room for legible names. Some existing shapes have terminals outside the 10-unit grid; they are not resized automatically.

## Faithful source view

The generated body retains the source aspect ratio, chamfers, orientation, pin-1 marker and normalized pad positions. Source size values do not directly dictate insertion size. A shared deterministic layout calculates a readable size from pin count and label widths. It never divides by the distance of a pad from a corner.

External connection centres align to the 10-unit grid. Short non-connectable adapter lines join those centres to the original pad positions. Pin names remain inside the body and pin numbers remain separate. Preview and insertion use the same layout. Choosing Compact/Standard/Spacious is saved with the symbol.

Physical pad order is preserved. A functionally regrouped schematic representation would be a separate future option.

## PDF generation

Web PDFs and uploaded PDFs use the same draft action. The shared instructions field accepts, for example: “Use the drawing on page 2 and the pin table on pages 3–4.” Page numbers mean PDF pages starting at 1. PDF input includes high-detail page images so raster diagrams/tables can be read. Instructions persist through analysis and retries.

Selecting a documented source resolves which variant to draw; uncertainty from an earlier broad search must not reject that source. No pins are fabricated. A partial source-backed proposal is labelled incomplete and requires explicit acceptance. A failed read with no confirmed pins does not create a blank block.

The gateway keeps the last four draft diagnostics in the private research record: selected source, instructions, pin counts, per-field validation errors and bounded model output. Raw model output is not returned to the frontend. These diagnostics distinguish provider completion from successful symbol generation.

## Preview protection

Cancel, X, Escape and outside clicks request confirmation before discarding an unsaved proposal. Closing/reloading the browser tab also invokes the browser's standard unsaved-changes protection. Successful save closes normally.

## Validation limits

Automated fixtures verify PDF forwarding, page instructions, variant handling, validation, geometry, native connection constraints and preview controls. They do not establish that an AI model correctly reads every real datasheet. A real HC-05 generation still needs inspection against pages 2–4, especially all 34 pin names/numbers and the viewing orientation.
