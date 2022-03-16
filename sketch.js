// noinspection NonAsciiCharacters

/*
@author
@date 2022.01.25


 */

let font, textFrame, voice, p5amp
let passages // our json file input

// variables for the drawAxes function
const DARK_BRIGHTNESS = 60
const LIGHT_BRIGHTNESS = 100
const DISTANCE = 40000

// variables used for the globe functions
const SPHERE_DETAIL = 16
let globe
let r = 100

function preload() {
    font = loadFont('data/giga.ttf')
    passages = loadJSON("passages.json")
    textFrame = loadImage('data/textFrame.png')
    voice = loadSound('data/artaria.mp3', 0, 0)
}

/* populate an array of passage text */
let textList = []
/* grab other information: ms spent on each passage, highlights */
let highlightList = [] // a list of tuples specifying highlights and indexes
let msPerPassage = [] // how long to wait before advancing a passage
let startEndTimes = [] // the start and end times of each passage

// there's a period of no dialog box before the text starts. This represents
// how long that is.
let jumpMillis = 15431
let dialogBox, cam, voiceStartMillis

function setup() {
    createCanvas(640, 360, WEBGL)
    colorMode(HSB, 360, 100, 100, 100)
    textFont(font, 15)
    cam = new Dw.EasyCam(this._renderer, {distance: 240});

    // voice.play()
    p5amp = new p5.Amplitude()

    // look through the JSON for the passages and highlight indices
    for (let i = 0; i < Object.keys(passages).length; i++) {
        textList.push(passages[i].text)
        highlightList.push(passages[i].highlightIndices)
        startEndTimes.push(
            [
                passages[i].speechStartTime,
                passages[i].speechEndTime
            ]
        )
    }

    // look through the JSON in the same manner as last time, except we are
    // looking at the next key instead of the current key as we iterate. The
    // last time I did this, I thought the timestamps were the end of the
    // paragraph, not the start. This means we don't care about the start of
    // the first passage, but we care about everything else. Then we need to
    // stuff in a final value so that our last passage advances. I doubt
    // this is how the Metroid Dread producers did it; it's long.
    for (let i = 0; i < Object.keys(passages).length - 1; i++) {
        msPerPassage.push(passages[i + 1].speechStartTime)
    }

    msPerPassage.push(122426) // that crazy number is when the last
    // paragraph ends

    // console.log(textList)
    // console.log(highlightList)
    // console.log(msPerPassage)

    dialogBox = new DialogBox(textList, highlightList, textFrame, msPerPassage, jumpMillis)

    initializeGlobeArray()
    populateGlobe()
}

const SATURATION = 100
const P_BRIGHTNESS = 100
const N_BRIGHTNESS = 40

// draws a set of axes similar to those in Blender
function drawBlenderAxes() {
    strokeWeight(1)
    // x-axis
    stroke(0, SATURATION, P_BRIGHTNESS)
    line(0, 0, 4000, 0)

    stroke(0, SATURATION, N_BRIGHTNESS)
    line(-4000, 0, 0, 0)

    // y-axis (Webstorm has the values inverted!)
    stroke(120, SATURATION, P_BRIGHTNESS)
    line(0, 0, 0, 4000)

    stroke(120, SATURATION, N_BRIGHTNESS)
    line(0, -4000, 0, 0)

    // z-axis
    stroke(240, SATURATION, P_BRIGHTNESS)
    line(0, 0, 0, 0, 0, 4000)

    stroke(240, SATURATION, N_BRIGHTNESS)
    line(0, 0, -4000, 0, 0, 0)
    noStroke()
}

function draw() {
    background(234, 34, 24)
    ambientLight(250)
    directionalLight(0, 0, 10, .5, 0, 1) // z axis seems inverted

    // drawBlenderAxes()

    /*
        TODO
            dialog box should only show up if the voice is running
    */

    showGlobe()

    // text("Not just groovy!", width/2, height/2) // just seeing the font :)
    // render the dialog box if the audio context is running

    if (p5amp.getLevel() !== 0) {
        dialogBox.render()
    }
}

// fills the globe with points
function populateGlobe() {
    strokeWeight(0.01)
    stroke(0, 0, 60)
    let θ, φ, x, y, z
    for (let i = 0; i < globe.length; i++) {
        // change this to 0, TAU for a meridian view
        θ = map(i, 0, globe.length - 1, 0, PI)
        for (let j = 0; j < globe[i].length; j++) {
            /*
                we're converting from (x, y, z) coordinates to spherical
                coordinates, or (r, θ, φ) coordinates. I did a proof of it!
                For each latitude, we circle around the entire globe. To avoid
                overlap we can only go through the latitude at π radians and
                the longitude τ radians. (τ = 2π even though stands for torque)
             */

            /*
                instead of the standard (x, y, z) coordinates, we're working in
                spherical coordinates or (r, θ, φ) coordinate space. I have a
                proof of this conversion. r is just the radius of our sphere.
                θ is the clockwise angle from the positive x-axis onto the xy
                plane, while φ is the clockwise angle from the positive z-axis
                onto our location vector (x, y, z).
             */

            // change this to 0, PI for a meridian view
            φ = map(j, 0, globe[i].length - 1, 0, PI)

            // I proved the values below using trigonometry and 3D coordinates
            x = r * sin(φ) * cos(θ)
            y = r * sin(φ) * sin(θ)
            z = r * cos(φ)
            globe[i][j] = new p5.Vector(x, y, z)
        }
    }
}

// shows all the points in the globe
function showGlobe() {
    push()
    rotateX(PI/2)
    let pyramidPoints, distance
    // code for pyramid
    let currentVoiceAmp
    let lastVoiceAmp = 0
    for (let i = 0; i < globe.length - 1; i++) {
        for (let j = 0; j < globe[0].length - 1; j++) {
            pyramidPoints = [
                globe[i][j],
                globe[i + 1][j],
                globe[i + 1][j + 1],
                globe[i][j + 1],
                globe[i][j]
            ]

            noStroke()
            fill(210, 100, 15)

            // Instead of finding the distance from each individual point, we
            // get the average of each point.
            let avg = new p5.Vector(0, 0, 0)
            for (let p of pyramidPoints) {
                avg.add(p)
            }
            avg.div(4)

            /*  average out the current voice amp with the previous value to
    prevent large skips. similar to FFT.smooth()
    TODO average out the last 10 values, maybe. use array pop0
*/

// currentVoiceAmp = (voice.getLevel() + lastVoiceAmp) / 2
            currentVoiceAmp = (p5amp.getLevel() + lastVoiceAmp) / 2
            lastVoiceAmp = currentVoiceAmp

            /*  we want the voice amp to have the greatest effect in the center
                and then drop off somewhat quickly
            */
            distance = sqrt(avg.x ** 2 + avg.z ** 2)
            currentVoiceAmp = r * map(currentVoiceAmp, 0, 0.25, 0, 1)
                / (distance ** (1.9))

            let sine = sin(distance / 10 - frameCount / 30)

            let oscillationOffset = (r + 2.5 * sine + 2.5) / r


            let passageIndex = dialogBox.passageIndex
            if ((
                millis() > startEndTimes[passageIndex][0] + voiceStartMillis &&
                millis() < startEndTimes[passageIndex][1] + voiceStartMillis
            )) {
                oscillationOffset -= currentVoiceAmp
            }

            specularMaterial(210, 100, 22)
            // fill(210, 100, 22)
            shininess(100)
            // scales the base radius so that the distance will render the
            // same amount of blocks for a bigger pyramid
            let PYRAMID_DRAW_RADIUS = 68/100*r
            beginShape()
            // start on the pyramid base quad
            for (let p of pyramidPoints) {
                // we need the distance from the y-axis.
                // the general sine formula is asin(b(x+c))+d. We want the
                // amplitude, phase shift, and period to be different.
                // if we're close enough to the y-axis, scale the vertex.
                // Otherwise, just create the vertex.
                if (distance < PYRAMID_DRAW_RADIUS) {
                    vertex(
                        p.x * oscillationOffset,
                        p.y * oscillationOffset,
                        p.z * oscillationOffset
                    )
                } else {
                    vertex(p.x, p.y, p.z)
                }
            }
            endShape()

            // Now we can draw the blue pyramids.

            let fromColor = color(185, 1, 98)
            let toColor = color(184, 57, 95)
            let c = lerpColor(fromColor, toColor, distance / r)



            noStroke()
            fill(c)
            if (distance < PYRAMID_DRAW_RADIUS) {
                beginShape(TRIANGLE_STRIP)
                for (let p of pyramidPoints) {
                    // we follow the steps we took on the pyramid base quad,
                    // except we only draw if our distance is sufficient.
                    vertex(
                        p.x * oscillationOffset,
                        p.y * oscillationOffset,
                        p.z * oscillationOffset
                    )
                    vertex(0, 0, 0)
                }
                endShape()
            }

        }
    }

    renderCover()
    renderWires()

    pop()
}

// makes the globe a 2D array
function initializeGlobeArray() {
    /*
        we can trick the computer into thinking it's dealing with just 1D
        arrays when it's actually handling 2D ones by stuffing an array into
        each index. Also, JavaScript does not support initialized 2D
        arrays, which Zz looked into for me.
     */
    globe = Array(SPHERE_DETAIL + 1)
    for (let i = 0; i < globe.length; i++) {
        globe[i] = Array(SPHERE_DETAIL + 1)
    }
}

// prevent the context menu from showing up :3 nya~
document.oncontextmenu = function() {
    return false;
}

function renderCover() {
    push()
    bezierDetail(30)
    rotateX(PI/2)
    fill(184, 57, 95)
    circle(0, 0, r*2-1)

    fill(0, 0, 100); noStroke()

    translate(0, 0, -5)
    torus(r+1, 1, 100, 100)

    translate(0, 0, 5)
    fill(210, 100, 20)
    torus(r+10, 10, 100, 100)

    translate(0, 0, 1)
    circle(0, 0, r*2 + 3)
    pop()
}

function renderWires() {
    // iterate through a total of 12 rings, and create an angle out of it
    // compute the x and y using sine and cosine, respectively
    // rotate around the z-axis by angle

    push()
    rotateX(PI/2)


    for (let i = 0; i < 12; i++) {
        let angle = map(i, 0, 12, 0, TAU)
        let R = r+10

        let x = R * cos(angle)
        let y = R * sin(angle)

        push()
        translate(x, y)
        rotateZ(angle)
        // rotateX(angle)
        rotateX(PI/2)

        fill(210, 100, 20)
        torus(20, 10, 4, 100)

        pop()
    }
    pop()
}

function keyPressed() {
    if (key === "z") {
        // stop the recording and the sketch if you press a
        voice.stop()
        noLoop()
    }

    if (key === "s") {
        // starts the voice at jumpMillis/1000 seconds. if the audio context
        // isn't running, run it.
        voice.play()
        // voice.jump(jumpMillis/1000.0)
        voiceStartMillis = millis()
        if (getAudioContext().state !== 'running') {
            getAudioContext().resume().then(r => {});
        }
    }
}
