/**
 * Criterion 10 (feedback round) — the bucket hangs on a hook off the bench's front edge; after
 * collecting, grabbing the sponge and scrubbing it across the wheel cleans the smear, the
 * sponge goes back to its bucket, the next item appears on the stand and a fresh clay block
 * sits beside the wheel (right side).
 * Input: setup via hooks; the sponge grab + scrub is a REAL drag.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {fmt, interactableOf, log, setupPlayWithClayOnWheel, waitForGame, waitUntil} from "./ClayMirrorTestUtils"

@component
export class CM_10_WipeScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    const hand = LeafHandInteractor.get("right")

    // Bucket + sponge hang off the front edge (below the bench top, in front of it).
    const bench = m.placement.getSceneObject().getTransform()
    const spongeSO = m.sponge.spongeObject
    const restWorld = spongeSO.getTransform().getWorldPosition()
    const restLocal = bench.getInvertedWorldTransform().multiplyPoint(restWorld)
    log(`10: sponge rest bench-local ${fmt(restLocal)}`)
    expect(restLocal.y).toBeLessThan(0) // below the bench top
    expect(restLocal.z).toBeGreaterThan(30) // in front of the front edge (bench is 60 deep)
    expect(m.sponge.isWipeActive).toBe(false)

    // Get to the wipe step.
    m.pressDone()
    await waitUntil(() => m.scoreUI.isRevealComplete, 8000)
    m.pressCollect()
    await waitUntil(() => m.phase === "wipe", 4000, () => `phase=${m.phase}`)
    expect(m.isWheelDirty).toBe(true)
    const itemBefore = m.itemIndex

    // Real drag: carry the sponge onto the wheel head, then scrub side to side until clean.
    const anchor = m.clay.clayAnchor.getTransform().getWorldPosition()
    const target = new vec3(anchor.x, anchor.y + 2, anchor.z)
    const it = interactableOf(spongeSO, "Sponge")
    const d0 = target.sub(spongeSO.getTransform().getWorldPosition()).normalize().uniformScale(0.9)
    const v = new vec3(d0.x, d0.y, d0.z)
    let grabbed = 0
    m.sponge.spongeObject.getComponent(InteractableManipulation.getTypeName()) && (m.sponge.spongeObject.getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation).onManipulationStart.add(() => grabbed++)
    let updates = 0
    let onWheelUpdates = 0
    let scrubDir = 1
    let wipeMoves = 0
    m.sponge.onWipeMoved.add(() => wipeMoves++)
    const unsub = it.onDragUpdate.add(() => {
      updates++
      const p = spongeSO.getTransform().getWorldPosition()
      if (updates % 20 === 1) log(`10: u${updates} sponge=${fmt(p)} held=${m.sponge.isHeld} progress=${m.sponge.wipeProgress.toFixed(2)} dirty=${m.isWheelDirty} v=${fmt(v)}`)
      const toT = target.sub(p)
      const horiz = Math.sqrt(toT.x * toT.x + toT.z * toT.z)
      if (!m.isWheelDirty) {
        v.x = 0
        v.y = 0
        v.z = 0
        return
      }
      if (horiz > 6 || Math.abs(toT.y) > 4) {
        const d = toT.normalize().uniformScale(0.9)
        v.x = d.x
        v.y = d.y
        v.z = d.z
      } else {
        onWheelUpdates++
        if (onWheelUpdates % 12 === 0) scrubDir = -scrubDir
        v.x = 0.9 * scrubDir
        v.y = 0
        v.z = 0
      }
    }) as unknown as () => void
    try {
      // LEAF's drag promise can stay pending after the sponge snaps back to its bucket; the
      // outcome we care about is the wheel getting clean, so wait on that instead.
      const dragDone = hand.drag(it, v, 7000)
      await waitUntil(() => !m.isWheelDirty, 12000, () => `wipe progress=${m.sponge.wipeProgress.toFixed(2)}`)
      await Promise.race([dragDone, sleep(2500)])
    } finally {
      if (typeof unsub === "function") unsub()
      log(`10: (finally) updates=${updates} grabbed=${grabbed} held=${m.sponge.isHeld} onWheel=${onWheelUpdates} sponge=${fmt(spongeSO.getTransform().getWorldPosition())} target=${fmt(target)}`)
    }
    log(`10: drag updates=${updates} onWheel=${onWheelUpdates} wipeMoves=${wipeMoves} progress=${m.sponge.wipeProgress.toFixed(2)} dirty=${m.isWheelDirty} phase=${m.phase}`)
    expect(wipeMoves).toBeGreaterThan(3)
    log(`10: suds bubbles=${m.effects.sudsCount}`)
    expect(m.effects.sudsCount).toBeGreaterThan(10) // suds froth while scrubbing
    expect(m.isWheelDirty).toBe(false)
    await waitUntil(() => m.phase === "play", 2000, () => `phase=${m.phase}`)

    // Next item on the stand, fresh block beside the wheel (right side), sponge back home.
    await sleep(800)
    const spongeNow = spongeSO.getTransform().getWorldPosition()
    const clayLocal = bench.getInvertedWorldTransform().multiplyPoint(m.clay.getSceneObject().getTransform().getWorldPosition())
    log(`10: item ${itemBefore} -> ${m.itemIndex} (${m.itemName}) vase=${m.target.vaseVisible} clayOnWheel=${m.isClayOnWheel} clay bench-local ${fmt(clayLocal)} sponge back dist=${spongeNow.distance(restWorld).toFixed(2)}`)
    expect(m.itemIndex).toBe(itemBefore + 1)
    expect(m.target.vaseVisible).toBe(true)
    expect(m.isClayOnWheel).toBe(false)
    expect(m.clay.isPieceVisible).toBe(true)
    expect(clayLocal.x).toBeGreaterThan(15) // right of the wheel
    expect(m.sponge.isWipeActive).toBe(false)
    expect(spongeNow.distance(restWorld)).toBeLessThan(1)
    await hand.hand.hide()
  }
}
