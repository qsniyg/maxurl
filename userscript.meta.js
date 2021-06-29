// ==UserScript==
// @name              Image Max URL
// @name:en           Image Max URL
// @name:ar           Image Max URL
// @name:cs           Image Max URL
// @name:da           Image Max URL
// @name:de           Image Max URL
// @name:el           Image Max URL
// @name:eo           Image Max URL
// @name:es           Image Max URL
// @name:fi           Image Max URL
// @name:fr           Image Max URL
// @name:fr-CA        Image Max URL
// @name:he           Image Max URL
// @name:hi           Image Max URL
// @name:hu           Image Max URL
// @name:id           Image Max URL
// @name:it           Image Max URL
// @name:ja           Image Max URL
// @name:ko           Image Max URL
// @name:nb           Image Max URL
// @name:nl           Image Max URL
// @name:pl           Image Max URL
// @name:pt-BR        Image Max URL
// @name:ru           Image Max URL
// @name:bg           Image Max URL
// @name:uk           Image Max URL
// @name:th           Image Max URL
// @name:tr           Image Max URL
// @name:vi           Image Max URL
// @name:zh           Image Max URL
// @name:zh-CN        Image Max URL
// @name:zh-TW        Image Max URL
// @name:zh-HK        Image Max URL
// @description       Finds larger or original versions of images and videos for 8000+ websites, including a powerful media popup and download feature
// @description:en    Finds larger or original versions of images and videos for 8000+ websites, including a powerful media popup and download feature
// @description:ar    البحث عن نسخ أكبر أو أصلية من الصور لأكثر من 8000 موقع ويب
// @description:cs    Vyhledá větší nebo původní verze obrázků a videí pro více než 8000 webů
// @description:da    Finder større eller originale versioner af billeder og videoer til mere end 8000 websteder
// @description:de    Sucht nach größeren oder originalen Versionen von Bildern und Videos für mehr als 8000 Websites
// @description:el    Βρίσκει μεγαλύτερες ή πρωτότυπες εκδόσεις εικόνων και βίντεο για περισσότερους από 8000 ιστότοπους
// @description:eo    Trovas pli grandajn aŭ originalajn versiojn de bildoj kaj filmetoj por pli ol 8000 retejoj
// @description:es    Encuentra imágenes más grandes y originales para más de 8000 sitios
// @description:fi    Etsii suurempia tai alkuperäisiä versioita kuvista ja videoista yli 8000 verkkosivustolle
// @description:fr    Trouve des versions plus grandes ou originales d'images et de vidéos pour plus de 8 000 sites web, y compris une puissante fonction de popup média
// @description:fr-CA Trouve des versions plus grandes ou originales d'images et de vidéos pour plus de 8 000 sites web, y compris une puissante fonction de popup média
// @description:he    מוצא גרסאות גדולות יותר או מקוריות של תמונות וסרטונים עבור יותר מ-8000 אתרים
// @description:hi    8000 से अधिक वेबसाइटों के लिए फ़ोटो और वीडियो के बड़े या मूल संस्करण ढूँढता है
// @description:hu    Több mint 8000 webhely képének és videóinak nagyobb vagy eredeti változatát találja
// @description:id    Menemukan versi gambar dan video yang lebih besar atau orisinal untuk lebih dari 8000 situs web
// @description:it    Trova versioni più grandi o originali di immagini e video per oltre 8000 siti web
// @description:ja    8000以上のウェブサイトで高画質や原本画像を見つけ出します
// @description:ko    8000개 이상의 사이트에 대해 고화질이나 원본 이미지를 찾아드립니다
// @description:nb    Finner større eller originale versjoner av bilder og videoer for mer enn 8000 nettsteder
// @description:nl    Vindt grotere of originele versies van foto's en video's voor meer dan 8000 websites
// @description:pl    Wyszukuje większe lub oryginalne wersje obrazów i filmów dla ponad 8000 stron internetowych
// @description:pt-BR Encontra versões maiores ou originais de imagens e vídeos para mais de 8000 sites
// @description:ru    Находит увеличенные или оригинальные версии изображений для более чем 8000 веб-сайтов
// @description:bg    Намира увеличени или оригинални версии на изображения за повече от 8000 уеб сайтове
// @description:uk    Знаходить збільшені або оригінальні версії зображень для більш ніж 8000 веб-сайтів
// @description:th    หาที่ใหญ่กว่าหรือเวอร์ชั่นดั้งเดิมของภาพทั้งหมดและวีดีโอสำหรับมากกว่า 8000 งเว็บไซต์
// @description:tr    8000'den fazla web sitesi için resim ve videoların daha büyük veya orijinal sürümlerini bulur
// @description:vi    Tìm phiên bản lớn hơn hoặc phiên bản gốc của hình ảnh và video cho hơn 8000 trang web
// @description:zh    为8000多个网站查找更大或原始图像
// @description:zh-CN 为8000多个网站查找更大或原始图像
// @description:zh-TW 為8000多個網站查找更大或原始圖像
// @description:zh-HK 為8000多個網站查找更大或原始圖像
// @namespace         http://tampermonkey.net/
// @version           0.19.5
// @author            qsniyg
// @homepageURL       https://qsniyg.github.io/maxurl/options.html
// @supportURL        https://github.com/qsniyg/maxurl/issues
// @icon              https://raw.githubusercontent.com/qsniyg/maxurl/b5c5488ec05e6e2398d4e0d6e32f1bbad115f6d2/resources/logo_256.png
// @include           *
// @grant             GM.xmlHttpRequest
// @grant             GM_xmlhttpRequest
// @grant             GM.setValue
// @grant             GM_setValue
// @grant             GM.getValue
// @grant             GM_getValue
// @grant             GM_registerMenuCommand
// @grant             GM_unregisterMenuCommand
// @grant             GM_addValueChangeListener
// @grant             GM_download
// @grant             GM_openInTab
// @grant             GM.openInTab
// @grant             GM_notification
// @grant             GM.notification
// @grant             GM_setClipboard
// @grant             GM.setClipboard
// @connect           *
// api.github.com is used for checking for updates (can be disabled through the "Check Updates" setting)
// @connect           api.github.com
// @run-at            document-start
// @license           Apache-2.0
// non-greasyfork/oujs versions need updateURL and downloadURL to auto-update for certain userscript managers
// @updateURL         https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript.meta.js
// @downloadURL       https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript_smaller.user.js
// imu:require_rules  (this is replaced by the build system for userscript versions that require external rules)
// ==/UserScript==

