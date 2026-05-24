import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls, useGLTF } from '@react-three/drei';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  Gift,
  Languages,
  LogOut,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
  Users,
  UploadCloud,
  Wifi,
  WifiOff,
} from 'lucide-react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { apiFormRequest, apiRequest, getSessionToken, supabase } from './backendApi.js';
import { BackgroundMusic, CommTrainerExperience, TrainerFloatingDecor } from './CommTrainerApp.jsx';
import {
  getEmotionAdjustments,
  getEmotionStatus,
  getSpeechBubbleText,
  getLiveMotionAdjustments,
  LIVE_MOTION_MODES,
} from './LiveMotion.jsx';
import { QUICK_CASE_IDS } from './quickPractice.js';
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
const APP_LANGUAGES = [
  { code: 'ru', label: 'RU' },
  { code: 'uz', label: 'UZ' },
  { code: 'en', label: 'EN' },
];
const DEFAULT_MATERIAL = `Enterprise customers ask about security, procurement, implementation value, contract guarantees, and operational savings.

Sales reps must acknowledge the customer's concern, connect the answer to approved policy, explain the next step, and avoid unsupported savings promises.`;

const CORPORATE_INDUSTRY_CHOICES = [
  { id: 'business', label: 'Бизнес', icon: '💼' },
  { id: 'medicine', label: 'Медицина', icon: '🏥' },
  { id: 'education', label: 'Образование', icon: '🎓' },
  { id: 'finance', label: 'Финансы', icon: '💳' },
  { id: 'hospitality', label: 'Сервис', icon: '🏨' },
];

const CORPORATE_RULE_SCENES = [
  {
    id: 'refund-policy',
    title: 'Возврат по правилам компании',
    rule: 'Сначала признать эмоцию клиента, затем назвать срок проверки и не обещать компенсацию без подтверждения.',
    scene: 'Клиент требует немедленный возврат после истечения гарантийного окна.',
    success: 'Сотрудник сохраняет тон, объясняет процесс и фиксирует следующий шаг.',
  },
  {
    id: 'security-objection',
    title: 'Возражение по безопасности',
    rule: 'Использовать только утвержденные формулировки по хранению данных и переводить разговор к compliance-документам.',
    scene: 'Корпоративный клиент просит устную гарантию, которой нет в договоре.',
    success: 'Сотрудник не придумывает обещания и уверенно предлагает официальный пакет документов.',
  },
  {
    id: 'angry-vip',
    title: 'Разговор с раздраженным VIP-клиентом',
    rule: 'Не спорить, не перебивать, собрать факты и предложить один понятный путь эскалации.',
    scene: 'Постоянный клиент угрожает уйти к конкурентам из-за задержки сервиса.',
    success: 'Сотрудник снижает напряжение и переводит диалог в управляемый план.',
  },
];

const EMPLOYEE_SKILL_PROFILES = [
  {
    id: 'lena',
    name: 'Лена',
    role: 'Support lead',
    score: 86,
    growth: '+12%',
    forecast: 'Готова вести сложные обращения и обучать новичков через 3 недели.',
    nextAbility: 'Доводить конфликт до согласованного плана без помощи руководителя.',
    skills: [
      { label: 'Эмпатия', value: 91 },
      { label: 'Правила компании', value: 84 },
      { label: 'Структура ответа', value: 79 },
    ],
  },
  {
    id: 'noah',
    name: 'Ной',
    role: 'Sales rep',
    score: 74,
    growth: '+7%',
    forecast: 'Через 5 тренировок сможет закрывать типовые security-возражения.',
    nextAbility: 'Связывать ценность продукта с политиками без неподтвержденных обещаний.',
    skills: [
      { label: 'Возражения', value: 76 },
      { label: 'Факты продукта', value: 71 },
      { label: 'Следующий шаг', value: 82 },
    ],
  },
  {
    id: 'ivy',
    name: 'Айви',
    role: 'Client manager',
    score: 68,
    growth: '+4%',
    forecast: 'Нужна практика эскалации: высокий риск потерять темп в конфликте.',
    nextAbility: 'Быстро отделять эмоции клиента от операционной проблемы.',
    skills: [
      { label: 'Спокойствие', value: 64 },
      { label: 'Эскалация', value: 70 },
      { label: 'Точность', value: 73 },
    ],
  },
];

const EMPLOYEE_COMPANY_TASKS = [
  {
    id: 'task-refund',
    title: 'Отработать возврат по политике',
    source: 'Назначено админом',
    due: 'Сегодня',
    requiredScore: 80,
    scenario: CORPORATE_RULE_SCENES[0],
  },
  {
    id: 'task-security',
    title: 'Security objection drill',
    source: 'Правила отдела продаж',
    due: 'До пятницы',
    requiredScore: 75,
    scenario: CORPORATE_RULE_SCENES[1],
  },
];

const ADMIN_SOURCE_DOCUMENTS = [
  { id: 'doc-policy', name: 'Правила компании.pdf', type: 'Регламенты', status: 'Разобран' },
  { id: 'doc-product', name: 'Суть продукта.docx', type: 'О компании', status: 'Разобран' },
  { id: 'doc-ai', name: 'AI playbook.md', type: 'ИИ-стандарты', status: 'Разобран' },
];

const ADMIN_GENERATED_TASKS = [
  {
    id: 'enterprise-objection',
    title: 'Enterprise-клиент сомневается в ИИ',
    clientType: 'B2B enterprise',
    skill: 'Аргументация ценности',
    difficulty: 'Средне',
    status: 'Готово к отправке',
  },
  {
    id: 'policy-conflict',
    title: 'Клиент просит нарушить регламент',
    clientType: 'VIP / сложный',
    skill: 'Следование правилам',
    difficulty: 'Сложно',
    status: 'Назначено',
  },
  {
    id: 'support-ai-answer',
    title: 'Объяснить, как ИИ помогает без риска',
    clientType: 'Новый клиент',
    skill: 'Простое объяснение',
    difficulty: 'Легко',
    status: 'Черновик',
  },
];

const ADMIN_EMPLOYEE_RESULTS = [
  {
    id: 'lena',
    name: 'Лена',
    role: 'Support lead',
    result: 92,
    solved: 'Решила',
    improved: 'Тон и структура ответа',
    trained: 'Политики компании',
    fileAccuracy: 96,
    usefulness: 91,
    character: 'Спокойная, быстро берет ответственность, хорошо держит клиента в сложном тоне.',
    fileBehavior: 'Отвечает по файлам точно, не придумывает лишних обещаний, ссылается на правила компании.',
    strengths: ['Эмпатия', 'Контроль тона', 'Точное следование регламенту'],
    skills: [
      { label: 'Правила', value: 94 },
      { label: 'Эмпатия', value: 89 },
      { label: 'ИИ-ценность', value: 86 },
    ],
  },
  {
    id: 'noah',
    name: 'Ной',
    role: 'Sales rep',
    result: 78,
    solved: 'Нужна 1 попытка',
    improved: 'Работа с возражениями',
    trained: 'Типы клиентов',
    fileAccuracy: 82,
    usefulness: 77,
    character: 'Активный продавец, иногда торопится закрыть сделку раньше, чем уточнит риск клиента.',
    fileBehavior: 'В целом отвечает по материалам, но иногда упрощает security-часть и требует подсказки.',
    strengths: ['Возражения', 'Темп диалога', 'Переход к следующему шагу'],
    skills: [
      { label: 'Возражения', value: 80 },
      { label: 'Факты', value: 74 },
      { label: 'Закрытие', value: 77 },
    ],
  },
  {
    id: 'ivy',
    name: 'Айви',
    role: 'Client manager',
    result: 64,
    solved: 'Не решила',
    improved: 'Эскалация',
    trained: 'Сложные клиенты',
    fileAccuracy: 69,
    usefulness: 62,
    character: 'Внимательная, но теряет структуру, когда клиент давит или требует исключение из правил.',
    fileBehavior: 'Читает документы правильно, но в ответах пропускает ограничения и следующий шаг.',
    strengths: ['Сбор фактов', 'Аккуратность', 'Готовность учиться'],
    skills: [
      { label: 'Спокойствие', value: 69 },
      { label: 'Эскалация', value: 61 },
      { label: 'Точность', value: 66 },
    ],
  },
];

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

const DEFAULT_SCENE_PROPS = {
  chaise: [
    { id: 'chaise-rug', type: 'roundRug', label: 'Ковер', x: 1.97, y: -1.17, z: 3.36, scale: 1.38, rotationY: -18 },
    { id: 'chaise-table', type: 'lowTable', label: 'Столик', x: 3.3, y: -1.15, z: 3.52, scale: 1.87, rotationY: -14 },
    { id: 'chaise-books', type: 'bookStack', label: 'Стопка книг', x: 3.06, y: -0.65, z: 3.59, scale: 1.32, rotationY: 7 },
    { id: 'chaise-sax', type: 'saxophone', label: 'Саксофон', x: -1.27, y: -5, z: 4.53, scale: 1.5, rotationY: -24 },
    { id: 'chaise-dvd', type: 'dvdStack', label: 'DVD', x: -1.45, y: -1.15, z: 1.67, scale: 1.72, rotationY: 16 },
    { id: 'chaise-magazines', type: 'magazines', label: 'Журналы', x: 0.51, y: -1.2, z: 2.77, scale: 1.48, rotationY: -8 },
    { id: 'chaise-records', type: 'vinylCrate', label: 'Пластинки', x: 3.33, y: -1.16, z: 0.28, scale: 1.06, rotationY: -34 },
    { id: 'chaise-speaker', type: 'speaker', label: 'Колонка', x: -3.04, y: -1.16, z: 1.98, scale: 2.76, rotationY: 67 },
    { id: 'chaise-floor-lamp', type: 'floorLamp', label: 'Торшер', x: 2.7, y: -1.19, z: -0.32, scale: 0.93, rotationY: 24 },
    { id: 'chaise-pillow', type: 'pillow', label: 'Подушка', x: 1.59, y: -0.97, z: 3.99, scale: 1.77, rotationY: 12 },
    { id: 'chaise-cup', type: 'coffeeCup', label: 'Чашка', x: 3.66, y: -0.67, z: 3.64, scale: 1.31, rotationY: 0 },
  ],
  standing: [
    { id: 'standing-ground', type: 'grassGround', label: 'Земля', x: 0, y: -1.175, z: 0, scale: 20, rotationY: 0 },
    { id: 'standing-path', type: 'curvedPath', label: 'Тропинка', x: 0.08, y: -1.165, z: 0.1, scale: 1.71, rotationY: -4 },
    { id: 'standing-forest', type: 'forest', label: 'Лес', x: 0, y: -1.16, z: 0, scale: 17.37, rotationY: 0 },
    { id: 'standing-birds', type: 'birdFlock', label: 'Птички сверху', x: 0.2, y: 3.88, z: -1.35, scale: 1, rotationY: -8 },
    { id: 'standing-city', type: 'cityBackdrop', label: 'Город сзади', x: 0.1, y: -1.16, z: -40, scale: 20, rotationY: 0 },
    { id: 'standing-bench', type: 'parkBench', label: 'Лавка', x: -1.92, y: -1.16, z: 1.1, scale: 2.44, rotationY: -122 },
  ],
  desk: [
    { id: 'desk-office-room', type: 'officeRoom', label: 'Офисная комната', x: 0, y: -1.18, z: 0, scale: 3.12, rotationY: -44 },
    { id: 'desk-shelf', type: 'bookShelf', label: 'Полка', x: 0.92, y: 2.68, z: -10, scale: 1.05, rotationY: 138 },
    { id: 'desk-board', type: 'whiteboard', label: 'План на доске', x: -6, y: 0.23, z: -4.78, scale: 2.13, rotationY: 31 },
    { id: 'desk-books', type: 'bookStack', label: 'Книги на столе', x: 5.78, y: 0.2, z: -2.9, scale: 1.63, rotationY: 16 },
    { id: 'desk-dvd', type: 'dvdStack', label: 'Диски/кейсы', x: 3.55, y: -1.2, z: 0.34, scale: 1.81, rotationY: -10 },
    { id: 'desk-magazines', type: 'magazines', label: 'Журналы', x: -0.64, y: 0.38, z: 0.47, scale: 1.16, rotationY: -18 },
    { id: 'desk-plant', type: 'deskPlant', label: 'Растение', x: 4.89, y: 0.3, z: -2.63, scale: 2.27, rotationY: 0 },
    { id: 'desk-file-cabinet', type: 'fileCabinet', label: 'Тумба', x: 5.34, y: -1.16, z: -2.8, scale: 1.81, rotationY: -37 },
    { id: 'desk-office-lamp', type: 'floorLamp', label: 'Офисный свет', x: 1.09, y: -1.16, z: 0.95, scale: 1.18, rotationY: 18 },
  ],
};

function LowTableProp() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.07, 0.62]} />
        <meshStandardMaterial color="#9a7557" roughness={0.82} />
      </mesh>
      {[
        [-0.4, 0.09, -0.23],
        [0.4, 0.09, -0.23],
        [-0.4, 0.09, 0.23],
        [0.4, 0.09, 0.23],
      ].map((leg, index) => (
        <mesh key={index} position={leg} castShadow receiveShadow>
          <boxGeometry args={[0.055, 0.2, 0.055]} />
          <meshStandardMaterial color="#765940" roughness={0.86} />
        </mesh>
      ))}
    </group>
  );
}

function BookStackProp() {
  const books = [
    [0, 0.025, 0, 0.44, 0.05, 0.31, '#bf5f53'],
    [0.015, 0.08, -0.01, 0.39, 0.055, 0.29, '#456f8f'],
    [-0.02, 0.137, 0.012, 0.42, 0.052, 0.28, '#d8ab4f'],
    [0.02, 0.19, -0.005, 0.36, 0.05, 0.26, '#6f8b5a'],
  ];

  return (
    <group>
      {books.map(([x, y, z, width, height, depth, color], index) => (
        <mesh key={index} position={[x, y, z]} rotation={[0, THREE.MathUtils.degToRad(index % 2 ? -5 : 4), 0]} castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

function DvdStackProp() {
  return (
    <group>
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[0, 0.015 + index * 0.035, 0]} rotation={[0, THREE.MathUtils.degToRad(index * 7), 0]} castShadow receiveShadow>
          <boxGeometry args={[0.36, 0.03, 0.36]} />
          <meshStandardMaterial color={index === 1 ? '#d8d3c6' : '#252b31'} roughness={0.62} metalness={0.08} />
        </mesh>
      ))}
      <mesh position={[0.02, 0.12, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.085, 0.15, 36]} />
        <meshStandardMaterial color="#bac3c8" roughness={0.42} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function MagazinesProp() {
  const pages = [
    [-0.08, 0.018, -0.02, -9, '#f0e7d4'],
    [0.04, 0.036, 0.01, 4, '#c95f58'],
    [0.13, 0.054, 0.025, 12, '#6789a8'],
  ];

  return (
    <group>
      {pages.map(([x, y, z, angle, color], index) => (
        <mesh key={index} position={[x, y, z]} rotation={[-Math.PI / 2, 0, THREE.MathUtils.degToRad(angle)]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.31, 0.018]} />
          <meshStandardMaterial color={color} roughness={0.86} />
        </mesh>
      ))}
      {[-0.05, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.066, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.28, 0.012]} />
          <meshStandardMaterial color="#6f7f85" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function SaxophoneProp() {
  return (
    <group rotation={[0, 0, THREE.MathUtils.degToRad(-14)]}>
      <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.18, 0.035, 12, 36, Math.PI * 1.45]} />
        <meshStandardMaterial color="#c7953d" roughness={0.34} metalness={0.62} />
      </mesh>
      <mesh position={[0.18, 0.12, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(-28)]} castShadow receiveShadow>
        <cylinderGeometry args={[0.034, 0.04, 0.42, 18]} />
        <meshStandardMaterial color="#c7953d" roughness={0.34} metalness={0.62} />
      </mesh>
      <mesh position={[0.33, 0.22, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(-28)]} castShadow receiveShadow>
        <coneGeometry args={[0.13, 0.18, 26, 1, true]} />
        <meshStandardMaterial color="#d5a64f" roughness={0.32} metalness={0.65} side={THREE.DoubleSide} />
      </mesh>
      {[0.06, 0.15, 0.24].map((x) => (
        <mesh key={x} position={[x, 0.23, 0.034]} castShadow receiveShadow>
          <sphereGeometry args={[0.028, 14, 8]} />
          <meshStandardMaterial color="#f1d16b" roughness={0.3} metalness={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function WhiteboardProp() {
  return (
    <group>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.82, 0.045]} />
        <meshStandardMaterial color="#eef1ed" roughness={0.42} metalness={0.03} />
      </mesh>
      <mesh position={[0, 1.285, 0.03]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.06, 0.07]} />
        <meshStandardMaterial color="#52606a" roughness={0.5} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.355, 0.03]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.06, 0.07]} />
        <meshStandardMaterial color="#52606a" roughness={0.5} metalness={0.12} />
      </mesh>
      {[-0.84, 0.84].map((x) => (
        <mesh key={x} position={[x, 0.82, 0.03]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.94, 0.07]} />
          <meshStandardMaterial color="#52606a" roughness={0.5} metalness={0.12} />
        </mesh>
      ))}
      {[-0.42, 0.05, 0.38].map((x, index) => (
        <mesh key={x} position={[x, 0.78 + index * 0.1, 0.055]} rotation={[0, 0, THREE.MathUtils.degToRad(index % 2 ? -6 : 7)]}>
          <boxGeometry args={[0.42, 0.018, 0.012]} />
          <meshStandardMaterial color={index === 1 ? '#6e8fa9' : '#dd735f'} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function MarkerStandProp() {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.84, 12]} />
        <meshStandardMaterial color="#5b6570" roughness={0.64} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.54, 0.26, 0.035]} />
        <meshStandardMaterial color="#d18959" roughness={0.7} />
      </mesh>
    </group>
  );
}

function BookShelfProp() {
  const books = [
    [-0.42, 0.34, '#d15f55'],
    [-0.28, 0.31, '#457f9f'],
    [-0.12, 0.38, '#e1b65d'],
    [0.05, 0.29, '#6b8f62'],
    [0.22, 0.36, '#936ca7'],
    [0.38, 0.32, '#c88755'],
  ];

  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 1.1, 0.16]} />
        <meshStandardMaterial color="#7f6048" roughness={0.82} />
      </mesh>
      {[0.24, 0.55, 0.86].map((y) => (
        <mesh key={y} position={[0, y, -0.09]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 0.055, 0.24]} />
          <meshStandardMaterial color="#604836" roughness={0.84} />
        </mesh>
      ))}
      {books.map(([x, height, color], index) => (
        <mesh key={index} position={[x, 0.21 + height / 2, -0.21]} castShadow receiveShadow>
          <boxGeometry args={[0.1, height, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

function DeskPlantProp() {
  return (
    <group>
      <Cactus position={[0, 0, 0]} />
    </group>
  );
}

function RoundRugProp() {
  return (
    <group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial color="#96746e" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.75, 48]} />
        <meshStandardMaterial color="#e1cfad" roughness={0.96} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function FloorLampProp() {
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.04, 28]} />
        <meshStandardMaterial color="#5a5147" roughness={0.62} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.025, 0.032, 1.16, 16]} />
        <meshStandardMaterial color="#5a5147" roughness={0.48} metalness={0.25} />
      </mesh>
      <mesh position={[0, 1.22, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.34, 0.36, 28, 1, true]} />
        <meshStandardMaterial color="#f0d9a2" roughness={0.78} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 1.08, 0]} intensity={0.55} distance={3.2} color="#ffdba2" />
    </group>
  );
}

function PillowProp() {
  return (
    <mesh rotation={[THREE.MathUtils.degToRad(8), 0, THREE.MathUtils.degToRad(-4)]} castShadow receiveShadow>
      <boxGeometry args={[0.52, 0.16, 0.38]} />
      <meshStandardMaterial color="#d8aa94" roughness={0.9} />
    </mesh>
  );
}

function CoffeeCupProp() {
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.07, 0.14, 24]} />
        <meshStandardMaterial color="#fff5df" roughness={0.62} />
      </mesh>
      <mesh position={[0.09, 0.075, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.055, 0.012, 8, 18, Math.PI * 1.45]} />
        <meshStandardMaterial color="#fff5df" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.064, 24]} />
        <meshStandardMaterial color="#4a2d22" roughness={0.7} />
      </mesh>
    </group>
  );
}

function VinylCrateProp() {
  const records = [-0.18, -0.1, -0.02, 0.06, 0.14, 0.22];

  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.64, 0.32, 0.34]} />
        <meshStandardMaterial color="#8a6549" roughness={0.82} transparent opacity={0.86} />
      </mesh>
      {records.map((x, index) => (
        <mesh key={x} position={[x, 0.28, 0]} rotation={[0, THREE.MathUtils.degToRad(index % 2 ? -3 : 4), 0]} castShadow receiveShadow>
          <boxGeometry args={[0.035, 0.42, 0.31]} />
          <meshStandardMaterial color={index % 2 ? '#293441' : '#d7c9a8'} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function SpeakerProp() {
  return (
    <group>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.68, 0.32]} />
        <meshStandardMaterial color="#24282c" roughness={0.62} />
      </mesh>
      {[0.18, 0.46].map((y, index) => (
        <mesh key={y} position={[0, y, 0.17]} castShadow receiveShadow>
          <cylinderGeometry args={[index ? 0.13 : 0.09, index ? 0.13 : 0.09, 0.025, 28]} />
          <meshStandardMaterial color="#48515a" roughness={0.58} metalness={0.14} />
        </mesh>
      ))}
    </group>
  );
}

function GrassGroundProp() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#6f8b55" roughness={0.96} />
      </mesh>
      {[-5.5, -3.2, -1.2, 1.8, 4.7].map((x, index) => (
        <mesh key={x} position={[x, 0.012, -2.6 + index * 0.36]} rotation={[-Math.PI / 2, 0, THREE.MathUtils.degToRad(index * 18)]}>
          <planeGeometry args={[0.7, 0.035]} />
          <meshStandardMaterial color="#78965e" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function CurvedPathProp() {
  return (
    <group>
      {[
        [0, 0, 0, 1.3, 0.55, 0],
        [-0.22, 0.01, -0.9, 1.08, 0.5, -10],
        [0.28, 0.02, -1.75, 0.9, 0.45, 12],
        [-0.32, 0.03, 0.92, 1.12, 0.5, 14],
        [0.42, 0.04, -2.55, 0.72, 0.36, -8],
        [-0.08, 0.05, -3.18, 0.58, 0.32, 10],
        [0.18, 0.06, 1.72, 0.98, 0.46, -8],
        [-0.22, 0.07, 2.42, 0.74, 0.38, 12],
      ].map(([x, y, z, width, depth, angle], index) => (
        <mesh key={index} position={[x, y, z]} rotation={[-Math.PI / 2, 0, THREE.MathUtils.degToRad(angle)]} receiveShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#c1a87d" roughness={0.98} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function CityBackdropProp() {
  const buildings = [
    [-3.1, 0.62, 0, 0.62, 1.24, '#a9b2b6'],
    [-2.35, 0.82, 0, 0.5, 1.64, '#8998a0'],
    [-1.72, 0.54, 0, 0.64, 1.08, '#b8b0a2'],
    [-0.92, 0.94, 0, 0.58, 1.88, '#7f9199'],
    [-0.2, 0.7, 0, 0.48, 1.4, '#b7a68f'],
    [0.52, 0.98, 0, 0.7, 1.96, '#8ea0a8'],
    [1.36, 0.62, 0, 0.52, 1.24, '#a8a093'],
    [2.1, 0.82, 0, 0.62, 1.64, '#9aa8ad'],
    [2.92, 0.56, 0, 0.58, 1.12, '#b9b4a7'],
  ];

  return (
    <group>
      <mesh position={[0, 0.42, -0.08]} receiveShadow>
        <boxGeometry args={[7.2, 0.08, 0.16]} />
        <meshStandardMaterial color="#7e806f" roughness={0.9} />
      </mesh>
      {buildings.map(([x, y, z, width, height, color], index) => (
        <group key={index} position={[x, y, z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width, height, 0.28]} />
            <meshStandardMaterial color={color} roughness={0.82} />
          </mesh>
          {[-0.16, 0.16].map((windowX) =>
            [0.18, 0.48, 0.78].map((windowY) => (
              <mesh key={`${windowX}-${windowY}`} position={[windowX * width, windowY * height - height / 2, 0.145]}>
                <boxGeometry args={[0.08, 0.08, 0.012]} />
                <meshStandardMaterial color="#f1d68a" emissive="#8c6a2a" emissiveIntensity={0.18} roughness={0.5} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

function PineTreeProp() {
  return (
    <group>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.11, 0.68, 8]} />
        <meshStandardMaterial color="#735338" roughness={0.88} />
      </mesh>
      {[0.78, 1.08, 1.34].map((y, index) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <coneGeometry args={[0.62 - index * 0.14, 0.62, 9]} />
          <meshStandardMaterial color={index === 1 ? '#4f744b' : '#456a43'} roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

function RoundTreeProp() {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.84, 8]} />
        <meshStandardMaterial color="#76553a" roughness={0.88} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.46, 18, 12]} />
        <meshStandardMaterial color="#6f965c" roughness={0.9} />
      </mesh>
      <mesh position={[0.28, 1.04, -0.06]} castShadow receiveShadow>
        <sphereGeometry args={[0.32, 16, 10]} />
        <meshStandardMaterial color="#789f64" roughness={0.9} />
      </mesh>
    </group>
  );
}

function ForestProp() {
  const trees = [
    ['pine', -2.9, 0.65, 0.98, 12],
    ['pine', 2.78, 0.54, 0.82, -8],
    ['pine', 0.95, -2.05, 0.72, 18],
    ['pine', -4.1, -1.35, 0.68, -12],
    ['pine', 4.0, -1.12, 0.7, 20],
    ['pine', -3.8, 2.1, 1.08, 8],
    ['pine', 3.55, 1.95, 0.96, -18],
    ['pine', -4.85, 0.45, 0.82, 22],
    ['pine', 4.72, 0.32, 0.78, -24],
    ['round', -1.6, -1.92, 0.78, -16],
    ['round', -2.55, -0.35, 0.72, 12],
    ['round', 2.35, -0.48, 0.68, -14],
    ['round', -3.15, 1.2, 0.62, 8],
    ['round', 3.05, 1.12, 0.58, -10],
  ];

  return (
    <group>
      {trees.map(([kind, x, z, scale, rotationY], index) => (
        <group key={index} position={[x, 0, z]} rotation={[0, THREE.MathUtils.degToRad(rotationY), 0]} scale={scale}>
          {kind === 'pine' ? <PineTreeProp /> : <RoundTreeProp />}
        </group>
      ))}
    </group>
  );
}

function BirdFlockProp() {
  const birds = [
    [-0.8, 0.05, 0, 0],
    [-0.25, 0.22, -0.1, 12],
    [0.34, 0.06, 0.05, -8],
    [0.92, 0.28, -0.06, 16],
  ];

  return (
    <group>
      {birds.map(([x, y, z, angle], index) => (
        <group key={index} position={[x, y, z]} rotation={[0, THREE.MathUtils.degToRad(angle), 0]}>
          <mesh position={[-0.055, 0, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(20)]}>
            <boxGeometry args={[0.16, 0.018, 0.018]} />
            <meshStandardMaterial color="#252525" roughness={0.7} />
          </mesh>
          <mesh position={[0.055, 0, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(-20)]}>
            <boxGeometry args={[0.16, 0.018, 0.018]} />
            <meshStandardMaterial color="#252525" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ParkBenchProp() {
  return (
    <group>
      {[-0.18, 0.02, 0.22].map((y) => (
        <mesh key={y} position={[0, 0.42 + y, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.06, 0.09]} />
          <meshStandardMaterial color="#8a6042" roughness={0.86} />
        </mesh>
      ))}
      <mesh position={[0, 0.22, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.08, 0.32]} />
        <meshStandardMaterial color="#8a6042" roughness={0.86} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.08, -0.08]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.22, 0.35]} />
          <meshStandardMaterial color="#4d555a" roughness={0.55} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function OfficeRoomProp() {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.2, 5.2]} />
        <meshStandardMaterial color="#9a8068" roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.35, -2.55]} receiveShadow>
        <boxGeometry args={[6.1, 5, 0.08]} />
        <meshStandardMaterial color="#c7cec2" roughness={0.9} />
      </mesh>
      <mesh position={[-3.05, 1.35, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[5.1, 5, 0.08]} />
        <meshStandardMaterial color="#b8b9a7" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.08, -2.48]} castShadow receiveShadow>
        <boxGeometry args={[6.1, 0.12, 0.08]} />
        <meshStandardMaterial color="#75604d" roughness={0.78} />
      </mesh>
      <mesh position={[-2.98, 0.08, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.1, 0.12, 0.08]} />
        <meshStandardMaterial color="#75604d" roughness={0.78} />
      </mesh>
      <mesh position={[1.55, 1.25, -2.49]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.85, 0.05]} />
        <meshStandardMaterial color="#9fb6bf" roughness={0.42} metalness={0.04} />
      </mesh>
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={x} position={[1.55 + x, 1.25, -2.45]} castShadow receiveShadow>
          <boxGeometry args={[0.025, 0.92, 0.065]} />
          <meshStandardMaterial color="#6c7276" roughness={0.56} metalness={0.14} />
        </mesh>
      ))}
      <mesh position={[1.55, 1.25, -2.44]} castShadow receiveShadow>
        <boxGeometry args={[1.28, 0.025, 0.065]} />
        <meshStandardMaterial color="#6c7276" roughness={0.56} metalness={0.14} />
      </mesh>
    </group>
  );
}

function FileCabinetProp() {
  return (
    <group>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.76, 0.48]} />
        <meshStandardMaterial color="#7f8a90" roughness={0.62} metalness={0.08} />
      </mesh>
      {[0.18, 0.4, 0.62].map((y) => (
        <mesh key={y} position={[0, y, 0.245]} castShadow receiveShadow>
          <boxGeometry args={[0.48, 0.035, 0.035]} />
          <meshStandardMaterial color="#c6ccd0" roughness={0.42} metalness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function ScenePropMesh({ type }) {
  switch (type) {
    case 'roundRug':
      return <RoundRugProp />;
    case 'floorLamp':
      return <FloorLampProp />;
    case 'pillow':
      return <PillowProp />;
    case 'coffeeCup':
      return <CoffeeCupProp />;
    case 'vinylCrate':
      return <VinylCrateProp />;
    case 'speaker':
      return <SpeakerProp />;
    case 'grassGround':
      return <GrassGroundProp />;
    case 'curvedPath':
      return <CurvedPathProp />;
    case 'pineTree':
      return <PineTreeProp />;
    case 'roundTree':
      return <RoundTreeProp />;
    case 'forest':
      return <ForestProp />;
    case 'birdFlock':
      return <BirdFlockProp />;
    case 'parkBench':
      return <ParkBenchProp />;
    case 'cityBackdrop':
      return <CityBackdropProp />;
    case 'officeRoom':
      return <OfficeRoomProp />;
    case 'fileCabinet':
      return <FileCabinetProp />;
    case 'bookStack':
      return <BookStackProp />;
    case 'saxophone':
      return <SaxophoneProp />;
    case 'dvdStack':
      return <DvdStackProp />;
    case 'magazines':
      return <MagazinesProp />;
    case 'whiteboard':
      return <WhiteboardProp />;
    case 'markerStand':
      return <MarkerStandProp />;
    case 'bookShelf':
      return <BookShelfProp />;
    case 'deskPlant':
      return <DeskPlantProp />;
    case 'lowTable':
    default:
      return <LowTableProp />;
  }
}

function SceneDressing({ propsLayout }) {
  return (
    <group>
      {propsLayout.map((prop) => (
        <group
          key={prop.id}
          position={[prop.x, prop.y, prop.z]}
          rotation={[0, THREE.MathUtils.degToRad(prop.rotationY), 0]}
          scale={prop.scale}
        >
          <ScenePropMesh type={prop.type} />
        </group>
      ))}
    </group>
  );
}

const SPEECH_BUBBLE_ANCHORS = {
  chaise: { offset: [-3.65, 4.85, -0.2], distanceFactor: 5.98, className: 'chaise' },
  standing: { offset: [-0.5, 0.7, -3.39], distanceFactor: 6.82, className: 'standing' },
  desk: { offset: [-0.39, 3.47, -0.92], distanceFactor: 5.03, className: 'desk' },
};

function ModelSpeechBubble({ activeCase, modelTransform, liveMotion, emotionMode, bubbleAnchor, speechText }) {
  const text = speechText || getSpeechBubbleText(liveMotion, emotionMode);
  const anchor = bubbleAnchor || SPEECH_BUBBLE_ANCHORS[activeCase.scene] || SPEECH_BUBBLE_ANCHORS.chaise;
  const bubblePosition = [
    modelTransform.x + anchor.offset[0],
    modelTransform.y + anchor.offset[1],
    modelTransform.z + anchor.offset[2],
  ];

  return (
    <Html position={bubblePosition} center distanceFactor={anchor.distanceFactor} transform sprite occlude={false}>
      <div className={`model-speech-bubble model-speech-bubble--${anchor.className} model-speech-bubble--${emotionMode}`}>
        {text}
      </div>
    </Html>
  );
}

function CountdownTimerPanel({ secondsLeft }) {
  const safeSeconds = Math.max(0, secondsLeft);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  const value = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <aside className="scene-countdown-panel" aria-label="Scene countdown timer">
      <span>Осталось времени</span>
      <strong>{value}</strong>
    </aside>
  );
}

function AiStatePanel({ emotionMode, liveMotion }) {
  const status = getEmotionStatus(emotionMode);
  const motions = normalizeLiveMotions(liveMotion, ['idle']);
  const motionLabels = motions.map((motion) => (
    LIVE_MOTION_MODES.find((mode) => mode.id === motion)?.label || motion
  ));

  return (
    <aside className="ai-state-panel" aria-label="AI character state">
      <span>AI состояние</span>
      <strong>{status.title}</strong>
      <p>{status.summary}</p>
      <div className="ai-state-motions">
        {motionLabels.map((label) => (
          <i key={label}>{label}</i>
        ))}
      </div>
    </aside>
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
  liveMotion,
  emotionMode,
  bubbleAnchor,
  speechText,
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
          liveMotion={liveMotion}
          emotionMode={emotionMode}
          onBonesReady={onBonesReady}
        />
        <ModelSpeechBubble
          activeCase={activeCase}
          modelTransform={modelTransform}
          liveMotion={liveMotion}
          emotionMode={emotionMode}
          bubbleAnchor={bubbleAnchor}
          speechText={speechText}
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
  liveMotion,
  emotionMode,
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

  const applyCurrentPose = useCallback(
    (time = 0) => {
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

      normalizeLiveMotions(liveMotion).forEach((motionMode) => {
        const liveAdjustment = getLiveMotionAdjustments(object.name, motionMode, time);
        if (liveAdjustment) {
          object.rotation.x += liveAdjustment.x || 0;
          object.rotation.y += liveAdjustment.y || 0;
          object.rotation.z += liveAdjustment.z || 0;
        }
      });

      const emotionAdjustment = getEmotionAdjustments(object.name, emotionMode, time);
      if (emotionAdjustment) {
        object.rotation.x += emotionAdjustment.x || 0;
        object.rotation.y += emotionAdjustment.y || 0;
        object.rotation.z += emotionAdjustment.z || 0;
      }
    });
    },
    [boneRotations, emotionMode, liveMotion, model, restPoseAdjustments],
  );

  useEffect(() => {
    applyCurrentPose(0);
  }, [applyCurrentPose, resetToken]);

  useFrame(({ clock }) => {
    applyCurrentPose(clock.getElapsedTime());
  });

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
  const dx = settings.position.x - settings.target.x;
  const dz = settings.position.z - settings.target.z;
  const baseAzimuth = Math.atan2(dx, dz);
  const basePolar = Math.atan2(Math.sqrt(dx * dx + dz * dz), settings.position.y - settings.target.y);
  const azimuthSlack = THREE.MathUtils.degToRad(26);
  const polarSlack = THREE.MathUtils.degToRad(14);
  const minPolarAngle = Math.max(THREE.MathUtils.degToRad(28), basePolar - polarSlack);
  const maxPolarAngle = Math.min(THREE.MathUtils.degToRad(78), basePolar + polarSlack);

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
      rotateSpeed={0.28}
      minDistance={settings.minDistance}
      maxDistance={settings.maxDistance}
      minAzimuthAngle={baseAzimuth - azimuthSlack}
      maxAzimuthAngle={baseAzimuth + azimuthSlack}
      minPolarAngle={minPolarAngle}
      maxPolarAngle={maxPolarAngle}
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

function resolveInitialCaseId(caseId) {
  return QUICK_CASE_IDS.includes(caseId) ? caseId : 'chaise';
}

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : 'http://localhost:3001';
const LIVE_DIALOG_HISTORY_KEY = 'ilm-ai-live-dialog-history';
const ALLOWED_LIVE_MOTIONS = new Set(['starting', 'idle', 'listening', 'thinking', 'talking', 'gesture']);
const ALLOWED_EMOTION_MODES = new Set(['neutral', 'happy', 'angry', 'sad']);

function normalizeEmotionMode(emotion) {
  const value = String(emotion || '').toLowerCase();
  return ALLOWED_EMOTION_MODES.has(value) ? value : 'neutral';
}

function normalizeLiveMotions(motions, fallback = ['idle']) {
  const source = Array.isArray(motions) ? motions : [motions];
  const next = source
    .map((motion) => String(motion || '').toLowerCase())
    .filter((motion, index, list) => ALLOWED_LIVE_MOTIONS.has(motion) && list.indexOf(motion) === index)
    .slice(0, 3);
  return next.length ? next : fallback;
}

function useAudioPlayer() {
  const audioRef = useRef(null);

  const play = useCallback((base64Audio, text, lang, mime, onSpeechProgress) => {
    return new Promise((resolve) => {
      let progressTimer = null;
      let settled = false;
      const stopProgress = () => {
        if (progressTimer) {
          window.clearInterval(progressTimer);
          progressTimer = null;
        }
      };
      const done = () => {
        if (settled) return;
        settled = true;
        stopProgress();
        onSpeechProgress?.(text || '');
        clearTimeout(timer);
        resolve();
      };
      // Safety timeout: always resolve within 12s so the UI doesn't hang
      const timer = setTimeout(done, 12000);

      if (base64Audio) {
        const mimeType = mime || 'audio/mpeg';
        const audio = new Audio(`data:${mimeType};base64,${base64Audio}`);
        audioRef.current = audio;
        const updateProgress = () => {
          const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
          if (duration) {
            onSpeechProgress?.(getSpeechProgressText(text, audio.currentTime / duration));
          }
        };
        audio.onloadedmetadata = updateProgress;
        audio.ontimeupdate = updateProgress;
        audio.onended = done;
        audio.onerror = () => {
          stopProgress();
          speakFallback(text, lang, done, onSpeechProgress);
        };
        audio.play()
          .then(() => {
            const startedAt = Date.now();
            progressTimer = window.setInterval(() => {
              if (Number.isFinite(audio.duration) && audio.duration > 0) {
                updateProgress();
                return;
              }

              const estimatedDuration = estimateSpeechDuration(text);
              onSpeechProgress?.(getSpeechProgressText(text, (Date.now() - startedAt) / estimatedDuration));
            }, 120);
          })
          .catch(() => speakFallback(text, lang, done, onSpeechProgress));
      } else {
        speakFallback(text, lang, done, onSpeechProgress);
      }
    });
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  return { play, stop };
}

function estimateSpeechDuration(text) {
  const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1600, (wordCount / 2.4) * 1000);
}

function getSpeechProgressText(text, progress) {
  const safeText = String(text || '').trim();
  if (!safeText) return '';
  const ratio = Math.max(0, Math.min(1, Number(progress) || 0));
  const visibleLength = Math.max(1, Math.ceil(safeText.length * ratio));
  return safeText.slice(0, visibleLength);
}

function getSpeechBubbleWindow(text, maxLength = 112) {
  const safeText = String(text || '').replace(/\s+/g, ' ').trim();
  if (safeText.length <= maxLength) return safeText;

  const tail = safeText.slice(-maxLength);
  const firstSpace = tail.indexOf(' ');
  return `...${firstSpace > 0 ? tail.slice(firstSpace + 1) : tail}`;
}

function composeLiveDialogBrief({
  scenarioId,
  scenarioTitle,
  scenarioGoal,
  scenarioXpReward,
  scenarioCoinReward,
  dailyQuest,
  transcript,
  emotionLog,
  motionLog,
  aiBrief,
}) {
  const usedEmotions = [...new Set(emotionLog.map((item) => item.emotion).filter(Boolean))];
  const usedMotions = [...new Set(motionLog.flatMap((item) => item.motions || []).filter(Boolean))];

  return {
    id: `live-dialog-${Date.now()}`,
    scenarioId: scenarioId || 'live-dialog',
    scenarioTitle: scenarioTitle || 'Live simulation',
    scenarioGoal: scenarioGoal || '',
    scenarioXpReward: Number(scenarioXpReward) || 30,
    scenarioCoinReward: Number(scenarioCoinReward) || 6,
    dailyQuest: dailyQuest || null,
    createdAt: new Date().toISOString(),
    score: aiBrief?.score || 0,
    rating: aiBrief?.rating || 1,
    goalAchieved: Boolean(aiBrief?.goal_achieved),
    summary: aiBrief?.summary || '',
    positives: Array.isArray(aiBrief?.positives) ? aiBrief.positives : [],
    negatives: Array.isArray(aiBrief?.negatives) ? aiBrief.negatives : [],
    nextSteps: Array.isArray(aiBrief?.next_steps) ? aiBrief.next_steps : [],
    usedEmotions,
    usedMotions,
    transcript,
    emotionLog,
    motionLog,
  };
}

async function requestLiveDialogBrief({ scenarioTitle, scenarioGoal, transcript, emotionLog, motionLog, language }) {
  const resp = await fetch(`${API_BASE}/api/live-sim/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: scenarioTitle || 'Live simulation',
      goal: scenarioGoal || '',
      transcript,
      emotion_log: emotionLog,
      motion_log: motionLog,
      language: language || 'ru',
    }),
  });

  if (!resp.ok) {
    throw new Error('Could not evaluate live dialog');
  }

  return resp.json();
}

function saveLiveDialogBrief(brief) {
  if (typeof window === 'undefined' || !brief) return;
  try {
    const current = JSON.parse(window.localStorage.getItem(LIVE_DIALOG_HISTORY_KEY) || '[]');
    const next = [brief, ...(Array.isArray(current) ? current : [])].slice(0, 30);
    window.localStorage.setItem(LIVE_DIALOG_HISTORY_KEY, JSON.stringify(next));
    saveBriefToTrainerDialogs(brief);
  } catch {}
}

function getTrainerProgressStorageKey() {
  try {
    const memory = JSON.parse(window.localStorage.getItem('training_loop_onboarding_memory') || 'null');
    return memory?.userId ? `pro-communication-trainer:v1:${memory.userId}` : 'pro-communication-trainer:v1';
  } catch {
    return 'pro-communication-trainer:v1';
  }
}

function saveBriefToTrainerDialogs(brief) {
  try {
    const storageKey = getTrainerProgressStorageKey();
    const current = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    const attempts = Array.isArray(current.attempts) ? current.attempts : [];
    const rating = Math.max(1, Math.min(3, Number(brief.rating) || 1));
    const score = Number(brief.score) || 0;
    const isSolved = Boolean(brief.goalAchieved) || score >= 60 || rating >= 2;
    const scenarioId = brief.scenarioId || 'live-dialog';
    const today = new Date(brief.createdAt).toISOString().slice(0, 10);
    const dailyQuestReward = isSolved && brief.dailyQuest && current.questDoneDate !== today
      ? Number(brief.dailyQuest.reward) || 0
      : 0;
    const xpGained = isSolved
      ? Math.max(Number(brief.scenarioXpReward) || 0, Math.max(20, Math.round(score / 2))) + dailyQuestReward
      : 0;
    const coinsGained = isSolved ? Math.max(Number(brief.scenarioCoinReward) || 0, 4 + rating) : 0;
    const completed = {
      ...(current.completed || {}),
      ...(isSolved ? {
        [scenarioId]: {
          rating,
          score,
          date: today,
          attemptId: brief.id,
        },
      } : {}),
    };
    const attempt = {
      id: brief.id,
      scenarioId,
      date: new Date(brief.createdAt).toISOString().slice(0, 10),
      xpGained,
      coinsGained,
      rating,
      score,
      goalAchieved: Boolean(brief.goalAchieved),
      solved: isSolved,
      dailyQuestCompleted: Boolean(dailyQuestReward),
      skillRatings: {
        empathy: brief.negatives.some((item) => item.includes('эмпат')) ? 1 : 3,
        structure: brief.negatives.some((item) => item.includes('действием')) ? 1 : 3,
        clarity: brief.negatives.some((item) => item.includes('короткие')) ? 1 : 3,
      },
      checks: [
        { label: 'AI brief', matched: brief.positives, missing: brief.negatives },
      ],
      transcript: brief.transcript,
      brief,
    };

    window.localStorage.setItem(storageKey, JSON.stringify({
      ...current,
      xp: (Number(current.xp) || 0) + xpGained,
      coins: (Number(current.coins) || 0) + coinsGained,
      questDoneDate: dailyQuestReward ? today : current.questDoneDate,
      completed,
      attempts: [attempt, ...attempts.filter((item) => item.id !== brief.id)].slice(0, 50),
    }));
  } catch {}
}

function speakFallback(text, lang, onEnd, onSpeechProgress) {
  if (!text || !window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-UZ' : 'en-US';
  utt.rate = 0.95;
  let progressTimer = null;
  let startedAt = 0;
  utt.onstart = () => {
    startedAt = Date.now();
    progressTimer = window.setInterval(() => {
      onSpeechProgress?.(getSpeechProgressText(text, (Date.now() - startedAt) / estimateSpeechDuration(text)));
    }, 120);
  };
  utt.onboundary = (event) => {
    if (typeof event.charIndex === 'number') {
      onSpeechProgress?.(text.slice(0, event.charIndex + Math.max(1, event.charLength || 1)));
    }
  };
  const finish = () => {
    if (progressTimer) window.clearInterval(progressTimer);
    onSpeechProgress?.(text);
    onEnd?.();
  };
  utt.onend = finish;
  utt.onerror = finish;
  window.speechSynthesis.speak(utt);
}

const FALLBACK_PERSONAS = {
  angry: 'Frustrated client',
  sad: 'Distressed person',
  vip: 'VIP client',
  good: 'Cooperative client',
  neutral: 'Professional client',
};

function VoiceChat({
  scenarioId,
  scenarioTitle,
  scenarioGoal,
  scenarioXpReward,
  scenarioCoinReward,
  dailyQuest,
  aiPersona,
  patientType,
  language,
  onMotionChange,
  onEmotionChange,
  onBubbleTextChange,
  onBriefReady,
  finishToken,
  onReadyChange,
}) {
  const effectivePersona = aiPersona || FALLBACK_PERSONAS[patientType] || 'Professional client';
  const [status, setStatus] = useState('idle'); // idle | loading | listening | thinking | playing
  const [messages, setMessages] = useState([]);
  const [liveText, setLiveText] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isEvaluatingBrief, setIsEvaluatingBrief] = useState(false);
  const transcriptRef = useRef([]);
  const emotionLogRef = useRef([]);
  const motionLogRef = useRef([]);
  const finishedRef = useRef(false);
  const systemPromptRef = useRef('');
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const sendMessageRef = useRef(null);
  const { play, stop } = useAudioPlayer();

  useEffect(() => {
    const ac = new AbortController();

    onReadyChange?.(false);
    setStatus('loading');
    fetch(`${API_BASE}/api/live-sim/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        title: scenarioTitle || 'Training simulation',
        goal: scenarioGoal || '',
        ai_persona: effectivePersona,
        patient_type: patientType || 'neutral',
        language: language || 'en',
      }),
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (ac.signal.aborted) return;
        const sp = data.systemPrompt || data.system_prompt || '';
        setSystemPrompt(sp);
        systemPromptRef.current = sp;
        const aiMsg = { role: 'ai', text: data.message };
        setMessages([aiMsg]);
        transcriptRef.current = [aiMsg];
        const nextEmotion = normalizeEmotionMode(data.emotion);
        const nextMotions = normalizeLiveMotions(data.motions, ['talking']);
        emotionLogRef.current = [{ role: 'ai', emotion: nextEmotion, text: data.message }];
        motionLogRef.current = [{ role: 'ai', motions: nextMotions, text: data.message }];
        onEmotionChange?.(nextEmotion);
        onMotionChange?.(nextMotions);
        onBubbleTextChange?.('');
        setStatus('playing');
        const audioData = data.audioBase64 || data.audio_base64;
        const audioMime = data.audioMime || data.audio_mime || 'audio/mpeg';
        await play(audioData, data.message, language, audioMime, (progressText) => {
          onBubbleTextChange?.(getSpeechBubbleWindow(progressText));
        });
        if (!ac.signal.aborted) {
          onMotionChange?.('idle');
          setStatus('idle');
          onReadyChange?.(true);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setStatus('idle');
          onReadyChange?.(true);
        }
      });

    return () => ac.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const sendUserMessage = useCallback(async (text) => {
    if (!text.trim()) { setStatus('idle'); onMotionChange?.('idle'); return; }

    const userMsg = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    transcriptRef.current = [...transcriptRef.current, userMsg];
    setLiveText('');

    onMotionChange?.(['thinking', 'listening']);
    setStatus('thinking');

    try {
      const resp = await fetch(`${API_BASE}/api/live-sim/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPromptRef.current,
          transcript: transcriptRef.current,
          user_message: text,
          language: language || 'en',
        }),
      });
      const data = await resp.json();
      const aiMsg = { role: 'ai', text: data.message };
      setMessages((prev) => [...prev, aiMsg]);
      transcriptRef.current = [...transcriptRef.current, aiMsg];
      const nextEmotion = normalizeEmotionMode(data.emotion);
      const nextMotions = normalizeLiveMotions(data.motions, ['talking']);
      emotionLogRef.current = [...emotionLogRef.current, { role: 'ai', emotion: nextEmotion, text: data.message }];
      motionLogRef.current = [...motionLogRef.current, { role: 'ai', motions: nextMotions, text: data.message }];
      onEmotionChange?.(nextEmotion);
      onMotionChange?.(nextMotions);
      onBubbleTextChange?.('');
      setStatus('playing');
      const audioData = data.audioBase64 || data.audio_base64;
      const audioMime = data.audioMime || data.audio_mime || 'audio/mpeg';
      await play(audioData, data.message, language, audioMime, (progressText) => {
        onBubbleTextChange?.(getSpeechBubbleWindow(progressText));
      });
      onMotionChange?.('idle');
      setStatus('idle');
    } catch {
      setStatus('idle');
      onMotionChange?.('idle');
    }
  }, [language, play, onMotionChange, onEmotionChange, onBubbleTextChange]);

  sendMessageRef.current = sendUserMessage;

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size < 500) {
          setStatus('idle');
          onMotionChange?.('idle');
          setLiveText('');
          return;
        }

        setStatus('thinking');
        setLiveText('⏳ Recognizing…');
        onMotionChange?.(['thinking', 'listening']);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        try {
          const form = new FormData();
          form.append('file', blob, `audio.${ext}`);
          form.append('language', language || localStorage.getItem('app_lang') || 'ru');
          const resp = await fetch(`${API_BASE}/api/live-sim/transcribe`, {
            method: 'POST',
            body: form,
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const { text } = await resp.json();
          setLiveText('');
          if (text?.trim()) {
            sendMessageRef.current?.(text.trim());
          } else {
            setStatus('idle');
            onMotionChange?.('idle');
          }
        } catch {
          clearTimeout(timeout);
          setStatus('idle');
          onMotionChange?.('idle');
          setLiveText('');
        }
      };

      recorder.start();
      setStatus('listening');
      setLiveText('🎤 Recording…');
      onMotionChange?.('listening');
    } catch {
      setStatus('idle');
    }
  }, [language, onMotionChange]);

  const handleMicButton = useCallback(() => {
    if (status === 'listening') {
      stopListening();
    } else if (status === 'idle') {
      startListening();
    }
  }, [status, startListening, stopListening]);

  const finishDialog = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const capturedLiveText = liveText.trim();
    if (capturedLiveText) {
      const liveUserMsg = { role: 'user', text: capturedLiveText };
      transcriptRef.current = [...transcriptRef.current, liveUserMsg];
      setMessages((prev) => [...prev, liveUserMsg]);
      setLiveText('');
    }
    await stopListening();
    stop();
    onMotionChange?.('idle');
    setStatus('thinking');
    setIsEvaluatingBrief(true);
    try {
      const transcript = transcriptRef.current;
      const emotionLog = emotionLogRef.current;
      const motionLog = motionLogRef.current;
      const aiBrief = await requestLiveDialogBrief({
        scenarioTitle,
        scenarioGoal,
        transcript,
        emotionLog,
        motionLog,
        language,
      });
      const brief = composeLiveDialogBrief({
        scenarioId,
        scenarioTitle,
        scenarioGoal,
        scenarioXpReward,
        scenarioCoinReward,
        dailyQuest,
        transcript,
        emotionLog,
        motionLog,
        aiBrief,
      });
      saveLiveDialogBrief(brief);
      onBriefReady?.(brief);
    } catch {
      finishedRef.current = false;
    } finally {
      setIsEvaluatingBrief(false);
      setStatus('idle');
    }
  }, [
    language,
    dailyQuest,
    liveText,
    onBriefReady,
    onMotionChange,
    scenarioCoinReward,
    scenarioGoal,
    scenarioId,
    scenarioTitle,
    scenarioXpReward,
    stop,
    stopListening,
  ]);

  useEffect(() => {
    if (!finishToken) return;
    finishDialog();
  }, [finishDialog, finishToken]);

  return (
    <div className="voice-chat-panel" style={{
      position: 'absolute',
      bottom: 90,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(480px, 90vw)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      zIndex: 20,
    }}>
      {/* Message bubbles — last 3 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.filter((msg) => msg.role === 'user').slice(-2).map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            background: msg.role === 'user' ? 'var(--sky, #A8D8F0)' : 'white',
            border: '2px solid var(--line, #1a1a1a)',
            borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            padding: '8px 12px',
            fontSize: 13,
            boxShadow: '0 3px 0 var(--line, #1a1a1a)',
            color: 'var(--ink, #1a1a1a)',
          }}>
            {msg.text}
          </div>
        ))}
        {liveText && (
          <div style={{
            alignSelf: 'flex-end',
            maxWidth: '80%',
            background: 'var(--butter, #FFD86B)',
            border: '2px solid var(--line, #1a1a1a)',
            borderRadius: '16px 4px 16px 16px',
            padding: '8px 12px',
            fontSize: 13,
            opacity: 0.8,
            color: 'var(--ink, #1a1a1a)',
          }}>
            {liveText}…
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        {status === 'loading' && (
          <span style={{ fontSize: 13, opacity: 0.7 }}>⏳ Starting…</span>
        )}
        {status === 'thinking' && (
          <span style={{ fontSize: 13, opacity: 0.7 }}>{isEvaluatingBrief ? 'AI оценивает диалог…' : '💭 Thinking…'}</span>
        )}
        {status === 'playing' && (
          <span style={{ fontSize: 13, opacity: 0.7 }}>🔊 Speaking…</span>
        )}
        {(status === 'idle' || status === 'listening') && (
          <button
            type="button"
            onClick={handleMicButton}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '3px solid var(--line, #1a1a1a)',
              background: status === 'listening' ? 'var(--rose, #FF8FAB)' : 'var(--mint, #A8F0C8)',
              boxShadow: status === 'listening'
                ? '0 0 0 6px rgba(255,100,100,0.25), 0 4px 0 var(--line, #1a1a1a)'
                : '0 4px 0 var(--line, #1a1a1a)',
              cursor: 'pointer',
              fontSize: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {status === 'listening' ? '⏹' : '🎤'}
          </button>
        )}
        <button
          type="button"
          className="live-finish-button"
          onClick={finishDialog}
          disabled={!messages.length}
        >
          Завершить
        </button>
      </div>
    </div>
  );
}

function LiveBriefModal({ brief, onClose, onBackToDashboard }) {
  if (!brief) return null;

  return (
    <div className="live-brief-overlay" role="presentation">
      <section className="live-brief-modal plush-lg popin" role="dialog" aria-modal="true" aria-labelledby="live-brief-title">
        <header className="live-brief-head">
          <span>Brief сохранён в диалогах</span>
          <h2 id="live-brief-title">{brief.scenarioTitle}</h2>
          <p>{brief.summary || brief.scenarioGoal || 'Короткий разбор живой тренировки.'}</p>
        </header>
        <div className="live-brief-grid">
          <article className="live-brief-column live-brief-column--good">
            <h3>Что хорошо</h3>
            {brief.positives.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </article>
          <article className="live-brief-column live-brief-column--bad">
            <h3>Что улучшить</h3>
            {brief.negatives.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </article>
        </div>
        <div className="live-brief-meta">
          <span>Оценка: {brief.score || 0}/100</span>
          <span>{brief.goalAchieved ? 'Цель достигнута' : 'Цель не достигнута'}</span>
          <span>Эмоции: {brief.usedEmotions.length ? brief.usedEmotions.join(', ') : 'neutral'}</span>
          <span>Движения: {brief.usedMotions.length ? brief.usedMotions.join(', ') : 'idle'}</span>
          <span>Реплик: {brief.transcript.length}</span>
        </div>
        {brief.nextSteps?.length ? (
          <article className="live-brief-next">
            <h3>Следующий шаг</h3>
            {brief.nextSteps.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </article>
        ) : null}
        <footer className="live-brief-actions">
          <button type="button" className="btn-plush primary" onClick={onBackToDashboard || onClose}>В меню</button>
        </footer>
      </section>
    </div>
  );
}

function SimulationScene({
  onBackToDashboard,
  initialCaseId,
  scenarioId,
  scenarioTitle,
  scenarioXpReward,
  scenarioCoinReward,
  dailyQuest,
  industryName,
  industryIcon,
  quickPractice,
  scenarioGoal,
  aiPersona,
  patientType,
  language,
}) {
  const [activeCaseId, setActiveCaseId] = useState(() => resolveInitialCaseId(initialCaseId));
  const [bones, setBones] = useState([]);
  const [modelTransform, setModelTransform] = useState(() => ({ ...CHAISE_POSE.modelTransform }));
  const [chaiseTransform, setChaiseTransform] = useState(() => ({ ...CHAISE_POSE.chaiseTransform }));
  const [chaiseShape, setChaiseShape] = useState(() => sanitizeChaiseShape(CHAISE_POSE.chaiseShape));
  const [deskTransform, setDeskTransform] = useState(() => ({ ...DEFAULT_DESK_TRANSFORM }));
  const [boneRotations, setBoneRotations] = useState(() => cloneBoneRotations(CHAISE_POSE.boneRotations));
  const [liveMotion, setLiveMotion] = useState(() => ['starting']);
  const [emotionMode, setEmotionMode] = useState('neutral');
  const [speechBubbleText, setSpeechBubbleText] = useState('Starting...');
  const [liveBrief, setLiveBrief] = useState(null);
  const [finishToken, setFinishToken] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [isAiReady, setIsAiReady] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const pendingCaseRef = useRef(null);
  const activeCase = useMemo(
    () => resolveActiveCase(activeCaseId),
    [activeCaseId, CHAISE_POSE_REVISION, STANDING_POSE_REVISION, DESK_POSE_REVISION],
  );
  const activeCameraSettings = useMemo(() => getCameraPreset(activeCase.id), [activeCase.id]);
  const activeAuroraSettings = useMemo(() => getAuroraPreset(activeCase.id), [activeCase.id]);
  const activePropsLayout = DEFAULT_SCENE_PROPS[activeCase.scene] || [];

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

  useEffect(() => {
    setSecondsLeft(180);
    setIsAiReady(false);
    setLiveMotion(['starting']);
    setSpeechBubbleText('Starting...');
  }, [activeCase.id]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      if (!isAiReady) {
        return;
      }
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isAiReady]);

  useEffect(() => {
    if (secondsLeft === 0) {
      setFinishToken((token) => token + 1);
    }
  }, [secondsLeft]);

  const emotionTone = EMOTION_TONES[activeCase.scene] || EMOTION_TONES.chaise;

  return (
    <main className={`app app--${activeCase.scene}`}>
      <div className="veil-background" aria-hidden="true" />
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
        <SceneDressing propsLayout={activePropsLayout} />
        <StoneChaise
          activeCase={activeCase}
          modelTransform={modelTransform}
          chaiseTransform={chaiseTransform}
          chaiseShape={chaiseShape}
          deskTransform={deskTransform}
          boneRotations={boneRotations}
          resetToken={resetToken}
          liveMotion={liveMotion}
          emotionMode={emotionMode}
          bubbleAnchor={SPEECH_BUBBLE_ANCHORS[activeCase.scene]}
          speechText={speechBubbleText}
          onBonesReady={handleBonesReady}
        />
        <ContactShadows position={[0, -1.16, 0]} opacity={0.34} blur={2.8} scale={7} far={3} />
        <Environment preset="apartment" />
        <SceneCameraControls settings={activeCameraSettings} />
      </Canvas>
      <div className="simulation-bottom-bar">
        <AiStatePanel emotionMode={emotionMode} liveMotion={liveMotion} />
        <div className="simulation-bottom-center">
          {scenarioTitle || industryName ? (
            <div className="simulation-context-banner">
              {quickPractice ? <span className="chip butter">⚡ Быстрая практика</span> : null}
              {industryName ? (
                <span className="chip peach">
                  {industryIcon ? `${industryIcon} ` : ''}
                  {industryName}
                </span>
              ) : null}
              {scenarioTitle ? <strong className="simulation-context-title">{scenarioTitle}</strong> : null}
              <span className="simulation-scene-label">{activeCase.label}</span>
            </div>
          ) : null}
          <CountdownTimerPanel secondsLeft={secondsLeft} />
        </div>
        {onBackToDashboard ? (
          <button
            type="button"
            className="btn-plush sm simulation-back-button"
            style={{ background: 'var(--rose)' }}
            onClick={onBackToDashboard}
          >
            <ArrowLeft size={16} /> Назад в меню
          </button>
        ) : (
          <div className="simulation-bottom-spacer" aria-hidden="true" />
        )}
      </div>
      <VoiceChat
        scenarioId={scenarioId}
        scenarioTitle={scenarioTitle}
        scenarioGoal={scenarioGoal}
        scenarioXpReward={scenarioXpReward}
        scenarioCoinReward={scenarioCoinReward}
        dailyQuest={dailyQuest}
        aiPersona={aiPersona}
        patientType={patientType}
        language={language}
        onMotionChange={setLiveMotion}
        onEmotionChange={setEmotionMode}
        onBubbleTextChange={setSpeechBubbleText}
        onBriefReady={setLiveBrief}
        finishToken={finishToken}
        onReadyChange={setIsAiReady}
      />
      <LiveBriefModal
        brief={liveBrief}
        onClose={() => setLiveBrief(null)}
        onBackToDashboard={onBackToDashboard}
      />
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
    onboardingAiLoading: "AI summary loading",
    signInLoading: "Входим…",
    accountNotFound: "Аккаунт не найден. Сначала зарегистрируйтесь.",
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
    onboardingAiLoading: "AI xulosasi yuklanmoqda",
    signInLoading: "Kirish…",
    accountNotFound: "Hisob topilmadi. Avval ro'yxatdan o'ting.",
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
    onboardingAiLoading: "AI summary loading",
    signInLoading: "Signing in…",
    accountNotFound: "Account not found. Please sign up first.",
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

function completeRoleWithoutOnboarding(user) {
  if (!user || user.role === 'solo') {
    return;
  }

  const completedAt = new Date().toISOString();
  const draft = {
    ...EMPTY_ONBOARDING_DRAFT,
    industry: user.role === 'admin' ? 'business' : 'optional',
    industryLabel: user.role === 'admin' ? 'Корпоративное обучение' : 'Можно выбрать позже',
    role: user.role,
    roleLabel: user.role === 'admin' ? 'Admin corporate' : 'Employee',
    goal: user.role === 'admin' ? 'company-training' : 'company-assignment',
    goalLabel: user.role === 'admin' ? 'Создавать задания компании' : 'Выполнять задания компании',
    experience: 'team',
    experienceLabel: 'Командный режим',
    currentStep: 4,
    completedAt,
  };

  saveOnboardingMemory({
    version: 1,
    completed: true,
    completedAt,
    language: getOnboardingLang(),
    userEmail: user.email || '',
    userId: user.id || '',
    draft,
    aiSummary: {
      roleLine: user.role === 'admin'
        ? 'Вы управляете корпоративными тренировками и правилами компании.'
        : 'Вы сотрудник команды и можете сразу перейти к заданиям компании.',
      goalLine: draft.goalLabel,
      targetLine: user.role === 'admin'
        ? 'Фокус: сценарии по правилам, навыки сотрудников и прогноз роста.'
        : 'Фокус: выполнить назначенные сцены и настроить личный режим тренировки.',
      modeLine: 'Без обязательного solo-опроса.',
      starterScenarioTitle: EMPLOYEE_COMPANY_TASKS[0].title,
    },
    rewards: {
      xpAwarded: 0,
      streak: Math.max(Number(user.streak) || 0, 1),
      unlockedScenarioIds: user.unlockedScenarioIds || [],
    },
  });
}

function hasCompletedOnboarding(user) {
  return Boolean(getOnboardingMemory(user) || user?.onboardingCompleted === true || user?.onboardingRequired === false);
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
    organizationName: profile.organizationName || localUser?.organizationName || '',
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

      setError(authError?.message || TRANSLATIONS[lang].accountNotFound);
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
            {isSubmitting ? TRANSLATIONS[lang].signInLoading : TRANSLATIONS[lang].signInBtn}
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

      if (appUser.role !== 'solo') {
        completeRoleWithoutOnboarding(appUser);
      }

      saveMockUser(appUser);
      setMockSession(appUser.email);
      if (appUser.role === 'solo') {
        saveOnboardingDraft({
          ...EMPTY_ONBOARDING_DRAFT,
          currentStep: 0,
          startedAt: new Date().toISOString(),
        });
        navigate('/onboarding');
      } else {
        navigate('/home');
      }
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

const DASHBOARD_PROFILE_COPY = {
  ru: {
    nav: 'Профиль',
    title: 'Мой профиль',
    back: 'К панели',
    email: 'Email',
    org: 'Компания',
    role: 'Роль',
    goal: 'Цель обучения',
    signOut: 'Выйти',
    navAria: 'Навигация панели',
  },
  uz: {
    nav: 'Profil',
    title: 'Mening profilim',
    back: 'Panelga',
    email: 'Email',
    org: 'Kompaniya',
    role: 'Rol',
    goal: 'O\'qish maqsadi',
    signOut: 'Chiqish',
    navAria: 'Panel navigatsiyasi',
  },
  en: {
    nav: 'Profile',
    title: 'My profile',
    back: 'Back to panel',
    email: 'Email',
    org: 'Company',
    role: 'Role',
    goal: 'Training goal',
    signOut: 'Logout',
    navAria: 'Panel navigation',
  },
};

const CORPORATE_COPY = {
  ru: {
    loadingDashboard: 'Загрузка панели',
    loadingPage: 'Загрузка корпоративной страницы',
    backendWarning: 'Корпоративный backend недоступен. Проверьте сервер, сессию Supabase и профиль администратора.',
    backendUnavailablePrefix: 'Backend недоступен',
    liveBackend: 'Live backend',
    backendError: 'Ошибка backend',
    adminTitle: 'Панель команды',
    employeeTitle: 'Мой тренажёр',
    adminSubtitleLive: 'База знаний, задания и результаты собраны в одном месте. Можно назначать практику и смотреть, как команда проходит обучение.',
    adminSubtitleError: 'Live admin data could not be loaded. Check the FastAPI server, Supabase session, and matching admin profile.',
    employeeSubtitle: 'Личный маршрут готов: первый сценарий открыт, прогресс сохранён, а награда уже ждёт в профиле.',
    homeBack: 'К home',
    open: 'Открыть',
    dashboard: 'Dashboard',
    dashboardBadge: 'СТАТИСТИКА',
    dashboardDesc: 'Сотрудники, результаты, польза для компании.',
    base: 'Создать базу',
    baseBadge: 'ФАЙЛЫ',
    baseDesc: 'Документы, промпты и база знаний.',
    assignments: 'Задания',
    assignmentsBadge: 'ЗАПУСК',
    assignmentsDesc: 'Одинаковый или уникальный режим.',
    prizes: 'Призы',
    prizesBadge: 'ТОП-3',
    prizesDesc: 'Первое, второе и третье место.',
    company: 'Компания',
    documents: 'Документы',
    averageGrowth: 'Средний рост',
    employees: 'Сотрудники',
    teamAnalytics: 'Командная аналитика',
    teamAnalyticsDesc: 'Результаты сотрудников, точность по базе и польза для компании в одном рабочем виде.',
    usefulness: 'Польза',
    employee: 'Сотрудник',
    role: 'Роль',
    result: 'Результат',
    files: 'Файлы',
    character: 'Характер',
    strengths: 'Плюсы',
    effect: 'Эффект',
    fileAccuracy: 'точность по файлам',
    noEmployees: 'Сотрудники пока не найдены для этой организации.',
    knowledgeBase: 'База знаний',
    baseTitle: 'База для обучения',
    baseDescLong: 'Админ добавляет документы и основной промпт. После кнопки “Создать базу” ИИ собирает черновик, который можно править.',
    uploading: 'Загрузка...',
    addDocuments: 'Добавить документы',
    uploadHint: 'PDF, DOCX, TXT, правила, playbook, описание компании',
    aiReady: 'Готов к ИИ',
    newDocument: 'Новый документ',
    promptLabel: 'Промпт для базы',
    creating: 'Создание...',
    createBase: 'Создать базу',
    baseCreated: 'База создана',
    manualFill: 'Можно заполнить все вручную',
    constructor: 'Конструктор',
    scenarioForms: 'Формы сценариев',
    clientFlexible: 'Тип клиентов: гибко',
    clientB2b: 'B2B',
    clientB2c: 'B2C',
    clientVip: 'VIP / сложные',
    aiBuildsTasks: 'ИИ сам соберет задания',
    fillManually: 'Заполнить вручную',
    companyBrief: 'Суть компании',
    rulesBrief: 'Правила и ограничения',
    clientTypes: 'Типы клиентов',
    taskGoal: 'Что тренируем',
    scoringRules: 'Критерии проверки',
    assignmentsTitle: 'Что уйдет сотрудникам',
    sending: 'Отправка...',
    send: 'Отправить',
    sameMode: 'У всех одинаковые проблемы и задания',
    uniqueMode: 'У каждого свое уникальное задание по роли и слабым местам',
    sameModeChip: 'Сотрудникам уйдут одинаковые проблемы',
    uniqueModeChip: 'Сотрудникам уйдут персональные варианты',
    generating: 'Генерация...',
    generateByAi: 'Сгенерировать через ИИ',
    noEmployeesOrTasks: 'Нет сотрудников или заданий для отправки.',
    createBaseFirst: 'Сначала создайте базу знаний, затем генерируйте задания через ИИ.',
    manualScenarioTitle: 'Добавить сценарий вручную',
    manualScenarioDesc: 'Заполните поля, сохраните черновик и отправьте его сотрудникам вместе с AI-заданиями.',
    manualTitle: 'Название сценария',
    manualClientType: 'Тип клиента',
    manualSkill: 'Навык',
    manualGoal: 'Цель / описание',
    manualDifficultyEasy: 'Легко',
    manualDifficultyMedium: 'Средне',
    manualDifficultyHard: 'Сложно',
    addManual: 'Добавить вручную',
    addingManual: 'Добавление...',
    manualValidation: 'Заполните название, тип клиента, навык и цель сценария.',
    noTaskDrafts: 'Пока нет черновиков заданий. Сгенерируйте через ИИ или добавьте сценарий вручную.',
    difficulty: 'Сложность',
    prizesTitle: 'Только топ-3',
    saved: 'Сохранено',
    draft: 'Черновик',
    firstPlace: '1 место',
    secondPlace: '2 место',
    thirdPlace: '3 место',
    prizePreview: 'Превью призов',
    firstFallback: '1 место пока не указано',
    secondFallback: '2 место пока не указано',
    thirdFallback: '3 место пока не указано',
    save: 'Сохранить',
    defaultPrizes: {
      first: '1 место: денежный бонус и сертификат лидера обучения',
      second: '2 место: подарок от компании и публичное признание',
      third: '3 место: доступ к продвинутому AI-треку',
    },
    defaults: {
      sourcePrompt: 'Собери базу знаний для обучения сотрудников: правила компании, типы клиентов, ограничения ИИ, примеры правильных и неправильных ответов.',
      companyBrief: '',
      rulesBrief: '',
      clientType: '',
      taskGoal: '',
      scoringRules: '',
    },
    employeeSettings: 'Настройки',
    employeeModeTitle: 'Личный режим как у solo',
    employeeModeDesc: 'Можно сразу тренироваться по заданиям компании или выбрать отрасль для дополнительных сценариев.',
    optionalIndustry: 'Отрасль, если нужна',
    noIndustryNow: 'Не выбирать сейчас',
    gentleMode: 'Мягко, с подсказками',
    realisticMode: 'Реалистично',
    hardMode: 'Сложный клиент',
    showHints: 'Показывать подсказки во время сцены',
    companyAssignment: 'Задание компании',
    companyTasks: 'Задания компании',
    adminScenes: 'Сцены от админа',
    active: 'активных',
    requiredScore: 'Нужно набрать',
    start: 'Начать',
    assigned: 'Назначено',
    completed: 'Выполнено',
    mode: 'Режим',
  },
  uz: {
    loadingDashboard: 'Panel yuklanmoqda',
    loadingPage: 'Korporativ sahifa yuklanmoqda',
    backendWarning: 'Korporativ backend mavjud emas. Server, Supabase sessiyasi va admin profilini tekshiring.',
    backendUnavailablePrefix: 'Backend mavjud emas',
    liveBackend: 'Live backend',
    backendError: 'Backend xatosi',
    adminTitle: 'Jamoa paneli',
    employeeTitle: 'Mening trenajyorim',
    adminSubtitleLive: 'Bilim bazasi, topshiriqlar va natijalar bir joyda. Amaliyotni tayinlash va jamoa o‘qishini kuzatish mumkin.',
    adminSubtitleError: 'Live admin ma’lumotlari yuklanmadi. FastAPI serveri, Supabase sessiyasi va admin profilini tekshiring.',
    employeeSubtitle: 'Shaxsiy yo‘l tayyor: birinchi ssenariy ochiq, progress saqlangan, mukofot profilda kutmoqda.',
    homeBack: 'Home ga',
    open: 'Ochish',
    dashboard: 'Dashboard',
    dashboardBadge: 'STATISTIKA',
    dashboardDesc: 'Xodimlar, natijalar va kompaniya foydasi.',
    base: 'Baza yaratish',
    baseBadge: 'FAYLLAR',
    baseDesc: 'Hujjatlar, promptlar va bilim bazasi.',
    assignments: 'Topshiriqlar',
    assignmentsBadge: 'START',
    assignmentsDesc: 'Bir xil yoki individual rejim.',
    prizes: 'Sovrinlar',
    prizesBadge: 'TOP-3',
    prizesDesc: 'Birinchi, ikkinchi va uchinchi o‘rin.',
    company: 'Kompaniya',
    documents: 'Hujjatlar',
    averageGrowth: 'O‘rtacha o‘sish',
    employees: 'Xodimlar',
    teamAnalytics: 'Jamoa analitikasi',
    teamAnalyticsDesc: 'Xodim natijalari, baza bo‘yicha aniqlik va kompaniya foydasi bir ko‘rinishda.',
    usefulness: 'Foyda',
    employee: 'Xodim',
    role: 'Rol',
    result: 'Natija',
    files: 'Fayllar',
    character: 'Xarakter',
    strengths: 'Kuchli tomonlar',
    effect: 'Effekt',
    fileAccuracy: 'fayllar bo‘yicha aniqlik',
    noEmployees: 'Bu tashkilot uchun xodimlar hali topilmadi.',
    knowledgeBase: 'Bilim bazasi',
    baseTitle: 'O‘qitish bazasi',
    baseDescLong: 'Admin hujjatlar va asosiy promptni qo‘shadi. “Baza yaratish” tugmasidan keyin AI tahrirlash mumkin bo‘lgan draft yaratadi.',
    uploading: 'Yuklanmoqda...',
    addDocuments: 'Hujjat qo‘shish',
    uploadHint: 'PDF, DOCX, TXT, qoidalar, playbook, kompaniya tavsifi',
    aiReady: 'AI uchun tayyor',
    newDocument: 'Yangi hujjat',
    promptLabel: 'Baza uchun prompt',
    creating: 'Yaratilmoqda...',
    createBase: 'Baza yaratish',
    baseCreated: 'Baza yaratildi',
    manualFill: 'Hammasini qo‘lda to‘ldirish mumkin',
    constructor: 'Konstruktor',
    scenarioForms: 'Ssenariy shakllari',
    clientFlexible: 'Mijoz turlari: moslashuvchan',
    clientB2b: 'B2B',
    clientB2c: 'B2C',
    clientVip: 'VIP / murakkab',
    aiBuildsTasks: 'AI topshiriqlarni o‘zi tuzadi',
    fillManually: 'Qo‘lda to‘ldirish',
    companyBrief: 'Kompaniya mazmuni',
    rulesBrief: 'Qoidalar va cheklovlar',
    clientTypes: 'Mijoz turlari',
    taskGoal: 'Nimani mashq qilamiz',
    scoringRules: 'Baholash mezonlari',
    assignmentsTitle: 'Xodimlarga nima yuboriladi',
    sending: 'Yuborilmoqda...',
    send: 'Yuborish',
    sameMode: 'Hammada bir xil muammolar va topshiriqlar',
    uniqueMode: 'Har bir xodimga roli va zaif joylariga mos individual topshiriq',
    sameModeChip: 'Xodimlarga bir xil muammolar yuboriladi',
    uniqueModeChip: 'Xodimlarga shaxsiy variantlar yuboriladi',
    generating: 'Generatsiya...',
    generateByAi: 'AI orqali yaratish',
    noEmployeesOrTasks: 'Yuborish uchun xodimlar yoki topshiriqlar yo‘q.',
    createBaseFirst: 'Avval bilim bazasini yarating, keyin AI orqali topshiriqlarni generatsiya qiling.',
    manualScenarioTitle: 'Ssenariyni qo‘lda qo‘shish',
    manualScenarioDesc: 'Maydonlarni to‘ldiring, draftni saqlang va uni AI topshiriqlari bilan birga xodimlarga yuboring.',
    manualTitle: 'Ssenariy nomi',
    manualClientType: 'Mijoz turi',
    manualSkill: 'Ko‘nikma',
    manualGoal: 'Maqsad / tavsif',
    manualDifficultyEasy: 'Oson',
    manualDifficultyMedium: 'O‘rtacha',
    manualDifficultyHard: 'Qiyin',
    addManual: 'Qo‘lda qo‘shish',
    addingManual: 'Qo‘shilmoqda...',
    manualValidation: 'Ssenariy nomi, mijoz turi, ko‘nikma va maqsadni to‘ldiring.',
    noTaskDrafts: 'Hali topshiriq draftlari yo‘q. AI orqali yarating yoki ssenariyni qo‘lda qo‘shing.',
    difficulty: 'Murakkablik',
    prizesTitle: 'Faqat top-3',
    saved: 'Saqlangan',
    draft: 'Draft',
    firstPlace: '1-o‘rin',
    secondPlace: '2-o‘rin',
    thirdPlace: '3-o‘rin',
    prizePreview: 'Sovrinlar preview',
    firstFallback: '1-o‘rin hali ko‘rsatilmagan',
    secondFallback: '2-o‘rin hali ko‘rsatilmagan',
    thirdFallback: '3-o‘rin hali ko‘rsatilmagan',
    save: 'Saqlash',
    defaultPrizes: {
      first: '1-o‘rin: pul bonusi va o‘quv lideri sertifikati',
      second: '2-o‘rin: kompaniya sovg‘asi va ommaviy e’tirof',
      third: '3-o‘rin: ilg‘or AI trekka kirish',
    },
    defaults: {
      sourcePrompt: 'Xodimlarni o‘qitish uchun bilim bazasini yig‘ing: kompaniya qoidalari, mijoz turlari, AI cheklovlari hamda to‘g‘ri va noto‘g‘ri javob namunalari.',
      companyBrief: '',
      rulesBrief: '',
      clientType: '',
      taskGoal: '',
      scoringRules: '',
    },
    employeeSettings: 'Sozlamalar',
    employeeModeTitle: 'Solo kabi shaxsiy rejim',
    employeeModeDesc: 'Kompaniya topshiriqlari bilan darhol mashq qilish yoki qo‘shimcha ssenariylar uchun sohani tanlash mumkin.',
    optionalIndustry: 'Kerak bo‘lsa soha',
    noIndustryNow: 'Hozir tanlamaslik',
    gentleMode: 'Yumshoq, maslahatlar bilan',
    realisticMode: 'Realistik',
    hardMode: 'Murakkab mijoz',
    showHints: 'Sahna vaqtida maslahatlarni ko‘rsatish',
    companyAssignment: 'Kompaniya topshirig‘i',
    companyTasks: 'Kompaniya topshiriqlari',
    adminScenes: 'Admin sahnalari',
    active: 'faol',
    requiredScore: 'Kerakli ball',
    start: 'Boshlash',
    assigned: 'Tayinlangan',
    completed: 'Bajarilgan',
    mode: 'Rejim',
  },
  en: {
    loadingDashboard: 'Loading dashboard',
    loadingPage: 'Loading corporate page',
    backendWarning: 'Corporate backend is unavailable. Check the server, Supabase session, and admin profile.',
    backendUnavailablePrefix: 'Backend unavailable',
    liveBackend: 'Live backend',
    backendError: 'Backend error',
    adminTitle: 'Team dashboard',
    employeeTitle: 'My trainer',
    adminSubtitleLive: 'Knowledge base, assignments, and results are gathered in one place. Assign practice and track how the team is learning.',
    adminSubtitleError: 'Live admin data could not be loaded. Check the FastAPI server, Supabase session, and matching admin profile.',
    employeeSubtitle: 'Your personal route is ready: the first scenario is open, progress is saved, and the reward is waiting in your profile.',
    homeBack: 'To home',
    open: 'Open',
    dashboard: 'Dashboard',
    dashboardBadge: 'STATS',
    dashboardDesc: 'Employees, results, and company impact.',
    base: 'Create base',
    baseBadge: 'FILES',
    baseDesc: 'Documents, prompts, and knowledge base.',
    assignments: 'Assignments',
    assignmentsBadge: 'LAUNCH',
    assignmentsDesc: 'Same or unique mode.',
    prizes: 'Prizes',
    prizesBadge: 'TOP-3',
    prizesDesc: 'First, second, and third place.',
    company: 'Company',
    documents: 'Documents',
    averageGrowth: 'Average growth',
    employees: 'Employees',
    teamAnalytics: 'Team analytics',
    teamAnalyticsDesc: 'Employee results, knowledge-base accuracy, and company impact in one working view.',
    usefulness: 'Usefulness',
    employee: 'Employee',
    role: 'Role',
    result: 'Result',
    files: 'Files',
    character: 'Character',
    strengths: 'Strengths',
    effect: 'Impact',
    fileAccuracy: 'file accuracy',
    noEmployees: 'No employees found for this organization yet.',
    knowledgeBase: 'Knowledge base',
    baseTitle: 'Training base',
    baseDescLong: 'Admin adds documents and the main prompt. After “Create base”, AI builds an editable draft.',
    uploading: 'Uploading...',
    addDocuments: 'Add documents',
    uploadHint: 'PDF, DOCX, TXT, rules, playbook, company description',
    aiReady: 'Ready for AI',
    newDocument: 'New document',
    promptLabel: 'Base prompt',
    creating: 'Creating...',
    createBase: 'Create base',
    baseCreated: 'Base created',
    manualFill: 'Everything can be filled manually',
    constructor: 'Builder',
    scenarioForms: 'Scenario forms',
    clientFlexible: 'Client types: flexible',
    clientB2b: 'B2B',
    clientB2c: 'B2C',
    clientVip: 'VIP / complex',
    aiBuildsTasks: 'AI will build assignments',
    fillManually: 'Fill manually',
    companyBrief: 'Company brief',
    rulesBrief: 'Rules and limits',
    clientTypes: 'Client types',
    taskGoal: 'Training focus',
    scoringRules: 'Scoring criteria',
    assignmentsTitle: 'What employees will receive',
    sending: 'Sending...',
    send: 'Send',
    sameMode: 'Everyone gets the same problems and assignments',
    uniqueMode: 'Each employee gets a unique assignment for their role and weak spots',
    sameModeChip: 'Employees will receive the same problems',
    uniqueModeChip: 'Employees will receive personalized variants',
    generating: 'Generating...',
    generateByAi: 'Generate by AI',
    noEmployeesOrTasks: 'No employees or assignments to send.',
    createBaseFirst: 'Create the knowledge base first, then generate assignments with AI.',
    manualScenarioTitle: 'Add scenario manually',
    manualScenarioDesc: 'Fill the fields, save the draft, and send it to employees together with AI assignments.',
    manualTitle: 'Scenario title',
    manualClientType: 'Client type',
    manualSkill: 'Skill',
    manualGoal: 'Goal / description',
    manualDifficultyEasy: 'Easy',
    manualDifficultyMedium: 'Medium',
    manualDifficultyHard: 'Hard',
    addManual: 'Add manually',
    addingManual: 'Adding...',
    manualValidation: 'Fill in the scenario title, client type, skill, and goal.',
    noTaskDrafts: 'No task drafts yet. Generate with AI or add a scenario manually.',
    difficulty: 'Difficulty',
    prizesTitle: 'Top-3 only',
    saved: 'Saved',
    draft: 'Draft',
    firstPlace: '1st place',
    secondPlace: '2nd place',
    thirdPlace: '3rd place',
    prizePreview: 'Prize preview',
    firstFallback: '1st place is not set yet',
    secondFallback: '2nd place is not set yet',
    thirdFallback: '3rd place is not set yet',
    save: 'Save',
    defaultPrizes: {
      first: '1st place: cash bonus and training leader certificate',
      second: '2nd place: company gift and public recognition',
      third: '3rd place: access to an advanced AI track',
    },
    defaults: {
      sourcePrompt: 'Build a knowledge base for employee training: company rules, client types, AI limits, and examples of good and poor answers.',
      companyBrief: '',
      rulesBrief: '',
      clientType: '',
      taskGoal: '',
      scoringRules: '',
    },
    employeeSettings: 'Settings',
    employeeModeTitle: 'Personal mode like solo',
    employeeModeDesc: 'Train on company assignments right away or choose an industry for extra scenarios.',
    optionalIndustry: 'Industry, if needed',
    noIndustryNow: 'Do not choose now',
    gentleMode: 'Gentle, with hints',
    realisticMode: 'Realistic',
    hardMode: 'Difficult client',
    showHints: 'Show hints during the scene',
    companyAssignment: 'Company assignment',
    companyTasks: 'Company assignments',
    adminScenes: 'Admin scenes',
    active: 'active',
    requiredScore: 'Required score',
    start: 'Start',
    assigned: 'Assigned',
    completed: 'Completed',
    mode: 'Mode',
  },
};

function DashboardProfileView({ profile, copy, onSignOut }) {
  const roleLabel = profile?.onboarding?.roleLabel
    || (profile?.role === 'admin' ? 'Admin' : profile?.role || '—');

  return (
    <section className="dashboard-profile-view plush-lg paper popin">
      <Link to="/home" className="btn-plush sm admin-section-back dashboard-profile-back">
        <ArrowLeft size={16} /> {copy.back}
      </Link>

      <article className="dashboard-profile-card">
        <span className={`dashboard-profile-avatar header-avatar ${profile?.role || 'admin'}`}>
          {profile?.name?.[0] || 'U'}
        </span>
        <div className="dashboard-profile-copy">
          <h2>{profile?.name || copy.title}</h2>
          <p className="dashboard-profile-meta">
            <strong>{copy.email}:</strong> {profile?.email || '—'}
          </p>
          <p className="dashboard-profile-meta">
            <strong>{copy.org}:</strong> {profile?.organizationName || profile?.organizationId || '—'}
          </p>
          <p className="dashboard-profile-meta">
            <strong>{copy.role}:</strong> {roleLabel}
          </p>
          {profile?.onboarding?.goalLabel || profile?.goal ? (
            <p className="dashboard-profile-meta">
              <strong>{copy.goal}:</strong> {profile.onboarding?.goalLabel || profile.goal}
            </p>
          ) : null}
        </div>
        {profile?.onboarding ? (
          <div className="summary-chips">
            <span className="chip sky">{profile.onboarding.industryLabel || profile.onboarding.industry}</span>
            {profile.onboarding.experienceLabel ? (
              <span className="chip mint">{profile.onboarding.experienceLabel}</span>
            ) : null}
          </div>
        ) : null}
        <button type="button" className="logout-button tap dashboard-profile-logout" onClick={onSignOut}>
          <LogOut size={16} /> {copy.signOut}
        </button>
      </article>
    </section>
  );
}

function SkeletonLine({ className = '' }) {
  return <span className={`corporate-skeleton-line ${className}`} aria-hidden="true" />;
}

function DashboardPageSkeleton({ adminPage = null, lang = 'ru' }) {
  const corporateCopy = CORPORATE_COPY[lang] || CORPORATE_COPY.ru;
  const homePages = [
    { badge: corporateCopy.dashboardBadge, badgeBg: 'var(--sky)', accent: 'var(--sky)' },
    { badge: corporateCopy.baseBadge, badgeBg: 'var(--butter)', accent: 'var(--butter)' },
    { badge: corporateCopy.assignmentsBadge, badgeBg: 'var(--peach)', accent: 'var(--peach)' },
    { badge: corporateCopy.prizesBadge, badgeBg: 'var(--rose)', accent: 'var(--rose)' },
  ];

  if (adminPage && adminPage !== 'home') {
    const currentPage = {
      dashboard: { label: corporateCopy.dashboard, badge: corporateCopy.dashboardBadge, badgeBg: 'var(--sky)' },
      base: { label: corporateCopy.base, badge: corporateCopy.baseBadge, badgeBg: 'var(--butter)' },
      assignments: { label: corporateCopy.assignments, badge: corporateCopy.assignmentsBadge, badgeBg: 'var(--peach)' },
      prizes: { label: corporateCopy.prizes, badge: corporateCopy.prizesBadge, badgeBg: 'var(--rose)' },
    }[adminPage];

    return (
      <main className="product-app paper dots-bg dashboard-page has-bottom-nav">
        <BackgroundMusic />
        <TrainerFloatingDecor />
        <section className="dashboard-shell plush-lg paper popin dashboard-shell-content admin-section-page">
          <div className="admin-section-topbar">
            <span className="btn-plush sm admin-section-back skeleton-static-button">
              <SkeletonLine className="w-label" />
            </span>
            {currentPage ? (
              <div className="admin-section-heading">
                <span className="admin-mode-badge" style={{ background: currentPage.badgeBg }}>{currentPage.badge}</span>
                <strong>{currentPage.label}</strong>
              </div>
            ) : null}
          </div>
          <CorporatePageSkeleton page={adminPage} lang={lang} />
        </section>
      </main>
    );
  }

  return (
    <main className="product-app paper dots-bg dashboard-page has-bottom-nav">
      <BackgroundMusic />
      <TrainerFloatingDecor />
      <section className="dashboard-shell plush-lg paper popin dashboard-shell-content admin-home-skeleton" aria-label={corporateCopy.loadingDashboard}>
        <div className="admin-dashboard-hero skeleton-card">
          <SkeletonLine className="w-chip" />
          <SkeletonLine className="w-title" />
          <SkeletonLine className="w-copy" />
          <SkeletonLine className="w-copy short" />
        </div>
        <nav className="admin-mode-cards mode-cards-grid admin-mode-cards-standalone" aria-label="Admin sections">
          {homePages.map((page, index) => (
            <article key={index} className="admin-mode-card admin-mode-card-skeleton skeleton-card">
              <span className="admin-mode-badge" style={{ background: page.badgeBg }}>{page.badge}</span>
              <span className="admin-mode-emoji" style={{ background: page.accent }}>
                <SkeletonLine className="avatar" />
              </span>
              <span className="admin-mode-copy">
                <SkeletonLine className="w-label" />
                <SkeletonLine />
                <SkeletonLine className="short" />
              </span>
              <span className="admin-mode-cta">
                <SkeletonLine className="w-label" />
              </span>
            </article>
          ))}
        </nav>
      </section>
    </main>
  );
}

function CorporateKnowledgeFieldsSkeleton() {
  return (
    <div className="admin-builder-grid wide" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonLine key={index} className="textarea" />
      ))}
      <SkeletonLine className="textarea span-2" />
    </div>
  );
}

function CorporateTaskDraftSkeleton() {
  return (
    <article className="rule-scene-card skeleton-card" aria-hidden="true">
      <SkeletonLine className="w-chip" />
      <SkeletonLine className="w-title short" />
      <SkeletonLine />
      <SkeletonLine className="short" />
    </article>
  );
}

function CorporatePageSkeleton({ page = 'dashboard', lang = 'ru' }) {
  const corporateCopy = CORPORATE_COPY[lang] || CORPORATE_COPY.ru;
  const isDashboard = page === 'dashboard';
  const isBase = page === 'base';
  const isAssignments = page === 'assignments';

  if (isDashboard) {
    return (
      <div className="corporate-dashboard corporate-dashboard-skeleton" aria-label={corporateCopy.loadingDashboard}>
        <div className="corporate-stats">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="stat-card skeleton-card">
              <SkeletonLine className="w-label" />
              <SkeletonLine className="w-number" />
            </div>
          ))}
        </div>
        <section className="corporate-panel dashboard-insight-panel skeleton-card">
          <SkeletonLine className="w-chip" />
          <SkeletonLine className="w-title" />
          <SkeletonLine className="w-copy" />
          <div className="admin-employee-layout skeleton-employee-layout">
            <div className="admin-employee-list skeleton-card">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton-table-row">
                  <SkeletonLine className="avatar" />
                  <SkeletonLine />
                  <SkeletonLine className="short" />
                </div>
              ))}
            </div>
            <div className="admin-employee-detail skeleton-card">
              <SkeletonLine className="w-title" />
              <SkeletonLine className="w-copy short" />
              <div className="admin-detail-grid">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index}>
                    <SkeletonLine className="w-label" />
                    <SkeletonLine />
                    <SkeletonLine className="short" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonLine key={index} className="w-copy" />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="corporate-dashboard corporate-dashboard-skeleton" aria-label={corporateCopy.loadingPage}>
      <section className="corporate-panel skeleton-card">
        <SkeletonLine className="w-chip" />
        <SkeletonLine className="w-title" />
        <SkeletonLine className="w-copy" />
        {isBase ? (
          <>
            <div className="admin-doc-layout">
              <div className="document-dropzone skeleton-card">
                <SkeletonLine className="avatar" />
                <SkeletonLine className="w-title short" />
                <SkeletonLine />
              </div>
              <div className="admin-doc-list">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="admin-doc-item skeleton-card">
                    <SkeletonLine className="avatar" />
                    <SkeletonLine />
                    <SkeletonLine className="short" />
                  </div>
                ))}
              </div>
            </div>
            <SkeletonLine className="textarea" />
          </>
        ) : null}
        {isAssignments ? (
          <>
            <div className="admin-mode-panel">
              <SkeletonLine className="control" />
              <SkeletonLine className="control" />
            </div>
            <div className="rule-scene-list admin-task-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <CorporateTaskDraftSkeleton key={index} />
              ))}
            </div>
          </>
        ) : null}
        {!isBase && !isAssignments ? (
          <div className="admin-prize-panel">
            <div className="admin-prize-fields">
              {Array.from({ length: 3 }).map((_, index) => <SkeletonLine key={index} className="textarea" />)}
            </div>
            <div className="admin-prize-preview skeleton-card">
              <SkeletonLine className="w-title short" />
              <SkeletonLine />
              <SkeletonLine />
              <SkeletonLine className="short" />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

async function fetchCorporateAdminPayload(token) {
  const [docsPayload, reviewPayload, prizesPayload] = await Promise.all([
    apiRequest('/api/corporate/admin/documents', { token }),
    apiRequest('/api/corporate/admin/review', { token }),
    apiRequest('/api/corporate/admin/prizes', { token }),
  ]);

  return {
    docsPayload,
    knowledgePayload: null,
    draftsPayload: [],
    reviewPayload,
    prizesPayload,
  };
}

const demoUserForRole = (role) => (role === 'employee' ? DEMO_EMPLOYEE_ID : DEMO_ADMIN_ID);

const DEFAULT_CORPORATE_PRIZES = {
  first: '1 место: денежный бонус и сертификат лидера обучения',
  second: '2 место: подарок от компании и публичное признание',
  third: '3 место: доступ к продвинутому AI-треку',
};

function corporateScoreTone(score) {
  const value = Number(score) || 0;
  if (value >= 85) return 'score-excellent';
  if (value >= 70) return 'score-good';
  if (value >= 45) return 'score-watch';
  return 'score-risk';
}

function normalizeCorporatePayload(payload, fallbackPrizes = DEFAULT_CORPORATE_PRIZES, readyLabel = 'Готов к ИИ', documentTypeLabel = 'Новый документ') {
  if (!payload || payload.error) {
    return null;
  }

  const employees = (payload.reviewPayload?.employees || []).map((employee) => ({
    id: employee.id,
    name: employee.name,
    role: employee.role,
    result: employee.result,
    solved: employee.solved,
    improved: employee.improved,
    trained: employee.trained,
    fileAccuracy: employee.fileAccuracy,
    usefulness: employee.usefulness,
    character: employee.character,
    fileBehavior: employee.fileBehavior,
    strengths: employee.strengths || [],
    skills: employee.skills || [],
  }));
  const prizesPayload = payload.prizesPayload;
  const prizes = prizesPayload
    ? {
        first: prizesPayload.firstPlace || fallbackPrizes.first,
        second: prizesPayload.secondPlace || fallbackPrizes.second,
        third: prizesPayload.thirdPlace || fallbackPrizes.third,
      }
    : fallbackPrizes;

  return {
    documents: (payload.docsPayload || []).map((document) => ({
      id: document.id,
      name: document.filename,
      type: document.mimeType || documentTypeLabel,
      status: document.status || readyLabel,
    })),
    taskDrafts: (payload.draftsPayload || []).map((draft) => ({
      id: draft.id,
      title: draft.title,
      clientType: draft.clientType,
      skill: draft.skill,
      difficulty: draft.difficulty,
      status: draft.status,
    })),
    reviewTotals: payload.reviewPayload?.totals || null,
    employees,
    selectedEmployeeId: employees[0]?.id || '',
    knowledgePayload: payload.knowledgePayload || null,
    prizes,
  };
}

function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [prefetchedCorporateData, setPrefetchedCorporateData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendDashboard, setIsBackendDashboard] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ru');
  const navigate = useNavigate();
  const location = useLocation();
  const isProfileView = location.pathname === '/home/profile';
  const profileCopy = DASHBOARD_PROFILE_COPY[lang] || DASHBOARD_PROFILE_COPY.ru;
  const corporateCopy = CORPORATE_COPY[lang] || CORPORATE_COPY.ru;

  const changeLang = (nextLang) => {
    setLang(nextLang);
    localStorage.setItem('app_lang', nextLang);
  };

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
        if (isActive) {
          setAuthToken(token || '');
        }

        const demoUser = demoUserForRole(localProfile.role);
        const backendProfile = await apiRequest('/api/me', { token: token || undefined, demoUser });
        const userProfile = mergeBackendProfileWithLocalState(backendProfile, localProfile);
        saveMockUser(userProfile);

        if (!hasCompletedOnboarding(userProfile)) {
          navigate('/onboarding', { replace: true });
          return;
        }

        const dashboardPath = userProfile.role === 'admin' ? '/api/admin/dashboard' : '/api/employee/dashboard';
        const dashboardPayload = await apiRequest(dashboardPath, { token: token || undefined, demoUser: demoUserForRole(userProfile.role) });
        let corporateData = null;
        const adminPage = getAdminPageFromPath(location.pathname);

        if (userProfile.role === 'admin' && adminPage && adminPage !== 'home' && !isProfileView) {
          try {
            corporateData = await fetchCorporateAdminPayload(token || undefined);
          } catch {
            corporateData = { error: true };
          }
        }

        if (isActive) {
          setProfile(userProfile);
          setDashboard(dashboardPayload);
          setPrefetchedCorporateData(corporateData);
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
          setDashboard(localProfile.role === 'admin' ? null : buildMockDashboard(localProfile));
          setPrefetchedCorporateData(localProfile.role === 'admin' ? { error: true } : null);
          setIsBackendDashboard(false);
          setAuthToken('');
          setError(loadError?.message ? `${corporateCopy.backendUnavailablePrefix}: ${loadError.message}` : '');
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [isProfileView, location.pathname, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearMockSession();
    navigate('/signin', { replace: true });
  };

  if (isLoading) {
    return <DashboardPageSkeleton adminPage={getAdminPageFromPath(location.pathname)} lang={lang} />;
  }

  const isAdminProfile = profile?.role === 'admin';
  const dashboardHeading = (
    <header className="admin-dashboard-hero">
      <div className="admin-dashboard-hero-head">
        <span className={`chip ${isBackendDashboard ? 'mint' : 'peach'}`}>
          {isBackendDashboard ? corporateCopy.liveBackend : corporateCopy.backendError}
        </span>
        <h3>{isAdminProfile ? corporateCopy.adminTitle : corporateCopy.employeeTitle}</h3>
        <p>
          {isAdminProfile
            ? isBackendDashboard
              ? corporateCopy.adminSubtitleLive
              : corporateCopy.adminSubtitleError
            : corporateCopy.employeeSubtitle}
        </p>
      </div>
      {profile?.onboarding ? (
        <div className="summary-chips">
          <span className="chip sky">{profile.onboarding.industryLabel || profile.onboarding.industry}</span>
          <span className="chip mint">{profile.goal || profile.onboarding.goalLabel}</span>
          {profile.onboardingAiSummary?.starterScenarioTitle ? (
            <span className="chip butter">{profile.onboardingAiSummary.starterScenarioTitle}</span>
          ) : null}
        </div>
      ) : null}
    </header>
  );

  return (
    <main className={`product-app paper dots-bg dashboard-page${isAdminProfile ? ' has-bottom-nav' : ''}`}>
      <BackgroundMusic />
      <TrainerFloatingDecor />
      <header className="app-header">
        <Link to="/home" className="app-logo">Training Loop</Link>
        <div className="header-user">
          {profile ? (
            <div className="header-user-info">
              <span className={`header-avatar ${profile.role}`}>{profile.name?.[0] || 'U'}</span>
              <span className="header-username">{profile.name}</span>
            </div>
          ) : null}
          <div className="home-header-actions admin-header-actions">
            <div className="language-control" aria-label="Language">
              <Languages size={16} aria-hidden="true" />
              {APP_LANGUAGES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={lang === item.code ? 'is-active' : undefined}
                  onClick={() => changeLang(item.code)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button" className="logout-button tap" onClick={handleSignOut}>
              <LogOut size={16} /> {profileCopy.signOut}
            </button>
          </div>
        </div>
      </header>

      {isProfileView && isAdminProfile ? (
        <DashboardProfileView profile={profile} copy={profileCopy} onSignOut={handleSignOut} />
      ) : profile?.role === 'admin' ? (
        <AdminDashboardView
          dashboard={dashboard}
          heading={dashboardHeading}
          error={error}
          token={authToken}
          organizationName={profile?.organizationName || ''}
          prefetchedCorporateData={prefetchedCorporateData}
          lang={lang}
        />
      ) : (
        <section className="dashboard-shell plush-lg paper popin">
          {dashboardHeading}
          {error ? <div className="toast-alert warning">{error}</div> : null}
          <EmployeeDashboardView dashboard={dashboard} lang={lang} />
        </section>
      )}

      {isAdminProfile ? (
        <nav className="dashboard-bottom-nav" aria-label={profileCopy.navAria}>
          <NavLink
            to="/home/profile"
            className={({ isActive }) => `dashboard-bottom-nav-link tap${isActive ? ' is-active' : ''}`}
          >
            <User size={20} aria-hidden="true" />
            <strong>{profileCopy.nav}</strong>
          </NavLink>
        </nav>
      ) : null}
    </main>
  );
}

function getAdminPageFromPath(pathname) {
  if (pathname === '/home' || pathname === '/home/') return 'home';
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard';
  if (pathname.startsWith('/dashboard/base')) return 'base';
  if (pathname.startsWith('/dashboard/assignments')) return 'assignments';
  if (pathname.startsWith('/dashboard/prizes')) return 'prizes';
  return null;
}

function AdminDashboardView({ dashboard, heading, error, token = '', organizationName = '', prefetchedCorporateData = null, lang = 'ru' }) {
  const location = useLocation();
  const activeAdminPage = getAdminPageFromPath(location.pathname);
  const corporateCopy = CORPORATE_COPY[lang] || CORPORATE_COPY.ru;
  const scenarios = dashboard?.scenarios || [];
  const initialCorporateState = normalizeCorporatePayload(prefetchedCorporateData, corporateCopy.defaultPrizes, corporateCopy.aiReady, corporateCopy.newDocument);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialCorporateState?.selectedEmployeeId || '');
  const [documents, setDocuments] = useState(initialCorporateState?.documents || []);
  const [taskDrafts, setTaskDrafts] = useState(initialCorporateState?.taskDrafts || []);
  const [employees, setEmployees] = useState(initialCorporateState?.employees || []);
  const [reviewTotals, setReviewTotals] = useState(initialCorporateState?.reviewTotals || null);
  const [corporateWarning, setCorporateWarning] = useState('');
  const [isCorporateLoading, setIsCorporateLoading] = useState(!prefetchedCorporateData);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingKnowledge, setIsGeneratingKnowledge] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [isAddingManualTask, setIsAddingManualTask] = useState(false);
  const [isSendingAssignments, setIsSendingAssignments] = useState(false);
  const [enabledSettings, setEnabledSettings] = useState({
    companyRules: true,
    aiPolicy: true,
    clientTypes: true,
    scoring: true,
  });
  const [sourcePrompt, setSourcePrompt] = useState(corporateCopy.defaults.sourcePrompt);
  const [companyBrief, setCompanyBrief] = useState(corporateCopy.defaults.companyBrief);
  const [rulesBrief, setRulesBrief] = useState(corporateCopy.defaults.rulesBrief);
  const [clientType, setClientType] = useState(corporateCopy.defaults.clientType);
  const [taskGoal, setTaskGoal] = useState(corporateCopy.defaults.taskGoal);
  const [scoringRules, setScoringRules] = useState(corporateCopy.defaults.scoringRules);
  const [clientSegment, setClientSegment] = useState('flexible');
  const [assignmentMode, setAssignmentMode] = useState('auto');
  const [employeeMode, setEmployeeMode] = useState('same');
  const [manualTask, setManualTask] = useState({
    title: '',
    clientType: '',
    skill: '',
    difficulty: 'medium',
    goal: '',
  });
  const [knowledgeCreated, setKnowledgeCreated] = useState(false);
  const [prizes, setPrizes] = useState(initialCorporateState?.prizes || corporateCopy.defaultPrizes);
  const [savedPrizes, setSavedPrizes] = useState(prizes);
  const [isPrizeSaved, setIsPrizeSaved] = useState(true);
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || employees[0] || null;
  const adminPages = [
    {
      id: 'dashboard',
      route: '/dashboard',
      label: corporateCopy.dashboard,
      badge: corporateCopy.dashboardBadge,
      emoji: '📊',
      desc: corporateCopy.dashboardDesc,
      accent: 'var(--sky)',
      badgeBg: 'var(--sky)',
    },
    {
      id: 'base',
      route: '/dashboard/base',
      label: corporateCopy.base,
      badge: corporateCopy.baseBadge,
      emoji: '📚',
      desc: corporateCopy.baseDesc,
      accent: 'var(--butter)',
      badgeBg: 'var(--butter)',
    },
    {
      id: 'assignments',
      route: '/dashboard/assignments',
      label: corporateCopy.assignments,
      badge: corporateCopy.assignmentsBadge,
      emoji: '🎯',
      desc: corporateCopy.assignmentsDesc,
      accent: 'var(--peach)',
      badgeBg: 'var(--peach)',
    },
    {
      id: 'prizes',
      route: '/dashboard/prizes',
      label: corporateCopy.prizes,
      badge: corporateCopy.prizesBadge,
      emoji: '🏆',
      desc: corporateCopy.prizesDesc,
      accent: 'var(--rose)',
      badgeBg: 'var(--rose)',
    },
  ];

  const applyCorporatePayload = (payload) => {
    if (payload?.error) {
      setCorporateWarning(corporateCopy.backendWarning);
      return;
    }

    const nextState = normalizeCorporatePayload(payload, prizes, corporateCopy.aiReady, corporateCopy.newDocument);
    if (!nextState) return;

    setDocuments(nextState.documents);
    setTaskDrafts(nextState.taskDrafts);
    if (nextState.knowledgePayload) {
      setKnowledgeCreated(true);
      setSourcePrompt(nextState.knowledgePayload.sourcePrompt || sourcePrompt);
      setCompanyBrief(nextState.knowledgePayload.companyBrief || '');
      setRulesBrief(nextState.knowledgePayload.rulesBrief || '');
      setClientType(nextState.knowledgePayload.clientTypes || '');
      setTaskGoal(nextState.knowledgePayload.taskGoal || '');
      setScoringRules(nextState.knowledgePayload.scoringRules || '');
      setEnabledSettings((currentSettings) => ({ ...currentSettings, ...(nextState.knowledgePayload.enabledSettings || {}) }));
    }
    setReviewTotals(nextState.reviewTotals);
    setEmployees(nextState.employees);
    setSelectedEmployeeId((currentId) => nextState.employees.some((employee) => employee.id === currentId) ? currentId : nextState.selectedEmployeeId);
    setPrizes(nextState.prizes);
    setSavedPrizes(nextState.prizes);
    setCorporateWarning('');
  };

  useEffect(() => {
    let isActive = true;

    async function loadCorporateAdmin() {
      if (prefetchedCorporateData) {
        applyCorporatePayload(prefetchedCorporateData);
        setIsCorporateLoading(false);
        return;
      }

      setIsCorporateLoading(true);
      try {
        const corporatePayload = await fetchCorporateAdminPayload(token);

        if (!isActive) return;

        applyCorporatePayload(corporatePayload);
      } catch {
        if (isActive) setCorporateWarning(corporateCopy.backendWarning);
      } finally {
        if (isActive) setIsCorporateLoading(false);
      }
    }

    loadCorporateAdmin();
    return () => {
      isActive = false;
    };
  }, [prefetchedCorporateData, token]);

  const persistKnowledgePatch = async (patch) => {
    try {
      await apiRequest('/api/corporate/admin/knowledge/current', {
        token,
        method: 'PATCH',
        body: patch,
      });
      setCorporateWarning('');
    } catch (actionError) {
      setCorporateWarning(actionError?.message || corporateCopy.backendWarning);
    }
  };

  const handleDocumentUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setIsUploading(true);
    try {
      const uploaded = await Promise.all(files.map((file) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiFormRequest('/api/corporate/admin/documents', { token, formData });
      }));
      setDocuments((currentDocuments) => [
        ...uploaded.map((document) => ({
          id: document.id,
          name: document.filename,
          type: document.mimeType || corporateCopy.newDocument,
          status: document.status || corporateCopy.aiReady,
        })),
        ...currentDocuments,
      ]);
      setCorporateWarning('');
    } catch (actionError) {
      setCorporateWarning(actionError?.message || corporateCopy.backendWarning);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const createKnowledgeBase = async () => {
    setIsGeneratingKnowledge(true);
    try {
      const payload = await apiRequest('/api/corporate/admin/knowledge/generate', {
        token,
        method: 'POST',
        body: {
          documentIds: documents.map((document) => document.id),
          sourcePrompt,
          language: lang,
        },
      });
      setKnowledgeCreated(true);
      setCompanyBrief(payload.companyBrief || companyBrief);
      setRulesBrief(payload.rulesBrief || rulesBrief);
      setClientType(payload.clientTypes || clientType);
      setTaskGoal(payload.taskGoal || taskGoal);
      setScoringRules(payload.scoringRules || scoringRules);
      setEnabledSettings((currentSettings) => ({ ...currentSettings, ...(payload.enabledSettings || {}) }));
      setCorporateWarning('');
    } catch (actionError) {
      setCorporateWarning(actionError?.message || corporateCopy.backendWarning);
    } finally {
      setIsGeneratingKnowledge(false);
    }
  };

  const updateKnowledgeField = (setter, key) => (event) => {
    const value = event.target.value;
    setter(value);
    if (knowledgeCreated) {
      persistKnowledgePatch({ [key]: value });
    }
  };

  const createAssignments = async () => {
    setIsGeneratingTasks(true);
    try {
      const payload = await apiRequest('/api/corporate/admin/task-drafts/generate', {
        token,
        method: 'POST',
        body: { count: 3, language: lang },
      });
      setTaskDrafts(payload.map((draft) => ({
        id: draft.id,
        title: draft.title,
        clientType: draft.clientType,
        skill: draft.skill,
        difficulty: draft.difficulty,
        status: draft.status,
      })));
      setCorporateWarning('');
    } catch (actionError) {
      const message = actionError?.message || '';
      setCorporateWarning(message.includes('Knowledge base has not been created') ? corporateCopy.createBaseFirst : message || corporateCopy.backendWarning);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const updateManualTask = (field) => (event) => {
    setManualTask((currentTask) => ({ ...currentTask, [field]: event.target.value }));
  };

  const addManualTask = async () => {
    const title = manualTask.title.trim();
    const clientTypeValue = manualTask.clientType.trim();
    const skill = manualTask.skill.trim();
    const goal = manualTask.goal.trim();

    if (!title || !clientTypeValue || !skill || !goal) {
      setCorporateWarning(corporateCopy.manualValidation);
      return;
    }

    setIsAddingManualTask(true);
    try {
      const draft = await apiRequest('/api/corporate/admin/task-drafts', {
        token,
        method: 'POST',
        body: {
          title,
          clientType: clientTypeValue,
          skill,
          difficulty: manualTask.difficulty,
          goal,
        },
      });
      setTaskDrafts((currentDrafts) => [
        {
          id: draft.id,
          title: draft.title,
          clientType: draft.clientType,
          skill: draft.skill,
          difficulty: draft.difficulty,
          status: draft.status,
        },
        ...currentDrafts,
      ]);
      setManualTask({
        title: '',
        clientType: '',
        skill: '',
        difficulty: 'medium',
        goal: '',
      });
      setCorporateWarning('');
    } catch (actionError) {
      setCorporateWarning(actionError?.message || corporateCopy.backendWarning);
    } finally {
      setIsAddingManualTask(false);
    }
  };

  const sendAssignments = async () => {
    const employeeIds = employees.map((employee) => employee.id);
    const draftIds = taskDrafts.map((task) => task.id);
    if (!employeeIds.length || !draftIds.length) {
      setCorporateWarning(corporateCopy.noEmployeesOrTasks);
      return;
    }
    setIsSendingAssignments(true);
    try {
      await apiRequest('/api/corporate/admin/task-drafts/assign', {
        token,
        method: 'POST',
        body: {
          taskDraftIds: draftIds,
          employeeIds,
          requiredScore: 80,
          mode: employeeMode,
        },
      });
      setCorporateWarning('');
    } catch (actionError) {
      setCorporateWarning(actionError?.message || corporateCopy.backendWarning);
    } finally {
      setIsSendingAssignments(false);
    }
  };

  const handlePrizeChange = (place, value) => {
    setPrizes((currentPrizes) => ({ ...currentPrizes, [place]: value }));
    setIsPrizeSaved(false);
  };

  const savePrizes = async () => {
    const nextPrizes = {
      first: prizes.first.trim(),
      second: prizes.second.trim(),
      third: prizes.third.trim(),
    };
    try {
      await apiRequest('/api/corporate/admin/prizes', {
        token,
        method: 'PATCH',
        body: {
          firstPlace: nextPrizes.first,
          secondPlace: nextPrizes.second,
          thirdPlace: nextPrizes.third,
        },
      });
      setSavedPrizes(nextPrizes);
      setIsPrizeSaved(true);
      setCorporateWarning('');
    } catch (actionError) {
      setCorporateWarning(actionError?.message || corporateCopy.backendWarning);
    }
  };

  const renderDashboard = () => (
    <>
      <div className="corporate-stats">
        <div className="stat-card company-stat">
          <span><Building2 size={18} /> {corporateCopy.company}</span>
          <strong>{dashboard?.organizationName || organizationName || dashboard?.organizationId || '-'}</strong>
        </div>
        <div className="stat-card">
          <span><FileText size={18} /> {corporateCopy.documents}</span>
          <strong>{reviewTotals?.documents ?? documents.length}</strong>
        </div>
        <div className="stat-card">
          <span><ClipboardCheck size={18} /> {corporateCopy.assignments}</span>
          <strong>{reviewTotals?.assignments ?? Math.max(scenarios.length, taskDrafts.length)}</strong>
        </div>
        <div className="stat-card">
          <span><TrendingUp size={18} /> {corporateCopy.averageGrowth}</span>
          <strong>{reviewTotals ? `${reviewTotals.averageGrowth >= 0 ? '+' : ''}${reviewTotals.averageGrowth}%` : '0%'}</strong>
        </div>
      </div>

      <section className="corporate-panel dashboard-insight-panel">
        <div className="panel-heading inline">
          <div>
            <span className="chip mint"><Users size={14} /> {corporateCopy.employees}</span>
            <h3>{corporateCopy.teamAnalytics}</h3>
            <p>{corporateCopy.teamAnalyticsDesc}</p>
          </div>
          {selectedEmployee ? <span className="chip butter"><TrendingUp size={14} /> {corporateCopy.usefulness}: {selectedEmployee.usefulness}%</span> : null}
        </div>

        {selectedEmployee ? (
        <div className="admin-employee-layout">
          <div className="admin-employee-list" role="table" aria-label={corporateCopy.employees}>
            <div className="admin-employee-table-head" role="row">
              <span role="columnheader">{corporateCopy.employee}</span>
              <span role="columnheader">{corporateCopy.role}</span>
              <span role="columnheader">{corporateCopy.result}</span>
            </div>
            {employees.map((employee) => {
              const scoreTone = corporateScoreTone(employee.result);
              return (
                <button
                  key={employee.id}
                  type="button"
                  className={`admin-employee-row ${scoreTone} ${selectedEmployeeId === employee.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  role="row"
                  style={{ '--employee-score': `${Math.max(0, Math.min(100, Number(employee.result) || 0))}%` }}
                >
                  <span className="employee-avatar">{employee.name[0]}</span>
                  <strong>{employee.name}</strong>
                  <small>{employee.role}</small>
                  <b>{employee.result}%</b>
                </button>
              );
            })}
          </div>

          <article
            className={`admin-employee-detail ${corporateScoreTone(selectedEmployee.result)}`}
            style={{ '--employee-score': `${Math.max(0, Math.min(100, Number(selectedEmployee.result) || 0))}%` }}
          >
            <div className="employee-skill-top">
              <span className="employee-avatar">{selectedEmployee.name[0]}</span>
              <div>
                <h4>{selectedEmployee.name}</h4>
                <p>{selectedEmployee.role} · {selectedEmployee.solved}</p>
              </div>
              <strong>{selectedEmployee.result}</strong>
            </div>
            <div className="admin-detail-grid">
              <div>
                <span>{corporateCopy.files}</span>
                <p>{selectedEmployee.fileBehavior}</p>
              </div>
              <div>
                <span>{corporateCopy.character}</span>
                <p>{selectedEmployee.character}</p>
              </div>
              <div>
                <span>{corporateCopy.strengths}</span>
                <p>{selectedEmployee.strengths.join(', ')}</p>
              </div>
              <div>
                <span>{corporateCopy.effect}</span>
                <p>{selectedEmployee.usefulness}% · {corporateCopy.fileAccuracy} {selectedEmployee.fileAccuracy}%</p>
              </div>
            </div>
            <div className="skill-bars">
              {selectedEmployee.skills.map((skill) => (
                <div key={skill.label} className="skill-row">
                  <span>{skill.label}</span>
                  <div className="skill-track"><i style={{ width: `${skill.value}%` }} /></div>
                  <b>{skill.value}%</b>
                </div>
              ))}
            </div>
          </article>
        </div>
        ) : (
          <p className="empty-state">{corporateCopy.noEmployees}</p>
        )}
      </section>
    </>
  );

  const renderBase = () => (
    <>
      <section className="corporate-panel admin-builder knowledge-base-panel">
        <div className="panel-heading">
          <span className="chip butter"><UploadCloud size={14} /> {corporateCopy.knowledgeBase}</span>
          <h3>{corporateCopy.baseTitle}</h3>
          <p>{corporateCopy.baseDescLong}</p>
        </div>

        <div className="admin-doc-layout">
          <label className="document-dropzone">
            <UploadCloud size={26} />
            <strong>{isUploading ? corporateCopy.uploading : corporateCopy.addDocuments}</strong>
            <span>{corporateCopy.uploadHint}</span>
            <input type="file" multiple onChange={handleDocumentUpload} />
          </label>

          <div className="admin-doc-list">
            {documents.map((document) => (
              <article key={document.id} className="admin-doc-item">
                <FileText size={17} />
                <div>
                  <strong>{document.name}</strong>
                  <span>{document.type}</span>
                </div>
                <small>{document.status}</small>
              </article>
            ))}
          </div>
        </div>

        <label className="builder-field">
          <span>{corporateCopy.promptLabel}</span>
          <textarea value={sourcePrompt} onChange={updateKnowledgeField(setSourcePrompt, 'sourcePrompt')} />
        </label>

        <div className="admin-action-row">
          <button type="button" className="btn-plush primary" onClick={createKnowledgeBase} disabled={isGeneratingKnowledge}>
            <Sparkles size={17} /> {isGeneratingKnowledge ? corporateCopy.creating : corporateCopy.createBase}
          </button>
          <span className={`chip ${knowledgeCreated ? 'mint' : 'butter'}`}>
            <Settings size={14} /> {knowledgeCreated ? corporateCopy.baseCreated : corporateCopy.manualFill}
          </span>
        </div>
      </section>

      <section className="corporate-panel scenario-builder-panel">
        <div className="panel-heading inline">
          <div>
            <span className="chip sky"><ShieldCheck size={14} /> {corporateCopy.constructor}</span>
            <h3>{corporateCopy.scenarioForms}</h3>
          </div>
          <div className="admin-inline-controls">
            <select className="compact-select" value={clientSegment} onChange={(event) => setClientSegment(event.target.value)}>
              <option value="flexible">{corporateCopy.clientFlexible}</option>
              <option value="b2b">{corporateCopy.clientB2b}</option>
              <option value="b2c">{corporateCopy.clientB2c}</option>
              <option value="vip">{corporateCopy.clientVip}</option>
            </select>
            <select className="compact-select" value={assignmentMode} onChange={(event) => setAssignmentMode(event.target.value)}>
              <option value="auto">{corporateCopy.aiBuildsTasks}</option>
              <option value="manual">{corporateCopy.fillManually}</option>
            </select>
          </div>
        </div>

        {isGeneratingKnowledge ? <CorporateKnowledgeFieldsSkeleton /> : <div className="admin-builder-grid wide">
          <label className="builder-field">
            <span>{corporateCopy.companyBrief}</span>
            <textarea value={companyBrief} onChange={updateKnowledgeField(setCompanyBrief, 'companyBrief')} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.rulesBrief}</span>
            <textarea value={rulesBrief} onChange={updateKnowledgeField(setRulesBrief, 'rulesBrief')} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.clientTypes}</span>
            <textarea value={clientType} onChange={updateKnowledgeField(setClientType, 'clientTypes')} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.taskGoal}</span>
            <textarea value={taskGoal} onChange={updateKnowledgeField(setTaskGoal, 'taskGoal')} />
          </label>
          <label className="builder-field span-2">
            <span>{corporateCopy.scoringRules}</span>
            <textarea value={scoringRules} onChange={updateKnowledgeField(setScoringRules, 'scoringRules')} />
          </label>
        </div>}
      </section>
    </>
  );

  const renderAssignments = () => (
    <section className="corporate-panel">
      <div className="panel-heading inline">
        <div>
          <span className="chip rose"><Target size={14} /> {corporateCopy.assignments}</span>
          <h3>{corporateCopy.assignmentsTitle}</h3>
        </div>
        <button type="button" className="btn-plush sm" onClick={sendAssignments} disabled={isSendingAssignments}>
          <Send size={15} /> {isSendingAssignments ? corporateCopy.sending : corporateCopy.send}
        </button>
      </div>

      <div className="admin-mode-panel">
        <label className="toggle-row">
          <input type="radio" name="employee-mode" checked={employeeMode === 'same'} onChange={() => setEmployeeMode('same')} />
          <span>{corporateCopy.sameMode}</span>
        </label>
        <label className="toggle-row">
          <input type="radio" name="employee-mode" checked={employeeMode === 'unique'} onChange={() => setEmployeeMode('unique')} />
          <span>{corporateCopy.uniqueMode}</span>
        </label>
      </div>

      <div className="manual-scenario-panel">
        <div className="panel-heading">
          <span className="chip butter"><ClipboardCheck size={14} /> {corporateCopy.fillManually}</span>
          <h3>{corporateCopy.manualScenarioTitle}</h3>
          <p>{corporateCopy.manualScenarioDesc}</p>
        </div>
        <div className="admin-builder-grid manual-scenario-grid">
          <label className="builder-field">
            <span>{corporateCopy.manualTitle}</span>
            <input value={manualTask.title} onChange={updateManualTask('title')} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.manualClientType}</span>
            <input value={manualTask.clientType} onChange={updateManualTask('clientType')} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.manualSkill}</span>
            <input value={manualTask.skill} onChange={updateManualTask('skill')} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.difficulty}</span>
            <select value={manualTask.difficulty} onChange={updateManualTask('difficulty')}>
              <option value="easy">{corporateCopy.manualDifficultyEasy}</option>
              <option value="medium">{corporateCopy.manualDifficultyMedium}</option>
              <option value="hard">{corporateCopy.manualDifficultyHard}</option>
            </select>
          </label>
          <label className="builder-field span-2">
            <span>{corporateCopy.manualGoal}</span>
            <textarea value={manualTask.goal} onChange={updateManualTask('goal')} />
          </label>
        </div>
        <div className="admin-action-row">
          <span className="chip mint">{corporateCopy.manualFill}</span>
          <button type="button" className="btn-plush sm primary" onClick={addManualTask} disabled={isAddingManualTask}>
            <ClipboardCheck size={15} /> {isAddingManualTask ? corporateCopy.addingManual : corporateCopy.addManual}
          </button>
        </div>
      </div>

      <div className="admin-action-row">
        <span className="chip sky">
          {employeeMode === 'same' ? corporateCopy.sameModeChip : corporateCopy.uniqueModeChip}
        </span>
        <button type="button" className="btn-plush sm primary" onClick={createAssignments} disabled={isGeneratingTasks}>
          <Target size={15} /> {isGeneratingTasks ? corporateCopy.generating : corporateCopy.generateByAi}
        </button>
      </div>

      <div className="rule-scene-list admin-task-grid">
        {isGeneratingTasks ? Array.from({ length: 3 }).map((_, index) => <CorporateTaskDraftSkeleton key={index} />) : (
          taskDrafts.length ? taskDrafts.map((task) => (
            <article key={task.id} className="rule-scene-card">
              <span className="chip sky">{task.status}</span>
              <h4>{task.title}</h4>
              <p>{task.clientType} · {task.skill}</p>
              <small>{corporateCopy.difficulty}: {task.difficulty}</small>
            </article>
          )) : <p className="empty-state span-2">{corporateCopy.noTaskDrafts}</p>
        )}
      </div>
    </section>
  );

  const renderPrizes = () => (
    <section className="corporate-panel">
      <div className="panel-heading inline">
        <div>
          <span className="chip butter"><Gift size={14} /> {corporateCopy.prizes}</span>
          <h3>{corporateCopy.prizesTitle}</h3>
        </div>
        <span className={`chip ${isPrizeSaved ? 'mint' : 'butter'}`}>
          {isPrizeSaved ? corporateCopy.saved : corporateCopy.draft}
        </span>
      </div>

      <div className="admin-prize-panel">
        <div className="admin-prize-fields">
          <label className="builder-field">
            <span>{corporateCopy.firstPlace}</span>
            <textarea value={prizes.first} onChange={(event) => handlePrizeChange('first', event.target.value)} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.secondPlace}</span>
            <textarea value={prizes.second} onChange={(event) => handlePrizeChange('second', event.target.value)} />
          </label>
          <label className="builder-field">
            <span>{corporateCopy.thirdPlace}</span>
            <textarea value={prizes.third} onChange={(event) => handlePrizeChange('third', event.target.value)} />
          </label>
        </div>
        <div className="admin-prize-preview">
          <strong>{corporateCopy.prizePreview}</strong>
          <p>{savedPrizes.first || corporateCopy.firstFallback}</p>
          <p>{savedPrizes.second || corporateCopy.secondFallback}</p>
          <p>{savedPrizes.third || corporateCopy.thirdFallback}</p>
          <button type="button" className="btn-plush sm" onClick={savePrizes}>
            <ClipboardCheck size={15} /> {corporateCopy.save}
          </button>
        </div>
      </div>
    </section>
  );

  const renderActivePage = () => {
    if (isCorporateLoading) return <CorporatePageSkeleton page={activeAdminPage} lang={lang} />;
    if (activeAdminPage === 'base') return renderBase();
    if (activeAdminPage === 'assignments') return renderAssignments();
    if (activeAdminPage === 'prizes') return renderPrizes();
    return renderDashboard();
  };

  if (!activeAdminPage) {
    return <Navigate to="/home" replace />;
  }

  const isAdminHome = activeAdminPage === 'home';
  const isDashboardPage = activeAdminPage === 'dashboard';
  const currentPage = adminPages.find((page) => page.id === activeAdminPage);

  if (isAdminHome) {
    return (
      <>
        {heading}
        {error ? <div className="toast-alert warning">{error}</div> : null}
        {corporateWarning ? <div className="toast-alert warning">{corporateWarning}</div> : null}

        <nav className="admin-mode-cards mode-cards-grid admin-mode-cards-standalone" aria-label="Admin sections">
          {adminPages.map((page) => (
            <Link
              key={page.id}
              to={page.route}
              className="admin-mode-card tap popin"
            >
              <span className="admin-mode-badge" style={{ background: page.badgeBg }}>{page.badge}</span>
              <span className="admin-mode-emoji" style={{ background: page.accent }}>{page.emoji}</span>
              <span className="admin-mode-copy">
                <strong>{page.label}</strong>
                <small>{page.desc}</small>
              </span>
              <span className="admin-mode-cta">{corporateCopy.open} →</span>
            </Link>
          ))}
        </nav>
      </>
    );
  }

  if (isDashboardPage) {
    return (
      <section className="dashboard-shell plush-lg paper popin dashboard-shell-content admin-section-page">
        <div className="admin-section-topbar">
          <Link to="/home" className="btn-plush sm admin-section-back">
            <ArrowLeft size={16} /> {corporateCopy.homeBack}
          </Link>
          {currentPage ? (
            <div className="admin-section-heading">
              <span className="admin-mode-badge" style={{ background: currentPage.badgeBg }}>{currentPage.badge}</span>
              <strong>{currentPage.label}</strong>
            </div>
          ) : null}
        </div>
        {error ? <div className="toast-alert warning">{error}</div> : null}
        {corporateWarning ? <div className="toast-alert warning">{corporateWarning}</div> : null}
        {isCorporateLoading ? <CorporatePageSkeleton page="dashboard" lang={lang} /> : <div className="corporate-dashboard">{renderDashboard()}</div>}
      </section>
    );
  }

  return (
    <section className="dashboard-shell plush-lg paper popin dashboard-shell-content admin-section-page">
      <div className="admin-section-topbar">
        <Link to="/home" className="btn-plush sm admin-section-back">
          <ArrowLeft size={16} /> {corporateCopy.homeBack}
        </Link>
        {currentPage ? (
          <div className="admin-section-heading">
            <span className="admin-mode-badge" style={{ background: currentPage.badgeBg }}>{currentPage.badge}</span>
            <strong>{currentPage.label}</strong>
          </div>
        ) : null}
      </div>
      {error ? <div className="toast-alert warning">{error}</div> : null}
      {corporateWarning ? <div className="toast-alert warning">{corporateWarning}</div> : null}
      <div className="corporate-dashboard">{renderActivePage()}</div>
    </section>
  );
}

function EmployeeDashboardView({ dashboard, lang = 'ru' }) {
  const navigate = useNavigate();
  const corporateCopy = CORPORATE_COPY[lang] || CORPORATE_COPY.ru;
  const assignments = dashboard?.assignments || [];
  const [industry, setIndustry] = useState('optional');
  const [trainingMode, setTrainingMode] = useState('gentle');
  const [showHints, setShowHints] = useState(true);
  const companyTasks = EMPLOYEE_COMPANY_TASKS.map((task, index) => ({
    ...task,
    backendAssignment: assignments[index],
  }));

  const startTask = (task) => {
    navigate('/simulation', {
      state: {
        scenarioTitle: task.title,
        industryName: industry === 'optional'
          ? corporateCopy.companyAssignment
          : CORPORATE_INDUSTRY_CHOICES.find((item) => item.id === industry)?.label,
        industryIcon: industry === 'optional'
          ? '🏢'
          : CORPORATE_INDUSTRY_CHOICES.find((item) => item.id === industry)?.icon,
      },
    });
  };

  return (
    <div className="employee-home">
      <section className="corporate-panel employee-settings">
        <div className="panel-heading">
          <span className="chip sky"><Settings size={14} /> {corporateCopy.employeeSettings}</span>
          <h3>{corporateCopy.employeeModeTitle}</h3>
          <p>{corporateCopy.employeeModeDesc}</p>
        </div>

        <div className="settings-grid">
          <label className="builder-field">
            <span>{corporateCopy.optionalIndustry}</span>
            <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
              <option value="optional">{corporateCopy.noIndustryNow}</option>
              {CORPORATE_INDUSTRY_CHOICES.map((item) => (
                <option key={item.id} value={item.id}>{item.icon} {item.label}</option>
              ))}
            </select>
          </label>
          <label className="builder-field">
            <span>{corporateCopy.difficulty}</span>
            <select value={trainingMode} onChange={(event) => setTrainingMode(event.target.value)}>
              <option value="gentle">{corporateCopy.gentleMode}</option>
              <option value="realistic">{corporateCopy.realisticMode}</option>
              <option value="hard">{corporateCopy.hardMode}</option>
            </select>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={showHints} onChange={(event) => setShowHints(event.target.checked)} />
            <span>{corporateCopy.showHints}</span>
          </label>
        </div>
      </section>

      <section className="corporate-panel">
        <div className="panel-heading inline">
          <div>
            <span className="chip butter"><Target size={14} /> {corporateCopy.companyTasks}</span>
            <h3>{corporateCopy.adminScenes}</h3>
          </div>
          <span className="chip mint">{companyTasks.length} {corporateCopy.active}</span>
        </div>

        <div className="company-task-list">
          {companyTasks.map((task) => (
            <article key={task.id} className="company-task-card">
              <div>
                <span className="chip rose">{task.due}</span>
                <h4>{task.title}</h4>
                <p>{task.scenario.scene}</p>
                <small>{task.source} · {corporateCopy.requiredScore} {task.requiredScore}%</small>
              </div>
              <button type="button" className="btn-plush sm primary" onClick={() => startTask(task)}>
                <Play size={15} /> {corporateCopy.start}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="corporate-panel employee-progress">
        <div className="stat-card">
          <span>{corporateCopy.assigned}</span>
          <strong>{Math.max(assignments.length, companyTasks.length)}</strong>
        </div>
        <div className="stat-card">
          <span>{corporateCopy.completed}</span>
          <strong>{assignments.filter((assignment) => assignment.status === 'completed').length}</strong>
        </div>
        <div className="stat-card">
          <span>{corporateCopy.mode}</span>
          <strong>{trainingMode === 'hard' ? 'Hard' : trainingMode === 'realistic' ? 'Real' : 'Soft'}</strong>
        </div>
      </section>
    </div>
  );
}

function SimulationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    caseId,
    scenarioId,
    scenarioTitle,
    scenarioXpReward,
    scenarioCoinReward,
    dailyQuest,
    industryName,
    industryIcon,
    quickPractice,
    scenarioGoal,
    aiPersona,
    patientType,
  } = location.state || {};
  const lang = localStorage.getItem('app_lang') || 'ru';

  return (
    <SimulationScene
      initialCaseId={caseId}
      scenarioId={scenarioId}
      scenarioTitle={scenarioTitle}
      scenarioXpReward={scenarioXpReward}
      scenarioCoinReward={scenarioCoinReward}
      dailyQuest={dailyQuest}
      industryName={industryName}
      industryIcon={industryIcon}
      quickPractice={quickPractice}
      onBackToDashboard={() => navigate('/home', { replace: true })}
      scenarioGoal={scenarioGoal}
      aiPersona={aiPersona}
      patientType={patientType}
      language={lang}
    />
  );
}

function RootRedirect() {
  const user = getMockUser();
  if (hasMockSession() && user) {
    return <Navigate to={hasCompletedOnboarding(user) ? '/home' : '/onboarding'} replace />;
  }
  return <Navigate to="/signin" replace />;
}

function TrainerSessionGate() {
  const location = useLocation();
  const user = getMockUser();
  if (!hasMockSession() || !user) {
    return <Navigate to="/signin" replace />;
  }
  if (!hasCompletedOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }
  if (user.role === 'admin') {
    if (location.pathname === '/home' || location.pathname.startsWith('/home/')) {
      return <DashboardPage />;
    }
    return <Navigate to="/home" replace />;
  }
  return <CommTrainerExperience />;
}

function CorporateHomeGate() {
  const user = getMockUser();
  if (!hasMockSession() || !user) {
    return <Navigate to="/signin" replace />;
  }
  if (!hasCompletedOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }
  return user.role === 'admin' ? <DashboardPage /> : <Navigate to="/home" replace />;
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
        <Route path="/dashboard/*" element={<CorporateHomeGate />} />
        <Route path="/simulation" element={<SimulationGate />} />
        <Route path="*" element={<TrainerSessionGate />} />
      </Routes>
    </BrowserRouter>
  );
}
