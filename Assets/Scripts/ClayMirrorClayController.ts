/**
 * ClayMirrorClayController — the clay block: drop onto the wheel, sculpt, pinch ring.
 *
 * Owns: the ClayModel instance (profile + undo), the clay's live lathe mesh,
 * its SIK Interactable/InteractableManipulation (grab-and-drop before landing,
 * pinch-drag sculpting after), and the glowing pinch ring.
 * Expects @inputs: wheel controller, rest anchor (on the bench), clay anchor
 * (wheel head top), pinch-ring object, lit/unlit materials.
 * Must not: touch UI, audio or game phase — it emits events; ClayMirrorMain reacts.
 * Length note (>400 lines): drop, sculpt-drag projection and the pinch ring share
 * one Interactable and one live profile; the pure shape logic is already split out
 * into ClayMirrorClayModel. A follow-up could move the ring into its own component.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {Interactor} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {ClayModel, DEFAULT_CLAY_CONFIG, DragResult} from "./ClayMirrorClayModel"
import {appendRevolved, appendTorus, clearBuilder, newBuilder, profileWithNormals, tintedMaterial} from "./ClayMirrorMeshFactory"
import {ClayMirrorWheelController} from "./ClayMirrorWheelController"
import {DropIn} from "./ClayMirrorDropIn"

@component
export class ClayMirrorClayController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorClayController – drop, sculpt, collapse, undo</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The potter's wheel (spin angle + state)")
  wheel: ClayMirrorWheelController

  @input
  @hint("Where the fresh block rests on the bench beside the wheel")
  restAnchor: SceneObject

  @input
  @hint("Top-center of the wheel head; the clay snaps here when dropped")
  clayAnchor: SceneObject

  @input
  @hint("Object that holds the glowing pinch ring (built at runtime)")
  pinchRingObject: SceneObject

  @input
  @hint("Lit material (PBR) for the clay")
  litMaterial: Material

  @input
  @hint("Unlit material for the glowing pinch ring")
  unlitMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec4", "{0.93,0.66,0.50,1}")
  @hint("Clay color (keep it light — the display is additive)")
  @widget(new ColorWidget())
  clayColor: vec4

  @input("vec4", "{0.55,1.0,0.65,0.55}")
  @hint("Pinch ring color while aiming")
  @widget(new ColorWidget())
  ringColor: vec4

  @input
  @hint("Ring brightness multiplier while pinching")
  @widget(new SliderWidget(1, 3, 0.1))
  ringPinchBoost: number = 1.8

  @input
  @hint("Release the block within this horizontal distance of the wheel center to land it (cm)")
  @widget(new SliderWidget(8, 30, 1))
  dropRadiusCm: number = 18

  @input
  @hint("Collapse if any part gets thinner than this radius (cm)")
  @widget(new SliderWidget(0.5, 3, 0.1))
  collapseMinRadiusCm: number = 1.2

  @input
  @hint("Collapse if the piece is pulled taller than this (cm)")
  @widget(new SliderWidget(20, 45, 1))
  collapseMaxHeightCm: number = 34

  @input
  @hint("How strongly a drag reshapes the clay")
  @widget(new SliderWidget(0.3, 2, 0.05))
  sculptGain: number = 1.0

  @input
  @hint("How wide a band each pinch reshapes (cm)")
  @widget(new SliderWidget(1, 6, 0.1))
  falloffCm: number = 2.6
  @ui.group_end

  readonly model = new ClayModel(Object.assign({}, DEFAULT_CLAY_CONFIG))

  private visualObj: SceneObject
  private hitObj: SceneObject
  private builder: MeshBuilder
  private collider: ColliderComponent
  private interactable: Interactable
  private manipulation: InteractableManipulation
  private ringBuilder: MeshBuilder
  private ringMat: Material
  private ringRmv: RenderMeshVisual
  private lastRingRadius = -1

  private _onWheel = false
  private _sculptEnabled = false
  private _grabEnabled = true
  private activeInteractor: Interactor | null = null
  private strokeHeightNorm = 0
  private lastPlanePoint: vec3 | null = null
  private planeNormal = vec3.forward()
  private planeOrigin = vec3.zero()
  private strokeSide = 1
  private hoverHeightNorm = -1
  private _ringVisible = false
  private _ringBright = false
  private _ringHeightCm = 0

  private _onLanded = new Event<void>()
  private _onStrokeStart = new Event<void>()
  private _onStrokeEnd = new Event<void>()
  private _onDragMoved = new Event<void>()
  private _onCollapsed = new Event<void>()
  private _onShapeChanged = new Event<void>()
  private _onDropLanded = new Event<void>()
  private clayMat: Material
  private drop: DropIn

  /** The fresh block landed on the bench after a drop-in. */
  get onDropLanded(): PublicApi<void> { return this._onDropLanded.publicApi() }
  get isDropping(): boolean { return !!this.drop && this.drop.isFalling }
  get isHighlighted(): boolean { return !!this.drop && this.drop.isGlowing }
  get dropLandCount(): number { return this.drop ? this.drop.landCount : 0 }

  /** Clay landed on the wheel (drop or test helper). */
  get onLanded(): PublicApi<void> { return this._onLanded.publicApi() }
  /** A sculpting pinch began on the spinning clay. */
  get onStrokeStart(): PublicApi<void> { return this._onStrokeStart.publicApi() }
  /** A sculpting pinch ended. */
  get onStrokeEnd(): PublicApi<void> { return this._onStrokeEnd.publicApi() }
  /** The clay changed during a drag (use for squish SFX). */
  get onDragMoved(): PublicApi<void> { return this._onDragMoved.publicApi() }
  /** The piece collapsed into a blob. */
  get onCollapsed(): PublicApi<void> { return this._onCollapsed.publicApi() }
  /** Any profile change (drag, undo, reset). */
  get onShapeChanged(): PublicApi<void> { return this._onShapeChanged.publicApi() }

  // ── Public state (for ClayMirrorMain and LEAF tests) ───────────────────────
  get isOnWheel(): boolean { return this._onWheel }
  get isCollapsed(): boolean { return this.model.collapsed }
  get isSculpting(): boolean { return this.activeInteractor !== null }
  get heightCm(): number { return this.model.heightCm }
  get ringVisible(): boolean { return this._ringVisible }
  get ringBright(): boolean { return this._ringBright }
  get ringHeightCm(): number { return this._ringHeightCm }
  getRadii(): number[] { return this.model.getRadii() }
  /** Radius (cm) at a normalized height 0..1. */
  radiusAtNorm(h: number): number { return this.model.radiusAt(Math.max(0, Math.min(1, h)) * this.model.heightCm) }

  onAwake(): void {
    if (!this.wheel || !this.restAnchor || !this.clayAnchor || !this.pinchRingObject || !this.litMaterial || !this.unlitMaterial) {
      print("ClayMirrorClayController: required @input not wired.")
      return
    }
    const cfg = this.model.config
    cfg.minRadiusCm = this.collapseMinRadiusCm
    cfg.maxHeightCm = this.collapseMaxHeightCm
    cfg.radialGain = this.sculptGain
    cfg.verticalGain = this.sculptGain
    cfg.falloffCm = this.falloffCm

    // Visual leaf (spins with the wheel); collider wrapper stays unit-scale, unrotated.
    this.visualObj = global.scene.createSceneObject("ClayVisual")
    this.visualObj.setParent(this.sceneObject)
    const rmv = this.visualObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.builder = newBuilder()
    this.rebuildMesh()
    rmv.mesh = this.builder.getMesh()
    this.clayMat = tintedMaterial(this.litMaterial, this.clayColor)
    rmv.mainMaterial = this.clayMat
    this.drop = new DropIn(
      () => this.sceneObject.getTransform(),
      () => vec3.zero(),
      () => this.clayMat,
      () => this.clayColor,
      () => {
        this.applyInteractionMode()
        this._onDropLanded.invoke()
      },
    )

    this.hitObj = global.scene.createSceneObject("ClayHit")
    this.hitObj.setParent(this.sceneObject)
    this.collider = this.hitObj.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    box.size = new vec3(12, 15, 12)
    this.collider.shape = box
    this.collider.fitVisual = false
    this.updateCollider()
    this.interactable = this.hitObj.createComponent(Interactable.getTypeName()) as Interactable
    this.manipulation = this.hitObj.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    this.manipulation.setManipulateRoot(this.sceneObject.getTransform())
    this.manipulation.setCanRotate(false)
    this.manipulation.setCanScale(false)

    // Pinch ring
    this.ringBuilder = newBuilder()
    this.ringRmv = this.pinchRingObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.ringMat = tintedMaterial(this.unlitMaterial, this.ringColor, "add")
    this.ringRmv.mainMaterial = this.ringMat
    this.setRing(false, 0, false)

    this.createEvent("OnStartEvent").bind(() => this.bindInteraction())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.moveToRest()
  }

  private bindInteraction(): void {
    this.manipulation.onManipulationEnd.add(() => this.onBlockReleased())
    this.interactable.onTriggerStart.add((e: InteractorEvent) => this.onPinchStart(e))
    this.interactable.onTriggerEnd.add(() => this.onPinchEnd())
    this.interactable.onTriggerEndOutside.add(() => this.onPinchEnd())
    this.interactable.onTriggerCanceled.add(() => this.onPinchEnd())
    this.interactable.onHoverUpdate.add((e: InteractorEvent) => this.onHover(e))
    this.interactable.onHoverExit.add(() => {
      this.hoverHeightNorm = -1
    })
    this.applyInteractionMode()
  }

  // ── Modes ───────────────────────────────────────────────────────────────────
  /** Allow/forbid grabbing the block (only before it lands). */
  setGrabEnabled(on: boolean): void {
    this._grabEnabled = on
    this.applyInteractionMode()
  }

  /** Allow/forbid sculpting (only while on the spinning wheel). */
  setSculptEnabled(on: boolean): void {
    this._sculptEnabled = on
    if (!on) this.onPinchEnd()
    this.applyInteractionMode()
  }

  get sculptEnabled(): boolean { return this._sculptEnabled }
  get grabEnabled(): boolean { return this._grabEnabled }

  private applyInteractionMode(): void {
    if (!this.manipulation || !this.interactable) return
    const canGrab = this._grabEnabled && !this._onWheel && !(this.drop && this.drop.isFalling)
    this.manipulation.setCanTranslate(canGrab)
    this.manipulation.enabled = canGrab
    this.interactable.enabled = canGrab || (this._onWheel && this._sculptEnabled)
    if (!this.interactable.enabled) this.setRing(false, 0, false)
  }

  /** Put a fresh block back on the bench (Start Over / Next vase). */
  /** Show/hide the block (hidden while the bench is first being placed). */
  setPieceVisible(on: boolean): void {
    if (this.visualObj) this.visualObj.enabled = on
  }

  /** Drop the fresh block into its rest spot from above, then glow green for a few seconds. */
  dropIn(heightCm: number = 30): void {
    this.setPieceVisible(true)
    this.drop.start(heightCm)
    this.applyInteractionMode()
  }

  resetClay(): void {
    if (this.drop) this.drop.reset()
    this.endPresentation()
    this.onPinchEnd()
    this.model.reset()
    this._onWheel = false
    this.moveToRest()
    this.rebuildAll()
    this.applyInteractionMode()
  }

  /** Snap the block to the wheel center (also used by the drop and by tests). */
  placeOnWheel(): void {
    if (this.drop) this.drop.cancelFall()
    this.setPieceVisible(true)
    this.sceneObject.setParent(this.clayAnchor)
    const t = this.sceneObject.getTransform()
    t.setLocalPosition(vec3.zero())
    t.setLocalRotation(quat.quatIdentity())
    this._onWheel = true
    this.applyInteractionMode()
    this._onLanded.invoke()
  }

  private moveToRest(): void {
    this.sceneObject.setParent(this.restAnchor)
    const t = this.sceneObject.getTransform()
    t.setLocalPosition(vec3.zero())
    t.setLocalRotation(quat.quatIdentity())
    this.visualObj.getTransform().setLocalRotation(quat.quatIdentity())
  }

  private onBlockReleased(): void {
    if (this._onWheel) return
    const p = this.sceneObject.getTransform().getWorldPosition()
    const w = this.clayAnchor.getTransform().getWorldPosition()
    const dx = p.x - w.x
    const dz = p.z - w.z
    const horiz = Math.sqrt(dx * dx + dz * dz)
    if (horiz <= this.dropRadiusCm && p.y >= w.y - 12.5) {
      this.placeOnWheel()
    } else {
      this.moveToRest()
    }
  }

  // ── Sculpting ───────────────────────────────────────────────────────────────
  /** Drag API (same path the hand uses). Returns the model's result. */
  applyDrag(heightNorm: number, dRadial: number, dVertical: number): DragResult {
    const r = this.model.applyDrag(heightNorm, dRadial, dVertical)
    if (r !== "ignored") {
      this.rebuildAll()
      this._onDragMoved.invoke()
      if (r === "collapsed") this._onCollapsed.invoke()
    }
    return r
  }

  /** Undo the last change. */
  undo(): boolean {
    const ok = this.model.undo()
    if (ok) this.rebuildAll()
    return ok
  }

  private onPinchStart(e: InteractorEvent): void {
    if (!this._onWheel || !this._sculptEnabled || this.model.collapsed) return
    const hit = e.interactor.targetHitPosition
    const local = this.worldToClayLocal(hit ? hit : this.sceneObject.getTransform().getWorldPosition())
    this.strokeHeightNorm = Math.max(0, Math.min(1, local.y / Math.max(0.01, this.model.heightCm)))
    this.activeInteractor = e.interactor

    const cam = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
    const hitW = hit ? hit : this.sceneObject.getTransform().getWorldPosition()
    const toCam = new vec3(cam.x - hitW.x, 0, cam.z - hitW.z)
    this.planeNormal = toCam.length > 0.001 ? toCam.normalize() : vec3.forward()
    this.planeOrigin = hitW
    // Which side of the axis was pinched (screen-right = +1). Front-center defaults to right.
    const axis = this.sceneObject.getTransform().getWorldPosition()
    const right = vec3.up().cross(this.planeNormal).normalize()
    const lateral = hitW.sub(axis).dot(right)
    this.strokeSide = lateral < -1.0 ? -1 : 1
    this.lastPlanePoint = this.planePoint(e.interactor)
    this.model.beginStroke()
    this._onStrokeStart.invoke()
  }

  private onPinchEnd(): void {
    if (!this.activeInteractor) return
    this.activeInteractor = null
    this.lastPlanePoint = null
    this.model.endStroke()
    this._onStrokeEnd.invoke()
  }

  private planePoint(it: Interactor): vec3 | null {
    const o = it.startPoint
    const d = it.direction
    if (!o || !d) return null
    const denom = d.dot(this.planeNormal)
    if (Math.abs(denom) < 1e-4) return null
    const t = this.planeOrigin.sub(o).dot(this.planeNormal) / denom
    if (t < 0) return null
    return o.add(d.uniformScale(t))
  }

  private onHover(e: InteractorEvent): void {
    if (!this._onWheel) return
    const hit = e.interactor.targetHitPosition
    if (!hit) return
    const local = this.worldToClayLocal(hit)
    this.hoverHeightNorm = Math.max(0, Math.min(1, local.y / Math.max(0.01, this.model.heightCm)))
  }

  private worldToClayLocal(p: vec3): vec3 {
    const inv = this.sceneObject.getTransform().getInvertedWorldTransform()
    return inv.multiplyPoint(p)
  }

  // ── Presentation (after Done): the finished piece rises off the wheel and turns ──
  private presentT = -1
  private presentYaw = 0
  private poofT = -1
  private _presentLiftCm = 0

  /** How high the finished piece floats above the wheel during results (cm). */
  presentLiftTargetCm = 10

  get isPresenting(): boolean { return this.presentT >= 0 }
  get presentLiftCm(): number { return this._presentLiftCm }
  get isPieceVisible(): boolean { return !!this.visualObj && this.visualObj.enabled }

  /** Lift the finished piece off the wheel and turn it slowly (results). */
  startPresentation(): void {
    this.setSculptEnabled(false)
    this.presentT = 0
    this.poofT = -1
    this.presentYaw = this.wheel ? this.wheel.angleRad : 0
  }

  /** Shrink the piece away with a little pop (collect → clean the wheel). */
  poofAway(): void {
    if (this.presentT < 0) this.presentT = 0
    this.poofT = 0
  }

  /** World position of the piece's middle (for sparkles). */
  getPieceCenterWorld(): vec3 {
    const p = this.sceneObject.getTransform().getWorldPosition()
    return new vec3(p.x, p.y + this._presentLiftCm + this.model.heightCm * 0.5, p.z)
  }

  private endPresentation(): void {
    this.presentT = -1
    this.poofT = -1
    this._presentLiftCm = 0
    if (this.visualObj) {
      this.visualObj.enabled = true
      this.visualObj.getTransform().setLocalScale(vec3.one())
      this.visualObj.getTransform().setLocalPosition(vec3.zero())
    }
  }

  private updatePresentation(dt: number): void {
    if (this.presentT < 0) return
    this.presentT += dt
    const x = Math.min(1, this.presentT / 1.2)
    const ease = 1 - Math.pow(1 - x, 3)
    const bob = x >= 1 ? Math.sin((this.presentT - 1.2) * 2.2) * 0.6 : 0
    this._presentLiftCm = this.presentLiftTargetCm * ease + bob
    this.presentYaw += dt * 0.9
    const vt = this.visualObj.getTransform()
    vt.setLocalPosition(new vec3(0, this._presentLiftCm, 0))
    vt.setLocalRotation(quat.angleAxis(this.presentYaw, vec3.up()))
    if (this.poofT >= 0) {
      this.poofT += dt
      const k = Math.min(1, this.poofT / 0.45)
      const s = k < 0.25 ? 1 + 0.15 * (k / 0.25) : Math.max(0.001, 1.15 * (1 - (k - 0.25) / 0.75))
      vt.setLocalScale(new vec3(s, s, s))
      if (k >= 1) this.visualObj.enabled = false
    }
  }

  private onUpdate(): void {
    if (this.drop && !this._onWheel) this.drop.update(getDeltaTime())
    else if (this.drop && this.drop.isGlowing) this.drop.update(getDeltaTime())
    this.updatePresentation(getDeltaTime())
    // Spin the visual with the wheel head.
    if (this._onWheel && this.wheel && this.presentT < 0) {
      this.visualObj.getTransform().setLocalRotation(quat.angleAxis(this.wheel.angleRad, vec3.up()))
    }

    // Continuous sculpting while pinched: the clay deforms every frame, not on release.
    if (this.activeInteractor) {
      if (!this.activeInteractor.isTriggering) {
        this.onPinchEnd()
      } else {
        const p = this.planePoint(this.activeInteractor)
        if (p && this.lastPlanePoint) {
          const delta = p.sub(this.lastPlanePoint)
          const right = vec3.up().cross(this.planeNormal).normalize()
          const dLat = delta.dot(right)
          const dVert = delta.y
          if (Math.abs(dLat) > 0.01 || Math.abs(dVert) > 0.01) {
            this.applyDrag(this.strokeHeightNorm, dLat * this.strokeSide, dVert)
          }
        }
        if (p) this.lastPlanePoint = p
      }
    }

    // Pinch ring: at the pinched height (bright) or the aimed height (soft).
    if (this._onWheel && this.activeInteractor && !this.model.collapsed) {
      this.setRing(true, this.strokeHeightNorm, true)
    } else if (this._onWheel && this._sculptEnabled && this.presentT < 0 && this.hoverHeightNorm >= 0 && !this.model.collapsed) {
      this.setRing(true, this.hoverHeightNorm, false)
    } else {
      this.setRing(false, 0, false)
    }
  }

  /** Show the ring at a normalized clay height (public so tests can drive it). */
  setRing(visible: boolean, heightNorm: number, bright: boolean): void {
    this._ringVisible = visible
    this._ringBright = bright
    if (!this.pinchRingObject) return
    this.pinchRingObject.enabled = visible
    if (!visible) return
    const h = Math.max(0, Math.min(1, heightNorm)) * this.model.heightCm
    this._ringHeightCm = h
    const r = this.model.radiusAt(h) + 0.9
    if (Math.abs(r - this.lastRingRadius) > 0.05) {
      clearBuilder(this.ringBuilder)
      appendTorus(this.ringBuilder, r, 0.32, 56, 8)
      this.ringBuilder.updateMesh()
      this.ringRmv.mesh = this.ringBuilder.getMesh()
      this.lastRingRadius = r
    }
    const clayPos = this.sceneObject.getTransform().getWorldPosition()
    this.pinchRingObject.getTransform().setWorldPosition(new vec3(clayPos.x, clayPos.y + h, clayPos.z))
    const k = bright ? this.ringPinchBoost : 1
    const c = this.ringColor
    this.ringMat.mainPass.baseColor = new vec4(Math.min(1, c.x * k), Math.min(1, c.y * k), Math.min(1, c.z * k), Math.min(1, c.w * k))
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  private rebuildAll(): void {
    this.rebuildMesh()
    this.updateCollider()
    this.lastRingRadius = -1
    this._onShapeChanged.invoke()
  }

  private rebuildMesh(): void {
    const n = this.model.radii.length
    const prof: [number, number][] = []
    for (let i = 0; i < n; i++) prof.push([this.model.radii[i], (this.model.heightCm * i) / (n - 1)])
    clearBuilder(this.builder)
    // Subtle throwing-ridge wobble so the spin reads; flat for a collapsed blob.
    const amp = this.model.collapsed ? 0.03 : 0.012
    appendRevolved(this.builder, profileWithNormals(prof), 40, true, vec3.zero(), (th, j) => 1 + amp * Math.sin(3 * th + j * 0.45))
    this.builder.updateMesh()
  }

  private updateCollider(): void {
    if (!this.collider) return
    const r = this.model.maxRadius()
    const h = this.model.heightCm
    const box = Shape.createBoxShape()
    box.size = new vec3(r * 2 + 1, h + 1, r * 2 + 1)
    this.collider.shape = box
    this.hitObj.getTransform().setLocalPosition(new vec3(0, h / 2, 0))
  }
}
