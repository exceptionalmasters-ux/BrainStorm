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
            className="relative inline-flex shrink-0 items-center gap-2"
            data-testid="emc-connection"
        >
            <button
                type="button"
                className="shrink-0 whitespace-nowrap rounded border border-primary/40 px-2 py-1 text-xs"
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
                <span
                    role="alert"
                    className="absolute right-0 top-full z-50 mt-1 w-[min(320px,calc(100vw_-_24px))] rounded border bg-card p-2 text-xs text-red-500 shadow-lg"
                >
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
