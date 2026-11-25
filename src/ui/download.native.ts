/**
 * Android and iOS: write the JSON export to the app's cache folder and open the system share
 * sheet, so the family can save it to Files or Drive, or send it to themselves. Nothing is uploaded
 * by the app itself. The file is removed from the cache after sharing.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function downloadJson(name: string, data: unknown): Promise<'saved' | 'shared' | 'unavailable'> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '_');
  const file = new File(Paths.cache, safe);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Home Tutor export', UTI: 'public.json' });
    return 'shared';
  } finally {
    try {
      file.delete();
    } catch {
      // the share target may still be reading it; the OS clears the cache later
    }
  }
}
