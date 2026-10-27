// Modelli 3D nel porto (prova dei look, 28/10): stessa interfaccia della fabbrica degli sprite (sprite.js, fab.crea),
// così main.js mette un bar 3D dove prima c'era il disegno del bar. Ogni modello arriva da public/modelli/<file>.glb,
// si gira, si porta alla misura del mondo (piede in unità, base a terra, centro della pianta nell'origine) e passa al
// look di inchiostro.js (tinte a 3 toni + contorno). I personaggi tengono lo scheletro e le clip.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonaConOssa } from 'three/addons/utils/SkeletonUtils.js';
import { inchiostra } from './inchiostro.js';
import { VERSO_CAMERA } from './camera.js';

// file, giro (gradi attorno alla verticale), misura: piede [x, z] o alto (unità), scatola [x, z, alto] per ombre e
// collisioni, tinte per i materiali grigi; animato = tiene ossa e clip
export const CATALOGO = {
  // scatole come quelle degli sprite (i muri, non il tetto): le ombre cotte nel terreno restano le stesse del 2.5D
  bar: { file: 'bar.glb', giro: 0, piede: [6, 5], scatola: [6.3, 5.3, 4.4] },
  capanno: { file: 'capanno.glb', giro: 0, piede: [4.5, 3.5], scatola: [4.8, 3.8, 4.2] },
  bancarella: { file: 'bancarella.glb', giro: 0, piede: [3, 1.6], scatola: [3.3, 1.9, 3.3] },
  barca: { file: 'barca.glb', giro: 0, piede: [4.0, 1.7], scatola: [4.0, 1.7, 1.0] },
  barista: { file: 'barista.glb', giro: 0, alto: 2.9, scatola: [0.9, 0.9, 2.9] },
  pescatore: { file: 'pescatore.glb', giro: 0, alto: 2.3, scatola: [0.9, 0.9, 2.0] },
  eroe: {
    file: 'eroe.glb', giro: 180, alto: 2.5, scatola: [0.8, 0.8, 2.5], animato: true,
    tinte: { mat_pelle: '#f0a878', mat_capelli: '#4a2a1e', mat_vestito: '#f6efe2' }, nascondi: /^cappello_/,
  },
};

const caricatore = new GLTFLoader();

// carica i modelli che esistono davvero (un file che manca = quel modello resta disegnato)
export async function caricaModelli(nomi = Object.keys(CATALOGO)) {
  const pronti = {};
  await Promise.all(nomi.map(async (nome) => {
    const c = CATALOGO[nome];
    try {
      const gltf = await caricatore.loadAsync(`./modelli/${c.file}`);
      pronti[nome] = { gltf, c };
    } catch { /* manca il file: si resta allo sprite */ }
  }));
  return pronti;
}

// porta un modello alla misura del mondo: giro, scala, base a terra, centro della pianta nell'origine
function misura(radice, c) {
  radice.rotation.y = THREE.MathUtils.degToRad(c.giro ?? 0);
  radice.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(radice, true);
  const dim = box.getSize(new THREE.Vector3());
  const s = c.alto ? c.alto / dim.y : Math.min(c.piede[0] / dim.x, c.piede[1] / dim.z);
  radice.scale.multiplyScalar(s);
  radice.updateMatrixWorld(true);
  box.setFromObject(radice, true);
  const centro = box.getCenter(new THREE.Vector3());
  radice.position.sub(new THREE.Vector3(centro.x, box.min.y, centro.z));
  const d = box.getSize(new THREE.Vector3());
  return { piede: c.piede ?? [d.x, d.z], alto: d.y };
}

export function creaFabbricaModelli(scena, pronti, { nebbia = true } = {}) {
  function crea(nome, x, y, z, opz = {}) {
    const p = pronti[nome];
    if (!p) return null;
    const { gltf, c } = p;
    const base = c.animato ? clonaConOssa(gltf.scene) : gltf.scene.clone(true);
    if (c.nascondi) base.traverse((o) => { if (c.nascondi.test(o.name)) o.visible = false; });
    // la misura si prende prima di aggiungere i gusci (che hanno le stesse ossa ma non contano)
    const interno = new THREE.Group();
    interno.add(base);
    const m = misura(base, c);
    inchiostra(base, { tinte: c.tinte, nebbia });
    const gruppo = new THREE.Group();
    gruppo.add(interno);
    scena.add(gruppo);
    const dati = { scatola: c.scatola ?? [m.piede[0], m.piede[1], m.alto], piede: c.piede ?? m.piede, alto: m.alto, modo: '3d' };
    const o = { nome, mesh: gruppo, interno, x, y, z, specchio: !!opz.specchio, dati, giro: 0 };
    const materiali = [];
    gruppo.traverse((q) => { if (q.isMesh) materiali.push(q.material); });
    // clip: un mixer per modello animato
    if (c.animato && gltf.animations.length) {
      o.mixer = new THREE.AnimationMixer(base);
      o.clip = {};
      for (const a of gltf.animations) o.clip[a.name] = o.mixer.clipAction(a);
    }
    o.disegno = () => {}; // i modelli non cambiano disegno: girano (o.gira) e si animano (o.mixer)
    o.sposta = (x2, y2, z2) => { o.x = x2; o.y = y2; o.z = z2; o.aggiorna(); };
    o.gira = (a) => { o.giro = a; o.aggiorna(); };
    o.aggiorna = () => {
      gruppo.position.set(o.x, o.y, o.z);
      // specchio come negli sprite (x ↔ z nel mondo): riflesso in x e un quarto di giro
      gruppo.scale.set(o.specchio ? -1 : 1, 1, 1);
      gruppo.rotation.y = o.giro + (o.specchio ? Math.PI / 2 : 0);
    };
    o.piede = () => (o.specchio ? [dati.piede[1], dati.piede[0]] : dati.piede);
    o.opacita = (v) => {
      const velato = v < 0.98;
      for (const mt of materiali) {
        mt.uniforms.uOpacita.value = velato ? v : 1;
        if (mt.transparent !== velato) { mt.transparent = velato; mt.needsUpdate = true; }
      }
    };
    o.visibile = (v) => { gruppo.visible = v; };
    // il modello copre il punto p del mondo, guardando dalla camera? (raggio da p verso la camera)
    const raggio = new THREE.Raycaster();
    o.pieno = (p) => {
      raggio.set(p, VERSO_CAMERA);
      return raggio.intersectObject(gruppo, true).some((h) => !h.object.userData.contorno);
    };
    o.aggiorna();
    return o;
  }
  return { crea, ha: (n) => !!pronti[n] };
}
