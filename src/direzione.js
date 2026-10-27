// Le 8 direzioni del protagonista dal movimento sullo schermo: 5 viste disegnate (S davanti, SE 3/4 davanti, E profilo,
// NE 3/4 dietro, N dietro) e le 3 di sinistra specchiate, come nel modello approvato.
const SETTORI = [['E', false], ['SE', false], ['S', false], ['SE', true], ['E', true], ['NE', true], ['N', false], ['NE', false]];

// dx, dy: verso sullo schermo (destra, giù)
export function direzione(dx, dy) {
  const a = Math.atan2(dy, dx); // 0 = destra, π/2 = giù
  const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  const [vista, specchio] = SETTORI[i];
  return { vista, specchio };
}
