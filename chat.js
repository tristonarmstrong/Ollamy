const faqString = `
**How can I expose the Ollama server?**

By default, Ollama allows cross origin requests from 127.0.0.1 and 0.0.0.0.

To support more origins, you can use the OLLAMA_ORIGINS environment variable:

\`\`\`
OLLAMA_ORIGINS=${window.location.origin} ollama serve
\`\`\`

Also see: https://github.com/jmorganca/ollama/blob/main/docs/faq.md
`;



const clipboardIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`
const spinnerIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="animate-spin lucide lucide-loader-circle"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`

const textBoxBaseHeight = 40;  // This should match the default height set in CSS

// change settings of marked from default to remove deprecation warnings
// see conversation here: https://github.com/markedjs/marked/issues/2793
marked.use({
  mangle: false,
  headerIds: false
});

function autoFocusInput() {
  const userInput = document.getElementById('user-input');
  userInput.focus();
}

/*
takes in model as a string
updates the query parameters of page url to include model name
*/
function updateModelInQueryString(model) {
  // make sure browser supports features
  if (window.history.replaceState && 'URLSearchParams' in window) {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("model", model);
    // replace current url without reload
    const newPathWithQuery = `${window.location.pathname}?${searchParams.toString()}`
    window.history.replaceState(null, '', newPathWithQuery);
  }
}

// Fetch available models and populate the dropdown
async function populateModels() {
  document.getElementById('send-button').addEventListener('click', submitRequest);

  try {
    const data = await getModels();

    const selectElement = document.getElementById('model-select');

    // set up handler for selection
    selectElement.onchange = (() => updateModelInQueryString(selectElement.value));

    data.models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.name;
      option.innerText = model.name;
      selectElement.appendChild(option);
    });

    // select option present in url parameter if present
    const queryParams = new URLSearchParams(window.location.search);
    const requestedModel = queryParams.get('model');
    // update the selection based on if requestedModel is a value in options
    if ([...selectElement.options].map(o => o.value).includes(requestedModel)) {
      selectElement.value = requestedModel;
    }
    // otherwise set to the first element if exists and update URL accordingly
    else if (selectElement.options.length) {
      selectElement.value = selectElement.options[0].value;
      updateModelInQueryString(selectElement.value);
    }
  }
  catch (error) {
    document.getElementById('errorText').innerHTML =
      DOMPurify.sanitize(marked.parse(
        `Ollama-ui was unable to communitcate with Ollama due to the following error:\n\n`
        + `\`\`\`${error.message}\`\`\`\n\n---------------------\n`
        + faqString));
    let modal = new bootstrap.Modal(document.getElementById('errorModal'));
    modal.show();
  }
}

// adjusts the padding at the bottom of scrollWrapper to be the height of the input box
// function adjustPadding() {
//   const inputBoxHeight = document.getElementById('input-area').offsetHeight;
//   const scrollWrapper = document.getElementById('scroll-wrapper');
//   scrollWrapper.style.paddingBottom = `${inputBoxHeight + 15}px`;
// }

// sets up padding resize whenever input box has its height changed
// const autoResizePadding = new ResizeObserver(() => {
//   adjustPadding();
// });
// autoResizePadding.observe(document.getElementById('input-area'));



// Function to get the selected model
function getSelectedModel() {
  return document.getElementById('model-select').value;
}

// variables to handle auto-scroll
// we only need one ResizeObserver and isAutoScrollOn variable globally
// no need to make a new one for every time submitRequest is called
const scrollWrapper = document.getElementById('scroll-wrapper');
let isAutoScrollOn = true;
// autoscroll when new line is added
const autoScroller = new ResizeObserver(() => {
  if (isAutoScrollOn) {
    scrollWrapper.scrollIntoView({ behavior: "smooth", block: "end" });
  }
});

// event listener for scrolling
let lastKnownScrollPosition = 0;
let ticking = false;
document.addEventListener("scroll", (event) => {
  // if user has scrolled up and autoScroll is on we turn it off
  if (!ticking && isAutoScrollOn && window.scrollY < lastKnownScrollPosition) {
    window.requestAnimationFrame(() => {
      isAutoScrollOn = false;
      ticking = false;
    });
    ticking = true;
  }
  // if user has scrolled nearly all the way down and autoScroll is disabled, re-enable
  else if (!ticking && !isAutoScrollOn &&
    window.scrollY > lastKnownScrollPosition && // make sure scroll direction is down
    window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 30 // add 30px of space--no need to scroll all the way down, just most of the way
  ) {
    window.requestAnimationFrame(() => {
      isAutoScrollOn = true;
      ticking = false;
    });
    ticking = true;
  }
  lastKnownScrollPosition = window.scrollY;
});


// Function to handle the user input and call the API functions
async function submitRequest() {
  document.getElementById('chat-container').style.display = 'block';

  const input = document.getElementById('user-input').value;
  const selectedModel = getSelectedModel();
  const context = document.getElementById('chat-history').context;
  const systemPrompt = document.getElementById('system-prompt').value;
  const data = { model: selectedModel, prompt: input, context: context, system: systemPrompt };

  // Create user message element and append to chat history
  let chatHistory = document.getElementById('chat-history');
  let userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'mb-2 user-message bg-primary text-body';
  userMessageDiv.innerText = input;
  chatHistory.appendChild(userMessageDiv);

  // Create response container
  let responseDiv = document.createElement('div');
  responseDiv.className = 'response-message mb-2 text-start text-white bg-secondary';
  responseDiv.style.minHeight = '3em'; // make sure div does not shrink if we cancel the request when no text has been generated yet
  spinner = document.createElement('div');
  spinner.innerHTML = spinnerIcon;
  spinner.setAttribute('role', 'status');
  responseDiv.appendChild(spinner);
  chatHistory.appendChild(responseDiv);

  // create button to stop text generation
  let interrupt = new AbortController();
  let stopButton = document.createElement('button');
  stopButton.className = 'btn btn-danger';
  stopButton.innerHTML = 'Stop';
  stopButton.onclick = (e) => {
    e.preventDefault();
    interrupt.abort('Stop button pressed');
  }
  // add button after sendButton
  const sendButton = document.getElementById('send-button');
  sendButton.insertAdjacentElement('beforebegin', stopButton);

  // change autoScroller to keep track of our new responseDiv
  autoScroller.observe(responseDiv);

  postRequest(data, interrupt.signal)
    .then(async response => {
      await getResponse(response, parsedResponse => {
        let word = parsedResponse.response;
        if (parsedResponse.done) {
          chatHistory.context = parsedResponse.context;
          // Copy button
          let copyButton = document.createElement('button');
          copyButton.className = '';
          copyButton.innerHTML = clipboardIcon;
          copyButton.onclick = () => {
            navigator.clipboard.writeText(responseDiv.hidden_text).then(() => {
              console.log('Text copied to clipboard');
            }).catch(err => {
              console.error('Failed to copy text:', err);
            });
          };
          responseDiv.appendChild(copyButton);
        }
        // add word to response
        if (word != undefined && word != "") {
          if (responseDiv.hidden_text == undefined) {
            responseDiv.hidden_text = "";
          }
          responseDiv.hidden_text += word;
          responseDiv.innerHTML = DOMPurify.sanitize(marked.parse(responseDiv.hidden_text)); // Append word to response container
        }
      });
    })
    .then(() => {
      stopButton.remove(); // Remove stop button from DOM now that all text has been generated
      spinner.remove();
    })
    .catch(error => {
      if (error !== 'Stop button pressed') {
        console.error(error);
      }
      stopButton.remove();
      spinner.remove();
    });

  // Clear user input
  const element = document.getElementById('user-input');
  element.value = '';
  $(element).css("height", textBoxBaseHeight + "px");
}

// Event listener for Ctrl + Enter or CMD + Enter
document.getElementById('user-input').addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    submitRequest();
  }
});


window.onload = () => {
  updateChatList();
  populateModels();
  // adjustPadding();
  autoFocusInput();

  document.getElementById("delete-chat").addEventListener("click", deleteChat);
  document.getElementById("new-chat").addEventListener("click", startNewChat);
  document.getElementById("save-chat").addEventListener("click", saveChat);
  document.getElementById("chat-select").addEventListener("change", loadSelectedChat);
  document.getElementById("host-address").addEventListener("change", setHostAddress);
  document.getElementById("system-prompt").addEventListener("change", setSystemPrompt);
}

function deleteChat() {
  const selectedChat = document.getElementById("chat-select").value;
  localStorage.removeItem(selectedChat);
  updateChatList();
}

function getNameDialog() {
  const nameModal = document.getElementById('nameModal')
  return nameModal
}

function saveNameAndCloseDialog(){
  writeChatHistory()
}
function closeNameDialog(){
  getNameDialog().close()
}

// Function to save chat with a unique name
function saveChat() {
  const chatSelect = document.getElementById('chat-select').value
  if (!chatSelect) {
    const nameModal = getNameDialog()
    nameModal.showModal()
    document.getElementById('saveName').onclick = saveNameAndCloseDialog 
    document.getElementById('closeName').onclick = closeNameDialog
    return
  }
  writeChatHistory()
}

function writeChatHistory() {
  const chatName = document.getElementById('userName').value;
  closeNameDialog()
  const history = document.getElementById("chat-history").innerHTML;
  const context = document.getElementById('chat-history').context;
  const systemPrompt = document.getElementById('system-prompt').value;
  const model = getSelectedModel();
  localStorage.setItem(chatName, JSON.stringify({ "history": history, "context": context, system: systemPrompt, "model": model }));
  updateChatList();
}

// Function to load selected chat from dropdown
function loadSelectedChat() {
  const selectedChat = document.getElementById("chat-select").value;
  const obj = JSON.parse(localStorage.getItem(selectedChat));
  document.getElementById("chat-history").innerHTML = obj.history;
  document.getElementById("chat-history").context = obj.context;
  document.getElementById("system-prompt").value = obj.system;
  updateModelInQueryString(obj.model)
  document.getElementById('chat-container').style.display = 'block';
}

function startNewChat() {
  document.getElementById("chat-history").innerHTML = null;
  document.getElementById("chat-history").context = null;
  document.getElementById('chat-container').style.display = 'none';
  updateChatList();
}

// Function to update chat list dropdown
function updateChatList() {
  const chatList = document.getElementById("chat-select");
  chatList.innerHTML = '<option value="">Select a chat</option>';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === "host-address" || key == "system-prompt") continue;
    const option = document.createElement("option");
    option.value = key;
    option.text = key;
    chatList.add(option);
  }
}
