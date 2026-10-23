/**
 * NICOLAS TECHEIRA FOTOGRAFÍAS — Application Controller (script.js)
 * Manages SPA Routing, Editorial Public Gallery, Lightbox, Facial Search Simulation,
 * Shopping Cart, and Full Private Studio CMS Admin Panel with IndexedDB Persistence.
 */

const app = {
    currentView: 'publicPortfolio',
    currentAlbum: null,
    currentAlbumPhotos: [],
    currentFilteredPhotos: null,
    lightboxIndex: 0,
    cart: [],
    formPhotosTemp: [],
    adminSearchQuery: '',
    adminStatusFilter: 'all',

    // Initialization
    async init() {
        // Initialize theme
        this.initTheme();

        // Listen for route changes
        window.addEventListener('hashchange', () => this.handleRouting());

        // Keyboard navigation (Esc to close modals, Arrows for lightbox)
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Wait for database ready
        await window.picselDB.ensureReady();

        // Handle initial route
        this.handleRouting();

        // Refresh Lucide icons
        this.refreshIcons();
    },

    refreshIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // ============================================================
    // THEME MANAGEMENT (Light / Dark mode - Carbon & Warm White)
    // ============================================================
    initTheme() {
        const savedTheme = localStorage.getItem('nt_theme') || localStorage.getItem('picsel_theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        }
        this.updateThemeIcon();
    },

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        document.documentElement.classList.toggle('light', !isDark);
        const mode = isDark ? 'dark' : 'light';
        localStorage.setItem('nt_theme', mode);
        localStorage.setItem('picsel_theme', mode);
        this.updateThemeIcon();
        this.showToast(isDark ? 'Modo Oscuro Carbón activado' : 'Modo Claro Cálido activado');
    },

    updateThemeIcon() {
        const isDark = document.documentElement.classList.contains('dark');
        const icon = document.getElementById('themeIcon');
        if (icon) {
            icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
            this.refreshIcons();
        }
    },

    // ============================================================
    // ROUTING & VIEW CONTROLLER
    // ============================================================
    async handleRouting() {
        const hash = window.location.hash || '#/';
        
        // Hide all major views
        document.getElementById('viewPublicPortfolio').classList.add('hidden');
        document.getElementById('viewAlbumDetails').classList.add('hidden');
        document.getElementById('viewAdminLogin').classList.add('hidden');
        document.getElementById('viewAdminDashboard').classList.add('hidden');

        // Route: Home / Public Portfolio
        if (hash === '#/' || hash === '' || hash === '#') {
            this.currentView = 'publicPortfolio';
            document.title = 'Nicolas Techeira Fotografías';
            document.getElementById('viewPublicPortfolio').classList.remove('hidden');
            await this.loadPublicAlbums();
        } 
        // Route: Album details (#/album/slug-name)
        else if (hash.startsWith('#/album/')) {
            const slug = hash.replace('#/album/', '');
            this.currentView = 'albumDetails';
            document.getElementById('viewAlbumDetails').classList.remove('hidden');
            await this.loadAlbumDetails(slug);
        } 
        // Route: Admin Login (#/admin/login)
        else if (hash === '#/admin/login') {
            document.title = 'Acceso Estudio — Nicolas Techeira Fotografías';
            if (window.picselDB.validateSession()) {
                window.location.hash = '#/admin/dashboard';
                return;
            }
            this.currentView = 'adminLogin';
            document.getElementById('viewAdminLogin').classList.remove('hidden');
            await this.prepareAdminLoginForm();
        } 
        // Route: Admin Dashboard CMS (#/admin/dashboard)
        else if (hash === '#/admin/dashboard') {
            document.title = 'Estudio CMS — Nicolas Techeira Fotografías';
            const session = window.picselDB.validateSession();
            if (!session) {
                this.showToast('Inicia sesión para ingresar al panel de estudio', 'error');
                window.location.hash = '#/admin/login';
                return;
            }
            this.currentView = 'adminDashboard';
            document.getElementById('viewAdminDashboard').classList.remove('hidden');
            document.getElementById('adminGreeting').textContent = `Sesión: ${session.name} (${session.email})`;
            await this.loadAdminDashboard();
        } 
        else {
            window.location.hash = '#/';
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.refreshIcons();
    },

    goHome() {
        window.location.hash = '#/';
    },

    // ============================================================
    // PUBLIC PORTFOLIO LOGIC — EDITORIAL ASYMMETRIC SHOWCASE
    // ============================================================
    async loadPublicAlbums(filterCategory = 'all') {
        const grid = document.getElementById('albumsGrid');
        grid.innerHTML = `
            <div class="col-span-full text-center py-20">
                <div class="inline-block w-8 h-8 border-2 border-bronze border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="font-mono text-xs uppercase tracking-widest text-stone">Cargando colecciones fotográficas...</p>
            </div>
        `;

        try {
            const albums = await window.picselDB.getPublishedAlbums();

            let filtered = albums;
            if (filterCategory !== 'all') {
                filtered = albums.filter(a => a.category && a.category.toLowerCase() === filterCategory.toLowerCase());
            }

            if (!filtered || filtered.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-20 bg-white dark:bg-card border border-carbon/10 dark:border-warmwhite/10 p-10">
                        <i data-lucide="image-off" class="w-10 h-10 text-stone mx-auto mb-3"></i>
                        <h4 class="font-editorial text-2xl text-carbon dark:text-warmwhite mb-1">Sin colecciones en esta categoría</h4>
                        <p class="font-mono text-xs text-stone">No se encontraron álbumes publicados bajo el filtro seleccionado.</p>
                    </div>
                `;
                this.refreshIcons();
                return;
            }

            grid.innerHTML = filtered.map((album, index) => {
                const indexFormatted = String(index + 1).padStart(2, '0');
                return `
                    <article onclick="window.location.hash = '#/album/${album.slug}'" 
                             class="album-card-editorial group">
                        
                        <!-- Contenedor de la Imagen con Ratio Editorial 4:3 -->
                        <div class="image-wrap aspect-[4/3]">
                            <img src="${album.cover_url}" 
                                 alt="${album.title}" 
                                 loading="lazy" 
                                 onerror="this.src='https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900'"
                                 class="w-full h-full">
                            
                            <!-- Insignia Editorial en Esquina Superior -->
                            <div class="editorial-album-badge">
                                <span class="badge-index">${indexFormatted}</span>
                                <span class="badge-cat">${album.category || 'Fiestas'}</span>
                            </div>

                            <!-- Contador de Fotos en Esquina Inferior -->
                            <span class="absolute bottom-3 right-3 bg-carbon/90 text-warmwhite text-[11px] font-mono px-2.5 py-1 flex items-center space-x-1.5 border border-warmwhite/10 shadow-md">
                                <i data-lucide="camera" class="w-3 h-3 text-bronze"></i>
                                <span>${album.photo_count || 0} fotos</span>
                            </span>
                        </div>

                        <!-- Pie de la Tarjeta Editorial -->
                        <div class="p-5 border-t border-carbon/10 dark:border-warmwhite/10 flex flex-col justify-between">
                            <div>
                                <h3 class="font-editorial text-xl sm:text-2xl font-normal text-carbon dark:text-warmwhite group-hover:text-bronze transition-colors uppercase tracking-tight mb-1">
                                    ${album.title}
                                </h3>
                                <p class="font-mono text-xs text-stone-dark dark:text-stone">
                                    ${album.date || 'Reciente'}
                                </p>
                            </div>
                            
                            <div class="pt-4 flex items-center justify-between text-xs font-mono border-t border-carbon/5 dark:border-warmwhite/5 mt-3">
                                <span class="text-stone">Precio ref.</span>
                                <span class="font-bold text-carbon dark:text-warmwhite">$ ${Number(album.price || 4000).toLocaleString('es-AR')}</span>
                            </div>
                        </div>

                    </article>
                `;
            }).join('');

            this.refreshIcons();
        } catch (error) {
            console.error('Error al cargar colecciones:', error);
            grid.innerHTML = `
                <div class="col-span-full text-center py-16 text-red-500 font-mono text-xs">
                    <p>Ocurrió un error al cargar las colecciones desde la base de datos.</p>
                </div>
            `;
        }
    },

    filterByCategory(category) {
        document.querySelectorAll('.category-tab-editorial').forEach(btn => {
            const btnCat = btn.getAttribute('data-category');
            if (btnCat === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.loadPublicAlbums(category);
    },

    // ============================================================
    // PUBLIC ALBUM DETAILS & PHOTO GALLERY
    // ============================================================
    async loadAlbumDetails(slug) {
        const album = await window.picselDB.getAlbumBySlug(slug);

        // Security check: If album is draft and user is not admin, deny access
        const session = window.picselDB.validateSession();
        if (!album || (album.status === 'draft' && !session)) {
            this.showToast('La colección solicitada no está disponible o no existe', 'error');
            this.goHome();
            return;
        }

        this.currentAlbum = album;
        this.currentFilteredPhotos = null;
        document.title = `${album.title} — Nicolas Techeira Fotografías`;
        document.getElementById('faceSearchBanner').classList.add('hidden');

        // Render Editorial Header Card
        const headerCard = document.getElementById('albumHeaderCard');
        headerCard.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
                <div class="space-y-3 flex-1">
                    <div class="flex items-center space-x-3">
                        <span class="font-mono text-xs px-2.5 py-0.5 bg-bronze/10 text-bronze border border-bronze/30 uppercase tracking-widest font-bold">
                            ${album.category || 'Fiestas'}
                        </span>
                        ${album.status === 'draft' ? '<span class="font-mono text-xs px-2.5 py-0.5 bg-stone/20 text-stone border border-stone/30 uppercase">Borrador Privado</span>' : ''}
                    </div>

                    <h1 class="font-editorial text-3xl sm:text-5xl font-normal tracking-tight text-carbon dark:text-warmwhite uppercase leading-tight">
                        ${album.title}
                    </h1>
                    
                    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono text-stone-dark dark:text-stone pt-1">
                        <span class="flex items-center space-x-1.5">
                            <i data-lucide="calendar" class="w-3.5 h-3.5 text-bronze"></i>
                            <span>${album.date}</span>
                        </span>
                        <span>•</span>
                        <span class="flex items-center space-x-1.5">
                            <i data-lucide="camera" class="w-3.5 h-3.5 text-bronze"></i>
                            <span>${album.photographer || 'Nicolas Techeira'}</span>
                        </span>
                        <span>•</span>
                        <span class="text-carbon dark:text-warmwhite font-bold">$ ${Number(album.price || 4000).toLocaleString('es-AR')} por foto</span>
                    </div>

                    <p class="font-editorial italic text-base sm:text-lg text-stone-dark dark:text-stone pt-2 max-w-2xl leading-relaxed">
                        ${album.description || 'Busca, descarga y etiqueta tus fotografías en alta resolución.'}
                    </p>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 md:pt-0">
                    <!-- Botón Búsqueda Facial -->
                    <button onclick="app.openSearchModal()" class="btn-editorial-bronze text-xs py-3 px-5">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                        <span>Encontrá tus fotos</span>
                    </button>
                </div>
            </div>
        `;

        // Load photos for this album
        const photos = await window.picselDB.getPhotosByAlbum(album.id);
        this.currentAlbumPhotos = photos;
        this.renderAlbumPhotos(photos);
        this.refreshIcons();
    },

    renderAlbumPhotos(photos) {
        const grid = document.getElementById('albumPhotosGrid');

        if (!photos || photos.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20 bg-white dark:bg-card border border-carbon/10 dark:border-warmwhite/10 p-10">
                    <i data-lucide="image" class="w-10 h-10 text-stone mx-auto mb-3"></i>
                    <h4 class="font-editorial text-2xl text-carbon dark:text-warmwhite mb-1">Colección sin fotografías</h4>
                    <p class="font-mono text-xs text-stone">El fotógrafo aún no ha subido fotos a este álbum.</p>
                </div>
            `;
            this.refreshIcons();
            return;
        }

        grid.innerHTML = photos.map((photo, index) => {
            const inCart = this.cart.some(item => item.id === photo.id);
            return `
                <div class="group relative bg-white dark:bg-card border border-carbon/10 dark:border-warmwhite/10 transition-all duration-300">
                    
                    <!-- Photo container with watermark -->
                    <div class="relative aspect-[4/3] overflow-hidden bg-carbon/5 dark:bg-warmwhite/5 cursor-pointer" onclick="app.openLightbox(${index})">
                        <img src="${photo.url}" 
                             alt="${photo.alt_text || 'Fotografía de Nicolás Techeira'}" 
                             loading="lazy" 
                             class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700">
                        
                        <!-- Watermark Overlay (Nicolas Techeira Fotografías) -->
                        <div class="picsel-watermark-overlay">
                            <span class="picsel-watermark-text">Nicolas Techeira</span>
                            <span class="picsel-watermark-subtext">Vista Previa · Oberá</span>
                        </div>

                        <!-- Zoom hint icon -->
                        <div class="absolute top-3 left-3 w-8 h-8 bg-carbon/80 text-warmwhite flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i data-lucide="maximize-2" class="w-4 h-4"></i>
                        </div>
                    </div>

                    <!-- Photo Card Footer: + Agregar Button -->
                    <div class="p-3.5 flex items-center justify-between border-t border-carbon/10 dark:border-warmwhite/10 bg-white dark:bg-card">
                        <span class="font-mono text-xs text-stone">#${index + 1}</span>
                        <button onclick="app.toggleCartPhoto(${photo.id}, event)" 
                                class="text-xs font-mono py-1.5 px-3 transition-all flex items-center space-x-1.5 ${
                                    inCart 
                                    ? 'btn-editorial-bronze' 
                                    : 'btn-editorial-secondary'
                                }">
                            <i data-lucide="${inCart ? 'check' : 'shopping-bag'}" class="w-3.5 h-3.5"></i>
                            <span>${inCart ? 'Agregado' : 'Agregar'}</span>
                        </button>
                    </div>

                </div>
            `;
        }).join('');

        this.refreshIcons();
    },

    // ============================================================
    // LIGHTBOX VIEWER — FULLSCREEN CINEMATOGRAPHIC
    // ============================================================
    openLightbox(index) {
        const photos = this.currentFilteredPhotos || this.currentAlbumPhotos;
        if (!photos || photos.length === 0) return;

        this.lightboxIndex = index;
        const photo = photos[index];

        const modal = document.getElementById('lightboxModal');
        const img = document.getElementById('lightboxImg');
        const indexText = document.getElementById('lightboxIndexText');
        const cartBtn = document.getElementById('lightboxAddCartBtn');

        img.src = photo.url;
        indexText.textContent = `[ FOTO ${index + 1} / ${photos.length} ]`;

        const inCart = this.cart.some(item => item.id === photo.id);
        cartBtn.innerHTML = `
            <i data-lucide="${inCart ? 'check' : 'shopping-bag'}" class="w-3.5 h-3.5"></i>
            <span>${inCart ? 'Quitar de Selección' : '+ Agregar a Selección'}</span>
        `;
        cartBtn.className = inCart 
            ? 'btn-editorial-primary text-xs py-2 px-4'
            : 'btn-editorial-bronze text-xs py-2 px-4';

        modal.classList.remove('hidden');
        this.refreshIcons();
    },

    closeLightbox() {
        document.getElementById('lightboxModal').classList.add('hidden');
    },

    prevLightboxPhoto() {
        const photos = this.currentFilteredPhotos || this.currentAlbumPhotos;
        if (this.lightboxIndex > 0) {
            this.openLightbox(this.lightboxIndex - 1);
        } else {
            this.openLightbox(photos.length - 1);
        }
    },

    nextLightboxPhoto() {
        const photos = this.currentFilteredPhotos || this.currentAlbumPhotos;
        if (this.lightboxIndex < photos.length - 1) {
            this.openLightbox(this.lightboxIndex + 1);
        } else {
            this.openLightbox(0);
        }
    },

    toggleCartFromLightbox() {
        const photos = this.currentFilteredPhotos || this.currentAlbumPhotos;
        const photo = photos[this.lightboxIndex];
        this.toggleCartPhoto(photo.id);
        this.openLightbox(this.lightboxIndex);
    },

    handleKeyboard(e) {
        if (e.key === 'Escape') {
            this.closeLightbox();
            this.closeSearchModal();
            this.closeCartModal();
            this.closeQrModal();
            this.closeAlbumFormModal();
        } else if (e.key === 'ArrowLeft' && !document.getElementById('lightboxModal').classList.contains('hidden')) {
            this.prevLightboxPhoto();
        } else if (e.key === 'ArrowRight' && !document.getElementById('lightboxModal').classList.contains('hidden')) {
            this.nextLightboxPhoto();
        }
    },

    // ============================================================
    // SHOPPING CART & CHECKOUT
    // ============================================================
    toggleCartPhoto(photoId, event) {
        if (event) event.stopPropagation();

        const photo = this.currentAlbumPhotos.find(p => p.id === photoId);
        if (!photo) return;

        const existingIdx = this.cart.findIndex(item => item.id === photoId);
        if (existingIdx >= 0) {
            this.cart.splice(existingIdx, 1);
            this.showToast('Foto removida de la selección');
        } else {
            this.cart.push({
                id: photo.id,
                url: photo.url,
                albumTitle: this.currentAlbum ? this.currentAlbum.title : 'Evento',
                price: this.currentAlbum ? this.currentAlbum.price : 4000
            });
            this.showToast('Foto agregada a tu selección');
        }

        this.updateCartUI();
        if (this.currentAlbum) {
            this.renderAlbumPhotos(this.currentFilteredPhotos || this.currentAlbumPhotos);
        }
    },

    updateCartUI() {
        const count = this.cart.length;
        const total = this.cart.reduce((sum, item) => sum + (item.price || 4000), 0);

        // Header button
        const headerCartBtn = document.getElementById('headerCartBtn');
        const headerCartBadge = document.getElementById('headerCartBadge');
        if (headerCartBtn) {
            if (count > 0) {
                headerCartBtn.classList.remove('hidden');
                headerCartBadge.textContent = count;
            } else {
                headerCartBtn.classList.add('hidden');
            }
        }

        // Floating bar
        const floatingBar = document.getElementById('floatingCartBar');
        const floatingCount = document.getElementById('floatingCartCount');
        const floatingTotal = document.getElementById('floatingCartTotal');

        if (count > 0 && this.currentView === 'albumDetails') {
            floatingBar.classList.remove('hidden');
            floatingCount.textContent = count;
            floatingTotal.textContent = `$ ${total.toLocaleString('es-AR')}`;
        } else {
            floatingBar.classList.add('hidden');
        }

        // Cart modal sum
        document.getElementById('cartTotalSum').textContent = `$ ${total.toLocaleString('es-AR')}`;
    },

    openCartModal() {
        const list = document.getElementById('cartItemsList');
        if (this.cart.length === 0) {
            list.innerHTML = `
                <div class="py-12 text-center text-stone">
                    <i data-lucide="shopping-bag" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
                    <p class="font-mono text-xs">Tu selección está vacía.</p>
                </div>
            `;
        } else {
            list.innerHTML = this.cart.map((item, index) => `
                <div class="py-3 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <img src="${item.url}" class="w-12 h-12 object-cover border border-carbon/10 dark:border-warmwhite/10" alt="Miniatura">
                        <div>
                            <p class="font-editorial text-base font-semibold text-carbon dark:text-warmwhite uppercase">${item.albumTitle}</p>
                            <p class="font-mono text-[11px] text-stone">Descarga digital original</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="font-mono text-xs font-bold text-carbon dark:text-warmwhite">$ ${(item.price || 4000).toLocaleString('es-AR')}</span>
                        <button onclick="app.removeCartItem(${index})" class="text-stone hover:text-red-500 p-1" title="Eliminar foto">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('cartModal').classList.remove('hidden');
        this.refreshIcons();
    },

    closeCartModal() {
        document.getElementById('cartModal').classList.add('hidden');
    },

    removeCartItem(index) {
        this.cart.splice(index, 1);
        this.updateCartUI();
        this.openCartModal();
        if (this.currentAlbum) {
            this.renderAlbumPhotos(this.currentFilteredPhotos || this.currentAlbumPhotos);
        }
    },

    clearCart() {
        this.cart = [];
        this.updateCartUI();
        this.closeCartModal();
        this.showToast('Selección vaciada');
        if (this.currentAlbum) {
            this.renderAlbumPhotos(this.currentFilteredPhotos || this.currentAlbumPhotos);
        }
    },

    simulateCheckout() {
        if (this.cart.length === 0) {
            this.showToast('La selección está vacía', 'error');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price || 4000), 0);
        this.closeCartModal();
        alert(`Conectando con la pasarela de pagos...\n\nFotógrafo: Nicolas Techeira\nTotal a abonar: $ ${total.toLocaleString('es-AR')} ARS\nCantidad de fotos: ${this.cart.length}\n\nSerás redirigido para completar la transacción de manera segura.`);
    },

    // ============================================================
    // FACIAL RECOGNITION SEARCH SIMULATION
    // ============================================================
    openSearchModal() {
        document.getElementById('searchModal').classList.remove('hidden');
        document.getElementById('selfieInput').value = '';
        document.getElementById('selfiePrompt').classList.remove('hidden');
        document.getElementById('selfiePreviewContainer').classList.add('hidden');
        this.refreshIcons();
    },

    closeSearchModal() {
        document.getElementById('searchModal').classList.add('hidden');
    },

    handleSelfieSelected(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('selfiePreviewImg').src = e.target.result;
                document.getElementById('selfieFileName').textContent = file.name;
                document.getElementById('selfiePrompt').classList.add('hidden');
                document.getElementById('selfiePreviewContainer').classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    },

    async processFaceSearch(event) {
        event.preventDefault();
        const input = document.getElementById('selfieInput');
        if (!input.files || !input.files[0]) {
            this.showToast('Por favor selecciona una fotografía de tu rostro', 'error');
            return;
        }

        const btn = document.getElementById('btnRunFaceSearch');
        const btnText = document.getElementById('faceSearchBtnText');
        btn.disabled = true;
        btnText.textContent = 'Analizando rasgos...';

        setTimeout(() => {
            btn.disabled = false;
            btnText.textContent = 'Iniciar Búsqueda';
            this.closeSearchModal();

            if (!this.currentAlbumPhotos || this.currentAlbumPhotos.length === 0) {
                this.showToast('No hay fotos en esta colección para buscar');
                return;
            }

            const matchedCount = Math.max(1, Math.min(3, this.currentAlbumPhotos.length));
            this.currentFilteredPhotos = this.currentAlbumPhotos.slice(0, matchedCount);

            document.getElementById('faceSearchBanner').classList.remove('hidden');
            this.renderAlbumPhotos(this.currentFilteredPhotos);
            this.showToast(`Búsqueda completada: ${matchedCount} fotos coincidentes encontradas`);
        }, 1200);
    },

    clearFaceSearchFilter() {
        this.currentFilteredPhotos = null;
        document.getElementById('faceSearchBanner').classList.add('hidden');
        this.renderAlbumPhotos(this.currentAlbumPhotos);
        this.showToast('Mostrando todas las fotos de la colección');
    },

    // ============================================================
    // QR CODE & SHARE PROFILE MODAL
    // ============================================================
    openQrModal() {
        document.getElementById('qrModal').classList.remove('hidden');
        const canvas = document.getElementById('qrCanvas');
        if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, window.location.origin + window.location.pathname, {
                width: 176,
                margin: 1,
                color: { dark: '#111110', light: '#ffffff' }
            }, (error) => {
                if (error) console.error(error);
            });
        }
        this.refreshIcons();
    },

    closeQrModal() {
        document.getElementById('qrModal').classList.add('hidden');
    },

    copyProfileLink() {
        const url = window.location.origin + window.location.pathname;
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('Enlace de Nicolas Techeira Fotografías copiado');
        }).catch(() => {
            this.showToast('No se pudo copiar el enlace', 'error');
        });
    },

    // ============================================================
    // ADMIN AUTHENTICATION
    // ============================================================
    async prepareAdminLoginForm() {
        const hasAdmin = await window.picselDB.hasAdminUser();
        const headerNormal = document.getElementById('loginHeaderNormal');
        const headerSetup = document.getElementById('loginHeaderSetup');
        const setupNameGroup = document.getElementById('setupNameGroup');
        const setupConfirmPassGroup = document.getElementById('setupConfirmPassGroup');
        const loginBtnText = document.getElementById('loginBtnText');
        const errorDiv = document.getElementById('loginErrorMsg');

        errorDiv.classList.add('hidden');

        if (!hasAdmin) {
            headerNormal.classList.add('hidden');
            headerSetup.classList.remove('hidden');
            setupNameGroup.classList.remove('hidden');
            setupConfirmPassGroup.classList.remove('hidden');
            loginBtnText.textContent = 'Crear Administrador Principal';
            document.getElementById('adminNameInput').required = true;
            document.getElementById('adminPassConfirmInput').required = true;
        } else {
            headerNormal.classList.remove('hidden');
            headerSetup.classList.add('hidden');
            setupNameGroup.classList.add('hidden');
            setupConfirmPassGroup.classList.add('hidden');
            loginBtnText.textContent = 'Iniciar Sesión';
            document.getElementById('adminNameInput').required = false;
            document.getElementById('adminPassConfirmInput').required = false;
        }

        this.refreshIcons();
    },

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        input.type = input.type === 'password' ? 'text' : 'password';
    },

    async handleAdminAuth(event) {
        event.preventDefault();
        const errorDiv = document.getElementById('loginErrorMsg');
        const errorText = document.getElementById('loginErrorText');
        const btn = document.getElementById('loginSubmitBtn');
        const btnText = document.getElementById('loginBtnText');

        errorDiv.classList.add('hidden');

        const email = document.getElementById('adminEmailInput').value;
        const pass = document.getElementById('adminPassInput').value;
        const hasAdmin = await window.picselDB.hasAdminUser();

        btn.disabled = true;
        const originalText = btnText.textContent;
        btnText.textContent = 'Verificando...';

        try {
            if (!hasAdmin) {
                const name = document.getElementById('adminNameInput').value;
                const passConfirm = document.getElementById('adminPassConfirmInput').value;

                if (pass.length < 6) {
                    throw new Error('La contraseña debe tener al menos 6 caracteres.');
                }
                if (pass !== passConfirm) {
                    throw new Error('Las contraseñas no coinciden.');
                }

                await window.picselDB.createFirstAdmin(email, pass, name);
                this.showToast('Administrador de estudio creado con éxito');
                await window.picselDB.login(email, pass);
                window.location.hash = '#/admin/dashboard';
            } else {
                await window.picselDB.login(email, pass);
                this.showToast('Sesión de estudio iniciada');
                window.location.hash = '#/admin/dashboard';
            }
        } catch (err) {
            errorDiv.classList.remove('hidden');
            errorText.textContent = err.message || 'Error en la autenticación';
        } finally {
            btn.disabled = false;
            btnText.textContent = originalText;
        }
    },

    handleLogout() {
        window.picselDB.logout();
        this.showToast('Sesión cerrada correctamente');
        window.location.hash = '#/admin/login';
    },

    // ============================================================
    // ADMIN DASHBOARD & STUDIO CMS
    // ============================================================
    async loadAdminDashboard() {
        const allAlbums = await window.picselDB.getAllAlbums();

        // Stats calculation
        const publishedCount = allAlbums.filter(a => a.status === 'published').length;
        const draftCount = allAlbums.filter(a => a.status === 'draft').length;
        const totalPhotos = allAlbums.reduce((sum, a) => sum + (a.photo_count || 0), 0);

        document.getElementById('statPublishedCount').textContent = publishedCount;
        document.getElementById('statDraftCount').textContent = draftCount;
        document.getElementById('statPhotosCount').textContent = totalPhotos;

        this.renderAdminAlbumsList(allAlbums);
    },

    handleAdminSearch(query) {
        this.adminSearchQuery = query.toLowerCase().trim();
        this.filterAndRenderAdminAlbums();
    },

    handleAdminFilterChange(status) {
        this.adminStatusFilter = status;
        this.filterAndRenderAdminAlbums();
    },

    async filterAndRenderAdminAlbums() {
        const allAlbums = await window.picselDB.getAllAlbums();
        let filtered = allAlbums;

        if (this.adminStatusFilter !== 'all') {
            filtered = filtered.filter(a => a.status === this.adminStatusFilter);
        }

        if (this.adminSearchQuery) {
            filtered = filtered.filter(a => 
                (a.title && a.title.toLowerCase().includes(this.adminSearchQuery)) ||
                (a.category && a.category.toLowerCase().includes(this.adminSearchQuery)) ||
                (a.slug && a.slug.toLowerCase().includes(this.adminSearchQuery))
            );
        }

        this.renderAdminAlbumsList(filtered);
    },

    renderAdminAlbumsList(albums) {
        const container = document.getElementById('adminAlbumsContainer');

        if (!albums || albums.length === 0) {
            container.innerHTML = `
                <div class="py-16 text-center text-stone p-6">
                    <i data-lucide="folder-search" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
                    <p class="font-mono text-sm font-semibold">No se encontraron álbumes</p>
                    <p class="font-mono text-xs text-stone mt-1">Crea un nuevo álbum con el botón superior.</p>
                </div>
            `;
            this.refreshIcons();
            return;
        }

        container.innerHTML = albums.map(album => {
            const isPublished = album.status === 'published';
            return `
                <div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-carbon/5 dark:hover:bg-warmwhite/5 transition-colors">
                    
                    <!-- Left: Thumbnail & Info -->
                    <div class="flex items-center space-x-4">
                        <img src="${album.cover_url}" onerror="this.src='https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900'" class="w-16 h-14 object-cover border border-carbon/15 dark:border-warmwhite/15 flex-shrink-0" alt="Portada">
                        <div>
                            <div class="flex items-center space-x-2.5 mb-1">
                                <h4 class="font-editorial text-lg sm:text-xl font-normal text-carbon dark:text-warmwhite uppercase">${album.title}</h4>
                                <span class="font-mono text-[10px] px-2 py-0.5 border ${
                                    isPublished 
                                    ? 'border-bronze/40 text-bronze bg-bronze/10' 
                                    : 'border-stone/30 text-stone bg-stone/10'
                                }">
                                    ${isPublished ? 'Publicado' : 'Borrador'}
                                </span>
                            </div>

                            <p class="font-mono text-xs text-stone flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>Slug: <code class="bg-carbon/5 dark:bg-warmwhite/5 px-1 py-0.5">${album.slug}</code></span>
                                <span>•</span>
                                <span>${album.category}</span>
                                <span>•</span>
                                <span>${album.photo_count || 0} fotos</span>
                                <span>•</span>
                                <span>$ ${(album.price || 4000).toLocaleString('es-AR')}</span>
                            </p>
                        </div>
                    </div>

                    <!-- Right: Action Buttons -->
                    <div class="flex items-center space-x-2 self-end md:self-auto font-mono text-xs">
                        <!-- Toggle publish/unpublish -->
                        <button onclick="app.handleTogglePublish(${album.id})" 
                                class="btn-editorial-secondary py-1 px-3 text-xs" 
                                title="${isPublished ? 'Despublicar álbum' : 'Publicar álbum'}">
                            ${isPublished ? 'Despublicar' : 'Publicar'}
                        </button>

                        <!-- Edit album -->
                        <button onclick="app.openAlbumFormModal(${album.id})" class="btn-editorial-secondary py-1 px-3 text-xs flex items-center space-x-1" title="Editar datos y fotos">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            <span>Editar</span>
                        </button>

                        <!-- View public link -->
                        <button onclick="window.location.hash = '#/album/${album.slug}'" class="p-2 border border-carbon/15 dark:border-warmwhite/15 hover:border-bronze text-stone hover:text-bronze transition-colors" title="Ver en la web pública">
                            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                        </button>

                        <!-- Delete album -->
                        <button onclick="app.handleDeleteAlbum(${album.id})" class="p-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors" title="Eliminar álbum">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>

                </div>
            `;
        }).join('');

        this.refreshIcons();
    },

    async handleTogglePublish(albumId) {
        try {
            const updated = await window.picselDB.togglePublish(albumId);
            const statusText = updated.status === 'published' ? 'publicado' : 'despublicado (en borrador)';
            this.showToast(`Álbum ${statusText} correctamente`);
            await this.loadAdminDashboard();
        } catch (error) {
            console.error(error);
            this.showToast('Error al cambiar el estado del álbum', 'error');
        }
    },

    async handleDeleteAlbum(albumId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este álbum y todas sus fotos asociadas? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await window.picselDB.deleteAlbum(albumId);
            this.showToast('Álbum eliminado permanentemente');
            await this.loadAdminDashboard();
        } catch (error) {
            console.error(error);
            this.showToast('Error al eliminar el álbum', 'error');
        }
    },

    // ============================================================
    // CREATE & EDIT ALBUM MODAL (STUDIO CMS)
    // ============================================================
    async openAlbumFormModal(albumId = null) {
        const modal = document.getElementById('albumFormModal');
        const modalTitle = document.getElementById('albumModalTitle');
        const form = document.getElementById('albumSaveForm');

        form.reset();
        this.formPhotosTemp = [];

        if (albumId) {
            // Edit mode
            modalTitle.textContent = 'Editar Álbum';
            const album = await window.picselDB.getById('albums', Number(albumId));
            if (!album) return;

            document.getElementById('formAlbumId').value = album.id;
            document.getElementById('formTitle').value = album.title;
            document.getElementById('formSlug').value = album.slug;
            document.getElementById('formDate').value = album.date;
            document.getElementById('formCategory').value = album.category || 'Fiestas';
            document.getElementById('formPrice').value = album.price || 4000;
            document.getElementById('formDesc').value = album.description || '';
            document.getElementById('formStatus').value = album.status || 'draft';
            document.getElementById('formOrder').value = album.display_order || 1;
            document.getElementById('formCoverPreview').src = album.cover_url;

            const existingPhotos = await window.picselDB.getPhotosByAlbum(album.id);
            this.formPhotosTemp = existingPhotos.map(p => ({
                id: p.id,
                url: p.url,
                alt_text: p.alt_text || '',
                isExisting: true
            }));
        } else {
            // Create mode
            modalTitle.textContent = 'Crear Nuevo Álbum';
            document.getElementById('formAlbumId').value = '';
            document.getElementById('formDate').value = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
            document.getElementById('formCoverPreview').src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=300';
            this.formPhotosTemp = [];
        }

        this.renderFormPhotosThumbnails();
        modal.classList.remove('hidden');
        this.refreshIcons();
    },

    closeAlbumFormModal() {
        document.getElementById('albumFormModal').classList.add('hidden');
    },

    autoGenerateSlug(title) {
        if (!document.getElementById('formAlbumId').value) {
            document.getElementById('formSlug').value = window.picselDB.generateSlug(title);
        }
    },

    handleCoverFileSelect(input) {
        if (input.files && input.files[0]) {
            this.compressImageFile(input.files[0], (dataUrl) => {
                document.getElementById('formCoverPreview').src = dataUrl;
            });
        }
    },

    handleGalleryFilesSelect(input) {
        if (input.files && input.files.length > 0) {
            const files = Array.from(input.files);
            let processed = 0;

            files.forEach((file) => {
                this.compressImageFile(file, (dataUrl) => {
                    this.formPhotosTemp.push({
                        url: dataUrl,
                        alt_text: file.name.replace(/\.[^/.]+$/, ''),
                        isExisting: false
                    });
                    processed++;
                    if (processed === files.length) {
                        this.renderFormPhotosThumbnails();
                        this.showToast(`${files.length} fotos procesadas`);
                    }
                });
            });
        }
    },

    // Client-side image compression using canvas
    compressImageFile(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1200;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                callback(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    renderFormPhotosThumbnails() {
        const container = document.getElementById('formPhotosThumbnails');
        const badge = document.getElementById('formPhotosCountBadge');

        badge.textContent = `${this.formPhotosTemp.length} fotos cargadas`;

        if (this.formPhotosTemp.length === 0) {
            container.innerHTML = `<p class="col-span-full text-center text-stone font-mono text-xs py-4">No hay fotos en este álbum.</p>`;
            return;
        }

        container.innerHTML = this.formPhotosTemp.map((photo, index) => `
            <div class="relative group overflow-hidden border border-carbon/15 dark:border-warmwhite/15 aspect-square bg-carbon/5">
                <img src="${photo.url}" class="w-full h-full object-cover" alt="Miniatura">
                
                <!-- Action overlay -->
                <div class="absolute inset-0 bg-carbon/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                    <button type="button" onclick="app.setFormPhotoAsCover(${index})" class="px-2 py-1 bg-bronze text-white font-mono text-[10px] font-bold" title="Hacer portada">
                        Portada
                    </button>
                    <button type="button" onclick="app.removeFormPhoto(${index})" class="px-2 py-1 bg-red-600 text-white font-mono text-[10px] font-bold" title="Eliminar foto">
                        Borrar
                    </button>
                </div>
            </div>
        `).join('');

        this.refreshIcons();
    },

    setFormPhotoAsCover(index) {
        const photo = this.formPhotosTemp[index];
        if (photo) {
            document.getElementById('formCoverPreview').src = photo.url;
            this.showToast('Portada seleccionada de la galería');
        }
    },

    removeFormPhoto(index) {
        this.formPhotosTemp.splice(index, 1);
        this.renderFormPhotosThumbnails();
    },

    async handleSaveAlbum(event) {
        event.preventDefault();
        const submitBtn = document.getElementById('formSubmitBtn');
        submitBtn.disabled = true;

        try {
            const albumId = document.getElementById('formAlbumId').value;
            const albumData = {
                title: document.getElementById('formTitle').value,
                slug: document.getElementById('formSlug').value,
                date: document.getElementById('formDate').value,
                category: document.getElementById('formCategory').value,
                price: Number(document.getElementById('formPrice').value),
                description: document.getElementById('formDesc').value,
                status: document.getElementById('formStatus').value,
                display_order: Number(document.getElementById('formOrder').value),
                cover_url: document.getElementById('formCoverPreview').src
            };

            let savedId = albumId;

            if (albumId) {
                await window.picselDB.updateAlbum(albumId, albumData);
                this.showToast('Álbum actualizado correctamente');
            } else {
                const created = await window.picselDB.createAlbum(albumData);
                savedId = created.id;
                this.showToast('Álbum creado exitosamente');
            }

            // Sync photos
            for (let i = 0; i < this.formPhotosTemp.length; i++) {
                const item = this.formPhotosTemp[i];
                if (!item.isExisting) {
                    await window.picselDB.addPhotoToAlbum(savedId, {
                        url: item.url,
                        alt_text: item.alt_text,
                        order: i + 1
                    });
                }
            }

            this.closeAlbumFormModal();
            await this.loadAdminDashboard();
        } catch (error) {
            console.error('Error al guardar álbum:', error);
            this.showToast(error.message || 'Error al guardar el álbum', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    },

    // ============================================================
    // TOAST NOTIFICATIONS
    // ============================================================
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `picsel-toast ${type}`;
        toast.innerHTML = `
            <i data-lucide="${type === 'success' ? 'check' : 'alert-circle'}" class="w-4 h-4 flex-shrink-0 text-bronze"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        this.refreshIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());