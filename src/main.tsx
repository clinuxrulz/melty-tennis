import { render } from '@solidjs/web';
import { type Accessor, createSignal, createMemo, createEffect, createRoot, type Signal, untrack, onCleanup } from 'solid-js';
import type { ReactiveECS } from "./ReactiveECS";
import * as THREE from "three";
import { Joystick } from "./Joystick";
import { JumpButton } from "./JumpButton";
import { World, RegisteredDesiredMovement, RegisteredInputControlled, RegisteredServingState, RegisteredRacketSide } from "./World";
import { Player } from "./Player";
import { Court } from "./Court";
import { Ball } from "./Ball";
import { createRenderSystem } from "./systems/RenderSystem";
import { createInputProcessingSystem } from "./systems/InputProcessingSystem";
import { createPlayerMovementSystem } from "./systems/PlayerMovementSystem";
import { createBallPhysicsSystem } from "./systems/BallPhysicsSystem";
import { createServingSystem } from "./systems/ServingSystem";
import { createTennisRulesSystem } from "./systems/TennisRulesSystem";

let [ canvasSize, setCanvasSize, ] = createSignal<THREE.Vector2>();

// Create world first to get access to ReactiveECS instance
let world = World();

// Now create players, court, and ball with the ReactiveECS from world
const player1Entity = Player({
  position: new THREE.Vector3(0.0, 0.0, -2.5),
  velocity: new THREE.Vector3(0.0, 0.0, 0.0),
  playerType: "Melty",
  facingForward: true,
  reactiveEcs: world.ecs,
});
world.ecs.add_component(player1Entity, RegisteredInputControlled, {});
world.ecs.add_component(player1Entity, RegisteredDesiredMovement, { x: 0, z: 0 });
world.ecs.add_component(player1Entity, RegisteredRacketSide, { side: 1 });

const player2Entity = Player({
  position: new THREE.Vector3(0.0, 0.0, 2.5),
  velocity: new THREE.Vector3(0.0, 0.0, 0.0),
  playerType: "Cubey",
  facingForward: false,
  reactiveEcs: world.ecs,
});
world.ecs.add_component(player2Entity, RegisteredDesiredMovement, { x: 0, z: 0 });
world.ecs.add_component(player2Entity, RegisteredRacketSide, { side: -1 });

const courtEntity = Court({
  width: 10.97,
  length: 23.77,
  netHeight: 0.914,
  reactiveEcs: world.ecs,
});

const ballEntity = Ball({
  position: createMemo(() => new THREE.Vector3(0.0, 0.1, 2.5)),
  size: createMemo(() => 0.1),
  boundary: createMemo(() =>
    new THREE.Box3(
      new THREE.Vector3(-5.5, 0.0, -12.0),
      new THREE.Vector3(5.5, 5.0, 12.0),
    ),
  ),
  reactiveEcs: world.ecs,
});

const servingEntity = world.ecs.create_entity();
world.ecs.add_component(servingEntity, RegisteredServingState, { phase: 0, serverPlayer: 1, throwTime: 0.0 });

let [ upDown, setUpDown, ] = createSignal(false);
let [ downDown, setDownDown, ] = createSignal(false);
let [ leftDown, setLeftDown, ] = createSignal(false);
let [ rightDown, setRightDown, ] = createSignal(false);
let [ jumpDown, setJumpDown, ] = createSignal(false);

function App() {
  debugger;
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

  let jumpButtonSize = 80;
  let jumpButton = JumpButton({
    position: createMemo(() =>
      new THREE.Vector2(
        (canvasSize()?.x ?? 0) - 50 - jumpButtonSize,
        (canvasSize()?.y ?? 0) - 50 - jumpButtonSize,
      )
    ),
    size: () => jumpButtonSize,
  });

  // Function to create and manage all systems
  const createGameSystems = (ecs: ReactiveECS, scene: THREE.Scene) => {
    const input = createInputProcessingSystem(ecs, upDown, downDown, leftDown, rightDown, joystick.value);
    const jumpDownBoth = () => jumpDown() || jumpButton.pressed();
    const player = createPlayerMovementSystem(ecs, jumpDownBoth);
    const ball = createBallPhysicsSystem(ecs);
    const render = createRenderSystem(ecs, scene);
    const serving = createServingSystem(ecs, jumpDownBoth);
    const tennisRules = createTennisRulesSystem(ecs);

    const disposers = [input.dispose, player.dispose, ball.dispose, serving.dispose, tennisRules.dispose];

    return {
      update: (dt: number) => {
        input.update();
        player.update(dt);
        ball.update(dt);
        serving.update(dt);
        tennisRules.update(dt);
      },
      dispose: () => {
        disposers.forEach(d => d());
      },
    };
  };

  let animating = createMemo(() => {
    // This memo now only controls if the requestAnimationFrame loop continues.
    // The actual game logic is handled reactively by systems.
    return true; 
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

    const camera = new THREE.PerspectiveCamera( 50, width / height, 0.01, 100 );
    camera.position.set(0, 15, 16);
    camera.lookAt(0, 0, -2);

    const scene = new THREE.Scene();

    // Ambient light (soft, overall light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Directional light (sun-like light)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    
    // Initialize all systems
    const systemDisposers = createGameSystems(world.ecs, scene);

    const renderer = new THREE.WebGLRenderer( { antialias: true, canvas, } );
    renderer.setSize( width, height );

    let lastT: number = 0.0;
    let renderLoop = (t: number) => {
      let deltaTime = lastT === 0.0 ? 1.0 / 60.0 : (t - lastT) / 1000.0;
      lastT = t;
      systemDisposers.update(deltaTime);

      renderer.render(scene, camera);
      if (animating()) {
        requestAnimationFrame(renderLoop);
      }
    };
    requestAnimationFrame(renderLoop);

    onCleanup(() => {
        systemDisposers.dispose();
        renderer.dispose();
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
    <jumpButton.UI/>
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
