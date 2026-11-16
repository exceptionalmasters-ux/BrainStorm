import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { proxy } from "@/proxy"

// The locale that a page without one redirects to
const redirectFor = async (acceptLanguage?: string, path = "/") => {
    const response = await proxy(
        new NextRequest(`http://localhost${path}`, {
            headers: acceptLanguage
                ? { "accept-language": acceptLanguage }
                : {},
        }),
    )
    return response?.headers.get("location")
}

describe("locale redirect", () => {
    it("sends Taiwan, Hong Kong and Macau to Traditional Chinese", async () => {
        expect(await redirectFor("zh-TW,zh;q=0.9")).toBe(
            "http://localhost/zh-Hant",
        )
        expect(await redirectFor("zh-HK")).toBe("http://localhost/zh-Hant")
        expect(await redirectFor("zh-MO")).toBe("http://localhost/zh-Hant")
        expect(await redirectFor("zh-Hant-TW")).toBe("http://localhost/zh-Hant")
    })

    it("sends other Chinese, Japanese and English to their locale", async () => {
        expect(await redirectFor("zh-CN,zh;q=0.9")).toBe("http://localhost/zh")
        expect(await redirectFor("ja-JP,ja;q=0.9")).toBe("http://localhost/ja")
        expect(await redirectFor("en-US,en;q=0.9")).toBe("http://localhost/en")
    })

    it("follows the order of preference", async () => {
        expect(await redirectFor("fr-FR,ja;q=0.8,en;q=0.5")).toBe(
            "http://localhost/ja",
        )
    })

    it("falls back to English", async () => {
        expect(await redirectFor()).toBe("http://localhost/en")
        expect(await redirectFor("*")).toBe("http://localhost/en")
        expect(await redirectFor("de-DE")).toBe("http://localhost/en")
    })

    it("skips a malformed tag and uses the next one", async () => {
        expect(await redirectFor("en_US,ja;q=0.8")).toBe("http://localhost/ja")
    })

    it("keeps the rest of the path", async () => {
        expect(await redirectFor("zh-TW", "/about")).toBe(
            "http://localhost/zh-Hant/about",
        )
    })

    it("sends a locale written another way to the page's own address", async () => {
        // Whatever the browser's language: the address names the locale
        expect(await redirectFor("en-US", "/zh-hant/about")).toBe(
            "http://localhost/zh-Hant/about",
        )
        expect(await redirectFor("zh-TW", "/EN")).toBe("http://localhost/en")
        expect(await redirectFor("en-US", "/JA/docs/faq?x=1")).toBe(
            "http://localhost/ja/docs/faq?x=1",
        )
        expect(await redirectFor("en-US", "/zh-TW/docs")).toBe(
            "http://localhost/zh-Hant/docs",
        )
        expect(await redirectFor("en-US", "/zh-hk")).toBe(
            "http://localhost/zh-Hant",
        )
        expect(await redirectFor("ja", "/zh-CN/mcp")).toBe(
            "http://localhost/zh/mcp",
        )
        expect(await redirectFor("ja", "/zh-Hans/mcp")).toBe(
            "http://localhost/zh/mcp",
        )
    })

    it("sends a locale with a region after it to the locale's page", async () => {
        expect(await redirectFor("zh-TW", "/en-US/about")).toBe(
            "http://localhost/en/about",
        )
        expect(await redirectFor("en-US", "/ja-JP/docs")).toBe(
            "http://localhost/ja/docs",
        )
        expect(await redirectFor("ja", "/en-gb")).toBe("http://localhost/en")
        // Not a locale: a page's name, which gets the browser's locale
        expect(await redirectFor("ja", "/enx/about")).toBe(
            "http://localhost/ja/enx/about",
        )
        expect(await redirectFor("ja", "/en-USA")).toBe(
            "http://localhost/ja/en-USA",
        )
    })

    it("leaves a page at its locale alone", async () => {
        for (const path of ["/en", "/zh/about", "/ja/docs", "/zh-Hant/mcp"]) {
            expect(await redirectFor("zh-TW", path)).toBeUndefined()
        }
    })

    it("redirects the home page temporarily and other pages permanently", async () => {
        const status = async (path: string) =>
            (await proxy(new NextRequest(`http://localhost${path}`)))?.status
        expect(await status("/")).toBe(307)
        expect(await status("/docs/editor")).toBe(308)
        expect(await status("/mcp")).toBe(308)
    })
})
