/**
 * ClayMirrorAudioUI — sound settings box shown with the bench placement controls (settings/gear).
 *
 * Passive view (UIKit): one card with two round toggle buttons — Music on/off and Sound effects
 * on/off. Each shows its state with the icon (note / note-off, speaker / speaker-off), a ring
 * (green = on, grey = off) and a caption. Reports intent; ClayMirrorMain applies it to audio.
 * API: setVisible(b), setState(musicOn, sfxOn), pressMusic(), pressSfx()
 * Events: onMusicToggle(bool), onSfxToggle(bool)
 */
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {addImage, addText, card, flexChild, iconButton, makeFlex, obj} from "./ClayMirrorUIHelpers"

const ICON_MUSIC_ON: Texture = requireAsset("../Icons/music_note.png") as Texture
const ICON_MUSIC_OFF: Texture = requireAsset("../Icons/music_off.png") as Texture
const ICON_SFX_ON: Texture = requireAsset("../Icons/volume_up.png") as Texture
const ICON_SFX_OFF: Texture = requireAsset("../Icons/volume_off.png") as Texture
const RING: Texture = requireAsset("../Icons/radio_button_unchecked_fill0_wght300.png") as Texture
const ON = new vec4(0.45, 1.0, 0.55, 1)
const OFF = new vec4(0.6, 0.6, 0.62, 1)

interface Toggle {
  button: Button
  ring: Image
  icon: Image
  label: Text
}

@component
export class ClayMirrorAudioUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorAudioUI – Music / Sound effects toggles (settings)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Toggle button size (cm)")
  @widget(new SliderWidget(4, 10, 0.5))
  buttonSizeCm: number = 5.5

  @input
  @hint("Viewing distance used to scale text (cm)")
  @widget(new SliderWidget(40, 120, 1))
  textDistanceCm: number = 80
  @ui.group_end

  private _onMusic = new Event<boolean>()
  private _onSfx = new Event<boolean>()
  private music: Toggle
  private sfx: Toggle
  private _musicOn = true
  private _sfxOn = true
  private wantVisible = false
  private ready = false

  get onMusicToggle(): PublicApi<boolean> { return this._onMusic.publicApi() }
  get onSfxToggle(): PublicApi<boolean> { return this._onSfx.publicApi() }
  get isVisible(): boolean { return this.wantVisible }
  get musicOn(): boolean { return this._musicOn }
  get sfxOn(): boolean { return this._sfxOn }
  get musicLabel(): string { return this.music ? this.music.label.text : "" }
  get sfxLabel(): string { return this.sfx ? this.sfx.label.text : "" }
  get musicButtonObject(): SceneObject { return this.music ? this.music.button.sceneObject : null }
  get sfxButtonObject(): SceneObject { return this.sfx ? this.sfx.button.sceneObject : null }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const s = this.buttonSizeCm
    const cellW = s * 1.2 + 6
    const W = cellW * 2 + 3
    const H = s * 1.2 + 6.5
    card(this.sceneObject, "SoundCard", W, H, (content) => {
      const col = makeFlex(content, FlexDirection.Column, W, H, FlexJustify.Center, FlexAlign.Center, 0.3, 0.6)
      flexChild(col, W - 2, 2.2, (t) => addText(t, "Sound", "Callout", W - 2, new vec4(1, 1, 1, 1), this.textDistanceCm, 2.2), "Title")
      const row = makeFlex(col, FlexDirection.Row, W - 1, s * 1.2 + 3.2, FlexJustify.SpaceEvenly, FlexAlign.Center, 0.5)
      this.music = this.makeToggle(row, "Music", cellW, () => this.pressMusic())
      this.sfx = this.makeToggle(row, "Effects", cellW, () => this.pressSfx())
    })
    this.createEvent("UpdateEvent").bind(() => {
      if (!this.ready) {
        this.ready = true
        this.sceneObject.enabled = this.wantVisible
        this.render()
      }
    })
  }

  private makeToggle(row: SceneObject, name: string, cellW: number, onClick: () => void): Toggle {
    const s = this.buttonSizeCm
    let t: Toggle
    flexChild(row, cellW, s * 1.2 + 3.2, (cell) => {
      const col = makeFlex(cell, FlexDirection.Column, cellW, s * 1.2 + 3.2, FlexJustify.Center, FlexAlign.Center, 0.3)
      let button: Button
      let ring: Image
      let icon: Image
      let label: Text
      flexChild(col, s * 1.2, s * 1.2, (b) => {
        const host = obj(b, name + "Button")
        button = iconButton(host, null, s, onClick, {theme: "SnapOS2", shape: "Round", style: "PrimaryNeutral"})
        ring = addImage(host, RING, s * 1.18)
        ring.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0.3))
        icon = addImage(host, ICON_MUSIC_ON, s * 0.62)
        icon.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0.7))
      })
      flexChild(col, cellW, 2.2, (tx) => {
        label = addText(tx, name, "Callout", cellW, new vec4(1, 1, 1, 1), this.textDistanceCm, 2.2)
      })
      t = {button: button!, ring: ring!, icon: icon!, label: label!}
    }, name)
    return t!
  }

  setVisible(on: boolean): void {
    this.wantVisible = on
    if (this.ready) this.sceneObject.enabled = on
  }

  setState(musicOn: boolean, sfxOn: boolean): void {
    this._musicOn = musicOn
    this._sfxOn = sfxOn
    this.render()
  }

  /** Same as pinching the Music toggle. */
  pressMusic(): void {
    this._musicOn = !this._musicOn
    this.render()
    this._onMusic.invoke(this._musicOn)
  }

  /** Same as pinching the Sound effects toggle. */
  pressSfx(): void {
    this._sfxOn = !this._sfxOn
    this.render()
    this._onSfx.invoke(this._sfxOn)
  }

  private render(): void {
    if (!this.music || !this.sfx) return
    this.paint(this.music, this._musicOn, ICON_MUSIC_ON, ICON_MUSIC_OFF, "Music")
    this.paint(this.sfx, this._sfxOn, ICON_SFX_ON, ICON_SFX_OFF, "Effects")
  }

  private paint(t: Toggle, on: boolean, iconOn: Texture, iconOff: Texture, name: string): void {
    t.icon.mainMaterial.mainPass.baseTex = on ? iconOn : iconOff
    t.ring.mainMaterial.mainPass.baseColor = on ? ON : OFF
    t.label.text = `${name}: ${on ? "On" : "Off"}`
  }
}
