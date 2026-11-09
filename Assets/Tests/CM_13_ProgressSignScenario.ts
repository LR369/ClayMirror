/**
 * Criterion 13 (feedback round) — a progress sign hangs on the bench's front edge under the clay:
 * "Piece n of 10 · name" with 10 progress dots, a level badge and an XP bar "x / 150 XP". It is
 * hidden while placing the bench, updates when you collect points, and moves on with each piece.
 * Input: hooks (Start, gear, Done, Collect, wipe).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {fmt, log, setupPlayWithClayOnWheel, waitForGame, waitUntil} from "./ClayMirrorTestUtils"

@component
export class CM_13_ProgressSignScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    const sign = m.progressSign
    expect(sign.isVisible).toBe(false) // placement mode

    await setupPlayWithClayOnWheel(m)
    const bench = m.placement.getSceneObject().getTransform()
    const signLocal = bench.getInvertedWorldTransform().multiplyPoint(sign.getSignObject().getTransform().getWorldPosition())
    const clayRest = bench.getInvertedWorldTransform().multiplyPoint(m.clay.restAnchor.getTransform().getWorldPosition())
    log(`13: sign bench-local ${fmt(signLocal)} clay rest ${fmt(clayRest)} title='${sign.titleLabel}' lv=${sign.levelLabel} xp='${sign.xpLabel}'`)
    expect(sign.isVisible).toBe(true)
    expect(Math.abs(signLocal.x - clayRest.x)).toBeLessThan(5) // under the clay
    expect(signLocal.y).toBeLessThan(0) // below the bench top
    expect(signLocal.z).toBeGreaterThan(30) // on the front edge
    expect(sign.titleLabel).toBe("Piece 1 of 10 · Mug")
    expect(sign.levelLabel).toBe("1")
    expect(sign.xpLabel).toBe("0 / 150 XP")

    // Gear → placement hides it; Start brings it back.
    m.pressGear()
    await sleep(100)
    expect(sign.isVisible).toBe(false)
    m.pressStart()
    await sleep(100)
    expect(sign.isVisible).toBe(true)

    // XP shows up on the sign when you collect.
    m.pressDone()
    await waitUntil(() => m.scoreUI.isRevealComplete, 8000)
    expect(sign.xpLabel).toBe("0 / 150 XP")
    m.pressCollect()
    await sleep(1200)
    const xp = m.state.xp
    log(`13: after collect xp=${xp} sign xp='${sign.xpLabel}' lv=${sign.levelLabel} bar=${sign.barFillValue.toFixed(2)}`)
    expect(sign.xpLabel).toBe(`${xp % 150} / 150 XP`)
    expect(sign.levelLabel).toBe(`${m.state.level}`)
    expect(sign.barFillValue).toBeGreaterThan(0.2)

    // Wipe → next piece on the sign.
    await waitUntil(() => m.phase === "wipe", 4000)
    m.wipeWheel(100)
    await waitUntil(() => m.phase === "play", 3000)
    log(`13: next title='${sign.titleLabel}'`)
    expect(sign.titleLabel).toBe("Piece 2 of 10 · Flower Pot")
    expect(sign.view.itemIndex).toBe(1)
  }
}
