AFRAME.registerSystem('wevr-auto-start', {
  init() {
    var wevr = this.el.systems.wevr;
    wevr.data.signalUrl = "localhost:9000/wevr";
    wevr.data.startOnLoad = true;
    wevr.start();
  }
});

import './index.js'