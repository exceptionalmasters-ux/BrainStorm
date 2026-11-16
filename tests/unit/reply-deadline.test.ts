import { afterEach, describe, expect, it, vi } from "vitest"
import { watchReplyDeadline } from "@/lib/reply-deadline"

afterEach(() => vi.useRealTimers())
describe("Web-only reply deadline", () => {
    it("does not stop drawing when no Web deadline is supplied", () => {
        vi.useFakeTimers()
        const expired = vi.fn()
        const dispose = watchReplyDeadline(expired)
        vi.advanceTimersByTime(3600000)
        expect(expired).not.toHaveBeenCalled()
        dispose()
    })
    it("ends once at the total limit even while the connection remains active", () => {
        vi.useFakeTimers()
        const expired = vi.fn()
        watchReplyDeadline(expired, 180000)
        vi.advanceTimersByTime(179000)
        expect(expired).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1000)
        expect(expired).toHaveBeenCalledOnce()
        vi.advanceTimersByTime(180000)
        expect(expired).toHaveBeenCalledOnce()
    })
    it("stops watching a completed or stopped reply", () => {
        vi.useFakeTimers()
        const expired = vi.fn()
        const dispose = watchReplyDeadline(expired, 2000)
        dispose()
        vi.advanceTimersByTime(10000)
        expect(expired).not.toHaveBeenCalled()
    })
    it("expires after a suspended tab resumes beyond its deadline", () => {
        vi.useFakeTimers()
        const expired = vi.fn()
        watchReplyDeadline(expired, 180000)
        vi.setSystemTime(Date.now() + 900000)
        vi.advanceTimersByTime(1000)
        expect(expired).toHaveBeenCalledOnce()
    })
})
