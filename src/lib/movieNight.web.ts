// The web preview has no notifications: a movie night is still planned, just without the reminder.
export async function scheduleMovieNight(t: { title: string; sourceId: string }, at: Date): Promise<string | null> {
  void t;
  void at;
  return null;
}
export async function cancelMovieNight(id: string | null) {
  void id;
}
export function useMovieNightTaps() {}
