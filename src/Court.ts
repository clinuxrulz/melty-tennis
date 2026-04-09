import { createMemo, createSignal, type Signal, onCleanup } from "solid-js";
import * as THREE from "three";

export function Court(params: {
  width: number,
  length: number,
  netHeight: number,
}): {
  width: Signal<number>,
  length: Signal<number>,
  netHeight: Signal<number>,
  render: (target: THREE.Object3D) => void,
} {
  let width = createSignal(params.width);
  let length = createSignal(params.length);
  let netHeight = createSignal(params.netHeight);

  let render = (target: THREE.Object3D) => {
    createMemo(() => {
      let w = width[0]();
      let l = length[0]();
      let geometry = new THREE.BoxGeometry(w, 0.1, l);
      let material = new THREE.MeshNormalMaterial();
      let mesh = new THREE.Mesh(geometry, material);
      mesh.position.y -= 0.05;
      target.add(mesh);
      onCleanup(() => {
        target.remove(mesh);
        geometry.dispose();
        material.dispose();
      });
    });
    createMemo(() => {
      let w = width[0]();
      let nh = netHeight[0]();
      let geometry = new THREE.BoxGeometry(w, nh, 0.1);
      let material = new THREE.MeshNormalMaterial({
        transparent: true,
        opacity: 0.5
      });
      let mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.5 * nh;
      target.add(mesh);
      onCleanup(() => {
        target.remove(mesh);
      });
    });
  };

  return {
    width,
    length,
    netHeight,
    render,
  };
}
