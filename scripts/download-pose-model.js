#!/usr/bin/env node
/**
 * Downloads Google's official MediaPipe Pose Landmarker model into assets/models/.
 * The model is not committed to the repo (it's a ~5-6MB binary); run this once
 * before `expo prebuild` / a native build. See README.md for details.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
const DEST_DIR = path.join(__dirname, '..', 'assets', 'models');
const DEST_FILE = path.join(DEST_DIR, 'pose_landmarker_lite.task');

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
  console.log(`Downloading pose landmarker model to ${DEST_FILE} ...`);
  await download(MODEL_URL, DEST_FILE);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
