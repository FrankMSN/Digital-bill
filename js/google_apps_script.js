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

// 1. กำหนดชื่อแท็บชีตที่เป็นไปได้ (รองรับทั้งภาษาอังกฤษ "product", "food" และภาษาไทย "สินค้า_SmartPOS", "อาหาร_SmartPOS")
const SHEET_NAMES_PRODUCT = ["product", "products", "สินค้า_SmartPOS", "สินค้า"];
const SHEET_NAMES_FOOD = ["food", "foods", "อาหาร_SmartPOS", "อาหาร"];
const SHEET_PRODUCTS_DEFAULT = "product";
const SHEET_FOOD_DEFAULT = "food";
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
 * อ่านข้อมูลจากตารางแคตตาล็อก (สินค้า "product" & อาหาร "food") และส่งกลับเป็น JSON
 * รองรับ 2 รูปแบบโครงสร้างใน Google Sheets:
 * 1. ตารางเคียงข้างกันในแผ่นเดียวกันตามรูปภาพ (Columns A:C คือ product, Columns E:G คือ food)
 * 2. ตารางแยกแท็บชีต ("product" และ "food")
 */
function handleGetCatalogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  let products = [];
  let foodMenu = [];
  let foundSideBySide = false;

  // --- วิธีที่ 1: ตรวจสอบตารางเคียงข้างกันในชีตเดียวกัน (ตามรูปภาพ: product = Cols A:C, food = Cols E:G) ---
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow >= 2 && lastCol >= 2) {
      const maxCol = Math.min(sheet.getMaxColumns(), Math.max(lastCol, 7));
      const r1 = sheet.getRange(1, 1, 1, maxCol).getValues()[0];
      const r2 = (lastRow >= 2) ? sheet.getRange(2, 1, 1, maxCol).getValues()[0] : [];

      const colA_Header = (String(r1[0] || "") + " " + String(r2[0] || "")).toLowerCase();
      const colB_Header = (String(r1[1] || "") + " " + String(r2[1] || "")).toLowerCase();
      const colE_Header = (maxCol >= 5) ? (String(r1[4] || "") + " " + String(r2[4] || "")).toLowerCase() : "";
      const colF_Header = (maxCol >= 6) ? (String(r1[5] || "") + " " + String(r2[5] || "")).toLowerCase() : "";

      const hasProductColA = colA_Header.includes("product") || colA_Header.includes("รหัส") || colB_Header.includes("ชื่อ");
      const hasFoodColE = colE_Header.includes("food") || colE_Header.includes("รหัส") || colF_Header.includes("ชื่อ");

      if (hasProductColA || hasFoodColE) {
        // ตรวจสอบว่าเริ่มข้อมูลที่แถว 2 หรือ 3 (แถว 2 มีคำว่า รหัส/ชื่อ/ราคา หรือไม่)
        const isHeaderRow2 = String(r2[0] || "").includes("รหัส") || String(r2[1] || "").includes("ชื่อ") || String(r2[4] || "").includes("รหัส");
        const startRow = isHeaderRow2 ? 3 : 2;
        const numRows = lastRow - startRow + 1;

        if (numRows > 0) {
          const tableData = sheet.getRange(startRow, 1, numRows, maxCol).getValues();
          for (let i = 0; i < tableData.length; i++) {
            const row = tableData[i];

            // 1. อ่านข้อมูลสินค้าจาก Column A (รหัส), B (ชื่อสินค้า), C (ราคา)
            const pId = String(row[0] || "").trim();
            const pName = String(row[1] || "").trim();
            let pPrice = 0;
            if (typeof row[2] === "number") {
              pPrice = row[2];
            } else if (row[2] !== null && row[2] !== undefined && String(row[2]).trim() !== "") {
              pPrice = parseFloat(String(row[2]).replace(/[^0-9.]/g, "")) || 0;
            }

            if (pName && pName !== "ชื่อสินค้า") {
              products.push({
                id: pId || ("100" + (1001 + products.length)),
                name: pName,
                price: pPrice,
                category: "สินค้าปลีก",
                keywords: getEnrichedKeywords(pId, pName),
                type: "product"
              });
            }

            // 2. อ่านข้อมูลอาหารจาก Column E (รหัส), F (ชื่ออาหาร), G (ราคา)
            if (maxCol >= 7) {
              const fId = String(row[4] || "").trim();
              const fName = String(row[5] || "").trim();
              let fPrice = 0;
              if (typeof row[6] === "number") {
                fPrice = row[6];
              } else if (row[6] !== null && row[6] !== undefined && String(row[6]).trim() !== "") {
                fPrice = parseFloat(String(row[6]).replace(/[^0-9.]/g, "")) || 0;
              }

              if (fName && fName !== "ชื่อสินค้า") {
                foodMenu.push({
                  id: fId || ("200" + (1001 + foodMenu.length)),
                  name: fName,
                  price: fPrice,
                  category: "อาหารตามสั่ง",
                  keywords: getEnrichedKeywords(fId, fName),
                  type: "food"
                });
              }
            }
          }

          if (products.length > 0 || foodMenu.length > 0) {
            foundSideBySide = true;
            break;
          }
        }
      }
    }
  }

  // --- วิธีที่ 2: ถ้าไม่พบในแผ่นเดียว ให้ค้นหาแยกแท็บชีต ("product" และ "food") ---
  if (!foundSideBySide || (products.length === 0 && foodMenu.length === 0)) {
    const prodSheet = findOrCreateSheet(SHEET_NAMES_PRODUCT, SHEET_PRODUCTS_DEFAULT, HEADERS_PRODUCTS, "#1e293b");
    const foodSheet = findOrCreateSheet(SHEET_NAMES_FOOD, SHEET_FOOD_DEFAULT, HEADERS_FOOD, "#065f46");

    if (prodSheet.getLastRow() <= 1) {
      seedInitialProducts(false);
    }
    if (foodSheet.getLastRow() <= 1) {
      seedInitialFood(false);
    }

    if (prodSheet.getLastRow() > 1) {
      const prodValues = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, Math.min(prodSheet.getLastColumn(), 7)).getValues();
      for (let i = 0; i < prodValues.length; i++) {
        const row = prodValues[i];
        const name = String(row[1] || "").trim();
        if (name && name !== "ชื่อสินค้า") {
          products.push({
            id: String(row[0] || `100${i + 1001}`),
            name: name,
            price: parseFloat(row[2]) || 0,
            category: String(row[3] || "สินค้าปลีก"),
            keywords: String(row[4] || "").split(",").map(k => k.trim().toLowerCase()).filter(Boolean),
            image: String(row[5] || ""),
            barcode: String(row[6] || ""),
            type: "product"
          });
        }
      }
    }

    if (foodSheet.getLastRow() > 1) {
      const foodValues = foodSheet.getRange(2, 1, foodSheet.getLastRow() - 1, Math.min(foodSheet.getLastColumn(), 6)).getValues();
      for (let j = 0; j < foodValues.length; j++) {
        const row = foodValues[j];
        const name = String(row[1] || "").trim();
        if (name && name !== "ชื่อสินค้า") {
          foodMenu.push({
            id: String(row[0] || `200${j + 1001}`),
            name: name,
            price: parseFloat(row[2]) || 0,
            category: String(row[3] || "อาหารตามสั่ง"),
            keywords: String(row[4] || "").split(",").map(k => k.trim().toLowerCase()).filter(Boolean),
            image: String(row[5] || ""),
            type: "food"
          });
        }
      }
    }
  }

  return createJsonResponse({
    status: "SUCCESS",
    message: "โหลดข้อมูลราคาสินค้าและอาหารจาก Google Sheets สำเร็จ",
    product: products,
    products: products,
    food: foodMenu,
    foodMenu: foodMenu,
    stats: {
      productsCount: products.length,
      foodCount: foodMenu.length,
      format: foundSideBySide ? "side_by_side" : "separate_sheets"
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * ค้นหาแท็บชีตจากชื่อที่เป็นไปได้ (เช่น "product" หรือ "สินค้า_SmartPOS") หากไม่พบให้สร้างใหม่
 */
function findOrCreateSheet(possibleNames, defaultName, headers, headerColor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let i = 0; i < possibleNames.length; i++) {
    const s = ss.getSheetByName(possibleNames[i]);
    if (s) return s;
  }
  return getOrCreateSheet(defaultName, headers, headerColor);
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
/**
 * เติมข้อมูลสินค้าปลีกเริ่มต้นลงในตาราง "product" (ตรงตามตาราง Google Sheets ในรูปภาพ)
 */
function seedInitialProducts(forceClear) {
  const sheet = findOrCreateSheet(SHEET_NAMES_PRODUCT, SHEET_PRODUCTS_DEFAULT, HEADERS_PRODUCTS, "#1e293b");
  if (forceClear && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  const defaultProducts = [
    ["1001001", "โค้ก ออริจินัล ขนาด 325 มล.", 16, "เครื่องดื่ม", "โค้ก, coke, cola, โคคา-โคล่า, 325, น้ำอัดลม", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80", ""],
    ["1001002", "เป๊ปซี่ แมกซ์ ขนาด 325 มล.", 16, "เครื่องดื่ม", "เป๊ปซี่, pepsi, pepsi max, แมกซ์, 325, น้ำอัดลม", "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=300&q=80", ""],
    ["1001003", "น้ำดื่ม ตราสิงห์ 600 มล.", 7, "เครื่องดื่ม", "น้ำดื่ม, น้ำเปล่า, สิงห์, ตราสิงห์, water, 600", "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=300&q=80", ""],
    ["1002001", "นมโฟร์โมสต์ รสจืด 225 มล.", 14, "นมและผลิตภัณฑ์จากนม", "นม, โฟร์โมสต์, รสจืด, foremost, milk, 225", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80", ""],
    ["1003001", "บะหมี่กึ่งสำเร็จรูป มาม่า รสต้มยำกุ้ง", 7, "อาหารแห้งและกึ่งสำเร็จรูป", "มาม่า, mama, ต้มยำกุ้ง, บะหมี่กึ่งสำเร็จรูป, noodle", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=300&q=80", ""],
    ["1003002", "บะหมี่กึ่งสำเร็จรูป ยำยำ รสหมูสับ", 7, "อาหารแห้งและกึ่งสำเร็จรูป", "ยำยำ, yumyum, หมูสับ, บะหมี่กึ่งสำเร็จรูป, noodle", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80", ""],
    ["1004001", "มันฝรั่งทอดกรอบ เลย์ รสคลาสสิค 48 กรัม", 22, "ขนมขบเคี้ยว", "เลย์, lay, lays, มันฝรั่งทอด, คลาสสิค, snack", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=300&q=80", ""],
    ["1004002", "ขนมปังแซนด์วิช ฟาร์มเฮ้าส์ รสตัดขอบ", 22, "เบเกอรี่", "ขนมปัง, ฟาร์มเฮ้าส์, ตัดขอบ, แซนด์วิช, bread", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80", ""],
    ["1004003", "สาหร่ายทอด เถ้าแก่น้อย รสเผ็ด 12 กรัม", 20, "ขนมขบเคี้ยว", "สาหร่าย, เถ้าแก่น้อย, รสเผ็ด, snack", "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=300&q=80", ""],
    ["1005001", "ปลากระป๋อง ตราสามแม่ครัว 155 กรัม", 20, "อาหารแห้งและกึ่งสำเร็จรูป", "ปลากระป๋อง, สามแม่ครัว, 155, sardine", "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=300&q=80", ""],
    ["1006001", "สบู่ก้อน โพรเทคส์ ไอซ์ซี่คูล 65 กรัม", 15, "ของใช้ส่วนตัว", "สบู่, โพรเทคส์, ไอซ์ซี่คูล, soap, protex", "https://images.unsplash.com/photo-1607006314684-257a70196881?auto=format&fit=crop&w=300&q=80", ""],
    ["1006002", "ยาสีฟัน คอลเกต รสสดชื่นเย็นซ่า 80 กรัม", 35, "ของใช้ส่วนตัว", "ยาสีฟัน, คอลเกต, colgate, toothpaste", "https://images.unsplash.com/photo-1559563458-527698bf5295?auto=format&fit=crop&w=300&q=80", ""],
    ["1007001", "ผงซักฟอก บรีส เอกเซล ขนาด 80 กรัม", 12, "ของใช้ในบ้าน", "ผงซักฟอก, บรีส, breeze, detergent", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=300&q=80", ""],
    ["1007002", "น้ำยาล้างจาน ซันไลต์ เลมอน เทอร์โบ 300 มล.", 20, "ของใช้ในบ้าน", "น้ำยาล้างจาน, ซันไลต์, sunlight, dishwashing", "https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=300&q=80", ""]
  ];

  sheet.getRange(2, 1, defaultProducts.length, HEADERS_PRODUCTS.length).setValues(defaultProducts);
  sheet.getRange(2, 3, defaultProducts.length, 1).setNumberFormat("฿#,##0.00").setHorizontalAlignment("right");
  return defaultProducts.length;
}

/**
 * เติมข้อมูลเมนูอาหารเริ่มต้นลงในตาราง "food" (ตรงตามตาราง Google Sheets ในรูปภาพ)
 */
function seedInitialFood(forceClear) {
  const sheet = findOrCreateSheet(SHEET_NAMES_FOOD, SHEET_FOOD_DEFAULT, HEADERS_FOOD, "#065f46");
  if (forceClear && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  const defaultFood = [
    ["2001001", "ข้าวกะเพราหมูกรอบไข่ดาว", 75, "อาหารจานเดียว", "กะเพรา, หมูกรอบ, ไข่ดาว, ข้าวกะเพรา", ""],
    ["2001002", "ข้าวผัดกะเพราหมูสับไข่ดาว", 65, "อาหารจานเดียว", "กะเพรา, หมูสับ, ไข่ดาว, ข้าวผัดกะเพรา", ""],
    ["2001003", "ข้าวผัดกะเพราไก่", 55, "อาหารจานเดียว", "กะเพรา, ไก่, ข้าวผัดกะเพราไก่", ""],
    ["2001004", "ข้าวหมูกระเทียมพริกไทย", 60, "อาหารจานเดียว", "หมูกระเทียม, กระเทียม, พริกไทย", ""],
    ["2001005", "ข้าวคะน้าหมูกรอบ", 70, "อาหารจานเดียว", "คะน้า, หมูกรอบ, ข้าวคะน้าหมูกรอบ", ""],
    ["2001006", "ข้าวผัดพริกแกงหมูกรอบ", 75, "อาหารจานเดียว", "พริกแกง, หมูกรอบ, ข้าวผัดพริกแกงหมูกรอบ", ""],
    ["2001007", "ข้าวผัดปู", 90, "อาหารจานเดียว", "ข้าวผัด, ปู, ข้าวผัดปู", ""],
    ["2001008", "ข้าวผัดกุ้ง", 75, "อาหารจานเดียว", "ข้าวผัด, กุ้ง, ข้าวผัดกุ้ง", ""],
    ["2001009", "ข้าวผัดหมู", 55, "อาหารจานเดียว", "ข้าวผัด, หมู, ข้าวผัดหมู", ""],
    ["2001010", "ข้าวผัดต้มยำกุ้ง", 80, "อาหารจานเดียว", "ข้าวผัด, ต้มยำ, กุ้ง, ข้าวผัดต้มยำ", ""],
    ["2001011", "ผัดซีอิ๊วหมูหมัก", 65, "เมนูเส้น", "ผัดซีอิ๊ว, หมูหมัก, เส้นใหญ่", ""],
    ["2001012", "ผัดไทยกุ้งสด", 85, "เมนูเส้น", "ผัดไทย, กุ้งสด, ผัดไท", ""],
    ["2001013", "ราดหน้าทะเลเส้นใหญ่", 80, "เมนูเส้น", "ราดหน้า, ทะเล, เส้นใหญ่", ""],
    ["2001014", "ข้าวไข่เจียวหมูสับ", 50, "อาหารจานเดียว", "ไข่เจียว, หมูสับ, ข้าวไข่เจียว", ""]
  ];

  sheet.getRange(2, 1, defaultFood.length, HEADERS_FOOD.length).setValues(defaultFood);
  sheet.getRange(2, 3, defaultFood.length, 1).setNumberFormat("฿#,##0.00").setHorizontalAlignment("right");
  return defaultFood.length;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * เติมคีย์เวิร์ดสำหรับการค้นหาและ OCR ให้กับสินค้าและอาหารตามรหัสและชื่อ
 */
function getEnrichedKeywords(id, name) {
  const dict = {
    "1001001": ["โค้ก", "coke", "coca-cola", "โคคา-โคล่า", "โค้กออริจินัล", "325", "น้ำอัดลม", "กระป๋อง", "แดง", "red"],
    "1001002": ["เป๊ปซี่", "pepsi", "pepsi max", "แมกซ์", "325", "น้ำอัดลม", "กระป๋อง", "ดำ", "น้ำเงิน", "blue", "black"],
    "1001003": ["น้ำดื่ม", "น้ำเปล่า", "สิงห์", "ตราสิงห์", "singha", "600", "ขวด", "water"],
    "1002001": ["นม", "โฟร์โมสต์", "รสจืด", "foremost", "225", "กล่อง", "uht", "milk"],
    "1003001": ["มาม่า", "mama", "ต้มยำกุ้ง", "บะหมี่", "บะหมี่กึ่งสำเร็จรูป", "ซอง", "noodle"],
    "1003002": ["ยำยำ", "yumyum", "หมูสับ", "บะหมี่", "บะหมี่กึ่งสำเร็จรูป", "ซอง", "noodle"],
    "1004001": ["เลย์", "lay", "lays", "มันฝรั่งทอด", "คลาสสิค", "48", "snack"],
    "1004002": ["ขนมปัง", "ฟาร์มเฮ้าส์", "ตัดขอบ", "แซนด์วิช", "bread", "toast"],
    "1004003": ["สาหร่าย", "เถ้าแก่น้อย", "รสเผ็ด", "12", "snack", "seaweed"],
    "1005001": ["ปลากระป๋อง", "สามแม่ครัว", "ตราสามแม่ครัว", "155", "sardine", "canned fish"],
    "1006001": ["สบู่", "สบู่ก้อน", "โพรเทคส์", "ไอซ์ซี่คูล", "65", "soap", "protex"],
    "1006002": ["ยาสีฟัน", "คอลเกต", "สดชื่นเย็นซ่า", "80", "colgate", "toothpaste"],
    "1007001": ["ผงซักฟอก", "บรีส", "บรีสเอกเซล", "เอกเซล", "80", "breeze", "detergent"],
    "1007002": ["น้ำยาล้างจาน", "ซันไลต์", "เลมอน", "เทอร์โบ", "300", "sunlight", "dishwashing"],
    "2001001": ["กะเพรา", "หมูกรอบ", "ไข่ดาว", "ข้าวกะเพราหมูกรอบไข่ดาว", "ข้าวกะเพรา"],
    "2001002": ["กะเพรา", "หมูสับ", "ไข่ดาว", "ข้าวผัดกะเพรา", "ข้าวผัดกะเพราหมูสับ"],
    "2001003": ["กะเพรา", "ไก่", "ข้าวผัดกะเพราไก่", "กะเพราไก่"],
    "2001004": ["หมูกระเทียม", "กระเทียมพริกไทย", "ข้าวหมูกระเทียม", "หมูกระเทียมพริกไทย"],
    "2001005": ["คะน้า", "หมูกรอบ", "ข้าวคะน้าหมูกรอบ", "คะน้าหมูกรอบ"],
    "2001006": ["พริกแกง", "หมูกรอบ", "ข้าวผัดพริกแกงหมูกรอบ", "พริกแกงหมูกรอบ"],
    "2001007": ["ข้าวผัด", "ปู", "ข้าวผัดปู"],
    "2001008": ["ข้าวผัด", "กุ้ง", "ข้าวผัดกุ้ง"],
    "2001009": ["ข้าวผัด", "หมู", "ข้าวผัดหมู"],
    "2001010": ["ข้าวผัด", "ต้มยำ", "กุ้ง", "ข้าวผัดต้มยำ", "ข้าวผัดต้มยำกุ้ง"],
    "2001011": ["ผัดซีอิ๊ว", "หมูหมัก", "เส้นใหญ่", "ผัดซีอิ๊วหมูหมัก"],
    "2001012": ["ผัดไทย", "กุ้งสด", "ผัดไท", "ผัดไทยกุ้งสด"],
    "2001013": ["ราดหน้า", "ทะเล", "เส้นใหญ่", "ราดหน้าทะเลเส้นใหญ่"],
    "2001014": ["ข้าวไข่เจียว", "ไข่เจียว", "หมูสับ", "ข้าวไข่เจียวหมูสับ"]
  };

  const idStr = String(id || "").trim();
  if (dict[idStr]) {
    return dict[idStr];
  }

  // Fallback: แยกคำจากชื่อ
  const cleanName = String(name || "").toLowerCase().trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  if (!words.includes(cleanName)) {
    words.unshift(cleanName);
  }
  return words;
}
