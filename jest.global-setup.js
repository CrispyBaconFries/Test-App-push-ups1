// Runs once in Jest's main process, before test workers are spawned - unlike a
// `setupFiles` entry (which runs inside each already-started worker process, too late
// for Node to pick up a changed TZ), this actually changes what timezone `Date` uses in
// the workers, since they inherit process.env at fork time. Used by
// src/storage/__tests__/workoutStorage.test.ts to test local-timezone day boundaries
// deterministically, regardless of the host machine's own timezone.
module.exports = async () => {
  process.env.TZ = 'Europe/Berlin';
};
