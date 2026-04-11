import { createMemo, onCleanup, createRoot, mapArray } from "solid-js";
import * as THREE from "three";
import type { ReactiveECS } from "../ReactiveECS";
import type { EntityID } from "@oasys/oecs";
import {
  RegisteredPosition,
  RegisteredPlayerConfig,
  RegisteredCourtDimensions,
  RegisteredBallConfig,
  RegisteredRacketSide,
} from "../World";

export function createRenderSystem(ecs: ReactiveECS, scene: THREE.Scene): { update: () => void; dispose: () => void } {
  return createRoot((dispose) => {

    // --- Player Rendering ---
    createMemo(mapArray(
      createMemo(() => {
        let result: EntityID[] = [];
        for (let arch of ecs.query(RegisteredPosition, RegisteredPlayerConfig)) {
          let entityIds = arch.entity_ids;
          for (let i = 0; i < arch.entity_count; ++i) {
            result.push(entityIds[i] as EntityID);
          }
        }
        return result;
      }),
      (playerEntityId) => {
        let playerEntity = ecs.entity(playerEntityId());
        let playerConfig = { playerType: playerEntity.getField(RegisteredPlayerConfig, "playerType"), facingForward: playerEntity.getField(RegisteredPlayerConfig, "facingForward") };
        
        let group = new THREE.Group();
        let chinMesh: THREE.Mesh;
        let headMesh: THREE.Mesh;
        let outsideTeethMesh: THREE.Mesh[] = [];
        let middleToothMesh: THREE.Mesh;
        let eyesMesh: THREE.Mesh[] = [];

        const normalMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const standardMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });

        const chinGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.5);
        chinMesh = new THREE.Mesh(chinGeometry, normalMaterial);
        chinMesh.position.set(0.0, 0.1, 0.0);

        const headGeometry = new THREE.BoxGeometry(0.5, 0.25, 0.5);
        headMesh = new THREE.Mesh(headGeometry, normalMaterial);
        headMesh.position.set(0.0, 0.45, 0.0);

        const toothGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const leftTooth = new THREE.Mesh(toothGeometry, standardMaterial);
        const rightTooth = new THREE.Mesh(toothGeometry, standardMaterial);
        leftTooth.position.set(-0.14, 0.3, 0.3);
        rightTooth.position.set(0.14, 0.3, 0.3);
        outsideTeethMesh = [leftTooth, rightTooth];

        const middleToothGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
        middleToothMesh = new THREE.Mesh(middleToothGeometry, standardMaterial);
        middleToothMesh.position.set(0.0, 0.3, 0.3);

        const eyeGeometry = new THREE.SphereGeometry(0.08);
        const leftEyeMesh = new THREE.Mesh(eyeGeometry, standardMaterial);
        const rightEyeMesh = new THREE.Mesh(eyeGeometry, standardMaterial);
        leftEyeMesh.position.set(-0.15, 0.48, 0.25);
        rightEyeMesh.position.set(0.15, 0.48, 0.25);
        eyesMesh = [leftEyeMesh, rightEyeMesh];

        group.add(chinMesh);
        group.add(headMesh);
        outsideTeethMesh.forEach((m) => group.add(m));
        group.add(middleToothMesh);
        eyesMesh.forEach((m) => group.add(m));

        const racketGroup = new THREE.Group();
        const racketMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        
        const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
        const handleMesh = new THREE.Mesh(handleGeometry, racketMaterial);
        handleMesh.position.set(0, 0, 0);
        handleMesh.rotation.x = Math.PI / 2;
        racketGroup.add(handleMesh);
        
        const racketFaceGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.02, 16);
        const racketFaceMesh = new THREE.Mesh(racketFaceGeometry, racketMaterial);
        racketFaceMesh.position.set(0, 0, 0.15);
        racketFaceMesh.rotation.x = Math.PI / 2;
        racketGroup.add(racketFaceMesh);
        
        racketGroup.position.set(0.4, 0.5, 0.3);
        group.add(racketGroup);

        const playerShadowGeometry = new THREE.CircleGeometry(0.4, 32);
        playerShadowGeometry.scale(1, 0.5, 1);
        const playerShadowMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.3,
        });
        const playerShadowMesh = new THREE.Mesh(playerShadowGeometry, playerShadowMaterial);
        playerShadowMesh.rotation.x = -Math.PI / 2;
        playerShadowMesh.position.y = 0.01;
        scene.add(playerShadowMesh);

        scene.add(group);
        onCleanup(() => {
          scene.remove(group);
          scene.remove(playerShadowMesh);
          chinGeometry.dispose();
          headGeometry.dispose();
          toothGeometry.dispose();
          middleToothGeometry.dispose();
          eyeGeometry.dispose();
          handleGeometry.dispose();
          racketFaceGeometry.dispose();
          playerShadowGeometry.dispose();
          normalMaterial.dispose();
          standardMaterial.dispose();
          racketMaterial.dispose();
          playerShadowMaterial.dispose();
        });

        createMemo(() => {
          let positionX = playerEntity.getField(RegisteredPosition, "x");
          let positionY = playerEntity.getField(RegisteredPosition, "y");
          let positionZ = playerEntity.getField(RegisteredPosition, "z");
          let facingForward = playerEntity.getField(RegisteredPlayerConfig, "facingForward");
          let racketSide = playerEntity.getField(RegisteredRacketSide, "side");
          
          group.position.set(positionX, positionY, positionZ);
          if (facingForward === 1) { 
            group.quaternion.set(0.0, 1.0, 0.0, 0.0);
          } else {
            group.quaternion.set(0.0, 0.0, 0.0, 1.0);
          }
          
          const racketOffset = racketSide * 0.4;
          racketGroup.position.set(racketOffset, 0.5, 0.3);

          const playerShadowScale = Math.max(0.3, 1 - positionY * 0.1);
          playerShadowMesh.scale.set(playerShadowScale, playerShadowScale, playerShadowScale);
          playerShadowMesh.position.set(positionX, 0.01, positionZ);
        });
      },
    ));

    // --- Court Rendering ---
    createMemo(mapArray(
      createMemo(() => {
        let result: EntityID[] = [];
        for (let arch of ecs.query(RegisteredCourtDimensions)) {
          let entityIds = arch.entity_ids;
          for (let i = 0; i < arch.entity_count; ++i) {
            result.push(entityIds[i] as EntityID);
          }
        }
        return result;
      }),
      (courtEntityId) => {
        let courtEntity = ecs.entity(courtEntityId());
        let dimensions = { width: courtEntity.getField(RegisteredCourtDimensions, "width"), length: courtEntity.getField(RegisteredCourtDimensions, "length"), netHeight: courtEntity.getField(RegisteredCourtDimensions, "netHeight") };
        
        const courtGroup = new THREE.Group();
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x3c8f4d });
        const transparentMaterial = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          transparent: true,
          opacity: 0.5,
        });

        const floorGeometry = new THREE.BoxGeometry(dimensions.width, 0.1, dimensions.length);
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        floorMesh.position.y -= 0.05;
        courtGroup.add(floorMesh);

        const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const lineThickness = 0.05;
        const lineHeight = 0.01;

        const baselineGeometry = new THREE.BoxGeometry(dimensions.width, lineHeight, lineThickness);
        const baselineFront = new THREE.Mesh(baselineGeometry, whiteMaterial);
        baselineFront.position.set(0, 0.01, -dimensions.length / 2);
        courtGroup.add(baselineFront);
        const baselineBack = new THREE.Mesh(baselineGeometry, whiteMaterial);
        baselineBack.position.set(0, 0.01, dimensions.length / 2);
        courtGroup.add(baselineBack);

        const sidelineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, dimensions.length);
        const sidelineLeft = new THREE.Mesh(sidelineGeometry, whiteMaterial);
        sidelineLeft.position.set(-dimensions.width / 2, 0.01, 0);
        courtGroup.add(sidelineLeft);
        const sidelineRight = new THREE.Mesh(sidelineGeometry, whiteMaterial);
        sidelineRight.position.set(dimensions.width / 2, 0.01, 0);
        courtGroup.add(sidelineRight);

        const serviceLineDistance = 6.40;
        const serviceLineGeometry = new THREE.BoxGeometry(dimensions.width - 2 * lineThickness, lineHeight, lineThickness);
        const serviceLineFront = new THREE.Mesh(serviceLineGeometry, whiteMaterial);
        serviceLineFront.position.set(0, 0.01, -serviceLineDistance);
        courtGroup.add(serviceLineFront);
        const serviceLineBack = new THREE.Mesh(serviceLineGeometry, whiteMaterial);
        serviceLineBack.position.set(0, 0.01, serviceLineDistance);
        courtGroup.add(serviceLineBack);

        const centerServiceLineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, serviceLineDistance * 2);
        const centerServiceLine = new THREE.Mesh(centerServiceLineGeometry, whiteMaterial);
        centerServiceLine.position.set(0, 0.01, 0);
        courtGroup.add(centerServiceLine);

        const singlesWidth = 8.23;
        const singlesSidelineGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, dimensions.length);
        const singlesSidelineLeft = new THREE.Mesh(singlesSidelineGeometry, whiteMaterial);
        singlesSidelineLeft.position.set(-singlesWidth / 2, 0.01, 0);
        courtGroup.add(singlesSidelineLeft);
        const singlesSidelineRight = new THREE.Mesh(singlesSidelineGeometry, whiteMaterial);
        singlesSidelineRight.position.set(singlesWidth / 2, 0.01, 0);
        courtGroup.add(singlesSidelineRight);

        const netGeometry = new THREE.BoxGeometry(dimensions.width, dimensions.netHeight, 0.1);
        const netMesh = new THREE.Mesh(netGeometry, transparentMaterial);
        netMesh.position.y = 0.5 * dimensions.netHeight;
        courtGroup.add(netMesh);

        scene.add(courtGroup);
        onCleanup(() => {
          scene.remove(courtGroup);
          floorGeometry.dispose();
          netGeometry.dispose();
          floorMaterial.dispose();
          transparentMaterial.dispose();
          whiteMaterial.dispose();
          baselineGeometry.dispose();
          sidelineGeometry.dispose();
          serviceLineGeometry.dispose();
          centerServiceLineGeometry.dispose();
          singlesSidelineGeometry.dispose();
        });
      },
    ));

    // --- Ball Rendering ---
    createMemo(mapArray(
      createMemo(() => {
        let result: EntityID[] = [];
        for (let arch of ecs.query(RegisteredPosition, RegisteredBallConfig)) {
          let entityIds = arch.entity_ids;
          for (let i = 0; i < arch.entity_count; ++i) {
            result.push(entityIds[i] as EntityID);
          }
        }
        return result;
      }),
      (ballEntityId) => {
        let ballEntity = ecs.entity(ballEntityId());
        let ballSize = ballEntity.getField(RegisteredBallConfig, "size");
        const ballGeometry = new THREE.SphereGeometry(ballSize);
        const ballMaterial = new THREE.MeshNormalMaterial();
        const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
        scene.add(ballMesh);
        
        const shadowGeometry = new THREE.CircleGeometry(ballSize, 32);
        shadowGeometry.scale(1, 0.5, 1);
        const shadowMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x000000, 
          transparent: true, 
          opacity: 0.3,
        });
        const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.01;
        scene.add(shadowMesh);
        
        onCleanup(() => {
          scene.remove(ballMesh);
          scene.remove(shadowMesh);
          ballGeometry.dispose();
          ballMaterial.dispose();
          shadowGeometry.dispose();
          shadowMaterial.dispose();
        });
        createMemo(() => {
          let positionX = ballEntity.getField(RegisteredPosition, "x");
          let positionY = ballEntity.getField(RegisteredPosition, "y");
          let positionZ = ballEntity.getField(RegisteredPosition, "z");
          ballMesh.position.set(positionX, positionY, positionZ);
          const shadowScale = Math.max(0.3, 1 - positionY * 0.1);
          shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
          shadowMesh.position.set(positionX, 0.01, positionZ);
        });
      },
    ));

    return { update: () => {}, dispose };
  });
}