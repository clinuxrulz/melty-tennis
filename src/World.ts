import { type Accessor, createSignal, createStore, createMemo, latest, type Signal } from "solid-js";
import { type Player } from "./Player";
import { type Court } from "./Court";
import { type Ball } from "./Ball";
import * as THREE from "three";
import { when } from "./util";

export function World(params: {
  player1?: ReturnType<typeof Player>,
  player2?: ReturnType<typeof Player>,
  court?: ReturnType<typeof Court>,
  ball?: ReturnType<typeof Ball>,
}): {
  player1: Signal<ReturnType<typeof Player> | undefined>,
  player2: Signal<ReturnType<typeof Player> | undefined>,
  court: Signal<ReturnType<typeof Court> | undefined>,
  ball: Signal<ReturnType<typeof Ball> | undefined>,
  update: (dt: number) => void,
  render: (target: THREE.Object3D) => void,
} {
  let [ state, setState, ] = createStore<{
    gameState: {
      type: "Serving",
      server: "Player 1" | "Player 2",
    } | {
      type: "In Play",
    },
  }>({
    gameState: {
      type: "Serving",
      server: "Player 1",
    },
  });
  //
  let player1 = createSignal(params.player1);
  let player2 = createSignal(params.player2);
  let court = createSignal(params.court);
  let ball = createSignal(params.ball);

  let update = (dt: number) => {
    let p1 = player1[0]();
    let c = court[0]();
    if (p1 != undefined) {
      let pos = p1.position;
      let newPos = latest(pos[0]).clone();
      if (c != undefined) {
        let courtWidth = c.width[0]();
        let courtLength = c.length[0]();
        if (newPos.x < -0.5 * courtWidth + 0.25) {
          newPos.x = -0.5 * courtWidth + 0.25;
        }
        if (newPos.x > 0.5 * courtWidth - 0.25) {
          newPos.x = +0.5 * courtWidth - 0.25;
        }
        if (newPos.z > +0.5 * courtLength - 0.25) {
          newPos.z = +0.5 * courtLength - 0.25;
        }
        if (newPos.z < 0.25) {
          newPos.z = 0.25;
        }
      }
      pos[1](newPos);
    }
    ball[0]()?.update(dt);
  };

  let render = (target: THREE.Object3D) => {
    let hasCourt = createMemo(() => court[0]() != undefined);
    createMemo(() => {
      if (!hasCourt()) {
        return;
      }
      let c = court[0] as Accessor<NonNullable<ReturnType<typeof court[0]>>>;
      createMemo(() => c().render(target));
    });
    when(player1[0], (p) => {
      createMemo(() => p().render(target));
    });
    when(player2[0], (p) => {
      createMemo(() => p().render(target));
    });
    when(ball[0], (b) => {
      createMemo(() => b().render(target));
    });
  };

  return {
    player1,
    player2,
    court,
    ball,
    update,
    render,
  };
}
