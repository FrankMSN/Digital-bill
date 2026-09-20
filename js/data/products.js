// ==========================================================================
// ฐานข้อมูลสินค้าในร้านค้าปลีก (RETAIL PRODUCT CATALOG - ตรงตามตาราง Google Sheets "product")
// มีข้อมูล: id, name, price, category, image, keywords
// ข้อมูลตรงตามตาราง Google Sheets คอลัมน์ A, B, C (รหัสสินค้า, ชื่อสินค้า, ราคา)
// ==========================================================================

const PRODUCT_CATALOG = [
  { 
    id: "1001001", 
    name: "โค้ก ออริจินัล ขนาด 325 มล.", 
    price: 16,
    category: "เครื่องดื่ม",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80",
    keywords: ["โค้ก", "coke", "coca-cola", "โคคา-โคล่า", "โค้กออริจินัล", "325", "น้ำอัดลม", "กระป๋อง", "แดง", "red"]
  },
  { 
    id: "1001002", 
    name: "เป๊ปซี่ แมกซ์ ขนาด 325 มล.", 
    price: 16,
    category: "เครื่องดื่ม",
    image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=300&q=80",
    keywords: ["เป๊ปซี่", "pepsi", "pepsi max", "แมกซ์", "325", "น้ำอัดลม", "กระป๋อง", "ดำ", "น้ำเงิน", "blue", "black"]
  },
  { 
    id: "1001003", 
    name: "น้ำดื่ม ตราสิงห์ 600 มล.", 
    price: 7,
    category: "เครื่องดื่ม",
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำดื่ม", "น้ำเปล่า", "สิงห์", "ตราสิงห์", "singha", "600", "ขวด", "water"]
  },
  { 
    id: "1002001", 
    name: "นมโฟร์โมสต์ รสจืด 225 มล.", 
    price: 14,
    category: "นมและผลิตภัณฑ์จากนม",
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80",
    keywords: ["นม", "โฟร์โมสต์", "รสจืด", "foremost", "225", "กล่อง", "uht", "milk"]
  },
  { 
    id: "1003001", 
    name: "บะหมี่กึ่งสำเร็จรูป มาม่า รสต้มยำกุ้ง", 
    price: 7,
    category: "อาหารแห้งและกึ่งสำเร็จรูป",
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=300&q=80",
    keywords: ["มาม่า", "mama", "ต้มยำกุ้ง", "บะหมี่", "บะหมี่กึ่งสำเร็จรูป", "ซอง", "noodle"]
  },
  { 
    id: "1003002", 
    name: "บะหมี่กึ่งสำเร็จรูป ยำยำ รสหมูสับ", 
    price: 7,
    category: "อาหารแห้งและกึ่งสำเร็จรูป",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80",
    keywords: ["ยำยำ", "yumyum", "หมูสับ", "บะหมี่", "บะหมี่กึ่งสำเร็จรูป", "ซอง", "noodle"]
  },
  { 
    id: "1004001", 
    name: "มันฝรั่งทอดกรอบ เลย์ รสคลาสสิค 48 กรัม", 
    price: 22,
    category: "ขนมขบเคี้ยว",
    image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=300&q=80",
    keywords: ["เลย์", "lays", "lay", "มันฝรั่ง", "คลาสสิค", "ขนม", "chips", "snack", "เหลือง"]
  },
  { 
    id: "1004002", 
    name: "ขนมปังแซนด์วิช ฟาร์มเฮ้าส์ รสตัดขอบ", 
    price: 22,
    category: "เบเกอรี่",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80",
    keywords: ["ขนมปัง", "ฟาร์มเฮ้าส์", "farmhouse", "แซนด์วิช", "ตัดขอบ", "bread"]
  },
  { 
    id: "1004003", 
    name: "สาหร่ายทอด เถ้าแก่น้อย รสเผ็ด 12 กรัม", 
    price: 20,
    category: "ขนมขบเคี้ยว",
    image: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=300&q=80",
    keywords: ["สาหร่าย", "เถ้าแก่น้อย", "taokaenoi", "รสเผ็ด", "ขนม", "snack", "seaweed"]
  },
  { 
    id: "1005001", 
    name: "ปลากระป๋อง ตราสามแม่ครัว 155 กรัม", 
    price: 20,
    category: "อาหารกระป๋อง",
    image: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=300&q=80",
    keywords: ["ปลากระป๋อง", "สามแม่ครัว", "ปลาซาร์ดีน", "155", "canned fish", "sardine"]
  },
  { 
    id: "1006001", 
    name: "สบู่ก้อน โพรเทคส์ ไอซ์ซี่คูล 65 กรัม", 
    price: 15,
    category: "ของใช้ส่วนตัว",
    image: "https://images.unsplash.com/photo-1607006314640-77a82987178c?auto=format&fit=crop&w=300&q=80",
    keywords: ["สบู่", "โพรเทคส์", "protex", "ไอซ์ซี่คูล", "soap"]
  },
  { 
    id: "1006002", 
    name: "ยาสีฟัน คอลเกต รสสดชื่นเย็นซ่า 80 กรัม", 
    price: 35,
    category: "ของใช้ส่วนตัว",
    image: "https://images.unsplash.com/photo-1559591937-e1032d2077e6?auto=format&fit=crop&w=300&q=80",
    keywords: ["ยาสีฟัน", "คอลเกต", "colgate", "สดชื่นเย็นซ่า", "toothpaste"]
  },
  { 
    id: "1007001", 
    name: "ผงซักฟอก บรีส เอกเซล ขนาด 80 กรัม", 
    price: 12,
    category: "ผลิตภัณฑ์ซักล้าง",
    image: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=300&q=80",
    keywords: ["ผงซักฟอก", "บรีส", "บรีสเอกเซล", "breeze", "detergent"]
  },
  { 
    id: "1007002", 
    name: "น้ำยาล้างจาน ซันไลต์ เลมอน เทอร์โบ 300 มล.", 
    price: 20,
    category: "ผลิตภัณฑ์ซักล้าง",
    image: "https://images.unsplash.com/photo-1585670270677-2f3b793798cf?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำยาล้างจาน", "ซันไลต์", "sunlight", "เลมอน", "dishwashing"]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRODUCT_CATALOG };
}
