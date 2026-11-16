const SHAPE_LIBRARY_GROUPS: Record<string, string[]> = {
    Cloud: [
        "aws4",
        "azure2",
        "gcp2",
        "alibaba_cloud",
        "openstack",
        "salesforce",
    ],
    Networking: ["cisco19", "network", "kubernetes", "vvd", "rack"],
    Business: ["bpmn", "lean_mapping"],
    General: ["flowchart", "basic", "arrows2", "infographic", "sitemap"],
    "UI/Mockups": ["android", "material_design"],
    Enterprise: ["citrix", "sap", "mscae", "atlassian"],
    Engineering: ["fluidpower", "electrical", "pid", "cabinets", "floorplan"],
    Icons: ["webicons"],
}

/** The libraries by group, one "- Group: a, b" line each, for tool descriptions */
export const SHAPE_LIBRARY_LIST = Object.entries(SHAPE_LIBRARY_GROUPS)
    .map(([group, names]) => `- ${group}: ${names.join(", ")}`)
    .join("\n")

export const LIBRARIES = new Set(Object.values(SHAPE_LIBRARY_GROUPS).flat())
