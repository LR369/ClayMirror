/**
 * Criterion 3 — the clay's shape changes while you're dragging, not only after release.
 * Input: REAL hand pinch-drag on the spinning clay (setup via hooks: Start + drop).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {dragUntil, interactableByObjectName, log, maxAbsDiff, setupPlayWithClayOnWheel, waitForGame} from "./ClayMirrorTestUtils"

@component
export class CM_3_LiveDeformScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const hand = LeafHandInteractor.get("right")
    const c = m.clay

    let moved = 0
    let shapeChanged = 0
    let strokeStart = 0
    let strokeEnd = 0
    c.onDragMoved.add(() => moved++)
    c.onShapeChanged.add(() => shapeChanged++)
    c.onStrokeStart.add(() => strokeStart++)
    c.onStrokeEnd.add(() => strokeEnd++)

    const initial = m.clayRadii
    let sculptingSamples = 0
    let changedWhileHeld = 0
    let maxDiffWhileHeld = 0
    const stepsSeen: number[] = []

    await dragUntil(
      hand,
      interactableByObjectName("ClayHit"),
      new vec3(-0.04, 0, 0),
      2000,
      () => Math.min(...m.clayRadii) < 4.5, // stop before any collapse risk
      () => {
        if (c.isSculpting) {
          sculptingSamples++
          const d = maxAbsDiff(m.clayRadii, initial)
          if (d > 0.01) changedWhileHeld++
          maxDiffWhileHeld = Math.max(maxDiffWhileHeld, d)
          if (stepsSeen.length < 200) stepsSeen.push(moved)
        }
      },
    )
    const sculptingAfterRelease = c.isSculpting
    await sleep(300)
    const distinctSteps = stepsSeen.filter((v, i) => i === 0 || v !== stepsSeen[i - 1]).length
    log(`3: samples while held=${sculptingSamples}, changed-while-held=${changedWhileHeld}, maxDiff=${maxDiffWhileHeld.toFixed(3)}, onDragMoved=${moved}, onShapeChanged=${shapeChanged}, distinct drag steps while held=${distinctSteps}, strokeStart=${strokeStart}, strokeEnd=${strokeEnd}, sculptingAfterRelease=${sculptingAfterRelease}`)

    expect(strokeStart).toBe(1)
    expect(sculptingSamples).toBeGreaterThan(5)
    expect(changedWhileHeld).toBeGreaterThan(0) // shape differed from the start while still pinched
    expect(moved).toBeGreaterThan(1) // continuous per-frame updates, not one on release
    expect(shapeChanged).toBeGreaterThan(1)
    expect(distinctSteps).toBeGreaterThan(2)
    expect(strokeEnd).toBe(1)
    expect(c.isSculpting).toBe(false)
    expect(c.isCollapsed).toBe(false)
    await hand.hand.hide()
  }
}
