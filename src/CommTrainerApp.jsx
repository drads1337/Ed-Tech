import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { ArrowLeft, BarChart3, Play, RefreshCw, Send, Sparkles } from 'lucide-react';
import { achievements, industries, mockXpHistory, quests, scenarios } from './data/mockData.js';

const STORAGE_KEY = 'pro-communication-trainer:v1';
const todayKey = () => new Date().toISOString().slice(0, 10);

const DEFAULT_PROGRESS = {
  streak: 6,
  xp: 320,
  coins: 42,
  notifications: 3,
  mode: 'keyboard',
  questDoneDate: '',
  completed: {
    med_01: { rating: 2, xp: 15, coins: 8, date: '2026-05-21' },
  },
  attempts: [
    {
      id: 'seed-med-01',
      scenarioId: 'med_01',
      date: '2026-05-21',
      rating: 2,
      xpGained: 15,
      coinsGained: 8,
      transcript: [
        { role: 'ai', text: 'У меня здесь колет... уже третий день. Что это может быть?' },
        { role: 'user', text: 'Покажите, где болит, и какая боль по характеру?' },
      ],
      checks: [{ expected: ['локализация', 'характер боли', 'иррадиация'], matched: ['локализация', 'характер боли'] }],
      early: false,
    },
  ],
  settings: {
    reminders: true,
    sound: true,
    coachTips: true,
  },
};

const aliasMap = {
  локализация: ['где', 'мест', 'покаж', 'локализац'],
  'характер боли': ['характер', 'какая боль', 'колет', 'жжет', 'давит'],
  иррадиация: ['отда', 'плеч', 'рук', 'челюст'],
  одышка: ['одыш', 'дыш'],
  тошнота: ['тошн'],
  пот: ['пот', 'вспот'],
  скорая: ['скор', 'сроч'],
  безопасность: ['безопас', 'сяд', 'не нагруж'],
  спокойно: ['спокой', 'без паник'],
  понимаю: ['понима', 'вижу', 'слышу'],
  тревогу: ['тревог', 'боит', 'страш'],
  осмотр: ['осмотр', 'врач', 'прием'],
  пьёт: ['пьет', 'пил', 'пить'],
  мочился: ['моч', 'подгуз'],
  сыпь: ['сып'],
  передам: ['передам', 'сообщу'],
  врач: ['врач', 'доктор'],
  рядом: ['рядом', 'с вами'],
  стыд: ['стыд'],
  злость: ['зл', 'серд'],
  слышится: ['слыш', 'похоже'],
  страх: ['страх', 'пуга'],
  последствия: ['последств'],
  важно: ['важн'],
  варианты: ['вариант'],
  контакт: ['контакт', 'отношен'],
  границы: ['границ'],
  безопасность: ['безопас'],
  навредить: ['навред', 'себе'],
  план: ['план'],
  взрослый: ['взросл', 'родител', 'учител'],
  таблетки: ['таблет'],
  связь: ['связ', 'звон'],
  усилия: ['усили', 'влож'],
  критерии: ['критер'],
  'не сравнивать': ['не срав', 'чуж'],
  'ваша работа': ['ваш'],
  пример: ['пример'],
  доработка: ['доработ'],
  срок: ['срок', 'когда'],
  смысл: ['смысл'],
  мешает: ['меша', 'барьер'],
  расскажите: ['расскаж'],
  работа: ['работ'],
  'маленький шаг': ['маленьк', '15 минут', 'шаг'],
  напоминание: ['напомин'],
  время: ['время'],
  договоримся: ['договор'],
  сравнить: ['сравн'],
  задачи: ['задач'],
  платежи: ['платеж'],
  поддержка: ['поддерж'],
  выгода: ['выгод'],
  период: ['период', 'срок'],
  пересмотр: ['пересмотр'],
  'без давления': ['без давл'],
  просадка: ['просад'],
  'не зафиксировали': ['не зафикс', 'не продали'],
  риск: ['риск'],
  горизонт: ['горизонт'],
  диверсификация: ['диверсиф'],
  цель: ['цель'],
  порог: ['порог'],
  неприятно: ['неприят'],
  проверю: ['провер'],
  тихий: ['тих'],
  сегодня: ['сегодня'],
  компенсация: ['компенсац'],
  правила: ['правил'],
  менеджер: ['менеджер'],
  'номер заказа': ['номер', 'заказ'],
  '4821': ['4821'],
  минуту: ['минут'],
  решение: ['решен'],
  жалоба: ['жалоб'],
  проверим: ['провер'],
  список: ['список'],
  паспорт: ['паспорт'],
  заявление: ['заявлен'],
  выписка: ['выписк'],
  окно: ['окно'],
  вернуться: ['верн'],
  'причина отказа': ['причин', 'отказ'],
  'простыми словами': ['прост'],
  подтверждение: ['подтвержд'],
  документ: ['документ'],
  перечень: ['переч'],
  'повторная подача': ['повтор', 'подать'],
  дедлайн: ['дедлайн', 'срок'],
  влияние: ['влия'],
  ресурсы: ['ресурс'],
  приоритет: ['приоритет'],
  фиксируем: ['фиксир'],
  черновик: ['чернов'],
  завтра: ['завтра'],
  объём: ['объем', 'объём'],
  минимум: ['минимум'],
  качество: ['качеств'],
  данные: ['данн'],
  проверка: ['провер'],
  согласуем: ['соглас'],
};

const navItems = [
  { to: '/home', label: 'Home', icon: '🏠' },
  { to: '/plan', label: 'Plan', icon: '🗺️' },
  { to: '/library', label: 'Library', icon: '📚' },
  { to: '/progress', label: 'Progress', icon: '📊' },
  { to: '/practice', label: 'Practice', icon: '🎮' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

function loadProgress() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return DEFAULT_PROGRESS;
    }

    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      completed: { ...DEFAULT_PROGRESS.completed, ...(parsed.completed || {}) },
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : DEFAULT_PROGRESS.attempts,
      settings: { ...DEFAULT_PROGRESS.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function getIndustry(industryId) {
  return industries.find((industry) => industry.id === industryId) || industries[0];
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replaceAll('ё', 'е');
}

function getMatchedTerms(text, expected = []) {
  const normalized = normalizeText(text);

  return expected.filter((term) => {
    const normalizedTerm = normalizeText(term);
    const root = normalizedTerm.length > 5 ? normalizedTerm.slice(0, 5) : normalizedTerm;
    const aliases = aliasMap[normalizedTerm] || [];
    return [normalizedTerm, root, ...aliases].some((candidate) => candidate && normalized.includes(candidate));
  });
}

function getDifficultyLabel(level) {
  return ['Лёгкая', 'Средняя', 'Сложная'][Math.max(0, Math.min(2, Number(level) - 1))] || 'Средняя';
}

function getDifficultyStars(level) {
  return '●'.repeat(level) + '○'.repeat(Math.max(0, 3 - level));
}

function getScenarioStatus(scenario, index, progress) {
  const completed = progress.completed[scenario.id];
  if (completed) {
    return { label: 'completed', icon: '🟢', rating: completed.rating };
  }

  const previousScenario = scenarios[index - 1];
  const isOpen = index <= 1 || !previousScenario || progress.completed[previousScenario.id];
  return isOpen ? { label: 'open', icon: '🔓', rating: 0 } : { label: 'locked', icon: '🔒', rating: 0 };
}

function calculateRating(checks, early) {
  const total = checks.reduce((sum, check) => sum + check.expected.length, 0);
  const hits = checks.reduce((sum, check) => sum + check.matched.length, 0);
  const ratio = total > 0 ? hits / total : 0.4;
  const adjustedRatio = early ? ratio * 0.65 : ratio;

  if (adjustedRatio >= 0.74) {
    return 3;
  }

  if (adjustedRatio >= 0.42) {
    return 2;
  }

  return 1;
}

function RatingStars({ rating = 0 }) {
  return (
    <span className="rating-stars" aria-label={`${rating} из 3`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(Math.max(0, 3 - rating))}
    </span>
  );
}

function StatPill({ icon, label }) {
  return (
    <span className="trainer-stat-pill">
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          <span aria-hidden="true">{item.icon}</span>
          <strong>{item.label}</strong>
        </NavLink>
      ))}
    </nav>
  );
}

function PageTop({ title, subtitle, backTo }) {
  return (
    <header className="page-top">
      <div>
        {backTo ? (
          <Link className="back-link" to={backTo}>
            <ArrowLeft size={18} aria-hidden="true" /> Назад
          </Link>
        ) : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}

function LearningPathMap({ progress }) {
  const navigate = useNavigate();

  return (
    <div className="snake-map">
      <svg className="snake-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 62 5 C 76 9, 78 12, 58 14 S 28 19, 46 23 S 58 29, 38 32 S 38 38, 62 41 S 56 47, 33 50 S 30 56, 48 59 S 82 65, 70 68 S 28 74, 42 77 S 72 83, 60 86 S 18 91, 31 93 S 66 96, 50 98 S 68 100, 34 103" />
      </svg>
      {scenarios.map((scenario, index) => {
        const status = getScenarioStatus(scenario, index, progress);
        const industry = getIndustry(scenario.industry);
        const disabled = status.label === 'locked';
        const isCurrent = status.label === 'open' && !progress.completed[scenario.id];

        return (
          <article key={scenario.id} className={`snake-step step-${index + 1} ${status.label}`}>
            <button
              className="snake-node"
              type="button"
              onClick={() => !disabled && navigate(`/scenario/${scenario.id}`)}
              disabled={disabled}
              aria-label={`${scenario.title}: ${status.label}`}
            >
              <span className="node-shine" />
              <span className="node-icon">
                {status.label === 'locked' ? '🔒' : status.label === 'completed' ? '✓' : industry.icon}
              </span>
              {isCurrent ? <span className="start-bubble">Начать</span> : null}
            </button>

            <div className="snake-caption">
              <h3>{scenario.title}</h3>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function HomePage({ progress }) {
  const navigate = useNavigate();
  const quest = quests[0];
  const questDone = progress.questDoneDate === todayKey();
  const questTarget = scenarios.find((scenario) => scenario.skill === quest.targetSkill) || scenarios[0];

  return (
    <section className="screen home-screen">
      <header className="home-header plush-lg">
        <div className="home-brand">
          <div className="brand-mark" aria-hidden="true">
            💬
          </div>
          <div>
            <span className="eyebrow">ProComm Trainer</span>
            <h1>Тренажёр коммуникаций</h1>
          </div>
        </div>

        <div className="home-metrics" aria-label="Показатели пользователя">
          <StatPill icon="🔥" label={`${progress.streak} дней`} />
          <StatPill icon="⭐" label={`${progress.xp} XP`} />
          <button className="icon-pill" type="button" aria-label="Уведомления">
            🔔 <span>{progress.notifications}</span>
          </button>
          <button className="icon-pill" type="button" aria-label="Настройки" onClick={() => navigate('/profile')}>
            ⚙️
          </button>
        </div>
      </header>

      <div className="home-grid">
        <article className="quest-card plush-lg popin">
          <div className="quest-scene" aria-hidden="true">
            <div className="cartoon-head peach-head">
              <span />
              <span />
              <i />
            </div>
            <div className="mini-bubble">Я на линии</div>
          </div>
          <div className="quest-copy">
            <span className="chip butter">Квест дня</span>
            <h2>{quest.text}</h2>
            <div className="quest-progress">
              <span>{questDone ? '1/1' : '0/1'}</span>
              <div>
                <i style={{ width: questDone ? '100%' : '0%' }} />
              </div>
            </div>
            <div className="quest-actions">
              <button
                className="btn-plush primary"
                type="button"
                onClick={() => navigate(`/scenario/${questTarget.id}`)}
                disabled={questDone}
              >
                <Play size={18} aria-hidden="true" />
                {questDone ? 'Выполнено' : 'Выполнить'}
              </button>
              <span className="reward-badge">+{quest.reward} XP</span>
            </div>
          </div>
        </article>

        <aside className="coach-card plush">
          <div className="coach-avatar" aria-hidden="true">
            ✨
          </div>
          <h2>Фокус сегодня</h2>
          <p>Сохранять ровный тон, уточнять факты и закрывать разговор понятной договорённостью.</p>
          <div className="coach-mini-stats">
            <span>Монеты: {progress.coins}</span>
            <span>Открыто: {Object.keys(progress.completed).length + 1}</span>
          </div>
        </aside>
      </div>

      <section className="plan-teaser plush-lg">
        <div>
          <span className="path-kicker">Learning Path</span>
          <h2>Дерево навыков вынесено в план</h2>
          <p>Откройте карту, чтобы пройти сценарии по маршруту и посмотреть динамику.</p>
        </div>
        <button className="btn-plush sky" type="button" onClick={() => navigate('/plan')}>
          🗺️ Открыть план
        </button>
      </section>
    </section>
  );
}

function PlanPage({ progress }) {
  const completedCount = Object.keys(progress.completed).length;
  const completion = Math.round((completedCount / scenarios.length) * 100);
  const nextScenario =
    scenarios.find((scenario, index) => getScenarioStatus(scenario, index, progress).label === 'open') || scenarios[0];
  const recentAttempts = progress.attempts.slice(0, 3);
  const skillRows = buildSkillRows(progress);
  const questDone = progress.questDoneDate === todayKey();

  return (
    <section className="screen plan-screen">
      <Link className="back-link plan-back-link" to="/home">
        <ArrowLeft size={18} aria-hidden="true" /> Назад
      </Link>
      <header className="plan-hero plush-lg">
        <div className="plan-hero-copy">
          <span className="path-kicker hero-kicker">Маршрут навыков</span>
          <h1>План обучения</h1>
          <p>Карта сценариев, живой прогресс и следующий шаг в одном уютном маршруте.</p>
          <div className="plan-hero-chips" aria-label="Прогресс плана">
            <span>🧭 {completedCount}/{scenarios.length} пройдено</span>
            <span>⭐ {progress.xp} XP</span>
            <span>🔥 {progress.streak} дней подряд</span>
          </div>
        </div>
        <div className="plan-hero-art" aria-hidden="true">
          <div className="toy-stage">
            <span className="toy-label">Сегодня</span>
            <span className="toy-note note-one">1 диалог</span>
            <span className="toy-note note-two">+15 XP</span>
            <span className="toy-block block-one" />
            <span className="toy-block block-two" />
            <span className="toy-block block-three" />
            <span className="toy-card">
              <strong>Следующий ход</strong>
              <small>Слушай → уточняй → помогай</small>
            </span>
            <span className="toy-route">
              <i />
              <i />
              <i />
            </span>
            <span className="toy-buddy">
              <i />
              <i />
              <b />
            </span>
          </div>
        </div>
      </header>
      <div className="plan-layout">
        <section className="learning-path plan-map-panel">
          <div className="section-heading plan-map-heading">
            <div>
              <span className="path-kicker">Learning Path</span>
              <h2>Дерево навыков</h2>
            </div>
            <div className="map-heading-progress" aria-label={`Прогресс маршрута ${completion}%`}>
              <span>{completion}% маршрута</span>
              <div>
                <i style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
          <LearningPathMap progress={progress} />
        </section>

        <aside className="plan-sidebar">
          <article className="plan-side-card plush">
            <span className="path-kicker">Следующий шаг</span>
            <h2>{nextScenario.title}</h2>
            <p>{nextScenario.goal}</p>
            <Link className="btn-plush sm primary" to={`/scenario/${nextScenario.id}`}>
              ▶ Начать
            </Link>
          </article>

          <article className="plan-side-card plush">
            <span className="path-kicker">Квест дня</span>
            <h2>{questDone ? 'Выполнен' : 'В работе'}</h2>
            <p>{quests[0].text}</p>
            <span className="reward-badge">+{quests[0].reward} XP</span>
          </article>

          <article className="plan-side-card plush">
            <span className="path-kicker">Изменения</span>
            {recentAttempts.length ? (
              <div className="plan-change-list">
                {recentAttempts.map((attempt) => {
                  const scenario = scenarios.find((item) => item.id === attempt.scenarioId);

                  return (
                    <div key={attempt.id} className="plan-change-row">
                      <strong>{scenario?.title || 'Сценарий'}</strong>
                      <span>
                        +{attempt.xpGained} XP · {attempt.rating}/3
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>После тренировок здесь появится динамика XP и оценок.</p>
            )}
          </article>

          <article className="plan-side-card plush">
            <span className="path-kicker">Навыки</span>
            <div className="skill-row">
              <span>{skillRows.strong[0]?.skill || 'Эмпатия'}</span>
              <RatingStars rating={skillRows.strong[0]?.rating || 2} />
            </div>
            <div className="skill-row">
              <span>{skillRows.weak[0]?.skill || 'Структура'}</span>
              <RatingStars rating={skillRows.weak[0]?.rating || 1} />
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

function ScenarioPage({ progress, setProgress }) {
  const { id } = useParams();
  const scenario = scenarios.find((item) => item.id === id);
  const [isRunning, setIsRunning] = useState(false);

  if (!scenario) {
    return <Navigate to="/home" replace />;
  }

  return (
    <section className="screen scenario-screen">
      {!isRunning ? (
        <ScenarioPreview scenario={scenario} onStart={() => setIsRunning(true)} />
      ) : (
        <Simulation scenario={scenario} progress={progress} setProgress={setProgress} />
      )}
    </section>
  );
}

function ScenarioPreview({ scenario, onStart }) {
  const industry = getIndustry(scenario.industry);

  return (
    <>
      <PageTop title={scenario.title} subtitle={scenario.aiPersona} backTo="/home" />
      <div className="scenario-preview plush-lg">
        <div className="scenario-art" aria-hidden="true">
          <div className="preview-window" />
          <div className="cartoon-head mint-head">
            <span />
            <span />
            <i />
          </div>
          <div className="cartoon-head peach-head second">
            <span />
            <span />
            <i />
          </div>
          <div className="speech-chip">готов к диалогу</div>
        </div>

        <div className="preview-copy">
          <span className="chip peach">
            {industry.icon} {industry.name}
          </span>
          <h2>{scenario.goal}</h2>
          <p>{scenario.aiPersona}</p>
          <div className="preview-stats">
            <div>
              <span>Длительность</span>
              <strong>{scenario.durationMin} мин</strong>
            </div>
            <div>
              <span>Сложность</span>
              <strong>{getDifficultyLabel(scenario.difficulty)}</strong>
            </div>
            <div>
              <span>Награда</span>
              <strong>+{scenario.xpReward} XP</strong>
            </div>
            <div>
              <span>Навык</span>
              <strong>{scenario.skill}</strong>
            </div>
          </div>
          <button className="btn-plush primary start-button" type="button" onClick={onStart}>
            <Play size={20} aria-hidden="true" /> Начать
          </button>
        </div>
      </div>
    </>
  );
}

function Simulation({ scenario, progress, setProgress }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [checks, setChecks] = useState([]);
  const [mode, setMode] = useState(progress.mode || 'keyboard');
  const messagesRef = useRef(messages);
  const checksRef = useRef(checks);
  const finishedRef = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typing]);

  useEffect(() => {
    checksRef.current = checks;
  }, [checks]);

  useEffect(() => {
    const currentStep = scenario.script[stepIndex];
    if (!currentStep || currentStep.role !== 'ai' || finishedRef.current) {
      return undefined;
    }

    setTyping(true);
    const delay = Math.min(3000, Math.max(1000, currentStep.delay || 1500));
    const timer = window.setTimeout(() => {
      setMessages((current) => [...current, { role: 'ai', text: currentStep.text }]);
      setTyping(false);
      setStepIndex((current) => current + 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [scenario.script, stepIndex]);

  useEffect(() => {
    if (stepIndex >= scenario.script.length && !finishedRef.current) {
      const timer = window.setTimeout(() => finishScenario(false), 450);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [stepIndex, scenario.script.length]);

  const activeUserStep = scenario.script[stepIndex]?.role === 'user' ? scenario.script[stepIndex] : null;

  function finishScenario(early) {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    const rating = calculateRating(checksRef.current, early);
    const xpGained = Math.max(6, Math.round(scenario.xpReward * (rating / 3) * (early ? 0.7 : 1)));
    const coinsGained = Math.max(3, Math.round((scenario.coinReward || 8) * (rating / 3)));
    const quest = quests[0];
    const completesDailyQuest =
      !early && progress.questDoneDate !== todayKey() && scenario.skill === quest.targetSkill;
    const questReward = completesDailyQuest ? quest.reward : 0;
    const attempt = {
      id: `attempt-${scenario.id}-${Date.now()}`,
      scenarioId: scenario.id,
      date: todayKey(),
      rating,
      xpGained: xpGained + questReward,
      coinsGained,
      transcript: messagesRef.current,
      checks: checksRef.current,
      early,
    };

    setProgress((current) => {
      const currentRating = current.completed[scenario.id]?.rating || 0;

      return {
        ...current,
        xp: current.xp + xpGained + questReward,
        coins: current.coins + coinsGained,
        questDoneDate: completesDailyQuest ? todayKey() : current.questDoneDate,
        completed: {
          ...current.completed,
          [scenario.id]: {
            rating: Math.max(currentRating, rating),
            xp: xpGained + questReward,
            coins: coinsGained,
            date: todayKey(),
          },
        },
        attempts: [attempt, ...current.attempts].slice(0, 40),
      };
    });

    navigate(`/results/${scenario.id}`, { state: { attemptId: attempt.id } });
  }

  function submitAnswer(text = draft) {
    const cleanText = text.trim();
    if (!cleanText || !activeUserStep) {
      return;
    }

    const matched = getMatchedTerms(cleanText, activeUserStep.expected);
    const coachText =
      matched.length >= Math.ceil(activeUserStep.expected.length / 2)
        ? `Учтено: ${matched.join(', ')}.`
        : `Нужно усилить: ${activeUserStep.expected.filter((item) => !matched.includes(item)).join(', ')}.`;
    const nextMessages = [
      ...messagesRef.current,
      { role: 'user', text: cleanText },
      { role: 'coach', text: coachText },
    ];

    setMessages(nextMessages);
    setChecks((current) => [...current, { expected: activeUserStep.expected, matched }]);
    setDraft('');
    setStepIndex((current) => current + 1);
  }

  function useHint() {
    if (!activeUserStep) {
      return;
    }

    if (progress.coins < 5) {
      setMessages((current) => [
        ...current,
        { role: 'coach', text: 'Монет не хватает. Попробуйте ответить через уточнение и эмпатию.' },
      ]);
      return;
    }

    setProgress((current) => ({ ...current, coins: current.coins - 5 }));
    setMessages((current) => [...current, { role: 'coach', text: `Подсказка: ${activeUserStep.hint}` }]);
  }

  function toggleMode() {
    const nextMode = mode === 'keyboard' ? 'voice' : 'keyboard';
    setMode(nextMode);
    setProgress((current) => ({ ...current, mode: nextMode }));
  }

  return (
    <div className="simulation-layout">
      <header className="simulation-top plush">
        <div>
          <span className="chip sky">{scenario.skill}</span>
          <h1>{scenario.title}</h1>
        </div>
        <div className="simulation-tools">
          <button className="tool-button" type="button" onClick={useHint} disabled={!activeUserStep}>
            🆘 Подсказка <small>-5</small>
          </button>
          <button className="tool-button" type="button" onClick={toggleMode}>
            {mode === 'keyboard' ? '🎙️ Голос' : '⌨️ Текст'}
          </button>
          <button className="tool-button stop" type="button" onClick={() => finishScenario(true)}>
            ⏹ Завершить
          </button>
        </div>
      </header>

      <div className="chat-shell plush-lg">
        <div className="chat-persona">
          <div className="cartoon-head peach-head">
            <span />
            <span />
            <i />
          </div>
          <div>
            <strong>{scenario.aiPersona}</strong>
            <span>Имитация ИИ</span>
          </div>
        </div>

        <div className="chat-feed" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
              <span>{message.role === 'ai' ? 'ИИ' : message.role === 'coach' ? 'Разбор' : 'Вы'}</span>
              <p>{message.text}</p>
            </div>
          ))}
          {typing ? (
            <div className="typing-indicator" aria-label="ИИ печатает">
              <i />
              <i />
              <i />
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        {activeUserStep ? (
          <div className="reply-panel">
            <div className="quick-replies">
              {activeUserStep.quickReplies?.map((reply) => (
                <button key={reply} type="button" onClick={() => submitAnswer(reply)}>
                  {reply}
                </button>
              ))}
            </div>
            <form
              className="reply-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitAnswer();
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={mode === 'keyboard' ? 'Ваш ответ...' : 'Голосовой режим: текстовая имитация'}
              />
              <button className="btn-plush primary" type="submit" aria-label="Отправить">
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultsPage({ progress }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scenario = scenarios.find((item) => item.id === id);

  if (!scenario) {
    return <Navigate to="/home" replace />;
  }

  const attempt =
    progress.attempts.find((item) => item.id === location.state?.attemptId) ||
    progress.attempts.find((item) => item.scenarioId === scenario.id);
  const rating = attempt?.rating || progress.completed[scenario.id]?.rating || 1;
  const good = scenario.feedback.good.slice(0, 3);
  const improve = scenario.feedback.improve.slice(0, 2);

  return (
    <section className="screen results-screen">
      <PageTop title="Результаты" subtitle={scenario.title} backTo="/home" />
      <div className="results-card plush-lg">
        <div className="results-hero">
          <Sparkles size={34} aria-hidden="true" />
          <span className="rating-big">
            <RatingStars rating={rating} />
          </span>
          <h2>+{attempt?.xpGained || scenario.xpReward} XP</h2>
          <p>+{attempt?.coinsGained || scenario.coinReward} монет</p>
        </div>

        <div className="feedback-grid">
          <article className="feedback-box">
            <h3>Плюсы</h3>
            {good.map((item) => (
              <p key={item}>🟢 {item}</p>
            ))}
          </article>
          <article className="feedback-box">
            <h3>Зоны роста</h3>
            {improve.map((item) => (
              <p key={item}>⭐ {item}</p>
            ))}
          </article>
        </div>

        <div className="results-actions">
          <button className="btn-plush primary" type="button" onClick={() => navigate(`/scenario/${scenario.id}`)}>
            <RefreshCw size={18} aria-hidden="true" /> Повторить
          </button>
          <button className="btn-plush" type="button" onClick={() => navigate('/library')}>
            📚 Теория
          </button>
          <button className="btn-plush mint" type="button" onClick={() => navigate('/home')}>
            🏠 Домой
          </button>
        </div>
      </div>
    </section>
  );
}

function LibraryPage({ progress }) {
  const [industryFilter, setIndustryFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const skills = useMemo(() => Array.from(new Set(scenarios.map((scenario) => scenario.skill))), []);
  const filteredScenarios = scenarios.filter((scenario) => {
    const matchesIndustry = industryFilter === 'all' || scenario.industry === industryFilter;
    const matchesSkill = skillFilter === 'all' || scenario.skill === skillFilter;
    return matchesIndustry && matchesSkill;
  });

  return (
    <section className="screen library-screen">
      <PageTop title="Библиотека" subtitle="Сценарии по отраслям и навыкам" />
      <div className="filter-bar plush">
        <select value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)}>
          <option value="all">Все отрасли</option>
          {industries.map((industry) => (
            <option key={industry.id} value={industry.id}>
              {industry.name}
            </option>
          ))}
        </select>
        <select value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)}>
          <option value="all">Все навыки</option>
          {skills.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
      </div>

      <div className="scenario-list">
        {filteredScenarios.map((scenario) => {
          const industry = getIndustry(scenario.industry);
          const rating = progress.completed[scenario.id]?.rating || 0;

          return (
            <Link key={scenario.id} className="library-card plush tap" to={`/scenario/${scenario.id}`}>
              <div className="library-icon">{industry.icon}</div>
              <div>
                <span className="chip sky">{scenario.skill}</span>
                <h2>{scenario.title}</h2>
                <p>{scenario.goal}</p>
                <div className="library-meta">
                  <span>{scenario.durationMin} мин</span>
                  <span>{getDifficultyLabel(scenario.difficulty)}</span>
                  {rating ? <RatingStars rating={rating} /> : <span>новый</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ProgressPage({ progress }) {
  const completedCount = Object.keys(progress.completed).length;
  const xpByDay = useMemo(() => buildXpHistory(progress.attempts), [progress.attempts]);
  const maxXp = Math.max(...xpByDay.map((item) => item.xp), 1);
  const skillRows = useMemo(() => buildSkillRows(progress), [progress]);

  return (
    <section className="screen progress-screen">
      <PageTop title="Прогресс" subtitle={`${completedCount} сценариев завершено`} />

      <div className="progress-grid">
        <article className="plush-lg xp-chart-card">
          <div className="section-heading compact">
            <span className="chip butter">XP</span>
            <h2>По дням</h2>
          </div>
          <div className="xp-chart" aria-label="График XP по дням">
            {xpByDay.map((item) => (
              <div key={item.day} className="xp-bar">
                <i style={{ height: `${Math.max(8, (item.xp / maxXp) * 100)}%` }} />
                <span>{item.day}</span>
                <strong>{item.xp}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="plush skill-card">
          <h2>Сильные навыки</h2>
          {skillRows.strong.map((item) => (
            <div key={item.skill} className="skill-row">
              <span>{item.skill}</span>
              <RatingStars rating={item.rating} />
            </div>
          ))}
        </article>

        <article className="plush skill-card">
          <h2>Зоны роста</h2>
          {skillRows.weak.map((item) => (
            <div key={item.skill} className="skill-row">
              <span>{item.skill}</span>
              <RatingStars rating={item.rating} />
            </div>
          ))}
        </article>
      </div>

      <section className="achievement-grid">
        {achievements.map((achievement, index) => {
          const unlocked =
            (achievement.id === 'first_step' && completedCount >= 1) ||
            (achievement.id === 'calm_voice' &&
              progress.attempts.some((attempt) => {
                const scenario = scenarios.find((item) => item.id === attempt.scenarioId);
                return scenario?.skill === 'Стрессоустойчивость' && attempt.rating === 3;
              })) ||
            (achievement.id === 'pathfinder' && completedCount >= 5) ||
            (achievement.id === 'mentor' && progress.attempts.length >= 10);

          return (
            <article key={achievement.id} className={`achievement-card plush ${unlocked ? 'unlocked' : ''}`}>
              <span>{unlocked ? achievement.icon : '🔒'}</span>
              <h3>{achievement.title}</h3>
              <p>{achievement.description}</p>
              <small>{unlocked ? 'получено' : `${index + 1}/4`}</small>
            </article>
          );
        })}
      </section>
    </section>
  );
}

function buildXpHistory(attempts) {
  if (!attempts.length) {
    return mockXpHistory;
  }

  const formatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
  const days = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const xp = attempts.filter((attempt) => attempt.date === key).reduce((sum, attempt) => sum + attempt.xpGained, 0);
    return { day: formatter.format(date).replace('.', ''), xp };
  });

  return days.every((item) => item.xp === 0) ? mockXpHistory : days;
}

function buildSkillRows(progress) {
  const rows = scenarios.map((scenario) => ({
    skill: scenario.skill,
    rating: progress.completed[scenario.id]?.rating || (scenario.difficulty === 1 ? 2 : 1),
  }));
  const grouped = rows.reduce((map, item) => {
    const current = map.get(item.skill) || [];
    current.push(item.rating);
    map.set(item.skill, current);
    return map;
  }, new Map());
  const averaged = Array.from(grouped.entries()).map(([skill, ratings]) => ({
    skill,
    rating: Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length),
  }));

  return {
    strong: averaged.sort((a, b) => b.rating - a.rating).slice(0, 3),
    weak: averaged.sort((a, b) => a.rating - b.rating).slice(0, 3),
  };
}

function PracticePage({ progress }) {
  const navigate = useNavigate();
  const openScenarios = scenarios.filter((scenario, index) => getScenarioStatus(scenario, index, progress).label !== 'locked');

  function startRandom() {
    const scenario = openScenarios[Math.floor(Math.random() * openScenarios.length)] || scenarios[0];
    navigate(`/scenario/${scenario.id}`);
  }

  function startQuickCall() {
    const scenario = openScenarios.find((item) => item.durationMin <= 4) || openScenarios[0] || scenarios[0];
    navigate(`/scenario/${scenario.id}`);
  }

  function repeatMistake() {
    const weakestAttempt = [...progress.attempts].sort((a, b) => a.rating - b.rating)[0];
    navigate(`/scenario/${weakestAttempt?.scenarioId || openScenarios[0]?.id || scenarios[0].id}`);
  }

  return (
    <section className="screen practice-screen">
      <PageTop title="Практика" subtitle="Быстрые режимы тренировки" />
      <div className="practice-grid">
        <button className="practice-card plush-lg tap" type="button" onClick={startRandom}>
          <span>🎲</span>
          <h2>Случайный</h2>
          <p>Любой открытый сценарий из дерева навыков.</p>
        </button>
        <button className="practice-card plush-lg tap" type="button" onClick={startQuickCall}>
          <span>☎️</span>
          <h2>Быстрый звонок</h2>
          <p>Короткий диалог до четырёх минут.</p>
        </button>
        <button className="practice-card plush-lg tap" type="button" onClick={repeatMistake}>
          <span>🔁</span>
          <h2>Повтор ошибок</h2>
          <p>Сценарий с самой низкой последней оценкой.</p>
        </button>
      </div>
    </section>
  );
}

function ProfilePage({ progress, setProgress }) {
  function toggleSetting(setting) {
    setProgress((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [setting]: !current.settings[setting],
      },
    }));
  }

  return (
    <section className="screen profile-screen">
      <PageTop title="Профиль" subtitle="Настройки и награды" />
      <div className="profile-grid">
        <article className="profile-hero plush-lg">
          <div className="profile-avatar" aria-hidden="true">
            👤
          </div>
          <h2>Коммуникатор Pro</h2>
          <div className="profile-stats">
            <StatPill icon="🔥" label={`${progress.streak} дней`} />
            <StatPill icon="⭐" label={`${progress.xp} XP`} />
            <StatPill icon="🪙" label={`${progress.coins} монет`} />
          </div>
        </article>

        <article className="settings-card plush">
          <h2>Настройки</h2>
          {[
            ['reminders', 'Ежедневные напоминания'],
            ['sound', 'Звуки симуляции'],
            ['coachTips', 'Подсказки тренера'],
          ].map(([key, label]) => (
            <label key={key} className="toggle-row">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(progress.settings[key])}
                onChange={() => toggleSetting(key)}
              />
            </label>
          ))}
        </article>

        <article className="profile-card plush">
          <h2>Рефералка</h2>
          <p>COMM-{String(progress.xp).slice(-3)}-{progress.streak}DAY</p>
          <span className="chip mint">+50 XP за друга</span>
        </article>

        <article className="profile-card plush">
          <h2>Подписка</h2>
          <p>Pro-пакет отраслевых сценариев</p>
          <span className="chip rose">заглушка</span>
        </article>
      </div>
    </section>
  );
}

function TrainerApp() {
  const [progress, setProgressState] = useState(loadProgress);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  function setProgress(updater) {
    setProgressState((current) => (typeof updater === 'function' ? updater(current) : { ...current, ...updater }));
  }

  return (
    <BrowserRouter>
      <div className="trainer-app paper">
        <div className="bg-shapes" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <main className="trainer-main">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage progress={progress} />} />
            <Route path="/plan" element={<PlanPage progress={progress} />} />
            <Route path="/scenario/:id" element={<ScenarioPage progress={progress} setProgress={setProgress} />} />
            <Route path="/results/:id" element={<ResultsPage progress={progress} />} />
            <Route path="/library" element={<LibraryPage progress={progress} />} />
            <Route path="/progress" element={<ProgressPage progress={progress} />} />
            <Route path="/practice" element={<PracticePage progress={progress} />} />
            <Route path="/profile" element={<ProfilePage progress={progress} setProgress={setProgress} />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default TrainerApp;
