import * as _ from 'lodash';
import log from "./Utils";


AFRAME.registerComponent('wevr-avatar', {
  schema: {type: "string"},
  init() {
    this.el.innerHTML = `<a-sphere class="head"
                          color="#5985ff"
                          position="0 -0.05 0"
                          scale="0.25 0.3 0.2">

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

                </a-sphere>
                `;
    this.system = this.el.sceneEl.systems.wevr;

    var channels = this.system.channels;
    channels.addEventListenerForPeer(this.data, "wevr.movement", (event) => {
      this.system.updateMovement(this.el, event, this);

    })
  },

  tick(time, timeDelta) {
    this.system.makeMovementChanges(this);
    this.system.positionalAudio.makeAudioPositionChanges(this.data, this.targetPosition);
  }
});

AFRAME.registerComponent('wevr-avatar-hand', {
  schema: {
    peer: {type: "string"},
    hand: {type: "string"}
  },
  init() {
    var rotation = this.data.hand.toLowerCase() == "right" ? 'rotation="0 0 180"' : '';

    this.el.innerHTML = `<a-sphere color="#5985ff" radius="0.1" ${rotation}><a-sphere position="0.09 0 0.02" scale="0.5 0.5 0.5" color="#5985ff" radius="0.1"></a-sphere>
    <a-sphere position="0 0 -0.075" scale="0.35 0.35 1" color="#5985ff" radius="0.1"></a-sphere>
    <a-sphere position="0.05  0 -0.075" rotation="0 -20 0" scale="0.35 0.35 1" color="#5985ff" radius="0.1"></a-sphere>
    <a-sphere position="-0.05 0 -0.075" rotation="0 20 0" scale="0.25 0.25 0.75" color="#5985ff" radius="0.1"></a-sphere>
    </a-sphere>`;

    this.system = this.el.sceneEl.systems.wevr;
    var channels = this.system.channels;

    channels.addEventListenerForPeer(this.data.peer, `wevr.movement.hands.${this.data.hand}`, (event) => {
      this.system.updateMovement(this.el, event, this);
    });
  },

  tick(time, timeDelta) {
    this.system.makeMovementChanges(this);
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
      log.debug("init movement: " + peer, false);

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
        this.system.positionalAudio.updateListener(this.el.object3D.matrixWorld);
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


AFRAME.registerComponent('wevr-player-hand', {
  schema: {type: "string"},
  init() {
    this.system = this.el.sceneEl.systems.wevr;

    this.initializeHands();
    window.addEventListener("gamepadconnected", () => {
      this.initializeHands()
    });
  },

  initializeHands() {
    this.hasHand = this.checkHand(this.data);
    if (this.hasHand) {
      this.el.setAttribute("visible", "true");
      this.el.object3D.updateMatrixWorld();
      this.position = this.el.object3D.getWorldPosition();
      this.quaternion = this.el.object3D.getWorldQuaternion();
      this.period = this.system.data.period;

      this.system.channels.addEventListener("ready", (data, peer) => {
        this.system.channels.sendTo(peer, `wevr.movement-init.hand`, {
          hand: this.data,
          position: this.position,
          quaternion: this.quaternion
        });
        log.debug("init hand movement: " + this.data + peer, false);
      });

    } else {
      this.el.setAttribute("visible", "false");
    }
  },

  checkHand(hand) {
    var gamepads = navigator.getGamepads && navigator.getGamepads();
    var i = 0;
    if (gamepads) {
      for (; i < gamepads.length; i++) {
        var gamepad = gamepads[i];
        if (gamepad) {
          if (gamepad.id.toLowerCase().indexOf(hand) != -1) {
            return true;
          }
        }
      }
    }
    return false;
  },

  tick(time, delta) {
    if (this.hasHand) {
      if (!this.lastSent || time - this.lastSent > this.period) {
        this.el.object3D.updateMatrixWorld(true);
        var position = this.el.object3D.getWorldPosition();
        var quaternion = this.el.object3D.getWorldQuaternion();

        if (!_.isEqual(this.position, position) || !_.isEqual(this.quaternion, quaternion)) {
          this.system.channels.broadcast("wevr.movement.hands." + this.data, {
            position: position,
            quaternion: quaternion
          });
          this.position = position;
          this.quaternion = quaternion;
        }
        this.lastSent = time;
      }
    }
  }
});


AFRAME.registerComponent('maybe-cursor', {
  init() {
    if (!this.el.sceneEl.is('vr-mode')) {
      this.addCursor();
    } else {
      this.removeCursor();
    }
    this.el.sceneEl.addEventListener('enter-vr', () => this.removeCursor());
    this.el.sceneEl.addEventListener('exit-vr', () => this.addCursor());
  },

  removeCursor() {
    this.el.removeAttribute("cursor");
    this.el.setAttribute("visible", "false");
  },

  addCursor() {
    this.el.setAttribute("cursor", "");
    this.el.setAttribute("visible", "true");
  }
});


AFRAME.registerComponent('refresh-button', {

  types: {GAMEPAD: 'gamepad', OCULUS: 'oculus-touch', VIVE: 'vive'},

  tick: function () {
    if (!this.button) {
      var gamepad = this.getGamepad();
      if (gamepad) {
        this.button = gamepad.buttons[0].pressed;
        if (this.button) {
          setTimeout(() => {
            if (this.getGamepad().buttons[0].pressed) {
              location.reload();
            }
            this.button = undefined;
          }, 1000);
        }
      }
    }
  },

  checkControllerType: function () {
    var typeFound = this.types.GAMEPAD;
    var indexFound = 0;
    var gamepads = navigator.getGamepads && navigator.getGamepads();
    var i = 0;
    if (gamepads) {
      for (; i < gamepads.length; i++) {
        var gamepad = gamepads[i];
        if (gamepad) {
          if (gamepad.id.indexOf('Oculus Touch') === 0) {
            typeFound = this.types.OCULUS;
            indexFound = i;
            break;
          }
          if (gamepad.id.indexOf('OpenVR Gamepad') === 0) {
            typeFound = this.types.VIVE;
            indexFound = i;
            break;
          }
          indexFound = i;
        }
      }
      return {index: indexFound, type: typeFound};
    }
    return false;
  },

  getGamepad: function () {
    var type = this.checkControllerType();
    return type
      && navigator.getGamepads()[type.index];
  }
});
