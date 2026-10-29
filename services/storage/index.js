/**
 * Módulo de Almacenamiento (services/storage)
 * Fábrica y exportación de controladores de almacenamiento para la plataforma.
 */

const StorageDriver = require('./StorageDriver');
const LocalStorageDriver = require('./LocalStorageDriver');
const R2StorageDriver = require('./R2StorageDriver');

/**
 * Fábrica de controladores de almacenamiento.
 * @param {'local'|'r2'} [driverName] - Nombre del driver a instanciar
 * @param {Object} [options] - Parámetros de configuración del driver
 * @returns {StorageDriver}
 */
function getStorageDriver(driverName = process.env.STORAGE_DRIVER || 'local', options = {}) {
    const normalized = String(driverName).toLowerCase().trim();

    switch (normalized) {
        case 'local':
            return new LocalStorageDriver(options);
        case 'r2':
            return new R2StorageDriver(options);
        default:
            throw new Error(`Driver de almacenamiento no soportado o desconocido: '${driverName}'`);
    }
}

module.exports = {
    StorageDriver,
    LocalStorageDriver,
    R2StorageDriver,
    getStorageDriver
};
