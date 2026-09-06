const vistaEventos = document.getElementById('vista-eventos');
const vistaBusqueda = document.getElementById('vista-busqueda');
const gridEventos = document.getElementById('grid-eventos');
const btnVolver = document.getElementById('btn-volver');
const tituloEvento = document.getElementById('titulo-evento-seleccionado');
const fechaEventoEl = document.getElementById('fecha-evento');
const precioEtiqueta = document.getElementById('precio-etiqueta');

// Modal Facial Elements
const modalBusqueda = document.getElementById('modal-busqueda');
const btnAbrirModal = document.getElementById('btn-abrir-modal');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const btnCancelarModal = document.getElementById('btn-cancelar-modal');
const inputSelfie = document.getElementById('input-selfie');
const selfiePreview = document.getElementById('selfie-preview');
const previewContainer = document.getElementById('preview-container');
const dropzoneLabel = document.querySelector('.upload-dropzone');
const btnEjecutarBusqueda = document.getElementById('btn-ejecutar-busqueda');
const loadingMsg = document.getElementById('loading-msg');

// Modal Exito / Envío Elements
const modalExito = document.getElementById('modal-exito');
const btnCerrarExito = document.getElementById('btn-cerrar-exito');
const inputContacto = document.getElementById('input-contacto');
const btnEnviarWhatsapp = document.getElementById('btn-enviar-whatsapp');
const btnEnviarEmail = document.getElementById('btn-enviar-email');

const gallery = document.getElementById('gallery');
const precioTotalEl = document.getElementById('precio-total');
const contadorSeleccionadasEl = document.getElementById('contador-seleccionadas');
const btnPagar = document.getElementById('btn-pagar');

let eventoSeleccionadoId = null;
let archivoSeleccionado = null;
let totalAPagar = 0;
let fotosActualesSeleccionadas = [];

async function cargarEventos() {
    try {
        const response = await fetch("http://127.0.0.1:8000/api/eventos");
        const data = await response.json();
        
        if (data.status === "success" && data.eventos.length > 0) {
            gridEventos.innerHTML = "";
            data.eventos.forEach(evento => {
                const card = document.createElement('div');
                card.className = 'event-card';
                card.innerHTML = `
                    <img src="${evento.portada_url}" alt="${evento.nombre}">
                    <div class="event-info">
                        <h3>${evento.nombre}</h3>
                        <p>${evento.fecha}</p>
                    </div>
                `;
                card.addEventListener('click', () => {
                    eventoSeleccionadoId = evento.id;
                    tituloEvento.innerText = evento.nombre;
                    fechaEventoEl.innerText = evento.fecha;
                    vistaEventos.classList.add('hidden');
                    vistaBusqueda.classList.remove('hidden');
                    cargarTodasLasFotos(evento.id);
                });
                gridEventos.appendChild(card);
            });
        } else {
            gridEventos.innerHTML = "<p style='color: #94a3b8;'>No hay álbumes creados todavía.</p>";
        }
    } catch (error) {
        console.error("Error cargando eventos:", error);
    }
}

async function cargarTodasLasFotos(eventoId) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/evento/${eventoId}/fotos`);
        const data = await response.json();
        if (data.status === "success") {
            mostrarResultados(data.fotos);
        }
    } catch (error) {
        console.error("Error al cargar fotos:", error);
    }
}

btnVolver.addEventListener('click', () => {
    vistaBusqueda.classList.add('hidden');
    vistaEventos.classList.remove('hidden');
    gallery.innerHTML = "";
});

btnAbrirModal.addEventListener('click', () => {
    modalBusqueda.classList.remove('hidden');
});

function cerrarModalFacial() {
    modalBusqueda.classList.add('hidden');
    limpiarModal();
}

btnCerrarModal.addEventListener('click', cerrarModalFacial);
btnCancelarModal.addEventListener('click', cerrarModalFacial);

inputSelfie.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        archivoSeleccionado = file;
        const reader = new FileReader();
        reader.onload = function(event) {
            selfiePreview.src = event.target.result;
            previewContainer.classList.remove('hidden');
            dropzoneLabel.classList.add('hidden');
            document.getElementById('nombre-archivo-selfie').innerText = file.name;
            btnEjecutarBusqueda.disabled = false;
        }
        reader.readAsDataURL(file);
    }
});

btnEjecutarBusqueda.addEventListener('click', async () => {
    if (!archivoSeleccionado) return;

    const formData = new FormData();
    formData.append("selfie", archivoSeleccionado, archivoSeleccionado.name);

    btnEjecutarBusqueda.disabled = true;
    loadingMsg.classList.remove('hidden');

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/evento/${eventoSeleccionadoId}/buscar-rostro`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Error al procesar la búsqueda facial.");
        }

        const data = await response.json();
        mostrarResultados(data.fotos);
        cerrarModalFacial();
        alert("¡Filtro aplicado con éxito!");

    } catch (error) {
        alert("Error detallado: " + error.message);
    } finally {
        btnEjecutarBusqueda.disabled = false;
        loadingMsg.classList.add('hidden');
    }
});

function limpiarModal() {
    archivoSeleccionado = null;
    inputSelfie.value = "";
    previewContainer.classList.add('hidden');
    dropzoneLabel.classList.remove('hidden');
    btnEjecutarBusqueda.disabled = true;
    loadingMsg.classList.add('hidden');
}

function mostrarResultados(fotos) {
    gallery.innerHTML = "";
    totalAPagar = 0;
    fotosActualesSeleccionadas = [];
    contadorSeleccionadasEl.innerText = "0";
    precioTotalEl.innerText = `$0 ARS`;

    if (!fotos || fotos.length === 0) {
        gallery.innerHTML = "<p style='color: #94a3b8; grid-column: 1/-1; text-align: center;'>No hay fotos disponibles en este álbum todavía.</p>";
        precioEtiqueta.innerText = `$0 ARS`;
        return;
    }

    let precioBase = fotos[0].precio || 3000;
    precioEtiqueta.innerText = `$${Number(precioBase).toLocaleString()} ARS`;

    fotos.forEach(foto => {
        const card = document.createElement('div');
        card.className = 'photo-card seleccionada';
        const precioFoto = foto.precio || 3000;
        
        card.innerHTML = `
            <input type="checkbox" checked data-id="${foto.id}" data-url="${foto.url_preview}" data-precio="${precioFoto}">
            <img src="${foto.url_preview}" alt="Foto del evento" loading="lazy">
        `;

        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                card.classList.add('seleccionada');
            } else {
                card.classList.remove('seleccionada');
            }
            actualizarCalculoSeleccionadas();
        });

        gallery.appendChild(card);
    });

    actualizarCalculoSeleccionadas();
}

function actualizarCalculoSeleccionadas() {
    const checkboxes = gallery.querySelectorAll('input[type="checkbox"]');
    fotosActualesSeleccionadas = [];
    totalAPagar = 0;

    checkboxes.forEach(chk => {
        if (chk.checked) {
            fotosActualesSeleccionadas.push({
                id: chk.getAttribute('data-id'),
                url_preview: chk.getAttribute('data-url'),
                precio: parseFloat(chk.getAttribute('data-precio'))
            });
            totalAPagar += parseFloat(chk.getAttribute('data-precio'));
        }
    });

    contadorSeleccionadasEl.innerText = fotosActualesSeleccionadas.length;
    precioTotalEl.innerText = `$${totalAPagar.toLocaleString()} ARS`;
}

btnPagar.addEventListener('click', async () => {
    if (fotosActualesSeleccionadas.length === 0) {
        alert("Debes seleccionar al menos una foto para continuar con el pago.");
        return;
    }

    btnPagar.disabled = true;
    btnPagar.innerText = "Conectando con Mercado Pago...";

    try {
        const itemsParaPago = fotosActualesSeleccionadas.map(foto => ({
            titulo: `Fotografía Digital del Evento`,
            precio: foto.precio
        }));

        const response = await fetch("http://127.0.0.1:8000/api/generar-pago", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ items: itemsParaPago })
        });

        const data = await response.json();
        
        if (data.status === "success" && data.url_pago) {
            window.location.href = data.url_pago;
        } else {
            throw new Error("No se pudo obtener la URL de pago.");
        }

    } catch (error) {
        console.error("Error al procesar el pago:", error);
        alert("Hubo un problema al conectar con Mercado Pago.");
        btnPagar.disabled = false;
        btnPagar.innerText = "Pagar con Mercado Pago";
    }
});

btnEnviarWhatsapp.addEventListener('click', () => {
    const contacto = inputContacto.value.trim();
    const listaUrls = fotosActualesSeleccionadas.map(f => f.url_preview).join('\n');
    const mensaje = `¡Hola! Realicé el pago de mis fotos. Aquí están los enlaces de mis ${fotosActualesSeleccionadas.length} fotos:\n\n${listaUrls}`;
    const urlWp = contacto ? `https://wa.me/${contacto}?text=${encodeURIComponent(mensaje)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(urlWp, '_blank');
});

btnEnviarEmail.addEventListener('click', () => {
    const emailDestino = inputContacto.value.trim() || "tucorreo@example.com";
    const asunto = encodeURIComponent("Tus fotografías compradas - Galería Oficial");
    const listaUrls = fotosActualesSeleccionadas.map(f => f.url_preview).join('\n\n');
    const cuerpo = encodeURIComponent(`¡Hola! Gracias por tu compra.\n\nAquí tienes los enlaces directos a tus fotografías en alta calidad:\n\n${listaUrls}`);
    window.location.href = `mailto:${emailDestino}?subject=${asunto}&body=${cuerpo}`;
});

btnCerrarExito.addEventListener('click', () => {
    modalExito.classList.add('hidden');
});

cargarEventos();