/** Unit tests must mock provider transports. Never send fixture data to a real provider. */
import { Socket } from "node:net"

// Do not inherit the host proxy flag: SSRF-dispatcher tests must be deterministic.
process.env.NODE_USE_ENV_PROXY = "0"

const offline = () => {
    throw new Error(
        "External network is disabled in unit tests; mock the provider transport.",
    )
}

// Covers native fetch/undici, AWS Smithy HTTP handlers and SDK-owned transports.
// Blocking Socket.connect happens before TCP connection, DNS lookup or body writes.
Socket.prototype.connect = offline as typeof Socket.prototype.connect
globalThis.fetch = (async () => offline()) as typeof fetch
