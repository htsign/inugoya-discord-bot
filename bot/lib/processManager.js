import { ChildProcess } from 'node:child_process';

class ProcessManager {
  /** @type {Set<ChildProcess>} */
  #processes = new Set();

  /**
   * @param {ChildProcess | null} process
   * @returns {boolean}
   */
  add(process) {
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
