import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  UploadCloud,
  Wifi,
  WifiOff,
} from 'lucide-react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { apiRequest, getSessionToken, supabase } from './backendApi.js';
import { CommTrainerExperience } from './CommTrainerApp.jsx';
import { assignments as mockAssignments, organization as mockOrganization, scenarios as mockScenarios } from './mockData.js';
import ordinaryModelUrl from '../ordinary.glb?url';
import beardedModelUrl from '../bearded.glb?url';
import tableModelUrl from '../table.glb?url';
import './Aurora.css';
import {
  CHAISE_POSE,
  CHAISE_POSE_REVISION,
  DESK_POSE,
  DESK_POSE_REVISION,
  getPoseForCase,
  STANDING_POSE_REVISION,
} from './casePoses.js';
const NEUTRAL_TRANSFORM = { x: 0, y: 0, z: 0, scale: 1 };

const DEFAULT_CHAISE_TRANSFORM = { ...CHAISE_POSE.chaiseTransform };

const DEFAULT_DESK_TRANSFORM = { ...DESK_POSE.deskTransform };

const DEFAULT_CHAISE_SHAPE = CHAISE_POSE.chaiseShape.map((point) => ({ ...point }));

const CAMERA_ZOOM_SLACK = 0.2;
const DEMO_EMPLOYEE_ID = 'user_employee_1';
const DEMO_ADMIN_ID = 'user_admin';
const DEFAULT_MATERIAL = `Enterprise customers ask about security, procurement, implementation value, contract guarantees, and operational savings.

Sales reps must acknowledge the customer's concern, connect the answer to approved policy, explain the next step, and avoid unsupported savings promises.`;

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
    position: { x: -0.2, y: 1.05, z: -1 },
    rotation: { x: 0, y: 26, z: 0 },
  },
  standing: {
    length: 6.25,
    position: { x: 0, y: 1.4, z: 0 },
    rotation: { x: 2, y: 1, z: -1 },
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

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function transcriptForEvaluation(detail) {
  return (detail?.transcript || []).map((message) => ({
    role: message.role,
    message: message.message || message.content,
  }));
}

function normalizeScenario(value) {
  if (!value) {
    return null;
  }

  return {
    ...value,
    materialId: value.materialId || value.material_id,
    openingMessage: value.openingMessage || value.opening_message,
    evaluationSkills: value.evaluationSkills || value.evaluation_skills || [],
  };
}

function normalizeAssignment(value) {
  if (!value) {
    return null;
  }

  return {
    ...value,
    scenarioId: value.scenarioId || value.scenario_id,
    employeeIds: value.employeeIds || value.employee_ids || [],
    requiredScore: value.requiredScore || value.required_score,
  };
}

function TrainingConsole() {
  const [health, setHealth] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [contract, setContract] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(DEMO_EMPLOYEE_ID);
  const [materialTitle, setMaterialTitle] = useState('Enterprise Sales FAQ');
  const [materialContent, setMaterialContent] = useState(DEFAULT_MATERIAL);
  const [goal, setGoal] = useState('Handle enterprise objections');
  const [skills, setSkills] = useState('knowledge accuracy, objection handling, confidence');
  const [material, setMaterial] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [scenario, setScenario] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [userMessage, setUserMessage] = useState('I understand the concern. First, our security policy requires review before procurement, and next I can map the value to your operating goals.');
  const [evaluation, setEvaluation] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

  const selectedUser = users.find((user) => user.id === selectedUserId) || users.find((user) => user.role === 'employee');
  const canGenerate = Boolean(material);
  const canAssign = Boolean(scenario && selectedUserId);
  const canStart = Boolean(scenario && selectedUserId);
  const canSend = Boolean(session?.id && userMessage.trim());
  const canEvaluate = Boolean(scenario?.id && sessionDetail?.transcript?.length);

  const refreshDashboard = useCallback(async () => {
    const dashboardPayload = await apiRequest('/api/admin/dashboard', { demoUser: DEMO_ADMIN_ID });
    setDashboard(dashboardPayload);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBackendState() {
      try {
        const [healthPayload, aiPayload, contractPayload, usersPayload, dashboardPayload] = await Promise.all([
          apiRequest('/api/health'),
          apiRequest('/api/ai/status'),
          apiRequest('/api/contracts/scenario'),
          apiRequest('/api/demo-users'),
          apiRequest('/api/admin/dashboard', { demoUser: DEMO_ADMIN_ID }),
        ]);

        if (!active) {
          return;
        }

        setHealth(healthPayload);
        setAiStatus(aiPayload);
        setContract(contractPayload);
        setUsers(usersPayload.users || []);
        setDashboard(dashboardPayload);
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
          setHealth({ ok: false });
        }
      }
    }

    loadBackendState();

    return () => {
      active = false;
    };
  }, []);

  const runAction = useCallback(async (actionName, action) => {
    setBusyAction(actionName);
    setError('');

    try {
      await action();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  }, []);

  const createMaterial = () =>
    runAction('material', async () => {
      const payload = await apiRequest('/api/materials', {
        demoUser: DEMO_ADMIN_ID,
        method: 'POST',
        body: {
          title: materialTitle,
          content: materialContent,
        },
      });
      const savedMaterial = payload.material || payload;
      const chunkPayload = await apiRequest(`/api/materials/${savedMaterial.id}/chunks`, { demoUser: DEMO_ADMIN_ID });
      setMaterial(savedMaterial);
      setChunks(chunkPayload.chunks || []);
      setScenario(null);
      setAssignment(null);
      setSession(null);
      setSessionDetail(null);
      setTranscript([]);
      setEvaluation(null);
      await refreshDashboard();
    });

  const generateScenario = () =>
    runAction('scenario', async () => {
      const payload = await apiRequest('/api/scenarios/generate', {
        demoUser: DEMO_ADMIN_ID,
        method: 'POST',
        body: {
          materialId: material.id,
          goal,
          skills: skills
            .split(',')
            .map((skill) => skill.trim())
            .filter(Boolean),
          language: localStorage.getItem('app_lang') || 'ru',
        },
      });
      setScenario(normalizeScenario(payload.scenario || payload));
      setAssignment(null);
      setSession(null);
      setSessionDetail(null);
      setTranscript([]);
      setEvaluation(null);
      await refreshDashboard();
    });

  const assignScenario = () =>
    runAction('assignment', async () => {
      const payload = await apiRequest('/api/assignments', {
        demoUser: DEMO_ADMIN_ID,
        method: 'POST',
        body: {
          scenarioId: scenario.id,
          employeeIds: [selectedUserId],
          requiredScore: 75,
        },
      });
      setAssignment(normalizeAssignment(payload.assignment || payload));
      await refreshDashboard();
    });

  const startSession = () =>
    runAction('session', async () => {
      const openingMessage = scenario.openingMessage || scenario.opening_message;
      const nextTranscript = openingMessage ? [{ role: 'persona', message: openingMessage }] : [];
      setSession({ id: `local-${scenario.id}`, scenarioId: scenario.id, status: 'active' });
      setTranscript(nextTranscript);
      setSessionDetail({ transcript: nextTranscript });
      setEvaluation(null);
    });

  const sendMessage = () =>
    runAction('message', async () => {
      const payload = await apiRequest('/api/simulation/message', {
        demoUser: selectedUserId,
        method: 'POST',
        body: {
          scenarioId: scenario.id,
          transcript,
          userMessage,
          language: localStorage.getItem('app_lang') || 'ru',
        },
      });
      const nextTranscript = payload.transcript || [
        ...transcript,
        { role: 'user', message: userMessage },
        { role: 'persona', message: payload.personaMessage || payload.persona_message },
      ];
      setTranscript(nextTranscript);
      setSessionDetail({ transcript: nextTranscript });
      setUserMessage('');
    });

  const evaluateSession = () =>
    runAction('evaluation', async () => {
      const payload = await apiRequest('/api/attempts/evaluate', {
        demoUser: selectedUserId,
        method: 'POST',
        body: {
          scenarioId: scenario.id,
          transcript: transcriptForEvaluation(sessionDetail),
          assignmentId: assignment?.id,
          language: localStorage.getItem('app_lang') || 'ru',
        },
      });
      setEvaluation(payload);
      await refreshDashboard();
    });

  return (
    <section className="training-console" aria-label="Training backend console">
      <div className="console-header">
        <div>
          <h1>AI Training Loop</h1>
          <p>{scenario?.title || contract?.title || 'Scenario contract loading'}</p>
        </div>
        <div className={`connection-pill ${health?.ok ? 'is-online' : 'is-offline'}`}>
          {health?.ok ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{health?.ok ? aiStatus?.provider || 'online' : 'offline'}</span>
        </div>
      </div>

      <div className="console-grid">
        <div className="console-block">
          <div className="block-title">
            <UploadCloud size={16} />
            <span>Material</span>
          </div>
          <input value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} />
          <textarea value={materialContent} onChange={(event) => setMaterialContent(event.target.value)} rows={5} />
          <button type="button" onClick={createMaterial} disabled={busyAction === 'material'}>
            {busyAction === 'material' ? 'Saving...' : 'Save material'}
          </button>
          {material ? <small>{chunks.length} source chunk{chunks.length === 1 ? '' : 's'} indexed</small> : null}
        </div>

        <div className="console-block">
          <div className="block-title">
            <Sparkles size={16} />
            <span>Scenario</span>
          </div>
          <input value={goal} onChange={(event) => setGoal(event.target.value)} />
          <input value={skills} onChange={(event) => setSkills(event.target.value)} />
          <button type="button" onClick={generateScenario} disabled={!canGenerate || busyAction === 'scenario'}>
            {busyAction === 'scenario' ? 'Generating...' : 'Generate scenario'}
          </button>
          {scenario ? (
            <div className="scenario-card">
              <strong>{scenario.persona}</strong>
              <span>{scenario.openingMessage}</span>
            </div>
          ) : null}
        </div>

        <div className="console-block">
          <div className="block-title">
            <ClipboardCheck size={16} />
            <span>Assignment</span>
          </div>
          <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
            {users
              .filter((user) => user.role === 'employee' || user.role === 'solo')
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
          <button type="button" onClick={assignScenario} disabled={!canAssign || busyAction === 'assignment'}>
            {busyAction === 'assignment' ? 'Assigning...' : 'Assign training'}
          </button>
          <button type="button" onClick={startSession} disabled={!canStart || busyAction === 'session'}>
            <Play size={15} />
            {busyAction === 'session' ? 'Starting...' : 'Start session'}
          </button>
          {assignment ? <small>Assigned to {selectedUser?.name || selectedUserId}</small> : null}
        </div>
      </div>

      <div className="session-row">
        <div className="chat-panel">
          <div className="chat-feed">
            {(sessionDetail?.transcript || []).map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-message chat-message--${message.role}`}>
                <span>{message.role}</span>
                <p>{message.message || message.content}</p>
              </div>
            ))}
            {!sessionDetail?.transcript?.length ? <p className="empty-state">Start a session to receive the persona opening.</p> : null}
          </div>
          <div className="chat-input">
            <textarea
              value={userMessage}
              onChange={(event) => setUserMessage(event.target.value)}
              rows={2}
              disabled={!session?.id}
            />
            <button type="button" onClick={sendMessage} disabled={!canSend || busyAction === 'message'} aria-label="Send message">
              <Send size={17} />
            </button>
          </div>
        </div>

        <div className="results-panel">
          <div className="metric-strip">
            <div>
              <span>Completion</span>
              <strong>{formatPercent(dashboard?.completionRate)}</strong>
            </div>
            <div>
              <span>Average</span>
              <strong>{dashboard?.averageScore ?? '-'}</strong>
            </div>
            <div>
              <span>Attempts</span>
              <strong>{dashboard?.totals?.attempts ?? 0}</strong>
            </div>
          </div>
          <button type="button" onClick={evaluateSession} disabled={!canEvaluate || busyAction === 'evaluation'}>
            <BarChart3 size={15} />
            {busyAction === 'evaluation' ? 'Scoring...' : 'Evaluate attempt'}
          </button>
          {evaluation ? (
            <div className="feedback-card">
              <strong>{evaluation.score}/100</strong>
              <p>{evaluation.feedback?.summary}</p>
              <div className="skill-list">
                {Object.entries(evaluation.skillScores || {}).map(([skill, score]) => (
                  <span key={skill}>
                    {skill}: {score}/5
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <button type="button" className="ghost-button" onClick={() => runAction('refresh', refreshDashboard)}>
            <RefreshCw size={14} />
            Refresh dashboard
          </button>
        </div>
      </div>

      {error ? <div className="console-error">{error}</div> : null}
    </section>
  );
}

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
    [activeCaseId, CHAISE_POSE_REVISION, STANDING_POSE_REVISION, DESK_POSE_REVISION],
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
  }, [activeCase, bones, poseSetters, CHAISE_POSE_REVISION, STANDING_POSE_REVISION, DESK_POSE_REVISION]);

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
    successRegister: "Регистрация успешна для:",
    onboardingBack: "Назад",
    onboardingProgress: "Прогресс",
    onboardingSkip: "Не сейчас",
    onboardingStep1Eyebrow: "Шаг 1 из 5",
    onboardingStep1Title: "В какой сфере вы работаете или хотите развиваться?",
    onboardingStep1Subtitle: "Выберите ближайший контекст, чтобы сценарии сразу звучали по делу.",
    onboardingStep2Eyebrow: "Шаг 2 из 5",
    onboardingStep2Title: "Кем вы работаете в этой сфере?",
    onboardingStep2Subtitle: "Роли подстраиваются под выбранную отрасль.",
    onboardingStep3Eyebrow: "Шаг 3 из 5",
    onboardingStep3Title: "Что хотите прокачать в первую очередь?",
    onboardingStep3Subtitle: "Выберите результат, который хочется почувствовать уже в первых тренировках.",
    onboardingStep4Eyebrow: "Шаг 4 из 5",
    onboardingStep4Title: "Как будете тренироваться?",
    onboardingStep4Subtitle: "Выберите уровень давления: от спокойной поддержки до сложных кейсов.",
    onboardingStep5Eyebrow: "Шаг 5 из 5",
    onboardingStep5Title: "Как мы вас поняли",
    onboardingStep5Subtitle: "Проверьте профиль. Если всё верно — откроем главное меню.",
    onboardingSummaryIndustry: "Сфера выбрана",
    onboardingSummaryRole: "Роль выбрана",
    onboardingSummaryGoal: "Цель выбрана",
    onboardingSummaryExperience: "Формат выбран",
    onboardingStarterScenario: "Стартовый сценарий",
    onboardingEditGoalLabel: "Уточните цель",
    onboardingEditGoalPlaceholder: "Например: уверенно вести сложные разговоры",
    onboardingSaveGoal: "Сохранить и перейти в меню",
    onboardingConfirm: "Да, всё верно",
    onboardingEditGoal: "Нет, исправить цель",
    onboardingFallbackRole: "специалист",
    onboardingFallbackIndustry: "вашей отрасли",
    onboardingFallbackGoal: "Прокачать ключевые навыки",
    onboardingFallbackFocus: "собрать персональный трек под вашу роль",
    onboardingFirstGoal: "Первая тренировка",
    onboardingSkipGoalTone: "Вернёмся к цели позже",
    onboardingSkipExperienceTone: "Начнём с мягкого режима",
    onboardingAiLoading: "AI summary loading"
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
    successRegister: "Muvaffaqiyatli ro'yxatdan o'tildi:",
    onboardingBack: "Orqaga",
    onboardingProgress: "Jarayon",
    onboardingSkip: "Hozir emas",
    onboardingStep1Eyebrow: "1-qadam / 5",
    onboardingStep1Title: "Qaysi sohada ishlaysiz yoki rivojlanmoqchisiz?",
    onboardingStep1Subtitle: "Ssenariylar darhol mos bo'lishi uchun eng yaqin kontekstni tanlang.",
    onboardingStep2Eyebrow: "2-qadam / 5",
    onboardingStep2Title: "Bu sohada rolingiz qanday?",
    onboardingStep2Subtitle: "Rollar tanlangan sohaga moslashadi.",
    onboardingStep3Eyebrow: "3-qadam / 5",
    onboardingStep3Title: "Avval qaysi ko'nikmani kuchaytirmoqchisiz?",
    onboardingStep3Subtitle: "Birinchi mashqlardayoq sezmoqchi bo'lgan natijani tanlang.",
    onboardingStep4Eyebrow: "4-qadam / 5",
    onboardingStep4Title: "Qanday mashq qilasiz?",
    onboardingStep4Subtitle: "Yumshoq yordamdan murakkab vaziyatlargacha bosim darajasini tanlang.",
    onboardingStep5Eyebrow: "5-qadam / 5",
    onboardingStep5Title: "Sizni qanday tushundik",
    onboardingStep5Subtitle: "Profilni tekshiring. Hammasi to'g'ri bo'lsa, asosiy menyuni ochamiz.",
    onboardingSummaryIndustry: "Soha tanlandi",
    onboardingSummaryRole: "Rol tanlandi",
    onboardingSummaryGoal: "Maqsad tanlandi",
    onboardingSummaryExperience: "Format tanlandi",
    onboardingStarterScenario: "Boshlang'ich ssenariy",
    onboardingEditGoalLabel: "Maqsadni aniqlang",
    onboardingEditGoalPlaceholder: "Masalan: murakkab suhbatlarni ishonch bilan olib borish",
    onboardingSaveGoal: "Saqlash va menyuga o'tish",
    onboardingConfirm: "Ha, hammasi to'g'ri",
    onboardingEditGoal: "Yo'q, maqsadni tuzatish",
    onboardingFallbackRole: "mutaxassis",
    onboardingFallbackIndustry: "sohangiz",
    onboardingFallbackGoal: "Asosiy ko'nikmalarni kuchaytirish",
    onboardingFallbackFocus: "rolingizga mos shaxsiy trek tuzish",
    onboardingFirstGoal: "Birinchi mashq",
    onboardingSkipGoalTone: "Maqsadga keyin qaytamiz",
    onboardingSkipExperienceTone: "Yumshoq rejimdan boshlaymiz",
    onboardingAiLoading: "AI xulosasi yuklanmoqda"
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
    successRegister: "Registration successful for:",
    onboardingBack: "Back",
    onboardingProgress: "Progress",
    onboardingSkip: "Not now",
    onboardingStep1Eyebrow: "Step 1 of 5",
    onboardingStep1Title: "What field do you work in or want to grow into?",
    onboardingStep1Subtitle: "Choose the closest context so scenarios feel useful right away.",
    onboardingStep2Eyebrow: "Step 2 of 5",
    onboardingStep2Title: "What is your role in this field?",
    onboardingStep2Subtitle: "Roles adapt to the industry you selected.",
    onboardingStep3Eyebrow: "Step 3 of 5",
    onboardingStep3Title: "What do you want to improve first?",
    onboardingStep3Subtitle: "Choose the result you want to feel in the first training sessions.",
    onboardingStep4Eyebrow: "Step 4 of 5",
    onboardingStep4Title: "How do you want to train?",
    onboardingStep4Subtitle: "Choose the pressure level, from gentle support to tougher cases.",
    onboardingStep5Eyebrow: "Step 5 of 5",
    onboardingStep5Title: "How we understood you",
    onboardingStep5Subtitle: "Review your profile. If everything is right, we will open the main menu.",
    onboardingSummaryIndustry: "Industry selected",
    onboardingSummaryRole: "Role selected",
    onboardingSummaryGoal: "Goal selected",
    onboardingSummaryExperience: "Mode selected",
    onboardingStarterScenario: "Starter scenario",
    onboardingEditGoalLabel: "Refine your goal",
    onboardingEditGoalPlaceholder: "Example: handle difficult conversations with confidence",
    onboardingSaveGoal: "Save and open menu",
    onboardingConfirm: "Yes, looks right",
    onboardingEditGoal: "No, edit goal",
    onboardingFallbackRole: "specialist",
    onboardingFallbackIndustry: "your field",
    onboardingFallbackGoal: "Build key skills",
    onboardingFallbackFocus: "build a personal track for your role",
    onboardingFirstGoal: "First training",
    onboardingSkipGoalTone: "We will return to the goal later",
    onboardingSkipExperienceTone: "We will start with a gentle mode",
    onboardingAiLoading: "AI summary loading"
  }
};

const MOCK_USER_KEY = 'training_loop_mock_user';
const MOCK_SESSION_KEY = 'training_loop_mock_session';
const ONBOARDING_KEY = 'training_loop_onboarding';
const ONBOARDING_MEMORY_KEY = 'training_loop_onboarding_memory';
const ONBOARDING_TOTAL_STEPS = 5;

const INDUSTRY_OPTIONS = [
  { id: 'medicine', icon: '🏥', label: 'Медицина', tone: 'Забота и точность' },
  { id: 'psychology', icon: '🧠', label: 'Психология', tone: 'Эмпатия и доверие' },
  { id: 'law', icon: '⚖️', label: 'Право', tone: 'Аргументы и ясность' },
  { id: 'education', icon: '🎓', label: 'Образование', tone: 'Подача и вовлечение' },
  { id: 'business', icon: '💼', label: 'Бизнес', tone: 'Продажи и переговоры' },
  { id: 'emergency', icon: '🚨', label: 'Экстренные службы', tone: 'Спокойствие под давлением' },
  { id: 'other', icon: '✨', label: 'Другое', tone: 'Соберём под вашу цель' },
];

const ROLE_OPTIONS_BY_INDUSTRY = {
  medicine: [
    { id: 'doctor-nurse', icon: '👨‍⚕️', label: 'Врач / Медсестра', tone: 'Объяснять пациенту без паники' },
    { id: 'ambulance-dispatcher', icon: '🚑', label: 'Диспетчер скорой', tone: 'Быстро собирать главное' },
    { id: 'pharma-rep', icon: '💊', label: 'Фармпредставитель', tone: 'Уверенно отвечать на возражения' },
    { id: 'medical-student', icon: '🎓', label: 'Студент-медик', tone: 'Тренировать первые диалоги' },
  ],
  psychology: [
    { id: 'psychologist', icon: '🧘', label: 'Психолог', tone: 'Держать контакт в сложной теме' },
    { id: 'coach', icon: '🌱', label: 'Коуч / Консультант', tone: 'Вести клиента к решению' },
    { id: 'hr-specialist', icon: '🤝', label: 'HR-специалист', tone: 'Проводить бережные разговоры' },
    { id: 'psychology-student', icon: '🎓', label: 'Студент', tone: 'Наработать практику' },
  ],
  law: [
    { id: 'lawyer', icon: '⚖️', label: 'Юрист', tone: 'Убедительно объяснять позицию' },
    { id: 'advocate', icon: '🧾', label: 'Адвокат', tone: 'Держать линию защиты' },
    { id: 'compliance', icon: '📋', label: 'Комплаенс', tone: 'Прояснять правила без конфликта' },
    { id: 'law-student', icon: '🎓', label: 'Студент-юрист', tone: 'Тренировать кейсы' },
  ],
  education: [
    { id: 'teacher', icon: '👩‍🏫', label: 'Преподаватель', tone: 'Вовлекать и объяснять проще' },
    { id: 'methodologist', icon: '📚', label: 'Методист', tone: 'Проектировать понятные сценарии' },
    { id: 'tutor', icon: '🧩', label: 'Репетитор', tone: 'Мотивировать ученика' },
    { id: 'student', icon: '🎓', label: 'Студент', tone: 'Прокачать практику общения' },
  ],
  business: [
    { id: 'sales', icon: '💬', label: 'Продажи', tone: 'Закрывать возражения' },
    { id: 'manager', icon: '📈', label: 'Менеджер', tone: 'Вести командные разговоры' },
    { id: 'support', icon: '🎧', label: 'Поддержка клиентов', tone: 'Успокаивать клиента' },
    { id: 'founder', icon: '🚀', label: 'Основатель', tone: 'Питчить и договариваться' },
  ],
  emergency: [
    { id: 'dispatcher', icon: '📞', label: 'Диспетчер', tone: 'Удерживать спокойный темп' },
    { id: 'rescuer', icon: '🛟', label: 'Спасатель', tone: 'Давать чёткие инструкции' },
    { id: 'police', icon: '🛡️', label: 'Сотрудник службы', tone: 'Снижать напряжение' },
    { id: 'volunteer', icon: '🤲', label: 'Волонтёр', tone: 'Помогать без растерянности' },
  ],
  other: [
    { id: 'specialist', icon: '🧭', label: 'Специалист', tone: 'Собрать персональный трек' },
    { id: 'student-other', icon: '🎓', label: 'Учащийся', tone: 'Начать с простых кейсов' },
    { id: 'career-switcher', icon: '🔁', label: 'Меняю сферу', tone: 'Быстро войти в контекст' },
  ],
};

const FALLBACK_ROLE_OPTION = {
  id: 'unsure',
  icon: '❔',
  label: 'Другое / Не уверен',
  tone: 'Подстроим тренировку позже',
};

const GOAL_OPTIONS = [
  { id: 'calm-client', icon: '🗣️', label: 'Успокоить клиента', tone: 'Говорить так, чтобы вам доверяли' },
  { id: 'close-deal', icon: '🤝', label: 'Закрыть сделку', tone: 'Уверенно вести к следующему шагу' },
  { id: 'handle-stress', icon: '🧘', label: 'Не теряться в стрессе', tone: 'Держать тон и фокус' },
  { id: 'follow-protocol', icon: '📋', label: 'Действовать по протоколу', tone: 'Не упускать важные шаги' },
  { id: 'career-growth', icon: '🎯', label: 'Вырасти в карьере', tone: 'Прокачать сильную профессиональную подачу' },
  { id: 'all-at-once', icon: '⚡', label: 'Все сразу', tone: 'Откроем универсальный старт' },
  { id: 'other', icon: '✨', label: 'Другое', tone: 'Настроим цель вручную позже' },
];

const EXPERIENCE_OPTIONS = [
  { id: 'beginner', icon: '🔰', label: 'Новичок', tone: 'Объясняй и помогай' },
  { id: 'practitioner', icon: '⚡', label: 'Практик', tone: 'Давай сложные кейсы' },
  { id: 'pro', icon: '🎓', label: 'Профи', tone: 'Только хардкор, без подсказок' },
  { id: 'other', icon: '✨', label: 'Другое', tone: 'Выберу темп по ходу' },
];

const ONBOARDING_OPTIONS = {
  ru: {
    industries: INDUSTRY_OPTIONS,
    rolesByIndustry: ROLE_OPTIONS_BY_INDUSTRY,
    fallbackRole: FALLBACK_ROLE_OPTION,
    goals: GOAL_OPTIONS,
    experiences: EXPERIENCE_OPTIONS,
  },
  en: {
    industries: [
      { id: 'medicine', icon: '🏥', label: 'Medicine', tone: 'Care and precision' },
      { id: 'psychology', icon: '🧠', label: 'Psychology', tone: 'Empathy and trust' },
      { id: 'law', icon: '⚖️', label: 'Law', tone: 'Arguments and clarity' },
      { id: 'education', icon: '🎓', label: 'Education', tone: 'Delivery and engagement' },
      { id: 'business', icon: '💼', label: 'Business', tone: 'Sales and negotiation' },
      { id: 'emergency', icon: '🚨', label: 'Emergency services', tone: 'Calm under pressure' },
      { id: 'other', icon: '✨', label: 'Other', tone: 'We will shape it around your goal' },
    ],
    rolesByIndustry: {
      medicine: [
        { id: 'doctor-nurse', icon: '👨‍⚕️', label: 'Doctor / Nurse', tone: 'Explain clearly without panic' },
        { id: 'ambulance-dispatcher', icon: '🚑', label: 'Ambulance dispatcher', tone: 'Collect the essentials fast' },
        { id: 'pharma-rep', icon: '💊', label: 'Pharma rep', tone: 'Answer objections with confidence' },
        { id: 'medical-student', icon: '🎓', label: 'Medical student', tone: 'Practice first conversations' },
      ],
      psychology: [
        { id: 'psychologist', icon: '🧘', label: 'Psychologist', tone: 'Keep contact in a difficult topic' },
        { id: 'coach', icon: '🌱', label: 'Coach / Consultant', tone: 'Guide the client toward a decision' },
        { id: 'hr-specialist', icon: '🤝', label: 'HR specialist', tone: 'Run careful conversations' },
        { id: 'psychology-student', icon: '🎓', label: 'Student', tone: 'Build practical experience' },
      ],
      law: [
        { id: 'lawyer', icon: '⚖️', label: 'Lawyer', tone: 'Explain your position persuasively' },
        { id: 'advocate', icon: '🧾', label: 'Advocate', tone: 'Hold a clear defense line' },
        { id: 'compliance', icon: '📋', label: 'Compliance', tone: 'Clarify rules without conflict' },
        { id: 'law-student', icon: '🎓', label: 'Law student', tone: 'Practice cases' },
      ],
      education: [
        { id: 'teacher', icon: '👩‍🏫', label: 'Teacher', tone: 'Engage and explain simply' },
        { id: 'methodologist', icon: '📚', label: 'Methodologist', tone: 'Design clear scenarios' },
        { id: 'tutor', icon: '🧩', label: 'Tutor', tone: 'Motivate the learner' },
        { id: 'student', icon: '🎓', label: 'Student', tone: 'Improve communication practice' },
      ],
      business: [
        { id: 'sales', icon: '💬', label: 'Sales', tone: 'Close objections' },
        { id: 'manager', icon: '📈', label: 'Manager', tone: 'Lead team conversations' },
        { id: 'support', icon: '🎧', label: 'Customer support', tone: 'Calm the client' },
        { id: 'founder', icon: '🚀', label: 'Founder', tone: 'Pitch and negotiate' },
      ],
      emergency: [
        { id: 'dispatcher', icon: '📞', label: 'Dispatcher', tone: 'Keep a calm pace' },
        { id: 'rescuer', icon: '🛟', label: 'Rescuer', tone: 'Give clear instructions' },
        { id: 'police', icon: '🛡️', label: 'Service officer', tone: 'Reduce tension' },
        { id: 'volunteer', icon: '🤲', label: 'Volunteer', tone: 'Help without freezing' },
      ],
      other: [
        { id: 'specialist', icon: '🧭', label: 'Specialist', tone: 'Build a personal track' },
        { id: 'student-other', icon: '🎓', label: 'Learner', tone: 'Start with simple cases' },
        { id: 'career-switcher', icon: '🔁', label: 'Career switcher', tone: 'Enter the context fast' },
      ],
    },
    fallbackRole: {
      id: 'unsure',
      icon: '❔',
      label: 'Other / Not sure',
      tone: 'We will adapt the training later',
    },
    goals: [
      { id: 'calm-client', icon: '🗣️', label: 'Calm client', tone: 'Speak in a way that builds trust' },
      { id: 'close-deal', icon: '🤝', label: 'Close a deal', tone: 'Guide confidently to the next step' },
      { id: 'handle-stress', icon: '🧘', label: 'Handle stress', tone: 'Keep tone and focus' },
      { id: 'follow-protocol', icon: '📋', label: 'Follow protocol', tone: 'Do not miss important steps' },
      { id: 'career-growth', icon: '🎯', label: 'Grow in career', tone: 'Build a strong professional delivery' },
      { id: 'all-at-once', icon: '⚡', label: 'All at once', tone: 'Open a universal start' },
      { id: 'other', icon: '✨', label: 'Other', tone: 'Set the goal manually later' },
    ],
    experiences: [
      { id: 'beginner', icon: '🔰', label: 'Beginner', tone: 'Explain and support me' },
      { id: 'practitioner', icon: '⚡', label: 'Practitioner', tone: 'Give me harder cases' },
      { id: 'pro', icon: '🎓', label: 'Pro', tone: 'Hard mode, no hints' },
      { id: 'other', icon: '✨', label: 'Other', tone: 'I will choose the pace as I go' },
    ],
  },
  uz: {
    industries: [
      { id: 'medicine', icon: '🏥', label: 'Tibbiyot', tone: "G'amxo'rlik va aniqlik" },
      { id: 'psychology', icon: '🧠', label: 'Psixologiya', tone: 'Empatiya va ishonch' },
      { id: 'law', icon: '⚖️', label: 'Huquq', tone: 'Dalillar va ravshanlik' },
      { id: 'education', icon: '🎓', label: "Ta'lim", tone: 'Tushuntirish va jalb qilish' },
      { id: 'business', icon: '💼', label: 'Biznes', tone: 'Savdo va muzokara' },
      { id: 'emergency', icon: '🚨', label: 'Favqulodda xizmatlar', tone: 'Bosim ostida xotirjamlik' },
      { id: 'other', icon: '✨', label: 'Boshqa', tone: 'Maqsadingizga moslaymiz' },
    ],
    rolesByIndustry: {
      medicine: [
        { id: 'doctor-nurse', icon: '👨‍⚕️', label: 'Shifokor / Hamshira', tone: 'Bemorga vahimasiz tushuntirish' },
        { id: 'ambulance-dispatcher', icon: '🚑', label: 'Tez yordam dispetcheri', tone: 'Asosiy narsani tez yigish' },
        { id: 'pharma-rep', icon: '💊', label: 'Farmatsevtika vakili', tone: "E'tirozlarga ishonch bilan javob berish" },
        { id: 'medical-student', icon: '🎓', label: 'Tibbiyot talabasi', tone: 'Birinchi suhbatlarni mashq qilish' },
      ],
      psychology: [
        { id: 'psychologist', icon: '🧘', label: 'Psixolog', tone: 'Murakkab mavzuda aloqani ushlash' },
        { id: 'coach', icon: '🌱', label: 'Kouch / Maslahatchi', tone: 'Mijozni qarorga olib borish' },
        { id: 'hr-specialist', icon: '🤝', label: 'HR mutaxassisi', tone: 'Ehtiyotkor suhbatlar olib borish' },
        { id: 'psychology-student', icon: '🎓', label: 'Talaba', tone: "Amaliyotni ko'paytirish" },
      ],
      law: [
        { id: 'lawyer', icon: '⚖️', label: 'Yurist', tone: 'Pozitsiyani ishonchli tushuntirish' },
        { id: 'advocate', icon: '🧾', label: 'Advokat', tone: 'Himoya chizigini ushlash' },
        { id: 'compliance', icon: '📋', label: 'Komplayens', tone: 'Qoidalarni konfliktsiz tushuntirish' },
        { id: 'law-student', icon: '🎓', label: 'Huquq talabasi', tone: 'Keyslarni mashq qilish' },
      ],
      education: [
        { id: 'teacher', icon: '👩‍🏫', label: "O'qituvchi", tone: 'Jalb qilish va sodda tushuntirish' },
        { id: 'methodologist', icon: '📚', label: 'Metodist', tone: 'Tushunarli ssenariylar loyihalash' },
        { id: 'tutor', icon: '🧩', label: 'Repetitor', tone: "O'quvchini motivatsiya qilish" },
        { id: 'student', icon: '🎓', label: 'Talaba', tone: 'Muloqot amaliyotini kuchaytirish' },
      ],
      business: [
        { id: 'sales', icon: '💬', label: 'Savdo', tone: "E'tirozlarni yopish" },
        { id: 'manager', icon: '📈', label: 'Menejer', tone: 'Jamoaviy suhbatlarni olib borish' },
        { id: 'support', icon: '🎧', label: "Mijozlarni qo'llab-quvvatlash", tone: 'Mijozni tinchlantirish' },
        { id: 'founder', icon: '🚀', label: 'Asoschi', tone: 'Pitch qilish va kelishish' },
      ],
      emergency: [
        { id: 'dispatcher', icon: '📞', label: 'Dispetcher', tone: 'Xotirjam tempni ushlash' },
        { id: 'rescuer', icon: '🛟', label: 'Qutqaruvchi', tone: "Aniq ko'rsatmalar berish" },
        { id: 'police', icon: '🛡️', label: 'Xizmat xodimi', tone: 'Tanglikni pasaytirish' },
        { id: 'volunteer', icon: '🤲', label: "Ko'ngilli", tone: 'Sarosimasiz yordam berish' },
      ],
      other: [
        { id: 'specialist', icon: '🧭', label: 'Mutaxassis', tone: 'Shaxsiy trek tuzish' },
        { id: 'student-other', icon: '🎓', label: "O'quvchi", tone: 'Oddiy keyslardan boshlash' },
        { id: 'career-switcher', icon: '🔁', label: "Kasbini o'zgartirayotgan", tone: 'Kontekstga tez kirish' },
      ],
    },
    fallbackRole: {
      id: 'unsure',
      icon: '❔',
      label: 'Boshqa / Aniq emas',
      tone: 'Mashgulotni keyin moslaymiz',
    },
    goals: [
      { id: 'calm-client', icon: '🗣️', label: 'Mijozni tinchlantirish', tone: 'Ishonch uygotadigan tarzda gapirish' },
      { id: 'close-deal', icon: '🤝', label: 'Bitimni yopish', tone: 'Keyingi qadamga ishonch bilan olib borish' },
      { id: 'handle-stress', icon: '🧘', label: "Stressda yo'qolmaslik", tone: 'Ohang va fokusni ushlash' },
      { id: 'follow-protocol', icon: '📋', label: 'Protokolga amal qilish', tone: 'Muhim qadamlarni otkazib yubormaslik' },
      { id: 'career-growth', icon: '🎯', label: "Karyerada o'sish", tone: 'Kuchli professional taqdimotni rivojlantirish' },
      { id: 'all-at-once', icon: '⚡', label: 'Hammasi birga', tone: 'Universal startni ochamiz' },
      { id: 'other', icon: '✨', label: 'Boshqa', tone: 'Maqsadni keyin qolda sozlaymiz' },
    ],
    experiences: [
      { id: 'beginner', icon: '🔰', label: 'Boshlovchi', tone: 'Tushuntir va yordam ber' },
      { id: 'practitioner', icon: '⚡', label: 'Amaliyotchi', tone: 'Murakkab keyslar ber' },
      { id: 'pro', icon: '🎓', label: 'Professional', tone: 'Qiyin rejim, maslahatsiz' },
      { id: 'other', icon: '✨', label: 'Boshqa', tone: 'Tempni jarayonda tanlayman' },
    ],
  },
};

const EMPTY_ONBOARDING_DRAFT = {
  industry: null,
  industryLabel: '',
  role: null,
  roleLabel: '',
  goal: null,
  goalLabel: '',
  experience: null,
  experienceLabel: '',
  currentStep: 0,
  completedAt: null,
};

function readJsonStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getMockUser() {
  return readJsonStorage(MOCK_USER_KEY);
}

function saveMockUser(user) {
  writeJsonStorage(MOCK_USER_KEY, user);
}

function getUserKey(user) {
  return {
    id: user?.id || '',
    email: user?.email?.trim?.().toLowerCase?.() || '',
  };
}

function onboardingMemoryBelongsToUser(memory, user) {
  if (!memory?.completed || !user) {
    return false;
  }

  const userKey = getUserKey(user);
  const memoryEmail = memory.userEmail?.trim?.().toLowerCase?.() || '';
  return Boolean(
    (memory.userId && userKey.id && memory.userId === userKey.id) ||
      (memoryEmail && userKey.email && memoryEmail === userKey.email),
  );
}

function getOnboardingMemory(user = null) {
  const memory = readJsonStorage(ONBOARDING_MEMORY_KEY);
  if (!memory) {
    return null;
  }

  return user ? (onboardingMemoryBelongsToUser(memory, user) ? memory : null) : memory;
}

function saveOnboardingMemory(memory) {
  writeJsonStorage(ONBOARDING_MEMORY_KEY, memory);
}

function hasCompletedOnboarding(user) {
  return Boolean(getOnboardingMemory(user));
}

function mergeBackendProfileWithLocalState(profile, localUser = null) {
  const normalizedEmail = profile?.email?.trim?.().toLowerCase?.() || localUser?.email || '';
  const localMatches =
    localUser &&
    (localUser.id === profile?.id || (normalizedEmail && localUser.email === normalizedEmail));
  const memory = getOnboardingMemory({ id: profile.id, email: normalizedEmail }) || (localMatches ? getOnboardingMemory(localUser) : null);

  return {
    ...(localMatches ? localUser : {}),
    id: profile.id,
    name: profile.name,
    email: normalizedEmail,
    role: profile.role,
    organizationId: profile.organizationId,
    xp: profile.xp ?? localUser?.xp ?? 0,
    streak: profile.streak ?? localUser?.streak ?? 0,
    level: localUser?.level || 'Старт',
    goal: localUser?.goal || '',
    weakestSkill: localUser?.weakestSkill || 'Первый диалог',
    unlockedScenarioIds: memory?.rewards?.unlockedScenarioIds || localUser?.unlockedScenarioIds || [],
    onboardingRequired: memory ? false : localMatches ? localUser.onboardingRequired !== false : true,
    onboardingCompleted: memory ? true : localMatches ? localUser.onboardingCompleted === true : false,
    onboarding: memory?.draft || (localMatches ? localUser.onboarding || null : null),
    onboardingAiSummary: memory?.aiSummary || localUser?.onboardingAiSummary || null,
    createdAt: localUser?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function hasMockSession() {
  return readJsonStorage(MOCK_SESSION_KEY)?.active === true;
}

function setMockSession(email) {
  writeJsonStorage(MOCK_SESSION_KEY, {
    active: true,
    email,
    signedInAt: new Date().toISOString(),
  });
}

function clearMockSession() {
  localStorage.removeItem(MOCK_SESSION_KEY);
}

function getOnboardingDraft() {
  return {
    ...EMPTY_ONBOARDING_DRAFT,
    ...readJsonStorage(ONBOARDING_KEY, {}),
  };
}

function saveOnboardingDraft(draft) {
  writeJsonStorage(ONBOARDING_KEY, draft);
}

function createMockUser({ name, email, role, organizationName, roomKey }) {
  const normalizedRole = role || 'solo';
  const now = new Date().toISOString();

  return {
    id: `mock-${Date.now()}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: normalizedRole,
    organizationId: normalizedRole === 'admin' || normalizedRole === 'employee' ? mockOrganization.id : null,
    organizationName: organizationName?.trim() || mockOrganization.name,
    roomKey: roomKey?.trim() || '',
    streak: 0,
    xp: 0,
    level: 'Старт',
    goal: '',
    weakestSkill: 'Первый диалог',
    unlockedScenarioIds: [],
    onboardingRequired: true,
    onboardingCompleted: false,
    onboarding: null,
    createdAt: now,
    updatedAt: now,
  };
}

function getOnboardingLang() {
  const lang = localStorage.getItem('app_lang') || 'ru';
  return ONBOARDING_OPTIONS[lang] ? lang : 'ru';
}

function getOnboardingText(lang = getOnboardingLang()) {
  return {
    ...TRANSLATIONS.ru,
    ...(TRANSLATIONS[lang] || {}),
  };
}

function getOnboardingOptions(lang = getOnboardingLang()) {
  return ONBOARDING_OPTIONS[lang] || ONBOARDING_OPTIONS.ru;
}

function getIndustryOptions(lang = getOnboardingLang()) {
  return getOnboardingOptions(lang).industries;
}

function getRoleOptions(industryId, lang = getOnboardingLang()) {
  const options = getOnboardingOptions(lang);
  return [...(options.rolesByIndustry[industryId] || options.rolesByIndustry.other), options.fallbackRole];
}

function getGoalOptions(lang = getOnboardingLang()) {
  return getOnboardingOptions(lang).goals;
}

function getExperienceOptions(lang = getOnboardingLang()) {
  return getOnboardingOptions(lang).experiences;
}

function getGoalOption(goalId, lang = getOnboardingLang()) {
  return getGoalOptions(lang).find((option) => option.id === goalId);
}

function getIndustryOption(industryId, lang = getOnboardingLang()) {
  return getIndustryOptions(lang).find((option) => option.id === industryId);
}

function getExperienceOption(experienceId, lang = getOnboardingLang()) {
  return getExperienceOptions(lang).find((option) => option.id === experienceId);
}

function getLocalizedOnboardingDraft(draft, lang = getOnboardingLang()) {
  const text = getOnboardingText(lang);
  const industryOption = getIndustryOption(draft.industry, lang);
  const roleOption = getRoleOptions(draft.industry, lang).find((option) => option.id === draft.role);
  const goalOption = getGoalOption(draft.goal, lang);
  const experienceOption = getExperienceOption(draft.experience, lang);

  return {
    ...draft,
    industryLabel: industryOption?.label || draft.industryLabel,
    roleLabel: roleOption?.label || draft.roleLabel,
    goalLabel: draft.goal === 'not-now' ? text.onboardingSkip : goalOption?.label || draft.goalLabel,
    experienceLabel: draft.experience === 'not-now' ? text.onboardingSkip : experienceOption?.label || draft.experienceLabel,
  };
}

function normalizeOnboardingStep(draft) {
  const requestedStep = Math.min(Math.max(Number(draft.currentStep) || 0, 0), 4);
  let firstIncompleteStep = 4;

  if (!draft.industry) {
    firstIncompleteStep = 0;
  } else if (!draft.role) {
    firstIncompleteStep = 1;
  } else if (!draft.goal) {
    firstIncompleteStep = 2;
  } else if (!draft.experience) {
    firstIncompleteStep = 3;
  }

  return Math.min(requestedStep, firstIncompleteStep);
}

function buildOnboardingAiSummary(draft, goalLabelOverride = '', lang = getOnboardingLang()) {
  const text = getOnboardingText(lang);
  const localizedDraft = getLocalizedOnboardingDraft(draft, lang);
  const goalLabel = goalLabelOverride || localizedDraft.goalLabel || text.onboardingFallbackGoal;
  const goalOption = getGoalOption(draft.goal, lang);
  const roleLabel = localizedDraft.roleLabel || text.onboardingFallbackRole;
  const industryLabel = localizedDraft.industryLabel || text.onboardingFallbackIndustry;
  const experienceLabel = localizedDraft.experienceLabel || '';
  const focus = goalOption?.tone || text.onboardingFallbackFocus;

  if (lang === 'en') {
    return {
      roleLine: `You are ${roleLabel} in ${industryLabel}.`,
      goalLine: `Your goal is "${goalLabel}".`,
      targetLine: `To reach that result, focus: ${focus}.`,
      modeLine: experienceLabel ? `Training mode - "${experienceLabel}".` : '',
    };
  }

  if (lang === 'uz') {
    return {
      roleLine: `Siz - "${industryLabel}" sohasida ${roleLabel}.`,
      goalLine: `Maqsadingiz - "${goalLabel}".`,
      targetLine: `Natijaga chiqish uchun fokus: ${focus}.`,
      modeLine: experienceLabel ? `Mashg'ulot rejimi - "${experienceLabel}".` : '',
    };
  }

  return {
    roleLine: `Вы — ${roleLabel} в сфере «${industryLabel}».`,
    goalLine: `Ваша цель — «${goalLabel}».`,
    targetLine: `Чтобы выйти на результат, фокус: ${focus}.`,
    modeLine: experienceLabel ? `Режим тренировок — «${experienceLabel}».` : '',
  };
}

function buildMockDashboard(user) {
  const memory = getOnboardingMemory(user);
  if (user.role === 'admin') {
    return {
      organizationId: user.organizationId || mockOrganization.id,
      weakSkills: ['Эмпатия', 'Структура ответа'],
      scenarios: mockScenarios.map((scenario, index) => ({
        scenarioId: scenario.id,
        title: scenario.title,
        completionRate: index === 0 ? 0.74 : 0.42,
        averageScore: index === 0 ? 82 : 76,
        assignedEmployees: ['employee-lena', 'employee-noah', 'employee-ivy'],
      })),
    };
  }

  const unlockedScenarioIds = new Set(user.unlockedScenarioIds || []);
  const firstScenario = mockScenarios[0];
  const starterTitle = memory?.aiSummary?.starterScenarioTitle;
  const personalizedFirstScenario = starterTitle
    ? {
        ...firstScenario,
        title: starterTitle,
        goal: memory?.draft?.goalLabel || user.goal || firstScenario.goal,
      }
    : firstScenario;
  const assignments = mockAssignments.length
    ? mockAssignments.map((assignment) => ({
        ...assignment,
        assignmentId: assignment.id,
        status: assignment.status?.toLowerCase?.() || assignment.status,
        scenario: mockScenarios.find((scenario) => scenario.id === assignment.scenarioId) || personalizedFirstScenario,
      }))
    : [];

  return {
    assignments: [
      {
        assignmentId: 'mock-first-win',
        status: unlockedScenarioIds.has(personalizedFirstScenario.id) ? 'unlocked' : 'new',
        requiredScore: 70,
        scenario: personalizedFirstScenario,
      },
      ...assignments,
    ],
  };
}

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
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const token = data.session?.access_token;
      const profile = await apiRequest('/api/me', { token });
      const appUser = mergeBackendProfileWithLocalState(profile, getMockUser());
      saveMockUser(appUser);
      setMockSession(appUser.email);
      navigate(hasCompletedOnboarding(appUser) ? '/home' : '/onboarding');
    } catch (authError) {
      const storedUser = getMockUser();
      if (storedUser?.email === normalizedEmail) {
        setMockSession(storedUser.email);
        navigate(hasCompletedOnboarding(storedUser) ? '/home' : '/onboarding');
        return;
      }

      setError(authError?.message || 'Аккаунт не найден. Сначала зарегистрируйтесь.');
      setIsSubmitting(false);
    }
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
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const profile = await apiRequest('/api/auth/register', {
        demoUser: null,
        method: 'POST',
        body: {
          name: name.trim(),
          email: normalizedEmail,
          password,
          role,
          organizationName: orgName.trim(),
          roomKey: roomKey.trim(),
        },
      });

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const token = data.session?.access_token;
      const freshProfile = token ? await apiRequest('/api/me', { token }) : profile;
      const appUser = mergeBackendProfileWithLocalState(freshProfile, {
        ...createMockUser({ name, email: normalizedEmail, role, organizationName: orgName, roomKey }),
        onboardingRequired: true,
        onboardingCompleted: false,
      });

      saveMockUser(appUser);
      setMockSession(appUser.email);
      saveOnboardingDraft({
        ...EMPTY_ONBOARDING_DRAFT,
        currentStep: 0,
        startedAt: new Date().toISOString(),
      });
      navigate('/onboarding');
    } catch (registerError) {
      setError(registerError?.message || 'Не удалось создать аккаунт.');
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

function BackgroundDoodles() {
  return (
    <div className="bg-doodles" aria-hidden="true">
      <svg className="doodle doodle-sm doodle-1" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="var(--butter)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <svg className="doodle doodle-lg doodle-2" viewBox="0 0 24 24">
        <path d="M19.36 10.04a6 6 0 00-11.33-1.8 5 5 0 00-6 4.96c0 2.76 2.24 5 5 5h12c2.76 0 5-2.24 5-5a5 5 0 00-4.67-4.96z" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <svg className="doodle doodle-md doodle-3" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="var(--rose)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <svg className="doodle doodle-sm doodle-4" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="2" />
        <circle cx="12" cy="12" r="5" fill="var(--butter)" stroke="var(--line)" strokeWidth="1.5" />
      </svg>
      <svg className="doodle doodle-lg doodle-5" viewBox="0 0 24 24">
        <path d="M4.5 16.5c-1.5 1.5-2.5 3.5-2.5 5.5 2 0 4-1 5.5-2.5m-3-3l6-6M12 3s4 0 7 3-1 9-9 9m-1-12a13 13 0 00-4 4l7 7a13 13 0 004-4" fill="var(--peach)" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="10" r="2" fill="white" stroke="var(--line)" strokeWidth="1.5" />
      </svg>
      <svg className="doodle doodle-md doodle-6" viewBox="0 0 24 24">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20v2.5a2.5 2.5 0 01-2.5 2.5H6.5A2.5 2.5 0 014 19.5z" fill="var(--rose)" stroke="var(--line)" strokeWidth="2" />
        <path d="M6.5 2H20v15H6.5A2.5 2.5 0 014 14.5V4A2.5 2.5 0 016.5 2z" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" />
      </svg>
      <svg className="doodle doodle-sm doodle-7" viewBox="0 0 24 24">
        <path d="M9 21h6m-5.25-3h4.5M12 3a7 7 0 00-6.9 8.2c.5 2.5 2 4.6 3.9 5.8h6c1.9-1.2 3.4-3.3 3.9-5.8A7 7 0 0012 3z" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg className="doodle doodle-lg doodle-8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="var(--mint)" stroke="var(--line)" strokeWidth="2" />
        <circle cx="8" cy="10" r="1.5" fill="var(--line)" />
        <circle cx="16" cy="10" r="1.5" fill="var(--line)" />
        <path d="M8 15a4 4 0 008 0" fill="none" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="doodle doodle-lg doodle-9" viewBox="0 0 24 24">
        <path d="M3 3v18h18" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M18.5 7.5L12 14l-4-4-5 5" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14 7.5h4.5V12" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="6" y="14" width="2" height="4" rx="0.5" fill="var(--mint)" stroke="var(--line)" strokeWidth="1.5" />
        <rect x="11" y="10" width="2" height="8" rx="0.5" fill="var(--butter)" stroke="var(--line)" strokeWidth="1.5" />
        <rect x="16" y="6" width="2" height="12" rx="0.5" fill="var(--rose)" stroke="var(--line)" strokeWidth="1.5" />
      </svg>
      <svg className="doodle doodle-md doodle-10" viewBox="0 0 24 24">
        <path d="M17 8h1a3 3 0 110 6h-1m-12-6h12v7a4 4 0 01-4 4H9a4 4 0 01-4-4V8z" fill="var(--peach)" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 2v3M12 2v3M15 2v3" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <svg className="doodle doodle-md doodle-11" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--sky-deep)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M6 10v6c0 2.2 2.7 4 6 4s6-1.8 6-4v-6" fill="var(--sky)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 7v6" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="doodle doodle-sm doodle-12" viewBox="0 0 24 24">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zm6 11l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z" fill="var(--butter-deep)" stroke="var(--line)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function OnboardingOptionCard({ option, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={`onboarding-option tap ${isSelected ? 'is-selected' : ''}`}
      onClick={() => onSelect(option)}
    >
      <span className="onboarding-option-icon">{option.icon}</span>
      <span>
        <strong>{option.label}</strong>
        <small>{option.tone}</small>
      </span>
    </button>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => getOnboardingLang());
  const [draft, setDraft] = useState(() => getOnboardingDraft());
  const [stepIndex, setStepIndex] = useState(() => normalizeOnboardingStep(getOnboardingDraft()));
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [customGoalLabel, setCustomGoalLabel] = useState('');
  const [remoteAiSummary, setRemoteAiSummary] = useState(null);
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const progress = Math.round(((stepIndex + 1) / ONBOARDING_TOTAL_STEPS) * 100);
  const onboardingText = getOnboardingText(lang);
  const industryOptions = useMemo(() => getIndustryOptions(lang), [lang]);
  const goalOptions = useMemo(() => getGoalOptions(lang), [lang]);
  const experienceOptions = useMemo(() => getExperienceOptions(lang), [lang]);
  const localizedDraft = useMemo(() => getLocalizedOnboardingDraft(draft, lang), [draft, lang]);
  const fallbackAiSummary = useMemo(
    () => buildOnboardingAiSummary(localizedDraft, '', lang),
    [localizedDraft, lang],
  );
  const editedAiSummary = useMemo(
    () => buildOnboardingAiSummary(localizedDraft, customGoalLabel.trim(), lang),
    [customGoalLabel, lang, localizedDraft],
  );
  const aiSummary = isEditingGoal && customGoalLabel.trim() ? editedAiSummary : remoteAiSummary;
  const isAiSummaryPending = stepIndex === 4 && (isAiSummaryLoading || !remoteAiSummary);
  const roleOptions = useMemo(() => getRoleOptions(draft.industry, lang), [draft.industry, lang]);

  useEffect(() => {
    const syncLang = () => setLang(getOnboardingLang());
    window.addEventListener('storage', syncLang);
    window.addEventListener('focus', syncLang);

    return () => {
      window.removeEventListener('storage', syncLang);
      window.removeEventListener('focus', syncLang);
    };
  }, []);

  useEffect(() => {
    const user = getMockUser();

    if (!hasMockSession() || !user) {
      navigate('/signup', { replace: true });
      return;
    }

    if (hasCompletedOnboarding(user)) {
      navigate('/home', { replace: true });
      return;
    }

    const savedDraft = getOnboardingDraft();
    const normalizedStep = normalizeOnboardingStep(savedDraft);
    setDraft(savedDraft);
    setStepIndex(normalizedStep);
  }, [navigate]);

  const persistDraft = useCallback((nextDraft) => {
    const normalizedStep = normalizeOnboardingStep(nextDraft);
    const draftToSave = {
      ...nextDraft,
      currentStep: normalizedStep,
    };

    setDraft(draftToSave);
    setStepIndex(normalizedStep);
    saveOnboardingDraft(draftToSave);
  }, []);

  useEffect(() => {
    if (stepIndex !== 4) {
      return undefined;
    }

    let isActive = true;
    const timer = window.setTimeout(async () => {
      setRemoteAiSummary(null);
      setIsAiSummaryLoading(true);
      try {
        const token = await getSessionToken();
        const payload = await apiRequest('/api/onboarding/ai-summary', {
          token,
          demoUser: token ? null : DEMO_ADMIN_ID,
          method: 'POST',
          body: {
            role: draft.role,
            roleLabel: localizedDraft.roleLabel,
            industry: draft.industry,
            industryLabel: localizedDraft.industryLabel,
            teamSize: getMockUser()?.role === 'solo' ? 'solo' : 'team',
            goal: draft.goal,
            goalLabel: localizedDraft.goalLabel,
            experience: draft.experience,
            experienceLabel: localizedDraft.experienceLabel,
            customGoal: '',
            language: lang,
          },
        });
        if (isActive) {
          setRemoteAiSummary(payload);
        }
      } catch {
        if (isActive) {
          setRemoteAiSummary(fallbackAiSummary);
        }
      } finally {
        if (isActive) {
          setIsAiSummaryLoading(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [
    draft.experience,
    draft.goal,
    draft.industry,
    draft.role,
    fallbackAiSummary,
    lang,
    localizedDraft.experienceLabel,
    localizedDraft.goalLabel,
    localizedDraft.industryLabel,
    localizedDraft.roleLabel,
    stepIndex,
  ]);

  const selectIndustry = (option) => {
    persistDraft({
      ...draft,
      industry: option.id,
      industryLabel: option.label,
      role: null,
      roleLabel: '',
      currentStep: 1,
    });
  };

  const selectRole = (option) => {
    persistDraft({
      ...draft,
      role: option.id,
      roleLabel: option.label,
      currentStep: 2,
    });
  };

  const selectGoal = (option) => {
    persistDraft({
      ...draft,
      goal: option.id,
      goalLabel: option.label,
      currentStep: 3,
    });
  };

  const selectExperience = (option) => {
    persistDraft({
      ...draft,
      experience: option.id,
      experienceLabel: option.label,
      currentStep: 4,
    });
  };

  const skipGoal = () => {
    selectGoal({
      id: 'not-now',
      icon: '⏭️',
      label: onboardingText.onboardingSkip,
      tone: onboardingText.onboardingSkipGoalTone,
    });
  };

  const skipExperience = () => {
    selectExperience({
      id: 'not-now',
      icon: '⏭️',
      label: onboardingText.onboardingSkip,
      tone: onboardingText.onboardingSkipExperienceTone,
    });
  };

  const goBack = () => {
    const previousStep = Math.max(stepIndex - 1, 0);
    const nextDraft = {
      ...draft,
      currentStep: previousStep,
    };

    setStepIndex(previousStep);
    setDraft(nextDraft);
    saveOnboardingDraft(nextDraft);
  };

  const completeOnboarding = (goalLabelOverride = '') => {
    const user = getMockUser();
    const completedAt = new Date().toISOString();
    const firstScenarioId = mockScenarios[0]?.id;
    const unlockedScenarioIds = Array.from(new Set([...(user?.unlockedScenarioIds || []), firstScenarioId].filter(Boolean)));
    const finalGoalLabel = goalLabelOverride.trim() || localizedDraft.goalLabel || onboardingText.onboardingFirstGoal;
    const completedDraft = {
      ...draft,
      goalLabel: finalGoalLabel,
      industryLabel: localizedDraft.industryLabel,
      roleLabel: localizedDraft.roleLabel,
      experienceLabel: localizedDraft.experienceLabel,
      currentStep: 4,
      completedAt,
    };
    const memory = {
      version: 1,
      completed: true,
      completedAt,
      language: lang,
      userEmail: user?.email || '',
      userId: user?.id || '',
      draft: {
        industry: completedDraft.industry,
        industryLabel: localizedDraft.industryLabel,
        role: completedDraft.role,
        roleLabel: localizedDraft.roleLabel,
        goal: completedDraft.goal,
        goalLabel: finalGoalLabel,
        experience: completedDraft.experience,
        experienceLabel: localizedDraft.experienceLabel,
      },
      aiSummary: aiSummary || fallbackAiSummary,
      rewards: {
        xpAwarded: user?.onboardingCompleted ? 0 : 10,
        streak: Math.max(Number(user?.streak) || 0, 1),
        unlockedScenarioIds,
      },
    };

    if (user) {
      saveMockUser({
        ...user,
        xp: (Number(user.xp) || 0) + memory.rewards.xpAwarded,
        streak: memory.rewards.streak,
        level: 'Level 1',
        goal: finalGoalLabel,
        weakestSkill: 'Коммуникация',
        unlockedScenarioIds,
        onboardingRequired: false,
        onboardingCompleted: true,
        onboarding: completedDraft,
        onboardingAiSummary: aiSummary || fallbackAiSummary,
        updatedAt: completedAt,
      });
    }

    saveOnboardingMemory(memory);
    saveOnboardingDraft(completedDraft);
    navigate('/home', { replace: true });
  };

  const renderHeader = (eyebrow, title, subtitle) => (
    <div className="onboarding-heading">
      <span className="chip peach">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );

  const renderStep = () => {
    if (stepIndex === 0) {
      return (
        <>
          {renderHeader(onboardingText.onboardingStep1Eyebrow, onboardingText.onboardingStep1Title, onboardingText.onboardingStep1Subtitle)}
          <div className="onboarding-grid industry-grid">
            {industryOptions.map((option) => (
              <OnboardingOptionCard
                key={option.id}
                option={option}
                isSelected={draft.industry === option.id}
                onSelect={selectIndustry}
              />
            ))}
          </div>
        </>
      );
    }

    if (stepIndex === 1) {
      return (
        <>
          {renderHeader(onboardingText.onboardingStep2Eyebrow, onboardingText.onboardingStep2Title, onboardingText.onboardingStep2Subtitle)}
          <div className="onboarding-grid">
            {roleOptions.map((option) => (
              <OnboardingOptionCard
                key={option.id}
                option={option}
                isSelected={draft.role === option.id}
                onSelect={selectRole}
              />
            ))}
          </div>
        </>
      );
    }

    if (stepIndex === 2) {
      return (
        <>
          {renderHeader(onboardingText.onboardingStep3Eyebrow, onboardingText.onboardingStep3Title, onboardingText.onboardingStep3Subtitle)}
          <div className="onboarding-grid">
            {goalOptions.map((option) => (
              <OnboardingOptionCard
                key={option.id}
                option={option}
                isSelected={draft.goal === option.id}
                onSelect={selectGoal}
              />
            ))}
          </div>
          <button type="button" className="onboarding-skip" onClick={skipGoal}>
            {onboardingText.onboardingSkip}
          </button>
        </>
      );
    }

    if (stepIndex === 3) {
      return (
        <>
          {renderHeader(onboardingText.onboardingStep4Eyebrow, onboardingText.onboardingStep4Title, onboardingText.onboardingStep4Subtitle)}
          <div className="onboarding-grid">
            {experienceOptions.map((option) => (
              <OnboardingOptionCard
                key={option.id}
                option={option}
                isSelected={draft.experience === option.id}
                onSelect={selectExperience}
              />
            ))}
          </div>
          <button type="button" className="onboarding-skip" onClick={skipExperience}>
            {onboardingText.onboardingSkip}
          </button>
        </>
      );
    }

    const activeGoalLabel = customGoalLabel.trim() || localizedDraft.goalLabel;

    return (
      <>
        {renderHeader(onboardingText.onboardingStep5Eyebrow, onboardingText.onboardingStep5Title, onboardingText.onboardingStep5Subtitle)}
        <div className="onboarding-summary">
          <span className="chip sky">{localizedDraft.industryLabel || onboardingText.onboardingSummaryIndustry}</span>
          <span className="chip mint">{localizedDraft.roleLabel || onboardingText.onboardingSummaryRole}</span>
          <span className="chip butter">{activeGoalLabel || onboardingText.onboardingSummaryGoal}</span>
          <span className="chip rose">{localizedDraft.experienceLabel || onboardingText.onboardingSummaryExperience}</span>
        </div>

        <div className="onboarding-ai-card popin">
          <span className="onboarding-ai-badge">{isAiSummaryPending ? 'AI...' : 'AI'}</span>
          {isAiSummaryPending ? (
            <div className="onboarding-ai-lines onboarding-ai-skeleton" aria-label={onboardingText.onboardingAiLoading}>
              <span className="skeleton-line wide" />
              <span className="skeleton-line" />
              <span className="skeleton-line medium" />
              <span className="skeleton-line short" />
            </div>
          ) : (
            <div className="onboarding-ai-lines">
              <p>{aiSummary.roleLine}</p>
              <p>{aiSummary.goalLine}</p>
              <p>{aiSummary.targetLine}</p>
              {aiSummary.modeLine ? <p>{aiSummary.modeLine}</p> : null}
              {aiSummary.starterScenarioTitle ? <p>{onboardingText.onboardingStarterScenario}: {aiSummary.starterScenarioTitle}</p> : null}
            </div>
          )}

          {isEditingGoal ? (
            <div className="onboarding-goal-edit">
              <label className="form-label" htmlFor="onboarding-goal-edit">
                {onboardingText.onboardingEditGoalLabel}
              </label>
              <input
                id="onboarding-goal-edit"
                type="text"
                className="form-input"
                value={customGoalLabel}
                onChange={(event) => setCustomGoalLabel(event.target.value)}
                placeholder={onboardingText.onboardingEditGoalPlaceholder}
              />
              <button
                type="button"
                className="btn-plush primary"
                onClick={() => completeOnboarding(customGoalLabel)}
                disabled={!customGoalLabel.trim() || isAiSummaryPending}
              >
                {onboardingText.onboardingSaveGoal}
              </button>
            </div>
          ) : (
            <div className="onboarding-ai-actions">
              <button type="button" className="btn-plush primary" onClick={() => completeOnboarding()} disabled={isAiSummaryPending}>
                {onboardingText.onboardingConfirm}
              </button>
              <button
                type="button"
                className="btn-plush"
                onClick={() => {
                  setCustomGoalLabel(draft.goalLabel || '');
                  setIsEditingGoal(true);
                }}
              >
                {onboardingText.onboardingEditGoal}
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <main className="product-app dots-bg onboarding-page">
      <BackgroundDoodles />
      <section className="onboarding-shell plush-lg paper popin">
        <div className="onboarding-topbar">
          <button type="button" className="btn-plush sm" onClick={goBack} disabled={stepIndex === 0}>
            <ArrowLeft size={16} /> {onboardingText.onboardingBack}
          </button>
          <div className="onboarding-progress" aria-label={`${onboardingText.onboardingProgress} ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </div>

        {renderStep()}
      </section>
    </main>
  );
}

function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendDashboard, setIsBackendDashboard] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      const localProfile = getMockUser();

      if (!hasMockSession() || !localProfile) {
        navigate('/signin', { replace: true });
        return;
      }

      try {
        const token = await getSessionToken();
        if (!token) {
          throw new Error('No active Supabase session.');
        }

        const backendProfile = await apiRequest('/api/me', { token });
        const userProfile = mergeBackendProfileWithLocalState(backendProfile, localProfile);
        saveMockUser(userProfile);

        if (!hasCompletedOnboarding(userProfile)) {
          navigate('/onboarding', { replace: true });
          return;
        }

        const dashboardPath = userProfile.role === 'admin' ? '/api/admin/dashboard' : '/api/employee/dashboard';
        const dashboardPayload = await apiRequest(dashboardPath, { token });

        if (isActive) {
          setProfile(userProfile);
          setDashboard(dashboardPayload);
          setIsBackendDashboard(true);
          setError('');
          setIsLoading(false);
        }
      } catch (loadError) {
        if (!hasCompletedOnboarding(localProfile)) {
          navigate('/onboarding', { replace: true });
          return;
        }

        if (isActive) {
          setProfile(localProfile);
          setDashboard(buildMockDashboard(localProfile));
          setIsBackendDashboard(false);
          setError(loadError?.message ? `Backend unavailable: ${loadError.message}` : '');
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
    clearMockSession();
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
              <span className="chip butter">{profile.xp || 0} XP</span>
            </div>
          ) : null}
          <button type="button" className="btn-plush sm" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-shell plush-lg paper popin">
        <div className="preview-heading">
          <span className={`chip ${isBackendDashboard ? 'mint' : 'peach'}`}>
            {isBackendDashboard ? 'Live backend' : 'Mock profile'}
          </span>
          <h2>{profile?.role === 'admin' ? 'Admin dashboard' : 'Employee dashboard'}</h2>
          {profile?.onboarding ? (
            <div className="summary-chips">
              <span className="chip sky">{profile.onboarding.industryLabel || profile.onboarding.industry}</span>
              <span className="chip mint">{profile.goal || profile.onboarding.goalLabel}</span>
              {profile.onboardingAiSummary?.starterScenarioTitle ? (
                <span className="chip butter">{profile.onboardingAiSummary.starterScenarioTitle}</span>
              ) : null}
            </div>
          ) : null}
          <p>
            {isBackendDashboard
              ? 'Данные загружены через FastAPI и Supabase. Онбординг остаётся сохранённым в профиле демо-сессии.'
              : 'Данные собраны локально после онбординга. Первый сценарий открыт, а награда уже в профиле.'}
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

function SimulationPage() {
  const navigate = useNavigate();
  return <SimulationScene onBackToDashboard={() => navigate('/home', { replace: true })} />;
}

function RootRedirect() {
  const user = getMockUser();
  if (hasMockSession() && user) {
    return <Navigate to={hasCompletedOnboarding(user) ? '/home' : '/onboarding'} replace />;
  }
  return <Navigate to="/signin" replace />;
}

function TrainerSessionGate() {
  const user = getMockUser();
  if (!hasMockSession() || !user) {
    return <Navigate to="/signin" replace />;
  }
  if (!hasCompletedOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }
  return <CommTrainerExperience />;
}

function SimulationGate() {
  const user = getMockUser();
  if (!hasMockSession() || !user) {
    return <Navigate to="/signin" replace />;
  }
  if (!hasCompletedOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }
  return <SimulationPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/signin" element={<LoginPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />
        <Route path="/simulation" element={<SimulationGate />} />
        <Route path="*" element={<TrainerSessionGate />} />
      </Routes>
    </BrowserRouter>
  );
}
