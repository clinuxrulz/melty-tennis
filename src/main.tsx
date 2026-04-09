import { render } from '@solidjs/web';
import { type Accessor, createSignal, createMemo, createEffect, createStore, type Signal, untrack } from 'solid-js';
import * as THREE from "three";
import { Joystick } from "./Joystick";
import { World } from "./World";
import { Player } from "./Player";
import { Court } from "./Court";
import { Ball } from "./Ball";

let [ canvasSize, setCanvasSize, ] = createSignal<THREE.Vector2>();

let gravity = new THREE.Vector3(0.0, -10, 0.0);

let world = World({
  player1: Player({
    position: new THREE.Vector3(0.0, 0.0, 2.5),
    velocity: new THREE.Vector3(0.0, 0.0, 0.0),
    playerType: "Melty",
    facingForward: true,
  }),
  player2: Player({
    position: new THREE.Vector3(0.0, 0.0, -2.5),
    velocity: new THREE.Vector3(0.0, 0.0, 0.0),
    playerType: "Cubey",
    facingForward: false,
  }),
  court: Court({
    width: 4.0,
    length: 6.0,
    netHeight: 0.5,
  }),
  ball: Ball({
    position: createMemo(() => new THREE.Vector3(0.0, 1.0, 1.0)),
    size: createMemo(() => 0.1),
    boundary: createMemo(() =>
      new THREE.Box3(
        new THREE.Vector3(-2.0, 0.0, -3.0),
        new THREE.Vector3(2.0, 2.5, 3.0),
      ),
    ),
    gravity: () => gravity,
  }),
});

let [ upDown, setUpDown, ] = createSignal(false);
let [ downDown, setDownDown, ] = createSignal(false);
let [ leftDown, setLeftDown, ] = createSignal(false);
let [ rightDown, setRightDown, ] = createSignal(false);
let [ jumpDown, setJumpDown, ] = createSignal(false);

function App() {
  let joystickHitAreaSize = 150;
  let joystick = Joystick({
    position: createMemo(() =>
      new THREE.Vector2(
        50.0,
        (canvasSize()?.y ?? 0) - 50 - joystickHitAreaSize,
      )
    ),
    hitAreaSize: joystickHitAreaSize,
    outerRingSize: () => 0.8 * joystickHitAreaSize,
    knobSize: () => 70,
  });
  createMemo(() => {
    //alert((canvasSize()?.y ?? 0) - 50 - joystickHitAreaSize);
  });
  let animating = createMemo(() => {
    return true;
    if (jumpDown()) {
      return true;
    }
    let player1 = world.player1[0]();
    if (player1 != undefined) {
      let pos = player1.position[0]();
      if (pos.y > 0.0) {
        return true;
      }
      let vel = player1.velocity[0]();
      if (vel.x != 0.0 || vel.y != 0.0 || vel.z != 0.0) {
        return true;
      }
    }
    return upDown() || downDown() || leftDown() || rightDown() || joystick.value().x != 0.0 || joystick.value().y != 0.0;
  }); 
  let [ canvas, setCanvas, ] = createSignal<HTMLCanvasElement>();
  createEffect(canvas, (canvas: HTMLCanvasElement | undefined) => {
    if (canvas == undefined) {
      return;
    }
    let rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width == 0 && height == 0) {
      setCanvas(undefined);
      setTimeout(() => setCanvas(canvas));
      return;
    }
    let resizeObserver = new ResizeObserver(() => {
      let rect = canvas.getBoundingClientRect();
      setCanvasSize(new THREE.Vector2(
        rect.width,
        rect.height,
      ));
    });
    resizeObserver.observe(canvas);
    // TODO resizeOberver cleanup

    //
    const camera = new THREE.PerspectiveCamera( 50, width / height, 0.01, 10 );
    camera.position.set(0,2,6);
    camera.lookAt(new THREE.Vector3());

    const scene = new THREE.Scene();

    // Ambient light (soft, overall light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Directional light (sun-like light)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    world.render(scene);

    const renderer = new THREE.WebGLRenderer( { antialias: true, canvas, } );
    renderer.setSize( width, height );
    console.log("width", width);
    console.log("height", height);
    let updateFrame = (dt: number) => {
      let player1 = world.player1[0]();
      if (player1 != undefined) {
        let pos = player1.position;
        let vel = player1.velocity;
        let newPos = pos[0]().clone();
        let newVel = vel[0]().clone();
        if (leftDown()) {
          newPos.x -= 0.05;
        }
        if (rightDown()) {
          newPos.x += 0.05;
        }
        if (downDown()) {
          newPos.z += 0.05;
        }
        if (upDown()) {
          newPos.z -= 0.05;
        }
        newPos.x += joystick.value().x * 0.1;
        newPos.z += joystick.value().y * 0.1;
        if (newPos.y == 0.0) {
          if (jumpDown()) {
            newVel.y = 5.0;
          }
        } else if (newPos.y > 0.0) {
          newVel.add(gravity.clone().multiplyScalar(1.0 / 60.0));
        }
        newPos.add(newVel.clone().multiplyScalar(1.0 / 60.0));
        if (newPos.y <= 0.0) {
          newPos.y = 0.0;
          newVel.y = 0.0;
        }
        pos[1](newPos);
        vel[1](newVel);
      }
      world.update(dt);
    };
    let aboutToRender = false;
    let firstFrame = false;
    let lastT: number = 0.0;
    let render = (t: number) => {
      let dt = firstFrame ? t - 1.0/60.0 : t - lastT;
      firstFrame = false;
      lastT = t;
      renderer.render(scene, camera);
      if (animating()) {
        updateFrame(dt);
        aboutToRender = true;
        requestAnimationFrame(render);
      } else {
        lastT = 0.0;
        aboutToRender = false;
      }
    };
    firstFrame = true;
    requestAnimationFrame(render);
    createEffect(animating, (animating) => {
      if (animating && !aboutToRender) {
        firstFrame = true;
        requestAnimationFrame(render);
      }
    });
  });
  return (<>
    <canvas
      ref={setCanvas}
      style={{
        "width": "100%",
        "height": "100%",
      }}
    />
    <joystick.UI/>
  </>);
}

document.body.style.setProperty("overflow", "hidden");

let div = document.createElement("div");
div.style.setProperty("position", "absolute");
div.style.setProperty("left", "0");
div.style.setProperty("top", "0");
div.style.setProperty("right", "0");
div.style.setProperty("bottom", "0");
div.style.setProperty("background-color", "black");
document.body.append(div);

render(() => <App />, div);

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":
      setUpDown(true);
      break;
    case "ArrowDown":
      setDownDown(true);
      break;
    case "ArrowLeft":
      setLeftDown(true);
      break;
    case "ArrowRight":
      setRightDown(true);
      break;
    case " ":
      setJumpDown(true);
      break;
  }
});

document.addEventListener("keyup", (e) => {
  switch (e.key) {
    case "ArrowUp":
      setUpDown(false);
      break;
    case "ArrowDown":
      setDownDown(false);
      break;
    case "ArrowLeft":
      setLeftDown(false);
      break;
    case "ArrowRight":
      setRightDown(false);
      break;
    case " ":
      setJumpDown(false);
      break;
  }
});
