// Sprite disegnati (già visti in isometrico) su un quadrilatero rivolto alla camera. Chi sta davanti a chi:
// - «piano» (persone, alberi, palme, oggetti): il disegno come una sagoma verticale piantata sulla sua base (ogni pixel
//   sta sopra la base all'altezza che ha sullo schermo), portata un po' avanti quanto il disegno scende sotto la base:
//   niente tagli dentro il disegno, e la testa di chi sta vicino a un muro non entra nel muro;
// - «scatola» (bar, capanno, bancarella, bancone): ogni pixel prende la profondità del punto in cui il raggio della camera
//   entra nella scatola dei muri o in quella del tetto. Così il personaggio passa davanti al muro sinistro del bar e dietro
//   al suo spigolo. I disegni di questi edifici stanno dentro i loro volumi (disegnati sulle guide grigie).
import * as THREE from 'three';
import { DESTRA, SU, VERSO_CAMERA } from './camera.js';
import { FOSCHIA, GLSL_FOSCHIA } from './atmosfera.js';

export const VP = { value: new THREE.Matrix4() }; // vista × proiezione, aggiornata a ogni fotogramma
// sotto questa trasparenza il pixel del disegno si scarta: 0,04 in HD; nei look pixel 0,5 (il bordo sfumato, rimpicciolito,
// diventerebbe un alone chiaro o magenta)
export const SOGLIA = { value: 0.04 };

const VERT = /* glsl */`
  varying vec2 vUv; varying vec3 vMondo;
  void main() {
    vUv = uv;
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMondo = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }`;
const FRAG = /* glsl */`
  uniform sampler2D map; uniform vec3 uMin, uMax, uMin2, uMax2; uniform mat4 uVP; uniform float uOpacita, uScatola, uAvanti, uSoglia; uniform vec3 uBase, uSu;
  varying vec2 vUv; varying vec3 vMondo;
  ${GLSL_FOSCHIA}
  float entra(vec3 o, vec3 d, vec3 mn, vec3 mx) {
    vec3 t0 = (mn - o) / d, t1 = (mx - o) / d;
    vec3 a = min(t0, t1), b = max(t0, t1);
    float tn = max(max(a.x, a.y), a.z), tf = min(min(b.x, b.y), b.z);
    return tn <= tf ? tn : 1e9;
  }
  void main() {
    vec4 c = texture2D(map, vUv); // premoltiplicata: il filtro non pesca colori da sotto la trasparenza
    if (c.a < uSoglia) discard;
    c.rgb /= c.a;
    // sagoma verticale: salire di v sullo schermo = salire di v / cos 30° sopra la base, cioè 0,577·v più vicino alla camera
    vec3 p = vMondo + uVerso * (uAvanti + 0.577 * max(0.0, dot(vMondo - uBase, uSu)));
    if (uScatola > 0.5) {
      vec3 o = vMondo + uVerso * 80.0, d = -uVerso;
      float t = min(entra(o, d, uMin, uMax), entra(o, d, uMin2, uMax2));
      if (t < 1e8) p = o + d * t;
    }
    vec4 clip = uVP * vec4(p, 1.0);
    gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
    // foschia come il terreno sotto i piedi: il quadrilatero sta tutto alla profondità della base
    gl_FragColor = vec4(foschia(c.rgb, vMondo), c.a * uOpacita);
  }`;

const quad = new THREE.PlaneGeometry(1, 1);
const orient = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(DESTRA, SU, VERSO_CAMERA));

// nitido = disegni a pixel (prova dei look, versione di Riccardo): niente filtro, ogni pixel del disegno resta un quadrato
export async function caricaSprite(cartella = './sprite/', { nitido = false, formato = 'webp' } = {}) {
  const elenco = await (await fetch(cartella + 'elenco.json')).json();
  const carica = new THREE.TextureLoader();
  const texture = {};
  await Promise.all(Object.keys(elenco).map((n) => carica.loadAsync(`${cartella}${n}.${formato}`).then((t) => {
    t.colorSpace = THREE.NoColorSpace;
    t.premultiplyAlpha = true;
    t.anisotropy = 4;
    if (nitido) { t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    texture[n] = t;
  })));
  return { elenco, texture, alfa: alfaDi(texture) };
}

// l'alfa di ogni disegno a un quarto della misura, letto una volta sola quando serve (per il velo)
function alfaDi(texture) {
  const cache = {};
  return (nome) => {
    if (cache[nome]) return cache[nome];
    const im = texture[nome].image, w = Math.max(1, im.width >> 2), h = Math.max(1, im.height >> 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3];
    return (cache[nome] = { w, h, a });
  };
}

// nebbia = false dentro il bar (la foschia è del fuori)
export function creaFabbrica(scena, { elenco, texture, alfa }, nebbia = true) {
  const creati = [];
  function materiale(nome) {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture[nome] }, uMin: { value: new THREE.Vector3() }, uMax: { value: new THREE.Vector3() },
        uMin2: { value: new THREE.Vector3() }, uMax2: { value: new THREE.Vector3() }, uScatola: { value: 0 }, uAvanti: { value: 0 }, uBase: { value: new THREE.Vector3() }, uSu: { value: SU },
        uVP: VP, uOpacita: { value: 1 }, uSoglia: SOGLIA, ...FOSCHIA, ...(nebbia ? {} : { uForza: { value: 0 } }),
      },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, alphaToCoverage: true,
    });
  }

  // un oggetto del mondo: sprite + scatola + piede; si può cambiare disegno (passo, direzione) e spostare
  function crea(nome, x, y, z, opz = {}) {
    if (!elenco[nome]) { console.warn('sprite mancante', nome); return null; }
    const mesh = new THREE.Mesh(quad, materiale(nome));
    mesh.quaternion.copy(orient);
    mesh.frustumCulled = false;
    scena.add(mesh);
    const o = { nome, mesh, x, y, z, specchio: !!opz.specchio, dati: elenco[nome] };
    o.disegno = (n, specchio = o.specchio) => {
      if (n !== o.nome) { o.nome = n; o.dati = elenco[n]; mesh.material.uniforms.map.value = texture[n]; }
      o.specchio = specchio;
      o.aggiorna();
    };
    o.sposta = (x2, y2, z2) => { o.x = x2; o.y = y2; o.z = z2; o.aggiorna(); };
    o.aggiorna = () => {
      const d = o.dati, s = d.s, sp = o.specchio ? -1 : 1;
      const offX = ((d.w / 2 - d.ax) / s) * sp, offY = (d.ay - d.h / 2) / s;
      mesh.scale.set((d.w / s) * sp, d.h / s, 1);
      mesh.position.set(o.x, o.y, o.z).addScaledVector(DESTRA, offX).addScaledVector(SU, offY);
      // specchiare sullo schermo = scambiare x e z nel mondo
      const [bx, bz, bh] = o.specchio ? [d.scatola[1], d.scatola[0], d.scatola[2]] : d.scatola;
      const u = mesh.material.uniforms;
      u.uMin.value.set(o.x - bx / 2, o.y - 0.05, o.z - bz / 2);
      u.uMax.value.set(o.x + bx / 2, o.y + bh, o.z + bz / 2);
      // il tetto (o la tenda) che sporge sopra i muri
      const t = d.tetto ? (o.specchio ? [d.tetto[1], d.tetto[0], d.tetto[2], d.tetto[3]] : d.tetto) : [0, 0, -9, -9];
      u.uMin2.value.set(o.x - t[0] / 2, o.y + t[2], o.z - t[1] / 2);
      u.uMax2.value.set(o.x + t[0] / 2, o.y + t[3], o.z + t[1] / 2);
      u.uScatola.value = d.modo === 'scatola' ? 1 : 0;
      u.uAvanti.value = d.avanti ?? 0.3;
      u.uBase.value.set(o.x, o.y, o.z);
    };
    o.piede = () => (o.specchio ? [o.dati.piede[1], o.dati.piede[0]] : o.dati.piede);
    // velato = trasparenza vera (il tratteggio dell'alpha-to-coverage a metà opacità si vede a righe)
    o.opacita = (v) => {
      const m = mesh.material, velato = v < 0.98;
      m.uniforms.uOpacita.value = velato ? v : 1;
      if (m.transparent !== velato) { m.transparent = velato; m.alphaToCoverage = !velato; m.needsUpdate = true; }
    };
    o.visibile = (v) => { mesh.visible = v; };
    // il disegno è pieno nel punto del mondo p (sullo schermo)? serve al velo: copre davvero il personaggio?
    o.pieno = (p) => {
      const u = (p.dot(DESTRA) - mesh.position.dot(DESTRA)) / mesh.scale.x + 0.5;
      const v = 0.5 - (p.dot(SU) - mesh.position.dot(SU)) / mesh.scale.y;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
      const m = alfa(o.nome);
      return m.a[Math.floor(v * m.h) * m.w + Math.floor(u * m.w)] > 120;
    };
    o.aggiorna();
    creati.push(o);
    return o;
  }
  // la camera ha girato (prova dei look): i disegni si rigirano verso di lei
  function riorienta() {
    orient.setFromRotationMatrix(new THREE.Matrix4().makeBasis(DESTRA, SU, VERSO_CAMERA));
    for (const o of creati) { o.mesh.quaternion.copy(orient); o.aggiorna(); }
  }
  return { crea, ha: (n) => !!elenco[n], riorienta };
}
