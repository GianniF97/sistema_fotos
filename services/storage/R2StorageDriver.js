/**
 * R2StorageDriver - Stub desacoplado para futura migración a Cloudflare R2
 * Lanza errores explícitos de "no implementado" (ERR_NOT_IMPLEMENTED) y bloquea
 * su instanciación cuando NODE_ENV=production para impedir selección accidental.
 */

const StorageDriver = require('./StorageDriver');

class R2StorageDriver extends StorageDriver {
    /**
     * @param {Object} [options]
     */
    constructor(options = {}) {
        super();
        if (process.env.NODE_ENV === 'production') {
            const err = new Error(
                'R2StorageDriver no implementado: no puede seleccionarse ni instanciarse cuando NODE_ENV=production'
            );
            err.code = 'ERR_NOT_IMPLEMENTED';
            throw err;
        }
        this.accountId = options.accountId || process.env.R2_ACCOUNT_ID || null;
        this.bucketName = options.bucketName || process.env.R2_BUCKET_NAME || null;
        this.endpoint = options.endpoint || (this.accountId ? `https://${this.accountId}.r2.cloudflarestorage.com` : null);
    }

    /**
     * Lanza un error inequívoco indicando que el driver R2 aún no está implementado.
     * @private
     * @param {string} methodName
     */
    _throwNotImplemented(methodName) {
        const err = new Error(
            `R2StorageDriver.${methodName}() no implementado: pendiente de migración a Cloudflare R2`
        );
        err.code = 'ERR_NOT_IMPLEMENTED';
        throw err;
    }

    async saveOriginal(input, optionsOrKey = {}, maybeOptions = {}) {
        this._throwNotImplemented('saveOriginal');
    }

    async getOriginalStream(relativePath) {
        this._throwNotImplemented('getOriginalStream');
    }

    async getOriginalBuffer(relativePath) {
        this._throwNotImplemented('getOriginalBuffer');
    }

    async deleteOriginal(relativePath) {
        this._throwNotImplemented('deleteOriginal');
    }

    async existsOriginal(relativePath) {
        this._throwNotImplemented('existsOriginal');
    }

    async getOriginalMetadata(relativePath) {
        this._throwNotImplemented('getOriginalMetadata');
    }
}

module.exports = R2StorageDriver;
