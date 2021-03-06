import SignallingClient from "./SignallingClient.js";
import RTCConnectionBroker from "./RTCConnectionBroker.js";
import StateHandler from "./StateHandler.js";
import DataChannels from "./DataChannels.js";
import PositionalAudio from "./PositionalAudio.js";
import {detect} from 'detect-browser';
import log from "./Utils";
import * as THREE from 'three';
import * as _ from 'lodash';


AFRAME.registerSystem('wevr', {
  schema: {
    period: {default: 100},
    signalUrl: {default: 'wss://wevr.vrlobby.co/wevr'},
    avatarTemplate: {default: ''},
    avatarRHTemplate: {default: ''},
    avatarLHTemplate: {default: ''},
    startOnLoad: {default: false}
  },

  init() {
    if (this.data.startOnLoad) this.start();
  },

  start() {
    let signaller = new SignallingClient(this.data.signalUrl);
    let broker = new RTCConnectionBroker(signaller);
    this.channels = new DataChannels(broker);
    this.stateHandler = new StateHandler(signaller, this.channels);
    this.positionalAudio = new PositionalAudio();

    this.setUpPlayer(this.el.sceneEl);

    this.setUpAudio(broker, this.el);

    this.setUpAvatars(this.channels, this.el.sceneEl);

    if (this.el.hasLoaded) {
      signaller.start();
    } else {
      this.el.addEventListener("loaded", () => {
        signaller.start();
      });
    }
  },

  setUpPlayer(sceneEl) {
    let element = document.createElement("a-entity");
    element.setAttribute("id", "player");
    element.setAttribute("joysticks-movement", "");
    element.innerHTML =
      `<a-entity wevr-player refresh-button wasd-controls look-controls camera="userHeight:1.6">
    <a-entity maybe-cursor
            visible="false"
            position="0 0 -1"
            geometry="primitive: ring; radiusInner: 0.01; radiusOuter: 0.015"
            material="color: darkgrey; shader: flat"></a-entity>
    <a-entity id="audioinfo" text="value:requesting microphone;color:#ccc;anchor:center;baseline:center;width:2;align:center;transparent:true" position="0 -0.75 -2"></a-entity>
    </a-entity>
    <a-entity wevr-player-hand="right" hand-controls="right" cursor="downEvents:triggerdown;upEvents:triggerup" raycaster="showLine:true"></a-entity>
    <a-entity wevr-player-hand="left" hand-controls="left"></a-entity>`;
    sceneEl.appendChild(element);
  },

  setUpAudio(broker, sceneEl) {
    broker.onaudio = () => {
      var el = document.getElementById("audioinfo");
      if (el) {
        if (broker.audioState == "success") {
          el.setAttribute("visible", "false");
        } else {
          el.setAttribute("text","value",broker.audioState)
        }
      }
    };
    broker.onpeeraudio = (stream, peer) => {
      const browser = detect();
      switch (browser && browser.name) {
        case 'chrome':
          this.useAudioElement(stream, peer, sceneEl);
          break;
        default:
          this.positionalAudio.usePositionalAudio(stream, peer);
      }
    };
  },

  useAudioElement(stream, peer, el) {
    let element = document.createElement("audio");
    this.findPeerElement(peer, el).appendChild(element);
    element.autoplay = true;
    element.srcObject = stream;
    element.play();
  },

  setUpAvatars(channels, sceneEl) {
    channels.addEventListener("wevr.open", (data, peer) => {
      let element = this.createAvatarElement(peer, sceneEl, "wevr-avatar", peer);
      if (this.data.avatarTemplate) {
        element.setAttribute('template','src:'+this.data.avatarTemplate)
      }

      channels.addEventListenerForPeer(peer, "wevr.movement-init", (event) => {
        element.object3D.position.copy(new THREE.Vector3(event.position.x, event.position.y, event.position.z));
        element.object3D.quaternion.copy(new THREE.Quaternion(event.quaternion._x, event.quaternion._y, event.quaternion._z, event.quaternion._w));
        element.setAttribute("visible", "true");
      });

      channels.addEventListenerForPeer(peer, `wevr.movement-init.hand`, (event) => {
        let element = this.createAvatarElement(peer, sceneEl, "wevr-avatar-hand", `peer:${peer};hand:${event.hand}`);
        if (event.hand == 'right' && this.data.avatarRHTemplate) {
          element.setAttribute('template','src:'+this.data.avatarRHTemplate)
        } else if (this.data.avatarLHTemplate) {
          element.setAttribute('template','src:'+this.data.avatarLHTemplate)
        }
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
    component.targetPosition.x = event.position.x;
    component.targetPosition.y = event.position.y;
    component.targetPosition.z = event.position.z;
    component.startPosition.x = element.object3D.position.x;
    component.startPosition.y = element.object3D.position.y;
    component.startPosition.z = element.object3D.position.z;
    component.targetRotation.x = event.quaternion._x;
    component.targetRotation.y = event.quaternion._y;
    component.targetRotation.z = event.quaternion._z;
    component.targetRotation.w = event.quaternion._w;
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