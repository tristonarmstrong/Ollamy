class ChatUI {
  /** @type {LSAdapter} */
  localStorageAdapter;
  /** @type {OllamaAdapter} */
  OllamaAdapter;

  userInputField = document.getElementById("user-input");
  systemPromptField = document.getElementById("system-prompt");
  /**@type {HTMLSelectElement}*/ historySelectField =
    document.getElementById("chat-select");
  hostAddressField = document.getElementById("host-address");
  modelSelectField = document.getElementById("model-select");

  sendButton = document.getElementById("send-button");
  deleteButton = document.getElementById("delete-chat");
  resetButton = document.getElementById("new-chat");
  saveButton = document.getElementById("save-chat");

  chatHistory = document.getElementById("chat-history");
  chatContainer = document.getElementById("chat-container");

  constructor() {
    this.localStorageAdapter = new LSAdapter();
    this.OllamaAdapter = new OllamaAdapter(this.localStorageAdapter);

    marked.use({
      // https://github.com/markedjs/marked/issues/2793
      mangle: false,
      headerIds: false,
    });

    this.initListeners();
    this.prepopulateFields();
  }

  prepopulateFields() {
    this.systemPromptField.value =
      this.localStorageAdapter.systemPrompt ?? "You are a helpful assistant";
    this.hostAddressField =
      this.localStorageAdapter.hostAddress ?? "http://localhost:11434";
    this.populateModels();
    this.updateChatList();
  }

  initListeners = () => {
    // buttons
    this.deleteButton.addEventListener("click", this.deleteChat);
    this.saveButton.addEventListener("click", this.saveChat);
    this.resetButton.addEventListener("click", this.startNewChat);

    // fields
    this.historySelectField.addEventListener("change", this.loadSelectedChat);
    this.hostAddressField.addEventListener("change", this.setHostAddress);
    this.systemPromptField.addEventListener("change", this.setSystemPrompt);

    // Event listener for Ctrl + Enter or CMD + Enter
    this.sendButton.addEventListener("click", this.submitRequest);
    this.userInputField.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        this.submitRequest();
      }
    });
  };

  initChat() {
    this.chatHistory.innerHTML = null;
    this.chatHistory.context = null;
    this.chatContainer.style.display = "none";
    //updateChatList();
    return this;
  }

  autoFocusInput() {
    this.userInputField.focus();
  }

  /*** @param {Model} model*/
  createModelOption(model) {
    const option = document.createElement("option");
    option.value = model.name;
    option.innerText = model.name;
    this.modelSelectField.appendChild(option);
  }

  // Fetch available models and populate the dropdown
  async populateModels() {
    const /**@type{Model}*/ data = await this.OllamaAdapter.getModels().catch(
        (e) => e,
      );
    if (data instanceof Error) {
      return console.error("[CUSTOM ERROR]: ", data);
    }

    data.models.forEach((model) => {
      this.createModelOption(model);
    });
  }

  getSelectedModel() {
    return this.modelSelectField.value;
  }

  /** @param {string} copyText  */
  createCopyButton(copyText) {
    let copyButton = document.createElement("button");
    copyButton.className = "ml-auto";
    copyButton.innerHTML = ICONS.clipboardIcon;
    copyButton.onclick = () => {
      navigator.clipboard
        .writeText(copyText)
        .catch((err) => console.error("Failed to copy text:", err));
    };
    return copyButton;
  }

  /**
   * @param {Response} parsedResponse
   * @param {HTMLDivElement} responseDiv
   */
  _handleResponse(parsedResponse, responseDiv) {
    let word = parsedResponse.response;
    if (parsedResponse.done) {
      this.chatHistory.context = parsedResponse.context;
      let copyButton = this.createCopyButton(responseDiv.hidden_text);
      responseDiv.appendChild(copyButton);
    }
    if (!word) return;
    if (!responseDiv.hidden_text) responseDiv.hidden_text = "";
    responseDiv.hidden_text += word;
    responseDiv.innerHTML = DOMPurify.sanitize(
      marked.parse(responseDiv.hidden_text),
    );
  }

  /**
   *
   * @param {string} input
   * @returns {HTMLDivElement}
   */
  createUserMsg(input) {
    let userMessageDiv = document.createElement("div");
    userMessageDiv.className = "mb-2 user-message bg-primary text-body";
    userMessageDiv.innerText = input;
    return userMessageDiv;
  }

  /**
   *
   * @returns {HTMLDivElement}
   */
  createResponseMsg() {
    let responseDiv = document.createElement("div");
    responseDiv.className =
      "response-message mb-2 text-start text-white bg-secondary";
    responseDiv.style.minHeight = "3em"; // make sure div does not shrink if we cancel the request when no text has been generated yet
    return responseDiv;
  }

  /**
   *
   * @returns {HTMLDivElement}
   */
  createSpinner() {
    const spinner = document.createElement("div");
    spinner.innerHTML = ICONS.spinnerIcon;
    spinner.setAttribute("role", "status");
    return spinner;
  }

  /**
   *
   * @returns {HTMLDivElement}
   */
  createStopButton(abort) {
    let stopButton = document.createElement("button");
    stopButton.className = "btn btn-danger";
    stopButton.innerHTML = "Stop";
    stopButton.onclick = (e) => {
      e.preventDefault();
      interrupt.abort("Stop button pressed");
    };
    return stopButton;
  }

  /**
   * Sends the chat message to the LLM
   * @returns {Promise<void>}
   */
  submitRequest = async () => {
    let interrupt = new AbortController();
    const data = {
      model: this.getSelectedModel(),
      prompt: this.userInputField.value,
      context: this.chatHistory.context,
      system: this.systemPromptField.value,
    };

    // Create user message element and append to chat history
    const userMsg = this.createUserMsg(this.userInputField.value);
    this.chatHistory.appendChild(userMsg);

    // Create response container
    const responseDiv = this.createResponseMsg();
    const spinner = this.createSpinner();
    responseDiv.appendChild(spinner);
    this.chatHistory.appendChild(responseDiv);
    responseDiv.scrollIntoView();
    this.userInputField.value = "";

    // add button after sendButton
    const stopButton = this.createStopButton(interrupt);
    this.sendButton.insertAdjacentElement("beforebegin", stopButton);

    let res = await this.OllamaAdapter.sendMessage(
      data,
      interrupt.signal,
    ).catch((e) => e);
    if (res instanceof Error) return console.error("[CUSTOM ERROR]: ", res);

    res = await this.OllamaAdapter.readResponse(res, (x) =>
      this._handleResponse(x, responseDiv),
    ).catch((err) => err);
    if (res instanceof Error) return console.error("[CUSTOM ERROR]: ", res);

    // Remove stop button from DOM now that all text has been generated
    stopButton.remove();
    spinner.remove();

    if (!this.historySelectField.value) return;
    this.localStorageAdapter.saveChat(
      this.historySelectField.value,
      this.buildHistory(),
    );
  };

  deleteChat() {
    const selectedChat = document.getElementById("chat-select").value;
    localStorage.removeItem(selectedChat);
    updateChatList();
  }

  getNameDialog() {
    const nameModal = document.getElementById("nameModal");
    return nameModal;
  }

  saveNameAndCloseDialog() {
    writeChatHistory();
  }

  closeNameDialog() {
    getNameDialog().close();
  }

  saveChat() {
    const chatSelect = this.historySelectField.value;
    if (!chatSelect) {
      const nameModal = getNameDialog();
      nameModal.showModal();
      document.getElementById("saveName").onclick = saveNameAndCloseDialog;
      document.getElementById("closeName").onclick = closeNameDialog;
      return;
    }
    writeChatHistory();
  }

  buildHistory = () => {
    const history = this.chatHistory.innerHTML;
    const context = this.chatHistory.context;
    const system = this.systemPromptField.value;
    const model = this.getSelectedModel();
    return {
      history,
      context,
      system,
      model,
    };
  };

  writeChatHistory = () => {
    const chatName = document.getElementById("userName").value;
    closeNameDialog();
    this.localStorageAdapter.saveChat(chatName, this.buildHistory());
    updateChatList();
  };
  /**
   * @param {string} key
   * @returns {ChatHistoryObj}
   */
  getLSObject(key) {
    return JSON.parse(localStorage.getItem(key));
  }

  loadSelectedChat = (e) => {
    const /**@type{string}*/ selectedChat = e.target.value;
    const obj = this.getLSObject(selectedChat);
    this.chatContainer.style.display = "block";
    this.chatHistory.innerHTML = obj.history;
    this.chatHistory.context = obj.context;
    this.systemPromptField.value = obj.system;
    let last = this.chatHistory.children[this.chatHistory.children.length - 1];
    last.scrollIntoView();
  };

  /**
   * @param {string} key
   */
  createChatOption(key) {
    const option = document.createElement("option");
    option.value = key;
    option.text = key;
    return option;
  }

  updateChatList() {
    this.historySelectField.innerHTML =
      '<option value="">Select a chat</option>';
    for (let i = 0; i < this.localStorageAdapter.len; i++) {
      const key = localStorage.key(i);
      const blacklist = [
        this.localStorageAdapter._hostAddress,
        this.localStorageAdapter._systemPromptKey,
      ];
      if (blacklist.includes(key)) continue;
      let option = this.createChatOption(key);
      this.historySelectField.add(option);
    }
  }
}

/**
 * A Chat History Object
 * @typedef {Object} ChatHistoryObj
 * @property {number[]} context
 * @property {string} model
 * @property {string} history
 * @property {string} system
 */

window.onload = () => {
  // updateChatList();
  // populateModels();
  // autoFocusInput();
  new ChatUI().initChat();
};
