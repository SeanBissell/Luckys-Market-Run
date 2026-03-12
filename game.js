// Lucky's Market Run - Main Game Logic
// A backtesting game where Lucky rides the stock charts

import sounds from './sounds.js';
import effects from './effects.js';
import backgrounds from './backgrounds.js';

// Game State
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

const state = {
    ticker: null,
    timeframe: '1wk',
    period: '5y',
    data: null,
    ema10: [],
    ema20: [],
    visibleStartIndex: 0,
    visibleCandles: isMobileDevice ? 40 : 80,
    verticalScale: isMobileDevice ? 0.1 : 1.0, // More compressed on mobile
    currentCandleIndex: 0,
    isPlaying: false,
    playbackSpeed: 3,
    balance: 100000,
    totalPnL: 0,
    trades: [],
    currentPosition: null,
    luckyX: 0,
    luckyY: 0,
    timeframeStack: [],
    tradeMode: false,
    tradeStep: 'direction',
    pendingTrade: null,
    chartMetrics: null,
    isDraggingStopLoss: false,
    level: 1,
    isLoadingLevel: false,
    // New progression state
    xp: 0,
    xpToNextLevel: 100,
    streak: 0,
    maxStreak: 0,
    achievements: [],
    gameStarted: false,
    errorModalOpen: false,
};

// Achievement definitions
const ACHIEVEMENTS = {
    firstBlood: { name: 'First Blood', desc: 'Complete your first trade', condition: () => state.trades.length >= 1 },
    profitable: { name: 'In the Green', desc: 'Have a positive total P/L', condition: () => state.totalPnL > 0 },
    bigWinner: { name: 'Big Winner', desc: 'Win $5,000+ on a single trade', condition: (trade) => trade && trade.pnl >= 5000 },
    streakMaster: { name: 'On Fire', desc: 'Get a 3-win streak', condition: () => state.streak >= 3 },
    levelUp: { name: 'Level Up', desc: 'Reach level 5', condition: () => state.level >= 5 },
    doubleUp: { name: 'Double Up', desc: 'Reach $200,000 balance', condition: () => state.balance >= 200000 },
    perfectTrade: { name: 'Perfect Exit', desc: 'Exit with 10%+ profit', condition: (trade) => trade && trade.pnlPercent >= 10 },
};

// Timeframe configurations
const TIMEFRAME_CONFIG = {
    '1wk': { period: '5y', label: 'Weekly', drillTo: '1d' },
    '1d': { period: '2y', label: 'Daily', drillTo: '1h', drillFrom: '1wk' },
    '1h': { period: '3mo', label: 'Hourly', drillTo: '15m', drillFrom: '1d' },
    '15m': { period: '1mo', label: '15 Min', drillTo: '5m', drillFrom: '1h' },
    '5m': { period: '5d', label: '5 Min', drillFrom: '15m' },
};

// Preload all timeframes for a symbol in the background
async function preloadAllTimeframes(ticker) {
    console.log(`Preloading all timeframes for ${ticker}...`);
    const timeframes = Object.entries(TIMEFRAME_CONFIG);

    // Load all timeframes in parallel (but don't await - let it happen in background)
    for (const [interval, config] of timeframes) {
        // This will cache the data in CACHE_CONFIG.SYMBOL_DATA via getFromFileCache
        getFromFileCache(ticker, config.period, interval).then(data => {
            if (data) {
                console.log(`Preloaded ${ticker} ${config.label}: ${data.count} candles`);
            }
        }).catch(() => {}); // Ignore errors during preload
    }
}

// Preloaded next stock for instant loading
let preloadedNextStock = null;
let isPreloading = false;

// Preload a random stock in background (for instant next level)
// This is fire-and-forget - never blocks gameplay
function preloadNextRandomStock() {
    // Don't stack multiple preloads
    if (isPreloading) return;
    isPreloading = true;

    // Run entirely in background - no awaits that block
    (async () => {
        try {
            await loadCacheIndexIfNeeded();

            if (!CACHE_CONFIG.CACHED_SYMBOLS?.length) {
                isPreloading = false;
                return;
            }

            // Pick a random symbol that's different from current
            const symbols = CACHE_CONFIG.CACHED_SYMBOLS.filter(s => s !== state.ticker);
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

            console.log(`[Background] Preloading next stock: ${randomSymbol}`);

            // Load the symbol file into cache
            const loaded = await loadSymbolFileIfNeeded(randomSymbol);
            if (loaded) {
                // Try to get weekly data (default timeframe)
                const config = TIMEFRAME_CONFIG['1wk'];
                const data = await getFromFileCache(randomSymbol, config.period, '1wk');

                if (data && data.count > 50) {
                    preloadedNextStock = {
                        symbol: randomSymbol,
                        data: data
                    };
                    console.log(`[Background] Next stock ready: ${randomSymbol} (${data.count} candles)`);
                }
            }
        } catch (e) {
            console.log('[Background] Preload failed:', e.message);
        }
        isPreloading = false;
    })();
}

// DOM Elements
const elements = {};

// Initialize splash screen
function initSplash() {
    const splashScreen = document.getElementById('splash-screen');
    const startBtn = document.getElementById('start-btn');
    const gameContainer = document.getElementById('game-container');

    // Start preloading a random stock immediately while user is on splash screen
    preloadNextRandomStock();

    const startGame = async () => {
        sounds.init();
        sounds.intro();

        // Start background music after user interaction
        setTimeout(() => {
            sounds.startMusic();
        }, 800);

        splashScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        setTimeout(() => {
            splashScreen.style.display = 'none';
            state.gameStarted = true;
            init();
        }, 500);
    };

    startBtn.addEventListener('click', startGame);

    // Also start on spacebar
    document.addEventListener('keydown', (e) => {
        if (!state.gameStarted && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            startGame();
        }
    });
}

// Load random symbol from file
async function loadRandomSymbol() {
    // Check if we have a preloaded stock ready (instant - no loading screen!)
    if (preloadedNextStock) {
        const { symbol, data } = preloadedNextStock;
        preloadedNextStock = null; // Clear it

        console.log(`Using preloaded stock: ${symbol}`);

        state.ticker = symbol;
        elements.tickerInput.value = symbol;
        state.timeframeStack = [];
        state.currentPosition = null;
        exitTradeMode();

        state.data = data;
        state.ema10 = calculateEMA(data.close, 10);
        state.ema20 = calculateEMA(data.close, 20);

        const startPoint = Math.floor(data.count * 0.3) + Math.floor(Math.random() * data.count * 0.3);
        state.currentCandleIndex = Math.min(startPoint, data.count - 50);
        state.visibleStartIndex = Math.max(0, state.currentCandleIndex - state.visibleCandles + 10);
        updateTickerInfo();
        updateUI();
        render();

        elements.chartContainer.focus();
        console.log(`Successfully loaded ${symbol} with ${data.count} candles (preloaded)`);

        // Start preloading the next random stock in background
        preloadNextRandomStock();

        return;
    }

    // No preloaded stock - show loading and fetch normally
    showLoading(true, 'Loading historical data of a random stock, please wait while we load the chart.');

    // Load cache index first
    await loadCacheIndexIfNeeded();

    // Get symbols - prefer cached symbols for instant loading
    let symbols = [];

    // If we have cached symbols, use those (they're guaranteed to load instantly)
    if (CACHE_CONFIG.CACHED_SYMBOLS?.length > 0) {
        symbols = [...CACHE_CONFIG.CACHED_SYMBOLS];
        console.log(`Using ${symbols.length} pre-cached symbols`);
    } else {
        // Fall back to symbols.txt
        try {
            const response = await fetch('symbols.txt');
            if (response.ok) {
                const text = await response.text();
                symbols = text.split('\n').map(s => s.trim()).filter(s => s.length > 0 && s.length <= 5);
            }
        } catch (e) {
            console.log('Could not load symbols file');
        }
    }

    if (symbols.length === 0) {
        // Last resort defaults
        symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
    }

    // Shuffle and try symbols
    const shuffled = [...symbols].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(10, shuffled.length); i++) {
        const symbol = shuffled[i];
        console.log(`Trying to load symbol: ${symbol}`);

        state.ticker = symbol;
        elements.tickerInput.value = symbol;
        state.timeframeStack = [];
        state.currentPosition = null;
        exitTradeMode();

        const config = TIMEFRAME_CONFIG[state.timeframe];
        const data = await fetchStockData(symbol, config.period, state.timeframe, 'Loading historical data of a random stock, please wait while we load the chart.');

        if (data && data.count > 50) { // Need at least 50 candles
            state.data = data;
            state.ema10 = calculateEMA(data.close, 10);
            state.ema20 = calculateEMA(data.close, 20);

            const startPoint = Math.floor(data.count * 0.3) + Math.floor(Math.random() * data.count * 0.3);
            state.currentCandleIndex = Math.min(startPoint, data.count - 50);
            state.visibleStartIndex = Math.max(0, state.currentCandleIndex - state.visibleCandles + 10);
            updateTickerInfo();
            updateUI();
            render();

            elements.chartContainer.focus();
            console.log(`Successfully loaded ${symbol} with ${data.count} candles`);
            showLoading(false);

            // Start preloading the next random stock in background
            preloadNextRandomStock();

            return;
        }
        console.log(`Failed to load ${symbol} (count: ${data?.count || 0}), trying next...`);
    }

    // Fallback to AAPL if nothing else works
    console.log('Could not load any random symbol, falling back to AAPL');
    state.ticker = 'AAPL';
    elements.tickerInput.value = 'AAPL';
    const success = await loadData();
    if (!success) {
        showErrorModal('Failed to connect to stock data. Press R to try again.', 'Connection Error');
    }
    showLoading(false);
}

// Initialize the game
function init() {
    cacheElements();
    setupEventListeners();
    setupCanvas();
    drawEmptyChart();
    updateUI();
    updateXPBar();

    // Initialize effects system
    effects.init(elements.chartContainer);

    // Initialize background system
    backgrounds.init(elements.chartContainer);
    backgrounds.setLevel(state.level);

    // Start sparkles animation
    startSparkles();

    // Initialize mobile touch events
    initMobileTouchEvents();

    // Load a random stock on startup
    loadRandomSymbol();
}

function cacheElements() {
    elements.tickerInput = document.getElementById('ticker-input');
    elements.loadTickerBtn = document.getElementById('load-ticker-btn');
    elements.currentTicker = document.getElementById('current-ticker');
    elements.currentPrice = document.getElementById('current-price');
    elements.priceChange = document.getElementById('price-change');
    elements.timeframeBtns = document.querySelectorAll('.tf-btn');
    elements.balance = document.getElementById('balance');
    elements.totalPnl = document.getElementById('total-pnl');
    elements.winRate = document.getElementById('win-rate');
    elements.level = document.getElementById('level');
    elements.canvas = document.getElementById('chart-canvas');
    elements.ctx = elements.canvas.getContext('2d');
    elements.luckySprite = document.getElementById('lucky-sprite');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.loadingText = document.getElementById('loading-text');
    elements.chartContainer = document.getElementById('chart-container');
    elements.crosshairX = document.getElementById('crosshair-x');
    elements.crosshairY = document.getElementById('crosshair-y');
    elements.priceTooltip = document.getElementById('price-tooltip');
    elements.infoOpen = document.getElementById('info-open');
    elements.infoHigh = document.getElementById('info-high');
    elements.infoLow = document.getElementById('info-low');
    elements.infoClose = document.getElementById('info-close');
    elements.infoVolume = document.getElementById('info-volume');
    elements.currentDate = document.getElementById('current-date');
    elements.candleIndex = document.getElementById('candle-index');
    elements.modal = document.getElementById('trade-modal');
    elements.modalTitle = document.getElementById('modal-title');
    elements.modalBody = document.getElementById('modal-body');
    elements.modalCloseBtn = document.getElementById('modal-close-btn');
    elements.gameHUD = document.getElementById('game-hud');
    elements.tradePanel = document.getElementById('trade-panel');
    elements.positionDisplay = document.getElementById('position-display');
    elements.streakDisplay = document.getElementById('streak-display');
    elements.xpFill = document.getElementById('xp-fill');
    elements.xpText = document.getElementById('xp-text');
    elements.soundToggle = document.getElementById('sound-toggle');
    elements.achievementPopup = document.getElementById('achievement-popup');
    elements.levelModal = document.getElementById('level-modal');
    elements.levelModalTitle = document.getElementById('level-modal-title');
    elements.levelModalBody = document.getElementById('level-modal-body');
    elements.levelModalBtn = document.getElementById('level-modal-btn');
    elements.luckyTrail = document.getElementById('lucky-trail');
    elements.luckySparkles = document.getElementById('lucky-sparkles');
    elements.errorModal = document.getElementById('error-modal');
    elements.errorModalTitle = document.getElementById('error-modal-title');
    elements.errorModalBody = document.getElementById('error-modal-body');
}

function setupEventListeners() {
    // Ticker input
    elements.loadTickerBtn.addEventListener('click', () => {
        sounds.click();
        loadTicker();
    });
    elements.tickerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadTicker();
    });

    // Timeframe buttons
    elements.timeframeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sounds.click();
            changeTimeframe(btn.dataset.tf);
        });
        btn.addEventListener('mouseenter', () => sounds.hover());
    });

    // Modal
    elements.modalCloseBtn.addEventListener('click', () => {
        sounds.click();
        closeModal();
    });

    // Level modal
    if (elements.levelModalBtn) {
        elements.levelModalBtn.addEventListener('click', () => {
            sounds.click();
            closeLevelModal();
        });
    }

    // Error modal - click anywhere to dismiss
    if (elements.errorModal) {
        elements.errorModal.addEventListener('click', () => {
            sounds.click();
            closeErrorModal();
        });
    }

    // Trade panel - stop clicks from bubbling to chart
    elements.tradePanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Sound toggle
    if (elements.soundToggle) {
        elements.soundToggle.addEventListener('click', () => {
            const enabled = sounds.toggleSFX();
            elements.soundToggle.textContent = enabled ? '🔊' : '🔇';
            elements.soundToggle.classList.toggle('muted', !enabled);
        });
    }

    // Music toggle
    const musicToggle = document.getElementById('music-toggle');
    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            const playing = sounds.toggleMusic();
            musicToggle.textContent = playing ? '🎵' : '🎶';
            musicToggle.classList.toggle('muted', !playing);
        });
    }

    // Canvas mouse events
    elements.chartContainer.addEventListener('mousemove', handleMouseMove);
    elements.chartContainer.addEventListener('mouseleave', handleMouseLeave);
    elements.chartContainer.addEventListener('click', handleChartClick);
    elements.chartContainer.addEventListener('mousedown', handleMouseDown);
    elements.chartContainer.addEventListener('mouseup', handleMouseUp);

    // Make chart container focusable
    elements.chartContainer.setAttribute('tabindex', '0');
    elements.chartContainer.style.outline = 'none';
    elements.chartContainer.style.cursor = 'crosshair';

    // Window resize
    window.addEventListener('resize', () => {
        setupCanvas();
        effects.resize();
        render();
    });

    // Main keyboard controls - listen on document but check if we should respond
    document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
    if (!state.gameStarted) return;
    if (e.target.tagName === 'INPUT') return;

    // If error modal is open, spacebar/enter closes it
    if (state.errorModalOpen) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            sounds.click();
            closeErrorModal();
        }
        return;
    }

    // If modal is open, spacebar/enter closes it
    if (!elements.modal.classList.contains('hidden')) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            sounds.click();
            closeModal();
        }
        return;
    }

    // Level modal
    if (elements.levelModal && !elements.levelModal.classList.contains('hidden')) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            sounds.click();
            closeLevelModal();
        }
        return;
    }

    if (state.tradeMode) {
        handleTradeModeKey(e);
        return;
    }

    switch (e.key) {
        case ' ':
            e.preventDefault();
            if (state.currentPosition) {
                advanceCandle();
            } else if (state.data) {
                sounds.click();
                enterTradeMode();
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            advanceCandle();
            break;
        case 'ArrowUp':
            e.preventDefault();
            drillUp();
            break;
        case 'ArrowDown':
            e.preventDefault();
            drillDown();
            break;
        case 'r':
        case 'R':
            randomJump();
            break;
        case 'c':
        case 'C':
            if (state.currentPosition) {
                manualClosePosition();
            }
            break;
        case 'Escape':
            exitTradeMode();
            break;
    }
}

function handleTradeModeKey(e) {
    const key = e.key;

    if (key === 'Escape') {
        e.preventDefault();
        sounds.click();
        if (state.tradeStep === 'direction') {
            exitTradeMode();
        } else if (state.tradeStep === 'risk') {
            state.tradeStep = 'direction';
            updateTradePanel();
        } else if (state.tradeStep === 'stoploss') {
            state.tradeStep = 'risk';
            updateTradePanel();
        } else if (state.tradeStep === 'confirm') {
            state.tradeStep = 'stoploss';
            updateTradePanel();
        }
        return;
    }

    switch (state.tradeStep) {
        case 'direction':
            if (key === ' ' || key === 'l' || key === 'L' || key === '1') {
                e.preventDefault();
                sounds.click();
                selectDirection('long');
            } else if (key === 's' || key === 'S' || key === '2') {
                e.preventDefault();
                sounds.click();
                selectDirection('short');
            }
            break;

        case 'risk':
            if (key === ' ') {
                e.preventDefault();
                sounds.click();
                selectRisk(1); // Default to 1%
            } else if (key >= '1' && key <= '9') {
                e.preventDefault();
                sounds.click();
                const riskPercents = [0.5, 1, 2, 3, 5, 10, 15, 20, 25];
                const idx = parseInt(key) - 1;
                selectRisk(riskPercents[idx]);
            }
            break;

        case 'stoploss':
            // Stop loss is now set by clicking on chart
            break;

        case 'confirm':
            if (key === 'Enter' || key === ' ' || key === 'y' || key === 'Y') {
                e.preventDefault();
                placeTrade();
            }
            break;
    }
}

function selectDirection(direction) {
    state.pendingTrade.direction = direction;
    state.tradeStep = 'risk';
    updateTradePanel();
}

function selectRisk(riskPercent) {
    state.pendingTrade.riskPercent = riskPercent;
    state.pendingTrade.riskAmount = state.balance * (riskPercent / 100);
    state.tradeStep = 'stoploss';
    updateTradePanel();
    render(); // Re-render to show click hint
}

function selectStopLoss(stopPrice) {
    const currentPrice = state.data.close[state.currentCandleIndex];
    state.pendingTrade.stopLoss = stopPrice;

    let stopPercent;
    if (state.pendingTrade.direction === 'long') {
        stopPercent = ((currentPrice - stopPrice) / currentPrice) * 100;
    } else {
        stopPercent = ((stopPrice - currentPrice) / currentPrice) * 100;
    }

    state.pendingTrade.stopPercent = stopPercent;
    state.pendingTrade.positionSize = state.pendingTrade.riskAmount / (stopPercent / 100);
    state.pendingTrade.shares = state.pendingTrade.positionSize / currentPrice;

    state.tradeStep = 'confirm';
    sounds.click();
    updateTradePanel();
    render();
}

function handleChartClick(e) {
    if (!state.data || !state.chartMetrics) return;

    // Don't process click if we were dragging
    if (state.isDraggingStopLoss) {
        state.isDraggingStopLoss = false;
        return;
    }

    const rect = elements.chartContainer.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { yToPrice, padding } = state.chartMetrics;

    // If in stop loss selection mode, set stop loss by clicking
    if (state.tradeMode && state.tradeStep === 'stoploss') {
        const clickedPrice = yToPrice(y);
        const currentPrice = state.data.close[state.currentCandleIndex];

        // Validate stop loss position
        if (state.pendingTrade.direction === 'long') {
            if (clickedPrice >= currentPrice) {
                sounds.lose();
                showErrorModal('Stop loss must be BELOW current price for a long position', 'Invalid Stop Loss');
                return;
            }
        } else {
            if (clickedPrice <= currentPrice) {
                sounds.lose();
                showErrorModal('Stop loss must be ABOVE current price for a short position', 'Invalid Stop Loss');
                return;
            }
        }

        selectStopLoss(clickedPrice);
        return;
    }
}

function handleMouseDown(e) {
    if (!state.data || !state.chartMetrics || !state.currentPosition) return;

    const rect = elements.chartContainer.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { priceToY } = state.chartMetrics;

    // Check if clicking near the stop loss line (within 10 pixels)
    const slY = priceToY(state.currentPosition.stopLoss);
    if (Math.abs(y - slY) < 15) {
        state.isDraggingStopLoss = true;
        elements.chartContainer.style.cursor = 'ns-resize';
        e.preventDefault();
    }
}

function handleMouseUp(e) {
    if (state.isDraggingStopLoss) {
        state.isDraggingStopLoss = false;
        elements.chartContainer.style.cursor = 'crosshair';
    }
}

function updateStopLoss(newStopPrice) {
    if (!state.currentPosition) return;

    const pos = state.currentPosition;
    const currentPrice = state.data.close[state.currentCandleIndex];

    // Allow moving stop loss in any direction, but can't cross current price
    if (pos.direction === 'long') {
        // For long, stop must stay below current price
        if (newStopPrice >= currentPrice) return;
    } else {
        // For short, stop must stay above current price
        if (newStopPrice <= currentPrice) return;
    }

    pos.stopLoss = newStopPrice;
    render();
}

function enterTradeMode() {
    if (!state.data || state.currentPosition) return;

    state.tradeMode = true;
    state.tradeStep = 'direction';
    state.pendingTrade = {
        direction: null,
        riskPercent: null,
        riskAmount: null,
        stopLoss: null,
        stopPercent: null,
        positionSize: null,
        shares: null,
    };

    updateTradePanel();
    elements.tradePanel.classList.remove('hidden');
}

function exitTradeMode() {
    state.tradeMode = false;
    state.tradeStep = 'direction';
    state.pendingTrade = null;
    elements.tradePanel.classList.add('hidden');
    render();
}

function updateTradePanel() {
    const currentPrice = state.data ? state.data.close[state.currentCandleIndex] : 0;
    let html = '';

    switch (state.tradeStep) {
        case 'direction':
            html = `
                <div class="trade-step">
                    <h3>📊 OPEN POSITION</h3>
                    <p class="trade-prompt">Choose direction:</p>
                    <div class="trade-options">
                        <button class="trade-option green" onclick="selectDirection('long', event)">
                            <span class="key">SPACE</span> Long (Buy) 📈
                        </button>
                        <button class="trade-option" onclick="selectDirection('short', event)">
                            <span class="key">S</span> Short (Sell) 📉
                        </button>
                    </div>
                    <p class="trade-hint">SPACE for Long | S for Short | ESC to cancel</p>
                </div>
            `;
            break;

        case 'risk':
            html = `
                <div class="trade-step">
                    <h3>${state.pendingTrade.direction === 'long' ? '📈 LONG' : '📉 SHORT'} @ $${currentPrice.toFixed(2)}</h3>
                    <p class="trade-prompt">Risk how much of $${formatMoney(state.balance)}?</p>
                    <div class="trade-options compact">
                        <button class="trade-option" onclick="selectRisk(0.5, event)"><span class="key">1</span> 0.5%<br><small>$${formatMoney(state.balance * 0.005)}</small></button>
                        <button class="trade-option green" onclick="selectRisk(1, event)"><span class="key">SPACE</span> 1%<br><small>$${formatMoney(state.balance * 0.01)}</small></button>
                        <button class="trade-option" onclick="selectRisk(2, event)"><span class="key">3</span> 2%<br><small>$${formatMoney(state.balance * 0.02)}</small></button>
                        <button class="trade-option" onclick="selectRisk(3, event)"><span class="key">4</span> 3%<br><small>$${formatMoney(state.balance * 0.03)}</small></button>
                        <button class="trade-option" onclick="selectRisk(5, event)"><span class="key">5</span> 5%<br><small>$${formatMoney(state.balance * 0.05)}</small></button>
                        <button class="trade-option" onclick="selectRisk(10, event)"><span class="key">6</span> 10%<br><small>$${formatMoney(state.balance * 0.10)}</small></button>
                        <button class="trade-option" onclick="selectRisk(15, event)"><span class="key">7</span> 15%<br><small>$${formatMoney(state.balance * 0.15)}</small></button>
                        <button class="trade-option" onclick="selectRisk(20, event)"><span class="key">8</span> 20%<br><small>$${formatMoney(state.balance * 0.20)}</small></button>
                        <button class="trade-option" onclick="selectRisk(25, event)"><span class="key">9</span> 25%<br><small>$${formatMoney(state.balance * 0.25)}</small></button>
                    </div>
                    <p class="trade-hint">SPACE for 1% | 1-9 for others | ESC to go back</p>
                </div>
            `;
            break;

        case 'stoploss':
            html = `
                <div class="trade-step stoploss-step">
                    <h3>${state.pendingTrade.direction === 'long' ? '📈 LONG' : '📉 SHORT'} | Risk: $${formatMoney(state.pendingTrade.riskAmount)}</h3>
                    <p class="trade-prompt">👆 Click on the chart to set your stop loss</p>
                    <p class="trade-detail">
                        Entry: $${currentPrice.toFixed(2)}<br>
                        ${state.pendingTrade.direction === 'long'
                            ? 'Click BELOW the current price'
                            : 'Click ABOVE the current price'}
                    </p>
                    <p class="trade-hint">ESC to go back</p>
                </div>
            `;
            break;

        case 'confirm':
            const tp = state.pendingTrade;
            html = `
                <div class="trade-step confirm">
                    <h3>✅ CONFIRM TRADE</h3>
                    <div class="trade-summary">
                        <div class="summary-row">
                            <span>Direction:</span>
                            <span class="${tp.direction}">${tp.direction.toUpperCase()}</span>
                        </div>
                        <div class="summary-row">
                            <span>Entry Price:</span>
                            <span>$${currentPrice.toFixed(2)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Stop Loss:</span>
                            <span class="red">$${tp.stopLoss.toFixed(2)} (-${tp.stopPercent.toFixed(2)}%)</span>
                        </div>
                        <div class="summary-row">
                            <span>Position Size:</span>
                            <span>$${formatMoney(tp.positionSize)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Shares:</span>
                            <span>${tp.shares.toFixed(2)}</span>
                        </div>
                        <div class="summary-row highlight">
                            <span>MAX LOSS:</span>
                            <span class="red">$${formatMoney(tp.riskAmount)} (${tp.riskPercent}%)</span>
                        </div>
                    </div>
                    <div class="trade-actions">
                        <button class="trade-option green" onclick="placeTrade(event)">
                            <span class="key">SPACE</span> Confirm Trade
                        </button>
                        <button class="trade-option" onclick="goBackToStopLoss(event)">
                            <span class="key">ESC</span> Go Back
                        </button>
                    </div>
                </div>
            `;
            break;
    }

    elements.tradePanel.innerHTML = html;

    // Move panel to corner when setting stop loss so user can click on chart
    if (state.tradeStep === 'stoploss') {
        elements.tradePanel.classList.add('stoploss-mode');
    } else {
        elements.tradePanel.classList.remove('stoploss-mode');
    }
}

// Make functions available globally for onclick handlers
window.selectDirection = function(dir, e) {
    if (e) e.stopPropagation();
    sounds.click();
    selectDirection(dir);
};
window.selectRisk = function(risk, e) {
    if (e) e.stopPropagation();
    sounds.click();
    selectRisk(risk);
};
window.placeTrade = function(e) {
    if (e) e.stopPropagation();
    placeTrade();
};
window.goBackToStopLoss = function(e) {
    if (e) e.stopPropagation();
    sounds.click();
    state.tradeStep = 'stoploss';
    updateTradePanel();
    render();
};
window.exitTradeModeGlobal = function(e) {
    if (e) e.stopPropagation();
    exitTradeMode();
};

// Toggle fresh data mode (for local development - skips cache, uses live API)
window.toggleFreshData = function() {
    CACHE_CONFIG.USE_FRESH_DATA = !CACHE_CONFIG.USE_FRESH_DATA;
    const status = CACHE_CONFIG.USE_FRESH_DATA ? 'ON (using live API)' : 'OFF (using cache)';
    console.log(`Fresh data mode: ${status}`);
    alert(`Fresh data mode: ${status}\n\nWhen ON, stock data will be fetched from live API instead of cache files.`);
    return CACHE_CONFIG.USE_FRESH_DATA;
};

function formatMoney(amount) {
    if (amount >= 1000000) return (amount / 1000000).toFixed(2) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return amount.toFixed(0);
}

function setupCanvas() {
    const container = elements.chartContainer;
    const dpr = window.devicePixelRatio || 1;

    // Reset the transform before setting new dimensions
    elements.ctx.setTransform(1, 0, 0, 1, 0, 0);

    elements.canvas.width = container.clientWidth * dpr;
    elements.canvas.height = container.clientHeight * dpr;
    elements.canvas.style.width = container.clientWidth + 'px';
    elements.canvas.style.height = container.clientHeight + 'px';
    elements.ctx.scale(dpr, dpr);
}

// Calculate EMA
function calculateEMA(data, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first value
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
        sum += data[i];
    }
    ema[period - 1] = sum / period;

    // Calculate EMA for rest
    for (let i = period; i < data.length; i++) {
        ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
}

// API Functions
function isLocalDevelopment() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '';
}

// Cache configuration - individual files per symbol
const CACHE_CONFIG = {
    EXPIRY_HOURS: 4,
    PREFIX: 'lmr_stock_',
    CACHED_SYMBOLS: null,     // List of symbols with pre-cached data (from index.json)
    SYMBOL_DATA: {},          // In-memory cache of loaded symbol files
    INDEX_LOADED: false,
    USE_FRESH_DATA: false     // Set to true locally to skip cache and use live API
};

// Load the cache index (list of pre-cached symbols)
async function loadCacheIndexIfNeeded() {
    if (CACHE_CONFIG.INDEX_LOADED) return;
    CACHE_CONFIG.INDEX_LOADED = true;

    try {
        const response = await fetch('stock_data/index.json');
        if (response.ok) {
            const index = await response.json();
            CACHE_CONFIG.CACHED_SYMBOLS = index.symbols || [];
            console.log(`Cache index loaded: ${CACHE_CONFIG.CACHED_SYMBOLS.length} pre-cached symbols available`);
        }
    } catch (e) {
        console.log('No cache index found, will use API for all symbols');
        CACHE_CONFIG.CACHED_SYMBOLS = [];
    }
}

// Load individual symbol file from stock_data/{SYMBOL}.json
async function loadSymbolFileIfNeeded(ticker) {
    // Already loaded in memory?
    if (CACHE_CONFIG.SYMBOL_DATA[ticker]) {
        return true;
    }

    // Not in the pre-cached list?
    if (!CACHE_CONFIG.CACHED_SYMBOLS?.includes(ticker)) {
        return false;
    }

    try {
        // Sanitize ticker for filename (same logic as Python)
        const safeSymbol = ticker.replace(/[\/\\:]/g, '_');
        const response = await fetch(`stock_data/${safeSymbol}.json`);
        if (response.ok) {
            const fileData = await response.json();
            CACHE_CONFIG.SYMBOL_DATA[ticker] = fileData.data || {};
            console.log(`Loaded cache file for ${ticker}: ${Object.keys(CACHE_CONFIG.SYMBOL_DATA[ticker]).length} timeframes`);
            return true;
        }
    } catch (e) {
        console.log(`Failed to load cache file for ${ticker}:`, e.message);
    }
    return false;
}

// Check pre-fetched file cache for specific timeframe
async function getFromFileCache(ticker, period, interval) {
    // Ensure index is loaded
    await loadCacheIndexIfNeeded();

    // Try to load the symbol file
    const loaded = await loadSymbolFileIfNeeded(ticker);
    if (!loaded) return null;

    const symbolData = CACHE_CONFIG.SYMBOL_DATA[ticker];
    if (!symbolData) return null;

    const key = `${ticker}_${period}_${interval}`;
    const data = symbolData[key];

    if (data) {
        console.log(`File cache hit for ${ticker} ${interval}`);
        return data;
    }
    return null;
}

// Backwards compatibility wrapper
async function loadFileCacheIfNeeded() {
    await loadCacheIndexIfNeeded();
}

// Cache helper functions
function getCacheKey(ticker, period, interval) {
    return `${CACHE_CONFIG.PREFIX}${ticker}_${period}_${interval}`;
}

function getFromCache(ticker, period, interval) {
    try {
        const key = getCacheKey(ticker, period, interval);
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const { timestamp, data } = JSON.parse(cached);
        const expiryMs = CACHE_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000;

        if (Date.now() - timestamp > expiryMs) {
            localStorage.removeItem(key);
            return null;
        }

        console.log(`LocalStorage cache hit for ${ticker} ${interval}`);
        return data;
    } catch (e) {
        return null;
    }
}

function saveToCache(ticker, period, interval, data) {
    try {
        const key = getCacheKey(ticker, period, interval);
        const cached = { timestamp: Date.now(), data };
        localStorage.setItem(key, JSON.stringify(cached));
    } catch (e) {
        // localStorage might be full or disabled - ignore
        console.log('Cache save failed:', e.message);
    }
}

function clearExpiredCache() {
    try {
        const prefix = CACHE_CONFIG.PREFIX;
        const expiryMs = CACHE_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000;
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                try {
                    const cached = JSON.parse(localStorage.getItem(key));
                    if (Date.now() - cached.timestamp > expiryMs) {
                        keysToRemove.push(key);
                    }
                } catch {
                    keysToRemove.push(key);
                }
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        if (keysToRemove.length > 0) {
            console.log(`Cleared ${keysToRemove.length} expired cache entries`);
        }
    } catch (e) {
        // Ignore errors
    }
}

// Clear expired cache on startup
clearExpiredCache();

async function fetchStockData(ticker, period, interval, loadingMessage = null) {
    // Skip cache if USE_FRESH_DATA is enabled (for local development with live data)
    const skipCache = CACHE_CONFIG.USE_FRESH_DATA && isLocalDevelopment();

    if (!skipCache) {
        // Try file cache first (pre-fetched data from individual files)
        const fileCachedData = await getFromFileCache(ticker, period, interval);
        if (fileCachedData) {
            return fileCachedData;
        }

        // Then check localStorage cache
        const cachedData = getFromCache(ticker, period, interval);
        if (cachedData) {
            return cachedData;
        }
    } else {
        console.log(`Fresh data mode: skipping cache for ${ticker}`);
    }

    const config = TIMEFRAME_CONFIG[interval];
    const defaultMsg = loadingMessage || `Loading ${config?.label || interval} data for ${ticker}, please wait...`;
    showLoading(true, defaultMsg);
    try {
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${period}&interval=${interval}&includePrePost=false`;

        let json;

        // Use local proxy for fast local development
        if (isLocalDevelopment()) {
            try {
                const localProxyUrl = `http://localhost:8000/api/stocks/${ticker}?range=${period}&interval=${interval}`;
                const response = await fetch(localProxyUrl, { signal: AbortSignal.timeout(5000) });
                if (response.ok) {
                    json = await response.json();
                }
            } catch (e) {
                // Local proxy not running, fall through to CORS proxies
                console.log('Local proxy not available, using CORS proxies...');
            }
        }

        // Fall back to CORS proxies if local proxy failed or not local
        if (!json) {
            // Race all proxies in parallel - fastest one wins
            const proxyPromises = [
                // allorigins /get endpoint
                fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`)
                    .then(r => r.ok ? r.json() : Promise.reject())
                    .then(data => JSON.parse(data.contents)),
                // allorigins /raw endpoint
                fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`)
                    .then(r => r.ok ? r.json() : Promise.reject()),
                // corsproxy.io
                fetch(`https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`)
                    .then(r => r.ok ? r.json() : Promise.reject()),
            ];

            // Add timeout to reject slow responses
            const timeout = (ms) => new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), ms)
            );

            // Race all proxies with a 10 second timeout
            json = await Promise.any([
                ...proxyPromises,
                timeout(10000).then(() => Promise.reject(new Error('All proxies timed out')))
            ].map(p => p.catch(() => Promise.reject())));
        }

        if (!json || !json.chart) {
            throw new Error('Invalid response from proxy');
        }

        // Parse Yahoo Finance response format
        if (!json.chart || !json.chart.result || json.chart.result.length === 0) {
            throw new Error('No data returned from Yahoo Finance');
        }

        const result = json.chart.result[0];
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;

        if (!timestamps || timestamps.length === 0) {
            throw new Error('No timestamps in data');
        }

        // Convert to the format the game expects
        const data = {
            ticker: ticker,
            count: timestamps.length,
            timestamps: timestamps.map(t => new Date(t * 1000).toISOString()),
            open: quotes.open,
            high: quotes.high,
            low: quotes.low,
            close: quotes.close,
            volume: quotes.volume
        };

        // Filter out any null values (market holidays, etc.)
        const validIndices = [];
        for (let i = 0; i < data.count; i++) {
            if (data.open[i] != null && data.close[i] != null &&
                data.high[i] != null && data.low[i] != null) {
                validIndices.push(i);
            }
        }

        // Rebuild arrays with only valid data
        const filtered = {
            ticker: data.ticker,
            count: validIndices.length,
            timestamps: validIndices.map(i => data.timestamps[i]),
            open: validIndices.map(i => data.open[i]),
            high: validIndices.map(i => data.high[i]),
            low: validIndices.map(i => data.low[i]),
            close: validIndices.map(i => data.close[i]),
            volume: validIndices.map(i => data.volume[i])
        };

        // Save to cache for future requests
        saveToCache(ticker, period, interval, filtered);

        return filtered;
    } catch (error) {
        console.error('Error fetching stock data:', error);
        // Don't show error here - let the caller decide (loadRandomSymbol retries multiple stocks)
        return null;
    } finally {
        showLoading(false);
    }
}

async function loadTicker() {
    const ticker = elements.tickerInput.value.trim().toUpperCase();
    if (!ticker) return;

    state.ticker = ticker;
    state.timeframeStack = [];
    state.currentPosition = null;
    exitTradeMode();

    await loadData();

    // Focus on chart container so keyboard controls work immediately
    elements.chartContainer.focus();
}

async function loadData(targetTimestamp = null) {
    const config = TIMEFRAME_CONFIG[state.timeframe];
    const data = await fetchStockData(state.ticker, config.period, state.timeframe);

    if (data && data.count > 0) {
        state.data = data;

        // Calculate EMAs
        state.ema10 = calculateEMA(data.close, 10);
        state.ema20 = calculateEMA(data.close, 20);

        if (targetTimestamp) {
            // Find the candle closest to the target timestamp
            const targetTime = new Date(targetTimestamp).getTime();
            let closestIndex = 0;
            let closestDiff = Infinity;

            for (let i = 0; i < data.timestamps.length; i++) {
                const diff = Math.abs(new Date(data.timestamps[i]).getTime() - targetTime);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestIndex = i;
                }
            }

            // Check if the closest match is too far away (more than reasonable for this timeframe)
            const maxDiffMs = {
                '1wk': 7 * 24 * 60 * 60 * 1000,   // 1 week
                '1d': 2 * 24 * 60 * 60 * 1000,    // 2 days
                '1h': 2 * 60 * 60 * 1000,         // 2 hours
                '15m': 30 * 60 * 1000,            // 30 mins
                '5m': 10 * 60 * 1000,             // 10 mins
            };

            if (closestDiff > (maxDiffMs[state.timeframe] || Infinity)) {
                // Data not available for this time period - show message and revert
                showErrorModal(`No ${config.label} data available for this time period. Try a more recent date.`, 'Data Unavailable');
                // Revert to previous timeframe if we have stack
                if (state.timeframeStack.length > 0) {
                    const previous = state.timeframeStack.pop();
                    state.timeframe = previous.timeframe;
                    elements.timeframeBtns.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.tf === state.timeframe);
                    });
                    await loadData(previous.timestamp);
                    return;
                }
            }

            state.currentCandleIndex = closestIndex;
        } else {
            // Start somewhere in the middle for fresh loads
            const startPoint = Math.floor(data.count * 0.3) + Math.floor(Math.random() * data.count * 0.4);
            state.currentCandleIndex = startPoint;
        }

        state.visibleStartIndex = Math.max(0, state.currentCandleIndex - state.visibleCandles + 10);
        updateTickerInfo();
        render();
        return true; // Success
    } else if (targetTimestamp && state.timeframeStack.length > 0) {
        // No data at all - revert
        showErrorModal(`No ${config.label} data available for ${state.ticker}. Reverting to previous timeframe.`, 'Data Unavailable');
        const previous = state.timeframeStack.pop();
        state.timeframe = previous.timeframe;
        elements.timeframeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tf === state.timeframe);
        });
        return await loadData(previous.timestamp);
    }
    return false; // Failed to load
}

function changeTimeframe(tf) {
    if (tf === state.timeframe || !state.ticker) return;

    // Save current timestamp before changing
    const currentTimestamp = state.data ? state.data.timestamps[state.currentCandleIndex] : null;

    state.timeframe = tf;
    elements.timeframeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === tf);
    });

    loadData(currentTimestamp);
}

function randomJump() {
    if (!state.data || state.currentPosition) return;

    const maxStart = Math.max(0, state.data.count - 100);
    const minStart = Math.floor(state.data.count * 0.1);
    state.currentCandleIndex = minStart + Math.floor(Math.random() * (maxStart - minStart));
    adjustView();
    render();
}

function adjustView() {
    const buffer = 10;
    if (state.currentCandleIndex < state.visibleStartIndex + buffer) {
        state.visibleStartIndex = Math.max(0, state.currentCandleIndex - buffer);
    } else if (state.currentCandleIndex >= state.visibleStartIndex + state.visibleCandles - buffer) {
        state.visibleStartIndex = state.currentCandleIndex - state.visibleCandles + buffer;
    }
}

async function drillDown() {
    if (!state.data || !state.ticker) return;

    const config = TIMEFRAME_CONFIG[state.timeframe];
    if (!config.drillTo) return;

    const currentTimestamp = state.data.timestamps[state.currentCandleIndex];

    state.timeframeStack.push({
        timeframe: state.timeframe,
        candleIndex: state.currentCandleIndex,
        timestamp: currentTimestamp
    });

    state.timeframe = config.drillTo;
    elements.timeframeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === state.timeframe);
    });

    await loadData(currentTimestamp);
}

async function drillUp() {
    if (state.timeframeStack.length === 0) return;

    const previous = state.timeframeStack.pop();
    state.timeframe = previous.timeframe;

    elements.timeframeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === state.timeframe);
    });

    await loadData(previous.timestamp);
}

// Trading Functions
function placeTrade() {
    if (!state.data || state.currentPosition || !state.pendingTrade) return;

    const currentPrice = state.data.close[state.currentCandleIndex];
    const tp = state.pendingTrade;

    state.currentPosition = {
        direction: tp.direction,
        entryPrice: currentPrice,
        entryIndex: state.currentCandleIndex,
        entryDate: state.data.timestamps[state.currentCandleIndex],
        stopLoss: tp.stopLoss,
        stopPercent: tp.stopPercent,
        riskAmount: tp.riskAmount,
        riskPercent: tp.riskPercent,
        positionSize: tp.positionSize,
        shares: tp.shares,
        ticker: state.ticker,
        timeframe: state.timeframe,
    };

    // Play trade open sound and effect
    sounds.tradeOpen();
    const luckyPos = getLuckyPosition();
    effects.pulseRing(luckyPos.x, luckyPos.y, '#2962ff');

    // Burst of sparkles on trade entry
    for (let i = 0; i < 5; i++) {
        setTimeout(() => createSparkle(luckyPos.x, luckyPos.y), i * 50);
    }

    elements.luckySprite.classList.add('jumping');
    setTimeout(() => elements.luckySprite.classList.remove('jumping'), 500);

    exitTradeMode();
    updatePositionDisplay();
    render();
    updateMobileUI();
}

function checkPositionStatus() {
    if (!state.currentPosition) return null;

    const pos = state.currentPosition;
    const currentCandle = state.currentCandleIndex;

    if (currentCandle <= pos.entryIndex) return null;

    const high = state.data.high[currentCandle];
    const low = state.data.low[currentCandle];

    let result = null;

    if (pos.direction === 'long') {
        if (low <= pos.stopLoss) {
            // Calculate actual PnL based on where stop was hit
            const pctChange = (pos.stopLoss - pos.entryPrice) / pos.entryPrice;
            const pnl = pos.positionSize * pctChange;
            result = {
                type: 'stop',
                exitPrice: pos.stopLoss,
                pnl: pnl
            };
        }
    } else {
        if (high >= pos.stopLoss) {
            // For short: profit when price goes down
            const pctChange = (pos.entryPrice - pos.stopLoss) / pos.entryPrice;
            const pnl = pos.positionSize * pctChange;
            result = {
                type: 'stop',
                exitPrice: pos.stopLoss,
                pnl: pnl
            };
        }
    }

    return result;
}

function closePosition(result) {
    if (!state.currentPosition) return;

    const pos = state.currentPosition;
    const pnl = result.pnl;
    const isWin = pnl > 0;

    // Update balance with animation
    const oldBalance = state.balance;
    state.balance += pnl;
    state.totalPnL += pnl;
    animateBalanceChange(oldBalance, state.balance, isWin);

    // Update streak
    if (isWin) {
        state.streak++;
        if (state.streak > state.maxStreak) state.maxStreak = state.streak;
        updateStreakDisplay();
    } else {
        state.streak = 0;
        hideStreakDisplay();
    }

    // Award XP
    const xpGain = calculateXP(pnl, isWin);
    addXP(xpGain);

    const trade = {
        ...pos,
        exitPrice: result.exitPrice,
        exitIndex: state.currentCandleIndex,
        exitDate: state.data.timestamps[state.currentCandleIndex],
        pnl: pnl,
        pnlPercent: (pnl / pos.positionSize) * 100,
        result: result.type,
        timestamp: new Date().toISOString()
    };

    state.trades.push(trade);
    state.currentPosition = null;

    // Visual and audio feedback
    const luckyPos = getLuckyPosition();
    if (isWin) {
        if (pnl >= 5000) {
            sounds.bigWin();
            effects.confetti(60);
            effects.coinBurst(luckyPos.x, luckyPos.y, 30);
            effects.shake(12, 0.85);
            // Extra sparkle burst for big wins
            for (let i = 0; i < 10; i++) {
                setTimeout(() => createSparkle(luckyPos.x, luckyPos.y), i * 30);
            }
        } else {
            sounds.win();
            effects.coinBurst(luckyPos.x, luckyPos.y, 15);
            effects.sparkle(luckyPos.x, luckyPos.y, 20, '#ffd700');
            // Sparkle burst for regular wins
            for (let i = 0; i < 6; i++) {
                setTimeout(() => createSparkle(luckyPos.x, luckyPos.y), i * 50);
            }
        }
        elements.luckySprite.classList.add('celebrate');
        setTimeout(() => elements.luckySprite.classList.remove('celebrate'), 600);

        if (state.streak >= 2) {
            sounds.streak(state.streak);
        }
    } else {
        sounds.lose();
        effects.lossEffect(luckyPos.x, luckyPos.y);
        elements.luckySprite.classList.add('sad');
        setTimeout(() => elements.luckySprite.classList.remove('sad'), 500);
    }

    // Number popup
    effects.numberPopup(
        luckyPos.x,
        luckyPos.y - 40,
        `${isWin ? '+' : ''}$${formatMoney(Math.abs(pnl))}`,
        isWin ? '#26a69a' : '#ef5350',
        isWin && pnl >= 5000 ? 32 : 24
    );

    // Check achievements
    checkAchievements(trade);

    showTradeResult(trade);
    updateUI();
    render();

    // Preload next random stock in background for instant next level
    preloadNextRandomStock();
}

function manualClosePosition() {
    if (!state.currentPosition) return;

    const pos = state.currentPosition;
    const exitPrice = state.data.close[state.currentCandleIndex];

    let pnl;
    if (pos.direction === 'long') {
        const pctChange = (exitPrice - pos.entryPrice) / pos.entryPrice;
        pnl = pos.positionSize * pctChange;
    } else {
        const pctChange = (pos.entryPrice - exitPrice) / pos.entryPrice;
        pnl = pos.positionSize * pctChange;
    }

    closePosition({ type: 'manual', exitPrice, pnl });
}

window.manualClosePosition = manualClosePosition;

function advanceCandle() {
    if (!state.data || state.isLoadingLevel) return;

    // Check if at end of chart
    if (state.currentCandleIndex >= state.data.count - 1) {
        // Auto-close any open position with partial profit (20% of unrealized gains)
        if (state.currentPosition) {
            closePositionEndOfChart();
        }
        // Load new level
        showNewLevelModal();
        return;
    }

    // Get position before moving for trail
    const oldPos = getLuckyPosition();

    state.currentCandleIndex++;
    adjustView();

    // Soft tick sound
    sounds.tick();

    // Create trail segment at old position
    if (oldPos.x > 0) {
        createTrailSegment(oldPos.x, oldPos.y);
    }

    // Add running class briefly for bouncy animation
    elements.luckySprite.classList.add('running');
    setTimeout(() => {
        if (!state.isPlaying) {
            elements.luckySprite.classList.remove('running');
        }
    }, 150);

    if (state.currentPosition) {
        const result = checkPositionStatus();
        if (result) {
            closePosition(result);
            return;
        }

        // Check if near stop loss - warning
        const pos = state.currentPosition;
        const currentPrice = state.data.close[state.currentCandleIndex];
        let distanceToStop;
        if (pos.direction === 'long') {
            distanceToStop = (currentPrice - pos.stopLoss) / currentPrice;
        } else {
            distanceToStop = (pos.stopLoss - currentPrice) / currentPrice;
        }

        if (distanceToStop < 0.02 && distanceToStop > 0) {
            sounds.warning();
            elements.luckySprite.classList.add('warning');
            setTimeout(() => elements.luckySprite.classList.remove('warning'), 200);
        }

        // Update Lucky glow based on P/L
        updateLuckyGlow();
    }

    render();
}

function closePositionEndOfChart() {
    if (!state.currentPosition) return;

    const pos = state.currentPosition;
    const exitPrice = state.data.close[state.currentCandleIndex];

    let fullPnl;
    if (pos.direction === 'long') {
        const pctChange = (exitPrice - pos.entryPrice) / pos.entryPrice;
        fullPnl = pos.positionSize * pctChange;
    } else {
        const pctChange = (pos.entryPrice - exitPrice) / pos.entryPrice;
        fullPnl = pos.positionSize * pctChange;
    }

    // Only give 20% of profits, but keep full losses
    const pnl = fullPnl > 0 ? fullPnl * 0.2 : fullPnl;

    closePosition({ type: 'end_of_chart', exitPrice, pnl, fullPnl });
}

function showNewLevelModal() {
    if (state.isLoadingLevel) return; // Prevent multiple triggers
    state.isLoadingLevel = true;

    state.level = (state.level || 1) + 1;

    // Update background for new level
    backgrounds.setLevel(state.level);
    const sceneName = backgrounds.getSceneName(state.level);

    sounds.levelComplete();
    effects.confetti(40);

    elements.modalTitle.textContent = '🎉 LEVEL COMPLETE!';
    elements.modalBody.innerHTML = `
        <p>You've reached the end of <strong>${state.ticker}</strong>!</p>
        <p style="font-size: 24px; margin: 16px 0;">Level ${state.level - 1} → Level ${state.level}</p>
        <p style="color: #00bcd4; font-size: 12px; letter-spacing: 2px;">🌌 ${sceneName}</p>
        <p>Balance: <span class="${state.balance >= 100000 ? 'positive' : 'negative'}" style="font-weight: bold;">$${state.balance.toLocaleString()}</span></p>
        <p>Total P/L: <span class="${state.totalPnL >= 0 ? 'positive' : 'negative'}" style="font-weight: bold;">${state.totalPnL >= 0 ? '+' : ''}$${formatMoney(Math.abs(state.totalPnL))}</span></p>
        <p style="margin-top: 16px; color: #787b86;">Loading next stock...</p>
    `;
    elements.modal.classList.remove('hidden');

    // Check level-based achievements
    checkAchievements();

    // Load next random symbol after a short delay
    setTimeout(async () => {
        elements.modal.classList.add('hidden');
        await loadRandomSymbol();
        state.isLoadingLevel = false;
    }, 2000);
}

// XP and Progression System
function calculateXP(pnl, isWin) {
    let xp = 10; // Base XP for completing a trade

    if (isWin) {
        xp += 20;
        xp += Math.floor(pnl / 100); // Bonus XP for larger wins
        xp += state.streak * 5; // Streak bonus
    }

    return Math.max(10, xp);
}

function addXP(amount) {
    state.xp += amount;

    while (state.xp >= state.xpToNextLevel) {
        state.xp -= state.xpToNextLevel;
        state.xpToNextLevel = Math.floor(state.xpToNextLevel * 1.5);
        // Level up is tracked separately
    }

    updateXPBar();
}

function updateXPBar() {
    if (!elements.xpFill || !elements.xpText) return;

    const progress = (state.xp / state.xpToNextLevel) * 100;
    elements.xpFill.style.width = `${progress}%`;
    elements.xpText.textContent = `Level ${state.level} - ${state.xp}/${state.xpToNextLevel} XP`;
}

function updateStreakDisplay() {
    if (!elements.streakDisplay) return;

    if (state.streak >= 2) {
        elements.streakDisplay.classList.remove('hidden');
        elements.streakDisplay.querySelector('.streak-count').textContent = state.streak;
    }
}

function hideStreakDisplay() {
    if (!elements.streakDisplay) return;
    elements.streakDisplay.classList.add('hidden');
}

function animateBalanceChange(from, to, isWin) {
    const balanceEl = elements.balance;
    if (!balanceEl) return;

    const parent = balanceEl.closest('.hud-balance');
    if (parent) {
        parent.classList.remove('balance-up', 'balance-down');
        void parent.offsetWidth; // Trigger reflow
        parent.classList.add(isWin ? 'balance-up' : 'balance-down');
    }

    // Animate the number
    const duration = 500;
    const start = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (to - from) * eased;

        balanceEl.textContent = Math.floor(current).toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

// Achievement System
function checkAchievements(trade = null) {
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
        if (state.achievements.includes(id)) continue;

        if (achievement.condition(trade)) {
            state.achievements.push(id);
            showAchievement(achievement);
        }
    }
}

function showAchievement(achievement) {
    if (!elements.achievementPopup) return;

    sounds.bigWin();

    elements.achievementPopup.querySelector('.achievement-desc').textContent = achievement.name;
    elements.achievementPopup.classList.remove('hidden');

    setTimeout(() => {
        elements.achievementPopup.classList.add('hidden');
    }, 3000);
}

function closeLevelModal() {
    if (elements.levelModal) {
        elements.levelModal.classList.add('hidden');
    }
}

// Helper to get Lucky's current screen position
function getLuckyPosition() {
    if (!state.chartMetrics) return { x: 0, y: 0 };

    const { indexToX, priceToY } = state.chartMetrics;
    const currentPrice = state.data.close[state.currentCandleIndex];

    return {
        x: indexToX(state.currentCandleIndex),
        y: priceToY(currentPrice)
    };
}

// ==================== LUCKY'S TRAIL AND SPARKLES ====================

// Create a rainbow trail segment behind Lucky (Nyan cat style)
function createTrailSegment(x, y) {
    const trailContainer = document.getElementById('lucky-trail');
    if (!trailContainer) return;

    const segment = document.createElement('div');
    segment.className = 'trail-segment';
    segment.style.left = (x - 40) + 'px';
    segment.style.top = (y - 20) + 'px';

    // Create rainbow bands
    for (let i = 0; i < 6; i++) {
        const band = document.createElement('div');
        band.className = 'trail-band';
        segment.appendChild(band);
    }

    trailContainer.appendChild(segment);

    // Remove after animation
    setTimeout(() => segment.remove(), 600);
}

// Create floating sparkles ahead of Lucky
function createSparkle(x, y) {
    const sparkleContainer = document.getElementById('lucky-sparkles');
    if (!sparkleContainer) return;

    const sparkleTypes = [
        { emoji: '✦', class: 'star' },
        { emoji: '◆', class: 'diamond' },
        { emoji: '$', class: 'coin' },
        { emoji: '📈', class: 'chart' },
        { emoji: '✧', class: 'star' },
        { emoji: '💎', class: 'diamond' },
    ];

    const type = sparkleTypes[Math.floor(Math.random() * sparkleTypes.length)];
    const sparkle = document.createElement('div');
    sparkle.className = `sparkle ${type.class}`;
    sparkle.textContent = type.emoji;

    // Position ahead and slightly random
    const offsetX = 30 + Math.random() * 60;
    const offsetY = (Math.random() - 0.5) * 80;

    sparkle.style.left = (x + offsetX) + 'px';
    sparkle.style.top = (y + offsetY) + 'px';
    sparkle.style.animationDuration = (1 + Math.random() * 0.5) + 's';

    sparkleContainer.appendChild(sparkle);

    // Remove after animation
    setTimeout(() => sparkle.remove(), 2000);
}

// Create dollar sign floating
function createDollarSparkle(x, y, isProfit) {
    const sparkleContainer = document.getElementById('lucky-sparkles');
    if (!sparkleContainer) return;

    const dollar = document.createElement('div');
    dollar.className = 'sparkle-dollar';
    dollar.textContent = isProfit ? '+$' : '$';
    dollar.style.color = isProfit ? '#26a69a' : '#787b86';

    const offsetX = 40 + Math.random() * 40;
    const offsetY = (Math.random() - 0.5) * 50;

    dollar.style.left = (x + offsetX) + 'px';
    dollar.style.top = (y + offsetY) + 'px';

    sparkleContainer.appendChild(dollar);
    setTimeout(() => dollar.remove(), 2000);
}

// Create mini candle preview sparkles
function createCandleSparkle(x, y) {
    const sparkleContainer = document.getElementById('lucky-sparkles');
    if (!sparkleContainer) return;

    const candle = document.createElement('div');
    candle.className = `sparkle-candle ${Math.random() > 0.5 ? 'green' : 'red'}`;

    const offsetX = 50 + Math.random() * 80;
    const offsetY = (Math.random() - 0.5) * 60;

    candle.style.left = (x + offsetX) + 'px';
    candle.style.top = (y + offsetY) + 'px';
    candle.style.height = (10 + Math.random() * 20) + 'px';

    sparkleContainer.appendChild(candle);
    setTimeout(() => candle.remove(), 1000);
}

// Spawn sparkles periodically when Lucky is visible
let sparkleInterval = null;

function startSparkles() {
    if (sparkleInterval) return;

    sparkleInterval = setInterval(() => {
        if (!state.data || !state.chartMetrics) return;

        const pos = getLuckyPosition();
        if (pos.x <= 0) return;

        // Randomly spawn different sparkle types
        const rand = Math.random();
        if (rand < 0.4) {
            createSparkle(pos.x, pos.y);
        } else if (rand < 0.7) {
            createCandleSparkle(pos.x, pos.y);
        } else {
            const hasPosition = state.currentPosition !== null;
            const isProfit = hasPosition && calculateCurrentPnL() > 0;
            createDollarSparkle(pos.x, pos.y, isProfit);
        }
    }, 300);
}

function stopSparkles() {
    if (sparkleInterval) {
        clearInterval(sparkleInterval);
        sparkleInterval = null;
    }
}

// Calculate current P/L for sparkle color
function calculateCurrentPnL() {
    if (!state.currentPosition || !state.data) return 0;

    const pos = state.currentPosition;
    const currentPrice = state.data.close[state.currentCandleIndex];

    if (pos.direction === 'long') {
        return pos.positionSize * ((currentPrice - pos.entryPrice) / pos.entryPrice);
    } else {
        return pos.positionSize * ((pos.entryPrice - currentPrice) / pos.entryPrice);
    }
}

function updateLuckyGlow() {
    if (!state.currentPosition) {
        elements.luckySprite.classList.remove('profit-glow', 'loss-glow');
        return;
    }

    const pos = state.currentPosition;
    const currentPrice = state.data.close[state.currentCandleIndex];
    let pnl;

    if (pos.direction === 'long') {
        pnl = pos.positionSize * ((currentPrice - pos.entryPrice) / pos.entryPrice);
    } else {
        pnl = pos.positionSize * ((pos.entryPrice - currentPrice) / pos.entryPrice);
    }

    elements.luckySprite.classList.toggle('profit-glow', pnl > 0);
    elements.luckySprite.classList.toggle('loss-glow', pnl < 0);
}

// Rendering
function render() {
    if (!state.data) {
        drawEmptyChart();
        return;
    }

    drawChart();
    updateLucky();
    updateFooter();
    updatePositionDisplay();
    updateHUD();
    updateLuckyGlow();
}

function drawEmptyChart() {
    const ctx = elements.ctx;
    const width = elements.chartContainer.clientWidth;
    const height = elements.chartContainer.clientHeight;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background scene first
    backgrounds.drawToContext(ctx, width, height);

    // Semi-transparent dark overlay
    ctx.fillStyle = 'rgba(19, 23, 34, 0.82)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 1;

    for (let i = 0; i < 10; i++) {
        const y = (height / 10) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.fillStyle = '#787b86';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Enter a ticker symbol to start trading!', width / 2, height / 2 - 40);

    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Lucky is ready to run! 🐕', width / 2, height / 2);

    ctx.fillStyle = '#4c525e';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('SPACE = Trade | → = Next Candle | ↑↓ = Drill Timeframe | R = Random Jump', width / 2, height / 2 + 40);

    elements.luckySprite.style.display = 'none';
}

function drawChart() {
    const ctx = elements.ctx;
    const width = elements.chartContainer.clientWidth;
    const height = elements.chartContainer.clientHeight;

    const padding = { top: 20, right: 80, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background scene first
    backgrounds.drawToContext(ctx, width, height);

    // Semi-transparent dark overlay so chart is readable
    ctx.fillStyle = 'rgba(19, 23, 34, 0.82)';
    ctx.fillRect(0, 0, width, height);

    const startIdx = state.visibleStartIndex;
    const endIdx = Math.min(state.currentCandleIndex + 1, state.data.count);
    const visibleEndIdx = Math.min(startIdx + state.visibleCandles, endIdx);

    let visibleHigh = -Infinity;
    let visibleLow = Infinity;

    for (let i = startIdx; i < visibleEndIdx; i++) {
        visibleHigh = Math.max(visibleHigh, state.data.high[i]);
        visibleLow = Math.min(visibleLow, state.data.low[i]);

        // Include EMAs in range
        if (state.ema10[i]) {
            visibleHigh = Math.max(visibleHigh, state.ema10[i]);
            visibleLow = Math.min(visibleLow, state.ema10[i]);
        }
        if (state.ema20[i]) {
            visibleHigh = Math.max(visibleHigh, state.ema20[i]);
            visibleLow = Math.min(visibleLow, state.ema20[i]);
        }
    }

    if (state.currentPosition) {
        visibleHigh = Math.max(visibleHigh, state.currentPosition.stopLoss, state.currentPosition.entryPrice);
        visibleLow = Math.min(visibleLow, state.currentPosition.stopLoss, state.currentPosition.entryPrice);
    }

    // If setting stop loss, expand range
    if (state.tradeMode && state.tradeStep === 'stoploss') {
        const currentPrice = state.data.close[state.currentCandleIndex];
        visibleHigh = Math.max(visibleHigh, currentPrice * 1.05);
        visibleLow = Math.min(visibleLow, currentPrice * 0.95);
    }

    const priceRange = visibleHigh - visibleLow;
    // Apply vertical scale - lower scale = more compressed (more price range visible)
    const pricePadding = priceRange * state.verticalScale * 0.15;

    const minPrice = visibleLow - pricePadding;
    const maxPrice = visibleHigh + pricePadding;

    const priceToY = (price) => {
        return padding.top + chartHeight * (1 - (price - minPrice) / (maxPrice - minPrice));
    };

    const indexToX = (index) => {
        const visibleIndex = index - startIdx;
        const candleWidth = chartWidth / state.visibleCandles;
        return padding.left + visibleIndex * candleWidth + candleWidth / 2;
    };

    // Draw grid lines
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 1;

    const priceStep = (maxPrice - minPrice) / 8;
    for (let i = 0; i <= 8; i++) {
        const price = minPrice + priceStep * i;
        const y = priceToY(price);

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = '#787b86';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(price.toFixed(2), width - padding.right + 8, y + 4);
    }

    // Draw EMA 20 (draw first so it's behind EMA 10)
    ctx.strokeStyle = '#f48fb1'; // Pink
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started20 = false;
    for (let i = startIdx; i < visibleEndIdx; i++) {
        if (state.ema20[i]) {
            const x = indexToX(i);
            const y = priceToY(state.ema20[i]);
            if (!started20) {
                ctx.moveTo(x, y);
                started20 = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
    }
    ctx.stroke();

    // Draw EMA 10
    ctx.strokeStyle = '#64b5f6'; // Blue
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started10 = false;
    for (let i = startIdx; i < visibleEndIdx; i++) {
        if (state.ema10[i]) {
            const x = indexToX(i);
            const y = priceToY(state.ema10[i]);
            if (!started10) {
                ctx.moveTo(x, y);
                started10 = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
    }
    ctx.stroke();

    // Draw candlesticks
    const candleWidth = chartWidth / state.visibleCandles;
    const bodyWidth = candleWidth * 0.7;

    for (let i = startIdx; i < visibleEndIdx; i++) {
        const x = indexToX(i);
        const open = state.data.open[i];
        const high = state.data.high[i];
        const low = state.data.low[i];
        const close = state.data.close[i];

        const isGreen = close >= open;
        const color = isGreen ? '#26a69a' : '#ef5350';
        const bgColor = isGreen ? 'rgba(38, 166, 154, 0.15)' : 'rgba(239, 83, 80, 0.15)';

        if (i === state.currentCandleIndex) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(x - candleWidth / 2, padding.top, candleWidth, chartHeight);

            // Hide vertical line on mobile - it's distracting
            if (!isMobileDevice) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(x - candleWidth / 2, padding.top, candleWidth, chartHeight);
            }
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, priceToY(high));
        ctx.lineTo(x, priceToY(low));
        ctx.stroke();

        const bodyTop = priceToY(Math.max(open, close));
        const bodyBottom = priceToY(Math.min(open, close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

        ctx.fillStyle = color;
        ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    }

    // Draw fog of war
    const futureStartX = indexToX(state.currentCandleIndex) + candleWidth / 2;
    if (futureStartX < width - padding.right) {
        ctx.fillStyle = 'rgba(19, 23, 34, 0.95)';
        ctx.fillRect(futureStartX, padding.top, width - padding.right - futureStartX, chartHeight);

        ctx.fillStyle = '#2a2e39';
        ctx.font = '24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        const fogCenter = futureStartX + (width - padding.right - futureStartX) / 2;
        ctx.fillText('? ? ?', fogCenter, height / 2);
    }

    // Draw EMA legend
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64b5f6';
    ctx.fillText('EMA 10', padding.left + 10, padding.top + 15);
    ctx.fillStyle = '#f48fb1';
    ctx.fillText('EMA 20', padding.left + 70, padding.top + 15);

    // Draw position levels
    if (state.currentPosition) {
        const pos = state.currentPosition;

        // Entry line
        const entryY = priceToY(pos.entryPrice);
        ctx.strokeStyle = '#2962ff';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, entryY);
        ctx.lineTo(width - padding.right, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#2962ff';
        ctx.fillRect(width - padding.right + 4, entryY - 10, 72, 20);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`▶ ${pos.entryPrice.toFixed(2)}`, width - padding.right + 8, entryY + 4);

        // Stop loss
        const slY = priceToY(pos.stopLoss);
        ctx.strokeStyle = '#ef5350';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, slY);
        ctx.lineTo(width - padding.right, slY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Stop loss label with drag hint
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(width - padding.right + 4, slY - 10, 72, 20);
        ctx.fillStyle = 'white';
        ctx.fillText(`SL ${pos.stopLoss.toFixed(2)}`, width - padding.right + 8, slY + 4);

        // Draw drag handle indicator on the line
        ctx.fillStyle = '#ef5350';
        ctx.beginPath();
        ctx.arc(padding.left + 30, slY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↕', padding.left + 30, slY + 3);
        ctx.textAlign = 'left';
    }

    // If in stop loss mode, show current price line and hint
    if (state.tradeMode && state.tradeStep === 'stoploss') {
        const currentPrice = state.data.close[state.currentCandleIndex];
        const entryY = priceToY(currentPrice);

        // Entry price line
        ctx.strokeStyle = '#2962ff';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, entryY);
        ctx.lineTo(width - padding.right, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Highlight zone where stop can be placed
        if (state.pendingTrade.direction === 'long') {
            // Highlight below
            ctx.fillStyle = 'rgba(239, 83, 80, 0.1)';
            ctx.fillRect(padding.left, entryY, chartWidth, chartHeight - entryY + padding.top);
        } else {
            // Highlight above
            ctx.fillStyle = 'rgba(239, 83, 80, 0.1)';
            ctx.fillRect(padding.left, padding.top, chartWidth, entryY - padding.top);
        }
    }

    // If in confirm mode, show pending entry and stop loss lines
    if (state.tradeMode && state.tradeStep === 'confirm' && state.pendingTrade) {
        const currentPrice = state.data.close[state.currentCandleIndex];
        const tp = state.pendingTrade;

        // Entry line
        const entryY = priceToY(currentPrice);
        ctx.strokeStyle = '#2962ff';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, entryY);
        ctx.lineTo(width - padding.right, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#2962ff';
        ctx.fillRect(width - padding.right + 4, entryY - 10, 72, 20);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`▶ ${currentPrice.toFixed(2)}`, width - padding.right + 8, entryY + 4);

        // Pending stop loss line
        const slY = priceToY(tp.stopLoss);
        ctx.strokeStyle = '#ef5350';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, slY);
        ctx.lineTo(width - padding.right, slY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef5350';
        ctx.fillRect(width - padding.right + 4, slY - 10, 72, 20);
        ctx.fillStyle = 'white';
        ctx.fillText(`SL ${tp.stopLoss.toFixed(2)}`, width - padding.right + 8, slY + 4);
    }

    // Store chart metrics
    state.chartMetrics = {
        padding,
        chartWidth,
        chartHeight,
        minPrice,
        maxPrice,
        priceToY,
        indexToX,
        yToPrice: (y) => minPrice + (1 - (y - padding.top) / chartHeight) * (maxPrice - minPrice),
    };

    elements.luckySprite.style.display = 'block';
}

function updateLucky() {
    if (!state.data || !state.chartMetrics) return;

    const { indexToX, priceToY, padding, chartHeight } = state.chartMetrics;
    const currentPrice = state.data.close[state.currentCandleIndex];

    const x = indexToX(state.currentCandleIndex);
    let y = priceToY(currentPrice);

    // Keep Lucky within visible chart area (more aggressive clamping)
    const spriteHeight = isMobileDevice ? 48 : 64;
    const minY = padding.top + spriteHeight + 20; // Don't go above chart
    const maxY = padding.top + chartHeight - 20; // Stay within chart area
    y = Math.max(minY, Math.min(maxY, y));

    elements.luckySprite.style.left = (x - spriteHeight/2) + 'px';
    elements.luckySprite.style.bottom = (elements.chartContainer.clientHeight - y + 10) + 'px';

    if (state.isPlaying) {
        elements.luckySprite.classList.add('running');
    } else {
        elements.luckySprite.classList.remove('running');
    }
}

function updateHUD() {
    const hudEl = elements.gameHUD;

    let positionHtml = '';
    if (state.currentPosition) {
        const pos = state.currentPosition;
        const currentPrice = state.data.close[state.currentCandleIndex];
        let pnl;
        if (pos.direction === 'long') {
            pnl = pos.positionSize * ((currentPrice - pos.entryPrice) / pos.entryPrice);
        } else {
            pnl = pos.positionSize * ((pos.entryPrice - currentPrice) / pos.entryPrice);
        }

        positionHtml = `
            <div class="hud-position ${pos.direction} ${pnl >= 0 ? 'profit' : 'loss'}">
                <span class="pos-label">${pos.direction.toUpperCase()}</span>
                <span class="pos-pnl">${pnl >= 0 ? '+' : ''}$${formatMoney(Math.abs(pnl))}</span>
                <button class="close-position-btn" onclick="manualClosePosition()">
                    ${pos.direction === 'long' ? 'SELL' : 'BUY TO COVER'}
                </button>
            </div>
            <div class="pos-hint-text">Drag stop loss line to adjust</div>
        `;
    } else if (state.data && !state.tradeMode) {
        positionHtml = `<div class="hud-hint">[SPACE] Open Trade</div>`;
    }

    hudEl.innerHTML = `
        <div class="hud-balance">
            <span class="balance-label">BALANCE</span>
            <span class="balance-amount">$${state.balance.toLocaleString()}</span>
        </div>
        ${positionHtml}
        <div class="hud-stats">
            <span class="stat ${state.totalPnL >= 0 ? 'positive' : 'negative'}">
                P/L: ${state.totalPnL >= 0 ? '+' : ''}$${formatMoney(Math.abs(state.totalPnL))}
            </span>
            <span class="stat">
                Trades: ${state.trades.length}
            </span>
        </div>
    `;
}

function updatePositionDisplay() {
    // Position display is now in HUD
}

function updateUI() {
    updateTickerInfo();
    updateStatsDisplay();
    updateXPBar();
}

function updateTickerInfo() {
    if (!state.data) return;

    const currentPrice = state.data.close[state.currentCandleIndex];
    const prevPrice = state.currentCandleIndex > 0 ? state.data.close[state.currentCandleIndex - 1] : currentPrice;
    const change = ((currentPrice - prevPrice) / prevPrice) * 100;

    elements.currentTicker.textContent = state.ticker;
    elements.currentPrice.textContent = `$${currentPrice.toFixed(2)}`;
    elements.priceChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    elements.priceChange.className = change >= 0 ? 'positive' : 'negative';
}

function updateStatsDisplay() {
    elements.balance.textContent = state.balance.toLocaleString();
    elements.totalPnl.textContent = `${state.totalPnL >= 0 ? '+' : ''}$${Math.abs(state.totalPnL).toFixed(0)}`;
    elements.totalPnl.className = state.totalPnL >= 0 ? 'positive' : 'negative';
    elements.level.textContent = state.level;

    const wins = state.trades.filter(t => t.pnl > 0).length;
    const total = state.trades.length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
    elements.winRate.textContent = `${winRate}%`;
}

function updateFooter() {
    if (!state.data) return;

    const idx = state.currentCandleIndex;
    elements.infoOpen.textContent = state.data.open[idx].toFixed(2);
    elements.infoHigh.textContent = state.data.high[idx].toFixed(2);
    elements.infoLow.textContent = state.data.low[idx].toFixed(2);
    elements.infoClose.textContent = state.data.close[idx].toFixed(2);
    elements.infoVolume.textContent = formatVolume(state.data.volume[idx]);

    const date = new Date(state.data.timestamps[idx]);
    elements.currentDate.textContent = date.toLocaleString();
    elements.candleIndex.textContent = `Candle ${idx + 1}`;
}

function formatVolume(vol) {
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
    return vol.toFixed(0);
}

function handleMouseMove(e) {
    if (!state.data || !state.chartMetrics) return;

    const rect = elements.chartContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { yToPrice, priceToY, padding } = state.chartMetrics;

    // Handle stop loss dragging
    if (state.isDraggingStopLoss && state.currentPosition) {
        const newStopPrice = yToPrice(y);
        updateStopLoss(newStopPrice);

        // Update tooltip while dragging
        elements.priceTooltip.innerHTML = `SL: $${newStopPrice.toFixed(2)}`;
        elements.priceTooltip.style.left = (x + 15) + 'px';
        elements.priceTooltip.style.top = (y - 10) + 'px';
        elements.priceTooltip.style.opacity = '1';
        return;
    }

    // Check if hovering near stop loss line - change cursor
    if (state.currentPosition && !state.tradeMode) {
        const slY = priceToY(state.currentPosition.stopLoss);
        if (Math.abs(y - slY) < 15) {
            elements.chartContainer.style.cursor = 'ns-resize';
        } else {
            elements.chartContainer.style.cursor = 'crosshair';
        }
    }

    elements.crosshairX.style.left = x + 'px';
    elements.crosshairX.style.opacity = '0.5';
    elements.crosshairY.style.top = y + 'px';
    elements.crosshairY.style.opacity = '0.5';

    if (x > padding.left && x < elements.chartContainer.clientWidth - padding.right &&
        y > padding.top && y < elements.chartContainer.clientHeight - padding.bottom) {

        const price = yToPrice(y);

        // If in stop loss mode, show more info
        if (state.tradeMode && state.tradeStep === 'stoploss') {
            const currentPrice = state.data.close[state.currentCandleIndex];
            let stopDistance;
            if (state.pendingTrade.direction === 'long') {
                stopDistance = ((currentPrice - price) / currentPrice * 100).toFixed(2);
            } else {
                stopDistance = ((price - currentPrice) / currentPrice * 100).toFixed(2);
            }
            elements.priceTooltip.innerHTML = `$${price.toFixed(2)}<br><small>Stop: ${stopDistance}%</small>`;
        } else {
            elements.priceTooltip.innerHTML = `$${price.toFixed(2)}`;
        }

        elements.priceTooltip.style.left = (x + 15) + 'px';
        elements.priceTooltip.style.top = (y - 10) + 'px';
        elements.priceTooltip.style.opacity = '1';
    }
}

function handleMouseLeave() {
    elements.crosshairX.style.opacity = '0';
    elements.crosshairY.style.opacity = '0';
    elements.priceTooltip.style.opacity = '0';
    state.isDraggingStopLoss = false;
    elements.chartContainer.style.cursor = 'crosshair';
}

function showTradeResult(trade) {
    const isWin = trade.pnl >= 0;

    let resultText;
    if (trade.result === 'stop') {
        resultText = 'Stop Loss Hit';
    } else if (trade.result === 'end_of_chart') {
        resultText = 'End of Chart (20% of profit taken)';
    } else {
        resultText = 'Closed Manually';
    }

    elements.modalTitle.textContent = isWin ? '🎉 Winner!' : '💔 Stopped Out';
    elements.modalBody.innerHTML = `
        <p>${trade.direction.toUpperCase()} ${trade.ticker}</p>
        <p>Entry: $${trade.entryPrice.toFixed(2)} → Exit: $${trade.exitPrice.toFixed(2)}</p>
        <p>${resultText}</p>
        <div class="result-amount ${isWin ? 'positive' : 'negative'}">
            ${isWin ? '+' : '-'}$${Math.abs(trade.pnl).toFixed(0)}
        </div>
        <p>New Balance: $${state.balance.toLocaleString()}</p>
    `;

    elements.modal.classList.remove('hidden');
}

function closeModal() {
    elements.modal.classList.add('hidden');
}

// In-game error/info modal (non-blocking, dismissible with space/enter)
function showErrorModal(message, title = 'Notice') {
    elements.errorModalTitle.textContent = title;
    elements.errorModalBody.textContent = message;
    elements.errorModal.classList.remove('hidden');
    state.errorModalOpen = true;
}

function closeErrorModal() {
    elements.errorModal.classList.add('hidden');
    state.errorModalOpen = false;
}

function showLoading(show, message = null) {
    elements.loadingOverlay.classList.toggle('hidden', !show);
    if (message && elements.loadingText) {
        elements.loadingText.textContent = message;
    }
}

function exportTrades() {
    if (state.trades.length === 0) {
        showErrorModal('No trades to export yet!', 'Export');
        return;
    }

    const wins = state.trades.filter(t => t.pnl > 0).length;
    const losses = state.trades.filter(t => t.pnl <= 0).length;
    const winRate = ((wins / state.trades.length) * 100).toFixed(1);
    const avgWin = wins > 0 ? state.trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
    const avgLoss = losses > 0 ? state.trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0) / losses : 0;

    let output = `LUCKY'S MARKET RUN - TRADE LOG
================================
Export Date: ${new Date().toISOString().split('T')[0]}
Starting Balance: $100,000
Final Balance: $${state.balance.toLocaleString()}
Total P/L: ${state.totalPnL >= 0 ? '+' : ''}$${state.totalPnL.toFixed(2)}
Total Trades: ${state.trades.length}
Wins: ${wins} | Losses: ${losses}
Win Rate: ${winRate}%
Average Win: $${avgWin.toFixed(2)}
Average Loss: $${avgLoss.toFixed(2)}
Levels Completed: ${state.level}
Max Streak: ${state.maxStreak}

TRADE DETAILS
================================
`;

    state.trades.forEach((trade, index) => {
        const entryDate = trade.entryDate ? new Date(trade.entryDate).toLocaleDateString() : 'N/A';
        const exitDate = trade.exitDate ? new Date(trade.exitDate).toLocaleDateString() : 'N/A';
        const priceChange = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2);
        const outcome = trade.pnl >= 0 ? 'WIN' : 'LOSS';

        output += `
Trade #${index + 1} - ${outcome}
-----------------
Ticker: ${trade.ticker}
Direction: ${trade.direction.toUpperCase()}
Timeframe: ${trade.timeframe}
Entry Date: ${entryDate}
Entry Price: $${trade.entryPrice.toFixed(2)}
Stop Loss: $${trade.stopLoss.toFixed(2)} (${trade.stopPercent?.toFixed(2) || 'N/A'}% from entry)
Risk Amount: $${trade.riskAmount.toFixed(2)} (${trade.riskPercent || 'N/A'}% of balance)
Position Size: $${trade.positionSize.toFixed(2)}
Shares: ${trade.shares.toFixed(2)}
Exit Date: ${exitDate}
Exit Price: $${trade.exitPrice.toFixed(2)}
Price Change: ${priceChange}%
Exit Reason: ${trade.result === 'stop' ? 'Stop Loss Hit' : trade.result === 'end_of_chart' ? 'End of Chart (20% profit)' : 'Manual Close'}
P/L: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnlPercent?.toFixed(2) || 'N/A'}%)
`;
    });

    output += `
================================
NOTES FOR LLM ANALYSIS:
- This is simulated backtesting data from Lucky's Market Run game
- Trades use historical Yahoo Finance data
- Risk-based position sizing: Risk Amount / Stop Distance = Position Size
- End of chart exits only award 20% of unrealized profit
- Use this data to identify patterns in winning vs losing trades
- Consider entry timing, stop placement, and exit strategies
================================
`;

    // Create and download the file
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lucky_trades_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.exportTrades = exportTrades;

// ==================== MOBILE SUPPORT ====================

const mobileElements = {
    controls: null,
    actionBtn: null,
    tradeBtn: null,
    randomBtn: null,
    menuBtn: null
};

function initMobile() {
    mobileElements.controls = document.getElementById('mobile-controls');
    mobileElements.actionBtn = document.getElementById('mobile-action-btn');
    mobileElements.tradeBtn = document.getElementById('mobile-trade-btn');
    mobileElements.randomBtn = document.getElementById('mobile-random-btn');
    mobileElements.menuBtn = document.getElementById('mobile-menu-btn');

    if (!mobileElements.controls) return;

    // Mobile button handlers
    mobileElements.actionBtn?.addEventListener('click', handleMobileAction);
    mobileElements.tradeBtn?.addEventListener('click', handleMobileTrade);
    mobileElements.randomBtn?.addEventListener('click', handleMobileRandom);
    mobileElements.menuBtn?.addEventListener('click', handleMobileMenu);

    // Hold-to-fast-forward on action button
    let holdInterval = null;
    mobileElements.actionBtn?.addEventListener('touchstart', (e) => {
        if (state.tradeMode || state.errorModalOpen) return;
        holdInterval = setInterval(() => {
            if (!state.tradeMode && state.gameStarted) {
                advanceCandle();
            }
        }, 150); // Advance every 150ms while holding
    });
    mobileElements.actionBtn?.addEventListener('touchend', () => {
        if (holdInterval) {
            clearInterval(holdInterval);
            holdInterval = null;
        }
    });
    mobileElements.actionBtn?.addEventListener('touchcancel', () => {
        if (holdInterval) {
            clearInterval(holdInterval);
            holdInterval = null;
        }
    });
}

function handleMobileAction(e) {
    e.preventDefault();
    e.stopPropagation();
    sounds.click();

    if (state.errorModalOpen) {
        closeErrorModal();
        return;
    }

    if (!elements.modal.classList.contains('hidden')) {
        closeModal();
        return;
    }

    if (elements.levelModal && !elements.levelModal.classList.contains('hidden')) {
        closeLevelModal();
        return;
    }

    if (state.tradeMode) {
        // In trade mode, action button confirms current step
        handleMobileTradeConfirm();
        updateMobileUI();
    } else {
        // Not in trade mode - just advance candle
        advanceCandle();
    }
}

function handleMobileTrade(e) {
    e.preventDefault();
    e.stopPropagation();
    sounds.click();

    if (state.tradeMode) {
        exitTradeMode();
    } else if (state.currentPosition) {
        manualClosePosition();
    } else if (state.data) {
        enterTradeMode();
    }

    updateMobileUI();
}

function handleMobileRandom(e) {
    e.preventDefault();
    e.stopPropagation();
    sounds.click();
    randomJump();
}

function handleMobileMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    sounds.click();

    const menuHtml = `
        <h2>Menu</h2>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
            <button class="trade-option" onclick="exportTrades(); closeModal();">
                <span>📤</span> Export Trades
            </button>
            <button class="trade-option" onclick="document.getElementById('music-toggle').click(); closeModal();">
                <span>🎵</span> Toggle Music
            </button>
            <button class="trade-option" onclick="document.getElementById('sound-toggle').click(); closeModal();">
                <span>🔊</span> Toggle Sound
            </button>
        </div>
        <button id="modal-close-btn" onclick="closeModal()">Close</button>
    `;

    elements.modalBody.innerHTML = menuHtml;
    elements.modal.classList.remove('hidden');
}

function handleMobileTradeConfirm() {
    switch (state.tradeStep) {
        case 'direction':
            selectDirection('long');
            break;
        case 'risk':
            selectRisk(1);
            break;
        case 'stoploss':
            // User needs to tap on chart - show hint
            break;
        case 'confirm':
            placeTrade();
            updateMobileUI();
            break;
    }
}

function updateMobileUI() {
    if (!mobileElements.actionBtn) return;

    const actionIcon = mobileElements.actionBtn.querySelector('.btn-icon');
    const actionLabel = mobileElements.actionBtn.querySelector('.btn-label');
    const tradeIcon = mobileElements.tradeBtn?.querySelector('.btn-icon');
    const tradeLabel = mobileElements.tradeBtn?.querySelector('.btn-label');

    if (state.tradeMode) {
        switch (state.tradeStep) {
            case 'direction':
                actionIcon.textContent = '📈';
                actionLabel.textContent = 'Long';
                break;
            case 'risk':
                actionIcon.textContent = '💰';
                actionLabel.textContent = '1% Risk';
                break;
            case 'stoploss':
                actionIcon.textContent = '👆';
                actionLabel.textContent = 'Tap Chart';
                break;
            case 'confirm':
                actionIcon.textContent = '✅';
                actionLabel.textContent = 'Confirm';
                break;
        }
    } else if (state.currentPosition) {
        actionIcon.textContent = '▶️';
        actionLabel.textContent = 'Next';
    } else {
        actionIcon.textContent = '📊';
        actionLabel.textContent = 'Trade';
    }

    if (tradeIcon && tradeLabel) {
        if (state.tradeMode) {
            tradeIcon.textContent = '❌';
            tradeLabel.textContent = 'Cancel';
        } else if (state.currentPosition) {
            tradeIcon.textContent = '💵';
            tradeLabel.textContent = 'Close';
        } else {
            tradeIcon.textContent = '📈';
            tradeLabel.textContent = 'Trade';
        }
    }
}

// Touch events for chart (stop loss placement and dragging)
function initMobileTouchEvents() {
    if (!elements.canvas) return;

    // Add to canvas directly for better touch handling
    elements.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    elements.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    elements.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

let touchStartY = 0;
let isTouchDragging = false;
let lastPinchDistance = 0;
let isPinching = false;
let isDraggingPriceAxis = false;
let priceAxisDragStartY = 0;
let priceAxisStartScale = 1;

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleTouchStart(e) {
    if (!state.gameStarted) return;

    // Handle pinch start (two fingers)
    if (e.touches.length === 2) {
        isPinching = true;
        lastPinchDistance = getTouchDistance(e.touches);
        e.preventDefault();
        return;
    }

    const touch = e.touches[0];
    touchStartY = touch.clientY;
    isTouchDragging = false;

    const rect = elements.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Check if touching price axis (right side) for vertical scaling
    const priceAxisStart = rect.width - 80; // padding.right = 80
    if (x > priceAxisStart) {
        isDraggingPriceAxis = true;
        priceAxisDragStartY = y;
        priceAxisStartScale = state.verticalScale;
        e.preventDefault();
        return;
    }

    // Check if touching stop loss line for dragging (larger touch target on mobile)
    if (state.currentPosition && state.chartMetrics) {
        const slY = state.chartMetrics.priceToY(state.currentPosition.stopLoss);
        if (Math.abs(y - slY) < 50) { // 50px touch target
            state.isDraggingStopLoss = true;
            isTouchDragging = true;
            e.preventDefault();
            e.stopPropagation();
        }
    }
}

function handleTouchMove(e) {
    if (!state.gameStarted) return;

    // Handle pinch zoom (two fingers)
    if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        const newDistance = getTouchDistance(e.touches);
        const delta = newDistance - lastPinchDistance;

        // Adjust visible candles based on pinch, keeping current candle centered
        if (Math.abs(delta) > 10) {
            const oldVisibleCandles = state.visibleCandles;

            if (delta > 0) {
                // Pinch out - zoom in (fewer candles)
                state.visibleCandles = Math.max(15, state.visibleCandles - 5);
            } else {
                // Pinch in - zoom out (more candles)
                state.visibleCandles = Math.min(120, state.visibleCandles + 5);
            }

            // Adjust visibleStartIndex to keep current candle in view
            // We want the current candle to stay roughly in the same position
            const candleChange = state.visibleCandles - oldVisibleCandles;
            // Keep current candle near the right side (where Lucky is)
            const buffer = Math.floor(state.visibleCandles * 0.2); // 20% from right edge
            state.visibleStartIndex = Math.max(0, state.currentCandleIndex - state.visibleCandles + buffer);

            lastPinchDistance = newDistance;
            render();
        }
        return;
    }

    const touch = e.touches[0];
    const rect = elements.canvas.getBoundingClientRect();
    const y = touch.clientY - rect.top;

    // Handle price axis dragging for vertical scale
    if (isDraggingPriceAxis) {
        e.preventDefault();
        const deltaY = y - priceAxisDragStartY;
        // Drag down = compress (lower scale), drag up = expand (higher scale)
        const scaleDelta = deltaY * 0.005;
        state.verticalScale = Math.max(0.1, Math.min(2.0, priceAxisStartScale + scaleDelta));
        render();
        return;
    }

    if (state.isDraggingStopLoss && state.currentPosition && state.chartMetrics) {
        e.preventDefault();
        e.stopPropagation();
        const newStopPrice = state.chartMetrics.yToPrice(y);
        updateStopLoss(newStopPrice);
        isTouchDragging = true;
    }
}

function handleTouchEnd(e) {
    if (!state.gameStarted) return;

    // Reset price axis drag state
    if (isDraggingPriceAxis) {
        isDraggingPriceAxis = false;
        return;
    }

    // Reset pinch state
    if (isPinching) {
        isPinching = false;
        lastPinchDistance = 0;
        return;
    }

    const touch = e.changedTouches[0];
    const rect = elements.canvas.getBoundingClientRect();
    const y = touch.clientY - rect.top;

    if (state.isDraggingStopLoss) {
        state.isDraggingStopLoss = false;
        isTouchDragging = false;
        return;
    }

    if (isTouchDragging) {
        isTouchDragging = false;
        return;
    }

    // Tap detection - set stop loss
    const deltaY = Math.abs(touch.clientY - touchStartY);
    if (deltaY < 20 && state.tradeMode && state.tradeStep === 'stoploss' && state.chartMetrics) {
        const clickedPrice = state.chartMetrics.yToPrice(y);
        const entryPrice = state.data.close[state.currentCandleIndex];

        if (state.pendingTrade.direction === 'long') {
            if (clickedPrice >= entryPrice) {
                showErrorModal('Stop loss must be BELOW current price for a long position', 'Invalid Stop Loss');
                return;
            }
        } else {
            if (clickedPrice <= entryPrice) {
                showErrorModal('Stop loss must be ABOVE current price for a short position', 'Invalid Stop Loss');
                return;
            }
        }

        sounds.click();
        selectStopLoss(clickedPrice);
        updateMobileUI();
    }

    isTouchDragging = false;
}

// Initialize mobile on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobile);
} else {
    initMobile();
}

// Initialize splash screen
initSplash();
