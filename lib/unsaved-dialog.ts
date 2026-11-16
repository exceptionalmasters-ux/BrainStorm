/** In-app closes can offer three choices; browser tab closes use beforeunload. */
export function askUnsavedChanges(): Promise<"save" | "discard" | "cancel"> {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog")
        dialog.className =
            "rounded-lg border border-border bg-card p-6 text-foreground shadow-xl max-w-sm backdrop:bg-black/50"
        dialog.setAttribute("aria-label", "Unsaved changes")
        const title = document.createElement("h2")
        title.className = "mb-2 text-lg font-semibold"
        title.textContent = "Unsaved changes"
        const text = document.createElement("p")
        text.className = "mb-5 text-sm"
        text.textContent = "Save your changes before closing this drawing?"
        const buttons = document.createElement("div")
        buttons.className = "flex flex-wrap justify-end gap-2"
        const finish = (choice: "save" | "discard" | "cancel") => {
            dialog.close()
            dialog.remove()
            resolve(choice)
        }
        for (const [choice, label] of [
            ["cancel", "Cancel"],
            ["discard", "Discard"],
            ["save", "Save"],
        ] as const) {
            const button = document.createElement("button")
            button.textContent = label
            button.className =
                "rounded border border-border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
            button.onclick = () => finish(choice)
            buttons.append(button)
        }
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault()
            finish("cancel")
        })
        dialog.append(title, text, buttons)
        document.body.append(dialog)
        dialog.showModal()
    })
}
