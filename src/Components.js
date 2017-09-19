import SignallingClient from "./SignallingClient.js";
import RTCConnectionBroker from "./RTCConnectionBroker.js";
import StateHandler from "./StateHandler.js";
import * as _ from 'lodash';
import serverLog from "./Utils";

AFRAME.registerSystem('wevr', {
  schema: {
    period: {default: 100},
    signalUrl: {default: 'wevr.vrlobby.co'}
  },

  init() {
    this.signaller = new SignallingClient(this.data.signalUrl);
    let broker = new RTCConnectionBroker(this.signaller);
    this.channels = broker.dataChannels;

    this.el.addEventListener("loaded", () => {
      this.signaller.start();
    });

    this.setUpPlayer(this.el.sceneEl);

    this.setUpAudio(broker, this.el);

    this.setUpChannels(this.channels, this.el.sceneEl);

    this.setUpStateHandler(this.signaller, this.channels, this.el);
  },

  setUpPlayer(sceneEl) {
    let element = document.createElement("a-entity");
    element.setAttribute("gamepad-controls","");
    element.innerHTML =
      `<a-entity wevr-player wasd-controls look-controls camera="userHeight:1.6">
    </a-entity>
    <a-entity hand-controls="right" laser-controls="hand:right"></a-entity>
    <a-entity hand-controls="left"></a-entity>`;
    sceneEl.appendChild(element);
  },

  setUpAudio(broker, el) {
    broker.onaudio = (stream, peer) => {
      let element = document.createElement("audio");
      this.findPeerElement(peer, el).appendChild(element);
      element.autoplay = true;
      element.srcObject = stream;
      element.play();
    };
  },

  setUpStateHandler(sig, channels, el) {
    this.stateHandler = new StateHandler(sig,channels);
    this.stateHandler.addStateListener("#environment", (data) => {
      el.systems['switch-environment'].setEnvironmentIndex(data.envName);
    });
  },

  setUpChannels(channels, sceneEl) {
    channels.addEventListener("open", (data, peer) => {
      let element = this.createAvatar(peer, sceneEl);

      channels.addEventListenerForPeer(peer, "wevr.movement", (event) => {
        this.updateMovement(element, event);
      });

      channels.addEventListenerForPeer(peer, "wevr.movement-init", (event) => {
        element.object3D.position.copy(new THREE.Vector3(event.position.x, event.position.y, event.position.z));
        element.object3D.quaternion.copy(new THREE.Quaternion(event.quaternion._x, event.quaternion._y, event.quaternion._z, event.quaternion._w));
        element.setAttribute("visible", "true");
      });
    });
  },

  createAvatar(peer, sceneEl) {
    let element = document.createElement("a-entity");
    element.setAttribute("wevr-avatar", "");
    element.setAttribute("visible", "false");
    this.findPeerElement(peer, sceneEl).appendChild(element);
    return element;
  },

  findPeerElement(peer, sceneEl) {
    let element = document.getElementById(peer);
    if (!element) {
      element = document.createElement("a-entity");
      element.setAttribute("id", peer);
      sceneEl.appendChild(element);
    }
    return element;
  },

  updateMovement(element, event) {
    let component = element.components['wevr-avatar'];
    component.targetPosition = new THREE.Vector3(event.position.x, event.position.y, event.position.z);
    component.startPosition = element.object3D.position.clone();
    component.targetRotation = new THREE.Quaternion(event.quaternion._x, event.quaternion._y, event.quaternion._z, event.quaternion._w);
    component.timeUpdated = Date.now();
  }
});

AFRAME.registerComponent('wevr-avatar', {
  init() {
    this.el.innerHTML = `<a-sphere class="head"
                          color="#5985ff"
                          scale="0.4 0.45 0.35">

<a-entity class="face"
                          position="0 0 -0.6">
                        <a-sphere position="0 0.05 -0.4"
                          color="#5985ff"
                          scale="0.18 0.18 0.18">
                </a-sphere>
                    <a-sphere class="eye"
                              color="#efefef"
                              position="0.3 0.35 -0.3"
                              scale="0.15 0.15 0.15"
                            >
                        <a-sphere class="pupil"
                                  color="#000"
                                  position="0 0 -1"
                                  scale="0.45 0.45 0.45"
                                ></a-sphere>
                    </a-sphere>
                    <a-sphere class="eye"
                              color="#efefef"
                              position="-0.3 0.35 -0.3"
                              scale="0.15 0.15 0.15"
                            >
                        <a-sphere class="pupil"
                                  color="#000"
                                  position="0 0 -1"
                                  scale="0.45 0.45 0.45"
                                ></a-sphere>
                    </a-sphere>
                </a-entity>

                </a-sphere>`;
    this.system = this.el.sceneEl.systems.wevr;
    this.period = this.system.data.period;
  },

  tick(time, timeDelta) {
    if (this.timeUpdated) {
      let progress = (Date.now() - this.timeUpdated) / this.period;
      if (progress < 1) {
        if (this.targetPosition) {
          this.el.object3D.position.lerpVectors(this.startPosition, this.targetPosition, progress);
        }
        if (this.targetRotation) {
          this.el.object3D.quaternion.slerp(this.targetRotation, progress);
        }
      } else {
        if (this.targetPosition) {
          this.el.object3D.position.copy(this.targetPosition);
        }
        if (this.targetRotation) {
          this.el.object3D.quaternion.copy(this.targetRotation);
        }
        this.timeUpdated = undefined;
      }
    }
  }
});

AFRAME.registerComponent('wevr-player', {
  init() {
    this.system = this.el.sceneEl.systems.wevr;

    this.setPosition(this.el.parentNode);
    this.el.object3D.updateMatrixWorld();
    this.position = this.el.object3D.getWorldPosition();
    this.quaternion = this.el.object3D.getWorldQuaternion();
    this.period = this.system.data.period;

    this.system.channels.addEventListener("ready", (data, peer) => {
      this.system.channels.sendTo(peer, "wevr.movement-init", {position: this.position, quaternion: this.quaternion});
      serverLog("sendTo " + peer);
    });
  },

  setPosition(el) {
    var center = {x: 0, y: 0, z: 0};
    let radius = 3;

    var angleRad = this.getRandomAngleInRadians();
    var circlePoint = this.randomPointOnCircle(radius, angleRad);
    var worldPoint = {x: circlePoint.x + center.x, y: center.y, z: circlePoint.y + center.z};
    el.setAttribute('position', worldPoint);

    var angleDeg = angleRad * 180 / Math.PI;
    var angleToCenter = -1 * angleDeg + 90;
    var rotationStr = '0 ' + angleToCenter + ' 0';
    el.setAttribute('rotation', rotationStr);
  },

  tick(time, delta) {
    if (!this.lastSent || time - this.lastSent > this.period) {
      this.el.object3D.updateMatrixWorld(true);
      var position = this.el.object3D.getWorldPosition();
      var quaternion = this.el.object3D.getWorldQuaternion();

      if (!_.isEqual(this.position, position) || !_.isEqual(this.quaternion, quaternion)) {
        this.system.channels.broadcast("wevr.movement", {position: position, quaternion: quaternion});
        this.position = position;
        this.quaternion = quaternion;
      }
      this.lastSent = time;
    }
  },

  getRandomAngleInRadians: function () {
    return Math.random() * Math.PI * 2;
  },

  randomPointOnCircle: function (radius, angleRad) {
    let x = Math.cos(angleRad) * radius;
    let y = Math.sin(angleRad) * radius;
    return {x: x, y: y};
  }
});