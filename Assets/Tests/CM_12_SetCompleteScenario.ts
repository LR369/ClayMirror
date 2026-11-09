/**
 * Criterion 12 (feedback round) — after the 10th item a potter's certificate stands on the stand:
 * "Well done"/"Set complete", a rank (Apprentice → Master Potter), average + best piece, total XP,
 * "More pieces coming soon!" and a Play again button. Pinching Play again restarts at item 1
 * (Mug) with a fresh block; skill XP is kept.
 * Input: rounds via hooks; Play again is a REAL pinch.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {rankFor} from "../Scripts/ClayMirrorMain"
import {fmt, interactableOf, log, pinch, setupPlayWithClayOnWheel, waitForGame} from "./ClayMirrorTestUtils"

@component
export class CM_12_SetCompleteScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    const hand = LeafHandInteractor.get("right")
    for (let i = 0; i < 10; i++) {
      await setupPlayWithClayOnWheel(m)
      m.pressDone()
      await sleep(80)
      m.pressNextVase()
      await sleep(80)
    }
    await sleep(600)
    expect(m.phase).toBe("complete")
    expect(m.scoreUI.completeVisible).toBe(true)
    expect(m.target.vaseVisible).toBe(false)
    const scores = m.setScores
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    const board = m.scoreUI.getBoardWorldPosition()
    const stand = m.target.getSceneObject().getTransform().getWorldPosition()
    log(`12: title='${m.scoreUI.completeTitle}' rank='${m.scoreUI.completeRank}' stats='${m.scoreUI.completeStats}' avg=${avg} board ${fmt(board)} stand ${fmt(stand)}`)
    expect(m.scoreUI.completeRank).toBe(rankFor(avg, scores))
    expect(m.scoreUI.completeStats.indexOf(`Average ${avg}%`)).toBe(0)
    expect(m.scoreUI.completeTitle.length).toBeGreaterThan(0)
    expect(Math.sqrt((board.x - stand.x) ** 2 + (board.z - stand.z) ** 2)).toBeLessThan(5)
    expect(rankFor(95, [95, 92, 91])).toBe("Master Potter")
    expect(rankFor(95, [95, 80])).toBe("Skilled Potter")
    expect(rankFor(40, [40])).toBe("Apprentice Potter")

    // Real pinch on Play again → item 1, fresh block, XP kept.
    const xp = m.state.xp
    await pinch(hand, interactableOf(m.scoreUI.playAgainButtonObject, "PlayAgain"))
    await sleep(500)
    log(`12: after Play again phase=${m.phase} item=${m.itemName} xp ${xp} -> ${m.state.xp} complete=${m.scoreUI.completeVisible} vase=${m.target.vaseVisible}`)
    expect(m.phase).toBe("play")
    expect(m.itemIndex).toBe(0)
    expect(m.itemName).toBe("Mug")
    expect(m.scoreUI.completeVisible).toBe(false)
    expect(m.target.vaseVisible).toBe(true)
    expect(m.isClayOnWheel).toBe(false)
    expect(m.setScores.length).toBe(0)
    expect(m.state.xp).toBe(xp)
    await hand.hand.hide()
  }
}
