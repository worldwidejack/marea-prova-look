// Il look «pixel» (prova dei look, 28/10): la stessa scena disegnata su un bersaglio piccolo e ingrandita senza filtro,
// ogni pixel un quadrato di p×p pixel veri dello schermo. Pixel fini: il protagonista è alto ~48 pixel (come la prova
// del 21/10, 360 righe su un PC). La camera si aggancia alla griglia dei pixel del mondo (le cose ferme non tremolano
// quando lei si muove) e il pezzetto sotto il pixel si recupera spostando l'immagine intera: lo scorrimento resta liscio.
import * as THREE from 'three';
import { DESTRA, SU } from './camera.js';

export const ALTEZZA_EROE_PX = 48;

export function creaPixel(renderer) {
  const rt = new THREE.WebGLRenderTarget(4, 4, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true, stencilBuffer: true,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  const u = { tela: { value: rt.texture }, uP: { value: 4 }, uSposta: { value: new THREE.Vector2() }, uMisura: { value: new THREE.Vector2(4, 4) } };
  const quadro = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)),
    new THREE.ShaderMaterial({
      uniforms: u, depthTest: false, depthWrite: false,
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tela; uniform float uP; uniform vec2 uSposta, uMisura;
        void main() { vec2 q = floor((gl_FragCoord.xy + uSposta) / uP) + 0.5; gl_FragColor = texture2D(tela, q / uMisura); }`,
    }),
  );
  quadro.frustumCulled = false;
  const scenaQuadro = new THREE.Scene();
  scenaQuadro.add(quadro);
  const camQuadro = new THREE.OrthographicCamera();

  let p = 4, W = 4, H = 4, wDev = 4, hDev = 4, unita = 0.05; // unita = lato di un pixel in unità di mondo
  const resto = new THREE.Vector2();
  return {
    rt,
    // wCss, hCss, pxUnita (css px per unità): sceglie p e la misura del bersaglio, sistema la camera
    misura(cam, wCss, hCss, pxUnita) {
      const dpr = renderer.getPixelRatio();
      wDev = Math.round(wCss * dpr); hDev = Math.round(hCss * dpr);
      const pxUnitaDev = pxUnita * dpr;
      p = Math.max(2, Math.round(2.5 * pxUnitaDev / ALTEZZA_EROE_PX));
      unita = p / pxUnitaDev;
      // misure pari: i bordi dei pixel cadono sui multipli del lato del pixel (serve agli sprite disegnati a pixel)
      W = Math.ceil(wDev / p) + 2; H = Math.ceil(hDev / p) + 2; W += W % 2; H += H % 2;
      rt.setSize(W, H);
      u.uP.value = p; u.uMisura.value.set(W, H);
      cam.left = -W * unita / 2; cam.right = W * unita / 2; cam.top = H * unita / 2; cam.bottom = -H * unita / 2;
      cam.updateProjectionMatrix();
    },
    // il punto che la camera guarda, agganciato alla griglia dei pixel (lungo destra e su dello schermo)
    aggancia(v) {
      const a = v.dot(DESTRA), b = v.dot(SU);
      const a2 = Math.round(a / unita) * unita, b2 = Math.round(b / unita) * unita;
      resto.set(a - a2, b - b2);
      return v.clone().addScaledVector(DESTRA, a2 - a).addScaledVector(SU, b2 - b);
    },
    // un punto del mondo portato sulla griglia dei pixel (lungo destra e su dello schermo): uno sprite a pixel messo
    // lì ha ogni suo pixel su un pixel dello schermo
    agganciaPunto(x, y, z) {
      const v = new THREE.Vector3(x, y, z), a = v.dot(DESTRA), b = v.dot(SU);
      return v.addScaledVector(DESTRA, Math.round(a / unita) * unita - a).addScaledVector(SU, Math.round(b / unita) * unita - b);
    },
    disegna(scena, cam) {
      renderer.setRenderTarget(rt);
      renderer.render(scena, cam);
      renderer.setRenderTarget(null);
      // il centro dell'immagine piccola cade al centro dello schermo, più il resto sotto il pixel
      const pxUnitaDev = p / unita;
      u.uSposta.value.set((W * p - wDev) / 2 + resto.x * pxUnitaDev, (H * p - hDev) / 2 + resto.y * pxUnitaDev);
      renderer.render(scenaQuadro, camQuadro);
    },
    unita: () => unita,
    p: () => p,
  };
}
