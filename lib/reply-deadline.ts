/** A total wall-clock limit, independent of SSE heartbeats or reasoning chunks.
 * The clock check also catches a background mobile tab resuming after suspension. */
export function watchReplyDeadline(onTimeout: () => void, totalMs = 180000) {
    const started = Date.now()
    const timer = setInterval(() => {
        if (Date.now() - started < totalMs) return
        clearInterval(timer)
        onTimeout()
    }, 1000)
    return () => clearInterval(timer)
}
