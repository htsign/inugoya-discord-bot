import type { DatabaseSync } from 'node:sqlite';

export const runInTransaction = (db: DatabaseSync, fn: () => void): void => {
  try {
    db.exec('begin');
    fn();
    db.exec('commit');
  }
  catch (e) {
    if (db.isTransaction) db.exec('rollback');
    throw e;
  }
};

export const isBusyOrLocked = (error: unknown): error is Error & { code: string, errcode: number } => {
  if (error instanceof Error && 'code' in error && 'errcode' in error) {
    const { code, errcode } = error;
    if (typeof code !== 'string' || typeof errcode !== 'number') return false;

    // errcode carries SQLite's extended result code; mask to the low byte to match on the primary code
    // (SQLITE_BUSY = 5 / SQLITE_LOCKED = 6; extended codes such as SQLITE_BUSY_SNAPSHOT = 261 also reduce to 5 / 6)
    return code === 'ERR_SQLITE_ERROR' && ((errcode & 0xff) === 5 || (errcode & 0xff) === 6);
  }
  return false;
};
