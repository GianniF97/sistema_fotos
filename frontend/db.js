/**
 * NICOLAS TECHEIRA FOTOGRAFÍAS — DATA LAYER & SUPABASE INTEGRATION (db.js)
 * Conexión nativa con Supabase (PostgreSQL, Supabase Auth y Supabase Storage)
 * con respaldo automático y sincronización con IndexedDB local.
 */

class NicolasTecheiraDB {
    constructor() {
        this.dbName = 'NicolasTecheira_Database';
        this.version = 1;
        this.db = null;
        this.supabase = null;
        this.supabaseConnected = false;
        this.mariadbConnected = false;
        this.isReady = false;

        // Configuración de Supabase
        this.supabaseUrl = 'https://asuepmdkhuetkndxsaaf.supabase.co';
        this.supabaseKey = 'sb_publishable_gMLIiwC28mUovg6m-49zZA_Op-iKZDv';
        this.storageBucket = 'portfolio-photos';

        this.initPromise = this.init();
    }

    async init() {
        // 1. Obtener configuración dinámica si está disponible en el servidor
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const config = await res.json();
                if (config.supabaseUrl) this.supabaseUrl = config.supabaseUrl;
                if (config.supabaseKey) this.supabaseKey = config.supabaseKey;
            }
        } catch (e) {
            console.log('[DB] Usando configuración de entorno por defecto.');
        }

        // 1.1 Probar disponibilidad de MariaDB / MySQL via API REST local o Hostinger
        try {
            const dbRes = await fetch('/api/db/status');
            if (dbRes.ok) {
                const dbStatus = await dbRes.json();
                if (dbStatus.ok) {
                    this.mariadbConnected = true;
                    console.log(`[MariaDB] Conectado exitosamente via API REST (${dbStatus.database} en ${dbStatus.host})`);
                }
            }
        } catch (e) {
            this.mariadbConnected = false;
        }

        // 2. Inicializar cliente Supabase si la librería está cargada
        if (typeof window.supabase !== 'undefined' && this.supabaseUrl && this.supabaseKey) {
            try {
                this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
                console.log('[Supabase] Cliente inicializado correctamente:', this.supabaseUrl);
            } catch (err) {
                console.warn('[Supabase] Error al inicializar cliente Supabase:', err);
            }
        }

        // 3. Inicializar almacenamiento local IndexedDB (Caché y Respaldo Offline)
        await this.initIndexedDB();

        // 4. Probar disponibilidad de tablas en Supabase
        await this.checkSupabaseTables();

        this.isReady = true;
        return this;
    }

    async checkSupabaseTables() {
        if (!this.supabase) {
            this.supabaseConnected = false;
            return;
        }

        try {
            // Comprobamos si la tabla albums existe en el esquema remoto
            const { data, error } = await this.supabase
                .from('albums')
                .select('id')
                .limit(1);

            if (error) {
                if (error.code === 'PGRST205' || error.message.includes('Could not find')) {
                    console.log('[Supabase] Conectado al proyecto, pero las tablas remotas aún no han sido migradas. Usando capa local.');
                    this.supabaseConnected = false;
                } else {
                    console.warn('[Supabase] Error al verificar tablas:', error.message);
                    this.supabaseConnected = false;
                }
            } else {
                console.log('[Supabase] Tablas remotas verificadas y activas. Modo producción online habilitado.');
                this.supabaseConnected = true;
            }
        } catch (err) {
            console.warn('[Supabase] Falló la verificación remota:', err);
            this.supabaseConnected = false;
        }
    }

    async ensureReady() {
        if (!this.isReady) {
            await this.initPromise;
        }
    }

    // =========================================================================
    // INDEXEDDB (CAPA LOCAL DE CACHÉ Y PERSISTENCIA)
    // =========================================================================
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. Store: Admin Users
                if (!db.objectStoreNames.contains('admin_users')) {
                    const userStore = db.createObjectStore('admin_users', { keyPath: 'id', autoIncrement: true });
                    userStore.createIndex('email', 'email', { unique: true });
                }

                // 2. Store: Albums
                if (!db.objectStoreNames.contains('albums')) {
                    const albumStore = db.createObjectStore('albums', { keyPath: 'id', autoIncrement: true });
                    albumStore.createIndex('slug', 'slug', { unique: true });
                    albumStore.createIndex('status', 'status', { unique: false });
                    albumStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // 3. Store: Photos
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                    photoStore.createIndex('album_id', 'album_id', { unique: false });
                }

                // 4. Store: Settings
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.seedInitialLocalDataIfEmpty();
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('Error al inicializar IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Hash criptográfico SHA-256 para almacenamiento seguro de credenciales locales
    async hashPassword(password, salt = 'nicolas_techeira_salt_2026') {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async seedInitialLocalDataIfEmpty() {
        const count = await this.count('albums');
        if (count === 0) {
            console.log('Sembrando colecciones iniciales de Nicolas Techeira...');
            const seedAlbums = [
                {
                    title: 'PORTUGAL INFANTIL',
                    slug: 'portugal-infantil',
                    date: '13 de Septiembre de 2026',
                    category: 'Fiestas',
                    description: 'Busca, descarga y etiqueta! - Instagram: nicolastecheira - Whatsapp: 3755-284134',
                    photographer: 'Nicolas Techeira',
                    price: 4000,
                    status: 'published',
                    display_order: 1,
                    cover_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900',
                    created_at: new Date('2026-09-13T10:00:00Z').toISOString(),
                    updated_at: new Date('2026-09-13T10:00:00Z').toISOString()
                },
                {
                    title: 'RUSIA INFANTIL',
                    slug: 'rusia-infantil',
                    date: '13 de Septiembre de 2026',
                    category: 'Fiestas',
                    description: 'Tradiciones y danzas infantiles en Oberá. Busca tus fotos favoritas.',
                    photographer: 'Nicolas Techeira',
                    price: 4000,
                    status: 'published',
                    display_order: 2,
                    cover_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=900',
                    created_at: new Date('2026-09-13T11:00:00Z').toISOString(),
                    updated_at: new Date('2026-09-13T11:00:00Z').toISOString()
                },
                {
                    title: 'ESPAÑA BAILA BALLET INFANTIL',
                    slug: 'espana-baila-ballet-infantil',
                    date: '13 de Septiembre de 2026',
                    category: 'Ballet',
                    description: 'Gran presentación de danzas típicas españolas y flamenco infantil.',
                    photographer: 'Nicolas Techeira',
                    price: 4000,
                    status: 'published',
                    display_order: 3,
                    cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=900',
                    created_at: new Date('2026-09-13T12:00:00Z').toISOString(),
                    updated_at: new Date('2026-09-13T12:00:00Z').toISOString()
                },
                {
                    title: 'JAPON 1-2',
                    slug: 'japon-1-2',
                    date: '13 de Septiembre de 2026',
                    category: 'Fiestas',
                    description: 'Muestra cultural japonesa, kimonos tradicionales y tambores taiko.',
                    photographer: 'Nicolas Techeira',
                    price: 4000,
                    status: 'published',
                    display_order: 4,
                    cover_url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900',
                    created_at: new Date('2026-09-13T13:00:00Z').toISOString(),
                    updated_at: new Date('2026-09-13T13:00:00Z').toISOString()
                },
                {
                    title: 'FRANCIA INFANTIL',
                    slug: 'francia-infantil',
                    date: '13 de Septiembre de 2026',
                    category: 'Fiestas',
                    description: 'Presentación de trajes regionales y danzas infantiles francesas.',
                    photographer: 'Nicolas Techeira',
                    price: 4000,
                    status: 'published',
                    display_order: 5,
                    cover_url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=900',
                    created_at: new Date('2026-09-13T14:00:00Z').toISOString(),
                    updated_at: new Date('2026-09-13T14:00:00Z').toISOString()
                },
                {
                    title: 'ARGENTINA INFANTIL',
                    slug: 'argentina-infantil',
                    date: '13 de Septiembre de 2026',
                    category: 'Fiestas',
                    description: 'Ballet folclórico infantil, chamamé y danzas tradicionales de Misiones.',
                    photographer: 'Nicolas Techeira',
                    price: 4000,
                    status: 'published',
                    display_order: 6,
                    cover_url: 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&q=80&w=900',
                    created_at: new Date('2026-09-13T15:00:00Z').toISOString(),
                    updated_at: new Date('2026-09-13T15:00:00Z').toISOString()
                }
            ];

            const seedPhotos = [
                'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800'
            ];

            for (const albumData of seedAlbums) {
                const albumId = await this.insert('albums', albumData);
                for (let i = 0; i < seedPhotos.length; i++) {
                    await this.insert('photos', {
                        album_id: albumId,
                        url: seedPhotos[i],
                        alt_text: `${albumData.title} - Fotografía ${i + 1}`,
                        order: i + 1,
                        created_at: new Date().toISOString()
                    });
                }
            }

            const adminCount = await this.count('admin_users');
            if (adminCount === 0) {
                const passHash = await this.hashPassword('estudio2026');
                await this.insert('admin_users', {
                    email: 'estudio@nicolastecheira.com',
                    name: 'Nicolas Techeira',
                    password_hash: passHash,
                    created_at: new Date().toISOString()
                });
            }
        }
    }

    // =========================================================================
    // OPERACIONES DE ÁLBUMES (UNIFICADAS: SUPABASE + FALLBACK)
    // =========================================================================

    async getPublishedAlbums() {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch('/api/albums');
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && Array.isArray(json.data)) {
                        return json.data;
                    }
                }
            } catch (err) {
                console.warn('[MariaDB] Falló consulta remota de álbumes publicados:', err);
            }
        }

        if (this.supabaseConnected) {
            try {
                const { data, error } = await this.supabase
                    .from('albums')
                    .select('*, photos(count)')
                    .eq('status', 'published')
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    return data.map(a => ({
                        ...a,
                        date: a.event_date || a.date,
                        photo_count: (a.photos && a.photos[0]) ? a.photos[0].count : (a.photo_count || 0)
                    }));
                }
            } catch (err) {
                console.warn('[Supabase] Falló consulta remota, usando local:', err);
            }
        }

        // Fallback local IndexedDB
        const all = await this.getAll('albums');
        const published = all.filter(a => a.status === 'published');
        published.sort((a, b) => (a.display_order || 1) - (b.display_order || 1));

        for (const album of published) {
            const photos = await this.getPhotosByAlbum(album.id);
            album.photo_count = photos.length;
        }

        return published;
    }

    async getAllAlbums() {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch('/api/albums?all=1', {
                    headers: this.getAuthHeaders()
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && Array.isArray(json.data)) {
                        return json.data;
                    }
                }
            } catch (err) {
                console.warn('[MariaDB] Falló getAllAlbums remoto:', err);
            }
        }

        if (this.supabaseConnected) {
            try {
                const { data, error } = await this.supabase
                    .from('albums')
                    .select('*, photos(count)')
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    return data.map(a => ({
                        ...a,
                        date: a.event_date || a.date,
                        photo_count: (a.photos && a.photos[0]) ? a.photos[0].count : (a.photo_count || 0)
                    }));
                }
            } catch (err) {
                console.warn('[Supabase] Falló getAllAlbums remoto:', err);
            }
        }

        const all = await this.getAll('albums');
        all.sort((a, b) => (a.display_order || 1) - (b.display_order || 1));

        for (const album of all) {
            const photos = await this.getPhotosByAlbum(album.id);
            album.photo_count = photos.length;
        }

        return all;
    }

    async getAlbumBySlug(slug) {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch(`/api/albums/${encodeURIComponent(slug)}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && json.data) return json.data;
                }
            } catch (err) {
                console.warn('[MariaDB] Error getAlbumBySlug:', err);
            }
        }

        if (this.supabaseConnected) {
            try {
                const { data, error } = await this.supabase
                    .from('albums')
                    .select('*')
                    .eq('slug', slug)
                    .single();

                if (!error && data) {
                    data.date = data.event_date || data.date;
                    return data;
                }
            } catch (err) {
                console.warn('[Supabase] Error getAlbumBySlug:', err);
            }
        }

        const all = await this.getAll('albums');
        return all.find(a => a.slug === slug) || null;
    }

    async getAlbumById(id) {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch(`/api/albums/${encodeURIComponent(id)}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && json.data) return json.data;
                }
            } catch (err) {
                console.warn('[MariaDB] Error getAlbumById:', err);
            }
        }

        if (this.supabaseConnected && this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('albums')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (!error && data) {
                    data.date = data.event_date || data.date;
                    return data;
                }
            } catch (err) {
                console.warn('[Supabase] Error getAlbumById:', err);
            }
        }

        const all = await this.getAll('albums');
        return all.find(a => String(a.id) === String(id)) || null;
    }

    async createAlbum(albumData) {
        await this.ensureReady();

        if (!albumData.slug && albumData.title) {
            albumData.slug = this.generateSlug(albumData.title);
        }

        if (this.mariadbConnected) {
            try {
                const res = await fetch('/api/albums', {
                    method: 'POST',
                    headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(albumData)
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && json.data) return json.data;
                }
            } catch (err) {
                console.warn('[MariaDB] Falló createAlbum remoto:', err);
            }
        }

        if (this.supabaseConnected) {
            try {
                const payload = {
                    title: albumData.title,
                    slug: albumData.slug,
                    description: albumData.description || '',
                    category: albumData.category || 'Fiestas',
                    photographer: albumData.photographer || 'Nicolas Techeira',
                    price: Number(albumData.price || 4000),
                    event_date: albumData.date || albumData.event_date || 'Reciente',
                    status: albumData.status || 'draft',
                    sort_order: Number(albumData.display_order || albumData.sort_order || 1),
                    cover_url: albumData.cover_url || ''
                };

                const { data, error } = await this.supabase
                    .from('albums')
                    .insert(payload)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (err) {
                console.error('[Supabase] Error al crear álbum en Supabase:', err);
                throw err;
            }
        }

        // Fallback local
        const id = await this.insert('albums', {
            ...albumData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        return { ...albumData, id };
    }

    async updateAlbum(id, updates) {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch(`/api/albums/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(updates)
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && json.data) return json.data;
                }
            } catch (err) {
                console.warn('[MariaDB] Falló updateAlbum remoto:', err);
            }
        }

        if (this.supabaseConnected) {
            try {
                const payload = { ...updates, updated_at: new Date().toISOString() };
                if (payload.date) {
                    payload.event_date = payload.date;
                    delete payload.date;
                }
                if (payload.display_order) {
                    payload.sort_order = payload.display_order;
                }

                const { data, error } = await this.supabase
                    .from('albums')
                    .update(payload)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (err) {
                console.error('[Supabase] Error al actualizar álbum:', err);
                throw err;
            }
        }

        const existing = await this.getById('albums', Number(id));
        if (!existing) throw new Error('Álbum no encontrado');

        const updated = {
            ...existing,
            ...updates,
            updated_at: new Date().toISOString()
        };

        await this.update('albums', updated);
        return updated;
    }

    async togglePublish(id) {
        await this.ensureReady();
        const album = await this.getAlbumById(id);
        if (!album) throw new Error('Álbum no encontrado');
        const newStatus = album.status === 'published' ? 'draft' : 'published';
        return await this.updateAlbum(id, { status: newStatus });
    }

    async deleteAlbum(id) {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch(`/api/albums/${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });
                if (res.ok) return true;
            } catch (err) {
                console.warn('[MariaDB] Falló deleteAlbum:', err);
            }
        }

        if (this.supabaseConnected) {
            try {
                const { error } = await this.supabase
                    .from('albums')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                return true;
            } catch (err) {
                console.error('[Supabase] Error al eliminar álbum:', err);
                throw err;
            }
        }

        const numId = Number(id);
        const photos = await this.getPhotosByAlbum(numId);
        for (const photo of photos) {
            await this.delete('photos', photo.id);
        }
        await this.delete('albums', numId);
        return true;
    }

    // =========================================================================
    // OPERACIONES DE FOTOGRAFÍAS & SUPABASE STORAGE
    // =========================================================================

    async getPhotosByAlbum(albumId) {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/photos`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && Array.isArray(json.data)) return json.data;
                }
            } catch (err) {
                console.warn('[MariaDB] Error getPhotosByAlbum:', err);
            }
        }

        if (this.supabaseConnected) {
            try {
                const { data, error } = await this.supabase
                    .from('photos')
                    .select('*')
                    .eq('album_id', albumId)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true });

                if (!error && data) return data;
            } catch (err) {
                console.warn('[Supabase] Error getPhotosByAlbum:', err);
            }
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const request = store.getAll();
            request.onsuccess = () => {
                const photos = (request.result || []).filter(p => String(p.album_id) === String(albumId));
                photos.sort((a, b) => (a.order || a.sort_order || 1) - (b.order || b.sort_order || 1));
                resolve(photos);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async addPhotoToAlbum(albumId, photoData) {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch('/api/photos', {
                    method: 'POST',
                    headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        album_id: albumId,
                        url: photoData.url,
                        filename: photoData.filename || (photoData.alt_text ? `${photoData.alt_text}.jpg` : 'foto.jpg'),
                        alt_text: photoData.alt_text || '',
                        sort_order: Number(photoData.order || photoData.sort_order || 1)
                    })
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && json.data) return json.data;
                }
            } catch (err) {
                console.warn('[MariaDB] Error addPhotoToAlbum:', err);
            }
        }

        if (this.supabaseConnected && this.supabase) {
            try {
                const payload = {
                    album_id: albumId,
                    storage_path: photoData.storage_path || `manual/${albumId}/${Date.now()}.jpg`,
                    url: photoData.url,
                    filename: photoData.filename || (photoData.alt_text ? `${photoData.alt_text}.jpg` : 'foto.jpg'),
                    alt_text: photoData.alt_text || '',
                    sort_order: Number(photoData.order || photoData.sort_order || 1)
                };

                const { data, error } = await this.supabase
                    .from('photos')
                    .insert(payload)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (err) {
                console.error('[Supabase] Error en addPhotoToAlbum:', err);
                throw err;
            }
        }

        // Fallback local en IndexedDB
        const photoObj = {
            album_id: (typeof albumId === 'string' && !isNaN(Number(albumId))) ? Number(albumId) : albumId,
            url: photoData.url,
            alt_text: photoData.alt_text || '',
            order: Number(photoData.order || photoData.sort_order || 1),
            created_at: new Date().toISOString()
        };
        const id = await this.insert('photos', photoObj);
        return { ...photoObj, id };
    }

    async deletePhoto(photoId) {
        await this.ensureReady();

        if (this.mariadbConnected) {
            try {
                const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });
                if (res.ok) return true;
            } catch (err) {
                console.warn('[MariaDB] Error al eliminar foto:', err);
            }
        }

        if (this.supabaseConnected && this.supabase) {
            try {
                const { error } = await this.supabase
                    .from('photos')
                    .delete()
                    .eq('id', photoId);

                if (error) throw error;
                return true;
            } catch (err) {
                console.error('[Supabase] Error al eliminar foto:', err);
                throw err;
            }
        }

        const allPhotos = await this.getAll('photos');
        const match = allPhotos.find(p => String(p.id) === String(photoId));
        if (match) {
            await this.delete('photos', match.id);
        }
        return true;
    }

    async uploadPhotoFile(albumId, file, albumSlug = 'galeria') {
        await this.ensureReady();

        if (this.supabaseConnected && this.supabase) {
            try {
                const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
                const storagePath = `${albumSlug}/${cleanFileName}`;

                // 1. Subir a Supabase Storage
                const { data: uploadData, error: uploadErr } = await this.supabase
                    .storage
                    .from(this.storageBucket)
                    .upload(storagePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadErr) throw uploadErr;

                // 2. Obtener URL pública
                const { data: publicUrlData } = this.supabase
                    .storage
                    .from(this.storageBucket)
                    .getPublicUrl(storagePath);

                const publicUrl = publicUrlData.publicUrl;

                // 3. Insertar registro en tabla photos
                const photoPayload = {
                    album_id: albumId,
                    storage_path: storagePath,
                    url: publicUrl,
                    filename: file.name,
                    alt_text: file.name.replace(/\.[^/.]+$/, ''),
                    file_size: file.size,
                    mime_type: file.type || 'image/jpeg',
                    sort_order: 1
                };

                const { data: photoData, error: dbErr } = await this.supabase
                    .from('photos')
                    .insert(photoPayload)
                    .select()
                    .single();

                if (dbErr) throw dbErr;
                return photoData;
            } catch (err) {
                console.error('[Supabase Storage] Error al subir foto:', err);
                throw err;
            }
        }

        // Fallback local en Base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const photoObj = {
                    album_id: (typeof albumId === 'string' && !isNaN(Number(albumId))) ? Number(albumId) : albumId,
                    url: e.target.result,
                    alt_text: file.name,
                    order: Date.now(),
                    created_at: new Date().toISOString()
                };
                const id = await this.insert('photos', photoObj);
                resolve({ ...photoObj, id });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // =========================================================================
    // AUTENTICACIÓN (SUPABASE AUTH + FALLBACK)
    // =========================================================================

    async hasAdminUser() {
        await this.ensureReady();

        if (this.supabaseConnected && this.supabase) {
            try {
                const { count, error } = await this.supabase
                    .from('admin_users')
                    .select('*', { count: 'exact', head: true });

                if (!error && count !== null) {
                    return count > 0;
                }
            } catch (err) {
                console.warn('[Supabase Auth] Falló consulta hasAdminUser:', err);
            }
        }

        const localCount = await this.count('admin_users');
        return localCount > 0;
    }

    async createFirstAdmin(email, password, name = 'Nicolas Techeira') {
        await this.ensureReady();

        if (this.supabaseConnected && this.supabase) {
            try {
                // Registrar usuario en Supabase Auth
                const { data: authData, error: authError } = await this.supabase.auth.signUp({
                    email: email.trim().toLowerCase(),
                    password: password
                });

                if (authError) throw authError;

                // Reclamar rol de administrador en la tabla admin_users
                const { error: claimErr } = await this.supabase.rpc('claim_initial_admin', {
                    admin_name: name.trim()
                });

                if (claimErr) {
                    console.warn('[Supabase] RPC claim_initial_admin no disponible o falló:', claimErr.message);
                }

                return authData.user;
            } catch (err) {
                console.error('[Supabase Auth] Error al registrar primer admin:', err);
                throw err;
            }
        }

        // Registro local
        const hasAdmin = await this.hasAdminUser();
        if (hasAdmin) {
            throw new Error('Ya existe un administrador en el sistema.');
        }

        const password_hash = await this.hashPassword(password);
        const adminUser = {
            email: email.trim().toLowerCase(),
            name: name.trim(),
            password_hash: password_hash,
            created_at: new Date().toISOString()
        };

        const id = await this.insert('admin_users', adminUser);
        adminUser.id = id;
        delete adminUser.password_hash;
        return adminUser;
    }

    async login(email, password) {
        await this.ensureReady();
        const cleanEmail = email.trim().toLowerCase();

        if (this.mariadbConnected) {
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cleanEmail, password })
                });
                const json = await res.json();
                if (res.ok && json.ok && json.session) {
                    localStorage.setItem('picsel_admin_session', JSON.stringify(json.session));
                    return json.session;
                } else if (res.status === 401) {
                    throw new Error(json.error || 'Credenciales inválidas.');
                }
            } catch (err) {
                console.warn('[MariaDB Auth] Falló autenticación en MariaDB:', err.message);
                if (err.message.includes('Credenciales') || err.message.includes('Contraseña')) {
                    throw err;
                }
            }
        }

        if (this.supabaseConnected && this.supabase) {
            try {
                const { data, error } = await this.supabase.auth.signInWithPassword({
                    email: cleanEmail,
                    password: password
                });

                if (error) throw error;

                // Verificar que el usuario tenga rol de administrador
                const { data: adminRecord, error: adminErr } = await this.supabase
                    .from('admin_users')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (adminErr || !adminRecord) {
                    // Si la tabla admin_users está vacía, intentar reclamar como primer admin
                    const { count } = await this.supabase.from('admin_users').select('*', { count: 'exact', head: true });
                    if (count === 0) {
                        await this.supabase.rpc('claim_initial_admin', { admin_name: 'Nicolas Techeira' });
                    } else {
                        await this.supabase.auth.signOut();
                        throw new Error('Acceso denegado: este usuario no posee rol de administrador de estudio.');
                    }
                }

                const sessionData = {
                    token: data.session.access_token,
                    userId: data.user.id,
                    email: data.user.email,
                    name: (adminRecord && adminRecord.full_name) || 'Nicolas Techeira',
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000)
                };

                localStorage.setItem('picsel_admin_session', JSON.stringify(sessionData));
                return sessionData;
            } catch (err) {
                console.warn('[Supabase Auth] Falló autenticación remota, probando local:', err.message);
                // Si falla el login remoto pero hay coincidencia local, permitir acceso
            }
        }

        // Autenticación local
        const users = await this.getAll('admin_users');
        const user = users.find(u => u.email === cleanEmail);

        if (!user) {
            throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
        }

        const inputHash = await this.hashPassword(password);
        if (user.password_hash !== inputHash) {
            throw new Error('Contraseña incorrecta.');
        }

        const sessionToken = 'nt_sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        const sessionData = {
            token: sessionToken,
            userId: user.id,
            email: user.email,
            name: user.name,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        };

        localStorage.setItem('picsel_admin_session', JSON.stringify(sessionData));
        return sessionData;
    }

    validateSession() {
        const sessionStr = localStorage.getItem('picsel_admin_session');
        if (!sessionStr) return null;

        try {
            const session = JSON.parse(sessionStr);
            if (Date.now() > session.expiresAt) {
                localStorage.removeItem('picsel_admin_session');
                return null;
            }
            return session;
        } catch (e) {
            localStorage.removeItem('picsel_admin_session');
            return null;
        }
    }

    getAuthHeaders(customHeaders = {}) {
        const session = this.validateSession();
        const headers = { ...customHeaders };
        if (session && session.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }
        return headers;
    }

    async logout() {
        if (this.supabase && this.supabaseConnected) {
            try {
                await this.supabase.auth.signOut();
            } catch (e) {
                console.warn('Error al cerrar sesión en Supabase:', e);
            }
        }
        localStorage.removeItem('picsel_admin_session');
        return true;
    }

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    generateSlug(text) {
        return text
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Métodos genéricos IndexedDB
    async count(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async insert(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getById(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // =========================================================================
    // CHECKOUT, ÓRDENES Y DESCARGAS SEGURAS
    // =========================================================================
    async createCheckoutPreference(orderData) {
        if (this.mariadbConnected) {
            try {
                const res = await fetch('/api/checkout/preference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });
                if (res.ok) {
                    const json = await res.json();
                    return json.data;
                }
            } catch (err) {
                console.warn('[DB] Falló llamada a /api/checkout/preference:', err);
            }
        }

        // Simulación offline/cliente si el servidor estuviera desconectado
        const count = (orderData.items || []).length;
        const subtotal = (orderData.items || []).reduce((sum, it) => sum + Number(it.price || 4000), 0);
        let discountRate = 0;
        let discountLabel = 'Precio regular';

        if (count >= 20 || orderData.isFullAlbum) {
            discountRate = 0.35;
            discountLabel = 'Pack Colección Completa (35% OFF)';
        } else if (count >= 10) {
            discountRate = 0.25;
            discountLabel = 'Pack Selección Especial (25% OFF)';
        } else if (count >= 5) {
            discountRate = 0.15;
            discountLabel = 'Pack 5 Recuerdos (15% OFF)';
        }

        const discountAmount = Math.round(subtotal * discountRate);
        const totalAmount = Math.max(0, subtotal - discountAmount);
        const token = 'nt-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

        return {
            orderNumber: `NT-${Date.now().toString().slice(-6)}`,
            token,
            count,
            subtotal,
            discountAmount,
            discountLabel,
            totalAmount,
            items: orderData.items
        };
    }

    async getOrderByToken(token) {
        if (this.mariadbConnected) {
            try {
                const res = await fetch(`/api/orders/${encodeURIComponent(token)}`);
                if (res.ok) {
                    const json = await res.json();
                    return json.order;
                }
            } catch (err) {
                console.warn('[DB] Error consultando orden:', err);
            }
        }
        return null;
    }
}

// Instancia global disponible en window.picselDB
window.picselDB = new NicolasTecheiraDB();
window.ntDB = window.picselDB;
