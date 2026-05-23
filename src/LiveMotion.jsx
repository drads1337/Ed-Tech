import { Sparkles } from 'lucide-react';
import * as THREE from 'three';

export const LIVE_MOTION_MODES = [
  { id: 'idle', label: 'Покой' },
  { id: 'listening', label: 'Слушает' },
  { id: 'thinking', label: 'Думает' },
  { id: 'talking', label: 'Говорит' },
  { id: 'gesture', label: 'Жест рукой' },
];

export const EMOTION_MODES = [
  { id: 'neutral', label: 'Нейтрально' },
  { id: 'happy', label: 'Радостный' },
  { id: 'angry', label: 'Злой' },
  { id: 'sad', label: 'Расстроенный' },
];

const EMOTION_STATUS = {
  neutral: {
    title: 'Нейтрально',
    summary: 'спокойный, ровный, хороший контакт',
    scores: [
      ['Хороший', 62],
      ['Злой', 4],
      ['Радостный', 18],
      ['Расстроенный', 8],
    ],
  },
  happy: {
    title: 'Радостный',
    summary: 'открытый, доброжелательный, энергичный',
    scores: [
      ['Хороший', 92],
      ['Злой', 0],
      ['Радостный', 88],
      ['Расстроенный', 2],
    ],
  },
  angry: {
    title: 'Злой',
    summary: 'напряженный, резкий, недовольный',
    scores: [
      ['Хороший', 12],
      ['Злой', 86],
      ['Радостный', 3],
      ['Расстроенный', 28],
    ],
  },
  sad: {
    title: 'Расстроенный',
    summary: 'поникший, тихий, уставший',
    scores: [
      ['Хороший', 24],
      ['Злой', 8],
      ['Радостный', 5],
      ['Расстроенный', 82],
    ],
  },
};

const MOTION_BUBBLE_TEXT = {
  idle: 'Я здесь. Слушаю.',
  listening: 'Понимаю, продолжайте.',
  thinking: 'Секунду, я думаю...',
  talking: 'Давайте разберем это.',
  gesture: 'Вот сюда, обратите внимание.',
};

export function getEmotionStatus(emotionMode) {
  return EMOTION_STATUS[emotionMode] || EMOTION_STATUS.neutral;
}

export function getSpeechBubbleText(liveMotion, emotionMode) {
  return 'Вы отвечайте';
}

export function LiveMotionPanel({ activeMode, activeEmotion, onChangeMode, onChangeEmotion }) {
  return (
    <aside className="motion-panel" aria-label="Live motion controls">
      <div className="panel-heading">
        <Sparkles size={16} />
        <h2>Живость модели</h2>
      </div>
      <div className="motion-buttons">
        {LIVE_MOTION_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`motion-button ${activeMode === mode.id ? 'is-active' : ''}`}
            onClick={() => onChangeMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="motion-section">
        <strong>Эмоция</strong>
        <div className="motion-buttons">
          {EMOTION_MODES.map((emotion) => (
            <button
              key={emotion.id}
              type="button"
              className={`motion-button ${activeEmotion === emotion.id ? 'is-active' : ''}`}
              onClick={() => onChangeEmotion(emotion.id)}
            >
              {emotion.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function EmotionStatusPanel({ emotionMode }) {
  const status = getEmotionStatus(emotionMode);

  return (
    <aside className="emotion-status-panel" aria-label="Current emotion status">
      <span>Эмоция сейчас</span>
      <strong>{status.title}</strong>
      <p>{status.summary}</p>
      <div className="emotion-score-list">
        {status.scores.map(([label, value]) => (
          <div key={label} className="emotion-score-row">
            <span>{label}</span>
            <meter min="0" max="100" value={value} />
            <strong>{value}%</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function getLiveMotionAdjustments(boneName, motionMode, time) {
  const name = String(boneName || '').toLowerCase();
  const wave = Math.sin(time * 2.4);
  const fastWave = Math.sin(time * 7.2);
  const slowWave = Math.sin(time * 1.35);
  const isHead = name.includes('head');
  const isNeck = name.includes('neck');
  const isSpine = name.includes('spine') || name.includes('torso') || name.includes('chest');
  const isLeftArm = name.includes('left') || name.endsWith('l') || name.includes('_l');
  const isRightArm = name.includes('right') || name.endsWith('r') || name.includes('_r');
  const isArm =
    name.includes('arm') ||
    name.includes('shoulder') ||
    name.includes('forearm') ||
    name.includes('hand') ||
    name.includes('wrist');
  const isMouth =
    name.includes('jaw') ||
    name.includes('mouth') ||
    name.includes('lip') ||
    name.includes('chin') ||
    name.includes('brow');

  switch (motionMode) {
    case 'idle':
      if (isHead) {
        return { x: THREE.MathUtils.degToRad(wave * 0.9), y: THREE.MathUtils.degToRad(slowWave * 1.2), z: THREE.MathUtils.degToRad(slowWave * 0.7) };
      }
      if (isNeck) {
        return { x: THREE.MathUtils.degToRad(wave * 0.7), y: THREE.MathUtils.degToRad(slowWave * 0.9), z: 0 };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(slowWave * 1.2), y: THREE.MathUtils.degToRad(wave * 0.45), z: THREE.MathUtils.degToRad(slowWave * 0.55) };
      }
      if (isArm && (isLeftArm || isRightArm)) {
        const side = isLeftArm ? -1 : 1;
        return { x: THREE.MathUtils.degToRad(slowWave * 1.1), y: 0, z: THREE.MathUtils.degToRad(side * slowWave * 0.9) };
      }
      break;
    case 'listening':
      if (isHead) {
        return { x: THREE.MathUtils.degToRad(5 + wave * 3.8), y: THREE.MathUtils.degToRad(slowWave * 3.4), z: THREE.MathUtils.degToRad(slowWave * 1.4) };
      }
      if (isNeck) {
        return { x: THREE.MathUtils.degToRad(3 + wave * 2.4), y: THREE.MathUtils.degToRad(slowWave * 2), z: 0 };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(slowWave * 1.7), y: THREE.MathUtils.degToRad(wave * 0.8), z: 0 };
      }
      break;
    case 'thinking':
      if (isHead || isNeck) {
        return { x: THREE.MathUtils.degToRad(-4.5 + slowWave * 2.6), y: THREE.MathUtils.degToRad(3.8), z: THREE.MathUtils.degToRad(slowWave * 2.8) };
      }
      if (isArm && isRightArm) {
        return { x: THREE.MathUtils.degToRad(-10 + wave * 4.8), y: THREE.MathUtils.degToRad(7.5), z: THREE.MathUtils.degToRad(4.2) };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(1.8 + slowWave * 1.2), y: 0, z: THREE.MathUtils.degToRad(slowWave * 0.9) };
      }
      break;
    case 'talking':
      if (isMouth) {
        return { x: THREE.MathUtils.degToRad(Math.max(0, fastWave) * 12), y: 0, z: 0 };
      }
      if (isHead || isNeck) {
        return { x: THREE.MathUtils.degToRad(wave * 3), y: THREE.MathUtils.degToRad(slowWave * 2.8), z: THREE.MathUtils.degToRad(slowWave * 1.1) };
      }
      if (isArm && (isLeftArm || isRightArm)) {
        const side = isLeftArm ? -1 : 1;
        return { x: THREE.MathUtils.degToRad(wave * 6.2), y: THREE.MathUtils.degToRad(side * 3.2), z: THREE.MathUtils.degToRad(side * slowWave * 3.4) };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(wave * 1.8), y: THREE.MathUtils.degToRad(slowWave * 1.2), z: 0 };
      }
      break;
    case 'gesture':
      if (isArm && isRightArm) {
        return { x: THREE.MathUtils.degToRad(Math.sin(time * 3.4) * 20), y: THREE.MathUtils.degToRad(11), z: THREE.MathUtils.degToRad(Math.cos(time * 3.4) * 14) };
      }
      if (isArm && isLeftArm) {
        return { x: THREE.MathUtils.degToRad(Math.sin(time * 2.1) * 4.5), y: 0, z: THREE.MathUtils.degToRad(-4.6) };
      }
      if (isHead || isNeck) {
        return { x: THREE.MathUtils.degToRad(wave * 2.7), y: THREE.MathUtils.degToRad(slowWave * 2.6), z: THREE.MathUtils.degToRad(slowWave * 1.1) };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(slowWave * 2), y: THREE.MathUtils.degToRad(wave * 1.2), z: 0 };
      }
      break;
    default:
      break;
  }

  return null;
}

export function getEmotionAdjustments(boneName, emotionMode, time) {
  const name = String(boneName || '').toLowerCase();
  const softWave = Math.sin(time * 1.4);
  const isHead = name.includes('head');
  const isNeck = name.includes('neck');
  const isSpine = name.includes('spine') || name.includes('torso') || name.includes('chest');
  const isLeft = name.includes('left') || name.endsWith('l') || name.includes('_l');
  const isRight = name.includes('right') || name.endsWith('r') || name.includes('_r');
  const isShoulder = name.includes('shoulder') || name.includes('clavicle');
  const isArm = name.includes('arm') || name.includes('forearm') || name.includes('hand') || name.includes('wrist');
  const isMouth = name.includes('jaw') || name.includes('mouth') || name.includes('lip') || name.includes('chin');
  const isBrow = name.includes('brow') || name.includes('eyebrow');

  switch (emotionMode) {
    case 'happy':
      if (isHead || isNeck) {
        return { x: THREE.MathUtils.degToRad(-2 + softWave * 0.8), y: THREE.MathUtils.degToRad(softWave * 0.7), z: 0 };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(-1.8), y: 0, z: 0 };
      }
      if (isShoulder || isArm) {
        const side = isLeft ? -1 : isRight ? 1 : 0;
        return { x: THREE.MathUtils.degToRad(-2.4), y: THREE.MathUtils.degToRad(side * 1.5), z: THREE.MathUtils.degToRad(side * 1.2) };
      }
      if (isMouth) {
        return { x: THREE.MathUtils.degToRad(2.8), y: 0, z: 0 };
      }
      if (isBrow) {
        return { x: THREE.MathUtils.degToRad(-2), y: 0, z: 0 };
      }
      break;
    case 'angry':
      if (isHead || isNeck) {
        return { x: THREE.MathUtils.degToRad(3.8), y: THREE.MathUtils.degToRad(softWave * 0.35), z: THREE.MathUtils.degToRad(isLeft ? -0.8 : 0.8) };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(2.4), y: 0, z: 0 };
      }
      if (isShoulder || isArm) {
        const side = isLeft ? -1 : isRight ? 1 : 0;
        return { x: THREE.MathUtils.degToRad(2.6), y: THREE.MathUtils.degToRad(side * -2), z: THREE.MathUtils.degToRad(side * -2.8) };
      }
      if (isMouth) {
        return { x: THREE.MathUtils.degToRad(-1.4), y: 0, z: 0 };
      }
      if (isBrow) {
        return { x: THREE.MathUtils.degToRad(4.6), y: 0, z: THREE.MathUtils.degToRad(isLeft ? 2 : -2) };
      }
      break;
    case 'sad':
      if (isHead || isNeck) {
        return { x: THREE.MathUtils.degToRad(5.4 + softWave * 0.5), y: THREE.MathUtils.degToRad(-0.7), z: 0 };
      }
      if (isSpine) {
        return { x: THREE.MathUtils.degToRad(3.2), y: 0, z: 0 };
      }
      if (isShoulder || isArm) {
        const side = isLeft ? -1 : isRight ? 1 : 0;
        return { x: THREE.MathUtils.degToRad(3.8), y: 0, z: THREE.MathUtils.degToRad(side * -1.5) };
      }
      if (isMouth) {
        return { x: THREE.MathUtils.degToRad(-2.2), y: 0, z: 0 };
      }
      if (isBrow) {
        return { x: THREE.MathUtils.degToRad(2.8), y: 0, z: 0 };
      }
      break;
    default:
      break;
  }

  return null;
}
