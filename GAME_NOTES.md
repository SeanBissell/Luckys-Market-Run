# Lucky's Market Run - Development Notes

## Overview
A backtesting video game honoring Lucky, a 17-year-old grey Lhasa Apso-Poodle mix. Players trade historical stock data with a TradingView-style interface while Lucky (a pixel art dog sprite) runs along the candlestick charts.

## Architecture

### Files
- `game/index.html` - Main HTML structure
- `game/styles.css` - TradingView-inspired dark theme CSS
- `game/game.js` - All game logic (~1600 lines)
- `game/lucky.svg` - Pixel art SVG of Lucky (grey fluffy dog)
- `game/symbols.txt` - 6606 stock symbols for random selection
- `backend/` - FastAPI backend with yfinance for stock data

### Backend API
- Base URL: `http://localhost:8000/api/v1/stocks`
- Endpoint: `/{ticker}/history?period={period}&interval={interval}`
- CORS configured for localhost ports: 9876, 3000, 5173, 8080

### Running the Game
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start game server: `cd game && python -m http.server 9876`
3. Open: `http://localhost:9876`

## Key Game Mechanics

### Position Sizing (Risk-Based)
```
Position Size = Risk Amount / Stop Distance %
Shares = Position Size / Entry Price
```
- User selects risk % of balance (default 1%)
- User clicks on chart to set stop loss
- Position size is calculated so max loss = risk amount

### P/L Calculation
```javascript
// Long position
pctChange = (exitPrice - entryPrice) / entryPrice
pnl = positionSize * pctChange

// Short position
pctChange = (entryPrice - exitPrice) / entryPrice
pnl = positionSize * pctChange
```

### End of Chart Handling
- If position is open at end of chart: only 20% of profit awarded (full loss if losing)
- Prevents users from "winning" by riding to the end

### Level System
- Each stock is a "level"
- When chart ends, auto-advances to next random stock
- `isLoadingLevel` flag prevents spam when holding arrow key

## State Management

### Key State Properties
```javascript
const state = {
    ticker: null,
    timeframe: '1wk',        // Default to weekly
    data: null,              // Stock data from API
    ema10: [],               // 10-period EMA
    ema20: [],               // 20-period EMA
    currentCandleIndex: 0,   // Lucky's position (fog of war hides future)
    balance: 100000,         // Starting balance
    totalPnL: 0,
    trades: [],              // Trade history for export
    currentPosition: null,   // Active trade
    tradeMode: false,        // Trade panel open
    tradeStep: 'direction',  // direction -> risk -> stoploss -> confirm
    level: 1,
    isLoadingLevel: false,   // Prevents level spam
};
```

### Trade Flow
1. SPACE - Open trade panel
2. SPACE (or S) - Select direction (Long default, S for Short)
3. SPACE (or 1-9) - Select risk % (1% default)
4. Click on chart - Set stop loss
5. SPACE - Confirm trade

## Timeframe Drilling

### Configuration
```javascript
const TIMEFRAME_CONFIG = {
    '1wk': { period: '5y', label: 'Weekly', drillTo: '1d' },
    '1d': { period: '2y', label: 'Daily', drillTo: '1h' },
    '1h': { period: '3mo', label: 'Hourly', drillTo: '15m' },
    '15m': { period: '1mo', label: '15 Min', drillTo: '5m' },
    '5m': { period: '5d', label: '5 Min' },
};
```

### Timestamp Preservation
When changing timeframes, the current candle's timestamp is preserved:
```javascript
async function loadData(targetTimestamp = null) {
    // If targetTimestamp provided, find closest matching candle
    // Otherwise, start at random position (for new stocks)
}
```

### Data Availability
- Hourly: ~3 months back
- 15m: ~1 month back
- 5m: ~5 days back
- If data unavailable for timestamp, shows alert and reverts to previous timeframe

## UI Components

### Trade Panel States
- `direction` - Choose Long/Short
- `risk` - Choose risk % (0.5% to 25%)
- `stoploss` - Click on chart to set stop
- `confirm` - Review and confirm trade

### HUD Elements
- Balance display (top-left)
- Open position with P/L and SELL/BUY TO COVER button
- Stats (total P/L, trade count)

### Keyboard Shortcuts
- SPACE - Trade/Next candle/Confirm dialogs
- Arrow Right/Left - Navigate candles
- Arrow Up/Down - Drill timeframes
- R - Random jump
- C - Close position
- ESC - Cancel/Go back

## Important Fixes Applied

### Event Propagation
Trade panel buttons need `event.stopPropagation()` to prevent chart clicks:
```javascript
onclick="selectDirection('long', event)"
```

### No Alert on Failed Fetch
`fetchStockData()` returns null silently - no alert popup when stocks fail to load.

### Draggable Stop Loss
Stop loss line can be dragged both directions (just can't cross current price).

### Modal Spacebar
Spacebar/Enter closes any open modal (trade results, level complete).

## Export Feature
Exports trade log as text file with:
- Summary stats (balance, P/L, win rate)
- Per-trade details (ticker, dates, prices, stop, risk, P/L)
- Notes for LLM analysis

## CSS Theme Variables
```css
:root {
    --bg-primary: #131722;
    --bg-secondary: #1e222d;
    --bg-tertiary: #2a2e39;
    --text-primary: #d1d4dc;
    --text-secondary: #787b86;
    --accent-blue: #2962ff;
    --green: #26a69a;
    --red: #ef5350;
}
```

## Lucky Sprite
- 64x64 pixel art SVG
- Grey fluffy dog with floppy ears
- Animations: running, jumping, happy
- Also used as 20x20 icon in header logo

## Future Enhancement Ideas
- Sound effects
- Achievements/badges
- Leaderboard
- More detailed trade analytics
- Pattern recognition hints
- Tutorial mode
