import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import { ArrowLeft } from 'lucide-react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { apiRequest, getSessionToken, supabase } from './backendApi.js';
import ordinaryModelUrl from '../ordinary.glb?url';
import beardedModelUrl from '../bearded.glb?url';
import sittingModelUrl from '../note.glb?url';
import tableModelUrl from '../table.glb?url';
import './Aurora.css';
import {
  CHAISE_POSE,
  CHAISE_POSE_REVISION,
  DESK_POSE,
  DESK_POSE_REVISION,
  getPoseForCase,
  SITTING_POSE_REVISION,
  STANDING_POSE_REVISION,
} from './casePoses.js';
const NEUTRAL_TRANSFORM = { x: 0, y: 0, z: 0, scale: 1 };

const DEFAULT_CHAISE_TRANSFORM = { ...CHAISE_POSE.chaiseTransform };

const DEFAULT_DESK_TRANSFORM = { ...DESK_POSE.deskTransform };

const DEFAULT_CHAISE_SHAPE = CHAISE_POSE.chaiseShape.map((point) => ({ ...point }));

const CAMERA_ZOOM_SLACK = 0.2;

const ORDINARY_MODEL_ROTATION = [-Math.PI / 2, 0, -Math.PI / 2];
const BEARDED_MODEL_ROTATION = ORDINARY_MODEL_ROTATION;
const TABLE_MODEL_ROTATION = [0, 0, 0];

const CAMERA_PRESETS = {
  chaise: {
    position: { x: 6, y: 1.4, z: 6.5 },
    target: { x: -0.1, y: 0.12, z: 0 },
    fov: 51,
    minPolarAngle: 10,
    maxPolarAngle: 170,
  },
  standing: {
    position: { x: 5, y: 1.8, z: 7.5 },
    target: { x: 0.1, y: 0.35, z: 0 },
    fov: 46,
    minPolarAngle: 10,
    maxPolarAngle: 170,
  },
  sitting: {
    position: { x: 5.2, y: 1.8, z: 7.3 },
    target: { x: 0, y: 0.32, z: 0.05 },
    fov: 47,
    minPolarAngle: 10,
    maxPolarAngle: 170,
  },
  desk: {
    position: { x: -6.1, y: 2.8, z: 8 },
    target: { x: -1.1, y: 0.04, z: 0.08 },
    fov: 47,
    minPolarAngle: 10,
    maxPolarAngle: 170,
  },
};

const AURORA_PRESETS = {
  chaise: {
    length: 5,
    position: { x: -0.2, y: 1.05, z: 4 },
    rotation: { x: 0, y: 26, z: 0 },
  },
  standing: {
    length: 6.25,
    position: { x: 0, y: 1.4, z: 0 },
    rotation: { x: 2, y: 1, z: -1 },
  },
  sitting: {
    length: 6.5,
    position: { x: 0.1, y: 1.2, z: 0 },
    rotation: { x: 1, y: -5, z: 0 },
  },
  desk: {
    length: 10,
    position: { x: 5, y: 0, z: -4 },
    rotation: { x: 0, y: -42, z: 0 },
  },
};

function getCameraOrbitDistance(settings) {
  const dx = settings.position.x - settings.target.x;
  const dy = settings.position.y - settings.target.y;
  const dz = settings.position.z - settings.target.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function withCameraZoomLimits(settings, slack = CAMERA_ZOOM_SLACK) {
  const distance = getCameraOrbitDistance(settings);
  return {
    ...settings,
    minDistance: distance - slack,
    maxDistance: distance + slack,
  };
}

const CASES = [
  {
    id: 'chaise',
    label: 'Лежанка',
    scene: 'chaise',
    modelUrl: ordinaryModelUrl,
    modelFileName: 'ordinary.glb',
    modelRotation: ORDINARY_MODEL_ROTATION,
  },
  {
    id: 'standing',
    label: 'Стоя',
    scene: 'standing',
    modelUrl: beardedModelUrl,
    modelFileName: 'bearded.glb',
    modelRotation: BEARDED_MODEL_ROTATION,
    restPoseAdjustments: {},
  },
  {
    id: 'sitting',
    label: 'Сидя',
    scene: 'sitting',
    modelUrl: sittingModelUrl,
    modelFileName: 'note.glb',
    modelRotation: TABLE_MODEL_ROTATION,
  },
  {
    id: 'desk',
    label: 'Рабочий стол',
    scene: 'desk',
    modelUrl: tableModelUrl,
    modelFileName: 'table.glb',
    modelRotation: TABLE_MODEL_ROTATION,
    centerOnObject: 'table_107',
    alignToFloorY: -1.16,
    hideProceduralDesk: true,
  },
];

const EMOTION_TONES = {
  chaise: {
    emotion: 'Спокойствие',
    tone: 'мягкий',
    veil: {
      colorStops: ['#5227ff', '#7cff67', '#46c9ff'],
      amplitude: 1.25,
      blend: 0.72,
      speed: 0.78,
    },
  },
  standing: {
    emotion: 'Уверенность',
    tone: 'ровный',
    veil: {
      colorStops: ['#384cff', '#7cff67', '#68d8ff'],
      amplitude: 1.2,
      blend: 0.72,
      speed: 0.82,
    },
  },
  sitting: {
    emotion: 'Внимание',
    tone: 'спокойный',
    veil: {
      colorStops: ['#3454d1', '#7cff67', '#46c9ff'],
      amplitude: 1.16,
      blend: 0.72,
      speed: 0.78,
    },
  },
  desk: {
    emotion: 'Фокус',
    tone: 'собранный',
    veil: {
      colorStops: ['#5227ff', '#7cff67', '#5227ff'],
      amplitude: 1.18,
      blend: 0.72,
      speed: 0.76,
    },
  },
};

const NEUTRAL_BONE_ROTATION = {
  x: 0,
  y: 0,
  z: 0,
};

function cloneBoneRotations(boneRotations = {}) {
  return Object.fromEntries(
    Object.entries(boneRotations).map(([boneName, rotation]) => [boneName, { ...rotation }]),
  );
}

function cloneChaiseShape(chaiseShape = DEFAULT_CHAISE_SHAPE) {
  return chaiseShape.map((point) => ({ ...point }));
}

function resolveActiveCase(caseId) {
  const baseCase = CASES.find((caseItem) => caseItem.id === caseId) || CASES[0];
  const poseConfig = getPoseForCase(baseCase.id);

  return {
    ...baseCase,
    poseConfig,
  };
}

function getRestPoseAdjustments(caseItem) {
  return caseItem.poseConfig.restPoseAdjustments ?? caseItem.restPoseAdjustments ?? {};
}

const BONE_LABELS = {
  Base: 'Основа тела',
  Waist: 'Таз',
  Stomach: 'Живот',
  Chest: 'Грудь',
  Neck: 'Шея',
  Head: 'Голова',
  Clavicle: 'Ключица',
  Shoulder: 'Плечо',
  Forearm: 'Предплечье',
  palm: 'Кисть',
  Hip: 'Бедро',
  Thigh: 'Верх ноги',
  Calf: 'Голень',
  Foot: 'Стопа',
  Toes: 'Пальцы ноги',
  Middle1: 'Средний палец 1',
  Middle2: 'Средний палец 2',
  Middle3: 'Средний палец 3',
  Ring1: 'Безымянный палец 1',
  Ring2: 'Безымянный палец 2',
  Ring3: 'Безымянный палец 3',
  Pinky1: 'Мизинец 1',
  Pinky2: 'Мизинец 2',
  Pinky3: 'Мизинец 3',
  Forefinger1: 'Указательный палец 1',
  Forefinger2: 'Указательный палец 2',
  Forefinger3: 'Указательный палец 3',
  Thumb1: 'Большой палец 1',
  Thumb2: 'Большой палец 2',
  Thumb3: 'Большой палец 3',
  Brow1: 'Бровь 1',
  Brow2: 'Бровь 2',
  Eye: 'Глаз',
  Mouth_up: 'Верх рта',
  Mouth_bottom: 'Низ рта',
  Lip_up: 'Верхняя губа',
  Lip_bottom: 'Нижняя губа',
  Teeth_Up: 'Верхние зубы',
  Teeth_bottom: 'Нижние зубы',
  Teeth_ctrl: 'Управление зубами',
  IK_wrist_ctrl: 'IK кисть',
  IK_elbow_ctrl: 'IK локоть',
  IK_foot_ctrl: 'IK стопа',
  IK_knee_ctrl: 'IK колено',
  mixamorigHips: 'Таз',
  mixamorigSpine: 'Позвоночник',
  mixamorigSpine1: 'Позвоночник 1',
  mixamorigSpine2: 'Позвоночник 2',
  mixamorigNeck: 'Шея',
  mixamorigHead: 'Голова',
  mixamorigHeadTop_End: 'Макушка',
  mixamorigLeftShoulder: 'Плечо, левая',
  mixamorigLeftArm: 'Рука, левая',
  mixamorigLeftForeArm: 'Предплечье, левая',
  mixamorigLeftHand: 'Кисть, левая',
  mixamorigRightShoulder: 'Плечо, правая',
  mixamorigRightArm: 'Рука, правая',
  mixamorigRightForeArm: 'Предплечье, правая',
  mixamorigRightHand: 'Кисть, правая',
  mixamorigLeftUpLeg: 'Бедро, левая',
  mixamorigLeftLeg: 'Голень, левая',
  mixamorigLeftFoot: 'Стопа, левая',
  mixamorigLeftToeBase: 'Пальцы стопы, левая',
  mixamorigLeftToe_End: 'Конец пальцев стопы, левая',
  mixamorigRightUpLeg: 'Бедро, правая',
  mixamorigRightLeg: 'Голень, правая',
  mixamorigRightFoot: 'Стопа, правая',
  mixamorigRightToeBase: 'Пальцы стопы, правая',
  mixamorigRightToe_End: 'Конец пальцев стопы, правая',
};

const SIDE_LABELS = {
  L: 'левая',
  R: 'правая',
};

function sanitizeChaiseShape(chaiseShape = DEFAULT_CHAISE_SHAPE) {
  const pointsById = new Map((Array.isArray(chaiseShape) ? chaiseShape : []).map((point) => [point.id, point]));

  return DEFAULT_CHAISE_SHAPE.map((fallbackPoint) => {
    const point = pointsById.get(fallbackPoint.id);
    const x = Number(point?.x);
    const y = Number(point?.y);

    return {
      ...fallbackPoint,
      label: point?.label || fallbackPoint.label,
      x: Number.isFinite(x) ? x : fallbackPoint.x,
      y: Number.isFinite(y) ? y : fallbackPoint.y,
    };
  });
}

function getChaisePoint(chaiseShape, id) {
  return chaiseShape.find((point) => point.id === id) || DEFAULT_CHAISE_SHAPE.find((point) => point.id === id);
}

function createChaiseGeometry(chaiseShape = DEFAULT_CHAISE_SHAPE) {
  const normalizedShape = sanitizeChaiseShape(chaiseShape);
  const point = (id) => getChaisePoint(normalizedShape, id);
  const contour = [
    point('base-bottom'),
    point('front-lip'),
    point('front-bottom'),
    point('leg-rest-hump'),
    point('seat-rise'),
    point('seat-valley'),
    point('shoulder-scoop'),
    point('head-hump'),
    point('back-top'),
    point('back-bottom'),
  ];
  const shape = new THREE.Shape();

  shape.moveTo(contour[0].x, contour[0].y);
  shape.lineTo(contour[1].x, contour[1].y);
  shape.splineThru(contour.slice(2).map((shapePoint) => new THREE.Vector2(shapePoint.x, shapePoint.y)));
  shape.lineTo(contour[0].x, contour[0].y);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 2.32,
    bevelEnabled: true,
    bevelSize: 0.08,
    bevelThickness: 0.08,
    bevelSegments: 1,
    curveSegments: 8,
    steps: 1,
  });

  geometry.center();
  geometry.computeVertexNormals();

  return geometry;
}

function formatBoneName(name, index) {
  if (!name) {
    return `Кость ${index + 1}`;
  }

  const mixamoMatch = name.match(/^(mixamorig[A-Za-z]+)_\d+$/);
  const match = name.match(/^(.+?)(?:[._]?([LR]))?_\d+$/);
  const rawBoneName = mixamoMatch?.[1] || match?.[1] || name;
  const side = match?.[2];
  const translatedName = BONE_LABELS[rawBoneName] || rawBoneName.replaceAll('_', ' ');
  const sideLabel = SIDE_LABELS[side];

  return sideLabel ? `${translatedName}, ${sideLabel}` : translatedName;
}

function normalizeRotation(rotation) {
  return {
    x: Number(rotation?.x) || 0,
    y: Number(rotation?.y) || 0,
    z: Number(rotation?.z) || 0,
  };
}

function sanitizeTransform(transform, fallback, keys) {
  return Object.fromEntries(
    keys.map((key) => {
      const value = Number(transform?.[key]);
      return [key, Number.isFinite(value) ? value : fallback[key]];
    }),
  );
}

function cloneCameraSettings(settings) {
  return {
    position: { ...settings.position },
    target: { ...settings.target },
    fov: settings.fov,
    minDistance: settings.minDistance,
    maxDistance: settings.maxDistance,
    minPolarAngle: settings.minPolarAngle,
    maxPolarAngle: settings.maxPolarAngle,
  };
}

function getCameraPreset(caseId) {
  return withCameraZoomLimits(cloneCameraSettings(CAMERA_PRESETS[caseId] || CAMERA_PRESETS.chaise));
}

function cloneAuroraSettings(settings = AURORA_PRESETS.chaise) {
  return {
    length: Number(settings.length) || AURORA_PRESETS.chaise.length,
    position: { ...AURORA_PRESETS.chaise.position, ...(settings.position || {}) },
    rotation: { ...AURORA_PRESETS.chaise.rotation, ...(settings.rotation || {}) },
  };
}

function getAuroraPreset(caseId) {
  return cloneAuroraSettings(AURORA_PRESETS[caseId] || AURORA_PRESETS.chaise);
}

function createPoseFromConfig(pose, currentBones, fallbackPose) {
  const validBoneNames = new Set(currentBones.map((bone) => bone.name));
  const fallbackModelTransform = fallbackPose.modelTransform || NEUTRAL_TRANSFORM;
  const modelTransform = sanitizeTransform(pose.modelTransform, fallbackModelTransform, ['x', 'y', 'z', 'scale']);
  const chaiseTransform = sanitizeTransform(pose.chaiseTransform, fallbackPose.chaiseTransform || DEFAULT_CHAISE_TRANSFORM, [
    'x',
    'y',
    'z',
    'length',
    'height',
    'depth',
    'rotationY',
  ]);
  const chaiseShape = sanitizeChaiseShape(pose.chaiseShape || fallbackPose.chaiseShape || DEFAULT_CHAISE_SHAPE);
  const boneRotations = Object.fromEntries(
    Object.entries(pose.boneRotations || {})
      .filter(([boneName]) => !validBoneNames.size || validBoneNames.has(boneName))
      .map(([boneName, rotation]) => [boneName, normalizeRotation(rotation)]),
  );

  const deskTransform = sanitizeTransform(pose.deskTransform, fallbackPose.deskTransform || DEFAULT_DESK_TRANSFORM, [
    'x',
    'y',
    'z',
    'width',
    'height',
    'depth',
    'rotationY',
  ]);

  return {
    modelTransform,
    chaiseTransform,
    chaiseShape,
    deskTransform,
    boneRotations,
  };
}

function WorkDesk({ deskTransform }) {
  return (
    <group
      position={[deskTransform.x, deskTransform.y - 0.08, deskTransform.z]}
      rotation={[0, THREE.MathUtils.degToRad(deskTransform.rotationY), 0]}
      scale={[deskTransform.width, deskTransform.height, deskTransform.depth]}
    >
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.35, 0.09, 1.18]} />
        <meshStandardMaterial color="#8b735f" roughness={0.72} metalness={0.03} />
      </mesh>
      {[
        [-0.98, 0.18, -0.48],
        [0.98, 0.18, -0.48],
        [-0.98, 0.18, 0.48],
        [0.98, 0.18, 0.48],
      ].map((position, index) => (
        <mesh key={index} position={position} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.72, 0.08]} />
          <meshStandardMaterial color="#665446" roughness={0.86} />
        </mesh>
      ))}

      {[
        { position: [0, -0.18, 1.08], rotationY: Math.PI },
        { position: [0, -0.18, -1.08], rotationY: 0 },
      ].map((chair) => (
        <OfficeChair key={chair.rotationY} position={chair.position} rotationY={chair.rotationY} />
      ))}

      <Notebook position={[-0.28, 0.44, 0.12]} rotationY={-0.18} />
      <Cactus position={[0.12, 0.46, -0.24]} />
      <SideMonitor position={[0.72, 0.47, -0.34]} rotationY={-0.22} />
    </group>
  );
}

function OfficeChair({ position, rotationY }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.11, 0.5]} />
        <meshStandardMaterial color="#4b5862" roughness={0.76} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.57, 0.21]} rotation={[THREE.MathUtils.degToRad(-9), 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.58, 0.09]} />
        <meshStandardMaterial color="#40505c" roughness={0.8} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.73, 0.23]} rotation={[THREE.MathUtils.degToRad(-9), 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.13, 0.08]} />
        <meshStandardMaterial color="#36434c" roughness={0.78} metalness={0.05} />
      </mesh>
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} position={[x, 0.34, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.1, 0.45]} />
          <meshStandardMaterial color="#5b6670" roughness={0.72} />
        </mesh>
      ))}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 0.43, 0.03]} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.22, 0.07]} />
          <meshStandardMaterial color="#5b6670" roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.5, 18]} />
        <meshStandardMaterial color="#646b70" roughness={0.42} metalness={0.35} />
      </mesh>
      <mesh position={[0, -0.23, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.045, 28]} />
        <meshStandardMaterial color="#5d6368" roughness={0.48} metalness={0.25} />
      </mesh>
      {[
        [0.26, -0.24, 0.18],
        [-0.26, -0.24, 0.18],
        [0.26, -0.24, -0.18],
        [-0.26, -0.24, -0.18],
      ].map((wheelPosition, index) => (
        <mesh key={index} position={wheelPosition} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.04, 14]} />
          <meshStandardMaterial color="#33393d" roughness={0.56} metalness={0.18} />
        </mesh>
      ))}
    </group>
  );
}

function Notebook({ position, rotationY }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.025, 0.31]} />
        <meshStandardMaterial color="#f4efe5" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.38, 0.25]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {[-0.08, 0, 0.08].map((z) => (
        <mesh key={z} position={[0.02, 0.031, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.31, 0.006]} />
          <meshStandardMaterial color="#83a2ad" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[-0.03, 0.034, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.01, 0.25]} />
        <meshStandardMaterial color="#d86b5f" roughness={0.72} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Cactus({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.105, 0.12, 18]} />
        <meshStandardMaterial color="#b76545" roughness={0.84} />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.22, 16]} />
        <meshStandardMaterial color="#2f7d55" roughness={0.88} />
      </mesh>
      <mesh position={[-0.055, 0.17, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(-38)]} castShadow receiveShadow>
        <cylinderGeometry args={[0.022, 0.028, 0.14, 12]} />
        <meshStandardMaterial color="#368a61" roughness={0.9} />
      </mesh>
      <mesh position={[0.055, 0.2, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(42)]} castShadow receiveShadow>
        <cylinderGeometry args={[0.02, 0.026, 0.12, 12]} />
        <meshStandardMaterial color="#368a61" roughness={0.9} />
      </mesh>
    </group>
  );
}

function SideMonitor({ position, rotationY }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.29, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.54, 0.34, 0.035]} />
        <meshStandardMaterial color="#1d2529" roughness={0.55} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.29, 0.021]}>
        <boxGeometry args={[0.47, 0.27, 0.012]} />
        <meshStandardMaterial color="#263f4b" emissive="#1f5464" emissiveIntensity={0.34} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.055, 0.18, 0.045]} />
        <meshStandardMaterial color="#3b4145" roughness={0.48} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.005, 0.015]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.025, 0.18]} />
        <meshStandardMaterial color="#3b4145" roughness={0.52} metalness={0.22} />
      </mesh>
    </group>
  );
}

function StoneChaise({
  activeCase,
  modelTransform,
  chaiseTransform,
  chaiseShape,
  deskTransform,
  boneRotations,
  resetToken,
  onBonesReady,
}) {
  const geometry = useMemo(() => createChaiseGeometry(chaiseShape), [chaiseShape]);
  const lineGeometry = useMemo(() => new THREE.EdgesGeometry(geometry, 22), [geometry]);
  const sceneFrame =
    activeCase.scene === 'chaise'
      ? { rotation: [0, -0.45, 0], position: [0, 0.12, 0] }
      : activeCase.scene === 'standing'
        ? { rotation: [0, 0, 0], position: [0, -0.18, 0] }
        : { rotation: [0, -0.2, 0], position: [0, 0.02, 0.15] };

  return (
    <group rotation={sceneFrame.rotation} position={sceneFrame.position}>
      {activeCase.scene === 'chaise' ? (
        <group
          position={[chaiseTransform.x, chaiseTransform.y, chaiseTransform.z]}
          rotation={[0, THREE.MathUtils.degToRad(chaiseTransform.rotationY), 0]}
          scale={[chaiseTransform.length, chaiseTransform.height, chaiseTransform.depth]}
        >
          <mesh geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial color="#7d7b75" roughness={0.82} metalness={0.02} flatShading />
          </mesh>
          <lineSegments geometry={lineGeometry}>
            <lineBasicMaterial color="#56534e" transparent opacity={0.46} />
          </lineSegments>
        </group>
      ) : null}
      {activeCase.scene === 'desk' && !activeCase.hideProceduralDesk ? (
        <WorkDesk deskTransform={deskTransform} />
      ) : null}
      <Suspense fallback={null}>
        <RigModel
          key={activeCase.id}
          modelUrl={activeCase.modelUrl}
          modelRotation={activeCase.modelRotation}
          preserveModelOrigin={activeCase.preserveModelOrigin}
          centerOnObject={activeCase.centerOnObject}
          alignToFloorY={activeCase.alignToFloorY}
          restPoseAdjustments={getRestPoseAdjustments(activeCase)}
          modelTransform={modelTransform}
          boneRotations={boneRotations}
          resetToken={resetToken}
          onBonesReady={onBonesReady}
        />
      </Suspense>
    </group>
  );
}

function prepareLoadedScene(scene, { preserveModelOrigin, centerOnObject, alignToFloorY, modelRotation = [0, 0, 0] }) {
  const copiedScene = clone(scene);

  if (centerOnObject) {
    const anchor = copiedScene.getObjectByName(centerOnObject);
    if (anchor) {
      const anchorBox = new THREE.Box3().setFromObject(anchor);
      const anchorCenter = anchorBox.getCenter(new THREE.Vector3());
      copiedScene.position.sub(anchorCenter);
    }
  } else if (!preserveModelOrigin) {
    const box = new THREE.Box3().setFromObject(copiedScene);
    const center = box.getCenter(new THREE.Vector3());
    copiedScene.position.sub(center);
  }

  if (Number.isFinite(alignToFloorY)) {
    const layoutGroup = new THREE.Group();
    layoutGroup.rotation.set(modelRotation[0], modelRotation[1], modelRotation[2]);
    layoutGroup.add(copiedScene);
    layoutGroup.updateMatrixWorld(true);
    const sceneBox = new THREE.Box3().setFromObject(layoutGroup);
    const deltaY = alignToFloorY - sceneBox.min.y;
    const offset = new THREE.Vector3(0, deltaY, 0).applyQuaternion(layoutGroup.quaternion.clone().invert());
    copiedScene.position.add(offset);
  }

  copiedScene.traverse((object) => {
    if (!object.isMesh) {
      return;
    }

    object.castShadow = true;
    object.receiveShadow = true;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) {
        return;
      }

      if (material.map && !material.map.image) {
        material.map = null;
      }

      material.needsUpdate = true;
    });
  });

  return copiedScene;
}

function RigModel({
  modelUrl,
  modelRotation,
  preserveModelOrigin = false,
  centerOnObject,
  alignToFloorY,
  restPoseAdjustments,
  modelTransform,
  boneRotations,
  resetToken,
  onBonesReady,
}) {
  const { scene } = useGLTF(modelUrl);
  const initialBoneRotationsRef = useRef(new Map());
  const baselineModelRef = useRef(null);

  const model = useMemo(
    () =>
      prepareLoadedScene(scene, {
        preserveModelOrigin,
        centerOnObject,
        alignToFloorY,
        modelRotation,
      }),
    [alignToFloorY, centerOnObject, modelRotation, preserveModelOrigin, scene],
  );

  useEffect(() => {
    const bones = [];

    model.traverse((object) => {
      if (!object.isBone) {
        return;
      }

      bones.push(object);
    });

    // Strict Mode в dev повторно вызывает эффекты: не перезаписываем базу уже повёрнутых костей.
    if (baselineModelRef.current !== model) {
      baselineModelRef.current = model;
      const initialRotations = new Map();

      model.traverse((object) => {
        if (!object.isBone) {
          return;
        }

        initialRotations.set(object.name, object.rotation.clone());
      });

      initialBoneRotationsRef.current = initialRotations;
    }

    onBonesReady(
      bones.map((bone, index) => ({
        name: bone.name,
        label: formatBoneName(bone.name, index),
      })),
    );
  }, [model, onBonesReady]);

  useEffect(() => {
    const baseRotations = initialBoneRotationsRef.current;

    model.traverse((object) => {
      if (!object.isBone) {
        return;
      }

      const baseRotation = baseRotations.get(object.name);
      if (!baseRotation) {
        return;
      }

      object.rotation.copy(baseRotation);

      const restAdjustment = restPoseAdjustments[object.name];
      if (restAdjustment) {
        object.rotation.x += THREE.MathUtils.degToRad(restAdjustment.x);
        object.rotation.y += THREE.MathUtils.degToRad(restAdjustment.y);
        object.rotation.z += THREE.MathUtils.degToRad(restAdjustment.z);
      }

      const userRotation = boneRotations[object.name];
      if (userRotation) {
        object.rotation.x += THREE.MathUtils.degToRad(userRotation.x);
        object.rotation.y += THREE.MathUtils.degToRad(userRotation.y);
        object.rotation.z += THREE.MathUtils.degToRad(userRotation.z);
      }
    });
  }, [boneRotations, model, resetToken, restPoseAdjustments]);

  return (
    <group
      position={[modelTransform.x, modelTransform.y, modelTransform.z]}
      rotation={modelRotation}
      scale={modelTransform.scale}
    >
      <primitive object={model} />
    </group>
  );
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#d7d2c8" roughness={0.9} transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function SceneCameraControls({ settings }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);

  useEffect(() => {
    camera.position.set(settings.position.x, settings.position.y, settings.position.z);
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(settings.target.x, settings.target.y, settings.target.z);
      controlsRef.current.update();
    }
  }, [camera, settings]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      zoomSpeed={0.35}
      minDistance={settings.minDistance}
      maxDistance={settings.maxDistance}
      minPolarAngle={THREE.MathUtils.degToRad(Math.min(settings.minPolarAngle, settings.maxPolarAngle))}
      maxPolarAngle={THREE.MathUtils.degToRad(Math.max(settings.maxPolarAngle, settings.minPolarAngle))}
    />
  );
}

function WorldAuroraLines({
  colorStops = ['#5227ff', '#7cff67', '#46c9ff'],
  length = 1,
  position = AURORA_PRESETS.chaise.position,
  rotation = AURORA_PRESETS.chaise.rotation,
}) {
  const curves = useMemo(
    () => [
      {
        color: colorStops[0],
        radius: 0.026,
        glowRadius: 0.09,
        opacity: 0.82,
        points: [
          [-8.2, 1.15, -5.2],
          [-6.2, 2.45, -5.6],
          [-3.8, 1.72, -4.85],
          [-1.0, 2.85, -5.45],
          [1.9, 1.96, -4.95],
          [4.7, 2.65, -5.65],
          [8.1, 1.7, -5.2],
        ],
      },
      {
        color: colorStops[1],
        radius: 0.022,
        glowRadius: 0.072,
        opacity: 0.92,
        points: [
          [-8.4, 0.74, -4.7],
          [-6.1, 1.62, -5.1],
          [-3.1, 1.16, -4.55],
          [-0.6, 2.08, -5.05],
          [2.2, 1.42, -4.62],
          [5.2, 2.12, -5.14],
          [8.4, 1.22, -4.72],
        ],
      },
      {
        color: colorStops[2],
        radius: 0.015,
        glowRadius: 0.052,
        opacity: 0.72,
        points: [
          [-7.7, 0.26, -4.35],
          [-5.4, 0.92, -4.78],
          [-2.6, 0.56, -4.24],
          [0.3, 1.18, -4.8],
          [3.3, 0.7, -4.3],
          [5.8, 1.12, -4.72],
          [7.8, 0.54, -4.36],
        ],
      },
      {
        color: colorStops[1],
        radius: 0.012,
        glowRadius: 0.04,
        opacity: 0.54,
        points: [
          [-8.0, -0.18, -4.9],
          [-5.8, 0.36, -5.2],
          [-3.0, 0.06, -4.7],
          [-0.2, 0.58, -5.12],
          [2.8, 0.22, -4.76],
          [5.9, 0.64, -5.18],
          [8.0, 0.18, -4.88],
        ],
      },
    ],
    [colorStops],
  );

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[
        THREE.MathUtils.degToRad(rotation.x),
        THREE.MathUtils.degToRad(rotation.y),
        THREE.MathUtils.degToRad(rotation.z),
      ]}
      scale={[length, 1, 1]}
      renderOrder={-1}
    >
      {curves.map((curveItem, index) => {
        const curve = new THREE.CatmullRomCurve3(curveItem.points.map((point) => new THREE.Vector3(...point)));

        return (
          <group key={`${curveItem.color}-${index}`}>
            <mesh>
              <tubeGeometry args={[curve, 160, curveItem.glowRadius, 16, false]} />
              <meshBasicMaterial
                color={curveItem.color}
                transparent
                opacity={curveItem.opacity * 0.18}
                depthWrite={false}
                depthTest
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
            <mesh>
              <tubeGeometry args={[curve, 160, curveItem.radius, 14, false]} />
              <meshBasicMaterial
                color={curveItem.color}
                transparent
                opacity={curveItem.opacity}
                depthWrite={false}
                depthTest
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

CASES.forEach((caseItem) => {
  useGLTF.preload(caseItem.modelUrl);
});

function applyPoseState(caseItem, loadedBones, setters) {
  const poseConfig = getPoseForCase(caseItem.id);
  const nextPose = createPoseFromConfig(poseConfig, loadedBones, poseConfig);

  setters.setModelTransform(nextPose.modelTransform);
  setters.setChaiseTransform(nextPose.chaiseTransform);
  setters.setChaiseShape(cloneChaiseShape(nextPose.chaiseShape));
  setters.setDeskTransform(nextPose.deskTransform);
  setters.setBoneRotations(cloneBoneRotations(nextPose.boneRotations));
  setters.setResetToken((currentToken) => currentToken + 1);
}

function SimulationScene({ onBackToDashboard }) {
  const [activeCaseId, setActiveCaseId] = useState('desk');
  const [bones, setBones] = useState([]);
  const [modelTransform, setModelTransform] = useState(() => ({ ...CHAISE_POSE.modelTransform }));
  const [chaiseTransform, setChaiseTransform] = useState(() => ({ ...CHAISE_POSE.chaiseTransform }));
  const [chaiseShape, setChaiseShape] = useState(() => sanitizeChaiseShape(CHAISE_POSE.chaiseShape));
  const [deskTransform, setDeskTransform] = useState(() => ({ ...DEFAULT_DESK_TRANSFORM }));
  const [boneRotations, setBoneRotations] = useState(() => cloneBoneRotations(CHAISE_POSE.boneRotations));
  const [resetToken, setResetToken] = useState(0);
  const pendingCaseRef = useRef(null);
  const activeCase = useMemo(
    () => resolveActiveCase(activeCaseId),
    [activeCaseId, CHAISE_POSE_REVISION, STANDING_POSE_REVISION, SITTING_POSE_REVISION, DESK_POSE_REVISION],
  );
  const activeCameraSettings = useMemo(() => getCameraPreset(activeCase.id), [activeCase.id]);
  const activeAuroraSettings = useMemo(() => getAuroraPreset(activeCase.id), [activeCase.id]);

  const poseSetters = useMemo(
    () => ({
      setModelTransform,
      setChaiseTransform,
      setChaiseShape,
      setDeskTransform,
      setBoneRotations,
      setResetToken,
    }),
    [],
  );

  const handleBonesReady = useCallback(
    (loadedBones) => {
      setBones(loadedBones);

      if (!loadedBones.length) {
        return;
      }

      const caseId = pendingCaseRef.current?.id || activeCaseId;
      pendingCaseRef.current = null;
      applyPoseState(resolveActiveCase(caseId), loadedBones, poseSetters);
    },
    [activeCaseId, poseSetters],
  );

  useEffect(() => {
    if (!bones.length) {
      return;
    }

    applyPoseState(activeCase, bones, poseSetters);
  }, [activeCase, bones, poseSetters, CHAISE_POSE_REVISION, STANDING_POSE_REVISION, SITTING_POSE_REVISION, DESK_POSE_REVISION]);

  const switchCase = useCallback(
    (caseId) => {
      const nextCase = CASES.find((caseItem) => caseItem.id === caseId);
      if (!nextCase || nextCase.id === activeCaseId) {
        return;
      }

      setActiveCaseId(nextCase.id);
      setBones([]);
      pendingCaseRef.current = nextCase;
      setResetToken((currentToken) => currentToken + 1);
    },
    [activeCaseId],
  );

  const emotionTone = EMOTION_TONES[activeCase.scene] || EMOTION_TONES.chaise;

  return (
    <main className={`app app--${activeCase.scene}`}>
      <div className="veil-background" aria-hidden="true" />
      <div className="toolbar">
        <div className="case-tabs" role="tablist" aria-label="Сцены">
          {CASES.map((caseItem) => (
            <button
              key={caseItem.id}
              type="button"
              role="tab"
              aria-selected={caseItem.id === activeCaseId}
              className={caseItem.id === activeCaseId ? 'is-active' : ''}
              onClick={() => switchCase(caseItem.id)}
            >
              {caseItem.label}
            </button>
          ))}
        </div>
        {onBackToDashboard && (
          <button
            type="button"
            className="btn-plush sm"
            style={{ background: 'var(--rose)', marginLeft: 'auto' }}
            onClick={onBackToDashboard}
          >
            <ArrowLeft size={16} /> Назад в кабинет
          </button>
        )}
      </div>

      <Canvas
        className="scene-canvas"
        camera={{
          position: [
            activeCameraSettings.position.x,
            activeCameraSettings.position.y,
            activeCameraSettings.position.z,
          ],
          fov: activeCameraSettings.fov,
        }}
        shadows
        dpr={[1, 2]}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[3.5, 4.5, 2.5]} intensity={3.1} castShadow shadow-mapSize={[1024, 1024]} />
        <spotLight position={[-3.5, 3.8, 3.5]} angle={0.55} penumbra={0.8} intensity={1.2} />
        <WorldAuroraLines
          colorStops={emotionTone.veil.colorStops}
          length={activeAuroraSettings.length}
          position={activeAuroraSettings.position}
          rotation={activeAuroraSettings.rotation}
        />
        <Room />
        <StoneChaise
          activeCase={activeCase}
          modelTransform={modelTransform}
          chaiseTransform={chaiseTransform}
          chaiseShape={chaiseShape}
          deskTransform={deskTransform}
          boneRotations={boneRotations}
          resetToken={resetToken}
          onBonesReady={handleBonesReady}
        />
        <ContactShadows position={[0, -1.16, 0]} opacity={0.34} blur={2.8} scale={7} far={3} />
        <Environment preset="apartment" />
        <SceneCameraControls settings={activeCameraSettings} />
      </Canvas>
    </main>
  );
}

const TRANSLATIONS = {
  ru: {
    signInTitle: "С возвращением!",
    signInSub: "Войдите, чтобы продолжить тренировки",
    emailLabel: "Email",
    passwordLabel: "Пароль",
    signInBtn: "Войти в систему",
    noAccount: "Еще нет аккаунта?",
    signUpLink: "Зарегистрироваться",
    signUpTitle: "Регистрация",
    signUpSub: "Создайте аккаунт и начните тренироваться",
    nameLabel: "Ваше имя",
    namePlaceholder: "Иван Иванов",
    roleLabel: "Тип аккаунта",
    roleSolo: "Индивидуальные тренировки (Solo)",
    roleAdmin: "Координатор обучения компании (Admin)",
    roleEmployee: "Сотрудник по приглашению (Employee)",
    orgLabel: "Название организации",
    orgPlaceholder: "ООО Рога и Копыта",
    roomKeyLabel: "Ключ комнаты",
    roomKeyPlaceholder: "Например: TEAM-7K2M",
    signUpBtn: "Создать аккаунт",
    hasAccount: "Уже зарегистрированы?",
    signInLink: "Войти",
    errorFields: "Пожалуйста, заполните все поля",
    errorRequired: "Пожалуйста, заполните обязательные поля",
    errorOrg: "Пожалуйста, укажите название вашей организации",
    errorRoom: "Пожалуйста, введите ключ комнаты из приглашения",
    successLogin: "Вход выполнен успешно для:",
    successRegister: "Регистрация успешна для:"
  },
  uz: {
    signInTitle: "Xush kelibsiz!",
    signInSub: "Mashg'ulotlarni davom ettirish uchun kiring",
    emailLabel: "Email",
    passwordLabel: "Parol",
    signInBtn: "Tizimga kirish",
    noAccount: "Hali hisobingiz yo'qmi?",
    signUpLink: "Ro'yxatdan o'tish",
    signUpTitle: "Ro'yxatdan o'tish",
    signUpSub: "Hisob yarating va mashg'ulotlarni boshlang",
    nameLabel: "Ismingiz",
    namePlaceholder: "Ism Familiya",
    roleLabel: "Hisob turi",
    roleSolo: "Yakka tartibdagi mashg'ulotlar (Solo)",
    roleAdmin: "Kompaniya o'quv koordinatori (Admin)",
    roleEmployee: "Taklif qilingan xodim (Employee)",
    orgLabel: "Tashkilot nomi",
    orgPlaceholder: "MChJ Roga i Kopyta",
    roomKeyLabel: "Xona kaliti",
    roomKeyPlaceholder: "Masalan: TEAM-7K2M",
    signUpBtn: "Hisob yaratish",
    hasAccount: "Ro'yxatdan o'tganmisiz?",
    signInLink: "Kirish",
    errorFields: "Iltimos, barcha maydonlarni to'ldiring",
    errorRequired: "Iltimos, majburiy maydonlarni to'ldiring",
    errorOrg: "Iltimos, tashkilotingiz nomini ko'rsating",
    errorRoom: "Iltimos, taklifnomadagi xona kalitini kiriting",
    successLogin: "Tizimga muvaffaqiyatli kirildi:",
    successRegister: "Muvaffaqiyatli ro'yxatdan o'tildi:"
  },
  en: {
    signInTitle: "Welcome back!",
    signInSub: "Sign in to continue training",
    emailLabel: "Email",
    passwordLabel: "Password",
    signInBtn: "Sign In",
    noAccount: "Don't have an account?",
    signUpLink: "Sign up",
    signUpTitle: "Register",
    signUpSub: "Create an account and start training",
    nameLabel: "Your Name",
    namePlaceholder: "John Doe",
    roleLabel: "Account Type",
    roleSolo: "Individual Training (Solo)",
    roleAdmin: "Company Training Coordinator (Admin)",
    roleEmployee: "Invited Employee (Employee)",
    orgLabel: "Organization Name",
    orgPlaceholder: "Acme Corp",
    roomKeyLabel: "Room Key",
    roomKeyPlaceholder: "Example: TEAM-7K2M",
    signUpBtn: "Create Account",
    hasAccount: "Already registered?",
    signInLink: "Sign In",
    errorFields: "Please fill in all fields",
    errorRequired: "Please fill in required fields",
    errorOrg: "Please specify your organization name",
    errorRoom: "Please enter your invitation room key",
    successLogin: "Signed in successfully for:",
    successRegister: "Registration successful for:"
  }
};

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ru');

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem('app_lang', l);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(TRANSLATIONS[lang].errorFields);
      return;
    }

    setIsSubmitting(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="auth-wrapper dots-bg">
      {/* Sign In Background Flying Pastel Doodles */}
      <div className="bg-doodles">
        {/* Star */}
        <svg className="doodle doodle-sm doodle-1" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="var(--butter)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        {/* Cloud */}
        <svg className="doodle doodle-lg doodle-2" viewBox="0 0 24 24">
          <path d="M19.36 10.04a6 6 0 00-11.33-1.8 5 5 0 00-6 4.96c0 2.76 2.24 5 5 5h12c2.76 0 5-2.24 5-5a5 5 0 00-4.67-4.96z" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        {/* Heart */}
        <svg className="doodle doodle-md doodle-3" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="var(--rose)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        {/* Coin / Money */}
        <svg className="doodle doodle-sm doodle-4" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="2"/>
          <circle cx="12" cy="12" r="5" fill="var(--butter)" stroke="var(--line)" strokeWidth="1.5"/>
        </svg>
        {/* Key */}
        <svg className="doodle doodle-lg doodle-5" viewBox="0 0 24 24">
          <path d="M21 2l-2 2m-1.5-1.5L16 4m-4 4l3-3m-6.5 6.5A4.5 4.5 0 106 18a4.5 4.5 0 005.5-3.5L15 11h2v2h2v-2h3V8h-9.5z" fill="var(--butter)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {/* Book */}
        <svg className="doodle doodle-md doodle-6" viewBox="0 0 24 24">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20v2.5a2.5 2.5 0 01-2.5 2.5H6.5A2.5 2.5 0 014 19.5z" fill="var(--rose)" stroke="var(--line)" strokeWidth="2" />
          <path d="M6.5 2H20v15H6.5A2.5 2.5 0 014 14.5V4A2.5 2.5 0 016.5 2z" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" />
        </svg>
        {/* Lightbulb */}
        <svg className="doodle doodle-sm doodle-7" viewBox="0 0 24 24">
          <path d="M9 21h6m-5.25-3h4.5M12 3a7 7 0 00-6.9 8.2c.5 2.5 2 4.6 3.9 5.8h6c1.9-1.2 3.4-3.3 3.9-5.8A7 7 0 0012 3z" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Smile */}
        <svg className="doodle doodle-lg doodle-8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="var(--mint)" stroke="var(--line)" strokeWidth="2" />
          <circle cx="8" cy="10" r="1.5" fill="var(--line)" />
          <circle cx="16" cy="10" r="1.5" fill="var(--line)" />
          <path d="M8 15a4 4 0 008 0" fill="none" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Growth Chart */}
        <svg className="doodle doodle-lg doodle-9" viewBox="0 0 24 24">
          <path d="M3 3v18h18" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M18.5 7.5L12 14l-4-4-5 5" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M14 7.5h4.5V12" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <rect x="6" y="14" width="2" height="4" rx="0.5" fill="var(--mint)" stroke="var(--line)" strokeWidth="1.5" />
          <rect x="11" y="10" width="2" height="8" rx="0.5" fill="var(--butter)" stroke="var(--line)" strokeWidth="1.5" />
          <rect x="16" y="6" width="2" height="12" rx="0.5" fill="var(--rose)" stroke="var(--line)" strokeWidth="1.5" />
        </svg>
        {/* Coffee Cup */}
        <svg className="doodle doodle-md doodle-10" viewBox="0 0 24 24">
          <path d="M17 8h1a3 3 0 110 6h-1m-12-6h12v7a4 4 0 01-4 4H9a4 4 0 01-4-4V8z" fill="var(--peach)" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 2v3M12 2v3M15 2v3" stroke="var(--line)" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        {/* Graduation Cap */}
        <svg className="doodle doodle-md doodle-11" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--sky-deep)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M6 10v6c0 2.2 2.7 4 6 4s6-1.8 6-4v-6" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M20 7v6" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Sparkles */}
        <svg className="doodle doodle-sm doodle-12" viewBox="0 0 24 24">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zm6 11l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="auth-card plush-lg paper popin">
        <div className="lang-selector">
          <button type="button" className={`lang-btn ${lang === 'ru' ? 'active' : ''}`} onClick={() => changeLang('ru')}>RU</button>
          <button type="button" className={`lang-btn ${lang === 'uz' ? 'active' : ''}`} onClick={() => changeLang('uz')}>UZ</button>
          <button type="button" className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>EN</button>
        </div>

        <div className="auth-header">
          <h2>{TRANSLATIONS[lang].signInTitle}</h2>
          <p>{TRANSLATIONS[lang].signInSub}</p>
        </div>

        {error && <div className="toast-alert warning">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{TRANSLATIONS[lang].emailLabel}</label>
            <input
              type="email"
              className="form-input"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{TRANSLATIONS[lang].passwordLabel}</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
            />
          </div>

          <button type="submit" className="btn-plush primary" style={{ width: '100%', marginTop: '8px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : TRANSLATIONS[lang].signInBtn}
          </button>
        </form>

        <div className="auth-footer">
          {TRANSLATIONS[lang].noAccount}
          <Link to="/signup" className="auth-link">
            {TRANSLATIONS[lang].signUpLink}
          </Link>
        </div>
      </div>
    </div>
  );
}

function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('solo');
  const [orgName, setOrgName] = useState('');
  const [roomKey, setRoomKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ru');

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem('app_lang', l);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError(TRANSLATIONS[lang].errorRequired);
      return;
    }
    if (role === 'admin' && !orgName.trim()) {
      setError(TRANSLATIONS[lang].errorOrg);
      return;
    }
    if (role === 'employee' && !roomKey.trim()) {
      setError(TRANSLATIONS[lang].errorRoom);
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name,
          email,
          password,
          role,
          organizationName: orgName,
          roomKey,
        },
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error(signInError.message);
      }
      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper dots-bg">
      {/* Sign Up Background Flying Pastel Doodles */}
      <div className="bg-doodles">
        {/* Rocket */}
        <svg className="doodle doodle-lg doodle-1" viewBox="0 0 24 24">
          <path d="M4.5 16.5c-1.5 1.5-2.5 3.5-2.5 5.5 2 0 4-1 5.5-2.5m-3-3l6-6M12 3s4 0 7 3-1 9-9 9m-1-12a13 13 0 00-4 4l7 7a13 13 0 004-4" fill="var(--peach)" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="14" cy="10" r="2" fill="white" stroke="var(--line)" strokeWidth="1.5" />
        </svg>
        {/* Pencil */}
        <svg className="doodle doodle-md doodle-2" viewBox="0 0 24 24">
          <path d="M13.5 3.5l7 7M17.5 7.5L9 16l-3.5.5.5-3.5 8.5-8.5zm-12 12H19" fill="var(--butter)" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Star */}
        <svg className="doodle doodle-sm doodle-3" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        {/* Heart */}
        <svg className="doodle doodle-md doodle-4" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="var(--rose)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        {/* Crown */}
        <svg className="doodle doodle-lg doodle-5" viewBox="0 0 24 24">
          <path d="M2 4l3 12h14l3-12-5 4-5-6-5 6-5-4z" fill="var(--butter)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="2" cy="4" r="1" fill="var(--line)" />
          <circle cx="22" cy="4" r="1" fill="var(--line)" />
          <circle cx="12" cy="2" r="1" fill="var(--line)" />
        </svg>
        {/* Planet */}
        <svg className="doodle doodle-md doodle-6" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="6" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" />
          <path d="M2 12h20M5.5 8.5a9.5 9.5 0 0013 7" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Speech Bubble */}
        <svg className="doodle doodle-md doodle-7" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="var(--rose)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {/* Sparkles */}
        <svg className="doodle doodle-sm doodle-8" viewBox="0 0 24 24">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zm6 11l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        {/* Growth Chart */}
        <svg className="doodle doodle-lg doodle-9" viewBox="0 0 24 24">
          <path d="M3 3v18h18" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M18.5 7.5L12 14l-4-4-5 5" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M14 7.5h4.5V12" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <rect x="6" y="14" width="2" height="4" rx="0.5" fill="var(--mint)" stroke="var(--line)" strokeWidth="1.5" />
          <rect x="11" y="10" width="2" height="8" rx="0.5" fill="var(--butter)" stroke="var(--line)" strokeWidth="1.5" />
          <rect x="16" y="6" width="2" height="12" rx="0.5" fill="var(--rose)" stroke="var(--line)" strokeWidth="1.5" />
        </svg>
        {/* Coin / Money */}
        <svg className="doodle doodle-sm doodle-10" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="2"/>
          <circle cx="12" cy="12" r="5" fill="var(--butter)" stroke="var(--line)" strokeWidth="1.5"/>
        </svg>
        {/* Book */}
        <svg className="doodle doodle-md doodle-11" viewBox="0 0 24 24">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20v2.5a2.5 2.5 0 01-2.5 2.5H6.5A2.5 2.5 0 014 19.5z" fill="var(--rose)" stroke="var(--line)" strokeWidth="2" />
          <path d="M6.5 2H20v15H6.5A2.5 2.5 0 014 14.5V4A2.5 2.5 0 016.5 2z" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" />
        </svg>
        {/* Key */}
        <svg className="doodle doodle-sm doodle-12" viewBox="0 0 24 24">
          <path d="M21 2l-2 2m-1.5-1.5L16 4m-4 4l3-3m-6.5 6.5A4.5 4.5 0 106 18a4.5 4.5 0 005.5-3.5L15 11h2v2h2v-2h3V8h-9.5z" fill="var(--butter)" stroke="var(--line)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="auth-card plush-lg paper popin">
        <div className="lang-selector">
          <button type="button" className={`lang-btn ${lang === 'ru' ? 'active' : ''}`} onClick={() => changeLang('ru')}>RU</button>
          <button type="button" className={`lang-btn ${lang === 'uz' ? 'active' : ''}`} onClick={() => changeLang('uz')}>UZ</button>
          <button type="button" className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>EN</button>
        </div>

        <div className="auth-header">
          <h2>{TRANSLATIONS[lang].signUpTitle}</h2>
          <p>{TRANSLATIONS[lang].signUpSub}</p>
        </div>

        {error && <div className="toast-alert warning">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{TRANSLATIONS[lang].nameLabel}</label>
            <input
              type="text"
              className="form-input"
              placeholder={TRANSLATIONS[lang].namePlaceholder}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{TRANSLATIONS[lang].emailLabel}</label>
            <input
              type="email"
              className="form-input"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{TRANSLATIONS[lang].roleLabel}</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setError('');
              }}
            >
              <option value="solo">{TRANSLATIONS[lang].roleSolo}</option>
              <option value="admin">{TRANSLATIONS[lang].roleAdmin}</option>
              <option value="employee">{TRANSLATIONS[lang].roleEmployee}</option>
            </select>
          </div>

          {role === 'admin' && (
            <div className="form-group popin">
              <label className="form-label">{TRANSLATIONS[lang].orgLabel}</label>
              <input
                type="text"
                className="form-input"
                placeholder={TRANSLATIONS[lang].orgPlaceholder}
                value={orgName}
                onChange={(e) => {
                  setOrgName(e.target.value);
                  setError('');
                }}
              />
            </div>
          )}

          {role === 'employee' && (
            <div className="form-group popin">
              <label className="form-label">{TRANSLATIONS[lang].roomKeyLabel}</label>
              <input
                type="text"
                className="form-input"
                placeholder={TRANSLATIONS[lang].roomKeyPlaceholder}
                value={roomKey}
                autoComplete="off"
                onChange={(e) => {
                  setRoomKey(e.target.value);
                  setError('');
                }}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{TRANSLATIONS[lang].passwordLabel}</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
            />
          </div>

          <button type="submit" className="btn-plush primary" style={{ width: '100%', marginTop: '8px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : TRANSLATIONS[lang].signUpBtn}
          </button>
        </form>

        <div className="auth-footer">
          {TRANSLATIONS[lang].hasAccount}
          <Link to="/signin" className="auth-link">
            {TRANSLATIONS[lang].signInLink}
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      try {
        const token = await getSessionToken();
        if (!token) {
          navigate('/signin', { replace: true });
          return;
        }

        const userProfile = await apiRequest('/api/me', { token });
        const dashboardPath =
          userProfile.role === 'admin' ? '/api/admin/dashboard' : '/api/employee/dashboard';
        const dashboardPayload = await apiRequest(dashboardPath, { token });

        if (isActive) {
          setProfile(userProfile);
          setDashboard(dashboardPayload);
          setError('');
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError.message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin', { replace: true });
  };

  if (isLoading) {
    return (
      <main className="product-app dots-bg dashboard-page">
        <section className="dashboard-shell plush-lg paper">
          <p className="empty-state">Loading dashboard...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="product-app dots-bg dashboard-page">
      <header className="app-header">
        <Link to="/dashboard" className="app-logo">Training Loop</Link>
        <div className="header-user">
          {profile ? (
            <div className="header-user-info">
              <span className={`header-avatar ${profile.role}`}>{profile.name?.[0] || 'U'}</span>
              <span className="header-username">{profile.name}</span>
              <span className="chip sky">{profile.role}</span>
            </div>
          ) : null}
          <button type="button" className="btn-plush sm" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-shell plush-lg paper popin">
        <div className="preview-heading">
          <span className="chip peach">Connected to FastAPI</span>
          <h2>{profile?.role === 'admin' ? 'Admin dashboard' : 'Employee dashboard'}</h2>
          <p>
            Live data is coming from Supabase through the FastAPI backend.
          </p>
        </div>

        {error ? <div className="toast-alert warning">{error}</div> : null}

        {profile?.role === 'admin' ? (
          <AdminDashboardView dashboard={dashboard} />
        ) : (
          <EmployeeDashboardView dashboard={dashboard} />
        )}
      </section>
    </main>
  );
}

function AdminDashboardView({ dashboard }) {
  const scenarios = dashboard?.scenarios || [];

  return (
    <div className="dashboard-grid">
      <div className="stat-card">
        <span>Organization</span>
        <strong>{dashboard?.organizationId || 'No organization'}</strong>
      </div>
      <div className="stat-card">
        <span>Scenarios</span>
        <strong>{scenarios.length}</strong>
      </div>
      <div className="stat-card">
        <span>Weak skills</span>
        <strong>{dashboard?.weakSkills?.length || 0}</strong>
      </div>

      {scenarios.map((scenario) => (
        <article key={scenario.scenarioId} className="dashboard-card">
          <div>
            <span className="chip butter">Scenario</span>
            <h3>{scenario.title}</h3>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Completion</span>
              <strong>{Math.round((scenario.completionRate || 0) * 100)}%</strong>
            </div>
            <div className="stat-card">
              <span>Average</span>
              <strong>{scenario.averageScore ?? 'N/A'}</strong>
            </div>
            <div className="stat-card">
              <span>Employees</span>
              <strong>{scenario.assignedEmployees.length}</strong>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmployeeDashboardView({ dashboard }) {
  const assignments = dashboard?.assignments || [];

  return (
    <div className="dashboard-grid">
      <div className="stat-card">
        <span>Assignments</span>
        <strong>{assignments.length}</strong>
      </div>
      <div className="stat-card">
        <span>Completed</span>
        <strong>{assignments.filter((assignment) => assignment.status === 'completed').length}</strong>
      </div>
      <div className="stat-card">
        <span>Required score</span>
        <strong>{assignments[0]?.requiredScore || 'N/A'}</strong>
      </div>

      {assignments.length ? assignments.map((assignment) => (
        <article key={assignment.assignmentId} className="dashboard-card">
          <div>
            <span className="chip mint">{assignment.status}</span>
            <h3>{assignment.scenario.title}</h3>
            <p>{assignment.scenario.openingMessage}</p>
          </div>
          <button type="button" className="btn-plush sm primary">Start training</button>
        </article>
      )) : (
        <article className="dashboard-card">
          <h3>No assignments yet</h3>
          <p>Your coach has not assigned a scenario to this account.</p>
        </article>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/signin" element={<LoginPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
