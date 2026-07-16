/* ============================================================
   GLOBAL STATE - dosyanin en basinda tanimlanir, init kodu
   calismadan once kesin olarak hazir olsun diye
   ============================================================ */
let _teamManagersOpen = false; // Ekip Yoneticileri bolumu - default kapali

// ── Teknik İnceleme modülü state'i (v5.11) ──────────────────────────────────
// NOT: Bu değişkenler burada, dosyanın en başında tanımlanmalı. Aşağıdaki
// "INIT & EVENT LISTENERS" bölümü sayfa yüklenirken senkron olarak
// renderDashboard() çağırıyor; bu da renderInspectorCards() üzerinden
// teknikSkorlar'a erişiyor. Bu değişkenler dosyanın sonunda tanımlansaydı,
// henüz initialize olmadan (TDZ) erişilmeye çalışılır ve tüm script'in
// yüklenmesi burada çöker (sayfa hiç açılmaz) — bu yüzden en başta olmalılar.
const TI_SKOR_LS_KEY   = 'lc_teknik_inceleme_skor_cache';
const TI_KRITER_LS_KEY = 'lc_teknik_inceleme_kriter_cache';
let teknikKriterler = [];   // [{id, metin, puan, aktif, sira}]
let teknikSkorlar   = [];   // ham cevap satırları [{id, inspector, degerlendiren, tarih, kriterId, kriterMetin, maxPuan, tikli, kazanilanPuan, aciklama, savedAt}]
const TI_BASARI_ESIGI = 85; // Değerlendirme başına başarı eşiği (%) — bu ve üstü "Başarılı" sayılır

// ─── Az Veri Uyarı Eşiği (kullanıcı talebiyle) ───
// Bir inspector'ın çalışma gün sayısı bu eşiğin ALTINDAYSA, performans
// sıralamalarında (Dashboard kartı, En İyi 10 listesi, Genel Performans
// tablosu) "⚠️ az veri" rozeti gösterilir. AMA sıralamadan/listeden
// ÇIKARILMAZ — sadece az veriye dayandığı görsel olarak belirtilir
// (ör. 1 günlük bir performans, 44 günlük ortalamayla aynı ağırlıkta
// görünüp yanıltıcı olabiliyordu).
const AZ_VERI_GUN_ESIGI = 10;
function azVeriMi(gunSayisi) {
  return (gunSayisi || 0) < AZ_VERI_GUN_ESIGI;
}
function azVeriRozetiHtml(stil) {
  // stil: 'inline' (küçük metin) | 'badge' (renkli kutu)
  if (stil === 'badge') {
    return `<span title="Bu performans ${AZ_VERI_GUN_ESIGI} günden az çalışma verisine dayanıyor — dikkatli yorumlayın" style="font-size:8.5px;font-weight:700;background:#FFF3E0;color:#E65100;padding:2px 6px;border-radius:8px;letter-spacing:.3px;margin-left:5px;white-space:nowrap;">⚠️ az veri</span>`;
  }
  return `<span title="Bu performans ${AZ_VERI_GUN_ESIGI} günden az çalışma verisine dayanıyor — dikkatli yorumlayın" style="color:#E65100;font-weight:600;">⚠️ az veri</span>`;
}

// Admin'in yüklediği resmi "Teknik İnceleme" checklist formundaki 21 madde (toplam 100 puan).
// "Varsayılan Soruları Yükle" butonuyla tek tıkla kriter listesine eklenir.
const TI_DEFAULT_KRITERLER = [
  { metin: '1. Mobil inspection ürün al yapma işleminde İş emri veya Talep numarası kontrolü doğru yapıldı mı?', puan: 2 },
  { metin: '2. Gold Seal Kontrolü ve Ürün ile Gold Seal karşılaştırılması yapıldı mı?', puan: 5 },
  { metin: '3. Barkod Okutması yapıldı mı? (her bedenden 1er adet iç-dış barkod)', puan: 2 },
  { metin: '4. Lot İçi adet Kontrolü (Asorti) yapıldı mı?', puan: 2 },
  { metin: '5. Aynı lotta renk/tuşe farkı kontrolü yapıldı mı?', puan: 2 },
  { metin: '6a. Ölçü Kontrolü - Talimatta belirtilen adette ölçü kontrolü yapıldı mı?', puan: 5 },
  { metin: "6b. Ölçü Kontrolü - Ölçü kontrolü işlemleri 'ST-203 How to Measure'a göre uygun yapıldı mı?", puan: 10 },
  { metin: '6c. Ölçü Kontrolü - Ölçü Kontrol Sonucu sisteme doğru şekilde girildi mi?', puan: 6 },
  { metin: '6d. Ölçü Kontrolü - Fit Kontrolü - Ürün Giydirme - Resim Çekme yapıldı mı?', puan: 2 },
  { metin: '7a. Saat Yönünde Kontrol - Üst/Alt gruplarda doğru bölgeden başlayarak saat yönünde kontrol yapıldı mı?', puan: 20 },
  { metin: '7b. Saat Yönünde Kontrol - Etiketler kontrol edildi mi?', puan: 4 },
  { metin: '7c. Saat Yönünde Kontrol - Tüm dikişler kontrol edildi mi?', puan: 4 },
  { metin: '7d. Saat Yönünde Kontrol - Simetri kontrolü yapıldı mı?', puan: 4 },
  { metin: '7e. Saat Yönünde Kontrol - Ürünlerin tersi kontrol edildi mi?', puan: 4 },
  { metin: '8. Görsel Optik Kontrol (saat yönünde kontrol sonrası kalan adetler için) doğru yapıldı mı?', puan: 10 },
  { metin: '9. Saat yönünde kontrolde çıkan hatalar görsel optik kontrolde takip edildi mi?', puan: 2 },
  { metin: '10. Hataların Kritik/Majör/Minör olarak sınıflandırılması doğru yapıldı mı?', puan: 2 },
  { metin: '11. Bulunan hataların Mobil inspection standartlarına göre resimleri çekildi mi?', puan: 2 },
  { metin: '12. Pull Test - Gramaj Uygulamaları yapıldı mı?', puan: 2 },
  { metin: '13. Ticari karara hazırlama / paketleme tasnifi doğru yapıldı mı?', puan: 2 },
  { metin: '14. Zamanı etkin kullanıyor mu?', puan: 8 }
];
// Not: loadTeknikIncelemeFromLocalStorage / loadTeknikKriterFromLocalStorage
// fonksiyonları dosyanın altında tanımlı (function hoisting sayesinde burada
// çağrılabilirler); localStorage cache'ini en erken noktada belleğe alır.
try { if (typeof loadTeknikIncelemeFromLocalStorage === 'function') loadTeknikIncelemeFromLocalStorage(); } catch(e) {}
try { if (typeof loadTeknikKriterFromLocalStorage === 'function') loadTeknikKriterFromLocalStorage(); } catch(e) {}


/* ============================================================
   ÇEVIRI / TRANSLATION SYSTEM
   ============================================================ */
const translations = {
  tr: {
    // Login
    login_title:          'Giriş Yap',
    login_sub:            'Şifrenizi girerek devam edin',
    login_btn:            '🔓 Giriş Yap',
    password_placeholder: '••••••',
    username_placeholder: 'Kullanıcı adı (admin için boş bırakın)',
    server_active:        'Sunucu doğrulaması aktif',
    cancel:               'İptal',
    nav_user_mgmt:        'Kullanıcı Yönetimi',
    logout_btn:           'Çıkış Yap',
    change_my_pw:         '✏️ Şifremi Değiştir',

    // Top bar
    how_it_works:         'ℹ️ Nasıl Çalışır',
    klasman:              'Klasman',

    // Sidebar nav
    nav_home:             'Ana Sayfa',
    nav_dashboard:        'Dashboard',
    nav_management:       'Yönetim',
    nav_klasman_mgmt:     'Klasman Yönetimi',
    nav_analysis:         'Analiz',
    nav_klasman_analysis: 'Klasman Analizi',
    nav_perf_analysis:    'Performans Analizi',
    nav_display:          'Görüntüleme',
    nav_live:             'Canlı Gösterim',

    // Dashboard page
    dash_title:           'Inspector Performans Dashboard',
    dash_sub:             'Tüm inspectörlerin performans durumunu tek ekranda izleyin',
    pull_from_sheets:     '📥 Sheets\'ten Çek',
    clear:                '🗑️ Temizle',
    export_excel:         '📊 Excel\'e Aktar',

    // Summary stats
    stat_total_inspector: 'Toplam Inspector',
    stat_excellent:       'Mükemmel (≥95%)',
    stat_good:            'İyi (85-94%)',
    stat_average:         'Orta (70-84%)',
    stat_poor:            'Zayıf (50-69%)',
    stat_verypoor:        'Çok Zayıf (<50%)',
    stat_avg_perf:        '📅 Ortalama Performans',
    stat_avg_days:        '⏰ Ortalama Çalışma Günü',
    stat_total_product:   '📦 Toplam Ürün',

    // Filters
    filter_perf:          'Performans Filtresi:',
    filter_all:           'Tümü',
    filter_klasman:       'Klasman Filtresi:',
    filter_all_klasman:   'Tüm Klasmanlar',
    filter_search:        'Inspector Ara:',
    inspector_search_ph:  'Inspector adı...',
    filter_sort:          'Sıralama:',
    sort_perf_desc:       'Performans (Yüksek→Düşük)',
    sort_perf_asc:        'Performans (Düşük→Yüksek)',
    sort_name_asc:        'İsim (A→Z)',
    sort_name_desc:       'İsim (Z→A)',
    sort_qty_desc:        'Adet (Çok→Az)',
    sort_qty_asc:         'Adet (Az→Çok)',

    // Empty state
    no_data_yet:          'Henüz performans verisi yok',
    no_data_sub:          'Performans Analizi sayfasından Excel yükleyip analiz yapın',

    // Pagination
    prev:                 '‹ Önceki',
    next:                 'Sonraki ›',

    // Login dynamic states (JS ile üretilen)
    verifying:            '⏳ Doğrulanıyor...',
    connecting:           'Sunucuya bağlanılıyor...',
    verified:             'Doğrulandı ✓',
    error_label:          'Hata',
    pw_empty:             '❌ Şifre boş olamaz',
    pw_wrong:             '❌ Yanlış şifre, tekrar deneyin',
    pw_no_server_cache:   '⚠️ Sunucuya bağlanılamadı ve önbellek bulunamadı. İnternet bağlantınızı kontrol edin.',
    pw_offline:           'Çevrimdışı doğrulama (önbellek)',
    pw_no_sheets_pw:      'Sheets\'te şifre bulunamadı',
    pw_unreachable:       'Sunucuya ulaşılamadı',
    pw_wrong_klasman:     'Yanlış şifre!',
    pw_overlay_title:     'Giriş Yap',
    pw_overlay_sub:       'Devam etmek için şifrenizi girin',
    pw_klasman_title:     'Klasman Yönetimi',
    pw_klasman_sub:       'Bu bölüme erişmek için şifre gereklidir',
    // Dynamic JS strings
    sending:              '⏳ Gönderiliyor...',
    pulling:              '⏳ Çekiliyor...',
    no_data_js:           'Veri yok',
    no_data_js_hint:      'Önce Performans Analizi sayfasından Excel yükleyin',
    data_not_found:       'Veri bulunamadı',
    days_suffix:          'gün',
    days_suffix_short:    'gün',
    filter_none:          '— Filtre yok (tüm satırlar) —',
    detailed_perf:        'Detaylı Performans',
    loading_records:      'Kayıt detayları yükleniyor...',
    sampling_desc:        '<span data-i18n="sampling_off">Kapalı: gerçek adet kullanılır.</span> <strong data-i18n="one_below">Bir Alttan</strong> / <strong data-i18n="two_below">İki Alttan</strong>: <span data-i18n="sampling_desc_end">adet örnekleme tablosuna göre dönüştürülür.</span>',
    target_below_100:     'hedef → performans',
    target_above_100:     'hedef → performans',
    start_slideshow:      'Gösterimi Başlat',
    stop_slideshow:       '⏸ Durdur',
    no_perf_alert:        'Henüz performans verisi yok! Önce Performans Analizi sayfasından veri yükleyin.',
    records_summary:      'kayıt · ',
    units_summary:        'adet · ',
    analyzing:            'Analiz ediliyor...',
    col_overtime_label:   '⏰ Mesai Süresi',
    // Card & JS dynamic labels
    working:              'gün çalışma',
    units_short:          'adet',
    klasman_word:         'klasman',
    efficiency_label:     'verimlilik',
    above_target:         'hedeften hızlı',
    below_target:         'hedeften yavaş',
    overtime_over:        'mesai üstü',
    detailed_analysis:    'Detaylı Analiz',
    perf_excellent:       'Mükemmel',
    perf_good:            'İyi',
    perf_average:         'Orta',
    perf_poor:            'Zayıf',
    perf_weak:            'Zayıf',
    perf_verypoor:        'Çok Zayıf',
    stat_total_product2:  'TOPLAM ADET',
    std_duration_label:   'STANDART SÜRE',
    adj_perf_label_upper: 'DÜZ. PERFORMANS',
    best_inspector_month: 'Ayın En İyi Inspector\'ü',
    // Final remaining keys
    excel_cols_hint:      'Excel dosyanızda A Klasman, R BakilacakMiktar, K BaşlamaTarihi, L BitişTarihi sütunları bulunmalıdır.',
    overtime_col_hint:    'Mesai sütunu seçilmezse günlük 7.5s × gün bazında hesaplanır.',
    col_t_label:          'Sütun (T)',
    blank_rows_hint:      'Seçilirse boş satırlar hesaplamaya dahil edilmez.',
    security_warning:     'Güvenlik Uyarısı:',
    try_other_model:      'Hata alırsan farklı model dene',
    default_opt:          'Varsayılan',
    sort_by_date:         'Tarihe Göre ↑',
    sampling_off:         'Kapalı: gerçek adet kullanılır.',
    one_below:            'Bir Alttan',
    sampling_desc_end:    'adet örnekleme tablosuna göre dönüştürülür.',
    // New dynamic keys
    closed_label:         'Kapalı',
    open_label:           'Açık',
    hide_label:           'Gizle',
    raw_avg:              'Ham Ort.:',
    perf_formula:         'Standart Süre ÷ (Gün × 7.5s) × 100',
    adj_formula:          'Ham Perf × (100÷${hedef})',
    records_word:         'kayıt',
    days_x_formula:       'gün × 7.5s = {h}s mesai bazlı',
    avg_perf_plain:       'Ortalama Performans',
    stat_avg_perf_plain:  'Ortalama Performans',
    ai_overtime_prompt:   'Mesai süresi ve mesai üstü durumunu analiz et. Yoğunluk ne zaman en yüksek? Mesai yönetimi nasıl?',
    waiting_best_inspector: 'Ayın En İyi Inspector\'ü bekleniyor...',
    // Extended i18n keys
    actual_duration_th:    'Gerçekleşen Süre',
    actual_label:          '⏱ Gerçekleşen',
    actual_per_unit:       'Gerçekleşen/Adet',
    actual_vs_std:         'Gerçekleşen / Standart oranı',
    add_first_station:     'Bu klasmanı tanımlamaya başlamak için ilk istasyonu ekleyin',
    add_station:           '＋ İstasyon Ekle',
    adj_avg_perf:          'Düz. Ort. Performans:',
    adj_avg_short:         '⚡ Düz. Ort.:',
    adj_perf_label:        'Düz. Performans',
    ai_custom_q:           '💬 Özel Soru Sor',
    ai_general:            '📊 Genel Performans Değerlendirmesi',
    ai_improve:            '💡 İyileştirme Önerileri',
    ai_klasman_compare:    '👔 Klasmana Göre Karşılaştırma',
    ai_overtime:           '🌙 Mesai & Yoğunluk Analizi',
    ai_panel_hint:         'AI destekli detaylı analiz · Açmak için tıklayın',
    ai_strengths:          '💪 Güçlü/Zayıf Yönler',
    all_btn:               'Tümü',
    all_inspectors:        'Tüm Inspectorler',
    api_key_warning:       '⚠️ Anahtarınızı başkalarıyla paylaşmayın.',
    api_token_hint:        '(Apps Script\'teki API_TOKEN değeriyle eşleşmeli)',
    apiscript_match_hint:  'Apps Script dosyasındaki değerle eşleşmeli',
    app_subtitle:          'Inspection Kontrol',
    avg_work_days:         '📆 Ort. Çalışma:',
    awaiting_results:      'Analiz sonuçları bekleniyor',
    broadcast_settings:    'Yayın Ayarları',
    broadcast_settings_hint: 'Gösterimi başlatmadan önce ayarlayın',
    cancel_btn:            'İptal',
    change_klasman_pw:     '✏️ Klasman Şifresini Değiştir',
    change_pw:             '✏️ Şifreyi Değiştir',
    change_search:         'Arama kriterlerini değiştirin',
    col_auto_derive:       '— K/L sütunlarından otomatik türet —',
    col_end_date:          'Bitiş Tarihi (L)',
    col_inspector:         'Inspector Sütunu',
    col_klasman:           'Klasman Sütunu (A)',
    col_mapping_title:     '🔗 Sütun Eşleştirme',
    col_start_date:        'Başlangıç Tarihi (K)',
    completed_btn:         '✅ Tamamlandı',
    current_pw:            'Mevcut şifre:',
    current_time:          'Şu Anki Saat',
    // Kullanıcı Yönetimi
    user_mgmt_title:       '👥 Kullanıcı Yönetimi',
    user_mgmt_sub:         'Kullanıcı ekleyin, düzenleyin ve hangi sekmeleri görebileceklerini belirleyin',
    refresh:               'Yenile',
    add_user:              'Yeni Kullanıcı',
    user_list:             'Kullanıcılar',
    username_col:          'Kullanıcı Adı',
    tabs_col:              'Görebileceği Sekmeler',
    actions_col:           'İşlemler',
    loading:               'Yükleniyor…',
    user_mgmt_hint:        'Kullanıcılar admin şifresi yerine kendi kullanıcı adı/şifresi ile giriş yapar. Burada verilen sekmeler dışındaki bölümleri göremezler. Dashboard her kullanıcıya açıktır.',
    user_modal_hint:       'Kullanıcı adı, şifre ve görebileceği sekmeleri belirleyin',
    username_label:        'Kullanıcı Adı',
    password_label:        'Şifre',
    password_hint:         'En az 4 karakter',
    password_hint_edit:    'Değiştirmek istemiyorsanız boş bırakın',
    select_tabs:           'Görebileceği Sekmeler',
    save_btn:              '💾 Kaydet',
    edit_btn:              '✏️ Düzenle',
    delete_btn:            '🗑️ Sil',
    no_users:              'Henüz kullanıcı eklenmemiş',
    admin_row_note:        'Tüm sekmelere erişebilir',
    // Ekip Yönetimi (Dashboard)
    my_team_title:         '👥 Ekibim',
    manage_team:           'Ekibi Düzenle',
    other_teams_btn:       'Diğer Ekipler',
    other_teams_title:     'Ekip Performansları',
    other_teams_empty:     'Başka ekip yöneticisi bulunamadı.',
    team_member_count:     'Ekip Üyesi',
    team_avg_perf:         'Ekip Ort. Performans',
    team_total_product:    'Ekip Toplam Ürün',
    team_avg_days:         'Ekip Ort. Çalışma Günü',
    team_empty_hint:       'Henüz ekibinize inspector eklemediniz. "Ekibi Düzenle" butonuyla başlayın.',
    remove_from_team:      'Ekipten çıkar',
    team_modal_title:      '👥 Ekibimi Düzenle',
    team_modal_sub:        'Takip etmek istediğiniz inspectorleri seçin',
    team_search_ph:        'Inspector ara...',
    team_no_result:        'Sonuç bulunamadı',
    team_only_filter:      '👥 Sadece Ekibim',
    team_remove_confirm:   'ekipten çıkarılsın mı?',
    team_managers_label:   'Ekip Yöneticileri',
    team_manager_prefix:   'Ekip Yöneticisi',
    team_manager_member_count: 'Çalışan Sayısı',
    team_manager_total_qty:    'Kontrol Edilen Adet',
    team_manager_avg_perf:     'Performans Ortalaması',
    team_manager_no_members:   'Bu ekibe henüz inspector eklenmemiş.',
    nav_ekip_analiz:       'Ekibim Analizi',
    ekip_analiz_title:     '🧑‍🤝‍🧑 Ekibim Analizi',
    ekip_analiz_sub:       'Ekip üyelerinizin performansını klasman bazında karşılaştırın',
    ekip_analiz_top_producer:     'En Çok Üretim',
    ekip_analiz_general_ranking:  'Genel Performans Sıralaması',
    ekip_analiz_col_name:         'Inspector',
    ekip_analiz_col_perf:         'Performans',
    ekip_analiz_col_qty:          'Toplam Adet',
    ekip_analiz_col_klasman_count: 'Klasman Sayısı',
    ekip_analiz_dist_title:       'Performans Dağılımı',
    ekip_analiz_uretim_title:     'Verimlilik / Adet Dağılımı',
    ekip_analiz_daily_avg:        'Günlük ortalama adet',
    general_status_label:  'Genel Durum',
    display_not_started:   'Gösterim başlamadı',
    download_excel:        '📊 Excel İndir',
    end_date_th:           'Bitiş',
    excel_upload_title:    '📁 Excel Yükle',
    file_drop:             'Dosya seçin veya sürükleyin',
    file_format:           '.xlsx / .xls formatı',
    filter_no_result:      'Filtre sonucu bulunamadı',
    filter_no_result_hint: 'Filtre kriterlerini değiştirmeyi deneyin',
    gemini_8b:             'gemini-1.5-flash-8b (En Hızlı)',
    gemini_api_key:        'Gemini API Anahtarı',
    gemini_flash:          'gemini-2.5-flash (Önerilen)',
    gemini_lite:           'gemini-2.0-flash-lite (Ücretsiz / Hızlı)',
    gemini_pro:            'gemini-2.5-pro (En Güçlü)',
    how_to_setup:          'Nasıl kurulur? ℹ️',
    icon_modal_hint:       'Bir isim girin ve bir ikon seçin',
    inspector_detail_sub:  'Klasman bazında detaylı performans analizi',
    inspector_detail_title:'Inspector Detayları',
    klasman_analiz_overlay_sub:   'Klasman bazında detaylı performans analizi',
    klasman_analiz_overlay_title: 'Klasman Analizi — Sheets\'ten Çekildi',
    klasman_analiz_sub:    'Klasman bazında standart ve gerçekleşen birim muayene sürelerini karşılaştırın',
    klasman_analiz_title:  '🎯 Klasmana Göre Gerçekleşen Süre Analizi',
    klasman_count:         'Klasmanlar',
    klasman_details:       '📋 Klasman Detayları',
    klasman_filter_empty:  'Filtreyle eşleşen klasman bulunamadı',
    klasman_pw_hint:       'Bu sayfa için erişim şifresi:',
    klasman_pw_label:      '🔑 Klasman Yönetimi Şifresi:',
    live_h2_sub:           'Inspector performansını canlı takip edin',
    live_h2_title:         'Canlı Performans Gösterimi',
    live_page_sub:         'Inspector performanslarını büyük ekranda yayınlayın · HD video dışa aktarımı',
    live_page_title:       'Canlı Performans Gösterimi',
    login_klasman_sub:     'Bu bölüme erişmek için yönetici şifresi gereklidir',
    login_klasman_title:   'Klasman Yönetimi',
    no_data_hint:          'Analizi görmek için Excel yükleyin ve klasman tanımlarını tamamlayın',
    no_data_live:          'Henüz veri yok',
    no_perf_data:          'Performans Verisi Bulunamadı',
    no_perf_data_hint:     'Önce Performans Analizi sayfasından Excel yükleyin',
    no_records_found:      'Filtreyle eşleşen kayıt bulunamadı.',
    not_found:             'Bulunamadı',
    one_unit_check:        '1 adet muayene',
    open_link:             '🔗 Aç',
    open_link_hint:        'Tabloyu tarayıcıda açmak için kullanılır',
    opt_excellent:         'Mükemmel (≥95%)',
    opt_good:              'İyi (≥85%)',
    overtime_duration:     'Mesai Süresi',
    page_klasman_sub:      'Ürün klasmanlarını tanımlayın ve istasyon sürelerini ayarlayın',
    page_klasman_title:    'Klasman Yönetimi',
    perf_how_sub:          'Hesaplama mantığı, formüller ve Google Sheets entegrasyonu',
    perf_how_title:        '📊 Performans Analizi — Nasıl Çalışır?',
    perf_page_sub:         'Excel dosyası yükleyin ve inspector bazında performansı ölçün',
    perf_page_title:       'Performans Analizi',
    print_btn:             '🖨️ Yazdır',
    pull:                  '📥 Çek',
    pw_settings:           '🔒 Şifre Ayarları:',
    quick_analyses:        '⚡ Hızlı Analizler',
    record_count:          'Kayıt Sayısı',
    reset:                 '↺ Sıfırla',
    sampling_mode:         'Örnekleme Modu',
    sampling_date_toggle:  '📅 Tarihe Göre Farklı Seviyeler Kullan',
    sampling_date_hint:    'Aktif edildiğinde, başlangıç tarihi belirlenen aralıklara denk gelen kayıtlar o döneme ait örnekleme moduna göre hesaplanır. Aralık dışında kalan kayıtlar için yukarıdaki varsayılan mod kullanılır.',
    sampling_period_add:   '+ Dönem Ekle',
    sampling_period_max:   'En fazla 10 dönem ekleyebilirsiniz',
    sampling_period_start: 'Başlangıç',
    sampling_period_end:   'Bitiş',
    sampling_period_mode:  'Mod',
    sampling_period_remove:'Dönemi kaldır',
    sampling_default_label:'Varsayılan (aralık dışı kayıtlar)',
    mode_kapali:           'Kapalı',
    mode_bir:              'Bir Alttan',
    mode_iki:              'İki Alttan',
    see_details:           'Detayları Gör',
    select_icon:           'İkon Seç',
    select_icon_btn:       'İkon Seç',
    select_klasman:        'Bir klasman seçin',
    select_klasman_hint:   'İstasyon sürelerini düzenlemek için soldan bir klasman seçin',
    selected_icon:         'Seçilen ikon',
    send:                  '📤 Gönder',
    send_btn:              'Gönder ↵',
    send_hint:             'Ctrl+Enter ile de gönderebilirsiniz',
    sheets_conn_sub:       'Klasman verilerini Google Sheets ile senkronize edin — farklı bilgisayarlardan erişin',
    sheets_conn_title:     'Google Sheets Bağlantısı',
    sheets_help_intro:     'Klasman verilerini Google Sheets ile senkronize etmek için',
    sheets_settings_title: '🔗 Google Sheets Bağlantı Ayarları',
    sheets_table_label:    'Google Sheets Tablo Bağlantısı (Görüntüle)',
    sheets_url_label:      'Google Apps Script Web App URL\'si (Veri Gönder/Al)',
    slide_duration:        '⏱ Slayt Süresi',
    slide_flip:            'Çevirme',
    slide_slide:           'Kaydırma',
    slide_zoom:            'Yakınlaştırma',
    sort_diff_best:        'Fark ↑ (En İyi)',
    sort_diff_worst:       'Fark ↓ (En Kötü)',
    sort_label:            'Sırala:',
    start_date_th:         'Başlangıç',
    station_count:         'İstasyon Sayısı',
    status_high:           '🔴 Yüksek',
    status_near:           '⚠️ Yakın',
    std_duration:          'Standart Süre',
    std_duration_th:       'Standart Süre',
    top5:                  'İlk 10',
    total_duration_label:  'Toplam Süre (sn)',
    total_product:         'Toplam Ürün',
    total_qty:             'Toplam Adet',
    transition_effect:     '✨ Geçiş Efekti',
    two_below:             'İki Alttan',
    unit_check_duration:   '1 Birim Muayene Süresi',
    unit_check_hint:       'Ürün başına harcanan standart süre',
    view_mode:             '👁 Görüntüleme Modu',
    waiting_data:          'Veri bekleniyor',
    waiting_data_sub:      'Performans analizi çalıştırıldıktan sonra burası otomatik dolacak',
    no_overtime_data:      'Mesai verisi yok',
    gkey_empty:            '⚠️ Boş bırakmayın.',
    gkey_invalid:          '⚠️ Geçersiz format. API anahtarı çok kısa.',
    gkey_saving:           '✅ Kaydedildi! Sheets\'e gönderiliyor...',
    gkey_saved_sheets:     '✅ Anahtar kaydedildi ve Sheets\'e gönderildi!',
    gkey_saved_local:      '✅ Yerel kaydedildi (Sheets bağlantısı yok).',
    gkey_save_fail:        '❌ Kayıt başarısız: ',
    gkey_deleted:          '🗑 Anahtar silindi. Sheets\'ten temizleniyor...',
    gkey_ask_question:     'Lütfen bir soru girin.',
    gkey_no_key:           'Lütfen önce Gemini API anahtarınızı girin ve kaydedin.',
    gkey_empty_response:   'Gemini boş yanıt döndürdü.',
    gkey_api_error:        'API Hatası: ',
    gkey_check_key:        ' — API anahtarınızı kontrol edin.',
    date_filter_with:      'Tarihi Olanlar',
    date_filter_without:   'Tarihi Olmayanlar',
    analysis_result:       'Analiz Sonucu',
    clear_btn:             '✕ Temizle',
    gemini_analyzing:      'Gemini analiz ediyor...',
    custom_analysis:       '💬 Özel Analiz',
    clearing:              '⏳ Temizleniyor...',
    clear_confirm:         '⚠️ Tüm performans verileri silinecek!\n\nBu işlem:\n• Dashboard verilerini temizler\n• Google Sheets\'teki İşlem Geçmişi, Performans Verileri, PerformansRaw ve InspectorKayitlar sekmelerini siler\n\nDevam etmek istiyor musunuz?',
    clear_ok_sheets:       '✅ Veriler temizlendi! (Local + Sheets)',
    clear_ok_local_err:    '✅ Local veriler temizlendi. Sheets bağlantı hatası: ',
    clear_ok_local:        '✅ Local veriler temizlendi. (Sheets bağlantısı yapılandırılmamış)',
    clear_status:          '🗑️ Tüm performans verileri temizlendi',
    klasman_actual_analysis: 'Klasman Bazında Gerçekleşen Süre Analizi',
    total_units_summary:   'toplam adet',
    on_target:             'Hedefte',
    near_target:           'Yakın',
    high_label:            'Yüksek',
    no_std:                'Std Yok',
    std_duration_sn:       '🕐 Standart Süre (sn)',
    actual_duration_sn:    '⏱ Fiili/Mesai Süresi (sn)',
    perf_formula_inline:   '(Standart Süre ÷ Mesai Süresi) × 100',
    file_uploading:        '⏳ Dosya yükleniyor...',
    file_empty:            '❌ Dosya boş görünüyor.',
    file_loaded:           '✅ satır başarıyla yüklendi — ',
    file_error:            '❌ Hata: ',
    col_select_warning:    '⚠️ Lütfen en az Klasman, Inspector ve Adet sütunlarını seçin',
    no_data_processable:   '❌ İşlenebilir veri bulunamadı',
    analysis_done:         ' inspector başarıyla analiz edildi',
    hd_recording:          '🔴 HD Video kaydediliyor (1920×1080)...',
    // Sheets sync messages
    sheets_sent_klasman:   '✅ klasman Google Sheets\'e gönderildi!',
    sheets_updated_count:  '✅ klasman + performans verisi Sheets\'ten güncellendi!',
    sheets_loaded_perf:    '✅ inspector verisi Sheets\'ten yüklendi!',
    sheets_no_perf:        'ℹ️ Sheets\'te henüz performans verisi yok.',
    sheets_sent_perf:      '✅ inspector verisi Google Sheets\'e gönderildi!',
    sheets_loaded_to_perf: '✅ inspector verisi Sheets\'ten Performans Analizi\'ne yüklendi!',
    sheets_klasman_sync:   '☁️ Klasman değişikliği Sheets\'e senkronize edildi',
    sheets_perf_updated:   '✅ Sheets\'ten inspector verisi güncellendi',
    sheets_analiz_sent:    '✅ Klasman analizi güncellendi ve Sheets\'e gönderildi!',
    sheets_analiz_loaded:  '✅ klasman analizi Sheets\'ten yüklendi!',
    // PWA
    pwa_install:           'Uygulamayı Yükle',
    pwa_install_full:      'Uygulamayı Yükle — Kısayol Oluştur',
    pwa_install_hint:      'Masaüstüne veya ana ekrana ekleyin, uygulama gibi açılır',
    pwa_installed:         '✅ Uygulama yüklendi!',
    pwa_installing:        '⏳ Yükleniyor...',
  }
};

let currentLang = 'tr'; // Panel artik sadece Turkce destekliyor; dil secimi kaldirildi

// i18n yardımcısı: belirli bir DOM kökü altındaki tüm [data-i18n] ve [data-i18n-placeholder] elementlerini çevirir
function applyI18nToNewNodes(root) {
  const lang = currentLang;
  const t = translations[lang] || translations.tr;
  (root || document).querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.placeholder = t[key];
  });
}

function setLang(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('panelLang', lang);

  // Update lang-btn active states (both pw-overlay and topbar)
  document.querySelectorAll('.lang-btn, .topbar-lang-btn').forEach(btn => btn.classList.remove('active'));
  // pw-overlay buttons
  const pwBtn = document.getElementById('pw-lang-btn-' + lang);
  if (pwBtn) pwBtn.classList.add('active');
  // topbar buttons
  const tbBtn = document.getElementById('lang-btn-' + lang);
  if (tbBtn) tbBtn.classList.add('active');

  // Translate all [data-i18n] and [data-i18n-placeholder] elements in the whole document
  applyI18nToNewNodes(document);

  // Select <option> elemanlarını çevir (data-i18n attribute'u varsa)
  document.querySelectorAll('select option[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = (translations[lang]||translations.tr)[key];
    if (val !== undefined) el.text = val;
  });

  // Update <html lang="...">
  document.documentElement.lang = lang;

  // Re-render JS-generated content that uses translations
  try { if (typeof updateSidebar === 'function') updateSidebar(); } catch(e) {}
  try { if (typeof renderDashboard === 'function' && performansData && performansData.length) renderDashboard(); } catch(e) {}
}

// Apply saved / default language on page load
document.addEventListener('DOMContentLoaded', () => {
  setLang(currentLang);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GLOBAL DEĞİŞKENLER VE SABITLER
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// ────────────────────────────
// TEMEL AYARLAR
// ────────────────────────────
const PER_PAGE = 10;
const DASHBOARD_PER_PAGE = 12;
const GUNLUK_CALISMA_SANIYE = 7.5 * 3600; // 7.5 saat = 27000 saniye

// ────────────────────────────
// VERI YAPILARI
// ────────────────────────────
let klasmanlar = [];
let nextId = 1;
let secilenId = null;
let sayfa = 1;
let aramaStr = '';

// Excel ve Performans
let excelRows = [];
let excelCols = [];
let performansData = [];
let kayipZamanData = []; // { id, inspector, tarih, gun, baslangic, bitis, sebep, aciklama, ekipYoneticisi, sureDk }

// ─── İkinci Inspection (kullanıcı talebiyle eklendi) ───
// Teknik İnceleme bölümüne giriş yapan kullanıcıların ikinci hedefi: günlük
// belirli sayıda "ikinci inspection" kaydı girmeleri gerekiyor.
let ikinciInspectionData = []; // { id, siparisKodu, inspector, ekipYoneticisi, talepNo, talepMiktari, sonuc, notAlani, tarih, degerlendiren, savedAt }
// Teknik İnceleme hedefleri (admin tarafından ayarlanır) — varsayılan: günlük
// 3 teknik değerlendirme, günlük 5 ikinci inspection.
let teknikHedefler = { teknikDegerlendirmeGunluk: 3, ikinciInspectionGunluk: 5 };

// Kullanıcı yönetimi (Users sekmesi) için global cache — sayfa açılışında
// renderDashboard() → renderTeamManagersSection() zinciri tarafından erken
// kullanıldığından, TDZ hatasını önlemek için burada (dosyanın başında) tanımlanır.
let _usersCache = [];
let _editingUsername = null; // null => yeni kullanıcı, string => düzenleniyor
let _kzLastFetchTime = 0;
const KZ_CACHE_MS = 20000; // 20 saniye icinde tekrar girilirse network'e gitmeden cache'den goster

// 2.Kalite ürünlerinin Genel Performans hesabına dahil edilip edilmeyeceğini
// kontrol eden toggle. VARSAYILAN: false (kapalı) — mevcut/eski davranış birebir
// korunur: 2.Kalite kayıtları genel performansa hiç karışmaz, ayrı gösterilir.
// true olursa: 2.Kalite kayıtları diğer kayıtlarla aynı akıştan geçer (ayrım kalkar).
let _2KaliteDahil = false;

// Overtime çalışmasının Düz. Performans hesabına dahil edilip edilmeyeceği.
// VARSAYILAN: false — performans sadece normal mesai (08:00-16:45) paydasıyla hesaplanır.
// true olursa: overtime saatleri de mesai paydasına eklenir.
let _overtimeDahil = false;

// ─── Kayıp Zaman localStorage cache ───
// Sayfa yenilendiğinde (F5) JS state sıfırlanır; bu yüzden son çekilen veriyi
// localStorage'da tutup açılışta anında gösteriyoruz, arkaplanda Sheets'ten tazeliyoruz.
const KZ_LS_KEY = 'lc_kayip_zaman_cache';

function saveKayipZamanToLocalStorage() {
  try {
    localStorage.setItem(KZ_LS_KEY, JSON.stringify({
      kayitlar: kayipZamanData,
      savedAt: Date.now()
    }));
  } catch (err) {
    console.warn('Kayıp zaman localStorage kaydetme hatası:', err);
  }
}

function loadKayipZamanFromLocalStorage() {
  try {
    const raw = localStorage.getItem(KZ_LS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.kayitlar)) {
      kayipZamanData = parsed.kayitlar;
      _kzLastFetchTime = parsed.savedAt || 0;
      return true;
    }
  } catch (err) {
    console.warn('Kayıp zaman localStorage okuma hatası:', err);
  }
  return false;
}

// Dashboard
let filteredInspectors = [];
let currentDashboardPage = 1;

// Inspector Detay
let selectedInspectorDetail = null;

// ────────────────────────────
// SLIDESHOW DEĞİŞKENLERİ
// ────────────────────────────
let slideshowActive = false;
let slideshowInspectors = [];
let currentSlideIndex = 0;
let slideshowInterval = null;
let progressInterval = null;

// Slideshow Ayarları
let slideDuration = 5000; // 5 saniye
let displayMode = 'all'; // all, top5, excellent, good
let animationEffect = 'slide'; // slide, fade, zoom, flip

// ────────────────────────────
// APP CONFIG (Tüm Ayarlar)
// ────────────────────────────
const APP_CONFIG_KEY = 'lc_inspection_config';
const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzrARAnKp2iqx4JsrXjnHdiSFpYgJtFPKWbZCPWQsXkgHUfpUlmmIx_d0Zom1gItq0T/exec'; // ARTIK KULLANILMIYOR (referans için tutuluyor)

// ─── cPanel/MySQL Backend API'si — TÜM veri artık buradan geçiyor ───
// Performans, Klasmanlar, Config, Kullanıcılar, Kayıp Zaman, Teknik İnceleme,
// Klasman Analizi — hepsi bu TEK api.php dosyası üzerinden okunup yazılıyor.
// Google Sheets/Apps Script'e artık HİÇ ihtiyaç yok.
const PHP_API_URL = 'https://fantaktik.com/kalibre-api/api.php';
// Geriye dönük uyumluluk: bazı fonksiyonlar hâlâ PHP_PERFORMANS_API_URL adını
// kullanıyor (aynı dosyaya işaret ediyor, yeniden adlandırmaya gerek yok).
const PHP_PERFORMANS_API_URL = PHP_API_URL;
const DEFAULT_API_TOKEN  = 'lcw-secret-2024';

// ─── GOOGLE SHEETS/APPS SCRIPT ARTIK KULLANILMIYOR ───
// Eskiden bu bayrak Sheets bağlantılarını engellemek için "true" idi. Artık
// TÜM istekler zaten PHP_API_URL'e gittiği için (appConfig.sheetsWebAppUrl
// aşağıda PHP_API_URL'e sabitlendi) bu bayrağı "false" yapıp jsonpFetch'in
// normal akışının (önce sunucu, olmazsa yerel önbellek) PHP ile sorunsuz
// çalışmasına izin veriyoruz. Adı "SHEETS_DEVRE_DISI" olarak kaldı ama artık
// anlamı "eski davranışı zorla engelleme" — kod tabanının başka hiçbir yerini
// değiştirmemek için isim korundu.
const SHEETS_DEVRE_DISI = false;

// ─── ADMİN ŞİFRESİ ARTIK KODDA YOK ───
// Şifre, kodun içinde SAKLANMAZ — her girişte PHP backend'inden (kv_store
// 'config' kaydı) çekilir. Panel içinden "Şifre Değiştir" yapıldığında bu
// kayıt güncellenir; kaynak kodda hiçbir zaman gerçek şifre görünmez.
// (Bir kerelik ilk kurulum için veritabanına şifre yazma adımı gerekir —
// ayrıca sağlanan SQL komutuyla yapılır.)

let appConfig = {
  password: '',
  sheetsWebAppUrl: PHP_API_URL,
  sheetsViewUrl: '',
  sheetsApiToken: DEFAULT_API_TOKEN,
  activeQuarters: []
};

// ────────────────────────────
// KULLANICI / YETKİ SİSTEMİ
// ────────────────────────────
// currentUser: { username, isAdmin, tabs: [...] }
// Admin: appConfig.password ile giriş yapar, tüm sekmelere erişir.
// Normal kullanıcı: Users sekmesindeki kullanıcı adı + kendi şifresiyle giriş yapar,
// sadece admin tarafından verilen sekmelere erişir.
const CURRENT_USER_KEY = 'lc_current_user';
let currentUser = null;
try {
  const cu = localStorage.getItem(CURRENT_USER_KEY);
  if (cu) currentUser = JSON.parse(cu);
} catch(e) { currentUser = null; }

// Yönetilebilir sekmeler (Kullanıcı Yönetimi sayfasında checkbox olarak gösterilir)
const ASSIGNABLE_TABS = [
  { id: 'dashboard',        label: 'Dashboard' },
  { id: 'klasman-analiz',   label: 'Klasman Analizi' },
  { id: 'performans',       label: 'Performans Analizi' },
  { id: 'canli',            label: 'Canlı Gösterim' },
  { id: 'teknik-inceleme',  label: 'Teknik İnceleme' }
];

// Yeni bilgisayar tespiti: localStorage'da config hiç yoksa
const _isNewDevice = !localStorage.getItem(APP_CONFIG_KEY);

// ─── CONFIG SHEETS ENTEGRASYONU ───
// Şifre ve ayarları Sheets'teki "Config" sekmesine push/pull eder
async function pushConfigToSheets() {
  if (SHEETS_DEVRE_DISI) return;
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return;
  try {
    let geminiKey = '';
    try { geminiKey = localStorage.getItem('gemini_api_key_perf_panel') || ''; } catch(e) {}
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'setConfig',
        token: token,
        config: {
          password: appConfig.password,
          geminiApiKey: geminiKey,
          activeQuarters: appConfig.activeQuarters || []
        }
      }),
      mode: 'no-cors'
    });
    console.log('✅ Config (şifre + Gemini key) Sheets\'e gönderildi');
  } catch(e) { console.warn('Config push hatası:', e.message); }
}

// ─── GOOGLE SHEETS VERİ ÇEKME YARDIMCISI ───
// iframe + postMessage yöntemi (v5.1)
// JSONP ve fetch/redirect yaklaşımları Apps Script'in
// script.google.com → script.googleusercontent.com redirect'i nedeniyle
// GitHub Pages'ten çalışmıyordu. iframe redirect'i sorunsuz takip eder,
// içindeki <script> postMessage ile veriyi üst pencereye iletir.
// ─── jsonpFetch: KalibRe PHP Backend'ine (cPanel/MySQL) istek atar ───
// v3 — GERÇEK fetch() + CORS. Artık Google Apps Script'e değil, kendi
// api.php'mize (PHP_API_URL) konuşuyoruz. Kendi sunucumuz olduğu için CORS
// header'larını (Access-Control-Allow-Origin) doğrudan kontrol edebiliyoruz —
// bu yüzden eski iframe+postMessage / script-tag JSONP gibi CORS atlatma
// numaralarına ARTIK HİÇ İHTİYAÇ YOK. Fonksiyon adı (jsonpFetch) geriye dönük
// uyumluluk için korundu — kod tabanındaki 25 çağrı noktasının hiçbiri
// değişmeden, sadece bu fonksiyonun İÇİ değişti.
function jsonpFetch(url, params) {
  const qs = Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v == null ? '' : v).normalize('NFC')))
    .join('&');
  const fullUrl = url + (url.includes('?') ? '&' : '?') + qs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  return fetch(fullUrl, { method: 'GET', signal: controller.signal })
    .then(res => {
      clearTimeout(timer);
      if (!res.ok) throw new Error('API HTTP ' + res.status);
      return res.json();
    })
    .catch(err => {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(
          'Sunucuya bağlanılamadı (25 sn zaman aşımı).\n\n' +
          'Bu geçici bir ağ yavaşlaşması olabilir.\n' +
          'İnternet bağlantınızı kontrol edip tekrar deneyin.'
        );
      }
      throw err;
    });
}

async function pullConfigFromSheets() {
  if (SHEETS_DEVRE_DISI) return false;
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return false;
  try {
    const data = await jsonpFetch(url, { action: 'getConfig', token });
    if (data.status === 'ok' && data.config) {
      if (data.config.password)        appConfig.password        = data.config.password;
      // Gemini API key varsa localStorage'a yaz ve input'a doldur
      if (data.config.geminiApiKey) {
        try { localStorage.setItem('gemini_api_key_perf_panel', data.config.geminiApiKey); } catch(e) {}
        const keyInput = document.getElementById('ao-gkey');
        if (keyInput) keyInput.value = data.config.geminiApiKey;
        console.log('✅ Gemini API anahtarı Sheets\'ten yüklendi');
      }
            if (Array.isArray(data.config.activeQuarters) && data.config.activeQuarters.length > 0) {
        appConfig.activeQuarters = data.config.activeQuarters;
      }
localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(appConfig));
      console.log('✅ Config Sheets\'ten çekildi');
      return true;
    }
  } catch(e) { console.warn('Config pull hatası:', e.message); }
  return false;
}

// ─── İLK AÇILIŞTA OTOMATİK VERİ ÇEK ───
async function autoFetchOnStartup() {
  // NOT: SHEETS_DEVRE_DISI artık "false" — bu yüzden aşağıdaki kısa devre
  // bloğu ARTIK ÇALIŞMIYOR, sadece geçmiş bir geçiş aşamasının izi olarak
  // duruyor (silinmedi, ileride tekrar lazım olursa true yapmak yeterli).
  // Gerçek akış, bu bloğun ALTINDAKİ tam sürümdür — o da artık Google
  // Sheets'e değil, appConfig.sheetsWebAppUrl (= PHP_API_URL) üzerinden
  // cPanel/MySQL'e gider: Config, Klasmanlar, Performans, Teknik İnceleme,
  // Kayıp Zaman, Ekip senkronizasyonu — hepsi PHP'den gelir.
  if (SHEETS_DEVRE_DISI) {
    if (!PHP_PERFORMANS_API_URL) return; // hiçbir kaynak yapılandırılmamışsa sessizce çık
    showStartupBanner('📥 Performans verisi çekiliyor...');
    try {
      await pullPerformansFromSheets(true); // silent=true — kendi render/saveData işlemlerini de yapar
      showStartupBanner(`✅ Performans verisi güncellendi (${performansData.length} inspector)`, 'success');
    } catch(e) {
      console.warn('Performans otomatik çekme hatası:', e.message);
      hideStartupBanner();
    }
    return;
  }

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return;

  // Config (şifre) çek
  await pullConfigFromSheets();

  // Ekip yöneticisi ise ekip listesini Sheets'ten taze çek (başka cihazdan
  // değişmiş olabilir) ve "Ekibim" kartını güncelle
  if (currentUser && !currentUser.isAdmin) {
    try {
      const teamData = await jsonpFetch(url, { action: 'getUserTeam', token, username: currentUser.username });
      if (teamData.status === 'ok' && Array.isArray(teamData.team)) {
        currentUser.team = teamData.team;
        try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser)); } catch(e) {}
        renderTeamSection();
      }
    } catch(e) { console.warn('Ekip senkronizasyon hatası:', e.message); }
  }

  // Eğer daha önce hiç veri çekilmemişse (klasmanlar boş veya varsayılan 3'lü) Sheets'ten çek
  const isDefault = klasmanlar.length === 3 &&
    klasmanlar.every((k,i) => ['Pantolon','Ceket','Mont'][i] === k.ad);
  const hasNoKlasman = klasmanlar.length === 0;

  showStartupBanner('📥 Sheets\u2019ten veriler çekiliyor...');

  // ── Klasmanları çek (boşsa veya varsayılan 3'lüyse) ──
  if (isDefault || hasNoKlasman) {
    console.log('🔄 İlk açılış: Sheets\u2019ten klasmanlar otomatik çekiliyor...');
    try {
      const data = await jsonpFetch(url, { action: 'getKlasmanlar', token });
      if (data.status === 'ok' && Array.isArray(data.klasmanlar) && data.klasmanlar.length > 0) {
        klasmanlar = data.klasmanlar;
        nextId = Math.max(1, ...klasmanlar.map(k => k.id || 0)) + 1;
        renderListe();
        renderEditor();
        updateKlasmanFilter();
        console.log('✅ Klasmanlar yüklendi:', klasmanlar.length);
      }
    } catch(e) {
      console.warn('Klasman otomatik çekme hatası:', e.message);
    }
  }

  // ── Performans verisini her zaman çek (tüm kullanıcılar güncel görsün) ──
  try {
    const { performansData: pd } = await fetchPerformansRawPaginated(url, token);
    if (pd && pd.length > 0) {
      performansData = fixVerimlilikPerf(restorePerformansDateObjects(pd));
      console.log('✅ Performans verisi yüklendi:', performansData.length, 'inspector');
    }
  } catch(e) {
    console.warn('Performans otomatik çekme hatası:', e.message);
  }

  // ── Teknik İnceleme skorlarını çek (dashboard kartlarında gösterim için) ──
  try {
    const tiData = await jsonpFetch(url, { action: 'getTeknikIncelemeSkorlar', token });
    if (tiData.status === 'ok' && Array.isArray(tiData.skorlar)) {
      teknikSkorlar = tiData.skorlar;
      saveTeknikIncelemeToLocalStorage();
    }
  } catch(e) { console.warn('Teknik İnceleme skor çekme hatası:', e.message); }

  // ── Kayıp zaman verisini çek (dashboard kartlarındaki "Değerlendirme Dışı"
  // rozeti için) — Kayıp Zaman sekmesine hiç girilmemiş/erişimi olmayan
  // kullanıcılarda bile bu rozet doğru gözüksün diye burada, herkes için çekilir.
  try {
    await fetchKayipZamanData();
  } catch(e) { console.warn('Kayıp zaman verisi çekme hatası (startup):', e.message); }

  // ── İkinci Inspection verisini çek (ana Dashboard'un Excel çıktısında
  // "İkinci Insp. Geçti/Toplam Oranı" sütunu doğru gözüksün diye — Teknik
  // İnceleme sekmesine hiç girilmemiş olsa bile burada, herkes için çekilir.
  try {
    await fetchIkinciInspectionData();
  } catch(e) { console.warn('İkinci Inspection verisi çekme hatası (startup):', e.message); }

  // ── Tümünü kaydet ve render et ──
  saveData();
  updateSidebar();
  renderDashboard(); renderQuarterBadge(performansData);
  renderPerfTabloFromData();
  renderTopInspectors();
  showStartupBanner(`✅ Sheets senkronizasyonu tamamlandı (${klasmanlar.length} klasman, ${performansData.length} inspector)`, 'success');
  console.log('✅ Otomatik yükleme tamamlandı');
}

function showStartupBanner(msg, type) {
  let banner = document.getElementById('startup-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'startup-banner';
    banner.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:999;padding:10px 22px;border-radius:9px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.2);transition:all .3s;white-space:nowrap';
    document.body.appendChild(banner);
  }
  if (type === 'success')     banner.style.background = 'var(--green)';
  else if (type === 'error')  banner.style.background = 'var(--red)';
  else if (type === 'info')   banner.style.background = 'var(--amber)';
  else                        banner.style.background = 'var(--blue2)';
  banner.style.color = '#fff';
  banner.textContent = msg;
  banner.style.display = 'block';
  if (type === 'success') setTimeout(hideStartupBanner, 4000);
}

function hideStartupBanner() {
  const banner = document.getElementById('startup-banner');
  if (banner) banner.style.display = 'none';
}

function loadConfig() {
  try {
    const saved = localStorage.getItem(APP_CONFIG_KEY);
    if (saved) {
      const cfg = JSON.parse(saved);
      appConfig = { ...appConfig, ...cfg };
      if (Array.isArray(cfg.activeQuarters) && cfg.activeQuarters.length > 0) {
        setTimeout(function() { if (typeof _restoreQuarterBadge === 'function') _restoreQuarterBadge(cfg.activeQuarters); }, 500);
      }
    }
  } catch(e) {}
  // URL her zaman sabit kalır — localStorage'daki eski değer görmezden gelinir (v5.2)
  const OLD_URLS = [
    'https://script.google.com/macros/s/AKfycbylHwcu3q2CnNwmNUQIyjkuhyAcapnxabPmAGrKW70GU-IVWhq_55KHwk2NBQ3pGhaOgQ/exec',
    'https://script.google.com/macros/s/AKfycbwdM7izL7cwHzYNIAG_N0wZ1_NpKM_AyBp0wrpgRtnoLHa_WnMh-JQZfeRJhdq6BPzg7Q/exec',
    'https://script.google.com/macros/s/AKfycbzXFslNKDL3LlWEQPi8suFqSw5iqm65r2-KamgptTK1tXUY6Fpl25C8ok5zhoUGW1bSAg/exec'
  ];
  // Her zaman PHP API URL'ini kullan (farklı bilgisayarda da değişmez)
  appConfig.sheetsWebAppUrl = PHP_API_URL;
  if (!appConfig.sheetsApiToken) appConfig.sheetsApiToken = DEFAULT_API_TOKEN;
  // Şifre artık SADECE localStorage'daki önbellekten (varsa, en son PHP'den
  // başarıyla çekilen değer) veya checkPassword() içinde PHP'den (kv_store
  // config) anlık çekilen değerden gelir — kodda sabit bir yedek YOKTUR.
  // UI'ya yansıt
  const wuEl = document.getElementById('sheets-webapp-url');
  const vuEl = document.getElementById('sheets-view-url');
  const tkEl = document.getElementById('sheets-api-token');
  if (wuEl) wuEl.value = appConfig.sheetsWebAppUrl || '';
  if (vuEl) vuEl.value = appConfig.sheetsViewUrl || '';
  if (tkEl) tkEl.value = appConfig.sheetsApiToken || '';
  updateSheetsViewLink();
}

function saveConfig() {
  // sheetsWebAppUrl her zaman HTML'e gömülü sabit değeri kullanır (v5.2)
  appConfig.sheetsWebAppUrl  = DEFAULT_SHEETS_URL;
  appConfig.sheetsViewUrl    = document.getElementById('sheets-view-url')?.value?.trim()   || '';
  appConfig.sheetsApiToken   = document.getElementById('sheets-api-token')?.value?.trim()  || '';
  localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(appConfig));
  updateSheetsViewLink();
  // URL+token doluysa Sheets Config sekmesine şifreyi de yaz (debounced)
  clearTimeout(window._configPushTimer);
  window._configPushTimer = setTimeout(() => pushConfigToSheets(), 2000);
}

function toggleTokenVisibility() {
  const inp = document.getElementById('sheets-api-token');
  const btn = document.getElementById('token-eye-btn');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

function updateSheetsViewLink() {
  const link = document.getElementById('sheets-view-link');
  if (!link) return;
  const url = appConfig.sheetsViewUrl;
  link.href = url || '#';
  link.style.opacity = url ? '1' : '0.5';
}

// ────────────────────────────
// ŞİFRE KONTROLÜ
// ────────────────────────────
// sessionStorage ile çalışır: sekme açık olduğu sürece bir kez şifre yeter.
// Sekme kapatılınca sıfırlanır, yeni açılışta tekrar sorar.
const SESSION_KEY = 'lc_session_unlocked';
let klasmanUnlocked = sessionStorage.getItem(SESSION_KEY) === '1';
let pendingNavEl = null;

// Sayfa ilk açılışında şifre sor (henüz unlock olmadıysa)
function initPasswordGate() {
  if (!klasmanUnlocked) {
    let remembered = null;
    try { remembered = JSON.parse(localStorage.getItem('lc_remembered_creds') || 'null'); } catch(e) {}

    if (remembered && remembered.password) {
      klasmanUnlocked = true;
      sessionStorage.setItem(SESSION_KEY, '1');
      if (!currentUser) {
        currentUser = remembered.username && remembered.username.toLowerCase() !== 'admin'
          ? { username: remembered.username, isAdmin: false, tabs: [], team: [] }
          : { username: 'admin', isAdmin: true, tabs: 'all' };
      }
      const shell = document.getElementById('app-shell');
      if (shell) shell.style.display = 'block';
      applyUserPermissions();
      setTimeout(() => autoFetchOnStartup(), 600);
      _verifyRememberedCredsInBackground(remembered);
      return;
    }

    document.getElementById('pw-overlay').style.display = 'flex';
  } else {
    const shell = document.getElementById('app-shell');
    if (shell) shell.style.display = 'block';
    applyUserPermissions();
    setTimeout(() => autoFetchOnStartup(), 600);
  }
}

// Hatırlanan giriş bilgilerini arka planda doğrular; geçersizse oturumu kapatır.
async function _verifyRememberedCredsInBackground(remembered) {
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return;
  const isAdminUser = !remembered.username || remembered.username.toLowerCase() === 'admin';
  try {
    if (isAdminUser) {
      const data = await jsonpFetch(url, { action: 'getConfig', token });
      if (data.status === 'ok' && data.config && data.config.password) {
        appConfig.password = data.config.password;
        localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(appConfig));
        if (remembered.password !== data.config.password) {
          logoutUser('⚠️ Şifre değişti, lütfen yeni şifre ile giriş yapın');
        }
      }
    } else {
      const data = await jsonpFetch(url, { action: 'login', token, username: remembered.username, password: remembered.password });
      if (data.status === 'ok' && data.user) {
        currentUser = { username: data.user.username, isAdmin: false, tabs: data.user.tabs || [], team: data.user.team || [] };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        applyUserPermissions();
        if (document.getElementById('page-dashboard')?.classList.contains('active')) renderTeamSection();
      } else {
        logoutUser('⚠️ Kullanıcı bilgileriniz geçersiz, lütfen tekrar giriş yapın');
      }
    }
  } catch(e) {}
}

// Oturumu kapatır ve giriş ekranına döner.
function logoutUser(msg) {
  try {
    localStorage.removeItem('lc_remembered_creds');
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch(e) {}
  currentUser = null;
  klasmanUnlocked = false;
  sessionStorage.removeItem(SESSION_KEY);
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'none';
  document.getElementById('pw-overlay').style.display = 'flex';
  const errEl = document.getElementById('pw-err');
  if (errEl) errEl.textContent = msg || '';
  const userEl = document.getElementById('pw-username');
  if (userEl) userEl.value = '';
  const passEl = document.getElementById('pw-input');
  if (passEl) { passEl.value = ''; passEl.focus(); }
}

// Giriş yapan kullanıcıya göre sidebar sekmelerini gösterir/gizler.
function applyUserPermissions() {
  const isAdmin = !currentUser || currentUser.isAdmin;
  const navKlasman = document.getElementById('nav-klasmanlar');
  const navUsers   = document.getElementById('nav-kullanicilar');
  if (navKlasman) navKlasman.style.display = isAdmin ? '' : 'none';
  if (navUsers)   navUsers.style.display   = isAdmin ? '' : 'none';

  ASSIGNABLE_TABS.forEach(t => {
    if (t.id === 'dashboard') return; // herkes görebilir
    const allowed = isAdmin || (currentUser.tabs || []).includes(t.id);
    document.querySelectorAll('.nav-item').forEach(el => {
      const onclick = el.getAttribute('onclick') || '';
      if (onclick.indexOf("showPage('" + t.id + "'") !== -1) {
        el.style.display = allowed ? '' : 'none';
      }
    });
  });

  const unameEl = document.getElementById('current-username-label');
  if (unameEl) unameEl.textContent = (currentUser && !currentUser.isAdmin) ? currentUser.username : 'admin';

  // Ekip yönetimi UI'ları sadece ekip yöneticisi (admin olmayan) kullanıcılara gösterilir
  const teamCard   = document.getElementById('my-team-card');
  const teamFilter = document.getElementById('team-only-filter-group');
  const genelLabel = document.getElementById('general-status-label');
  const showTeamUi = currentUser && !currentUser.isAdmin;
  if (teamCard)   teamCard.style.display   = showTeamUi ? '' : 'none';
  if (teamFilter) teamFilter.style.display = showTeamUi ? '' : 'none';
  if (genelLabel) genelLabel.style.display = showTeamUi ? 'flex' : 'none';

  // Ekip yöneticileri özet kartları sadece admin'e gösterilir
  const teamManagersSection = document.getElementById('team-managers-section');
  if (teamManagersSection && showTeamUi) teamManagersSection.style.display = 'none';

  // "Ekibim Analizi" sekmesi: yalnızca atanmış ekibi olan kullanıcılara gösterilir
  const navEkipAnaliz = document.getElementById('nav-ekip-analiz');
  if (navEkipAnaliz) {
    const hasTeam = showTeamUi && (currentUser.team || []).length > 0;
    navEkipAnaliz.style.display = hasTeam ? '' : 'none';
  }

  // Kayip Zaman Girisi sekmesi: yalnizca ekip yoneticilerine
  const navKayipEkip = document.getElementById('nav-kayip-zaman-ekip');
  if (navKayipEkip) {
    const hasTeam = showTeamUi && (currentUser.team || []).length > 0;
    navKayipEkip.style.display = hasTeam ? '' : 'none';
  }

  // Kayip Zaman Analizi sekmesi: yalnizca admin'e
  const navKayipAdmin = document.getElementById('nav-kayip-zaman-admin');
  if (navKayipAdmin) {
    navKayipAdmin.style.display = (!currentUser || currentUser.isAdmin) ? '' : 'none';
  }

  // "Temizle" butonu sadece admin tarafından görülebilir
  const temizleBtn = document.getElementById('btn-temizle');
  if (temizleBtn) temizleBtn.style.display = (!currentUser || currentUser.isAdmin) ? '' : 'none';
}

// Geriye dönük uyumluluk: bazı eski nav öğeleri requirePassword çağırabilir.
function requirePassword(navEl) {
  showPage('klasmanlar', navEl);
}

function closePwModal() {
  // Giriş ekranı her zaman zorunludur, modal kapatılamaz.
}

async function checkPassword() {
  const usernameEl = document.getElementById('pw-username');
  const userVal = usernameEl ? usernameEl.value.trim() : '';
  const val   = document.getElementById('pw-input').value.trim();
  const errEl = document.getElementById('pw-err');
  const btnEl = document.querySelector('.pw-btn');
  const dotEl   = document.getElementById('pw-dot');
  const labelEl = document.getElementById('pw-server-label');

  if (!val) { errEl.textContent = '❌ Şifre boş olamaz'; return; }

  // Buton kilitle
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = (translations[currentLang]||translations.tr).verifying; }
  errEl.textContent = '';
  if (dotEl)   dotEl.style.background = 'var(--amber)';
  if (labelEl) labelEl.textContent = (translations[currentLang]||translations.tr).connecting;

  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;

  function _unlock(user) {
    currentUser = user;
    try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser)); } catch(e) {}
    klasmanUnlocked = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    try {
      const rem = document.getElementById('pw-remember');
      if (rem && rem.checked) localStorage.setItem('lc_remembered_creds', JSON.stringify({ username: userVal, password: val }));
      else localStorage.removeItem('lc_remembered_creds');
    } catch(e) {}
    if (dotEl)   dotEl.style.background = 'var(--green)';
    if (labelEl) labelEl.textContent = (translations[currentLang]||translations.tr).verified;
    const shell = document.getElementById('app-shell');
    if (shell) shell.style.display = 'block';
    document.getElementById('pw-overlay').style.display = 'none';
    applyUserPermissions();
    setTimeout(() => autoFetchOnStartup(), 300);
    pendingNavEl = null;
  }

  function _fail(msg) {
    errEl.textContent = msg;
    if (dotEl)   dotEl.style.background = 'var(--red)';
    if (labelEl) labelEl.textContent = (translations[currentLang]||translations.tr).error_label;
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = (translations[currentLang]||translations.tr).login_btn; }
  }

  // ── Kullanıcı adı girildiyse (admin dışı) → normal kullanıcı girişi ──
  if (userVal && userVal.toLowerCase() !== 'admin') {
    if (SHEETS_DEVRE_DISI) {
      _fail('⚠️ Ekip yöneticisi girişi şu anda kullanılamıyor (Google Sheets bağlantısı kapatıldı). Lütfen admin olarak giriş yapın.');
      return;
    }
    if (!url || !token) {
      _fail('⚠️ Sunucu bağlantısı yapılandırılmamış.');
      return;
    }
    try {
      const data = await jsonpFetch(url, { action: 'login', token, username: userVal, password: val });
      if (data.status === 'ok' && data.user) {
        _unlock({ username: data.user.username, isAdmin: false, tabs: data.user.tabs || [], team: data.user.team || [] });
        return;
      }
      _fail((translations[currentLang]||translations.tr).pw_wrong);
      document.getElementById('pw-input').value = '';
      document.getElementById('pw-input').focus();
      return;
    } catch(e) {
      _fail((translations[currentLang]||translations.tr).pw_unreachable);
      return;
    }
  }

  // ── Admin girişi (tek admin şifresi) ──
  const adminUser = { username: 'admin', isAdmin: true, tabs: 'all' };

  // SHEETS_DEVRE_DISI şu an "false" olduğu için bu blok ÇALIŞMIYOR (aşağıdaki
  // gerçek PHP tabanlı akış kullanılıyor) — geçmiş bir aşamanın izi olarak
  // duruyor, silinmedi.
  if (SHEETS_DEVRE_DISI) {
    if (val === appConfig.password) { _unlock(adminUser); return; }
    _fail((translations[currentLang]||translations.tr).pw_wrong);
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
    return;
  }

  // ── 1. Sheets'ten şifreyi çekmeye çalış (20s timeout) ──
  if (url && token) {
    try {
      const data = await jsonpFetch(url, { action: 'getConfig', token });
      if (data.status === 'ok' && data.config && data.config.password) {
        const sheetsPassword = data.config.password;
        // Cache'e yaz
        appConfig.password = sheetsPassword;
        localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(appConfig));
        if (val === sheetsPassword) { _unlock(adminUser); return; }
        else { _fail((translations[currentLang]||translations.tr).pw_wrong); document.getElementById('pw-input').value=''; document.getElementById('pw-input').focus(); return; }
      }
      // Sheets'te şifre yok ama bağlantı kuruldu
      if (dotEl) dotEl.style.background = 'var(--amber)';
      if (labelEl) labelEl.textContent = (translations[currentLang]||translations.tr).pw_no_sheets_pw;
    } catch(e) {
      // Zaman aşımı veya bağlantı hatası
      console.warn('Sheets bağlantı hatası:', e.message);
      if (dotEl)   dotEl.style.background = 'var(--amber)';
      if (labelEl) labelEl.textContent = (translations[currentLang]||translations.tr).pw_unreachable;
    }
  }

  // ── 2. Sheets'e ulaşılamazsa cache'deki şifreyi kullan ──
  const cachedPw = appConfig.password;
  if (cachedPw && val === cachedPw) {
    if (labelEl) labelEl.textContent = (translations[currentLang]||translations.tr).pw_offline;
    _unlock(adminUser);
    return;
  }

  // ── 3. Her iki yöntem de başarısız ──
  if (!cachedPw) {
    _fail((translations[currentLang]||translations.tr).pw_no_server_cache);
  } else {
    _fail((translations[currentLang]||translations.tr).pw_wrong);
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
  }
}

async function _firstRunSync() {
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) { hideStartupBanner(); return; }

  showStartupBanner('📥 Sheets\'ten klasmanlar çekiliyor...');

  try {
    const data = await jsonpFetch(url, { action: 'getKlasmanlar', token });
    if (data.status === 'error') throw new Error(data.message || 'Sunucu hata döndürdü');

    if (data.status === 'ok' && Array.isArray(data.klasmanlar) && data.klasmanlar.length > 0) {
      klasmanlar = data.klasmanlar;
      nextId = Math.max(1, ...klasmanlar.map(k => k.id || 0)) + 1;
      saveData();
      renderListe();
      renderEditor();
      updateSidebar();
      updateKlasmanFilter();
      renderDashboard();
      showStartupBanner(`✅ ${klasmanlar.length} klasman senkronize edildi!`, 'success');
    } else {
      showStartupBanner('ℹ️ Sheets\'te henüz klasman verisi yok', 'info');
      setTimeout(hideStartupBanner, 3000);
    }
  } catch(e) {
    console.warn('_firstRunSync hata:', e.message);
    showStartupBanner('⚠️ Senkronizasyon hatası: ' + e.message, 'error');
    setTimeout(hideStartupBanner, 5000);
  }
}

function changePwPrompt() {
  const current = prompt('Mevcut şifreyi girin:');
  if (current !== appConfig.password) { alert('Yanlış şifre!'); return; }
  const newPw = prompt('Yeni şifreyi girin:');
  if (!newPw || newPw.length < 4) { alert('Şifre en az 4 karakter olmalı!'); return; }
  const confirm = prompt('Yeni şifreyi tekrar girin:');
  if (newPw !== confirm) { alert('Şifreler eşleşmiyor!'); return; }
  appConfig.password = newPw;
  localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(appConfig));
  // Sheets Config sekmesine de gönder
  pushConfigToSheets().then(() => {
    alert('✅ Şifre değiştirildi ve Sheets\'e senkronize edildi!');
  }).catch(() => {
    alert('✅ Şifre değiştirildi! (Sheets senkronizasyonu başarısız oldu)');
  });
}

// Giriş yapmış olan kullanıcı kendi şifresini değiştirir.
// Admin için ortak admin şifresi (changePwPrompt), normal kullanıcı için
// kendi Users sekmesindeki şifresi güncellenir.
function changeMyPasswordPrompt() {
  if (!currentUser || currentUser.isAdmin) { changePwPrompt(); return; }
  if (SHEETS_DEVRE_DISI) { alert('⚠️ Ekip yöneticisi şifre değişikliği şu anda kullanılamıyor (Google Sheets bağlantısı kapatıldı).'); return; }

  const current = prompt('Mevcut şifrenizi girin:');
  if (!current) return;
  const newPw = prompt('Yeni şifrenizi girin:');
  if (!newPw || newPw.length < 4) { alert('Şifre en az 4 karakter olmalı!'); return; }
  const conf = prompt('Yeni şifreyi tekrar girin:');
  if (newPw !== conf) { alert('Şifreler eşleşmiyor!'); return; }

  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) { alert('⚠️ Sunucu bağlantısı yapılandırılmamış.'); return; }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'changeUserPassword',
      token: token,
      username: currentUser.username,
      oldPassword: current,
      newPassword: newPw
    }),
    mode: 'no-cors'
  }).then(() => {
    // Hatırlanan giriş bilgisi varsa güncelle
    try {
      const rem = JSON.parse(localStorage.getItem('lc_remembered_creds') || 'null');
      if (rem && rem.username && rem.username.toLowerCase() === currentUser.username.toLowerCase()) {
        localStorage.setItem('lc_remembered_creds', JSON.stringify({ username: rem.username, password: newPw }));
      }
    } catch(e) {}
    alert('✅ Şifre değişiklik isteği gönderildi. Eğer mevcut şifreniz doğruysa şifreniz güncellendi.');
  }).catch(() => {
    alert('❌ İşlem başarısız. İnternet bağlantınızı kontrol edin.');
  });
}

// ────────────────────────────
// GOOGLE SHEETS ENTEGRASYONU
// ────────────────────────────
async function pushToSheets() {
  if (SHEETS_DEVRE_DISI) { alert('⚠️ Google Sheets bağlantısı devre dışı bırakıldı — klasmanlar sadece yerelde (tarayıcınızda) kaydediliyor.'); return; }
  const url = appConfig.sheetsWebAppUrl;
  if (!url) {
    alert('⚠️ Önce Google Apps Script Web App URL\'ini girin!\n\nKlasman Yönetimi → Bağlantı Ayarları bölümüne URL yapıştırın.');
    return;
  }
  const token = appConfig.sheetsApiToken;
  if (!token) {
    alert('⚠️ API Token girilmemiş!\n\nBağlantı Ayarları → API Token alanını doldurun.\nApps Script dosyasındaki API_TOKEN değeriyle aynı olmalı.');
    return;
  }
  const btn = event?.target;
  const origText = btn?.textContent || '';
  if (btn) { btn.textContent = (translations[currentLang]||translations.tr).sending; btn.disabled = true; }
  try {
    const payload = {
      action: 'setKlasmanlar',
      token: token,
      klasmanlar: klasmanlar,
      savedAt: new Date().toISOString()
    };
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      mode: 'no-cors'
    });
 

function renderKlasmanAnaliz() {
  const el = document.getElementById('klasman-analiz-icerik');
  if (!el) return;

  if (!performansData || !performansData.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🎯</div><h3>${(translations[currentLang]||translations.tr).no_data_js}</h3><p>${(translations[currentLang]||translations.tr).no_data_js_hint}</p></div>';
    return;
  }

  const klasmanMap = {};
  performansData.forEach(inspector => {
    Object.entries(inspector.klasmanlar || {}).forEach(([klasmanAd, kd]) => {
      if (!klasmanMap[klasmanAd]) {
        klasmanMap[klasmanAd] = {
          ad: klasmanAd,
          toplamAdet: 0,
          toplamFiiliSure: 0,
          toplamStandartSure: 0,
          inspectorSayisi: 0,
          standartKontrolSure: null,
          istasyonSure: null,
          kayitSayisi: 0,
          adetListesi: []
        };
      }
      klasmanMap[klasmanAd].toplamAdet        += kd.adet || 0;
      klasmanMap[klasmanAd].toplamFiiliSure   += kd.kayitFiiliSure || 0;
      klasmanMap[klasmanAd].toplamStandartSure += kd.standartSure || 0;
      klasmanMap[klasmanAd].inspectorSayisi   += 1;
      (kd.kayitlar || []).forEach(r => {
        klasmanMap[klasmanAd].kayitSayisi += 1;
        if (r.adet) klasmanMap[klasmanAd].adetListesi.push(r.adet);
      });
    });
  });

  klasmanlar.forEach(k => {
    if (klasmanMap[k.ad]) {
      klasmanMap[k.ad].standartKontrolSure = parseFloat(k.urunKontrolSuresi) || 0;
      klasmanMap[k.ad].istasyonSure = k.istasyonlar.reduce((s, i) => s + (parseFloat(i.sure) || 0), 0);
      klasmanMap[k.ad].olcuSuresi = parseFloat(k.olcuSuresi) || 0;
      klasmanMap[k.ad].urunKabulSuresi = parseFloat(k.urunKabulSuresi) || 0;
    }
  });

  const liste = Object.values(klasmanMap)
    .filter(k => k.toplamAdet > 0)
    .sort((a, b) => b.toplamAdet - a.toplamAdet);

  if (!liste.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><h3>${(translations[currentLang]||translations.tr).data_not_found}</h3></div>';
    return;
  }

  const kartlar = liste.map(k => {
    const standart = k.toplamAdet > 0 && k.toplamStandartSure > 0
  ? k.toplamStandartSure / k.toplamAdet
  : (k.standartKontrolSure || 0);
    const istasyon       = k.istasyonSure || 0;
    const gerceklesenOrt = k.toplamAdet > 0 && k.toplamFiiliSure > 0
      ? k.toplamFiiliSure / k.toplamAdet : null;
    const fark = gerceklesenOrt !== null && standart > 0
      ? gerceklesenOrt - standart : null;
    const yuzdeFark = fark !== null && standart > 0
      ? Math.round((fark / standart) * 100) : null;
    const barGenislik = gerceklesenOrt !== null && standart > 0
      ? Math.min(200, Math.round((gerceklesenOrt / standart) * 100)) : 0;
    const barRenk = fark === null ? 'var(--muted2)'
      : fark <= 0 ? '#00897B'
      : fark <= standart * 0.2 ? '#F57F17' : '#C62828';
    const farkIkon = standart === 0 ? '⚠️ Standart süre girilmemiş'
      : fark === null ? '—'
      : fark <= 0 ? '▼ Hedef Altında ✓' : '▲ Hedef Üstünde';

    return `
    <div style="background:#fff;border:1.5px solid var(--border2);border-radius:14px;padding:20px;box-shadow:var(--shadow);position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${barRenk},${barRenk}88);border-radius:14px 14px 0 0;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--navy);">${k.ad}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${formatTR(k.toplamAdet)} adet · ${k.inspectorSayisi} inspector</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:800;color:${barRenk};font-family:'DM Mono',monospace;line-height:1;">${gerceklesenOrt !== null ? gerceklesenOrt.toFixed(2)+'sn' : '—'}</div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:2px;" data-i18n="actual_per_unit">Actual/Unit</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div style="background:var(--lblue3);border:1px solid var(--border2);border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📐 Standart</div>
          <div style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;">${standart > 0 ? standart.toFixed(2)+'sn' : '—'}</div>
          <div style="font-size:10px;color:var(--muted2);margin-top:3px;" data-i18n="one_unit_check">1 unit inspection</div>
          ${istasyon > 0 ? `<div style="font-size:10px;color:var(--muted2);margin-top:1px;">+ ${istasyon.toFixed(2)}sn istasyon</div>` : ''}
        </div>
        <div style="background:${fark!==null&&fark<=0?'var(--lgreen)':standart===0?'var(--lamber)':'var(--lred)'};border:1px solid ${fark!==null&&fark<=0?'#B2DFDB':standart===0?'#FFE082':'#FFCDD2'};border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;" data-i18n="actual_label">⏱ Actual</div>
          <div style="font-size:18px;font-weight:700;color:${barRenk};font-family:'DM Mono',monospace;">${gerceklesenOrt !== null ? gerceklesenOrt.toFixed(2)+'sn' : '—'}</div>
          <div style="font-size:10px;color:${barRenk};margin-top:3px;font-weight:600;">
            ${fark !== null ? (fark>0?'+':'')+fark.toFixed(2)+'sn fark' : 'Standart girilmemiş'}
            ${yuzdeFark !== null ? ` (${fark>0?'+':''}${yuzdeFark}%)` : ''}
          </div>
        </div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:4px;">
          <span data-i18n="actual_vs_std">Actual / Standard ratio</span>
          <span style="font-weight:600;color:${barRenk}">${barGenislik}%</span>
        </div>
        <div style="height:8px;background:var(--border2);border-radius:4px;overflow:hidden;">
          <div style="width:${Math.min(100,barGenislik)}%;height:100%;background:${barRenk};border-radius:4px;"></div>
        </div>
      </div>
      <div style="text-align:center;padding:6px 12px;border-radius:8px;background:${fark!==null&&fark<=0?'var(--lgreen)':standart===0?'var(--lamber)':'var(--lred)'};border:1px solid ${fark!==null&&fark<=0?'#B2DFDB':standart===0?'#FFE082':'#FFCDD2'};">
        <span style="font-size:11px;font-weight:700;color:${barRenk};">${farkIkon}</span>
      </div>
    </div>`;
  }).join('');

  pushKlasmanAnalizToSheets(liste);

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%);border-radius:12px;padding:16px 22px;margin-bottom:20px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <div style="font-size:28px;">🎯</div>
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:700;color:#fff;">${(translations[currentLang]||translations.tr).klasman_actual_analysis}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:3px;">${liste.length} ${(translations[currentLang]||translations.tr).klasman_word} · ${formatTR(liste.reduce((s,k)=>s+k.toplamAdet,0))} ${(translations[currentLang]||translations.tr).total_units_summary}</div>
      </div>
      ${[
        ['✅',(translations[currentLang]||translations.tr).on_target,  liste.filter(k=>{const g=k.toplamAdet>0&&k.toplamFiiliSure>0?k.toplamFiiliSure/k.toplamAdet:null;return g!==null&&k.standartKontrolSure>0&&g<=k.standartKontrolSure;}).length,'#4CAF50'],
        ['⚠️',(translations[currentLang]||translations.tr).near_target, liste.filter(k=>{const g=k.toplamAdet>0&&k.toplamFiiliSure>0?k.toplamFiiliSure/k.toplamAdet:null;const s=k.standartKontrolSure;return g!==null&&s>0&&g>s&&g<=s*1.2;}).length,'#FFB74D'],
        ['🔴',(translations[currentLang]||translations.tr).high_label,  liste.filter(k=>{const g=k.toplamAdet>0&&k.toplamFiiliSure>0?k.toplamFiiliSure/k.toplamAdet:null;const s=k.standartKontrolSure;return g!==null&&s>0&&g>s*1.2;}).length,'#EF9A9A'],
        ['➖',(translations[currentLang]||translations.tr).no_std,       liste.filter(k=>!k.standartKontrolSure||k.standartKontrolSure===0).length,'rgba(255,255,255,.5)']
      ].map(([ic,lb,cnt,col])=>`
        <div style="text-align:center;background:rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;min-width:80px;">
          <div style="font-size:16px;">${ic}</div>
          <div style="font-size:20px;font-weight:800;color:${col};font-family:'DM Mono',monospace;line-height:1.2;">${cnt}</div>
          <div style="font-size:9px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;">${lb}</div>
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${kartlar}
    </div>
  `;
}
showSuccessMessage('✅ ' + klasmanlar.length + ' ' + (translations[currentLang]||translations.tr).sheets_sent_klasman);
  } catch(err) {
    alert('❌ Gönderme hatası: ' + err.message);
  } finally {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
  }
}

// ── KLASMAN ANALİZ STATE ──
let _klAnalizPage = 1;
const _KL_ANALIZ_PER_PAGE = 12;
let _klAnalizFiltre = '';
let _klAnalizSiralama = 'adet-desc';
let _klAnalizTumListe = [];

function _klAnalizUygula() {
  _klAnalizPage = 1;
  const el = document.getElementById('klasman-analiz-icerik');
  if (el) _renderKlAnalizUI(el);
}

function _klAnalizGoTo(p) {
  _klAnalizPage = p;
  const el = document.getElementById('klasman-analiz-icerik');
  if (el) _renderKlAnalizUI(el);
}

function renderKlasmanAnaliz() {
  const el = document.getElementById('klasman-analiz-icerik');
  if (!el) return;

  if (!performansData || !performansData.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🎯</div><h3>${(translations[currentLang]||translations.tr).no_data_js}</h3><p>${(translations[currentLang]||translations.tr).no_data_js_hint}</p></div>';
    return;
  }

  const klasmanMap = {};
  performansData.forEach(inspector => {
    Object.entries(inspector.klasmanlar || {}).forEach(([klasmanAd, kd]) => {
      if (!klasmanMap[klasmanAd]) {
        klasmanMap[klasmanAd] = {
          ad: klasmanAd, toplamAdet: 0, toplamFiiliSure: 0,
          toplamStandartSure: 0, inspectorSayisi: 0,
          standartKontrolSure: null, istasyonSure: null,
          kayitSayisi: 0, adetListesi: []
        };
      }
      klasmanMap[klasmanAd].toplamAdet         += kd.adet || 0;
      klasmanMap[klasmanAd].toplamFiiliSure    += kd.kayitFiiliSure || 0;
      klasmanMap[klasmanAd].toplamStandartSure += kd.standartSure || 0;
      klasmanMap[klasmanAd].inspectorSayisi    += 1;
      (kd.kayitlar || []).forEach(r => {
        klasmanMap[klasmanAd].kayitSayisi += 1;
        if (r.adet) klasmanMap[klasmanAd].adetListesi.push(r.adet);
      });
    });
  });

  klasmanlar.forEach(k => {
    if (klasmanMap[k.ad]) {
      klasmanMap[k.ad].standartKontrolSure = parseFloat(k.urunKontrolSuresi) || 0;
      klasmanMap[k.ad].istasyonSure = k.istasyonlar.reduce((s, i) => s + (parseFloat(i.sure) || 0), 0);
      klasmanMap[k.ad].olcuSuresi = parseFloat(k.olcuSuresi) || 0;
      klasmanMap[k.ad].urunKabulSuresi = parseFloat(k.urunKabulSuresi) || 0;
    }
  });

  _klAnalizTumListe = Object.values(klasmanMap)
    .filter(k => k.toplamAdet > 0)
    .sort((a, b) => b.toplamAdet - a.toplamAdet);

  if (!_klAnalizTumListe.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><h3>${(translations[currentLang]||translations.tr).data_not_found}</h3></div>';
    return;
  }

  pushKlasmanAnalizToSheets(_klAnalizTumListe);
  _klAnalizPage = 1;
  _klAnalizFiltre = '';
  _klAnalizSiralama = 'adet-desc';
  _renderKlAnalizUI(el);
}

function _klAnalizFiltrele() {
  let liste = [..._klAnalizTumListe];

  // DÜZELTME: durum filtresi ve "fark" sıralaması artık adet-başı ortalama
  // yerine TOPLAM oran (toplamFiiliSure / toplamStandartSure) kullanır —
  // bkz. _renderKlAnalizUI içindeki açıklama.
  const oranHesapla = k => (k.toplamStandartSure > 0 && k.toplamFiiliSure > 0)
    ? k.toplamFiiliSure / k.toplamStandartSure : null;

  if (_klAnalizFiltre.trim()) {
    const q = _klAnalizFiltre.trim().toLowerCase();
    liste = liste.filter(k => k.ad.toLowerCase().includes(q));
  }

  const durumFiltre = document.getElementById('kla-durum-filtre')?.value || '';
  if (durumFiltre === 'hedefte') {
    liste = liste.filter(k => {
      const o = oranHesapla(k);
      return o !== null && k.toplamStandartSure > 0 && o <= 1;
    });
  } else if (durumFiltre === 'yakin') {
    liste = liste.filter(k => {
      const o = oranHesapla(k);
      return o !== null && k.toplamStandartSure > 0 && o > 1 && o <= 1.2;
    });
  } else if (durumFiltre === 'yuksek') {
    liste = liste.filter(k => {
      const o = oranHesapla(k);
      return o !== null && k.toplamStandartSure > 0 && o > 1.2;
    });
  } else if (durumFiltre === 'stdyok') {
    liste = liste.filter(k => !k.toplamStandartSure || k.toplamStandartSure === 0);
  }

  switch (_klAnalizSiralama) {
    case 'adet-desc':  liste.sort((a, b) => b.toplamAdet - a.toplamAdet); break;
    case 'adet-asc':   liste.sort((a, b) => a.toplamAdet - b.toplamAdet); break;
    case 'ad-asc':     liste.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')); break;
    case 'ad-desc':    liste.sort((a, b) => b.ad.localeCompare(a.ad, 'tr')); break;
    case 'fark-desc':  liste.sort((a, b) => {
      const oa = oranHesapla(a); const ob = oranHesapla(b);
      const ga = oa !== null ? oa : -Infinity;
      const gb = ob !== null ? ob : -Infinity;
      return gb - ga;
    }); break;
    case 'fark-asc':   liste.sort((a, b) => {
      const oa = oranHesapla(a); const ob = oranHesapla(b);
      const ga = oa !== null ? oa : Infinity;
      const gb = ob !== null ? ob : Infinity;
      return ga - gb;
    }); break;
  }

  return liste;
}

function _renderKlAnalizUI(el) {
  const tumListe   = _klAnalizFiltrele();
  const totalPages = Math.max(1, Math.ceil(tumListe.length / _KL_ANALIZ_PER_PAGE));
  if (_klAnalizPage > totalPages) _klAnalizPage = totalPages;
  if (_klAnalizPage < 1) _klAnalizPage = 1;

  const startIdx   = (_klAnalizPage - 1) * _KL_ANALIZ_PER_PAGE;
  const sayfaListe = tumListe.slice(startIdx, startIdx + _KL_ANALIZ_PER_PAGE);
  const orijinal   = _klAnalizTumListe;

  // DÜZELTME: "adet başına ortalama" yerine TOPLAM baz kullanılıyor.
  // Sebep: Ölçü Süresi ve Ürün Kabul Süresi parti başına sabit/yarı-sabit
  // maliyetlerdir. Bunları toplam standart süreye dahil edip adede bölmek,
  // küçük partilerde oranı yapay şişirir, büyük partilerde yapay düşürür.
  // toplamFiiliSure / toplamStandartSure oranı bu çarpıtmadan etkilenmez.
  const oranHesaplaKlasman = k => (k.toplamStandartSure > 0 && k.toplamFiiliSure > 0)
    ? k.toplamFiiliSure / k.toplamStandartSure
    : null;

  const hedefte = orijinal.filter(k => { const o = oranHesaplaKlasman(k); return o !== null && k.toplamStandartSure > 0 && o <= 1; }).length;
  const yakin   = orijinal.filter(k => { const o = oranHesaplaKlasman(k); return o !== null && k.toplamStandartSure > 0 && o > 1 && o <= 1.2; }).length;
  const yuksek  = orijinal.filter(k => { const o = oranHesaplaKlasman(k); return o !== null && k.toplamStandartSure > 0 && o > 1.2; }).length;
  const stdYok  = orijinal.filter(k => !k.toplamStandartSure || k.toplamStandartSure === 0).length;

  const kartlar = sayfaListe.map((k, idxOnPage) => {
    // "Standart" ve "Gerçekleşen" (adet başına, sn) — sadece GÖRSEL REFERANS.
    // Bunlar parti büyüklük karışımından etkilenebilir; bu yüzden durum/renk/yüzde
    // hesaplamasında KULLANILMAZ, sadece kart üstünde bilgi amaçlı gösterilir.
    const standart = k.toplamAdet > 0 && k.toplamStandartSure > 0
  ? k.toplamStandartSure / k.toplamAdet
  : (k.standartKontrolSure || 0);
    const istasyon       = k.istasyonSure || 0;
    const gerceklesenOrt = k.toplamAdet > 0 && k.toplamFiiliSure > 0 ? k.toplamFiiliSure / k.toplamAdet : null;

    // DÜZELTME: Asıl performans değerlendirmesi TOPLAM baz üzerinden yapılır.
    // oranToplam = toplamFiiliSure / toplamStandartSure (1.0 = tam hedefte)
    const oranToplam = (k.toplamStandartSure > 0 && k.toplamFiiliSure > 0)
      ? k.toplamFiiliSure / k.toplamStandartSure : null;
    const yuzdeFark   = oranToplam !== null ? Math.round((oranToplam - 1) * 100) : null;
    const farkSnGorsel = (gerceklesenOrt !== null && standart > 0) ? gerceklesenOrt - standart : null;
    const barGenislik = oranToplam !== null ? Math.min(200, Math.round(oranToplam * 100)) : 0;
    const barRenk     = oranToplam === null ? 'var(--muted2)'
      : oranToplam <= 1 ? '#00897B'
      : oranToplam <= 1.2 ? '#F57F17' : '#C62828';
    const farkIkon    = k.toplamStandartSure === 0 ? '⚠️ Standart süre girilmemiş'
      : oranToplam === null ? '—'
      : oranToplam <= 1 ? '▼ Hedef Altında ✓' : '▲ Hedef Üstünde';

    // ── Hesaplama detayı (buton ile açılır) ──
    const adetListesi   = k.adetListesi || [];
    const minAdet       = adetListesi.length ? Math.min(...adetListesi) : null;
    const maxAdet        = adetListesi.length ? Math.max(...adetListesi) : null;
    const ortAdetParti  = adetListesi.length ? (adetListesi.reduce((s,a)=>s+a,0) / adetListesi.length) : null;
    const detayId = 'kl-detay-' + k.ad.replace(/[^a-zA-Z0-9]/g,'_') + '-' + idxOnPage;

    const detayHtml = `
      <div id="${detayId}" style="display:none;margin-top:10px;padding:14px;background:#F7FAFE;border:1px solid var(--border2);border-radius:10px;font-size:11.5px;color:var(--navy);line-height:1.7;">
        <div style="font-weight:700;margin-bottom:8px;font-size:12px;">🧮 Hesaplama Detayı — ${k.ad}</div>
        <div style="margin-bottom:6px;color:var(--muted2);">
          Bu klasmanda <b>${k.kayitSayisi || 0}</b> kayıt (parti) işlendi.
          ${minAdet !== null ? `Parti büyüklüğü ${minAdet} ile ${maxAdet} adet arasında değişiyor (ortalama ${ortAdetParti.toFixed(1)} adet).` : ''}
        </div>
        <div style="border-top:1px dashed var(--border2);margin:8px 0;"></div>
        <div style="margin-bottom:4px;"><b>1) Toplam Standart Süre</b> (her partinin kendi standart süresi toplamı):</div>
        <div style="margin-left:10px;color:var(--muted2);margin-bottom:6px;">
          = Σ [ (1 Birim Muayene Süresi × parti adedi) + Ölçü eki + Ürün Kabul eki + İstasyon süresi ]<br>
          = <b>${fmtSnKisa(k.toplamStandartSure)}</b> (${k.toplamStandartSure.toFixed(1)}sn)
        </div>
        <div style="margin-bottom:4px;"><b>2) Toplam Gerçekleşen Süre</b> (Excel'deki Başlangıç–Bitiş farklarının toplamı):</div>
        <div style="margin-left:10px;color:var(--muted2);margin-bottom:6px;">
          = <b>${fmtSnKisa(k.toplamFiiliSure)}</b> (${k.toplamFiiliSure.toFixed(1)}sn)
        </div>
        <div style="margin-bottom:4px;"><b>3) Performans Oranı</b> (yüzdeye çevrilmiş hâliyle kart üstündeki yüzde budur):</div>
        <div style="margin-left:10px;color:var(--muted2);margin-bottom:6px;">
          = Toplam Gerçekleşen ÷ Toplam Standart × 100<br>
          = ${k.toplamFiiliSure.toFixed(1)} ÷ ${k.toplamStandartSure.toFixed(1)} × 100 = <b style="color:${barRenk}">${oranToplam !== null ? Math.round(oranToplam*100)+'%' : '—'}</b>
        </div>
        <div style="border-top:1px dashed var(--border2);margin:8px 0;"></div>
        <div style="color:var(--muted2);font-size:10.5px;">
          ℹ️ Kartın üst kısmındaki "${standart>0?standart.toFixed(2):'—'}sn / ${gerceklesenOrt!==null?gerceklesenOrt.toFixed(2):'—'}sn" adet-başı değerleri yalnızca
          referans amaçlıdır — Ölçü ve Ürün Kabul süreleri parti başına sabit eklendiğinden, partilerin
          büyüklüğüne göre adet-başı ortalama yapay olarak değişebilir. Bu yüzden <b>Hedef Üstünde / Altında</b>
          durumu adet-başı değil, yukarıdaki TOPLAM oran üzerinden belirlenir.
        </div>
      </div>`;

    return `
    <div style="background:#fff;border:1.5px solid var(--border2);border-radius:14px;padding:20px;box-shadow:var(--shadow);position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${barRenk},${barRenk}88);border-radius:14px 14px 0 0;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--navy);">${k.ad}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${formatTR(k.toplamAdet)} adet · ${k.inspectorSayisi} inspector</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:800;color:${barRenk};font-family:'DM Mono',monospace;line-height:1;">${oranToplam !== null ? Math.round(oranToplam*100)+'%' : '—'}</div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:2px;">Toplam Oran</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div style="background:var(--lblue3);border:1px solid var(--border2);border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📐 Standart (adet başı)</div>
          <div style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;">${standart > 0 ? standart.toFixed(2)+'sn' : '—'}</div>
          <div style="font-size:10px;color:var(--muted2);margin-top:3px;">1 adet ürün kontrol (ortalama)</div>
          ${istasyon > 0 ? `<div style="font-size:10px;color:var(--muted2);margin-top:1px;">+ ${istasyon.toFixed(2)}sn istasyon</div>` : ''}
        </div>
        <div style="background:${barRenk==='#00897B'?'var(--lgreen)':k.toplamStandartSure===0?'var(--lamber)':'var(--lred)'};border:1px solid ${barRenk==='#00897B'?'#B2DFDB':k.toplamStandartSure===0?'#FFE082':'#FFCDD2'};border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">⏱ Gerçekleşen (adet başı)</div>
          <div style="font-size:18px;font-weight:700;color:${barRenk};font-family:'DM Mono',monospace;">${gerceklesenOrt !== null ? gerceklesenOrt.toFixed(2)+'sn' : '—'}</div>
          <div style="font-size:10px;color:${barRenk};margin-top:3px;font-weight:600;">
            ${farkSnGorsel !== null ? (farkSnGorsel>0?'+':'')+farkSnGorsel.toFixed(2)+'sn fark' : 'Standart girilmemiş'}
            ${yuzdeFark !== null ? ` (${yuzdeFark>0?'+':''}${yuzdeFark}%)` : ''}
          </div>
        </div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:4px;">
          <span>Toplam Gerçekleşen / Toplam Standart oranı</span>
          <span style="font-weight:600;color:${barRenk}">${barGenislik}%</span>
        </div>
        <div style="height:8px;background:var(--border2);border-radius:4px;overflow:hidden;">
          <div style="width:${Math.min(100,barGenislik)}%;height:100%;background:${barRenk};border-radius:4px;"></div>
        </div>
      </div>
      <div style="text-align:center;padding:6px 12px;border-radius:8px;background:${barRenk==='#00897B'?'var(--lgreen)':k.toplamStandartSure===0?'var(--lamber)':'var(--lred)'};border:1px solid ${barRenk==='#00897B'?'#B2DFDB':k.toplamStandartSure===0?'#FFE082':'#FFCDD2'};margin-bottom:8px;">
        <span style="font-size:11px;font-weight:700;color:${barRenk};">${farkIkon}</span>
      </div>
      <button onclick="document.getElementById('${detayId}').style.display = document.getElementById('${detayId}').style.display==='none' ? 'block' : 'none'; this.textContent = this.textContent.includes('Göster') ? '🧮 Hesaplamayı Gizle' : '🧮 Hesaplamayı Göster';"
        style="width:100%;padding:7px;border-radius:8px;border:1px solid var(--border2);background:#fff;color:var(--blue2);font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">
        🧮 Hesaplamayı Göster
      </button>
      ${detayHtml}
    </div>`;
  }).join('');

  // Sayfalama butonları
  const pageBtns = (() => {
    let html = '';
    let pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages = [1];
      if (_klAnalizPage > 3) pages.push('...');
      for (let i = Math.max(2, _klAnalizPage - 1); i <= Math.min(totalPages - 1, _klAnalizPage + 1); i++) pages.push(i);
      if (_klAnalizPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    pages.forEach(p => {
      if (p === '...') {
        html += `<span style="padding:0 4px;color:var(--muted);line-height:32px;">…</span>`;
      } else {
        const active = p === _klAnalizPage;
        html += `<button onclick="_klAnalizGoTo(${p})"
          style="min-width:32px;height:32px;border-radius:7px;border:1px solid ${active?'var(--blue2)':'var(--border)'};
          background:${active?'var(--blue2)':'var(--white)'};color:${active?'#fff':'var(--navy)'};
          cursor:pointer;font-size:12px;font-weight:${active?'700':'500'};padding:0 8px;
          font-family:'DM Sans',sans-serif;transition:all .12s;">${p}</button>`;
      }
    });
    return html;
  })();

  const mevcut_filtre  = document.getElementById('kla-durum-filtre')?.value || '';
  const mevcut_siralama = _klAnalizSiralama;

  el.innerHTML = `
    <!-- ÖZET BAŞLIK -->
    <div style="background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%);border-radius:12px;padding:16px 22px;margin-bottom:16px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <div style="font-size:28px;">🎯</div>
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:700;color:#fff;">${(translations[currentLang]||translations.tr).klasman_actual_analysis}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:3px;">${orijinal.length} ${(translations[currentLang]||translations.tr).klasman_word} · ${formatTR(orijinal.reduce((s,k)=>s+k.toplamAdet,0))} ${(translations[currentLang]||translations.tr).total_units_summary}</div>
      </div>
      ${[
        ['✅',(translations[currentLang]||translations.tr).on_target,'hedefte',hedefte,'#4CAF50'],
        ['⚠️',(translations[currentLang]||translations.tr).near_target,'yakin',yakin,'#FFB74D'],
        ['🔴',(translations[currentLang]||translations.tr).high_label,'yuksek',yuksek,'#EF9A9A'],
        ['➖',(translations[currentLang]||translations.tr).no_std,'stdyok',stdYok,'rgba(255,255,255,.5)']
      ].map(([ic,lb,val,cnt,col])=>`
        <div onclick="document.getElementById('kla-durum-filtre').value='${val}';_klAnalizUygula()"
          style="text-align:center;background:rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;min-width:80px;cursor:pointer;transition:background .15s;"
          onmouseover="this.style.background='rgba(255,255,255,.2)'" onmouseout="this.style.background='rgba(255,255,255,.1)'">
          <div style="font-size:16px;">${ic}</div>
          <div style="font-size:20px;font-weight:800;color:${col};font-family:'DM Mono',monospace;line-height:1.2;">${cnt}</div>
          <div style="font-size:9px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;">${lb}</div>
        </div>`).join('')}
    </div>

    <!-- FİLTRE & ARAMA ÇUBUĞU -->
    <div style="background:var(--white);border:1px solid var(--border2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;box-shadow:var(--shadow);">
      <div style="position:relative;flex:1;min-width:180px;">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--muted2);">🔍</span>
        <input type="text" id="kla-arama" placeholder="${(translations[currentLang]||translations.tr).select_klasman}…" value="${_klAnalizFiltre}"
          oninput="_klAnalizFiltre=this.value;_klAnalizUygula()"
          style="width:100%;padding:8px 12px 8px 32px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:11px;color:var(--muted);white-space:nowrap;margin:0;">${(translations[currentLang]||translations.tr).filter_perf.replace(':','')}: </label>
        <select id="kla-durum-filtre" onchange="_klAnalizUygula()"
          style="padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:'DM Sans',sans-serif;background:var(--white);color:var(--navy);">
          <option value="" ${mevcut_filtre===''?'selected':''}>${(translations[currentLang]||translations.tr).filter_all}</option>
          <option value="hedefte" ${mevcut_filtre==='hedefte'?'selected':''}>✅ ${(translations[currentLang]||translations.tr).on_target}</option>
          <option value="yakin" ${mevcut_filtre==='yakin'?'selected':''}>${(translations[currentLang]||translations.tr).status_near}</option>
          <option value="yuksek" ${mevcut_filtre==='yuksek'?'selected':''}>${(translations[currentLang]||translations.tr).status_high}</option>
          <option value="stdyok" ${mevcut_filtre==='stdyok'?'selected':''}>➖ ${(translations[currentLang]||translations.tr).no_std}</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:11px;color:var(--muted);white-space:nowrap;margin:0;">${(translations[currentLang]||translations.tr).sort_label}</label>
        <select onchange="_klAnalizSiralama=this.value;_klAnalizUygula()"
          style="padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:'DM Sans',sans-serif;background:var(--white);color:var(--navy);">
          <option value="adet-desc" ${mevcut_siralama==='adet-desc'?'selected':''}>${(translations[currentLang]||translations.tr).sort_qty_desc}</option>
          <option value="adet-asc"  ${mevcut_siralama==='adet-asc'?'selected':''}>${(translations[currentLang]||translations.tr).sort_qty_asc}</option>
          <option value="ad-asc"    ${mevcut_siralama==='ad-asc'?'selected':''}>${(translations[currentLang]||translations.tr).sort_name_asc}</option>
          <option value="ad-desc"   ${mevcut_siralama==='ad-desc'?'selected':''}>${(translations[currentLang]||translations.tr).sort_name_desc}</option>
          <option value="fark-desc" ${mevcut_siralama==='fark-desc'?'selected':''}>${(translations[currentLang]||translations.tr).sort_diff_worst}</option>
          <option value="fark-asc"  ${mevcut_siralama==='fark-asc'?'selected':''}>${(translations[currentLang]||translations.tr).sort_diff_best}</option>
        </select>
      </div>
      <button onclick="_klAnalizFiltre='';_klAnalizSiralama='adet-desc';document.getElementById('kla-durum-filtre').value='';_klAnalizUygula()"
        style="padding:7px 14px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--white);cursor:pointer;color:var(--muted);font-family:'DM Sans',sans-serif;transition:all .15s;"
        onmouseover="this.style.background='var(--lblue3)'" onmouseout="this.style.background='var(--white)'">${(translations[currentLang]||translations.tr).reset}</button>
      <span style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-left:auto;">
        ${tumListe.length} / ${orijinal.length} klasman · Sayfa ${_klAnalizPage}/${totalPages}
      </span>
    </div>

    <!-- KARTLAR -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:20px;">
      ${kartlar || '<div style="grid-column:1/-1;padding:48px;text-align:center;color:var(--muted2);"><div style="font-size:32px;margin-bottom:12px;">🔍</div><h3 style="font-weight:500;color:var(--muted);" data-i18n="klasman_filter_empty">Filtreyle eşleşen klasman bulunamadı</h3></div>'}
    </div>

    <!-- SAYFALAMA -->
    ${totalPages > 1 ? `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border2);margin-top:4px;">
      <button onclick="_klAnalizGoTo(${_klAnalizPage - 1})" ${_klAnalizPage<=1?'disabled':''}
        style="padding:8px 16px;border:1px solid var(--border);border-radius:8px;font-size:13px;cursor:pointer;
        background:var(--white);color:var(--navy);font-family:'DM Sans',sans-serif;font-weight:500;
        opacity:${_klAnalizPage<=1?'.4':'1'};transition:all .15s;">‹ Önceki</button>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:center;">
        ${pageBtns}
      </div>
      <button onclick="_klAnalizGoTo(${_klAnalizPage + 1})" ${_klAnalizPage>=totalPages?'disabled':''}
        style="padding:8px 16px;border:1px solid var(--border);border-radius:8px;font-size:13px;cursor:pointer;
        background:var(--white);color:var(--navy);font-family:'DM Sans',sans-serif;font-weight:500;
        opacity:${_klAnalizPage>=totalPages?'.4':'1'};transition:all .15s;">Sonraki ›</button>
    </div>` : ''}
  `;
}

async function pullFromSheets() {
  const url = appConfig.sheetsWebAppUrl;
  if (!url) {
    alert('⚠️ Önce Google Apps Script Web App URL\'ini girin!');
    return;
  }
  const token = appConfig.sheetsApiToken;
  if (!token) {
    alert('⚠️ API Token girilmemiş!\n\nBağlantı Ayarları → API Token alanını doldurun.');
    return;
  }
  const btn = event?.target;
  const origText = btn?.textContent || '';
  if (btn) { btn.textContent = (translations[currentLang]||translations.tr).pulling; btn.disabled = true; }

  // iframe/postMessage ile veri çek (v5.1 - GitHub Pages CORS çözümü)
  async function gsFetch(action, extraParams) {
    const params = { action, token, ...(extraParams || {}) };
    const data = await jsonpFetch(url, params);
    return data;
  }

  try {
    const data = await gsFetch('getKlasmanlar');

    if (data.status === 'error') {
      throw new Error(data.message || 'Sunucu hata döndürdü');
    }

    if (data && data.klasmanlar && Array.isArray(data.klasmanlar)) {
      const count = data.klasmanlar.length;
      const savedAt = data.savedAt ? new Date(data.savedAt).toLocaleString('tr-TR') : '—';
      if (!confirm(`📥 ${count} klasman bulundu.\nSon kayıt: ${savedAt}\n\nMevcut verilerin üzerine yazılsın mı?`)) return;
      klasmanlar = data.klasmanlar;
      nextId = Math.max(1, ...klasmanlar.map(k => k.id || 0)) + 1;
      secilenId = null;
      sayfa = 1;
      saveData();
      renderListe();
      renderEditor();
      updateSidebar();
      updateKlasmanFilter();   // dashboard klasman filtresi dropdown'ı güncelle

      // Performans verisini de Sheets'ten çek (sayfalandırmalı)
      try {
        const { performansData: pd } = await fetchPerformansRawPaginated(url, token);
        if (pd && pd.length > 0) {
          performansData = fixVerimlilikPerf(restorePerformansDateObjects(pd));
          saveData();
          console.log('✅ Performans verisi Sheets\'ten çekildi:', performansData.length, 'inspector');
        }
      } catch(perfErr) {
        console.warn('Performans çekme hatası (önemsiz):', perfErr.message);
      }

      renderDashboard(); renderQuarterBadge(performansData);       // inspector kartlarını performans verisiyle yeniden çiz
      showSuccessMessage(`✅ ${count} ` + (translations[currentLang]||translations.tr).sheets_updated_count);
    } else {
      alert('❌ Geçersiz veri formatı döndü.\nApps Script doğru yapılandırıldı mı?');
    }
  } catch(err) {
    alert('❌ Veri çekilemedi: ' + err.message + '\n\n🔧 Kontrol listesi:\n• Web App URL doğru mu?\n• API Token eşleşiyor mu?\n• "Erişimi olan: Herkes" seçili mi?\n• En son dağıtım versiyonu mu kullanılıyor?');
  } finally {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
  }
}

// ─────────────────────────────────────────────
// PERFORMANS VERİSİNİ SHEETS'E GÖNDER
// Excel yüklendiğinde otomatik çağrılır
// ─────────────────────────────────────────────
async function pushPerformansToSheets(liste) {
  if (SHEETS_DEVRE_DISI) return;
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return; // Bağlantı ayarı yapılmamışsa sessizce çık

  try {
    // performansData'yı düz tablo formatına çevir (Sheets için okunabilir)
    const rows = liste.map(row => ({
      ins: row.ins,
      adet: row.adet,
      kayit: row.kayit,
      gunSayisi: row.gunSayisi || 0,
      standartSureDk: row.standartSure ? Math.round(row.standartSure / 60) : 0,
      mesaiSureDk: row.mesaiSure ? Math.round(row.mesaiSure / 60) : 0,
      genelHizPerf: row.genelHizPerf,
      verimlilikPerf: row.verimlilikPerf,
      klasmanOzet: Object.entries(row.klasmanlar || {})
        .map(([k,v]) => `${k}:${v.adet}adet(${v.hizPerf}%)`)
        .join(' | ')
    }));

    const payload = {
      action: 'setPerformans',
      token: token,
      performans: rows,
      savedAt: new Date().toISOString()
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      mode: 'no-cors'
    });

    console.log('✅ Performans verisi Sheets\'e gönderildi:', rows.length, 'inspector');
  } catch(err) {
    console.warn('Performans Sheets gönderme hatası:', err.message);
  }
}

// ─────────────────────────────────────────────
// PERFORMANS HAM VERİSİNİ SHEETS'E GÖNDER
// Tam JSON — farklı bilgisayarlardan çekilebilir
// ─────────────────────────────────────────────
async function pushPerformansRawToSheets(liste) {
  if (SHEETS_DEVRE_DISI) return;
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return;
  try {
    // kayitlar dizisi olmadan gönder — boyut sınırını aşmamak için
    // (kayitlar ayrıca setInspectorKayitlar ile gönderilir)
    // YENİ
const _pushHedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
const _pushOrneklemeMod = document.querySelector('input[name="ornekleme-mod"]:checked')?.value || 'kapali';
const _pushOrneklemeTarihliAktif = document.getElementById('ornekleme-tarihli-aktif')?.checked || false;
const listeTemiz = liste.map(inspector => {
  const klasmanlarTemiz = {};
  Object.entries(inspector.klasmanlar || {}).forEach(([k, v]) => {
    klasmanlarTemiz[k] = {
      adet: v.adet, standartSure: v.standartSure,
      kayitFiiliSure: v.kayitFiiliSure, hizPerf: v.hizPerf, hacimPerf: v.hacimPerf
    };
  });
  return {
    ...inspector,
    klasmanlar: klasmanlarTemiz,
    toplamMesaistiSaniye: inspector.toplamMesaistiSaniye || 0,
    gunlukOvertimeDetay: inspector.gunlukOvertimeDetay || {},
    hedefVerimlilik: _pushHedef,
    verimlilikPerf: inspector.genelHizPerf != null ? Math.round(inspector.genelHizPerf * (100 / _pushHedef)) : inspector.verimlilikPerf,
    orneklemeMod: _pushOrneklemeMod,
    orneklemeTarihliAktif: _pushOrneklemeTarihliAktif,
    orneklemeDonemleri: _pushOrneklemeTarihliAktif ? orneklemeDonemleri : []
  };
});

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'setPerformansRaw',
        token: token,
        performansData: listeTemiz,
        savedAt: new Date().toISOString()
      }),
      mode: 'no-cors'
    });
    console.log('✅ Ham performans verisi Sheets\'e gönderildi:', liste.length, 'inspector');

    // Her inspector'ın kayitlar verisini ayrı sekmeye gönder
    await pushInspectorKayitlarToSheets(liste, url, token);

  } catch(err) {
    console.warn('Ham performans push hatası:', err.message);
  }
}

// ─────────────────────────────────────────────
// HER INSPECTOR'IN KAYITLARINI AYRI SEKMEYE GÖNDER
// Google Sheets > InspectorKayitlar sekmesi (v5.3)
// ─────────────────────────────────────────────
async function pushInspectorKayitlarToSheets(liste, url, token) {
  if (SHEETS_DEVRE_DISI) return;
  if (!url || !token || !liste || !liste.length) return;
  let gonderilen = 0;
  for (const inspector of liste) {
    // Temizle butonuna basıldıysa yüklemeyi tamamen durdur
    if (window._uploadAborted) {
      console.warn('⛔ Yükleme Temizle ile durduruldu:', gonderilen, '/', liste.length, 'inspector gönderildi');
      break;
    }
    try {
      const kayitlar = {};
      Object.entries(inspector.klasmanlar || {}).forEach(([k, v]) => {
        if (Array.isArray(v.kayitlar) && v.kayitlar.length > 0) {
          kayitlar[k] = v.kayitlar.map(r => ({
            adet: r.adet,
            talepNo: r.talepNo || '',
            kontrolAdetSuresi: r.kontrolAdetSuresi,
            istasyonSuresi: r.istasyonSuresi,
            standartSure: r.standartSure,
            kayitFiiliSure: r.kayitFiiliSure,
            baslangic: r.baslangic ? (r.baslangic instanceof Date ? r.baslangic.toISOString() : r.baslangic) : null,
            bitis: r.bitis ? (r.bitis instanceof Date ? r.bitis.toISOString() : r.bitis) : null,
            tarihGecerli: r.tarihGecerli || false,
            inspectionTipi: r.inspectionTipi || '',
            is2Kalite: r.is2Kalite || false
          }));
        }
      });

      // Kayıt yoksa bu inspector'ı atla — gereksiz istek gönderme
      if (Object.keys(kayitlar).length === 0) continue;

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'setInspectorKayitlar',
          token: token,
          inspectorAdi: inspector.ins,
          kayitlar: kayitlar
        }),
        mode: 'no-cors'
      });

      gonderilen++;

      // Google Apps Script rate limit aşımını önlemek için 300ms bekle
      await new Promise(r => setTimeout(r, 300));

    } catch(err) {
      console.warn('Inspector kayıt push hatası (' + inspector.ins + '):', err.message);
    }
  }
  console.log('✅ Inspector kayıtları Sheets\'e gönderildi:', gonderilen, '/', liste.length, 'inspector');
}
// ─────────────────────────────────────────────
// PERFORMANS VERİSİNİ SHEETS'TEN ÇEK
// Dashboard "📥 Sheets'ten Çek" butonu + otomatik açılış
// ─────────────────────────────────────────────
// ── Sayfalandırmalı Performans Veri Çekici ──────────────────────────────────
// Büyük veri setlerinde Google Apps Script'in ~450KB HTML yanıt sınırı aşılır
// ve "Unterminated string in JSON" hatası oluşur.  Bu yardımcı fonksiyon
// veriyi page/pageSize ile parça parça çekip birleştirir.
async function fetchPerformansRawPaginated(url, token, onProgress) {
  const PAGE_SIZE = 20;
  // 1. Toplam kayıt sayısını al (hafif istek)
  const countResp = await jsonpFetch(url, { action: 'getPerformansRaw', token, countOnly: 'true' });
  if (!countResp || countResp.status !== 'ok') {
    throw new Error(countResp?.message || 'countOnly isteği başarısız');
  }
  const totalCount = countResp.totalCount || 0;
  const totalPages = countResp.totalPages || Math.ceil(totalCount / PAGE_SIZE) || 1;
  if (totalCount === 0) return { performansData: [], savedAt: null, totalCount: 0 };

  let allData = [];
  let savedAt = countResp.savedAt || null;
  for (let page = 0; page < totalPages; page++) {
    if (onProgress) onProgress(page + 1, totalPages);
    const resp = await jsonpFetch(url, {
      action: 'getPerformansRaw', token,
      page: String(page), pageSize: String(PAGE_SIZE)
    });
    if (resp?.status === 'ok' && Array.isArray(resp.performansData)) {
      allData = allData.concat(resp.performansData);
      if (!savedAt && resp.savedAt) savedAt = resp.savedAt;
    } else {
      console.warn(`⚠️ Sayfa ${page}/${totalPages} hatası:`, resp?.message || 'bilinmiyor');
    }
  }
  return { performansData: allData, savedAt, totalCount };
}

// ── PHP/MySQL üzerinden Performans Verisi Çek (YENİ — kademeli backend geçişi) ──
// fetchPerformansRawPaginated() ile TAM OLARAK AYNI dönüş sözleşmesini kullanır
// ({performansData, savedAt, totalCount}); tek fark gerçek fetch()+CORS ile
// çalışması — iframe/JSONP/Apps Script'e hiç ihtiyaç duymaz. api.php bu iki
// action'ı destekler: getPerformansRaw (GET, sayfalı) ve setPerformansRaw
// (POST, Apps Script'in ilettiği veriyi kaydetmek için).
async function fetchPerformansRawPaginatedPhp(apiUrl, token, onProgress) {
  const PAGE_SIZE = 20;
  const countRes = await fetch(apiUrl + '?action=getPerformansRaw&token=' + encodeURIComponent(token) + '&countOnly=true');
  if (!countRes.ok) throw new Error('cPanel API HTTP ' + countRes.status);
  const countResp = await countRes.json();
  if (!countResp || countResp.status !== 'ok') {
    throw new Error(countResp?.message || 'countOnly isteği başarısız');
  }
  const totalCount = countResp.totalCount || 0;
  const totalPages = countResp.totalPages || 1;
  if (totalCount === 0) return { performansData: [], savedAt: null, totalCount: 0 };

  let allData = [];
  let savedAt = countResp.savedAt || null;
  for (let page = 0; page < totalPages; page++) {
    if (onProgress) onProgress(page + 1, totalPages);
    const res = await fetch(apiUrl + '?action=getPerformansRaw&token=' + encodeURIComponent(token) + '&page=' + page + '&pageSize=' + PAGE_SIZE);
    if (!res.ok) { console.warn(`⚠️ Sayfa ${page}/${totalPages} HTTP hatası:`, res.status); continue; }
    const resp = await res.json();
    if (resp?.status === 'ok' && Array.isArray(resp.performansData)) {
      allData = allData.concat(resp.performansData);
      if (!savedAt && resp.savedAt) savedAt = resp.savedAt;
    } else {
      console.warn(`⚠️ Sayfa ${page}/${totalPages} hatası:`, resp?.message || 'bilinmiyor');
    }
  }
  return { performansData: allData, savedAt, totalCount };
}

async function pullPerformansFromSheets(silent = false) {
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  // KADEMELİ GEÇİŞ: PHP_PERFORMANS_API_URL doluysa Apps Script bağlantı
  // kontrolü tamamen atlanır — artık gerekli değil.
  const phpModu = !!PHP_PERFORMANS_API_URL;
  if (!phpModu && (!url || !token)) {
    if (!silent) alert('⚠️ Sheets bağlantısı yapılandırılmamış.');
    return false;
  }

  const btn = document.getElementById('dash-pull-btn');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = (translations[currentLang]||translations.tr).pulling; btn.disabled = true; }

  try {
    // KADEMELİ GEÇİŞ: PHP_PERFORMANS_API_URL doluysa (cPanel/MySQL), performans
    // verisi ORADAN çekilir — gerçek fetch()+CORS, iframe/JSONP gerekmez.
    // Boşsa (varsayılan), eskisi gibi Apps Script üzerinden (jsonpFetch) çekilir.
    const kaynakAdi = PHP_PERFORMANS_API_URL ? 'cPanel/MySQL' : 'Google Sheets';
    const { performansData: allPerformansData } = PHP_PERFORMANS_API_URL
      ? await fetchPerformansRawPaginatedPhp(
          PHP_PERFORMANS_API_URL, DEFAULT_API_TOKEN,
          (cur, total) => { if (btn) btn.innerHTML = `⬇️ ${cur}/${total} çekiliyor...`; }
        )
      : await fetchPerformansRawPaginated(
          url, token,
          (cur, total) => { if (btn) btn.innerHTML = `⬇️ ${cur}/${total} çekiliyor...`; }
        );
    const data = {
      status: 'ok',
      performansData: allPerformansData,
      count: allPerformansData.length
    };
    console.log(`📥 Toplam çekilen inspector (${kaynakAdi}):`, allPerformansData.length);

    if (data.status === 'ok' && Array.isArray(data.performansData) && data.performansData.length > 0) {
      performansData = fixVerimlilikPerf(restorePerformansDateObjects(data.performansData));
      // verimlilikPerf hedefVerimlilik'e göre yeniden hesaplandı
      saveData();
      renderDashboard(); renderQuarterBadge(performansData);
      updateSidebar();
      renderTopInspectors();
      if (!silent) showSuccessMessage(`✅ ${performansData.length} ` + (translations[currentLang]||translations.tr).sheets_loaded_perf);
      else showStartupBanner(`✅ ${performansData.length} inspector verisi güncellendi`, 'success');
      console.log('✅ Performans verisi Sheets\u2019ten çekildi:', performansData.length, 'inspector');
      return true;
    } else {
      const _detay = data.status !== 'ok'
        ? ' (status: ' + (data.status || 'bilinmiyor') + ')'
        : (Array.isArray(data.performansData) ? ' (kayıt: ' + data.performansData.length + ')' : ' (performansData alanı yok)');
      if (!silent) showSuccessMessage((translations[currentLang]||translations.tr).sheets_no_perf + _detay);
      console.warn('\u26a0\ufe0f getPerformansRaw boş/hatalı yanıt:', JSON.stringify(data).substring(0, 200));
      return false;
    }
  } catch(err) {
    if (!silent) alert('❌ Performans verisi çekilemedi: ' + err.message);
    else console.warn('Performans otomatik çekme hatası:', err.message);
    return false;
  } finally {
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
  }
}

function showSheetsHelp() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(11,31,58,.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 32px;width:min(90vw,680px);max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(11,31,58,.35);border:1px solid var(--border2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:var(--navy);margin-bottom:4px">📋 Google Apps Script Kurulum Rehberi</h2>
          <p style="font-size:12px;color:var(--muted)" data-i18n="sheets_help_intro">Klasman verilerini Google Sheets ile senkronize etmek için</p>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="width:32px;height:32px;border:1px solid var(--border);background:var(--offwhite);border-radius:8px;cursor:pointer;font-size:16px">✕</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">

        <div style="background:var(--lblue3);border:1px solid var(--lblue);border-radius:10px;padding:14px 16px">
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📥 Adım 1 — Apps Script Dosyasını İndirin</div>
          <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Panelle birlikte gelen <strong>LCW_Klasman_Script.gs</strong> dosyasını indirin ve içeriğini kullanın.</p>
          <div style="background:var(--navy);color:#adf;font-family:'DM Mono',monospace;font-size:10px;padding:10px 12px;border-radius:6px;white-space:pre-wrap">API_TOKEN = 'lcw-secret-2024'  ← Bunu değiştirin ve panele de girin
SHEET_NAME = 'Klasmanlar'      ← Sekme adı (değiştirmeye gerek yok)</div>
        </div>

        <div style="background:var(--lgreen);border:1px solid #B2DFDB;border-radius:10px;padding:14px 16px">
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">⚙️ Adım 2 — Apps Script'e Yapıştırın</div>
          <ol style="font-size:11px;color:var(--muted);line-height:2;padding-left:18px">
            <li>Google Sheets dosyanızı açın (yoksa yeni oluşturun)</li>
            <li>Üst menü: <strong>Uzantılar → Apps Script</strong></li>
            <li>Açılan editörde mevcut kodu <strong>tamamen silin</strong></li>
            <li><strong>LCW_Klasman_Script.gs</strong> içeriğini yapıştırın</li>
            <li><strong>API_TOKEN</strong> değerini istediğiniz şifreyle değiştirin</li>
            <li>Kaydet (Ctrl+S)</li>
          </ol>
        </div>

        <div style="background:var(--lamber);border:1px solid #FFE082;border-radius:10px;padding:14px 16px">
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">🚀 Adım 3 — Web App Olarak Yayınlayın</div>
          <ol style="font-size:11px;color:var(--muted);line-height:2;padding-left:18px">
            <li>Apps Script editöründe: <strong>Dağıt → Yeni Dağıtım</strong></li>
            <li>Tür: <strong>Web uygulaması</strong></li>
            <li>Açıklama: <em>Ürün Klasman Sync v1</em></li>
            <li>Farklı çalıştır: <strong>Ben (hesabınız)</strong></li>
            <li>Erişimi olan: <strong>Herkes</strong></li>
            <li><strong>Dağıt</strong>'a tıklayın → Google hesabı izni isteyecek, onaylayın</li>
            <li>Oluşan <strong>Web uygulaması URL'ini kopyalayın</strong></li>
          </ol>
        </div>

        <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:10px;padding:14px 16px">
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">🔗 Adım 4 — Panele Bağlayın</div>
          <ol style="font-size:11px;color:var(--muted);line-height:2;padding-left:18px">
            <li>Kopyaladığınız URL'i <strong>Web App URL</strong> alanına yapıştırın</li>
            <li>Apps Script'teki <strong>API_TOKEN</strong> değerini <strong>API Token</strong> alanına girin</li>
            <li>Google Sheets dosyasının linkini <strong>Tablo Linki</strong> alanına yapıştırın</li>
            <li><strong>📤 Sheets'e Gönder</strong> ile test edin</li>
          </ol>
        </div>

        <div style="background:var(--lred);border:1px solid #FFCDD2;border-radius:10px;padding:12px 14px">
          <div style="font-size:11px;font-weight:600;color:var(--red);margin-bottom:4px">⚠️ Önemli Notlar</div>
          <ul style="font-size:11px;color:var(--muted);line-height:1.8;padding-left:16px">
            <li>Gönderme (📤) işlemi <em>no-cors</em> modunda çalışır — yanıt göremezsiniz ama veri gider</li>
            <li>Çekme (📥) işlemi CORS gerektirir — Apps Script "Herkes" erişimine açık olmalı</li>
            <li>Script kodu değiştirilirse <strong>yeni bir dağıtım</strong> oluşturulmalı (eski URL değişmez)</li>
            <li>Farklı bilgisayarlarda aynı URL ve Token kullanılmalı</li>
          </ul>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}

// ────────────────────────────────────────────────────────────────────────────
// PERFORMANS ANALİZİ — MANİFEST GÖNDER (manuel buton)
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// PERFORMANS VERİSİ — SENKRON DURUMU (Sheets'e gönderilmedi uyarısı)
// ────────────────────────────────────────────────────────────────────────────
// performansHesapla() her çalıştığında (örnekleme modu, tarih, sütun vs.
// değiştiğinde) çağrılır. Veri artık otomatik Sheets'e gitmediği için
// kullanıcıya "değişiklikler var, göndermedin" uyarısı gösterir.
function markPerformansUnsynced() {
  const btn = document.getElementById('perf-push-btn');
  if (!btn) return;
  btn.classList.add('btn-pulse-warning');
  btn.dataset.unsynced = '1';
  if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.innerHTML;
  btn.innerHTML = '📤 Sheets\'e Gönder <span style="background:#fff;color:#E65100;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:4px">●</span>';
}

function markPerformansSynced() {
  const btn = document.getElementById('perf-push-btn');
  if (!btn) return;
  btn.classList.remove('btn-pulse-warning');
  btn.dataset.unsynced = '0';
  if (btn.dataset.origLabel) btn.innerHTML = btn.dataset.origLabel;
}

async function pushPerformansManual(ev) {
  window._uploadAborted = false;
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;

  // KADEMELİ GEÇİŞ: PHP_PERFORMANS_API_URL doluysa (cPanel/MySQL), Apps
  // Script'e HİÇ gidilmez — bağlantı ayarı kontrolü de atlanır, çünkü artık
  // gerekli değil. token yine de gerekli (PHP API'nin kendi token kontrolü
  // için) — appConfig.sheetsApiToken zaten panel.js'teki DEFAULT_API_TOKEN'a
  // eşit olduğundan (bkz. loadConfig), aynı token PHP tarafında da geçerli.
  const phpModu = !!PHP_PERFORMANS_API_URL;

  if (!phpModu && (!url || !token)) {
    alert('⚠️ Google Sheets bağlantısı yapılandırılmamış!\n\nKlasman Yönetimi → Bağlantı Ayarları bölümünden\nWeb App URL ve API Token girin.');
    return;
  }

  if (!performansData || performansData.length === 0) {
    alert('⚠️ Gönderilecek performans verisi yok.\nÖnce Excel dosyası yükleyin ve analizi tamamlayın.');
    return;
  }

  const btn = document.getElementById('perf-push-btn');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = (translations[currentLang]||translations.tr).sending; btn.disabled = true; }

  try {
    const _manualHedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
    const _manualOrneklemeMod = document.querySelector('input[name="ornekleme-mod"]:checked')?.value || 'kapali';
    const _manualOrneklemeTarihliAktif = document.getElementById('ornekleme-tarihli-aktif')?.checked || false;
    const performansDataTemiz = performansData.map(inspector => {
      const klasmanlarTemiz = {};
      Object.entries(inspector.klasmanlar || {}).forEach(([k, v]) => {
        klasmanlarTemiz[k] = {
          adet: v.adet, standartSure: v.standartSure,
          kayitFiiliSure: v.kayitFiiliSure, hizPerf: v.hizPerf, hacimPerf: v.hacimPerf
        };
      });
      // "Ne ödül ne ceza" düzeltmesi CANLI _manualHedef ile: aksi halde
      // ekranda gösterilen (düzeltilmiş) yüzde ile Sheets/DB'ye gönderilen
      // yüzde birbirini tutmaz. getDispPerf() çağırmıyoruz çünkü o,
      // inspector.hedefVerimlilik'teki olası ESKİ/durağan hedefi kullanır.
      const standartSnPush = inspector.standartSure || 0;
      let mesaiSnPush = inspector.mesaiSure || 0;
      const notrKayipSnPush = getNotrKayipDakikaForInspector(inspector.ins) * 60;
      if (notrKayipSnPush > 0 && mesaiSnPush > notrKayipSnPush) mesaiSnPush -= notrKayipSnPush;
      const hamPerfPush = (standartSnPush > 0 && mesaiSnPush > 0)
        ? Math.round((standartSnPush / mesaiSnPush) * 100) : inspector.genelHizPerf;
      const verimlilikPerfPush = hamPerfPush != null ? Math.round(hamPerfPush * (100 / _manualHedef)) : inspector.verimlilikPerf;

      return {
        ...inspector,
        klasmanlar: klasmanlarTemiz,
        toplamMesaistiSaniye: inspector.toplamMesaistiSaniye || 0,
        gunlukOvertimeDetay: inspector.gunlukOvertimeDetay || {},
        hedefVerimlilik: _manualHedef,
        verimlilikPerf: verimlilikPerfPush,
        orneklemeMod: _manualOrneklemeMod,
        orneklemeTarihliAktif: _manualOrneklemeTarihliAktif,
        orneklemeDonemleri: _manualOrneklemeTarihliAktif ? orneklemeDonemleri : []
      };
    });

    if (phpModu) {
      // ── YENİ: Doğrudan cPanel/MySQL'e gönder — Apps Script'e hiç gidilmez ──
      const savedAt = new Date().toISOString();
      const res = await fetch(PHP_PERFORMANS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setPerformansRaw', token: DEFAULT_API_TOKEN, performansData: performansDataTemiz, savedAt })
      });
      if (!res.ok) throw new Error('cPanel API HTTP ' + res.status);
      const resp = await res.json();
      if (!resp || resp.status !== 'ok') throw new Error(resp?.message || 'cPanel API kaydetme hatası');
      console.log('✅ Performans verisi cPanel/MySQL\u2019e gönderildi:', resp.count, 'inspector');
    } else {
      // ── ESKİ YOL: Google Apps Script / Sheets (artık kullanılmıyor, geriye dönük) ──
      // PHP_PERFORMANS_API_URL her zaman dolu olduğundan bu dal normalde hiç
      // çalışmaz; SHEETS_DEVRE_DISI kontrolü ek bir güvenlik katmanıdır.
      if (SHEETS_DEVRE_DISI) throw new Error('Google Sheets bağlantısı devre dışı bırakıldı.');
      const _rowsHedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
      const rows = performansData.map(row => ({
        ins: row.ins,
        adet: row.adet,
        kayit: row.kayit,
        gunSayisi: row.gunSayisi || 0,
        standartSureDk: row.standartSure ? Math.round(row.standartSure / 60) : 0,
        mesaiSureDk:    row.mesaiSure    ? Math.round(row.mesaiSure / 60)    : 0,
        genelHizPerf:   row.genelHizPerf,
        verimlilikPerf: row.genelHizPerf != null ? Math.round(row.genelHizPerf * (100 / _rowsHedef)) : row.verimlilikPerf,
        hedefVerimlilik: _rowsHedef,
        klasmanOzet: Object.entries(row.klasmanlar || {})
          .map(([k,v]) => `${k}:${v.adet || 0}adet(${Math.round(v.hizPerf) || 0}%)`)
          .join(' | ')
      }));

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'setPerformans', token, performans: rows, savedAt: new Date().toISOString() }),
        mode: 'no-cors'
      });

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'setPerformansRaw', token, performansData: performansDataTemiz, savedAt: new Date().toISOString() }),
        mode: 'no-cors'
      });

      await pushInspectorKayitlarToSheets(performansData, url, token);
    }

    showSuccessMessage(`✅ ${performansData.length} ` + (translations[currentLang]||translations.tr).sheets_sent_perf);
    markPerformansSynced();
  } catch(err) {
    alert('❌ Gönderme hatası: ' + err.message);
  } finally {
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PERFORMANS ANALİZİ — SHEETS'TEN ÇEK (manuel buton)
// ────────────────────────────────────────────────────────────────────────────
async function pullPerformansFromSheetsManual(ev) {
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  // KADEMELİ GEÇİŞ: PHP_PERFORMANS_API_URL doluysa Apps Script bağlantı
  // kontrolü tamamen atlanır — artık gerekli değil.
  const phpModu = !!PHP_PERFORMANS_API_URL;

  if (!phpModu && (!url || !token)) {
    alert('⚠️ Google Sheets bağlantısı yapılandırılmamış!\n\nKlasman Yönetimi → Bağlantı Ayarları bölümünden\nWeb App URL ve API Token girin.');
    return;
  }

  const btn = document.getElementById('perf-pull-btn');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = (translations[currentLang]||translations.tr).pulling; btn.disabled = true; }

  try {
    const { performansData: allPd, savedAt } = phpModu
      ? await fetchPerformansRawPaginatedPhp(
          PHP_PERFORMANS_API_URL, DEFAULT_API_TOKEN,
          (cur, total) => { if (btn) btn.innerHTML = `⬇️ ${cur}/${total} çekiliyor...`; }
        )
      : await fetchPerformansRawPaginated(
          url, token,
          (cur, total) => { if (btn) btn.innerHTML = `⬇️ ${cur}/${total} çekiliyor...`; }
        );
    const data = {
      status: 'ok',
      performansData: allPd,
      savedAt: savedAt
    };

    if (data.status === 'ok' && Array.isArray(data.performansData) && data.performansData.length > 0) {
      const count    = data.performansData.length;
      const savedAtFmt  = data.savedAt ? new Date(data.savedAt).toLocaleString('tr-TR') : '—';

      if (!confirm(`📥 Sheets'te ${count} inspector verisi bulundu.\nSon kayıt: ${savedAtFmt}\n\nMevcut analiz verilerinin üzerine yazılsın mı?`)) {
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
        return;
      }

      performansData = fixVerimlilikPerf(restorePerformansDateObjects(data.performansData));
      saveData();
      renderDashboard();
      updateSidebar();
      renderTopInspectors();
      // Analiz tablosunu yeniden çiz
      if (typeof renderPerformansTable === 'function') renderPerformansTable();
      showSuccessMessage(`✅ ${count} ` + (translations[currentLang]||translations.tr).sheets_loaded_to_perf);
    } else {
      const detay = data.status !== 'ok'
        ? ` (Durum: ${data.status || 'bilinmiyor'})`
        : (Array.isArray(data.performansData) ? ` (${data.performansData.length} kayıt)` : ' (veri alanı yok)');
      alert('ℹ️ Sheets\'te henüz performans verisi bulunamadı.' + detay + '\n\nÖnce bir bilgisayardan Excel yükleyip "📤 Sheets\'e Gönder" butonunu kullanın.');
    }
  } catch(err) {
    alert('❌ Veri çekilemedi: ' + err.message + '\n\n🔧 Kontrol listesi:\n• Web App URL doğru mu?\n• API Token eşleşiyor mu?\n• Apps Script "Erişimi olan: Herkes" seçili mi?');
  } finally {
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PERFORMANS ANALİZİ — NASIL ÇALIŞIR MODALI
// ────────────────────────────────────────────────────────────────────────────
function showPerformansHowItWorks() {
  // Mevcut ortalama göster
  const toplamInsp = performansData.length;
  const ortPerf    = toplamInsp > 0
    ? Math.round(performansData.reduce((s, r) => s + (r.genelHizPerf || 0), 0) / toplamInsp)
    : null;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(11,31,58,.72);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 32px;width:min(92vw,780px);max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(11,31,58,.35);border:1px solid var(--border2)">

      <!-- Başlık -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
        <div>
          <h2 style="font-size:19px;font-weight:700;color:var(--navy);margin-bottom:4px" data-i18n="perf_how_title">📊 Performans Analizi — Nasıl Çalışır?</h2>
          <p style="font-size:12px;color:var(--muted)" data-i18n="perf_how_sub">Hesaplama mantığı, formüller ve Google Sheets entegrasyonu</p>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="width:34px;height:34px;border:1px solid var(--border);background:var(--offwhite);border-radius:8px;cursor:pointer;font-size:17px;flex-shrink:0">✕</button>
      </div>

      ${toplamInsp > 0 ? `
      <!-- Anlık Özet -->
      <div style="background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%);border-radius:12px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:18px;color:#fff">
        <div style="font-size:32px">📈</div>
        <div style="flex:1">
          <div style="font-size:12px;color:rgba(255,255,255,.65);margin-bottom:2px">Şu anki analiz</div>
          <div style="font-size:15px;font-weight:700">${toplamInsp} inspector · Ort. Hız Performansı: <span style="color:#90CAF9;font-family:'DM Mono',monospace">${ortPerf}%</span></div>
        </div>
      </div>` : ''}

      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- 1 - Veri akışı -->
        <div style="background:var(--lblue3);border:1px solid var(--lblue);border-radius:10px;padding:14px 16px">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px">📂 1 — Veri Akışı</div>
          <ol style="font-size:12px;color:var(--muted);line-height:2.1;padding-left:18px;margin:0">
            <li>Excel dosyanızı <strong>Dosya Yükle</strong> alanına sürükleyin (.xlsx / .xls)</li>
            <li><strong>Sütun Eşleme</strong> panelinde doğru kolonları seçin (Klasman, Inspector, Adet, Tarihler)</li>
            <li>Tablo anında hesaplanır — her satır bir inspectörün bir klasmandaki kaydıdır</li>
            <li>İstersen <strong>📤 Sheets'e Gönder</strong> ile sonuçları buluta kaydet</li>
          </ol>
        </div>

        <!-- 2 - Temel hesaplamalar -->
        <div style="background:var(--lgreen);border:1px solid #B2DFDB;border-radius:10px;padding:14px 16px">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">⚙️ 2 — Temel Hesaplamalar</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">

            <div style="background:#fff;border:1px solid #B2DFDB;border-radius:8px;padding:11px 13px">
              <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:5px">🕐 Standart Süre (sn)</div>
              <code style="font-size:10px;background:var(--offwhite);padding:4px 7px;border-radius:4px;display:block;color:var(--navy);line-height:1.8">
                Klasman → istasyon süreleri toplamı<br>
                × BakilacakMiktar (adet)
              </code>
              <div style="font-size:10px;color:var(--muted);margin-top:6px">Bir inspektörün o miktarı <em>standart hızda</em> incelemesi için gereken teorik süre.</div>
            </div>

            <div style="background:#fff;border:1px solid #B2DFDB;border-radius:8px;padding:11px 13px">
              <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:5px">⏱ Fiili/Mesai Süresi (sn)</div>
              <code style="font-size:10px;background:var(--offwhite);padding:4px 7px;border-radius:4px;display:block;color:var(--navy);line-height:1.8">
                Mesai sütunu varsa → sütun değeri<br>
                Yoksa → Gün Sayısı × 7.5 saat
              </code>
              <div style="font-size:10px;color:var(--muted);margin-top:6px">İnspektörün fiilen harcadığı (veya harcaması gereken) çalışma süresi.</div>
            </div>

            <div style="background:#fff;border:1px solid #B2DFDB;border-radius:8px;padding:11px 13px">
              <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:5px">🏎 Hız Performansı (%)</div>
              <code style="font-size:10px;background:var(--offwhite);padding:4px 7px;border-radius:4px;display:block;color:var(--navy);line-height:1.8">
                (Standart Süre ÷ Mesai Süresi) × 100
              </code>
              <div style="font-size:10px;color:var(--muted);margin-top:6px">%100 = tam standart hızda çalıştı · %120 = standarttan %20 hızlı · %80 = %20 yavaş.</div>
            </div>

            <div style="background:#fff;border:1px solid #B2DFDB;border-radius:8px;padding:11px 13px">
              <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:5px">⚡ Verimlilik Performansı (%)</div>
              <code style="font-size:10px;background:var(--offwhite);padding:4px 7px;border-radius:4px;display:block;color:var(--navy);line-height:1.8">
                Hız Perf × (100 ÷ Hedef%)
              </code>
              <div style="font-size:10px;color:var(--muted);margin-top:6px">Hedef verimlilik %100'den farklıysa düzeltme katsayısı uygulanır.</div>
            </div>

          </div>
        </div>

        <!-- 3 - Gün sayısı -->
        <div style="background:var(--lamber);border:1px solid #FFE082;border-radius:10px;padding:14px 16px">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px">📅 3 — Çalışma Gün Sayısı Nasıl Hesaplanır?</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.9">
            <p style="margin-bottom:6px">Bir inspektörün <strong>birden fazla kaydı</strong> varsa her kayıttaki (Başlangıç–Bitiş) aralıklarına bakılır:</p>
            <ol style="padding-left:18px;margin:0;line-height:2.1">
              <li>Her kayıt için <em>Başlangıç Tarihi → Bitiş Tarihi</em> arasındaki fark hesaplanır</li>
              <li>Tüm tarih aralıkları birleştirilir, <strong>çakışan günler bir kez sayılır</strong></li>
              <li>Sonuç: inspektörün gerçek çalışma gün sayısı</li>
            </ol>
            <p style="margin-top:8px;font-size:11px;background:#fff8;padding:7px 10px;border-radius:6px;border-left:3px solid var(--amber)">
              ⚠️ Mesai sütunu seçilmezse gün sayısı × 7,5 saat baz alınır. Mesai sütunu seçilirse o değer doğrudan kullanılır.
            </p>
          </div>
        </div>

        <!-- 4 - Performans seviyeleri -->
        <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:10px;padding:14px 16px">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">🏅 4 — Performans Seviyeleri</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
            <div style="text-align:center;padding:10px 8px;background:#E0F2F1;border-radius:8px;border:1px solid #B2DFDB">
              <div style="font-size:18px;margin-bottom:4px">⭐</div>
              <div style="font-size:13px;font-weight:700;color:#00695C">≥ 95%</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">Mükemmel</div>
            </div>
            <div style="text-align:center;padding:10px 8px;background:var(--lblue2);border-radius:8px;border:1px solid var(--lblue)">
              <div style="font-size:18px;margin-bottom:4px">👍</div>
              <div style="font-size:13px;font-weight:700;color:var(--blue)">85–94%</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">İyi</div>
            </div>
            <div style="text-align:center;padding:10px 8px;background:var(--lamber);border-radius:8px;border:1px solid #FFE082">
              <div style="font-size:18px;margin-bottom:4px">⚠️</div>
              <div style="font-size:13px;font-weight:700;color:var(--amber)">70–84%</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">Orta</div>
            </div>
            <div style="text-align:center;padding:10px 8px;background:var(--lred);border-radius:8px;border:1px solid #FFCDD2">
              <div style="font-size:18px;margin-bottom:4px">🔴</div>
              <div style="font-size:13px;font-weight:700;color:var(--red)">< 70%</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">Düşük</div>
            </div>
          </div>
        </div>

        <!-- 5 - Sheets entegrasyonu -->
        <div style="background:linear-gradient(135deg,#E8F5E9 0%,#fff 100%);border:1px solid #A5D6A7;border-radius:10px;padding:14px 16px">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">☁️ 5 — Google Sheets Entegrasyonu</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:#fff;border:1px solid #A5D6A7;border-radius:8px;padding:11px 13px">
              <div style="font-size:12px;font-weight:700;color:#2E7D32;margin-bottom:6px">📤 Sheets'e Gönder</div>
              <ul style="font-size:11px;color:var(--muted);line-height:1.9;padding-left:16px;margin:0">
                <li>Mevcut <strong>${toplamInsp} inspector</strong> verisini buluta yükler</li>
                <li>Hem okunabilir tablo hem ham JSON gönderilir</li>
                <li>Diğer bilgisayarlardan erişime açılır</li>
                <li>Otomatik tarih damgası ekler</li>
              </ul>
            </div>
            <div style="background:#fff;border:1px solid #A5D6A7;border-radius:8px;padding:11px 13px">
              <div style="font-size:12px;font-weight:700;color:#1565C0;margin-bottom:6px">📥 Sheets'ten Çek</div>
              <ul style="font-size:11px;color:var(--muted);line-height:1.9;padding-left:16px;margin:0">
                <li>Sheets'teki ham JSON verisi çekilir</li>
                <li>Onay sonrası mevcut verilerin üzerine yazar</li>
                <li>Dashboard ve Canlı Gösterim güncellenir</li>
                <li>Son kayıt tarihi gösterilir</li>
              </ul>
            </div>
          </div>
          <div style="margin-top:10px;font-size:11px;color:var(--muted);padding:8px 12px;background:rgba(255,255,255,.7);border-radius:6px;border-left:3px solid #4CAF50">
            💡 Bağlantı kurulmamışsa <strong>Klasman Yönetimi → Bağlantı Ayarları</strong> bölümünden Web App URL ve API Token girin.
          </div>
        </div>

      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:18px;gap:10px">
        <button onclick="this.closest('[style*=fixed]').remove()" style="padding:8px 20px;background:var(--blue2);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Tamam</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VERI YÖNETİMİ (LOCALSTORAGE)
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// Local Storage'dan veri yükle
function restorePerformansDateObjects(liste) {
  // JSON serialize/deserialize sonrası Date nesneleri string'e dönüşür.
  // Kayıt listesindeki baslangic/bitis alanlarını tekrar Date objesine çevir.
  if (!Array.isArray(liste)) return liste;
  liste.forEach(inspector => {
    if (!inspector.klasmanlar) return;
    Object.values(inspector.klasmanlar).forEach(kd => {
      if (!Array.isArray(kd.kayitlar)) return;
      kd.kayitlar.forEach(k => {
        if (k.baslangic && !(k.baslangic instanceof Date)) {
          const d = new Date(k.baslangic);
          k.baslangic = isNaN(d.getTime()) ? null : d;
        }
        if (k.bitis && !(k.bitis instanceof Date)) {
          const d = new Date(k.bitis);
          k.bitis = isNaN(d.getTime()) ? null : d;
        }
      });
    });
  });
  return liste;
}

// ─────────────────────────────────────────────
// PULL SONRASI verimlilikPerf DÜZELT
// Sheets'ten gelen hedefVerimlilik'i inp-verimlilik input'una yazar,
// verimlilikPerf'i de bu değere göre yeniden hesaplar.
// Böylece hangi bilgisayardan pull yapılırsa yapılsın doğru değer görünür.
// ─────────────────────────────────────────────
function fixVerimlilikPerf(liste) {
  if (!Array.isArray(liste) || liste.length === 0) return liste;

  // 1) Sheets'ten gelen hedefVerimlilik değerini bul (ilk geçerli kayıttan al)
  let sheetsHedef = null;
  for (const inspector of liste) {
    if (inspector.hedefVerimlilik && inspector.hedefVerimlilik !== 100) {
      sheetsHedef = inspector.hedefVerimlilik;
      break;
    }
  }
  // Tümü 100 ise de al (en azından tutarlı olsun)
  if (!sheetsHedef) sheetsHedef = liste[0]?.hedefVerimlilik || 100;

  // 2) inp-verimlilik input'unu ve ornekleme-mod radio'sunu güncelle
  const inputEl = document.getElementById('inp-verimlilik');
  if (inputEl) {
    inputEl.value = sheetsHedef;
    const vAciklama = document.getElementById('verimlilik-aciklama');
    if (vAciklama) {
      if (sheetsHedef === 100) vAciklama.textContent = '';
      else if (sheetsHedef < 100) vAciklama.textContent = `(%${sheetsHedef} ${(translations[currentLang]||translations.tr).target_below_100} ${(100/sheetsHedef).toFixed(2)}x) `;
      else vAciklama.textContent = `(%${sheetsHedef} ${(translations[currentLang]||translations.tr).target_above_100} ${(100/sheetsHedef).toFixed(2)}x) `;
    }
  }
  // orneklemeMod radio'sunu Sheets'ten gelen değere göre set et
  const sheetsOrneklemeMod = liste[0]?.orneklemeMod || 'kapali';
  const radioEl = document.getElementById('ornekleme-' + sheetsOrneklemeMod);
  if (radioEl) radioEl.checked = true;

  // Tarihe göre farklı seviyeler (dönemler) — Sheets'ten gelen değere göre geri yükle
  const sheetsTarihliAktif = !!liste[0]?.orneklemeTarihliAktif;
  const sheetsDonemler = Array.isArray(liste[0]?.orneklemeDonemleri) ? liste[0].orneklemeDonemleri : [];
  const tarihliCb = document.getElementById('ornekleme-tarihli-aktif');
  if (tarihliCb) tarihliCb.checked = sheetsTarihliAktif;
  orneklemeDonemleri = sheetsTarihliAktif
    ? sheetsDonemler.map(p => ({ start: p.start || '', end: p.end || '', mode: p.mode || 'kapali', depolar: Array.isArray(p.depolar) ? p.depolar : [] }))
    : [];
  const tarihliWrap = document.getElementById('ornekleme-donemler-wrap');
  if (tarihliWrap) tarihliWrap.style.display = sheetsTarihliAktif ? 'flex' : 'none';
  const tarihliTag = document.getElementById('ornekleme-default-tag');
  if (tarihliTag) tarihliTag.style.display = sheetsTarihliAktif ? 'inline-block' : 'none';
  renderOrneklemeDonemleri();

  // 3) Her inspector'ın verimlilikPerf ve hedefVerimlilik'ini güncelle
  liste.forEach(inspector => {
    inspector.hedefVerimlilik = sheetsHedef;
    if (inspector.genelHizPerf !== null && inspector.genelHizPerf !== undefined) {
      inspector.verimlilikPerf = Math.round(inspector.genelHizPerf * (100 / sheetsHedef));
    }
  });
  return liste;
}

function loadData() {
  try {
    const saved = localStorage.getItem('lc_inspection_data');
    if (saved) {
      const data = JSON.parse(saved);
      klasmanlar = data.klasmanlar || [];
      nextId = data.nextId || 1;
      // Verimlilik hedefini ÖNCE geri yükle — fixVerimlilikPerf bu değeri referans alacak
      if (data.verimlilikHedef && document.getElementById('inp-verimlilik')) {
        document.getElementById('inp-verimlilik').value = data.verimlilikHedef;
      }
      // performansData'yı yükle ve verimlilikPerf'i güncelle
      // (fixVerimlilikPerf inp-verimlilik'e yazılmış olan localStorage hedefini kullanır)
      const rawListe = restorePerformansDateObjects(data.performansData || []);
      // localStorage'dan yüklerken Sheets'ten gelen hedef varsa kullan, yoksa localStorage hedefi
      const lsHedef = data.verimlilikHedef || 100;
      rawListe.forEach(inspector => {
        if (!inspector.hedefVerimlilik || inspector.hedefVerimlilik === 100) {
          inspector.hedefVerimlilik = lsHedef;
        }
        if (inspector.genelHizPerf !== null && inspector.genelHizPerf !== undefined) {
          inspector.verimlilikPerf = Math.round(inspector.genelHizPerf * (100 / inspector.hedefVerimlilik));
        }
      });
      performansData = rawListe;
      console.log('✅ localStorage\'dan yüklendi:', klasmanlar.length, 'klasman,', performansData.length, 'inspector');
    } else {
      // İlk kurulum - örnek veriler
      klasmanlar = [
        { id: 1, ad: 'Pantolon', urunKontrolSuresi: 90, olcuSuresi: 0, urunKabulSuresi: 0, istasyonlar: [
          {id: 1, ad: 'Ölçü Kontrol', sure: 120},
          {id: 2, ad: 'Dikiş Kalitesi', sure: 180},
          {id: 3, ad: 'Son Kontrol', sure: 90}
        ]},
        { id: 2, ad: 'Ceket', urunKontrolSuresi: 150, olcuSuresi: 0, urunKabulSuresi: 0, istasyonlar: [
          {id: 1, ad: 'Yaka Kontrolü', sure: 240},
          {id: 2, ad: 'Düğme Test', sure: 120},
          {id: 3, ad: 'Astar Kontrolü', sure: 180}
        ]},
        { id: 3, ad: 'Mont', urunKontrolSuresi: 120, olcuSuresi: 0, urunKabulSuresi: 0, istasyonlar: [
          {id: 1, ad: 'Ölçü Alma', sure: 180},
          {id: 2, ad: 'Fit Denemesi', sure: 360},
          {id: 3, ad: 'Pull Test', sure: 300}
        ]}
      ];
      nextId = 4;
    }
  } catch (err) {
    console.error('❌ localStorage okuma hatası:', err);
    klasmanlar = [];
    nextId = 1;
  }
}

// Local Storage'a veri kaydet
function saveData() {
  try {
    // kayitlar dizisi localStorage'a kaydedilmez - buyuk veri oldugu icin
    // 5MB kotasini asiyor. Kayitlar Sheets InspectorKayitlar sekmesinden cekilir.
    const performansDataTemiz = (performansData || []).map(inspector => {
      const klasmanlarTemiz = {};
      Object.entries(inspector.klasmanlar || {}).forEach(([k, v]) => {
        klasmanlarTemiz[k] = {
          adet: v.adet,
          standartSure: v.standartSure,
          kayitFiiliSure: v.kayitFiiliSure,
          hizPerf: v.hizPerf,
          hacimPerf: v.hacimPerf
        };
      });
      return { ...inspector, klasmanlar: klasmanlarTemiz };
    });
    const data = {
      klasmanlar: klasmanlar,
      nextId: nextId,
      performansData: performansDataTemiz,
      verimlilikHedef: parseFloat(document.getElementById('inp-verimlilik')?.value) || 100,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('lc_inspection_data', JSON.stringify(data));
    const notification = document.getElementById('save-notification');
    notification.classList.add('show');
    setTimeout(() => { notification.classList.remove('show'); }, 3000);
    console.log('✅ Veriler localStorage\'a kaydedildi');
  } catch (err) {
    console.error('❌ localStorage kaydetme hatası:', err);
    alert('Veriler kaydedilemedi: ' + err.message);
  }
}

function saveDashboardData() { saveData(); }

async function clearDashboardData() {
  if (!confirm((translations[currentLang]||translations.tr).clear_confirm)) return;

  // ── Devam eden veri yükleme işlemini tamamen durdur ───────────────────────
  window._uploadAborted = true;

  // ── Tüm devam eden işlemleri durdur ──────────────────────────────────────
  
  // 1) Slideshow durdur
  if (slideshowActive) {
    slideshowActive = false;
    if (slideshowInterval) { clearInterval(slideshowInterval); slideshowInterval = null; }
    if (progressInterval)  { clearInterval(progressInterval);  progressInterval  = null; }
    document.getElementById('slideshow-container').classList.remove('running');
    document.getElementById('slideshow-btn').innerHTML =
      '<svg width=14 height=14 viewBox="0 0 24 24" fill="currentColor" style="margin-right:4px"><polygon points="5,3 19,12 5,21"/></svg> '
      + (translations[currentLang]||translations.tr).start_slideshow;
    const canliCtrl = document.getElementById('canli-controls');
    if (canliCtrl) canliCtrl.style.display = 'block';
    showWelcomeScreen();
  }

  // 2) HD Video kaydı durdur
  if (_vidRendering) {
    _vidRendering = false;
    _stopFillLoop();
    clearTimeout(_vidSlideTimer);
    if (_vidRecorder && _vidRecorder.state !== 'inactive') _vidRecorder.stop();
    if (_vidStream) { _vidStream.getTracks().forEach(t => t.stop()); _vidStream = null; }
    _hideRecordingIndicator();
    const vidBtn = document.getElementById('video-rec-btn');
    if (vidBtn) {
      vidBtn.innerHTML  = '🎥 Video Oluştur';
      vidBtn.className  = 'btn btn-success';
      vidBtn.disabled   = false;
      vidBtn.onclick    = startVideoRecording;
    }
  }

  // 3) Countdown ring durdur
  _stopCountdownRing();

  // 4) Klasman auto-push timer iptal et
  clearTimeout(_klasmanPushTimer);
  clearTimeout(window._configPushTimer);

  // 5) Başlangıç banner'ı gizle
  hideStartupBanner();

  // 6) Analiz overlay açıksa kapat
  const aoOv = document.getElementById('analiz-overlay');
  if (aoOv && aoOv.style.display !== 'none') closeAnalizOverlay();

  // 7) Tüm açık modalları kapat
  closeModal();
  closeDetailModal();
  const kpwOv = document.getElementById('klasman-pw-overlay');
  if (kpwOv) kpwOv.style.display = 'none';

  // ── Verileri sıfırla ──────────────────────────────────────────────────────
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;

  const btn = document.querySelector('button[onclick="clearDashboardData()"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = (translations[currentLang]||translations.tr).clearing; btn.disabled = true; }

  performansData         = [];
  excelRows              = [];
  excelCols              = [];
  currentDashboardPage   = 1;
  filteredInspectors     = [];
  slideshowInspectors    = [];
  currentSlideIndex      = 0;
  selectedInspectorDetail = null;
  _klAnalizTumListe      = []; // Klasman Analizi de sıfırla

  saveData();
  renderDashboard();
  renderPerfTabloFromData();
  updateSidebar();
  renderTopInspectors();

  // ── Sheets temizle ────────────────────────────────────────────────────────
  if (!SHEETS_DEVRE_DISI && url && token) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'clearPerformansData', token }),
        mode: 'no-cors'
      });
      showSuccessMessage((translations[currentLang]||translations.tr).clear_ok_sheets);
    } catch(err) {
      showSuccessMessage((translations[currentLang]||translations.tr).clear_ok_local_err + err.message);
    }
  } else {
    showSuccessMessage((translations[currentLang]||translations.tr).clear_ok_local);
  }

  if (btn) { btn.innerHTML = origText; btn.disabled = false; }
  showFileStatus((translations[currentLang]||translations.tr).clear_status, 'var(--amber)');
}

// ────────────────────────────
// TARİH PARSE YARDIMCISI
// ────────────────────────────
function parseFlexibleDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' && val > 40000 && val < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + val * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;
  const dmyMatch = s.match(/^(\d{2})[-.](\d{2})[-.](\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmyMatch) {
    const [, dd, mm, yyyy, hh='0', min='0', ss='0'] = dmyMatch;
    const d = new Date(+yyyy, +mm - 1, +dd, +hh, +min, +ss);
    return isNaN(d.getTime()) ? null : d;
  }
  const ymdhMatch = s.match(/^(\d{4})[-.](\d{2})[-.](\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymdhMatch) {
    const [, yyyy, mm, dd, hh='0', min='0', ss='0'] = ymdhMatch;
    const d = new Date(+yyyy, +mm - 1, +dd, +hh, +min, +ss);
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// ────────────────────────────
// ÇALIŞMA SAATLERİ HESAPLAMA
// ────────────────────────────
function hesaplaGerceklesenSure(baslangicTarih, bitisTarih) {
  if (!baslangicTarih || !bitisTarih) return null;
  const baslangic = parseFlexibleDate(baslangicTarih);
  const bitis = parseFlexibleDate(bitisTarih);
  if (!baslangic || !bitis) return null;
  if (bitis <= baslangic) return null;

  // Gece yarısını geçen kayıtları dilimlere böl: her gün ayrı hesapla
  function gunDilimleriOlustur(bas, bit) {
    const dilimler = [];
    let dilimBas = new Date(bas);
    while (dilimBas < bit) {
      const dilimBit = new Date(dilimBas);
      dilimBit.setHours(23, 59, 59, 999);
      dilimler.push([new Date(dilimBas), dilimBit < bit ? new Date(dilimBit) : new Date(bit)]);
      dilimBas = new Date(dilimBit);
      dilimBas.setMilliseconds(dilimBas.getMilliseconds() + 1); // ertesi güne geç
    }
    return dilimler;
  }

  function hesaplaTekilGun(gunBas, gunBit, sonrakiGunVarMi) {
    // O günün referans tarihi
    const gunBase = new Date(gunBas);
    gunBase.setHours(0, 0, 0, 0);

    const gun8    = new Date(gunBase); gun8.setHours(8,  0, 0, 0);
    const gun1645 = new Date(gunBase); gun1645.setHours(16, 45, 0, 0);
    const gun2000 = new Date(gunBase); gun2000.setHours(20,  0, 0, 0);

    // Gün başlangıcı: 08:00'den önce ise 08:00'e çek
    const gercekBas = gunBas < gun8 ? gun8 : gunBas;

    // Ertesi güne saran kayıt: inspector mesai sonunda (16:45) ürünü bırakmış,
    // gece devam etmemiş, sabah devam etmiştir. Bu yüzden o günün bitiş saatini
    // 16:45'e kırp. Aksi hâlde 23:59:59'a kadar çalışmış gibi hesaplanır.
    let gercekBit;
    if (sonrakiGunVarMi && gunBit.getTime() >= gun2000.getTime()) {
      gercekBit = gun1645;
    } else {
      gercekBit = gunBit > gun2000 ? gun2000 : gunBit;
    }

    if (gercekBit <= gercekBas) return 0;

    let sn = (gercekBit - gercekBas) / 1000;

    // Mola saatleri (RESMİ TAKVİM — hesaplaGunlukMesaiSuresi ile birebir aynı olmalı)
    const ogleB = new Date(gunBase); ogleB.setHours(11, 45, 0, 0);
    const ogleE = new Date(gunBase); ogleE.setHours(12, 25, 0, 0);
    const cay1B = new Date(gunBase); cay1B.setHours(10,  0, 0, 0);
    const cay1E = new Date(gunBase); cay1E.setHours(10, 15, 0, 0);
    const cay2B = new Date(gunBase); cay2B.setHours(14, 10, 0, 0);
    const cay2E = new Date(gunBase); cay2E.setHours(14, 25, 0, 0);

    function kesisimSn(mB, mE, cB, cE) {
      const start = Math.max(mB.getTime(), cB.getTime());
      const end   = Math.min(mE.getTime(), cE.getTime());
      return Math.max(0, (end - start) / 1000);
    }

    const ogleDus = kesisimSn(gercekBas, gercekBit, ogleB, ogleE);
    const cay1Dus = kesisimSn(gercekBas, gercekBit, cay1B, cay1E);
    const cay2Dus = kesisimSn(gercekBas, gercekBit, cay2B, cay2E);
    const tumMola = ogleDus + cay1Dus + cay2Dus;

    // Tüm çalışma mola saatindeyse molayı düşme (molada çalışmış sayılır)
    if (sn - tumMola > 0) {
      sn -= tumMola;
    }
    return sn;
  }

  // Gün dilimlerine böl ve her günü ayrı hesapla
  const dilimler = gunDilimleriOlustur(baslangic, bitis);
  let toplamSn = 0;
  dilimler.forEach(function(d, idx) {
    // Sonraki gün var mı? → bu dilim ertesi güne devam eden bir ara gün
    const sonrakiGunVarMi = idx < dilimler.length - 1;
    toplamSn += hesaplaTekilGun(d[0], d[1], sonrakiGunVarMi);
  });

  return toplamSn > 0 ? toplamSn : (bitis > baslangic ? 1 : null);

}

// UYARI: Bu fonksiyon yalnızca Excel'den gelen inspector kayıtlarını (parsedBaslangic/parsedBitis) alır.
// kayipZamanData buraya GİRMEMELİDİR — kayıp zaman girişleri performans hesabını etkilemez.
function hesaplaInspectorFiiliSure(kayitlar) {
  const dilimler = [];
  kayitlar.forEach(r => {
    // Güvenlik: kayipZamanData kayıtları parsedBaslangic/parsedBitis içermez, otomatik filtrelenir.
    if (!r.parsedBaslangic || !r.parsedBitis) return;
    dilimler.push([r.parsedBaslangic.getTime(), r.parsedBitis.getTime()]);
  });
  if (!dilimler.length) return null;
  dilimler.sort((a, b) => a[0] - b[0]);
  const merged = [dilimler[0]];
  for (let i = 1; i < dilimler.length; i++) {
    const last = merged[merged.length - 1];
    if (dilimler[i][0] <= last[1]) {
      last[1] = Math.max(last[1], dilimler[i][1]);
    } else {
      merged.push([...dilimler[i]]);
    }
  }
  let toplam = 0;
  merged.forEach(([ms, me]) => {
    const sn = hesaplaGerceklesenSure(new Date(ms), new Date(me));
    if (sn) toplam += sn;
  });
  return toplam > 0 ? toplam : null;
}

// Bir kaydin "bitis" zamanina gore normal mesai mi (08:00-16:45) yoksa
// overtime mi (16:45-20:00) oldugunu belirler. Kayit, bitis saatine gore siniflandirilir.
// Standart sure tum kayit icin tek bir dilime (normal veya overtime) atanir - bolunmez,
// cunku is genelde tek oturumda tamamlanir.
function kayitNormalMi(bitisDate) {
  if (!bitisDate) return true; // bilinmiyorsa normal say
  const saat = bitisDate.getHours();
  const dakika = bitisDate.getMinutes();
  const toplamDk = saat * 60 + dakika;
  const sinirDk = 16 * 60 + 45; // 16:45
  return toplamDk <= sinirDk;
}

// UYARI: Bu fonksiyon yalnızca Excel'den gelen inspectorData.kayitListesi'ni alır.
// kayipZamanData buraya GİRMEMELİDİR — kayıp zaman mesai süresini ve performansı etkilemez.
function hesaplaGunlukMesaiSuresi(kayitListesi) {
  if (!kayitListesi || kayitListesi.length === 0) return null;

  // Her gün için o günün en geç bitiş saatini bul
  const gunBitisSaatleri = {}; // key: toDateString(), value: en geç bitis Date

  kayitListesi.forEach(kayit => {
    if (!kayit.parsedBaslangic) return;
    const gun = kayit.parsedBaslangic.toDateString();
    const bitis = kayit.parsedBitis || null;
    if (!gunBitisSaatleri[gun]) {
      gunBitisSaatleri[gun] = bitis;
    } else if (bitis && bitis > gunBitisSaatleri[gun]) {
      gunBitisSaatleri[gun] = bitis;
    }
  });

  const gunSayisi = Object.keys(gunBitisSaatleri).length;
  let toplamMesaiSaniye = 0;
  let toplamMesaistiSaniye = 0; // 16:45 sonrası toplam overtime
  const gunlukOvertimeDetay = {}; // key: gunStr → overtime saniye

  Object.entries(gunBitisSaatleri).forEach(([gunStr, enGecBitis]) => {
    // O günün 08:00 ve sınır saatlerini oluştur
    const gunBase = new Date(gunStr);
    const baslangic = new Date(gunBase); baslangic.setHours(8, 0, 0, 0);
    const normalBitis = new Date(gunBase); normalBitis.setHours(16, 45, 0, 0);  // Normal mesai sonu (16:45'e kadar kapama normal sayilir)
    const mesaiBitis  = new Date(gunBase); mesaiBitis.setHours(20, 0, 0, 0);   // Mesai sonu üst sınır

    let gercekBitis;
    let overtimeSn = 0; // Bu gün için mesai üstü (16:45 sonrası) saniye

    if (!enGecBitis) {
      // Bitiş tarihi yoksa normal mesai varsay
      gercekBitis = normalBitis;
    } else if (enGecBitis >= mesaiBitis) {
      // 20:00 veya sonrası → 20:00'de kes (gece sayılmaz)
      gercekBitis = mesaiBitis;
      // Overtime = 20:00 - 16:45 = 3.25 saat - öğle sonrası çay (15:00-15:15 normalBitis'ten sonra sayılmaz)
      overtimeSn = (mesaiBitis - normalBitis) / 1000; // 3.5 saat = 12600 sn
    } else if (enGecBitis > normalBitis) {
      // 16:45 ile 20:00 arasında → mesai kaldı, gerçek bitiş saati
      gercekBitis = enGecBitis;
      overtimeSn = (enGecBitis - normalBitis) / 1000;
    } else {
      // 16:45 veya öncesi → normal gün, overtime yok
      gercekBitis = normalBitis;
    }

    // Molalar (RESMİ TAKVİM — hesaplaGerceklesenSure ile birebir aynı): öğle 11:45-12:25 (40dk), sabah çayı 10:00-10:15, öğleden sonra çayı 14:10-14:25
    let sureSn = (gercekBitis - baslangic) / 1000;
    if (sureSn <= 0) { sureSn = GUNLUK_CALISMA_SANIYE; }

    function molaDus(mB_h, mB_m, mE_h, mE_m) {
      const molaBas = new Date(gunBase); molaBas.setHours(mB_h, mB_m, 0, 0);
      const molaEnd = new Date(gunBase); molaEnd.setHours(mE_h, mE_m, 0, 0);
      const start = Math.max(baslangic.getTime(), molaBas.getTime());
      const end   = Math.min(gercekBitis.getTime(), molaEnd.getTime());
      return Math.max(0, (end - start) / 1000);
    }

    sureSn -= molaDus(11, 45, 12, 25);  // öğle molası (RESMİ: hesaplaGerceklesenSure ile aynı)
    sureSn -= molaDus(10, 0, 10, 15);   // sabah çayı
    sureSn -= molaDus(14, 10, 14, 25);  // öğleden sonra çayı (RESMİ: hesaplaGerceklesenSure ile aynı)

    toplamMesaiSaniye += Math.max(sureSn, 0);
    toplamMesaistiSaniye += Math.max(overtimeSn, 0);
    if (overtimeSn > 0) {
      gunlukOvertimeDetay[gunStr] = Math.round(overtimeSn / 60); // dakika olarak sakla
    }
  });

  return {
    gunSayisi,
    toplamMesaiSaniye,
    toplamMesaistiSaniye,   // 16:45 sonrası toplam overtime saniye
    gunlukOvertimeDetay,    // gün bazında overtime dakika
    gunlukDetay: Object.keys(gunBitisSaatleri).sort()
  };
}

function parseMesaiSuresi(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string') {
    const s = val.trim();
    const colonMatch = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (colonMatch) {
      const h = parseInt(colonMatch[1]);
      const m = parseInt(colonMatch[2]);
      const sec = colonMatch[3] ? parseInt(colonMatch[3]) : 0;
      return h * 3600 + m * 60 + sec;
    }
    const numVal = parseFloat(s);
    if (!isNaN(numVal)) {
      return numVal > 24 ? numVal * 60 : numVal * 3600;
    }
    return null;
  }
  if (typeof val === 'number') {
    return val > 24 ? val * 60 : val * 3600;
  }
  return null;
}

// ────────────────────────────
// YARDIMCILAR
// ────────────────────────────
function birAdet(k){ 
  const istasyonSuresi = k.istasyonlar.reduce((s,i)=>s+(parseFloat(i.sure)||0),0);
  const urunKontrolSuresi = parseFloat(k.urunKontrolSuresi) || 0;
  return istasyonSuresi + urunKontrolSuresi;
}

function updateSidebar(){
  const n = klasmanlar.length;
  const inspCount = performansData.length;
  document.getElementById('klasman-badge').textContent = n+' '+(translations[currentLang]||translations.tr).klasman_word;
  document.getElementById('inspector-badge').textContent = inspCount+' inspector';
  document.getElementById('nav-kl-count').textContent = n;
  document.getElementById('nav-dashboard-count').textContent = inspCount;
  document.getElementById('sb-klasman-total').textContent = n;
  document.getElementById('sb-inspector-total').textContent = inspCount;
}

function tickClock(){
  const now = new Date();
  const pad = n=>String(n).padStart(2,'0');
  document.getElementById('clock').textContent =
    pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
}
setInterval(tickClock,1000); tickClock();

function toggleSection(bodyId, chevronId) {
  const body = document.getElementById(bodyId);
  const chev = document.getElementById(chevronId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function showPage(id, navEl){
  // Kayıp Zaman Analizi sayfasından çıkılıyorsa arkaplan otomatik yenilemeyi durdur
  if (id !== 'kayip-zaman-admin' && typeof stopKayipZamanAutoRefresh === 'function') {
    stopKayipZamanAutoRefresh();
  }
  // ── Yetki kontrolü ──────────────────────────────────────────────────────
  // Admin olmayan kullanıcılar için: kendilerine atanmayan sekmelere ve
  // her zaman admin'e özel olan klasmanlar/kullanıcılar sayfalarına erişimi engelle.
  let blocked = false;
  if (currentUser && !currentUser.isAdmin) {
    if (id === 'klasmanlar' || id === 'kullanicilar' || id === 'kayip-zaman-admin') {
      blocked = true;
    } else if (id === 'ekip-analiz') {
      blocked = !(currentUser.team || []).length;
    } else if (id === 'kayip-zaman-ekip') {
      blocked = !(currentUser.team || []).length;
    } else if (id !== 'dashboard' && !(currentUser.tabs || []).includes(id)) {
      blocked = true;
    }
  }
  if (blocked) { id = 'dashboard'; navEl = null; }

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  // navEl varsa onu, yoksa event.currentTarget kullan; yetki engeli varsa Dashboard nav'ı aktif et
  const activeNav = navEl || (blocked ? null : event?.currentTarget);
  if (activeNav) {
    activeNav.classList.add('active');
  } else if (id === 'dashboard') {
    const dashNav = document.querySelector(".nav-item[onclick*=\"showPage('dashboard'\"]");
    if (dashNav) dashNav.classList.add('active');
  }

  if(id === 'dashboard') {
    renderDashboard();
  } else if(id === 'klasman-analiz') {
    renderKlasmanAnaliz();
  } else if(id === 'canli') {
    initCanliPage();
  } else if(id === 'performans') {
    renderPerfTabloFromData();
    autoFetchPerfIfNeeded();
  } else if(id === 'kullanicilar') {
    loadAndRenderUsers();
  } else if(id === 'ekip-analiz') {
    renderEkipAnaliz();
  } else if(id === 'kayip-zaman-ekip') {
    loadKayipZamanEkip();
  } else if(id === 'kayip-zaman-admin') {
    loadKayipZamanAdmin();
  } else if(id === 'teknik-inceleme') {
    loadTeknikInceleme();
  }
}

function getPerformanceClass(performans) {
  if (performans >= 95) return 'perf-excellent';
  if (performans >= 85) return 'perf-good';
  if (performans >= 70) return 'perf-average';
  if (performans >= 50) return 'perf-weak';
  return 'perf-verypoor';
}

// Gösterim için kullanılacak performans değeri:
// Eğer verimlilikPerf varsa (Düz. Performans) onu, yoksa genelHizPerf'i döner
// ── "Ne Ödül Ne Ceza" — Nötr Kayıp Zaman Sebepleri ──────────────────────
// Bu sebeplerden kaynaklanan kayıp zaman, Mesai Süresi'nden (performans
// paydasından) düşülür — inspector'ın kontrolü dışında olduğu için ne
// performansını yapay olarak yükseltir ne de cezalandırır, sadece hesap
// dışı bırakılır. "Sistemsel Hata" ve "Elektrik Kesintisi" BİLEREK dışarıda
// bırakıldı (kullanıcı talebiyle) — bu ikisi performansı etkilemeye
// (düşürmeye) devam eder.
const NOTR_KAYIP_SEBEPLERI = ['Ürün Olmaması', 'Insp. Lokasyon Değişimi', 'Diğer'];

function getNotrKayipDakikaForInspector(inspectorName) {
  const nameNorm = String(inspectorName || '').toLowerCase().trim();
  return kayipZamanData
    .filter(r => String(r.inspector || '').toLowerCase().trim() === nameNorm && NOTR_KAYIP_SEBEPLERI.includes(r.sebep))
    .reduce((sum, r) => sum + (r.sureDk || 0), 0);
}

// Ekranda gösterilen TEK performans değeri — artık "ne ödül ne ceza" ilkesini
// içeriyor: yukarıdaki nötr sebeplerden kaynaklanan kayıp zaman, mesai
// süresinden düşülüp performans BUNA GÖRE yeniden (canlı) hesaplanıyor. Bu
// sayede Excel'den SONRA girilen kayıp zaman kayıtları da anında yansır ve
// aynı düşüm başka hiçbir yerde tekrar uygulanmaz (double-counting olmaz) —
// performansHesapla() kasıtlı olarak kayıp zamandan bağımsız/ham tutulur
// (bkz. oradaki not), düzeltme SADECE burada yapılır.
function getDispPerf(inspector) {
  const standartSn = inspector.standartSure || 0;
  let mesaiSn = inspector.mesaiSure || 0;
  const statikDeger = (inspector.verimlilikPerf !== null && inspector.verimlilikPerf !== undefined)
    ? inspector.verimlilikPerf
    : (inspector.genelHizPerf ?? 0);

  if (!standartSn || !mesaiSn) return statikDeger;

  const notrKayipSn = getNotrKayipDakikaForInspector(inspector.ins) * 60;
  if (notrKayipSn > 0 && mesaiSn > notrKayipSn) {
    mesaiSn -= notrKayipSn;
  } else if (notrKayipSn === 0) {
    // Kayıp zaman yoksa statik (performansHesapla'dan gelen) değeri aynen kullan
    // — yuvarlama farklarıyla gereksiz tutarsızlık oluşmasın.
    return statikDeger;
  }

  const hedef = inspector.hedefVerimlilik || 100;
  return Math.round((standartSn / mesaiSn) * 100 * (100 / hedef));
}

function getProgressColor(performans) {
  if (performans >= 95) return '#00897B';
  if (performans >= 85) return '#1565C0';
  if (performans >= 70) return '#F57F17';
  if (performans >= 50) return '#EF5350';
  return '#B71C1C';
}

// Performans seviyesi etiketini döner (5 seviye): Mükemmel/İyi/Orta/Zayıf/Çok Zayıf
function getPerformanceLevelLabel(performans) {
  const t = translations[currentLang] || translations.tr;
  if (performans >= 95) return t.perf_excellent;
  if (performans >= 85) return t.perf_good;
  if (performans >= 70) return t.perf_average;
  if (performans >= 50) return t.perf_weak;
  return t.perf_verypoor;
}

function fmtSnKisa(sn) {
  if (!sn) return '—';
  const s = Math.round(sn);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}s ${String(m).padStart(2,'0')}d` : `${m}d`;
}

// ── Türkçe Sayı Formatı (binlik nokta ayraçlı) ───────────────────────────
// toLocaleString('tr-TR') bazı ortamlarda (özellikle WebView/PWA) çalışmayabilir.
// Bu fonksiyon her durumda doğru binlik nokta ayraçlı format üretir.
function formatTR(num) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// ────────────────────────────
// ÖZET İSTATİSTİKLER
// ────────────────────────────
function updateSummaryStats(inspectors) {
  const total = inspectors.length;
  // Özet istatistikler için getDispPerf() kullanılır — "ne ödül ne ceza"
  // (nötr kayıp zaman) düzeltmesini içeren TEK doğru kaynak. Eskiden burada
  // ayrı, düzeltmesiz bir yerel hesap vardı; bu, üstteki özet sayaçlarla
  // (ör. "5 İYİ") tıklanınca açılan detay popup'ının (showPerfSeviyeDetay,
  // zaten getDispPerf kullanıyordu) FARKLI sayılar göstermesine yol açıyordu.
  const getPerfVal = (i) => getDispPerf(i);

  const excellent = inspectors.filter(i => getPerfVal(i) >= 95).length;
  const good = inspectors.filter(i => {
    const p = getPerfVal(i);
    return p >= 85 && p < 95;
  }).length;
  const average = inspectors.filter(i => {
    const p = getPerfVal(i);
    return p >= 70 && p < 85;
  }).length;
  const poor = inspectors.filter(i => {
    const p = getPerfVal(i);
    return p >= 50 && p < 70;
  }).length;
  const veryPoor = inspectors.filter(i => getPerfVal(i) < 50).length;

  const validPerformances = inspectors.filter(i => 
    i.verimlilikPerf !== null && i.verimlilikPerf !== undefined || i.genelHizPerf !== null && i.genelHizPerf !== undefined
  );
  const avgPerformans = validPerformances.length > 0 
    ? Math.round(validPerformances.reduce((sum, i) => sum + getPerfVal(i), 0) / validPerformances.length)
    : 0;

  const avgWorkingDays = total > 0 
    ? Math.round(inspectors.reduce((sum, i) => sum + (i.gunSayisi || 0), 0) / total)
    : 0;

  const totalProducts = inspectors.reduce((sum, i) => sum + (i.adet || 0), 0);

  document.getElementById('excellent-count').textContent = excellent;
  document.getElementById('good-count').textContent = good;
  document.getElementById('average-count').textContent = average;
  document.getElementById('poor-count').textContent = poor;
  if (document.getElementById('verypoor-count')) document.getElementById('verypoor-count').textContent = veryPoor;
  document.getElementById('avg-performance').textContent = avgPerformans + '%';
  document.getElementById('avg-working-days').textContent = avgWorkingDays + ' ' + (translations[currentLang]||translations.tr).days_suffix;
  document.getElementById('total-products').textContent = formatTR(totalProducts);

  renderQuarterBadge(inspectors);
}

// ― ÇEYREK BADGE ―
// Q1(2-3-4) Q2(5-6-7) Q3(8-9-10) Q4(11-12-1)
function _ayToQuarter(month) {
  if (month >= 2 && month <= 4)  return 'Q1';
  if (month >= 5 && month <= 7)  return 'Q2';
  if (month >= 8 && month <= 10) return 'Q3';
  return 'Q4';
}

var _QUARTER_META = {
  Q1: { label: 'Q1 Inspector Performansları', months: 'Şub–Mar–Nis', cls: 'q1' },
  Q2: { label: 'Q2 Inspector Performansları', months: 'May–Haz–Tem', cls: 'q2' },
  Q3: { label: 'Q3 Inspector Performansları', months: 'Ağu–Eyl–Eki', cls: 'q3' },
  Q4: { label: 'Q4 Inspector Performansları', months: 'Kas–Ara–Oca', cls: 'q4' }
};

function _buildQuarterChips(qs) {
  return qs.map(function(q) {
    var m = _QUARTER_META[q]; if (!m) return '';
    return '<div class="quarter-chip ' + m.cls + '">' +
      '<span class="qc-code">' + q + '</span>' +
      '<span>' + m.label + ' <small style="opacity:.7">(' + m.months + ')</small></span>' +
    '</div>';
  }).join('');
}

function _restoreQuarterBadge(quarters) {
  var w = document.getElementById('quarter-badge-wrap');
  var l = document.getElementById('quarter-badge-list');
  if (!w || !l || !quarters || !quarters.length) return;
  l.innerHTML = _buildQuarterChips(quarters);
  w.style.display = 'flex';
}

function renderQuarterBadge(inspectors) {
  // Sadece gerçek veri varsa badge'i güncelle; hiçbir koşulda silme
  if (!inspectors || !inspectors.length) return;
  var qs = {};
  inspectors.forEach(function(insp) {
    Object.values(insp.klasmanlar || {}).forEach(function(kd) {
      (kd.kayitlar || []).forEach(function(k) {
        var dt = k.baslangic || k.bitis;
        if (!dt) return;
        var d = dt instanceof Date ? dt : new Date(dt);
        if (isNaN(d.getTime())) return;
        qs[_ayToQuarter(d.getMonth() + 1)] = true;
      });
    });
  });
  var ordered = ['Q1','Q2','Q3','Q4'].filter(function(q) { return qs[q]; });
  if (!ordered.length) return; // tarih yoksa badge'e dokunma
  _restoreQuarterBadge(ordered);
  if (JSON.stringify(ordered) !== JSON.stringify(appConfig.activeQuarters || [])) {
    appConfig.activeQuarters = ordered;
    try { localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(appConfig)); } catch(e) {}
    clearTimeout(window._quarterPushTimer);
    window._quarterPushTimer = setTimeout(function() { pushConfigToSheets(); }, 3000);
  }
}


// ────────────────────────────
// HEDEF VERİMLİLİK DEĞİŞİNCE
// ────────────────────────────
// ─────────────────────────────────────────────
// PERFORMANS SEVİYESİ DETAY POPUP
// Genel Durum'daki 5 seviye kartına (Mükemmel/İyi/Orta/Zayıf/Çok Zayıf) tıklanınca
// o seviyedeki inspectorleri; gün sayısı, toplam adet, overtime ve performans
// oranı ile birlikte tablo halinde gösterir.
// ─────────────────────────────────────────────
const PERF_SEVIYE_TANIM = {
  excellent: { label: 'Mükemmel (≥95%)',  icon: '🏆', min: 95,  max: Infinity, color: 'var(--green)' },
  good:      { label: 'İyi (85-94%)',     icon: '👍', min: 85,  max: 95,       color: 'var(--blue)'  },
  average:   { label: 'Orta (70-84%)',    icon: '⚠️', min: 70,  max: 85,       color: 'var(--amber)' },
  weak:      { label: 'Zayıf (50-69%)',   icon: '🔻', min: 50,  max: 70,       color: '#EF5350'      },
  verypoor:  { label: 'Çok Zayıf (<50%)', icon: '📉', min: -Infinity, max: 50, color: '#B71C1C'      }
};

// ─────────────────────────────────────────────
// KLASMAN SÜRE ÖNERİSİ (Sadece Admin)
// Klasman Yönetimi'nde "Analiz Et" butonuna basınca, o klasmanın GERÇEK
// performans verisinden (Performans Analizi'nde işlenmiş Excel verisi) adet
// başına gerçekleşen ortalama süreyi bulur ve bunun %80'i kadar bir hedef
// önerir (gerçekleşen 100sn ise hedef 80sn — performansı zorlayan bir hedef).
// Üç bilinmeyen (1 Birim Muayene + Ölçü + Ürün Kabul) olduğundan tek bir doğru
// cevap yok; üç farklı dağıtım senaryosu sunulur, admin elle seçip uygular.
// SADECE ÖNERİ sunar — hiçbir değeri otomatik kaydetmez/değiştirmez.
// ─────────────────────────────────────────────
function showKlasmanSureOnerisi(klasmanId) {
  const k = klasmanlar.find(x => x.id === klasmanId);
  const popup = document.getElementById('klasman-sure-onerisi-popup');
  const content = document.getElementById('klasman-sure-onerisi-content');
  const titleEl = document.getElementById('klasman-sure-onerisi-title');
  const subEl = document.getElementById('klasman-sure-onerisi-sub');
  if (!k || !popup || !content) return;

  titleEl.textContent = `📊 ${k.ad} — Süre Önerisi`;

  // _klAnalizTumListe, Klasman Analizi sayfasında zaten hesaplanan klasman bazlı
  // toplamları içerir (toplamAdet, toplamFiiliSure, toplamStandartSure...).
  // Excel hiç yüklenmediyse bu liste boş olur.
  const veri = (typeof _klAnalizTumListe !== 'undefined' ? _klAnalizTumListe : [])
    .find(x => x.ad === k.ad);

  if (!veri || !veri.toplamAdet || !veri.toplamFiiliSure) {
    subEl.textContent = 'Bu klasman için gerçekleşen veri bulunamadı';
    content.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--muted)">
        <div style="font-size:32px;margin-bottom:10px">📭</div>
        <div style="font-weight:600;margin-bottom:6px">Gerçekleşen veri yok</div>
        <div style="font-size:12px;line-height:1.6">
          Bu klasman için Performans Analizi sayfasında Excel yüklenmiş ve
          en az bir kayıt bu klasmana ait olmalı. Excel yükleyip tekrar deneyin.
        </div>
      </div>`;
    popup.style.display = 'flex';
    return;
  }

  // Gerçekleşen ortalama (adet başına, klasman geneli — toplam fiili / toplam adet)
  const gerceklesenAdetBasi = veri.toplamFiiliSure / veri.toplamAdet;
  const hedefAdetBasi = gerceklesenAdetBasi * 0.80; // %20 fark hedefi

  subEl.textContent = `Gerçekleşen ${gerceklesenAdetBasi.toFixed(2)}sn/adet → Hedef ${hedefAdetBasi.toFixed(2)}sn/adet (%20 zorlayıcı pay)`;

  // Mevcut değerler (referans için)
  const mevcutKontrol = parseFloat(k.urunKontrolSuresi) || 0;
  const mevcutOlcu = parseFloat(k.olcuSuresi) || 0;
  const mevcutKabul = parseFloat(k.urunKabulSuresi) || 0;
  const istasyonSuresi = k.istasyonlar.reduce((s, i) => s + (parseFloat(i.sure) || 0), 0);

  // Mevcut formülün adet başına diğer bileşenleri — ARTIK SABİT 32 ADET DEĞİL,
  // bu klasmanın GERÇEK kayıtlarından hesaplanan ortalama parti büyüklüğü kullanılır.
  // (Önceki sürümde sabit 32 varsayımı, partileri daha büyük olan klasmanlarda
  // Ölçü/Ürün Kabul katsayılarının gerçekte daha yüksek çıkmasına rağmen düşük
  // hesaplanmasına, dolayısıyla önerilen hedefin yanlışlıkla gerçekleşenden
  // daha "gevşek" çıkmasına yol açıyordu.)
  const adetListesi = veri.adetListesi || [];
  const refAdetHam = adetListesi.length
    ? Math.round(adetListesi.reduce((s, a) => s + a, 0) / adetListesi.length)
    : Math.round(veri.toplamAdet / Math.max(1, veri.kayitSayisi || 1)) || 32;
  // Güvenlik sınırı: gerçek bir partinin adedi makul aralıkta olmalı (1-2000).
  // adetListesi boş gelip kayitSayisi de yanlışlıkla çok düşükse (örn. eski/eksik
  // formatta yüklenmiş veri), refAdet'in mantıksız büyük çıkıp öneriyi
  // bozmasını engeller.
  const refAdet = Math.min(2000, Math.max(1, refAdetHam));

  function getOlcuAdetOneri(adet) {
    if (adet <= 32)  return 6;
    if (adet <= 50)  return 9;
    if (adet <= 80)  return 9;
    if (adet <= 125) return 9;
    return 12;
  }
  function getUrunKabulKatOneri(adet) {
    if (adet <= 32)  return 0.5;
    if (adet <= 80)  return 1.1;
    if (adet <= 125) return 1.2;
    return 1.3;
  }
  const olcuKat = getOlcuAdetOneri(refAdet);
  const kabulKat = getUrunKabulKatOneri(refAdet);

  // TEK ÖNERİ: Mevcut 3 bileşenin (1 Birim Muayene + Ölçü + Ürün Kabul) birbirine
  // oranı korunarak hepsi aynı katsayıyla küçültülür/büyütülür. Klasmanın mevcut
  // yapısını bozmadan, üç alanı da dolduran tek ve sağlam bir öneri sunar.
  //
  // ÖNEMLİ: "mevcut adet başına standart süre" burada TAHMİNİ bir formülle
  // (refAdet varsayımıyla) değil, klasmanın GERÇEK işlenmiş verisinden alınır:
  // veri.toplamStandartSure / veri.toplamAdet — bu, ekranda zaten "STANDART
  // (ADET BAŞI)" olarak gösterilen, her partinin kendi gerçek adediyle hesaplanmış
  // doğru değerdir. refAdet sadece klasmanın parti büyüklük profilini özetlemek
  // (ekranda göstermek) için kullanılır, asıl oran hesabını ETKİLEMEZ — böylece
  // adetListesi eksik/boş gelse veya refAdet yanlış tahmin edilse bile öneri
  // her zaman doğru ve tutarlı kalır.
  const mevcutToplamAdetBasi = veri.toplamStandartSure / veri.toplamAdet;

  // Eğer mevcut standart süre ZATEN hedeften (gerçekleşen × 0.80) düşükse,
  // klasman zaten yeterince zorlayıcı demektir (standart, gerçekleşenden daha
  // da düşük bir hedefi bile karşılıyor). Bu durumda oranKatsayi 1'i geçer ve
  // "öneri" aslında değerleri ARTIRIR — bu, zorlayıcı hedef isteğinin TAM TERSİ
  // bir etki olur. Bu yüzden oranKatsayi >= 1 ise hiçbir değişiklik önerilmez,
  // sadece klasmanın zaten hedefi karşıladığı bilgisi gösterilir.
  const oranKatsayi = mevcutToplamAdetBasi > 0 ? (hedefAdetBasi / mevcutToplamAdetBasi) : 0;
  const zatenYeterliZorlayici = mevcutToplamAdetBasi > 0 && oranKatsayi >= 1;

  let oneriKontrol, oneriOlcu, oneriKabul;
  if (zatenYeterliZorlayici) {
    // Mevcut değerleri olduğu gibi öner (değişiklik yok) — bilgilendirme amaçlı.
    oneriKontrol = mevcutKontrol;
    oneriOlcu = mevcutOlcu;
    oneriKabul = mevcutKabul;
  } else if (mevcutToplamAdetBasi > 0) {
    oneriKontrol = Math.max(0, mevcutKontrol * oranKatsayi);
    oneriOlcu = Math.max(0, mevcutOlcu * oranKatsayi);
    oneriKabul = Math.max(0, mevcutKabul * oranKatsayi);
  } else {
    // Mevcut 3 değer de sıfırsa (klasman hiç doldurulmamışsa) oranlama mümkün
    // değildir; bu özel durumda hedefin tamamı Kontrol Süresi'ne atanır.
    oneriKontrol = Math.max(0, hedefAdetBasi - (istasyonSuresi / refAdet));
    oneriOlcu = 0;
    oneriKabul = 0;
  }

  const oneriHtml = zatenYeterliZorlayici ? `
    <div style="border:1.5px solid #1565C033;border-radius:10px;padding:16px;margin-bottom:8px;background:linear-gradient(135deg,#1565C00D,transparent)">
      <div style="font-weight:700;font-size:13.5px;color:#1565C0;margin-bottom:4px">✅ Bu klasman zaten yeterince zorlayıcı</div>
      <div style="font-size:12px;color:var(--navy);line-height:1.6">
        Mevcut standart süre (<strong>${mevcutToplamAdetBasi.toFixed(2)}sn/adet</strong>), hedeflenen
        <strong>${hedefAdetBasi.toFixed(2)}sn/adet</strong>'den zaten daha düşük — yani klasman gerçekleşen
        süreyi istediğinizden de fazla zorluyor. Değerleri büyütmek bu zorlayıcılığı azaltacağından
        herhangi bir değişiklik önerilmiyor; mevcut 3 değeri olduğu gibi bırakabilirsiniz.
      </div>
    </div>` : `
    <div style="border:1.5px solid #00897B33;border-radius:10px;padding:16px;margin-bottom:8px;background:linear-gradient(135deg,#00897B0D,transparent)">
      <div style="font-weight:700;font-size:13.5px;color:#00897B;margin-bottom:4px">✓ Önerilen Süreler</div>
      <div style="font-size:11.5px;color:var(--muted2);margin-bottom:12px;line-height:1.5">Mevcut 3 değerin birbirine oranı korunarak hedefe göre ölçeklendi. Klasmanın mevcut yapısı bozulmuyor, sadece tüm değerler aynı oranda küçültülüyor.</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <div style="background:#fff;border:1px solid var(--border2);border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:9.5px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">1 Birim Muayene</div>
          <div style="font-size:19px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace">${oneriKontrol.toFixed(1)}<span style="font-size:11px;color:var(--muted2)">sn</span></div>
        </div>
        <div style="background:#fff;border:1px solid var(--border2);border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:9.5px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Ölçü Süresi</div>
          <div style="font-size:19px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace">${oneriOlcu.toFixed(1)}<span style="font-size:11px;color:var(--muted2)">sn</span></div>
        </div>
        <div style="background:#fff;border:1px solid var(--border2);border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:9.5px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Ürün Kabul</div>
          <div style="font-size:19px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace">${oneriKabul.toFixed(1)}<span style="font-size:11px;color:var(--muted2)">sn</span></div>
        </div>
      </div>
      <button onclick="applyKlasmanSureOnerisi(${k.id}, ${oneriKontrol.toFixed(1)}, ${oneriOlcu.toFixed(1)}, ${oneriKabul.toFixed(1)})"
        style="width:100%;margin-top:12px;padding:9px;border-radius:8px;border:none;background:#00897B;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">
        ✓ Bu Öneriyi Uygula
      </button>
    </div>`;

  content.innerHTML = `
    <div style="background:var(--lblue3);border:1px solid var(--border2);border-radius:9px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:var(--navy);line-height:1.7">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:var(--muted)">Gerçekleşen (adet başı, ortalama)</span>
        <strong style="font-family:'DM Mono',monospace">${gerceklesenAdetBasi.toFixed(2)} sn</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:var(--muted)">Hedef (%20 zorlayıcı pay ile, = gerçekleşen × 0.80)</span>
        <strong style="font-family:'DM Mono',monospace;color:#5E35B1">${hedefAdetBasi.toFixed(2)} sn</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted2)">
        <span>Veri kaynağı</span>
        <span>${formatTR(veri.toplamAdet)} adet · ${veri.inspectorSayisi || 0} inspector</span>
      </div>
    </div>

    ${oneriHtml}

    <div style="font-size:10px;color:var(--muted2);margin-top:4px;line-height:1.6">
      💡 Öneri, bu klasmanın <strong>gerçek kayıtlarından hesaplanan ortalama parti büyüklüğü (${refAdet} adet)</strong> referans alınarak hesaplanmıştır. Tek tek partilerin büyüklüğü farklılık gösterebileceğinden, uyguladıktan sonra "Hesaplamayı Göster" ile gerçek toplam oranı kontrol edip gerekirse elle ince ayar yapın.
    </div>
  `;

  popup.style.display = 'flex';
}

// Öneriyi tek tıkla 3 input alanına uygular (kaydetmez — input'lara yazar,
// mevcut onchange="updateX(...)" mantığı zaten devreye girer).
function applyKlasmanSureOnerisi(klasmanId, kontrol, olcu, kabul) {
  // Not: her updateX() çağrısı kendi içinde renderEditor() tetikleyip DOM'u
  // yeniden oluşturduğundan, DOM elementine önceden referans tutmak yerine
  // doğrudan veri katmanını (klasmanlar dizisini) güncelleyen fonksiyonları
  // sırayla çağırıyoruz — her biri zaten klasmanlar dizisine yazıp kaydeder.
  updateUrunKontrol(klasmanId, kontrol);
  updateOlcuSuresi(klasmanId, olcu);
  updateUrunKabulSuresi(klasmanId, kabul);

  document.getElementById('klasman-sure-onerisi-popup').style.display = 'none';
  showFileStatus('✅ Süre önerisi uygulandı — istediğiniz gibi elle ince ayar yapabilirsiniz.', 'var(--green)');
}

function showPerfSeviyeDetay(seviyeKey) {
  const tanim = PERF_SEVIYE_TANIM[seviyeKey];
  const popup = document.getElementById('perf-seviye-popup');
  const content = document.getElementById('perf-seviye-popup-content');
  const titleEl = document.getElementById('perf-seviye-popup-title');
  const subEl = document.getElementById('perf-seviye-popup-sub');
  if (!tanim || !popup || !content) return;

  if (titleEl) titleEl.textContent = `${tanim.icon} ${tanim.label} — Inspector Listesi`;

  if (!performansData || !performansData.length) {
    content.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted)">Henüz performans verisi yok</div>`;
    popup.style.display = 'flex';
    return;
  }

  // Bu seviyeye giren inspectorleri filtrele (getDispPerf: verimlilikPerf varsa onu, yoksa genelHizPerf'i kullanır)
  const liste = performansData
    .filter(i => {
      const p = getDispPerf(i);
      return p >= tanim.min && p < tanim.max;
    })
    .sort((a, b) => getDispPerf(b) - getDispPerf(a));

  if (subEl) subEl.textContent = `${liste.length} inspector bu seviyede`;

  if (!liste.length) {
    content.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted)">Bu seviyede inspector bulunamadı</div>`;
    popup.style.display = 'flex';
    return;
  }

  const rows = liste.map(insp => {
    const perf = getDispPerf(insp);
    const perfColor = getProgressColor(perf);
    const otDk = Math.round((insp.toplamMesaistiSaniye || 0) / 60);
    const otHtml = otDk > 0
      ? `<span style="color:#E65100;font-weight:600">🌙 ${otDk}dk</span>`
      : `<span style="color:var(--muted2)">—</span>`;
    return `
      <tr style="border-bottom:1px solid var(--border2)">
        <td style="padding:9px 10px;font-weight:600;color:var(--navy);cursor:pointer" onclick="document.getElementById('perf-seviye-popup').style.display='none'; showInspectorDetail('${insp.ins.replace(/'/g, "\\'")}')">${_escapeHtml(_formatDisplayName(insp.ins))}</td>
        <td style="padding:9px 10px;text-align:center;font-family:'DM Mono',monospace;color:var(--navy)">${insp.gunSayisi || 0} gün${azVeriMi(insp.gunSayisi) ? '<br>' + azVeriRozetiHtml('badge') : ''}</td>
        <td style="padding:9px 10px;text-align:center;font-family:'DM Mono',monospace;color:var(--navy)">${formatTR((insp.adet || 0))}</td>
        <td style="padding:9px 10px;text-align:center">${otHtml}</td>
        <td style="padding:9px 10px;text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:${perfColor}">${perf}%</td>
      </tr>`;
  }).join('');

  const toplamAdet = liste.reduce((s, i) => s + (i.adet || 0), 0);
  const ortGun = Math.round(liste.reduce((s, i) => s + (i.gunSayisi || 0), 0) / liste.length);
  const ortPerf = Math.round(liste.reduce((s, i) => s + getDispPerf(i), 0) / liste.length);

  content.innerHTML = `
    <div style="max-height:50vh;overflow-y:auto;border:1px solid var(--border2);border-radius:10px">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead style="position:sticky;top:0;background:var(--navy);color:#fff;z-index:1">
          <tr>
            <th style="padding:9px 10px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px">Inspector</th>
            <th style="padding:9px 10px;text-align:center;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px">Çalışma Günü</th>
            <th style="padding:9px 10px;text-align:center;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px">Toplam Ürün</th>
            <th style="padding:9px 10px;text-align:center;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px">Overtime</th>
            <th style="padding:9px 10px;text-align:center;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px">Performans</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:14px;padding-top:12px;border-top:2px solid var(--border2);font-size:12px">
      <span style="color:var(--muted)">Toplam <strong style="color:var(--navy)">${liste.length}</strong> inspector</span>
      <span style="color:var(--muted)">Toplam Ürün: <strong style="color:var(--navy);font-family:'DM Mono',monospace">${formatTR(toplamAdet)}</strong></span>
      <span style="color:var(--muted)">Ort. Çalışma Günü: <strong style="color:var(--navy);font-family:'DM Mono',monospace">${ortGun} gün</strong></span>
      <span style="color:var(--muted)">Ort. Performans: <strong style="color:${tanim.color};font-family:'DM Mono',monospace">${ortPerf}%</strong></span>
    </div>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px">💡 Bir inspector adına tıklayarak detaylı analizini açabilirsiniz.</div>
  `;

  popup.style.display = 'flex';
}

function on2KaliteDahilChange() {
  const checkbox = document.getElementById('inp-2kalite-dahil');
  _2KaliteDahil = !!(checkbox && checkbox.checked);

  // Excel verisi (ham satırlar) elimizdeyse en güvenilir yol: sıfırdan yeniden hesapla.
  // Bu, is2Kalite ayrımının her aşamada (klasman toplamları, overtime, vb.) doğru
  // uygulanmasını garanti eder — performansData üzerinde parça parça düzeltme
  // yapmak yerine performansHesapla() tüm zinciri baştan, tutarlı şekilde kurar.
  if (typeof excelRows !== 'undefined' && excelRows && excelRows.length > 0) {
    performansHesapla();
    return;
  }

  // Excel verisi yoksa (örn. localStorage'dan/Sheets'ten yüklenmiş performansData
  // var ama ham Excel satırları yok) yeniden hesaplama mümkün değil — kullanıcıyı
  // bilgilendir ve checkbox'ı eski haline döndür.
  if (performansData && performansData.length > 0) {
    showFileStatus('⚠️ Bu ayarın uygulanabilmesi için Excel dosyasını tekrar yükleyin (ham veri gerekiyor).', 'var(--amber)');
  }
}

function onOvertimeDahilChange() {
  const checkbox = document.getElementById('inp-overtime-dahil');
  _overtimeDahil = !!(checkbox && checkbox.checked);

  // Excel verisi varsa sıfırdan yeniden hesapla (en güvenilir yol)
  if (typeof excelRows !== 'undefined' && excelRows && excelRows.length > 0) {
    performansHesapla();
    return;
  }

  // Excel verisi yoksa performansData üzerinde anlık güncelle
  if (performansData && performansData.length > 0) {
    performansData.forEach(row => {
      const normalMesai = row.mesaiSure - (row.overtimeMesaiSure || 0);
      const standart  = _overtimeDahil
        ? row.standartSure
        : (row.standartSureNormal > 0 ? row.standartSureNormal : row.standartSure);
      const payda = _overtimeDahil
        ? row.mesaiSure
        : (normalMesai > 0 ? normalMesai : row.mesaiSure);
      row.genelHizPerf = payda > 0 ? Math.round((standart / payda) * 100) : row.genelHizPerf;
      row.genelPerformans = row.genelHizPerf;
      const hedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
      row.verimlilikPerf = row.genelHizPerf !== null ? Math.round(row.genelHizPerf * (100 / hedef)) : null;
    });
    renderDashboard();
    renderPerfTabloFromData(1);
    updateSidebar();
  } else {
    showFileStatus('⚠️ Bu ayarın uygulanabilmesi için Excel dosyasını yükleyin.', 'var(--amber)');
  }
}

function onHedefChange() {
  // Veri varsa tablo + kartları yeniden çiz; yoksa sadece tabloyu yenile
  if (performansData && performansData.length > 0) {
    // verimlilikPerf ve hedefVerimlilik değerlerini güncelle
    const hedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
    performansData.forEach(row => {
      row.hedefVerimlilik = hedef;  // ← gelecekteki push'larda doğru gitsin
      row.verimlilikPerf = row.genelHizPerf !== null && row.genelHizPerf !== undefined
        ? Math.round(row.genelHizPerf * (100 / hedef))
        : null;
    });
    renderDashboard();
    renderPerfTabloFromData();
    updateSidebar();
    // NOT: Otomatik Sheets push kaldırıldı — artık sadece "Sheets'e Gönder"
    // butonuna basıldığında gönderilir (bkz. manualPushPerformansToSheets).
    markPerformansUnsynced();
  }
  // Tabloda da güncelle (Excel yüklüyse)
  if (excelRows && excelRows.length > 0) performansHesapla();
}

// ────────────────────────────
// DASHBOARD
// ────────────────────────────
function renderDashboard() {
  if (!performansData.length) {
    const _t0 = translations[currentLang]||translations.tr;
    document.getElementById('inspector-grid').innerHTML = `
      <div class="empty">
        <div class="empty-icon">📊</div>
        <h3>${_t0.no_perf_data}</h3>
        <p>${_t0.no_perf_data_hint}</p>
      </div>
    `;
    document.getElementById('dashboard-pagination').style.display = 'none';
    updateSummaryStats([]);
    renderTeamSection();
    renderTeamManagersSection();
    return;
  }

  const hedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
  const inspectors = performansData.map(inspector => ({
    ...inspector,
    performans: inspector.verimlilikPerf !== null && inspector.verimlilikPerf !== undefined
      ? inspector.verimlilikPerf
      : (inspector.genelHizPerf !== null && inspector.genelHizPerf !== undefined
          ? Math.round((inspector.genelHizPerf) * (100 / hedef))
          : 0)
  }));

  filteredInspectors = inspectors;
  updateKlasmanFilter();
  filterInspectors();
  updateSummaryStats(inspectors);
  renderTeamSection();
  renderTeamManagersSection();
}

function updateKlasmanFilter() {
  const klasmanSet = new Set();
  // performansData'daki klasmanlardan
  performansData.forEach(inspector => {
    Object.keys(inspector.klasmanlar || {}).forEach(k => klasmanSet.add(k));
  });
  // Sheets'ten çekilen klasmanlar dizisinden (performansData boş olsa bile dolar)
  klasmanlar.forEach(k => { if (k.ad) klasmanSet.add(k.ad); });

  const select = document.getElementById('klasman-filter');
  const prev = select.value;
  select.innerHTML = `<option value="">${(translations[currentLang]||translations.tr).filter_all_klasman}</option>`;
  Array.from(klasmanSet).sort().forEach(k => {
    select.innerHTML += `<option value="${k}"${k === prev ? ' selected' : ''}>${k}</option>`;
  });
}

function filterInspectors() {
  const perfFilter = document.getElementById('perf-filter').value;
  const klasmanFilter = document.getElementById('klasman-filter').value;
  const searchTerm = document.getElementById('inspector-search').value.toLowerCase();
  const sortOrder = document.getElementById('sort-order').value;

  const hedefF = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
  let filtered = [...performansData.map(inspector => {
    // "Ne ödül ne ceza": nötr sebeplerden kaynaklanan kayıp zaman mesai
    // süresinden düşülüp performans buna göre yeniden hesaplanır — bkz.
    // renderDashboard kart hesabı ve getDispPerf ile aynı mantık, böylece
    // üstteki özet sayaçlar (Mükemmel/İyi/Orta/Zayıf) ve filtre/sıralama
    // kartlarla tutarlı kalır.
    const standartSnF = inspector.standartSure || 0;
    let mesaiSnF = inspector.mesaiSure || 0;
    const notrKayipSnF = getNotrKayipDakikaForInspector(inspector.ins) * 60;
    if (notrKayipSnF > 0 && mesaiSnF > notrKayipSnF) mesaiSnF -= notrKayipSnF;
    const hamPerfF = (standartSnF > 0 && mesaiSnF > 0)
      ? Math.round((standartSnF / mesaiSnF) * 100)
      : inspector.genelHizPerf;
    return {
      ...inspector,
      performans: hamPerfF !== null && hamPerfF !== undefined
        ? Math.round(hamPerfF * (100 / hedefF))
        : 0
    };
  })];

  if (perfFilter) {
    filtered = filtered.filter(inspector => {
      switch(perfFilter) {
        case 'excellent': return inspector.performans >= 95;
        case 'good': return inspector.performans >= 85 && inspector.performans < 95;
        case 'average': return inspector.performans >= 70 && inspector.performans < 85;
        case 'poor': return inspector.performans >= 50 && inspector.performans < 70;
        case 'verypoor': return inspector.performans < 50;
        default: return true;
      }
    });
  }

  if (klasmanFilter) {
    filtered = filtered.filter(inspector => 
      Object.keys(inspector.klasmanlar).includes(klasmanFilter)
    );
  }

  if (searchTerm) {
    filtered = filtered.filter(inspector => 
      inspector.ins.toLowerCase().includes(searchTerm)
    );
  }

  // "Sadece Ekibim" filtresi — sadece ekip yöneticisi (admin olmayan) kullanıcılar için
  const teamOnlyEl = document.getElementById('team-only-filter');
  if (teamOnlyEl && teamOnlyEl.checked && currentUser && !currentUser.isAdmin) {
    const teamSet = new Set((currentUser.team || []).map(n => n.toLowerCase()));
    filtered = filtered.filter(inspector => teamSet.has((inspector.ins || '').toLowerCase()));
  }

  switch(sortOrder) {
    case 'perf-desc':
      // Az veri (10 günden az) olan inspector'lar performansı ne kadar yüksek
      // olursa olsun, yeterli veriye sahip olanların ÖNÜNE geçemez — az veri
      // her zaman sona atılır, aralarında ise normal performans sıralaması geçerli.
      filtered.sort((a, b) => {
        const aAz = azVeriMi(a.gunSayisi), bAz = azVeriMi(b.gunSayisi);
        if (aAz !== bAz) return aAz ? 1 : -1;
        return b.performans - a.performans;
      });
      break;
    case 'perf-asc':
      filtered.sort((a, b) => {
        const aAz = azVeriMi(a.gunSayisi), bAz = azVeriMi(b.gunSayisi);
        if (aAz !== bAz) return aAz ? 1 : -1;
        return a.performans - b.performans;
      });
      break;
    case 'name-asc':
      filtered.sort((a, b) => a.ins.localeCompare(b.ins));
      break;
    case 'name-desc':
      filtered.sort((a, b) => b.ins.localeCompare(a.ins));
      break;
    case 'adet-desc':
      filtered.sort((a, b) => b.adet - a.adet);
      break;
    case 'adet-asc':
      filtered.sort((a, b) => a.adet - b.adet);
      break;
  }

  filteredInspectors = filtered;
  currentDashboardPage = 1;
  renderInspectorCards();
}

function renderInspectorCards() {
  const grid = document.getElementById('inspector-grid');
  const pagination = document.getElementById('dashboard-pagination');
  
  if (!filteredInspectors.length) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <h3 data-i18n="filter_no_result">Filtre sonucu bulunamadı</h3>
        <p data-i18n="filter_no_result_hint">Filtre kriterlerini değiştirmeyi deneyin</p>
      </div>
    `;
    applyI18nToNewNodes(grid);
    pagination.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(filteredInspectors.length / DASHBOARD_PER_PAGE);
  const startIndex = (currentDashboardPage - 1) * DASHBOARD_PER_PAGE;
  const endIndex = startIndex + DASHBOARD_PER_PAGE;
  const currentPageInspectors = filteredInspectors.slice(startIndex, endIndex);

  // Hedef verimlilik değerini oku
  const currentHedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);

  const cards = currentPageInspectors.map(inspector => {
    // Düz. Performans = Ham Performans × (100 / Hedef%) — kartlarda bu gösterilir.
    // "Ne ödül ne ceza" ilkesi: nötr sebeplerden (Ürün Olmaması, Insp. Lokasyon
    // Değişimi, Diğer) kaynaklanan kayıp zaman, mesai süresinden (paydadan)
    // düşülüp performans BUNA GÖRE yeniden hesaplanır — bkz. getDispPerf/
    // getNotrKayipDakikaForInspector. Burada AYRICA (getDispPerf çağırmak
    // yerine) hesaplanmasının sebebi: bu kart canlı Hedef Verimlilik input
    // değerini (currentHedef) kullanıyor, inspector.hedefVerimlilik'teki
    // (son hesaplamadan kalma, potansiyel olarak eski) değeri değil.
    const hamPerf = inspector.genelHizPerf;
    const standartSnKart = inspector.standartSure || 0;
    let mesaiSnKart = inspector.mesaiSure || 0;
    const notrKayipSnKart = getNotrKayipDakikaForInspector(inspector.ins) * 60;
    if (notrKayipSnKart > 0 && mesaiSnKart > notrKayipSnKart) mesaiSnKart -= notrKayipSnKart;
    const hamPerfDuzeltilmis = (standartSnKart > 0 && mesaiSnKart > 0)
      ? Math.round((standartSnKart / mesaiSnKart) * 100)
      : hamPerf;
    const duzPerf = hamPerfDuzeltilmis !== null && hamPerfDuzeltilmis !== undefined
      ? Math.round(hamPerfDuzeltilmis * (100 / currentHedef))
      : null;
    const performansVal = duzPerf ?? 0;
    const performansClass = getPerformanceClass(performansVal);
    const performansText = duzPerf !== null ? duzPerf + '%' : '—';
    const progressAngle = Math.min(360, (performansVal / 100) * 360);
    const progressColor = getProgressColor(performansVal);
    
    const ini = inspector.ins.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    const klasmanCount = Object.keys(inspector.klasmanlar).length;

    // Kayip zaman rozeti - performans degismez, sadece not. Simetri bozulmasin diye veri yoksa da gösterilir.
    const kayipDkCard = getKayipDakikaForInspector(inspector.ins);
    const _safeIns = inspector.ins.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const kayipRozetHtml = kayipDkCard > 0
      ? `<div onclick="showKayipDetayPopup('${_safeIns}')" style="display:inline-flex;align-items:center;gap:3px;background:#FFF3E0;color:#E65100;border:1px solid #FFCC80;border-radius:5px;padding:2px 7px;font-size:9px;font-weight:700;margin-top:4px;line-height:1.4;cursor:pointer;transition:background .15s" onmouseover="this.style.background='#FFE0B2'" onmouseout="this.style.background='#FFF3E0'" title="Detay için tıklayın">
           &#9208; ${(kayipDkCard/60).toFixed(1)}s değerlendirme dışı &#9432;
         </div>`
      : `<div style="display:inline-flex;align-items:center;gap:3px;background:#F4F6F8;color:var(--muted2);border:1px solid var(--border);border-radius:5px;padding:2px 7px;font-size:9px;font-weight:600;margin-top:4px;line-height:1.4;">
           &#9208; Değerlendirme dışı yok
         </div>`;

    const performansAciklama = (() => {
      if (performansVal === null || performansVal === undefined) {
        return (translations[currentLang]||translations.tr).no_overtime_data;
      }
      const gunSayisi = inspector.gunSayisi || 0;
      const mesaiSaat = Math.round((inspector.mesaiSure || 0) / 3600);
      const overtimeDk = Math.round((inspector.toplamMesaistiSaniye || 0) / 60);
      const overtimeStr = overtimeDk > 0 ? ` · 🌙 ${overtimeDk}dk ${(translations[currentLang]||translations.tr).overtime_over}` : '';
      return `${gunSayisi} ${(translations[currentLang]||translations.tr).days_x_formula.replace('{h}', mesaiSaat)}${overtimeStr}`;
    })();

    const performansSeviyesi = getPerformanceLevelLabel(performansVal);

    const klasmanRowsHtml = Object.entries(inspector.klasmanlar).map(([klasman, data]) => {
      const hizPerf = (data.hizPerf !== null && data.hizPerf !== undefined) ? data.hizPerf : null;
      const hizText = hizPerf !== null ? hizPerf + '%' : '—';
      const hizClass = hizPerf !== null ? getPerformanceClass(hizPerf) : '';
      return `<div class="klasman-item">
        <span class="klasman-name">${klasman} (${data.adet} ${(translations[currentLang]||translations.tr).units_short})</span>
        <span class="${hizClass}" style="font-size:10px;font-weight:600">${hizText}</span>
      </div>`;
    }).join('');

    const gunDetayi = inspector.gunlukDetay && inspector.gunlukDetay.length > 0 
      ? inspector.gunlukDetay.slice(0, 3).map(gun => {
          const tarih = new Date(gun);
          return `${tarih.getDate()}/${tarih.getMonth() + 1}`;
        }).join(', ') + (inspector.gunlukDetay.length > 3 ? '...' : '')
      : '—';

    return `
      <div class="inspector-card ${performansClass}">
        <!-- Header -->
        <div class="inspector-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="avatar">${ini}</div>
            <div>
              <div class="inspector-name">${inspector.ins}</div>
              ${kayipRozetHtml}
              <div style="font-size:10px;color:var(--muted2);margin-top:2px">
                ${inspector.gunSayisi || 0} ${(translations[currentLang]||translations.tr).days_suffix} ${(translations[currentLang]||translations.tr).working} · ${gunDetayi}
              </div>
            </div>
          </div>
          <div style="text-align:center">
            <div style="position:relative;display:inline-block">
              <div class="circular-progress" style="--progress-angle: ${progressAngle}deg; --progress-color: ${progressColor};">
                <div class="circular-progress-text ${performansClass}">${performansText}</div>
              </div>
              ${currentHedef !== 100 ? `<div style="position:absolute;top:-6px;right:-6px;background:var(--amber);color:#fff;font-size:8px;font-weight:700;padding:2px 5px;border-radius:8px;line-height:1.2">H%${currentHedef}</div>` : ''}
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase" data-i18n="adj_perf_label">Düz. Performans</div>
            <div style="font-size:9px;color:${progressColor};font-weight:600;margin-top:1px">${performansSeviyesi}</div>
          </div>
        </div>

        <!-- Ana İstatistikler -->
        <div class="inspector-stats">
          <div class="inspector-stat">
            <div class="inspector-stat-value">${formatTR(inspector.adet)}</div>
            <div class="inspector-stat-label" data-i18n="total_qty">Toplam Adet</div>
          </div>
          <div class="inspector-stat">
            <div class="inspector-stat-value">${formatTR(inspector.kayit)}</div>
            <div class="inspector-stat-label" data-i18n="record_count">Kayıt Sayısı</div>
          </div>
        </div>

        <!-- Süre İstatistikleri -->
        <div class="inspector-stats">
          <div class="inspector-stat">
            <div class="inspector-stat-value">${fmtSnKisa(inspector.standartSure||0)}</div>
            <div class="inspector-stat-label" data-i18n="std_duration">Standart Süre</div>
          </div>
          <div class="inspector-stat">
            <div class="inspector-stat-value">${fmtSnKisa(inspector.mesaiSure||0)}</div>
            <div class="inspector-stat-label"><span data-i18n="overtime_duration">Mesai Süresi</span>${
              inspector.toplamMesaistiSaniye > 0
                ? `<br><span style="color:#E65100;font-size:9px;font-weight:700">🌙 +${Math.round(inspector.toplamMesaistiSaniye/60)}dk <span data-i18n="overtime_over">mesai üstü</span></span>`
                : ''
            }</div>
          </div>
        </div>

        <!-- Performans Detay Kutusu -->
        <div style="padding:14px;background:linear-gradient(135deg,var(--lblue3) 0%,#fff 100%);border-radius:10px;border:1px solid var(--border);margin:12px 0;position:relative;overflow:hidden">
          <div style="font-size:10px;color:var(--muted2);margin-bottom:4px;text-align:center">
            ${performansAciklama}
          </div>
          ${inspector.overtimePerformans !== null && inspector.overtimePerformans !== undefined
            ? `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;padding:5px 10px;background:rgba(230,81,0,.08);border-radius:7px">
                <span style="font-size:11px;color:#E65100">⏱ Overtime:</span>
                <span style="font-size:13px;font-weight:700;color:#E65100">${inspector.overtimePerformans}%</span>
                <span style="font-size:9px;color:var(--muted2)">(${Math.round((inspector.overtimeMesaiSure||0)/60)}dk ek mesaide)</span>
              </div>`
            : `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;padding:5px 10px;background:rgba(0,0,0,.03);border-radius:7px">
                <span style="font-size:11px;color:var(--muted2)">⏱ Overtime Yok</span>
              </div>`}
          ${_2KaliteDahil ? '' : (inspector.toplam2KaliteAdet > 0
            ? `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;padding:5px 10px;background:rgba(124,58,237,.08);border-radius:7px">
                <span style="font-size:11px;color:#7C3AED">🏷️ 2.Kalite kontrolü:</span>
                <span style="font-size:13px;font-weight:700;color:#7C3AED">${formatTR(inspector.toplam2KaliteAdet)} adet</span>
                ${inspector.perf2Kalite !== null && inspector.perf2Kalite !== undefined
                  ? `<span style="font-size:13px;font-weight:700;color:#7C3AED">· ${inspector.perf2Kalite}%</span>`
                  : ''}
              </div>`
            : `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;padding:5px 10px;background:rgba(0,0,0,.03);border-radius:7px">
                <span style="font-size:11px;color:var(--muted2)">🏷️ 2.Kalite kontrolü yok</span>
              </div>`)}
          ${(() => {
            const ti = getTeknikIncelemeSkorForInspector(inspector.ins);
            if (!ti || ti.count === 0) {
              return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;padding:5px 10px;background:rgba(0,0,0,.03);border-radius:7px">
                <span style="font-size:11px;color:var(--muted2)">🧪 Teknik İnceleme Skoru yok</span>
              </div>`;
            }
            const tiColor = getProgressColor(ti.percent);
            return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;padding:5px 10px;background:rgba(69,39,160,.08);border-radius:7px">
                <span style="font-size:11px;color:#4527A0">🧪 Teknik İnceleme Skoru:</span>
                <span style="font-size:13px;font-weight:700;color:${tiColor}">${ti.percent}%</span>
                <span style="font-size:9px;color:var(--muted2)">(${ti.seviye})</span>
              </div>`;
          })()}
          <div style="text-align:center">
            <span style="font-size:11px;color:var(--muted2)">📊 </span>
            <span style="font-size:12px;font-weight:600;color:var(--navy)">${klasmanCount} ${(translations[currentLang]||translations.tr).klasman_word}</span>
            <span style="color:var(--border);margin:0 6px"> • </span>
            <span style="font-size:11px;color:var(--muted2)">
              <span data-i18n="efficiency_label">efficiency</span> &nbsp;•&nbsp;
              <span style="color:var(--blue);font-weight:600">%100+</span> = <span data-i18n="above_target">above target</span> &nbsp;•&nbsp;
              <span style="color:var(--amber);font-weight:600">%100-</span> = <span data-i18n="below_target">below target</span>
            </span>
          </div>
        </div>

        <!-- Klasman Detayları -->
        <div class="klasman-breakdown">
          <div class="klasman-summary" onclick="toggleKlasmanDetails(this)">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:10px;color:var(--muted2)" data-i18n="klasman_details">📋 Classification Details</span>
              <span style="font-size:8px;color:var(--muted2);background:var(--lblue2);padding:1px 6px;border-radius:10px">${klasmanCount} ${(translations[currentLang]||translations.tr).units_short}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px">
              <span class="toggle-text" style="font-size:10px;color:var(--blue);font-weight:600" data-i18n="see_details">See Details</span>
              <span class="toggle-icon" style="font-size:12px">👁️</span>
            </div>
          </div>
          <div class="klasman-details">
            ${klasmanRowsHtml}
          </div>
        </div>

        <!-- Alt Butonlar -->
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onclick="showInspectorDetail('${inspector.ins.replace(/'/g, "\\'")}'); event.stopPropagation();" 
                  style="flex:1;padding:8px;background:var(--blue);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-weight:500">
            📊 ${(translations[currentLang]||translations.tr).detailed_analysis}
          </button>
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = cards;

  // data-i18n attribute'larını yeni oluşan DOM'a uygula
  applyI18nToNewNodes(grid);

  if (totalPages > 1) {
    pagination.style.display = 'flex';
    document.getElementById('dash-page-info').textContent = `${currentDashboardPage} / ${totalPages}`;
    document.getElementById('dash-btn-prev').disabled = currentDashboardPage <= 1;
    document.getElementById('dash-btn-next').disabled = currentDashboardPage >= totalPages;

    // Sayfa numarası butonlarını oluştur
    const pageNumsEl = document.getElementById('dash-page-numbers');
    if (pageNumsEl) {
      // Hangi sayfa numaralarını göstereceğimizi hesapla (max 7 buton)
      let pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (currentDashboardPage > 3) pages.push('...');
        for (let i = Math.max(2, currentDashboardPage - 1); i <= Math.min(totalPages - 1, currentDashboardPage + 1); i++) pages.push(i);
        if (currentDashboardPage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
      }

      pageNumsEl.innerHTML = pages.map(p => {
        if (p === '...') {
          return `<span style="padding:0 4px;color:var(--muted);font-size:12px;line-height:30px">…</span>`;
        }
        const isActive = p === currentDashboardPage;
        return `<button onclick="goToDashboardPage(${p})" style="
          min-width:30px;height:30px;border-radius:6px;border:1px solid ${isActive ? 'var(--blue2)' : 'var(--border2)'};
          background:${isActive ? 'var(--blue2)' : '#fff'};
          color:${isActive ? '#fff' : 'var(--navy)'};
          font-size:12px;font-weight:${isActive ? '700' : '500'};
          cursor:pointer;padding:0 6px;transition:all .15s;font-family:'DM Sans',sans-serif;
        ">${p}</button>`;
      }).join('');
    }
  } else {
    pagination.style.display = 'none';
  }
}

function changeDashboardPage(direction) {
  const totalPages = Math.ceil(filteredInspectors.length / DASHBOARD_PER_PAGE);
  currentDashboardPage = Math.max(1, Math.min(totalPages, currentDashboardPage + direction));
  renderInspectorCards();
  document.getElementById('inspector-grid').scrollIntoView({ behavior: 'smooth' });
}

function goToDashboardPage(page) {
  const totalPages = Math.ceil(filteredInspectors.length / DASHBOARD_PER_PAGE);
  currentDashboardPage = Math.max(1, Math.min(totalPages, page));
  renderInspectorCards();
  document.getElementById('inspector-grid').scrollIntoView({ behavior: 'smooth' });
}

function toggleKlasmanDetails(element) {
  const details = element.nextElementSibling;
  details.classList.toggle('show');
  
  const toggleIcon = element.querySelector('.toggle-icon');
  const toggleText = element.querySelector('.toggle-text');
  
  if (details.classList.contains('show')) {
    toggleIcon.textContent = '👁️';
    toggleText.textContent = (translations[currentLang]||translations.tr).hide_label;
    element.style.borderRadius = '8px 8px 0 0';
  } else {
    toggleIcon.textContent = '👁️';
    toggleText.textContent = (translations[currentLang]||translations.tr).see_details;
    element.style.borderRadius = '8px';
  }
}

// ────────────────────────────
// INSPECTOR DETAY MODAL
// ────────────────────────────
function showInspectorDetail(inspectorName) {
  const inspector = performansData.find(i => i.ins === inspectorName);
  if (!inspector) return;
  selectedInspectorDetail = inspector;

  document.getElementById('detail-modal-title').textContent = `${inspector.ins} — ${(translations[currentLang]||translations.tr).detailed_perf}`;

  // ── ANINDA AÇ: mevcut veriyle overlay'i hemen göster ──
  const _aoHedefValNow = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
  
  // tumKayitlar'ı şimdiki veriyle hemen hesapla (aşağıda da yeniden hesaplanır)
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
          talepNo: k.talepNo || '',
          inspectionTipi: k.inspectionTipi || ''
        });
      });
    });
    return list;
  };

  // Overlay'i mevcut veriyle anında aç
  openAnalizOverlay(buildTumKayitlar(inspector), inspector, _aoHedefValNow);

  // ── ARKA PLAN: Sheets'ten veri çek, gelince tabloyu güncelle ──
  // ÖNEMLİ (v10.1): Performans verisi artık otomatik Sheets'e gönderilmiyor
  // (sadece "📤 Sheets'e Gönder" butonuna basıldığında). Bu yüzden, eğer
  // bellekte Excel'den taze hesaplanmış ama henüz gönderilmemiş ("unsynced")
  // veri varsa, Sheets'ten çekilen eski veriyle ÜZERİNE YAZILMAZ — aksi
  // halde doğru hesaplanan adet/standart süre gibi değerler eski sheet
  // verisiyle değişebilir (örnekleme modu hatası buradan kaynaklanıyordu).
  const perfPushBtn = document.getElementById('perf-push-btn');
  const isUnsynced = perfPushBtn && perfPushBtn.dataset.unsynced === '1';

  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (url && token && !isUnsynced) {
      // Loading göstergesi tablo altına ekle
      const loadBanner = document.createElement('div');
      loadBanner.id = 'ao-sheets-loading';
      loadBanner.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1565C0;color:#fff;padding:10px 18px;border-radius:10px;font-size:12px;font-family:DM Sans,sans-serif;z-index:9999;box-shadow:0 4px 16px rgba(21,101,192,.4);display:flex;align-items:center;gap:8px;';
      loadBanner.innerHTML = '<div style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:ao-gspin .8s linear infinite;"></div> ' + (translations[currentLang]||translations.tr).loading_records;
      document.body.appendChild(loadBanner);

      jsonpFetch(url, { action: 'getInspectorKayitlar', token, inspectorAdi: inspectorName.normalize('NFC').trim().toUpperCase() })
        .then(data => {
          if (data.status === 'ok' && data.kayitlar && typeof data.kayitlar === 'object') {
            const insKlasmanKeys = Object.keys(inspector.klasmanlar);
            const norm = s => s.normalize('NFC').trim().toLowerCase();
            Object.entries(data.kayitlar).forEach(([klasmanAd, kayitlarArr]) => {
              if (!Array.isArray(kayitlarArr) || !kayitlarArr.length) return;
              let hedefKey = insKlasmanKeys.find(k => k === klasmanAd)
                || insKlasmanKeys.find(k => norm(k) === norm(klasmanAd));
              if (!hedefKey) return;
              inspector.klasmanlar[hedefKey].kayitlar = kayitlarArr.map(r => ({
                ...r,
                kontrolAdetSuresi: r.kontrolAdetSuresi || 0,
                istasyonSuresi: r.istasyonSuresi || 0,
                standartSure: r.standartSure || 0,
                kayitFiiliSure: r.kayitFiiliSure || 0,
                tarihGecerli: r.tarihGecerli || false,
                baslangic: r.baslangic ? (() => { const d = new Date(r.baslangic); return isNaN(d.getTime()) ? null : d; })() : null,
                bitis: r.bitis ? (() => { const d = new Date(r.bitis); return isNaN(d.getTime()) ? null : d; })() : null
              }));
            });
            // Overlay hâlâ açıksa tabloyu güncelle
            const ov = document.getElementById('analiz-overlay');
            if (ov && ov.style.display !== 'none') {
              const fresh = buildTumKayitlar(inspector);
              _aoData = fresh;
              _aoRenderStats();
              _aoRenderTop20();
              aoApplyFilters();
              const kb = Object.values(inspector.klasmanlar).reduce((s,kd)=>s+(kd.kayitlar||[]).length,0);
              console.log('[detay] Sheets kayıtları yüklendi ve tablo güncellendi:', kb, 'kayıt');
            }
          }
        })
        .catch(e => console.warn('getInspectorKayitlar hatası:', e.message))
        .finally(() => { const b = document.getElementById('ao-sheets-loading'); if(b) b.remove(); });
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
  selectedInspectorDetail = null;
}

// ────────────────────────────
// EXCEL EXPORT
// ────────────────────────────
function exportToExcel() {
  if (!performansData.length) {
    alert('Henüz performans verisi yok!');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const _exportHedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);

  const mainData = performansData.map(inspector => {
    const totalHedef = inspector.standartSure || 0;
    // "Ne ödül ne ceza": nötr kayıp zaman mesai süresinden düşülüp performans
    // CANLI Hedef Verimlilik ile yeniden hesaplanır — Dashboard kartlarıyla
    // (ve diğer tüm ekranlarla) birebir tutarlı olması için. Eskiden burada
    // sadece durağan inspector.verimlilikPerf kullanılıyordu, bu da Dashboard'da
    // gösterilenden farklı (eski) bir yüzde vermesine yol açıyordu.
    const _stdSnEx = inspector.standartSure || 0;
    let _mesSnEx = inspector.mesaiSure || 0;
    const _kzSnEx = getNotrKayipDakikaForInspector(inspector.ins) * 60;
    if (_kzSnEx > 0 && _mesSnEx > _kzSnEx) _mesSnEx -= _kzSnEx;
    const _hamPEx = (_stdSnEx > 0 && _mesSnEx > 0)
      ? Math.round((_stdSnEx / _mesSnEx) * 100) : inspector.genelHizPerf;
    const performans = (_hamPEx !== null && _hamPEx !== undefined)
      ? Math.round(_hamPEx * (100 / _exportHedef)) : (inspector.verimlilikPerf ?? inspector.genelHizPerf ?? 0);
    const ti = getTeknikIncelemeSkorForInspector(inspector.ins);
    const ii = getIkinciInspectionOraniForInspector(inspector.ins);

    return {
      'Inspector': inspector.ins,
      'Toplam Adet': inspector.adet,
      'Kayıt Sayısı': inspector.kayit,
      'Standart Süre (dk)': Math.round(totalHedef/60),
      'Mesai Süresi (dk)': Math.round((inspector.mesaiSure||0)/60),
      'Verimlilik Perf (%)': performans,
      'Teknik İnceleme Skoru (%)': (ti && ti.count > 0) ? ti.percent : '—',
      'İkinci Insp. Geçti/Toplam Oranı (%)': ii.percent !== null ? ii.percent : '—',
      'Klasman Sayısı': Object.keys(inspector.klasmanlar).length,
      'Çalışma Gün Sayısı': inspector.gunSayisi || 0,
      'Overtime Performans (%)': (inspector.overtimePerformans !== null && inspector.overtimePerformans !== undefined) ? inspector.overtimePerformans : '—',
      'Overtime Kontrol Edilen Adet': inspector.toplamOvertimeAdet || 0,
      '2.Kalite Kontrolü: Adet': inspector.toplam2KaliteAdet || 0,
      '2.Kalite Kontrolü: Performans (%)': (inspector.perf2Kalite !== null && inspector.perf2Kalite !== undefined) ? inspector.perf2Kalite : '—'
    };
  });

  const mainSheet = XLSX.utils.json_to_sheet(mainData);
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Genel Performans');

  const detailData = [];
  performansData.forEach(inspector => {
    Object.entries(inspector.klasmanlar).forEach(([klasman, data]) => {
      const klasmanPerf = data.hizPerf ?? 0;
      detailData.push({
        'Inspector': inspector.ins,
        'Klasman': klasman,
        'Adet': data.adet,
        'Standart Süre (dk)': Math.round((data.standartSure||0)/60),
        'Performans (%)': klasmanPerf
      });
    });
  });

  const detailSheet = XLSX.utils.json_to_sheet(detailData);
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Klasman Detayları');

  const fileName = `Inspector_Performans_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function exportInspectorDetail() {
  if (!selectedInspectorDetail) return;
  const inspector = selectedInspectorDetail;

  // ── Yardımcılar ──
  function fmtSnExcel(sn) {
    if (!sn || sn <= 0) return '—';
    const s = Math.round(sn);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    if (h > 0) return h + 's ' + String(m).padStart(2,'0') + 'd ' + String(sc).padStart(2,'0') + 'sn';
    if (m > 0) return m + 'd ' + String(sc).padStart(2,'0') + 'sn';
    return sc + 'sn';
  }
  function fmtTarihExcel(d) {
    if (!d) return '—';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('tr-TR', {day:'2-digit',month:'2-digit',year:'numeric'}) +
           ' ' + dt.toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
  }
  function oranHesapla(fiili, standart) {
    if (!fiili || !standart) return '—';
    return Math.round((fiili / standart) * 100) + '%';
  }

  const wb = XLSX.utils.book_new();

  // ── SAYFA 1: Özet (Klasman bazında) ──
  const ozetRows = Object.entries(inspector.klasmanlar).map(([klasman, kd]) => ({
    'Klasman':              klasman,
    'Toplam Adet':          kd.adet || 0,
    'Standart Süre':        fmtSnExcel(kd.standartSure),
    'Standart Süre (sn)':   kd.standartSure || 0,
    'Gerçekleşen Süre':     fmtSnExcel(kd.kayitFiiliSure),
    'Gerçekleşen (sn)':     kd.kayitFiiliSure || 0,
    'Oran (Std./Ger.)':     oranHesapla(kd.standartSure, kd.kayitFiiliSure),
    'Hız Performansı (%)':  kd.hizPerf ?? '—'
  }));
  const wsOzet = XLSX.utils.json_to_sheet(ozetRows);

  // Sütun genişlikleri
  wsOzet['!cols'] = [
    {wch:22},{wch:14},{wch:16},{wch:18},{wch:18},{wch:18},{wch:18},{wch:20}
  ];

  // Header rengi (A1:H1) — koyu lacivert
  const ozetRange = XLSX.utils.decode_range(wsOzet['!ref']);
  for (let C = ozetRange.s.c; C <= ozetRange.e.c; C++) {
    const cell = wsOzet[XLSX.utils.encode_cell({r:0, c:C})];
    if (cell) {
      cell.s = {
        font:    { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill:    { fgColor: { rgb: '0B1F3A' }, patternType: 'solid' },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
      };
    }
  }

  // Veri satırları renklendirme
  for (let R = 1; R <= ozetRange.e.r; R++) {
    const oranCell = wsOzet[XLSX.utils.encode_cell({r:R, c:6})]; // Oran sütunu
    const oranVal  = oranCell ? parseInt(oranCell.v) : NaN;
    let rowColor = 'FFFFFF';
    if (!isNaN(oranVal)) {
      if (oranVal >= 100)       rowColor = 'E0F2F1'; // yeşil
      else if (oranVal >= 80)   rowColor = 'FFF8E1'; // amber
      else                      rowColor = 'FFEBEE'; // kırmızı
    }
    for (let C = ozetRange.s.c; C <= ozetRange.e.c; C++) {
      const cell = wsOzet[XLSX.utils.encode_cell({r:R, c:C})];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: R % 2 === 0 ? rowColor : rowColor.replace(/^(E0|FF|FF)/,'F') }, patternType: 'solid' },
          alignment: { horizontal: C >= 1 ? 'center' : 'left', vertical: 'center' },
          border: {
            bottom: { style: 'thin', color: { rgb: 'CFE3F7' } },
            right:  { style: 'thin', color: { rgb: 'CFE3F7' } }
          }
        };
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsOzet, 'Özet');

  // ── SAYFA 2: Kayıt Detayı (satır bazında) ──
  const kayitRows = [];
  Object.entries(inspector.klasmanlar).forEach(([klasman, kd]) => {
    (kd.kayitlar || []).forEach((k, i) => {
      const fiili = k.kayitFiiliSure || 0;
      const std   = k.standartSure   || 0;
      const oran  = fiili && std ? Math.round((std / fiili) * 100) : null;
      kayitRows.push({
        '#':                    kayitRows.length + 1,
        'Klasman':              klasman,
        'Talep No':             k.talepNo || '—',
        'Adet':                 k.adet || 0,
        'Kontrol Süresi (sn)':  k.kontrolAdetSuresi || 0,
        'İstasyon Süresi':      fmtSnExcel(k.istasyonSuresi),
        'Standart Süre':        fmtSnExcel(std),
        'Standart Süre (sn)':   std,
        'Gerçekleşen Süre':     fmtSnExcel(fiili),
        'Gerçekleşen (sn)':     fiili || '—',
        'Oran (Std./Ger.)':     (oran !== null ? oran + '%' : '—'),
        'Ort. Kontrol (sn/ad)': k.adet > 0 && fiili > 0 ? Math.round(fiili / k.adet) : '—',
        'Başlangıç':            fmtTarihExcel(k.baslangic),
        'Bitiş':                fmtTarihExcel(k.bitis),
        'Tarih Geçerli':        k.tarihGecerli ? 'Evet' : 'Hayır',
        'Inspection Tipi':      k.inspectionTipi || '—'
      });
    });
  });

  const wsKayit = XLSX.utils.json_to_sheet(kayitRows.length ? kayitRows : [{'Bilgi':'Kayıt verisi yok'}]);
  wsKayit['!cols'] = [
    {wch:5},{wch:20},{wch:8},{wch:18},{wch:16},{wch:16},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:14}
  ];

  // Kayıt sayfası header rengi
  if (kayitRows.length) {
    const kayitRange = XLSX.utils.decode_range(wsKayit['!ref']);
    for (let C = kayitRange.s.c; C <= kayitRange.e.c; C++) {
      const cell = wsKayit[XLSX.utils.encode_cell({r:0, c:C})];
      if (cell) {
        cell.s = {
          font:  { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
          fill:  { fgColor: { rgb: '102848' }, patternType: 'solid' },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
        };
      }
    }
    // Veri satırları
    for (let R = 1; R <= kayitRange.e.r; R++) {
      const oranCell = wsKayit[XLSX.utils.encode_cell({r:R, c:9})]; // Oran
      const oranVal  = oranCell ? parseInt(oranCell.v) : NaN;
      const bg = isNaN(oranVal) ? 'FFFFFF' :
                 oranVal >= 100 ? (R%2===0?'E0F2F1':'F1FAF9') :
                 oranVal >= 80  ? (R%2===0?'FFF8E1':'FFFCF0') :
                                  (R%2===0?'FFEBEE':'FFF5F5');
      for (let C = kayitRange.s.c; C <= kayitRange.e.c; C++) {
        const cell = wsKayit[XLSX.utils.encode_cell({r:R, c:C})];
        if (cell) {
          cell.s = {
            fill: { fgColor: { rgb: bg }, patternType: 'solid' },
            alignment: { horizontal: C <= 1 || C === 11 || C === 12 ? 'left' : 'center', vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: 'CFE3F7' } } }
          };
        }
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsKayit, 'Kayıt Detayı');

  // ── SAYFA 3: Inspector Özet ──
  const hamPerf  = inspector.genelHizPerf ?? 0;
  const hedef    = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
  const duzPerf  = Math.round(hamPerf * (100 / hedef));
  const genelRows = [
    { 'Alan': 'Inspector Adı',        'Değer': inspector.ins },
    { 'Alan': 'Toplam Adet',          'Değer': inspector.adet || 0 },
    { 'Alan': 'Toplam Kayıt',         'Değer': inspector.kayit || 0 },
    { 'Alan': 'Klasman Sayısı',       'Değer': Object.keys(inspector.klasmanlar).length },
    { 'Alan': 'Çalışma Gün Sayısı',   'Değer': inspector.gunSayisi || 0 },
    { 'Alan': 'Standart Süre',        'Değer': fmtSnExcel(inspector.standartSure) },
    { 'Alan': 'Mesai Süresi',         'Değer': fmtSnExcel(inspector.mesaiSure) },
    { 'Alan': 'Ham Hız Performansı',  'Değer': hamPerf !== null ? hamPerf + '%' : '—' },
    { 'Alan': 'Düz. Performans',      'Değer': duzPerf + '%' },
    { 'Alan': 'Rapor Tarihi',         'Değer': new Date().toLocaleDateString('tr-TR') }
  ];
  const wsGenel = XLSX.utils.json_to_sheet(genelRows);
  wsGenel['!cols'] = [{wch:24},{wch:28}];
  // Header rengi
  ['A1','B1'].forEach(ref => {
    if (wsGenel[ref]) wsGenel[ref].s = {
      font: { bold:true, color:{rgb:'FFFFFF'}, sz:11 },
      fill: { fgColor:{rgb:'0B1F3A'}, patternType:'solid' },
      alignment: { horizontal:'center' }
    };
  });
  XLSX.utils.book_append_sheet(wb, wsGenel, 'Inspector Özet');

  const fileName = `${inspector.ins.replace(/\s+/g, '_')}_Detay_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ────────────────────────────
// KLASMAN YÖNETİMİ
// ────────────────────────────
let klFilter = 'all'; // 'all' | 'done' | 'undone'

// ─── OTOMATİK SHEETS PUSH (debounce 1.5sn) ───
let _klasmanPushTimer = null;
function autoSaveAndPushKlasmanlar() {
  saveData();
  clearTimeout(_klasmanPushTimer);
  _klasmanPushTimer = setTimeout(() => {
    if (SHEETS_DEVRE_DISI) return;
    const url   = appConfig.sheetsWebAppUrl;
    const token = appConfig.sheetsApiToken;
    if (!url || !token) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'setKlasmanlar', token, klasmanlar, savedAt: new Date().toISOString() }),
      mode: 'no-cors'
    }).then(() => {
      console.log('☁️ Klasmanlar Sheets\'e otomatik gönderildi');
      showSuccessMessage((translations[currentLang]||translations.tr).sheets_klasman_sync);
    }).catch(err => console.warn('Klasman oto-push hatası:', err.message));
  }, 1500);
}

function isKlasmanTamamlandi(k) {
  // Manuel işaretleme öncelikli; işaretlenmemişse false
  return k.tamamlandi === true;
}

function toggleKlasmanTamamlandi(kId) {
  const k = klasmanlar.find(x => x.id === kId);
  if (!k) return;
  k.tamamlandi = !k.tamamlandi;
  autoSaveAndPushKlasmanlar();
  renderListe();
  renderEditor();
}

function setKlFilter(val) {
  klFilter = val;
  sayfa = 1;
  // Buton stillerini güncelle
  ['all','done','undone'].forEach(v => {
    const btn = document.getElementById('kl-f-' + v);
    if (!btn) return;
    btn.className = 'kl-filter-btn';
    if (v === val) {
      if (v === 'done')   btn.className += ' active-green';
      else if (v === 'undone') btn.className += ' active-amber';
      else btn.className += ' active';
    }
  });
  renderListe();
}

function filtered(){ 
  let list = klasmanlar.filter(k => k.ad.toLowerCase().includes(aramaStr.toLowerCase()));
  if (klFilter === 'done')   list = list.filter(k => isKlasmanTamamlandi(k));
  if (klFilter === 'undone') list = list.filter(k => !isKlasmanTamamlandi(k));
  return list;
}

function aramaYap(){ 
  aramaStr=document.getElementById('search-input').value; 
  sayfa=1; 
  renderListe(); 
}

function changePage(d){
  const fl=filtered(), tp=Math.max(1,Math.ceil(fl.length/KL_PER_PAGE));
  sayfa=Math.min(tp,Math.max(1,sayfa+d));
  renderListe();
}

const KL_PER_PAGE = 20; // Grid görünüm için sayfa başı klasman

function renderListe(){
  const fl = filtered();
  const tp = Math.max(1, Math.ceil(fl.length / KL_PER_PAGE));
  if(sayfa > tp) sayfa = tp;
  const slice = fl.slice((sayfa - 1) * KL_PER_PAGE, sayfa * KL_PER_PAGE);
  const el = document.getElementById('klasman-liste');

  // Tamamlanma sayaçlarını güncelle
  const totalAll   = klasmanlar.filter(k => k.ad.toLowerCase().includes(aramaStr.toLowerCase())).length;
  const totalDone  = klasmanlar.filter(k => k.ad.toLowerCase().includes(aramaStr.toLowerCase()) && isKlasmanTamamlandi(k)).length;
  const totalUndone = totalAll - totalDone;
  const countEl = document.getElementById('kl-filter-counts');
  if (countEl) countEl.textContent = `✅ ${totalDone}  ·  ⚠️ ${totalUndone}`;

  if(!slice.length){
    el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><h3 data-i18n="not_found">Bulunamadı</h3><p data-i18n="change_search">Arama kriterlerini değiştirin</p></div>';
    applyI18nToNewNodes(el);
  } else {
    el.innerHTML = '<div class="kl-grid">' + slice.map(k => {
      const icon      = k.icon || KL_ICONS[k.id % KL_ICONS.length];
      const sure      = birAdet(k).toFixed(1);
      const selected  = k.id === secilenId;
      const tamam     = isKlasmanTamamlandi(k);
      const checkBadge = tamam
        ? `<span style="position:absolute;top:6px;right:6px;font-size:11px;background:#E0F2F1;color:var(--green);border-radius:99px;padding:1px 6px;font-weight:700;border:1px solid #B2DFDB">✓</span>`
        : '';
      return `<div class="kl-card${selected?' selected':''}${tamam?' completed':''}" onclick="selectKlasman(${k.id})">
        ${checkBadge}
        <div class="kl-card-icon">${icon}</div>
        <div class="kl-card-name" title="${k.ad}">${k.ad}</div>
        <div class="kl-card-meta">⚙️ ${k.istasyonlar.length} ist. &nbsp;·&nbsp; ⏱ ${sure}sn</div>
      </div>`;
    }).join('') + '</div>';
  }

  document.getElementById('kl-sayac').textContent = fl.length + ' ' + (translations[currentLang]||translations.tr).klasman_word;
  
  // Sayfalama güncelle
  const prevBtn = document.getElementById('kl-prev');
  const nextBtn = document.getElementById('kl-next');
  const pagEl = document.getElementById('kl-pag-pages');
  const pagContainer = document.getElementById('kl-pag');
  
  if (prevBtn) prevBtn.disabled = sayfa <= 1;
  if (nextBtn) nextBtn.disabled = sayfa >= tp;
  
  if (pagEl) {
    if (tp <= 1) {
      if (pagContainer) pagContainer.style.display = 'none';
    } else {
      if (pagContainer) pagContainer.style.display = 'flex';
      // Sayfa numaralarını göster (max 7)
      let pages = [];
      if (tp <= 7) {
        for(let i=1;i<=tp;i++) pages.push(i);
      } else {
        pages = [1];
        if (sayfa > 3) pages.push('...');
        for(let i=Math.max(2,sayfa-1);i<=Math.min(tp-1,sayfa+1);i++) pages.push(i);
        if (sayfa < tp-2) pages.push('...');
        pages.push(tp);
      }
      pagEl.innerHTML = pages.map(p => 
        p === '...' 
          ? `<span style="padding:0 4px;color:var(--muted);line-height:28px">…</span>` 
          : `<button class="kl-pag-page${p===sayfa?' active':''}" onclick="goToPage(${p})">${p}</button>`
      ).join('');
    }
  }
  
  updateSidebar();
}

function goToPage(p) {
  sayfa = p;
  renderListe();
}

function selectKlasman(id){
  secilenId=id; 
  renderListe(); 
  renderEditor();
}

function renderEditor(){
  const k=klasmanlar.find(x=>x.id===secilenId);
  const el=document.getElementById('editor-content');
  if(!k){
    el.innerHTML=`
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;text-align:center">
        <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,var(--lblue2),var(--lblue3));display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:18px;border:1px solid var(--border)">⚙️</div>
        <h3 style="font-size:15px;font-weight:600;color:var(--navy);margin-bottom:8px">Bir klasman seçin</h3>
        <p style="font-size:12px;color:var(--muted);max-width:220px;line-height:1.6">Soldan bir klasman seçerek istasyon sürelerini düzenleyebilirsiniz</p>
      </div>
    `;
    return;
  }
  
  const istasyonSuresi = k.istasyonlar.reduce((s,i)=>s+(parseFloat(i.sure)||0),0);
  const urunKontrolSuresi = parseFloat(k.urunKontrolSuresi) || 0;
  const toplamSure = istasyonSuresi + urunKontrolSuresi;
  
  const curIcon = k.icon || KL_ICONS[k.id % KL_ICONS.length];
  const iconGridHtml = KL_ICONS.map((ic) => `
    <button onclick="updateKlasmanIcon(${k.id},'${ic}')" title="${ic}"
      style="font-size:16px;padding:4px;border-radius:6px;border:2px solid ${ic===curIcon?'var(--blue2)':'var(--border2)'};
      background:${ic===curIcon?'var(--lblue2)':'var(--white)'};cursor:pointer;transition:all .1s;aspect-ratio:1;"
    >${ic}</button>
  `).join('');

  el.innerHTML=`
    <div style="padding:16px 18px;border-bottom:1px solid var(--border2);background:var(--lblue3);display:flex;align-items:center;justify-content:space-between">
      <h2 style="font-size:14px;font-weight:600;color:var(--navy);display:flex;align-items:center;gap:8px">
        <span>${curIcon}</span> ${k.ad} — Düzenle
      </h2>
      <button onclick="addIstasyon(${k.id})" style="padding:6px 12px;background:var(--blue);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer" data-i18n="add_station">＋ Add Station</button>
    </div>
    <div style="padding:18px">

      <!-- Klasman Adı & İkon Düzenleme -->
      <div style="padding:14px;background:var(--offwhite);border:1px solid var(--border2);border-radius:10px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          ✏️ Klasman Bilgileri
          <button onclick="toggleKlasmanTamamlandi(${k.id})" title="Tıklayarak işaretle / kaldır"
            style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;border:1.5px solid ${isKlasmanTamamlandi(k)?'#81C784':'#FFE082'};
            background:${isKlasmanTamamlandi(k)?'#E0F2F1':'var(--lamber)'};
            color:${isKlasmanTamamlandi(k)?'var(--green)':'var(--amber)'};
            font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:all .15s;font-family:'DM Sans',sans-serif">
            ${isKlasmanTamamlandi(k) ? '✅ Tamamlandı' : '⚠️ Tamamlanmadı'}
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:28px;">${curIcon}</span>
          <input value="${k.ad}" onblur="updateKlasmanAd(${k.id},this.value)" onkeydown="if(event.key==='Enter'){this.blur();}" 
            style="flex:1;padding:8px 12px;border:1.5px solid var(--blue3);border-radius:8px;font-size:13px;font-weight:600;color:var(--navy);"
            placeholder="Klasman adı">
        </div>
        <div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;" data-i18n="select_icon_btn">İkon Seç</div>
        <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;max-height:130px;overflow-y:auto;padding:2px;" id="editor-icon-grid-${k.id}">
          ${iconGridHtml}
        </div>
      </div>
      ${(!currentUser || currentUser.isAdmin) ? `
      <div style="margin-bottom:8px">
        <button onclick="showKlasmanSureOnerisi(${k.id})"
          style="width:100%;padding:10px 14px;background:linear-gradient(135deg,#EDE7F6,#F3E5F5);border:1.5px solid #B39DDB;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12.5px;font-weight:700;color:#5E35B1;font-family:'DM Sans',sans-serif">
          📊 Analiz Et — Gerçekleşen Süreye Göre Süre Önerisi Al
        </button>
      </div>
      ` : ''}
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--lgreen);border:1px solid var(--green);border-radius:8px;margin-bottom:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">⏱</div>
        <div style="flex:1">
          <strong style="font-size:13px;color:var(--green);display:block" data-i18n="unit_check_duration">1 Birim Muayene Süresi</strong>
          <span style="font-size:11px;color:var(--muted2)" data-i18n="unit_check_hint">Ürün başına harcanan standart süre</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" value="${urunKontrolSuresi}" min="0" step="1" id="inp-urunkontrol-${k.id}"
            onchange="updateUrunKontrol(${k.id},this.value)" style="width:80px;text-align:right;padding:6px 8px;border:1px solid var(--border);border-radius:6px">
          <span style="font-size:12px;color:var(--muted);white-space:nowrap">saniye</span>
        </div>
      </div>

      <!-- Ölçü -->
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--lamber);border:1px solid var(--amber);border-radius:8px;margin-bottom:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">📐</div>
        <div style="flex:1">
          <strong style="font-size:13px;color:var(--amber);display:block">Ölçü Süresi</strong>
          <span style="font-size:11px;color:var(--muted2)">Adet başına ölçüm süresi — BakilacakMiktar'a göre ölçülecek adet × bu süre eklenir</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" value="${parseFloat(k.olcuSuresi)||0}" min="0" step="1" id="inp-olcu-${k.id}"
            onchange="updateOlcuSuresi(${k.id},this.value)" style="width:80px;text-align:right;padding:6px 8px;border:1px solid var(--border);border-radius:6px">
          <span style="font-size:12px;color:var(--muted);white-space:nowrap">saniye</span>
        </div>
      </div>

      <!-- Ürün Kabul -->
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--lblue3);border:1px solid var(--blue3);border-radius:8px;margin-bottom:16px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--blue3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">✅</div>
        <div style="flex:1">
          <strong style="font-size:13px;color:var(--blue);display:block">Ürün Kabul Süresi</strong>
          <span style="font-size:11px;color:var(--muted2)">Parti başına sabit ek süre — miktar arttıkça kademeli artar (1-32→1x, 33-80→2x, 81-125→3x, 125+→4x)</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" value="${parseFloat(k.urunKabulSuresi)||0}" min="0" step="1" id="inp-kabul-${k.id}"
            onchange="updateUrunKabulSuresi(${k.id},this.value)" style="width:80px;text-align:right;padding:6px 8px;border:1px solid var(--border);border-radius:6px">
          <span style="font-size:12px;color:var(--muted);white-space:nowrap">saniye</span>
        </div>
      </div>

      <div style="margin-bottom:16px">
        ${k.istasyonlar.length===0?`
          <div style="padding:40px 24px;text-align:center;border:2px dashed var(--border);border-radius:8px;background:var(--offwhite)">
            <div style="font-size:24px;margin-bottom:8px;opacity:0.5">⚙️</div>
            <h3 style="font-size:13px;font-weight:500;color:var(--muted);margin-bottom:4px">"İstasyon Ekle" ile başlayın</h3>
            <p style="font-size:11px;color:var(--muted2)" data-i18n="add_first_station">Bu klasmanı tanımlamaya başlamak için ilk istasyonu ekleyin</p>
          </div>
        `:''}
        ${k.istasyonlar.map((ist,i)=>`
          <div style="display:grid;grid-template-columns:40px 1fr auto auto auto;gap:12px;align-items:center;padding:12px;background:var(--white);border:1px solid var(--border2);border-radius:8px;margin-bottom:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--lblue2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--blue)">${i+1}</div>
            <input value="${ist.ad}" onchange="updateIst(${k.id},${ist.id},'ad',this.value)" placeholder="İstasyon adı" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px">
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" value="${ist.sure}" min="0" step="1"
                onchange="updateIst(${k.id},${ist.id},'sure',this.value)" style="width:80px;text-align:right;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px">
              <span style="font-size:11px;color:var(--muted);white-space:nowrap">sn</span>
            </div>
            <div style="font-size:10px;color:var(--muted2);text-align:right;min-width:40px">
              ${toplamSure > 0 ? ((parseFloat(ist.sure)||0)/toplamSure*100).toFixed(0) : 0}%
            </div>
            <button onclick="deleteIst(${k.id},${ist.id})" style="width:28px;height:28px;border:none;background:var(--lred);color:var(--red);border-radius:6px;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center" title="İstasyonu Sil">🗑</button>
          </div>`).join('')}
      </div>
      
      ${k.istasyonlar.length>0 || urunKontrolSuresi>0?`
        <div style="background:linear-gradient(135deg,var(--lblue3) 0%,#fff 100%);border:1px solid var(--lblue);border-radius:10px;padding:16px">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center">
            <div>
              <div style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace">${toplamSure.toFixed(0)}</div>
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px" data-i18n="total_duration_label">Total Duration (s)</div>
            </div>
            <div>
              <div style="font-size:18px;font-weight:700;color:var(--blue);font-family:'DM Mono',monospace">${k.istasyonlar.length}</div>
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px" data-i18n="station_count">İstasyon Sayısı</div>
            </div>
            <div>
              <div style="font-size:18px;font-weight:700;color:var(--green);font-family:'DM Mono',monospace">${(toplamSure/60).toFixed(1)}</div>
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">Dakika/Adet</div>
            </div>
          </div>
        </div>`:''}
    </div>`;
}

function updateUrunKontrol(kId, val) {
  const k = klasmanlar.find(x => x.id === kId);
  if (!k) return;
  k.urunKontrolSuresi = parseFloat(val) || 0;
  autoSaveAndPushKlasmanlar();
  renderEditor(); 
  renderListe();
}

function updateOlcuSuresi(kId, val) {
  const k = klasmanlar.find(x => x.id === kId);
  if (!k) return;
  k.olcuSuresi = parseFloat(val) || 0;
  autoSaveAndPushKlasmanlar();
  renderEditor();
  renderListe();
}

function updateUrunKabulSuresi(kId, val) {
  const k = klasmanlar.find(x => x.id === kId);
  if (!k) return;
  k.urunKabulSuresi = parseFloat(val) || 0;
  autoSaveAndPushKlasmanlar();
  renderEditor();
  renderListe();
}

function updateIst(kId,iId,alan,val){
  const k=klasmanlar.find(x=>x.id===kId);
  const ist=k&&k.istasyonlar.find(i=>i.id===iId);
  if(!ist) return;
  if(alan==='sure') ist.sure=parseFloat(val)||0; else ist.ad=val;
  autoSaveAndPushKlasmanlar();
  renderEditor(); renderListe();
}

function updateKlasmanAd(kId, val) {
  const k = klasmanlar.find(x => x.id === kId);
  if (!k || !val.trim()) return;
  k.ad = val.trim();
  autoSaveAndPushKlasmanlar();
  // Kartları güncelle
  renderListe();
  // Editör başlığını da güncelle
  const editorHeader = document.querySelector('#editor-content h2');
  if (editorHeader) editorHeader.innerHTML = `<span>${k.icon || '📦'}</span> ${k.ad} — Düzenle`;
}

function updateKlasmanIcon(kId, ic) {
  const k = klasmanlar.find(x => x.id === kId);
  if (!k) return;
  k.icon = ic;
  autoSaveAndPushKlasmanlar();
  renderEditor(); renderListe();
}

function deleteIst(kId,iId){
  const k=klasmanlar.find(x=>x.id===kId);
  if(!k) return;
  k.istasyonlar=k.istasyonlar.filter(i=>i.id!==iId);
  autoSaveAndPushKlasmanlar();
  renderEditor(); renderListe();
}

// ─── KLASMAN İKON LİSTESİ ───
const KL_ICONS = [
  // Giyim — üst
  '👔','👕','🥼','🧥','🧣','👗','👘','🥻','🩱','🎽',
  // Giyim — alt
  '👖','🩲','🩳','🩴',
  // Ayakkabı & aksesuar
  '👟','👠','👡','👢','👞','🥾','🥿','👒','🎩','🧢','⛑️','👑',
  '👜','👝','💼','🎒','🧳','👛','💍','💎',
  // Tekstil & ev
  '🧶','🧵','🪡','🛋️','🛏️','🪣','🧺','🪢',
  // Spor
  '⚽','🏀','🎾','🏋️','🤸','🧘','🏊','🚴','🥊','🎯',
  // Diğer ürünler
  '📦','🎁','🛒','🏷️','📋','🗂️','📁','🗃️',
  // Kategori/bölüm
  '⭐','🔶','🔷','🟢','🟡','🟠','🔴','🟣','⚡','🌟','🎪','🏅'
];

function openModal(){
  document.getElementById('modal-input').value='';
  // İlk ikonu seç
  const defaultIcon = KL_ICONS[0];
  document.getElementById('modal-icon-val').value = defaultIcon;
  document.getElementById('modal-icon-preview').textContent = defaultIcon;
  
  // İkon grid'i oluştur
  const grid = document.getElementById('modal-icon-grid');
  grid.innerHTML = KL_ICONS.map((ic,i) => `
    <button onclick="selectModalIcon('${ic}')" title="${ic}"
      id="mig-${i}"
      style="font-size:18px;padding:5px;border-radius:7px;border:2px solid ${i===0?'var(--blue2)':'var(--border2)'};
      background:${i===0?'var(--lblue2)':'var(--white)'};cursor:pointer;transition:all .12s;aspect-ratio:1;"
    >${ic}</button>
  `).join('');
  
  document.getElementById('modal').classList.add('open');
  setTimeout(()=>document.getElementById('modal-input').focus(),80);
}

function selectModalIcon(ic) {
  document.getElementById('modal-icon-val').value = ic;
  document.getElementById('modal-icon-preview').textContent = ic;
  // Grid'deki seçili stili güncelle
  const grid = document.getElementById('modal-icon-grid');
  [...grid.children].forEach(btn => {
    const selected = btn.textContent.trim() === ic;
    btn.style.borderColor = selected ? 'var(--blue2)' : 'var(--border2)';
    btn.style.background  = selected ? 'var(--lblue2)' : 'var(--white)';
  });
}

function addIstasyon(kId){
  const k=klasmanlar.find(x=>x.id===kId);
  if(!k) return;
  const nid=Math.max(0,...k.istasyonlar.map(i=>i.id))+1;
  k.istasyonlar.push({id:nid,ad:'Yeni İstasyon',sure:60});
  autoSaveAndPushKlasmanlar();
  renderEditor(); renderListe();
}

function closeModal(){ 
  document.getElementById('modal').classList.remove('open'); 
}

function modalKey(e){ 
  if(e.key==='Enter') addKlasman(); 
  if(e.key==='Escape') closeModal(); 
}

function addKlasman(){
  const ad=document.getElementById('modal-input').value.trim();
  if(!ad) return;
  const icon = document.getElementById('modal-icon-val')?.value || '👔';
  const yeni={id:nextId++, ad, icon, urunKontrolSuresi: 60, olcuSuresi: 0, urunKabulSuresi: 0, istasyonlar:[]};
  klasmanlar.push(yeni);
  closeModal();
  secilenId=yeni.id;
  sayfa=Math.ceil(filtered().length/KL_PER_PAGE);
  autoSaveAndPushKlasmanlar();
  renderListe(); renderEditor();
}


// ────────────────────────────
// EXCEL YÜKLEME & PERFORMANS
// ────────────────────────────
function excelYukle(e){
  const file=e.target.files[0];
  if(!file) return;
  
  showFileStatus((translations[currentLang]||translations.tr).file_uploading, 'var(--blue)');
  
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      const wb=XLSX.read(ev.target.result,{type:'binary'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      
      if(!rows.length){ 
        showFileStatus((translations[currentLang]||translations.tr).file_empty,'var(--red)'); 
        return; 
      }
      
      excelRows=rows;
      excelCols=Object.keys(rows[0]);
      showFileStatus('✅ '+rows.length+' ' + (translations[currentLang]||translations.tr).file_loaded + file.name,'var(--green)');
      document.getElementById('upload-zone').style.background = 'var(--lgreen)';
      document.getElementById('upload-zone').style.borderColor = 'var(--green)';
      fillColSelects();
      document.getElementById('sutun-panel').style.display = 'block';
      performansHesapla();
    }catch(err){
      showFileStatus((translations[currentLang]||translations.tr).file_error+err.message,'var(--red)');
    }
  };
  reader.readAsBinaryString(file);
}

function showFileStatus(msg,color){
  const el=document.getElementById('file-status');
  el.textContent=msg; 
  el.style.color=color;
}

function fillColSelects(){
  const opts='<option value="">— seçin —</option>'+excelCols.map(c=>`<option value="${c}">${c}</option>`).join('');
  ['col-klasman','col-inspector','col-adet','col-baslangic','col-bitis','col-talep'].forEach(id=>{ 
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts; 
  });
  const mesaiEl = document.getElementById('col-mesai');
  if (mesaiEl) mesaiEl.innerHTML = '<option value="">— opsiyonel —</option>' + excelCols.map(c=>`<option value="${c}">${c}</option>`).join('');
  const yapilanDepoEl = document.getElementById('col-yapilan-depo');
  if (yapilanDepoEl) yapilanDepoEl.innerHTML = `<option value="">${(translations[currentLang]||translations.tr).filter_none}</option>` + excelCols.map(c=>`<option value="${c}">${c}</option>`).join('');
  const sonucEl = document.getElementById('col-sonuc');
  if (sonucEl) sonucEl.innerHTML = '<option value="">— Kullanma —</option>' + excelCols.map(c=>`<option value="${c}">${c}</option>`).join('');
  
  // Otomatik tahmin — Türkçe karakter ve boşluk normalize edilerek eşleştirilir
  function normCol(s) {
    return String(s).toLowerCase()
      .replace(/ş/g,'s').replace(/ı/g,'i').replace(/ğ/g,'g')
      .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/\s+/g,'');
  }
  const klasmanCol    = excelCols[0] || '';
  const adetCol       = excelCols.find(c => normCol(c).includes('bakilacakmiktar')) || excelCols[17] || '';
  const insCol        = excelCols.find(c => normCol(c).includes('inspector')) || '';
  const baslangicCol  = excelCols.find(c => normCol(c).includes('inspectionbaslamatarihi') || normCol(c).includes('inspectionbaslama')) || excelCols[10] || '';
  const bitisCol      = excelCols.find(c => normCol(c).includes('inspectionbitistarihi') || normCol(c).includes('inspectionbitis')) || excelCols[11] || '';
  
  if(klasmanCol && document.getElementById('col-klasman')) document.getElementById('col-klasman').value = klasmanCol;
  if(adetCol && document.getElementById('col-adet')) document.getElementById('col-adet').value = adetCol;
  if(insCol && document.getElementById('col-inspector')) document.getElementById('col-inspector').value = insCol;
  if(baslangicCol && document.getElementById('col-baslangic')) document.getElementById('col-baslangic').value = baslangicCol;
  if(bitisCol && document.getElementById('col-bitis')) document.getElementById('col-bitis').value = bitisCol;
  
  const mesaiCol = excelCols.find(c => c.toLowerCase().includes('mesai') || c.toLowerCase().includes('shift') || c.toLowerCase().includes('çalışmasüresi')) || '';
  if (mesaiCol && document.getElementById('col-mesai')) document.getElementById('col-mesai').value = mesaiCol;

  // TalepNumarası otomatik tahmin
  const talepColAuto = excelCols.find(c => {
    const norm = c.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ı/g,'i').replace(/ç/g,'c');
    return norm.includes('talepno') || norm.includes('talepnumarasi') || norm.includes('talep') || norm === 'talep';
  }) || '';
  if (talepColAuto && document.getElementById('col-talep')) document.getElementById('col-talep').value = talepColAuto;

  // InspectionYapilanDepo otomatik tahmin
  const yapilanDepoColAuto = excelCols.find(c => c.toLowerCase().replace(/[^a-z]/g,'').includes('yapilandepo') || c.toLowerCase().replace(/\s/g,'') === 'inspectionyapilandepo') || excelCols[19] || '';
  if (yapilanDepoColAuto && document.getElementById('col-yapilan-depo')) document.getElementById('col-yapilan-depo').value = yapilanDepoColAuto;

  // InspectionSonuc otomatik tahmin — "sonuc" veya "sonuç" içeren sütun, "ysg" içerenleri öncelikle hariç tut
  const sonucColAuto = excelCols.find(c => {
    const norm = c.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/ç/g,'c').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ı/g,'i');
    return (norm.includes('inspectionsonuc') || norm.includes('inspectionsonuç') || norm === 'sonuc' || norm === 'sonuç') && !norm.startsWith('ysg');
  }) || excelCols.find(c => {
    const norm = c.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/ç/g,'c').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ı/g,'i');
    return norm.includes('sonuc') || norm.includes('sonuç');
  });
  if (sonucColAuto && document.getElementById('col-sonuc')) document.getElementById('col-sonuc').value = sonucColAuto;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PERFORMANS TABLOSUNU localStorage/Sheets VERİSİNDEN RENDER ET
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// Sheets'ten performans verisini çek ve tabloyu güncelle (performans sekmesi açıkken arka planda)
let _perfFetchInProgress = false;
async function autoFetchPerfIfNeeded() {
  if (_perfFetchInProgress) return;
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return;

  _perfFetchInProgress = true;
  try {
    const { performansData: pd } = await fetchPerformansRawPaginated(url, token);
    if (pd && pd.length > 0) {
      performansData = fixVerimlilikPerf(restorePerformansDateObjects(pd));
      // verimlilikPerf hedefVerimlilik'e göre yeniden hesaplandı
      saveData();
      renderPerfTabloFromData();
      renderDashboard();
      updateSidebar();
      showSuccessMessage('✅ ' + (translations[currentLang]||translations.tr).sheets_perf_updated + ' (' + performansData.length + ')', 3000);
    }
  } catch(e) {
    console.warn('Performans oto-çekme hatası:', e.message);
  }
  _perfFetchInProgress = false;
}

// ─── PERFORMANS TABLOSU SAYFALAMA STATE ───
let _perfPage = 1;
const _PERF_PER_PAGE = 20;

// performansData array'inden Inspector Performans Raporu tablosunu render eder
// Excel yüklenmeden, sadece kayıtlı/çekilen veriden tablo gösterir
function renderPerfTabloFromData(page) {
  const tablo = document.getElementById('perf-tablo');
  const empty = document.getElementById('perf-empty');
  if (!tablo || !empty) return;

  if (!performansData || !performansData.length) {
    tablo.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  if (page !== undefined) _perfPage = page;

  const hedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
  // verimlilikPerf Sheets'ten geldiğinde doğru değerde — yeniden hesaplama

  const fmtSure = (sn) => {
    if (!sn) return '—';
    const s = Math.round(sn);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return h > 0
      ? `${h}s ${String(m).padStart(2,'0')}d`
      : `${m}d ${String(sc).padStart(2,'0')}sn`;
  };

  const ortPerformans = performansData.length > 0
    ? Math.round(performansData.reduce((s, r) => s + (r.genelHizPerf ?? 0), 0) / performansData.length) : 0;
  // "Ne ödül ne ceza": nötr kayıp zaman düşülmüş ham performans, CANLI Hedef
  // (inp-verimlilik) ile ölçeklenir — Dashboard kartlarındaki mantıkla aynı
  // (getDispPerf çağırmıyoruz çünkü o, inspector.hedefVerimlilik'teki olası
  // ESKİ/durağan hedefi kullanır; burada kullanıcının O AN girdiği hedef
  // canlı yansımalı).
  const _hamPerfDuzeltilmis = (r) => {
    const standartSn = r.standartSure || 0;
    let mesaiSn = r.mesaiSure || 0;
    const notrKayipSn = getNotrKayipDakikaForInspector(r.ins) * 60;
    if (notrKayipSn > 0 && mesaiSn > notrKayipSn) mesaiSn -= notrKayipSn;
    return (standartSn > 0 && mesaiSn > 0) ? Math.round((standartSn / mesaiSn) * 100) : r.genelHizPerf;
  };
  const ortVPerf = performansData.length > 0
    ? Math.round(performansData.reduce((s, r) => {
        const hp = _hamPerfDuzeltilmis(r);
        return s + (hp !== null && hp !== undefined ? Math.round(hp * (100 / hedef)) : 0);
      }, 0) / performansData.length) : 0;
  const ortalamaGun = performansData.length > 0
    ? Math.round(performansData.reduce((s, r) => s + (r.gunSayisi || 0), 0) / performansData.length) : 0;

  const vOrtEl = document.getElementById('verimlilik-ort');
  if (vOrtEl) {
    vOrtEl.textContent = ortVPerf + '%';
    vOrtEl.style.color = getProgressColor(ortVPerf);
  }

  // Sayfalama
  const totalPages = Math.ceil(performansData.length / _PERF_PER_PAGE);
  if (_perfPage > totalPages) _perfPage = totalPages;
  if (_perfPage < 1) _perfPage = 1;
  const startIdx = (_perfPage - 1) * _PERF_PER_PAGE;
  const pageData = performansData.slice(startIdx, startIdx + _PERF_PER_PAGE);

  const perfColorMap = {
    'perf-excellent': { bg: 'linear-gradient(135deg,#E8F5E9,#F1F8E9)', accent: '#00897B', badge: '#00897B', badgeTxt: '#fff', label: 'MÜKEMMEL' },
    'perf-good':      { bg: 'linear-gradient(135deg,#E3F2FD,#EEF7FF)', accent: '#1565C0', badge: '#1565C0', badgeTxt: '#fff', label: 'İYİ' },
    'perf-average':   { bg: 'linear-gradient(135deg,#FFF8E1,#FFFDE7)', accent: '#F57F17', badge: '#F57F17', badgeTxt: '#fff', label: 'ORTA' },
    'perf-weak':      { bg: 'linear-gradient(135deg,#FFEBEE,#FFF3F3)', accent: '#EF5350', badge: '#EF5350', badgeTxt: '#fff', label: 'ZAYIF' },
    'perf-verypoor':  { bg: 'linear-gradient(135deg,#FFCDD2,#FFEBEE)', accent: '#B71C1C', badge: '#B71C1C', badgeTxt: '#fff', label: 'ÇOK ZAYIF' },
    'perf-poor':      { bg: 'linear-gradient(135deg,#FFCDD2,#FFEBEE)', accent: '#B71C1C', badge: '#B71C1C', badgeTxt: '#fff', label: 'ÇOK ZAYIF' }, // geriye dönük uyumluluk
  };

  const kartlar = pageData.map((row, idx) => {
    const globalIdx = startIdx + idx + 1;
    const ini = row.ins.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    const performans = row.genelHizPerf ?? 0;
    const performansClass = getPerformanceClass(performans);
    const cm = perfColorMap[performansClass] || perfColorMap['perf-verypoor'];
    const _hpDuz = _hamPerfDuzeltilmis(row);
    const vPerfDisplay = _hpDuz !== null && _hpDuz !== undefined
      ? Math.round(_hpDuz * (100 / hedef)) : null;
    const vPerfClass = vPerfDisplay === null ? '' : getPerformanceClass(vPerfDisplay);
    const vcm = perfColorMap[vPerfClass] || cm;
    const tarihDurumu = (row.tarihBasariliKayit || 0) > 0
      ? `<span style="color:var(--green)">✅ ${row.tarihBasariliKayit}/${row.kayit}</span>`
      : `<span style="color:var(--amber)">⚠️ Tarih yok</span>`;
    const klasmanEntries = Object.entries(row.klasmanlar || {}).slice(0, 4);
    const klasmanBars = klasmanEntries.map(([k, v]) => {
      const kp = Math.round(v.hizPerf || 0);
      const kc = getProgressColor(kp);
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <div style="font-size:10px;color:var(--muted);width:70px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;">${k}</div>
        <div style="flex:1;height:5px;background:var(--border2);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.min(100,kp)}%;height:100%;background:${kc};border-radius:3px;"></div>
        </div>
        <div style="font-size:10px;font-weight:700;color:${kc};min-width:28px;text-align:right;font-family:'DM Mono',monospace;">${kp}%</div>
      </div>`;
    }).join('');

    // Dairesel progress — pastada Düz. Performans gösterilir
    const displayPerf = vPerfDisplay !== null ? vPerfDisplay : performans;
    const displayCm   = vPerfDisplay !== null ? vcm : cm;
    const pAngle = Math.min(360, Math.round((Math.min(displayPerf, 150) / 150) * 360));

    return `
    <div style="background:${cm.bg};border:1.5px solid ${cm.accent}28;border-radius:14px;
      box-shadow:0 3px 16px ${cm.accent}1A;transition:transform .15s,box-shadow .15s;
      position:relative;overflow:hidden;display:flex;flex-direction:column;">
      <!-- Top accent bar -->
      <div style="height:4px;background:linear-gradient(90deg,${cm.accent},${cm.accent}88);border-radius:14px 14px 0 0;flex-shrink:0;"></div>

      <!-- Rank badge -->
      <div style="position:absolute;top:14px;right:14px;width:22px;height:22px;border-radius:50%;
        background:${cm.accent};color:#fff;display:flex;align-items:center;justify-content:center;
        font-size:9px;font-weight:700;font-family:'DM Mono',monospace;box-shadow:0 2px 6px ${cm.accent}44;">${globalIdx}</div>

      <!-- Header: avatar + isim + performans daire -->
      <div style="padding:14px 16px 12px;display:flex;align-items:center;gap:12px;">
        <div style="flex-shrink:0;">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,${cm.accent},${cm.accent}CC);
            display:flex;align-items:center;justify-content:center;
            font-size:15px;font-weight:800;color:#fff;
            box-shadow:0 4px 12px ${cm.accent}44;border:2px solid rgba(255,255,255,.6);">
            ${ini}
          </div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${row.ins}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:1px;">${row.gunSayisi || 0} gün · ${tarihDurumu}${azVeriMi(row.gunSayisi) ? ' ' + azVeriRozetiHtml('inline') : ''}</div>
          <div style="margin-top:5px;">
            <span style="font-size:9px;font-weight:700;background:${cm.badge};color:${cm.badgeTxt};
              padding:2px 7px;border-radius:8px;letter-spacing:.4px;">${cm.label}</span>
          </div>
        </div>
        <!-- Mini performans daire — sadece Düz. Performans -->
        <div style="flex-shrink:0;text-align:center;">
          <div style="width:64px;height:64px;border-radius:50%;
            background:conic-gradient(${displayCm.accent} ${pAngle}deg, #e2ecf8 0deg);
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 10px ${displayCm.accent}2A;">
            <div style="width:46px;height:46px;border-radius:50%;background:#fff;
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              box-shadow:inset 0 1px 3px rgba(0,0,0,.07);">
              <div style="font-size:13px;font-weight:800;color:${displayCm.accent};font-family:'DM Mono',monospace;line-height:1;">${displayPerf}%</div>
              <div style="font-size:7px;color:var(--muted);letter-spacing:.4px;text-transform:uppercase;">perf</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats: 2×2 grid -->
      <div style="padding:0 16px 10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${[
          ['📦','Adet',formatTR(row.adet||0)],
          ['📋','Kayıt',row.kayit||0],
          ['⏱','Standart',fmtSure(row.standartSure)],
          ['🕐','Mesai',fmtSure(row.mesaiSure) + (row.toplamMesaistiSaniye > 0 ? ` 🌙+${Math.round(row.toplamMesaistiSaniye/60)}dk` : '')]
        ].map(([ic,lb,val])=>`
          <div style="background:rgba(255,255,255,.75);border:1px solid var(--border2);border-radius:8px;
            padding:7px 8px;display:flex;align-items:center;gap:7px;">
            <span style="font-size:14px;">${ic}</span>
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;line-height:1.2;">${val}</div>
              <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;">${lb}</div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Klasman bars -->
      <div style="padding:0 16px 14px;border-top:1px solid ${cm.accent}14;margin-top:2px;padding-top:10px;">
        ${klasmanBars || `<div style="font-size:10px;color:var(--muted2);font-style:italic;text-align:center;padding:4px 0;">Klasman verisi yok</div>`}
      </div>
    </div>`;
  }).join('');

  // Sayfalama butonları HTML
  const pageBtns = (() => {
    let html = '';
    for (let p = 1; p <= totalPages; p++) {
      const active = p === _perfPage;
      html += `<button onclick="renderPerfTabloFromData(${p})"
        style="min-width:30px;height:30px;border-radius:7px;border:1px solid ${active ? 'var(--blue2)' : 'var(--border)'};
        background:${active ? 'var(--blue2)' : 'var(--white)'};color:${active ? '#fff' : 'var(--navy)'};
        cursor:pointer;font-size:12px;font-weight:${active ? '700' : '500'};padding:0 6px;
        transition:all .12s;">${p}</button>`;
    }
    return html;
  })();

  const verimlilikBaslik = hedef !== 100
    ? `⚡ Düz. Performans <span style="font-size:9px;color:var(--amber)">(Hedef %${hedef})</span>`
    : `⚡ Düz. Performans`;

  tablo.innerHTML = `
    <!-- RAPOR BAŞLIĞI -->
    <div style="padding:18px 22px;border-bottom:1px solid var(--border2);background:linear-gradient(135deg,var(--lblue3) 0%,#fff 70%);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:8px;">
            📊 Inspector Performans Raporu
            <span style="font-size:11px;font-weight:600;background:var(--blue2);color:#fff;padding:3px 10px;border-radius:99px;">${performansData.length} inspector</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;display:flex;gap:16px;flex-wrap:wrap;">
            <span><span data-i18n="adj_avg_short">⚡ Adj. Avg.:</span> <strong style="color:var(--amber)">${ortVPerf}%</strong></span>
            <span>📅 <span data-i18n='raw_avg'>Ham Ort.:</span> <strong style="color:var(--muted)">${ortPerformans}%</strong></span>
            <span><span data-i18n="avg_work_days">📆 Avg. Working:</span> <strong style="color:var(--navy)">${ortalamaGun} gün</strong></span>
          </div>
          <div style="font-size:10px;color:var(--green);margin-top:4px;">
            ✅ <span data-i18n='perf_formula'>Std Duration ÷ (Days × 7.5h) × 100</span>
            ${hedef !== 100 ? `&nbsp;·&nbsp; <span style="color:var(--amber)">⚡ <span data-i18n='adj_formula'>Raw Perf × (100÷${hedef})</span></span>` : ''}
          </div>
        </div>
        <!-- Özet stat kutuları -->
        <div style="display:flex;gap:10px;flex-shrink:0;">
          ${[
            ['🏆',(translations[currentLang]||translations.tr).perf_excellent,performansData.filter(r=>(r.genelHizPerf??0)>=95).length,'var(--green)','var(--lgreen)'],
            ['👍','İyi',performansData.filter(r=>{const p=r.genelHizPerf??0;return p>=85&&p<95}).length,'var(--blue)','var(--lblue2)'],
            ['⚠️',(translations[currentLang]||translations.tr).perf_average,performansData.filter(r=>{const p=r.genelHizPerf??0;return p>=70&&p<85}).length,'var(--amber)','var(--lamber)'],
            ['🔻',(translations[currentLang]||translations.tr).perf_weak,performansData.filter(r=>{const p=r.genelHizPerf??0;return p>=50&&p<70}).length,'#EF5350','#FFEBEE'],
            ['📉',(translations[currentLang]||translations.tr).perf_verypoor,performansData.filter(r=>(r.genelHizPerf??0)<50).length,'#B71C1C','#FFCDD2']
          ].map(([ic,lb,cnt,col,bg])=>`
            <div style="background:${bg};border:1px solid ${col}33;border-radius:10px;padding:10px 14px;text-align:center;min-width:54px;">
              <div style="font-size:16px;">${ic}</div>
              <div style="font-size:18px;font-weight:800;color:${col};font-family:'DM Mono',monospace;line-height:1;">${cnt}</div>
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">${lb}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- KARTLAR: 3 sütunlu grid -->
    <div style="padding:18px 22px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
      ${kartlar || '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted2);">Veri yok</div>'}
    </div>

    <!-- SAYFALAMA -->
    ${totalPages > 1 ? `
    <div style="padding:14px 22px 18px;border-top:1px solid var(--border2);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--offwhite);border-radius:0 0 var(--r) var(--r);">
      <button onclick="if(_perfPage>1)renderPerfTabloFromData(_perfPage-1)"
        ${_perfPage<=1?'disabled':''} class="pag-btn">← Önceki</button>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center;">
        ${pageBtns}
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="pag-info">${startIdx+1}–${Math.min(startIdx+_PERF_PER_PAGE,performansData.length)} / ${performansData.length}</span>
        <button onclick="if(_perfPage<${totalPages})renderPerfTabloFromData(_perfPage+1)"
          ${_perfPage>=totalPages?'disabled':''} class="pag-btn">Sonraki →</button>
      </div>
    </div>` : ''}
  `;

  tablo.style.display = 'block';
  empty.style.display = 'none';
}


// ════════════════════════════════════════════════════════════════════════════════
// ÖRNEKLEME TABLOSU
// ════════════════════════════════════════════════════════════════════════════════

// Bir Alttan tablosu: =EĞER(R<=20;R; EĞER(R<=32;20; EĞER(R<=50;20; EĞER(R<=80;32; EĞER(R<=125;50;80)))))
// Bir Alttan örnekleme tablosu
// BakilacakMiktar aralığı → kontrol edilecek adet
// ≤13→13, ≤20→20, ≤32→32, ≤50→32, ≤80→50, ≤125→80, ≤200→125, >200→200
const ORNEKLEME_BIR = [
  { max: 13,       val: 13  },
  { max: 20,       val: 20  },
  { max: 32,       val: 32  },
  { max: 50,       val: 32  },
  { max: 80,       val: 50  },
  { max: 125,      val: 80  },
  { max: 200,      val: 125 },
  { max: Infinity, val: 200 }
];

// İki Alttan örnekleme tablosu
// ≤13→13, ≤20→20, ≤32→32, ≤50→32, ≤80→32, ≤125→50, ≤200→80, >200→125
const ORNEKLEME_IKI = [
  { max: 13,       val: 13  },
  { max: 20,       val: 20  },
  { max: 32,       val: 32  },
  { max: 50,       val: 32  },
  { max: 80,       val: 32  },
  { max: 125,      val: 50  },
  { max: 200,      val: 80  },
  { max: Infinity, val: 125 }
];

function orneklemeAdet(adet, mod) {
  if (mod === 'kapali' || !mod) return adet;
  const tablo = mod === 'bir' ? ORNEKLEME_BIR : ORNEKLEME_IKI;
  for (const basamak of tablo) {
    if (adet <= basamak.max) {
      return basamak.val === null ? adet : basamak.val;
    }
  }
  return adet;
}

// ════════════════════════════════════════════════════════════════════════════════
// TARİHE GÖRE FARKLI ÖRNEKLEME SEVİYELERİ (Dönemler)
// ════════════════════════════════════════════════════════════════════════════════
// Aynı Excel dosyasında, farklı tarih aralıkları için farklı örnekleme modu
// kullanılabilmesi sağlanır (örn. 1-15 Ocak Kapalı, 16-28 Ocak Bir Alttan,
// 29 Ocak - 28 Şubat İki Alttan). En fazla 10 dönem desteklenir.
// Her dönem: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', mode: 'kapali'|'bir'|'iki' }
// ÖNEMLİ: Tarihli mod aktifken hiçbir döneme girmeyen satırlar hesaplamadan TAMAMEN ATLANIR.
const ORNEKLEME_DONEM_MAX = 10;
let orneklemeDonemleri = [];

function toggleOrneklemeDonemleri() {
  const aktif = document.getElementById('ornekleme-tarihli-aktif')?.checked;
  const wrap = document.getElementById('ornekleme-donemler-wrap');
  const tag  = document.getElementById('ornekleme-default-tag');
  if (wrap) wrap.style.display = aktif ? 'flex' : 'none';
  if (tag)  tag.style.display  = aktif ? 'inline-block' : 'none';
  if (aktif && orneklemeDonemleri.length === 0) {
    // İlk açılışta kullanım kolaylığı için bir dönem ekle
    orneklemeDonemleri.push({ start: '', end: '', mode: 'kapali', depolar: [] });
  }
  renderOrneklemeDonemleri();
  performansHesapla();
}

function addOrneklemeDonemi() {
  if (orneklemeDonemleri.length >= ORNEKLEME_DONEM_MAX) return;
  orneklemeDonemleri.push({ start: '', end: '', mode: 'kapali', depolar: [] });
  renderOrneklemeDonemleri();
  performansHesapla();
}

function removeOrneklemeDonemi(idx) {
  orneklemeDonemleri.splice(idx, 1);
  renderOrneklemeDonemleri();
  performansHesapla();
}

function onOrneklemeDonemChange(el) {
  const idx = parseInt(el.dataset.idx, 10);
  const field = el.dataset.field;
  if (!orneklemeDonemleri[idx]) return;
  orneklemeDonemleri[idx][field] = el.value;
  performansHesapla();
}

// Şu an yüklü Excel'deki (col-yapilan-depo sütunundaki) BENZERSİZ depo
// isimlerini döndürür — dönem satırlarındaki depo seçici checkbox'ları için.
function _bilinenDepolar() {
  const yapilanDepoCol = document.getElementById('col-yapilan-depo')?.value || '';
  if (!yapilanDepoCol || !excelRows || !excelRows.length) return [];
  const set = new Set();
  excelRows.forEach(row => {
    const v = String(row[yapilanDepoCol] ?? '').trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort((a,b) => a.localeCompare(b, 'tr'));
}

// Bir dönemin depo seçimini aç/kapat (tek bir depoya tıklanınca)
function toggleDonemDepo(idx, depoAdi) {
  const p = orneklemeDonemleri[idx];
  if (!p) return;
  if (!Array.isArray(p.depolar)) p.depolar = [];
  const i = p.depolar.indexOf(depoAdi);
  if (i >= 0) p.depolar.splice(i, 1);
  else p.depolar.push(depoAdi);
  renderOrneklemeDonemleri();
  performansHesapla();
}

// "Tümünü Seç" / "Hiçbirini Seçme" — bir dönemin depo listesini toplu ayarlar.
// Not: "Tümünü Seç" TÜM bilinen depoları TEK TEK listeye yazar (boş bırakmaz)
// — böylece kullanıcı sonradan sadece BİRİNİN işaretini kaldırarak "bu depo
// hariç hepsi" durumunu kolayca kurabilir.
function toggleDonemTumDepolar(idx, hepsiniSec) {
  const p = orneklemeDonemleri[idx];
  if (!p) return;
  p.depolar = hepsiniSec ? _bilinenDepolar() : [];
  renderOrneklemeDonemleri();
  performansHesapla();
}

function renderOrneklemeDonemleri() {
  const listEl = document.getElementById('ornekleme-donemler-list');
  const addBtn = document.getElementById('btn-ornekleme-donem-ekle');
  const maxHint = document.getElementById('ornekleme-donem-max-hint');
  if (!listEl) return;
  const t = translations[currentLang] || translations.tr;
  const bilinenDepolar = _bilinenDepolar();

  listEl.innerHTML = orneklemeDonemleri.map((p, idx) => {
    const depolarSecili = Array.isArray(p.depolar) ? p.depolar : [];
    const depoOzetHtml = depolarSecili.length === 0
      ? `<span style="font-size:10px;font-weight:700;color:#00897B;background:#E0F2F1;padding:2px 7px;border-radius:8px">🏭 Tüm depolar</span>`
      : `<span style="font-size:10px;font-weight:700;color:#8E24AA;background:#F3E5F5;padding:2px 7px;border-radius:8px">🏭 ${depolarSecili.length} depo seçili</span>`;

    const depoChecklistHtml = bilinenDepolar.length === 0
      ? `<div style="font-size:10px;color:var(--muted2);font-style:italic">Depo seçmek için önce Excel yükleyip "InspectionYapilanDepo" sütununu seçin.</div>`
      : `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px">
           <button type="button" onclick="toggleDonemTumDepolar(${idx}, true)" style="font-size:9.5px;border:1px solid #8E24AA;background:#fff;color:#8E24AA;border-radius:5px;padding:2px 7px;cursor:pointer">Tümünü Seç</button>
           <button type="button" onclick="toggleDonemTumDepolar(${idx}, false)" style="font-size:9.5px;border:1px solid var(--muted);background:#fff;color:var(--muted);border-radius:5px;padding:2px 7px;cursor:pointer">Hiçbirini Seçme (= Tüm Depolar)</button>
         </div>
         <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
           ${bilinenDepolar.map(depoAdi => {
             const secili = depolarSecili.includes(depoAdi);
             return `<label style="display:flex;align-items:center;gap:4px;font-size:10.5px;background:${secili ? '#F3E5F5' : '#F7F7F9'};border:1px solid ${secili ? '#CE93D8' : 'var(--border2)'};border-radius:6px;padding:3px 8px;cursor:pointer;margin:0">
               <input type="checkbox" ${secili ? 'checked' : ''} onchange="toggleDonemDepo(${idx}, '${depoAdi.replace(/'/g,"\\'")}')" style="width:12px;height:12px;margin:0;cursor:pointer">
               ${_escapeHtml(depoAdi)}
             </label>`;
           }).join('')}
         </div>`;

    return `
    <div style="background:#fff;border:1px solid #E1BEE7;border-radius:7px;padding:8px 10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:#8E24AA;min-width:14px">${idx + 1}.</span>
        <label style="font-size:10.5px;color:var(--muted);margin:0" data-i18n="sampling_period_start">${t.sampling_period_start}</label>
        <input type="date" data-idx="${idx}" data-field="start" value="${p.start || ''}" onchange="onOrneklemeDonemChange(this)" style="width:auto;padding:4px 6px;font-size:12px">
        <label style="font-size:10.5px;color:var(--muted);margin:0" data-i18n="sampling_period_end">${t.sampling_period_end}</label>
        <input type="date" data-idx="${idx}" data-field="end" value="${p.end || ''}" onchange="onOrneklemeDonemChange(this)" style="width:auto;padding:4px 6px;font-size:12px">
        <label style="font-size:10.5px;color:var(--muted);margin:0" data-i18n="sampling_period_mode">${t.sampling_period_mode}</label>
        <select data-idx="${idx}" data-field="mode" onchange="onOrneklemeDonemChange(this)" style="width:auto;padding:4px 8px;font-size:12px">
          <option value="kapali" ${p.mode === 'kapali' ? 'selected' : ''}>${t.mode_kapali}</option>
          <option value="bir" ${p.mode === 'bir' ? 'selected' : ''}>${t.mode_bir}</option>
          <option value="iki" ${p.mode === 'iki' ? 'selected' : ''}>${t.mode_iki}</option>
        </select>
        ${depoOzetHtml}
        <button type="button" onclick="removeOrneklemeDonemi(${idx})" title="${t.sampling_period_remove}" style="border:none;background:none;color:var(--red);cursor:pointer;font-size:14px;padding:2px 6px;margin-left:auto">✕</button>
      </div>
      <div style="border-top:1px dashed var(--border2);margin-top:8px;padding-top:6px">
        ${depoChecklistHtml}
      </div>
    </div>
  `;
  }).join('');

  if (addBtn) addBtn.style.display = orneklemeDonemleri.length >= ORNEKLEME_DONEM_MAX ? 'none' : '';
  if (maxHint) maxHint.style.display = orneklemeDonemleri.length >= ORNEKLEME_DONEM_MAX ? '' : 'none';
}

// Verilen tarih için, tarih aralıklı mod aktifse ve tarih bir döneme denk
// geliyorsa o dönemin örnekleme modunu döndürür. Aksi halde null döner
// (yani varsayılan/genel mod kullanılmalı).
// Tarihe göre dönem modu döndürür.
// Dönüş: dönem bulunduysa { mode, exclude: false }
//         tarihli mod aktif ama hiçbir döneme girmediyse { mode: null, exclude: true }
//         tarihli mod pasifse null (genel mod kullanılır)
// Verilen tarih (ve opsiyonel depo) için, tarih aralıklı mod aktifse ve
// tarih+depo bir döneme denk geliyorsa o dönemin örnekleme modunu döndürür.
// Her dönemin artık kendi "depolar" listesi var: boşsa (hiç depo seçilmemişse)
// o dönem TÜM depolar için geçerlidir — dolu ise SADECE listedeki depolar
// için geçerlidir (aynı tarih aralığını, farklı depo gruplarına farklı
// seviye vermek için birden fazla dönem satırı olarak ekleyebilirsiniz).
// Dönüş: dönem bulunduysa { mode, exclude: false }
//         tarihli mod aktif ama hiçbir döneme (tarih+depo) girmediyse { mode: null, exclude: true }
//         tarihli mod pasifse null (genel mod kullanılır)
function getOrneklemeModForDate(date, depo) {
  if (!date) return null;
  const aktif = document.getElementById('ornekleme-tarihli-aktif')?.checked;
  if (!aktif) return null;
  // Tüm dönemleri kontrol et
  const donemlerTamimli = orneklemeDonemleri.filter(p => p.start && p.end);
  for (const p of donemlerTamimli) {
    // Depo eşleşmesi: dönemin depolar listesi boşsa TÜM depolar için geçerli;
    // doluysa sadece listedekiler için geçerli.
    const depolarListesi = Array.isArray(p.depolar) ? p.depolar : [];
    if (depolarListesi.length > 0 && !depolarListesi.includes(depo)) continue;
    const [sy, sm, sd] = p.start.split('-').map(Number);
    const [ey, em, ed] = p.end.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const endDate   = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    if (date >= startDate && date <= endDate) return { mode: p.mode, exclude: false };
  }
  // Tarihli mod aktif ama bu tarih+depo hiçbir döneme girmiyor → satırı dışla
  if (donemlerTamimli.length > 0) return { mode: null, exclude: true };
  // Dönem tanımlanmamış → genel modu kullan (dışlama yok)
  return null;
}

function updateOrneklemeUI() {
  const mod = document.querySelector('input[name="ornekleme-mod"]:checked')?.value || 'kapali';
  const preview = document.getElementById('ornekleme-tablo-preview');
  const aciklama = document.getElementById('ornekleme-aciklama');
  if (!preview) return;

  if (mod === 'kapali') {
    preview.style.display = 'none';
    if (aciklama) aciklama.innerHTML = (translations[currentLang]||translations.tr).sampling_desc;
  } else {
    const tablo = mod === 'bir' ? ORNEKLEME_BIR : ORNEKLEME_IKI;
    const satirlar = tablo.map(b => `≤${b.max===Infinity?'∞':b.max}→${b.val===null?'R':b.val}`).join('  ');
    preview.style.display = 'block';
    preview.textContent = satirlar;
    if (aciklama) aciklama.innerHTML = mod === 'bir'
      ? '<strong>Bir Alttan:</strong> parti büyüklüğüne göre örneklem alınır.'
      : '<strong>İki Alttan:</strong> daha küçük örneklem — daha az kontrol adedi.';
  }
}

function performansHesapla(){
  const tablo=document.getElementById('perf-tablo');
  const empty=document.getElementById('perf-empty');

  if(!excelRows.length){
    tablo.style.display='none'; 
        empty.style.display='block'; 
    return;
  }

  // Excel/sütun seçimi değişmiş olabilir — dönem satırlarındaki depo
  // checklist'ini güncel bilinen depo isimleriyle tazele (görünürse).
  if (document.getElementById('ornekleme-tarihli-aktif')?.checked) {
    renderOrneklemeDonemleri();
  }

  const klasmanCol = document.getElementById('col-klasman')?.value;
  const insCol = document.getElementById('col-inspector')?.value;
  const adetCol = document.getElementById('col-adet')?.value;
  const baslangicCol = document.getElementById('col-baslangic')?.value || '';
  const bitisCol = document.getElementById('col-bitis')?.value || '';
  const mesaiCol = document.getElementById('col-mesai')?.value || '';
  const talepCol = document.getElementById('col-talep')?.value || '';
  // talepCol seçilmemişse Excel sütun adlarından otomatik bul
  const talepColFallback = talepCol || excelCols.find(c => {
    const norm = c.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ı/g,'i').replace(/ç/g,'c');
    return norm.includes('talepno') || norm.includes('talepnumarasi') || norm === 'talep';
  }) || '';
  const yapilanDepoCol = document.getElementById('col-yapilan-depo')?.value || '';
  const sonucCol = document.getElementById('col-sonuc')?.value || '';
  // "Inspection Tipi" sütununu otomatik bul (panelde ayrı seçim alanı yok)
  const inspectionTipiCol = excelCols.find(c => {
    const norm = c.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ı/g,'i').replace(/ç/g,'c');
    return norm.includes('inspectiontipi');
  }) || '';

  const orneklemeMod = document.querySelector('input[name="ornekleme-mod"]:checked')?.value || 'kapali';
  const verimlilikHedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);

  updateOrneklemeUI();

  // Verimlilik açıklama güncelle
  const vAciklama = document.getElementById('verimlilik-aciklama');
  if (vAciklama) {
    if (verimlilikHedef === 100) vAciklama.textContent = '';
    else if (verimlilikHedef < 100) vAciklama.textContent = `(%${verimlilikHedef} ${(translations[currentLang]||translations.tr).target_below_100} ${(100/verimlilikHedef).toFixed(2)}x) `;
    else vAciklama.textContent = `(%${verimlilikHedef} ${(translations[currentLang]||translations.tr).target_above_100} ${(100/verimlilikHedef).toFixed(2)}x) `;
  }

  if(!klasmanCol || !insCol || !adetCol){
    showFileStatus((translations[currentLang]||translations.tr).col_select_warning, 'var(--amber)');
    return;
  }

  // Klasman mapping hazırla
  // Ölçü tablosu: BakilacakMiktar → ölçülecek adet
  function getOlcuAdet(adet) {
    if (adet <= 32)  return 6;
    if (adet <= 50)  return 9;
    if (adet <= 80)  return 9;
    if (adet <= 125) return 9;
    return 12;
  }

  // Ürün Kabul katsayısı: BakilacakMiktar → kaç kat
  function getUrunKabulKat(adet) {
    if (adet <= 32)  return 0.5;
    if (adet <= 80)  return 1.1;
    if (adet <= 125) return 1.2;
    return 1.3;
  }

  function normalize(str) { return String(str).toLowerCase().trim().replace(/[^\w]/g,''); }
  const klasmanMap = {};
  klasmanlar.forEach(k => {
    const normalKey = normalize(k.ad);
    klasmanMap[normalKey] = {
      urunKontrolSuresi: parseFloat(k.urunKontrolSuresi) || 0,
      olcuSuresi: parseFloat(k.olcuSuresi) || 0,
      urunKabulSuresi: parseFloat(k.urunKabulSuresi) || 0,
      istasyonSuresi: k.istasyonlar.reduce((s,i)=>s+(parseFloat(i.sure)||0),0),
      istasyonDetay: k.istasyonlar.map(i => ({ ad: i.ad, sure: parseFloat(i.sure)||0 }))
    };
  });

  const inspectorMap = {};
  const eslesmeyenKlasmanlar = new Set();
  let basariliTarihKayitlar = 0;
  let tarihHataliKayitlar = 0;

  let kaldiSatirSayisi = 0;

  // ── ÇAKIŞMA DÜZELTMESİ (Sistematik Geç Kapanış Normalizasyonu) ───────────
  // Sorun: Sistemsel hata nedeniyle bir siparişin kapanışı sisteme yansımamış
  // ve inspector saatlerce sonra fark edip tekrar göndermiş olabilir.
  // Bu durumda önceki kaydın bitiş saati, bir sonraki kaydın başlangıç saatinden
  // BÜYÜK çıkar (çakışma) — bu yapay bir geç kapanış süresidir.
  //
  // Düzeltme kuralı: Aynı inspector'ın aynı gündeki kayıtları başlangıç saatine
  // göre sıralandığında, bir kaydın bitiş saati bir sonraki kaydın başlangıç
  // saatinden büyükse → o kaydın bitiş saatini bir sonraki kaydın başlangıç
  // saatiyle eşitle. Böylece gerçek çalışma süresi doğru hesaplanır.
  //
  // Sonuç: (baslangicTarih, bitisTarih) → düzeltilmiş bitiş tarihi
  // Map anahtarı: "inspector|gün|başlangıçMs" → düzeltilmiş bitis Date nesnesi
  const _duzeltilmisBitisMap = new Map(); // key: rowIndex, val: Date

  // 1. Tüm satırları önceden parse et
  const _rowMeta = excelRows.map((row, idx) => {
    const ins = String(row[insCol]||'').trim();
    const baslangicTarih = baslangicCol ? row[baslangicCol] : null;
    const bitisTarih = bitisCol ? row[bitisCol] : null;
    const parsedBas = baslangicTarih ? parseFlexibleDate(baslangicTarih) : null;
    const parsedBit = bitisTarih ? parseFlexibleDate(bitisTarih) : null;
    return { idx, ins, parsedBas, parsedBit };
  });

  // 2. Inspector bazında grupla (UTC kaymasını önlemek için yerel tarih kullan)
  // NOT: toISOString() UTC döndürür — Türkiye UTC+3 olduğu için 00:00-02:59
  // arası başlayan kayıtlar önceki güne atanır. Bunun yerine yerel yıl/ay/gün
  // kullanarak doğru gruplama yapıyoruz.
  // Ayrıca gruplama SADECE inspector bazında yapılır; gün ayrımı yapılmaz.
  // Çünkü bir inspection farklı bir günde başlayıp farklı bir günde bitebilir
  // ve cross-day çakışmalar da yakalanmalıdır. Sıralama zaten timestamp ile
  // yapıldığından farklı günlerdeki kayıtlar da doğru sıralanır.
  const _insGunGruplari = {};
  _rowMeta.forEach(m => {
    if (!m.ins || !m.parsedBas || !m.parsedBit) return;
    // Yerel tarihi al (UTC kayması yok)
    const y   = m.parsedBas.getFullYear();
    const mo  = String(m.parsedBas.getMonth() + 1).padStart(2, '0');
    const d   = String(m.parsedBas.getDate()).padStart(2, '0');
    const gun = `${y}-${mo}-${d}`; // yerel YYYY-MM-DD
    const key = m.ins + '|' + gun;
    if (!_insGunGruplari[key]) _insGunGruplari[key] = [];
    _insGunGruplari[key].push(m);
  });

  // 3. Her grupda başlangıç TAM TIMESTAMP'e göre sırala, çakışmaları düzelt
  // Karşılaştırma tarih+saat bazında yapılır (sadece saat değil, tam Date nesnesi).
  // Zincirleme düzeltme: A→B→C üçlüsünde A'nın düzeltilmiş bitişi B'nin
  // başlangıcından büyükse tekrar kırpılır.
  Object.values(_insGunGruplari).forEach(grup => {
    // Tam timestamp ile sırala (tarih + saat + dakika + saniye)
    grup.sort((a, b) => a.parsedBas.getTime() - b.parsedBas.getTime());
    for (let i = 0; i < grup.length - 1; i++) {
      const current = grup[i];
      const next    = grup[i + 1];
      // Effective bitiş: önceden düzeltilmişse onu kullan (zincirleme için)
      const effBit = _duzeltilmisBitisMap.has(current.idx)
        ? _duzeltilmisBitisMap.get(current.idx)
        : current.parsedBit;
      // Çakışma kontrolü: tam tarih+saat karşılaştırması
      // effBit > next.parsedBas → sonraki inspection başlamadan current bitmemiş
      if (effBit.getTime() > next.parsedBas.getTime()) {
        // Düzeltme: current bitiş = next başlangıç (tarih+saat tam eşleşme)
        _duzeltilmisBitisMap.set(current.idx, next.parsedBas);
        console.log(
          `⚠️ Çakışma düzeltildi [${current.ins}]: ` +
          `${effBit.toLocaleString('tr-TR')} → ` +
          `${next.parsedBas.toLocaleString('tr-TR')} ` +
          `(sonraki başlangıç: ${next.parsedBas.toLocaleString('tr-TR')})`
        );
      }
    }
  });
  // ── ÇAKIŞMA DÜZELTMESİ SONU ─────────────────────────────────────────────

  excelRows.forEach((row, _rowIdx) => {
    const excelKlasman = String(row[klasmanCol]||'').trim();
    const ins = String(row[insCol]||'').trim();
    const adetHam = parseFloat(row[adetCol])||0;
    const baslangicTarih = baslangicCol ? row[baslangicCol] : null;
    const bitisTarih = bitisCol ? row[bitisCol] : null;
    const mesaiHam = mesaiCol ? row[mesaiCol] : null;

    // Tarihleri en başta parse et — örnekleme modu seçimi için de kullanılır
    const parsedBaslangic = baslangicTarih ? parseFlexibleDate(baslangicTarih) : null;
    const parsedBitisTaslak = bitisTarih ? parseFlexibleDate(bitisTarih) : null;
    // Çakışma varsa düzeltilmiş bitiş saatini kullan
    const parsedBitis = _duzeltilmisBitisMap.has(_rowIdx)
      ? _duzeltilmisBitisMap.get(_rowIdx)
      : parsedBitisTaslak;
    const tarihGecerli = parsedBaslangic && parsedBitis &&
                         parsedBitis > parsedBaslangic &&
                         parsedBaslangic.getFullYear() > 2000;

    // InspectionYapilanDepo değerini ÖNCE oku — dönem bazlı örnekleme modu
    // seçiminde de kullanılır (her dönem artık kendi "depolar" listesine sahip).
    const depoValErken = yapilanDepoCol ? String(row[yapilanDepoCol] ?? '').trim() : '';

    // Örnekleme modu önceliği:
    // 1) Varsayılan: yukarıdaki genel mod (radio)
    // 2) Tarih aralıklı mod aktifse ve satırın başlangıç tarihi VE deposu bir
    //    döneme denk geliyorsa (her dönem hem tarih hem depo listesi taşır)
    //    o dönemin modu kullanılır
    // 3) InspectionSonuc "Kaldı" ise her durumda Kapalı (en yüksek öncelik —
    //    tüm adet kontrol edilmeli)
    let satırOrneklemeMod = orneklemeMod;
    const donemSonuc = getOrneklemeModForDate(parsedBaslangic, depoValErken);
    if (donemSonuc !== null) {
      if (donemSonuc.exclude) return; // Bu satır hiçbir döneme girmiyor → tamamen atla
      satırOrneklemeMod = donemSonuc.mode;
    }
    if (sonucCol) {
      const sonucRaw = String(row[sonucCol] || '').trim();
      // Türkçe karakter duyarsız karşılaştırma (ı→i, İ→i, ğ→g vs.)
      const sonucNorm = sonucRaw.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/İ/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ç/g,'c');
      if (sonucNorm === 'kaldi' || sonucNorm.includes('kaldi')) {
        satırOrneklemeMod = 'kapali';
        kaldiSatirSayisi++;
      }
    }

    const adet = orneklemeAdet(adetHam, satırOrneklemeMod);

    // InspectionYapilanDepo filtresi: sütun seçiliyse boş satırları atla
    if (yapilanDepoCol) {
      if (!depoValErken) return;
    }

    if(!excelKlasman || !ins || !adet) return;
    
    const klasmanKey = normalize(excelKlasman);
    const klasmanInfo = klasmanMap[klasmanKey];
    
    if(!klasmanInfo) {
      eslesmeyenKlasmanlar.add(excelKlasman);
      return;
    }
    
    if(!inspectorMap[ins]) {
      inspectorMap[ins] = {
        ins: ins,
        klasmanlar: {},
        toplamAdet: 0,
        toplamOvertimeAdet: 0, // Overtime (16:45 sonrası) döneminde kontrol edilen toplam adet — yalnızca gösterim/rapor amaçlı
        kayitListesi: [],
        mesaiSureSn: null
      };
    }
    
    // Mesai süresini parse et
    if (mesaiHam !== null && mesaiHam !== undefined && mesaiHam !== '') {
      const parsedMesai = parseMesaiSuresi(mesaiHam);
      if (parsedMesai && parsedMesai > 0) {
        if (inspectorMap[ins].mesaiSureSn === null || parsedMesai > inspectorMap[ins].mesaiSureSn) {
          inspectorMap[ins].mesaiSureSn = parsedMesai;
        }
      }
    }

    if (tarihGecerli) {
      const zatenVar = inspectorMap[ins].kayitListesi.some(
        r => r.parsedBaslangic.getTime() === parsedBaslangic.getTime() &&
             r.parsedBitis.getTime()     === parsedBitis.getTime()
      );
      if (!zatenVar) inspectorMap[ins].kayitListesi.push({ parsedBaslangic, parsedBitis });
      basariliTarihKayitlar++;
    } else {
      tarihHataliKayitlar++;
    }

    // Standart süre hesaplama (adet sayısına bakılmaksızın aynı formül):
    // (kontrol süresi × adet) + ölçü eki + ürün kabul eki + istasyon süresi
    const olcuAdet = getOlcuAdet(adet);
    const urunKabulKat = getUrunKabulKat(adet);
    const olcuEk = olcuAdet * (klasmanInfo.olcuSuresi || 0);
    const urunKabulEk = urunKabulKat * (klasmanInfo.urunKabulSuresi || 0);
    let standartSure = (klasmanInfo.urunKontrolSuresi * adet) + olcuEk + urunKabulEk + klasmanInfo.istasyonSuresi;

    // Bu kaydın fiili süresi = başlangıç-bitiş farkı (mola düşümlü)
    const kayitFiiliSure = tarihGecerli
      ? hesaplaGerceklesenSure(parsedBaslangic, parsedBitis)
      : null;

    // ── KISA KAYIT TAVANLAMASI ──────────────────────────────────────────
    // Gerçekleşen süresi ≤ 10dk (600sn) olan kayıtlarda standart süre bazen
    // çok yüksek çıkıp (ör. küçük partide ölçü/ürün kabul ekleri orantısız
    // büyüyünce) oran %500+ gibi gerçekçi olmayan değerlere ulaşabiliyor.
    // Hesaplama sistemi DEĞİŞMİYOR — yalnızca bu kaydın genel performansa
    // (toplamStandartSure'a) giren payı, kendi gerçekleşen süresiyle tavanlanır
    // ki oran hiçbir zaman %100'ü geçerek genel ortalamayı yapay şişirmesin.
    if (kayitFiiliSure !== null && kayitFiiliSure > 0 && kayitFiiliSure <= 600 && standartSure > kayitFiiliSure) {
      standartSure = kayitFiiliSure;
    }

    // "Inspection Tipi" sütunu — sadece izleme/raporlama amaçlı okunur.
    // Standart süre / performans hesabını ETKİLEMEZ; tüm kayıtlar aynı
    // formülden geçer (kalite ayrımı yok). "2.Kalite" ile başlayan değerler
    // sadece UI'da ayrıca işaretlenmesi için bayraklanır.
    const inspectionTipiRaw = inspectionTipiCol ? String(row[inspectionTipiCol] || '').trim() : '';
    const is2Kalite = inspectionTipiRaw.toLocaleLowerCase('tr-TR').startsWith('2.kalite');

    const klasmanKey2 = excelKlasman;
    if (!inspectorMap[ins].klasmanlar[klasmanKey2]) {
      inspectorMap[ins].klasmanlar[klasmanKey2] = {
        kayitlar: [],
        toplamAdet: 0,
        toplamStandartSure: 0,
        toplamKayitFiiliSure: 0
      };
    }
    const kl = inspectorMap[ins].klasmanlar[klasmanKey2];

    // 2.Kalite kayıtları VARSAYILAN OLARAK genel performans hesabından TAMAMEN
    // hariç tutulur (ne adet/standart süre payına, ne mesai/overtime paydasına
    // dahil edilir) — sadece kendi ayrı toplamlarında (toplam2Kalite*) izlenir.
    // KULLANICI TOGGLE'I: "2.Kalite ürünleri Genel Performansa dahil et" işaretliyse
    // (_2KaliteDahil === true) 2.Kalite kayıtları da DİĞER KAYITLARLA AYNI ŞEKİLDE
    // normal akışa girer — bu durumda mevcut davranış hiç değişmez (her şey tek
    // bir akıştan geçer, ayrım yapılmaz). Varsayılan (false) durumda eski/mevcut
    // çalışan mantık birebir korunur.
    if (is2Kalite && !_2KaliteDahil) {
      kl.toplam2KaliteAdet = (kl.toplam2KaliteAdet || 0) + adet;
      kl.toplam2KaliteStandartSure = (kl.toplam2KaliteStandartSure || 0) + standartSure;
      if (kayitFiiliSure && kayitFiiliSure > 0) {
        kl.toplam2KaliteFiiliSure = (kl.toplam2KaliteFiiliSure || 0) + kayitFiiliSure;
      }
    } else {
      // Overtime toggle kontrolü: kapalıysa overtime kayıtları hesaba girmesin
      const kayitNormalSayilir = kayitNormalMi(parsedBitis);
      if (!_overtimeDahil && !kayitNormalSayilir) {
        // Overtime kaydı, toggle kapalı → atla (ne adet ne standart süre ekleme)
        kl.toplamStandartSureOvertime = (kl.toplamStandartSureOvertime||0) + standartSure;
      } else {
        kl.toplamAdet += adet;
        kl.toplamStandartSure += standartSure;
        if (kayitFiiliSure && kayitFiiliSure > 0) {
          kl.toplamKayitFiiliSure += kayitFiiliSure;
        }
        if (kayitNormalSayilir) {
          kl.toplamStandartSureNormal = (kl.toplamStandartSureNormal||0) + standartSure;
        } else {
          kl.toplamStandartSureOvertime = (kl.toplamStandartSureOvertime||0) + standartSure;
        }
      }
    }
    const kayitNormalSayilir = kayitNormalMi(parsedBitis);
    kl.kayitlar.push({ no: kl.kayitlar.length + 1, klasman: excelKlasman, adet, standartSure, kayitFiiliSure, kontrolAdetSuresi: klasmanInfo.urunKontrolSuresi, istasyonSuresi: klasmanInfo.istasyonSuresi, istasyonDetay: klasmanInfo.istasyonDetay || [], baslangic: parsedBaslangic, bitis: parsedBitis, tarihGecerli, normalMesai: kayitNormalSayilir, talepNo: talepColFallback ? String(row[talepColFallback]||'').trim() : '', inspectionTipi: inspectionTipiRaw, is2Kalite });

    // Overtime'da (16:45 sonrası) kontrol edilen toplam adedi ayrıca izle —
    // yalnızca gösterim/rapor amaçlı, mevcut performans hesaplarını etkilemez.
    if (!kayitNormalSayilir) {
      inspectorMap[ins].toplamOvertimeAdet = (inspectorMap[ins].toplamOvertimeAdet || 0) + adet;
    }

    if (is2Kalite && !_2KaliteDahil) {
      // toplamAdet'e eklenmedi (yukarıda hariç tutuldu)
    } else {
      // Overtime toggle kapalıysa overtime kayıtları adet toplamına da girmesin
      const kayitNormalSayilir2 = kayitNormalMi(parsedBitis);
      if (!_overtimeDahil && !kayitNormalSayilir2) {
        // overtime kaydı, toggle kapalı → atla
      } else {
        inspectorMap[ins].toplamAdet += adet;
      }
    }
  });

  // Kaldı özet göstergesi güncelle
  const kaldiOzet = document.getElementById('sonuc-kaldi-ozet');
  if (kaldiOzet) {
    if (sonucCol && kaldiSatirSayisi > 0) {
      kaldiOzet.style.display = 'block';
      kaldiOzet.textContent = '🔴 ' + kaldiSatirSayisi + ' satır "Kaldı" → Kapalı mod uygulandı';
    } else {
      kaldiOzet.style.display = 'none';
    }
  }

  // Inspector bazında sonuç map'i oluştur
  const map = {};
  Object.values(inspectorMap).forEach(inspectorData => {
    const ins = inspectorData.ins;
    const klasmanlarObj = {};

    // Inspector'ın tüm tarih dilimlerinden gerçek çalışma süresini hesapla (saniye)
    const fiiliSureSn = hesaplaInspectorFiiliSure(inspectorData.kayitListesi);
    
    // Günlük mesai hesaplama
    const mesaiHesap = hesaplaGunlukMesaiSuresi(inspectorData.kayitListesi);
    
    let toplamStandartSure = 0;   
    let toplamAdet = 0;
    let toplamKayitFiiliSure = 0; 
    let toplamStandartSureNormal = 0;   // Sadece normal mesai (08:00-16:45) icindeki standart sure
    let toplamStandartSureOvertime = 0; // Sadece overtime (16:45-20:00) icindeki standart sure
    let toplam2KaliteAdet = 0;          // 2.Kalite kontrollerinin toplam adedi (yalnızca gösterim)
    let toplam2KaliteStandartSure = 0;  // 2.Kalite kontrollerinin toplam standart süresi (yalnızca gösterim)
    let toplam2KaliteFiiliSure = 0;     // 2.Kalite kontrollerinin toplam gerçekleşen süresi (yalnızca gösterim)

    Object.entries(inspectorData.klasmanlar).forEach(([klasman, kl]) => {
      toplamStandartSure += kl.toplamStandartSure;
      toplamAdet += kl.toplamAdet;
      toplamKayitFiiliSure += (kl.toplamKayitFiiliSure || 0);
      toplamStandartSureNormal   += (kl.toplamStandartSureNormal || 0);
      toplamStandartSureOvertime += (kl.toplamStandartSureOvertime || 0);
      toplam2KaliteAdet         += (kl.toplam2KaliteAdet || 0);
      toplam2KaliteStandartSure += (kl.toplam2KaliteStandartSure || 0);
      toplam2KaliteFiiliSure    += (kl.toplam2KaliteFiiliSure || 0);

      // Klasman bazında hızPerf: bu klasmanın standart süresi / tüm inspector standart süresi × genel performans
      // (Genel performans henüz hesaplanmadığından burada geçici saklarız, aşağıda düzeltiriz)
      const hizPerf = 0; // placeholder — aşağıda genel performans belli olunca güncellenir

      klasmanlarObj[klasman] = {
        adet: kl.toplamAdet,
        standartSure: kl.toplamStandartSure,
        kayitFiiliSure: kl.toplamKayitFiiliSure || 0,
        hizPerf,
        hacimPerf: null,
        kayitlar: kl.kayitlar,  // Kayıt bazlı detay için
        toplam2KaliteAdet: kl.toplam2KaliteAdet || 0,
        toplam2KaliteStandartSure: kl.toplam2KaliteStandartSure || 0,
        toplam2KaliteFiiliSure: kl.toplam2KaliteFiiliSure || 0
      };
    });

    // Tek Performans Metriği - Mesai Bazlı
    let mesaiSureSn;
    let performans = null;

    // Mesaiyi hesapla
    if (inspectorData.mesaiSureSn && inspectorData.mesaiSureSn > 0) {
      mesaiSureSn = inspectorData.mesaiSureSn;
    } else if (mesaiHesap && mesaiHesap.toplamMesaiSaniye > 0) {
      mesaiSureSn = mesaiHesap.toplamMesaiSaniye;
    } else {
      mesaiSureSn = fiiliSureSn;
    }

    // ── KAYIP ZAMAN: BURADA DÜŞÜLMÜYOR (kasıtlı) ────────────────────────
    // Ana performans (genelHizPerf) kayıp zamandan tamamen bağımsız/ham
    // tutulur — kayipZamanData ile performansData/mesaiSure ayrı veri
    // yapılarıdır, burada karıştırılmaz. "Ne ödül ne ceza" ilkesiyle kayıp
    // zaman düzeltmesi SADECE getDuzeltilmisPerformans() içinde, her
    // seferinde GÜNCEL kayipZamanData ile canlı hesaplanır (Kayıp Zaman
    // sekmesi). Böylece Excel'den SONRA girilen kayıp zaman kayıtları da
    // doğru yansır ve aynı düşüm iki kez uygulanmaz (double-counting olmaz).

    // Toplam performansı hesapla
    // _overtimeDahil = false (varsayılan): overtime kayıtları zaten yukarıda
    // hesaba katılmadı (adet ve standart süre hariç tutuldu). Mesai paydasından
    // da overtime saatlerini düş → sadece normal mesai üzerinden hesapla.
    // _overtimeDahil = true: tüm kayıtlar dahil, tüm mesai paydaya girer.
    const overtimeSn = mesaiHesap ? (mesaiHesap.toplamMesaistiSaniye || 0) : 0;
    const normalMesaiSn = mesaiSureSn - overtimeSn;
    const performansPaydasi = _overtimeDahil
      ? mesaiSureSn
      : (normalMesaiSn > 0 ? normalMesaiSn : mesaiSureSn);

    if (performansPaydasi && performansPaydasi > fiiliSureSn * 0.1) {
      performans = Math.round((toplamStandartSure / performansPaydasi) * 100);
    } else {
      performans = null;
    }

    // Klasman hizPerf düzeltmesi: her klasmanın standart süresi / toplam standart süre × genel performans
    // Böylece günün tüm mesaisi tek klasmana yüklenmez; çoklu klasman çalışan inspector'da hakkaniyet sağlanır
    if (performans !== null && toplamStandartSure > 0) {
      Object.keys(klasmanlarObj).forEach(k => {
        const oran = klasmanlarObj[k].standartSure / toplamStandartSure;
        klasmanlarObj[k].hizPerf = Math.round(oran * performans);
      });
    }

    // Overtime performansi: sadece 16:45 sonrasi calisilan sure ve o surede tamamlanan standart sure
    const overtimeMesaiSn = mesaiHesap ? (mesaiHesap.toplamMesaistiSaniye || 0) : 0;
    const overtimePerformans = (overtimeMesaiSn > 0 && toplamStandartSureOvertime > 0)
      ? Math.round((toplamStandartSureOvertime / overtimeMesaiSn) * 100)
      : null;

    // 2.Kalite kontrollerinin KENDİ performansı — yalnızca gösterim amaçlı.
    // Genel "Düz. Performans" (mesai bazlı) hesabına dahil EDİLMEZ; sadece
    // 2.Kalite satırlarının standart süresi / gerçekleşen süresi oranı olarak hesaplanır.
    const perf2Kalite = (toplam2KaliteFiiliSure > 0)
      ? Math.round((toplam2KaliteStandartSure / toplam2KaliteFiiliSure) * 100)
      : null;

    map[ins] = {
      ins: ins,
      adet: toplamAdet,
      fiiliSure: fiiliSureSn,                  // Sadece gösterim için
      kayitFiiliSure: toplamKayitFiiliSure,    // Debug için
      standartSure: toplamStandartSure,        
      mesaiSure: mesaiSureSn,                  
      kayit: Object.values(inspectorData.klasmanlar).reduce((s,k)=>s+k.kayitlar.length,0),
      klasmanlar: klasmanlarObj,
      // Tek performans metriği
      genelHizPerf: performans,           // Mesai bazlı performans
      genelPerformans: performans,        // Aynı değer
      genelHacimPerf: null,
      // Overtime ayrimi
      standartSureNormal: toplamStandartSureNormal,
      standartSureOvertime: toplamStandartSureOvertime,
      overtimeMesaiSure: overtimeMesaiSn,
      overtimePerformans: overtimePerformans,
      // Verimlilik düzeltmeli performans
      verimlilikPerf: performans !== null ? Math.round(performans * (100 / verimlilikHedef)) : null,
      hedefVerimlilik: verimlilikHedef,
      tarihBasariliKayit: inspectorData.kayitListesi.length,
      gunSayisi: mesaiHesap ? mesaiHesap.gunSayisi : 0,
      gunlukDetay: mesaiHesap ? mesaiHesap.gunlukDetay : [],
      toplamMesaistiSaniye: mesaiHesap ? (mesaiHesap.toplamMesaistiSaniye || 0) : 0,
      gunlukOvertimeDetay: mesaiHesap ? (mesaiHesap.gunlukOvertimeDetay || {}) : {},
      // 2.Kalite — yalnızca gösterim, genel performansa dahil değil
      toplam2KaliteAdet: toplam2KaliteAdet,
      toplam2KaliteStandartSure: toplam2KaliteStandartSure,
      toplam2KaliteFiiliSure: toplam2KaliteFiiliSure,
      perf2Kalite: perf2Kalite,
      // Overtime'da kontrol edilen toplam adet — yalnızca gösterim/rapor amaçlı
      toplamOvertimeAdet: inspectorData.toplamOvertimeAdet || 0
    };

    
    // Debug log
    console.log(`[${ins}] Gün:${mesaiHesap?.gunSayisi || 0} Standart:${Math.round(toplamStandartSure/60)}dk Mesai:${Math.round(mesaiSureSn/60)}dk Mesaisti:${Math.round((mesaiHesap?.toplamMesaistiSaniye||0)/60)}dk Performans:${performans}% VPerf:${performans !== null ? Math.round(performans*(100/verimlilikHedef)) : null}%`);
  });

  const liste = Object.values(map).sort((a, b) => {
    const perfA = a.genelHizPerf ?? 0;
    const perfB = b.genelHizPerf ?? 0;
    return perfB - perfA;
  });

  if(!liste.length){ 
    tablo.style.display='none'; 
    empty.style.display='block'; 
    showFileStatus((translations[currentLang]||translations.tr).no_data_processable, 'var(--red)');
    return; 
  }

  // Performans verilerini güncelle
  performansData = liste;

  // Yeni bir yükleme başlıyor — önceki Temizle iptalini sıfırla
  window._uploadAborted = false;

  // NOT: Otomatik Sheets gönderimi KALDIRILDI.
  // Her hesaplamada (sütun değişimi, örnekleme modu, tarih aralığı vb.)
  // Google Sheets'e otomatik yazma yapılmaz. Veri sadece "📤 Sheets'e Gönder"
  // butonuna (pushPerformansManual) basıldığında gönderilir. Bu sayede:
  //  - Ayar değiştirirken Sheets'e art arda istek atılmaz (race condition önlenir)
  //  - Detay modalında yanlışlıkla eski/yarım veri görünmesi engellenir
  
  const satirlar=liste.map((row,i)=>{
    const ini=row.ins.split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
    
    const performans = row.genelHizPerf ?? 0;
    const performansClass = getPerformanceClass(performans);
    
    const klasmanDetay = Object.entries(row.klasmanlar)
      .map(([k,v]) => {
        const klasmanPerf = v.hizPerf ?? 0;
        return `${k}: ${v.adet} adet (${klasmanPerf}%)`;
      })
      .join('<br>');
    
    const fmtSure = (sn) => {
      if (!sn) return '—';
      const s = Math.round(sn);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sc = s % 60;
      return h > 0
        ? `${h}s ${String(m).padStart(2,'0')}d ${String(sc).padStart(2,'0')}sn`
        : `${m}d ${String(sc).padStart(2,'0')}sn`;
    };
    
    const tarihDurumu = row.tarihBasariliKayit > 0 ? `✅ ${row.tarihBasariliKayit}/${row.kayit}` : `⚠️ Tarih yok`;
    const vPerf = row.verimlilikPerf;
    const vPerfClass = vPerf === null ? '' : getPerformanceClass(vPerf);
    const verimlilikHedef3 = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
    
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:9px">
        <div class="avatar">${ini}</div>
        <div>
          <strong style="font-size:13px">${row.ins}</strong>
          <div style="font-size:10px;color:var(--muted2)">${row.gunSayisi || 0} ${(translations[currentLang]||translations.tr).working} · ${tarihDurumu}</div>
        </div>
      </div></td>
      <td style="color:var(--muted);font-family:'DM Mono',monospace">${row.kayit}</td>
      <td style="font-family:'DM Mono',monospace">${row.adet.toFixed(0)}</td>
      <td style="font-family:'DM Mono',monospace">${fmtSure(row.standartSure)}</td>
      <td style="font-family:'DM Mono',monospace">${fmtSure(row.mesaiSure)}</td>
      <td style="font-family:'DM Mono',monospace">
        <div>
          <span class="${performansClass}" style="font-weight:700;font-size:14px">${performans !== null ? performans+'%' : '—'}</span>
          <div style="font-size:9px;color:var(--muted);margin-top:1px">
            ${row.gunSayisi || 0} ${(translations[currentLang]||translations.tr).days_x_formula.replace('{h}', Math.round((row.mesaiSure||0)/3600))}
          </div>
        </div>
      </td>
      <td style="font-family:'DM Mono',monospace;background:${verimlilikHedef3 !== 100 ? 'linear-gradient(135deg,#FFFDE7,#fff)' : 'transparent'}">
        <div>
          <span class="${vPerfClass}" style="font-weight:700;font-size:14px">${vPerf !== null ? vPerf+'%' : '—'}</span>
          <div style="font-size:9px;color:var(--muted);margin-top:1px">
            ${performans !== null && verimlilikHedef3 !== 100 ? `${performans}% × (100÷${verimlilikHedef3})` : verimlilikHedef3 === 100 ? 'Hedef=%100 (aynı)' : '—'}
          </div>
        </div>
      </td>
      <td style="font-size:11px;color:var(--muted2);max-width:200px" title="${klasmanDetay.replace(/<br>/g, ', ')}">${klasmanDetay}</td>
    </tr>`;
  }).join('');

  const toplamKayit = excelRows.filter(row => {
    const excelKlasman = String(row[klasmanCol]||'').trim();
    const klasmanKey = normalize(excelKlasman);
    return klasmanMap[klasmanKey];
  }).length;

  const ortPerformans = liste.length > 0 ?
    Math.round(liste.reduce((sum, row) => sum + (row.genelHizPerf ?? 0), 0) / liste.length) : 0;

  const ortalamaGun = liste.length > 0 ? 
    Math.round(liste.reduce((sum, row) => sum + (row.gunSayisi || 0), 0) / liste.length) : 0;

  const ortVPerf = liste.length > 0 ?
    Math.round(liste.reduce((sum, row) => sum + (row.verimlilikPerf ?? 0), 0) / liste.length) : 0;

  // Verimlilik ortalama kutusunu güncelle
  const vOrtEl = document.getElementById('verimlilik-ort');
  if (vOrtEl) {
    vOrtEl.textContent = ortVPerf + '%';
    vOrtEl.style.color = getProgressColor(ortVPerf);
  }

  const verimlilikHedef2 = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);

  // performansData güncellendi; sayfalı kart renderını çağır
  _perfPage = 1;
  renderPerfTabloFromData(1);
  tablo.style.display='block';
  empty.style.display='none';
  
  updateSidebar();
  renderDashboard();

  // _usersCache'i arka planda önceden yükle — "Diğer Ekipler" butonu anında açılsın
  if (!_usersCache.length) _silentLoadUsersCache();

  // PerformansRaw'ı Sheets'e otomatik push et (overtime, mesai vb. tüm alanlarla)
  // Bu sayede "Sheets'ten Çek" yapıldığında hesaplanan veri doğru gelir.
  pushPerformansRawToSheets(liste);
  
  showFileStatus(`✅ ${liste.length}` + (translations[currentLang]||translations.tr).analysis_done, 'var(--green)');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CANLI GÖSTERİM FONKSİYONLARI
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// ────────────────────────────
// CANLI GÖSTERİM SAYFA İNİT
// ────────────────────────────
function initCanliPage() {
  console.log('🎬 Canlı sayfa başlatılıyor...');
  showWelcomeScreen();
  updateSlideWelcomeStats();
  renderTopInspectors();
  console.log('✅ Canlı sayfa hazır');
}

function updateSlideWelcomeStats() {
  const totalInspectors = performansData.length;
  const avgPerformance = totalInspectors > 0 
    ? Math.round(performansData.reduce((sum, i) => sum + getDispPerf(i), 0) / totalInspectors)
    : 0;
  
  document.getElementById('welcome-total').textContent = totalInspectors;
  document.getElementById('welcome-avg').textContent = avgPerformance + '%';
}

// ────────────────────────────
// SLIDESHOW KONTROLÜ
// ────────────────────────────
function toggleSlideshow() {
  if (slideshowActive) {
    stopSlideshow();
  } else {
    startSlideshow();
  }
}

function startSlideshow() {
  if (!performansData.length) {
    alert((translations[currentLang]||translations.tr).no_perf_alert);
    return;
  }
  
  slideshowActive = true;
  currentSlideIndex = 0;
  
  // Kontrol panelini gizle
  document.getElementById('canli-controls').style.display = 'none';
  
  // Buton metnini değiştir
  document.getElementById('slideshow-btn').innerHTML = (translations[currentLang]||translations.tr).stop_slideshow;
  
  // Inspector listesini hazırla
  prepareSlideshow();
  
  // İlk slaydı göster
  showSlide(0);
  
  // Otomatik geçişi başlat
  startAutoSlide();
  
  // Header bilgilerini güncelle
  updateSlideHeader();

  // Görsel geliştirmeler
  document.getElementById('slideshow-container').classList.add('running');
  _initParticles();
  _startCountdownRing();
  
  console.log('🎬 Slideshow başlatıldı:', slideshowInspectors.length, 'inspector');
}

function stopSlideshow() {
  slideshowActive = false;
  
  // Intervalları temizle
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  
  // Kontrol panelini göster
  document.getElementById('canli-controls').style.display = 'block';
  
  // Buton metnini değiştir
  document.getElementById('slideshow-btn').innerHTML = '<svg width=14 height=14 viewBox="0 0 24 24" fill="currentColor" style="margin-right:4px"><polygon points="5,3 19,12 5,21"/></svg> ' + (translations[currentLang]||translations.tr).start_slideshow;
  
  // Welcome ekranını göster
  showWelcomeScreen();

  // Görsel geliştirmeler kaldır
  document.getElementById('slideshow-container').classList.remove('running');
  _stopCountdownRing();
  
  console.log('⏸️ Slideshow durduruldu');
}

function resetSlideshow() {
  stopSlideshow();
  currentSlideIndex = 0;
  showWelcomeScreen();
}

// ────────────────────────────
// SLIDESHOW HAZIRLIK
// ────────────────────────────
function prepareSlideshow() {
  console.log('🎬 Slideshow hazırlanıyor...', performansData.length, 'inspector mevcut');
  
  let inspectors = [...performansData];
  
  // Görüntüleme moduna göre filtrele — Düz. Performans (getDispPerf) bazında
  switch(displayMode) {
    case 'top5':
      inspectors = inspectors
        .sort((a, b) => getDispPerf(b) - getDispPerf(a))
        .slice(0, 10);
      break;
    case 'excellent':
      inspectors = inspectors.filter(i => getDispPerf(i) >= 95);
      break;
    case 'good':
      inspectors = inspectors.filter(i => getDispPerf(i) >= 85);
      break;
    default: // 'all'
      inspectors = inspectors.sort((a, b) => getDispPerf(b) - getDispPerf(a));
  }
  
  slideshowInspectors = inspectors;
  console.log('📊 Slideshow için hazırlanan inspector sayısı:', slideshowInspectors.length);
  
  // Sol paneli güncelle
  renderTopInspectors();
  
  // Duyuruları güncelle
  updateAnnouncements();
}

function updateAnnouncements() {
  const announcements = [];
  
  if (slideshowInspectors.length > 0) {
    const best = slideshowInspectors[0];
    const bestPerf = Math.round(getDispPerf(best));
    
    if (bestPerf >= 95) {
      announcements.push(`🏆 ${(translations[currentLang]||translations.tr).best_inspector_month}: ${best.ins} (${bestPerf}%)`);
    }
    
    const excellentCount = slideshowInspectors.filter(i => getDispPerf(i) >= 95).length;
    if (excellentCount > 0) {
      announcements.push(`⭐ ${excellentCount} Inspector mükemmel performans gösteriyor!`);
    }
    
    const avgPerf = Math.round(slideshowInspectors.reduce((sum, i) => sum + getDispPerf(i), 0) / slideshowInspectors.length);
    announcements.push(`📊 ${(translations[currentLang]||translations.tr).stat_avg_perf_plain}: ${avgPerf}% | ${(translations[currentLang]||translations.tr).stat_total_inspector}: ${slideshowInspectors.length}`);
  }
  
  // Duyuru metnini döngüsel olarak değiştir
  let announcementIndex = 0;
  const announcementElement = document.getElementById('announcement-text');
  
  function cycleAnnouncements() {
    if (announcements.length > 0) {
      announcementElement.textContent = announcements[announcementIndex];
      announcementIndex = (announcementIndex + 1) % announcements.length;
    }
  }
  
  cycleAnnouncements();
  setInterval(cycleAnnouncements, 4000);
}

// ────────────────────────────
// AYIN EN İYİ İNSPECTÖRLERİ (5 KİŞİ)
// ────────────────────────────
function renderTopInspectors() {
  const listContainer = document.getElementById('top-inspectors-list');
  
  if (!performansData || !performansData.length) {
    listContainer.innerHTML = `
      <div style="text-align:center;padding:32px 22px;color:rgba(255,255,255,.3);">
        <div style="font-size:28px;margin-bottom:10px;opacity:.5">📊</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Veri Yok</div>
        <div style="font-size:10px;margin-top:6px;color:rgba(255,255,255,.2);">Excel yükleyip analiz yapın</div>
      </div>
    `;
    return;
  }

  const topInspectors = [...performansData]
    .filter(i => {
      const perf = getDispPerf(i);
      return perf !== null && perf !== undefined && !isNaN(perf) && perf > 0;
    })
    .sort((a, b) => {
      // Az veri (10 günden az) olan inspector'lar performansı ne kadar
      // yüksek olursa olsun, yeterli veriye sahip olanların ÖNÜNE geçemez.
      const aAz = azVeriMi(a.gunSayisi), bAz = azVeriMi(b.gunSayisi);
      if (aAz !== bAz) return aAz ? 1 : -1;
      return getDispPerf(b) - getDispPerf(a);
    })
    .slice(0, 10);

  if (!topInspectors.length) {
    listContainer.innerHTML = `
      <div style="text-align:center;padding:32px 22px;color:rgba(255,255,255,.3);">
        <div style="font-size:28px;margin-bottom:10px;opacity:.5">⚠️</div>
        <div style="font-size:11px;font-weight:600;">Performans verisi yok</div>
      </div>
    `;
    return;
  }

  const listHtml = topInspectors.map((inspector, index) => {
    const rank = index + 1;
    const performans = Math.round(getDispPerf(inspector));
    const performansClass = getPerformanceClass(performans);
    const rankCardClass = rank === 1 ? 'rank-1-card' : rank === 2 ? 'rank-2-card' : rank === 3 ? 'rank-3-card' : '';
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const t = (translations[currentLang] || translations.tr);

    const perfColor = performans >= 95 ? '#4DB6AC'
      : performans >= 85 ? '#64B5F6'
      : performans >= 70 ? '#FFB74D'
      : performans >= 50 ? '#EF9A9A'
      : '#FF8A80';

    const performanceLevel = (() => {
      if (performans >= 95) return { text: 'MÜKEMMEL', cls: 'badge-excellent' };
      if (performans >= 85) return { text: 'İYİ', cls: 'badge-good' };
      if (performans >= 70) return { text: 'ORTA', cls: 'badge-average' };
      if (performans >= 50) return { text: 'ZAYIF', cls: 'badge-weak' };
      return { text: 'ÇOK ZAYIF', cls: 'badge-verypoor' };
    })();

    return `
      <div class="top-inspector-card ${rankCardClass}" onclick="jumpToInspector('${inspector.ins.replace(/'/g, "\\'")}')">
        <div class="top-inspector-info" style="display:flex;align-items:center;gap:10px">
          <div class="top-inspector-rank ${rankClass}" style="flex-shrink:0">${rank <= 3 ? rankIcon : rank}</div>
          <div class="top-inspector-info-text" style="flex:1;min-width:0">
            <div class="top-inspector-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${inspector.ins}</div>
            <div class="top-inspector-details">
              ${formatTR((inspector.adet || 0))} ${t.units_short} · ${inspector.gunSayisi || 0} ${t.working}
            </div>
            <span class="top-inspector-badge ${performanceLevel.cls}" style="margin-top:4px;display:inline-block">${performanceLevel.text}</span>
            ${azVeriMi(inspector.gunSayisi) ? azVeriRozetiHtml('badge') : ''}
          </div>
          <div class="top-inspector-performance ${performansClass}" style="color:${perfColor};flex-shrink:0">${performans}%</div>
        </div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = listHtml;
}

// ────────────────────────────
// INSPECTOR'A ATLAMA
// ────────────────────────────
function jumpToInspector(inspectorName) {
  if (!slideshowActive || !slideshowInspectors.length) return;
  
  const targetIndex = slideshowInspectors.findIndex(i => i.ins === inspectorName);
  if (targetIndex !== -1) {
    currentSlideIndex = targetIndex;
    showSlide(currentSlideIndex);
    
    // Progress bar'ı sıfırla
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    document.getElementById('progress-bar').style.width = '0%';
    
    // Otomatik geçişi yeniden başlat
    if (slideshowActive) {
      startAutoSlide();
    }
  }
}

// ────────────────────────────
// SLIDE GÖSTERME
// ────────────────────────────
function showSlide(index) {
  const mainArea = document.getElementById('slideshow-main');
  
  if (index >= slideshowInspectors.length) {
    currentSlideIndex = 0;
    index = 0;
  }
  
  const inspector = slideshowInspectors[index];
  const t = translations[currentLang] || translations.tr;
  // Düz. Performans (verimlilikPerf) varsa onu kullan, yoksa genelHizPerf
  const performans = Math.round(getDispPerf(inspector));
  const hamPerf = Math.round(inspector.genelHizPerf ?? 0);
  const performansClass = getPerformanceClass(performans);
  
  const performansLevel = getPerformanceLevelLabel(performans);
  
  const ini = inspector.ins.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
  
  // SVG circle hesaplaması — container 150×150px → merkez (75,75), r=65
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (Math.min(performans, 150) / 150) * circumference;

  // Klasman breakdown satırları (büyük kart formatı, en fazla 3)
  const klasmanEntries = Object.entries(inspector.klasmanlar || {})
    .sort((a, b) => (b[1].adet || 0) - (a[1].adet || 0))
    .slice(0, 3);

  const klasmanRows = klasmanEntries.length ? klasmanEntries.map(([kName, kData]) => {
    const kPerf = Math.round(kData.hizPerf || 0);
    const kColor = getProgressColor(kPerf);
    const barW = Math.min(100, kPerf);
    return `<div class="slide-klasman-card">
      <div class="slide-klasman-card-top">
        <span class="slide-klasman-card-name">${kName}</span>
        <span class="slide-klasman-card-perf" style="color:${kColor}">${kPerf}%</span>
      </div>
      <div class="slide-klasman-bar"><div class="slide-klasman-bar-fill" style="width:${barW}%;background:${kColor}"></div></div>
      <div class="slide-klasman-card-adet">${formatTR((kData.adet || 0))} ${t.units_short}</div>
    </div>`;
  }).join('') : `<div style="font-size:12px;color:rgba(255,255,255,.4);text-align:center;padding:16px">${t.no_data_live}</div>`;

  // Overtime hesapları
  const otMesaiSn   = inspector.overtimeMesaiSure || 0;
  const otStdSn     = inspector.standartSureOvertime || 0;
  const otPerf       = inspector.overtimePerformans;
  const hasOvertime  = otMesaiSn > 0;
  // Overtime'da kontrol edilen tahmini adet: toplam adedin, overtime standart süre / toplam standart süre oranı kadarı
  let otAdetTahmini = null;
  if (hasOvertime && inspector.standartSure > 0 && otStdSn > 0) {
    otAdetTahmini = Math.round((inspector.adet || 0) * (otStdSn / inspector.standartSure));
  }
  const otColor = otPerf === null || otPerf === undefined ? 'rgba(255,255,255,.4)'
    : getProgressColor(otPerf);

  const overtimeBlockHtml = hasOvertime ? `
    <div class="slide-overtime-block">
      <div class="slide-overtime-header">🌙 <span>Overtime</span></div>
      <div class="slide-overtime-stats">
        <div class="slide-overtime-stat">
          <div class="slide-overtime-stat-value">${Math.round(otMesaiSn/60)}<span class="slide-overtime-unit">dk</span></div>
          <div class="slide-overtime-stat-label">Ek Mesai</div>
        </div>
        <div class="slide-overtime-stat">
          <div class="slide-overtime-stat-value" style="color:${otColor}">${otPerf !== null && otPerf !== undefined ? otPerf+'%' : '—'}</div>
          <div class="slide-overtime-stat-label">Verimlilik</div>
        </div>
        <div class="slide-overtime-stat">
          <div class="slide-overtime-stat-value">${otAdetTahmini !== null ? formatTR(otAdetTahmini) : '—'}</div>
          <div class="slide-overtime-stat-label">Kontrol Edilen (tah.)</div>
        </div>
      </div>
    </div>` : `
    <div class="slide-overtime-block slide-overtime-empty">
      <div class="slide-overtime-header">🌙 <span>Overtime</span></div>
      <div class="slide-overtime-none">Bu dönemde overtime çalışması yok</div>
    </div>`;

  const slideHtml = `
    <div class="inspector-slide active ${performansClass} anim-${animationEffect}">
      <div class="inspector-slide-header">
        <div class="inspector-slide-title">${t.detailed_perf}</div>
        <div class="inspector-slide-subtitle">${new Date().toLocaleDateString('tr-TR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</div>
      </div>
      
      <div class="inspector-slide-main">
        <!-- Sol: Avatar, İsim, Klasman kartları -->
        <div class="inspector-slide-avatar">
          <div class="inspector-slide-avatar-circle">
            ${ini}
          </div>
          <div class="inspector-slide-name">${inspector.ins}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom:14px;">
            📅 ${inspector.gunSayisi || 0} ${t.working}
          </div>
          <!-- Klasman Kartları (büyük format) -->
          <div class="slide-klasman-cards">${klasmanRows}</div>
        </div>
        
        <!-- Orta: İstatistikler + Overtime bloğu -->
        <div class="inspector-slide-center">
          <div class="inspector-slide-info">
            <div class="inspector-slide-stat">
              <div class="inspector-slide-stat-value">${formatTR((inspector.adet || 0))}</div>
              <div class="inspector-slide-stat-label">${t.total_product}</div>
            </div>
            <div class="inspector-slide-stat">
              <div class="inspector-slide-stat-value">${formatTR((inspector.kayit || 0))}</div>
              <div class="inspector-slide-stat-label">${t.record_count}</div>
            </div>
            <div class="inspector-slide-stat">
              <div class="inspector-slide-stat-value">${fmtSnKisa(inspector.standartSure||0)}</div>
              <div class="inspector-slide-stat-label">${t.std_duration}</div>
            </div>
            <div class="inspector-slide-stat">
              <div class="inspector-slide-stat-value">${Object.keys(inspector.klasmanlar || {}).length}</div>
              <div class="inspector-slide-stat-label">${t.klasman_count}</div>
            </div>
          </div>
          ${overtimeBlockHtml}
        </div>
        
        <!-- Sağ: Performans -->
        <div class="inspector-slide-performance">
          <div class="performance-circle">
            <svg viewBox="0 0 150 150">
              <circle
                class="performance-circle-bg"
                cx="75"
                cy="75"
                r="${radius}"
              />
              <circle
                class="performance-circle-progress"
                id="perf-circle-progress"
                cx="75"
                cy="75"
                r="${radius}"
                stroke-dasharray="${strokeDasharray}"
                stroke-dashoffset="${circumference}"
              />
            </svg>
            <div class="performance-circle-text">
              <div class="performance-circle-value" id="perf-circle-value">0%</div>
              <div class="performance-circle-label">${inspector.verimlilikPerf !== null && inspector.verimlilikPerf !== undefined ? t.adj_perf_label_upper : t.avg_perf_plain}</div>
            </div>
          </div>
          <div class="performance-level">${performansLevel}</div>
          ${inspector.verimlilikPerf !== null && inspector.verimlilikPerf !== undefined && hamPerf !== performans
            ? `<div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,.5)">${t.raw_avg} <strong style="color:rgba(255,255,255,.75)">${hamPerf}%</strong></div>`
            : ''}
        </div>
      </div>
    </div>
  `;
  
  mainArea.innerHTML = slideHtml;

  // Performans yüzdesi + çemberi senkronize sayaç animasyonuyla doldur
  animatePerformanceCircle(performans, circumference);

  // Countdown ring'i sıfırla
  if (slideshowActive) _resetCountdownRing();
  
  // Footer bilgilerini güncelle
  updateSlideFooter(index);
}

// Performans yüzdesini (sayı) ve SVG çemberini (stroke-dashoffset) eş zamanlı,
// aynı easing eğrisiyle 0'dan hedef değere animasyonlu olarak doldurur.
function animatePerformanceCircle(targetPercent, circumference) {
  const valueEl  = document.getElementById('perf-circle-value');
  const circleEl = document.getElementById('perf-circle-progress');
  if (!valueEl || !circleEl) return;

  const duration = 1200; // ms - eski CSS transition süresiyle aynı
  const startTime = performance.now();
  // ease-out cubic (CSS cubic-bezier(.4,0,.2,1)'e yakın bir JS karşılığı)
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);

  function frame(now) {
    const elapsed = now - startTime;
    const rawProgress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(rawProgress);

    const currentVal = Math.round(eased * targetPercent);
    valueEl.textContent = currentVal + '%';

    const currentOffset = circumference - (Math.min(eased * targetPercent, 150) / 150) * circumference;
    circleEl.style.strokeDashoffset = currentOffset;

    if (rawProgress < 1) {
      requestAnimationFrame(frame);
    } else {
      // Son karede tam hedef değere kilitle (yuvarlama hatalarını önler)
      valueEl.textContent = targetPercent + '%';
      const finalOffset = circumference - (Math.min(targetPercent, 150) / 150) * circumference;
      circleEl.style.strokeDashoffset = finalOffset;
    }
  }
  requestAnimationFrame(frame);
}

function showWelcomeScreen() {
  const mainArea = document.getElementById('slideshow-main');
  const t = translations[currentLang] || translations.tr;
  
  mainArea.innerHTML = `
    <div class="slideshow-welcome">
      <span class="welcome-icon">📺</span>
      <h2>${t.live_h2_title}</h2>
      <p>${t.live_h2_sub}</p>
      <div class="welcome-stats">
        <div class="welcome-stat">
          <div class="welcome-stat-value" id="welcome-total">0</div>
          <div class="welcome-stat-label">${t.stat_total_inspector}</div>
        </div>
        <div class="welcome-stat">
          <div class="welcome-stat-value" id="welcome-avg">0%</div>
          <div class="welcome-stat-label">${t.avg_perf_plain}</div>
        </div>
      </div>
      <button class="welcome-start-btn" onclick="toggleSlideshow()">
        ${t.start_slideshow}
      </button>
    </div>
  `;
  
  updateSlideWelcomeStats();
}

// ────────────────────────────
// OTOMATİK GEÇİŞ
// ────────────────────────────
function startAutoSlide() {
  // Mevcut interval'ları temizle
  if (slideshowInterval) clearInterval(slideshowInterval);
  if (progressInterval) clearInterval(progressInterval);
  
  // Progress bar'ı başlat
  let progressWidth = 0;
  const progressStep = 100 / (slideDuration / 100);
  
  progressInterval = setInterval(() => {
    progressWidth += progressStep;
    document.getElementById('progress-bar').style.width = progressWidth + '%';
    
    if (progressWidth >= 100) {
      clearInterval(progressInterval);
    }
  }, 100);
  
  // Slide geçişi
  slideshowInterval = setInterval(() => {
    if (slideshowActive) {
      currentSlideIndex = (currentSlideIndex + 1) % slideshowInspectors.length;
      showSlide(currentSlideIndex);
      
      // Progress bar'ı sıfırla
      progressWidth = 0;
      document.getElementById('progress-bar').style.width = '0%';
    }
  }, slideDuration);
}

// ────────────────────────────
// ANİMASYON EFEKTLERİ
// ────────────────────────────
function getAnimationName() {
  switch(animationEffect) {
    case 'fade': return 'fadeIn';
    case 'zoom': return 'zoomIn';
    case 'flip': return 'flipIn';
    default: return 'slideInLeft';
  }
}

// ────────────────────────────
// AYAR FONKSİYONLARI
// ────────────────────────────
function updateSlideDuration() {
  slideDuration = parseInt(document.getElementById('slide-duration').value);
  if (slideshowActive) {
    startAutoSlide(); // Yeni süreyle yeniden başlat
  }
}

function updateDisplayMode() {
  displayMode = document.getElementById('display-mode').value;
  if (slideshowActive) {
    prepareSlideshow();
    currentSlideIndex = 0;
    showSlide(0);
    startAutoSlide();
  }
}

function updateAnimationEffect() {
  animationEffect = document.getElementById('animation-effect').value;
}

// ────────────────────────────
// HEADER VE FOOTER GÜNCELLEMELERİ
// ────────────────────────────
function updateSlideHeader() {
  const totalInspectors = slideshowInspectors.length;
  const avgPerformance = totalInspectors > 0 
    ? Math.round(slideshowInspectors.reduce((sum, i) => sum + getDispPerf(i), 0) / totalInspectors)
    : 0;
  
  document.getElementById('slide-total-inspectors').textContent = totalInspectors;
  document.getElementById('slide-avg-performance').textContent = avgPerformance + '%';
  
  // Saati güncelle
  updateSlideClock();
  setInterval(updateSlideClock, 1000);
}

function updateSlideClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('tr-TR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  document.getElementById('slide-current-time').textContent = timeStr;
}

function updateSlideFooter(index) {
  const total = slideshowInspectors.length;
  document.getElementById('slide-counter').textContent = `${index + 1} / ${total}`;
  
  const today = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
  document.getElementById('slide-date').textContent = today;
}

// ────────────────────────────
// TAM EKRAN YÖNETİMİ (GELİŞTİRİLMİŞ)
// ────────────────────────────
function toggleFullscreen() {
  const container = document.getElementById('slideshow-container');
  
  if (!document.fullscreenElement && !container.classList.contains('fullscreen-mode')) {
    // Tam ekran moduna geç
    container.classList.add('fullscreen-mode');
    
    // Tarayıcı tam ekranını da dene
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {
        console.log('Tarayıcı tam ekran desteklenmiyor, CSS tam ekran kullanılıyor');
      });
    }
    
    console.log('🖥️ Tam ekran modu açıldı');
  } else {
    // Tam ekran modundan çık
    container.classList.remove('fullscreen-mode');
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        console.log('Tam ekran çıkış hatası');
      });
    }
    
    console.log('🖥️ Tam ekran modundan çıkıldı');
  }
}

// Tam ekran değişiklik eventi (güncellendi)
document.addEventListener('fullscreenchange', function() {
  const container = document.getElementById('slideshow-container');
  const isFullscreen = !!document.fullscreenElement;
  
  if (!isFullscreen && container.classList.contains('fullscreen-mode')) {
    // Tarayıcı tam ekranından çıkıldıysa CSS tam ekranını da kapat
    container.classList.remove('fullscreen-mode');
  }
});

// ────────────────────────────
// KLAVYE KONTROLÜ (TAM EKRANDA)
// ────────────────────────────
document.addEventListener('keydown', function(e) {
  if (document.fullscreenElement && slideshowActive) {
    switch(e.key) {
      case 'ArrowRight':
      case ' ': // Space tuşu
        e.preventDefault();
        currentSlideIndex = (currentSlideIndex + 1) % slideshowInspectors.length;
        showSlide(currentSlideIndex);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        currentSlideIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : slideshowInspectors.length - 1;
        showSlide(currentSlideIndex);
        break;
      case 'Escape':
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          stopSlideshow();
        }
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        toggleSlideshow();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  }
  
  // Genel klavye kısayolları
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveData();
  }
  
  if (e.key === 'Escape') {
    if (document.getElementById('modal').classList.contains('open')) {
      closeModal();
    }
    if (document.getElementById('detail-modal').classList.contains('open')) {
      closeDetailModal();
    }
  }
  
  if (e.ctrlKey && e.key === 'n' && document.getElementById('page-klasmanlar').classList.contains('active')) {
    e.preventDefault();
    openModal();
  }
});

// ────────────────────────────
// MOUSE KONTROLÜ (TAM EKRANDA)
// ────────────────────────────
document.addEventListener('click', function(e) {
  if (document.fullscreenElement && slideshowActive) {
    const container = document.getElementById('slideshow-container');
    if (container.contains(e.target)) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      
      if (x > width / 2) {
        // Sağ yarı - sonraki slide
        currentSlideIndex = (currentSlideIndex + 1) % slideshowInspectors.length;
        showSlide(currentSlideIndex);
      } else {
        // Sol yarı - önceki slide
        currentSlideIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : slideshowInspectors.length - 1;
        showSlide(currentSlideIndex);
      }
    }
  }

  // Diğer ekipler popup'ını dışarı tıklayınca kapat
  const popup = document.getElementById('diger-ekipler-popup');
  const btn   = document.getElementById('btn-diger-ekipler');
  if (popup && popup.style.display !== 'none' && !popup.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
    popup.style.display = 'none';
  }
});

// position:fixed popup, scroll sirasinda butonla hizasi bozulmasin diye kapatilir
window.addEventListener('scroll', () => {
  const popup = document.getElementById('diger-ekipler-popup');
  if (popup && popup.style.display !== 'none') popup.style.display = 'none';
}, true);

// ────────────────────────────
// TOUCH KONTROLÜ (MOBİL)
// ────────────────────────────
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', function(e) {
  if (document.fullscreenElement && slideshowActive) {
    touchStartX = e.changedTouches[0].screenX;
  }
});

document.addEventListener('touchend', function(e) {
  if (document.fullscreenElement && slideshowActive) {
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
  }
});

function handleGesture() {
  const threshold = 50; // minimum swipe distance
  
  if (touchEndX < touchStartX - threshold) {
    // Sol swipe - sonraki slide
    currentSlideIndex = (currentSlideIndex + 1) % slideshowInspectors.length;
    showSlide(currentSlideIndex);
  }
  
  if (touchEndX > touchStartX + threshold) {
    // Sağ swipe - önceki slide
    currentSlideIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : slideshowInspectors.length - 1;
    showSlide(currentSlideIndex);
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
// GELİŞTİRİLMİŞ GÖRSELLİK YARDIMCILARI
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// ─── PARTİKÜL EFEKTI ───
function _initParticles() {
  const container = document.getElementById('slide-particles');
  if (!container) return;
  container.innerHTML = '';
  const count = 18;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'slide-particle';
    const size = 20 + Math.random() * 60;
    const left = Math.random() * 100;
    const dur = 8 + Math.random() * 12;
    const delay = Math.random() * -15;
    p.style.cssText = `width:${size}px;height:${size}px;left:${left}%;bottom:-${size}px;animation-duration:${dur}s;animation-delay:${delay}s;`;
    container.appendChild(p);
  }
}

// ─── COUNTDOWN RING ───
let _ringInterval = null;
let _ringStartTime = null;

function _startCountdownRing() {
  _stopCountdownRing();
  const circumference = 113; // 2π × 18
  _ringStartTime = Date.now();

  function tick() {
    const elapsed = Date.now() - _ringStartTime;
    const fraction = Math.min(elapsed / slideDuration, 1);
    const offset = circumference * fraction;
    const rem = Math.max(0, Math.ceil((slideDuration - elapsed) / 1000));

    const fill = document.getElementById('ring-fill');
    const num  = document.getElementById('ring-num');
    if (fill) fill.style.strokeDashoffset = offset;
    if (num)  num.textContent = rem;

    // Color: green → amber → red
    let color = '#4CAF50';
    if (fraction > 0.7)  color = '#FF9800';
    if (fraction > 0.9)  color = '#ef5350';
    if (fill) fill.style.stroke = color;
  }

  tick();
  _ringInterval = setInterval(tick, 100);
}

function _resetCountdownRing() {
  _ringStartTime = Date.now();
}

function _stopCountdownRing() {
  if (_ringInterval) { clearInterval(_ringInterval); _ringInterval = null; }
  const fill = document.getElementById('ring-fill');
  const num  = document.getElementById('ring-num');
  if (fill) fill.style.strokeDashoffset = 0;
  if (num)  num.textContent = '';
}

// ─── showSlide'ı countdown ring ile güncelle ───
const _origShowSlide = showSlide;


// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HD VİDEO OLUŞTURMA — Slayt başına PNG yakala → WebM video
// Yöntem: Her slayta bekle, html2canvas ile PNG al, canvas stream üzerinden MediaRecorder'a yaz
// Kesiklik sorunu giderildi: sabit FPS stream + slayt arası geçiş beklemesi
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

let _vidRecorder   = null;
let _vidChunks     = [];
let _vidSlideTimer = null;
let _vidCanvas     = null;
let _vidCtx        = null;
let _vidStream     = null;
let _vidRendering  = false;
let _vidFillTimer  = null;  // sabit FPS dolgu timer

// HD sabit çözünürlük
const VID_W = 1920;
const VID_H = 1080;
const VID_FPS = 30;

function _loadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('html2canvas yüklenemedi'));
    document.head.appendChild(s);
  });
}

// Canvas stream'i canlı tutan dolgu loop — MediaRecorder boş frame görmemesi için
function _startFillLoop(ctx, w, h) {
  if (_vidFillTimer) { clearInterval(_vidFillTimer); _vidFillTimer = null; }
  _vidFillTimer = setInterval(() => {
    // Mevcut içeriği koru; tamamen siyah/boşsa canlı gradient arka plan yaz
    const px = ctx.getImageData(w>>1, h>>1, 1, 1).data;
    if (px[0] === 0 && px[1] === 0 && px[2] === 0) {
      _drawVividBg(ctx, w, h);
    } else {
      const imageData = ctx.getImageData(0, 0, w, h);
      ctx.putImageData(imageData, 0, 0);
    }
  }, 1000 / VID_FPS);
}

// Canlı arka plan: koyu lacivert → orta mavi gradient
function _drawVividBg(ctx, w, h) {
  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0,   '#0B1F3A');
  grd.addColorStop(0.4, '#102848');
  grd.addColorStop(1,   '#0D2E55');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  // Köşe aksan
  const g2 = ctx.createRadialGradient(w*0.15, h*0.85, 0, w*0.15, h*0.85, w*0.4);
  g2.addColorStop(0, 'rgba(33,150,243,0.12)');
  g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
  const g3 = ctx.createRadialGradient(w*0.85, h*0.15, 0, w*0.85, h*0.15, w*0.35);
  g3.addColorStop(0, 'rgba(21,101,192,0.10)');
  g3.addColorStop(1, 'transparent');
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, w, h);
}

function _stopFillLoop() {
  if (_vidFillTimer) { clearInterval(_vidFillTimer); _vidFillTimer = null; }
}

async function startVideoRecording() {
  if (!performansData.length) {
    alert('⚠️ Önce Performans Analizi sayfasından Excel yükleyin ve veri oluşturun!');
    return;
  }
  if (_vidRendering) {
    _stopVideoRecording();
    return;
  }

  prepareSlideshow();
  const inspCount = slideshowInspectors.length;
  if (!inspCount) { alert('Gösterilecek inspector yok!'); return; }

  const perSlideSec = parseInt(document.getElementById('slide-duration')?.value || 5000) / 1000;
  const totalMin = Math.ceil((inspCount * perSlideSec + 5) / 60);

  if (!confirm(
    `🎥 HD Video Oluşturma (1920×1080)

` +
    `• ${inspCount} inspector × ${perSlideSec}sn ≈ ${totalMin} dk
` +
    `• Çözünürlük: 1920×1080 (Full HD)
` +
    `• Format: WebM (tüm tarayıcılarda desteklenir)
` +
    `• Oluşturma sırasında sayfada başka işlem yapmayın

` +
    `Başlamak istiyor musunuz?`
  )) return;

  const loadBtn = document.getElementById('video-rec-btn');
  loadBtn.innerHTML = '⏳ Hazırlanıyor...';
  loadBtn.disabled = true;

  try {
    await _loadHtml2Canvas();
  } catch(e) {
    alert('❌ html2canvas yüklenemedi: ' + e.message);
    loadBtn.innerHTML = '🎥 Video Oluştur';
    loadBtn.disabled = false;
    return;
  }

  // HD canvas oluştur
  _vidCanvas = document.createElement('canvas');
  _vidCanvas.width  = VID_W;
  _vidCanvas.height = VID_H;
  _vidCtx = _vidCanvas.getContext('2d', { alpha: false });

  // Canlı gradient arka planla başlat
  _drawVividBg(_vidCtx, VID_W, VID_H);

  // Stream al
  _vidStream = _vidCanvas.captureStream(VID_FPS);

  // En yüksek kalite codec seç
  const mimeType = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

  _vidRecorder = new MediaRecorder(_vidStream, {
    mimeType,
    videoBitsPerSecond: 12_000_000  // 12 Mbps — HD kalite
  });
  _vidChunks = [];
  _vidRecorder.ondataavailable = e => { if (e.data?.size > 0) _vidChunks.push(e.data); };
  _vidRecorder.onstop = _finishVideo;
  _vidRecorder.start(200);  // Her 200ms'de bir chunk → akıcı kayıt
  _vidRendering = true;

  // Dolgu loop başlat (kesiklik önlenir)
  _startFillLoop(_vidCtx, VID_W, VID_H);

  loadBtn.innerHTML = '⏹️ Durdur';
  loadBtn.className = 'btn btn-warning';
  loadBtn.disabled  = false;
  loadBtn.onclick   = _stopVideoRecording;

  if (slideshowActive) stopSlideshow();
  slideshowActive = true;
  const canliCtrl = document.getElementById('canli-controls');
  if (canliCtrl) canliCtrl.style.display = 'none';
  document.getElementById('slideshow-btn').innerHTML = (translations[currentLang]||translations.tr).stop_slideshow;

  _showRecordingIndicator();
  showSuccessMessage((translations[currentLang]||translations.tr).hd_recording, 4000);

  await _renderAllSlidesHD(inspCount, perSlideSec);

  _stopVideoRecording();
}

async function _renderAllSlidesHD(total, perSlideSec) {
  const container = document.getElementById('slideshow-container');

  for (let i = 0; i < total && _vidRendering; i++) {
    currentSlideIndex = i;
    showSlide(i);
    _updateRecordProgress(i + 1, total);

    // Animasyon + DOM render için bekle
    await _sleep(120);

    // Slayt fotoğrafını çek (yüksek kalite)
    try {
      // Gerçek boyutları al; 0 ise güvenli fallback
      const cW = container.offsetWidth  || container.getBoundingClientRect().width  || 1280;
      const cH = container.offsetHeight || container.getBoundingClientRect().height || 720;
      const bestScale = Math.min(VID_W / cW, 4); // max 4× güvenlik sınırı

      // Arka planı garantile (canlı gradient)
      _drawVividBg(_vidCtx, VID_W, VID_H);

      const tempCanvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,   // container kendi arka planını taşısın
        scale: bestScale,
        logging: false,
        removeContainer: false,
        imageTimeout: 0,
        foreignObjectRendering: false
      });

      // Dolgu loop durdur — şimdi gerçek frame yazacağız
      _stopFillLoop();

      // HD canvas'a çiz
      _vidCtx.drawImage(tempCanvas, 0, 0, VID_W, VID_H);

      // Slayt süresi boyunca aynı frame'i tut (akıcı tutmak için mini loop)
      const slideEnd = Date.now() + (perSlideSec * 1000);
      while (Date.now() < slideEnd && _vidRendering) {
        // Frame'i yenile (freeze kalmaması için)
        _vidCtx.drawImage(tempCanvas, 0, 0, VID_W, VID_H);
        await _sleep(1000 / VID_FPS);
      }

      // Dolgu loop tekrar başlat
      _startFillLoop(_vidCtx, VID_W, VID_H);

    } catch(err) {
      console.warn('Slayt render hatası:', err);
      // Hata durumunda geçiş yap
      await _sleep(perSlideSec * 1000);
    }
  }
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function _stopVideoRecording() {
  _vidRendering = false;
  _stopFillLoop();
  clearTimeout(_vidSlideTimer);

  if (_vidRecorder && _vidRecorder.state !== 'inactive') {
    _vidRecorder.stop();
  }
  if (_vidStream) {
    _vidStream.getTracks().forEach(t => t.stop());
    _vidStream = null;
  }

  _hideRecordingIndicator();

  const btn = document.getElementById('video-rec-btn');
  if (btn) {
    btn.innerHTML = '🎥 Video Oluştur';
    btn.className = 'btn btn-success';
    btn.disabled  = false;
    btn.onclick   = startVideoRecording;
  }

  stopSlideshow();
}

function _finishVideo() {
  if (!_vidChunks.length) {
    alert('⚠️ Video verisi oluşturulamadı. Tarayıcı MediaRecorder desteğini kontrol edin.');
    return;
  }
  const mimeType = _vidChunks[0]?.type || 'video/webm';
  const blob = new Blob(_vidChunks, { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  a.href     = url;
  a.download = `LCW_Inspection_HD_${date}.webm`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  const mb = (blob.size / 1024 / 1024).toFixed(1);
  showSuccessMessage(`🎬 HD Video indirildi! ${mb} MB — 1920×1080`, 6000);
  _vidChunks = [];
}

function _showRecordingIndicator() {
  let el = document.getElementById('rec-indicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rec-indicator';
    el.style.cssText = `
      position:fixed;top:68px;right:20px;z-index:9998;
      background:linear-gradient(135deg,#B71C1C,#C62828);color:#fff;
      padding:8px 18px;border-radius:9px;font-size:12px;font-weight:700;
      box-shadow:0 4px 20px rgba(198,40,40,.5);
      display:flex;align-items:center;gap:8px;letter-spacing:.3px;
    `;
    document.head.insertAdjacentHTML('beforeend', `<style>
      @keyframes recPulse{0%,100%{opacity:1}50%{opacity:.7}}
      #rec-indicator{animation:recPulse 1.2s infinite;}
    </style>`);
    document.body.appendChild(el);
  }
  el.innerHTML = `<span style="width:9px;height:9px;background:#fff;border-radius:50%;display:inline-block;flex-shrink:0"></span> HD REC <span id="rec-progress" style="font-family:'DM Mono',monospace;font-size:11px;opacity:.85">0/?</span>`;
  el.style.display = 'flex';
}

function _updateRecordProgress(cur, total) {
  const el = document.getElementById('rec-progress');
  if (el) el.textContent = `${cur}/${total}`;
}

function _hideRecordingIndicator() {
  const el = document.getElementById('rec-indicator');
  if (el) el.style.display = 'none';
}



if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.lcDebug = {
    klasmanlar: () => klasmanlar,
    performansData: () => performansData,
    slideshowInspectors: () => slideshowInspectors,
    clearAll: () => {
      localStorage.removeItem('lc_inspection_data');
      location.reload();
    },
    addTestData: () => {
      // Test verisi ekle
      performansData = [
        {
          ins: 'Ahmet YILMAZ',
          adet: 150,
          kayit: 8,
          standartSure: 7200,
          mesaiSure: 8100,
          genelHizPerf: 89,
          gunSayisi: 3,
          klasmanlar: {
            'Pantolon': { adet: 100, standartSure: 4800, hizPerf: 92 },
            'Ceket': { adet: 50, standartSure: 2400, hizPerf: 85 }
          }
        },
        {
          ins: 'Fatma KAYA',
          adet: 200,
          kayit: 12,
          standartSure: 9600,
          mesaiSure: 9000,
          genelHizPerf: 107,
          gunSayisi: 4,
          klasmanlar: {
            'Pantolon': { adet: 120, standartSure: 5760, hizPerf: 105 },
            'Mont': { adet: 80, standartSure: 3840, hizPerf: 110 }
          }
        }
      ];
      renderDashboard();
      renderTopInspectors();
      console.log('✅ Test verisi eklendi');
    }
  };
  
  console.log('🔧 Debug fonksiyonları: lcDebug.clearAll(), lcDebug.addTestData(), lcDebug.klasmanlar()');
}

// Uygulama hazır
console.log(`✅  Inspection Performans Paneli v${APP_VERSION} hazır!`);
console.log(`📊 ${klasmanlar.length} klasman, ${performansData.length} inspector verisi yüklendi`);
// ════════════════════════════════════════════════════════════════════
// KLASMAN ANALİZ — SHEETS ENTEGRASYONU
// ════════════════════════════════════════════════════════════════════

async function pushKlasmanAnalizToSheets(liste) {
  if (SHEETS_DEVRE_DISI) return;
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token || !liste || !liste.length) return;
  try {
    const payload = liste.map(k => ({
      ad:                  k.ad,
      standartKontrolSure: k.standartKontrolSure || 0,
      istasyonSuresi:      k.istasyonSure        || 0,
      gerceklesenOrt:      (k.toplamAdet > 0 && k.toplamFiiliSure > 0)
                           ? parseFloat((k.toplamFiiliSure / k.toplamAdet).toFixed(3)) : 0,
      toplamAdet:          k.toplamAdet          || 0,
      inspectorSayisi:     k.inspectorSayisi     || 0,
      toplamFiiliSure:     k.toplamFiiliSure     || 0,
      toplamStandartSure:  k.toplamStandartSure  || 0,
      oranToplam:          (k.toplamStandartSure > 0 && k.toplamFiiliSure > 0)
                           ? parseFloat((k.toplamFiiliSure / k.toplamStandartSure).toFixed(4)) : null
    }));
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'setKlasmanAnaliz', token, klasmanAnaliz: payload, savedAt: new Date().toISOString() }),
      mode: 'no-cors'
    });
    console.log('✅ Klasman analiz Sheets\'e gönderildi:', payload.length, 'klasman');
  } catch(err) {
    console.warn('Klasman analiz push hatası:', err.message);
  }
}

async function pushAndRenderKlasmanAnaliz() {
  renderKlasmanAnaliz();          // Önce hesapla & render et (içinde push var)
  showSuccessMessage((translations[currentLang]||translations.tr).sheets_analiz_sent);
}

async function pullKlasmanAnalizFromSheets() {
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) {
    alert('⚠️ Sheets bağlantısı yapılandırılmamış!\nKlasman Yönetimi → Bağlantı Ayarları bölümünden URL ve Token girin.');
    return;
  }
  const btn = document.getElementById('kla-pull-btn');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = (translations[currentLang]||translations.tr).pulling; btn.disabled = true; }
  try {
    const data = await jsonpFetch(url, { action: 'getKlasmanAnaliz', token });
    if (data.status === 'ok' && Array.isArray(data.klasmanAnaliz) && data.klasmanAnaliz.length > 0) {
      // Sheets'ten gelen veriyi _klAnalizTumListe'ye de yaz (Süre Önerisi için)
      _klAnalizTumListe = data.klasmanAnaliz.map(k => ({
        ad:                k.ad,
        toplamAdet:        k.toplamAdet        || 0,
        toplamFiiliSure:   k.toplamFiiliSure   || 0,
        toplamStandartSure:k.toplamStandartSure|| 0,
        inspectorSayisi:   k.inspectorSayisi   || 0,
        standartKontrolSure: k.standartKontrolSure || 0,
        istasyonSure:      k.istasyonSuresi    || 0,
        kayitSayisi:       0,
        adetListesi:       []
      }));

      // Sheets'ten gelen veriyi ekranda göster
      const el = document.getElementById('klasman-analiz-icerik');
      if (!el) return;

      const liste = data.klasmanAnaliz;

      const kartlar = liste.map(k => {
        const std          = k.standartKontrolSure || 0;
        const toplamOran   = (k.toplamStandartSure > 0 && k.toplamFiiliSure > 0)
                             ? k.toplamFiiliSure / k.toplamStandartSure : null;
        const gerceklesen  = k.gerceklesenOrt > 0
                             ? k.gerceklesenOrt
                             : (k.toplamAdet > 0 && k.toplamFiiliSure > 0
                                ? k.toplamFiiliSure / k.toplamAdet : 0);
        const fark         = gerceklesen > 0 && std > 0 ? gerceklesen - std : null;
        const farkYuzde    = fark !== null && std > 0 ? Math.round((fark / std) * 100) : null;
        const barGenislik  = toplamOran !== null
                             ? Math.min(200, Math.round(toplamOran * 100))
                             : (gerceklesen > 0 && std > 0 ? Math.min(200, Math.round((gerceklesen / std) * 100)) : 0);
        const barRenk      = toplamOran === null && fark === null ? 'var(--muted2)'
                             : (toplamOran !== null ? toplamOran : (gerceklesen / (std||1))) <= 1 ? '#00897B'
                             : (toplamOran !== null ? toplamOran : (gerceklesen / (std||1))) <= 1.2 ? '#F57F17' : '#C62828';
        const farkIkon     = toplamOran === null && fark === null ? '—'
                             : (toplamOran !== null ? toplamOran <= 1 : fark !== null && fark <= 0)
                               ? '▼ Hedef Altında ✓' : '▲ Hedef Üstünde';

        return `
        <div style="background:#fff;border:1.5px solid var(--border2);border-radius:14px;padding:20px;box-shadow:var(--shadow);position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${barRenk},${barRenk}88);border-radius:14px 14px 0 0;"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--navy);">${k.ad}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">${formatTR((k.toplamAdet||0))} adet · ${k.inspectorSayisi||0} inspector</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:22px;font-weight:800;color:${barRenk};font-family:'DM Mono',monospace;line-height:1;">${gerceklesen > 0 ? gerceklesen.toFixed(2)+'sn' : '—'}</div>
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:2px;">Gerçekleşen/Adet</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div style="background:var(--lblue3);border:1px solid var(--border2);border-radius:10px;padding:12px 14px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📐 Standart</div>
              <div style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;">${std > 0 ? std.toFixed(2)+'sn' : '—'}</div>
              <div style="font-size:10px;color:var(--muted2);margin-top:3px;">1 adet ürün kontrol</div>
              ${k.istasyonSuresi > 0 ? `<div style="font-size:10px;color:var(--muted2);margin-top:1px;">+ ${k.istasyonSuresi.toFixed(2)}sn istasyon</div>` : ''}
            </div>
            <div style="background:${fark!==null&&fark<=0?'var(--lgreen)':fark!==null&&fark<=std*0.2?'var(--lamber)':'var(--lred)'};border:1px solid ${fark!==null&&fark<=0?'#B2DFDB':fark!==null&&fark<=std*0.2?'#FFE082':'#FFCDD2'};border-radius:10px;padding:12px 14px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">⏱ Gerçekleşen</div>
              <div style="font-size:18px;font-weight:700;color:${barRenk};font-family:'DM Mono',monospace;">${gerceklesen > 0 ? gerceklesen.toFixed(2)+'sn' : '—'}</div>
              <div style="font-size:10px;color:${barRenk};margin-top:3px;font-weight:600;">${fark !== null ? (fark>0?'+':'')+fark.toFixed(2)+'sn fark' : '—'}${farkYuzde !== null ? ` (${fark>0?'+':''}${farkYuzde}%)` : ''}</div>
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:4px;">
              <span>Gerçekleşen / Standart oranı</span>
              <span style="font-weight:600;color:${barRenk}">${barGenislik}%</span>
            </div>
            <div style="height:8px;background:var(--border2);border-radius:4px;overflow:hidden;">
              <div style="width:${Math.min(100,barGenislik)}%;height:100%;background:${barRenk};border-radius:4px;"></div>
            </div>
          </div>
          <div style="text-align:center;padding:6px 12px;border-radius:8px;background:${fark!==null&&fark<=0?'var(--lgreen)':fark!==null?'var(--lred)':'var(--offwhite)'};border:1px solid ${fark!==null&&fark<=0?'#B2DFDB':fark!==null?'#FFCDD2':'var(--border2)'};">
            <span style="font-size:11px;font-weight:700;color:${barRenk};">${farkIkon}</span>
          </div>
        </div>`;
      }).join('');

      const hedefte   = liste.filter(k => k.gerceklesenOrt > 0 && k.standartKontrolSure > 0 && k.gerceklesenOrt <= k.standartKontrolSure).length;
      const yakin     = liste.filter(k => { const g=k.gerceklesenOrt,s=k.standartKontrolSure; return g>0&&s>0&&g>s&&g<=s*1.2; }).length;
      const yuksek    = liste.filter(k => { const g=k.gerceklesenOrt,s=k.standartKontrolSure; return g>0&&s>0&&g>s*1.2; }).length;
      const veriYok   = liste.filter(k => !k.gerceklesenOrt || !k.standartKontrolSure).length;

      el.innerHTML = `
        <div style="background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%);border-radius:12px;padding:16px 22px;margin-bottom:20px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
          <div style="font-size:28px;">🎯</div>
          <div style="flex:1;">
            <div style="font-size:15px;font-weight:700;color:#fff;" data-i18n="klasman_analiz_overlay_title">Classification Analysis — Fetched from Sheets</div>
            <div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:3px;">${liste.length} klasman · ${formatTR(liste.reduce((s,k)=>s+(k.toplamAdet||0),0))} toplam adet</div>
          </div>
          ${[['✅','Hedefte',hedefte,'#4CAF50'],['⚠️','Yakın',yakin,'#FFB74D'],['🔴','Yüksek',yuksek,'#EF9A9A'],['➖','Veri Yok',veriYok,'rgba(255,255,255,.5)']].map(([ic,lb,cnt,col])=>`
          <div style="text-align:center;background:rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;min-width:80px;">
            <div style="font-size:16px;">${ic}</div>
            <div style="font-size:20px;font-weight:800;color:${col};font-family:'DM Mono',monospace;line-height:1.2;">${cnt}</div>
            <div style="font-size:9px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;">${lb}</div>
          </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">${kartlar}</div>
      `;
      showSuccessMessage(`✅ ${liste.length} ` + (translations[currentLang]||translations.tr).sheets_analiz_loaded);
    } else {
      alert('ℹ️ Sheets\'te henüz klasman analiz verisi yok.\n\nÖnce "📤 Sheets\'e Gönder & Yenile" butonuna basın.');
    }
  } catch(err) {
    alert('❌ Veri çekilemedi: ' + err.message);
  } finally {
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// KULLANICI YÖNETİMİ
// ══════════════════════════════════════════════════════════════════════════════
// _usersCache: Users sekmesinden çekilen [{username, tabs:[...]}] listesi (admin
// hariç). Şifreler güvenlik nedeniyle sunucudan geri okunmaz; sadece admin yeni
// bir şifre belirlediğinde sunucuya gönderilir, aksi halde mevcut şifre korunur.
// NOT: _usersCache ve _editingUsername artık dosyanın ÜSTÜNDE (global değişkenler
// bölümünde) tanımlanıyor — bu fonksiyonlar dosyanın altında olsa da, sayfa açılışında
// üst seviyede çağrılan renderDashboard() → renderTeamManagersSection() zinciri bu
// değişkene erişiyor; let ile alttaki bir tanım kullanılırsa TDZ (Temporal Dead Zone)
// ReferenceError'a yol açar.

// Kullanıcı adını ("fatma.dogan", "ali_kirna" gibi) okunabilir bir görünen
// ada çevirir: noktalar/alt çizgiler boşluğa dönüştürülür ve her kelimenin
// ilk harfi büyütülür. "fatma.dogan" → "Fatma Dogan".
function _formatDisplayName(username) {
  if (!username) return username;
  return String(username)
    .split(/[._\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toLocaleUpperCase('tr-TR') + part.slice(1).toLocaleLowerCase('tr-TR'))
    .join(' ');
}

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function loadAndRenderUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const t = translations[currentLang] || translations.tr;

  // Sadece admin bu sayfayı yönetebilir
  if (currentUser && !currentUser.isAdmin) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding:18px;text-align:center;color:var(--red)">⛔ Bu sayfaya yalnızca admin erişebilir.</td></tr>`;
    return;
  }

  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding:18px;text-align:center;color:var(--red)">⚠️ Google Sheets bağlantısı yapılandırılmamış. Klasman Yönetimi → Bağlantı Ayarları.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="3" style="padding:18px;text-align:center;color:var(--muted)">${t.loading}</td></tr>`;

  try {
    const data = await jsonpFetch(url, { action: 'getUsers', token });
    if (data.status === 'ok') {
      _usersCache = (data.users || []).map(u => ({ username: u.username, tabs: u.tabs || [], team: u.team || [] }));
    } else {
      _usersCache = [];
    }
  } catch(e) {
    _usersCache = [];
    tbody.innerHTML = `<tr><td colspan="3" style="padding:18px;text-align:center;color:var(--red)">❌ ${e.message}</td></tr>`;
    return;
  }
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  const sayac = document.getElementById('users-sayac');
  if (!tbody) return;
  const t = translations[currentLang] || translations.tr;

  if (sayac) sayac.textContent = (1 + _usersCache.length) + ' kullanıcı';

  let rows = `
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:10px;font-weight:700;color:var(--navy)">👑 admin</td>
      <td style="padding:10px;color:var(--muted);font-size:12px">${t.admin_row_note}</td>
      <td style="padding:10px;text-align:right;color:var(--muted);font-size:11px">—</td>
    </tr>`;

  if (!_usersCache.length) {
    rows += `<tr><td colspan="3" style="padding:18px;text-align:center;color:var(--muted)">${t.no_users}</td></tr>`;
  } else {
    _usersCache.forEach(u => {
      const tabLabels = (u.tabs || []).map(tid => {
        const found = ASSIGNABLE_TABS.find(a => a.id === tid);
        return found ? found.label : tid;
      });
      const badges = tabLabels.length
        ? tabLabels.map(l => `<span style="display:inline-block;background:var(--lblue2);color:var(--blue);border-radius:99px;padding:2px 9px;font-size:11px;margin:2px">${_escapeHtml(l)}</span>`).join('')
        : `<span style="color:var(--muted);font-size:11px">—</span>`;
      const safeUser = _escapeHtml(u.username);
      rows += `
        <tr style="border-bottom:1px solid var(--border2)">
          <td style="padding:10px;font-weight:600;color:var(--navy);font-family:'DM Mono',monospace">${safeUser}</td>
          <td style="padding:10px">${badges}</td>
          <td style="padding:10px;text-align:right;white-space:nowrap">
            <button class="btn btn-sm" onclick="openUserModal('${safeUser}')">${t.edit_btn}</button>
            <button class="btn btn-sm btn-warning" style="margin-left:6px" onclick="deleteUserConfirm('${safeUser}')">${t.delete_btn}</button>
          </td>
        </tr>`;
    });
  }
  tbody.innerHTML = rows;
}

// ── Kullanıcı Ekle/Düzenle Modalı ────────────────────────────────────────────
function openUserModal(username) {
  const t = translations[currentLang] || translations.tr;
  _editingUsername = username || null;

  const titleEl   = document.getElementById('user-modal-title');
  const userInput = document.getElementById('user-modal-username');
  const pwInput   = document.getElementById('user-modal-password');
  const pwHint    = document.getElementById('user-modal-pw-hint');
  const tabsBox   = document.getElementById('user-modal-tabs');

  let selectedTabs = [];
  if (_editingUsername) {
    const u = _usersCache.find(x => x.username === _editingUsername);
    selectedTabs = (u && u.tabs) || [];
    titleEl.textContent = '✏️ Kullanıcıyı Düzenle: ' + _editingUsername;
    userInput.value = _editingUsername;
    userInput.disabled = true;
    pwInput.placeholder = '••••••';
    pwHint.textContent = t.password_hint_edit;
  } else {
    titleEl.textContent = '✨ ' + t.add_user;
    userInput.value = '';
    userInput.disabled = false;
    pwInput.placeholder = '••••••';
    pwHint.textContent = t.password_hint;
  }
  pwInput.value = '';

  // Sekme checkbox'larını oluştur (Dashboard hariç — herkese açık)
  tabsBox.innerHTML = ASSIGNABLE_TABS.filter(tb => tb.id !== 'dashboard').map(tb => {
    const checked = selectedTabs.includes(tb.id) ? 'checked' : '';
    return `
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;user-select:none">
        <input type="checkbox" class="user-modal-tab-cb" value="${tb.id}" ${checked} style="width:15px;height:15px;margin:0;cursor:pointer;accent-color:var(--blue2)">
        <span>${_escapeHtml(tb.label)}</span>
      </label>`;
  }).join('');

  document.getElementById('user-modal').classList.add('open');
  setTimeout(() => userInput.disabled ? pwInput.focus() : userInput.focus(), 80);
}

function closeUserModal() {
  document.getElementById('user-modal').classList.remove('open');
  _editingUsername = null;
}

async function saveUserFromModal() {
  const userInput = document.getElementById('user-modal-username');
  const pwInput   = document.getElementById('user-modal-password');
  const tabs = [...document.querySelectorAll('.user-modal-tab-cb')]
    .filter(cb => cb.checked).map(cb => cb.value);

  const username = (userInput.value || '').trim().toLowerCase();
  const password = pwInput.value || '';

  if (!_editingUsername) {
    // ── Yeni kullanıcı ──
    if (!username) { alert('Kullanıcı adı boş olamaz!'); return; }
    if (!/^[a-z0-9._]{3,40}$/.test(username)) {
      alert('Kullanıcı adı sadece küçük harf, rakam, nokta(.) ve alt çizgi(_) içerebilir.\nÖrnek: ahmet.ornek');
      return;
    }
    if (username === 'admin') { alert('"admin" kullanıcı adı sistem tarafından kullanılıyor, başka bir ad seçin.'); return; }
    if (_usersCache.some(u => u.username.toLowerCase() === username)) {
      alert('Bu kullanıcı adı zaten kullanılıyor!'); return;
    }
    if (!password || password.length < 4) { alert('Şifre en az 4 karakter olmalı!'); return; }

    _usersCache.push({ username, tabs, _newPassword: password });
  } else {
    // ── Mevcut kullanıcıyı düzenle ──
    const u = _usersCache.find(x => x.username === _editingUsername);
    if (!u) { alert('Kullanıcı bulunamadı!'); closeUserModal(); return; }
    if (password && password.length < 4) { alert('Şifre en az 4 karakter olmalı!'); return; }
    u.tabs = tabs;
    if (password) u._newPassword = password;
  }

  await _pushUsersToSheets();
  closeUserModal();
  renderUsersTable();
}

async function deleteUserConfirm(username) {
  if (!confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
  _usersCache = _usersCache.filter(u => u.username !== username);
  await _pushUsersToSheets();
  renderUsersTable();
}

// Tüm kullanıcı listesini Sheets'teki Users sekmesine gönderir.
// Şifre alanı sadece yeni belirlenmişse doldurulur; aksi halde boş bırakılır
// ve sunucu mevcut şifreyi korur (bkz. _writeUsers, panel-v1-gs).
async function _pushUsersToSheets() {
  if (SHEETS_DEVRE_DISI) { alert('⚠️ Google Sheets bağlantısı devre dışı bırakıldı — kullanıcı yönetimi şu anda kullanılamıyor.'); return; }
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) { alert('⚠️ Google Sheets bağlantısı yapılandırılmamış!'); return; }

  const payload = _usersCache.map(u => ({
    username: u.username,
    password: u._newPassword || '',
    tabs: u.tabs || []
  }));

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'setUsers', token, users: payload }),
      mode: 'no-cors'
    });
    // Gönderildikten sonra geçici şifreleri temizle (tekrar gönderilmesin)
    _usersCache.forEach(u => { delete u._newPassword; });
    showSuccessMessage('✅ Kullanıcılar Sheets\'e gönderildi');
  } catch(err) {
    alert('❌ Gönderme hatası: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EKİP YÖNETİMİ (Dashboard — "Ekibim")
// ══════════════════════════════════════════════════════════════════════════════
// Her ekip yöneticisi (admin olmayan kullanıcı), inspector listesinden kendi
// ekibini seçer. Ekip bilgisi Users sayfasının "Team" sütununda saklanır ve
// currentUser.team içinde (virgülle ayrılmış değil, dizi olarak) tutulur.

// performansData içinden, verilen ekip listesine (kullanıcı adları) ait
// inspectorleri, hedef verimliliğe göre normalize edilmiş "performans" alanı
// eklenmiş olarak döndürür. Genel amaçlı: hem "Ekibim" kartı hem de admin'in
// "Ekip Yöneticileri" bölümü tarafından kullanılır.
function getInspectorsForTeam(teamArr) {
  const teamSet = new Set((teamArr || []).map(n => String(n).toLowerCase()));
  if (!teamSet.size) return [];
  const hedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
  return performansData
    .filter(i => teamSet.has((i.ins || '').toLowerCase()))
    .map(inspector => {
      // "Ne ödül ne ceza": nötr kayıp zaman mesai süresinden düşülüp
      // performans buna göre hesaplanır — Dashboard ile tutarlı olması için.
      const _stdSnT = inspector.standartSure || 0;
      let _mesSnT = inspector.mesaiSure || 0;
      const _kzSnT = getNotrKayipDakikaForInspector(inspector.ins) * 60;
      if (_kzSnT > 0 && _mesSnT > _kzSnT) _mesSnT -= _kzSnT;
      const _hamPT = (_stdSnT > 0 && _mesSnT > 0)
        ? Math.round((_stdSnT / _mesSnT) * 100) : inspector.genelHizPerf;
      return {
        ...inspector,
        performans: (_hamPT !== null && _hamPT !== undefined)
          ? Math.round(_hamPT * (100 / hedef)) : 0
      };
    });
}

// performansData içinden, hedef verimliliğe göre normalize edilmiş "performans"
// alanı eklenmiş ekip üyelerini döndürür.
function getTeamInspectors() {
  if (!currentUser || currentUser.isAdmin) return [];
  return getInspectorsForTeam(currentUser.team || []);
}

// ══════════════════════════════════════════════════════════════════════════════
// EKİBİM ANALİZİ — Ekip yöneticisi için ekip üyeleri arası karşılaştırma
// ══════════════════════════════════════════════════════════════════════════════
function renderEkipAnaliz() {
  const container = document.getElementById('ekip-analiz-icerik');
  if (!container) return;
  const t = translations[currentLang] || translations.tr;

  const teamInspectors = getTeamInspectors();

  if (!performansData.length || !teamInspectors.length) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🧑‍🤝‍🧑</div>
        <h3>${t.waiting_data}</h3>
        <p>${t.waiting_data_sub}</p>
      </div>
    `;
    return;
  }

  // ── 1) Genel sıralama: performansa göre yüksekten alçağa ──────────────────
  const siraliUyeler = [...teamInspectors].sort((a, b) => (b.performans || 0) - (a.performans || 0));

  const genelSiraHtml = siraliUyeler.map((ins, idx) => {
    const klasmanSayisi = Object.keys(ins.klasmanlar || {}).length;
    const perfClass = getPerformanceClass(ins.performans || 0);
    const madalya = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1) + '.';
    return `
      <tr>
        <td style="padding:10px 12px;font-weight:700;color:var(--muted);width:36px;text-align:center">${madalya}</td>
        <td style="padding:10px 12px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(ins.ins))}</td>
        <td style="padding:10px 12px;text-align:center"><span class="${perfClass}" style="font-weight:700;font-family:'DM Mono',monospace">${ins.performans || 0}%</span></td>
        <td style="padding:10px 12px;text-align:center;font-family:'DM Mono',monospace;color:var(--navy)">${formatTR((ins.adet || 0))}</td>
        <td style="padding:10px 12px;text-align:center;font-family:'DM Mono',monospace;color:var(--muted)">${klasmanSayisi}</td>
      </tr>
    `;
  }).join('');

  // ── 2) Performans Dağılımı: ekip üyelerini bantlara ayır ──────────────────
  const bantlar = {
    excellent: { key: 'excellent', label: t.perf_excellent, color: 'var(--green)', bg: 'var(--lgreen)', count: 0 },
    good:      { key: 'good',      label: t.perf_good,      color: 'var(--blue)',  bg: 'var(--lblue3)', count: 0 },
    average:   { key: 'average',   label: t.perf_average,   color: 'var(--amber)', bg: 'var(--lamber)', count: 0 },
    weak:      { key: 'weak',      label: t.perf_weak,      color: '#EF5350',      bg: '#FFEBEE',       count: 0 },
    verypoor:  { key: 'verypoor',  label: t.perf_verypoor,  color: '#B71C1C',      bg: '#FFCDD2',       count: 0 }
  };
  teamInspectors.forEach(ins => {
    const p = ins.performans || 0;
    if (p >= 95) bantlar.excellent.count++;
    else if (p >= 85) bantlar.good.count++;
    else if (p >= 70) bantlar.average.count++;
    else if (p >= 50) bantlar.weak.count++;
    else bantlar.verypoor.count++;
  });
  const maxBantSayisi = Math.max(1, ...Object.values(bantlar).map(b => b.count));

  const dagilimHtml = Object.values(bantlar).map(b => {
    const yuzde = Math.round((b.count / teamInspectors.length) * 100);
    const barYuzde = Math.round((b.count / maxBantSayisi) * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:90px;font-size:12px;font-weight:600;color:var(--navy);flex-shrink:0">${b.label}</div>
        <div style="flex:1;background:var(--offwhite);border-radius:6px;height:22px;overflow:hidden">
          <div style="height:100%;width:${barYuzde}%;background:${b.color};border-radius:6px;transition:width .3s"></div>
        </div>
        <div style="width:70px;text-align:right;font-size:12px;font-family:'DM Mono',monospace;color:var(--muted);flex-shrink:0">${b.count} (${yuzde}%)</div>
      </div>
    `;
  }).join('');

  // ── 3) Verimlilik/Adet Dağılımı: ekip üretiminin üyeler arasındaki payı ────
  const ekipToplamAdet = teamInspectors.reduce((s, i) => s + (i.adet || 0), 0);
  const uretimSirali = [...teamInspectors].sort((a, b) => (b.adet || 0) - (a.adet || 0));
  const maxUyeAdet = Math.max(1, ...uretimSirali.map(i => i.adet || 0));

  const uretimDagilimHtml = uretimSirali.map(ins => {
    const adet = ins.adet || 0;
    const gunSayisi = ins.gunSayisi || 0;
    const gunlukOrt = gunSayisi > 0 ? Math.round(adet / gunSayisi) : 0;
    const pay = ekipToplamAdet > 0 ? Math.round((adet / ekipToplamAdet) * 100) : 0;
    const barYuzde = Math.round((adet / maxUyeAdet) * 100);
    const perfClass = getPerformanceClass(ins.performans || 0);
    return `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:130px;font-size:12px;font-weight:600;color:var(--navy);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${_escapeHtml(_formatDisplayName(ins.ins))}">${_escapeHtml(_formatDisplayName(ins.ins))}</div>
        <div style="flex:1;background:var(--offwhite);border-radius:6px;height:22px;overflow:hidden">
          <div class="${perfClass}" style="height:100%;width:${barYuzde}%;background:currentColor;border-radius:6px;transition:width .3s"></div>
        </div>
        <div style="width:64px;text-align:center;font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);flex-shrink:0">📅 ${gunSayisi} ${t.days_suffix}</div>
        <div style="width:80px;text-align:right;font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);flex-shrink:0" title="${t.ekip_analiz_daily_avg}">⌀ ${formatTR(gunlukOrt)}/${t.days_suffix_short}</div>
        <div style="width:120px;text-align:right;font-size:12px;font-family:'DM Mono',monospace;color:var(--muted);flex-shrink:0">${formatTR(adet)} (${pay}%)</div>
      </div>
    `;
  }).join('');

  // ── 4) En çok üretim yapan üye ─────────────────────────────────────────────
  const enCokUretim = [...teamInspectors].sort((a, b) => (b.adet || 0) - (a.adet || 0))[0];

  // ── Genel ekip özeti ─────────────────────────────────────────────────────
  const toplamAdet = teamInspectors.reduce((s, i) => s + (i.adet || 0), 0);
  const ortPerf = Math.round(teamInspectors.reduce((s, i) => s + (i.performans || 0), 0) / teamInspectors.length);

  container.innerHTML = `
    <!-- Üst özet kartları -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px">
      <div class="summary-stat">
        <div class="summary-stat-value">${teamInspectors.length}</div>
        <div class="summary-stat-label">${t.team_manager_member_count}</div>
      </div>
      <div class="summary-stat" style="background:linear-gradient(135deg,var(--lgreen) 0%,#fff 100%);border-color:#B2DFDB">
        <div class="summary-stat-value" style="color:${getProgressColor(ortPerf)}">${ortPerf}%</div>
        <div class="summary-stat-label">${t.team_avg_perf}</div>
      </div>
      <div class="summary-stat" style="background:linear-gradient(135deg,var(--lamber) 0%,#fff 100%);border-color:#FFE082">
        <div class="summary-stat-value" style="color:var(--amber)">${formatTR(toplamAdet)}</div>
        <div class="summary-stat-label">${t.team_manager_total_qty}</div>
      </div>
      <div class="summary-stat" style="background:linear-gradient(135deg,var(--lblue3) 0%,#fff 100%);border-color:var(--lblue)">
        <div class="summary-stat-value" style="font-size:18px;color:var(--blue)">🏅 ${_escapeHtml(_formatDisplayName(enCokUretim.ins))}</div>
        <div class="summary-stat-label">${t.ekip_analiz_top_producer} · ${formatTR((enCokUretim.adet || 0))}</div>
      </div>
    </div>

    <!-- Genel sıralama tablosu -->
    <div style="background:#fff;border:1px solid var(--border2);border-radius:12px;overflow:hidden;margin-bottom:20px">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border2);font-weight:700;color:var(--navy)">
        🏆 ${t.ekip_analiz_general_ranking}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8f9fa">
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">#</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">${t.ekip_analiz_col_name}</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">${t.ekip_analiz_col_perf}</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">${t.ekip_analiz_col_qty}</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">${t.ekip_analiz_col_klasman_count}</th>
          </tr>
        </thead>
        <tbody>${genelSiraHtml}</tbody>
      </table>
    </div>

    <!-- Performans Dağılımı -->
    <div style="background:#fff;border:1px solid var(--border2);border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="font-weight:700;color:var(--navy);margin-bottom:12px">📊 ${t.ekip_analiz_dist_title}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${dagilimHtml}
      </div>
    </div>

    <!-- Verimlilik/Adet Dağılımı -->
    <div style="background:#fff;border:1px solid var(--border2);border-radius:12px;padding:16px;margin-bottom:8px">
      <div style="font-weight:700;color:var(--navy);margin-bottom:12px">📦 ${t.ekip_analiz_uretim_title}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${uretimDagilimHtml}
      </div>
    </div>
  `;
}

// Admin görünümünde, her ekip yöneticisi için özet kart oluşturur:
// kullanıcı adı, çalışan sayısı, toplam kontrol edilen adet ve performans
// ortalaması. _usersCache'teki "team" alanına sahip (admin olmayan)
// kullanıcılar üzerinden çalışır.
// (tasindi: _teamManagersOpen artik dosyanin basinda tanimli)

function toggleTeamManagersSection() {
  _teamManagersOpen = !_teamManagersOpen;
  const grid = document.getElementById('team-managers-grid');
  const chevron = document.getElementById('team-managers-chevron');
  if (grid) grid.style.display = _teamManagersOpen ? '' : 'none';
  if (chevron) chevron.style.transform = _teamManagersOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

async function renderTeamManagersSection() {
  const section = document.getElementById('team-managers-section');
  const grid = document.getElementById('team-managers-grid');
  if (!section || !grid) return;

  const isAdmin = !currentUser || currentUser.isAdmin;
  if (!isAdmin || !performansData.length) {
    section.style.display = 'none';
    return;
  }

  // _usersCache henüz yüklenmediyse (Kullanıcılar sekmesine girilmemiş olabilir),
  // sessizce yükle.
  if (!_usersCache.length) {
    await _silentLoadUsersCache();
  }

  const managers = _usersCache.filter(u => (u.team || []).length > 0);
  if (!managers.length) {
    section.style.display = 'none';
    return;
  }

  const countLbl = document.getElementById('team-managers-count');
  if (countLbl) countLbl.textContent = `${managers.length} ekip`;

  // Mevcut açık/kapalı durumunu koru (varsayılan: kapalı)
  grid.style.display = _teamManagersOpen ? '' : 'none';
  const chevron = document.getElementById('team-managers-chevron');
  if (chevron) chevron.style.transform = _teamManagersOpen ? 'rotate(90deg)' : 'rotate(0deg)';

  const t = translations[currentLang] || translations.tr;

  grid.innerHTML = managers.map(mgr => {
    const teamInspectors = getInspectorsForTeam(mgr.team);
    const total = teamInspectors.length;
    const totalAdet = teamInspectors.reduce((s, i) => s + (i.adet || 0), 0);
    const avgPerf = total > 0
      ? Math.round(teamInspectors.reduce((s, i) => s + (i.performans || 0), 0) / total)
      : 0;

    const perfColor = getProgressColor(avgPerf);

    return `
      <div class="card team-manager-card" style="margin-bottom:0;overflow:hidden">
        <div class="card-header" style="background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 100%);border-bottom:none;padding:10px 14px">
          <h2 style="color:#fff;gap:8px;font-size:12px">
            <span style="background:rgba(255,255,255,.12);border-radius:6px;padding:3px 6px;font-size:12px">🧑‍💼</span>
            <span>${t.team_manager_prefix}: ${_escapeHtml(_formatDisplayName(mgr.username))}</span>
          </h2>
        </div>
        <div class="card-body" style="padding:12px 14px">
          ${total > 0 ? `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              <div style="text-align:center;padding:8px 4px;border-radius:8px;background:var(--lblue3);border:1px solid var(--border2)">
                <div style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;line-height:1">${total}</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-top:4px">${t.team_manager_member_count}</div>
              </div>
              <div style="text-align:center;padding:8px 4px;border-radius:8px;background:var(--lamber);border:1px solid #FFE082">
                <div style="font-size:18px;font-weight:700;color:var(--amber);font-family:'DM Mono',monospace;line-height:1">${formatTR(totalAdet)}</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-top:4px">${t.team_manager_total_qty}</div>
              </div>
              <div style="text-align:center;padding:8px 4px;border-radius:8px;background:var(--lgreen);border:1px solid #B2DFDB">
                <div style="font-size:18px;font-weight:700;color:${perfColor};font-family:'DM Mono',monospace;line-height:1">${avgPerf}%</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-top:4px">${t.team_manager_avg_perf}</div>
              </div>
            </div>
          ` : `
            <div style="text-align:center;color:var(--muted);font-size:12px;padding:4px 0">${t.team_manager_no_members}</div>
          `}
        </div>
      </div>
    `;
  }).join('');

  section.style.display = '';
}

// _usersCache'i (Kullanıcılar sekmesine girmeden) sessizce doldurur.
// Hata olursa _usersCache boş bırakılır; section gizli kalır.
async function _silentLoadUsersCache() {
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token) return;
  try {
    const data = await jsonpFetch(url, { action: 'getUsers', token });
    if (data.status === 'ok') {
      _usersCache = (data.users || []).map(u => ({ username: u.username, tabs: u.tabs || [], team: u.team || [] }));
    }
  } catch(e) {
    console.warn('_silentLoadUsersCache hatası:', e.message);
  }
}

// "Ekibim" kartını (özet istatistikler + üye listesi) çizer.
// Admin için kart zaten gizlidir (applyUserPermissions), burada sadece veriyi günceller.
function renderTeamSection() {
  const card = document.getElementById('my-team-card');
  if (!card) return;
  if (!currentUser || currentUser.isAdmin) return;

  const t = translations[currentLang] || translations.tr;
  const teamInspectors = getTeamInspectors();
  const total = teamInspectors.length;

  const avgPerf = total > 0
    ? Math.round(teamInspectors.reduce((s, i) => s + (i.performans || 0), 0) / total)
    : 0;
  const totalProducts = teamInspectors.reduce((s, i) => s + (i.adet || 0), 0);
  const avgDays = total > 0
    ? Math.round(teamInspectors.reduce((s, i) => s + (i.gunSayisi || 0), 0) / total)
    : 0;

  const elMembers  = document.getElementById('team-total-members');
  const elAvgPerf  = document.getElementById('team-avg-perf');
  const elProducts = document.getElementById('team-total-products');
  const elAvgDays  = document.getElementById('team-avg-days');
  if (elMembers)  elMembers.textContent  = total;
  if (elAvgPerf)  elAvgPerf.textContent  = avgPerf + '%';
  if (elProducts) elProducts.textContent = formatTR(totalProducts);
  if (elAvgDays)  elAvgDays.textContent  = avgDays + ' ' + t.days_suffix;


  const listEl = document.getElementById('team-members-list');
  if (!listEl) return;

  if (!total) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px;width:100%">${t.team_empty_hint}</div>`;
    return;
  }

  listEl.innerHTML = teamInspectors
    .sort((a, b) => (b.performans || 0) - (a.performans || 0))
    .map(i => {
      const perf  = i.performans || 0;
      const color = getProgressColor(perf);
      const ini   = (i.ins || '').split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
      const safeName = _escapeHtml(i.ins);
      const jsName   = safeName.replace(/'/g, "\\'");
      return `
        <div class="team-member-chip">
          <div class="avatar">${ini}</div>
          <div style="flex:1;min-width:0;cursor:pointer" onclick="showInspectorDetail('${jsName}')">
            <div class="tm-name">${safeName}</div>
            <div class="tm-perf" style="color:${color}">${perf}%</div>
          </div>
          <button class="tm-remove" title="${t.remove_from_team}" onclick="removeFromTeam('${jsName}')">✕</button>
        </div>`;
    }).join('');
}

// Ekipten bir inspector çıkarır (admin dede yetkisi gibi değil — sadece kendi ekibi).
async function removeFromTeam(name) {
  if (!currentUser || currentUser.isAdmin) return;
  const t = translations[currentLang] || translations.tr;
  if (!confirm(`"${name}" ${t.team_remove_confirm}`)) return;
  currentUser.team = (currentUser.team || []).filter(n => n !== name);
  try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser)); } catch(e) {}
  renderTeamSection();
  await _pushTeamToSheets();
}

// currentUser.team listesini Sheets'teki Users sayfasına gönderir (tek satır günceller).
async function _pushTeamToSheets() {
  if (SHEETS_DEVRE_DISI) return;
  const url   = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url || !token || !currentUser) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'setUserTeam', token, username: currentUser.username, team: currentUser.team || [] }),
      mode: 'no-cors'
    });
  } catch(err) {
    console.warn('Ekip güncelleme hatası:', err.message);
  }
}

// ── Diğer Ekipler Popup ──────────────────────────────────────────────────────
async function toggleDigerEkipler(e) {
  e.stopPropagation();
  const popup = document.getElementById('diger-ekipler-popup');
  const btn   = document.getElementById('btn-diger-ekipler');
  if (!popup) return;
  const isOpen = popup.style.display !== 'none';
  if (isOpen) { popup.style.display = 'none'; return; }

  const t = translations[currentLang] || translations.tr;
  const liste = document.getElementById('diger-ekipler-liste');

  // Popup'ı hemen aç, yükleniyorsa göster
  liste.innerHTML = `<div style="padding:10px 14px;font-size:12px;color:var(--muted)">⏳ Yükleniyor...</div>`;
  popup.style.display = '';

  // Buton konumuna göre popup'ı konumlandır (position:fixed, kart taşmasından bağımsız)
  if (btn) {
    const rect = btn.getBoundingClientRect();
    const popupWidth = Math.min(280, window.innerWidth * 0.9);
    let left = rect.right - popupWidth;
    if (left < 8) left = 8;
    let top = rect.bottom + 8;
    // Eğer popup ekranın altına taşıyorsa, butonun üstüne aç
    const estimatedHeight = Math.min(360, window.innerHeight * 0.6);
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 8);
    }
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  // Cache boşsa bekleyerek yükle
  if (!_usersCache.length) await _silentLoadUsersCache();

  const myUsername = currentUser?.username || '';
  const managers = _usersCache.filter(u => u.username !== myUsername && (u.team || []).length > 0);

  if (!managers.length) {
    liste.innerHTML = `<div style="padding:10px 14px;font-size:12px;color:var(--muted)">${t.other_teams_empty}</div>`;
    return;
  }

  liste.innerHTML = managers.map(mgr => {
    const members = getInspectorsForTeam(mgr.team);
    const avgPerf = members.length
      ? Math.round(members.reduce((s, i) => s + (i.performans || 0), 0) / members.length)
      : null;
    const perfColor = avgPerf === null ? 'var(--muted)' : getProgressColor(avgPerf);
    const perfStr = avgPerf !== null
      ? `<span style="font-weight:700;color:${perfColor};font-family:'DM Mono',monospace">${avgPerf}%</span>`
      : `<span style="color:var(--muted);font-size:11px">—</span>`;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid var(--border2)">
        <span style="font-size:13px;font-weight:600;color:var(--navy)">${_escapeHtml(_formatDisplayName(mgr.username))}</span>
        ${perfStr}
      </div>
    `;
  }).join('');
}

// ── Ekibimi Düzenle Modalı ───────────────────────────────────────────────────
let _teamModalSelection = new Set();

function openTeamModal() {
  if (!currentUser || currentUser.isAdmin) return;
  if (!performansData.length) {
    alert('⚠️ Henüz performans verisi yok. Önce Performans Analizi sayfasından veri yükleyin.');
    return;
  }
  _teamModalSelection = new Set(currentUser.team || []);
  const searchEl = document.getElementById('team-modal-search');
  if (searchEl) searchEl.value = '';
  renderTeamModalList();
  document.getElementById('team-modal').classList.add('open');
}

function closeTeamModal() {
  document.getElementById('team-modal').classList.remove('open');
}

function renderTeamModalList() {
  const t = translations[currentLang] || translations.tr;
  const search = (document.getElementById('team-modal-search')?.value || '').toLowerCase();
  const listEl = document.getElementById('team-modal-list');
  if (!listEl) return;

  const hedef = Math.max(1, parseFloat(document.getElementById('inp-verimlilik')?.value) || 100);
  const perfByName = {};
  performansData.forEach(i => {
    const p = i.verimlilikPerf !== null && i.verimlilikPerf !== undefined
      ? i.verimlilikPerf
      : (i.genelHizPerf !== null && i.genelHizPerf !== undefined ? Math.round(i.genelHizPerf * (100 / hedef)) : null);
    perfByName[i.ins] = p;
  });

  const names = [...new Set(performansData.map(i => i.ins))].sort((a, b) => a.localeCompare(b, 'tr'));
  const filtered = names.filter(n => n.toLowerCase().includes(search));

  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--muted);font-size:12px">${t.team_no_result}</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(n => {
    const checked = _teamModalSelection.has(n) ? 'checked' : '';
    const safe = _escapeHtml(n);
    const jsName = safe.replace(/'/g, "\\'");
    const p = perfByName[n];
    const perfBadge = p !== null && p !== undefined
      ? `<span style="font-size:11px;font-weight:700;color:${getProgressColor(p)}">${p}%</span>`
      : `<span style="font-size:11px;color:var(--muted)">—</span>`;
    return `
      <label style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;cursor:pointer;padding:6px 8px;border-radius:6px;background:#fff;border:1px solid var(--border2)">
        <span style="display:flex;align-items:center;gap:8px;min-width:0">
          <input type="checkbox" ${checked} onchange="_teamModalToggle('${jsName}', this.checked)" style="width:15px;height:15px;margin:0;cursor:pointer;accent-color:var(--blue2);flex-shrink:0">
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe}</span>
        </span>
        ${perfBadge}
      </label>`;
  }).join('');
}

function _teamModalToggle(name, checked) {
  if (checked) _teamModalSelection.add(name);
  else _teamModalSelection.delete(name);
}

async function saveTeamFromModal() {
  currentUser.team = [..._teamModalSelection];
  try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser)); } catch(e) {}
  closeTeamModal();
  renderTeamSection();
  await _pushTeamToSheets();
  showSuccessMessage('✅ Ekibiniz güncellendi');
}

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
    const today = new Date().toISOString().split('T')[0];
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
  const tarih          = document.getElementById('ii-tarih')?.value || new Date().toISOString().split('T')[0];

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

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('⚠️ Sunucu bağlantısı yapılandırılmamış.'); return; }

  teknikHedefler = { teknikDegerlendirmeGunluk, ikinciInspectionGunluk };
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
        ikinciInspectionGunluk: Number(data.hedefler.ikinciInspectionGunluk) || 5
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

// ─── Tüm veriyi sil ───
async function clearAllKayipZaman() {
  if (!confirm('⚠️ Tüm kayıp zaman verileri silinecek!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?')) return;
  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('Sheets bağlantısı yok.'); return; }
  const btn = document.getElementById('kz-clear-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Siliniyor...'; }
  try {
    await jsonpFetch(url, { action: 'clearKayipZaman', token });
    kayipZamanData = [];
    _kzLastFetchTime = 0;
    saveKayipZamanToLocalStorage();
    renderKayipZamanAdminAll();
    updateKayipNavBadge();
    showSuccessMessage('✅ Kayıp zaman verileri silindi!');
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Tüm Veriyi Sil'; }
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
  const tarihStr = new Date().toISOString().split('T')[0];
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
  if (tarihEl && !tarihEl.value) tarihEl.value = new Date().toISOString().split('T')[0];
  const iiTarihEl = document.getElementById('ii-tarih');
  if (iiTarihEl && !iiTarihEl.value) iiTarihEl.value = new Date().toISOString().split('T')[0];

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

  // "Temizle" butonları (toplu silme) admin'e özel kalır — görüntüleme ve
  // kayıt ekleme herkese açık olsa da, tüm kayıtları silme yetkisi sadece
  // admin'de olmalı (kullanıcı talebiyle).
  const tiClearBtn = document.getElementById('ti-clear-btn');
  if (tiClearBtn) tiClearBtn.style.display = isAdmin ? '' : 'none';
  const iiClearBtn = document.getElementById('ii-clear-btn');
  if (iiClearBtn) iiClearBtn.style.display = isAdmin ? '' : 'none';

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
    teknikSkorlar.push({
      id: Date.now().toString(),
      inspector, degerlendiren: evaluation.degerlendiren, tarih, talepNo,
      maxPuan: maxToplam, kazanilanPuan: kazanilanToplam,
      skorYuzde: maxToplam > 0 ? Math.round((kazanilanToplam / maxToplam) * 100) : 0,
      maddeSayisi: cevaplar.length, tikliSayisi, savedAt: now
    });
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
        <h3>Değerlendirme kaydedildi!</h3>
        <p>Yeni bir değerlendirme için yukarıdan Talep No girin</p>
      </div>`;
    }
    renderTiSkorOzet();
    if (!currentUser || currentUser.isAdmin) renderTiKayitlarTablo();
    // Dashboard kartlarında da güncel görünsün
    if (typeof renderDashboard === 'function' && document.getElementById('inspector-grid')) renderDashboard();
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Değerlendirmeyi Kaydet'; }
  }
}

// ─── Skor Özeti Tablosu ───
// ─── Teknik İnceleme Sayfalama (kullanıcı talebiyle eklendi — 15/sayfa) ───
const TI_SAYFA_BOYUTU = 15;
let tiSkorSayfa = 1;
let tiKayitSayfa = 1;

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
    return { percent, count: cevaplar.length, seviye: getPerformanceLevelLabel(percent) };
  };

  const rows = sayfaIsimleri.map(ins => {
    const s = skorHesapla(ins);
    const color = getProgressColor(s.percent);
    return `<tr>
      <td style="padding:8px 10px;font-size:13px;color:var(--navy);font-weight:500">${_escapeHtml(_formatDisplayName(ins))}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:700;color:${color}">${s.percent}%</td>
      <td style="padding:8px 10px;font-size:12px;color:${color}">${s.seviye}</td>
      <td style="padding:8px 10px;font-size:12px;color:var(--muted2)">${s.count} madde cevabı</td>
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
  const tarihStr = new Date().toISOString().split('T')[0];
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
  const tarihStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Ikinci_Inspection_Kayitlari_${tarihStr}.xlsx`);
}

// ─── İkinci Inspection Kayıtları Tablosu ───
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
  const rows = satirlar.map(r => {
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
      <td style="padding:7px 10px;font-size:11.5px;color:var(--muted2)">${_escapeHtml(r.notAlani || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted2)">${_escapeHtml(r.tarih || '—')}</td>
      <td style="padding:7px 10px;font-size:11.5px;color:var(--muted)">${_escapeHtml(_formatDisplayName(r.degerlendiren || '—'))}</td>
    </tr>`;
  }).join('');
  const geciSayisi = satirlar.filter(r => r.sonuc === 'Geçti').length;
  wrap.innerHTML = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--muted2)">
      <strong style="color:var(--navy)">${geciSayisi}</strong> / ${satirlar.length} kayıt "Geçti"
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
  </table>`;
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
    'Aktif Gün (Teknik Değ.)': s.tdGunSayisi,
    'Bugün İkinci Inspection': s.iiBugun,
    'Hedef (İkinci Insp.)': hedefII,
    'Ort. İkinci Insp./Gün (aktif gün bazlı)': s.iiOrtalama !== null ? Math.round(s.iiOrtalama * 10) / 10 : '—',
    'Aktif Gün (İkinci Insp.)': s.iiGunSayisi,
    'İkinci Insp. Geçti/Toplam Oranı (%)': s.iiGeciOrani !== null ? s.iiGeciOrani : '—',
    'Genel Performans (%)': s.genelPerf !== null ? s.genelPerf : '—'
  }));

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    {wch:22},{wch:24},{wch:16},{wch:30},{wch:20},{wch:22},{wch:16},{wch:30},{wch:20},{wch:26},{wch:18}
  ];
  XLSX.utils.book_append_sheet(workbook, ws, 'Teknik Değ. Uzmanları');
  const tarihStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Teknik_Degerlendirme_Uzmanlari_Performans_${tarihStr}.xlsx`);
}

function renderTiDashboard() {
  const wrap = document.getElementById('ti-dashboard-wrap');
  if (!wrap) return;

  const bugun = new Date().toISOString().split('T')[0];
  const hedefTD = teknikHedefler.teknikDegerlendirmeGunluk || 3;
  const hedefII = teknikHedefler.ikinciInspectionGunluk || 5;

  // Hem Teknik Değerlendirme hem İkinci Inspection'da görünen tüm "giren
  // kullanıcı"ları topla (birleşik liste — biri diğerini yapmamış olsa bile
  // listede görünür, o metrikte 0 gösterilir).
  const kullanicilar = new Set();
  teknikSkorlar.forEach(s => { if (s.degerlendiren) kullanicilar.add(s.degerlendiren); });
  ikinciInspectionData.forEach(r => { if (r.degerlendiren) kullanicilar.add(r.degerlendiren); });

  const satirlar = Array.from(kullanicilar).sort((a,b) => a.localeCompare(b,'tr')).map(kullanici => {
    const tdKayitlari = teknikSkorlar.filter(s => s.degerlendiren === kullanici);
    const tdGunSet = new Set(tdKayitlari.map(s => s.tarih).filter(Boolean));
    const tdBugun = tdKayitlari.filter(s => s.tarih === bugun).length;
    const tdOrtalama = tdGunSet.size > 0 ? (tdKayitlari.length / tdGunSet.size) : null;

    const iiKayitlari = ikinciInspectionData.filter(r => r.degerlendiren === kullanici);
    const iiGunSet = new Set(iiKayitlari.map(r => r.tarih).filter(Boolean));
    const iiBugun = iiKayitlari.filter(r => r.tarih === bugun).length;
    const iiOrtalama = iiGunSet.size > 0 ? (iiKayitlari.length / iiGunSet.size) : null;

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

    return { kullanici, tdBugun, tdOrtalama, tdGunSayisi: tdGunSet.size,
             iiGeciSayisi, iiGeciOrani,
             iiBugun, iiOrtalama, iiGunSayisi: iiGunSet.size, genelPerf };
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
      <td style="padding:8px 10px;text-align:center;font-size:12px">${rozet(s.tdOrtalama, hedefTD)} <span style="color:var(--muted2);font-size:10.5px">(${s.tdGunSayisi} aktif gün)</span></td>
      <td style="padding:8px 10px;text-align:center">${bugunRozet(s.iiBugun, hedefII)}</td>
      <td style="padding:8px 10px;text-align:center;font-size:12px">${rozet(s.iiOrtalama, hedefII)} <span style="color:var(--muted2);font-size:10.5px">(${s.iiGunSayisi} aktif gün)</span></td>
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


async function temizleTeknikIncelemeVerileri() {
  if (!currentUser || !currentUser.isAdmin) { alert('⚠️ Bu işlem sadece admin tarafından yapılabilir.'); return; }
  if (!confirm('⚠️ Tüm Teknik İnceleme değerlendirme kayıtları silinecek!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?')) return;
  if (!confirm('Son kez soruyoruz: Teknik İnceleme verilerini kalıcı olarak silmek istediğinize emin misiniz?')) return;

  const url = appConfig.sheetsWebAppUrl;
  const token = appConfig.sheetsApiToken;
  if (!url) { alert('Sheets bağlantısı yok.'); return; }
  const btn = document.getElementById('ti-clear-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Siliniyor...'; }
  try {
    const resp = await jsonpFetch(url, { action: 'clearTeknikIncelemeSkorlar', token });
    if (!resp || resp.status !== 'ok') {
      alert('❌ Sheets tarafında silme işlemi başarısız oldu: ' + (resp?.message || 'Bilinmeyen hata') + '\n\nYerel görünüm değiştirilmedi, lütfen tekrar deneyin.');
      return;
    }
    teknikSkorlar = [];
    saveTeknikIncelemeToLocalStorage();
    renderTiSkorOzet();
    renderTiKayitlarTablo();
    if (typeof renderDashboard === 'function' && document.getElementById('inspector-grid')) renderDashboard();
    showSuccessMessage('✅ Teknik İnceleme verileri silindi!');
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Temizle'; }
  }
}
