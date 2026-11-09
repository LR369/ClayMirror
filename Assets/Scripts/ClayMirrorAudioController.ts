/**
 * ClayMirrorAudioController — all Clay Mirror sound, emitted from the wheel.
 *
 * Owns: spatial AudioComponents on the wheel (hum loop, clay squish, collapse
 * splat, Done chime, button click) and a non-spatial background-music bed.
 * Must not: decide WHEN sounds play — ClayMirrorMain calls these methods.
 */
const HUM = requireAsset("../GeneratedSFX/WheelHum.wav") as AudioTrackAsset
const SQUISH = requireAsset("../GeneratedSFX/ClaySquish.wav") as AudioTrackAsset
const SPLAT = requireAsset("../GeneratedSFX/ClaySplat.wav") as AudioTrackAsset
const CHIME = requireAsset("../GeneratedSFX/DoneChime.wav") as AudioTrackAsset
const CLICK = requireAsset("../GeneratedSFX/ButtonClick.wav") as AudioTrackAsset
const MUSIC = requireAsset("../GeneratedSFX/BackgroundMusic.wav") as AudioTrackAsset
const DROP = requireAsset("../GeneratedSFX/DropThud.wav") as AudioTrackAsset
const DING = requireAsset("../GeneratedSFX/ReadyDing.wav") as AudioTrackAsset

@component
export class ClayMirrorAudioController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorAudioController – spatial wheel sounds + music bed</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Wheel hum loudness while spinning")
  @widget(new SliderWidget(0, 1, 0.05))
  humVolume: number = 0.45

  @input
  @hint("Clay squish loudness while dragging")
  @widget(new SliderWidget(0, 1, 0.05))
  squishVolume: number = 0.8

  @input
  @hint("Collapse splat loudness")
  @widget(new SliderWidget(0, 1, 0.05))
  splatVolume: number = 0.9

  @input
  @hint("Done chime loudness")
  @widget(new SliderWidget(0, 1, 0.05))
  chimeVolume: number = 0.8

  @input
  @hint("Button click loudness")
  @widget(new SliderWidget(0, 1, 0.05))
  clickVolume: number = 0.6

  @input
  @hint("Background music loudness (0 = off)")
  @widget(new SliderWidget(0, 1, 0.05))
  musicVolume: number = 0.25
  @ui.group_end

  private hum: AudioComponent
  private squish: AudioComponent
  private splat: AudioComponent
  private chime: AudioComponent
  private click: AudioComponent
  private tick: AudioComponent
  private drop: AudioComponent
  private ding: AudioComponent
  private music: AudioComponent
  private lastSquishTime = -10
  private _sfxOn = true
  private _musicOn = true
  private humWanted = false

  /** Count of squish plays — handy for tests asserting "dragging plays a squish". */
  squishPlayCount = 0
  /** Count of drop-in thuds played (tests). */
  dropPlayCount = 0

  get sfxEnabled(): boolean { return this._sfxOn }
  get musicEnabled(): boolean { return this._musicOn }
  get isMusicPlaying(): boolean { return !!this.music && this.music.isPlaying() }

  onAwake(): void {
    this.hum = this.makeSource("Hum", HUM, this.humVolume, true, false)
    this.squish = this.makeSource("Squish", SQUISH, this.squishVolume, true, true)
    this.splat = this.makeSource("Splat", SPLAT, this.splatVolume, true, true)
    this.chime = this.makeSource("Chime", CHIME, this.chimeVolume, true, true)
    this.click = this.makeSource("Click", CLICK, this.clickVolume, true, true)
    this.tick = this.makeSource("Tick", CLICK, this.clickVolume * 0.4, true, true)
    this.drop = this.makeSource("Drop", DROP, this.clickVolume * 1.3, true, true)
    this.ding = this.makeSource("Ding", DING, this.chimeVolume * 0.8, true, true)
    this.music = this.makeSource("Music", MUSIC, this.musicVolume, false, false)
    this._musicOn = this.musicVolume > 0
    if (this._musicOn) this.music.play(-1)
  }

  private makeSource(name: string, track: AudioTrackAsset, volume: number, spatial: boolean, lowLatency: boolean): AudioComponent {
    const so = global.scene.createSceneObject("Audio_" + name)
    so.setParent(this.sceneObject)
    const a = so.createComponent("Component.AudioComponent") as AudioComponent
    a.audioTrack = track
    a.volume = volume
    a.playbackMode = lowLatency ? Audio.PlaybackMode.LowLatency : Audio.PlaybackMode.LowPower
    if (spatial) {
      a.spatialAudio.enabled = true
      a.spatialAudio.positionEffect.enabled = true
      a.spatialAudio.distanceEffect.enabled = true
    }
    return a
  }

  /** Settings: background music on/off. */
  setMusicEnabled(on: boolean): void {
    this._musicOn = on
    if (!this.music) return
    if (on && !this.music.isPlaying()) {
      if (this.music.volume <= 0) this.music.volume = 0.25
      this.music.play(-1)
    }
    if (!on && this.music.isPlaying()) this.music.stop(true)
  }

  /** Settings: sound effects on/off (wheel hum, squish, clicks, chimes...). */
  setSfxEnabled(on: boolean): void {
    this._sfxOn = on
    if (!this.hum) return
    if (!on && this.hum.isPlaying()) this.hum.stop(true)
    if (on && this.humWanted && !this.hum.isPlaying()) this.hum.play(-1)
  }

  private fx(a: AudioComponent): void {
    if (!this._sfxOn || !a) return
    a.stop(false)
    a.play(1)
  }

  /** Start/stop the looping wheel hum. */
  setHum(on: boolean): void {
    this.humWanted = on
    if (!this.hum) return
    if (on && this._sfxOn && !this.hum.isPlaying()) this.hum.play(-1)
    if (!on && this.hum.isPlaying()) this.hum.stop(true)
  }

  get isHumPlaying(): boolean {
    return !!this.hum && this.hum.isPlaying()
  }

  /** Wet clay squish while dragging (re-triggered, throttled). */
  playSquish(): void {
    const t = getTime()
    if (t - this.lastSquishTime < 0.28) return
    this.lastSquishTime = t
    this.squishPlayCount++
    this.fx(this.squish)
  }

  playSplat(): void {
    this.fx(this.splat)
  }

  playChime(): void {
    this.fx(this.chime)
  }

  /** Clicks are UI feedback for pinches: always on, even with sound effects muted, so the toggle itself answers. */
  playClick(): void {
    if (this.click) this.click.play(1)
  }

  /** Soft tick while the results score counts up. */
  playTick(): void {
    this.fx(this.tick)
  }

  /** Something lands on the bench (clay block / new target piece). */
  playDrop(): void {
    this.dropPlayCount++
    this.fx(this.drop)
  }

  /** Bright "ready" ding after a drop-in. */
  playDing(): void {
    this.fx(this.ding)
  }

  /** Grade reveal: chime for a good grade, the sloppy splat for "not good enough". */
  playGrade(good: boolean): void {
    this.fx(good ? this.chime : this.splat)
  }
}
