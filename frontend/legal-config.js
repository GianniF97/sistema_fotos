/**
 * CONFIGURACIÓN CENTRALIZADA DE DATOS LEGALES E INSTITUCIONALES
 * Nicolas Techeira Fotografías — Plataforma E-commerce de Venta de Fotografías
 * 
 * Completar los marcadores [ENTRE CORCHETES] con los datos reales del titular.
 * Todos los textos legales y pies de página consumen este archivo como fuente única de verdad.
 */

const LEGAL_CONFIG = {
    // Identificación comercial y legal del titular
    brandName: "Nicolas Techeira Fotografías",
    legalName: "[RAZÓN SOCIAL / NOMBRE COMERCIAL]",
    cuit: "[CUIT: XX-XXXXXXXX-X]",
    legalAddress: "[DOMICILIO LEGAL: Calle, Número, Código Postal, Oberá, Misiones, Argentina]",
    contactEmail: "[CORREO DE CONTACTO Y ATENCIÓN AL CONSUMIDOR: contacto@nicolastecheira.com]",
    phone: "[TELÉFONO OPCIONAL / WHATSAPP: +54 9 3755 00-0000]",
    
    // Jurisdicción y organismos de defensa y control
    cityJurisdiction: "[CIUDAD DE JURISDICCIÓN: Ciudad de Oberá, Provincia de Misiones, República Argentina]",
    consumerDefenseUrl: "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario",
    consumerDefensePhone: "0800-666-1518",
    aaipUrl: "https://www.argentina.gob.ar/aaip/datospersonales",
    aaipContact: "Av. Pte. Gral. Julio A. Roca 710, piso 3 - CABA (datospersonales@aaip.gob.ar)",
    
    // Proveedores tecnológicos e infraestructura
    paymentGateway: "[PASARELA DE PAGO: Mercado Pago (MercadoLibre S.R.L.)]",
    hostingProvider: "[PROVEEDOR DE ALMACENAMIENTO Y HOSTING: Vercel / Cloudflare]",
    
    // Metadatos de control contractual
    lastUpdated: "25 de octubre de 2026",
    version: "1.0",
    
    // Función de hidratación automática en elementos del DOM con atributo data-legal="clave"
    hydrate() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('[data-legal]').forEach(el => {
            const key = el.getAttribute('data-legal');
            if (this[key] !== undefined) {
                if (el.tagName === 'A' && key.includes('Email')) {
                    const cleanEmail = this[key].replace(/^\[|\]$/g, '').trim();
                    el.href = `mailto:${cleanEmail}`;
                    el.textContent = this[key];
                } else if (el.tagName === 'A' && key.includes('Url')) {
                    el.href = this[key];
                } else {
                    el.textContent = this[key];
                }
            }
        });
    }
};

// Hidratar automáticamente al cargar el DOM
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => LEGAL_CONFIG.hydrate());
    } else {
        LEGAL_CONFIG.hydrate();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LEGAL_CONFIG;
}
