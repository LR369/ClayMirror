/**
 * Criterion A — bench appears in front at table height with the wheel still; dragging the
 * bench moves it with everything on it; the height slider raises/lowers it; pinching Start
 * starts the wheel and hides the slider + Start.
 * Input: REAL (LEAF right hand) for bench drag, slider drag and Start pinch.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {dragUntil, fmt, interactableByObjectName, interactableOf, log, waitForGame, expectRange, pinch} from "./ClayMirrorTestUtils"

@component
export class CM_A_PlacementScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    const hand = LeafHandInteractor.get("right")

    // 1. Startup: placement mode, wheel still, bench in front at table height.
    expect(m.phase).toBe("placement")
    expect(m.isPlacementMode).toBe(true)
    expect(m.isWheelSpinning).toBe(false)
    expect(m.placementUI.isVisible).toBe(true)
    const cam = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
    const bench0 = m.placement.getBenchWorldPosition()
    const horiz = Math.sqrt((bench0.x - cam.x) ** 2 + (bench0.z - cam.z) ** 2)
    log(`A: cam ${fmt(cam)} bench ${fmt(bench0)} horiz=${horiz.toFixed(1)} height=${m.placement.benchHeightCm}`)
    expectRange(m.placement.benchHeightCm, 55, 110, "m.placement.benchHeightCm")
    expectRange(cam.y - bench0.y, 70, 80, "cam.y - bench0.y") // eye 150 - top 75
    expectRange(horiz, 60, 80, "horiz") // front edge 40 + depth/2 30

    // 2. Real drag of the bench top: bench and wheel move together.
    const wheelSO = m.wheel.getSceneObject()
    const wheel0 = wheelSO.getTransform().getWorldPosition()
    const benchGrab = interactableByObjectName("BenchGrab")
    await dragUntil(hand, benchGrab, new vec3(0.6, 0, 0), 1500, () => {
      const p = m.placement.getBenchWorldPosition()
      return Math.abs(p.x - bench0.x) >= 12
    })
    await sleep(300)
    const bench1 = m.placement.getBenchWorldPosition()
    const wheel1 = wheelSO.getTransform().getWorldPosition()
    const benchMove = bench1.sub(bench0)
    log(`A: bench moved ${fmt(benchMove)}; wheel moved ${fmt(wheel1.sub(wheel0))}`)
    expect(benchMove.length).toBeGreaterThan(5)
    expect(Math.abs(bench1.y - bench0.y)).toBeLessThan(0.5) // stays level at its height
    // Wheel keeps the same offset from the bench in the bench's own frame (it travels with it; the
    // bench also yaws to keep its front edge facing the user, so compare in bench-local space).
    const benchT = m.placement.getSceneObject().getTransform()
    const local1 = benchT.getInvertedWorldTransform().multiplyPoint(wheel1)
    const local0 = wheelSO.getTransform().getLocalPosition()
    log(`A: wheel in bench frame ${fmt(local1)} (authored ${fmt(local0)})`)
    expect(local1.distance(local0)).toBeLessThan(0.5)

    // 3. Real drag of the height slider: bench top height changes by the same amount as Y.
    const h0 = m.placement.benchHeightCm
    const y0 = m.placement.getBenchWorldPosition().y
    const slider = interactableOf(m.placementUI.heightSlider.getSceneObject(), "HeightSlider")
    await dragUntil(hand, slider, new vec3(0.3, 0, 0), 1500, () => m.placement.benchHeightCm - h0 >= 8)
    await sleep(300)
    const h1 = m.placement.benchHeightCm
    const y1 = m.placement.getBenchWorldPosition().y
    log(`A: slider height ${h0.toFixed(1)} -> ${h1.toFixed(1)} cm; bench y ${y0.toFixed(1)} -> ${y1.toFixed(1)}`)
    expect(Math.abs(h1 - h0)).toBeGreaterThan(2)
    expect(Math.abs((y1 - y0) - (h1 - h0))).toBeLessThan(0.5)
    expectRange(h1, 55, 110, "h1")

    // 4. Real pinch on Start: wheel spins, slider + Start hidden.
    expect(m.isWheelSpinning).toBe(false)
    await pinch(hand, interactableOf(m.placementUI.startButtonObject, "Start"))
    await sleep(300)
    log(`A: after Start phase=${m.phase} spinning=${m.isWheelSpinning} placementUI=${m.placementUI.isVisible}`)
    expect(m.phase).toBe("play")
    expect(m.isPlacementMode).toBe(false)
    expect(m.isWheelSpinning).toBe(true)
    expect(m.placementUI.isVisible).toBe(false)
    expect(m.placementUI.getSceneObject().enabled).toBe(false)
    await hand.hand.hide()
  }
}
