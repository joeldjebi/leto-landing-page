import * as THREE from 'three';

/** Couleurs LETO */
/** Couleur de marque dans la scène 3D : orange vif de la charte (ancien nom conservé) */
export const VIOLET = 0xe86a17;
export const INK = 0x121214;

/** Ombre douce au sol (disque dégradé) */
let shadowTex: THREE.Texture | null = null;
export function groundShadow(rx: number, rz: number, opacity = 0.32) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }));
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.02;
  return s;
}

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });

/** Texture du caisson : bande violette et « LETO » */
function boxTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#FBC02D';
  g.fillRect(0, 96, 256, 64);
  g.fillStyle = '#1A1A1A';
  g.font = '800 46px "Barlow Condensed", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('LETO', 128, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let sharedBoxTex: THREE.Texture | null = null;

/**
 * Livreur LETO sur sa moto (unités : mètres, face vers +X, Y vers le haut).
 * Proportions réelles d'une moto 125 cm³ (≈ 2 m de long).
 */
export function makeRider(opts: { jacket?: number; helmet?: number; lights?: boolean; rider?: boolean } = {}) {
  const g = new THREE.Group();
  g.add(groundShadow(1.5, 0.75));
  const black = mat(0x1b1b20, { roughness: 0.8 });
  const chrome = mat(0xc9ccd4, { metalness: 0.8, roughness: 0.25 });
  const body = mat(VIOLET, { roughness: 0.35, metalness: 0.2 });

  // Roues
  const wheelGeo = new THREE.TorusGeometry(0.29, 0.09, 12, 28);
  const rimGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 18);
  for (const x of [-0.72, 0.72]) {
    const w = new THREE.Mesh(wheelGeo, black);
    w.position.set(x, 0.38, 0);
    g.add(w);
    const rim = new THREE.Mesh(rimGeo, chrome);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.38, 0);
    g.add(rim);
  }
  // Cadre, réservoir, selle, fourche, guidon
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.26, 0.26), body);
  frame.position.set(0.05, 0.72, 0);
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), body);
  tank.scale.set(1.4, 0.75, 0.9);
  tank.position.set(0.32, 0.9, 0);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.3), black);
  seat.position.set(-0.22, 0.93, 0);
  g.add(seat);
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), chrome);
  fork.position.set(0.62, 0.72, 0);
  fork.rotation.z = -0.38;
  g.add(fork);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), black);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0.5, 1.12, 0);
  g.add(bar);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mat(0xfff6d6, { emissive: 0xfff2b0, emissiveIntensity: opts.lights ? 2.2 : 0.6 }));
  head.position.set(0.78, 1.0, 0);
  g.add(head);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.55, 10), chrome);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-0.45, 0.42, -0.2);
  g.add(exhaust);

  // Caisson de livraison LETO
  sharedBoxTex ??= boxTexture();
  const boxMats = [mat(0xffffff, { map: sharedBoxTex }), mat(0xffffff, { map: sharedBoxTex }), mat(0xf3f0fa), mat(0xe8e3f2), mat(0xffffff, { map: sharedBoxTex }), mat(0xffffff, { map: sharedBoxTex })];
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), boxMats);
  box.position.set(-0.68, 1.25, 0);
  g.add(box);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), mat(0xff3b30, { emissive: 0xff2a20, emissiveIntensity: opts.lights ? 2 : 0.5 }));
  tail.position.set(-0.93, 0.98, 0);
  g.add(tail);

  if (opts.rider !== false) {
    // Pilote : jambes, buste, bras, casque
    const jacket = mat(opts.jacket ?? INK, { roughness: 0.7 });
    const jeans = mat(0x2f3a55, { roughness: 0.8 });
    for (const z of [-0.16, 0.16]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.36, 4, 8), jeans);
      thigh.rotation.z = Math.PI / 2 - 0.25;
      thigh.position.set(0.0, 1.02, z);
      g.add(thigh);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), jeans);
      shin.rotation.z = 0.15;
      shin.position.set(0.2, 0.74, z * 1.1);
      g.add(shin);
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 12), jacket);
    torso.position.set(-0.12, 1.45, 0);
    torso.rotation.z = -0.32;
    g.add(torso);
    for (const z of [-0.24, 0.24]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.48, 4, 8), jacket);
      arm.rotation.z = -1.0;
      arm.rotation.x = z > 0 ? -0.15 : 0.15;
      arm.position.set(0.22, 1.36, z);
      g.add(arm);
    }
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), mat(opts.helmet ?? VIOLET, { roughness: 0.25, metalness: 0.3 }));
    helmet.position.set(0.0, 1.88, 0);
    g.add(helmet);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 3, Math.PI / 3), mat(0x1d2633, { roughness: 0.1, metalness: 0.6 }));
    visor.position.set(0.06, 1.88, 0);
    g.add(visor);
  }
  // De nuit : faisceau du phare
  if (opts.lights) {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 4, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.rotation.z = Math.PI / 2;
    beam.position.set(2.8, 0.8, 0);
    g.add(beam);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(3.4, 0.03, 0);
    g.add(glow);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

/** Personnage debout (client, commerçant) : unités en mètres, face vers +X */
export function makePerson(opts: { shirt: number; pants?: number; skin?: number; headwrap?: number; parcel?: boolean; helmet?: number }) {
  const g = new THREE.Group();
  g.add(groundShadow(0.55, 0.45, 0.35));
  const skin = mat(opts.skin ?? 0x6b4428, { roughness: 0.6 });
  const shirt = mat(opts.shirt, { roughness: 0.75 });
  const pants = mat(opts.pants ?? 0x23262f, { roughness: 0.8 });
  for (const z of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.72, 4, 8), pants);
    leg.position.set(0, 0.45, z);
    g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.1), mat(0x111111));
    shoe.position.set(0.05, 0.04, z);
    g.add(shoe);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.48, 6, 12), shirt);
  torso.position.set(0, 1.18, 0);
  g.add(torso);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), shirt);
  armL.position.set(0, 1.12, -0.27);
  g.add(armL);
  const armR = new THREE.Group(); // bras droit animable (salut, remise du colis)
  const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), shirt);
  armMesh.position.set(0, -0.3, 0);
  armR.add(armMesh);
  armR.position.set(0, 1.42, 0.27);
  g.add(armR);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skin);
  neck.position.set(0, 1.56, 0);
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), skin);
  head.scale.set(0.95, 1.1, 0.95);
  head.position.set(0, 1.74, 0);
  g.add(head);
  if (opts.headwrap) {
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(opts.headwrap, { roughness: 0.7 }));
    wrap.scale.set(1, 1.25, 1);
    wrap.position.set(-0.01, 1.78, 0);
    g.add(wrap);
  }
  if (opts.helmet) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), mat(opts.helmet, { roughness: 0.25, metalness: 0.3 }));
    h.position.set(0, 1.76, 0);
    g.add(h);
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 3, Math.PI / 3), mat(0x1d2633, { roughness: 0.1, metalness: 0.6 }));
    v.position.set(0.06, 1.76, 0);
    g.add(v);
  }
  if (opts.parcel) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), mat(0xc9975c, { roughness: 0.9 }));
    p.position.set(0.28, 1.05, 0);
    g.add(p);
    g.userData.parcel = p;
  }
  g.userData.armR = armR;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

/** Boutique de l'expéditeur : petit kiosque avec auvent violet */
export function makeShop() {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 2.6), mat(0xf4ede0));
  wall.position.y = 1.3;
  g.add(wall);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.9), mat(VIOLET));
  awning.position.set(1.95, 2.25, 0);
  awning.rotation.z = -0.25;
  g.add(awning);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 1.0), mat(0x5b3d2a));
  door.position.set(1.62, 0.9, 0);
  g.add(door);
  for (const z of [-0.85, 0.85]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat(0xc9975c, { roughness: 0.9 }));
    crate.position.set(1.95, 0.2, z);
    g.add(crate);
  }
  return g;
}

/** Épingle de destination (violette, flottante) */
export function makePin() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 18), mat(VIOLET, { roughness: 0.3, metalness: 0.2, emissive: 0x5a2306, emissiveIntensity: 0.4 }));
  head.position.y = 3.4;
  g.add(head);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.9, 24), mat(VIOLET, { roughness: 0.3 }));
  tip.rotation.z = Math.PI;
  tip.position.y = 2.1;
  g.add(tip);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mat(0xffffff));
  dot.position.set(0, 3.4, 0);
  dot.scale.set(1, 1, 0.4);
  g.add(dot);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 32), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

/**
 * Circulation d'Abidjan : voiture particulière, taxi rouge (compteur) ou gbaka (minibus vert et jaune).
 * Unités en mètres, face vers +X.
 */
export function makeVehicle(kind: 'car' | 'taxi' | 'gbaka', color = 0xdedfe3) {
  const g = new THREE.Group();
  const L = kind === 'gbaka' ? 5.4 : 4.3;
  const W = kind === 'gbaka' ? 2.0 : 1.75;
  const body = kind === 'taxi' ? 0xe8432f : kind === 'gbaka' ? 0x2e8b57 : color;
  g.add(groundShadow(L * 0.6, W * 0.75, 0.28));
  const paint = mat(body, { roughness: 0.35, metalness: 0.35 });
  const glass = mat(0x1f2a36, { roughness: 0.1, metalness: 0.7 });
  const black = mat(0x18181c, { roughness: 0.8 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(L, kind === 'gbaka' ? 0.9 : 0.62, W), paint);
  lower.position.y = kind === 'gbaka' ? 0.8 : 0.62;
  g.add(lower);
  if (kind === 'gbaka') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 1.0, W * 0.98), paint);
    cabin.position.set(-0.1, 1.72, 0);
    g.add(cabin);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 1.002, 0.18, W * 1.01), mat(0xf2c230));
    stripe.position.y = 1.22;
    g.add(stripe);
    const win = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, 0.5, W * 1.002), glass);
    win.position.set(-0.1, 1.82, 0);
    g.add(win);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, 0.12, W * 0.9), black);
    rack.position.set(-0.3, 2.32, 0);
    g.add(rack);
    for (let i = 0; i < 3; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), mat([0x3b6fb6, 0xc9975c, 0x8e44ad][i], { roughness: 0.9 }));
      bag.position.set(-1.2 + i * 0.8, 2.55, (i - 1) * 0.3);
      g.add(bag);
    }
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.5, W * 0.9), paint);
    cabin.position.set(-0.15, 1.17, 0);
    g.add(cabin);
    const win = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 0.36, W * 0.92), glass);
    win.position.set(-0.15, 1.16, 0);
    g.add(win);
    if (kind === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.25), mat(0xfff6c8, { emissive: 0xffe08a, emissiveIntensity: 0.5 }));
      sign.position.set(-0.15, 1.52, 0);
      g.add(sign);
    }
  }
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16);
  for (const x of [L * 0.32, -L * 0.32]) {
    for (const z of [W / 2, -W / 2]) {
      const w = new THREE.Mesh(wheel, black);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.33, z);
      g.add(w);
    }
  }
  for (const z of [W * 0.32, -W * 0.32]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.32), mat(0xfff6d6, { emissive: 0xfff2b0, emissiveIntensity: 0.8 }));
    head.position.set(L / 2 + 0.01, kind === 'gbaka' ? 0.95 : 0.72, z);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.3), mat(0xff3b30, { emissive: 0xff2a20, emissiveIntensity: 0.9 }));
    tail.position.set(-L / 2 - 0.01, kind === 'gbaka' ? 0.95 : 0.72, z);
    g.add(tail);
  }
  g.userData.length = L;
  return g;
}
