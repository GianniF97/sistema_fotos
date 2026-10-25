const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handleApiRequest, activeSessions } = require('../db/api');

let server;
let baseUrl;

test.before(async () => {
    server = http.createServer(async (req, res) => {
        try {
            const handled = await handleApiRequest(req, res);
            if (!handled) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

test.after(() => {
    if (server) server.close();
});

test('SEC-02: Endpoints administrativos mutativos deben rechazar peticiones sin token con 401', async (t) => {
    const endpoints = [
        { method: 'POST', path: '/api/albums', body: { title: 'Test Album' } },
        { method: 'PUT', path: '/api/albums/1', body: { title: 'Updated Title' } },
        { method: 'DELETE', path: '/api/albums/1' },
        { method: 'POST', path: '/api/photos', body: { album_id: 1, url: 'https://example.com/test.jpg' } },
        { method: 'DELETE', path: '/api/photos/1' }
    ];

    for (const ep of endpoints) {
        await t.test(`${ep.method} ${ep.path} sin token devuelve 401`, async () => {
            const res = await fetch(`${baseUrl}${ep.path}`, {
                method: ep.method,
                headers: { 'Content-Type': 'application/json' },
                body: ep.body ? JSON.stringify(ep.body) : undefined
            });

            const data = await res.json().catch(() => ({}));
            assert.equal(res.status, 401, `Se esperaba 401 pero se recibió ${res.status} para ${ep.method} ${ep.path}`);
            assert.equal(data.ok, false);
            assert.match(data.error || '', /autorizado|sesi[oó]n|autenticaci[oó]n/i);
        });
    }
});

test('SEC-02: Peticiones con rol insuficiente (ej. viewer) deben devolver 403 Forbidden', async (t) => {
    const viewerToken = 'nt_sess_test_viewer_token';
    activeSessions.set(viewerToken, {
        token: viewerToken,
        userId: 999,
        email: 'viewer@example.com',
        role: 'viewer', // Rol insuficiente (no es admin)
        expiresAt: Date.now() + 60000
    });

    const endpoints = [
        { method: 'POST', path: '/api/albums', body: { title: 'Test Album' } },
        { method: 'PUT', path: '/api/albums/1', body: { title: 'Updated Title' } },
        { method: 'DELETE', path: '/api/albums/1' },
        { method: 'POST', path: '/api/photos', body: { album_id: 1, url: 'https://example.com/test.jpg' } },
        { method: 'DELETE', path: '/api/photos/1' }
    ];

    for (const ep of endpoints) {
        await t.test(`${ep.method} ${ep.path} con rol viewer devuelve 403`, async () => {
            const res = await fetch(`${baseUrl}${ep.path}`, {
                method: ep.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${viewerToken}`
                },
                body: ep.body ? JSON.stringify(ep.body) : undefined
            });

            const data = await res.json().catch(() => ({}));
            assert.equal(res.status, 403, `Se esperaba 403 pero se recibió ${res.status} para ${ep.method} ${ep.path}`);
            assert.equal(data.ok, false);
            assert.match(data.error || '', /permisos|denegado|insuficiente/i);
        });
    }

    activeSessions.delete(viewerToken);
});

test('SEC-02: Consulta de álbumes con drafts (?all=true) sin sesión devuelve 401', async () => {
    const res = await fetch(`${baseUrl}/api/albums?all=true`);
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.ok, false);
});

test('SEC-02: Endpoints /api/health y /api/db/status no deben filtrar información interna a usuarios anónimos', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();

    assert.equal(healthData.host, undefined, 'No debe revelar el host de la BD en health');
    assert.equal(healthData.database, undefined, 'No debe revelar el nombre de la BD en health');
    assert.equal(healthData.provider, undefined, 'No debe revelar el motor de BD en health');

    const statusRes = await fetch(`${baseUrl}/api/db/status`);
    const statusData = await statusRes.json();

    assert.equal(statusData.host, undefined, 'No debe revelar el host de la BD en status');
    assert.equal(statusData.database, undefined, 'No debe revelar el nombre de la BD en status');
    assert.equal(statusData.provider, undefined, 'No debe revelar el motor de BD a usuarios anónimos');
});
