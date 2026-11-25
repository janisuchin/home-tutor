/** Web: save JSON as a downloaded file. The native version (download.native.ts) uses the share sheet. */
export async function downloadJson(name: string, data: unknown): Promise<'saved' | 'shared' | 'unavailable'> {
  if (typeof document === 'undefined') return 'unavailable';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
