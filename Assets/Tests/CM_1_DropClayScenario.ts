/**
 * Criterion 1 — grabbing the clay block and releasing it over the wheel places it on the
 * wheel, where it spins.
 * Input: Start via hook; the grab-carry-release of the clay is a REAL hand drag.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {dragUntil, fmt, interactableByObjectName, log, waitForGame} from "./ClayMirrorTestUtils"

@component
export class CM_1_DropClayScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    const hand = LeafHandInteractor.get("right")
    if (m.phase === "placement") m.pressStart()
    await sleep(300)
    expect(m.phase).toBe("play")
    expect(m.isClayOnWheel).toBe(false)
    expect(m.clay.grabEnabled).toBe(true)

    let landed = 0
    m.clay.onLanded.add(() => landed++)
    const claySO = m.clay.getSceneObject()
    const anchor = m.clay.clayAnchor.getTransform().getWorldPosition()
    const start = claySO.getTransform().getWorldPosition()
    log(`1: clay at ${fmt(start)}, wheel anchor at ${fmt(anchor)}`)

    // Carry the block toward the wheel centre (stop within ~3 cm horizontally), then release.
    // Grab, lift (to ~4 cm above the wheel head) and carry over the wheel, like a real hand would.
    const carry = new vec3(anchor.x - start.x, anchor.y + 4 - start.y, anchor.z - start.z)
    const dir = carry.normalize().uniformScale(0.8)
    const hit = interactableByObjectName("ClayHit")
    let updates = 0
    let maxMove = 0
    let minDist = 999
    let lastP = start
    await dragUntil(
      hand,
      hit,
      dir,
      2500,
      () => {
        if (m.isClayOnWheel) return true
        const p = claySO.getTransform().getWorldPosition()
        return Math.sqrt((p.x - anchor.x) ** 2 + (p.z - anchor.z) ** 2) < 3
      },
      () => {
        updates++
        const p = claySO.getTransform().getWorldPosition()
        lastP = p
        maxMove = Math.max(maxMove, p.distance(start))
        minDist = Math.min(minDist, Math.sqrt((p.x - anchor.x) ** 2 + (p.z - anchor.z) ** 2))
      },
    )
    log(`1: drag updates=${updates} maxMove=${maxMove.toFixed(1)} minHorizDistToWheel=${minDist.toFixed(1)} lastDuringDrag=${fmt(lastP)}`)
    await sleep(400)

    const end = claySO.getTransform().getWorldPosition()
    log(`1: released at ${fmt(end)} landed=${landed} onWheel=${m.isClayOnWheel} parent=${claySO.getParent().name}`)
    expect(landed).toBe(1)
    expect(m.isClayOnWheel).toBe(true)
    expect(claySO.getParent().name).toBe("ClayAnchor")
    expect(end.distance(m.clay.clayAnchor.getTransform().getWorldPosition())).toBeLessThan(0.5)
    expect(m.isWheelSpinning).toBe(true)

    // It spins: the clay visual's rotation follows the wheel head over time.
    const vis = claySO.getChild(0)
    const q0 = vis.getTransform().getLocalRotation()
    await sleep(300)
    const q1 = vis.getTransform().getLocalRotation()
    const dot = Math.abs(q0.x * q1.x + q0.y * q1.y + q0.z * q1.z + q0.w * q1.w)
    log(`1: visual '${vis.name}' rotation dot over 300ms = ${dot.toFixed(4)}`)
    expect(dot).toBeLessThan(0.9999)
    await hand.hand.hide()
  }
}
