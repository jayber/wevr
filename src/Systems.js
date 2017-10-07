import SignallingClient from "./SignallingClient.js";
import RTCConnectionBroker from "./RTCConnectionBroker.js";
import StateHandler from "./StateHandler.js";
import DataChannels from "./DataChannels.js";


AFRAME.registerSystem('wevr', {
  schema: {
    period: {default: 100},
    signalUrl: {default: 'wevr.vrlobby.co'},
    startOnLoad: {default: false}
  },

  init() {
    if (this.data.startOnLoad) this.start();
  },

  start() {
    this.signaller = new SignallingClient(this.data.signalUrl);
    let broker = new RTCConnectionBroker(this.signaller);
    this.channels = new DataChannels(broker);

    this.stateHandler = new StateHandler(this.signaller, this.channels);

    this.setUpPlayer(this.el.sceneEl);

    this.setUpAudio(broker, this.el);

    this.setUpAvatars(this.channels, this.el.sceneEl);

    if (this.el.hasLoaded) {
      this.signaller.start();
    } else {
      this.el.addEventListener("loaded", () => {
        this.signaller.start();
      });
    }
  },

  setUpPlayer(sceneEl) {
    let element = document.createElement("a-entity");
    element.setAttribute("joysticks-movement", "");
    element.innerHTML =
      `<a-entity wevr-player refresh-button wasd-controls look-controls camera="userHeight:1.6">
    <a-entity maybe-cursor
            visible="false"
            position="0 0 -1"
            geometry="primitive: ring; radiusInner: 0.01; radiusOuter: 0.015"
            material="color: darkgrey; shader: flat"></a-entity>
    </a-entity>
    <a-entity wevr-player-hand="right" hand-controls="right" laser-controls="hand:right"></a-entity>
    <a-entity wevr-player-hand="left" hand-controls="left"></a-entity>`;
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

  setUpAvatars(channels, sceneEl) {
    channels.addEventListener("open", (data, peer) => {
      let element = this.createAvatarElement(peer, sceneEl, "wevr-avatar", peer);

      channels.addEventListenerForPeer(peer, "wevr.movement-init", (event) => {
        element.object3D.position.copy(new THREE.Vector3(event.position.x, event.position.y, event.position.z));
        element.object3D.quaternion.copy(new THREE.Quaternion(event.quaternion._x, event.quaternion._y, event.quaternion._z, event.quaternion._w));
        element.setAttribute("visible", "true");
      });

      channels.addEventListenerForPeer(peer, `wevr.movement-init.hand`, (event) => {
        let element = this.createAvatarElement(peer, sceneEl, "wevr-avatar-hand", `peer:${peer};hand:${event.hand}`);
        var object3D = element.object3D;
        object3D.position.copy(new THREE.Vector3(event.position.x, event.position.y, event.position.z));
        object3D.quaternion.copy(new THREE.Quaternion(event.quaternion._x, event.quaternion._y, event.quaternion._z, event.quaternion._w));
        element.setAttribute("visible", "true");
      });
    });
  },

  createAvatarElement(peer, sceneEl, componentName, value) {
    let element = document.createElement("a-entity");
    element.setAttribute(componentName, value);
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

  updateMovement(element, event, component) {
    component.targetPosition = new THREE.Vector3(event.position.x, event.position.y, event.position.z);
    component.startPosition = element.object3D.position.clone();
    component.targetRotation = new THREE.Quaternion(event.quaternion._x, event.quaternion._y, event.quaternion._z, event.quaternion._w);
    component.timeUpdated = Date.now();
  },

  makeMovementChanges(source) {
    if (source.timeUpdated) {
      let progress = (Date.now() - source.timeUpdated) / this.period;
      if (progress < 1) {
        if (source.targetPosition) {
          source.el.object3D.position.lerpVectors(source.startPosition, source.targetPosition, progress);
        }
        if (source.targetRotation) {
          source.el.object3D.quaternion.slerp(source.targetRotation, progress);
        }
      } else {
        if (source.targetPosition) {
          source.el.object3D.position.copy(source.targetPosition);
        }
        if (source.targetRotation) {
          source.el.object3D.quaternion.copy(source.targetRotation);
        }
        source.timeUpdated = undefined;
      }
    }
  }
});