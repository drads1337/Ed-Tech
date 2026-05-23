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
import { ArrowLeft, BarChart3, BookOpen, ChevronRight, Clock, Languages, LogOut, Play, Plus, RefreshCw, Smile, Sparkles, Target, Trash2, User, UserCheck, UserMinus, UserPlus, X, Zap } from 'lucide-react';
import { supabase } from './backendApi.js';
import { achievements, getDailySuggestions, industries, mockXpHistory, quests, scenarios } from './data/mockData.js';
import {
  buildQuickScenario,
  consumeQuickPractice,
  getQuickPracticeUsage,
  pickQuickCaseId,
} from './quickPractice.js';

const STORAGE_KEY = 'pro-communication-trainer:v1';
const LANG_KEY = 'app_lang';
const MOCK_USER_KEY = 'training_loop_mock_user';
const MOCK_SESSION_KEY = 'training_loop_mock_session';
const todayKey = () => new Date().toISOString().slice(0, 10);
const DAILY_FOCUS_COIN_REWARD = 15;

const COMPANY_ASSIGNMENTS = [
  {
    id: 'company-policy-1',
    scenarioId: 'edu_02',
    badge: 'Правила компании',
    title: 'Обязательный вводный кейс',
    description: 'Отработайте разговор с сотрудником, который не проходит обучение по внутренним стандартам.',
    checkpoint: 'Открывает доступ к клиентским сценам',
  },
  {
    id: 'company-policy-2',
    scenarioId: 'psy_01',
    badge: 'Коммуникация',
    title: 'Конфликт по регламенту',
    description: 'Снизьте напряжение и верните диалог к правилам компании без спора.',
    checkpoint: 'Нужно пройти после вводного кейса',
  },
  {
    id: 'company-policy-3',
    scenarioId: 'med_02',
    badge: 'Контроль качества',
    title: 'Сложный разговор с ожиданиями',
    description: 'Объясните ограничения, проверьте понимание и согласуйте следующий шаг.',
    checkpoint: 'Финальный рубеж обязательного трека',
  },
];

const DEFAULT_PROGRESS = {
  name: 'Александр',
  primaryIndustry: 'medicine',
  role: 'Врач',
  goal: 'Сбор анамнеза',
  additionalIndustries: [],
  streak: 6,
  xp: 320,
  coins: 42,
  notifications: 3,
  mode: 'keyboard',
  questDoneDate: '',
  focusDoneDate: '',
  aiGeneratedScenarios: [],
  purchasedSuggestionIds: [],
  lastDailyGeneration: '',
  quickPracticeDate: '',
  quickPracticeUsed: 0,
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

const languages = [
  { code: 'ru', label: 'Рус' },
  { code: 'uz', label: 'Uzb' },
  { code: 'en', label: 'Eng' },
];

const text = {
  ru: {
    appName: 'Тренажёр',
    tagline: 'Платформа развития и анализа профессиональных компетенций и коммуникативных навыков',
    streakDays: 'дн.',
    dailyPanelTitle: 'Панель дня',
    dailyPanelSubtitle: 'Короткий фокус, быстрый старт и ваш текущий прогресс.',
    onlineBubble: 'Я на линии',
    dailyQuest: 'Квест дня',
    questText: 'Пройти 1 сценарий на стрессоустойчивость',
    done: 'Выполнено',
    start: 'Выполнить',
    focusToday: 'Фокус сегодня',
    focusCopy: 'Сохранять ровный тон, уточнять факты и закрывать разговор понятной договорённостью.',
    dailyReward: 'Награда за день',
    focusCompleted: 'Фокус выполнен ✓',
    coins: 'Монеты',
    unlocked: 'Открыто',
    language: 'Язык',
    logout: 'Выйти',
    open: 'Открыть',
    progress: 'Мой прогресс',
    profile: 'Мой профиль',
    navHome: 'Главная',
    navPlan: 'План',
    navLibrary: 'Кейсы',
    navProgress: 'Прогресс',
    navPractice: 'Практика',
    navProfile: 'Профиль',
    modePlanBadge: '🧭 МАРШРУТ',
    modePlanTitle: 'План обучения',
    modePlanDesc: 'Маршрут по вашему направлению. Прокачивайте навыки общения шаг за шагом по карте.',
    modeLibraryBadge: '📚 ВСЕ КЕЙСЫ',
    modeLibraryTitle: 'Библиотека кейсов',
    modeLibraryDesc: 'Полный каталог сценариев для всех отраслей. Выбирайте темы, изучайте теорию и подсказки.',
    modePracticeBadge: '⚡ БЫСТРО',
    modePracticeTitle: 'Быстрая практика',
    modePracticeDesc: 'Случайный ИИ-кейс — сразу в 3D-сцену. До 3 раз в день.',
    quickPracticeLimit: 'Быстрая практика: лимит 3 раза в день. Загляните завтра!',
    quickPracticeLeft: 'осталось сегодня',
    back: 'Назад',
    generateWithAI: 'Сгенерировать с ИИ',
    dailyAISuggestion: 'Предложение дня от ИИ',
    generateWish: 'Ваши пожелания (необязательно)',
    generateCost: 'Стоимость: 5 🪙',
    generateButton: 'Создать новый кейс',
    aiGenerating: 'ИИ создает сценарий...',
    addToAccount: 'Добавить в аккаунт',
    myIndustries: 'Мои отрасли',
    libraryPageTitle: 'Библиотека',
    libraryPageSubtitle: 'Сценарии по вашим отраслям',
    librarySectionsLabel: 'Разделы библиотеки',
    libraryTabMine: 'Мои',
    libraryTabOffers: 'Предложения',
    dailyOffersTitle: 'Предложения дня',
    dailyOffersSubtitle: '10 кейсов на сегодня — выберите и добавьте в библиотеку',
    buyFor: 'Купить',
    free: 'Бесплатно',
    purchased: 'В библиотеке',
    openCase: 'Открыть',
    yourCoins: 'Ваш баланс',
    updatesDaily: 'Обновляется ежедневно',
    generateCase: 'Создать свой кейс',
  },
  uz: {
    appName: 'Trenajyor',
    tagline: 'Kasbiy kompetensiyalar va muloqot ko‘nikmalarini rivojlantirish hamda tahlil qilish platformasi',
    streakDays: 'kun',
    dailyPanelTitle: 'Kun paneli',
    dailyPanelSubtitle: 'Qisqa fokus, tez start va joriy natijalaringiz.',
    onlineBubble: 'Aloqadaman',
    dailyQuest: 'Kun kvesti',
    questText: 'Stressga chidamlilik bo‘yicha 1 ta ssenariyni o‘ting',
    done: 'Bajarildi',
    start: 'Boshlash',
    focusToday: 'Bugungi fokus',
    focusCopy: 'Ohangni sokin saqlash, faktlarni aniqlashtirish va suhbatni aniq kelishuv bilan yakunlash.',
    dailyReward: 'Kunlik mukofot',
    focusCompleted: 'Fokus bajarildi ✓',
    coins: 'Tangalar',
    unlocked: 'Ochildi',
    language: 'Til',
    logout: 'Chiqish',
    open: 'Ochish',
    progress: 'Mening progresim',
    profile: 'Profilim',
    navHome: 'Bosh sahifa',
    navPlan: 'Reja',
    navLibrary: 'Keyslar',
    navProgress: 'Progress',
    navPractice: 'Amaliyot',
    navProfile: 'Profil',
    modePlanBadge: '🧭 MARSHRUT',
    modePlanTitle: 'O‘quv rejasi',
    modePlanDesc: 'Yo‘nalishingiz bo‘yicha yo‘l xaritasi. Muloqot ko‘nikmalarini bosqichma-bosqich rivojlantiring.',
    modeLibraryBadge: '📚 BARCHA KEYSLAR',
    modeLibraryTitle: 'Keyslar kutubxonasi',
    modeLibraryDesc: 'Barcha sohalar uchun ssenariylar katalogi. Mavzu, nazariya va maslahatlarni tanlang.',
    modePracticeBadge: '⚡ TEZKOR',
    modePracticeTitle: 'Tezkor amaliyot',
    modePracticeDesc: 'Tasodifiy AI-keys — darhol 3D-sahna. Kuniga 3 marta.',
    quickPracticeLimit: 'Tezkor amaliyot: kuniga 3 marta. Ertaga qayting!',
    quickPracticeLeft: 'bugun qoldi',
    back: 'Orqaga',
    generateWithAI: 'AI bilan yaratish',
    generateButton: 'Yangi keys yaratish',
    libraryPageTitle: 'Kutubxona',
    libraryPageSubtitle: 'Sohalaringiz bo‘yicha ssenariylar',
    librarySectionsLabel: 'Kutubxona bo‘limlari',
    libraryTabMine: 'Mening',
    libraryTabOffers: 'Takliflar',
    dailyOffersTitle: 'Kun takliflari',
    dailyOffersSubtitle: 'Bugun 10 ta keys — tanlang va kutubxonaga qo‘shing',
    buyFor: 'Sotib olish',
    free: 'Bepul',
    openCase: 'Ochish',
    yourCoins: 'Balansingiz',
    updatesDaily: 'Har kuni yangilanadi',
    generateCase: 'O‘z keysingizni yarating',
  },
  en: {
    appName: 'Trainer',
    tagline: 'A platform for developing and analyzing professional competencies and communication skills',
    streakDays: 'days',
    dailyPanelTitle: 'Today Panel',
    dailyPanelSubtitle: 'A short focus, quick start, and your current progress.',
    onlineBubble: 'I am online',
    dailyQuest: 'Daily quest',
    questText: 'Complete 1 stress-resilience scenario',
    done: 'Done',
    start: 'Start',
    focusToday: 'Today’s focus',
    focusCopy: 'Keep an even tone, clarify facts, and close the conversation with a clear agreement.',
    dailyReward: 'Daily reward',
    focusCompleted: 'Focus done ✓',
    coins: 'Coins',
    unlocked: 'Unlocked',
    language: 'Language',
    logout: 'Logout',
    open: 'Open',
    progress: 'My progress',
    profile: 'My profile',
    navHome: 'Home',
    navPlan: 'Plan',
    navLibrary: 'Cases',
    navProgress: 'Progress',
    navPractice: 'Practice',
    navProfile: 'Profile',
    modePlanBadge: '🧭 MAP ROUTE',
    modePlanTitle: 'Learning plan',
    modePlanDesc: 'A route for your direction. Build communication skills step by step on the map.',
    modeLibraryBadge: '📚 ALL CASES',
    modeLibraryTitle: 'Case library',
    modeLibraryDesc: 'A full catalog of scenarios for every industry. Pick topics, theory, and hints.',
    modePracticeBadge: '⚡ QUICK',
    modePracticeTitle: 'Quick practice',
    modePracticeDesc: 'Random AI case — straight into the 3D scene. Up to 3 times per day.',
    quickPracticeLimit: 'Quick practice limit: 3 times per day. Come back tomorrow!',
    quickPracticeLeft: 'left today',
    back: 'Back',
    generateWithAI: 'Generate with AI',
    generateButton: 'Create new case',
    libraryPageTitle: 'Library',
    libraryPageSubtitle: 'Scenarios for your industries',
    librarySectionsLabel: 'Library sections',
    libraryTabMine: 'Mine',
    libraryTabOffers: 'Offers',
    dailyOffersTitle: 'Today’s offers',
    dailyOffersSubtitle: '10 cases for today — pick one and add it to your library',
    buyFor: 'Buy for',
    free: 'Free',
    openCase: 'Open',
    yourCoins: 'Your balance',
    updatesDaily: 'Updates daily',
    generateCase: 'Create your own case',
  },
};

function getText(langCode) {
  const safeLang = text[langCode] ? langCode : 'ru';
  return { ...text.ru, ...text[safeLang] };
}

const navItems = [
  { to: '/home', labelKey: 'navHome', icon: '🏠' },
  { to: '/plan', labelKey: 'navPlan', icon: '🗺️' },
  { to: '/library', labelKey: 'navLibrary', icon: '📚' },
  { to: '/results-page', labelKey: 'navProgress', icon: '📊' },
  { to: '/practice', labelKey: 'navPractice', icon: '🎮' },
  { to: '/profile', labelKey: 'navProfile', icon: '👤' },
];

/* ── Background Music ── */
const MUTED_KEY = 'procomm:music-muted';
const VOLUME = 0.08;

export function BackgroundMusic() {
  const [userMuted, setUserMuted] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(MUTED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const audioRef = useRef(null);

  useEffect(() => {
    const a = new Audio('/lofi.mp3');
    a.loop = true;
    a.volume = VOLUME;
    a.preload = 'auto';
    audioRef.current = a;

    const tryPlay = () => {
      if (!audioRef.current || mutedRef.current) return;
      audioRef.current.play().catch(() => {});
    };

    const onGesture = () => tryPlay();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    tryPlay();

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      a.pause();
      a.src = '';
      audioRef.current = null;
    };
  }, []);

  const mutedRef = useRef(userMuted);

  useEffect(() => {
    mutedRef.current = userMuted;
    const a = audioRef.current;
    if (!a) return;
    if (userMuted) {
      a.pause();
    } else {
      a.volume = VOLUME;
      a.play().catch(() => {});
    }
  }, [userMuted]);

  const toggle = () => {
    const next = !userMuted;
    setUserMuted(next);
    try {
      window.localStorage.setItem(MUTED_KEY, next ? '1' : '0');
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={userMuted ? 'Включить музыку' : 'Выключить музыку'}
      aria-label={userMuted ? 'Включить музыку' : 'Выключить музыку'}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        width: 38,
        height: 38,
        borderRadius: '50%',
        border: '3px solid var(--line)',
        background: userMuted ? 'white' : 'var(--butter, #FFD86B)',
        boxShadow: '0 4px 0 var(--line)',
        cursor: 'pointer',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 120ms ease, transform 120ms ease',
      }}
      className="tap"
    >
      <span aria-hidden style={{ lineHeight: 1 }}>
        {userMuted ? '🔇' : '🎵'}
      </span>
    </button>
  );
}

/* ── Cozy Cartoon SVGs & Helpers ── */
function EduBook({ rot = 0 }) {
  const stroke = 'var(--line)';
  return (
    <svg width="80" height="70" viewBox="0 0 100 80" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }}>
      <path d="M 10 70 C 30 65, 50 72, 50 72 C 50 72, 70 65, 90 70 L 90 15 C 70 10, 50 17, 50 17 C 50 17, 30 10, 10 15 Z" fill="white" stroke={stroke} strokeWidth="3.5" />
      <path d="M 50 17 L 50 72" stroke={stroke} strokeWidth="3.5" />
      <path d="M 15 22 C 30 18, 45 23, 45 23" fill="none" stroke="var(--ink-soft)" strokeWidth="2" />
      <path d="M 15 34 C 30 30, 45 35, 45 35" fill="none" stroke="var(--ink-soft)" strokeWidth="2" />
      <path d="M 15 46 C 30 42, 45 47, 45 47" fill="none" stroke="var(--ink-soft)" strokeWidth="2" />
      <path d="M 55 23 C 70 18, 85 22, 85 22" fill="none" stroke="var(--ink-soft)" strokeWidth="2" />
      <path d="M 55 35 C 70 30, 85 34, 85 34" fill="none" stroke="var(--ink-soft)" strokeWidth="2" />
      <path d="M 55 47 C 70 42, 85 46, 85 46" fill="none" stroke="var(--ink-soft)" strokeWidth="2" />
      <path d="M 6 16 L 6 71 C 26 66, 46 73, 46 73" fill="none" stroke="var(--sky-deep)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="3" y="12" width="6" height="58" rx="2" fill="var(--sky-deep)" stroke={stroke} strokeWidth="3" />
      <rect x="91" y="12" width="6" height="58" rx="2" fill="var(--peach)" stroke={stroke} strokeWidth="3" />
    </svg>
  );
}

function GraduationCap({ rot = 0 }) {
  const stroke = 'var(--line)';
  return (
    <svg width="86" height="70" viewBox="0 0 100 80" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }}>
      <path d="M 30 45 L 30 55 C 30 63, 70 63, 70 55 L 70 45" fill="var(--ink-2)" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
      <ellipse cx="50" cy="56" rx="20" ry="6" fill="var(--ink)" stroke={stroke} strokeWidth="2" />
      <path d="M 50 15 L 90 30 L 50 45 L 10 30 Z" fill="var(--ink)" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M 50 30 L 80 34 L 84 56" fill="none" stroke="var(--butter-deep)" strokeWidth="3" strokeLinecap="round" />
      <rect x="80" y="52" width="8" height="12" rx="2" fill="var(--butter)" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

function Pencil({ rot = 0 }) {
  const stroke = 'var(--line)';
  return (
    <svg width="70" height="70" viewBox="0 0 80 80" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }}>
      <g transform="translate(10, 10) rotate(45)">
        <rect x="0" y="15" width="22" height="45" rx="3" fill="var(--butter)" stroke={stroke} strokeWidth="3.5" />
        <rect x="5" y="15" width="12" height="45" fill="var(--butter-deep)" opacity="0.4" />
        <rect x="0" y="52" width="22" height="8" fill="var(--sky)" stroke={stroke} strokeWidth="3" />
        <rect x="0" y="60" width="22" height="12" rx="4" fill="var(--rose-deep)" stroke={stroke} strokeWidth="3" />
        <polygon points="0,15 11,-2 22,15" fill="#FFE3C9" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
        <polygon points="6,6 11,-2 16,6" fill="var(--line)" />
      </g>
    </svg>
  );
}

function IdeaBulb({ rot = 0 }) {
  const stroke = 'var(--line)';
  return (
    <svg width="68" height="78" viewBox="0 0 80 90" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }}>
      <rect x="30" y="68" width="20" height="6" rx="2" fill="var(--ink-soft)" stroke={stroke} strokeWidth="3" />
      <rect x="32" y="74" width="16" height="6" rx="2" fill="var(--ink-soft)" stroke={stroke} strokeWidth="3" />
      <path d="M 35 80 L 45 80" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M 22 55 C 10 45, 12 18, 40 18 C 68 18, 70 45, 58 55 C 53 60, 50 68, 50 68 L 30 68 C 30 68, 27 60, 22 55 Z" fill="var(--butter)" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M 33 50 L 33 42 Q 40 33, 47 42 L 47 50" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="28" x2="4" y2="24" stroke="var(--butter-deep)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="20" y1="12" x2="14" y2="4" stroke="var(--butter-deep)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="40" y1="6" x2="40" y2="0" stroke="var(--butter-deep)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="60" y1="12" x2="66" y2="4" stroke="var(--butter-deep)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="68" y1="28" x2="76" y2="24" stroke="var(--butter-deep)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function EduMedal({ rot = 0 }) {
  const stroke = 'var(--line)';
  return (
    <svg width="74" height="74" viewBox="0 0 80 80" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }}>
      <polygon points="30,30 20,70 36,70 40,48" fill="var(--rose-deep)" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <polygon points="50,30 60,70 44,70 40,48" fill="var(--sky-deep)" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="40" cy="34" r="26" fill="var(--butter)" stroke={stroke} strokeWidth="3.5" />
      <circle cx="40" cy="34" r="18" fill="none" stroke="var(--butter-deep)" strokeWidth="2.5" strokeDasharray="4 3" />
      <polygon points="40,20 44,28 53,30 46,36 48,45 40,40 32,45 34,36 27,30 36,28" fill="white" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function EduStar({ rot = 0, size = 50 }) {
  const stroke = 'var(--line)';
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }}>
      <polygon points="30,4 37,20 54,23 42,35 45,52 30,44 15,52 18,35 6,23 23,20" fill="var(--butter)" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <polygon points="30,12 34,22 44,24 36,32 38,42 30,37 22,42 24,32 16,24 26,22" fill="var(--butter-deep)" opacity="0.6" strokeLinejoin="round" />
    </svg>
  );
}

function Float({ left, top, anim, delay, children }) {
  return (
    <div className={anim} style={{ position: 'absolute', left, top, animationDelay: delay, pointerEvents: 'none' }}>
      {children}
    </div>
  );
}

function TrainerFloatingDecor() {
  return (
    <div className="trainer-floating-decor" aria-hidden="true">
      <div className="trainer-floating-orbs">
        <div className="trainer-floating-orb trainer-floating-orb--1" />
        <div className="trainer-floating-orb trainer-floating-orb--2" />
        <div className="trainer-floating-orb trainer-floating-orb--3" />
      </div>
      <div className="trainer-floating-doodles">
        <Float left="5vw" top="8vh" anim="floaty" delay="0s"><EduBook rot={-15} /></Float>
        <Float left="22vw" top="15vh" anim="wobble" delay="2.2s"><EduStar size={38} rot={8} /></Float>
        <Float left="38vw" top="6vh" anim="drift" delay="0.8s"><GraduationCap rot={10} /></Float>
        <Float left="55vw" top="12vh" anim="wobble" delay="1.5s"><Pencil rot={-20} /></Float>
        <Float left="70vw" top="5vh" anim="drift" delay="0.5s"><IdeaBulb rot={15} /></Float>
        <Float left="86vw" top="14vh" anim="floaty" delay="1.9s"><EduMedal rot={-12} /></Float>
        <Float left="8vw" top="34vh" anim="drift" delay="1.1s"><GraduationCap rot={-12} /></Float>
        <Float left="28vw" top="38vh" anim="wobble" delay="0.5s"><EduStar size={42} rot={20} /></Float>
        <Float left="46vw" top="32vh" anim="floaty" delay="0.4s"><EduBook rot={8} /></Float>
        <Float left="68vw" top="36vh" anim="drift" delay="2.1s"><IdeaBulb rot={-15} /></Float>
        <Float left="88vw" top="35vh" anim="wobble" delay="1.8s"><EduMedal rot={18} /></Float>
        <Float left="12vw" top="58vh" anim="floaty" delay="1.3s"><Pencil rot={12} /></Float>
        <Float left="30vw" top="64vh" anim="drift" delay="0.6s"><EduStar size={46} rot={-8} /></Float>
        <Float left="48vw" top="56vh" anim="wobble" delay="2.5s"><GraduationCap rot={5} /></Float>
        <Float left="72vw" top="60vh" anim="floaty" delay="0.9s"><EduBook rot={-10} /></Float>
        <Float left="90vw" top="58vh" anim="drift" delay="1.7s"><IdeaBulb rot={8} /></Float>
        <Float left="6vw" top="82vh" anim="wobble" delay="0.3s"><EduMedal rot={-5} /></Float>
        <Float left="24vw" top="80vh" anim="drift" delay="2.8s"><Pencil rot={15} /></Float>
        <Float left="45vw" top="84vh" anim="floaty" delay="1.2s"><EduStar size={34} rot={25} /></Float>
        <Float left="66vw" top="82vh" anim="wobble" delay="2.0s"><GraduationCap rot={15} /></Float>
        <Float left="85vw" top="78vh" anim="drift" delay="0.7s"><EduBook rot={20} /></Float>
      </div>
    </div>
  );
}

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
      aiGeneratedScenarios: Array.isArray(parsed.aiGeneratedScenarios) ? parsed.aiGeneratedScenarios : DEFAULT_PROGRESS.aiGeneratedScenarios,
      purchasedSuggestionIds: Array.isArray(parsed.purchasedSuggestionIds)
        ? parsed.purchasedSuggestionIds
        : DEFAULT_PROGRESS.purchasedSuggestionIds,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function getStoredAppUser() {
  try {
    return JSON.parse(window.localStorage.getItem(MOCK_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function isEmployeeUser() {
  return getStoredAppUser()?.role === 'employee';
}

function getCompanyAssignmentScenario(assignment) {
  return scenarios.find((scenario) => scenario.id === assignment.scenarioId) || scenarios[0];
}

function getCompanyAssignmentState(assignment, index, progress) {
  const scenario = getCompanyAssignmentScenario(assignment);
  if (progress.completed[scenario.id]) {
    return { label: 'completed', text: 'Пройдено' };
  }

  const previous = COMPANY_ASSIGNMENTS[index - 1];
  const previousScenario = previous ? getCompanyAssignmentScenario(previous) : null;
  const isOpen = index === 0 || !previousScenario || progress.completed[previousScenario.id];
  return isOpen ? { label: 'open', text: 'Обязательно пройти' } : { label: 'locked', text: 'Откроется позже' };
}

function getCompanyTrackStats(progress) {
  const completed = COMPANY_ASSIGNMENTS.filter((assignment) => {
    const scenario = getCompanyAssignmentScenario(assignment);
    return Boolean(progress.completed[scenario.id]);
  }).length;

  return {
    completed,
    total: COMPANY_ASSIGNMENTS.length,
    isComplete: completed >= COMPANY_ASSIGNMENTS.length,
  };
}

function getIndustry(industryId) {
  return industries.find((industry) => industry.id === industryId) || industries[0];
}

function startQuickPractice(progress, setProgress, navigate, t) {
  const { remaining } = getQuickPracticeUsage(progress);
  if (remaining <= 0) {
    window.alert(t.quickPracticeLimit);
    return;
  }

  const usagePatch = consumeQuickPractice(progress);
  if (!usagePatch) {
    window.alert(t.quickPracticeLimit);
    return;
  }

  const scenario = buildQuickScenario(progress, getIndustry);
  const caseId = pickQuickCaseId(scenario);

  setProgress((current) => ({
    ...current,
    ...usagePatch,
    aiGeneratedScenarios: [scenario, ...(current.aiGeneratedScenarios || [])],
  }));

  navigate('/simulation', {
    state: buildSimulationState(scenario, caseId, { quickPractice: true }),
  });
}

function buildSimulationState(scenario, caseId, { quickPractice = false } = {}) {
  const industry = getIndustry(scenario.industry);

  return {
    caseId,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    industryName: industry.name,
    industryIcon: industry.icon,
    quickPractice,
  };
}

function startScenarioSimulation(scenario, navigate) {
  const caseId = pickQuickCaseId(scenario);
  navigate('/simulation', {
    state: buildSimulationState(scenario, caseId),
  });
}

function findScenarioById(id, progress) {
  return (
    scenarios.find((item) => item.id === id) ||
    (progress.aiGeneratedScenarios || []).find((item) => item.id === id)
  );
}

function suggestionToScenario(offer) {
  const industry = getIndustry(offer.industry);
  return {
    id: `shop_${offer.id}`,
    industry: offer.industry,
    skill: offer.skill,
    title: offer.title,
    goal: offer.description,
    difficulty: offer.difficulty,
    durationMin: offer.durationMin,
    xpReward: 15 + offer.difficulty * 3,
    coinReward: 8,
    aiPersona: `Персонаж: ${offer.title}`,
    patientType: offer.patientType || 'neutral',
    isPurchased: true,
    shopOfferId: offer.id,
    script: [
      { role: 'ai', text: 'Здравствуйте. У меня к вам непростой вопрос…', delay: 1200 },
      {
        role: 'user',
        expected: ['понимаю', 'спокойно'],
        hint: 'Признайте эмоцию и задайте уточняющий вопрос.',
        quickReplies: ['Понимаю, давайте разберёмся по шагам.', 'Расскажите, что произошло?'],
      },
    ],
    feedback: {
      good: [`Отработан навык: ${offer.skill}`],
      improve: ['Попробуйте уточнить факты перед выводами'],
    },
    _offerEmoji: offer.emoji,
  };
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

function useInterfaceLanguage() {
  const [lang, setLangState] = useState(() => {
    try {
      return window.localStorage.getItem(LANG_KEY) || 'ru';
    } catch {
      return 'ru';
    }
  });

  const setLang = (nextLang) => {
    const safeLang = text[nextLang] ? nextLang : 'ru';
    setLangState(safeLang);
    try {
      window.localStorage.setItem(LANG_KEY, safeLang);
    } catch {}
  };

  useEffect(() => {
    const syncLang = () => {
      try {
        const storedLang = window.localStorage.getItem(LANG_KEY) || 'ru';
        if (text[storedLang]) {
          setLangState(storedLang);
        }
      } catch {}
    };

    window.addEventListener('storage', syncLang);
    window.addEventListener('focus', syncLang);

    return () => {
      window.removeEventListener('storage', syncLang);
      window.removeEventListener('focus', syncLang);
    };
  }, []);

  return [lang, setLang];
}

function BottomNav({ t }) {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          <span aria-hidden="true">{item.icon}</span>
          <strong>{t[item.labelKey]}</strong>
        </NavLink>
      ))}
    </nav>
  );
}

function PageTop({ title, subtitle, backTo, t = text.ru }) {
  return (
    <header className="page-top">
      <div>
        {backTo ? (
          <Link className="back-link" to={backTo}>
            <ArrowLeft size={18} aria-hidden="true" /> {t.back}
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
              onClick={() => !disabled && startScenarioSimulation(scenario, navigate)}
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

function LanguageControl({ lang, setLang, t }) {
  return (
    <div className="language-control" aria-label={t.language}>
      <Languages size={16} aria-hidden="true" />
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          className={lang === item.code ? 'is-active' : undefined}
          onClick={() => setLang(item.code)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TrainerToolbar({ progress, lang, setLang, t, onLogout }) {
  return (
    <header className="trainer-toolbar">
      <Link to="/home" className="home-screen-wordmark" aria-label="ilm-AI">
        ilm-<span>AI</span>
      </Link>
      <div className="home-header-actions" aria-label="Показатели пользователя">
        <div className="home-metrics">
          <StatPill icon="🔥" label={`${progress.streak} ${t.streakDays}`} />
          <StatPill icon="⭐" label={`${progress.xp} XP`} />
          <StatPill icon="🪙" label={`${progress.coins} ${t.coins}`} />
        </div>
        <LanguageControl lang={lang} setLang={setLang} t={t} />
        <button type="button" className="logout-button tap" onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" />
          {t.logout}
        </button>
      </div>
    </header>
  );
}

function HomePage({ progress, setProgress, t }) {
  const navigate = useNavigate();
  const quickUsage = getQuickPracticeUsage(progress);
  const quest = quests[0];
  const questDone = progress.questDoneDate === todayKey();
  const focusDone = progress.focusDoneDate === todayKey();
  const questTarget = scenarios.find((scenario) => scenario.skill === quest.targetSkill) || scenarios[0];
  const dailyQuestText = quest.text === 'Пройти 1 сценарий на стрессоустойчивость' ? t.questText : quest.text;
  const showCompanyTrack = isEmployeeUser();
  const companyTrack = getCompanyTrackStats(progress);
  const modeCards = [
    ...(showCompanyTrack
      ? [{
          badgeText: 'ОБЯЗАТЕЛЬНО',
          badgeBg: 'var(--rose)',
          emoji: '🏢',
          title: 'От компании',
          desc: `Пройдите задания по порядку: ${companyTrack.completed}/${companyTrack.total}.`,
          accent: 'var(--rose)',
          path: '/company',
        }]
      : []),
    {
      badgeText: t.modePlanBadge, badgeBg: 'var(--mint)', emoji: '🗺️',
      title: t.modePlanTitle, desc: t.modePlanDesc,
      accent: 'var(--mint)', path: '/plan'
    },
    {
      badgeText: t.modeLibraryBadge, badgeBg: 'var(--sky)', emoji: '📚',
      title: t.modeLibraryTitle, desc: t.modeLibraryDesc,
      accent: 'var(--sky-deep)', path: '/library'
    },
    {
      badgeText: t.modePracticeBadge, badgeBg: 'var(--butter)', emoji: '🎮',
      title: t.modePracticeTitle, desc: t.modePracticeDesc,
      accent: 'var(--butter)', path: '/practice', quickStart: true,
    },
  ];

  return (
    <section className="home-screen">
      <div className="home-screen-hero popin">
        <div className="home-screen-hero-title">
          ilm-
          <span className="home-screen-hero-ai">AI</span>
          <span className="home-screen-hero-badge">{t.appName}</span>
        </div>
        <p>{t.tagline}</p>
      </div>

      <section className="daily-panel plush-lg popin" aria-labelledby="daily-panel-title">
        <div className="daily-panel-heading">
          <span className="chip sky">{t.dailyPanelTitle}</span>
          <h2 id="daily-panel-title">{t.dailyPanelSubtitle}</h2>
        </div>
        <div className="daily-panel-grid home-daily-grid">
          <article className="daily-tile daily-quest-tile">
            <header className="daily-tile-head">
              <div className="daily-quest-visual" aria-hidden="true">
                <span className="daily-quest-emoji">🎯</span>
                <span className="daily-quest-status">{t.onlineBubble}</span>
              </div>
              <span className="chip butter">{t.dailyQuest}</span>
            </header>
            <h3 className="daily-tile-title">{dailyQuestText}</h3>
            <div className="quest-progress">
              <span>{questDone ? '1/1' : '0/1'}</span>
              <div>
                <i style={{ width: questDone ? '100%' : '0%' }} />
              </div>
            </div>
            <div className="daily-tile-foot">
              <button
                className="btn-plush primary"
                type="button"
                onClick={() => navigate(`/scenario/${questTarget.id}`)}
                disabled={questDone}
              >
                <Play size={15} aria-hidden="true" />
                {questDone ? t.done : t.start}
              </button>
              <div className="daily-task-reward">
                <span className="daily-reward-label">{t.dailyReward}</span>
                <span className="reward-badge reward-badge--compact">+{quest.reward} XP</span>
              </div>
            </div>
          </article>

          <aside className="daily-tile daily-coach-tile">
            <header className="daily-tile-head">
              <div className="daily-coach-visual" aria-hidden="true">
                <span className="daily-coach-emoji">✨</span>
              </div>
              <span className="chip sky">{t.focusToday}</span>
            </header>
            <p className="daily-tile-copy">{t.focusCopy}</p>
            <div className="daily-tile-foot daily-coach-foot">
              {focusDone ? (
                <span className="chip mint">{t.focusCompleted}</span>
              ) : (
                <div className="daily-task-reward">
                  <span className="daily-reward-label">{t.dailyReward}</span>
                  <span className="reward-badge reward-badge--compact">+{DAILY_FOCUS_COIN_REWARD} 🪙</span>
                </div>
              )}
            </div>
            <div className="daily-coach-stats">
              <span>{t.coins}: 🪙 {progress.coins}</span>
              <span>{t.unlocked}: 🔓 {Object.keys(progress.completed).length + 1}</span>
              {showCompanyTrack ? (
                <span>🏢 {companyTrack.completed}/{companyTrack.total} обязательно</span>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      {/* ── Mode Selection Cards Grid ── */}
      <div className="mode-cards-grid">
        {modeCards.map((mode, i) => (
          <div
            key={i}
            className="tap hover-scale popin"
            onClick={() => {
              if (mode.quickStart) {
                startQuickPractice(progress, setProgress, navigate, t);
                return;
              }
              navigate(mode.path);
            }}
            style={{
              width: 270,
              background: 'white',
              border: '3.5px solid var(--line)',
              borderRadius: 24,
              padding: '24px 22px',
              boxShadow: '0 6px 0 var(--line), 0 12px 24px rgba(43,30,22,0.06)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 14,
              transition: 'all 150ms ease',
              animationDelay: `${i * 0.1}s`,
            }}
          >
            {/* Card Header Tags */}
            <div style={{ display: 'flex', justifySelf: 'start', alignItems: 'center' }}>
              <span style={{
                fontSize: 10, fontWeight: 900,
                background: mode.badgeBg,
                color: 'var(--ink)',
                border: '2px solid var(--line)',
                borderRadius: 6,
                padding: '2px 8px',
                boxShadow: '0 2px 0 var(--line)',
                letterSpacing: '0.05em',
              }}>
                {mode.badgeText}
              </span>
            </div>

            {/* Emoji illustration */}
            <div style={{
              width: 58, height: 58, borderRadius: '50%',
              background: mode.accent,
              border: '2.5px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, boxShadow: '0 3.5px 0 var(--line)',
            }}>
              {mode.emoji}
            </div>

            {/* Title & Slogan */}
            <div style={{ flexGrow: 1 }}>
              <div style={{
                fontFamily: 'Nunito', fontWeight: 900, fontSize: 18,
                color: 'var(--ink)',
                marginBottom: 6,
              }}>
                {mode.title}
              </div>
              <div style={{
                fontFamily: 'Nunito', fontWeight: 700, fontSize: 12,
                color: 'var(--ink-2)', lineHeight: 1.45,
              }}>
                {mode.desc}
              </div>
            </div>

            {/* CTA Action button */}
            <div style={{
              background: 'var(--butter)',
              border: '2.5px solid var(--line)',
              borderRadius: 12,
              padding: '10px 0',
              textAlign: 'center',
              fontFamily: 'Nunito', fontWeight: 900, fontSize: 13,
              color: 'var(--ink)',
              boxShadow: '0 3.5px 0 var(--line)',
              transition: 'all 120ms ease',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {t.open} →
            </div>
          </div>
        ))}
      </div>

      <div className="home-screen-actions popin">
        {[
          { icon: '📊', label: t.progress, onClick: () => navigate('/results-page'), bg: 'white' },
          { icon: '👤', label: t.profile,  onClick: () => navigate('/profile'), bg: 'var(--butter)' },
        ].map((item, i) => (
          <button
            key={i}
            type="button"
            className="tap btn-plush"
            onClick={item.onClick}
            style={{
              flex: 1,
              padding: '12px 0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              background: item.bg,
              boxShadow: '0 4px 0 var(--line)',
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlanPage({ progress }) {
  const navigate = useNavigate();
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
            <button
              className="btn-plush sm primary"
              type="button"
              onClick={() => startScenarioSimulation(nextScenario, navigate)}
            >
              ▶ Начать
            </button>
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

function ScenarioPage({ progress }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const scenario = findScenarioById(id, progress);

  if (!scenario) {
    return <Navigate to="/home" replace />;
  }

  return (
    <section className="screen scenario-screen">
      <ScenarioPreview scenario={scenario} onStart={() => startScenarioSimulation(scenario, navigate)} />
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

function ResultsPage({ progress }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scenario = findScenarioById(id, progress);

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

function LibraryPage({ progress, setProgress, t = getText('ru') }) {
  const navigate = useNavigate();
  const [libraryTab, setLibraryTab] = useState('mine');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [genIndustry, setGenIndustry] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [userWish, setUserWish] = useState('');
  const [showGenModal, setShowGenModal] = useState(false);
  const [purchasingId, setPurchasingId] = useState(null);

  const myIndustryIds = useMemo(() => [
    progress.primaryIndustry,
    ...progress.additionalIndustries,
  ], [progress.primaryIndustry, progress.additionalIndustries]);

  const myIndustries = useMemo(
    () => industries.filter((ind) => myIndustryIds.includes(ind.id)),
    [myIndustryIds],
  );

  const dailyOffers = useMemo(
    () => getDailySuggestions(myIndustryIds, todayKey()),
    [myIndustryIds],
  );

  const purchasedIds = progress.purchasedSuggestionIds || [];

  const myScenarios = useMemo(() => {
    const catalog = scenarios.filter((scenario) => myIndustryIds.includes(scenario.industry));
    const custom = (progress.aiGeneratedScenarios || []).filter((scenario) =>
      myIndustryIds.includes(scenario.industry),
    );
    const byId = new Map();
    [...catalog, ...custom].forEach((scenario) => byId.set(scenario.id, scenario));
    return Array.from(byId.values());
  }, [myIndustryIds, progress.aiGeneratedScenarios]);

  const filteredScenarios = myScenarios.filter((scenario) => {
    const matchesIndustry = industryFilter === 'all' || scenario.industry === industryFilter;
    return matchesIndustry;
  });

  function isOfferOwned(offerId) {
    return (
      purchasedIds.includes(offerId) ||
      (progress.aiGeneratedScenarios || []).some((s) => s.shopOfferId === offerId)
    );
  }

  function getOwnedScenarioId(offerId) {
    const found = (progress.aiGeneratedScenarios || []).find((s) => s.shopOfferId === offerId);
    return found?.id || (purchasedIds.includes(offerId) ? `shop_${offerId}` : null);
  }

  function openGenModal() {
    setGenIndustry(myIndustryIds[0] || '');
    setUserWish('');
    setShowGenModal(true);
  }

  function closeGenModal() {
    if (!isGenerating) {
      setShowGenModal(false);
    }
  }

  const handleGenerate = () => {
    if (progress.coins < 5) {
      alert('Недостаточно монет! Нужно 5 🪙');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      const selectedIndustry = genIndustry || myIndustryIds[0];
      const ind = getIndustry(selectedIndustry);

      const newScenario = {
        id: `ai_${Date.now()}`,
        industry: selectedIndustry,
        skill: 'AI Генерация',
        title: userWish || `Кейс: ${ind.name}`,
        goal: 'Отработка навыков в свободной форме',
        difficulty: Math.floor(Math.random() * 3) + 1,
        durationMin: 5,
        xpReward: 20,
        coinReward: 10,
        aiPersona: 'Сгенерированный персонаж',
        patientType: 'neutral',
        isAiGenerated: true,
        script: [
          { role: 'ai', text: 'Здравствуйте! Я готов к общению. С чего начнем?', delay: 1000 },
          {
            role: 'user',
            expected: ['приветствие'],
            hint: 'Поприветствуйте собеседника',
            quickReplies: ['Добрый день!', 'Здравствуйте, чем могу помочь?'],
          },
        ],
        feedback: {
          good: ['ИИ сгенерировал этот кейс специально для вас'],
          improve: ['Вы можете настроить пожелания при следующей генерации'],
        },
      };

      setProgress((curr) => ({
        ...curr,
        coins: curr.coins - 5,
        aiGeneratedScenarios: [newScenario, ...(curr.aiGeneratedScenarios || [])],
      }));
      setIsGenerating(false);
      setShowGenModal(false);
      setUserWish('');
      setLibraryTab('mine');
    }, 2000);
  };

  function handleBuyOffer(offer) {
    if (isOfferOwned(offer.id)) {
      const scenarioId = getOwnedScenarioId(offer.id);
      if (scenarioId) navigate(`/scenario/${scenarioId}`);
      return;
    }

    if (offer.price > 0 && progress.coins < offer.price) {
      alert(`Недостаточно монет! Нужно ${offer.price} 🪙`);
      return;
    }

    setPurchasingId(offer.id);
    setTimeout(() => {
      const newScenario = suggestionToScenario(offer);
      setProgress((curr) => ({
        ...curr,
        coins: curr.coins - offer.price,
        purchasedSuggestionIds: [...new Set([...(curr.purchasedSuggestionIds || []), offer.id])],
        aiGeneratedScenarios: [newScenario, ...(curr.aiGeneratedScenarios || [])],
      }));
      setPurchasingId(null);
      setLibraryTab('mine');
    }, 600);
  }

  return (
    <section className="screen library-screen">
      <PageTop title={t.libraryPageTitle} subtitle={t.libraryPageSubtitle} backTo="/home" t={t} />

      <div className="library-tabs plush" role="tablist" aria-label={t.librarySectionsLabel}>
        <button
          type="button"
          role="tab"
          aria-selected={libraryTab === 'mine'}
          className={`library-tab tap ${libraryTab === 'mine' ? 'is-active' : ''}`}
          onClick={() => setLibraryTab('mine')}
        >
          📚 {t.libraryTabMine}
          <span className="library-tab-count">{myScenarios.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={libraryTab === 'offers'}
          className={`library-tab tap ${libraryTab === 'offers' ? 'is-active' : ''}`}
          onClick={() => setLibraryTab('offers')}
        >
          ✨ {t.libraryTabOffers}
          <span className="library-tab-count">10</span>
        </button>
      </div>

      {libraryTab === 'mine' ? (
        <>
          <div className="library-ai-section plush-lg popin">
            <div className="library-ai-section-head">
              <div>
                <span className="chip sky">AI Генератор</span>
                <h2>{t.generateCase}</h2>
                <p>ИИ подготовит уникальный кейс под ваш запрос</p>
              </div>
              <button type="button" className="btn-plush primary tap" onClick={openGenModal}>
                <Sparkles size={18} aria-hidden="true" />
                {t.generateButton}
              </button>
            </div>
          </div>

          <div className="filter-bar plush">
            <select value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)}>
              <option value="all">Все мои отрасли</option>
              {myIndustries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </div>

          <div className="scenario-list">
            {filteredScenarios.length > 0 ? (
              filteredScenarios.map((scenario) => {
                const industry = getIndustry(scenario.industry);
                const rating = progress.completed[scenario.id]?.rating || 0;

                return (
                  <Link key={scenario.id} className="library-card plush tap" to={`/scenario/${scenario.id}`}>
                    <div className="library-icon">
                      {scenario._offerEmoji || (scenario.isAiGenerated || scenario.isPurchased ? '✨' : industry.icon)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span className="chip sky">{scenario.skill}</span>
                        {scenario.isAiGenerated && <span className="chip butter">AI</span>}
                        {scenario.isPurchased && <span className="chip mint">Куплен</span>}
                      </div>
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
              })
            ) : (
              <div className="library-empty plush">
                <p>У вас пока нет кейсов в этой отрасли.</p>
                <button type="button" className="btn-plush primary tap" onClick={() => setLibraryTab('offers')}>
                  Смотреть предложения
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="library-offers-section">
          <header className="library-offers-head plush-lg">
            <div className="library-offers-head-copy">
              <h2 className="library-offers-title">
                <span className="library-offers-title-icon" aria-hidden="true">✨</span>
                {t.dailyOffersTitle}
              </h2>
              <p className="library-offers-subtitle">{t.dailyOffersSubtitle}</p>
              <p className="library-offers-meta">{t.updatesDaily}</p>
            </div>
            <div className="library-coins-badge plush-tiny">
              <span className="library-coins-label">{t.yourCoins}</span>
              <strong className="library-coins-value">
                <span aria-hidden="true">🪙</span> {progress.coins}
              </strong>
            </div>
          </header>

          <div className="offers-grid">
            {dailyOffers.map((offer, index) => {
              const industry = getIndustry(offer.industry);
              const owned = isOfferOwned(offer.id);
              const canAfford = offer.price === 0 || progress.coins >= offer.price;
              const isBuying = purchasingId === offer.id;

              return (
                <article key={offer.id} className={`offer-card plush-lg popin ${owned ? 'is-owned' : ''}`} style={{ animationDelay: `${index * 0.04}s` }}>
                  <div className="offer-card-top">
                    <div className="offer-emoji" aria-hidden="true">{offer.emoji}</div>
                    <div className="offer-price-tag">
                      {offer.price === 0 ? (
                        <span className="offer-price-free">{t.free}</span>
                      ) : (
                        <span className="offer-price-coins">{offer.price} 🪙</span>
                      )}
                    </div>
                  </div>

                  <div className="offer-card-body">
                    <div className="offer-tags">
                      <span className="chip sky">{industry.icon} {industry.name}</span>
                      <span className="chip peach">{offer.skill}</span>
                    </div>
                    <h3>{offer.title}</h3>
                    <p className="offer-description">{offer.description}</p>
                    <div className="offer-meta">
                      <span>{offer.durationMin} мин</span>
                      <span>{getDifficultyLabel(offer.difficulty)}</span>
                    </div>
                  </div>

                  <div className="offer-card-foot">
                    {owned ? (
                      <button
                        type="button"
                        className="btn-plush mint tap"
                        onClick={() => handleBuyOffer(offer)}
                      >
                        {t.openCase}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-plush primary tap"
                        onClick={() => handleBuyOffer(offer)}
                        disabled={!canAfford || isBuying}
                      >
                        {isBuying ? '…' : offer.price === 0 ? t.free : `${t.buyFor} ${offer.price} 🪙`}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {showGenModal && (
        <div className="modal-overlay" onClick={closeGenModal}>
          <div className="modal-content gen-modal plush-lg popin" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="gen-modal-title">
            {!isGenerating && (
              <button type="button" className="modal-close" onClick={closeGenModal} aria-label="Закрыть">
                <X size={20} />
              </button>
            )}

            <div className="modal-body gen-modal-body">
              {isGenerating ? (
                <div className="gen-modal-loading">
                  <div className="ai-loader" aria-hidden="true">✨</div>
                  <h2>Генерируем кейс</h2>
                  <p>ИИ подбирает ситуацию под вашу отрасль и пожелания…</p>
                </div>
              ) : (
                <>
                  <div className="gen-modal-head">
                    <span className="chip sky">AI Генератор</span>
                    <h2 id="gen-modal-title">Новый кейс</h2>
                    <p className="gen-modal-subtitle">Опишите ситуацию — ИИ соберёт уникальный сценарий для тренировки</p>
                  </div>

                  <div className="gen-modal-field">
                    <label htmlFor="gen-industry">Отрасль</label>
                    <select
                      id="gen-industry"
                      className="gen-modal-select"
                      value={genIndustry}
                      onChange={(e) => setGenIndustry(e.target.value)}
                    >
                      {myIndustries.map((ind) => (
                        <option key={ind.id} value={ind.id}>
                          {ind.icon} {ind.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gen-modal-field">
                    <label htmlFor="gen-wish">Ваши пожелания</label>
                    <textarea
                      id="gen-wish"
                      className="gen-modal-textarea"
                      placeholder="Например: сложный пациент, который не хочет слушать рекомендации…"
                      value={userWish}
                      onChange={(e) => setUserWish(e.target.value)}
                      rows={4}
                    />
                    <span className="gen-modal-hint">Необязательно — можно оставить пустым</span>
                  </div>

                  <div className={`gen-modal-cost ${progress.coins < 5 ? 'is-insufficient' : ''}`}>
                    <div className="gen-modal-cost-row">
                      <span>Стоимость</span>
                      <strong>5 🪙</strong>
                    </div>
                    <div className="gen-modal-cost-row">
                      <span>У вас</span>
                      <strong>{progress.coins} 🪙</strong>
                    </div>
                    {progress.coins < 5 && (
                      <p className="gen-modal-cost-warning">Недостаточно монет для генерации</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {!isGenerating && (
              <div className="modal-footer gen-modal-footer">
                <button type="button" className="btn-plush tap" onClick={closeGenModal}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-plush primary tap"
                  onClick={handleGenerate}
                  disabled={progress.coins < 5}
                >
                  <Sparkles size={18} aria-hidden="true" />
                  Создать кейс
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CompanyAssignmentsPage({ progress }) {
  const navigate = useNavigate();
  const track = getCompanyTrackStats(progress);

  return (
    <section className="screen library-screen company-screen">
      <PageTop title="От компании" subtitle="Обязательные задания открываются по порядку" backTo="/home" />

      <header className="library-offers-head plush-lg company-track-head">
        <div className="library-offers-head-copy">
          <h2 className="library-offers-title">
            <span className="library-offers-title-icon" aria-hidden="true">🏢</span>
            Корпоративный минимум
          </h2>
          <p className="library-offers-subtitle">
            Эти сцены нужно пройти до контрольной точки. Следующее задание откроется после завершения предыдущего.
          </p>
          <p className="library-offers-meta">
            Прогресс: {track.completed}/{track.total} {track.isComplete ? '· контрольная точка пройдена' : '· продолжайте по порядку'}
          </p>
        </div>
        <div className="library-coins-badge plush-tiny">
          <span className="library-coins-label">Обязательно</span>
          <strong className="library-coins-value">{track.completed}/{track.total}</strong>
        </div>
      </header>

      <div className="scenario-list company-assignment-list">
        {COMPANY_ASSIGNMENTS.map((assignment, index) => {
          const scenario = getCompanyAssignmentScenario(assignment);
          const industry = getIndustry(scenario.industry);
          const state = getCompanyAssignmentState(assignment, index, progress);
          const rating = progress.completed[scenario.id]?.rating || 0;
          const isLocked = state.label === 'locked';

          return (
            <article key={assignment.id} className={`library-card plush company-assignment-card ${state.label}`}>
              <div className="library-icon">
                {state.label === 'locked' ? '🔒' : state.label === 'completed' ? '✓' : industry.icon}
              </div>
              <div>
                <div className="company-assignment-tags">
                  <span className={state.label === 'completed' ? 'chip mint' : state.label === 'locked' ? 'chip rose' : 'chip butter'}>
                    {state.text}
                  </span>
                  <span className="chip sky">{assignment.badge}</span>
                  <span className="chip peach">Шаг {index + 1}</span>
                </div>
                <h2>{assignment.title}</h2>
                <p>{assignment.description}</p>
                <div className="library-meta">
                  <span>{scenario.durationMin} мин</span>
                  <span>{getDifficultyLabel(scenario.difficulty)}</span>
                  {rating ? <RatingStars rating={rating} /> : <span>{assignment.checkpoint}</span>}
                </div>
              </div>
              <button
                type="button"
                className={`btn-plush sm ${state.label === 'completed' ? 'mint' : 'primary'} tap`}
                disabled={isLocked}
                onClick={() => navigate(`/scenario/${scenario.id}`)}
              >
                {state.label === 'completed' ? 'Повторить' : isLocked ? 'Закрыто' : 'Пройти'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProgressPage({ progress }) {
  const completedCount = Object.keys(progress.completed).length;
  const attempts = progress.attempts || [];
  
  // Stats
  const scenariosCompleted = completedCount;
  const totalRating = Object.values(progress.completed).reduce((sum, c) => sum + c.rating, 0);
  const accuracy = Math.round((totalRating / (completedCount * 3 || 1)) * 100);
  const practiceMinutes = Object.keys(progress.completed).reduce((sum, id) => {
    const scenario = scenarios.find(s => s.id === id);
    return sum + (scenario?.durationMin || 0);
  }, 0);

  // GitHub Grid
  const gridData = useMemo(() => {
    const grid = [];
    const now = new Date();
    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const count = attempts.filter(a => a.date === key).length;
      grid.push({ date: key, count });
    }
    return grid;
  }, [attempts]);

  const getLevel = (count) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    return 4;
  };

  // Psychological Metrics Calculation
  const calculateMetrics = (attemptsList) => {
    const base = { empathy: 40, clarity: 45, resilience: 35, honesty: 50 };
    if (attemptsList.length === 0) return base;

    const scores = { empathy: [], clarity: [], resilience: [], honesty: [] };
    
    attemptsList.forEach(a => {
      const s = scenarios.find(sc => sc.id === a.scenarioId);
      if (!s) return;
      
      const rating = (a.rating / 3) * 100;
      
      if (['Эмпатия', 'Активное слушание', 'Деэскалация'].includes(s.skill)) scores.empathy.push(rating);
      if (['Ясные инструкции', 'Объяснение сложного', 'Обратная связь'].includes(s.skill)) scores.clarity.push(rating);
      if (['Стрессоустойчивость', 'Кризисная коммуникация', 'Конфликт'].includes(s.skill)) scores.resilience.push(rating);
      if (['Нейтральный тон', 'Сбор анамнеза', 'Переговоры'].includes(s.skill)) scores.honesty.push(rating);
    });

    const avg = (arr, def) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : def;

    return {
      empathy: avg(scores.empathy, base.empathy),
      clarity: avg(scores.clarity, base.clarity),
      resilience: avg(scores.resilience, base.resilience),
      honesty: avg(scores.honesty, base.honesty),
    };
  };

  const metrics = useMemo(() => calculateMetrics(attempts), [attempts]);
  const prevMetrics = useMemo(() => calculateMetrics(attempts.slice(1)), [attempts]);

  const getTrend = (curr, prev) => {
    const diff = curr - prev;
    if (diff === 0) return null;
    return (
      <span className={`trend ${diff > 0 ? 'up' : 'down'}`}>
        {diff > 0 ? '↑' : '↓'} {Math.abs(diff)}%
      </span>
    );
  };

  // Important Emotions
  const emotions = [
    { name: 'Уверенность', value: 75, trend: 5, icon: '🛡️' },
    { name: 'Терпение', value: 60, trend: -2, icon: '⏳' },
    { name: 'Внимательность', value: 85, trend: 10, icon: '👁️' },
    { name: 'Стрессоустойчивость', value: 45, trend: 0, icon: '🌊' },
  ];

  // Patient Types Mapping
  const patientTypes = {
    vip: { label: 'VIP', icon: <UserPlus size={14} />, color: 'var(--butter)' },
    good: { label: 'Лояльный', icon: <UserCheck size={14} />, color: 'var(--mint)' },
    angry: { label: 'Сложный', icon: <UserMinus size={14} />, color: 'var(--rose)' },
    neutral: { label: 'Обычный', icon: <User size={14} />, color: 'var(--sky)' },
    sad: { label: 'Грустный', icon: <Smile size={14} />, color: 'var(--peach)' },
  };

  // History
  const recentHistory = attempts.slice(0, 5);

  // Achievements
  const myAchievements = [
    { id: 'first', title: 'Первый шаг', icon: '🌱', unlocked: completedCount >= 1 },
    { id: 'master', title: 'Мастер', icon: '🏆', unlocked: completedCount >= 5 },
    { id: 'stress', title: 'Стрессоустойчивый', icon: '🧘', unlocked: attempts.some(a => {
      const s = scenarios.find(sc => sc.id === a.scenarioId);
      return s?.skill === 'Стрессоустойчивость' && a.rating === 3;
    })},
    { id: 'streak', title: 'Постоянство', icon: '🔥', unlocked: progress.streak >= 3 },
  ];

  return (
    <section className="screen progress-screen results-page">
      <PageTop title="Аналитика" subtitle="Ваш путь к мастерству" backTo="/home" />

      <article className="plush goal-card">
        <div className="goal-content">
          <h2>Ваша цель</h2>
          <p>{progress.goal || 'Улучшить навыки коммуникации'}</p>
        </div>
        <div className="goal-icon">🎯</div>
      </article>

      <div className="results-stats-grid">
        <article className="plush stat-card cases">
          <div className="stat-icon"><BookOpen size={24} /></div>
          <div className="stat-content">
            <h3>Кейсы</h3>
            <span className="stat-value">{scenariosCompleted}</span>
          </div>
        </article>
        <article className="plush stat-card accuracy">
          <div className="stat-icon"><Target size={24} /></div>
          <div className="stat-content">
            <h3>Точность</h3>
            <span className="stat-value">{accuracy}%</span>
          </div>
        </article>
        <article className="plush stat-card minutes">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-content">
            <h3>Минуты</h3>
            <span className="stat-value">{practiceMinutes}</span>
          </div>
        </article>
      </div>

      <div className="metrics-section">
        <article className="plush-lg github-grid-container">
          <div className="github-grid-header">
            <h2>Активность</h2>
          </div>
          <div className="github-grid-wrapper">
            <div className="github-grid">
              {gridData.map((day, i) => (
                <div 
                  key={i} 
                  className={`grid-square level-${getLevel(day.count)}`} 
                  title={`${day.date}: ${day.count} сценариев`}
                />
              ))}
            </div>
          </div>
        </article>

        <article className="plush-lg psycho-profile" style={{ padding: '20px' }}>
          <h2>Психологический профиль</h2>
          <div className="metrics-grid">
            <div className="metric-row">
              <div className="metric-info">
                <span>Эмпатия</span>
                <span>{metrics.empathy}% {getTrend(metrics.empathy, prevMetrics.empathy)}</span>
              </div>
              <div className="metric-bar-bg"><div className="metric-bar-fill empathy" style={{ width: `${metrics.empathy}%` }} /></div>
            </div>
            <div className="metric-row">
              <div className="metric-info">
                <span>Ясность</span>
                <span>{metrics.clarity}% {getTrend(metrics.clarity, prevMetrics.clarity)}</span>
              </div>
              <div className="metric-bar-bg"><div className="metric-bar-fill clarity" style={{ width: `${metrics.clarity}%` }} /></div>
            </div>
            <div className="metric-row">
              <div className="metric-info">
                <span>Стойкость</span>
                <span>{metrics.resilience}% {getTrend(metrics.resilience, prevMetrics.resilience)}</span>
              </div>
              <div className="metric-bar-bg"><div className="metric-bar-fill resilience" style={{ width: `${metrics.resilience}%` }} /></div>
            </div>
            <div className="metric-row">
              <div className="metric-info">
                <span>Честность</span>
                <span>{metrics.honesty}% {getTrend(metrics.honesty, prevMetrics.honesty)}</span>
              </div>
              <div className="metric-bar-bg"><div className="metric-bar-fill honesty" style={{ width: `${metrics.honesty}%` }} /></div>
            </div>
          </div>

          <h3 style={{ marginTop: '24px', fontSize: '16px', fontWeight: '800' }}>Важные эмоции</h3>
          <div className="emotions-grid">
            {emotions.map(emo => (
              <div key={emo.name} className="emotion-item plush-tiny">
                <span className="emo-icon">{emo.icon}</span>
                <div className="emo-details">
                  <div className="emo-header">
                    <span>{emo.name}</span>
                    <span className="emo-value">{emo.value}%</span>
                  </div>
                  <div className="emo-trend-container">
                    {emo.trend !== 0 && (
                      <span className={`trend ${emo.trend > 0 ? 'up' : 'down'}`}>
                        {emo.trend > 0 ? '↑' : '↓'} {Math.abs(emo.trend)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <section className="achievements-section">
        <h2>Достижения</h2>
        <div className="achievements-row">
          {myAchievements.map(ach => (
            <article key={ach.id} className={`plush badge-card ${ach.unlocked ? 'unlocked' : ''}`}>
              <div className="badge-visual">
                <span className="badge-icon">{ach.unlocked ? ach.icon : '🔒'}</span>
                {ach.unlocked && <div className="badge-glow" />}
              </div>
              <div className="badge-info">
                <h3>{ach.title}</h3>
                <span className="badge-status">{ach.unlocked ? 'Получено' : 'Заблокировано'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="history-section">
        <h2>Последние диалоги</h2>
        <div className="history-list">
          {recentHistory.length > 0 ? (
            recentHistory.map((attempt, idx) => {
              const scenario = scenarios.find(s => s.id === attempt.scenarioId);
              const prevAttempt = attempts[idx + 1];
              const ratingDiff = prevAttempt ? attempt.rating - prevAttempt.rating : 0;
              const xpDiff = prevAttempt ? attempt.xpGained - prevAttempt.xpGained : 0;
              
              const pType = patientTypes[scenario?.patientType || 'neutral'];
              
              const allMatched = attempt.checks?.flatMap(c => c.matched) || [];
              const uniqueMatched = [...new Set(allMatched)];

              return (
                <article key={attempt.id} className="plush history-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div className="history-main">
                      <div className="patient-badge" style={{ backgroundColor: pType.color }}>
                        {pType.icon}
                        <span>{pType.label}</span>
                      </div>
                      <div className="history-info">
                        <h3>{scenario?.title || 'Сценарий'}</h3>
                        <span>{attempt.date}</span>
                      </div>
                    </div>
                    
                    <div className="history-metrics">
                      <div className="history-metric">
                        <Zap size={14} className="xp-icon" />
                        <strong>{attempt.xpGained} XP</strong>
                        {xpDiff !== 0 && (
                          <span className={`trend ${xpDiff > 0 ? 'up' : 'down'}`}>
                            {xpDiff > 0 ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                      <div className="history-rating">
                        <RatingStars rating={attempt.rating} />
                        {ratingDiff !== 0 && (
                          <span className={`trend ${ratingDiff > 0 ? 'up' : 'down'}`}>
                            {ratingDiff > 0 ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="history-details" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    {scenario?.skill && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="chip sky" style={{ fontSize: '10px', padding: '2px 8px' }}>Навык</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ink)' }}>{scenario.skill}</span>
                      </div>
                    )}
                    {uniqueMatched.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span className="chip butter" style={{ fontSize: '10px', padding: '2px 8px' }}>Проработано</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {uniqueMatched.map(term => (
                            <span key={term} style={{ fontSize: '12px', background: 'var(--paper)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <p style={{ color: 'var(--ink-soft)' }}>Вы еще не прошли ни одного сценария</p>
          )}
        </div>
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

function PracticePage({ progress, setProgress, t }) {
  const navigate = useNavigate();
  const quickUsage = getQuickPracticeUsage(progress);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    if (quickUsage.remaining > 0) {
      startQuickPractice(progress, setProgress, navigate, t);
    }
  }, [navigate, progress, quickUsage.remaining, setProgress, t]);

  return (
    <section className="screen practice-screen">
      <PageTop title={t.modePracticeTitle} subtitle={t.modePracticeDesc} backTo="/home" />
      <div className="practice-grid" style={{ gridTemplateColumns: '1fr' }}>
        <article className="practice-card plush-lg">
          <span>⚡</span>
          <h2>{t.modePracticeTitle}</h2>
          <p>{quickUsage.remaining > 0 ? `${quickUsage.remaining}/3 ${t.quickPracticeLeft}` : t.quickPracticeLimit}</p>
          {quickUsage.remaining > 0 ? (
            <button
              className="btn-plush primary tap"
              type="button"
              onClick={() => startQuickPractice(progress, setProgress, navigate, t)}
            >
              {t.start} →
            </button>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function MiniOnboardingModal({ isOpen, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [goal, setGoal] = useState('');

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete({ industry: selectedIndustry.id, role: selectedRole, goal });
      onClose();
      setStep(1);
      setSelectedIndustry(null);
      setSelectedRole('');
      setGoal('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content plush-lg popin" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">
          <X size={20} />
        </button>

        <div className="modal-body">
          {step === 1 && (
            <div className="onboarding-step">
              <h2>Выберите отрасль</h2>
              <div className="industry-grid">
                {industries.map((ind) => (
                  <button
                    key={ind.id}
                    className={`industry-option plush-tiny tap ${selectedIndustry?.id === ind.id ? 'selected' : ''}`}
                    onClick={() => setSelectedIndustry(ind)}
                  >
                    <span className="ind-icon">{ind.icon}</span>
                    <span className="ind-name">{ind.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <h2>Ваша роль в {selectedIndustry?.name}</h2>
              <div className="role-list">
                {selectedIndustry?.roles.map((role) => (
                  <button
                    key={role}
                    className={`role-option plush-tiny tap ${selectedRole === role ? 'selected' : ''}`}
                    onClick={() => setSelectedRole(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step">
              <h2>Ваша цель обучения</h2>
              <input
                className="goal-input plush-tiny"
                type="text"
                placeholder="Например: Сбор анамнеза или Переговоры"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn-plush primary"
            onClick={handleNext}
            disabled={(step === 1 && !selectedIndustry) || (step === 2 && !selectedRole) || (step === 3 && !goal)}
          >
            {step === 3 ? 'Завершить' : 'Далее'} <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ progress, setProgress }) {
  const [modalMode, setModalMode] = useState(null); // 'edit' or 'add'
  const navigate = useNavigate();

  const primaryInd = getIndustry(progress.primaryIndustry);

  const handleModalComplete = (data) => {
    if (modalMode === 'edit') {
      setProgress((current) => ({
        ...current,
        primaryIndustry: data.industry,
        role: data.role,
        goal: data.goal,
      }));
    } else {
      setProgress((current) => ({
        ...current,
        additionalIndustries: [...new Set([...current.additionalIndustries, data.industry])],
      }));
    }
    setModalMode(null);
  };

  const handleSwitchIndustry = (industryId) => {
    const ind = getIndustry(industryId);
    setProgress((current) => {
      const newAdditional = current.additionalIndustries.filter(id => id !== industryId);
      if (current.primaryIndustry) {
        newAdditional.push(current.primaryIndustry);
      }
      return {
        ...current,
        primaryIndustry: industryId,
        role: ind.roles[0], // Default to first role
        additionalIndustries: [...new Set(newAdditional)],
      };
    });
  };

  const handleDeleteIndustry = (e, industryId) => {
    e.stopPropagation();
    setProgress((current) => ({
      ...current,
      additionalIndustries: current.additionalIndustries.filter((id) => id !== industryId),
    }));
  };

  const handleReset = () => {
    if (window.confirm('Сбросить весь прогресс? Это действие нельзя отменить.')) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      window.localStorage.removeItem(MOCK_SESSION_KEY);
    } catch {}
    navigate('/signin', { replace: true });
  };

  return (
    <section className="screen profile-screen">
      <header className="profile-header">
        <Link className="back-link" to="/home">
          <ArrowLeft size={18} /> Назад
        </Link>
        <h1>{progress.name}</h1>
      </header>

      <div className="profile-content">
        <article className="profile-section plush-lg">
          <div className="section-head">
            <span className="chip sky">Текущая специализация</span>
            <button className="edit-btn" onClick={() => setModalMode('edit')}>
              ✏️ Изменить
            </button>
          </div>
          <div className="spec-info">
            <div className="spec-main">
              <span className="spec-icon">{primaryInd.icon}</span>
              <div>
                <h3>{primaryInd.name} • {progress.role}</h3>
                <p>🎯 Цель: {progress.goal}</p>
              </div>
            </div>
          </div>
        </article>

        <article className="profile-section">
          <h2 className="section-title">Доп. отрасли</h2>
          <div className="additional-industries">
            {progress.additionalIndustries.map((id) => {
              const ind = getIndustry(id);
              return (
                <div key={id} className="industry-tag plush-tiny tap" onClick={() => handleSwitchIndustry(id)}>
                  <span>{ind.icon} {ind.name}</span>
                  <button className="delete-ind" onClick={(e) => handleDeleteIndustry(e, id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <button className="add-industry-btn plush-tiny tap" onClick={() => setModalMode('add')}>
              <Plus size={16} /> Добавить отрасль
            </button>
          </div>
        </article>

        <article className="streak-card plush tap" onClick={() => navigate('/results-page')}>
          <div className="streak-info">
            <span className="streak-emoji">🔥</span>
            <div>
              <h3>{progress.streak} дней подряд</h3>
              <p>Ваш прогресс →</p>
            </div>
          </div>
        </article>

        <div className="profile-actions">
          <button className="btn-plush reset-btn" onClick={handleReset}>
            <RefreshCw size={18} /> Сбросить прогресс
          </button>
          <button className="btn-plush logout-btn" onClick={handleLogout}>
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </div>

      <MiniOnboardingModal
        isOpen={!!modalMode}
        onClose={() => setModalMode(null)}
        onComplete={handleModalComplete}
      />
    </section>
  );
}

export function CommTrainerExperience() {
  const [progress, setProgressState] = useState(loadProgress);
  const [lang, setLang] = useInterfaceLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const t = getText(lang);

  const isHomePage = location.pathname === '/home' || location.pathname === '/';

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  function setProgress(updater) {
    setProgressState((current) => (typeof updater === 'function' ? updater(current) : { ...current, ...updater }));
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {}

    try {
      window.localStorage.removeItem(MOCK_SESSION_KEY);
    } catch {}

    navigate('/signin', { replace: true });
  }

  return (
    <div className="trainer-app paper dots-bg">
      <BackgroundMusic />
      <TrainerFloatingDecor />
      <div className="bg-shapes" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      {isHomePage && (
        <TrainerToolbar progress={progress} lang={lang} setLang={setLang} t={t} onLogout={handleLogout} />
      )}
      <main className="trainer-main">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage progress={progress} setProgress={setProgress} t={t} />} />
          <Route path="/plan" element={<PlanPage progress={progress} />} />
          <Route path="/scenario/:id" element={<ScenarioPage progress={progress} />} />
          <Route path="/results/:id" element={<ResultsPage progress={progress} />} />
          <Route path="/library" element={<LibraryPage progress={progress} setProgress={setProgress} t={t} />} />
          <Route path="/company" element={<CompanyAssignmentsPage progress={progress} />} />
          <Route path="/results-page" element={<ProgressPage progress={progress} />} />
          <Route path="/practice" element={<PracticePage progress={progress} setProgress={setProgress} t={t} />} />
          <Route path="/profile" element={<ProfilePage progress={progress} setProgress={setProgress} />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function TrainerApp() {
  return (
    <BrowserRouter>
      <CommTrainerExperience />
    </BrowserRouter>
  );
}

export default TrainerApp;
