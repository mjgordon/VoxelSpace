"use strict";

class Color {

    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;

        this.c = Color.rgbToInt(r, g, b);
    }

    static rgbToInt(r, g, b) {
        return (r << 16) + (g << 8) + (b)
    }
    
    static intToRGB(c) {
        return {
            r: (c & 0xff0000) >> 16, 
            g: (c & 0x00ff00) >> 8, 
            b: (c & 0x0000ff)
        };
    }
}





// ---------------------------------------------
// Viewer information

var camera =
{
    x:        512., // x position on the map
    y:        800., // y position on the map
    height:    78., // height of the camera
    angle:      0., // direction of the camera
    horizon:  100., // horizon position (look up and down)
    distance: 800   // distance of map
};

class Sphere {
    constructor(x, y, z) {
        this.px = x;
        this.py = y;
        this.pz = z;
        this.r = 100;
        this.color = new Color(255, 0, 0);
    }

    distance(x,y) {
        return Math.sqrt(Math.pow(x - this.px, 2) + Math.pow(y - this.py, 2));
    }

    footprintContains(x, y) {
        if (Math.abs(this.px - x) < this.r && Math.abs(this.py - y) < this.r) {
            return this.distance(x,y) < this.r;
        }
        return false;
    }

    /**
     * Returns the height and color values at the requested position
     * @param {*} x 
     * @param {*} y 
     * @returns 
     */
    getSlice(x, y) {
        var d = this.distance(x,y);
        var normalizedD = Math.min(1, d / this.r);
        var zDiff = Math.sin(Math.acos(normalizedD)) * this.r;




        return [this.pz - zDiff, this.pz + zDiff];
    }
};

// ---------------------------------------------
// Landscape data

var map =
{
    width:    1024,
    height:   1024,
    shift:    10,  // power of two: 2^10 = 1024
    altitude: new Uint8Array(1024*1024), // 1024 * 1024 byte array with height information
    color:    new Uint32Array(1024*1024), // 1024 * 1024 int array with RGB colors
    spheres: [new Sphere(0, 0, 300)],
    sunX: Math.sqrt(2) / 2,
    sunY: 0,
    sunZ: -Math.sqrt(2) / 2
};

// ---------------------------------------------
// Screen data

var screendata =
{
    canvas:    null,
    context:   null,
    imagedata: null,

    bufarray:  null, // color data
    buf8:      null, // the same array but with bytes
    buf32:     null, // the same array but with 32-Bit words

    backgroundcolor: 0xFFE09090
};

// ---------------------------------------------
// Keyboard and mouse interaction

var input =
{
    forwardbackward: 0,
    leftright:       0,
    updown:          0,
    lookup:          false,
    lookdown:        false,
    mouseposition:   null,
    keypressed:      false
}

var updaterunning = false;

var time = new Date().getTime();


// for fps display
var timelastframe = new Date().getTime();
var frames = 0;

// Update the camera for next frame. Dependent on keypresses
function UpdateCamera()
{
    var current = new Date().getTime();

    input.keypressed = false;
    if (input.leftright != 0)
    {
        camera.angle += input.leftright*0.1*(current-time)*0.03;
        input.keypressed = true;
    }
    if (input.forwardbackward != 0)
    {
        camera.x -= input.forwardbackward * Math.sin(camera.angle) * (current-time)*0.03;
        camera.y -= input.forwardbackward * Math.cos(camera.angle) * (current-time)*0.03;
        input.keypressed = true;
    }
    if (input.updown != 0)
    {
        camera.height += input.updown * (current-time)*0.03;
        input.keypressed = true;
    }
    if (input.lookup)
    {
        camera.horizon += 2 * (current-time)*0.03;
        input.keypressed = true;
    }
    if (input.lookdown)
    {
        camera.horizon -= 2 * (current-time)*0.03;
        input.keypressed = true;
    }

    // Collision detection. Don't fly below the surface.
    var mapoffset = ((Math.floor(camera.y) & (map.width-1)) << map.shift) + (Math.floor(camera.x) & (map.height-1))|0;
    if ((map.altitude[mapoffset]+10) > camera.height) camera.height = map.altitude[mapoffset] + 10;

    time = current;

}

// ---------------------------------------------
// Keyboard and mouse event handlers
// ---------------------------------------------
// Keyboard and mouse event handlers

function GetMousePosition(e)
{
    // fix for Chrome
    if (e.type.startsWith('touch'))
    {
        return [e.targetTouches[0].pageX, e.targetTouches[0].pageY];
    } else
    {
        return [e.pageX, e.pageY];
    }
}


function DetectMouseDown(e)
{
    input.forwardbackward = 3.;
    input.mouseposition = GetMousePosition(e);
    time = new Date().getTime();

    if (!updaterunning) Draw();
    return;
}

function DetectMouseUp()
{
    input.mouseposition = null;
    input.forwardbackward = 0;
    input.leftright = 0;
    input.updown = 0;
    return;
}

function DetectMouseMove(e)
{
    e.preventDefault();
    if (input.mouseposition == null) return;
    if (input.forwardbackward == 0) return;

    var currentMousePosition = GetMousePosition(e);

    input.leftright = (input.mouseposition[0] - currentMousePosition[0]) / window.innerWidth * 2;
    camera.horizon  = 100 + (input.mouseposition[1] - currentMousePosition[1]) / window.innerHeight * 500;
    input.updown    = (input.mouseposition[1] - currentMousePosition[1]) / window.innerHeight * 10;
}


function DetectKeysDown(e)
{
    switch(e.keyCode)
    {
    case 37:    // left cursor
    case 65:    // a
        input.leftright = +1.;
        break;
    case 39:    // right cursor
    case 68:    // d
        input.leftright = -1.;
        break;
    case 38:    // cursor up
    case 87:    // w
        input.forwardbackward = 3.;
        break;
    case 40:    // cursor down
    case 83:    // s
        input.forwardbackward = -3.;
        break;
    case 82:    // r
        input.updown = +2.;
        break;
    case 70:    // f
        input.updown = -2.;
        break;
    case 69:    // e
        input.lookup = true;
        break;
    case 81:    //q
        input.lookdown = true;
        break;
    default:
        return;
        break;
    }

    if (!updaterunning) {
        time = new Date().getTime();
        Draw();
    }
    return false;
}

function DetectKeysUp(e)
{
    switch(e.keyCode)
    {
    case 37:    // left cursor
    case 65:    // a
        input.leftright = 0;
        break;
    case 39:    // right cursor
    case 68:    // d
        input.leftright = 0;
        break;
    case 38:    // cursor up
    case 87:    // w
        input.forwardbackward = 0;
        break;
    case 40:    // cursor down
    case 83:    // s
        input.forwardbackward = 0;
        break;
    case 82:    // r
        input.updown = 0;
        break;
    case 70:    // f
        input.updown = 0;
        break;
    case 69:    // e
        input.lookup = false;
        break;
    case 81:    //q
        input.lookdown = false;
        break;
    default:
        return;
        break;
    }
    return false;
}

// ---------------------------------------------
// Fast way to draw vertical lines

function DrawVerticalLine(x, ytop, ybottom, col)
{
    x = x|0;
    ytop = ytop|0;
    ybottom = ybottom|0;
    col = col|0;
    var buf32 = screendata.buf32;
    var screenwidth = screendata.canvas.width|0;
    if (ytop < 0) ytop = 0;
    if (ytop > ybottom) return;

    // get offset on screen for the vertical line
    var offset = ((ytop * screenwidth) + x)|0;
    for (var k = ytop|0; k < ybottom|0; k=k+1|0)
    {
        buf32[offset|0] = col|0;
        offset = offset + screenwidth|0;
    }
}

// ---------------------------------------------
// Basic screen handling

function DrawBackground()
{
    var buf32 = screendata.buf32;
    var color = screendata.backgroundcolor|0;
    for (var i = 0; i < buf32.length; i++) buf32[i] = color|0;
}

// Show the back buffer on screen
function Flip()
{
    screendata.imagedata.data.set(screendata.buf8);
    screendata.context.putImageData(screendata.imagedata, 0, 0);
}

// ---------------------------------------------
// The main render routine

function Render() {
    var mapwidthperiod = map.width - 1;
    var mapheightperiod = map.height - 1;

    var screenWidth = screendata.canvas.width|0;
    var sinang = Math.sin(camera.angle);
    var cosang = Math.cos(camera.angle);

    var hiddeny = new Int32Array(screenWidth);
    for(var sx=0; sx<screendata.canvas.width|0; sx=sx+1|0)
        hiddeny[sx] = screendata.canvas.height;

    var deltaz = 1.;
    var ddz = 0.005; // delta delta z

    // Initial dumb count of how many rows
    var rowCount = 0;
    for (var z = 1; z < camera.distance; z += deltaz) {
        deltaz += ddz;
        rowCount += 1;
    }
    console.log(rowCount);

    // Record the hidden y values as they are after each row
    var yMap = new Uint32Array(screenWidth * rowCount)

    // Draw terrain from front to back
    deltaz = 1;
    var rowId = 0;
    var zMap = new Array(rowCount);
    for (var z=1; z<camera.distance; z+=deltaz) {
        zMap[rowId] = z;
        // 90 degree field of view
        // Coordinates of extremes
        var plx =  -cosang * z - sinang * z;
        var ply =   sinang * z - cosang * z;
        var prx =   cosang * z - sinang * z;
        var pry =  -sinang * z - cosang * z;

        var dx = (prx - plx) / screenWidth;
        var dy = (pry - ply) / screenWidth;
        plx += camera.x;
        ply += camera.y;
        var invz = 1. / z * 240.;
        for(var sx = 0; sx < screenWidth|0; sx = sx + 1 | 0) {
            var mapoffset = ((Math.floor(ply) & mapwidthperiod) << map.shift) + (Math.floor(plx) & mapheightperiod)|0;
            var heightonscreen = (camera.height - map.altitude[mapoffset]) * invz + camera.horizon|0;
            DrawVerticalLine(sx, heightonscreen|0, hiddeny[sx], map.color[mapoffset]);
            if (heightonscreen < hiddeny[sx]) {
                hiddeny[sx] = heightonscreen;
            }
            var yId =  rowId * screenWidth + sx;
            yMap[yId] = hiddeny[sx];
            plx += dx;
            ply += dy;
        }
        deltaz += ddz; 
        rowId += 1;
    }

    // Draw Objects from back to front
    for (var rowId = 0; rowId < rowCount; rowId++) {
        var z = zMap[rowId];
        var plx =  -cosang * z - sinang * z;
        var ply =   sinang * z - cosang * z;
        var prx =   cosang * z - sinang * z;
        var pry =  -sinang * z - cosang * z;

        var dx = (prx - plx) / screenWidth;
        var dy = (pry - ply) / screenWidth;
        plx += camera.x;
        ply += camera.y;

        var invz = 1. / z * 240.;
        

        for (var sx = 0; sx < screenWidth | 0; sx = sx + 1 | 0) {
            var yId =  rowId * screenWidth + sx;
            for (var i = 0; i < map.spheres.length; i++) {
                var sphere = map.spheres[i];
                
                if (sphere.footprintContains(plx, ply)) {
                    var bounds = sphere.getSlice(plx, ply);
                    var syLow = (camera.height - bounds[0]) * invz + camera.horizon|0;
                    var syHigh = (camera.height - bounds[1]) * invz + camera.horizon|0;
                              
                    syHigh = Math.min(syHigh, yMap[yId]);
                    if (syLow < yMap[yId]) {
                        DrawVerticalLine(sx, syHigh, syLow, 0xFFFF0000);
                    }
                }
            }
            plx += dx;
            ply += dy;
        }
    }
    DrawVerticalLine(100,100,200,0xFFFF0000);
    DrawVerticalLine(110,100,200,0xFF00FF00);
    DrawVerticalLine(120,100,200,0xFF0000FF);
    
}


// ---------------------------------------------
// Draw the next frame

function Draw() {
    updaterunning = true;
    UpdateCamera();
    DrawBackground();
    Render();
    Flip();
    frames++;

    if (!input.keypressed) {
        updaterunning = false;
    } else {
        window.requestAnimationFrame(Draw, 0);
    }
}

// ---------------------------------------------
// Init routines



function OnResizeWindow()
{
    screendata.canvas = document.getElementById('fullscreenCanvas');

    var aspect = window.innerWidth / window.innerHeight;

    screendata.canvas.width = window.innerWidth < 800 ? window.innerWidth : 800;
    screendata.canvas.height = screendata.canvas.width / aspect;

    if (screendata.canvas.getContext)
    {
        screendata.context = screendata.canvas.getContext('2d');
        screendata.imagedata = screendata.context.createImageData(screendata.canvas.width, screendata.canvas.height);
    }

    screendata.bufarray = new ArrayBuffer(screendata.imagedata.width * screendata.imagedata.height * 4);
    screendata.buf8     = new Uint8Array(screendata.bufarray);
    screendata.buf32    = new Uint32Array(screendata.bufarray);
    Draw();
}

function Init()
{
    for(var i=0; i<map.width*map.height; i++)
    {
        map.color[i] = 0xFF007050;
        map.altitude[i] = 0;
    }

    LoadMap("C1W;D1");
    OnResizeWindow();

    // set event handlers for keyboard, mouse, touchscreen and window resize
    var canvas = document.getElementById("fullscreenCanvas");
    window.onkeydown    = DetectKeysDown;
    window.onkeyup      = DetectKeysUp;
    canvas.onmousedown  = DetectMouseDown;
    canvas.onmouseup    = DetectMouseUp;
    canvas.onmousemove  = DetectMouseMove;
    canvas.ontouchstart = DetectMouseDown;
    canvas.ontouchend   = DetectMouseUp;
    canvas.ontouchmove  = DetectMouseMove;

    window.onresize       = OnResizeWindow;

    window.setInterval(function(){
        var current = new Date().getTime();
        document.getElementById('fps').innerText = (frames / (current-timelastframe) * 1000).toFixed(1) + " fps";
        frames = 0;
        timelastframe = current;
    }, 2000);

}

Init();