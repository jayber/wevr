
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
  }

  addChannel(peer, dataChannel) {
    this.channels[peer] = dataChannel;
    this.registerChannelHandlers(dataChannel, peer);
    this.dispatch({event: "open"},peer);
    dataChannel.send(JSON.stringify({event: "ready"}));
  }

  registerChannelHandlers(channel, peer) {
    let handler = (event) => {
      log(`data channel ${peer}: `+JSON.stringify(event), true);
    };
    channel.onmessage = (event) => {this.messageHandler(event, peer)}; //without wrapping arrow function, 'this' in method is the RTCDataChannel obj
    channel.onclose = handler;
    channel.onerror = handler;
  }

  messageHandler(event, peer) {
    var msg = JSON.parse(event.data);
    console.log(peer+" data channel received: " + event.data);
    if (msg.event === "ready"){
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
    if (type === "ready" && this.ready[peer]) {
      this.dispatch({event: "ready"}, peer);
    }
  }

  addEventListener(type, listener) {
    if (!(type in this.listeners)) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
    if (type === "ready") {
      Object.keys(this.ready).forEach((key)=>{
        this.dispatch({event: "ready"}, key);
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
        element.call(this, param, peer);
      });
    }

    if (peer in this.peerListeners && type in this.peerListeners[peer]) {
      stack = this.peerListeners[peer][type];
      stack.forEach((element) => {
        element.call(this, param, peer);
      });
    }
  }
}