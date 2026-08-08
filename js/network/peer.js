const PEER_CONFIG = { iceServers: [] };

function createPeerConnection(onStatusChange) {
  const peerConnection = new RTCPeerConnection(PEER_CONFIG);
  const report = () => {
    const state = peerConnection.connectionState.toUpperCase();
    onStatusChange(state === 'CLOSED' ? 'DISCONNECTED' : state);
  };
  peerConnection.addEventListener('connectionstatechange', report);
  peerConnection.addEventListener('iceconnectionstatechange', () => {
    if (peerConnection.iceConnectionState === 'failed') onStatusChange('FAILED');
  });
  return peerConnection;
}

function configureFastChannel(channel, onMessage = () => {}) {
  channel.addEventListener('message', event => onMessage(String(event.data)));
}

function configureReliableChannel(channel, onMessage, onStatusChange) {
  channel.addEventListener('open', () => onStatusChange('CONNECTED'));
  channel.addEventListener('close', () => onStatusChange('DISCONNECTED'));
  channel.addEventListener('error', () => onStatusChange('FAILED'));
  channel.addEventListener('message', event => onMessage(String(event.data)));
}

function sendText(channel, text) {
  if (!channel || channel.readyState !== 'open') throw new Error('The reliable data channel is not connected.');
  channel.send(JSON.stringify({ type: 'CHAT', text, sentAt: Date.now() }));
}

function readTextPacket(raw) {
  try {
    const packet = JSON.parse(raw);
    return packet?.type === 'CHAT' && typeof packet.text === 'string' ? packet.text.slice(0, 500) : null;
  } catch { return null; }
}

window.Riftlink = { ...(window.Riftlink || {}), peer: { createPeerConnection, configureReliableChannel, configureFastChannel, sendText, readTextPacket } };
