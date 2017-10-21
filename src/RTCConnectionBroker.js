import DataChannels from './DataChannels.js';
import serverLog from "./Utils";

export default
class RTCConnectionBroker {

  constructor(signallingClient) {
    let constraints = {audio: true, video: false};
    this.audio = navigator.mediaDevices.getUserMedia(constraints);
    this.signallingClient = signallingClient;
    this.connections = {};
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
    this.configuration = {
      iceServers: [{
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302"
        ]
      }, {
        urls: "turn:54.74.139.199:3478",
        credential: "none",
        username: "noone"
      }],
      iceCandidatePoolSize: 10
    };
    let connection = new RTCPeerConnection(this.configuration);
    this.connections[recipient] = connection;

    this.setUpConnection(connection, recipient).then(() => {
      this.createOfferAndSignal(connection, recipient);
    });
  }

  setUpConnection(connection, peer) {
    connection.oniceconnectionstatechange = () => {
      serverLog(`${peer} state changed to ${connection.iceConnectionState}`);
    };
    connection.onnegotiationneeded = () => {
      serverLog(`${peer} negotiation needed`);
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
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signallingClient.signal({
          event: "wevr.ice-candidate",
          data: {to: peer, payload: event.candidate}
        });
      }
    };
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
    let connection = new RTCPeerConnection(this.configuration);
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
  }

  leftgame(peer) {
    if (this.connections[peer]) {
      this.connections[peer].close();
      delete this.connections[peer];
    }
    var element = document.getElementById(peer);
    if (element) {
      serverLog(`removing ${peer}`);
      element.parentNode.removeChild(element);
    }
  }
}