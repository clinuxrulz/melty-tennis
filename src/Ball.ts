import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import * as THREE from "three";

export function Ball(params: {
  position: Accessor<THREE.Vector3>,
  size: Accessor<number>,
  boundary: Accessor<THREE.Box3>,
  gravity: Accessor<THREE.Vector3>,
}): {
  render: (target: THREE.Object3D) => void,
  update: (dt: number) => void,
} {
  let position = createSignal(params.position, undefined, { equals: false, });
  let velocity = createSignal(new THREE.Vector3(2.0, 1.5, 2.0), { equals: false, });
  let render = (target: THREE.Object3D) => {
    let geometry = new THREE.SphereGeometry(params.size());
    let material = new THREE.MeshNormalMaterial();
    let mesh = new THREE.Mesh(geometry, material);
    target.add(mesh);
    onCleanup(() => {
      target.remove(mesh);
    });
    createEffect(
      position[0],
      (position) => {
        mesh.position.copy(position);
      },
    );
    {
      let box = params.boundary();
      let geometry = new THREE.BoxGeometry(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
      let material = new THREE.MeshNormalMaterial({
        transparent: true,
        opacity: 0.5,
        side: THREE.BackSide,
      });
      let mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0.5 * (box.min.x + box.max.x), 0.5 * (box.min.y + box.max.y), 0.5 * (box.min.z + box.max.z));
      target.add(mesh);
      onCleanup(() => {
        target.remove(mesh);
      });
    }
  };
  let tmpV1 = new THREE.Vector3();
  let update = (dt: number) => {
    dt = 1.0 / 60.0;
    let newVel = velocity[0]();
    tmpV1.set(0.0, -1.6, 0.0);
    tmpV1.multiplyScalar(dt);
    tmpV1.add(newVel);
    newVel.copy(tmpV1);
    tmpV1.copy(newVel);
    tmpV1.multiplyScalar(dt);
    let newPos = position[0]().add(tmpV1);
    let b = params.boundary();
    let r = 0.5 * params.size();
    if (newPos.x - r < b.min.x) {
      newPos.x = b.min.x + r;
      newVel.x = Math.abs(newVel.x);
    }
    if (newPos.x + r > b.max.x) {
      newPos.x = b.max.x - r;
      newVel.x = -Math.abs(newVel.x);
    }
    if (newPos.y - r < b.min.y) {
      newPos.y = b.min.y + r;
      newVel.y = Math.abs(newVel.y);
    }
    if (newPos.y + r > b.max.y) {
      newPos.y = b.max.y - r;
      newVel.y = -Math.abs(newVel.y);
    }
    if (newPos.z - r < b.min.z) {
      newPos.z = b.min.z + r;
      newVel.z = Math.abs(newVel.z);
    }
    if (newPos.z + r > b.max.z) {
      newPos.z = b.max.z - r;
      newVel.z = -Math.abs(newVel.z);
    }
    position[1](newPos);
    velocity[1](newVel);
  };
  return {
    render,
    update,
  };
}
