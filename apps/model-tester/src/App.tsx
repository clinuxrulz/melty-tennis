import { createSignal, onCleanup, onSettled, type Component } from "solid-js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

const App: Component = () => {
  let [ canvasDiv, setCanvasDiv, ] = createSignal<HTMLDivElement>();
  let [ canvas, setCanvas, ] = createSignal<HTMLCanvasElement>();
  let [ renderer, setRenderer, ] = createSignal<THREE.WebGLRenderer>();
  let [ camera, setCamera, ] = createSignal<THREE.PerspectiveCamera>();
  let [ orbitControls, setOrbitControls, ] = createSignal<OrbitControls>();
  let scene = new THREE.Scene();
  {
    let geometry = new THREE.BoxGeometry();
    let material = new THREE.MeshNormalMaterial();
    let mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
  }
  let rerender = (() => {
    let aboutToRender = false;
    let render = () => {
      aboutToRender = false;
      let renderer2 = renderer();
      if (renderer2 == undefined) {
        return;
      }
      let camera2 = camera();
      if (camera2 == undefined) {
        return;
      }
      renderer2.render(scene, camera2);
    };
    return () => {
      if (aboutToRender) {
        return;
      }
      aboutToRender = true;
      requestAnimationFrame(render);
    };
  })();
  onSettled(() => {
    let canvasDiv2 = canvasDiv();
    if (canvasDiv2 == undefined) {
      return undefined;
    }
    let canvas2 = canvas();
    if (canvas2 == undefined) {
      return undefined;
    }
    let renderer2 = new THREE.WebGLRenderer({
      canvas: canvas2,
    });
    let resizeObserver = new ResizeObserver(() => {
      let rect = canvasDiv2.getBoundingClientRect();
      renderer2.setSize(rect.width, rect.height);
      let camera2 = camera();
      if (camera2 != undefined) {
        camera2.aspect = rect.width / rect.height;
        camera2.updateProjectionMatrix();
        renderer2.render(scene, camera2);
      }
    });
    resizeObserver.observe(canvasDiv2);
    let cleanups: (() => void)[] = [];
    cleanups.push(() => {
      resizeObserver.unobserve(canvasDiv2);
      resizeObserver.disconnect();
    });
    let rect = canvasDiv2.getBoundingClientRect();
    let camera2 = new THREE.PerspectiveCamera();
    camera2.aspect = rect.width / rect.height;
    camera2.updateProjectionMatrix();
    camera2.position.set(5.0, 5.0, 5.0);
    camera2.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
    let orbitControls2 = new OrbitControls(camera2, canvasDiv2);
    orbitControls2.addEventListener("change", () => rerender());
    setRenderer(renderer2);
    setCamera(camera2);
    setOrbitControls(orbitControls2);
    rerender();
    return () => {
      cleanups.forEach((c) => c());
      cleanups.splice(0, cleanups.length);
    };
  });
  return (
    <div
      ref={setCanvasDiv}
      style={{
        "width": "100%",
        "height": "100%",
        "overflow": "hidden",
        "background-color": "darkgray",
      }}
    >
      <canvas ref={setCanvas}/>
    </div>
  );
};

export default App;
