/**
 * ClayMirrorProgressSign — a fun, fresh little sign hung on the bench's front edge under the
 * clay block: which piece you're on (with 10 progress dots), your potter level badge, and an
 * XP bar with "120 / 150 XP".
 *
 * Code-built: mint plate with a teal border, coral level badge, dark-teal "ink" text (the plate
 * is bright, so on the additive display the ink reads as see-through letters on a lit sign).
 * Created at runtime by ClayMirrorMain via init(); passive — Main pushes values with show().
 * API: init(bench, litMaterial, unlitMaterial), show(view), setVisible(on)
 */
import {addText, obj} from "./ClayMirrorUIHelpers"
import {appendBox, appendLathe, makeMeshObject, newBuilder, tintedMaterial} from "./ClayMirrorMeshFactory"

export interface ProgressView {
  itemIndex: number // 0-based
  itemCount: number
  itemName: string
  level: number
  xpInLevel: number
  xpPerLevel: number
  complete: boolean
}

const MINT = new vec4(0.8, 1.0, 0.9, 1)
const TEAL = new vec4(0.2, 0.72, 0.68, 1)
const CORAL = new vec4(1.0, 0.55, 0.45, 1)
const INK = new vec4(0.04, 0.28, 0.3, 1)
const DOT_TODO = new vec4(0.62, 0.86, 0.82, 1)
const W = 26
const H = 13

@component
export class ClayMirrorProgressSign extends BaseScriptComponent {
  /** Bench-local mount: on the front edge, under the clay block's rest spot. */
  mountLocal = new vec3(30, -9.5, 34.5)
  /** Tilt back so the face points up toward the player (degrees about X). */
  tiltDeg = -40

  private root: SceneObject
  private titleText: Text
  private levelText: Text
  private xpText: Text
  private barFill: SceneObject
  private dots: RenderMeshVisual[] = []
  private matDone: Material
  private matNow: Material
  private matTodo: Material
  private barW = 16
  private shownFill = 0
  private targetFill = 0
  private _view: ProgressView | null = null

  get isVisible(): boolean { return !!this.root && this.root.enabled }
  get titleLabel(): string { return this.titleText ? this.titleText.text : "" }
  get levelLabel(): string { return this.levelText ? this.levelText.text : "" }
  get xpLabel(): string { return this.xpText ? this.xpText.text : "" }
  get barFillValue(): number { return this.shownFill }
  get view(): ProgressView | null { return this._view }
  getSignObject(): SceneObject { return this.root }

  init(bench: SceneObject, litMaterial: Material, unlitMaterial: Material): void {
    this.root = global.scene.createSceneObject("ProgressSign")
    this.root.setParent(bench)
    const t = this.root.getTransform()
    t.setLocalPosition(this.mountLocal)
    t.setLocalRotation(quat.angleAxis((this.tiltDeg * Math.PI) / 180, vec3.right()))
    this.root.createComponent("Component.Canvas")

    // Plate: teal border behind a mint face; drawn first so text (no depth write) stays on top.
    const border = newBuilder()
    appendBox(border, new vec3(0, 0, -0.5), new vec3(W + 1.6, H + 1.6, 0.6))
    makeMeshObject(this.root, "SignBorder", border, tintedMaterial(unlitMaterial, TEAL)).setRenderOrder(-21)
    const face = newBuilder()
    appendBox(face, new vec3(0, 0, -0.1), new vec3(W, H, 0.3))
    makeMeshObject(this.root, "SignFace", face, tintedMaterial(unlitMaterial, MINT)).setRenderOrder(-20)
    // Two little screws for the "hung on the bench" look.
    const screws = newBuilder()
    appendLathe(screws, [[0.01, 0], [0.5, 0], [0.5, 0.25], [0.01, 0.35]], 12, new vec3(-W / 2 + 1, 0.1, -(H / 2 - 1)))
    appendLathe(screws, [[0.01, 0], [0.5, 0], [0.5, 0.25], [0.01, 0.35]], 12, new vec3(W / 2 - 1, 0.1, -(H / 2 - 1)))
    const sObj = obj(this.root, "Screws")
    sObj.getTransform().setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.right()))
    makeMeshObject(sObj, "ScrewMesh", screws, tintedMaterial(litMaterial, new vec4(0.85, 0.87, 0.9, 1)))

    // Level badge (coral disc) on the left.
    const badge = obj(this.root, "LevelBadge", new vec3(-W / 2 + 4.6, -0.3, 0.1))
    const disc = newBuilder()
    appendLathe(disc, [[0.01, 0], [3.7, 0], [3.7, 0.2], [0.01, 0.2]], 32)
    const discObj = obj(badge, "Disc")
    discObj.getTransform().setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.right()))
    makeMeshObject(discObj, "DiscMesh", disc, tintedMaterial(unlitMaterial, CORAL)).setRenderOrder(-19)
    const lvCap = obj(badge, "LvCaption", new vec3(0, 1.7, 0.4))
    addText(lvCap, "LEVEL", "Callout", 6, new vec4(1, 1, 1, 1), 110, 1.6)
    const lvNum = obj(badge, "LvNumber", new vec3(0, -0.8, 0.4))
    this.levelText = addText(lvNum, "1", "Title1", 6, new vec4(1, 1, 1, 1), 130, 4)

    // Right column: title, progress dots, XP bar, XP text.
    const cx = 3.6
    const title = obj(this.root, "Title", new vec3(cx, 4.0, 0.4))
    this.titleText = addText(title, "Piece 1 of 10 · Mug", "Headline2", 17, INK, 110, 2.4)
    this.matDone = tintedMaterial(unlitMaterial, CORAL)
    this.matNow = tintedMaterial(unlitMaterial, TEAL)
    this.matTodo = tintedMaterial(unlitMaterial, DOT_TODO)
    const dotMesh = newBuilder()
    appendLathe(dotMesh, [[0.01, 0], [0.62, 0], [0.62, 0.15], [0.01, 0.15]], 16)
    dotMesh.updateMesh()
    for (let i = 0; i < 10; i++) {
      const d = obj(this.root, "Dot" + i, new vec3(cx - 7.2 + i * 1.6, 1.0, 0.15))
      d.getTransform().setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.right()))
      const rmv = d.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = dotMesh.getMesh()
      rmv.mainMaterial = this.matTodo
      rmv.setRenderOrder(-19)
      this.dots.push(rmv)
    }
    const track = newBuilder()
    appendBox(track, new vec3(cx, -2.2, 0.1), new vec3(this.barW, 1.4, 0.2))
    makeMeshObject(this.root, "XpTrack", track, tintedMaterial(unlitMaterial, DOT_TODO)).setRenderOrder(-19)
    const fill = newBuilder()
    appendBox(fill, new vec3(0.5, 0, 0), new vec3(1, 1, 1)) // unit box, left edge at x=0
    this.barFill = obj(this.root, "XpFill", new vec3(cx - this.barW / 2, -2.2, 0.25))
    makeMeshObject(this.barFill, "XpFillMesh", fill, tintedMaterial(unlitMaterial, CORAL)).setRenderOrder(-18)
    this.barFill.getTransform().setLocalScale(new vec3(0.01, 1.4, 0.2))
    const xp = obj(this.root, "XpText", new vec3(cx, -4.6, 0.4))
    this.xpText = addText(xp, "0 / 150 XP", "Headline2", 17, INK, 100, 2.2)

    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.root.enabled = false
  }

  setVisible(on: boolean): void {
    if (this.root) this.root.enabled = on
  }

  show(v: ProgressView): void {
    this._view = v
    this.titleText.text = v.complete ? `All ${v.itemCount} pieces done!` : `Piece ${v.itemIndex + 1} of ${v.itemCount} · ${v.itemName}`
    this.levelText.text = `${v.level}`
    this.xpText.text = `${v.xpInLevel} / ${v.xpPerLevel} XP`
    for (let i = 0; i < this.dots.length; i++) {
      const done = v.complete || i < v.itemIndex
      const now = !v.complete && i === v.itemIndex
      this.dots[i].mainMaterial = done ? this.matDone : now ? this.matNow : this.matTodo
      const s = now ? 1.35 : 1
      this.dots[i].getSceneObject().getTransform().setLocalScale(new vec3(s, s, s))
    }
    this.targetFill = Math.max(0, Math.min(1, v.xpInLevel / Math.max(1, v.xpPerLevel)))
  }

  private onUpdate(): void {
    // Ease the XP bar toward its target (it visibly fills when you collect).
    const d = this.targetFill - this.shownFill
    if (Math.abs(d) < 0.001) return
    this.shownFill += d * Math.min(1, getDeltaTime() * 4)
    if (d < 0 && this.shownFill < this.targetFill + 0.002) this.shownFill = this.targetFill
    this.barFill.getTransform().setLocalScale(new vec3(Math.max(0.01, this.shownFill * this.barW), 1.4, 0.2))
  }
}
