/**
 * Enrutador de API REST para Nicolas Techeira Fotografías
 * Conecta el frontend con la base de datos MariaDB / MySQL.
 * Provee endpoints para álbumes, fotografías, autenticación y estado del sistema.
 */

const crypto = require('crypto');
const { pool, checkConnection, dbConfig } = require('./connection');
const { calculateOrderPricing, PRICING_CONFIG } = require('./pricing');

// Almacén de sesiones en memoria para administradores
const activeSessions = new Map();

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Limitar tamaño del body a 15MB para permitir carga de imágenes en base64
            if (body.length > 15 * 1024 * 1024) {
                reject(new Error('Payload demasiado grande'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', err => reject(err));
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function hashPassword(password, salt = 'nicolas_techeira_salt_2026') {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function generateSlug(text) {
    return (text || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'album-' + Date.now();
}

// Verificación opcional de sesión de administración
function verifyAdminSession(req) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const session = activeSessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return null;
    }
    return session;
}

// Verificación obligatoria de sesión de administración
function requireAdminAuth(req, res) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
        sendJson(res, 401, { ok: false, error: 'Autenticación requerida. Token no provisto.', code: 'UNAUTHORIZED' });
        return null;
    }
    const session = activeSessions.get(token);
    if (!session || Date.now() > session.expiresAt) {
        if (session) activeSessions.delete(token);
        sendJson(res, 401, { ok: false, error: 'Sesión inválida o expirada.', code: 'UNAUTHORIZED' });
        return null;
    }
    if (session.role !== 'admin') {
        sendJson(res, 403, { ok: false, error: 'Permisos insuficientes. Se requiere rol de administrador.', code: 'FORBIDDEN' });
        return null;
    }
    return session;
}

async function handleApiRequest(req, res) {
    const method = req.method.toUpperCase();
    const [pathPart, queryPart] = req.url.split('?');
    const query = new URLSearchParams(queryPart || '');

    // Manejo de preflight CORS
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return true;
    }

    // 1. Estado de la base de datos MariaDB / Salud del sistema
    if (pathPart === '/api/db/status' || pathPart === '/api/health') {
        const status = await checkConnection();
        const adminSession = verifyAdminSession(req);

        // Sin sesión de admin: respuesta genérica y segura que no filtra datos de infraestructura
        if (!adminSession || adminSession.role !== 'admin') {
            sendJson(res, status.ok ? 200 : 503, {
                ok: status.ok,
                status: status.ok ? 'healthy' : 'degraded',
                timestamp: new Date().toISOString()
            });
            return true;
        }

        // Con sesión de admin: información de diagnóstico completa
        sendJson(res, status.ok ? 200 : 503, {
            ...status,
            provider: 'mariadb',
            timestamp: new Date().toISOString()
        });
        return true;
    }

    // 2. Autenticación de Administrador (Login)
    if (pathPart === '/api/auth/login' && method === 'POST') {
        try {
            const { email, password } = await parseBody(req);
            if (!email || !password) {
                sendJson(res, 400, { ok: false, error: 'Debe ingresar correo y contraseña.' });
                return true;
            }

            const cleanEmail = email.trim().toLowerCase();
            const [users] = await pool.query(
                'SELECT id, email, name, password_hash, salt, role FROM admin_users WHERE email = ? LIMIT 1',
                [cleanEmail]
            );

            if (users.length === 0) {
                sendJson(res, 401, { ok: false, error: 'Credenciales inválidas.' });
                return true;
            }

            const user = users[0];
            const salt = user.salt || 'nicolas_techeira_salt_2026';
            const inputHash = hashPassword(password, salt);

            if (user.password_hash !== inputHash) {
                sendJson(res, 401, { ok: false, error: 'Contraseña incorrecta.' });
                return true;
            }

            const token = 'nt_sess_' + crypto.randomBytes(24).toString('hex');
            const sessionData = {
                token,
                userId: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                expiresAt: Date.now() + (24 * 60 * 60 * 1000)
            };
            activeSessions.set(token, sessionData);

            sendJson(res, 200, { ok: true, session: sessionData });
            return true;
        } catch (error) {
            console.error('[API Auth] Error en login:', error);
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 3. Verificación de sesión activa
    if (pathPart === '/api/auth/verify' && method === 'GET') {
        const session = verifyAdminSession(req);
        if (!session) {
            sendJson(res, 401, { ok: false, valid: false });
        } else {
            sendJson(res, 200, { ok: true, valid: true, user: session });
        }
        return true;
    }

    // 4. Cerrar sesión
    if (pathPart === '/api/auth/logout' && method === 'POST') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (token) activeSessions.delete(token);
        sendJson(res, 200, { ok: true });
        return true;
    }

    // 5. Colección de Álbumes (Listar)
    if (pathPart === '/api/albums' && method === 'GET') {
        try {
            const showAll = query.get('all') === '1' || query.get('all') === 'true';
            if (showAll) {
                const adminSession = verifyAdminSession(req);
                if (!adminSession || adminSession.role !== 'admin') {
                    sendJson(res, 401, { ok: false, error: 'Se requiere sesión de administrador para ver borradores.', code: 'UNAUTHORIZED' });
                    return true;
                }
            }
            const sql = `
                SELECT 
                    a.id, a.slug, a.title, a.category, a.photographer, 
                    a.event_date, a.description, a.price, a.status, 
                    a.sort_order, a.cover_url, a.created_at, a.updated_at,
                    COUNT(p.id) AS photo_count
                FROM albums a
                LEFT JOIN photos p ON a.id = p.album_id
                ${showAll ? '' : "WHERE a.status = 'published'"}
                GROUP BY a.id
                ORDER BY a.sort_order ASC, a.created_at DESC;
            `;
            const [rows] = await pool.query(sql);
            const albums = rows.map(r => ({
                ...r,
                date: r.event_date,
                photo_count: Number(r.photo_count || 0)
            }));
            sendJson(res, 200, { ok: true, data: albums });
            return true;
        } catch (error) {
            console.error('[API Albums] Error al obtener álbumes:', error);
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 6. Obtener un Álbum específico por ID o Slug (con sus fotos)
    const albumMatch = pathPart.match(/^\/api\/albums\/([^\/]+)$/);
    if (albumMatch && method === 'GET') {
        try {
            const param = albumMatch[1];
            const isNumeric = /^\d+$/.test(param);

            const [albumRows] = await pool.query(
                isNumeric 
                    ? 'SELECT * FROM albums WHERE id = ? LIMIT 1' 
                    : 'SELECT * FROM albums WHERE slug = ? LIMIT 1',
                [param]
            );

            if (albumRows.length === 0) {
                sendJson(res, 404, { ok: false, error: 'Álbum no encontrado.' });
                return true;
            }

            const album = albumRows[0];
            if (album.status !== 'published') {
                const adminSession = verifyAdminSession(req);
                if (!adminSession || adminSession.role !== 'admin') {
                    sendJson(res, 404, { ok: false, error: 'Álbum no encontrado.' });
                    return true;
                }
            }
            const [photoRows] = await pool.query(
                'SELECT * FROM photos WHERE album_id = ? ORDER BY sort_order ASC, id ASC',
                [album.id]
            );

            album.date = album.event_date;
            album.photos = photoRows;
            album.photo_count = photoRows.length;

            sendJson(res, 200, { ok: true, data: album });
            return true;
        } catch (error) {
            console.error('[API Album] Error al obtener álbum:', error);
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 7. Fotos de un Álbum específico
    const photosMatch = pathPart.match(/^\/api\/albums\/(\d+)\/photos$/);
    if (photosMatch && method === 'GET') {
        try {
            const albumId = parseInt(photosMatch[1], 10);

            // Validar existencia y visibilidad del álbum padre
            const [albumRows] = await pool.query('SELECT status FROM albums WHERE id = ? LIMIT 1', [albumId]);
            if (albumRows.length === 0) {
                sendJson(res, 404, { ok: false, error: 'Álbum no encontrado.' });
                return true;
            }

            if (albumRows[0].status !== 'published') {
                const adminSession = verifyAdminSession(req);
                if (!adminSession || adminSession.role !== 'admin') {
                    sendJson(res, 404, { ok: false, error: 'Álbum no encontrado.' });
                    return true;
                }
            }

            const [photos] = await pool.query(
                'SELECT * FROM photos WHERE album_id = ? ORDER BY sort_order ASC, id ASC',
                [albumId]
            );
            sendJson(res, 200, { ok: true, data: photos });
            return true;
        } catch (error) {
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 8. Crear Álbum
    if (pathPart === '/api/albums' && method === 'POST') {
        if (!requireAdminAuth(req, res)) return true;
        try {
            const payload = await parseBody(req);
            const title = (payload.title || '').trim();
            if (!title) {
                sendJson(res, 400, { ok: false, error: 'El título del álbum es obligatorio.' });
                return true;
            }

            const slug = generateSlug(payload.slug || title);
            const category = payload.category || 'Fiestas';
            const photographer = payload.photographer || 'Nicolas Techeira';
            const event_date = payload.event_date || payload.date || 'Reciente';
            const description = payload.description || '';
            const price = parseFloat(payload.price || 4000.00);
            const status = payload.status === 'published' ? 'published' : 'draft';
            const cover_url = payload.cover_url || payload.coverUrl || null;
            const sort_order = parseInt(payload.sort_order || payload.order || 1, 10);

            const [result] = await pool.query(
                `INSERT INTO albums 
                (slug, title, category, photographer, event_date, description, price, status, sort_order, cover_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [slug, title, category, photographer, event_date, description, price, status, sort_order, cover_url]
            );

            sendJson(res, 201, {
                ok: true,
                data: {
                    id: result.insertId,
                    slug,
                    title,
                    category,
                    photographer,
                    event_date,
                    date: event_date,
                    description,
                    price,
                    status,
                    sort_order,
                    cover_url
                }
            });
            return true;
        } catch (error) {
            console.error('[API Create Album] Error:', error);
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 9. Actualizar Álbum
    if (albumMatch && method === 'PUT') {
        if (!requireAdminAuth(req, res)) return true;
        try {
            const albumId = parseInt(albumMatch[1], 10);
            const payload = await parseBody(req);

            const [current] = await pool.query('SELECT * FROM albums WHERE id = ? LIMIT 1', [albumId]);
            if (current.length === 0) {
                sendJson(res, 404, { ok: false, error: 'Álbum no encontrado.' });
                return true;
            }

            const updatedTitle = payload.title !== undefined ? payload.title.trim() : current[0].title;
            const updatedSlug = payload.slug !== undefined ? generateSlug(payload.slug) : current[0].slug;
            const updatedCategory = payload.category !== undefined ? payload.category : current[0].category;
            const updatedPhotographer = payload.photographer !== undefined ? payload.photographer : current[0].photographer;
            const updatedEventDate = payload.event_date !== undefined ? payload.event_date : (payload.date || current[0].event_date);
            const updatedDescription = payload.description !== undefined ? payload.description : current[0].description;
            const updatedPrice = payload.price !== undefined ? parseFloat(payload.price) : current[0].price;
            const updatedStatus = payload.status !== undefined ? payload.status : current[0].status;
            const updatedCoverUrl = payload.cover_url !== undefined ? payload.cover_url : (payload.coverUrl || current[0].cover_url);
            const updatedSortOrder = payload.sort_order !== undefined ? parseInt(payload.sort_order, 10) : current[0].sort_order;

            await pool.query(
                `UPDATE albums SET
                    slug = ?, title = ?, category = ?, photographer = ?,
                    event_date = ?, description = ?, price = ?, status = ?,
                    sort_order = ?, cover_url = ?
                WHERE id = ?`,
                [
                    updatedSlug, updatedTitle, updatedCategory, updatedPhotographer,
                    updatedEventDate, updatedDescription, updatedPrice, updatedStatus,
                    updatedSortOrder, updatedCoverUrl, albumId
                ]
            );

            sendJson(res, 200, {
                ok: true,
                data: {
                    id: albumId,
                    slug: updatedSlug,
                    title: updatedTitle,
                    category: updatedCategory,
                    photographer: updatedPhotographer,
                    event_date: updatedEventDate,
                    date: updatedEventDate,
                    description: updatedDescription,
                    price: updatedPrice,
                    status: updatedStatus,
                    sort_order: updatedSortOrder,
                    cover_url: updatedCoverUrl
                }
            });
            return true;
        } catch (error) {
            console.error('[API Update Album] Error:', error);
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 10. Eliminar Álbum
    if (albumMatch && method === 'DELETE') {
        if (!requireAdminAuth(req, res)) return true;
        try {
            const albumId = parseInt(albumMatch[1], 10);
            await pool.query('DELETE FROM albums WHERE id = ?', [albumId]);
            sendJson(res, 200, { ok: true, deletedId: albumId });
            return true;
        } catch (error) {
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 11. Agregar Fotografía(s)
    if (pathPart === '/api/photos' && method === 'POST') {
        if (!requireAdminAuth(req, res)) return true;
        try {
            const payload = await parseBody(req);
            const album_id = parseInt(payload.album_id || payload.albumId, 10);
            const url = payload.url;
            const filename = payload.filename || 'foto.jpg';
            const alt_text = payload.alt_text || payload.title || '';
            const sort_order = parseInt(payload.sort_order || payload.order || 1, 10);

            if (!album_id || !url) {
                sendJson(res, 400, { ok: false, error: 'album_id y url son obligatorios.' });
                return true;
            }

            const [result] = await pool.query(
                `INSERT INTO photos (album_id, filename, url, alt_text, sort_order)
                 VALUES (?, ?, ?, ?, ?)`,
                [album_id, filename, url, alt_text, sort_order]
            );

            sendJson(res, 201, {
                ok: true,
                data: {
                    id: result.insertId,
                    album_id,
                    filename,
                    url,
                    alt_text,
                    sort_order
                }
            });
            return true;
        } catch (error) {
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 12. Eliminar Fotografía
    const photoMatch = pathPart.match(/^\/api\/photos\/(\d+)$/);
    if (photoMatch && method === 'DELETE') {
        if (!requireAdminAuth(req, res)) return true;
        try {
            const photoId = parseInt(photoMatch[1], 10);
            await pool.query('DELETE FROM photos WHERE id = ?', [photoId]);
            sendJson(res, 200, { ok: true, deletedId: photoId });
            return true;
        } catch (error) {
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 13. Checkout: Crear Preferencia de Pago / Orden (Mercado Pago + Offline)
    if (pathPart === '/api/checkout/preference' && method === 'POST') {
        try {
            const payload = await parseBody(req);
            const { items = [], customerName = '', customerEmail = '', customerPhone = '' } = payload;

            // 1. Validar datos del comprador
            const cleanName = (customerName || '').trim();
            const cleanEmail = (customerEmail || '').trim().toLowerCase();
            const cleanPhone = (customerPhone || '').trim();

            if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
                sendJson(res, 400, { ok: false, error: 'Nombre de cliente inválido (debe tener entre 2 y 100 caracteres).' });
                return true;
            }

            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!cleanEmail || cleanEmail.length > 120 || !emailRegex.test(cleanEmail)) {
                sendJson(res, 400, { ok: false, error: 'Correo electrónico de cliente inválido.' });
                return true;
            }

            if (cleanPhone && (cleanPhone.length > 30 || !/^[0-9+\s()-]+$/.test(cleanPhone))) {
                sendJson(res, 400, { ok: false, error: 'Número de teléfono inválido.' });
                return true;
            }

            // 2. Validar lista de ítems / fotos solicitadas
            if (!Array.isArray(items) || items.length === 0) {
                sendJson(res, 400, { ok: false, error: 'La selección de fotografías no puede estar vacía.' });
                return true;
            }

            const MAX_ITEMS_PER_ORDER = 200;
            if (items.length > MAX_ITEMS_PER_ORDER) {
                sendJson(res, 400, { ok: false, error: `La orden supera el límite máximo permitido de ${MAX_ITEMS_PER_ORDER} fotografías.` });
                return true;
            }

            // Extraer y validar IDs
            const photoIds = [];
            const seenIds = new Set();
            for (const it of items) {
                const id = parseInt(it && typeof it === 'object' ? it.id : it, 10);
                if (isNaN(id) || id <= 0) {
                    sendJson(res, 400, { ok: false, error: 'Identificador de fotografía inválido.' });
                    return true;
                }
                if (seenIds.has(id)) {
                    sendJson(res, 400, { ok: false, error: `Fotografía duplicada en la selección (ID: ${id}).` });
                    return true;
                }
                seenIds.add(id);
                photoIds.push(id);
            }

            // 3. Consultar precios y disponibilidad autoritativos en Base de Datos
            const placeholders = photoIds.map(() => '?').join(',');
            const [dbPhotos] = await pool.query(
                `SELECT p.id AS photo_id, p.album_id, a.price AS album_price, a.status AS album_status
                 FROM photos p
                 JOIN albums a ON p.album_id = a.id
                 WHERE p.id IN (${placeholders})`,
                photoIds
            );

            if (dbPhotos.length !== photoIds.length) {
                sendJson(res, 400, { ok: false, error: 'Una o más fotografías solicitadas no existen.' });
                return true;
            }

            // Mapear fotos por id y verificar que los álbumes estén publicados
            const photoMap = new Map();
            for (const p of dbPhotos) {
                if (p.album_status !== 'published') {
                    sendJson(res, 400, { ok: false, error: 'Una o más fotografías pertenecen a una colección no publicada o en borrador.' });
                    return true;
                }
                photoMap.set(p.photo_id, p);
            }

            // 4. Validar disponibilidad de pasarela de pago / modo simulado
            const hasMpToken = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
            const allowSimulated = process.env.ALLOW_SIMULATED_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';

            if (!hasMpToken && !allowSimulated) {
                sendJson(res, 503, {
                    ok: false,
                    error: 'Servicio de pagos temporalmente no disponible (pasarela de pagos no configurada).',
                    code: 'PAYMENT_GATEWAY_UNAVAILABLE'
                });
                return true;
            }

            // 5. Detección segura de álbum completo en servidor (nunca confiando en el cliente)
            let isFullAlbum = false;
            const uniqueAlbumIds = new Set(dbPhotos.map(p => p.album_id));
            if (uniqueAlbumIds.size === 1) {
                const singleAlbumId = Array.from(uniqueAlbumIds)[0];
                const [albumTotalRows] = await pool.query(
                    'SELECT COUNT(*) AS total FROM photos WHERE album_id = ?',
                    [singleAlbumId]
                );
                const totalInAlbum = Number(albumTotalRows[0]?.total || 0);
                if (totalInAlbum > 0 && photoIds.length >= totalInAlbum) {
                    isFullAlbum = true;
                }
            }

            // 6. Calcular totales y descuentos con el módulo de precios centralizado
            const verifiedItems = photoIds.map(id => {
                const photoInfo = photoMap.get(id);
                return {
                    id: photoInfo.photo_id,
                    albumId: photoInfo.album_id,
                    albumPrice: photoInfo.album_price,
                    price: Number(parseFloat(photoInfo.album_price).toFixed(2))
                };
            });

            const pricing = calculateOrderPricing(verifiedItems, isFullAlbum);
            const { subtotal, discountAmount, discountLabel, totalAmount, count } = pricing;

            // Generar identificadores únicos de orden y token seguro de descarga
            const orderNumber = `NT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
            const token = crypto.randomBytes(32).toString('hex');

            let orderId = Date.now();

            // Guardar en MySQL
            try {
                const [orderResult] = await pool.query(
                    `INSERT INTO orders 
                     (order_number, token, customer_name, customer_email, customer_phone, subtotal, discount_amount, discount_label, total_amount, payment_method, payment_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mercadopago', 'pending')`,
                    [orderNumber, token, cleanName, cleanEmail, cleanPhone, subtotal, discountAmount, discountLabel, totalAmount]
                );
                orderId = orderResult.insertId;

                for (const it of verifiedItems) {
                    await pool.query(
                        `INSERT INTO order_items (order_id, photo_id, album_id, price)
                         VALUES (?, ?, ?, ?)`,
                        [orderId, it.id, it.albumId, it.price]
                    );
                }
            } catch (dbErr) {
                console.warn('Advertencia DB al guardar orden:', dbErr.message);
            }

            // Mercado Pago Checkout Pro Integration
            let preferenceId = null;
            let initPoint = null;

            if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
                try {
                    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
                        },
                        body: JSON.stringify({
                            items: [
                                {
                                    id: orderNumber,
                                    title: `Fotografías Nicolas Techeira (${count} fotos - ${discountLabel})`,
                                    quantity: 1,
                                    currency_id: 'ARS',
                                    unit_price: totalAmount
                                }
                            ],
                            payer: {
                                name: cleanName,
                                email: cleanEmail
                            },
                            back_urls: {
                                success: `${req.headers.origin || 'http://localhost:3000'}/#/order/success?token=${token}`,
                                pending: `${req.headers.origin || 'http://localhost:3000'}/#/order/pending?token=${token}`,
                                failure: `${req.headers.origin || 'http://localhost:3000'}/#/order/failure?token=${token}`
                            },
                            auto_return: 'approved',
                            external_reference: token,
                            statement_descriptor: 'NICOLAS TECHEIRA'
                        })
                    });
                    const mpData = await mpRes.json();
                    preferenceId = mpData.id;
                    initPoint = mpData.init_point || mpData.sandbox_init_point;

                    // Asociar mercadopago_preference_id a la orden en BD para trazabilidad en webhook
                    if (preferenceId) {
                        try {
                            await pool.query('UPDATE orders SET mercadopago_preference_id = ? WHERE id = ?', [preferenceId, orderId]);
                        } catch (prefUpdateErr) {
                            console.warn('Advertencia al vincular preference_id:', prefUpdateErr.message);
                        }
                    }
                } catch (mpErr) {
                    console.error('Error al generar preferencia en Mercado Pago:', mpErr);
                }
            }

            sendJson(res, 201, {
                ok: true,
                data: {
                    orderId,
                    orderNumber,
                    token,
                    count,
                    subtotal,
                    discountAmount,
                    discountLabel,
                    totalAmount,
                    preferenceId,
                    initPoint,
                    items: verifiedItems
                }
            });
            return true;
        } catch (error) {
            console.error('Error en checkout preference:', error);
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 14. Consultar Orden por Token
    const orderMatch = pathPart.match(/^\/api\/orders\/([a-f0-9]{32,64})$/i);
    if (orderMatch && method === 'GET') {
        try {
            const token = orderMatch[1];
            const [orders] = await pool.query('SELECT * FROM orders WHERE token = ?', [token]);
            if (orders.length === 0) {
                sendJson(res, 404, { ok: false, error: 'Orden no encontrada o token inválido.' });
                return true;
            }
            const order = orders[0];
            const [items] = await pool.query(
                `SELECT oi.*, p.url, p.alt_text, p.filename 
                 FROM order_items oi
                 LEFT JOIN photos p ON oi.photo_id = p.id
                 WHERE oi.order_id = ?`,
                [order.id]
            );
            sendJson(res, 200, {
                ok: true,
                order: {
                    ...order,
                    items
                }
            });
            return true;
        } catch (error) {
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // 15. Descarga Segura de Fotografía Original por Token
    const downloadMatch = pathPart.match(/^\/api\/downloads\/([a-f0-9]{32,64})\/(\d+)$/i);
    if (downloadMatch && method === 'GET') {
        try {
            const token = downloadMatch[1];
            const photoId = parseInt(downloadMatch[2], 10);

            // Validar que la orden exista y contenga esta foto
            const [orders] = await pool.query('SELECT * FROM orders WHERE token = ?', [token]);
            if (orders.length === 0) {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
                res.end('Acceso denegado: Token de compra no válido o expirado.');
                return true;
            }

            const [items] = await pool.query(
                'SELECT oi.*, p.url, p.filename FROM order_items oi JOIN photos p ON oi.photo_id = p.id WHERE oi.order_id = ? AND oi.photo_id = ?',
                [orders[0].id, photoId]
            );

            if (items.length === 0) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
                res.end('Fotografía no encontrada en esta orden.');
                return true;
            }

            const item = items[0];
            const filename = item.filename || `NicolasTecheira-Foto-${photoId}.jpg`;

            // Si es data URL base64, servir el binario directo
            if (item.url && item.url.startsWith('data:image/')) {
                const parts = item.url.split(',');
                const mime = parts[0].match(/:(.*?);/)[1] || 'image/jpeg';
                const imgBuffer = Buffer.from(parts[1], 'base64');

                res.writeHead(200, {
                    'Content-Type': mime,
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Length': imgBuffer.length
                });
                res.end(imgBuffer);
                return true;
            }

            // Si es URL remota (ej: Unsplash/Cloudinary/Hostinger), redirigir para descarga
            res.writeHead(302, {
                'Location': item.url
            });
            res.end();
            return true;
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
            res.end('Error interno al procesar la descarga.');
            return true;
        }
    }

    // 16. Webhook Mercado Pago
    if (pathPart === '/api/checkout/webhook' && method === 'POST') {
        try {
            const payload = await parseBody(req);
            const token = query.get('token') || payload.data?.id;

            if (token) {
                try {
                    await pool.query(
                        "UPDATE orders SET payment_status = 'approved' WHERE token = ? OR mercadopago_preference_id = ?",
                        [token, token]
                    );
                } catch (e) {
                    console.error('Error actualizando pago en DB:', e);
                }
            }

            sendJson(res, 200, { ok: true, received: true });
            return true;
        } catch (error) {
            sendJson(res, 500, { ok: false, error: error.message });
            return true;
        }
    }

    // Ruta de API no encontrada
    if (pathPart.startsWith('/api/')) {
        sendJson(res, 404, { ok: false, error: `Endpoint API ${pathPart} no encontrado.` });
        return true;
    }

    return false;
}

module.exports = {
    handleApiRequest,
    activeSessions,
    verifyAdminSession,
    requireAdminAuth
};
