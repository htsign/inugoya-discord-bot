import { ChildProcess } from 'node:child_process';

class ProcessManager {
  #processes = new Set<ChildProcess>();

  add(process: ChildProcess | null): boolean {
    if (process == null || this.#processes.has(process)) {
      return false;
    }
    this.#processes.add(process);
    return true;
  }

  killAll() {
    for (const process of this.#processes) {
      process?.kill();
    }
    this.#processes.clear();
  }
}

const instance = new ProcessManager();

export { instance };
