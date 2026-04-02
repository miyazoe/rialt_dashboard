// ============================================================
// リゾート施設 日別売上集約 GAS Web App  v6
// ============================================================
// 予算KPI行 (row 3, index 2):
// 旅館: B3(1)=稼働率予算 C3(2)=ADR予算 D3(3)=RevPAR予算 E3(4)=宿泊客数予算 F3(5)=客単価予算
// ゴルフ: B3(1)=稼働率予算 C3(2)=組数予算 D3(3)=来場者数予算 E3(4)=客単価予算 F3(5)=ADR予算

const FACILITIES = [
  { id: '1TpeXg8S3j3tDY8ifqYAfg_xDW7VGdw-_WtP3lCrT5Ck', name: '宮若虎の湯',    type: 'ryokan' },
  { id: '1FOfNps2-dP0wIrBkJulj-Wn4vdTxftvv8ctVf-y0qEM', name: '古民家煉り',    type: 'ryokan' },
  { id: '1HVpaoPG-riSu0RrtBTgsIeba_7YaDlfzmVLv6qmMCCE', name: 'Tsmart',         type: 'ryokan' },
  { id: '1AXKvdoFsD7tUmeP-CUuq1Squ-vyZRkubz9k5bhV2e00', name: '九重久織亭',    type: 'ryokan' },
  { id: '1cbkvN09SbMiIO0n0urOUjjjCK-HIm7s7V0AMPedMlwI', name: '九重虎乃湯',    type: 'ryokan' },
  { id: '1KyL_p0S8Hw0JjRIXJcz5MqjC_Ey9SRnmeC60hhDdk8g', name: '仙石原久の葉', type: 'ryokan' },
  { id: '13PMcODCT0OeQC3rue8YMFNsFRNiM_LsIE0rYufd8_DI', name: '小塚久の葉',    type: 'ryokan' },
  { id: '1Mp5NlAW-5qHZk4zNLzrBetyfwC6gi0jhauqKIsm5WZk', name: '阿蘇ホテル',    type: 'ryokan' },
  { id: '1tY4RPS92mYe_FCxaPy5Evqd6khnX7yhSipmOOxQiAWc', name: '大分コース',    type: 'golf' },
  { id: '1xrqIuDqTcw_0DgmXWIhbwzsoKHdjFSKGoEsWwIuiLOk', name: '若宮コース',    type: 'golf' },
  { id: '1u3dNX-qv87m8XI9RI47fbQurYKjMXpvy2ket7RRCmlg', name: '阿蘇コース',    type: 'golf' },
];

function doGet(e) {
  try {
    const cb = (e.parameter.callback || '').replace(/[^a-zA-Z0-9_]/g, '');

    // ── ir=1: 株価・財務・アナリスト・ニュースを返す ──
    if (e.parameter.ir) {
      return fetchIRData(cb);
    }

    if (e.parameter.debug) {
      const facilityName = e.parameter.facility || FACILITIES[0].name;
      const month = e.parameter.month || getCurrentMonth();
      const facility = FACILITIES.find(f => f.name === facilityName);
      if (!facility) return jsonResponse({ error: 'facility not found' });
      const ss = SpreadsheetApp.openById(facility.id);
      const sheetName = monthToSheetName(month);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return jsonResponse({ debug: true, facilityName, month, sheetName, error: 'sheet not found' });
      const rows = sheet.getDataRange().getValues();
      const rawRows = rows.slice(0, 5).map(row =>
        row.map((cell, ci) => ({
          col: String.fromCharCode(65 + ci),
          raw: cell instanceof Date ? cell.toISOString() : cell,
          type: cell instanceof Date ? 'Date' : typeof cell,
        }))
      );
      return jsonResponse({ debug: true, facilityName, month, sheetName, totalRows: rows.length, first5rows: rawRows });
    }

    if (e.parameter.all) {
      const result = { all: true, generated: new Date().toISOString(), periods: [] };
      const periodMap = {};
      FACILITIES.forEach(facility => {
        try {
          const ss = SpreadsheetApp.openById(facility.id);
          ss.getSheets().forEach(sheet => {
            const m = sheet.getName().match(/^(\d{4})\.(\d{1,2})$/);
            if (!m) return;
            const month = m[1] + '-' + m[2].padStart(2, '0');
            if (!periodMap[month]) periodMap[month] = { month, ryokan: [], golf: [] };
            try {
              const data = parseSheet(sheet, facility.name, facility.type);
              periodMap[month][facility.type].push({ facility: data.facility, type: data.type, monthly: data.monthly });
            } catch(err) { pushError(periodMap[month], facility, err.message); }
          });
        } catch(err) {}
      });
      result.periods = Object.values(periodMap).sort((a, b) => b.month.localeCompare(a.month));
      return cb ? jsonpResponse(result, cb) : jsonResponse(result);
    }

    const month = (e.parameter.month || getCurrentMonth());
    const filterName = (e.parameter.facility || '');
    const targets = filterName ? FACILITIES.filter(f => f.name === filterName) : FACILITIES;
    const result = { month, generated: new Date().toISOString(), ryokan: [], golf: [] };
    targets.forEach(facility => {
      try {
        const ss = SpreadsheetApp.openById(facility.id);
        const sheet = ss.getSheetByName(monthToSheetName(month));
        if (!sheet) { pushError(result, facility, 'sheet not found'); return; }
        result[facility.type].push(parseSheet(sheet, facility.name, facility.type));
      } catch (err) { pushError(result, facility, err.message); }
    });
    return cb ? jsonpResponse(result, cb) : jsonResponse(result);

  } catch (outerErr) {
    return jsonResponse({ error: outerErr.message });
  }
}

function parseSheet(sheet, facilityName, type) {
  const rows = sheet.getDataRange().getValues();
  const daily = [];

  const br = rows.length > 2 ? rows[2] : [];
  function brNum(idx) { const v = toNum(br[idx]); return v > 0 ? v : null; }
  function brOcc(idx) {
    const v = toNum(br[idx]);
    if (!v) return null;
    return v > 1 ? v / 100 : v;
  }

  let kpiBudget;
  if (type === 'ryokan') {
    kpiBudget = { occ_b: brOcc(1), adr_b: brNum(2), rvp_b: brNum(3), pax_b: brNum(4), spd_b: brNum(5) };
  } else {
    kpiBudget = { occ_b: brOcc(1), unit_b: brNum(2), pax_b: brNum(3), spd_b: brNum(4), adr_b: brNum(5) };
  }

  let sumRevBudget=0, sumRevBooking=0, sumRevActual=0;
  let sumUnitBudget=0, sumUnitBooking=0, sumUnitActual=0;
  let sumPaxBudget=0, sumPaxBooking=0, sumPaxActual=0;
  let sumAdrActual=0, adrCount=0;
  let sumStay=0, sumFood=0, sumShop=0;
  let totalRooms=0, dayCount=0;

  rows.forEach(row => {
    const date = extractDate(row[1]);
    if (!date) return;
    const revActual = toNum(row[5]);
    const unitActual = toNum(row[13]);
    const paxActual = toNum(row[16]);
    const adrActual = toNum(row[19]);
    const occ = toNum(row[21]);
    const cap = toNum(row[22]);
    daily.push({
      date, weekday: String(row[2] || ''),
      rev_budget: toNum(row[3]), rev_booking: toNum(row[4]), rev_actual: revActual,
      stay: toNum(row[6]), food: toNum(row[7]), shop: toNum(row[8]),
      unit_budget: toNum(row[11]), unit_booking: toNum(row[12]), unit_actual: unitActual,
      pax_budget: toNum(row[14]), pax_booking: toNum(row[15]), pax_actual: paxActual,
      adr_budget: toNum(row[17]), adr_booking: toNum(row[18]), adr_actual: adrActual,
      occupancy: occ, total_rooms: cap,
    });
    sumRevBudget += toNum(row[3]); sumRevBooking += toNum(row[4]); sumRevActual += revActual;
    sumUnitBudget += toNum(row[11]); sumUnitBooking += toNum(row[12]); sumUnitActual += unitActual;
    sumPaxBudget += toNum(row[14]); sumPaxBooking += toNum(row[15]); sumPaxActual += paxActual;
    sumStay += toNum(row[6]); sumFood += toNum(row[7]); sumShop += toNum(row[8]);
    if (adrActual > 0) { sumAdrActual += adrActual; adrCount++; }
    if (cap > 0) totalRooms = cap;
    dayCount++;
  });

  const occMonthly = (totalRooms > 0 && dayCount > 0)
    ? Math.round(sumUnitActual / (totalRooms * dayCount) * 1000) / 10 : null;
  const adrMonthly = adrCount > 0 ? Math.round(sumAdrActual / adrCount) : null;
  const revparMonthly = (occMonthly != null && adrMonthly != null)
    ? Math.round(adrMonthly * occMonthly / 100) : null;
  const spdMonthly = sumPaxActual > 0 ? Math.round(sumRevActual / sumPaxActual) : null;

  return {
    facility: facilityName, type, daily,
    monthly: {
      rev_actual: sumRevActual, rev_budget: sumRevBudget, rev_booking: sumRevBooking,
      unit_actual: sumUnitActual, unit_budget: sumUnitBudget,
      pax_actual: sumPaxActual, pax_budget: sumPaxBudget,
      stay: sumStay, food: sumFood, shop: sumShop,
      adr: adrMonthly, occupancy: occMonthly, revpar: revparMonthly, spd: spdMonthly,
      achievement: sumRevBudget > 0 ? Math.round(sumRevActual / sumRevBudget * 1000) / 10 : null,
      occ_b:  kpiBudget.occ_b,
      adr_b:  kpiBudget.adr_b,
      rvp_b:  kpiBudget.rvp_b,
      pax_b:  kpiBudget.pax_b || (sumPaxBudget > 0 ? sumPaxBudget : null),
      spd_b:  kpiBudget.spd_b,
      unit_b: kpiBudget.unit_b || (sumUnitBudget > 0 ? sumUnitBudget : null),
    },
  };
}

function monthToSheetName(month) {
  const [y, m] = month.split('-');
  return y + '.' + parseInt(m, 10);
}
function getCurrentMonth() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}
function extractDate(v) {
  let d;
  if (v instanceof Date) { d = v; }
  else if (typeof v === 'number' && v > 40000) { d = new Date(Math.round((v - 25569) * 86400 * 1000)); }
  else if (typeof v === 'string' && /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(v)) { d = new Date(v.replace(/\//g, '-')); }
  else { return null; }
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  if (y < 2020 || y > 2035) return null;
  return y + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function toNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function pushError(result, facility, msg) {
  result[facility.type].push({ facility: facility.name, type: facility.type, error: msg, daily: [], monthly: {} });
}
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2)).setMimeType(ContentService.MimeType.JSON);
}
function jsonpResponse(obj, callback) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj, null, 2) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ── IR データ取得 (4社比較: PPIH/ユニクロ/コスモス薬品/イオン) ──────────────
function fetchIRData(cb) {
  try {
    // v35: 5社構成に変更
    //   141A.T = トライアルホールディングス（自社）
    //   7532.T = PPIH（パン・パシフィック・インターナショナルHD = ドン・キホーテ）
    //   9983.T = ユニクロ（ファーストリテイリング）
    //   3349.T = コスモス薬品
    //   8267.T = イオン
    var COMPANIES = [
      { ticker: '141A.T', code: '141A', name: 'トライアル' },
      { ticker: '7532.T', code: '7532', name: 'PPIH' },
      { ticker: '9983.T', code: '9983', name: 'ユニクロ' },
      { ticker: '3349.T', code: '3349', name: 'コスモス薬品' },
      { ticker: '8267.T', code: '8267', name: 'イオン' },
    ];
    var hdrs = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, muteHttpExceptions: true };

    // 5社×3リクエスト(chart/minkabu/settlement) + news = 16並列
    var requests = [];
    COMPANIES.forEach(function(co) {
      requests.push({ url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + co.ticker + '?interval=1d&range=3mo', headers: hdrs.headers, muteHttpExceptions: true });
      requests.push({ url: 'https://minkabu.jp/stock/' + co.code, headers: hdrs.headers, muteHttpExceptions: true });
      requests.push({ url: 'https://minkabu.jp/stock/' + co.code + '/settlement', headers: hdrs.headers, muteHttpExceptions: true });
    });
    // Google News RSS (PPIH)
    requests.push({ url: 'https://news.google.com/rss/search?q=%E3%83%88%E3%83%A9%E3%82%A4%E3%82%A2%E3%83%AB%E3%83%9B%E3%83%BC%E3%83%AB%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0%E3%82%B9&hl=ja&gl=JP&ceid=JP%3Aja', headers: hdrs.headers, muteHttpExceptions: true });

    var responses = UrlFetchApp.fetchAll(requests);

    // 各社データ解析
    var companies = COMPANIES.map(function(co, ci) {
      var base = ci * 3;

      // Chart (v8/finance/chart)
      var chartData = [], chartMeta = {};
      try {
        var chartJson = JSON.parse(responses[base].getContentText());
        var chartResult = (chartJson.chart && chartJson.chart.result && chartJson.chart.result[0]) || {};
        chartMeta = chartResult.meta || {};
        var closes = (chartResult.indicators && chartResult.indicators.quote && chartResult.indicators.quote[0] && chartResult.indicators.quote[0].close) || [];
        var timestamps = chartResult.timestamp || [];
        for (var i = 0; i < timestamps.length; i++) {
          if (closes[i] != null) {
            var d = new Date(timestamps[i] * 1000);
            chartData.push({
              date: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'),
              close: closes[i]
            });
          }
        }
      } catch(cErr) {}
      var filteredCloses = chartData.map(function(d){ return d.close; }).filter(function(v){ return v != null; });
      var lastClose = filteredCloses.length > 0 ? filteredCloses[filteredCloses.length-1] : null;
      var prevClose = filteredCloses.length >= 2 ? filteredCloses[filteredCloses.length-2] : null;
      var chgVal = (lastClose != null && prevClose != null) ? lastClose - prevClose : null;
      var chgPct = (chgVal != null && prevClose > 0) ? chgVal / prevClose : null;

      // Minkabu メインページ (PER/PBR/PSR/時価総額/始値/目標株価/評価)
      var minkPer = null, minkPbr = null, minkPsr = null, minkCap = null, minkOpen = null, minkTgtPrice = null, minkRec = null;
      try {
        var minkHtml = responses[base + 1].getContentText();
        var perM  = minkHtml.match(/<th[^>]*>PER[\s\S]*?<\/th>\s*<td[^>]*>([\d.]+)\s*倍/);
        var pbrM  = minkHtml.match(/<th[^>]*>PBR[\s\S]*?<\/th>\s*<td[^>]*>([\d.]+)\s*倍/);
        var psrM  = minkHtml.match(/<th[^>]*>PSR[\s\S]*?<\/th>\s*<td[^>]*>([\d.]+)\s*倍/);
        var capM  = minkHtml.match(/時価総額[\s\S]{0,100}?<td[^>]*>([\d,]+)\s*(億円|百万円|兆円)/);
        var openM = minkHtml.match(/始値[\s\S]{0,50}?<td[^>]*>([\d,]+\.?\d*)\s*円/);
        if (perM)  minkPer  = parseFloat(perM[1]);
        if (pbrM)  minkPbr  = parseFloat(pbrM[1]);
        if (psrM)  minkPsr  = parseFloat(psrM[1]);
        if (openM) minkOpen = parseFloat(openM[1].replace(/,/g, ''));
        if (capM) {
          var capVal = parseFloat(capM[1].replace(/,/g, ''));
          var capUnit = capM[2];
          if (capUnit === '億円')  minkCap = Math.round(capVal * 1e8);
          else if (capUnit === '兆円') minkCap = Math.round(capVal * 1e12);
          else minkCap = Math.round(capVal * 1e6);
        }
        var tgtPriceM = minkHtml.match(/md_target_box_price">([\d,]+)/);
        if (tgtPriceM) minkTgtPrice = parseFloat(tgtPriceM[1].replace(/,/g, ''));
        var recM2 = minkHtml.match(/md_picksPlate theme_\w+ size_n[^>]*><span class="value">([^<]+)<\/span>/);
        if (recM2) minkRec = recM2[1].trim();
      } catch(mErr) {}

      // Minkabu settlement: 売上高（meta descriptionから抽出）
      var minkRev = null;
      try {
        var settlHtml = responses[base + 2].getContentText();
        var revDescM = settlHtml.match(/【売上高】([\d,]+)百万円/);
        if (revDescM) {
          var revM = parseFloat(revDescM[1].replace(/,/g, ''));
          if (revM > 0) minkRev = Math.round(revM * 1e6);
        }
      } catch(sErr) {}

      return {
        ticker: co.ticker,
        name: co.name,
        price: {
          current:    chartMeta.regularMarketPrice || lastClose,
          change:     chgVal,
          changePct:  chgPct,
          open:       minkOpen || chartMeta.regularMarketOpen || null,
          high:       chartMeta.regularMarketDayHigh || null,
          low:        chartMeta.regularMarketDayLow  || null,
          volume:     chartMeta.regularMarketVolume  || null,
          marketCap:  minkCap || null,
          week52High: chartMeta.fiftyTwoWeekHigh || null,
          week52Low:  chartMeta.fiftyTwoWeekLow  || null,
          currency:   chartMeta.currency || 'JPY',
        },
        valuation: {
          per: minkPer || null,
          pbr: minkPbr || null,
          psr: minkPsr || null,
        },
        financial: {
          revenue:           minkRev      || null,
          targetMeanPrice:   minkTgtPrice || null,
          recommendationKey: minkRec      || null,
        },
        chart: chartData,
      };
    });

    // Google News RSS
    var newsItems = [];
    try {
      var newsXml = responses[12].getContentText();
      var itemRe  = /<item>([\s\S]*?)<\/item>/g;
      var match;
      var count = 0;
      while ((match = itemRe.exec(newsXml)) !== null && count < 5) {
        var item    = match[1];
        var titleM  = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
        var linkM   = item.match(/<link>(.*?)<\/link>/);
        var dateM   = item.match(/<pubDate>(.*?)<\/pubDate>/);
        newsItems.push({
          title:   titleM ? titleM[1].replace(/ - .*$/, '') : '',
          link:    linkM  ? linkM[1].trim()  : '',
          pubDate: dateM  ? dateM[1].trim()  : '',
        });
        count++;
      }
    } catch(newsErr) {}

    var irData = {
      generated: new Date().toISOString(),
      companies: companies,
      news:      newsItems,
    };
    return cb ? jsonpResponse(irData, cb) : jsonResponse(irData);
  } catch(err) {
    var errData = { ir: true, error: err.message };
    return cb ? jsonpResponse(errData, cb) : jsonResponse(errData);
  }
}
