// ==========================================================================
// ฐานข้อมูลสินค้า (PRODUCT CATALOG)
// มีข้อมูล: id, name, price, image (รูปภาพอ้างอิงจากเน็ต), keywords (สำหรับ AI OCR เทียบข้อมูล)
// แก้ไขข้อมูลที่ไฟล์นี้เท่านั้นก่อน Deploy ขึ้น Netlify หรือโฮสติ้งใดๆ
// ==========================================================================

const PRODUCT_CATALOG = [
  { 
    id: "P001", 
    name: "น้ำเปล่า (ขวดเล็ก)", 
    price: 10,
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำเปล่า", "น้ำดื่ม", "ขวดเล็ก", "water", "water bottle", "bottle"]
  },
  { 
    id: "P002", 
    name: "น้ำเปล่า (ขวดใหญ่)", 
    price: 15,
    image: "https://images.unsplash.com/photo-1559839914-1b34645a380e?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำเปล่า", "ขวดใหญ่", "1.5L", "mineral water", "water"]
  },
  { 
    id: "P003", 
    name: "น้ำแข็ง (ถุง)", 
    price: 8,
    image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำแข็ง", "น้ำแข็งถุง", "ice", "ice cube"]
  },
  { 
    id: "P004", 
    name: "มาม่าหมูสับ", 
    price: 15,
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=300&q=80",
    keywords: ["มาม่า", "บะหมี่กึ่งสำเร็จรูป", "หมูสับ", "mama", "instant noodles", "noodles"]
  },
  { 
    id: "P005", 
    name: "เบียร์ (ขวด)", 
    price: 60,
    image: "https://images.unsplash.com/photo-1608270199127-ec1c12bf5d9c?auto=format&fit=crop&w=300&q=80",
    keywords: ["เบียร์", "เบียร์ขวด", "beer", "beer bottle", "alcohol"]
  },
  { 
    id: "P006", 
    name: "ชานมไข่มุกไต้หวัน", 
    price: 45,
    image: "https://images.unsplash.com/photo-1558857563-b371f30ca6a5?auto=format&fit=crop&w=300&q=80",
    keywords: ["ชานม", "ชานมไข่มุก", "ไข่มุก", "boba", "bubble tea", "milk tea"]
  },
  { 
    id: "P007", 
    name: "กาแฟโบราณเย็น", 
    price: 35,
    image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=300&q=80",
    keywords: ["กาแฟ", "กาแฟโบราณ", "กาแฟเย็น", "iced coffee", "coffee"]
  },
  { 
    id: "P008", 
    name: "ชาเขียวมัทฉะลาเต้", 
    price: 55,
    image: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=300&q=80",
    keywords: ["ชาเขียว", "มัทฉะ", "matcha", "green tea", "latte"]
  },
  { 
    id: "P009", 
    name: "ข้าวกะเพราหมูกรอบ", 
    price: 65,
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80",
    keywords: ["กะเพรา", "หมูกรอบ", "ข้าวกะเพรา", "basil pork", "crispy pork"]
  },
  { 
    id: "P010", 
    name: "ข้าวผัดหมูใส่ไข่", 
    price: 50,
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=300&q=80",
    keywords: ["ข้าวผัด", "ข้าวผัดหมู", "fried rice", "rice"]
  },
  { 
    id: "P011", 
    name: "ไข่ดาวกรอบ", 
    price: 10,
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=300&q=80",
    keywords: ["ไข่ดาว", "ไข่", "fried egg", "egg"]
  },
  { 
    id: "P012", 
    name: "ขนมปังปิ้งเนยนม", 
    price: 25,
    image: "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?auto=format&fit=crop&w=300&q=80",
    keywords: ["ขนมปัง", "ขนมปังปิ้ง", "เนยนม", "toast", "bread"]
  },
  { 
    id: "P013", 
    name: "ลูกชิ้นหมูปิ้ง (ไม้)", 
    price: 12,
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=300&q=80",
    keywords: ["ลูกชิ้น", "หมูปิ้ง", "meatball", "grilled pork", "skewer"]
  },
  { 
    id: "P014", 
    name: "น้ำอัดลมกระป๋อง", 
    price: 20,
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80",
    keywords: ["น้ำอัดลม", "โค้ก", "กระป๋อง", "soda", "coke", "can"]
  }
];
