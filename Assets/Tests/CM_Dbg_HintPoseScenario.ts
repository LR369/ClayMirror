/**
 * Debug helper (not a criterion): play one round up to the wipe step, park the sponge on the
 * wheel and keep the suds frothing for a while so the preview can be screenshotted
 * (suds + progress sign in one view).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, setupPlayWithClayOnWheel, waitForGame, waitUntil} from "./ClayMirrorTestUtils"

@component
export class CM_Dbg_HintPoseScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    await setupPlayWithClayOnWheel(m)
    m.applyDrag(0.5, -0.5, 0)
    m.pressDone()
    await waitUntil(() => m.scoreUI.isRevealComplete, 8000)
    m.pressCollect()
    await waitUntil(() => m.phase === "wipe", 4000)
    const head = m.clay.clayAnchor.getTransform().getWorldPosition()
    const sponge = m.sponge.spongeObject.getTransform()
    sponge.setWorldPosition(new vec3(head.x + 3, head.y + 1.8, head.z + 2))
    m.wipeWheel(25) // part-cleaned smear
    let left = 25
    m.createEvent("UpdateEvent").bind(() => {
      if (left <= 0) return
      left -= getDeltaTime()
      const t = getTime()
      const p = new vec3(head.x + 3 + Math.sin(t * 5) * 4, head.y + 1.8, head.z + 2)
      sponge.setWorldPosition(p)
      m.effects.suds(new vec3(p.x, head.y + 0.3, p.z), 4.5)
    })
    await sleep(800)
    log(`dbg: phase=${m.phase} suds=${m.effects.sudsCount} sign='${m.progressSign.titleLabel}' lv=${m.progressSign.levelLabel} xp='${m.progressSign.xpLabel}'`)
  }
}
