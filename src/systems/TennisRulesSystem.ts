import { createRoot, createSignal } from "solid-js";
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

const TENNIS_POINTS = ["0", "15", "30", "40", "ADV"];

export function createTennisRulesSystem(
  ecs: ReactiveECS,
  onScoreChange?: (p0: number, p1: number, server: number) => void,
  onGameWin?: (winner: number) => void,
  onGameReset?: () => void,
): { update: (dt: number) => void; dispose: () => void; getScore: () => { p0: string; p1: string; server: number } } {
  return createRoot((dispose) => {
    let bounceCountP0 = 0;
    let bounceCountP1 = 0;
    let lastBounceSide: "p0" | "p1" | null = null;
    let gamePointsP0 = 0;
    let gamePointsP1 = 0;

    const [scoreP0, setScoreP0] = createSignal(0);
    const [scoreP1, setScoreP1] = createSignal(0);
    const [currentServer, setCurrentServer] = createSignal(0);

    const notifyScoreChange = () => {
      if (onScoreChange) {
        onScoreChange(scoreP0(), scoreP1(), currentServer());
      }
      checkGameWin();
    };

    const checkGameWin = () => {
      const p0 = scoreP0();
      const p1 = scoreP1();
      if (p0 >= 6) {
        notifyGameWin(0);
        return;
      }
      if (p1 >= 6) {
        notifyGameWin(1);
        return;
      }
    };

    const notifyGameWin = (winner: number) => {
      console.log(`Player ${winner} wins the game!`);
      setScoreP0(0);
      setScoreP1(0);
      if (onGameWin) {
        onGameWin(winner);
      }
      if (onGameReset) {
        onGameReset();
      }
    };

    const getScore = () => {
      const p0Points = scoreP0();
      const p1Points = scoreP1();
      
      let p0Display: string;
      let p1Display: string;
      
      if (p0Points >= 4 && p1Points >= 4) {
        if (p0Points === p1Points) {
          p0Display = "40";
          p1Display = "40";
        } else if (p0Points > p1Points) {
          p0Display = "ADV";
          p1Display = "40";
        } else {
          p0Display = "40";
          p1Display = "ADV";
        }
      } else {
        p0Display = TENNIS_POINTS[Math.min(p0Points, 4)];
        p1Display = TENNIS_POINTS[Math.min(p1Points, 4)];
      }
      
      return { p0: p0Display, p1: p1Display, server: currentServer() };
    };

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
        
        if (bounceCountP0 >= 2) {
          setScoreP1(scoreP1() + 1);
          setCurrentServer(1 - serverPlayer);
          notifyScoreChange();
          const nextServer = currentServer();
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0(), scoreP1());
          return;
        }
      }
      
      if (isP1Side) {
        bounceCountP1++;
        lastBounceSide = "p1";
        
        if (bounceCountP1 >= 2) {
          setScoreP0(scoreP0() + 1);
          setCurrentServer(1 - serverPlayer);
          notifyScoreChange();
          const nextServer = currentServer();
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0(), scoreP1());
          return;
        }
      }
    };

    gameEvents.on("ballBounce", handleBallBounce);
    
    const handleBallHit = () => {
      bounceCountP0 = 0;
      bounceCountP1 = 0;
      lastBounceSide = null;
    };
    gameEvents.on("ballHit", handleBallHit);
    
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
        if (ballPos.z < 0) {
          setScoreP1(scoreP1() + 1);
          setCurrentServer(1 - serverPlayer);
          notifyScoreChange();
          const nextServer = currentServer();
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0(), scoreP1());
        } else {
          setScoreP0(scoreP0() + 1);
          setCurrentServer(1 - serverPlayer);
          notifyScoreChange();
          const nextServer = currentServer();
          ecs.set_field(servingEntityId, RegisteredServingState, "phase", SERVE_PHASE_WAITING);
          ecs.set_field(servingEntityId, RegisteredServingState, "serverPlayer", nextServer);
          resetBall(ecs, serverPlayer, nextServer, scoreP0(), scoreP1());
        }
      }
    };

    return { 
      update, 
      dispose: () => {
        gameEvents.off("ballBounce", handleBallBounce);
        dispose();
      },
      getScore,
    };
  });
}