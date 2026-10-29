process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handleApiRequest, activeSessions } = require('../db/api');
const { pool } = require('../db/connection');

let server;
let baseUrl;

// Base de datos simulada en memoria para aislar 100% las pruebas de la base real
const originalPoolQuery = pool.query;
const mockDb = {
    albums: [
        { id: 1, slug: 'album-publico', title: 'Álbum Público', status: 'published', price: 4000, sort_order: 1 },
        { id: 2, slug: 'album-borrador', title: 'Álbum Borrador', status: 'draft', price: 4000, sort_order: 2 }
    ],
    photos: [
        { id: 1, album_id: 1, url: 'https://example.com/p1.jpg', sort_order: 1 },
        { id: 2, album_id: 2, url: 'https://example.com/p2.jpg', sort_order: 1 }
    ],
    executedQueries: []
};

test.before(async () => {
    // Interceptar cualquier query para asegurar que JAMÁS toque una base de datos real
    mockDb.executedQueries = [];
    pool.query = async (sql, params = []) => {
        mockDb.executedQueries.push({ sql, params });
        const lowerSql = sql.toLowerCase();

        // SELECT albums status
        if (lowerSql.includes('select status from albums where id = ?') || lowerSql.includes('from albums where id = ? limit 1')) {
            const id = Number(params[0]);
            const album = mockDb.albums.find(a => a.id === id);
            return [album ? [album] : []];
        }
        if (lowerSql.includes('from albums where slug = ? limit 1')) {
            const slug = params[0];
            const album = mockDb.albums.find(a => a.slug === slug);
            return [album ? [album] : []];
        }
        // SELECT photos
        if (lowerSql.includes('from photos where album_id = ?')) {
            const albumId = Number(params[0]);
            const photos = mockDb.photos.filter(p => p.album_id === albumId);
            return [photos];
        }
        // SELECT albums list
        if (lowerSql.includes('from albums a')) {
            if (lowerSql.includes("status = 'published'")) {
                return [mockDb.albums.filter(a => a.status === 'published')];
            }
            return [mockDb.albums];
        }
        return [[]];
    };

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
    pool.query = originalPoolQuery;
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

    const initialQueryCount = mockDb.executedQueries.length;

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

    // Aislamiento: ninguna consulta DELETE ni INSERT debió ejecutarse en base de datos
    const mutativeQueries = mockDb.executedQueries.slice(initialQueryCount).filter(q => {
        const s = q.sql.toLowerCase();
        return s.includes('delete') || s.includes('insert') || s.includes('update');
    });
    assert.equal(mutativeQueries.length, 0, 'Ninguna consulta mutativa debió enviarse a la base de datos sin autenticación');
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

test('SEC-02: GET /api/albums/:id/photos no debe exponer fotos de álbumes en borrador a usuarios anónimos', async () => {
    // Álbum 2 está en 'draft'
    const anonRes = await fetch(`${baseUrl}/api/albums/2/photos`);
    assert.equal(anonRes.status, 404, 'Usuario anónimo debe recibir 404 para fotos de álbum en borrador');

    // Álbum 1 está en 'published' -> anónimo puede ver fotos
    const pubRes = await fetch(`${baseUrl}/api/albums/1/photos`);
    assert.equal(pubRes.status, 200, 'Usuario anónimo puede ver fotos de álbum publicado');
    const pubData = await pubRes.json();
    assert.equal(pubData.ok, true);
    assert.equal(pubData.data.length, 1);

    // Con sesión de admin, sí puede ver fotos del álbum en borrador
    const adminToken = 'nt_sess_test_admin_token';
    activeSessions.set(adminToken, {
        token: adminToken,
        userId: 1,
        email: 'admin@example.com',
        role: 'admin',
        expiresAt: Date.now() + 60000
    });

    const adminRes = await fetch(`${baseUrl}/api/albums/2/photos`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(adminRes.status, 200, 'Administrador autenticado puede ver fotos de álbum en borrador');
    const adminData = await adminRes.json();
    assert.equal(adminData.ok, true);
    assert.equal(adminData.data.length, 1);

    activeSessions.delete(adminToken);
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
