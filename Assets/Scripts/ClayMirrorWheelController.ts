/**
 * ClayMirrorWheelController — the potter's wheel (base, spinning head, spin state).
 *
 * Owns: wheel geometry (code-authored MeshBuilder), spin on/off, and the current
 * head angle that the clay visual follows.
 * Expects @inputs: lit material, colors, the authored WheelHead child.
 * Must not: decide when the wheel spins — ClayMirrorMain calls setSpinning().
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {appendBox, appendLathe, appendTorus, makeMeshObject, newBuilder, tintedMaterial} from "./ClayMirrorMeshFactory"

@component
export class ClayMirrorWheelController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorWheelController – potter\'s wheel + spin</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Lit material (PBR) cloned and tinted for the wheel parts")
  litMaterial: Material

  @input
  @hint("Authored child that spins (wheel head). Its local Y is the top of the wheel column.")
  wheelHead: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Wheel head diameter in cm")
  @widget(new SliderWidget(20, 40, 1))
  headDiameterCm: number = 30

  @input
  @hint("Wheel speed in revolutions per minute")
  @widget(new SliderWidget(10, 200, 5))
  spinRpm: number = 90

  @input("vec4", "{0.92,0.92,0.95,1}")
  @hint("Wheel head color")
  @widget(new ColorWidget())
  headColor: vec4

  @input("vec4", "{0.62,0.78,0.86,1}")
  @hint("Wheel body / splash pan color")
  @widget(new ColorWidget())
  bodyColor: vec4

  @input("vec4", "{0.95,0.62,0.45,1}")
  @hint("Color of the marks on the wheel head (makes the spin visible)")
  @widget(new ColorWidget())
  markColor: vec4
  @ui.group_end

  /** Head thickness (cm) — clay sits on top of it. */
  readonly headThicknessCm = 2

  private _spinning = false
  private _angle = 0
  private _onSpinChanged = new Event<boolean>()

  /** Fires with the new spin state whenever it changes. */
  get onSpinChanged(): PublicApi<boolean> {
    return this._onSpinChanged.publicApi()
  }

  /** True while the wheel is turning. */
  get isSpinning(): boolean {
    return this._spinning
  }

  /** Current head angle in radians (clay visual follows this). */
  get angleRad(): number {
    return this._angle
  }

  setSpinning(on: boolean): void {
    if (this._spinning === on) return
    this._spinning = on
    this._onSpinChanged.invoke(on)
  }

  onAwake(): void {
    if (!this.litMaterial || !this.wheelHead) {
      print("ClayMirrorWheelController: required @input not wired (litMaterial / wheelHead).")
      return
    }
    this.buildGeometry()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private buildGeometry(): void {
    const headY = this.wheelHead.getTransform().getLocalPosition().y
    const R = this.headDiameterCm / 2

    // Static body: foot, column, splash-pan ring (on this SceneObject).
    const body = newBuilder()
    appendLathe(body, [[0.01, 0], [11, 0], [11, 1.2], [6, 2.2], [4.2, headY - 0.6], [5, headY]], 32)
    appendTorus(body, R + 2.5, 1.0, 48, 10, new vec3(0, headY - 2.2, 0))
    appendLathe(body, [[R + 1.6, headY - 3.4], [R + 3.4, headY - 3.4], [R + 3.4, headY - 3.0], [R + 1.6, headY - 3.0]], 48)
    makeMeshObject(this.sceneObject, "WheelBody", body, tintedMaterial(this.litMaterial, this.bodyColor))

    // Spinning head + marks (children of the authored WheelHead).
    const head = newBuilder()
    appendLathe(head, [[R - 0.6, 0], [R, 0.5], [R, this.headThicknessCm - 0.4], [R - 0.5, this.headThicknessCm]], 48)
    makeMeshObject(this.wheelHead, "HeadVisual", head, tintedMaterial(this.litMaterial, this.headColor))

    const marks = newBuilder()
    for (let k = 0; k < 3; k++) {
      // radial ribs written as boxes then rotated by angle: approximate with offset boxes per angle
      const a = (k / 3) * Math.PI * 2
      for (let s = 0; s < 4; s++) {
        const rr = R * 0.45 + s * (R * 0.13)
        appendBox(marks, new vec3(rr * Math.cos(a), this.headThicknessCm + 0.08, rr * Math.sin(a)), new vec3(1.6, 0.16, 1.6))
      }
    }
    appendTorus(marks, R * 0.33, 0.25, 40, 6, new vec3(0, this.headThicknessCm + 0.1, 0))
    makeMeshObject(this.wheelHead, "HeadMarks", marks, tintedMaterial(this.litMaterial, this.markColor))
  }

  private onUpdate(): void {
    if (!this._spinning) return
    this._angle = (this._angle + getDeltaTime() * (this.spinRpm / 60) * Math.PI * 2) % (Math.PI * 2)
    this.wheelHead.getTransform().setLocalRotation(quat.angleAxis(this._angle, vec3.up()))
  }
}
