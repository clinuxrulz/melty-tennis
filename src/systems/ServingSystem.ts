import { createRoot, type Accessor } from "solid-js";
import type { ReactiveECS } from "../ReactiveECS";
import type { EntityID } from "@oasys/oecs";
import {
  RegisteredPosition,
  RegisteredVelocity,
  RegisteredServingState,
  RegisteredPlayerConfig,
  RegisteredCourtDimensions,
} from "../World";

const SERVE_PHASE_WAITING = 0;
const SERVE_PHASE_BALL_THROWN = 1;
const SERVE_PHASE_BALL_HIT = 2;

export function createServingSystem(
  ecs: ReactiveECS,
  actionPressed: Accessor<boolean>,
  leftRight: Accessor<number>,
  upDown: Accessor<number>,
): { update: (dt: number) => void; dispose: () => void } {
  return createRoot((dispose) => {
    let lastActionPressed = false;
    
    const update = (deltaTime: number) => {
      const playerQuery = ecs.query(RegisteredPosition, RegisteredPlayerConfig);
      const ballQuery = ecs.query(RegisteredPosition, RegisteredVelocity);
      const servingQuery = ecs.query(RegisteredServingState);
      
      if (servingQuery.archetypes.length === 0) return;
      const servingArch = servingQuery.archetypes[0];
      const phases = servingArch.get_column(RegisteredServingState, "phase");
      const serverPlayers = servingArch.get_column(RegisteredServingState, "serverPlayer");
      const throwTimes = servingArch.get_column(RegisteredServingState, "throwTime");
      const servingEntityId = servingArch.entity_ids[0] as EntityID;
      
      const phase = phases[0];
      const serverPlayer = serverPlayers[0];
      const throwTime = throwTimes[0];
      
      let playerPos = { x: 0, y: 0, z: 0 };
      let ballPos = { x: 0, y: 0, z: 0 };
      let ballVel = { x: 0, y: 0, z: 0 };
      
      for (const arch of playerQuery) {
        const positionsX = arch.get_column(RegisteredPosition, "x");
        const positionsY = arch.get_column(RegisteredPosition, "y");
        const positionsZ = arch.get_column(RegisteredPosition, "z");
        const playerTypes = arch.get_column(RegisteredPlayerConfig, "playerType");
        
        for (let i = 0; i < arch.entity_count; i++) {
          if (playerTypes[i] === serverPlayer) {
            playerPos = { x: positionsX[i], y: positionsY[i], z: positionsZ[i] };
            break;
          }
        }
      }
      
      for (const arch of ballQuery) {
        const positionsX = arch.get_column(RegisteredPosition, "x");
        const positionsY = arch.get_column(RegisteredPosition, "y");
        const positionsZ = arch.get_column(RegisteredPosition, "z");
        const velocitiesX = arch.get_column(RegisteredVelocity, "x");
        const velocitiesY = arch.get_column(RegisteredVelocity, "y");
        const velocitiesZ = arch.get_column(RegisteredVelocity, "z");
        
        ballPos = { x: positionsX[0], y: positionsY[0], z: positionsZ[0] };
        ballVel = { x: velocitiesX[0], y: velocitiesY[0], z: velocitiesZ[0] };
      }
      
      if (phase === SERVE_PHASE_BALL_THROWN) {
        const dx = ballPos.x - playerPos.x;
        const dz = ballPos.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.5 && ballPos.y < playerPos.y + 0.3) {
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "throwTime", 0.0);
        }
      }
      
      if (phase === SERVE_PHASE_WAITING) {
        const ballQuery = ecs.query(RegisteredPosition);
        if (ballQuery.archetypes.length > 0) {
          const ballArch = ballQuery.archetypes[0];
          const ballId = ballArch.entity_ids[0] as EntityID;
          const leftOffset = serverPlayer === 0 ? -0.5 : 0.5;
          ecs.set_field(ballId, RegisteredPosition, "x", playerPos.x + leftOffset);
          ecs.set_field(ballId, RegisteredPosition, "y", playerPos.y + 0.8);
          ecs.set_field(ballId, RegisteredPosition, "z", playerPos.z);
        }
      }
      
      const actionJustPressed = actionPressed() && !lastActionPressed;
      lastActionPressed = actionPressed();
      
      if (actionJustPressed) {
        if (phase === SERVE_PHASE_WAITING) {
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_BALL_THROWN);
          ecs.set_field(servingEntityId, RegisteredServingState, "throwTime", 0.0);
          
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredPosition, "x", playerPos.x);
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredPosition, "y", playerPos.y + 1.5);
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredPosition, "z", playerPos.z);
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredVelocity, "x", 0);
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredVelocity, "y", 4.0);
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredVelocity, "z", 0);
        } else if (phase === SERVE_PHASE_BALL_THROWN) {
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_BALL_HIT);
          
          const inputX = leftRight();
          const baseVelX = 4;
          const hitVelX = baseVelX * inputX + (Math.random() - 0.5) * 1;
          const hitVelY = 3 + Math.random() * 2;
          const hitVelZ = serverPlayer === 0 ? 8 : -8;
          
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredVelocity, "x", hitVelX);
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredVelocity, "y", hitVelY);
          ecs.set_field(ballQuery.archetypes[0].entity_ids[0] as EntityID, RegisteredVelocity, "z", hitVelZ);
          
          const playerQuery = ecs.query(RegisteredPosition, RegisteredPlayerConfig);
          for (const arch of playerQuery) {
            const positionsX = arch.get_column(RegisteredPosition, "x");
            const positionsY = arch.get_column(RegisteredPosition, "y");
            const positionsZ = arch.get_column(RegisteredPosition, "z");
            const playerTypes = arch.get_column(RegisteredPlayerConfig, "playerType");
            
            for (let i = 0; i < arch.entity_count; i++) {
              if (playerTypes[i] === serverPlayer) {
                const id = arch.entity_ids[i] as EntityID;
                ecs.set_field(id, RegisteredPosition, "x", positionsX[i]);
                ecs.set_field(id, RegisteredPosition, "y", positionsY[i]);
                ecs.set_field(id, RegisteredPosition, "z", positionsZ[i]);
                break;
              }
            }
          }
        }
      }
    };

    return { update, dispose };
  });
}