/** Public deployment identifiers only. All permissions are checked using the user's JWT. */
export const EMC_OPERATIONS_ORIGIN = "https://exceptionalmasters.co.uk"
export const EMC_SUPABASE_URL = "https://fzwiphplhspsoktugoqo.supabase.co"
export const EMC_SUPABASE_PUBLIC_KEY =
    "sb_publishable_SsgUbiylp7SIq47wMKh2kQ_Jwjg_ei-"

/** Production is an Operations module; development and explicit test builds may stand alone. */
export function operationsOnly() {
    return (
        process.env.EMC_OPERATIONS_ONLY === "1" ||
        (process.env.NODE_ENV === "production" &&
            process.env.EMC_OPERATIONS_ONLY !== "0")
    )
}
