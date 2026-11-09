/**
 * ClayMirrorGearUI — the settings (gear) button on the bench's back-right corner.
 *
 * Passive view (UIKit): one BackPlate card with a captioned gear Button.
 * API: setVisible(b), pressGear() · Event: onGear.
 */
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {captionedIconButton, card} from "./ClayMirrorUIHelpers"

const ICON_GEAR: Texture = requireAsset("../Icons/settings.png") as Texture

@component
export class ClayMirrorGearUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorGearUI – back to bench placement</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Gear button size (cm)")
  @widget(new SliderWidget(4, 10, 0.5))
  buttonSizeCm: number = 6

  @input
  @hint("Caption under the gear")
  caption: string = "Move bench"

  @input
  @hint("Viewing distance used to scale text (cm)")
  @widget(new SliderWidget(40, 140, 1))
  textDistanceCm: number = 95

  @input("vec4", "{1,1,1,1}")
  @hint("Text color")
  @widget(new ColorWidget())
  textColor: vec4
  @ui.group_end

  private _onGear = new Event<void>()
  private button: Button
  private wantVisible = false
  private ready = false

  get onGear(): PublicApi<void> { return this._onGear.publicApi() }
  get isVisible(): boolean { return this.wantVisible }
  get gearButtonObject(): SceneObject { return this.button ? this.button.sceneObject : null }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const s = this.buttonSizeCm
    card(this.sceneObject, "GearCard", s + 6, s + 6, (content) => {
      this.button = captionedIconButton(content, "Gear", ICON_GEAR, this.caption, s, this.textColor, this.textDistanceCm, () => this._onGear.invoke()).button
    })
    this.createEvent("UpdateEvent").bind(() => {
      if (!this.ready) {
        this.ready = true
        this.sceneObject.enabled = this.wantVisible
      }
    })
  }

  setVisible(on: boolean): void {
    this.wantVisible = on
    if (this.ready) this.sceneObject.enabled = on
  }

  pressGear(): void {
    this._onGear.invoke()
  }
}
