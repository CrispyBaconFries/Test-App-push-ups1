import { Delegate, type PoseDetectionOptions } from 'react-native-mediapipe';

/**
 * Das MediaPipe-Pose-Modell. Wird von `plugins/withPoseLandmarkerModel.js` beim
 * `expo prebuild` nativ mitgepackt (siehe README) - der Name muss zu der Datei in
 * `assets/models/` passen.
 */
export const POSE_MODEL = 'pose_landmarker_lite.task';

/**
 * Gemeinsame Detektor-Einstellungen für alle Kamera-Screens (Training, Boss-Modus,
 * Duell). Bewusst an einer Stelle, damit eine Nachjustierung nicht in drei Dateien
 * einzeln nachgezogen werden muss - und nicht wieder auseinanderläuft.
 */
export const POSE_DETECTION_OPTIONS: Partial<PoseDetectionOptions> = {
  delegate: Delegate.GPU,
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  mirrorMode: 'mirror-front-only',
  /**
   * Auf dem echten Gerät gemessen: Solange VisionCamera `portrait` meldet, erkennt
   * MediaPipe die Person zuverlässig; sobald der Lagesensor auf `landscape-left`
   * umspringt, kommt über hunderte Frames am Stück gar keine Pose mehr zurück
   * (sichtbar als Dauerfeuer von `onEmpty`). Der Sensorwert schwankt beim Liegestütz
   * ständig, weil das Handy dabei bewegt oder gekippt wird - die Erkennung fiel also
   * regelmäßig komplett aus.
   *
   * Die App ist in app.json ohnehin fest auf `orientation: "portrait"` gesperrt, die
   * Oberfläche dreht sich also nie. Damit ist es nicht nur unschädlich, sondern
   * korrekt, die Orientierung hier festzunageln statt dem Sensor zu folgen: MediaPipe
   * bekommt eine stabile Rotation, und der `BaseViewCoordinator` rechnet die Landmarks
   * gegen genau die Ausrichtung um, die die Ansicht tatsächlich hat (was nebenbei auch
   * das Skelett-Overlay ruhigstellt).
   */
  forceOutputOrientation: 'portrait',
};
