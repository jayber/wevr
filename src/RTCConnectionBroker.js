import DataChannels from './DataChannels.js';
import log from "./Utils";

export default
class RTCConnectionBroker {

  constructor(signallingClient) {
    this.signallingClient = signallingClient;
    this.connections = {};
    this.candidates = {};
    this.requestMicrophone();
    this.listen("wevr.ice-config", (data) => {
      this.iceConfiguration = data;
    });
    this.listen("wevr.connect", (data) => {
      this.connectTo(data);
    });
    this.listen("wevr.offer", (data) => {
      this.acceptOffer(data);
    });
    this.listen("wevr.answer", (data) => {
      this.acceptAnswer(data);
    });
    this.listen("wevr.ice-candidate", (data) => {
      this.acceptIceCandidate(data);
    });
    this.listen("wevr.leftgame", (data) => {
      this.leftgame(data);
    });
    this.listen("wevr.check-connections", (data) => {
      this.checkConnections(data);
    });
    this.listen("wevr.reconnect", () => {
      this.reconnect();
    });
    this.listen("wevr.id", (data) => {
      log.info(`I am ${data}`);
      window.wevr.id = data;
    });
  }

  requestMicrophone() {
    let self = this;
    let constraints = {audio: true, video: false};
    self.audio = navigator.mediaDevices.getUserMedia(constraints).then((audio) => {
      self.audioState = 'success';
      self.onaudio();
      return audio;
    }).catch((e) => {
      log.error(e);
      self.audioState = 'mute';
      self.onaudio();
    });
    this.audioState = 'requesting';
  }

  listen(event, listener) {
    this.signallingClient.addEventListener(event, listener);
  }

  connectTo(recipient) {
    log.info(`gonna connect to ${recipient}`);
    let connection = new RTCPeerConnection(this.iceConfiguration);
    this.connections[recipient] = connection;

    this.setUpConnection(connection, recipient).then(() => {
      this.createOfferAndSignal(connection, recipient);
    });
  }

  setUpConnection(connection, peer) {
    var self = this;
    connection.oniceconnectionstatechange = (e) => {
      log.debug(`${peer} state changed to ${connection.iceConnectionState}`, true);
      if (connection.iceConnectionState == 'failed') {
        self.signallingClient.signal({
          event: "wevr.peer-ping-failure",
          data: [peer]
        })
      }
    };
    connection.onnegotiationneeded = (e) => {
      log.debug(`${peer} negotiation needed`, true);
    };
    this.handleIceCandidates(connection, peer);
    return this.addAudio(connection, peer);
  }

  createOfferAndSignal(connection, recipient) {
    var channel = connection.createDataChannel("data");
    channel.onopen = (event) => {
      this.onchannel(recipient, channel);
    };

    connection.createOffer().then((offer) => {
      connection.setLocalDescription(offer);
      this.signallingClient.signal({
        event: "wevr.offer",
        data: {to: recipient, payload: offer}
      });
    });
  }

  handleIceCandidates(connection, peer) {
    this.candidates[peer] = [];
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        if (this.sending) {
          this.signalCandidate(peer, event.candidate);
        } else {
          this.candidates[peer].push(event.candidate);
        }
      }
    };
  }

  signalCandidate(peer, candidate) {
    this.signallingClient.signal({
      event: "wevr.ice-candidate",
      data: {to: peer, payload: candidate}
    });
  }

  addAudio(connection, peer) {
    connection.ontrack = (e) => {
      this.onpeeraudio(e.streams[0], peer);
    };
    return this.audio.then((stream) => {
      if (stream) {
        stream.getTracks().forEach(track => {
          connection.addTrack(track, stream);
        });
      }
    }).catch(function (err) {
      log.error(err);
    });

  }

  acceptOffer(data) {
    log.debug(`accepting offer from ${data.from}`);
    let connection = new RTCPeerConnection(this.iceConfiguration);
    connection.ondatachannel = (event) => {
      event.channel.onopen = () => {
        this.onchannel(data.from, event.channel);
      };
    };
    this.connections[data.from] = connection;
    connection.setRemoteDescription(new RTCSessionDescription(data.payload));

    this.setUpConnection(connection, data.from).then(() => {
      this.createAnswerAndSignal(connection, data.from);
    });
  }

  acceptAnswer(data) {
    log.debug(`accepting answer from ${data.from}`);
    let connection = this.connections[data.from];
    connection.setRemoteDescription(new RTCSessionDescription(data.payload));
    this.sendCachedCandidates(data.from);
  }

  sendCachedCandidates(peer) {
    this.candidates[peer].forEach((candidate) => {
      this.signalCandidate(peer, candidate);
    });
    this.sending = true;
  }

  createAnswerAndSignal(connection, sender) {
    connection.createAnswer().then((answer) => {
      connection.setLocalDescription(answer);
      this.signallingClient.signal({
        event: "wevr.answer",
        data: {to: sender, payload: answer}
      });
    });
  }

  acceptIceCandidate(data) {
    log.debug(`accepting ice-candidate from ${data.from}`);
    let connection = this.connections[data.from];
    connection.addIceCandidate(new RTCIceCandidate(data.payload));
    if (!this.sending) {
      this.sendCachedCandidates(data.from);
    }
  }

  leftgame(peer) {
    if (this.connections[peer]) {
      this.connections[peer].close();
      delete this.connections[peer];
    }
    var element = document.getElementById(peer);
    if (element) {
      log.debug(`removing ${peer}`, true);
      element.parentNode.removeChild(element);
    }
  }

  checkConnections(peers) {
    this.oncheckconnections(peers);
  }

  reconnect() {
    this.onreconnect();
  }

  sendPeerPingFailures(failures) {
    this.signallingClient.signal({
      event: "wevr.peer-ping-failure",
      data: failures
    });
  }
}