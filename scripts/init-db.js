/**
 * Script de inicialización de Base de Datos MariaDB / MySQL
 * Crea la base de datos, el usuario dedicado si es necesario,
 * y ejecuta database/schema.sql para crear tablas e índices.
 * Compatible con XAMPP, Docker y Hostinger cPanel.
 * Uso: npm run db:init
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { dbConfig } = require('../db/connection');

async function initDatabase() {
    console.log('====================================================');
    console.log('  Nicolas Techeira Fotografías - Inicializar MariaDB');
    console.log('====================================================');
    console.log(`[DB Init] Conectando a MariaDB en ${dbConfig.host}:${dbConfig.port}...`);

    let serverConnection;
    try {
        // 1. Intentar conectar con las credenciales configuradas
        try {
            serverConnection = await mysql.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                password: dbConfig.password,
                charset: dbConfig.charset
            });
        } catch (connErr) {
            // Si el acceso fue denegado y el usuario no es root, intentar inicializar con root (común en XAMPP o Docker nuevo)
            if (connErr.code === 'ER_ACCESS_DENIED_ERROR' && dbConfig.user !== 'root') {
                console.log(`[DB Init] Credenciales de '${dbConfig.user}' no reconocidas aún.`);
                console.log(`[DB Init] Intentando como root para aprovisionar base de datos y usuario...`);
                
                const rootPass = process.env.DB_ROOT_PASSWORD || '';
                const rootConnection = await mysql.createConnection({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: 'root',
                    password: rootPass,
                    multipleStatements: true
                });

                const initUserPath = path.join(__dirname, '..', 'database', 'init_user.sql');
                if (fs.existsSync(initUserPath)) {
                    console.log(`[DB Init] Ejecutando database/init_user.sql...`);
                    const initUserSql = fs.readFileSync(initUserPath, 'utf8');
                    await rootConnection.query(initUserSql);
                    console.log(`[DB Init] Usuario '${dbConfig.user}' y privilegios creados exitosamente.`);
                }
                await rootConnection.end();

                // Reintentar conexión con las credenciales de la app
                serverConnection = await mysql.createConnection({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.user,
                    password: dbConfig.password,
                    charset: dbConfig.charset
                });
            } else {
                throw connErr;
            }
        }

        console.log(`[DB Init] Asegurando base de datos '${dbConfig.database}'...`);
        await serverConnection.query(
            `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
        );
        await serverConnection.end();

        // 2. Conectar a la base de datos específica con soporte para múltiples sentencias
        const dbConnection = await mysql.createConnection({
            ...dbConfig,
            multipleStatements: true
        });

        console.log(`[DB Init] Leyendo esquema SQL desde database/schema.sql...`);
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log(`[DB Init] Ejecutando sentencias de estructura...`);
        await dbConnection.query(schemaSql);

        // 3. Verificar las tablas creadas
        const [tables] = await dbConnection.query(`SHOW TABLES;`);
        console.log('\n[DB Init] Tablas activas en la base de datos:');
        tables.forEach((row, i) => {
            const tableName = Object.values(row)[0];
            console.log(`   ${i + 1}. ${tableName}`);
        });

        await dbConnection.end();
        console.log('\n====================================================');
        console.log('✔ ¡Base de datos inicializada exitosamente!');
        console.log('  Siguiente paso: npm run db:seed');
        console.log('====================================================\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error al inicializar la base de datos:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Código: ${error.code || 'N/A'}`);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n[Diagnóstico] MariaDB/MySQL no está respondiendo en el puerto 3306:');
            console.error('   1. Si usas XAMPP: Abre el Panel de Control de XAMPP y haz clic en "Start" en el módulo MySQL.');
            console.error('   2. Si usas Docker: Inicia el contenedor con "docker-compose up -d".');
            console.error('   3. Revisa los valores de DB_HOST y DB_PORT en el archivo .env\n');
        }
        process.exit(1);
    }
}

initDatabase();
