export const isBusyOrLocked = (error: unknown): error is Error & { code: string, errcode: number } => {
  if (error instanceof Error && 'code' in error && 'errcode' in error) {
    const { code, errcode } = error;
    if (typeof code !== 'string' || typeof errcode !== 'number') return false;

    return code === 'ERR_SQLITE_ERROR' && ((errcode & 0xff) === 5 || (errcode & 0xff) === 6);
  }
  return false;
};
