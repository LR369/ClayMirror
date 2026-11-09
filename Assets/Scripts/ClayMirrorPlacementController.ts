/**
 * ClayMirrorPlacementController — the workbench stand-in and its placement step.
 *
 * Owns: the virtual bench geometry (top + height-scaled legs + placement glow),
 * placement mode (bench grabbable, level, yaws to face the user), bench height,
 * and the initial "in front of you at table height" placement.
 * Kept separate from the game so snapping to a real table can replace it later:
 * the game only listens for ClayMirrorMain's Start and reads nothing here
 * except "is placement mode on".
 * Must not: touch UI, wheel, clay or score.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {appendBox, makeMeshObject, newBuilder, tintedMaterial} from "./ClayMirrorMeshFactory"

@component
export class ClayMirrorPlacementController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorPlacementController – place the bench (drag + height)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Authored child holding the bench-top grab collider (built at runtime)")
  benchGrab: SceneObject

  @input
  @hint("Authored child the bench visual is built under")
  benchVisual: SceneObject

  @input
  @hint("Lit material (PBR) for the wood")
  litMaterial: Material

  @input
  @hint("Unlit material for the soft placement outline")
  unlitMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Assumed eye height above the floor (cm) — sets where the floor is")
  @widget(new SliderWidget(100, 190, 1))
  eyeHeightCm: number = 150

  @input
  @hint("Starting bench-top height above the floor (cm)")
  @widget(new SliderWidget(55, 110, 1))
  defaultHeightCm: number = 75

  @input
  @hint("Lowest bench height on the slider (cm) — seated")
  @widget(new SliderWidget(40, 80, 1))
  minHeightCm: number = 55

  @input
  @hint("Highest bench height on the slider (cm) — tall standing")
  @widget(new SliderWidget(80, 130, 1))
  maxHeightCm: number = 110

  @input
  @hint("Distance from the user to the bench's front edge at start (cm)")
  @widget(new SliderWidget(20, 80, 1))
  frontEdgeDistanceCm: number = 40

  @input
  @hint("Bench width (cm)")
  @widget(new SliderWidget(60, 140, 1))
  benchWidthCm: number = 100

  @input
  @hint("Bench depth (cm)")
  @widget(new SliderWidget(40, 90, 1))
  benchDepthCm: number = 60

  @input("vec4", "{0.86,0.70,0.52,1}")
  @hint("Bench wood color (light oak reads best on the additive display)")
  @widget(new ColorWidget())
  woodColor: vec4

  @input("vec4", "{0.75,1.0,0.85,0.7}")
  @hint("Soft outline shown while the bench can be moved")
  @widget(new ColorWidget())
  outlineColor: vec4
  @ui.group_end

  private _placementMode = false
  private _heightCm = 75
  private floorY = -150
  private legs: SceneObject
  private outline: SceneObject
  private interactable: Interactable
  private manipulation: InteractableManipulation
  private _onBenchMoved = new Event<void>()
  private settleTime = 0.6 // re-place while device tracking settles on the first frames
  private userMovedBench = false

  get onBenchMoved(): PublicApi<void> { return this._onBenchMoved.publicApi() }
  /** True while the bench can be dragged / height-adjusted. */
  get isPlacementMode(): boolean { return this._placementMode }
  /** Current bench-top height above the floor (cm). */
  get benchHeightCm(): number { return this._heightCm }
  /** Height as 0..1 along the slider range. */
  get heightNorm(): number { return (this._heightCm - this.minHeightCm) / Math.max(1, this.maxHeightCm - this.minHeightCm) }
  /** World Y of the assumed floor. */
  get floorWorldY(): number { return this.floorY }
  get isBeingDragged(): boolean { return !!this.manipulation && this.manipulation.isManipulating() }

  onAwake(): void {
    if (!this.benchGrab || !this.benchVisual || !this.litMaterial || !this.unlitMaterial) {
      print("ClayMirrorPlacementController: required @input not wired.")
      return
    }
    this._heightCm = this.defaultHeightCm
    this.buildBench()

    const col = this.benchGrab.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    box.size = new vec3(this.benchWidthCm, 6, this.benchDepthCm)
    col.shape = box
    col.fitVisual = false
    this.benchGrab.getTransform().setLocalPosition(new vec3(0, -3, 0))
    this.interactable = this.benchGrab.createComponent(Interactable.getTypeName()) as Interactable
    this.manipulation = this.benchGrab.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    this.manipulation.setManipulateRoot(this.sceneObject.getTransform())
    this.manipulation.setCanRotate(false)
    this.manipulation.setCanScale(false)

    this.createEvent("OnStartEvent").bind(() => {
      this.placeInFrontOfUser()
      this.manipulation.onManipulationStart.add(() => {
        this.userMovedBench = true
      })
      this.manipulation.onManipulationUpdate.add(() => this._onBenchMoved.invoke())
      this.manipulation.onManipulationEnd.add(() => this._onBenchMoved.invoke())
      this.applyMode()
    })
    this.createEvent("LateUpdateEvent").bind(() => this.onLateUpdate())
    this.createEvent("UpdateEvent").bind(() => {
      if (this.settleTime <= 0) return
      this.settleTime -= getDeltaTime()
      if (!this.userMovedBench) this.placeInFrontOfUser(this.settleTime <= 0)
    })
  }

  private buildBench(): void {
    const W = this.benchWidthCm
    const D = this.benchDepthCm
    const wood = tintedMaterial(this.litMaterial, this.woodColor)

    const top = newBuilder()
    appendBox(top, new vec3(0, -2, 0), new vec3(W, 4, D))
    appendBox(top, new vec3(0, -6, D / 2 - 2), new vec3(W - 8, 4, 2)) // front apron
    appendBox(top, new vec3(0, -6, -D / 2 + 2), new vec3(W - 8, 4, 2)) // back apron
    makeMeshObject(this.benchVisual, "BenchTop", top, wood)

    // Legs are built 1 cm tall (y 0 → -1) and scaled to the bench height (leaf visual only).
    this.legs = global.scene.createSceneObject("BenchLegs")
    this.legs.setParent(this.benchVisual)
    this.legs.getTransform().setLocalPosition(new vec3(0, -4, 0))
    const legs = newBuilder()
    const lx = W / 2 - 5
    const lz = D / 2 - 5
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) appendBox(legs, new vec3(sx * lx, -0.5, sz * lz), new vec3(5, 1, 5))
    makeMeshObject(this.legs, "LegsMesh", legs, wood)

    // Soft glow frame around the top while it can be moved.
    this.outline = global.scene.createSceneObject("PlacementOutline")
    this.outline.setParent(this.benchVisual)
    const o = newBuilder()
    const t = 0.8
    appendBox(o, new vec3(0, 0.25, D / 2 + t / 2), new vec3(W + 2 * t, 0.5, t))
    appendBox(o, new vec3(0, 0.25, -D / 2 - t / 2), new vec3(W + 2 * t, 0.5, t))
    appendBox(o, new vec3(W / 2 + t / 2, 0.25, 0), new vec3(t, 0.5, D))
    appendBox(o, new vec3(-W / 2 - t / 2, 0.25, 0), new vec3(t, 0.5, D))
    makeMeshObject(this.outline, "OutlineMesh", o, tintedMaterial(this.unlitMaterial, this.outlineColor, "add"))
    this.applyLegHeight()
  }

  private applyLegHeight(): void {
    if (this.legs) this.legs.getTransform().setLocalScale(new vec3(1, Math.max(1, this._heightCm - 4), 1))
  }

  /** Put the bench in front of the user at table height, front edge facing them. */
  placeInFrontOfUser(log: boolean = true): void {
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const cam = camT.getWorldPosition()
    const view = camT.forward.uniformScale(-1) // the camera looks along its local -Z
    let fwd = new vec3(view.x, 0, view.z)
    fwd = fwd.length > 0.001 ? fwd.normalize() : new vec3(0, 0, -1)
    this.floorY = cam.y - this.eyeHeightCm
    const center = cam.add(fwd.uniformScale(this.frontEdgeDistanceCm + this.benchDepthCm / 2))
    this.sceneObject.getTransform().setWorldPosition(new vec3(center.x, this.floorY + this._heightCm, center.z))
    this.faceUser()
    if (log) print(`ClayMirror: camera at ${cam.toString()}, floor y=${this.floorY.toFixed(1)}, bench top y=${(this.floorY + this._heightCm).toFixed(1)}`)
    this._onBenchMoved.invoke()
  }

  /** Move the bench (world XZ; Y follows the height setting). Used by tests too. */
  moveBenchTo(worldPos: vec3): void {
    this.userMovedBench = true
    this.sceneObject.getTransform().setWorldPosition(new vec3(worldPos.x, this.floorY + this._heightCm, worldPos.z))
    this.faceUser()
    this._onBenchMoved.invoke()
  }

  getBenchWorldPosition(): vec3 {
    return this.sceneObject.getTransform().getWorldPosition()
  }

  /** Set bench-top height (cm), clamped to the slider range. */
  setBenchHeightCm(cm: number): void {
    this.userMovedBench = true
    this._heightCm = Math.max(this.minHeightCm, Math.min(this.maxHeightCm, cm))
    const p = this.sceneObject.getTransform().getWorldPosition()
    this.sceneObject.getTransform().setWorldPosition(new vec3(p.x, this.floorY + this._heightCm, p.z))
    this.applyLegHeight()
    this._onBenchMoved.invoke()
  }

  /** Set height from a 0..1 slider value. */
  setHeightNorm(v: number): void {
    const t = Math.max(0, Math.min(1, v))
    this.setBenchHeightCm(this.minHeightCm + t * (this.maxHeightCm - this.minHeightCm))
  }

  enterPlacement(): void {
    this._placementMode = true
    this.applyMode()
  }

  exitPlacement(): void {
    this._placementMode = false
    this.applyMode()
  }

  private applyMode(): void {
    if (this.outline) this.outline.enabled = this._placementMode
    if (this.interactable) this.interactable.enabled = this._placementMode
    if (this.manipulation) {
      this.manipulation.enabled = this._placementMode
      this.manipulation.setCanTranslate(this._placementMode)
    }
  }

  private faceUser(): void {
    const cam = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
    const p = this.sceneObject.getTransform().getWorldPosition()
    const dx = cam.x - p.x
    const dz = cam.z - p.z
    if (dx * dx + dz * dz < 1) return
    this.sceneObject.getTransform().setWorldRotation(quat.angleAxis(Math.atan2(dx, dz), vec3.up()))
  }

  private onLateUpdate(): void {
    // While dragging: stay level at the chosen height and keep the front edge facing the user.
    if (this._placementMode && this.isBeingDragged) {
      const p = this.sceneObject.getTransform().getWorldPosition()
      this.sceneObject.getTransform().setWorldPosition(new vec3(p.x, this.floorY + this._heightCm, p.z))
      this.faceUser()
    }
  }
}
