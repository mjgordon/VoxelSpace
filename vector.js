// Functions for working with vectors stored as simple arrays

function vectorCopy(v) {
    return v.slice();
}


function vectorLength(v) {
    return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2) + Math.pow(v[2], 2));
}


function vectorLength2D(v) {
    return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
}


function vectorMultScalar(v, s) {
    return [v[0] * s, v[1] * s, v[2] * s];
}


function vectorDivScalar(v, s) {
    return [v[0] / s, v[1] / s, v[2] / s];
}


function vectorAdd(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}


function vectorSub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}


function vectorSub2D(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}


function vectorDot(a, b) {
    return a.reduce((l,r,i)=>l+r*b[i],0);
}