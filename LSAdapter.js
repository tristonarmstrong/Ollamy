class LSAdapter {
  _systemPromptKey = "system-prompt";
  _hostAddress = "host-address";

  constructor() {}

  /** @returns {number} */
  get len() {
    return localStorage.length;
  }

  /** @param {string} key */
  get(key) {
    return localStorage.getItem(key);
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  set(key, value) {
    localStorage.setItem(key, value);
  }

  /**
   * @param {string} key
   */
  rm(key) {
    localStorage.removeItem(key);
  }

  get systemPrompt() {
    const a = this.get(this._systemPromptKey);
    if (!a) {
      /* show some toaster */
    }
    return a;
  }

  /** @param {string} prompt*/
  set systemPrompt(prompt) {
    this.set(this._systemPromptKey, ollama_host);
  }

  get hostAddress() {
    const a = this.get(this._hostAddress);
    if (!a) {
      this.hostAddress = "http://localhost:11434";
      /* show some toaster */
    }
    return a ?? "http://localhost:11434";
  }

  /** @param {string} ollama_host */
  set hostAddress(ollama_host) {
    this.set(this._hostAddress, ollama_host);
  }

  /** @param {string} chatKey */
  deleteChat(chatKey) {
    this.rm(chatKey);
  }

  /**
   * @param {string} chatName
   * @param {{history: string, context: string, system: string, model: string}} data
   */
  saveChat(chatName, data) {
    this.set(chatName, JSON.stringify(data));
  }
}
