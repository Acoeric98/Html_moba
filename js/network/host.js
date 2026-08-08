const hostPeer = window.Riftlink.peer;
const hostSignaling = window.Riftlink.signaling;

class HostNetwork {
  constructor({ onStatus, onMessage, onError }) { this.peers = new Map(); this.onStatus = onStatus; this.onMessage = onMessage; this.onError = onError; }

  async generateOffer(playerId) {
    this.closePeer(playerId);
    const peer = hostPeer.createPeerConnection(status => this.onStatus(playerId, status));
    const reliable = peer.createDataChannel('reliable', { ordered: true });
    const fast = peer.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
    hostPeer.configureFastChannel(fast);
    hostPeer.configureReliableChannel(reliable, raw => this.receive(playerId, raw), status => this.onStatus(playerId, status));
    this.peers.set(playerId, { connection: peer, reliable, fast });
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
  receive(playerId, raw) { const text = hostPeer.readTextPacket(raw); if (text !== null) this.onMessage(playerId, text); }
  closePeer(playerId) { const entry = this.peers.get(playerId); if (entry) entry.connection.close(); this.peers.delete(playerId); }
  closeAll() { for (const id of this.peers.keys()) this.closePeer(id); }
}

window.Riftlink.HostNetwork = HostNetwork;
