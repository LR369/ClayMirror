import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {CM_A_PlacementScenario} from "./CM_A_PlacementScenario"
import {CM_B_GearScenario} from "./CM_B_GearScenario"
import {CM_1_DropClayScenario} from "./CM_1_DropClayScenario"
import {CM_2_ShapeScenario} from "./CM_2_ShapeScenario"
import {CM_3_LiveDeformScenario} from "./CM_3_LiveDeformScenario"
import {CM_4_UndoScenario} from "./CM_4_UndoScenario"
import {CM_5_DoneScenario} from "./CM_5_DoneScenario"
import {CM_6_RingSquishScenario} from "./CM_6_RingSquishScenario"
import {CM_7_CollapseScenario} from "./CM_7_CollapseScenario"
import {CM_8_HintsScenario} from "./CM_8_HintsScenario"
import {CM_9_ResultsScenario} from "./CM_9_ResultsScenario"
import {CM_10_WipeScenario} from "./CM_10_WipeScenario"
import {CM_11_ItemsScenario} from "./CM_11_ItemsScenario"
import {CM_12_SetCompleteScenario} from "./CM_12_SetCompleteScenario"
import {CM_13_ProgressSignScenario} from "./CM_13_ProgressSignScenario"
import {CM_14_DropInSoundScenario} from "./CM_14_DropInSoundScenario"
import {CM_IK_ReachScenario} from "./CM_IK_ReachScenario"
import {CM_Dbg_HintPoseScenario} from "./CM_Dbg_HintPoseScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "cm-A-placement", typename: CM_A_PlacementScenario.getTypeName()},
    {id: "cm-B-gear", typename: CM_B_GearScenario.getTypeName()},
    {id: "cm-1-drop-clay", typename: CM_1_DropClayScenario.getTypeName()},
    {id: "cm-2-shape", typename: CM_2_ShapeScenario.getTypeName()},
    {id: "cm-3-live-deform", typename: CM_3_LiveDeformScenario.getTypeName()},
    {id: "cm-4-undo", typename: CM_4_UndoScenario.getTypeName()},
    {id: "cm-5-done", typename: CM_5_DoneScenario.getTypeName()},
    {id: "cm-6-ring-squish", typename: CM_6_RingSquishScenario.getTypeName()},
    {id: "cm-7-collapse", typename: CM_7_CollapseScenario.getTypeName()},
    {id: "cm-8-hints", typename: CM_8_HintsScenario.getTypeName()},
    {id: "cm-9-results", typename: CM_9_ResultsScenario.getTypeName()},
    {id: "cm-10-wipe", typename: CM_10_WipeScenario.getTypeName()},
    {id: "cm-11-items", typename: CM_11_ItemsScenario.getTypeName()},
    {id: "cm-12-set-complete", typename: CM_12_SetCompleteScenario.getTypeName()},
    {id: "cm-13-progress-sign", typename: CM_13_ProgressSignScenario.getTypeName()},
    {id: "cm-14-dropin-sound", typename: CM_14_DropInSoundScenario.getTypeName()},
    {id: "cm-ik-reach", typename: CM_IK_ReachScenario.getTypeName()},
    {id: "cm-dbg-hint-pose", typename: CM_Dbg_HintPoseScenario.getTypeName()},
  ]
}
