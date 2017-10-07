export default class SignallingClient {

  constructor(host = "wevr.vrlobby.co", roomId = (location.hostname+location.pathname).replace(/\//g,"_")) {
    this.host = host;
    this.roomId = roomId;
    this.secondsTilRetry = 2;
    this.listeners = {};
  }

  start() {
    if (this.ws) {
      this.ws.close();
    }
    this.ws = this.connect(this.host, this.roomId);
  }

  connect(host, roomId) {
    let ws = new WebSocket(`wss://${host}/${roomId}`);
    ws.onclose = () => {
      if (this.secondsTilRetry < 33) {
        this.secondsTilRetry = this.secondsTilRetry * 2;
        console.log("ws closed! - trying to reopen in " + this.secondsTilRetry + " seconds");
        setTimeout(() => {
          try {
            this.start();
          } catch (e) {
            console.error(e);
          }
        }, 1000 * this.secondsTilRetry);
      } else {
        console.log("ws closed! - giving up");
      }
    };

    ws.onopen = () => {
      this.secondsTilRetry = 2;
      console.log("ws opened");
    };

    ws.onerror = (error) => {
      console.error(error);
    };

    ws.onmessage = (event) => {
      try {
        var msg = JSON.parse(event.data);
        if (msg.event != "wevr.ping") {
          console.log("ws received: " + event.data);
        }
        this.dispatch(msg);
      } catch (e) {
        console.error(e);
      }
    };
    return ws;
  }

  addEventListener(type, listener) {
    if (!(type in this.listeners)) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  dispatch(msg) {
    var type = msg.event;
    var param = msg.data;
    if (!(type in this.listeners)) {
      return true;
    }
    var stack = this.listeners[type];
    stack.forEach( (element) => {
      element.call(this, param);
      });
  }

  signal(msg) {
    let msgString = JSON.stringify(msg);
    console.log("signaling: " + msgString);
    this.ws.send(msgString);
  }
}