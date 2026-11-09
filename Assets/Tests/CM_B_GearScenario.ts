/**
 * Criterion B — pinching the gear mid-round pauses the wheel, brings back the slider + Start,
 * and the clay keeps its shape; after moving the bench and pinching Start the wheel turns
 * again and you carry on sculpting the same piece.
 * Input: setup via hooks (Start, drop, one drag); gear, bench drag and Start are REAL pinches.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {dragUntil, fmt, interactableByObjectName, interactableOf, log, maxAbsDiff, setupPlayWithClayOnWheel, waitForGame, pinch} from "./ClayMirrorTestUtils"

@component
export class CM_B_GearScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    const hand = LeafHandInteractor.get("right")
    await setupPlayWithClayOnWheel(m)
    m.applyDrag(0.5, -1.2, 0)
    await sleep(200)
    const shape = m.clayRadii
    const height = m.clayHeightCm
    expect(m.isWheelSpinning).toBe(true)
    expect(m.gearUI.isVisible).toBe(true)

    // Real pinch on the gear.
    await pinch(hand, interactableOf(m.gearUI.gearButtonObject, "Gear"))
    await sleep(300)
    log(`B: after gear phase=${m.phase} spinning=${m.isWheelSpinning} placementUI=${m.placementUI.isVisible}`)
    expect(m.phase).toBe("placement")
    expect(m.isPlacementMode).toBe(true)
    expect(m.isWheelSpinning).toBe(false)
    expect(m.placementUI.isVisible).toBe(true)
    expect(m.gearUI.isVisible).toBe(false)
    expect(m.controlsUI.mode).toBe("hidden")
    expect(maxAbsDiff(m.clayRadii, shape)).toBeLessThan(0.001)
    expect(m.clayHeightCm).toBeCloseTo(height, 3)

    // Move the bench (real drag) while paused; clay stays on the wheel, same shape.
    const b0 = m.placement.getBenchWorldPosition()
    await dragUntil(hand, interactableByObjectName("BenchGrab"), new vec3(-0.6, 0, 0), 1500, () =>
      Math.abs(m.placement.getBenchWorldPosition().x - b0.x) >= 10,
    )
    await sleep(300)
    const b1 = m.placement.getBenchWorldPosition()
    log(`B: bench moved ${fmt(b1.sub(b0))}`)
    expect(b1.distance(b0)).toBeGreaterThan(5)
    expect(m.isClayOnWheel).toBe(true)
    expect(maxAbsDiff(m.clayRadii, shape)).toBeLessThan(0.001)

    // Real pinch on Start → resume.
    await pinch(hand, interactableOf(m.placementUI.startButtonObject, "Start"))
    await sleep(300)
    log(`B: after Start phase=${m.phase} spinning=${m.isWheelSpinning}`)
    expect(m.phase).toBe("play")
    expect(m.isWheelSpinning).toBe(true)
    expect(m.placementUI.isVisible).toBe(false)
    expect(m.isClayOnWheel).toBe(true)
    expect(maxAbsDiff(m.clayRadii, shape)).toBeLessThan(0.001)
    expect(m.controlsUI.mode).toBe("play")
    expect(m.clay.sculptEnabled).toBe(true)

    // Carry on sculpting the same piece.
    const r0 = m.clay.radiusAtNorm(0.3)
    expect(m.applyDrag(0.3, -0.5, 0)).toBe("ok")
    expect(m.clay.radiusAtNorm(0.3)).toBeLessThan(r0)
    await hand.hand.hide()
  }
}
