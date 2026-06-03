import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

function makeLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  return loader;
}

function finalize(vrm: VRM, camera: THREE.Camera): VRM {
  // VRM0 models face away from the viewer; rotate so Nova faces the camera.
  VRMUtils.rotateVRM0(vrm);
  // Expressions and spring bones move vertices outside precomputed bounds.
  vrm.scene.traverse((obj) => {
    obj.frustumCulled = false;
  });
  // Gaze tracking: the eyes follow the camera.
  if (vrm.lookAt) vrm.lookAt.target = camera;
  return vrm;
}

export async function loadVRMFromURL(url: string, camera: THREE.Camera): Promise<VRM> {
  const gltf = await makeLoader().loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('Not a valid VRM file');
  return finalize(vrm, camera);
}

export async function loadVRMFromFile(file: File, camera: THREE.Camera): Promise<VRM> {
  const buffer = await file.arrayBuffer();
  const gltf = await makeLoader().parseAsync(buffer, '');
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('Not a valid VRM file');
  return finalize(vrm, camera);
}

interface FrameableControls {
  target: THREE.Vector3;
  update: () => void;
}

/** Position the camera/controls to frame the avatar's head + upper body. */
export function frameUpperBody(
  vrm: VRM,
  camera: THREE.PerspectiveCamera,
  controls: FrameableControls,
): void {
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const height = size.y || 1.5;

  const lookY = box.max.y - height * 0.18; // ~upper chest / chin
  controls.target.set(center.x, lookY, center.z);
  camera.position.set(center.x, box.max.y - height * 0.08, center.z + height * 0.9);
  camera.near = 0.05;
  camera.far = 50;
  camera.updateProjectionMatrix();
  controls.update();
}

export function disposeVRM(vrm: VRM, scene: THREE.Scene): void {
  scene.remove(vrm.scene);
  VRMUtils.deepDispose(vrm.scene);
}
