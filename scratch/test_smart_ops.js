const { SmartOPS_CatalogManager, SmartOPS_BillingSystem, SmartOPS_API } = require('../js/smart_ops_billing.js');

// Mock localStorage for node environment
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

console.log('--- TEST 1: CATALOG MANAGER & STORAGE ---');
const catalog = new SmartOPS_CatalogManager();
catalog.saveCatalogs(
  [
    { id: 'P1', name: 'เป๊ปซี่ กระป๋อง', price: 20, category: 'เครื่องดื่ม' },
    { id: 'P2', name: 'เลย์ มันฝรั่งแท้', price: 25, category: 'ขนม' }
  ],
  [
    { id: 'F1', name: 'ข้าวกะเพราหมูกรอบ', price: 65, category: 'อาหารจานเดียว' },
    { id: 'F2', name: 'ข้าวผัดต้มยำทะเล', price: 70, category: 'อาหารจานเดียว' }
  ]
);

const searchPepsi = catalog.search('เป๊ปซี่');
console.log('Search "เป๊ปซี่":', searchPepsi.length > 0 ? searchPepsi[0].name : 'Not found');
console.log('Food category list:', catalog.search('', 'food').map(f => f.name));

console.log('\n--- TEST 2: BILLING SYSTEM & AUTO TOTALS ---');
const billing = new SmartOPS_BillingSystem(catalog);

// 1. Add 2 Pepsi: 2 x 20 = 40
billing.addItemToBill(catalog.getItemById('P1'), 2);
console.log('1. Add 2x Pepsi -> Total Amount:', billing.currentBill.totalAmount, '(Expected: 40)');

// 2. Add 1 Kra Pao: 1 x 65 = 65 -> Total: 40 + 65 = 105
billing.addItemToBill(catalog.getItemById('F1'), 1);
console.log('2. Add 1x ข้าวกะเพรา -> Total Amount:', billing.currentBill.totalAmount, '(Expected: 105)');

// 3. Add 1 more Pepsi -> should increase qty to 3 -> 3 x 20 + 65 = 125
billing.addItemToBill(catalog.getItemById('P1'), 1);
console.log('3. Add 1x more Pepsi (Existing Item) -> Total Amount:', billing.currentBill.totalAmount, '(Expected: 125)');

// 4. Update Pepsi qty to 1 -> 1 x 20 + 65 = 85
billing.updateItemQuantity('P1', 1);
console.log('4. Update Pepsi Qty to 1 -> Total Amount:', billing.currentBill.totalAmount, '(Expected: 85)');

// 5. Remove Kra Pao -> Remaining: 1 x 20 = 20
billing.removeItemFromBill('F1');
console.log('5. Remove ข้าวกะเพรา -> Total Amount:', billing.currentBill.totalAmount, '(Expected: 20)');

if (billing.currentBill.totalAmount === 20 && billing.currentBill.totalQuantity === 1) {
  console.log('\n✅ ALL BILLING & TOTAL CALCULATION LOGIC PASSED 100%!');
} else {
  console.error('\n❌ Logic test failed');
  process.exit(1);
}
