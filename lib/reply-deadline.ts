/** Optional Web-search deadline. Drawing has no application wall-clock cap.
 * The clock check catches a background mobile tab resuming after suspension. */
export function watchReplyDeadline(onTimeout: () => void, totalMs?: number) {
    if (totalMs === undefined) return () => {}
    const started = Date.now()
    const timer = setInterval(() => {
        if (Date.now() - started < totalMs) return
        clearInterval(timer)
        onTimeout()
    }, 1000)
    return () => clearInterval(timer)
}
