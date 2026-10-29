import type { UpNextSnapshot } from './upNext';

// The web preview has no home screen.
export function registerWidgets() {}
export async function updateWidgets(snap: UpNextSnapshot) {
  void snap;
}
