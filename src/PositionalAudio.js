export default
class PositionalAudio {

  constructor() {
    this.panners = {};
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  updateListener(matrix) {
    var p = new THREE.Vector3();
    var vec = new THREE.Vector3(0, 0, 1);
    var up = new THREE.Vector3(0, -1, 0);

    this.updateListener = function (matrix) {
      vec.x = 0;
      vec.y = 0;
      vec.z = 1;
      up.x = 0;
      up.y = -1;
      up.z = 0;
      p.x = 0;
      p.y = 0;
      p.z = 0;
      p.setFromMatrixPosition(matrix);

      this.audioCtx.listener.setPosition(p.x, p.y, p.z);

      var mx = matrix.elements[12], my = matrix.elements[13], mz = matrix.elements[14];
      matrix.elements[12] = matrix.elements[13] = matrix.elements[14] = 0;

// Multiply the orientation vector by the world matrix of the camera.
      vec.applyMatrix4(matrix);
      vec.normalize();

// Multiply the up vector by the world matrix.
      up.applyMatrix4(matrix);
      up.normalize();

// Set the orientation and the up-vector for the listener.
      this.audioCtx.listener.setOrientation(vec.x, vec.y, vec.z, up.x, up.y, up.z);

      matrix.elements[12] = mx;
      matrix.elements[13] = my;
      matrix.elements[14] = mz;
    };
    this.updateListener(matrix);
  }

  usePositionalAudio(track, peer) {
    let source = this.audioCtx.createMediaStreamSource(track);
    let panner = this.audioCtx.createPanner();
    source.connect(panner);
    panner.connect(this.audioCtx.destination);
    this.panners[peer] = panner;
  }

  makeAudioPositionChanges(peer, position) {
    let positionalAudio = this.panners[peer];
    if (positionalAudio && position) {
      this.setPannerPosition(positionalAudio, position);
    }
  }

  setPannerPosition(panner, position) {
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
  }
}