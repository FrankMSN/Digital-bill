// ==========================================================================
// ฐานข้อมูลสินค้าในร้านค้าปลีก (RETAIL PRODUCT CATALOG)
// มีข้อมูล: id, name, price, image (รูปภาพอ้างอิงจากเน็ต), keywords (สำหรับ AI OCR เทียบข้อมูล)
// หมวดสินค้านี้สำหรับ "บิลร้านค้า" และการสแกนตรวจจับ "สินค้าในร้าน"
// (เมนูอาหารตามสั่งแยกจัดการที่ restaurant_menu.js)
// ==========================================================================

const PRODUCT_CATALOG = [
  { 
    id: "P001", 
    name: "น้ำอัดลมเป๊ปซี่ (กระป๋อง)", 
    price: 20,
    image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=300&q=80",
    keywords: ["pepsi", "เป๊ปซี่", "แป๊บซี่", "pepsi max", "น้ำอัดลม", "โคล่า", "cola", "กระป๋อง", "soda", "can", "blue"]
  },
  { 
    id: "P002", 
    name: "น้ำอัดลมโค้ก (กระป๋อง)", 
    price: 20,
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80",
    keywords: ["coke", "โค้ก", "โคคา-โคล่า", "coca-cola", "coca cola", "cola", "น้ำอัดลม", "กระป๋อง", "soda", "can", "red"]
  },
  { 
    id: "P003", 
    name: "น้ำดื่มบริสุทธิ์ (ขวดเล็ก 600ml)", 
    price: 10,
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำเปล่า", "น้ำดื่ม", "ขวดเล็ก", "water", "water bottle", "bottle", "mineral water"]
  },
  { 
    id: "P004", 
    name: "น้ำดื่มบริสุทธิ์ (ขวดใหญ่ 1.5L)", 
    price: 15,
    image: "https://images.unsplash.com/photo-1559839914-1b34645a380e?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำเปล่า", "ขวดใหญ่", "1.5L", "mineral water", "water"]
  },
  { 
    id: "P005", 
    name: "น้ำแข็ง (ถุง)", 
    price: 8,
    image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำแข็ง", "น้ำแข็งถุง", "ice", "ice cube"]
  },
  { 
    id: "P006", 
    name: "บะหมี่กึ่งสำเร็จรูป มาม่า (ซอง)", 
    price: 10,
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=300&q=80",
    keywords: ["มาม่า", "mama", "ต้มยำกุ้ง", "หมูสับ", "บะหมี่กึ่งสำเร็จรูป", "noodle", "noodles", "instant noodles"]
  },
  { 
    id: "P007", 
    name: "มันฝรั่งทอดกรอบ เลย์ (ซอง)", 
    price: 25,
    image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=300&q=80",
    keywords: ["lay", "lays", "เลย์", "ขนม", "มันฝรั่ง", "มันฝรั่งทอด", "snack", "potato chips", "chips"]
  },
  { 
    id: "P008", 
    name: "เบียร์ขวด (สิงห์ / ช้าง / ลีโอ)", 
    price: 60,
    image: "https://images.unsplash.com/photo-1608270199127-ec1c12bf5d9c?auto=format&fit=crop&w=300&q=80",
    keywords: ["เบียร์", "beer", "เบียร์ขวด", "ช้าง", "สิงห์", "ลีโอ", "leo", "chang", "singha", "alcohol"]
  },
  { 
    id: "P009", 
    name: "เครื่องดื่มชูกำลัง M-150 / คาราบาว", 
    price: 12,
    image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=300&q=80",
    keywords: ["m-150", "m150", "คาราบาว", "คาราบาวแดง", "กระทิงแดง", "ชูกำลัง", "energy drink", "red bull"]
  },
  { 
    id: "P010", 
    name: "กาแฟกระป๋องพร้อมดื่ม (เบอร์ดี้/เนสกาแฟ)", 
    price: 17,
    image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=300&q=80",
    keywords: ["กาแฟกระป๋อง", "เบอร์ดี้", "birdy", "เนสกาแฟ", "nescafe", "กาแฟ", "coffee", "canned coffee"]
  },
  { 
    id: "P011", 
    name: "นมเปรี้ยว / นมกล่อง UHT", 
    price: 15,
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80",
    keywords: ["นม", "นมเปรี้ยว", "นมกล่อง", "meiji", "ดัชมิลล์", "milk", "uht"]
  },
  { 
    id: "P012", 
    name: "ปลากระป๋องสามแม่ครัว", 
    price: 22,
    image: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=300&q=80",
    keywords: ["ปลากระป๋อง", "สามแม่ครัว", "ปลาซาร์ดีน", "canned fish", "sardine"]
  },
  { 
    id: "P013", 
    name: "ขนมปังฟาร์มเฮ้าส์", 
    price: 25,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80",
    keywords: ["ขนมปัง", "ฟาร์มเฮ้าส์", "bread", "toast", "farmhouse"]
  },
  { 
    id: "P014", 
    name: "สบู่ก้อน / แชมพูสระผม", 
    price: 20,
    image: "https://images.unsplash.com/photo-1607006314640-77a82987178c?auto=format&fit=crop&w=300&q=80",
    keywords: ["สบู่", "แชมพู", "soap", "shampoo", "lux", "pantene", "sunsilk"]
  }
];

// Fallback for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRODUCT_CATALOG };
}
