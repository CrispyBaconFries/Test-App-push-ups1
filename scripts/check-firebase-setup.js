#!/usr/bin/env node
/**
 * Prüft die Firebase-Einrichtung, bevor gebaut wird - und sagt bei jedem Fehler genau,
 * was zu tun ist.
 *
 * Warum es dieses Skript gibt: Die drei Stolperstellen bei Firebase + Google-Anmeldung
 * scheitern alle *lautlos*. Die App startet, meldet aber "Anmeldung fehlgeschlagen" ohne
 * weiteren Hinweis, und im Release-Build gibt es kein Log zum Nachsehen. Die drei sind:
 *
 *   1. `google-services.json` liegt am falschen Ort oder gehört zu einem anderen
 *      Paketnamen als `app.json` → android.package.
 *   2. Der Web-Client-Schlüssel steht nicht in `app.json` → extra.googleSignInWebClientId.
 *      Ohne ihn schlägt die Google-Anmeldung fehl, obwohl Firebase korrekt eingerichtet ist.
 *   3. Der SHA-1-Fingerabdruck des Signaturschlüssels ist nicht in der Firebase-Konsole
 *      hinterlegt. Erkennbar daran, dass in `google-services.json` gar kein
 *      Android-OAuth-Eintrag steht.
 *
 * Alle drei lassen sich aus `google-services.json` und `app.json` ablesen, ohne irgendetwas
 * zu starten. Aufruf:  npm run firebase:check
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const GOOGLE_SERVICES = path.join(ROOT, 'google-services.json');
const APP_JSON = path.join(ROOT, 'app.json');

const OAUTH_CLIENT_TYPE_ANDROID = 1;
const OAUTH_CLIENT_TYPE_WEB = 3;

const problems = [];
const notes = [];

function fail(title, ...lines) {
  problems.push({ title, lines });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const appJson = readJson(APP_JSON);
const expectedPackage = appJson.expo?.android?.package;
const configuredWebClientId = appJson.expo?.extra?.googleSignInWebClientId ?? '';

console.log('Firebase-Einrichtung prüfen');
console.log('===========================\n');
console.log(`Paketname laut app.json:  ${expectedPackage}`);

// --- 1. google-services.json ------------------------------------------------------
if (!fs.existsSync(GOOGLE_SERVICES)) {
  fail(
    'google-services.json fehlt',
    'Sie gehört ins Projekt-Wurzelverzeichnis (dieselbe Ebene wie app.json und package.json),',
    'NICHT nach android/ - der Ordner wird bei jedem Prebuild neu erzeugt.',
    'Erwartet unter: ' + GOOGLE_SERVICES,
    '',
    'Herunterladen: Firebase-Konsole → Zahnrad → Projekteinstellungen → Meine Apps →',
    'die Android-App auswählen → "google-services.json" herunterladen.'
  );
  report();
  process.exit(1);
}

const googleServices = readJson(GOOGLE_SERVICES);
const projectId = googleServices.project_info?.project_id ?? '(unbekannt)';
console.log(`Firebase-Projekt:         ${projectId}`);

const clients = googleServices.client ?? [];
const client = clients.find((c) => c.client_info?.android_client_info?.package_name === expectedPackage);

if (!client) {
  const found = clients
    .map((c) => c.client_info?.android_client_info?.package_name)
    .filter(Boolean)
    .join(', ');
  fail(
    'google-services.json gehört zu einem anderen Paketnamen',
    `In app.json steht: ${expectedPackage}`,
    `In der Datei steht: ${found || '(gar kein Android-Eintrag)'}`,
    '',
    'In der Firebase-Konsole eine Android-App mit GENAU diesem Paketnamen anlegen',
    `(${expectedPackage}) und die Datei danach neu herunterladen.`
  );
  report();
  process.exit(1);
}

console.log('google-services.json:     gefunden, Paketname passt\n');

// --- 2. Web-Client-Schlüssel für die Google-Anmeldung ------------------------------
const oauthClients = client.oauth_client ?? [];
const webClient = oauthClients.find((c) => c.client_type === OAUTH_CLIENT_TYPE_WEB);
const androidClient = oauthClients.find((c) => c.client_type === OAUTH_CLIENT_TYPE_ANDROID);

if (!webClient) {
  fail(
    'Kein Web-Client in google-services.json',
    'Das heißt fast immer: Die Anmeldemethode "Google" ist im Firebase-Projekt noch nicht',
    'aktiviert. Firebase-Konsole → Authentication → Sign-in method → Google → aktivieren,',
    'dann google-services.json NEU herunterladen (die alte Datei enthält den Eintrag nicht).'
  );
} else if (configuredWebClientId !== webClient.client_id) {
  fail(
    'app.json → expo.extra.googleSignInWebClientId stimmt nicht',
    'Diesen Wert dort eintragen (kompletter String, mit Anführungszeichen):',
    '',
    '    "googleSignInWebClientId": "' + webClient.client_id + '"',
    '',
    configuredWebClientId.startsWith('REPLACE_WITH')
      ? 'Aktuell steht dort noch der Platzhalter aus dem Repository.'
      : `Aktuell steht dort: ${configuredWebClientId}`
  );
} else {
  console.log('Web-Client-Schlüssel:     stimmt mit app.json überein');
}

// --- 3. SHA-1-Fingerabdruck -------------------------------------------------------
const hasKeystoreProperties = fs.existsSync(path.join(ROOT, 'keystore.properties'));

if (!androidClient) {
  const debugKeystore = path.join(os.homedir(), '.android', 'debug.keystore');
  fail(
    'Kein SHA-1-Fingerabdruck in der Firebase-Konsole hinterlegt',
    'Ohne ihn lässt Google die Anmeldung aus dieser App nicht zu - die App startet normal,',
    'aber jede Anmeldung schlägt fehl.',
    '',
    hasKeystoreProperties
      ? 'Diese Arbeitskopie hat eine keystore.properties, der Release-Build wird also mit'
      : 'Diese Arbeitskopie hat KEINE keystore.properties. Der Release-Build wird deshalb mit',
    hasKeystoreProperties
      ? 'DEINEM Release-Schlüssel signiert - dessen SHA-1 wird gebraucht (siehe README,'
      : 'dem Debug-Schlüssel signiert (so ist das Fallback in plugins/withReleaseSigning.js',
    hasKeystoreProperties
      ? '"Play-Store-Veröffentlichung", keytool -list -v -keystore <dein storeFile>).'
      : 'gebaut). Dessen SHA-1 zeigt dieser Befehl:',
    ...(hasKeystoreProperties
      ? []
      : [
          '',
          `    keytool -list -v -keystore "${debugKeystore}" -alias androiddebugkey -storepass android -keypass android`,
        ]),
    '',
    'Die Zeile "SHA1: ..." kopieren → Firebase-Konsole → Projekteinstellungen → Meine Apps',
    '→ Android-App → "Fingerabdruck hinzufügen" → einfügen → danach google-services.json',
    'NEU herunterladen und die alte ersetzen.'
  );
} else {
  console.log('SHA-1-Fingerabdruck:      hinterlegt');
  if (!hasKeystoreProperties) {
    notes.push(
      'Der Release-Build wird mangels keystore.properties mit dem Debug-Schlüssel signiert. ' +
        'Sobald du für den Play Store einen eigenen Release-Schlüssel anlegst, muss dessen ' +
        'SHA-1 zusätzlich in der Firebase-Konsole hinterlegt werden - sonst funktioniert die ' +
        'Anmeldung in der Play-Store-Version nicht mehr.'
    );
  }
}

// --- 4. Regeln und Indexe ---------------------------------------------------------
for (const file of ['firestore.rules', 'firestore.indexes.json', 'database.rules.json', 'firebase.json']) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    fail(`${file} fehlt`, 'Die Datei gehört zum Repository - fehlt sie, ist etwas mit der Arbeitskopie nicht in Ordnung.');
  }
}

if (!fs.existsSync(path.join(ROOT, '.firebaserc'))) {
  notes.push(
    'Noch kein Firebase-Projekt für die CLI ausgewählt. Einmalig ausführen:  firebase use --add  ' +
      '(danach funktioniert `firebase deploy --only firestore:rules,firestore:indexes,database`).'
  );
}

report();
process.exit(problems.length > 0 ? 1 : 0);

function report() {
  console.log('');
  if (problems.length === 0) {
    console.log('Alles in Ordnung. Nächster Schritt: Regeln deployen, dann neu bauen.');
    console.log('  firebase deploy --only firestore:rules,firestore:indexes,database');
    console.log('  npx expo prebuild --clean');
    console.log('  npm run android:release');
  } else {
    console.log(`${problems.length} Punkt(e) offen:\n`);
    problems.forEach((p, i) => {
      console.log(`${i + 1}. ${p.title}`);
      p.lines.forEach((line) => console.log(line ? `   ${line}` : ''));
      console.log('');
    });
  }
  if (notes.length > 0) {
    console.log('Hinweise:');
    notes.forEach((n) => console.log(`  - ${n}`));
    console.log('');
  }
}
