import { describe, expect, it } from "vitest"
import { ATTACHMENT_ACCEPT, isDiagramFile } from "@/components/chat/attachments"
import {
    diagramFileTitle,
    STORM_EXTENSION,
    STORM_SVG_EXTENSION,
    stripDiagramExtension,
} from "@/lib/diagram-file-format"

describe("BrainStorm file names", () => {
    it("uses .storm for documents and .storm.svg for editable SVG", () => {
        expect(STORM_EXTENSION).toBe(".storm")
        expect(STORM_SVG_EXTENSION).toBe(".storm.svg")
        expect(ATTACHMENT_ACCEPT.split(",")).toContain(".storm")
    })
    it("opens new and legacy diagrams rather than attaching them to chat", () => {
        for (const name of [
            "plan.storm",
            "plan.STORM",
            "plan.storm.svg",
            "plan.drawio",
            "plan.drawio.svg",
        ]) {
            expect(isDiagramFile(new File(["<mxfile/>"], name))).toBe(true)
            expect(stripDiagramExtension(name)).toBe("plan")
            expect(diagramFileTitle(name)).toBe("plan")
        }
        expect(isDiagramFile(new File(["text"], "plan.storm.txt"))).toBe(false)
        expect(stripDiagramExtension("plan.v2")).toBe("plan.v2")
        expect(diagramFileTitle("plan.xml")).toBe("plan")
        expect(diagramFileTitle("plan.svg")).toBe("plan")
        expect(diagramFileTitle("plan.svg.storm")).toBe("plan.svg")
    })
})
