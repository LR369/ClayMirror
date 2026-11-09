/**
 * ClayMirrorControlsUI — Start Over, Undo and Done (thumbs up), just in front of the wheel.
 *
 * Passive view (UIKit): a compact row of bright, round, icon-only Buttons (no dark card,
 * no captions — the display is additive, so dark plates disappear). Start Over sits a
 * little apart from Done. Reports intent only.
 * API: setMode("hidden" | "play" | "startOverOnly"), pressUndo(), pressDone(), pressStartOver()
 * Events: onUndo, onDone, onStartOver.
 */
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {flexChild, makeFlex, obj, ringIconButton} from "./ClayMirrorUIHelpers"

const ICON_UNDO: Texture = requireAsset("../Icons/undo.png") as Texture
const ICON_DONE: Texture = requireAsset("../Icons/thumb_up.png") as Texture
const ICON_RESTART: Texture = requireAsset("../Icons/restart_alt.png") as Texture

export type ControlsMode = "hidden" | "play" | "startOverOnly"

@component
export class ClayMirrorControlsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorControlsUI – Start Over / Undo / Done (icon row in front of the wheel)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Button size (cm)")
  @widget(new SliderWidget(4, 10, 0.5))
  buttonSizeCm: number = 5.5

  @input
  @hint("Extra gap that keeps Start Over apart from Done (cm)")
  @widget(new SliderWidget(0, 8, 0.5))
  startOverGapCm: number = 3

  @input("vec4", "{1,1,1,1}")
  @hint("Ring color for Undo / Start Over (keep light — additive display)")
  @widget(new ColorWidget())
  sideRingColor: vec4

  @input("vec4", "{0.45,1.0,0.55,1}")
  @hint("Ring color for Done (thumbs up)")
  @widget(new ColorWidget())
  doneRingColor: vec4
  @ui.group_end

  private _onUndo = new Event<void>()
  private _onDone = new Event<void>()
  private _onStartOver = new Event<void>()
  private undoCell: SceneObject
  private doneCell: SceneObject
  private undoBtn: Button
  private doneBtn: Button
  private startOverBtn: Button
  private _mode: ControlsMode = "hidden"
  private ready = false

  get onUndo(): PublicApi<void> { return this._onUndo.publicApi() }
  get onDone(): PublicApi<void> { return this._onDone.publicApi() }
  get onStartOver(): PublicApi<void> { return this._onStartOver.publicApi() }
  get mode(): ControlsMode { return this._mode }
  get undoVisible(): boolean { return this._mode === "play" }
  get doneVisible(): boolean { return this._mode === "play" }
  get startOverVisible(): boolean { return this._mode !== "hidden" }
  get undoButtonObject(): SceneObject { return this.undoBtn ? this.undoBtn.sceneObject : null }
  get doneButtonObject(): SceneObject { return this.doneBtn ? this.doneBtn.sceneObject : null }
  get startOverButtonObject(): SceneObject { return this.startOverBtn ? this.startOverBtn.sceneObject : null }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const s = this.buttonSizeCm
    const cell = s * 1.18 + 0.8
    const w = cell * 3 + this.startOverGapCm + 1.2
    const row = makeFlex(this.sceneObject, FlexDirection.Row, w, cell, FlexJustify.Center, FlexAlign.Center, 0.4)
    flexChild(row, cell, cell, (b) => {
      this.startOverBtn = ringIconButton(obj(b, "StartOverButton"), ICON_RESTART, s, this.sideRingColor, () => this._onStartOver.invoke())
    }, "StartOver")
    flexChild(row, this.startOverGapCm, 1, () => {}, "Gap")
    this.undoCell = flexChild(row, cell, cell, (b) => {
      this.undoBtn = ringIconButton(obj(b, "UndoButton"), ICON_UNDO, s, this.sideRingColor, () => this._onUndo.invoke())
    }, "Undo")
    this.doneCell = flexChild(row, cell, cell, (b) => {
      this.doneBtn = ringIconButton(obj(b, "DoneButton"), ICON_DONE, s, this.doneRingColor, () => this._onDone.invoke())
    }, "Done")
    this.createEvent("UpdateEvent").bind(() => {
      if (!this.ready) {
        this.ready = true
        this.apply()
      }
    })
  }

  /** hidden: nothing · play: Start Over + Undo + Done · startOverOnly: before the clay lands. */
  setMode(mode: ControlsMode): void {
    this._mode = mode
    if (this.ready) this.apply()
  }

  pressUndo(): void { this._onUndo.invoke() }
  pressDone(): void { this._onDone.invoke() }
  pressStartOver(): void { this._onStartOver.invoke() }

  private apply(): void {
    this.sceneObject.enabled = this._mode !== "hidden"
    // Hide Undo/Done by disabling their visuals; the cells keep their layout slot.
    for (const c of [this.undoCell, this.doneCell]) {
      for (let i = 0; i < c.getChildrenCount(); i++) c.getChild(i).enabled = this._mode === "play"
    }
  }
}
