/**
 * ClayMirrorGameState — pure round/skill/bonus logic (no scene access).
 *
 * Owns: the game phase, potter skill XP + level, and the bonus rules that
 * turn a final match % into a results summary.
 * Must not: touch scene objects or UI. ClayMirrorMain owns the single
 * instance and pushes results into ClayMirrorScoreUI.
 */

export type GamePhase = "placement" | "play" | "results" | "wipe" | "complete"

export interface BonusRule {
  label: string
  xp: number
}

export interface RoundResult {
  score: number          // final match % (0..100, rounded)
  baseXp: number
  bonuses: BonusRule[]
  totalXp: number
  levelBefore: number
  levelAfter: number
  barFrom: number        // skill bar fill before (0..1, within levelBefore)
  barTo: number          // skill bar fill after (0..1, within levelAfter)
  leveledUp: boolean
}

export interface SkillConfig {
  xpPerLevel: number
  masterThreshold: number
  masterXp: number
  greatThreshold: number
  greatXp: number
  noCollapseXp: number
  noUndoXp: number
}

export const DEFAULT_SKILL_CONFIG: SkillConfig = {
  xpPerLevel: 150,
  masterThreshold: 90,
  masterXp: 50,
  greatThreshold: 75,
  greatXp: 25,
  noCollapseXp: 15,
  noUndoXp: 10,
}

export class GameState {
  phase: GamePhase = "placement"
  /** Phase to resume when leaving placement mode (gear → Start). */
  resumePhase: GamePhase = "play"
  hasStartedOnce = false
  xp = 0
  roundsPlayed = 0
  lastResult: RoundResult | null = null

  constructor(public config: SkillConfig = DEFAULT_SKILL_CONFIG) {}

  get level(): number {
    return 1 + Math.floor(this.xp / this.config.xpPerLevel)
  }

  get barFill(): number {
    return (this.xp % this.config.xpPerLevel) / this.config.xpPerLevel
  }

  /** Score a finished piece and bank the XP. */
  finishRound(matchPct: number, collapses: number, undos: number): RoundResult {
    const c = this.config
    const score = Math.round(matchPct)
    const bonuses: BonusRule[] = []
    if (score >= c.masterThreshold) bonuses.push({label: "Master Potter", xp: c.masterXp})
    else if (score >= c.greatThreshold) bonuses.push({label: "Great Match", xp: c.greatXp})
    if (collapses === 0) bonuses.push({label: "Steady Hands", xp: c.noCollapseXp})
    if (undos === 0) bonuses.push({label: "Clean Throw", xp: c.noUndoXp})

    const baseXp = score
    let totalXp = baseXp
    for (const b of bonuses) totalXp += b.xp

    const levelBefore = this.level
    const barFrom = this.barFill
    this.xp += totalXp
    this.roundsPlayed++
    const result: RoundResult = {
      score,
      baseXp,
      bonuses,
      totalXp,
      levelBefore,
      levelAfter: this.level,
      barFrom,
      barTo: this.barFill,
      leveledUp: this.level > levelBefore,
    }
    this.lastResult = result
    return result
  }
}
