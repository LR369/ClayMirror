/**
 * Criterion 4 — pinching Undo reverses the last change to the clay.
 * Input: setup + the changes via hooks; Undo is a REAL pinch on the Undo button.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {interactableOf, log, maxAbsDiff, setupPlayWithClayOnWheel, waitForGame, pinch} from "./ClayMirrorTestUtils"

@component
export class CM_4_UndoScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const hand = LeafHandInteractor.get("right")

    // Change 1, then change 2.
    m.applyDrag(0.3, -1.0, 0)
    const afterFirst = m.clayRadii
    const hFirst = m.clayHeightCm
    m.applyDrag(0.7, 1.2, 2)
    const afterSecond = m.clayRadii
    expect(maxAbsDiff(afterSecond, afterFirst)).toBeGreaterThan(0.3)
    expect(m.controlsUI.undoVisible).toBe(true)

    const undoBtn = interactableOf(m.controlsUI.undoButtonObject, "Undo")
    await pinch(hand, undoBtn)
    await sleep(300)
    log(`4: after 1st Undo diff-to-first=${maxAbsDiff(m.clayRadii, afterFirst).toFixed(4)} height=${m.clayHeightCm.toFixed(2)} (expected ${hFirst.toFixed(2)})`)
    expect(maxAbsDiff(m.clayRadii, afterFirst)).toBeLessThan(0.001)
    expect(m.clayHeightCm).toBeCloseTo(hFirst, 3)

    // Undo again → fresh block.
    await pinch(hand, undoBtn)
    await sleep(300)
    log(`4: after 2nd Undo min=${Math.min(...m.clayRadii).toFixed(3)} max=${Math.max(...m.clayRadii).toFixed(3)} h=${m.clayHeightCm}`)
    expect(Math.min(...m.clayRadii)).toBeCloseTo(6, 3)
    expect(Math.max(...m.clayRadii)).toBeCloseTo(6, 3)
    expect(m.clayHeightCm).toBeCloseTo(15, 3)
    await hand.hand.hide()
  }
}
