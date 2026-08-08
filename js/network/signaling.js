function encodeDescription(description) {
  return JSON.stringify({ type: description.type, sdp: description.sdp });
}

function decodeDescription(value, expectedType) {
  let description;
  try { description = JSON.parse(value.trim()); } catch { throw new Error(`Invalid ${expectedType}: the key is not valid JSON.`); }
  if (!description || description.type !== expectedType || typeof description.sdp !== 'string' || !description.sdp) {
    throw new Error(`Invalid ${expectedType}: expected a complete ${expectedType} session description.`);
  }
  return description;
}

function waitForIceGathering(peerConnection, timeoutMs = 15000) {
  if (peerConnection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('ICE gathering timed out. Check the local network and try again.')); }, timeoutMs);
    const onStateChange = () => { if (peerConnection.iceGatheringState === 'complete') { cleanup(); resolve(); } };
    const cleanup = () => { clearTimeout(timeout); peerConnection.removeEventListener('icegatheringstatechange', onStateChange); };
    peerConnection.addEventListener('icegatheringstatechange', onStateChange);
  });
}

window.Riftlink = { ...(window.Riftlink || {}), signaling: { encodeDescription, decodeDescription, waitForIceGathering } };
