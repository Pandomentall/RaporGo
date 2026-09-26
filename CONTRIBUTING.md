# Katkı

## Kurulum

Depo pnpm workspace'i kullanıyor; `npm install` bir `preinstall` denetimiyle
reddedilir, çünkü npm ne `workspace:*` protokolünü ne de
`pnpm-workspace.yaml`'ı tanır ve sessizce bozuk bir `node_modules` bırakır.

```bash
pnpm install
pnpm --filter @raporgo/render exec playwright install chromium   # CLI ve testler için
pnpm build
```

Editör PDF'i Electron'un kendi Chromium'uyla basar (`apps/desktop/src/main/pdf.ts`) ve
yalnızca `@raporgo/render/html` alt yolunu içe aktarır; Playwright uygulamaya girmez.
Uygulamayı Playwright'ın `_electron` sürücüsüyle otomatik sürerken `RAPORGO_USER_DATA`
ortam değişkeniyle ayrı bir profil ver, yoksa gerçek ayarlar ve son dosyalar listesi değişir.

Masaüstü uygulamasını çalıştırmak için:

```bash
pnpm dev
```

## Kontroller

```bash
pnpm typecheck
pnpm test
```

Henüz ESLint kurulu değil; tip denetimi ve testler CI'daki tek kapı. Kod
İngilizce. README İngilizce, Türkçesi `README.tr.md`; ikisini birlikte güncelle.
Diğer belgeler (bu dosya, `docs/`) Türkçe; arayüz metinleri on dilde (aşağıda).

## Şablonu değiştirdiğinde

Şablonun yerleşimi bir testle sabitlenmiş durumda: showcase raporu
(`examples/showcase/en/q3-operations-report.json`) basılır ve her segmentin
kutusu kayıtlı taban çizgisiyle karşılaştırılır. Bir stil değişikliği yaptığında testler kayan her segmenti tek tek
söyler. Değişiklik kasıtlıysa taban çizgisini yenile ve **diff'i oku** —
içinde beklemediğin bir satır varsa, farkında olmadan başka bir şeyi de
oynatmışsın demektir:

```bash
pnpm --filter @raporgo/render run baseline
```

## Yeni şablon eklerken

Bir şablon, `packages/templates/src/base/segments.ts` içindeki ortak HTML'in
üstüne yazılmış bir stil sayfasıdır; segment markup'ına dokunma, sınıf adları
sözleşmedir. `sozlesme/` klasörünü örnek al: `css.ts` sayfa geometrisi, yazı
tipi (`fontFaceCss(['serif','mono'])` gibi, yalnızca kullandığın aileler) ve
segment stillerini üretir; grafik, görsel, kod ve imza kuralları için
`base/css.ts`'teki `sharedCss` ile başla. `index.ts`'te `Template` nesnesini
kur, `src/index.ts`'teki registry'ye ve `catalog.ts`'e ekle,
`TemplatePicker.tsx`'e bir küçük resim çiz. `templates.test.ts` her şablonu
her segment tipiyle basar; `docs/LLM.md` ve README'deki şablon tablolarına
satır ekle.

Paged.js'nin iki huyu: `::first-letter` gibi sözde elemanları `+` gibi
birleştiricilerle aynı seçicide kullanma (seçiciyi bozuyor — bunun için
markup `rg-paragraph--opening` sınıfını veriyor), ve kenar kutularının
içeriği (`.pagedjs_margin-content`) tam genişlik alır, dar bir şey istiyorsan
`width` ile `!important` gerekir.

## Yeni segment tipi eklerken

Sıra şu, beşi de gerekli:

1. `packages/core/src/schema.ts` — Zod şeması ve `segmentTypes` listesi
2. `packages/templates/src/base/segments.ts` — HTML çıktısı (her şablon paylaşır);
   düzenlenebilir metin taşıyan her elemana `data-edit` yolunu koy
3. `packages/templates/src/mavi-resmi/css.ts` ve diğer şablonların `css.ts`'leri —
   stiller; her şablonda ortak olan kural `base/css.ts`'e
4. `apps/desktop/src/renderer/state.ts` ve `components/Inspector.tsx` —
   başlangıç içeriği, renk ve özellik alanları; `fields.tsx` içine bir glyph
5. `apps/desktop/src/renderer/i18n/` — `segment.<tip>` etiketi ve inspector'da
   kullandığın her metin, on sözlüğün hepsine. Referans `tr.ts`; diğerleri onun
   anahtarlarına karşı tiplidir, eksik çeviri derlemede yakalanır. Arayüzde düz
   literal bırakma.

Sonra `pnpm --filter @raporgo/core run schema` ile yayınlanan JSON Schema'yı
ve `docs/LLM.md` içindeki segment tablosunu güncelle — LLM'ler orayı okuyor.

## Paketleme

```bash
npm --prefix apps/desktop run package   # release/win-unpacked, kurulumsuz
npm --prefix apps/desktop run dist      # release/RaporGo-Setup-<sürüm>.exe (NSIS)
```

Ayarlar `apps/desktop/electron-builder.yml`'da. İkon `apps/desktop/build/icon.png`
(1024px; Windows `.ico`'su derlemede üretilir). Playwright pakete girmez, Chromium'un dil
dosyaları uygulamanın on diliyle sınırlı. `.json` uzantısı bilerek ilişkilendirilmiyor —
makinedeki her JSON dosyası RaporGo'ya bağlanırdı; "Birlikte aç" yine çalışır ve uygulama
açıksa dosya mevcut pencerede açılır (tek örnek kilidi). Kod imzası henüz yok: Windows
SmartScreen ilk kurulumda uyarı gösterir.

## Diller

Arayüz metinleri `apps/desktop/src/renderer/i18n/<dil>.ts`, diyalog ve menü metinleri
`apps/desktop/src/main/i18n.ts`, desteklenen diller `apps/desktop/src/shared/settings.ts`
içindeki `APP_LANGUAGES`. Şablonların sayfaya kendi bastığı kelimeler ("Sayfa 3", "Şekil",
sözleşmenin madde etiketi) `packages/templates/src/base/labels.ts` tablosunda, belgenin
`meta.language` değerine göre seçilir. Yeni bir dil bu üç yere birlikte girer; `tr.ts`'e
eklenen her yeni anahtar da on sözlüğe.

## Commit

Konusal, açıklayıcı commit'ler; mesajda *ne* yapıldığı kadar *neden*
yapıldığı da olsun.
