/**
 * ClayMirrorTestUtils — shared helpers for the Clay Mirror LEAF scenarios.
 * Not a component. Read-only access to the game through ClayMirrorMain's public test API.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {ClayMirrorMain} from "../Scripts/ClayMirrorMain"

export function log(msg: string): void {
  print("[CMTEST] " + msg)
}

/** Poll every frame until `pred()` holds or time out. */
export async function waitUntil(pred: () => boolean, timeoutMs: number, detail?: () => string): Promise<void> {
  const end = getTime() * 1000 + timeoutMs
  while (!pred()) {
    if (getTime() * 1000 > end) throw new Error(`waitUntil timed out after ${timeoutMs}ms${detail ? ": " + detail() : ""}`)
    await nextFrame()
  }
}

/** expect(v) within [lo, hi] with a readable failure. */
export function expectRange(v: number, lo: number, hi: number, label: string): void {
  expect(v >= lo && v <= hi, `${label}: ${v} not in [${lo}, ${hi}]`).toBe(true)
}

/** Race a promise against a timeout so a stuck LEAF event never hangs the scenario. */
export async function withDeadline<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timedOut = false
  const t = sleep(ms).then(() => {
    timedOut = true
  })
  const r = await Promise.race([p.then((v) => ({v})), t.then(() => null)])
  if (r === null || timedOut && r === null) throw new Error(`${what} did not complete within ${ms}ms`)
  return (r as {v: T}).v
}

export function getMain(): ClayMirrorMain {
  const so = findSceneObjectByName("ClayMirror")
  if (!so) throw new Error("Scene object 'ClayMirror' not found")
  const m = so.getComponent(ClayMirrorMain.getTypeName()) as ClayMirrorMain
  if (!m) throw new Error("ClayMirrorMain script not found on 'ClayMirror'")
  return m
}

/** Wait until the Lens finished its first frames (UI built, placement entered). */
export async function waitForGame(): Promise<ClayMirrorMain> {
  await sleep(1500)
  const m = getMain()
  await waitUntil(() => !!m.placementUI.startButtonObject && !!m.controlsUI.doneButtonObject, 5000, () => "UI not built")
  return m
}

export function interactableOf(so: SceneObject | null, label: string): Interactable {
  if (!so) throw new Error(`${label}: scene object is null`)
  const it = so.getComponent(Interactable.getTypeName()) as Interactable
  if (!it) throw new Error(`${label}: no Interactable on '${so.name}'`)
  return it
}

export function interactableByObjectName(name: string): Interactable {
  return interactableOf(findSceneObjectByName(name), name)
}

/** Hook-based setup: get into "play" with the clay on the wheel. */
export async function setupPlayWithClayOnWheel(m: ClayMirrorMain): Promise<void> {
  if (m.phase === "placement") m.pressStart()
  if (m.phase === "results") m.pressStartOver()
  await sleep(100)
  if (!m.isClayOnWheel) m.dropClayOnWheel()
  await sleep(200)
  if (m.phase !== "play" || !m.isClayOnWheel) throw new Error(`setup failed: phase=${m.phase} onWheel=${m.isClayOnWheel}`)
}

/**
 * Drag with a real (simulated) SIK hand, with a per-frame vector that is zeroed as soon
 * as `stopWhen()` becomes true (LEAF adds the vector on every onDragUpdate).
 */
export async function dragUntil(
  hand: {drag: (t: Interactable, v: vec3, ms: number) => Promise<void>},
  target: Interactable,
  perFrame: vec3,
  durationMs: number,
  stopWhen: () => boolean,
  onUpdate?: () => void,
): Promise<void> {
  const v = new vec3(perFrame.x, perFrame.y, perFrame.z)
  const unsub = target.onDragUpdate.add(() => {
    if (onUpdate) onUpdate()
    if (stopWhen()) {
      v.x = 0
      v.y = 0
      v.z = 0
    }
  }) as unknown as () => void
  try {
    await withDeadline(hand.drag(target, v, durationMs), durationMs + 6000, `drag on ${target.getSceneObject().name}`)
  } finally {
    if (typeof unsub === "function") unsub()
  }
}

export function maxAbsDiff(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let d = 0
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]))
  return d
}

export function fmt(v: vec3): string {
  return `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`
}

// ── Screen-space overlap (criterion 8) ──────────────────────────────────────
export interface Rect2 {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function collectVisuals(root: SceneObject, out: BaseMeshVisual[]): void {
  if (!root.isEnabledInHierarchy) return
  const rmvs = root.getComponents("Component.RenderMeshVisual") as BaseMeshVisual[]
  for (const r of rmvs) if (r.enabled) out.push(r)
  const texts = root.getComponents("Component.Text") as BaseMeshVisual[]
  for (const t of texts) if (t.enabled) out.push(t)
  for (let i = 0; i < root.getChildrenCount(); i++) collectVisuals(root.getChild(i), out)
}

/** Screen rect (0..1) of all enabled visuals under `root`, or null if nothing visible. */
export function screenRectOf(root: SceneObject): Rect2 | null {
  const vis: BaseMeshVisual[] = []
  collectVisuals(root, vis)
  if (vis.length === 0) return null
  const cam = WorldCameraFinderProvider.getInstance().getComponent()
  let r: Rect2 | null = null
  for (const v of vis) {
    const a = v.worldAabbMin()
    const b = v.worldAabbMax()
    if (!a || !b) continue
    for (const x of [a.x, b.x]) for (const y of [a.y, b.y]) for (const z of [a.z, b.z]) {
      const s = cam.worldSpaceToScreenSpace(new vec3(x, y, z))
      if (!r) r = {minX: s.x, minY: s.y, maxX: s.x, maxY: s.y}
      else {
        r.minX = Math.min(r.minX, s.x)
        r.minY = Math.min(r.minY, s.y)
        r.maxX = Math.max(r.maxX, s.x)
        r.maxY = Math.max(r.maxY, s.y)
      }
    }
  }
  return r
}

/** Screen rect of a flat quad (exact corners) given its transform and local size. */
export function screenRectOfQuad(t: Transform, w: number, h: number): Rect2 {
  const cam = WorldCameraFinderProvider.getInstance().getComponent()
  const m = t.getWorldTransform()
  let r: Rect2 | null = null
  for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) {
    const s = cam.worldSpaceToScreenSpace(m.multiplyPoint(new vec3(x, y, 0)))
    if (!r) r = {minX: s.x, minY: s.y, maxX: s.x, maxY: s.y}
    else {
      r.minX = Math.min(r.minX, s.x)
      r.minY = Math.min(r.minY, s.y)
      r.maxX = Math.max(r.maxX, s.x)
      r.maxY = Math.max(r.maxY, s.y)
    }
  }
  return r!
}

/** Overlap area as a fraction of the smaller rect (0 = no overlap). */
export function overlapFraction(a: Rect2, b: Rect2): number {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  if (w <= 0 || h <= 0) return 0
  const areaA = (a.maxX - a.minX) * (a.maxY - a.minY)
  const areaB = (b.maxX - b.minX) * (b.maxY - b.minY)
  return (w * h) / Math.max(1e-9, Math.min(areaA, areaB))
}

export function rectStr(r: Rect2 | null): string {
  if (!r) return "null"
  return `[${r.minX.toFixed(3)},${r.minY.toFixed(3)} → ${r.maxX.toFixed(3)},${r.maxY.toFixed(3)}]`
}

/** Real pinch (hover → select → release) with a deadline. */
export async function pinch(hand: {trigger: (t: Interactable) => Promise<void>}, target: Interactable): Promise<void> {
  await withDeadline(hand.trigger(target), 8000, `pinch on ${target.getSceneObject().name}`)
}

// ── Exact-ish silhouette overlap (convex hulls of projected points + SAT) ─────
export type Poly = vec2[]

function project(points: vec3[]): vec2[] {
  const cam = WorldCameraFinderProvider.getInstance().getComponent()
  return points.map((p) => cam.worldSpaceToScreenSpace(p))
}

function cross(o: vec2, a: vec2, b: vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

export function convexHull(pts: vec2[]): Poly {
  const p = pts.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  if (p.length < 3) return p
  const lower: vec2[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: vec2[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

/** Signed separation along the best SAT axis (screen units). > 0 = gap, < 0 = penetration depth. */
export function polySeparation(a: Poly, b: Poly): number {
  let best = Number.NEGATIVE_INFINITY
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i]
      const p2 = poly[(i + 1) % poly.length]
      let nx = -(p2.y - p1.y)
      let ny = p2.x - p1.x
      const len = Math.sqrt(nx * nx + ny * ny)
      if (len < 1e-9) continue
      nx /= len
      ny /= len
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity
      for (const q of a) { const d = q.x * nx + q.y * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d) }
      for (const q of b) { const d = q.x * nx + q.y * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d) }
      const sep = Math.max(bMin - aMax, aMin - bMax)
      best = Math.max(best, sep)
    }
  }
  return best
}

function collectOrientedBoxPoints(root: SceneObject, out: vec3[]): void {
  if (!root.isEnabledInHierarchy) return
  const vis = (root.getComponents("Component.RenderMeshVisual") as BaseMeshVisual[]).concat(root.getComponents("Component.Text") as BaseMeshVisual[])
  for (const v of vis) {
    if (!v.enabled) continue
    const a = v.localAabbMin()
    const b = v.localAabbMax()
    if (!a || !b) continue
    const m = root.getTransform().getWorldTransform()
    for (const x of [a.x, b.x]) for (const y of [a.y, b.y]) for (const z of [a.z, b.z]) out.push(m.multiplyPoint(new vec3(x, y, z)))
  }
  for (let i = 0; i < root.getChildrenCount(); i++) collectOrientedBoxPoints(root.getChild(i), out)
}

/** Silhouette hull of all enabled visuals under root (oriented local AABBs). Null if nothing visible. */
export function silhouetteOf(root: SceneObject): Poly | null {
  const pts: vec3[] = []
  collectOrientedBoxPoints(root, pts)
  return pts.length ? convexHull(project(pts)) : null
}

/** Silhouette of a lathe profile (radii bottom→top over heightCm) standing at `base`. */
export function silhouetteOfLathe(base: vec3, radii: number[], heightCm: number): Poly {
  const pts: vec3[] = []
  const n = radii.length
  for (let i = 0; i < n; i++) {
    const y = (heightCm * i) / (n - 1)
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      pts.push(new vec3(base.x + radii[i] * Math.cos(a), base.y + y, base.z + radii[i] * Math.sin(a)))
    }
  }
  return convexHull(project(pts))
}

export function silhouetteOfQuad(t: Transform, w: number, h: number): Poly {
  const m = t.getWorldTransform()
  const pts: vec3[] = []
  for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) pts.push(m.multiplyPoint(new vec3(x, y, 0)))
  return convexHull(project(pts))
}
