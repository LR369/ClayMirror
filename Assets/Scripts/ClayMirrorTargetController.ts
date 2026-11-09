/**
 * ClayMirrorTargetController — the target vase on its stand + the ghost outline.
 *
 * Owns: which target profile is active, the target-vase and stand geometry,
 * and the see-through ghost outline drawn around the clay at the same scale.
 * Expects @inputs: authored TargetVase, GhostOutline objects, lit/unlit materials.
 * Must not: compute scores or touch UI — ClayMirrorMain reads `currentTarget`.
 */
import {TARGET_PROFILES, TargetProfile, targetHeight, targetRadiusAt} from "./ClayMirrorClayModel"
import {appendGhostOutline, appendLathe, clearBuilder, makeMeshObject, newBuilder, tintedMaterial} from "./ClayMirrorMeshFactory"
import {DropIn} from "./ClayMirrorDropIn"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

@component
export class ClayMirrorTargetController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorTargetController – target vase, stand, ghost outline</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Authored object the target vase mesh is built under (top of the stand)")
  targetVase: SceneObject

  @input
  @hint("Authored object (on the wheel, at the clay's base) for the ghost outline")
  ghostOutline: SceneObject

  @input
  @hint("Lit material (PBR) for the vase and stand")
  litMaterial: Material

  @input
  @hint("Unlit material for the ghost outline")
  unlitMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Height of the stand the target vase sits on (cm)")
  @widget(new SliderWidget(10, 60, 1))
  standHeightCm: number = 12

  @input("vec4", "{0.80,0.93,0.88,1}")
  @hint("Target vase glaze color")
  @widget(new ColorWidget())
  vaseColor: vec4

  @input("vec4", "{0.80,0.74,0.66,1}")
  @hint("Stand color")
  @widget(new ColorWidget())
  standColor: vec4

  @input("vec4", "{0.70,0.95,1.0,0.45}")
  @hint("Ghost outline color (light, see-through)")
  @widget(new ColorWidget())
  ghostColor: vec4

  @input
  @hint("Index of the first item (0 = Mug … 9 = Urn, easiest → hardest)")
  @widget(new SliderWidget(0, 9, 1))
  startTargetIndex: number = 0
  @ui.group_end

  private _index = 0
  private vaseBuilder: MeshBuilder
  private ghostBuilder: MeshBuilder
  private popT = -1
  private vaseMat: Material
  private drop: DropIn
  private _onDropLanded = new Event<void>()

  /** The target piece landed on its stand after a drop-in. */
  get onDropLanded(): PublicApi<void> { return this._onDropLanded.publicApi() }
  get isDropping(): boolean { return !!this.drop && this.drop.isFalling }
  get isHighlighted(): boolean { return !!this.drop && this.drop.isGlowing }

  /** Drop the target piece onto its stand from above, then glow green for a few seconds. */
  dropIn(heightCm: number = 35): void {
    this.setVaseVisible(true)
    this.drop.start(heightCm)
  }

  get currentTarget(): TargetProfile { return TARGET_PROFILES[this._index] }
  get targetIndex(): number { return this._index }
  get targetCount(): number { return TARGET_PROFILES.length }
  /** Height of the current target (cm). */
  get currentHeightCm(): number { return targetHeight(this.currentTarget) }
  /** Top of the stand in this object's local space (cm). */
  get standTopCm(): number { return this.standHeightCm }
  get ghostVisible(): boolean { return !!this.ghostOutline && this.ghostOutline.enabled }
  get vaseVisible(): boolean { return !!this.targetVase && this.targetVase.enabled }

  /** Show/hide the target piece on the stand (hidden while the inspector's board stands there). */
  setVaseVisible(on: boolean, pop: boolean = false): void {
    if (!this.targetVase) return
    if (!on && this.drop) {
      this.drop.reset()
      this.targetVase.getTransform().setLocalPosition(new vec3(0, this.standHeightCm, 0))
    }
    this.targetVase.enabled = on
    if (on && pop) {
      this.popT = 0
      this.targetVase.getTransform().setLocalScale(new vec3(0.01, 0.01, 0.01))
    } else {
      this.popT = -1
      this.targetVase.getTransform().setLocalScale(vec3.one())
    }
  }

  onUpdatePop(): void {
    if (this.popT < 0) return
    this.popT += getDeltaTime()
    const x = Math.min(1, this.popT / 0.45)
    const s = x < 0.7 ? (x / 0.7) * 1.12 : 1.12 - 0.12 * ((x - 0.7) / 0.3)
    this.targetVase.getTransform().setLocalScale(new vec3(Math.max(0.01, s), Math.max(0.01, s), Math.max(0.01, s)))
    if (x >= 1) this.popT = -1
  }

  onAwake(): void {
    if (!this.targetVase || !this.ghostOutline || !this.litMaterial || !this.unlitMaterial) {
      print("ClayMirrorTargetController: required @input not wired.")
      return
    }
    this._index = Math.max(0, Math.min(TARGET_PROFILES.length - 1, this.startTargetIndex))
    // Stand: built on this object, top at standHeightCm.
    const stand = newBuilder()
    const h = this.standHeightCm
    appendLathe(stand, [[0.01, 0], [8, 0], [8, 1.5], [3.2, 2.5], [3.2, h - 1.5], [7, h - 1], [7, h], [0.01, h]], 32)
    makeMeshObject(this.sceneObject, "StandMesh", stand, tintedMaterial(this.litMaterial, this.standColor))
    this.targetVase.getTransform().setLocalPosition(new vec3(0, h, 0))

    this.vaseBuilder = newBuilder()
    this.vaseMat = tintedMaterial(this.litMaterial, this.vaseColor)
    makeMeshObject(this.targetVase, "VaseMesh", this.vaseBuilder, this.vaseMat)
    this.drop = new DropIn(
      () => this.targetVase.getTransform(),
      () => new vec3(0, this.standHeightCm, 0),
      () => this.vaseMat,
      () => this.vaseColor,
      () => this._onDropLanded.invoke(),
    )
    this.ghostBuilder = newBuilder()
    makeMeshObject(this.ghostOutline, "GhostMesh", this.ghostBuilder, tintedMaterial(this.unlitMaterial, this.ghostColor, "add"))
    this.rebuild()
    this.setGhostVisible(false)
    this.createEvent("UpdateEvent").bind(() => {
      this.onUpdatePop()
      this.drop.update(getDeltaTime())
    })
  }

  /** Switch to the next target in the list (used by "Next vase"). */
  nextTarget(): void {
    this.setTargetIndex((this._index + 1) % TARGET_PROFILES.length)
  }

  setTargetIndex(i: number): void {
    this._index = ((i % TARGET_PROFILES.length) + TARGET_PROFILES.length) % TARGET_PROFILES.length
    this.rebuild()
  }

  setGhostVisible(on: boolean): void {
    if (this.ghostOutline) this.ghostOutline.enabled = on
  }

  private rebuild(): void {
    const t = this.currentTarget
    const H = targetHeight(t)
    // Vase: outer wall, rolled lip, and a dark-free (light) inner wall so the opening reads.
    const prof: [number, number][] = []
    const steps = 30
    for (let k = 0; k <= steps; k++) {
      const y = (k / steps) * H
      prof.push([Math.max(0.3, targetRadiusAt(t, Math.min(H, y))), y])
    }
    const topR = prof[prof.length - 1][0]
    prof.push([topR - 0.6, H + 0.3])
    prof.push([topR - 1.0, H - 0.5])
    prof.push([0.01, H - 3])
    clearBuilder(this.vaseBuilder)
    appendLathe(this.vaseBuilder, prof, 40)
    this.vaseBuilder.updateMesh()

    clearBuilder(this.ghostBuilder)
    appendGhostOutline(this.ghostBuilder, (y) => targetRadiusAt(t, Math.min(H - 0.01, Math.max(0.01, y))), H, 16, 7, 0.35, 0.15)
    this.ghostBuilder.updateMesh()
  }
}
