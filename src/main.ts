import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl';
// Le « worker » de MapLibre, empaqueté par Vite (sinon introuvable une fois le site construit)
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import data from './data/routes.json';
import { INK, makePerson, makePin, makeRider, makeVehicle, VIOLET as VIOLET_HEX } from './models';
import { clamp01, ease, lerp, lerpAngle, Route } from './route';
import { Scene3D, type LngLat, type Placed } from './scene3d';

maplibregl.setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const VIOLET = '#6D28D9';

const main = new Route(data.main.coords as LngLat[]);
const tour = new Route(data.tour.coords as LngLat[]);
const fleet = (data.fleet as LngLat[][]).map((c) => new Route(c));
const pickup = data.main.pickup as LngLat;
const client = data.main.client as LngLat;
const tourStops = data.tour.stops as LngLat[];
const RIDE_MIN = data.main.min as number;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- Carte

/** Style OpenFreeMap allégé : moins de pictogrammes, immeubles 3D plus réalistes */
async function loadStyle(): Promise<StyleSpecification> {
  const s = (await (await fetch(STYLE_URL)).json()) as StyleSpecification;
  s.layers = s.layers.filter((l) => !/^poi|^aerialway|^highway-shield|^road_one_way/.test(l.id));
  for (const l of s.layers) {
    if (l.id === 'building-3d' && l.type === 'fill-extrusion') {
      l.paint = {
        ...l.paint,
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'], 0, '#ECE6DA', 20, '#E3DDD2', 60, '#D7DCE4', 120, '#C9D3E0'],
        'fill-extrusion-opacity': 0.96,
        'fill-extrusion-vertical-gradient': true,
      };
      l.minzoom = 13;
    }
    if (l.id === 'water' && l.type === 'fill') l.paint = { ...l.paint, 'fill-color': '#9FD4E8' };
    if (l.id === 'background' && l.type === 'background') l.paint = { 'background-color': '#F3EEE4' };
  }
  return s;
}

const isMobile = () => window.innerWidth < 760;

async function start() {
  let style: StyleSpecification;
  try {
    style = await loadStyle();
  } catch {
    document.body.classList.add('no-map');
    return;
  }
  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: pickup,
    zoom: 16.4,
    pitch: 62,
    bearing: -30,
    maxPitch: 75,
    interactive: false,
    attributionControl: { compact: true },
    fadeDuration: 0,
    canvasContextAttributes: { antialias: true },
  });
  (window as unknown as { __map: maplibregl.Map }).__map = map;

  map.on('load', () => {
    for (const k of ['day', 'night', 'low-day', 'low-night'] as const) {
      map.addImage(k === 'day' || k === 'night' ? `facade-${k}` : k, facade(k), { pixelRatio: 2 });
    }
    if (map.getLayer('building-3d')) {
      (map as unknown as { setPaintProperty(id: string, p: string, v: unknown): void }).setPaintProperty('building-3d', 'fill-extrusion-pattern', facadeExpr(false));
    }
    // Lumière rasante de fin d'après-midi : les façades au soleil et à l'ombre se distinguent
    map.setLight({ anchor: 'map', position: [1.4, 230, 35], color: '#fff3e0', intensity: 0.55 });
    map.setSky?.({ 'sky-color': '#BFD9F0', 'horizon-color': '#F7EBDD', 'fog-color': '#F3EEE4', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4 });

    // Tracés : trajet à venir (pointillés blancs) et parcouru (violet), tournée
    const line = (coords: LngLat[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } });
    map.addSource('main-full', { type: 'geojson', data: line(main.coords) });
    map.addSource('main-done', { type: 'geojson', data: line(main.slice(0)) });
    map.addSource('tour-full', { type: 'geojson', data: line(tour.coords) });
    map.addSource('tour-done', { type: 'geojson', data: line(tour.slice(0)) });
    const before = map.getLayer('building-3d') ? 'building-3d' : undefined;
    map.addLayer({ id: 'main-full', type: 'line', source: 'main-full', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': VIOLET, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 17, 8], 'line-dasharray': [0.7, 1.3], 'line-opacity': 0 } }, before);
    map.addLayer({ id: 'main-done-glow', type: 'line', source: 'main-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': VIOLET, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 8, 17, 22], 'line-opacity': 0.22, 'line-blur': 4 } }, before);
    map.addLayer({ id: 'main-done', type: 'line', source: 'main-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': VIOLET, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 10] } }, before);
    map.addLayer({ id: 'tour-full', type: 'line', source: 'tour-full', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': VIOLET, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 6], 'line-dasharray': [0.7, 1.3], 'line-opacity': 0 } }, before);
    map.addLayer({ id: 'tour-done', type: 'line', source: 'tour-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': VIOLET, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 9], 'line-opacity': 0 } }, before);

    // Scène 3D : livreur, commerçante, cliente, épingle, flotte de nuit
    const s3d = new Scene3D(pickup);
    map.addLayer(s3d);
    const rider = s3d.add(makeRider(), main.at(0), { heading: main.heading(0), screenPx: 58, size: 2.1 });
    const seller = s3d.add(makePerson({ shirt: 0xe0763a, headwrap: 0x6d28d9, parcel: true }), offset(pickup, -26, 16), { heading: main.heading(0) + Math.PI / 2, screenPx: 52, size: 1.85 });
    const buyer = s3d.add(makePerson({ shirt: 0x2f8f6b, skin: 0x5a3a24, parcel: true }), offset(client, 24, -14), { heading: main.heading(1) + Math.PI, screenPx: 52, size: 1.85 });
    const pin = s3d.add(makePin(), client, { screenPx: 54, size: 4.5, visible: false });
    // Remise du colis : la moto garée, le livreur à pied avec le colis
    const parked = s3d.add(makeRider({ rider: false }), main.at(1), { heading: main.heading(0.999), screenPx: 58, size: 2.1, visible: false });
    const courier = s3d.add(makePerson({ shirt: INK, pants: 0x2f3a55, helmet: VIOLET_HEX, parcel: true }), main.at(1), { screenPx: 52, size: 1.85, visible: false });
    (buyer.obj.userData.parcel as { visible: boolean }).visible = false;
    const courierFrom = offset(main.at(1), 9, -5);
    const courierTo = offset(client, 14, -8);

    // Circulation : voitures, taxis rouges et gbakas sur les vraies routes (8 à 11 m/s)
    const trafficRoutes = [...fleet, tour, main];
    const kinds: ['car' | 'taxi' | 'gbaka', number][] = [['taxi', 0], ['car', 0xdedfe3], ['gbaka', 0], ['car', 0x2b3a55], ['taxi', 0], ['car', 0x8c1c24], ['car', 0xf2f2f2], ['gbaka', 0], ['taxi', 0], ['car', 0x3d3d44], ['car', 0xc9b27c], ['taxi', 0], ['car', 0x5b6b7f], ['gbaka', 0]];
    const traffic = kinds.map(([kind, color], i) => {
      const route = trafficRoutes[i % trafficRoutes.length];
      const len = kind === 'gbaka' ? 5.4 : 4.3;
      return {
        route,
        phase: (i * 0.137) % 1,
        dir: i % 2 ? 1 : -1,
        speed: 8 + (i % 4),
        placed: s3d.add(makeVehicle(kind, color || undefined), route.at(0), { screenPx: len * 15, size: len, visible: false }),
      };
    });

    const riders: Placed[] = fleet.map((r, i) => s3d.add(makeRider({ lights: true, jacket: [0x121214, 0x1e3a5f, 0x3b2a1a][i % 3] }), r.at(0), { screenPx: 56, size: 2.1, visible: false }));

    // Repères HTML (bulles)
    const bubble = (html: string, cls = '') => {
      const wrap = document.createElement('div');
      const el = document.createElement('div');
      el.className = `bubble ${cls}`;
      el.innerHTML = html;
      wrap.appendChild(el);
      return wrap;
    };
    const shopTag = new maplibregl.Marker({ element: bubble('<b>Boutique Aïcha</b><span>Le Plateau · départ</span>'), anchor: 'bottom', offset: [0, -96] }).setLngLat(pickup).addTo(map);
    const clientTag = new maplibregl.Marker({ element: bubble('<b>Moussa attend son colis</b><span>Marcory Zone 4</span>'), anchor: 'bottom', offset: [0, -92] }).setLngLat(client).addTo(map);
    const codeTag = new maplibregl.Marker({ element: bubble('<b>Code 4 8 1 7</b><span>Colis remis ✓</span>', 'ok'), anchor: 'bottom', offset: [0, -92] }).setLngLat(client).addTo(map);
    const stopTags = tourStops.map((p, i) => new maplibregl.Marker({ element: bubble(`<b>${i + 1}</b>`, 'num') }).setLngLat(p).addTo(map));

    // ------------------------------------------------ Scènes pilotées par le défilement
    const sections = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
    const live = document.getElementById('live')!;
    const phone = document.getElementById('phone')!;
    const phoneEta = document.getElementById('phone-eta')!;
    const phoneEtaLabel = document.getElementById('phone-eta-label')!;
    const phoneStatus = document.getElementById('phone-status')!;
    const phoneBar = document.getElementById('phone-bar')!;
    const phoneCode = document.getElementById('phone-code')!;
    const phoneSteps = [...document.querySelectorAll<HTMLElement>('#phone .steps li')];
    const liveEta = document.getElementById('live-eta')!;
    const liveStep = document.getElementById('live-step')!;
    const liveBar = document.getElementById('live-bar')!;
    const cam = { lng: pickup[0], lat: pickup[1], zoom: 16.4, pitch: 62, bearing: -30 };
    let night = 0;
    let nightApplied = false;
    const tog = (m: maplibregl.Marker, on: boolean) => (m.getElement().firstElementChild as HTMLElement).classList.toggle('on', on);
    const t0 = performance.now();

    type Cam = { c: LngLat; zoom: number; pitch: number; bearing: number };
    const rideCam = (t: number, zoom = 16.9, pitch = 66): Cam => {
      const p = main.at(t);
      const brg = 90 + (main.heading(t) * 180) / Math.PI;
      return { c: p, zoom: isMobile() ? zoom - 0.6 : zoom, pitch, bearing: brg - 25 };
    };

    const frame = () => {
      const now = (performance.now() - t0) / 1000;
      const vh = window.innerHeight;
      // Section active et sa progression (0 → 1)
      let name = 'hero', p = 0;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= vh * 0.55 && r.bottom > vh * 0.55) {
          name = s.dataset.scene!;
          p = clamp01((vh * 0.55 - r.top) / Math.max(1, r.height));
          break;
        }
      }
      // Cadres de texte : un seul à la fois, avec un fondu (fini les chevauchements)
      for (const sec of sections) {
        const card = sec.querySelector<HTMLElement>(':scope > .card, :scope > .pros');
        if (!card || sec.classList.contains('solid') || sec.classList.contains('final')) continue;
        const r = sec.getBoundingClientRect();
        const lp = (vh * 0.55 - r.top) / Math.max(1, r.height);
        const fadeIn = sec.dataset.scene === 'hero' ? 1 : clamp01(lp / 0.07);
        const fadeOut = clamp01((1 - lp) / 0.12);
        const o = Math.min(fadeIn, fadeOut);
        card.style.opacity = o.toFixed(3);
        card.style.transform = `translateY(${((1 - o) * (lp < 0.5 ? 24 : -24)).toFixed(1)}px)`;
        card.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
      }
      const orbit = reduced ? 0 : Math.sin(now / 9) * 8;
      let target: Cam;
      let ride = 0, showMainFull = 1, tourDraw = -1, wantNight = 0, pinOn = false, codeOn = false, liveOn = false;

      switch (name) {
        case 'hero':
          target = { c: offset(pickup, -6, 2), zoom: isMobile() ? 16.6 : 17.4, pitch: 64, bearing: -40 + orbit };
          break;
        case 'order': {
          // L'adresse du client se pose ; la caméra survole le trajet
          const e = ease(p);
          const mid = main.at(0.5);
          target = { c: [lerp(pickup[0], mid[0], e), lerp(pickup[1], mid[1], e)], zoom: lerp(17, 14.4, e) - (isMobile() ? 0.5 : 0), pitch: lerp(64, 50, e), bearing: lerp(-40, -10, e) };
          pinOn = p > 0.15;
          break;
        }
        case 'track':
          ride = ease(p);
          target = rideCam(ride);
          liveOn = true;
          break;
        case 'delivered':
          ride = 1;
          target = { c: offset(client, 6, -4), zoom: isMobile() ? 17.8 : 18.4, pitch: 68, bearing: lerp(-20, 40, ease(p)) };
          codeOn = p > 0.42;
          break;
        case 'tour': {
          ride = 1;
          showMainFull = 0;
          tourDraw = ease(clamp01(p * 1.15));
          const c = tour.at(0.5);
          target = { c, zoom: isMobile() ? 13.4 : 14.2, pitch: 48, bearing: lerp(-10, 15, p) };
          break;
        }
        case 'price':
          ride = 1;
          showMainFull = 0;
          target = { c: [-3.995, 5.322], zoom: isMobile() ? 11.6 : 12.4, pitch: 38, bearing: lerp(0, -12, p) };
          break;
        case 'trust':
          showMainFull = 0;
          wantNight = 1;
          target = { c: [-4.016, 5.322], zoom: isMobile() ? 15.2 : 15.8, pitch: 70, bearing: lerp(-60, 10, p) + orbit };
          break;
        default: // pros, faq, final : vue d'ensemble de nuit sur le Plateau
          showMainFull = 0;
          wantNight = 1;
          target = { c: [-4.012, 5.318], zoom: isMobile() ? 14.6 : 15.2, pitch: 72, bearing: 20 + now * 2 };
      }

      // Caméra amortie (mouvement fluide)
      const k = reduced ? 1 : 0.085;
      cam.lng = lerp(cam.lng, target.c[0], k);
      cam.lat = lerp(cam.lat, target.c[1], k);
      cam.zoom = lerp(cam.zoom, target.zoom, k);
      cam.pitch = lerp(cam.pitch, target.pitch, k);
      cam.bearing = lerpAngle(cam.bearing, target.bearing, k);
      const centered = name === 'pros' || name === 'faq' || name === 'final';
      const padding = isMobile()
        ? { top: 60, bottom: Math.round(window.innerHeight * 0.4), left: 0, right: 0 }
        : { top: 70, bottom: 0, left: centered ? 0 : Math.min(600, Math.round(window.innerWidth * 0.4)), right: (name === 'track' || name === 'delivered') && window.innerHeight > 640 ? 330 : 0 };
      map.jumpTo({ center: [cam.lng, cam.lat], zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing, padding });

      // Livreur et tracés
      rider.lngLat = main.at(ride);
      rider.heading = main.heading(Math.min(ride, 0.999));
      (map.getSource('main-done') as GeoJSONSource).setData(line(main.slice(ride)));
      map.setPaintProperty('main-full', 'line-opacity', showMainFull * 0.95);
      map.setPaintProperty('main-done', 'line-opacity', showMainFull);
      map.setPaintProperty('main-done-glow', 'line-opacity', showMainFull * 0.22);
      map.setPaintProperty('tour-full', 'line-opacity', tourDraw >= 0 ? 0.9 : 0);
      map.setPaintProperty('tour-done', 'line-opacity', tourDraw >= 0 ? 1 : 0);
      if (tourDraw >= 0) (map.getSource('tour-done') as GeoJSONSource).setData(line(tour.slice(tourDraw)));
      stopTags.forEach((m, i) => tog(m,  tourDraw >= 0 && tourDraw >= (i + 1) / (tourStops.length + 0.4)));

      // Personnages : la commerçante salue, le client tend la main à l'arrivée
      const wave = Math.sin(now * 5) * 0.5;
      (seller.obj.userData.armR as { rotation: { x: number } }).rotation.x = name === 'hero' ? -2.4 + wave : 0;
      (buyer.obj.userData.armR as { rotation: { z: number } }).rotation.z = codeOn ? 1.2 : name === 'track' && ride > 0.9 ? 0.8 : 0;
      pin.visible = (name === 'order' && pinOn) || name === 'track';
      (pin.obj.userData.ring as { scale: { setScalar(n: number): void } }).scale.setScalar(1 + ((now * 0.8) % 1) * 1.6);
      pin.lift = Math.sin(now * 2.4) * 0.25;
      tog(shopTag, name === 'hero');
      tog(clientTag, (name === 'order' && pinOn) || (name === 'track' && ride > 0.6) || (name === 'delivered' && !codeOn));
      tog(codeTag, codeOn);
      // Chaque personnage n'apparaît que dans ses scènes
      const story = name === 'hero' || name === 'order' || name === 'track' || name === 'delivered';
      // Remise : le livreur descend (12 %), marche jusqu'à Moussa, lui donne le colis (42 %)
      const handing = name === 'delivered' && p >= 0.12;
      rider.visible = story && !handing;
      parked.visible = handing;
      courier.visible = handing;
      if (handing) {
        const w = ease(clamp01((p - 0.12) / 0.26));
        courier.lngLat = [lerp(courierFrom[0], courierTo[0], w), lerp(courierFrom[1], courierTo[1], w)];
        const dx = (courierTo[0] - courierFrom[0]) * Math.cos((client[1] * Math.PI) / 180);
        const dz = -(courierTo[1] - courierFrom[1]);
        courier.heading = Math.atan2(dz, dx);
        courier.lift = w < 1 ? Math.abs(Math.sin(now * 9)) * 0.04 : 0; // pas de marche
        (courier.obj.userData.parcel as { visible: boolean }).visible = !codeOn;
        (courier.obj.userData.armR as { rotation: { z: number } }).rotation.z = w > 0.9 && !codeOn ? 1.1 : 0;
      }
      (buyer.obj.userData.parcel as { visible: boolean }).visible = name === 'delivered' && codeOn;
      seller.visible = name === 'hero' || name === 'order';
      buyer.visible = (name === 'order' && pinOn) || name === 'track' || name === 'delivered';

      // Suivi en direct (carte flottante)
      const phoneOn = name === 'track' || name === 'delivered';
      phone.classList.toggle('on', phoneOn);
      if (phoneOn) {
        const done = name === 'delivered' && codeOn;
        const left = Math.max(1, Math.ceil(RIDE_MIN * (1 - ride)));
        phoneEta.textContent = done ? 'Livré' : ride > 0.985 ? 'Arrivé' : `${left} min`;
        phoneEtaLabel.textContent = done ? 'COLIS REMIS' : 'ARRIVÉE';
        phoneStatus.textContent = done ? 'Colis remis à Moussa' : ride > 0.985 ? 'Votre livreur est arrivé' : 'Votre colis est en route';
        phoneBar.style.width = `${Math.round((done ? 1 : ride) * 100)}%`;
        phoneSteps.forEach((el, i) => el.classList.toggle('on', i < (done ? 4 : ride > 0.985 ? 3 : 3)));
        phoneSteps[3].classList.toggle('on', done);
        phoneCode.classList.toggle('on', done);
      }
      live.classList.toggle('on', liveOn);
      if (liveOn) {
        const left = Math.max(1, Math.ceil(RIDE_MIN * (1 - ride)));
        liveEta.textContent = ride > 0.985 ? 'Arrivé' : `${left} min`;
        liveStep.textContent = ride < 0.12 ? 'Départ du Plateau' : ride < 0.55 ? 'Sur le pont, vers Marcory' : ride < 0.985 ? 'Bientôt chez Moussa' : 'Devant chez Moussa';
        liveBar.style.width = `${Math.round(ride * 100)}%`;
      }

      // Circulation (de près seulement : de loin, elle encombrerait la vue)
      const showTraffic = cam.zoom > 15.4 && night < 0.5 && name !== 'delivered';
      for (const v of traffic) {
        v.placed.visible = showTraffic;
        if (!showTraffic) continue;
        const dur = v.route.length / v.speed;
        let t = (now / dur + v.phase) % 1;
        if (v.dir < 0) t = 1 - t;
        v.placed.lngLat = v.route.at(t);
        v.placed.heading = v.route.heading(t) + (v.dir < 0 ? Math.PI : 0);
      }

      // Nuit : la ville s'allume, la flotte LETO circule
      night = lerp(night, wantNight, 0.05);
      if ((night > 0.5) !== nightApplied) {
        nightApplied = night > 0.5;
        applyNight(map, nightApplied);
      }
      document.documentElement.style.setProperty('--night', night.toFixed(3));
      s3d.ambient.intensity = lerp(1.6, 0.55, night);
      s3d.sun.intensity = lerp(2.4, 0.35, night);
      riders.forEach((r, i) => {
        r.visible = night > 0.3;
        const t = ((now / (40 + i * 7) + i * 0.17) % 1);
        r.lngLat = fleet[i].at(t);
        r.heading = fleet[i].heading(t);
      });

      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    document.body.classList.add('map-ready');
  });

  map.on('error', (e) => console.warn('Carte :', (e as unknown as { error?: Error }).error?.message));
}

/** Motif de façade : rangées de fenêtres (jour) ou fenêtres éclairées (nuit) */
function facade(kind: 'day' | 'night' | 'low-day' | 'low-night'): ImageData {
  const S = 128; // 64 px affichés (pixelRatio 2)
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const night = kind.endsWith('night');
  const low = kind.startsWith('low');
  g.fillStyle = night ? (low ? '#2a2836' : '#2f2c40') : low ? '#EFE7DA' : '#E6E2DA';
  g.fillRect(0, 0, S, S);
  if (low) {
    // Maisons et petits bâtiments : enduit uni (pas de fenêtres sur les toits vus d'en haut)
    g.fillStyle = night ? '#302d3f' : '#E8DFD0';
    for (let i = 0; i < 10; i++) g.fillRect((i * 41) % S, (i * 67) % S, 18, 3);
    return g.getImageData(0, 0, S, S);
  }
  // Immeubles : 6 × 6 fenêtres fines par motif, une sur deux éclairée la nuit (pseudo-aléatoire stable)
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 6 + col * 20, y = 6 + row * 20;
      if (night) g.fillStyle = rnd() < 0.5 ? (rnd() < 0.7 ? '#f2bd62' : '#fde4a8') : '#3a3650';
      else g.fillStyle = rnd() < 0.2 ? '#b4c6d4' : '#c2d2de';
      g.fillRect(x, y, 11, 12);
    }
  }
  return g.getImageData(0, 0, S, S);
}
const facadeExpr = (night: boolean) => ['case', ['>', ['get', 'render_height'], 9], night ? 'facade-night' : 'facade-day', night ? 'low-night' : 'low-day'];

/** Palette de nuit : la ville éclairée (routes couleur sodium, eau sombre, immeubles bleutés) */
const dayPaint = new Map<string, unknown>();
function applyNight(map: maplibregl.Map, on: boolean) {
  const m = map as unknown as { getPaintProperty(id: string, p: string): unknown; setPaintProperty(id: string, p: string, v: unknown): void };
  const set = (id: string, prop: string, value: unknown) => {
    const key = `${id}|${prop}`;
    if (!dayPaint.has(key)) dayPaint.set(key, m.getPaintProperty(id, prop) ?? null);
    m.setPaintProperty(id, prop, on ? value : dayPaint.get(key));
  };
  for (const l of map.getStyle().layers) {
    if (l.id.startsWith('main-') || l.id.startsWith('tour-') || l.id === 'leto-3d') continue;
    if (l.type === 'background') set(l.id, 'background-color', '#15141d');
    else if (l.type === 'fill') {
      if (l.id === 'water') set(l.id, 'fill-color', '#1b2740');
      else set(l.id, 'fill-color', '#1f1d29');
    } else if (l.type === 'fill-extrusion') {
      m.setPaintProperty(l.id, 'fill-extrusion-pattern', facadeExpr(on));
    } else if (l.type === 'line') {
      if (/casing/.test(l.id)) set(l.id, 'line-color', '#121119');
      else if (/water|river/.test(l.id)) set(l.id, 'line-color', '#1b2740');
      else if (/motorway|trunk|primary|secondary|tertiary/.test(l.id)) set(l.id, 'line-color', '#e0a458');
      else if (/road|bridge|tunnel|street|minor|link|service/.test(l.id)) set(l.id, 'line-color', '#6d5a45');
      else set(l.id, 'line-color', '#2c2a38');
    } else if (l.type === 'symbol') {
      set(l.id, 'text-color', '#d8d2ea');
      set(l.id, 'text-halo-color', '#15141d');
    }
  }
}

/** Décale un point de (est, nord) mètres */
function offset(p: LngLat, east: number, north: number): LngLat {
  return [p[0] + east / (111320 * Math.cos((p[1] * Math.PI) / 180)), p[1] + north / 110540];
}

// ---------------------------------------------------------------- Simulateur de prix

const COMMUNES: Record<string, [number, number]> = {
  Abobo: [5.418, -4.02], 'Adjamé': [5.356, -4.023], 'Attécoubé': [5.337, -4.042], Cocody: [5.36, -3.97], Koumassi: [5.295, -3.95],
  Marcory: [5.3, -3.983], Plateau: [5.323, -4.019], 'Port-Bouët': [5.256, -3.926], Treichville: [5.293, -4.008], Yopougon: [5.345, -4.089], Bingerville: [5.355, -3.885],
};
function setupSimulator() {
  const from = document.getElementById('sim-from') as HTMLSelectElement | null;
  const to = document.getElementById('sim-to') as HTMLSelectElement | null;
  if (!from || !to) return;
  for (const sel of [from, to]) sel.innerHTML = Object.keys(COMMUNES).map((c) => `<option>${c}</option>`).join('');
  from.value = 'Plateau';
  to.value = 'Cocody';
  const out = (id: string, v: string) => (document.getElementById(id)!.textContent = v);
  const fmt = (n: number) => `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} F`;
  const update = () => {
    const a = COMMUNES[from.value], b = COMMUNES[to.value];
    const km = Math.max(1, (distKm(a, b)) * 1.35);
    const base = Math.max(1000, 500 + 100 * km);
    const c50 = (x: number) => Math.ceil(x / 50) * 50;
    out('sim-km', `${km.toFixed(1).replace('.', ',')} km`);
    out('sim-2h', fmt(Math.min(2000, c50(base * 0.85))));
    out('sim-std', fmt(Math.min(2200, c50(base))));
    out('sim-exp', fmt(Math.min(2500, c50(base * 1.2))));
  };
  from.onchange = to.onchange = update;
  update();
}
function distKm(a: [number, number], b: [number, number]) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

setupSimulator();
void start();
