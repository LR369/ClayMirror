/**
 * Criterion 14 (feedback round) — while the bench is first placed, the clay block and the target
 * piece are not there; pinching Start drops them into place (thud sound), they glow green for a
 * few seconds (plus a "ready" ding), and the same drop-in happens for each new piece. The gear's
 * settings show a Sound box with Music and Effects on/off toggles that really mute them.
 * Input: REAL pinches on Start and both sound toggles; the rest via hooks.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {interactableOf, log, pinch, waitForGame, waitUntil} from "./ClayMirrorTestUtils"

@component
export class CM_14_DropInSoundScenario extends Scenario {
  async run(): Promise<void> {
    const m = await waitForGame()
    const hand = LeafHandInteractor.get("right")

    // Placement: pieces are not on the bench yet; the Sound box is showing.
    expect(m.clay.isPieceVisible).toBe(false)
    expect(m.target.vaseVisible).toBe(false)
    expect(m.audioUI !== null).toBe(true)
    expect(m.audioUI.isVisible).toBe(true)
    expect(m.audioUI.musicLabel).toBe("Music: On")
    expect(m.audioUI.sfxLabel).toBe("Effects: On")

    // Real pinch on Start: target drops first, then the clay; both land and glow green.
    const drops0 = m.audio.dropPlayCount
    let sawTargetFall = false
    let sawClayFall = false
    const watch = this.createEvent("UpdateEvent")
    watch.bind(() => {
      if (m.target.isDropping) sawTargetFall = true
      if (m.clay.isDropping) sawClayFall = true
    })
    await pinch(hand, interactableOf(m.placementUI.startButtonObject, "Start"))
    await sleep(1600)
    watch.enabled = false
    log(`14: fell target=${sawTargetFall} clay=${sawClayFall} glow target=${m.target.isHighlighted} clay=${m.clay.isHighlighted} drops=${m.audio.dropPlayCount - drops0} audioUI=${m.audioUI.isVisible}`)
    expect(m.audioUI.isVisible).toBe(false)
    expect(sawTargetFall).toBe(true)
    expect(sawClayFall).toBe(true)
    expect(m.target.vaseVisible).toBe(true)
    expect(m.clay.isPieceVisible).toBe(true)
    expect(m.target.isHighlighted).toBe(true)
    expect(m.clay.isHighlighted).toBe(true)
    expect(m.audio.dropPlayCount - drops0).toBe(2)
    expect(m.clay.grabEnabled && !m.clay.isDropping).toBe(true)
    await waitUntil(() => !m.target.isHighlighted && !m.clay.isHighlighted, 5000, () => "glow never ended")

    // Gear → Sound box; real pinches mute music and effects.
    m.pressGear()
    await sleep(200)
    expect(m.audioUI.isVisible).toBe(true)
    await pinch(hand, interactableOf(m.audioUI.musicButtonObject, "Music"))
    await sleep(200)
    await pinch(hand, interactableOf(m.audioUI.sfxButtonObject, "Effects"))
    await sleep(200)
    log(`14: music=${m.audio.musicEnabled} playing=${m.audio.isMusicPlaying} sfx=${m.audio.sfxEnabled} labels='${m.audioUI.musicLabel}' '${m.audioUI.sfxLabel}'`)
    expect(m.audio.musicEnabled).toBe(false)
    expect(m.audio.isMusicPlaying).toBe(false)
    expect(m.audio.sfxEnabled).toBe(false)
    expect(m.audioUI.musicLabel).toBe("Music: Off")
    expect(m.audioUI.sfxLabel).toBe("Effects: Off")
    m.pressStart()
    await sleep(300)
    expect(m.isWheelSpinning).toBe(true)
    expect(m.audio.isHumPlaying).toBe(false) // effects muted: no wheel hum

    // Turn both back on (hooks), hum returns.
    m.pressGear()
    await sleep(100)
    m.audioUI.pressMusic()
    m.audioUI.pressSfx()
    m.pressStart()
    await sleep(300)
    expect(m.audio.musicEnabled).toBe(true)
    expect(m.audio.isMusicPlaying).toBe(true)
    expect(m.audio.isHumPlaying).toBe(true)

    // Next piece drops in too.
    m.dropClayOnWheel()
    await sleep(100)
    m.pressDone()
    await sleep(100)
    const drops1 = m.audio.dropPlayCount
    m.pressNextVase()
    await sleep(1600)
    log(`14: next piece=${m.itemName} drops=${m.audio.dropPlayCount - drops1} glow target=${m.target.isHighlighted} clay=${m.clay.isHighlighted}`)
    expect(m.audio.dropPlayCount - drops1).toBe(2)
    expect(m.target.isHighlighted).toBe(true)
    expect(m.clay.isHighlighted).toBe(true)
    await hand.hand.hide()
  }
}
