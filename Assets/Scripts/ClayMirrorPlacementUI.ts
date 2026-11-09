/**
 * ClayMirrorPlacementUI — bench placement controls on the bench's front edge.
 *
 * Passive view (UIKit): a height Slider card on the left and a big Start Button
 * card on the right, laid out by a FlexLayout row. Reports intent via events,
 * renders what ClayMirrorMain pushes in. Holds no game state.
 * API: setVisible(b), setHeightNorm(v), setHeightText(cm), pressStart()
 * Events: onHeightChanged(0..1), onStart.
 */
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {addImage, addText, captionedIconButton, card, flexChild, makeFlex} from "./ClayMirrorUIHelpers"

const ICON_PLAY: Texture = requireAsset("../Icons/play_arrow.png") as Texture
const ICON_HEIGHT: Texture = requireAsset("../Icons/height.png") as Texture

@component
export class ClayMirrorPlacementUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorPlacementUI – height slider + Start (bench front edge)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Total width of the control row along the bench front edge (cm)")
  @widget(new SliderWidget(40, 100, 1))
  rowWidthCm: number = 84

  @input
  @hint("Height slider track length (cm)")
  @widget(new SliderWidget(10, 30, 0.5))
  sliderLengthCm: number = 20

  @input
  @hint("Start button size (cm)")
  @widget(new SliderWidget(5, 12, 0.5))
  startButtonSizeCm: number = 8

  @input
  @hint("Label under the Start button")
  startLabel: string = "Start"

  @input
  @hint("Label above the height slider")
  heightLabel: string = "Table height"

  @input
  @hint("Viewing distance used to scale text (cm)")
  @widget(new SliderWidget(40, 120, 1))
  textDistanceCm: number = 80

  @input("vec4", "{1,1,1,1}")
  @hint("Text color")
  @widget(new ColorWidget())
  textColor: vec4
  @ui.group_end

  private _onHeightChanged = new Event<number>()
  private _onStart = new Event<void>()
  private slider: Slider
  private startButton: Button
  private startButtonObj: SceneObject
  private valueText: Text
  private suppressSlider = false
  private wantVisible = true
  private ready = false

  get onHeightChanged(): PublicApi<number> { return this._onHeightChanged.publicApi() }
  get onStart(): PublicApi<void> { return this._onStart.publicApi() }
  get isVisible(): boolean { return this.wantVisible }
  get startButtonComponent(): Button { return this.startButton }
  /** SceneObject carrying the Start Button (pinch target for tests). */
  get startButtonObject(): SceneObject { return this.startButtonObj }
  get heightSlider(): Slider { return this.slider }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const c = this.textColor
    const d = this.textDistanceCm
    const row = makeFlex(this.sceneObject, FlexDirection.Row, this.rowWidthCm, 14, FlexJustify.SpaceBetween, FlexAlign.Center, 0)

    const leftW = this.sliderLengthCm + 6
    card(row, "HeightCard", leftW, 9, (content) => {
      const col = makeFlex(content, FlexDirection.Column, leftW, 9, FlexJustify.Center, FlexAlign.Center, 1.0)
      flexChild(col, leftW - 2, 3, (labelCell) => {
        const r = makeFlex(labelCell, FlexDirection.Row, leftW - 2, 3, FlexJustify.Center, FlexAlign.Center, 0.6)
        flexChild(r, 2.2, 2.2, (iconSO) => addImage(iconSO, ICON_HEIGHT, 2.2))
        flexChild(r, 10, 2.4, (t) => addText(t, this.heightLabel, "Body", 10, c, d))
        flexChild(r, 6, 2.4, (t) => {
          this.valueText = addText(t, "75 cm", "Callout", 6, c, d)
        })
      })
      flexChild(col, this.sliderLengthCm, 2.4, (s) => {
        this.slider = s.createComponent(Slider.getTypeName()) as Slider
        this.slider.size = new vec3(this.sliderLengthCm, 2.0, 1) // BEFORE init
        this.slider.currentValue = 0.36
        this.slider.onValueChange.add((v: number) => {
          if (!this.suppressSlider) this._onHeightChanged.invoke(v)
        })
      }, "HeightSlider")
    })

    const s = this.startButtonSizeCm
    card(row, "StartCard", s + 4, s + 6, (content) => {
      const r = captionedIconButton(content, "Start", ICON_PLAY, this.startLabel, s, c, d, () => this._onStart.invoke())
      this.startButton = r.button
      this.startButtonObj = r.button.sceneObject
    })

    this.createEvent("UpdateEvent").bind(() => {
      if (!this.ready) {
        this.ready = true
        this.sceneObject.enabled = this.wantVisible
      }
    })
  }

  /** Show/hide the whole placement row. */
  setVisible(on: boolean): void {
    this.wantVisible = on
    if (this.ready) this.sceneObject.enabled = on
  }

  /** Move the slider knob without re-emitting onHeightChanged. */
  setHeightNorm(v: number): void {
    if (!this.slider) return
    this.suppressSlider = true
    this.slider.currentValue = Math.max(0, Math.min(1, v))
    this.suppressSlider = false
  }

  setHeightText(cm: number): void {
    if (this.valueText) this.valueText.text = `${Math.round(cm)} cm`
  }

  /** Same as pinching Start (for tests / scripted flows). */
  pressStart(): void {
    this._onStart.invoke()
  }
}
