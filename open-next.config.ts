import { defineCloudflareConfig } from "@opennextjs/cloudflare/config"

export default {
    ...defineCloudflareConfig({}),
    buildCommand: "node scripts/build-cloudflare-next.mjs",
}
