// Camera isometrica 2:1 come nel riferimento: ortografica, girata di 45°, alzata di 30°.
// Lo zoom tiene il personaggio al 13,4% dell'altezza dello schermo su PC; sul telefono in verticale si allarga
// quanto basta per vedere almeno 15 unità in larghezza.
import * as THREE from 'three';

const AZ = Math.PI / 4, EL = Math.PI / 6;
export const VERSO_CAMERA = new THREE.Vector3(Math.cos(EL) * Math.sin(AZ), Math.sin(EL), Math.cos(EL) * Math.cos(AZ));
export const DESTRA = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
export const SU = new THREE.Vector3().crossVectors(VERSO_CAMERA, DESTRA).normalize();

export function creaCamera() {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  cam.up.set(0, 1, 0);
  const bersaglio = new THREE.Vector3();
  let pxUnita = 60;
  function misura(w, h) {
    // px per unità: 0,056 × altezza (1080p → 60: il personaggio col cappello è il 13,4% dello schermo, come nel riferimento)
    // ma mai meno di 15 unità in larghezza (telefono in verticale)
    pxUnita = Math.min(h * 0.056, w / 15);
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
  return { cam, misura, guarda, bersaglio, pxUnita: () => pxUnita };
}
