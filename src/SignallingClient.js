import log from "./Utils";

export default class SignallingClient {

  constructor(host = "wss://wevr.vrlobby.co", roomId = location.pathname.substr(1).replace(/\//g,"_")) {
    this.host = host;
    this.roomId = roomId;
    this.secondsTilRetry = 2;
    this.listeners = {};
  }

  start() {
    if (this.ws) {
      this.close();
    }
    this.ws = this.connect(this.host, this.roomId);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }

  connect(host, roomId) {
    let ws = new WebSocket(`${host}?roomId=${roomId}`);
    ws.onclose = () => {
      if (this.secondsTilRetry < 33) {
        this.secondsTilRetry = this.secondsTilRetry * 2;
        log.info("ws closed! - trying to reopen in " + this.secondsTilRetry + " seconds");
        setTimeout(() => {
          try {
            this.start();
          } catch (e) {
            log.error(e);
          }
        }, 1000 * this.secondsTilRetry);
      } else {
        log.info("ws closed! - giving up");
      }
    };

    ws.onopen = () => {
      this.secondsTilRetry = 2;
      log.info("ws opened");
    };

    ws.onerror = (error) => {
      log.error(error);
    };

    ws.onmessage = (event) => {
      try {
        var msg = JSON.parse(event.data);
        if (msg.event != "wevr.ping") {
          log.debug("ws received: " + event.data);
        }
        this.dispatch(msg);
      } catch (e) {
        log.error(e);
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
    log.debug("signaling: " + msgString);
    this.ws.send(msgString);
  }
}