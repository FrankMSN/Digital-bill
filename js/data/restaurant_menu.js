/**
 * ============================================================================
 * RESTAURANT FOOD MENU CONFIGURATION (ตรงตามตาราง Google Sheets "food")
 * ============================================================================
 * ข้อมูลตรงตามตาราง Google Sheets คอลัมน์ E, F, G (รหัสสินค้า, ชื่อสินค้า, ราคา)
 */

const RESTAURANT_MENU = [
  {
    id: "2001001",
    name: "ข้าวกะเพราหมูกรอบไข่ดาว",
    price: 75.0,
    category: "อาหารจานเดียว",
    keywords: ["กะเพรา", "หมูกรอบ", "ไข่ดาว", "ข้าวกะเพราหมูกรอบไข่ดาว", "ข้าวกะเพรา"]
  },
  {
    id: "2001002",
    name: "ข้าวผัดกะเพราหมูสับไข่ดาว",
    price: 65.0,
    category: "อาหารจานเดียว",
    keywords: ["กะเพรา", "หมูสับ", "ไข่ดาว", "ข้าวผัดกะเพรา", "ข้าวผัดกะเพราหมูสับ"]
  },
  {
    id: "2001003",
    name: "ข้าวผัดกะเพราไก่",
    price: 55.0,
    category: "อาหารจานเดียว",
    keywords: ["กะเพรา", "ไก่", "ข้าวผัดกะเพราไก่", "กะเพราไก่"]
  },
  {
    id: "2001004",
    name: "ข้าวหมูกระเทียมพริกไทย",
    price: 60.0,
    category: "อาหารจานเดียว",
    keywords: ["หมูกระเทียม", "กระเทียมพริกไทย", "ข้าวหมูกระเทียม", "หมูกระเทียมพริกไทย"]
  },
  {
    id: "2001005",
    name: "ข้าวคะน้าหมูกรอบ",
    price: 70.0,
    category: "อาหารจานเดียว",
    keywords: ["คะน้า", "หมูกรอบ", "ข้าวคะน้าหมูกรอบ", "คะน้าหมูกรอบ"]
  },
  {
    id: "2001006",
    name: "ข้าวผัดพริกแกงหมูกรอบ",
    price: 75.0,
    category: "อาหารจานเดียว",
    keywords: ["พริกแกง", "หมูกรอบ", "ข้าวผัดพริกแกงหมูกรอบ", "พริกแกงหมูกรอบ"]
  },
  {
    id: "2001007",
    name: "ข้าวผัดปู",
    price: 90.0,
    category: "อาหารจานเดียว",
    keywords: ["ข้าวผัด", "ปู", "ข้าวผัดปู"]
  },
  {
    id: "2001008",
    name: "ข้าวผัดกุ้ง",
    price: 75.0,
    category: "อาหารจานเดียว",
    keywords: ["ข้าวผัด", "กุ้ง", "ข้าวผัดกุ้ง"]
  },
  {
    id: "2001009",
    name: "ข้าวผัดหมู",
    price: 55.0,
    category: "อาหารจานเดียว",
    keywords: ["ข้าวผัด", "หมู", "ข้าวผัดหมู"]
  },
  {
    id: "2001010",
    name: "ข้าวผัดต้มยำกุ้ง",
    price: 80.0,
    category: "อาหารจานเดียว",
    keywords: ["ข้าวผัด", "ต้มยำ", "กุ้ง", "ต้มยำกุ้ง", "ข้าวผัดต้มยำกุ้ง"]
  },
  {
    id: "2001011",
    name: "ผัดซีอิ๊วหมูหมัก",
    price: 65.0,
    category: "เมนูเส้น",
    keywords: ["ผัดซีอิ๊ว", "หมูหมัก", "เส้นใหญ่", "ก๋วยเตี๋ยว"]
  },
  {
    id: "2001012",
    name: "ผัดไทยกุ้งสด",
    price: 85.0,
    category: "เมนูเส้น",
    keywords: ["ผัดไทย", "กุ้งสด", "pad thai", "ก๋วยเตี๋ยว"]
  },
  {
    id: "2001013",
    name: "ราดหน้าทะเลเส้นใหญ่",
    price: 80.0,
    category: "เมนูเส้น",
    keywords: ["ราดหน้า", "ทะเล", "เส้นใหญ่", "กุ้ง", "หมึก"]
  },
  {
    id: "2001014",
    name: "ข้าวไข่เจียวหมูสับ",
    price: 50.0,
    category: "อาหารจานเดียว",
    keywords: ["ไข่เจียว", "หมูสับ", "ข้าวไข่เจียว", "ข้าวไข่เจียวหมูสับ"]
  }
];

function findRestaurantMenuItem(searchName) {
  if (!searchName) return null;
  const q = searchName.trim().toLowerCase();
  return RESTAURANT_MENU.find(item => {
    if (item.name.toLowerCase() === q) return true;
    if (item.id.toLowerCase() === q) return true;
    if (item.keywords && item.keywords.some(k => k.toLowerCase() === q)) return true;
    return false;
  }) || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RESTAURANT_MENU, findRestaurantMenuItem };
}
