// ============================================================
// リゾート施設 日別売上集約 GAS Web App
// ============================================================
// 使い方:
//   1. script.google.com で新規プロジェクトを作成
//   2. このコードをペースト
//   3. [デプロイ] → [新しいデプロイ] → 種類:ウェブアプリ
//      実行ユーザー: 自分 / アクセス: 全員
//   4. デプロイURLをダッシュボードの RESORT_GAS_URL に設定
//
// エンドポイント:
//   GET {URL}?month=2025-07           → 全施設の当月データ
//   GET {URL}?month=2025-07&facility=宮若虎の湯  → 1施設のみ
// ============================================================

// ── 施設マスタ ──────────────────────────────────────────────
const FACILITIES = [
  // 旅館型
  { id: '1TpeXg8S3j3tDY8ifqYAfg_xDW7VGdw-_WtP3lCrT5Ck', name: '宮若虎の湯',    type: 'ryokan' },
  { id: '1FOfNps2-dP0wIrBkJulj-Wn4vdTxftvv8ctVf-y0qEM', name: '古民家煉り',    type: 'ryokan' },
  { id: '1HVpaoPG-riSu0RrtBTgsIeba_7YaDlfzmVLv6qmMCCE', name: 'Tsmart',         type: 'ryokan' },
  { id: '1AXKvdoFsD7tUmeP-CUuq1Squ-vyZRkubz9k5bhV2e00', name: '九重久織亭',    type: 'ryokan' },
  { id: '1cbkvN09SbMiIO0n0urOUjjjCK-HIm7s7V0AMPedMlwI', name: '九重虎乃湯',    type: 'ryokan' },
  { id: '1KyL_p0S8Hw0JjRIXJcz5MqjC_Ey9SRnmeC60hhDdk8g', name: '仙石原久の葉', type: 'ryokan' },
  { id: '13PMcODCT0OeQC3rue8YMFNsFRNiM_LsIE0rYufd8_DI', name: '小塚久の葉',    type: 'ryokan' },
  { id: '1Mp5NlAW-5qHZk4zNLzrBetyfwC6gi0jhauqKIsm5WZk', name: '阿蘇ホテル',    type: 'ryokan' },
  // ゴルフ型
  { id: '1tY4RPS92mYe_FCxaPy5Evqd6khnX7yhSipmOOxQiAWc', name: '大分コース',    type: 'golf' },
  { id: '1xrqIuDqTcw_0DgmXWIhbwzsoKHdjFSKGoEsWwIuiLOk', name: '若宮コース',    type: 'golf' },
  { id: '1u3dNX-qv87m8XI9RI47fbQurYKjMXpvy2ket7RRCmlg', name: '阿蘇コース',    type: 'golf' },
];

// ── メインハンドラ ────────────────────────────────────────────
function doGet(e) {
  try {
    const month      = (e.parameter.month    || getCurrentMonth()); // "2025-07"
    const filterName = (e.parameter.facility || '');               // 施設名（省略可）

    const targets = filterName
      ? FACILITIES.filter(f => f.name === filterName)
      : FACILITIES;

    const result = {
      month:     month,
      generated: new Date().toISOString(),
      ryokan:    [],
      golf:      [],
    };

    targets.forEach(facility => {
      try {
        const ss        = SpreadsheetApp.openById(facility.id);
        const sheetName = monthToSheetName(month);
        const sheet     = ss.getSheetByName(sheetName);

        if (!sheet) {
          pushError(result, facility, `シート "${sheetName}" が見つかりません`);
          return;
        }

        const data = facility.type === 'ryokan'
          ? parseRyokan(sheet, facility.name)
          : parseGolf(sheet, facility.name);

        result[facility.type].push(data);

      } catch (err) {
        pushError(result, facility, err.message);
      }
    });

    const cb = (e.parameter.callback || '').replace(/[^a-zA-Z0-9_]/g, '');
    return cb ? jsonpResponse(result, cb) : jsonResponse(result);

  } catch (outerErr) {
    return jsonResponse({ error: outerErr.message });
  }
}

// ── 旅館型パーサー ────────────────────────────────────────────
// 列構成 (A〜M):
//   A:日付  B:曜日
//   C:総売上_予算  D:総売上_予約  E:総売上_実績
//   F:泊  G:食  H:売店  I:ドリンク  J:追加食事
//   K:部屋数_予算  L:部屋数_予約  M:部屋数_実績
function parseRyokan(sheet, facilityName) {
  const rows  = sheet.getDataRange().getValues();
  const daily = [];

  let sumRevBudget = 0, sumRevBooking = 0, sumRevActual = 0;
  let sumRoomBudget = 0, sumRoomBooking = 0, sumRoomActual = 0;
  let sumStay = 0, sumFood = 0, sumShop = 0;

  rows.forEach(row => {
    const date = extractDate(row[0]);
    if (!date) return; // 日付でない行（ヘッダー・合計行等）をスキップ

    const entry = {
      date:            date,
      weekday:         String(row[1] || ''),
      revenue_budget:  toNum(row[2]),
      revenue_booking: toNum(row[3]),
      revenue_actual:  toNum(row[4]),
      stay:            toNum(row[5]),
      food:            toNum(row[6]),
      shop:            toNum(row[7]),
      drink:           toNum(row[8]),
      extra:           toNum(row[9]),
      rooms_budget:    toNum(row[10]),
      rooms_booking:   toNum(row[11]),
      rooms_actual:    toNum(row[12]),
    };

    daily.push(entry);
    sumRevBudget   += entry.revenue_budget;
    sumRevBooking  += entry.revenue_booking;
    sumRevActual   += entry.revenue_actual;
    sumRoomBudget  += entry.rooms_budget;
    sumRoomBooking += entry.rooms_booking;
    sumRoomActual  += entry.rooms_actual;
    sumStay        += entry.stay;
    sumFood        += entry.food;
    sumShop        += entry.shop;
  });

  return {
    facility: facilityName,
    type:     'ryokan',
    daily:    daily,
    monthly:  {
      revenue_budget:   sumRevBudget,
      revenue_booking:  sumRevBooking,
      revenue_actual:   sumRevActual,
      rooms_budget:     sumRoomBudget,
      rooms_booking:    sumRoomBooking,
      rooms_actual:     sumRoomActual,
      stay:             sumStay,
      food:             sumFood,
      shop:             sumShop,
      achievement_rate: sumRevBudget > 0
        ? Math.round(sumRevActual / sumRevBudget * 1000) / 10  // 小数1桁の%
        : null,
    },
  };
}

// ── ゴルフ型パーサー ─────────────────────────────────────────
// 列構成 (A〜N前後):
//   A:日付  B:曜日
//   C:総売上_予算  D:総売上_予約  E:総売上_実績
//   F:組数_予算   G:組数_予約   H:組数_実績
//   I:来場者数_予算 J:来場者数_予約 K:来場者数_実績
//   L:稼働率  M:組単価  N:客単価
function parseGolf(sheet, facilityName) {
  const rows  = sheet.getDataRange().getValues();
  const daily = [];

  let sumRevBudget = 0, sumRevBooking = 0, sumRevActual = 0;
  let sumGrpBudget = 0, sumGrpBooking = 0, sumGrpActual = 0;
  let sumVisBudget = 0, sumVisBooking = 0, sumVisActual = 0;

  rows.forEach(row => {
    const date = extractDate(row[0]);
    if (!date) return;

    const entry = {
      date:              date,
      weekday:           String(row[1] || ''),
      revenue_budget:    toNum(row[2]),
      revenue_booking:   toNum(row[3]),
      revenue_actual:    toNum(row[4]),
      groups_budget:     toNum(row[5]),
      groups_booking:    toNum(row[6]),
      groups_actual:     toNum(row[7]),
      visitors_budget:   toNum(row[8]),
      visitors_booking:  toNum(row[9]),
      visitors_actual:   toNum(row[10]),
      occupancy:         toNum(row[11]),
      group_price:       toNum(row[12]),
      unit_price:        toNum(row[13]),
    };

    daily.push(entry);
    sumRevBudget  += entry.revenue_budget;
    sumRevBooking += entry.revenue_booking;
    sumRevActual  += entry.revenue_actual;
    sumGrpBudget  += entry.groups_budget;
    sumGrpBooking += entry.groups_booking;
    sumGrpActual  += entry.groups_actual;
    sumVisBudget  += entry.visitors_budget;
    sumVisBooking += entry.visitors_booking;
    sumVisActual  += entry.visitors_actual;
  });

  return {
    facility: facilityName,
    type:     'golf',
    daily:    daily,
    monthly:  {
      revenue_budget:    sumRevBudget,
      revenue_booking:   sumRevBooking,
      revenue_actual:    sumRevActual,
      groups_budget:     sumGrpBudget,
      groups_booking:    sumGrpBooking,
      groups_actual:     sumGrpActual,
      visitors_budget:   sumVisBudget,
      visitors_booking:  sumVisBooking,
      visitors_actual:   sumVisActual,
      achievement_rate:  sumRevBudget > 0
        ? Math.round(sumRevActual / sumRevBudget * 1000) / 10
        : null,
    },
  };
}

// ── ユーティリティ ────────────────────────────────────────────

/** "2025-07" → "2025.7" */
function monthToSheetName(month) {
  const [y, m] = month.split('-');
  return y + '.' + parseInt(m, 10);
}

/** 現在月を "YYYY-MM" 形式で返す */
function getCurrentMonth() {
  const now = new Date();
  return now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0');
}

/**
 * セル値から日付文字列 "YYYY-MM-DD" を抽出。
 * 日付でない（ヘッダー・合計行など）場合は null を返す。
 */
function extractDate(v) {
  let d;
  if (v instanceof Date) {
    d = v;
  } else if (typeof v === 'number' && v > 40000) {
    // Sheets の数値シリアル日付 (1900-01-01 基点)
    d = new Date(Math.round((v - 25569) * 86400 * 1000)); // Unixエポック基点の標準変換
  } else if (typeof v === 'string' && /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(v)) {
    d = new Date(v.replace(/\//g, '-'));
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  if (y < 2020 || y > 2035) return null; // 異常値ガード
  return y + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

/** 数値変換。空・非数値は 0 */
function toNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/** エラー用エントリをresultに追加 */
function pushError(result, facility, msg) {
  result[facility.type].push({
    facility: facility.name,
    type:     facility.type,
    error:    msg,
    daily:    [],
    monthly:  {},
  });
}

/** JSON レスポンスを返す */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/** JSONP レスポンスを返す（組織内アクセス制限下でのCORS回避用） */
function jsonpResponse(obj, callback) {
  const json = JSON.stringify(obj, null, 2);
  return ContentService
    .createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
