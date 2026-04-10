import { type ComponentSchema, type ComponentDef, type ResourceDef } from "@oasys/oecs";
import { type Accessor } from "solid-js";
import * as THREE from "three";

// --- Components ---

export const Position = {
    def: { x: "f64", y: "f64", z: "f64" } as const,
    schema: { x: 0.0, y: 0.0, z: 0.0 },
    name: "Position"
};

export const Velocity = {
    def: { x: "f64", y: "f64", z: "f64" } as const,
    schema: { x: 0.0, y: 0.0, z: 0.0 },
    name: "Velocity"
};

export type PlayerTypeEnum = 0 | 1;
export const PlayerConfig = {
    def: { playerType: "u8", facingForward: "u8" } as const,
    schema: { playerType: 0 as PlayerTypeEnum, facingForward: 0 },
    name: "PlayerConfig"
};

export const InputControlled = {
    def: [] as const,
    schema: {},
    name: "InputControlled"
}

export const DesiredMovement = {
    def: { x: "f64", z: "f64" } as const,
    schema: { x: 0.0, z: 0.0 },
    name: "DesiredMovement"
};

export const CourtDimensions = {
    def: { width: "f64", length: "f64", netHeight: "f64" } as const,
    schema: { width: 0.0, length: 0.0, netHeight: 0.0 },
    name: "CourtDimensions"
};

export const BallConfig = {
    def: { size: "f64" } as const,
    schema: { size: 0.0 },
    name: "BallConfig"
};

export const Boundary = {
    def: { minX: "f64", minY: "f64", minZ: "f64", maxX: "f64", maxY: "f64", maxZ: "f64" } as const,
    schema: { minX: 0.0, minY: 0.0, minZ: 0.0, maxX: 0.0, maxY: 0.0, maxZ: 0.0 },
    name: "Boundary"
};

export const GravityAffected = {
    def: [] as const,
    schema: {},
    name: "GravityAffected"
}

export const Renderable = {
    def: { meshId: "u32" } as const,
    schema: { meshId: 0 },
    name: "Renderable"
};

export const GlobalGravity = {
    def: { x: "f64", y: "f64", z: "f64" } as const,
    schema: { x: 0.0, y: 0.0, z: 0.0 },
    name: "GlobalGravity"
};

export const GameState = {
    def: { servingPlayer: "u8" } as const,
    schema: { servingPlayer: 0 },
    name: "GameState"
};

export const ServingState = {
    def: { phase: "u8", serverPlayer: "u8", throwTime: "f64" } as const,
    schema: { phase: 0, serverPlayer: 0, throwTime: 0.0 },
    name: "ServingState"
};

export const RacketSide = {
    def: { side: "i8" } as const,
    schema: { side: 1 },
    name: "RacketSide"
};

export const BallBounceEvent = {
    def: { z: "f64", y: "f64" } as const,
    schema: { z: 0.0, y: 0.0 },
    name: "BallBounceEvent"
};

export type ComponentTypes = {
    Position: typeof Position,
    Velocity: typeof Velocity,
    PlayerConfig: typeof PlayerConfig,
    InputControlled: typeof InputControlled,
    DesiredMovement: typeof DesiredMovement,
    CourtDimensions: typeof CourtDimensions,
    BallConfig: typeof BallConfig,
    Boundary: typeof Boundary,
    GravityAffected: typeof GravityAffected,
    Renderable: typeof Renderable,
    ServingState: typeof ServingState,
};

export type ResourceTypes = {
    GlobalGravity: typeof GlobalGravity,
    GameState: typeof GameState,
};
