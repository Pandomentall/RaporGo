# Gömülü fontlar

RaporGo font dosyalarını sistemden değil, `@raporgo/templates` paketinin içinden yükler.
Dosyalar `@fontsource/arimo` ve `@fontsource/jetbrains-mono` paketlerinden gelir ve
`packages/templates/src/fonts.ts` tarafından render sırasında data URI olarak stylesheet'e
gömülür.

| Font | Yerini aldığı | Lisans |
|---|---|---|
| Arimo | Arial (metrik uyumlu) | [SIL OFL 1.1](Arimo-OFL.txt) |
| JetBrains Mono | Consolas | [SIL OFL 1.1](JetBrainsMono-OFL.txt) |

Yalnız `latin` ve `latin-ext` alt kümeleri gömülür; ikisi birlikte Türkçe ve Batı Avrupa
dillerini karşılar. Arial ve Consolas kapalı lisanslı oldukları için dağıtılamaz — ve
sistem fontuna bağımlılık, daha önce Türkçe karakterlerin kaybolmasına yol açan sorunun ta
kendisiydi.
