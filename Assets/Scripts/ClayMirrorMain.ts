/**
 * ClayMirrorMain — orchestrator for Clay Mirror (placement → drop → sculpt → Done).
 *
 * Owns: the GameState (phase, skill XP), FTUE hint sequencing, and wiring
 * between the placement step, the game controllers and the passive UI views.
 * Placement is its own step (ClayMirrorPlacementController) that hands off to
 * the game only through Start, so real-table snapping can replace it later.
 * Expects @inputs: every controller + UI module + the four hint anchors.
 * Must not: author UI (UI modules do), build geometry, or hold clay shape state.
 * Length note (>250 lines): most of the file is the Inspector surface (14 refs,
 * hint texts, scoring rules); the logic itself is a flat phase/hint table.
 *
 * Public test API (LEAF): phase, isPlacementMode, isWheelSpinning, isClayOnWheel,
 * clayRadii, clayHeightCm, liveMatchPercent, hintId, hintVisible, lastResult,
 * pressStart(), pressGear(), pressUndo(), pressDone(), pressStartOver(),
 * pressNextVase(), dropClayOnWheel(), applyDrag(heightNorm, dRadial, dVertical).
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {DragResult, matchPercent} from "./ClayMirrorClayModel"
import {ClayMirrorAudioController} from "./ClayMirrorAudioController"
import {ClayMirrorClayController} from "./ClayMirrorClayController"
import {ClayMirrorControlsUI} from "./ClayMirrorControlsUI"
import {ClayMirrorEffects} from "./ClayMirrorEffects"
import {ClayMirrorSpongeStation} from "./ClayMirrorSpongeStation"
import {ClayMirrorProgressSign} from "./ClayMirrorProgressSign"
import {ClayMirrorAudioUI} from "./ClayMirrorAudioUI"
import {DEFAULT_SKILL_CONFIG, GamePhase, GameState, RoundResult} from "./ClayMirrorGameState"
import {ClayMirrorGearUI} from "./ClayMirrorGearUI"
import {ClayMirrorHintUI} from "./ClayMirrorHintUI"
import {ClayMirrorPlacementController} from "./ClayMirrorPlacementController"
import {ClayMirrorPlacementUI} from "./ClayMirrorPlacementUI"
import {ClayMirrorScoreUI} from "./ClayMirrorScoreUI"
import {ClayMirrorTargetController} from "./ClayMirrorTargetController"
import {ClayMirrorWheelController} from "./ClayMirrorWheelController"

type HintId = "" | "placeBench" | "dropClay" | "sculpt" | "matchTarget" | "wipe"

@component
export class ClayMirrorMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorMain – placement → drop → sculpt → Done</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Bench placement step (drag + height)")
  placement: ClayMirrorPlacementController
  @input
  @hint("Potter's wheel")
  wheel: ClayMirrorWheelController
  @input
  @hint("Clay block / sculpting")
  clay: ClayMirrorClayController
  @input
  @hint("Target vase + ghost outline")
  target: ClayMirrorTargetController
  @input
  @hint("Spatial wheel sounds + music")
  audio: ClayMirrorAudioController
  @input
  @hint("Height slider + Start (bench front edge)")
  placementUI: ClayMirrorPlacementUI
  @input
  @hint("Start Over / Undo / Done buttons")
  controlsUI: ClayMirrorControlsUI
  @input
  @hint("Gear button (back to placement)")
  gearUI: ClayMirrorGearUI
  @input
  @hint("Live match % + results above the target")
  scoreUI: ClayMirrorScoreUI
  @input
  @hint("FTUE hint bubble")
  hintUI: ClayMirrorHintUI
  @input
  @hint("Hint position above the bench front edge (placement hint)")
  hintAnchorBench: SceneObject
  @input
  @hint("Hint position above the resting clay block")
  hintAnchorClay: SceneObject
  @input
  @hint("Hint position above the wheel")
  hintAnchorWheel: SceneObject
  @input
  @hint("Hint position above the live match %")
  hintAnchorTarget: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Hint 0 — shown at the very start")
  hintPlaceText: string = "Drag the bench where you want it, set the height, then pinch Start"
  @input
  @hint("Hint 1 — after Start, above the clay")
  hintDropText: string = "Pick up the clay and drop it on the wheel"
  @input
  @hint("Hint 2 — once the clay lands, above the wheel")
  hintSculptText: string = "Pinch and drag the clay to fill the white outline"
  @input
  @hint("Hint 3 — after the first drag, above the target")
  hintMatchText: string = "Match the target: fill the white outline"
  @input
  @hint("Hint after collecting points, above the sponge on its hook (shown every round)")
  hintWipeText: string = "Grab the sponge and wipe the wheel clean"
  @input
  @hint("Seconds the 'Match the target' hint stays up")
  @widget(new SliderWidget(1, 10, 0.5))
  matchHintSeconds: number = 4
  @input
  @hint("Show the live match % while sculpting (off: the score is only revealed after Done)")
  showLivePercent: boolean = false
  @input
  @hint("Show first-time hints")
  showHints: boolean = true
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scoring</span>')
  @ui.group_start("Scoring")
  @input
  @hint("Potter-skill XP needed per level (fills the skill bar once)")
  @widget(new SliderWidget(50, 500, 10))
  xpPerLevel: number = 150
  @input
  @hint("Match % for the 'Master Potter' bonus")
  @widget(new SliderWidget(50, 100, 1))
  masterThreshold: number = 90
  @input
  @hint("XP for the 'Master Potter' bonus")
  @widget(new SliderWidget(0, 200, 5))
  masterXp: number = 50
  @input
  @hint("Match % for the 'Great Match' bonus")
  @widget(new SliderWidget(50, 100, 1))
  greatThreshold: number = 75
  @input
  @hint("XP for the 'Great Match' bonus")
  @widget(new SliderWidget(0, 200, 5))
  greatXp: number = 25
  @input
  @hint("XP for finishing without a collapse ('Steady Hands')")
  @widget(new SliderWidget(0, 100, 5))
  noCollapseXp: number = 15
  @input
  @hint("XP for finishing without Undo ('Clean Throw')")
  @widget(new SliderWidget(0, 100, 5))
  noUndoXp: number = 10
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Wireframe every collider in the scene (takes effect on preview restart)")
  debugColliders: boolean = false
  @ui.group_end

  readonly state = new GameState(Object.assign({}, DEFAULT_SKILL_CONFIG))

  private hintsDone: Record<string, boolean> = {}
  private activeHint: HintId = ""
  private activeAnchor: SceneObject | null = null
  private matchHintTimer = -1
  private _live = 0
  private _effects: ClayMirrorEffects
  private _sponge: ClayMirrorSpongeStation
  private _sign: ClayMirrorProgressSign
  private _audioUI: ClayMirrorAudioUI | null = null
  private hintAnchorSponge: SceneObject
  /** Scores for the current set of 10 items (reset on Play again). */
  private setResults: {name: string; score: number}[] = []

  // ── Public state for tests ─────────────────────────────────────────────────
  get phase(): GamePhase { return this.state.phase }
  get isPlacementMode(): boolean { return this.placement.isPlacementMode }
  get isWheelSpinning(): boolean { return this.wheel.isSpinning }
  get isClayOnWheel(): boolean { return this.clay.isOnWheel }
  get clayRadii(): number[] { return this.clay.getRadii() }
  get clayHeightCm(): number { return this.clay.heightCm }
  get liveMatchPercent(): number { return this._live }
  get hintId(): string { return this.activeHint }
  get hintVisible(): boolean { return this.hintUI.isVisible }
  get lastResult(): RoundResult | null { return this.state.lastResult }
  /** 0-based index of the current item (0 = Mug ... 9 = Urn). */
  get itemIndex(): number { return this.target.targetIndex }
  get itemName(): string { return this.target.currentTarget.name }
  get isWheelDirty(): boolean { return this._sponge ? this._sponge.isDirty : false }
  get sponge(): ClayMirrorSpongeStation { return this._sponge }
  get effects(): ClayMirrorEffects { return this._effects }
  get progressSign(): ClayMirrorProgressSign { return this._sign }
  /** Sound settings box (Music / Effects toggles), shown with the placement controls. */
  get audioUI(): ClayMirrorAudioUI | null { return this._audioUI }
  /** Scores banked in the current set of 10. */
  get setScores(): number[] { return this.setResults.map((r) => r.score) }

  onAwake(): void {
    const missing = [
      ["placement", this.placement], ["wheel", this.wheel], ["clay", this.clay], ["target", this.target],
      ["audio", this.audio], ["placementUI", this.placementUI], ["controlsUI", this.controlsUI],
      ["gearUI", this.gearUI], ["scoreUI", this.scoreUI], ["hintUI", this.hintUI],
      ["hintAnchorBench", this.hintAnchorBench], ["hintAnchorClay", this.hintAnchorClay],
      ["hintAnchorWheel", this.hintAnchorWheel], ["hintAnchorTarget", this.hintAnchorTarget],
    ].filter((p) => !p[1]).map((p) => p[0])
    if (missing.length > 0) {
      print("ClayMirrorMain: required @input not wired: " + missing.join(", "))
      return
    }
    const sc = this.state.config
    sc.xpPerLevel = this.xpPerLevel
    sc.masterThreshold = this.masterThreshold
    sc.masterXp = this.masterXp
    sc.greatThreshold = this.greatThreshold
    sc.greatXp = this.greatXp
    sc.noCollapseXp = this.noCollapseXp
    sc.noUndoXp = this.noUndoXp
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    this.ensureAudioListener()
    if (this.debugColliders) this.setColliderDebugAll(this.getSceneObject(), true)

    // UI → intent
    this.placementUI.onHeightChanged.add((v) => this.onHeightSlider(v))
    this.placementUI.onStart.add(() => this.pressStart())
    this.controlsUI.onUndo.add(() => this.pressUndo())
    this.controlsUI.onDone.add(() => this.pressDone())
    this.controlsUI.onStartOver.add(() => this.pressStartOver())
    this.gearUI.onGear.add(() => this.pressGear())
    this.scoreUI.onCountTick.add(() => this.audio.playTick())
    this.scoreUI.onGradeRevealed.add((g) => this.onGradeRevealed(g.good))
    this.scoreUI.onBonusRevealed.add(() => this.audio.playClick())
    this.scoreUI.onCollect.add(() => this.onCollect())
    this.scoreUI.onCollected.add(() => this.startWipe())

    // Runtime-built extras: sparkles + the sponge station (hook, bucket, sponge, wheel smear).
    const bench = this.placement.getSceneObject()
    this._effects = this.getSceneObject().createComponent(ClayMirrorEffects.getTypeName()) as ClayMirrorEffects
    this._effects.init(bench, this.clay.unlitMaterial)
    this._sponge = this.getSceneObject().createComponent(ClayMirrorSpongeStation.getTypeName()) as ClayMirrorSpongeStation
    this._sponge.init(bench, this.clay.clayAnchor, this.clay.litMaterial, this.clay.unlitMaterial, this.clay.clayColor)
    this._sponge.onWipeMoved.add(() => {
      this.audio.playSquish()
      // Suds froth up under the sponge, on the wheel head.
      const sp = this._sponge.spongeObject.getTransform().getWorldPosition()
      const head = this.clay.clayAnchor.getTransform().getWorldPosition()
      this._effects.suds(new vec3(sp.x, Math.max(head.y + 0.3, sp.y - 1.6), sp.z), 4.5)
    })
    this._sponge.onWiped.add(() => this.finishWipe())
    this.hintAnchorSponge = global.scene.createSceneObject("HintAnchor_Sponge")
    this.hintAnchorSponge.setParent(this.hintAnchorBench.getParent())
    const hk = this._sponge.hookLocal
    this.hintAnchorSponge.getTransform().setLocalPosition(new vec3(hk.x, 12, hk.z + 4))
    this._sign = this.getSceneObject().createComponent(ClayMirrorProgressSign.getTypeName()) as ClayMirrorProgressSign
    this._sign.init(bench, this.clay.litMaterial, this.clay.unlitMaterial)
    this.scoreUI.buildBoardFrame(this.clay.litMaterial, this.clay.unlitMaterial)
    this.scoreUI.onPlayAgain.add(() => this.pressPlayAgain())
    this.layoutForTarget()

    // Controllers → reactions
    this.wheel.onSpinChanged.add((on) => this.audio.setHum(on))
    this.clay.onLanded.add(() => this.onClayLanded())
    this.clay.onStrokeStart.add(() => this.onStrokeStart())
    this.clay.onStrokeEnd.add(() => this.onStrokeEnd())
    this.clay.onDragMoved.add(() => this.audio.playSquish())
    this.clay.onCollapsed.add(() => this.audio.playSplat())
    this.clay.onShapeChanged.add(() => this.refreshLive())

    // Drop-ins: thud on landing, green sparkles; the clay's landing also rings the "ready" ding.
    this.target.onDropLanded.add(() => {
      this.audio.playDrop()
      this._effects.burst(this.target.targetVase.getTransform().getWorldPosition(), 10, 5, true)
    })
    this.clay.onDropLanded.add(() => {
      this.audio.playDrop()
      this.audio.playDing()
      this._effects.burst(this.clay.getPieceCenterWorld(), 10, 4, true)
    })

    // Sound settings box lives next to the placement controls (found by name under UI).
    const uiRoot = this.placementUI.getSceneObject().getParent()
    for (let i = 0; uiRoot && i < uiRoot.getChildrenCount(); i++) {
      const c = uiRoot.getChild(i)
      const a = c.getComponent(ClayMirrorAudioUI.getTypeName()) as ClayMirrorAudioUI
      if (a) this._audioUI = a
    }
    if (this._audioUI) {
      this._audioUI.onMusicToggle.add((on) => {
        this.audio.setMusicEnabled(on)
        this.audio.playClick()
      })
      this._audioUI.onSfxToggle.add((on) => {
        this.audio.setSfxEnabled(on)
        this.audio.playClick()
      })
    }

    this.enterPlacement(true)
  }


  // ── Placement step ─────────────────────────────────────────────────────────
  private enterPlacement(first: boolean): void {
    if (!first) this.state.resumePhase = this.state.phase
    this.state.phase = "placement"
    this.placement.enterPlacement()
    this.wheel.setSpinning(false)
    this.clay.setSculptEnabled(false)
    this.clay.setGrabEnabled(false)
    this.placementUI.setVisible(true)
    this.placementUI.setHeightNorm(this.placement.heightNorm)
    this.placementUI.setHeightText(this.placement.benchHeightCm)
    this.controlsUI.setMode("hidden")
    this.gearUI.setVisible(false)
    this.scoreUI.setLiveVisible(false)
    if (this._sign) this._sign.setVisible(false)
    if (this._audioUI) {
      this._audioUI.setState(this.audio.musicEnabled, this.audio.sfxEnabled)
      this._audioUI.setVisible(true)
    }
    if (first) {
      // The clay and the target arrive with a drop-in when Start is pinched.
      this.clay.setPieceVisible(false)
      this.target.setVaseVisible(false)
    }
    if (first) this.showHint("placeBench")
    else this.hideHintTemporarily()
  }

  private onHeightSlider(v: number): void {
    if (!this.placement.isPlacementMode) return
    this.placement.setHeightNorm(v)
    this.placementUI.setHeightText(this.placement.benchHeightCm)
  }

  /** Pinch Start: leave placement, start (or resume) the wheel. */
  pressStart(): void {
    if (this.state.phase !== "placement") return
    this.audio.playClick()
    this.placement.exitPlacement()
    this.placementUI.setVisible(false)
    if (this._audioUI) this._audioUI.setVisible(false)
    this.completeHint("placeBench")
    if (!this.state.hasStartedOnce) this.dropPieces(true)
    const resume = this.state.hasStartedOnce ? this.state.resumePhase : "play"
    this.state.hasStartedOnce = true
    this.state.phase = resume === "placement" ? "play" : resume
    this.enterPlay()
  }

  /** Pinch the gear: pause the wheel, bring back the placement controls. */
  pressGear(): void {
    if (this.state.phase !== "play") return
    this.audio.playClick()
    this.enterPlacement(false)
  }

  // ── Play ───────────────────────────────────────────────────────────────────
  private enterPlay(): void {
    this.refreshSign()
    this.wheel.setSpinning(true)
    this.gearUI.setVisible(true)
    const onWheel = this.clay.isOnWheel
    this.clay.setGrabEnabled(!onWheel)
    this.clay.setSculptEnabled(onWheel)
    this.controlsUI.setMode(onWheel ? "play" : "startOverOnly")
    this.target.setGhostVisible(onWheel)
    this.scoreUI.setLiveVisible(onWheel && this.showLivePercent)
    this.refreshLive()
    if (!onWheel) this.showHint("dropClay")
    else this.restoreHint()
  }

  private onClayLanded(): void {
    this.completeHint("dropClay")
    if (this.state.phase === "play") {
      this.clay.setSculptEnabled(true)
      this.controlsUI.setMode("play")
      this.target.setGhostVisible(true)
      this.scoreUI.setLiveVisible(this.showLivePercent)
      this.refreshLive()
      this.showHint("sculpt")
    }
  }

  private onStrokeStart(): void {
    if (this.activeHint === "matchTarget") this.completeHint("matchTarget")
  }

  private onStrokeEnd(): void {
    if (this.activeHint === "sculpt") {
      this.completeHint("sculpt")
      this.showHint("matchTarget")
      this.matchHintTimer = this.matchHintSeconds
    }
  }

  /** Drag the spinning clay (same path the hand uses). */
  applyDrag(heightNorm: number, dRadial: number, dVertical: number): DragResult {
    if (this.state.phase !== "play" || !this.clay.isOnWheel) return "ignored"
    const first = !this.hintsDone["sculpt"] && this.activeHint === "sculpt"
    if (this.activeHint === "matchTarget") this.completeHint("matchTarget")
    const r = this.clay.applyDrag(heightNorm, dRadial, dVertical)
    if (first) this.onStrokeEnd()
    return r
  }

  /** Drop the block onto the wheel (same result as grabbing and releasing it over the wheel). */
  dropClayOnWheel(): void {
    if (this.state.phase !== "play" || this.clay.isOnWheel) return
    this.clay.placeOnWheel()
  }

  pressUndo(): void {
    if (this.state.phase !== "play" || !this.clay.isOnWheel) return
    this.audio.playClick()
    this.clay.undo()
  }

  /** Lock in the piece and show the score above the target. */
  pressDone(): void {
    if (this.state.phase !== "play" || !this.clay.isOnWheel) return
    this.hideHintTemporarily()
    const pct = matchPercent(this.clay.model, this.target.currentTarget)
    const r = this.state.finishRound(pct, this.clay.model.collapseCount, this.clay.model.undoCount)
    this.state.phase = "results"
    this.wheel.setSpinning(false)
    this.clay.setSculptEnabled(false)
    this.target.setGhostVisible(false)
    this.gearUI.setVisible(false)
    this.controlsUI.setMode("hidden")
    // The finished piece rises off the wheel with sparkles; the inspector's board stands
    // where the target was.
    this.clay.startPresentation()
    this._effects.twinkle(() => this.clay.getPieceCenterWorld(), 9, 6)
    this.target.setVaseVisible(false)
    const n = this.target.targetCount
    this.setResults.push({name: this.target.currentTarget.name, score: r.score})
    this.scoreUI.showResults(r, `Item ${this.target.targetIndex + 1} of ${n} · ${this.target.currentTarget.name}`)
    this.audio.playClick() // chime/splat plays when the grade is revealed
  }

  /** Fresh block of clay for the same target, any time while sculpting. */
  pressStartOver(): void {
    if (this.state.phase !== "play") return
    this.audio.playClick()
    this.clay.resetClay()
    this.dropPieces(false)
    this.state.phase = "play"
    this.enterPlay()
  }

  /** Same as pinching Collect on the inspector's board (once it's showing). */
  pressCollect(): void {
    this.scoreUI.pressCollect()
  }

  /** Test shortcut: skip collect + wiping and go straight to the next item. */
  pressNextVase(): void {
    if (this.state.phase === "results") this.startWipe()
    if (this.state.phase === "wipe") this.finishWipe()
  }

  /** Test hook: wipe as if the held sponge moved `cm` across the wheel. */
  wipeWheel(cm: number): void {
    if (this.state.phase !== "wipe") return
    this._sponge.wipe(cm)
  }

  private onGradeRevealed(good: boolean): void {
    this.audio.playGrade(good)
    const r = this.state.lastResult
    const count = good ? 16 + Math.round(((r ? r.score : 60) - 60) / 2) : 6
    this._effects.burst(this.clay.getPieceCenterWorld(), count, good ? 7 : 4)
  }

  private onCollect(): void {
    this.refreshSign()
    this.audio.playChime()
    this._effects.burst(this.scoreUI.getBoardWorldPosition(), 12, 6)
  }

  /** After collecting: the piece pops away, the wheel is left smeared; wipe it with the sponge. */
  private startWipe(): void {
    if (this.state.phase !== "results") return
    this.state.phase = "wipe"
    this.scoreUI.hideResults()
    this._effects.stopTwinkle()
    this._effects.burst(this.clay.getPieceCenterWorld(), 14, 5)
    this.clay.poofAway()
    this._sponge.setDirty(true)
    this._sponge.setWipeActive(true)
    this.hintsDone["wipe"] = false
    this.showHint("wipe")
  }

  /** Wheel clean: next item on the stand, a fresh block beside the wheel. */
  private finishWipe(): void {
    if (this.state.phase !== "wipe") return
    this.completeHint("wipe")
    this._sponge.setWipeActive(false)
    if (this._sponge.isDirty) this._sponge.setDirty(false)
    this._effects.burst(this.clay.clayAnchor.getTransform().getWorldPosition(), 10, 4)
    this.audio.playClick()
    if (this.target.targetIndex >= this.target.targetCount - 1) {
      this.showSetComplete()
      return
    }
    this.target.nextTarget()
    this.layoutForTarget()
    this.clay.resetClay()
    this.dropPieces(true)
    this.state.phase = "play"
    this.enterPlay()
  }

  /** All 10 items done: potter's certificate on the stand with rank, stats and Play again. */
  private showSetComplete(): void {
    this.state.phase = "complete"
    this.refreshSign()
    this.clay.resetClay()
    this.clay.setGrabEnabled(false)
    this.controlsUI.setMode("hidden")
    this.gearUI.setVisible(false)
    this.target.setVaseVisible(false)
    const scores = this.setResults
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 0
    let best = scores[0] || {name: "-", score: 0}
    for (const r of scores) if (r.score > best.score) best = r
    this.scoreUI.showComplete({
      rank: rankFor(avg, scores.map((r) => r.score)),
      average: avg,
      bestName: best.name,
      bestScore: best.score,
      totalXp: this.state.xp,
      level: this.state.level,
      count: scores.length,
    })
    this.audio.playChime()
    this._effects.burst(this.scoreUI.getBoardWorldPosition(), 30, 9)
    this._effects.twinkle(() => this.scoreUI.getBoardWorldPosition(), 16, 4)
  }

  /** Certificate → start the 10 items again (skill XP and level are kept). */
  pressPlayAgain(): void {
    if (this.state.phase !== "complete") return
    this.audio.playClick()
    this.scoreUI.hideComplete()
    this._effects.stopTwinkle()
    this.setResults = []
    this.target.setTargetIndex(0)
    this.layoutForTarget()
    this.clay.resetClay()
    this.dropPieces(true)
    this.state.phase = "play"
    this.enterPlay()
  }

  /**
   * Drop-in: the target piece (optional) falls onto its stand, then the fresh clay block falls
   * onto the bench beside the wheel; each lands with a thud and glows green for a few seconds.
   */
  private dropPieces(withTarget: boolean): void {
    if (withTarget) this.target.dropIn(35)
    this.clay.setPieceVisible(false)
    this.later(withTarget ? 0.4 : 0.05, () => {
      if (this.clay.isOnWheel) return
      this.clay.dropIn(30)
    })
  }

  private later(sec: number, fn: () => void): void {
    const ev = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    ev.bind(fn)
    ev.reset(sec)
  }

  /** Progress sign under the clay: piece n of 10 + dots, level badge, XP in this level. */
  private refreshSign(): void {
    if (!this._sign) return
    const per = this.state.config.xpPerLevel
    this._sign.setVisible(this.state.phase !== "placement")
    this._sign.show({
      itemIndex: this.target.targetIndex,
      itemCount: this.target.targetCount,
      itemName: this.target.currentTarget.name,
      level: this.state.level,
      xpInLevel: this.state.xp % per,
      xpPerLevel: per,
      complete: this.state.phase === "complete",
    })
  }

  /** Live % just above the current target; its hint above that; board on the stand. */
  private layoutForTarget(): void {
    const H = this.target.currentHeightCm
    this.scoreUI.layoutForTarget(0, H)
    const ta = this.target.getSceneObject().getTransform().getLocalPosition()
    this.hintAnchorTarget.getTransform().setLocalPosition(new vec3(ta.x, this.target.standTopCm + H + 18, ta.z))
  }

  private refreshLive(): void {
    if (!this.clay.isOnWheel) return
    this._live = matchPercent(this.clay.model, this.target.currentTarget)
    this.scoreUI.setLiveMatch(this._live)
  }

  // ── Hints (one at a time, each shown once) ─────────────────────────────────
  private anchorFor(id: HintId): SceneObject | null {
    switch (id) {
      case "placeBench": return this.hintAnchorBench
      case "dropClay": return this.hintAnchorClay
      case "sculpt": return this.hintAnchorWheel
      case "matchTarget": return this.hintAnchorTarget
      case "wipe": return this.hintAnchorSponge
    }
    return null
  }

  private textFor(id: HintId): string {
    switch (id) {
      case "placeBench": return this.hintPlaceText
      case "dropClay": return this.hintDropText
      case "sculpt": return this.hintSculptText
      case "matchTarget": return this.hintMatchText
      case "wipe": return this.hintWipeText
    }
    return ""
  }

  private showHint(id: HintId): void {
    if (!this.showHints || this.hintsDone[id]) return
    this.activeHint = id
    this.activeAnchor = this.anchorFor(id)
    this.followAnchor()
    this.hintUI.show(id, this.textFor(id))
  }

  private completeHint(id: HintId): void {
    this.hintsDone[id] = true
    if (this.activeHint === id) {
      this.activeHint = ""
      this.activeAnchor = null
      this.hintUI.hide()
    }
  }

  /** Hide the bubble (gear / results) but keep it pending. */
  private hideHintTemporarily(): void {
    this.hintUI.hide()
  }

  private restoreHint(): void {
    if (this.activeHint && !this.hintsDone[this.activeHint]) this.hintUI.show(this.activeHint, this.textFor(this.activeHint))
  }

  private followAnchor(): void {
    if (!this.activeAnchor) return
    this.hintUI.getSceneObject().getTransform().setWorldPosition(this.activeAnchor.getTransform().getWorldPosition())
  }

  private onUpdate(): void {
    this.followAnchor()
    if (this.matchHintTimer > 0) {
      this.matchHintTimer -= getDeltaTime()
      if (this.matchHintTimer <= 0 && this.activeHint === "matchTarget") this.completeHint("matchTarget")
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  private ensureAudioListener(): void {
    const camSO = WorldCameraFinderProvider.getInstance().getComponent().getSceneObject()
    if (!camSO.getComponent("Component.AudioListenerComponent")) {
      camSO.createComponent("Component.AudioListenerComponent")
    }
  }

  private setColliderDebugAll(root: SceneObject, on: boolean): void {
    const cols = root.getComponents("Physics.ColliderComponent") as ColliderComponent[]
    for (const c of cols) c.debugDrawEnabled = on
    for (let i = 0; i < root.getChildrenCount(); i++) this.setColliderDebugAll(root.getChild(i), on)
  }
}

/** Potter rank for a finished set: Master needs 90%+ on every piece. */
export function rankFor(average: number, scores: number[]): string {
  if (scores.length > 0 && scores.every((x) => x >= 90)) return "Master Potter"
  if (average >= 75) return "Skilled Potter"
  if (average >= 60) return "Journeyman Potter"
  return "Apprentice Potter"
}
