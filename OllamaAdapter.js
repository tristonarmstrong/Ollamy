class OllamaAdapter {
  constructor(/** @type {LSAdapter}*/ lsAdapter) {
    this.LsAdapter = lsAdapter;
  }

  async fetchHistory() {}

  /**
   * Gets a reader and reads the response coming back from ollama api as its streamed in
   * @param {Response} response
   * @param {arg: Record<string, unknown> => void} callback
   */
  async readResponse(response, callback) {
    const reader = response.body.getReader();
    let partialLine = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      // Decode the received value and split by lines
      const textChunk = new TextDecoder().decode(value);
      const lines = (partialLine + textChunk).split("\n");
      partialLine = lines.pop(); // The last line might be incomplete

      for (const line of lines) {
        if (line.trim() === "") continue;
        const parsedResponse = JSON.parse(line);
        callback(parsedResponse); // Process each response word
      }
    }

    // Handle any remaining line
    if (partialLine.trim() !== "") {
      try {
        const parsedResponse = JSON.parse(partialLine);
        callback(parsedResponse);
      } catch (e) {
        console.error("[CUSTOM ERROR]: ", e);
      }
    }
  }

  async sendMessage(data, signal) {
    return await fetch(`${this.LsAdapter.hostAddress}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: signal,
    });
  }

  async getModels() {
    const response = await fetch(`${this.LsAdapter.hostAddress}/api/tags`);
    const /** @type {Model}*/ data = await response.json();
    return data;
  }
}
