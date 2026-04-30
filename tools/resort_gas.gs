// ============================================================
// リゾート施設 日別売上集約 GAS Web App  v6
// ============================================================
// 予算KPI行 (row 3, index 2):
// 旅館: B3(1)=稼働率予算 C3(2)=ADR予算 D3(3)=RevPAR予算 E3(4)=宿泊客数予算 F3(5)=客単価予算
// ゴルフ: B3(1)=稼働率予算 C3(2)=組数予算 D3(3)=来場者数予算 E3(4)=客単価予算 F3(5)=ADR予算

const BUDGET_SHEET_ID_ = '13X7r8VZkODGbIalBNQ15QarjhloR-FI-6D5f3uLErP0';

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

    // ── budget_ping: 診断（スプレッドシートアクセスなし） ──
    if (e.parameter.budget_ping) {
      var pingResult = { status: 'ok', ping: true, version: 87, ts: new Date().toISOString() };
      return cb ? jsonpResponse(pingResult, cb) : jsonResponse(pingResult);
    }

    // ── budget_get / budget_save: インバウンド予算 ──
    if (e.parameter.budget_get) return fetchBudgetData_(e, cb);
    if (e.parameter.budget_save) return saveBudgetFacility_(e, cb);
    if (e.parameter.budget_save_row) return saveBudgetRow_(e, cb);

    // ── get_cache=1: KPI+PL週次キャッシュ取得 ──
    if (e.parameter.get_cache) {
      var cacheData = getCache_();
      return cb ? jsonpResponse(cacheData, cb) : jsonResponse(cacheData);
    }
    // ── collect_pl=1: 手動収集（1ヶ月分） ──
    if (e.parameter.collect_pl) {
      var ymCollect = e.parameter.ym || getCurrentMonth();
      var collectResult = collectAndCache_(ymCollect);
      var collectOk = { status: 'ok', collected: collectResult };
      return cb ? jsonpResponse(collectOk, cb) : jsonResponse(collectOk);
    }
    // ── collect_all=1: 全既知月を一括収集（初回セットアップ用） ──
    if (e.parameter.collect_all) {
      var allResults = [];
      Object.keys(PL_SHEETS_).forEach(function(ym) {
        try { allResults.push(collectAndCache_(ym)); } catch(e) { allResults.push({ ym: ym, error: e.message }); }
      });
      return jsonResponse({ status: 'ok', results: allResults });
    }
    // ── setup_trigger=1: 週次トリガー登録 ──
    if (e.parameter.setup_trigger) {
      setupWeeklyTrigger_();
      return jsonResponse({ status: 'ok', trigger: 'weekly_monday_0930' });
    }
    // ── add_pl_sheet=1: 新月PLシートを登録（ym=YYYY-MM&id=SSID） ──
    if (e.parameter.add_pl_sheet) {
      var ymAdd = e.parameter.ym || '', idAdd = e.parameter.id || '';
      if (ymAdd && idAdd) {
        var propsAdd = PropertiesService.getScriptProperties();
        var disc = JSON.parse(propsAdd.getProperty('DISCOVERED_PL_SHEETS') || '{}');
        disc[ymAdd] = idAdd; propsAdd.setProperty('DISCOVERED_PL_SHEETS', JSON.stringify(disc));
      }
      return jsonResponse({ status: 'ok', ym: ymAdd, id: idAdd });
    }

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
    var ocb = (e && e.parameter && e.parameter.callback || '').replace(/[^a-zA-Z0-9_]/g, '');
    var errObj = { error: outerErr.message };
    return ocb ? jsonpResponse(errObj, ocb) : jsonResponse(errObj);
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
    // v36: responses[12]→[15]修正（5社×3=15リクエスト）
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
      var newsXml = responses[15].getContentText(); // v36: 5社×3=15リクエスト(0-14)の次
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


// ── 予算データ取得（JSONP対応） ──
// シート構造: A=facility, B=ADR, C=month(YYYY-MM), D=KOR, E=TWN, F=HKG, G=CHA, H=EUR
var BUDGET_NATS_ = ['KOR','TWN','HKG','CHA','EUR'];

function fetchBudgetData_(e, cb) {
  try {
    var fy = e.parameter.fy || '';
    var ss = SpreadsheetApp.openById(BUDGET_SHEET_ID_);
    var sheet = ss.getSheetByName('FY' + fy);
    if (!sheet) {
      var r = { status: 'ok', budget: true, fy: fy, facilities: {} };
      return cb ? jsonpResponse(r, cb) : jsonResponse(r);
    }
    var rows = sheet.getDataRange().getValues();
    var facs = {};
    for (var i = 1; i < rows.length; i++) {
      var name = String(rows[i][0] || '').trim();
      if (!name) continue;
      var adr = Number(rows[i][1]) || 0;
      var rawMonth = rows[i][2];
      var month;
      if (rawMonth instanceof Date) {
        month = rawMonth.getFullYear() + '-' + String(rawMonth.getMonth() + 1).padStart(2, '0');
      } else {
        month = String(rawMonth || '').trim();
      }
      if (!month) continue;
      if (!facs[name]) facs[name] = { adr: adr, monthly: {} };
      facs[name].adr = adr;
      var md = {};
      for (var n = 0; n < BUDGET_NATS_.length; n++) {
        md[BUDGET_NATS_[n]] = Number(rows[i][3 + n]) || 0;
      }
      facs[name].monthly[month] = md;
    }
    var result = { status: 'ok', budget: true, fy: fy, facilities: facs };
    return cb ? jsonpResponse(result, cb) : jsonResponse(result);
  } catch(err) {
    var errResult = { status: 'error', error: err.message };
    return cb ? jsonpResponse(errResult, cb) : jsonResponse(errResult);
  }
}

// ── 1施設予算保存（JSONP対応） ──
// data = { adr, monthly: { "YYYY-MM": { KOR, TWN, HKG, CHA, EUR } } }
function saveBudgetFacility_(e, cb) {
  try {
    var fy = e.parameter.fy || '';
    var facName = e.parameter.fac || '';
    var dataStr = e.parameter.data || '{}';
    var data;
    try { data = JSON.parse(dataStr); } catch(pe) {
      var perr = { status: 'error', error: 'JSON parse error' };
      return cb ? jsonpResponse(perr, cb) : jsonResponse(perr);
    }
    var ss = SpreadsheetApp.openById(BUDGET_SHEET_ID_);
    var sheetName = 'FY' + fy;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, 8).setValues([['facility','ADR','month','KOR','TWN','HKG','CHA','EUR']]);
    }
    // delete existing rows for this facility
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][0]).trim() === facName) sheet.deleteRow(i + 1);
    }
    // append new rows
    var adr = data.adr || 0;
    var monthly = data.monthly || {};
    var months = Object.keys(monthly).sort();
    var newRows = [];
    for (var m = 0; m < months.length; m++) {
      var md = monthly[months[m]];
      var row = [facName, adr, months[m]];
      for (var n = 0; n < BUDGET_NATS_.length; n++) {
        row.push(Number(md[BUDGET_NATS_[n]]) || 0);
      }
      newRows.push(row);
    }
    if (newRows.length > 0) {
      var lastRow = sheet.getLastRow();
      var range = sheet.getRange(lastRow + 1, 1, newRows.length, 8);
      // C列(month)をテキスト形式に設定してDate自動変換を防ぐ
      sheet.getRange(lastRow + 1, 3, newRows.length, 1).setNumberFormat('@');
      range.setValues(newRows);
    }
    var ok = { status: 'ok', budget_save: true, facility: facName, fy: fy };
    return cb ? jsonpResponse(ok, cb) : jsonResponse(ok);
  } catch(err) {
    var errResult = { status: 'error', error: err.message };
    return cb ? jsonpResponse(errResult, cb) : jsonResponse(errResult);
  }
}

// ── 1行予算保存（施設×月、JSONP対応） ──
// params: fy, fac, month(YYYY-MM), adr, KOR, TWN, HKG, CHA, EUR
function saveBudgetRow_(e, cb) {
  try {
    var fy      = e.parameter.fy    || '';
    var facName = e.parameter.fac   || '';
    var month   = e.parameter.month || '';
    var adr     = Number(e.parameter.adr) || 0;
    if (!fy || !facName || !month) {
      var perr = { status: 'error', error: 'missing params' };
      return cb ? jsonpResponse(perr, cb) : jsonResponse(perr);
    }
    var nats = {
      KOR: Number(e.parameter.KOR)||0, TWN: Number(e.parameter.TWN)||0,
      HKG: Number(e.parameter.HKG)||0, CHA: Number(e.parameter.CHA)||0,
      EUR: Number(e.parameter.EUR)||0
    };
    var ss = SpreadsheetApp.openById(BUDGET_SHEET_ID_);
    var sheetName = 'FY' + fy;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, 8).setValues([['facility','ADR','month','KOR','TWN','HKG','CHA','EUR']]);
    }
    var rows = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === facName && String(rows[i][2]).trim() === month) {
        targetRow = i + 1; // 1-based
        break;
      }
    }
    var newRow = [facName, adr, month, nats.KOR, nats.TWN, nats.HKG, nats.CHA, nats.EUR];
    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, 8).setValues([newRow]);
    } else {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 3, 1, 1).setNumberFormat('@');
      sheet.getRange(lastRow + 1, 1, 1, 8).setValues([newRow]);
    }
    var ok = { status: 'ok', budget_save_row: true, facility: facName, month: month, fy: fy };
    return cb ? jsonpResponse(ok, cb) : jsonResponse(ok);
  } catch(err) {
    var errResult = { status: 'error', error: err.message };
    return cb ? jsonpResponse(errResult, cb) : jsonResponse(errResult);
  }
}

// ══════════════════════════════════════════════════════════════════
//  週次PL自動収集  v1 (2026-04-30)
// ══════════════════════════════════════════════════════════════════

// ── 月別PLスプレッドシートID（2025-07〜）──────────────────────────
const PL_SHEETS_ = {
  '2026-03': '1-mZ8lCJFIBuFRxed_ZSi2IkAWoZFsKhguyYl-rJvOkE',
  '2026-02': '1QzPD4kulw7WEsTCzkQ99ZRoDTe4TX5Hhoh8JSozLWik',
  '2026-01': '1HTAoqB-VZwDZhW8TAI2GgJgvYi_m4DLbPMmoRjVNOx4',
  '2025-12': '16_9OSPom0C0yAS29ZCkhyPMYvzAmJq911bhBBFHlI-I',
  '2025-11': '1lIoCED6WOQ-HPKS1e0scjSoif_UAlz8a8GrPhOVGZCo',
  '2025-10': '1jezU8VVKvscRTHEfKVXbloALZoHWYnGFvk51D-KGSMc',
  '2025-09': '1gFdYhNxWdAK886PYWFmqzNwfkTKapPYKLD-kRAoM9yI',
  '2025-08': '1pcjjwo-oB5hEBjgwHdJlc7LQYvsdNLSVwZVGBTbf578',
  '2025-07': '18jimGRE7E7wlLwoNet_vUUl_9DD6YrG0_vxNnpEs00U',
};

// ── PL列マッピング (0-indexed, B=1) ─────────────────────────────
// IはPL合計列のためスキップ。Jの前で+1ずれる
const PL_FAC_COLS_ = {
  '九重久織亭':  2,  // C
  '九重虎乃湯':  3,  // D (PLシートの「九重虎の湯」と同一施設)
  '宮若虎の湯':  4,  // E
  '小塚久の葉':  5,  // F
  '仙石原久の葉':6,  // G
  '古民家煉り':  7,  // H
  'Tsmart':      9,  // J (Iは合計列でスキップ)
  '若宮コース':  12, // M
  '大分コース':  13, // N
};
// ── PL行マッピング (0-indexed, row9=index8) ─────────────────────
const PL_ROWS_ = { rev_a: 8, gp_a: 11, lc_a: 12, op_a: 17, op_rate: 18 };

// ── PLスプレッドシートのセル値を数値化 ──
function toPlNum_(rows, rowIdx, colIdx) {
  if (!rows[rowIdx]) return null;
  var v = rows[rowIdx][colIdx];
  if (v === '' || v == null) return null;
  var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[¥,\s]/g, ''));
  return isNaN(n) ? null : n;
}

// ── 未知月のPLシートをPropertiesServiceから探す ──
function resolvePLSheetId_(ym) {
  var id = PL_SHEETS_[ym];
  if (id) return id;
  var props = PropertiesService.getScriptProperties();
  var disc = JSON.parse(props.getProperty('DISCOVERED_PL_SHEETS') || '{}');
  return disc[ym] || null;
}

// ── 月PLスプレッドシートを解析してPLデータを返す ──
function parsePLSheet_(ym) {
  var ssId = resolvePLSheetId_(ym);
  if (!ssId) return null;
  try {
    var ss = SpreadsheetApp.openById(ssId);
    var monthNum = parseInt(ym.split('-')[1], 10);
    // 「TGR全体PL」を含むシートを探す
    var targetSheet = null;
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sn = sheets[i].getName();
      if (sn.indexOf('TGR全体PL') >= 0) { targetSheet = sheets[i]; break; }
    }
    if (!targetSheet) targetSheet = sheets[0];
    var rows = targetSheet.getDataRange().getValues();
    var result = {};
    Object.keys(PL_FAC_COLS_).forEach(function(facName) {
      var col = PL_FAC_COLS_[facName];
      var rev_a = toPlNum_(rows, PL_ROWS_.rev_a, col);
      var gp_a  = toPlNum_(rows, PL_ROWS_.gp_a,  col);
      var lc_a  = toPlNum_(rows, PL_ROWS_.lc_a,  col);
      var op_a  = toPlNum_(rows, PL_ROWS_.op_a,  col);
      var op_rt = toPlNum_(rows, PL_ROWS_.op_rate, col);
      if (rev_a != null || gp_a != null) {
        result[facName] = {
          rev_a:  rev_a,
          gp_a:   gp_a,
          lc_a:   lc_a,
          op_a:   op_a,
          op_rate: op_rt != null ? (Math.abs(op_rt) <= 1 ? op_rt : op_rt / 100) : null,
          gp_rate: (rev_a != null && rev_a > 0 && gp_a != null) ? Math.round(gp_a / rev_a * 10000) / 10000 : null,
        };
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  } catch(e) {
    Logger.log('parsePLSheet_ error ' + ym + ': ' + e.message);
    return null;
  }
}

// ── 1ヶ月分のKPIを全施設から収集 ──
function collectKPI_(ym) {
  var result = {};
  FACILITIES.forEach(function(facility) {
    try {
      var ss = SpreadsheetApp.openById(facility.id);
      var sheet = ss.getSheetByName(monthToSheetName(ym));
      if (!sheet) return;
      var data = parseSheet(sheet, facility.name, facility.type);
      var mo = data.monthly || {};
      var rec = {
        rev_a: mo.rev_actual > 0 ? mo.rev_actual : null,
        rev_b: mo.rev_budget  > 0 ? mo.rev_budget  : null,
        pax_a: mo.pax_actual  > 0 ? mo.pax_actual  : null,
        pax_b: mo.pax_budget  > 0 ? mo.pax_budget  : null,
        adr_a: mo.adr         > 0 ? mo.adr          : null,
        adr_b: mo.adr_b       > 0 ? mo.adr_b        : null,
        occ_a: mo.occupancy   > 0 ? mo.occupancy / 100 : null,
        occ_b: mo.occ_b != null   ? (mo.occ_b > 1 ? mo.occ_b / 100 : mo.occ_b) : null,
        rvp_a: mo.revpar      > 0 ? mo.revpar        : null,
        rvp_b: mo.rvp_b       > 0 ? mo.rvp_b         : null,
        spd_a: (mo.pax_actual > 0 && mo.rev_actual > 0) ? Math.round(mo.rev_actual / mo.pax_actual) : null,
        spd_b: mo.spd_b       > 0 ? mo.spd_b         : null,
        type:  facility.type,
      };
      if (Object.values(rec).some(function(v){ return v != null && v !== facility.type; }))
        result[facility.name] = rec;
    } catch(e) {
      Logger.log('collectKPI_ ' + facility.name + ' ' + ym + ': ' + e.message);
    }
  });
  return result;
}

// ── 1ヶ月分を収集してPropertiesServiceに保存 ──
function collectAndCache_(ym) {
  var props = PropertiesService.getScriptProperties();
  var kpiData = collectKPI_(ym);
  var plData  = parsePLSheet_(ym);
  var meta = JSON.parse(props.getProperty('WEEKLY_CACHE_META') || '{}');
  meta[ym] = new Date().toISOString();
  props.setProperty('WEEKLY_CACHE_META', JSON.stringify(meta));
  if (Object.keys(kpiData).length > 0)
    props.setProperty('CACHE_KPI_' + ym, JSON.stringify(kpiData));
  if (plData && Object.keys(plData).length > 0)
    props.setProperty('CACHE_PL_' + ym, JSON.stringify(plData));
  return { ym: ym, kpi: Object.keys(kpiData).length, pl: plData ? Object.keys(plData).length : 0 };
}

// ── キャッシュ全件取得 ──
function getCache_() {
  var props = PropertiesService.getScriptProperties();
  var meta  = JSON.parse(props.getProperty('WEEKLY_CACHE_META') || '{}');
  var result = { cache: true, generated: new Date().toISOString(), months: {} };
  Object.keys(meta).sort().forEach(function(ym) {
    var kpiStr = props.getProperty('CACHE_KPI_' + ym);
    var plStr  = props.getProperty('CACHE_PL_'  + ym);
    if (kpiStr || plStr) {
      result.months[ym] = {
        updated: meta[ym],
        kpi: kpiStr ? JSON.parse(kpiStr) : {},
        pl:  plStr  ? JSON.parse(plStr)  : {},
      };
    }
  });
  return result;
}

// ── 週次自動収集（Time-Driven Trigger から呼ばれる） ──
function weeklyCollect_() {
  var now  = new Date();
  var cur  = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var prv  = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
  var pp   = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  var prv2 = pp.getFullYear() + '-' + String(pp.getMonth() + 1).padStart(2, '0');
  [cur, prv, prv2].forEach(function(ym) {
    try {
      var r = collectAndCache_(ym);
      Logger.log('weeklyCollect_ ' + ym + ': KPI=' + r.kpi + ' PL=' + r.pl);
    } catch(e) {
      Logger.log('weeklyCollect_ error ' + ym + ': ' + e.message);
    }
  });
}

// ── 毎週月曜9:30トリガーを登録（一度だけ実行） ──
function setupWeeklyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'weeklyCollect_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyCollect_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .nearMinute(30)
    .create();
  Logger.log('setupWeeklyTrigger_: registered weeklyCollect_ @ Monday 09:30');
}
