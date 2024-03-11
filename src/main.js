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
import fbo from "./fbo.png?url";

import whiteBox from './white_box.png?url';

import mmMap from './mm.jpeg?url';

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
    spotLight.position.set(-80, 200, -80);
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
  }

  setupGUI() {
    this.gui = new dat.GUI();

    this.settings = {
      progress: 0,
    };

    this.gui.add(this.settings, "progress", 0, 1, 0.1).onChange((val) => {
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
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>

        vHeightUV = clamp(position.y * 2., 0., 1.);

        vec4 transition = texture2D(uFBO, instanceUV);
        transformed *= transition.g;
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
      this.scene.add(this.cube);

      this.geometry = this.cube.geometry;
      this.geometry.scale(40, 40, 40);

      this.size = 40;
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
