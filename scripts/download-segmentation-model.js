#!/usr/bin/env node
/**
 * Downloads Google's official MediaPipe "selfie segmenter" model into assets/models/
 * (~244KB). Used by the Boss-Modus's person-segmentation compositing (see
 * src/bossmode/useBossFightCamera.ts) - a *different* model from the Pose Landmarker
 * one (see download-pose-model.js), loaded via react-native-fast-tflite instead of
 * react-native-mediapipe, since the installed react-native-mediapipe version doesn't
 * actually deliver segmentation masks despite exposing the option for it (see README
 * "Boss-Modus" for that whole story). Not committed to the repo; run this once before
 * `expo prebuild` / a native build.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const DEST_DIR = path.join(__dirname, '..', 'assets', 'models');
const DEST_FILE = path.join(DEST_DIR, 'selfie_segmenter.tflite');

function download(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          res.resume();
          download(res.headers.location, dest, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  if (fs.existsSync(DEST_FILE)) {
    console.log(`Model already present at ${DEST_FILE}, skipping download.`);
    return;
  }
  console.log(`Downloading selfie segmenter model to ${DEST_FILE} ...`);
  await download(MODEL_URL, DEST_FILE);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
