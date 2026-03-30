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
      setFooterVersionText(data.version);
    }
  } catch (err) {
    console.warn("Failed to load version:", err);
  }

  try {
    const st = await request("/api/whatsapp/status");
    if (st?.state) {
      setStatus(st.state);
    }
  } catch (err) {
    console.warn("Failed to load WhatsApp status:", err);
  }
})();

// Status updates are pushed via websocket (state_change).
