// ══════════════════════════════════════════════════════════════════
// KAYIP ZAMAN SİSTEMİ
// ══════════════════════════════════════════════════════════════════

// ─── Yardımcı: iki saat stringini karşılaştırıp dakika farkı döner ───
function saatFarkiDk(baslangic, bitis) {
  if (!baslangic || !bitis) return 0;
  const [bh, bm] = baslangic.split(':').map(Number);
  const [eh, em] = bitis.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (bh * 60 + bm));
}

// ─── Tarihten gün adı ───
function tarihtenGun(tarihStr) {
  if (!tarihStr) return '';
  const gunler = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const d = new Date(tarihStr);
  return isNaN(d) ? '' : gunler[d.getDay()];
}

// ─── Tarih input değişince gün alanını güncelle ───
document.addEventListener('DOMContentLoaded', () => {
  const tarihInput = document.getElementById('kz-tarih');
  if (tarihInput) {
    tarihInput.addEventListener('change', () => {
      const gunEl = document.getElementById('kz-gun');
      if (gunEl) gunEl.value = tarihtenGun(tarihInput.value);
    });
    // Varsayılan bugün
    const today = _bugununTarihiYerel();
    tarihInput.value = today;
    const gunEl = document.getElementById('kz-gun');
    if (gunEl) gunEl.value = tarihtenGun(today);
  }
});

// ─── Inspector dropdown'ı doldur (ekip yöneticisi için) ───
function fillKayipZamanInspectorDropdown() {
  const sel = document.getElementById('kz-inspector');
  if (!sel) return;
  const teamInspectors = getTeamInspectors();
  sel.innerHTML = '<option value="">— Inspector seçin —</option>';
  teamInspectors.forEach(ins => {
    const opt = document.createElement('option');
    opt.value = ins.ins;
    opt.textContent = _formatDisplayName(ins.ins);
    sel.appendChild(opt);
  });
}

// ─── Kayıp Zaman Kaydet (Sheets'e) ───
async function saveKayipZaman() {
  const inspector = document.getElementById('kz-inspector')?.value?.trim();
  const tarih     = document.getElementById('kz-tarih')?.value;
  const gun       = document.getElementById('kz-gun')?.value;
  const baslangic = document.getElementById('kz-baslangic')?.value;
  const bitis     = document.getElementById('kz-bitis')?.value;
  const sebep     = document.getElementById('kz-sebep')?.value;
  const depo      = document.getElementById('kz-depo')?.value?.trim() || '';
  const aciklama  = document.getElementById('kz-aciklama')?.value?.trim() || '';

  if (!inspector) { alert('Lütfen bir inspector seçin.'); return; }
  if (!tarih)     { alert('Lütfen tarih girin.'); return; }
  if (!baslangic || !bitis) { alert('Lütfen başlangıç ve bitiş saati girin.'); return; }

  const sureDk = saatFarkiDk(baslangic, bitis);
  if (sureDk <= 0) { alert('Bitiş saati başlangıçtan sonra olmalı.'); return; }

  // ── 1. Katman: Frontend mükerrer kontrol (local cache üzerinden) ──────────
  const mevcut = kayipZamanData.find(k =>
    String(k.inspector || '').trim().toLowerCase() === String(inspector).trim().toLowerCase() &&
    String(k.tarih     || '').trim() === String(tarih).trim() &&
    String(k.baslangic || '').trim() === String(baslangic).trim()
  );
  if (mevcut) {
    alert(
      '⚠️ Mükerrer Kayıt!\n\n' +
      inspector + ' için ' + tarih + ' tarihinde ' + baslangic +
      ' saatinde zaten bir kayıp zaman girişi mevcut.\n\n' +
      'Aynı kişi, aynı tarih ve aynı başlangıç saatiyle tekrar kayıt yapılamaz.'
    );
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (SHEETS_DEVRE_DISI) { alert('⚠️ Kayıp Zaman modülü şu anda kullanılamıyor (Google Sheets bağlantısı kapatıldı).'); return; }
  if (!url) { alert('Sheets bağlantısı yapılandırılmamış.'); return; }

  const record = {
    id: Date.now().toString(),
    inspector,
    tarih,
    gun: gun || tarihtenGun(tarih),
    baslangic,
    bitis,
    sebep,
    depo,
    aciklama,
    ekipYoneticisi: currentUser?.username || '',
    sureDk,
    savedAt: new Date().toISOString()
  };

  const btn = document.getElementById('kz-save-btn');
  const msg = document.getElementById('kz-save-msg');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

  try {
    // ── 2. Katman: Backend mükerrer kontrol (sheets üzerinden) ─────────────
    const resp = await jsonpFetch(url, {
      action: 'setKayipZaman',
      token,
      record: encodeURIComponent(JSON.stringify(record))
    });
    if (resp && resp.status === 'duplicate') {
      alert('⚠️ Mükerrer Kayıt!\n\n' + (resp.message || 'Bu kayıt zaten mevcut.'));
      return;
    }
    if (resp && resp.status === 'error') {
      alert('Hata: ' + (resp.message || 'Bilinmeyen hata'));
      return;
    }
    // ── Başarılı: local cache'e ekle ────────────────────────────────────────
    kayipZamanData.push(record);
    if (msg) { msg.style.display = ''; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
    // Formu temizle (null-safe)
    const _el = id => document.getElementById(id);
    if (_el('kz-aciklama'))  _el('kz-aciklama').value  = '';
    if (_el('kz-baslangic')) _el('kz-baslangic').value = '';
    if (_el('kz-bitis'))     _el('kz-bitis').value     = '';
    if (_el('kz-depo'))      _el('kz-depo').value      = '';
    renderKayipZamanEkipListe();
    renderDuzeltilmisPerformansEkip();
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Kayıp Zamanı Kaydet'; }
  }
}

// ─── İkinci Inspection Kaydet (kullanıcı talebiyle eklendi) ───
// Teknik İnceleme bölümüne giriş yapan kullanıcıların günlük hedefi: en az
// N adet (varsayılan 5) ikinci inspection kaydı girmeleri gerekiyor.
async function saveIkinciInspection() {
  const siparisKodu    = document.getElementById('ii-siparis-kodu')?.value?.trim() || '';
  const inspector      = document.getElementById('ii-inspector')?.value?.trim() || '';
  const ekipYoneticisi = document.getElementById('ii-ekip-yoneticisi')?.value?.trim() || '';
  const talepNo        = document.getElementById('ii-talep-no')?.value?.trim() || '';
  const talepMiktari   = parseInt(document.getElementById('ii-talep-miktari')?.value, 10) || 0;
  const sonuc          = document.getElementById('ii-sonuc')?.value || '';
  const notAlani       = document.getElementById('ii-not')?.value?.trim() || '';
  const tarih          = document.getElementById('ii-tarih')?.value || _bugununTarihiYerel();

  if (!inspector)  { alert('⚠️ Lütfen Inspector İsmi girin.'); return; }
  if (!talepNo)    { alert('⚠️ Lütfen Talep Numarası girin.'); return; }
  if (!sonuc)      { alert('⚠️ Lütfen Sonuç (Geçti/Kaldı) seçin.'); return; }

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('⚠️ Sunucu bağlantısı yapılandırılmamış.'); return; }

  const record = {
    id: Date.now().toString(),
    siparisKodu, inspector, ekipYoneticisi, talepNo, talepMiktari, sonuc, notAlani,
    tarih,
    degerlendiren: currentUser?.username || '',
    savedAt: new Date().toISOString()
  };

  const btn = document.getElementById('ii-save-btn');
  const msg = document.getElementById('ii-save-msg');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

  try {
    const resp = await jsonpFetch(url, {
      action: 'setIkinciInspection',
      token,
      record: encodeURIComponent(JSON.stringify(record))
    });
    if (resp && resp.status === 'error') {
      alert('Hata: ' + (resp.message || 'Bilinmeyen hata'));
      return;
    }
    ikinciInspectionData.push(record);
    if (msg) { msg.style.display = ''; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
    // Formu temizle (Inspector/Ekip Yöneticisi hariç — art arda aynı kişi için birden çok girilebilir)
    const _el = id => document.getElementById(id);
    if (_el('ii-siparis-kodu'))  _el('ii-siparis-kodu').value = '';
    if (_el('ii-talep-no'))      _el('ii-talep-no').value = '';
    if (_el('ii-talep-miktari')) _el('ii-talep-miktari').value = '';
    if (_el('ii-sonuc'))         _el('ii-sonuc').value = '';
    if (_el('ii-not'))           _el('ii-not').value = '';
    renderIkinciInspectionTablo();
    renderTiDashboard();
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 İkinci Inspection Kaydet'; }
  }
}

async function temizleIkinciInspectionVerileri() {
  if (!currentUser || !currentUser.isAdmin) { alert('⚠️ Bu işlem sadece admin tarafından yapılabilir.'); return; }
  if (!confirm('⚠️ TÜM İkinci Inspection kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('⚠️ Sunucu bağlantısı yapılandırılmamış.'); return; }
  try {
    await jsonpFetch(url, { action: 'clearIkinciInspection', token });
    ikinciInspectionData = [];
    renderIkinciInspectionTablo();
    renderTiDashboard();
    alert('✅ İkinci Inspection kayıtları temizlendi.');
  } catch(e) {
    alert('Hata: ' + e.message);
  }
}

// ─── Teknik İnceleme Hedeflerini Kaydet (Admin) ───
async function kaydetTeknikHedefler() {
  const teknikDegerlendirmeGunluk = Math.max(1, parseInt(document.getElementById('ti-hedef-degerlendirme')?.value, 10) || 3);
  const ikinciInspectionGunluk    = Math.max(1, parseInt(document.getElementById('ti-hedef-ikinci-inspection')?.value, 10) || 5);
  const baslangicTarihi = document.getElementById('ti-hedef-baslangic-tarihi')?.value || '';

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('⚠️ Sunucu bağlantısı yapılandırılmamış.'); return; }

  teknikHedefler = { teknikDegerlendirmeGunluk, ikinciInspectionGunluk, baslangicTarihi };
  try {
    await jsonpFetch(url, {
      action: 'setTeknikHedefler',
      token,
      hedefler: encodeURIComponent(JSON.stringify(teknikHedefler))
    });
    showSuccessMessage('✅ Hedefler kaydedildi.');
    renderTiDashboard();
  } catch(e) {
    alert('Hata: ' + e.message);
  }
}

// ─── Ekip Yöneticisi: Sayfayı Yükle ───
async function loadKayipZamanEkip() {
  fillKayipZamanInspectorDropdown();
  await fetchKayipZamanData();
  renderKayipZamanEkipListe();
  renderDuzeltilmisPerformansEkip();
}

// ─── Sheets'ten kayıp zaman verilerini çek ───
async function fetchKayipZamanData() {
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) return;
  try {
    const data = await jsonpFetch(url, { action: 'getKayipZaman', token });
    if (data?.status === 'ok' && Array.isArray(data.kayitlar)) {
      kayipZamanData = data.kayitlar;
      saveKayipZamanToLocalStorage();
    }
  } catch(e) {
    console.warn('Kayıp zaman verisi çekilemedi:', e);
  }
}

// ─── İkinci Inspection verisini çek ───
async function fetchIkinciInspectionData() {
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) return;
  try {
    const data = await jsonpFetch(url, { action: 'getIkinciInspection', token });
    if (data?.status === 'ok' && Array.isArray(data.kayitlar)) {
      ikinciInspectionData = data.kayitlar;
      try { localStorage.setItem('lc_ikinci_inspection_cache', JSON.stringify(ikinciInspectionData)); } catch(e) {}
    }
  } catch(e) {
    console.warn('İkinci Inspection verisi çekilemedi:', e);
  }
}

// ─── Teknik İnceleme Hedeflerini çek ───
async function fetchTeknikHedefler() {
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) return;
  try {
    const data = await jsonpFetch(url, { action: 'getTeknikHedefler', token });
    if (data?.status === 'ok' && data.hedefler) {
      teknikHedefler = {
        teknikDegerlendirmeGunluk: Number(data.hedefler.teknikDegerlendirmeGunluk) || 3,
        ikinciInspectionGunluk: Number(data.hedefler.ikinciInspectionGunluk) || 5,
        baslangicTarihi: data.hedefler.baslangicTarihi || ''
      };
      try { localStorage.setItem('lc_teknik_hedefler_cache', JSON.stringify(teknikHedefler)); } catch(e) {}
    }
  } catch(e) {
    console.warn('Teknik İnceleme hedefleri çekilemedi:', e);
  }
}

// ─── Düzeltilmiş Performansı Hesapla ───
// Bir inspector için toplam kayıp dakikayı döner
function getKayipDakikaForInspector(inspectorName) {
  const nameNorm = String(inspectorName || '').toLowerCase().trim();
  return kayipZamanData
    .filter(r => String(r.inspector || '').toLowerCase().trim() === nameNorm)
    .reduce((sum, r) => sum + (r.sureDk || 0), 0);
}

// ── Değerlendirme Dışı Detay Popup'ı ──────────────────────────────────────
function showKayipDetayPopup(inspectorName) {
  const nameNorm = String(inspectorName || '').toLowerCase().trim();
  const kayitlar = kayipZamanData.filter(r => String(r.inspector || '').toLowerCase().trim() === nameNorm);
  const toplamDk = kayitlar.reduce((s, r) => s + (r.sureDk || 0), 0);

  if (kayitlar.length === 0) return;

  const satirlar = kayitlar.map(r => {
    const tarih = r.tarih ? new Date(r.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const gun = r.gun ? ` (${r.gun})` : '';
    const sure = (r.sureDk / 60).toFixed(1) + 's';
    const sebep = r.sebep || '—';
    const aciklama = r.aciklama || '';
    return `
      <div style="display:grid;grid-template-columns:1fr 80px 1fr;gap:8px;align-items:start;padding:10px 14px;border-bottom:1px solid #f0f4f8;">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--navy)">${tarih}${gun}</div>
          <div style="font-size:11px;color:var(--muted2);margin-top:2px">${r.baslangic ? r.baslangic.substring(0,5) : ''}${r.bitis ? ' – ' + r.bitis.substring(0,5) : ''}</div>
        </div>
        <div style="text-align:center">
          <span style="background:#FFEBEE;color:#C62828;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;font-family:'DM Mono',monospace">${sure}</span>
        </div>
        <div>
          <div style="font-size:12px;color:#E65100;font-weight:600">${SEBEP_IKONLAR && SEBEP_IKONLAR[sebep] ? SEBEP_IKONLAR[sebep] + ' ' : '⏸ '}${sebep}</div>
          ${aciklama ? `<div style="font-size:11px;color:var(--muted2);margin-top:2px">${_escapeHtml(aciklama)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'kayip-detay-popup-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(11,31,58,.65);z-index:9998;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;width:min(600px,92vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <!-- Başlık -->
      <div style="background:var(--navy);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:15px;font-weight:700;color:#fff">⏸ Değerlendirme Dışı Kayıtlar</div>
          <div style="font-size:12px;color:#9FACC9;margin-top:3px">${_escapeHtml(inspectorName)} · Toplam: <strong style="color:#FFA726">${(toplamDk/60).toFixed(1)} saat</strong> (${kayitlar.length} kayıt)</div>
        </div>
        <button onclick="document.getElementById('kayip-detay-popup-overlay').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.25)'" onmouseout="this.style.background='rgba(255,255,255,.15)'">✕</button>
      </div>
      <!-- Kolon başlıkları -->
      <div style="display:grid;grid-template-columns:1fr 80px 1fr;gap:8px;padding:8px 14px;background:#F4F7FC;border-bottom:1px solid #E3E8F0;flex-shrink:0;">
        <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Tarih / Saat</div>
        <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center">Süre</div>
        <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Sebep / Açıklama</div>
      </div>
      <!-- Kayıtlar -->
      <div style="overflow-y:auto;flex:1;">${satirlar}</div>
      <!-- Alt not -->
      <div style="padding:12px 16px;background:#FFFDE7;border-top:1px solid #FFF59D;flex-shrink:0;">
        <div style="font-size:11.5px;color:#5D4037;">
          ℹ️ Bu süreler performans hesabına dahil edilmez — inspector değerlendirmesini etkilemez, sadece belgeleme amaçlıdır.
        </div>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// "Ne ödül ne ceza" ilkesi: kayıp zaman (iş verilememesi, arıza vb. çalışanın
// kontrolü dışındaki nedenler) mesai paydasından düşülür — çalışana verilmeyen
// süre için performans düşürülmez, ama o süre "çalışılmış" gibi sayılıp
// paydayı da şişirmez. Bu düzeltme SADECE burada, HER SEFERİNDE güncel
// kayipZamanData ile canlı hesaplanır (performansHesapla'da bilerek YAPILMAZ —
// bkz. oradaki not) — böylece Excel'den sonra girilen kayıp zaman kayıtları da
// doğru yansır ve aynı düşüm iki kez uygulanmaz.
function getDuzeltilmisPerformans(inspector) {
  const standartSn = inspector.standartSure || 0;
  let mesaiSn = inspector.mesaiSure || 0;
  if (!mesaiSn || !standartSn) return getDispPerf(inspector);

  const kayipDkSn = (typeof getNotrKayipDakikaForInspector === 'function')
    ? getNotrKayipDakikaForInspector(inspector.ins) * 60
    : 0;
  if (kayipDkSn > 0 && mesaiSn > kayipDkSn) {
    mesaiSn -= kayipDkSn;
  }

  const hedef = inspector.hedefVerimlilik || 100;
  return Math.round((standartSn / mesaiSn) * 100 * (100 / hedef));
}

// Inspector'in saatlik ortalama adet hizi (tahmini kayip adet hesabi icin)
function getSaatlikAdetHizi(inspector) {
  const adet = inspector.adet || 0;
  const mesaiSn = inspector.mesaiSure || 0;
  if (!adet || !mesaiSn) return 0;
  const mesaiSaat = mesaiSn / 3600;
  return adet / mesaiSaat;
}

// Orijinal ham performans (kayipsiz) - karsilastirma icin
function getOrijinalHamPerf(inspector) {
  const mesaiSn    = inspector.mesaiSure    || 0;
  const standartSn = inspector.standartSure || 0;
  if (!mesaiSn || !standartSn) return getDispPerf(inspector);
  const hedef = inspector.hedefVerimlilik || 100;
  return Math.round((standartSn / mesaiSn) * 100 * (100 / hedef));
}


// Tarih string'ini kisa formata donustur
function formatTarihKisa(tarih) {
  if (!tarih) return '';
  const s = String(tarih);
  // YYYY-MM-DD formati zaten kisa
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO veya uzun format -> Date nesnesine cevir
  try {
    const d = new Date(s);
    if (!isNaN(d)) {
      return d.toLocaleDateString('tr-TR', {day:'2-digit',month:'2-digit',year:'numeric'});
    }
  } catch(e) {}
  return s.substring(0, 10);
}

function renderDuzeltilmisPerformansEkip() {
  const container = document.getElementById('kz-duzeltilmis-container');
  if (!container) return;
  const teamInspectors = getTeamInspectors();
  if (!teamInspectors.length || !performansData.length) {
    container.innerHTML = `<div class="empty" style="padding:30px"><div class="empty-icon">📊</div><h3>Veri Bekleniyor</h3><p>Performans verisi gerekli</p></div>`;
    return;
  }

  const rows = teamInspectors.map(ins => {
    const kayipDk   = getKayipDakikaForInspector(ins.ins);
    const perf      = getOrijinalHamPerf(ins);
    const perfClass = getPerformanceClass(perf);
    const kayipSaat = (kayipDk / 60).toFixed(1);
    const kayipNotu = kayipDk > 0
      ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#FFF3E0;color:#E65100;border:1px solid #FFCC80;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600">&#9208; ${kayipSaat}s &nbsp;<span style="font-weight:400;color:#999;font-size:10px">de&#287;erlendirme d&#305;&#351;&#305;</span></span>`
      : `<span style="color:var(--muted);font-size:12px">&mdash;</span>`;
    return `
      <tr style="border-bottom:1px solid var(--border2)">
        <td style="padding:10px 12px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(ins.ins))}</td>
        <td style="padding:10px 12px;text-align:center"><span class="${perfClass}" style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700">${perf}%</span></td>
        <td style="padding:10px 12px;text-align:center;font-family:'DM Mono',monospace;color:#C62828;font-weight:600">${kayipDk > 0 ? kayipSaat + ' s' : '&mdash;'}</td>
        <td style="padding:10px 12px;text-align:center">${kayipNotu}</td>
      </tr>`;
    }).join('');

  container.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid var(--border2)">
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Inspector</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:var(--blue2);text-transform:uppercase;letter-spacing:.4px">Performans</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:#C62828;text-transform:uppercase;letter-spacing:.4px">⏸ Kayıp Süre</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:#E65100;text-transform:uppercase;letter-spacing:.4px">Değerlendirme Notu</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── Ekip sayfası: kayıp zaman listesi (filtreli + sayfalı) ───
let _kzEkipPage = 1;
const KZ_PAGE_SIZE = 20;

function renderKayipZamanEkipListe() {
  const container  = document.getElementById('kz-ekip-liste');
  const countEl    = document.getElementById('kz-ekip-count');
  const pagEl      = document.getElementById('kz-ekip-pagination');
  const toplamEl   = document.getElementById('kz-ekip-toplam');
  if (!container) return;

  const username = currentUser?.username || '';
  let records = kayipZamanData.filter(r => r.ekipYoneticisi === username);

  // Inspector dropdown'u doldur
  const inspSel = document.getElementById('kz-filter-inspector');
  if (inspSel && inspSel.options.length <= 1) {
    const insps = [...new Set(records.map(r => r.inspector))].sort();
    insps.forEach(ins => {
      const opt = document.createElement('option');
      opt.value = ins;
      opt.textContent = _formatDisplayName(ins);
      inspSel.appendChild(opt);
    });
  }

  // Filtrele
  const filterIns  = document.getElementById('kz-filter-inspector')?.value || '';
  const filterSebep = document.getElementById('kz-filter-sebep')?.value || '';
  if (filterIns)   records = records.filter(r => r.inspector === filterIns);
  if (filterSebep) records = records.filter(r => r.sebep === filterSebep);

  // Sırala: en yeni üste
  records = [...records].reverse();

  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / KZ_PAGE_SIZE));
  if (_kzEkipPage > totalPages) _kzEkipPage = 1;

  const pageRecords = records.slice((_kzEkipPage-1)*KZ_PAGE_SIZE, _kzEkipPage*KZ_PAGE_SIZE);
  const toplamDk = records.reduce((s,r)=>s+(r.sureDk||0),0);

  if (countEl) countEl.textContent = total + ' kayıt';

  if (!records.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Kayıt bulunamadı</div>`;
    if (pagEl) pagEl.innerHTML = '';
    if (toplamEl) toplamEl.innerHTML = '';
    return;
  }

  // Tablo
  const rows = pageRecords.map(r => `
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:9px 12px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(r.inspector))}</td>
      <td style="padding:9px 12px;font-family:'DM Mono',monospace;color:var(--muted)">${formatTarihKisa(r.tarih)}</td>
      <td style="padding:9px 12px;color:var(--muted)">${r.gun||''}</td>
      <td style="padding:9px 12px;font-family:'DM Mono',monospace">${r.baslangic?r.baslangic.substring(0,5):''} – ${r.bitis?r.bitis.substring(0,5):''}</td>
      <td style="padding:9px 12px;text-align:center"><span style="background:#FFEBEE;color:#C62828;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">${(r.sureDk/60).toFixed(1)}s</span></td>
      <td style="padding:9px 12px"><span style="background:var(--lblue3);color:var(--blue2);border-radius:6px;padding:2px 8px;font-size:11px">${SEBEP_IKONLAR[r.sebep]||'📝'} ${_escapeHtml(r.sebep||'')}</span></td>
      <td style="padding:9px 12px;color:var(--muted);font-size:11px">${r.depo ? '<span style="background:#E8F5E9;color:#2E7D32;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">🏭 '+_escapeHtml(r.depo)+'</span>' : ''}</td>
      <td style="padding:9px 12px;color:var(--muted);font-size:11px">${_escapeHtml(r.aciklama||'')}</td>
    </tr>`).join('');

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f8f9fa;border-bottom:2px solid var(--border2)">
          <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Inspector</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Tarih</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Gün</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Saat Aralığı</th>
          <th style="padding:9px 12px;text-align:center;font-size:10px;color:#C62828;text-transform:uppercase;letter-spacing:.4px">Süre</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Sebep</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Depo</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Açıklama</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Sayfalama
  if (pagEl) {
    const btnStyle = (active) => `style="padding:5px 11px;border-radius:6px;border:1px solid var(--border2);background:${active?'var(--navy)':'#fff'};color:${active?'#fff':'var(--navy)'};font-size:12px;cursor:pointer;font-weight:600"`;
    let pags = '';
    for (let i=1; i<=totalPages; i++) {
      pags += `<button ${btnStyle(i===_kzEkipPage)} onclick="_kzEkipPage=${i};renderKayipZamanEkipListe()">${i}</button>`;
    }
    pagEl.innerHTML = `
      <div style="font-size:12px;color:var(--muted)">${(_kzEkipPage-1)*KZ_PAGE_SIZE+1}–${Math.min(_kzEkipPage*KZ_PAGE_SIZE,total)} / ${total} kayıt</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${pags}</div>`;
  }

  // Toplam
  if (toplamEl) {
    const sebepOzet = {};
    records.forEach(r => { const s=r.sebep||'Diğer'; sebepOzet[s]=(sebepOzet[s]||0)+(r.sureDk||0); });
    const sebepStr = Object.entries(sebepOzet).sort((a,b)=>b[1]-a[1])
      .map(([s,dk])=>`<span style="background:var(--lblue3);color:var(--blue2);border-radius:5px;padding:2px 8px;font-size:11px;margin-right:4px">${SEBEP_IKONLAR[s]||'📝'} ${_escapeHtml(s)}: <b>${(dk/60).toFixed(1)}s</b></span>`)
      .join('');
    toplamEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-weight:600;color:var(--muted);margin-right:4px">Toplam:</span>${sebepStr}</div>
        <span style="background:#FFEBEE;color:#C62828;border-radius:6px;padding:4px 12px;font-family:'DM Mono',monospace;font-size:13px;font-weight:700">⏸ ${(toplamDk/60).toFixed(1)} saat</span>
      </div>`;
  }
}

// ─── Admin: Sayfayı Yükle ───
async function loadKayipZamanAdmin() {
  const perf = document.getElementById('kz-admin-perf-table');
  const liste = document.getElementById('kz-admin-liste');

  // Bellekte veri yoksa (örn. F5 sonrası ilk açılış) localStorage'dan anında doldur
  if (kayipZamanData.length === 0) {
    loadKayipZamanFromLocalStorage();
  }

  const cacheTaze = kayipZamanData.length > 0 && (Date.now() - _kzLastFetchTime) < KZ_CACHE_MS;

  if (kayipZamanData.length > 0) {
    // Elde veri var (bellek veya localStorage) - aninda render et, kullanici bos ekran gormesin
    ['kz-admin-filter-ekip','kz-admin-filter-inspector'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { while(el.options.length > 1) el.remove(1); }
    });
    window._kzAdminPage = 1;
    _kzDetayPage = 1;
    _kzStartDate = '';
    _kzEndDate = '';
    _kzDepo = '';
    renderKayipZamanAdminAll();
    updateKayipNavBadge();

    if (cacheTaze) {
      // Veri zaten taze (20sn icinde cekilmis) - arkaplanda tekrar cekmeye gerek yok
      startKayipZamanAutoRefresh();
      return;
    }
    // Veri var ama bayat - ekranı bozmadan arkaplanda sessizce tazele
    fetchKayipZamanData().then(() => {
      _kzLastFetchTime = Date.now();
      renderKayipZamanAdminAll();
      updateKayipNavBadge();
    });
    startKayipZamanAutoRefresh();
    return;
  }

  // Hiç veri yok (ilk kullanım, localStorage da boş) - loading göster ve bekle
  if (perf)  perf.innerHTML  = '<div style="padding:30px;text-align:center;color:var(--muted)">\u23F3 Veri çekiliyor...</div>';
  if (liste) liste.innerHTML = '';

  await fetchKayipZamanData();
  _kzLastFetchTime = Date.now();

  // Dropdown'lari sifirla
  ['kz-admin-filter-ekip','kz-admin-filter-inspector'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { while(el.options.length > 1) el.remove(1); }
  });
  window._kzAdminPage = 1;
  _kzDetayPage = 1;
  _kzStartDate = '';
  _kzEndDate = '';
  _kzDepo = '';
  renderKayipZamanAdminAll();
  updateKayipNavBadge();
  startKayipZamanAutoRefresh();
}

// ─── Arkaplanda 1 dakikada bir otomatik yenileme ───
// Yalnızca Kayıp Zaman Analizi sayfası açıkken çalışır; başka sayfaya geçilince durur.
let _kzAutoRefreshTimer = null;
const KZ_AUTO_REFRESH_MS = 60000; // 1 dakika

function startKayipZamanAutoRefresh() {
  stopKayipZamanAutoRefresh();
  _kzAutoRefreshTimer = setInterval(async () => {
    const pageEl = document.getElementById('page-kayip-zaman-admin');
    if (!pageEl || !pageEl.classList.contains('active')) {
      stopKayipZamanAutoRefresh();
      return;
    }
    await fetchKayipZamanData();
    _kzLastFetchTime = Date.now();
    renderKayipZamanAdminAll();
    updateKayipNavBadge();
  }, KZ_AUTO_REFRESH_MS);
}

function stopKayipZamanAutoRefresh() {
  if (_kzAutoRefreshTimer) {
    clearInterval(_kzAutoRefreshTimer);
    _kzAutoRefreshTimer = null;
  }
}

// "Yenile" butonu icin: cache'i atlayip zorla yeniden ceker
async function forceRefreshKayipZamanAdmin() {
  _kzLastFetchTime = 0;
  await loadKayipZamanAdmin();
}

function updateKayipNavBadge() {
  const badge = document.getElementById('nav-kayip-count');
  if (badge) badge.textContent = kayipZamanData.length || '';
}

// ─── SEBEP İKONLARI ───
const SEBEP_IKONLAR = {
  'Sistemsel Hata':    '⚙️',
  'Ürün Olmaması':     '📦',
  'Elektrik Kesintisi':'⚡',
  'Insp. Lokasyon Değişimi': '📍',
  'Diğer':             '📝'
};

// ─── Tüm admin sayfasını tek fonksiyondan render et ───
function renderKayipZamanAdminAll() {
  renderKayipZamanAdminOzet();
  renderKayipZamanEkipGrid();
  renderKayipZamanDetayliTablo();
}

// Filtre degisince hem detayli tablo hem liste yenilenir
function onKzAdminFilterChange() {
  _kzDetayPage = 1;
  renderKayipZamanDetayliTablo();
}

// ─── Özet Kartlar ───
function renderKayipZamanAdminOzet() {
  const el = document.getElementById('kz-admin-ozet');
  if (!el) return;
  const toplamKayit = kayipZamanData.length;
  const toplamDk    = kayipZamanData.reduce((s,r)=>s+(r.sureDk||0),0);
  const inspSayisi  = new Set(kayipZamanData.map(r=>r.inspector)).size;

  // Ilk ve son kayit tarihini bul (YYYY-MM-DD string karsilastirmasi guvenilir siralamadir)
  const tarihKisaListesi = kayipZamanData.map(r => formatTarihKisaISO(r.tarih)).filter(Boolean).sort();
  const ilkTarihISO = tarihKisaListesi.length ? tarihKisaListesi[0] : null;
  const sonTarihISO = tarihKisaListesi.length ? tarihKisaListesi[tarihKisaListesi.length-1] : null;
  const ilkTarihGorunum = ilkTarihISO ? formatTarihKisa(ilkTarihISO) : '—';
  const sonTarihGorunum = sonTarihISO ? formatTarihKisa(sonTarihISO) : '—';

  function tahminiAdetIcinOzet(insName, dk) {
    const perfObj = performansData.find(p => (p.ins||'').toLowerCase() === (insName||'').toLowerCase());
    if (!perfObj) return null;
    const hiz = getSaatlikAdetHizi(perfObj);
    if (!hiz) return null;
    return Math.round(hiz * (dk/60));
  }
  let toplamAdet = 0, adetVarMi = false;
  kayipZamanData.forEach(r => {
    const a = tahminiAdetIcinOzet(r.inspector, r.sureDk);
    if (a !== null) { toplamAdet += a; adetVarMi = true; }
  });

  const tarihBarHtml = toplamKayit > 0 ? `
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#fff;border:1px solid var(--border2);border-radius:10px;padding:11px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:7px">
        <span style="font-size:14px">📅</span>
        <span style="font-size:11.5px;color:var(--muted);font-weight:600">İlk Kayıt Tarihi:</span>
        <span style="font-size:12.5px;color:var(--navy);font-weight:700;font-family:'DM Mono',monospace">${ilkTarihGorunum}</span>
      </div>
      <span style="color:var(--border2)">|</span>
      <div style="display:flex;align-items:center;gap:7px">
        <span style="font-size:11.5px;color:var(--muted);font-weight:600">Son Kayıt Tarihi:</span>
        <span style="font-size:12.5px;color:var(--navy);font-weight:700;font-family:'DM Mono',monospace">${sonTarihGorunum}</span>
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="summary-stat" style="border-color:#EF9A9A;background:linear-gradient(135deg,#FFEBEE 0%,#fff 100%)">
      <div class="summary-stat-value" style="color:#C62828">${toplamKayit}</div>
      <div class="summary-stat-label">Toplam Kayıt</div>
    </div>
    <div class="summary-stat" style="border-color:#FFCC80;background:linear-gradient(135deg,#FFF3E0 0%,#fff 100%)">
      <div class="summary-stat-value" style="color:var(--amber)">${(toplamDk/60).toFixed(1)}s</div>
      <div class="summary-stat-label">Toplam Kayıp Süre</div>
    </div>
    <div class="summary-stat" style="border-color:var(--lblue);background:linear-gradient(135deg,var(--lblue3) 0%,#fff 100%)">
      <div class="summary-stat-value" style="color:var(--blue2)">${inspSayisi}</div>
      <div class="summary-stat-label">Etkilenen Inspector</div>
    </div>
    <div class="summary-stat" style="border-color:#A5D6A7;background:linear-gradient(135deg,#E8F5E9 0%,#fff 100%)">
      <div class="summary-stat-value" style="color:#2E7D32">${adetVarMi ? '~'+formatTR(toplamAdet) : '—'}</div>
      <div class="summary-stat-label">Tahmini Kayıp Adet</div>
    </div>`;

  const tarihBarContainer = document.getElementById('kz-tarih-ozet-bar');
  if (tarihBarContainer) tarihBarContainer.innerHTML = tarihBarHtml;

  renderKayipZamanSebepOzetKartlari();
}

// formatTarihKisa'nin YYYY-MM-DD string'e cevirebilen versiyonu - siralama icin guvenilir
function formatTarihKisaISO(tarih) {
  if (!tarih) return '';
  const s = String(tarih);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    const d = new Date(s);
    if (!isNaN(d)) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch(e) {}
  return '';
}

// ─── Sebep Bazında Özet Kartları + Çubuk Grafik (ana sayfada, rapor estetiğiyle) ───
function renderKayipZamanSebepOzetKartlari() {
  const wrap = document.getElementById('kz-sebep-ozet-wrap');
  if (!wrap) return;

  if (!kayipZamanData.length) { wrap.innerHTML = ''; return; }

  function tahminiAdetIcinSebep(insName, dk) {
    const perfObj = performansData.find(p => (p.ins||'').toLowerCase() === (insName||'').toLowerCase());
    if (!perfObj) return null;
    const hiz = getSaatlikAdetHizi(perfObj);
    if (!hiz) return null;
    return Math.round(hiz * (dk/60));
  }

  const sebepMap = {};
  kayipZamanData.forEach(r => {
    const s = r.sebep || 'Diğer';
    if (!sebepMap[s]) sebepMap[s] = { dk: 0, insSet: new Set(), kayit: 0, adet: 0, adetVarMi: false };
    sebepMap[s].dk += r.sureDk || 0;
    sebepMap[s].insSet.add(r.inspector || '');
    sebepMap[s].kayit += 1;
    const a = tahminiAdetIcinSebep(r.inspector, r.sureDk);
    if (a !== null) { sebepMap[s].adet += a; sebepMap[s].adetVarMi = true; }
  });
  const sebepSirali = Object.entries(sebepMap).sort((a,b)=>b[1].dk - a[1].dk);
  const maxDk = sebepSirali.length ? sebepSirali[0][1].dk : 1;

  const sebepKartHtml = sebepSirali.map(([s, d]) => `
    <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:18px 20px">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
        <span style="font-size:24px;line-height:1">${SEBEP_IKONLAR[s]||'📝'}</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--navy)">${_escapeHtml(s)}</div>
          <div style="font-size:10.5px;color:var(--muted2);margin-top:2px">${d.kayit} kayıt · ${d.insSet.size} inspector</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div style="text-align:center;background:var(--offwhite);border-radius:9px;padding:9px 4px">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--red)">${(d.dk/60).toFixed(1)}s</div>
          <div style="font-size:8px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px">Bekleme Saati</div>
        </div>
        <div style="text-align:center;background:var(--offwhite);border-radius:9px;padding:9px 4px">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--navy)">${d.adetVarMi ? '~'+formatTR(d.adet) : '—'}</div>
          <div style="font-size:8px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px">Tah. Kayıp Adet</div>
        </div>
        <div style="text-align:center;background:var(--offwhite);border-radius:9px;padding:9px 4px">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--navy)">${d.insSet.size}</div>
          <div style="font-size:8px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px">Inspector</div>
        </div>
      </div>
    </div>`).join('');

  const barRenkler = ['linear-gradient(90deg,#1565C0,#42A5F5)','linear-gradient(90deg,#E65100,#FFA726)','linear-gradient(90deg,#6A1B9A,#AB47BC)','linear-gradient(90deg,#2E7D32,#66BB6A)'];
  const barHtml = sebepSirali.map(([s,d], i) => {
    const pct = Math.max(8, Math.round((d.dk / maxDk) * 100));
    return `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:${i === sebepSirali.length-1 ? 0 : 16}px">
      <div style="width:170px;font-size:12px;font-weight:600;color:var(--navy);flex-shrink:0">${SEBEP_IKONLAR[s]||'📝'} ${_escapeHtml(s)}</div>
      <div style="flex:1;height:22px;background:var(--offwhite);border-radius:6px;overflow:hidden;position:relative">
        <div style="height:100%;border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;width:${pct}%;background:${barRenkler[i%barRenkler.length]}">
          <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:#fff">${(d.dk/60).toFixed(1)}s</span>
        </div>
      </div>
      <div style="width:70px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);flex-shrink:0">${d.dk} dk</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div style="font-size:14px;font-weight:700;color:var(--navy);margin:4px 0 14px;display:flex;align-items:center;gap:8px">
      📦 Sebep Bazında Özet <span style="background:var(--lblue3);color:var(--blue2);font-size:10px;font-weight:700;padding:2px 9px;border-radius:99px">${sebepSirali.length} sebep</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px">
      ${sebepKartHtml}
    </div>
    <div style="font-size:14px;font-weight:700;color:var(--navy);margin:0 0 14px">📊 Sebep Bazında Bekleme Saati Dağılımı</div>
    <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:22px 24px;margin-bottom:20px">
      ${barHtml}
    </div>`;
}

// ─── Detaylı Inspector Tablosu: sebep özet kutular + tarih aralığı ───
let _kzStartDate = '', _kzEndDate = '';

let _kzDetayAcik = {}; // hangi inspector satiri acik
let _kzDetayPage = 1;
const KZ_DETAY_PAGE_SIZE = 20;

function renderKayipZamanDetayliTablo() {
  const container = document.getElementById('kz-admin-perf-table');
  if (!container) return;

  if (!kayipZamanData.length) {
    container.innerHTML = `<div style="padding:30px;text-align:center;color:var(--muted)">Henüz kayıp zaman kaydı yok</div>`;
    return;
  }

  // Filtreler
  let filtered = [...kayipZamanData];
  if (_kzStartDate) filtered = filtered.filter(r => formatTarihKisa(r.tarih) >= _kzStartDate);
  if (_kzEndDate)   filtered = filtered.filter(r => formatTarihKisa(r.tarih) <= _kzEndDate);
  if (_kzDepo)      filtered = filtered.filter(r => r.depo === _kzDepo);
  const fEkip  = document.getElementById('kz-admin-filter-ekip')?.value  || '';
  const fInsp  = document.getElementById('kz-admin-filter-inspector')?.value || '';
  const fSebep = document.getElementById('kz-admin-filter-sebep')?.value || '';
  if (fEkip)  filtered = filtered.filter(r => r.ekipYoneticisi === fEkip);
  if (fInsp)  filtered = filtered.filter(r => r.inspector === fInsp);
  if (fSebep) filtered = filtered.filter(r => r.sebep === fSebep);

  // Sebep ozet kutular (top 4) - etkilenen inspectorler ve kisi bazinda sure dahil
  const sebepMap = {};
  const sebepInspDk = {}; // {sebep: {inspectorAdi: toplamDk}}
  filtered.forEach(r => {
    const s = r.sebep || 'Diğer';
    sebepMap[s] = (sebepMap[s]||0) + (r.sureDk||0);
    if (!sebepInspDk[s]) sebepInspDk[s] = {};
    const insKey = r.inspector || '';
    sebepInspDk[s][insKey] = (sebepInspDk[s][insKey]||0) + (r.sureDk||0);
  });
  const topSebepler = Object.entries(sebepMap).sort((a,b)=>b[1]-a[1]).slice(0,4);
  // Sebep -> inspector dakika haritasini global degiskende sakla (popup icin)
  window._kzSebepInspDk = sebepInspDk;

  // Tahmini kayip adet hesabi: her inspector'in kendi saatlik hizina gore
  function tahminiAdet(insName, dk) {
    const perfObj = performansData.find(p=>(p.ins||'').toLowerCase()===(insName||'').toLowerCase());
    if (!perfObj) return null;
    const hiz = getSaatlikAdetHizi(perfObj); // adet/saat
    if (!hiz) return null;
    return Math.round(hiz * (dk/60));
  }

  const sebepKartlar = topSebepler.map(([s,dk]) => {
    const insMap = sebepInspDk[s] || {};
    const insEntries = Object.entries(insMap).sort((a,b)=>b[1]-a[1]);
    const insCount = insEntries.length;
    const TOP_N = 3;
    const gosterilenler = insEntries.slice(0, TOP_N);
    const kalanSayisi = insEntries.length - TOP_N;

    // Bu sebebin toplam tahmini kayip adedi (tum inspectorler)
    let toplamTahminiAdet = 0;
    let adetHesaplanabildi = false;
    insEntries.forEach(([n,d]) => {
      const a = tahminiAdet(n,d);
      if (a !== null) { toplamTahminiAdet += a; adetHesaplanabildi = true; }
    });

    return `
    <div class="kz-sebep-card" onclick="showSebepInspectorDetay('${s.replace(/'/g,"\'")}')">
      <div class="kz-sebep-card-top">
        <span class="kz-sebep-icon">${SEBEP_IKONLAR[s]||'📝'}</span>
        <div>
          <div class="kz-sebep-name">${_escapeHtml(s)}</div>
          <div class="kz-sebep-sub">${insCount} inspector etkilendi · tıkla, detayı gör</div>
        </div>
      </div>
      <div class="kz-sebep-stats">
        <div class="kz-sebep-stat hilite">
          <div class="v">${(dk/60).toFixed(1)}s</div>
          <div class="l">Bekleme Saati</div>
        </div>
        <div class="kz-sebep-stat">
          <div class="v">${adetHesaplanabildi ? '~'+formatTR(toplamTahminiAdet) : '—'}</div>
          <div class="l">Tah. Kayıp Adet</div>
        </div>
        <div class="kz-sebep-stat">
          <div class="v">${insCount}</div>
          <div class="l">Inspector</div>
        </div>
      </div>
      <div class="kz-sebep-list">
        ${gosterilenler.map(([n,d])=>{
          const a = tahminiAdet(n,d);
          return `<div class="kz-sebep-list-row">
            <span class="kz-sebep-list-name">${_escapeHtml(_formatDisplayName(n))}</span>
            <span class="kz-sebep-list-val">${(d/60).toFixed(1)}s${a!==null?` <span class="kz-sebep-list-adet">(~${a} ad.)</span>`:''}</span>
          </div>`;
        }).join('')}
        ${kalanSayisi > 0 ? `<div class="kz-sebep-more">+${kalanSayisi} kişi daha (tıkla)</div>` : ''}
      </div>
    </div>`;
  }).join('');

  // Inspector bazinda grupla
  const inspMap = {};
  filtered.forEach(r => {
    const k = (r.inspector||'').toLowerCase();
    if (!inspMap[k]) inspMap[k] = { isim: r.inspector, ekip: r.ekipYoneticisi||'', dk: 0, kayitlar: [] };
    inspMap[k].dk += r.sureDk||0;
    inspMap[k].kayitlar.push(r);
  });

  // Inspector satirlari - sadece ozet, tiklayinca detay acilir
  const inspEntriesAll = Object.values(inspMap).sort((a,b)=>b.dk-a.dk);
  const kzTotalPages = Math.max(1, Math.ceil(inspEntriesAll.length / KZ_DETAY_PAGE_SIZE));
  if (_kzDetayPage > kzTotalPages) _kzDetayPage = kzTotalPages;
  if (_kzDetayPage < 1) _kzDetayPage = 1;
  const inspEntriesPage = inspEntriesAll.slice((_kzDetayPage-1)*KZ_DETAY_PAGE_SIZE, _kzDetayPage*KZ_DETAY_PAGE_SIZE);

  const inspRows = inspEntriesPage.map(({isim, ekip, dk, kayitlar: ks}, idx) => {
    const rowId = 'kzd_' + idx;
    const isOpen = _kzDetayAcik[isim] === true;
    const perfObj = performansData.find(p=>(p.ins||'').toLowerCase()===(isim||'').toLowerCase());
    const perf = perfObj ? getOrijinalHamPerf(perfObj) : null;
    const perfSpan = perf !== null
      ? `<span class="${getPerformanceClass(perf)}" style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700">${perf}%</span>
         <span style="background:#FFF3E0;color:#E65100;border:1px solid #FFCC80;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:600;margin-left:6px">⏸ ${(dk/60).toFixed(1)}s değ.dışı</span>`
      : `<span style="color:var(--muted)">—</span>`;

    // Detay satirlari (gizli, tiklayinca acilir)
    const detayHtml = ks.map(r=>`
      <tr style="background:#fafafa;border-bottom:1px solid #f0f0f0">
        <td style="padding:6px 14px 6px 24px;font-size:11px;color:var(--muted);font-family:'DM Mono',monospace">${formatTarihKisa(r.tarih)} ${r.gun?'('+r.gun+')':''}</td>
        <td style="padding:6px 14px;font-size:11px;color:var(--muted)">${_escapeHtml(r.ekipYoneticisi||'')}</td>
        <td style="padding:6px 14px;font-size:11px;font-family:'DM Mono',monospace">${(r.baslangic||'').substring(0,5)} – ${(r.bitis||'').substring(0,5)}</td>
        <td style="padding:6px 14px;text-align:center"><span style="background:#FFEBEE;color:#C62828;border-radius:5px;padding:1px 7px;font-size:11px;font-weight:600">${(r.sureDk/60).toFixed(1)}s</span></td>
        <td style="padding:6px 14px"><span style="background:var(--lblue3);color:var(--blue2);border-radius:5px;padding:1px 7px;font-size:11px">${SEBEP_IKONLAR[r.sebep]||'📝'} ${_escapeHtml(r.sebep||'')}</span></td>
        <td style="padding:6px 14px;font-size:11px;color:var(--muted)">${r.depo ? '🏭 '+_escapeHtml(r.depo) : ''}</td>
        <td style="padding:6px 14px;font-size:11px;color:var(--muted)">${_escapeHtml(r.aciklama||'')}</td>
      </tr>`).join('');

    return `
      <tr onclick="toggleKzDetay('${isim.replace(/'/g,"\\'")}')" style="border-bottom:1px solid var(--border2);cursor:pointer;transition:background .15s" onmouseover="this.style.background='#f8f9ff'" onmouseout="this.style.background=''">
        <td style="padding:11px 14px;font-weight:700;color:var(--navy)">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="color:var(--muted);font-size:11px;transition:transform .2s;display:inline-block;transform:rotate(${isOpen?'90':'0'}deg)">▶</span>
            ${_escapeHtml(_formatDisplayName(isim))}
          </div>
        </td>
        <td style="padding:11px 14px">${perfSpan}</td>
        <td style="padding:11px 14px;text-align:center"><span style="background:#FFEBEE;color:#C62828;border-radius:7px;padding:4px 10px;font-size:13px;font-weight:700;font-family:'DM Mono',monospace">${(dk/60).toFixed(1)}s</span></td>
        <td style="padding:11px 14px;font-size:11px;color:var(--muted)">${ks.length} kayıt</td>
      </tr>
      <tr id="${rowId}_detail" style="display:${isOpen?'table-row':'none'}">
        <td colspan="4" style="padding:0">
          <table style="width:100%;border-collapse:collapse">
            <tbody>${detayHtml}</tbody>
          </table>
        </td>
      </tr>`;
  }).join('');

  const tableHtml = inspRows
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f0f4ff;border-bottom:2px solid var(--border2)">
          <th style="padding:10px 14px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Inspector <span style="font-weight:400;opacity:.6">(detay için tıkla)</span></th>
          <th style="padding:10px 14px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Performans & Kayıp Notu</th>
          <th style="padding:10px 14px;text-align:center;font-size:10px;color:#C62828;text-transform:uppercase;letter-spacing:.4px;width:100px">Toplam Kayıp</th>
          <th style="padding:10px 14px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;width:80px">Kayıt</th>
        </tr></thead>
        <tbody>${inspRows}</tbody>
      </table>
      ${kzTotalPages > 1 ? `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 4px 4px;flex-wrap:wrap;gap:8px;border-top:1px solid var(--border2);margin-top:4px">
        <span style="font-size:11.5px;color:var(--muted)">${(_kzDetayPage-1)*KZ_DETAY_PAGE_SIZE+1}–${Math.min(_kzDetayPage*KZ_DETAY_PAGE_SIZE, inspEntriesAll.length)} / ${inspEntriesAll.length} inspector</span>
        <div style="display:flex;gap:4px;align-items:center">
          <button onclick="_kzDetayPage--;renderKayipZamanDetayliTablo()" ${_kzDetayPage<=1?'disabled':''} style="padding:5px 11px;border-radius:6px;border:1px solid var(--border2);background:#fff;font-size:12px;cursor:${_kzDetayPage<=1?'default':'pointer'};color:${_kzDetayPage<=1?'var(--muted2)':'var(--navy)'};font-weight:600">‹ Önceki</button>
          <span style="font-size:12px;color:var(--navy);font-weight:700;padding:0 6px">${_kzDetayPage} / ${kzTotalPages}</span>
          <button onclick="_kzDetayPage++;renderKayipZamanDetayliTablo()" ${_kzDetayPage>=kzTotalPages?'disabled':''} style="padding:5px 11px;border-radius:6px;border:1px solid var(--border2);background:#fff;font-size:12px;cursor:${_kzDetayPage>=kzTotalPages?'default':'pointer'};color:${_kzDetayPage>=kzTotalPages?'var(--muted2)':'var(--navy)'};font-weight:600">Sonraki ›</button>
        </div>
      </div>` : ''}`
    : '<div style="padding:20px;text-align:center;color:var(--muted)">Seçilen aralıkta kayıt yok</div>';

  container.innerHTML = `
    <div class="kz-tarih-bar">
      <span class="kz-tarih-label">📅 Tarih Aralığı</span>
      <input type="date" id="kz-date-start" value="${_kzStartDate}" onchange="_kzStartDate=this.value;_kzDetayPage=1;renderKayipZamanDetayliTablo()" class="kz-date-input">
      <span class="kz-tarih-ayrac">—</span>
      <input type="date" id="kz-date-end" value="${_kzEndDate}" onchange="_kzEndDate=this.value;_kzDetayPage=1;renderKayipZamanDetayliTablo()" class="kz-date-input">
      ${(_kzStartDate||_kzEndDate)?`<button onclick="_kzStartDate='';_kzEndDate='';_kzDetayPage=1;renderKayipZamanDetayliTablo()" class="kz-tarih-temizle">✕ Temizle</button>`:''}
      <span class="kz-tarih-label" style="margin-left:14px">🏭 Depo</span>
      <select onchange="_kzDepo=this.value;_kzDetayPage=1;renderKayipZamanAdminAll()" style="padding:5px 10px;border:1.5px solid var(--border2);border-radius:7px;font-size:12px;background:#fff;color:var(--navy);cursor:pointer;min-width:145px">
        <option value="">Tüm Depolar</option>
        <option value="Esenyurt Depo">Esenyurt Depo</option>
        <option value="Titiz Depo">Titiz Depo</option>
        <option value="Eroğlu Depo">Eroğlu Depo</option>
        <option value="Yalova Depo">Yalova Depo</option>
        <option value="Aksaray Depo">Aksaray Depo</option>
        <option value="Silivri Depo">Silivri Depo</option>
        <option value="Yılmaz Depo">Yılmaz Depo</option>
      </select>
      ${_kzDepo?`<button onclick="_kzDepo='';_kzDetayPage=1;renderKayipZamanAdminAll()" class="kz-tarih-temizle">✕ Depo</button>`:''}
    </div>
    ${topSebepler.length ? `<div class="kz-sebep-grid">${sebepKartlar}</div>` : ''}
    ${tableHtml}`;
}

function toggleKzDetay(isim) {
  _kzDetayAcik[isim] = !_kzDetayAcik[isim];
  renderKayipZamanDetayliTablo();
}

function renderKayipZamanAdminListe() {
  const el       = document.getElementById('kz-admin-liste');
  const countEl  = document.getElementById('kz-admin-count');
  const pagEl    = document.getElementById('kz-admin-pagination');
  const toplamEl = document.getElementById('kz-admin-toplam');
  if (!el) return;

  // Dropdown'ları doldur (ilk seferinde)
  const ekipSel = document.getElementById('kz-admin-filter-ekip');
  const inspSel = document.getElementById('kz-admin-filter-inspector');
  if (ekipSel && ekipSel.options.length <= 1) {
    [...new Set(kayipZamanData.map(r=>r.ekipYoneticisi||''))].sort()
      .forEach(e=>{ const o=document.createElement('option'); o.value=e; o.textContent=e; ekipSel.appendChild(o); });
  }
  if (inspSel && inspSel.options.length <= 1) {
    [...new Set(kayipZamanData.map(r=>r.inspector||''))].sort()
      .forEach(i=>{ const o=document.createElement('option'); o.value=i; o.textContent=_formatDisplayName(i); inspSel.appendChild(o); });
  }

  // Filtrele
  const fEkip  = ekipSel?.value  || '';
  const fInsp  = inspSel?.value  || '';
  const fSebep = document.getElementById('kz-admin-filter-sebep')?.value || '';
  let records = [...kayipZamanData].reverse();
  if (fEkip)  records = records.filter(r => r.ekipYoneticisi === fEkip);
  if (fInsp)  records = records.filter(r => r.inspector === fInsp);
  if (fSebep) records = records.filter(r => r.sebep === fSebep);

  const total = records.length;
  if (countEl) countEl.textContent = total + ' kayıt';

  if (!total) {
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Kayıt bulunamadı</div>`;
    if (pagEl) pagEl.innerHTML = '';
    if (toplamEl) toplamEl.innerHTML = '';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / KZ_PAGE_SIZE));
  if (!window._kzAdminPage || window._kzAdminPage > totalPages) window._kzAdminPage = 1;
  const page = window._kzAdminPage;
  const pageRecs = records.slice((page-1)*KZ_PAGE_SIZE, page*KZ_PAGE_SIZE);

  const rows = pageRecs.map(r=>`
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:9px 12px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(r.inspector))}</td>
      <td style="padding:9px 12px;font-size:11px;color:var(--muted)">${_escapeHtml(r.ekipYoneticisi||'')}</td>
      <td style="padding:9px 12px;font-family:'DM Mono',monospace;color:var(--muted)">${formatTarihKisa(r.tarih)}</td>
      <td style="padding:9px 12px;color:var(--muted)">${r.gun||''}</td>
      <td style="padding:9px 12px;font-family:'DM Mono',monospace">${(r.baslangic||'').substring(0,5)} – ${(r.bitis||'').substring(0,5)}</td>
      <td style="padding:9px 12px;text-align:center"><span style="background:#FFEBEE;color:#C62828;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">${(r.sureDk/60).toFixed(1)}s</span></td>
      <td style="padding:9px 12px"><span style="background:var(--lblue3);color:var(--blue2);border-radius:6px;padding:2px 8px;font-size:11px">${SEBEP_IKONLAR[r.sebep]||'📝'} ${_escapeHtml(r.sebep||'')}</span></td>
      <td style="padding:9px 12px;color:var(--muted);font-size:11px">${r.depo ? '<span style="background:#E8F5E9;color:#2E7D32;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">🏭 '+_escapeHtml(r.depo)+'</span>' : ''}</td>
      <td style="padding:9px 12px;color:var(--muted);font-size:11px">${_escapeHtml(r.aciklama||'')}</td>
    </tr>`).join('');

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f9fa;border-bottom:2px solid var(--border2)">
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Inspector</th>
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Ekip Yön.</th>
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Tarih</th>
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Gün</th>
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Saat Aralığı</th>
        <th style="padding:9px 12px;text-align:center;font-size:10px;color:#C62828;text-transform:uppercase;letter-spacing:.4px">Süre</th>
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Sebep</th>
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Açıklama</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Sayfalama
  if (pagEl) {
    if (totalPages > 1) {
      const btnS = a => `style="padding:5px 11px;border-radius:6px;border:1px solid var(--border2);background:${a?'var(--navy)':'#fff'};color:${a?'#fff':'var(--navy)'};font-size:12px;cursor:pointer;font-weight:600"`;
      let btns = '';
      for (let i=1;i<=totalPages;i++) btns += `<button ${btnS(i===page)} onclick="window._kzAdminPage=${i};renderKayipZamanAdminListe()">${i}</button>`;
      pagEl.innerHTML = `
        <div style="font-size:12px;color:var(--muted)">${(page-1)*KZ_PAGE_SIZE+1}–${Math.min(page*KZ_PAGE_SIZE,total)} / ${total} kayıt</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${btns}</div>`;
    } else { pagEl.innerHTML = ''; }
  }

  // Toplam
  if (toplamEl) {
    const so = {};
    records.forEach(r=>{ const s=r.sebep||'Diğer'; so[s]=(so[s]||0)+(r.sureDk||0); });
    const toplamDk = records.reduce((s,r)=>s+(r.sureDk||0),0);
    const badges = Object.entries(so).sort((a,b)=>b[1]-a[1])
      .map(([s,dk])=>`<span style="background:var(--lblue3);color:var(--blue2);border-radius:5px;padding:2px 9px;font-size:11px;margin-right:4px">${SEBEP_IKONLAR[s]||'📝'} ${_escapeHtml(s)}: <b>${(dk/60).toFixed(1)}s</b></span>`)
      .join('');
    toplamEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:10px;border-top:1px solid var(--border2)">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap"><span style="font-weight:600;color:var(--muted);font-size:12px;margin-right:4px">Toplam:</span>${badges}</div>
        <span style="background:#FFEBEE;color:#C62828;border-radius:6px;padding:4px 12px;font-family:'DM Mono',monospace;font-size:13px;font-weight:700">⏸ ${(toplamDk/60).toFixed(1)} saat</span>
      </div>`;
  }
}

// ─── Kayıp Zaman: Rapor Görünümü (admin sayfasında, modal içinde) ───
function showKayipZamanRaporGorunumu() {
  const overlay = document.getElementById('kz-rapor-overlay');
  const content = document.getElementById('kz-rapor-content');
  if (!overlay || !content) return;

  // Aktif filtreleri uygula (tarih aralığı + ekip/inspector/sebep dropdown'ları, eğer sayfada açıksa)
  let records = [...kayipZamanData];
  if (_kzStartDate) records = records.filter(r => formatTarihKisa(r.tarih) >= _kzStartDate);
  if (_kzEndDate)   records = records.filter(r => formatTarihKisa(r.tarih) <= _kzEndDate);
  if (_kzDepo)      records = records.filter(r => r.depo === _kzDepo);
  const fEkip  = document.getElementById('kz-admin-filter-ekip')?.value  || '';
  const fInsp  = document.getElementById('kz-admin-filter-inspector')?.value || '';
  const fSebep = document.getElementById('kz-admin-filter-sebep')?.value || '';
  if (fEkip)  records = records.filter(r => r.ekipYoneticisi === fEkip);
  if (fInsp)  records = records.filter(r => r.inspector === fInsp);
  if (fSebep) records = records.filter(r => r.sebep === fSebep);

  if (!records.length) {
    content.innerHTML = `<div style="padding:60px 24px;text-align:center;color:var(--muted)">
      <div style="font-size:32px;margin-bottom:10px">📭</div>
      Seçilen filtrelerle eşleşen kayıp zaman kaydı yok.
    </div>`;
    overlay.style.display = 'flex';
    return;
  }

  // Tahmini adet hesabı (her inspector'ın kendi hızına göre)
  function tahminiAdetIcin(insName, dk) {
    const perfObj = performansData.find(p => (p.ins||'').toLowerCase() === (insName||'').toLowerCase());
    if (!perfObj) return null;
    const hiz = getSaatlikAdetHizi(perfObj);
    if (!hiz) return null;
    return Math.round(hiz * (dk/60));
  }

  const toplamDk = records.reduce((s,r)=>s+(r.sureDk||0),0);
  const toplamInsp = new Set(records.map(r=>(r.inspector||'').toLowerCase())).size;
  let toplamAdetGenel = 0, adetVarMiGenel = false;
  records.forEach(r => { const a = tahminiAdetIcin(r.inspector, r.sureDk); if (a!==null) { toplamAdetGenel += a; adetVarMiGenel = true; } });

  // Sebep bazında grupla
  const sebepMap = {};
  records.forEach(r => {
    const s = r.sebep || 'Diğer';
    if (!sebepMap[s]) sebepMap[s] = { dk: 0, insSet: new Set(), kayit: 0, adet: 0, adetVarMi: false };
    sebepMap[s].dk += r.sureDk || 0;
    sebepMap[s].insSet.add(r.inspector || '');
    sebepMap[s].kayit += 1;
    const a = tahminiAdetIcin(r.inspector, r.sureDk);
    if (a !== null) { sebepMap[s].adet += a; sebepMap[s].adetVarMi = true; }
  });
  const sebepSirali = Object.entries(sebepMap).sort((a,b)=>b[1].dk - a[1].dk);
  const maxDk = sebepSirali.length ? sebepSirali[0][1].dk : 1;

  // Tarih aralığı metni: filtre varsa onu goster, yoksa gercek veri aralığını (ilk-son kayit) goster
  let tarihMetni;
  if (_kzStartDate || _kzEndDate) {
    tarihMetni = `${_kzStartDate ? formatTarihKisa(_kzStartDate) : 'başlangıç'} – ${_kzEndDate ? formatTarihKisa(_kzEndDate) : 'bugün'}`;
  } else {
    const tarihler = records.map(r => formatTarihKisaISO(r.tarih)).filter(Boolean).sort();
    if (tarihler.length) {
      const ilk = formatTarihKisa(tarihler[0]);
      const son = formatTarihKisa(tarihler[tarihler.length-1]);
      tarihMetni = ilk === son ? ilk : `${ilk} – ${son}`;
    } else {
      tarihMetni = new Date().toLocaleDateString('tr-TR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }
  }

  // ── Sebep özet kartları ──
  const sebepKartHtml = sebepSirali.map(([s, d]) => `
    <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:18px 20px">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
        <span style="font-size:24px;line-height:1">${SEBEP_IKONLAR[s]||'📝'}</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--navy)">${_escapeHtml(s)}</div>
          <div style="font-size:10.5px;color:var(--muted2);margin-top:2px">${d.kayit} kayıt · ${d.insSet.size} inspector</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div style="text-align:center;background:var(--offwhite);border-radius:9px;padding:9px 4px">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--red)">${(d.dk/60).toFixed(1)}s</div>
          <div style="font-size:8px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px">Bekleme Saati</div>
        </div>
        <div style="text-align:center;background:var(--offwhite);border-radius:9px;padding:9px 4px">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--navy)">${d.adetVarMi ? '~'+formatTR(d.adet) : '—'}</div>
          <div style="font-size:8px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px">Tah. Kayıp Adet</div>
        </div>
        <div style="text-align:center;background:var(--offwhite);border-radius:9px;padding:9px 4px">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--navy)">${d.insSet.size}</div>
          <div style="font-size:8px;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px">Inspector</div>
        </div>
      </div>
    </div>`).join('');

  // ── Çubuk grafik ──
  const barRenkler = ['linear-gradient(90deg,#1565C0,#42A5F5)','linear-gradient(90deg,#E65100,#FFA726)','linear-gradient(90deg,#6A1B9A,#AB47BC)','linear-gradient(90deg,#2E7D32,#66BB6A)'];
  const barHtml = sebepSirali.map(([s,d], i) => {
    const pct = Math.max(8, Math.round((d.dk / maxDk) * 100));
    return `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:${i === sebepSirali.length-1 ? 0 : 16}px">
      <div style="width:170px;font-size:12px;font-weight:600;color:var(--navy);flex-shrink:0">${SEBEP_IKONLAR[s]||'📝'} ${_escapeHtml(s)}</div>
      <div style="flex:1;height:22px;background:var(--offwhite);border-radius:6px;overflow:hidden;position:relative">
        <div style="height:100%;border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;width:${pct}%;background:${barRenkler[i%barRenkler.length]}">
          <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:#fff">${(d.dk/60).toFixed(1)}s</span>
        </div>
      </div>
      <div style="width:70px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);flex-shrink:0">${d.dk} dk</div>
    </div>`;
  }).join('');

  // ── Detaylı tablo (en fazla 100 satır gösterilir, performans için) ──
  const tabloKayitlari = [...records].sort((a,b)=>(b.sureDk||0)-(a.sureDk||0)).slice(0, 100);
  const tabloHtml = tabloKayitlari.map(r => {
    const a = tahminiAdetIcin(r.inspector, r.sureDk);
    return `
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:11px 16px;font-weight:700;color:var(--navy)">${_escapeHtml(_formatDisplayName(r.inspector))}</td>
      <td style="padding:11px 16px"><span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:6px;font-size:11.5px;font-weight:600;background:var(--lblue3);color:var(--blue2)">${SEBEP_IKONLAR[r.sebep]||'📝'} ${_escapeHtml(r.sebep||'')}</span></td>
      <td style="padding:11px 16px;text-align:center"><span style="display:inline-flex;padding:3px 10px;border-radius:6px;font-size:11.5px;font-weight:700;background:#FFEBEE;color:var(--red);font-family:'DM Mono',monospace">${(r.sureDk/60).toFixed(1)}s</span></td>
      <td style="padding:11px 16px;text-align:center"><span style="display:inline-flex;padding:3px 10px;border-radius:6px;font-size:11.5px;font-weight:700;background:#F3E5F5;color:#7B1FA2;font-family:'DM Mono',monospace">${a !== null ? '~'+a : '—'}</span></td>
    </tr>`;
  }).join('');

  const tabloNot = records.length > 100
    ? `<div style="padding:10px 16px;font-size:11px;color:var(--muted2);text-align:center;border-top:1px solid var(--border2)">İlk 100 kayıt gösteriliyor (toplam ${records.length} kayıt). Tüm veri için Excel dışa aktarımını kullanın.</div>`
    : '';

  content.innerHTML = `
    <div style="background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 100%);border-radius:14px 14px 0 0;padding:24px 28px;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <div>
        <h1 style="font-size:19px;font-weight:800;letter-spacing:-.3px;display:flex;align-items:center;gap:9px">⏸ Kayıp Zaman Raporu</h1>
        <p style="font-size:11.5px;color:rgba(255,255,255,.6);margin-top:5px">Inspection ekipleri — değerlendirme dışı tutulan süreler</p>
      </div>
      <div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 16px;font-size:11.5px;font-weight:600;text-align:right">
        Rapor Aralığı
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;display:block;margin-top:2px">${tarihMetni}</span>
      </div>
    </div>

    <div style="padding:24px 28px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">
        <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:18px;border-top:3px solid var(--red)">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:var(--navy)">${records.length}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:6px">Toplam Kayıt</div>
        </div>
        <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:18px;border-top:3px solid var(--amber)">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:var(--navy)">${(toplamDk/60).toFixed(1)}s</div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:6px">Toplam Kayıp Süre</div>
        </div>
        <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:18px;border-top:3px solid var(--blue)">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:var(--navy)">${toplamInsp}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:6px">Etkilenen Inspector</div>
        </div>
        <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:18px;border-top:3px solid var(--green)">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:var(--navy)">${adetVarMiGenel ? '~'+formatTR(toplamAdetGenel) : '—'}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:6px">Tahmini Kayıp Adet</div>
        </div>
      </div>

      <div style="font-size:14px;font-weight:700;color:var(--navy);margin:24px 0 14px;display:flex;align-items:center;gap:8px">
        📦 Sebep Bazında Özet <span style="background:var(--lblue3);color:var(--blue2);font-size:10px;font-weight:700;padding:2px 9px;border-radius:99px">${sebepSirali.length} sebep</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px">
        ${sebepKartHtml}
      </div>

      <div style="font-size:14px;font-weight:700;color:var(--navy);margin:24px 0 14px">📊 Sebep Bazında Bekleme Saati Dağılımı</div>
      <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;padding:22px 24px;margin-bottom:24px">
        ${barHtml}
      </div>

      <div style="font-size:14px;font-weight:700;color:var(--navy);margin:24px 0 14px">📋 Detaylı Kayıt Listesi</div>
      <div style="background:#fff;border:1px solid var(--border2);border-radius:14px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f0f4ff;border-bottom:2px solid var(--border2)">
            <th style="padding:11px 16px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700">Inspector</th>
            <th style="padding:11px 16px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700">Sebep</th>
            <th style="padding:11px 16px;text-align:center;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700">Bekleme Saati</th>
            <th style="padding:11px 16px;text-align:center;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700">Tahmini Kayıp Adet</th>
          </tr></thead>
          <tbody>${tabloHtml}</tbody>
        </table>
        ${tabloNot}
      </div>

      <div style="font-size:11px;color:var(--muted2);margin-top:18px;line-height:1.6;background:#fff;border:1px solid var(--border2);border-radius:10px;padding:14px 16px">
        <b style="color:var(--muted)">Not:</b> Tahmini Kayıp Adet, ilgili inspector'ın kendi gerçek ortalama hızına
        (toplam adet / mesai süresi) göre hesaplanmıştır. Performans verisi bulunmayan kayıtlarda "—" gösterilir.
        Bu değerler kesin değildir, büyüklük mertebesi vermek amacıyla sunulur.
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
}

function showKayipZamanSebepPopup() {
  const popup = document.getElementById('kz-sebep-popup');
  const content = document.getElementById('kz-sebep-popup-content');
  if (!popup || !content) return;

  const popup_title = popup.querySelector('.modal-title');
  if (popup_title) popup_title.textContent = '\u26a0\ufe0f Kay\u0131p Zaman \u2014 Sebep Özeti';

  const sebepMap = {};
  kayipZamanData.forEach(r => {
    const s = r.sebep || 'Diğer';
    sebepMap[s] = (sebepMap[s]||0) + (r.sureDk||0);
  });
  const sebepler = Object.entries(sebepMap).sort((a,b)=>b[1]-a[1]);
  const toplamDk = Object.values(sebepMap).reduce((s,v)=>s+v,0);
  const maxVal = sebepler[0]?.[1] || 1;

  if (!sebepler.length) {
    content.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted)">Kayıt bulunamadı</div>`;
  } else {
    content.innerHTML = sebepler.map(([sebep, dk]) => {
      const saat = (dk/60).toFixed(1);
      const yuzde = Math.round((dk/toplamDk)*100);
      const barW = Math.round((dk/maxVal)*100);
      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:13px;font-weight:600;color:var(--navy);display:flex;align-items:center;gap:6px">
              <span style="font-size:16px">${SEBEP_IKONLAR[sebep]||'📝'}</span>${_escapeHtml(sebep)}
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:#C62828">${saat}s <span style="font-size:11px;color:var(--muted);font-weight:400">(${yuzde}%)</span></div>
          </div>
          <div style="background:var(--offwhite);border-radius:6px;height:10px;overflow:hidden">
            <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,#E53935,#FF7043);border-radius:6px"></div>
          </div>
        </div>`;
    }).join('') + `
      <div style="border-top:1px solid var(--border2);padding-top:12px;margin-top:4px;display:flex;justify-content:space-between;font-size:13px">
        <span style="color:var(--muted)">Toplam</span>
        <span style="font-family:'DM Mono',monospace;font-weight:700;color:var(--navy)">${(toplamDk/60).toFixed(1)} Saat</span>
      </div>`;
  }
  popup.style.display = 'flex';
}

// ─── Tüm veriyi sil (şifre korumalı — kullanıcı talebiyle) ───
// Şifre PHP tarafında (kv_get/hardcoded) doğrulanır — burada hiçbir şifre
// saklanmaz veya karşılaştırılmaz, sadece kullanıcının girdiği değer olduğu
// gibi sunucuya gönderilir.
async function clearAllKayipZaman() {
  const sifre = prompt('⚠️ Kayıp Zaman Analizi verilerini SİLMEK için şifreyi girin:');
  if (sifre === null) return; // İptal edildi
  if (!sifre.trim()) { alert('Şifre boş olamaz.'); return; }
  if (!confirm('⚠️ Tüm kayıp zaman verileri silinecek!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?')) return;

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('Sheets bağlantısı yok.'); return; }
  const btn = document.getElementById('kz-clear-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Siliniyor...'; }
  try {
    const resp = await jsonpFetch(url, { action: 'clearKayipZaman', token, sifre });
    if (!resp || resp.status !== 'ok') {
      alert('❌ ' + (resp?.message || 'Şifre yanlış — veriler silinmedi.'));
      return;
    }
    kayipZamanData = [];
    _kzLastFetchTime = 0;
    saveKayipZamanToLocalStorage();
    renderKayipZamanAdminAll();
    updateKayipNavBadge();
    showSuccessMessage('✅ Kayıp zaman verileri silindi!');
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Temizle'; }
  }
}

// ─── Ekip Dashboard Grid ───
let _kzGridOpen = {};

function renderKayipZamanEkipGrid() {
  const grid = document.getElementById('kz-ekip-grid');
  if (!grid) return;
  if (!kayipZamanData.length) { grid.innerHTML = ''; return; }

  const ekipler = {};
  kayipZamanData.forEach(r => {
    const ey = r.ekipYoneticisi || 'Bilinmiyor';
    if (!ekipler[ey]) ekipler[ey] = [];
    ekipler[ey].push(r);
  });

  const perfColor = p => p >= 95 ? '#2E7D32' : p >= 85 ? '#1565C0' : p >= 70 ? '#E65100' : p >= 50 ? '#EF5350' : '#B71C1C';

  grid.innerHTML = Object.entries(ekipler)
    .sort(([a],[b]) => a.localeCompare(b,'tr'))
    .map(([ey, kayitlar], idx) => {
      const id = 'kzg_' + idx;
      const isOpen = _kzGridOpen[ey] === true; // default kapali
      const toplamDk = kayitlar.reduce((s,r)=>s+(r.sureDk||0),0);

      // Sebep ozeti
      const sebepMap = {};
      kayitlar.forEach(r => { const s=r.sebep||'Diger'; sebepMap[s]=(sebepMap[s]||0)+(r.sureDk||0); });
      const sebepRows = Object.entries(sebepMap).sort((a,b)=>b[1]-a[1])
        .map(([s,dk]) =>
          `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:12px;color:#444">${SEBEP_IKONLAR[s]||'📝'} ${_escapeHtml(s)}</span>
            <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#C62828">${(dk/60).toFixed(1)}s</span>
          </div>`
        ).join('');

      // Inspector ozeti
      const inspMap = {};
      kayitlar.forEach(r => {
        const k=(r.inspector||'').toLowerCase();
        if(!inspMap[k]) inspMap[k]={isim:r.inspector,dk:0};
        inspMap[k].dk+=r.sureDk||0;
      });

      const inspRows = Object.values(inspMap).sort((a,b)=>b.dk-a.dk).map(({isim,dk})=>{
        const perfObj = performansData.find(p=>(p.ins||'').toLowerCase()===(isim||'').toLowerCase());
        const perf = perfObj ? getOrijinalHamPerf(perfObj) : null;
        const perfSpan = perf !== null
          ? `<span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:${perfColor(perf)}">${perf}%</span>`
          : '';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f5f5">
            <span style="font-size:13px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(isim))}</span>
            <div style="display:flex;align-items:center;gap:8px">
              ${perfSpan}
              <span style="background:#FFF3E0;color:#E65100;border:1px solid #FFCC80;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:600;font-family:'DM Mono',monospace">⏸ ${(dk/60).toFixed(1)}s</span>
            </div>
          </div>`;
      }).join('');

      const eyId = ey.replace(/[^a-z0-9]/gi,'_');
      return `
        <div style="background:#fff;border:1px solid var(--border2);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
          <div onclick="toggleKzGrid('${ey.replace(/'/g,"\\'")}')" style="background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 100%);padding:14px 16px;cursor:pointer;user-select:none">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="color:#fff;font-weight:700;font-size:14px">👤 ${_escapeHtml(ey)}</div>
                <div style="color:rgba(255,255,255,.6);font-size:11px;margin-top:2px">${Object.keys(inspMap).length} inspector &middot; ${kayitlar.length} kayıt</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="background:#C62828;color:#fff;border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700;font-family:'DM Mono',monospace">⏸ ${(toplamDk/60).toFixed(1)}s</span>
                <span style="color:#fff;font-size:14px">${isOpen?'▲':'▼'}</span>
              </div>
            </div>
          </div>
          <div id="${id}_body" style="display:${isOpen?'block':'none'}">
            <div style="padding:12px 16px;background:#fafafa;border-bottom:1px solid var(--border2)">
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">KAYIP NEDENLERİ</div>
              ${sebepRows}
            </div>
            <div style="padding:12px 16px">
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">INSPECTOR PERFORMANS</div>
              ${inspRows}
            </div>
          </div>
        </div>`;
    }).join('');
}

function toggleKzGrid(ey) {
  _kzGridOpen[ey] = _kzGridOpen[ey] === false ? true : false;
  renderKayipZamanEkipGrid();
}




// ─── Excel Export (filtreli) ───
function exportKayipZamanExcel() {
  // Aktif filtreleri uygula
  let records = [...kayipZamanData];
  const fEkip  = document.getElementById('kz-admin-filter-ekip')?.value  || '';
  const fInsp  = document.getElementById('kz-admin-filter-inspector')?.value || '';
  const fSebep = document.getElementById('kz-admin-filter-sebep')?.value || '';
  if (_kzStartDate) records = records.filter(r => formatTarihKisa(r.tarih) >= _kzStartDate);
  if (_kzEndDate)   records = records.filter(r => formatTarihKisa(r.tarih) <= _kzEndDate);
  if (_kzDepo)      records = records.filter(r => r.depo === _kzDepo);
  if (fEkip)  records = records.filter(r => r.ekipYoneticisi === fEkip);
  if (fInsp)  records = records.filter(r => r.inspector === fInsp);
  if (fSebep) records = records.filter(r => r.sebep === fSebep);

  _kayipZamanExcelIndirOlustur(records);
}

// ─── Ekip Yöneticisi için Kayıp Zaman Excel İndirme ───
// Admin'deki exportKayipZamanExcel() ile aynı çıktı formatını üretir, ANCAK
// veri SADECE giriş yapan ekip yöneticisinin kendi ekibiyle (ekipYoneticisi
// === currentUser.username) sınırlıdır — başka ekiplerin verisi asla dahil
// edilmez. "Girilen Kayıp Zamanlar" listesindeki aktif Inspector/Sebep
// filtreleri de (varsa) aynen uygulanır, böylece ekranda gördüğü tabloyla
// indirdiği Excel birebir örtüşür.
function exportKayipZamanExcelEkip() {
  const username = currentUser?.username || '';
  let records = kayipZamanData.filter(r => r.ekipYoneticisi === username);

  const filterIns   = document.getElementById('kz-filter-inspector')?.value || '';
  const filterSebep = document.getElementById('kz-filter-sebep')?.value || '';
  if (filterIns)   records = records.filter(r => r.inspector === filterIns);
  if (filterSebep) records = records.filter(r => r.sebep === filterSebep);

  _kayipZamanExcelIndirOlustur(records);
}

// ─── Ortak CSV oluşturma/indirme mantığı (admin ve ekip export'u tarafından paylaşılır) ───
function _kayipZamanExcelIndirOlustur(records) {
  if (!records.length) { alert('Dışa aktarılacak veri yok.'); return; }

  const BOM = '\uFEFF';
  const headers = ['Ekip Yöneticisi','Inspector','Tarih','Gün','Başlangıç','Bitiş','Süre (dk)','Süre (saat)','Sebep','Açıklama','Performans%','Kayıp Notu'];

  const rows = records.map(r => {
    const perfObj = performansData.find(p=>(p.ins||'').toLowerCase()===(r.inspector||'').toLowerCase());
    const perf = perfObj ? getOrijinalHamPerf(perfObj) : '';
    const kayipNotu = r.sureDk > 0 ? `${(r.sureDk/60).toFixed(1)}s değerlendirme dışı` : '';
    return [
      r.ekipYoneticisi||'',
      _formatDisplayName(r.inspector||''),
      formatTarihKisa(r.tarih),
      r.gun||'',
      (r.baslangic||'').substring(0,5),
      (r.bitis||'').substring(0,5),
      r.sureDk||0,
      (r.sureDk/60).toFixed(2),
      r.sebep||'',
      r.aciklama||'',
      perf !== '' ? perf+'%' : '',
      kayipNotu
    ];
  });

  const csv = BOM + [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const tarihStr = _bugununTarihiYerel();
  a.href = url;
  a.download = `KayipZaman_${tarihStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ─── Sebep kutusuna tiklayinca tam inspector listesini goster ───
function showSebepInspectorDetay(sebep) {
  const popup = document.getElementById('kz-sebep-popup');
  const content = document.getElementById('kz-sebep-popup-content');
  if (!popup || !content) return;

  const insMap = (window._kzSebepInspDk && window._kzSebepInspDk[sebep]) || {};
  const insEntries = Object.entries(insMap).sort((a,b)=>b[1]-a[1]);
  const toplamDk = insEntries.reduce((s,[,d])=>s+d,0);

  const popup_title = popup.querySelector('.modal-title');
  if (popup_title) popup_title.textContent = `${SEBEP_IKONLAR[sebep]||'📝'} ${sebep} — Etkilenen Inspectörler`;

  if (!insEntries.length) {
    content.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted)">Kayıt bulunamadı</div>`;
  } else {
    let toplamTahminiAdet = 0;
    let adetVarMi = false;
    const rows = insEntries.map(([n,d]) => {
      const perfObj = performansData.find(p=>(p.ins||'').toLowerCase()===(n||'').toLowerCase());
      const hiz = perfObj ? getSaatlikAdetHizi(perfObj) : 0;
      const tahmin = hiz ? Math.round(hiz * (d/60)) : null;
      if (tahmin !== null) { toplamTahminiAdet += tahmin; adetVarMi = true; }
      return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
        <span style="font-size:13px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(n))}</span>
        <div style="text-align:right">
          <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:#C62828">${(d/60).toFixed(1)}s</span>
          ${tahmin!==null ? `<div style="font-size:10px;color:#8E24AA;font-weight:600">~${tahmin} adet</div>` : ''}
        </div>
      </div>`;
    }).join('');

    content.innerHTML = `
      <div style="max-height:340px;overflow-y:auto;margin-bottom:12px">${rows}</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;border-top:2px solid var(--border2);padding-top:10px">
        <span style="color:var(--muted)">Toplam (${insEntries.length} inspector)</span>
        <span style="font-family:'DM Mono',monospace;font-weight:700;color:var(--navy)">${(toplamDk/60).toFixed(1)} Saat</span>
      </div>
      ${adetVarMi ? `
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px">
        <span style="color:var(--muted)">Tahmini Kayıp Adet</span>
        <span style="font-family:'DM Mono',monospace;font-weight:700;color:#8E24AA">~${formatTR(toplamTahminiAdet)} adet</span>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;font-style:italic">* Kişinin kendi ortalama hızına göre tahmini hesaplanmıştır, kesin değil.</div>` : ''}`;
  }

  popup.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════════════════════
// TEKNİK İNCELEME — YENİ MODÜL (v5.11)
// Bu blok kendi içinde bağımsızdır; mevcut fonksiyonlara sadece 3 küçük "kanca"
// (hook) noktasından bağlanır: ASSIGNABLE_TABS, showPage() ve autoFetchOnStartup()
// içindeki eklemeler, ayrıca renderInspectorCards() ve exportToExcel() içindeki
// küçük ekler. Başka hiçbir mevcut fonksiyon değiştirilmedi.
// ══════════════════════════════════════════════════════════════════════════════

// Not: teknikKriterler / teknikSkorlar / TI_* sabitleri dosyanın en başında
// (GLOBAL STATE bölümünde) tanımlanır — bootstrap kodu (renderDashboard vb.)
// sayfa yüklenirken senkron çalıştığı için bu değişkenlerin daha erken hazır
// olması gerekiyor.

async function tiVarsayilanSorulariYukle() {
  if (teknikKriterler.length > 0) {
    if (!confirm('Mevcut kriter listesinin TAMAMI silinip yerine 100 puanlık resmi varsayılan soru seti yüklenecek ve otomatik kaydedilecek. Devam edilsin mi?')) return;
  }
  // ÖNEMLİ: Eskiden bu fonksiyon mevcut listenin ÜZERİNE ekliyordu (push).
  // Buton birden fazla kez tıklanırsa (ör. "Kriter Yönetimi" listesi görsel bir
  // hatadan dolayı boş göründüğü için tekrar tıklanınca) aynı 14/21 madde
  // MÜKERRER olarak birikiyordu. Artık listeyi önce TAMAMEN TEMİZLEYİP sonra
  // varsayılanları yüklüyor — tekrar tıklansa bile mükerrer oluşmaz.
  teknikKriterler = [];
  const now = Date.now();
  TI_DEFAULT_KRITERLER.forEach((k, i) => {
    teknikKriterler.push({ id: 'k_' + now + '_' + i, metin: k.metin, puan: k.puan, aktif: true, sira: i });
  });
  renderTiKriterYonetimList();
  // Unutulup kaybolmasın diye otomatik kaydet (ayrıca "Kriterleri Kaydet"e basmaya gerek yok)
  // Not: kaydetTeknikKriterler() kendi başarı mesajını zaten gösteriyor.
  await kaydetTeknikKriterler();
}

// ─── Mükerrer Kriterleri Temizle (aynı metne sahip satırlardan ilkini tutar) ───
// Yukarıdaki eski "üzerine ekleme" davranışından dolayı sistemde zaten
// birikmiş olabilecek mükerrer kriterleri tek tıkla temizlemek için.
async function tiMukerrerKriterleriTemizle() {
  const gorulen = new Set();
  const temiz = [];
  let silinen = 0;
  teknikKriterler.forEach(k => {
    const anahtar = String(k.metin || '').trim().toLocaleLowerCase('tr-TR');
    if (gorulen.has(anahtar)) { silinen++; return; }
    gorulen.add(anahtar);
    temiz.push(k);
  });
  if (silinen === 0) { alert('Mükerrer kriter bulunamadı — liste zaten temiz.'); return; }
  if (!confirm(`${silinen} adet mükerrer (aynı metne sahip) kriter bulundu ve silinecek. Devam edilsin mi?`)) return;
  teknikKriterler = temiz;
  renderTiKriterYonetimList();
  await kaydetTeknikKriterler();
  alert(`✅ ${silinen} mükerrer kriter silindi.`);
}

// ─── localStorage cache ───
function saveTeknikIncelemeToLocalStorage() {
  try {
    localStorage.setItem(TI_SKOR_LS_KEY, JSON.stringify({ skorlar: teknikSkorlar, savedAt: Date.now() }));
  } catch(e) { console.warn('Teknik İnceleme skor cache yazma hatası:', e); }
}
function loadTeknikIncelemeFromLocalStorage() {
  try {
    const raw = localStorage.getItem(TI_SKOR_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.skorlar)) teknikSkorlar = parsed.skorlar;
    }
  } catch(e) { console.warn('Teknik İnceleme skor cache okuma hatası:', e); }
}
function saveTeknikKriterToLocalStorage() {
  try {
    localStorage.setItem(TI_KRITER_LS_KEY, JSON.stringify({ kriterler: teknikKriterler, savedAt: Date.now() }));
  } catch(e) { console.warn('Teknik İnceleme kriter cache yazma hatası:', e); }
}
function loadTeknikKriterFromLocalStorage() {
  try {
    const raw = localStorage.getItem(TI_KRITER_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.kriterler)) teknikKriterler = parsed.kriterler;
    }
  } catch(e) { console.warn('Teknik İnceleme kriter cache okuma hatası:', e); }
}
// Sayfa ilk yüklenirken (login öncesi bile) cache'i belleğe al — dashboard kartları
// Teknik İnceleme sayfası hiç açılmamış olsa bile son bilinen skoru gösterebilsin.
// (Çağrılar dosyanın en başına taşındı — bkz. GLOBAL STATE bölümü.)

// ─── Skor Hesaplama (Dashboard kartları + Excel export tarafından da kullanılır) ───
// Model: Her kriterin sabit bir MAX puanı (ağırlığı) vardır. Değerlendiren kriteri
// tik'lerse o kriterin tam puanını kazanır, tik'lemezse 0 alır. Skor = tüm
// kayıtlardaki kazanılan puan toplamı / max puan toplamı * 100. Seviye etiketi
// mevcut 5 seviyeli skala (getPerformanceLevelLabel) ile birebir aynı eşikleri kullanır.
function getTeknikIncelemeSkorForInspector(inspectorName) {
  const nameNorm = String(inspectorName || '').toLowerCase().trim();
  const cevaplar = teknikSkorlar.filter(r => String(r.inspector || '').toLowerCase().trim() === nameNorm);
  if (!cevaplar.length) return { percent: 0, count: 0, seviye: '—' };
  let maxToplam = 0, kazanilanToplam = 0;
  cevaplar.forEach(r => {
    maxToplam += (Number(r.maxPuan) || 0);
    kazanilanToplam += (Number(r.kazanilanPuan) || 0);
  });
  if (maxToplam <= 0) return { percent: 0, count: 0, seviye: '—' };
  const percent = Math.round((kazanilanToplam / maxToplam) * 100);
  return { percent, count: cevaplar.length, seviye: getPerformanceLevelLabel(percent) };
}

// Bir inspector'ın (kendisi İkinci Inspection'a konu olan kişi, "değerlendiren"
// değil) İkinci Inspection kayıtlarındaki Geçti/Toplam oranını (%) döner.
// Kayıt yoksa null — "ne ödül ne ceza" ilkesiyle tutarlı, veri yoksa hiçbir
// yönde etki etmez.
function getIkinciInspectionOraniForInspector(inspectorName) {
  const nameNorm = String(inspectorName || '').toLowerCase().trim();
  const kayitlar = ikinciInspectionData.filter(r => String(r.inspector || '').toLowerCase().trim() === nameNorm);
  if (!kayitlar.length) return { percent: null, count: 0, geciSayisi: 0 };
  const geciSayisi = kayitlar.filter(r => r.sonuc === 'Geçti').length;
  const percent = Math.round((geciSayisi / kayitlar.length) * 100);
  return { percent, count: kayitlar.length, geciSayisi };
}

// ─── Sayfa Girişi ───
// İkinci Inspection formundaki Inspector ve Ekip Yöneticisi alanlarını
// sistemdeki mevcut isimlerden doldurur (kullanıcı talebiyle: elle yazmak
// yerine sistemden seçilsin).
async function fillIkinciInspectionDropdowns() {
  const insSel = document.getElementById('ii-inspector');
  if (insSel) {
    const prev = insSel.value;
    const isimler = performansData.map(i => i.ins).slice().sort((a,b) => a.localeCompare(b, 'tr'));
    insSel.innerHTML = '<option value="">— Inspector seçin —</option>' +
      isimler.map(ad => `<option value="${_escapeHtml(ad)}">${_escapeHtml(_formatDisplayName(ad))}</option>`).join('');
    if (prev && isimler.includes(prev)) insSel.value = prev;
  }

  const eySel = document.getElementById('ii-ekip-yoneticisi');
  if (eySel) {
    if (!_usersCache.length) await _silentLoadUsersCache();
    const prev = eySel.value;
    const isimler = _usersCache.map(u => u.username).slice().sort((a,b) => a.localeCompare(b, 'tr'));
    eySel.innerHTML = '<option value="">— Ekip yöneticisi seçin —</option>' +
      isimler.map(ad => `<option value="${_escapeHtml(ad)}">${_escapeHtml(_formatDisplayName(ad))}</option>`).join('');
    if (prev && isimler.includes(prev)) eySel.value = prev;
  }
}

async function loadTeknikInceleme() {
  const tarihEl = document.getElementById('ti-tarih');
  if (tarihEl && !tarihEl.value) tarihEl.value = _bugununTarihiYerel();
  const iiTarihEl = document.getElementById('ii-tarih');
  if (iiTarihEl && !iiTarihEl.value) iiTarihEl.value = _bugununTarihiYerel();

  // SADELEŞTİRİLMİŞ AKIŞ (kullanıcı talebiyle): Inspector listesi artık
  // tarihten TAMAMEN bağımsız — sayfa açılır açılmaz TÜM inspector'lar
  // gösterilir, hiçbir sunucu isteği beklenmez. Talep No da artık sunucudan
  // ÇEKİLMEZ — sadece elle girilen bir metin kutusudur. Bu, eski
  // "tarih seç → inspector listesinin yüklenmesini bekle → talep no
  // önerilerinin gelmesini bekle" akışındaki gecikmeyi ve karmaşıklığı
  // tamamen ortadan kaldırır.
  fillTeknikInspectorDropdown();
  fillIkinciInspectionDropdowns();

  const adminWrap = document.getElementById('ti-admin-wrap');
  const isAdmin = !currentUser || currentUser.isAdmin;
  // YETKİ DEĞİŞİKLİĞİ (kullanıcı talebiyle): "Kriter Yönetimi" hâlâ admin'e
  // özel (kriterleri/soruları tanımlamak hassas bir işlem) — ama "Tüm
  // Değerlendirme Kayıtları" ve yeni İkinci Inspection/Dashboard bölümleri
  // artık Teknik İnceleme'ye erişimi olan HERKES (Teknik Değerlendirme
  // Uzmanı) tarafından görülüp yönetilebiliyor, sadece admin değil.
  if (adminWrap) adminWrap.style.display = isAdmin ? '' : 'none';

  // "Temizle" butonu (toplu silme, birleşik) admin'e özel kalır — görüntüleme
  // ve kayıt ekleme herkese açık olsa da, tüm kayıtları silme yetkisi sadece
  // admin'de olmalı (kullanıcı talebiyle).
  const tiClearAllBtn = document.getElementById('ti-clear-all-btn');
  if (tiClearAllBtn) tiClearAllBtn.style.display = isAdmin ? '' : 'none';

  // Önbellekteki (localStorage) verilerle HEMEN çiz — ağ isteğini bekleme.
  renderTeknikKriterForm();
  renderTiSkorOzet();
  renderTiKayitlarTablo();
  renderIkinciInspectionTablo();
  renderTiDashboard();
  if (isAdmin) {
    renderTiKriterYonetimList();
  }

  await Promise.all([fetchTeknikKriterler(), fetchTeknikSkorlar(), fetchIkinciInspectionData(), fetchTeknikHedefler()]);

  renderTeknikKriterForm();
  renderTiSkorOzet();
  renderTiKayitlarTablo();
  renderIkinciInspectionTablo();
  renderTiDashboard();
  if (isAdmin) {
    renderTiKriterYonetimList();
  }
}

// names verilirse SADECE o isimlerle, verilmezse tüm performansData
// inspector'larıyla dropdown'u doldurur. Artık her zaman argümansız
// çağrılıyor (bkz. loadTeknikInceleme) — tarihe göre filtreleme kaldırıldı,
// inspector listesi HER HÂLÜKÂRDA tam gelir. Önceki seçim, yeni listede
// hâlâ varsa korunur.
function fillTeknikInspectorDropdown(names, placeholder) {
  const sel = document.getElementById('ti-inspector');
  if (!sel) return;
  const prev = sel.value;
  const tumListe = performansData.map(i => i.ins).slice().sort((a, b) => a.localeCompare(b, 'tr'));
  let list = Array.isArray(names) ? names.slice().sort((a, b) => a.localeCompare(b, 'tr')) : tumListe;
  if (list.length === 0) list = tumListe; // filtre sonucu boşsa tam listeye düş
  sel.innerHTML = '<option value="">' + (placeholder || '— Inspector seçin —') + '</option>';
  list.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = _formatDisplayName(name);
    sel.appendChild(opt);
  });
  sel.disabled = list.length === 0; // yalnızca sistemde hiç inspector kaydı yoksa kilitlenir
  if (prev && list.includes(prev)) sel.value = prev;
}

// Tarih veya Inspector değiştiğinde: önceki Talep No girişini ve kriter
// formunu sıfırlar (yeni bir değerlendirme bağlamına geçildiği için elle
// girilecek Talep No'nun eski değerde kalıp yanlış eşleşmesini önler).
// NOT: Bu fonksiyon artık sunucuya HİÇ istek atmıyor — Inspector listesi
// tarihten etkilenmiyor, Talep No tamamen elle giriliyor.
function onTiBaglamDegisti() {
  const talepInp = document.getElementById('ti-talep-secili');
  if (talepInp) talepInp.value = '';
  if (typeof renderTeknikKriterForm === 'function') renderTeknikKriterForm();
}

// ─── Kriterleri Çek ───
async function fetchTeknikKriterler() {
  if (SHEETS_DEVRE_DISI) return;
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) return;
  try {
    const data = await jsonpFetch(url, { action: 'getTeknikKriterler', token });
    if (data?.status === 'ok' && Array.isArray(data.kriterler)) {
      // Otomatik mükerrer temizliği: aynı metne sahip kriterlerden sadece
      // ilkini tut. Kök neden geçmişte düzeltildi ("Varsayılan Soruları Yükle"
      // artık listenin üzerine eklemek yerine önce temizliyor), ANCAK o
      // düzeltmeden ÖNCE zaten birikmiş mükerrer kayıtlar sunucuda kalmaya
      // devam ediyordu ve "Toplam Puan (Max: 200)" gibi yanlış toplamlara,
      // aynı 14/21 maddenin formda 2 kez görünmesine yol açıyordu. Bu blok,
      // veri her çekildiğinde otomatik olarak temizler ve mükerrer bulunursa
      // temiz listeyi hemen sunucuya geri yazar — kullanıcının bir buton
      // tıklamayı hatırlaması gerekmez, sorun kendiliğinden düzelir.
      const gorulen = new Set();
      const temiz = [];
      let mukerrerVarMi = false;
      data.kriterler.forEach(k => {
        const anahtar = String(k.metin || '').trim().toLocaleLowerCase('tr-TR');
        if (gorulen.has(anahtar)) { mukerrerVarMi = true; return; }
        gorulen.add(anahtar);
        temiz.push(k);
      });
      teknikKriterler = temiz;
      saveTeknikKriterToLocalStorage();
      if (mukerrerVarMi) {
        console.warn('Teknik İnceleme kriterlerinde mükerrer kayıt tespit edildi, otomatik temizlendi ve sunucuya geri kaydedildi.');
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'setTeknikKriterler', token, kriterler: teknikKriterler }),
            mode: 'no-cors'
          });
        } catch(saveErr) { console.warn('Mükerrer temizliği sunucuya kaydedilemedi:', saveErr.message); }
      }
    }
  } catch(e) { console.warn('Teknik İnceleme kriter çekme hatası:', e.message); }
}

// ─── Skorları Çek ───
async function fetchTeknikSkorlar() {
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) return;
  try {
    const data = await jsonpFetch(url, { action: 'getTeknikIncelemeSkorlar', token });
    if (data?.status === 'ok' && Array.isArray(data.skorlar)) {
      teknikSkorlar = data.skorlar;
      saveTeknikIncelemeToLocalStorage();
    }
  } catch(e) { console.warn('Teknik İnceleme skor çekme hatası:', e.message); }
}

// ─── Değerlendirme Formunu Çiz ───
// Not: Kriter listesi ve puanlar (teknikKriterler) burada değiştirilmez —
// sadece Talep No seçilene kadar formun görünmesi ertelenir.
function renderTeknikKriterForm() {
  const wrap = document.getElementById('ti-kriter-list');
  if (!wrap) return;

  const talepNo = document.getElementById('ti-talep-secili')?.value?.trim();
  if (!talepNo) {
    wrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">📦</div>
      <h3>Önce bir Talep No seçin</h3>
      <p>Kriterler, yukarıdan bir Talep No seçtikten sonra görünecek</p>
    </div>`;
    return;
  }

  const aktifler = teknikKriterler.filter(k => k.aktif);
  if (!aktifler.length) {
    wrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">📝</div>
      <h3>Henüz kriter tanımlanmamış</h3>
      <p>${(!currentUser || currentUser.isAdmin) ? 'Aşağıdaki "Kriter Yönetimi" bölümünden madde ekleyin' : 'Yönetici tarafından madde eklenmesi bekleniyor'}</p>
    </div>`;
    return;
  }
  const maxToplam = aktifler.reduce((s,k) => s + (Number(k.puan)||0), 0);
  wrap.innerHTML = `
    <div style="font-size:11px;color:var(--muted2);margin-bottom:4px">Maddeyi tikleyin = tam puan alınır · Tiklenmeyen madde 0 puan alır · Toplam maksimum puan: <strong>${maxToplam}</strong></div>
    ${aktifler.map(k => `
    <div class="ti-madde-row" data-kriter="${_escapeHtml(k.id)}" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--offwhite);border:1px solid var(--border2);border-radius:8px;flex-wrap:wrap">
      <input type="checkbox" class="ti-tik-cb" data-kriter="${_escapeHtml(k.id)}" style="width:20px;height:20px;margin-top:2px;cursor:pointer" title="Tikle = tam puan">
      <div style="flex:1;min-width:220px">
        <div style="font-size:13px;color:var(--navy);font-weight:500">${_escapeHtml(k.metin)}</div>
        <input type="text" class="ti-aciklama-input" data-kriter="${_escapeHtml(k.id)}" placeholder="Açıklama (opsiyonel)" style="margin-top:6px;width:100%;font-size:12px;padding:5px 8px">
      </div>
      <span style="font-size:12px;font-weight:700;color:var(--blue);background:var(--lblue3);border-radius:6px;padding:4px 9px;white-space:nowrap">${k.puan} puan</span>
    </div>
  `).join('')}`;
}



// ─── YAZDIR: Kriter metnindeki "6a.", "7b." gibi bileşik numaralandırmayı
// ayrıştırıp Excel'deki gibi grup başlığı + alt madde satırlarına böler.
// "6a. Ölçü Kontrolü - Talimatta belirtilen..." → grup "6" başlığı bir kez
// "Ölçü Kontrolü" olarak yazılır, alt maddeler sadece "a." + geri kalan metin
// olarak listelenir. Eşleşmeyen (düz "1." ya da admin'in eklediği serbest
// metin) maddeler tek satır olarak, olduğu gibi yazılır.
function _tiBuildYazdirRows(kList) {
  const rows = [];
  let currentGroupNo = null;
  kList.forEach((k, idx) => {
    const metin = String(k.metin || '');
    const bilesikM = metin.match(/^(\d+)\s*([a-zçğıöşü])\.\s*(.*)$/is);
    if (bilesikM) {
      const no = bilesikM[1], alt = bilesikM[2], rest = bilesikM[3];
      const dashIdx = rest.indexOf(' - ');
      let grupBaslik = '', aciklamaMetin = rest;
      if (dashIdx > -1) {
        grupBaslik = rest.slice(0, dashIdx).trim();
        aciklamaMetin = rest.slice(dashIdx + 3).trim();
      }
      if (no !== currentGroupNo) {
        currentGroupNo = no;
        rows.push({ type: 'group', no, label: grupBaslik || metin });
      }
      rows.push({ type: 'item', no: '', alt: alt + '.', desc: aciklamaMetin, puan: k.puan, tikli: k.tikli, aciklama: k.aciklama });
      return;
    }
    const duzM = metin.match(/^(\d+)\.\s*(.*)$/s);
    currentGroupNo = null;
    if (duzM) {
      rows.push({ type: 'item', no: duzM[1] + '.', alt: '', desc: duzM[2], puan: k.puan, tikli: k.tikli, aciklama: k.aciklama });
    } else {
      rows.push({ type: 'item', no: String(idx + 1) + '.', alt: '', desc: metin, puan: k.puan, tikli: k.tikli, aciklama: k.aciklama });
    }
  });
  return rows;
}

// ─── Değerlendirme Sonucunu Yazdır (LC Waikiki resmi form ile birebir) ───
// Ekrandaki formda o an işaretli olan tik/açıklama durumunu (kaydedilmiş
// olsun olmasın) alıp, ekteki "Kamera Formu" Excel şablonuyla aynı düzende
// (başlık bilgileri + 21 maddelik tik/puan tablosu + toplam puan +
// iki imza kutusu) yeni bir sekmede açar ve otomatik yazdırma diyaloğunu
// tetikler.
function yazdirTeknikIncelemeSonucu() {
  const inspector = document.getElementById('ti-inspector')?.value?.trim();
  const tarih = document.getElementById('ti-tarih')?.value || '';
  const talepNo = document.getElementById('ti-talep-secili')?.value?.trim();

  if (!inspector) { alert('Lütfen bir inspector seçin.'); return; }
  if (!talepNo) { alert('Lütfen değerlendirmeyi yaptığınız Talep No\'yu seçin veya girin.'); return; }

  const aktifler = teknikKriterler.filter(k => k.aktif);
  if (!aktifler.length) { alert('Yazdırılacak kriter yok.'); return; }

  const kList = aktifler.map(k => {
    const esc = (window.CSS && CSS.escape) ? CSS.escape(k.id) : k.id;
    const cb = document.querySelector(`.ti-tik-cb[data-kriter="${esc}"]`);
    const aciklamaInp = document.querySelector(`.ti-aciklama-input[data-kriter="${esc}"]`);
    return {
      metin: k.metin,
      puan: Number(k.puan) || 0,
      tikli: !!(cb && cb.checked),
      aciklama: aciklamaInp ? aciklamaInp.value.trim() : ''
    };
  });

  const rows = _tiBuildYazdirRows(kList);
  const maxToplam = kList.reduce((s, k) => s + k.puan, 0);
  const kazanilanToplam = kList.reduce((s, k) => s + (k.tikli ? k.puan : 0), 0);

  const inspectorAd = _formatDisplayName(inspector);
  const tarihStr = tarih ? new Date(tarih + 'T00:00:00').toLocaleDateString('tr-TR') : '';
  // Formu dolduran kullanıcının adı — admin dahil HER ZAMAN gösterilir
  // (eskiden admin ise boş bırakılıyordu, kullanıcı talebiyle kaldırıldı).
  const degerlendirenAd = (currentUser && currentUser.username)
    ? _formatDisplayName(currentUser.username) : '';

  let bodyRows = '';
  rows.forEach(r => {
    if (r.type === 'group') {
      bodyRows += `<tr class="ti-pr-grouprow">
        <td class="ti-pr-no">${_escapeHtml(r.no)}.</td>
        <td class="ti-pr-desc" colspan="4">${_escapeHtml(r.label)}</td>
      </tr>`;
    } else {
      bodyRows += `<tr>
        <td class="ti-pr-no">${_escapeHtml(r.no)}</td>
        <td class="ti-pr-alt">${_escapeHtml(r.alt)}</td>
        <td class="ti-pr-desc">${_escapeHtml(r.desc)}</td>
        <td class="ti-pr-tick">${r.tikli ? '✔' : ''}</td>
        <td class="ti-pr-puan">${r.tikli ? r.puan : 0}</td>
        <td class="ti-pr-olay">${_escapeHtml(r.aciklama || '')}</td>
      </tr>`;
    }
  });

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Teknik İnceleme Değerlendirme Formu - ${_escapeHtml(inspectorAd)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #000; margin: 0; padding: 0; font-size: 11px; line-height: 1.35; }
  .ti-pr-title { text-align:center; font-size:17px; font-weight:700; margin-bottom:12px; text-transform:uppercase; letter-spacing:.4px; }
  table { border-collapse: collapse; width: 100%; }
  .ti-pr-info td { border: 1px solid #000; padding: 6px 9px; font-size: 11.5px; vertical-align: middle; line-height:1.3; }
  .ti-pr-info .lbl { font-weight: 700; width: 19%; background:#F2F2F2; }
  .ti-pr-info .val { width: 31%; }
  .ti-pr-main { margin-top: 14px; }
  .ti-pr-main th { border: 1px solid #000; background:#F2F2F2; font-weight:700; font-size:11px; padding:7px 5px; text-align:center; }
  .ti-pr-main td { border: 1px solid #000; padding: 6px 7px; font-size: 11px; vertical-align: middle; line-height:1.35; }
  .ti-pr-no { text-align:center; font-weight:700; width:4%; }
  .ti-pr-alt { text-align:center; font-weight:700; width:3%; }
  .ti-pr-desc { text-align:left; }
  .ti-pr-tick { text-align:center; width:5%; font-weight:700; }
  .ti-pr-puan { text-align:center; width:6%; font-weight:700; }
  .ti-pr-olay { width:18%; font-size:10px; }
  .ti-pr-grouprow td { background:#EAEAEA; font-weight:700; }
  .ti-pr-total td { border: 1px solid #000; padding:10px 12px; font-weight:700; font-size:14px; }
  .ti-pr-total .lbl { text-align:right; background:#F2F2F2; }
  .ti-pr-total .val { text-align:center; width:10%; }
  .ti-pr-sign { margin-top:22px; }
  .ti-pr-sign td { border: 1px solid #000; padding:12px; text-align:center; font-weight:600; height: 100px; vertical-align: top; width:50%; font-size:11.5px; }
  .ti-pr-note { margin-top:10px; font-size:10.5px; font-style:italic; }
  @media print {
    .ti-pr-noprint { display:none; }
  }
</style>
</head>
<body>
  <div class="ti-pr-title">LC Waikiki — Teknik İnceleme Değerlendirme Formu</div>

  <table class="ti-pr-info">
    <tr>
      <td class="lbl">Inspektör</td><td class="val">${_escapeHtml(inspectorAd)}</td>
      <td class="lbl">Teknik Değerlendirme Uzmanı</td><td class="val">${_escapeHtml(degerlendirenAd)}</td>
    </tr>
    <tr>
      <td class="lbl">İnspection Tarihi</td><td class="val">${_escapeHtml(tarihStr)}</td>
      <td class="lbl">Başlama-Bitiş Saati</td><td class="val">&nbsp;</td>
    </tr>
    <tr>
      <td class="lbl">Sipariş No</td><td class="val">&nbsp;</td>
      <td class="lbl">Talep No</td><td class="val">${_escapeHtml(talepNo)}</td>
    </tr>
    <tr>
      <td class="lbl">Masa Numarası</td><td class="val">&nbsp;</td>
      <td class="lbl">Ürün Cinsi</td><td class="val">&nbsp;</td>
    </tr>
    <tr>
      <td class="lbl">Inspection Talep Adeti</td><td class="val">&nbsp;</td>
      <td class="lbl">Beden Sayısı</td><td class="val">&nbsp;</td>
    </tr>
    <tr>
      <td class="lbl">Kontrol Edilen AQL Adet</td><td class="val">&nbsp;</td>
      <td class="lbl">Ölçüm Yapılan Ürün Adeti</td><td class="val">&nbsp;</td>
    </tr>
  </table>

  <table class="ti-pr-main">
    <colgroup>
      <col style="width:4%"><col style="width:3%"><col style="width:47%">
      <col style="width:5%"><col style="width:6%"><col style="width:35%">
    </colgroup>
    <thead>
      <tr>
        <th colspan="3">Değerlendirme Maddesi</th>
        <th>Tick</th>
        <th>Puan</th>
        <th>Olay Saati / Olay Açıklaması</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>

  <table class="ti-pr-total">
    <tr>
      <td class="lbl" style="width:84%">Toplam Puan (Max: ${maxToplam})</td>
      <td class="val">${kazanilanToplam}</td>
    </tr>
  </table>

  <div class="ti-pr-note">Not: Yapılan işlemlerdeki kutulara ✔ koyunuz.</div>

  <table class="ti-pr-sign">
    <tr>
      <td>İlgili Ekip Yöneticisi<br>Tarih/İmza</td>
      <td>Gözlem Yapılan İnspektör<br>Tarih/İmza</td>
    </tr>
  </table>

  <div class="ti-pr-noprint" style="margin-top:14px;text-align:center">
    <button onclick="window.print()" style="padding:8px 18px;font-size:13px;cursor:pointer">🖨️ Yazdır</button>
  </div>

  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 200); };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Yazdırma penceresi açılamadı. Lütfen tarayıcınızın açılır pencere engelleyicisini kontrol edin.'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ─── Değerlendirmeyi Kaydet ───
// Düzenleme modu (kullanıcı talebiyle eklendi): dolu ise "Değerlendirmeyi
// Kaydet" aslında bu ID'li MEVCUT kaydı günceller, yeni kayıt oluşturmaz.
let _tiDuzenlemeId = null;

async function kaydetTeknikInceleme() {
  const inspector = document.getElementById('ti-inspector')?.value?.trim();
  const tarih = document.getElementById('ti-tarih')?.value;
  const talepNo = document.getElementById('ti-talep-secili')?.value?.trim();
  if (!inspector) { alert('Lütfen bir inspector seçin.'); return; }
  if (!tarih) { alert('Lütfen tarih girin.'); return; }
  if (!talepNo) { alert('Lütfen değerlendirmeyi yaptığınız Talep No\'yu seçin veya girin.'); return; }

  const aktifler = teknikKriterler.filter(k => k.aktif);
  if (!aktifler.length) { alert('Değerlendirilecek kriter yok.'); return; }

  const cevaplar = aktifler.map(k => {
    const cb = document.querySelector(`.ti-tik-cb[data-kriter="${(window.CSS && CSS.escape) ? CSS.escape(k.id) : k.id}"]`);
    const aciklamaInp = document.querySelector(`.ti-aciklama-input[data-kriter="${(window.CSS && CSS.escape) ? CSS.escape(k.id) : k.id}"]`);
    return {
      kriterId: k.id,
      maxPuan: Number(k.puan) || 0,   // sadece yerel önbellek hesabı için — sunucuya gönderilmez
      tikli: !!(cb && cb.checked),
      aciklama: aciklamaInp ? aciklamaInp.value.trim() : ''
    };
  });
  // Sunucuya gönderilecek küçültülmüş kopya: madde metni gönderilmiyor —
  // backend kriter listesinden kriterId ile kendisi buluyor. Bu, 21 maddelik
  // uzun soru metinlerinin URL'ye sığmayıp isteğin sessizce başarısız olmasını
  // önler (GET/JSONP yöntemi kullanıldığı için URL uzunluğu önemli).
  const cevaplarGonderim = cevaplar.map(c => ({ kriterId: c.kriterId, tikli: c.tikli, aciklama: c.aciklama }));

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('Sheets bağlantısı yapılandırılmamış.'); return; }

  const evaluation = {
    inspector, tarih, talepNo,
    degerlendiren: currentUser?.username || 'admin',
    cevaplar: cevaplarGonderim,
    savedAt: new Date().toISOString()
  };
  // Düzenleme modundaysak (mevcut bir kaydı güncelliyorsak) id'yi de gönder
  // — backend bunu görünce YENİ kayıt eklemek yerine mevcut kaydı günceller.
  if (_tiDuzenlemeId) evaluation.id = _tiDuzenlemeId;

  const btn = document.getElementById('ti-save-btn');
  const msg = document.getElementById('ti-save-msg');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }
  try {
    let resp;
    try {
      resp = await jsonpFetch(url, {
        action: 'saveTeknikInceleme',
        token,
        evaluation: encodeURIComponent(JSON.stringify(evaluation))
      });
    } catch (ilkHata) {
      // Zaman aşımı/geçici ağ sorunu olabilir — formu kaybetmemek için 1 kez daha dene
      if (btn) btn.textContent = '⏳ Tekrar deneniyor...';
      resp = await jsonpFetch(url, {
        action: 'saveTeknikInceleme',
        token,
        evaluation: encodeURIComponent(JSON.stringify(evaluation))
      });
    }
    if (resp && resp.status === 'error') {
      alert('Hata: ' + (resp.message || 'Bilinmeyen hata'));
      return;
    }
    // Yerel cache'e tek özet satır olarak ekle (madde madde değil)
    const now = new Date().toISOString();
    let maxToplam = 0, kazanilanToplam = 0, tikliSayisi = 0;
    cevaplar.forEach(c => {
      maxToplam += c.maxPuan;
      if (c.tikli) { kazanilanToplam += c.maxPuan; tikliSayisi++; }
    });
    const yeniSkorKaydi = {
      id: _tiDuzenlemeId || Date.now().toString(),
      inspector, degerlendiren: evaluation.degerlendiren, tarih, talepNo,
      maxPuan: maxToplam, kazanilanPuan: kazanilanToplam,
      skorYuzde: maxToplam > 0 ? Math.round((kazanilanToplam / maxToplam) * 100) : 0,
      maddeSayisi: cevaplar.length, tikliSayisi, savedAt: now
    };
    if (_tiDuzenlemeId) {
      // Düzenleme modu: eski satırı bul ve YERİNE koy (yeni satır ekleme)
      const idx = teknikSkorlar.findIndex(s => String(s.id) === String(_tiDuzenlemeId));
      if (idx >= 0) teknikSkorlar[idx] = yeniSkorKaydi;
      else teknikSkorlar.push(yeniSkorKaydi);
    } else {
      teknikSkorlar.push(yeniSkorKaydi);
    }
    const _duzenlemeModuydu = !!_tiDuzenlemeId;
    _tiDuzenlemeId = null; // düzenleme modundan çık
    saveTeknikIncelemeToLocalStorage();
    if (msg) { msg.style.display = ''; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
    // Kaydettikten sonra Talep No'yu temizle ve kriter listesini AÇIKÇA gizle
    // (kullanıcı talebiyle) — jenerik "önce talep no seçin" yerine, az önce
    // kaydedildiğini netçe belirten bir onay mesajı gösterilir.
    const talepInp = document.getElementById('ti-talep-secili');
    if (talepInp) talepInp.value = '';
    const kriterWrap = document.getElementById('ti-kriter-list');
    if (kriterWrap) {
      kriterWrap.innerHTML = `<div class="empty" style="padding:20px">
        <div class="empty-icon">✅</div>
        <h3>${_duzenlemeModuydu ? 'Değerlendirme güncellendi!' : 'Değerlendirme kaydedildi!'}</h3>
        <p>Yeni bir değerlendirme için yukarıdan Talep No girin</p>
      </div>`;
    }
    renderTiSkorOzet();
    if (!currentUser || currentUser.isAdmin) renderTiKayitlarTablo();
    renderTiDashboard();
    // Dashboard kartlarında da güncel görünsün
    if (typeof renderDashboard === 'function' && document.getElementById('inspector-grid')) renderDashboard();
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Değerlendirmeyi Kaydet'; }
  }
}

// ─── Bir Değerlendirmeyi Düzenlemeye Aç (kullanıcı talebiyle eklendi) ───
// Sunucudan o kaydın tam detayını (madde madde tikli/açıklama) çeker,
// "Değerlendirme Yap" formunu bu verilerle doldurur ve düzenleme moduna
// geçer — "Kaydet" artık bu kaydı GÜNCELLER, yeni kayıt oluşturmaz.
async function duzenleTeknikInceleme(id) {
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('⚠️ Sunucu bağlantısı yapılandırılmamış.'); return; }

  try {
    const resp = await jsonpFetch(url, { action: 'getTeknikIncelemeDetay', token, id });
    if (!resp || resp.status !== 'ok' || !resp.kayit) {
      alert('❌ Kayıt detayı alınamadı: ' + (resp?.message || 'bilinmeyen hata'));
      return;
    }
    const kayit = resp.kayit;

    // Formu doldur
    const tarihEl = document.getElementById('ti-tarih');
    if (tarihEl) tarihEl.value = kayit.tarih || tarihEl.value;
    const inspectorEl = document.getElementById('ti-inspector');
    if (inspectorEl) inspectorEl.value = kayit.inspector || '';
    const talepEl = document.getElementById('ti-talep-secili');
    if (talepEl) talepEl.value = kayit.talepNo || '';

    _tiDuzenlemeId = id;
    renderTeknikKriterForm();

    // Kaydedilmiş tikli/açıklama değerlerini render edilen forma uygula
    (kayit.cevaplar || []).forEach(c => {
      const kriterId = c.id;
      const cbSel = `.ti-tik-cb[data-kriter="${(window.CSS && CSS.escape) ? CSS.escape(kriterId) : kriterId}"]`;
      const aSel = `.ti-aciklama-input[data-kriter="${(window.CSS && CSS.escape) ? CSS.escape(kriterId) : kriterId}"]`;
      const cb = document.querySelector(cbSel);
      const aInp = document.querySelector(aSel);
      if (cb) cb.checked = !!c.t;
      if (aInp) aInp.value = c.a || '';
    });

    // Düzenleme modu banner'ı (form üstünde göster)
    const kriterWrap = document.getElementById('ti-kriter-list');
    if (kriterWrap) {
      const banner = document.createElement('div');
      banner.innerHTML = `<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#E65100;display:flex;align-items:center;justify-content:space-between;gap:10px">
        <span>✏️ <strong>Düzenleme modu:</strong> ${_escapeHtml(_formatDisplayName(kayit.inspector))} — ${_escapeHtml(kayit.talepNo)} değerlendirmesi güncelleniyor</span>
        <button type="button" onclick="iptalTeknikDuzenleme()" style="border:1px solid #E65100;background:#fff;color:#E65100;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px">İptal</button>
      </div>`;
      kriterWrap.prepend(banner);
    }

    // Forma kaydır
    document.querySelector('.card:has(#ti-kriter-list)')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch(e) {
    alert('Hata: ' + e.message);
  }
}

// Düzenleme modundan çık VE formu tamamen kapat/temizle (kullanıcı talebiyle:
// "iptal butonuna basınca düzenleme ekranı kaybolsun"). Sadece düzenleme
// modundan çıkmak yetmiyordu çünkü Talep No dolu kaldığı için kriter formu
// açık kalmaya devam ediyordu — bu yüzden Talep No'yu da temizleyip formu
// "kayıt sonrası" boş durumuna döndürüyoruz.
function iptalTeknikDuzenleme() {
  _tiDuzenlemeId = null;
  const talepInp = document.getElementById('ti-talep-secili');
  if (talepInp) talepInp.value = '';
  const kriterWrap = document.getElementById('ti-kriter-list');
  if (kriterWrap) {
    kriterWrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">✕</div>
      <h3>Düzenleme iptal edildi</h3>
      <p>Yeni bir değerlendirme için yukarıdan Talep No girin</p>
    </div>`;
  }
}

// ─── Skor Özeti Tablosu ───
// ─── Teknik İnceleme Sayfalama (kullanıcı talebiyle eklendi — 15/sayfa) ───
const TI_SAYFA_BOYUTU = 15;
let tiSkorSayfa = 1;
let tiKayitSayfa = 1;
let iiKayitSayfa = 1;

function _tiSayfalamaHtml(mevcutSayfa, toplamSayfa, prevFnAdi, nextFnAdi) {
  if (toplamSayfa <= 1) return '';
  return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border2)">
    <button onclick="${prevFnAdi}()" ${mevcutSayfa<=1?'disabled':''} style="padding:5px 12px;font-size:12px;border:1px solid var(--border2);background:#fff;border-radius:6px;cursor:pointer;${mevcutSayfa<=1?'opacity:.4;cursor:not-allowed':''}">‹ Önceki</button>
    <span style="font-size:12px;color:var(--muted2)">Sayfa ${mevcutSayfa} / ${toplamSayfa}</span>
    <button onclick="${nextFnAdi}()" ${mevcutSayfa>=toplamSayfa?'disabled':''} style="padding:5px 12px;font-size:12px;border:1px solid var(--border2);background:#fff;border-radius:6px;cursor:pointer;${mevcutSayfa>=toplamSayfa?'opacity:.4;cursor:not-allowed':''}">Sonraki ›</button>
  </div>`;
}
function tiSkorOncekiSayfa() { if (tiSkorSayfa > 1) { tiSkorSayfa--; renderTiSkorOzet(); } }
function tiSkorSonrakiSayfa() { tiSkorSayfa++; renderTiSkorOzet(); }
function tiKayitOncekiSayfa() { if (tiKayitSayfa > 1) { tiKayitSayfa--; renderTiKayitlarTablo(); } }
function tiKayitSonrakiSayfa() { tiKayitSayfa++; renderTiKayitlarTablo(); }
function iiKayitOncekiSayfa() { if (iiKayitSayfa > 1) { iiKayitSayfa--; renderIkinciInspectionTablo(); } }
function iiKayitSonrakiSayfa() { iiKayitSayfa++; renderIkinciInspectionTablo(); }

function renderTiSkorOzet() {
  const wrap = document.getElementById('ti-skor-ozet');
  if (!wrap) return;

  // Filtreler: Inspector adı (serbest arama) + tarih aralığı (r.tarih alanına göre)
  const fInspector = (document.getElementById('ti-skor-filtre-inspector')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const fBaslangic = document.getElementById('ti-skor-filtre-baslangic')?.value || '';
  const fBitis = document.getElementById('ti-skor-filtre-bitis')?.value || '';

  const filtreliSkorlar = teknikSkorlar.filter(r => {
    if (fInspector && !String(r.inspector || '').toLocaleLowerCase('tr-TR').includes(fInspector)) return false;
    if (fBaslangic && (!r.tarih || r.tarih < fBaslangic)) return false;
    if (fBitis && (!r.tarih || r.tarih > fBitis)) return false;
    return true;
  });

  const isimler = Array.from(new Set(filtreliSkorlar.map(r => r.inspector))).sort((a,b) => a.localeCompare(b, 'tr'));
  if (!isimler.length) {
    wrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">📊</div>
      <h3>${teknikSkorlar.length ? 'Filtreye uyan kayıt bulunamadı' : 'Henüz değerlendirme yapılmamış'}</h3>
    </div>`;
    return;
  }
  const toplamSayfa = Math.max(1, Math.ceil(isimler.length / TI_SAYFA_BOYUTU));
  if (tiSkorSayfa > toplamSayfa) tiSkorSayfa = toplamSayfa;
  const baslangic = (tiSkorSayfa - 1) * TI_SAYFA_BOYUTU;
  const sayfaIsimleri = isimler.slice(baslangic, baslangic + TI_SAYFA_BOYUTU);

  // Filtrelenmiş veriden (SADECE bu görünümdeki kayıtlardan) skor hesapla —
  // getTeknikIncelemeSkorForInspector() TÜM veriye baktığı için burada
  // kullanılamaz.
  const skorHesapla = (ins) => {
    const cevaplar = filtreliSkorlar.filter(r => r.inspector === ins);
    let maxToplam = 0, kazanilanToplam = 0;
    cevaplar.forEach(r => { maxToplam += (Number(r.maxPuan)||0); kazanilanToplam += (Number(r.kazanilanPuan)||0); });
    const percent = maxToplam > 0 ? Math.round((kazanilanToplam/maxToplam)*100) : 0;
    return { percent, count: cevaplar.length, seviye: getPerformanceLevelLabel(percent), kayitlar: cevaplar };
  };

  const rows = sayfaIsimleri.map(ins => {
    const s = skorHesapla(ins);
    const color = getProgressColor(s.percent);
    // Düzenle butonu HER ZAMAN gösterilir — birden fazla kayıt varsa, bunlar
    // arasından savedAt'e göre EN SON (en güncel) girilen kayıt düzenlenir
    // (kullanıcı talebiyle: "sadece en son girilen kayıt düzenlenebilsin").
    let duzenleBtn = '';
    if (s.count >= 1) {
      const enSonKayit = s.kayitlar.slice().sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''))[0];
      const cokSayidaNotu = s.count > 1 ? ` title="${s.count} kayıttan en son girilen (${_escapeHtml(enSonKayit.tarih||'')}) düzenlenecek"` : '';
      duzenleBtn = `<button type="button"${cokSayidaNotu} onclick="duzenleTeknikInceleme('${String(enSonKayit.id).replace(/'/g,"\\'")}')" style="border:1px solid var(--lblue);background:var(--lblue3);color:var(--blue2);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px;font-weight:600;margin-left:8px">✏️ Düzenle${s.count > 1 ? ' (en son)' : ''}</button>`;
    }
    return `<tr>
      <td style="padding:8px 10px;font-size:13px;color:var(--navy);font-weight:500">${_escapeHtml(_formatDisplayName(ins))}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:700;color:${color}">${s.percent}%</td>
      <td style="padding:8px 10px;font-size:12px;color:${color}">${s.seviye}</td>
      <td style="padding:8px 10px;font-size:12px;color:var(--muted2)">${s.count} madde cevabı${duzenleBtn}</td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:2px solid var(--border2)">
      <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Inspector</th>
      <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Skor</th>
      <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Seviye</th>
      <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Veri</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${_tiSayfalamaHtml(tiSkorSayfa, toplamSayfa, 'tiSkorOncekiSayfa', 'tiSkorSonrakiSayfa')}`;
}

// ─── Teknik İnceleme Skorları Özetini Excel'e Aktar (kullanıcı talebiyle) ───
function exportTiSkorOzetToExcel() {
  const fInspector = (document.getElementById('ti-skor-filtre-inspector')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const fBaslangic = document.getElementById('ti-skor-filtre-baslangic')?.value || '';
  const fBitis = document.getElementById('ti-skor-filtre-bitis')?.value || '';
  const filtreliSkorlar = teknikSkorlar.filter(r => {
    if (fInspector && !String(r.inspector || '').toLocaleLowerCase('tr-TR').includes(fInspector)) return false;
    if (fBaslangic && (!r.tarih || r.tarih < fBaslangic)) return false;
    if (fBitis && (!r.tarih || r.tarih > fBitis)) return false;
    return true;
  });
  const isimler = Array.from(new Set(filtreliSkorlar.map(r => r.inspector))).sort((a,b) => a.localeCompare(b, 'tr'));
  if (!isimler.length) { alert('⚠️ Dışa aktarılacak (filtreye uyan) veri yok.'); return; }

  const data = isimler.map(ins => {
    const cevaplar = filtreliSkorlar.filter(r => r.inspector === ins);
    let maxToplam = 0, kazanilanToplam = 0;
    cevaplar.forEach(r => { maxToplam += (Number(r.maxPuan)||0); kazanilanToplam += (Number(r.kazanilanPuan)||0); });
    const percent = maxToplam > 0 ? Math.round((kazanilanToplam/maxToplam)*100) : 0;
    return {
      'Inspector': _formatDisplayName(ins),
      'Skor (%)': percent,
      'Seviye': getPerformanceLevelLabel(percent),
      'Madde Cevabı Sayısı': cevaplar.length
    };
  });

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{wch:24},{wch:12},{wch:16},{wch:20}];
  XLSX.utils.book_append_sheet(workbook, ws, 'Teknik İnceleme Skorları');
  const tarihStr = _bugununTarihiYerel();
  XLSX.writeFile(workbook, `Teknik_Inceleme_Skorlari_${tarihStr}.xlsx`);
}

// ─── ADMIN: Kriter Yönetimi ───
function renderTiKriterYonetimList() {
  const wrap = document.getElementById('ti-kriter-yonetim-list');
  if (!wrap) return;
  if (!teknikKriterler.length) {
    wrap.innerHTML = `<div style="font-size:12px;color:var(--muted2);padding:8px 0">Henüz madde eklenmedi. Aşağıdan ekleyebilir veya varsayılan soru setini yükleyebilirsiniz.</div>`;
    return;
  }
  const toplamPuan = teknikKriterler.reduce((s,k) => s + (Number(k.puan)||0), 0);
  wrap.innerHTML = `
    <div style="font-size:11px;color:var(--muted2);margin-bottom:2px">Toplam maksimum puan: <strong>${toplamPuan}</strong> (idealde 100 olması önerilir)</div>
    ${teknikKriterler.map((k, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--offwhite);border:1px solid var(--border2);border-radius:8px">
      <input type="checkbox" data-ti-idx="${i}" class="ti-kriter-aktif" ${k.aktif ? 'checked' : ''} title="Aktif/Pasif" style="width:16px;height:16px;flex:0 0 16px;cursor:pointer">
      <input type="text" data-ti-idx="${i}" class="ti-kriter-metin" value="${_escapeHtml(k.metin)}" style="flex:1;font-size:13px">
      <input type="number" min="0" step="1" data-ti-idx="${i}" class="ti-kriter-puan" value="${Number(k.puan)||0}" title="Madde puanı (ağırlığı)" style="width:70px;font-size:13px;text-align:center">
      <button onclick="silTiKriter(${i})" style="background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;border-radius:6px;padding:5px 9px;font-size:12px;cursor:pointer">🗑️</button>
    </div>
  `).join('')}`;
}

function ekleTeknikKriter() {
  const input = document.getElementById('ti-kriter-yeni-input');
  const puanInput = document.getElementById('ti-kriter-yeni-puan');
  const metin = input?.value?.trim();
  const puan = Number(puanInput?.value) || 0;
  if (!metin) { alert('Lütfen madde metni girin.'); return; }
  teknikKriterler.push({ id: 'k_' + Date.now(), metin, puan, aktif: true, sira: teknikKriterler.length });
  if (input) input.value = '';
  if (puanInput) puanInput.value = '';
  renderTiKriterYonetimList();
}

function silTiKriter(idx) {
  if (!confirm('Bu maddeyi silmek istediğinize emin misiniz?')) return;
  teknikKriterler.splice(idx, 1);
  renderTiKriterYonetimList();
}

async function kaydetTeknikKriterler() {
  // DOM'daki güncel checkbox/metin/puan değerlerini diziye yansıt
  document.querySelectorAll('.ti-kriter-metin').forEach(inp => {
    const i = Number(inp.getAttribute('data-ti-idx'));
    if (teknikKriterler[i]) teknikKriterler[i].metin = inp.value.trim();
  });
  document.querySelectorAll('.ti-kriter-puan').forEach(inp => {
    const i = Number(inp.getAttribute('data-ti-idx'));
    if (teknikKriterler[i]) teknikKriterler[i].puan = Number(inp.value) || 0;
  });
  document.querySelectorAll('.ti-kriter-aktif').forEach(cb => {
    const i = Number(cb.getAttribute('data-ti-idx'));
    if (teknikKriterler[i]) teknikKriterler[i].aktif = cb.checked;
  });
  teknikKriterler.forEach((k, i) => { k.sira = i; });

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (SHEETS_DEVRE_DISI) { alert('⚠️ Google Sheets bağlantısı devre dışı bırakıldı — Teknik İnceleme kriterleri şu anda kaydedilemiyor.'); return; }
  if (!url || !token) { alert('⚠️ Google Sheets bağlantısı yapılandırılmamış!'); return; }

  const btn = document.getElementById('ti-kriter-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'setTeknikKriterler', token, kriterler: teknikKriterler }),
      mode: 'no-cors'
    });
    saveTeknikKriterToLocalStorage();
    renderTiKriterYonetimList();
    renderTeknikKriterForm();
    showSuccessMessage('✅ Kriterler kaydedildi');
  } catch(err) {
    alert('❌ Gönderme hatası: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Kriterleri Kaydet'; }
  }
}

// ─── ADMIN: Tüm Kayıtlar Tablosu (değerlendirme oturumu bazında gruplanır) ───
function renderTiKayitlarTablo() {
  const wrap = document.getElementById('ti-kayitlar-tablo');
  if (!wrap) return;
  if (!teknikSkorlar.length) {
    wrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">📋</div>
      <h3>Henüz kayıt yok</h3>
    </div>`;
    return;
  }
  // Filtreler: Inspector adı (serbest arama) + tarih aralığı
  const fInspector = (document.getElementById('ti-kayit-filtre-inspector')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const fBaslangic = document.getElementById('ti-kayit-filtre-baslangic')?.value || '';
  const fBitis = document.getElementById('ti-kayit-filtre-bitis')?.value || '';

  // Not: teknikSkorlar artık madde madde değil, her satır tek bir değerlendirme
  // özeti (bkz. saveTeknikIncelemeKaydi) — gruplamaya gerek yok.
  let satirlar = teknikSkorlar.slice().sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  satirlar = satirlar.filter(g => {
    if (fInspector && !String(g.inspector || '').toLocaleLowerCase('tr-TR').includes(fInspector)) return false;
    if (fBaslangic && (!g.tarih || g.tarih < fBaslangic)) return false;
    if (fBitis && (!g.tarih || g.tarih > fBitis)) return false;
    return true;
  });
  if (!satirlar.length) {
    wrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">📋</div>
      <h3>Filtreye uyan kayıt bulunamadı</h3>
    </div>`;
    return;
  }
  const basariliSayisi = satirlar.filter(g => (g.skorYuzde ?? 0) >= TI_BASARI_ESIGI).length;
  const toplamSayfa = Math.max(1, Math.ceil(satirlar.length / TI_SAYFA_BOYUTU));
  if (tiKayitSayfa > toplamSayfa) tiKayitSayfa = toplamSayfa;
  const baslangic = (tiKayitSayfa - 1) * TI_SAYFA_BOYUTU;
  const sayfaSatirlari = satirlar.slice(baslangic, baslangic + TI_SAYFA_BOYUTU);
  const rows = sayfaSatirlari.map(g => {
    const percent = g.skorYuzde ?? (g.maxPuan > 0 ? Math.round((g.kazanilanPuan / g.maxPuan) * 100) : 0);
    const basarili = percent >= TI_BASARI_ESIGI;
    const durumHtml = basarili
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;background:#E8F5E9;color:#2E7D32;border:1px solid #A5D6A7;border-radius:99px;font-size:11px;font-weight:700">✅ Başarılı</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;border-radius:99px;font-size:11px;font-weight:700">❌ Başarısız</span>`;
    return `<tr>
      <td style="padding:7px 10px;font-size:12px;color:var(--navy);font-weight:500">${_escapeHtml(_formatDisplayName(g.inspector))}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2);font-family:'DM Mono',monospace">${_escapeHtml(g.talepNo || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2)">${_escapeHtml(g.degerlendiren)}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2)">${_escapeHtml(g.tarih)}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2)">${g.maddeSayisi || 0} madde · ${g.kazanilanPuan}/${g.maxPuan} puan</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:700;color:${getProgressColor(percent)}">${percent}%</td>
      <td style="padding:7px 10px">${durumHtml}</td>
      <td style="padding:7px 10px">
        <button type="button" onclick="duzenleTeknikInceleme('${String(g.id).replace(/'/g,"\\'")}')" style="border:1px solid var(--lblue);background:var(--lblue3);color:var(--blue2);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11.5px;font-weight:600">✏️ Düzenle</button>
      </td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--muted2)">
      <strong style="color:var(--navy)">${basariliSayisi}</strong> / ${satirlar.length} değerlendirme başarılı
      <span style="color:var(--muted)">(≥%${TI_BASARI_ESIGI} = Başarılı)</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:2px solid var(--border2)">
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Inspector</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Talep No</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Değerlendiren</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Tarih</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Madde</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Skor</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Durum</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">İşlem</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${_tiSayfalamaHtml(tiKayitSayfa, toplamSayfa, 'tiKayitOncekiSayfa', 'tiKayitSonrakiSayfa')}`;
}

// ─── İkinci Inspection Kayıtlarını Excel'e Aktar (kullanıcı talebiyle) ───
function exportIkinciInspectionToExcel() {
  if (!ikinciInspectionData.length) { alert('⚠️ Henüz dışa aktarılacak İkinci Inspection kaydı yok.'); return; }
  const fInspector = (document.getElementById('ii-kayit-filtre-inspector')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const fBaslangic = document.getElementById('ii-kayit-filtre-baslangic')?.value || '';
  const fBitis = document.getElementById('ii-kayit-filtre-bitis')?.value || '';
  let satirlar = ikinciInspectionData.slice().sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  satirlar = satirlar.filter(r => {
    if (fInspector && !String(r.inspector || '').toLocaleLowerCase('tr-TR').includes(fInspector)) return false;
    if (fBaslangic && (!r.tarih || r.tarih < fBaslangic)) return false;
    if (fBitis && (!r.tarih || r.tarih > fBitis)) return false;
    return true;
  });
  if (!satirlar.length) { alert('⚠️ Filtreye uyan (dışa aktarılacak) kayıt yok.'); return; }

  const data = satirlar.map(r => ({
    'Sipariş Kodu': r.siparisKodu || '',
    'Inspector': _formatDisplayName(r.inspector || ''),
    'Ekip Yöneticisi': _formatDisplayName(r.ekipYoneticisi || ''),
    'Talep No': r.talepNo || '',
    'Talep Miktarı': r.talepMiktari || 0,
    'Sonuç': r.sonuc || '',
    'Not': r.notAlani || '',
    'Tarih': r.tarih || '',
    'Giren': _formatDisplayName(r.degerlendiren || ''),
    'Kayıt Zamanı': r.savedAt || ''
  }));

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    {wch:16},{wch:22},{wch:22},{wch:14},{wch:14},{wch:10},{wch:30},{wch:12},{wch:20},{wch:22}
  ];
  XLSX.utils.book_append_sheet(workbook, ws, 'İkinci Inspection');
  const tarihStr = _bugununTarihiYerel();
  XLSX.writeFile(workbook, `Ikinci_Inspection_Kayitlari_${tarihStr}.xlsx`);
}

// ─── İkinci Inspection Kayıtları Tablosu ───
// İkinci Inspection Not sütunundaki 👁️ ikonuna tıklanınca notu gösterir
// (uzun notlar tablonun tasarımını bozmasın diye — kullanıcı talebiyle eklendi).
function showIiNotPopup(id) {
  const rec = ikinciInspectionData.find(r => String(r.id) === String(id));
  if (!rec) return;

  const modal = document.createElement('div');
  modal.id = 'ii-not-popup-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(11,31,58,.65);z-index:9998;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;width:min(520px,92vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="background:var(--navy);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:15px;font-weight:700;color:#fff">📝 Not</div>
          <div style="font-size:12px;color:#9FACC9;margin-top:3px">${_escapeHtml(_formatDisplayName(rec.inspector || ''))} · Talep No: <strong style="color:#fff">${_escapeHtml(rec.talepNo || '—')}</strong></div>
        </div>
        <button onclick="document.getElementById('ii-not-popup-overlay').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.25)'" onmouseout="this.style.background='rgba(255,255,255,.15)'">✕</button>
      </div>
      <div style="padding:18px 20px;overflow-y:auto;flex:1;font-size:13px;line-height:1.6;color:var(--navy);white-space:pre-wrap">${_escapeHtml(rec.notAlani || '(not girilmemiş)')}</div>
      <div style="padding:12px 20px;border-top:1px solid var(--border2);flex-shrink:0;text-align:right">
        <button onclick="document.getElementById('ii-not-popup-overlay').remove()" style="background:var(--navy);color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-size:12.5px;font-weight:600">Kapat</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function renderIkinciInspectionTablo() {
  const wrap = document.getElementById('ii-kayitlar-tablo');
  if (!wrap) return;
  if (!ikinciInspectionData.length) {
    wrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">🔎</div>
      <h3>Henüz kayıt yok</h3>
    </div>`;
    return;
  }
  // Filtreler: Inspector adı (serbest arama) + tarih aralığı
  const fInspector = (document.getElementById('ii-kayit-filtre-inspector')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const fBaslangic = document.getElementById('ii-kayit-filtre-baslangic')?.value || '';
  const fBitis = document.getElementById('ii-kayit-filtre-bitis')?.value || '';

  let satirlar = ikinciInspectionData.slice().sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  satirlar = satirlar.filter(r => {
    if (fInspector && !String(r.inspector || '').toLocaleLowerCase('tr-TR').includes(fInspector)) return false;
    if (fBaslangic && (!r.tarih || r.tarih < fBaslangic)) return false;
    if (fBitis && (!r.tarih || r.tarih > fBitis)) return false;
    return true;
  });
  if (!satirlar.length) {
    wrap.innerHTML = `<div class="empty" style="padding:20px">
      <div class="empty-icon">🔎</div>
      <h3>Filtreye uyan kayıt bulunamadı</h3>
    </div>`;
    return;
  }
  const geciSayisiToplam = satirlar.filter(r => r.sonuc === 'Geçti').length;
  const toplamSayfa = Math.max(1, Math.ceil(satirlar.length / TI_SAYFA_BOYUTU));
  if (iiKayitSayfa > toplamSayfa) iiKayitSayfa = toplamSayfa;
  const sayfaBaslangic = (iiKayitSayfa - 1) * TI_SAYFA_BOYUTU;
  const sayfaSatirlari = satirlar.slice(sayfaBaslangic, sayfaBaslangic + TI_SAYFA_BOYUTU);
  const rows = sayfaSatirlari.map(r => {
    const gecti = r.sonuc === 'Geçti';
    const durumHtml = gecti
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;background:#E8F5E9;color:#2E7D32;border:1px solid #A5D6A7;border-radius:99px;font-size:11px;font-weight:700">✅ Geçti</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;border-radius:99px;font-size:11px;font-weight:700">❌ Kaldı</span>`;
    return `<tr>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2);font-family:'DM Mono',monospace">${_escapeHtml(r.siparisKodu || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--navy);font-weight:500">${_escapeHtml(_formatDisplayName(r.inspector))}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2)">${_escapeHtml(_formatDisplayName(r.ekipYoneticisi || '—'))}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2);font-family:'DM Mono',monospace">${_escapeHtml(r.talepNo || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2)">${r.talepMiktari || 0}</td>
      <td style="padding:7px 10px">${durumHtml}</td>
      <td style="padding:7px 10px;font-size:12px">${r.notAlani ? `<button type="button" onclick="showIiNotPopup('${String(r.id).replace(/'/g,"\\'")}')" title="Notu görüntüle" style="border:none;background:var(--lblue3);color:var(--blue2);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:13px;line-height:1">👁️</button>` : `<span style="color:var(--muted2);font-size:12px">—</span>`}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2)">${_escapeHtml(r.tarih || '—')}</td>
      <td style="padding:7px 10px;font-size:11.5px;color:var(--muted)">${_escapeHtml(_formatDisplayName(r.degerlendiren || '—'))}</td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--muted2)">
      <strong style="color:var(--navy)">${geciSayisiToplam}</strong> / ${satirlar.length} kayıt "Geçti"
    </div>
    <table style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:2px solid var(--border2)">
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Sipariş Kodu</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Inspector</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Ekip Yöneticisi</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Talep No</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Talep Miktarı</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Sonuç</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Not</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Tarih</th>
      <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--muted);text-transform:uppercase">Giren</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${_tiSayfalamaHtml(iiKayitSayfa, toplamSayfa, 'iiKayitOncekiSayfa', 'iiKayitSonrakiSayfa')}`;
}

// ─── Teknik İnceleme Dashboard (kullanıcı talebiyle eklendi) ───
// Günlük 2 hedefi (Teknik Değerlendirme + İkinci Inspection) takip eder.
// "NE ÖDÜL NE CEZA" İLKESİ: ortalama hesaplanırken takvim günü değil, SADECE
// o kullanıcının VERİ GİRDİĞİ (aktif) günler baz alınır — izinli/raporlu
// olabileceği, hiç veri girilmemiş günler ne lehine ne aleyhine sayılır,
// hesaba hiç dahil edilmez. Çalışma haftası 6 gün kabul edilir; bu sadece
// referans "haftalık hedef" gösteriminde (günlük hedef × 6) kullanılır,
// ortalama hesabını etkilemez (zaten sadece aktif günlere bakıldığı için
// haftanın kaç iş günü olduğu ortalamayı değiştirmez).
// ─── Teknik Değerlendirme Uzmanları Performansını Excel'e Aktar (kullanıcı talebiyle) ───
function exportTiDashboardToExcel() {
  const satirlar = window._tiDashboardSatirlari || [];
  if (!satirlar.length) { alert('⚠️ Henüz dışa aktarılacak veri yok.'); return; }
  const hedefTD = teknikHedefler.teknikDegerlendirmeGunluk || 3;
  const hedefII = teknikHedefler.ikinciInspectionGunluk || 5;

  const data = satirlar.map(s => ({
    'Kullanıcı': _formatDisplayName(s.kullanici),
    'Bugün Teknik Değerlendirme': s.tdBugun,
    'Hedef (Teknik Değ.)': hedefTD,
    'Ort. Teknik Değ./Gün (aktif gün bazlı)': s.tdOrtalama !== null ? Math.round(s.tdOrtalama * 10) / 10 : '—',
    'İş Günü (Teknik Değ.)': s.tdGunSayisi,
    'Bugün İkinci Inspection': s.iiBugun,
    'Hedef (İkinci Insp.)': hedefII,
    'Ort. İkinci Insp./Gün (aktif gün bazlı)': s.iiOrtalama !== null ? Math.round(s.iiOrtalama * 10) / 10 : '—',
    'İş Günü (İkinci Insp.)': s.iiGunSayisi,
    'İkinci Insp. Geçti/Toplam Oranı (%)': s.iiGeciOrani !== null ? s.iiGeciOrani : '—',
    'Genel Performans (%)': s.genelPerf !== null ? s.genelPerf : '—'
  }));

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    {wch:22},{wch:24},{wch:16},{wch:30},{wch:20},{wch:22},{wch:16},{wch:30},{wch:20},{wch:26},{wch:18}
  ];
  XLSX.utils.book_append_sheet(workbook, ws, 'Teknik Değ. Uzmanları');
  const tarihStr = _bugununTarihiYerel();
  XLSX.writeFile(workbook, `Teknik_Degerlendirme_Uzmanlari_Performans_${tarihStr}.xlsx`);
}

function renderTiDashboard() {
  const wrap = document.getElementById('ti-dashboard-wrap');
  if (!wrap) return;

  const bugun = _bugununTarihiYerel();
  const hedefTD = teknikHedefler.teknikDegerlendirmeGunluk || 3;
  const hedefII = teknikHedefler.ikinciInspectionGunluk || 5;

  // Hem Teknik Değerlendirme hem İkinci Inspection'da görünen tüm "giren
  // kullanıcı"ları topla (birleşik liste — biri diğerini yapmamış olsa bile
  // listede görünür, o metrikte 0 gösterilir).
  const kullanicilar = new Set();
  teknikSkorlar.forEach(s => { if (s.degerlendiren) kullanicilar.add(s.degerlendiren); });
  ikinciInspectionData.forEach(r => { if (r.degerlendiren) kullanicilar.add(r.degerlendiren); });

  // ── TAKVİM BAZLI İŞ GÜNÜ HESABI (kullanıcı talebiyle eklendi) ────────────
  // Eskiden payda "aktif gün" (sadece kayıt girilen günler) idi — boş geçen
  // günler hiç sayılmıyordu. Artık payda, değerlendiricinin İLK kaydından
  // BUGÜNE kadar olan 6 günlük iş haftası (Pazar hariç) üzerinden hesaplanır;
  // bu aralıktaki bir gün için değerlendiriciye Kayıp Zaman girişi varsa
  // (kayipZamanData'da "inspector" alanı bu kullanıcıyla eşleşiyorsa) o gün
  // nötr sayılıp paydadan çıkarılır — diğer tüm günler (kayıt girilsin/
  // girilmesin) paydaya dahildir. Böylece mazeretsiz boş günler artık
  // ortalamayı gerçekten düşürür.
  function _isGunuSayisiHesapla(baslangicISO, bitisISO, kayipGunSeti) {
    if (!baslangicISO || !bitisISO) return 0;
    let sayac = 0;
    const cur = new Date(baslangicISO + 'T00:00:00');
    const end = new Date(bitisISO + 'T00:00:00');
    if (isNaN(cur.getTime()) || isNaN(end.getTime()) || cur > end) return 0;
    while (cur <= end) {
      if (cur.getDay() !== 0) { // 0 = Pazar → haftalık izin günü, iş günü sayılmaz
        const y = cur.getFullYear(), m = String(cur.getMonth()+1).padStart(2,'0'), d = String(cur.getDate()).padStart(2,'0');
        const dateStr = `${y}-${m}-${d}`;
        if (!kayipGunSeti.has(dateStr)) sayac++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return sayac;
  }

  const satirlar = Array.from(kullanicilar).sort((a,b) => a.localeCompare(b,'tr')).map(kullanici => {
    const tdKayitlari = teknikSkorlar.filter(s => s.degerlendiren === kullanici);
    const tdBugun = tdKayitlari.filter(s => s.tarih === bugun).length;

    const iiKayitlari = ikinciInspectionData.filter(r => r.degerlendiren === kullanici);
    const iiBugun = iiKayitlari.filter(r => r.tarih === bugun).length;

    // Bu değerlendiricinin kendi adına (inspector alanı üzerinden) girilmiş
    // Kayıp Zaman günlerini topla — normalize edilmiş (YYYY-MM-DD) tarih seti.
    const kullaniciNorm = String(kullanici || '').toLocaleLowerCase('tr-TR').trim();
    const kayipGunSeti = new Set(
      kayipZamanData
        .filter(r => String(r.inspector || '').toLocaleLowerCase('tr-TR').trim() === kullaniciNorm)
        .map(r => formatTarihKisaISO(r.tarih))
        .filter(Boolean)
    );

    // İş takvimi aralığı: Admin tarafından ortak bir başlangıç günü
    // belirlenmişse (teknikHedefler.baslangicTarihi) HERKES için o tarih
    // kullanılır — kişinin kendi ilk kaydı değil. Admin bir tarih
    // belirlemediyse (varsayılan/eski davranış), bu kullanıcının (her iki
    // metrikten) EN ERKEN kaydı baz alınır.
    let baslangicISO = teknikHedefler.baslangicTarihi || null;
    if (!baslangicISO) {
      const tumTarihler = [...tdKayitlari.map(s=>s.tarih), ...iiKayitlari.map(r=>r.tarih)]
        .filter(Boolean).sort();
      baslangicISO = tumTarihler.length ? tumTarihler[0] : null;
    }
    const isGunuSayisi = _isGunuSayisiHesapla(baslangicISO, bugun, kayipGunSeti);

    const tdOrtalama = isGunuSayisi > 0 ? (tdKayitlari.length / isGunuSayisi) : null;
    const iiOrtalama = isGunuSayisi > 0 ? (iiKayitlari.length / isGunuSayisi) : null;

    // İkinci Inspection Sonuç Oranı (%) = Geçti sayısı ÷ Toplam kayıt sayısı.
    // Veri yoksa null (— olarak gösterilir), "ne ödül ne ceza" ilkesiyle tutarlı.
    const iiGeciSayisi = iiKayitlari.filter(r => r.sonuc === 'Geçti').length;
    const iiGeciOrani = iiKayitlari.length > 0 ? Math.round((iiGeciSayisi / iiKayitlari.length) * 100) : null;

    // Genel Performans (%): iki hedefin (Teknik Değerlendirme + İkinci
    // Inspection) ortalamaya göre gerçekleşme oranının ortalaması. Sadece
    // veri olan metrik(ler) hesaba katılır — "ne ödül ne ceza" ilkesiyle
    // tutarlı: hiç verisi olmayan metrik yüzdeyi ne yükseltir ne düşürür.
    const tdOran = tdOrtalama !== null ? (tdOrtalama / hedefTD) * 100 : null;
    const iiOran = iiOrtalama !== null ? (iiOrtalama / hedefII) * 100 : null;
    const oranlar = [tdOran, iiOran].filter(o => o !== null);
    const genelPerf = oranlar.length > 0 ? Math.round(oranlar.reduce((a,b)=>a+b,0) / oranlar.length) : null;

    return { kullanici, tdBugun, tdOrtalama, tdGunSayisi: isGunuSayisi,
             iiGeciSayisi, iiGeciOrani,
             iiBugun, iiOrtalama, iiGunSayisi: isGunuSayisi, genelPerf };
  });
  window._tiDashboardSatirlari = satirlar; // Excel'e aktarım için önbellek

  const rozet = (deger, hedef) => {
    if (deger === null) return `<span style="font-size:10px;color:var(--muted2);font-style:italic">veri yok</span>`;
    const basarili = deger >= hedef;
    return `<span style="font-weight:700;color:${basarili ? '#2E7D32' : '#C62828'}">${deger.toFixed(1)}</span>`;
  };
  const bugunRozet = (deger, hedef) => {
    const basarili = deger >= hedef;
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;background:${basarili ? '#E8F5E9' : '#FFEBEE'};color:${basarili ? '#2E7D32' : '#C62828'};border:1px solid ${basarili ? '#A5D6A7' : '#EF9A9A'};border-radius:99px;font-size:12px;font-weight:700">${deger}/${hedef}</span>`;
  };

  const genelPerfRozet = (deger) => {
    if (deger === null) return `<span style="font-size:10px;color:var(--muted2);font-style:italic">—</span>`;
    const color = deger >= 100 ? '#2E7D32' : (deger >= 70 ? '#F57F17' : '#C62828');
    return `<span style="display:inline-flex;align-items:center;padding:3px 11px;background:${deger>=100?'#E8F5E9':(deger>=70?'#FFF8E1':'#FFEBEE')};color:${color};border-radius:99px;font-size:12.5px;font-weight:700">${deger}%</span>`;
  };

  const satirHtml = satirlar.map(s => `
    <tr>
      <td style="padding:8px 10px;font-size:12.5px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(s.kullanici))}</td>
      <td style="padding:8px 10px;text-align:center">${bugunRozet(s.tdBugun, hedefTD)}</td>
      <td style="padding:8px 10px;text-align:center;font-size:12px">${rozet(s.tdOrtalama, hedefTD)} <span style="color:var(--muted2);font-size:10.5px">(${s.tdGunSayisi} iş günü)</span></td>
      <td style="padding:8px 10px;text-align:center">${bugunRozet(s.iiBugun, hedefII)}</td>
      <td style="padding:8px 10px;text-align:center;font-size:12px">${rozet(s.iiOrtalama, hedefII)} <span style="color:var(--muted2);font-size:10.5px">(${s.iiGunSayisi} iş günü)</span></td>
      <td style="padding:8px 10px;text-align:center">${genelPerfRozet(s.genelPerf)}</td>
    </tr>
  `).join('');

  const isAdmin = !currentUser || currentUser.isAdmin;
  const hedefAyarlariHtml = isAdmin ? `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px dashed var(--border2)">
      <span style="font-size:11.5px;font-weight:700;color:var(--navy)">⚙️ Günlük Hedefler (Admin):</span>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin:0">
        Teknik Değerlendirme: <input type="number" id="ti-hedef-degerlendirme" min="1" value="${hedefTD}" style="width:60px;padding:4px 6px;font-size:12px">
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin:0">
        İkinci Inspection: <input type="number" id="ti-hedef-ikinci-inspection" min="1" value="${hedefII}" style="width:60px;padding:4px 6px;font-size:12px">
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin:0" title="Bu tarihten itibaren, tüm değerlendiriciler için ortak başlangıç günü olarak kullanılır — kişinin kendi ilk kaydı yerine bu tarih baz alınır.">
        📅 Teknik Değ. Başlangıç Günü: <input type="date" id="ti-hedef-baslangic-tarihi" value="${teknikHedefler.baslangicTarihi || ''}" style="padding:4px 6px;font-size:12px">
      </label>
      <button class="btn btn-primary" onclick="kaydetTeknikHedefler()" style="padding:6px 14px;font-size:12px">💾 Hedefleri Kaydet</button>
      <span style="font-size:10.5px;color:var(--muted2);font-style:italic">Haftalık referans (6 iş günü): ${hedefTD*6} teknik değerlendirme · ${hedefII*6} ikinci inspection</span>
    </div>
  ` : '';

  wrap.innerHTML = satirlar.length === 0 ? `
    <div class="empty" style="padding:16px 20px">
      <div class="empty-icon">🎯</div>
      <h3>Henüz veri girişi yok</h3>
      <p style="font-size:12px;color:var(--muted)">Teknik Değerlendirme veya İkinci Inspection girildikçe burada günlük hedef takibi görünecek.</p>
    </div>
    ${hedefAyarlariHtml}
  ` : `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border2)">
        <th style="text-align:left;padding:8px 10px;font-size:10.5px;color:var(--muted);text-transform:uppercase">Kullanıcı</th>
        <th style="text-align:center;padding:8px 10px;font-size:10.5px;color:var(--muted);text-transform:uppercase">Bugün Teknik Değ.</th>
        <th style="text-align:center;padding:8px 10px;font-size:10.5px;color:var(--muted);text-transform:uppercase">Ort. Teknik Değ./Gün</th>
        <th style="text-align:center;padding:8px 10px;font-size:10.5px;color:var(--muted);text-transform:uppercase">Bugün İkinci Insp.</th>
        <th style="text-align:center;padding:8px 10px;font-size:10.5px;color:var(--muted);text-transform:uppercase">Ort. İkinci Insp./Gün</th>
        <th style="text-align:center;padding:8px 10px;font-size:10.5px;color:var(--muted);text-transform:uppercase">Genel Performans</th>
      </tr></thead>
      <tbody>${satirHtml}</tbody>
    </table>
    ${hedefAyarlariHtml}
  `;
}


// ─── Teknik İnceleme + İkinci Inspection — Birleşik, Şifre Korumalı Temizleme
// (kullanıcı talebiyle: eski 2 ayrı buton kaldırıldı, üstteki Yenile'nin
// yanına TEK bir Temizle butonu eklendi). Şifre PHP'de (Tema3245) doğrulanır,
// burada hiç saklanmaz — sadece kullanıcının girdiği değer sunucuya gönderilir.
// Buton zaten sadece admin'e görünür (applyUserPermissions ile gizlenir),
// ama şifre kontrolü ekstra bir güvenlik katmanı olarak burada da kalır.
async function temizleTeknikVeIkinciInspectionVerileri() {
  if (!currentUser || !currentUser.isAdmin) { alert('⚠️ Bu işlem sadece admin tarafından yapılabilir.'); return; }

  const sifre = prompt('⚠️ İkinci Inspection VE Teknik İnceleme kayıtlarının TAMAMINI silmek için şifreyi girin:');
  if (sifre === null) return; // İptal edildi
  if (!sifre.trim()) { alert('Şifre boş olamaz.'); return; }
  if (!confirm('⚠️ Hem İkinci Inspection hem Teknik İnceleme kayıtlarının TAMAMI silinecek!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?')) return;

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('Sunucu bağlantısı yapılandırılmamış.'); return; }

  const btn = document.getElementById('ti-clear-all-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Siliniyor...'; }
  try {
    const respTi = await jsonpFetch(url, { action: 'clearTeknikIncelemeSkorlar', token, sifre });
    if (!respTi || respTi.status !== 'ok') {
      alert('❌ ' + (respTi?.message || 'Şifre yanlış — hiçbir veri silinmedi.'));
      return;
    }
    const respIi = await jsonpFetch(url, { action: 'clearIkinciInspection', token, sifre });
    if (!respIi || respIi.status !== 'ok') {
      alert('⚠️ Teknik İnceleme kayıtları silindi, ancak İkinci Inspection silinirken hata oluştu: ' + (respIi?.message || 'bilinmeyen hata'));
    }

    teknikSkorlar = [];
    ikinciInspectionData = [];
    saveTeknikIncelemeToLocalStorage();
    try { localStorage.setItem('lc_ikinci_inspection_cache', JSON.stringify(ikinciInspectionData)); } catch(e) {}

    renderTiSkorOzet();
    renderTiKayitlarTablo();
    renderIkinciInspectionTablo();
    renderTiDashboard();
    if (typeof renderDashboard === 'function' && document.getElementById('inspector-grid')) renderDashboard();
    showSuccessMessage('✅ İkinci Inspection ve Teknik İnceleme kayıtları silindi!');
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Temizle'; }
  }
}
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INIT & EVENT LISTENERS
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
_teamManagersOpen = false; // Sayfa yuklenirken kesin olarak kapali baslat (guvenlik onlemi)
loadData();
loadKayipZamanFromLocalStorage();
if (typeof updateKayipNavBadge === 'function') updateKayipNavBadge();
loadConfig();
renderListe();
renderEditor();
renderDashboard();
renderPerfTabloFromData();
updateSidebar();

// Şifre kapısını başlat
initPasswordGate();

// Modal kapatma - dış tıklama
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.getElementById('detail-modal').addEventListener('click', function(e) {
  if (e.target === this) closeDetailModal();
});

// Drag & Drop desteği
const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  this.style.borderColor = 'var(--blue3)';
  this.style.backgroundColor = 'var(--lblue2)';
});

uploadZone.addEventListener('dragleave', function(e) {
  e.preventDefault();
  this.style.borderColor = 'var(--border)';
  this.style.backgroundColor = 'var(--lblue3)';
});

uploadZone.addEventListener('drop', function(e) {
  e.preventDefault();
  this.style.borderColor = 'var(--border)';
  this.style.backgroundColor = 'var(--lblue3)';
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const fileInput = document.getElementById('file-input');
    fileInput.files = files;
    excelYukle({ target: fileInput });
  }
});

// Otomatik kaydetme (5 dakikada bir)
setInterval(function() {
  if (klasmanlar.length > 0 || performansData.length > 0) {
    saveData();
    console.log('🔄 Otomatik kaydetme yapıldı');
  }
}, 5 * 60 * 1000);

// Sayfa kapatılırken uyarı
window.addEventListener('beforeunload', function(e) {
  const lastSaved = localStorage.getItem('lc_inspection_data');
  if (lastSaved) {
    try {
      const data = JSON.parse(lastSaved);
      const savedTime = new Date(data.savedAt || 0);
      const now = new Date();
      const diffMinutes = (now - savedTime) / (1000 * 60);
      
      if (diffMinutes > 10) {
        e.preventDefault();
        e.returnValue = 'Değişiklikleriniz kaydedilmemiş olabilir. Sayfadan çıkmak istediğinizden emin misiniz?';
        return e.returnValue;
      }
    } catch (err) {
      e.preventDefault();
      e.returnValue = 'Verileriniz kaydedilmemiş olabilir. Sayfadan çıkmak istediğinizden emin misiniz?';
      return e.returnValue;
    }
  }
});

// Sayfa görünürlük değişiminde slideshow'u duraklat
document.addEventListener('visibilitychange', function() {
  if (document.hidden && slideshowActive) {
    // Sayfa gizlendiğinde slideshow'u duraklat
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
    }
    if (progressInterval) {
      clearInterval(progressInterval);
    }
  } else if (!document.hidden && slideshowActive) {
    // Sayfa tekrar görünür olduğunda slideshow'u devam ettir
    startAutoSlide();
  }
});

// Network durumu kontrolü
window.addEventListener('online', function() {
  console.log('🌐 İnternet bağlantısı geri geldi');
});

window.addEventListener('offline', function() {
  console.log('🌐 İnternet bağlantısı kesildi - Veriler yerel olarak saklanmaya devam ediyor');
});

// Hover efektleri
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('mouseover', function(e) {
    if (e.target.closest('.summary-stat')) {
      const card = e.target.closest('.summary-stat');
      const value = card.querySelector('.summary-stat-value');
      if (value) value.style.transform = 'scale(1.05)';
    }
  });

  document.addEventListener('mouseout', function(e) {
    if (e.target.closest('.summary-stat')) {
      const card = e.target.closest('.summary-stat');
      const value = card.querySelector('.summary-stat-value');
      if (value) value.style.transform = 'scale(1)';
    }
  });
});

// Başarı mesajı gösterimi
function showSuccessMessage(message, duration = 3000) {
  const notification = document.getElementById('save-notification');
  notification.textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, duration);
}

// Hata mesajı gösterimi
function showErrorMessage(message) {
  alert('❌ Hata: ' + message);
}

// Versiyon kontrolü ve güncelleme bildirimi
const APP_VERSION = '2.2.0';
const LAST_VERSION_KEY = 'lc_inspection_last_version';

function checkVersion() {
  const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
  if (lastVersion !== APP_VERSION) {
    console.log(`🎉 Inspection Panel güncellendi! v${lastVersion || '1.0.0'} → v${APP_VERSION}`);
    localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
    
    if (lastVersion) {
      showSuccessMessage(`🎉 Panel güncellendi! v${APP_VERSION}`, 5000);
    }
  }
}

checkVersion();

// Son güncelleme tarihi gösterimi
function showLastUpdateTime() {
  try {
    const saved = localStorage.getItem('lc_inspection_data');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.savedAt) {
        const lastUpdate = new Date(data.savedAt);
        const now = new Date();
        const diffMinutes = Math.round((now - lastUpdate) / (1000 * 60));
        
        if (diffMinutes < 60) {
          console.log(`📅 Son güncelleme: ${diffMinutes} dakika önce`);
        } else if (diffMinutes < 1440) {
          console.log(`📅 Son güncelleme: ${Math.round(diffMinutes/60)} saat önce`);
        } else {
          console.log(`📅 Son güncelleme: ${lastUpdate.toLocaleDateString('tr-TR')}`);
        }
      }
    }
  } catch (err) {
    console.log('📅 Son güncelleme bilgisi alınamadı');
  }
}

// Sayfa yüklendiğinde son güncelleme zamanını göster
showLastUpdateTime();

// Konsol mesajları ve yardım
console.log(`
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    LC WAİKİKİ INSPECTION                                                     ║
║                                   PERFORMANS PANELİ v${APP_VERSION}                                                     ║
║                                                                                                              ║
║  🎯 Inspector performanslarını analiz edin                                                                   ║
║  📊 Excel verilerini yükleyin ve raporlayın                                                                 ║
║  ⚙️  Klasman tanımlarını yönetin                                                                             ║
║  🎬 Canlı gösterim ile büyük ekranda izleyin                                                                ║
║                                                                                                              ║
║  ✅ Performans Hesaplama: Standart Süre ÷ Mesai Süresi × 100                                                ║
║  📅 Mesai Süresi: Günlük 7.5 saat × çalışma gün sayısı                                                     ║
║  🎯 Hedef: %100 = tam verimlilik, %100+ = hedeften hızlı                                                    ║
║                                                                                                              ║
║  📺 CANLI GÖSTERİM KLAVYE KOMUTLARI (Tam Ekranda):                                                          ║
║  • → / Space: Sonraki slide                                                                                 ║
║  • ←: Önceki slide                                                                                           ║
║  • P: Oynat/Duraklat                                                                                        ║
║  • F: Tam ekran aç/kapat                                                                                    ║
║  • Escape: Çıkış                                                                                            ║
║  • Mouse: Sol yarı = önceki, sağ yarı = sonraki                                                             ║
║                                                                                                              ║
║  🔧 GENEL KLAVYE KISAYOLLARI:                                                                                ║
║  • Ctrl+S: Kaydet                                                                                           ║
║  • Ctrl+N: Yeni Klasman (Klasman sayfasında)                                                                ║
║  • Escape: Modal Kapat                                                                                      ║
║                                                                                                              ║
║  📈 ÖZELLİKLER:                                                                                              ║
║  • Gerçek zamanlı performans hesaplama                                                                      ║
║  • Klasman bazında detaylı analiz                                                                           ║
║  • Excel import/export desteği                                                                              ║
║  • Responsive tasarım                                                                                       ║
║  • Otomatik kaydetme                                                                                        ║
║  • Drag & drop dosya yükleme                                                                                ║
║  • Canlı slideshow gösterimi                                                                                ║
║  • Tam ekran desteği                                                                                        ║
║  • Sol panel: En iyi 10 inspector                                                                           ║
║                                                                                                              ║
║  💡 İPUCU: Performans verileri localStorage'da otomatik kaydedilir                                           ║
║                                                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
`);

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
