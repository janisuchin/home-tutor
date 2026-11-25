/** In-memory Durable Object namespace for unit tests and the local test server (no Cloudflare needed). */
import { ClassroomRoom, type DONamespace, type DOStorage } from '../src/classroom';

class MemoryStorage implements DOStorage {
  private m = new Map<string, unknown>();
  async get<T>(key: string) {
    const v = this.m.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async put(key: string, value: unknown) {
    this.m.set(key, structuredClone(value));
  }
  async deleteAll() {
    this.m.clear();
  }
  async setAlarm() {}
}

export function createClassroomNamespace(): DONamespace & { objects: Map<string, ClassroomRoom> } {
  const objects = new Map<string, ClassroomRoom>();
  // A Durable Object handles one request at a time; a promise chain per object keeps that true here.
  const queues = new Map<string, Promise<unknown>>();
  return {
    objects,
    idFromName: (name: string) => name,
    get(id: unknown) {
      const name = String(id);
      if (!objects.has(name)) objects.set(name, new ClassroomRoom({ storage: new MemoryStorage() }));
      const obj = objects.get(name)!;
      return {
        fetch: (req: Request) => {
          const run = (queues.get(name) ?? Promise.resolve()).then(() => obj.fetch(req));
          queues.set(name, run.catch(() => {}));
          return run;
        },
      };
    },
  };
}
