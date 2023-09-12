import { ChildProcess } from 'node:child_process';

class ProcessManager {
  #processes = new Set<ChildProcess>();

  add(process: ChildProcess): boolean {
    if (this.#processes.has(process)) {
      return false;
    }
    this.#processes.add(process);
    return true;
  }

  killAll() {
    for (const process of this.#processes) {
      process.kill();
    }
  }
}

const instance = new ProcessManager();

export { instance };
