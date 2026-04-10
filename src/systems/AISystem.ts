import { createRoot, type Accessor } from "solid-js";
import type { ReactiveECS } from "../ReactiveECS";
import type { EntityID } from "@oasys/oecs";
import {
  RegisteredPosition,
  RegisteredVelocity,
  RegisteredDesiredMovement,
  RegisteredPlayerConfig,
  RegisteredBallConfig,
  RegisteredAI,
  RegisteredServingState,
} from "../World";

const SERVE_PHASE_WAITING = 0;
const SERVE_PHASE_BALL_THROWN = 1;
const SERVE_PHASE_BALL_HIT = 2;

const GRAVITY = -9.8;
const COURT_LENGTH_HALF = 11.885;

function predictBallLanding(ballPos: { x: number; y: number; z: number }, ballVel: { x: number; y: number; z: number }): { x: number; z: number } | null {
  if (ballVel.y >= 0) return null;
  
  const t = ballVel.y > 0 ? -ballVel.y / GRAVITY : 0;
  const landingY = ballPos.y + ballVel.y * t + 0.5 * GRAVITY * t * t;
  
  if (landingY > 0.1) {
    const totalTime = (-ballVel.y + Math.sqrt(ballVel.y * ballVel.y - 2 * GRAVITY * (ballPos.y - 0.1))) / -GRAVITY;
    if (totalTime > 0) {
      const landingX = ballPos.x + ballVel.x * totalTime;
      const landingZ = ballPos.z + ballVel.z * totalTime;
      return { x: landingX, z: landingZ };
    }
  }
  return null;
}

export function createAISystem(
  ecs: ReactiveECS,
): { update: (dt: number) => void; dispose: () => void } {
  return createRoot((dispose) => {
    let lastServePhase = 0;
    let aiServeCooldown = 0;

    const update = (deltaTime: number) => {
      if (aiServeCooldown > 0) {
        aiServeCooldown -= deltaTime;
      }

      const playerQuery = ecs.query(
        RegisteredPosition,
        RegisteredVelocity,
        RegisteredDesiredMovement,
        RegisteredPlayerConfig,
        RegisteredAI,
      );

      const ballQuery = ecs.query(RegisteredPosition, RegisteredVelocity, RegisteredBallConfig);
      const servingQuery = ecs.query(RegisteredServingState);

      let ballPos = { x: 0, y: 0, z: 0 };
      let ballVel = { x: 0, y: 0, z: 0 };

      for (const arch of ballQuery) {
        const positionsX = arch.get_column(RegisteredPosition, "x");
        const positionsY = arch.get_column(RegisteredPosition, "y");
        const positionsZ = arch.get_column(RegisteredPosition, "z");
        const velocitiesX = arch.get_column(RegisteredVelocity, "x");
        const velocitiesY = arch.get_column(RegisteredVelocity, "y");
        const velocitiesZ = arch.get_column(RegisteredVelocity, "z");

        if (arch.entity_count > 0) {
          ballPos = { x: positionsX[0], y: positionsY[0], z: positionsZ[0] };
          ballVel = { x: velocitiesX[0], y: velocitiesY[0], z: velocitiesZ[0] };
        }
      }

      let currentPhase = SERVE_PHASE_WAITING;
      let serverPlayer = 0;
      let servingEntityId: EntityID | null = null;

      if (servingQuery.archetypes.length > 0) {
        const servingArch = servingQuery.archetypes[0];
        const phases = servingArch.get_column(RegisteredServingState, "phase");
        const serverPlayers = servingArch.get_column(RegisteredServingState, "serverPlayer");
        currentPhase = phases[0];
        serverPlayer = serverPlayers[0];
        servingEntityId = servingArch.entity_ids[0] as EntityID;
      }

      const aiPlayerType = 0;
      const isAIServing = serverPlayer === aiPlayerType;

      if (isAIServing && aiServeCooldown <= 0 && currentPhase !== SERVE_PHASE_BALL_HIT) {
        if (currentPhase === SERVE_PHASE_WAITING) {
          for (const arch of playerQuery) {
            const positionsX = arch.get_column(RegisteredPosition, "x");
            const positionsY = arch.get_column(RegisteredPosition, "y");
            const positionsZ = arch.get_column(RegisteredPosition, "z");
            const playerTypes = arch.get_column(RegisteredPlayerConfig, "playerType");

            for (let i = 0; i < arch.entity_count; i++) {
              if (playerTypes[i] === aiPlayerType) {
                const id = arch.entity_ids[i] as EntityID;
                ecs.set_field(id, RegisteredDesiredMovement, "x", 0);
                ecs.set_field(id, RegisteredDesiredMovement, "z", 0);
                break;
              }
            }
          }

          if (servingEntityId) {
            ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_BALL_THROWN);
            ecs.set_field(servingEntityId, RegisteredServingState, "throwTime", 0.0);

            let playerPos = { x: 0, y: 0, z: 0 };
            for (const arch of playerQuery) {
              const positionsX = arch.get_column(RegisteredPosition, "x");
              const positionsY = arch.get_column(RegisteredPosition, "y");
              const positionsZ = arch.get_column(RegisteredPosition, "z");
              const playerTypes = arch.get_column(RegisteredPlayerConfig, "playerType");
              for (let i = 0; i < arch.entity_count; i++) {
                if (playerTypes[i] === aiPlayerType) {
                  playerPos = { x: positionsX[i], y: positionsY[i], z: positionsZ[i] };
                  break;
                }
              }
            }

            for (const arch of ballQuery) {
              const ballId = arch.entity_ids[0] as EntityID;
              ecs.set_field(ballId, RegisteredPosition, "x", playerPos.x);
              ecs.set_field(ballId, RegisteredPosition, "y", playerPos.y + 1.5);
              ecs.set_field(ballId, RegisteredPosition, "z", playerPos.z);
              ecs.set_field(ballId, RegisteredVelocity, "x", 0);
              ecs.set_field(ballId, RegisteredVelocity, "y", 4.0);
              ecs.set_field(ballId, RegisteredVelocity, "z", 0);
            }
            lastServePhase = SERVE_PHASE_BALL_THROWN;
          }
        } else if (currentPhase === SERVE_PHASE_BALL_THROWN) {
          let playerPos = { x: 0, y: 0, z: 0 };
          for (const arch of playerQuery) {
            const positionsX = arch.get_column(RegisteredPosition, "x");
            const positionsY = arch.get_column(RegisteredPosition, "y");
            const positionsZ = arch.get_column(RegisteredPosition, "z");
            const playerTypes = arch.get_column(RegisteredPlayerConfig, "playerType");
            for (let i = 0; i < arch.entity_count; i++) {
              if (playerTypes[i] === aiPlayerType) {
                playerPos = { x: positionsX[i], y: positionsY[i], z: positionsZ[i] };
                break;
              }
            }
          }

          const dx = ballPos.x - playerPos.x;
          const dz = ballPos.z - playerPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < 0.5 && ballPos.y < playerPos.y + 0.3) {
            if (servingEntityId) {
              ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_BALL_HIT);

              for (const arch of ballQuery) {
                const ballId = arch.entity_ids[0] as EntityID;
                const hitVelX = (Math.random() - 0.5) * 1.5;
                const hitVelY = 3 + Math.random() * 1.5;
                const hitVelZ = -8;

                ecs.set_field(ballId, RegisteredVelocity, "x", hitVelX);
                ecs.set_field(ballId, RegisteredVelocity, "y", hitVelY);
                ecs.set_field(ballId, RegisteredVelocity, "z", hitVelZ);
              }

              aiServeCooldown = 2.0;
            }
          }
        }
      }

      if (!isAIServing || currentPhase === SERVE_PHASE_BALL_HIT || currentPhase === SERVE_PHASE_WAITING) {
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
          const entityIds = arch.entity_ids;

          for (let i = 0; i < arch.entity_count; i++) {
            const playerType = playerConfigTypes[i];
            if (playerType !== aiPlayerType) continue;

            const playerX = positionsX[i];
            const playerY = positionsY[i];
            const playerZ = positionsZ[i];

            let moveX = 0;
            let moveZ = 0;

            const ballComingTowardsAI = ballVel.z > 0 && ballPos.z < playerZ + 8 && ballPos.z > playerZ - 3;
            const ballGoingAway = ballVel.z < 0 && ballPos.z > playerZ;
            const ballNear = ballPos.z > playerZ - 2 && ballPos.z < playerZ + 2;

            const canReachBall = ballPos.y < 2.0;
            
            if (ballComingTowardsAI && !canReachBall && ballNear) {
              const landing = predictBallLanding(ballPos, ballVel);
              if (landing) {
                const idealZ = Math.max(-COURT_LENGTH_HALF + 1, Math.min(-0.5, landing.z - 1.5));
                const zDiff = idealZ - playerZ;
                if (Math.abs(zDiff) > 0.2) {
                  moveZ = zDiff > 0 ? 1 : -1;
                }
              } else {
                moveZ = -1;
              }
            } else if (ballComingTowardsAI && canReachBall) {
              const idealZ = Math.max(playerZ - 1, ballPos.z - 0.8);
              const zDiff = idealZ - playerZ;
              if (Math.abs(zDiff) > 0.15) {
                moveZ = zDiff > 0 ? 1 : -1;
              }
            } else if (ballGoingAway) {
              const landing = predictBallLanding(ballPos, ballVel);
              if (landing) {
                const idealZ = Math.max(-COURT_LENGTH_HALF + 1, Math.min(-0.5, landing.z - 1.0));
                const zDiff = idealZ - playerZ;
                if (Math.abs(zDiff) > 0.2) {
                  moveZ = zDiff > 0 ? 1 : -1;
                }
              } else {
                moveZ = -1;
              }
            } else {
              const idealDefenseZ = -3.0;
              if (ballPos.z < -5) {
                const idealZ = Math.max(idealDefenseZ, ballPos.z + 2);
                const zDiff = idealZ - playerZ;
                if (Math.abs(zDiff) > 0.2) {
                  moveZ = zDiff > 0 ? 1 : -1;
                }
              } else {
                const zDiff = idealDefenseZ - playerZ;
                if (Math.abs(zDiff) > 0.3) {
                  moveZ = zDiff > 0 ? 1 : -1;
                }
              }
            }

            if (ballPos.z > -12 && ballPos.z < 0) {
              const xDiff = ballPos.x - playerX;
              if (Math.abs(xDiff) > 0.3) {
                moveX = xDiff > 0 ? 1 : -1;
              }
            }

            const id = entityIds[i] as EntityID;
            ecs.set_field(id, RegisteredDesiredMovement, "x", moveX);
            ecs.set_field(id, RegisteredDesiredMovement, "z", moveZ);
          }
        }
      }
    };

    return { update, dispose };
  });
}