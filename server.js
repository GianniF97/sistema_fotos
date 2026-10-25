/**
 * Servidor HTTP local estático y seguro para Picsel / PixelFlow
 * Utiliza módulos nativos de Node.js (sin requerir dependencias externas)
 * para servir el frontend y permitir pruebas directas locales.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

let handleApiRequest = null;
let checkConnection = null;
try {
    const api = require('./db/api');
    handleApiRequest = api.handleApiRequest;
    const dbConn = require('./db/connection');
    checkConnection = dbConn.checkConnection;
} catch (e) {
    console.warn('[Server] Módulo db/api o db/connection no disponible:', e.message);
}

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');

    // Seguridad: Bloquear descargas directas de archivos .env o directorios ocultos
    if (safePath === '.env' || safePath.startsWith('.env') || safePath.startsWith('.git') || safePath.includes('/.') || safePath.includes('\\.')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 - Acceso Prohibido');
        return;
    }

    // Enrutador de API REST MariaDB (Álbumes, Fotos, Autenticación, Salud)
    if (req.url.startsWith('/api/')) {
        if (typeof handleApiRequest === 'function') {
            handleApiRequest(req, res).catch(err => {
                console.error('[API Server Error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
                res.end(JSON.stringify({ ok: false, error: 'Error interno en la API de MariaDB' }));
            });
            return;
        } else {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ ok: false, error: 'Módulo de base de datos no disponible' }));
            return;
        }
    }

    let filePath = path.join(PUBLIC_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Fallback to index.html for SPA routing
            filePath = path.join(PUBLIC_DIR, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 - Error Interno del Servidor');
                return;
            }

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(data);
        });
    });
});

server.listen(PORT, async () => {
    console.log(`[Picsel Server] Ejecutándose exitosamente en http://localhost:${PORT}`);
    console.log(`[Picsel Server] Carpeta pública: ${PUBLIC_DIR}`);

    if (typeof checkConnection === 'function') {
        const dbStatus = await checkConnection();
        if (dbStatus.ok) {
            console.log(`[MariaDB] ✔ Conectado exitosamente a '${dbStatus.database}' en ${dbStatus.host}`);
        } else {
            console.log(`[MariaDB] ⚠ No conectado (${dbStatus.error}). Operando con fallback offline.`);
        }
    }
});
