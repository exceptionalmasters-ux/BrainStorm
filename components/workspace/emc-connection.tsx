"use client"
import { useEffect, useState } from "react"
import {
    getEmcConnectionState,
    isOperationsMode,
    operationsAuthorization,
    reconnectOperations,
} from "@/lib/operations-bridge"

export function EmcConnection() {
    const [state, setState] = useState(getEmcConnectionState)
    const [error, setError] = useState("")
    useEffect(() => {
        const update = () => setState(getEmcConnectionState())
        const resume = () => {
            if (document.visibilityState === "visible")
                void operationsAuthorization()
                    .then(update)
                    .catch((e) => {
                        setError(e.message)
                        update()
                    })
        }
        window.addEventListener("emc-connection-state", update)
        document.addEventListener("visibilitychange", resume)
        const timer = setInterval(update, 10000)
        const requested = () => {
            void reconnectOperations().catch((e) => setError(e.message))
        }
        window.addEventListener("emc-request-reconnect", requested)
        return () => {
            window.removeEventListener("emc-connection-state", update)
            document.removeEventListener("visibilitychange", resume)
            clearInterval(timer)
            window.removeEventListener("emc-request-reconnect", requested)
        }
    }, [])
    if (!isOperationsMode()) return null
    const reconnect = () => {
        setError("")
        void reconnectOperations()
            .then(() => setError(""))
            .catch((e) => setError(e.message))
    }
    return (
        <span
            className="inline-flex min-w-0 flex-wrap items-center gap-2"
            data-testid="emc-connection"
        >
            <button
                type="button"
                className="rounded border border-primary/40 px-2 py-1 text-xs"
                disabled={state === "connecting"}
                onClick={reconnect}
                data-testid="emc-reconnect"
                aria-label={
                    state === "connected"
                        ? "Connected to EMC; reconnect"
                        : "Reconnect EMC"
                }
            >
                {state === "connecting"
                    ? "Connecting…"
                    : state === "connected"
                      ? "Connected"
                      : "Reconnect EMC"}
            </button>
            {error && (
                <span role="alert" className="text-xs text-red-500">
                    {error}{" "}
                    <button
                        type="button"
                        className="underline"
                        disabled={state === "connecting"}
                        onClick={reconnect}
                    >
                        Reconnect EMC
                    </button>
                </span>
            )}
        </span>
    )
}
