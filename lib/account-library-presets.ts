import { EMC_SUPABASE_PUBLIC_KEY, EMC_SUPABASE_URL } from "./emc-deployment"
import type { LibraryPreset } from "./library-presets"
import { operationsAuthorization } from "./operations-bridge"
import { readServiceJson } from "./service-response"

export type PresetRequest = (action: string, body: unknown) => Promise<any>
/** The JWT owns the account; callers cannot select another user's presets. */
export const accountPresetRequest: PresetRequest = async (action, body) => {
    const auth = await operationsAuthorization()
    const response = await fetch(
        `${EMC_SUPABASE_URL}/rest/v1/rpc/brainstorm_library_presets`,
        {
            method: "POST",
            headers: {
                apikey: EMC_SUPABASE_PUBLIC_KEY,
                Authorization: `Bearer ${auth.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ p_action: action, p_payload: body }),
            cache: "no-store",
        },
    )
    return readServiceJson(response, "Account presets") as Promise<
        LibraryPreset[]
    >
}
