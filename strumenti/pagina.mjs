// Dopo `vite build`: da dist/index.html ricava dist/pagina.html per l'Artifact
// (senza doctype/html/head/body, che l'Artifact aggiunge da solo) e stampa la mappa dei file da pubblicare.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');
const prendi = (re) => (html.match(re) || [, ''])[1];
const titolo = prendi(/(<title>[\s\S]*?<\/title>)/);
const stile = prendi(/(<style>[\s\S]*?<\/style>)/);
const script = prendi(/(<script type="module"[^>]*><\/script>)/).replace(' crossorigin', '');
const corpo = prendi(/<body>([\s\S]*?)<\/body>/).replace(/<script[\s\S]*?<\/script>/g, '').trim();
writeFileSync(new URL('pagina.html', dist), `${titolo}\n${stile}\n${corpo}\n${script}\n`);
const file = {};
for (const d of ['assets', 'sprite']) for (const f of readdirSync(new URL(d + '/', dist))) file[`${d}/${f}`] = `dist/${d}/${f}`;
console.log(JSON.stringify(file));
