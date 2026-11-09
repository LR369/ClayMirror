/**
 * Criterion 7 — dragging inward too far collapses the clay into a blob at the bottom of the
 * wheel; pinching Start Over at any time gives a fresh block.
 * Input: collapse via HOOK applyDrag (a single -20 cm drag); Start Over is a REAL pinch.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {fmt, interactableOf, log, setupPlayWithClayOnWheel, waitForGame, pinch} from "./ClayMirrorTestUtils"

@component
export class CM_7_CollapseScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const hand = LeafHandInteractor.get("right")
    const c = m.clay
    let collapsed = 0
    c.onCollapsed.add(() => collapsed++)

    const res = m.applyDrag(0.5, -20, 0)
    await sleep(200)
    const radii = m.clayRadii
    log(`7: result=${res} collapsed=${c.isCollapsed} h=${m.clayHeightCm} bottomR=${radii[0].toFixed(2)} topR=${radii[radii.length - 1].toFixed(2)} parent=${c.getSceneObject().getParent().name}`)
    expect(res).toBe("collapsed")
    expect(collapsed).toBe(1)
    expect(c.isCollapsed).toBe(true)
    expect(m.clayHeightCm).toBeCloseTo(9, 3)
    expect(radii[0]).toBeGreaterThan(radii[Math.floor(radii.length * 0.8)]) // wide blob base, lump on top
    expect(m.isClayOnWheel).toBe(true) // stays at the bottom of the wheel
    expect(c.getSceneObject().getParent().name).toBe("ClayAnchor")
    // Further drags are ignored on a blob.
    expect(m.applyDrag(0.5, -1, 0)).toBe("ignored")

    // Real pinch on Start Over → fresh block on the bench.
    expect(m.controlsUI.startOverVisible).toBe(true)
    await pinch(hand, interactableOf(m.controlsUI.startOverButtonObject, "StartOver"))
    await sleep(300)
    const p = c.getSceneObject().getTransform().getWorldPosition()
    log(`7: after Start Over onWheel=${m.isClayOnWheel} collapsed=${c.isCollapsed} h=${m.clayHeightCm} parent=${c.getSceneObject().getParent().name} pos=${fmt(p)}`)
    expect(m.isClayOnWheel).toBe(false)
    expect(c.isCollapsed).toBe(false)
    expect(m.clayHeightCm).toBeCloseTo(15, 3)
    expect(Math.min(...m.clayRadii)).toBeCloseTo(6, 3)
    expect(Math.max(...m.clayRadii)).toBeCloseTo(6, 3)
    expect(c.getSceneObject().getParent().name).toBe("ClayRest")
    expect(m.phase).toBe("play")
    expect(c.grabEnabled).toBe(true)

    // "At any time": Start Over also works mid-sculpt (not collapsed).
    m.dropClayOnWheel()
    m.applyDrag(0.5, -1, 0)
    await pinch(hand, interactableOf(m.controlsUI.startOverButtonObject, "StartOver"))
    await sleep(300)
    expect(m.isClayOnWheel).toBe(false)
    expect(Math.min(...m.clayRadii)).toBeCloseTo(6, 3)
    await hand.hand.hide()
  }
}
