export class Timeout<T> {
  #callback: (instance: Timeout<T>) => T;
  #timeout: number;
  #timeoutId: NodeJS.Timeout;

  constructor(callback: (instance: Timeout<T>) => T, timeout: number) {
    this.#callback = callback;
    this.#timeout = timeout;
    this.#timeoutId = setTimeout(this.fire.bind(this), this.#timeout);
  }

  fire(): T {
    clearTimeout(this.#timeoutId);
    return this.#callback(this);
  }

  cancel() {
    clearTimeout(this.#timeoutId);
  }
}
