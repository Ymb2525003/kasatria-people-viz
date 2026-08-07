import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import type { LayoutId, Person } from "@/types/person";
import { createTileElement } from "./tile";
import { tableLayout } from "./layouts/table";
import { sphereLayout } from "./layouts/sphere";
import { doubleHelixLayout } from "./layouts/doubleHelix";
import { gridLayout } from "./layouts/grid";
import type { Placement } from "./layouts/types";
import { extentOf, framePosition, type Extent, type Vec3 } from "./camera";

/**
 * Imperative controller for the CSS3D scene.
 *
 * Contains ZERO React imports — by design. React owns the shell (auth,
 * controls, legend, search); this module owns the canvas. The boundary is a
 * small explicit API: mount / setData / transformTo / setVisible / dispose.
 *
 * That separation is what makes the layout math unit-testable and the scene
 * portable to any framework, and it is why `npm run test` can prove the
 * 20x10 and 5x4x10 requirements without a browser.
 */

const LAYOUT_FNS: Record<LayoutId, (count: number) => Placement[]> = {
  table: tableLayout,
  sphere: sphereLayout,
  helix: doubleHelixLayout,
  grid: gridLayout,
};

const TRANSITION_MS = 1400;

const FOV_DEGREES = 40;

/**
 * Camera *direction* per layout — where the camera looks from, not how far.
 *
 * Distance is derived from the layout's bounding box and the live viewport
 * aspect ratio (see `./camera`), because no hardcoded number can be right for
 * four structures of very different volumes across every window size. The
 * previous fixed distances clipped the table's outer columns on a narrow
 * viewport, which is a bad way to present a "prove it is 20 x 10" requirement.
 *
 * The grid is the only layout that needs to be viewed *off-axis*. Looking
 * straight down Z at a ten-layer stack means the layers occlude each other and
 * all you see is the front face plus perspective-fanned edges. Offsetting the
 * camera in x and y separates the layers, so the 5x4x10 volume reads as a
 * volume. The flat and radially symmetric layouts stay head-on. Only the
 * direction matters here; the magnitudes are irrelevant.
 */
const CAMERA_DIRECTION: Record<LayoutId, Vec3> = {
  table: { x: 0, y: 0, z: 1 },
  sphere: { x: 0, y: 0, z: 1 },
  helix: { x: 0, y: 0, z: 1 },
  grid: { x: 2600, y: 1500, z: 3000 },
};

export interface SceneCallbacks {
  onSelect?: (person: Person | null) => void;
}

export class PeriodicScene {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer = new CSS3DRenderer();
  private controls: TrackballControls | null = null;

  private objects: CSS3DObject[] = [];
  private people: Person[] = [];
  private targets: Record<LayoutId, THREE.Object3D[]> | null = null;
  private extents: Record<LayoutId, Extent> | null = null;

  private container: HTMLElement | null = null;
  private frameHandle: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private currentLayout: LayoutId = "table";

  /**
   * The last position the camera was *framed* to. Compared against the live
   * position on resize: if the visitor has since orbited or zoomed, their view
   * is left alone; if they have not, the framing is recomputed for the new
   * aspect ratio so a window resize cannot clip the layout.
   */
  private framedPosition = new THREE.Vector3();

  /** Active tweens, tracked so a new transition cancels the previous one. */
  private tweens: Array<() => void> = [];

  constructor(private readonly callbacks: SceneCallbacks = {}) {
    this.camera = new THREE.PerspectiveCamera(FOV_DEGREES, 1, 1, 40000);
    // Placeholder only. The real position is derived once the data (and so
    // the layout bounds) and the viewport aspect ratio are both known.
    this.camera.position.set(0, 0, 4000);
  }

  mount(container: HTMLElement): void {
    if (this.disposed) throw new Error("PeriodicScene has been disposed");

    this.container = container;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.controls = new TrackballControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = 600;
    this.controls.maxDistance = 24000;
    this.controls.rotateSpeed = 0.9;
    this.controls.addEventListener("change", this.render);

    // ResizeObserver rather than window.onresize: the canvas can change size
    // without the window doing so (sidebar opening, mobile browser chrome
    // collapsing), and window.onresize misses all of it.
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(container);

    this.handleResize();
    this.startLoop();
  }

  setData(people: readonly Person[]): void {
    this.clearObjects();
    this.people = [...people];

    for (const person of this.people) {
      const object = new CSS3DObject(createTileElement(person));
      // Seed at a random point so the first transition reads as an assembly
      // rather than tiles popping into place.
      object.position.set(
        Math.random() * 4000 - 2000,
        Math.random() * 4000 - 2000,
        Math.random() * 4000 - 2000,
      );
      this.scene.add(object);
      this.objects.push(object);
    }

    this.targets = this.buildTargets(this.people.length);
    this.attachSelectionHandlers();
  }

  /** Toggles tile visibility for search/filter without rebuilding the scene. */
  setVisible(matches: ReadonlySet<string>): void {
    this.objects.forEach((object, index) => {
      const person = this.people[index];
      if (person === undefined) return;
      const isMatch = matches.has(person.id);
      const el = object.element;
      el.classList.toggle("tile--dimmed", !isMatch);
    });
    this.render();
  }

  transformTo(layout: LayoutId): void {
    if (this.targets === null) return;
    const targets = this.targets[layout];

    this.currentLayout = layout;

    // Cancel in-flight tweens so rapid layout clicks don't stack and fight.
    this.cancelTweens();

    this.frameCamera(TRANSITION_MS);

    this.objects.forEach((object, index) => {
      const target = targets[index];
      if (target === undefined) return;

      // Stagger slightly per tile — a synchronised move of 200 tiles reads as
      // one rigid block; a small offset makes the structure legible.
      const duration = TRANSITION_MS + Math.random() * TRANSITION_MS;
      this.tweens.push(
        tween(object.position, target.position, duration),
        tween(object.rotation, target.rotation, duration),
      );
    });
  }

  /**
   * Return the camera to the canonical viewpoint for the current layout.
   *
   * TrackballControls deliberately does not hold camera.up fixed — that is the
   * difference between it and OrbitControls, and it is what the original demo
   * uses. The cost is that one careless drag rolls the whole scene, leaving
   * 200 tiles upside down with no route back except reloading the page, since
   * nothing else ever restores camera.up. Rather than swap the control scheme
   * the demo is built on, give the roll an exit.
   *
   * Position, orbit target and up vector are all restored together: each drifts
   * independently, and fixing only the position leaves the scene either tilted
   * or aimed off-centre.
   */
  resetView(): void {
    // Same guard as transformTo: without bounds there is nothing to frame, and
    // cameraPositionFor would fall back to the bare direction vector, parking
    // the camera one unit from the origin.
    if (this.targets === null) return;

    this.cancelTweens();
    this.frameCamera(TRANSITION_MS);
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTweens();

    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.resizeObserver?.disconnect();
    this.controls?.removeEventListener("change", this.render);
    this.controls?.dispose();
    this.clearObjects();

    // Without this, React 18+ Strict Mode's double-invoked effects leave a
    // second renderer permanently attached to the DOM.
    this.renderer.domElement.remove();
    this.container = null;
  }

  // ---------------------------------------------------------------------

  /**
   * Move the camera to the framed viewpoint for the current layout.
   *
   * Three things are restored, because all three drift during free orbiting
   * and a partial reset looks broken in a different way each time:
   *
   *  - position — tweened, so a layout switch reads as one continuous move.
   *  - orbit target — panning moves TrackballControls' target off the origin
   *    and nothing puts it back, so the camera arrives at the right place
   *    still aimed at the drifted target. Every layout is built around the
   *    origin, so that is where the target belongs.
   *  - up vector — snapped rather than tweened. Interpolating an orientation
   *    through intermediate vectors can pass through zero length; there is
   *    nothing meaningful to see mid-flip anyway.
   */
  private frameCamera(durationMs: number): void {
    const destination = this.cameraPositionFor(this.currentLayout);

    this.camera.up.set(0, 1, 0);

    // TrackballControls recomputes its eye vector from the camera position on
    // every update, so writing the position directly does not fight it.
    this.tweens.push(tween(this.camera.position, destination, durationMs));

    if (this.controls !== null) {
      this.tweens.push(tween(this.controls.target, { x: 0, y: 0, z: 0 }, durationMs));
    }

    this.framedPosition.set(destination.x, destination.y, destination.z);
  }

  /**
   * The framed camera position for a layout at the current viewport aspect.
   *
   * Falls back to the placeholder distance only before data has arrived, when
   * there are no bounds to frame.
   */
  private cameraPositionFor(layout: LayoutId): Vec3 {
    const extent = this.extents?.[layout];
    const direction = CAMERA_DIRECTION[layout];

    if (extent === undefined) {
      return { x: direction.x, y: direction.y, z: direction.z };
    }

    return framePosition(extent, direction, FOV_DEGREES, this.camera.aspect);
  }

  private buildTargets(count: number): Record<LayoutId, THREE.Object3D[]> {
    const build = (placements: Placement[]): THREE.Object3D[] =>
      placements.map((p) => {
        const object = new THREE.Object3D();
        object.position.set(p.x, p.y, p.z);
        if (p.lookAt !== undefined) {
          object.lookAt(p.lookAt.x, p.lookAt.y, p.lookAt.z);
        }
        return object;
      });

    const placements: Record<LayoutId, Placement[]> = {
      table: LAYOUT_FNS.table(count),
      sphere: LAYOUT_FNS.sphere(count),
      helix: LAYOUT_FNS.helix(count),
      grid: LAYOUT_FNS.grid(count),
    };

    this.extents = {
      table: extentOf(placements.table),
      sphere: extentOf(placements.sphere),
      helix: extentOf(placements.helix),
      grid: extentOf(placements.grid),
    };

    return {
      table: build(placements.table),
      sphere: build(placements.sphere),
      helix: build(placements.helix),
      grid: build(placements.grid),
    };
  }

  private attachSelectionHandlers(): void {
    this.objects.forEach((object, index) => {
      object.element.addEventListener("click", () => {
        const person = this.people[index];
        this.callbacks.onSelect?.(person ?? null);
      });
    });
  }

  private clearObjects(): void {
    for (const object of this.objects) {
      object.element.remove();
      this.scene.remove(object);
    }
    this.objects = [];
  }

  private cancelTweens(): void {
    for (const cancel of this.tweens) cancel();
    this.tweens = [];
  }

  private startLoop(): void {
    const loop = () => {
      if (this.disposed) return;
      this.frameHandle = requestAnimationFrame(loop);
      this.controls?.update();
      this.render();
    };
    loop();
  }

  private readonly render = (): void => {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleResize = (): void => {
    if (this.container === null) return;
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;

    // A visitor who has orbited or zoomed has chosen their own view; snapping
    // it back mid-resize would be hostile. An untouched view is still ours to
    // reframe, and must be: the fit depends on the aspect ratio, so narrowing
    // the window would otherwise slice off the table's outer columns.
    const untouched = this.camera.position.distanceTo(this.framedPosition) < 1;

    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);

    if (untouched && this.extents !== null) {
      const destination = this.cameraPositionFor(this.currentLayout);
      this.camera.position.set(destination.x, destination.y, destination.z);
      this.framedPosition.copy(this.camera.position);
    }

    this.render();
  };
}

/**
 * Minimal tween.
 *
 * The original demo depends on `three/addons/libs/tween.module.js`, whose
 * global `TWEEN.removeAll()` cancels every tween in the process — including
 * any belonging to another component. This local implementation returns a
 * cancel function scoped to the single tween, so cancellation is precise.
 *
 * `prefers-reduced-motion` is honoured: the transition is applied instantly
 * rather than animated. 200 tiles sweeping across the screen is exactly the
 * kind of motion that triggers vestibular discomfort.
 */
function tween(
  source: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  durationMs: number,
): () => void {
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    source.x = target.x;
    source.y = target.y;
    source.z = target.z;
    return () => {};
  }

  const from = { x: source.x, y: source.y, z: source.z };
  const start = performance.now();
  let handle = 0;
  let cancelled = false;

  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min((now - start) / durationMs, 1);
    const eased = easeInOutExpo(t);

    source.x = from.x + (target.x - from.x) * eased;
    source.y = from.y + (target.y - from.y) * eased;
    source.z = from.z + (target.z - from.z) * eased;

    if (t < 1) handle = requestAnimationFrame(step);
  };

  handle = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    cancelAnimationFrame(handle);
  };
}

function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}
