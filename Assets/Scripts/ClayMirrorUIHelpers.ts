/**
 * ClayMirrorUIHelpers — shared UIKit composition helpers for the Clay Mirror UI modules.
 *
 * Owns: the type scale (applyTextRole), FlexLayout row/column + FlexItem
 * registration, BackPlate cards, icon Buttons (Button + ElementContent),
 * raw Text labels sized for flex cells, and Images with cloned ImageMaterial.
 * Must not: hold state. Every *UI.ts module composes its panel from these.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

// ── Typography: single source of truth for size + weight ─────────────────────
export const FONT_SIZE_SCALE = 1.0
export type TextRole = "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2" | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
export const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}
export function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
export function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

export const LAYOUT_Z_LIFT = 0.02
export const BUTTON_LABEL_Z = 0.08

export function obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  if (position) so.getTransform().setLocalPosition(position)
  return so
}

/** A FlexLayout container (row or column) that is itself a flex item of its parent. */
export function makeFlex(
  parent: SceneObject,
  dir: FlexDirection,
  w: number,
  h: number,
  justify: FlexJustify,
  align: FlexAlign,
  gap: number,
  pad: number = 0
): SceneObject {
  const c = obj(parent, dir === FlexDirection.Row ? "Row" : "Column", new vec3(0, 0, LAYOUT_Z_LIFT))
  const f = c.createComponent(FlexLayout.getTypeName()) as FlexLayout
  f.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
  const item = c.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = w
  item.overrideHeight = h
  f.width = w
  f.height = h
  f.direction = dir
  if (dir === FlexDirection.Row) f.columnGap = gap
  else f.rowGap = gap
  f.paddingTop = pad
  f.paddingBottom = pad
  f.paddingLeft = pad
  f.paddingRight = pad
  f.justifyContent = justify
  f.alignItems = align
  const pf = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
  if (pf) pf.addItems([item])
  return c
}

/** Add a fixed-size child to a flex container and register it (mandatory addItems). */
export function flexChild(parent: SceneObject, w: number, h: number, build: (child: SceneObject) => void, name: string = "Item"): SceneObject {
  const child = obj(parent, name, new vec3(0, 0, LAYOUT_Z_LIFT))
  const item = child.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = w
  item.overrideHeight = h
  item.flexGrow = 0
  item.flexShrink = 0
  build(child)
  const pf = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
  if (pf) pf.addItems([item])
  return child
}

/** A card with its own BackPlate; content child lifted +0.6 cm (z-fighting). */
export function card(parent: SceneObject, name: string, w: number, h: number, build: (content: SceneObject) => void, style: "default" | "dark" | "simple" = "default"): SceneObject {
  return flexChild(
    parent,
    w,
    h,
    (cardSO) => {
      const plate = cardSO.createComponent(BackPlate.getTypeName()) as BackPlate
      plate.style = style
      plate.size = new vec2(w, h)
      const content = obj(cardSO, "Content", new vec3(0, 0, 0.6))
      build(content)
    },
    name
  )
}

/** Raw Text sized to a flex cell (row-safe layoutRect). */
export function addText(host: SceneObject, text: string, role: TextRole, widthCm: number, color: vec4, distanceCm: number, heightCm: number = 2.4): Text {
  const t = host.createComponent("Component.Text") as Text
  t.text = text
  t.depthTest = true
  applyTextRole(t, role, distanceCm)
  t.horizontalAlignment = HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  t.textFill.color = color
  return t
}

/** Image with a cloned ImageMaterial (depth-test on, depth-write off). */
export function addImage(host: SceneObject, tex: Texture, sizeCm: number): Image {
  const so = obj(host, "Icon")
  const img = so.createComponent("Component.Image") as Image
  const mat = imageMaterial.clone()
  mat.mainPass.baseTex = tex
  mat.mainPass.depthTest = true
  mat.mainPass.depthWrite = false
  img.clearMaterials()
  img.addMaterial(mat)
  so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
  return img
}

/** Square UIKit Button whose whole face is an icon (ElementContent companion). */
export function iconButton(
  host: SceneObject,
  icon: Texture,
  sizeCm: number,
  onClick: () => void,
  variant?: {theme: string; shape?: string; style?: string}
): Button {
  const btn = host.createComponent(Button.getTypeName()) as Button
  if (variant) btn.setVariant(variant) // BEFORE init
  btn.size = new vec3(sizeCm, sizeCm, 1) // BEFORE init
  if (icon) {
    const ec = host.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.leadingIcon = icon
  }
  btn.onTriggerUp.add(onClick)
  return btn
}

const RING: Texture = requireAsset("../Icons/radio_button_unchecked_fill0_wght300.png") as Texture

/**
 * Round button that reads on an additive display: a big light icon over the button and a
 * bright colored ring around it (dark plates vanish on Specs, so color lives in the ring).
 */
export function ringIconButton(host: SceneObject, icon: Texture, sizeCm: number, ringColor: vec4, onClick: () => void): Button {
  const btn = iconButton(host, null, sizeCm, onClick, {theme: "SnapOS2", shape: "Round", style: "PrimaryNeutral"})
  const ring = addImage(host, RING, sizeCm * 1.18)
  ring.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0.3))
  ring.mainMaterial.mainPass.baseColor = ringColor
  const img = addImage(host, icon, sizeCm * 0.62)
  img.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0.7))
  return btn
}

/** Icon button with a caption underneath, as one column flex child. */
export function captionedIconButton(
  parent: SceneObject,
  name: string,
  icon: Texture,
  caption: string,
  sizeCm: number,
  color: vec4,
  distanceCm: number,
  onClick: () => void
): {button: Button; root: SceneObject; label: Text} {
  let button: Button
  let label: Text
  const root = flexChild(
    parent,
    sizeCm + 2,
    sizeCm + 3.2,
    (cell) => {
      const col = makeFlex(cell, FlexDirection.Column, sizeCm + 2, sizeCm + 3.2, FlexJustify.Center, FlexAlign.Center, 0.4)
      flexChild(col, sizeCm, sizeCm, (b) => {
        button = iconButton(b, icon, sizeCm, onClick)
      }, name + "Button")
      flexChild(col, sizeCm + 2, 2.4, (t) => {
        label = addText(t, caption, "Subheadline", sizeCm + 2, color, distanceCm)
      })
    },
    name
  )
  return {button: button!, root, label: label!}
}
