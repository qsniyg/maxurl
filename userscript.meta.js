// ==UserScript==
// @name              Image Max URL
// @name:ko           Image Max URL
// @name:fr           Image Max URL
// @name:es           Image Max URL
// @name:ru           Image Max URL
// @name:ja           Image Max URL
// @name:zh           Image Max URL
// @name:zh-CN        Image Max URL
// @name:zh-TW        Image Max URL
// @name:zh-HK        Image Max URL
// @namespace         http://tampermonkey.net/
// @version           0.13.12
// @description       Finds larger or original versions of images for 6900+ websites, including a powerful media popup feature
// @description:ko    6900개 이상의 사이트에 대해 고화질이나 원본 이미지를 찾아드립니다
// @description:fr    Trouve des images plus grandes ou originales pour plus de 6900 sites
// @description:es    Encuentra imágenes más grandes y originales para más de 6900 sitios
// @description:ru    Находит увеличенные или оригинальные версии изображений для более чем 6900 веб-сайтов
// @description:ja    6900以上のウェブサイトで高画質や原本画像を見つけ出します
// @description:zh    为6900多个网站查找更大或原始图像
// @description:zh-CN 为6900多个网站查找更大或原始图像
// @description:zh-TW 為6900多個網站查找更大或原始圖像
// @description:zh-HK 為6900多個網站查找更大或原始圖像
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
// @connect           *
// api.github.com is used for checking for updates (can be disabled through the "Check Updates" setting)
// @connect           api.github.com
// @run-at            document-start
// @license           Apache-2.0
//
// This script is quickly approaching OpenUserJS's 1MB limit, so the update URL is set to github in order to future-proof updates
// @updateURL https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript.meta.js
// @downloadURL https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript_smaller.user.js
// ==/UserScript==

