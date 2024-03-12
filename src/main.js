import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as dat from "dat.gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
// import DRACOLoaderPath from "three/examples/jsm/libs/draco?url";

import fragmentShader from "./shaders/fragment.glsl";
import vertexShader from "./shaders/vertexShader.glsl";
import aoTexture from "./ao.png?url";
import box from "./bar.glb?url";

import whiteBox from './white_box.png?url';

import mmMap from './mm.jpeg?url';

const noise = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
  return 2.2 * n_xyz;
}`;

export default class MyThree {
  constructor(dom) {
    this.scene = new THREE.Scene();
    this.container = dom;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.setSize(this.width, this.height);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
    );
    this.gltfLoader.setDRACOLoader(dracoLoader);
    this.setupCamera();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // this.controls.listenToKeyEvents(window);
    // optional

    // this.controls.addEventListener("change", ()=> this.render); // call this only in static scenes (i.e., if there is no animation loop)

    // this.controls.minDistance = 0;
    // this.controls.maxDistance = 2000;

    // this.controls.maxPolarAngle = Math.PI / 2;
    this.setupMaterials();
    this.addObjects();
    this.addLights();
    this.setupFBO();
    this.render();

    this.setupGUI();
  }

  setupCamera() {
    this.frustrumSize = this.height;
    this.aspect = this.width / this.height;
    this.camera = new THREE.OrthographicCamera(
      (this.frustrumSize * this.aspect) / -2,
      (this.frustrumSize * this.aspect) / 2,
      this.frustrumSize / 2,
      -this.frustrumSize / 2,
      -2000,
      2000
    );
    this.camera.position.set(2, 2, 2);
  }

  addLights() {
    const light1 = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(light1);

    const spotLight = new THREE.SpotLight(0xffe9e9, 200);
    spotLight.position.set(-80 * 3, 200 * 3, -80 * 3);
    let target = new THREE.Object3D();

    target.position.set(0, -80, 200);
    spotLight.target = target;
    spotLight.angle = 1;
    spotLight.distance = 3000;
    spotLight.decay = 0.7;
    spotLight.penumbra = 1.5;

    this.scene.add(spotLight);
  }

  setupFBO() {
    this.fbo = new THREE.WebGLRenderTarget(this.width, this.height);
    this.fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    this.fboScene = new THREE.Scene();
    this.fboMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uFBO: { value: null },
        uProgress: { value: 0 },
        state1: { value: new THREE.TextureLoader().load(whiteBox) },
        state2: { value: new THREE.TextureLoader().load(mmMap) },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
    });

    this.fboGEO = new THREE.PlaneGeometry(2, 2);
    this.fboQuad = new THREE.Mesh(this.fboGEO, this.fboMaterial);
    this.fboScene.add(this.fboQuad);

    this.debug = new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({map: this.fbo.texture}))
    this.debug.position.y = 200;
    // this.scene.add(this.debug)
  }

  setupGUI() {
    this.gui = new dat.GUI();

    this.settings = {
      progress: 0,
    };

    this.gui.add(this.settings, "progress", 0, 1, 0.01).onChange((val) => {
      this.fboMaterial.uniforms.uProgress.value = val;
    });
  }

  setupMaterials() {
    this.aoTexture = new THREE.TextureLoader().load(aoTexture);
    this.aoTexture.flipY = false;

    this.aoMaterial = new THREE.MeshPhysicalMaterial({
      roughness: 0.75,
      aoMap: this.aoTexture,
      map: this.aoTexture,
      aoMapIntensity: 1.0,
    });

    this.uniforms = {
      time: { value: 0 },
      aoMap: { value: this.aoTexture },
      uFBO: { value: null },
      light_color: { value: new THREE.Color("#ffe9e9") },
      ramp_color_one: { value: new THREE.Color("#06082D") },
      ramp_color_two: { value: new THREE.Color("#020284") },
      ramp_color_three: { value: new THREE.Color("#0000ff") },
      ramp_color_four: { value: new THREE.Color("#71c7f5") },
    };

    this.aoMaterial.onBeforeCompile = (shader) => {
      shader.uniforms = Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `
          uniform sampler2D uFBO;
          uniform float time;
          uniform vec3 lightColor;
          uniform vec3 ramp_color_one;
          uniform vec3 ramp_color_two;
          uniform vec3 ramp_color_three;
          uniform vec3 ramp_color_four;
          attribute vec2 instanceUV;
          varying float vHeight;
          varying float vHeightUV;
          
          ${noise}
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        
        // float n = cnoise(vec3(instanceUV.x * 5., instanceUV.y * 5., time * 0.5));
        // transformed.y += n * 60.;
        vHeightUV = clamp(position.y * 2., 0., 1.);

        vec4 transition = texture2D(uFBO, instanceUV);
        transformed *= transition.g;
        transformed.y += transition.r * 100.;
        vHeight = transformed.y;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `
        #include <common>
        uniform vec3 light_color;
        uniform vec3 ramp_color_one;
        uniform vec3 ramp_color_two;
        uniform vec3 ramp_color_three; 
        uniform vec3 ramp_color_four;
        varying float vHeight; 
        varying float vHeightUV;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>

        vec3 highlight = mix(ramp_color_three, ramp_color_four, vHeightUV);
        diffuseColor.rgb = ramp_color_two;
        diffuseColor.rgb = mix(diffuseColor.rgb, ramp_color_three, vHeightUV);
        diffuseColor.rgb = mix(diffuseColor.rgb, highlight, clamp(vHeight / 10. - 3. , 0., 1.));
        `
      );
    };
  }

  addObjects() {
    this.gltfLoader.load(box, (box) => {
      this.cube = box.scene.children[0];
      this.cube.material = this.aoMaterial;
      // this.scene.add(this.cube);

      this.geometry = this.cube.geometry;
      this.geometry.scale(40, 40, 40);

      this.size = 60;
      let w = 50;
      this.instances = this.size ** 2;
      this.instanceMesh = new THREE.InstancedMesh(
        this.geometry,
        this.aoMaterial,
        this.instances
      );
      let dummy = new THREE.Object3D();
      let instanceUV = new Float32Array(this.instances * 2);
      for (let i = 0; i < this.size; i++) {
        for (let j = 0; j < this.size; j++) {
          instanceUV.set(
            [i / this.size, j / this.size],
            (i * this.size + j) * 2
          );

          dummy.position.set(
            w * (i - this.size / 2),
            0,
            w * (j - this.size / 2)
          );
          dummy.updateMatrix();

          this.instanceMesh.setMatrixAt(i * this.size + j, dummy.matrix);
        }
      }

      this.geometry.setAttribute(
        "instanceUV",
        new THREE.InstancedBufferAttribute(instanceUV, 2)
      );

      this.scene.add(this.instanceMesh);
    });
  }

  render() {
    if(this.uniforms?.time) this.uniforms.time.value += 0.001;
    if (this.controls) this.controls.update();
    window.requestAnimationFrame(this.render.bind(this));

    this.renderer.setRenderTarget(this.fbo);
    this.renderer.render(this.fboScene,this.fboCamera);

    this.renderer.setRenderTarget(null);
    this.uniforms.uFBO.value = this.fbo.texture;
    this.renderer.render(this.scene,this.camera)
  }
}
window.addEventListener("DOMContentLoaded", function () {
  const myThree = new MyThree(document.querySelector("#container"));
});
