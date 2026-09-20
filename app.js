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
 * Find product definition from products.js
 * @param {string} searchName - Name of the product
 * @returns {object|null}
 */
function findProductByName(searchName) {
  if (typeof PRODUCT_CATALOG === 'undefined' || !Array.isArray(PRODUCT_CATALOG)) {
    console.error('PRODUCT_CATALOG not loaded from products.js');
    return null;
  }
  return PRODUCT_CATALOG.find(p => p.name.trim().toLowerCase() === searchName.trim().toLowerCase()) || null;
}

/**
 * Get full active product catalog from products.js (with fallback safeguard)
 * @returns {Array}
 */
function getProductCatalog() {
  if (typeof PRODUCT_CATALOG !== 'undefined' && Array.isArray(PRODUCT_CATALOG)) {
    return PRODUCT_CATALOG;
  }
  return [];
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

      const newNote = {
        Note_ID: noteId,
        Customer_Name: (noteData.Customer_Name || noteData.customer || '').trim() || 'ลูกค้าทั่วไป',
        Created_Date: noteData.Created_Date || noteData.date || now,
        Last_Modified_Date: now,
        Total_Amount: totalAmount,
        Status: noteData.Status === 'Paid' ? 'Paid' : 'IOU'
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
   SECTION 4: AI CAMERA SCANNER & OCR SERVICE (Google Vision Mock)
   ============================================================================ */
class VisionOCRService {
  constructor() {
    this.videoElement = null;
    this.stream = null;
    this.isSimulated = false;
  }

  async startCamera(videoElement) {
    this.videoElement = videoElement;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        this.videoElement.srcObject = this.stream;
        this.isSimulated = false;
        return { success: true, mode: 'live' };
      } catch (err) {
        console.warn('Camera permission unavailable, switching to simulated scanner:', err);
        this.isSimulated = true;
        return { success: true, mode: 'simulated' };
      }
    } else {
      this.isSimulated = true;
      return { success: true, mode: 'simulated' };
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

  async analyzeFrame() {
    const catalog = getProductCatalog();
    return new Promise((resolve) => {
      setTimeout(() => {
        const candidates = [...catalog];
        const count = Math.floor(Math.random() * 2) + 2; // 2 or 3 items
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);

        const detectedItems = selected.map(item => {
          const qty = Math.floor(Math.random() * 2) + 1;
          const confidence = (0.92 + Math.random() * 0.07).toFixed(2);
          return {
            Product_Name: item.name,
            Quantity: qty,
            Price_Per_Unit: item.price,
            Confidence: confidence
          };
        });

        resolve({
          status: 'SUCCESS',
          api: 'Google Cloud Vision API (Mock)',
          detectedItems: detectedItems
        });
      }, 750);
    });
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
   SECTION 6: APPLICATION CONTROLLER (UI, Event Handlers, Dynamic DOM)
   ============================================================================ */
class SmartPOSApp {
  constructor() {
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.sortDescending = true;
    this.notesList = [];
    this.stagedOcrItems = [];
    this.selectedDateFilter = 'today'; // 'today', 'all', or specific 'YYYY-MM-DD'
    this.dateBlocks = {};
    this.isArchiveOpen = false;
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

    // 3. Create New Note Button
    const btnNewNote = document.getElementById('btnNewNote');
    const btnEmptyCreate = document.getElementById('btnEmptyCreate');
    const handleCreateNote = async () => {
      SFX.playPop();
      const catalog = getProductCatalog();
      const defaultItem = catalog[0] || { name: 'สินค้าทั่วไป', price: 20 };

      const newNote = await LocalDB.createNote({
        Customer_Name: 'ลูกค้าใหม่',
        Status: 'IOU'
      }, [
        { Product_Name: defaultItem.name, Quantity: 1, Price_Per_Unit: defaultItem.price }
      ]);

      // Automatically focus today when new note is created
      this.selectedDateFilter = 'today';
      await this.refreshNotes();
      this.showToast('สร้างสมาร์ทโน้ตบิลใหม่เรียบร้อย', 'success');
      
      setTimeout(() => {
        const firstCardInput = document.querySelector(`.note-card[data-id="${newNote.Note_ID}"] .customer-name-input`);
        if (firstCardInput) {
          firstCardInput.focus();
          firstCardInput.select();
        }
      }, 100);
    };

    if (btnNewNote) btnNewNote.addEventListener('click', handleCreateNote);
    if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', handleCreateNote);

    // 4. Camera Scan (AI OCR) Button
    const btnScanCamera = document.getElementById('btnScanCamera');
    if (btnScanCamera) {
      btnScanCamera.addEventListener('click', () => this.openCameraModal());
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

    // 6. Camera Modal Buttons
    const btnSwitchCameraMode = document.getElementById('btnSwitchCameraMode');
    if (btnSwitchCameraMode) {
      btnSwitchCameraMode.addEventListener('click', () => {
        VisionOCR.isSimulated = !VisionOCR.isSimulated;
        this.toggleCameraDisplayMode(VisionOCR.isSimulated);
        SFX.playPop();
      });
    }

    const btnTriggerOCR = document.getElementById('btnTriggerOCR');
    if (btnTriggerOCR) {
      btnTriggerOCR.addEventListener('click', () => this.runOCRSimulation());
    }

    const btnApplyOCR = document.getElementById('btnApplyOCR');
    if (btnApplyOCR) {
      btnApplyOCR.addEventListener('click', () => this.applyOCRResultsToNote());
    }

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

    const elIOU = document.getElementById('totalOutstandingAmount');
    const elPaid = document.getElementById('totalPaidAmount');
    const cntAll = document.getElementById('countAll');
    const cntIOU = document.getElementById('countIOU');
    const cntPaid = document.getElementById('countPaid');

    if (elIOU) elIOU.textContent = `฿${totalIOU.toFixed(2)}`;
    if (elPaid) elPaid.textContent = `฿${totalPaid.toFixed(2)}`;
    if (cntAll) cntAll.textContent = activeNotes.length;
    if (cntIOU) cntIOU.textContent = countIOU;
    if (cntPaid) cntPaid.textContent = countPaid;
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

      // 3. Search Query Filter
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
    card.className = `note-card ${isIOU ? 'status-iou' : 'status-paid'}`;
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
          <td class="col-name" title="${item.Product_Name}">${item.Product_Name}</td>
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
              placeholder="ระบุชื่อลูกค้า (เช่น พี่บอล)..."
              title="คลิกเพื่อแก้ไขชื่อลูกค้า หรือเลือกชื่อที่เคยใช้"
              autocomplete="off"
            >
            <div class="note-time">
              <i data-lucide="clock"></i> <span>${dateFormatted}</span>
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

        <!-- Quick Item Add with Autocomplete -->
        <div class="add-item-box">
          <div class="quick-add-group">
            <div class="autocomplete-input-wrapper">
              <input 
                type="text" 
                class="item-search-input" 
                placeholder="+ พิมพ์ชื่อสินค้า (Auto-complete)..."
                autocomplete="off"
              >
              <div class="autocomplete-suggestions"></div>
            </div>
            <button class="btn-quick-add" title="เพิ่มสินค้า">
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>
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
        this.showToast('อัปเดตชื่อลูกค้าเรียบร้อย', 'success');
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
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
        }
      });
    });

    // 5. Autocomplete Input using PRODUCT_CATALOG
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
    };

    if (itemInput && suggestionsBox) {
      itemInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
          suggestionsBox.style.display = 'none';
          return;
        }

        const catalog = getProductCatalog();
        const matches = catalog.filter(p => p.name.toLowerCase().includes(query));

        if (matches.length === 0) {
          suggestionsBox.innerHTML = `
            <div class="autocomplete-item" data-custom="true">
              <span>เพิ่มสินค้า: "<strong>${e.target.value}</strong>"</span>
              <span class="item-suggest-price">฿20.00</span>
            </div>
          `;
        } else {
          suggestionsBox.innerHTML = matches.map(m => `
            <div class="autocomplete-item" data-name="${m.name}" data-price="${m.price}">
              <span class="item-suggest-name">${m.name}</span>
              <span class="item-suggest-price">฿${m.price.toFixed(2)}</span>
            </div>
          `).join('');
        }

        suggestionsBox.style.display = 'block';

        suggestionsBox.querySelectorAll('.autocomplete-item').forEach(itemElem => {
          itemElem.addEventListener('click', () => {
            if (itemElem.dataset.custom) {
              handleAddItem(e.target.value, 20.0);
            } else {
              handleAddItem(itemElem.dataset.name, parseFloat(itemElem.dataset.price));
            }
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
              handleAddItem(query, 20.0);
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
        const query = itemInput.value.trim();
        if (query) {
          const matched = findProductByName(query);
          handleAddItem(query, matched ? matched.price : 20.0);
        } else {
          itemInput.focus();
        }
      });
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

    if (modalId === 'cameraModal') {
      VisionOCR.stopCamera();
    }
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
