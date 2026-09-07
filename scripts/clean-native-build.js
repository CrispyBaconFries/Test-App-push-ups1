#!/usr/bin/env node
/**
 * Löscht den zwischengespeicherten CMake-/Ninja-Zustand der nativen Module.
 *
 * Warum das nötig ist: `expo prebuild --clean` räumt nur `android/` ab. Die
 * CMake-Arbeitsverzeichnisse der nativen Abhängigkeiten liegen aber in
 * `node_modules/<paket>/android/.cxx/` und überleben deshalb jeden „sauberen"
 * Rebuild - inklusive `npm install`, das die Dateien darunter unter den Füßen
 * austauscht.
 *
 * Typisches Symptom, wenn dieser Zustand veraltet ist: unerklärliche CMake-/ninja-Fehler,
 * die nach einem `expo prebuild --clean` unverändert wiederkehren, obwohl das Projekt
 * angeblich frisch generiert wurde.
 *
 * Nicht dafür zuständig ist dagegen
 *
 *   Execution failed for task ':react-native-vision-camera:buildCMakeRelWithDebInfo[arm64-v8a]'.
 *   > ninja: error: manifest 'build.ninja' still dirty after 100 tries
 *
 * - das war die ursprüngliche Vermutung, sie ist aber widerlegt: Der Fehler trat auch nach
 * einem vollständigen `clean:native` unverändert auf. Die echte Ursache und ihre Behebung
 * stehen in `plugins/withCmakeSuppressRegeneration.js` und
 * `patches/react-native-worklets-core+1.6.3.patch`.
 *
 * Gelöscht werden ausschließlich Build-Artefakte (`.cxx` und `build` unterhalb von
 * `node_modules/<paket>/android/`), die beim nächsten Build automatisch neu
 * erzeugt werden. Quellcode wird nicht angefasst.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nodeModules = path.join(projectRoot, 'node_modules');
const ARTIFACT_DIRS = ['.cxx', 'build'];

/** Alle Paketverzeichnisse in node_modules, inklusive @scope/paket. */
function packageDirs(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    if (entry.name.startsWith('@')) {
      for (const scoped of fs.readdirSync(full, { withFileTypes: true })) {
        if (scoped.isDirectory()) result.push(path.join(full, scoped.name));
      }
    } else if (entry.name !== '.bin') {
      result.push(full);
    }
  }
  return result;
}

let removed = 0;
const targets = [];

for (const pkg of packageDirs(nodeModules)) {
  for (const artifact of ARTIFACT_DIRS) {
    targets.push(path.join(pkg, 'android', artifact));
  }
}
// Das App-Modul selbst (falls android/ gerade existiert - nach prebuild --clean nicht).
targets.push(path.join(projectRoot, 'android', 'app', '.cxx'));

for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`  entfernt: ${path.relative(projectRoot, target)}`);
  removed += 1;
}

if (removed === 0) {
  console.log('Kein zwischengespeicherter CMake-Zustand gefunden - nichts zu tun.');
} else {
  console.log(`\n${removed} Build-Verzeichnis(se) entfernt. Der nächste Build erzeugt sie neu (dauert dadurch länger).`);
}
