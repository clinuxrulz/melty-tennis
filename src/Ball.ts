import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import * as THREE from "three";
import type { ReactiveECS } from "./ReactiveECS";
import type { EntityID } from "@oasys/oecs";
import { RegisteredPosition, RegisteredVelocity, RegisteredBallConfig, RegisteredBoundary, RegisteredGravityAffected } from "./World";

export function Ball(params: {
  position: Accessor<THREE.Vector3>,
  size: Accessor<number>,
  boundary: Accessor<THREE.Box3>,
  reactiveEcs: ReactiveECS,
}): EntityID {
  const ecs = params.reactiveEcs;
  
  const initialPos = params.position();
  const initialVel = new THREE.Vector3(0.0, 0.0, 0.0);
  const entityId = ecs.create_entity();
  
  ecs.add_component(entityId, RegisteredPosition, { x: initialPos.x, y: initialPos.y, z: initialPos.z });
  ecs.add_component(entityId, RegisteredVelocity, { x: initialVel.x, y: initialVel.y, z: initialVel.z });
  ecs.add_component(entityId, RegisteredBallConfig, { size: params.size() });
  
  const ballBoundary = params.boundary();
  ecs.add_component(entityId, RegisteredBoundary, {
    minX: ballBoundary.min.x, minY: ballBoundary.min.y, minZ: ballBoundary.min.z,
    maxX: ballBoundary.max.x, maxY: ballBoundary.max.y, maxZ: ballBoundary.max.z,
  });
  ecs.add_component(entityId, RegisteredGravityAffected, {});
  // Renderable component will be added by the RenderSystem
  
  return entityId;
}
