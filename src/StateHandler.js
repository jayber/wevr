export default class StateHandler {
  constructor(signaller, dataChannels) {
    this.signaller = signaller;
    this.dataChannels = dataChannels;
    this.listeners = {};
    this.signaller.addEventListener("wevr.state", (data) => {
      this.dispatch(data);
    });
    this.dataChannels.addEventListener("wevr.state", (data) => {
      this.dispatch(data);
    });
  }

  updateState(key, data) {
    this.signaller.signal({event: "wevr.state", data: {key, data}});
    this.dataChannels.broadcast("wevr.state", {key, data});
  }

  addStateListener(type, listener) {
    if (!(type in this.listeners)) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  dispatch(msg) {
    var type = msg.key;
    var param = msg.data;
    if (!(type in this.listeners)) {
      return true;
    }
    var stack = this.listeners[type];
    stack.forEach( (element) => {
      element.call(this, param);
    });
  }
}