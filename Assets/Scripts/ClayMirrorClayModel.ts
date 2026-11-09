/**
 * ClayMirrorClayModel — pure clay-profile logic (no scene access).
 *
 * Owns: the clay's profile (ring radii bottom→top + total height), the undo
 * history, collapse detection, and the profile-vs-target match score.
 * Must not: touch SceneObjects, materials, audio or UI. ClayMirrorClayController
 * renders this model and drives it from SIK input; tests can drive it directly.
 */

/** Tunable sculpting limits — exposed as @inputs on ClayMirrorClayController. */
export interface ClayConfig {
  ringCount: number        // profile samples, bottom → top (inclusive)
  startRadiusCm: number    // fresh block radius (12 cm across → 6)
  startHeightCm: number    // fresh block height
  minRadiusCm: number      // thinner than this anywhere → collapse
  maxRadiusCm: number      // radius cap (wheel head is ~15 cm)
  minHeightCm: number      // squash floor
  maxHeightCm: number      // taller than this → collapse
  falloffCm: number        // gaussian falloff of a pinch around the pinched height
  radialGain: number       // multiplier on radial drag distance
  verticalGain: number     // multiplier on vertical drag distance
}

export const DEFAULT_CLAY_CONFIG: ClayConfig = {
  ringCount: 25,
  startRadiusCm: 6,
  startHeightCm: 15,
  minRadiusCm: 1.2,
  maxRadiusCm: 15,
  minHeightCm: 5,
  maxHeightCm: 34,
  falloffCm: 2.6,
  radialGain: 1.0,
  verticalGain: 1.0,
}

/** A target vase profile: [heightCm, radiusCm] points, bottom → top. */
export interface TargetProfile {
  name: string
  points: [number, number][]
}

/**
 * The 10 wheel items, easiest → hardest. Each round moves on to the next (wraps after 10).
 * Every profile stays above ~2 cm radius (collapse limit 1.2) and under 34 cm tall.
 */
export const TARGET_PROFILES: TargetProfile[] = [
  {name: "Mug", points: [[0, 4.6], [1, 5.0], [11, 5.0], [12, 5.3]]},
  {name: "Flower Pot", points: [[0, 3.8], [1, 4.2], [12, 6.8], [13, 7.4], [14, 7.4]]},
  {name: "Bowl", points: [[0, 3.5], [1, 5.5], [3, 8.5], [5, 10.0], [6.5, 10.8], [7, 10.6]]},
  {name: "Round Pot", points: [[0, 5.0], [2, 7.5], [5, 9.2], [9, 9.4], [12, 8.0], [14, 6.6], [15, 6.8]]},
  {name: "Classic Vase", points: [[0, 4.4], [2, 5.8], [6, 7.6], [10, 7.6], [14, 6.0], [18, 3.6], [21, 3.2], [23.5, 3.9], [25, 4.6]]},
  {name: "Jug", points: [[0, 5.0], [3, 6.8], [8, 7.2], [12, 5.5], [15, 4.2], [18, 4.4], [20, 5.0]]},
  {name: "Tall Bottle", points: [[0, 5.0], [3, 5.6], [9, 5.8], [13, 5.0], [17, 2.8], [22, 2.2], [24, 2.6], [25, 3.0]]},
  {name: "Goblet", points: [[0, 5.0], [1, 4.6], [2.5, 2.4], [7, 2.2], [9, 3.6], [12, 6.0], [15, 6.8], [16, 6.8]]},
  {name: "Candlestick", points: [[0, 6.0], [1.5, 5.4], [3, 2.8], [8, 2.4], [10, 3.6], [12, 2.4], [18, 2.2], [19, 3.2], [20, 3.4]]},
  {name: "Urn", points: [[0, 4.0], [2, 4.8], [3, 3.8], [6, 6.5], [11, 8.5], [16, 7.8], [20, 4.5], [22, 4.0], [24, 5.6], [25, 5.8]]},
]

export type DragResult = "ok" | "collapsed" | "ignored"

interface Snapshot {
  radii: number[]
  height: number
  collapsed: boolean
}

export class ClayModel {
  radii: number[] = []
  heightCm: number = 0
  collapsed: boolean = false
  /** Counts for the round summary (bonuses). */
  undoCount: number = 0
  collapseCount: number = 0
  strokeCount: number = 0

  private history: Snapshot[] = []
  private inStroke = false
  private strokeChanged = false

  constructor(public config: ClayConfig = DEFAULT_CLAY_CONFIG) {
    this.reset()
  }

  /** Fresh block of clay; clears history and round counters. */
  reset(): void {
    const n = this.config.ringCount
    this.radii = []
    for (let i = 0; i < n; i++) this.radii.push(this.config.startRadiusCm)
    this.heightCm = this.config.startHeightCm
    this.collapsed = false
    this.history = []
    this.undoCount = 0
    this.collapseCount = 0
    this.strokeCount = 0
    this.inStroke = false
    this.strokeChanged = false
  }

  /** Begin a continuous drag (one undo step covers the whole stroke). */
  beginStroke(): void {
    if (this.inStroke) return
    this.inStroke = true
    this.strokeChanged = false
    this.pushSnapshot()
  }

  /** End a stroke. A stroke that changed nothing leaves no undo step. */
  endStroke(): void {
    if (!this.inStroke) return
    this.inStroke = false
    if (!this.strokeChanged) {
      this.history.pop()
    } else {
      this.strokeCount++
    }
  }

  get isInStroke(): boolean {
    return this.inStroke
  }

  get canUndo(): boolean {
    return this.history.length > 0
  }

  /**
   * Apply one drag increment at a pinched height.
   * @param heightNorm 0 = bottom of the clay, 1 = top
   * @param dRadial cm; + widens (outward), − narrows (inward)
   * @param dVertical cm; + pulls taller, − squashes shorter
   * Outside a stroke this records its own undo step.
   */
  applyDrag(heightNorm: number, dRadial: number, dVertical: number): DragResult {
    if (this.collapsed) return "ignored"
    const standalone = !this.inStroke
    if (standalone) this.beginStroke()

    const c = this.config
    const n = this.radii.length
    const y0 = Math.max(0, Math.min(1, heightNorm)) * this.heightCm
    let changed = false

    // Radial: gaussian band around the pinched height, all the way round (wheel spins).
    if (Math.abs(dRadial) > 1e-5) {
      const sigma = Math.max(0.5, c.falloffCm)
      for (let i = 0; i < n; i++) {
        const y = (this.heightCm * i) / (n - 1)
        const w = Math.exp(-((y - y0) * (y - y0)) / (2 * sigma * sigma))
        this.radii[i] = Math.min(c.maxRadiusCm, this.radii[i] + dRadial * c.radialGain * w)
      }
      changed = true
    }

    // Vertical: pull taller / squash shorter, roughly conserving volume.
    if (Math.abs(dVertical) > 1e-5) {
      const newH = Math.max(c.minHeightCm, this.heightCm + dVertical * c.verticalGain)
      const k = Math.sqrt(this.heightCm / newH)
      for (let i = 0; i < n; i++) this.radii[i] = Math.min(c.maxRadiusCm, this.radii[i] * k)
      this.heightCm = newH
      changed = true
    }

    if (changed) this.strokeChanged = true

    let result: DragResult = changed ? "ok" : "ignored"
    if (this.minRadius() < c.minRadiusCm || this.heightCm > c.maxHeightCm) {
      this.collapse()
      result = "collapsed"
    }
    if (standalone) this.endStroke()
    return result
  }

  /** Reverse the last stroke (including one that ended in a collapse). */
  undo(): boolean {
    if (this.inStroke) this.endStroke()
    const s = this.history.pop()
    if (!s) return false
    this.radii = s.radii.slice()
    this.heightCm = s.height
    this.collapsed = s.collapsed
    this.undoCount++
    return true
  }

  /** Slump into a blob at the bottom with the touched piece sitting on top. */
  collapse(): void {
    const n = this.radii.length
    const h = 9
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      let r: number
      if (t <= 0.62) {
        const u = t / 0.62
        r = 11.5 * (1 - 0.55 * u * u)
      } else {
        const u = (t - 0.62) / 0.38 // 0..1 over the lump on top
        r = 3.4 * Math.sqrt(Math.max(0.12, 1 - Math.pow(2 * u - 1, 2))) + 0.4
      }
      this.radii[i] = Math.min(this.config.maxRadiusCm, r)
    }
    this.heightCm = h
    this.collapsed = true
    this.collapseCount++
  }

  minRadius(): number {
    let m = Number.POSITIVE_INFINITY
    for (const r of this.radii) m = Math.min(m, r)
    return m
  }

  maxRadius(): number {
    let m = 0
    for (const r of this.radii) m = Math.max(m, r)
    return m
  }

  /** Clay radius at a height (cm); 0 above the top. */
  radiusAt(yCm: number): number {
    if (yCm < 0 || yCm > this.heightCm) return 0
    const n = this.radii.length
    const f = (yCm / this.heightCm) * (n - 1)
    const i = Math.min(n - 2, Math.floor(f))
    const t = f - i
    return this.radii[i] * (1 - t) + this.radii[i + 1] * t
  }

  /** Copy of the profile for tests and rendering. */
  getRadii(): number[] {
    return this.radii.slice()
  }

  private pushSnapshot(): void {
    this.history.push({radii: this.radii.slice(), height: this.heightCm, collapsed: this.collapsed})
    if (this.history.length > 60) this.history.shift()
  }
}

/** Target radius at a height (cm); 0 outside the vase. */
export function targetRadiusAt(target: TargetProfile, yCm: number): number {
  const p = target.points
  if (yCm < 0 || yCm > p[p.length - 1][0]) return 0
  for (let i = 0; i < p.length - 1; i++) {
    const [y0, r0] = p[i]
    const [y1, r1] = p[i + 1]
    if (yCm >= y0 && yCm <= y1) {
      const t = (yCm - y0) / Math.max(1e-5, y1 - y0)
      const s = t * t * (3 - 2 * t) // smoothstep for a softer silhouette
      return r0 * (1 - s) + r1 * s
    }
  }
  return p[p.length - 1][1]
}

export function targetHeight(target: TargetProfile): number {
  return target.points[target.points.length - 1][0]
}

/**
 * Match % (0..100): compares clay and target radii at many heights.
 * score = 1 − Σ|r_clay − r_target| / Σ max(r_clay, r_target)  (profile IoU-like).
 */
export function matchPercent(model: ClayModel, target: TargetProfile, samples: number = 48): number {
  const H = Math.max(model.heightCm, targetHeight(target))
  let diff = 0
  let norm = 0
  for (let k = 0; k < samples; k++) {
    const y = ((k + 0.5) / samples) * H
    const rc = model.radiusAt(y)
    const rt = targetRadiusAt(target, y)
    diff += Math.abs(rc - rt)
    norm += Math.max(rc, rt)
  }
  if (norm <= 1e-5) return 0
  return Math.max(0, Math.min(100, (1 - diff / norm) * 100))
}
