/**
 * Picsel Persistent Database & Auth Module (db.js)
 * High-capacity client-side persistent storage using IndexedDB
 * Supports binary image storage, SHA-256 cryptographic password hashing,
 * session management and data persistence across reloads.
 */

class PicselDB {
    constructor() {
        this.dbName = 'PicselApp_Database';
        this.version = 1;
        this.db = null;
        this.isReady = false;
        this.initPromise = this.init();
    }

    async init() {
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

                // 4. Store: Settings & Config
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                this.isReady = true;
                await this.seedInitialDataIfEmpty();
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('Error al inicializar IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async ensureReady() {
        if (!this.isReady) {
            await this.initPromise;
        }
    }

    // Cryptographic SHA-256 password hashing
    async hashPassword(password, salt = 'picsel_salt_2026') {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // --- SEED INITIAL DATA (Picsel exact match) ---
    async seedInitialDataIfEmpty() {
        const albumsCount = await this.count('albums');
        if (albumsCount === 0) {
            console.log('Sembrando datos iniciales inspirados en Picsel (nico98)...');

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
                // Add sample photos for each album
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
        }
    }

    // Generic count
    async count(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic insert
    async insert(storeName, data) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic update
    async update(storeName, data) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic get by ID
    async getById(storeName, id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic get all
    async getAll(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic delete
    async delete(storeName, id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // --- ALBUM OPERATIONS ---

    // Get only published albums for public view
    async getPublishedAlbums() {
        await this.ensureReady();
        const allAlbums = await this.getAll('albums');
        const published = allAlbums.filter(a => a.status === 'published');
        // Attach photo counts
        for (const album of published) {
            album.photo_count = await this.getPhotosCountForAlbum(album.id);
        }
        // Sort by display_order or created_at
        return published.sort((a, b) => (a.display_order || 99) - (b.display_order || 99));
    }

    // Get all albums (for CMS dashboard)
    async getAllAlbums() {
        await this.ensureReady();
        const allAlbums = await this.getAll('albums');
        for (const album of allAlbums) {
            album.photo_count = await this.getPhotosCountForAlbum(album.id);
        }
        return allAlbums.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    async getAlbumBySlug(slug) {
        await this.ensureReady();
        const all = await this.getAll('albums');
        const album = all.find(a => a.slug === slug);
        if (album) {
            album.photo_count = await this.getPhotosCountForAlbum(album.id);
        }
        return album;
    }

    async createAlbum(albumData) {
        await this.ensureReady();
        const now = new Date().toISOString();
        const slug = albumData.slug || this.generateSlug(albumData.title);

        const newAlbum = {
            title: albumData.title.trim(),
            slug: slug,
            date: albumData.date || 'Reciente',
            category: albumData.category || 'General',
            description: albumData.description || '',
            photographer: albumData.photographer || 'Nicolas Techeira',
            price: Number(albumData.price) || 4000,
            status: albumData.status === 'published' ? 'published' : 'draft',
            display_order: Number(albumData.display_order) || 1,
            cover_url: albumData.cover_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=900',
            created_at: now,
            updated_at: now
        };

        const id = await this.insert('albums', newAlbum);
        newAlbum.id = id;
        return newAlbum;
    }

    async updateAlbum(id, updates) {
        await this.ensureReady();
        const existing = await this.getById('albums', id);
        if (!existing) throw new Error('Álbum no encontrado');

        const updated = {
            ...existing,
            ...updates,
            id: Number(id),
            updated_at: new Date().toISOString()
        };

        if (updates.title && !updates.slug) {
            updated.slug = this.generateSlug(updates.title);
        }

        await this.update('albums', updated);
        return updated;
    }

    async togglePublish(id) {
        await this.ensureReady();
        const album = await this.getById('albums', id);
        if (!album) throw new Error('Álbum no encontrado');
        const newStatus = album.status === 'published' ? 'draft' : 'published';
        return await this.updateAlbum(id, { status: newStatus });
    }

    async deleteAlbum(id) {
        await this.ensureReady();
        const numId = Number(id);
        // Delete all associated photos first
        const photos = await this.getPhotosByAlbum(numId);
        for (const photo of photos) {
            await this.delete('photos', photo.id);
        }
        // Delete the album
        await this.delete('albums', numId);
        return true;
    }

    // --- PHOTO OPERATIONS ---

    async getPhotosByAlbum(albumId) {
        await this.ensureReady();
        const numId = Number(albumId);
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const index = store.index('album_id');
            const request = index.getAll(numId);
            request.onsuccess = () => {
                const photos = request.result || [];
                resolve(photos.sort((a, b) => (a.order || 0) - (b.order || 0)));
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getPhotosCountForAlbum(albumId) {
        const photos = await this.getPhotosByAlbum(albumId);
        return photos.length;
    }

    async addPhotoToAlbum(albumId, photoData) {
        await this.ensureReady();
        const photo = {
            album_id: Number(albumId),
            url: photoData.url,
            alt_text: photoData.alt_text || '',
            order: photoData.order || 0,
            created_at: new Date().toISOString()
        };
        const id = await this.insert('photos', photo);
        photo.id = id;
        return photo;
    }

    async deletePhoto(photoId) {
        await this.ensureReady();
        return await this.delete('photos', Number(photoId));
    }

    // --- AUTHENTICATION & ADMIN USERS ---

    async hasAdminUser() {
        await this.ensureReady();
        const count = await this.count('admin_users');
        return count > 0;
    }

    async createFirstAdmin(email, password, name = 'Administrador') {
        await this.ensureReady();
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
        const users = await this.getAll('admin_users');
        const cleanEmail = email.trim().toLowerCase();
        const user = users.find(u => u.email === cleanEmail);

        if (!user) {
            throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
        }

        const inputHash = await this.hashPassword(password);
        if (user.password_hash !== inputHash) {
            throw new Error('Contraseña incorrecta.');
        }

        // Generate session token
        const sessionToken = 'picsel_sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        const sessionData = {
            token: sessionToken,
            userId: user.id,
            email: user.email,
            name: user.name,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
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

    logout() {
        localStorage.removeItem('picsel_admin_session');
    }

    // --- HELPER: Slug generator ---
    generateSlug(title) {
        return title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'album-' + Date.now();
    }
}

// Global instance
window.picselDB = new PicselDB();
