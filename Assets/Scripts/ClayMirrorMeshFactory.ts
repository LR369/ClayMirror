/**
 * ClayMirrorMeshFactory — code-authored MeshBuilder geometry for Clay Mirror.
 *
 * Owns: pure geometry helpers (lathe / revolved surfaces, boxes, torus rings,
 * ghost-outline strips) that append into a MeshBuilder with a fixed
 * position+normal layout. All solids wind CCW from outside (back-face culling).
 * Must not: create SceneObjects or own materials — controllers do that.
 */

export function newBuilder(): MeshBuilder {
  const b = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
  ])
  b.topology = MeshTopology.Triangles
  b.indexType = MeshIndexType.UInt16
  return b
}

/** Remove all geometry so the builder can be refilled (topology may change). */
export function clearBuilder(b: MeshBuilder): void {
  const ic = b.getIndicesCount()
  if (ic > 0) b.eraseIndices(0, ic)
  const vc = b.getVerticesCount()
  if (vc > 0) b.eraseVertices(0, vc)
}

/** Point on a revolved profile with an explicit 2D outward normal (nr, ny). */
export interface RevPoint {
  r: number
  y: number
  nr: number
  ny: number
}

/** Turn [r, y] points into RevPoints with outward normals from neighbor tangents. */
export function profileWithNormals(profile: [number, number][]): RevPoint[] {
  const P = profile.length
  const out: RevPoint[] = []
  for (let j = 0; j < P; j++) {
    const prev = profile[Math.max(0, j - 1)]
    const next = profile[Math.min(P - 1, j + 1)]
    const dx = next[0] - prev[0]
    const dy = next[1] - prev[1]
    const len = Math.hypot(dy, dx) || 1
    out.push({r: profile[j][0], y: profile[j][1], nr: dy / len, ny: -dx / len})
  }
  return out
}

/**
 * Revolve a profile around +Y. Optional `radiusScale(theta, j)` perturbs the radius
 * per vertex (used for the subtle throwing-ridge wobble that makes the spin visible).
 * Caps are added when `caps` is true and the end radius is non-zero.
 */
export function appendRevolved(
  b: MeshBuilder,
  pts: RevPoint[],
  segments: number,
  caps: boolean,
  offset: vec3 = vec3.zero(),
  radiusScale?: (theta: number, j: number) => number
): void {
  const P = pts.length
  const start = b.getVerticesCount()
  const verts: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const th = (i / segments) * Math.PI * 2
    const c = Math.cos(th)
    const s = Math.sin(th)
    for (let j = 0; j < P; j++) {
      const p = pts[j]
      const k = radiusScale ? radiusScale(th, j) : 1
      verts.push(offset.x + p.r * k * c, offset.y + p.y, offset.z + p.r * k * s, p.nr * c, p.ny, p.nr * s)
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < P - 1; j++) {
      const bl = start + i * P + j
      const br = start + i * P + j + 1
      const tl = start + (i + 1) * P + j
      const tr = start + (i + 1) * P + j + 1
      idx.push(bl, br, tr, bl, tr, tl)
    }
  }
  let vi = start + (segments + 1) * P
  if (caps) {
    const bot = pts[0]
    if (bot.r > 1e-4) {
      const center = vi
      verts.push(offset.x, offset.y + bot.y, offset.z, 0, -1, 0)
      vi++
      const ring = vi
      for (let i = 0; i <= segments; i++) {
        const th = (i / segments) * Math.PI * 2
        const k = radiusScale ? radiusScale(th, 0) : 1
        verts.push(offset.x + bot.r * k * Math.cos(th), offset.y + bot.y, offset.z + bot.r * k * Math.sin(th), 0, -1, 0)
        vi++
      }
      for (let i = 0; i < segments; i++) idx.push(center, ring + i, ring + i + 1)
    }
    const top = pts[P - 1]
    if (top.r > 1e-4) {
      const center = vi
      verts.push(offset.x, offset.y + top.y, offset.z, 0, 1, 0)
      vi++
      const ring = vi
      for (let i = 0; i <= segments; i++) {
        const th = (i / segments) * Math.PI * 2
        const k = radiusScale ? radiusScale(th, P - 1) : 1
        verts.push(offset.x + top.r * k * Math.cos(th), offset.y + top.y, offset.z + top.r * k * Math.sin(th), 0, 1, 0)
        vi++
      }
      for (let i = 0; i < segments; i++) idx.push(center, ring + i + 1, ring + i)
    }
  }
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
}

/** Simple lathe from [r, y] points with caps. */
export function appendLathe(b: MeshBuilder, profile: [number, number][], segments: number, offset: vec3 = vec3.zero()): void {
  appendRevolved(b, profileWithNormals(profile), segments, true, offset)
}

/** Torus around +Y (major radius R, tube radius r) centered at `center`. */
export function appendTorus(b: MeshBuilder, R: number, r: number, segU: number, segV: number, center: vec3 = vec3.zero()): void {
  const pts: RevPoint[] = []
  for (let j = 0; j <= segV; j++) {
    const ph = -Math.PI + (j / segV) * Math.PI * 2
    pts.push({r: R + r * Math.cos(ph), y: r * Math.sin(ph), nr: Math.cos(ph), ny: Math.sin(ph)})
  }
  appendRevolved(b, pts, segU, false, center)
}

/** Axis-aligned box (24 verts, per-face normals, CCW from outside). */
export function appendBox(b: MeshBuilder, center: vec3, size: vec3): void {
  const hx = size.x / 2
  const hy = size.y / 2
  const hz = size.z / 2
  // [normal, u, v] with u × v = normal
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ]
  const h = [hx, hy, hz]
  const start = b.getVerticesCount()
  const verts: number[] = []
  const idx: number[] = []
  faces.forEach((f, fi) => {
    const [n, u, v] = f
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    for (const [su, sv] of corners) {
      const p = [0, 1, 2].map((a) => n[a] * h[a] + u[a] * su * h[a] + v[a] * sv * h[a])
      verts.push(center.x + p[0], center.y + p[1], center.z + p[2], n[0], n[1], n[2])
    }
    const base = start + fi * 4
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
}

/**
 * Ghost outline of a revolved profile: thin vertical strips along `meridians`
 * angles plus horizontal rings at `ringCount` heights. Use a two-sided,
 * see-through material. `radiusAt(y)` gives the target radius.
 */
export function appendGhostOutline(
  b: MeshBuilder,
  radiusAt: (y: number) => number,
  heightCm: number,
  meridians: number,
  ringCount: number,
  stripWidthCm: number,
  inflateCm: number
): void {
  const steps = 40
  const w = stripWidthCm / 2
  const verts: number[] = []
  const idx: number[] = []
  let vi = b.getVerticesCount()
  // Vertical strips
  for (let m = 0; m < meridians; m++) {
    const th = (m / meridians) * Math.PI * 2
    const c = Math.cos(th)
    const s = Math.sin(th)
    const tx = -s
    const tz = c
    const base = vi
    for (let k = 0; k <= steps; k++) {
      const y = (k / steps) * heightCm
      const r = radiusAt(y) + inflateCm
      const px = r * c
      const pz = r * s
      verts.push(px - tx * w, y, pz - tz * w, c, 0, s)
      verts.push(px + tx * w, y, pz + tz * w, c, 0, s)
      vi += 2
    }
    for (let k = 0; k < steps; k++) {
      const a = base + k * 2
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2)
    }
  }
  // Horizontal rings (include top rim and base)
  const seg = 48
  for (let q = 0; q < ringCount; q++) {
    const y = ringCount === 1 ? heightCm : (q / (ringCount - 1)) * heightCm
    const yc = Math.min(heightCm - w, Math.max(w, y))
    const r = radiusAt(yc) + inflateCm
    const base = vi
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      verts.push(r * c, yc - w, r * s, c, 0, s)
      verts.push(r * c, yc + w, r * s, c, 0, s)
      vi += 2
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2
      idx.push(a, a + 2, a + 3, a, a + 3, a + 1)
    }
  }
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
}

/** Create a child SceneObject with a RenderMeshVisual for a finished builder. */
export function makeMeshObject(parent: SceneObject, name: string, builder: MeshBuilder, material: Material): RenderMeshVisual {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  builder.updateMesh()
  rmv.mesh = builder.getMesh()
  if (material) rmv.mainMaterial = material
  return rmv
}

/** Clone a material and tint it (vec4 baseColor). Optional transparent/additive setup. */
export function tintedMaterial(base: Material, color: vec4, mode: "opaque" | "alpha" | "add" = "opaque"): Material {
  const m = base.clone()
  m.mainPass.baseColor = color
  if (mode !== "opaque") {
    m.mainPass.blendMode = mode === "add" ? BlendMode.Add : BlendMode.Normal
    m.mainPass.depthWrite = false
    m.mainPass.twoSided = true
  }
  return m
}

/** Round tube swept along a polyline (used for the bucket's arched handle). */
export function appendTube(b: MeshBuilder, path: vec3[], radius: number, sides: number = 8): void {
  const n = path.length
  if (n < 2) return
  const start = b.getVerticesCount()
  const verts: number[] = []
  const idx: number[] = []
  for (let i = 0; i < n; i++) {
    const prev = path[Math.max(0, i - 1)]
    const next = path[Math.min(n - 1, i + 1)]
    const t = next.sub(prev).normalize()
    const ref = Math.abs(t.y) < 0.9 ? vec3.up() : vec3.right()
    const u = t.cross(ref).normalize()
    const v = t.cross(u).normalize()
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2
      const nrm = u.uniformScale(Math.cos(a)).add(v.uniformScale(Math.sin(a)))
      const p = path[i].add(nrm.uniformScale(radius))
      verts.push(p.x, p.y, p.z, nrm.x, nrm.y, nrm.z)
    }
  }
  const ring = sides + 1
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = start + i * ring + k
      const c = start + (i + 1) * ring + k
      idx.push(a, c, a + 1, a + 1, c, c + 1)
    }
  }
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
}
