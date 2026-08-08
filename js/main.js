const { HostNetwork, ClientNetwork } = window.Riftlink;

const $ = selector => document.querySelector(selector);
const views = ['#main-menu', '#host-view', '#client-view'];
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
let hostNetwork;

function showView(id) { views.forEach(selector => $(selector).classList.toggle('hidden', selector !== id)); }
function reportError(message, view = 'client') {
  console.error(message);
  const banner = $(`#${view}-error`);
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove('hidden');
}
function clearError(view) { const banner = $(`#${view}-error`); if (banner) { banner.textContent = ''; banner.classList.add('hidden'); } }
async function copyText(value, button, source) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    source.focus(); source.select();
    reportError('Clipboard access was denied. The key has been selected so you can copy it manually.', button.closest('#host-view') ? 'host' : 'client');
    return;
  }
  const old = button.textContent; button.textContent = 'COPIED'; setTimeout(() => button.textContent = old, 1200);
}
function appendMessage(log, sender, text, sent = false) {
  log.querySelector('.empty-log')?.remove();
  const message = document.createElement('div'); message.className = `message${sent ? ' sent' : ''}`;
  const meta = document.createElement('small'); meta.textContent = `${sender} // ${new Date().toLocaleTimeString()}`;
  const body = document.createElement('span'); body.textContent = text;
  message.append(meta, body); log.append(message); log.scrollTop = log.scrollHeight;
}

function buildHostSlots() {
  const container = $('#host-slots'); container.replaceChildren();
  for (let playerId = 1; playerId <= 6; playerId++) {
    const slot = document.createElement('article'); slot.className = 'player-slot'; slot.dataset.player = playerId;
    slot.innerHTML = `<div class="slot-header"><div><h3>PLAYER ${String(playerId).padStart(2,'0')}</h3><span class="team">${playerId <= 3 ? 'BLUE' : 'RED'} TEAM</span></div><span class="status-badge"><i class="status-dot empty"></i> <b>EMPTY</b></span></div><button class="primary-button compact generate">GENERATE OFFER</button><label>HOST OFFER KEY</label><textarea class="offer" readonly placeholder="Generate an offer..."></textarea><div class="slot-actions"><button class="secondary-button compact copy-offer" disabled>COPY OFFER</button></div><label>PLAYER ANSWER KEY</label><textarea class="answer" placeholder="Paste this player's answer..."></textarea><button class="secondary-button compact apply">APPLY ANSWER</button><div class="slot-messages hidden"><div class="message-log"><p class="empty-log">No messages yet.</p></div><form class="message-form"><input maxlength="500" placeholder="Message Player ${playerId}..."><button>SEND</button></form></div>`;
    container.append(slot);
  }
}
function setHostStatus(playerId, status) {
  const slot = $(`[data-player="${playerId}"]`); if (!slot) return;
  const dot = slot.querySelector('.status-dot'); dot.className = `status-dot ${statusClass(status)}`; slot.querySelector('.status-badge b').textContent = status;
  slot.querySelector('.slot-messages').classList.toggle('hidden', status !== 'CONNECTED');
}
function initializeHost() {
  clearError('host');
  buildHostSlots();
  hostNetwork = new HostNetwork({ onStatus:setHostStatus, onMessage:(id,text) => appendMessage($(`[data-player="${id}"] .message-log`), `PLAYER ${id}`, text), onError:(id,error) => reportError(`Player ${id}: ${error.message}`, 'host') });
}

const clientNetwork = new ClientNetwork({
  onStatus: status => { $('#client-status').textContent = status; $('#client-status-dot').className = `status-dot ${statusClass(status)}`; const enabled = status === 'CONNECTED'; $('#client-message').disabled = !enabled; $('#client-message-form button').disabled = !enabled; },
  onMessage: text => appendMessage($('#client-log'), 'HOST', text), onError: error => reportError(error.message, 'client')
});

$('#create-host').addEventListener('click', () => { initializeHost(); showView('#host-view'); });
$('#join-host').addEventListener('click', () => { clearError('client'); showView('#client-view'); });
document.querySelectorAll('.back-button').forEach(button => button.addEventListener('click', () => { hostNetwork?.closeAll(); clientNetwork.close(); showView('#main-menu'); }));
$('#host-slots').addEventListener('click', async event => {
  const slot = event.target.closest('.player-slot'); if (!slot) return; const id = Number(slot.dataset.player);
  try {
    if (event.target.closest('.generate')) { const button = event.target; button.disabled = true; slot.querySelector('.offer').value = await hostNetwork.generateOffer(id); slot.querySelector('.copy-offer').disabled = false; button.disabled = false; }
    if (event.target.closest('.copy-offer')) copyText(slot.querySelector('.offer').value, event.target, slot.querySelector('.offer'));
    if (event.target.closest('.apply')) await hostNetwork.applyAnswer(id, slot.querySelector('.answer').value);
  } catch (error) { reportError(error.message, 'host'); event.target.disabled = false; }
});
$('#host-slots').addEventListener('submit', event => { event.preventDefault(); const slot = event.target.closest('.player-slot'); const input = event.target.querySelector('input'); if (!input.value.trim()) return; try { hostNetwork.send(Number(slot.dataset.player), input.value.trim()); appendMessage(slot.querySelector('.message-log'), 'HOST', input.value.trim(), true); input.value = ''; } catch (error) { reportError(error.message, 'host'); } });
$('#generate-answer').addEventListener('click', async event => { try { event.target.disabled = true; $('#client-answer').value = await clientNetwork.generateAnswer($('#client-offer').value); $('#copy-answer').disabled = false; } catch (error) { reportError(error.message); } finally { event.target.disabled = false; } });
$('#copy-answer').addEventListener('click', event => copyText($('#client-answer').value, event.target, $('#client-answer')));
$('#client-message-form').addEventListener('submit', event => { event.preventDefault(); const input = $('#client-message'); if (!input.value.trim()) return; try { clientNetwork.send(input.value.trim()); appendMessage($('#client-log'), 'YOU', input.value.trim(), true); input.value = ''; } catch (error) { reportError(error.message); } });
