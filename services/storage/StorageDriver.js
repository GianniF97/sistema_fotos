/**
 * Clase Base Abstracta StorageDriver
 * Define la interfaz contractual obligatoria para cualquier proveedor de almacenamiento
 * (disco local, Cloudflare R2, AWS S3, etc.) y las utilidades de generación segura
 * de nombres de archivo en servidor mediante UUID v4 aleatorio.
 */

const crypto = require('node:crypto');

const ALLOWED_ORIGINAL_MIME_TO_EXT = Object.freeze({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
});

const ALLOWED_ORIGINAL_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const SERVER_UUID_KEY_REGEX = /^(?:[a-z0-9_-]+\/)*[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;
const SAFE_PREFIX_REGEX = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i;

class StorageDriver {
    /**
     * Genera en el servidor un nombre/clave de almacenamiento basado en UUID v4 criptográfico.
     * Ignora cualquier nombre de archivo proveniente del cliente.
     * @param {Object} [options]
     * @param {string} [options.mimeType] - Tipo MIME validado ('image/jpeg', 'image/png', 'image/webp')
     * @param {string} [options.extension] - Extensión permitida ('.jpg', '.jpeg', '.png', '.webp') si no se pasa mimeType
     * @param {string} [options.prefix] - Subcarpeta interna segura opcional generada por servidor (ej. '2026')
     * @returns {string} Clave relativa segura (ej. '550e8400-e29b-41d4-a716-446655440000.jpg')
     */
    static generateOriginalFilename(options = {}) {
        let ext = null;

        if (options && typeof options.mimeType === 'string') {
            const normalizedMime = options.mimeType.toLowerCase().trim();
            ext = ALLOWED_ORIGINAL_MIME_TO_EXT[normalizedMime] || null;
        } else if (options && typeof options.extension === 'string') {
            const rawExt = options.extension.toLowerCase().trim();
            const normalizedExt = rawExt.startsWith('.') ? rawExt : `.${rawExt}`;
            if (ALLOWED_ORIGINAL_EXTENSIONS.has(normalizedExt)) {
                ext = normalizedExt === '.jpeg' ? '.jpg' : normalizedExt;
            }
        }

        if (!ext) {
            throw new Error(
                'Tipo de imagen o extensión no permitida para generar nombre de original (permitidos: image/jpeg, image/png, image/webp)'
            );
        }

        const uuidName = `${crypto.randomUUID()}${ext}`;

        if (options && options.prefix !== undefined && options.prefix !== null && options.prefix !== '') {
            if (typeof options.prefix !== 'string' || !SAFE_PREFIX_REGEX.test(options.prefix)) {
                throw new Error('Prefijo de almacenamiento inválido: solo se permiten segmentos alfanuméricos seguros');
            }
            return `${options.prefix}/${uuidName}`;
        }

        return uuidName;
    }

    /**
     * Verifica que una clave de original corresponda estrictamente a un UUID v4 aleatorio
     * generado por el servidor con extensión permitida (nunca un nombre arbitrario de cliente).
     * @param {string} relativePath
     * @returns {boolean}
     */
    static isValidServerOriginalKey(relativePath) {
        if (!relativePath || typeof relativePath !== 'string') return false;
        return SERVER_UUID_KEY_REGEX.test(relativePath);
    }

    /**
     * Guarda el archivo original de forma íntegra e inmutable (byte a byte).
     * @param {Buffer|import('stream').Readable} input - Datos del archivo en memoria o stream
     * @param {Object|string} [optionsOrKey] - Opciones ({ mimeType }) o clave UUID generada por el servidor
     * @param {Object} [maybeOptions] - Metadatos adicionales si se pasó clave explícita
     * @returns {Promise<{ path: string, sizeBytes: number, driver: string }>}
     */
    async saveOriginal(input, optionsOrKey = {}, maybeOptions = {}) {
        throw new Error('Método saveOriginal() debe ser implementado por la subclase');
    }

    /**
     * Obtiene un flujo de lectura (ReadableStream) del archivo original.
     * @param {string} relativePath
     * @returns {Promise<import('stream').Readable>}
     */
    async getOriginalStream(relativePath) {
        throw new Error('Método getOriginalStream() debe ser implementado por la subclase');
    }

    /**
     * Obtiene el contenido completo del archivo original en un Buffer de memoria.
     * @param {string} relativePath
     * @returns {Promise<Buffer>}
     */
    async getOriginalBuffer(relativePath) {
        throw new Error('Método getOriginalBuffer() debe ser implementado por la subclase');
    }

    /**
     * Elimina el archivo original del almacenamiento.
     * @param {string} relativePath
     * @returns {Promise<boolean>}
     */
    async deleteOriginal(relativePath) {
        throw new Error('Método deleteOriginal() debe ser implementado por la subclase');
    }

    /**
     * Comprueba si el archivo original existe en el almacenamiento.
     * @param {string} relativePath
     * @returns {Promise<boolean>}
     */
    async existsOriginal(relativePath) {
        throw new Error('Método existsOriginal() debe ser implementado por la subclase');
    }

    /**
     * Retorna los metadatos del archivo original (tamaño, fecha de creación, etc.).
     * @param {string} relativePath
     * @returns {Promise<{ sizeBytes: number, createdAt: Date|string, mimeType?: string }>}
     */
    async getOriginalMetadata(relativePath) {
        throw new Error('Método getOriginalMetadata() debe ser implementado por la subclase');
    }
}

module.exports = StorageDriver;
