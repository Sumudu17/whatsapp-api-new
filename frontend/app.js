const statusText = document.getElementById("statusText");
const clientStateText = document.getElementById("clientStateText");
const serverStatus = document.getElementById("serverStatus");
const qrImage = document.getElementById("qrImage");
const qrHint = document.getElementById("qrHint");
const initBtn = document.getElementById("initBtn");
const waLogoutBtn = document.getElementById("waLogoutBtn");
const lastErrorText = document.getElementById("lastErrorText");
const sendBtn = document.getElementById("sendBtn");
const refreshGroupsBtn = document.getElementById("refreshGroupsBtn");
const sendResult = document.getElementById("sendResult");
const toInput = document.getElementById("toInput");
const groupSelect = document.getElementById("groupSelect");
const messageInput = document.getElementById("messageInput");
const individualSection = document.getElementById("individualSection");
const groupSection = document.getElementById("groupSection");
const destRadios = document.querySelectorAll("input[name=\"destType\"]");

const pollToInput = document.getElementById("pollToInput");
const pollGroupSelect = document.getElementById("pollGroupSelect");
const pollQuestionInput = document.getElementById("pollQuestionInput");
const pollOptionsList = document.getElementById("pollOptionsList");
const pollAddOptionBtn = document.getElementById("pollAddOptionBtn");
const pollIndividualSection = document.getElementById("pollIndividualSection");
const pollGroupSection = document.getElementById("pollGroupSection");
const pollRefreshGroupsBtn = document.getElementById("pollRefreshGroupsBtn");
const pollSendBtn = document.getElementById("pollSendBtn");
const pollSendResult = document.getElementById("pollSendResult");
const pollDestRadios = document.querySelectorAll("input[name=\"pollDestType\"]");

const messagesTodayValue = document.getElementById("messagesTodayValue");
const messagesTotalValue = document.getElementById("messagesTotalValue");

const socket = io({ withCredentials: true });
let socketConnected = false;

const clientDetailsBox = document.getElementById("clientDetailsBox");
const clientPushname = document.getElementById("clientPushname");
const clientWid = document.getElementById("clientWid");
const clientPhone = document.getElementById("clientPhone");

const setFooterVersionText = (version, attempts = 0) => {
  const el = document.getElementById("footerVersionText");
  if (el) {
    el.textContent = `v${version}`;
    el.style.display = "inline-block";
    return;
  }
  if (attempts >= 10) return;
  setTimeout(() => setFooterVersionText(version, attempts + 1), 200);
};

const applyClientDetails = (state) => {
  const ci = state?.clientInfo;
  const show = state?.status === "READY" && ci;
  if (!clientDetailsBox) return;
  if (show) {
    clientDetailsBox.classList.remove("hidden");
    if (clientPushname) clientPushname.textContent = ci.pushname || "—";
    if (clientWid) clientWid.textContent = ci.widSerialized || "—";
    if (clientPhone) clientPhone.textContent = ci.phoneNumber || "—";
  } else {
    clientDetailsBox.classList.add("hidden");
  }
};

const setStatus = (state) => {
  if (!state) return;
  serverStatus.classList.add("hidden");
  statusText.textContent = state.status || "UNKNOWN";
  clientStateText.textContent = state.clientState || "-";
  applyClientDetails(state);

  if (lastErrorText) {
    if (state.lastError) {
      lastErrorText.textContent = `Error: ${state.lastError}`;
      lastErrorText.classList.remove("hidden");
    } else {
      lastErrorText.textContent = "";
      lastErrorText.classList.add("hidden");
    }
  }

  if (state.qrDataUrl) {
    qrImage.src = state.qrDataUrl;
    qrImage.classList.remove("hidden");
    qrHint.classList.add("hidden");
  } else {
    qrImage.removeAttribute("src");
    qrImage.classList.add("hidden");
    qrHint.classList.remove("hidden");
  }
};

socket.on("state_change", (state) => {
  setStatus(state);
});

socket.on("qr", (payload) => {
  if (payload?.qr) {
    qrImage.src = payload.qr;
    qrImage.classList.remove("hidden");
    qrHint.classList.add("hidden");
  }
});

socket.on("connect", async () => {
  socketConnected = true;
  serverStatus.classList.add("hidden");
});

socket.on("disconnect", () => {
  socketConnected = false;
  serverStatus.classList.remove("hidden");
  statusText.textContent = "SERVER_OFFLINE";
  clientStateText.textContent = "-";
  applyClientDetails({ status: "DISCONNECTED" });
  qrImage.removeAttribute("src");
  qrImage.classList.add("hidden");
  qrHint.classList.remove("hidden");
});

socket.on("connect_error", () => {
  socketConnected = false;
  serverStatus.classList.remove("hidden");
  statusText.textContent = "SERVER_OFFLINE";
  clientStateText.textContent = "-";
  applyClientDetails({ status: "DISCONNECTED" });
  qrImage.removeAttribute("src");
  qrImage.classList.add("hidden");
  qrHint.classList.remove("hidden");
});

const request = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
};

initBtn.addEventListener("click", async () => {
  try {
    const data = await request("/api/whatsapp/initialize", { method: "POST" });
    setStatus(data.state);
  } catch (err) {
    alert(err.message);
  }
});

waLogoutBtn.addEventListener("click", async () => {
  try {
    const data = await request("/api/whatsapp/logout", { method: "POST" });
    setStatus(data.state);
  } catch (err) {
    alert(err.message);
  }
});

const loadMessageStats = async () => {
  const data = await request("/api/whatsapp/message-stats");
  if (messagesTodayValue) messagesTodayValue.textContent = data.stats?.today ?? 0;
  if (messagesTotalValue) messagesTotalValue.textContent = data.stats?.total ?? 0;
};

const populateGroupSelect = (selectEl, groupsData) => {
  selectEl.innerHTML = "<option value=\"\">Select group</option>";
  groupsData.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = `${group.name} (${group.participants})`;
    selectEl.appendChild(option);
  });
};

const loadGroups = async (selectEl) => {
  const data = await request("/api/whatsapp/groups");
  populateGroupSelect(selectEl || groupSelect, data.groups);
};

refreshGroupsBtn.addEventListener("click", async () => {
  try {
    await loadGroups(groupSelect);
  } catch (err) {
    alert(err.message);
  }
});

pollRefreshGroupsBtn.addEventListener("click", async () => {
  try {
    await loadGroups(pollGroupSelect);
  } catch (err) {
    alert(err.message);
  }
});

sendBtn.addEventListener("click", async () => {
  sendResult.classList.add("hidden");
  const isGroup = document.querySelector("input[name=\"destType\"]:checked")
    .value === "group";

  const payload = {
    message: messageInput.value.trim(),
  };

  if (isGroup) {
    payload.groupId = groupSelect.value;
  } else {
    payload.to = toInput.value.trim();
  }

  try {
    const data = await request("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    sendResult.textContent = `Message sent. ID: ${data.messageId || "N/A"}`;
    sendResult.classList.remove("hidden");
    loadMessageStats().catch(() => {});
  } catch (err) {
    sendResult.textContent = err.message;
    sendResult.classList.remove("hidden");
  }
});

destRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    const isGroup = radio.value === "group";
    if (isGroup) {
      individualSection.classList.add("hidden");
      groupSection.classList.remove("hidden");
    } else {
      groupSection.classList.add("hidden");
      individualSection.classList.remove("hidden");
    }
  });
});

pollDestRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    const isGroup = radio.value === "group";
    if (isGroup) {
      pollIndividualSection.classList.add("hidden");
      pollGroupSection.classList.remove("hidden");
    } else {
      pollGroupSection.classList.add("hidden");
      pollIndividualSection.classList.remove("hidden");
    }
  });
});

const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 12;

const createPollOptionRow = (index) => {
  const row = document.createElement("div");
  row.className = "button-row";
  row.style.margin = "0 0 8px";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-control poll-option-input";
  input.placeholder = `Option ${index + 1}`;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-secondary btn-sm";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    if (pollOptionsList.children.length <= MIN_POLL_OPTIONS) return;
    row.remove();
    refreshPollOptionPlaceholders();
    refreshPollRemoveButtons();
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  return row;
};

const refreshPollOptionPlaceholders = () => {
  Array.from(pollOptionsList.children).forEach((row, i) => {
    const input = row.querySelector(".poll-option-input");
    if (input && !input.value) {
      input.placeholder = `Option ${i + 1}`;
    }
  });
};

const refreshPollRemoveButtons = () => {
  const atMin = pollOptionsList.children.length <= MIN_POLL_OPTIONS;
  Array.from(pollOptionsList.children).forEach((row) => {
    const btn = row.querySelector("button");
    if (btn) btn.disabled = atMin;
  });
  pollAddOptionBtn.disabled = pollOptionsList.children.length >= MAX_POLL_OPTIONS;
};

const addPollOptionRow = () => {
  if (pollOptionsList.children.length >= MAX_POLL_OPTIONS) return;
  pollOptionsList.appendChild(createPollOptionRow(pollOptionsList.children.length));
  refreshPollRemoveButtons();
};

// Start with two empty options (minimum required for a poll).
addPollOptionRow();
addPollOptionRow();

pollAddOptionBtn.addEventListener("click", addPollOptionRow);

const showPollResult = (message, isError) => {
  pollSendResult.textContent = message;
  pollSendResult.classList.remove("hidden");
  pollSendResult.classList.toggle("error", isError);
  pollSendResult.classList.toggle("info", !isError);
};

pollSendBtn.addEventListener("click", async () => {
  pollSendResult.classList.add("hidden");

  const isGroup = document.querySelector("input[name=\"pollDestType\"]:checked").value === "group";
  const question = pollQuestionInput.value.trim();
  const options = Array.from(pollOptionsList.querySelectorAll(".poll-option-input"))
    .map((input) => input.value.trim());
  const allowMultipleAnswers =
    document.querySelector("input[name=\"pollAnswerType\"]:checked").value === "multiple";

  if (!question) {
    showPollResult("Poll question is required.", true);
    return;
  }
  if (options.some((o) => !o)) {
    showPollResult("Poll options cannot be empty.", true);
    return;
  }
  if (options.length < MIN_POLL_OPTIONS) {
    showPollResult(`At least ${MIN_POLL_OPTIONS} poll options are required.`, true);
    return;
  }
  const normalized = options.map((o) => o.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    showPollResult("Poll options must be unique.", true);
    return;
  }

  const payload = { question, options, allowMultipleAnswers };
  if (isGroup) {
    if (!pollGroupSelect.value) {
      showPollResult("Please select a group.", true);
      return;
    }
    payload.groupId = pollGroupSelect.value;
  } else {
    if (!pollToInput.value.trim()) {
      showPollResult("Please enter a phone number.", true);
      return;
    }
    payload.to = pollToInput.value.trim();
  }

  pollSendBtn.disabled = true;
  pollSendBtn.textContent = "Sending...";
  try {
    const data = await request("/api/whatsapp/send-poll", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showPollResult(`Poll sent. ID: ${data.messageId || "N/A"}`, false);
    loadMessageStats().catch(() => {});
  } catch (err) {
    showPollResult(err.message, true);
  } finally {
    pollSendBtn.disabled = false;
    pollSendBtn.textContent = "Send Poll";
  }
});

// Load version on page load
(async () => {
  try {
    const data = await request("/api/version");
    if (data.version) {
      setFooterVersionText(data.version);
    }
  } catch (err) {
    console.warn("Failed to load version:", err);
  }

  try {
    const st = await request("/api/whatsapp/dashboard-status");
    if (st?.connection) {
      setStatus(st.connection);
    }
  } catch (err) {
    console.warn("Failed to load WhatsApp status:", err);
  }

  try {
    await loadMessageStats();
  } catch (err) {
    console.warn("Failed to load message stats:", err);
  }
})();

// Status updates are pushed via websocket (state_change).
