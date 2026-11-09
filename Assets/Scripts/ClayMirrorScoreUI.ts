/**
 * ClayMirrorScoreUI — live match % above the target, and the inspector's board after Done.
 *
 * Passive view (UIKit): a live card (caption + big %) that floats just above the target piece,
 * and an "inspector's board" that stands on the target stand after Done (the target piece is
 * hidden meanwhile): header, item name, score counting up, grade word popping in, bonuses one
 * by one, then a Collect button. Collect fills the potter skill bar, shows the XP, then fires
 * onCollected so the game can move on (wipe the wheel → next item).
 * Holds no game state — ClayMirrorMain pushes values in.
 * API: setLiveVisible(b), setLiveMatch(pct), setLiveHeight(cm), showResults(r, itemLabel),
 *      hideResults(), pressCollect(), buildBoardFrame(litMaterial)
 * Events: onCountTick, onGradeRevealed, onBonusRevealed, onCollect, onCollected.
 */
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ProgressBar} from "SpectaclesUIKit.lspkg/Scripts/Components/ProgressBar/ProgressBar"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {appendBox, makeMeshObject, newBuilder, tintedMaterial} from "./ClayMirrorMeshFactory"
import {addText, card, flexChild, makeFlex, obj, ringIconButton} from "./ClayMirrorUIHelpers"

const ICON_COLLECT: Texture = requireAsset("../Icons/thumb_up.png") as Texture
const ICON_REPLAY: Texture = requireAsset("../Icons/restart_alt.png") as Texture

export interface ResultsView {
  score: number
  totalXp: number
  bonuses: {label: string; xp: number}[]
  levelAfter: number
  barFrom: number
  barTo: number
  leveledUp: boolean
}

const MAX_BONUS_LINES = 4

/** Grade bands shown after the score counts up. Light colours only (additive display). */
export interface Grade {
  label: string
  color: vec4 // light version (for glowing UI)
  ink: vec4 // dark version, printed on the white report paper
  good: boolean
}
export function gradeFor(score: number): Grade {
  if (score >= 90) return {label: "EXCELLENT!", color: new vec4(1.0, 0.86, 0.35, 1), ink: new vec4(0.78, 0.5, 0.0, 1), good: true}
  if (score >= 75) return {label: "GREAT JOB!", color: new vec4(0.55, 1.0, 0.65, 1), ink: new vec4(0.05, 0.55, 0.2, 1), good: true}
  if (score >= 60) return {label: "WELL DONE", color: new vec4(0.6, 0.88, 1.0, 1), ink: new vec4(0.1, 0.38, 0.78, 1), good: true}
  if (score >= 40) return {label: "NOT BAD", color: new vec4(1, 1, 1, 1), ink: new vec4(0.25, 0.27, 0.33, 1), good: false}
  return {label: "NOT GOOD ENOUGH", color: new vec4(1.0, 0.62, 0.5, 1), ink: new vec4(0.82, 0.22, 0.12, 1), good: false}
}

/** End-of-set summary shown after the 10th item. */
export interface SetSummary {
  rank: string
  average: number
  bestName: string
  bestScore: number
  totalXp: number
  level: number
  count: number
}

// Report "ink" (the board is white paper; on Specs dark ink reads as see-through letters on a bright sheet).
const INK = new vec4(0.12, 0.14, 0.22, 1)
const INK_SOFT = new vec4(0.32, 0.35, 0.42, 1)
const INK_AMBER = new vec4(0.75, 0.47, 0.0, 1)
const INK_GREEN = new vec4(0.05, 0.5, 0.2, 1)
const PAPER = new vec4(0.97, 0.96, 0.92, 1)

function easeOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x))
  return 1 - Math.pow(1 - c, 3)
}

/** Pop-in scale: overshoots to ~1.18 then settles at 1 over `dur` seconds. */
function popScale(t: number, dur: number): number {
  if (t <= 0) return 0.01
  if (t >= dur) return 1
  const x = t / dur
  return x < 0.6 ? 0.3 + (1.18 - 0.3) * (x / 0.6) : 1.18 - 0.18 * ((x - 0.6) / 0.4)
}
const POP_SEC = 0.35
const BOARD_W = 30
const BOARD_H = 47

@component
export class ClayMirrorScoreUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClayMirrorScoreUI – live match % + inspector\'s board</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Caption above the live match %")
  liveCaption: string = "Match"

  @input
  @hint("Board header")
  boardTitle: string = "INSPECTOR'S REPORT"

  @input
  @hint("Viewing distance used to scale text (cm) — the target sits ~90 cm away")
  @widget(new SliderWidget(60, 160, 1))
  textDistanceCm: number = 110

  @input("vec4", "{1,1,1,1}")
  @hint("Main text color")
  @widget(new ColorWidget())
  textColor: vec4

  @input("vec4", "{0.55,1.0,0.65,1}")
  @hint("Bonus line color")
  @widget(new ColorWidget())
  bonusColor: vec4

  @input
  @hint("Seconds the score takes to count up to the final grade")
  @widget(new SliderWidget(0.3, 4, 0.1))
  countUpSec: number = 1.6

  @input
  @hint("Seconds between each bonus line popping in")
  @widget(new SliderWidget(0.1, 1, 0.05))
  bonusStepSec: number = 0.35

  @input
  @hint("Seconds the skill bar takes to fill after Collect before moving on")
  @widget(new SliderWidget(0.3, 3, 0.1))
  collectHoldSec: number = 1.3

  @input
  @hint("Board center height above the stand top (cm)")
  @widget(new SliderWidget(10, 40, 0.5))
  boardCenterAboveStandCm: number = 25
  @ui.group_end

  private _onCountTick = new Event<number>()
  private _onGradeRevealed = new Event<Grade>()
  private _onBonusRevealed = new Event<number>()
  private _onCollect = new Event<void>()
  private _onCollected = new Event<void>()
  private _onPlayAgain = new Event<void>()
  private completeRoot: SceneObject
  private completeTitleText: Text
  private completeRankText: Text
  private completeStatsText: Text
  private completeXpText: Text
  private playAgainObj: SceneObject
  private wantComplete = false
  private liveRoot: SceneObject
  private resultsRoot: SceneObject
  private liveText: Text
  private itemText: Text
  private scoreText: Text
  private gradeText: Text
  private gradeObj: SceneObject
  private levelText: Text
  private xpText: Text
  private bonusTexts: Text[] = []
  private bonusObjs: SceneObject[] = []
  private bar: ProgressBar
  private collectCell: SceneObject
  private collectLabel: Text
  private collectButtonObj: SceneObject
  private wantLive = false
  private wantResults = false
  private ready = false
  private _liveMatch = 0
  private _lastResults: ResultsView | null = null
  private standTopLocalY = 0
  // Reveal timeline
  private revealT = -1
  private shownScore = 0
  private lastTickScore = 0
  private gradeShown = false
  private bonusesShown = 0
  private _collectShown = false
  private _collected = false
  private collectT = -1
  private _revealComplete = false
  private pops: {so: SceneObject; t: number}[] = []
  private _grade: Grade | null = null

  /** Fires as the counting score passes each few percent (for a tick sound). */
  get onCountTick(): PublicApi<number> { return this._onCountTick.publicApi() }
  /** Fires when the count reaches the final score and the grade word pops in. */
  get onGradeRevealed(): PublicApi<Grade> { return this._onGradeRevealed.publicApi() }
  /** Fires as each bonus line pops in (index). */
  get onBonusRevealed(): PublicApi<number> { return this._onBonusRevealed.publicApi() }
  /** Collect pinched (skill bar starts filling). */
  get onCollect(): PublicApi<void> { return this._onCollect.publicApi() }
  /** Skill bar finished after Collect — time to move on. */
  get onCollected(): PublicApi<void> { return this._onCollected.publicApi() }
  /** "Play again" pinched on the end-of-set board. */
  get onPlayAgain(): PublicApi<void> { return this._onPlayAgain.publicApi() }
  get completeVisible(): boolean { return this.wantComplete }
  get completeTitle(): string { return this.completeTitleText ? this.completeTitleText.text : "" }
  get completeRank(): string { return this.completeRankText ? this.completeRankText.text : "" }
  get completeStats(): string { return this.completeStatsText ? this.completeStatsText.text : "" }
  get playAgainButtonObject(): SceneObject { return this.playAgainObj }
  get liveVisible(): boolean { return this.wantLive }
  get resultsVisible(): boolean { return this.wantResults }
  get liveMatch(): number { return this._liveMatch }
  get liveLabel(): string { return this.liveText ? this.liveText.text : "" }
  /** The big score number as displayed right now (counts up after Done). */
  get scoreLabel(): string { return this.scoreText ? this.scoreText.text : "" }
  get itemLabel(): string { return this.itemText ? this.itemText.text : "" }
  /** Score value currently displayed during the count-up. */
  get displayedScore(): number { return this.shownScore }
  /** Grade word ("EXCELLENT!" … "NOT GOOD ENOUGH"), empty until revealed. */
  get gradeLabel(): string { return this.gradeShown && this.gradeText ? this.gradeText.text : "" }
  get grade(): Grade | null { return this._grade }
  /** True once count-up, grade and bonuses have played and Collect is showing. */
  get isRevealComplete(): boolean { return this._revealComplete }
  get isCollectVisible(): boolean { return this._collectShown }
  get isCollected(): boolean { return this._collected }
  get collectButtonLabel(): string { return this.collectLabel ? this.collectLabel.text : "" }
  get bonusLabels(): string[] { return this.bonusTexts.filter((t, i) => i < this.bonusesShown && t.text.length > 0).map((t) => t.text) }
  get skillBarValue(): number { return this.bar ? this.bar.currentValue : 0 }
  get lastResults(): ResultsView | null { return this._lastResults }
  get collectButtonObject(): SceneObject { return this.collectButtonObj }
  /** World center of the board (for tests / effects). */
  getBoardWorldPosition(): vec3 { return this.resultsRoot.getTransform().getWorldPosition() }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())
    const c = this.textColor
    const d = this.textDistanceCm

    // Live card
    this.liveRoot = obj(this.sceneObject, "Live")
    card(this.liveRoot, "LiveCard", 16, 10, (content) => {
      const col = makeFlex(content, FlexDirection.Column, 16, 10, FlexJustify.Center, FlexAlign.Center, 0.4)
      flexChild(col, 14, 2.6, (t) => addText(t, this.liveCaption, "Subheadline", 14, c, d))
      flexChild(col, 14, 5, (t) => {
        this.liveText = addText(t, "--%", "Title1", 14, c, d, 5)
      })
    })

    // Inspector's board (positioned on the stand by setStandTop / showResults)
    this.resultsRoot = obj(this.sceneObject, "Results")
    const W = BOARD_W
    const H = BOARD_H
    {
      const content = obj(this.resultsRoot, "BoardContent", new vec3(0, 0, 0.6))
      const col = makeFlex(content, FlexDirection.Column, W, H, FlexJustify.Center, FlexAlign.Center, 0.45, 1.2)
      flexChild(col, W - 3, 2.4, (t) => addText(t, this.boardTitle, "Callout", W - 3, INK_AMBER, d), "Title")
      flexChild(col, W - 3, 2.4, (t) => {
        this.itemText = addText(t, "Item 1 of 10 · Mug", "Body", W - 3, INK_SOFT, d)
      }, "Item")
      flexChild(col, W - 3, 6, (t) => {
        this.scoreText = addText(t, "0%", "Title1", W - 3, INK, d, 6)
        this.scoreText.size = this.scoreText.size * 1.5
      }, "ScoreNumber")
      this.gradeObj = flexChild(col, W - 3, 4, (t) => {
        this.gradeText = addText(t, "", "Title2", W - 3, INK, d, 4)
      }, "Grade")
      for (let i = 0; i < MAX_BONUS_LINES; i++) {
        this.bonusObjs.push(flexChild(col, W - 3, 2.2, (t) => {
          this.bonusTexts.push(addText(t, "", "Callout", W - 3, INK_GREEN, d, 2.2))
        }, "Bonus" + i))
      }
      flexChild(col, W - 3, 2.4, (t) => {
        this.levelText = addText(t, "Potter skill · Lv 1", "Body", W - 3, INK, d)
      }, "Level")
      flexChild(col, W - 6, 1.4, (b) => {
        this.bar = b.createComponent(ProgressBar.getTypeName()) as ProgressBar
        this.bar.size = new vec3(W - 6, 1.2, 1) // BEFORE init
      }, "SkillBar")
      flexChild(col, W - 3, 2.4, (t) => {
        this.xpText = addText(t, "", "Subheadline", W - 3, INK_GREEN, d)
      }, "Xp")
      this.collectCell = flexChild(col, W - 3, 10.5, (cell) => {
        const cc = makeFlex(cell, FlexDirection.Column, W - 3, 10.5, FlexJustify.Center, FlexAlign.Center, 0.5)
        flexChild(cc, 8, 8, (b) => {
          const btn = ringIconButton(obj(b, "CollectButton"), ICON_COLLECT, 6.5, new vec4(1.0, 0.86, 0.35, 1), () => this.pressCollect())
          this.collectButtonObj = btn.sceneObject
        })
        flexChild(cc, W - 3, 2.4, (t) => {
          this.collectLabel = addText(t, "Collect", "Subheadline", W - 3, INK_AMBER, d)
        })
      }, "Collect")
    }

    // End-of-set board (after the 10th item), same clipboard look.
    this.completeRoot = obj(this.sceneObject, "Complete")
    {
      const content = obj(this.completeRoot, "CompleteContent", new vec3(0, 0, 0.6))
      const col = makeFlex(content, FlexDirection.Column, W, H, FlexJustify.Center, FlexAlign.Center, 0.6, 1.2)
      flexChild(col, W - 3, 2.4, (t) => addText(t, "POTTER'S CERTIFICATE", "Callout", W - 3, INK_AMBER, d), "Title")
      flexChild(col, W - 3, 5, (t) => {
        this.completeTitleText = addText(t, "Well done!", "Title2", W - 3, INK, d, 5)
      }, "Headline")
      flexChild(col, W - 3, 3.4, (t) => {
        this.completeRankText = addText(t, "Journeyman Potter", "Headline2", W - 3, INK_GREEN, d, 3.4)
      }, "Rank")
      flexChild(col, W - 3, 2.4, (t) => {
        this.completeStatsText = addText(t, "", "Body", W - 3, INK, d)
      }, "Stats")
      flexChild(col, W - 3, 2.4, (t) => {
        this.completeXpText = addText(t, "", "Body", W - 3, INK, d)
      }, "Xp")
      flexChild(col, W - 3, 3, (t) => addText(t, "More pieces coming soon!", "Subheadline", W - 3, INK_AMBER, d, 3), "Soon")
      flexChild(col, W - 3, 4.6, (t) => {
        const tx = addText(t, "Play again and score 90%+ on every piece\nto become a Master Potter", "Caption", W - 3, INK_SOFT, d, 4.6)
        tx.verticalOverflow = VerticalOverflow.Overflow
      }, "Master")
      flexChild(col, W - 3, 10.5, (cell) => {
        const cc = makeFlex(cell, FlexDirection.Column, W - 3, 10.5, FlexJustify.Center, FlexAlign.Center, 0.5)
        flexChild(cc, 8, 8, (b) => {
          const btn = ringIconButton(obj(b, "PlayAgainButton"), ICON_REPLAY, 6.5, new vec4(0.45, 1.0, 0.55, 1), () => this.pressPlayAgain())
          this.playAgainObj = btn.sceneObject
        })
        flexChild(cc, W - 3, 2.4, (t) => addText(t, "Play again", "Subheadline", W - 3, INK_GREEN, d))
      }, "PlayAgain")
    }

    this.createEvent("UpdateEvent").bind(() => {
      if (!this.ready) {
        this.ready = true
        this.apply()
      }
      this.tickReveal(getDeltaTime())
    })
  }

  /** White paper on a light wooden clipboard with a clip, behind both boards. */
  buildBoardFrame(litMaterial: Material, unlitMaterial: Material): void {
    this.buildClipboard(this.resultsRoot, litMaterial, unlitMaterial)
    this.buildClipboard(this.completeRoot, litMaterial, unlitMaterial)
  }

  private buildClipboard(root: SceneObject, litMaterial: Material, unlitMaterial: Material): void {
    const paper = newBuilder()
    appendBox(paper, new vec3(0, 0, -0.25), new vec3(BOARD_W, BOARD_H, 0.3))
    // Draw the paper first: text does not write depth, so anything drawn after it would cover it.
    makeMeshObject(root, "Paper", paper, tintedMaterial(unlitMaterial, PAPER)).setRenderOrder(-20)
    const b = newBuilder()
    const t = 1.2
    const w = BOARD_W + 2 * t
    const h = BOARD_H + 2 * t
    const z = -0.4
    appendBox(b, new vec3(0, BOARD_H / 2 + t / 2, z), new vec3(w, t, 0.8))
    appendBox(b, new vec3(0, -BOARD_H / 2 - t / 2, z), new vec3(w, t, 0.8))
    appendBox(b, new vec3(BOARD_W / 2 + t / 2, 0, z), new vec3(t, h, 0.8))
    appendBox(b, new vec3(-BOARD_W / 2 - t / 2, 0, z), new vec3(t, h, 0.8))
    makeMeshObject(root, "BoardFrame", b, tintedMaterial(litMaterial, new vec4(0.92, 0.76, 0.52, 1)))
    const clip = newBuilder()
    appendBox(clip, new vec3(0, BOARD_H / 2 + t + 0.6, 0.2), new vec3(9, 2.4, 1.2))
    appendBox(clip, new vec3(0, BOARD_H / 2 + t - 0.6, 0.6), new vec3(6, 1.2, 0.6))
    makeMeshObject(root, "BoardClip", clip, tintedMaterial(litMaterial, new vec4(0.85, 0.87, 0.92, 1)))
  }

  /**
   * Lay out around the current target: live % just above the piece's top, board standing
   * on the stand. `standTopY` and `pieceTopY` are in this object's parent space offsets
   * relative to this object's own position (cm).
   */
  layoutForTarget(standTopY: number, pieceTopY: number): void {
    this.standTopLocalY = standTopY
    this.liveRoot.getTransform().setLocalPosition(new vec3(0, pieceTopY + 9, 0))
    this.resultsRoot.getTransform().setLocalPosition(new vec3(0, standTopY + this.boardCenterAboveStandCm, 0))
    this.completeRoot.getTransform().setLocalPosition(new vec3(0, standTopY + this.boardCenterAboveStandCm, 0))
  }

  setLiveVisible(on: boolean): void {
    this.wantLive = on
    if (on) this.wantResults = false
    if (this.ready) this.apply()
  }

  setLiveMatch(pct: number): void {
    this._liveMatch = pct
    if (this.liveText) this.liveText.text = `${Math.round(pct)}%`
  }

  showResults(r: ResultsView, itemLabel: string): void {
    this._lastResults = r
    this.wantResults = true
    this.wantLive = false
    this.itemText.text = itemLabel
    this.levelText.text = `Potter skill · Lv ${r.levelAfter > 1 && r.leveledUp ? r.levelAfter - 1 : r.levelAfter}`
    // Reset the reveal: everything starts blank and plays in over a few seconds.
    this.scoreText.text = "0%"
    this.scoreText.textFill.color = INK
    this.gradeText.text = ""
    this._grade = null
    for (let i = 0; i < MAX_BONUS_LINES; i++) this.bonusTexts[i].text = ""
    this.xpText.text = ""
    this.collectLabel.text = `Collect +${r.totalXp} XP`
    this.gradeObj.getTransform().setLocalScale(new vec3(0.01, 0.01, 1))
    for (const so of this.bonusObjs) so.getTransform().setLocalScale(new vec3(0.01, 0.01, 1))
    this.pops = []
    this.shownScore = 0
    this.lastTickScore = 0
    this.gradeShown = false
    this.bonusesShown = 0
    this._collectShown = false
    this._collected = false
    this.collectT = -1
    this._revealComplete = false
    this.revealT = 0
    if (this.ready) this.apply()
    // Skill bar: shows where it was; it fills when the player collects.
    const from = r.leveledUp ? 0 : r.barFrom
    this.bar.updateValue(from, false)
  }

  hideResults(): void {
    this.wantResults = false
    this.revealT = -1
    this.collectT = -1
    if (this.ready) this.apply()
  }

  /** End-of-set certificate on the stand (after the 10th item). */
  showComplete(sum: SetSummary): void {
    this.wantComplete = true
    this.wantResults = false
    this.wantLive = false
    this.revealT = -1
    this.collectT = -1
    this.completeTitleText.text = sum.average >= 75 ? "Well done, potter!" : "Set complete!"
    this.completeRankText.text = sum.rank
    this.completeStatsText.text = `Average ${sum.average}% · Best: ${sum.bestName} ${sum.bestScore}%`
    this.completeXpText.text = `${sum.count} pieces · ${sum.totalXp} XP · Potter skill Lv ${sum.level}`
    if (this.ready) this.apply()
    this.pops.push({so: this.completeRoot, t: 0})
  }

  hideComplete(): void {
    this.wantComplete = false
    if (this.ready) this.apply()
  }

  /** Same as pinching "Play again" on the certificate. */
  pressPlayAgain(): void {
    if (!this.wantComplete) return
    this._onPlayAgain.invoke()
  }

  /** Same as pinching Collect: fill the skill bar, show XP, then fire onCollected. */
  pressCollect(): void {
    if (!this.wantResults || !this._collectShown || this._collected) return
    const r = this._lastResults
    this._collected = true
    this.collectCell.enabled = false
    this.xpText.text = `+${r.totalXp} XP`
    this.levelText.text = r.leveledUp ? `Level up! Potter skill · Lv ${r.levelAfter}` : `Potter skill · Lv ${r.levelAfter}`
    this.bar.updateValue(Math.max(0.02, r.barTo), true)
    this.pops.push({so: this.xpText.getSceneObject(), t: 0})
    this.collectT = 0
    this._onCollect.invoke()
  }

  /** Drives the board: count-up → grade pop → bonuses one by one → Collect button. */
  private tickReveal(dt: number): void {
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]
      p.t += dt
      const s = popScale(p.t, POP_SEC)
      p.so.getTransform().setLocalScale(new vec3(s, s, 1))
      if (p.t >= POP_SEC) this.pops.splice(i, 1)
    }
    if (this.collectT >= 0) {
      this.collectT += dt
      if (this.collectT >= this.collectHoldSec) {
        this.collectT = -1
        this._onCollected.invoke()
      }
    }
    if (this.revealT < 0 || !this._lastResults) return
    const r = this._lastResults
    this.revealT += dt
    const t = this.revealT

    // 1. Count the score up with ease-out (fast first, slowing as it lands).
    const target = r.score
    const shown = Math.round(target * easeOutCubic(t / this.countUpSec))
    if (shown !== this.shownScore) {
      this.shownScore = shown
      this.scoreText.text = `${shown}%`
      if (shown - this.lastTickScore >= 3 || shown === target) {
        this.lastTickScore = shown
        if (!this.gradeShown) this._onCountTick.invoke(shown)
      }
    }

    // 2. Grade word pops in when the count lands.
    if (!this.gradeShown && t >= this.countUpSec) {
      this.shownScore = target
      this.scoreText.text = `${target}%`
      const g = gradeFor(target)
      this._grade = g
      this.gradeText.text = g.label
      this.gradeText.textFill.color = g.ink
      this.scoreText.textFill.color = g.ink
      this.gradeShown = true
      this.pops.push({so: this.gradeObj, t: 0})
      this._onGradeRevealed.invoke(g)
    }

    // 3. Bonus lines pop in one at a time.
    const bonusStart = this.countUpSec + 0.4
    const lines = r.bonuses.length > 0 ? Math.min(MAX_BONUS_LINES, r.bonuses.length) : 1
    while (this.gradeShown && this.bonusesShown < lines && t >= bonusStart + this.bonusesShown * this.bonusStepSec) {
      const i = this.bonusesShown
      const b = r.bonuses[i]
      this.bonusTexts[i].text = b ? `+${b.xp}  ${b.label}` : "No bonus this time"
      this.pops.push({so: this.bonusObjs[i], t: 0})
      this.bonusesShown++
      if (b) this._onBonusRevealed.invoke(i)
    }

    // 4. Collect button pops in.
    const collectAt = bonusStart + lines * this.bonusStepSec + 0.2
    if (!this._collectShown && t >= collectAt) {
      this._collectShown = true
      this.collectCell.enabled = true
      this.pops.push({so: this.collectCell, t: 0})
      this._revealComplete = true
      this.revealT = -1
    }
  }

  private apply(): void {
    this.liveRoot.enabled = this.wantLive
    this.resultsRoot.enabled = this.wantResults
    this.completeRoot.enabled = this.wantComplete
    if (this.collectCell) this.collectCell.enabled = this.wantResults && this._collectShown && !this._collected
  }
}
