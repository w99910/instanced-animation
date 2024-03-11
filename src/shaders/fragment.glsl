precision mediump float;
varying vec3 vPosition;

uniform sampler2D state1;
uniform sampler2D state2;
uniform float uProgress;
varying vec2 vUv;

void main(){
    vec4 color = texture2D(state1, vUv);
    vec4 color2 = texture2D(state2, vec2(vUv.x, 1. - vUv.y));

    vec4 finalColor = mix(color,color2, uProgress);

    gl_FragColor = finalColor;
}