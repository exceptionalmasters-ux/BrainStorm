"use client"
import { useEffect, useState } from "react"
import { emcAction } from "@/stores/device-research-store"

export function UniqueNameStatus({
    name,
    kind,
    onValid,
    excludeId,
}: {
    name: string
    kind: "symbol" | "drawing" | "source"
    onValid: (valid: boolean) => void
    excludeId?: string
}) {
    const [status, setStatus] = useState("")
    useEffect(() => {
        onValid(false)
        if (!name.trim()) {
            setStatus("")
            return
        }
        const controller = new AbortController()
        setStatus("Checking name…")
        const timer = setTimeout(() => {
            void emcAction<{ available: boolean }>(
                "name-available",
                { kind, name, excludeId },
                controller.signal,
            )
                .then((data) => {
                    if (controller.signal.aborted) return
                    onValid(data.available === true)
                    setStatus(
                        data.available
                            ? "Name available"
                            : "This name already exists. Choose another name.",
                    )
                })
                .catch((error) => {
                    if (!controller.signal.aborted)
                        setStatus(
                            error.message ||
                                "Could not check this name. Retry.",
                        )
                })
        }, 250)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [name, kind, excludeId, onValid])
    return (
        <p
            role="status"
            aria-live="polite"
            className={`text-xs ${status === "Name available" ? "text-muted-foreground" : "text-amber-400"}`}
        >
            {status}
        </p>
    )
}
