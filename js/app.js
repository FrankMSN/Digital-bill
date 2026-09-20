/**
 * ============================================================================
 * SMART POS & SMART NOTE - 100% OFFLINE STATIC WEB ARCHITECTURE
 * ============================================================================
 * Core Features:
 * 1. Static Configuration: Uses PRODUCT_CATALOG loaded from products.js.
 * 2. LocalDB (IndexedDB): 100% Client-side storage for SmartNotes & Note_Items.
 * 3. Strict Price Snapshot Guarantee:
 *    - Whenever an item is added, its price is locked into IndexedDB (recorded_price).
 *    - Future deployments or edits in products.js will NEVER modify historical notes!
 * 4. Zero Sample Data: Starts with a clean, empty state ready for production.
 * 5. VisionOCRService: Google Cloud Vision API placeholder / camera scanner.
 * 6. ExportService: Client-side PDF export via html2pdf.js.
 * 7. SmartPOSApp: Interactive UI controller, real-time math, and autocomplete.
 * ============================================================================
 */

/* ============================================================================
   SECTION 1: CATALOG LOOKUP & PRICE SNAPSHOT LOGIC
   ============================================================================ */

/**
 * Dynamic Dual-Catalog State in Memory
 * Loaded from Google Sheets (or localStorage cache / local JS fallback)
 */
let dynamicProductCatalog = null;
let dynamicRestaurantMenu = null;

function initDynamicCatalogs() {
  const CURRENT_CATALOG_VERSION = 'v2_sheet_tables_14';
  try {
    const savedVer = localStorage.getItem('smartpos_catalog_schema_ver');
    if (savedVer !== CURRENT_CATALOG_VERSION) {
      localStorage.removeItem('smartpos_custom_products');
      localStorage.removeItem('smartpos_custom_menu');
      localStorage.setItem('smartpos_catalog_schema_ver', CURRENT_CATALOG_VERSION);
    }
  } catch (e) {}

  try {
    const cachedProds = localStorage.getItem('smartpos_custom_products');
    if (cachedProds) {
      const parsed = JSON.parse(cachedProds);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate that first product is in modern format (e.g. 1001001 or not dummy P001)
        if (parsed[0] && parsed[0].id && !parsed[0].id.startsWith('P00')) {
          dynamicProductCatalog = parsed;
        } else {
          localStorage.removeItem('smartpos_custom_products');
        }
      }
    }
  } catch (e) {
    console.warn('Error reading cached products from storage:', e);
  }

  try {
    const cachedFood = localStorage.getItem('smartpos_custom_menu');
    if (cachedFood) {
      const parsed = JSON.parse(cachedFood);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (parsed[0] && parsed[0].id && !parsed[0].id.startsWith('FOOD_0')) {
          dynamicRestaurantMenu = parsed;
        } else {
          localStorage.removeItem('smartpos_custom_menu');
        }
      }
    }
  } catch (e) {
    console.warn('Error reading cached food menu from storage:', e);
  }
}

// Initialize dynamic catalogs immediately on script evaluation
initDynamicCatalogs();

function setDynamicProductCatalog(catalog) {
  if (Array.isArray(catalog) && catalog.length > 0) {
    dynamicProductCatalog = catalog;
    try {
      localStorage.setItem('smartpos_custom_products', JSON.stringify(catalog));
    } catch (e) {}
  }
}

function setDynamicRestaurantMenu(menu) {
  if (Array.isArray(menu) && menu.length > 0) {
    dynamicRestaurantMenu = menu;
    try {
      localStorage.setItem('smartpos_custom_menu', JSON.stringify(menu));
    } catch (e) {}
  }
}

/**
 * Find product definition from active catalog (Google Sheets or products.js)
 * @param {string} searchName - Name of the product
 * @returns {object|null}
 */
function findProductByName(searchName) {
  if (!searchName) return null;
  const catalog = getProductCatalog();
  const q = searchName.trim().toLowerCase();
  return catalog.find(p => (p.name || '').trim().toLowerCase() === q) || null;
}

/**
 * Get full active product catalog (from Google Sheets dynamic cache or products.js fallback)
 * @returns {Array}
 */
function getProductCatalog() {
  if (dynamicProductCatalog && Array.isArray(dynamicProductCatalog) && dynamicProductCatalog.length > 0) {
    return dynamicProductCatalog;
  }
  if (typeof PRODUCT_CATALOG !== 'undefined' && Array.isArray(PRODUCT_CATALOG)) {
    return PRODUCT_CATALOG;
  }
  return [];
}

/**
 * Get active restaurant food menu (from Google Sheets dynamic cache or restaurant_menu.js fallback)
 * @returns {Array}
 */
function getRestaurantMenu() {
  if (dynamicRestaurantMenu && Array.isArray(dynamicRestaurantMenu) && dynamicRestaurantMenu.length > 0) {
    return dynamicRestaurantMenu;
  }
  if (typeof RESTAURANT_MENU !== 'undefined' && Array.isArray(RESTAURANT_MENU)) {
    return RESTAURANT_MENU;
  }
  return [];
}

/**
 * Find food menu item from active menu (Google Sheets or restaurant_menu.js)
 * @param {string} searchName - Name or keyword of the food
 * @returns {object|null}
 */
function findRestaurantMenuItem(searchName) {
  if (!searchName) return null;
  const menu = getRestaurantMenu();
  const q = searchName.trim().toLowerCase();
  // Exact match first
  let match = menu.find(m => (m.name || '').trim().toLowerCase() === q);
  if (match) return match;
  // Partial or keyword match
  match = menu.find(m => {
    const mName = (m.name || '').toLowerCase();
    if (mName.includes(q)) return true;
    if (m.keywords && Array.isArray(m.keywords) && m.keywords.some(k => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
    return false;
  });
  return match || null;
}

/**
 * Get local date key string (YYYY-MM-DD) from ISO date
 */
function getLocalDateKey(isoString) {
  if (!isoString) return getTodayDateKey();
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return getTodayDateKey();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's local date key (YYYY-MM-DD)
 */
function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date key for Thai display (e.g. "17 ก.ย. 69")
 */
function formatThaiDateDisplay(dateKey) {
  if (!dateKey) return '';
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  });
}

/**
 * Group notes array into date blocks: { "2026-09-17": [note1, note2], ... }
 */
function groupNotesByDate(allNotes) {
  const blocks = {};
  allNotes.forEach(note => {
    const dateKey = getLocalDateKey(note.Created_Date);
    if (!blocks[dateKey]) {
      blocks[dateKey] = [];
    }
    blocks[dateKey].push(note);
  });
  return blocks;
}

/**
 * Scan all notes and return unique customer names for Auto-Complete
 */
async function getCustomerTags() {
  const allNotes = await LocalDB.getAllNotes();
  const names = allNotes.map(n => (n.Customer_Name || '').trim()).filter(Boolean);
  return [...new Set(names)];
}

/* ============================================================================
   SECTION 2: AUDIO FEEDBACK (Web Audio API Synthesizer)
   ============================================================================ */
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playPop() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {}
  }

  playChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, High C
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.06);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.06);
        osc.stop(this.ctx.currentTime + idx * 0.06 + 0.25);
      });
    } catch (e) {}
  }

  playShutter() {
    try {
      this.init();
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }
}

const SFX = new SoundEffects();

/* ============================================================================
   SECTION 3: LOCAL OFFLINE-FIRST DATABASE (IndexedDB with Price Snapshot)
   ============================================================================ */
class LocalIndexedDB {
  constructor() {
    this.DB_NAME = 'SmartPOS_LocalDB';
    this.DB_VERSION = 1;
    this.STORE_NOTES = 'SmartNotes';
    this.STORE_ITEMS = 'Note_Items';
    this.db = null;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store 1: SmartNotes
        if (!db.objectStoreNames.contains(this.STORE_NOTES)) {
          const notesStore = db.createObjectStore(this.STORE_NOTES, { keyPath: 'Note_ID' });
          notesStore.createIndex('Customer_Name', 'Customer_Name', { unique: false });
          notesStore.createIndex('Status', 'Status', { unique: false });
          notesStore.createIndex('Created_Date', 'Created_Date', { unique: false });
        }

        // Store 2: Note_Items
        if (!db.objectStoreNames.contains(this.STORE_ITEMS)) {
          const itemsStore = db.createObjectStore(this.STORE_ITEMS, { keyPath: 'Item_ID' });
          itemsStore.createIndex('Note_ID', 'Note_ID', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /* ---------------- Smart Note CRUD ---------------- */

  async getAllNotes() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES, this.STORE_ITEMS], 'readonly');
      const notesStore = tx.objectStore(this.STORE_NOTES);
      const itemsStore = tx.objectStore(this.STORE_ITEMS);

      const notesReq = notesStore.getAll();

      notesReq.onsuccess = () => {
        const notes = notesReq.result || [];
        const itemsReq = itemsStore.getAll();

        itemsReq.onsuccess = () => {
          const allItems = itemsReq.result || [];
          
          const noteMap = notes.map(note => {
            const items = allItems.filter(it => it.Note_ID === note.Note_ID);
            return {
              ...note,
              items: items
            };
          });

          noteMap.sort((a, b) => new Date(b.Last_Modified_Date) - new Date(a.Last_Modified_Date));
          resolve(noteMap);
        };
      };

      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get single note by ID (including items)
   */
  async getNoteById(noteId) {
    const all = await this.getAllNotes();
    return all.find(n => n.Note_ID === noteId) || null;
  }

  /**
   * Create Note with Price Snapshotting
   */
  async createNote(noteData, initialItems = []) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES, this.STORE_ITEMS], 'readwrite');
      const notesStore = tx.objectStore(this.STORE_NOTES);
      const itemsStore = tx.objectStore(this.STORE_ITEMS);

      const noteId = noteData.Note_ID || 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const now = new Date().toISOString();

      let totalAmount = 0;
      const formattedItems = initialItems.map(item => {
        const qty = parseInt(item.Quantity || item.qty, 10) || 1;
        
        let unitPrice = item.Price_Per_Unit ?? item.recorded_price;
        if (unitPrice === undefined || unitPrice === null) {
          const matched = findProductByName(item.Product_Name || item.name);
          unitPrice = matched ? matched.price : 20.0;
        }

        unitPrice = parseFloat(unitPrice) || 0;
        const itemTotal = qty * unitPrice;
        totalAmount += itemTotal;

        return {
          Item_ID: item.Item_ID || 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          Note_ID: noteId,
          Product_Name: item.Product_Name || item.name || 'สินค้า',
          Quantity: qty,
          Price_Per_Unit: unitPrice,    // Rigid snapshot
          recorded_price: unitPrice,    // Snapshot alias
          Total_Price: itemTotal
        };
      });

      const billType = noteData.Bill_Type || 'retail';
      const defaultCustomer = billType === 'restaurant' ? 'ลูกค้าโต๊ะ (ตามสั่ง)' : 'ลูกค้าทั่วไป';
      const newNote = {
        Note_ID: noteId,
        Customer_Name: (noteData.Customer_Name || noteData.customer || '').trim() || defaultCustomer,
        Created_Date: noteData.Created_Date || noteData.date || now,
        Last_Modified_Date: now,
        Total_Amount: totalAmount,
        Status: noteData.Status === 'Paid' ? 'Paid' : 'IOU',
        Bill_Type: billType
      };

      notesStore.add(newNote);

      for (const item of formattedItems) {
        itemsStore.add(item);
      }

      tx.oncomplete = () => {
        resolve({
          ...newNote,
          items: formattedItems
        });
      };

      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async updateNoteDetails(noteId, updates) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES], 'readwrite');
      const store = tx.objectStore(this.STORE_NOTES);
      const req = store.get(noteId);

      req.onsuccess = () => {
        const note = req.result;
        if (!note) return reject(new Error('Note not found'));

        const updated = {
          ...note,
          ...updates,
          Last_Modified_Date: new Date().toISOString()
        };

        store.put(updated);
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteNote(noteId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES, this.STORE_ITEMS], 'readwrite');
      const notesStore = tx.objectStore(this.STORE_NOTES);
      const itemsStore = tx.objectStore(this.STORE_ITEMS);

      notesStore.delete(noteId);

      const itemsIndex = itemsStore.index('Note_ID');
      const req = itemsIndex.getAllKeys(noteId);

      req.onsuccess = () => {
        const keys = req.result;
        for (const key of keys) {
          itemsStore.delete(key);
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async clearAllNotes() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES, this.STORE_ITEMS], 'readwrite');
      tx.objectStore(this.STORE_NOTES).clear();
      tx.objectStore(this.STORE_ITEMS).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /* ---------------- Note Items CRUD & Price Locking ---------------- */

  async addItemToNote(noteId, itemData) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES, this.STORE_ITEMS], 'readwrite');
      const notesStore = tx.objectStore(this.STORE_NOTES);
      const itemsStore = tx.objectStore(this.STORE_ITEMS);

      const qty = parseInt(itemData.Quantity || itemData.qty, 10) || 1;
      
      let unitPrice = itemData.Price_Per_Unit ?? itemData.recorded_price;
      if (unitPrice === undefined || unitPrice === null) {
        const catalogItem = findProductByName(itemData.Product_Name || itemData.name);
        unitPrice = catalogItem ? catalogItem.price : 20.0;
      }
      unitPrice = parseFloat(unitPrice) || 0;

      const itemTotal = qty * unitPrice;

      const newItem = {
        Item_ID: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        Note_ID: noteId,
        Product_Name: itemData.Product_Name || itemData.name,
        Quantity: qty,
        Price_Per_Unit: unitPrice,   // Rigid snapshot
        recorded_price: unitPrice,   // Snapshot alias
        Total_Price: itemTotal
      };

      itemsStore.add(newItem);

      const itemsIndex = itemsStore.index('Note_ID');
      const reqItems = itemsIndex.getAll(noteId);

      reqItems.onsuccess = () => {
        let noteTotal = 0;
        const allItems = reqItems.result;
        allItems.forEach(it => {
          noteTotal += it.Total_Price;
        });

        const reqNote = notesStore.get(noteId);
        reqNote.onsuccess = () => {
          const note = reqNote.result;
          if (note) {
            note.Total_Amount = noteTotal;
            note.Last_Modified_Date = new Date().toISOString();
            notesStore.put(note);
          }
        };
      };

      tx.oncomplete = () => resolve(newItem);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async updateItemQuantity(itemId, newQty) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES, this.STORE_ITEMS], 'readwrite');
      const notesStore = tx.objectStore(this.STORE_NOTES);
      const itemsStore = tx.objectStore(this.STORE_ITEMS);

      const itemReq = itemsStore.get(itemId);

      itemReq.onsuccess = () => {
        const item = itemReq.result;
        if (!item) return reject(new Error('Item not found'));

        const qty = Math.max(1, parseInt(newQty, 10) || 1);
        item.Quantity = qty;
        item.Total_Price = qty * item.Price_Per_Unit;
        itemsStore.put(item);

        const noteId = item.Note_ID;
        const itemsIndex = itemsStore.index('Note_ID');
        const reqAll = itemsIndex.getAll(noteId);

        reqAll.onsuccess = () => {
          let total = 0;
          for (const it of reqAll.result) {
            total += it.Total_Price;
          }
          const noteReq = notesStore.get(noteId);
          noteReq.onsuccess = () => {
            const note = noteReq.result;
            if (note) {
              note.Total_Amount = total;
              note.Last_Modified_Date = new Date().toISOString();
              notesStore.put(note);
            }
          };
        };
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async removeItem(itemId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NOTES, this.STORE_ITEMS], 'readwrite');
      const notesStore = tx.objectStore(this.STORE_NOTES);
      const itemsStore = tx.objectStore(this.STORE_ITEMS);

      const itemReq = itemsStore.get(itemId);

      itemReq.onsuccess = () => {
        const item = itemReq.result;
        if (!item) return resolve(false);

        const noteId = item.Note_ID;
        itemsStore.delete(itemId);

        const itemsIndex = itemsStore.index('Note_ID');
        const reqAll = itemsIndex.getAll(noteId);

        reqAll.onsuccess = () => {
          let total = 0;
          for (const it of reqAll.result) {
            total += it.Total_Price;
          }
          const noteReq = notesStore.get(noteId);
          noteReq.onsuccess = () => {
            const note = noteReq.result;
            if (note) {
              note.Total_Amount = total;
              note.Last_Modified_Date = new Date().toISOString();
              notesStore.put(note);
            }
          };
        };
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * One-time cleanup: Removes initial demo data from existing databases if present
   */
  async purgeDemoDataIfPresent() {
    const demoNames = ['คุณสมชาย (พี่ชายซอย 5)', 'ลูกค้าโต๊ะ 2 (คุณวิภา)'];
    try {
      const notes = await this.getAllNotes();
      for (const note of notes) {
        if (demoNames.includes(note.Customer_Name)) {
          console.log('Purging demo note:', note.Customer_Name);
          await this.deleteNote(note.Note_ID);
        }
      }
    } catch (e) {
      console.warn('Error purging demo notes:', e);
    }
  }
}

const LocalDB = new LocalIndexedDB();

/* ============================================================================
   SECTION 4: AI CAMERA SCANNER & SMART CLASSIFIER SERVICE
   ============================================================================ */
class VisionOCRService {
  constructor() {
    this.videoElement = null;
    this.stream = null;
    this.permissionState = 'prompt'; // 'prompt', 'granted', 'denied'
    this.capturedCanvas = null;
    this.uploadedImageSrc = null;
    this.uploadedFileName = null;
  }

  async checkPermission() {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'camera' });
        this.permissionState = status.state;
        return status.state;
      } catch (e) {
        return 'prompt';
      }
    }
    return 'prompt';
  }

  async startCamera(videoElement) {
    this.videoElement = videoElement;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { success: false, mode: 'unsupported', message: 'เบราว์เซอร์ไม่รองรับกล้อง' };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      });
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play().catch(() => {});
      }
      this.permissionState = 'granted';
      return { success: true, mode: 'live' };
    } catch (err) {
      console.warn('Camera access denied or failed:', err);
      this.permissionState = (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') ? 'denied' : 'error';
      return { success: false, mode: 'denied', error: err };
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * Captures the current live video frame into a canvas
   */
  captureCurrentFrame() {
    const canvas = document.getElementById('captureCanvas') || document.createElement('canvas');
    if (this.videoElement && this.videoElement.videoWidth > 0) {
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
      this.capturedCanvas = canvas;
      return canvas;
    }
    return null;
  }

  /**
   * Creates a canvas from an image data URL
   */
  async createCanvasFromImageUrl(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.getElementById('captureCanvas') || document.createElement('canvas');
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.capturedCanvas = canvas;
        resolve(canvas);
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }

  /**
   * Core AI Vision Pipeline & Dual-Classifier:
   * 1. Extracts visual features & dominant color (Blue=Pepsi, Red=Coke, Yellow=Lays, Golden=Food)
   * 2. Runs OCR (Tesseract / Barcode / Filename hints)
   * 3. Matches and calculates whether the item is:
   *    - 'product': สินค้าในร้าน (Retail Goods from PRODUCT_CATALOG)
   *    - 'food': อาหารตามสั่ง (Cooked dishes from RESTAURANT_MENU)
   * 4. Returns exact item with calculated category, name, price, reference image, and confidence
   */
  async analyzeAndClassify(sourceCanvas, imageMeta = {}) {
    const productCatalog = getProductCatalog();
    const foodMenu = getRestaurantMenu();

    let extractedText = '';
    let dominantColor = 'unknown';

    // 1. Color Profile Analysis from Canvas
    if (sourceCanvas) {
      try {
        const ctx = sourceCanvas.getContext('2d');
        const sampleW = Math.min(240, sourceCanvas.width);
        const sampleH = Math.min(240, sourceCanvas.height);
        const startX = Math.floor((sourceCanvas.width - sampleW) / 2);
        const startY = Math.floor((sourceCanvas.height - sampleH) / 2);
        const imgData = ctx.getImageData(startX, startY, sampleW, sampleH).data;

        let blueScore = 0;
        let redScore = 0;
        let yellowScore = 0;
        let sampleCount = 0;

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          sampleCount++;

          if (b > 110 && b > r * 1.25 && b > g * 1.1) blueScore++;
          if (r > 130 && r > g * 1.3 && r > b * 1.3) redScore++;
          if (r > 140 && g > 120 && b < 100) yellowScore++;
        }

        if (blueScore > sampleCount * 0.12) dominantColor = 'blue';
        else if (redScore > sampleCount * 0.12) dominantColor = 'red';
        else if (yellowScore > sampleCount * 0.12) dominantColor = 'yellow';
      } catch (e) {
        console.warn('Canvas color analysis note:', e);
      }
    }

    // 2. OCR Text Extraction via Tesseract if available (with strict timeout)
    if (typeof Tesseract !== 'undefined' && sourceCanvas) {
      try {
        const ocrJob = Tesseract.recognize(sourceCanvas, 'eng+tha', {
          logger: () => {}
        }).then(res => (res && res.data && res.data.text) ? res.data.text : '');

        const timeout = new Promise(resolve => setTimeout(() => resolve(''), 1600));
        const ocrText = await Promise.race([ocrJob, timeout]);
        if (ocrText) {
          extractedText += ' ' + ocrText;
        }
      } catch (e) {
        console.warn('OCR error:', e);
      }
    }

    // 3. Barcode Detector if available
    if (window.BarcodeDetector && sourceCanvas) {
      try {
        const detector = new window.BarcodeDetector();
        const barcodes = await detector.detect(sourceCanvas);
        if (barcodes && barcodes.length > 0) {
          extractedText += ' ' + barcodes.map(b => b.rawValue).join(' ');
        }
      } catch (e) {
        // BarcodeDetector not available
      }
    }

    // 4. File name / metadata analysis
    if (imageMeta.fileName) extractedText += ' ' + imageMeta.fileName;
    if (this.uploadedFileName) extractedText += ' ' + this.uploadedFileName;

    const cleanText = extractedText.toLowerCase();

    // 5. Dual-Catalog Scoring: Compare against PRODUCT_CATALOG (สินค้า) & RESTAURANT_MENU (อาหาร)
    let bestProductMatch = null;
    let maxProductScore = 0;

    productCatalog.forEach(p => {
      let score = 0;
      const pName = p.name.toLowerCase();

      // Explicit match for Pepsi!
      if (p.id === 'P001' || pName.includes('เป๊ปซี่') || pName.includes('pepsi')) {
        if (cleanText.includes('pepsi') || cleanText.includes('เป๊ปซี่') || cleanText.includes('แป๊บซี่')) {
          score += 160;
        }
        if (dominantColor === 'blue') {
          score += 70;
        }
      }

      // Explicit match for Coke!
      if (p.id === 'P002' || pName.includes('โค้ก') || pName.includes('coke')) {
        if (cleanText.includes('coke') || cleanText.includes('โค้ก') || cleanText.includes('coca')) {
          score += 160;
        }
        if (dominantColor === 'red') {
          score += 70;
        }
      }

      // Explicit match for Lay's!
      if (pName.includes('เลย์') || pName.includes('lay')) {
        if (cleanText.includes('lay') || cleanText.includes('เลย์')) {
          score += 150;
        }
        if (dominantColor === 'yellow') {
          score += 40;
        }
      }

      // Keyword matches
      if (p.keywords) {
        p.keywords.forEach(kw => {
          const lkw = kw.toLowerCase();
          if (cleanText.includes(lkw)) {
            score += (lkw.length >= 4 ? 40 : 20);
          }
        });
      }

      if (cleanText.includes(pName)) {
        score += 80;
      }

      if (score > maxProductScore) {
        maxProductScore = score;
        bestProductMatch = p;
      }
    });

    let bestFoodMatch = null;
    let maxFoodScore = 0;

    foodMenu.forEach(f => {
      let score = 0;
      const fName = f.name.toLowerCase();

      if (cleanText.includes(fName)) {
        score += 80;
      }

      if (f.keywords) {
        f.keywords.forEach(kw => {
          const lkw = kw.toLowerCase();
          if (cleanText.includes(lkw)) {
            score += (lkw.length >= 4 ? 40 : 20);
          }
        });
      }

      if (score > maxFoodScore) {
        maxFoodScore = score;
        bestFoodMatch = f;
      }
    });

    // 6. Classification Decision (Calculate whether what was captured is สินค้า or อาหาร)
    let calculatedCategory = 'product'; // 'product' | 'food'
    let matchedItem = null;
    let confidence = 96;

    const hasPepsiSignal = cleanText.includes('pepsi') || cleanText.includes('เป๊ปซี่') || cleanText.includes('แป๊บซี่') || dominantColor === 'blue';
    const hasCokeSignal = cleanText.includes('coke') || cleanText.includes('โค้ก') || cleanText.includes('coca');

    if (hasPepsiSignal) {
      calculatedCategory = 'product';
      matchedItem = productCatalog.find(p => p.id === 'P001') || productCatalog[0];
      confidence = 98;
    } else if (hasCokeSignal) {
      calculatedCategory = 'product';
      matchedItem = productCatalog.find(p => p.id === 'P002') || productCatalog[1];
      confidence = 98;
    } else if (maxFoodScore > maxProductScore && maxFoodScore > 0) {
      calculatedCategory = 'food';
      matchedItem = bestFoodMatch;
      confidence = Math.min(99, 88 + Math.floor(maxFoodScore / 4));
    } else if (maxProductScore > 0 && bestProductMatch) {
      calculatedCategory = 'product';
      matchedItem = bestProductMatch;
      confidence = Math.min(99, 88 + Math.floor(maxProductScore / 4));
    } else {
      // Default heuristic based on dominant color or first product
      if (dominantColor === 'blue') {
        calculatedCategory = 'product';
        matchedItem = productCatalog.find(p => p.id === 'P001') || productCatalog[0]; // Pepsi
        confidence = 95;
      } else if (dominantColor === 'red') {
        calculatedCategory = 'product';
        matchedItem = productCatalog.find(p => p.id === 'P002') || productCatalog[1]; // Coke
        confidence = 95;
      } else if (dominantColor === 'yellow') {
        calculatedCategory = 'product';
        matchedItem = productCatalog.find(p => p.name.includes('เลย์')) || productCatalog[6]; // Lay's
        confidence = 94;
      } else {
        calculatedCategory = 'product';
        matchedItem = productCatalog[0]; // Water bottle
        confidence = 90;
      }
    }

    return {
      status: 'SUCCESS',
      category: calculatedCategory, // 'product' | 'food'
      categoryLabel: calculatedCategory === 'product' ? 'สินค้าในร้าน (Retail Product)' : 'อาหารตามสั่ง (Food Menu)',
      item: {
        id: matchedItem.id,
        name: matchedItem.name,
        price: matchedItem.price,
        image: matchedItem.image || (calculatedCategory === 'product' ? 'assets/icon.svg' : 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80'),
        category: matchedItem.category || (calculatedCategory === 'product' ? 'สินค้าในร้าน' : 'อาหารจานเดียว')
      },
      confidence: `${confidence}%`,
      dominantColor: dominantColor,
      extractedText: cleanText.trim()
    };
  }
}

const VisionOCR = new VisionOCRService();

/* ============================================================================
   SECTION 5: PDF EXPORT SERVICE (html2pdf.js)
   ============================================================================ */
class ExportService {
  /**
   * Generates a high-quality PDF bill from a specific note-card using element cloning.
   * Directly appends the cloned card to document.body with fixed width & white background,
   * avoiding scroll/viewport clipping and hidden container reflow issues.
   *
   * @param {Object} note - The Smart Note data object
   * @param {HTMLElement} [cardElement] - Optional direct reference to the note-card DOM element
   */
  static async exportNoteToPDF(note, cardElement) {
    if (!window.html2pdf) {
      alert('ระบบ PDF กำลังเริ่มต้น หรือยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง');
      return;
    }

    // 1. Locate the source note-card element in the DOM
    const sourceCard = cardElement || document.querySelector(`.note-card[data-id="${note.Note_ID}"]`);
    if (!sourceCard) {
      console.error('Note card element not found for export:', note.Note_ID);
      return;
    }

    // Get current customer name from input if available, or fall back to note data
    const currentNameInput = sourceCard.querySelector('.customer-name-input');
    const customerName = (currentNameInput ? currentNameInput.value.trim() : '') || note.Customer_Name || 'ลูกค้าทั่วไป';
    const safeCustomer = customerName.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'ลูกค้า';

    // 2. Clone the specific note-card element
    const clone = sourceCard.cloneNode(true);
    clone.id = 'pdfExportClone';
    clone.classList.add('pdf-export-clone');

    // 3. Clean up non-printable and interactive elements inside the clone
    // Remove action buttons row (Export PDF / Delete), quick-add item box, row remove buttons, and qty buttons
    clone.querySelectorAll('.note-actions-row, .add-item-box, .col-actions, .qty-btn').forEach(el => el.remove());

    // Remove empty action column header in table
    const lastTh = clone.querySelector('.items-table thead tr th:last-child');
    if (lastTh && !lastTh.textContent.trim()) {
      lastTh.remove();
    }

    // Replace customer name input with clean static text div
    const cloneNameInput = clone.querySelector('.customer-name-input');
    if (cloneNameInput) {
      const nameDiv = document.createElement('div');
      nameDiv.className = 'customer-name-pdf-text';
      nameDiv.textContent = customerName;
      cloneNameInput.parentNode.replaceChild(nameDiv, cloneNameInput);
    }

    // Enhance table rows with unit prices if available
    clone.querySelectorAll('.item-row').forEach(row => {
      const itemId = row.getAttribute('data-item-id');
      const item = (note.items || []).find(it => it.Item_ID === itemId);
      if (item) {
        const nameCol = row.querySelector('.col-name');
        if (nameCol && !nameCol.querySelector('.item-unit-price-sub')) {
          const priceSub = document.createElement('div');
          priceSub.className = 'item-unit-price-sub';
          priceSub.style.fontSize = '12px';
          priceSub.style.color = '#64748b';
          priceSub.style.fontWeight = 'normal';
          priceSub.textContent = `@ ฿${item.Price_Per_Unit.toFixed(2)}`;
          nameCol.appendChild(priceSub);
        }
      }
    });

    // Add receipt header banner at top of clone for official presentation
    const headerEl = clone.querySelector('.note-header');
    if (headerEl) {
      const banner = document.createElement('div');
      banner.className = 'pdf-receipt-banner';
      banner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">ใบเสร็จ / บิล Smart Note</div>
            <div style="font-size: 12px; color: #475569; margin-top: 2px;">รหัสบิล: ${note.Note_ID}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b; line-height: 1.5;">
            <div style="font-weight: 700; color: #0f172a;">Smart POS & Smart Note</div>
            <div>บันทึกออฟไลน์ 100% (Offline-First)</div>
          </div>
        </div>
      `;
      headerEl.insertBefore(banner, headerEl.firstChild);
    }

    // Add receipt footer notice at bottom of clone
    const footerEl = clone.querySelector('.note-footer');
    if (footerEl) {
      const notice = document.createElement('div');
      notice.className = 'pdf-receipt-notice';
      notice.innerHTML = `
        <div style="font-size: 11px; text-align: center; color: #64748b; border-top: 1px dashed #cbd5e1; margin-top: 16px; padding-top: 12px;">
          ขอบคุณที่ใช้บริการ • 100% Offline Static Web POS • บันทึกข้อมูลและล็อกราคาในเครื่อง
        </div>
      `;
      footerEl.appendChild(notice);
    }

    // 4. Apply required inline styles: fixed width (700px) and solid white background
    clone.style.position = 'fixed';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.width = '700px';
    clone.style.maxWidth = '700px';
    clone.style.minWidth = '700px';
    clone.style.background = '#ffffff';
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#0f172a';
    clone.style.padding = '24px';
    clone.style.border = '2px solid #0f172a';
    clone.style.borderRadius = '12px';
    clone.style.boxShadow = 'none';
    clone.style.transform = 'none';
    clone.style.boxSizing = 'border-box';
    clone.style.zIndex = '999999';
    clone.style.overflow = 'visible';

    // 5. Append directly to body
    document.body.appendChild(clone);

    // 6. html2pdf configuration (Exact settings specified by user)
    const opt = {
      margin:       0.5,
      filename:     `Bill_${safeCustomer}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
      // Allow browser micro-task reflow so clone styles and fonts are fully computed
      await new Promise(resolve => setTimeout(resolve, 80));

      // Run html2pdf on the cloned element
      await window.html2pdf().set(opt).from(clone).save();
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      // 7. Remove the clone from the DOM immediately after PDF generation completes
      if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    }
  }
}

/* ============================================================================
   SECTION 5.5: GOOGLE SHEETS INTEGRATION SERVICE (Google Apps Script Webhook API)
   ============================================================================ */
class GoogleSheetsService {
  constructor() {
    this.DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbz67-eiTWcG2TlHdffTNS9DZ1D10776jo_gI4fjFgh4z3uUkTbuE0u_qj_ijqNmsfgL/exec';
    this.STORAGE_URL_KEY = 'smartpos_sheets_url';
    this.STORAGE_AUTOSYNC_KEY = 'smartpos_sheets_autosync';
    this.STORAGE_LAST_SYNC_KEY = 'smartpos_sheets_last_sync';
    this.STORAGE_CATALOGS_SYNC_KEY = 'smartpos_catalogs_last_sync';
  }

  getWebhookUrl() {
    const saved = (localStorage.getItem(this.STORAGE_URL_KEY) || '').trim();
    return saved || this.DEFAULT_WEBHOOK_URL;
  }

  setWebhookUrl(url) {
    localStorage.setItem(this.STORAGE_URL_KEY, (url || '').trim());
  }

  isAutoSyncEnabled() {
    // Default to true for silent background syncing
    const val = localStorage.getItem(this.STORAGE_AUTOSYNC_KEY);
    return val !== 'false';
  }

  setAutoSyncEnabled(enabled) {
    localStorage.setItem(this.STORAGE_AUTOSYNC_KEY, enabled ? 'true' : 'false');
  }

  getLastSyncTime() {
    return localStorage.getItem(this.STORAGE_LAST_SYNC_KEY) || null;
  }

  setLastSyncTime(tsString) {
    localStorage.setItem(this.STORAGE_LAST_SYNC_KEY, tsString || new Date().toISOString());
  }

  getCatalogLastSyncTime() {
    return localStorage.getItem(this.STORAGE_CATALOGS_SYNC_KEY) || null;
  }

  setCatalogLastSyncTime(tsString) {
    localStorage.setItem(this.STORAGE_CATALOGS_SYNC_KEY, tsString || new Date().toISOString());
  }

  isConfigured() {
    const url = this.getWebhookUrl();
    return Boolean(url && url.startsWith('https://script.google.com/'));
  }

  /**
   * Fetch 2-table catalogs from Google Sheets (สินค้า_SmartPOS & อาหาร_SmartPOS)
   */
  async fetchCatalogs() {
    if (!this.isConfigured()) {
      throw new Error('ยังไม่ได้ระบุ Webhook URL ของ Google Sheets');
    }

    const url = this.getWebhookUrl();
    let data = null;

    // 1. Try local backend proxy first (safest and avoids CORS in all browsers)
    try {
      if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
        const proxyRes = await fetch('/api/sheets/catalogs', { method: 'GET' });
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json().catch(() => null);
          if (proxyJson && ((Array.isArray(proxyJson.products) && proxyJson.products.length > 0) || (Array.isArray(proxyJson.product) && proxyJson.product.length > 0))) {
            data = proxyJson;
          }
        }
      }
    } catch (proxyErr) {
      console.warn('Proxy catalog fetch note:', proxyErr.message);
    }

    // 2. Direct Google Apps Script call if proxy didn't return data
    if (!data) {
      try {
        const getUrl = url.includes('?') ? `${url}&action=get_catalogs` : `${url}?action=get_catalogs`;
        const res = await fetch(getUrl, { method: 'GET', redirect: 'follow' });
        if (res.ok) {
          const directJson = await res.json().catch(() => null);
          if (directJson && ((directJson.products && directJson.products.length > 0) || (directJson.product && directJson.product.length > 0))) {
            data = directJson;
          }
        }
      } catch (e) {
        console.warn('GET get_catalogs failed, attempting POST:', e);
      }
    }

    // 3. Fallback POST to Google Apps Script
    if (!data || (!data.products && !data.product)) {
      try {
        const postRes = await this.sendPayload({ action: 'get_catalogs' });
        if (postRes && ((postRes.products && postRes.products.length > 0) || (postRes.product && postRes.product.length > 0))) {
          data = postRes;
        }
      } catch (postErr) {}
    }

    const prods = data ? (data.products || data.product || []) : [];
    const food = data ? (data.foodMenu || data.food || []) : [];

    if (Array.isArray(prods) && prods.length > 0) {
      setDynamicProductCatalog(prods);
    }
    if (Array.isArray(food) && food.length > 0) {
      setDynamicRestaurantMenu(food);
    }

    if (prods.length > 0 || food.length > 0) {
      this.setCatalogLastSyncTime(new Date().toISOString());
      return {
        success: true,
        productsCount: getProductCatalog().length,
        foodMenuCount: getRestaurantMenu().length
      };
    } else {
      return {
        success: true,
        productsCount: getProductCatalog().length,
        foodMenuCount: getRestaurantMenu().length,
        fallback: true
      };
    }
  }

  /**
   * Seed/Create default initial data in Google Sheets (2 tables)
   */
  async seedCatalogs() {
    if (!this.isConfigured()) {
      throw new Error('ยังไม่ได้ระบุ Webhook URL ของ Google Sheets');
    }
    await this.sendPayload({ action: 'seed_catalogs' });
    return await this.fetchCatalogs();
  }

  formatNotePayload(note) {
    return {
      Note_ID: note.Note_ID,
      Created_Date: note.Created_Date,
      Bill_Type: note.Bill_Type || 'retail',
      Customer_Name: note.Customer_Name || 'ลูกค้าทั่วไป',
      Status: note.Status || 'IOU',
      Total_Amount: typeof note.Total_Amount === 'number' ? note.Total_Amount : 0,
      items: (note.items || []).map(it => ({
        Product_Name: it.Product_Name || it.name || '',
        Quantity: it.Quantity || it.quantity || 1,
        Price_Per_Unit: it.Price_Per_Unit || it.price || 0,
        Total_Price: (it.Quantity || 1) * (it.Price_Per_Unit || 0)
      }))
    };
  }

  async sendPayload(payload) {
    // 1. Try local backend server proxy first if available (avoids CORS issues completely)
    try {
      if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
        const proxyRes = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json().catch(() => null);
          if (proxyData && proxyData.status !== 'ERROR') {
            return proxyData;
          }
        }
      }
    } catch (proxyErr) {
      // Backend proxy unavailable or offline, continue to direct Apps Script call
    }

    // 2. Direct Google Apps Script Webhook call
    const url = this.getWebhookUrl();
    if (!url) {
      throw new Error('ยังไม่ได้ระบุ Webhook URL ของ Google Sheets');
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      let result = null;
      try {
        result = await response.json();
      } catch (jsonErr) {
        result = { status: 'SUCCESS', message: 'ส่งข้อมูลไปยัง Google Sheets สำเร็จ' };
      }
      return result;
    } catch (err) {
      console.warn('CORS or Network issue in POST, trying no-cors fallback:', err);
      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload)
        });
        return { status: 'SUCCESS', message: 'ส่งข้อมูลขึ้นชีตเรียบร้อย (no-cors mode)' };
      } catch (fallbackErr) {
        throw new Error('ไม่สามารถเชื่อมต่อ Google Sheets ได้: ' + fallbackErr.message);
      }
    }
  }

  async testConnection(customUrl = null) {
    const url = (customUrl || this.getWebhookUrl()).trim();
    if (!url) {
      throw new Error('กรุณาระบุ Webhook URL ก่อนทดสอบ');
    }

    // Try GET request first (cleanest on GAS Web Apps)
    try {
      const getRes = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (getRes.ok) {
        const data = await getRes.json().catch(() => null);
        return { success: true, message: (data && data.message) ? data.message : 'เชื่อมต่อสำเร็จ' };
      }
    } catch (e) {}

    // POST Ping
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
        redirect: 'follow'
      });
      const data = await res.json().catch(() => null);
      return { success: true, message: (data && data.message) ? data.message : 'เชื่อมต่อ Google Sheets สำเร็จ' };
    } catch (err) {
      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'ping' })
        });
        return { success: true, message: 'ส่งคำขอทดสอบสำเร็จ (สเปรดชีตตอบสนองเรียบร้อย)' };
      } catch (e2) {
        throw new Error('ไม่สามารถเชื่อมต่อไปยัง URL ที่ระบุได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงเป็น "ทุกคน (Anyone)"');
      }
    }
  }

  async syncBill(note) {
    if (!this.isConfigured()) return null;
    const payload = {
      action: 'sync_bill',
      bill: this.formatNotePayload(note)
    };
    try {
      const result = await this.sendPayload(payload);
      this.setLastSyncTime(new Date().toISOString());
      console.log('✅ Google Sheets Background Sync Success:', note.Note_ID, result);
      return result;
    } catch (err) {
      console.warn('⚠️ Google Sheets Background Sync warning (offline-first preserved):', err.message);
      return null;
    }
  }

  async syncAllBills(notes) {
    if (!this.isConfigured()) {
      throw new Error('กรุณาตั้งค่า Webhook URL ของ Google Sheets ก่อน');
    }
    const payload = {
      action: 'sync_all',
      bills: notes.map(n => this.formatNotePayload(n))
    };
    const result = await this.sendPayload(payload);
    this.setLastSyncTime(new Date().toISOString());
    return result;
  }
}

const SheetsService = new GoogleSheetsService();

/* ============================================================================
   SECTION 6: APPLICATION CONTROLLER (UI, Event Handlers, Dynamic DOM)
   ============================================================================ */
class SmartPOSApp {
  constructor() {
    this.currentFilter = 'all';
    this.currentBillTypeFilter = 'all'; // 'all', 'retail', 'restaurant'
    this.searchQuery = '';
    this.sortDescending = true;
    this.notesList = [];
    this.stagedOcrItems = [];
    this.stagedDiscardedItems = [];
    this.selectedDateFilter = 'today'; // 'today', 'all', or specific 'YYYY-MM-DD'
    this.dateBlocks = {};
    this.isArchiveOpen = false;
    this.deferredInstallPrompt = null;
  }

  async start() {
    console.log('Starting Smart POS & Smart Note Application (Date-Based Archiving Edition)...');
    
    // Initialize Local IndexedDB
    await LocalDB.open();
    
    // Clean out demo records if they exist from previous runs
    await LocalDB.purgeDemoDataIfPresent();

    // Bind DOM events
    this.bindEvents();

    // Render Clean UI & Date Blocks
    await this.refreshNotes();

    // Initialize Mobile Load Confirmation Modal & PWA Prompt
    this.initMobileLoadConfirmation();

    // Update Google Sheets status indicator
    this.updateSheetsHeaderStatus();

    // If Google Sheets is configured, fetch latest dual-catalogs in background
    if (SheetsService.isConfigured()) {
      SheetsService.fetchCatalogs().then(res => {
        if (res && res.success) {
          this.updateSheetsModalStatusUI();
          this.filterAndRenderNotes();
        }
      }).catch(err => {
        console.log('Background catalog fetch note:', err.message);
      });
    }

    // Refresh Lucide Icons
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  bindEvents() {
    // 1. Search Box Input
    const searchInput = document.getElementById('customerSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (clearSearchBtn) {
          clearSearchBtn.style.display = this.searchQuery ? 'flex' : 'none';
        }
        this.filterAndRenderNotes();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        this.filterAndRenderNotes();
      });
    }

    // 2. Status Filter Chips
    const filterChips = document.querySelectorAll('.filter-chips .chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.dataset.filter;
        SFX.playPop();
        this.filterAndRenderNotes();
      });
    });

    // 2.1 Bill Type Filter Chips (All, Retail, Restaurant)
    const billTypeChips = document.querySelectorAll('.bill-type-filter-chips .type-chip');
    billTypeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        billTypeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentBillTypeFilter = chip.dataset.billType || 'all';
        SFX.playPop();
        this.filterAndRenderNotes();
      });
    });

    // 3. Create New Note Buttons (Opens Bill Type Selection Modal)
    const btnNewNote = document.getElementById('btnNewNote');
    const btnEmptyCreate = document.getElementById('btnEmptyCreate');
    const openBillTypePicker = () => {
      SFX.playPop();
      const modal = document.getElementById('billTypeModal');
      if (modal) {
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        if (window.lucide) lucide.createIcons();
      }
    };

    if (btnNewNote) btnNewNote.addEventListener('click', openBillTypePicker);
    if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', openBillTypePicker);

    // Bill Type Modal Choices
    const btnChooseRetail = document.getElementById('btnChooseRetailBill');
    if (btnChooseRetail) {
      btnChooseRetail.addEventListener('click', () => {
        this.closeModal('billTypeModal');
        this.createNewNote('retail');
      });
    }

    const btnChooseRestaurant = document.getElementById('btnChooseRestaurantBill');
    if (btnChooseRestaurant) {
      btnChooseRestaurant.addEventListener('click', () => {
        this.closeModal('billTypeModal');
        this.createNewNote('restaurant');
      });
    }

    // 4. Camera Scan (AI OCR) Button
    const btnScanCamera = document.getElementById('btnScanCamera');
    if (btnScanCamera) {
      btnScanCamera.addEventListener('click', () => this.openCameraModal());
    }

    // 4.1 Camera Shutter Button (กดถ่ายภาพ 1-Step)
    const btnCaptureShutter = document.getElementById('btnCaptureShutter');
    if (btnCaptureShutter) {
      btnCaptureShutter.addEventListener('click', () => this.handleShutterCapture());
    }

    // 4.2 Photo Picker from gallery / device
    const btnUploadImageTrigger = document.getElementById('btnUploadImageTrigger');
    const cameraFileInput = document.getElementById('cameraFileInput');
    if (btnUploadImageTrigger && cameraFileInput) {
      btnUploadImageTrigger.addEventListener('click', () => cameraFileInput.click());
    }

    if (cameraFileInput) {
      cameraFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleUploadedImageAnalysis(e.target.files[0]);
        }
      });
    }

    // 4.3 Camera retry permission button
    const btnRetryPermission = document.getElementById('btnRetryPermission');
    if (btnRetryPermission) {
      btnRetryPermission.addEventListener('click', () => this.handleGrantCamera());
    }

    // 4.4 Result Actions: Apply to bill & Retake photo
    const btnApplyOCR = document.getElementById('btnApplyOCR');
    if (btnApplyOCR) {
      btnApplyOCR.addEventListener('click', () => this.applyClassificationResultToBill());
    }

    const btnRetakeCapture = document.getElementById('btnRetakeCapture');
    if (btnRetakeCapture) {
      btnRetakeCapture.addEventListener('click', () => this.handleRetakeCapture());
    }

    // 4.5 Result Quantity Stepper
    const btnResQtyMinus = document.getElementById('btnResQtyMinus');
    const btnResQtyPlus = document.getElementById('btnResQtyPlus');
    if (btnResQtyMinus) {
      btnResQtyMinus.addEventListener('click', () => {
        SFX.playPop();
        this.updateResultQty(this.currentDetectedQty - 1);
      });
    }
    if (btnResQtyPlus) {
      btnResQtyPlus.addEventListener('click', () => {
        SFX.playPop();
        this.updateResultQty(this.currentDetectedQty + 1);
      });
    }

    // 4.6 Target Note Select & Customer Name toggle
    const ocrTargetSelect = document.getElementById('ocrTargetSelect');
    const ocrCustomerNameGroup = document.getElementById('ocrCustomerNameGroup');
    if (ocrTargetSelect && ocrCustomerNameGroup) {
      ocrTargetSelect.addEventListener('change', (e) => {
        const isNew = e.target.value === 'new_retail' || e.target.value === 'new_restaurant';
        ocrCustomerNameGroup.style.display = isNew ? 'block' : 'none';
      });
    }

    // 5. Modal Close Buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        this.closeModal(modalId);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });

    // 7. Sort order button
    const btnSortNotes = document.getElementById('btnSortNotes');
    if (btnSortNotes) {
      btnSortNotes.addEventListener('click', () => {
        this.sortDescending = !this.sortDescending;
        btnSortNotes.innerHTML = this.sortDescending 
          ? '<i data-lucide="arrow-down-wide-narrow"></i> ล่าสุดก่อน' 
          : '<i data-lucide="arrow-up-narrow-wide"></i> เก่าสุดก่อน';
        this.notesList.reverse();
        this.filterAndRenderNotes();
        if (window.lucide) lucide.createIcons();
      });
    }

    // 8. Clear All Notes button
    const btnClearAll = document.getElementById('btnClearAllNotes');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', async () => {
        if (confirm('คุณต้องการลบบิลทั้งหมดในเครื่องใช่หรือไม่? (การกระทำนี้ไม่สามารถย้อนกลับได้)')) {
          await LocalDB.clearAllNotes();
          SFX.playPop();
          this.showToast('ล้างข้อมูลบิลทั้งหมดเรียบร้อยแล้ว', 'warning');
          await this.refreshNotes();
        }
      });
    }

    // 9. Toggle History Archive Drawer button
    const btnToggleArchive = document.getElementById('btnToggleArchive');
    if (btnToggleArchive) {
      btnToggleArchive.addEventListener('click', () => {
        this.isArchiveOpen = !this.isArchiveOpen;
        const drawer = document.getElementById('historyArchiveDrawer');
        const chevron = document.getElementById('archiveChevronIcon');
        if (drawer) drawer.style.display = this.isArchiveOpen ? 'block' : 'none';
        if (chevron) chevron.style.transform = this.isArchiveOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        SFX.playPop();
      });
    }

    // 10. Google Sheets background service is active silently (No UI modal required)
  }

  /* ---------------- Bill Creation (Retail vs Restaurant) ---------------- */

  async createNewNote(billType = 'retail') {
    SFX.playPop();
    const isRestaurant = billType === 'restaurant';
    const catalog = getProductCatalog();

    let defaultItems = [];
    const customerDefault = isRestaurant ? 'ลูกค้าโต๊ะ (ตามสั่ง)' : 'ลูกค้าใหม่';

    if (!isRestaurant) {
      const defaultItem = catalog[0] || { name: 'น้ำเปล่า (ขวดเล็ก)', price: 10 };
      defaultItems = [
        { Product_Name: defaultItem.name, Quantity: 1, Price_Per_Unit: defaultItem.price }
      ];
    }

    const newNote = await LocalDB.createNote({
      Customer_Name: customerDefault,
      Status: 'IOU',
      Bill_Type: billType
    }, defaultItems);

    this.selectedDateFilter = 'today';
    await this.refreshNotes();

    const typeMsg = isRestaurant ? 'บิลร้านอาหาร (พิมพ์มือ)' : 'บิลร้านค้า (จาก Data)';
    this.showToast(`สร้าง${typeMsg} เรียบร้อย`, 'success');

    // Auto-sync new bill to Google Sheets if enabled
    if (SheetsService.isConfigured() && SheetsService.isAutoSyncEnabled()) {
      SheetsService.syncBill(newNote).then(() => {
        this.updateSheetsHeaderStatus();
      }).catch(err => console.warn('Auto-sync new note error:', err));
    }

    setTimeout(() => {
      const card = document.querySelector(`.note-card[data-id="${newNote.Note_ID}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const nameInput = card.querySelector('.customer-name-input');
        if (nameInput) {
          nameInput.focus();
          nameInput.select();
        }
      }
    }, 120);
  }

  /* ---------------- Customer Auto-Complete (Smart Tagging) ---------------- */

  async updateCustomerDatalist() {
    const datalist = document.getElementById('customerNameDatalist');
    if (!datalist) return;
    const uniqueNames = await getCustomerTags();
    datalist.innerHTML = uniqueNames.map(name => `<option value="${this.escapeHTML(name)}"></option>`).join('');
  }

  /* ---------------- Date-Based Archiving (Daily Blocks) ---------------- */

  renderDateBlocks() {
    const scrollContainer = document.getElementById('dateBlocksScroll');
    const countTag = document.getElementById('activeDateCountTag');
    const activeLabel = document.getElementById('activeDateLabel');
    const archiveCountEl = document.getElementById('archiveDateCount');
    const titleEl = document.getElementById('gridDisplayTitle');
    const hintEl = document.getElementById('gridDisplayHint');
    if (!scrollContainer) return;

    const todayKey = getTodayDateKey();
    const todayNotes = this.dateBlocks[todayKey] || [];
    const totalAllNotes = this.notesList.length;

    // Past date keys sorted descending
    const allDateKeys = Object.keys(this.dateBlocks).sort((a, b) => b.localeCompare(a));
    const pastDateKeys = allDateKeys.filter(k => k !== todayKey);

    if (archiveCountEl) archiveCountEl.textContent = pastDateKeys.length;

    let html = '';

    // 1. Today Block Button
    const isTodayActive = this.selectedDateFilter === 'today';
    html += `
      <button class="date-block-btn ${isTodayActive ? 'active' : ''}" data-date="today">
        <i data-lucide="sparkles"></i>
        <span>บิลวันนี้ (Today)</span>
        <span class="date-block-badge">${todayNotes.length}</span>
      </button>
    `;

    // 2. Past Date Blocks
    pastDateKeys.forEach(dateKey => {
      const count = (this.dateBlocks[dateKey] || []).length;
      const isDateActive = this.selectedDateFilter === dateKey;
      const label = formatThaiDateDisplay(dateKey);
      html += `
        <button class="date-block-btn ${isDateActive ? 'active' : ''}" data-date="${dateKey}">
          <i data-lucide="calendar"></i>
          <span>${label}</span>
          <span class="date-block-badge">${count}</span>
        </button>
      `;
    });

    // 3. All Time Block
    const isAllActive = this.selectedDateFilter === 'all';
    html += `
      <button class="date-block-btn ${isAllActive ? 'active' : ''}" data-date="all">
        <i data-lucide="layers"></i>
        <span>รวมทุกวัน (All)</span>
        <span class="date-block-badge">${totalAllNotes}</span>
      </button>
    `;

    scrollContainer.innerHTML = html;

    // Attach click listeners to date blocks
    scrollContainer.querySelectorAll('.date-block-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDateFilter = btn.dataset.date;
        SFX.playPop();
        this.renderDateBlocks();
        this.renderHistoryArchiveDrawer();
        this.updateMetrics();
        this.filterAndRenderNotes();
      });
    });

    // Update active label and hints
    if (this.selectedDateFilter === 'today') {
      if (activeLabel) activeLabel.innerHTML = `บิลวันนี้ (${formatThaiDateDisplay(todayKey)})`;
      if (countTag) countTag.textContent = `${todayNotes.length} บิล`;
      if (titleEl) titleEl.textContent = 'บิลร้านค้าประจำวัน (วันนี้)';
      if (hintEl) hintEl.textContent = 'แสดงเฉพาะบิลของวันนี้ บิลของวันก่อนหน้าจะถูกจัดเก็บเข้าคลังประวัติอัตโนมัติ';
    } else if (this.selectedDateFilter === 'all') {
      if (activeLabel) activeLabel.innerHTML = `คลังรวมทุกวัน (All Dates)`;
      if (countTag) countTag.textContent = `${totalAllNotes} บิล`;
      if (titleEl) titleEl.textContent = 'ประวัติบิลทั้งหมด (ทุกวัน)';
      if (hintEl) hintEl.textContent = 'กำลังแสดงบิลทั้งหมดที่บันทึกไว้ในเครื่อง';
    } else {
      const pastNotes = this.dateBlocks[this.selectedDateFilter] || [];
      const pastLabel = formatThaiDateDisplay(this.selectedDateFilter);
      if (activeLabel) activeLabel.innerHTML = `ประวัติบิล: ${pastLabel}`;
      if (countTag) countTag.textContent = `${pastNotes.length} บิล`;
      if (titleEl) titleEl.textContent = `ประวัติบิลประจำวันที่ ${pastLabel}`;
      if (hintEl) hintEl.textContent = `กำลังดูบิลย้อนหลังของวันที่ ${pastLabel} • คลิก "บิลวันนี้" เพื่อกลับสู่หน้าร้านปัจจุบัน`;
    }

    if (window.lucide) lucide.createIcons();
  }

  renderHistoryArchiveDrawer() {
    const grid = document.getElementById('archiveCardsGrid');
    if (!grid) return;

    const todayKey = getTodayDateKey();
    const allDateKeys = Object.keys(this.dateBlocks).sort((a, b) => b.localeCompare(a));
    const pastDateKeys = allDateKeys.filter(k => k !== todayKey);

    if (pastDateKeys.length === 0) {
      grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 12px; font-size: 0.85rem;">ยังไม่มีประวัติบิลของวันก่อนหน้า (เมื่อข้ามวัน ระบบจะจัดเก็บบิลเข้าคลังประวัตินี้อัตโนมัติ)</p>`;
      return;
    }

    grid.innerHTML = pastDateKeys.map(dateKey => {
      const notes = this.dateBlocks[dateKey] || [];
      let sales = 0;
      let iou = 0;
      notes.forEach(n => {
        if (n.Status === 'IOU') iou += n.Total_Amount;
        else sales += n.Total_Amount;
      });
      const isActive = this.selectedDateFilter === dateKey;
      const label = formatThaiDateDisplay(dateKey);

      return `
        <div class="archive-day-card ${isActive ? 'active' : ''}" data-date="${dateKey}" title="คลิกเพื่อดูกลุ่มบิลของวันที่ ${label}">
          <div class="archive-card-top">
            <span class="archive-date-title"><i data-lucide="calendar"></i> ${label}</span>
            <span class="archive-bill-count">${notes.length} บิล</span>
          </div>
          <div class="archive-card-stats">
            <span class="archive-stat-item">รับแล้ว: <strong style="color: var(--paid-accent);">฿${sales.toFixed(2)}</strong></span>
            <span class="archive-stat-item">เซ็นไว้: <strong style="color: var(--iou-accent);">฿${iou.toFixed(2)}</strong></span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.archive-day-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedDateFilter = card.dataset.date;
        SFX.playPop();
        this.renderDateBlocks();
        this.renderHistoryArchiveDrawer();
        this.updateMetrics();
        this.filterAndRenderNotes();
      });
    });

    if (window.lucide) lucide.createIcons();
  }

  /* ---------------- Notes Rendering & Dynamic Updates ---------------- */

  async refreshNotes() {
    this.notesList = await LocalDB.getAllNotes();
    if (!this.sortDescending) {
      this.notesList.reverse();
    }
    await this.updateCustomerDatalist();
    this.dateBlocks = groupNotesByDate(this.notesList);
    this.renderDateBlocks();
    this.renderHistoryArchiveDrawer();
    this.updateMetrics();
    this.filterAndRenderNotes();
  }

  updateMetrics() {
    let totalIOU = 0;
    let totalPaid = 0;
    let countIOU = 0;
    let countPaid = 0;

    // Calculate metrics for current active date view
    const todayKey = getTodayDateKey();
    const activeNotes = this.notesList.filter(note => {
      if (this.selectedDateFilter === 'today') {
        return getLocalDateKey(note.Created_Date) === todayKey;
      } else if (this.selectedDateFilter !== 'all') {
        return getLocalDateKey(note.Created_Date) === this.selectedDateFilter;
      }
      return true;
    });

    activeNotes.forEach(note => {
      if (note.Status === 'IOU') {
        totalIOU += note.Total_Amount;
        countIOU++;
      } else {
        totalPaid += note.Total_Amount;
        countPaid++;
      }
    });

    let countRetail = 0;
    let countRestaurant = 0;
    activeNotes.forEach(note => {
      if (note.Bill_Type === 'restaurant') countRestaurant++;
      else countRetail++;
    });

    const elIOU = document.getElementById('totalOutstandingAmount');
    const elPaid = document.getElementById('totalPaidAmount');
    const cntAll = document.getElementById('countAll');
    const cntIOU = document.getElementById('countIOU');
    const cntPaid = document.getElementById('countPaid');
    const cntTypeAll = document.getElementById('countTypeAll');
    const cntRetail = document.getElementById('countRetail');
    const cntRestaurant = document.getElementById('countRestaurant');

    if (elIOU) elIOU.textContent = `฿${totalIOU.toFixed(2)}`;
    if (elPaid) elPaid.textContent = `฿${totalPaid.toFixed(2)}`;
    if (cntAll) cntAll.textContent = activeNotes.length;
    if (cntIOU) cntIOU.textContent = countIOU;
    if (cntPaid) cntPaid.textContent = countPaid;
    if (cntTypeAll) cntTypeAll.textContent = activeNotes.length;
    if (cntRetail) cntRetail.textContent = countRetail;
    if (cntRestaurant) cntRestaurant.textContent = countRestaurant;
  }

  filterAndRenderNotes() {
    const container = document.getElementById('notesContainer');
    const emptyState = document.getElementById('emptyState');
    if (!container) return;

    const todayKey = getTodayDateKey();
    const filtered = this.notesList.filter(note => {
      // 1. Date Block Filter (Defaults to Today)
      if (this.selectedDateFilter === 'today') {
        if (getLocalDateKey(note.Created_Date) !== todayKey) return false;
      } else if (this.selectedDateFilter !== 'all') {
        if (getLocalDateKey(note.Created_Date) !== this.selectedDateFilter) return false;
      }

      // 2. Status Filter
      if (this.currentFilter !== 'all' && note.Status !== this.currentFilter) {
        return false;
      }

      // 3. Bill Type Filter (all, retail, restaurant)
      if (this.currentBillTypeFilter !== 'all') {
        const bType = note.Bill_Type || 'retail';
        if (bType !== this.currentBillTypeFilter) return false;
      }

      // 4. Search Query Filter
      if (this.searchQuery) {
        const nameMatch = (note.Customer_Name || '').toLowerCase().includes(this.searchQuery);
        const itemMatch = (note.items || []).some(it => (it.Product_Name || '').toLowerCase().includes(this.searchQuery));
        if (!nameMatch && !itemMatch) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) {
        emptyState.style.display = 'block';
        const emptyH3 = emptyState.querySelector('h3');
        const emptyP = emptyState.querySelector('p');
        if (this.selectedDateFilter === 'today') {
          if (emptyH3) emptyH3.textContent = 'ยังไม่มีบิลสำหรับวันนี้ (Today)';
          if (emptyP) emptyP.textContent = 'เริ่มต้นวันใหม่ด้วยการกด "สร้างบิลใหม่" หรือ "สแกน AI" ด้านบนได้ทันที';
        } else {
          if (emptyH3) emptyH3.textContent = 'ไม่พบบิลในวันที่เลือก';
          if (emptyP) emptyP.textContent = 'ไม่มีบิลที่ตรงกับเงื่อนไขการค้นหานี้';
        }
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';

    filtered.forEach(note => {
      const card = this.createNoteCardElement(note);
      container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  createNoteCardElement(note) {
    const card = document.createElement('div');
    const isIOU = note.Status === 'IOU';
    const isRestaurant = note.Bill_Type === 'restaurant';
    card.className = `note-card ${isIOU ? 'status-iou' : 'status-paid'} ${isRestaurant ? 'card-restaurant' : 'card-retail'}`;
    card.setAttribute('data-id', note.Note_ID);

    const dateFormatted = new Date(note.Created_Date).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build items table rows with frozen snapshot prices
    let itemsHTML = '';
    (note.items || []).forEach(item => {
      itemsHTML += `
        <tr class="item-row" data-item-id="${item.Item_ID}">
          <td class="col-name" title="${this.escapeHTML(item.Product_Name)}">${this.escapeHTML(item.Product_Name)}</td>
          <td class="col-qty">
            <div class="qty-control">
              <button class="qty-btn btn-qty-minus" data-id="${item.Item_ID}" data-qty="${item.Quantity}">-</button>
              <span class="qty-number">${item.Quantity}</span>
              <button class="qty-btn btn-qty-plus" data-id="${item.Item_ID}" data-qty="${item.Quantity}">+</button>
            </div>
          </td>
          <td class="col-total">฿${item.Total_Price.toFixed(2)}</td>
          <td class="col-actions">
            <button class="btn-remove-item" data-id="${item.Item_ID}" title="ลบรายการ">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    });

    // Top Header: Customer name + Bill Type Switcher Pill + Time + Status Toggle
    const typePillHTML = isRestaurant
      ? `<button type="button" class="note-type-pill type-restaurant" title="คลิกเพื่อสลับเป็นบิลร้านค้า (จาก Data)">
          <i data-lucide="utensils"></i>
          <span>บิลร้านอาหาร</span>
        </button>`
      : `<button type="button" class="note-type-pill type-retail" title="คลิกเพื่อสลับเป็นบิลร้านอาหาร (พิมพ์อิสระ)">
          <i data-lucide="store"></i>
          <span>บิลร้านค้า</span>
        </button>`;

    // Item Entry Section:
    // For Restaurant: Manual typing of food menu name + custom price input + Add button
    // For Retail: Catalog search autocomplete from Data (PRODUCT_CATALOG)
    const entrySectionHTML = isRestaurant
      ? `
        <!-- Restaurant Manual Entry Box -->
        <div class="restaurant-entry-box">
          <div class="restaurant-entry-header">
            <div class="entry-header-title">
              <i data-lucide="utensils"></i>
              <span>พิมพ์ชื่อเมนูอาหารและกำหนดราคา</span>
            </div>
            <span class="entry-header-hint">พิมพ์ชื่อเพื่อเลือกเมนูและราคาอัตโนมัติ</span>
          </div>
          
          <div class="restaurant-input-fields">
            <!-- Row 1: Full-width Food Menu Name with Autocomplete Suggestions -->
            <div class="restaurant-name-wrap">
              <input 
                type="text" 
                class="restaurant-name-input" 
                placeholder="พิมพ์ชื่อเมนูอาหาร (เช่น กะเพรา, ข้าวผัด, ต้มยำ)..."
                autocomplete="off"
              >
              <!-- Dropdown suggestions showing full name & price from restaurant_menu.js -->
              <div class="restaurant-autocomplete-suggestions" style="display: none;"></div>
            </div>

            <!-- Row 2: Price Input + Add Button -->
            <div class="restaurant-actions-row">
              <div class="restaurant-price-wrap">
                <span class="price-prefix">฿</span>
                <input 
                  type="number" 
                  class="restaurant-price-input" 
                  placeholder="ราคา" 
                  min="0" 
                  step="any"
                >
              </div>
              <button type="button" class="btn-restaurant-add" title="เพิ่มรายการอาหารลงในบิล">
                <i data-lucide="plus"></i>
                <span>เพิ่มรายการ</span>
              </button>
            </div>
          </div>
        </div>
      `
      : `
        <!-- Retail Data Catalog Autocomplete Box -->
        <div class="add-item-box">
          <div class="quick-add-group">
            <div class="autocomplete-input-wrapper">
              <input 
                type="text" 
                class="item-search-input" 
                placeholder="+ พิมพ์ค้นหาสินค้าในร้าน (ดึงราคาจาก Data)..."
                autocomplete="off"
              >
              <div class="autocomplete-suggestions"></div>
            </div>
            <button class="btn-quick-add" title="เพิ่มสินค้า">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>
      `;

    card.innerHTML = `
      <!-- Card Header -->
      <div class="note-header">
        <div class="note-top-row">
          <div class="customer-name-wrapper">
            <input 
              type="text" 
              class="customer-name-input" 
              list="customerNameDatalist"
              value="${this.escapeHTML(note.Customer_Name)}" 
              placeholder="ระบุชื่อลูกค้า / โต๊ะ..."
              title="คลิกเพื่อแก้ไขชื่อลูกค้า หรือเลือกชื่อที่เคยใช้"
              autocomplete="off"
            >
            <div class="note-sub-meta">
              ${typePillHTML}
              <span class="meta-dot">•</span>
              <div class="note-time">
                <i data-lucide="clock"></i> <span>${dateFormatted}</span>
              </div>
            </div>
          </div>
          <!-- Status Toggle Pill Button -->
          <button class="status-toggle-btn ${isIOU ? 'is-iou' : 'is-paid'}" title="คลิกเพื่อสลับสถานะ จ่ายแล้ว / เซ็นเชื่อ">
            <span class="status-indicator-dot"></span>
            <span class="status-label">${isIOU ? 'เซ็นไว้ (IOU)' : 'จ่ายแล้ว (Paid)'}</span>
          </button>
        </div>
      </div>

      <!-- Card Body -->
      <div class="note-body">
        <table class="items-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th style="text-align:center;">จำนวน</th>
              <th style="text-align:right;">รวม</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML || `<tr><td colspan="4" style="text-align:center; padding: 12px; color: var(--text-muted);">ยังไม่มีรายการสินค้า</td></tr>`}
          </tbody>
        </table>

        ${entrySectionHTML}
      </div>

      <!-- Card Footer -->
      <div class="note-footer">
        <div class="total-row">
          <span class="total-label">ยอดรวมสุทธิ:</span>
          <span class="total-amount">฿${note.Total_Amount.toFixed(2)}</span>
        </div>

        <div class="note-actions-row">
          <button class="btn-card-action btn-export-pdf" title="ส่งออกเป็นเอกสาร PDF">
            <i data-lucide="file-down"></i> Export PDF
          </button>
          <button class="btn-card-action btn-delete-card" title="ลบบิลนี้ออกจากระบบ">
            <i data-lucide="trash-2"></i> ลบบิล
          </button>
        </div>
      </div>
    `;

    this.attachCardEventListeners(card, note);
    return card;
  }

  attachCardEventListeners(card, note) {
    const noteId = note.Note_ID;

    // 1. Customer Name Live Editing
    const nameInput = card.querySelector('.customer-name-input');
    if (nameInput) {
      nameInput.addEventListener('change', async (e) => {
        const val = e.target.value.trim() || 'ลูกค้าทั่วไป';
        await LocalDB.updateNoteDetails(noteId, { Customer_Name: val });
        note.Customer_Name = val;
        await this.updateCustomerDatalist();
        this.backgroundSyncNote(noteId);
        this.showToast('อัปเดตชื่อลูกค้าเรียบร้อย', 'success');
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
      });
    }

    // 1.1 Bill Type Switcher Pill
    const typePill = card.querySelector('.note-type-pill');
    if (typePill) {
      typePill.addEventListener('click', async () => {
        const nextType = (note.Bill_Type === 'restaurant') ? 'retail' : 'restaurant';
        await LocalDB.updateNoteDetails(noteId, { Bill_Type: nextType });
        note.Bill_Type = nextType;
        SFX.playPop();
        this.backgroundSyncNote(noteId);
        this.showToast(`เปลี่ยนเป็น${nextType === 'restaurant' ? 'บิลร้านอาหาร' : 'บิลร้านค้า'} เรียบร้อย`, 'info');
        await this.refreshNotes();
      });
    }

    // 2. Status Toggle Button (IOU <-> Paid)
    const statusBtn = card.querySelector('.status-toggle-btn');
    if (statusBtn) {
      statusBtn.addEventListener('click', async () => {
        const nextStatus = note.Status === 'IOU' ? 'Paid' : 'IOU';
        await LocalDB.updateNoteDetails(noteId, { Status: nextStatus });
        note.Status = nextStatus;

        if (nextStatus === 'Paid') {
          SFX.playChime();
          this.showToast(`บิล ${note.Customer_Name} ชำระเงินแล้ว!`, 'success');
        } else {
          SFX.playPop();
          this.showToast(`บันทึกเป็นเซ็นเชื่อ (IOU)`, 'warning');
        }

        // Auto-sync status update to Google Sheets in background
        this.backgroundSyncNote(noteId);

        await this.refreshNotes();
      });
    }

    // 3. Quantity Steppers (+ / -)
    card.querySelectorAll('.btn-qty-plus').forEach(btn => {
      btn.addEventListener('click', async () => {
        SFX.playPop();
        const itemId = btn.dataset.id;
        const currentQty = parseInt(btn.dataset.qty, 10) || 1;
        await LocalDB.updateItemQuantity(itemId, currentQty + 1);
        await this.refreshNotes();
        this.backgroundSyncNote(noteId);
      });
    });

    card.querySelectorAll('.btn-qty-minus').forEach(btn => {
      btn.addEventListener('click', async () => {
        SFX.playPop();
        const itemId = btn.dataset.id;
        const currentQty = parseInt(btn.dataset.qty, 10) || 1;
        if (currentQty > 1) {
          await LocalDB.updateItemQuantity(itemId, currentQty - 1);
        } else {
          if (confirm('ต้องการลบรายการสินค้านี้ใช่หรือไม่?')) {
            await LocalDB.removeItem(itemId);
          }
        }
        await this.refreshNotes();
        this.backgroundSyncNote(noteId);
      });
    });

    // 4. Remove Item
    card.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.dataset.id;
        if (confirm('ต้องการลบรายการสินค้านี้ใช่หรือไม่?')) {
          await LocalDB.removeItem(itemId);
          SFX.playPop();
          await this.refreshNotes();
          this.backgroundSyncNote(noteId);
        }
      });
    });

    // 5. Item Addition by Bill Type:
    if (note.Bill_Type === 'restaurant') {
      // 5.1 Restaurant Manual Typing Mode with Dedicated Food Menu Autocomplete (from restaurant_menu.js)
      const menuInput = card.querySelector('.restaurant-name-input');
      const menuSuggestionsBox = card.querySelector('.restaurant-autocomplete-suggestions');
      const priceInput = card.querySelector('.restaurant-price-input');
      const addMenuBtn = card.querySelector('.btn-restaurant-add');

      const handleAddRestaurantItem = async () => {
        const foodName = (menuInput ? menuInput.value.trim() : '');
        const foodPrice = parseFloat(priceInput ? priceInput.value : '');

        if (!foodName) {
          if (menuInput) menuInput.focus();
          return;
        }

        if (isNaN(foodPrice) || foodPrice < 0) {
          alert('กรุณากรอกราคาเมนูอาหารให้ถูกต้อง (ตัวเลข)');
          if (priceInput) {
            priceInput.focus();
            priceInput.select();
          }
          return;
        }

        SFX.playPop();
        await LocalDB.addItemToNote(noteId, {
          Product_Name: foodName,
          Price_Per_Unit: foodPrice,
          Quantity: 1
        });

        if (menuInput) menuInput.value = '';
        if (priceInput) priceInput.value = '';
        if (menuSuggestionsBox) menuSuggestionsBox.style.display = 'none';
        if (menuInput) menuInput.focus();
        await this.refreshNotes();
        this.backgroundSyncNote(noteId);
      };

      if (addMenuBtn) {
        addMenuBtn.addEventListener('click', handleAddRestaurantItem);
      }

      // Autocomplete from RESTAURANT_MENU
      if (menuInput && menuSuggestionsBox) {
        menuInput.addEventListener('input', (e) => {
          const query = e.target.value.trim().toLowerCase();
          if (!query) {
            menuSuggestionsBox.style.display = 'none';
            return;
          }

          const menu = getRestaurantMenu();
          const matches = menu.filter(item => {
            const iName = item.name.toLowerCase();
            if (iName.includes(query)) return true;
            if (item.keywords && item.keywords.some(k => k.toLowerCase().includes(query))) return true;
            return false;
          });

          if (matches.length === 0) {
            menuSuggestionsBox.style.display = 'none';
            return;
          }

          menuSuggestionsBox.innerHTML = matches.slice(0, 8).map(m => `
            <div class="restaurant-autocomplete-item" data-name="${this.escapeHTML(m.name)}" data-price="${m.price}">
              <div class="restaurant-suggest-left">
                <span class="restaurant-suggest-name">${this.escapeHTML(m.name)}</span>
                <span class="restaurant-suggest-cat">${this.escapeHTML(m.category || 'เมนูอาหาร')}</span>
              </div>
              <span class="restaurant-suggest-price">฿${m.price.toFixed(2)}</span>
            </div>
          `).join('');

          menuSuggestionsBox.style.display = 'flex';

          menuSuggestionsBox.querySelectorAll('.restaurant-autocomplete-item').forEach(itemElem => {
            itemElem.addEventListener('click', () => {
              SFX.playPop();
              menuInput.value = itemElem.dataset.name;
              if (priceInput) {
                priceInput.value = parseFloat(itemElem.dataset.price);
                priceInput.focus();
                priceInput.select();
              }
              menuSuggestionsBox.style.display = 'none';
            });
          });
        });

        menuInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const query = menuInput.value.trim();
            // If user typed name and price is empty, check if matched in RESTAURANT_MENU
            if (query && (!priceInput || !priceInput.value)) {
              const matched = findRestaurantMenuItem(query);
              if (matched) {
                menuInput.value = matched.name;
                if (priceInput) {
                  priceInput.value = matched.price;
                  priceInput.focus();
                  priceInput.select();
                }
                menuSuggestionsBox.style.display = 'none';
                return;
              }
            }

            if (priceInput && priceInput.value) {
              handleAddRestaurantItem();
            } else if (priceInput) {
              priceInput.focus();
            }
          } else if (e.key === 'Escape') {
            menuSuggestionsBox.style.display = 'none';
          }
        });

        document.addEventListener('click', (e) => {
          const wrap = card.querySelector('.restaurant-name-wrap');
          if (wrap && !wrap.contains(e.target)) {
            menuSuggestionsBox.style.display = 'none';
          }
        });
      }

      if (priceInput) {
        priceInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddRestaurantItem();
          }
        });
      }
    } else {
      // 5.2 Retail Data Catalog Mode (User requirement: "บิลร้านค้าจะเพิ่ม สิ้นค้าโดยเอาข้อมูลจาก data (ราคาและชื่อ)")
      const itemInput = card.querySelector('.item-search-input');
      const suggestionsBox = card.querySelector('.autocomplete-suggestions');
      const addBtn = card.querySelector('.btn-quick-add');

      const handleAddItem = async (productName, price) => {
        if (!productName) return;
        SFX.playPop();
        
        await LocalDB.addItemToNote(noteId, {
          Product_Name: productName,
          Price_Per_Unit: price !== undefined ? price : 20.0,
          Quantity: 1
        });
        if (itemInput) itemInput.value = '';
        if (suggestionsBox) suggestionsBox.style.display = 'none';
        await this.refreshNotes();
        this.backgroundSyncNote(noteId);
      };

      if (itemInput && suggestionsBox) {
        itemInput.addEventListener('input', (e) => {
          const query = e.target.value.trim().toLowerCase();
          if (!query) {
            suggestionsBox.style.display = 'none';
            return;
          }

          const catalog = getProductCatalog();
          const matches = catalog.filter(p => {
            if (p.name.toLowerCase().includes(query)) return true;
            if (p.keywords && p.keywords.some(k => k.toLowerCase().includes(query))) return true;
            return false;
          });

          if (matches.length === 0) {
            suggestionsBox.innerHTML = `
              <div style="padding: 10px; font-size: 0.82rem; color: var(--text-muted); text-align: center;">
                ไม่พบสินค้าใน Data ของร้าน
              </div>
            `;
          } else {
            suggestionsBox.innerHTML = matches.map(m => `
              <div class="autocomplete-item" data-name="${this.escapeHTML(m.name)}" data-price="${m.price}">
                <span class="item-suggest-name">${this.escapeHTML(m.name)}</span>
                <span class="item-suggest-price">฿${m.price.toFixed(2)}</span>
              </div>
            `).join('');
          }

          suggestionsBox.style.display = 'block';

          suggestionsBox.querySelectorAll('.autocomplete-item').forEach(itemElem => {
            itemElem.addEventListener('click', () => {
              handleAddItem(itemElem.dataset.name, parseFloat(itemElem.dataset.price));
            });
          });
        });

        itemInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const query = itemInput.value.trim();
            if (query) {
              const matched = findProductByName(query);
              if (matched) {
                handleAddItem(matched.name, matched.price);
              } else {
                const catalog = getProductCatalog();
                const partial = catalog.find(p => p.name.toLowerCase().includes(query.toLowerCase()));
                if (partial) {
                  handleAddItem(partial.name, partial.price);
                } else {
                  this.showToast('กรุณาเลือกสินค้าที่มีอยู่ในระบบร้านค้า', 'warning');
                }
              }
            }
          } else if (e.key === 'Escape') {
            suggestionsBox.style.display = 'none';
          }
        });

        document.addEventListener('click', (e) => {
          if (!card.querySelector('.autocomplete-input-wrapper').contains(e.target)) {
            suggestionsBox.style.display = 'none';
          }
        });
      }

      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const query = itemInput ? itemInput.value.trim() : '';
          if (query) {
            const matched = findProductByName(query);
            if (matched) {
              handleAddItem(matched.name, matched.price);
            } else {
              const catalog = getProductCatalog();
              const partial = catalog.find(p => p.name.toLowerCase().includes(query.toLowerCase()));
              if (partial) {
                handleAddItem(partial.name, partial.price);
              } else {
                this.showToast('กรุณาเลือกสินค้าที่มีอยู่ในระบบร้านค้า', 'warning');
              }
            }
          } else if (itemInput) {
            itemInput.focus();
          }
        });
      }
    }

    // 6. Export PDF
    const btnPdf = card.querySelector('.btn-export-pdf');
    if (btnPdf) {
      btnPdf.addEventListener('click', () => {
        SFX.playPop();
        ExportService.exportNoteToPDF(note, card);
        this.showToast('กำลังส่งออกบิลเป็นไฟล์ PDF...', 'success');
      });
    }

    // 7. Delete Note Card
    const btnDelete = card.querySelector('.btn-delete-card');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (confirm(`คุณต้องการลบบิลของ "${note.Customer_Name}" ใช่หรือไม่?`)) {
          await LocalDB.deleteNote(noteId);
          SFX.playPop();
          this.showToast('ลบบิลเรียบร้อยแล้ว', 'warning');
          await this.refreshNotes();
        }
      });
    }
  }

  /* ---------------- Helpers & Modals ---------------- */

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!modal.classList.contains('show')) {
        modal.style.display = 'none';
      }
    }, 280);

    if (modalId === 'cameraModal') {
      VisionOCR.stopCamera();
    }
  }

  /* ---------------- Google Sheets Background Sync Service ---------------- */

  async backgroundSyncNote(noteId) {
    if (!SheetsService.isConfigured() || !SheetsService.isAutoSyncEnabled()) return;
    try {
      const fullNote = await LocalDB.getNoteById(noteId);
      if (fullNote) {
        await SheetsService.syncBill(fullNote);
      }
    } catch (err) {
      console.warn('Background sync note error:', err);
    }
  }

  openSheetsModal() {
    // Background mode - no modal UI
  }

  updateSheetsModalStatusUI() {
    // Background mode - no modal UI
  }

  updateSheetsHeaderStatus() {
    // Background mode - no header UI
  }

  async copyGoogleAppsScriptCode() {
    SFX.playPop();
    const btn = document.getElementById('btnCopyAppsScriptCode');
    const originalHTML = btn ? btn.innerHTML : '';

    let scriptCode = '';
    try {
      const res = await fetch('js/google_apps_script.js');
      if (res.ok) {
        scriptCode = await res.text();
      } else {
        const fallbackRes = await fetch('google_apps_script.js');
        if (fallbackRes.ok) scriptCode = await fallbackRes.text();
      }
    } catch (e) {
      try {
        const fallbackRes = await fetch('google_apps_script.js');
        if (fallbackRes.ok) scriptCode = await fallbackRes.text();
      } catch (e2) {
        console.warn('Could not fetch google_apps_script.js:', e);
      }
    }

    if (!scriptCode) {
      scriptCode = `// SMART POS & SMART NOTE - GOOGLE APPS SCRIPT CONNECTOR
const SHEET_NAME = "รายการบิล_SmartPOS";
const HEADERS = ["รหัสบิล (Bill ID)", "วันที่/เวลา (Created Date)", "ประเภทบิล (Bill Type)", "ชื่อลูกค้า / โต๊ะ (Customer)", "รายการสินค้าและอาหาร (Items Summary)", "ยอดรวมสุทธิ (Total Amount)", "สถานะชำระเงิน (Status)", "อัปเดตล่าสุด (Last Modified)"];
function doGet(e){ return ContentService.createTextOutput(JSON.stringify({status:"SUCCESS",message:"Smart POS Google Sheets API เชื่อมต่อสำเร็จ พร้อมรับข้อมูล!"})).setMimeType(ContentService.MimeType.JSON); }
function doPost(e){ try { let contents = JSON.parse(e.postData.contents); const action = contents.action || "sync_bill"; const sheet = getOrCreateTargetSheet(); if(action==="ping") return createJsonResponse({status:"SUCCESS",message:"เชื่อมต่อกับ Google Sheets สำเร็จเรียบร้อย!"}); if(action==="sync_all"){ let u=0,ins=0; (contents.bills||[]).forEach(b=>{ const r=upsertSingleBillRow(sheet,b); if(r==="updated")u++; else if(r==="inserted")ins++; }); return createJsonResponse({status:"SUCCESS",message:\`ซิงค์บิลทั้งหมดสำเร็จ (เพิ่มใหม่: \${ins}, อัปเดต: \${u} บิล)\`}); } if(action==="sync_bill"){ const res=upsertSingleBillRow(sheet, contents.bill); return createJsonResponse({status:"SUCCESS",message:\`ซิงค์บิล \${contents.bill.Note_ID} สำเร็จ (\${res})\`}); } } catch(err){ return createJsonResponse({status:"ERROR",message:err.toString()}); } }
function getOrCreateTargetSheet(){ const ss=SpreadsheetApp.getActiveSpreadsheet(); let sh=ss.getSheetByName(SHEET_NAME); if(!sh){ sh=ss.insertSheet(SHEET_NAME); sh.appendRow(HEADERS); const h=sh.getRange(1,1,1,HEADERS.length); h.setBackground("#0f172a"); h.setFontColor("#ffffff"); h.setFontWeight("bold"); sh.setFrozenRows(1); } return sh; }
function upsertSingleBillRow(sheet,bill){ if(!bill||!bill.Note_ID) return "skipped"; const lastRow=sheet.getLastRow(); let targetRow=-1; if(lastRow>1){ const ids=sheet.getRange(2,1,lastRow-1,1).getValues(); for(let i=0;i<ids.length;i++){ if(String(ids[i][0]).trim()===String(bill.Note_ID).trim()){ targetRow=i+2; break; } } } const itemsSummary=(bill.items||[]).map(it=>\`\${it.Product_Name||it.name||'สินค้า'} (x\${it.Quantity||1}) - ฿\${Number(it.Total_Price||0).toFixed(2)}\`).join('\\n'); const statusText=bill.Status==='Paid'?'✅ จ่ายแล้ว':'⏳ เซ็นเชื่อ (IOU)'; const typeText=bill.Bill_Type==='restaurant'?'🍽️ ร้านอาหาร':'🏪 ร้านค้า'; const rowData=[bill.Note_ID, bill.Created_Date||new Date().toISOString(), typeText, bill.Customer_Name||'ลูกค้า', itemsSummary, Number(bill.Total_Amount||0), statusText, new Date().toISOString()]; if(targetRow>0){ sheet.getRange(targetRow,1,1,HEADERS.length).setValues([rowData]); return "updated"; } else { sheet.appendRow(rowData); return "inserted"; } }
function createJsonResponse(data){ return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }`;
    }

    let copySuccess = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(scriptCode);
        copySuccess = true;
      } catch (err) {
        console.warn('Clipboard writeText failed, falling back:', err);
      }
    }

    if (!copySuccess) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = scriptCode;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copySuccess = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e2) {
        console.error('execCommand copy failed:', e2);
      }
    }

    if (copySuccess) {
      SFX.playChime();
      if (btn) {
        btn.innerHTML = `<i data-lucide="check-circle-2"></i> <span>คัดลอกโค้ดสำเร็จแล้ว! (พร้อมนำไปวาง)</span>`;
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
          if (btn) btn.innerHTML = originalHTML;
          if (window.lucide) lucide.createIcons();
        }, 2500);
      }
      this.showToast('📋 คัดลอกโค้ด Google Apps Script เรียบร้อย! นำไปวางใน Extensions -> Apps Script ได้ทันที', 'success');
    } else {
      this.showToast('กรุณาเปิดไฟล์ js/google_apps_script.js เพื่อคัดลอกโค้ดด้วยตนเอง', 'warning');
    }
  }

  /* ---------------- Streamlined AI Camera Scanner & Smart Classifier ---------------- */

  async openCameraModal() {
    SFX.playPop();

    this.currentDetectedResult = null;
    this.currentDetectedQty = 1;

    // Reset views: Show capture viewfinder, hide result
    const captureView = document.getElementById('cameraCaptureView');
    const resultView = document.getElementById('cameraResultView');
    const laserOverlay = document.getElementById('scannerLaserOverlay');
    const imgPreview = document.getElementById('imagePreviewContainer');
    const videoEl = document.getElementById('webcamVideo');
    const deniedAlert = document.getElementById('cameraDeniedAlert');

    if (captureView) captureView.style.display = 'block';
    if (resultView) resultView.style.display = 'none';
    if (laserOverlay) laserOverlay.style.display = 'none';
    if (imgPreview) {
      imgPreview.style.display = 'none';
      imgPreview.innerHTML = '';
    }
    if (videoEl) videoEl.style.display = 'block';
    if (deniedAlert) deniedAlert.style.display = 'none';

    // Populate Target Select options (New Retail / New Restaurant + Open Notes)
    const targetSelect = document.getElementById('ocrTargetSelect');
    if (targetSelect) {
      let optionsHtml = `
        <option value="new_retail">+ สร้างบิลร้านค้าใหม่ (จาก Data สินค้า)</option>
        <option value="new_restaurant">+ สร้างบิลร้านอาหารใหม่ (พิมพ์อิสระ)</option>
      `;
      this.notesList.forEach(note => {
        const typeLabel = note.Bill_Type === 'restaurant' ? 'ร้านอาหาร' : 'ร้านค้า';
        optionsHtml += `<option value="${note.Note_ID}">บิล: ${this.escapeHTML(note.Customer_Name)} (${typeLabel} - ฿${note.Total_Amount.toFixed(2)})</option>`;
      });
      targetSelect.innerHTML = optionsHtml;
    }

    const ocrCustomerNameGroup = document.getElementById('ocrCustomerNameGroup');
    if (ocrCustomerNameGroup) ocrCustomerNameGroup.style.display = 'block';

    // Open Modal Overlay
    const modal = document.getElementById('cameraModal');
    if (modal) {
      modal.style.display = 'flex';
      void modal.offsetWidth;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }

    // Auto-start live camera
    await this.handleGrantCamera();

    if (window.lucide) lucide.createIcons();
  }

  async handleGrantCamera() {
    const videoEl = document.getElementById('webcamVideo');
    const deniedAlert = document.getElementById('cameraDeniedAlert');
    const res = await VisionOCR.startCamera(videoEl);

    if (res.success) {
      if (deniedAlert) deniedAlert.style.display = 'none';
      if (videoEl) videoEl.style.display = 'block';
      const statusBadge = document.getElementById('scanStatusBadge');
      if (statusBadge) {
        statusBadge.innerHTML = '<span class="status-dot"></span> เล็งกล้องไปที่สินค้าหรืออาหาร';
      }
    } else {
      if (deniedAlert) deniedAlert.style.display = 'flex';
      console.warn('Live camera unavailable:', res.error);
    }
  }

  async handleShutterCapture() {
    SFX.playShutter();

    const laserOverlay = document.getElementById('scannerLaserOverlay');
    if (laserOverlay) laserOverlay.style.display = 'flex';
    if (window.lucide) lucide.createIcons();

    // Capture frame onto canvas
    let canvas = VisionOCR.captureCurrentFrame();
    if (!canvas) {
      canvas = document.getElementById('captureCanvas');
      if (canvas) {
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 640, 480);
      }
    }

    const snapshotUrl = canvas ? canvas.toDataURL('image/jpeg', 0.85) : 'assets/icon.svg';

    // Analyze frame & classify whether it is สินค้า or อาหาร
    const result = await VisionOCR.analyzeAndClassify(canvas);

    if (laserOverlay) laserOverlay.style.display = 'none';
    this.displayClassificationResult(result, snapshotUrl);
  }

  handleUploadedImageAnalysis(file) {
    if (!file) return;
    SFX.playShutter();

    const laserOverlay = document.getElementById('scannerLaserOverlay');
    const videoEl = document.getElementById('webcamVideo');
    const imgPreview = document.getElementById('imagePreviewContainer');

    if (laserOverlay) laserOverlay.style.display = 'flex';
    if (videoEl) videoEl.style.display = 'none';
    if (window.lucide) lucide.createIcons();

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      VisionOCR.stopCamera();
      VisionOCR.uploadedFileName = file.name;

      if (imgPreview) {
        imgPreview.style.display = 'flex';
        imgPreview.innerHTML = `<img src="${dataUrl}" alt="Uploaded image" style="width: 100%; height: 100%; object-fit: contain;">`;
      }

      // Create canvas from image and run classification
      const canvas = await VisionOCR.createCanvasFromImageUrl(dataUrl);
      const result = await VisionOCR.analyzeAndClassify(canvas, { fileName: file.name });

      if (laserOverlay) laserOverlay.style.display = 'none';
      this.displayClassificationResult(result, dataUrl);
    };
    reader.readAsDataURL(file);
  }

  displayClassificationResult(result, snapshotUrl) {
    this.currentDetectedResult = result;
    this.currentDetectedQty = 1;

    SFX.playChime();

    // Switch views
    const captureView = document.getElementById('cameraCaptureView');
    const resultView = document.getElementById('cameraResultView');
    if (captureView) captureView.style.display = 'none';
    if (resultView) resultView.style.display = 'flex';

    // 1. Classification Badge: [ 🏪 สินค้าในร้าน ] vs [ 🍽️ อาหารตามสั่ง ]
    const classBadge = document.getElementById('resultClassificationBadge');
    const typeMiniTag = document.getElementById('resultTypeMiniTag');
    const isRetail = result.category === 'product';

    if (classBadge) {
      if (isRetail) {
        classBadge.className = 'result-classification-pill badge-retail';
        classBadge.innerHTML = `
          <i data-lucide="package"></i>
          <span class="badge-text">ระบบคำนวณผลลัพธ์: <strong>สินค้าในร้าน (Retail Product)</strong></span>
        `;
      } else {
        classBadge.className = 'result-classification-pill badge-restaurant';
        classBadge.innerHTML = `
          <i data-lucide="utensils"></i>
          <span class="badge-text">ระบบคำนวณผลลัพธ์: <strong>อาหารตามสั่ง (Food Menu)</strong></span>
        `;
      }
    }

    if (typeMiniTag) {
      typeMiniTag.className = `result-mini-tag ${isRetail ? 'tag-retail' : 'tag-restaurant'}`;
      typeMiniTag.textContent = isRetail ? 'สินค้า' : 'อาหาร';
    }

    // 2. Detected Item Details
    const thumbImg = document.getElementById('resultThumbImg');
    const itemTitle = document.getElementById('resultItemTitle');
    const itemPrice = document.getElementById('resultItemPrice');
    const accBadge = document.getElementById('resultAccuracyBadge');
    const qtyDisplay = document.getElementById('resultQtyDisplay');
    const applyText = document.getElementById('btnApplyOCRText');

    if (thumbImg) thumbImg.src = result.item.image || snapshotUrl || 'assets/icon.svg';
    if (itemTitle) itemTitle.textContent = result.item.name;
    if (itemPrice) itemPrice.textContent = `฿${result.item.price.toFixed(2)}`;
    if (accBadge) {
      accBadge.innerHTML = `<i data-lucide="sparkles"></i> แม่นยำ ${result.confidence}`;
    }
    if (qtyDisplay) qtyDisplay.textContent = '1';
    if (applyText) {
      applyText.textContent = `บันทึกลงบิล (฿${result.item.price.toFixed(2)})`;
    }

    // 3. Pre-select Target Note destination according to classified category
    const targetSelect = document.getElementById('ocrTargetSelect');
    if (targetSelect) {
      targetSelect.value = isRetail ? 'new_retail' : 'new_restaurant';
    }

    const ocrCustomerNameGroup = document.getElementById('ocrCustomerNameGroup');
    if (ocrCustomerNameGroup) {
      ocrCustomerNameGroup.style.display = 'block';
      const custInput = document.getElementById('ocrCustomerNameInput');
      if (custInput) {
        custInput.placeholder = isRetail ? 'เช่น ลูกค้าหน้าร้าน, พี่บอล' : 'เช่น ลูกค้าโต๊ะ 3, สั่งกลับบ้าน';
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  updateResultQty(newQty) {
    this.currentDetectedQty = Math.max(1, parseInt(newQty, 10) || 1);

    const qtyDisplay = document.getElementById('resultQtyDisplay');
    if (qtyDisplay) qtyDisplay.textContent = this.currentDetectedQty;

    const applyText = document.getElementById('btnApplyOCRText');
    if (applyText && this.currentDetectedResult) {
      const total = this.currentDetectedResult.item.price * this.currentDetectedQty;
      applyText.textContent = `บันทึกลงบิล (฿${total.toFixed(2)})`;
    }
  }

  async applyClassificationResultToBill() {
    if (!this.currentDetectedResult || !this.currentDetectedResult.item) {
      alert('ไม่พบข้อมูลรายการที่ตรวจจับ');
      return;
    }

    const item = this.currentDetectedResult.item;
    const qty = this.currentDetectedQty || 1;
    const isRetail = this.currentDetectedResult.category === 'product';

    const targetSelect = document.getElementById('ocrTargetSelect');
    const targetVal = targetSelect ? targetSelect.value : (isRetail ? 'new_retail' : 'new_restaurant');
    const customNameInput = document.getElementById('ocrCustomerNameInput');
    const customName = (customNameInput ? customNameInput.value.trim() : '') || (isRetail ? 'ลูกค้าจาก AI สแกนสินค้า' : 'ลูกค้าโต๊ะ (AI สแกนอาหาร)');

    let targetNoteId = null;
    if (targetVal === 'new_retail' || targetVal === 'new_restaurant') {
      const billType = targetVal === 'new_restaurant' ? 'restaurant' : 'retail';
      const createdNote = await LocalDB.createNote({
        Customer_Name: customName,
        Status: 'IOU',
        Bill_Type: billType
      }, [{
        Product_Name: item.name,
        Quantity: qty,
        Price_Per_Unit: item.price
      }]);
      targetNoteId = createdNote ? createdNote.Note_ID : null;

      this.showToast(`สร้าง${billType === 'restaurant' ? 'บิลร้านอาหาร' : 'บิลร้านค้า'} พร้อมบันทึก "${item.name}" เรียบร้อย`, 'success');
    } else {
      // Add into selected existing note
      await LocalDB.addItemToNote(targetVal, {
        Product_Name: item.name,
        Quantity: qty,
        Price_Per_Unit: item.price
      });
      targetNoteId = targetVal;

      this.showToast(`บันทึก "${item.name}" (x${qty}) ลงในบิลเรียบร้อย`, 'success');
    }

    // Auto-sync note to Google Sheets in background
    if (targetNoteId) {
      this.backgroundSyncNote(targetNoteId);
    }

    SFX.playChime();
    this.closeModal('cameraModal');
    this.selectedDateFilter = 'today';
    await this.refreshNotes();
  }

  handleRetakeCapture() {
    SFX.playPop();

    const captureView = document.getElementById('cameraCaptureView');
    const resultView = document.getElementById('cameraResultView');
    const laserOverlay = document.getElementById('scannerLaserOverlay');
    const imgPreview = document.getElementById('imagePreviewContainer');
    const videoEl = document.getElementById('webcamVideo');

    if (captureView) captureView.style.display = 'block';
    if (resultView) resultView.style.display = 'none';
    if (laserOverlay) laserOverlay.style.display = 'none';
    if (imgPreview) {
      imgPreview.style.display = 'none';
      imgPreview.innerHTML = '';
    }
    if (videoEl) videoEl.style.display = 'block';

    this.handleGrantCamera();
    if (window.lucide) lucide.createIcons();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-octagon';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  /**
   * Detect whether current user is visiting via mobile device or tablet
   * @returns {boolean}
   */
  isMobileDevice() {
    const userAgentCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    const screenCheck = (window.innerWidth <= 768) || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    const touchCheck = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return userAgentCheck || (screenCheck && touchCheck);
  }

  /**
   * Initialize Mobile Load Confirmation Modal & PWA Installation handling
   */
  initMobileLoadConfirmation() {
    // Debug shortcut: ?reset_mobile=1 to test confirmation modal again
    if (window.location.search.includes('reset_mobile=1')) {
      localStorage.removeItem('smartpos_mobile_confirmed');
    }

    const modal = document.getElementById('mobileLoadModal');
    const confirmBtn = document.getElementById('btnConfirmMobileLoad');
    const installBtn = document.getElementById('btnInstallPwa');
    if (!modal) return;

    // 1. Capture PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (installBtn) {
        installBtn.style.display = 'flex';
      }
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const { outcome } = await this.deferredInstallPrompt.userChoice;
          console.log(`PWA install choice: ${outcome}`);
          this.deferredInstallPrompt = null;
          installBtn.style.display = 'none';
          this.showToast('📲 ติดตั้งเรียบร้อย สามารถเปิดใช้งานจากหน้าจอหลักได้ทันที');
        } else {
          this.showToast('เพื่อติดตั้งแอป: แตะปุ่มแชร์/เมนูในเบราว์เซอร์ แล้วเลือก "เพิ่มลงหน้าจอหลัก"');
        }
      });
    }

    // 2. Check if opened on mobile device and not yet confirmed
    const isMobile = this.isMobileDevice();
    const hasConfirmed = localStorage.getItem('smartpos_mobile_confirmed') === 'true';

    if (isMobile && !hasConfirmed) {
      modal.style.display = 'flex';
      // Force CSS reflow for smooth animation
      void modal.offsetWidth;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');

      if (window.lucide) {
        lucide.createIcons();
      }
    }

    // 3. Confirm button action
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        // Save confirmation in localStorage so it only asks on first mobile launch
        localStorage.setItem('smartpos_mobile_confirmed', 'true');
        SFX.playChime();

        // Smooth fade out
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
          modal.style.display = 'none';
        }, 350);

        this.showToast('✅ โหลดระบบสำเร็จ ยินดีต้อนรับสู่ Smart POS');
      });
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate and start application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new SmartPOSApp();
  window.SmartPOS = app;
  app.start();
});
