import { createRoot } from "solid-js";
import type { ReactiveECS } from "../ReactiveECS";
import type { EntityID } from "@oasys/oecs";
import {
  RegisteredPosition,
  RegisteredVelocity,
  RegisteredBallConfig,
  RegisteredServingState,
  RegisteredCourtDimensions,
  RegisteredPlayerConfig,
} from "../World";
import { gameEvents } from "../Events";

const SERVE_PHASE_WAITING = 0;
const SERVE_PHASE_BALL_THROWN = 1;
const SERVE_PHASE_BALL_HIT = 2;

const COURT_LENGTH = 23.77;
const COURT_WIDTH = 10.97;
const NET_HEIGHT = 0.914;

export function createTennisRulesSystem(
  ecs: ReactiveECS,
): { update: (dt: number) => void; dispose: () => void } {
  return createRoot((dispose) => {
    let bounceCountP0 = 0;
    let bounceCountP1 = 0;
    let lastBounceSide: "p0" | "p1" | null = null;
    let scoreP0 = 0;
    let scoreP1 = 0;

    const handleBallBounce = (data: { z: number, y: number }) => {
      const servingQuery = ecs.query(RegisteredServingState);
      if (servingQuery.archetypes.length === 0) return;
      const servingArch = servingQuery.archetypes[0];
      const phases = servingArch.get_column(RegisteredServingState, "phase");
      const serverPlayers = servingArch.get_column(RegisteredServingState, "serverPlayer");
      const servingEntityId = servingArch.entity_ids[0] as EntityID;
      
      const phase = phases[0];
      const serverPlayer = serverPlayers[0];
      
      if (phase !== SERVE_PHASE_BALL_HIT) {
        return;
      }
      
      const isP0Side = data.z < 0;
      const isP1Side = data.z > 0;
      
      if (isP0Side) {
        bounceCountP0++;
        lastBounceSide = "p0";
        console.log(`Bounce on P0 side: ${bounceCountP0}`);
        
        if (bounceCountP0 >= 2) {
          console.log("P0 double bounce! Point to P1");
          scoreP1++;
          const nextServer = 1 - serverPlayer;
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0, scoreP1);
          return;
        }
      }
      
      if (isP1Side) {
        bounceCountP1++;
        lastBounceSide = "p1";
        console.log(`Bounce on P1 side: ${bounceCountP1}`);
        
        if (bounceCountP1 >= 2) {
          console.log("P1 double bounce! Point to P0");
          scoreP0++;
          const nextServer = 1 - serverPlayer;
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0, scoreP1);
          return;
        }
      }
    };

    gameEvents.on("ballBounce", handleBallBounce);
    
    const resetBall = (ecs: ReactiveECS, oldServer: number, newServer: number, p0Score: number, p1Score: number) => {
      const playerQuery = ecs.query(RegisteredPosition, RegisteredPlayerConfig);
      let serverPos = { x: 0, y: 0, z: 0 };
      
      for (const arch of playerQuery) {
        const positionsX = arch.get_column(RegisteredPosition, "x");
        const positionsY = arch.get_column(RegisteredPosition, "y");
        const positionsZ = arch.get_column(RegisteredPosition, "z");
        const playerTypes = arch.get_column(RegisteredPlayerConfig, "playerType");
        
        for (let i = 0; i < arch.entity_count; i++) {
          if (playerTypes[i] === newServer) {
            serverPos = { x: positionsX[i], y: positionsY[i], z: positionsZ[i] };
            break;
          }
        }
      }
      
      const ballQuery = ecs.query(RegisteredPosition, RegisteredVelocity);
      if (ballQuery.archetypes.length > 0) {
        const ballArch = ballQuery.archetypes[0];
        const ballId = ballArch.entity_ids[0] as EntityID;
        ecs.set_field(ballId, RegisteredPosition, "x", serverPos.x);
        ecs.set_field(ballId, RegisteredPosition, "y", 0.1);
        ecs.set_field(ballId, RegisteredPosition, "z", serverPos.z);
        ecs.set_field(ballId, RegisteredVelocity, "x", 0);
        ecs.set_field(ballId, RegisteredVelocity, "y", 0);
        ecs.set_field(ballId, RegisteredVelocity, "z", 0);
      }
      
      bounceCountP0 = 0;
      bounceCountP1 = 0;
      lastBounceSide = null;
      
      console.log(`Reset to server ${newServer}, score: P0=${p0Score}, P1=${p1Score}`);
    };

    const update = (deltaTime: number) => {
      const servingQuery = ecs.query(RegisteredServingState);
      if (servingQuery.archetypes.length === 0) return;
      const servingArch = servingQuery.archetypes[0];
      const phases = servingArch.get_column(RegisteredServingState, "phase");
      const serverPlayers = servingArch.get_column(RegisteredServingState, "serverPlayer");
      const servingEntityId = servingArch.entity_ids[0] as EntityID;
      
      const phase = phases[0];
      const serverPlayer = serverPlayers[0];
      
      if (phase !== SERVE_PHASE_BALL_HIT) {
        bounceCountP0 = 0;
        bounceCountP1 = 0;
        return;
      }
      
      const ballQuery = ecs.query(RegisteredPosition, RegisteredVelocity, RegisteredBallConfig);
      if (ballQuery.archetypes.length === 0) return;
      const ballArch = ballQuery.archetypes[0];
      const positionsX = ballArch.get_column(RegisteredPosition, "x");
      const positionsY = ballArch.get_column(RegisteredPosition, "y");
      const positionsZ = ballArch.get_column(RegisteredPosition, "z");
      const velocitiesX = ballArch.get_column(RegisteredVelocity, "x");
      const velocitiesY = ballArch.get_column(RegisteredVelocity, "y");
      const velocitiesZ = ballArch.get_column(RegisteredVelocity, "z");
      const ballId = ballArch.entity_ids[0] as EntityID;
      
      const ballPos = { x: positionsX[0], y: positionsY[0], z: positionsZ[0] };
      const ballVel = { x: velocitiesX[0], y: velocitiesY[0], z: velocitiesZ[0] };
      
      if (ballPos.z < -COURT_LENGTH / 2 - 0.5 || ballPos.z > COURT_LENGTH / 2 + 0.5 ||
          ballPos.x < -COURT_WIDTH / 2 - 0.5 || ballPos.x > COURT_WIDTH / 2 + 0.5) {
        console.log("Ball out of bounds");
        if (ballPos.z < 0) {
          scoreP1++;
          const nextServer = 1 - serverPlayer;
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0, scoreP1);
        } else {
          scoreP0++;
          const nextServer = 1 - serverPlayer;
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0, scoreP1);
        }
      }
    };

    return { 
      update, 
      dispose: () => {
        gameEvents.off("ballBounce", handleBallBounce);
        dispose();
      }
    };
  });
}