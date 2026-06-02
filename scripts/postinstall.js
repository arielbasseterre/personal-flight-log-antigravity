/**
 * Postinstall script to patch Capacitor plugins for AGP 9.x compatibility.
 * 
 * AGP 9.x removed support for getDefaultProguardFile('proguard-android.txt').
 * This script patches affected plugins in node_modules to use
 * 'proguard-android-optimize.txt' instead.
 */

const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: path.join(__dirname, 'node_modules', '@capacitor', 'push-notifications', 'android', 'build.gradle'),
    search: "getDefaultProguardFile('proguard-android.txt')",
    replace: "getDefaultProguardFile('proguard-android-optimize.txt')",
  },
];

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    console.log(`[postinstall] Skipping (not found): ${patch.file}`);
    continue;
  }

  let content = fs.readFileSync(patch.file, 'utf8');

  if (!content.includes(patch.search)) {
    console.log(`[postinstall] Already patched: ${path.basename(path.dirname(path.dirname(patch.file)))}`);
    continue;
  }

  content = content.replace(patch.search, patch.replace);
  fs.writeFileSync(patch.file, content, 'utf8');
  console.log(`[postinstall] Patched: ${path.basename(path.dirname(path.dirname(patch.file)))} (proguard-android.txt -> proguard-android-optimize.txt)`);
}
