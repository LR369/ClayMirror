/**
 * ClayMirrorEffects — stars and sparkles around the finished piece (code-built, no VFX graph).
 *
 * Owns: a small pool of flat star meshes (additive, light colors — the display is additive)
 * that burst outward, spin, face the camera and shrink away; plus a gentle twinkle loop
 * around a moving point. Created at runtime by ClayMirrorMain via init().
 * API: init(parent, unlitMaterial), burst(worldPos, count, radiusCm), twinkle(getCenter, radiusCm, seconds), stopTwinkle()
 * Must not: know about game phases or UI.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {newBuilder, tintedMaterial} from "./ClayMirrorMeshFactory"

interface Particle {
  so: SceneObject
  pos: vec3
  vel: vec3
  life: number
  age: number
  size: number
  spin: number
  angle: number
  bubble: boolean
  wobble: number
}

const COLORS = [new vec4(1.0, 0.86, 0.35, 1), new vec4(1, 1, 1, 1), new vec4(1.0, 0.72, 0.85, 1), new vec4(0.6, 0.9, 1.0, 1)]
const MAX_PARTICLES = 160

/** Flat 5-point star in the XY plane, unit outer radius, facing +Z. */
function starMesh(): RenderMesh {
  const b = newBuilder()
  const verts: number[] = [0, 0, 0, 0, 0, 1]
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 === 0 ? 1 : 0.42
    verts.push(r * Math.cos(a), r * Math.sin(a), 0, 0, 0, 1)
  }
  const idx: number[] = []
  for (let i = 0; i < 10; i++) idx.push(0, 1 + i, 1 + ((i + 1) % 10))
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
  b.updateMesh()
  return b.getMesh()
}

/** Soap bubble: a thin ring with a little highlight, unit radius, facing +Z. */
function bubbleMesh(): RenderMesh {
  const b = newBuilder()
  const verts: number[] = []
  const idx: number[] = []
  const seg = 20
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    verts.push(Math.cos(a), Math.sin(a), 0, 0, 0, 1)
    verts.push(0.8 * Math.cos(a), 0.8 * Math.sin(a), 0, 0, 0, 1)
  }
  for (let i = 0; i < seg; i++) {
    const o = i * 2
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2)
  }
  // highlight dot
  const c = verts.length / 6
  verts.push(-0.35, 0.35, 0, 0, 0, 1)
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2
    verts.push(-0.35 + 0.2 * Math.cos(a), 0.35 + 0.2 * Math.sin(a), 0, 0, 0, 1)
  }
  for (let i = 0; i < 10; i++) idx.push(c, c + 1 + i, c + 2 + i)
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
  b.updateMesh()
  return b.getMesh()
}

const SUDS_COLORS = [new vec4(1, 1, 1, 1), new vec4(0.85, 0.95, 1.0, 1), new vec4(0.92, 0.9, 1.0, 1)]

@component
export class ClayMirrorEffects extends BaseScriptComponent {
  private bubble: RenderMesh
  private greenMat: Material
  private sudsMats: Material[] = []
  private sudsAcc = 0
  private _sudsCount = 0
  /** Bubbles spawned so far (for tests). */
  get sudsCount(): number { return this._sudsCount }
  private parent: SceneObject
  private mesh: RenderMesh
  private mats: Material[] = []
  private live: Particle[] = []
  private twinkleCenter: (() => vec3) | null = null
  private twinkleRadius = 8
  private twinkleLeft = 0
  private twinkleAcc = 0
  private ready = false
  private _burstCount = 0

  /** Number of bursts fired (for tests). */
  get burstCount(): number { return this._burstCount }
  get activeParticles(): number { return this.live.length }
  get isTwinkling(): boolean { return this.twinkleLeft > 0 }

  init(parent: SceneObject, unlitMaterial: Material): void {
    this.parent = parent
    this.mesh = starMesh()
    for (const c of COLORS) this.mats.push(tintedMaterial(unlitMaterial, c, "add"))
    this.greenMat = tintedMaterial(unlitMaterial, new vec4(0.45, 1.0, 0.55, 1), "add")
    this.bubble = bubbleMesh()
    for (const c of SUDS_COLORS) this.sudsMats.push(tintedMaterial(unlitMaterial, c, "add"))
    if (!this.ready) this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.ready = true
  }

  /** Stars fly outward (mostly up) from a point, spin and shrink away. */
  burst(worldPos: vec3, count: number, radiusCm: number, green: boolean = false): void {
    if (!this.ready) return
    this._burstCount++
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2
      const up = 0.35 + Math.random() * 0.9
      const dir = new vec3(Math.cos(th), up, Math.sin(th)).normalize()
      const speed = radiusCm * (1.4 + Math.random() * 1.2)
      this.spawn(worldPos.add(dir.uniformScale(radiusCm * 0.35)), dir.uniformScale(speed), 1.1 + Math.random() * 0.7, 0.9 + Math.random() * 1.3, green ? this.greenMat : null)
    }
  }

  /** Small sparkles popping around a (moving) point for a while. */
  twinkle(getCenter: () => vec3, radiusCm: number, seconds: number): void {
    this.twinkleCenter = getCenter
    this.twinkleRadius = radiusCm
    this.twinkleLeft = seconds
  }

  stopTwinkle(): void {
    this.twinkleLeft = 0
  }

  /**
   * Soapy suds where the sponge is scrubbing: call every frame the sponge wipes; bubbles
   * froth out around `worldPos`, drift up a little, wobble, then pop.
   */
  suds(worldPos: vec3, radiusCm: number = 4): void {
    if (!this.ready) return
    this.sudsAcc += getDeltaTime()
    let n = 0
    while (this.sudsAcc > 0.035 && n < 4) {
      this.sudsAcc -= 0.035
      n++
      const th = Math.random() * Math.PI * 2
      const r = radiusCm * Math.sqrt(Math.random())
      const pos = new vec3(worldPos.x + r * Math.cos(th), worldPos.y + Math.random() * 1.2, worldPos.z + r * Math.sin(th))
      const vel = new vec3((Math.random() - 0.5) * 3, 2 + Math.random() * 4, (Math.random() - 0.5) * 3)
      this.spawnBubble(pos, vel, 0.9 + Math.random() * 0.9, 0.35 + Math.random() * 0.9)
    }
    if (this.sudsAcc > 0.2) this.sudsAcc = 0
  }

  private spawnBubble(pos: vec3, vel: vec3, life: number, size: number): void {
    if (this.live.length >= MAX_PARTICLES) return
    const so = global.scene.createSceneObject("Bubble")
    so.setParent(this.parent)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.bubble
    rmv.mainMaterial = this.sudsMats[Math.floor(Math.random() * this.sudsMats.length)]
    so.getTransform().setWorldPosition(pos)
    this._sudsCount++
    this.live.push({so, pos, vel, life, age: 0, size, spin: 0, angle: 0, bubble: true, wobble: Math.random() * 6.28})
  }

  private spawn(pos: vec3, vel: vec3, life: number, size: number, mat: Material | null = null): void {
    if (this.live.length >= MAX_PARTICLES) return
    const so = global.scene.createSceneObject("Star")
    so.setParent(this.parent)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.mesh
    rmv.mainMaterial = mat ? mat : this.mats[Math.floor(Math.random() * this.mats.length)]
    so.getTransform().setWorldPosition(pos)
    this.live.push({so, pos, vel, life, age: 0, size, spin: (Math.random() - 0.5) * 8, angle: Math.random() * 6.28, bubble: false, wobble: 0})
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    if (this.twinkleLeft > 0 && this.twinkleCenter) {
      this.twinkleLeft -= dt
      this.twinkleAcc += dt
      while (this.twinkleAcc > 0.07) {
        this.twinkleAcc -= 0.07
        const c = this.twinkleCenter()
        const th = Math.random() * Math.PI * 2
        const r = this.twinkleRadius * (0.6 + Math.random() * 0.6)
        const y = (Math.random() - 0.4) * this.twinkleRadius * 1.4
        this.spawn(new vec3(c.x + r * Math.cos(th), c.y + y, c.z + r * Math.sin(th)), new vec3(0, 2, 0), 0.6 + Math.random() * 0.3, 0.5 + Math.random() * 0.6)
      }
    }
    if (this.live.length === 0) return
    const cam = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]
      p.age += dt
      if (p.age >= p.life) {
        p.so.destroy()
        this.live.splice(i, 1)
        continue
      }
      const x = p.age / p.life
      let s: number
      if (p.bubble) {
        // Suds: slow down, drift up gently, wobble; grow in, hold, then pop at the end.
        p.vel = p.vel.uniformScale(Math.max(0, 1 - 3 * dt)).add(new vec3(0, 1.5 * dt, 0))
        p.wobble += dt * 9
        p.pos = p.pos.add(p.vel.uniformScale(dt))
        const w = 1 + 0.08 * Math.sin(p.wobble)
        s = p.size * w * (x < 0.15 ? x / 0.15 : x > 0.88 ? 1 + 0.6 * ((x - 0.88) / 0.12) : 1)
        if (x > 0.97) s = 0.01
      } else {
        p.vel = p.vel.uniformScale(Math.max(0, 1 - 2.2 * dt)).add(new vec3(0, -6 * dt, 0))
        p.pos = p.pos.add(p.vel.uniformScale(dt))
        p.angle += p.spin * dt
        s = p.size * (x < 0.2 ? x / 0.2 : 1 - (x - 0.2) / 0.8)
      }
      const t = p.so.getTransform()
      t.setWorldPosition(p.pos)
      const face = quat.lookAt(cam.sub(p.pos).normalize(), vec3.up())
      t.setWorldRotation(face.multiply(quat.angleAxis(p.angle, vec3.forward())))
      t.setWorldScale(new vec3(Math.max(0.01, s), Math.max(0.01, s), 1))
    }
  }
}
