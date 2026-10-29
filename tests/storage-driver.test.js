process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const {
    StorageDriver,
    LocalStorageDriver,
    R2StorageDriver,
    getStorageDriver
} = require('../services/storage');

const REAL_PROTECTED_DIRS = Object.freeze({
    originals: path.join(__dirname, '..', 'storage', 'originals'),
    previews: path.join(__dirname, '..', 'frontend', 'uploads', 'previews'),
    thumbs: path.join(__dirname, '..', 'frontend', 'uploads', 'thumbs')
});

function listDirectoryTreeSnapshot(rootDir) {
    if (!fs.existsSync(rootDir)) {
        return { exists: false, entries: [] };
    }

    const entries = [];
    function walk(currentDir) {
        const dirItems = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const item of dirItems) {
            const fullPath = path.join(currentDir, item.name);
            const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');
            const stat = fs.statSync(fullPath);
            entries.push({
                relPath,
                isDirectory: item.isDirectory(),
                size: item.isDirectory() ? 0 : stat.size,
                mtimeMs: Math.trunc(stat.mtimeMs)
            });
            if (item.isDirectory()) {
                walk(fullPath);
            }
        }
    }

    walk(rootDir);
    entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
    return { exists: true, entries };
}

function captureProtectedDirsSnapshot() {
    return {
        originals: listDirectoryTreeSnapshot(REAL_PROTECTED_DIRS.originals),
        previews: listDirectoryTreeSnapshot(REAL_PROTECTED_DIRS.previews),
        thumbs: listDirectoryTreeSnapshot(REAL_PROTECTED_DIRS.thumbs)
    };
}

// Captura inicial antes de ejecutar cualquier prueba de la suite
const initialProtectedDirsSnapshot = captureProtectedDirsSnapshot();

test('StorageDriver: Clase base abstracta', async (t) => {
    const base = new StorageDriver();

    await assert.rejects(
        async () => base.saveOriginal(Buffer.from('test'), 'test.jpg'),
        /debe ser implementado/i,
        'saveOriginal() debe ser abstracto'
    );

    await assert.rejects(
        async () => base.getOriginalStream('test.jpg'),
        /debe ser implementado/i,
        'getOriginalStream() debe ser abstracto'
    );

    await assert.rejects(
        async () => base.getOriginalBuffer('test.jpg'),
        /debe ser implementado/i,
        'getOriginalBuffer() debe ser abstracto'
    );

    await assert.rejects(
        async () => base.deleteOriginal('test.jpg'),
        /debe ser implementado/i,
        'deleteOriginal() debe ser abstracto'
    );

    await assert.rejects(
        async () => base.existsOriginal('test.jpg'),
        /debe ser implementado/i,
        'existsOriginal() debe ser abstracto'
    );

    await assert.rejects(
        async () => base.getOriginalMetadata('test.jpg'),
        /debe ser implementado/i,
        'getOriginalMetadata() debe ser abstracto'
    );
});

test('LocalStorageDriver: Manejo seguro en carpeta temporal', async (t) => {
    // Usar carpeta temporal dedicada (TDD defensivo: NUNCA tocar almacenamiento real)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-storage-test-'));
    const driver = new LocalStorageDriver({ baseDir: tmpDir });

    t.after(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
    });

    await t.test('Guarda y lee un original desde Buffer intacto byte a byte con UUID generado por servidor', async () => {
        const originalBytes = crypto.randomBytes(1024 * 64); // 64 KB de datos binarios
        const originalHash = crypto.createHash('sha256').update(originalBytes).digest('hex');

        const saveResult = await driver.saveOriginal(originalBytes, {
            mimeType: 'image/jpeg',
            filename: 'nombre-cliente-ignorado.jpg' // Debe ser ignorado por completo
        });

        assert.equal(saveResult.driver, 'local');
        assert.match(
            saveResult.path,
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i,
            'El nombre del original debe ser un UUID v4 aleatorio generado por el servidor'
        );
        assert.equal(saveResult.sizeBytes, 1024 * 64);

        const storedKey = saveResult.path;

        // Comprobar existencia en disco temporal
        const exists = await driver.existsOriginal(storedKey);
        assert.equal(exists, true);

        // Leer buffer y verificar integridad criptográfica
        const readBuffer = await driver.getOriginalBuffer(storedKey);
        const readHash = crypto.createHash('sha256').update(readBuffer).digest('hex');
        assert.equal(readHash, originalHash, 'Los bytes leídos deben ser exactamente idénticos al original');

        // Metadatos
        const meta = await driver.getOriginalMetadata(storedKey);
        assert.equal(meta.sizeBytes, 1024 * 64);
        assert.ok(meta.createdAt instanceof Date || typeof meta.createdAt === 'string');
    });

    await t.test('Guarda y lee un original desde Stream intacto byte a byte con prefijo y UUID de servidor', async () => {
        const originalBytes = crypto.randomBytes(1024 * 32);
        const originalHash = crypto.createHash('sha256').update(originalBytes).digest('hex');
        const serverKey = StorageDriver.generateOriginalFilename({
            mimeType: 'image/webp',
            prefix: 'album-10'
        });

        const stream = Readable.from(originalBytes);
        const saveResult = await driver.saveOriginal(stream, serverKey);

        assert.equal(saveResult.path, serverKey);
        assert.match(
            saveResult.path,
            /^album-10\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i
        );
        assert.equal(saveResult.sizeBytes, 1024 * 32);

        // Leer como stream
        const readStream = await driver.getOriginalStream(serverKey);
        const chunks = [];
        for await (const chunk of readStream) {
            chunks.push(chunk);
        }
        const streamedBuffer = Buffer.concat(chunks);
        const streamedHash = crypto.createHash('sha256').update(streamedBuffer).digest('hex');
        assert.equal(streamedHash, originalHash, 'El stream debe entregar los bytes exactos sin mutaciones');
    });

    await t.test('Rechaza nombres de archivo originados en el cliente (no UUID v4)', async () => {
        const clientFilenames = [
            'IMG_20261029_001.jpg',
            'Vacaciones familia (1).jpg',
            'exploit.php.jpg',
            'foto-test-01.jpg',
            'subcarpeta/nombre-arbitrario.png'
        ];

        for (const clientName of clientFilenames) {
            await assert.rejects(
                async () => driver.saveOriginal(Buffer.from('datos'), clientName),
                /UUID v4|rechazado|servidor/i,
                `saveOriginal debe rechazar nombres de cliente como: ${clientName}`
            );
        }
    });

    await t.test('Elimina un archivo original existente', async () => {
        const saved = await driver.saveOriginal(Buffer.from('contenido'), { mimeType: 'image/png' });
        assert.equal(await driver.existsOriginal(saved.path), true);

        const deleted = await driver.deleteOriginal(saved.path);
        assert.equal(deleted, true);
        assert.equal(await driver.existsOriginal(saved.path), false);

        // Eliminar archivo que ya no existe no debe explotar, debe devolver false
        const deletedAgain = await driver.deleteOriginal(saved.path);
        assert.equal(deletedAgain, false);
    });

    await t.test('Lanza error si el archivo solicitado no existe', async () => {
        await assert.rejects(
            async () => driver.getOriginalBuffer('inexistente.jpg'),
            /no encontrado|not found|ENOENT/i
        );

        await assert.rejects(
            async () => driver.getOriginalStream('inexistente.jpg'),
            /no encontrado|not found|ENOENT/i
        );
    });

    await t.test('Defensa contra Directory Traversal (Path Traversal)', async () => {
        const maliciousPaths = [
            '../../etc/passwd',
            '..\\..\\windows\\system32\\cmd.exe',
            '/absoluto/peligro.jpg',
            'C:\\directorio\\peligro.jpg',
            'sub/../../fuera.jpg',
            'sub/%2e%2e/fuera.jpg'
        ];

        for (const malPath of maliciousPaths) {
            await assert.rejects(
                async () => driver.saveOriginal(Buffer.from('hack'), malPath),
                /traversal|seguridad|inválida|no permitida/i,
                `saveOriginal debe rechazar: ${malPath}`
            );

            await assert.rejects(
                async () => driver.getOriginalBuffer(malPath),
                /traversal|seguridad|inválida|no permitida/i,
                `getOriginalBuffer debe rechazar: ${malPath}`
            );

            await assert.rejects(
                async () => driver.getOriginalStream(malPath),
                /traversal|seguridad|inválida|no permitida/i,
                `getOriginalStream debe rechazar: ${malPath}`
            );

            await assert.rejects(
                async () => driver.deleteOriginal(malPath),
                /traversal|seguridad|inválida|no permitida/i,
                `deleteOriginal debe rechazar: ${malPath}`
            );
        }
    });
});

test('R2StorageDriver: Lanza error claro de "no implementado" y bloquea selección en NODE_ENV=production', async (t) => {
    const r2Driver = new R2StorageDriver({});

    const methods = [
        () => r2Driver.saveOriginal(Buffer.from('test'), { mimeType: 'image/jpeg' }),
        () => r2Driver.getOriginalStream('test.jpg'),
        () => r2Driver.getOriginalBuffer('test.jpg'),
        () => r2Driver.deleteOriginal('test.jpg'),
        () => r2Driver.existsOriginal('test.jpg'),
        () => r2Driver.getOriginalMetadata('test.jpg')
    ];

    for (const callMethod of methods) {
        await assert.rejects(
            async () => callMethod(),
            (err) => {
                assert.match(err.message, /no implementado/i);
                assert.equal(err.code, 'ERR_NOT_IMPLEMENTED');
                return true;
            },
            'Todos los métodos de R2StorageDriver deben lanzar error claro de no implementado'
        );
    }

    // Verificar bloqueo estricto cuando NODE_ENV=production
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        assert.throws(
            () => getStorageDriver('r2'),
            (err) => {
                assert.match(err.message, /no implementado.*NODE_ENV=production/i);
                assert.equal(err.code, 'ERR_NOT_IMPLEMENTED');
                return true;
            },
            'getStorageDriver("r2") debe fallar en NODE_ENV=production'
        );

        assert.throws(
            () => new R2StorageDriver({}),
            (err) => {
                assert.match(err.message, /no implementado.*NODE_ENV=production/i);
                assert.equal(err.code, 'ERR_NOT_IMPLEMENTED');
                return true;
            },
            'new R2StorageDriver() debe fallar directamente en NODE_ENV=production'
        );
    } finally {
        if (prevNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = prevNodeEnv;
        }
    }
});

test('LocalStorageDriver: Falla de verdad cuando no recibe carpeta explícita estando en NODE_ENV=test', () => {
    assert.equal(process.env.NODE_ENV, 'test', 'El entorno de pruebas debe tener NODE_ENV=test activo de antemano');

    const invalidCalls = [
        () => new LocalStorageDriver(),
        () => new LocalStorageDriver(null),
        () => new LocalStorageDriver({}),
        () => new LocalStorageDriver({ baseDir: '' }),
        () => new LocalStorageDriver({ baseDir: '   ' }),
        () => getStorageDriver('local'),
        () => getStorageDriver('local', {})
    ];

    for (const invoke of invalidCalls) {
        assert.throws(
            invoke,
            (err) => {
                assert.equal(err.code, 'ERR_TEST_STORAGE_REQUIRES_BASEDIR');
                assert.match(err.message, /baseDir.*NODE_ENV=test/i);
                return true;
            },
            'LocalStorageDriver debe fallar cuando falta options.baseDir en NODE_ENV=test'
        );
    }

    // También debe rechazar apuntar explícitamente a las carpetas reales del proyecto durante NODE_ENV=test
    for (const realDir of [REAL_PROTECTED_DIRS.originals, REAL_PROTECTED_DIRS.previews, REAL_PROTECTED_DIRS.thumbs]) {
        assert.throws(
            () => new LocalStorageDriver({ baseDir: realDir }),
            (err) => {
                assert.equal(err.code, 'ERR_TEST_STORAGE_FORBIDDEN_REAL_DIR');
                return true;
            },
            `LocalStorageDriver debe rechazar apuntar a carpeta real en NODE_ENV=test: ${realDir}`
        );
    }
});

test('getStorageDriver: Factory selector de drivers', async (t) => {
    const tmpFactoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-factory-test-'));
    t.after(() => {
        try {
            fs.rmSync(tmpFactoryDir, { recursive: true, force: true });
        } catch (_) {}
    });

    const local = getStorageDriver('local', { baseDir: tmpFactoryDir });
    assert.ok(local instanceof LocalStorageDriver, 'Debe devolver instancia de LocalStorageDriver');

    const r2 = getStorageDriver('r2', {});
    assert.ok(r2 instanceof R2StorageDriver, 'Debe devolver instancia de R2StorageDriver en entorno no productivo');

    assert.throws(
        () => getStorageDriver('desconocido'),
        /no soportado|driver desconocido/i,
        'Debe lanzar error para drivers no soportados'
    );
});

test('Migración 004: Sintaxis MariaDB 10.11, nota D1/SQLite y columnas requeridas (incluido mime_type)', async () => {
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '004_storage_and_orders.sql');
    assert.ok(fs.existsSync(migrationPath), 'El archivo de migración 004 debe existir');

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // 1. Verificar que NO contenga sentencias destructivas (DROP TABLE, DROP COLUMN)
    assert.doesNotMatch(sqlContent, /\bDROP\s+TABLE\b/i, 'La migración no debe contener DROP TABLE');
    assert.doesNotMatch(sqlContent, /\bDROP\s+COLUMN\b/i, 'La migración no debe contener DROP COLUMN');

    // 2. Verificar documentación de compatibilidad MariaDB 10.11 y Cloudflare D1 (SQLite)
    assert.match(sqlContent, /MariaDB\s+10\.11/i, 'Debe documentar el objetivo actual MariaDB 10.11');
    assert.match(sqlContent, /Cloudflare\s+D1.*SQLite/is, 'Debe documentar migración aparte para Cloudflare D1 (SQLite)');

    // 3. Verificar columnas requeridas en photos (incluyendo mime_type)
    const requiredPhotosCols = [
        'preview_url',
        'thumbnail_url',
        'original_path',
        'storage_driver',
        'mime_type',
        'file_size_bytes',
        'width',
        'height',
        'is_demo'
    ];
    for (const col of requiredPhotosCols) {
        assert.ok(
            sqlContent.toLowerCase().includes(col.toLowerCase()),
            `Migración 004 debe definir columna '${col}' en photos`
        );
    }

    // 4. Verificar columnas en orders
    assert.ok(
        sqlContent.toLowerCase().includes('expires_at'),
        "Migración 004 debe definir columna 'expires_at' en orders"
    );

    // 5. Verificar columnas en order_items
    assert.ok(
        sqlContent.toLowerCase().includes('download_count'),
        "Migración 004 debe definir columna 'download_count' en order_items"
    );
    assert.ok(
        sqlContent.toLowerCase().includes('last_downloaded_at'),
        "Migración 004 debe definir columna 'last_downloaded_at' en order_items"
    );
});

test('Aislamiento de carpetas reales: listado antes y después de ejecutar la suite coincide intacto', () => {
    const finalSnapshot = captureProtectedDirsSnapshot();

    assert.deepEqual(
        finalSnapshot.originals,
        initialProtectedDirsSnapshot.originals,
        'storage/originals no debe sufrir altas, bajas ni modificaciones durante la suite de pruebas'
    );
    assert.deepEqual(
        finalSnapshot.previews,
        initialProtectedDirsSnapshot.previews,
        'frontend/uploads/previews no debe sufrir altas, bajas ni modificaciones durante la suite de pruebas'
    );
    assert.deepEqual(
        finalSnapshot.thumbs,
        initialProtectedDirsSnapshot.thumbs,
        'frontend/uploads/thumbs no debe sufrir altas, bajas ni modificaciones durante la suite de pruebas'
    );
});
