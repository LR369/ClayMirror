/**
 * ClayMirrorSpongeStation — water bucket hanging on a hook off the bench's front edge, a
 * grabbable sponge, and the clay smear left on the wheel after a piece is collected.
 *
 * Owns: hook + bucket + water + sponge geometry (code-built), the sponge's SIK grab, the
 * wheel smear, and wipe progress (moving the held sponge across the wheel head cleans it).
 * Created at runtime by ClayMirrorMain via init(); everything is parented under the bench so
 * it moves with it.
 * API: init(...), setDirty(on), setWipeActive(on), wipe(cm) (test hook), wipeProgress, isDirty
 * Events: onWipeMoved (rub sound), onWiped (wheel clean).
 * Must not: know about game phases, UI or scoring.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {appendBox, appendLathe, appendTorus, appendTube, makeMeshObject, newBuilder, tintedMaterial} from "./ClayMirrorMeshFactory"

@component
export class ClayMirrorSpongeStation extends BaseScriptComponent {
  /** Bench-local hook position (front face of the bench, left of the controls). */
  hookLocal = new vec3(-34, -3, 30)
  /** Total sponge travel across the wheel needed to clean it (cm). */
  wipeDistanceCm = 60
  /** Wheel-head radius that counts as "on the wheel" (cm). */
  wheelRadiusCm = 16

  private bench: SceneObject
  private clayAnchor: SceneObject
  private sponge: SceneObject
  private spongeRestLocal: vec3
  private interactable: Interactable
  private manipulation: InteractableManipulation
  private smearObj: SceneObject
  private smearMat: Material
  private smearColor: vec4
  private _dirty = false
  private _active = false
  private _progress = 0
  private _held = false
  private lastPos: vec3 | null = null
  private returnT = -1
  private returnFrom = vec3.zero()
  private ready = false

  private _onWipeMoved = new Event<void>()
  private _onWiped = new Event<void>()
  get onWipeMoved(): PublicApi<void> { return this._onWipeMoved.publicApi() }
  get onWiped(): PublicApi<void> { return this._onWiped.publicApi() }

  get isDirty(): boolean { return this._dirty }
  get isWipeActive(): boolean { return this._active }
  get wipeProgress(): number { return this._progress }
  get isHeld(): boolean { return this._held }
  get spongeObject(): SceneObject { return this.sponge }
  /** Hint anchor: just above the sponge on its hook (world). */
  get hintAnchorWorld(): vec3 {
    return this.bench.getTransform().getWorldTransform().multiplyPoint(new vec3(this.hookLocal.x, 10, this.hookLocal.z + 4))
  }

  init(bench: SceneObject, clayAnchor: SceneObject, litMaterial: Material, unlitMaterial: Material, clayColor: vec4): void {
    this.bench = bench
    this.clayAnchor = clayAnchor
    const root = global.scene.createSceneObject("SpongeStation")
    root.setParent(bench)
    const h = this.hookLocal

    // Hook: a plate on the bench's front face with an arm sticking out toward the user.
    const hook = newBuilder()
    appendBox(hook, new vec3(h.x, h.y, h.z + 0.4), new vec3(3, 3, 0.8))
    appendBox(hook, new vec3(h.x, h.y, h.z + 3.5), new vec3(0.8, 0.8, 6))
    appendBox(hook, new vec3(h.x, h.y + 1.2, h.z + 6.2), new vec3(0.8, 2.4, 0.8))
    makeMeshObject(root, "Hook", hook, tintedMaterial(litMaterial, new vec4(0.82, 0.84, 0.88, 1)))

    // Bucket hangs from the hook by its handle.
    const bc = new vec3(h.x, h.y - 18, h.z + 6) // bucket base center
    const bucketH = 12
    const bucket = newBuilder()
    appendLathe(bucket, [[0.01, 0], [5.0, 0], [5.4, 0.4], [6.4, bucketH], [5.9, bucketH], [5.0, 0.8], [0.01, 0.8]], 36, bc)
    makeMeshObject(root, "Bucket", bucket, tintedMaterial(litMaterial, new vec4(0.93, 0.94, 0.97, 1)))
    const rim = newBuilder()
    appendTorus(rim, 6.2, 0.45, 36, 8, new vec3(bc.x, bc.y + bucketH, bc.z))
    appendTorus(rim, 5.3, 0.35, 36, 8, new vec3(bc.x, bc.y + 2, bc.z))
    makeMeshObject(root, "BucketRims", rim, tintedMaterial(litMaterial, new vec4(0.45, 0.62, 1.0, 1)))
    const water = newBuilder()
    appendLathe(water, [[0.01, 0], [5.9, 0], [5.9, 0.2], [0.01, 0.2]], 36, new vec3(bc.x, bc.y + bucketH - 2.2, bc.z))
    makeMeshObject(root, "Water", water, tintedMaterial(litMaterial, new vec4(0.55, 0.85, 1.0, 1)))
    // Handle: a wire arc from rim to rim whose top hangs on the hook arm, with a wooden grip.
    const handle = newBuilder()
    const hc = new vec3(bc.x, bc.y + bucketH, bc.z)
    const hr = h.y + 0.3 - hc.y // arc top sits on the hook arm
    const arc: vec3[] = []
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI
      arc.push(new vec3(hc.x + Math.cos(a) * 6.3, hc.y + Math.sin(a) * hr, hc.z))
    }
    appendTube(handle, arc, 0.22, 8)
    const handleMat = tintedMaterial(litMaterial, new vec4(0.82, 0.84, 0.88, 1))
    handleMat.mainPass.twoSided = true
    makeMeshObject(root, "Handle", handle, handleMat)
    const grip = newBuilder()
    const gripPath: vec3[] = []
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI / 2 + ((i - 4) / 4) * 0.42
      gripPath.push(new vec3(hc.x + Math.cos(a) * 6.3, hc.y + Math.sin(a) * hr, hc.z))
    }
    appendTube(grip, gripPath, 0.6, 10)
    const gripMat = tintedMaterial(litMaterial, new vec4(0.86, 0.66, 0.42, 1))
    gripMat.mainPass.twoSided = true
    makeMeshObject(root, "HandleGrip", grip, gripMat)

    // Sponge: sits in the bucket, poking out of the water.
    this.sponge = global.scene.createSceneObject("Sponge")
    this.sponge.setParent(root)
    this.spongeRestLocal = new vec3(bc.x + 1.2, bc.y + bucketH - 0.6, bc.z - 0.5)
    this.sponge.getTransform().setLocalPosition(this.spongeRestLocal)
    this.sponge.getTransform().setLocalRotation(quat.angleAxis(0.25, vec3.forward()))
    const sb = newBuilder()
    appendBox(sb, vec3.zero(), new vec3(7.5, 3.2, 4.8))
    makeMeshObject(this.sponge, "SpongeMesh", sb, tintedMaterial(litMaterial, new vec4(1.0, 0.9, 0.35, 1)))
    const col = this.sponge.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(9, 5, 7)
    col.shape = shape
    col.fitVisual = false
    this.interactable = this.sponge.createComponent(Interactable.getTypeName()) as Interactable
    this.manipulation = this.sponge.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    this.manipulation.setManipulateRoot(this.sponge.getTransform())
    this.manipulation.setCanRotate(false)
    this.manipulation.setCanScale(false)

    // Smear left on the wheel head after a piece comes off.
    this.smearColor = new vec4(clayColor.x * 0.92, clayColor.y * 0.85, clayColor.z * 0.8, 0.9)
    this.smearMat = tintedMaterial(litMaterial, this.smearColor, "alpha")
    const sm = newBuilder()
    appendLathe(sm, [[3.0, 0], [9.5, 0], [9.5, 0.25], [3.0, 0.25]], 40)
    appendLathe(sm, [[0.01, 0], [2.0, 0], [2.0, 0.3], [0.01, 0.3]], 20)
    this.smearObj = global.scene.createSceneObject("WheelSmear")
    this.smearObj.setParent(clayAnchor)
    this.smearObj.getTransform().setLocalPosition(new vec3(0, 0.12, 0))
    makeMeshObject(this.smearObj, "SmearMesh", sm, this.smearMat)
    this.smearObj.enabled = false

    // Created at runtime (after the scene's OnStart), so bind directly — an OnStartEvent
    // registered now would never fire.
    this.manipulation.onManipulationStart.add(() => {
      this._held = true
      this.returnT = -1
      this.lastPos = null
    })
    this.manipulation.onManipulationEnd.add(() => {
      this._held = false
      this.startReturn()
    })
    this.applyActive()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.ready = true
  }

  /** Leave (or clear) the clay smear on the wheel head. */
  setDirty(on: boolean): void {
    this._dirty = on
    this._progress = on ? 0 : 1
    if (this.smearObj) this.smearObj.enabled = on
    this.updateSmear()
  }

  /** Allow grabbing the sponge (only while there's a wheel to wipe). */
  setWipeActive(on: boolean): void {
    this._active = on
    this.applyActive()
  }

  /** Test hook: wipe as if the held sponge moved `cm` across the wheel head. */
  wipe(cm: number): void {
    if (!this._dirty) return
    this.addWipe(cm)
  }

  private applyActive(): void {
    if (!this.interactable) return
    this.interactable.enabled = this._active
    this.manipulation.enabled = this._active
    this.manipulation.setCanTranslate(this._active)
  }

  private addWipe(cm: number): void {
    if (cm <= 0) return
    this._progress = Math.min(1, this._progress + cm / this.wipeDistanceCm)
    this._onWipeMoved.invoke()
    this.updateSmear()
    if (this._progress >= 1 && this._dirty) {
      this._dirty = false
      this.smearObj.enabled = false
      this._onWiped.invoke()
    }
  }

  private updateSmear(): void {
    if (!this.smearMat) return
    const a = this.smearColor.w * (1 - this._progress)
    this.smearMat.mainPass.baseColor = new vec4(this.smearColor.x, this.smearColor.y, this.smearColor.z, a)
  }

  private startReturn(): void {
    this.returnT = 0
    this.returnFrom = this.sponge.getTransform().getLocalPosition()
  }

  private onUpdate(): void {
    if (!this.ready) return
    const dt = getDeltaTime()
    if (this._held && this._dirty) {
      const p = this.sponge.getTransform().getWorldPosition()
      const local = this.clayAnchor.getTransform().getInvertedWorldTransform().multiplyPoint(p)
      const onWheel = Math.sqrt(local.x * local.x + local.z * local.z) < this.wheelRadiusCm && local.y > -4 && local.y < 12
      if (onWheel && this.lastPos) this.addWipe(p.distance(this.lastPos))
      this.lastPos = onWheel ? p : null
    }
    if (this.returnT >= 0 && !this._held) {
      this.returnT += dt
      const x = Math.min(1, this.returnT / 0.4)
      const e = 1 - Math.pow(1 - x, 3)
      this.sponge.getTransform().setLocalPosition(vec3.lerp(this.returnFrom, this.spongeRestLocal, e))
      if (x >= 1) this.returnT = -1
    }
  }
}
