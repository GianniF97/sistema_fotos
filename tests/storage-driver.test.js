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

    await t.test('Guarda y lee un original desde Buffer intacto byte a byte', async () => {
        const originalBytes = crypto.randomBytes(1024 * 64); // 64 KB de datos binarios
        const originalHash = crypto.createHash('sha256').update(originalBytes).digest('hex');
        const filename = 'foto-test-01.jpg';

        const saveResult = await driver.saveOriginal(originalBytes, filename, {
            mimeType: 'image/jpeg'
        });

        assert.equal(saveResult.driver, 'local');
        assert.equal(saveResult.path, filename);
        assert.equal(saveResult.sizeBytes, 1024 * 64);

        // Comprobar existencia en disco
        const exists = await driver.existsOriginal(filename);
        assert.equal(exists, true);

        // Leer buffer y verificar integridad criptográfica
        const readBuffer = await driver.getOriginalBuffer(filename);
        const readHash = crypto.createHash('sha256').update(readBuffer).digest('hex');
        assert.equal(readHash, originalHash, 'Los bytes leídos deben ser exactamente idénticos al original');

        // Metadatos
        const meta = await driver.getOriginalMetadata(filename);
        assert.equal(meta.sizeBytes, 1024 * 64);
        assert.ok(meta.createdAt instanceof Date || typeof meta.createdAt === 'string');
    });

    await t.test('Guarda y lee un original desde Stream intacto byte a byte', async () => {
        const originalBytes = crypto.randomBytes(1024 * 32);
        const originalHash = crypto.createHash('sha256').update(originalBytes).digest('hex');
        const filename = 'subcarpeta/foto-stream.jpg';

        const stream = Readable.from(originalBytes);
        const saveResult = await driver.saveOriginal(stream, filename, {
            mimeType: 'image/jpeg'
        });

        assert.equal(saveResult.path, filename);
        assert.equal(saveResult.sizeBytes, 1024 * 32);

        // Leer como stream
        const readStream = await driver.getOriginalStream(filename);
        const chunks = [];
        for await (const chunk of readStream) {
            chunks.push(chunk);
        }
        const streamedBuffer = Buffer.concat(chunks);
        const streamedHash = crypto.createHash('sha256').update(streamedBuffer).digest('hex');
        assert.equal(streamedHash, originalHash, 'El stream debe entregar los bytes exactos sin mutaciones');
    });

    await t.test('Elimina un archivo original existente', async () => {
        const filename = 'a-eliminar.jpg';
        await driver.saveOriginal(Buffer.from('contenido'), filename);
        assert.equal(await driver.existsOriginal(filename), true);

        const deleted = await driver.deleteOriginal(filename);
        assert.equal(deleted, true);
        assert.equal(await driver.existsOriginal(filename), false);

        // Eliminar archivo que ya no existe no debe explotar, debe devolver false
        const deletedAgain = await driver.deleteOriginal(filename);
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

test('R2StorageDriver: Implementación desacoplada Cloudflare R2', async (t) => {
    const unconfiguredDriver = new R2StorageDriver({});

    await assert.rejects(
        async () => unconfiguredDriver.saveOriginal(Buffer.from('test'), 'test.jpg'),
        /R2 no configurado|credenciales de R2 requeridas/i,
        'Debe requerir credenciales válidas de R2'
    );
});

test('getStorageDriver: Factory selector de drivers', async (t) => {
    const local = getStorageDriver('local', { baseDir: os.tmpdir() });
    assert.ok(local instanceof LocalStorageDriver, 'Debe devolver instancia de LocalStorageDriver');

    const r2 = getStorageDriver('r2', {});
    assert.ok(r2 instanceof R2StorageDriver, 'Debe devolver instancia de R2StorageDriver');

    assert.throws(
        () => getStorageDriver('desconocido'),
        /no soportado|driver desconocido/i,
        'Debe lanzar error para drivers no soportados'
    );
});

test('Migración 004: Sintaxis y columnas requeridas de la Fase 2', async (t) => {
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '004_storage_and_orders.sql');
    assert.ok(fs.existsSync(migrationPath), 'El archivo de migración 004 debe existir');

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // 1. Verificar que NO contenga sentencias destructivas (DROP TABLE, DROP COLUMN)
    assert.doesNotMatch(sqlContent, /\bDROP\s+TABLE\b/i, 'La migración no debe contener DROP TABLE');
    assert.doesNotMatch(sqlContent, /\bDROP\s+COLUMN\b/i, 'La migración no debe contener DROP COLUMN');

    // 2. Verificar columnas requeridas en photos
    const requiredPhotosCols = [
        'preview_url',
        'thumbnail_url',
        'original_path',
        'storage_driver',
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

    // 3. Verificar columnas en orders
    assert.ok(
        sqlContent.toLowerCase().includes('expires_at'),
        "Migración 004 debe definir columna 'expires_at' en orders"
    );

    // 4. Verificar columnas en order_items
    assert.ok(
        sqlContent.toLowerCase().includes('download_count'),
        "Migración 004 debe definir columna 'download_count' en order_items"
    );
    assert.ok(
        sqlContent.toLowerCase().includes('last_downloaded_at'),
        "Migración 004 debe definir columna 'last_downloaded_at' en order_items"
    );
});
