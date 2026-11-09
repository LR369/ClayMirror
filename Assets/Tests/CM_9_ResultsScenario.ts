/**
 * Criterion 9 (feedback round) — after Done the finished piece rises off the wheel with stars
 * and sparkles; the inspector's board stands where the target vase was (vase hidden) showing
 * the item, score and grade; pinching Collect fills the skill bar, then the piece pops away
 * and the game asks you to wipe the wheel with the sponge.
 * Input: setup via hooks; Collect is a REAL pinch.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {fmt, interactableOf, log, pinch, setupPlayWithClayOnWheel, waitForGame, waitUntil} from "./ClayMirrorTestUtils"

@component
export class CM_9_ResultsScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const hand = LeafHandInteractor.get("right")
    m.applyDrag(0.5, -0.8, 0)
    await sleep(200)
    expect(m.target.vaseVisible).toBe(true)
    const stand = m.target.getSceneObject().getTransform().getWorldPosition()
    const pieceBefore = m.clay.getPieceCenterWorld()

    m.pressDone()
    // Piece rises and turns; stars fly.
    await sleep(1500)
    const lift = m.clay.presentLiftCm
    const pieceAfter = m.clay.getPieceCenterWorld()
    log(`9: lift=${lift.toFixed(1)} piece y ${pieceBefore.y.toFixed(1)} -> ${pieceAfter.y.toFixed(1)} presenting=${m.clay.isPresenting} twinkling=${m.effects.isTwinkling} particles=${m.effects.activeParticles}`)
    expect(m.phase).toBe("results")
    expect(lift).toBeGreaterThan(6)
    expect(pieceAfter.y - pieceBefore.y).toBeGreaterThan(6)
    expect(m.effects.isTwinkling).toBe(true)
    expect(m.effects.activeParticles).toBeGreaterThan(0)

    // Inspector's board stands where the target was.
    expect(m.target.vaseVisible).toBe(false)
    const board = m.scoreUI.getBoardWorldPosition()
    log(`9: board ${fmt(board)} stand ${fmt(stand)} item='${m.scoreUI.itemLabel}'`)
    expect(Math.sqrt((board.x - stand.x) ** 2 + (board.z - stand.z) ** 2)).toBeLessThan(5)
    expect(board.y).toBeGreaterThan(stand.y + m.target.standTopCm)
    expect(m.scoreUI.itemLabel).toBe("Item 1 of 10 · Mug")

    // Grade reveal fires a star burst.
    await waitUntil(() => m.scoreUI.isRevealComplete, 8000, () => "reveal never completed")
    const bursts = m.effects.burstCount
    log(`9: grade='${m.scoreUI.gradeLabel}' bursts=${bursts} collect='${m.scoreUI.collectButtonLabel}'`)
    expect(bursts).toBeGreaterThan(0)
    expect(m.scoreUI.isCollectVisible).toBe(true)
    expect(m.scoreUI.collectButtonLabel).toBe(`Collect +${m.lastResult.totalXp} XP`)

    // Real pinch on Collect: bar fills, then on to wiping.
    const barBefore = m.scoreUI.skillBarValue
    await pinch(hand, interactableOf(m.scoreUI.collectButtonObject, "Collect"))
    await sleep(500)
    expect(m.scoreUI.isCollected).toBe(true)
    await waitUntil(() => m.phase === "wipe", 4000, () => `phase=${m.phase}`)
    const barAfter = m.scoreUI.skillBarValue
    await sleep(600)
    log(`9: bar ${barBefore.toFixed(3)} -> ${barAfter.toFixed(3)} phase=${m.phase} dirty=${m.isWheelDirty} spongeActive=${m.sponge.isWipeActive} pieceVisible=${m.clay.isPieceVisible} hint=${m.hintId}`)
    expect(barAfter).toBeGreaterThan(barBefore + 0.05)
    expect(m.scoreUI.resultsVisible).toBe(false)
    expect(m.clay.isPieceVisible).toBe(false)
    expect(m.isWheelDirty).toBe(true)
    expect(m.sponge.isWipeActive).toBe(true)
    expect(m.hintId).toBe("wipe")
    await hand.hand.hide()
  }
}
