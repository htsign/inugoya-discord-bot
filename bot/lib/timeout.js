/**
 * @class Timeout
 * @template T
 */
class Timeout {
  /** @type {(instance: Timeout<T>) => T} */
  #callback;
  /** @type {number} */
  #timeout;
  /** @type {NodeJS.Timeout} */
  #timeoutId;

  /**
   * @constructor
   * @param {(instance: Timeout<T>) => T} callback
   * @param {number} timeout
   */
  constructor(callback, timeout) {
    this.#callback = callback;
    this.#timeout = timeout;
    this.#timeoutId = setTimeout(this.fire.bind(this), this.#timeout);
  }

  /**
   * fire the callback
   * @returns {T}
   */
  fire() {
    clearTimeout(this.#timeoutId);
    return this.#callback(this);
  }

  cancel() {
    clearTimeout(this.#timeoutId);
  }
}

module.exports = { Timeout };
