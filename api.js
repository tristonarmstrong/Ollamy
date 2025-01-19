var ollama_host = localStorage.getItem("host-address");
if (!ollama_host) {
  ollama_host = "http://localhost:11434";
} else {
  document.getElementById("host-address").value = ollama_host;
}

const ollama_system_prompt = localStorage.getItem("system-prompt");
if (ollama_system_prompt) {
  document.getElementById("system-prompt").value = ollama_system_prompt;
}

if (rebuildRules) {
  rebuildRules(ollama_host);
}

function setHostAddress() {
  ollama_host = document.getElementById("host-address").value;
  localStorage.setItem("host-address", ollama_host);
  populateModels();
  if (rebuildRules) {
    rebuildRules(ollama_host);
  }
}

function setSystemPrompt() {
  const systemPrompt = document.getElementById("system-prompt").value;
  localStorage.setItem("system-prompt", systemPrompt);
}

/**
 * @returns {Promise<Model>}
 */
async function getModels() {
  const response = await fetch(`${ollama_host}/api/tags`);
  const /** @type {Model}*/ data = await response.json();
  return data;
}

// Function to send a POST request to the API
function postRequest(data, signal) {}

/**
 * Gets a reader and reads the response coming back from ollama api as its streamed in
 * @param {Response} response
 * @param {arg: Record<string, unknown> => void} callback
 */
async function getResponse(response, callback) {}

/**
 * @typedef {Object} Model
 * @property {OllamaModel[]} models
 */

/**
 * A Model hosted by ollama
 * @typedef {Object} OllamaModel
 * @property {OllamaModelDetails} details
 * @property {string} digest
 * @property {string} model
 * @property {string} modified_at
 * @property {string} name
 * @property {number} size
 */

/**
 * A Model's details
 * @typedef {Object} OllamaModelDetails
 * @property {string[]} families
 * @property {string} family
 * @property {string} format
 * @property {string} parameter_size
 * @property {string} parent_model
 * @property {string} quantization_level
 */
