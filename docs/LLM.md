# RaporGo — LLM Sözleşmesi

Bu belge, bir LLM'in RaporGo raporunu **tek okumada** anlayıp düzenleyebilmesi için yazıldı.
Claude Code, Codex, Gemini CLI gibi kod çalıştırabilen bir araca bu dosyayı verirsen başka
hiçbir şeye ihtiyacı olmaz.

## Zihinsel model

Bir rapor, uygulamanın içinde tutulan bir state değil, **diskte duran bir dosyadır**:

```
raporlar/
├─ q3-raporu.json        ← raporun tamamı; tek doğruluk kaynağı (adı serbest)
└─ image_Assets/         ← raporun kullandığı görseller (base64 değil, dosya)
   └─ ekran-1.png
```

Rapor dosyası üzerinde üç istemci çalışır ve üçü de eşittir: masaüstü editörü, `raporgo` CLI
ve sen. Dosyayı doğrudan düzenleyebilirsin, ama CLI'yi kullanmak daha güvenlidir çünkü her
yazma işleminden önce şema doğrulaması yapar ve segment id'lerini kendi tamamlar.

Her rapor dosyasının en üstünde bir `_llm` dizisi durur: dosyayı tek başına alan bir LLM'e
biçimi anlatan kısa İngilizce satırlar (segment tipleri, alanlar, satır içi işaretler,
şablonlar). Şemadan üretilir ve editör ya da CLI her kayıtta yeniden yazar; okurken yok
sayılır. Kullanıcı bu belgeyi değil yalnızca `.json`'u verdiyse, bilmen gereken her şey orada.

## Şablonlar

`template` alanı sayfanın karakterini seçer; segmentler her şablonda aynı çalışır. Raporun
türüne göre seç:

| Şablon | Ne zaman |
|---|---|
| `mavi-resmi` | Kurumsal rapor, proje raporu, durum raporu (varsayılan) |
| `sozlesme` | Sözleşme, protokol, tutanak — `section` başlıkları `MADDE n` olarak basılır, sonuna `signature` koy |
| `sade-teknik` | Teknik not, tasarım belgesi, kurulum kılavuzu |
| `sunum-raporu` | Yönetim sunumu; yatay sayfa, her `section` yeni bir sayfa açar — bölümleri kısa tut |
| `akademik` | Makale, tez bölümü; `lead: true` paragraf özet olarak basılır, görseller ve tablolar numaralanır |
| `bulten` | Bülten, duyuru; `callout` alıntı kutusu olur, bölümü açan paragraf büyük harfle başlar |

## Dosya biçimi

```jsonc
{
  "schemaVersion": "1.0",
  "template": "mavi-resmi",
  "meta": {
    "title": "Q3 Operasyon Raporu",            // zorunlu
    "subtitle": "Destek, teslimat ve altyapı",
    "eyebrow": "ÇEYREK RAPORU",                // kapaktaki küçük üst etiket
    "date": "Eylül 2026",                      // sayfa üstü bandın sağı
    "headerText": "Operasyon Raporu",          // sayfa üstü bandın solu
    "footerText": "Operasyon Ekibi",           // sayfa altı bandın solu
    "language": "tr"                           // tr en es de fr pt-BR it ru zh-CN ja
  },
  "theme": { "preset": "lacivert", "overrides": { "accent": "#f0a500" } },
  "segments": [ /* sırayla basılan bloklar */ ]
}
```

Tam ve kesin tanım için: `raporgo schema` (veya `schema/rapor-1.0.json`).

`meta.language` heceleme ile şablonun kendi bastığı kelimeleri ("Sayfa 3", "Şekil 2",
sözleşmenin madde etiketi) seçer. Gömülü fontlarda Çince ve Japonca glif yoktur; bu
dillerde metin sistem fontuyla basılır (Windows'ta sorunsuz, font gömme garantisi yok).

### Segmentler

Her segmentin `type` alanı ve kalıcı bir `id`'si vardır. `id` vermezsen RaporGo içerikten
okunabilir bir tane üretir (`section-uygulama-ne-ise-yarar` gibi) — ama **var olan bir
segmenti düzenlerken id'sini asla değiştirme**, adresleme buna dayanıyor.

| type | Alanlar | Ne için |
|---|---|---|
| `cover` | `eyebrow?`, `title?`, `subtitle?` | Kapak bloğu. Boş bırakılan alanlar `meta`'dan gelir |
| `section` | `title`, `number?` | Numaralı rozetli ana başlık. `number` verilmezse sırayla numaralanır |
| `subheading` | `text` | Ara başlık |
| `paragraph` | `text`, `lead?`, `align?` | Gövde metni |
| `list` | `items[]`, `ordered?` | Madde listesi |
| `keyValueTable` | `headers?[2]`, `rows[][2]` | Künye / özellik tablosu |
| `table` | `columns[]`, `rows[][]` | Genel tablo. Sütun: `{ label, width?, mono?, align? }` |
| `steps` | `items[]{title, desc?}`, `start?` | Numaralı akış adımları |
| `callout` | `variant`, `text`, `title?` | Uyarı kutusu: `info` `warning` `success` `danger` `note` |
| `chart` | `chart`, `data[]`, `title?`, `subtitle?`, `caption?`, `unit?`, `max?`, `scale?`, `marker?` | Grafik — aşağıya bak |
| `image` | `src`, `caption?`, `width?`, `border?` | Görsel. `src` dosyaya göreli yol |
| `code` | `content`, `language?` | Kod bloğu |
| `signature` | `parties[]{name, title?}`, `date?` | İmza satırları; sözleşme, tutanak, protokol sonu. En çok dört taraf |
| `pageBreak` | — | Sayfa sonu |
| `spacer` | `size` | Boşluk: `sm` `md` `lg` |

Her segment ayrıca `note` alabilir: sana ve kullanıcıya not, PDF'e **basılmaz**.

### Grafikler

Grafik **veriyle** tanımlanır, çizimi şablon yapar. SVG üretip görsel olarak eklemeye
çalışma: o zaman grafik temayı takip etmez, belgenin fontunu kullanmaz ve kullanıcı
editörden düzenleyemez.

```jsonc
{
  "type": "chart",
  "chart": "bar",              // aşağıdaki 11 türden biri
  "title": "Kod tabanlarında açık kaynak",
  "subtitle": "Kaynak · yıl",  // başlığın altındaki küçük satır
  "caption": "Grafiğin altındaki açıklama",
  "unit": "%",                 // her değerin sonuna eklenir
  "max": 100,                  // eksen üst sınırı; verilmezse veriden çıkarılır
  "scale": "linear",           // bar için: linear | log
  "marker": { "at": "2016", "label": "Let's Encrypt" },   // line için dikey çizgi
  "data": [
    { "label": "Etiket", "value": 96, "color": "primary", "note": "alt açıklama" },
    { "label": "Diğeri", "value": 4150000000, "text": "4,15 milyar $" }
  ]
}
```

- **`color`** palet adı olsun (`primary`, `primaryAlt`, `accent`, `info`, `success`,
  `danger`, `note`, `muted`) — o zaman tema değişince grafik de değişir. Hex de kabul
  edilir ama tema bağını koparır. Hiç vermezsen sırayla dağıtılır.
- **`text`**, sayının yerine yazılır: `8800000000000` değeri için `"8,8 trilyon $"`.
- **`scale: "log"`**, iki değer arasında büyüklük mertebesi farkı varsa şart —
  doğrusal eksende küçük çubuk bir noktadan ince kalır ve grafik verisinin yarısını
  gizler.
- **`donut`** her veri için ayrı bir halka çizer (bir bütünün dilimleri değil);
  `max` varsayılan olarak 100'dür. Bir bütünü bölmek istiyorsan `pie` kullan.

**Türler ve hangisini ne zaman:**

| chart | Ne için | Veri |
|---|---|---|
| `bar` | Uzun kategori adlarıyla karşılaştırma | `value` |
| `column` | Kısa zaman serisi | `value` |
| `stackedBar` | Bir toplamın bileşenleri | `values[]` + `series[]` |
| `waterfall` | Bir toplamın adım adım oluşumu | `value` (eksi düşüş); son satıra `note: "total"` |
| `line` | Zaman içinde eğilim | `value` |
| `area` | Birikimli eğilim | `value` |
| `scatter` | İki ölçüm birlikte mi hareket ediyor | `x` + `value` |
| `pie` | Bir bütünün dilimleri | `value` |
| `donut` | Birbirinden bağımsız oranlar | `value` |
| `gauge` | Tek ölçü, hedefiyle | `value` + `target` |
| `radar` | Aynı eksenlerde çok yönlü karşılaştırma | `values[]` + `series[]` |

Çok serili türlerde (`stackedBar`, `radar`) her veri `values` dizisi taşır ve sıra
`series` ile eşleşir; RaporGo altına otomatik olarak bir gösterge çizer.

Eksen üst sınırını **verme** — `max` boş bırakılırsa RaporGo ekseni okunabilir bir sayıya
yuvarlar (150, 200 gibi). Yüzde grafiklerinde `max: 100` yazmak yine de doğru.

### Metin içi biçimlendirme

Metin alanlarında beş şey çalışır — fazlası yok, kasten:

```
**kalın**   *italik*   `kod`   [etiket](https://adres)   [yazı]{renk}
```

`renk` bir palet rolü (`primary`, `primaryAlt`, `accent`, `info`, `success`, `danger`, `note`,
`muted`) ya da `#c0392b` gibi bir hex. Rolü tercih et: tema değişince yazı da değişir, hex ise
sabit kalır. `[**önemli**]{danger}` gibi iç içe olur.

Boş satır bırakırsan paragraf kırılır.

### Görseller

`image.src` **dosya yolu** olmak zorunda; data URI reddedilir. Görseli `image_Assets/` altına koy
ve göreli yolla göster. Bunun sebebi basit: gömülü bir base64 blob, dosyayı senin için
okunamaz hâle getirir.

## Komutlar

Hepsi `--json` ile makine okunur çıktı verir; hatalar stderr'e `{ "error": { "code",
"message", "details" } }` biçiminde yazılır ve çıkış kodu `1` olur.

```bash
raporgo new rapor.json --title "Q3 Raporu" --template mavi-resmi
raporgo outline rapor.json                    # id + tip + özet — önce bunu oku
raporgo get rapor.json <segmentId>
raporgo set rapor.json <segmentId> --data '{"text":"yeni metin"}'
raporgo set rapor.json <segmentId> --data '{...}' --replace
raporgo insert rapor.json --data '{"type":"callout","text":"..."}' --after <segmentId>
raporgo move rapor.json <segmentId> --before <segmentId>
raporgo remove rapor.json <segmentId>
raporgo meta rapor.json                       # meta'yı oku
raporgo meta rapor.json --data '{"title":"..."}'   # başlık, tarih, sayfa bantları
raporgo theme rapor.json --preset kiremit --template mavi-resmi
raporgo validate rapor.json                   # şema + eksik görsel kontrolü
raporgo render rapor.json -o rapor.pdf
raporgo render rapor.json --html onizleme.html
raporgo schema                                # tam JSON Schema
raporgo segments                              # segment tipleri
raporgo templates                             # şablonlar
```

`set` varsayılan olarak **birleştirir** (verdiğin alanları değiştirir, ötekilere dokunmaz).
Segmentin tamamını değiştirmek için `--replace` kullan. `type` yerinde değiştirilemez —
kaldırıp yenisini ekle.

## Nasıl çalışmalısın

**Var olan bir raporu düzenlerken** dosyanın tamamını okuma. Sırayla:

```bash
raporgo outline rapor.json --json     # haritayı al
raporgo get rapor.json b1-akis --json # sadece dokunacağın segmenti al
raporgo set rapor.json b1-akis --data '{"items":[...]}'
raporgo validate rapor.json --json
```

17 sayfalık bir raporda bu, tüm dosyayı bağlama almaktan kat kat ucuzdur.

**Sıfırdan rapor üretirken** `new` ile başla, sonra `insert` ile segmentleri sırayla ekle.
Uzun bir raporu tek bir dev JSON olarak yazmak yerine parça parça eklemek, her adımda
şema doğrulaması aldığın için daha güvenlidir.

**Her zaman** işin sonunda `validate` çalıştır. Kırmızı bir şey varsa `details` alanı sana
tam olarak hangi segmentin hangi alanının sorunlu olduğunu söyler.

## Kullanıcı editörü açıkken

Masaüstü editörü dosyayı izler. Sen `rapor.json`'a yazdığın anda kullanıcının önizlemesi
yenilenir. Yani kullanıcı "şu bölümü yeniden yaz" dediğinde, yazman yeterli — sonucu
görmesi için ayrıca bir şey yapmana gerek yok.

## Bilinmesi gerekenler

- Sayfa numarası, üst/alt bantlar ve bölüm numaraları **otomatiktir**; segment olarak eklemeye çalışma.
- `width` alanları **geçerli CSS** olmak zorunda: `100%`, `420pt`, `auto`. Çıplak `100` yazarsan
  tarayıcı bildirimi sessizce düşürür — `validate` bunu uyarı olarak söyler.
- Renkler `theme.overrides` ile değişir; segment içinde renk alanı yoktur. Bu kasten böyle:
  şablon tutarlılığı raporun tamamına aittir.
- `render` çıktısı editördeki önizlemeyle birebir aynıdır; ikisi aynı HTML'i basar.
