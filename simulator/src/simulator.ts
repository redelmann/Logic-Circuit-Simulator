import * as p5 from "p5"

import { activeTool, currMouseAction } from "./menutools.js"
import { MouseAction } from "./circuit_components/Enums.js"
import { WireManager } from "./circuit_components/Wire.js"
import { Mode } from "./circuit_components/Enums.js"
import { FileManager } from "./FileManager.js"
import { Gate } from "./circuit_components/Gate.js"
import { LogicInput } from "./circuit_components/LogicInput.js"
import { LogicOutput } from "./circuit_components/LogicOutput.js"
import { Clock } from "./circuit_components/Clock.js"
import { SR_Latch } from "./circuit_components/SR_Latch.js"
import { FF_D } from "./circuit_components/FF_D.js"
import { FF_JK } from "./circuit_components/FF_JK.js"
import { FF_T } from "./circuit_components/FF_T.js"

type Color = [number, number, number]
type FF = FF_D | FF_JK | FF_T

export let gateIMG: p5.Image[] = [] // gates images
export let IC_IMG: p5.Image[] = [] // integrated circuits images
export let gate: Gate[] = []
export let logicInput: LogicInput[] = []
export let logicOutput: LogicOutput[] = []
export let logicClock: Clock[] = []
export let srLatch: SR_Latch[] = []
export let flipflop: FF[] = []
export let wireMng: WireManager
export let colorMouseOver: Color = [0, 0x7B, 0xFF]
export let fileManager = new FileManager()

export let mode = Mode.FULL

let canvasContainer: HTMLElement
let initialData: string | undefined = undefined

export function preload() {
    gateIMG.push(loadImage('simulator/img/LogicInput.svg'))// For testing usage
    gateIMG.push(loadImage('simulator/img/NOT.svg'))
    gateIMG.push(loadImage('simulator/img/AND.svg'))
    gateIMG.push(loadImage('simulator/img/NAND.svg'))
    gateIMG.push(loadImage('simulator/img/OR.svg'))
    gateIMG.push(loadImage('simulator/img/NOR.svg'))
    gateIMG.push(loadImage('simulator/img/XOR.svg'))
    gateIMG.push(loadImage('simulator/img/XNOR.svg'))

    IC_IMG.push(loadImage('simulator/img/SR_Latch.svg')) // For testing usage
    IC_IMG.push(loadImage('simulator/img/SR_Latch.svg'))
    IC_IMG.push(loadImage('simulator/img/SR_Latch_Sync.svg'))
    IC_IMG.push(loadImage('simulator/img/FF_D.svg'))
    IC_IMG.push(loadImage('simulator/img/FF_D_MS.svg'))
    IC_IMG.push(loadImage('simulator/img/FF_T.svg'))
    IC_IMG.push(loadImage('simulator/img/FF_JK.svg'))
}


function getURLParameter<T>(sParam: string, defaultValue: T): string | T
function getURLParameter(sParam: string, defaultValue?: undefined): string | undefined
function getURLParameter(sParam: string, defaultValue: any) {
    var sPageURL = window.location.search.substring(1)
    var sURLVariables = sPageURL.split('&')
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=')
        if (sParameterName[0] === sParam) {
            return sParameterName[1]
        }
    }
    return defaultValue
}

function isTruthyString(str: string | null | undefined): boolean {
    return !!str && (str === "1" || str.toLowerCase() === "true")
}

function isEmbeddedInIframe(): boolean {
    try {
        return window.self !== window.top
    } catch (e) {
        return true
    }
}

const PARAM_DATA = "data"
const PARAM_SHOW_ONLY = "showonly"
const PARAM_MODE = "mode"

export function setup() {
    canvasContainer = document.getElementById("canvas-sim")!

    let canvas = createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight, P2D)

    canvas.parent('canvas-sim')

    wireMng = new WireManager()


    const data = getURLParameter(PARAM_DATA)
    if (data) {
        initialData = data
        tryLoadFromData()
    }


    const maybeMode = getURLParameter(PARAM_MODE, "").toUpperCase()
    if (maybeMode in Mode) {
        mode = (Mode as any)[maybeMode]
        console.log("Mode: " + maybeMode)
    }

    const showReset = mode >= Mode.TRYOUT
    const showRightEditControls = mode >= Mode.CONNECT
    const showLeftMenu = mode >= Mode.FULL
    const showRightMenu = showReset || showRightEditControls

    if (!showReset) {
        document.getElementById("resetToolButton")!.style.display = "none"
    }


    let showonlyStr = getURLParameter(PARAM_SHOW_ONLY)
    if (showonlyStr) {
        const showonly = showonlyStr.toUpperCase().split(/[, ]+/).filter(x => x.trim())
        const leftToolbar = document.getElementById("leftToolbar")!
        const toolbarChildren = leftToolbar.children
        for (let i = 0; i < toolbarChildren.length; i++) {
            const child = toolbarChildren[i] as HTMLElement
            const tool = child.getAttribute("tool")
            if (child.tagName === "BUTTON" && tool && isTruthyString(child.getAttribute("isGate")) && !showonly.includes(tool)) {
                child.style.display = "none"
            }
        }
    }

    if (showRightEditControls) {
        const modifButtons = document.querySelectorAll("button.sim-modification-tool")
        for (let i = 0; i < modifButtons.length; i++) {
            const but = modifButtons[i] as HTMLElement
            but.style.removeProperty("display")
        }
    }


    if (showLeftMenu) {
        document.getElementById("leftToolbar")!.style.removeProperty("display")
        if (!isEmbeddedInIframe()) {
            const dumpJsonStructure = document.getElementById("dumpJsonStructure")!
            // if (dumpJsonStructure) {
            dumpJsonStructure.setAttribute("style", "")
            dumpJsonStructure.addEventListener("click", (e) => {
                const json = FileManager.getJSON_Workspace()
                console.log("JSON:\n" + json)
                const encodedJson = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "%3D")
                const loc = window.location
                history.replaceState(null, "", loc.protocol + "//" + loc.host + loc.pathname + "?data=" + encodedJson)
            }, false)
        }

    }

    if (showRightMenu) {
        document.getElementById("rightToolbarContainer")!.style.removeProperty("visibility")
    }
}

export function tryLoadFromData() {
    if (!initialData) {
        return
    }
    try {
        const decodedData = atob(initialData.replace(/-/g, "+").replace(/_/g, "/").replace(/%3D/g, "="))
        fileManager.doLoadFromJsonString(decodeURIComponent(decodedData))
    } catch (e) {
        console.trace(e)
    }
}

export function windowResized() {
    resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight)
    // document.getElementsByClassName("tools")[0].style.height = canvHeight;
}

export function draw() {
    background(0xFF)
    fill(0xFF)

    stroke(200)
    strokeWeight(2)
    if (mode >= Mode.CONNECT) {
        rect(0, 0, width, height)
    }

    stroke(0)
    wireMng.draw()

    for (let i = 0; i < gate.length; i++) {
        gate[i].draw()
    }
    for (let i = 0; i < logicInput.length; i++) {
        logicInput[i].draw()
    }
    for (let i = 0; i < logicOutput.length; i++) {
        logicOutput[i].draw()
    }
    for (let i = 0; i < logicClock.length; i++) {
        logicClock[i].draw()
    }
    for (let i = 0; i < srLatch.length; i++) {
        srLatch[i].draw()
    }
    for (let i = 0; i < flipflop.length; i++) {
        flipflop[i].draw()
    }
    if (fileManager.isLoadingState) {
        fileManager.isLoadingState = false
    }

}

/**
 * While mouse is pressed:
 *  
 */
export function mousePressed() {
    /** Check gate[] mousePressed funtion*/
    for (let i = 0; i < gate.length; i++) {
        gate[i].mousePressed()
    }
    for (let i = 0; i < logicInput.length; i++) {
        logicInput[i].mousePressed()
    }
    for (let i = 0; i < logicOutput.length; i++) {
        logicOutput[i].mousePressed()
    }
    for (let i = 0; i < logicClock.length; i++) {
        logicClock[i].mousePressed()
    }
    for (let i = 0; i < srLatch.length; i++) {
        srLatch[i].mousePressed()
    }
    for (let i = 0; i < flipflop.length; i++) {
        flipflop[i].mousePressed()
    }
}

export function mouseReleased() {
    for (let i = 0; i < gate.length; i++) {
        gate[i].mouseReleased()
    }
    for (let i = 0; i < logicInput.length; i++) {
        logicInput[i].mouseReleased()
    }
    for (let i = 0; i < logicOutput.length; i++) {
        logicOutput[i].mouseReleased()
    }
    for (let i = 0; i < logicClock.length; i++) {
        logicClock[i].mouseReleased()
    }
    for (let i = 0; i < srLatch.length; i++) {
        srLatch[i].mouseReleased()
    }
    for (let i = 0; i < flipflop.length; i++) {
        flipflop[i].mouseReleased()
    }
}

export function doubleClicked() {
    for (let i = 0; i < logicInput.length; i++) {
        logicInput[i].doubleClicked()
    }
}

export function mouseClicked() {
    // Check current selected option
    if (currMouseAction === MouseAction.EDIT) {
        // If action is EDIT, check every class. 
        for (let i = 0; i < gate.length; i++) {
            gate[i].mouseClicked()
        }
        for (let i = 0; i < logicInput.length; i++) {
            logicInput[i].mouseClicked()
        }
        for (let i = 0; i < logicOutput.length; i++) {
            logicOutput[i].mouseClicked()
        }
        for (let i = 0; i < logicClock.length; i++) {
            logicClock[i].mouseClicked()
        }
        for (let i = 0; i < srLatch.length; i++) {
            srLatch[i].mouseClicked()
        }
        for (let i = 0; i < flipflop.length; i++) {
            flipflop[i].mouseClicked()
        }

    } else if (currMouseAction === MouseAction.DELETE) {
        for (let i = 0; i < gate.length; i++) {
            if (gate[i].mouseClicked()) {
                gate[i].destroy()
                delete gate[i]
                gate.splice(i, 1)
            }
        }

        for (let i = 0; i < logicInput.length; i++) {
            if (logicInput[i].mouseClicked()) {
                logicInput[i].destroy()
                delete logicInput[i]
                logicInput.splice(i, 1)
            }
        }

        for (let i = 0; i < logicOutput.length; i++) {
            if (logicOutput[i].mouseClicked()) {
                logicOutput[i].destroy()
                delete logicOutput[i]
                logicOutput.splice(i, 1)
            }
        }

        for (let i = 0; i < logicClock.length; i++) {
            if (logicClock[i].mouseClicked()) {
                logicClock[i].destroy()
                delete logicClock[i]
                logicClock.splice(i, 1)
            }
        }

        for (let i = 0; i < srLatch.length; i++) {
            if (srLatch[i].mouseClicked()) {
                srLatch[i].destroy()
                delete srLatch[i]
                srLatch.splice(i, 1)
            }
        }

        for (let i = 0; i < flipflop.length; i++) {
            if (flipflop[i].mouseClicked()) {
                flipflop[i].destroy()
                delete flipflop[i]
                flipflop.splice(i, 1)
            }
        }
    }

    wireMng.mouseClicked()
}


window.preload = preload
window.setup = setup
window.draw = draw
window.windowResized = windowResized
window.mousePressed = mousePressed
window.mouseReleased = mouseReleased
window.doubleClicked = doubleClicked
window.mouseClicked = mouseClicked

window.activeTool = activeTool

const projectFile = document.getElementById("projectFile")
if (projectFile) {
    projectFile.addEventListener("change", (e) => fileManager.loadFile(e), false)
}

export const saveProjectFile = document.getElementById("saveProjectFile") as HTMLAnchorElement | null
if (saveProjectFile) {
    saveProjectFile.addEventListener("click", (e) => fileManager.saveFile(), false)
}

export function saveFile() {
    fileManager.saveFile()
}

export function any(bools: boolean[]): boolean {
    for (let i = 0; i < bools.length; i++) {
        if (bools[i]) {
            return true
        }
    }
    return false
}