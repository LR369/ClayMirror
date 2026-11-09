/**
 * ClayMirrorDropIn — tiny animation helper (not a component): an object falls into its resting
 * spot from above, lands with two little bounces, then its material glows/pulses green for a
 * few seconds so the player notices something new arrived.
 * The owner calls update(dt) every frame. onLand fires once at first contact.
 */
export class DropIn {
  /** Seconds to fall. */
  fallSec = 0.55
  /** Seconds of green highlight after landing. */
  glowSec = 2.8
  /** Highlight color. */
  glowColor = new vec4(0.45, 1.0, 0.55, 1)

  private t = -1
  private glowT = -1
  private height = 30
  private landed = false
  private _landCount = 0

  constructor(
    private target: () => Transform,
    private restLocal: () => vec3,
    private material: () => Material | null,
    private baseColor: () => vec4,
    private onLand: () => void,
  ) {}

  get isFalling(): boolean { return this.t >= 0 && !this.landed }
  get isGlowing(): boolean { return this.glowT >= 0 }
  get landCount(): number { return this._landCount }

  /** Start a drop from `heightCm` above the rest spot. */
  start(heightCm: number): void {
    this.height = heightCm
    this.t = 0
    this.landed = false
    this.apply(heightCm)
  }

  /** Stop the fall immediately (object moved elsewhere); keeps any glow running. */
  cancelFall(): void {
    if (this.t >= 0 && !this.landed) {
      this.landed = true
      this._landCount++
      this.glowT = 0
    }
    this.t = -1
  }

  /** Stop everything and restore the material color. */
  reset(): void {
    this.t = -1
    this.glowT = -1
    this.landed = false
    const m = this.material()
    if (m) m.mainPass.baseColor = this.baseColor()
  }

  update(dt: number): void {
    if (this.t >= 0) {
      this.t += dt
      const f = this.fallSec
      let y: number
      if (this.t < f) {
        const x = this.t / f
        y = this.height * (1 - x * x) // accelerating fall
      } else {
        if (!this.landed) {
          this.landed = true
          this._landCount++
          this.glowT = 0
          this.onLand()
        }
        // two decaying bounces
        const b = this.t - f
        const b1 = 0.18
        const b2 = 0.12
        if (b < b1) y = this.height * 0.06 * Math.sin((b / b1) * Math.PI)
        else if (b < b1 + b2) y = this.height * 0.02 * Math.sin(((b - b1) / b2) * Math.PI)
        else {
          y = 0
          this.t = -1
        }
      }
      this.apply(y)
    }
    if (this.glowT >= 0) {
      this.glowT += dt
      const m = this.material()
      if (m) {
        const fade = Math.max(0, 1 - this.glowT / this.glowSec)
        const pulse = 0.55 + 0.45 * Math.cos(this.glowT * 7)
        const k = Math.min(1, fade * pulse * 1.1)
        const c = this.baseColor()
        const g = this.glowColor
        m.mainPass.baseColor = new vec4(c.x + (g.x - c.x) * k, c.y + (g.y - c.y) * k, c.z + (g.z - c.z) * k, c.w)
      }
      if (this.glowT >= this.glowSec) {
        this.glowT = -1
        if (m) m.mainPass.baseColor = this.baseColor()
      }
    }
  }

  private apply(yOffset: number): void {
    const r = this.restLocal()
    this.target().setLocalPosition(new vec3(r.x, r.y + yOffset, r.z))
  }
}
