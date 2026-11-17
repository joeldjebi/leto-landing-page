import * as maplibregl from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import * as THREE from 'three';

export type LngLat = [number, number];

/** Un objet 3D posé sur la carte (position, cap, taille à l'écran) */
export interface Placed {
  obj: THREE.Object3D;
  lngLat: LngLat;
  heading: number; // radians, 0 = vers l'est, sens horaire vu du dessus
  /** Taille voulue à l'écran (px pour la plus grande dimension réelle `size` en mètres) ; 0 = taille réelle */
  screenPx: number;
  size: number;
  visible: boolean;
  lift: number; // altitude (m) avant mise à l'échelle
}

/**
 * Couche three.js dans MapLibre : la moto, les personnages et les épingles partagent
 * la profondeur des immeubles 3D (cachés derrière une tour, visibles devant).
 */
export class Scene3D implements CustomLayerInterface {
  id = 'leto-3d';
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map!: MlMap;
  private renderer!: THREE.WebGLRenderer;
  private camera = new THREE.Camera();
  readonly scene = new THREE.Scene();
  private origin: maplibregl.MercatorCoordinate;
  private unit: number; // unités Mercator par mètre à l'origine
  private items: Placed[] = [];
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.HemisphereLight;

  constructor(origin: LngLat) {
    this.origin = maplibregl.MercatorCoordinate.fromLngLat(origin, 0);
    this.unit = this.origin.meterInMercatorCoordinateUnits();
    this.ambient = new THREE.HemisphereLight(0xffffff, 0xb9a98f, 1.6);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.sun.position.set(-40, 90, -30);
    this.scene.add(this.sun);
  }

  add(obj: THREE.Object3D, lngLat: LngLat, o: Partial<Omit<Placed, 'obj' | 'lngLat'>> = {}): Placed {
    const p: Placed = { obj, lngLat, heading: 0, screenPx: 44, size: 2, visible: true, lift: 0, ...o };
    this.scene.add(obj);
    this.items.push(p);
    return p;
  }

  onAdd(map: MlMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const zoom = this.map.getZoom();
    const lat = this.map.getCenter().lat;
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom; // mètres par pixel
    for (const p of this.items) {
      p.obj.visible = p.visible;
      if (!p.visible) continue;
      const m = maplibregl.MercatorCoordinate.fromLngLat(p.lngLat, 0);
      const s = p.screenPx > 0 ? Math.max(1, (p.screenPx * mpp) / p.size) : 1;
      p.obj.position.set((m.x - this.origin.x) / this.unit, p.lift * s, (m.y - this.origin.y) / this.unit);
      p.obj.rotation.y = -p.heading;
      p.obj.scale.setScalar(s);
    }
    const t = new THREE.Matrix4()
      .makeTranslation(this.origin.x, this.origin.y, this.origin.z)
      .scale(new THREE.Vector3(this.unit, -this.unit, this.unit))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]).multiply(t);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }
}
