// In sviluppo il gioco può salvare le sue foto in concept/foto/ (POST /__foto?nome=…): servono per il confronto col riferimento.
import { writeFileSync, mkdirSync } from 'node:fs';
const foto = {
  name: 'foto',
  configureServer(server) {
    server.middlewares.use('/__foto', (req, res) => {
      const q = new URL(req.url, 'http://x').searchParams;
      // nome con al massimo una sottocartella (video/f0001), jpg=1 per i fotogrammi dei video
      const nome = q.get('nome').replace(/[^\w/-]/g, '').replace(/\.\.+/g, '').split('/').slice(-2).join('/');
      const est = q.get('jpg') ? 'jpg' : 'png';
      const pezzi = [];
      req.on('data', (c) => pezzi.push(c));
      req.on('end', () => {
        mkdirSync(`concept/foto/${nome.includes('/') ? nome.split('/')[0] : ''}`, { recursive: true });
        const b64 = Buffer.concat(pezzi).toString().replace(/^data:image\/(png|jpeg);base64,/, '');
        writeFileSync(`concept/foto/${nome}.${est}`, Buffer.from(b64, 'base64'));
        res.end('ok');
      });
    });
  },
};
export default { base: './', build: { target: 'esnext', assetsInlineLimit: 0 }, plugins: [foto] };
