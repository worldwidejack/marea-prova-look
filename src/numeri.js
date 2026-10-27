// Il contatore nella pagina (prova dei look): fps, draw call e triangoli del fotogramma, per provare sul telefono di Jack.
// Le draw call si contano a mano (renderer.info.autoReset spento) perché il look pixel disegna due volte per fotogramma.
export function creaNumeri(renderer) {
  const div = document.createElement('div');
  div.id = 'numeri';
  document.body.appendChild(div);
  renderer.info.autoReset = false;
  let n = 0, t0 = performance.now(), fps = 0, ultimo = { calls: 0, triangles: 0 };
  return {
    // da chiamare a fine fotogramma
    conta() {
      ultimo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      renderer.info.reset();
      n++;
      const t = performance.now();
      if (t - t0 >= 500) {
        fps = Math.round(n * 1000 / (t - t0)); n = 0; t0 = t;
        div.textContent = `${fps} fps · ${ultimo.calls} draw · ${Math.round(ultimo.triangles / 1000)}k tri`;
      }
    },
    leggi() {
      const kb = performance.getEntriesByType('resource').reduce((s, r) => s + (r.encodedBodySize || 0), 0) / 1024;
      return { fps, draw: ultimo.calls, triangoli: ultimo.triangles, kbScaricati: Math.round(kb), memoria: { ...renderer.info.memory } };
    },
  };
}
