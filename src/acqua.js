// Il mare del riferimento «nero 1»: blu ardesia smorzato, pennellate più chiare e più scure a bordo netto che scivolano
// piano, trattini chiari delle onde, riflessi caldi del sole basso (rombi pesca, più fitti verso destra, cioè verso il
// sole) e la schiuma crema a righe attorno a riva, molo e scogli. Tutto dentro la scena, con la stessa foschia lilla.
import * as THREE from 'three';
import { FOSCHIA, GLSL_FOSCHIA } from './atmosfera.js';

// quanto è vicina la terra, punto per punto: 1 sulla riva, 0 al largo (8 campioni per unità, sfumato)
function telaRiva(g, scogli) {
  const M = 8, N = g.n, L = N * M;
  const c = document.createElement('canvas'); c.width = c.height = L;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, L, L);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = z * N + x;
    if (g.sup[k] === 'legno' && g.livello[k] === 0) ctx.fillStyle = '#9a9a9a'; // il molo sui pali: schiuma più sottile
    else if (g.livello[k] > 0) ctx.fillStyle = '#fff';
    else continue;
    ctx.fillRect(x * M, z * M, M, M);
  }
  ctx.fillStyle = '#fff';
  for (const [x0, z0, x1, z1] of scogli) {
    ctx.beginPath(); ctx.ellipse((x0 + x1) / 2 * M, (z0 + z1) / 2 * M, (x1 - x0) / 2 * M, (z1 - z0) / 2 * M, 0, 0, 7); ctx.fill();
  }
  // sfocatura a scatola ripetuta sul canale rosso (≈ gaussiana): diventa una distanza morbida dalla terra
  const img = ctx.getImageData(0, 0, L, L), d = img.data;
  let a = new Float32Array(L * L), b = new Float32Array(L * L);
  for (let p = 0; p < L * L; p++) a[p] = d[p * 4] / 255;
  const r = 4;
  for (let giro = 0; giro < 3; giro++) {
    for (let y = 0; y < L; y++) { let s = 0; for (let x = -r; x < L + r; x++) { const xi = x + r, xo = x - r - 1; if (xi < L) s += a[y * L + xi] ?? 0; if (xo >= 0) s -= a[y * L + xo]; if (x >= 0 && x < L) b[y * L + x] = s / (2 * r + 1); } }
    for (let x = 0; x < L; x++) { let s = 0; for (let y = -r; y < L + r; y++) { const yi = y + r, yo = y - r - 1; if (yi < L) s += b[yi * L + x]; if (yo >= 0) s -= b[yo * L + x]; if (y >= 0 && y < L) a[y * L + x] = s / (2 * r + 1); } }
  }
  for (let p = 0; p < L * L; p++) { const v = Math.min(255, a[p] * 255 * 1.6); d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = v; d[p * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function creaMare(g, scogli = []) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTempo: { value: 0 }, uRiva: { value: telaRiva(g, scogli) }, uLato: { value: g.n },
      uBase: { value: new THREE.Color('#4e6880') }, uChiaro: { value: new THREE.Color('#617d96') }, uScuro: { value: new THREE.Color('#435a71') },
      uTratto: { value: new THREE.Color('#8193a8') }, uSchiuma: { value: new THREE.Color('#e3cfc2') }, uRiflesso: { value: new THREE.Color('#e3a072') },
      ...FOSCHIA,
    },
    vertexShader: /* glsl */`
      varying vec3 vMondo;
      void main() { vec4 m = modelMatrix * vec4(position, 1.0); vMondo = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`,
    fragmentShader: /* glsl */`
      uniform float uTempo, uLato; uniform sampler2D uRiva;
      uniform vec3 uBase, uChiaro, uScuro, uTratto, uSchiuma, uRiflesso;
      varying vec3 vMondo;
      ${GLSL_FOSCHIA}
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 xz = vMondo.xz;
        // coordinate di schermo (destra, giù): le pennellate sono larghe e basse come nel riferimento
        vec2 s = vec2(xz.x - xz.y, (xz.x + xz.y) * 0.5) * 0.7071;
        // pennellate allungate in orizzontale (sullo schermo), come le onde del riferimento
        vec2 q = vec2(s.x / 7.0, s.y / 2.2) + vec2(uTempo * 0.02, uTempo * 0.007);
        float v = n(q) * 0.6 + n(q * 2.3 + 3.7) * 0.3 + n(q * 5.1 - uTempo * 0.03) * 0.1;
        float w = n(vec2(s.x / 4.0, s.y / 1.1) - vec2(uTempo * 0.015, 0.0) + 9.1);
        vec3 c = uBase;
        c = mix(c, uChiaro, step(0.64, v));
        c = mix(c, uScuro, step(0.72, w) * step(v, 0.5));
        // trattini chiari delle onde: corti, orizzontali sullo schermo, a celle sfalsate
        vec2 cel = vec2(s.x / 1.6 + uTempo * 0.05, s.y / 0.55);
        vec2 ic = floor(cel), fc = fract(cel);
        float r = h(ic);
        float dx = abs(fc.x - 0.5 - (r - 0.5) * 0.4), dy = abs(fc.y - 0.5 + sin(fc.x * 6.28) * 0.08);
        float lampo = 0.5 + 0.5 * sin(uTempo * 1.3 + r * 40.0);
        c = mix(c, uTratto, step(r, 0.16) * step(dx, 0.28) * step(dy, 0.07) * step(0.25, lampo));
        // riflessi del sole basso: rombi pesca sulla griglia del mondo, più fitti verso destra (il sole)
        // a gruppi lungo la scia del sole: rombi della griglia del mondo dove una macchia lenta è accesa
        float lato = dot(vMondo - uCentro, uDestra);
        float scia = smoothstep(2.0, 16.0, lato) * smoothstep(0.45, 0.7, n(s / 6.0 + vec2(0.0, uTempo * 0.01)));
        vec2 rc = xz * 1.4; vec2 ir = floor(rc);
        float rr = h(ir + 17.0);
        float acceso = step(0.45, 0.5 + 0.5 * sin(uTempo * (0.5 + rr) + rr * 30.0));
        vec2 fr = abs(fract(rc) - 0.5);
        c = mix(c, uRiflesso, step(rr, scia * 0.55) * acceso * step(fr.x + fr.y, 0.4));
        // schiuma: una riga crema stretta sulla riva e un'onda che va e viene poco più in là
        vec2 uv = xz / uLato;
        float riva = texture2D(uRiva, uv).r;
        float mosso = n(xz * 1.7 + uTempo * 0.25) * 0.12;
        float r1 = riva + mosso;
        c = mix(c, uSchiuma, step(0.66, r1));
        float onda = 0.42 + 0.06 * sin(uTempo * 0.9);
        c = mix(c, uSchiuma, step(abs(r1 - onda), 0.022) * 0.85);
        gl_FragColor = vec4(foschia(c, vMondo), 1.0);
      }`,
  });
  const mare = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), mat);
  mare.position.set(28, 0, 28);
  return { mesh: mare, passo: (t) => { mat.uniforms.uTempo.value = t; } };
}
