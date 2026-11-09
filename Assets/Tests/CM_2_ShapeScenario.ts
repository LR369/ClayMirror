/**
 * Criterion 2 — dragging inward narrows the clay all the way round at that height; outward
 * widens it; up makes it taller.
 * Input: HOOK applyDrag (the exact numeric path the hand drag calls each frame) for precise
 * values, plus one REAL inward hand drag that must narrow the pinched height.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {dragUntil, interactableByObjectName, log, setupPlayWithClayOnWheel, waitForGame} from "./ClayMirrorTestUtils"

@component
export class CM_2_ShapeScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const c = m.clay

    // Fresh block: 6 cm radius everywhere, 15 cm tall.
    expect(c.radiusAtNorm(0.5)).toBeCloseTo(6.0, 2)
    expect(m.clayHeightCm).toBeCloseTo(15, 2)

    // Inward at mid-height.
    const bottom0 = c.radiusAtNorm(0.05)
    const top0 = c.radiusAtNorm(0.95)
    expect(m.applyDrag(0.5, -1.5, 0)).toBe("ok")
    const mid1 = c.radiusAtNorm(0.5)
    log(`2: inward mid 6.0 -> ${mid1.toFixed(3)}; bottom ${bottom0.toFixed(2)} -> ${c.radiusAtNorm(0.05).toFixed(2)}; top ${top0.toFixed(2)} -> ${c.radiusAtNorm(0.95).toFixed(2)}`)
    expect(mid1).toBeCloseTo(4.5, 2)
    // "All the way round at that height": the model is a per-height ring profile (one radius
    // per height, so a change is rotationally symmetric) and far heights are ~unchanged.
    expect(Math.abs(c.radiusAtNorm(0.05) - bottom0)).toBeLessThan(0.1)
    expect(Math.abs(c.radiusAtNorm(0.95) - top0)).toBeLessThan(0.1)
    expect(c.radiusAtNorm(0.5)).toBeLessThan(c.radiusAtNorm(0.2))

    // Outward widens.
    const before = c.radiusAtNorm(0.3)
    expect(m.applyDrag(0.3, 1.0, 0)).toBe("ok")
    log(`2: outward h0.3 ${before.toFixed(3)} -> ${c.radiusAtNorm(0.3).toFixed(3)}`)
    expect(c.radiusAtNorm(0.3)).toBeGreaterThan(before + 0.5)

    // Up makes it taller.
    const h0 = m.clayHeightCm
    expect(m.applyDrag(0.8, 0, 3)).toBe("ok")
    log(`2: up height ${h0.toFixed(2)} -> ${m.clayHeightCm.toFixed(2)}`)
    expect(m.clayHeightCm).toBeCloseTo(h0 + 3, 2)

    // Real hand drag inward (right side of the clay, move left) narrows the pinched height.
    const hand = LeafHandInteractor.get("right")
    const midBefore = c.radiusAtNorm(0.5)
    const minBefore = Math.min(...m.clayRadii)
    await dragUntil(hand, interactableByObjectName("ClayHit"), new vec3(-0.05, 0, 0), 1500, () =>
      Math.min(...m.clayRadii) < minBefore - 0.8,
    )
    await sleep(300)
    const radiiAfter = m.clayRadii
    let minIdx = 0
    for (let i = 1; i < radiiAfter.length; i++) if (radiiAfter[i] < radiiAfter[minIdx]) minIdx = i
    log(`2: real inward drag: min radius ${minBefore.toFixed(2)} -> ${Math.min(...radiiAfter).toFixed(2)} at ring ${minIdx}; mid ${midBefore.toFixed(2)} -> ${c.radiusAtNorm(0.5).toFixed(2)}; collapsed=${c.isCollapsed}`)
    expect(c.isCollapsed).toBe(false)
    expect(Math.min(...radiiAfter)).toBeLessThan(minBefore - 0.2)
    await hand.hand.hide()
  }
}
