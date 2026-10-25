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
    lightboxIsZoomed: false,
    cart: [],
    formPhotosTemp: [],
    cachedAlbums: [],
    albumSearchQuery: '',
    currentCategoryFilter: 'all',
    adminSearchQuery: '',
    adminStatusFilter: 'all',
    introTimeline: null,
    isIntroPlaying: false,

    // Initialization
    async init() {
        // Initialize theme
        this.initTheme();

        // Check & Run intro animation on first load if not seen and not prefers-reduced-motion
        this.initIntroAnimation();

        // Listen for route changes
        window.addEventListener('hashchange', () => this.handleRouting());

        // Keyboard navigation (Esc to close modals or skip intro, Arrows for lightbox)
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Cerrar menú móvil al hacer clic fuera del drawer
        document.addEventListener('click', (e) => {
            const drawer = document.getElementById('mobileMenuDrawer');
            const menuBtn = document.getElementById('mobileMenuBtn');
            if (drawer && !drawer.classList.contains('hidden')) {
                if (menuBtn && (menuBtn === e.target || menuBtn.contains(e.target))) {
                    return;
                }
                if (!drawer.contains(e.target)) {
                    this.closeMobileMenu();
                }
            }
        });

        // Wait for database ready
        await window.picselDB.ensureReady();

        // Handle initial route
        this.handleRouting();

        // Refresh Lucide icons
        this.refreshIcons();

        // 3D Tilt & Micro-interacciones
        this.initTiltCards();
        this.initHeroParallax();
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
        this.showToast(isDark ? 'Modo Oscuro Carbón activado' : 'Modo Claro Marfil activado');
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
    // INTRO ENTRANCE ANIMATION (Curtain Reveal + Teal Light Beam)
    // ============================================================
    initIntroAnimation() {
        const overlay = document.getElementById('introOverlay');
        if (!overlay) return;

        const alreadySeen = sessionStorage.getItem('nt_intro_seen');
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (alreadySeen === 'true' || prefersReduced) {
            overlay.classList.add('is-hidden');
            return;
        }

        this.isIntroPlaying = true;
        this.playIntroTimeline();
    },

    playIntroTimeline() {
        const overlay = document.getElementById('introOverlay');
        const curtainTop = overlay?.querySelector('.intro-curtain-top');
        const curtainBottom = overlay?.querySelector('.intro-curtain-bottom');
        const introContent = document.getElementById('introContent');
        const beamLine = document.getElementById('introBeamLine');
        const skipBtn = document.getElementById('introSkipBtn');

        if (!overlay || !curtainTop || !curtainBottom || !introContent || !beamLine) {
            if (overlay) overlay.classList.add('is-hidden');
            return;
        }

        if (typeof gsap === 'undefined') {
            setTimeout(() => this.skipIntro(), 1400);
            return;
        }

        // Configuración inicial de estados visuales
        overlay.classList.remove('is-hidden');
        gsap.set(overlay, { display: 'flex', opacity: 1 });
        gsap.set([curtainTop, curtainBottom], { yPercent: 0 });
        gsap.set(introContent, { opacity: 0, scale: 0.94 });
        gsap.set(beamLine, { scaleX: 0 });
        if (skipBtn) gsap.set(skipBtn, { opacity: 0 });

        const tl = gsap.timeline({
            onComplete: () => {
                this.isIntroPlaying = false;
                overlay.classList.add('is-hidden');
                sessionStorage.setItem('nt_intro_seen', 'true');
                this.playHeroEntrance();
            }
        });

        this.introTimeline = tl;

        // Secuencia cinematográfica de ~1.8 segundos:
        // 1. Logo aparece suavemente con escala
        // 2. Haz de luz teal se expande desde el centro con resplandor
        // 3. Breve momento para apreciar la identidad
        // 4. Logo y haz se desvanecen
        // 5. Las cortinas de grafito se abren (arriba y abajo) revelando la web
        tl.to(introContent, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' })
          .to(beamLine, { scaleX: 1, duration: 0.5, ease: 'power3.out' }, '-=0.2')
          .to(skipBtn, { opacity: 1, duration: 0.3 }, '-=0.3')
          .to({}, { duration: 0.35 })
          .to([introContent, skipBtn], { opacity: 0, duration: 0.3, ease: 'power2.in' })
          .to(curtainTop, { yPercent: -101, duration: 0.75, ease: 'power3.inOut' }, '-=0.05')
          .to(curtainBottom, { yPercent: 101, duration: 0.75, ease: 'power3.inOut' }, '<');
    },

    skipIntro() {
        const overlay = document.getElementById('introOverlay');
        if (!overlay) return;

        if (this.introTimeline) {
            this.introTimeline.kill();
            this.introTimeline = null;
        }
        this.isIntroPlaying = false;

        const curtainTop = overlay.querySelector('.intro-curtain-top');
        const curtainBottom = overlay.querySelector('.intro-curtain-bottom');

        if (typeof gsap !== 'undefined' && curtainTop && curtainBottom) {
            gsap.to([curtainTop, curtainBottom], {
                yPercent: (i) => i === 0 ? -101 : 101,
                duration: 0.28,
                ease: 'power2.inOut',
                onComplete: () => {
                    overlay.classList.add('is-hidden');
                    sessionStorage.setItem('nt_intro_seen', 'true');
                    this.playHeroEntrance();
                }
            });
        } else {
            overlay.classList.add('is-hidden');
            sessionStorage.setItem('nt_intro_seen', 'true');
            this.playHeroEntrance();
        }
    },

    playHeroEntrance() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (typeof gsap === 'undefined') return;

        const hero = document.getElementById('viewPublicPortfolio');
        if (hero && !hero.classList.contains('hidden')) {
            gsap.fromTo('#mainHeader', 
                { y: -20, opacity: 0 }, 
                { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }
            );
            gsap.fromTo('#viewPublicPortfolio h1, #viewPublicPortfolio p, .editorial-hero-container',
                { y: 25, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.65, stagger: 0.08, ease: 'power3.out' }
            );
        }
    },

    // ============================================================
    // ROUTING & VIEW CONTROLLER
    // ============================================================
    async handleRouting() {
        this.closeMobileMenu();
        const hash = window.location.hash || '#/';

        // 1. Manejo de anclas a secciones internas del portafolio
        if (hash === '#comoFuncionaSection' || hash === '#albumsSection' || hash === '#heroSection') {
            const wasOtherView = this.currentView !== 'publicPortfolio';
            
            document.getElementById('viewAlbumDetails').classList.add('hidden');
            document.getElementById('viewAdminLogin').classList.add('hidden');
            document.getElementById('viewAdminDashboard').classList.add('hidden');
            document.getElementById('viewPublicPortfolio').classList.remove('hidden');

            this.currentView = 'publicPortfolio';
            document.title = 'Nicolas Techeira Fotografías';

            if (wasOtherView || !this.cachedAlbums || this.cachedAlbums.length === 0) {
                await this.loadPublicAlbums();
            }

            const targetId = hash.replace('#', '');
            setTimeout(() => {
                this.smoothScrollToId(targetId);
            }, wasOtherView ? 150 : 50);

            this.refreshIcons();
            return;
        }

        // 2. Rutas principales de la aplicación
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } 
        // Route: Album details (#/album/slug-name)
        else if (hash.startsWith('#/album/')) {
            const slug = hash.replace('#/album/', '');
            this.currentView = 'albumDetails';
            document.getElementById('viewAlbumDetails').classList.remove('hidden');
            await this.loadAlbumDetails(slug);
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } 
        else {
            window.location.hash = '#/';
        }

        this.refreshIcons();
    },

    navigateToSection(sectionId, event) {
        if (event) {
            event.preventDefault();
        }

        // Si estamos en otra vista (ej: detalle de álbum o admin), cambiar primero a la vista pública
        if (this.currentView !== 'publicPortfolio') {
            window.location.hash = sectionId === 'top' ? '#/' : `#${sectionId}`;
            return;
        }

        // Si ya estamos en la vista pública, hacer scroll suave directo
        this.smoothScrollToId(sectionId);
    },

    smoothScrollToId(sectionId) {
        if (!sectionId || sectionId === 'top') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const el = document.getElementById(sectionId);
        if (el) {
            const header = document.getElementById('mainHeader');
            const headerHeight = header ? header.offsetHeight : 80;
            const elementPosition = el.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 16;

            window.scrollTo({
                top: Math.max(0, offsetPosition),
                behavior: 'smooth'
            });
        }
    },

    goHome() {
        this.closeMobileMenu();
        window.location.hash = '#/';
    },

    toggleMobileMenu(event) {
        if (event) {
            if (typeof event.stopPropagation === 'function') event.stopPropagation();
            if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        const drawer = document.getElementById('mobileMenuDrawer');
        const icon = document.getElementById('mobileMenuIcon');
        const btn = document.getElementById('mobileMenuBtn');
        if (!drawer) return;

        const isHidden = drawer.classList.contains('hidden');
        if (isHidden) {
            drawer.classList.remove('hidden');
            if (btn) btn.setAttribute('aria-expanded', 'true');
            if (icon) {
                icon.setAttribute('data-lucide', 'x');
                this.refreshIcons();
            }
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(drawer, 
                    { opacity: 0, y: -10 }, 
                    { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
                );
            }
        } else {
            this.closeMobileMenu();
        }
    },

    closeMobileMenu() {
        const drawer = document.getElementById('mobileMenuDrawer');
        const icon = document.getElementById('mobileMenuIcon');
        const btn = document.getElementById('mobileMenuBtn');
        if (!drawer || drawer.classList.contains('hidden')) return;

        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (icon) {
            icon.setAttribute('data-lucide', 'menu');
            this.refreshIcons();
        }
        drawer.classList.add('hidden');
    },

    // ============================================================
    // PUBLIC PORTFOLIO LOGIC — EDITORIAL ASYMMETRIC SHOWCASE
    // ============================================================
    handleAlbumSearch(query) {
        this.albumSearchQuery = (query || '').toLowerCase().trim();
        this.renderFilteredAlbums();
    },

    renderFilteredAlbums() {
        const grid = document.getElementById('albumsGrid');
        if (!grid || !this.cachedAlbums) return;

        let filtered = this.cachedAlbums;

        // Filtro por categoría activa
        if (this.currentCategoryFilter && this.currentCategoryFilter !== 'all') {
            filtered = filtered.filter(a => a.category && a.category.toLowerCase() === this.currentCategoryFilter.toLowerCase());
        }

        // Filtro por texto de búsqueda
        if (this.albumSearchQuery) {
            filtered = filtered.filter(a => 
                (a.title && a.title.toLowerCase().includes(this.albumSearchQuery)) ||
                (a.date && a.date.toLowerCase().includes(this.albumSearchQuery)) ||
                (a.category && a.category.toLowerCase().includes(this.albumSearchQuery)) ||
                (a.description && a.description.toLowerCase().includes(this.albumSearchQuery))
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white dark:bg-charcoal-surface border border-charcoal/10 dark:border-ivory/10 p-8 shadow-sm">
                    <i data-lucide="search-x" class="w-10 h-10 text-stone mx-auto mb-3 opacity-60"></i>
                    <h4 class="font-editorial text-2xl text-charcoal dark:text-ivory mb-1">Sin colecciones encontradas</h4>
                    <p class="text-xs text-stone">No se encontraron álbumes que coincidan con "${this.albumSearchQuery || this.currentCategoryFilter}".</p>
                </div>
            `;
            this.refreshIcons();
            return;
        }

        grid.innerHTML = filtered.map((album, index) => {
            const indexFormatted = String(index + 1).padStart(2, '0');
            return `
                <article onclick="window.location.hash = '#/album/${album.slug}'" 
                         class="album-card-editorial group cursor-pointer tilt-card"
                         data-tilt>
                    <div class="tilt-card-glare"></div>
                    
                    <!-- Contenedor de la Imagen con Ratio Editorial 4:3 -->
                    <div class="image-wrap aspect-[4/3] relative overflow-hidden bg-charcoal/5 dark:bg-ivory/5">
                        <img src="${album.cover_url}" 
                             alt="${album.title}" 
                             loading="lazy" 
                             onerror="this.src='https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900'"
                             class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700">
                        
                        <!-- Insignia Editorial en Esquina Superior -->
                        <div class="editorial-album-badge">
                            <span class="badge-index">${indexFormatted}</span>
                            <span class="badge-cat">${album.category || 'Fiestas'}</span>
                        </div>

                        <!-- Contador de Fotos en Esquina Inferior -->
                        <span class="absolute bottom-3 right-3 bg-charcoal/90 text-ivory text-[11px] font-mono px-2.5 py-1 flex items-center space-x-1.5 border border-ivory/10 shadow-md backdrop-blur-sm">
                            <i data-lucide="camera" class="w-3 h-3 text-bronze"></i>
                            <span>${album.photo_count || 0} fotos</span>
                        </span>
                    </div>

                    <!-- Pie de la Tarjeta Editorial -->
                    <div class="p-5 border-t border-charcoal/10 dark:border-ivory/10 flex flex-col justify-between flex-1 bg-white dark:bg-charcoal-surface">
                        <div>
                            <h3 class="font-editorial text-xl sm:text-2xl font-normal text-charcoal dark:text-ivory group-hover:text-bronze transition-colors uppercase tracking-tight mb-1">
                                ${album.title}
                            </h3>
                            <p class="text-xs text-stone">
                                ${album.date || 'Reciente'}
                            </p>
                        </div>
                        
                        <div class="pt-4 flex items-center justify-between text-xs border-t border-charcoal/5 dark:border-ivory/5 mt-3">
                            <span class="text-stone">Precio ref.</span>
                            <span class="font-bold text-charcoal dark:text-ivory font-editorial text-base">$ ${Number(album.price || 4000).toLocaleString('es-AR')}</span>
                        </div>
                    </div>

                </article>
            `;
        }).join('');

        this.refreshIcons();
        this.initTiltCards();

        if (typeof gsap !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.fromTo('.album-card-editorial', 
                { opacity: 0, y: 20 }, 
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out' }
            );
        }
    },

    async loadPublicAlbums(filterCategory = 'all') {
        this.currentCategoryFilter = filterCategory;
        const grid = document.getElementById('albumsGrid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="col-span-full text-center py-20">
                <div class="inline-block w-8 h-8 border-2 border-bronze border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-xs uppercase tracking-widest text-stone">Cargando colecciones fotográficas...</p>
            </div>
        `;

        try {
            const albums = await window.picselDB.getPublishedAlbums();
            this.cachedAlbums = albums || [];
            this.renderFilteredAlbums();
        } catch (error) {
            console.error('Error al cargar colecciones:', error);
            grid.innerHTML = `
                <div class="col-span-full text-center py-16 text-red-500 text-xs">
                    <p>Ocurrió un error al cargar las colecciones desde la base de datos.</p>
                </div>
            `;
        }
    },

    filterByCategory(category) {
        this.currentCategoryFilter = category;
        document.querySelectorAll('.category-tab-editorial').forEach(btn => {
            const btnCat = btn.getAttribute('data-category');
            if (btnCat === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderFilteredAlbums();
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
        this.updateAlbumSelectionBadge();
        this.refreshIcons();
    },

    selectAllPhotos() {
        const photos = this.currentFilteredPhotos || this.currentAlbumPhotos;
        if (!photos || photos.length === 0) return;

        let addedCount = 0;
        photos.forEach(photo => {
            const alreadyIn = this.cart.some(item => String(item.id) === String(photo.id));
            if (!alreadyIn) {
                this.cart.push({
                    id: photo.id,
                    url: photo.url,
                    albumTitle: this.currentAlbum ? this.currentAlbum.title : 'Evento',
                    price: this.currentAlbum ? this.currentAlbum.price : 4000
                });
                addedCount++;
            }
        });

        this.updateCartUI();
        this.renderAlbumPhotos(photos);
        this.showToast(`Se agregaron ${addedCount > 0 ? addedCount : 'todas las'} fotos a tu selección`);
    },

    deselectAllPhotos() {
        const photos = this.currentFilteredPhotos || this.currentAlbumPhotos;
        if (!photos || photos.length === 0) return;

        const photoIdSet = new Set(photos.map(p => String(p.id)));
        this.cart = this.cart.filter(item => !photoIdSet.has(String(item.id)));

        this.updateCartUI();
        this.renderAlbumPhotos(photos);
        this.showToast('Se removieron las fotos de este álbum de la selección');
    },

    updateAlbumSelectionBadge() {
        const badge = document.getElementById('albumSelectedCountBadge');
        if (!badge || !this.currentAlbum || !this.currentAlbumPhotos) return;

        const albumPhotoIds = new Set(this.currentAlbumPhotos.map(p => String(p.id)));
        const selectedCount = this.cart.filter(item => albumPhotoIds.has(String(item.id))).length;

        if (selectedCount > 0) {
            badge.classList.remove('hidden');
            badge.textContent = `${selectedCount} seleccionada${selectedCount > 1 ? 's' : ''}`;
        } else {
            badge.classList.add('hidden');
        }
    },

    renderAlbumPhotos(photos) {
        const grid = document.getElementById('albumPhotosGrid');

        if (!photos || photos.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20 bg-white dark:bg-charcoal-surface border border-charcoal/10 dark:border-ivory/10 p-10">
                    <i data-lucide="image" class="w-10 h-10 text-stone mx-auto mb-3 opacity-60"></i>
                    <h4 class="font-editorial text-2xl text-charcoal dark:text-ivory mb-1">Colección sin fotografías</h4>
                    <p class="text-xs text-stone">El fotógrafo aún no ha subido fotos a este álbum.</p>
                </div>
            `;
            this.refreshIcons();
            return;
        }

        grid.innerHTML = photos.map((photo, index) => {
            const inCart = this.cart.some(item => String(item.id) === String(photo.id));
            return `
                <div class="masonry-item group bg-white dark:bg-charcoal-surface">
                    
                    <!-- Checkbox visible de Selección Rápida -->
                    <button type="button" 
                            onclick="app.toggleCartPhoto('${photo.id}', event)" 
                            class="photo-select-checkbox ${inCart ? 'selected' : ''}" 
                            title="${inCart ? 'Quitar de mi selección' : 'Agregar a mi selección'}"
                            aria-label="Seleccionar foto #${index + 1}">
                        <i data-lucide="${inCart ? 'check' : 'plus'}"></i>
                    </button>

                    <!-- Contenedor de la foto con protección y lightbox -->
                    <div class="relative overflow-hidden cursor-pointer" onclick="app.openLightbox(${index})">
                        <img src="${photo.url}" 
                             alt="${photo.alt_text || 'Fotografía de Nicolás Techeira'}" 
                             loading="lazy" 
                             oncontextmenu="return false;" 
                             ondragstart="return false;"
                             class="w-full h-auto object-cover group-hover:scale-[1.03] transition-transform duration-700 protected-photo">
                        
                        <!-- Marca de Agua Nicolas Techeira -->
                        <div class="picsel-watermark-overlay">
                            <span class="picsel-watermark-text">Nicolas Techeira</span>
                            <span class="picsel-watermark-subtext">Vista Previa · Oberá</span>
                        </div>

                        <!-- Zoom hint icon -->
                        <div class="absolute top-2.5 left-2.5 w-8 h-8 rounded-full bg-charcoal/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border border-white/20">
                            <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                        </div>
                    </div>

                    <!-- Pie de la tarjeta -->
                    <div class="p-3 flex items-center justify-between border-t border-charcoal/10 dark:border-ivory/10 bg-white dark:bg-charcoal-surface text-xs">
                        <span class="font-mono text-stone text-[11px]">#${index + 1}</span>
                        <button onclick="app.toggleCartPhoto('${photo.id}', event)" 
                                class="text-[11px] font-medium py-1 px-2.5 transition-all flex items-center space-x-1.5 ${
                                    inCart 
                                    ? 'btn-editorial-bronze' 
                                    : 'btn-editorial-secondary'
                                }">
                            <i data-lucide="${inCart ? 'check' : 'shopping-bag'}" class="w-3 h-3"></i>
                            <span>${inCart ? 'Seleccionada' : '+ Agregar'}</span>
                        </button>
                    </div>

                </div>
            `;
        }).join('');

        this.updateAlbumSelectionBadge();
        this.refreshIcons();
    },

    // ============================================================
    // LIGHTBOX VIEWER — FULLSCREEN CINEMATOGRAPHIC CON ZOOM & SWIPE
    // ============================================================
    openLightbox(index) {
        const photos = this.currentFilteredPhotos || this.currentAlbumPhotos;
        if (!photos || photos.length === 0) return;

        this.lightboxIndex = index;
        const photo = photos[index];

        const modal = document.getElementById('lightboxModal');
        const img = document.getElementById('lightboxImg');
        const indexText = document.getElementById('lightboxIndexText');
        const albumTitleText = document.getElementById('lightboxAlbumTitle');
        const cartBtn = document.getElementById('lightboxAddCartBtn');
        const viewport = document.getElementById('lightboxViewport');

        // Resetear estado de zoom
        this.lightboxIsZoomed = false;
        if (viewport) viewport.classList.remove('is-zoomed');
        const zoomText = document.getElementById('lightboxZoomText');
        const zoomIcon = document.getElementById('lightboxZoomIcon');
        if (zoomText) zoomText.textContent = 'Zoom';
        if (zoomIcon) zoomIcon.setAttribute('data-lucide', 'zoom-in');

        img.src = photo.url;
        if (albumTitleText) {
            albumTitleText.textContent = (this.currentAlbum && this.currentAlbum.title) || 'Colección';
        }
        if (indexText) {
            indexText.textContent = `[ FOTO ${index + 1} / ${photos.length} ]`;
        }

        const inCart = this.cart.some(item => String(item.id) === String(photo.id));
        if (cartBtn) {
            cartBtn.innerHTML = `
                <i data-lucide="${inCart ? 'check' : 'shopping-bag'}" class="w-4 h-4"></i>
                <span>${inCart ? 'Quitar de Selección' : '+ Agregar a Selección'}</span>
            `;
            cartBtn.className = inCart 
                ? 'btn-editorial-primary text-xs py-2.5 px-6 shadow-xl w-full sm:w-auto flex items-center justify-center space-x-2'
                : 'btn-editorial-bronze text-xs py-2.5 px-6 shadow-xl w-full sm:w-auto flex items-center justify-center space-x-2';
        }

        modal.classList.remove('hidden');
        this.initLightboxTouchEvents();
        this.refreshIcons();
    },

    toggleLightboxZoom(event) {
        if (event) event.stopPropagation();
        const viewport = document.getElementById('lightboxViewport');
        const zoomText = document.getElementById('lightboxZoomText');
        const zoomIcon = document.getElementById('lightboxZoomIcon');
        
        this.lightboxIsZoomed = !this.lightboxIsZoomed;
        if (this.lightboxIsZoomed) {
            if (viewport) viewport.classList.add('is-zoomed');
            if (zoomText) zoomText.textContent = '1x';
            if (zoomIcon) zoomIcon.setAttribute('data-lucide', 'zoom-out');
        } else {
            if (viewport) viewport.classList.remove('is-zoomed');
            if (zoomText) zoomText.textContent = 'Zoom';
            if (zoomIcon) zoomIcon.setAttribute('data-lucide', 'zoom-in');
        }
        this.refreshIcons();
    },

    initLightboxTouchEvents() {
        const viewport = document.getElementById('lightboxViewport');
        if (!viewport || viewport.dataset.touchInit === 'true') return;
        viewport.dataset.touchInit = 'true';

        let touchStartX = 0;
        let touchStartY = 0;

        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        viewport.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const diffX = touchEndX - touchStartX;
                const diffY = touchEndY - touchStartY;

                if (!this.lightboxIsZoomed) {
                    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
                        if (diffX < 0) {
                            this.nextLightboxPhoto();
                        } else {
                            this.prevLightboxPhoto();
                        }
                    } else if (diffY > 80 && Math.abs(diffY) > Math.abs(diffX)) {
                        this.closeLightbox();
                    }
                }
            }
        }, { passive: true });
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
            if (this.isIntroPlaying) {
                this.skipIntro();
                return;
            }
            this.closeMobileMenu();
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
    // SHOPPING CART, PACK DISCOUNTS & MERCADO PAGO CHECKOUT
    // ============================================================
    calculateCartTotals() {
        const count = this.cart.length;
        const subtotal = this.cart.reduce((sum, item) => sum + (Number(item.price) || 4000), 0);
        
        // Detección de pack completo (si selecciona todas las fotos de un álbum con al menos 4 fotos, o >= 20 fotos)
        const isFullAlbum = Boolean(
            this.currentAlbumPhotos && 
            this.currentAlbumPhotos.length >= 4 && 
            this.cart.length >= this.currentAlbumPhotos.length
        );

        let discountRate = 0;
        let discountLabel = '';

        if (count >= 20 || isFullAlbum) {
            discountRate = 0.35;
            discountLabel = 'Pack Colección Completa (35% OFF)';
        } else if (count >= 10) {
            discountRate = 0.25;
            discountLabel = 'Pack 10 Fotos (25% OFF)';
        } else if (count >= 5) {
            discountRate = 0.15;
            discountLabel = 'Pack 5 Recuerdos (15% OFF)';
        }

        const discountAmount = Math.round(subtotal * discountRate);
        const total = Math.max(0, subtotal - discountAmount);

        return {
            count,
            subtotal,
            discountRate,
            discountLabel,
            discountAmount,
            total,
            isFullAlbum
        };
    },

    animateFlyToCart(originEl, imgUrl) {
        if (!originEl || !imgUrl) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const targetEl = document.getElementById('headerCartBtn') || document.getElementById('floatingCartBar');
        if (!targetEl) return;

        const startRect = originEl.getBoundingClientRect();
        const endRect = targetEl.getBoundingClientRect();

        const ghost = document.createElement('img');
        ghost.src = imgUrl;
        ghost.className = 'fly-to-cart-ghost';
        ghost.style.left = `${startRect.left}px`;
        ghost.style.top = `${startRect.top}px`;
        ghost.style.width = `${startRect.width}px`;
        ghost.style.height = `${startRect.height}px`;
        document.body.appendChild(ghost);

        const targetX = endRect.left + endRect.width / 2 - startRect.width / 2;
        const targetY = endRect.top + endRect.height / 2 - startRect.height / 2;

        if (typeof gsap !== 'undefined') {
            gsap.to(ghost, {
                duration: 0.65,
                x: targetX - startRect.left,
                y: targetY - startRect.top,
                scale: 0.15,
                opacity: 0.3,
                ease: 'power2.inOut',
                onComplete: () => {
                    ghost.remove();
                    targetEl.classList.add('cart-pulse-active');
                    setTimeout(() => targetEl.classList.remove('cart-pulse-active'), 500);
                }
            });
        } else {
            ghost.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            requestAnimationFrame(() => {
                ghost.style.transform = `translate(${targetX - startRect.left}px, ${targetY - startRect.top}px) scale(0.15)`;
                ghost.style.opacity = '0.3';
                setTimeout(() => {
                    ghost.remove();
                    targetEl.classList.add('cart-pulse-active');
                    setTimeout(() => targetEl.classList.remove('cart-pulse-active'), 500);
                }, 600);
            });
        }
    },

    toggleCartPhoto(photoId, event) {
        if (event) event.stopPropagation();

        const photo = this.currentAlbumPhotos.find(p => String(p.id) === String(photoId));
        if (!photo) return;

        const existingIdx = this.cart.findIndex(item => String(item.id) === String(photoId));
        if (existingIdx >= 0) {
            this.cart.splice(existingIdx, 1);
            this.showToast('Foto removida de tu selección');
        } else {
            this.cart.push({
                id: photo.id,
                url: photo.url,
                albumTitle: this.currentAlbum ? this.currentAlbum.title : 'Evento',
                price: this.currentAlbum ? this.currentAlbum.price : 4000
            });

            // Animación visual de vuelo al carrito
            let originEl = null;
            if (event && event.target) {
                originEl = event.target.closest('.masonry-item')?.querySelector('img') || event.target;
            } else {
                originEl = document.getElementById('lightboxImg');
            }
            if (originEl) {
                this.animateFlyToCart(originEl, photo.url);
            }

            const totals = this.calculateCartTotals();
            if (totals.discountRate > 0) {
                this.showToast(`¡Foto agregada! ${totals.discountLabel} activo`, 'success');
            } else {
                this.showToast('Foto agregada a tu selección');
            }
        }

        this.updateCartUI();
        if (this.currentAlbum) {
            this.renderAlbumPhotos(this.currentFilteredPhotos || this.currentAlbumPhotos);
        }
    },

    updateCartUI() {
        const totals = this.calculateCartTotals();
        const count = totals.count;

        // Botón e insignia del Header
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

        // Barra flotante inferior
        const floatingBar = document.getElementById('floatingCartBar');
        const floatingCount = document.getElementById('floatingCartCount');
        const floatingTotal = document.getElementById('floatingCartTotal');

        if (count > 0 && this.currentView === 'albumDetails') {
            floatingBar.classList.remove('hidden');
            floatingCount.textContent = count;
            floatingTotal.textContent = `$ ${totals.total.toLocaleString('es-AR')}`;
        } else {
            floatingBar.classList.add('hidden');
        }

        // Subtotal, Descuentos y Total en Cart Modal
        const subtotalEl = document.getElementById('cartSubtotalSum');
        const totalEl = document.getElementById('cartTotalSum');
        const discountRow = document.getElementById('cartDiscountRow');
        const discountLabel = document.getElementById('cartDiscountLabel');
        const discountAmount = document.getElementById('cartDiscountAmount');
        const savingsBadge = document.getElementById('cartDiscountSavingsBadge');
        const goalText = document.getElementById('cartDiscountGoalText');
        const progressBar = document.getElementById('cartPackProgressBar');

        if (subtotalEl) subtotalEl.textContent = `$ ${totals.subtotal.toLocaleString('es-AR')}`;
        if (totalEl) totalEl.textContent = `$ ${totals.total.toLocaleString('es-AR')}`;

        if (discountRow) {
            if (totals.discountAmount > 0) {
                discountRow.classList.remove('hidden');
                if (discountLabel) discountLabel.textContent = totals.discountLabel;
                if (discountAmount) discountAmount.textContent = `-$ ${totals.discountAmount.toLocaleString('es-AR')}`;
                if (savingsBadge) {
                    savingsBadge.classList.remove('hidden');
                    savingsBadge.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3"></i><span>${Math.round(totals.discountRate * 100)}% OFF</span>`;
                }
            } else {
                discountRow.classList.add('hidden');
                if (savingsBadge) savingsBadge.classList.add('hidden');
            }
        }

        // Barra interactiva de progreso de packs
        if (progressBar && goalText) {
            let progressPercent = 0;
            if (count === 0) {
                progressPercent = 0;
                goalText.textContent = '¡Sumá 5 fotos para activar 15% OFF!';
            } else if (count < 5) {
                progressPercent = (count / 5) * 33.3;
                const diff = 5 - count;
                goalText.textContent = `Sumá ${diff} foto${diff > 1 ? 's' : ''} más para activar 15% OFF`;
            } else if (count < 10) {
                progressPercent = 33.3 + ((count - 5) / 5) * 33.3;
                const diff = 10 - count;
                goalText.textContent = `¡15% OFF activo! Sumá ${diff} foto${diff > 1 ? 's' : ''} más para 25% OFF`;
            } else if (count < 20) {
                progressPercent = 66.6 + Math.min(1, (count - 10) / 10) * 33.4;
                const diff = 20 - count;
                goalText.textContent = `¡25% OFF activo! Sumá ${diff} más para Pack Completo (35% OFF)`;
            } else {
                progressPercent = 100;
                goalText.textContent = '¡Máximo beneficio! 35% OFF aplicado en tu compra';
            }
            progressBar.style.width = `${progressPercent}%`;
        }

        // Píldoras indicadoras de nivel
        const pill5 = document.getElementById('pillTier5');
        const pill10 = document.getElementById('pillTier10');
        const pillAll = document.getElementById('pillTierAll');

        if (pill5) pill5.classList.toggle('active', count >= 5 && count < 10);
        if (pill10) pill10.classList.toggle('active', count >= 10 && count < 20);
        if (pillAll) pillAll.classList.toggle('active', count >= 20 || totals.isFullAlbum);

        this.updateAlbumSelectionBadge();
        this.refreshIcons();
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
                            <p class="font-editorial text-base font-semibold text-charcoal dark:text-ivory uppercase">${item.albumTitle}</p>
                            <p class="font-mono text-[11px] text-stone">Descarga original sin marca</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="font-mono text-xs font-bold text-charcoal dark:text-ivory">$ ${(Number(item.price) || 4000).toLocaleString('es-AR')}</span>
                        <button onclick="app.removeCartItem(${index})" class="text-stone hover:text-red-500 p-1" title="Eliminar foto">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('cartModal').classList.remove('hidden');
        this.updateCartUI();
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

    orderViaWhatsApp() {
        if (this.cart.length === 0) {
            this.showToast('La selección está vacía', 'error');
            return;
        }

        const totals = this.calculateCartTotals();
        const albumName = (this.cart[0] && this.cart[0].albumTitle) || (this.currentAlbum && this.currentAlbum.title) || 'Colección';

        let message = `¡Hola Nicolás! Quiero encargar ${totals.count} fotografía(s) de la colección "${albumName}".\n\n`;
        message += `📋 Detalle del pedido:\n`;
        message += `• Cantidad: ${totals.count} fotos\n`;
        message += `• Subtotal: $ ${totals.subtotal.toLocaleString('es-AR')} ARS\n`;
        if (totals.discountAmount > 0) {
            message += `• Descuento: ${totals.discountLabel} (-$ ${totals.discountAmount.toLocaleString('es-AR')} ARS)\n`;
        }
        message += `• TOTAL A ABONAR: $ ${totals.total.toLocaleString('es-AR')} ARS\n\n`;
        message += `¿Cómo coordinamos el pago y el envío de los archivos originales en máxima calidad? ¡Muchas gracias!`;

        const waUrl = `https://wa.me/5493755284134?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
        this.closeCartModal();
        this.showToast('Abriendo WhatsApp para coordinar el pedido...');
    },

    async handleMercadoPagoCheckout() {
        if (this.cart.length === 0) {
            this.showToast('La selección está vacía', 'error');
            return;
        }

        const btn = document.getElementById('btnMpCheckout');
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Conectando...</span>`;
        }

        try {
            const isFullAlbum = Boolean(
                this.currentAlbumPhotos && 
                this.cart.length >= this.currentAlbumPhotos.length
            );

            const orderData = {
                items: this.cart,
                albumId: this.currentAlbum ? this.currentAlbum.id : null,
                customerName: 'Cliente Nicolas Techeira',
                customerEmail: 'cliente@estudio.com',
                isFullAlbum
            };

            const result = await window.picselDB.createCheckoutPreference(orderData);

            this.closeCartModal();

            // Si Mercado Pago devolvió URL de pago, abrirla
            if (result && result.initPoint) {
                window.open(result.initPoint, '_blank');
            }

            // Mostrar modal de confirmación con acceso inmediato a descargas
            this.openOrderSuccessModal(result);

            // Vaciar carrito tras la orden
            this.cart = [];
            this.updateCartUI();
            if (this.currentAlbum) {
                this.renderAlbumPhotos(this.currentFilteredPhotos || this.currentAlbumPhotos);
            }
        } catch (err) {
            console.error('Error al procesar checkout:', err);
            this.showToast('Error al conectar con la pasarela de pagos', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    },

    openOrderSuccessModal(orderData) {
        const modal = document.getElementById('orderSuccessModal');
        const numberEl = document.getElementById('orderSuccessNumber');
        const listEl = document.getElementById('orderDownloadsList');
        if (!modal) return;

        this.lastOrderData = orderData;
        if (numberEl) numberEl.textContent = orderData.orderNumber || 'NT-2026';

        if (listEl) {
            const items = orderData.items || [];
            listEl.innerHTML = items.map((item, idx) => `
                <div class="py-2.5 flex items-center justify-between text-xs">
                    <div class="flex items-center space-x-3">
                        <img src="${item.url}" class="w-10 h-10 object-cover border border-carbon/10 rounded-sm" alt="Miniatura">
                        <div>
                            <span class="font-medium text-charcoal dark:text-ivory block uppercase text-[11px]">Fotografía #${idx + 1}</span>
                            <span class="text-stone text-[10px]">JPEG Original · Alta Definición</span>
                        </div>
                    </div>
                    <button type="button" 
                            onclick="app.downloadSinglePhoto('${orderData.token}', '${item.id}', '${item.url}')" 
                            class="btn-editorial-secondary py-1 px-3 text-xs flex items-center space-x-1">
                        <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        <span>Descargar</span>
                    </button>
                </div>
            `).join('');
        }

        modal.classList.remove('hidden');
        this.refreshIcons();
    },

    closeOrderSuccessModal() {
        const modal = document.getElementById('orderSuccessModal');
        if (modal) modal.classList.add('hidden');
    },

    downloadSinglePhoto(token, photoId, url) {
        if (token && !token.startsWith('nt-')) {
            window.open(`/api/downloads/${token}/${photoId}`, '_blank');
            return;
        }

        const a = document.createElement('a');
        a.href = url;
        a.download = `NicolasTecheira-Foto-${photoId || Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.showToast('Descarga iniciada');
    },

    downloadAllPurchased() {
        if (!this.lastOrderData || !this.lastOrderData.items) return;
        const items = this.lastOrderData.items;
        const token = this.lastOrderData.token;

        this.showToast(`Iniciando descarga de ${items.length} fotos...`);
        items.forEach((item, index) => {
            setTimeout(() => {
                this.downloadSinglePhoto(token, item.id, item.url);
            }, index * 400);
        });
    },

    // ============================================================
    // 3D TILT EFFECT & PARALLAX MICRO-INTERACTIONS
    // ============================================================
    initTiltCards() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

        const cards = document.querySelectorAll('[data-tilt]');
        cards.forEach(card => {
            if (card.dataset.tiltInitialized === 'true') return;
            card.dataset.tiltInitialized = 'true';

            const glare = card.querySelector('.tilt-card-glare');

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;

                const rotateX = -y * 12;
                const rotateY = x * 12;

                card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;

                if (glare) {
                    const glareX = ((e.clientX - rect.left) / rect.width) * 100;
                    const glareY = ((e.clientY - rect.top) / rect.height) * 100;
                    glare.style.setProperty('--glare-x', `${glareX.toFixed(1)}%`);
                    glare.style.setProperty('--glare-y', `${glareY.toFixed(1)}%`);
                }
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            });
        });
    },

    initHeroParallax() {
        const heroSection = document.getElementById('heroSection');
        const heroImg = document.getElementById('heroFeaturedImg');
        if (!heroSection || !heroImg) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            if (typeof gsap !== 'undefined') {
                gsap.to(heroImg, {
                    duration: 0.8,
                    x: x * 16,
                    y: y * 16,
                    ease: 'power1.out'
                });
            }
        });

        heroSection.addEventListener('mouseleave', () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(heroImg, {
                    duration: 0.8,
                    x: 0,
                    y: 0,
                    ease: 'power1.out'
                });
            }
        });
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
                        <button onclick="app.handleTogglePublish('${album.id}')" 
                                class="btn-editorial-secondary py-1 px-3 text-xs" 
                                title="${isPublished ? 'Despublicar álbum' : 'Publicar álbum'}">
                            ${isPublished ? 'Despublicar' : 'Publicar'}
                        </button>

                        <!-- Edit album -->
                        <button onclick="app.openAlbumFormModal('${album.id}')" class="btn-editorial-secondary py-1 px-3 text-xs flex items-center space-x-1" title="Editar datos y fotos">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            <span>Editar</span>
                        </button>

                        <!-- View public link -->
                        <button onclick="window.location.hash = '#/album/${album.slug}'" class="p-2 border border-carbon/15 dark:border-warmwhite/15 hover:border-bronze text-stone hover:text-bronze transition-colors" title="Ver en la web pública">
                            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                        </button>

                        <!-- Delete album -->
                        <button onclick="app.handleDeleteAlbum('${album.id}')" class="p-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors" title="Eliminar álbum">
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
            const album = await window.picselDB.getAlbumById(albumId);
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
            }, true);
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
                        this.showToast(`${files.length} fotos procesadas con marca de agua`);
                    }
                }, false);
            });
        }
    },

    // Client-side image compression & pixel-embedded watermark using canvas
    compressImageFile(file, callback, isCover = false) {
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

                // Grabar marca de agua en píxeles para previews de galería
                if (!isCover) {
                    this.applyCanvasWatermark(ctx, width, height);
                }

                const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                callback(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    applyCanvasWatermark(ctx, width, height) {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.font = `600 ${Math.max(18, Math.round(width * 0.040))}px 'Space Grotesk', -apple-system, sans-serif`;
        ctx.fillStyle = 'rgba(232, 238, 240, 0.42)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(14, 17, 20, 0.6)';
        ctx.shadowBlur = 8;
        ctx.fillText('NICOLAS TECHEIRA · VISTA PREVIA', 0, 0);

        ctx.font = `500 ${Math.max(10, Math.round(width * 0.016))}px 'Inter', sans-serif`;
        ctx.fillStyle = 'rgba(45, 212, 191, 0.45)';
        ctx.fillText('OBERÁ, MISIONES · COBERTURA OFICIAL', 0, Math.round(width * 0.038));
        ctx.restore();
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

            // Sync photos (detección de fotos eliminadas y alta de nuevas)
            if (albumId) {
                const existingPhotos = await window.picselDB.getPhotosByAlbum(albumId);
                const currentIds = new Set(this.formPhotosTemp.filter(p => p.isExisting).map(p => String(p.id)));
                for (const oldPhoto of existingPhotos) {
                    if (!currentIds.has(String(oldPhoto.id))) {
                        await window.picselDB.deletePhoto(oldPhoto.id);
                    }
                }
            }

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