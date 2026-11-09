/**
 * Criterion 8 — FTUE hints: bench hint at the start (bobbing, white text, green neon border),
 * then a drop hint above the clay after Start, then a sculpt hint above the wheel once the
 * clay lands that goes away after the first drag. Hints never cover the clay, buttons or score.
 * MUST run on a fresh Lens (hints are shown once per session).
 * Input: Start is a REAL pinch; drop + first drag via hooks (real drop/drag covered by 1/3).
 * Overlap is checked in screen space from the current preview camera pose
 * (convex silhouettes: exact hint quad vs oriented visual boxes / clay lathe points; SAT test).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {ClayMirrorMain} from "../Scripts/ClayMirrorMain"
import {fmt, interactableOf, log, Poly, polySeparation, silhouetteOf, silhouetteOfLathe, silhouetteOfQuad, waitForGame, pinch} from "./ClayMirrorTestUtils"

@component
export class CM_8_HintsScenario extends Scenario {
  private overlaps: string[] = []
  private warnings: string[] = []

  /** One measurement: separation (screen units) of the hint quad from each element. */
  private measure(m: ClayMirrorMain): [string, number][] {
    const bob = m.hintUI.getSceneObject().getChild(0)
    if (!m.hintUI.getSceneObject().enabled) return []
    const hint = silhouetteOfQuad(bob.getTransform(), m.hintUI.widthCm, m.hintUI.heightCm)
    const clayBase = m.clay.getSceneObject().getTransform().getWorldPosition()
    const others: [string, Poly | null][] = [
      ["clay", silhouetteOfLathe(clayBase, m.clayRadii, m.clayHeightCm)],
      ["placement buttons (slider+Start)", silhouetteOf(m.placementUI.getSceneObject())],
      ["controls (StartOver/Undo/Done)", silhouetteOf(m.controlsUI.getSceneObject())],
      ["gear", silhouetteOf(m.gearUI.getSceneObject())],
      ["score/live %", silhouetteOf(m.scoreUI.getSceneObject())],
      ["target vase", silhouetteOf(findSceneObjectByName("TargetVase"))],
    ]
    const out: [string, number][] = []
    for (const [name, poly] of others) if (poly) out.push([name, polySeparation(hint, poly)])
    return out
  }

  /**
   * Worst case over one full bob cycle (2 s at 0.5 Hz): exact bubble quad vs convex silhouettes,
   * from the current preview camera. Separation in screen units; < 0 = overlap.
   */
  private async checkOverlap(m: ClayMirrorMain, stage: string, durationMs: number = 2000): Promise<void> {
    const worst: {[k: string]: number} = {}
    const steps = Math.max(1, Math.round(durationMs / 100))
    for (let i = 0; i < steps; i++) {
      for (const [name, sep] of this.measure(m)) worst[name] = Math.min(worst[name] ?? Infinity, sep)
      await sleep(100)
    }
    log(`8[${stage}] hint at ${fmt(m.hintUI.getSceneObject().getTransform().getWorldPosition())} (worst over ${durationMs} ms of bobbing)`)
    for (const name of Object.keys(worst)) {
      const sep = worst[name]
      log(`8[${stage}]   vs ${name}: min separation=${sep.toFixed(4)}${sep < 0 ? " OVERLAP" : ""}`)
      if (sep >= -0.003) continue
      // Criterion 8 names clay, buttons and score; the target vase is reported as a warning only.
      if (name === "target vase") this.warnings.push(`${stage}: hint grazes target vase (penetration ${(-sep).toFixed(3)})`)
      else this.overlaps.push(`${stage}: hint overlaps ${name} (penetration ${(-sep).toFixed(3)} screen units)`)
    }
  }

  private above(m: ClayMirrorMain, target: SceneObject, label: string, maxHoriz: number): void {
    const h = m.hintUI.getSceneObject().getTransform().getWorldPosition()
    const t = target.getTransform().getWorldPosition()
    const horiz = Math.sqrt((h.x - t.x) ** 2 + (h.z - t.z) ** 2)
    log(`8: hint ${fmt(h)} vs ${label} ${fmt(t)} dy=${(h.y - t.y).toFixed(1)} horiz=${horiz.toFixed(1)}`)
    expect(h.y).toBeGreaterThan(t.y)
    expect(horiz).toBeLessThan(maxHoriz)
  }

  async run(): Promise<void> {
    const m = await waitForGame()
    const hand = LeafHandInteractor.get("right")
    const text = (): string => m.hintUI.currentText.toLowerCase()

    // 0: placement hint at the very start.
    expect(m.phase).toBe("placement")
    expect(m.hintId).toBe("placeBench")
    expect(m.hintVisible).toBe(true)
    expect(m.hintUI.getSceneObject().enabled).toBe(true)
    log(`8: hint0 '${m.hintUI.currentText}'`)
    expect(text().includes("drag the bench")).toBe(true)
    expect(text().includes("height")).toBe(true)
    expect(text().includes("start")).toBe(true)
    this.above(m, m.placementUI.getSceneObject(), "placement row (bench front edge)", 8)
    // Style: white text, green neon border (read from the component inputs).
    expect(m.hintUI.textColor.x).toBeGreaterThan(0.95)
    expect(m.hintUI.textColor.y).toBeGreaterThan(0.95)
    expect(m.hintUI.textColor.z).toBeGreaterThan(0.95)
    expect(m.hintUI.borderColor.y).toBeGreaterThan(m.hintUI.borderColor.x)
    expect(m.hintUI.borderColor.y).toBeGreaterThan(m.hintUI.borderColor.z)
    // Bobbing: the inner "Bob" child moves over time.
    const bob = m.hintUI.getSceneObject().getChild(0)
    const y0 = bob.getTransform().getLocalPosition().y
    await sleep(600)
    const y1 = bob.getTransform().getLocalPosition().y
    log(`8: bob '${bob.name}' y ${y0.toFixed(3)} -> ${y1.toFixed(3)}`)
    expect(Math.abs(y1 - y0)).toBeGreaterThan(0.05)
    await this.checkOverlap(m, "placeBench")

    // 1: after Start, drop hint above the clay.
    await pinch(hand, interactableOf(m.placementUI.startButtonObject, "Start"))
    await sleep(400)
    await hand.hand.hide()
    log(`8: hint1 id=${m.hintId} '${m.hintUI.currentText}'`)
    expect(m.hintId).toBe("dropClay")
    expect(m.hintVisible).toBe(true)
    expect(text().includes("drop it on the wheel")).toBe(true)
    this.above(m, m.clay.getSceneObject(), "clay block", 5)
    await this.checkOverlap(m, "dropClay")

    // 2: once the clay lands, sculpt hint above the wheel.
    m.dropClayOnWheel()
    await sleep(300)
    log(`8: hint2 id=${m.hintId} '${m.hintUI.currentText}'`)
    expect(m.hintId).toBe("sculpt")
    expect(m.hintVisible).toBe(true)
    expect(text().includes("pinch and drag")).toBe(true)
    this.above(m, m.wheel.getSceneObject(), "wheel", 8)
    await this.checkOverlap(m, "sculpt")

    // 3: first drag removes the sculpt hint; "Match the target" shows, then hides after ~4 s.
    m.applyDrag(0.5, -0.5, 0)
    await sleep(200)
    log(`8: hint3 id=${m.hintId} '${m.hintUI.currentText}'`)
    expect(m.hintId).toBe("matchTarget")
    expect(text().includes("match the target")).toBe(true)
    this.above(m, m.scoreUI.getSceneObject(), "live % (score panel)", 5)
    await this.checkOverlap(m, "matchTarget", 1500)
    await sleep(3000)
    log(`8: after ~4.7 s id='${m.hintId}' visible=${m.hintVisible}`)
    expect(m.hintId).toBe("")
    expect(m.hintVisible).toBe(false)

    // Later drags never bring a hint back.
    m.applyDrag(0.5, -0.3, 0)
    await sleep(100)
    expect(m.hintVisible).toBe(false)

    log(`8: warnings (not part of criterion 8): ${this.warnings.length === 0 ? "none" : this.warnings.join(" | ")}`)
    log(`8: overlaps: ${this.overlaps.length === 0 ? "none" : this.overlaps.join(" | ")}`)
    expect(this.overlaps.length === 0 ? "none" : this.overlaps.join(" | ")).toBe("none")
  }
}
