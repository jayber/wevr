import DataChannels from './DataChannels.js';
import log from "./Utils";

export default
class RTCConnectionBroker {

  constructor(signallingClient) {

    this.iceConfiguration = {
      iceServers: [{
        urls: [
          "stun:stun.l.google.com:19302"
        ]
      }, {
        urls: "turn:ec2-54-74-139-199.eu-west-1.compute.amazonaws.com:3478",
        credential: "noone",
        username: "none"
      }],
      iceCandidatePoolSize: 0
    };

/*  */

    let constraints = {audio: true, video: false};
    this.audio = navigator.mediaDevices.getUserMedia(constraints);
    this.signallingClient = signallingClient;
    this.connections = {};
    this.candidates = {}
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
    this.listen("wevr.id", (data) => {
      console.log(`I am ${data}`);
      window.wevr.id = data;
    });
  }

  listen(event, listener) {
    this.signallingClient.addEventListener(event, listener);
  }

  connectTo(recipient) {
    console.log(`gonna connect to ${recipient}`);
    let connection = new RTCPeerConnection(this.iceConfiguration);
    this.connections[recipient] = connection;

    this.setUpConnection(connection, recipient).then(() => {
      this.createOfferAndSignal(connection, recipient);
    });
  }

  setUpConnection(connection, peer) {
    connection.oniceconnectionstatechange = (e) => {
      log(`${peer} state changed to ${connection.iceConnectionState}`, true);
    };
    connection.onnegotiationneeded = (e) => {
      log(`${peer} negotiation needed`, true);
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
      this.onaudio(e.streams[0], peer);
    };
    return this.audio.then((stream) => {
      stream.getTracks().forEach(track => {
        connection.addTrack(track, stream);
      });
    }).catch(function (err) {
      console.error(err);
    });
  }

  acceptOffer(data) {
    console.log(`accepting offer from ${data.from}`);
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
    console.log(`accepting answer from ${data.from}`);
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
    console.log(`accepting ice-candidate from ${data.from}`);
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
      log(`removing ${peer}`, true);
      element.parentNode.removeChild(element);
    }
  }
}