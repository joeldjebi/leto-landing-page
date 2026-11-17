import type { LngLat } from './scene3d';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distM(a: LngLat, b: LngLat) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Itinéraire mesuré : position et cap à n'importe quelle fraction du trajet */
export class Route {
  readonly cum: number[] = [0];
  readonly length: number;
  constructor(readonly coords: LngLat[]) {
    for (let i = 1; i < coords.length; i++) this.cum.push(this.cum[i - 1] + distM(coords[i - 1], coords[i]));
    this.length = this.cum[this.cum.length - 1] || 1;
  }

  private seg(t: number) {
    const d = Math.min(Math.max(t, 0), 1) * this.length;
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    const a = this.coords[i - 1], b = this.coords[i];
    const span = this.cum[i] - this.cum[i - 1] || 1;
    const k = (d - this.cum[i - 1]) / span;
    return { i, a, b, k };
  }

  at(t: number): LngLat {
    const { a, b, k } = this.seg(t);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }

  /** Cap (radians, 0 = est, sens horaire vu du dessus), lissé sur ~25 m */
  heading(t: number) {
    const look = 25 / this.length;
    const p = this.at(Math.max(0, t - look / 2));
    const q = this.at(Math.min(1, t + look / 2));
    const dx = (q[0] - p[0]) * Math.cos(rad(p[1]));
    const dz = -(q[1] - p[1]);
    return Math.atan2(dz, dx);
  }

  /** Le trajet déjà parcouru (pour le tracé violet) */
  slice(t: number): LngLat[] {
    if (t <= 0) return [this.coords[0], this.coords[0]];
    const { i } = this.seg(t);
    return [...this.coords.slice(0, i), this.at(t)];
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Interpolation d'angle (degrés) par le plus court chemin */
export function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}
