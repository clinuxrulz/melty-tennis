import { render } from '@solidjs/web';
import { type Accessor, createSignal, createMemo, createEffect, createRoot, type Signal, untrack, onCleanup, For } from 'solid-js';
import type { ReactiveECS } from "./ReactiveECS";
import * as THREE from "three";
import { Joystick } from "./Joystick";
import { ActionButton } from "./ActionButton";
import { PowerMeter } from "./PowerMeter";
import { World, RegisteredDesiredMovement, RegisteredInputControlled, RegisteredAI, RegisteredServingState, RegisteredRacketSide } from "./World";
import { Player } from "./Player";
import { Court } from "./Court";
import { Ball } from "./Ball";
import { createRenderSystem } from "./systems/RenderSystem";
import { createInputProcessingSystem } from "./systems/InputProcessingSystem";
import { createPlayerMovementSystem } from "./systems/PlayerMovementSystem";
import { createBallPhysicsSystem } from "./systems/BallPhysicsSystem";
import { createServingSystem } from "./systems/ServingSystem";
import { createTennisRulesSystem } from "./systems/TennisRulesSystem";
import { createAISystem } from "./systems/AISystem";
import { createProceduralSounds } from "./systems/SoundSystem";
import { saveNetworkToFile, loadNetworkFromFile, trainNetwork, getTrainingBufferSize, initNetworkFromOPFS, autoSaveNetwork } from "./NNManager";
import { setUseNN as setAISystemUseNN } from "./systems/AISystem";

const [scoreP0, setScoreP0] = createSignal(0);
const [scoreP1, setScoreP1] = createSignal(0);
const [currentServer, setCurrentServer] = createSignal(0);
const [winTokensP0, setWinTokensP0] = createSignal(0);
const [winTokensP1, setWinTokensP1] = createSignal(0);
const [soundEnabled, setSoundEnabled] = createSignal(true);
const [aiVsAi, setAiVsAi] = createSignal(false);
const [useNN, setUseNN] = createSignal(false);
let nnFileInputEl: HTMLInputElement | undefined;

const TENNIS_POINTS = ["0", "15", "30", "40", "ADV"];

function formatScore(points: number, opponentPoints: number): string {
  if (points >= 4 && opponentPoints >= 4) {
    if (points === opponentPoints) return "40";
    return points > opponentPoints ? "ADV" : "40";
  }
  return TENNIS_POINTS[Math.min(points, 4)];
}

function renderWinTokens(count: number) {
  const tokens: any[] = [];
  if (count <= 4) {
    for (let i = 0; i < count; i++) {
      tokens.push(<div style={{
        width: "16px",
        height: "16px",
        "border-radius": "50%",
        background: "#ffd700",
        border: "2px solid #b8860b",
      }} />);
    }
  } else {
    tokens.push(<span style={{ "font-size": "14px", color: "#ffd700", "font-weight": "bold" }}>{count}x</span>);
    tokens.push(<div style={{
      width: "16px",
      height: "16px",
      "border-radius": "50%",
      background: "#ffd700",
      border: "2px solid #b8860b",
    }} />);
  }
  return tokens;
}

function ScoreBoard() {
  return (
    <>
    <div style={{
      position: "absolute",
      top: "10px",
      left: "50%",
      transform: "translateX(-50%)",
      "background-color": "rgba(0, 0, 0, 0.7)",
      color: "white",
      padding: "8px 15px",
      "border-radius": "5px",
      "font-family": "Arial, sans-serif",
      "font-size": "14px",
      display: "flex",
      "align-items": "center",
      gap: "10px",
      "z-index": 100,
    }}>
      <label style={{ display: "flex", "align-items": "center", gap: "4px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={soundEnabled()}
          onChange={(e) => setSoundEnabled(e.target.checked)}
        />
        <span>Sound</span>
      </label>
      <span style={{ color: "#888" }}>|</span>
      <label style={{ display: "flex", "align-items": "center", gap: "4px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={aiVsAi()}
          onChange={(e) => setAiVsAi(e.target.checked)}
        />
        <span>AI vs AI</span>
      </label>
      <span style={{ color: "#888" }}>|</span>
      <label style={{ display: "flex", "align-items": "center", gap: "4px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={useNN()}
          onChange={(e) => setUseNN(e.target.checked)}
        />
        <span>Use NN</span>
      </label>
      <button
        onClick={() => saveNetworkToFile()}
        style={{ "background": "#444", color: "white", border: "none", padding: "4px 8px", "border-radius": "3px", cursor: "pointer", "font-size": "12px" }}
      >
        Save NN
      </button>
      <button
        onClick={() => nnFileInputEl?.click()}
        style={{ "background": "#444", color: "white", border: "none", padding: "4px 8px", "border-radius": "3px", cursor: "pointer", "font-size": "12px" }}
      >
        Load NN
      </button>
      <input
        ref={nnFileInputEl}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadNetworkFromFile(file);
        }}
      />
    </div>
    <div style={{
      position: "absolute",
      top: "60px",
      left: "50%",
      transform: "translateX(-50%)",
      "background-color": "rgba(0, 0, 0, 0.7)",
      color: "white",
      padding: "15px 30px",
      "border-radius": "10px",
      "font-family": "Arial, sans-serif",
      "font-size": "24px",
      "font-weight": "bold",
      "text-align": "center",
      display: "flex",
      "flex-direction": "column",
      gap: "10px",
    }}>
      <div style={{ display: "flex", gap: "40px" }}>
        <div>
          <div style={{ "font-size": "14px", color: "#aaa" }}>P0</div>
          <div>{formatScore(scoreP0(), scoreP1())}</div>
          <div style={{ display: "flex", gap: "4px", "justify-content": "center", "margin-top": "4px", "flex-wrap": "wrap", "max-width": "60px" }}>
            {renderWinTokens(winTokensP0())}
          </div>
        </div>
        <div style={{ "font-size": "20px", color: "#888" }}>:</div>
        <div>
          <div style={{ "font-size": "14px", color: "#aaa" }}>P1</div>
          <div>{formatScore(scoreP1(), scoreP0())}</div>
          <div style={{ display: "flex", gap: "4px", "justify-content": "center", "margin-top": "4px", "flex-wrap": "wrap", "max-width": "60px" }}>
            {renderWinTokens(winTokensP1())}
          </div>
        </div>
      </div>
      <div style={{ "font-size": "12px", color: "#ffd700" }}>
        Serving: P{currentServer()}
      </div>
    </div>
    </>
  );
}

let [ canvasSize, setCanvasSize, ] = createSignal<THREE.Vector2>();

// Create world first to get access to ReactiveECS instance
let world = World();

// Now create players, court, and ball with the ReactiveECS from world
const player1Entity = Player({
  position: new THREE.Vector3(0.0, 0.0, 2.5),
  velocity: new THREE.Vector3(0.0, 0.0, 0.0),
  playerType: "Melty",
  facingForward: true,
  reactiveEcs: world.ecs,
});
world.ecs.add_component(player1Entity, RegisteredInputControlled, {});
world.ecs.add_component(player1Entity, RegisteredDesiredMovement, { x: 0, z: 0, jump: 0 });
world.ecs.add_component(player1Entity, RegisteredRacketSide, { side: 1 });

const player2Entity = Player({
  position: new THREE.Vector3(0.0, 0.0, -2.5),
  velocity: new THREE.Vector3(0.0, 0.0, 0.0),
  playerType: "Cubey",
  facingForward: false,
  reactiveEcs: world.ecs,
});
world.ecs.add_component(player2Entity, RegisteredAI, {});
world.ecs.add_component(player2Entity, RegisteredDesiredMovement, { x: 0, z: 0, jump: 0 });
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
world.ecs.add_component(servingEntity, RegisteredServingState, { phase: 0, serverPlayer: 0, throwTime: 0.0 });
initNetworkFromOPFS();

let [ upDown, setUpDown, ] = createSignal(false);
let [ downDown, setDownDown, ] = createSignal(false);
let [ leftDown, setLeftDown, ] = createSignal(false);
let [ rightDown, setRightDown, ] = createSignal(false);
let [ actionDown, setActionDown, ] = createSignal(false);

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

  let actionButtonSize = 80;
  let actionButton = ActionButton({
    position: createMemo(() =>
      new THREE.Vector2(
        (canvasSize()?.x ?? 0) - 50 - actionButtonSize,
        (canvasSize()?.y ?? 0) - 50 - actionButtonSize,
      )
    ),
    size: () => actionButtonSize,
    externalPressed: actionDown,
  });

  let powerMeterWidth = 30;
  let powerMeterHeight = 150;
  let powerMeter = PowerMeter({
    position: createMemo(() => ({
      x: (canvasSize()?.x ?? 0) - 50 - powerMeterWidth,
      y: (canvasSize()?.y ?? 0) - 50 - actionButtonSize - 20 - powerMeterHeight,
    })),
    width: () => powerMeterWidth,
    height: () => powerMeterHeight,
    power: actionButton.power,
  });

  let actionJustReleased = false;

  createEffect(
    () => aiVsAi(),
    (isAiVsAi) => {
      const p1 = world.ecs.entity(player1Entity);
      if (isAiVsAi) {
        if (!p1.hasComponent(RegisteredAI)) {
          world.ecs.remove_component(player1Entity, RegisteredInputControlled);
          world.ecs.add_component(player1Entity, RegisteredAI, {});
        }
      } else {
        if (p1.hasComponent(RegisteredAI)) {
          world.ecs.remove_component(player1Entity, RegisteredAI);
          world.ecs.add_component(player1Entity, RegisteredInputControlled, {});
        }
      }
    }
  );

  // Function to create and manage all systems
  const createGameSystems = (ecs: ReactiveECS, scene: THREE.Scene) => {
    const input = createInputProcessingSystem(ecs, upDown, downDown, leftDown, rightDown, joystick.value);
    const actionPressed = () => actionDown() || actionButton.pressed();
    const player = createPlayerMovementSystem(ecs);
    const ball = createBallPhysicsSystem(ecs, actionButton.power, () => actionJustReleased);
    const render = createRenderSystem(ecs, scene);
    const serving = createServingSystem(ecs, actionPressed, () => (leftDown() ? -1 : 0) + (rightDown() ? 1 : 0) + joystick.value().x, () => (upDown() ? -1 : 0) + (downDown() ? 1 : 0), actionButton.power, () => actionJustReleased);
    const tennisRules = createTennisRulesSystem(ecs, (p0, p1, server) => {
      setScoreP0(p0);
      setScoreP1(p1);
      setCurrentServer(server);
    }, (winner) => {
      if (winner === 0) {
        setWinTokensP0(winTokensP0() + 1);
      } else {
        setWinTokensP1(winTokensP1() + 1);
      }
    }, () => {
      setScoreP0(0);
      setScoreP1(0);
      setCurrentServer(0);
    });
    const ai = createAISystem(ecs);
    const sounds = createProceduralSounds(soundEnabled);
    
    setAISystemUseNN(useNN, aiVsAi);

    const disposers = [input.dispose, player.dispose, ball.dispose, serving.dispose, tennisRules.dispose, ai.dispose, sounds.dispose];

    return {
      update: (dt: number) => {
        actionJustReleased = actionButton.justReleased() || actionButton.justReleasedExternal();
        
        input.update();
        ai.update(dt);
        player.update(dt);
        ball.update(dt);
        serving.update(dt);
        tennisRules.update(dt);
        if (useNN() && aiVsAi()) {
          trainNetwork(0.001, 4);
        }
      },
      dispose: () => {
        disposers.forEach(d => d());
      },
      tennisRules,
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
    let accumulator: number = 0.0;
    const fixedTimeStep = 1.0 / 60.0;
    const maxAccumulatedTime = 0.25;

    let renderLoop = (t: number) => {
      let frameTime = lastT === 0.0 ? fixedTimeStep : (t - lastT) / 1000.0;
      lastT = t;
      
      if (frameTime > maxAccumulatedTime) frameTime = maxAccumulatedTime;
      accumulator += frameTime;

      while (accumulator >= fixedTimeStep) {
        systemDisposers.update(fixedTimeStep);
        accumulator -= fixedTimeStep;
      }

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
        position: "absolute",
        top: 0,
        left: 0,
        "z-index": 0,
      }}
    />
    <ScoreBoard />
    <joystick.UI/>
    <actionButton.UI/>
    <powerMeter.UI/>
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
      setActionDown(true);
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
      setActionDown(false);
      break;
  }
});
