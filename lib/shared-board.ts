export const SHARED_BOARD_PROTOCOL = "emc-whiteboard/v1"
export type BoardPoint = { x: number; y: number }
export type BoardView = { pageId: string; scale: number; center: BoardPoint }
export type BoardStroke = {
    id: string
    actorId: string
    pageId: string
    kind: "pen" | "highlight"
    points: BoardPoint[]
}
export type BoardLaser = { actorId: string; pageId: string; point: BoardPoint }
export type BoardTool = "select" | "pen" | "highlight" | "laser"
export const validBoardPoint = (p: any): p is BoardPoint =>
    !!p &&
    [p.x, p.y].every(
        (n) =>
            typeof n === "number" &&
            Number.isFinite(n) &&
            Math.abs(n) <= 1000000,
    )
export const validBoardView = (v: any): v is BoardView =>
    !!v &&
    typeof v.pageId === "string" &&
    v.pageId.length <= 128 &&
    Number.isFinite(v.scale) &&
    v.scale >= 0.05 &&
    v.scale <= 8 &&
    validBoardPoint(v.center)
export const validBoardStroke = (s: any): s is BoardStroke =>
    !!s &&
    typeof s.id === "string" &&
    s.id.length <= 64 &&
    typeof s.actorId === "string" &&
    typeof s.pageId === "string" &&
    s.pageId.length <= 128 &&
    ["pen", "highlight"].includes(s.kind) &&
    Array.isArray(s.points) &&
    s.points.length >= 2 &&
    s.points.length <= 1000 &&
    s.points.every(validBoardPoint)
