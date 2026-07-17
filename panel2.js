// ══════════════════════════════════════════
// ANALİZ OVERLAY — Tam Ekran Sayfa Sistemi
// ══════════════════════════════════════════

var _aoData        = [];      // tumKayitlar
var _aoInspector   = null;    // inspector nesnesi
var _aoHedef       = 100;

var AO_LS_KEY = 'gemini_api_key_perf_panel';

function openAnalizOverlay(inspData, inspObj, hedef) {
  _aoData      = inspData;
  _aoInspector = inspObj;
  _aoHedef     = hedef || 100;

  // Başlık
  document.getElementById('analiz-overlay-title').textContent = '📊 ' + inspObj.ins + ' — ' + (translations[currentLang]||translations.tr).detailed_perf;

  // Stats
  _aoRenderStats();

  // Top 20 Klasman
  _aoRenderTop20();

  // Klasman filtre doldur
  var klSel = document.getElementById('ao-f-klasman');
  klSel.innerHTML = '<option value="">' + (translations[currentLang]||translations.tr).all_btn + '</option>';
  var klList = [...new Set(_aoData.map(function(k){ return k.klasman; }))];
  klList.forEach(function(k) {
    var o = document.createElement('option'); o.value = k; o.textContent = k; klSel.appendChild(o);
  });

  // Filtreleri sıfırla
  document.getElementById('ao-f-klasman').value  = '';
  document.getElementById('ao-f-tarih').value    = '';
  document.getElementById('ao-f-minadet').value  = 0;
  document.getElementById('ao-f-sort').value     = '';

  // Gemini kayıtlı key yükle
  try {
    var savedKey = localStorage.getItem(AO_LS_KEY) || '';
    if (savedKey) document.getElementById('ao-gkey').value = savedKey;
  } catch(e) {}

  // Sonuçları sıfırla
  document.getElementById('ao-gresult').style.display  = 'none';
  document.getElementById('ao-gerror').style.display   = 'none';
  document.getElementById('ao-goutput').textContent    = '';
  document.getElementById('ao-gemini-panel').style.display = 'none';
  document.getElementById('ao-gemini-badge').textContent = (translations[currentLang]||translations.tr).closed_label;
  document.getElementById('ao-gemini-chevron').style.transform = '';

  // Tabloyu render et
  aoApplyFilters();

  // Overlay'i aç
  var ov = document.getElementById('analiz-overlay');
  ov.style.display = 'block';
  ov.scrollTop = 0;

  // Body scroll kilitle
  document.body.style.overflow = 'hidden';
}

function closeAnalizOverlay() {
  document.getElementById('analiz-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Veri Çek / Yenile (manuel buton) ──
function aoRefreshSheetsData() {
  const inspector = selectedInspectorDetail;
  if (!inspector) return;

  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) {
    alert('Google Sheets bağlantısı yapılandırılmamış.');
    return;
  }

  // Buton durumu: yükleniyor
  const btn = document.getElementById('ao-refresh-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:ao-gspin .8s linear infinite;vertical-align:middle;margin-right:5px;"></span> Yükleniyor…';
  }

  // Loading banner
  var loadBanner = document.getElementById('ao-sheets-loading');
  if (!loadBanner) {
    loadBanner = document.createElement('div');
    loadBanner.id = 'ao-sheets-loading';
    loadBanner.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1565C0;color:#fff;padding:10px 18px;border-radius:10px;font-size:12px;font-family:DM Sans,sans-serif;z-index:9999;box-shadow:0 4px 16px rgba(21,101,192,.4);display:flex;align-items:center;gap:8px;';
    loadBanner.innerHTML = '<div style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:ao-gspin .8s linear infinite;"></div> Veri yükleniyor…';
    document.body.appendChild(loadBanner);
  }

  const buildTumKayitlar = (insp) => {
    const list = [];
    Object.entries(insp.klasmanlar).forEach(([klasmanAd, kd]) => {
      (kd.kayitlar || []).forEach(k => {
        list.push({
          id: list.length + 1, klasman: klasmanAd,
          adet: k.adet, kontrolAdetSuresi: k.kontrolAdetSuresi || 0,
          istasyonSuresi: k.istasyonSuresi || 0, standartSure: k.standartSure || 0,
          kayitFiiliSure: k.kayitFiiliSure || 0, baslangic: k.baslangic,
          bitis: k.bitis, tarihGecerli: k.tarihGecerli,
          ortalamaKontrolSn: k.adet > 0 && k.kayitFiiliSure > 0 ? Math.round(k.kayitFiiliSure / k.adet) : null,
          talepNo: k.talepNo || ''
        });
      });
    });
    return list;
  };

  jsonpFetch(url, { action: 'getInspectorKayitlar', token, inspectorAdi: inspector.ins.normalize('NFC').trim().toUpperCase() })
    .then(function(data) {
      if (data.status === 'ok' && data.kayitlar && typeof data.kayitlar === 'object') {
        const insKlasmanKeys = Object.keys(inspector.klasmanlar);
        const norm = function(s) { return s.normalize('NFC').trim().toLowerCase(); };
        Object.entries(data.kayitlar).forEach(function([klasmanAd, kayitlarArr]) {
          if (!Array.isArray(kayitlarArr) || !kayitlarArr.length) return;
          var hedefKey = insKlasmanKeys.find(function(k) { return k === klasmanAd; })
            || insKlasmanKeys.find(function(k) { return norm(k) === norm(klasmanAd); });
          if (!hedefKey) return;
          inspector.klasmanlar[hedefKey].kayitlar = kayitlarArr.map(function(r) {
            return Object.assign({}, r, {
              kontrolAdetSuresi: r.kontrolAdetSuresi || 0,
              istasyonSuresi: r.istasyonSuresi || 0,
              standartSure: r.standartSure || 0,
              kayitFiiliSure: r.kayitFiiliSure || 0,
              tarihGecerli: r.tarihGecerli || false,
              baslangic: r.baslangic ? (function() { var d = new Date(r.baslangic); return isNaN(d.getTime()) ? null : d; })() : null,
              bitis: r.bitis ? (function() { var d = new Date(r.bitis); return isNaN(d.getTime()) ? null : d; })() : null
            });
          });
        });
        // Overlay açıksa tabloyu güncelle
        var ov = document.getElementById('analiz-overlay');
        if (ov && ov.style.display !== 'none') {
          var fresh = buildTumKayitlar(inspector);
          _aoData = fresh;
          _aoRenderStats();
          _aoRenderTop20();
          aoApplyFilters();
          var kb = Object.values(inspector.klasmanlar).reduce(function(s,kd) { return s + (kd.kayitlar||[]).length; }, 0);
          console.log('[Veri Çek] Güncellendi:', kb, 'kayıt');
        }
        // Başarı bildirimi
        if (btn) {
          btn.innerHTML = '✅ Güncellendi';
          setTimeout(function() {
            if (btn) { btn.innerHTML = '🔄 Veri Çek'; btn.disabled = false; }
          }, 2000);
        }
      } else {
        // status:'error' kontrolü — "Kayıt bulunamadı" mesajı teknik hata değil
        var isNotFound = data.status === 'error' &&
          typeof data.message === 'string' &&
          (data.message.indexOf('bulunamad') !== -1 || data.message.indexOf('not found') !== -1);
        if (isNotFound) {
          if (btn) {
            btn.innerHTML = 'ℹ️ Kayıt Yok';
            setTimeout(function() {
              if (btn) { btn.innerHTML = '🔄 Veri Çek'; btn.disabled = false; }
            }, 2500);
          }
          console.info('[Veri Çek] Bu inspector için Sheets\'te kayıt bulunamadı:', data.message);
        } else {
          if (btn) {
            btn.innerHTML = '⚠️ Veri Gelmedi';
            setTimeout(function() {
              if (btn) { btn.innerHTML = '🔄 Veri Çek'; btn.disabled = false; }
            }, 2500);
          }
          console.warn('[Veri Çek] Beklenmeyen yanıt:', data);
        }
      }
    })
    .catch(function(e) {
      console.warn('[Veri Çek] Bağlantı hatası:', e.message);
      if (btn) {
        btn.innerHTML = '❌ Bağlantı Hatası';
        setTimeout(function() {
          if (btn) { btn.innerHTML = '🔄 Veri Çek'; btn.disabled = false; }
        }, 2500);
      }
    })
    .finally(function() {
      var b = document.getElementById('ao-sheets-loading');
      if (b) b.remove();
      // Buton her durumda enable'a don
      var btn2 = document.getElementById('ao-refresh-btn');
      if (btn2 && btn2.disabled) {
        setTimeout(function() {
          if (btn2) { btn2.innerHTML = '🔄 Veri Cek'; btn2.disabled = false; }
        }, 3000);
      }
    });
}

// ── Stat Kartlar ──
function _aoRenderStats() {
  var totalAdet  = _aoData.reduce(function(s,k){ return s + k.adet; }, 0);
  var totalStd   = _aoData.reduce(function(s,k){ return s + k.standartSure; }, 0);
  var totalFiili = _aoData.reduce(function(s,k){ return s + k.kayitFiiliSure; }, 0);
  // "Ne ödül ne ceza": nötr kayıp zaman mesai süresinden düşülüp performans
  // buna göre hesaplanır — Dashboard/getDispPerf ile aynı mantık, aksi halde
  // bu detay sayfası farklı (eski) bir yüzde gösterir.
  var standartSnAo = _aoInspector.standartSure || 0;
  var mesaiSnAo = _aoInspector.mesaiSure || 0;
  var notrKayipSnAo = (typeof getNotrKayipDakikaForInspector === 'function')
    ? getNotrKayipDakikaForInspector(_aoInspector.ins) * 60 : 0;
  if (notrKayipSnAo > 0 && mesaiSnAo > notrKayipSnAo) mesaiSnAo -= notrKayipSnAo;
  var hamPerf    = (standartSnAo > 0 && mesaiSnAo > 0)
    ? Math.round((standartSnAo / mesaiSnAo) * 100) : (_aoInspector.genelHizPerf || 0);
  var duzPerf    = Math.round(hamPerf * (100 / _aoHedef));
  var overtimeDk = Math.round((_aoInspector.toplamMesaistiSaniye || 0) / 60);

  function perfColor(p){ return p >= 95 ? '#00897B' : p >= 85 ? '#1565C0' : p >= 70 ? '#F57F17' : p >= 50 ? '#EF5350' : '#B71C1C'; }

  var cards = [
    ['📦',(translations[currentLang]||translations.tr).stat_total_product,   String(totalAdet), 'var(--navy)'],
    ['⏱',(translations[currentLang]||translations.tr).std_duration_label,  _aoFmtSn(totalStd), 'var(--navy)'],
    ['🕐','GERÇEKLEŞEN',   totalFiili > 0 ? _aoFmtSn(totalFiili) : '—', totalFiili > 0 ? '#00897B' : '#5A7FA8'],
    ['📅','MESAİ SÜRESİ',  _aoFmtSn(_aoInspector.mesaiSure||0) + (overtimeDk > 0 ? ' (+'+overtimeDk+'dk 🌙)' : ''), overtimeDk > 0 ? '#E65100' : 'var(--navy)'],
    ['📊',(translations[currentLang]||translations.tr).adj_perf_label_upper, duzPerf + '%', perfColor(duzPerf)]
  ];
  document.getElementById('ao-stats-grid').innerHTML = cards.map(function(c){
    return '<div style="background:#fff;border:1px solid #DDEEFF;border-radius:10px;padding:14px 8px;text-align:center;">'
      + '<div style="font-size:18px;margin-bottom:4px;">' + c[0] + '</div>'
      + '<div style="font-size:18px;font-weight:700;color:' + c[3] + ';font-family:\'DM Mono\',monospace;line-height:1.2;">' + c[2] + '</div>'
      + '<div style="font-size:9px;color:#5A7FA8;text-transform:uppercase;letter-spacing:.6px;margin-top:4px;">' + c[1] + '</div>'
      + '</div>';
  }).join('');
}

// ── Top 20 Klasman ──
var _aoTop20Liste = [];
var _aoTop20Expanded = false;

function aoTop20Toggle() {
  _aoTop20Expanded = !_aoTop20Expanded;
  var btn   = document.getElementById('ao-top20-toggle-btn');
  var icon  = document.getElementById('ao-top20-toggle-icon');
  var label = document.getElementById('ao-top20-toggle-label');
  if (_aoTop20Expanded) {
    icon.textContent  = '▲';
    label.textContent = 'Daralt';
  } else {
    icon.textContent  = '▼';
    label.textContent = 'Tümünü Görüntüle';
  }
  _aoRenderTop20Grid();
}

function _aoRenderTop20Grid() {
  var container = document.getElementById('ao-top20-grid');
  if (!container) return;
  var visible = _aoTop20Expanded ? _aoTop20Liste : _aoTop20Liste.slice(0, 8);
  var maxAdet = _aoTop20Liste.length ? _aoTop20Liste[0].adet || 1 : 1;
  var rankColors = ['#F9A825','#90A4AE','#CD7F32'];
  container.innerHTML = visible.map(function(k, i) {
    var pct      = Math.round((k.adet / maxAdet) * 100);
    var rankBg   = i < 3 ? rankColors[i] : '#1565C0';
    var barColor = i === 0 ? '#F9A825' : i === 1 ? '#78909C' : i === 2 ? '#CD7F32' : '#42A5F5';
    return '<div style="background:#fff;border:1px solid #DDEEFF;border-radius:9px;padding:10px 12px;position:relative;overflow:hidden;transition:box-shadow .15s;cursor:default;" '
      + 'onmouseover="this.style.boxShadow=\'0 4px 16px rgba(21,101,192,.15)\'" onmouseout="this.style.boxShadow=\'none\'">'
      + '<div style="position:absolute;top:8px;right:9px;width:18px;height:18px;border-radius:5px;background:' + rankBg + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;letter-spacing:-.3px;">' + (i + 1) + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:#0B1F3A;margin-bottom:5px;padding-right:22px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + k.ad + '">' + k.ad + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:4px;margin-bottom:3px;">'
      +   '<div style="font-size:17px;font-weight:800;color:#1565C0;font-family:\'DM Mono\',monospace;line-height:1;">' + formatTR(k.adet) + '</div>'
      +   '<div style="font-size:9px;font-weight:600;color:#8AAAC8;text-transform:uppercase;letter-spacing:.5px;">Adet</div>'
      + '</div>'
      + '<div style="font-size:9px;color:#8AAAC8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px;">' + k.kayit + ' kayıt</div>'
      + '<div style="height:3px;background:#EEF7FF;border-radius:2px;overflow:hidden;">'
      +   '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px;transition:width .6s ease;"></div>'
      + '</div>'
      + '</div>';
  }).join('');

  // Butonu gizle: 8'den az klasman varsa toggle'a gerek yok
  var btn = document.getElementById('ao-top20-toggle-btn');
  if (btn) btn.style.display = _aoTop20Liste.length <= 8 ? 'none' : 'flex';
}

function _aoRenderTop20() {
  var klasmanMap = {};
  _aoData.forEach(function(k) {
    var ad = k.klasman || '—';
    if (!klasmanMap[ad]) klasmanMap[ad] = { adet: 0, kayit: 0 };
    klasmanMap[ad].adet  += k.adet || 0;
    klasmanMap[ad].kayit += 1;
  });
  _aoTop20Liste = Object.keys(klasmanMap).map(function(ad) {
    return { ad: ad, adet: klasmanMap[ad].adet, kayit: klasmanMap[ad].kayit };
  }).sort(function(a, b) { return b.adet - a.adet; }).slice(0, 20);

  // Yeni veri geldiğinde daraltılmış başlat
  _aoTop20Expanded = false;
  var icon  = document.getElementById('ao-top20-toggle-icon');
  var label = document.getElementById('ao-top20-toggle-label');
  if (icon)  icon.textContent  = '▼';
  if (label) label.textContent = 'Tümünü Görüntüle';

  _aoRenderTop20Grid();
}

// ── Yardımcı: Süre Format ──
function _aoFmtSn(sn) {
  if (!sn || sn <= 0) return '--';
  var s = Math.round(sn), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60;
  return h > 0 ? h+'s '+String(m).padStart(2,'0')+'d' : m > 0 ? m+'d '+String(sc).padStart(2,'0')+'sn' : sc+'sn';
}
function _aoFmtTarih(d) {
  if (!d) return '--';
  var dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return '--';
  return dt.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit'}) + ' ' + dt.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
}
function _aoPerfClass(p) { return p >= 100 ? '#00897B' : p >= 80 ? '#1565C0' : p >= 60 ? '#F57F17' : '#C62828'; }

// ── Filtre & Tablo ──
function aoApplyFilters() {
  var kf = document.getElementById('ao-f-klasman').value;
  var tf = document.getElementById('ao-f-tarih').value;
  var mf = parseInt(document.getElementById('ao-f-minadet').value) || 0;
  var sf = document.getElementById('ao-f-sort').value;

  var list = _aoData.filter(function(k) {
    if (kf && k.klasman !== kf) return false;
    if (mf > 0 && k.adet < mf) return false;
    if (tf === 'withdate' && !k.tarihGecerli) return false;
    if (tf === 'nodate'   &&  k.tarihGecerli) return false;
    return true;
  });

  if (sf === 'adet-desc') list.sort(function(a,b){ return b.adet - a.adet; });
  else if (sf === 'adet-asc')  list.sort(function(a,b){ return a.adet - b.adet; });
  else if (sf === 'ort-desc')  list.sort(function(a,b){ return (b.ortalamaKontrolSn||0)-(a.ortalamaKontrolSn||0); });
  else if (sf === 'tarih-asc') list.sort(function(a,b){ return new Date(a.baslangic||0)-new Date(b.baslangic||0); });

  var fAdet = list.reduce(function(s,k){ return s+k.adet; }, 0);
  var fStd  = list.reduce(function(s,k){ return s+(k.standartSureHam != null ? k.standartSureHam : k.standartSure); }, 0);
  document.getElementById('ao-f-summary').textContent = list.length + ' ' + (translations[currentLang]||translations.tr).records_summary + fAdet + ' ' + (translations[currentLang]||translations.tr).units_summary + _aoFmtSn(fStd);

  // Gruplama
  var gruplar = {};
  list.forEach(function(k){ if (!gruplar[k.klasman]) gruplar[k.klasman] = []; gruplar[k.klasman].push(k); });

  var html = '', idx = 0;
  Object.keys(gruplar).forEach(function(kAd) {
    var kayitlar = gruplar[kAd];
    var gAdet  = kayitlar.reduce(function(s,k){ return s+k.adet; }, 0);
    var gStd   = kayitlar.reduce(function(s,k){ return s+(k.standartSureHam != null ? k.standartSureHam : k.standartSure); }, 0);
    var gFiili = kayitlar.reduce(function(s,k){ return s+k.kayitFiiliSure; }, 0);
    var gOrt   = gAdet > 0 && gFiili > 0 ? Math.round(gFiili / gAdet) : null;

    html += '<tr style="background:#0B1F3A;color:#fff;"><td colspan="12" style="padding:8px 14px;font-size:12px;font-weight:700;">'
      + '📦 ' + kAd + ' <span style="font-weight:400;opacity:.7;font-size:11px;">'
      + kayitlar.length + ' ' + (translations[currentLang]||translations.tr).records_word + ' · ' + gAdet + ' ' + (translations[currentLang]||translations.tr).units_short + ' · ' + _aoFmtSn(gStd)
      + (gFiili > 0 ? ' · ' + _aoFmtSn(gFiili) + ' gerçekleşen' : '')
      + (gOrt ? ' · <strong style="color:#FFD700">ort. ' + gOrt + 'sn/adet</strong>' : '')
      + '</span></td></tr>';

    kayitlar.forEach(function(k, i) {
      idx++;
      var oran    = k.kayitFiiliSure && k.standartSure ? Math.round((k.standartSure / k.kayitFiiliSure) * 100) : null;
      // Gerçekleşen süre ≤ 10dk (600sn) ise oran maksimum %100 (genel performansı
      // yapay şişiren aşırı yüksek oranlar gösterilmez — hesaplama sistemi değişmez,
      // sadece gösterim tavanlanır; standartSure zaten kaynak tarafında aynı kuralla
      // tavanlanmış olduğundan burada zaten ~100 çıkar, bu satır ek güvenlik amaçlıdır)
      if (oran !== null && k.kayitFiiliSure <= 600 && k.kayitFiiliSure < k.standartSure) oran = Math.min(oran, 100);
      // 15 adet ve altında gerçekleşen < standart ise oran maksimum %100
      if (oran !== null && k.adet <= 15 && k.kayitFiiliSure < k.standartSure) oran = Math.min(oran, 100);
      var ortSn   = k.ortalamaKontrolSn;
      var ortColor = ortSn === null ? '#5A7FA8' : (k.kontrolAdetSuresi <= 0 || ortSn <= k.kontrolAdetSuresi) ? '#00897B' : ortSn <= k.kontrolAdetSuresi * 1.2 ? '#F57F17' : '#C62828';
      var bg = i % 2 === 0 ? '#F9FBFF' : '#fff';
      html += '<tr style="background:' + bg + ';">'
        + '<td style="color:#5A7FA8;font-family:monospace;text-align:center;">' + idx + '</td>'
        + '<td style="font-size:11px;color:#5A7FA8;font-family:monospace;text-align:center;">' + (k.talepNo || '—') + '</td>'
        + '<td style="font-weight:600;color:#0B1F3A;">' + k.klasman + '</td>'
        + '<td style="font-weight:700;font-size:14px;text-align:center;">' + k.adet + '</td>'
        + '<td style="color:#1565C0;font-family:monospace;text-align:center;">' + k.kontrolAdetSuresi + 'sn</td>'
        + '<td style="text-align:right;font-family:monospace;"><span style="color:#1565C0;">' + _aoFmtSn(k.standartSureHam != null ? k.standartSureHam : k.standartSure) + '</span>'
          + ((k.standartSureHam != null && Math.round(k.standartSureHam) !== Math.round(k.standartSure))
              ? '<div style="font-size:10px;color:#E65100;font-weight:600;">⚠ kısa kayıt tavanı: ' + _aoFmtSn(k.standartSure) + '</div>'
              : '') + '</td>'
        + '<td style="font-family:monospace;color:' + (k.kayitFiiliSure > 0 ? '#00897B' : '#5A7FA8') + ';text-align:right;">' + (k.kayitFiiliSure > 0 ? _aoFmtSn(k.kayitFiiliSure) : (k.tarihGecerli ? _aoFmtSn(0) : '—')) + '</td>'
        + '<td style="font-family:monospace;font-weight:700;color:' + ortColor + ';text-align:center;">'
          + (ortSn !== null ? ortSn + 'sn<div style="font-size:9px;font-weight:400;">' + (k.kontrolAdetSuresi <= 0 ? '✓ kayıt var' : ortSn <= k.kontrolAdetSuresi ? '✓ hedef' : '↑ hedefin üstü') + '</div>' : (k.tarihGecerli === false ? '—<div style="font-size:9px;color:#5A7FA8;">tarih yok</div>' : '—<div style="font-size:9px;color:#5A7FA8;">süre hesaplanamadı</div>'))
          + '</td>'
        + '<td style="font-size:11px;color:#5A7FA8;text-align:center;">' + (k.tarihGecerli && k.baslangic ? _aoFmtTarih(k.baslangic) : '—') + '</td>'
        + '<td style="font-size:11px;color:#5A7FA8;text-align:center;">' + (k.tarihGecerli && k.bitis ? _aoFmtTarih(k.bitis) : '—') + '</td>'
        + '<td style="font-family:monospace;font-weight:700;text-align:center;">'
          + (oran !== null ? '<span style="color:' + _aoPerfClass(oran) + ';">' + oran + '%</span><div style="font-size:9px;font-weight:400;color:' + _aoPerfClass(oran) + ';">' + (oran >= 100 ? '✓ ' + (translations[currentLang]||translations.tr).on_target : '↓ ' + (translations[currentLang]||translations.tr).below_target) + '</div>' : '<span style="color:#5A7FA8;">—</span>')
          + '</td>'
        + '<td style="font-size:9px;color:' + (k.is2Kalite ? '#7C3AED;font-weight:700;' : '#A9BBD0;') + 'text-align:center;white-space:nowrap;">' + (k.inspectionTipi ? (k.is2Kalite ? '🏷️ ' : '') + k.inspectionTipi : '—') + '</td>'
        + '</tr>';
    });
  });

  var _noRec = (translations[currentLang]||translations.tr).no_records_found;
  document.getElementById('ao-tablo-body').innerHTML = html || '<tr><td colspan="12" style="padding:24px;text-align:center;color:#5A7FA8;">' + _noRec + '</td></tr>';
}

function aoResetFilters() {
  document.getElementById('ao-f-klasman').value = '';
  document.getElementById('ao-f-tarih').value   = '';
  document.getElementById('ao-f-minadet').value = 0;
  document.getElementById('ao-f-sort').value    = '';
  aoApplyFilters();
}

// ── Gemini Toggle ──
function aoGeminiToggle() {
  var panel   = document.getElementById('ao-gemini-panel');
  var isOpen  = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  document.getElementById('ao-gemini-chevron').style.transform = isOpen ? '' : 'rotate(90deg)';
  document.getElementById('ao-gemini-badge').textContent       = isOpen ? (translations[currentLang]||translations.tr).closed_label : (translations[currentLang]||translations.tr).open_label;
  document.getElementById('ao-gemini-bar').style.borderRadius  = isOpen ? '12px' : '12px 12px 0 0';
}

// ── Gemini API Key ──
function aoGkeyToggleEye() {
  var inp = document.getElementById('ao-gkey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}
function aoGkeySave() {
  var val = document.getElementById('ao-gkey').value.trim();
  if (!val) { aoSetKeyStatus((translations[currentLang]||translations.tr).gkey_empty, '#E65100'); return; }
  if (val.length < 10) { aoSetKeyStatus((translations[currentLang]||translations.tr).gkey_invalid, '#E65100'); return; }
  try {
    localStorage.setItem(AO_LS_KEY, val);
    aoSetKeyStatus((translations[currentLang]||translations.tr).gkey_saving, '#00897B');
    // Sheets'e de push et — diğer bilgisayarlar pull'da otomatik alacak
    pushConfigToSheets().then(function() {
      aoSetKeyStatus((translations[currentLang]||translations.tr).gkey_saved_sheets, '#00897B');
    }).catch(function() {
      aoSetKeyStatus((translations[currentLang]||translations.tr).gkey_saved_local, '#F57F17');
    });
  }
  catch(e) { aoSetKeyStatus((translations[currentLang]||translations.tr).gkey_save_fail + e.message, '#C62828'); }
}
function aoGkeyDelete() {
  try { localStorage.removeItem(AO_LS_KEY); } catch(e) {}
  document.getElementById('ao-gkey').value = '';
  aoSetKeyStatus((translations[currentLang]||translations.tr).gkey_deleted, '#5A7FA8');
  pushConfigToSheets().catch(function(){});
}
function aoSetKeyStatus(msg, color) {
  var el = document.getElementById('ao-gkey-status');
  el.textContent = msg; el.style.color = color;
  setTimeout(function(){ if (el.textContent === msg) el.textContent = ''; }, 4000);
}

// ── Gemini Hızlı Butonlar ──
function _getAoQPrompts() {
  var t = translations[currentLang]||translations.tr;
  return {
    genel:   t.currentLang === 'en'
      ? 'Evaluate this employee\'s overall performance. Identify strengths, weaknesses, and notable points.'
      : 'Bu çalışanın genel performansını değerlendir. Güçlü yönleri, zayıf yönleri ve dikkat çeken noktaları belirt.',
    guclu:   currentLang === 'en'
      ? 'Analyze this employee\'s strengths and weaknesses. In which classifications do they perform well, and where do they fall short?'
      : 'Bu çalışanın güçlü ve zayıf yönlerini analiz et. Hangi klasmanlarda iyi, hangilerinde daha düşük performans gösteriyor?',
    trend:   currentLang === 'en'
      ? 'Perform a time-based analysis. Is there a performance trend based on record dates? How is overtime usage?'
      : 'Zaman bazlı bir analiz yap. Kayıt tarihlerine göre performans eğilimi var mı? Mesai kullanımı nasıl?',
    klasman: currentLang === 'en'
      ? 'Perform a comparative analysis by classification. Which classifications meet standard duration, and which exceed the target?'
      : 'Klasman bazında karşılaştırmalı analiz yap. Hangi klasmanlarda standart süreye uyuluyor, hangilerinde hedefin üstüne çıkılıyor?',
    oneri:   currentLang === 'en'
      ? 'Provide concrete improvement suggestions for this employee. Which areas should they focus on?'
      : 'Bu çalışan için somut iyileştirme önerileri sun. Hangi alanlara odaklanması gerekiyor?',
    mesai:   t.ai_overtime_prompt
  };
}
function _getAoQTitles() {
  var t = translations[currentLang]||translations.tr;
  return {
    genel:   t.ai_general,
    guclu:   t.ai_strengths,
    trend:   currentLang === 'en' ? '📈 Trend Analysis' : '📈 Trend Analizi',
    klasman: t.ai_klasman_compare,
    oneri:   t.ai_improve,
    mesai:   t.ai_overtime
  };
}

function aoCallGeminiQuick(tip) {
  aoCallGemini(_getAoQPrompts()[tip], _getAoQTitles()[tip]);
}
function aoCallGeminiCustom() {
  var q = document.getElementById('ao-gcustom').value.trim();
  if (!q) { alert((translations[currentLang]||translations.tr).gkey_ask_question); return; }
  document.getElementById('ao-gcustom').value = '';
  aoCallGemini(q, (translations[currentLang]||translations.tr).custom_analysis);
}
function aoClearResult() {
  document.getElementById('ao-gresult').style.display = 'none';
  document.getElementById('ao-goutput').textContent = '';
}

function _aoDataSummary() {
  if (!_aoData.length || !_aoInspector) return 'Veri yok.';
  var totalAdet  = _aoData.reduce(function(s,k){ return s+k.adet; }, 0);
  var totalStd   = _aoData.reduce(function(s,k){ return s+k.standartSure; }, 0);
  var totalFiili = _aoData.reduce(function(s,k){ return s+k.kayitFiiliSure; }, 0);
  var _stdSn = _aoInspector.standartSure || 0;
  var _mesSn = _aoInspector.mesaiSure || 0;
  var _kzSn = (typeof getNotrKayipDakikaForInspector === 'function') ? getNotrKayipDakikaForInspector(_aoInspector.ins) * 60 : 0;
  if (_kzSn > 0 && _mesSn > _kzSn) _mesSn -= _kzSn;
  var _hamP = (_stdSn > 0 && _mesSn > 0) ? Math.round((_stdSn / _mesSn) * 100) : (_aoInspector.genelHizPerf || 0);
  var duzPerf    = Math.round(_hamP * (100 / _aoHedef));
  var mesaiDk    = Math.round((_aoInspector.toplamMesaistiSaniye||0) / 60);
  var gruplar = {};
  _aoData.forEach(function(k) {
    if (!gruplar[k.klasman]) gruplar[k.klasman] = {adet:0,standartSure:0,kayitFiiliSure:0,count:0,ortSums:[]};
    gruplar[k.klasman].adet += k.adet;
    gruplar[k.klasman].standartSure += k.standartSure;
    gruplar[k.klasman].kayitFiiliSure += k.kayitFiiliSure;
    gruplar[k.klasman].count++;
    if (k.ortalamaKontrolSn) gruplar[k.klasman].ortSums.push(k.ortalamaKontrolSn);
  });
  var kLines = '';
  Object.keys(gruplar).forEach(function(k) {
    var v = gruplar[k];
    var oran = v.kayitFiiliSure > 0 ? Math.round((v.standartSure/v.kayitFiiliSure)*100) : null;
    var ortSn = v.ortSums.length > 0 ? Math.round(v.ortSums.reduce(function(a,b){return a+b;},0)/v.ortSums.length) : null;
    kLines += '  - '+k+': '+v.adet+' '+(translations[currentLang]||translations.tr).units_short+', '+v.count+' '+(translations[currentLang]||translations.tr).records_word+', std: '+_aoFmtSn(v.standartSure)
      +', gerçekleşen '+_aoFmtSn(v.kayitFiiliSure)
      +(oran ? ' oran:'+oran+'%' : '')+(ortSn ? ' ort.kontrol:'+ortSn+'sn/adet' : '')+'\n';
  });
  return 'Çalışan: '+_aoInspector.ins+'\n'
    +'Toplam Adet: '+totalAdet+'\n'
    +'Standart Süre: '+_aoFmtSn(totalStd)+'\n'
    +'Gerçekleşen Süre: '+(totalFiili>0?_aoFmtSn(totalFiili):'Veri yok')+'\n'
    +'Mesai Süresi: '+_aoFmtSn(_aoInspector.mesaiSure||0)+(mesaiDk>0?' (Mesai üstü: '+mesaiDk+'dk)':'')+'\n'
    +'Düzeltilmiş Performans: '+duzPerf+'% (Hedef: '+_aoHedef+'%)\n'
    +'Ham Hız Performansı: '+Math.round(_hamP)+'%\n\n'
    +'Klasman Bazlı Özet:\n'+kLines
    +'Toplam Klasman Sayısı: '+Object.keys(gruplar).length+'\n'
    +'Tarihli Kayıt: '+_aoData.filter(function(k){return k.tarihGecerli;}).length+'\n'
    +'Tarihi Olmayan: '+_aoData.filter(function(k){return !k.tarihGecerli;}).length;
}

function aoCallGemini(userPrompt, title) {
  var key = '';
  try { key = localStorage.getItem(AO_LS_KEY) || ''; } catch(e) {}
  if (!key) key = (document.getElementById('ao-gkey').value || '').trim();
  if (!key) { aoShowErr((translations[currentLang]||translations.tr).gkey_no_key); return; }

  var fullPrompt = 'Sen bir üretim performans analisti asistanısın. Aşağıdaki inspection/kalite kontrol çalışanına ait performans verileri sana verilmiştir. Bu verileri analiz et ve kullanıcının sorusuna yanıt ver.\n\n'
    + 'PERFORMANS VERİLERİ:\n' + _aoDataSummary() + '\n\n'
    + 'KULLANICI SORUSU: ' + userPrompt + '\n\n'
    + 'Yanıt verirken:\n- Somut verilere dayandır\n- Sayısal referanslar ver\n- Türkçe yaz\n- Açık ve anlaşılır ol\n- Varsa kritik bulgular için uyarı ver';

  // Panel açık değilse aç
  var panel = document.getElementById('ao-gemini-panel');
  if (panel.style.display === 'none') aoGeminiToggle();

  // Loading göster
  document.getElementById('ao-gresult').style.display = 'block';
  document.getElementById('ao-gresult-title').textContent = title || (translations[currentLang]||translations.tr).analyzing;
  document.getElementById('ao-gloading').style.display = 'block';
  document.getElementById('ao-goutput').style.display = 'none';
  document.getElementById('ao-goutput').textContent = '';
  document.getElementById('ao-gerror').style.display = 'none';
  setTimeout(function(){
    var el = document.getElementById('ao-gresult');
    if (el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
  }, 100);

    var modelSel = document.getElementById('ao-gmodel');
  var modelId = (modelSel ? modelSel.value : null) || 'gemini-2.5-flash-preview-05-20';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + encodeURIComponent(key);
  fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      contents: [{parts:[{text: fullPrompt}]}],
      generationConfig: {temperature: 0.7, maxOutputTokens: 8192}

    })
  })
  .then(function(resp) {
    if (!resp.ok) return resp.json().then(function(e){ throw new Error(e && e.error && e.error.message ? e.error.message : 'HTTP ' + resp.status); });
    return resp.json();
  })
  .then(function(data) {
    var text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!text) throw new Error((translations[currentLang]||translations.tr).gkey_empty_response);
    document.getElementById('ao-gloading').style.display = 'none';
    document.getElementById('ao-goutput').style.display = 'block';
    document.getElementById('ao-goutput').textContent = text;
  })
  .catch(function(e) {
    document.getElementById('ao-gloading').style.display = 'none';
    document.getElementById('ao-gresult').style.display = 'none';
    aoShowErr((translations[currentLang]||translations.tr).gkey_api_error + e.message + (e.message.indexOf('API_KEY') > -1 ? (translations[currentLang]||translations.tr).gkey_check_key : ''));
  });
}

function aoShowErr(msg) {
  document.getElementById('ao-gerror').style.display = 'block';
  document.getElementById('ao-gerror-msg').textContent = msg;
}

// Excel export (overlay için)
function exportInspectorDetailFromOverlay() {
  if (typeof exportInspectorDetail === 'function') exportInspectorDetail();
}

// ════════════════════════════════════════════════════════════════════════════════
// ─── PWA — PROGRESSIVE WEB APP ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

// 1) Inline Web App Manifest — Blob URL ile inject (manifest için Blob izinlidir)
(function injectManifest() {
  var pageUrl = window.location.href.split('#')[0].split('?')[0];
  var manifest = {
    name: 'Inspection Performans Paneli',
    short_name: 'Inspection',
    description: 'Inspector performans takip ve analiz paneli',
    start_url: pageUrl,
    scope: pageUrl,
    display: 'standalone',
    orientation: 'landscape-primary',
    background_color: '#0B1F3A',
    theme_color: '#0B1F3A',
    lang: 'tr',
    icons: [
      { src: _pwaIcon(192), sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: _pwaIcon(512), sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  };
  try {
    var blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    var url  = URL.createObjectURL(blob);
    var link = document.getElementById('pwa-manifest-link');
    if (link) link.href = url;
  } catch(e) { console.warn('[PWA] manifest inject failed:', e); }
})();

// PNG icon — canvas ile çiz (SVG data URI yerine gerçek PNG — Chrome bunu kabul eder)
function _pwaIcon(size) {
  try {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var r = size * 0.2;
    // Arka plan
    ctx.fillStyle = '#0B1F3A';
    _roundRect(ctx, 0, 0, size, size, r); ctx.fill();
    // İç mavi kare
    ctx.fillStyle = '#1565C0';
    _roundRect(ctx, size*.07, size*.07, size*.86, size*.86, r*.7); ctx.fill();
    // Metin
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.round(size*.38) + 'px Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LC', size/2, size/2 + size*.03);
    return c.toDataURL('image/png');
  } catch(e) { return ''; }
}
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y, x+w,y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h, x+w-r,y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h, x,y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x,y, x+r,y, r);
  ctx.closePath();
}

// 2) Service Worker — aynı origin'den kayıt zorunlu
//    GitHub Pages'te sw.js ayrı dosya olmadığından, HTML sayfasının içine
//    gömülü script'i ServiceWorker olarak kaydetmek için
//    'importScripts trick' veya inline blob kullanılamaz (Chrome güvenliği).
//    Çözüm: SW kodunu data: URI ile kayıt → Chrome 91+ destekler.
(function registerSW() {
  if (!('serviceWorker' in navigator)) { console.warn('[PWA] SW not supported'); return; }
  var pageScope = window.location.pathname.replace(/[^/]*$/, '') || '/';
  var swCode = [
    "const V='ip-v2';",
    "const URL='" + window.location.href.split('?')[0] + "';",
    "self.addEventListener('install',e=>{",
    "  e.waitUntil(caches.open(V).then(c=>c.add(URL)).then(()=>self.skipWaiting()));",
    "});",
    "self.addEventListener('activate',e=>{",
    "  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));",
    "});",
    "self.addEventListener('fetch',e=>{",
    "  if(e.request.method!=='GET')return;",
    "  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{",
    "    if(r&&r.ok&&r.type==='basic'){const cl=r.clone();caches.open(V).then(cache=>cache.put(e.request,cl));}",
    "    return r;",
    "  })));",
    "});"
  ].join('\n');

  // Önce: same-origin script çalışıyor mu? (GitHub Pages'te panel.html ile aynı dizin)
  // SW kayıt için: önce navigator.serviceWorker.register normal URL dene,
  // olmadığında Blob ile dene (Firefox, Android destekler)
  function tryBlobSW() {
    try {
      var blob = new Blob([swCode], { type: 'text/javascript' });
      var blobUrl = URL.createObjectURL(blob);
      // Chrome Blob SW'yi reddeder ama Firefox/Edge (bazı sürümler) kabul eder
      navigator.serviceWorker.register(blobUrl, { scope: pageScope })
        .then(function(reg) { console.log('[PWA] SW via blob OK, scope:', reg.scope); })
        .catch(function(e)  { console.warn('[PWA] SW blob rejected:', e.message); });
    } catch(e) { console.warn('[PWA] SW blob failed:', e); }
  }

  // sw.js aynı dizinde var mı? (GitHub Pages'te el ile eklenirse)
  var swPath = pageScope + 'sw.js';
  navigator.serviceWorker.register(swPath, { scope: pageScope })
    .then(function(reg) { console.log('[PWA] SW from sw.js OK:', reg.scope); })
    .catch(function()   { tryBlobSW(); });
})();

// 3) Install Prompt
var _pwaInstallPrompt = null;
var _pwaInstallable   = false;

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _pwaInstallPrompt = e;
  _pwaInstallable   = true;
  _pwaShowBtn();
  console.log('[PWA] beforeinstallprompt fired ✅');
});

window.addEventListener('appinstalled', function() {
  _pwaInstallPrompt = null;
  _pwaInstallable   = false;
  _pwaHideBtn();
  var t = translations[currentLang] || translations.tr;
  try { showSuccessMessage(t.pwa_installed || '✅ Uygulama yüklendi!'); } catch(e) {}
});

// Sayfa yüklenince: zaten yüklü mü kontrol et
window.addEventListener('load', function() {
  // standalone modda açıldıysa zaten yüklü — butonu gösterme
  if (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true) {
    _pwaHideBtn();
    console.log('[PWA] Running as installed app');
    return;
  }
  // Yüklü değil — butonu HER ZAMAN göster (beforeinstallprompt gelmese bile)
  // 2 saniye bekle, prompt gelmediyse yine de butonu göster
  setTimeout(function() {
    if (!_pwaInstallable) {
      // Prompt gelmedi ama tarayıcı destekliyor olabilir; butonu göster
      // tıklandığında adres çubuğu ikonuna yönlendiririz
      _pwaShowBtn();
      console.log('[PWA] Showing install btn (no prompt yet — may appear later)');
    }
  }, 1500);
});

function _pwaShowBtn() {
  var btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'inline-flex';
  var loginRow = document.getElementById('pwa-install-login-row');
  if (loginRow) loginRow.style.display = 'block';
}
function _pwaHideBtn() {
  var btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'none';
  var loginRow = document.getElementById('pwa-install-login-row');
  if (loginRow) loginRow.style.display = 'none';
}

function pwaTriggerInstall() {
  if (_pwaInstallPrompt) {
    // Tarayıcının native install dialogu
    var btn = document.getElementById('pwa-install-btn');
    if (btn) { btn.innerHTML = '⏳'; btn.disabled = true; }
    _pwaInstallPrompt.prompt();
    _pwaInstallPrompt.userChoice.then(function(choice) {
      if (choice.outcome !== 'accepted') {
        if (btn) {
          var t = translations[currentLang] || translations.tr;
          btn.innerHTML = '⬇️ <span>' + (t.pwa_install || 'Uygulamayı Yükle') + '</span>';
          btn.disabled = false;
        }
      }
      _pwaInstallPrompt = null;
    });
  } else {
    // Prompt yok — tarayıcıya göre talimat ver
    var isEdge    = /Edg\//.test(navigator.userAgent);
    var isChrome  = /Chrome\//.test(navigator.userAgent) && !isEdge;
    var isSafari  = /Safari\//.test(navigator.userAgent) && !isChrome && !isEdge;
    var isMobile  = /Android|iPhone|iPad/.test(navigator.userAgent);
    var t = translations[currentLang] || translations.tr;
    var msg;
    if (currentLang === 'en') {
      if (isMobile && isSafari)
        msg = '📱 To install on iPhone/iPad:\n1. Tap the Share button (□↑)\n2. Select "Add to Home Screen"\n3. Tap "Add"';
      else if (isMobile)
        msg = '📱 To install on Android:\n1. Tap the browser menu (⋮)\n2. Select "Add to Home Screen" or "Install App"';
      else if (isEdge)
        msg = '💻 To install in Edge:\n1. Look for the ⊕ icon in the address bar (right side)\n2. Or go to Menu (…) → Apps → Install this site as an app';
      else
        msg = '💻 To install in Chrome:\n1. Look for the ⊕ icon in the address bar (right side)\n2. Or go to Menu (⋮) → Save and share → Install page as app';
    } else {
      if (isMobile && isSafari)
        msg = '📱 iPhone/iPad\'a yüklemek için:\n1. Paylaş butonuna (□↑) dokunun\n2. "Ana Ekrana Ekle"yi seçin\n3. "Ekle"ye dokunun';
      else if (isMobile)
        msg = '📱 Android\'e yüklemek için:\n1. Tarayıcı menüsüne (⋮) dokunun\n2. "Ana Ekrana Ekle" veya "Uygulama Yükle"yi seçin';
      else if (isEdge)
        msg = '💻 Edge\'e yüklemek için:\n1. Adres çubuğunun sağındaki ⊕ ikonunu arayın\n2. Veya Menü (…) → Uygulamalar → Bu siteyi uygulama olarak yükle';
      else
        msg = '💻 Chrome\'a yüklemek için:\n1. Adres çubuğunun sağındaki ⊕ ikonunu arayın\n2. Veya Menü (⋮) → Kaydet ve paylaş → Sayfayı uygulama olarak yükle';
    }
    // Güzel bir modal göster
    _pwaShowInstallGuide(msg);
  }
}

// Install rehberi modal
function _pwaShowInstallGuide(msg) {
  var existing = document.getElementById('pwa-guide-modal');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'pwa-guide-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(11,31,58,.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:fadeIn .2s ease';
  var t = translations[currentLang] || translations.tr;
  var lines = msg.split('\n').map(function(l) {
    return l ? '<div style="padding:3px 0;' + (l.startsWith('1.')||l.startsWith('2.')||l.startsWith('3.') ? 'padding-left:8px;' : 'font-weight:700;font-size:14px;margin-bottom:4px;') + '">' + l + '</div>' : '<div style="height:4px"></div>';
  }).join('');
  overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(11,31,58,.35);text-align:left;font-family:DM Sans,sans-serif;animation:popIn .2s ease">'
    + '<div style="font-size:18px;font-weight:700;color:#0B1F3A;margin-bottom:14px">⬇️ ' + (t.pwa_install_full || 'Uygulamayı Yükle') + '</div>'
    + '<div style="font-size:13px;color:#0D1B2E;line-height:1.7;background:#EEF7FF;border-radius:10px;padding:14px 16px;border:1px solid #CFE3F7">' + lines + '</div>'
    + '<div style="margin-top:16px;text-align:right"><button onclick="document.getElementById(\'pwa-guide-modal\').remove()" style="padding:9px 22px;background:#1565C0;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">Tamam</button></div>'
    + '</div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ─── END PWA ─────────────────────────────────────────────────────────────────
  function toggleOtPopup() {
  var card    = document.getElementById('ot-popup-card');
  var chevron = document.getElementById('ot-popup-chevron');
  var isOpen  = card.style.display !== 'none';

  if (isOpen) {
    card.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
    return;
  }

  // Veriyi hesapla
  var insp = selectedInspectorDetail;
  if (!insp) { card.style.display = 'block'; return; }

  var otSn    = insp.toplamMesaistiSaniye || 0;
  var mesaiSn = insp.mesaiSure || 0;
  var stdSn   = insp.standartSure || 0;
  var totalAdet = insp.adet || 0;

  // OT süresini formatla
  function fmtSn(sn) {
    if (!sn || sn <= 0) return '--';
    var s = Math.round(sn), h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    return h > 0 ? h+'s '+String(m).padStart(2,'0')+'d' : m+'d';
  }

  // OT'de kontrol edilen adet (OT oranı × toplam adet)
  var otOran  = mesaiSn > 0 ? otSn / mesaiSn : 0;
  var otAdet  = Math.round(totalAdet * otOran);
  var otAdetPct = mesaiSn > 0 ? Math.round(otOran * 100) : 0;

  // Verimlilik = standart / mesai × 100
  var verim = mesaiSn > 0 ? Math.round((stdSn / mesaiSn) * 100) : 0;
  var otDk  = Math.round(otSn / 60);

  document.getElementById('ot-sure-val').textContent   = fmtSn(otSn);
  document.getElementById('ot-sure-badge').textContent  = otDk > 0 ? '+' + otDk + ' dk' : '—';
  document.getElementById('ot-adet-val').textContent   = otAdet > 0 ? formatTR(otAdet) + ' adet' : '—';
  document.getElementById('ot-adet-badge').textContent  = otAdetPct > 0 ? '%' + otAdetPct : '—';
  document.getElementById('ot-verim-val').textContent  = verim > 0 ? '%' + verim : '—';
  document.getElementById('ot-label-mesai').textContent = 'Mesai: ' + fmtSn(mesaiSn);
  document.getElementById('ot-label-std').textContent   = 'Standart: ' + fmtSn(stdSn);

  // Bar animasyonu
  var barEl = document.getElementById('ot-verim-bar');
  barEl.style.width = '0';
  setTimeout(function() { barEl.style.width = Math.min(verim, 100) + '%'; }, 50);

  card.style.display = 'block';
  chevron.style.transform = 'rotate(90deg)';

  // Dışarı tıklayınca kapat
  setTimeout(function() {
    document.addEventListener('click', function closeOt(e) {
      if (!document.getElementById('ot-popup-card').contains(e.target) &&
          !document.getElementById('ot-popup-btn').contains(e.target)) {
        card.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        document.removeEventListener('click', closeOt);
      }
    });
  }, 10);
}
function toggleGunlukPopup() {
  var card    = document.getElementById('gunluk-popup-card');
  var chevron = document.getElementById('gunluk-popup-chevron');
  var isOpen  = card.style.display !== 'none';

  if (isOpen) {
    card.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
    return;
  }

  _renderGunlukTablo();
  card.style.display = 'block';
  chevron.style.transform = 'rotate(90deg)';

  setTimeout(function() {
    document.addEventListener('click', function closeGunluk(e) {
      if (!document.getElementById('gunluk-popup-card').contains(e.target) &&
          !document.getElementById('gunluk-popup-btn').contains(e.target)) {
        card.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        document.removeEventListener('click', closeGunluk);
      }
    });
  }, 10);
}

function _renderGunlukTablo() {
  var tbody = document.getElementById('gunluk-tablo-body');
  var gunSayisiEl = document.getElementById('gunluk-gun-sayisi');

  if (!_aoInspector || !_aoData.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af;">Veri yok</td></tr>';
    if (gunSayisiEl) gunSayisiEl.textContent = '0 gün';
    return;
  }

  var gunMap = {};

  function winOverlapSn(bas, bit, h1, m1, h2, m2, gunBase) {
    var wB = new Date(gunBase); wB.setHours(h1, m1, 0, 0);
    var wE = new Date(gunBase); wE.setHours(h2, m2, 0, 0);
    var s = Math.max(bas.getTime(), wB.getTime());
    var e = Math.min(bit.getTime(), wE.getTime());
    return Math.max(0, (e - s) / 1000);
  }

  _aoData.forEach(function(k) {
    if (!k.tarihGecerli || !k.baslangic || !k.bitis) return;
    var bas = k.baslangic instanceof Date ? k.baslangic : new Date(k.baslangic);
    var bit = k.bitis instanceof Date ? k.bitis : new Date(k.bitis);
    if (isNaN(bas.getTime()) || isNaN(bit.getTime())) return;

    var gunStr  = bas.toDateString();
    var gunBase = new Date(gunStr);

    var normalSn = winOverlapSn(bas, bit, 8, 0, 16, 30, gunBase);
    var otSn     = winOverlapSn(bas, bit, 16, 30, 20, 0, gunBase);
    var totalSn  = normalSn + otSn;

    if (!gunMap[gunStr]) {
      gunMap[gunStr] = { tarih: gunBase, toplamAdet: 0, normalAdet: 0, otAdet: 0, otSureDk: 0 };
    }

    var g = gunMap[gunStr];
    g.toplamAdet += k.adet || 0;

    if (totalSn > 0) {
      g.normalAdet += (k.adet || 0) * (normalSn / totalSn);
      g.otAdet     += (k.adet || 0) * (otSn / totalSn);
    } else {
      g.normalAdet += k.adet || 0;
    }
  });

  var otDetay = (_aoInspector.gunlukOvertimeDetay || {});
  Object.keys(otDetay).forEach(function(gunStr) {
    if (gunMap[gunStr]) {
      gunMap[gunStr].otSureDk = otDetay[gunStr];
    } else {
      gunMap[gunStr] = { tarih: new Date(gunStr), toplamAdet: 0, normalAdet: 0, otAdet: 0, otSureDk: otDetay[gunStr] };
    }
  });

  var gunler = Object.values(gunMap).sort(function(a, b) { return a.tarih - b.tarih; });

  if (!gunler.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af;">Veri yok</td></tr>';
    if (gunSayisiEl) gunSayisiEl.textContent = '0 gün';
    return;
  }

  if (gunSayisiEl) gunSayisiEl.textContent = gunler.length + ' gün çalışıldı';

  function fmtSaat(dk) {
    if (!dk) return '—';
    var h = Math.floor(dk / 60), m = Math.round(dk % 60);
    return h > 0 ? h + 's ' + m + 'd' : m + 'd';
  }

  var rows = gunler.map(function(g) {
    var tarihStr = g.tarih.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' });
    return '<tr style="border-bottom:1px solid #f3f4f6;">'
      + '<td style="padding:8px 10px;font-size:12px;color:#111827;font-weight:500;">' + tarihStr + '</td>'
      + '<td style="padding:8px 10px;text-align:center;font-size:13px;font-weight:600;color:#111827;">' + Math.round(g.toplamAdet) + '</td>'
      + '<td style="padding:8px 10px;text-align:center;font-size:12px;color:#1d4ed8;">' + Math.round(g.normalAdet) + '</td>'
      + '<td style="padding:8px 10px;text-align:center;font-size:12px;color:#D85A30;font-weight:600;">' + Math.round(g.otAdet) + '</td>'
      + '<td style="padding:8px 10px;text-align:center;font-size:12px;color:' + (g.otSureDk > 0 ? '#D85A30' : '#9ca3af') + ';font-weight:' + (g.otSureDk > 0 ? '600' : '400') + ';">' + fmtSaat(g.otSureDk) + '</td>'
      + '</tr>';
  }).join('');

  var tAdet = 0, tNormal = 0, tOt = 0, tOtDk = 0;
  gunler.forEach(function(g) { tAdet += g.toplamAdet; tNormal += g.normalAdet; tOt += g.otAdet; tOtDk += g.otSureDk; });

  rows += '<tr style="background:#f1f5f9;border-top:2px solid #e5e7eb;">'
    + '<td style="padding:8px 10px;font-size:12px;font-weight:700;color:#111827;">TOPLAM</td>'
    + '<td style="padding:8px 10px;text-align:center;font-size:13px;font-weight:700;color:#111827;">' + Math.round(tAdet) + '</td>'
    + '<td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:700;color:#1d4ed8;">' + Math.round(tNormal) + '</td>'
    + '<td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:700;color:#D85A30;">' + Math.round(tOt) + '</td>'
    + '<td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:700;color:#D85A30;">' + fmtSaat(tOtDk) + '</td>'
    + '</tr>';

  tbody.innerHTML = rows;
}
  

// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PDF & MAİL v3 — Türkçe karakter düzeltmeli, dengeli grafik boyutları
// ══════════════════════════════════════════════════════════════════════════════

// jsPDF helvetica Türkçe karakterleri desteklemez — ASCII'ye çevir
function _tr(s) {
  if (!s) return '';
  return String(s)
    .replace(/ş/g,'s').replace(/Ş/g,'S')
    .replace(/ı/g,'i').replace(/İ/g,'I')
    .replace(/ğ/g,'g').replace(/Ğ/g,'G')
    .replace(/ü/g,'u').replace(/Ü/g,'U')
    .replace(/ö/g,'o').replace(/Ö/g,'O')
    .replace(/ç/g,'c').replace(/Ç/g,'C')
    .replace(/â/g,'a').replace(/Â/g,'A')
    .replace(/î/g,'i').replace(/Î/g,'I')
    .replace(/û/g,'u').replace(/Û/g,'U');
}

// PDF guvenli deger yardimcilari
function _n(v){ var n=parseFloat(v); return (isNaN(n)||!isFinite(n)) ? 0 : n; }
function _s(v){ return (v===null||v===undefined) ? '---' : String(v); }

function _aoPdfLoadLib(src, checkFn) {
  return new Promise(function(resolve, reject) {
    if (checkFn()) { resolve(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload  = function() { setTimeout(resolve, 150); };
    s.onerror = function() { reject(new Error('Yuklenemedi: ' + src)); };
    document.head.appendChild(s);
  });
}

async function aoGeneratePdfAndMail() {
  var btn = document.getElementById('ao-pdf-btn');
  if (!_aoInspector) { alert('Once bir inspector secin.'); return; }
  if (!_aoData || !_aoData.length) {
    if (!confirm('Bu inspector icin kayit verisi yuklenmemis.\n"Veri Cek" butonuna tiklayin, sonra PDF olusturun.\n\nYine de devam?')) return;
  }
  if (btn) { btn.innerHTML = '⏳ Hazirlaniyor...'; btn.disabled = true; }

  try {
    await _aoPdfLoadLib('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', function(){ return !!window.Chart; });
    await _aoPdfLoadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',   function(){ return !!(window.jspdf && window.jspdf.jsPDF); });

    // ── Veri ──────────────────────────────────────────────────────────────────
    var insp      = _aoInspector;
    var data      = _aoData || [];
    var hedef     = _aoHedef || 100;
    var _stdSnP = insp.standartSure || 0;
    var _mesSnP = insp.mesaiSure || 0;
    var _kzSnP = (typeof getNotrKayipDakikaForInspector === 'function') ? getNotrKayipDakikaForInspector(insp.ins) * 60 : 0;
    if (_kzSnP > 0 && _mesSnP > _kzSnP) _mesSnP -= _kzSnP;
    var _hamPP = (_stdSnP > 0 && _mesSnP > 0) ? Math.round((_stdSnP / _mesSnP) * 100) : (insp.genelHizPerf || 0);
    var duzPerf   = Math.round(_hamPP * (100/hedef));
    var totalAdet = data.reduce(function(s,k){ return s+(k.adet||0); },0);
    var totalStd  = data.reduce(function(s,k){ return s+(k.standartSure||0); },0);
    var totalFiil = data.reduce(function(s,k){ return s+(k.kayitFiiliSure||0); },0);
    var otDk      = Math.round((insp.toplamMesaistiSaniye||0)/60);
    var normalSn  = Math.max(0,(insp.mesaiSure||0)-(insp.toplamMesaistiSaniye||0));
    var otSn      = insp.toplamMesaistiSaniye||0;
    var now       = new Date();
    var dateStr   = now.toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'});
    var inspName  = _tr((insp.ins||'Inspector').trim())||'Inspector';

    // Klasman top listesi
    var klMap={};
    data.forEach(function(k){ var a=k.klasman||'Diger'; klMap[a]=(klMap[a]||0)+(k.adet||0); });
    var klList=Object.keys(klMap).map(function(a){return{ad:a,adet:klMap[a]};}).sort(function(a,b){return b.adet-a.adet;});
    var top8=klList.slice(0,8);
    var digAdet=klList.slice(8).reduce(function(s,k){return s+k.adet;},0);
    if(digAdet>0) top8.push({ad:'Diger',adet:digAdet});

    // Performans bantları
    var bands=[
      {l:'Mukemmel (>=95%)',c:'#00897B',n:0},{l:'Iyi (85-94%)',c:'#1565C0',n:0},
      {l:'Orta (70-84%)',c:'#F9A825',n:0},{l:'Zayif (50-69%)',c:'#EF5350',n:0},
      {l:'Cok Zayif (<50%)',c:'#B71C1C',n:0}
    ];
    data.forEach(function(k){
      if(!k.standartSure||!k.kayitFiiliSure) return;
      var p=Math.round(k.standartSure/k.kayitFiiliSure*100);
      if(p>=95)bands[0].n++; else if(p>=85)bands[1].n++;
      else if(p>=70)bands[2].n++; else if(p>=50)bands[3].n++; else bands[4].n++;
    });
    var activeBands=bands.filter(function(b){return b.n>0;});

    // ── Grafikler (küçük canvas = temiz PNG) ───────────────────────────────────
    // 140px yeterli -- jsPDF'e 38mm olarak basacağız, o çözünürlükte net görünür
    var CSZ = 140;
    var sandbox=document.createElement('div');
    sandbox.style.cssText='position:fixed;left:-9999px;top:0;background:#fff;';
    document.body.appendChild(sandbox);

    async function makeDoughnut(labels, values, colors) {
      var c=document.createElement('canvas');
      c.width=CSZ; c.height=CSZ; sandbox.appendChild(c);
      var ch=new Chart(c.getContext('2d'),{
        type:'doughnut',
        data:{labels:labels,datasets:[{data:values,backgroundColor:colors,borderWidth:2,borderColor:'#ffffff',hoverOffset:0}]},
        options:{animation:false,responsive:false,cutout:'58%',
          plugins:{legend:{display:false},tooltip:{enabled:false}}}
      });
      await new Promise(function(r){setTimeout(r,200);});
      var png=c.toDataURL('image/png');
      ch.destroy(); sandbox.removeChild(c);
      return png;
    }

    var klColors=['#1565C0','#00897B','#F57F17','#8E24AA','#D84315','#00838F','#558B2F','#6D4C41','#546E7A'];
    var p1=top8.length   ? await makeDoughnut(top8.map(function(k){return k.ad;}),top8.map(function(k){return k.adet;}),klColors.slice(0,top8.length)) : null;
    var p2=activeBands.length ? await makeDoughnut(activeBands.map(function(b){return b.l;}),activeBands.map(function(b){return b.n;}),activeBands.map(function(b){return b.c;})) : null;
    var p3=(normalSn+otSn)>0 ? await makeDoughnut(['Normal','Overtime'],[normalSn,otSn],['#1565C0','#E65100']) : null;
    document.body.removeChild(sandbox);

    // ── PDF ───────────────────────────────────────────────────────────────────
    var jsPDF=window.jspdf.jsPDF;
    var pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    var W=210,H=297,M=14,CW=W-M*2;
    // Guvenli text yazici: null/undefined/number'i stringe cevirir
    var _origText = pdf.text.bind(pdf);
    pdf.text = function(str, x, y, opts) {
      var s = (str===null||str===undefined) ? '' : String(str);
      // jsPDF sadece Latin-1 destekler, non-ASCII temizle
      s = s.replace(/[\u0100-\uFFFF]/g, function(c){
        var map={'\u015f':'s','\u015e':'S','\u0131':'i','\u0130':'I',
                 '\u011f':'g','\u011e':'G','\u00fc':'u','\u00dc':'U',
                 '\u00f6':'o','\u00d6':'O','\u00e7':'c','\u00c7':'C',
                 '\u2014':'--','\u2013':'-','\u2026':'...',
                 '\u2192':'>','\u2190':'<'};
        return map[c]||'';
      });
      if(x!==undefined&&(isNaN(x)||!isFinite(x))) x=0;
      if(y!==undefined&&(isNaN(y)||!isFinite(y))) y=0;
      return _origText(s, _n(x), _n(y), opts);
    };

    // Yardımcılar
    function hex2rgb(h){
      if(!h||h.length<4) return[0,0,0];
      if(h.length===4){h='#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];}
      var rv=parseInt(h.slice(1,3),16),gv=parseInt(h.slice(3,5),16),bv=parseInt(h.slice(5,7),16);
      if(isNaN(rv)||isNaN(gv)||isNaN(bv)) return[0,0,0];
      return[rv,gv,bv];
    }
    function fill(h){var c=hex2rgb(h);pdf.setFillColor(c[0],c[1],c[2]);}
    function stroke(h){var c=hex2rgb(h);pdf.setDrawColor(c[0],c[1],c[2]);}
    function txt(h){var c=hex2rgb(h);pdf.setTextColor(c[0],c[1],c[2]);}
    function pHex(p){return p>=95?'#00897B':p>=85?'#1565C0':p>=70?'#F9A825':p>=50?'#EF5350':'#B71C1C';}
    function pLbl(p){return p>=95?'MUKEMMEL':p>=85?'IYI':p>=70?'ORTA':p>=50?'ZAYIF':'COK ZAYIF';}
    function fmtN(n){return (n||0).toLocaleString('tr-TR');}

    function footer(page,total){
      fill('#0B1F3A'); pdf.rect(0,H-9,W,9,'F');
      fill('#1565C0'); pdf.rect(0,H-9,2,9,'F');
      txt('#90CAF9'); pdf.setFontSize(6.5); pdf.setFont('helvetica','normal');
      pdf.text('KalibRe Inspection Performans | '+_tr(dateStr), M, H-3.5);
      txt('#ffffff'); pdf.setFont('helvetica','bold');
      pdf.text('Sayfa '+page+' / '+total, W-M, H-3.5,{align:'right'});
    }

    // ╔══ SAYFA 1 ══════════════════════════════════════════════════════════════╗
    var y=0;

    // Header gradient efekt (3 şerit)
    fill('#0B1F3A'); pdf.rect(0,0,W,40,'F');
    fill('#1565C0'); pdf.rect(0,34,W,8,'F');
    fill('#1976D2'); pdf.rect(0,39,W,3,'F');

    // LC logo
    fill('#ffffff'); pdf.circle(_n(M+7),14,6.5,'F');
    txt('#0B1F3A'); pdf.setFontSize(8.5); pdf.setFont('helvetica','bold');
    pdf.text('LC',M+7,17,{align:'center'});

    txt('#ffffff'); pdf.setFontSize(14); pdf.setFont('helvetica','bold');
    pdf.text('INSPECTOR PERFORMANS RAPORU', M+18,13);
    txt('#90CAF9'); pdf.setFontSize(8); pdf.setFont('helvetica','normal');
    pdf.text('KalibRe Inspection Control System  ·  '+_tr(dateStr), M+18,21);

    // Çeyrek badge
    var qTxt=(appConfig&&appConfig.activeQuarters&&appConfig.activeQuarters.length)?appConfig.activeQuarters.join(' · '):'';
    if(qTxt){
      fill('#1565C0'); pdf.roundedRect(W-M-26,6,26,9,2,2,'F');
      txt('#ffffff'); pdf.setFontSize(7.5); pdf.setFont('helvetica','bold');
      pdf.text(qTxt, W-M-13,11.5,{align:'center'});
    }

    // ── Inspector Kartı ───────────────────────────────────────────────────────
    y=48;
    var perfC=pHex(duzPerf);
    // Sol renkli şerit
    fill(perfC); pdf.roundedRect(M,y,3,32,1,1,'F');
    // Kart zemin
    fill('#F0F6FF'); pdf.roundedRect(M+3,y,CW-3,32,3,3,'F');
    stroke('#BBDEFB'); pdf.setLineWidth(0.25);
    pdf.roundedRect(M+3,y,CW-3,32,3,3,'S');

    txt('#0B1F3A'); pdf.setFontSize(15); pdf.setFont('helvetica','bold');
    pdf.text(inspName, M+9, y+10);

    // Meta
    txt('#1E3A5F'); pdf.setFontSize(7.5); pdf.setFont('helvetica','normal');
    var col1=[
      'Toplam Adet : '+fmtN(totalAdet),
      'Kayit Sayisi: '+data.length,
      'Calisma Gunu: '+(insp.gunSayisi||0)+' gun'
    ];
    var col2=[
      'Standart Sure: '+(_aoFmtSn(totalStd)||'--'),
      'Gerceklesen  : '+(totalFiil>0?_aoFmtSn(totalFiil):'--'),
      'Overtime     : '+(otDk>0?otDk+' dk':'--')
    ];
    col1.forEach(function(t,i){pdf.text(t,M+9,y+18+i*5);});
    col2.forEach(function(t,i){pdf.text(t,M+90,y+18+i*5);});

    // Performans rozeti
    fill(perfC); pdf.roundedRect(W-M-25,y+4,22,24,2,2,'F');
    txt('#ffffff'); pdf.setFontSize(18); pdf.setFont('helvetica','bold');
    pdf.text('%'+duzPerf, W-M-14, y+16,{align:'center'});
    pdf.setFontSize(6); pdf.setFont('helvetica','bold');
    pdf.text(pLbl(duzPerf), W-M-14, y+23,{align:'center'});

    // ── 5 Özet Stat Kartı ─────────────────────────────────────────────────────
    y+=38;
    var stats=[
      {v:fmtN(totalAdet),      l:'TOPLAM ADET',   c:'#1565C0'},
      {v:_aoFmtSn(totalStd)||'--',l:'STANDART',    c:'#0B1F3A'},
      {v:totalFiil>0?_aoFmtSn(totalFiil):'--',l:'GERCEKLESEN',c:'#00897B'},
      {v:otDk>0?otDk+'dk':'--', l:'OVERTIME',      c:otDk>0?'#E65100':'#9E9E9E'},
      {v:String(data.length),  l:'KAYIT SAYISI',  c:'#1565C0'}
    ];
    var sW=Math.max(1,_n((CW-(stats.length-1)*1.5)/stats.length));
    stats.forEach(function(s,i){
      var sx=M+i*(sW+1.5);
      fill('#ffffff'); pdf.roundedRect(sx,y,sW,18,2,2,'F');
      fill(s.c); pdf.rect(sx,y,_n(sW),2.5,'F');

      txt(s.c); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
      pdf.text(s.v, sx+sW/2, y+11,{align:'center'});
      txt('#5A7FA8'); pdf.setFontSize(5.5); pdf.setFont('helvetica','normal');
      pdf.text(s.l, sx+sW/2, y+16,{align:'center'});
    });

    // ── Grafikler (3 küçük doughnut, yan yana, dengeli) ───────────────────────
    y+=24;
    fill('#0B1F3A'); pdf.rect(M,y,CW,6.5,'F');
    txt('#ffffff'); pdf.setFontSize(7.5); pdf.setFont('helvetica','bold');
    pdf.text('GRAFIKSEL ANALIZ', M+4, y+4.5);
    y+=8;

    // Her grafik kartı: 3 eşit sütun
    var gCardW=Math.max(1,_n((CW-4)/3));   // 3 kart, aralarında 2mm
    var gImgSz=32;          // grafik PNG boyutu mm -- küçük ve şık
    var gLegendX;

    [
      {title:'Klasman Dagilimi',    png:p1, legend:top8.map(function(k,i){return{l:_tr(k.ad).slice(0,15),v:fmtN(k.adet),c:klColors[i]||'#546E7A'};})},
      {title:'Perf. Bant Dagilimi', png:p2, legend:activeBands.map(function(b){return{l:b.l,v:b.n+' k.',c:b.c};})},
      {title:'Mesai Dagilimi',      png:p3, legend:[{l:'Normal',v:_aoFmtSn(normalSn)||'--',c:'#1565C0'},{l:'Overtime',v:_aoFmtSn(otSn)||'--',c:'#E65100'}]}
    ].forEach(function(g,gi){
      var gx = M + gi*(gCardW+2);
      var cardH = 78;

      // Kart zemin
      fill('#F8FBFF'); pdf.roundedRect(gx,y,gCardW,cardH,2,2,'F');
      stroke('#DDEEFF'); pdf.setLineWidth(0.2);
      pdf.roundedRect(gx,y,gCardW,cardH,2,2,'S');

      // Üst başlık şeridi
      fill('#EEF7FF'); pdf.roundedRect(gx,y,gCardW,7,2,2,'F');
      pdf.rect(gx,y+3,gCardW,4,'F'); // alt düzleştir
      txt('#0B1F3A'); pdf.setFontSize(6.5); pdf.setFont('helvetica','bold');
      pdf.text(g.title, gx+gCardW/2, y+5,{align:'center'});

      // Grafik -- ortada
      var gImgX = gx + (gCardW-gImgSz)/2;
      var gImgY = y+9;
      if(g.png){
        if(g.png&&gImgSz>0)pdf.addImage(g.png,'PNG',_n(gImgX),_n(gImgY),_n(gImgSz),_n(gImgSz));
      } else {
        txt('#BBBBBB'); pdf.setFontSize(7);
        pdf.text('Veri Yok', gx+gCardW/2, gImgY+gImgSz/2,{align:'center'});
      }

      // Lejant -- grafik altında
      var ly = gImgY + gImgSz + 3;
      pdf.setFontSize(5.5); pdf.setFont('helvetica','normal');
      g.legend.slice(0,6).forEach(function(item){
        if(ly>y+cardH-3) return;
        var c=hex2rgb(item.c);
        pdf.setFillColor(c[0],c[1],c[2]);
        pdf.roundedRect(gx+3, ly, 2.5, 2.5, 0.5,0.5,'F');
        txt('#2C3E50');
        pdf.text(item.l+' ('+item.v+')', gx+7, ly+2);
        ly+=4.5;
      });
    });

    footer(1,3);

    // ╔══ SAYFA 2: Klasman Tablosu ══════════════════════════════════════════════╗
    pdf.addPage(); y=0;
    fill('#0B1F3A'); pdf.rect(0,0,W,18,'F');
    fill('#1565C0'); pdf.rect(0,16,W,3.5,'F');
    txt('#ffffff'); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
    pdf.text('EN FAZLA KONTROL EDILEN KLASMANLAR', M, 11);
    txt('#90CAF9'); pdf.setFontSize(7.5); pdf.setFont('helvetica','normal');
    pdf.text(inspName, M, 16.5);
    y=24;

    var maxA=klList.length?klList[0].adet:1;
    var tW=CW;
    var tC=[0.07,0.45,0.18,0.13,0.17]; // # / Klasman / Adet / Kayit / Bar
    // Header
    fill('#1565C0'); pdf.rect(M,y,tW,7,'F');
    txt('#ffffff'); pdf.setFontSize(7); pdf.setFont('helvetica','bold');
    var hh=['#','KLASMAN','ADET','KAYIT','BAR'],tx=M;
    tC.forEach(function(r,i){pdf.text(hh[i],tx+tW*r/2,y+5,{align:'center'});tx+=tW*r;});
    y+=7;

    klList.slice(0,35).forEach(function(k,i){
      if(y>H-16){footer(2,3);pdf.addPage();y=14;}
      var rH=6.5;
      var top3c=['#FFF8E1','#F5F5F5','#FBF0E6'];
      fill(i<3?top3c[i]:(i%2===0?'#F8FBFF':'#ffffff')); pdf.rect(M,y,tW,rH,'F');
      if(i<3){fill(['#F9A825','#90A4AE','#CD7F32'][i]);pdf.rect(M,y,2,rH,'F');}

      tx=M;
      txt(i<3?'#795500':'#0B1F3A'); pdf.setFontSize(7); pdf.setFont('helvetica',i<3?'bold':'normal');
      pdf.text(String(i+1),tx+tW*tC[0]/2,y+4.5,{align:'center'}); tx+=tW*tC[0];
      var kn=_tr(k.ad); if(kn.length>30)kn=kn.slice(0,30)+'...';
      pdf.text(kn,tx+2,y+4.5); tx+=tW*tC[1];
      txt('#1565C0'); pdf.setFont('helvetica','bold');
      pdf.text(fmtN(k.adet),tx+tW*tC[2]/2,y+4.5,{align:'center'}); tx+=tW*tC[2];
      txt('#0B1F3A'); pdf.setFont('helvetica','normal');
      var kc=data.filter(function(r){return r.klasman===k.ad;}).length;
      pdf.text(String(kc),tx+tW*tC[3]/2,y+4.5,{align:'center'}); tx+=tW*tC[3];
      // Mini bar
      var bw=tW*tC[4]*0.88;
      if(bw>0){fill('#E3F2FD');pdf.rect(tx+2,y+2.2,_n(bw),2.8,'F');fill('#1565C0');pdf.rect(tx+2,y+2.2,_n(bw*Math.min(k.adet/maxA,1)),2.8,'F');}
      y+=rH;
      stroke('#E8F0FE'); pdf.setLineWidth(0.1); pdf.line(M,y,M+tW,y);
    });
    footer(2,3);

    // ╔══ SAYFA 3: Kayıt Detay Tablosu ═════════════════════════════════════════╗
    pdf.addPage(); y=0;
    fill('#0B1F3A'); pdf.rect(0,0,W,18,'F');
    fill('#1565C0'); pdf.rect(0,16,W,3.5,'F');
    txt('#ffffff'); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
    pdf.text('KAYIT DETAY TABLOSU', M, 11);
    txt('#90CAF9'); pdf.setFontSize(7.5); pdf.setFont('helvetica','normal');
    pdf.text(inspName+' -- Toplam '+data.length+' kayit', M, 16.5);
    y=24;

    var dC2=[0.32,0.09,0.14,0.14,0.16,0.15];
    var dH2=['KLASMAN','ADET','STANDART','GERCEK','BASLANGIC','ORAN%'];
    fill('#0B1F3A'); pdf.rect(M,y,tW,7,'F');
    txt('#ffffff'); pdf.setFontSize(7); pdf.setFont('helvetica','bold');
    tx=M; dC2.forEach(function(r,i){pdf.text(dH2[i],tx+tW*r/2,y+5,{align:'center'});tx+=tW*r;});
    y+=7;

    data.slice().sort(function(a,b){return b.adet-a.adet;}).slice(0,55).forEach(function(k,i){
      if(y>H-16){footer(3,3);pdf.addPage();y=14;}
      var rH=6.2;
      fill(i%2===0?'#F8FBFF':'#ffffff'); pdf.rect(M,y,tW,rH,'F');
      var oran=(k.standartSure&&k.kayitFiiliSure)?Math.round(k.standartSure/k.kayitFiiliSure*100):null;
      tx=M;
      txt('#0B1F3A'); pdf.setFontSize(6.8); pdf.setFont('helvetica','normal');
      var kn2=_tr(k.klasman||'--'); if(kn2.length>25)kn2=kn2.slice(0,25)+'...';
      pdf.text(kn2,tx+2,y+4.3); tx+=tW*dC2[0];
      pdf.text(String(k.adet||0),tx+tW*dC2[1]/2,y+4.3,{align:'center'}); tx+=tW*dC2[1];
      txt('#1565C0');
      pdf.text(_aoFmtSn(k.standartSure)||'--',tx+tW*dC2[2]/2,y+4.3,{align:'center'}); tx+=tW*dC2[2];
      txt('#00897B');
      pdf.text(k.kayitFiiliSure>0?_aoFmtSn(k.kayitFiiliSure):'--',tx+tW*dC2[3]/2,y+4.3,{align:'center'}); tx+=tW*dC2[3];
      txt('#5A7FA8');
      var ts=k.baslangic?_aoFmtTarih(k.baslangic instanceof Date?k.baslangic:new Date(k.baslangic)):'--';
      pdf.text(ts,tx+tW*dC2[4]/2,y+4.3,{align:'center'}); tx+=tW*dC2[4];
      if(oran!==null){
        var oc=hex2rgb(pHex(oran));
        pdf.setFillColor(oc[0],oc[1],oc[2]);
        var orW=_n(tW*dC2[5]-4);if(orW>0)pdf.roundedRect(tx+2,y+1,orW,_n(rH-2),1.5,1.5,'F');
        txt('#ffffff'); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
        pdf.text('%'+oran,tx+tW*dC2[5]/2,y+4.5,{align:'center'});
      } else {
        txt('#BBBBBB'); pdf.setFont('helvetica','normal');
        pdf.text('--',tx+tW*dC2[5]/2,y+4.3,{align:'center'});
      }
      y+=rH;
      stroke('#E8F0FE'); pdf.setLineWidth(0.1); pdf.line(M,y,M+tW,y);
    });
    footer(3,3);

    // ── Kaydet & Mail ─────────────────────────────────────────────────────────
    var fn='performans_'+inspName.replace(/\s+/g,'_')+'_'+now.toISOString().slice(0,10)+'.pdf';
    pdf.save(fn);

    var subj=encodeURIComponent('Performans Raporu - '+(insp.ins||'')+' - '+dateStr);
    var body=encodeURIComponent(
      'Merhaba,\n\n'+(insp.ins||'')+' performans raporu ekte sunulmustur.\n\n'+
      '-- OZET --\n'+
      '  Duz. Performans : %'+duzPerf+' ('+pLbl(duzPerf)+')\n'+
      '  Toplam Adet     : '+fmtN(totalAdet)+'\n'+
      '  Kayit Sayisi    : '+data.length+'\n'+
      '  Calisma Gunu    : '+(insp.gunSayisi||0)+'\n'+
      '  Standart Sure   : '+(_aoFmtSn(totalStd)||'--')+'\n'+
      '  Gerceklesen     : '+(totalFiil>0?_aoFmtSn(totalFiil):'--')+'\n'+
      (otDk>0?'  Overtime       : '+otDk+' dk\n':'')+
      '\nDetayli rapor (PDF) ektedir.\n\nIyi calismalar,\nKalibRe Panel'
    );
    window.open('mailto:?subject='+subj+'&body='+body);

  } catch(err) {
    alert('PDF hatasi: '+err.message);
    console.error(err);
  } finally {
    if(btn){btn.innerHTML='📄 PDF & Mail';btn.disabled=false;}
  }
}
