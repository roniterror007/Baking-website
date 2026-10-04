import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2] ?? '.sites-runtime/ivory-preview');
http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1:5174').pathname;
  const match = /^\/capture\/(\d{1,3})$/.exec(pathname);
  if (request.method === 'POST' && match) {
    try {
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 20 * 1024 * 1024) throw new Error('Frame body exceeds limit'); chunks.push(chunk); }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const index = Number(match[1]);
      if (!['dark','light'].includes(payload.theme) || index < 0 || index > 89 || !payload.dataUrl?.startsWith('data:image/png;base64,')) throw new Error('Invalid frame');
      const bytes = Buffer.from(payload.dataUrl.slice(22), 'base64');
      if (bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== 3840 || bytes.readUInt32BE(20) !== 2160) throw new Error('Invalid PNG dimensions');
      const captureRoot = path.join(root, 'renders', payload.theme);
      await fs.mkdir(captureRoot, {recursive:true});
      const basename = String(index).padStart(3,'0');
      await fs.writeFile(path.join(captureRoot, basename + '.png'), bytes);
      const {dataUrl, ...metadata} = payload;
      await fs.writeFile(path.join(captureRoot, basename + '.json'), JSON.stringify(metadata,null,2));
      response.writeHead(200, {'Content-Type':'application/json'}); response.end(JSON.stringify({saved:basename,theme:payload.theme,bytes:bytes.length}));
    } catch (error) { response.writeHead(400, {'Content-Type':'application/json'}); response.end(JSON.stringify({error:String(error)})); }
    return;
  }
  const resolved = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  try { const bytes = await fs.readFile(resolved); response.writeHead(200, {'Content-Type': resolved.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Cache-Control':'no-store'}); response.end(bytes); }
  catch { response.writeHead(404); response.end('Preview is being prepared.'); }
}).listen(5174, '127.0.0.1', () => console.log('Ivory preview: http://127.0.0.1:5174'));
