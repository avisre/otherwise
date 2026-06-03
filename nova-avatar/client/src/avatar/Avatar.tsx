import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { VRM } from '@pixiv/three-vrm';
import { useStore, type ModelSource } from '../state/store';
import { loadVRMFromURL, loadVRMFromFile, frameUpperBody, disposeVRM } from './useVRM';
import { lipSync } from './useLipSync';
import { ExpressionController } from './expressions';
import { Blinker, IdleMotion } from './motion';

const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Avatar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      30,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.05,
      50,
    );
    camera.position.set(0, 1.35, 1.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 6;
    controls.enablePan = false;
    controls.update();

    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, 2, 1.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.7);
    rim.position.set(-1.5, 1.5, -2);
    scene.add(rim);

    const clock = new THREE.Clock();
    const blinker = new Blinker();
    const idle = new IdleMotion();
    const expression = new ExpressionController();

    let currentVrm: VRM | null = null;
    let rafId = 0;
    let disposed = false;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      controls.update();
      const vrm = currentVrm;
      if (vrm) {
        if (!reducedMotion) idle.update(dt, vrm);
        blinker.update(dt, vrm, !reducedMotion);
        expression.update(vrm, useStore.getState().emotion, dt);
        lipSync.update(dt);
        lipSync.applyTo(vrm, t);
        vrm.update(dt);
      }
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    let loadToken = 0;

    const handleSource = async (source: ModelSource | null) => {
      if (!source) return;
      const token = ++loadToken;
      useStore.getState().setModelStatus('loading');
      try {
        const vrm =
          source.kind === 'url'
            ? await loadVRMFromURL(source.url, camera)
            : await loadVRMFromFile(source.file, camera);
        if (disposed || token !== loadToken) {
          disposeVRM(vrm, scene); // a newer load superseded this one
          return;
        }
        if (currentVrm) disposeVRM(currentVrm, scene);
        currentVrm = vrm;
        scene.add(vrm.scene);
        expression.reset();
        frameUpperBody(vrm, camera, controls);
        const name =
          source.kind === 'url'
            ? (source.name ?? source.url.split('/').pop() ?? 'model')
            : source.file.name;
        useStore.getState().setModelName(name);
        useStore.getState().setModelStatus('ready');
      } catch (err) {
        if (token !== loadToken) return;
        console.error('VRM load failed', err);
        useStore
          .getState()
          .setModelStatus('error', err instanceof Error ? err.message : 'Failed to load model');
      }
    };

    const initial = useStore.getState().modelSource;
    if (initial) void handleSource(initial);
    const unsub = useStore.subscribe((state, prev) => {
      if (state.modelSource !== prev.modelSource) void handleSource(state.modelSource);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      unsub();
      ro.disconnect();
      if (currentVrm) disposeVRM(currentVrm, scene);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && /\.vrm$/i.test(file.name)) {
      useStore.getState().setModelSource({ kind: 'file', file });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`avatar-canvas${dragging ? ' avatar-canvas--drag' : ''}`}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
    >
      {dragging && <div className="avatar-canvas__drop">drop a .vrm to load</div>}
    </div>
  );
}
