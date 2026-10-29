/**
 * LocalStorageDriver - Implementación concreta de almacenamiento en disco local
 * Provee almacenamiento privado de archivos originales fuera de la raíz web pública
 * con protección estricta contra Path Traversal e inyecciones de ruta.
 */

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const StorageDriver = require('./StorageDriver');

class LocalStorageDriver extends StorageDriver {
    /**
     * @param {Object} [options]
     * @param {string} [options.baseDir] - Directorio raíz privado para originales
     */
    constructor(options = {}) {
        super();
        const configuredDir = options.baseDir || process.env.STORAGE_DIR || 'storage/originals';
        this.baseDir = path.isAbsolute(configuredDir)
            ? path.resolve(configuredDir)
            : path.resolve(process.cwd(), configuredDir);

        // Asegurar que el directorio base exista al inicializar
        if (!fs.existsSync(this.baseDir)) {
            try {
                fs.mkdirSync(this.baseDir, { recursive: true });
            } catch (err) {
                // Silencioso si falla por permisos en tests aislados
            }
        }
    }

    /**
     * Resuelve y valida una ruta relativa contra el directorio base.
     * Aplica defensa en profundidad contra Path Traversal, caracteres nulos y codificaciones URI.
     * @private
     * @param {string} relativePath
     * @returns {string} Ruta absoluta segura y normalizada
     */
    _resolveAndValidatePath(relativePath) {
        if (!relativePath || typeof relativePath !== 'string') {
            throw new Error('Ruta de archivo inválida: debe ser una cadena no vacía');
        }

        // 1. Detección de caracteres nulos (Null Byte Injection)
        if (relativePath.includes('\0')) {
            throw new Error('Intento de Path Traversal o inyección de byte nulo detectada');
        }

        // 2. Detección de URL encodings maliciosos (%2e%2e = ..)
        const lowerPath = relativePath.toLowerCase();
        if (lowerPath.includes('%2e%2e') || lowerPath.includes('%2f') || lowerPath.includes('%5c')) {
            throw new Error('Intento de Path Traversal por URI encoding detectado');
        }

        // 3. Prohibir rutas absolutas explícitas en el parámetro relativo
        if (path.isAbsolute(relativePath) || /^[a-zA-Z]:[/\\]/.test(relativePath)) {
            throw new Error('Ruta absoluta no permitida: debe ser relativa a la raíz de almacenamiento');
        }

        // 4. Resolver contra baseDir y verificar prefijo canónico
        const canonicalBase = path.resolve(this.baseDir);
        const resolvedPath = path.resolve(canonicalBase, relativePath);

        const isInsideBase = resolvedPath.startsWith(canonicalBase + path.sep) || resolvedPath === canonicalBase;
        if (!isInsideBase) {
            throw new Error('Intento de Path Traversal detectado: ruta fuera del directorio permitido');
        }

        return resolvedPath;
    }

    /**
     * Guarda el archivo original de forma íntegra e inmutable (byte a byte).
     * @param {Buffer|import('stream').Readable} input
     * @param {string} relativePath
     * @param {Object} [options]
     * @returns {Promise<{ path: string, sizeBytes: number, driver: string }>}
     */
    async saveOriginal(input, relativePath, options = {}) {
        const targetPath = this._resolveAndValidatePath(relativePath);
        const targetDir = path.dirname(targetPath);

        await fs.promises.mkdir(targetDir, { recursive: true });

        if (Buffer.isBuffer(input)) {
            await fs.promises.writeFile(targetPath, input);
            return {
                path: relativePath,
                sizeBytes: input.length,
                driver: 'local'
            };
        }

        if (input && typeof input.pipe === 'function') {
            const writeStream = fs.createWriteStream(targetPath);
            await pipeline(input, writeStream);
            const stat = await fs.promises.stat(targetPath);
            return {
                path: relativePath,
                sizeBytes: stat.size,
                driver: 'local'
            };
        }

        throw new Error('Entrada no válida para saveOriginal: se requiere Buffer o ReadableStream');
    }

    /**
     * Obtiene un flujo de lectura (ReadableStream) del archivo original.
     * @param {string} relativePath
     * @returns {Promise<import('fs').ReadStream>}
     */
    async getOriginalStream(relativePath) {
        const targetPath = this._resolveAndValidatePath(relativePath);

        try {
            await fs.promises.access(targetPath, fs.constants.R_OK);
        } catch (err) {
            throw new Error(`Archivo original no encontrado en almacenamiento local: ${relativePath} (ENOENT)`);
        }

        return fs.createReadStream(targetPath);
    }

    /**
     * Obtiene el contenido completo del archivo original en un Buffer de memoria.
     * @param {string} relativePath
     * @returns {Promise<Buffer>}
     */
    async getOriginalBuffer(relativePath) {
        const targetPath = this._resolveAndValidatePath(relativePath);

        try {
            return await fs.promises.readFile(targetPath);
        } catch (err) {
            throw new Error(`Archivo original no encontrado en almacenamiento local: ${relativePath} (ENOENT)`);
        }
    }

    /**
     * Elimina el archivo original del almacenamiento.
     * @param {string} relativePath
     * @returns {Promise<boolean>}
     */
    async deleteOriginal(relativePath) {
        const targetPath = this._resolveAndValidatePath(relativePath);

        try {
            await fs.promises.unlink(targetPath);
            return true;
        } catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        }
    }

    /**
     * Comprueba si el archivo original existe en el almacenamiento.
     * @param {string} relativePath
     * @returns {Promise<boolean>}
     */
    async existsOriginal(relativePath) {
        try {
            const targetPath = this._resolveAndValidatePath(relativePath);
            await fs.promises.access(targetPath, fs.constants.F_OK);
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Retorna los metadatos del archivo original.
     * @param {string} relativePath
     * @returns {Promise<{ sizeBytes: number, createdAt: Date, updatedAt: Date }>}
     */
    async getOriginalMetadata(relativePath) {
        const targetPath = this._resolveAndValidatePath(relativePath);

        try {
            const stat = await fs.promises.stat(targetPath);
            return {
                sizeBytes: stat.size,
                createdAt: stat.birthtime || stat.ctime,
                updatedAt: stat.mtime
            };
        } catch (err) {
            throw new Error(`Archivo original no encontrado para metadatos: ${relativePath} (ENOENT)`);
        }
    }
}

module.exports = LocalStorageDriver;
