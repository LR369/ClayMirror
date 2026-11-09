/**
 * Criterion 6 — aiming at the clay shows a glowing ring at that height; dragging plays a
 * clay squish sound (and the ring brightens while pinching).
 * Input: REAL hand hover and REAL hand pinch-drag (setup via hooks).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {dragUntil, interactableByObjectName, log, setupPlayWithClayOnWheel, waitForGame, expectRange} from "./ClayMirrorTestUtils"

@component
export class CM_6_RingSquishScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const hand = LeafHandInteractor.get("right")
    const c = m.clay
    const hit = interactableByObjectName("ClayHit")
    expect(c.ringVisible).toBe(false)

    // Aim (hover) at the clay.
    let seenVisible = false
    let seenBrightOnHover = false
    let ringH = -1
    const hoverP = hand.hover(hit, 1500)
    for (let i = 0; i < 12; i++) {
      await sleep(100)
      if (c.ringVisible) {
        seenVisible = true
        ringH = c.ringHeightCm
        if (c.ringBright) seenBrightOnHover = true
      }
    }
    await hoverP
    const ringObj = m.clay.pinchRingObject
    log(`6: hover ring visible=${seenVisible} bright=${seenBrightOnHover} height=${ringH.toFixed(2)} (clay h=${m.clayHeightCm})`)
    expect(seenVisible).toBe(true)
    expect(seenBrightOnHover).toBe(false)
    expectRange(ringH, 0, m.clayHeightCm, "ringH")

    // Pinch-drag: ring brightens, squish plays.
    const squish0 = m.audio.squishPlayCount
    let brightWhileHeld = false
    let ringEnabledWhileHeld = false
    await dragUntil(
      hand,
      hit,
      new vec3(-0.04, 0, 0),
      1500,
      () => Math.min(...m.clayRadii) < 4.8,
      () => {
        if (c.isSculpting && c.ringBright) brightWhileHeld = true
        if (c.isSculpting && ringObj.enabled) ringEnabledWhileHeld = true
      },
    )
    await sleep(200)
    const squish1 = m.audio.squishPlayCount
    log(`6: drag ring bright=${brightWhileHeld} ringObjEnabled=${ringEnabledWhileHeld} squish ${squish0} -> ${squish1}`)
    expect(brightWhileHeld).toBe(true)
    expect(ringEnabledWhileHeld).toBe(true)
    expect(squish1).toBeGreaterThan(squish0)
    await hand.hand.hide()
  }
}
