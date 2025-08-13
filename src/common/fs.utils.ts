import { constants as fsConst, promises as fs } from 'node:fs';

export async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path, fsConst.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Надёжный unlink с небольшими повторами, чтобы не падать на EBUSY/EPERM
 * (часто бывает на Windows сразу после записи файла).
 */
export async function safeUnlink(
  path: string,
  retries = 5,
  delayMs = 120,
): Promise<void> {
  if (!(await fileExists(path))) return;
  for (let i = 0; i <= retries; i++) {
    try {
      await fs.unlink(path);
      return;
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const code = e?.code as string | undefined;
      if (
        i < retries &&
        (code === 'EBUSY' || code === 'EPERM' || code === 'ENOENT')
      ) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      // не зашло — логика выше уже дала несколько попыток
      break;
    }
  }
}
