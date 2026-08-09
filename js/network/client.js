const clientPeer = window.Riftlink.peer;
const clientSignaling = window.Riftlink.signaling;

class ClientNetwork {
  constructor({ onStatus, onMessage, onPing, onError }) { this.onStatus = onStatus; this.onMessage = onMessage; this.onPing = onPing; this.onError = onError; this.connection = null; this.reliable = null; this.fast = null; this.pendingPings = new Map(); }
  async generateAnswer(offerKey) {
    this.close();
    const peer = clientPeer.createPeerConnection(this.onStatus);
    this.connection = peer;
    peer.addEventListener('datachannel', event => {
      if (event.channel.label === 'reliable') { this.reliable = event.channel; clientPeer.configureReliableChannel(event.channel, raw => this.receive(raw), this.onStatus); }
      if (event.channel.label === 'fast') { this.fast = event.channel; clientPeer.configureFastChannel(event.channel); }
    });
    try {
      await peer.setRemoteDescription(clientSignaling.decodeDescription(offerKey, 'offer'));
      await peer.setLocalDescription(await peer.createAnswer());
      this.onStatus('CONNECTING');
      await clientSignaling.waitForIceGathering(peer);
      return clientSignaling.encodeDescription(peer.localDescription);
    } catch (error) { this.onStatus('FAILED'); this.onError(error); this.close(false); throw error; }
  }
  send(text) { clientPeer.sendText(this.reliable, text); }
  ping() { const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`; clientPeer.sendPacket(this.reliable, { type: 'PING', id }); this.pendingPings.set(id, performance.now()); }
  receive(raw) {
    const packet = clientPeer.readPacket(raw);
    if (!packet) return;
    if (packet.type === 'CHAT') this.onMessage(packet.text);
    if (packet.type === 'PING') clientPeer.sendPacket(this.reliable, { type: 'PONG', id: packet.id });
    if (packet.type === 'PONG' && this.pendingPings.has(packet.id)) { const roundTripMs = Math.round(performance.now() - this.pendingPings.get(packet.id)); this.pendingPings.delete(packet.id); this.onPing(roundTripMs); }
  }
  close(report = true) { if (this.connection) this.connection.close(); this.connection = null; this.reliable = null; this.fast = null; this.pendingPings.clear(); if (report) this.onStatus('IDLE'); }
}

window.Riftlink.ClientNetwork = ClientNetwork;
