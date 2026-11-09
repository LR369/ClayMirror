/**
 * Criterion 11 (feedback round) — a list of 10 wheel items, easiest → hardest; each round moves
 * on to the next, and after the 10th the set ends on the potter's certificate. Every item is
 * makeable on the wheel (no part thinner than the collapse limit, not taller than the height limit).
 * Input: hooks only (round loop via pressDone + pressNextVase).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TARGET_PROFILES, targetHeight, targetRadiusAt} from "../Scripts/ClayMirrorClayModel"
import {log, setupPlayWithClayOnWheel, waitForGame} from "./ClayMirrorTestUtils"

const EXPECTED = ["Mug", "Flower Pot", "Bowl", "Round Pot", "Classic Vase", "Jug", "Tall Bottle", "Goblet", "Candlestick", "Urn"]

@component
export class CM_11_ItemsScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    expect(TARGET_PROFILES.length).toBe(10)
    const cfg = m.clay.model.config
    for (const t of TARGET_PROFILES) {
      const H = targetHeight(t)
      let minR = 99
      for (let k = 0; k <= 100; k++) minR = Math.min(minR, targetRadiusAt(t, (k / 100) * H))
      log(`11: ${t.name} H=${H} minR=${minR.toFixed(2)}`)
      expect(H).toBeLessThan(cfg.maxHeightCm)
      expect(minR).toBeGreaterThan(cfg.minRadiusCm + 0.5)
    }

    const seen: string[] = []
    for (let i = 0; i < 10; i++) {
      await setupPlayWithClayOnWheel(m)
      seen.push(m.itemName)
      m.pressDone()
      await sleep(100)
      m.pressNextVase()
      await sleep(100)
      expect(m.phase).toBe(i < 9 ? "play" : "complete")
    }
    log(`11: order ${seen.join(" → ")}`)
    for (let i = 0; i < 10; i++) expect(seen[i]).toBe(EXPECTED[i])
    expect(m.setScores.length).toBe(10)
  }
}
