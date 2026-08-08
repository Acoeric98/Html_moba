const clientPeer = window.Riftlink.peer;
const clientSignaling = window.Riftlink.signaling;

class ClientNetwork {
  constructor({ onStatus, onMessage, onError }) { this.onStatus = onStatus; this.onMessage = onMessage; this.onError = onError; this.connection = null; this.reliable = null; this.fast = null; }
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
  receive(raw) { const text = clientPeer.readTextPacket(raw); if (text !== null) this.onMessage(text); }
  close(report = true) { if (this.connection) this.connection.close(); this.connection = null; this.reliable = null; this.fast = null; if (report) this.onStatus('IDLE'); }
}

window.Riftlink.ClientNetwork = ClientNetwork;
