export const dashboardNumberFormat = new Intl.NumberFormat();

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const remainingMinutes = String(minutes % 60).padStart(2, "0");
  return `${Math.floor(minutes / 60)}h ${remainingMinutes}m`;
}
