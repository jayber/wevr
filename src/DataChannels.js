
import log from "./Utils";

export default
class DataChannels {

  constructor(broker) {
    this.channels = {};
    this.listeners = {};
    this.peerListeners = {};
    this.ready = {};
    broker.onchannel = (peer, dataChannel) => {
      this.addChannel(peer, dataChannel);
    };
    this.setUpPeerConnectionChecks(broker);
  }

  addChannel(peer, dataChannel) {
    this.channels[peer] = dataChannel;
    this.registerChannelHandlers(dataChannel, peer);
    this.dispatch({event: "wevr.open"},peer);
    dataChannel.send(JSON.stringify({event: "wevr.ready"}));
  }


  setUpPeerConnectionChecks(broker) {
    broker.oncheckconnections = (peers) => {
      this.checkConnections(peers, broker)
    };
    this.addEventListener("wevr.peer-ping", (param, peer) => {
      this.sendTo(peer, "wevr.peer-ping-reply", {});
    });
    broker.onreconnect = () => {
      log.debug("received reconnect. reloading: " + window.wevr.id);
      location.reload();
    }
  }

  checkConnections(peers, broker) {
    this.pingReplies = [];
    this.pingRecpients = peers;
    var self = this;
    self.removeAllPeerListeners("wevr.peer-ping-reply");
    peers.forEach((peer) => {
      self.addEventListenerForPeer(peer, "wevr.peer-ping-reply",() => {
        self.pingReplies.push(peer);
      })
    });
    this.broadcast("wevr.peer-ping",{});
    setTimeout(()=> {
        if (self.pingRecpients.length != self.pingReplies.length) {
          if (self.pingReplies.length == 0 && self.pingRecpients.length > 1) {
            log.debug("no answers, i might be the problem");
            broker.onreconnect();
          } else {
            broker.sendPeerPingFailures( _.difference(self.pingRecpients, self.pingReplies));
          }
        }
      }
      , 30000);
  }

  registerChannelHandlers(channel, peer) {
    let handler = (event) => {
      log.debug(`data channel ${peer}: `+JSON.stringify(event), true);
    };
    channel.onmessage = (event) => {this.messageHandler(event, peer)}; //without wrapping arrow function, 'this' in method is the RTCDataChannel obj
    channel.onclose = handler;
    channel.onerror = handler;
  }

  messageHandler(event, peer) {
    var msg = JSON.parse(event.data);
    log.trace(peer+" data channel received: " + event.data);
    if (msg.event === "wevr.ready"){
      this.ready[peer] = true;
    }
    this.dispatch(msg, peer);
  }

  addEventListenerForPeer(peer, type, listener) {
    if (!(peer in this.peerListeners)) {
      this.peerListeners[peer] = {};
    }
    if (!(type in this.peerListeners[peer])) {
      this.peerListeners[peer][type] = [];
    }
    this.peerListeners[peer][type].push(listener);
    if (type === "wevr.ready" && this.ready[peer]) {
      this.dispatch({event: "wevr.ready"}, peer);
    }
  }

  removeAllPeerListeners(type) {
    Object.keys(this.peerListeners).forEach( (key) => {
      delete this.peerListeners[key][type];
    })
  }

  addEventListener(type, listener) {
    if (!(type in this.listeners)) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
    if (type === "wevr.ready") {
      Object.keys(this.ready).forEach((key)=>{
        this.dispatch({event: "wevr.ready"}, key);
    });
    }
  }

  sendTo(peer, event, data) {
      let channel = this.channels[peer];
      if (channel.readyState === "open") {
        channel.send(JSON.stringify({event, data}));
      } else {
        channel.onopen = () => {
          channel.send(JSON.stringify({event, data}));
        }
      }
  }

  broadcast(event, data) {
    Object.keys(this.channels).forEach((peer) => {
      let channel = this.channels[peer];
      if (channel.readyState === "open") {
        channel.send(JSON.stringify({event, data}));
      } else {
        channel.onopen = () => {
          channel.send(JSON.stringify({event, data}));
        }
      }
    });
  }

  dispatch(msg, peer) {
    var type = msg.event;
    var param = msg.data;
    if (type in this.listeners) {
      var stack = this.listeners[type];
      stack.forEach((element) => {
        element(param, peer);
      });
    }

    if (peer in this.peerListeners && type in this.peerListeners[peer]) {
      stack = this.peerListeners[peer][type];
      stack.forEach((element) => {
        element(param, peer);
      });
    }
  }
}