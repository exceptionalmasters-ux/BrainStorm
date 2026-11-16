import { create } from "zustand"

/** Each workbench document has its own window/store and independent save preference. */
export const useDocumentSaveStore = create<{
    autoSave: boolean
    dirty: boolean
    saving: boolean
    naming: boolean
    setAutoSave: (enabled: boolean) => void
}>((set) => ({
    autoSave: true,
    dirty: false,
    saving: false,
    naming: false,
    setAutoSave: (autoSave) => set({ autoSave }),
}))
