import { ECS } from "@oasys/oecs";
import { ReactiveECS } from "./ReactiveECS";
import {
  Position,
  Velocity,
  PlayerConfig,
  InputControlled,
  AI,
  DesiredMovement,
  CourtDimensions,
  BallConfig,
  Boundary,
  GravityAffected,
  Renderable,
  GlobalGravity,
  GameState,
  ServingState,
  RacketSide,
} from "./components";

const baseEcs = new ECS();
const reactiveEcs = new ReactiveECS(baseEcs);

export const RegisteredPosition = baseEcs.register_component(Position.def);
export const RegisteredVelocity = baseEcs.register_component(Velocity.def);
export const RegisteredPlayerConfig = baseEcs.register_component(PlayerConfig.def);
export const RegisteredInputControlled = baseEcs.register_component(InputControlled.def);
export const RegisteredAI = baseEcs.register_component(AI.def);
export const RegisteredDesiredMovement = baseEcs.register_component(DesiredMovement.def);
export const RegisteredCourtDimensions = baseEcs.register_component(CourtDimensions.def);
export const RegisteredBallConfig = baseEcs.register_component(BallConfig.def);
export const RegisteredBoundary = baseEcs.register_component(Boundary.def);
export const RegisteredGravityAffected = baseEcs.register_component(GravityAffected.def);
export const RegisteredRenderable = baseEcs.register_component(Renderable.def);
export const RegisteredGlobalGravity = baseEcs.register_resource(["x", "y", "z"], GlobalGravity.schema);
export const RegisteredGameState = baseEcs.register_resource(["servingPlayer"], GameState.schema);
export const RegisteredServingState = baseEcs.register_component(ServingState.def);
export const RegisteredRacketSide = baseEcs.register_component(RacketSide.def);

export function World(): {
  ecs: ReactiveECS,
} {

  baseEcs.startup();
  baseEcs.set_resource(RegisteredGameState, { servingPlayer: 0 });
  baseEcs.set_resource(RegisteredGlobalGravity, { x: 0.0, y: -10.0, z: 0.0 });
  
  return {
    ecs: reactiveEcs,
  };
}
