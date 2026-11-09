/**
 * Supplemental (not a done criterion) — IK reachability: a full-arm IK avatar pinches Start,
 * then Undo and Done on the bench. A reach that fails to converge is a placement finding.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {interactableOf, log, waitForGame} from "./ClayMirrorTestUtils"

@component
export class CM_IK_ReachScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    const m = await waitForGame()
    await this.ik.trigger(interactableOf(m.placementUI.startButtonObject, "Start"))
    await sleep(500)
    log(`IK: after Start phase=${m.phase}`)
    expect(m.phase).toBe("play")
    m.dropClayOnWheel()
    m.applyDrag(0.5, -1, 0)
    await sleep(300)
    const before = m.clayRadii[12]
    await this.ik.trigger(interactableOf(m.controlsUI.undoButtonObject, "Undo"))
    await sleep(500)
    log(`IK: undo r12 ${before.toFixed(2)} -> ${m.clayRadii[12].toFixed(2)}`)
    expect(m.clayRadii[12]).toBeCloseTo(6, 2)
    await this.ik.trigger(interactableOf(m.controlsUI.doneButtonObject, "Done"))
    await sleep(500)
    log(`IK: after Done phase=${m.phase}`)
    expect(m.phase).toBe("results")
  }
}
