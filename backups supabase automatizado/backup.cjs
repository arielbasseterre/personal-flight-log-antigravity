const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runBackup() {
  console.log('🏁 Iniciando proceso de respaldo de Supabase...');

  // 1. Leer y parsear el archivo .env (ubicado en el directorio padre)
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: No se encontró el archivo .env en la raíz del proyecto.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value.trim();
    }
  });

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Error: Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env');
    process.exit(1);
  }

  // 2. Definir tablas a respaldar
  const tables = [
    'airports',
    'profiles',
    'flight_logs',
    'pending_registrations',
    'user_remote_sessions',
    'app_config',
    'arms_roster',
    'arms_sessions',
    'bug_reports',
    'push_tokens',
    'calendar_tokens'
  ];

  let dataSql = '\n-- ═══════════════════════════════════════════════════════════════════════════\n';
  dataSql += '-- SECCIÓN: INSERCIÓN DE DATOS DE LAS TABLAS\n';
  dataSql += '-- ═══════════════════════════════════════════════════════════════════════════\n\n';

  // Desactivar triggers temporalmente para evitar problemas de FK durante la restauración
  dataSql += 'SET session_replication_role = \'replica\';\n\n';

  // Limpiar tablas antes de insertar para evitar duplicados en reconstrucción limpia
  for (const table of tables) {
    dataSql += `TRUNCATE TABLE public.${table} CASCADE;\n`;
  }
  dataSql += '\n';

  // 3. Descargar datos de cada tabla mediante la API REST de Supabase (PostgREST)
  for (const table of tables) {
    console.log(`📥 Descargando datos de la tabla: ${table}...`);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const rows = await response.json();
      console.log(`   ✅ Descargados ${rows.length} registros.`);
      dataSql += generateInserts(table, rows);
    } catch (error) {
      console.error(`❌ Error al descargar la tabla ${table}:`, error.message);
      dataSql += `-- ERROR AL RESPALDAR TABLA ${table}: ${error.message}\n\n`;
    }
  }

  // Reactivar triggers
  dataSql += 'SET session_replication_role = \'origin\';\n';

  // 4. Leer esquema base consolidado (en el mismo directorio)
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Error: No se encontró el archivo de esquema base en backups/schema.sql');
    process.exit(1);
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // 5. Combinar esquema y datos
  const fullSql = `${schemaSql}\n${dataSql}`;

  // 6. El directorio de backups es el directorio actual (__dirname)
  const backupsDir = __dirname;

  // 7. Escribir archivo SQL temporal
  const dateStr = getLocalDateString();
  const sqlFileName = `restore_${dateStr}.sql`;
  const sqlFilePath = path.join(backupsDir, sqlFileName);
  fs.writeFileSync(sqlFilePath, fullSql, 'utf8');
  console.log(`💾 Archivo SQL generado temporalmente: backups/${sqlFileName}`);

  // 8. Comprimir a ZIP usando comandos del sistema (PowerShell en Windows)
  const zipFileName = `backup_${dateStr}.zip`;
  const zipFilePath = path.join(backupsDir, zipFileName);

  console.log(`🤐 Comprimiendo a ZIP: backups/${zipFileName}...`);
  try {
    // Usar Compress-Archive de PowerShell (nativo en Windows)
    const cmd = `powershell -Command "Compress-Archive -Path '${sqlFilePath}' -DestinationPath '${zipFilePath}' -Force"`;
    execSync(cmd);
    console.log(`🎉 Respaldo completado con éxito: backups/${zipFileName}`);
    
    // Eliminar el archivo SQL temporal
    fs.unlinkSync(sqlFilePath);
  } catch (compressError) {
    console.error('⚠️ Advertencia: No se pudo comprimir automáticamente a ZIP. El archivo SQL se mantendrá.', compressError.message);
  }
}

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') {
    return `'${val.replace(/'/g, "''")}'`;
  }
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return val;
}

function generateInserts(tableName, rows) {
  if (!rows || rows.length === 0) return `-- Sin datos para ${tableName}\n\n`;

  let sql = `-- Datos para ${tableName}\n`;
  const columns = Object.keys(rows[0]);

  // Agrupar inserciones en lotes de 100 filas
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    sql += `INSERT INTO public.${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n`;
    sql += batch.map(row => {
      return `  (${columns.map(c => escapeValue(row[c])).join(', ')})`;
    }).join(',\n') + ';\n';
  }
  return sql + '\n';
}

function getLocalDateString() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now - tzOffset)).toISOString();
  return localISOTime.replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
}

runBackup();
