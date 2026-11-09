/**
 * Criterion 5 — pinching Done shows the score above the target vase, with the potter skill
 * bar going up and any bonus earned. The score counts (spins) up to the final grade, then a
 * grade word ("EXCELLENT!" … "NOT GOOD ENOUGH") pops in, then bonuses, then the skill bar fills.
 * Input: setup via hooks; Done is a REAL pinch.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {gradeFor} from "../Scripts/ClayMirrorScoreUI"
import {fmt, interactableOf, log, setupPlayWithClayOnWheel, waitForGame, waitUntil, pinch} from "./ClayMirrorTestUtils"

@component
export class CM_5_DoneScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const hand = LeafHandInteractor.get("right")
    m.applyDrag(0.85, -1.5, 0) // a neck, roughly toward the target
    m.applyDrag(0.4, 1.0, 0)
    await sleep(200)
    expect(m.scoreUI.liveVisible).toBe(false) // the % stays hidden while sculpting; revealed after Done
    const live = m.liveMatchPercent

    // Sample the displayed score + skill bar every frame from the moment results appear.
    const samples: {t: number; score: number; bar: number; grade: string}[] = []
    let tDone = -1
    const ev = this.createEvent("UpdateEvent")
    ev.bind(() => {
      if (m.phase === "results") {
        if (tDone < 0) tDone = getTime()
        samples.push({t: getTime() - tDone, score: m.scoreUI.displayedScore, bar: m.scoreUI.skillBarValue, grade: m.scoreUI.gradeLabel})
      }
    })
    await pinch(hand, interactableOf(m.controlsUI.doneButtonObject, "Done"))
    await sleep(100)
    const r = m.lastResult
    expect(m.phase).toBe("results")
    expect(m.scoreUI.resultsVisible).toBe(true)
    expect(m.scoreUI.liveVisible).toBe(false)
    expect(r === null).toBe(false)
    expect(Math.abs(r.score - Math.round(live))).toBeLessThan(1.01)
    expect(m.isWheelSpinning).toBe(false)

    // Wait for the full reveal (count-up → grade → bonuses → skill bar).
    await waitUntil(() => m.scoreUI.isRevealComplete, 10000, () => "reveal never completed")
    await sleep(200)

    // Count-up: starts low, rises through intermediate values, never overshoots, ends on the score.
    const first = samples[0]
    const distinct = new Set(samples.map((s) => s.score)).size
    let monotonic = true
    for (let i = 1; i < samples.length; i++) if (samples[i].score < samples[i - 1].score) monotonic = false
    const landAt = samples.find((s) => s.score === r.score)
    log(`5: count-up first=${first.score} distinct=${distinct} monotonic=${monotonic} lands at +${landAt ? landAt.t.toFixed(2) : "never"} s`)
    expect(first.score).toBeLessThan(Math.max(1, r.score * 0.5))
    expect(distinct).toBeGreaterThan(5)
    expect(monotonic).toBe(true)
    expect(landAt !== undefined).toBe(true)
    expect(landAt.t).toBeGreaterThan(0.8)
    expect(m.scoreUI.scoreLabel).toBe(`${r.score}%`)

    // Grade word appears only once the count has landed, and matches the band.
    const firstGrade = samples.find((s) => s.grade.length > 0)
    const expected = gradeFor(r.score).label
    log(`5: grade='${m.scoreUI.gradeLabel}' expected='${expected}' first shown at +${firstGrade ? firstGrade.t.toFixed(2) : "never"} s with score ${firstGrade ? firstGrade.score : -1}`)
    expect(m.scoreUI.gradeLabel).toBe(expected)
    expect(firstGrade !== undefined && firstGrade.score === r.score).toBe(true)

    // Bonuses.
    log(`5: bonuses=${JSON.stringify(m.scoreUI.bonusLabels)} result=${JSON.stringify(r)}`)
    expect(m.scoreUI.bonusLabels.length).toBeGreaterThan(0)
    expect(r.bonuses.length).toBeGreaterThan(0) // fresh round: Steady Hands + Clean Throw at least

    // Results stand where the target vase was (inspector's board on the stand; vase hidden).
    const score = m.scoreUI.getBoardWorldPosition()
    const vase = m.target.getSceneObject().getTransform().getWorldPosition()
    log(`5: board ${fmt(score)} target stand ${fmt(vase)} vaseVisible=${m.target.vaseVisible}`)
    expect(m.target.vaseVisible).toBe(false)
    expect(score.y).toBeGreaterThan(vase.y + m.target.standTopCm + 10)
    expect(Math.sqrt((score.x - vase.x) ** 2 + (score.z - vase.z) ** 2)).toBeLessThan(5)

    // Skill bar goes up when the player pinches Collect (after the grade is revealed).
    expect(m.scoreUI.isCollectVisible).toBe(true)
    await pinch(hand, interactableOf(m.scoreUI.collectButtonObject, "Collect"))
    await sleep(900)
    ev.enabled = false
    const barEarly = samples[0].bar
    const barLate = m.scoreUI.skillBarValue
    const firstFill = samples.find((x) => x.bar > barEarly + 1e-4)
    log(`5: skill bar ${barEarly.toFixed(3)} -> ${barLate.toFixed(3)} fill starts at +${firstFill ? firstFill.t.toFixed(2) : "never"} s (barTo=${r.barTo.toFixed(3)})`)
    expect(barLate).toBeGreaterThan(barEarly + 0.05)
    expect(barLate).toBeCloseTo(Math.max(0.02, r.barTo), 1)
    if (firstFill && firstGrade) expect(firstFill.t).toBeGreaterThan(firstGrade.t)
    await hand.hand.hide()
  }
}
