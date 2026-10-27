// La luce del riferimento «nero 1»: pomeriggio tardi, sole basso da destra, foschia lilla verso il fondo.
// La foschia sta dentro la scena: ogni punto del mondo (terreno, mare, disegni) si mescola al lilla in base a quanto
// sta più lontano del personaggio, guardando dalla camera; verso il sole (a destra) il lilla tira al pesca.
// Le ombre non sono qui: sono cotte nel terreno (lilla) e disegnate nei disegni.
import * as THREE from 'three';
import { VERSO_CAMERA, DESTRA } from './camera.js';

export const FOSCHIA = {
  uCentro: { value: new THREE.Vector3() },
  uVerso: { value: VERSO_CAMERA },
  uDestra: { value: DESTRA },
  uLilla: { value: new THREE.Color('#9887b6') },
  uPesca: { value: new THREE.Color('#dca3a0') },
  uForza: { value: 0.68 },
};

export const GLSL_FOSCHIA = /* glsl */`
  uniform vec3 uCentro, uVerso, uDestra, uLilla, uPesca; uniform float uForza;
  vec3 foschia(vec3 c, vec3 p) {
    float dietro = dot(uCentro - p, uVerso);           // > 0: più lontano del personaggio
    float f = smoothstep(1.0, 22.0, dietro);
    float lato = dot(p - uCentro, uDestra);           // verso il sole
    vec3 tinta = mix(uLilla, uPesca, smoothstep(-4.0, 16.0, lato) * 0.75);
    return mix(c, tinta, f * uForza);
  }`;

// colore di fondo (si vede solo oltre il mare)
export const CIELO = '#8c84a8';
