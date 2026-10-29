process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { handleApiRequest } = require('../db/api');
const { pool } = require('../db/connection');

let server;
let baseUrl;
let mockMpServer;
let mockMpUrl;
let currentMockPayment = null;

const FAKE_WEBHOOK_SECRET = 'fake_webhook_secret_key_1234567890abcdef';
const FAKE_ACCESS_TOKEN = 'TEST-1234567890-fake-access-token';

// Base de datos simulada en memoria para pruebas de webhook y órdenes
const originalPoolQuery = pool.query;
const mockDb = {
    orders: [
        {
            id: 1,
            order_number: 'NT-100001-111',
            token: 'valid_order_token_aaa111bbb222ccc333',
            customer_name: 'Cliente Seguro',
            customer_email: 'cliente@test.com',
            subtotal: 5000.00,
            discount_amount: 0.00,
            discount_label: 'Precio regular',
            total_amount: 5000.00,
            payment_status: 'pending',
            mercadopago_preference_id: 'pref_111222'
        },
        {
            id: 2,
            order_number: 'NT-100002-222',
            token: 'other_order_token_xxx999yyy888zzz777',
            customer_name: 'Otro Cliente',
            customer_email: 'otro@test.com',
            subtotal: 10000.00,
            discount_amount: 2500.00,
            discount_label: 'Pack 10 Fotos',
            total_amount: 7500.00,
            payment_status: 'pending',
            mercadopago_preference_id: 'pref_333444'
        }
    ],
    orderItems: [
        { id: 1, order_id: 1, photo_id: 101, price: 5000.00 }
    ],
    photos: [
        { id: 101, album_id: 1, filename: 'original_101.jpg', url: 'https://example.com/original_101.jpg' }
    ]
};

// Generador de firmas x-signature según especificación de Mercado Pago
// Formato: ts={ts},v1={hmac_sha256(manifest, secret)}
// Manifest: id:{data.id};request-id:{x-request-id};ts:{ts};
function generateMpSignature({ dataId, requestId, secret, timestamp }) {
    const ts = timestamp !== undefined ? timestamp : Math.floor(Date.now() / 1000);
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return {
        header: `ts=${ts},v1=${v1}`,
        ts,
        v1,
        manifest
    };
}

test.before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = FAKE_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_ACCESS_TOKEN = FAKE_ACCESS_TOKEN;

    // Servidor Mock de la API de Mercado Pago
    mockMpServer = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/v1/payments/')) {
            const auth = req.headers['authorization'];
            if (!auth || !auth.includes(FAKE_ACCESS_TOKEN)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Unauthorized' }));
                return;
            }

            if (currentMockPayment) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(currentMockPayment));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Payment not found' }));
            }
            return;
        }

        res.writeHead(404);
        res.end();
    });

    await new Promise(resolve => mockMpServer.listen(0, resolve));
    mockMpUrl = `http://127.0.0.1:${mockMpServer.address().port}`;
    process.env.MERCADOPAGO_API_URL = mockMpUrl;

    // Base de datos simulada en memoria
    pool.query = async (sql, params = []) => {
        const lowerSql = sql.toLowerCase();

        // SELECT orders WHERE order_number = ? OR token = ? (o token = ?)
        if (lowerSql.includes('from orders')) {
            const ident = params[0];
            const order = mockDb.orders.find(o => o.order_number === ident || o.token === ident);
            return [order ? [order] : []];
        }

        // UPDATE orders SET payment_status = 'approved'
        if (lowerSql.includes("update orders set payment_status = 'approved'")) {
            // WHERE id = ? AND payment_status = 'pending'
            let targetId = params[0];
            const order = mockDb.orders.find(o => o.id === targetId || o.token === targetId || o.order_number === targetId);
            if (!order) {
                return [{ affectedRows: 0 }];
            }

            // Solo actualizar si está pendiente (idempotencia)
            if (lowerSql.includes("payment_status = 'pending'") && order.payment_status !== 'pending') {
                return [{ affectedRows: 0 }];
            }

            order.payment_status = 'approved';
            return [{ affectedRows: 1 }];
        }

        // SELECT items / photos para órdenes o descargas
        if (lowerSql.includes('from order_items')) {
            const orderId = params[0];
            const photoId = params[1];
            if (photoId !== undefined) {
                const item = mockDb.orderItems.find(oi => oi.order_id === orderId && oi.photo_id === photoId);
                if (item) {
                    const photo = mockDb.photos.find(p => p.id === photoId);
                    return [[{ ...item, url: photo.url, filename: photo.filename }]];
                }
                return [[]];
            } else {
                const items = mockDb.orderItems
                    .filter(oi => oi.order_id === orderId)
                    .map(item => {
                        const photo = mockDb.photos.find(p => p.id === item.photo_id);
                        return { ...item, url: photo ? photo.url : '', filename: photo ? photo.filename : '' };
                    });
                return [items];
            }
        }

        return [[]];
    };

    // Servidor de la aplicación
    server = http.createServer(async (req, res) => {
        try {
            const handled = await handleApiRequest(req, res);
            if (!handled) {
                res.writeHead(404);
                res.end();
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });

    await new Promise(resolve => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    pool.query = originalPoolQuery;
    delete process.env.MERCADOPAGO_API_URL;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => mockMpServer.close(resolve));
});

test.beforeEach(() => {
    // Resetear estados de órdenes mock
    mockDb.orders[0].payment_status = 'pending';
    mockDb.orders[1].payment_status = 'pending';
    currentMockPayment = null;
});

// =========================================================================
// CASO 1: Petición sin firma (sin x-signature ni x-request-id)
// =========================================================================
test('SEC-01 Webhook: Rechaza peticiones sin x-signature con 401', async () => {
    const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=99901&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'payment.created', data: { id: '99901' }, type: 'payment' })
    });

    assert.equal(res.status, 401, 'Debe devolver 401 Unauthorized cuando falta la firma');
    assert.equal(mockDb.orders[0].payment_status, 'pending', 'La orden debe permanecer en pending');
});

// =========================================================================
// CASO 2: Firma con hash inválido (HMAC alterado o secreto incorrecto)
// =========================================================================
test('SEC-01 Webhook: Rechaza firma inválida / alterada con 401', async () => {
    const requestId = crypto.randomUUID();
    const badSignature = 'ts=1704908010,v1=0000000000000000000000000000000000000000000000000000000000000000';

    const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=99902&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': badSignature
        },
        body: JSON.stringify({ action: 'payment.created', data: { id: '99902' }, type: 'payment' })
    });

    assert.equal(res.status, 401, 'Debe devolver 401 al recibir hash HMAC incorrecto');
    assert.equal(mockDb.orders[0].payment_status, 'pending', 'La orden debe permanecer en pending');
});

// =========================================================================
// CASO 3: Firma vieja (Ataque de repetición fuera de la ventana de tolerancia)
// =========================================================================
test('SEC-01 Webhook: Rechaza firmas con timestamp viejo (> 5 minutos) con 401', async () => {
    const dataId = '99903';
    const requestId = crypto.randomUUID();
    // Timestamp de hace 10 minutos (600 segundos atrás)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const { header } = generateMpSignature({
        dataId,
        requestId,
        secret: FAKE_WEBHOOK_SECRET,
        timestamp: oldTimestamp
    });

    const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=${dataId}&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': header
        },
        body: JSON.stringify({ action: 'payment.created', data: { id: dataId }, type: 'payment' })
    });

    assert.equal(res.status, 401, 'Debe devolver 401 por timestamp fuera de tolerancia');
    assert.equal(mockDb.orders[0].payment_status, 'pending', 'La orden debe permanecer en pending');
});

// =========================================================================
// CASO 4: Monto menor al de la orden (Intento de pagar de menos)
// =========================================================================
test('SEC-01 Webhook: Rechaza si el monto pagado en MP es menor al total de la orden', async () => {
    const dataId = '99904';
    const requestId = crypto.randomUUID();
    const { header } = generateMpSignature({
        dataId,
        requestId,
        secret: FAKE_WEBHOOK_SECRET
    });

    // En MP pagaron $1000, pero la orden vale $5000
    currentMockPayment = {
        id: Number(dataId),
        status: 'approved',
        status_detail: 'accredited',
        currency_id: 'ARS',
        transaction_amount: 1000.00,
        external_reference: mockDb.orders[0].order_number
    };

    const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=${dataId}&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': header
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId }, type: 'payment' })
    });

    assert.ok(res.status >= 400, 'Debe responder con error al recibir monto discrepante');
    assert.equal(mockDb.orders[0].payment_status, 'pending', 'La orden debe permanecer en pending');
});

// =========================================================================
// CASO 5: Moneda distinta (ej. USD en vez de ARS)
// =========================================================================
test('SEC-01 Webhook: Rechaza si la moneda en MP es diferente de ARS', async () => {
    const dataId = '99905';
    const requestId = crypto.randomUUID();
    const { header } = generateMpSignature({
        dataId,
        requestId,
        secret: FAKE_WEBHOOK_SECRET
    });

    currentMockPayment = {
        id: Number(dataId),
        status: 'approved',
        status_detail: 'accredited',
        currency_id: 'USD',
        transaction_amount: 5000.00,
        external_reference: mockDb.orders[0].order_number
    };

    const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=${dataId}&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': header
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId }, type: 'payment' })
    });

    assert.ok(res.status >= 400, 'Debe responder con error al recibir moneda discrepante');
    assert.equal(mockDb.orders[0].payment_status, 'pending', 'La orden debe permanecer en pending');
});

// =========================================================================
// CASO 6: Pago no aprobado en MP (ej. status='rejected' o 'pending')
// =========================================================================
test('SEC-01 Webhook: No aprueba la orden si el estado del pago en MP no es approved', async () => {
    const dataId = '99906';
    const requestId = crypto.randomUUID();
    const { header } = generateMpSignature({
        dataId,
        requestId,
        secret: FAKE_WEBHOOK_SECRET
    });

    currentMockPayment = {
        id: Number(dataId),
        status: 'rejected',
        status_detail: 'cc_rejected_other_reason',
        currency_id: 'ARS',
        transaction_amount: 5000.00,
        external_reference: mockDb.orders[0].order_number
    };

    const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=${dataId}&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': header
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId }, type: 'payment' })
    });

    assert.equal(mockDb.orders[0].payment_status, 'pending', 'La orden no debe aprobarse si el pago está rechazado');
});

// =========================================================================
// CASO 7: external_reference apunta a otra orden o token inexistente
// =========================================================================
test('SEC-01 Webhook: Rechaza si el external_reference de MP no existe o no coincide', async () => {
    const dataId = '99907';
    const requestId = crypto.randomUUID();
    const { header } = generateMpSignature({
        dataId,
        requestId,
        secret: FAKE_WEBHOOK_SECRET
    });

    currentMockPayment = {
        id: Number(dataId),
        status: 'approved',
        status_detail: 'accredited',
        currency_id: 'ARS',
        transaction_amount: 5000.00,
        external_reference: 'NT-999999-999'
    };

    const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=${dataId}&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': header
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId }, type: 'payment' })
    });

    assert.ok(res.status >= 400, 'Debe responder con error al recibir external_reference inexistente');
    assert.equal(mockDb.orders[0].payment_status, 'pending');
    assert.equal(mockDb.orders[1].payment_status, 'pending');
});

// =========================================================================
// CASO 8: Evento legítimo y repetición idempotente con order_number como external_reference
// =========================================================================
test('SEC-01 Webhook: Aprueba orden válidamente y es idempotente ante eventos repetidos', async () => {
    const dataId = '99908';
    const requestId = crypto.randomUUID();
    const { header } = generateMpSignature({
        dataId,
        requestId,
        secret: FAKE_WEBHOOK_SECRET
    });

    currentMockPayment = {
        id: Number(dataId),
        status: 'approved',
        status_detail: 'accredited',
        currency_id: 'ARS',
        transaction_amount: 5000.00,
        external_reference: mockDb.orders[0].order_number
    };

    // 1. Primera notificación: debe aprobar la orden
    const res1 = await fetch(`${baseUrl}/api/checkout/webhook?data.id=${dataId}&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': header
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId }, type: 'payment' })
    });

    assert.equal(res1.status, 200, 'Primera notificación debe responder 200 OK');
    assert.equal(mockDb.orders[0].payment_status, 'approved', 'La orden debe quedar aprobada en BD');

    // 2. Segunda notificación idéntica (reintento legítimo de webhook de Mercado Pago)
    const res2 = await fetch(`${baseUrl}/api/checkout/webhook?data.id=${dataId}&type=payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-signature': header
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId }, type: 'payment' })
    });

    assert.equal(res2.status, 200, 'Segunda notificación debe responder 200 OK sin fallar');
    assert.equal(mockDb.orders[0].payment_status, 'approved', 'La orden permanece aprobada sin efectos secundarios');
});

// =========================================================================
// CASO 9: Eliminación total de aprobación por token en URL
// =========================================================================
test('SEC-01 Webhook: Elimina aprobación por token en URL (?token=...) sin firma válida', async () => {
    const orderToken = mockDb.orders[0].token;

    // Intentar auto-aprobar vía URL query token
    const res = await fetch(`${baseUrl}/api/checkout/webhook?token=${orderToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'payment' })
    });

    assert.equal(res.status, 401, 'Debe rechazar con 401 cualquier intento de aprobación sin firma');
    assert.equal(mockDb.orders[0].payment_status, 'pending', 'La orden NO debe haber sido aprobada');
});

// =========================================================================
// CASO 10: Descargas bloqueadas si el pago no está aprobado
// =========================================================================
test('SEC-01 Descargas: Bloquea descarga de fotos originales si el pago no está aprobado', async () => {
    const orderToken = mockDb.orders[0].token;
    assert.equal(mockDb.orders[0].payment_status, 'pending', 'Orden inicia en pending');

    // 1. Intento de descarga mientras está pending -> debe ser rechazado (402 o 403)
    const pendingRes = await fetch(`${baseUrl}/api/downloads/${orderToken}/101`);
    assert.ok(pendingRes.status === 402 || pendingRes.status === 403, `Descarga debe ser rechazada con 402 o 403, respondió ${pendingRes.status}`);

    // 2. Cambiar a approved (simulando pago confirmado) -> debe permitir la descarga (200 o 302 a URL)
    mockDb.orders[0].payment_status = 'approved';
    const approvedRes = await fetch(`${baseUrl}/api/downloads/${orderToken}/101`, { redirect: 'manual' });
    assert.ok(approvedRes.status === 200 || approvedRes.status === 302, `Descarga aprobada debe permitir acceso, respondió ${approvedRes.status}`);
});

// =========================================================================
// CASO 11: Falla cerrada si MERCADOPAGO_WEBHOOK_SECRET no está configurado
// =========================================================================
test('SEC-01 Webhook: Falla cerrada - rechaza con 500 toda petición si el secreto no está configurado', async () => {
    const origSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

    try {
        const res = await fetch(`${baseUrl}/api/checkout/webhook?data.id=99911&type=payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: 'payment' })
        });

        assert.equal(res.status, 500, 'Debe devolver 500 rechazando la petición cuando falta el secret');
        const json = await res.json();
        assert.equal(json.ok, false);
    } finally {
        process.env.MERCADOPAGO_WEBHOOK_SECRET = origSecret;
    }
});

// =========================================================================
// CASO 12: Ocultamiento del token de descarga hasta que la orden esté aprobada
// =========================================================================
test('SEC-01 Órdenes: Oculta el token de descarga en pending y solo lo revela en approved', async () => {
    // 1. Estado pending: token debe ser estrictamente null
    mockDb.orders[0].payment_status = 'pending';
    const resPending = await fetch(`${baseUrl}/api/orders/${mockDb.orders[0].order_number}`);
    assert.equal(resPending.status, 200);
    const bodyPending = await resPending.json();
    assert.equal(bodyPending.order.token, null, 'El token secreto debe ser null mientras el pago no esté aprobado');

    // 2. Estado approved: token de descarga legítimo es revelado al cliente
    mockDb.orders[0].payment_status = 'approved';
    const resApproved = await fetch(`${baseUrl}/api/orders/${mockDb.orders[0].order_number}`);
    assert.equal(resApproved.status, 200);
    const bodyApproved = await resApproved.json();
    assert.equal(bodyApproved.order.token, mockDb.orders[0].token, 'El token secreto debe entregarse al cliente cuando la orden esté aprobada');
});
