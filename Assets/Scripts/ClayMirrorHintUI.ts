/**
 * ClayMirrorHintUI — first-time hint bubble: white text in a light-green neon surround, bobbing.
 *
 * Passive view (UIKit RoundedRectangle visual + Text): ClayMirrorMain decides which
 * hint shows and where (it moves this object above the thing the hint is about).
 * API: show(id, text), hide(), isVisible, currentHintId, currentText.
 */
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {applyTextRole, obj} from "./ClayMirrorUIHelpers"

@component
export class ClayMirrorHintUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorHintUI – bobbing FTUE hint bubble</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Bubble width (cm)")
  @widget(new SliderWidget(10, 50, 0.5))
  widthCm: number = 30

  @input
  @hint("Bubble height (cm)")
  @widget(new SliderWidget(3, 15, 0.5))
  heightCm: number = 6

  @input("vec4", "{1,1,1,1}")
  @hint("Hint text color")
  @widget(new ColorWidget())
  textColor: vec4

  @input("vec4", "{0.55,1.0,0.6,1}")
  @hint("Neon border color")
  @widget(new ColorWidget())
  borderColor: vec4

  @input("vec4", "{0.10,0.35,0.18,0.55}")
  @hint("Bubble fill color (subtle on the additive display)")
  @widget(new ColorWidget())
  fillColor: vec4

  @input
  @hint("Bob amplitude (cm)")
  @widget(new SliderWidget(0, 3, 0.1))
  bobAmplitudeCm: number = 0.8

  @input
  @hint("Bob speed (cycles per second)")
  @widget(new SliderWidget(0.1, 2, 0.05))
  bobSpeedHz: number = 0.5

  @input
  @hint("Viewing distance used to scale text (cm)")
  @widget(new SliderWidget(40, 140, 1))
  textDistanceCm: number = 85
  @ui.group_end

  private bob: SceneObject
  private text: Text
  private _visible = false
  private _id = ""
  private ready = false
  private t0 = 0

  get isVisible(): boolean { return this._visible }
  get currentHintId(): string { return this._visible ? this._id : "" }
  get currentText(): string { return this.text ? this.text.text : "" }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())
    this.bob = obj(this.sceneObject, "Bob")

    const plateSO = obj(this.bob, "NeonBubble")
    const rr = plateSO.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rr.cornerRadius = 1.4
    rr.initialize()
    rr.size = new vec2(this.widthCm, this.heightCm)
    rr.backgroundColor = this.fillColor
    rr.border = true
    rr.borderSize = 0.35
    rr.borderSoftness = 0.6
    rr.borderColor = this.borderColor

    const textSO = obj(this.bob, "HintText", new vec3(0, 0, 0.3))
    this.text = textSO.createComponent("Component.Text") as Text
    this.text.depthTest = true
    applyTextRole(this.text, "Subheadline", this.textDistanceCm)
    this.text.horizontalAlignment = HorizontalAlignment.Center
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Wrap
    this.text.verticalOverflow = VerticalOverflow.Overflow
    this.text.layoutRect = Rect.create(-this.widthCm / 2 + 1.2, this.widthCm / 2 - 1.2, -this.heightCm / 2 + 0.6, this.heightCm / 2 - 0.6)
    this.text.textFill.color = this.textColor

    this.createEvent("UpdateEvent").bind(() => {
      if (!this.ready) {
        this.ready = true
        this.sceneObject.enabled = this._visible
      }
      this.t0 += getDeltaTime()
      const y = Math.sin(this.t0 * Math.PI * 2 * this.bobSpeedHz) * this.bobAmplitudeCm
      this.bob.getTransform().setLocalPosition(new vec3(0, y, 0))
    })
  }

  show(id: string, message: string): void {
    this._id = id
    this._visible = true
    if (this.text) this.text.text = message
    if (this.ready) this.sceneObject.enabled = true
  }

  hide(): void {
    this._visible = false
    if (this.ready) this.sceneObject.enabled = false
  }
}
