const statusText = document.getElementById('statusText');
const clientStateText = document.getElementById('clientStateText');
const lastErrorText = document.getElementById('lastErrorText');
const serverStatus = document.getElementById('serverStatus');
const qrImage = document.getElementById('qrImage');
const qrHint = document.getElementById('qrHint');
const initBtn = document.getElementById('initBtn');
const waLogoutBtn = document.getElementById('waLogoutBtn');
const disconnectedAlert = document.getElementById('disconnectedAlert');

const socket = io({ withCredentials: true });

const setStatus = (state) => {
  if (!state) return;
  if (serverStatus) serverStatus.classList.add('hidden');
  if (statusText) statusText.textContent = state.status || 'UNKNOWN';
  if (clientStateText) clientStateText.textContent = state.clientState || '-';

  if (lastErrorText) {
    if (state.lastError) {
      lastErrorText.textContent = `Error: ${state.lastError}`;
      lastErrorText.classList.remove('hidden');
    } else {
      lastErrorText.textContent = '';
      lastErrorText.classList.add('hidden');
    }
  }

  if (state.qrDataUrl) {
    qrImage.src = state.qrDataUrl;
    qrImage.classList.remove('hidden');
    qrHint.classList.add('hidden');
  } else {
    qrImage.removeAttribute('src');
    qrImage.classList.add('hidden');
    qrHint.classList.remove('hidden');
  }

  if (disconnectedAlert) {
    if (state.status === 'DISCONNECTED') {
      disconnectedAlert.classList.remove('hidden');
      if (state.lastError) {
        disconnectedAlert.textContent = `Disconnected. Reason: ${state.lastError}`;
      } else {
        disconnectedAlert.textContent = 'Disconnected. Please reconnect.';
      }
    } else {
      disconnectedAlert.classList.add('hidden');
    }
  }
};

socket.on('state_change', (state) => {
  setStatus(state);
});

socket.on('qr', (payload) => {
  if (payload && payload.qr) {
    qrImage.src = payload.qr;
    qrImage.classList.remove('hidden');
    qrHint.classList.add('hidden');
  }
});

socket.on('connect', () => {
  const hide = document.getElementById('serverStatus');
  if (hide) hide.classList.add('hidden');
});

socket.on('disconnect', () => {
  if (serverStatus) serverStatus.classList.remove('hidden');
  if (statusText) statusText.textContent = 'SERVER_OFFLINE';
  if (clientStateText) clientStateText.textContent = '-';
  qrImage.removeAttribute('src');
  qrImage.classList.add('hidden');
  if (qrHint) qrHint.classList.remove('hidden');
});

socket.on('connect_error', () => {
  if (serverStatus) serverStatus.classList.remove('hidden');
  if (statusText) statusText.textContent = 'SERVER_OFFLINE';
  if (clientStateText) clientStateText.textContent = '-';
  qrImage.removeAttribute('src');
  qrImage.classList.add('hidden');
  if (qrHint) qrHint.classList.remove('hidden');
});

const request = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
};

initBtn.addEventListener('click', async () => {
  try {
    const data = await request('/api/whatsapp/initialize', { method: 'POST' });
    setStatus(data.state);
  } catch (err) {
    alert(err.message);
  }
});

waLogoutBtn.addEventListener('click', async () => {
  try {
    const data = await request('/api/whatsapp/logout', { method: 'POST' });
    setStatus(data.state);
  } catch (err) {
    alert(err.message);
  }
});

// Load version on page load
(async () => {
  try {
    const data = await request('/api/version', { method: 'GET' });
    if (data.version) {
      const versionText = document.getElementById('versionText');
      if (versionText) versionText.textContent = `v${data.version}`;
    }
  } catch (_) {}
})();

