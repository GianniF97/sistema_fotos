/**
 * Script de población de datos iniciales (Seed) en MariaDB / MySQL
 * Ejecuta database/seed.sql para insertar colecciones y fotografías iniciales.
 * Uso: npm run db:seed
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { dbConfig } = require('../db/connection');

async function seedDatabase() {
    console.log('----------------------------------------------------');
    console.log('  Nicolas Techeira Fotografías - Sembrar Datos (Seed)');
    console.log('----------------------------------------------------');
    console.log(`[DB Seed] Conectando a '${dbConfig.database}' en ${dbConfig.host}:${dbConfig.port}...`);

    let connection;
    try {
        connection = await mysql.createConnection({
            ...dbConfig,
            multipleStatements: true
        });

        console.log(`[DB Seed] Leyendo datos iniciales desde database/seed.sql...`);
        const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
        const seedSql = fs.readFileSync(seedPath, 'utf8');

        console.log(`[DB Seed] Insertando colecciones, fotos y credenciales iniciales...`);
        await connection.query(seedSql);

        // Consultar resumen de datos insertados
        const [[{ totalAlbums }]] = await connection.query(`SELECT COUNT(*) AS totalAlbums FROM \`albums\`;`);
        const [[{ totalPhotos }]] = await connection.query(`SELECT COUNT(*) AS totalPhotos FROM \`photos\`;`);
        const [[{ totalAdmins }]] = await connection.query(`SELECT COUNT(*) AS totalAdmins FROM \`admin_users\`;`);

        console.log('\n[DB Seed] Resumen de registros disponibles:');
        console.log(`   - Álbumes / Colecciones: ${totalAlbums}`);
        console.log(`   - Fotografías en catálogo: ${totalPhotos}`);
        console.log(`   - Cuentas de administración: ${totalAdmins}`);
        console.log(`   - Usuario de estudio: estudio@nicolastecheira.com`);

        await connection.end();
        console.log('----------------------------------------------------');
        console.log('✔ ¡Datos iniciales cargados exitosamente!');
        console.log('----------------------------------------------------');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error al cargar datos iniciales:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Código: ${error.code || 'N/A'}`);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n[Diagnóstico] MariaDB no está accesible. Asegúrate de ejecutar el servicio en XAMPP o Docker.');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('\n[Diagnóstico] La base de datos aún no existe. Ejecuta primero: npm run db:init\n');
        }
        process.exit(1);
    }
}

seedDatabase();
