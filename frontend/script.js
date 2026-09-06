// Cambiar a tu URL de Render cuando despliegues el backend
const API_URL = "https://sistema-fotos-backend.onrender.com"; 

document.addEventListener("DOMContentLoaded", async () => {
    const eventoSelect = document.getElementById("evento-select");
    
    // Cargar eventos (ejemplo simulado o endpoint propio)
    try {
        const response = await fetch(`${API_URL}/api/eventos`);
        const eventos = await response.json();
        eventos.forEach(ev => {
            let option = document.createElement("option");
            option.value = ev.id;
            option.textContent = ev.nombre;
            eventoSelect.appendChild(option);
        });
    } catch (e) {
        console.log("Cargando entorno local o backend durmiendo...");
    }
});

document.getElementById("btn-buscar").addEventListener("click", async () => {
    const eventoId = document.getElementById("evento-select").value;
    const fileInput = document.getElementById("selfie-input").files[0];
    
    if (!fileInput) {
        alert("Por favor selecciona una selfie.");
        return;
    }

    const formData = new FormData();
    formData.append("evento_id", eventoId);
    formData.append("file", fileInput);

    alert("Buscando coincidencias con IA (esto puede tomar unos segundos)...");

    try {
        const response = await fetch(`${API_URL}/api/reconocer`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        
        const galeria = document.getElementById("galeria");
        galeria.innerHTML = "";
        
        data.coincidencias.forEach(foto => {
            let img = document.createElement("img");
            img.src = foto.url;
            img.className = "foto-item";
            galeria.appendChild(img);
        });

        if(data.coincidencias.length > 0) {
            document.getElementById("btn-pagar").style.display = "block";
        }
    } catch (error) {
        alert("Error al conectar con el servidor.");
    }
});