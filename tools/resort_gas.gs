// ============================================================
// リゾート施設 日別売上集約 + IR GAS Web App  v17
// ============================================================
// IR変更(v17): JSONP対応 / Google News RSS / v10+v7 バリュエーション取得
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
      var irObj = buildIRData();
      return cb ? jsonpResponse(irObj, cb) : jsonResponse(irObj);
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

// ── IR データ構築 (v18: price module追加/配当・Beta・EPS/1年チャート/ニュース15件) ──
// --- kabutan.jp scraper (PER/PBR/mcap/div) ---
function fetchKabutanData(code) {
  var kd = {};
  try {
    var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
    var resp = UrlFetchApp.fetch('https://kabutan.jp/stock/?code=' + code,
      { headers: { 'User-Agent': ua }, muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) { kd.kabutanStatus = resp.getResponseCode(); return kd; }
    var html = resp.getContentText();
    // PER, PBR, divYield appear in order: <td>NUM<span class="fs9">倍/％</span>
    var fs9 = [], re = /<td[^>]*>(\d[\d,]*\.?\d*)<span class="fs9">([^<]*)<\/span>/g, m;
    while ((m = re.exec(html)) !== null && fs9.length < 4) {
      fs9.push({ val: parseFloat(m[1].replace(/,/g,'')), unit: m[2] });
    }
    if (fs9[0]) kd.per           = fs9[0].val;
    if (fs9[1]) kd.pbr           = fs9[1].val;
    if (fs9[2]) kd.dividendYield = fs9[2].val / 100;
    var mcap = html.match(/(\d[\d,]*)\s*<span>億円<\/span>/);
    if (mcap) kd.marketCap = parseFloat(mcap[1].replace(/,/g,'')) * 1e8;
  } catch(e) { kd.kabutanError = e.message; }
  return kd;
}

function buildIRData() {
  var ticker = '141A.T';
  var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  var opts = { headers: { 'User-Agent': ua }, muteHttpExceptions: true };
  var result = { generated: new Date().toISOString(), ticker: ticker };

  function raw(obj, key) {
    if (!obj || obj[key] == null) return null;
    return obj[key].raw !== undefined ? obj[key].raw : obj[key];
  }

  // 1. quoteSummary v10 (price + summaryDetail + keyStats + financialData + recommendationTrend)
  try {
    var summaryUrl = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + ticker
      + '?modules=price,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend';
    var sr = UrlFetchApp.fetch(summaryUrl, opts);
    if (sr.getResponseCode() === 200) {
      var sj = JSON.parse(sr.getContentText());
      var r0 = (sj.quoteSummary && sj.quoteSummary.result && sj.quoteSummary.result[0]) || {};
      var priceM   = r0.price || {};           // regularMarketPrice, change 等
      var sumDet   = r0.summaryDetail || {};   // marketCap, PE, PSR, beta, dividend
      var keyStats = r0.defaultKeyStatistics || {};
      var fin      = r0.financialData || {};
      var recTrend = (r0.recommendationTrend && r0.recommendationTrend.trend && r0.recommendationTrend.trend[0]) || {};
      result.price = {
        current:    raw(priceM, 'regularMarketPrice')  || raw(sumDet, 'regularMarketPrice'),
        change:     raw(priceM, 'regularMarketChange'),
        changePct:  raw(priceM, 'regularMarketChangePercent'),
        open:       raw(priceM, 'regularMarketOpen'),
        high:       raw(priceM, 'regularMarketDayHigh'),
        low:        raw(priceM, 'regularMarketDayLow'),
        volume:     raw(priceM, 'regularMarketVolume') || raw(sumDet, 'regularMarketVolume'),
        avgVolume:  raw(sumDet, 'averageVolume10days') || raw(sumDet, 'averageVolume'),
        marketCap:  raw(priceM, 'marketCap')           || raw(sumDet, 'marketCap'),
        week52High: raw(sumDet, 'fiftyTwoWeekHigh'),
        week52Low:  raw(sumDet, 'fiftyTwoWeekLow'),
        currency:   (priceM.currency || sumDet.currency || 'JPY'),
        marketState: (priceM.marketState || ''),
      };
      result.valuation = {
        per:          raw(sumDet, 'trailingPE'),
        forwardPer:   raw(sumDet, 'forwardPE'),
        pbr:          raw(keyStats, 'priceToBook'),
        psr:          raw(sumDet, 'priceToSalesTrailing12Months'),
        ev:           raw(keyStats, 'enterpriseValue'),
        evEbitda:     raw(keyStats, 'enterpriseToEbitda'),
        evRevenue:    raw(keyStats, 'enterpriseToRevenue'),
        beta:         raw(sumDet, 'beta'),
        dividendYield:raw(sumDet, 'dividendYield') || raw(sumDet, 'trailingAnnualDividendYield'),
        eps:          raw(keyStats, 'trailingEps'),
        epsForward:   raw(keyStats, 'forwardEps'),
      };
      result.financial = {
        revenue:          raw(fin, 'totalRevenue'),
        ebitda:           raw(fin, 'ebitda'),
        ebitdaMargin:     raw(fin, 'ebitdaMargins'),
        grossMargin:      raw(fin, 'grossMargins'),
        operatingMargin:  raw(fin, 'operatingMargins'),
        freeCashFlow:     raw(fin, 'freeCashflow'),
        totalDebt:        raw(fin, 'totalDebt'),
        totalCash:        raw(fin, 'totalCash'),
        returnOnEquity:   raw(fin, 'returnOnEquity'),
        targetMeanPrice:  raw(fin, 'targetMeanPrice'),
        targetHighPrice:  raw(fin, 'targetHighPrice'),
        targetLowPrice:   raw(fin, 'targetLowPrice'),
        recommendationKey: fin.recommendationKey || null,
      };
      result.analysts = {
        strongBuy:  recTrend.strongBuy  || 0,
        buy:        recTrend.buy        || 0,
        hold:       recTrend.hold       || 0,
        sell:       recTrend.sell       || 0,
        strongSell: recTrend.strongSell || 0,
        period:     recTrend.period     || '0m',
      };
    }
  } catch(e) { result.summaryError = e.message; }

  // 2. Fallback: v7/quote (price/valuationが空の場合)
  var hasValuation = result.valuation && (result.valuation.per != null || result.valuation.pbr != null) && result.price && result.price.marketCap != null && result.price.current != null;
  if (!hasValuation) {
    try {
      var qUrl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + ticker;
      var qr = UrlFetchApp.fetch(qUrl, opts);
      if (qr.getResponseCode() === 200) {
        var qj = JSON.parse(qr.getContentText());
        var q = (qj.quoteResponse && qj.quoteResponse.result && qj.quoteResponse.result[0]) || {};
        if (!result.price) result.price = {};
        if (result.price.current    == null && q.regularMarketPrice)        result.price.current    = q.regularMarketPrice;
        if (result.price.change     == null && q.regularMarketChange)       result.price.change     = q.regularMarketChange;
        if (result.price.changePct  == null && q.regularMarketChangePercent) result.price.changePct  = q.regularMarketChangePercent / 100;
        if (result.price.marketCap  == null && q.marketCap)                result.price.marketCap  = q.marketCap;
        if (result.price.week52High == null && q.fiftyTwoWeekHigh)         result.price.week52High = q.fiftyTwoWeekHigh;
        if (result.price.week52Low  == null && q.fiftyTwoWeekLow)          result.price.week52Low  = q.fiftyTwoWeekLow;
        if (result.price.volume     == null && q.regularMarketVolume)       result.price.volume     = q.regularMarketVolume;
        if (!result.valuation) result.valuation = {};
        if (result.valuation.per        == null && q.trailingPE)                     result.valuation.per        = q.trailingPE;
        if (result.valuation.forwardPer == null && q.forwardPE)                      result.valuation.forwardPer = q.forwardPE;
        if (result.valuation.pbr        == null && q.priceToBook)                    result.valuation.pbr        = q.priceToBook;
        if (result.valuation.psr        == null && q.priceToSalesTrailing12Months)   result.valuation.psr        = q.priceToSalesTrailing12Months;
        if (!result.financial) result.financial = {};
        if (result.financial.returnOnEquity == null && q.returnOnEquity)  result.financial.returnOnEquity = q.returnOnEquity;
        if (result.financial.revenue        == null && q.totalRevenue)    result.financial.revenue        = q.totalRevenue;
        if (!result.valuation) result.valuation = {};
        if (result.valuation.beta          == null && q.beta)                         result.valuation.beta          = q.beta;
        if (result.valuation.dividendYield == null && q.trailingAnnualDividendYield)  result.valuation.dividendYield = q.trailingAnnualDividendYield;
        if (result.valuation.eps           == null && q.epsTrailingTwelveMonths)      result.valuation.eps           = q.epsTrailingTwelveMonths;
        if (result.valuation.epsForward    == null && q.epsForward)                   result.valuation.epsForward    = q.epsForward;
        if (result.price.avgVolume         == null && q.averageDailyVolume10Day)      result.price.avgVolume         = q.averageDailyVolume10Day;
        result.quoteFallback = true;
      }
    } catch(e) { result.quoteError = e.message; }
  }

  // 3. Chart sparkline (v8/chart 1年)
  try {
    var chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + ticker + '?interval=1d&range=1y';
    var cr = UrlFetchApp.fetch(chartUrl, opts);
    if (cr.getResponseCode() === 200) {
      var cj = JSON.parse(cr.getContentText());
      var cres = (cj.chart && cj.chart.result && cj.chart.result[0]) || {};
      var closes     = (cres.indicators && cres.indicators.quote && cres.indicators.quote[0] && cres.indicators.quote[0].close) || [];
      var timestamps = cres.timestamp || [];
      result.chart = [];
      for (var i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          var d = new Date(timestamps[i] * 1000);
          result.chart.push({
            date: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'),
            close: closes[i]
          });
        }
      }
      // 価格フォールバック: chart最終値で補完
      if (result.chart.length > 0) {
        if (!result.price) result.price = {};
        var lastClose = result.chart[result.chart.length - 1].close;
        if (result.price.current == null) result.price.current = lastClose;
        if (result.price.change == null && result.chart.length > 1) {
          var prevClose = result.chart[result.chart.length - 2].close;
          result.price.change    = lastClose - prevClose;
          result.price.changePct = prevClose > 0 ? (lastClose - prevClose) / prevClose : 0;
        }
        if (result.price.week52High == null) result.price.week52High = Math.max.apply(null, result.chart.map(function(x){return x.close;}));
        if (result.price.week52Low  == null) result.price.week52Low  = Math.min.apply(null, result.chart.map(function(x){return x.close;}));
      }
    }
  } catch(e) { result.chartError = e.message; }

  // 4. News: Google News RSS (最大10件)
  try {
    var newsUrl = 'https://news.google.com/rss/search?q=%E3%83%88%E3%83%A9%E3%82%A4%E3%82%A2%E3%83%AB%E3%83%9B%E3%83%BC%E3%83%AB%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0%E3%82%B9&hl=ja&gl=JP&ceid=JP%3Aja';
    var nr = UrlFetchApp.fetch(newsUrl, opts);
    result.news = [];
    if (nr.getResponseCode() === 200) {
      var nxml  = nr.getContentText();
      var itemRe = /<item>([\s\S]*?)<\/item>/g;
      var match;
      var count = 0;
      while ((match = itemRe.exec(nxml)) !== null && count < 15) {
        var item   = match[1];
        var titleM = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
        var linkM  = item.match(/<link>(.*?)<\/link>/);
        var dateM  = item.match(/<pubDate>(.*?)<\/pubDate>/);
        result.news.push({
          title:   titleM ? titleM[1].replace(/ - .*$/, '') : '',
          link:    linkM  ? linkM[1].trim()  : '',
          pubDate: dateM  ? dateM[1].trim()  : '',
        });
        count++;
      }
    }
  } catch(e) { result.newsError = e.message; }

  // 5. kabutan.jp supplement (PER/PBR/mcap/div)
  try {
    var kd = fetchKabutanData('141A');
    if (!result.price)     result.price     = {};
    if (!result.valuation) result.valuation = {};
    if (kd.marketCap     != null && result.price.marketCap         == null) result.price.marketCap         = kd.marketCap;
    if (kd.per           != null && result.valuation.per           == null) result.valuation.per           = kd.per;
    if (kd.pbr           != null && result.valuation.pbr           == null) result.valuation.pbr           = kd.pbr;
    if (kd.dividendYield != null && result.valuation.dividendYield == null) result.valuation.dividendYield = kd.dividendYield;
    if (kd.kabutanError)  result.kabutanError  = kd.kabutanError;
    if (kd.kabutanStatus) result.kabutanStatus = kd.kabutanStatus;
  } catch(e) { result.kabutanError = e.message; }

  return result;
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
