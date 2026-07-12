const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const backupsDir = __dirname;

// 1. Buscar todos los archivos de respaldo .zip
const files = fs.readdirSync(backupsDir)
  .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
  .sort()
  .reverse();

if (files.length === 0) {
  console.log('❌ No se encontraron archivos de respaldo (.zip) en la carpeta backups/.');
  process.exit(0);
}

console.log('📂 Respaldos disponibles (el más reciente primero):');
files.forEach((file, index) => {
  console.log(`  [${index + 1}] ${file}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\n👉 Selecciona el número del respaldo que deseas extraer: ', (answer) => {
  const choice = parseInt(answer, 10) - 1;
  if (isNaN(choice) || choice < 0 || choice >= files.length) {
    console.log('❌ Selección inválida.');
    rl.close();
    process.exit(1);
  }

  const selectedZip = files[choice];
  const zipPath = path.join(backupsDir, selectedZip);
  
  console.log(`\n📦 Extrayendo ${selectedZip}...`);
  try {
    // Extraer el zip usando PowerShell (nativo en Windows)
    const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${backupsDir}' -Force"`;
    execSync(cmd);
    
    // El nombre del archivo SQL correspondiente
    const sqlFileName = selectedZip.replace('backup_', 'restore_').replace('.zip', '.sql');
    const sqlFilePath = path.join(backupsDir, sqlFileName);
    
    if (fs.existsSync(sqlFilePath)) {
      console.log(`\n✨ ¡Archivo SQL extraído con éxito!`);
      console.log(`📍 Ubicación: backups/${sqlFileName}`);
      console.log('\n══════════════════════════════════════════════════════════');
      console.log('   INSTRUCCIONES PARA RESTAURAR EN SUPABASE');
      console.log('══════════════════════════════════════════════════════════');
      console.log('1. Abre el panel de tu proyecto en Supabase (https://supabase.com).');
      console.log('2. Ve a la sección "SQL Editor" (menú lateral izquierdo).');
      console.log('3. Crea una nueva pestaña presionando "New query".');
      console.log(`4. Abre el archivo 'backups/${sqlFileName}' con un editor de texto.`);
      console.log('5. Copia todo su contenido y pégalo en el SQL Editor de Supabase.');
      console.log('6. Presiona el botón "Run" en Supabase para aplicar los cambios.');
      console.log('══════════════════════════════════════════════════════════\n');
      
      // Abrir el explorador de archivos en la carpeta de backups
      execSync(`explorer "${backupsDir}"`);
    } else {
      console.log('❌ Ocurrió un error: No se encontró el archivo SQL tras la extracción.');
    }
  } catch (error) {
    console.error('❌ Error al extraer el archivo:', error.message);
  }
  
  rl.close();
});
