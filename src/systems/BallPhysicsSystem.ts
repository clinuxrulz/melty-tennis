import { createRoot } from "solid-js";
import type { ReactiveECS } from "../ReactiveECS";
import type { EntityID } from "@oasys/oecs";
import {
  RegisteredPosition,
  RegisteredVelocity,
  RegisteredBallConfig,
  RegisteredBoundary,
  RegisteredGravityAffected,
  RegisteredGlobalGravity,
  RegisteredPlayerConfig,
  RegisteredRacketSide,
} from "../World";
import { gameEvents } from "../Events";

export function createBallPhysicsSystem(
  ecs: ReactiveECS,
): { update: (dt: number) => void; dispose: () => void } {
  return createRoot((dispose) => {
    let wasAboveGround = true;
    let lastHitPlayer: number | null = null;
    let hitCooldown = 0;
    
    const update = (deltaTime: number) => {
      if (deltaTime === 0) return;

      const gravity = ecs.resource(RegisteredGlobalGravity);
      
      if (hitCooldown > 0) {
        hitCooldown -= deltaTime;
      }

      const ballUpdates: {
        entityId: number;
        newPosX: number;
        newPosY: number;
        newPosZ: number;
        newVelX: number;
        newVelY: number;
        newVelZ: number;
      }[] = [];

      for (const arch of ecs.query(RegisteredPosition, RegisteredVelocity, RegisteredBallConfig, RegisteredBoundary, RegisteredGravityAffected)) {
        const positionsX = arch.get_column(RegisteredPosition, "x");
        const positionsY = arch.get_column(RegisteredPosition, "y");
        const positionsZ = arch.get_column(RegisteredPosition, "z");
        const velocitiesX = arch.get_column(RegisteredVelocity, "x");
        const velocitiesY = arch.get_column(RegisteredVelocity, "y");
        const velocitiesZ = arch.get_column(RegisteredVelocity, "z");
        const sizes = arch.get_column(RegisteredBallConfig, "size");
        const minXs = arch.get_column(RegisteredBoundary, "minX");
        const minYs = arch.get_column(RegisteredBoundary, "minY");
        const minZs = arch.get_column(RegisteredBoundary, "minZ");
        const maxXs = arch.get_column(RegisteredBoundary, "maxX");
        const maxYs = arch.get_column(RegisteredBoundary, "maxY");
        const maxZs = arch.get_column(RegisteredBoundary, "maxZ");
        const entityIds = arch.entity_ids;

        for (let i = 0; i < arch.entity_count; i++) {
          const entityId = entityIds[i];
          const position = { x: positionsX[i], y: positionsY[i], z: positionsZ[i] };
          const velocity = { x: velocitiesX[i], y: velocitiesY[i], z: velocitiesZ[i] };
          const ballConfig = { size: sizes[i] };
          const boundary = { minX: minXs[i], minY: minYs[i], minZ: minZs[i], maxX: maxXs[i], maxY: maxYs[i], maxZ: maxZs[i] };

          let newVelX = velocity.x;
          let newVelY = velocity.y;
          let newVelZ = velocity.z;

          newVelX += gravity.get("x") * deltaTime;
          newVelY += gravity.get("y") * deltaTime;
          newVelZ += gravity.get("z") * deltaTime;

          let newPosX = position.x + newVelX * deltaTime;
          let newPosY = position.y + newVelY * deltaTime;
          let newPosZ = position.z + newVelZ * deltaTime;

          const ballRadius = ballConfig.size * 0.5;

          const minBoundaryX = boundary.minX + ballRadius;
          const maxBoundaryX = boundary.maxX - ballRadius;
          const minBoundaryY = boundary.minY + ballRadius;
          const maxBoundaryY = boundary.maxY - ballRadius;
          const minBoundaryZ = boundary.minZ + ballRadius;
          const maxBoundaryZ = boundary.maxZ - ballRadius;
          
          const isNowOnGround = newPosY <= minBoundaryY;
          
          if (wasAboveGround && isNowOnGround && newVelY < 0) {
            gameEvents.emit("ballBounce", { z: newPosZ, y: newPosY });
          }
          wasAboveGround = !isNowOnGround;
          
          if (hitCooldown <= 0) {
            for (const playerArch of ecs.query(RegisteredPosition, RegisteredPlayerConfig, RegisteredRacketSide)) {
              const playerPosX = playerArch.get_column(RegisteredPosition, "x")[0];
              const playerPosY = playerArch.get_column(RegisteredPosition, "y")[0];
              const playerPosZ = playerArch.get_column(RegisteredPosition, "z")[0];
              const playerType = playerArch.get_column(RegisteredPlayerConfig, "playerType")[0];
              const racketSide = playerArch.get_column(RegisteredRacketSide, "side")[0];
              
              const racketOffsetX = racketSide * 0.5;
              const racketX = playerPosX + racketOffsetX;
              const racketY = playerPosY + 0.5;
              const racketZ = playerPosZ + 0.3;
              
              const racketRadius = 0.6;
              const dx = newPosX - racketX;
              const dy = newPosY - racketY;
              const dz = newPosZ - racketZ;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              
              console.log(`Player ${playerType}: pos=(${playerPosX.toFixed(2)}, ${playerPosY.toFixed(2)}, ${playerPosZ.toFixed(2)}), racketSide=${racketSide}, racket=(${racketX.toFixed(2)}, ${racketY.toFixed(2)}, ${racketZ.toFixed(2)}), ball=(${newPosX.toFixed(2)}, ${newPosY.toFixed(2)}, ${newPosZ.toFixed(2)}), dist=${dist.toFixed(2)}`);
              
              if (dist < racketRadius + ballRadius) {
                console.log(`HIT Player ${playerType}!`);
                const direction = playerType === 0 ? 1 : -1;
                newVelX = dx * 2;
                newVelY = 4;
                newVelZ = direction * 10;
                newPosY = racketY + racketRadius + ballRadius;
                hitCooldown = 0.3;
                lastHitPlayer = playerType;
                gameEvents.emit("ballHit", { player: playerType });
                break;
              }
              
              const rayDx = newPosX - position.x;
              const rayDy = newPosY - position.y;
              const rayDz = newPosZ - position.z;
              const rayLen = Math.sqrt(rayDx * rayDx + rayDy * rayDy + rayDz * rayDz);
              
              if (rayLen > 0.01) {
                const t = Math.max(0, Math.min(1, 
                  ((racketX - position.x) * rayDx + (racketY - position.y) * rayDy + (racketZ - position.z) * rayDz) / (rayLen * rayLen)
                ));
                const closestX = position.x + t * rayDx;
                const closestY = position.y + t * rayDy;
                const closestZ = position.z + t * rayDz;
                
                const closestDx = closestX - racketX;
                const closestDy = closestY - racketY;
                const closestDz = closestZ - racketZ;
                const closestDist = Math.sqrt(closestDx * closestDx + closestDy * closestDy + closestDz * closestDz);
                
                console.log(`  Ray check: closestDist=${closestDist.toFixed(2)}, racketRadius=${racketRadius}`);
                
                if (closestDist < racketRadius + ballRadius) {
                  console.log(`RAY HIT Player ${playerType}!`);
                  const direction = playerType === 0 ? 1 : -1;
                  const hitStrength = 1.0 - (closestDist / (racketRadius + ballRadius));
                  newVelX = (closestDx / closestDist) * 5 * hitStrength;
                  newVelY = 4;
                  newVelZ = direction * 12;
                  newPosY = Math.max(newPosY, racketY + racketRadius + ballRadius);
                  hitCooldown = 0.3;
                  lastHitPlayer = playerType;
                  gameEvents.emit("ballHit", { player: playerType });
                  break;
                }
              }
            }
          }

          if (newPosX < minBoundaryX) {
            newPosX = minBoundaryX;
            newVelX = -newVelX * 0.8;
          } else if (newPosX > maxBoundaryX) {
            newPosX = maxBoundaryX;
            newVelX = -newVelX * 0.8;
          }

          if (newPosY < minBoundaryY) {
            newPosY = minBoundaryY;
            newVelY = -newVelY * 0.8;
            if (Math.abs(newVelY) < 0.1) newVelY = 0;
          } else if (newPosY > maxBoundaryY) {
            newPosY = maxBoundaryY;
            newVelY = -newVelY * 0.8;
          }

          if (newPosZ < minBoundaryZ) {
            newPosZ = minBoundaryZ;
            newVelZ = -newVelZ * 0.8;
          } else if (newPosZ > maxBoundaryZ) {
            newPosZ = maxBoundaryZ;
            newVelZ = -newVelZ * 0.8;
          }
          ballUpdates.push({ entityId, newPosX, newPosY, newPosZ, newVelX, newVelY, newVelZ });
        }
      }
      for (const { entityId, newPosX, newPosY, newPosZ, newVelX, newVelY, newVelZ } of ballUpdates) {
        const id = entityId as EntityID;
        ecs.set_field(id, RegisteredPosition, "x", newPosX);
        ecs.set_field(id, RegisteredPosition, "y", newPosY);
        ecs.set_field(id, RegisteredPosition, "z", newPosZ);
        ecs.set_field(id, RegisteredVelocity, "x", newVelX);
        ecs.set_field(id, RegisteredVelocity, "y", newVelY);
        ecs.set_field(id, RegisteredVelocity, "z", newVelZ);
      }
    };

    return { update, dispose };
  });
}