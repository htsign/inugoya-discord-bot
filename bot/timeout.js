class Timeout {
  /** @type {Set<Timeout>} */
  #set;
  /** @type {number} */
  #timeout;
  /** @type {NodeJS.Timeout} */
  #timeoutId;

  /**
   * @constructor
   * @param {Set<Timeout>} set
   */
  constructor(set, timeout) {
    this.#set = set;
    this.#timeout = timeout;
    this.init();
  }

  init() {
    this.#set.add(this);
    this.#timeoutId = setTimeout(this.dispose.bind(this), this.#timeout);
  }

  dispose() {
    clearTimeout(this.#timeoutId);
    this.#set.delete(this);
  }
}

module.exports = { Timeout };
