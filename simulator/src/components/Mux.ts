import * as t from "io-ts"
import { COLOR_BACKGROUND, COLOR_COMPONENT_BORDER, COLOR_MOUSE_OVER, displayValuesFromArray, drawWireLineToComponent, strokeAsWireLine, useCompact } from "../drawutils"
import { div, mods, tooltipContent } from "../htmlgen"
import { LogicEditor } from "../LogicEditor"
import { S } from "../strings"
import { ArrayFillWith, isDefined, isUnknown, LogicValue, typeOrUndefined, Unknown } from "../utils"
import { ComponentBase, defineParametrizedComponent, groupHorizontal, groupVertical, groupVerticalMulti, Repr, ResolvedParams } from "./Component"
import { ContextMenuData, ContextMenuItem, ContextMenuItemPlacement, DrawContext } from "./Drawable"
import { WireStyles } from "./Wire"


export const MuxDef =
    defineParametrizedComponent("ic", "mux", true, true, {
        variantName: ({ from, to }) => `mux-${from}to${to}`,
        button: { imgWidth: 50 },
        repr: {
            from: typeOrUndefined(t.number),
            to: typeOrUndefined(t.number),
            showWiring: typeOrUndefined(t.boolean),
        },
        valueDefaults: {
            showWiring: true,
        },
        paramDefaults: {
            from: 8,
            to: 4,
        },
        validateParams: ({ from, to }) => {
            const numGroups = Math.ceil(from / to)
            const numSel = Math.ceil(Math.log2(numGroups))
            return { numFrom: from, numTo: to, numGroups, numSel }
        },
        size: ({ numFrom, numTo, numGroups, numSel }) => {
            const gridWidth = 2 * numSel
            const spacing = useCompact(numTo) ? 1 : 2
            const addByGroupSep = numTo > 1 ? 1 : 0
            const numLeftSlots = numFrom + (numGroups - 1) * addByGroupSep
            const gridHeight = 1 + spacing * numLeftSlots
            return { gridWidth, gridHeight }
        },
        makeNodes: ({ numTo, numGroups, numSel }) => {
            const outX = 1 + numSel
            const inX = -outX

            const groupOfInputs = groupVerticalMulti("w", inX, 0, numGroups, numTo)
            const firstInputY = groupOfInputs[0][0][1]
            const selY = firstInputY - 2

            return {
                ins: {
                    I: groupOfInputs,
                    S: groupHorizontal("n", 0, selY, numSel),
                },
                outs: {
                    Z: groupVertical("e", outX, 0, numTo),
                },
            }
        },
        initialValue: (saved, { numTo }) => ArrayFillWith<LogicValue>(false, numTo),
    })


export type MuxRepr = Repr<typeof MuxDef>
export type MuxParams = ResolvedParams<typeof MuxDef>

export class Mux extends ComponentBase<MuxRepr> {

    public readonly numFrom: number
    public readonly numTo: number
    public readonly numGroups: number
    public readonly numSel: number
    private _showWiring: boolean = MuxDef.aults.showWiring

    public constructor(editor: LogicEditor, params: MuxParams, saved?: MuxRepr) {
        super(editor, MuxDef.with(params), saved)

        this.numFrom = params.numFrom
        this.numTo = params.numTo
        this.numGroups = params.numGroups
        this.numSel = params.numSel

        if (isDefined(saved)) {
            this._showWiring = saved.showWiring ?? MuxDef.aults.showWiring
        }
    }

    public override toJSON() {
        return {
            type: "mux" as const, from: this.numFrom, to: this.numTo,
            ...super.toJSONBase(),
            showWiring: (this._showWiring !== MuxDef.aults.showWiring) ? this._showWiring : undefined,
        }
    }

    public override makeTooltip() {
        return tooltipContent(undefined, mods(
            div(S.Components.Mux.tooltip.expand({ from: this.numFrom, to: this.numTo }))
        ))
    }

    protected doRecalcValue(): LogicValue[] {
        const sels = this.inputValues(this.inputs.S)
        const sel = displayValuesFromArray(sels, false)[1]

        if (isUnknown(sel)) {
            return ArrayFillWith(Unknown, this.numTo)
        }
        return this.inputValues(this.inputs.I[sel])
    }

    protected override propagateValue(newValues: LogicValue[]) {
        this.outputValues(this.outputs.Z, newValues)
    }

    protected doDraw(g: CanvasRenderingContext2D, ctx: DrawContext) {

        const width = this.unrotatedWidth
        const height = this.unrotatedHeight
        const left = this.posX - width / 2
        const right = this.posX + width / 2
        const top = this.posY - height / 2
        const bottom = this.posY + height / 2
        const dy = (right - left) / 3

        // inputs
        for (const inputGroup of this.inputs.I) {
            for (const input of inputGroup) {
                drawWireLineToComponent(g, input, left, input.posYInParentTransform)
            }
        }

        // selectors
        for (const sel of this.inputs.S) {
            drawWireLineToComponent(g, sel, sel.posXInParentTransform, top + dy)
        }

        // outputs
        for (const output of this.outputs.Z) {
            drawWireLineToComponent(g, output, right, output.posYInParentTransform)
        }

        // background
        g.fillStyle = COLOR_BACKGROUND
        const outlinePath = new Path2D()
        outlinePath.moveTo(left, top)
        outlinePath.lineTo(right, top + dy)
        outlinePath.lineTo(right, bottom - dy)
        outlinePath.lineTo(left, bottom)
        outlinePath.closePath()
        g.fill(outlinePath)

        // wiring
        if (this._showWiring) {
            const sels = this.inputValues(this.inputs.S)
            const sel = displayValuesFromArray(sels, false)[1]
            if (!isUnknown(sel)) {
                const neutral = this.editor.options.hideWireColors
                const selectedInputs = this.inputs.I[sel]
                const anchorDiffX = (right - left) / 3
                const wireStyleStraight = this.editor.options.wireStyle === WireStyles.straight

                for (let i = 0; i < selectedInputs.length; i++) {
                    this.editor.options.wireStyle
                    g.beginPath()
                    const fromY = selectedInputs[i].posYInParentTransform
                    const toNode = this.outputs.Z[i]
                    const toY = toNode.posYInParentTransform
                    g.moveTo(left + 1, fromY)
                    if (wireStyleStraight) {
                        g.lineTo(left + 3, fromY)
                        g.lineTo(right - 3, toY)
                        g.lineTo(right - 1, toY)
                    } else {
                        g.bezierCurveTo(
                            left + anchorDiffX, fromY, // anchor left
                            right - anchorDiffX, toY, // anchor right
                            right - 1, toY,
                        )
                    }
                    strokeAsWireLine(g, selectedInputs[i].value, toNode.color, false, neutral)
                }
            }
        }

        // outline
        g.lineWidth = 3
        if (ctx.isMouseOver) {
            g.strokeStyle = COLOR_MOUSE_OVER
        } else {
            g.strokeStyle = COLOR_COMPONENT_BORDER
        }
        g.stroke(outlinePath)

    }

    private doSetShowWiring(showWiring: boolean) {
        this._showWiring = showWiring
        this.setNeedsRedraw("show wiring changed")
    }


    protected override makeComponentSpecificContextMenuItems(): undefined | [ContextMenuItemPlacement, ContextMenuItem][] {
        const icon = this._showWiring ? "check" : "none"
        const toggleShowWiringItem = ContextMenuData.item(icon, S.Components.Mux.contextMenu.ShowWiring, () => {
            this.doSetShowWiring(!this._showWiring)
        })

        const items: [ContextMenuItemPlacement, ContextMenuItem][] = [
            ["mid", toggleShowWiringItem],
        ]

        const forceOutputItem = this.makeForceOutputsContextMenuItem()
        if (isDefined(forceOutputItem)) {
            items.push(
                ["mid", forceOutputItem]
            )
        }

        return items
    }

}
MuxDef.impl = Mux