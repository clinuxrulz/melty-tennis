# Melty Tennis

**[Live Demo](https://clinuxrulz.github.io/melty-tennis/)**

A 3D tennis game built with Solid.js, Three.js, and a custom reactive Entity Component System (ECS). This project demonstrates a new approach to game development - combining ECS architecture with reactive primitives to create performant, declarative games.

## About

Melty Tennis is an experimental project exploring **reactive ECS** for game creation. It aims to show how reactive programming concepts can enhance traditional ECS patterns, making game development more intuitive while maintaining the performance benefits of entity-component systems.

### Why Reactive ECS?

Traditional ECS (Entity Component System) is a popular architecture for games, but it can feel disconnected from the reactive patterns popular in modern web development. This project experiments with bridging that gap - using Solid.js signals to create a reactive ECS layer where:

- Components are reactive state containers
- Systems automatically track dependencies and update efficiently
- Game logic feels declarative and familiar to web developers

## Tech Stack

- **Framework**: Solid.js 2.0 (beta)
- **Language**: TypeScript
- **Build Tool**: Vite
- **3D Engine**: Three.js
- **ECS Library**: @oasys/oecs
- **Testing**: Vitest + Playwright

## Features

- **3D Tennis Gameplay**: Two-court tennis with physics-based ball dynamics
- **Two Players**: Human (Melty) vs AI (Cubey)
- **Tennis Scoring**: Traditional 0, 15, 30, 40, ADV system
- **Controls**: 
  - Keyboard: Arrow keys to move, Space to jump
  - Touch: On-screen joystick and jump button for mobile
- **Procedural Sound**: Generated audio for ball bounces

## Architecture

The project uses a custom reactive ECS architecture:

```
src/
├── components.ts      # ECS component definitions
├── ReactiveECS.ts    # Reactive ECS wrapper (Solid.js signals)
├── World.ts          # ECS world initialization
├── Player.ts        # Player entity factory
├── Court.ts          # Court entity factory
├── Ball.ts           # Ball entity factory
├── systems/
│   ├── AISystem.ts              # AI opponent behavior
│   ├── BallPhysicsSystem.ts    # Ball physics and collisions
│   ├── InputProcessingSystem.ts# Keyboard/touch input
│   ├── PlayerMovementSystem.ts # Player movement
│   ├── RenderSystem.ts         # Three.js rendering
│   ├── ServingSystem.ts       # Serve mechanics
│   ├── SoundSystem.ts         # Procedural audio
│   └── TennisRulesSystem.ts   # Scoring logic
└── main.tsx         # App entry point
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## License

MIT