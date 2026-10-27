// Camera isometrica 2:1 come nel riferimento: ortografica, girata di 45°, alzata di 30°.
// Lo zoom tiene il personaggio al 13,4% dell'altezza dello schermo su PC; sul telefono in verticale si allarga
// quanto basta per vedere almeno 15 unità in larghezza.
// Prova dei look (28/10): nelle versioni 3D un tasto la gira di ±30° attorno alla verticale (orbita): i tre versi
// (VERSO_CAMERA, DESTRA, SU) cambiano sul posto, così chi li usa nei materiali li vede aggiornati senza fare niente.
import * as THREE from 'three';

const AZ = Math.PI / 4, EL = Math.PI / 6;
// ?zoom=1.6: inquadratura più stretta (per il video della prova); di serie quella del gioco
const ZOOM = Math.min(3, Math.max(0.5, +(new URLSearchParams(location.search).get('zoom') ?? 1) || 1));
export const VERSO_CAMERA = new THREE.Vector3();
export const DESTRA = new THREE.Vector3();
export const SU = new THREE.Vector3();
// giù sullo schermo, a terra (serve ai comandi: tirare giù = andare verso la camera)
export const GIU_TERRA = new THREE.Vector3();

export function orienta(az = AZ) {
  VERSO_CAMERA.set(Math.cos(EL) * Math.sin(az), Math.sin(EL), Math.cos(EL) * Math.cos(az));
  DESTRA.set(Math.cos(az), 0, -Math.sin(az));
  SU.crossVectors(VERSO_CAMERA, DESTRA).normalize();
  GIU_TERRA.set(Math.sin(az), 0, Math.cos(az));
}
orienta();

export function creaCamera() {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  cam.up.set(0, 1, 0);
  const bersaglio = new THREE.Vector3();
  let pxUnita = 60;
  function misura(w, h) {
    // px per unità: 0,056 × altezza (1080p → 60: il personaggio col cappello è il 13,4% dello schermo, come nel riferimento)
    // ma mai meno di 15 unità in larghezza (telefono in verticale)
    pxUnita = Math.min(h * 0.056, w / 15) * ZOOM;
    cam.left = -w / 2 / pxUnita; cam.right = w / 2 / pxUnita;
    cam.top = h / 2 / pxUnita; cam.bottom = -h / 2 / pxUnita;
    cam.updateProjectionMatrix();
  }
  function guarda(x, y, z) {
    bersaglio.set(x, y, z);
    cam.position.copy(bersaglio).addScaledVector(VERSO_CAMERA, 150);
    cam.lookAt(bersaglio);
    cam.updateMatrixWorld();
  }
  // orbita: scarto dall'angolo di partenza (radianti); va piano verso quello voluto. passo() dice se si è mossa
  let scarto = 0, voluto = 0;
  function passo(dt) {
    if (scarto === voluto) return false;
    scarto += (voluto - scarto) * Math.min(1, dt * 5);
    if (Math.abs(voluto - scarto) < 1e-3) scarto = voluto;
    orienta(AZ + scarto);
    return true;
  }
  return { cam, misura, guarda, bersaglio, pxUnita: () => pxUnita, orbita: (v) => { voluto = v; }, passo, voluto: () => voluto };
}
