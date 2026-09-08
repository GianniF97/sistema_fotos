// script.js (Código completo corregido para PixelFlow con pestañas de creación y gestión de álbumes)
const API_URL = "https://sistema-fotos-backend.onrender.com";

const app = {
    init() {
        this.loadAlbums();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    async loadAlbums() {
        const grid = document.getElementById('albumsGrid');
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-slate-400 text-sm">Cargando álbumes desde Supabase...</p>
            </div>
        `;

        try {
            const response = await fetch(`${API_URL}/api/albums`);
            if (!response.ok) throw new Error("Error al obtener los álbumes");
            const albums = await response.json();

            if (!albums || albums.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-12 text-slate-400">
                        <p>No hay álbumes registrados en la base de datos.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = albums.map(album => `
                <div class="group relative bg-cardBg rounded-3xl overflow-hidden border border-slate-800/80 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer">
                    <div class="relative h-64 overflow-hidden">
                        <img src="${album.image_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800'}" alt="${album.title}" class="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out">
                        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300"></div>
                        <span class="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 text-xs font-medium px-3 py-1.5 rounded-full text-indigo-300 flex items-center space-x-1.5 shadow-lg">
                            <i data-lucide="image" class="w-3.5 h-3.5"></i>
                            <span>${album.photo_count || 0} fotos</span>
                        </span>
                    </div>
                    <div class="p-6 relative">
                        <h3 class="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors duration-300">${album.title}</h3>
                        <p class="text-slate-400 text-xs mt-1 mb-4 flex items-center space-x-1">
                            <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-500"></i>
                            <span>${album.date || 'Reciente'}</span>
                        </p>
                        <div class="flex items-center justify-between pt-4 border-t border-slate-800/80">
                            <span class="text-xs font-medium text-slate-400 group-hover:text-white transition-colors">Explorar galería</span>
                            <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-300 shadow-sm">
                                <i data-lucide="arrow-right" class="w-4 h-4 text-slate-300 group-hover:text-white"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (error) {
            console.error(error);
            grid.innerHTML = `
                <div class="col-span-full text-center py-12 text-red-400 text-sm">
                    <p>Error al conectar con el backend o cargar álbumes.</p>
                </div>
            `;
        }
    },

    checkPhotographerAccess() {
        if (sessionStorage.getItem("isPhotographerAuthenticated") === "true") {
            this.openUploadModal();
        } else {
            document.getElementById('authModal').classList.remove('hidden');
        }
    },

    closeAuthModal() {
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('adminPassword').value = "";
    },

    async verifyPassword(event) {
        event.preventDefault();
        const pass = document.getElementById('adminPassword').value;
        
        try {
            const response = await fetch(`${API_URL}/api/admin/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ password: pass })
            });

            if (response.ok) {
                sessionStorage.setItem("isPhotographerAuthenticated", "true");
                this.closeAuthModal();
                this.openUploadModal();
            } else {
                alert("Contraseña incorrecta.");
                document.getElementById('adminPassword').value = "";
            }
        } catch (error) {
            console.error(error);
            alert("Error al conectar con el servidor.");
        }
    },

    openUploadModal() { 
        document.getElementById('uploadModal').classList.remove('hidden'); 
        this.switchTab('create');
    },
    
    closeUploadModal() { 
        document.getElementById('uploadModal').classList.add('hidden'); 
    },
    
    openSearchModal() { 
        document.getElementById('searchModal').classList.remove('hidden'); 
    },
    
    closeSearchModal() { 
        document.getElementById('searchModal').classList.add('hidden'); 
    },

    switchTab(tab) {
        const viewCreate = document.getElementById('viewCreate');
        const viewManage = document.getElementById('viewManage');
        const tabCreateBtn = document.getElementById('tabCreateBtn');
        const tabManageBtn = document.getElementById('tabManageBtn');

        if (tab === 'create') {
            viewCreate.classList.remove('hidden');
            viewManage.classList.add('hidden');
            tabCreateBtn.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white transition-all";
            tabManageBtn.className = "px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all";
        } else {
            viewCreate.classList.add('hidden');
            viewManage.classList.remove('hidden');
            tabManageBtn.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white transition-all";
            tabCreateBtn.className = "px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all";
            this.loadAdminAlbumsList();
        }
    },

    async loadAdminAlbumsList() {
        const container = document.getElementById('adminAlbumsList');
        container.innerHTML = `<p class="text-center text-slate-400 text-xs py-4">Cargando álbumes...</p>`;

        try {
            const response = await fetch(`${API_URL}/api/albums`);
            const albums = await response.json();

            if (!albums || albums.length === 0) {
                container.innerHTML = `<p class="text-center text-slate-400 text-xs py-4">No hay álbumes para gestionar.</p>`;
                return;
            }

            container.innerHTML = albums.map(album => `
                <div class="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <div class="flex items-center space-x-3">
                        <img src="${album.image_url}" class="w-12 h-12 rounded-xl object-cover" alt="Portada">
                        <div>
                            <h4 class="text-sm font-bold text-white">${album.title}</h4>
                            <p class="text-xs text-slate-400">${album.date} • ${album.photo_count || 0} fotos</p>
                        </div>
                    </div>
                    <button onclick="app.deleteAlbum(${album.id})" class="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white text-xs font-semibold transition-all flex items-center space-x-1">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Borrar</span>
                    </button>
                </div>
            `).join('');

            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (error) {
            container.innerHTML = `<p class="text-center text-red-400 text-xs py-4">Error al cargar los álbumes.</p>`;
        }
    },

    async deleteAlbum(albumId) {
        if (!confirm("¿Estás seguro de que deseas eliminar este álbum y todas sus fotos?")) return;

        try {
            const response = await fetch(`${API_URL}/api/albums/${albumId}`, {
                method: "DELETE"
            });

            if (response.ok) {
                alert("Álbum eliminado con éxito.");
                this.loadAdminAlbumsList();
                this.loadAlbums();
            } else {
                alert("No se pudo eliminar el álbum.");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión al intentar borrar.");
        }
    },

    async handleCreateAlbumAndUpload(event) {
        event.preventDefault();
        
        const title = document.getElementById('albumTitle').value;
        const date = document.getElementById('albumDate').value;
        const coverFile = document.getElementById('coverFile').files[0];
        const photosFiles = document.getElementById('photosFiles').files;

        if (!coverFile || photosFiles.length === 0) {
            alert("Debes seleccionar una portada y al menos una foto.");
            return;
        }

        const formData = new FormData();
        formData.append("title", title);
        formData.append("date", date);
        formData.append("cover", coverFile);
        
        for (let i = 0; i < photosFiles.length; i++) {
            formData.append("photos", photosFiles[i]);
        }

        alert("Subiendo álbum y fotografías a Cloudflare R2... Esto puede tomar unos segundos.");

        try {
            const response = await fetch(`${API_URL}/api/albums/create`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                alert("¡Álbum creado y fotos subidas exitosamente!");
                this.closeUploadModal();
                document.getElementById('uploadForm').reset();
                this.loadAlbums();
            } else {
                alert("Error: " + (data.detail || "No se pudo crear el álbum"));
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión con el backend en Render.");
        }
    },

    async handleFaceSearch(event) {
        event.preventDefault();
        alert("Procesando reconocimiento facial...");
        setTimeout(() => {
            alert("¡Búsqueda completada!");
            this.closeSearchModal();
            document.getElementById('searchForm').reset();
        }, 1500);
    },

    goHome() { 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }
};

document.addEventListener("DOMContentLoaded", () => app.init());