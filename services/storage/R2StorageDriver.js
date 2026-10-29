/**
 * R2StorageDriver - Implementación desacoplada para Cloudflare R2
 * Diseñada para soportar la migración serverless futura a Cloudflare R2 / S3-compatible API.
 */

const StorageDriver = require('./StorageDriver');

class R2StorageDriver extends StorageDriver {
    /**
     * @param {Object} [options]
     * @param {string} [options.accountId]
     * @param {string} [options.bucketName]
     * @param {string} [options.accessKeyId]
     * @param {string} [options.secretAccessKey]
     */
    constructor(options = {}) {
        super();
        this.accountId = options.accountId || process.env.R2_ACCOUNT_ID;
        this.bucketName = options.bucketName || process.env.R2_BUCKET_NAME;
        this.accessKeyId = options.accessKeyId || process.env.R2_ACCESS_KEY_ID;
        this.secretAccessKey = options.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
        this.endpoint = options.endpoint || (this.accountId ? `https://${this.accountId}.r2.cloudflarestorage.com` : null);
    }

    /**
     * Valida que las credenciales obligatorias de Cloudflare R2 estén configuradas.
     * @private
     */
    _assertConfigured() {
        if (!this.bucketName || !this.accessKeyId || !this.secretAccessKey) {
            throw new Error(
                'R2 no configurado: credenciales de R2 requeridas en el entorno (R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)'
            );
        }
    }

    async saveOriginal(input, relativePath, options = {}) {
        this._assertConfigured();
        throw new Error('Método saveOriginal() en R2 requiere habilitar la biblioteca cliente de R2');
    }

    async getOriginalStream(relativePath) {
        this._assertConfigured();
        throw new Error('Método getOriginalStream() en R2 requiere habilitar la biblioteca cliente de R2');
    }

    async getOriginalBuffer(relativePath) {
        this._assertConfigured();
        throw new Error('Método getOriginalBuffer() en R2 requiere habilitar la biblioteca cliente de R2');
    }

    async deleteOriginal(relativePath) {
        this._assertConfigured();
        throw new Error('Método deleteOriginal() en R2 requiere habilitar la biblioteca cliente de R2');
    }

    async existsOriginal(relativePath) {
        this._assertConfigured();
        throw new Error('Método existsOriginal() en R2 requiere habilitar la biblioteca cliente de R2');
    }

    async getOriginalMetadata(relativePath) {
        this._assertConfigured();
        throw new Error('Método getOriginalMetadata() en R2 requiere habilitar la biblioteca cliente de R2');
    }
}

module.exports = R2StorageDriver;
