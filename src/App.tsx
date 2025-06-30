import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Eye, EyeOff, RefreshCw, MapPin, Crown, RotateCcw } from 'lucide-react';

interface Rule {
  id: number;
  description: string;
  validator: (password: string) => boolean;
  tip?: string;
  requiresLiveData?: boolean;
  showImage?: boolean;
  showMap?: boolean;
  showChess?: boolean;
  showWordle?: boolean;
  showWordrow?: boolean;
  validationFeedback?: (password: string) => string | null;
}

interface LiveData {
  dayOfYear: number;
  dayOfWeek: number;
  zodiacSymbol: string;
  moonPhase: string;
  temperature: number;
  wordleWord: string;
  mathProblem: {
    expression: string;
    answer: number;
  };
  chessMove: string;
  chessPosition: { [key: number]: string };
  countryCode: string;
  countryName: string;
  streetViewUrl: string;
}

interface WordleState {
  guesses: string[];
  currentGuess: string;
  gameWon: boolean;
  gameOver: boolean;
  maxGuesses: number;
}

function getCurrentTimeGMT2() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt2 = new Date(utc + (2 * 60 * 60 * 1000));
  const hours = gmt2.getHours().toString().padStart(2, '0');
  const minutes = gmt2.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Controleer of een woord geldig is via woordenlijst.org
async function checkDutchWord(word: string): Promise<boolean> {
  try {
    const response = await fetch(`https://woordenlijst.org/api/search/?q=${word.toLowerCase()}`);
    const data = await response.json();
    return Array.isArray(data) && data.some((entry: any) => entry.woord && entry.woord.toLowerCase() === word.toLowerCase());
  } catch {
    return false;
  }
}

function App() {
  const [password, setPassword] = useState('');
  const [completedRules, setCompletedRules] = useState<Set<number>>(new Set());
  const [maxVisibleRule, setMaxVisibleRule] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [gameComplete, setGameComplete] = useState(false);
  const [validationFeedback, setValidationFeedback] = useState<{[key: number]: string}>({});
  const [wordleState, setWordleState] = useState<WordleState>({
    guesses: [],
    currentGuess: '',
    gameWon: false,
    gameOver: false,
    maxGuesses: 6
  });
  const [wordleError, setWordleError] = useState<string>('');
  const [wordrowCompleted, setWordrowCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gebruik een kleine fallback-woordenlijst voor het genereren van het Wordle-woord
  const validDutchWords = [
    'HUIS', 'BOOM', 'WATER', 'LICHT', 'GROEN', 'ZWART', 'ROOD', 'BLAUW', 'GEEL', 'GROOT',
    'KLEIN', 'MOOI', 'LIEF', 'GOED', 'SLECHT', 'NIEUW', 'OUD', 'WARM', 'KOUD', 'HARD',
    'ZACHT', 'SNEL', 'TRAAG', 'HOOG', 'LAAG', 'BREED', 'SMAL', 'LANG', 'KORT', 'DICHT',
    'OPEN', 'LEEG', 'VOL', 'STIL', 'LUID', 'ZOET', 'ZUUR', 'ZOUT', 'BITTER', 'SCHERP',
    'BOT', 'GLAD', 'ROUW', 'DROOG', 'NAT', 'SCHOON', 'VUIL', 'RIJK', 'ARM', 'DUUR'
  ];

  // Function to fetch live weather data for Dongen
  const fetchWeatherData = async (): Promise<number> => {
    try {
      const endpoints = [
        'https://weerlive.nl/api/json-data-10min.php?key=demo&locatie=Dongen,Noord-Brabant',
        'https://weerlive.nl/api/json-data-10min.php?key=demo&locatie=Dongen',
        'https://weerlive.nl/api/json-data-10min.php?key=demo&locatie=5104'
      ];
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          const data = await response.json();
          if (data && data.liveweer && data.liveweer.length > 0) {
            const weatherInfo = data.liveweer[0];
            if (weatherInfo.temp && !isNaN(parseFloat(weatherInfo.temp))) {
              const temp = parseFloat(weatherInfo.temp);
              return Math.floor(temp);
            }
          }
        } catch {
          continue;
        }
      }
      return 20;
    } catch {
      return 20;
    }
  };

  // Generate live data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

        const zodiacSigns = [
          { start: [12, 22], end: [1, 19], symbol: '♑' },
          { start: [1, 20], end: [2, 18], symbol: '♒' },
          { start: [2, 19], end: [3, 20], symbol: '♓' },
          { start: [3, 21], end: [4, 19], symbol: '♈' },
          { start: [4, 20], end: [5, 20], symbol: '♉' },
          { start: [5, 21], end: [6, 20], symbol: '♊' },
          { start: [6, 21], end: [7, 22], symbol: '♋' },
          { start: [7, 23], end: [8, 22], symbol: '♌' },
          { start: [8, 23], end: [9, 22], symbol: '♍' },
          { start: [9, 23], end: [10, 22], symbol: '♎' },
          { start: [10, 23], end: [11, 21], symbol: '♏' },
          { start: [11, 22], end: [12, 21], symbol: '♐' }
        ];
        const month = now.getMonth() + 1;
        const day = now.getDate();
        let zodiacSymbol = '♈';
        for (const sign of zodiacSigns) {
          const [startMonth, startDay] = sign.start;
          const [endMonth, endDay] = sign.end;
          if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
            zodiacSymbol = sign.symbol;
            break;
          }
        }
        const knownNewMoon = new Date('2024-01-11');
        const daysSinceKnownNewMoon = Math.floor((now.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24));
        const lunarCycle = 29.53;
        const currentCycleDay = daysSinceKnownNewMoon % lunarCycle;
        let moonPhase = '🌑';
        if (currentCycleDay < 3.7) moonPhase = '🌑';
        else if (currentCycleDay < 7.4) moonPhase = '🌒';
        else if (currentCycleDay < 11.1) moonPhase = '🌓';
        else if (currentCycleDay < 14.8) moonPhase = '🌔';
        else if (currentCycleDay < 18.5) moonPhase = '🌕';
        else if (currentCycleDay < 22.2) moonPhase = '🌖';
        else if (currentCycleDay < 25.9) moonPhase = '🌗';
        else moonPhase = '🌘';

        const temperature = await fetchWeatherData();
        const fiveLetterWords = validDutchWords.filter(word => word.length === 5);
        const wordleWord = fiveLetterWords[Math.floor(Math.random() * fiveLetterWords.length)];
        const problems = [
          { expression: '(15 × 2) - (20 + 6)', answer: 4 },
          { expression: '√36 - 2', answer: 4 },
          { expression: '(3² × 2) - 14', answer: 4 },
          { expression: '(48 ÷ 12) + 0', answer: 4 },
          { expression: '(7 × 3) - 17', answer: 4 },
          { expression: '(8 ÷ 2) × 1', answer: 4 },
          { expression: '(5 + 3) ÷ 2', answer: 4 }
        ];
        const mathProblem = problems[Math.floor(Math.random() * problems.length)];
        const chessMove = 'Qb5+';
        const chessPosition = {};
        const locations = [
          { code: 'NL', name: 'nederland', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674270!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d52.3676!2d4.9041!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'DE', name: 'duitsland', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674271!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d52.5200!2d13.4050!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'FR', name: 'frankrijk', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674272!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d48.8566!2d2.3522!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'BE', name: 'belgië', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674270!6m8!1m7!1sPObmoWuv4YsRK7s8AA3b0w!2m2!1d50.84772347040428!2d4.357206757549814!3f144.22676!4f0!5f0.4820865974627469!6i1' },
          { code: 'IT', name: 'italië', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674273!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d41.9028!2d12.4964!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'ES', name: 'spanje', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674274!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d40.4168!2d-3.7038!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'PT', name: 'portugal', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674275!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d38.7223!2d-9.1393!3f0!4f0!5f0.4820865974627469!6i1' }
        ];
        const location = locations[Math.floor(Math.random() * locations.length)];
        setLiveData({
          dayOfYear,
          dayOfWeek,
          zodiacSymbol,
          moonPhase,
          temperature,
          wordleWord,
          mathProblem,
          chessMove,
          chessPosition,
          countryCode: location.code,
          countryName: location.name,
          streetViewUrl: location.streetViewUrl
        });
        setWordleState({
          guesses: [],
          currentGuess: '',
          gameWon: false,
          gameOver: false,
          maxGuesses: 6
        });
      } catch {
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  // Wordle game functions
  const handleWordleGuess = async (guess: string) => {
    if (!liveData || wordleState.gameOver || guess.length !== 5) return;
    const guessUpper = guess.toUpperCase();
    // Controleer via woordenlijst.org
    const isValid = await checkDutchWord(guessUpper);
    if (!isValid) {
      setWordleError('Dit is geen geldig Nederlands woord volgens woordenlijst.org');
      return;
    }
    setWordleError('');
    const newGuesses = [...wordleState.guesses, guessUpper];
    const gameWon = guessUpper === liveData.wordleWord.toUpperCase();
    const gameOver = gameWon || newGuesses.length >= wordleState.maxGuesses;
    setWordleState({
      ...wordleState,
      guesses: newGuesses,
      currentGuess: '',
      gameWon,
      gameOver
    });
  };

  const resetWordleGame = () => {
    setWordleState({
      guesses: [],
      currentGuess: '',
      gameWon: false,
      gameOver: false,
      maxGuesses: 6
    });
    setWordleError('');
  };

  const getLetterStatus = (letter: string, position: number, guess: string) => {
    if (!liveData) return 'bg-gray-300';
    const targetWord = liveData.wordleWord.toUpperCase();
    const guessUpper = guess.toUpperCase();
    if (guessUpper[position] === targetWord[position]) {
      return 'bg-green-500 text-white';
    }
    if (targetWord.includes(guessUpper[position])) {
      const letterCount = targetWord.split('').filter(l => l === guessUpper[position]).length;
      let correctlyPlaced = 0;
      for (let i = 0; i < guessUpper.length; i++) {
        if (guessUpper[i] === guessUpper[position] && targetWord[i] === guessUpper[i]) {
          correctlyPlaced++;
        }
      }
      let appearedBefore = 0;
      for (let i = 0; i < position; i++) {
        if (guessUpper[i] === guessUpper[position] && targetWord[i] !== guessUpper[i]) {
          appearedBefore++;
        }
      }
      if (correctlyPlaced + appearedBefore < letterCount) {
        return 'bg-yellow-500 text-white';
      }
    }
    return 'bg-gray-400 text-white';
  };

  // Function to highlight Roman numerals in password - FIXED POSITIONING
  const highlightRomanNumerals = (pwd: string) => {
    if (!pwd) return pwd;
    const rule14Visible = maxVisibleRule >= 14;
    const rule14Completed = completedRules.has(14);
    if (!rule14Visible || rule14Completed) return pwd;
    
    // Only match uppercase Roman numerals
    const romanPattern = /[IVXLCDM]+/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = romanPattern.exec(pwd)) !== null) {
      if (match.index > lastIndex) {
        parts.push(pwd.slice(lastIndex, match.index));
      }
      const romanText = match[0];
      let value = 0;
      const romanValues = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
      for (let i = 0; i < romanText.length; i++) {
        const current = romanValues[romanText[i] as keyof typeof romanValues];
        const next = romanValues[romanText[i + 1] as keyof typeof romanValues];
        if (next && current < next) {
          value += next - current;
          i++;
        } else {
          value += current;
        }
      }
      parts.push(
        <span key={match.index} className="relative">
          <span className="absolute inset-0 bg-yellow-200 bg-opacity-30 rounded"></span>
          <span className="relative" title={`Waarde: ${value}`}>
            {romanText}
          </span>
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < pwd.length) {
      parts.push(pwd.slice(lastIndex));
    }
    return parts.length > 1 ? parts : pwd;
  };

  // Listen for Wordrow completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === 'https://puzzleme.amuselabs.com' && event.data.type === 'puzzleComplete') {
        setWordrowCompleted(true);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- REGELS ---
  const rules: Rule[] = [
    {
      id: 1,
      description: 'Je wachtwoord moet minimaal 8 tekens lang zijn',
      validator: (pwd) => pwd.length >= 8
    },
    {
      id: 2,
      description: 'Je wachtwoord moet een hoofdletter bevatten',
      validator: (pwd) => /[A-Z]/.test(pwd)
    },
    {
      id: 3,
      description: 'Je wachtwoord moet een speciaal teken bevatten',
      validator: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      tip: 'Bijvoorbeeld !@#$'
    },
    {
      id: 4,
      description: 'Je wachtwoord mag geen spaties bevatten',
      validator: (pwd) => !/\s/.test(pwd)
    },
    {
      id: 5,
      description: 'Je wachtwoord moet een cijfer bevatten',
      validator: (pwd) => /\d/.test(pwd)
    },
    {
      id: 6,
      description: 'Je wachtwoord moet een maand bevatten',
      validator: (pwd) => {
        const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
          'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
        return months.some(month => pwd.toLowerCase().includes(month));
      },
      tip: 'Bijvoorbeeld maart'
    },
    {
      id: 7,
      description: 'De cijfers in je wachtwoord moeten optellen tot 50',
      validator: (pwd) => {
        const digits = pwd.match(/\d/g);
        if (!digits) return false;
        const sum = digits.reduce((acc, digit) => acc + parseInt(digit), 0);
        return sum === 50;
      }
    },
    {
      id: 8,
      description: 'Voeg het aantal dagen sinds 1 januari toe',
      validator: (pwd) => liveData ? pwd.includes(liveData.dayOfYear.toString()) : false,
      requiresLiveData: true,
      tip: 'Tel de dagen vanaf nieuwjaarsdag tot vandaag'
    },
    {
      id: 9,
      description: 'Voeg het getal van de dag van de week toe (maandag = 1, zondag = 7)',
      validator: (pwd) => liveData ? pwd.includes(liveData.dayOfWeek.toString()) : false,
      requiresLiveData: true
    },
    {
      id: 10,
      description: 'Je wachtwoord mag niet beginnen of eindigen met een cijfer',
      validator: (pwd) => pwd.length > 0 && !/^\d/.test(pwd) && !/\d$/.test(pwd)
    },
    {
      id: 11,
      description: 'Voeg het symbool van het sterrenbeeld van vandaag toe',
      validator: (pwd) => liveData ? pwd.includes(liveData.zodiacSymbol) : false,
      requiresLiveData: true,
      tip: 'Bijvoorbeeld ♑ voor Steenbok of ♒ voor Waterman'
    },
    {
      id: 12,
      description: 'Voeg het huidige maanfase-icoon toe',
      validator: (pwd) => liveData ? pwd.includes(liveData.moonPhase) : false,
      requiresLiveData: true,
      tip: 'Bijvoorbeeld 🌕 voor volle maan - check kalender-365.nl/maan/actuele-maanstand.html'
    },
    {
      id: 13,
      description: 'Je wachtwoord moet een tweesymbool van het periodiek systeem bevatten',
      validator: (pwd) => {
        const elements = ['He', 'Li', 'Be', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'Ar', 'Ca', 'Sc', 'Ti', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'];
        return elements.some(element => pwd.includes(element));
      },
      tip: 'Zoals "Fe" of "Na"'
    },
    {
      id: 14,
      description: 'Voeg romeinse cijfers toe die samen de waarde van 35 hebben',
      validator: (pwd) => {
        // Only match uppercase Roman numerals
        const romanMatches = pwd.match(/[IVXLCDM]+/g);
        if (!romanMatches) return false;
        const romanNumerals = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
        for (const match of romanMatches) {
          let value = 0;
          for (let i = 0; i < match.length; i++) {
            const current = romanNumerals[match[i] as keyof typeof romanNumerals];
            const next = romanNumerals[match[i + 1] as keyof typeof romanNumerals];
            if (next && current < next) {
              value += next - current;
              i++;
            } else {
              value += current;
            }
          }
          if (value === 35) return true;
        }
        return false;
      },
      tip: 'denk aan: I voor 1, V voor 5 of M voor 1000'
    },
    {
      id: 15,
      description: 'Je wachtwoord moet de huidige tijd bevatten volgens Tijdzone (GMT+2)',
      validator: (pwd) => {
        const time = getCurrentTimeGMT2();
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const gmt2 = new Date(utc + (2 * 60 * 60 * 1000));
        const nextMinute = new Date(gmt2.getTime() + 60000);
        const nextTime = `${nextMinute.getHours().toString().padStart(2, '0')}:${nextMinute.getMinutes().toString().padStart(2, '0')}`;
        return pwd.includes(time) || pwd.includes(nextTime);
      },
      tip: 'De notatie moet zijn als xx:xx (bijvoorbeeld 08:23).'
    },
    {
      id: 16,
      description: 'Je wachtwoord moet het woord "Geest" bevatten',
      validator: (pwd) => pwd.toLowerCase().includes('geest'),
      requiresLiveData: false,
      tip: 'Voeg het woord "Geest" toe aan je wachtwoord (hoofdletters maken niet uit).'
    },
    {
      id: 17,
      description: 'Benoem het thema van groep 7/8 met de Zomerspelen in 2001',
      validator: (pwd) => pwd.toLowerCase().includes('tomorrowland'),
      tip: 'Dit was het thema van jullie zomerspelen'
    },
    {
      id: 18,
      description: 'Je wachtwoord moet een kleur als woord bevatten',
      validator: (pwd) => {
        const colors = ['rood', 'blauw', 'groen', 'geel', 'oranje', 'paars', 'roze', 'zwart', 'wit', 'bruin', 'grijs'];
        return colors.some(color => pwd.toLowerCase().includes(color));
      },
      tip: 'Bijvoorbeeld blauw'
    },
    {
      id: 19,
      description: 'Benoem de hoeveelste editie dit jaar (2025) is van de Zomerspelen',
      validator: (pwd) => pwd.includes('64'),
      tip: 'Als getal, dus 20 en niet 20e'
    },
    {
      id: 20,
      description: 'Benoem in je wachtwoord het 25e woord uit het refrein van ons 7/8 zomerspelen lied van dit jaar?',
      validator: (pwd) => pwd.toLowerCase().includes('verkeerde'),
      tip: 'Vanaf: "De geestwereld…"'
    },
    {
      id: 21,
      description: 'Benoem in welk land je bent op basis van de onderstaande streetview',
      validator: (pwd) => liveData ? pwd.toLowerCase().includes(liveData.countryName.toLowerCase()) : false,
      requiresLiveData: true,
      showMap: true,
      tip: 'Kijk goed naar de omgeving, verkeersborden en architectuur',
      validationFeedback: (pwd) => {
        if (!liveData) return null;
        const countries = ['nederland', 'duitsland', 'frankrijk', 'belgië', 'italië', 'spanje', 'portugal'];
        const foundCountries = countries.filter(country => pwd.toLowerCase().includes(country));
        if (foundCountries.length > 0 && !foundCountries.includes(liveData.countryName.toLowerCase())) {
          return `${foundCountries[0]} (Verkeerd land)`;
        }
        return null;
      }
    },
    {
      id: 22,
      description: 'Je wachtwoord moet de beste zet in algebraïsche schaaknotatie bevatten',
      validator: (pwd) => liveData ? pwd.includes(liveData.chessMove) : false,
      requiresLiveData: true,
      showChess: true,
      tip: 'In algebraïsche schaaknotatie - zie nextchessmove.com voor hulp',
      validationFeedback: (pwd) => {
        if (!liveData) return null;
        const chessNotationPattern = /[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][\+#]?/g;
        const chessMatches = pwd.match(chessNotationPattern);
        if (chessMatches && chessMatches.length > 0) {
          const foundMoves = chessMatches.filter(move => move !== liveData.chessMove);
          if (foundMoves.length > 0) {
            return `${foundMoves[0]} (Illegale zet)`;
          }
        }
        return null;
      }
    },
    {
      id: 23,
      description: 'Je wachtwoord moet het antwoord van deze rekensom bevatten',
      validator: (pwd) => liveData ? pwd.includes(liveData.mathProblem.answer.toString()) : false,
      requiresLiveData: true,
      tip: 'Let op de rekenregels'
    },
    {
      id: 24,
      description: 'Je wachtwoord moet evenveel hoofdletters als cijfers hebben',
      validator: (pwd) => {
        const capitals = (pwd.match(/[A-Z]/g) || []).length;
        const digits = (pwd.match(/\d/g) || []).length;
        return capitals === digits && capitals > 0;
      }
    },
    {
      id: 25,
      description: 'Je wachtwoord moet een lengte hebben die een priemgetal is',
      validator: (pwd) => {
        const length = pwd.length;
        if (length < 2) return false;
        for (let i = 2; i <= Math.sqrt(length); i++) {
          if (length % i === 0) return false;
        }
        return true;
      },
      tip: 'Dit gaat over het totaal aantal karakters'
    }
  ];

  useEffect(() => {
    const newCompletedRules = new Set<number>();
    const newValidationFeedback: {[key: number]: string} = {};
    rules.forEach((rule) => {
      if (!rule.requiresLiveData || liveData) {
        if (rule.validator(password)) {
          newCompletedRules.add(rule.id);
        } else if (rule.validationFeedback) {
          const feedback = rule.validationFeedback(password);
          if (feedback) {
            newValidationFeedback[rule.id] = feedback;
          }
        }
      }
    });
    setCompletedRules(newCompletedRules);
    setValidationFeedback(newValidationFeedback);
    if (password.length > 0) {
      let newMaxVisible = 1;
      for (let i = 1; i <= rules.length; i++) {
        if (newCompletedRules.has(i)) {
          newMaxVisible = i + 1;
        } else {
          break;
        }
      }
      newMaxVisible = Math.min(newMaxVisible, rules.length);
      setMaxVisibleRule(prev => Math.max(prev, newMaxVisible));
    } else {
      setMaxVisibleRule(0);
    }
    if (newCompletedRules.size === rules.length) {
      setGameComplete(true);
    }
  }, [password, liveData, wordleState.gameWon, wordrowCompleted]);

  const handleRefreshData = async () => {
    setIsLoadingData(true);
    setTimeout(async () => {
      if (liveData) {
        const temperature = await fetchWeatherData();
        const locations = [
          { code: 'NL', name: 'nederland', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674270!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d52.3676!2d4.9041!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'DE', name: 'duitsland', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674271!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d52.5200!2d13.4050!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'FR', name: 'frankrijk', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674272!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d48.8566!2d2.3522!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'BE', name: 'belgië', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674270!6m8!1m7!1sPObmoWuv4YsRK7s8AA3b0w!2m2!1d50.84772347040428!2d4.357206757549814!3f144.22676!4f0!5f0.4820865974627469!6i1' },
          { code: 'IT', name: 'italië', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674273!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d41.9028!2d12.4964!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'ES', name: 'spanje', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674274!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d40.4168!2d-3.7038!3f0!4f0!5f0.4820865974627469!6i1' },
          { code: 'PT', name: 'portugal', streetViewUrl: 'https://www.google.com/maps/embed?pb=!4v1750161674275!6m8!1m7!1sCAoSLEFGMVFpcE5fVjBfSGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVqVGVq!2m2!1d38.7223!2d-9.1393!3f0!4f0!5f0.4820865974627469!6i1' }
        ];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const fiveLetterWords = validDutchWords.filter(word => word.length === 5);
        const wordleWord = fiveLetterWords[Math.floor(Math.random() * fiveLetterWords.length)];
        const problems = [
          { expression: '(15 × 2) - (20 + 6)', answer: 4 },
          { expression: '√36 - 2', answer: 4 },
          { expression: '(3² × 2) - 14', answer: 4 },
          { expression: '(48 ÷ 12) + 0', answer: 4 },
          { expression: '(7 × 3) - 17', answer: 4 },
          { expression: '(8 ÷ 2) × 1', answer: 4 },
          { expression: '(5 + 3) ÷ 2', answer: 4 }
        ];
        const mathProblem = problems[Math.floor(Math.random() * problems.length)];
        setLiveData({
          ...liveData,
          countryCode: location.code,
          countryName: location.name,
          streetViewUrl: location.streetViewUrl,
          mathProblem,
          temperature,
          wordleWord
        });
        setWordleState({
          guesses: [],
          currentGuess: '',
          gameWon: false,
          gameOver: false,
          maxGuesses: 6
        });
        setWordleError('');
      }
      setIsLoadingData(false);
    }, 1000);
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg text-gray-700">Live gegevens ophalen...</p>
          <p className="text-sm text-gray-500 mt-2">Weerdata voor Dongen wordt opgehaald...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Het Stapweekend Wachtwoord Spel
          </h1>
          <p className="text-gray-600 text-lg">
            Volg alle regels om het ultieme wachtwoord te maken! 🔐
          </p>
        </header>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <label htmlFor="password" className="text-lg font-semibold text-gray-800">
              Je wachtwoord:
            </label>
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button
              onClick={handleRefreshData}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="Ververs live gegevens"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 text-lg border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors font-mono"
              placeholder="Begin met typen..."
              autoComplete="off"
            />
            {showPassword && maxVisibleRule >= 14 && !completedRules.has(14) && password && (
              <div className="absolute inset-0 p-4 text-lg font-mono pointer-events-none flex items-center overflow-hidden">
                <div className="whitespace-nowrap">
                  {highlightRomanNumerals(password)}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Lengte: {password.length} karakters
            </span>
            <span className="text-sm text-gray-500">
              Voltooide regels: {completedRules.size}/{maxVisibleRule}
            </span>
          </div>
        </div>

        {maxVisibleRule > 0 && (
          <div className="space-y-4">
            {rules.slice(0, maxVisibleRule).map((rule) => {
              const isCompleted = completedRules.has(rule.id);
              const isWaitingForData = rule.requiresLiveData && !liveData;
              const feedback = validationFeedback[rule.id];
              return (
                <div
                  key={rule.id}
                  className={`bg-white rounded-lg shadow-md p-6 transition-all duration-300 ${
                    isCompleted ? 'bg-green-50 border-l-4 border-green-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      isCompleted ? 'bg-green-500' : isWaitingForData ? 'bg-gray-400' : 'bg-red-500'
                    }`}>
                      {isCompleted ? <Check className="w-5 h-5" /> : isWaitingForData ? '...' : rule.id}
                    </div>
                    <div className="flex-1">
                      <p className={`text-lg ${isCompleted ? 'text-green-800' : 'text-gray-800'}`}>
                        <span className="font-semibold">Regel {rule.id}:</span> {rule.description}
                      </p>
                      {rule.tip && (
                        <p className="text-sm text-gray-500 mt-2 italic">
                          💡 Tip: {rule.tip}
                        </p>
                      )}
                      {feedback && (
                        <p className="text-sm text-orange-600 mt-2 font-semibold">
                          ⚠️ {feedback}
                        </p>
                      )}
                      {rule.showWordrow && (
                        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="font-semibold text-lg">🎯 Wordrow Puzzel</span>
                            {wordrowCompleted && (
                              <span className="text-green-600 font-bold">✅ Voltooid!</span>
                            )}
                          </div>
                          <div className="rounded-lg overflow-hidden border-2 border-gray-300 shadow-lg">
                            <iframe 
                              height="700px" 
                              width="100%" 
                              allow="web-share; fullscreen" 
                              style={{border: 'none', width: '100%', position: 'static', display: 'block', margin: 0}} 
                              src="https://puzzleme.amuselabs.com/pmm/wordrow?id=abc1d1ef&set=7a4e8efe7a3cd99c74fba82206174ed7f74167bfd60132bc0b40a7094f116570&embed=1" 
                              aria-label="Puzzle Me Game"
                              title="Wordrow Puzzle"
                            />
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            Voltooi de Wordrow-puzzel om deze regel te behalen.
                          </p>
                        </div>
                      )}
                      {rule.showWordle && liveData && (
                        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="font-semibold text-lg">🎯 Wordle Minigame</span>
                            {wordleState.gameWon && (
                              <span className="text-green-600 font-bold">✅ Opgelost!</span>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-2 mb-4 max-w-xs">
                            {Array.from({ length: wordleState.maxGuesses }, (_, rowIndex) => (
                              <React.Fragment key={rowIndex}>
                                {Array.from({ length: 5 }, (_, colIndex) => {
                                  const guess = wordleState.guesses[rowIndex];
                                  const letter = guess ? guess[colIndex] : '';
                                  const isCurrentRow = rowIndex === wordleState.guesses.length && !wordleState.gameOver;
                                  const currentLetter = isCurrentRow ? wordleState.currentGuess[colIndex] || '' : '';
                                  return (
                                    <div
                                      key={colIndex}
                                      className={`w-12 h-12 border-2 border-gray-300 rounded flex items-center justify-center text-lg font-bold ${
                                        guess ? getLetterStatus(letter, colIndex, guess) : 'bg-white'
                                      }`}
                                    >
                                      {letter || currentLetter}
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </div>
                          {wordleError && (
                            <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                              {wordleError}
                            </div>
                          )}
                          {!wordleState.gameOver && (
                            <div className="flex gap-2 mb-2">
                              <input
                                type="text"
                                value={wordleState.currentGuess}
                                onChange={(e) => {
                                  const value = e.target.value.toUpperCase().slice(0, 5);
                                  setWordleState({ ...wordleState, currentGuess: value });
                                  setWordleError('');
                                }}
                                onKeyPress={async (e) => {
                                  if (e.key === 'Enter' && wordleState.currentGuess.length === 5) {
                                    await handleWordleGuess(wordleState.currentGuess);
                                  }
                                }}
                                className="px-3 py-2 border border-gray-300 rounded text-center font-mono uppercase"
                                placeholder="5 letters"
                                maxLength={5}
                              />
                              <button
                                onClick={async () => await handleWordleGuess(wordleState.currentGuess)}
                                disabled={wordleState.currentGuess.length !== 5}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                              >
                                Raad
                              </button>
                            </div>
                          )}
                          {wordleState.gameOver && (
                            <button
                              onClick={resetWordleGame}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Opnieuw spelen
                            </button>
                          )}
                          <p className="text-sm text-gray-600 mt-2">
                            Raad het 5-letterige Nederlandse woord. Groen = juiste letter op juiste plek,
                            geel = juiste letter op verkeerde plek, grijs = letter zit niet in het woord.
                            Alleen geldige Nederlandse woorden worden geaccepteerd.
                          </p>
                        </div>
                      )}
                      {rule.showMap && liveData && (
                        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold">GeoGuessr Challenge - Street View</span>
                          </div>
                          <div className="rounded-lg overflow-hidden border-2 border-gray-300 shadow-lg relative">
                            <iframe
                              src={liveData.streetViewUrl}
                              width="100%"
                              height="400"
                              style={{ border: 0 }}
                              allowFullScreen
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="Street View Challenge"
                            />
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            Raad in welk land deze Street View is genomen en voeg de landnaam toe aan je wachtwoord.
                            Kijk goed naar verkeersborden, architectuur, kentekens en andere details!
                          </p>
                        </div>
                      )}
                      {rule.showChess && liveData && (
                        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Crown className="w-5 h-5 text-purple-600" />
                            <span className="font-semibold">Schaakpuzzel</span>
                          </div>
                          <div className="flex justify-center">
                            <img
                              src="/2025-06-23 14_03_01-Next Chess Move_ The strongest online chess calculator.png"
                              alt="Schaakbord puzzel"
                              className="max-w-full h-auto rounded-lg border-2 border-gray-300 shadow-lg"
                              style={{ maxHeight: '400px' }}
                            />
                          </div>
                        </div>
                      )}
                      {rule.id === 23 && liveData && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                          <p className="text-blue-800 font-mono text-lg">
                            {liveData.mathProblem.expression} = ?
                          </p>
                        </div>
                      )}
                      {isWaitingForData && (
                        <p className="text-sm text-amber-600 mt-2">
                          ⏳ Wachten op live gegevens...
                        </p>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full ${
                      isCompleted ? 'bg-green-500' : isWaitingForData ? 'bg-gray-300' : 'bg-red-500'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-white m-1" />
                      ) : (
                        <X className="w-4 h-4 text-white m-1" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {gameComplete && (
          <div className="mt-8 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-4xl font-bold mb-4">🎉 GEFELICITEERD!</h2>
            <p className="text-2xl mb-6 font-semibold">
              Ga nu naar Uitkijktoren de Boersberg!
            </p>
            <div className="bg-white text-gray-800 rounded-lg p-6">
              <p className="text-lg font-semibold mb-2">
                🏰 Je hebt alle regels gevolgd!
              </p>
              <p className="text-base">
                De Uitkijktoren de Boersberg in Doorwerth wacht op je bezoek.
                Geniet van het prachtige uitzicht over de Nederrijn, kasteel Doorwerth en de boomtoppen van de omliggende hellingbossen!
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-gray-500">
          <p className="text-sm">
            © Stapweekend commissie 2025
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;