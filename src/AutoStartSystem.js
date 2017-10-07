AFRAME.registerSystem('wevr-auto-start', {
  init() {
    this.el.setAttribute("wevr","signalUrl:localhost:9000/wevr;startOnLoad:true");
  }
});

import './index.js'