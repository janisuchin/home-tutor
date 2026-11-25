/** Saves a JSON export: a file download on the web, the system share sheet on Android and iOS. */
export declare function downloadJson(name: string, data: unknown): Promise<'saved' | 'shared' | 'unavailable'>;
