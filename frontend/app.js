const statusText = document.getElementById("statusText");
const clientStateText = document.getElementById("clientStateText");
const serverStatus = document.getElementById("serverStatus");
const versionText = document.getElementById("versionText");
const qrImage = document.getElementById("qrImage");
const qrHint = document.getElementById("qrHint");
const initBtn = document.getElementById("initBtn");
const waLogoutBtn = document.getElementById("waLogoutBtn");
const appLogoutBtn = document.getElementById("appLogoutBtn");
const apiKeysBtn = document.getElementById("apiKeysBtn");
const profileBtn = document.getElementById("profileBtn");
const connectionBtn = document.getElementById("connectionBtn");
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

const socket = io({ withCredentials: true });
let socketConnected = false;

const setStatus = (state) => {
  if (!state) return;
  serverStatus.classList.add("hidden");
  statusText.textContent = state.status || "UNKNOWN";
  clientStateText.textContent = state.clientState || "-";

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
  qrImage.removeAttribute("src");
  qrImage.classList.add("hidden");
  qrHint.classList.remove("hidden");
});

socket.on("connect_error", () => {
  socketConnected = false;
  serverStatus.classList.remove("hidden");
  statusText.textContent = "SERVER_OFFLINE";
  clientStateText.textContent = "-";
  qrImage.removeAttribute("src");
  qrImage.classList.add("hidden");
  qrHint.classList.remove("hidden");
});

const request = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
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

appLogoutBtn.addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
});

apiKeysBtn.addEventListener("click", async () => {
  window.location.href = "/api-keys";
});

profileBtn.addEventListener("click", async () => {
  window.location.href = "/profile";
});

connectionBtn.addEventListener("click", async () => {
  window.location.href = "/connection";
});

const loadGroups = async () => {
  const data = await request("/api/whatsapp/groups");
  groupSelect.innerHTML = "<option value=\"\">Select group</option>";
  data.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = `${group.name} (${group.participants})`;
    groupSelect.appendChild(option);
  });
};

refreshGroupsBtn.addEventListener("click", async () => {
  try {
    await loadGroups();
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

// Load version on page load
(async () => {
  try {
    const data = await request("/api/version");
    if (data.version) {
      versionText.textContent = `v${data.version}`;
    }
  } catch (err) {
    console.warn("Failed to load version:", err);
  }
})();

// Status updates are pushed via websocket (state_change).
