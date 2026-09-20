/**
 * ============================================================================
 * SMART OPS - GOOGLE SHEETS API CONNECTOR & BILLING SYSTEM
 * ============================================================================
 * ระบบเชื่อมต่อ API ฐานข้อมูล Google Sheets 2 ตาราง ("product" และ "food")
 * เข้ากับระบบจัดการและสร้างบิลขาย (Billing System) บนหน้าเว็บไซต์
 *
 * สรุปการทำงานตามข้อกำหนด (Technical Requirements):
 * 1. API Fetching: ฟังก์ชันดึงข้อมูล (Fetch) ทั้งตาราง `product` และ `food`
 * 2. Data Handling & Caching: จัดการรวมข้อมูล จัดเก็บลง Array State & LocalStorage 
 *    เพื่อให้ระบบบิลเรียกใช้งานได้ทันทีแบบ Real-Time (0ms Latency)
 * 3. Billing UI Integration: ระบบค้นหา Auto-complete, คลิกเลือกสินค้าลงบิล, 
 *    และคำนวณยอดเงินรวมสุทธิ (Total Price) แบบอัตโนมัติ
 * ============================================================================
 */

// URL API Google Apps Script Webhook สำหรับเชื่อมต่อ Google Sheets
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbz67-eiTWcG2TlHdffTNS9DZ1D10776jo_gI4fjFgh4z3uUkTbuE0u_qj_ijqNmsfgL/exec";

/* ============================================================================
   ส่วนที่ 1: API FETCHING (ฟังก์ชันดึงข้อมูล 2 ตารางจาก Google Sheets)
   ============================================================================ */
class SmartOPS_API {
  /**
   * ดึงข้อมูลแคตตาล็อกสินค้า (product) และอาหาร (food) จาก Google Sheets API
   * @param {string} apiUrl - URL ของ Google Apps Script Web App
   * @returns {Promise<{ products: Array, food: Array, success: boolean }>}
   */
  static async fetchCatalogs(apiUrl = GOOGLE_SHEETS_API_URL) {
    console.log("🌐 กำลังดึงข้อมูล 2 ตาราง (product & food) จาก Google Sheets...");

    // 1. ลองเชื่อมต่อผ่าน Backend Proxy ก่อน (เพื่อเลี่ยงปัญหา CORS ในเบราว์เซอร์)
    try {
      if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
        const proxyRes = await fetch("/api/sheets/catalogs", { method: "GET" });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData && (proxyData.products || proxyData.product)) {
            console.log("✅ ดึงข้อมูลผ่าน Backend Proxy สำเร็จ");
            return SmartOPS_API.normalizeApiResponse(proxyData);
          }
        }
      }
    } catch (proxyErr) {
      // หากรันแบบ Standalone หรือไม่มี Backend Proxy ให้ข้ามไปเรียก Google Direct
    }

    // 2. เรียกไปยัง Google Apps Script URL โดยตรง (Direct Webhook)
    try {
      // ส่งคำขอแบบ GET พร้อม parameter action=get_catalogs
      const fetchUrl = apiUrl.includes("?") 
        ? `${apiUrl}&action=get_catalogs` 
        : `${apiUrl}?action=get_catalogs`;

      const response = await fetch(fetchUrl, {
        method: "GET",
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return SmartOPS_API.normalizeApiResponse(json);

    } catch (err) {
      console.warn("⚠️ การเรียก GET ไม่สำเร็จ กำลังลองเรียกสำรองผ่าน POST:", err.message);

      // ลองทางเลือกสำรอง: ส่งคำขอผ่าน POST { action: "get_catalogs" }
      try {
        const postResponse = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "get_catalogs" }),
          redirect: "follow"
        });

        const postJson = await postResponse.json();
        return SmartOPS_API.normalizeApiResponse(postJson);
      } catch (fallbackErr) {
        console.error("❌ ไม่สามารถดึงข้อมูลจาก Google Sheets ได้:", fallbackErr);
        throw fallbackErr;
      }
    }
  }

  /**
   * ปรับโครงสร้างข้อมูล API ให้อยู่ในรูปแบบมาตรฐาน (รองรับทั้งคีย์ product, products, food, foodMenu)
   */
  static normalizeApiResponse(raw) {
    const productsRaw = raw.products || raw.product || [];
    const foodRaw = raw.food || raw.foodMenu || [];

    let products = Array.isArray(productsRaw) ? productsRaw.map((p, idx) => ({
      id: p.id || `100${1001 + idx}`,
      name: (p.name || p.Product_Name || "สินค้า").trim(),
      price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price || p.Price || 0).replace(/[^0-9.]/g, "")) || 0,
      category: p.category || "สินค้าปลีก",
      type: "product", // ระบุประเภทชัดเจน
      keywords: p.keywords || [],
      image: p.image || ""
    })) : [];

    let food = Array.isArray(foodRaw) ? foodRaw.map((f, idx) => ({
      id: f.id || `200${1001 + idx}`,
      name: (f.name || f.Food_Name || "เมนูอาหาร").trim(),
      price: typeof f.price === 'number' ? f.price : parseFloat(String(f.price || f.Price || 0).replace(/[^0-9.]/g, "")) || 0,
      category: f.category || "อาหารตามสั่ง",
      type: "food", // ระบุประเภทชัดเจน
      keywords: f.keywords || [],
      image: f.image || ""
    })) : [];

    // Fallback ถ้าผลลัพธ์ว่างเปล่า ให้ใช้แคตตาล็อก 14 รายการจากไฟล์ข้อมูล
    if (products.length === 0 && typeof PRODUCT_CATALOG !== 'undefined' && Array.isArray(PRODUCT_CATALOG)) {
      products = PRODUCT_CATALOG;
    }
    if (food.length === 0 && typeof RESTAURANT_MENU !== 'undefined' && Array.isArray(RESTAURANT_MENU)) {
      food = RESTAURANT_MENU;
    }

    return {
      success: true,
      products: products,
      food: food,
      timestamp: new Date().toISOString()
    };
  }
}

/* ============================================================================
   ส่วนที่ 2: DATA HANDLING & CLIENT-SIDE STORAGE (จัดการและบันทึกข้อมูลในเครื่อง)
   ============================================================================ */
class SmartOPS_CatalogManager {
  constructor() {
    // 1. Array State ในหน่วยความจำ (In-Memory State)
    this.products = [];
    this.food = [];
    this.unifiedCatalog = []; // รวมทั้งสินค้าและอาหารเข้าด้วยกัน สะดวกต่อการค้นหา
    this.lastSyncTime = null;

    // คีย์สำหรับบันทึกลง LocalStorage
    this.STORAGE_KEYS = {
      PRODUCTS: "smartops_cached_products",
      FOOD: "smartops_cached_food",
      UNIFIED: "smartops_cached_unified",
      LAST_SYNC: "smartops_catalog_last_sync"
    };

    // โหลดข้อมูลแคชเดิมขึ้นมาทันทีก่อน (Fast Initial Load 0ms)
    this.loadFromLocalStorage();
  }

  /**
   * โหลดข้อมูลจาก LocalStorage เข้า State ในหน่วยความจำ
   */
  loadFromLocalStorage() {
    try {
      const p = localStorage.getItem(this.STORAGE_KEYS.PRODUCTS);
      const f = localStorage.getItem(this.STORAGE_KEYS.FOOD);
      const ts = localStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);

      if (p) this.products = JSON.parse(p);
      if (f) this.food = JSON.parse(f);
      if (ts) this.lastSyncTime = ts;

      this.rebuildUnifiedCatalog();
      console.log(`📦 โหลดข้อมูลจาก LocalStorage สำเร็จ: สินค้า ${this.products.length} รายการ, อาหาร ${this.food.length} รายการ`);
    } catch (e) {
      console.warn("ไม่สามารถอ่านข้อมูลแคชจาก LocalStorage ได้:", e);
    }
  }

  /**
   * บันทึกข้อมูลแคตตาล็อกใหม่ลง State และ LocalStorage
   */
  saveCatalogs(products = [], food = []) {
    this.products = products;
    this.food = food;
    this.lastSyncTime = new Date().toISOString();

    this.rebuildUnifiedCatalog();

    try {
      localStorage.setItem(this.STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products));
      localStorage.setItem(this.STORAGE_KEYS.FOOD, JSON.stringify(this.food));
      localStorage.setItem(this.STORAGE_KEYS.UNIFIED, JSON.stringify(this.unifiedCatalog));
      localStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, this.lastSyncTime);
      console.log("💾 อัปเดตและบันทึกข้อมูลลง LocalStorage เรียบร้อย");
    } catch (e) {
      console.warn("ไม่สามารถบันทึกลง LocalStorage ได้ (อาจเกินโควตา):", e);
    }
  }

  /**
   * รวมสินค้า (product) และอาหาร (food) เข้าด้วยกัน พร้อมแท็กหมวดหมู่
   */
  rebuildUnifiedCatalog() {
    this.unifiedCatalog = [
      ...this.products.map(p => ({ ...p, type: "product", typeLabel: "🏪 สินค้า" })),
      ...this.food.map(f => ({ ...f, type: "food", typeLabel: "🍽️ อาหาร" }))
    ];
  }

  /**
   * ฟังก์ชันค้นหาข้อมูลแคตตาล็อก รองรับการกรองตามชื่อ, คีย์เวิร์ด และประเภท
   * @param {string} query - คำค้นหา
   * @param {string} filterType - 'all', 'product', หรือ 'food'
   * @returns {Array} รายการที่ตรงกับเงื่อนไข
   */
  search(query = "", filterType = "all") {
    const q = (query || "").trim().toLowerCase();
    let pool = this.unifiedCatalog;

    // กรองประเภทสินค้า/อาหาร
    if (filterType === "product") {
      pool = pool.filter(item => item.type === "product");
    } else if (filterType === "food") {
      pool = pool.filter(item => item.type === "food");
    }

    if (!q) return pool;

    return pool.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(q);
      const catMatch = item.category && item.category.toLowerCase().includes(q);
      const kwMatch = item.keywords && item.keywords.some(k => k.toLowerCase().includes(q));
      return nameMatch || catMatch || kwMatch;
    });
  }

  /**
   * ดึงข้อมูลสินค้าหรืออาหารตาม ID
   */
  getItemById(id) {
    return this.unifiedCatalog.find(item => item.id === id) || null;
  }
}

/* ============================================================================
   ส่วนที่ 3: BILLING UI & LOGIC INTEGRATION (หน้าสร้างบิล & คำนวณยอดเงินรวม)
   ============================================================================ */
class SmartOPS_BillingSystem {
  /**
   * @param {SmartOPS_CatalogManager} catalogManager - ตัวจัดการข้อมูลแคตตาล็อก
   */
  constructor(catalogManager) {
    this.catalog = catalogManager;

    // State ของบิลปัจจุบันที่กำลังสร้าง/แก้ไข
    this.currentBill = {
      billId: this.generateBillId(),
      customerName: "ลูกค้าทั่วไป",
      billType: "retail", // 'retail' หรือ 'restaurant'
      createdDate: new Date().toISOString(),
      items: [], // รายการสินค้าในบิล: [{ id, name, price, quantity, total, type }]
      totalAmount: 0.00, // ยอดเงินรวมสุทธิ
      totalQuantity: 0   // จำนวนชิ้นรวม
    };

    // Callback ฟังก์ชันเมื่อบิลมีการเปลี่ยนแปลง (สำหรับอัปเดต UI ภายนอก)
    this.onBillUpdated = null;
  }

  generateBillId() {
    return "BILL_" + Date.now().toString(36).toUpperCase();
  }

  /**
   * เพิ่มสินค้าหรืออาหารลงในบิล (เมื่อคลิกเลือกจาก Auto-complete หรือ Dropdown)
   * @param {Object} itemData - ข้อมูลสินค้า { id, name, price, type }
   * @param {number} qty - จำนวนชิ้น (ค่าเริ่มต้นคือ 1)
   */
  addItemToBill(itemData, qty = 1) {
    if (!itemData || !itemData.name) return;

    const price = parseFloat(itemData.price) || 0;
    const quantity = parseInt(qty, 10) || 1;

    // ตรวจสอบว่ามีสินค้านี้อยู่ในบิลแล้วหรือไม่
    const existingIndex = this.currentBill.items.findIndex(it => it.id === itemData.id || it.name === itemData.name);

    if (existingIndex > -1) {
      // ถ้ามีอยู่แล้ว -> ให้เพิ่มจำนวนขึ้น
      this.currentBill.items[existingIndex].quantity += quantity;
      this.currentBill.items[existingIndex].total = 
        this.currentBill.items[existingIndex].quantity * this.currentBill.items[existingIndex].price;
    } else {
      // ถ้าเป็นรายการใหม่ -> เพิ่มแถวใหม่ลงในบิล
      this.currentBill.items.push({
        id: itemData.id || `ITEM_${Date.now()}`,
        name: itemData.name,
        price: price,
        quantity: quantity,
        total: price * quantity,
        type: itemData.type || "product",
        category: itemData.category || ""
      });
    }

    // คำนวณยอดเงินรวมของบิลใหม่ทั้งหมดโดยอัตโนมัติ
    this.recalculateTotal();
  }

  /**
   * ปรับเพิ่ม/ลดจำนวนสินค้า (+ / -)
   */
  updateItemQuantity(itemId, newQty) {
    const idx = this.currentBill.items.findIndex(it => it.id === itemId);
    if (idx === -1) return;

    const qty = parseInt(newQty, 10);
    if (qty <= 0) {
      // ถ้าจำนวนเป็น 0 หรือติดลบ ให้ลบรายการออกจากบิล
      this.removeItemFromBill(itemId);
      return;
    }

    this.currentBill.items[idx].quantity = qty;
    this.currentBill.items[idx].total = qty * this.currentBill.items[idx].price;

    this.recalculateTotal();
  }

  /**
   * ลบรายการสินค้าออกจากบิล
   */
  removeItemFromBill(itemId) {
    this.currentBill.items = this.currentBill.items.filter(it => it.id !== itemId);
    this.recalculateTotal();
  }

  /**
   * คำนวณยอดเงินรวม (Total Price) ในบิลให้โดยอัตโนมัติตามราคาและจำนวน
   */
  recalculateTotal() {
    let sumAmount = 0;
    let sumQty = 0;

    this.currentBill.items.forEach(item => {
      // คำนวณยอดรวมของแต่ละรายการ: price * quantity
      item.total = Number((item.price * item.quantity).toFixed(2));
      sumAmount += item.total;
      sumQty += item.quantity;
    });

    // อัปเดตยอดรวมสุทธิของบิล
    this.currentBill.totalAmount = Number(sumAmount.toFixed(2));
    this.currentBill.totalQuantity = sumQty;

    console.log(`💰 คำนวณยอดเงินอัตโนมัติ: ${this.currentBill.items.length} รายการ | จำนวนรวม ${sumQty} ชิ้น | ยอดรวมสุทธิ ฿${this.currentBill.totalAmount.toFixed(2)}`);

    // แจ้งเตือน UI ให้วาดผลลัพธ์ใหม่
    if (typeof this.onBillUpdated === "function") {
      this.onBillUpdated(this.currentBill);
    }
  }

  /**
   * ล้างบิลเพื่อเตรียมสร้างบิลใหม่
   */
  resetBill(billType = "retail") {
    this.currentBill = {
      billId: this.generateBillId(),
      customerName: "ลูกค้าทั่วไป",
      billType: billType,
      createdDate: new Date().toISOString(),
      items: [],
      totalAmount: 0.00,
      totalQuantity: 0
    };
    this.recalculateTotal();
  }

  /* --------------------------------------------------------------------------
     UI BINDING: เชื่อมต่อฟังก์ชันเข้ากับหน้าต่าง DOM (Auto-complete & Table)
     -------------------------------------------------------------------------- */
  /**
   * เชื่อมต่อ Event Listener เข้ากับ Input ค้นหาและตารางบิลบนหน้าเว็บ
   */
  bindUIElements(options = {}) {
    const {
      searchInputId = "smartSearchInput",
      suggestionsContainerId = "smartSuggestionsDropdown",
      itemsTableBodyId = "billItemsTableBody",
      totalAmountElementId = "billTotalAmountDisplay",
      totalQtyElementId = "billTotalQtyDisplay",
      categoryFilterPillsSelector = ".category-filter-pill"
    } = options;

    const searchInput = document.getElementById(searchInputId);
    const suggestionsBox = document.getElementById(suggestionsContainerId);
    const tableBody = document.getElementById(itemsTableBodyId);
    const totalDisplay = document.getElementById(totalAmountElementId);
    const qtyDisplay = document.getElementById(totalQtyElementId);

    let activeFilter = "all"; // 'all', 'product', 'food'

    // 1. กำหนดตัวจัดการเมื่อบิลอัปเดต ให้แสดงผลบนตารางและยอดเงินรวม
    this.onBillUpdated = (bill) => {
      // 1.1 แสดงยอดเงินรวมสุทธิ
      if (totalDisplay) {
        totalDisplay.textContent = `฿${bill.totalAmount.toFixed(2)}`;
      }
      if (qtyDisplay) {
        qtyDisplay.textContent = `${bill.totalQuantity} ชิ้น`;
      }

      // 1.2 วาดแถวรายการสินค้าในตาราง
      if (tableBody) {
        if (bill.items.length === 0) {
          tableBody.innerHTML = `
            <tr>
              <td colspan="5" style="text-align: center; color: #888; padding: 20px;">
                ยังไม่มีรายการในบิล (ค้นหาหรือคลิกเลือกสินค้า/อาหารด้านบน)
              </td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = bill.items.map((item, index) => `
          <tr class="bill-row" data-id="${item.id}">
            <td style="width: 40px; text-align: center;">${index + 1}</td>
            <td>
              <strong class="item-name">${this.escapeHTML(item.name)}</strong>
              <span class="item-badge ${item.type === 'food' ? 'badge-food' : 'badge-product'}">
                ${item.type === 'food' ? '🍽️ อาหาร' : '🏪 สินค้า'}
              </span>
            </td>
            <td style="text-align: right;">฿${item.price.toFixed(2)}</td>
            <td style="text-align: center;">
              <div class="stepper-box">
                <button type="button" class="btn-step btn-step-minus" data-id="${item.id}">-</button>
                <span class="qty-number">${item.quantity}</span>
                <button type="button" class="btn-step btn-step-plus" data-id="${item.id}">+</button>
              </div>
            </td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">
              ฿${item.total.toFixed(2)}
            </td>
            <td style="text-align: center;">
              <button type="button" class="btn-delete-item" data-id="${item.id}" title="ลบรายการนี้">✕</button>
            </td>
          </tr>
        `).join("");

        // ผูกปุ่ม Stepper (+ / -) และปุ่มลบ
        tableBody.querySelectorAll(".btn-step-plus").forEach(btn => {
          btn.addEventListener("click", () => {
            const item = bill.items.find(it => it.id === btn.dataset.id);
            if (item) this.updateItemQuantity(item.id, item.quantity + 1);
          });
        });

        tableBody.querySelectorAll(".btn-step-minus").forEach(btn => {
          btn.addEventListener("click", () => {
            const item = bill.items.find(it => it.id === btn.dataset.id);
            if (item) this.updateItemQuantity(item.id, item.quantity - 1);
          });
        });

        tableBody.querySelectorAll(".btn-delete-item").forEach(btn => {
          btn.addEventListener("click", () => {
            this.removeItemFromBill(btn.dataset.id);
          });
        });
      }
    };

    // 2. ระบบพิมพ์ค้นหา Auto-complete จากตาราง product & food
    if (searchInput && suggestionsBox) {
      const handleSearchInput = (e) => {
        const query = e.target.value.trim();
        if (!query) {
          suggestionsBox.style.display = "none";
          return;
        }

        // ค้นหารายการจาก CatalogManager
        const matches = this.catalog.search(query, activeFilter);

        if (matches.length === 0) {
          suggestionsBox.innerHTML = `
            <div style="padding: 12px; text-align: center; color: #888; font-size: 0.88rem;">
              ไม่พบสินค้าหรืออาหารที่ตรงกับ "${this.escapeHTML(query)}"
            </div>
          `;
          suggestionsBox.style.display = "block";
          return;
        }

        // แสดงผลลัพธ์แบบ Auto-complete Dropdown
        suggestionsBox.innerHTML = matches.slice(0, 8).map(m => `
          <div class="autocomplete-entry" data-id="${m.id}">
            <div class="entry-left">
              <span class="entry-icon">${m.type === 'food' ? '🍽️' : '🏪'}</span>
              <div>
                <strong class="entry-title">${this.escapeHTML(m.name)}</strong>
                <small class="entry-cat">${this.escapeHTML(m.category || (m.type === 'food' ? 'อาหาร' : 'สินค้า'))}</small>
              </div>
            </div>
            <div class="entry-right">
              <span class="entry-price">฿${m.price.toFixed(2)}</span>
              <button type="button" class="btn-entry-add">เลือก ➕</button>
            </div>
          </div>
        `).join("");

        suggestionsBox.style.display = "block";

        // คลิกเลือกรายการเพื่อเพิ่มลงบิล
        suggestionsBox.querySelectorAll(".autocomplete-entry").forEach(row => {
          row.addEventListener("click", () => {
            const selectedItem = this.catalog.getItemById(row.dataset.id);
            if (selectedItem) {
              this.addItemToBill(selectedItem, 1);
              searchInput.value = "";
              suggestionsBox.style.display = "none";
              searchInput.focus();
            }
          });
        });
      };

      searchInput.addEventListener("input", handleSearchInput);

      // ซ่อน Dropdown เมื่อคลิกนอกพื้นที่
      document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
          suggestionsBox.style.display = "none";
        }
      });
    }

    // 3. ป้ายตัวกรองหมวดหมู่ (Tabs: ทั้งหมด / สินค้า / อาหาร)
    const filterPills = document.querySelectorAll(categoryFilterPillsSelector);
    filterPills.forEach(pill => {
      pill.addEventListener("click", () => {
        filterPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        activeFilter = pill.dataset.filter || "all";
        if (searchInput && searchInput.value.trim()) {
          searchInput.dispatchEvent(new Event("input"));
        }
      });
    });

    // วาดสถานะเริ่มต้นของบิล
    this.recalculateTotal();
  }

  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

/* ============================================================================
   ฟังก์ชันเริ่มต้นระบบอัตโนมัติ (INITIALIZER FUNCTION)
   ============================================================================ */
/**
 * ฟังก์ชันหลักในการเปิดใช้งานระบบ Smart OPS เชื่อมต่อ Google Sheets และระบบบิล
 * @param {string} customApiUrl - URL เสริมสำหรับ Google Sheets API
 * @returns {Promise<{ catalog: SmartOPS_CatalogManager, billing: SmartOPS_BillingSystem }>}
 */
async function initSmartOPS(customApiUrl = GOOGLE_SHEETS_API_URL) {
  console.log("🚀 กำลังเริ่มต้นระบบ Smart OPS...");

  // 1. สร้างตัวจัดการแคตตาล็อก (จะโหลดแคชจาก LocalStorage ทันที)
  const catalogManager = new SmartOPS_CatalogManager();

  // 2. สร้างระบบจัดการบิล
  const billingSystem = new SmartOPS_BillingSystem(catalogManager);

  // 3. ดึงข้อมูลล่าสุดจาก Google Sheets 2 ตาราง (product & food) ในเบื้องหลัง
  try {
    const apiResult = await SmartOPS_API.fetchCatalogs(customApiUrl);
    if (apiResult && apiResult.success) {
      // บันทึกและอัปเดต State + LocalStorage
      catalogManager.saveCatalogs(apiResult.products, apiResult.food);
      console.log("✨ อัปเดตข้อมูลล่าสุดจาก Google Sheets สำเร็จเรียบร้อย!");
    }
  } catch (fetchErr) {
    console.warn("⚠️ ไม่สามารถดึงข้อมูลออนไลน์ได้ในขณะนี้ ระบบจะใช้ข้อมูลที่แคชไว้ใน LocalStorage ต่อไป (Offline Mode):", fetchErr.message);
  }

  return {
    catalog: catalogManager,
    billing: billingSystem,
    api: SmartOPS_API
  };
}

// ส่งออกโมดูลสำหรับทั้ง Browser และ Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GOOGLE_SHEETS_API_URL,
    SmartOPS_API,
    SmartOPS_CatalogManager,
    SmartOPS_BillingSystem,
    initSmartOPS
  };
}
