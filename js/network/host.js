const hostPeer = window.Riftlink.peer;
const hostSignaling = window.Riftlink.signaling;

class HostNetwork {
  constructor({ onStatus, onMessage, onPing, onError }) { this.peers = new Map(); this.onStatus = onStatus; this.onMessage = onMessage; this.onPing = onPing; this.onError = onError; }

  async generateOffer(playerId) {
    this.closePeer(playerId);
    const peer = hostPeer.createPeerConnection(status => this.onStatus(playerId, status));
    const reliable = peer.createDataChannel('reliable', { ordered: true });
    const fast = peer.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
    hostPeer.configureFastChannel(fast);
    hostPeer.configureReliableChannel(reliable, raw => this.receive(playerId, raw), status => this.onStatus(playerId, status));
    this.peers.set(playerId, { connection: peer, reliable, fast, pendingPings: new Map() });
    try {
      await peer.setLocalDescription(await peer.createOffer());
      this.onStatus(playerId, 'OFFER CREATED');
      await hostSignaling.waitForIceGathering(peer);
      this.onStatus(playerId, 'WAITING FOR ANSWER');
      return hostSignaling.encodeDescription(peer.localDescription);
    } catch (error) { this.onStatus(playerId, 'FAILED'); this.onError(playerId, error); throw error; }
  }

  async applyAnswer(playerId, answerKey) {
    const entry = this.peers.get(playerId);
    if (!entry) throw new Error('Generate an offer for this player before applying an answer.');
    try { this.onStatus(playerId, 'CONNECTING'); await entry.connection.setRemoteDescription(hostSignaling.decodeDescription(answerKey, 'answer')); }
    catch (error) { this.onStatus(playerId, 'FAILED'); this.onError(playerId, error); throw error; }
  }

  send(playerId, text) { hostPeer.sendText(this.peers.get(playerId)?.reliable, text); }
  ping(playerId) {
    const entry = this.peers.get(playerId);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    hostPeer.sendPacket(entry?.reliable, { type: 'PING', id });
    entry.pendingPings.set(id, performance.now());
  }
  receive(playerId, raw) {
    const entry = this.peers.get(playerId);
    const packet = hostPeer.readPacket(raw);
    if (!packet) return;
    if (packet.type === 'CHAT') this.onMessage(playerId, packet.text);
    if (packet.type === 'PING') hostPeer.sendPacket(entry?.reliable, { type: 'PONG', id: packet.id });
    if (packet.type === 'PONG' && entry?.pendingPings.has(packet.id)) {
      const roundTripMs = Math.round(performance.now() - entry.pendingPings.get(packet.id));
      entry.pendingPings.delete(packet.id);
      this.onPing(playerId, roundTripMs);
    }
  }
  closePeer(playerId) { const entry = this.peers.get(playerId); if (entry) entry.connection.close(); this.peers.delete(playerId); }
  closeAll() { for (const id of this.peers.keys()) this.closePeer(id); }
}

window.Riftlink.HostNetwork = HostNetwork;
