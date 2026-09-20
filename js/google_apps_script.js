/**
 * ============================================================================
 * SMART POS & SMART NOTE - GOOGLE SHEETS API CONNECTOR (2 ตาราง สินค้า & อาหาร)
 * ============================================================================
 * สคริปต์ Google Apps Script เวอร์ชัน 2.0 (Dual-Catalog & Dual-Bills)
 * 1. ตารางที่ 1: "สินค้า_SmartPOS" -> จัดเก็บและโหลดราคาสินค้าปลีก
 * 2. ตารางที่ 2: "อาหาร_SmartPOS"  -> จัดเก็บและโหลดราคาเมนูอาหารตามสั่ง
 * 3. ตารางที่ 3: "บิลร้านค้า_SmartPOS" -> บันทึกและซิงค์บิลขายปลีก
 * 4. ตารางที่ 4: "บิลร้านอาหาร_SmartPOS" -> บันทึกและซิงค์บิลร้านอาหาร
 * ============================================================================
 */

// 1. กำหนดชื่อแท็บชีต
const SHEET_PRODUCTS = "สินค้า_SmartPOS";
const SHEET_FOOD = "อาหาร_SmartPOS";
const SHEET_RETAIL_BILLS = "บิลร้านค้า_SmartPOS";
const SHEET_RESTAURANT_BILLS = "บิลร้านอาหาร_SmartPOS";

// 2. หัวตารางแคตตาล็อกสินค้าปลีก
const HEADERS_PRODUCTS = [
  "รหัสสินค้า (ID)",
  "ชื่อสินค้า (Product Name)",
  "ราคาขาย (Price)",
  "หมวดหมู่ (Category)",
  "คีย์เวิร์ด AI/OCR (Keywords)",
  "ลิงก์รูปภาพ (Image URL)",
  "บาร์โค้ด (Barcode)"
];

// 3. หัวตารางแคตตาล็อกเมนูอาหาร
const HEADERS_FOOD = [
  "รหัสเมนู (Food ID)",
  "ชื่อเมนูอาหาร (Food Name)",
  "ราคา (Price)",
  "หมวดหมู่ (Category)",
  "คีย์เวิร์ดค้นหา (Keywords)",
  "ลิงก์รูปภาพ (Image URL)"
];

// 4. หัวตารางสำหรับบันทึกบิล
const HEADERS_BILLS = [
  "รหัสบิล (Bill ID)",
  "วันที่/เวลา (Created Date)",
  "ประเภทบิล (Bill Type)",
  "ชื่อลูกค้า / โต๊ะ (Customer)",
  "รายการสินค้าและอาหาร (Items Summary)",
  "ยอดรวมสุทธิ (Total Amount)",
  "สถานะชำระเงิน (Status)",
  "อัปเดตล่าสุด (Last Modified)"
];

/**
 * Handle GET Requests
 * รองรับการเปิดผ่านเว็บ หรือการดึงราคาสินค้าและอาหารจาก 2 ตาราง
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "get_catalogs";
    
    if (action === "ping") {
      return createJsonResponse({
        status: "SUCCESS",
        message: "Smart POS Google Sheets API เชื่อมต่อสำเร็จ พร้อมรับข้อมูล!",
        timestamp: new Date().toISOString()
      });
    }

    // Default GET: ดึงแคตตาล็อก 2 ตาราง (สินค้า และ อาหาร)
    return handleGetCatalogs();

  } catch (err) {
    return createJsonResponse({
      status: "ERROR",
      message: "เกิดข้อผิดพลาดใน doGet: " + err.toString()
    });
  }
}

/**
 * Handle POST Requests
 * รองรับการซิงค์บิล, ดึงแคตตาล็อก, หรือเติมข้อมูลเริ่มต้น (Seed)
 */
function doPost(e) {
  try {
    let contents = {};
    if (e && e.postData && e.postData.contents) {
      contents = JSON.parse(e.postData.contents);
    }

    const action = contents.action || "sync_bill";

    // 1. Action: Ping / Test Connection
    if (action === "ping") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      return createJsonResponse({
        status: "SUCCESS",
        message: "เชื่อมต่อกับ Google Sheets สำเร็จเรียบร้อย!",
        spreadsheetName: ss.getName(),
        sheets: ss.getSheets().map(function(s) { return s.getName(); })
      });
    }

    // 2. Action: ดึงราคาสินค้าและอาหาร (2 ตาราง)
    if (action === "get_catalogs") {
      return handleGetCatalogs();
    }

    // 3. Action: ส่งข้อมูลเริ่มต้นขึ้น 2 ตาราง (Seed Initial Data)
    if (action === "seed_catalogs") {
      const prodCount = seedInitialProducts(true);
      const foodCount = seedInitialFood(true);
      return createJsonResponse({
        status: "SUCCESS",
        message: "สร้างและใส่ข้อมูลเริ่มต้นให้ 2 ตารางเรียบร้อย (สินค้า: " + prodCount + ", อาหาร: " + foodCount + " รายการ)",
        productsCount: prodCount,
        foodMenuCount: foodCount
      });
    }

    // 4. Action: ซิงค์บิลทั้งหมด (Bulk Upsert แยกตารางบิลร้านค้า vs ร้านอาหาร)
    if (action === "sync_all") {
      const bills = contents.bills || [];
      let retailCount = 0;
      let restaurantCount = 0;

      for (let i = 0; i < bills.length; i++) {
        const bill = bills[i];
        const isRestaurant = (bill.Bill_Type === "restaurant");
        const targetSheet = isRestaurant 
          ? getOrCreateSheet(SHEET_RESTAURANT_BILLS, HEADERS_BILLS, "#0284c7") 
          : getOrCreateSheet(SHEET_RETAIL_BILLS, HEADERS_BILLS, "#0f172a");

        upsertBillRow(targetSheet, bill);
        if (isRestaurant) restaurantCount++;
        else retailCount++;
      }

      return createJsonResponse({
        status: "SUCCESS",
        message: "ซิงค์บิลทั้งหมดสำเร็จ (บิลร้านค้า: " + retailCount + ", บิลร้านอาหาร: " + restaurantCount + " บิล)",
        retailCount: retailCount,
        restaurantCount: restaurantCount,
        totalBills: bills.length
      });
    }

    // 5. Action: ซิงค์บิลเดี่ยว (Single Bill Sync แยกตาราง)
    const billData = contents.bill || contents;
    const isRestaurant = (billData.Bill_Type === "restaurant");
    const targetSheet = isRestaurant 
      ? getOrCreateSheet(SHEET_RESTAURANT_BILLS, HEADERS_BILLS, "#0284c7") 
      : getOrCreateSheet(SHEET_RETAIL_BILLS, HEADERS_BILLS, "#0f172a");

    const result = upsertBillRow(targetSheet, billData);

    return createJsonResponse({
      status: "SUCCESS",
      action: result,
      sheet: targetSheet.getName(),
      message: (result === "updated" ? "อัปเดตสถานะบิลเดิมใน " : "บันทึกบิลใหม่ลงใน ") + targetSheet.getName() + " เรียบร้อย",
      billId: billData.Note_ID || billData.id
    });

  } catch (error) {
    return createJsonResponse({
      status: "ERROR",
      message: "เกิดข้อผิดพลาดในการประมวลผล: " + error.toString()
    });
  }
}

/**
 * อ่านข้อมูลจาก 2 ตารางแคตตาล็อก (สินค้า & อาหาร) และส่งกลับเป็น JSON
 */
function handleGetCatalogs() {
  const prodSheet = getOrCreateSheet(SHEET_PRODUCTS, HEADERS_PRODUCTS, "#1e293b");
  const foodSheet = getOrCreateSheet(SHEET_FOOD, HEADERS_FOOD, "#065f46");

  // หากชีตยังไม่มีข้อมูล ให้เติมข้อมูลเริ่มต้นอัตโนมัติ
  if (prodSheet.getLastRow() <= 1) {
    seedInitialProducts(false);
  }
  if (foodSheet.getLastRow() <= 1) {
    seedInitialFood(false);
  }

  // อ่านรายการสินค้าปลีก
  const products = [];
  const prodLastRow = prodSheet.getLastRow();
  if (prodLastRow > 1) {
    const prodValues = prodSheet.getRange(2, 1, prodLastRow - 1, HEADERS_PRODUCTS.length).getValues();
    for (let i = 0; i < prodValues.length; i++) {
      const row = prodValues[i];
      const name = String(row[1] || "").trim();
      if (name) {
        const kwStr = String(row[4] || "");
        const keywords = kwStr ? kwStr.split(",").map(function(k) { return k.trim().toLowerCase(); }).filter(Boolean) : [];
        products.push({
          id: String(row[0] || "P" + (i + 1)),
          name: name,
          price: parseFloat(row[2]) || 0,
          category: String(row[3] || "สินค้าทั่วไป"),
          keywords: keywords,
          image: String(row[5] || ""),
          barcode: String(row[6] || "")
        });
      }
    }
  }

  // อ่านรายการอาหารตามสั่ง
  const foodMenu = [];
  const foodLastRow = foodSheet.getLastRow();
  if (foodLastRow > 1) {
    const foodValues = foodSheet.getRange(2, 1, foodLastRow - 1, HEADERS_FOOD.length).getValues();
    for (let j = 0; j < foodValues.length; j++) {
      const row = foodValues[j];
      const name = String(row[1] || "").trim();
      if (name) {
        const kwStr = String(row[4] || "");
        const keywords = kwStr ? kwStr.split(",").map(function(k) { return k.trim().toLowerCase(); }).filter(Boolean) : [];
        foodMenu.push({
          id: String(row[0] || "FOOD_" + (j + 1)),
          name: name,
          price: parseFloat(row[2]) || 0,
          category: String(row[3] || "อาหารจานเดียว"),
          keywords: keywords,
          image: String(row[5] || "")
        });
      }
    }
  }

  return createJsonResponse({
    status: "SUCCESS",
    message: "โหลดข้อมูลราคาสินค้าและอาหารจาก 2 ตารางสำเร็จ",
    products: products,
    foodMenu: foodMenu,
    stats: {
      productsCount: products.length,
      foodMenuCount: foodMenu.length
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * ค้นหาหรือสร้างแท็บชีต พร้อมจัดรูปแบบหัวตาราง
 */
function getOrCreateSheet(sheetName, headers, headerColor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    const hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setBackground(headerColor || "#1e293b");
    hRange.setFontColor("#ffffff");
    hRange.setFontWeight("bold");
    hRange.setFontSize(10);
    hRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 32);
  }

  return sheet;
}

/**
 * บันทึกหรืออัปเดตแถวบิล (Upsert)
 */
function upsertBillRow(sheet, bill) {
  if (!bill || !bill.Note_ID) return "skipped";

  const billId = String(bill.Note_ID).trim();
  const lastRow = sheet.getLastRow();
  let targetRow = -1;

  if (lastRow > 1) {
    const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idColumn.length; i++) {
      if (String(idColumn[i][0]).trim() === billId) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const items = bill.items || [];
  const itemsSummary = items.map(function(it) {
    const name = it.Product_Name || it.name || "สินค้า";
    const qty = it.Quantity || it.quantity || 1;
    const price = it.Price_Per_Unit || it.price || 0;
    const total = it.Total_Price || (qty * price);
    return name + " (x" + qty + ") - ฿" + Number(total).toFixed(2);
  }).join("\n");

  const statusText = (bill.Status === "Paid") ? "✅ จ่ายแล้ว" : "⏳ เซ็นเชื่อ (IOU)";
  const typeText = (bill.Bill_Type === "restaurant") ? "🍽️ ร้านอาหาร" : "🏪 ร้านค้า";

  const rowData = [
    bill.Note_ID,
    bill.Created_Date || new Date().toISOString(),
    typeText,
    bill.Customer_Name || "ลูกค้าทั่วไป",
    itemsSummary,
    Number(bill.Total_Amount || 0),
    statusText,
    new Date().toISOString()
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, HEADERS_BILLS.length).setValues([rowData]);
    formatBillRow(sheet, targetRow, bill.Status);
    return "updated";
  } else {
    sheet.appendRow(rowData);
    const newRow = sheet.getLastRow();
    formatBillRow(sheet, newRow, bill.Status);
    return "inserted";
  }
}

function formatBillRow(sheet, rowIndex, status) {
  const isPaid = (status === "Paid");
  const statusCell = sheet.getRange(rowIndex, 7);
  statusCell.setFontWeight("bold");
  statusCell.setHorizontalAlignment("center");
  if (isPaid) {
    statusCell.setBackground("#d1fae5");
    statusCell.setFontColor("#065f46");
  } else {
    statusCell.setBackground("#fef3c7");
    statusCell.setFontColor("#92400e");
  }
  sheet.getRange(rowIndex, 6).setNumberFormat("฿#,##0.00").setHorizontalAlignment("right");
}

/**
 * เติมข้อมูลสินค้าปลีกเริ่มต้นลงในตาราง "สินค้า_SmartPOS"
 */
function seedInitialProducts(forceClear) {
  const sheet = getOrCreateSheet(SHEET_PRODUCTS, HEADERS_PRODUCTS, "#1e293b");
  if (forceClear && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  const defaultProducts = [
    ["P001", "น้ำอัดลมเป๊ปซี่ (กระป๋อง)", 20, "เครื่องดื่ม", "pepsi, เป๊ปซี่, แป๊บซี่, cola, กระป๋อง, can, blue", "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=300&q=80", "8850029012345"],
    ["P002", "น้ำอัดลมโค้ก (กระป๋อง)", 20, "เครื่องดื่ม", "coke, โค้ก, cola, กระป๋อง, can, red", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80", "8850029012346"],
    ["P003", "น้ำดื่มบริสุทธิ์ (ขวดเล็ก 600ml)", 10, "เครื่องดื่ม", "น้ำเปล่า, น้ำดื่ม, ขวดเล็ก, water, bottle", "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=300&q=80", "8850029012347"],
    ["P004", "น้ำดื่มบริสุทธิ์ (ขวดใหญ่ 1.5L)", 15, "เครื่องดื่ม", "น้ำเปล่า, ขวดใหญ่, 1.5L, mineral water", "https://images.unsplash.com/photo-1559839914-1b34645a380e?auto=format&fit=crop&w=300&q=80", "8850029012348"],
    ["P005", "น้ำแข็ง (ถุง)", 8, "เครื่องดื่ม", "น้ำแข็ง, น้ำแข็งถุง, ice", "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=300&q=80", ""],
    ["P006", "บะหมี่กึ่งสำเร็จรูป มาม่า (ซอง)", 10, "อาหารแห้ง", "มาม่า, mama, ต้มยำกุ้ง, หมูสับ, บะหมี่", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=300&q=80", "8850029012349"],
    ["P007", "มันฝรั่งทอดกรอบ เลย์ (ซอง)", 25, "ขนมขบเคี้ยว", "lay, lays, เลย์, ขนม, มันฝรั่งทอด, snack", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=300&q=80", "8850029012350"],
    ["P008", "เบียร์ขวด (สิงห์ / ช้าง / ลีโอ)", 60, "เครื่องดื่มแอลกอฮอล์", "เบียร์, beer, ช้าง, สิงห์, ลีโอ, leo", "https://images.unsplash.com/photo-1608270199127-ec1c12bf5d9c?auto=format&fit=crop&w=300&q=80", "8850029012351"],
    ["P009", "เครื่องดื่มชูกำลัง M-150 / คาราบาว", 12, "เครื่องดื่ม", "m-150, m150, คาราบาว, กระทิงแดง, ชูกำลัง", "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=300&q=80", "8850029012352"],
    ["P010", "กาแฟกระป๋องพร้อมดื่ม (เบอร์ดี้/เนสกาแฟ)", 17, "เครื่องดื่ม", "กาแฟกระป๋อง, เบอร์ดี้, birdy, เนสกาแฟ, coffee", "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=300&q=80", "8850029012353"],
    ["P011", "นมเปรี้ยว / นมกล่อง UHT", 15, "เครื่องดื่ม", "นม, นมเปรี้ยว, นมกล่อง, meiji, milk", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80", "8850029012354"],
    ["P012", "ปลากระป๋องสามแม่ครัว", 22, "อาหารแห้ง", "ปลากระป๋อง, สามแม่ครัว, sardine", "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=300&q=80", "8850029012355"],
    ["P013", "ขนมปังฟาร์มเฮ้าส์", 25, "เบเกอรี่", "ขนมปัง, ฟาร์มเฮ้าส์, bread, toast", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80", "8850029012356"],
    ["P014", "ไข่ไก่สด เบอร์ 2 (แพ็ก 10 ฟอง)", 55, "ของสด", "ไข่, ไข่ไก่, egg, eggs", "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=300&q=80", ""],
    ["P015", "ข้าวสารหอมมะลิ (ถุง 5 กก.)", 195, "อาหารแห้ง", "ข้าวสาร, หอมมะลิ, ข้าว, rice", "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80", "8850029012357"]
  ];

  sheet.getRange(2, 1, defaultProducts.length, HEADERS_PRODUCTS.length).setValues(defaultProducts);
  sheet.getRange(2, 3, defaultProducts.length, 1).setNumberFormat("฿#,##0.00").setHorizontalAlignment("right");
  return defaultProducts.length;
}

/**
 * เติมข้อมูลเมนูอาหารเริ่มต้นลงในตาราง "อาหาร_SmartPOS"
 */
function seedInitialFood(forceClear) {
  const sheet = getOrCreateSheet(SHEET_FOOD, HEADERS_FOOD, "#065f46");
  if (forceClear && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  const defaultFood = [
    ["FOOD_01", "ข้าวกะเพราหมูสับ", 50, "อาหารจานเดียว", "กะเพรา, หมูสับ, ข้าวกะเพรา", ""],
    ["FOOD_02", "ข้าวกะเพราหมูกรอบ", 60, "อาหารจานเดียว", "กะเพรา, หมูกรอบ, ข้าวกะเพราหมูกรอบ", ""],
    ["FOOD_03", "ข้าวกะเพราไก่", 50, "อาหารจานเดียว", "กะเพรา, ไก่", ""],
    ["FOOD_04", "ข้าวกะเพราเนื้อ", 65, "อาหารจานเดียว", "กะเพรา, เนื้อ", ""],
    ["FOOD_05", "ข้าวกะเพราทะเล (กุ้ง+หมึก)", 70, "อาหารจานเดียว", "กะเพรา, ทะเล, กุ้ง, หมึก", ""],
    ["FOOD_06", "ข้าวผัดหมู", 50, "อาหารจานเดียว", "ข้าวผัด, หมู", ""],
    ["FOOD_07", "ข้าวผัดไก่", 50, "อาหารจานเดียว", "ข้าวผัด, ไก่", ""],
    ["FOOD_08", "ข้าวผัดกุ้ง", 65, "อาหารจานเดียว", "ข้าวผัด, กุ้ง", ""],
    ["FOOD_09", "ข้าวผัดปู", 70, "อาหารจานเดียว", "ข้าวผัด, ปู", ""],
    ["FOOD_10", "ข้าวหมูกระเทียม", 50, "อาหารจานเดียว", "หมูกระเทียม, กระเทียม", ""],
    ["FOOD_11", "ข้าวไก่กระเทียม", 50, "อาหารจานเดียว", "ไก่กระเทียม, กระเทียม", ""],
    ["FOOD_12", "ผัดซีอิ๊วหมู", 50, "เมนูเส้น", "ผัดซีอิ๊ว, เส้นใหญ่ผัดซีอิ๊ว", ""],
    ["FOOD_13", "ผัดไทยกุ้งสด", 65, "เมนูเส้น", "ผัดไทย, กุ้งสด", ""],
    ["FOOD_14", "ราดหน้าหมูนุ่ม", 50, "เมนูเส้น", "ราดหน้า, เส้นใหญ่ราดหน้า", ""],
    ["FOOD_15", "ต้มยำกุ้งน้ำข้น", 120, "ต้ม/แกง", "ต้มยำ, ต้มยำกุ้ง, น้ำข้น", ""],
    ["FOOD_16", "ต้มยำรวมมิตรทะเล", 130, "ต้ม/แกง", "ต้มยำรวมมิตร, ทะเล", ""],
    ["FOOD_17", "แกงจืดเต้าหู้หมูสับ", 80, "ต้ม/แกง", "แกงจืด, ต้มจืด", ""],
    ["FOOD_18", "ไข่เจียวหมูสับ (กับข้าว)", 60, "กับข้าว", "ไข่เจียว, ไข่เจียวหมูสับ", ""],
    ["FOOD_19", "ลูกชิ้นหมูปิ้ง (ไม้)", 12, "ของทานเล่น", "ลูกชิ้น, ลูกชิ้นปิ้ง, หมูปิ้ง", ""],
    ["FOOD_20", "ไข่ดาว", 10, "ท็อปปิ้ง", "ไข่ดาว, ทอดไข่ดาว", ""],
    ["FOOD_21", "ไข่เจียว (ฟอง)", 15, "ท็อปปิ้ง", "ไข่เจียว, โปะไข่เจียว", ""]
  ];

  sheet.getRange(2, 1, defaultFood.length, HEADERS_FOOD.length).setValues(defaultFood);
  sheet.getRange(2, 3, defaultFood.length, 1).setNumberFormat("฿#,##0.00").setHorizontalAlignment("right");
  return defaultFood.length;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
