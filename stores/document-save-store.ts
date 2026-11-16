import { create } from "zustand"

/** Each workbench document has its own window/store and independent save preference. */
export const useDocumentSaveStore = create<{
    autoSave: boolean
    dirty: boolean
    saving: boolean
    setAutoSave: (enabled: boolean) => void
}>((set) => ({
    autoSave: true,
    dirty: false,
    saving: false,
    setAutoSave: (autoSave) => set({ autoSave }),
}))
