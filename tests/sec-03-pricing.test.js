const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handleApiRequest } = require('../db/api');
const { pool } = require('../db/connection');

let server;
let baseUrl;

// Base de datos simulada en memoria para pruebas de precios
const originalPoolQuery = pool.query;
const mockDb = {
    albums: [
        { id: 1, slug: 'boda-ana-juan', title: 'Boda Ana y Juan', status: 'published', price: 5000.00 },
        { id: 2, slug: 'xv-sofia', title: 'XV Sofia (Borrador)', status: 'draft', price: 6000.00 },
        { id: 3, slug: 'album-chico', title: 'Álbum Chico (3 fotos)', status: 'published', price: 4000.00 }
    ],
    photos: [
        { id: 101, album_id: 1, filename: 'foto101.jpg', url: 'https://example.com/101.jpg' },
        { id: 102, album_id: 1, filename: 'foto102.jpg', url: 'https://example.com/102.jpg' },
        { id: 103, album_id: 1, filename: 'foto103.jpg', url: 'https://example.com/103.jpg' },
        { id: 104, album_id: 1, filename: 'foto104.jpg', url: 'https://example.com/104.jpg' },
        { id: 105, album_id: 1, filename: 'foto105.jpg', url: 'https://example.com/105.jpg' },
        { id: 106, album_id: 1, filename: 'foto106.jpg', url: 'https://example.com/106.jpg' },
        { id: 107, album_id: 1, filename: 'foto107.jpg', url: 'https://example.com/107.jpg' },
        { id: 201, album_id: 2, filename: 'foto201_draft.jpg', url: 'https://example.com/201.jpg' }, // En álbum borrador
        { id: 301, album_id: 3, filename: 'foto301.jpg', url: 'https://example.com/301.jpg' },
        { id: 302, album_id: 3, filename: 'foto302.jpg', url: 'https://example.com/302.jpg' },
        { id: 303, album_id: 3, filename: 'foto303.jpg', url: 'https://example.com/303.jpg' }
    ],
    orders: [],
    orderItems: []
};

test.before(async () => {
    process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
    process.env.NODE_ENV = 'test';

    pool.query = async (sql, params = []) => {
        const lowerSql = sql.toLowerCase();

        // Consulta de fotos y álbumes para cálculo autoritativo de precios
        if (lowerSql.includes('from photos p') && lowerSql.includes('join albums a')) {
            const requestedIds = params.map(Number);
            const rows = [];
            for (const id of requestedIds) {
                const photo = mockDb.photos.find(p => p.id === id);
                if (photo) {
                    const album = mockDb.albums.find(a => a.id === photo.album_id);
                    if (album) {
                        rows.push({
                            photo_id: photo.id,
                            album_id: album.id,
                            album_price: album.price,
                            album_status: album.status
                        });
                    }
                }
            }
            return [rows];
        }

        // Conteo de fotos en álbum para validación de álbum completo
        if (lowerSql.includes('select count(*) as total from photos where album_id = ?')) {
            const albumId = Number(params[0]);
            const total = mockDb.photos.filter(p => p.album_id === albumId).length;
            return [[{ total }]];
        }

        // Inserción en orders
        if (lowerSql.includes('insert into orders')) {
            const newId = mockDb.orders.length + 1;
            mockDb.orders.push({ id: newId, params });
            return [{ insertId: newId }];
        }

        // Actualización de mercadopago_preference_id
        if (lowerSql.includes('update orders set mercadopago_preference_id = ?')) {
            return [{ affectedRows: 1 }];
        }

        // Inserción en order_items
        if (lowerSql.includes('insert into order_items')) {
            mockDb.orderItems.push(params);
            return [{ insertId: mockDb.orderItems.length }];
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
    delete process.env.ALLOW_SIMULATED_PAYMENTS;
    if (server) server.close();
});

test('SEC-03: Precio manipulado por el cliente (0.50) es IGNORADO y se cobra el precio real de la BD', async () => {
    const payload = {
        customerName: 'Cliente Prueba',
        customerEmail: 'cliente@test.com',
        customerPhone: '+5491112345678',
        items: [
            { id: 101, price: 0.50 } // Intento de manipulación de precio
        ]
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.equal(res.status, 201, `Se esperaba 201 pero se recibió ${res.status}: ${JSON.stringify(data)}`);
    assert.equal(data.ok, true);

    // El precio real del álbum 1 en mockDb es 5000.00
    assert.equal(data.data.subtotal, 5000, 'El subtotal debe calcularse desde la base de datos (5000), no desde el cliente');
    assert.equal(data.data.totalAmount, 5000, 'El total debe ser 5000, ignorando los 0.50 del navegador');
});

test('SEC-03: Falla si se envían IDs de fotos inexistentes en la base de datos', async () => {
    const payload = {
        customerName: 'Cliente Prueba',
        customerEmail: 'cliente@test.com',
        items: [
            { id: 99999 } // ID que no existe
        ]
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Debe devolver 400 si la foto no existe');
    assert.equal(data.ok, false);
    assert.match(data.error || '', /no existe|inv[aá]lido|fotograf/i);
});

test('SEC-03: Falla si se intenta comprar una foto de un álbum en borrador (draft)', async () => {
    const payload = {
        customerName: 'Cliente Intruso',
        customerEmail: 'intruso@test.com',
        items: [
            { id: 201 } // Foto 201 pertenece a álbum 2 (draft)
        ]
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Debe devolver 400 si el álbum no está publicado');
    assert.equal(data.ok, false);
    assert.match(data.error || '', /publicad|disponible|borrador|colecci[oó]n/i);
});

test('SEC-03: Falla si se envían IDs de fotos duplicados', async () => {
    const payload = {
        customerName: 'Cliente Tramposo',
        customerEmail: 'trampa@test.com',
        items: [
            { id: 101 },
            { id: 101 } // Duplicado
        ]
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Debe devolver 400 si hay ítems duplicados');
    assert.equal(data.ok, false);
    assert.match(data.error || '', /duplicad/i);
});

test('SEC-03: Falla si la cantidad de fotos supera el límite permitido', async () => {
    const excessItems = [];
    for (let i = 0; i < 250; i++) {
        excessItems.push({ id: 1000 + i });
    }

    const payload = {
        customerName: 'Cliente Bulk',
        customerEmail: 'bulk@test.com',
        items: excessItems
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Debe devolver 400 si supera el límite de cantidad');
    assert.equal(data.ok, false);
    assert.match(data.error || '', /l[ií]mite|m[aá]ximo|cantidad/i);
});

test('SEC-03: Falla si los datos del cliente son inválidos (email mal formado o nombre vacío)', async () => {
    const badEmailPayload = {
        customerName: 'Cliente Real',
        customerEmail: 'no-es-un-email-valido',
        items: [{ id: 101 }]
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badEmailPayload)
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Debe devolver 400 para email inválido');
    assert.equal(data.ok, false);
    assert.match(data.error || '', /correo|email/i);
});

test('SEC-03: Cálculo de pack de descuentos por volumen en el servidor', async () => {
    // 5 fotos del álbum 1 (precio unitario: $5000 -> subtotal: $25000)
    // Descuento 5 fotos = 15% -> descuento: $3750 -> total: $21250
    const payload = {
        customerName: 'Cliente Pack',
        customerEmail: 'pack@test.com',
        items: [
            { id: 101 }, { id: 102 }, { id: 103 }, { id: 104 }, { id: 105 }
        ]
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.data.subtotal, 25000);
    assert.equal(data.data.discountAmount, 3750);
    assert.equal(data.data.totalAmount, 21250);
    assert.match(data.data.discountLabel, /15%/);
});

test('SEC-03: Detección segura de álbum completo en servidor (ignora isFullAlbum falso del cliente)', async () => {
    // Caso A: Cliente envía solo 1 foto y declara falsamente isFullAlbum: true
    const falseFullPayload = {
        customerName: 'Cliente Tramposo',
        customerEmail: 'tramposo@test.com',
        isFullAlbum: true,
        items: [{ id: 101 }] // Solo 1 foto de un álbum de 5
    };

    const resA = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(falseFullPayload)
    });
    const dataA = await resA.json();
    assert.equal(resA.status, 201);
    assert.equal(dataA.data.discountAmount, 0, 'No debe aplicar descuento de álbum completo si solo tiene 1 foto');
    assert.equal(dataA.data.discountLabel, 'Precio regular');

    // Caso B: Cliente compra las 3 fotos del álbum 3 (que tiene exactamente 3 fotos en total)
    // El servidor debe detectar automáticamente que es el álbum completo y aplicar 35%
    const trueFullPayload = {
        customerName: 'Comprador Álbum Completo',
        customerEmail: 'completo@test.com',
        items: [{ id: 301 }, { id: 302 }, { id: 303 }] // 3 de 3 fotos del álbum 3 ($4000 c/u = $12000)
    };

    const resB = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trueFullPayload)
    });
    const dataB = await resB.json();
    assert.equal(resB.status, 201);
    assert.equal(dataB.data.subtotal, 12000);
    assert.equal(dataB.data.discountAmount, 4200, 'Debe aplicar 35% de descuento por álbum completo detectado por el servidor');
    assert.equal(dataB.data.totalAmount, 7800);
    assert.match(dataB.data.discountLabel, /Colecci[oó]n Completa|35%/i);
});

test('SEC-03: Falla con 503 si la pasarela de pagos no está configurada y el modo simulado está deshabilitado', async () => {
    delete process.env.ALLOW_SIMULATED_PAYMENTS;
    const oldMpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;

    const payload = {
        customerName: 'Cliente Real',
        customerEmail: 'cliente@test.com',
        items: [{ id: 101 }]
    };

    const res = await fetch(`${baseUrl}/api/checkout/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.equal(res.status, 503, 'Debe responder 503 cuando la pasarela no está configurada');
    assert.equal(data.ok, false);
    assert.equal(data.code, 'PAYMENT_GATEWAY_UNAVAILABLE');

    // Restaurar flags para los demás tests
    process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
    if (oldMpToken) process.env.MERCADOPAGO_ACCESS_TOKEN = oldMpToken;
});
