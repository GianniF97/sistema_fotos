/**
 * Clase Base Abstracta StorageDriver
 * Define la interfaz contractual obligatoria para cualquier proveedor de almacenamiento
 * (disco local, Cloudflare R2, AWS S3, etc.).
 */

class StorageDriver {
    /**
     * Guarda el archivo original de forma íntegra e inmutable (byte a byte).
     * @param {Buffer|import('stream').Readable} input - Datos del archivo en memoria o stream
     * @param {string} relativePath - Ruta relativa segura o identificador del archivo
     * @param {Object} [options] - Metadatos adicionales (mimeType, etc.)
     * @returns {Promise<{ path: string, sizeBytes: number, driver: string }>}
     */
    async saveOriginal(input, relativePath, options = {}) {
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
