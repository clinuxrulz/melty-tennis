import { createSignal, type Accessor, type Component, type Signal } from "solid-js";
import * as THREE from "three";

export function JumpButton(params: {
  position: Accessor<THREE.Vector2>,
  size: Accessor<number>,
}): {
  position: Signal<THREE.Vector2>,
  size: Signal<number>,
  pressed: Accessor<boolean>,
  UI: Component,
} {
  let position = createSignal(params.position);
  let size = createSignal(params.size());
  let [ pressed, setPressed ] = createSignal(false);

  let UI: Component = () => {
    let [ hitDiv, setHitDiv, ] = createSignal<HTMLDivElement>();
    let hitPointerId: number | undefined = undefined;
    let hitAreaOnPointerDown = (e: PointerEvent) => {
      let div = hitDiv();
      if (div == undefined) {
        return;
      }
      hitPointerId = e.pointerId;
      div.setPointerCapture(hitPointerId);
      setPressed(true);
    };
    let hitAreaOnPointerUp = (e: PointerEvent) => {
      let div = hitDiv();
      if (div == undefined) {
        return;
      }
      if (hitPointerId == undefined) {
        return;
      }
      setPressed(false);
    };
    return (
      <div
        ref={setHitDiv}
        style={{
          "position": "absolute",
          "left": `${position[0]().x}px`,
          "top": `${position[0]().y}px`,
          "width": `${size[0]()}px`,
          "height": `${size[0]()}px`,
          "border-radius": `${0.5 * size[0]()}px`,
          "background-color": pressed() ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)",
          "user-select": "none",
          "touch-action": "none",
        }}
        onPointerDown={hitAreaOnPointerDown}
        onPointerUp={hitAreaOnPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    );
  };

  return {
    position,
    size,
    pressed,
    UI,
  };
}