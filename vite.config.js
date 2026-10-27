// In sviluppo il gioco può salvare le sue foto in concept/foto/ (POST /__foto?nome=…): servono per il confronto col riferimento.
import { writeFileSync, mkdirSync } from 'node:fs';
const foto = {
  name: 'foto',
  configureServer(server) {
    server.middlewares.use('/__foto', (req, res) => {
      const nome = new URL(req.url, 'http://x').searchParams.get('nome').replace(/[^\w-]/g, '');
      const pezzi = [];
      req.on('data', (c) => pezzi.push(c));
      req.on('end', () => {
        mkdirSync('concept/foto', { recursive: true });
        const b64 = Buffer.concat(pezzi).toString().replace(/^data:image\/png;base64,/, '');
        writeFileSync(`concept/foto/${nome}.png`, Buffer.from(b64, 'base64'));
        res.end('ok');
      });
    });
  },
};
export default { base: './', build: { target: 'esnext', assetsInlineLimit: 0 }, plugins: [foto] };
