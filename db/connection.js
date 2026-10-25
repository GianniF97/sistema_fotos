/**
 * Conexión centralizada a MariaDB / MySQL mediante mysql2/promise
 * Compatible con entornos de desarrollo local (XAMPP / Docker)
 * y despliegues en producción en Hostinger (cPanel / hPanel).
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'nt_user',
    password: process.env.DB_PASSWORD || 'nt_local_secure_pass_2026',
    database: process.env.DB_NAME || 'nicolas_techeira',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true
};

const pool = mysql.createPool(dbConfig);

// Helper para verificar conexión
async function checkConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return { ok: true, host: dbConfig.host, database: dbConfig.database };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

module.exports = {
    pool,
    checkConnection,
    dbConfig
};
