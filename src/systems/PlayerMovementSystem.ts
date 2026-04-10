import { createRoot, type Accessor } from "solid-js";
import type { ReactiveECS } from "../ReactiveECS";
import type { EntityID } from "@oasys/oecs";
import {
  RegisteredPosition,
  RegisteredVelocity,
  RegisteredDesiredMovement,
  RegisteredPlayerConfig,
  RegisteredCourtDimensions,
  RegisteredGlobalGravity,
  RegisteredServingState,
  RegisteredRacketSide,
} from "../World";

export function createPlayerMovementSystem(
  ecs: ReactiveECS,
  jumpDown: Accessor<boolean>,
): { update: (dt: number) => void; dispose: () => void } {
  return createRoot((dispose) => {
    const update = (deltaTime: number) => {
      const gravity = ecs.resource(RegisteredGlobalGravity);
      const courtQuery = ecs.query(RegisteredCourtDimensions);
      const courtArch = courtQuery.archetypes[0];
      const courtDimensions = courtArch ? {
          width: courtArch.get_column(RegisteredCourtDimensions, "width")[0],
          length: courtArch.get_column(RegisteredCourtDimensions, "length")[0],
          netHeight: courtArch.get_column(RegisteredCourtDimensions, "netHeight")[0],
      } : undefined;
      
      let inServingPhase = false;
      let serverCantMove = false;
      const SERVE_PHASE_BALL_THROWN = 1;
      const servingQuery = ecs.query(RegisteredServingState);
      if (servingQuery.archetypes.length > 0) {
        const servingArch = servingQuery.archetypes[0];
        const phases = servingArch.get_column(RegisteredServingState, "phase");
        const serverPlayers = servingArch.get_column(RegisteredServingState, "serverPlayer");
        inServingPhase = phases[0] !== 2;
        serverCantMove = phases[0] === SERVE_PHASE_BALL_THROWN;
      }
      
      const playerUpdates: {
        entityId: number;
        newPosX: number;
        newPosY: number;
        newPosZ: number;
        newVelX: number;
        newVelY: number;
        newVelZ: number;
        racketSide: number;
      }[] = [];

      const playerQuery = ecs.query(RegisteredPosition, RegisteredVelocity, RegisteredDesiredMovement, RegisteredPlayerConfig, RegisteredRacketSide);

      for (const arch of playerQuery) {
        const positionsX = arch.get_column(RegisteredPosition, "x");
        const positionsY = arch.get_column(RegisteredPosition, "y");
        const positionsZ = arch.get_column(RegisteredPosition, "z");
        const velocitiesX = arch.get_column(RegisteredVelocity, "x");
        const velocitiesY = arch.get_column(RegisteredVelocity, "y");
        const velocitiesZ = arch.get_column(RegisteredVelocity, "z");
        const desiredMovementsX = arch.get_column(RegisteredDesiredMovement, "x");
        const desiredMovementsZ = arch.get_column(RegisteredDesiredMovement, "z");
        const playerConfigTypes = arch.get_column(RegisteredPlayerConfig, "playerType");
        const playerConfigFacings = arch.get_column(RegisteredPlayerConfig, "facingForward");
        const entityIds = arch.entity_ids;
        const racketSides = arch.get_column(RegisteredRacketSide, "side");

        for (let i = 0; i < arch.entity_count; i++) {
          const entityId = entityIds[i];
          const position = { x: positionsX[i], y: positionsY[i], z: positionsZ[i] };
          const velocity = { x: velocitiesX[i], y: velocitiesY[i], z: velocitiesZ[i] };
          const desiredMovement = { x: desiredMovementsX[i], z: desiredMovementsZ[i] };
          const playerConfig = { playerType: playerConfigTypes[i], facingForward: playerConfigFacings[i] };

          let newPosX = position.x;
          let newPosY = position.y;
          let newPosZ = position.z;
          let newVelX = velocity.x;
          let newVelY = velocity.y;
          let newVelZ = velocity.z;

          const isServer = playerConfig.playerType === 0 ? false : (playerConfig.playerType === 1 ? true : false);
          let currentRacketSide = racketSides[i];
          
          if (!(serverCantMove && isServer)) {
            newPosX += desiredMovement.x * 0.1;
            newPosZ += desiredMovement.z * 0.1;
            
            if (desiredMovement.x > 0.1) {
              currentRacketSide = -1;
            } else if (desiredMovement.x < -0.1) {
              currentRacketSide = 1;
            }
          }

          if (!inServingPhase && newPosY <= 0.0) {
            if (jumpDown()) {
              newVelY = 5.0;
            }
          } else if (newPosY > 0.0) {
            newVelY += gravity.get("y") * deltaTime;
          }

          newPosX += newVelX * deltaTime;
          newPosY += newVelY * deltaTime;
          newPosZ += newVelZ * deltaTime;

          if (newPosY <= 0.0) {
            newPosY = 0.0;
            newVelY = 0.0;
          }

          if (courtDimensions) {
            const halfWidth = 0.5 * courtDimensions.width;
            const halfLength = 0.5 * courtDimensions.length;
            const playerRadius = 0.25;

            if (newPosX < -halfWidth + playerRadius) {
              newPosX = -halfWidth + playerRadius;
            }
            if (newPosX > halfWidth - playerRadius) {
              newPosX = halfWidth - playerRadius;
            }

            if (playerConfig.facingForward === 1) {
              if (newPosZ < playerRadius) {
                newPosZ = playerRadius;
              }
              if (newPosZ > halfLength - playerRadius) {
                newPosZ = halfLength - playerRadius;
              }
            } else {
              if (newPosZ > -playerRadius) {
                newPosZ = -playerRadius;
              }
              if (newPosZ < -halfLength + playerRadius) {
                newPosZ = -halfLength + playerRadius;
              }
            }
          }
          playerUpdates.push({ entityId, newPosX, newPosY, newPosZ, newVelX, newVelY, newVelZ, racketSide: currentRacketSide });
        }
      }
      for (const { entityId, newPosX, newPosY, newPosZ, newVelX, newVelY, newVelZ, racketSide } of playerUpdates) {
        const id = entityId as EntityID;
        ecs.set_field(id, RegisteredPosition, "x", newPosX);
        ecs.set_field(id, RegisteredPosition, "y", newPosY);
        ecs.set_field(id, RegisteredPosition, "z", newPosZ);
        ecs.set_field(id, RegisteredVelocity, "x", newVelX);
        ecs.set_field(id, RegisteredVelocity, "y", newVelY);
        ecs.set_field(id, RegisteredVelocity, "z", newVelZ);
        ecs.set_field(id, RegisteredRacketSide, "side", racketSide);
      }
    };

    return { update, dispose };
  });
}