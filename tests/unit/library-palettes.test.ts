import { expect, it, vi } from "vitest"
import { expandLibraryPalette } from "../../lib/library-palettes"

it("uses native deferred expansion once and supports library prefixes", () => {
    const title = document.createElement("button")
    const wrapper = document.createElement("div")
    const contents = document.createElement("div")
    contents.className = "geSidebar"
    contents.style.display = "none"
    wrapper.append(contents)
    const initialize = vi.fn(() => {
        contents.style.display = "block"
    })
    title.addEventListener("click", initialize)
    const sidebar = {
        configuration: [
            { id: "electrical", prefix: "electrical", libs: ["Abstract"] },
        ],
        palettes: { electricalAbstract: [title, wrapper] },
    }
    expandLibraryPalette(sidebar, "electrical")
    expandLibraryPalette(sidebar, "electrical")
    expect(initialize).toHaveBeenCalledOnce()
})
