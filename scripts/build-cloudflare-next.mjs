import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync } from "node:fs"

// Only the Cloudflare build is namespaced. Desktop and regular CI remain at /.
const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    {
        stdio: "inherit",
        env: { ...process.env, NEXT_PUBLIC_BASE_PATH: "/brainstorm" },
    },
)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

// OpenNext copies public into assets/basePath; Cloudflare reads _headers only
// from the asset root. Its output directory has already been initialized.
mkdirSync(".open-next/assets", { recursive: true })
copyFileSync("public/_headers", ".open-next/assets/_headers")
