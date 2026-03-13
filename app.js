const { createApp } = Vue;

const STARTING_BALANCE = 1200;
const START_REWARD = 200;
const SAVE_SCHEMA_VERSION = 1;
const AUTO_SAVE_KEY = "richweb.monopoly-lite.auto-save";
const MAX_LOG_ENTRIES = 18;
const PLAYER_COLORS = ["#d95f39", "#2a9d8f", "#355070", "#ffb703"];
const PLAYER_AVATARS = ["🦊", "🐼", "🐳", "🦉"];
const TILE_POSITIONS = Array.from({ length: 16 }, (_, index) => `tile-pos-${index}`);
const formatter = new Intl.NumberFormat("zh-TW");
const MOVEMENT_STEP_DELAY = 190;
const MOVEMENT_SETTLE_DELAY = 120;

const CHANCE_CARDS = [
  {
    id: "sponsor-bonus",
    title: "展演贊助到帳",
    description: "一筆城市文化贊助順利核銷。",
    effectType: "money",
    payload: { amount: 180 },
    tone: "cash",
  },
  {
    id: "repair-overrun",
    title: "設備維修超支",
    description: "臨時設備故障，必須立刻支付修繕費。",
    effectType: "money",
    payload: { amount: -120 },
    tone: "danger",
  },
  {
    id: "move-forward-3",
    title: "風向助推",
    description: "市場聲量上升，向前推進 3 格。",
    effectType: "move-relative",
    payload: { steps: 3 },
    tone: "turn",
  },
  {
    id: "move-back-2",
    title: "錯估排程",
    description: "專案延後，倒退 2 格重新調整。",
    effectType: "move-relative",
    payload: { steps: -2 },
    tone: "danger",
  },
  {
    id: "go-start",
    title: "返航重整",
    description: "立刻回到啟程廣場，重新整備資源。",
    effectType: "move-to",
    payload: { target: 0, label: "啟程廣場" },
    tone: "cash",
  },
  {
    id: "go-moonlight",
    title: "夜光特展",
    description: "前往月映大道，爭取新的曝光。",
    effectType: "move-to",
    payload: { target: 11, label: "月映大道" },
    tone: "turn",
  },
  {
    id: "tourism-dividend",
    title: "觀光分紅",
    description: "本季觀光收益回流，立即獲得現金。",
    effectType: "money",
    payload: { amount: 90 },
    tone: "cash",
  },
  {
    id: "compliance-fee",
    title: "合規審查費",
    description: "補件與審查成本增加，支付一筆行政費。",
    effectType: "money",
    payload: { amount: -70 },
    tone: "danger",
  },
];

const CHANCE_CARD_IDS = new Set(CHANCE_CARDS.map((card) => card.id));

function createProperty({ id, name, price, baseRent, accent, district, upgradeCostBase }) {
  return {
    id,
    type: "property",
    name,
    price,
    accent,
    district,
    level: 0,
    maxLevel: 3,
    upgradeCostBase,
    rentByLevel: [
      baseRent,
      Math.round(baseRent * 1.7),
      Math.round(baseRent * 2.55),
      Math.round(baseRent * 3.65),
    ],
  };
}

const BOARD_TEMPLATE = [
  { id: "start", type: "start", name: "啟程廣場", description: "經過或停在此格可領取起點薪資。", accent: "#ffb703" },
  createProperty({ id: "coral-lane", name: "珊瑚巷", price: 160, baseRent: 35, accent: "#f28482", district: "海風區", upgradeCostBase: 70 }),
  { id: "tide-card", type: "chance", name: "潮汐卡", description: "抽取一張財運事件。", accent: "#2a9d8f" },
  createProperty({ id: "maple-street", name: "楓影街", price: 200, baseRent: 45, accent: "#bc6c25", district: "海風區", upgradeCostBase: 85 }),
  { id: "city-tax", type: "tax", name: "城市稅", amount: 100, description: "支付城市維護費。", accent: "#d95d39" },
  createProperty({ id: "neon-plaza", name: "霓虹廣場", price: 240, baseRent: 55, accent: "#43aa8b", district: "藝文區", upgradeCostBase: 95 }),
  { id: "coffee-break", type: "rest", name: "咖啡時光", description: "短暫休息，沒有額外事件。", accent: "#577590" },
  createProperty({ id: "sky-mall", name: "天際商場", price: 280, baseRent: 65, accent: "#4d908e", district: "藝文區", upgradeCostBase: 110 }),
  { id: "fortune-wave", type: "chance", name: "黃金機會", description: "市場風向改變，立即結算。", accent: "#2a9d8f" },
  createProperty({ id: "harbor-walk", name: "港灣步道", price: 320, baseRent: 75, accent: "#277da1", district: "商貿區", upgradeCostBase: 125 }),
  { id: "free-lounge", type: "rest", name: "自由休憩站", description: "沒有收費，喘口氣再出發。", accent: "#577590" },
  createProperty({ id: "moonlight-ave", name: "月映大道", price: 360, baseRent: 85, accent: "#8ecae6", district: "商貿區", upgradeCostBase: 145 }),
  { id: "venture-card", type: "chance", name: "投資風向", description: "資本市場波動，資金會增加或減少。", accent: "#2a9d8f" },
  createProperty({ id: "tech-park", name: "雲谷科技園", price: 400, baseRent: 95, accent: "#219ebc", district: "天際區", upgradeCostBase: 165 }),
  { id: "service-fee", type: "tax", name: "維護費", amount: 140, description: "支付建物維護與清潔費。", accent: "#d95d39" },
  createProperty({ id: "crown-center", name: "冠冕中心", price: 460, baseRent: 110, accent: "#023047", district: "天際區", upgradeCostBase: 190 }),
];

function cloneBoard() {
  return BOARD_TEMPLATE.map((space) => ({
    ...space,
    ownerId: null,
    level: space.type === "property" ? 0 : space.level,
    rentByLevel: Array.isArray(space.rentByLevel) ? [...space.rentByLevel] : space.rentByLevel,
  }));
}

function formatCurrency(amount) {
  return `$${formatter.format(amount)}`;
}

function colorWithAlpha(hexColor, alpha) {
  if (typeof hexColor !== "string") {
    return `rgba(18, 50, 74, ${alpha})`;
  }

  const normalized = hexColor.replace("#", "").trim();
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(18, 50, 74, ${alpha})`;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function shuffleCards(cards) {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function currentRentForSpace(space) {
  if (!space || space.type !== "property") {
    return space?.rent ?? 0;
  }

  const level = Math.min(space.level ?? 0, space.rentByLevel.length - 1);
  return space.rentByLevel[level];
}

function nextUpgradeCostForSpace(space) {
  if (!space || space.type !== "property" || space.level >= space.maxLevel) {
    return null;
  }

  return space.upgradeCostBase * (space.level + 1);
}

function resetPropertyState(space) {
  if (!space || space.type !== "property") {
    return;
  }

  space.ownerId = null;
  space.level = 0;
}

function randomDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function defaultNames() {
  return ["曜石", "流星", "遠洋", "赤霞"];
}

function createChanceDeck() {
  return shuffleCards(CHANCE_CARDS.map((card) => ({
    ...card,
    payload: { ...card.payload },
  })));
}

function decoratePlayer(player, index = 0) {
  return {
    ...player,
    shortName: player.shortName || player.name?.slice(0, 1) || "?",
    color: player.color || PLAYER_COLORS[index % PLAYER_COLORS.length],
    avatar: player.avatar || PLAYER_AVATARS[index % PLAYER_AVATARS.length],
  };
}

function validateSaveCard(card) {
  return isRecord(card) && typeof card.id === "string" && CHANCE_CARD_IDS.has(card.id);
}

function validateSavePayload(payload) {
  if (!isRecord(payload)) {
    return { ok: false, error: "存檔內容不是有效的 JSON 物件。" };
  }

  if (payload.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return { ok: false, error: "存檔版本不相容，無法載入。" };
  }

  if (!isRecord(payload.settings) || !isRecord(payload.game)) {
    return { ok: false, error: "存檔缺少設定或遊戲資料。" };
  }

  const { settings, game } = payload;

  if (!Number.isInteger(settings.playerCount) || settings.playerCount < 2 || settings.playerCount > 4) {
    return { ok: false, error: "存檔中的玩家人數無效。" };
  }

  if (!Array.isArray(settings.setupNames) || settings.setupNames.length < settings.playerCount) {
    return { ok: false, error: "存檔中的玩家名稱設定不完整。" };
  }

  if (!Array.isArray(game.players) || game.players.length < 2 || game.players.length > 4) {
    return { ok: false, error: "存檔中的玩家資料無效。" };
  }

  const playerIds = new Set();
  for (const player of game.players) {
    if (!isRecord(player) || typeof player.id !== "string" || typeof player.name !== "string") {
      return { ok: false, error: "存檔中的玩家資料格式錯誤。" };
    }

    if (!isFiniteNumber(player.money) || !Number.isInteger(player.position) || player.position < 0 || player.position >= BOARD_TEMPLATE.length) {
      return { ok: false, error: "存檔中的玩家數值資料無效。" };
    }

    playerIds.add(player.id);
  }

  if (!Array.isArray(game.board) || game.board.length !== BOARD_TEMPLATE.length) {
    return { ok: false, error: "存檔中的棋盤資料不完整。" };
  }

  for (let index = 0; index < BOARD_TEMPLATE.length; index += 1) {
    const template = BOARD_TEMPLATE[index];
    const item = game.board[index];

    if (!isRecord(item) || item.id !== template.id || item.type !== template.type) {
      return { ok: false, error: "存檔中的棋盤格資料不相容。" };
    }

    if (item.ownerId !== null && item.ownerId !== undefined && !playerIds.has(item.ownerId)) {
      return { ok: false, error: "存檔中的地產持有人資料無效。" };
    }

    if (template.type === "property") {
      if (!Number.isInteger(item.level) || item.level < 0 || item.level > template.maxLevel) {
        return { ok: false, error: "存檔中的地產等級資料無效。" };
      }
    }
  }

  if (!Number.isInteger(game.currentPlayerIndex) || game.currentPlayerIndex < 0 || game.currentPlayerIndex >= game.players.length) {
    return { ok: false, error: "存檔中的目前回合索引無效。" };
  }

  if (game.currentRoll !== null) {
    if (!isRecord(game.currentRoll) || !Number.isInteger(game.currentRoll.diceA) || !Number.isInteger(game.currentRoll.diceB) || !Number.isInteger(game.currentRoll.total)) {
      return { ok: false, error: "存檔中的骰子資料無效。" };
    }
  }

  if (game.pendingAction !== null && !isRecord(game.pendingAction)) {
    return { ok: false, error: "存檔中的待處理動作資料無效。" };
  }

  if (!Array.isArray(game.chanceDeck) || !Array.isArray(game.chanceDiscard)) {
    return { ok: false, error: "存檔中的牌堆資料無效。" };
  }

  const seenCardIds = new Set();
  for (const card of [...game.chanceDeck, ...game.chanceDiscard]) {
    if (!validateSaveCard(card)) {
      return { ok: false, error: "存檔中的卡牌資料無效。" };
    }

    if (seenCardIds.has(card.id)) {
      return { ok: false, error: "存檔中的卡牌資料重複。" };
    }

    seenCardIds.add(card.id);
  }

  if (seenCardIds.size !== CHANCE_CARDS.length) {
    return { ok: false, error: "存檔中的牌堆與棄牌堆資料不完整。" };
  }

  if (game.lastDrawnCard !== null && !validateSaveCard(game.lastDrawnCard)) {
    return { ok: false, error: "存檔中的最近抽牌資料無效。" };
  }

  if (game.winnerId !== null && game.winnerId !== undefined && !playerIds.has(game.winnerId)) {
    return { ok: false, error: "存檔中的勝利者資料無效。" };
  }

  if (!Array.isArray(game.logEntries)) {
    return { ok: false, error: "存檔中的事件紀錄資料無效。" };
  }

  return { ok: true, value: deepCopy(payload) };
}

createApp({
  data() {
    return {
      playerCount: 2,
      setupNames: defaultNames(),
      startingBalance: STARTING_BALANCE,
      startReward: START_REWARD,
      tilePlacementClasses: TILE_POSITIONS,
      board: cloneBoard(),
      players: [],
      currentPlayerIndex: 0,
      currentRoll: null,
      pendingAction: null,
      chanceDeck: createChanceDeck(),
      chanceDiscard: [],
      lastDrawnCard: null,
      autoSaveMeta: null,
      pendingImport: null,
      isAnimatingMovement: false,
      movingPlayerId: null,
      saveFeedback: {
        text: "",
        tone: "secondary",
      },
      winnerId: null,
      formError: "",
      gameStarted: false,
      logEntries: [
        {
          id: 1,
          tone: "turn",
          message: "設定玩家後即可開始遊戲。",
        },
      ],
    };
  },
  computed: {
    activePlayers() {
      return this.players.filter((player) => !player.bankrupt);
    },
    currentPlayer() {
      return this.players[this.currentPlayerIndex] || null;
    },
    winner() {
      return this.players.find((player) => player.id === this.winnerId) || null;
    },
    currentSpace() {
      if (!this.currentPlayer) {
        return this.board[0];
      }

      return this.board[this.currentPlayer.position];
    },
    currentPlayerProperties() {
      if (!this.currentPlayer) {
        return [];
      }

      return this.board
        .filter((space) => this.isProperty(space) && space.ownerId === this.currentPlayer.id)
        .sort((left, right) => left.price - right.price);
    },
    chanceDeckCount() {
      return this.chanceDeck.length;
    },
    chanceDiscardCount() {
      return this.chanceDiscard.length;
    },
    hasAutoSave() {
      return Boolean(this.autoSaveMeta);
    },
    canRoll() {
      return Boolean(this.gameStarted && !this.winner && !this.isAnimatingMovement && this.currentPlayer && !this.currentPlayer.bankrupt && !this.currentRoll && !this.pendingAction);
    },
    canBuyCurrentProperty() {
      return Boolean(
        !this.isAnimatingMovement &&
        this.pendingAction &&
        this.pendingAction.type === "buy" &&
        this.currentPlayer &&
        this.pendingAction.playerId === this.currentPlayer.id
      );
    },
    canSkipPurchase() {
      return this.canBuyCurrentProperty;
    },
    canEndTurn() {
      return Boolean(this.gameStarted && !this.winner && !this.isAnimatingMovement && this.currentPlayer && this.currentRoll && !this.pendingAction);
    },
    playerStandings() {
      return [...this.players].sort((left, right) => {
        if (left.bankrupt !== right.bankrupt) {
          return left.bankrupt ? 1 : -1;
        }

        return right.money - left.money;
      });
    },
    boardHeadline() {
      if (this.winner) {
        return `${this.winner.name} 奪下富旅之城`;
      }

      if (!this.gameStarted) {
        return "設定玩家，準備開局";
      }

      if (this.isAnimatingMovement) {
        return `${this.currentPlayer.name} 正在前進中`;
      }

      if (this.pendingAction) {
        return `${this.currentPlayer.name} 可購買 ${this.currentSpace.name}`;
      }

      if (this.currentRoll) {
        return `${this.currentPlayer.name} 已完成移動`;
      }

      if (this.currentPlayerProperties.length) {
        return `輪到 ${this.currentPlayer.name} 規劃地產投資`;
      }

      return `輪到 ${this.currentPlayer.name} 行動`;
    },
    boardSubline() {
      if (this.winner) {
        return `所有對手都已破產，${this.winner.name} 成為本局唯一留在場上的玩家。`;
      }

      if (!this.gameStarted) {
        return "這個版本支援 2 到 4 名玩家本機輪流操作，包含買地、收租、稅金與隨機事件。";
      }

      if (this.isAnimatingMovement) {
        return `${this.playerAvatar(this.currentPlayer)} ${this.currentPlayer.name} 正在逐格移動，目的地效果會在停下後自動結算。`;
      }

      if (this.pendingAction) {
        return `當前地產尚未決定是否購入。若略過購買，回合仍可正常結束。`;
      }

      if (this.currentRoll) {
        return `你已擲完骰子並結算落點，確認狀況後即可交棒給下一位玩家。`;
      }

      if (this.currentPlayerProperties.length) {
        return `${this.currentPlayer.name} 目前擁有 ${this.currentPlayerProperties.length} 筆地產，可在擲骰前先規劃升級。`;
      }

      return `${this.currentPlayer.name} 目前位於 ${this.currentSpace.name}，現金 ${formatCurrency(this.currentPlayer.money)}。`;
    },
  },
  mounted() {
    this.refreshAutoSaveMeta();
  },
  methods: {
    formatCurrency,
    formatDateTime,
    isProperty(space) {
      return Boolean(space && space.type === "property");
    },
    playerAvatar(player) {
      return player?.avatar || player?.shortName || "🙂";
    },
    ownerSeatIndex(space) {
      const owner = this.ownerFor(space);
      if (!owner) {
        return "";
      }

      const seatIndex = this.players.findIndex((player) => player.id === owner.id);
      return seatIndex >= 0 ? String(seatIndex) : "";
    },
    tileVisualStyle(space) {
      const owner = this.ownerFor(space);

      return {
        "--tile-accent": space.accent || "#d9d9d9",
        "--tile-owner-color": owner?.color || "rgba(18, 50, 74, 0.12)",
        "--tile-owner-soft": owner ? colorWithAlpha(owner.color, 0.24) : "rgba(18, 50, 74, 0.06)",
        "--tile-owner-glow": owner ? colorWithAlpha(owner.color, 0.22) : "rgba(18, 50, 74, 0.08)",
        "--tile-owner-border": owner ? colorWithAlpha(owner.color, 0.48) : "rgba(18, 50, 74, 0.12)",
      };
    },
    isMovingPlayer(playerId) {
      return Boolean(this.isAnimatingMovement && this.movingPlayerId === playerId);
    },
    isMovingPlayerOnSpace(index) {
      return this.playersOnSpace(index).some((player) => this.isMovingPlayer(player.id));
    },
    tileTypeLabel(type) {
      const labels = {
        start: "Start",
        property: "Property",
        chance: "Chance",
        tax: "Tax",
        rest: "Rest",
      };

      return labels[type] || "Tile";
    },
    currentRent(space) {
      return currentRentForSpace(space);
    },
    nextUpgradeCost(space) {
      return nextUpgradeCostForSpace(space);
    },
    propertyLevelBadge(space) {
      return `Lv ${space.level}`;
    },
    isPropertyMaxed(space) {
      return this.isProperty(space) && space.level >= space.maxLevel;
    },
    chanceCardSummary(card) {
      if (!card) {
        return "尚未抽牌";
      }

      if (card.effectSummary) {
        return card.effectSummary;
      }

      if (card.effectType === "money") {
        const amount = card.payload.amount;
        return amount >= 0 ? `獲得 ${formatCurrency(amount)}` : `支付 ${formatCurrency(Math.abs(amount))}`;
      }

      if (card.effectType === "move-relative") {
        return card.payload.steps >= 0 ? `前進 ${card.payload.steps} 格` : `後退 ${Math.abs(card.payload.steps)} 格`;
      }

      if (card.effectType === "move-to") {
        return `移動至 ${card.payload.label || `第 ${card.payload.target} 格`}`;
      }

      return "立即結算卡牌效果";
    },
    saveFeedbackClass() {
      const tones = {
        success: "alert-success",
        danger: "alert-danger",
        warning: "alert-warning",
        secondary: "alert-secondary",
      };

      return tones[this.saveFeedback.tone] || tones.secondary;
    },
    setSaveFeedback(text, tone = "secondary") {
      this.saveFeedback = { text, tone };
    },
    clearSaveFeedback() {
      this.saveFeedback = { text: "", tone: "secondary" };
    },
    buildSavePayload() {
      return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        metadata: {
          appName: "富旅之城 Monopoly Lite",
        },
        settings: {
          playerCount: this.playerCount,
          startingBalance: this.startingBalance,
          startReward: this.startReward,
          setupNames: deepCopy(this.setupNames),
        },
        game: {
          board: deepCopy(this.board),
          players: deepCopy(this.players),
          currentPlayerIndex: this.currentPlayerIndex,
          currentRoll: deepCopy(this.currentRoll),
          pendingAction: deepCopy(this.pendingAction),
          chanceDeck: deepCopy(this.chanceDeck),
          chanceDiscard: deepCopy(this.chanceDiscard),
          lastDrawnCard: deepCopy(this.lastDrawnCard),
          winnerId: this.winnerId,
          gameStarted: this.gameStarted,
          logEntries: deepCopy(this.logEntries),
        },
      };
    },
    summarizeSavePayload(payload) {
      const players = payload.game.players || [];
      const currentPlayer = players[payload.game.currentPlayerIndex] || null;
      const winner = players.find((player) => player.id === payload.game.winnerId) || null;

      return {
        savedAtText: formatDateTime(payload.savedAt),
        playerText: players.map((player) => player.name).join(" / ") || "尚未開始",
        stateText: winner
          ? `勝利者：${winner.name}`
          : currentPlayer
            ? `目前輪到 ${currentPlayer.name}`
            : "尚未開始",
      };
    },
    refreshAutoSaveMeta() {
      const stored = safeStorageGet(AUTO_SAVE_KEY);
      if (!stored) {
        this.autoSaveMeta = null;
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        const validation = validateSavePayload(parsed);
        if (!validation.ok) {
          safeStorageRemove(AUTO_SAVE_KEY);
          this.autoSaveMeta = null;
          this.setSaveFeedback("偵測到損毀或不相容的自動暫存，已自動清除。", "warning");
          return;
        }

        this.autoSaveMeta = this.summarizeSavePayload(validation.value);
      } catch {
        safeStorageRemove(AUTO_SAVE_KEY);
        this.autoSaveMeta = null;
        this.setSaveFeedback("自動暫存無法解析，已自動清除。", "warning");
      }
    },
    persistAutoSave() {
      const payload = this.buildSavePayload();
      const serialized = JSON.stringify(payload);
      if (!safeStorageSet(AUTO_SAVE_KEY, serialized)) {
        this.setSaveFeedback("無法寫入瀏覽器自動暫存。", "warning");
        return false;
      }

      this.autoSaveMeta = this.summarizeSavePayload(payload);
      return true;
    },
    clearAutoSave(options = {}) {
      safeStorageRemove(AUTO_SAVE_KEY);
      this.autoSaveMeta = null;
      if (!options.silent) {
        this.setSaveFeedback("已清除瀏覽器中的自動暫存。", "secondary");
      }
    },
    triggerImportPicker() {
      this.$refs.saveFileInput?.click();
    },
    prepareImport(payload, sourceLabel, fileName = "") {
      this.pendingImport = {
        payload,
        sourceLabel,
        fileName,
        summary: this.summarizeSavePayload(payload),
      };
      this.setSaveFeedback("已讀取存檔，請確認是否覆蓋目前進度與自動暫存。", "warning");
    },
    cancelPendingImport() {
      this.pendingImport = null;
      this.setSaveFeedback("已取消匯入存檔。", "secondary");
    },
    async handleImportFileChange(event) {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const validation = validateSavePayload(parsed);

        if (!validation.ok) {
          this.setSaveFeedback(validation.error, "danger");
          return;
        }

        this.prepareImport(validation.value, "JSON 存檔", file.name);
      } catch {
        this.setSaveFeedback("無法讀取這個 JSON 檔案，請確認格式是否正確。", "danger");
      } finally {
        event.target.value = "";
      }
    },
    prepareAutoSaveImport() {
      const stored = safeStorageGet(AUTO_SAVE_KEY);
      if (!stored) {
        this.setSaveFeedback("目前沒有可用的自動暫存。", "secondary");
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        const validation = validateSavePayload(parsed);
        if (!validation.ok) {
          this.clearAutoSave({ silent: true });
          this.setSaveFeedback(validation.error, "danger");
          return;
        }

        this.prepareImport(validation.value, "自動暫存");
      } catch {
        this.clearAutoSave({ silent: true });
        this.setSaveFeedback("自動暫存已損毀，無法載入。", "danger");
      }
    },
    applySavePayload(payload, sourceLabel, fileName = "") {
      const snapshot = deepCopy(payload);

      this.playerCount = snapshot.settings.playerCount;
      this.setupNames = defaultNames();
      snapshot.settings.setupNames.slice(0, 4).forEach((name, index) => {
        this.setupNames[index] = name;
      });
      this.startingBalance = snapshot.settings.startingBalance;
      this.startReward = snapshot.settings.startReward;
      this.board = snapshot.game.board;
      this.players = snapshot.game.players.map((player, index) => decoratePlayer(player, index));
      this.currentPlayerIndex = snapshot.game.currentPlayerIndex;
      this.currentRoll = snapshot.game.currentRoll;
      this.pendingAction = snapshot.game.pendingAction;
      this.chanceDeck = snapshot.game.chanceDeck;
      this.chanceDiscard = snapshot.game.chanceDiscard;
      this.lastDrawnCard = snapshot.game.lastDrawnCard;
      this.winnerId = snapshot.game.winnerId;
      this.gameStarted = snapshot.game.gameStarted;
      this.formError = "";
      this.logEntries = snapshot.game.logEntries;
      this.pendingImport = null;
      this.isAnimatingMovement = false;
      this.movingPlayerId = null;

      this.logEvent(`已從${sourceLabel}${fileName ? `「${fileName}」` : ""}載入遊戲進度，並同步更新自動暫存。`, "success");
      this.persistAutoSave();
      this.setSaveFeedback(`已成功載入${sourceLabel}，目前進度與自動暫存都已更新。`, "success");
    },
    confirmPendingImport() {
      if (!this.pendingImport) {
        return;
      }

      const { payload, sourceLabel, fileName } = this.pendingImport;
      this.applySavePayload(payload, sourceLabel, fileName);
    },
    exportSaveFile() {
      if (!this.gameStarted) {
        this.setSaveFeedback("請先開始或載入一局遊戲，再匯出 JSON 存檔。", "secondary");
        return;
      }

      const payload = this.buildSavePayload();
      const timestamp = payload.savedAt.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `monopoly-lite-save-${timestamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      this.setSaveFeedback("已下載目前局面的 JSON 存檔。", "success");
    },
    resetChanceDeckState() {
      this.chanceDeck = createChanceDeck();
      this.chanceDiscard = [];
      this.lastDrawnCard = null;
    },
    ensureChanceDeck() {
      if (this.chanceDeck.length > 0) {
        return true;
      }

      if (this.chanceDiscard.length === 0) {
        return false;
      }

      this.chanceDeck = shuffleCards(this.chanceDiscard.map((card) => ({
        ...card,
        payload: { ...card.payload },
      })));
      this.chanceDiscard = [];
      this.logEvent("機會牌堆已抽空，棄牌堆重新洗牌後回到牌堆。", "turn");
      return true;
    },
    drawChanceCard() {
      if (!this.ensureChanceDeck()) {
        return null;
      }

      const card = this.chanceDeck.pop();
      return card ? { ...card, payload: { ...card.payload } } : null;
    },
    discardChanceCard(card) {
      if (!card) {
        return;
      }

      this.chanceDiscard.unshift({
        ...card,
        effectSummary: undefined,
        payload: { ...card.payload },
      });
    },
    rewardForPassingStart(player, reason) {
      player.money += this.startReward;
      this.logEvent(`${player.name} 因 ${reason} 經過起點，領取 ${formatCurrency(this.startReward)}。`, "cash");
    },
    movePlayerBySteps(player, steps, reason = "移動") {
      const rawPosition = player.position + steps;

      if (steps > 0 && rawPosition >= this.board.length) {
        this.rewardForPassingStart(player, reason);
      }

      player.position = ((rawPosition % this.board.length) + this.board.length) % this.board.length;
      return this.currentSpace;
    },
    movePlayerToPosition(player, target, reason = "移動") {
      if (target < player.position) {
        this.rewardForPassingStart(player, reason);
      }

      player.position = target;
      return this.currentSpace;
    },
    resolveChanceCard(card, player) {
      if (!card || !player) {
        return;
      }

      if (card.effectType === "money") {
        const amount = card.payload.amount;
        player.money += amount;

        const summary = amount >= 0
          ? `${player.name} 因「${card.title}」獲得 ${formatCurrency(amount)}`
          : `${player.name} 因「${card.title}」支付 ${formatCurrency(Math.abs(amount))}`;

        this.lastDrawnCard = { ...card, effectSummary: summary };
        this.logEvent(summary, amount >= 0 ? "cash" : "danger");

        if (amount < 0) {
          this.handleBankruptcy(player, card.title);
        }
        return;
      }

      if (card.effectType === "move-relative") {
        const destination = this.movePlayerBySteps(player, card.payload.steps, `卡牌「${card.title}」`);
        const direction = card.payload.steps >= 0 ? "前進" : "後退";
        const summary = `${player.name} 抽到「${card.title}」，${direction} ${Math.abs(card.payload.steps)} 格至 ${destination.name}`;

        this.lastDrawnCard = { ...card, effectSummary: summary };
        this.logEvent(summary, card.tone || "turn");
        this.resolveCurrentSpace({ allowChanceDraw: false });
        return;
      }

      if (card.effectType === "move-to") {
        const destination = this.movePlayerToPosition(player, card.payload.target, `卡牌「${card.title}」`);
        const summary = `${player.name} 抽到「${card.title}」，前往 ${card.payload.label || destination.name}`;

        this.lastDrawnCard = { ...card, effectSummary: summary };
        this.logEvent(summary, card.tone || "turn");
        this.resolveCurrentSpace({ allowChanceDraw: false });
      }
    },
    resolveChanceSpace(player, space) {
      const card = this.drawChanceCard();

      if (!card) {
        this.logEvent(`${player.name} 抵達 ${space.name}，但目前沒有可用的機會卡。`, "turn");
        return;
      }

      this.logEvent(`${player.name} 在 ${space.name} 抽到機會卡「${card.title}」。`, card.tone || "turn");
      this.resolveChanceCard(card, player);
      this.discardChanceCard(card);
    },
    ownerFor(space) {
      return this.players.find((player) => player.id === space.ownerId) || null;
    },
    playersOnSpace(index) {
      return this.players.filter((player) => !player.bankrupt && player.position === index);
    },
    propertyCount(playerId) {
      return this.board.filter((space) => space.ownerId === playerId).length;
    },
    canUpgradePropertyForPlayer(space, player) {
      return Boolean(
        this.isProperty(space) &&
        player &&
        !player.bankrupt &&
        space.ownerId === player.id &&
        space.level < space.maxLevel &&
        player.money >= nextUpgradeCostForSpace(space)
      );
    },
    isUpgradeAvailable(space) {
      return Boolean(this.gameStarted && !this.winner && !this.isAnimatingMovement && this.canUpgradePropertyForPlayer(space, this.currentPlayer));
    },
    upgradeablePropertyCount(playerId) {
      const player = this.players.find((item) => item.id === playerId);
      return this.board.filter((space) => this.canUpgradePropertyForPlayer(space, player)).length;
    },
    propertyNames(playerId) {
      const names = this.board
        .filter((space) => space.ownerId === playerId)
        .sort((left, right) => left.price - right.price)
        .map((space) => `${space.name} Lv.${space.level}`);

      return names.join(" / ");
    },
    propertyUpgradeSummary(space) {
      const details = [
        `${space.district}`,
        `租金 ${formatCurrency(this.currentRent(space))}`,
      ];

      if (this.isPropertyMaxed(space)) {
        details.push("已滿級");
      } else {
        details.push(`下級 ${formatCurrency(this.nextUpgradeCost(space))}`);
      }

      return details.join(" / ");
    },
    propertyUpgradeButtonLabel(space) {
      if (this.isPropertyMaxed(space)) {
        return "已滿級";
      }

      const cost = this.nextUpgradeCost(space);
      if (!this.isUpgradeAvailable(space)) {
        return `需 ${formatCurrency(cost)}`;
      }

      return `升級 ${formatCurrency(cost)}`;
    },
    logEvent(message, tone = "turn") {
      this.logEntries.unshift({
        id: Date.now() + Math.random(),
        tone,
        message,
      });
      this.logEntries = this.logEntries.slice(0, MAX_LOG_ENTRIES);
    },
    buildPlayers(names) {
      return names.map((name, index) => decoratePlayer({
        id: `player-${index + 1}`,
        name,
        shortName: name.slice(0, 1),
        money: this.startingBalance,
        position: 0,
        bankrupt: false,
        color: PLAYER_COLORS[index],
        avatar: PLAYER_AVATARS[index],
      }, index));
    },
    async animatePlayerMovement(player, steps, reason = "移動") {
      if (!player || steps === 0) {
        return this.currentSpace;
      }

      const direction = steps >= 0 ? 1 : -1;
      const totalSteps = Math.abs(steps);

      this.isAnimatingMovement = true;
      this.movingPlayerId = player.id;

      try {
        for (let step = 0; step < totalSteps; step += 1) {
          await sleep(MOVEMENT_STEP_DELAY);

          if (direction > 0 && player.position === this.board.length - 1) {
            this.rewardForPassingStart(player, reason);
          }

          player.position = ((player.position + direction) % this.board.length + this.board.length) % this.board.length;
        }

        await sleep(MOVEMENT_SETTLE_DELAY);
        return this.currentSpace;
      } finally {
        this.isAnimatingMovement = false;
        this.movingPlayerId = null;
      }
    },
    startGame() {
      const names = this.setupNames.slice(0, this.playerCount).map((name) => name.trim());

      if (names.some((name) => !name)) {
        this.formError = "每位玩家都需要填寫名稱。";
        return;
      }

      this.formError = "";
      this.board = cloneBoard();
      this.players = this.buildPlayers(names);
      this.currentPlayerIndex = 0;
      this.currentRoll = null;
      this.pendingAction = null;
      this.resetChanceDeckState();
      this.winnerId = null;
      this.gameStarted = true;
      this.logEntries = [];
      this.logEvent(`新遊戲開始，共 ${this.players.length} 位玩家參戰。`, "turn");
      this.logEvent(`輪到 ${this.currentPlayer.name} 先攻，請擲骰子。`, "turn");
      this.persistAutoSave();
    },
    resetGame() {
      this.board = cloneBoard();
      this.players = [];
      this.currentPlayerIndex = 0;
      this.currentRoll = null;
      this.pendingAction = null;
      this.resetChanceDeckState();
      this.winnerId = null;
      this.formError = "";
      this.gameStarted = false;
      this.logEntries = [
        {
          id: Date.now(),
          tone: "turn",
          message: "本局已結束。你可以重新設定玩家並開始下一局。",
        },
      ];
      this.pendingImport = null;
      this.clearAutoSave({ silent: true });
      this.setSaveFeedback("本局已結束，瀏覽器中的自動暫存也已清除。", "secondary");
    },
    async rollDice() {
      if (!this.canRoll) {
        return;
      }

      const diceA = randomDie();
      const diceB = randomDie();
      const total = diceA + diceB;
      const player = this.currentPlayer;
      this.currentRoll = { diceA, diceB, total };

      const destination = await this.animatePlayerMovement(player, total, "擲骰移動");
      this.logEvent(`${player.name} ${this.playerAvatar(player)} 擲出 ${diceA} 與 ${diceB}，抵達 ${destination.name}。`, "turn");
      this.resolveCurrentSpace();
      this.persistAutoSave();
    },
    resolveCurrentSpace(options = {}) {
      const { allowChanceDraw = true } = options;
      const player = this.currentPlayer;
      const space = this.currentSpace;

      if (!player || player.bankrupt || !space) {
        return;
      }

      if (space.type === "start") {
        this.logEvent(`${player.name} 停在起點，本回合不需額外處理。`, "cash");
        return;
      }

      if (space.type === "property") {
        this.resolveProperty(space, player);
        return;
      }

      if (space.type === "tax") {
        player.money -= space.amount;
        this.logEvent(`${player.name} 支付 ${space.name} ${formatCurrency(space.amount)}。`, "danger");
        this.handleBankruptcy(player, space.name);
        return;
      }

      if (space.type === "chance") {
        if (!allowChanceDraw) {
          this.logEvent(`${player.name} 因卡牌移動抵達 ${space.name}，本次不連鎖再抽一張機會卡。`, "turn");
          return;
        }

        this.resolveChanceSpace(player, space);
        return;
      }

      this.logEvent(`${player.name} 在 ${space.name} 休息，沒有額外效果。`, "turn");
    },
    resolveProperty(space, player) {
      const owner = this.ownerFor(space);

      if (!owner) {
        if (player.money >= space.price) {
          this.pendingAction = {
            type: "buy",
            playerId: player.id,
            spaceId: space.id,
          };
          this.logEvent(`${player.name} 抵達 ${space.name}，可用 ${formatCurrency(space.price)} 購買。`, "cash");
        } else {
          this.logEvent(`${player.name} 抵達 ${space.name}，但資金不足無法購買。`, "danger");
        }
        return;
      }

      if (owner.id === player.id) {
        this.logEvent(`${player.name} 回到自己的地產 ${space.name}，目前 ${this.propertyLevelBadge(space)}。`, "turn");
        return;
      }

      if (owner.bankrupt) {
        resetPropertyState(space);
        this.logEvent(`${space.name} 原持有人已破產，地產回到銀行。`, "turn");
        if (player.money >= space.price) {
          this.pendingAction = {
            type: "buy",
            playerId: player.id,
            spaceId: space.id,
          };
        }
        return;
      }

      const rent = this.currentRent(space);
      player.money -= rent;
      owner.money += rent;
      this.logEvent(`${player.name} 向 ${owner.name} 支付 ${space.name} ${this.propertyLevelBadge(space)} 租金 ${formatCurrency(rent)}。`, "danger");
      this.handleBankruptcy(player, `${space.name} 租金`);
    },
    buyCurrentProperty() {
      if (!this.canBuyCurrentProperty) {
        return;
      }

      const space = this.board.find((item) => item.id === this.pendingAction.spaceId);
      const player = this.currentPlayer;

      if (!space || !player) {
        return;
      }

      if (player.money < space.price) {
        this.logEvent(`${player.name} 想購買 ${space.name}，但現金不足。`, "danger");
        return;
      }

      player.money -= space.price;
      space.ownerId = player.id;
      space.level = 0;
      this.pendingAction = null;
      this.logEvent(`${player.name} 買下 ${space.name}，支付 ${formatCurrency(space.price)}。`, "cash");
      this.persistAutoSave();
    },
    upgradeProperty(spaceId) {
      const player = this.currentPlayer;
      const space = this.board.find((item) => item.id === spaceId);

      if (!player || !space || !this.isProperty(space) || !this.gameStarted || this.winner) {
        return;
      }

      if (space.ownerId !== player.id) {
        this.logEvent(`${space.name} 不屬於 ${player.name}，無法升級。`, "danger");
        return;
      }

      if (this.isPropertyMaxed(space)) {
        this.logEvent(`${space.name} 已達最高等級，無法再升級。`, "turn");
        return;
      }

      const cost = this.nextUpgradeCost(space);
      if (player.money < cost) {
        this.logEvent(`${player.name} 現金不足，無法支付 ${space.name} 的升級費用 ${formatCurrency(cost)}。`, "danger");
        return;
      }

      player.money -= cost;
      space.level += 1;
      this.logEvent(`${player.name} 將 ${space.name} 升至 ${this.propertyLevelBadge(space)}，支付 ${formatCurrency(cost)}。`, "cash");
      this.persistAutoSave();
    },
    skipPurchase() {
      if (!this.canSkipPurchase) {
        return;
      }

      const space = this.board.find((item) => item.id === this.pendingAction.spaceId);
      const player = this.currentPlayer;

      this.pendingAction = null;
      if (space && player) {
        this.logEvent(`${player.name} 放棄購買 ${space.name}。`, "turn");
      }
      this.persistAutoSave();
    },
    endTurn() {
      if (!this.canEndTurn) {
        return;
      }

      this.currentRoll = null;
      this.advanceTurn();
      this.persistAutoSave();
    },
    advanceTurn() {
      if (this.checkWinner()) {
        return;
      }

      let nextIndex = this.currentPlayerIndex;

      for (let step = 0; step < this.players.length; step += 1) {
        nextIndex = (nextIndex + 1) % this.players.length;
        if (!this.players[nextIndex].bankrupt) {
          this.currentPlayerIndex = nextIndex;
          this.currentRoll = null;
          this.pendingAction = null;
          this.logEvent(`輪到 ${this.currentPlayer.name} 行動。`, "turn");
          return;
        }
      }
    },
    releaseProperties(playerId) {
      let count = 0;
      this.board.forEach((space) => {
        if (space.ownerId === playerId) {
          resetPropertyState(space);
          count += 1;
        }
      });
      return count;
    },
    handleBankruptcy(player, reason) {
      if (!player || player.bankrupt || player.money >= 0) {
        return false;
      }

      const wasCurrentPlayer = this.currentPlayer && this.currentPlayer.id === player.id;
      const releasedCount = this.releaseProperties(player.id);

      player.bankrupt = true;
      player.money = 0;

      if (this.pendingAction && this.pendingAction.playerId === player.id) {
        this.pendingAction = null;
      }

      this.logEvent(`${player.name} 因 ${reason} 破產，釋出 ${releasedCount} 筆地產。`, "danger");

      if (this.checkWinner()) {
        return true;
      }

      if (wasCurrentPlayer) {
        this.currentRoll = null;
        this.advanceTurn();
      }

      return true;
    },
    checkWinner() {
      if (!this.gameStarted) {
        return false;
      }

      const survivors = this.activePlayers;
      if (survivors.length === 1) {
        this.winnerId = survivors[0].id;
        this.currentRoll = null;
        this.pendingAction = null;
        this.logEvent(`${survivors[0].name} 成為最後留在場上的玩家，贏得本局。`, "success");
        return true;
      }

      return false;
    },
  },
}).mount("#app");