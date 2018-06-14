// ==UserScript==
// @name         Image Max URL
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  Finds larger versions of images
// @author       qsniyg
// @include      *
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM.setValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM_getValue
// @connect      *
// @run-at       document-start
// @license      Apache 2.0
// ==/UserScript==

// If you see "A userscript wants to access a cross-origin resource.",
//   it's either used to detect whether or not the destination URL exists before redirecting (near the end of the script),
//   or used to query flickr's API to get larger images.
// Search for GM_xmlhttpRequest and do_request if you want to see what the code does exactly.


var $$IMU_EXPORT$$;

(function() {
    'use strict';


    var _nir_debug_ = false;

    if (_nir_debug_) {
        _nir_debug_ = {
            no_request: false
        };
    }


    var do_request = null;
    if (typeof(GM_xmlhttpRequest) !== "undefined")
        do_request = GM_xmlhttpRequest;
    else if (typeof(GM) !== "undefined" && typeof(GM.xmlHttpRequest) !== "undefined")
        do_request = GM.xmlHttpRequest;


    var default_options = {
        fill_object: true,
        null_if_no_change: false,
        iterations: 200,

        do_request: do_request,
        host_url: null,
        document: null,
        window: null,
        element: null,

        cb: null
    };

    var default_object = {
        url: null,
        always_ok: false,
        can_head: true,
        head_wrong_contenttype: false,
        head_wrong_contentlength: false,
        waiting: false,
        redirects: false,
        headers: {}
    };


    var settings = {
        redirect: true,
        mouseover: true,
        mouseover_trigger: "ctrl"
    };

    var settings_meta = {
        redirect: {
            name: "Enable redirection",
            description: "Redirect images opened in their own tab"
        },
        mouseover: {
            name: "Enable mouseover popup",
            description: "Show a popup with the larger image when you mouseover an image with the trigger key held"
        },
        mouseover_trigger: {
            name: "Mouseover popup trigger",
            description: "Trigger key that, when held, will show the popup",
            options: {
                ctrl: {
                    name: "Ctrl"
                },
                shift: {
                    name: "Shift"
                },
                alt: {
                    name: "Alt"
                }
            }
        }
    };


    var is_node = false;
    if ((typeof module !== 'undefined' && module.exports) &&
        typeof window === 'undefined' && typeof document === 'undefined') {
        is_node = true;
    }

    var urlparse = function(x) {
        return new URL(x);
    };

    if (is_node && typeof URL === 'undefined') {
        var url = require("url");
        urlparse = function(x) {
            var parsed = url.parse(x);
            parsed.searchParams = new Map();
            if (parsed.query) {
                parsed.query.split("&").forEach((query) => {
                    var splitted = query.split("=");
                    parsed.searchParams.set(splitted[0], splitted[1]);
                });
            }
            return parsed;
        };
    }

    var is_scripttag = false;
    if (typeof imu_variable !== 'undefined')
        is_scripttag = true;

    var is_userscript = false;
    if (!is_node && !is_scripttag)
        is_userscript = true;

    // https://stackoverflow.com/a/17323608
    function mod(n, m) {
        return ((n % m) + m) % m;
    }

    function urlsplit(a) {
        var protocol_split = a.split("://");
        var protocol = protocol_split[0];
        var splitted = protocol_split[1].split("/");
        var domain = splitted[0];
        var start = protocol + "://" + domain;
        return {
            protocol,
            domain,
            url: a
        };
    }

    function urljoin(a, b, browser) {
        var protocol_split = a.split("://");
        var protocol = protocol_split[0];
        var splitted = protocol_split[1].split("/");
        var domain = splitted[0];
        var start = protocol + "://" + domain;

        if (b.length === 0)
            return a;
        if (b.match(/[a-z]*:\/\//))
            return b;
        if (b.length >= 2 && b.slice(0, 2) === "//")
            return protocol + ":" + b;
        if (b.length >= 1 && b.slice(0, 1) === "/")
            return start + b;

        if (!browser) {
            // simple path join
            // urljoin("http://site.com/index.html", "file.png") = "http://site.com/index.html/file.png"
            return a + "/" + b;
        } else {
            // to emulate the browser's behavior instead
            // urljoin("http://site.com/index.html", "file.png") = "http://site.com/file.png"
            if (a.match(/\/$/))
                return a + b.replace(/^\/*/, "");
            else
                return a.replace(/\/[^/]*$/, "/") + b.replace(/^\/*/, "");
        }
    }

    var fullurl = function(url, x) {
        if (x === undefined || x === null)
            return x;

        var a = document.createElement(a);
        a.href = x;
        return a.href;
    };

    // bug in chrome, see
    // https://github.com/qsniyg/maxurl/issues/7
    // https://our.umbraco.org/forum/using-umbraco-and-getting-started/91715-js-error-when-aligning-content-left-center-right-justify-in-richtext-editor
    if (is_node || true) {
        fullurl = function(url, x) {
            return urljoin(url, x);
        };
    }


    function bigimage(src, options) {
        if (!src)
            return src;

        var origsrc = src;

        var url = urlparse(src);
        var protocol_split = src.split("://");
        var protocol = protocol_split[0];
        var splitted = protocol_split[1].split("/");
        var domain = splitted[0];
        var domain_nowww = domain.replace(/^www\./, "");
        var domain_nosub = domain.replace(/^.*\.([^.]*\.[^.]*)$/, "$1");
        if (domain_nosub.match(/^co\.[a-z]{2}$/)) {
            domain_nosub = domain.replace(/^.*\.([^.]*\.[^.]*\.[^.]*)$/, "$1");
        }

        var amazon_container = null;
        if (domain.indexOf(".amazonaws.com") >= 0)
            amazon_container = src.replace(/^[a-z]*:\/\/[^/]*\/([^/]*)\/.*/, "$1");

        var host_domain = null;
        var host_domain_nowww = null;
        var host_domain_nosub = null;
        if (options.host_url) {
            host_domain = options.host_url.replace(/^[a-z]+:\/\/([^/]*)(?:\/.*)?$/,"$1");

            host_domain_nowww = host_domain.replace(/^www\./, "");
            host_domain_nosub = host_domain.replace(/^.*\.([^.]*\.[^.]*)$/, "$1");
            if (host_domain_nosub.match(/^co\.[a-z]{2}$/)) {
                host_domain_nosub = host_domain.replace(/^.*\.([^.]*\.[^.]*\.[^.]*)$/, "$1");
            }
        }

        var newsrc, i, size, origsize, regex;

        // instart logic morpheus
        // test urls:
        // char - 5
        // https://c-6rtwjumjzx7877x24nrlncx2ewfspjwx2ehtr.g00.ranker.com/g00/3_c-6bbb.wfspjw.htr_/c-6RTWJUMJZX77x24myyux78x3ax2fx2fnrlnc.wfspjw.htrx2fzx78jw_stij_nrlx2f94x2f415044x2ftwnlnsfqx2fjzs-on-bts-wjhtwinsl-fwynx78yx78-fsi-lwtzux78-umtyt-z6x3fbx3d105x26vx3d05x26krx3doulx26knyx3dhwtux26hwtux3dkfhjx78x26n65h.rfwp.nrflj.yduj_$/$/$/$/$/$
        //   https://imgix.ranker.com/user_node_img/49/960599/original/eun-ji-won-recording-artists-and-groups-photo-u1?w=650&q=50&fm=jpg&fit=crop&crop=faces
        // https://c-6rtwjumjzx7877x24nrlncx2ewfspjwx2ehtr.g00.ranker.com/g00/3_c-6bbb.wfspjw.htr_/c-6RTWJUMJZX77x24myyux78x3ax2fx2fnrlnc.wfspjw.htrx2fzx78jw_stij_nrlx2f03x2f6698837x2ftwnlnsfqx2fmjj-hmzq-umtyt-z4x3fbx3d105x26vx3d05x26krx3doulx26knyx3dhwtux26hwtux3dkfhjx78x26n65h.rfwp.nrflj.yduj_$/$/$/$/$/$
        //   https://imgix.ranker.com/user_node_img/58/1143382/original/hee-chul-photo-u9?w=650&q=50&fm=jpg&fit=crop&crop=faces
        // https://c-6rtwjumjzx7877x24nrlncx2ewfspjwx2ehtr.g00.ranker.com/g00/3_c-6bbb.wfspjw.htr_/c-6RTWJUMJZX77x24myyux78x3ax2fx2fnrlnc.wfspjw.htrx2fzx78jw_stij_nrlx2f16x2f6757374x2ftwnlnsfqx2fmdzs-dtzsl-z7x3fbx3d105x26vx3d05x26krx3doulx26knyx3dhwtux26hwtux3dkfhjx78x26n65h.rfwp.nrflj.yduj_$/$/$/$/$/$
        //   https://imgix.ranker.com/user_node_img/61/1202829/original/hyun-young-u2?w=650&q=50&fm=jpg&fit=crop&crop=faces
        //
        // http://c-6rtwjumjzx7877x24bbbx2esfstanx78twx2ent.g00.tomshardware.com/g00/3_c-6bbb.ytrx78mfwibfwj.htr_/c-6RTWJUMJZX77x24myyux78x3ax2fx2fbbb.sfstanx78tw.ntx2fx40u6x2fHfhmjfgqjHXXx3fywfhpx26n65h.rfwp.qnsp.yduj_$/$/$
        //   https://www.nanovisor.io/@p1/CacheableCSS?track
        //
        // char - 8
        // https://c-5uwzmx78pmca09x24quoqfx2ezivsmzx2ekwu.g00.ranker.com/g00/3_c-5eee.zivsmz.kwu_/c-5UWZMXPMCA09x24pbbx78ax3ax2fx2fquoqf.zivsmz.kwux2fcamz_vwlm_quox2f25x2f716313x2fwzqoqvitx2fmuui-eibawv-x78mwx78tm-qv-bd-x78pwbw-c01x3fex3d903x26px3d903x26nqbx3dkzwx78x26kzwx78x3dnikmax26yx3d48x26nux3drx78ox26q98k.uizs.quiom.bgx78m_$/$/$/$/$/$
        //   https://imgix.ranker.com/user_node_img/47/938535/original/emma-watson-people-in-tv-photo-u23?w=125&h=125&fit=crop&crop=faces&q=60&fm=jpg
        //
        // http://c-6rtwjumjzx7877x24zlh-56x2ehfkjrtrx78yfynhx2ehtr.g00.cafemom.com/g00/3_c-6ymjx78ynw.hfkjrtr.htr_/c-6RTWJUMJZX77x24myyux78x3ax2fx2fzlh-56.hfkjrtrx78yfynh.htrx2fljsx2fhwtux2f705x2f695x2f25x2f7563x2f57x2f56x2f65x2f82x2fibx2futpmy32vnt27.uslx3fn65h.rfwpx3dnrflj_$/$/$/$/$/$/$/$/$/$/$/$/$
        //   https://ugc-01.cafemomstatic.com/gen/crop/250/140/70/2018/02/01/10/37/dw/pokht87qio72.png
        if (src.indexOf("/g00/") >= 0 && domain.indexOf(".g00.") >= 0) {
            var str = "";
            //var i;

            // decode x[0-9][0-9] to \x[0-9][0-9]
            for (i = 0; i < src.length; i++) {
                if (src[i] == 'x') {
                    var char = parseInt(src[i + 1] + src[i + 2], 16);
                    str += String.fromCharCode(char);
                    i += 2;
                } else {
                    str += src[i];
                }
            }

            str = str.split("/").slice(5).join("/").split("$").slice(1).join("$");
            if (str && str.indexOf("://") < 10 && str[1] == str[2]) {
                var diff = mod(str.charCodeAt(0) - 'h'.charCodeAt(0), 26);

                // char - diff
                var str1 = "";
                for (i = 0; i < str.length; i++) {
                    var code = str.charCodeAt(i);
                    if(code > 47 && code < 58) {
                        /* number */
                        code = (mod((code - 48 - diff), 10) + 48);
                    } else if (code > 64 && code < 91) {
                        /* uppercase */
                        code = (mod((code - 65 - diff),26) + 65);
                    } else if (code > 96 && code < 123) {
                        /* lowercase */
                        code = (mod((code - 97 - diff),26) + 97);
                    }
                    str1 += String.fromCharCode(code);
                }

                var urlparts = str1;
                if (urlparts && urlparts.indexOf("http") === 0) {
                    var $s = urlparts.replace(/.*?([$/]*)$/, "$1");
                    if ($s !== urlparts && $s) {
                        var count = $s.split("$").length - 1;
                        if (count > 0) {
                            // + 2 for http://
                            var newurl = urlparts.split("/").slice(0, count + 2).join("/");

                            // https://ugc-01.cafemomstatic.com/gen/crop/250/140/70/2018/02/01/10/37/dw/pokht87qio72.png?i10c.mark=image_$
                            //newurl = newurl.split("&").slice(0,-1).join("&"); // remove &i10c.mark.link.type_...
                            newurl = newurl.replace(/[?&]i10c\.mark[^/]*$/, "");

                            if (newurl)
                                return newurl;
                        }
                    }
                } else {
                    console.log(urlparts);
                }
            }
        }

        if (domain.indexOf("img.tenasia.hankyung.com") >= 0 && false) {
            // http://img.hankyung.com/photo/201612/AA.12967766.4.jpg -- larger than .1.
            //   http://img.hankyung.com/photo/201612/AA.12967766.1.jpg
            return src.replace(/-[0-9]+x[0-9]+\.([^/.]*)$/, ".$1");
        }

        if (domain.indexOf(".naver.net") >= 0 ||
            domain.indexOf(".pstatic.net") >= 0) {
            if (domain.indexOf("gfmarket.") >= 0) {
                return src;
            }

            // http://tv03.search.naver.net/thm?size=120x150&quality=9&q=http://sstatic.naver.net/people/portrait/201401/20140127145415321.jpg
            // https://tv.pstatic.net/thm?size=120x150&quality=9&q=http://sstatic.naver.net/people/portrait/201604/20160426164831645.jpg
            if (domain.match(/tv[0-9]*\.search\.naver\.net/) ||
                domain.match(/tv[0-9]*\.pstatic\.net/)) {
                return src.replace(/.*\/thm\?.*?q=/, "");
            }

            if (src.match(/[?&]src=/)) {
                return decodeURIComponent(src.replace(/.*src=*([^&]*).*/, "$1")).replace(/^"*/, '').replace(/"$/, '');
            }

            // for some reason it doesn't work with (some?) cafe files?
            // test:
            // https://cafeptthumb-phinf.pstatic.net/20150611_228/pht0829_1434017180824U5auR_JPEG/U01.jpg?type=w1
            // proper:
            // https://cafeptthumb-phinf.pstatic.net/20150611_228/pht0829_1434017180824U5auR_JPEG/U01.jpg

            // however in cases such as
            // https://postfiles.pstatic.net/MjAxNzA2MjVfMjcg/MDAxNDk4MzY2NTU1NDA1._jJeyTBgxoS4OUVFnfUpCTwFlWgsQANPgd5g4Wr__2kg._o3wfc4uAzyG_buHGKqENCl6g1pDt6-thoX-akGet9Qg.JPEG.amyo916/%EB%B0%A4%EB%B9%84%EB%85%B8_%EC%9D%80%EC%86%943.jpg?type=w1
            // doing
            // https://postfiles.pstatic.net/MjAxNzA2MjVfMjcg/MDAxNDk4MzY2NTU1NDA1._jJeyTBgxoS4OUVFnfUpCTwFlWgsQANPgd5g4Wr__2kg._o3wfc4uAzyG_buHGKqENCl6g1pDt6-thoX-akGet9Qg.JPEG.amyo916/%EB%B0%A4%EB%B9%84%EB%85%B8_%EC%9D%80%EC%86%943.jpg
            // returns a smaller file
            // https://blogfiles.pstatic.net/MjAxNzA2MjVfMjcg/MDAxNDk4MzY2NTU1NDA1._jJeyTBgxoS4OUVFnfUpCTwFlWgsQANPgd5g4Wr__2kg._o3wfc4uAzyG_buHGKqENCl6g1pDt6-thoX-akGet9Qg.JPEG.amyo916/%EB%B0%A4%EB%B9%84%EB%85%B8_%EC%9D%80%EC%86%943.jpg is the same size as ?type=w1
            //
            // https://postfiles.pstatic.net/MjAxNzA5MjFfMTg1/MDAxNTA1OTk3ODQzNjU3.oR8-_8p2zkJuFfz41D_ABFDKc82luEh45nxxiH1riAUg.NqrW3NUoqqR_a3Pqbg0jAttIrNst4k5BdFG2M7WNfQsg.JPEG.bho1000/IMG_4092_resize.JPG?type=w966 (900x600)
            //  https://postfiles.pstatic.net/MjAxNzA5MjFfMTg1/MDAxNTA1OTk3ODQzNjU3.oR8-_8p2zkJuFfz41D_ABFDKc82luEh45nxxiH1riAUg.NqrW3NUoqqR_a3Pqbg0jAttIrNst4k5BdFG2M7WNfQsg.JPEG.bho1000/IMG_4092_resize.JPG = smallest
            //  https://postfiles.pstatic.net/MjAxNzA5MjFfMTg1/MDAxNTA1OTk3ODQzNjU3.oR8-_8p2zkJuFfz41D_ABFDKc82luEh45nxxiH1riAUg.NqrW3NUoqqR_a3Pqbg0jAttIrNst4k5BdFG2M7WNfQsg.JPEG.bho1000/IMG_4092_resize.JPG?type=w1 = largest (eq to w966)
            //  https://postfiles.pstatic.net/MjAxNzA5MjFfMTg1/MDAxNTA1OTk3ODQzNjU3.oR8-_8p2zkJuFfz41D_ABFDKc82luEh45nxxiH1riAUg.NqrW3NUoqqR_a3Pqbg0jAttIrNst4k5BdFG2M7WNfQsg.JPEG.bho1000/IMG_4092_resize.JPG?type=w2 = smaller
            //  https://postfiles.pstatic.net/MjAxNzA5MjFfMTg1/MDAxNTA1OTk3ODQzNjU3.oR8-_8p2zkJuFfz41D_ABFDKc82luEh45nxxiH1riAUg.NqrW3NUoqqR_a3Pqbg0jAttIrNst4k5BdFG2M7WNfQsg.JPEG.bho1000/IMG_4092_resize.JPG?type=w3 = smallest (but larger than without)
            //  https://blogfiles.pstatic.net/MjAxNzA5MjFfMTg1/MDAxNTA1OTk3ODQzNjU3.oR8-_8p2zkJuFfz41D_ABFDKc82luEh45nxxiH1riAUg.NqrW3NUoqqR_a3Pqbg0jAttIrNst4k5BdFG2M7WNfQsg.JPEG.bho1000/IMG_4092_resize.JPG = largest (eq to w966)

            // there is also ?type=w2 to consider, but with no change i've seen so far

            // ?type=w1 doesn't work:
            //
            // https://img-pholar.pstatic.net/20161120_290/1479626135018LJPrw_JPEG/p?type=ffn720_720
            //  https://img-pholar.pstatic.net/20161120_290/1479626135018LJPrw_JPEG/p?type=w1 is broken
            //  https://img-pholar.pstatic.net/20161120_290/1479626135018LJPrw_JPEG/p is ok
            // http://dic.phinf.naver.net/20170424_170/1493009773923GjUgo_JPEG/196_cobis_20070206153112.jpg?type=nf118_80_q80

            // ?type=w1 works:
            //
            // https://postfiles.pstatic.net/MjAxNzEyMjNfMTc5/MDAxNTEzOTk4OTA3MzQ0.3GiIBnqVyIshzpThGEE92-RMzAWDRShnmSwfZyviyVQg.OiRXD8qLAXSNXgDUF1yPsXnx8SPxj3RWhYr-eUoCWhUg.JPEG.com862/IMG_1826.jpg?type=w773
            //   https://postfiles.pstatic.net/MjAxNzEyMjNfMTc5/MDAxNTEzOTk4OTA3MzQ0.3GiIBnqVyIshzpThGEE92-RMzAWDRShnmSwfZyviyVQg.OiRXD8qLAXSNXgDUF1yPsXnx8SPxj3RWhYr-eUoCWhUg.JPEG.com862/IMG_1826.jpg?type=w1
            // http://sstatic.naver.net/people/194/201710101543498651.jpg
            //   http://sstatic.naver.net/people/194/201710101543498651.jpg?type=w1
            // http://sstatic.naver.net/people/portraitGroup/201709/20170929171408460-4330243.jpg
            //   http://sstatic.naver.net/people/portraitGroup/201709/20170929171408460-4330243.jpg?type=w1

            // ?type=w1 makes a smaller file:
            // http://blogfiles.naver.net/MjAxNzEyMTNfNzAg/MDAxNTEzMTcxOTYwMTYy.LUNqGf98PVcskK0cLDV3Gil8H861pt8Y-Mv1PP0BnLcg.gC3LNf7q0rJZJ044ZjdDbUQTGqXIYzL-bRiKyxYocDcg.PNG.vvyeo/1_%BD%BA%C0%A7%C4%A1_.png
            //   http://blogfiles.pstatic.net/MjAxNzEyMTNfNzAg/MDAxNTEzMTcxOTYwMTYy.LUNqGf98PVcskK0cLDV3Gil8H861pt8Y-Mv1PP0BnLcg.gC3LNf7q0rJZJ044ZjdDbUQTGqXIYzL-bRiKyxYocDcg.PNG.vvyeo/1_%BD%BA%C0%A7%C4%A1_.png?type=w1
            //   http://blogfiles.pstatic.net/MjAxNzEyMTNfNzAg/MDAxNTEzMTcxOTYwMTYy.LUNqGf98PVcskK0cLDV3Gil8H861pt8Y-Mv1PP0BnLcg.gC3LNf7q0rJZJ044ZjdDbUQTGqXIYzL-bRiKyxYocDcg.PNG.vvyeo/1_%BD%BA%C0%A7%C4%A1_.png?type=w2 (even smaller)
            //   http://blogfiles.pstatic.net/MjAxNzEyMTNfNzAg/MDAxNTEzMTcxOTYwMTYy.LUNqGf98PVcskK0cLDV3Gil8H861pt8Y-Mv1PP0BnLcg.gC3LNf7q0rJZJ044ZjdDbUQTGqXIYzL-bRiKyxYocDcg.PNG.vvyeo/1_%BD%BA%C0%A7%C4%A1_.png?type=w3 (smallest)
            // with that being said, type=w3 does look the least stretched. however, with other images, it just resizes, no un-stretching
            if (domain.search(/^[-a-z0-9]*cafe[-a-z0-9]*\./) < 0 &&
                domain.search(/^img-pholar[-a-z0-9]*\./) < 0 &&
                domain.search(/^shopping-phinf[-a-z0-9]*\./) < 0 &&
                domain.search(/^dic.phinf.naver.net/) < 0 &&
                domain.search(/^musicmeta.phinf.naver.net/) < 0 && false)
                src = src.replace(/\?type=[^/]*$/, "?type=w1");
            else
                src = src.replace(/\?type=[^/]*$/, "");

            src = src.replace(/#[^/]*$/, "");

            if (domain.search(/^[-a-z0-9]*blog[-a-z0-9]*\./) < 0 &&
                domain.search(/^[-a-z0-9]*cafe[-a-z0-9]*\./) < 0 &&
                domain.search(/^[-a-z0-9]*news[-a-z0-9]*\./) < 0 &&
                domain.search(/^[-a-z0-9]*post[-a-z0-9]*\./) < 0 &&
                domain.search(/^[-a-z0-9]*v.phinf[-a-z0-9]*\./) < 0 &&
                domain.search(/^[-a-z0-9]*shopping.phinf[-a-z0-9]*\./) < 0 &&
                domain.search(/^[-a-z0-9]*musicmeta.phinf[-a-z0-9]*\./) < 0) {
                return src;
            }

            // http://post.phinf.naver.net/20160324_74/1458783545129zPGJg_JPEG/%B0%AD%B3%B2TV_%B0%C9%B1%D7%B7%EC_%BD%BA%C0%A7%C4%A1%BA%A3%B8%AE_%B0%A1%BB%F3%C7%F6%BD%C7_360VR_%BC%EE%C4%C9%C0%CC%BD%BA_%B9%C2%C1%F7%BA%F1%B5%F0%BF%C0_%BB%E7%C1%F82.jpg/IT8SeAh7YSaM55bq7KMOEE5ImDlU.jpg
            //   http://post-phinf.pstatic.net/20160324_74/1458783545129zPGJg_JPEG/%B0%AD%B3%B2TV_%B0%C9%B1%D7%B7%EC_%BD%BA%C0%A7%C4%A1%BA%A3%B8%AE_%B0%A1%BB%F3%C7%F6%BD%C7_360VR_%BC%EE%C4%C9%C0%CC%BD%BA_%B9%C2%C1%F7%BA%F1%B5%F0%BF%C0_%BB%E7%C1%F82.jpg/IT8SeAh7YSaM55bq7KMOEE5ImDlU.jpg

            // works:
            // https://s.pstatic.net/shopping.phinf/20180115_4/ce3dfbda-c44b-43aa-83d0-2ffb8fa3dd47.jpg
            //   https://shopping-phinf.pstatic.net/20180115_4/ce3dfbda-c44b-43aa-83d0-2ffb8fa3dd47.jpg
            // http://imgnews.pstatic.net/image/origin/433/2017/07/31/33727.jpg
            //   http://s.pstatic.net/imgnews/image/origin/433/2017/07/31/33727.jpg
            // http://imgnews.pstatic.net/image/origin/416/2018/04/04/223346.jpg
            // doesn't work:
            // http://dic.phinf.naver.net/20170424_126/14930112296681HPid_JPEG/14051_getty_20080128162512.jpg
            //   http://s.pstatic.net/dic.phinf/20170424_126/14930112296681HPid_JPEG/14051_getty_20080128162512.jpg
            //
            // can't remove ?
            // http://dbscthumb.phinf.naver.net/4209_000_1/20160408160657214_SYEAAJM97.jpg/5%EA%B0%90%EA%B5%AC.jpg?type=r160
            //   http://dbscthumb-phinf.pstatic.net/4209_000_1/20160408160657214_SYEAAJM97.jpg/5%EA%B0%90%EA%B5%AC.jpg?type=r160

            return src
                .replace(/postfiles[^/.]*\./, "blogfiles.")
                .replace(/m?blogthumb[^./]*/, "blogfiles")
                .replace(/blogfiles[^/.]*\./, "blogfiles.")
                .replace(/postfiles[^/.]*\./, "blogfiles.")

                .replace(/cafeptthumb[^./]*/, "cafefiles")

                // https://cafeskthumb-phinf.pstatic.net/MjAxNzAyMjhfMjIw/MDAxNDg4Mjg1NzU1ODY0.FAX24pXzUaNN-_C5yRRGcJJsswcKtGmsdOi2hTQQfJog.muWF7CuoY7-HKdrPQRYDyp8OlZGyITwmkcGQgzkxzFcg.PNG.yj991224/main-cover1.png?type=w740
                .replace(/cafeskthumb[^./]*/, "cafefiles")
                .replace(/m?cafethumb[^./]*/, "cafefiles")
                .replace(/cafefiles[^/.]*\./, "cafefiles.")

                .replace(/mimgnews[^./]*/, "imgnews")

                .replace(/post\.phinf\./, "post-phinf.")
                // http://v.phinf.naver.net/20180117_164/1516193382182Jx9lx_JPEG/df9c0c3b-fb84-11e7-9554-000000008ca5_07.jpg
                .replace(/v\.phinf\./, "v-phinf.")
                // http://musicmeta.phinf.naver.net/album/002/152/2152949.jpg
                .replace(/musicmeta\.phinf\./, "musicmeta-phinf.")
                .replace(/shopping\.phinf\./, "shopping-phinf.")
                // http://blogpfthumb.phinf.naver.net/20131119_160/thenote_13847965353237CovB_JPEG/controlrooma.jpg
                //   http://blogpfthumb-phinf.pstatic.net/20131119_160/thenote_13847965353237CovB_JPEG/controlrooma.jpg
                .replace(/blogpfthumb\.phinf\./, "blogpfthumb-phinf.")

                .replace(/\.phinf\./, ".")
                .replace(".naver.net/", ".pstatic.net/");
        }

        if ((domain.indexOf("daumcdn.net") >= 0 ||
            domain.indexOf(".kakaocdn.net") >= 0) &&
            src.indexOf("/thumb/") >= 0) {
            // https://search1.kakaocdn.net/thumb/C72x90h.q85/?fname=http%3A%2F%2Fcfile66.uf.daum.net%2Fimage%2F26191E4558DC88D52BF198
            return decodeURIComponent(src.replace(/.*fname=([^&]*).*/, "$1"));
        }

        if (false && (src.indexOf("daumcdn.net/argon/") >= 0 ||
            src.indexOf(".kakaocdn.net/argon/") >= 0)) {
            // wip
            // https://search3.kakaocdn.net/argon/600x0_65_wr/CdIaPo4lsew
            // https://search3.kakaocdn.net/argon/0x200_85_hr/CdIaPo4lsew
        }

        if (domain.indexOf(".uf.tistory.com") >= 0 ||
            domain.indexOf(".uf.daum.net") >= 0) {
            // http://cfile21.uf.tistory.com/image/994900485A9A66EF2564F4 -- 1000x1500
            //   http://cfile21.uf.tistory.com/original/994900485A9A66EF2564F4 -- 1333x2000
            // http://cfile37.uf.daum.net/C160x160/23138C47524BB2D42DD743
            //   http://cfile37.uf.daum.net/original/23138C47524BB2D42DD743
            // unhandled:
            // https://tistory4.daumcdn.net/tistory/458362/attach/3a4fa78bca8649b6a44bf4627075837e
            // http://t1.daumcdn.net/tvpot/thumb/s07a6T8ejtee6OXNNXjQtVE/thumb.png?ts=1523956270
            //
            // https://t1.daumcdn.net/cfile/tistory/996D34465B12921B1A
            //   http://cfile2.uf.tistory.com/original/996D34465B12921B1AE97C
            //   996D34465B12921B1A
            //   996D34465B12921B1AE97C
            // https://t1.daumcdn.net/cfile/tistory/996A16355B12784D0B
            //   http://cfile5.uf.tistory.com/original/996A16355B12784D0B9CF8
            //   996A16355B12784D0B
            //   996A16355B12784D0B9CF8
            // credit to severus on greasyfork:
            // https://t1.daumcdn.net/cfile/tistory/9921ED405B0FCEDB17 -- 1600x2036
            //   http://cfile25.uf.tistory.com/original/9921ED405B0FCEDB17DF05 -- 2200x2800
            //   9921ED405B0FCEDB17
            //   9921ED405B0FCEDB17DF05
            return src.replace("/attach/", "/original/").replace("/image/", "/original/").replace(/\/[RTC][0-9]*x[0-9]*\//, "/original/");
        }

        if (domain.match(/t[0-9]*\.daumcdn\.net/)) {
            // credit to 灰原米兰  on greasyfork for finding this pattern:
            // https://t1.daumcdn.net/cfile/tistory/99DECC4B5B1150482D
            //   https://t1.daumcdn.net/cfile/tistory/99DECC4B5B1150482D?original
            // credit again to severus for the link:
            // https://t1.daumcdn.net/cfile/tistory/9921ED405B0FCEDB17 -- 1600x2036
            //   https://t1.daumcdn.net/cfile/tistory/9921ED405B0FCEDB17?original -- 2200x2800
            return src.replace(/(\/cfile\/tistory\/[0-9A-F]+)(?:\\?.*)$/, "$1?original");
        }

        if (domain.match(/i[0-9]*\.daumcdn\.net/)) {
            // http://i1.daumcdn.net/cfile37/C160x160/23138C47524BB2D42DD743
            //   http://cfile37.uf.daum.net/C160x160/23138C47524BB2D42DD743
            return src.replace(/:\/\/[^/]*\/(cfile[0-9]+)\//, "://$1.uf.daum.net/");
        }

        if (domain.indexOf("image.news1.kr") >= 0) {
            // http://image.news1.kr/system/thumbnails/photos/2018/2/19/2973418/thumb_336x230.jpg
            //   http://image.news1.kr/system/photos/2018/2/19/2973418/original.jpg
            // http://image.news1.kr/system/photos/2014/8/22/985836/main_thumb.jpg
            //   http://image.news1.kr/system/photos/2014/8/22/985836/original.jpg
            return src
                .replace(/\/thumbnails\/(.*)\/thumb_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "/$1/original$2")
                .replace(/main_thumb\.jpg/, "original.jpg")
                .replace(/article.jpg/, "original.jpg")
                .replace(/no_water.jpg/, "original.jpg")
                .replace(/photo_sub_thumb.jpg/, "original.jpg")
                .replace(/section_top\.jpg/, "original.jpg");
        }

        if (domain.indexOf(".joins.com") >= 0) {
            newsrc = src.replace(/\.tn_[0-9]*\..*/, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "ir.joins.com") {
            // http://ir.joins.com/?u=http%3A%2F%2Fpds.joins.com%2F%2Fnews%2Fcomponent%2Fhtmlphoto_mmdata%2F201802%2F02%2Ff1272e1a-836b-4e54-be62-1ab42de3b53b.jpg
            //   http://pds.joins.com//news/component/htmlphoto_mmdata/201802/02/f1272e1a-836b-4e54-be62-1ab42de3b53b.jpg
            return decodeURIComponent(src.replace(/.*\/\?.*?u=([^&]*).*$/, "$1"));
        }

        if (domain.indexOf("uhd.img.topstarnews.net") >= 0) {
            return src
                .replace("/file_attach_thumb/", "/file_attach/")
                .replace(/_[^/]*[0-9]*x[0-9]*_[^/]*(\.[^/]*)$/, "-org$1")
                .replace(/(-[0-9]*)(\.[^/]*)$/, "$1-org$2");
        }

        if (domain === "www.topstarnews.net") {
            // http://www.topstarnews.net/news/thumbnail/201802/365216_8748_4653_v150.jpg
            //   http://www.topstarnews.net/news/photo/201802/365216_8748_4653_org.jpg
            // http://www.topstarnews.net/news/photo/201802/364365_7857_4310.jpg
            //   http://www.topstarnews.net/news/photo/201802/364365_7857_4310_org.jpg
            // http://www.topstarnews.net/news/thumbnail/first/201710/img_319718_1_v150.jpg
            //   http://www.topstarnews.net/news/photo/first/201710/img_319718_1_org.jpg
            //   http://cdn.topstarnews.net/news/photo/first/201710/img_319718_1_org.jpg
            return src
                .replace(/_v[0-9]+(\.[^/.]*)$/, "_org$1")
                .replace(/(_[0-9]+)(\.[^/.]*)$/, "$1_org$2")
                .replace("/thumbnail/", "/photo/");
        }

        if (domain.indexOf("thumb.mt.co.kr") >= 0 ||
            domain.indexOf("thumb.mtstarnews.com") >= 0) {
            // http://thumb.mt.co.kr/06/2017/12/2017122222438260548_1.jpg
            // http://thumb.mtstarnews.com/06/2018/04/2018040415075698337_1.jpg
            //   http://thumb.mtstarnews.com/07/2018/04/2018040415075698337_1.jpg -- much smaller
            // 06 and 21 seem to be identical
            // after that, in order of size: 05, 07, 17, 11, 16, 10, 20, 04, 15, 03, 14, 19
            src = src.replace(/(thumb\.[^/]*)\/[0-9]+(\/[0-9]*\/[0-9]*\/[^/]*).*/, "$1/06$2");
        }

        if (domain === "menu.mt.co.kr" ||
            domain.indexOf(".myskcdn.com") >= 0) {
            // http://moneys.mt.co.kr/photoDb/mwPhotoDbList.php?no=2017013115555978429&page=1&idx=3
            //   http://menu.mt.co.kr/moneyweek/photoDb/2017/01/31/20170131155559784294333.jpg/dims/optimize
            //   http://menu.mt.co.kr/moneyweek/thumb/2017/01/31/06/2017013115108024857_1.jpg -- smaller
            //   http://menu.mt.co.kr/moneyweek/thumb/2017/01/31/00/2017013115108024857_1.jpg -- not found
            // http://menu.mt.co.kr/moneyweek/thumb/2018/03/05/19/2018030511008030850_1.jpg
            //   http://menu.mt.co.kr/moneyweek/thumb/2018/03/05/06/2018030511008030850_1.jpg
            //   http://menu.mt.co.kr/moneyweek/thumb/2018/03/05/00/2018030511008030850_1.jpg -- larger
            // http://menu.mt.co.kr/moneyweek/thumb/2017/11/16/00/2017111614558031796_1.jpg/dims/optimize/
            //   http://menu.mt.co.kr/moneyweek/thumb/2017/11/16/00/2017111614558031796_1.jpg
            //   http://menu.mt.co.kr/moneyweek/thumb/2017/11/16/06/2017111614558031796_1.jpg -- smaller
            // http://menu.mt.co.kr/moneyweek/thumb/2018/01/14/00/2018011416088035798_2.jpg/dims/optimize/
            // http://menu.mt.co.kr/moneyweek/thumb/2018/03/09/06/2018030917238012410_1.jpg (found on sidebar)
            //   http://menu.mt.co.kr/moneyweek/thumb/2018/03/09/00/2018030917238012410_1.jpg
            // http://menu.mt.co.kr/moneyweek/thumb/2017/06/24/06/2017062410078087905_1.jpg - larger than 00, but looks scaled

            // http://menu.mt.co.kr/moneyweek/thumb/2017/05/26/00/2017052617068063683_1.jpg -- works
            // http://menu.mt.co.kr/moneyweek/thumb/2017/05/23/00/2017052310108026652_1.jpg -- doesn't

            // http://1290000230.desst.vcase2.myskcdn.com/1100000038/dev/1290000230/2018/03/20/1890835738_1_1.jpg?key=6a156742b5f85fb887bd7b79a94eea2471884c8c.3669019742&cid=1890835745&pid=1993936257&oid=1890835738/dims/resize/95x54
            //   http://1290000230.desst.vcase2.myskcdn.com/1100000038/dev/1290000230/2018/03/20/1890835738_1_1.jpg?key=6a156742b5f85fb887bd7b79a94eea2471884c8c.3669019742&cid=1890835745&pid=1993936257&oid=1890835738

            // http://menu.mt.co.kr/theleader/photo_img/00/2018/02/01/2018020114447262989_0.jpg
            var obj = src.match(/\/thumb\/(?:[0-9]+\/){3}([0-9]+)\//);
            if (obj && obj[1] !== "00") {
                var obj1_str = src.replace(/.*\/thumb\/([0-9]+\/[0-9]+\/[0-9]+\/).*/, "$1").replace(/\//g, "");
                var obj1 = parseInt(obj1_str);
                //console.log(obj1_str);
                if (obj1 >= 20170526)
                    src = src.replace(/(\/thumb\/(?:[0-9]+\/){3})[0-9]+\//, "$100/");
                else
                    src = src.replace(/(\/thumb\/(?:[0-9]+\/){3})[0-9]+\//, "$106/");
            }

            return src
                .replace(/\/dims\/.*/, "");
        }

        if (domain.indexOf("stardailynews.co.kr") >= 0 ||
            domain.indexOf("liveen.co.kr") >= 0 ||
            domain.indexOf("ilyoseoul.co.kr") >= 0 ||
            domain.indexOf("sportsq.co.kr") >= 0 ||
            domain.indexOf("zenithnews.com") >= 0 ||

            // doesn't work for all:
            // http://www.munhwanews.com/news/thumbnail/201801/106108_163361_2456_v150.jpg
            //   http://www.munhwanews.com/news/photo/201801/106108_163361_2456.jpg
            domain.indexOf("www.munhwanews.com") >= 0 ||
            // http://www.ccdailynews.com/news/thumbnail/201801/953374_384565_4611_v150.jpg
            domain === "www.ccdailynews.com" ||
            // http://ph.kyeonggi.com/news/thumbnail/201802/1440153_1332290_5913_150.jpg
            //   http://ph.kyeonggi.com/news/photo/201802/1440153_1332290_5913.jpg
            // http://ph.kyeonggi.com/edit/news/view_img/PHOTO_1440148_1332273_5348_47.jpg
            //   http://ph.kyeonggi.com/news/photo/201802/1440148_1332273_5348.jpg
            domain === "ph.kyeonggi.com" ||
            // http://www.jemin.com/news/thumbnail/201802/495551_158263_5710_v150.jpg
            domain === "www.jemin.com" ||
            // http://www.domin.co.kr/news/thumbnail/201802/1183690_311011_329_v150.jpg
            //   http://www.domin.co.kr/news/photo/201802/1183690_311011_329.jpg (very hq)
            // http://www.domin.co.kr/news/view_img/MAIN_2_2639_2152.jpg
            //   http://www.domin.co.kr/news/photo/201802/1183700_311009_2038.jpg
            domain === "www.domin.co.kr" ||
            // http://cdn.jejudomin.co.kr/news/thumbnail/201802/96102_90506_3656_v150.jpg
            // http://www.jejudomin.co.kr/photobox/photo/2018020261404454865.jpg
            //   http://cdn.jejudomin.co.kr/news/photo/201802/96119_90524_4043.jpg
            domain === "cdn.jejudomin.co.kr" ||
            // http://ph.incheonilbo.com/news/thumbnail/201712/792780_315340_1230_150.jpg
            domain === "ph.incheonilbo.com" ||
            // http://www.hidomin.com/news/thumbnail/201802/349870_151635_5018_v150.jpg
            domain === "www.hidomin.com" ||
            // http://www.newsfreezone.co.kr/news/thumbnail/201802/38623_37635_844_v150.jpg
            domain === "www.newsfreezone.co.kr" ||
            // http://cdn.newsfreezone.co.kr/news/thumbnail/201802/41850_39614_2056_v150.jpg
            domain === "cdn.newsfreezone.co.kr" ||
            // http://www.newsinside.kr/news/thumbnail/201606/412819_220009_299_v150.jpg
            domain === "www.newsinside.kr" ||
            // http://www.greenpostkorea.co.kr/news/thumbnail/201802/85004_79031_3615_v150.jpg
            domain === "www.greenpostkorea.co.kr" ||
            // http://www.egn.kr/news/thumbnail/201802/90010_149058_921_v150.jpg
            //
            // http://www.egn.kr/news/photo/201710/87447_142141_178.jpg
            // http://www.egn.kr/news/photo/201710/87447_142142_179.jpg
            // http://www.egn.kr/news/photo/201710/87447_142143_1710.jpg
            domain === "www.egn.kr" ||
            // http://www.whitepaper.co.kr/news/thumbnail/201802/95633_76403_5942_v150.jpg
            domain === "www.whitepaper.co.kr" ||
            // http://www.outdoornews.co.kr/news/thumbnail/201802/30078_79659_4819_v150.jpg
            domain === "www.outdoornews.co.kr" ||
            // http://www.shinailbo.co.kr/news/thumbnail/201803/1049737_358211_645_v150.jpg
            // http://www.shinailbo.co.kr/news/articleView.html?idxno=319278
            //   http://www.shinailbo.co.kr/news/photo/201304/319278_175094_5325.jpg - 3500x1807
            domain === "www.shinailbo.co.kr" ||
            // http://www.ngtv.tv/news/thumbnail/201803/44169_57237_2756_v150.jpg
            // http://www.ngtv.tv/news/articleView.html?idxno=24743
            //   http://www.ngtv.tv/news/thumbnail/201503/24743_28146_3449_v150.jpg
            //     http://www.ngtv.tv/news/photo/201503/24743_28146_3449.jpg - 2364x1971
            domain === "www.ngtv.tv" ||
            // http://www.rnx.kr/news/thumbnail/201803/62152_50525_470_150.jpg
            // http://m.rnx.kr/news/articleView.html?idxno=1390
            domain === "www.rnx.kr" ||
            // http://www.intronews.net/news/thumbnail/201803/85854_115174_717_v150.jpg
            // http://www.intronews.net/news/articleView.html?idxno=85633
            //   http://www.intronews.net/news/thumbnail/201802/85633_114974_1625_v150.jpg
            domain === "www.intronews.net" ||
            // http://www.hg-times.com/news/thumbnail/201803/178090_128993_4414_v150.jpg
            //   http://www.hg-times.com/news/photo/201803/178090_128993_4414.jpg
            domain === "www.hg-times.com" ||
            // http://www.iemn.kr/news/thumbnail/201606/2457_2879_40_v150.jpg
            domain === "www.iemn.kr" ||
            // http://www.newscj.com/news/thumbnail/201803/newscj_%EC%B2%9C%EC%A7%80%EC%9D%BC%EB%B3%B4_505243_487804_229_v150.jpg
            domain === "www.newscj.com" ||
            // http://www.ggilbo.com/news/thumbnail/201802/444114_351433_497_v150.jpg
            domain === "www.ggilbo.com" ||
            // http://www.bstoday.kr/news/thumbnail/201804/200376_125982_145_v150.jpg
            //
            // http://www.bstoday.kr/news/articleView.html?idxno=5090
            // http://www.bstoday.kr/photobox/photo/2018032371050517410.jpg
            //   http://www.bstoday.kr/news/photo/201508/5090_4090_1029.jpg
            domain === "www.bstoday.kr" ||
            // http://interfootball.heraldcorp.com/news/thumbnail/201803/194965_212367_3835_150.jpg
            domain === "interfootball.heraldcorp.com" ||
            // http://www.ilyosisa.co.kr/news/thumbnail/201805/145247_81281_562_v150.jpg
            domain === "www.ilyosisa.co.kr" ||
            // http://www.ynnews.kr/news/thumbnail/201805/130007_85746_295_150.jpg
            domain === "www.ynnews.kr" ||
            // http://www.starilbo.com/news/thumbnail/201802/43552_58572_5916_v150.jpg
            domain === "www.starilbo.com" ||
            // http://www.autoherald.co.kr/news/thumbnail/201805/31572_48631_5317_v150.jpg
            domain === "www.autoherald.co.kr" ||
            // http://www.00news.co.kr/news/thumbnail/201805/53198_101527_5227_v150.jpg
            domain === "www.00news.co.kr" ||
            // http://www.kstarfashion.com/news/thumbnail/201805/131724_67495_4142_v150.jpg
            domain === "www.kstarfashion.com" ||
            // http://www.inewspeople.co.kr/news/thumbnail/201611/12355_20610_5726_v150.jpg
            domain === "www.inewspeople.co.kr" ||
            // http://www.staraz.co.kr/news/thumbnail/201703/32882_7294_2352_v150.jpg
            domain === "www.staraz.co.kr" ||
            // http://www.wonnews.co.kr/news/thumbnail/201805/201275_36498_2029_v150.jpg
            domain === "www.wonnews.co.kr" ||
            // http://www.gukjenews.com/news/thumbnail/201806/938035_714703_1521_v150.jpg
            // http://cdn.gukjenews.com/news/thumbnail/201806/938035_714703_1521_v150.jpg
            domain_nosub === "gukjenews.com" ||
            // http://www.lunarglobalstar.com/news/thumbnail/201806/19254_15963_1148_v150.jpg
            domain === "www.lunarglobalstar.com" ||
            // http://www.newstown.co.kr/news/thumbnail/201801/311251_198441_4816_v150.jpg
            domain.indexOf("www.newstown.co.kr") >= 0) {
            return src
                .replace("/thumbnail/", "/photo/")
                .replace(/_v[0-9]*\.([^/]*)$/, ".$1")
                .replace(/(\/[0-9]+_[0-9]+_[0-9]+)_150(\.[^/.]*)$/, "$1$2");
        }

        if (domain.indexOf("newscj.com") >= 0) {
            return src.replace("/thumbnail/", "/photo/").replace(/_v[0-9]*\.[^./]*$/, ".JPG");
        }

        if (domain.indexOf("img.hankyung.com") >= 0) {
            return src.replace(/\.[0-9]\.([a-zA-Z0-9]*)$/, ".1.$1");
        }

        if (domain.indexOf("cdn.newsen.com") >= 0) {
            src = src.replace(/_ts\.[^/._]*$/, ".jpg").replace("/mphoto/", "/news_photo/");
            if (src.indexOf("/main_photo/") >= 0) {
                // http://cdn.newsen.com/newsen/main_photo/index_a2_201801030825321910_1.jpg
                // http://cdn.newsen.com/newsen/news_photo/2018/01/03/201801030825321910_1.jpg
                src = src.replace(/\/main_photo\/[^/]*_([0-9][0-9][0-9][0-9])([0-9][0-9])([0-9][0-9])([^/]*)$/, "/news_photo/$1/$2/$3/$1$2$3$4");
            }

            return src;
        }

        if (domain.indexOf("chosun.com") >= 0 ||
            domain.indexOf("chosunonline.com") >= 0) {
            // works:
            // http://woman.chosun.com/up_fd/wc_news/2018-01/simg_thumb/1802_292s.jpg
            //   http://woman.chosun.com/up_fd/wc_news/2018-01/simg_org/1802_292s.jpg
            //   http://woman.chosun.com/up_fd/wc_news/2018-01/bimg_org/1802_292.jpg
            // http://woman.chosun.com/up_fd/wc_news/2018-01/simg_org/1802_294s.jpg
            //   http://woman.chosun.com/up_fd/wc_news/2018-01/bimg_org/1802_294.jpg
            // http://woman.chosun.com/up_fd/wc_news/2018-02/simg_org/1802_88s.jpg
            //   http://woman.chosun.com/up_fd/wc_news/2018-02/bimg_org/1802_88.jpg
            // http://woman.chosun.com/up_fd/wc_news/2018-02/simg_org/1802_340s.jpg
            //   http://woman.chosun.com/up_fd/wc_news/2018-02/bimg_org/1802_340.jpg
            // http://woman.chosun.com/up_fd/wc_news/2018-01/simg_org/1802_294s.jpg
            //   http://woman.chosun.com/up_fd/wc_news/2018-01/bimg_org/1802_294.jpg
            // http://woman.chosun.com/up_fd/wc_news/2018-02/simg_org/1802_322s.jpg
            //   http://woman.chosun.com/up_fd/wc_news/2018-02/bimg_org/1802_322.jpg
            // http://ekr.chosunonline.com/site/data/thumb_dir/2018/02/23/2018022301051_1_thumb.jpg
            //   http://ekr.chosunonline.com/site/data/img_dir/2018/02/23/2018022301051_1.jpg
            // http://ekr.chosunonline.com/site/data/thumb_dir/2018/02/21/2018022101757_3_thumb.jpg
            //   http://ekr.chosunonline.com/site/data/img_dir/2018/02/21/2018022101757_3.jpg
            // http://sccdn.chosun.com/news/photobook/201504/13267_scr_201504140000000022741_t.jpg
            //   http://sccdn.chosun.com/news/photobook/201504/13267_201504140000000022741.jpg
            // http://sccdn.chosun.com/news/photobook/201504/13267_2015041400000000000122741_t.jpg
            //   http://sccdn.chosun.com/news/photobook/201504/13267_2015041400000000000122741.jpg
            // http://sccdn.chosun.com/news/photobook/201203/4488_scr_%EB%8D%9C%EB%8D%9C_t.jpg
            //
            // doesn't work:
            // http://woman.chosun.com/up_fd/wc_news/2018-01/simg_org/1801_164s.jpg
            // http://ekr.chosunonline.com/site/data/img_dir/2015/07/16/2015071601601_thumb.jpg
            // large:
            // http://sccdn.chosun.com/news/photobook/201710/23202_2017101301010007001.jpeg
            // http://sccdn.chosun.com/news/photobook/201412/11896_20141201010101000972.jpeg
            // http://sccdn.chosun.com/news/photobook/201607/18084_207777778888816070401010002381.jpeg
            // http://sccdn.chosun.com/news/photobook/201412/11896_2014120101000156100006731.jpg - small
            // http://sccdn.chosun.com/news/photobook/201412/11896_2014120101000155800006701.jpg - ^

            if (domain === "sccdn.chosun.com") {
                return src.replace(/\/([0-9]*_)(?:scr_)?([^._/]*)(?:_t)?(\.[^/.]*)$/, "/$1$2$3");
            }

            return src
                //.replace(/\/simg_(?:thumb|org)\/([^/]*)s(\.[^/.]*)$/, "/bimg_org/$1$2")
                .replace("/simg_thumb/", "/simg_org/")
                .replace(/\/thumb_dir\/(.*)_thumb(\.[^/.]*)$/, "/img_dir/$1$2")
                // http://image.chosun.com/sitedata/thumbnail/201803/08/2018030801755_0_thumb.jpg
                //   http://image.chosun.com/sitedata/image/201803/08/2018030801755_0.jpg
                .replace(/\/thumbnail\/(.*?)(?:_thumb)?(\.[^/.]*)$/, "/image/$1$2");
        }

        if (domain.indexOf("ph.spotvnews.co.kr") >= 0) {
            return src.replace("/thumbnail/", "/photo/").replace(/([0-9]+_[0-9]+_[0-9]+)_[0-9]+\.([^/]*)$/, "$1.$2");
        }

        if (domain.indexOf("photo.hankooki.com") >= 0) {
            // http://photo.hankooki.com/newsphoto/v001/thumbs/2017/06/23/tsjmao20170623113309_O_00_C_1.jpg
            // http://photo.hankooki.com/newsphoto/v001/2017/06/23/sjmao20170623113309_O_00_C_1.jpg

            // http://photo.hankooki.com/arch/thumbs/P/2017/10/25/t20171025182853_P_00_C_1_846.jpg
            // http://photo.hankooki.com/arch/photo/P/2017/10/25/20171025182853_P_00_C_1_846.jpg
            // http://photo.hankooki.com/arch/original/P/2017/10/25/20171025182853_P_00_C_1_846.jpg

            // http://photo.hankooki.com/newsphoto/yonhap/thumbs/2016/05/17/t_20160517121834.jpg
            // http://photo.hankooki.com/newsphoto/yonhap/2016/05/17/20160517121834.jpg

            // http://photo.hankooki.com/newsphoto/v001/thumbs/2018/01/28/20180128000108_1_holic.jpg -- doesn't work
            //   http://photo.hankooki.com/newsphoto/v001/2018/01/27/jay1220180127233802_P_02_C_1.jpg (unrelated url?)

            // http://photo.hankooki.com/newsphoto/v001/thumbs/2014/11/11/tegeriace20141111172610_X_01_C_1.jpg -- doesn't work, tries to go to:
            //   http://photo.hankooki.com/newsphoto/v001/2014/11/11/egeriace20141111172610_X_01_C_1.jpg
            // real:
            //   http://photo.hankooki.com/newsphoto/v001/2014/11/11/wegeriace20141111172610_X_01_C_1.jpg
            newsrc =
                src.replace("/arch/photo/", "/arch/original/")
                   .replace("/arch/thumbs/", "/arch/original/")
                   .replace(/(\/newsphoto\/[^/]*\/)thumbs\//, "$1");//.replace(/(.*\/)t([0-9]*[^/]*)$/, "$1$2");
            if (newsrc !== src) {
                return newsrc.replace(/(.*\/)t_?([^/]*)$/, "$1$2");
            } else {
                return src;
            }
        }

        if (domain.indexOf(".ettoday.net") >= 0) {
            return src.replace(/\/[a-z]*([0-9]*\.[^/]*)$/, "/$1");
        }

        if (domain.indexOf("img.mbn.co.kr") >= 0) {
            // http://img.mbn.co.kr/filewww/news/other/2012/04/30/340200121110.jpg - 5705x2917
            return src.replace(/_s[0-9]+x[0-9]+(\.[^/]*)$/, "$1");
        }

        if (domain.search(/image[0-9]*\.inews24\.com/) >= 0 ||
            // http://inews24.ext3.cache.iwinv.net/image_joy/thumbnail/201804/152292797427_1_203359.jpg
            //   http://inews24.ext3.cache.iwinv.net/image_joy/201804/152292797427_1_203359.jpg
            // http://inews24.cache.iwinv.net/image_joy/thumbnail/201604/1461628592495_1_173610.jpg
            //   http://inews24.cache.iwinv.net/image_joy/201604/1461628592495_1_173610.jpg
            domain.match(/inews24\.(?:ext[0-9]+\.)?cache\.iwinv\.net/)) {
            return src.replace("/thumbnail/", "/");
        }

        if (domain === "image-gd.inews24.com") {
            // http://image-gd.inews24.com/image.php?u=/image_joy/201804/1522932288117_1_214943.jpg
            //   http://image-gd.inews24.com/image2.php?u=/image_joy/201804/1522932288117_1_214943.jpg
            //   http://image3.inews24.com/image_joy/201804/1522932288117_1_214943.jpg
            return src.replace(/:\/\/[^/]*\/image[0-9]*\.php\?u=([^&]*).*/, "://image3.inews24.com$1");
        }

        if (domain.indexOf(".wowkorea.jp") >= 0 &&
            (src.indexOf(".wowkorea.jp/img") >= 0 ||
             src.indexOf(".wowkorea.jp/upload") >= 0)) {
            // works:
            // http://kt.wowkorea.jp/img/album/10/54888/94580_l.jpg
            //   http://kt.wowkorea.jp/img/album/10/54888/94580.jpg
            // http://image.wowkorea.jp/upload/news/214660/20180612_cosm_n.jpg
            //   http://image.wowkorea.jp/upload/news/214660/20180612_cosm.jpg
            // doesn't work:
            // http://kt.wowkorea.jp/img/news/3/19899/53692_s.jpg
            //   http://kt.wowkorea.jp/img/news/3/19899/53692_l.jpg - works
            //   http://kt.wowkorea.jp/img/news/3/19899/53692.jpg - 404
            // http://kt.wowkorea.jp/img/news/3/19961/53856_160.jpg
            if (src.indexOf("/img/album/") < 0 &&
                !src.match(/\/upload\/news\/+[0-9]+\//)) {
                return src.replace(/([^/]*_)[a-z0-9]*(\.[^/.]*)$/, "$1l$2");
            }
            return src.replace(/_[a-z0-9](\.[^/.]*)$/, "$1");
        }

        if (domain.match(/img[0-9]*.saostar.vn/)) {
            // https://img.saostar.vn/fb660png_1/2017/11/04/1750083/img_0127.jpg/fbsscover.png
            newsrc = src
                .replace(/saostar.vn\/fb[0-9]+[^/]*(\/.*\.[^/.]*)\/[^/]*$/, "saostar.vn$1")
                .replace(/saostar.vn\/[a-z][0-9]+\//, "saostar.vn/")
                .replace(/saostar.vn\/[0-9]+x[0-9]+\//, "saostar.vn/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain.match(/\.google\./) &&
            src.match(/\/www.google.[a-z]*\/url\?/)) {
            return decodeURIComponent(src.replace(/.*url=([^&]*).*/, "$1"));
        }

        if ((domain.indexOf("www.lipstickalley.com") >= 0 ||
             domain.indexOf("forum.purseblog.com") >= 0) &&
            src.indexOf("/proxy.php?") >= 0) {
            return decodeURIComponent(src.replace(/.*image=([^&]*).*/, "$1"));
        }

        if (domain.indexOf("nosdn.127.net") >= 0 &&
            src.indexOf("nosdn.127.net/img/") >= 0) { //lofter
                // http://imglf1.nosdn.127.net/img/cVVvSm1kaHhURWlQcVkyQVBzZ2lMRExONjBVS1N1UnZUV3dvQ3BtaFVuYjFuUk9EUG5OcnFnPT0.jpg?imageView&thumbnail=1680x0&quality=96&stripmeta=0&type=jpg%7Cwatermark&type=2&text=wqkg5p6B5ZywIC8ga3lva3VjaGkubG9mdGVyLmNvbQ==&font=bXN5aA==&gravity=southwest&dissolve=30&fontsize=680&dx=32&dy=36&stripmeta=0
                //   http://imglf1.nosdn.127.net/img/cVVvSm1kaHhURWlQcVkyQVBzZ2lMRExONjBVS1N1UnZUV3dvQ3BtaFVuYjFuUk9EUG5OcnFnPT0.jpg
                return {
                    url: src.replace(/\?.*$/, ""),
                    headers: {
                        "Referer": null
                    }
                };
        }

        if (domain.indexOf("board.makeshop.co.kr") >= 0) {
            return src.replace(/\/[a-z]*::/, "/");
        }

        if (src.match(/rr.img[0-9]*.naver.jp\/mig/)) {
            // https://rr.img1.naver.jp/mig?src=http%3A%2F%2Fimgcc.naver.jp%2Fkaze%2Fmission%2FUSER%2F20161018%2F76%2F7776016%2F17%2F600x450x28290423f03522c4ff136cd5.jpg&twidth=414&theight=0&qlt=80&res_format=jpg&op=r
            return decodeURIComponent(src.replace(/.*src=([^&]*).*/, "$1"));
        }

        if (domain.indexOf("imgcc.naver.jp") >= 0) {
            return src.replace(/\/[0-9]+\/[0-9]+\/*$/, "");
        }

        if (domain.indexOf("dimg.donga.com") >= 0) {
            // http://dimg.donga.com/c/138/175/90/1/wps/NEWS/IMAGE/2018/04/04/89455472.2.jpg
            //   http://dimg.donga.com/wps/NEWS/IMAGE/2018/04/04/89455472.2.jpg
            // http://dimg.donga.com/a/280/60/90/2/wps/NEWS/FEED/Top_Main_Top_2013/89467049.1.thumb.jpg
            //   http://dimg.donga.com/wps/NEWS/FEED/Top_Main_Top_2013/89467049.1.thumb.jpg
            return src
                .replace(/\/[ca]\/(?:[0-9]+\/){4}/, "/")
                .replace(/\/i\/[0-9]+\/[0-9]+\/[0-9]+\//, "/");
        }

        if (domain.match(/s[0-9]\.marishe\.com/)) {
            return src.replace(/(\/[^/]*)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        // img77
        if (domain.match(/img[0-9]*\.dreamwiz\.com/)) {
            return src.replace(/(\/[^/]*)_[a-z]\.([^/.]*)$/, "$1_o.$2");
        }

        if (domain.indexOf("cdn.hk01.com") >= 0) {
            return src.replace(/(\/media\/images\/[^/]*\/)[^/]*\//, "$1xxlarge/");
        }

        if (domain.indexOf(".sinaimg.cn") >= 0) {
            // works:
            // http://ss12.sinaimg.cn/orignal/66a6ce75g8b46ba3a373b&690
            // http://ss12.sinaimg.cn/orignal/6bc10695g923b8902976b&690
            // http://ss7.sinaimg.cn/orignal/67a7cd73g8b48c289ae26&690
            // http://ss6.sinaimg.cn/orignal/6b3178f4g92678953d725&690
            // doesn't:
            // http://ww4.sinaimg.cn/large/ad769c8bgy1fnaovhjp4rj21m62iob2d.jpg
            //   http://ww4.sinaimg.cn/woriginal/ad769c8bgy1fnaovhjp4rj21m62iob2d.jpg - works
            // http://wx3.sinaimg.cn/large/71080fe4gy1fehxmeusddj21kw2ddb2a.jpg
            // https://wxt.sinaimg.cn/large/006Qyga5ly1fnsl8inznlj31ww2pgqv8.jpg
            //
            // http://k.sinaimg.cn/n/ent/transform/w150h100/20180227/Mf6R-fyrwsqi6927544.jpg/w150h100f1t0l0syf.png
            //   http://n.sinaimg.cn/sinacn/w603h580/20180227/b993-fyrwsqi5950343.jpg
            // http://n.sinaimg.cn/ent/transform/w500h750/20180206/FzeL-fyrhcqz0888399.jpg
            //   http://k.sinaimg.cn/ent/transform/w500h750/20180206/FzeL-fyrhcqz0888399.jpg - doesn't work (bad request)
            //   http://n.sinaimg.cn/sinacn/w500h750/20180206/FzeL-fyrhcqz0888399.jpg - doesn't work
            //
            // http://n.sinaimg.cn/translate/w750h484/20180206/c8U1-fyrhcqy9899138.jpg
            //   http://n.sinaimg.cn/transform/w750h484/20180206/c8U1-fyrhcqy9899138.jpg - doesn't work
            //
            // http://n.sinaimg.cn/translate/20170819/QwU0-fykcpru8486163.jpg
            //
            // http://n.sinaimg.cn/ent/4_ori/upload/a57892fc/w2048h3072/20180217/zPxq-fyrpeif2120125.jpg
            if (domain.match(/^ss/)) {
                src = src.replace(/\.sinaimg\.cn\/[^/]*\/([^/]*)\/*$/, ".sinaimg.cn/orignal/$1");
            } else {
                src = src.replace(/\.sinaimg\.cn\/[^/]*\/([^/]*)\/*$/, ".sinaimg.cn/large/$1");
            }
            return src.replace(/\/slidenews\/([^/_]*)_[^/_]*\//, "/slidenews/$1_img/"); // there's also _ori, but it seems to be smaller?
        }

        if (domain.indexOf("thumbnail.egloos.net") >= 0) {
            return src.replace(/.*:\/\/thumbnail\.egloos\.net\/[^/]*\/*/, "");
        }

        if (domain.indexOf("k.kakaocdn.net") >= 0) {
            return src.replace(/\/img_[a-z]*\.([^./]*)$/, "/img.$1");
        }

        if (domain.indexOf("images.sportskhan.net") >= 0 ||
            domain == "img.khan.co.kr") {
            return src
                .replace(/\/r\/[0-9]+x[0-9]+\//, "/")
                .replace(/\/[a-z]*_([0-9]+\.[a-z0-9A-Z]*)$/, "/$1")
                .replace(/\/c\/[0-9]*x[0-9]*\//, "/")
                .replace(/\/photodb\//, "/PhotoDB/");
        }

        if (domain === "img.sbs.co.kr") {
            // http://img.sbs.co.kr/sbscnbc/upload/2017/11/06/10000590366_700.jpg
            //   http://img.sbs.co.kr/sbscnbc/upload/2017/11/06/10000590366.jpg
            return src.replace(/(\/[0-9]+)_[0-9]+\.([a-z0-9A-Z]*)$/, "$1.$2");
        }

        if (domain.match(/img[0-9]\.sbs\.co\.kr/)) {
            // http://img2.sbs.co.kr/img/sbs_cms/SR/2017/06/26/SR88942637_w640_h360.jpg
            //   http://img2.sbs.co.kr/img/sbs_cms/SR/2017/06/26/SR88942637_ori.jpg
            return src.replace(/(\/[^_]*)_[^/.]*(\.[^/.]*)$/, "$1_ori$2");
        }

        if (domain === "image.board.sbs.co.kr") {
            // http://image.board.sbs.co.kr/2018/02/02/h191517549706907-600.jpg
            //   http://image.board.sbs.co.kr/2018/02/02/h191517549706907.jpg
            return src.replace(/-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf("image.edaily.co.kr") >= 0 ||
            domain.indexOf("img.edaily.co.kr") >= 0) {
            // http://spnimage.edaily.co.kr/images/Photo/files/NP/S/2018/02/PS18021400011h.jpg
            // http://image.edaily.co.kr/images/Photo/files/NP/S/2018/02/PS18021100248t.jpg
            // (none, g), b, t, h, s, m
            // http://img.edaily.co.kr/images/photo/files/NP/S/2018/04/b_5ACD63A4B813DB7E7DBDBA63.jpg
            //   http://img.edaily.co.kr/images/photo/files/NP/S/2018/04/5ACD63A4B813DB7E7DBDBA63.jpg
            // others:
            // http://www.edaily.co.kr/news/news_detail.asp?newsId=01203766619110520&mediaCodeNo=257
            //  http://image.edaily.co.kr/images/photo/files/NP/S/2018/02/PS18021400103.jpg (original?)
            //  http://image.edaily.co.kr/images/photo/files/HN/H/2018/02/HNE01203766619110520_LV1.jpg - zoomed in
            //  http://image.edaily.co.kr/images/photo/files/HN/H/2018/02/HNE01203766619110520.jpg - not zoomed in, but cropped
            // http://image.edaily.co.kr/images/photo/files/NP/S/2016/04/PS16040100068.jpg - 3278x4918

            // http://edaily.co.kr/news/news_detail.asp?newsId=02059846615960080&mediaCodeNo=257
            //  http://image.edaily.co.kr/images/photo/files/NP/S/2017/06/PS17060900211.jpg
            //
            //    http://beautyin.edaily.co.kr/read/news.asp?newsid=329216886615960080
            //     http://superdeskapi.edaily.co.kr/api/upload/5939e0ffb813db52b1fb81aa/raw?_schema=http
            return src
                .replace(/\/[a-z]_([A-Z0-9]+)\.([a-z0-9A-Z]*)$/, "/$1.$2")
                .replace(/(\/[A-Z0-9]+)[a-z]\.([a-z0-9A-Z]*)$/, "$1.$2");
        }

        // cloudinary
        // /master/master/ is another possible alternative
        if (domain.indexOf("media.glamour.com") >= 0 ||
            // https://assets.teenvogue.com/photos/56c648746d38be8a461b4c31/master/pass/GettyImages-104044913_master.jpg
            domain.indexOf("assets.teenvogue.com") >= 0 ||
            domain.indexOf("assets.vogue.com") >= 0 ||
            domain.indexOf("media.vanityfair.com") >= 0 ||
            domain.indexOf("media.gq.com") >= 0 ||
            domain.indexOf("media.wmagazine.com") >= 0 ||
            domain.indexOf("media.self.com") >= 0 ||
            domain.indexOf("media.pitchfork.com") >= 0 ||
            domain.indexOf("media.wired.com") >= 0 ||
            // https://media.golfdigest.com/photos/5a7498e5b9a33161e3689aa9/master/w_780,c_limit/180202-sb-party.jpg
            domain === "media.golfdigest.com" ||
            // https://media.architecturaldigest.com/photos/56380571a6f997a353b888a2/master/w_640,c_limit/worlds-best-stained-glass-windows-13-10.jpg
            domain === "media.architecturaldigest.com" ||
            // https://media.cntraveler.com/photos/59bb6a56e35d8f08044a32cf/16:9/pass/Rakotzbrucke-GettyImages-538162756.jpg
            // http://media.cntraveler.com/photos/59305e5611e6e853c33e7587/master/w_1440,c_limit/car-free-halibut-cove-alaska-GettyImages-496660709.jpg
            domain === "media.cntraveler.com" ||
            // https://media.allure.com/photos/5771af392554df47220a75cb/3:4/w_767/beauty-trends-blogs-daily-beauty-reporter-2016-05-19-selena-gomez-hair.jpg
            domain === "media.allure.com" ||
            src.match(/:\/\/[^/]*\/photos\/[0-9a-f]{24}\/[^/]*\/[^/]*\/[^/]*$/)) {
            return src.replace(/\/[^/]*\/[^/]*\/([^/]*)$/, "/original/original/$1");
        }

        if (domain.indexOf(".cloudinary.com") >= 0 ||
            domain === "images.taboola.com") {
            // https://res.cloudinary.com/emazecom/image/fetch/c_limit,a_ignore,w_320,h_200/https%3A%2F%2Fimg-aws.ehowcdn.com%2F877x500p%2Fs3.amazonaws.com%2Fcme_public_images%2Fwww_ehow_com%2Fi.ehow.com%2Fimages%2Fa04%2Fbd%2Fic%2Fchemical-energy-work-3.1-800x800.jpg
            // https://images.taboola.com/taboola/image/fetch/f_jpg%2Cq_auto%2Cc_fill%2Cg_faces:auto%2Ce_sharpen/https%3A%2F%2Fwww.gannett-cdn.com%2F-mm-%2F2e56892f6a349ad47192b530425d443fb365e5e9%2Fr%3Dx1803%26c%3D3200x1800%2Fhttps%2Fmedia.gannett-cdn.com%2F37861007001%2F37861007001_5735420050001_5735409691001-vs.jpg%3FpubId%3D37861007001
            // https://res.cloudinary.com/emazecom/image/fetch/c_limit,a_ignore,w_320,h_200/http%3A%2F%2Fcdn.expansion.mx%2Fdims4%2Fdefault%2F5227468%2F2147483647%2Fthumbnail%2F850x478%255E%2Fquality%2F75%2F%3Furl%3Dhttps%253A%252F%252Fcdn.expansion.mx%252Fmedia%252F2010%252F06%252F08%252Fobreros-chinos-trabajadores-china.jpg
            if (src.search(/:\/\/[^/]*\/[^/]*\/image\/fetch\//) >= 0) {
                newsrc = src.replace(/.*?:\/\/[^/]*\/[^/]*\/image\/fetch\/(?:.*?\/)?([^/]*(?::|%3A).*)/, "$1");
                if (newsrc.match(/^[^/:]*%3A/))
                    newsrc = decodeURIComponent(newsrc);
                return newsrc;
            }

            // https://the-hollywood-gossip-res.cloudinary.com/iu/s--xSziJrCi--/t_v_xlarge_l/cs_srgb,f_auto,fl_strip_profile.lossy,q_auto:420/v1409168696/video/victoria-justice-twerks-dances-like-nicki-minaj.png
            //   https://the-hollywood-gossip-res.cloudinary.com/iu/v1409168696/video/victoria-justice-twerks-dances-like-nicki-minaj.png
            newsrc = src.replace(/(\/iu\/[^/]*)\/.*?(\/v[0-9]*\/)/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        // https://res.cloudinary.com/beamly/image/upload/s--Ayyiome3--/c_fill,g_face,q_70,w_479/f_jpg/v1/news/sites/6/2014/11/Nick-Hewer-The-Apprentice.jpg
        //   https://res.cloudinary.com/beamly/image/upload/v1/news/sites/6/2014/11/Nick-Hewer-The-Apprentice.jpg
        //   https://res.cloudinary.com/beamly/image/upload/news/sites/6/2014/11/Nick-Hewer-The-Apprentice.jpg
        // https://res.cloudinary.com/beamly/image/upload/s--pMOefc2U--/c_fill,g_face,q_70,w_1160/f_jpg/v1/news/sites/6/2014/05/LuisaSwimsuit621.jpg
        //   https://res.cloudinary.com/beamly/image/upload/v1/news/sites/6/2014/05/LuisaSwimsuit621.jpg
        // https://res.cloudinary.com/beamly/image/upload/s--1uSHUtr1--/c_fill,g_face,q_70,w_1160/f_jpg/v1/news/sites/6/2013/12/o-katie-hopkins-570.jpg
        //   https://res.cloudinary.com/beamly/image/upload/v1/news/sites/6/2013/12/o-katie-hopkins-570.jpg
        // http://thefader-res.cloudinary.com/private_images/w_1440,c_limit,f_auto,q_auto:best/Badgyal5RGB_wbgyon/bad-gyal-nicest-cocky-interview-dancehall-catalan.jpg
        //   http://thefader-res.cloudinary.com/private_images/c_limit/Badgyal5RGB_wbgyon/bad-gyal-nicest-cocky-interview-dancehall-catalan.jpg
        // https://res.cloudinary.com/dk-find-out/image/upload/q_80,w_1920,f_auto/MA_00079563_yvu84f.jpg
        // https://res.cloudinary.com/jerrick/image/upload/p7jbqvi0aoxm4mdn3x6x
        // https://talenthouse-res.cloudinary.com/image/upload/c_limit,f_auto,fl_progressive,h_2048,w_2048/v1457507984/user-555017/submissions/a1kqddzzmsoyjxh2mkks.jpg
        //   https://talenthouse-res.cloudinary.com/image/upload/c_limit,f_auto,fl_progressive,h_2048,w_2048/user-555017/submissions/a1kqddzzmsoyjxh2mkks.jpg
        //   https://talenthouse-res.cloudinary.com/image/upload/v1457507984/user-555017/submissions/a1kqddzzmsoyjxh2mkks.jpg
        //   https://talenthouse-res.cloudinary.com/image/upload/user-555017/submissions/a1kqddzzmsoyjxh2mkks.jpg
        // https://nordot-res.cloudinary.com/t_size_l/ch/images/359126053920392289/origin_1.jpg
        //   https://nordot-res.cloudinary.com/ch/images/359126053920392289/origin_1.jpg
        // https://the-hollywood-gossip-res.cloudinary.com/iu/s--xSziJrCi--/t_v_xlarge_l/cs_srgb,f_auto,fl_strip_profile.lossy,q_auto:420/v1409168696/video/victoria-justice-twerks-dances-like-nicki-minaj.png
        if (domain.indexOf("res.cloudinary.com") >= 0) {
            newsrc = src
                // depends on repetition
                .replace(/\/image\/upload\/s\-\-[^/]*\-\-\//, "/image/upload/")
                .replace(/\/iu\/s\-\-[^/]*\-\-\//, "/iu/")
                .replace(/\/image\/upload\/[^/]*_[^/]*\//, "/image/upload/")
                .replace(/\/image\/upload\/v[0-9]+\//, "/image/upload/")
                //.replace(/(\/image\/upload\/)(?:(?:.*?\/?(v1\/))|(?:[^/]*\/))/, "$1$2")
                .replace(/(\/private_images\/)[^/]*\//, "$1c_limit/")
                .replace(/(:\/\/[^/]*\/)[^/]*\/(ch\/images\/[0-9]+\/[^/]*$)/, "$1$2");
            if (newsrc !== src) {
                return newsrc;
            }
        }

        if (domain.indexOf("images.complex.com") >= 0) {
            // https://images.complex.com/complex/images/c_crop,h_2437,w_3289,x_0,y_1067/c_limit,w_680/fl_lossy,pg_1,q_auto/gc123hobhudxx063ak8v/converse-yung-lean-one-star
            //   https://images.complex.com/complex/images/gc123hobhudxx063ak8v/converse-yung-lean-one-star
            // https://images.complex.com/complex/image/upload/c_limit,w_680/fl_lossy,pg_1,q_auto/qh1ve8ncxzxlfiy9aauw.jpg
            //   https://images.complex.com/complex/image/upload/qh1ve8ncxzxlfiy9aauw.jpg
            // https://images.complex.com/complex/images/c_scale,w_1100/fl_lossy,pg_1,q_auto/blwjl76jv2vcqdgd3sqy/bella-thorne
            //   https://images.complex.com/complex/images/blwjl76jv2vcqdgd3sqy/bella-thorne
            // http://images.complex.com/complex/image/upload/t_article_image/ckxhi0lpw2jsvm3rx3f4.jpg
            //   http://images.complex.com/complex/image/upload/ckxhi0lpw2jsvm3rx3f4.jpg
            // https://images.complex.com/complex/images/c_scale,w_1100/fl_lossy,pg_1,q_auto/brfqstj5jihhzr9eu1bw/bella-thorne
            //   https://images.complex.com/complex/images/brfqstj5jihhzr9eu1bw/bella-thorne
            return src.replace(/\/(images|image\/upload)\/[^/]*_[^/]*\//, "/$1/");
        }

        // https://images.spot.im/image/upload/q_70,fl_lossy,dpr_1.0,h_300,w_320,c_fill,g_face/v200/production/watfc8itl4hcgavprfku
        //   https://images.spot.im/image/upload/production/watfc8itl4hcgavprfku
        if (domain === "images.spot.im" ||
            // https://fashionista.com/.image/ar_16:9%2Cc_fill%2Ccs_srgb%2Cg_faces:center%2Cq_80%2Cw_620/MTQyNjI1MjYyNTc4NzA1NzM0/emma-watson-promojpg.jpg
            // https://fashionista.com/.image/t_share/MTQ2Njg0NzA2NzUzMDk1NTQ3/gettyimages-672499332.jpg
            domain === "fashionista.com" ||
            // http://images.pigeonsandplanes.com/images/c_crop,h_2268,w_3024,x_0,y_330/c_limit,f_auto,fl_lossy,q_auto,w_1030/obk4degjo35h2jzuwyd7/opal-press-2017
            domain === "images.pigeonsandplanes.com" ||
            // https://images.sftcdn.net/images/t_optimized,f_auto/p/2fbcf826-96d0-11e6-ac58-00163ec9f5fa/62785002/gang-beasts-screenshot.jpg
            domain === "images.sftcdn.net" ||
            // http://cdn.primedia.co.za/primedia-broadcasting/image/upload/c_fill,h_289,q_70,w_463/o0nu1bpsbgpfgvwa7vmj
            domain === "cdn.primedia.co.za" ||
            // https://www.maxim.com/.image/c_limit%2Ccs_srgb%2Cq_80%2Cw_960/MTUzMzQ0MzA2MTQzNTAzNzUz/harley-davidson-livewire3.webp
            domain === "www.maxim.com" ||
            // https://img.thedailybeast.com/image/upload/c_crop,d_placeholder_euli9k,h_1439,w_2560,x_0,y_0/dpr_2.0/c_limit,w_740/fl_lossy,q_auto/v1492195023/articles/2014/10/19/the-world-s-most-beautiful-boat-yours-for-half-a-billion-dollars/141018-teeman-star-yacht-tease_tlw0nl
            domain === "img.thedailybeast.com" ||
            // https://alibaba.kumpar.com/kumpar/image/upload/h_153,w_273,c_fill,ar_16:9,g_face,f_jpg,q_auto,fl_progressive,fl_lossy/hzwutxv6kqhrj3grgbtf.jpg
            domain === "alibaba.kumpar.com" ||
            // https://5b0988e595225.cdn.sohucs.com/q_70,c_zoom,w_640/images/20180121/1fad12f07c90464295f05598305a08ad.jpeg
            domain === "5b0988e595225.cdn.sohucs.com" ||
            // nano defender blocks this?
            // https://images-cdn.moviepilot.com/images/c_fill,h_1800,w_2897/t_mp_quality/vg7z3yhfbklgnnlki3cs/angelina-jolie-s-next-project-is-close-to-her-heart-and-her-son-maddox-will-be-involved-530390.jpg
            domain === "images-cdn.moviepilot.com" ||
            // http://img.playbuzz.com/image/upload/f_auto,fl_lossy,q_auto/cdn/a205ab41-8564-4ed6-8bc2-42d742b284f0/de57f9d2-be24-43e8-910a-c972d8cf6cb8.jpg
            domain === "img.playbuzz.com" ||
            // https://images.discerningassets.com/image/upload/c_scale,h_44,w_90/v1424385252/ahmf3bignioajopkklpo.jpg
            domain === "images.discerningassets.com" ||
            // https://images.radio-canada.ca/q_auto,w_310/v1/ici-info/16x9/fusee-space-tsss.jpg
            domain === "images.radio-canada.ca" ||
            // https://planet-sports-res.cloudinary.com/images/q_80,f_auto,dpr_2.0,d_planetsports:products:nopic.jpg/planetsports/products/46867500_00/rip-curl-fiesta-bandeau-bikini-set-women-black.jpg
            //   https://planet-sports-res.cloudinary.com/images/planetsports/products/46867500_00/rip-curl-fiesta-bandeau-bikini-set-women-black.jpg
            (domain.indexOf("res.cloudinary.com") >= 0 && src.indexOf("/images/") >= 0) ||
            // https://images.moviepilot.com/images/c_limit,q_auto:good,w_600/uom2udz4ogmkncouu83q/beauty-and-the-beast-credit-disney.jpg
            // https://images.moviepilot.com/image/upload/c_fill,h_64,q_auto,w_64/lpgwdrrgc3m8duvg7zt2.jpg
            domain === "images.moviepilot.com") {
            return src
                .replace(/%2C/g, ",")
                .replace(/\/[a-z]+_[^/_,]+(?:,[^/]*)?\//, "/")
                .replace("/t_mp_quality/", "/")
                .replace(/\/v[0-9]+\//, "/");
        }

        // https://image.kkday.com/image/get/w_1900%2Cc_fit/s1.kkday.com/product_17911/20170926035641_Kii80/jpg
        //   https://image.kkday.com/image/get/s1.kkday.com/product_17911/20170926035641_Kii80/jpg
        if (domain === "image.kkday.com") {
            return src.replace(/\/image\/get\/[^/]*(?:%2C|,)[^/]*\//, "/image/get/");
        }

        if (domain.indexOf("images.fastcompany.net") >= 0 ||
            domain.indexOf("i.kinja-img.com") >= 0 ||
            domain.indexOf("dwgyu36up6iuz.cloudfront.net") >= 0
           ) {
            return src.replace(/\/image\/upload\/[^/]*[_-][^/]*\//, "/image/upload/");
        }

        if (domain.indexOf("cdn.skim.gs") >= 0) {
            // http://cdn.skim.gs/image/upload/c_fill,dpr_1.0,f_auto,fl_lossy,q_auto,w_940/v1456338060/msi/fc8_k4lgbp.jpg
            return src
                .replace(/\/image\/upload\/[^/]*_[^/]*\//, "/image/upload/")
                .replace(/\/images\/[^/]*_[^/]*\//, "/images/");
        }

        if ((domain.indexOf("biography.com") >= 0 ||
             domain === "www.guitarworld.com" ||
             domain === "www.guitaraficionado.com" ||
             domain === "www.psneurope.com") &&
            src.indexOf("/.image/") >= 0 ||
            src.match(/:\/\/[^/]*\/\.image\/[^/]*_[^/]*\/[A-Za-z-0-9]{24}\/[^/]*$/)) {
            // https://www.biography.com/.image/c_limit%2Ccs_srgb%2Cq_80%2Cw_960/MTI2NDQwNDA2NTg5MTUwNDgy/ariana-grande-shutterstock_213445195-600x487jpg.webp
            // https://www.guitarworld.com/.image/t_share/MTUxNDQ0NTk1MTMyMDgxNDA3/keithrichardsgettyimages-71684054.jpg
            //   https://www.guitarworld.com/.image//MTUxNDQ0NTk1MTMyMDgxNDA3/keithrichardsgettyimages-71684054.jpg
            // https://www.guitarworld.com/.image/ar_8:10%2Cc_fill%2Ccs_srgb%2Cg_faces:center%2Cq_80%2Cw_620/MTUwNjEyNDY4MDM2MzQ3MjU2/keith_richards_2jpg.jpg
            //   https://www.guitarworld.com/.image//MTUwNjEyNDY4MDM2MzQ3MjU2/keith_richards_2jpg.jpg
            // https://www.psneurope.com/.image/c_limit%2Ccs_srgb%2Cq_80%2Cw_482/MTUwNjU0MjczNjQ2NjM0NjU3/vintage-studios-web.webp
            //   https://www.psneurope.com/.image/MTUwNjU0MjczNjQ2NjM0NjU3/vintage-studios-web.webp
            return src.replace(/(\/.image)\/[^/]*(\/[^/]*\/[^/]*)$/, "$1$2");
        }

        if (domain.indexOf(".vogue.de") >= 0 &&
            src.indexOf("/storage/images/") >= 0) {
            // http://m.vogue.de/var/vogue/storage/images/home/vogue/fashion-shows/kollektionen/fruehjahr-2017-hc/paris/alexandre-vauthier/runway/_arc0726/23291608-1-ger-DE/_arc0726_v540x910.jpg
            return src.replace(/_v[0-9]*x[0-9]*\.([^/]*)$/, ".$1");
        }

        if (domain.indexOf(".popsugar-assets.com") >= 0 ||
            domain.indexOf(".onsugar.com") >= 0) {
            // http://media3.popsugar-assets.com/files/2013/09/16/795/n/1922564/b962955383f6b80f_1592163256t6a65.xxxlarge_2x/i/Emma-Watson-all-legs-sexy-Peter-Pilotto-cutout-minidress.jpg
            // https://media1.popsugar-assets.com/files/thumbor/Aq5Tn8-7kqPSJs4U0_QaYoM6x8Q/fit-in/1024x1024/filters:format_auto-!!-:strip_icc-!!-/2015/03/30/647/n/1922564/ccc1eafd_edit_img_cover_file_864129_1397566805/i/Emma-Watson-Best-Red-Carpet-Looks.png
            //   https://media1.popsugar-assets.com/files/2015/03/30/647/n/1922564/ccc1eafd_edit_img_cover_file_864129_1397566805/i/Emma-Watson-Best-Red-Carpet-Looks.png
            // https://media1.popsugar-assets.com/files/thumbor/1ktKvFdaPtIVjrL085ZgDu-0IUM/160x160/filters:format_auto-!!-:strip_icc-!!-:sharpen-!1,0,true!-/2014/04/09/959/n/1922564/d006b9f456c00f56_478466321_10/i/Emma-Watson-Wes-Gordon-2014-Noah-Germany-Premiere.jpg
            //   https://media1.popsugar-assets.com/files/2014/04/09/959/n/1922564/d006b9f456c00f56_478466321_10/i/Emma-Watson-Wes-Gordon-2014-Noah-Germany-Premiere.jpg
            newsrc = src.replace(/\/thumbor\/[^/]*\/(?:fit-in\/)?[^/]*\/filters:[^/]*\//, "/");
            if (newsrc !== src)
                return newsrc;

            // http://media1.popsugar-assets.com/files/2013/02/08/2/192/1922398/13bc50e021acd58e_wenn10840119.xxxlarge/i/Spring-Breakers-Berlin-Red-Carpet-Premiere-Pictures.jpg
            //   http://media1.popsugar-assets.com/files/2013/02/08/2/192/1922398/13bc50e021acd58e_wenn10840119/i/Spring-Breakers-Berlin-Red-Carpet-Premiere-Pictures.jpg
            // https://media1.popsugar-assets.com/files/2015/09/02/221/n/37139775/d391fe8f30364ef0_15._2007_GettyImages-81449203/i/Selena-Gomez.jpg
            // http://media4.onsugar.com/files/2013/12/16/757/n/1922398/1f2e71247e26b096_Twoimageskinnyheadshot_R.jpg.xlarge/i/Gisele-Bundchen-Wearing-Bikini-Miami.jpg
            //   http://media4.onsugar.com/files/2013/12/16/757/n/1922398/1f2e71247e26b096_Twoimageskinnyheadshot_R/i/Gisele-Bundchen-Wearing-Bikini-Miami.jpg
            // http://media1.popsugar-assets.com/files/2014/04/09/009/n/1922441/9933a3baeee323df_141827630.xxxlarge_2x/i/Dog-Thinks-Parade-All-Him.jpg
            //   http://media1.popsugar-assets.com/files/2014/04/09/009/n/1922441/9933a3baeee323df_141827630/i/Dog-Thinks-Parade-All-Him.jpg
            return src.replace(/\.[a-z]*(?:_[0-9x]+)(\/i\/[^/]*)$/, "$1");
        }

        if (domain === "elleuk.cdnds.net") {
            // http://elleuk.cdnds.net/15/37/980x1306/980x1306--29f8-11e6-9cdd-21395b3400d9-assets-elleuk-com-gallery-16644-1365760633-emma-watson-january-2013-jpg.jpg
            //   http://assets.elleuk.com/gallery/16644/1365760633-emma-watson-january-2013.jpg
            //
            // http://elleuk.cdnds.net/15/37/768x1024/768x1024-d38b1ahttp-s3-eu-west-1-amazonaws-com-ee-elleuk-2-emma-watson-december-2014-cover-star-composite-jpg.jpg
            // http://s3-eu-west-1.amazonaws.com/ee-elleuk/Hailey-Baldwin-Topshop-unique-RS15-0515-Imaxtree.jpg
            // problem: capitalized
            newsrc = src.replace(/:\/\/.*\/[^/]*assets-elleuk-com-gallery-([0-9]*)-([^/]*)-([^-/.]*)\.[^-/.]*$/, "://assets.elleuk.com/gallery/$1/$2.$3");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain.indexOf(".cdnds.net") >= 0 &&
            !src.match(/\/gallery_[^/]*$/) &&
            !src.match(/\/[0-9]*x[0-9]*-[^/]*$/)) {
            //domain.indexOf("esquireuk.cdnds.net") < 0 &&
            //domain.indexOf("digitalspyuk.cdnds.net") < 0

            // doesn't work:
            // http://digitalspyuk.cdnds.net/14/42/768x512/gallery_7065877-low_res-.jpg
            //   http://digitalspyuk.cdnds.net/14/42/1600x1067/gallery_7065877-low_res-.jpg
            // http://digitalspyuk.cdnds.net/11/51/768x512/gallery_tv_countdown_nick_hewer_2.jpg
            //   http://digitalspyuk.cdnds.net/11/51/gallery_tv_countdown_nick_hewer_2.jpg
            // http://digitalspyuk.cdnds.net/13/40/980x1470/gallery_emma-watson.jpg
            //
            // works:
            // http://digitalspyuk.cdnds.net/16/47/980x490/landscape-1479890677-gettyimages-108378197.jpg
            //   http://digitalspyuk.cdnds.net/16/47/landscape-1479890677-gettyimages-108378197.jpg
            // http://elleuk.cdnds.net/17/06/1600x900/hd-aspect-1486581368-emma-web.jpg
            //   http://elleuk.cdnds.net/17/06/hd-aspect-1486581368-emma-web.jpg
            // http://cosmouk.cdnds.net/14/51/980x490/nrm_1418985628-nick-hewer-quits-apprentice.jpg?resize=768:*
            //   http://cosmouk.cdnds.net/14/51/nrm_1418985628-nick-hewer-quits-apprentice.jpg?resize=768:*
            // http://elleuk.cdnds.net/17/25/480x719/gallery-1498212018-emmawatsonlouisvuitton.jpg
            //   http://elleuk.cdnds.net/17/25/gallery-1498212018-emmawatsonlouisvuitton.jpg
            newsrc = src.replace(/\/[0-9]+x[0-9]+\//, "/").replace(/(\/[^/]*)\?[^/]*$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "redonline.cdnds.net") {
            // http://redonline.cdnds.net/main/gallery/21794/grammy-awards-2016-taylor-swift__portrait.jpg
            //   http://redonline.cdnds.net/main/gallery/21794/grammy-awards-2016-taylor-swift.jpg
            return src.replace(/__[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf("img.usmagazine.com") >= 0) {
            return src.replace(/(.*?[^:])\/[0-9]*-[^/]*\//, "$1/");
        }

        if (domain.indexOf("gannett-cdn.com") >= 0 &&
            src.indexOf("/-mm-/") >= 0) {
            // https://www.gannett-cdn.com/-mm-/2e56892f6a349ad47192b530425d443fb365e5e9/r=x1803&c=3200x1800/https/media.gannett-cdn.com/35547429001/35547429001_5727574988001_5727573873001-vs.jpg?pubId=35547429001
            //   https://media.gannett-cdn.com/35547429001/35547429001_5727574988001_5727573873001-vs.jpg
            // https://www.gannett-cdn.com/-mm-/2eab0172f87f63087b9b90322b67744820df1d8d/c=0-230-4565-2809&r=x1683&c=3200x1680/local/-/media/2018/02/27/USATODAY/USATODAY/636553489293713705-AFP-AFP-10H1QY-97704432.JPG
            //   https://www.gannett-cdn.com/media/2018/02/27/USATODAY/USATODAY/636553489293713705-AFP-AFP-10H1QY-97704432.JPG
            newsrc = src.replace(/.*?\/-mm-\/[0-9a-f]*\/[^/]*\/(http[^/]*)\/(.*)$/, "$1://$2");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/\/-mm-\/.*?\/-\//, "/");
        }

        if (domain.indexOf(".aolcdn.com") >= 0) {
            var regex1 = /.*image_uri=([^&]*).*/;

            if (src.match(regex1)) {
                // https://o.aolcdn.com/images/dims?thumbnail=640%2C420&quality=75&format=jpg&image_uri=https%3A%2F%2Faol-releases-assets-production.s3.amazonaws.com%2Fgenerator%2F07A13DEB.jpg&client=cbc79c14efcebee57402&signature=09ed437d01bfde0d182a609c759f58006578aa3a
                newsrc = decodeURIComponent(src.replace(/.*image_uri=([^&]*).*/, "$1"));
            } else if (src.match(/.*o\.aolcdn\.com\/images\//)) {
                // https://o.aolcdn.com/images/dims3/GLOB/legacy_thumbnail/1028x675/format/jpg/quality/85/http%3A%2F%2Fo.aolcdn.com%2Fhss%2Fstorage%2Fmidas%2F652aa88cb26c6aafe4dca4eef405c15%2F205409332%2FScreen%2BShot%2B2017-06-23%2Bat%2B2.36.37%2BPM.png
                //   http://o.aolcdn.com/hss/storage/midas/652aa88cb26c6aafe4dca4eef405c15/205409332/Screen+Shot+2017-06-23+at+2.36.37+PM.png
                newsrc = decodeURIComponent(src).replace(/.*o\.aolcdn\.com\/images\/[^:]*\/([^:/]*:.*)/, "$1");
            } else if (src.match(/^[a-z]+:\/\/[^/]*\/hss\/storage\/midas\//)) {
                // https://s.aolcdn.com/hss/storage/midas/668dd572f108685386710ff09bb15f2a/205350917/1280_selena_gomez_the_weeknd_carbone_backgrid_BGUS_879674_007.jpg
                //   https://s.aolcdn.com/hss/storage/midas/668dd572f108685386710ff09bb15f2a/205350917/selena_gomez_the_weeknd_carbone_backgrid_BGUS_879674_007.jpg
                return src.replace(/\/[0-9]+_([^/]*)$/, "/$1");
            }

            if (newsrc && newsrc !== src)
                return newsrc;
        }

        if (domain.indexOf("imagesvc.timeincapp.com") >= 0) {
            // http://imagesvc.timeincapp.com/v3/foundry/image/?q=70&w=1440&url=https%3A%2F%2Ftimedotcom.files.wordpress.com%2F2017%2F11%2Fcolumbia-1.jpg%3Fquality%3D85
            //   https://timedotcom.files.wordpress.com/2017/11/columbia-1.jpg
            return decodeURIComponent(src.replace(/.*image\/?\?.*url=([^&]*).*/, "$1"));
        }

        /*if (domain.indexOf(".photoshelter.com") >= 0) {
            return src.replace(/\/s\/[0-9]*\/[0-9]*\//, "/");
        }*/

        if (domain.indexOf(".photoshelter.com") >= 0) {
            // http://c.photoshelter.com/img-get/I00002_.IhMQAZEg/t/200/I00002_.IhMQAZEg.jpg
            //   https://ssl.c.photoshelter.com/img-get/I00002_.IhMQAZEg/s/700/SHM-Spider-Man-Homecoming-Prem-28062017-001.jpg
            //   https://ssl.c.photoshelter.com/img-get2/I00002_.IhMQAZEg/fit=4000x4000/SHM-Spider-Man-Homecoming-Prem-28062017-001.jpg
            //   https://ssl.c.photoshelter.com/img-get2/I00002_.IhMQAZEg/fit=99999999999/SHM-Spider-Man-Homecoming-Prem-28062017-001.jpg
            // https://ssl.c.photoshelter.com/img-get2/I00007dPXW9BAIiU/sec=wd0sd0oe0lwe0ms1000ed20170311lyHGYvV7mWMka15/fit=2040x2040/Rutgers-womens-rowing-team-works-out-on-the-Raritan-River.jpg -- 2040x1357
            //   https://ssl.c.photoshelter.com/img-get2/I00007dPXW9BAIiU/fit=4000x4000/Rutgers-womens-rowing-team-works-out-on-the-Raritan-River.jpg
            // https://culver.photoshelter.com/asset-get/A0000N3HQ83lQtzA/20160913_325_RS-0.jpg -- 5000x3333
            // https://ssl.c.photoshelter.com/img-get/I0000sljp0JcarNs/pak05lhecop-57.jpg -- 500x332
            // https://ssl.c.photoshelter.com/img-get/I0000x_JQ_qY2rhs/s/750/750/1678-James-Brown-11-and-Tomi-Rae-Hynie-Brown-and-Martha-Stewart.jpg
            //   https://ssl.c.photoshelter.com/img-get2/I0000x_JQ_qY2rhs/fit=99999999999/1678-James-Brown-11-and-Tomi-Rae-Hynie-Brown-and-Martha-Stewart.jpg
            return src
                .replace(/\/img-get2\/([^/]*)\/(?:[a-z]+=[^/]*\/)*([^/]*)$/, "/img-get2/$1/fit=99999999999/$2")
                .replace(/\/img-get\/([^/]*)(?:\/[ts]\/[0-9]+\/(?:[0-9]+\/)?)?([^/]*)$/, "/img-get2/$1/fit=99999999999/$2");
            //return src.replace
        }

        if (domain.indexOf("www.celebzz.com") >= 0 && src.indexOf("/wp-content/uploads/") >= 0) {
            return src.replace(/-[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        // https://images-na.ssl-images-amazon.com/images/I/B1GLFkULdTS._CR0,0,3840,2880_._SL1000_.png
        //   https://images-na.ssl-images-amazon.com/images/I/B1GLFkULdTS.png
        // https://images-na.ssl-images-amazon.com/images/I/81yxJ9lr5vL.AC_SL1500_.jpg -- no ._
        //   https://images-na.ssl-images-amazon.com/images/I/81yxJ9lr5vL.jpg
        if (domain.indexOf("images-na.ssl-images-amazon.com") >= 0 ||
            // https://images-eu.ssl-images-amazon.com/images/I/41TMMGD0XZL._SL500_AC_SS350_.jpg
            //   https://images-eu.ssl-images-amazon.com/images/I/41TMMGD0XZL.jpg
            domain.indexOf("images-eu.ssl-images-amazon.com") >= 0 ||
            // http://ec2.images-amazon.com/images/I/81IotHEYjBL._AA1417_.jpg
            //   http://ec2.images-amazon.com/images/I/81IotHEYjBL.jpg
            domain.indexOf(".images-amazon.com") >= 0 ||
            domain.indexOf(".ssl-images-amazon.com") >= 0 ||
            // https://m.media-amazon.com/images/I/61rtKO6VrUL._SL500_.jpg
            //   https://m.media-amazon.com/images/I/61rtKO6VrUL.jpg
            domain.indexOf(".media-amazon.com") >= 0 ||
            // https://ia.media-imdb.com/images/M/MV5BNjA1NDYwMDQ3MF5BMl5BanBnXkFtZTcwOTYyNDQ0MQ@@._V1_UY268_CR1,0,182,268_AL_.jpg
            //   https://ia.media-imdb.com/images/M/MV5BNjA1NDYwMDQ3MF5BMl5BanBnXkFtZTcwOTYyNDQ0MQ@@.jpg
            // https://ia.media-imdb.com/images/M/MV5BMTU2NDI2YjktYjYxMy00OGIwLWEzMjktNzEzNzA4YzVmZGRjXkEyXkFqcGdeQXVyNDU4MDk4OA@@._V1_UY317_CR51,0,214,317_AL_.jpg
            //   https://ia.media-imdb.com/images/M/MV5BMTU2NDI2YjktYjYxMy00OGIwLWEzMjktNzEzNzA4YzVmZGRjXkEyXkFqcGdeQXVyNDU4MDk4OA@@.jpg
            domain.indexOf(".media-imdb.com") >= 0 ||
            // https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/users/1497668011i/22813064._UX100_CR0,0,100,100_.jpg
            //   https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/users/1497668011i/22813064.jpg
            domain === "i.gr-assets.com") {
            return {
                //url: src.replace(/\._[^/]*\.([^./]*)$/, "._.$1"),
                url: src.replace(/\.[^/]*\.([^./]*)$/, ".$1"), // for now this seems to work for all images
                always_ok: true,
                can_head: false
            };
        }

        /*if (domain.indexOf("cdn-img.instyle.com") >= 0) {
            return src.replace(/(\/files\/styles\/)[^/]*(\/public)/, "$1original$2");
        }

        if (domain.indexOf("static.independent.co.uk") >= 0) {
            return src.replace(/(\/styles\/)story_[^/]*(\/public)/, "$1story_large$2");
        }*/

        // drupal
        // https://italyxp.com/sites/default/files/mediaitalyxp/vesuvius.jpg?width=820&height=620&iframe=true
        // https://www.windowscentral.com/sites/wpcentral.com/files/styles/xlarge_wm_brw/public/field/image/2018/03/surviving-mars-hero.jpg?itok=4_uW-AOb
        //   https://www.windowscentral.com/sites/wpcentral.com/files/field/image/2018/03/surviving-mars-hero.jpg -- different image
        if (domain.indexOf("cdn-img.instyle.com") >= 0 ||
            domain.indexOf("static.independent.co.uk") >= 0 ||
            domain.indexOf("static.standard.co.uk") >= 0 ||
            /*domain.indexOf("www.billboard.com") >= 0 ||
            domain.indexOf("www.harpersbazaararabia.com") >= 0 ||
            domain.indexOf("www.etonline.com") >= 0 ||*/
            domain.indexOf("o.oystermag.com") >= 0 ||
            /*domain.indexOf("www.metro.us") >= 0 ||
            domain.indexOf("www.mtv.co.uk") >= 0 ||
            domain.indexOf("www.grammy.com") >= 0 ||*/
            domain.match(/cdn[0-9]*\.thr\.com/) ||
            domain.match(/s[0-9]*\.ibtimes\.com/) ||
            // https://www.standard.co.uk/s3fs-public/styles/hero_tablet/public/thumbnails/image/2014/11/18/15/nickhewer4.jpg
            //   https://www.standard.co.uk/s3fs-public/thumbnails/image/2014/11/18/15/nickhewer4.jpg
            //
            // https://www.standard.co.uk/s3fs-public/image/2014/11/18/15/nickhewer4.jpg
            // is redirected to:
            // http://www.standard.co.uk/s3/files/image/2014/11/18/15/nickhewer4.jpg
            // which is not found
            // but replacing /s3fs-public/ to /s3/files/ doesn't work
            //domain === "www.standard.co.uk" ||
            // https://media.pri.org/s3fs-public/styles/story_main/public/story/images/coco-movie.jpg?itok=Uo82G_FI
            src.match(/\/s3fs-public\/styles\/[^/]*\/public\//) ||
            domain === "media.pri.org" ||
            // http://cdn.whodoyouthinkyouaremagazine.com/sites/default/files/imagecache/623px_wide/episode/hewer500.jpg
            //   http://cdn.whodoyouthinkyouaremagazine.com/sites/default/files/episode/hewer500.jpg
            src.match(/\/sites\/[^/]*\/files\/styles\/[^/]*/) ||
            src.match(/\/sites\/[^/]*\/files\/[^/]*\/styles\/[^/]*/) ||
            // https://cdn2.benzinga.com/files/imagecache/1024x768xUP/images/story/2012/rihanna.jpg
            // http://mobile.dlisted.com/files/imagecache/photo-preview-mobile/files/hotslutweeknorwoodyoung.jpg
            //   http://i.dlisted.com/files/hotslutweeknorwoodyoung.jpg
            src.match(/(?:\/sites\/[^/]*)?\/files\/imagecache\/[^/]*/) ||
            // http://shakespearestaging.berkeley.edu/system/files/styles/large/private/images/titus-andronicus-the-old-globe-2006-2109.jpg?itok=zmPfmjYs
            src.search(/\/files\/styles\/[^/]*\/(?:public|private)\//) >= 0 ||
            // https://www.straight.com/files/v3/styles/gs_large/public/2013/09/MUS_Nostalghia_2386.jpg
            //   https://www.straight.com/files/v3/2013/09/MUS_Nostalghia_2386.jpg
            src.search(/\/files\/[^/]*\/styles\/[^/]*\/(?:public|private)\//) >= 0) {

            newsrc = src.replace(/\/styles\/.*?\/(?:public|private)\//, "/").replace(/\/imagecache\/[^/]*\/(?:files\/)?/, "/").replace(/\?.*$/, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain.indexOf("www.trbimg.com") >= 0) {
            return src.replace(/\/[0-9]*\/[0-9]*x[0-9]*\/*$/, "/").replace(/\/[0-9]*\/*$/, "/");
        }

        if (domain.indexOf(".bp.blogspot.com") >= 0 ||
            domain.search(/lh[0-9]\.googleusercontent\.com/) === 0 ||
            domain.search(/ci[0-9]\.googleusercontent\.com/) === 0 ||
            domain.indexOf(".ggpht.com") >= 0) {
            // https://lh3.googleusercontent.com/qAhRBhfciCcosUoYHPJr5WtNYSJ81vpSqcQwbQitZtsR3mB2aCUj7J5LvhJOCfWn-CWqiLB18SyTr1VJvm_HI7B72opIAMZiZvg=w9999-h9999
            // https://lh3.googleusercontent.com/j7RWveJMFLh5TNHWRRvQnTpwFF3Xzz-mZd8ff-2PmKGIycRxZkUaOmf14g7wIj7D5x2ci1d6DbstteRtb9GN5OXF6ozB32KIY0HUtXFKnN48A1DaxnV-7Nk3YoGbI5ITVJiHA6HyN1cGo_djsw
            // http://lh4.ggpht.com/__zoKJ77EvEc/TO-9wdVTcwI/AAAAAAAAJEA/SbyR-4a03S0/dekotora%20%289%29%5B2%5D.jpg?imgmax=800 -- larger than s0?
            return src
                .replace(/#.*$/, "")
                .replace(/\?.*$/, "")
                .replace(/\/[swh][0-9]*(-[^/]*]*)?\/([^/]*)$/, "/s0/$2")
                .replace(/(=[^/]*)?$/, "=s0?imgmax=0");
        }

        if (domain === "images-blogger-opensocial.googleusercontent.com") {
            // https://images-blogger-opensocial.googleusercontent.com/gadgets/proxy?url=http%3A%2F%2F1.bp.blogspot.com%2F-jdpU1PhmEgg%2FU2lBLnp50QI%2FAAAAAAAAChs%2FUu01Lvq-2xc%2Fs1600%2Frihanna%2Bmccartney.jpg&container=blogger&gadget=a&rewriteMime=image%2F*
            //   http://1.bp.blogspot.com/-jdpU1PhmEgg/U2lBLnp50QI/AAAAAAAAChs/Uu01Lvq-2xc/s1600/rihanna+mccartney.jpg
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/gadgets\/proxy.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain.indexOf("images.thestar.com") >= 0) {
            return src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
        }

        if (domain.indexOf("cdn.narcity.com") >= 0) {
            return src.replace(/(\/[^/.]*\.[^/._]*)_[^/]*$/, "$1");
        }

        if (domain.indexOf("images.vanityfair.it") >= 0) {
            return src.replace(/(\/gallery\/[0-9]*\/)[^/]*\//, "$1Original/");
        }

        if (domain.indexOf(".r29static.com") >= 0) {
            // http://s1.r29static.com//bin/entry/812/0,12,460,552/0x864,80/1207816/image.jpg
            // 0x0,100 and x,100 both work
            return src.replace(/\/bin\/entry\/([^/]*)\/(?:[0-9]+,[0-9]+,[0-9]+,[0-9]+\/)?[^/]*(,[^/]*)?\/([^,]*)$/, "/bin/entry/$1/x,100/$3");
        }

        if (domain.indexOf("img.huffingtonpost.com") >= 0) {
            // http://img.huffingtonpost.com/asset/5936853f2200003d00c6c785.png
            // http://img.huffingtonpost.com/asset/5a6b56b02d00004900942e4e.jpeg
            return src.replace(/\/asset\/[^/]*\/([^/.]*\.[^/.]*)$/, "/asset/$1").replace(/\?[^/]*$/, "");
        }

        if (domain === "images.huffingtonpost.com") {
            // https://images.huffingtonpost.com/2015-12-15-1450212883-2879887-356670f8740946d741c648b23_villarufologardensravellocampaniaitalycrgetty-thumb.jpg
            //   https://images.huffingtonpost.com/2015-12-15-1450212883-2879887-356670f8740946d741c648b23_villarufologardensravellocampaniaitalycrgetty.jpg
            return src.replace(/-thumb(\.[^/.]*)$/, "$1");
        }

        if (domain === "i.huffpost.com" ||
            domain === "s-i.huffpost.com") {
            // https://i.huffpost.com/gen/1557988/thumbs/o-EMMA-570.jpg
            // https://i.huffpost.com/gen/1557988/images/o-EMMA-570.jpg
            // https://i.huffpost.com/gen/3142438/images/o-LORD-SUGAR-570.jpg
            // https://i.huffpost.com/gen/4681756/thumbs/o-601718112-900.jpg
            // https://i.huffpost.com/gen/4681864/thumbs/o-601718288-900.jpg?2
            // https://s-i.huffpost.com/gen/4681864/original.jpg
            // https://i.huffpost.com/gen/3217980/images/n-JAZMIN-GRACE-GRIMALDI-628x314.jpg
            // https://i.huffpost.com/gen/816377/original.jpg

            // http://i.huffpost.com/gadgets/slideshows/331487/slide_331487_3313386_free.jpg
            // http://i.huffpost.com/gadgets/slideshows/331487/slide_331487_3313616_free.jpg
            // http://i.huffpost.com/gadgets/slideshows/366854/slide_366854_4186736_compressed.jpg
            // http://i.huffpost.com/gadgets/slideshows/278815/slide_278815_2063217_original.jpg
            return src
                .replace(/(\/gadgets\/slideshows\/[0-9]*\/slide_[^/]*_)[a-z]*(\.[^/.]*)$/, "$1original$2")
                .replace(/(\/gen\/[0-9]*\/).*(\.[^/.?]*)(?:\?[^/]*)?$/, "$1original$2");
        }

        if ((domain.indexOf(".washingtonpost.com") >= 0 ||
             // https://c.o0bg.com/rf/image_371w/Boston/2011-2020/2018/01/03/BostonGlobe.com/Arts/Images/AFP_V03Q8.jpg
             domain === "c.o0bg.com" ||
             // https://www.statesman.com/rf/image_md/Pub/p9/AJC/Blog/Diehards/2018/04/05/Images/240866_GettyImages-872925824_sndecp.jpg
             domain === "www.statesman.com" ||
             // https://www.myajc.com/rf/image_lowres/Pub/p6/CmgSharedContent/2015/05/18/Images/photos.medleyphoto.7287170.jpg
             domain === "www.myajc.com" ||
             domain === "www.hindustantimes.com") &&
            src.indexOf("/rf/") >= 0) {
            // test: https://img.washingtonpost.com/rf/image_1483w/2010-2019/Wires/Online/2017-11-21/AP/Images/Music_Taylor_Swift_36357.jpg
            // error: Query String : src=http://www.washingtonpost.com/rw/2010-2019/Wires/Online/2017-11-21/AP/Images/Music_Taylor_Swift_36357.jpg&w=1483
            // real: https://img.washingtonpost.com/rf/image_1484w/2010-2019/Wires/Online/2017-11-21/AP/Images/Music_Taylor_Swift_36357.jpg-ced9a.jpg?uuid=TiTSis5fEeeoe0fxS3MWKg

            // https://www.washingtonpost.com/rf/image_480x320/2010-2019/WashingtonPost/2018/01/26/Foreign/Images/AFP_XY105.jpg?t=20170517a
            //   https://www.washingtonpost.com/rw/2010-2019/WashingtonPost/2018/01/26/Foreign/Images/AFP_XY105.jpg

            // https://www.hindustantimes.com/rf/image_size_960x540/HT/p2/2018/01/08/Pictures/susan-sarandon-watson-clemente-marai-larasi-emma_f6e96a02-f475-11e7-95e6-04e0a17510b6.jpg - stretched
            //   https://www.hindustantimes.com/rf/image/HT/p2/2018/01/08/Pictures/susan-sarandon-watson-clemente-marai-larasi-emma_f6e96a02-f475-11e7-95e6-04e0a17510b6.jpg
            // https://www.hindustantimes.com/rf/image_size_90x90/HT/p2/2018/01/27/Pictures/parliament-session_d792b3aa-037c-11e8-8651-33050e64100a.jpg
            //   https://www.hindustantimes.com/rf/image/HT/p2/2018/01/27/Pictures/parliament-session_d792b3aa-037c-11e8-8651-33050e64100a.jpg
            // https://www.hindustantimes.com/rf/image_size_960x540/HT/p2/2018/01/27/Pictures/parliament-session_d146b4e2-037c-11e8-8651-33050e64100a.jpg
            //   https://www.hindustantimes.com/rf/image/HT/p2/2018/01/27/Pictures/parliament-session_d146b4e2-037c-11e8-8651-33050e64100a.jpg
            // https://www.hindustantimes.com/rf/image_size_960x540/HT/p2/2018/01/08/Pictures/emma-watson_af695f5c-f475-11e7-95e6-04e0a17510b6.jpg
            //   https://www.hindustantimes.com/rf/image/HT/p2/2018/01/08/Pictures/emma-watson_af695f5c-f475-11e7-95e6-04e0a17510b6.jpg
            //   https://www.hindustantimes.com/rw/HT/p2/2018/01/08/Pictures/emma-watson_af695f5c-f475-11e7-95e6-04e0a17510b6.jpg

            // return src.replace(/\/image_size_[0-9]+x[0-9]+\//, "/image/");
            newsrc = src.replace(/(.*?:\/\/[^/]*\/)rf\/[^/]*\/(.*)$/, "$1rw/$2").replace(/[?&][^/]*$/, "");
            if (newsrc !== src) {
                return newsrc;
            }

            // replaced by a generic one
            //return src.replace(/.*\/wp-apps\/imrs\.php\?[^/]*src=/, "");
        }

        if (domain.indexOf("www.livemint.com") >= 0) {
            return src.replace(/\/rf\/[^/]*\/(.*)$/, "/rw/$1");
        }

        if (domain.match(/^a[0-9]*\.foxnews\.com/)) {
            // http://a57.foxnews.com/images.foxnews.com/content/fox-news/world/2017/11/15/firefighters-in-thailands-capital-on-front-line-citys-fight-against-snakes/_jcr_content/par/featured_image/media-0.img.jpg/931/524/1510749948281.jpg?ve=1&tl=1
            // down for now?
            //console.log(src.replace(/.*\/a[0-9]*\.foxnews\.com\/(.*).*/, "$1"));
            if (src.replace(/.*\/a[0-9]*\.foxnews\.com\/([^/]*).*/, "$1") !== "images.foxnews.com") {
                return src.replace(/.*\/a[0-9]*\.foxnews\.com\/(.*)\/[0-9]+\/[0-9]+\/([^/]*)$/, "http://$1/$2");
            }
            return src.replace(/(\/a[0-9]*\.foxnews\.com\/.*)\/[0-9]+\/[0-9]+\/([^/?]*)(?:\?.*)?$/, "$1/0/0/$2");
        }

        if (domain.indexOf("cdn.cliqueinc.com") >= 0) {
            // https://cdn.cliqueinc.com/posts/img/uploads/current/images/0/39/490/main.original.640x0c.jpg
            //   https://cdn.cliqueinc.com/posts/img/uploads/current/images/0/39/490/main.original.jpg
            return src.replace(/(\/[^/]*)\.[0-9]*x[0-9]*[^/.]*\.([^./]*)$/, "$1.$2");
        }

        if (domain.indexOf(".hubstatic.com") >= 0) {
            return src.replace(/_[^_/.]*\.([^/.]*)$/, ".$1");
        }

        // disabling due to recent ig updates
        if ((domain.indexOf("cdninstagram.com") >= 0 ||
             domain.match(/^instagram\..*\.fbcdn\.net/)) && false) {
            var urlstart = protocol + "://" + domain + "/";
            var has_t = false;
            for (i = 0; i < splitted.length; i++) {
                splitted[i] = splitted[i].replace(/\?.*$/, "");
                 if (splitted[i].match(/^t[0-9]+\.[0-9]+-[0-9]+$/)) {
                     urlstart += splitted[i] + "/";
                     has_t = true;
                 } else if (splitted[i].match(/^[0-9_]*_[a-z]+\.[a-z0-9]+$/)) {
                     if (!has_t) {
                         urlstart += "/";
                     }

                     urlstart += splitted[i];
                 }
            }
            return urlstart;
        }

        if (domain.match(/^(?:.*\.)?instagram\.com$/)) {
            return {
                url: src,
                headers: {
                    "Referer": "https://www.instagram.com"
                }
            };
        }

        if (domain === "pbs.twimg.com" &&
            src.indexOf("pbs.twimg.com/media/") >= 0) {
            // use ?name=orig instead of :orig, see:
            //   https://github.com/qsniyg/maxurl/issues/2

            // https://pbs.twimg.com/media/DWREhilXkAAcafr?format=jpg&name=small
            //   https://pbs.twimg.com/media/DWREhilXkAAcafr.jpg:orig
            //   https://pbs.twimg.com/media/DWREhilXkAAcafr?format=jpg&name=orig
            //   https://pbs.twimg.com/media/DWREhilXkAAcafr.jpg?name=orig
            // https://pbs.twimg.com/media/DWO61F5X4AISSsF?format=jpg
            //   https://pbs.twimg.com/media/DWO61F5X4AISSsF.jpg:orig
            //   https://pbs.twimg.com/media/DWO61F5X4AISSsF?format=jpg&name=orig
            // https://pbs.twimg.com/media/Dbxmq4BV4AA2ozg.jpg:orig
            //   https://pbs.twimg.com/media/Dbxmq4BV4AA2ozg.jpg?name=orig
            // https://pbs.twimg.com/media/DdxPc2eU0AAED8b.jpg:thumb
            //   https://pbs.twimg.com/media/DdxPc2eU0AAED8b.jpg?name=orig
            return src
                .replace(/(\/[^?&]*)([^/]*)[?&]format=([^&]*)/, "$1.$3$2")
                .replace(/(\/[^?&]*)[?&][^/]*$/, "$1")
                .replace(/(:[^/]*)?$/, ":orig")
                //.replace(/\.([^/.:]*)(?::[^/.]*)$/, "?format=$1&name=orig")
                .replace(/\.([^/.:]*)(?::[^/.]*)$/, ".$1?name=orig");
        }

        if (domain === "pbs.twimg.com" &&
            src.indexOf("pbs.twimg.com/profile_images/") >= 0) {
            // https://pbs.twimg.com/profile_images/539057632435122178/1_MUcoAZ_bigger.jpeg
            //return src.replace(/_[a-zA-Z0-9]+\.([^/_]*)$/, "\.$1");
            return src
                .replace(/_bigger\.([^/_]*)$/, "\.$1")
                .replace(/_normal\.([^/_]*)$/, "\.$1")
                .replace(/_[0-9]+x[0-9]+\.([^/_]*)$/, "\.$1");
        }

        if (domain === "pbs.twimg.com" &&
            src.indexOf("pbs.twimg.com/card_img/") >= 0) {
            // https://pbs.twimg.com/card_img/958636711470223361/S0DycGGB?format=jpg&name=600x314
            //   https://pbs.twimg.com/card_img/958636711470223361/S0DycGGB?format=jpg&name=orig
            return src.replace(/(\?[^/]*&?name=)[^&/]*([^/]*)$/, "$1orig$2");
        }

        if (src.indexOf("pbs.twimg.com/profile_banners/") >= 0) {
            // https://pbs.twimg.com/profile_banners/811769379020947458/1503413326/1500x500 -- stretched
            //   https://pbs.twimg.com/profile_banners/811769379020947458/1503413326
            return src.replace(/\/[0-9]+x[0-9]+$/, "");
        }

        // disabling because too many urls are broken
        /*if (domain.indexOf("ytimg.googleusercontent.com") >= 0 ||
            domain.indexOf("i.ytimg.com") >= 0 ||
            domain.indexOf("img.youtube.com") >= 0) {
            // doesn't work for some urls:
            // https://i.ytimg.com/vi/o-gVbQHG0Ck/hqdefault.jpg
            return src.replace(/\/[^/]*$/, "/maxresdefault.jpg");
        }*/

        if (domain.indexOf("image.bugsm.co.kr") >= 0) {
            // blank image: (?version= doesn't impact)
            // https://image.bugsm.co.kr/artist/images/200/200498/20049877.jpg?version=20180108002103
            //   https://image.bugsm.co.kr/artist/images/0/200498/20049877.jpg
            //   https://image.bugsm.co.kr/artist/images/original/200498/20049877.jpg -- same
            //
            // non-blank image:
            // https://image.bugsm.co.kr/album/images/170/201403/20140343.jpg
            //   https://image.bugsm.co.kr/album/images/0/201403/20140343.jpg
            //
            // http://image.bugsm.co.kr/artist/images/original/801326/80132659.jpg
            return src.replace(/\/images\/[0-9]*\//, "/images/original/").replace(/\?.*$/, "");
        }

        if (domain.match(/i[0-9]\.wp\.com/)) {
            // https://i1.wp.com/img-aws.ehowcdn.com/default/cme/cme_public_images/www_ehow_com/photos.demandstudios.com/getty/article/240/3/178773543_XS.jpg?resize=400%2C267
            // http://i0.wp.com/mmsns.qpic.cn/mmsns/7KE858KbWtJWJFCnub4OrBAHial0SicILILia7G2I1h6VwXG5cWSWpnPQ/0 -- redirect error, but works
            return src.replace(/.*\/i[0-9]\.wp\.com\/(.*?)(?:\?.*)?$/, "http://$1");
        }

        if (domain.indexOf("imagesmtv-a.akamaihd.net") >= 0) {
            return src.replace(/.*\/uri\/([a-z:]*:)?/, "http://");
        }

        if (domain.indexOf("img.voi.pmdstatic.net") >= 0 ||
            domain.indexOf("voi.img.pmdstatic.net") >= 0) {
            var base = src.replace(/.*\/fit\/([^/]*)\/.*/, "$1");
            base = base.replace(/\./g, "%");
            base = decodeURIComponent(base);
            return base;
        }

        if (domain.indexOf("dynaimage.cdn.cnn.com") >= 0) {
            // https://dynaimage.cdn.cnn.com/cnn/q_auto,w_672,c_fill/http%3A%2F%2Fcdn.cnn.com%2Fcnnnext%2Fdam%2Fassets%2F170428012205-28-met-gala-kurkova.jpg
            //   http://cdn.cnn.com/cnnnext/dam/assets/170428012205-28-met-gala-kurkova.jpg
            return decodeURIComponent(src.replace(/.*\/cnn\/[^/]*\//, ""));
        }

        // http://wcmimages.ottawasun.com/images?url=http://storage.ottawasun.com/v1/dynamic_resize/sws_path/suns-prod-images/1297804218043_ORIGINAL.jpg%3Fsize=520x&w=840&h=630
        //   http://storage.ottawasun.com/v1/dynamic_resize/sws_path/suns-prod-images/1297804218043_ORIGINAL.jpg?size=520x -- broken, but 520x520 works
        if (domain === "wcmimages.ottawasun.com" ||
            // http://wcmimages.torontosun.com/images?url=http://postmediatorontosun.files.wordpress.com/2017/12/ts20171211vh16159.jpg&w=840&h=630
            //   https://postmediatorontosun.files.wordpress.com/2017/12/ts20171211vh16159.jpg
            domain === "wcmimages.torontosun.com" ||
            // http://wcmimages.winnipegsun.com/images?url=http://storage.winnipegsun.com/v1/dynamic_resize/sws_path/suns-prod-images/1297974096773_ORIGINAL.jpg%3Fsize=520x&w=840&h=630
            //   http://storage.winnipegsun.com/v1/suns-prod-images/1297974096773_ORIGINAL.jpg
            domain === "wcmimages.winnipegsun.com" ||
            // http://wcmimages.edmontonjournal.com/images?url=https://postmediaedmontonjournal2.files.wordpress.com/2017/10/1014-you-black-hole8057-jpg.jpg&w=107&h=80
            //   https://postmediaedmontonjournal2.files.wordpress.com/2017/10/1014-you-black-hole8057-jpg.jpg
            domain === "wcmimages.edmontonjournal.com" ||
            src.match(/^[a-z]+:\/\/wcmimages\.[^/]*\/images\?url=http/)) {
            //return decodeURIComponent(src.replace(/.*\/images\?[^/]*url=/, ""));
            //return src.replace(/.*\/images\?url=([^&]*).*/, "$1");
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/images.*?[?&]url=([^&]*).*/, "$1"));
        }

        // moved to thumbor section
        if (domain.indexOf("i.amz.mshcdn.com") >= 0 && false) {
            // https://i.amz.mshcdn.com/S4Fr7rEpLL-QZnU3bsNT5ORJzYQ=/364x130/https%3A%2F%2Fblueprint-api-production.s3.amazonaws.com%2Fuploads%2Fstory%2Fthumbnail%2F73835%2Fd72a8d3f-baf0-4132-b6f9-358d27d1c0c9.JPG
            //   https://blueprint-api-production.s3.amazonaws.com/uploads/story/thumbnail/73835/d72a8d3f-baf0-4132-b6f9-358d27d1c0c9.JPG
            // https://i.amz.mshcdn.com/vWTWthC534bzcGDk15NwrBy-dd4=/fit-in/1200x9600/https%3A%2F%2Fblueprint-api-production.s3.amazonaws.com%2Fuploads%2Fcard%2Fimage%2F54484%2FGettyImages-520238014.jpg
            // doesn't work:
            // https://i.amz.mshcdn.com/gXMzg2Z3xmXPa7EhIYOuwMmUu6M=/950x534/filters:quality(90)/2014%2F11%2F02%2F05%2Frihanna.40a2d.jpg
            //return decodeURIComponent(src.replace(/.*i\.amz\.mshcdn\.com\/[^/]*\/[^/]*\/[^/]*\/([^/]*).*/, "$1"));
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/[^/]*=\/[0-9]+x[0-9]+\/(?:filters:[^/]*\/)?(https?(?:%3A|:\/\/))/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain.indexOf("s.yimg.com") >= 0 ||
            domain === "l.yimg.com") {
            // http://l.yimg.com/bt/api/res/1.2/YIgTLkK5SkGYHzqDt4_e8Q--/YXBwaWQ9eW5ld3M7cT04NQ--/http:/mit.zenfs.com/316/2011/11/T-ZUCKERBERG_AP.jpg
            //   http://mit.zenfs.com/316/2011/11/T-ZUCKERBERG_AP.jpg
            // https://s.yimg.com/uu/api/res/1.2/dO0cMruL5vXOYMSnK577KQ--~B/aD03OTg7dz0xMzMwO3NtPTE7YXBwaWQ9eXRhY2h5b24-/https://s.yimg.com/cd/resizer/2.0/FIT_TO_WIDTH-w1330/a8b0bce04276cee4a1a80ea615a18c6e087e3b28.jpg
            //   https://s.yimg.com/cd/resizer/2.0/FIT_TO_WIDTH-w1330/a8b0bce04276cee4a1a80ea615a18c6e087e3b28.jpg
            // https://s.yimg.com/ny/api/res/1.2/guu198chJ6n8wlBLHhuLtg--/YXBwaWQ9aGlnaGxhbmRlcjtzbT0xO3c9NDUwO2g9MzAwO2lsPXBsYW5l/http://media.zenfs.com/en_us/News/Reuters/2017-03-17T012117Z_1_LYNXMPED2G03G_RTROPTP_2_PEOPLE-EMMAWATSON.JPG.cf.jpg
            //   http://media.zenfs.com/en_us/News/Reuters/2017-03-17T012117Z_1_LYNXMPED2G03G_RTROPTP_2_PEOPLE-EMMAWATSON.JPG
            return src
                .replace(/.*\/[^/]*\/api\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/(.*?)(?:\.cf\.jpg)?$/, "$1")
                .replace(/^([a-z]*:\/)([^/])/, "$1/$2");
        }

        if (domain.indexOf("image.iol.co.za") >= 0) {
            return decodeURIComponent(src.replace(/.*\/process\/.*\?.*source=([^&]*).*/, "$1"));
        }

        if (domain.indexOf("imageresizer.static9.net.au") >= 0) {
            //return decodeURIComponent(src.replace(/.*imageresizer\.static9\.net\.au\/[^=/]*=\/[0-9]+x[0-9]+\//, ""));
            return decodeURIComponent(src.replace(/.*imageresizer\.static9\.net\.au\/.*?\/([^/.?&]*%3A%2F%2F)/, "$1"));
        }

        if (domain.match(/^static[0-9]*\.squarespace\.com/)) {
            src = src.replace(/(\?[^/]*)?$/, "?format=original");
        }

        // /wp/uploads:
        // http://ksassets.timeincuk.net/wp/uploads/sites/46/2017/02/oscars.jpg
        if (domain.indexOf(".files.wordpress.com") >= 0 ||
            //domain.indexOf("typeset-beta.imgix.net") >= 0 ||
            // https://nylon-img.imgix.net/featured_images/attachments/000/008/458/original/Emma_Watson_Gravity_Premieres_NYC_Part_4_uWbHv1Bg6Owx.jpg?auto=format&ch=Width%2CDPR&q=75&w=640&ixlib=js-1.1.1&s=1587e8684f7fef1feac6d703480a760b
            (domain.indexOf(".imgix.net") >= 0 && !src.match(/[?&]s=[^/]*$/)) ||
            domain.indexOf("hmg-prod.s3.amazonaws.com") >= 0 ||
            domain.indexOf("blogs-images.forbes.com") >= 0 ||
            domain.indexOf("images-production.global.ssl.fastly.net") >= 0 ||
            domain.indexOf("typeset-beta.imgix.net") >= 0 ||
            domain.indexOf("imgix.elitedaily.com") >= 0 ||
            // https://imgix.bustle.com/uploads/getty/2018/3/14/a38ca3e6-056e-4aef-9c2b-1b00a134d7be-getty-917851058.jpg?w=970&h=582&fit=crop&crop=faces&auto=format&q=70
            domain === "imgix.bustle.com" ||
            //domain.indexOf("cosmouk.cdnds.net") >= 0 ||
            // http://esquireuk.cdnds.net/15/37/2048x2730/2048x2730-felicity-jones-oscars-43-jpg-fe5ebdf1.jpg?resize=768:*
            domain.indexOf(".cdnds.net") >= 0 ||
            /*domain.indexOf("hbz.h-cdn.co") >= 0 ||
            domain.indexOf("cos.h-cdn.co") >= 0 ||*/
            domain.indexOf(".h-cdn.co") >= 0 ||
            domain.indexOf("cdn.newsapi.com.au") >= 0 ||
            domain.indexOf("images.indianexpress.com") >= 0 ||
            domain.indexOf("images.contentful.com") >= 0 ||
            domain.indexOf("imagesmtv-a.akamaihd.net") >= 0 ||
            domain.indexOf("d.ibtimes.co.uk") >= 0 ||
            // http://akns-images.eonline.com/eol_images/Entire_Site/2014519/rs_300x300-140619060824-600.Harry-Potter-Cast-JR-61914.jpg
            // http://akns-images.eonline.com/eol_images/Entire_Site/2014519/rs_1024x759-140619060822-1024.Harry-Potter-Cast-JR-61914.jpg
            domain.indexOf("akns-images.eonline.com") >= 0 ||
            /*domain.indexOf("www.telegraph.co.uk") >= 0 ||
            // http://subscriber.telegraph.co.uk/content/dam/news/2018/01/08/GettyImages-862428716_trans_NvBQzQNjv4BqZgEkZX3M936N5BQK4Va8RWtT0gK_6EfZT336f62EI5U.jpg?imwidth=480
            domain === "subscriber.telegraph.co.uk" ||
            // https://secure.aws.telegraph.co.uk/content/dam/wellbeing/2016/12/28/graham5_trans_NvBQzQNjv4BqNyaloxhBNUSEitvcqmzeaNrVK9LoR4c_wZH1EhIay9c.jpg?imwidth=480
            domain.indexOf("aws.telegraph.co.uk") >= 0 ||*/
            // https://airbus-h.assetsadobe2.com/is/image/content/dam/products-and-solutions/commercial-aircraft/beluga/belugaxl/BelugaXL.jpg?wid=1920&fit=fit,1&qlt=85,0
            //   https://airbus-h.assetsadobe2.com/is/image/content/dam/products-and-solutions/commercial-aircraft/beluga/belugaxl/BelugaXL.jpg -- much smaller (300x203)
            (domain.indexOf(".telegraph.co.uk") >= 0 && src.indexOf("/content/dam/") >= 0) ||
            domain.indexOf("img.buzzfeed.com") >= 0 ||
            // p1.music.126.net
            // doesn't work with google's referrer
            domain.search(/p[0-9]\.music\.126\.net/) >= 0 ||
            domain.indexOf("stat.profile.ameba.jp") >= 0 ||
            domain.indexOf("stat.ameba.jp") >= 0 ||
            domain.indexOf("image.uczzd.cn") >= 0 ||
            domain.indexOf("img.danawa.com") >= 0 ||
            domain.indexOf("img-www.tf-cdn.com") >= 0 ||
            // https://6.viki.io/image/85db05c96d2c4a4ba4d6d2fa9798281c.jpeg?x=b&a=0x0&s=460x268&e=t&f=t&cb=1
            domain.indexOf(".viki.io") >= 0 ||
            domain.search(/avatars[0-9]*\.githubusercontent\.com/) >= 0 ||
            // https://bloximages.newyork1.vip.townnews.com/heraldmailmedia.com/content/tncms/assets/v3/editorial/1/9a/19a45cfe-354a-11e3-939d-001a4bcf6878/5800f2836b369.image.jpg?resize=1200%2C675
            domain.match(/bloximages\..*vip\.townnews\.com/) ||
            //domain === "bloximages.newyork1.vip.townnews.com" ||
            domain === "asset.wsj.net" ||
            domain === "steamuserimages-a.akamaihd.net" ||
            // haven't tested, but it's imgix
            /*domain === "image.assets.pressassociation.io" ||
            // https://content.assets.pressassociation.io/2018/02/06210749/1324f25e-1b19-4315-9420-e8e027475cf2.jpg?rect=0,183,2355,1325&ext=.jpg
            domain === "content.assets.pressassociation.io" ||*/
            domain.indexOf(".assets.pressassociation.io") >= 0 ||
            // http://media.immediate.co.uk/volatile/sites/3/2012/05/13874.jpg?quality=90&lb=620,413&background=white
            domain === "media.immediate.co.uk" ||
            // https://cdn.heatworld.com/one/lifestyle-images/celebrity/58357d749f0e322331739515/Screen%20Shot%202016-10-06%20at%2014.43.52.png?quality=50&width=960&ratio=16-9&resizeStyle=aspectfill&format=jpg
            domain === "cdn.heatworld.com" ||
            // https://www.thetimes.co.uk/imageserver/image/methode%2Fsundaytimes%2Fprodmigration%2Fweb%2Fbin%2F1ed9d88f-d652-4563-8d8b-fcbad22a1d0a.jpg?crop=1024%2C683%2C0%2C0&resize=685
            (domain === "www.thetimes.co.uk" && src.indexOf("/imageserver/") >= 0) ||
            // http://static.ok.co.uk/media/images/625x417_ct/737562_nick_hewer_9ab914ab8a82c5effdb695a41741ab84.jpg?w=900
            domain === "static.ok.co.uk" ||
            // https://media.gettyimages.com/photos/nick-hewer-arriving-for-the-2012-arqiva-british-academy-television-picture-id848052898?k=6&m=848052898&s=612x612&w=0&h=4QnBTCuNyp6nYhAumGR6k9gqH3iYagsnqkDo0ouGnts=
            domain === "media.gettyimages.com" ||
            // https://media.planetradio.co.uk/one/radio-legacy/52/fd06b/a5054/18c3c/83efe/bd389/d74d2/nickhewer.png?quality=80&width=960&ratio=16-9&resizeStyle=aspectfill&format=jpg
            domain === "media.planetradio.co.uk" ||
            // https://media.npr.org/assets/artslife/arts/2010/10/keith-richards/keith-richards_wide-68d0d5994c72c50de849d27e7c75519f2c832fc8.jpg?s=1400
            domain === "media.npr.org" ||
            // http://assets.teamrock.com/image/1cfd675c-33c9-4081-a27f-3f41abc88b69?w=800
            domain === "assets.teamrock.com" ||
            // https://media2.woopic.com/api/v1/images/156%2FS6N4g%2Fles-revoltes-rencontre-avec-simon-leclere-et-solene-rigot%7Cx240-WfM.jpg?format=300x175&facedetect=1&quality=85
            domain.match(/media[0-9]\.woopic\.com/) ||
            // http://md1.libe.com/photo/357188-de-gauche-a-droite-louise-grinberg-yara-pilartz-roxane-duran-solene-rigot-et-juliette-darche.jpg?modified_at=1322675617&width=975
            domain.match(/md[0-9]\.libe\.com/) ||
            // https://cdn.graziadaily.co.uk/one/lifestyle-images/celebrity/58bbdf7709f46d350a06910e/GettyImages-647330302.jpg?quality=50&width=960&ratio=16-9&resizeStyle=aspectfill&format=jpg
            domain === "cdn.graziadaily.co.uk" ||
            // https://regmedia.co.uk/2016/08/03/newsboy.jpg?x=442&y=293&crop=1
            domain === "regmedia.co.uk" ||
            // https://imageservice.nordjyske.dk/images/nordjyske.story/2012_05_12/961b43d2-64b8-47df-8c37-1c0e73565fb0.jpg?w=624&mode=crop&scale=both
            domain === "imageservice.nordjyske.dk" ||
            domain === "wac.450f.edgecastcdn.net" ||
            // http://www.gosoutheast.com/images/2015/9/29/Tony_Anderson-150917-JR.jpg?width=300
            (domain === "www.gosoutheast.com" && src.indexOf("/images/") >= 0) ||
            // http://itpro.nikkeibp.co.jp/atcl/column/17/010900605/011000014/ph01.jpg?__scale=w:450,h:501&_sh=0e0c309803
            //(domain === "itpro.nikkeibp.co.jp" && src.toLowerCase().match(/\.(?:jpg|png)$/)) ||
            // http://trendy.nikkeibp.co.jp/atcl/column/17/011800066/020900003/01.jpg?__scale=w:400,h:267&_sh=08d0b10ff0
            // http://wol.nikkeibp.co.jp/atcl/column/15/011500044/021300142/icon_m.jpg?__scale=w:214,h:147&_sh=0820dc0240
            (domain.indexOf(".nikkeibp.co.jp") >= 0 && src.toLowerCase().match(/\.(?:jpg|png)/)) ||
            // http://s-a4.best.gg/rosters/players/default2.png?image=c_fill,g_south,h_90,w_90
            domain.match(/s-a[0-9]*\.best\.gg/) ||
            // https://i5.walmartimages.com/asr/5375d30c-11a2-4725-a32d-cb59da53b5a5_1.20c1f4d2ccae8f4840ae88be99babb3e.jpeg?odnHeight=450&odnWidth=450&odnBg=FFFFFF
            domain.match(/i[0-9]*\.walmartimages\.com/) ||
            // https://nails.newsela.com/s3/newsela-media/article_media/2017/10/elem-hogwarts-express-rescue-fa623e3b.jpg?crop=0,139,1366,907&height=497&width=885
            domain === "nails.newsela.com" ||
            // http://ojsfile.ohmynews.com/CT_T_IMG/2018/0201/IE002279450_APP.jpg?2034
            domain === "ojsfile.ohmynews.com" ||
            // https://lumiere-a.akamaihd.net/v1/images/image_4cca1969.jpeg?region=0,0,512,288
            domain === "lumiere-a.akamaihd.net" ||
            // http://www.xxlmag.com/files/2018/02/Iggy-Azalea-interview.jpeg?w=980&q=75
            // http://xxlmag.com/files/2018/02/Iggy-Azalea-interview.jpeg?w=980&q=75
            domain_nowww === "xxlmag.com" ||
            // https://static01.nyt.com/images/2018/02/03/arts/03playlist/merlin_123145877_5ed2acde-72d5-4afb-a19a-93dbc29b5d2f-superJumbo.jpg?quality=100&auto=webp
            domain.match(/static[0-9]*\.nyt\.com/) ||
            // https://video-images.vice.com/articles/592ed99499168942accbdf39/lede/1496243427040-BadGyal_JavierRuiz_2.jpeg?crop=1xw:0.4212xh;0xw,0.3534xh&resize=1200:*
            // https://i-d-images.vice.com/images/2016/07/29/club-marab-cierra-su-temporada-con-bad-gyal-la-princesa-del-trap-cataln-body-image-1469779091.jpg?crop=1xw:0.5625xh;center,center&resize=0:*
            domain.indexOf("-images.vice.com") >= 0 ||
            // https://i.imgur.com/ajsLfCa_d.jpg?maxwidth=520&shape=thumb&fidelity=high
            domain === "i.imgur.com" ||
            // https://media.discordapp.net/attachments/170399623859404800/411963827412795394/CdynalsW4AQYsgy.png?width=223&height=300
            domain === "media.discordapp.net" ||
            // https://images.theconversation.com/files/159874/original/image-20170308-14932-n1fsc6.jpg?ixlib=rb-1.1.0&q=45&auto=format&w=1000&fit=clip
            domain === "images.theconversation.com" ||
            // https://www.rspb.org.uk/globalassets/images/birds-and-wildlife/non-bird-species-illustrations/grey-squirrel_1200x675.jpg?preset=landscape_mobile
            (domain === "www.rspb.org.uk" && src.indexOf("/globalassets/") >= 0) ||
            // http://media.beliefnet.com/~/media/photos/inspiration/galleries/20-most-beautiful-places-in-the-world/tunnel_of_love_ukraine.jpg?as=1&w=400
            domain === "media.beliefnet.com" ||
            // http://img.cdn2.vietnamnet.vn/Images/english/2017/11/10/09/20171110093351-sez.jpg?w=80&h=45
            domain.match(/img\.cdn[0-9]*\.vietnamnet\.vn/) ||
            // https://i.gadgets360cdn.com/large/tara_main_1511903994721.jpg?output-quality=70&output-format=webp
            domain === "i.gadgets360cdn.com" ||
            // https://i.ndtvimg.com/video/images/vod/medium/2018-02/big_478201_1517848813.jpg?downsize=298:224&output-quality=70&output-format=webp
            domain === "i.ndtvimg.com" ||
            // https://d3lp4xedbqa8a5.cloudfront.net/s3/digital-cougar-assets/Now/2018/02/16/44694/Healthy-pizza.jpg?width=132&height=107&mode=crop&scale=both&anchor=middlecenter&quality=85
            domain === "d3lp4xedbqa8a5.cloudfront.net" ||
            // https://brnow.org/getattachment/cc67f65b-b0b7-4365-abd5-258e4e1c1680?maxsidesize=50
            (domain === "brnow.org" && src.indexOf("/getattachment/") >= 0) ||
            // https://p3.ssl.cdn.btime.com/t01b3d8cb1040fbe0ba.jpg?size=730x1110
            domain.match(/p[0-9]*\.(?:ssl\.)?cdn\.btime\.com/) ||
            // http://images.twistmagazine.com/uploads/images/file/21604/sabrina-carpenter-selfie.jpg?fit=crop&h=666&w=500
            domain === "images.twistmagazine.com" ||
            // https://sites.google.com/site/faustrolemodel/_/rsrc/1427391714266/sabrina-carpenter/452204682.jpg?height=400&width=331
            domain === "sites.google.com" ||
            // https://images.pexels.com/photos/68147/waterfall-thac-dray-nur-buon-me-thuot-daklak-68147.jpeg?h=350&auto=compress&cs=tinysrgb
            domain === "images.pexels.com" ||
            // https://images.unsplash.com/photo-1503320748329-9455bea97a68?ixlib=rb-0.3.5&ixid=eyJhcHBfaWQiOjEyMDd9&s=324bf91b29fb196d6aefb2f4806d04c0&auto=format&fit=crop&w=1000&q=60
            domain === "images.unsplash.com" ||
            // tshop will automatically be replaced to shop
            // https://tshop.r10s.jp/book/cabinet/3966/4907953093966.jpg?fitin=200:300&composite-to=*,*|200:300
            //   https://shop.r10s.jp/book/cabinet/3966/4907953093966.jpg
            domain === "tshop.r10s.jp" ||
            // https://rakuma.r10s.jp/d/strg/ctrl/25/af89f9418a6f8fc899e2e0a280d79acd0c274d16.79.1.25.2.jpg?fit=inside%7C300%3A300
            domain === "rakuma.r10s.jp" ||
            // https://image.thanhnien.vn/Uploaded/phinp/2018_02_19/thumnail-bi-mat-tuan-anh_cms_VOVN.jpg?width=178&height=100&crop=auto&scale=both
            domain === "image.thanhnien.vn" ||
            // http://static.netlife.vn//2017/11/07/14/43/sao-han-trong-1-tuan-tara-den-viet-nam-2-lan_1.jpg?maxwidth=480
            domain === "static.netlife.vn" ||
            // http://rs.phunuonline.com.vn/staticFile/Subject/2018/02/14/7391244/unnamed_182138203.png?w=51&h=32
            domain === "rs.phunuonline.com.vn" ||
            // https://images.nbcolympics.com/www.nbcolympics.com/field_image/22February2018/shuster_smile.jpg?impolicy=960x540_rectangle
            domain === "images.nbcolympics.com" ||
            // https://compote.slate.com/images/4e1e4179-fb17-436b-a890-1a4fdb417d45.jpeg?width=1180&offset=0x0&rect=1560x1040&height=842
            domain === "compote.slate.com" ||
            // https://media.gannett-cdn.com/29906170001/29906170001_5720100432001_5720093419001-vs.jpg?pubId=29906170001&quality=10
            //domain === "media.gannett-cdn.com" ||
            // https://www.gannett-cdn.com/media/2016/04/15/USATODAY/USATODAY/635963424849581175-GTY-463036250-70683098.JPG?width=299&height=168&fit=bounds
            domain.indexOf(".gannett-cdn.com") >= 0 ||
            // http://www.rdfm-radio.fr/medias/images/media.nrj.fr-2f436x327-2f2017-2f11-2fbiographie-de-mc-fioti-484.jpg?fx=c_180_180
            (domain === "www.rdfm-radio.fr" && src.indexOf("/medias/") >= 0) ||
            // http://image-api.nrj.fr/02_5a02579e3cb49.png?w=730&h=410
            domain === "image-api.nrj.fr" ||
            // http://api.hdwallpapers5k.com/resource/fileuploads/photos/albums/1400/5382c527-5081-4bf4-8b2b-25ea11356bf4.jpeg?quality=100&w=2560&h=2560&mode=crop
            domain === "api.hdwallpapers5k.com" ||
            // http://mtv.mtvnimages.com/uri/mgid:file:gsp:scenic:/international/mtvema/2017/images/nominees/Taylor_Swift_1940x720.jpg?quality=0.85&width=1024&height=450&crop=true
            domain === "mtv.mtvnimages.com" ||
            // http://images.en.koreaportal.com/data/images/full/14639/rita-ora.jpg?w=600
            domain.match(/images\.[^.]*\.koreaportal\.com/) ||
            // http://www.officialcharts.com/media/653733/taylor-swift-press-image-1100.jpg?width=796&mode=stretch
            (domain === "www.officialcharts.com" && src.indexOf("/media/") >= 0) ||
            // https://citywonders.com/media/11395/mt-vesuvius-crater.jpg?anchor=center&mode=crop&quality=65&width=1200&height=900
            (domain === "citywonders.com" && src.indexOf("/media/") >= 0) ||
            // http://pix10.agoda.net/hotelImages/519/519394/519394_14031416100018704350.jpg?s=1024x768
            domain.match(/pix[0-9]*\.agoda\.net/) ||
            // https://images.pottermore.com/bxd3o8b291gf/1FC5pSmkSg44SMew0osm4Y/afb1fbf505eaf4c6a398b80ca075e014/DracoMalfoy_WB_F6_DracoMalfoyOnBathroomFloorHarryStanding_Still_080615_Land.jpg?w=1330&q=85
            domain === "images.pottermore.com" ||
            // https://www.google.com/s2/u/0/photos/public/AIbEiAIAAABECKjC6cfB5MXfkQEiC3ZjYXJkX3Bob3RvKig5NThhYjU1NjkzZGJkOTBmY2ZhZDAyYjE4NThjZjlmMzZmY2ZiZGY3MAHuuVSn2yIIP3390PZse6G3donZOg?sz=50
            (domain === "www.google.com" && src.match(/\/photos\/public\/[^/]*$/)) ||
            // https://images.streamable.com/east/image/pqxns_first.jpg?height=100
            domain === "images.streamable.com" ||
            // https://cdn.amebaowndme.com/madrid-prd/madrid-web/images/sites/121508/7b13cca970a6eae1f46625638213900b_3a2cc2bd26844834e05b77f95b7500b7.jpg?width=724
            domain === "cdn.amebaowndme.com" ||
            // http://www.kaixian.tv/gd/d/file/201803/13/6b65c9bc4e0128a92a0e9fc0aa2d2d2d.jpg?imageView&thumbnail=100y75
            (domain === "www.kaixian.tv" && src.indexOf("/file/") >= 0) ||
            // http://pic-bucket.nosdn.127.net/photo/0001/2018-01-24/D8SM4CRK00AP0001NOS.jpg?imageView&amp;thumbnail=100y75
            // forbidden with referrer
            // http://imglf6.nosdn.127.net/img/NStLVUtLYlBtSm9PTWJqMmpEVXF5N2pSL1U1a2I5SjhTdG50QzNMRHljblFlV1VQeUtGVUJ3PT0.jpg?imageView&thumbnail=1680x0&quality=96&stripmeta=0&type=jpg
            (domain.indexOf("nosdn.127.net") >= 0 && src.indexOf("/photo/") >= 0) ||
            // https://sumo.cdn.tv2.no/imageapi/v2/img/58aff90284ae6c3cc0945755-1519386606657?width=1920&height=1080&location=list
            (domain === "sumo.cdn.tv2.no" && src.indexOf("/imageapi/") >= 0) ||
            // https://media.missguided.com/s/missguided/L4227488_set/1/brown-square-back-thong-swimsuit.jpg?$category-page__grid--1x$
            domain === "media.missguided.com" ||
            // https://photo.venus.com/im/V1092-COB_V2362-COB.0288.s.jpg?preset=product
            domain === "photo.venus.com" ||
            // https://cdn-images.prettylittlething.com/c/4/f/f/c4ffac27c350089f9cb5214a68bad59c7a943bb5_CLW1289_1.JPG?imwidth=60
            domain === "cdn-images.prettylittlething.com" ||
            // http://www.oxfordmail.co.uk/resources/images/4817793.jpg?display=1&htype=0&type=responsive-gallery
            (domain === "www.oxfordmail.co.uk" && src.indexOf("/resources/") >= 0) ||
            // http://popcrush.com/files/2014/07/EmmaWatson1.jpg?w=980&q=75
            (domain === "popcrush.com" && src.indexOf("/files/") >= 0) ||
            // http://screencrush.com/files/2013/03/50_shades_of_grey_emma_watson.jpg?w=980&q=75
            (domain === "screencrush.com" && src.indexOf("/files/") >= 0) ||
            // http://assets.cougar.nineentertainment.com.au/assets/Dolly/2014/03/20/52622/3.jpg?mode=max&quality=80&width=1024
            domain.match(/assets\.[^.]*\.nineentertainment\.com\.au/) ||
            // https://www.thenational.ae/image/policy:1.479136:1499670177/image/jpeg.jpg?f=16x9&w=1024&$p$f$w=2589da4
            (domain === "www.thenational.ae" && src.indexOf("/image/") >= 0) ||
            // https://s3.kh1.co/80e0569ad275cc700a5b9bee37447bd432a63ced.jpg?m=thumb&w=400&h=560
            domain.match(/s[0-9]*\.kh1\.co/) ||
            // https://uploads.disquscdn.com/images/9b96ed95917fe3b747f0b441246985a838e3e0b370607817a540b4a40119b9a6.gif?w=800&h=253
            domain === "uploads.disquscdn.com" ||
            // https://www.voidu.com/content/products/gallery/99832a851b23b8a91f296adac...-20180216101631.jpg?width=1140&height=450&mode=crop&scale=both
            // https://voidu.com/content/products/gallery/99832a851b23b8a91f296adac...-20180216101631.jpg?width=1140&height=450&mode=crop&scale=both
            (domain_nowww === "voidu.com" && src.indexOf("/gallery/") >= 0) ||
            // https://store.playstation.com/store/api/chihiro/00_09_000/container/US/en/99/UP4139-CUSA10160_00-SURVIVINGMARSFCE//image?_version=00_09_000&platform=chihiro&w=720&h=720&bg_color=000000&opacity=100
            (domain === "store.playstation.com" && src.indexOf("/image?") >= 0) ||
            // https://images.interactives.dk/cdn-connect/98f5b7864bfb4efba3e65b9d0c983122.jpg?auto=compress&ch=Width%2CDPR&ixjsv=2.2.4&w=750
            domain === "images.interactives.dk" ||
            // https://toyo-arhxo0vh6d1oh9i0c.stackpathdns.com/media/1200/xl-hero-tire-pr-ra1.jpg?quality=10
            // https://toyo-arhxo0vh6d1oh9i0c.stackpathdns.com/media/1908/xl-pxr8r-hero-740x740.jpg?anchor=center&mode=crop&quality=90&width=470&rnd=131206940370000000
            domain === "toyo-arhxo0vh6d1oh9i0c.stackpathdns.com" ||
            // http://www.zmonline.com/media/17805975/pussycat.jpg?mode=crop&width=620&height=349&quality=60&scale=both
            (domain === "www.zmonline.com" && src.indexOf("/media/") >= 0) ||
            // https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AAtV5nt.img?h=328&w=270&m=6&q=60&o=f&l=f&x=277&y=235
            domain === "img-s-msn-com.akamaized.net" ||
            // http://www.heraldscotland.com/resources/images/5792318.jpg?display=1&htype=0&type=responsive-gallery
            // http://heraldscotland.com/resources/images/5792318.jpg?display=1&htype=0&type=responsive-gallery
            (domain_nowww === "heraldscotland.com" && src.indexOf("/resources/images/") >= 0) ||
            // https://cdn.instructables.com/ORIG/FLU/3BAI/JF8IWE1M/FLU3BAIJF8IWE1M.jpg?width=400&crop=3:2
            domain === "cdn.instructables.com" ||
            // http://images.ctfassets.net/55tpbg0qcsp4/5zeVQCnhqowcwiIw4kM80S/f70edd51832e8640f72c375cb1d72b6b/nagative_farewell4.jpg?w=144&h=102
            domain === "images.ctfassets.net" ||
            // http://images.performgroup.com/di/library/sporting_news/a5/be/edmonton-oilers-getty-images-041102017-ftrjpg_jt08mu2eqgwn1xr30wgvpqdzv.jpg?t=1619857107&w=960&quality=70
            domain === "images.performgroup.com" ||
            // http://media.playmobil.com/i/playmobil/9022_product_detail?locale=en-US,en,*&$pdp_product_main_xl$
            domain === "media.playmobil.com" ||
            // https://img.crocdn.co.uk/images/products2/pl/00/00/00/38/pl0000003849.jpg?width=940&height=940
            domain === "img.crocdn.co.uk" ||
            // http://www.calgaryherald.com/life/cms/binary/6748001.jpg?size=sw620x65
            (domain === "www.calgaryherald.com" && src.indexOf("/cms/") >= 0) ||
            // https://m2.ikea.com/images/pokoj-dziecka-z-niebieskimi-scianami-i-monochromatyczna-posc-919afda5ac9e85ba681cd2e3e698e893.jpg?f=l
            (domain.indexOf(".ikea.com") >= 0 && src.indexOf("/images/") >= 0) ||
            // https://colorwallpaper.net/img/2018/01/pashion-with-a-fashion.jpg?w=544&h=967&fit=stretch
            (domain === "colorwallpaper.net" && src.indexOf("/img/") >= 0) ||
            // https://img.cache.vevo.com/thumb/cms/6adeb8f9fb65d67e94044181f4e102c6/281x159.jpg?resize=fit&remove_borders=true
            domain === "img.cache.vevo.com" ||
            // https://drop.ndtv.com/albums/uploadedpics/small/vivo_v9_youth_small_636598304295938786.jpg?downsize=120:90&output-quality=70&output-format=webp
            (domain === "drop.ndtv.com" && src.indexOf("/albums/") >= 0) ||
            // http://kr.images.christianitydaily.com/data/images/full/107742/97.jpg?w=304&h=152&l=50&t=40
            domain.indexOf("images.christianitydaily.com") >= 0 ||
            // https://blogimg.goo.ne.jp/cnv/v1/user_image/5d/9d/e2b49057338c93324e0f70dd6fc4be03.jpg?dw=110,dh=110,cw=110,ch=110,q=90,da=s,ds=s
            domain === "blogimg.goo.ne.jp" ||
            // https://cdn.clien.net/web/api/file/F01/6848785/5a32dafe05c22a.jpg?w=780&h=30000
            domain === "cdn.clien.net" ||
            // https://s1.imgs.cc/img/aaaaaRmUn.jpg?_w=500
            domain.match(/s[0-9]*\.imgs\.cc/) ||
            // https://ssl-stat.amebame.com/pub/content/8265872137/user/article/unknown/unknown/376668982082606877/6af49eccc7dd77e2b3bde8002f6be55c/uploaded.png?width=546
            // https://stat.amebame.com/pub/content/8265872137/user/article/unknown/unknown/376668982082606877/6af49eccc7dd77e2b3bde8002f6be55c/uploaded.png?width=546
            domain.indexOf("stat.amebame.com") >= 0 ||
            // http://images.christiantoday.co.kr/data/images/full/292467/image.png?w=600
            domain === "images.christiantoday.co.kr" ||
            // https://i.iheart.com/v3/re/new_assets/5a91863a79b810a683361620?ops=fit(770%2C385)
            domain === "i.iheart.com" ||
            // https://cdn-hit.scadigital.io/media/10650/justin-bieber-selena-gomez.jpg?preset=MainImage
            domain === "cdn-hit.scadigital.io" ||
            // https://displate.com/displates/2018-01-13/2301ff8c98beecd3d095944ba5ec5952_544fe5884a2b74dba13a63a9a50cb48c.jpg?w=280&h=392
            (domain === "displate.com" && src.indexOf("/displates/") >= 0) ||
            // https://cdn56.picsart.com/169599975000202.jpeg?r1024x1024
            domain.match(/cdn[0-9]*\.picsart\.com/) ||
            // https://cdn.ndtv.com/tech/gadgets/Electronic_Arts_Dragon_Age_Inquisition_Cover.jpg?output-quality=10
            domain === "cdn.ndtv.com" ||
            // https://assets-a1.kompasiana.com/images/avatar/13267750-10207923832071268-7573729854263131153-n-57aeadc0d89373090f9eb6eb.jpg?t=t&v=70&x=70
            domain.match(/assets(?:-[a-z][0-9])?\.kompasiana\.com/) ||
            // https://images.popbuzz.com/images/2126?crop=1_1&width=200&signature=CbNpTNT994BxnDA7v5idqFKtsOs=
            domain === "images.popbuzz.com" ||
            // https://i1.adis.ws/i/Marc_Jacobs/friends_dovecameron_beautyconfestival_spring17?w=800&qlt=70&img404=NOIMAGEMEDIUM
            domain.match(/i[0-9]*\.adis\.ws/) ||
            // http://images2.9c9media.com/image_asset/2017_6_18_79194164-a321-4264-a5e3-f641dad7e65b_png_1920x1080.jpg?size=400
            domain.match(/images2\.9c9media\.com/) ||
            // http://img1-azcdn.newser.com/image/1180030-0-20180515094436.jpeg?width=76&height=76&crop=yes
            domain.match(/img[0-9]*(?:-[a-z]+)?\.newser\.com/) ||
            // http://images.m-magazine.com/uploads/posts/image/62933/dove-cameron-descendants-doll.jpg?crop=top&fit=clip&h=500&w=698
            domain === "images.m-magazine.com" ||
            // https://www.zoom.co.uk/assets/images/0/0/2/4/4/mm00244615.jpg?width=208
            domain === "www.zoom.co.uk" ||
            // https://ctd-thechristianpost.netdna-ssl.com/en/full/21939/a-thief-in-the-night.jpg?w=400&h=608
            domain === "ctd-thechristianpost.netdna-ssl.com" ||
            // https://img.vidible.tv/prod/2017-06/19/59481cb6f3bdc95f62ebf5bf/59481cb56709846d28c25ea1_o_F_v0.jpg?w=1440&h=900 -- upscaled
            domain === "img.vidible.tv" ||
            // http://images.es.j-14.com/uploads/posts/image/67560/dove-cameron-new-music.jpg?crop=top&fit=clip&h=900&w=2000 -- upscaled
            domain.match(/images\.(?:[a-z]+\.)?j-14\.com/) ||
            // https://cdn.abcotvs.com/dip/images/3174795_030418aposcarsredcarpetronan.jpg?w=120&r=16:9
            domain === "cdn.abcotvs.com" ||
            // http://www.tasteofcountry.com/files/2018/04/ACM-RC-Pictures.jpg?w=980&q=75
            (domain_nowww === "tasteofcountry.com" && src.indexOf("/files/") >= 0) ||
            // http://img.cdn2.vietnamnet.vn/Images/english/2018/05/23/09/20180523095208-3.jpg?w=80&h=45
            domain.match(/img\.cdn[0-9]*\.vietnamnet\.vn/) ||
            // https://images.thewest.com.au/publication/B88845233Z/1527064708921_GEP1KTC2C.2-2.jpg?imwidth=640&impolicy=.auto
            domain === "images.thewest.com.au" ||
            // https://cdn1.ntv.com.tr/gorsel/sanat/izlemeniz-gereken-100-anime/izlemeniz-gereken-100-anime,cZEsQuQhvUqIlKd_mSoGvw.jpg?w=960&mode=max&v=20100504143043000
            domain.match(/cdn[0-9]*\.ntv\.com\.tr/) ||
            // https://img6.hotnessrater.com/3892309/cailin-russo.jpg?w=200&h=300
            domain.match(/img[0-9]*\.hotnessrater\.com/) ||
            // http://www.starcrush.com/files/2012/11/AnnaSophia-Robb.jpg?w=980&q=75
            domain_nowww === "starcrush.com" ||
            // https://www.chrichri.dk/media/11430/11.jpeg?width=634&height=1004
            (domain === "www.chrichri.dk" && src.indexOf("/media/") >= 0) ||
            // https://www.rightstufanime.com/images/productImages/816546020668_anime-anohana-the-flower-we-saw-that-day-tv-series-box-set-blu-ray-primary.jpg?resizeid=4&resizeh=100&resizew=60
            (domain === "www.rightstufanime.com" && src.indexOf("/images/") >= 0) ||
            // https://assets.bigcartel.com/product_images/203868677/ANOHANA+SITE.jpg?auto=format&fit=max&w=1500
            domain === "assets.bigcartel.com" ||
            // http://www.thenorthernecho.co.uk/resources/images/7672541.jpg?display=1&htype=0&type=responsive-gallery
            (domain === "www.thenorthernecho.co.uk" && src.indexOf("/resources/images/") >= 0) ||
            // http://binaryapi.ap.org/2df5c8e3642d4183a08cf802c2dd50b1/preview/AP13344549840.jpg?wm=api&ver=0
            domain === "binaryapi.ap.org" ||
            // https://images.8tracks.com/cover/i/000/618/338/hive_mind_cover-4092.jpg?rect=0,0,500,500&q=98&fm=jpg&fit=max&w=320&h=320
            domain === "images.8tracks.com" ||
            // http://cdn2.spoilercat.com/ac/a/christopher-nolan-53c9cd8d5bbe5d40048c7003.jpeg?s=640x0
            domain.match(/cdn[0-9]*\.spoilercat\.com/) ||
            // https://www.mumbailive.com/images/news/Christopher_1514973032318.jpg?w=205
            (domain === "www.mumbailive.com" && src.indexOf("/images/") >= 0) ||
            // https://static.juksy.com/files/articles/68423/59704be703149.png?m=widen&i=600&q=75
            domain === "static.juksy.com" ||
            // http://img.reblog.hu/blogs/28942/christophere8d6.jpg?w=640
            domain === "img.reblog.hu" ||
            // http://www.thefw.com/files/2012/11/tumblr_ls6ujhB6wV1qfq9oxo1_5001.jpg?w=980&q=75 -- stretched
            (domain_nowww === "thefw.com" && src.indexOf("/files/") >= 0) ||
            // https://img.csfd.cz/files/images/creator/photos/160/654/160654750_730831.jpg?w100h132crop
            domain === "img.csfd.cz" ||
            // http://img.timesnownews.com/2_1518716279__rend_1_1.jpg?d=300x225
            domain === "img.timesnownews.com" ||
            // http://us.jimmychoo.com/dw/image/v2/AAWE_PRD/on/demandware.static/-/Sites-jch-master-product-catalog/default/dw70b1ebd2/images/rollover/LIZ100MPY_120004_MODEL.jpg?sw=245&sh=245&sm=fit
            // https://www.aritzia.com/on/demandware.static/-/Library-Sites-Aritzia_Shared/default/dw3a7fef87/seasonal/ss18/ss18-springsummercampaign/ss18-springsummercampaign-homepage/hptiles/tile-wilfred-lrg.jpg
            src.match(/\/demandware\.static\//) ||
            // https://cdn1.kongcdn.com/assets/avatars/defaults/robotboy.png?i10c=img.resize(width:40)
            src.match(/\?i10c=[^/]*$/) ||
            // http://hypebeast.com/wp-content/blogs.dir/4/files/2018/01/louis-vuitton-2018-fall-winter-50.jpg?q=75&w=400
            // doesn't work:
            // https://d2u7zfhzkfu65k.cloudfront.net/resize/wp-content/uploads/2018/5/8/15/f21a56c81474b277e24bca7575e94dc7.jpg?w=70&q=85
            src.indexOf("/wp-content/blogs.dir/") >= 0 ||
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/\?[^/]*$/, "");
        }

        // https://c1.hoopchina.com.cn/uploads/star/event/images/180215/bmiddle-5e8c9e13a07a397579c89590685b479db07ff6b8.png?x-oss-process=image/resize,w_800/format,webp
        if (domain.match(/[ci][0-9]*\.hoopchina\.com\.cn/) ||
            // https://cdn.odigo.net/60168923a5f06af67f74250c44de7861.png?imageView2/2/w/800/interlace/1%7Cimageslim
            domain === "cdn.odigo.net" ||
            // https://i.linkeddb.com/person2/bc2b/4ac6/d18db22f165a63046031cbb9.jpg?x-oss-process=image/resize,m_fill,w_170,h_230
            domain === "i.linkeddb.com" ||
            // http://wangsuimg.fanshuapp.com/14892066562143large17ef000388f3e91c711a?imageView2/2/w/375/q/80
            domain === "wangsuimg.fanshuapp.com" ||
            // https://img.aiji66.com/83/9d/f1/f4/64/afe732c7-9501-11e7-9040-11832666daf4.jpg?ufopmogr3/auto-orient/thumbnail/300x/crop/x792/interlace/1/quality/100/&e=1519833600&token=Uon2lwH6FDLYBhVyGu5jN25PwVCQuNAIf-_PaQ8E:2Du8aIDyVBLvGBAdS0vvI1eX53c=
            domain === "img.aiji66.com" ||
            // http://imgs.aixifan.com/content/2018_05_01/1525165813.jpg?imageView2/1/w/432/h/240
            domain === "imgs.aixifan.com" ||
            // http://upload-images.jianshu.io/upload_images/1685198-ebfc2a22664f623c?imageMogr2/auto-orient/strip%7CimageView2/2/w/300
            domain === "upload-images.jianshu.io") {
            src = src.replace(/\?.*$/, "");
        }

        if (domain === "www.dailyherald.com") {
            // http://www.dailyherald.com/storyimage/DA/20140418/news/140418160/AR/0/AR-140418160.jpg&updated=201404182313&MaxW=800&maxH=800&noborder
            src = src.replace(/[?&].*$/, "");
        }

        // check to make sure this doesn't break anything
        // test: https://s3.amazonaws.com/oscars-img-abc/wp-content/uploads/2017/02/26164054/950c51cde0a1cab411efdbf8f1abc117a6aad749397172c9b95dd3c47bfb6f6f-370x492.jpg
        if (domain.indexOf(".imimg.com") >= 0 ||
            //domain.indexOf(".files.wordpress.com") >= 0 || // doesn't work
            domain.indexOf("blogs-images.forbes.com") >= 0 ||
            domain.indexOf("static.gofugyourself.com") >= 0 ||
            domain.indexOf("static.thesuperficial.com") >= 0 ||
            // doesn't work:
            // http://static.celebuzz.com/uploads/2011/06/10/Emma-Roberts-Outside-Today-Show-in-NYC-e1435832610488-385x560.jpg
            // http://static.celebuzz.com/uploads/2011/06/10/Emma-Roberts-Outside-Today-Show-in-NYC.jpg
            // http://static.celebuzz.com/uploads/2011/06/10/Emma-Roberts-Outside-Today-Show-in-NYC-e1435832660684-310x560.jpg
            // http://static.celebuzz.com/uploads/2011/06/10/Emma-Roberts-Outside-Today-Show-in-NYC.JPG
            domain.indexOf("static.celebuzz.com") >= 0 ||
            domain.indexOf("img.vogue.co.kr") >= 0 ||
            domain.indexOf("static.spin.com") >= 0 ||
            domain.indexOf("zrockr.com") >= 0 ||
            // http://electricegg.co.uk/media/uploads/2017/08/nick-hewer-by-electric-egg-375x320.jpg
            domain.indexOf("electricegg.co.uk") >= 0 ||
            // http://www.media2.hw-static.com/media/2018/01/wenn_kerrywashington_012618-442x216.jpg
            domain.match(/www\.media[0-9]*\.hw-static\.com/) ||
            // http://i2.cdn.turner.com/money/dam/assets/160511121527-emma-watson-780x439.jpg
            domain.indexOf(".cdn.turner.com") >= 0 ||
            // http://k99.com/files/2013/01/JohnnyCarson_Facebook-630x477.jpg
            domain === "k99.com" ||
            // http://97rockonline.com/files/2012/07/Flag-Bikini-Venus-214x300.jpg
            domain === "97rockonline.com" ||
            // http://wfgr.com/files/2011/03/old-rich-woman-200x300.jpg
            domain === "wfgr.com" ||
            // http://wblk.com/files/2013/04/sirius-alien-630x355.jpg
            domain === "wblk.com" ||
            // http://fun107.com/files/2015/01/charlie-hunnam-and-chris-hemsworth-630x346.jpg
            domain === "fun107.com" ||
            // http://965kvki.com/files/2013/12/christmasgenius-630x472.jpg
            domain === "965viki.com" ||
            // http://1079ishot.com/files/2013/06/90713084-630x434.jpg
            domain === "1079ishot.com" ||
            // https://edge.alluremedia.com.au/m/l/2017/05/Surface-Laptop-410x231.png
            domain === "edge.alluremedia.com.au" ||
            // https://s3-us-west-1.amazonaws.com/blogs-prod-media/us/uploads/2016/06/02110848/Coco-Austin-breastfeeding-650x630.jpg
            (domain.indexOf(".amazonaws.com") >= 0 && src.match(/\/blogs-prod-media\/[^/]*\/uploads\//)) ||
            // https://d36tnp772eyphs.cloudfront.net/blogs/1/2014/08/8754021448_bf2a5c94a3_k-940x403.jpg
            domain === "d36tnp772eyphs.cloudfront.net" ||
            // http://img.allurekorea.com/allure/2016/10/style_581190dac6d83-835x1024.jpg
            domain === "img.allurekorea.com" ||
            // https://www.psu.com/app/uploads/2017/12/gang_beasts_review_01-1024x576.jpg
            // https://psu.com/app/uploads/2017/12/gang_beasts_review_01-1024x576.jpg
            domain_nowww === "psu.com" ||
            // http://media.popculture.com/2018/01/demi-lovato-fabletics-fitness-leggings-20022601-160x90.jpeg
            domain === "media.popculture.com" ||
            // http://www.rap-up.com/app/uploads/2018/02/rihanna-gpe-340x330.jpg
            // http://rap-up.com/app/uploads/2018/02/rihanna-gpe-340x330.jpg
            domain_nowww === "rap-up.com" ||
            // http://img.snacker.hankyung.com/hk-content/2017/08/terracotta-army-1865006__340-400x300.jpg
            domain.match(/img\..*?\.hankyung\.com/) ||
            // https://www.traveltipy.com/content/uploads/2015/10/Gorlitz-Germany-1024x692.jpg
            domain === "www.traveltipy.com" ||
            // http://coveteur.com/content/uploads/2017/03/Emma-Roberts-Hair-3-940x940.jpg
            domain === "coveteur.com" ||
            // http://food-ehow-com.blog.ehow.com/files/2014/12/edits-2282-1024x682.jpg
            domain.indexOf(".blog.ehow.com") >= 0 ||
            // https://cdn2.theheartysoul.com/uploads/2016/06/image1-798x418.jpg
            domain.match(/cdn[0-9]*\.theheartysoul\.com/) ||
            // http://www.bandt.com.au/information/uploads/2017/08/Screen-Shot-2017-08-01-at-10.58.17-am-420x280.png
            // http://bandt.com.au/information/uploads/2017/08/Screen-Shot-2017-08-01-at-10.58.17-am-420x280.png
            domain_nowww === "bandt.com.au" ||
            // https://www.theepochtimes.com/assets/uploads/2017/08/28/Agriculture-dependent-to-the-river-5-700x420.jpg
            domain === "www.theepochtimes.com" ||
            // https://images.gamme.com.tw/news2/2018/82/30/pJySpaabj56WsKQ-300x250.jpg
            domain === "images.gamme.com.tw" ||
            // http://images.gamme.com.cn/news2/2017/97/14/pZeao56Yj6aZqA-380x300.jpg
            domain === "images.gamme.com.cn" ||
            // http://cdn.hoahoctro.vn/uploads/2018/02/5a87a07c09b7e-pagehihi-600x450.jpg
            domain === "cdn.hoahoctro.vn" ||
            // https://vnn-imgs-f.vgcloud.vn/2018/02/22/09/fan-xon-xao-mat-son-tung-beo-u-sau-tet-nguyen-dan-140x78.jpg
            domain === "vnn-imgs-f.vgcloud.vn" ||
            // http://f.imgs.vietnamnet.vn/2017/11/05/09/t-ara-roi-nuoc-mat-vi-fan-viet-4-100x30.jpg
            domain.indexOf(".imgs.vietnamnet.vn") >= 0 ||
            // https://static.vibe.com/files/archives/galleries/2005/01/23/ciara2-160x160.jpg
            domain === "static.vibe.com" ||
            // https://rightsinfo.org/app/uploads/2018/02/nathan-dumlao-378988-unsplash-1024x671.jpg
            domain === "rightsinfo.org" ||
            // http://img.marieclairekorea.com/2018/03/mck_5a9de416ee7a4-570x381.jpg
            domain === "img.marieclairekorea.com" ||
            // http://tokyopopline.com/images/2013/01/130106kara6-515x341.jpg
            domain === "tokyopopline.com" ||
            // https://media.extratv.com/2017/01/09/sophie-turner-getty-510x600.jpg
            domain === "media.extratv.com" ||
            // http://px1img.getnews.jp/img/archives/2017/10/ba35fadf68725a24224b306250f20c2f-1024x761.jpg
            domain === "px1img.getnews.jp" ||
            // https://media.thetab.com/blogs.dir/279/files/2017/03/emma-1177x557.jpg
            domain === "media.thetab.com" ||
            // https://assets.rockpapershotgun.com/images//2018/02/survivingmars2-620x315.jpg
            domain === "assets.rockpapershotgun.com" ||
            // http://spotted.tv/app/uploads/20131210-2339481-750x355.jpg
            domain === "spotted.tv" ||
            // https://sloanreview.mit.edu/content/uploads/2018/04/GEN-Ross-Digital-Transformation-Speed-Long-Term-1200-300x300.jpg
            domain === "sloanreview.mit.edu" ||
            // http://business.inquirer.net/files/2017/09/pet6-1024x682.jpg
            domain === "business.inquirer.net" ||
            // http://static.thefrisky.com/uploads/2013/07/10/Victoria-Justice-Lucy-Hale-And-Nina-Dobrev-600x450.jpg
            //   http://static.thefrisky.com/uploads/2013/07/10/Victoria-Justice-Lucy-Hale-And-Nina-Dobrev.jpg
            domain === "static.thefrisky.com" ||
            // http://hobby.dengeki.com/ss/hobby/uploads/2017/12/P1014922-440x586.jpg
            domain === "hobby.dengeki.com" ||
            // https://cdn-blog.adafruit.com/uploads/2017/06/megumin-cosplay-360x480.jpg
            domain === "cdn-blog.adafruit.com" ||
            // http://img.uuhy.com/uploads/2010/10/sexy-cosplay-46-550x825.jpg
            // http://simg.uuhy.com/2017/06/businesscards7-220x150.jpg
            domain.match(/s?img\.uuhy\.com/) ||
            // http://img.butongshe.com/2017/12/DSXVVOWVAAEVjVa-520x245.jpg
            domain === "img.butongshe.com" ||
            // https://myreco.asia/img/uploads/article/SE9OJk4VWYhKq8JN1t7THTyVFzvdbA2qOy3XgEVS-2000x1000.jpeg
            domain === "myreco.asia" ||
            // https://d3p157427w54jq.cloudfront.net/uploads/2018/01/selena-site-637x397.jpg
            domain === "d3p157427w54jq.cloudfront.net" ||
            // http://cdn.harpersbazaar.com.sg/2017/10/DSC_2716-1200x799.jpg
            domain === "cdn.harpersbazaar.com.sg" ||
            // http://nsfw.myconfinedspace.com/files/2017/06/gomez__7__1-1000x1500.jpg
            domain.indexOf(".myconfinedspace.com") >= 0 ||
            // https://s3.amazonaws.com/hiphopdx-production/2017/08/Rihanna-826x620.jpg
            amazon_container === "hiphopdx-production" ||
            // https://assets.wonderlandmagazine.com/uploads/2014/11/Taylor-Swift-Wonderland-1-Crop-345x483.jpg
            domain === "assets.wonderlandmagazine.com" ||
            // https://am24.akamaized.net/tms/cnt/uploads/2017/04/taylor-swift-650x372.jpg
            domain === "am24.akamaized.net" ||
            // http://snappa.static.pressassociation.io/assets/2016/04/08154418/1460126656-210b91ce6f5398e743add7f71b3e9b72-600x986.jpg
            domain.indexOf("static.pressassociation.io") >= 0 ||
            // https://icdn2.digitaltrends.com/image/dragon-age-inquisition-multiplayer-header-720x720.jpg?ver=1.jpg
            domain.match(/icdn[0-9]*\.digitaltrends\.com/) ||
            // https://assets.vg247.com/current/2014/09/sep_23_-_keyart_inquisitormf_v3-156x108.jpg
            domain === "assets.vg247.com" ||
            // https://www.theblemish.com/images/2015/02/taylor-swift-stops-by-kelsey-edwards-studio-17-640x881.jpg
            (domain_nowww === "theblemish.com" && src.indexOf("/images/") >= 0) ||
            // https://www.dailyxtra.com/content/uploads/2017/06/billc36-479x270.jpg
            (domain === "www.dailyxtra.com" && src.indexOf("/content/uploads/") >= 0) ||
            // https://media.metrolatam.com/2018/05/12/neymarseponecamistapsg2018-09b3bddb47d54ac1e4d12b24697bc2e8-300x200.jpg
            domain === "media.metrolatam.com" ||
            // http://media.comicbook.com/2018/01/dove-cameron-ruby-agents-of-shield-1079103-1280x0.jpeg
            domain === "media.comicbook.com" ||
            // https://www.grazia.it/content/uploads/2018/01/Dove-Cameron-800x599.jpg
            domain === "www.grazia.it" ||
            // https://img.kpopmap.com/2018/05/loco-445x262.jpg
            domain === "img.kpopmap.com" ||
            // https://s.nbst.gr/files/1/2018/03/AP_18064008875527-353x221.jpg
            domain === "s.nbst.gr" ||
            // https://assets.metrolatam.com/gt/2015/01/14/488408753-200x300.jpg
            domain === "assets.metrolatam.com" ||
            // https://women.mthai.com/app/uploads/2014/01/rihanna2-100x140.jpg
            domain.indexOf(".mthai.com") >= 0 ||
            // https://cdn.webnoviny.sk/sites/13/2013/02/cerveny-koberec-55-hudobnych-cien-grammy1-640x897.jpeg
            domain === "cdn.webnoviny.sk" ||
            // https://bloggar.expressen.se/emmasmode/files/2013/02/2013-GRAMMY-AWARDS-ARRIVALS.JPEG-0AB3E3-835x1022.jpg
            domain === "bloggar.expressen.se" ||
            // http://img2.saostar.vn/2016/02/16/279989/taylor-swift-grammys-red-carpet-2016-646x1024.jpg
            domain.match(/img[0-9]*\.saostar\.vn/) ||
            // https://s3.gossipcop.com/up/2018/06/Selena-Gomez-Jennifer-Aniston-Justin-Theroux-533x395.jpg
            domain.match(/s[0-9]*\.gossipcop\.com/) ||
            // https://petapixel.com/assets/uploads/2017/01/RT40170-800x534.jpg
            domain === "petapixel.com" ||
            // https://d3i6fh83elv35t.cloudfront.net/newshour/app/uploads/2017/03/cat-tongue_AdobeStock_70141743-1024x719.jpeg
            domain === "d3i6fh83elv35t.cloudfront.net" ||
            // https://d17fnq9dkz9hgj.cloudfront.net/uploads/2018/03/Russian-Blue_01-390x203.jpg
            domain === "d17fnq9dkz9hgj.cloudfront.net" ||
            // https://pinknews.co.uk/images/2018/02/pexels-photo-596590-650x433.jpeg
            domain_nowww === "pinknews.co.uk" ||
            // https://images.everyeye.it/img-notizie/yakuza-6-emergono-40-minuti-gameplay-v6-272793-350x16.jpg
            domain === "images.everyeye.it" ||
            // https://koreaboo-cdn.storage.googleapis.com/2016/12/15123352_1467738783241379_1368418332014232741_o-650x867.jpg
            domain === "koreaboo-cdn.storage.googleapis.com" ||
            // https://www.behindzscene.net/file/2018/01/%D8%A7%D8%B3%D8%B7%D9%88%D8%B1%D8%A9-440x264.jpg
            (domain_nowww === "behindzscene.net" && src.indexOf("/file/") >= 0) ||
            // https://www.hipertextual.com/files/2014/12/christopher-nolan-670x410.jpg
            (domain_nowww === "hipertextual.com" && src.indexOf("/files/") >= 0) ||
            // https://geeksofdoom.com/GoD/img/2015/11/the-bastard-executioner-110-03-530x353.jpg
            (domain_nowww === "geeksofdoom.com" && src.indexOf("/img/") >= 0) ||
            // http://newsimages.fashionmodeldirectory.com/content/2018/06/july-cover2-392x400.jpg
            domain === "newsimages.fashionmodeldirectory.com" ||
            // https://cdn.gamerant.com/wp-content/uploads/resident-evil-2-director-remake-faith-738x410.jpg.webp
            //   https://cdn.gamerant.com/wp-content/uploads/resident-evil-2-director-remake-faith.jpg.webp
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            // http://arissa-x.com/miss-x-channel/wp-content/uploads/2017/06/IMG_0005.jpg
            src = src.replace(/-[0-9]*x[0-9]*\.([^/]*)$/, ".$1");
        }

        if ((domain === "store.pinseyun.com" && src.indexOf("/uploads/") >= 0)) {
            // http://store.pinseyun.com/uploads/2016/10/20161021222440-150x150.jpg
            // http://store.pinseyun.com/uploads/2016/06/201605work-94-150x150.jpg
            return {
                url: src.replace(/-[0-9]*x[0-9]*\.([^/.]*)$/, ".$1"),
                can_head: false
            };
        }

        // https://cdn.heatworld.com/one/lifestyle-legacy/fc/e7794/f8a77/be88e/964ad/02b2a/6e7bd/claude-littner_940x526.jpg
        //   https://cdn.heatworld.com/one/lifestyle-legacy/fc/e7794/f8a77/be88e/964ad/02b2a/6e7bd/claude-littner.jpg
        if (domain === "cdn.heatworld.com" ||
            // http://www.sohobluesgallery.com/mm5/graphics/00000001/Rolling_Stones_Keith_Richards_Guitar_God_475x705.jpg
            //   http://www.sohobluesgallery.com/mm5/graphics/00000001/Rolling_Stones_Keith_Richards_Guitar_God.jpg
            domain === "www.sohobluesgallery.com" ||
            // https://i.vimeocdn.com/video/530332183_780x439.jpg
            domain === "i.vimeocdn.com" ||
            // https://media.indiatimes.in/media/content/2018/Feb/arun_jaitley_allocates_rs_1200_crore_to_promote_bamboo_cultivation_1517487222_100x150.jpg
            domain === "media.indiatimes.in" ||
            // https://vcdn-ione.vnecdn.net/2018/02/04/topoppp-1681-1517742371_500x300.jpg
            domain === "vcdn-ione.vnecdn.net" ||
            // https://www.bangkokpost.com/media/content/20180126/c1_1401970_180126042828_620x413.jpg
            // https://bangkokpost.com/media/content/20180126/c1_1401970_180126042828_620x413.jpg
            domain_nowww === "bangkokpost.com" ||
            // https://media2.mensxp.com/media/content/2018/Feb/congress-takes-digs-at-bjp-and-pm-modi-with-a-valentines-day-video-1400x653-1518681640_401x187.jpg
            domain.match(/media[0-9]*\.mensxp\.com/) ||
            // http://221.132.38.109/nvdata/uploads/thumbnail/2017/12/01/baogiohetbatlucnhintremamnonbibaohanh_20171201151535_220x124.jpg
            domain === "221.132.38.109" ||
            // https://i-ngoisao.vnecdn.net/2012/11/26/10-585669-1376858787_500x0.jpg
            domain === "i-ngoisao.vnecdn.net" ||
            // http://www.jpcoast.com/img/201403/21_DSC_1247_600x400.jpg
            // http://jpcoast.com/img/201403/21_DSC_1247_600x400.jpg
            (domain_nowww === "jpcoast.com" && src.indexOf("/img/") >= 0) ||
            // https://pics.prcm.jp/908a8687073fe/66459731/jpeg/66459731_220x241.jpeg
            domain === "pics.prcm.jp" ||
            // http://s1.lprs1.fr/images/2017/08/17/7197618_sofia-solares-cover_940x500.PNG
            domain.match(/s[0-9]*\.lprs1\.fr/) ||
            // http://m.wsj.net/video/20170227/022717oscarsfashion/022717oscarsfashion_1280x720.jpg
            domain === "m.wsj.net" ||
            // http://img.lifestyler.co.kr/uploads/program/1/1728/menu/16/board/0/0/f131717137323426000(0)_226x146.jpg
            domain === "img.lifestyler.co.kr" ||
            // https://static-us-cdn.eporner.com/photos/537995_296x1000.jpg
            domain.match(/static-(?:[a-z]+-)?cdn\.eporner\.com/) ||
            // http://fototo.blox.pl/resource/rihanna_and_red_400x400.jpg
            domain === "fototo.blox.pl" ||
            // http://media.nvyouj.com/photos/2017/1007/20/DLiF1LFVoAAdtbR_240x240.jpg
            domain === "media.nvyouj.com" ||
            // http://cl.buscafs.com/www.tomatazos.com/public/uploads/images/184724_600x315.jpg
            (domain === "cl.buscafs.com" && src.indexOf("/www.tomatazos.com/") >= 0) ||
            // http://images.cinefil.com/movies/1053952_1600x450.jpg
            //   http://images.cinefil.com/movies/1053952.jpg
            domain === "images.cinefil.com") {
            newsrc = src.replace(/_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        // http://www.mediaonlinevn.com/wp-content/uploads/2016/03/160315-pantech-launch-hcm-41_resize-680x365_c.jpg
        // https://mediaonlinevn.com/wp-content/uploads/2016/03/160315-pantech-launch-hcm-41_resize-680x365_c.jpg
        if (domain_nowww === "mediaonlinevn.com") {
            src = src.replace(/-[0-9]*x[0-9]*(?:_[a-z])?\.([^/.]*)$/, ".$1");
        }

        // http://felipepitta.com/blog/wp-content/uploads/2014/08/Harry-Potter-Hogwarts-Express-Jacobite-Fort-William-Scotland-Train(pp_w970_h646).jpg
        // http://www.onelittlepicture.com.au/wp-content/uploads/2012/07/IMG_0077a-copy-682x1024(pp_w599_h900).jpg
        if (domain.indexOf(".files.wordpress.com") >= 0 ||
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/\(pp_w[0-9]+_h[0-9]+\)(\.[^/.]*)$/, "$1");
        }

        // https://static.boredpanda.com/blog/wp-content/uploads/2017/08/GW-130817_DSC1426-copy-599f17eddebf2__880.jpg
        if (domain.indexOf(".files.wordpress.com") >= 0 ||
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            // http://www.randomnude.com/wp-content/uploads/sites/39/2017/06/gomez__7__1.jpg
            src = src.replace(/__[0-9]{2,}(\.[^/.]*)$/, "$1");
        }

        // https://www.thetrace.org/wp-content/uploads/2017/04/Cleveland_Gun_Survivors_065-5394x0-c-default.jpg
        if (domain.indexOf(".files.wordpress.com") >= 0 ||
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/-[0-9]+x[0-9]+-c-default(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf("storage.journaldemontreal.com") >= 0 ||
            domain.indexOf("storage.torontosun.com") >= 0 ||
            // http://storage.ottawasun.com/v1/dynamic_resize/sws_path/suns-prod-images/1297804218043_ORIGINAL.jpg?size=520x
            domain === "storage.ottawasun.com" ||
            // http://storage.chathamthisweek.com/v1/dynamic_resize/sws_path/suns-prod-images/-143866_ORIGINAL.jpg?quality=80&size=650x&stmp=1336623589647
            //   http://storage.chathamthisweek.com/v1/suns-prod-images/-143866_ORIGINAL.jpg
            domain === "storage.chathamthisweek.com" ||
            // http://storage.journaldequebec.com/v1/dynamic_resize/sws_path/jdx-prod-images/e3b49bbd-ba13-4f0e-99e4-e0d0ee77bbfe_ORIGINAL.jpg?quality=80&size=700x&version=1
            domain === "storage.journaldequebec.com" ||
            // http://storage.journaldemontreal.com/v1/dynamic_resize/sws_path/jdx-prod-images/b618335b-9523-4599-9f42-e7e394ceee77_ORIGINAL.jpg?quality=80&size=640x&version=7
            domain === "storage.journaldemontreal.com" ||
            src.match(/^[a-z]+:\/\/storage\.[^/]*\/v[0-9]*\/dynamic_resize\/sws_path\//)) {
            //return src.replace(/(\/dynamic_resize\/.*)\?[^/]*$/, "$1?size=99999999");
            return src.replace(/\/dynamic_resize\/[^/]*\//, "/").replace(/\?[^/]*$/, "");
        }

        if (domain === "storage.journaldemontreal.com") {
            return {
                url: src,
                head_wrong_contenttype: true
            };
        }

        if (domain.indexOf("pictures.ozy.com") >= 0) {
            return src.replace(/\/pictures\/[0-9]*x[0-9]*\//, "/pictures/99999999x99999999/");
        }

        if (domain.indexOf("hips.hearstapps.com") >= 0) {
            // https://hips.hearstapps.com/hmg-prod.s3.amazonaws.com/images/bgus-1060427-037-1-1510856807.jpg
            //   http://hmg-prod.s3.amazonaws.com/images/bgus-1060427-037-1-1510856807.jpg
            // https://hips.hearstapps.com/rover/profile_photos/21445446-1bde-4290-a24e-2bdd274be027_1516741729.jpg?fill=1:1&resize=200:*
            //   https://hips.hearstapps.com/rover/profile_photos/21445446-1bde-4290-a24e-2bdd274be027_1516741729.jpg
            newsrc = src.replace(/.*hips\.hearstapps\.com\/([^/]+\.[^/]+)/, "http://$1");
            if (newsrc !== src)
                return newsrc;
            return src.replace(/\?[^/]*$/, "");
        }

        if (domain.indexOf("img.wennermedia.com") >= 0) {
            return src.replace(/img\.wennermedia\.com\/.*\/([^/]*)$/, "img.wennermedia.com/$1");
        }

        // specials-images.forbesimg.com
        if (domain.indexOf("images.forbesimg.com") >= 0) {
            return src.replace(/\/[0-9]*x[0-9]*\.([^/.?]*)(\?.*)?/, "/0x0.$1");
        }

        // MediaWiki
        if (domain.indexOf("upload.wikimedia.org") >= 0 ||
            domain.indexOf("www.generasia.com") >= 0 ||
            // https://cdn.wikimg.net/strategywiki/images/thumb/0/01/PW_JFA_Official_Artwork.jpg/350px-PW_JFA_Official_Artwork.jpg
            domain === "cdn.wikimg.net" ||
            // http://liquipedia.net/commons/images/thumb/d/df/Tossgirl_2008_stx081014.jpg/269px-Tossgirl_2008_stx081014.jpg
            //   http://liquipedia.net/commons/images/d/df/Tossgirl_2008_stx081014.jpg
            domain === "liquipedia.net" ||
            // http://oyster.ignimgs.com/mediawiki/apis.ign.com/best-of-2017-awards/thumb/8/86/Anime.jpg/610px-Anime.jpg
            //   http://oyster.ignimgs.com/mediawiki/apis.ign.com/best-of-2017-awards/8/86/Anime.jpg
            src.match(/\/thumb\/.\/..\/[^/]*\.[^/]*\/[0-9]*px-/)) {
            return src.replace(/\/thumb\/([^/]*)\/([^/]*)\/([^/]*)\/.*/, "/$1/$2/$3");
        }

        if (domain.indexOf("pixel.nymag.com") >= 0) {
            return src.replace(/\/([^/.]*)(\.[^/]*)?\.([^/.]*)$/, "/$1.$3");
        }

        if (domain.indexOf("assets.nydailynews.com") >= 0 ||
            // https://i.cbc.ca/1.4304676.1506225777!/fileImage/httpImage/edmonton-oilers.JPG?imwidth=720
            //   https://i.cbc.ca/1.4304676.1506225777!/fileImage/httpImage/edmonton-oilers.JPG
            domain.indexOf("i.cbc.ca") >= 0 ||
            domain.indexOf("cdn.newsday.com") >= 0 ||
            domain.indexOf("www.stripes.com") >= 0 ||
            domain.indexOf("www.thetimesnews.com") >= 0 ||
            domain.indexOf("www.irishtimes.com") >= 0 ||
            domain.indexOf("www.ctvnews.ca") >= 0 ||
            // http://www.lancashirelife.co.uk/polopoly_fs/1.1596808!/image/2417471173.jpg_gen/derivatives/landscape_490/2417471173.jpg
            domain.indexOf("www.lancashirelife.co.uk") >= 0 ||
            // http://images.archant.co.uk/polopoly_fs/1.5453783.1522228810!/image/image.jpg_gen/derivatives/landscape_630/image.jpg
            domain === "images.archant.co.uk" ||
            // https://www.tsn.ca/polopoly_fs/1.432481!/fileimage/httpImage/image.jpg_gen/derivatives/default/connor-mcdavid.jpg -- doesn't work
            //domain === "www.tsn.ca" ||
            // http://images.glaciermedia.ca/polopoly_fs/1.23165389.1517899084!/fileImage/httpImage/image.jpg_gen/derivatives/landscape_804/edm110453004-jpg.jpg
            domain === "images.glaciermedia.ca" ||
            // https://static.gulfnews.com/polopoly_fs/1.2168576!/image/3397099558.jpg_gen/derivatives/box_460346/3397099558.jpg
            domain === "static.gulfnews.com" ||
            // http://www.islingtongazette.co.uk/polopoly_fs/1.957786!/image/89195513.jpg_gen/derivatives/landscape_490/89195513.jpg
            domain === "www.islingtongazette.co.uk" ||
            domain.indexOf("www.edp24.co.uk") >= 0) {
            newsrc = src
                .replace(/\/image\.[^_/]*_gen\/derivatives\/[^/]*\//, "/")
                .replace(/\/image\/[^_/]*_gen\/derivatives\/[^/]*\//, "/image/");
            if (newsrc !== src) {
                return newsrc.replace(/\?.*/, "");
            }
        }

        if (domain === "static.gulfnews.com") {
            return {
                url: src,
                head_wrong_contenttype: true
            };
        }

        if (domain === "www.tsn.ca") {
            // https://www.tsn.ca/polopoly_fs/1.738832!/fileimage/httpImage/image.jpg_gen/derivatives/landscape_620/kyle-fuller.jpg
            //   https://www.tsn.ca/polopoly_fs/1.738832!/fileimage/httpImage/image.jpg_gen/derivatives/default/kyle-fuller.jpg
            return src.replace(/(\/image\.[^_/]*_gen\/derivatives\/)[^/]*\//, "$1default/");
        }

        if (domain.match(/ichef(?:-[0-9]*)?.bbci.co.uk/)) {
            newsrc = src.replace(/\/[0-9]+_[0-9]+\//, "/original/");
            if (newsrc !== src)
                return newsrc;

            // http://ichef.bbci.co.uk/corporate2/images/width/live/p0/55/fh/p055fhy8.jpg/624
            //   http://ichef.bbci.co.uk/corporate2/images/width/live/p0/55/fh/p055fhy8.jpg/0
            newsrc = src.replace(/(\.[^/.]*)\/[0-9]+$/, "$1/0");
            if (newsrc !== src)
                return newsrc;

            // https://ichef.bbci.co.uk/images/ic/960x540/p03jg3g8.jpg
            //   https://ichef.bbci.co.uk/images/ic/raw/p03jg3g8.jpg
            // https://ichef.bbci.co.uk/images/ic/720x405/p0517py6.jpg
            //   https://ichef.bbci.co.uk/images/ic/raw/p0517py6.jpg
            // https://ichef.bbci.co.uk/images/ic/1920xn/p0698c1x.jpg
            //   https://ichef.bbci.co.uk/images/ic/raw/p0698c1x.jpg
            newsrc = src.replace(/\/images\/ic\/[0-9n]+x[0-9n]+\//, "/images/ic/raw/");
            if (newsrc !== src)
                return newsrc;

            // http://ichef.bbci.co.uk/wwhp/999/cpsprodpb/7432/production/_99764792_8e240163-62f5-4b0f-bf90-6def2cdc883b.jpg
            //   http://ichef.bbci.co.uk/news/999/cpsprodpb/7432/production/_99764792_8e240163-62f5-4b0f-bf90-6def2cdc883b.jpg
            //   https://c.files.bbci.co.uk/7432/production/_99764792_8e240163-62f5-4b0f-bf90-6def2cdc883b.jpg
            // https://ichef.bbci.co.uk/news/999/media/images/79831000/jpg/_79831755_hewer2_bbc.jpg
            //   https://news.bbcimg.co.uk/media/images/79831000/jpg/_79831755_hewer2_bbc.jpg
            // https://ichef-1.bbci.co.uk/news/235/cpsprodpb/A771/production/_99756824_trumpmueller.jpg
            //   https://c.files.bbci.co.uk/A771/production/_99756824_trumpmueller.jpg
            // http://ichef.bbci.co.uk/news/999/mcs/media/images/79839000/jpg/_79839098_bbcnickhewer.jpg
            //   http://news.bbcimg.co.uk/media/images/79839000/jpg/_79839098_bbcnickhewer.jpg
            // http://news.bbcimg.co.uk/news/special/2016/newsspec_15380/img/trump_annotated_976v2.png
            // http://news.bbcimg.co.uk/news/special/2017/newsspec_17595/img/hurricane_globe_v6.gif
            // http://ichef.bbci.co.uk/news/976/cpsprodpb/11B74/production/_88046527_getty_ora.jpg
            //   http://news.bbcimg.co.uk/media/images/88046527/jpg/_88046527_getty_ora.jpg -- not found
            //   http://c.files.bbci.co.uk/11B74/production/_88046527_getty_ora.jpg
            // http://news.bbcimg.co.uk/media/images/74104000/jpg/_74104195_6671990f-809f-432b-8699-7b5b92d053a0.jpg
            // http://news.bbcimg.co.uk/media/images/61015000/jpg/_61015960_3a79d215-7772-4ec1-b157-1655c66793ad.jpg
            // http://news.bbcimg.co.uk/news/special/2016/newsspec_12799/content/full-width/common/img/italy_graves_intro_1400.jpg
            // https://ichef.bbci.co.uk/onesport/cps/800/cpsprodpb/41F9/production/_98998861_ragnbone.jpg
            // http://c.files.bbci.co.uk/28EE/production/_98587401_afoty_624x351_player5.jpg
            // https://ichef.bbci.co.uk/live-experience/cps/800/cpsprodpb/vivo/live/images/2018/5/29/433b3e44-09ac-4366-a535-c1fbd8bc9cde.jpg
            //   https://c.files.bbci.co.uk/vivo/live/images/2018/5/29/433b3e44-09ac-4366-a535-c1fbd8bc9cde.jpg
            // https://ichef.bbci.co.uk/food/ic/food_16x9_832/recipes/irish_fish_chowder_with_08587_16x9.jpg -- 832x468
            //   https://food-images.files.bbci.co.uk/food/recipes/irish_fish_chowder_with_08587_16x9.jpg -- 5341x3004
            //
            //
            // larger images:
            // https://news.files.bbci.co.uk/include/shorthand/40714/media/nk_family_tree_shorthand_la.png -- 2560x1440
            // http://www.bbc.co.uk/staticarchive/3950fd5e40621b9769250aecda90d060da592198.jpg -- 602x357
            //   http://www.bbc.co.uk/sing/hallelujah/images/bbc_sing-hallelujah-london_fullsize.jpg -- 5616x3329
            // http://ichef.bbci.co.uk/images/ic/raw/p05k91nn.png -- 4001x3438
            //
            // subdomains for files.bbci.co.uk:
            //   a
            //   b
            //   c
            //   nav
            //   news
            //   childrens-binary
            //   search
            //   m
            //     https://m.files.bbci.co.uk/modules/bbc-morph-sport-opengraph/1.1.1/images/bbc-sport-logo.png
            //   guides
            //   food
            //   podcasts
            //   mybbc
            //   bbcthree-web-cdn
            //     https://bbcthree-web-cdn.files.bbci.co.uk/bbcthree-web-server/2.9.0-257.x86_64/images/share-best-of.png
            //   bam
            //     https://bam.files.bbci.co.uk/bam/live/content/zm8497h/large
            //     https://bam.files.bbci.co.uk/bam/live/content/zm8497h/small -- different (but related) image
            // subdomains for bbci.co.uk:
            //   static -- used for js etc. sometimes for images
            //   feeds -- used for rss feeds
            //   downloads
            //     http://downloads.bbc.co.uk/commissioning/site/CBBC_New_Logo_RGB.png
            //   android
            //   r
            //   [blank]
            //   www
            //   emp
            //
            // different cropping:
            // https://ichef.bbci.co.uk/news/999/cpsprodpb/01C8/production/_99765400_hi039575218.jpg
            // https://ichef.bbci.co.uk/news/999/cpsprodpb/DB2A/production/_99760165_hi039575218.jpg
            // http://news.bbcimg.co.uk/media/images/99765000/jpg/_99765400_hi039575218.jpg - doesn't work
            newsrc = src.replace(/.*\.bbci\.co\.uk\/news\/[0-9]*\/(?:[^/]*\/)?media\//, "http://news.bbcimg.co.uk/media/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/:\/\/[^/]*\/food\/ic\/[^/]*\//, "://food-images.files.bbci.co.uk/food/");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/.*\/cpsprodpb\//, "https://c.files.bbci.co.uk/");

            /*var origsize = src.match(/\.bbci\.co\.uk\/[^/]*\/([0-9]*)\//);
            if (origsize && false) { // scales up
                var size = parseInt(origsize[1], 10);
                if (size < 2048) {
                    return src.replace(/(\.bbci\.co\.uk\/[^/]*)\/[0-9]*\//, "$1/2048/");
                }
            }*/
        }

        if (domain === "amp.thisisinsider.com" ||
            domain === "amp.businessinsider.com") {
            // https://amp.thisisinsider.com/images/58c2c3d580c5ac1f008b47dc-960-1545.jpg
            //   https://static2.thisisinsider.com/image/58c2c3d580c5ac1f008b47dc/
            // https://amp.businessinsider.com/images/56dc9a3052bcd028008b4703-750-887.jpg
            //   https://static2.thisisinsider.com/image/56dc9a3052bcd028008b4703/
            // https://amp.businessinsider.com/images/5a383bcc7101ad309463675a-480-320.jpg
            //   https://static2.thisisinsider.com/image/5a383bcc7101ad309463675a/ -- doesn't work
            //   https://static2.businessinsider.com/image/5a383bcc7101ad309463675a.jpg
            //   https://static2.businessinsider.com/image/5a383bcc7101ad309463675a/
            return urljoin(src, src.replace(/^[a-z]+:\/\/amp\.([^/]*)\/images\/([^-]*)[^/]*(\.[^/.]*)$/, "//static2.$1/image/$2/"));
        }

        // why was this commented out?
        if (domain.match(/static[0-9]*\.thisisinsider\.com/)) {
            // http://static2.thisisinsider.com/image/58c2c3d580c5ac1f008b47dc-200/
            //   https://static2.thisisinsider.com/image/58c2c3d580c5ac1f008b47dc/
            // http://static.thisisinsider.com/image/59f0985d9091c139008b45da-750.jpg
            //   http://static.thisisinsider.com/image/59f0985d9091c139008b45da.jpg
            return src.replace(/(\/image\/[^/]*)-[0-9]*(\/[^/]*|\.[^/.]*)$/, "$1$2");
        }

        if (domain.match(/static[0-9]*(?:\.[^/.]*)?\.businessinsider\.com/) ||
            domain.match(/static[0-9]*(?:\.[^/.]*)?\.thisisinsider\.com/)) {
            // http://static2.thisisinsider.com/image/58c2c3d580c5ac1f008b47dc-200/
            //   https://static2.thisisinsider.com/image/58c2c3d580c5ac1f008b47dc/
            // http://static6.uk.businessinsider.com/image/58ae09acdd089506308b4ad1-2377/undefined
            //   http://static6.uk.businessinsider.com/image/58ae09acdd089506308b4ad1/undefined
            return src
                .replace(/\/image\/([^-/]*)[^/]*\//, "/image/$1/");
        }

        if (domain.indexOf("media.nbcwashington.com") >= 0 ||
            // https://media.nbcnewyork.com/images/653*367/AP_18012240030020.jpg
            domain.indexOf("media.nbcnewyork.com") >= 0 ||
            // http://media.graytvinc.com/images/810*455/TAYLOR+SWIFT19.jpg
            domain === "media.graytvinc.com" ||
            // https://media.nbcchicago.com/images/652*367/t-swift-cover.jpg
            domain === "media.nbcchicago.com") {
            return src.replace(/\/images\/[0-9]+\*[0-9]+\//, "/images/");
        }

        if (domain.indexOf("www.bet.com") >= 0) {
            // https://www.bet.com/style/living/2018/01/29/chrissy-teigen-gender-reveal/_jcr_content/squareImage.featured1x1.dimg/__1517248018208__1517242933377/012918-style-chrissy-teigen-gender-reveal.jpg
            //   https://www.bet.com/style/living/2018/01/29/chrissy-teigen-gender-reveal/_jcr_content/bodycopycontainer/embedded_image_0/image.custom0fx0fx0xcrop.dimg/__1517248018208__1517242933377/012918-style-chrissy-teigen-gender-reveal.jpg
            // https://www.bet.com/style/beauty/2018/01/30/cheap-beauty-products-celebrities-use/_jcr_content/bodycopycontainer/listiclecontainer/listicleitem_3/embedded_image/image.custom1200x1581.dimg/__1516987722286__1516987306610/012618-style-yara-shahidi-cheap-beauty-products.jpg
            // https://www.bet.com/style/fashion/2018/01/28/see-all-the-looks-from-the-grammy-s-2018-red-carpet/_jcr_content/squareImage.featuredlist.dimg/__1517191072539__1517189173163/012818-style-grammy-looks-1.jpg
            // https://www.bet.com/style/fashion/2018/01/28/see-rihanna-slay-a-patent-trench-as-she-accepted-a-grammy-award-/_jcr_content/image.ampheroimage.dimg/__1517189314895__1517188008118/012818-style-see-rihanna-slay-a-patent-trench-as-she-accepted-a-grammy-award.jpg
            // https://www.bet.com/style/living/2018/02/01/leslie-jones-meagan-good-body-positivity-black-girl-magic/_jcr_content/squareImage.relatedinline1x1.dimg/__1517510003204__1517501332582/020118-Celebs-Leslie-Jones-Megan-Good.jpg
            // https://www.bet.com/style/fashion/2018/01/31/jennifer-lopez-shows-off-toned-legs/_jcr_content/image.feedcontainer.dimg/__1517429162639__1517412507314/013118-style-jennifer-lopez-shows-off-toned-legs-3.jpg
            return src
                .replace(/\/(_jcr_content.*?\/[^/]*)\.custom[0-9]+fx[0-9]+fx[0-9]+xcrop\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.custom[0-9]+x[0-9]+\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.featured[0-9]+x[0-9]+\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.featuredlist\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.ampheroimage\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.feedcontainer\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.[^/.]*\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.relatedinline[0-9]+x[0-9]+\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/");
                //.replace(/\/_jcr_content\/.*(\/[^/]*)$/, "/_jcr_content/bodycopycontainer/embedded_image_0/image.custom0fx0fx0xcrop.dimg/$1");
        }

        if (domain.match(/cbsnews[0-9]*\.cbsistatic\.com/) ||
            // https://zdnet1.cbsistatic.com/hub/i/r/2018/01/12/2dcbd29f-f3fa-4283-b11a-e163c03bbc08/resize/770xauto/99721c4b340e885277343e7f6cb4b6c3/ndcboom1-alt.jpg
            //   https://zdnet1.cbsistatic.com/hub/i/r/2018/01/12/2dcbd29f-f3fa-4283-b11a-e163c03bbc08/99721c4b340e885277343e7f6cb4b6c3/ndcboom1-alt.jpg
            // https://zdnet4.cbsistatic.com/hub/i/r/2018/02/06/1eef8bb5-4034-4e88-b356-ff9b035778d9/thumbnail/170x128/122ea3f0f9d0c3b86c23c3ff362ad252/brooke-cagle-195777.jpg
            //   https://zdnet4.cbsistatic.com/hub/i/r/2018/02/06/1eef8bb5-4034-4e88-b356-ff9b035778d9/122ea3f0f9d0c3b86c23c3ff362ad252/brooke-cagle-195777.jpg
            domain.match(/zdnet[0-9]*\.cbsistatic\.com/) ||
            domain.indexOf("cimg.tvgcdn.net") >= 0) {
            return src
                .replace(/\/resize\/[0-9a-z]*x[0-9a-z]*\//, "/")
                .replace(/\/crop\/[^/]*\//, "/")
                .replace(/\/thumbnail\/[^/]*\//, "/");
        }

        if (domain.match(/cnet[0-9]*\.cbsistatic\.com/)) {
            // https://cnet3.cbsistatic.com/img/FK8CGJDejVV-sEaEJZ2nXW8eM3k=/1600x900/2017/03/15/a2595ca5-43fc-4508-9c36-745b04dd49a1/coco2.jpg
            //   https://cnet3.cbsistatic.com/img/2017/03/15/a2595ca5-43fc-4508-9c36-745b04dd49a1/coco2.jpg
            // https://cnet1.cbsistatic.com/img/nCMng7w4iuS_uxiPM4wghBjtQBg=/81x398:2438x2724/0x527/2017/05/08/9f832785-f506-4ec3-b175-f85723d123dc/ew-opener.jpg
            //   https://cnet1.cbsistatic.com/img/2017/05/08/9f832785-f506-4ec3-b175-f85723d123dc/ew-opener.jpg
            // https://cnet1.cbsistatic.com/img/DIHwjRMV2yd28ex651bXyFnHQmE=/2017/12/27/3397f9e3-e1b9-4630-8e14-451a97546d32/dsc01630.jpg
            //   https://cnet1.cbsistatic.com/img/2017/12/27/3397f9e3-e1b9-4630-8e14-451a97546d32/dsc01630.jpg
            return src.replace(/\/img\/[^/]*=\/(?:[0-9]+x[0-9]+:[0-9]+x[0-9]+\/)?(?:[0-9]+x[0-9]+\/)?(.*)/, "/img/$1");
        }

        if (domain.match(/wwwimage[0-9]*(?:-secure)?\.cbsstatic\.com/)) {
            // http://wwwimage2.cbsstatic.com/thumbnails/photos/w370/blog/abd70cf777ca6a77_marissa_golds_guide_1920.jpg
            //   http://wwwimage2.cbsstatic.com/base/files/blog/abd70cf777ca6a77_marissa_golds_guide_1920.jpg
            // http://wwwimage.cbsstatic.com/thumbnails/photos/files/asset/10/00/56/47/927857742dd31df2_dianes_world.jpg
            //   http://wwwimage.cbsstatic.com/base/files/asset/10/00/56/47/927857742dd31df2_dianes_world.jpg
            // http://wwwimage4.cbsstatic.com/thumbnails/videos/w270/CBS_Production_Entertainment_VMS/761/811/2018/02/06/1145406531709/CBS_SCORPION_416_IMAGE_NO_LOGO_thumb_Master.jpg
            //   http://wwwimage4.cbsstatic.com/thumbnails/videos/files/CBS_Production_Entertainment_VMS/761/811/2018/02/06/1145406531709/CBS_SCORPION_416_IMAGE_NO_LOGO_thumb_Master.jpg
            // http://wwwimage2.cbsstatic.com/thumbnails/photos/770xh/danielle_big_brother_over_the_top.jpg
            // http://wwwimage2.cbsstatic.com/thumbnails/photos/100q/danielle_big_brother_over_the_top.jpg
            // https://wwwimage-secure.cbsstatic.com/thumbnails/photos/770xh/610a45ac16030991_lady-gaga-2-red-carpet-2018-grammy-awards.jpg
            //
            // error:
            //Not enough parameters were given.
            //
            //Available parameters:
            //w = Maximum width
            //h = Maximum height
            //c = Crop ratio (width:height)
            //q = Quality (0-100)
            //b = Background fill color (RRGGBB or RGB)
            //p = Progressive (0 or 1)
            //
            //Example usage:
            // http://wwwimage2.cbsstatic.com/thumbnails/photos/w300-h300-c1:1/path/to/image.jpg
            return src
                //.replace(/\/thumbnails\/([^/]*)\/[wh][0-9]*\//, "/thumbnails/$1/files/")
                .replace(/\/thumbnails\/([^/]*)\/[-a-z0-9:]*\//, "/thumbnails/$1/files/")
                .replace("/thumbnails/photos/files/", "/base/files/");
        }

        if (domain === "api.fidji.lefigaro.fr") {
            // http://api.fidji.lefigaro.fr/media/ext/1900x/madame.lefigaro.fr/sites/default/files/img/2015/01/defile-valentino-automne-hiver-2015-2016-paris-look-46.jpg
            //   http://i.f1g.fr/media/ext/1900x/madame.lefigaro.fr/sites/default/files/img/2015/01/defile-valentino-automne-hiver-2015-2016-paris-look-46.jpg
            // http://api.fidji.lefigaro.fr/media/ext/1900x/img.tvmag.lefigaro.fr/ImCon/Arti/89615/PHO0ce17170-86bd-11e5-81ca-efc6b4cd613e-805x453.jpg
            //   http://i.f1g.fr/media/ext/1900x/img.tvmag.lefigaro.fr/ImCon/Arti/89615/PHO0ce17170-86bd-11e5-81ca-efc6b4cd613e-805x453.jpg
            return src.replace("://api.fidji.lefigaro.fr/", "://i.f1g.fr/");
        }

        if (domain.indexOf("i.f1g.fr") >= 0) {
            newsrc = src.replace(/.*i\.f1g\.fr\/media\/ext\/[^/]*\//, "http://");
            var newdomain = newsrc.replace(/^http:\/\/([^/]*)\/.*/, "$1");
            if (newsrc !== src &&
                newdomain !== "img.tvmag.lefigaro.fr")
                return newsrc;

            // http://svn.pimentech.org/pimentech/libcommonDjango/django_pimentech/pixr/views.py
            // mirror: https://pastebin.com/D7zPvfa1
            //
            // http://i.f1g.fr/media/figaro/493x100_crop/2017/03/28/XVM5540edbe-13a3-11e7-9e28-7b011fa4a165.jpg
            //   http://i.f1g.fr/media/figaro/orig/2017/03/28/XVM5540edbe-13a3-11e7-9e28-7b011fa4a165.jpg
            // http://i.f1g.fr/media/eidos/493x178_crop/2017/11/05/XVM758e1cb8-c212-11e7-b1f9-8e8a8cad8fcc.jpg
            //   http://i.f1g.fr/media/eidos/orig/2017/11/05/XVM758e1cb8-c212-11e7-b1f9-8e8a8cad8fcc.jpg
            return src.replace(/\/media\/([a-z]*)\/[^/]*\//, "/media/$1/orig/");
        }

        if (/*domain.indexOf("hbz.h-cdn.co") >= 0*/
            domain.indexOf(".h-cdn.co") >= 0 && src.indexOf("/assets/") >= 0) {
            return src.replace(/\/[0-9]*x[0-9]*\//, "/");
        }

        if (domain.indexOf("imgix.ranker.com") >= 0) {
            return src.replace(/\?[^/]*$/, "?fm=png");
        }

        // https://driftt.imgix.net/https%3A%2F%2Fdriftt.imgix.net%2Fhttps%253A%252F%252Fs3.amazonaws.com%252Fcustomer-api-avatars-prod%252F124400%252Fa382421eaa0c3184c7c1588a54a481014za77e245kzk%3Ffit%3Dmax%26fm%3Dpng%26h%3D200%26w%3D200%26s%3Db662f982cf04f9f733dcb1ce4522ee73?fit=max&fm=png&h=200&w=200&s=cd4c2695da2c9621a41fc14e92516b37
        //  https://driftt.imgix.net/https%3A%2F%2Fs3.amazonaws.com%2Fcustomer-api-avatars-prod%2F124400%2Fa382421eaa0c3184c7c1588a54a481014za77e245kzk?fit=max&fm=png&h=200&w=200&s=b662f982cf04f9f733dcb1ce4522ee73
        //   https://s3.amazonaws.com/customer-api-avatars-prod/124400/a382421eaa0c3184c7c1588a54a481014za77e245kzk
        if (domain.indexOf("driftt.imgix.net") >= 0) {
            return decodeURIComponent(src.replace(/.*?driftt\.imgix\.net\//, ""));
        }

        if (domain.indexOf("data.whicdn.com") >= 0) {
            // https://data.whicdn.com/images/284282683/superthumb.jpg
            //   https://data.whicdn.com/images/284282683/original.jpg
            return src.replace(/\/[^/.]*\.([^/.]*)$/, "/original.$1");
        }

        if (domain.indexOf("cdn.empireonline.com") >= 0) {
            // 12
            // https://cdn.empireonline.com/jpg/70/0/0/640/480/aspectfit/0/0/0/0/0/0/c/reviews_films/5a57bf3d652c21bb08ce7fc8/pixar-coco-concept-art.jpg
            //   https://cdn.empireonline.com/c/reviews_films/5a57bf3d652c21bb08ce7fc8/pixar-coco-concept-art.jpg
            // https://cdn.empireonline.com/jpg/80/0/0/300/170/0/north/0/0/0/0/0/c/reviews_films/5a73e5036bb57fce0af3b5ab/den-of-thieves-1.jpg
            //   https://cdn.empireonline.com/c/reviews_films/5a73e5036bb57fce0af3b5ab/den-of-thieves-1.jpg
            //return src.replace(/cdn\.empireonline\.com\/(?:jpg|png|gif)\/(?:[0-9]+\/){5}aspectfit\/(?:[0-9]+\/){6}/, "cdn.empireonline.com/");
            return src.replace(/cdn\.empireonline\.com\/(?:jpg|png|gif)\/(?:[^/.]+\/){12}/, "cdn.empireonline.com/");
            //return urljoin(src, src.replace(/cdn\.empireonline\.com\/(jpg)|(png)|(gif)\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/[^/]*\//, "/"));
        }

        if (domain.indexOf("ell.h-cdn.co") >= 0) {
            return src.replace(/(\/assets\/[^/]*\/[^/]*\/)[0-9]+x[0-9]+\//, "$1");
        }

        if (domain.indexOf("celebmafia.com") >= 0 ||
            domain.indexOf("hawtcelebs.com") >= 0) {
            return src.replace(/\/([^/]*)_thumbnail\.([^/.]*)$/, "/$1.$2");
        }

        if (domain.match(/[a-z]*[0-9]*\.pixhost\.org/) ||
            domain.match(/[a-z]*[0-9]*\.pixhost\.to/)) {
            // https://t17.pixhost.to/thumbs/469/66269400_ns4w-org-2.jpg
            //   https://img17.pixhost.to/images/469/66269400_ns4w-org-2.jpg
            return src.replace(/\/t([0-9]*\.pixhost\.[a-z]*)\/thumbs\//, "/img$1/images/");
        }

        /*if (domain.indexOf("ssli.ulximg.com") >= 0) {
            return src.replace(/\/image\/[0-9]+x[0-9]+\//, "/image/full/");
        }*/

        if (domain.indexOf(".ulximg.com") >= 0) {
            // https://sslh.ulximg.com/image/740x493/cover/1517447102_98a80a4ead45fe6ea39dba7f13d82d59.jpg/cf804979603806d94cb139fc0676f0ca/1517447102_4694e8c352198b439a03d90f0ea03910.jpg
            // https://sslb.ulximg.com/image/640xfull/gallery/1519079706_9a191bef4598aefcd89fdb14d43dd943.jpg/ab146c791e98eccd4a763e2a31fa10ce/1519079706_65c3b37c6f9215a3c80d86f6172920c2.jpg
            //   https://sslb.ulximg.com/image/full/gallery/1519079706_9a191bef4598aefcd89fdb14d43dd943.jpg/ab146c791e98eccd4a763e2a31fa10ce/1519079706_65c3b37c6f9215a3c80d86f6172920c2.jpg
            // doesn't work for all:
            // https://sslh.ulximg.com/image/740x493/cover/1517954740_3e7856551e64f1217860014d8853d1e1.jpg
            return src
                .replace(/\/image\/[0-9a-z]*x[0-9a-z]*\//, "/image/full/");
                //.replace(/(\/cover\/[^/.]*\.[^/.]*)\/.*/, "$1");
        }

        if (domain.indexOf("fm.cnbc.com") >= 0) {
            return src.replace(/\.[0-9]+x[0-9]+\.([^/.]*)$/, ".$1");
        }

        if (domain.indexOf("images.bwwstatic.com") >= 0) {
            return src.replace(/\/tn-[0-9]+_([^/]*)$/, "/$1");
        }

        if (domain.match(/images[0-9]*\.houstonpress\.com/)) {
            return src.replace(/(\/imager\/[^/]*\/)[^/]*\//, "$1original/");
        }

        if (domain.indexOf("img.rasset.ie") >= 0 && false) {
            // https://img.rasset.ie/000a704c-440.jpg
            //   https://img.rasset.ie/000a704c-9999.jpg -- wildly stretched (4096x6144)
            return src.replace(/(\/[^/]*)-[0-9]*(\.[^/.]*)$/, "$1-9999$2");
        }

        if (domain.indexOf("i.pinimg.com") >= 0 ||
            // http://media.pinterest.com.s3.amazonaws.com/640x/c9/68/4a/c9684afc422e69662bed9f59835d2001.jpg
            //   http://media.pinterest.com.s3.amazonaws.com/originals/c9/68/4a/c9684afc422e69662bed9f59835d2001.jpg
            domain === "media.pinterest.com.s3.amazonaws.com") {
            // doesn't work:
            // https://i.pinimg.com/originals/1f/3f/ed/1f3fed6c284955934c7d724d2fe13ecb.jpg
            //  https://i.pinimg.com/originals/1f/3f/ed/1f3fed6c284955934c7d724d2fe13ecb.png
            return src.replace(/(:\/\/[^/]*\/)[^/]*(\/.*\/[^/]*)\.[^/.]*$/, "$1originals$2.jpg");
        }

        // vg-images.condecdn.net
        // gl-images.condecdn.net
        if (domain.indexOf("images.condecdn.net") >= 0) {
            return src.replace(/(\/image\/[^/]*\/).*/, "$1original/");
        }

        if (domain.indexOf("media.fromthegrapevine.com") >= 0 ||
            domain.indexOf("www.mediavillage.com") >= 0) {
            return src.replace(/\/([^/.]*\.[^/.]*)\.[^/.]*\.[^/.]*$/, "/$1");
        }

        if (domain.search(/img[0-9]*\.acsta\.net/) >= 0) {
            newsrc = src.replace(/acsta\.net\/[^/]*\/pictures\//, "acsta.net/pictures/");
            if (newsrc !== src)
                return newsrc;

            // http://fr.web.img4.acsta.net/r_640_360/videothumbnails/15/06/05/12/59/008779.jpg
            //   http://fr.web.img4.acsta.net/videothumbnails/15/06/05/12/59/008779.jpg
            // http://fr.web.img2.acsta.net/c_208_117/videothumbnails/17/02/08/14/59/169562.jpg
            //   http://fr.web.img2.acsta.net/videothumbnails/17/02/08/14/59/169562.jpg
            return src.replace(/\/[rc]_[0-9]+_[0-9]+\//, "/");
        }

        if (domain.indexOf("em.wattpad.com") >= 0) {
            return src.replace(/.*\.wattpad\.com\/[a-f0-9]*\/([a-f0-9]*).*/, "$1").replace(/([0-9A-Fa-f]{2})/g, function() {
                return String.fromCharCode(parseInt(arguments[1], 16));
            });
        }

        if (domain.indexOf("vignette.wikia.nocookie.net") >= 0) {
            // https://vignette.wikia.nocookie.net/arresteddevelopment/images/2/2a/2015_MM_and_A_TGIT_Party_-_Portia_de_Rossi.jpg/revision/latest/top-crop/width/320/height/320?cb=20151215213157
            //   https://vignette.wikia.nocookie.net/arresteddevelopment/images/2/2a/2015_MM_and_A_TGIT_Party_-_Portia_de_Rossi.jpg/revision/latest/?cb=20151215213157
            // https://vignette.wikia.nocookie.net/kpop/images/9/95/Various_Seulki_I_Only_Want_You_photo.png/revision/latest/scale-to-width-down/350
            //   https://vignette.wikia.nocookie.net/kpop/images/9/95/Various_Seulki_I_Only_Want_You_photo.png/revision/latest/
            //return src.replace(/(\/images\/[^/]*\/.*)\/scale-to-width-down\/[0-9]*/, "$1");
            return src.replace(/\/revision\/([^/]*)\/.*?(\?.*)?$/, "/revision/$1/$2");
        }

        if (domain.indexOf("static.asiachan.com") >= 0) {
            return src.replace(/(\/[^/]*)\.[0-9]*(\.[0-9]*\.[^/.]*$)/, "$1.full$2");
        }

        if (domain.indexOf("pic.xiami.net") >= 0) {
            return src.replace(/@[^/]*$/, "");
        }

        // img4.c.yinyuetai.com
        if (domain.search(/img[0-9]\.c\.yinyuetai\.com/) >= 0) {
            return src.replace(/[0-9]+x[0-9]+(\.[^/.]*)$/, "0x0$1");
        }

        // it also has img7.qiyipic.com, which hosts /passport/, which doesn't work with this (mp2.qiyipic.com)
        if (domain.search(/mp[0-9]*\.qiyipic\.com/) >= 0 && src.indexOf("/passport/") < 0) {
            return src.replace(/[0-9]*_[0-9]*(\.[^/.]*)$/, "0_0$1");
        }

        if (domain.indexOf("b-ssl.duitang.com") >= 0) {
            return src.replace(/\.thumb\.[0-9]+_[0-9]+\./, ".");
        }

        // i7.vcimg.com
        if (domain.search(/i-[0-9]\.vcimg.com/) >= 0) {
            return src.replace(/\/crop\//, "/").replace(/\([0-9]+x[0-9]+\)/, "");
        }

        // pic1.zhimg.com
        if (domain.search(/pic[0-9]\.zhimg\.com/) >= 0) {
            return src.replace(/_[^/._]*(\.[^/.]*)$/, "$1");
        }

        // seems to returns 403 if 'referer' header is set
        if (domain.indexOf("img.hb.aicdn.com") >= 0 ||
            domain.indexOf(".upaiyun.com") >= 0) {
            // http://hbimg.b0.upaiyun.com/61a5e5496ff85c52aedb1a0b88cfa6cf2fab85b25baa4-OOfVFz_fw236
            // http://hbimg.b0.upaiyun.com/24c9187996fff6a463a6e0cf33e445a5c106f840110dad-GoXNdV_fw658
            // http://hbimg.b0.upaiyun.com/eb022d252413c843904d7929cd20efad6ce5ad1d1a13b-nuwiDc_fw236
            // http://hbimg.b0.upaiyun.com/2dee7739bd27dac4368381fc5e571fc5efffa0dc1b2530-76nu98
            // http://hbimg.b0.upaiyun.com/26f0536f7035fde61b7332a3bbf1e54bf0255c4d2d07b-gZ7snl_fw658
            return {
                url: src.replace(/_[^/_]*$/, ""),
                headers: {
                    "Referer": null
                }
            };
            // return src.replace(/_fw[0-9]*$/, "");
        }

        if (domain.indexOf("imagev2.xmcdn.com") >= 0) {
            return src.replace(/![^/]*$/, "").replace(/(\/[^/_]*)[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain.indexOf("timgmb.bdimg.com") >= 0 ||
            domain.match(/timg.*?\.baidu\.com/)) {
            // https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1490961932774&di=65b21e6bef59bf6b1f6e71f18f46008c&imgtype=0&src=http%3A%2F%2Fqcloud.dpfile.com%2Fpc%2FqqYXMqI9j2MqLzJ3hKYFqx6407skBHDx-gKkvyfBaUcZWk8eZQMRW2FeuVD9x_wbTYGVDmosZWTLal1WbWRW3A.jpg
            //   http://qcloud.dpfile.com/pc/qqYXMqI9j2MqLzJ3hKYFqx6407skBHDx-gKkvyfBaUcZWk8eZQMRW2FeuVD9x_wbTYGVDmosZWTLal1WbWRW3A.jpg
            return decodeURIComponent(src.replace(/.*\/[^/]*[?&]src=([^/&]*).*/, "$1"));
        }

        // p2.xiaohx.net
        if (domain.search(/p[0-9]*\.xiaohx\.net/) >= 0) {
            return src.replace("/thumb/", "/");
        }

        // img1.doubanio.com
        if (domain.search(/img[0-9]\.doubanio\.com/) >= 0) {
            // https://img3.doubanio.com/lpic/s26811681.jpg
            //   https://img3.doubanio.com/opic/s26811681.jpg
            // https://img3.doubanio.com/img/musician/small/24961.jpg
            //   https://img3.doubanio.com/img/musician/large/24961.jpg
            return src
                .replace(/\/(?:small|medium)\//, "/large/")
                .replace(/\/.pic\//, "/opic/");
        }

        if (domain.search(/img\.idol001\.com/) >= 0) {
            return src.replace(/^(.*?idol001\.com\/)[^/]*\//, "$1origin/");
        }

        // for media.nrj.fr
        // http://media.nrj.fr/1900x1200/2017/11/selena-gomez-et-ariana-grande_7134.jpg
        // http://media.nrj.fr/800x600/2017/12/cover-ariana-grande-jpg5981_1375899.jpg
        // http://media.nrj.fr/436x327/113-jpg_200414.jpg
        // http://media.nrj.fr/1400x1400/2017/09/guillaume-radio-podcasts-_388327.jpg
        // http://media.nrj.fr/360x270/2017/07/julien-dore_5171.jpg
        // http://media.nrj.fr/300x500/2015/08/11907170-1042189502503923-8150073793944711126-n-jpg-9164253.jpg
        // http://media.nrj.fr/160x120/2014/10/logodjbuzz-3159-1111-8790_8361.jpg
        // http://media.nrj.fr/manu69/2017/06/fugitif-paris-2.jpg
        // http://media.nrj.fr/217x326/2013/05/the-big-bang-theory-penny_9252.jpg
        // http://media.nrj.fr/200x150/2017/01/cover-kanye-west-jpg638_1351247.jpg
        // http://image-api.nrj.fr/02_5a02579e3cb49.png?w=730&h=410
        //   http://image-api.nrj.fr/02_5a02579e3cb49.png
        // http://image-api.nrj.fr/une-chance-sur-deux_5a7ad778514a1.jpg
        // http://image-api.nrj.fr/6-jobs-etudiants-qui-recrutent-en-periode-de-fetes-istock-519555835_584fb5cc450ec.jpg
        // http://players.nrjaudio.fm/live-metadata/player/img/600x/196622-202066.JPG
        // http://www.nrj.fr/img/nrjactive/orientation/motivations/relever_des_defis.jpg
        // http://cdn.nrj-platform.fr/uploads/pages/58c59bc78b042_capture-d-cran-2017-03-12--20-03-22.jpg
        // while it can be downscaled, it can't be upscaled, can't find any other pattern
        if (domain.indexOf("image-api.nrj.fr") >= 0 &&
            src.indexOf("/http/") >= 0) {
            // http://image-api.nrj.fr/http/players.nrjaudio.fm%2Flive-metadata%2Fplayer%2Fimg%2Fplayer-files%2Fnrj%2Flogos%2F640x640%2FP_logo_NRJ_wr_La_Playlist_du_jeudi_New.png?w=360&h=360
            //   http://players.nrjaudio.fm/live-metadata/player/img/player-files/nrj/logos/640x640/P_logo_NRJ_wr_La_Playlist_du_jeudi_New.png
            return "http://" + decodeURIComponent(src.replace(/.*\.nrj\.fr\/http\/([^/?&]*).*/, "$1"));
        }

        if (domain.indexOf("norwalkreflector.com") >= 0 &&
            src.indexOf("/image/") >= 0) {
            return src.replace(/(\/image\/[0-9]*\/[0-9]*\/[0-9]*\/)[^/]*\/([^/]+)$/, "$1$2");
        }

        if (domain.indexOf("assets.bwbx.io") >= 0) {
            return src.replace(/\/[0-9]*x(-[0-9]*\.[^/]*)$/, "/-1x$1");
        }

        if (domain.indexOf("file.osen.co.kr") >= 0) {
            // http://file.osen.co.kr/article_thumb/2018/01/25/201801251451774572_5a6975efc76bc_120x68.jpg
            //   http://file.osen.co.kr/article/2018/01/25/201801251451774572_5a6975efc76bc.jpg
            return src.replace("/article_thumb/", "/article/").replace(/_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf("thumbnews.nateimg.co.kr") >= 0) {
            // http://thumbnews.nateimg.co.kr/news130/http://news.nateimg.co.kr/orgImg/nn/2018/03/30/201803302311296710_1.jpg
            // http://thumbnews.nateimg.co.kr/mnews105/http://news.nateimg.co.kr/orgImg/dh/2018/03/30/b38bab99257a78968bceed1266895c20.jpg
            return src.replace(/.*\/(?:view|m?news)[0-9]*\//, "");
        }

        if (domain === "thumb.pann.com") {
            // http://thumb.pann.com/tc_100x75/http://fimg4.pann.com/new/download.jsp?FileID=45339728
            //   http://fimg4.pann.com/new/download.jsp?FileID=45339728
            return src.replace(/^[a-z]+:\/\/[^/]*\/[^/]*\//, "");
        }

        if (domain.indexOf(".video.nate.com") >= 0) {
            // http://mpmedia003.video.nate.com/img/thumb/75_57/006/76/00/0F/B_20180413100402594366711006.jpg
            //   http://mpmedia003.video.nate.com/img/006/76/00/0F/B_20180413100402594366711006.jpg
            return src.replace(/\/img\/thumb\/[0-9]+[^/]*\//, "/img/");
        }

        if (domain.indexOf("img.sedaily.com") >= 0 && false) {
            // http://www.sedaily.com/Photo/Gallery/Viewer/2154#48592
            //   http://img.sedaily.com/Photo/Gallery/2018/05/2154_b.jpg
            //     http://img.sedaily.com/Photo/Gallery/2018/05/2154.jpg -- completely different picture
            //   http://img.sedaily.com/Photo/Unit/2018/05/48592_s.jpg
            //     http://img.sedaily.com/Photo/Unit/2018/05/48592.jpg -- proper
            // http://img.sedaily.com/Photo/Gallery/2018/05/2149_b.jpg
            //   http://img.sedaily.com/Photo/Gallery/2018/05/2149.jpg -- works
            //   http://img.sedaily.com/Photo/Unit/2018/05/48368.jpg -- same
            // http://newsimg.sedaily.com/2018/05/20/1RZLV7PG9Q_2_m.jpg
            //   http://newsimg.sedaily.com/2018/05/20/1RZLV7PG9Q_2.jpg
            return src.replace(/(\/[0-9]*)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "stat.ameba.jp" ||
            domain === "stat.profile.ameba.jp") {
            return src.replace(/\/t[0-9]*_([^/]*)$/, "/o$1");
        }

        //if (domain === "livedoor.blogimg.jp") {
        if (domain.indexOf(".blogimg.jp") >= 0 ||
            // http://image.news.livedoor.com/newsimage/stf/5/6/5634f_249_20180424039-m.jpg
            //   http://image.news.livedoor.com/newsimage/stf/5/6/5634f_249_20180424039.jpg
            domain === "image.news.livedoor.com") {
            // http://lineofficial.blogimg.jp/en/imgs/c/5/c5832999-s.png
            //   http://lineofficial.blogimg.jp/en/imgs/c/5/c5832999.png
            return src.replace(/(\/[^/.]*)-[^/.]*(\.[^/.]*)/, "$1$2");
        }

        if (domain === "image.cine21.com") {
            // http://image.cine21.com/resize/IMGDB/people/2004/0504/large/105535_spe45[H800-].jpg?H300
            //   http://image.cine21.com/IMGDB/people/2004/0504/large/105535_spe45.jpg
            // http://image.cine21.com/resize/cine21/still/2017/1213/11_39_08__5a3092cc9f638[X50,60].jpg
            //   http://image.cine21.com/cine21/still/2017/1213/11_39_08__5a3092cc9f638.jpg
            // http://image.cine21.com/resize/cine21/poster/2005/0603/M0010044_1[F230,329].jpg
            //   http://image.cine21.com/cine21/poster/2005/0603/M0010044_1.jpg
            return src
                .replace("/resize/", "/")
                .replace(/\/(?:small|medium)(\/[^/]*)$/, "/large$1")
                .replace(/\?.*$/, "")
                .replace(/\[[WH][-0-9]*\](\.[^/.]*)$/, "$1")
                .replace(/\[[XF][0-9]+,[0-9]+\](\.[^/.]*)$/, "$1");
        }

        if (domain === "cdnimg.melon.co.kr" ||
            domain === "cmtimg.melon.co.kr"/* &&
            (src.indexOf("/images/") >= 0 ||
             src.indexOf("/image/") >= 0 ||
             src.indexOf("/user_images/") >= 0)*/) {
            // http://cdnimg.melon.co.kr/svc/user_images/plylst/2016/12/21/56/425022806_org.jpg?tm=20171210105300/melon/resize/x262/quality/100/optimize
            //   http://cdnimg.melon.co.kr/svc/user_images/plylst/2016/12/21/56/425022806_org.jpg
            // http://cdnimg.melon.co.kr/cm/album/images/003/74/978/374978_500.jpg/melon/resize/120/quality/80/optimize
            //   http://cdnimg.melon.co.kr/cm/album/images/003/74/978/374978_org.jpg
            // http://cdnimg.melon.co.kr/cm/artistcrop/images/006/72/337/672337_500.jpg?f88c5a23497a77f68d8ac296e218db02/melon/resize/416/quality/80/optimize
            //   http://cdnimg.melon.co.kr/cm/artistcrop/images/006/72/337/672337_org.jpg
            // http://cdnimg.melon.co.kr/cm/artistcrop/images/010/24/317/1024317_500.jpg

            // http://cdnimg.melon.co.kr/cm/mv/images/43/501/78/990/50178990_1_640.jpg/melon/quality/80/resize/144/optimize
            //   http://cdnimg.melon.co.kr/cm/mv/images/43/501/78/990/50178990_1_org.jpg

            // http://cdnimg.melon.co.kr/svc/images/main/imgUrl20180123110250.jpg/melon/quality/80
            //   http://cdnimg.melon.co.kr/svc/images/main/imgUrl20180123110250.jpg

            // http://cdnimg.melon.co.kr/resource/mobile40/cds/event/image/201711/mixnine/artist/079.jpg/melon/quality/80/resize/134/optimize

            // http://cmtimg.melon.co.kr/20180331/542/52/233808_0483.png/melon/resize/192x192/quality/80/optimize
            newsrc = src.replace(/(\.[a-zA-Z]+)\/melon\/.*/, "$1");
            if (newsrc !== src)
                return newsrc;

            if (src.indexOf("/images/main/") >= 0) {
                return src.replace(/(images\/.*\/[^/_]*)((_[^/.]*)_)?(_?[^/._]*)?(\.[^/.?]*)(?:[?/].*)?$/, "$1$3$5");
            } else {
                return src.replace(/(images\/.*\/[^/_]*)((_[^/.]*)_)?(_?[^/._]*)?(\.[^/.?]*)(?:[?/].*)?$/, "$1$3_org$5");
            }
        }

        // itunes, is4-ssl.mzstatic.com
        if (domain.match(/is[0-9](-ssl)?\.mzstatic\.com/) &&
            src.indexOf("/image/thumb/") >= 0) {
            // https://is3-ssl.mzstatic.com/image/thumb/Music111/v4/e1/dc/68/e1dc6808-6d55-1e38-a34d-a3807d488859/191061355977.jpg/1200x630bb.jpg
            // http://is4.mzstatic.com/image/thumb/Music6/v4/4e/92/37/4e923792-948a-ae3a-dc5b-b7416c23807a/source/165x165bb.jpg
            // http://a3.mzstatic.com/us/r30/Video/v4/3e/8a/b0/3e8ab028-45f5-a0dd-6a6f-84daf9f93a11/101_Dalmatians_E-Distribution_Standard_Electronic_Apple_Taiwan.jpg
            // https://s1.mzstatic.com/eu/r30/Purple71/v4/a6/be/93/a6be93ed-e301-5e91-68c2-2c5df31a4b8a/sc2732x2048.jpeg
            // http://is5.mzstatic.com/image/thumb/Music62/v4/0b/1f/36/0b1f364c-cc8f-1c8c-74a4-70cfb01d8ef4/source/100000x100000-999.jpg
            return src.replace(/\/[0-9]*x[0-9]*[a-z]*(?:-[0-9]+)?(\.[^/.]*)$/, "/999999999x0w$1");
        }

        if (//domain.match(/sc[0-9]*\.alicdn\.com/) ||
            domain.match(/[0-9]*\.alicdn\.com/) ||
            domain === "img.alicdn.com") {
            // https://ae01.alicdn.com/kf/HTB1AMo8a4uaVKJjSZFjq6AjmpXai/BINYEAE-new-CD-seal-State-of-Grace-Paul-Schwartz-Lisbeth-Scott-CD-disc-free-shipping.jpg_640x640.jpg
            //   https://ae01.alicdn.com/kf/HTB1AMo8a4uaVKJjSZFjq6AjmpXai/BINYEAE-new-CD-seal-State-of-Grace-Paul-Schwartz-Lisbeth-Scott-CD-disc-free-shipping.jpg
            // https://ae01.alicdn.com/kf/HT1N7knFG0dXXagOFbXQ/220255879/HT1N7knFG0dXXagOFbXQ.jpg?size=209686&height=1472&width=970&hash=b068627a285860c5226596bada694403
            //   https://ae01.alicdn.com/kf/HT1N7knFG0dXXagOFbXQ/220255879/HT1N7knFG0dXXagOFbXQ.jpg
            return src
                .replace(/_[0-9]+x[0-9]+[^/]*?$/, "")
                .replace(/\?.*/, "");
        }

        if (domain === "thumbor.forbes.com") {
            return decodeURIComponent(src.replace(/.*\/([^/]*%3A%2F%2F[^/]*).*/, "$1"));
        }

        if (domain === "lastfm-img2.akamaized.net") {
            return src.replace(/\/i\/u\/[^/]*\//, "/i/u/");
        }

        if (domain.match(/a[0-9]-images\.myspacecdn\.com/)) {
            return src.replace(/\/[^/.]*(\.[^/.]*)$/, "/full$1");
        }

        // https://geo-media.beatport.com/image_size/250x250/e6997bab-e115-41b2-acab-3cae7bcf3615.jpg
        if (domain === "geo-media.beatport.com") {
            return src.replace(/\/image_size\/[0-9]*x[0-9]*\//, "/image_size/0x0/");
        }

        if (domain.indexOf("media.tumblr.com") > 0) {
            // some gifs don't play properly (same case with raw?)
            // handle this?
            // https://78.media.tumblr.com/25e643db76a1e626ff4e79faa2f7bb3d/tumblr_inline_mvspvogcB51sq8rci.jpg
            // https://static.tumblr.com/2074b5c013a08663cbfe4f86f54aad99/b70lpcc/m9Vnkyvyw/tumblr_static_d04dkibmyqokwgwsgcwggkowg.jpg
            // https://static.tumblr.com/978c2da2706d61fcdc5a13083a05c70c/yffueik/n9Znvprsi/tumblr_static_bp7fdwcxpbwc8k440ksocks8c.png
            // https://static.tumblr.com/rpaguup/J6wmdtouh/tumblr_mdipupjoku1r2xx88o1_500.png
            //   http://data.tumblr.com/rpaguup/J6wmdtouh/tumblr_mdipupjoku1r2xx88o1_raw.png -- doesn't work
            // http://media.tumblr.com/tumblr_m94wh56woC1ro0opg.png
            // http://media.tumblr.com/bbeec3764efd6b63c14fe1e56f4f5b22/tumblr_inline_mn9bgayRCZ1qz4rgp.png
            // http://media.tumblr.com/cd90bd6fe3989956567f086153430e4c/tumblr_inline_mimvhtpoYw1qz4rgp.gif
            // https://78.media.tumblr.com/tumblr_m2p6yiRZNR1qha0cy.gif
            // http://media.tumblr.com/tumblr_mah067upzv1rtyo86.gif
            // https://static.tumblr.com/ae53741763a8e9a937e587fd71c24ee5/065fclu/Okon9yxx0/tumblr_static_filename_640_v2.jpg
            // https://static.tumblr.com/9d9cb03d00947212897f5fa390615bb1/szhmsgg/PW8ok7jgi/tumblr_static_tumblr_static__640.jpg
            // https://static.tumblr.com/9873073729f37d9fb36dce1576f1f3ee/gtqzlnb/34Ync89wm/tumblr_static_tumblr_static_79qnyyc3l2os0c84swcswowks_640.gif
            //
            // working gifs:
            // https://78.media.tumblr.com/4b9573a2fdd97a6e6cac771d4a0c0edd/tumblr_ntg9jreu9X1s5q5l6o4_400.gif
            //   http://data.tumblr.com/4b9573a2fdd97a6e6cac771d4a0c0edd/tumblr_ntg9jreu9X1s5q5l6o4_raw.gif
            // https://78.media.tumblr.com/e7976904bb598ed701324ee471056156/tumblr_ntg9jreu9X1s5q5l6o3_400.gif
            //   http://data.tumblr.com/e7976904bb598ed701324ee471056156/tumblr_ntg9jreu9X1s5q5l6o3_raw.gif
            // https://78.media.tumblr.com/2d799573226814e336e0984263269507/tumblr_nwe2hfH0dX1u9vqklo1_250.gif
            //   https://s3.amazonaws.com/data.tumblr.com/2d799573226814e336e0984263269507/tumblr_nwe2hfH0dX1u9vqklo1_raw.gif
            // https://78.media.tumblr.com/tumblr_lyqq4hsfo01qdphnvo1_500.gif
            //   https://78.media.tumblr.com/tumblr_lyqq4hsfo01qdphnvo1_1280.gif
            //
            // semi-working gifs: (thanks to rEnr3n on github)
            // https://78.media.tumblr.com/b6a2ed8abae3e9f0a64ccc5bd14b5bbf/tumblr_n8w8k50vpR1r3kk98o1_250.gif -- works
            //
            // https://78.media.tumblr.com/a1dfad9537af0e38063ec186e2ff392e/tumblr_n87ft44o4Y1r3kk98o1_250.gif -- works
            //   https://78.media.tumblr.com/a1dfad9537af0e38063ec186e2ff392e/tumblr_n87ft44o4Y1r3kk98o1_500.gif -- doesn't work
            //   https://78.media.tumblr.com/a1dfad9537af0e38063ec186e2ff392e/tumblr_n87ft44o4Y1r3kk98o1_1280.gif -- doesn't work
            //   https://s3.amazonaws.com/data.tumblr.com/a1dfad9537af0e38063ec186e2ff392e/tumblr_n87ft44o4Y1r3kk98o1_raw.gif -- works
            // https://78.media.tumblr.com/b6a2ed8abae3e9f0a64ccc5bd14b5bbf/tumblr_n8w8k50vpR1r3kk98o1_250.gif
            //
            // non-working gifs: (all sizes don't work, except for _raw, credit to rEnr3n again for finding these)
            // https://78.media.tumblr.com/102fca5704db6aa1cc5e56ed7d9aa369/tumblr_n5ltfvGJC51r3kk98o1_250.gif
            //   https://s3.amazonaws.com/data.tumblr.com/102fca5704db6aa1cc5e56ed7d9aa369/tumblr_n5ltfvGJC51r3kk98o1_raw.gif -- works
            // https://78.media.tumblr.com/257cce1bd6ec64e56b1c55129ddc547d/tumblr_n5lbkmnp5g1r3kk98o1_250.gif
            //   https://s3.amazonaws.com/data.tumblr.com/257cce1bd6ec64e56b1c55129ddc547d/tumblr_n5lbkmnp5g1r3kk98o1_raw.gif -- works
            if (src.match(/:\/\/[^/]*\/[0-9a-f]*\/[^/]*$/)) {
                // https://78.media.tumblr.com/3ebf4c3e175553194b3c9a0867a47719/tumblr_nugefiK7yj1u0c780o1_500.jpg
                //   http://data.tumblr.com/3ebf4c3e175553194b3c9a0867a47719/tumblr_nugefiK7yj1u0c780o1_raw.jpg
                // https://78.media.tumblr.com/96a4d0ab5a1e05ecc6f3eb638a5504a5/tumblr_oxin3qLmFS1spqhdqo7_500.jpg
                //   http://data.tumblr.com/96a4d0ab5a1e05ecc6f3eb638a5504a5/tumblr_oxin3qLmFS1spqhdqo7_raw.jpg -- width of 1400 (vs 1280)
                return src
                    .replace(/:\/\/[^/]*\/(.*)_[0-9]*(\.[^/.]*)$/, "://s3.amazonaws.com/data.tumblr.com/$1_raw$2");
            } else if (src.match(/:\/\/[^/]*\/[^/]*$/)) {
                // https://78.media.tumblr.com/tumblr_m4fhyoiFd51rqmd7mo1_500.jpg
                //   https://78.media.tumblr.com/tumblr_m4fhyoiFd51rqmd7mo1_1280.jpg
                if (!src.match(/_[0-9]*\.gif$/) || true) // disable check for now, unless something is found
                    return src.replace(/_[0-9]*(\.[^/.]*)$/, "_1280$1");
            }
        }

        if (domain === "s.booth.pm") {
            return src.replace(/\/c\/[^/]*\//, "/").replace(/(\/[^/.]*)_c_[0-9]+x[0-9]+(\.[^/.]*$)/, "$1$2");
        }

        if (domain === "wc-ahba9see.c.sakurastorage.jp" &&
            src.indexOf("/max-1200/") >= 0) {
            return src.replace(/-[0-9a-z]+(\.[^/.]*)$/, "-1200$1");
        }

        if (domain === "www.nautiljon.com" &&
            src.match(/\/images[a-z]*\//)) {
            // https://www.nautiljon.com/imagesmin/anime/00/48/kuroko_no_basket_2184.jpg?1517340247
            //   https://www.nautiljon.com/images/anime/00/48/kuroko_no_basket_2184.jpg?1517340247
            // https://www.nautiljon.com/images/86x86/people/00/51/il_hoon_btob_33715.jpg?1520059769
            //   https://www.nautiljon.com/images/people/00/51/il_hoon_btob_33715.jpg?1520059769
            // https://www.nautiljon.com/images/actualite/00/68/medium/1525681783131_image.jpg -- 177x250
            //   https://www.nautiljon.com/images/actualite/00/68/large/1525681783131_image.jpg -- 638x900
            //   https://www.nautiljon.com/images/actualite/00/68/1525681783131_image.jpg -- 680x960
            return src
                .replace(/\/imagesmin\//, "/images/")
                .replace(/\/images\/[0-9]+x[0-9]+\//, "/images/")
                .replace(/\/mini\/([^/]*)$/, "/$1")
                .replace(/(\/[0-9]+\/[0-9]+\/)[a-z]+\/([^/]*)$/, "$1$2");
        }

        // wall street journal:
        // A, C, D, (E,F), G, H, P, J, M
        // https://s.wsj.net/public/resources/images/BN-WV466_rotiss_A_20180103172646.jpg
        // https://s.wsj.net/public/resources/images/BN-WV466_rotiss_C_20180103172646.jpg
        // https://s.wsj.net/public/resources/images/BN-WV466_rotiss_D_20180103172646.jpg
        // https://s.wsj.net/public/resources/images/BN-WV466_rotiss_G_20180103172646.jpg
        // https://s.wsj.net/public/resources/images/BN-WV466_rotiss_M_20180103172646.jpg
        //
        // https://s.wsj.net/public/resources/images/BN-WV815_3m8WN_M_20180104143735.jpg
        // https://si.wsj.net/public/resources/images/BN-WV794_apples_M_20180104140237.jpg (s.wsj.net works too)
        //
        // doesn't support J or M:
        //
        // A, C, D, E, F, G, P
        // https://s.wsj.net/public/resources/images/OB-YL084_KoreaC_G_20130805214258.jpg
        // https://s.wsj.net/public/resources/images/OB-YL082_KoreaC_P_20130805213748.jpg
        //
        // so far it seems that P is the largest common one, but M can be larger. maybe date has something to do with it?
        //
        // other:
        // https://si.wsj.net/public/resources/images/BN-WW013_0105KO_Z120_20180104213322.jpg
        // Z120 works with "newer" urls, but not with older ones (Z0, Z100, etc. don't work)
        //
        // https://art.wsj.net/api/photos/gams-files/BN-WV826_3fHQP_A_20180104144705.jpg?width=110&height=73
        // https://s.wsj.net/public/resources/images/BN-WV826_3fHQP_A_20180104144705.jpg
        // width=0&height=0 returns a 1x1, same for width=-1&height=-1. width=8000&height=8000 results in a zoomed in image (but rather high quality nonetheless)
        // https://art.wsj.net/api/photos/gams-files/BN-WV826_3fHQP_A_20180104144705.jpg (invalid, since it requires parameters) results in:
        // {"message":"No HTTP resource was found that matches the request URI 'http://art.wsj.net/api/photos/gams-id:3fHQP/smartcrop?crophint=A'.","messageDetail":"No action was found on the controller 'PhotoApi' that matches the request."}
        // http://art.wsj.net/api/photos/gams-id:3fHQP/smartcrop
        // {"message":"No HTTP resource was found that matches the request URI 'http://art.wsj.net/api/photos/gams-id:3fHQP/smartcrop'.","messageDetail":"No action was found on the controller 'PhotoApi' that matches the request."}
        // http://art.wsj.net/api/photos/gams-id:3fHQP - works!
        //
        // https://art.wsj.net/api/photos/gams-files/BN-WV815_3m8WN_A_20180104143735.jpg?width=110&height=61
        // https://art.wsj.net/api/photos/gams-id:3m8WN
        //
        // id is base62 using 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ as the alphabet
        //
        // most don't work with this though
        //
        // https://si.wsj.net/public/resources/images/BN-KS721_GerryB_AM_20151013072049.jpg
        // M doesn't work, but P does (conversely, AM doesn't work with some old images, but seems to work with newer ones)
        // https://si.wsj.net/public/resources/images/BN-WV959_SYRDET_ER_20180104172634.jpg
        // https://s.wsj.net/public/resources/images/BN-WU361_SZA_01_D_20171229145931.jpg

        if (domain === "art.wsj.net") {
            if (src.indexOf("/api/photos/gams-files/") >= 0) {
                return src.replace(/\/gams-files\/[^-_/.]*-[^-_/.]*_([^/_.]*)_.*$/, "/gams-id:$1");
            }

            if (src.indexOf("/api/photos/gams-id:") >= 0) {
                return src.replace(/(\/gams-id:[^/]*)\/.*$/, "$1");
            }
        }

        if (domain.match(/images[0-9]*\.fanpop\.com/)) {
            // http://images6.fanpop.com/image/photos/33100000/Zetsuen-No-Tempest-zetsuen-no-tempest-33126825-2048-2970.jpg
            //   http://images6.fanpop.com/image/photos/33100000/Zetsuen-No-Tempest-zetsuen-no-tempest-33126825.jpg
            // http://images1.fanpop.com/images/image_uploads/cf-calista-flockhart-912712_525_700.jpg
            // http://images.fanpop.com/images/image_uploads/Emma-Watson--emma-watson-95242_500_400.jpg
            // http://images6.fanpop.com/image/answers/3197000/3197239_1364966408102.53res_426_300.jpg
            //
            // http://images6.fanpop.com/image/photos/38000000/Zayn-Malik-2015-one-direction-38049270-2121-2500.jpg
            //   http://images6.fanpop.com/image/photos/38000000/Zayn-Malik-2015-one-direction-38049270.jpg - doesn't work
            return src
                .replace(/([0-9]+)-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1$2")
                .replace(/([0-9]+)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        // https://image.jimcdn.com/app/cms/image/transf/dimension=299x10000:format=png/path/s07f3459425dd27f2/image/i23aaf7ddb2a0e16d/version/1471508912/image.png
        // https://image.jimcdn.com/app/cms/image/transf/none/path/s07f3459425dd27f2/image/i23aaf7ddb2a0e16d/version/1471508912/image.png
        // https://github.com/thumbor/thumbor/issues/564
        if (domain.indexOf(".jimcdn.com") >= 0) {
            return src.replace(/(\/app\/cms\/image\/transf\/)[^/]*\//, "$1none/");
        }

        if (domain.match(/resize[0-9]*-[a-z]*\.ladmedia\.fr/)) {
            // http://resize-parismatch.ladmedia.fr/r/625,417,center-middle,ffffff/img/var/news/storage/images/paris-match/people/meurtre-du-cousin-de-rihanna-un-suspect-en-detention-provisoire-1432127/23594795-1-fre-FR/Meurtre-du-cousin-de-Rihanna-un-suspect-en-detention-provisoire.jpg
            // http://resize1-parismatch.ladmedia.fr/r/300,300,center-middle,ffffff/img/var/news/storage/images/paris-match/people-a-z/rihanna/5971706-8-fre-FR/Rihanna.jpg
            // http://resize1-doctissimo.ladmedia.fr/r/1010,,forcex/img/var/doctissimo/storage/images/fr/www/beaute/diaporamas/coiffure-de-star-coiffures-de-stars/coiffure-ciara/2440196-1-fre-FR/Le-Tie-Dye-rate-de-Ciara.jpg
            // https://resize-public.ladmedia.fr/rcrop/140,104/img/var/public/storage/images/toutes-les-photos/photos-emilie-nef-naf-torride-en-tout-petit-bikini-wahiba-ribery-sous-le-choc-1469251/38549175-1-fre-FR/Photos-Emilie-Nef-Naf-torride-en-tout-petit-bikini-Wahiba-Ribery-sous-le-choc-!.jpg
            //   https://resize-public.ladmedia.fr/img/var/public/storage/images/toutes-les-photos/photos-emilie-nef-naf-torride-en-tout-petit-bikini-wahiba-ribery-sous-le-choc-1469251/38549175-1-fre-FR/Photos-Emilie-Nef-Naf-torride-en-tout-petit-bikini-Wahiba-Ribery-sous-le-choc-!.jpg
            return src.replace(/\/r(?:crop)?\/[^/]*\//, "/");
        }

        if (domain.match(/thumbs[0-9]*\.imgbox\.com/) ||
            domain.match(/images[0-9]*\.imgbox\.com/)) {
            // https://thumbs2.imgbox.com/6b/e7/rklghXlY_t.jpg
            //   https://images2.imgbox.com/6b/e7/rklghXlY_o.jpg
            // https://thumbs3.imgbox.com/63/1b/bUg59AO0_b.jpg
            //   https://images3.imgbox.com/63/1b/bUg59AO0_o.jpg
            // https://5-t.imgbox.com/H8mh6PYR.jpg
            //   https://thumbs3.imgbox.com/a5/e8/H8mh6PYR_t.jpg
            //   https://images3.imgbox.com/a5/e8/H8mh6PYR_o.jpg
            // https://1-t.imgbox.com/Q3x3sr3Z.jpg
            //   https://thumbs3.imgbox.com/9d/37/Q3x3sr3Z_t.jpg
            //   https://images3.imgbox.com/9d/37/Q3x3sr3Z_o.jpg
            return src
                .replace(/\/thumbs([0-9]*)\.imgbox\.com\//, "/images$1.imgbox.com/")
                .replace(/_[a-z]*(\.[^/.]*)/, "_o$1");
        }

        if (domain.match(/cdn\.[^.]*\.steamstatic\.com/) ||
            // https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/2c/2c43030ea4900ebfcd3c42a4e665e9d926b488ef_medium.jpg
            //   https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/2c/2c43030ea4900ebfcd3c42a4e665e9d926b488ef_full.jpg
            domain.match(/steamcdn(?:-[a-z]*)?\.akamaihd\.net/)) {
            // http://cdn.edgecast.steamstatic.com/steam/apps/405710/ss_8555059322d118b6665f1ddde6eaa987c54b2f31.600x338.jpg?t=1516755673
            //   http://cdn.edgecast.steamstatic.com/steam/apps/405710/ss_8555059322d118b6665f1ddde6eaa987c54b2f31.jpg?t=1516755673
            // http://cdn.akamai.steamstatic.com/steam/apps/678950/ss_cd54f0430e919020ce554f6cfa8d2f3b0d062716.600x338.jpg
            //   http://cdn.akamai.steamstatic.com/steam/apps/678950/ss_cd54f0430e919020ce554f6cfa8d2f3b0d062716.jpg
            // http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/c4/c44ec2d22a0c379d697c66b05e5ca8204827ce75.jpg
            //   http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/c4/c44ec2d22a0c379d697c66b05e5ca8204827ce75_full.jpg
            if (src.indexOf("/public/images/avatars/") >= 0) {
                src = src.replace(/(?:_[^/.]*)?(\.[^/.]*)$/, "_full$1");
            }
            return src.replace(/\.[0-9]+x[0-9]+(\.[^/]*)$/, "$1");
        }

        if (domain.match(/cdn-images-[0-9]*\.medium\.com/)) {
            // https://cdn-images-1.medium.com/fit/c/120/120/1*EBmQkTlD1aZEsZOHFiBcdg.png
            //   https://cdn-images-1.medium.com/1*EBmQkTlD1aZEsZOHFiBcdg.png
            // https://cdn-images-1.medium.com/max/800/1*BvC8Rvz4L-CLuK5Ou37qoA.png
            //   https://cdn-images-1.medium.com/1*BvC8Rvz4L-CLuK5Ou37qoA.png
            //return src.replace(/\/max\/[^/]*\//, "/");
            return src.replace(/(:\/\/[^/]*\/).*?\/([^/]*)$/, "$1$2");
        }

        if (domain === "image.kpopstarz.com") {
            return src.replace(/\/thumbs\/full\/([^/]*)\/[^/]*\/[^/]*\/[^/]*\/[^/]*\/([^/]*)$/, "/thumbs/full/$1/999999/0/0/0/$2");
        }

        if (domain.match(/www[0-9]*\.pictures\.(.*\.)?zimbio\.com/) ||
            domain.match(/www[0-9]*\.pictures\.(.*\.)?stylebistro\.com/) ||
            // http://www4.pictures.livingly.com/gi/2014+Victoria+Secret+Fashion+Show+After+Party+JZONjIPnPNLl.jpg
            domain.match(/www[0-9]*\.pictures\.(.*\.)?livingly\.com/)) {
            // http://www4.pictures.zimbio.com/bg/Calista+Flockhart+2001+SAG+Awards+FuUveoCUR9_l.jpg
            // http://www4.pictures.stylebistro.com/gi/HeEXH_STdIGx.jpg
            // http://www1.pictures.gi.zimbio.com/Katy+Perry+NRJ+Music+Awards+2009+uA-QnAhT6Wul.jpg
            // http://www3.pictures.fp.zimbio.com/Emma+Watson+Celebs+Set+Harry+Potter+Deathly+T2P80JadJBDl.jpg
            // x, l, m, p, s, c, t
            return src.replace(/[a-z](\.[^/.]*)$/, "x$1");
        }

        if (domain_nowww === "theplace2.ru" ||
            domain === "img.star.iecity.com") {
            // https://www.theplace2.ru/archive/calista_flockhart/img/calista611924_s.jpg
            //   https://www.theplace2.ru/archive/calista_flockhart/img/calista611924.jpg
            // http://img.star.iecity.com/Upload/File/201707/29/20170729202504241_s.jpg
            newsrc = src.replace(/_[a-z](\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "theplace2.ru") {
            // https://www.theplace2.ru/cache/archive/rihanna/img/488408753_10-gthumb-gwdata1200-ghdata1200-gfitdatamax.jpg
            //   https://www.theplace2.ru/archive/rihanna/img/488408753_10.jpg
            return src.replace(/(:\/\/[^/]*\/)cache\/(.*?)-[^/.]*(\.[^/.]*)/, "$1$2$3");
        }

        if (domain.match(/cdn[0-9]*-www\.craveonline\.com/) ||
            // http://cdn2-www.dogtime.com/assets/uploads/gallery/shih-tzu-dog-breed-pictures/thumbs/thumbs_shih-tzu-breed-picture-6.jpg
            //   http://cdn2-www.dogtime.com/assets/uploads/gallery/shih-tzu-dog-breed-pictures/shih-tzu-breed-picture-6.jpg
            domain.match(/cdn[0-9]*-www\.dogtime\.com/)) {
            // http://cdn2-www.craveonline.com/assets/uploads/gallery/portia-de-rossi-has-arrested-development-mandatory/thumbs/thumbs_portiaderossihotpictures13.jpg
            return src.replace("/thumbs/thumbs_", "/");
        }

        if (domain.match(/img[0-9]*\.telestar\.fr/)) {
            // https://img1.telestar.fr/var/telestar/storage/images/2/9/0/290401/1732584-1/Calista-Flockhart-dans-la-serie-Ally-McBeal-en-1997_width1024.jpg
            //   https://img1.telestar.fr/var/telestar/storage/images/2/9/0/290401/1732584-1/Calista-Flockhart-dans-la-serie-Ally-McBeal-en-1997.jpg
            return src.replace(/_width[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain.match("static.tvgcdn.net")) {
            // http://static.tvgcdn.net/mediabin/galleries/shows/a_f/bq_bz/brothersandsisters/season3/smallcrops/brothers-sisters282sm.jpg
            //   http://static.tvgcdn.net/mediabin/galleries/shows/a_f/bq_bz/brothersandsisters/season3/brothers-sisters282.jpg
            // http://static.tvgcdn.net/mediabin/showcards/celebs/d-f/thumbs/felicity-jones_768x1024.png
            //   http://static.tvgcdn.net/mediabin/showcards/celebs/d-f/felicity-jones.png
            // return src.replace(/\/thumbs\/([^/.]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
            return src
                .replace("/smallcrops/", "/")
                .replace("/thumbs/", "/")
                .replace(/sm(\.[^/.]*)$/, "$1")
                .replace(/_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".blogcdn.com") >= 0) {
            // https://s.blogcdn.com/slideshows/images/slides/506/163/7/S5061637/slug/l/selena-gomez-visits-the-elvis-duran-z100-morning-show-1.jpg
            // http://www.blogcdn.com/slideshows/images/slides/289/321/4/S2893214/slug/l/2013-american-music-awards-arrivals-1.jpg
            // http://www.blogcdn.com/slideshows/images/slides/289/305/8/S2893058/slug/l/2014-mtv-video-music-awards-arrivals-1.jpg
            // https://www.blogcdn.com/slideshows/images/slides/851/019/S851019/s.jpg?1
            //   https://www.blogcdn.com/slideshows/images/slides/851/019/S851019/l.jpg?1
            // only found /slug/s and /slug/l so far, tried a-z
            return src
                .replace(/(\/S[0-9]+\/)[a-z](\.[^/.]*)$/, "$1l$2")
                .replace(/\/slug\/[a-z]\//, "/slug/l/");
        }

        if (domain === "photos.imageevent.com") {
            // https://photos.imageevent.com/afap/wallpapers/movies/soulsurfer/small/AnnaSophia%20Robb%20-%20Soul%20Surfer%20-9.jpg
            //   https://photos.imageevent.com/afap/wallpapers/movies/soulsurfer/large/AnnaSophia%20Robb%20-%20Soul%20Surfer%20-9.jpg
            // http://photos.imageevent.com/afap/wallpapers/stars/bellathorne/icons/Bella%20Thorne%20and%20Zendaya%20Coleman.jpg
            //   http://photos.imageevent.com/afap/wallpapers/stars/bellathorne/Bella%20Thorne%20and%20Zendaya%20Coleman.jpg
            return src.replace(/\/(?:small|large|huge|giant|icons)\/([^/]*)$/, "/$1");
        }

        if (domain === "image.ajunews.com") {
            // http://image.ajunews.com//content/image/2015/10/10/20151010181219457255_258_161.jpg
            //   http://image.ajunews.com//content/image/2015/10/10/20151010181219457255.jpg
            return src.replace(/_[0-9]*_[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.telegraph.co.uk" ||
            // https://secure.aws.telegraph.co.uk/content/dam/wellbeing/2016/12/28/graham5_trans_NvBQzQNjv4BqNyaloxhBNUSEitvcqmzeaNrVK9LoR4c_wZH1EhIay9c.jpg?imwidth=480
            domain.indexOf("aws.telegraph.co.uk") >= 0 ||
            domain === "subscriber.telegraph.co.uk") {
            // http://www.telegraph.co.uk/content/dam/men/2016/02/26/Headerraz-small_trans_NvBQzQNjv4BqqVzuuqpFlyLIwiB6NTmJwfSVWeZ_vEN7c6bHu2jJnT8.jpg
            //       http://www.telegraph.co.uk/content/dam/men/2016/02/26/Headerraz_trans_NvBQzQNjv4BqqVzuuqpFlyLIwiB6NTmJwfSVWeZ_vEN7c6bHu2jJnT8.jpg
            // http://www.telegraph.co.uk/content/dam/luxury/2018/01/17/018_MM4_9844-large_trans_NvBQzQNjv4BqeqwG1mMdY8c_ukC_8VAhqgb1Y9UHRh9-1rvsHveO7k8.JPG
            //       http://www.telegraph.co.uk/content/dam/luxury/2018/01/17/018_MM4_9844_trans_NvBQzQNjv4BqeqwG1mMdY8c_ukC_8VAhqgb1Y9UHRh9-1rvsHveO7k8.JPG
            // http://www.telegraph.co.uk/content/dam/Author%20photos/Martin%20byline-small.png
            //       http://www.telegraph.co.uk/content/dam/Author%20photos/Martin%20byline.png
            // http://www.telegraph.co.uk/content/dam/fashion/2016/10/11/110910109_ONLINE_USE_ONLY_ONE_USE_ONLY_MUST_CREDIT_Alexi_Lubomirski_-_Harpers__Bazaar_US__MUST_HOTLI_trans_NvBQzQNjv4BqqVzuuqpFlyLIwiB6NTmJwfSVWeZ_vEN7c6bHu2jJnT8.jpg
            // http://www.telegraph.co.uk/content/dam/Travel/Cruise/titanic-1997-film-still-ship-xlarge.jpg
            //        http://www.telegraph.co.uk/content/dam/Travel/Cruise/titanic-1997-film-still-ship.jpg
            //return src.replace(/(\/[^/-]*[^-_])-(?:x*(?:large|medium|small))(_[^/]*)?(\.[^/.]*$)$/, "$1$2$3");
            return src.replace(/-(?:x*(?:large|medium|small))(_[^/]*)?(\.[^/.]*$)$/, "$1$2");
        }

        if (domain === "i.telegraph.co.uk" ||
            domain === "secure.i.telegraph.co.uk") {
            // works:
            // http://i.telegraph.co.uk/multimedia/archive/03218/Hogwarts_3218917c.jpg
            // k, a, m, i, b, n, l, c, d, e, f, g, o, p, j, h
            // doesn't work:
            // http://i.telegraph.co.uk/multimedia/archive/02804/Felicity-Jones_2804773c.jpg
            // n, b, i, l, d, c, a, f, g, o, p, j, h
            // doesn't work:
            // https://secure.i.telegraph.co.uk/multimedia/archive/03443/London-Connections_3443046a.jpg
            //
            // https://i.telegraph.co.uk/multimedia/archive/03049/night-tube-full_3049237a.jpg
            //   https://i.telegraph.co.uk/multimedia/archive/03049/night-tube-full_3049237a.jpg - smaller
            //return src.replace(/[a-z](\.[^/.]*)$/, "k$1");
        }

        if (domain === "image.munhwa.com") {
            // http://image.munhwa.com/gen_thumb/201605/20160510MW162123225413_120.jpg
            //    http://image.munhwa.com/gen_news/201605/20160510MW162123225413_b.jpg
            // http://image.munhwa.com/gen_news/201708/2017081701032603000001_b.jpg
            // http://marathon.munhwa.com/munhwa_anyadmin/amboard/imgview.php?no=785&fno=23996&group=basic&code=gallery - very large
            //   http://marathon.munhwa.com/netizen/index02.php?sno=60&group=basic&code=gallery&category=&&abmode=view&no=23996&bsort=&bfsort=&PHPSESSID=91245c6b3debc2a851d802574460ea78 - article
            return src.replace("/gen_thumb/", "/gen_news/").replace(/_[^/._]*(\.[^/.]*$)/, "_b$1");
        }

        if (domain.indexOf(".dspmedia.co.kr") >= 0) {
            // http://kara.dspmedia.co.kr/data/file/karam41/thumb_125x215_100/1935537395_3AVlZGS5__YS_1284.jpg
            //   http://kara.dspmedia.co.kr/data/file/karam41/1935537395_3AVlZGS5__YS_1284.jpg
            return src.replace(/(\/file\/[^/]*\/)thumb_[0-9]*x[0-9]*[^/]*\//, "$1");
        }

        if (domain.indexOf("static.wixstatic.com") >= 0) {
            // https://static.wixstatic.com/media/c30de2_5bb577f8c9f949178994f77b47f5eb27~mv2_d_1500_2250_s_2.jpg/v1/fill/w_241,h_378,al_c,q_80,usm_0.66_1.00_0.01/c30de2_5bb577f8c9f949178994f77b47f5eb27~mv2_d_1500_2250_s_2.webp
            //   https://static.wixstatic.com/media/c30de2_5bb577f8c9f949178994f77b47f5eb27~mv2_d_1500_2250_s_2.jpg
            // http://static.wixstatic.com/media/140a90_5b3fa9eb4568eac9b3d5e79cf37525d0.jpg_512
            //   http://static.wixstatic.com/media/140a90_5b3fa9eb4568eac9b3d5e79cf37525d0.jpg
            // http://static.wixstatic.com/media/4bd5ee_8328e23583d647c8bbc36a50b9bdaa77.jpg_srz_162_288_85_22_0.50_1.20_0.00_jpg_srz
            //   http://static.wixstatic.com/media/4bd5ee_8328e23583d647c8bbc36a50b9bdaa77.jpg
            return src
                .replace(/(\.[^/.]*)\/v1\/.*/, "$1")
                .replace(/_[0-9.a-z]*$/, "");
        }

        if (domain.indexOf(".kukinews.com") >= 0 ||
            // http://kukinews.com/data/cache/public/photos/20180510/art_1525933651_125x105.jpg
            //   http://kukinews.com/data/photos/20180510/art_1525933651.jpg
            domain === "kukinews.com" ||
            domain === "www.inews365.com" ||
            // http://www.newsinstar.com/data/cache/public/photos/20180309/art_15200463472991_6c6a6f_90x60_c0.jpg
            //   http://www.newsinstar.com/data/photos/20180309/art_15200463472991_6c6a6f.jpg
            domain_nowww === "newsinstar.com" ||
            // http://www.artkoreatv.com/data/cache/public/photos/20180311/art_15209739753682_ce7de1_260x364_c0.jpg
            //   http://www.artkoreatv.com/data/photos/20180311/art_15209739753682_ce7de1.jpg
            domain === "www.artkoreatv.com" ||
            // http://www.ddaily.co.kr/data/cache/public/photos/cdn/20180205/art_1517533165_58x58.jpg
            domain === "www.ddaily.co.kr") {
            // http://www.inews365.com/data/cache/public/photos/20180205/art_15174759398393_648x365.jpg
            //   http://www.inews365.com/data/photos/20180205/art_15174723165416.jpg
            // http://cdn.kukinews.com/data/cache/public/photos/cdn/20180104/art_1516601165_300x190.jpg
            //   http://cdn.kukinews.com/data/photos/cdn/20180104/art_1516601165.jpg
            // http://news.kukinews.com/data/cache/public/photos/20180119/art_1516353322_300x190.jpg
            //   http://news.kukinews.com/data/photos/20180119/art_1516353322.jpg
            // http://cdn.kukinews.com/data/photos/kukiArticle/2011/0719/2011071901.jpg - 3594x2202
            // http://m.kukinews.com/data/photos/kukiArticle/2013/0527/09251832521234.jpg - 4636x2891
            // http://cdn.kukinews.com/data/photos/kukiArticle/2013/1208/contax_34.jpg
            return src.replace(/\/data\/cache\/public\//, "/data/").replace(/_[0-9]+x[0-9]+(?:_c[0-9]*)?\.([^/.]*)/, ".$1");
        }

        // wip
        // http://cdn.emetro.co.kr/html/image_view.php?f=20180116000114.jpg&x=175&y=120&b=0&p=tl&ds=320
        //   http://cdn.emetro.co.kr/imagebank/2018/01/16/0480/20180116000114.jpg - 480 pixels (/0480/), removing doesn't work, but replacing with 0320, 0640, 1024 works (image is 568x329)
        // http://cdn.emetro.co.kr/html/image_view.php?f=20180123000084.jpg&x=263&y=230&b=20&p=tc&ds=100000
        //   http://cdn.emetro.co.kr/imagebank/2018/01/23/0320/20180123000047.jpg - 320 pixels
        // http://cdn.emetro.co.kr/html/image_view.php?f=20180123000037.jpg&x=122&y=105&b=0&p=tc&ds=1024
        //   http://cdn.emetro.co.kr/imagebank/2018/01/23/0640/20180123000037.jpg
        // http://cdn.emetro.co.kr/html/image_view_maxw.php?f=20180207000150.jpg&x=640&ds=640
        //   http://cdn.emetro.co.kr/html/image_view_maxw.php?f=20180207000150.jpg&x=9999&ds=9999
        //   http://cdn.emetro.co.kr/html/image_view_maxw.php?f=20180207000150.jpg&x=9999999999&ds=9999999999
        //
        // p: position (tl = top left, tc = top center?, etc.), optional
        // d: quality? the higher it is, the less blurry it is, optional
        // b: no idea, optional
        // x, y: required, 0 doesn't work (blank page), -1 returns a 10x10? image, 1 returns 1px, larger stretches it
        if (domain === "cdn.emetro.co.kr") {
            return src
                .replace(/\/image_view\.php.*?[?&]f=([^&]*).*/, "/image_view_maxw.php?f=$1&x=9999999999&ds=9999999999")
                .replace(/\/imagebank\/[0-9]*\/[0-9]*\/[0-9]*\/[0-9]*\/([^/]*)$/, "/html/image_view_maxw.php?f=$1&x=9999999999&ds=9999999999")
                .replace(/\/image_view_maxw.php.*?[?&]f=([^&]*).*/, "/image_view_maxw.php?f=$1&x=9999999999&ds=9999999999");
            /*origsize = src.match(/\/([0-9]*)\/[^/]*$/);
            if (origsize) {
                size = parseInt(origsize[1], 10);
                if (size < 1024) {
                    return src.replace(/\/[0-9]*(\/[^/]*)$/, "/1024$1");
                }
            }*/
        }

        if (domain === "50.7.164.242:8182" ||
            // http://img150.pixroute.com/i/01807/71x1h0plzn0d_t.jpg
            //   http://img150.pixroute.com/i/01807/71x1h0plzn0d.jpg
            domain.match(/img[0-9]*\.pixroute\.com/)) {
            // http://50.7.164.242:8182/i/05/00355/qpjey5skv52d_t.jpg
            //   http://50.7.164.242:8182/i/05/00355/qpjey5skv52d.jpg
            return src.replace(/(\/i\/.*\/[^/.]*)_t(\.[^/.]*)$/, "$1$2");
        }

        if (domain.match(/img[0-9]*\.imagetwist\.com/)) {
            // http://img64.imagetwist.com/th/20956/qfucojvzag41.jpg
            //   http://img64.imagetwist.com/i/20956/qfucojvzag41.jpg
            return src.replace(/\/th\//, "/i/");
        }

        if (domain === "www.theactuary.com") {
            // http://www.theactuary.com/EasysiteWeb/getresource.axd?AssetID=552225&type=custom&servicetype=Inline&customSizeId=104
            //   http://www.theactuary.com/EasysiteWeb/getresource.axd?AssetID=552225
            return src.replace(/getresource\.axd\?.*(AssetID=[0-9]*).*/, "getresource.axd?$1");
        }

        if (domain === "static.new-magazine.co.uk") {
            // https://static.new-magazine.co.uk/prod/media/images/300x200_ct/1105261_334919_157_106_2_b4536ad77d2a7ac6c5c342d5ba94c83a.jpg
            //   https://static.new-magazine.co.uk/prod/media/images/625x833_ct/1105261_334919_157_106_2_b4536ad77d2a7ac6c5c342d5ba94c83a.jpg
            //   https://static.new-magazine.co.uk/prod/media/images/original/1105261_334919_157_106_2_b4536ad77d2a7ac6c5c342d5ba94c83a.jpg
            return src.replace(/(\/prod\/media\/images\/)[^/]*\//, "$1original/");
        }

        if (domain === "www.irishexaminer.com" ||
            // https://www.breakingnews.ie/remote/media.central.ie/media/images/r/roryBestShaneRoss6NationsTrophy_large.jpg?width=600&s=bn-833165
            //   http://media.central.ie/media/images/r/roryBestShaneRoss6NationsTrophy_large.jpg
            domain === "www.breakingnews.ie" ||
            domain === "ip.trueachievements.com") {
            // removing ?.* entirely returns 500
            // https://www.irishexaminer.com/remote/image.assets.pressassociation.io/v2/image/production/144492a205ad478ef0233c59e6617054Y29udGVudHNlYXJjaCwxNTEzMDczMTc2/2.30748323.jpg?crop=0,102,3712,2190&ext=.jpg&width=600
            //   https://www.irishexaminer.com/remote/image.assets.pressassociation.io/v2/image/production/144492a205ad478ef0233c59e6617054Y29udGVudHNlYXJjaCwxNTEzMDczMTc2/2.30748323.jpg?ext=.jpg&width=600
            // however, /remote/ is a remote address
            //   http://image.assets.pressassociation.io/v2/image/production/144492a205ad478ef0233c59e6617054Y29udGVudHNlYXJjaCwxNTEzMDczMTc2/2.30748323.jpg
            // https://ip.trueachievements.com/remote/images-eds-ssl.xboxlive.com%2Fimage%3Furl%3D8Oaj9Ryq1G1_p3lLnXlsaZgGzAie6Mnu24_PawYuDYIoH77pJ.X5Z.MqQPibUVTcSEliFeYEcpYdMffymmILaXcS00LePBQajKrVx_Va4DQAxgf7VKT9o10FP5RijVvisttt9.R8el9KW5aWefdGAyAK7PHk.TSf1spbv8.x6hWsZrJa2pOp_PXzU7fSK76BcdJyPe_XVC7ZQNPT1kWf.D_KXVQtjCDHj7_wiu8ekYM-?width=1200&height=675
            //   http://images-eds-ssl.xboxlive.com/image?url=8Oaj9Ryq1G1_p3lLnXlsaZgGzAie6Mnu24_PawYuDYIoH77pJ.X5Z.MqQPibUVTcSEliFeYEcpYdMffymmILaXcS00LePBQajKrVx_Va4DQAxgf7VKT9o10FP5RijVvisttt9.R8el9KW5aWefdGAyAK7PHk.TSf1spbv8.x6hWsZrJa2pOp_PXzU7fSK76BcdJyPe_XVC7ZQNPT1kWf.D_KXVQtjCDHj7_wiu8ekYM-
            newsrc = src.replace(/.*:\/\/[^/]*\/remote\/([^?]*).*/, "$1");
            if (newsrc !== src)
                return "http://" + decodeURIComponent(newsrc);
        }

        if (domain === "tellymix-spykawebgroup.netdna-ssl.com" &&
            src.indexOf("tellymix-spykawebgroup.netdna-ssl.com/ts/") >= 0) {
            // https://tellymix-spykawebgroup.netdna-ssl.com/ts/800/450/tellymix-spykawebgroup.netdna-ssl.com/wp-content/uploads/2016/10/the-apprentice-2016-sugar.jpg
            //   http://tellymix-spykawebgroup.netdna-ssl.com/wp-content/uploads/2016/10/the-apprentice-2016-sugar.jpg
            return src.replace(/.*tellymix-spykawebgroup\.netdna-ssl\.com\/ts\/[0-9]*\/[0-9]*\//, "http://");
        }

        if (domain === "assets.goodhousekeeping.co.uk") {
            // http://assets.goodhousekeeping.co.uk/main/embedded/37045/nick_hewer__large.jpg?20170224112427
            //   http://assets.goodhousekeeping.co.uk/main/embedded/37045/nick_hewer.jpg?20170224112427
            // http://assets.goodhousekeeping.co.uk/main/embedded/37045/scams_2__medium.jpg
            //   http://assets.goodhousekeeping.co.uk/main/embedded/37045/scams_2.jpg
            // http://assets.goodhousekeeping.co.uk/main/embedded/961/DH-esther-rantzen-170913-de__medium.jpg
            //   // http://assets.goodhousekeeping.co.uk/main/embedded/961/DH-esther-rantzen-170913-de.jpg
            //
            // doesn't work:
            // http://assets.goodhousekeeping.co.uk/main/options/sized-good-housekeeping-institute-cookery-school-outside-institute__medium.jpg
            return src.replace(/(\/embedded\/(?:[0-9]*\/)[^/]*)__[^/.]*(\.[^/]*)$/, "$1$2");
        }

        if ((domain === "www.femalefirst.co.uk" ||
             domain === "www.malextra.com") &&
            src.indexOf("/image-library/") >= 0 && false) {
            // wip, need a better way to find numbers ... seems to stretch the image
            // http://www.femalefirst.co.uk/image-library/square/1000/n/nick-hewer.jpg.pagespeed.ce.hpbDLhN-Bn.jpg
            //   http://www.femalefirst.co.uk/image-library/square/1000/n/nick-hewer.jpg
            // http://www.femalefirst.co.uk/image-library/square/250/i/125x125xi-am-health-ledger.jpg.pagespeed.ic.FlFI8UcEzf.webp
            //   http://www.femalefirst.co.uk/image-library/square/250/i/i-am-health-ledger.jpg
            // http://www.femalefirst.co.uk/image-library/partners/bang/land/1000/b/xbruno-mars-bdb9ea9c22850bc313ff7ac8e630fb1d828ffc4f.jpg.pagespeed.ic.rBtqQphklp.jpg
            //   http://www.femalefirst.co.uk/image-library/partners/bang/land/1000/b/bruno-mars-bdb9ea9c22850bc313ff7ac8e630fb1d828ffc4f.jpg
            // http://www.femalefirst.co.uk/image-library/partners/bang/square/250/l/lord-alan-sugar-d9c582eb51a37f070569b849b1ec3916e0bb28e0.jpg
            //   http://www.femalefirst.co.uk/image-library/partners/bang/square/1000/l/lord-alan-sugar-d9c582eb51a37f070569b849b1ec3916e0bb28e0.jpg -- stretched
            // http://www.femalefirst.co.uk/image-library/deluxe/d/despicable-me-3-character-poster-5.jpg (4050x6000)
            // http://www.femalefirst.co.uk/image-library/deluxe/r/real-housewives-of-beverly-hills-season-8-camille-grammer-deluxe-image.jpg (2249x3000)
            // http://www.femalefirst.co.uk/image-library/deluxe/w/world-of-warcraft-battle-for-azeroth-logo-deluxe.jpg (4500x2400)
            //return src.replace(/\/(?:[0-9]+x[0-9]+x)?x*([^/.]*\.[^/.]*)[^/]*$/, "/$1");
            src = src.replace(/\/[0-9x]*([^/.]*\.[^/.]*)[^/]*$/, "/$1");
            origsize = src.match(/\/([0-9]*)\/.\/[^/]*$/);
            if (origsize) {
                size = origsize[1];
                if (parseInt(size, 10) < 1000) {
                    src = src.replace(/\/[0-9]*(\/.\/[^/]*)$/, "/1000$1");
                }
            }
            return src;
        }

        if (domain === "img.buzzfeed.com") {
            // wip
            // https://img.buzzfeed.com/buzzfeed-static/static/2014-11/19/17/enhanced/webdr10/longform-original-17700-1416435430-4.png
            // https://img.buzzfeed.com/buzzfeed-static/static/2014-11/19/17/campaign_images/webdr03/nick-hewer-has-just-done-his-best-ever-facial-exp-2-32167-1416437197-0_dblbig.jpg
            // https://img.buzzfeed.com/buzzfeed-static/static/2018-01/26/9/campaign_images/buzzfeed-prod-fastlane-03/the-us-olympic-committee-demands-all-usa-gymnasti-2-2591-1516975268-0_dblwide.jpg
            // https://img.buzzfeed.com/buzzfeed-static/static/2018-01/26/8/campaign_images/buzzfeed-prod-fastlane-01/the-supreme-court-stopped-alabama-from-executing--2-14117-1516973637-0_dblwide.jpg
            //   https://img.buzzfeed.com/buzzfeed-static/static/2018-01/25/22/asset/buzzfeed-prod-fastlane-02/sub-buzz-5552-1516935824-2.jpg -- unrelated?
            // https://img.buzzfeed.com/buzzfeed-static/static/2016-05/12/16/enhanced/webdr08/original-6479-1463084088-1.jpg
            // https://img.buzzfeed.com/buzzfeed-static/static/2017-08/22/15/enhanced/buzzfeed-prod-fastlane-01/original-18338-1503431220-9.png
            return src
                .replace(/_big(\.[^/.]*)$/, "_dblbig$1")
                .replace(/_wide(\.[^/.]*)$/, "_dblbig$1")
                .replace(/_dblwide(\.[^/.]*)$/, "_dblbig$1");
        }

        if (domain === "www.thegenealogist.co.uk") {
            // https://www.thegenealogist.co.uk/images/featuredarticles/header_sm/wdytya2016_dyer.jpg
            //   https://www.thegenealogist.co.uk/images/featuredarticles/header_lg/wdytya2016_dyer.jpg
            return src.replace("/images/featuredarticles/header_sm/", "/images/featuredarticles/header_lg/");
        }

        if (domain === "251d2191a60056d6ba74-1671eccf3a0275494885881efb0852a4.ssl.cf1.rackcdn.com" ||
            // https://598d5fcf392acad97538-395e64798090ee0a3a571e8c148d44f2.ssl.cf1.rackcdn.com/19551117_israeli-vr-tech-takes-fashiontv_2f7b85b8_m.jpg?bg=2A323B
            //   https://598d5fcf392acad97538-395e64798090ee0a3a571e8c148d44f2.ssl.cf1.rackcdn.com/19551117_israeli-vr-tech-takes-fashiontv_2f7b85b8.jpg
            domain === "598d5fcf392acad97538-395e64798090ee0a3a571e8c148d44f2.ssl.cf1.rackcdn.com") {
            // https://251d2191a60056d6ba74-1671eccf3a0275494885881efb0852a4.ssl.cf1.rackcdn.com/11860912_countdowns-nick-hewer-amstrad-should_6d456945_m.jpg?bg=7C7374
            //   https://251d2191a60056d6ba74-1671eccf3a0275494885881efb0852a4.ssl.cf1.rackcdn.com/11860912_countdowns-nick-hewer-amstrad-should_6d456945.jpg
            return src.replace(/(\/[^/.]*)_[a-z](\.[^/.?]*)(?:\?[^/]*)?$/, "$1$2");
        }

        if (domain === "cdn.shopify.com") {
            // https://cdn.shopify.com/s/files/1/0947/6410/products/a2178934757_10_1024x1024.jpeg?v=1458824230
            //   https://cdn.shopify.com/s/files/1/0947/6410/products/a2178934757_10.jpeg?v=1458824230
            // https://cdn.shopify.com/s/files/1/0947/6410/products/Om-Sweet-Om_1024x1024.png?v=1450196316
            //   https://cdn.shopify.com/s/files/1/0947/6410/products/Om-Sweet-Om.png?v=1450196316
            // https://cdn.shopify.com/s/files/1/2220/9229/products/Siticker_laptop_image_2048x.jpg
            //   https://cdn.shopify.com/s/files/1/2220/9229/products/Siticker_laptop_image.jpg
            // https://cdn.shopify.com/s/files/1/0846/3086/products/DM21_copy2_large.jpg?v=1464040850
            //   https://cdn.shopify.com/s/files/1/0846/3086/products/DM21_copy2.jpg?v=1464040850
            // http://cdn.shopify.com/s/files/1/0683/4117/products/IMG_6727_grande.jpg?v=1514569448
            //   https://cdn.shopify.com/s/files/1/0683/4117/products/IMG_6727.jpg?v=1514569448
            // https://cdn.shopify.com/s/files/1/1581/4309/articles/stealherstyle-emmawatsonmetgala-tutorial02_1400x.progressive.jpg?v=1490365007
            //   https://cdn.shopify.com/s/files/1/1581/4309/articles/stealherstyle-emmawatsonmetgala-tutorial02.jpg?v=1490365007
            // https://cdn.shopify.com/s/files/1/2684/7106/products/LKE600_720x@2x.jpg?v=1514632635
            //   https://cdn.shopify.com/s/files/1/2684/7106/products/LKE600.jpg?v=1514632635
            return src.replace(/_(?:large|medium|small|grande|[0-9]+x(?:[0-9]+)?)(?:@[0-9]+x)?(?:\.progressive)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.itv.com") {
            // https://cdn.itv.com/uploads/editor/medium_DyTW1moFnODLSb6a6IiBigbhufrsOXe2y3XWw1ekUN8.jpg
            //   https://cdn.itv.com/uploads/editor/DyTW1moFnODLSb6a6IiBigbhufrsOXe2y3XWw1ekUN8.jpg
            return src.replace(/\/[a-z]*_([^/_]*)$/, "/$1");
        }

        if (domain === "d3mkh5naggjddw.cloudfront.net" ||
            // https://img.blvds.com/unsafe/fit-in/smart/https://res.cloudinary.com/hynomj8e0/image/upload/v1487089435/ajb3zxdwskxppk9ih7fi.jpg
            //   https://res.cloudinary.com/hynomj8e0/image/upload/ajb3zxdwskxppk9ih7fi.jpg
            domain === "img.blvds.com" ||
            // https://resizer.mundotkm.com/unsafe/700x1050/http://cfglobal01.mundotkm.com/2017/07/147114_MP1_1318-e1500065093615.jpg
            //   http://cfglobal01.mundotkm.com/2017/07/147114_MP1_1318-e1500065093615.jpg
            // https://resizer.mundotkm.com/unsafe/http://cfglobal01.mundotkm.com/2017/07/147114_MP1_1037-e1500064972548.jpg
            domain === "resizer.mundotkm.com" ||
            // https://t2.genius.com/unsafe/220x0/https%3A%2F%2Fimages.genius.com%2F4e99624bb74700cf1a5ac40f142cb7cf.1000x1000x1.jpg
            //   https://images.genius.com/4e99624bb74700cf1a5ac40f142cb7cf.1000x1000x1.jpg
            domain.match(/t[0-9]*\.genius\.com/)) {
            // https://d3mkh5naggjddw.cloudfront.net/unsafe/smart/filters:format(jpeg)/http%3A%2F%2Fi.dailymail.co.uk%2Fi%2Fpix%2F2017%2F08%2F10%2F19%2F43248C1D00000578-0-image-a-10_1502389640540.jpg
            //   http://i.dailymail.co.uk/i/pix/2017/08/10/19/43248C1D00000578-0-image-a-10_1502389640540.jpg
            return decodeURIComponent(src
                                      .replace(/.*\/unsafe\/smart\/[^/]*\//, "")
                                      .replace(/.*\/unsafe\/fit-in\/smart\//, "")
                                      .replace(/.*\/unsafe\/(?:[0-9]*x[0-9]*\/)?/, ""));
        }

        if (domain === "external.xx.fbcdn.net" && src.indexOf("safe_image.php") >= 0) {
            // https://external.xx.fbcdn.net/safe_image.php?d=AQAWoxh_q3ft0f3S&w=130&h=130&url=https%3A%2F%2Fi2.wp.com%2Fblog.native-instruments.com%2Fwp-content%2Fuploads%2F2018%2F01%2Fnative-summit-at-namm-collaborating-on-the-future-of-sound-hero.jpg%3Ffit%3D1920%252C880%26ssl%3D1&cfs=1&sx=257&sy=0&sw=880&sh=880&_nc_hash=AQCDl7GN-wkuS3BX
            //   http://blog.native-instruments.com/wp-content/uploads/2018/01/native-summit-at-namm-collaborating-on-the-future-of-sound-hero.jpg
            return decodeURIComponent(src.replace(/.*safe_image\.php.*?[?&]url=([^&]*).*/, "$1"));
        }

        if (domain === "elsewhere.scdn3.secure.raxcdn.com") {
            // seems to be the number of pixels??
            // https://elsewhere.scdn3.secure.raxcdn.com/images/v95000/articles/the-rolling-stones-2013-glastonbury-festival-35.jpg
            //   https://elsewhere.scdn3.secure.raxcdn.com/images/v9999999999999/articles/the-rolling-stones-2013-glastonbury-festival-35.jpg
            return src.replace(/\/images\/v[0-9]*\//, "/images/v999999999999999999/");
        }

        if (domain === "static01.nyt.com") {
            // https://static01.nyt.com/images/2015/08/30/arts/30RICHARDSJP5/30RICHARSJP5-superJumbo.jpg
            // https://static01.nyt.com/images/2015/09/17/arts/17KEITH/17KEITH-jumbo.jpg
            // https://static01.nyt.com/images/2015/09/17/arts/17KEITH/17KEITH-thumbStandard.jpg
            // https://static01.nyt.com/images/2015/08/30/arts/30RICHARDS1/30RICHARDS1-master1050.jpg
            // https://static01.nyt.com/images/2015/08/30/arts/30RICHARDSSUB4/30RICHARDSSUB4-master675.jpg
            // https://static01.nyt.com/images/2018/02/03/arts/03playlist/merlin_123145877_5ed2acde-72d5-4afb-a19a-93dbc29b5d2f-superJumbo.jpg?quality=100&auto=webp
            // https://static01.nyt.com/newsgraphics/2018/02/11/mens-slopestyle/assets/images/composite-2-2000_x2.jpg (4000x2058)
            // https://static01.nyt.com/images/2018/02/23/nyregion/23WOMEN01/merlin_134412716_f1cbfeaa-8204-41b1-9576-8cc8c5063348-threeByTwoLargeAt2X.jpg (3600x2400)
            // https://static01.nyt.com/newsgraphics/2014/09/24/private-lives/assets/private_lives_nilsen_1400_v1.png
            // https://static01.nyt.com/packages/flash/Lens/2011/06/20110629-KM-Weiwei/012-20110629-KM-Weiwei.JPG (4193x3307)
            // https://static01.nyt.com/images/2018/02/23/us/politics/23dc-note/merlin_134350481_6712d7ba-b262-4d9e-97f3-8094cc9de088-threeByTwoLargeAt2X.jpg
            // https://static01.nyt.com/newsgraphics/2017/10/31/yellen-legacy/50c5752d6294e63077f7e841ccf62b880fd1599e/yellen-office-alt-1.jpg (5472x3648)
            // https://static01.nyt.com/packages/flash/Lens/2010/10/20101025-NK-Joao/20101025-Joao-extra4.jpg (3200x2108)
            // https://static01.nyt.com/images/2010/10/06/nyregion/20101006Nocturnalist/20101006Nocturnalist-custom1.jpg (5120x3413)
            // https://static01.nyt.com/images/2010/10/06/nyregion/20101006Nocturnalist/20101006Nocturnalist-custom2.jpg ^
            // https://static01.nyt.com/images/2009/02/08/sports/20090209-SIOUX-S.JPG
            // https://static01.nyt.com/images/2010/01/05/arts/supperbig2.jpg (3000x2000)
            // https://static01.nyt.com/images/2015/10/25/t-magazine/25tmag-11well_rihanna-t_CA0/25tmag-11well_rihanna-t_CA0-facebookJumbo.jpg (1050x550)
            //   https://static01.nyt.com/images/2015/10/25/t-magazine/25tmag-11well_rihanna-t_CA0/25tmag-11well_rihanna-t_CA0-superJumbo.jpg (1639x2048)
            // https://static01.nyt.com/images/2015/10/12/t-magazine/12tmag-rihanna-toc-t/12tmag-rihanna-toc-t-blog427.jpg
            //   https://static01.nyt.com/images/2015/10/12/t-magazine/12tmag-rihanna-toc-t/12tmag-rihanna-toc-t-superJumbo.jpg
            //
            // doesn't work:
            // https://static01.nyt.com/images/2010/10/24/arts/RICHARDS-Jp-1/RICHARDS-Jp-1-popup.jpg
            // https://static01.nyt.com/images/2011/11/17/fashion/17felicityspan/17felicityspan-jumbo.jpg
            var matched = src.match(/-([^-_/.]*?)\.[^/.]*$/);
            if (matched) {
                if (matched[1] === "jumbo" ||
                    matched[1] === "thumbStandard" ||
                    matched[1] === "facebookJumbo" ||
                    matched[1].slice(0, 6) === "master" ||
                    matched[1].slice(0, 4) === "blog") {
                    return src.replace(/-[^-_/.]*(\.[^/.]*)$/, "-superJumbo$1");
                }
            }
        }

        if (domain === "render.fineartamerica.com") {
            // https://render.fineartamerica.com/images/rendered/search/print/images-medium-5/keith-richards-andre-koekemoer.jpg
            //   https://images.fineartamerica.com/images-medium-large-5/keith-richards-andre-koekemoer.jpg
            return src.replace(/render\.fineartamerica\.com\/images\/rendered\/search\/print\/[^/]*(-[0-9]*)\/([^/]*)$/, "images.fineartamerica.com/images-medium-large$1/$2");
        }

        if (domain === "media.npr.org") {
            // https://media.npr.org/assets/artslife/arts/2010/10/keith-richards/keith-richards-730d749c083f177cc443b4114ee1b19b1e257988-s400-c85.jpg
            //   https://media.npr.org/assets/artslife/arts/2010/10/keith-richards/keith-richards-730d749c083f177cc443b4114ee1b19b1e257988.jpg
            // https://media.npr.org/assets/img/2018/04/13/ap_17339773700572_wide-5b2806a60758e44c259842da1f23f45ac58b1c47.jpg
            //   https://media.npr.org/assets/img/2018/04/13/ap_17339773700572-5b2806a60758e44c259842da1f23f45ac58b1c47.jpg
            // https://media.npr.org/assets/img/2018/02/27/ap_17299821347425-0a0868f089eae2f95d1e5a4aaa0252c2176f1334-s800-c85.jpg
            //   https://media.npr.org/assets/img/2018/02/27/ap_17299821347425-0a0868f089eae2f95d1e5a4aaa0252c2176f1334.jpg
            // https://media.npr.org/assets/img/2018/04/13/gettyimages-111077711_wide-7cec6f88bb5f86c005767e5866a00404396e869e.jpg?s=400
            //   https://media.npr.org/assets/img/2018/04/13/gettyimages-111077711-7cec6f88bb5f86c005767e5866a00404396e869e.jpg
            // https://media.npr.org/assets/img/2018/01/27/rtx4ixrd_sq-744e57fe23b306ed1ccb050b38967d41b5a9c8bd-s400-c85.jpg
            //   https://media.npr.org/assets/img/2018/01/27/rtx4ixrd-744e57fe23b306ed1ccb050b38967d41b5a9c8bd.jpg
            return src
                .replace(/(\/[^/]*)-[sc][0-9]*(?:-[sc][0-9]*)?(\.[^/.]*)/, "$1$2")
                .replace(/_[a-z]+-([a-f0-9]{30,})(\.[^/.]*)$/, "-$1$2");
        }

        if (domain.match(/rs[0-9]*\.pbsrc\.com/)) {
            // http://rs375.pbsrc.com/albums/oo198/ZaraTTucker/Get%20Italian%20Translation%20Services%20to%20Boost_zpsms99llho.jpg~c400
            //   http://i375.photobucket.com/albums/oo198/ZaraTTucker/Get%20Italian%20Translation%20Services%20to%20Boost_zpsms99llho.jpg
            // http://i843.photobucket.com/albums/zz352/loaloauk/dlp%20encounter/New%20Album%2042/4640363830_9e9c2ae51b_z.jpg~original
            // http://rs414.pbsrc.com/albums/pp228/sweetblonda/NATURA.jpg?w=280&h=210&fit=crop
            //   http://i414.photobucket.com/albums/pp228/sweetblonda/NATURA.jpg
            return src
                .replace(/rs([0-9]*)\.pbsrc\.com/, "i$1.photobucket.com")
                .replace(/\?.*/, "")
                .replace(/(?:~[^/.]*)?$/, "~original");
        }

        if (domain === "www.welt.de") {
            // https://www.welt.de/img/kultur/pop/mobile132505066/0972501497-ci102l-w1024/Keith-Richards-mit-Enkel-Otto.jpg
            //   https://www.welt.de/img/kultur/pop/mobile132505066/0972501497-ci102l-w0/Keith-Richards-mit-Enkel-Otto.jpg
            return src.replace(/-w[0-9]*(\/[^/]*)$/, "-w0$1");
        }

        if (domain === "cdn.baeblemusic.com") {
            // https://cdn.baeblemusic.com/images/bblog/5-8-2017/keith-richards-almost-died-580.jpg
            return src.replace(/-[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/t[0-9]*\.deviantart\.net/)) {
            // https://t00.deviantart.net/7PiX79OLWVS6WAzA0thSVYzWarQ=/300x200/filters:fixed_height(100,100):origin()/pre00/f044/th/pre/i/2004/235/7/b/megaman.jpg
            //   https://pre00.deviantart.net/f044/th/pre/i/2004/235/7/b/megaman.jpg
            // https://t00.deviantart.net/lNDj1np7JyLzN7U1MHhJlzp38Vs=/300x200/filters:fixed_height(100,100):origin()/pre00/4328/th/pre/f/2011/194/b/6/megaman_tribute_by_saiyagina-d3odj4t.jpg
            //   https://pre00.deviantart.net/4328/th/pre/f/2011/194/b/6/megaman_tribute_by_saiyagina-d3odj4t.jpg
            // https://t00.deviantart.net/hbXtsO07Julo2fHWk6VyTkPgU5Y=/fit-in/700x350/filters:fixed_height(100,100):origin()/pre00/034f/th/pre/i/2017/346/6/5/abyss___chibi_by_nightstar234-dbwhn28.png
            //   https://pre00.deviantart.net/034f/th/pre/i/2017/346/6/5/abyss___chibi_by_nightstar234-dbwhn28.png
            return src.replace(/:\/\/.*?\.deviantart\.net\/.*?\/[0-9]*x[0-9]*\/[^/]*\/([^/]*)\/(.*)/, "://$1\.deviantart\.net/$2");
        }

        if (domain.match(/img[0-9]*\.grazia\.fr/)) {
            // https://img3.grazia.fr/var/grazia/storage/images/article/cinema-solene-rigot-grande-petite-849768/13583494-1-fre-FR/Cinema-Solene-Rigot-grande-petite_exact1900x908_l.jpg
            //   https://img3.grazia.fr/var/grazia/storage/images/article/cinema-solene-rigot-grande-petite-849768/13583494-1-fre-FR/Cinema-Solene-Rigot-grande-petite.jpg
            return src.replace(/_[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/static[0-9]*\.purepeople\.com/) ||
            domain.match(/static[0-9]*\.purebreak\.com/) ||
            domain.match(/static[0-9]*\.puretrend\.com/)) {
            // http://static1.purepeople.com/articles/8/21/01/98/@/2822958-l-actrice-solene-rigot-pour-le-film-en-950x0-1.jpg
            //   http://static1.purepeople.com/articles/8/21/01/98/@/2822958-l-actrice-solene-rigot-pour-le-film-en-0x0-1.jpg
            // http://static1.purepeople.com/articles/8/21/01/98/@/2822931-l-acteur-jose-garcia-pour-le-film-a-fon-114x114-1.jpg
            //   http://static1.purepeople.com/articles/8/21/01/98/@/2822931-l-acteur-jose-garcia-pour-le-film-a-fon-0x0-1.jpg
            // http://static1.purepeople.com/articles/4/20/07/24/@/2631120-solene-rigot-photocall-de-la-soiree-de-opengraph_1200-1.jpg
            //   http://static1.purepeople.com/articles/4/20/07/24/@/2631120-solene-rigot-photocall-de-la-soiree-de-opengraph_99999999x0-1.jpg
            // http://static1.purepeople.com/articles/4/20/07/24/@/2631120-solene-rigot-photocall-de-la-soiree-de-950x0-1.jpg
            //   http://static1.purepeople.com/articles/4/20/07/24/@/2631120-solene-rigot-photocall-de-la-soiree-de-999999999x0-1.jpg
            // http://static1.purebreak.com/articles/8/59/23/8/@/208690-ciara-800x0-2.jpg
            //   http://static1.purebreak.com/articles/8/59/23/8/@/208690-ciara-0x0-2.jpg
            // http://static1.puretrend.com/articles/5/13/91/15/@/1572135-ciara-joue-un-jeu-dangeureux-en-robe-950x0-2.jpg
            //return src.replace(/-[0-9]+x[0-9]+(-[0-9]*)?(\.[^/.]*)$/, "-0x0$1$2");
            return src.replace(/([-_])[0-9]+(?:x[0-9]+)?(-[0-9]\.[^/.]*)/, "$1999999999x0$2");
        }

        if (domain === "medias.unifrance.org") {
            // https://medias.unifrance.org/medias/143/107/27535/format_web/media.jpg
            //   https://medias.unifrance.org/medias/143/107/27535/format_page/jose-garcia.jpg
            return src.replace("/format_web/", "/format_page/");
        }

        if (domain.match(/img[0-9]*\.closermag\.fr/)) {
            // https://img3.closermag.fr/var/closermag/storage/images/bio-people/biographie-jose-garcia-112817/827937-1-fre-FR/Jose-Garcia_square500x500.jpg
            //   https://img3.closermag.fr/var/closermag/storage/images/bio-people/biographie-jose-garcia-112817/827937-1-fre-FR/Jose-Garcia.jpg
            return src.replace(/_[^/._]*(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/[^.]*\.lisimg\.com/) ||
            domain.match(/[^.]*\.listal\.com/)) {
            // http://iv1.lisimg.com/image/10752485/628full-sol%C3%A8ne-rigot.jpg
            //   http://iv1.lisimg.com/image/10752485/0full-sol%C3%A8ne-rigot.jpg
            // http://i5.lisimg.com/10752485/70.jpg
            //   http://i5.lisimg.com/10752485/0full.jpg
            // http://lb1.lisimg.com/10752485/70.jpg
            //   http://lb1.lisimg.com/10752485/0full.jpg
            // http://ilarge.lisimg.com/image/6915143/780full-sol%C3%A8ne-rigot.jpg
            //   http://ilarge.lisimg.com/image/6915143/0full.jpg
            // http://iv1.lisimg.com/image/2916057/516full-rachel-riley.jpg
            //   http://ilarge.lisimg.com/image/2916057/0full.jpg
            return src
                .replace(/:\/\/[^\./]*\.lisimg\.com\//, "://ilarge.lisimg.com/")
                .replace(/\/([^/]*)\.jpg$/, "/99999999999full.jpg");
                //.replace(/\/([^/]*)\.jpg$/, "/0full.jpg");
        }

        if (domain.indexOf(".lesinrocks.com") >= 0) {
            // https://www.lesinrocks.com/content/thumbs/uploads/2017/03/width-1120-height-612-srcset-1/solene-rigot-1.jpg - stretched
            //   https://www.lesinrocks.com/content/thumbs/uploads/2017/03/width-0-height-0-srcset-1/solene-rigot-1.jpg
            // https://statics.lesinrocks.com/content/thumbs/uploads/2017/12/width-100-height-100/nerd-no-one-ever-really-dies-album-cover-release-date-1.jpg
            //   https://www.lesinrocks.com/content/thumbs/uploads/2017/12/width-0-height-0/nerd-no-one-ever-really-dies-album-cover-release-date-1.jpg
            return src.replace(/\/width-[0-9]*-height-[0-9]*/, "/width-0-height-0");
        }

        if (domain === "media.senscritique.com") {
            // https://media.senscritique.com/media/000006647807/150_200/Solene_Rigot.png
            //   https://media.senscritique.com/media/000006647807/0_0/Solene_Rigot.png
            return src.replace(/\/[0-9]*_[0-9]*\/([^/]*)$/, "/0_0/$1");
        }

        if (domain === "www.franceinter.fr") {
            // https://www.franceinter.fr/s3/cruiser-production/2017/03/e97f73a2-2cba-4d48-bdc4-e50392aad75a/640_orpheline.jpg
            //   https://www.franceinter.fr/s3/cruiser-production/2017/03/e97f73a2-2cba-4d48-bdc4-e50392aad75a/orpheline.jpg
            return src.replace(/\/[0-9]*_([^/]*\.jpg)$/, "/$1");
        }

        if (domain === "www.vod.lu" &&
            src.indexOf("/media/cache/") >= 0) {
            // https://github.com/liip/LiipImagineBundle/issues/912 related?

            // http://www.vod.lu/media/cache/resolve/400x225/97/0c/970c16f8-fd8f-11e6-823c-d10fb8a0c611.jpg
            //   http://www.vod.lu/media/cache/resolve/9999999x9999999/97/0c/970c16f8-fd8f-11e6-823c-d10fb8a0c611.jpg
            // http://www.vod.lu/media/cache/190x253/92/7d/927da5b5-fd8f-11e6-9eab-ed7742afa678.jpg
            //   http://www.vod.lu/media/cache/9999999x9999999/92/7d/927da5b5-fd8f-11e6-9eab-ed7742afa678.jpg
            return src.replace(/\/media\/cache\/(resolve\/)?[0-9]+x[0-9]+\//, "/media/cache/$19999999x9999999/");
        }

        if (domain === "1645110239.rsc.cdn77.org") {
            // https://1645110239.rsc.cdn77.org/image/s300/q50/mm/befr/movies14119/posters/puppylove.0.jpg
            //   https://1645110239.rsc.cdn77.org/image/mm/befr/movies14119/posters/puppylove.jpg
            // https://1645110239.rsc.cdn77.org/image/x1200x800/q80/mm/been/movies17158/posters/orpheline-1.jpg
            //   https://1645110239.rsc.cdn77.org/image/mm/been/movies17158/posters/orpheline-1.jpg
            return src
                .replace(/\/image\/[a-z][0-9]+\//, "/image/") // to be repeated
                .replace(/\/image\/x[0-9]+x[0-9]+\//, "/image/")
                .replace(/\/([^/.]*)\.[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "diymag.com" &&
            src.indexOf("/media/img") >= 0) {
            // http://diymag.com/media/img/Artists/B/Beck/_1500x1000_crop_center-center_75/Beck-UpAllNightVideo.jpg
            //   http://diymag.com/media/img/Artists/B/Beck/Beck-UpAllNightVideo.jpg
            return src.replace(/(\/media\/img\/.*\/)_[^/]*\/([^/]*)$/, "$1$2");
        }

        if (domain === "1.fwcdn.pl" && false) {
            // http://1.fwcdn.pl/ph/73/52/737352/569269_1.2.jpg
            // http://1.fwcdn.pl/ph/73/52/737352/569269_1.jpg
            //   http://1.fwcdn.pl/ph/73/52/737352/569269_1.1.jpg
            // doesn't work for all:
            // http://1.fwcdn.pl/an/np/875720/2018/15046_1.9.jpg -- 320x180
            //   http://1.fwcdn.pl/an/np/875720/2018/15046_1.1.jpg -- 90x90
            return src.replace(/(\/[^/.]*)(?:\.[0-9]*)?(\.[^/.]*)$/, "$1.1$2");
        }

        if (domain === "www.semainedelacritique.com" &&
            src.indexOf("/ttimg-rsz") >= 0) {
            // http://www.semainedelacritique.com/ttimg-rsz?src=/uploads/galleriemedia/ed9cf1c0cd7756b1e7e782f8bc2bc3d2.jpg&w=1200&h=800&q=100&zc=2&a=c
            //   http://www.semainedelacritique.com/uploads/galleriemedia/ed9cf1c0cd7756b1e7e782f8bc2bc3d2.jpg
            return urljoin(src, src.replace(/.*\/ttimg-rsz\?.*?src=([^&]*).*/, "$1"));
        }

        if (/*domain === "gal.img.pmdstatic.net"*/
            domain.match(/img\..*?pmdstatic\.net$/)) {
            // https://gal.img.pmdstatic.net/fit/https.3A.2F.2Fphoto.2Egala.2Efr.2Fupload.2Fslideshow.2Fquels-parrains-pour-les-revelations-cesar-les-photos-de-la-soiree-chanel-au-petit-palais-27606.2Fsolene-rigot-chien-et-son-parrain-samuel-benchetrit-475504.2Ejpg/400x600/quality/65/solene-rigot-chien-et-son-parrain-samuel-benchetrit.jpg
            //   https://photo.gala.fr/upload/slideshow/quels-parrains-pour-les-revelations-cesar-les-photos-de-la-soiree-chanel-au-petit-palais-27606/solene-rigot-chien-et-son-parrain-samuel-benchetrit-475504.jpg
            // http://gal.img.pmdstatic.net/fit/https.3A.2F.2Fi.2Eimgur.2Ecom.2FQK42KsW.2Ejpg/400x600/quality/65/test.jpg
            //   https://i.imgur.com/QK42KsW.jpg
            // http://img.tra.pmdstatic.net/fit/http.3A.2F.2Fwww.2Efoodreporter.2Efr.2Fupload.2Foriginal.2F5.2Fc.2Fz.2F8.2Fu.2F1258707.2Ejpg/312x240/quality/100/picture.jpg
            return decodeURIComponent(src.replace(/.*?\.pmdstatic\.net\/fit\/([^/]*).*/, "$1").replace(/\./g, "%"));
        }

        if (domain === "photo.gala.fr") {
            // gives content-length of 0
            // https://photo.gala.fr/upload/slideshow/quels-parrains-pour-les-revelations-cesar-les-photos-de-la-soiree-chanel-au-petit-palais-27606/solene-rigot-chien-et-son-parrain-samuel-benchetrit-475504.jpg
            return {
                url: src,
                head_wrong_contentlength: true
            };
        }

        if (domain === "cdn.cnn.com" ||
            domain.match(/(?:i[0-9]*\.)?cdn\.turner\.com/)) {
            // https://cdn.cnn.com/cnnnext/dam/assets/170301101237-emma-watson-selfies-exlarge-169.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/170301101237-emma-watson-selfies.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/171226214729-carl-bernstein-12-26-super-169.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/171226214729-carl-bernstein-12-26.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/170220104445-mark-turner-volvo-ocean-race-super-169.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/170220104445-mark-turner-volvo-ocean-race.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/170303101934-emma-watson---premiere-full-169.jpg (definitely not full)
            //   https://cdn.cnn.com/cnnnext/dam/assets/170303101934-emma-watson---premiere.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/170307035422-emma-watson-on-kimmel-02-large-169.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/170307035422-emma-watson-on-kimmel-02.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/180209072938-33-winter-olympics-opening-ceremony-0209-overlay-tease.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/180209072938-33-winter-olympics-opening-ceremony-0209.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/180209112927-10-winter-olympics-opening-ceremony-0209-large-tease.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/180209112927-10-winter-olympics-opening-ceremony-0209.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/180208122950-palestinian-deportee-6-large-alt-11.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/180208122950-palestinian-deportee-6.jpg
            // http://i2.cdn.turner.com/cnn/dam/assets/130318122753-emma-watson-january-2013-story-top.jpg
            //   http://i2.cdn.turner.com/cnn/dam/assets/130318122753-emma-watson-january-2013.jpg
            // http://cdn.cnn.com/cnnnext/dam/assets/170428012205-28-met-gala-kurkova.jpg
            // https://cdn.cnn.com/cnnnext/dam/assets/180405060923-plastic-bags-edinburgh-beach-file-restricted-exlarge-169.jpg
            //   https://cdn.cnn.com/cnnnext/dam/assets/180405060923-plastic-bags-edinburgh-beach-file-restricted.jpg
            // doesn't work:
            // http://cdn.cnn.com/cnnnext/dam/assets/140630134917-12-canada-most-beautiful-places-super-169.jpg
            // http://cdn.cnn.com/cnnnext/dam/assets/140630134917-12-canada-most-beautiful-places-large-169.jpg
            // http://cdn.cnn.com/cnnnext/dam/assets/140630134917-12-canada-most-beautiful-places-exlarge-169.jpg
            // http://cdn.cnn.com/cnnnext/dam/assets/140630134917-12-canada-most-beautiful-places-full-169.jpg
            //return src.replace(/-(?:small|medium|large|exlarge|super|full|overlay)-[0-9]*(\.[^/.]*)$/, "$1");
            return {
                url: src.replace(/-(?:small|medium|large|exlarge|super|full|overlay|alt|tease|story-top)(?:-(?:small|medium|large|exlarge|super|full|overlay|alt|tease))?(?:-[0-9]*)?(\.[^/.]*)$/, "$1"),
                can_head: false
            };
            //return src.replace(/-[a-z]*-(?:169|tease)(\.[^/.]*)$/, "$1");
        }

        if (domain === "ugc.kn3.net"/* &&
            src.indexOf("/i/origin/") >= 0*/) {
            // https://ugc.kn3.net/i/origin/http://media3.popsugar-assets.com/files/2013/09/16/795/n/1922564/b962955383f6b80f_1592163256t6a65.xxxlarge_2x/i/Emma-Watson-all-legs-sexy-Peter-Pilotto-cutout-minidress.jpg
            // https://ugc.kn3.net/i/760x/https://butacadavidciana.files.wordpress.com/2015/01/hatefuleightposter.jpg
            //return src.replace(/.*?\/i\/origin\//, "");
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/i\/[0-9a-z]+\//, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "media.shoko.fr" ||
            // https://media.fan2.fr/article-2548712-ajust_1020-f205148/dove-cameron-devoile-un-trailer-du-nouveau.jpg
            //   https://media.fan2.fr/article-2548712-redim-f205148/dove-cameron-devoile-un-trailer-du-nouveau.jpg
            domain === "media.fan2.fr" ||
            domain === "media.melty.fr") {
            // https://media.shoko.fr/article-3410081-ajust_1000-f1483450645/emma-watson-en-2013-a-l-avant-premiere-de.jpg
            // https://media.shoko.fr/article-3410093-ratio_100-f1483451011/emma-watson-en-1998-une-star-est-nee.jpg
            // https://media.shoko.fr/media_aggregate-3410071-ajust_700-f1483450315/emma-watson-2014-look-red-carpet-harry-potter.jpg
            // https://media.shoko.fr/article-3410071-redim-f1483450315/emma-watson-en-2014-aux-brit-fashion-awards.jpg
            // https://media.shoko.fr/article-1234470-head/emma-watson-peoples-choice-awards-2013.jpg
            // https://media.shoko.fr/emma-watson-harry-potter-et-les-reliques-image-393422-article-head.jpg
            // https://media.melty.fr/article-3657708-thumb-f8/quantico-saison-3-priyanka-chopra-alex-tease.jpg
            // https://media.melty.fr/article-3658090-head-f4/rihanna-anniversaire-pornhub-film-porno-pornographie.jpg
            // https://media.melty.fr/article-3658090-full/booba-veut-arreter-sa-carriere-fergie-en.jpg
            // https://media.melty.fr/article-923024-head/meltylife-meryl-melty-fr-redactrice-travaille.jpg
            // different:
            // https://media.melty.fr/article-3657733-thumb-f8/julia-les-marseillais-australia-celibataire.jpg
            //   https://media.melty.fr/article-3657733-redim-f8/julia-les-marseillais-australia-celibataire.jpg
            return src
                .replace(/(:\/\/[^/]*)\/([^/]*?)-[^/-]*((?:-f[^/]*)?\.[^/.]*)$/, "$1/$2-redim$3")
                .replace(/(:\/\/[^/]*)\/([^/-]*?-[0-9]*-)[^/-]*(-f[^/]*)?\//, "$1/$2redim$3/");
        }

        if (domain.indexOf(".vogue.fr") >= 0 ||
            // http://www.glamourparis.com/uploads/images/thumbs/201637/48/rodarte_jpg_8718_north_458x687_white.jpg
            domain === "www.glamourparis.com" ||
            // http://www.gqmagazine.fr/uploads/images/thumbs/201803/b7/_vui0653_jpg_9983_north_640x960_transparent.jpg
            //   http://www.gqmagazine.fr/uploads/images/201803/b7/_vui0653_jpg_9983.jpg
            domain === "www.gqmagazine.fr") {
            // https://en.vogue.fr/uploads/images/thumbs/201804/a0/tee_1841.jpeg_north_499x_white.jpg
            //   https://en.vogue.fr/uploads/images/201804/a0/tee_1841.jpeg
            // https://en.vogue.fr/uploads/images/thumbs/201725/26/emma_watson__jpg_3972_jpeg_2620.jpeg_north_499x_white.jpg
            //   https://en.vogue.fr/uploads/images/201725/26/emma_watson__jpg_3972_jpeg_2620.jpeg
            // https://en.vogue.fr/uploads/images/thumbs/201725/55/emma_watson_miu_miu_the_circle_premiere_21_06_2017_paris_jpg_8082_jpeg_7667.jpeg_north_499x_white.jpg
            //   https://en.vogue.fr/uploads/images/201725/55/emma_watson_miu_miu_the_circle_premiere_21_06_2017_paris_jpg_8082_jpeg_7667.jpeg
            //
            // https://en.vogue.fr/uploads/images/thumbs/201712/d2/gettyimages_647393804_jpg_9242_north_499x_white.jpg
            //   https://en.vogue.fr/uploads/images/201712/d2/gettyimages_647393804_jpg_9242.jpg
            // https://en.vogue.fr/uploads/images/thumbs/201712/a4/emma_watson_in_givenchy_hc_par_rt_jpg_340_north_499x_white.jpg
            //   https://en.vogue.fr/uploads/images/201712/a4/emma_watson_in_givenchy_hc_par_rt_jpg_340.jpg
            src = src
                .replace("/images/thumbs/", "/images/");
            newsrc = src.replace(/(\.[^/._]*)_[^/]*$/, "$1");
            if (newsrc !== src)
                return newsrc;
            return src.replace(/_north_[0-9]*x(?:[0-9]+)?_(?:white|transparent)(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.culturacolectiva.com") {
            // https://img.culturacolectiva.com/featured/2017/10/bdfd42e4-138b-4037-8b56-8c309a3dc385-high.jpg
            // https://img.culturacolectiva.com/featured/2018/01/24/1516840709928/le-moine-le-moine-the-monk-13-07-2011-1-g_a_l-medium.jpg
            return src.replace(/-(?:high|medium|low)(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".reveliststatic.com") >= 0) {
            // http://ugc.reveliststatic.com/gen/constrain/800/800/80/2017/05/09/10/6x/ix/phdkya0kkk2qbwe.jpg
            //   http://ugc.reveliststatic.com/gen/full/2017/05/09/10/6x/ix/phdkya0kkk2qbwe.jpg
            return src.replace(/\/gen\/constrain\/[0-9]*\/[0-9]*\/[0-9]*\//, "/gen/full/");
        }

        if (domain === "static.giantbomb.com") {
            // https://static.giantbomb.com/uploads/square_medium/0/329/2767259-journey_20150721143742.jpg
            //   https://static.giantbomb.com/uploads/original/0/329/2767259-journey_20150721143742.jpg
            return src.replace(/\/uploads\/[^/]*\//, "/uploads/original/");
        }

        if (domain === "images.shazam.com") {
            // https://images.shazam.com/coverart/t113448093-b320004845_s400.jpg
            //   https://images.shazam.com/coverart/t113448093-b320004845_s0.jpg
            return src.replace(/_s[0-9]+(\.[^/.]*)$/, "_s0$1");
        }

        if (domain.indexOf(".ebayimg.com") >= 0) {
            // https://i.ebayimg.com/images/g/2lIAAOSwsS1Zkh1k/s-l300.jpg
            //   https://i.ebayimg.com/images/g/2lIAAOSwsS1Zkh1k/s-l9999.jpg
            // https://ssli.ebayimg.com/images/g/nqQAAOSwh2RZ6b1q/s-l500.jpg
            //   https://ssli.ebayimg.com/images/g/nqQAAOSwh2RZ6b1q/s-l9999.jpg
            // http://i.ebayimg.com/00/s/NjAwWDQ1MA==/z/mEAAAOSwKIpWBa25/$_23.JPG
            //   http://i.ebayimg.com/images/g/mEAAAOSwKIpWBa25/s-l9999.jpg
            // http://i.ebayimg.com/t/Trashy-Red-Riding-Hood-Gingham-Cute-Dress-Up-Halloween-Sexy-Teen-Adult-Costume-/00/s/MzUwWDM1MA==/z/be8AAMXQxVZRCdlO/$T2eC16VHJHgE9n0yFji(BRCdlO!Zpg~~60_35.JPG
            //   http://i.ebayimg.com/00/s/MzUwWDM1MA==/z/be8AAMXQxVZRCdlO/$T2eC16VHJHgE9n0yFji(BRCdlO!Zpg~~60_35.JPG
            //   http://i.ebayimg.com/images/g/be8AAMXQxVZRCdlO/s-l9999.jpg
            // http://i.ebayimg.com/images/i/121630247122-0-1/s-l1000.jpg -- 9999 doesn't work
            // http://i.ebayimg.com/images/i/262923537353-0-1/s-l1000.jpg -- 9999
            //   https://i.ebayimg.com/images/g/6OoAAOSw3gJZHI1d/s-l1000.jpg
            // https://i.ebayimg.com/thumbs/images/g/2FMAAOSw4A5Y0l-Z/s-l200.jpg
            //   https://i.ebayimg.com/images/g/2FMAAOSw4A5Y0l-Z/s-l9999.jpg
            newsrc = src.replace(/\/t\/.*?(\/[0-9]+\/s\/)/, "$1");
            if (newsrc !== src) {
                return newsrc;
            }

            newsrc = src.replace(/\/[0-9]+\/[a-z]+\/[^/]*\/[a-z]+\/([^/]+)\/[^/.]*(\.[^/.]*)$/, "/images/g/$1/s-l9999$2");
            if (newsrc !== src) {
                newsrc = newsrc.replace(/(.*\.)[^/.]*$/, "$1") + newsrc.replace(/.*\.([^/.]*)$/, "$1").toLowerCase();
                return newsrc;
            }

            return src
                .replace(/\/thumbs\/images\//, "/images/")
                .replace(/-l[0-9]+(\.[^/.]*)$/, "-l9999$1");
        }

        if (domain.match(/thumbs[0-9]*\.ebaystatic\.com/)) {
            // https://thumbs2.ebaystatic.com/m/mKuDpR7Z1yrk82zzlihfOCw/140.jpg
            //   https://ssli.ebayimg.com/images/m/mKuDpR7Z1yrk82zzlihfOCw/s-l9999.jpg
            return src.replace(/^[a-z]*:\/\/[^/]*\/(.*?)\/[0-9]+(\.[^/.]*)$/, "https://ssli.ebayimg.com/images/$1/s-l9999$2");
        }

        if (domain === "www.picclickimg.com") {
            // https://www.picclickimg.com/d/l400/pict/232427221641_/Dove-Cameron-Delicate-8x10-Photo-Picture-Celebrity-Print.jpg
            //   https://www.picclickimg.com/d/l9999/pict/232427221641_/Dove-Cameron-Delicate-8x10-Photo-Picture-Celebrity-Print.jpg
            return {
                url: src.replace(/\/d\/[a-z][0-9]+\/pict\//, "/d/l9999/pict/"),
                can_head: false // it just hangs
            };
        }

        if (domain === "i.slkimg.com") {
            // https://i.slkimg.com/isv1/album/v5d0aa81654166d6a/3248641/web/3/fill/5,0/600.jpg
            //    https://i.slkimg.com/isv1/album/v5d0aa81654166d6a/3248641/web/3/999999999.jpg
            return src
                .replace(/\/fill\/[0-9]+,[0-9]+\//, "/")
                .replace(/[0-9]+(\.[^/.]*)$/, "999999999$1");
        }

        if (domain === "i.vimeocdn.com" &&
            src.indexOf("/filter/overlay") >= 0) {
            // https://i.vimeocdn.com/filter/overlay?src0=https%3A%2F%2Fi.vimeocdn.com%2Fvideo%2F504371620_1280x720.jpg&src1=https%3A%2F%2Ff.vimeocdn.com%2Fimages_v6%2Fshare%2Fplay_icon_overlay.png
            //   https://i.vimeocdn.com/video/504371620_1280x720.jpg
            return decodeURIComponent(src.replace(/.*\/overlay\?.*?src0=([^&]*).*/, "$1"));
        }

        if (domain === "imagelab.nownews.com") {
            // https://imagelab.nownews.com/?w=300&q=70&src=https://rssimg.nownews.com/images/5a6f132bda68fc5330825347_201801292027.jpg
            //   https://rssimg.nownews.com/images/5a6f132bda68fc5330825347_201801292027.jpg
            // https://imagelab.nownews.com/?w=300&q=70&src=https%3A%2F%2Fimg.nownews.com%2Fnownews_production%2Fimages%2F5a6f3bb53d666a52fa4894d8_201801292320.png
            //   https://img.nownews.com/nownews_production/images/5a6f3bb53d666a52fa4894d8_201801292320.png
            return decodeURIComponent(src.replace(/.*[/?&]src=(.*)$/, "$1"));
        }

        if (domain === "cdn.discordapp.com") {
            // https://cdn.discordapp.com/avatars/191394916771823617/a_0cc6551148c73504703e5c4dba44bc0a.png?size=128
            //   https://cdn.discordapp.com/avatars/191394916771823617/a_0cc6551148c73504703e5c4dba44bc0a.png?size=2048
            return src.replace(/\?size=[0-9]*$/, "?size=2048");
        }

        if (domain.match(/images-ext-[0-9]*\.discordapp\.net/)) {
            // https://images-ext-1.discordapp.net/external/2rLDB8F8wm8zJBuYqxmLrM31K-VuJavo6cBLu62McoY/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/378382650597179392/10a9986e76557e24e53f8da2a573e6d1.webp?width=80&height=80
            //   https://cdn.discordapp.com/avatars/378382650597179392/10a9986e76557e24e53f8da2a573e6d1.webp?size=1024
            // https://images-ext-1.discordapp.net/external/Yu5JBnNXOrtdA4di9Pom8R5u-FXQVuHwUQVNA5VE6TQ/https/instagram.ftxl1-1.fna.fbcdn.net/vp/43a40cdb127e4b2731e0d73056813310/5B049080/t51.2885-15/e35/26293979_199841880752391_9218323895503814656_n.jpg?width=240&height=300
            //   https://instagram.ftxl1-1.fna.fbcdn.net/vp/43a40cdb127e4b2731e0d73056813310/5B049080/t51.2885-15/e35/26293979_199841880752391_9218323895503814656_n.jpg
            return decodeURIComponent(src.replace(/.*\/external\/[^/]*\/(?:([^/]*)\/)?(https?)\/(.*?)(?:\?[^/]*)?$/, "$2://$3$1"));
        }

        if (domain === "hot-korea.net") {
            // https://hot-korea.net/uploads/gallery/thumbs/1238.jpg
            //   https://hot-korea.net/uploads/gallery/1238.jpg
            return src.replace(/\/uploads\/([^/]*\/)thumbs\//, "/uploads/$1");
        }

        if (domain.match(/i[0-9]*\.sndcdn\.com/)) {
            // https://i1.sndcdn.com/avatars-000300362115-78ogrs-t500x500.jpg
            //   https://i1.sndcdn.com/avatars-000300362115-78ogrs-original.jpg
            return src.replace(/-[^-/.]*(\.[^/.]*)$/, "-original$1");
        }

        if (domain === "media.licdn.com") {
            // https://media.licdn.com/mpr/mpr/shrinknp_200_200/AAEAAQAAAAAAAAIsAAAAJDI3NTdjMDNhLWM3ZWMtNGQzZS04MGE1LWJjMzlkNWIzNDlhNw.jpg
            //   https://media.licdn.com/mpr/mpr/AAEAAQAAAAAAAAIsAAAAJDI3NTdjMDNhLWM3ZWMtNGQzZS04MGE1LWJjMzlkNWIzNDlhNw.jpg
            return src.replace(/\/shrinknp_[0-9]+_[0-9]+\//, "/");
        }

        if (domain.match(/bloximages\..*vip\.townnews\.com/) ||
            domain === "s3-ap-southeast-2.amazonaws.com") {
            // https://bloximages.chicago2.vip.townnews.com/tucson.com/content/tncms/assets/v3/editorial/9/e1/9e16bd10-2343-5819-a7c7-89a7d520c38e/5a653cb109be0.image.jpg?resize=750%2C1067
            // https://bloximages.newyork1.vip.townnews.com/roanoke.com/content/tncms/assets/v3/editorial/5/fd/5fd9841d-3b33-5f9a-b8e7-efb5a1730a65/5408aee812bf4.image.jpg
            // https://bloximages.newyork1.vip.townnews.com/heraldmailmedia.com/content/tncms/assets/v3/editorial/1/9a/19a45cfe-354a-11e3-939d-001a4bcf6878/5800f2836b369.image.jpg?resize=1200%2C675
            // https://s3-ap-southeast-2.amazonaws.com/syd.cdn.coreweb.com.au/136/1734561-our-neighbourhood-650x360.jpg
            return src.replace(/^(.*?:\/\/)[^/]*\//, "http://");
        }

        if (domain.match(/cdn[^.]*\.psbin\.com/)) {
            // http://cdnak1.psbin.com/img/mw=160/mh=210/cr=n/d=choz0/0gdge8mcb86p3dfk.jpg
            //   http://cdnak1.psbin.com/img/0gdge8mcb86p3dfk.jpg
            return src.replace(/\/img\/[^/]*=[^/]*\//, "/img/"); // repeated
        }

        if (domain === "wac.450f.edgecastcdn.net") {
            // http://wac.450f.edgecastcdn.net/80450F/k99.com/files/2013/01/JohnnyCarson_Facebook-630x477.jpg
            // http://wac.450f.edgecastcdn.net/80450F/banana1015.com/files/2013/04/Daryl-Salad-ft.jpg?w=600&h=0&zc=1&s=0&a=t&q=89
            // http://wac.450f.edgecastcdn.net/80450F/thefw.com/files/2012/06/Jimmy-Kimmel-Hooks-Kids-Up-to-Fake-Lie-Detector1.jpg
            // http://wac.450f.edgecastcdn.net/80450F/wokq.com/files/2015/11/12011246_10153099160181766_6355448705489009380_n.jpg
            // http://wac.450f.edgecastcdn.net/80450F/mix106radio.com/files/2017/05/RS8710_177369626.jpg?w=630&h=420&zc=1&s=0&a=t&q=89
            return src.replace(/^(.*?:\/\/)[^/]*\/80450F\//, "http://");
        }

        if (domain === "gp1.wac.edgecastcdn.net") {
            // https://gp1.wac.edgecastcdn.net/802892/http_public_production/musicians/images/458607/original/resize:248x186/crop:x0y8w740h554/hash:1467386813/1425323540_10201484920743713_511360204_n.jpg?1467386813
            //   https://gp1.wac.edgecastcdn.net/802892/http_public_production/musicians/images/458607/original/1425323540_10201484920743713_511360204_n.jpg?1467386813
            return src.replace(/(\/images\/[0-9]*\/[^/]*\/)[^/]*:[^/]*\//, "$1"); // repeated
        }

        if (domain === "www.century21.com") {
            // https://www.century21.com/c21/photo/320x240/c21.azureedge.net/1103i96/6m7cc0c7t2ke40abf3a2tgy386i96
            //   http://c21.azureedge.net/1103i96/6m7cc0c7t2ke40abf3a2tgy386i96
            // https://www.century21.com/c21/photo/maxxmax/c21.azureedge.net/1i103/rk8yf7dx6g8z4na3er4jc4m9b1i103
            //   http://c21.azureedge.net/1i103/rk8yf7dx6g8z4na3er4jc4m9b1i103
            return src.replace(/.*?\/photo\/[0-9a-z]*x[0-9a-z]*\//, "http://");
        }

        if (domain === "cdn.instructables.com") {
            // https://cdn.instructables.com/FK3/KJ6O/J1WW1VNZ/FK3KJ6OJ1WW1VNZ.RECTANGLE1.jpg
            //   https://cdn.instructables.com/ORIG/FK3/KJ6O/J1WW1VNZ/FK3KJ6OJ1WW1VNZ.jpg
            return src.replace(/(:\/\/[^/]*\/)(.*)\.[^/.]*(\.[^/.]*)$/, "$1ORIG/$2$3");
        }

        if (domain.match(/cdn[0-9]*-img\.pressreader\.com/)) {
            // https://cdn2-img.pressreader.com/pressdisplay/docserver/getimage.aspx?regionKey=nsDHuRjfHcgbdqHuZt9cKQ%3D%3D&scale=100
            //   https://cdn2-img.pressreader.com/pressdisplay/docserver/getimage.aspx?regionKey=nsDHuRjfHcgbdqHuZt9cKQ%3D%3D
            return src.replace(/getimage\.aspx[^/]*[?&](regionKey=[^&]*).*$/, "getimage.aspx?$1");
        }

        if (domain === "layfielddesign.com") {
            // http://layfielddesign.com/assets/uploads/project_images/_fullSize/harpers-bazaar-statistics.jpg
            //   http://layfielddesign.com/assets/uploads/project_images/harpers-bazaar-statistics.jpg
            return src.replace(/\/uploads\/([^/]*)\/_[^/]*\//, "/uploads/$1/");
        }

        if (domain === "mediaslide-europe.storage.googleapis.com") {
            // https://mediaslide-europe.storage.googleapis.com/uno/pictures/423/24823/large-1489494252-0801f3a26891df01462bae3da66cf8e7.jpg
            //   https://mediaslide-europe.storage.googleapis.com/uno/pictures/423/24823/1489494252-0801f3a26891df01462bae3da66cf8e7.jpg
            return src.replace(/\/[a-z]*-([^/]*)$/, "/$1");
        }

        if (domain.match(/m[^.]*\.netinfo\.bg/)) {
            // https://www.vesti.bg/galerii/foto/zvezdite-s-dve-razlichni-obuvki-na-cherveniia-kilim-4877/32735277
            //
            // https://mm.netinfo.bg/resize/resize_on_the_fly.php?address=media/images/32735/32735277/r-1024-768-obuvki-cherven-kilim-znamenitosti.jpg
            // https://m5.netinfo.bg/media/images/32735/32735277/r-1024-768-obuvki-cherven-kilim-znamenitosti.jpg
            // https://m5.netinfo.bg/media/images/32735/32735277/r-976-734-obuvki-cherven-kilim-znamenitosti.jpg
            // https://m5.netinfo.bg/media/images/32735/32735277/80-49-obuvki-cherven-kilim-znamenitosti.jpg
            // https://mm.netinfo.bg/resize/resize_on_the_fly.php?address=media/images/32713/32713259/orig-orig-emili-ratajkovski.jpg
            // https://mm.netinfo.bg/resize/resize_on_the_fly.php?address=media/images/32735/32735277/orig-orig-obuvki-cherven-kilim-znamenitosti.jpg
            //
            // https://m.netinfo.bg/media/images/32735/32735274/80-49-obuvki-cherven-kilim-znamenitosti.jpg
            return src.replace(/([/=]media\/images\/[0-9]*\/[0-9]*\/)(?:r-)?[^-/.]*-[^-/.]*/, "$1orig-orig");
        }

        if (domain === "i.imgur.com" &&
            !src.match(/\.gifv(?:\?.*)?$/)) {
            // https://i.imgur.com/ajsLfCab.jpg
            // https://i.imgur.com/ajsLfCam.jpg
            // https://i.imgur.com/ajsLfCal.jpg
            // https://i.imgur.com/ajsLfCa_d.jpg?maxwidth=520&shape=thumb&fidelity=high
            //   https://i.imgur.com/ajsLfCa.jpg
            // h, r, l, g, m, t, b, s
            return src.replace(/\/([a-zA-Z0-9]{7})(?:[hrlgmtbs]|_d)(\.[^/.?]*)$/, "/$1$2");
        }

        if (domain_nowww === "vidble.com") {
            // https://www.vidble.com/ZNOTKNmw6y_sqr.jpg
            //   https://www.vidble.com/ZNOTKNmw6y.jpg
            return src.replace(/_[^/._]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "itpro.nikkeibp.co.jp") {
            // http://itpro.nikkeibp.co.jp/pc/article/interview/20130319/1083744/thumb_420_ph2_px420.jpg
            //   http://itpro.nikkeibp.co.jp/pc/article/interview/20130319/1083744/ph2_px420.jpg
            return src.replace(/\/thumb_[0-9]+_([^/]*)$/, "/$1");
        }

        if (domain === "media-cdn.tripadvisor.com") {
            // https://media-cdn.tripadvisor.com/media/photo-s/0e/8d/a4/5e/hogwarts-express.jpg
            //   https://media-cdn.tripadvisor.com/media/photo-s/0e/8d/a4/5e/hogwarts-express.jpg
            // o, s, f, i, l, t
            return src.replace(/\/media\/photo-[a-z]\//, "/media/photo-o/");
        }

        if (domain === "www.traveller.com.au" ||
            // https://resources.stuff.co.nz/content/dam/images/1/3/q/g/e/a/image.related.StuffLandscapeSixteenByNine.620x349.1inizt.png/1492742323724.jpg
            //   https://resources.stuff.co.nz/content/dam/images/1/3/q/g/e/a/image.
            domain === "resources.stuff.co.nz" ||
            // http://www.essentialbaby.com.au/content/dam/images/4/6/9/8/d/image.gallery.articleLeadwide.620x349.23z5t.png
            //   http://www.essentialbaby.com.au/content/dam/images/4/6/9/8/d/image.
            domain === "www.essentialbaby.com.au") {
            // http://www.traveller.com.au/content/dam/images/3/5/o/g/5/image.related.articleLeadwide.620x349.gz1l7v.png/1508294036655.jpg
            //   http://www.traveller.com.au/content/dam/images/3/5/o/g/5/image.related.articleLeadwide.620x349.gz1l7v.png
            //   http://www.traveller.com.au/content/dam/images/3/5/o/g/5/image.
            // http://www.traveller.com.au/content/dam/images/1/0/f/c/k/q/image.
            //return src.replace(/(\/images\/[0-9a-z]\/[0-9a-z]\/[0-9a-z]\/[0-9a-z]\/[0-9a-z]\/image\.).*$/, "$1");
            return src.replace(/(\/images\/(?:[0-9a-z]\/){4,}image\.).*$/, "$1");
        }

        if (domain === "getwallpapers.com") {
            // http://getwallpapers.com/wallpaper/small/4/b/a/573224.jpg
            //   http://getwallpapers.com/wallpaper/full/4/b/a/573224.jpg
            return src.replace(/\/wallpaper\/[^/]*\//, "/wallpaper/full/");
        }

        if (domain === "ideascdn.lego.com") {
            // https://ideascdn.lego.com/community/projects/be9/7b9/163334/2794778-o_1b5ccku8lf9a1sep1r8of4to8j7-thumbnail-b5Us8BCO1UerJg.png
            //   https://ideascdn.lego.com/community/projects/be9/7b9/163334/2794778-o_1b5ccku8lf9a1sep1r8of4to8j7.png
            // https://ideascdn.lego.com/community/projects/be9/7b9/163334/2794790-o_1b5ccmo8e53mofh1gnao2ag8ef-square-100.png
            return src
                .replace(/-thumbnail[^/.]*(\.[^/.]*)$/, "$1")
                .replace(/-square[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "images.newindianexpress.com") {
            // http://images.newindianexpress.com/uploads/user/imagelibrary/2018/2/2/w100X65/d5cd2a22045a49e1a1bfef3810b0144f.jpg
            //   http://images.newindianexpress.com/uploads/user/imagelibrary/2018/2/2/original/d5cd2a22045a49e1a1bfef3810b0144f.jpg
            return src.replace(/\/[wh][0-9]+X[0-9]*\//, "/original/");
        }

        if (domain === "image.spreadshirtmedia.com" && false) {
            // https://image.spreadshirtmedia.com/image-server/v1/designs/1001957174,width=178,height=178/harry-potter-hogwarts-express-coffee-mug.png
            //   https://image.spreadshirtmedia.com/image-server/v1/designs/1001957174/harry-potter-hogwarts-express-coffee-mug.png
            // doesn't work:
            //  https://image.spreadshirtmedia.com/image-server/v1/mp/products/T812A2MPA1663PT17X49Y58D1014395106S29/views/1,width=1200,height=1200,appearanceId=2,backgroundColor=E8E8E8,modelId=115,crop=detail,version=1515071979/deathgrips-men-s-premium-t-shirt.webp - 1200x1200
            //    https://image.spreadshirtmedia.com/image-server/v1/mp/products/T812A2MPA1663PT17X49Y58D1014395106S29/views/1/deathgrips-men-s-premium-t-shirt.webp -- 190x190, different image
            return src.replace(/(\/[0-9]*),(?:[^=/,]*=[^=/,]*,?){1,}(\/[^/]*$)/, "$1$2");
        }

        if (domain.match(/staticr[0-9]*\.blastingcdn\.com/)) {
            // http://staticr1.blastingcdn.com/media/photogallery/2017/10/14/660x290/b_586x276/a-family-was-rescued-by-the-harry-potter-hogwarts-express-in-the-scottish-highlands-image-credit-pixabaycc0_1631843.jpg
            //   http://static.blastingnews.com/media/photogallery/2017/10/14/main/a-family-was-rescued-by-the-harry-potter-hogwarts-express-in-the-scottish-highlands-image-credit-pixabaycc0_1631843.jpg
            return src
                .replace(/\/b_[0-9]+x[0-9]+\/([^/]*)$/, "/$1")
                .replace(/\/[0-9]+x[0-9]+\/([^/]*)$/, "/main/$1");
        }

        if (domain_nowww === "gjdream.com") {
            // http://www.gjdream.com/news/contents/UPFILE/2018/20180201485362_tmb.jpg
            //   http://www.gjdream.com/news/contents/UPFILE/2018/20180201485362.jpg
            return src.replace(/_tmb(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.imaeil.com") {
            // http://www.imaeil.com/m_wiz/imgsrc3.php?w=261&h=142&t=&rate=100&src=/news_img/event_plus/2018.02.02.14.04.38_mainphoto01_1.jpg
            //   http://www.imaeil.com//news_img/event_plus/2018.02.02.14.04.38_mainphoto01_1.jpg
            return src.replace(/\/m_wiz\/imgsrc[0-9]\.php.*?[?&]src=([^&]*).*/, "/$1");
        }

        if (domain === "www.kwnews.co.kr") {
            // untested due to it requiring download
            // http://www.kwnews.co.kr/kwnews_view.asp?kwurl=20180202-218020100137-3001.jpg
            //   http://www.kwnews.co.kr/newsphoto/2018/02/218020100137.jpg
            return src.replace(/\/kwnews_view\.asp?.*?kwurl=([0-9]{4})([0-9]{2})[0-9]*-([0-9]*)-[0-9]*(\.[^/.]*)$/, "/newsphoto/$1/$2/$3$4");
        }

        if (domain_nowww === "yeongnam.com" &&
            src.indexOf("/Photo/") >= 0) {
            // http://www.yeongnam.com/Photo/2018/01/26/S20180126.99001151846332501.jpg
            //   http://www.yeongnam.com/Photo/2018/01/26/R20180126.99001151846332501.jpg
            // R, L, M, S
            return src.replace(/\/[A-Z]([^/]*)$/, "/R$1");
        }

        // doesn't always work, due to .jpg/.jpeg
        if (domain_nowww === "yeongnam.com" &&
            src.indexOf("/news/screennews/") >= 0) {
            // http://www.yeongnam.com/news/screennews/159_20180329_L20180327_99001152405345001.jpg
            //   http://www.yeongnam.com/Photo/2018/03/27/R20180327.99001152405345001.jpeg
            return src
                .replace(/\/news\/screennews\/[0-9]+_[0-9]+_[A-Z]([0-9]{4})([0-9]{2})([0-9]{2})_([0-9]+)(\.[^/.]*)/,
                         "/Photo/$1/$2/$3/R$1$2$3.$4.jpeg");
        }

        if (domain === "db.kookje.co.kr") {
            // http://db.kookje.co.kr/news2000/photo/2018/0202/L20180202.22001000306i1.jpg
            // http://db.kookje.co.kr/news2000/photo/2012/0414/20120414.99002182507i1.jpg - 2568x1640
            //   http://db.kookje.co.kr/news2000/photo/2012/0414/L20120414.99002182507i1.jpg ??? (website overloaded, try again later, also generic 404 page)
            // L, S
            return src.replace(/\/[A-Z]([^/]*)$/, "/L$1");
        }

        if (domain_nowww === "kookje.co.kr") {
            // http://www.kookje.co.kr/news2011/screennews/thumb/466_20180305_20180305.99099001307i1.jpg
            //   http://www.kookje.co.kr/news2011/screennews/466_20180305_20180305.99099001307i1.jpg
            //   http://db.kookje.co.kr/news2000/photo/2018/0305/20180305.99099001307i1.jpg
            //   http://db.kookje.co.kr/news2000/photo/2018/0305/L20180305.99099001307i1.jpg
            // http://www.kookje.co.kr/news2011/screennews/466_20180305_20180305.99099001300i1.jpg
            //   http://db.kookje.co.kr/news2000/photo/2018/0305/20180305.99099001300i1.jpg
            //   http://db.kookje.co.kr/news2000/photo/2018/0305/L20180305.99099001300i1.jpg
            // http://www.kookje.co.kr/news2011/screennews/thumb/466_20180305_20180211.99099004174i1.jpg
            //   http://db.kookje.co.kr/news2000/photo/2018/0211/20180211.99099004174i1.jpg
            //   http://db.kookje.co.kr/news2000/photo/2018/0211/L20180211.99099004174i1.jpg
            return src
                .replace("/thumb/", "/")
                .replace(/.*\/[0-9]+_[0-9]+_([0-9]{4})([0-9]{4})([^/]*)$/, "http://db.kookje.co.kr/news2000/photo/$1/$2/L$1$2$3");
        }

        if (domain_nowww === "joongdo.co.kr") {
            // http://www.joongdo.co.kr/mnt/images/webdata/content/2018y/02m/01d/crop2018020101000198000004991.jpg
            //   http://www.joongdo.co.kr/mnt/images/file/2018y/02m/01d/2018020101000198000004991.jpg
            return src.replace(/\/webdata\/content\//, "/file/").replace(/\/[^0-9]*([0-9]*\.[^/.]*)$/, "/$1");
        }

        if (domain === "img.asiatoday.co.kr" && false) {
            // http://img.asiatoday.co.kr/webdata/content/2018y/02m/28d/20180228002024152_77_58.jpg
            //   http://img.asiatoday.co.kr/file/2018y/02m/28d/20180228002024152_1.jpg
            // http://img.asiatoday.co.kr/webdata/content/2018y/03m/09d/20180309010004779_77_58.jpg
            //   http://img.asiatoday.co.kr/file/2018y/03m/09d/20180309010004779_1.jpg - doesn't work
            //   http://img.asiatoday.co.kr/file/2018y/03m/09d/2018030901000828800047791.jpg - works
            // http://img.asiatoday.co.kr/webdata/content/2017y/03m/31d/20170331010021088_300_300.jpg
            //   http://img.asiatoday.co.kr/file/2017y/03m/31d/2017033101002937000210881.jpg
            return src.replace(/\/webdata\/content\/(.*)_[0-9]+_[0-9]+(\.[^/.]*)$/, "/file/$1_1$2");
        }

        if (domain === "jmagazine.joins.com" ||
            // http://www.urbanbug.net/uploads/gallery/photos/2083/thumb_31888-170-05-005.jpg
            //   http://www.urbanbug.net/uploads/gallery/photos/2083/31888-170-05-005.jpg
            (domain === "www.urbanbug.net" && src.indexOf("/uploads/") >= 0) ||
            // https://www.popco.net/zboard/data/sigma_forum/2018/04/25/thumb_53666d20e05f8691128b91b8456961a7.jpeg
            //   https://popco.net/zboard/data/sigma_forum/2018/04/25/53666d20e05f8691128b91b8456961a7.jpeg
            domain_nowww === "popco.net") {
            // https://jmagazine.joins.com/_data/photo/2018/01/thumb_237268740_ZeJ4MpkI_1.jpg
            return src.replace(/\/thumb_([^/]*)$/, "/$1");
        }

        if (domain === "img.tvreport.co.kr") {
            // http://img.tvreport.co.kr/images/20171017/20171017_1508207555_22483100_4.jpg?1512513157
            //   http://img.tvreport.co.kr/images/20171017/20171017_1508207555_22483100_0.jpg?1512513157
            // http://img.tvreport.co.kr/images/20171211/20171211_1512955026_44177100_1.jpg (stretched)
            //   http://img.tvreport.co.kr/images/20171211/20171211_1512955026_44177100_0.jpg (smaller, but not stretched)
            // http://img.tvreport.co.kr/images/20171203/20171203_1512266720_61938500_1.jpg
            //   http://img.tvreport.co.kr/images/20171203/20171203_1512266720_61938500_0.jpg (larger)
            // 0 = original
            // 1 = large
            return src.replace(/_[0-9]*(\.[^/.]*)$/, "_0$1");
        }

        if (domain === "ojsfile.ohmynews.com") {
            // http://ojsfile.ohmynews.com/CT_T_IMG/2018/0131/IE002278988_APP.jpg?4957
            //   http://ojsfile.ohmynews.com/PHT_IMG_FILE/2018/0131/IE002278988_PHT.jpg
            //   http://ojsfile.ohmynews.com/BIG_IMG_FILE/2018/0131/IE002278988_BIG.jpg
            //   http://ojsfile.ohmynews.com/ORG_IMG_FILE/2018/0131/IE002278988_ORG.jpg
            // http://ojsfile.ohmynews.com/CT_T_IMG/2018/0201/IE002279450_APP.jpg?2034
            //   http://ojsfile.ohmynews.com/PHT_IMG_FILE/2018/0201/IE002279450_PHT.jpg
            //   http://ojsfile.ohmynews.com/BIG_IMG_FILE/2018/0201/IE002279450_BIG.jpg
            //   http://ojsfile.ohmynews.com/ORG_IMG_FILE/2018/0201/IE002279450_ORG.jpg
            // http://ojsfile.ohmynews.com/STD_IMG_FILE/2013/0705/IE001596678_STD.jpg
            //   http://ojsfile.ohmynews.com/ORG_IMG_FILE/2013/0705/IE001596678_ORG.jpg
            return src
                .replace(/\/CT_T_IMG\/(.*?)\/([^/]*)_APP(\.[^/.]*?)(?:\?.*)?$/, "/ORG_IMG_FILE/$1/$2_ORG$3")
                .replace(/\/[A-Z]*_IMG_FILE\/(.*?)\/([^/]*)_[A-Z]*(\.[^/.]*)(?:\?.*)?$/, "/ORG_IMG_FILE/$1/$2_ORG$3");
        }

        if (domain === "cmsimg.mnet.com") {
            // wip
            // http://cmsimg.mnet.com/clipimage/artist/240/000/428/428228.jpg
            // http://cmsimg.mnet.com/clipimage/artist/Other/610/000/167/167134.jpg
            //   http://cmsimg.mnet.com/clipimage/artist/Other/1024/000/167/167134.jpg
            //   http://cmsimg.mnet.com/clipimage/artist/Other/000/167/167134.jpg -- 404
            // http://cmsimg.mnet.com/clipimage/vod/Other/000/058/58694.jpg
            //   http://cmsimg.mnet.com/clipimage/vod/Other/610/000/058/58694.jpg -- scaled down to 400x600
            // http://static.global.mnet.com/data/ucc/000/162/359
            // http://static.global.mnet.com/data/ucc/000/162/442
            // http://mnetimg.mnet.com/tvmnetimg/admin/poll/2014/10/1_1413538495789.jpg
            // http://cmsimg.mwave.me/pgmVideo/contentImgUrl/201711/10/0b694d59-29d6-4d36-8470-0e2db3a32e8f.jpg
            // https://cjmwave-prd.s3.ap-northeast-2.amazonaws.com/ion/front/editor/201801/10/e6d980fe-53c3-4604-bce7-08d98c7f2d99.jpg
            //return src.replace(/(\/clipimage\/[^/]*)\/[0-9]*\//, "$1/1024/");
            var regex = /(\/clipimage\/.*?[^0-9]\/)[0-9]+\/([0-9]+\/[0-9]+\/[0-9]+\.[^/.]*)$/;
            return [
                src.replace(regex, "$1$2"),
                src.replace(regex, "$11024/$2")
            ];
        }

        if (domain === "image.cloud.sbs.co.kr") {
            // http://image.cloud.sbs.co.kr/smr/clip/201605/20/ihv2JuZcKz8ChXAsxFPPpC_320.jpg
            //   http://image.cloud.sbs.co.kr/smr/clip/201605/20/ihv2JuZcKz8ChXAsxFPPpC.jpg
            return src.replace(/_[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/cdn-ak-scissors\.[a-z]\.st-hatena\.com/) ||
            domain === "cdn.image.st-hatena.com") {
            // https://cdn-ak-scissors.b.st-hatena.com/image/scale/6b49da1455b11be153a6a5c060fbb6a65ada1cde/enlarge=0;height=480;type=max;version=1;width=480/https%3A%2F%2Fcdn.image.st-hatena.com%2Fimage%2Fscale%2F4220af82af99afcb2b70c52a3d4ee7a5cea0ba38%2Fbackend%3Dimager%3Benlarge%3D0%3Bheight%3D1000%3Bversion%3D1%3Bwidth%3D1200%2Fhttps%253A%252F%252Fcdn.user.blog.st-hatena.com%252Fdefault_entry_og_image%252F672828%252F1514219817468589
            //   https://cdn.image.st-hatena.com/image/scale/4220af82af99afcb2b70c52a3d4ee7a5cea0ba38/backend=imager;enlarge=0;height=1000;version=1;width=1200/https%3A%2F%2Fcdn.user.blog.st-hatena.com%2Fdefault_entry_og_image%2F672828%2F1514219817468589
            //   https://cdn.user.blog.st-hatena.com/default_entry_og_image/672828/1514219817468589
            // https://cdn-ak-scissors.b.st-hatena.com/image/square/2fc5e622ac7d1dc703f1059dcacff46f0afbb002/height=90;version=1;width=120/http://livedoor.blogimg.jp/milano/imgs/1/b/1b341774.jpg
            return decodeURIComponent(src.replace(/.*?\/image\/(?:scale|square)\/[^/]*\/[^/]*\/(.*)$/, "$1"));
        }

        if (domain === "pimg.togetter.com") {
            // https://pimg.togetter.com/1ac25d603c8ca6f205c7fbfb13f0413ed09017dc/68747470733a2f2f7062732e7477696d672e636f6d2f6d656469612f445536524d442d567741457a3969552e6a70673a6c61726765?w=1200&h=630&t=c
            //   https://pimg.togetter.com/1ac25d603c8ca6f205c7fbfb13f0413ed09017dc/68747470733a2f2f7062732e7477696d672e636f6d2f6d656469612f445536524d442d567741457a3969552e6a70673a6c61726765?w=o&h=o
            return src.replace(/\?[^/]*$/, "?w=o&h=o");
        }

        if (domain === "nimage.newsway.kr" && false) {
            // http://nimage.newsway.kr/phpwas/restmb_idxmake.php?idx=6&simg=20180116000099_0640.jpg
            // http://nimage.newsway.kr/phpwas/restmb_idxmake.php?idx=200&simg=20180202000058_1024.jpg
            return src.replace(/\/phpwas\/restmb_idxmake\.php.*?simg=([0-9]{4})([0-9]{2})([0-9]{2})([^&]*).*?$/, "/photo/$1/$2/$3/$1$2$3$4");

            // http://nimage.newsway.kr/photo/2018/02/01/20180201000273_0480.jpg
            // doesn't work for all:
            // http://nimage.newsway.kr/photo/2016/08/26/20160826000014_0640.png
            //return src.replace(/_[0-9]+(\.[^/.]*)$/, "_1024$1");
        }

        if (domain === "imgsrv.piclick.me") {
            // http://imgsrv.piclick.me/cimg/163x220xN_477539.jpg
            return src.replace(/\/cimg\/[0-9]+x[0-9]+x/, "/cimg/");
        }

        if (domain_nowww === "slate.com") {
            // http://www.slate.com/content/dam/slate/blogs/browbeat/2017/12/01/how_pixar_made_coco_the_biggest_box_office_hit_in_mexico_s_history/cocorgb_c041_41a_pubpub16565.jpg.CROP.promo-xlarge2.jpg
            //   http://www.slate.com/content/dam/slate/blogs/browbeat/2017/12/01/how_pixar_made_coco_the_biggest_box_office_hit_in_mexico_s_history/cocorgb_c041_41a_pubpub16565.jpg
            return src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
        }

        if (domain === "img.cinemablend.com") {
            // https://img.cinemablend.com/filter:scale/quill/3/d/0/6/a/d/3d06addd736f79f9449400bed217e59f98ff86af.jpg?mw=600
            //   https://img.cinemablend.com/quill/3/d/0/6/a/d/3d06addd736f79f9449400bed217e59f98ff86af.jpg
            return src.replace(/cinemablend\.com\/filter:[^/]*\/(.*?)(?:\?[^/]*)?$/, "cinemablend.com/$1");
        }

        if (domain.match(/r[0-9]*\.abcimg\.es/) &&
            src.indexOf("/resizer.php") >= 0) {
            // http://r1.abcimg.es/resizer/resizer.php?imagen=http%3A%2F%2Fwww.abc.es%2Fmedia%2Fsociedad%2F2018%2F02%2F01%2Freina-letizia-kYuH--420x236%40abc.jpg&nuevoancho=128&nuevoalto=73&crop=1&medio=abc
            //   http://www.abc.es/media/sociedad/2018/02/01/reina-letizia-kYuH--420x236@abc.jpg
            //   http://www.abc.es/media/sociedad/2018/02/01/reina-letizia-kgrH-U213052464546JvF-620x370@abc.jpg
            return decodeURIComponent(src.replace(/.*\/resizer\.php.*?[?&]imagen=([^&]*).*$/, "$1"));
        }

        if (domain.match(/ugc-[0-9]*\.cafemomstatic\.com/) && false) {
            // https://ugc-01.cafemomstatic.com/gen/crop/9999/9999/0/2018/02/01/11/4g/tr/po8puaj0cg72.png
            // http://ugc-01.cafemomstatic.com/gen/crop/9999/9999/0/2018/01/25/11/44/8r/ph1gxpvbeo2qbwe.jpg -- stretched
            return src.replace(/\/gen\/crop\/[0-9]*\/[0-9]*\/[0-9]*\//, "/gen/crop/9999/9999/0/");
        }

        if (domain === "vz.cnwimg.com") {
            // https://vz.cnwimg.com/thumbc-300x300/wp-content/uploads/2012/03/coco.jpg
            // https://vz.cnwimg.com/thumb-300x170/wp-content/uploads/2018/01/GettyImages-127497645.jpg
            return src.replace(/\/thumb[a-z]*-[0-9]+x[0-9]+\//, "/");
        }

        if (domain_nowww === "coleman-rayner.com" &&
            src.indexOf("/watermark/insertwm.php?") >= 0) {
            // http://www.coleman-rayner.com/watermark/insertwm.php?src=http%3A%2F%2Fwww.coleman-rayner.com%2Fwp-content%2Fuploads%2F2014%2F09%2F05.-INSIDE-COCO%E2%80%99S-LAS-VEGAS-WARDROBE-1000.jpg
            return {
                can_head: false,
                url: decodeURIComponent(src.replace(/.*\/watermark\/insertwm\.php.*?[?&]src=([^&]*).*$/, "$1"))
            };
        }

        if (domain === "media.guestofaguest.com") {
            // http://media.guestofaguest.com/t_card_medium/wp-content/uploads/wppa/Coco_Austin6.jpg
            //   http://media.guestofaguest.com/wp-content/uploads/wppa/Coco_Austin6.jpg
            return src.replace(/(:\/\/[^/]*\/)[^/]*\/(wp-content\/)/, "$1$2");
        }

        if (domain.match(/i[0-9]*\.heartyhosting\.com/)) {
            // https://i0.heartyhosting.com/starmagazine.com/wp-content/uploads/2016/01/ice-t-coco-austin-baby-chanel-body-anniversary-dress-05.jpg
            return src.replace(/.*?:\/\/[^/]*\//, "http://");
        }

        if (domain === "images.contactmusic.com") {
            // http://images.contactmusic.com/newsimages/wenn2949343_1_14734_24-cm.jpg
            //   http://images.contactmusic.com/newsimages/wenn2949343_1_14734_24.jpg
            return src.replace(/-cm(\.[^/.]*)$/, "$1");
        }

        if (domain === "d15mj6e6qmt1na.cloudfront.net") {
            // https://d15mj6e6qmt1na.cloudfront.net/i/19186419/600/c
            //   https://d15mj6e6qmt1na.cloudfront.net/i/19186419
            return src.replace(/(\/i\/[0-9]*)\/.*/, "$1");
        }

        if (domain.match(/tse[0-9]*\.mm\.bing\.net/) ||
            domain.indexOf(".bing.com") >= 0) {
            // https://tse1.mm.bing.net/th?id=Ad9e81485410912702a018d5f48ec0f5c&w=136&h=183&c=8&rs=1&qlt=90&pid=3.1&rm=2
            // https://www.bing.com/th?id=OPN.RTNews_jJZmvGD6PzvUt22LbHHUUg&w=186&h=88&c=7&rs=2&qlt=80&cdv=1&pid=News
            return src.replace(/(:\/\/[^/]*)\/th[^/]*[?&]id=([^&]*)&[^/]*$/, "$1/th?id=$2");
        }

        if (domain === "cdn.4archive.org") {
            // https://cdn.4archive.org/img/t4Drepmm.jpg
            //   https://cdn.4archive.org/img/t4Drepm.jpg
            return src.replace(/(\/img\/[^/.]{7})m(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "i.4cdn.org") {
            // http://i.4cdn.org/hr/1517608108705s.jpg
            //   http://i.4cdn.org/hr/1517608108705.jpg
            return src.replace(/(\/[0-9]*)s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "file.tinnhac.com" ||
            domain === "file.tintuckpop.net" ||
            // different though? - and crop don't work
            // https://image.vtc.vn/resize/80x60/files/news/2018/02/21/-210540.jpg
            domain === "image.vtc.vn") {
            // https://file.tinnhac.com/crop/97x74/music/2018/02/03/3-e875.jpg
            //   https://file.tinnhac.com/music/2018/02/03/3-e875.jpg
            // https://file.tinnhac.com/resize/600x-/2016/05/25/1eca49c4b-0953.jpg
            //   https://file.tinnhac.com/2016/05/25/1eca49c4b-0953.jpg
            // http://file.tintuckpop.net/resize/640x-/2016/05/16/1a922-1670.jpg
            // http://file.tintuckpop.net/crop/210x158/tintuckpop/2018/02/22/shinminah-1519107250-d126.jpg
            return src
                .replace(/\/crop\/[-0-9]+x[-0-9]+\//, "/")
                .replace(/\/resize\/[-0-9]+x[-0-9]+\//, "/");
        }

        if (domain.indexOf(".zadn.vn") >= 0 ||
            domain.match(/image\.(?:[^/.]*\.)?vov\.vn/) ||
            domain === "media.laodong.vn") {
            // https://znews-photo-td.zadn.vn/w960/Uploaded/qfssu/2017_11_05/NGT.jpg
            //   https://znews-photo-td.zadn.vn/Uploaded/qfssu/2017_11_05/NGT.jpg
            // http://image.english.vov.vn/w490/uploaded/wzzqbijjvws/2016_02_25/tara_GCLM.jpg
            //   http://image.english.vov.vn/uploaded/wzzqbijjvws/2016_02_25/tara_GCLM.jpg
            // http://image.english.vov.vn/130x82/Uploaded/TmT2B47lHgLy8UZVeuKg/2018_02_04/Xoang_singing_DPVE.jpg
            // http://image.english.vov.vn/h500/uploaded/wzzqbijjvws/2016_03_14/tara_2_KUJE.jpg
            // https://baomoi-photo-2-td.zadn.vn/w700_r1m/16/03/13/105/18868393/9_65381.jpg
            // https://media.laodong.vn/Uploaded/thuctapsinh/2016_03_13/6_QVZZ.jpg?w=629&h=419&crop=auto&scale=both
            return src
                .replace(/(:\/\/[^/]*)\/[wh][0-9]+(?:_[^/]*)?\//, "$1/")
                .replace(/(:\/\/[^/]*)\/[0-9]+x[0-9]+\//, "$1/")
                .replace(/\?.*$/, "");
        }

        if (domain === "cdn.tuoitre.vn" ||
            domain === "dantricdn.com" ||
            // http://afamilycdn.com/thumb_w/660/2017/taf-0942-1509860607829.jpg
            domain === "afamilycdn.com" ||
            // https://cafebiz.cafebizcdn.vn/thumb_w/600/2016/14593683-10210661710609628-1503569961-n-1475666918244-crop-1475673547715.jpg
            //   https://cafebiz.cafebizcdn.vn/2016/14593683-10210661710609628-1503569961-n-1475666918244-crop-1475673547715.jpg
            //   http://cafebiz.cafebizcdn.vn/2016/14593683-10210661710609628-1503569961-n-1475666918244.jpg
            domain.indexOf(".cafebizcdn.vn") >= 0 ||
            domain.indexOf(".sohacdn.com") >= 0 ||
            // http://kenh14cdn.com/thumb_w/300/2016/img-6763-1458013125674-25-0-650-1000-crop-1458013471506.jpg
            //   http://kenh14cdn.com/2016/img-6763-1458013125674.jpg
            domain.indexOf("kenh14cdn.com") >= 0 ||
            // https://dantricdn.com/zoom/327_245/2018/2/22/img4232-15192810897621333688893.jpg
            //   https://dantricdn.com/thumb_w/600/2018/2/22/img4232-15192810897621333688893.jpg
            domain === "dantricdn.com" ||
            // https://cafebiz.cafebizcdn.vn/zoom/420_264/2018/2/22/photo1519268407880-15192684078814005972.jpg
            domain === "cafebiz.cafebizcdn.vn" ||
            // https://vtv1.mediacdn.vn/zoom/93_93/2018/2/22/nauy-crop-1519281533709468961755.jpg
            domain.indexOf(".mediacdn.vn") >= 0) {
            // https://cdn.tuoitre.vn/thumb_w/640/2017/5-nguoi-ham-mo-1509855071319.jpg
            //   https://cdn.tuoitre.vn/2017/5-nguoi-ham-mo-1509855071319.jpg
            // https://dantricdn.com/thumb_w/640/487bd2df65/2016/09/24/chipi-1474675645816.jpg
            // http://sohanews.sohacdn.com/thumb_w/1000/2017/photo-1-1510035508692-0-57-337-600-crop-1510035607740.jpg
            //   http://sohanews.sohacdn.com/2017/photo-1-1510035508692.jpg
            return src
                .replace(/\/zoom\/[^/]*\//, "/")
                .replace(/-[0-9]+-[0-9]+-[0-9]+-[0-9]+-crop-[0-9]+(\.[^/.]*)$/, "$1")
                .replace(/-crop-[0-9]{13,}(\.[^/.]*)$/, "$1")
                .replace(/(:\/\/[^/]*)\/thumb_[a-z]\/[0-9]+\//, "$1/");
        }

        if (domain_nosub === "24hstatic.com" ||
            // https://image-us.24h.com.vn/upload/2-2018/images/2018-06-07/medium/nguoi-gay-an-gi-av-1528357320-626-width640height480.jpg
            //   https://image-us.24h.com.vn/upload/2-2018/images/2018-06-07/nguoi-gay-an-gi-av-1528357320-626-width640height480.jpg
            // https://image-us.24h.com.vn/upload/1-2018/images/2018-02-09/1518170617-487-sao--8--1518169128-width650height482_97_125.jpg
            //   https://image-us.24h.com.vn/upload/1-2018/images/2018-02-09/1518170617-487-sao--8--1518169128-width650height482.jpg
            domain.indexOf(".24h.com.vn") >= 0 ||
            // http://anh.24h.com.vn//upload/4-2017/images/2017-11-08/medium/1510125598-629-151011694144796-chi-pu-5.jpg
            domain === "anh.eva.vn") {
            // https://eva-img.24hstatic.com/upload/1-2017/images/2017-01-18/large/1484712995-1ava.jpg
            //   https://eva-img.24hstatic.com/upload/1-2017/images/2017-01-18/large/1484712995-1ava.jpg
            // https://eva-img.24hstatic.com/upload/1-2017/images/2017-01-18/san-khau-dem-nhac-bi-chay-t-ara-van-nhiet-tinh-het-minh-vi-khan-gia-1-1484711458-width500height334.jpg
            // https://eva-img.24hstatic.com/upload/4-2017/images/2017-10-15/extra_large/1508037671-thumbnail.jpg
            //   https://eva-img.24hstatic.com/upload/4-2017/images/2017-10-15/1508037671-thumbnail.jpg
            // https://eva-img.24hstatic.com/upload/1-2018/images/2018-02-01/thumbnail/cover1-1517500750-188-width640height480.jpg
            //   https://eva-img.24hstatic.com/upload/1-2018/images/2018-02-01/cover1-1517500750-188-width640height480.jpg
            // https://anh.eva.vn///upload/1-2016/images/2016-03-13/medium/1457807610-ava1.jpg
            return src
                .replace(/(\/images\/.*)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1$2")
                .replace(/(\/images\/[0-9]*-[0-9]*-[0-9]*\/)[^/]*\/([^/]*)$/, "$1$2");
        }

        if (domain.match(/static[0-9]*\.yan\.vn/) ||
            // https://www.mjuznews.com/public/photos/1000/236/604x320_236-Wikluh_Sky.jpg
            //   https://www.mjuznews.com/public/photos/1000/236/236-Wikluh_Sky.jpg
            (domain === "www.mjuznews.com" && src.indexOf("/photos/") >= 0)) {
            // http://static2.yan.vn/YanThumbNews/2167221/201711/260x130_414f9ea4-e35b-4b11-aed5-883b288ea050.jpg
            //   http://static2.yan.vn/YanThumbNews/2167221/201711/414f9ea4-e35b-4b11-aed5-883b288ea050.jpg
            return src.replace(/\/[0-9]+x[0-9]+_([^/]*)$/, "/$1");
        }

        if (domain === "image.thanhnien.vn") {
            // https://image.thanhnien.vn/1600/uploaded/phangiang/2016_03_12/anh_lfyk.jpg
            return src.replace(/(:\/\/[^/]*)\/[0-9]*\//, "$1/");
        }

        if (domain === "media-local.phunu365.net") {
            // http://media-local.phunu365.net/api1x1/res/ext/0x0/r/image.24h.com.vn/upload/1-2017/images/2017-01-16/1484562734-148456151330358-dia-1.jpg
            return src.replace(/.*?\/api[0-9]+x[0-9]+\/res\/ext\/[0-9]+x[0-9]+\/[^/]*\//, "http://");
        }

        if (domain.match(/.*media[0-9]*\.nguoiduatin\.vn/)) {
            // http://xmedia.nguoiduatin.vn/amp_thumb_x1120x832/ndt/16/03/12/202/18865226/8_288040.jpg
            // http://media1.nguoiduatin.vn/thumb_x680x354/media/le-nham-than/2018/02/04/hoa.png
            return src.replace(/(:\/\/[^/]*)\/[^/]*x[0-9]+x[0-9]+\//, "$1/");
        }

        if (domain === "www.wowkorea.live") {
            // http://www.wowkorea.live/img/album/8/42081/76033_m.jpg
            return src.replace(/(\/[0-9]*)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain.match(/img[^.]*\.seoul\.co\.kr/)) {
            // http://img.seoul.co.kr/img/upload/2018/02/04/SSI_20180204221012_V.jpg
            //   http://img.seoul.co.kr/img/upload/2018/02/04/SSI_20180204221012.jpg
            // none, O, V, L, S, N, N2, N3, N4, N5
            // http://img.seoul.co.kr//img/upload/2017/02/20/SSI_20170220101030_V.jpg
            //   http://img.seoul.co.kr//img/upload/2017/02/20/SSI_20170220101030.jpg
            // (V, none), O, L, S, N,...
            // http://imgnn.seoul.co.kr/img//upload/2009/01/20/SSI_20090120114407_V.jpg
            //
            // http://img.seoul.co.kr/img/upload/2015/12/29/SSI_20151229090141_V.jpg
            //   http://img.seoul.co.kr/img/upload/2015/12/29/SSI_20151229090141.jpg - 2500x3235
            return src.replace(/_[A-Z](?:[0-9]){0,2}(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.yonhapnews.co.kr") {
            // http://img.yonhapnews.co.kr/photo/yna/YH/2017/12/30/PYH2017123017200001300_P1.jpg
            //   http://img.yonhapnews.co.kr/photo/yna/YH/2017/12/30/PYH2017123017200001300_P4.jpg
            // http://img.yonhapnews.co.kr/etc/graphic/YH/2017/10/25/GYH2017102500160004400.jpg
            // http://img.yonhapnews.co.kr/etc/inner/EN/2018/02/19/AEN20180219010000315_02_i.jpg
            // http://img.yonhapnews.co.kr/etc/graphic/YH/2013/11/28/GYH2013112800040003900_P2.jpg
            // http://img.yonhapnews.co.kr/etc/inner/KR/2017/04/28/AKR20170428061900017_01_i.jpg
            // http://img.yonhapnews.co.kr/mpic/YH/2018/02/23/MYH20180223017200038.jpg (1920x1080)
            // http://img.yonhapnews.co.kr/etc/inner/KR/2016/11/03/AKR20161103119100061_01_i.jpg (3810x2704)
            return src.replace(/(\/PYH[^/_.]*)_[^/.]*(\.[^/.]*)$/, "$1_P4$2");
        }

        if (domain.match(/big[0-9]*\.yonhapnews\.co\.kr/)) {
            // http://big5.yonhapnews.co.kr:83/gate/big5/img.yonhapnews.co.kr/basic/template/ck/2018/02/09/tmp_4504_20180209103744.jpg
            //   http://img.yonhapnews.co.kr/basic/template/ck/2018/02/09/tmp_4504_20180209103744.jpg
            return src.replace(/.*:\/\/[^/]*\/gate\/[^/]*\//, "http://");
        }

        if (domain.indexOf(".bunjang.net") >= 0) {
            // http://seoul-p-studio.bunjang.net/product/64557873_1_1514396938_w320.jpg
            //   http://seoul-p-studio.bunjang.net/product/64557873_1_1514396938.jpg
            return src.replace(/_[wh][0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf("betanews.heraldcorp.com") >= 0 ||
            domain_nowww === "betanews.net") {
            // http://betanews.heraldcorp.com:8080/imagedb/thumb/2017/0821/acc59960.jpg
            //   http://betanews.heraldcorp.com:8080/imagedb/orig/2017/0821/acc59960.jpg
            // http://www.betanews.net/imagedb/first/2018/0204/d37686d0.jpg
            //   http://betanews.net/imagedb/orig/2018/0204/d37686d0.jpg
            // http://www.betanews.net/imagedb/main/thumb/805/805660.jpg
            //   http://www.betanews.net/imagedb/main/orig/805/805660.jpg
            return src
            .replace(/(\/imagedb\/(:?[^/]*\/)?)(?:first|thumb)\//, "$1orig/");
        }

        if (domain === "img.smlounge.co.kr") {
            // http://img.smlounge.co.kr/upload/grazia/article/201611/thumb/32609-190630-sampleM.jpg
            //   http://img.smlounge.co.kr/upload/grazia/article/201611/32609-190630.jpg
            // http://www.smlounge.co.kr/upload/grazia/article/201801/thumb/37419-279467-sample.jpg
            //   http://img.smlounge.co.kr/upload/grazia/article/201801/37419-279467.jpg
            return src.replace(/\/thumb\/([^/.]*)-sample[^/.-]*(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "img.etoday.co.kr" && false) {
            // wip
            // http://www.etoday.co.kr/news/section/newsview_photo.php?idxno=1315836&seq=1
            // http://img.etoday.co.kr/pto_db/2016/04/20160412091428_851269_450_691.jpg (450x691)
            // http://img.etoday.co.kr/html/lib_img_crop.php?id=851269&mw=300&mh=225 (doesn't go up to 691, stretches)
        }

        if (domain === "image.tving.com" &&
            src.indexOf("tving.com/resize.php") >= 0) {
            // http://image.tving.com/resize.php?u=http://image.tving.com/upload/smr/clip/2018/02/04/C01_150548_0405.jpg&w=228
            return src.replace(/.*:\/\/[^/]*\/resize\.php.*?[?&]u=([^&]*).*/, "$1");
        }

        if (domain === "cdn.pastemagazine.com") {
            // https://cdn.pastemagazine.com/www/articles/assets_c/2015/02/skyrim%20mod%206-thumb-500x281-138387.jpg
            //   https://cdn.pastemagazine.com/www/articles/skyrim%20mod%206.jpg
            return src.replace(/(\/[^/]*\/)assets_[^/]*\/[0-9]*\/[0-9]*\/([^-]*)-.*(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain === "www.beauty-co.jp") {
            // https://www.beauty-co.jp/news/assets_c/2018/02/180228_lucy_01-thumb-142xauto-21539.jpg
            //   https://www.beauty-co.jp/news/img/180228_lucy_01.jpg
            return src.replace(/\/news\/assets_[^/]*\/[0-9]*\/[0-9]*\/([^-]*)-.*(\.[^/.]*)$/, "/news/img/$1$2");
        }

        if (domain === "seichimap.jp") {
            // https://seichimap.jp/contents/assets_c/2015/08/P8150066-thumb-400xauto-539.jpg
            //   https://seichimap.jp/contents/pht/P8150066.JPG
            newsrc = src.replace(/(\/[^/]*\/)assets_[^/]*\/[0-9]*\/[0-9]*\/([^-]*)-.*(\.[^/.]*)$/, "$1pht/$2$3");
            if (newsrc !== src) {
                return [
                    newsrc,
                    newsrc.replace(".jpg", ".JPG")
                ];
            }
        }

        if (domain === "www.agencyteo.com") {
            // http://www.agencyteo.com/news/download/28302/w/600/KakaoTalk_20161121_144905918.jpg
            //   http://www.agencyteo.com/news/download/28302/KakaoTalk_20161121_144905918.jpg
            // http://www.agencyteo.com/news/download/48614/w/600/735318-800w.jpg
            //   // http://www.agencyteo.com/news/download/48614/735318.jpg
            return src
                .replace(/-[0-9]*[wh]*(\.[^/.]*)$/, "$1")
                .replace(/(\/download\/[0-9]*\/)[wh]\/[0-9]*\//, "$1");
        }

        if (domain.match(/s[0-9]*\.riotpixels\.net/)) {
            // http://s01.riotpixels.net/data/37/29/3729e0a0-9e4c-4efa-9eb2-f89f17dde8fa.jpg.240p.jpg
            // http://s01.riotpixels.net/data/37/29/3729e0a0-9e4c-4efa-9eb2-f89f17dde8fa.jpg/screenshot.assassins-creed-origins.1920x1080.2017-11-25.87.jpg
            //   http://s01.riotpixels.net/data/37/29/3729e0a0-9e4c-4efa-9eb2-f89f17dde8fa.jpg
            // http://s01.riotpixels.net/data/b5/d0/b5d0cf29-9c4e-44f1-a2f4-1a5613453006.jpg.240p.jpg
            return src.replace(/(\/data\/[a-f0-9]*\/[a-f0-9]*\/[^./]*\.[^/.]*)[./].*$/, "$1");
        }

        if (domain.match(/assets[0-9]*\.ignimgs\.com/) ||
            domain.match(/assets[0-9]*\.ign\.com/)) {
            // http://assets1.ignimgs.com/2018/02/02/ac-origins-the-hidden-ones---button-1517533272073_180h.jpg
            // http://assets1.ignimgs.com/2018/02/06/nightinthewoods-deck-ff6c25-1517944777381_358w.jpg
            // http://assets1.ignimgs.com/2017/05/09/1-1-1494366320371_grande.jpg
            //   http://assets1.ignimgs.com/2017/05/09/1-1-1494366320371.jpg
            // https://assets.ign.com/thumbs/userUploaded/2014/9/19/20823568_fatalframewiiu_tgs2014trailer_ign-1411150047803_medium.jpg
            //return src.replace(/_[0-9]*[wh](\.[^/.]*)$/, "$1");
            return src.replace(/_[^-_/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "static.gamespot.com") {
            // https://static.gamespot.com/uploads/square_tiny/1578/15789737/3348796-alteredcarbon.jpg
            //   https://static.gamespot.com/uploads/original/1578/15789737/3348796-alteredcarbon.jpg
            return src.replace(/\/uploads\/[^/]*\//, "/uploads/original/");
        }

        if (domain === "i.neoseeker.com" &&
            src.match(/\/size\/[0-9]+x[0-9]+\//)) {
            // https://i.neoseeker.com/size/166x85/1/n/1/1500662379_dbz_disc_display.jpg
            //   https://i.neoseeker.com/size/0x0/1/n/1/1500662379_dbz_disc_display.jpg
            return src.replace(/\/size\/[0-9]+x[0-9]+\//, "/size/0x0/");
        }

        if (domain === "i.neoseeker.com" &&
            src.match(/\/p\/[0-9]*\/[0-9]*\//)) {
            // https://i.neoseeker.com/p/206/46/dragon-ball-fighterz_thumb_pOUTR.jpg
            //   https://i.neoseeker.com/screenshots/MjA2LzQ2Lw==/dragon-ball-fighterz_image_pOUTR.jpg
            //   https://i.neoseeker.com/p/206/46/dragon-ball-fighterz_image_pOUTR.jpg
            return src.replace(/_thumb_([^/]*$)/, "_image_$1");
        }

        if (domain === "resource.supercheats.com") {
            // https://resource.supercheats.com/library/640w/ember/emb_intro.jpg
            // https://resource.supercheats.com/library/thumbs/2018/1515877801dlc.png
            return src.replace(/\/library\/(?:(?:[0-9]*[wh])|thumbs)\//, "/library/");
        }

        if (domain === "intergi-phoenix.s3.amazonaws.com") {
            // https://intergi-phoenix.s3.amazonaws.com/1021319/videos/5450791/images/thumb_large_Cod-WWII-dlc.jpg
            return src.replace(/\/images\/thumb_large_([^/]*)$/, "/images/$1");
        }

        if (domain === "www.primagames.com") {
            // https://www.primagames.com/media/images/news/Playdead-Inside-ResearchFacility-40.jpg/PRIMA/resize/100x/format/jpg
            // https://www.primagames.com/media/files/news/dragon-age-inquisition-landing-page/dragon-age-inquisition-cover-ce.png/PRIMAP/resize/618x/format/jpg/quality/80 -- scaled up
            //   https://www.primagames.com/media/files/news/dragon-age-inquisition-landing-page/dragon-age-inquisition-cover-ce.png
            return src.replace(/\/PRIMAP?\/.*/, "");
        }

        if (domain.match(/s[0-9]*-[^.]*\.ixquick\.com/)) {
            // https://s15-us2.ixquick.com/cgi-bin/serveimage?url=http%3A%2F%2Ft0.gstatic.com%2Fimages%3Fq%3Dtbn%3AANd9GcQybc24UPrYyg-TnWPRUYH7zgzbQXgL4P86ngojIWv8J-Fzom7dAA&sp=ea6bc994daf22079cacb1e62879fa8d4&anticache=581224
            return decodeURIComponent(src.replace(/.*\/serveimage.*?[?&]url=([^&]*).*/, "$1"));
        }

        if (domain === "beta.ems.ladbiblegroup.com") {
            // http://beta.ems.ladbiblegroup.com/s3/content/353x199/0b7434735a7a95090e0210baf66f63ed.png
            return src.replace(/\/s3\/content\/[0-9]+x[0-9]+\//, "/s3/content/");
        }

        if (domain === "mtv-intl.mtvnimages.com") {
            // http://mtv-intl.mtvnimages.com/uri/mgid:arc:content:mtvasia.com:cdeab016-8964-423d-96ae-8ec187190fef?ep=mtvasia.com&stage=live&format=jpg&quality=0.8&quality=0.85&width=656&height=369&crop=true
            return src.replace(/(\?ep=[^&]*).*/, "$1");
        }

        if (domain === "gaia.adage.com") {
            // http://gaia.adage.com/images/bin/image/x-large/GettyImages90319988832.jpg?1515686676
            // http://gaia.adage.com/images/bin/image/medium/Bud-Light-Super-Bowl-2018---Bud-Knight.jpg?1517433099
            return src.replace(/\/images\/bin\/image\/[^/]*\//, "/images/bin/image/");
        }

        if (domain === "t-eska.cdn.smcloud.net") {
            // http://t-eska.cdn.smcloud.net/hotplota/t/2/t/image/98343cf69b8e6bfcd82fd21c1573c5b4IMU2KOV8-en-0.jpg/ru-0-r-600,600-n-98343cf69b8e6bfcd82fd21c1573c5b4IMU2KOV8en0.jpg
            //   http://t-eska.cdn.smcloud.net/hotplota/t/2/t/image/98343cf69b8e6bfcd82fd21c1573c5b4IMU2KOV8-en-0.jpg/n-98343cf69b8e6bfcd82fd21c1573c5b4IMU2KOV8en0.jpg
            // http://t-eska.cdn.smcloud.net/hotplota/t/2/t/image/adc18921067ea9ca27d451b35ac4b964a2tUvABZ-prze.PNG/ru-0-ra-280,255-n-adc18921067ea9ca27d451b35ac4b964a2tUvABZprze.PNG
            //   http://t-eska.cdn.smcloud.net/hotplota/t/2/t/image/adc18921067ea9ca27d451b35ac4b964a2tUvABZ-prze.PNG/n-adc18921067ea9ca27d451b35ac4b964a2tUvABZprze.PNG
            return src.replace(/\/[^/]*?n-([^/]*)$/, "/n-$1");
        }

        if (domain === "cdn.wegow.com") {
            // https://cdn.wegow.com/media/artist-media/bad-gyal/bad-gyal-4132.-1x2560.jpg - stretched
            return src.replace(/\.[-0-9]*x[-0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.ecestaticos.com") {
            // https://www.ecestaticos.com/image/clipping/330/74d2adf4c3ccfa3144086c71e16eabf3/alba-farelo-es-bad-gyal-una-de-las-mujeres-que-lidera-el-dancehall-espanol-gerard-lopez.jpg
            return src.replace(/\/clipping\/[0-9]*\//, "/clipping/0/");
        }

        if (domain === "sonarreykjavik.com" ||
            domain === "sonar.es") {
            // https://sonarreykjavik.com/system/attached_images/19379/medium/BadGyal_AlexisG%C3%B3mez.jpg?1513685256
            //   https://sonarreykjavik.com/system/attached_images/19379/large/BadGyal_AlexisG%C3%B3mez.jpg?1513685256
            //   https://sonarreykjavik.com/system/attached_images/19379/original/BadGyal_AlexisG%C3%B3mez.jpg?1513685256
            // https://sonar.es/system/attached_images/18702/medium/badgyal_xs_sonar2017_fernandoschlaepfer_004.jpg?1497713257
            return src.replace(/(\/attached_images\/[0-9]*\/)[^/]*\//, "$1original/");
        }

        if (domain === "pgw.udn.com.tw") {
            // https://pgw.udn.com.tw/gw/photo.php?u=https://uc.udn.com.tw/photo/2016/08/03/99/2447700.jpg&x=0&y=0&sw=0&sh=0&sl=W&fw=750
            // https://pgw.udn.com.tw/gw/photo.php?u=https://uc.udn.com.tw/photo/2018/05/16/realtime/4742890.jpg&x=0&y=0&sw=0&sh=0&sl=W&fw=1050&exp=3600
            //   https://uc.udn.com.tw/photo/2018/05/16/realtime/4742890.jpg
            return src.replace(/.*\/photo\.php.*?[?&]u=([^&]*).*/, "$1");
        }

        if (domain === "uc.udn.com.tw") {
            // https://uc.udn.com.tw/photo/2018/05/16/realtime/4742890.jpg -- HEAD returns 404
            return {
                url: src,
                can_head: false
            };
        }

        if (domain.match(/i[0-9]*\.hdslb\.com/) ||
            domain.match(/alcdn\.img\.xiaoka\.tv/)) {
            // https://i0.hdslb.com/bfs/bangumi/546991a5d3add9b550925b1168abf0a460e5f552.jpg@240w_320h.jpg
            // https://i2.hdslb.com/bfs/archive/6b1d06f79ec31b6e23e4ecb7eb87c53ccd86f965.jpg@.webp
            //   https://i2.hdslb.com/bfs/archive/6b1d06f79ec31b6e23e4ecb7eb87c53ccd86f965.jpg
            // http://i0.hdslb.com/320_180/u_user/a5ab2c18e8e4a62240fad3f0b040ba00.jpg
            //   http://i0.hdslb.com/u_user/a5ab2c18e8e4a62240fad3f0b040ba00.jpg
            // http://alcdn.img.xiaoka.tv/20160708/899/367/44745628/899367337e05da1af210de07ff2740e6.jpg@1e_1c_0o_0l_640h_640w_100q_1pr.jpg
            //   http://alcdn.img.xiaoka.tv/20160708/899/367/44745628/899367337e05da1af210de07ff2740e6.jpg
            return src
                .replace(/(:\/\/[^/]*\/)[0-9]+_[0-9]+\//, "$1")
            //.replace(/(\.[^/.]*)@(?:[0-9]*[a-z](?:_[0-9]*[wh])?)?(\.[^/.]*)$/, "$1");
                .replace(/(\.[^/.]*)@[_0-9a-z]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "d.ifengimg.com") {
            // http://d.ifengimg.com/w204_h115/p0.ifengimg.com/pmop/2017/1230/E538B9A1631291D8B1578F161157F26647C97944_size296_w448_h252.png
            // http://d.ifengimg.com/w600/p0.ifengimg.com/pmop/2017/0726/F4057A55111AE62724AF9C914EFEE425FEBD79C7_size41_w750_h422.jpeg

            return src.replace(/.*?\/[wh][0-9]*(?:_[wh][0-9]*)?\//, "http://");
            //return src.replace(/(:\/\/[^/]*\/)[wh][0-9]+(?:_[wh][0-9]*)?\//, "$1w0/");
        }

        if (domain === "www.nationalgeographic.com") {
            // https://www.nationalgeographic.com/content/dam/magazine/rights-exempt/2012/04/unseen-titanic/01-port-bow-titanic-3x2.ngsversion.1492030266842.adapt.1900.1.jpg
            //   https://www.nationalgeographic.com/content/dam/magazine/rights-exempt/2012/04/unseen-titanic/01-port-bow-titanic-3x2.jpg
            return src.replace(/\.[^/]*(\.[^/.]*)$/, "$1");
        }

        // fixme: find other and merge with it
        if (domain === "media.mnn.com" ||
            // https://alljapantours.com/places-to-visit-in-japan/most-beautiful-places-in-japan/img/issue_04most_photo01.jpg.pagespeed.ce.woxsyqYnu2.jpg
            domain === "alljapantours.com" ||
            // http://shows.gqimg.com.cn/showspic/FashionImages/F2018MEN/paris/louis-vuitton/collection/_VUI0653h.jpg.100X150.jpg
            domain === "shows.gqimg.com.cn" ||
            // http://shows.vogueimg.com.cn/showspic/FashionImages/S2017CTR/paris/alexandre-vauthier/collection/_ARC0726h.jpg.100X150.jpg
            domain === "shows.vogueimg.com.cn" ||
            // https://smedia.webcollage.net/rwvfp/wc/cp/22757735/module/cpwalmart/_cp/products/1472244742078/tab-0e3f8313-5e4d-4103-9de5-caca68cf8437/eaddf5d5-afe7-4086-9bc7-149b6b486cdd.jpg.w480.jpg
            domain.indexOf("media.webcollage.net") >= 0 ||
            // http://www.metronews.ca/content/dam/thestar/uploads/2017/3/29/oilers.jpg.size.xxlarge.promo.jpg
            domain === "www.metronews.ca" ||
            // https://images.meredith.com/content/dam/bhg/Images/life-in-color/arnold%20gian.jpg.rendition.largest.jpg
            domain === "images.meredith.com" ||
            // http://img-cdn.jg.jugem.jp/584/719314/20131206_802590.jpg.thumb.jpg
            domain === "img-cdn.jg.jugem.jp" ||
            // http://styleyen.com/galleries/6/image_slide/2/taylor-swift-bangs.jpg.thumb_200_width.jpg
            domain_nowww === "styleyen.com" ||
            // http://www.nbstr.org/sitebuildercontent/sitebuilderpictures/webassets/hercules.jpg.w300h300.jpg
            domain === "www.nbstr.org" ||
            domain === "d26oc3sg82pgk3.cloudfront.net" ||
            domain === "d53l9d6fqlxs2.cloudfront.net") {
            // https://media.mnn.com/assets/images/2017/03/cyclops-2-titanic-wreck.jpg.653x0_q80_crop-smart.jpg
            //   https://media.mnn.com/assets/images/2017/03/cyclops-2-titanic-wreck.jpg
            // https://d26oc3sg82pgk3.cloudfront.net/files/media/uploads/zinnia/2017/08/22/0824-felicity-jones_cred_shutterstock-featureflash-photo-agency.jpg.644x420_q100.jpg
            //   https://d26oc3sg82pgk3.cloudfront.net/files/media/uploads/zinnia/2017/08/22/0824-felicity-jones_cred_shutterstock-featureflash-photo-agency.jpg
            // https://d53l9d6fqlxs2.cloudfront.net/photos/41/41127-tokyos-tak.jpg.660x0_q80_crop-scale_upscale.jpg
            //   https://d53l9d6fqlxs2.cloudfront.net/photos/41/41127-tokyos-tak.jpg
            newsrc = src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "media.contentapi.ea.com") {
            // https://media.contentapi.ea.com/content/dam/ea/dragonage/inquisition-refresh/videos/2018/01/90614bfc-1566-7230-3359-3ea9a1f39577.youtube/subassets/poster.jpg.adapt.crop16x9.1920w.jpg
            //   https://media.contentapi.ea.com/content/dam/ea/dragonage/inquisition-refresh/videos/2018/01/90614bfc-1566-7230-3359-3ea9a1f39577.youtube/subassets/poster.jpg
            // https://media.contentapi.ea.com/content/dam/ea/dragonage/inquisition-refresh/images/2018/01/ea-hero-medium-dai-homepage-7x2-xl.jpg.adapt.crop3x5.320w.jpg
            //   https://media.contentapi.ea.com/content/dam/ea/dragonage/inquisition-refresh/images/2018/01/ea-hero-medium-dai-homepage-7x2-xl.jpg
            newsrc = src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
            if (newsrc !== src)
                return {
                    url: newsrc,
                    can_head: false
                };
        }


        if (domain === "img.bleacherreport.net") {
            // https://img.bleacherreport.net/cms/media/image/fa/2f/08/6e/dfb9/4c1f/b030/48ba951160bd/crop_exact_USATSI_10579599.jpg?w=460&h=259&q=75
            //   https://img.bleacherreport.net/cms/media/image/fa/2f/08/6e/dfb9/4c1f/b030/48ba951160bd/USATSI_10579599.jpg?w=999999999999&h=999999999999
            return src
                .replace(/\/crop_exact_([^/]*)$/, "/$1")
                .replace(/\?.*$/, "?w=999999999999&h=999999999999");
        }

        if (domain === "images.gr-assets.com") {
            // https://images.gr-assets.com/books/1403200898m/7923163.jpg
            // https://images.gr-assets.com/authors/1281489919p2/3443203.jpg
            // https://images.gr-assets.com/users/1268072620p2/1668975.jpg
            return src
                .replace(/(\/(?:authors|users)\/[0-9]*p)[0-9]\//, "$18/")
                .replace(/(\/books\/[0-9]*)[a-z]\//, "$1l/");
        }

        if (domain === "dynamic.indigoimages.ca") {
            // https://dynamic.indigoimages.ca/books/1506701655.jpg?altimages=false&scaleup=true&maxheight=515&width=380&quality=85&sale=0&lang=en
            // https://dynamic.indigoimages.ca/books/1506701655.jpg?width=999999999
            return src.replace(/(\?.*)?$/, "?width=999999999");
        }

        if (domain === "cdn.mos.cms.futurecdn.net") {
            // https://cdn.mos.cms.futurecdn.net/wtXpUq7DAuPqftGRshxtzD-650-80.jpg
            //   https://cdn.mos.cms.futurecdn.net/wtXpUq7DAuPqftGRshxtzD.jpg
            return src.replace(/-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.allkpop.com") {
            // https://www.allkpop.com/upload/2018/02/af/12101614/clc.jpg
            //   https://www.allkpop.com/upload/2018/02/af_org/12101614/clc.jpg
            return src.replace(/\/af\/([0-9]*\/[^/]*)$/, "/af_org/$1");
        }

        if (domain === "cwcontent.asiae.co.kr") {
            return src
                //.replace(/\/amgimagelink\/[0-9]*\//, "/amgimagelink/0/")
                .replace(/^(.*?:\/\/).*\/[^/]*resize\/[0-9]*\/([^/]*)$/, "$1cphoto.asiae.co.kr/listimglink/4/$2");
            // http://cwcontent.asiae.co.kr/stooresize/32/2018020812382111881_1518061101.jpg
            //   http://cwcontent.asiae.co.kr/stooresize/28/2018020812382111881_1518061101.jpg
            //   http://cphoto.asiae.co.kr/listimglink/7/2018020812382111881_1518061101.jpg
            //   http://cphoto.asiae.co.kr/listimglink/4/2018020812382111881_1518061101.jpg - max
            // http://cwcontent.asiae.co.kr/amgimagelink/98/2018020408443101207A_1.jpg
            //   http://cphoto.asiae.co.kr/listimglink/4/201110161718307486692A_1.jpg - different
            // http://cwcontent.asiae.co.kr/asiaresize/80/2018021210005919425_1518397258.jpg
            //   http://cwcontent.asiae.co.kr/asiaresize/113/2018021210005919425_1518397258.jpg
            //   http://cwcontent.asiae.co.kr/asiaresize/132/2018021210005919425_1518397258.jpg
            //   http://cphoto.asiae.co.kr/listimglink/4/2018021210005919425_1518397258.jpg - max, same as above
            // http://cwcontent.asiae.co.kr/asiaresize/103/2018021210300316119_2.jpg
            //   http://cphoto.asiae.co.kr/listimglink/4/2018021210300316119_2.jpg - doesn't work
            //   http://cphoto.asiae.co.kr/listimglink/4/2018021210291519546_1518398953.jpg - proper
            // http://cwcontent.asiae.co.kr/amgimagelink/98/2018031311511632721A_1.jpg -- not
            //   http://cwcontent.asiae.co.kr/amgimagelink/0/2018031311511632721A_1.jpg -- gif
            // http://cwcontent.asiae.co.kr/amgimagelink/98/2017092915472067985A_1.jpg -- not
            //   http://cwcontent.asiae.co.kr/amgimagelink/0/2017092915472067985A_1.jpg -- gif
            // http://cphoto.asiae.co.kr/listimglink/4/2016051308263757999_1.jpg
            //   http://cwcontent.asiae.co.kr/amgimagelink/0/2016051308263757999_1.jpg -- smaller
            //   http://cwcontent.asiae.co.kr/amgimagelink/0/2016051308263757999_1.jpg -- slightly larger
            // http://cwcontent.asiae.co.kr/stooresize/33/2018031311332188690A_1.jpg
            //   http://cphoto.asiae.co.kr/listimglink/4/2018031311332188690A_1.jpg -- content length: 0
            //   http://cwcontent.asiae.co.kr/amgimagelink/0/2018031311332188690A_1.jpg -- proper
            // http://cwcontent.asiae.co.kr/amgimagelink/0/2018030609164136390A_1.jpg -- 540x607
            //   http://cwcontent.asiae.co.kr/amgimagelink/98/2018030609164136390A_1.jpg -- 1080x1215
            // http://wcontent.asiaeconomy.co.kr/amgimage_link.htm?idx=0&no=2008090309143458665_1.jpg
            // http://photo.asiae.co.kr/listimg_link.php?idx=2&no=2018031212153472858_1520824535.jpg
            // http://cwstoo.asiae.co.kr/freeimg_get.htm?img=1371 -- download
            // resize:
            // 28, 1, 20, 16, 3, 34, 18, 9, 35, 13, 21, 24, 39, 7, 15, 2, 23, 44, 11, 5, 22, 30, 4, 6, 25, 40, 8, 36, 47, 27, 48, 43, 46, 33, 17, 38, 41, 37, 14, 32, 45, 42, 31, 26, 12, 29, 10, 19
            // listimglink:
            // (4, 5 [=download]), 7, 6, 2, 3
            // amgimagelink:
            // (98, 12, 0), 11, 3, 14, 10, 4
        }

        if (domain === "cphoto.asiae.co.kr") {
            // http://cphoto.asiae.co.kr/listimglink/4/2015101609215433891_1.jpg - 2598x3354
            return src.replace(/\/listimglink\/[0-9]*\//, "/listimglink/4/");
        }

        if (domain === "thumbs-prod.si-cdn.com") {
            // https://thumbs-prod.si-cdn.com/eoEYA_2Hau4795uKoecUZZgz-3w=/800x600/filters:no_upscale()/https://public-media.smithsonianmag.com/filer/52/f9/52f93262-c29b-4a4f-b031-0c7ad145ed5f/42-33051942.jpg
            //   https://public-media.smithsonianmag.com/filer/52/f9/52f93262-c29b-4a4f-b031-0c7ad145ed5f/42-33051942.jpg
            return src.replace(/.*\/(https?:\/\/)/, "$1");
        }

        if (domain === "assets.atlasobscura.com") {
            // https://assets.atlasobscura.com/article_images/800x/17628/image.jpg
            return src.replace(/\/article_images\/[0-9]*x\//, "/article_images/");
        }

        if (domain === "gdb.voanews.com") {
            // https://gdb.voanews.com/FFF71CAB-7CA6-4876-831A-B7E44ED40BF4_w1200_r1_s.jpg
            //   https://gdb.voanews.com/FFF71CAB-7CA6-4876-831A-B7E44ED40BF4.jpg
            return src.replace(/_[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "wonderopolis.org" &&
            src.indexOf("/_img") >= 0) {
            // https://wonderopolis.org/_img?img=/wp-content/uploads/2012/01/squirell_shutterstock_6383917.jpg&transform=resizeCrop,720,450
            //   https://wonderopolis.org/_img?img=/wp-content/uploads/2012/01/squirell_shutterstock_6383917.jpg
            return src.replace(/\/_img.*?[?&](img=[^&]*).*/, "/_img?$1");
        }

        if (domain === "www.thehindu.com" ||
            domain === "www.gloria.hr" ||
            // http://i4.mirror.co.uk/incoming/article1323853.ece/ALTERNATES/s1227b/Sky%20Sports%20news%20female%20presenters
            domain.match(/i[0-9]*(?:-prod)?\.mirror\.co\.uk/) ||
            // https://www.mirror.co.uk/incoming/article1323853.ece/ALTERNATES/s1227b/Sky%20Sports%20news%20female%20presenters
            domain === "www.mirror.co.uk" ||
            domain.match(/i[0-9]*(?:-prod)?\.birminghammail\.co\.uk/) ||
            domain.match(/i[0-9]*(?:-prod)?\.dailypost\.co\.uk/) ||
            domain.match(/i[0-9]*(?:-prod)?\.bristolpost\.co\.uk/) ||
            // https://i2-prod.irishmirror.ie/incoming/article8862957.ece/ALTERNATES/s615b/abb08375.jpg
            domain.match(/i[0-9]*(?:-prod)?\.irishmirror\.ie/) ||
            // https://i2-prod.coventrytelegraph.net/incoming/article14083906.ece/ALTERNATES/s1200/Davina-McCall-1.jpg
            //   https://i2-prod.coventrytelegraph.net/incoming/article14083906.ece/BINARY/Davina-McCall-1.jpg
            domain.match(/i[0-9]*(?:-prod)?\.coventrytelegraph\.net/) ||
            // https://i2-prod.dublinlive.ie/incoming/article14444188.ece/ALTERNATES/s458/CC-METRO-FIRE190393751.jpg
            domain.match(/i[0-9]*(?:-prod)?\.dublinlive\.ie/) ||
            // https://beta.images.theglobeandmail.com/76a/sports/hockey/article38351471.ece/ALTERNATES/w620/web-sp-hk-senators-0326.JPG
            // https://beta.images.theglobeandmail.com/339/sports/article34852751.ece/BINARY/w620/hk-moss28sp3.JPG
            domain === "beta.images.theglobeandmail.com" ||
            // http://www.globalblue.com/destinations/uk/london/article288436.ece/alternates/LANDSCAPE2_970/cara_delevingne_rochas.jpg
            domain === "www.globalblue.com" ||
            // https://cdn-04.belfasttelegraph.co.uk/entertainment/film-tv/news/article36669885.ece/ALTERNATES/w620/bpanews_d1dbd5df-f462-4575-86fd-ef234930e632_embedded235347559
            domain.match(/cdn(-[0-9]+)?\.belfasttelegraph\.co\.uk/) ||
            // http://www.ladylike.gr/articles/galleries/photostories/article2773870.ece/ALTERNATES/w60/olsen.jpg
            // http://www.ladylike.gr/articles/galleries/photostories/article2773872.ece/BINARY/original/Rihanna.jpg
            //   http://www.ladylike.gr/articles/galleries/photostories/article2773872.ece/BINARY/Rihanna.jpg -- same
            domain === "www.ladylike.gr" ||
            src.match(/:\/\/i[0-9]*(?:-prod)?\..*\/article[^/]*\.ece\//) ||
            domain.match(/cdn-[0-9]*\.independent\.ie/)) {
            // wip
            // http://www.thehindu.com/migration_catalog/article14926809.ece/alternates/FREE_660/30MPSQUIRREL
            // http://www.thehindu.com/migration_catalog/article14926809.ece/alternates/FREE_960/30MPSQUIRREL
            // http://www.thehindu.com/migration_catalog/article14926809.ece
            // http://www.thehindu.com/news/national/kerala/article22745555.ece/alternates/LANDSCAPE_100/Priya
            // http://www.thehindu.com/news/national/kerala/article22745555.ece/alternates/FREE_460/Priya
            // https://i2-prod.mirror.co.uk/incoming/article7024597.ece/ALTERNATES/s615/PAY-Three-cute-squirrels-CUDDLING.jpg
            // https://i2-prod.mirror.co.uk/incoming/article236507.ece/ALTERNATES/s615/FA8A36EC-B0C4-D13B-383835E6F08D4428.jpg
            // https://i2-prod.mirror.co.uk/incoming/article11181827.ece/ALTERNATES/s615b/PROD-JRP_LEC_140117lsquirral_002JPG.jpg
            // https://i2-prod.mirror.co.uk/incoming/article11691534.ece/ALTERNATES/s1227b/PAY-SQUIRREL-AND-BIRD.jpg
            // https://i2-prod.mirror.co.uk/incoming/article11691532.ece/ALTERNATES/s1227b/PAY-SQUIRREL-AND-BIRD.jpg
            // https://i2-prod.mirror.co.uk/incoming/article5603898.ece/ALTERNATES/s1200/PAY-Squirrels.jpg
            // https://i2-prod.mirror.co.uk/incoming/article11263183.ece/ALTERNATES/s1168v/VIDEO-SQUIRREL.jpg
            // https://i2-prod.mirror.co.uk/incoming/article12021721.ece/ALTERNATES/s1176b/MGP_MDG_1302182281JPG.jpg
            // https://i2-prod.mirror.co.uk/incoming/article12021243.ece/ALTERNATES/s270b/MAIN-paddy.jpg
            // https://i2-prod.mirror.co.uk/incoming/article8949472.ece/ALTERNATES/s270b/National-Lottery-Euromillions-ticket.jpg
            //   https://i2-prod.mirror.co.uk/incoming/article8949472.ece/ALTERNATES/s810/National-Lottery-Euromillions-ticket.jpg
            // https://i2-prod.mirror.co.uk/incoming/article12021158.ece/ALTERNATES/s508/RIP-Pizza-Express-give-away-free-meals-to-certain-customers-who-do-this-one-thing.jpg
            //   https://i2-prod.mirror.co.uk/incoming/article12021158.ece/ALTERNATES/s615/RIP-Pizza-Express-give-away-free-meals-to-certain-customers-who-do-this-one-thing.jpg
            //   https://i2-prod.mirror.co.uk/incoming/article12021158.ece/ALTERNATES/s810/RIP-Pizza-Express-give-away-free-meals-to-certain-customers-who-do-this-one-thing.jpg
            //   https://i2-prod.mirror.co.uk/incoming/article12021158.ece/ALTERNATES/s1200/RIP-Pizza-Express-give-away-free-meals-to-certain-customers-who-do-this-one-thing.jpg
            // https://i2-prod.mirror.co.uk/incoming/article4997473.ece/ALTERNATES/s298/Actress-Felicity-Jones.jpg
            // http://www.dailymirror.lk/article/Rare-albino-squirrel-posing-in-his-white-suit--126748.html
            //   http://static.dailymirror.lk/media/images/image_1491276569-ba3932b3dc.jpg
            //   http://static.dailymirror.lk/media/images/image_1491276584-77a6a42e37.jpg
            //   http://static.dailymirror.lk/media/images/image_1491276594-bc6ed40255.jpg
            // https://cdn-01.independent.ie/incoming/article35675982.ece/70a4f/AUTOCROP/w940/675787992.jpg
            // https://i2-prod.birminghammail.co.uk/news/midlands-news/article8438687.ece/ALTERNATES/s615b/Felicity-Jones-The-Worst-Witch.jpg
            //   https://i2-prod.birminghammail.co.uk/news/midlands-news/article8438687.ece/BINARY/Felicity-Jones-The-Worst-Witch.jpg
            // https://i2-prod.mirror.co.uk/incoming/article9801836.ece/ALTERNATES/s810/SUNDAYPEOPLE-PROD-Tara-Palmer-Tomkinson.jpg
            // https://i2-prod.mirror.co.uk/incoming/article7009917.ece/BINARY/CS85701845-1.png
            // https://i2-prod.dailypost.co.uk/incoming/article12849370.ece/binary/BigBubble.jpg
            // https://i2-prod.bristolpost.co.uk/incoming/article1143957.ece/BINARY/Elise-Britten-profile-pic-square.jpg
            // https://www.gloria.hr/moda/novosti/naomicampbell01jpg/6949668/alternates/FREE_580/NaomiCampbell01.jpg
            //return src.replace(/(\/article[0-9]*\.ece\/.*?)(?:alternates|ALTERNATES|AUTOCROP|autocrop)\/[^/]*\//, "$1BINARY/");
            return src.replace(/(?:alternates|ALTERNATES|AUTOCROP|autocrop|binary|BINARY)\/[^/]*\/([^/]*)$/, "BINARY/$1");
        }

        if (domain === "images.fandango.com") {
            // no noticeable change though
            // https://images.fandango.com/ImageRenderer/0/0/redesign/static/img/default_poster.png/0/images/masterrepository/performer%20images/p237485/thetempest2010-mv-19.jpg
            //   https://images.fandango.com/images/masterrepository/performer%20images/p237485/thetempest2010-mv-19.jpg
            // http://images.fandango.com/ImageRenderer/0/0/redesign/static/img/default_poster.png/0/images/masterrepository/performer%20images/p237485/felicityjones-cheri-7.jpg
            //   http://images.fandango.com/images/masterrepository/performer%20images/p237485/felicityjones-cheri-7.jpg
            return src.replace(/\/ImageRenderer\/.*?\/images\//, "/images/");
        }

        if (domain === "s3.amazonaws.com" &&
            src.match(/\/s3\.amazonaws\.com\/assets\.forward\.com\//)) {
            // https://s3.amazonaws.com/assets.forward.com/images/cropped/gettyimages-655344102-1500478034.jpg
            return src.replace(/.*:\/\/[^/]*\//, "http://");
        }

        if (domain === "assets.forward.com") {
            // http://assets.forward.com/images/cropped/gettyimages-655344102-1500478034.jpg
            //   http://assets.forward.com/images/gettyimages-655344102-1500478034.jpg
            return src.replace(/\/images\/cropped\//, "/images/");
        }

        if (domain === "www.thejewelleryeditor.com") {
            // http://www.thejewelleryeditor.com/media/images_thumbnails/filer_public_thumbnails/old/21228/Felicity-Jones-Finch-Oscars-2013.jpg__1536x0_q75_crop-scale_subsampling-2_upscale-false.jpg - stretched
            //   http://www.thejewelleryeditor.com/media/images/old/21228/Felicity-Jones-Finch-Oscars-2013.jpg
            return src.replace(/\/images_thumbnails\/[^/]*_thumbnails\/([^/]*\/[0-9]*\/[^/.]*\.[^_/.]*)__[^/]*$/, "/images/$1");
        }

        if (domain === "files.sharenator.com") {
            // https://files.sharenator.com/felicity-jones-s3504x4800-453760-1020.jpg
            //   https://files.sharenator.com/felicity-jones-s3504x4800-453760.jpg
            return src.replace(/(-[0-9]*)-[0-9]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "cdn.jolie.de") {
            // http://cdn.jolie.de/297989-4137908-2/image160w/felicity-jones-oscars-2017.jpg
            //   http://cdn.jolie.de/297989-4137908-2/original/felicity-jones-oscars-2017.jpg
            return src.replace(/\/image[0-9]*[wh]\//, "/original/");
        }

        if (domain === "img.mp.itc.cn") {
            // http://img.mp.itc.cn/upload/20170227/aa7bad178ad94c1e94428c87b6227fc7_th.jpeg
            return src.replace(/_th(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".qpic.cn") >= 0) {
            // http://mmbiz.qpic.cn/mmbiz_jpg/HiaNy8LPboMwzXqYuvrlHAicCbwUffgUbjY2EgQa81icMQxeKHeG5dTmhupXk7MKHibwKQAtNxEbeceH7elpaTT2fw/640?wx_fmt=jpeg&_ot=1514246400129
            // https://puui.qpic.cn/vcover_vt_pic/0/7m7cvdfbslfme4u1478827029/260
            // http://t3.qpic.cn/mblogpic/afb2a8f5fc3b14b0015e/2000
            //   http://t3.qpic.cn/mblogpic/afb2a8f5fc3b14b0015e/0 -- smaller
            if (domain.match(/^t[0-9]*\.qpic\.cn$/))
                return;
            return src.replace(/\/[0-9]*(?:\?.*)?$/, "/0");
        }

        if (domain === "vogue.ua") {
            // https://vogue.ua/cache/gallery_x1160_watermark/uploads/image/dc0/ab2/a48/58b3a48ab2dc0.jpeg
            return src.replace(/\/cache\/[^/]*\/uploads\//, "/uploads/");
        }

        if (domain === "imagesvc.timeincuk.net") {
            // https://imagesvc.timeincuk.net/v3/keystone/image?w=441&url=http://ksassets.timeincuk.net/wp/uploads/sites/46/2016/12/Felicity-Jonesw-style-file-december-2016.jpg&q=82
            return src.replace(/.*?\/keystone\/image.*?[?&]url=([^&]*).*/, "$1");
        }

        if (domain.match(/gss[0-9]*\.bdstatic\.com/) ||
            domain.match(/gss[0-9]*\.baidu\.com/)) {
            if (src.indexOf("/timg?") >= 0) {
                // https://gss3.bdstatic.com/84oSdTum2Q5BphGlnYG/timg?wapp&quality=80&size=b150_150&subsize=20480&cut_x=0&cut_w=0&cut_y=0&cut_h=0&sec=1369815402&srctrace&di=c10cad3328e6895cc32131aa4cfa7d32&wh_rate=null&src=http%3A%2F%2Fimgsrc.baidu.com%2Fforum%2Fpic%2Fitem%2F90529822720e0cf3c1045a710046f21fbf09aa4c.jpg
                //   http://imgsrc.baidu.com/forum/pic/item/90529822720e0cf3c1045a710046f21fbf09aa4c.jpg
                return {
                    url: decodeURIComponent(src.replace(/.*?\/timg.*?[?&]src=([^&]*).*/, "$1")),
                    head_wrong_contenttype: true
                };
            }

            if (src.indexOf("/sign=") >= 0 ||
                src.indexOf("/pic/item/") >= 0) {
                // HEAD request gives text/html
                // https://gss1.bdstatic.com/9vo3dSag_xI4khGkpoWK1HF6hhy/baike/w%3D268%3Bg%3D0/sign=3cca8ea804087bf47dec50efcae83011/d058ccbf6c81800a388738edb73533fa838b47f6.jpg
                //   https://imgsrc.baidu.com/baike/pic/item/d058ccbf6c81800a388738edb73533fa838b47f6.jpg
                return {
                    url: src.replace(/:\/\/[^/]*\/[^/]*\//, "://imgsrc.baidu.com/"),
                    head_wrong_contenttype: true
                };
            }
        }

        if (domain === "imgsrc.baidu.com") {
            // http://imgsrc.baidu.com/forum/wh%3D200%2C90%3B/sign=a5aa97f7bb7eca80125031e5a113bbe4/f7582e381f30e924af22ade547086e061c95f734.jpg
            // http://imgsrc.baidu.com/forum/wh=200,90;/sign=a5aa97f7bb7eca80125031e5a113bbe4/f7582e381f30e924af22ade547086e061c95f734.jpg
            //   http://imgsrc.baidu.com/forum/w%3D580%3B/sign=fc7fb3a148a98226b8c12b2fbab9bb01/7af40ad162d9f2d34097153ba2ec8a136227cc5b.jpg - slightly larger
            //   http://imgsrc.baidu.com/forum/pic/item/f7582e381f30e924af22ade547086e061c95f734.jpg - orig?
            // http://imgsrc.baidu.com/forum/abpic/item/dda5e6fe9925bc31b6fe8f4b5edf8db1ca137017.jpg
            //   http://imgsrc.baidu.com/forum/pic/item/dda5e6fe9925bc31b6fe8f4b5edf8db1ca137017.jpg
            // http://imgsrc.baidu.com/forum/w%3D415/sign=e28730d85edf8db1bc2e7d653c22dddb/b164910a304e251f2b2dd5b8a786c9177e3e536c.jpg
            //   http://imgsrc.baidu.com/forum/pic/item/b164910a304e251f2b2dd5b8a786c9177e3e536c.jpg
            // https://gss1.bdstatic.com/9vo3dSag_xI4khGkpoWK1HF6hhy/baike/h%3D160/sign=750b8bdd9ceef01f52141cc3d0ff99e0/9345d688d43f879465467a97da1b0ef41ad53ac9.jpg
            //   https://gss1.bdstatic.com/9vo3dSag_xI4khGkpoWK1HF6hhy/baike/w%3D268%3Bg%3D0/sign=7f8d6ceafe246b607b0eb572d3c37d71/9345d688d43f879465467a97da1b0ef41ad53ac9.jpg
            //   https://gss1.bdstatic.com/9vo3dSag_xI4khGkpoWK1HF6hhy/baike/c0=baike933,5,5,933,330/sign=6ccfd69a7bf08202399f996d2a929088/9345d688d43f879465467a97da1b0ef41ad53ac9.jpg
            //   https://imgsrc.baidu.com/baike/c0=baike933,5,5,933,330/sign=6ccfd69a7bf08202399f996d2a929088/9345d688d43f879465467a97da1b0ef41ad53ac9.jpg
            //   http://imgsrc.baidu.com/baike/pic/item/9345d688d43f879465467a97da1b0ef41ad53ac9.jpg
            newsrc = src
                .replace("/abpic/item/", "/pic/item/")
                .replace(/\/[^/]*(?:=|%3D)[^/]*\/sign=[^/]*\//, "/pic/item/");
            return {
                url: newsrc,
                head_wrong_contenttype: true
            };
        }

        if (domain.indexOf("himg.baidu.com") >= 0) {
            // http://tb.himg.baidu.com/sys/portrait/item/57cf0859
            //    http://tb.himg.baidu.com/sys/portraitn/item/57cf0859
            //    http://tb.himg.baidu.com/sys/portraitm/item/57cf0859
            //    http://tb.himg.baidu.com/sys/portraitl/item/57cf0859
            //    http://tb.himg.baidu.com/sys/original/item/57cf0859 (doesn't matter the text, can be anything other than the ones above)
            //    http://himg.baidu.com/sys/original/item/57cf4b616e6748796559656f6e0859
            return src.replace(/\/sys\/[^/]*\/item\//, "/sys/original/item/");
        }

        if (domain === "a.ksd-i.com") {
            // https://a.ksd-i.com/s/160l_86400_82d10665e8e8ca12632547568577442d/static.koreastardaily.com/2017-10-24/99264-550368.jpg
            // https://a.ksd-i.com/s/480x_86400_53c96fbf9a6baa55c9b527dcbeb4928e/static.koreastardaily.com/2017-10-24/99264-550368.jpg
            //   http://static.koreastardaily.com/2017-10-24/99264-550368.jpg
            // https://a.ksd-i.com/s/160l_86400_aaf286b862dc657320f390e272bd7cb8/static.koreastardaily.com/2017-06-26/95799-521086.jpg
            // https://a.ksd-i.com/s/480x_86400_63072b0849030d169deca9872c37d761/static.koreastardaily.com/2017-10-24/99264-550364.jpg
            return src.replace(/.*:\/\/[^/]*\/s\/[^/]*\//, "http://");
        }

        if (domain === "static.koreastardaily.com") {
            // http://static.koreastardaily.com/2017-04-13/93388-506687.jpg
            //   https://a.ksd-i.com/a/2017-04-13/93388-506687.jpg -- same (but HTTPS)
            return src.replace(/.*:\/\/[^/]*\/([0-9]+-[0-9]+-[0-9]+\/[0-9]+-[0-9]+\.[^/.]*)$/, "https://a.ksd-i.com/a/$1");
        }

        if (domain === "pic.pimg.tw") {
            // https://pic.pimg.tw/silvia17895/1518597084-877783212_n.jpg
            //   https://pic.pimg.tw/silvia17895/1518597084-877783212.jpg
            // (none, l), b, m, n, q, s, t
            return src.replace(/_[a-z](\.[^/]*)$/, "$1");
        }

        if (domain_nowww === "helloidol.com" &&
            src.indexOf("/script/get_pic.php") >= 0) {
            // http://www.helloidol.com/script/get_pic.php?src=https://1.bp.blogspot.com/-iblNAdULcFY/WnkEGyGjySI/AAAAAAAADHQ/pgVIIcLeHOo6IngbASGuakOIpxBwHr8dACLcBGAs/s1600/Eulachacha-Waikiki.jpg&h=256&w=400&zc=1
            return src.replace(/.*\/script\/get_pic\.php.*?[?&]src=([^&]*).*?$/, "$1");
        }

        if (domain === "yams.akamaized.net" &&
            src.indexOf("/Assets/") >= 0) {
            // https://yams.akamaized.net/Assets/56/610/p0082761056.jpg
            return src.replace(/\/(?:[^/._]*_)?([^/_]*)$/, "/l_$1");
        }

        if (domain.match(/img[0-9]\.pixpo\.net/)) {
            // https://img1.pixpo.net/img/da/4/0dwxci32wc/sg_0DwXCi32Wc_t324x216.jpg
            return src.replace(/_t[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.mirrormedia.mg" &&
            src.indexOf("/assets/images/") >= 0) {
            // https://www.mirrormedia.mg/assets/images/20170626110017-7cd692da02e985b28918adaf10d858ad-desktop.jpg
            return src.replace(/-desktop(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/i[0-9]*\.kknews\.cc/)) {
            // https://i1.kknews.cc/SIG=32hj89t/p6700021qr20759nn46_s.jpg
            return src.replace(/_[a-z]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "resource.holyshare.com.tw") {
            // http://resource.holyshare.com.tw/uploads/article/85x65/1443691071QSo_1.png
            // http://resource.holyshare.com.tw/uploads/article/600x0/1413181844EmZ_1.jpg
            return src.replace(/\/article\/[0-9]*x[0-9]*\//, "/article/");
        }

        if (domain_nowww === "kyeongin.com") {
            // http://www.kyeongin.com/mnt/file_m/201802/2018021501001103400052931.jpg
            return src.replace("/file_m/", "/file/");
        }

        if (domain === "www.wallpaperup.com") {
            // https://www.wallpaperup.com/uploads/wallpapers/2013/04/05/70727/793b48d70207428a317f912ac9f1342e-250.jpg
            return src.replace(/-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/[a-z]*\.wallhere\.com/) ||
            domain.match(/[a-z]*\.pxhere\.com/)) {
            // https://c.wallhere.com/photos/e2/9a/women_brunette_model_Marina_Shimkovich_window_sill_jean_shorts_legs_barefoot-285016.jpg!d
            //   https://get.wallhere.com/photo/women_brunette_model_Marina_Shimkovich_window_sill_jean_shorts_legs_barefoot-285016.jpg
            // https://get.wallhere.com/photo/Asian-Sunny-Girls-Generation-SNSD-Person-Kwon-Yuri-Jessica-Jung-Im-Yoona-Choi-Sooyoung-Kim-Taeyeon-Kim-Hyoyeon-Seohyun-Tiffany-Hwang-finger-2560x1600-px-523643.jpg
            //   https://get.wallhere.com/photo/Asian-Sunny-Girls-Generation-SNSD-Person-Kwon-Yuri-Jessica-Jung-Im-Yoona-Choi-Sooyoung-Kim-Taeyeon-Kim-Hyoyeon-Seohyun-Tiffany-Hwang-finger-523643.jpg
            // https://get.wallhere.com/photo/5333x3000-px-Girls-Generation-K-pop-Korean-Lee-Soonkyu-Sunny-989174.jpg
            //   https://get.wallhere.com/photo/Girls-Generation-K-pop-Korean-Lee-Soonkyu-Sunny-989174.jpg
            // https://c.pxhere.com/photos/73/fc/women_model_sauna_beauty_girl_pretty_sexy_woman_photography-696156.jpg!s
            //   https://get.pxhere.com/photo/women_model_sauna_beauty_girl_pretty_sexy_woman_photography-696156.jpg
            // https://c.pxhere.com/images/38/fe/762e69512e53d94f4b4711f60d0e-1419055.png!s
            //   https://get.pxhere.com/photo/762e69512e53d94f4b4711f60d0e-1419055.png
            return src
                .replace(/[a-z]*\.wallhere\.com/, "get.wallhere.com")
                .replace(/[a-z]*\.pxhere\.com/, "get.pxhere.com")
                .replace(/\/(?:photos|images)\/[0-9a-f]*\/[0-9a-f]*\/([^/.]*\.[^/.!]*).*?$/, "/photo/$1")
                .replace(/\/[0-9]+x[0-9]+-px-([^/]*)$/, "/$1")
                .replace(/-[0-9]+x[0-9]+-px-([0-9]+\.[^/.]*)$/, "-$1");
        }

        if (domain === "img.grouponcdn.com") {
            // https://img.grouponcdn.com/deal/nx2giiTu5SBQbemLQteLqW/shutterstock_140728459-2-1500x900/v1/c300x182.jpg
            return src.replace(/\/v[0-9]+\/[^/]*$/, "");
        }

        if (domain.match(/img[0-9]*\.goodfon\.com/)) {
            // https://img4.goodfon.com/wallpaper/middle/2/86/brevno-sova-ptitsa.jpg
            //   https://img4.goodfon.com/wallpaper/original/2/86/brevno-sova-ptitsa.jpg
            // https://img2.goodfon.com/original/1280x720/0/e6/venera-ray-devushka-krasivaya.jpg
            //   https://img2.goodfon.com/wallpaper/original/0/e6/venera-ray-devushka-krasivaya.jpg
            return src.replace(/(:\/\/[^/]*\/)[^/]*\/[^/]*\//, "$1wallpaper/original/");
            //return src.replace(/\/wallpaper\/[^/]*\//, "/wallpaper/original/");
        }

        if (domain.indexOf(".c.yimg.jp") >= 0 &&
            src.match(/:\/\/[^/]*\/im_/)) {
            // https://lpt.c.yimg.jp/im_siggiQbAsU9YOpUOxobTU3EtUg---x200-y200/amd/20180215-00205238-okinawat-000-view.jpg
            //   https://lpt.c.yimg.jp/amd/20180215-00205238-okinawat-000-view.jpg
            // https://amd.c.yimg.jp/im_siggfkAIHQmt2wB5qZ4fql1LCw---x900-y506-q90-exp3h-pril/amd/20180216-00010002-ksbv-000-1-view.jpg
            //   https://amd.c.yimg.jp/amd/20180216-00010002-ksbv-000-1-view.jpg
            // https://iwiz-news-profile.c.yimg.jp/im_sigg6aeoTpWVSD8ZSZj4Bo7mBA---x64-y64-pril-n1-exp30d/d/iwiz-news-profile/img/nb34khhuyczsy7o6f4dsott4zq.png?1477551484
            //   https://iwiz-news-profile.c.yimg.jp/d/iwiz-news-profile/img/nb34khhuyczsy7o6f4dsott4zq.png?1477551484
            //return src.replace(/(:\/\/[^/]*)\/[^/]*(\/amd\/[^/]*)$/, "$1$2");
            return src.replace(/(:\/\/[^/]*\/)im_[^/]*\//, "$1");
        }

        if (domain.indexOf(".c.yimg.jp") >= 0 &&
            src.match(/:\/\/[^/]*\/sim\?/)) {
             // https://wing-auctions.c.yimg.jp/sim?furl=auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0402/users/0/4/9/4/ane6371969-img600x425-1518659462gyve6525845.jpg&dc=1&sr.fs=20000
            return src.replace(/.*:\/\/[^/]*\/sim.*?[?&]furl=([^&]*).*/, "http://$1");
        }

        if (domain.indexOf(".c.yimg.jp") >= 0 &&
            src.match(/\/Images\/(?:[a-z]_)?[0-9]+(\.[^/]*)$/)) {
            // https://daily.c.yimg.jp/gossip/2015/06/16/Images/08127258.jpg
            //   https://daily.c.yimg.jp/gossip/2015/06/16/Images/f_08127258.jpg
            // f, d, g, e, b, a
            return src.replace(/\/Images\/(?:[a-z]_)?([0-9]+\.[^/.]*)$/, "/Images/f_$1");
        }

        if (domain === "av.watch.impress.co.jp") {
            // https://av.watch.impress.co.jp/img/avw/docs/1106/827/01_s.jpg
            //   https://av.watch.impress.co.jp/img/avw/docs/1106/827/01_o.jpg
            return src.replace(/(\/[0-9]+)_s(\.[^/.]*)$/, "$1_o$2");
        }

        if (domain === "internet.watch.impress.co.jp") {
            // https://internet.watch.impress.co.jp/img/iw/docs/1106/860/01_s.jpg
            //   https://internet.watch.impress.co.jp/img/iw/docs/1106/860/01.jpg
            return src.replace(/(\/[0-9]+)_s(\.[^/.]*)$/, "$1$2");
            //return src.replace(/_s(\.[^/.]*)$/, "$1");
        }

        if (domain === "media.image.infoseek.co.jp") {
            // https://media.image.infoseek.co.jp/isnews/photos/mag2news/mag2news_350262_0-small.jpg
            // https://media.image.infoseek.co.jp/isnews/photos/gree/gree_164114_0-small.jpg
            //   https://media.image.infoseek.co.jp/isnews/photos/gree/gree_164114_0.jpg
            // https://media.image.infoseek.co.jp/isnews/photos/sirabee/sirabee_20161410960_0-small.jpg
            //   https://media.image.infoseek.co.jp/isnews/photos/sirabee/sirabee_20161410960_0.jpg
            return src.replace(/-[a-z]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "s.eximg.jp") {
            // https://s.eximg.jp/exnews/feed/President/President_24421_0d46_1_s.jpg
            // https://s.eximg.jp/exnews/feed/Reuters/Reuters_newsml_KCN1G009M_1_s.jpg
            //   https://s.eximg.jp/exnews/feed/Reuters/Reuters_newsml_KCN1G009M_1.jpeg
            //
            // https://s.eximg.jp/exnews/feed/Getnews/Getnews_1869376_84b6_1_s.jpg
            //   https://s.eximg.jp/exnews/feed/Getnews/Getnews_1869376_84b6_1.jpg
            return src.replace(/(_[0-9]+)_s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "imgc.eximg.jp") {
            // https://imgc.eximg.jp/i=https%253A%252F%252Fs.eximg.jp%252Fexnews%252Ffeed%252FShouhin%252FShouhin_93784_1.jpg,zoom=400,type=jpg
            //   https://s.eximg.jp/exnews/feed/Shouhin/Shouhin_93784_1.jpg
            return decodeURIComponent(decodeURIComponent(src.replace(/.*?\/i=([^,]*).*?$/, "$1")));
        }

        if (domain === "image.itmedia.co.jp" &&
            !src.match(/\/l_[^/]*$/) &&
            !src.match(/\/[0-9]+_[^/]*$/)) {
            // http://image.itmedia.co.jp/news/articles/1802/16/koya_AP18039560928544.jpg
            //   http://image.itmedia.co.jp/news/articles/1802/16/l_koya_AP18039560928544.jpg
            // http://image.itmedia.co.jp/news/articles/1802/16/mm_houseten_02.jpg
            //   http://image.itmedia.co.jp/news/articles/1802/16/l_mm_houseten_02.jpg
            // http://image.itmedia.co.jp/news/articles/1802/16/nu_nec0216_02.jpg
            // doesn't work:
            // http://image.itmedia.co.jp/news/articles/1802/16/240_news084.jpg
            return src.replace(/\/([^/]*)$/, "/l_$1");
        }

        if (domain.match(/cdn[0-9]*\.bigcommerce\.com/)) {
            // http://cdn7.bigcommerce.com/s-aeyni5y9/images/stencil/500x659/products/517/520/bear_papa_7328_2__12787.1400287249.jpg?c=2
            //   http://cdn7.bigcommerce.com/s-aeyni5y9/images/stencil/original/products/517/520/bear_papa_7328_2__12787.1400287249.jpg?c=2
            // https://cdn7.bigcommerce.com/s-c14n6tful3/images/stencil/735x374/products/136/460/checkbox-categories-filter-for-product-search-preview-734x374__10327.1518675514.jpg?c=2&imbypass=on
            //   https://cdn7.bigcommerce.com/s-c14n6tful3/images/stencil/original/products/136/460/checkbox-categories-filter-for-product-search-preview-734x374__10327.1518675514.jpg?c=2&imbypass=on
            return src.replace(/\/images\/stencil\/[0-9]+x[0-9]+\//, "/images/stencil/original/");
        }

        if (domain.indexOf(".behance.net") >= 0 &&
            src.indexOf("/project_modules/") >= 0) {
            // https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/9e81bc25691931.5634a6d5ee11a.png
            // https://mir-s3-cdn-cf.behance.net/project_modules/1400/9e81bc25691931.5634a6d5ee11a.png
            // https://mir-s3-cdn-cf.behance.net/project_modules/disp/9e81bc25691931.5634a6d5ee11a.png
            // https://mir-s3-cdn-cf.behance.net/project_modules/hd/9e81bc25691931.5634a6d5ee11a.png
            // https://mir-s3-cdn-cf.behance.net/project_modules/fs/9e81bc25691931.5634a6d5ee11a.png
            //
            // https://mir-s3-cdn-cf.behance.net/project_modules/1400/828dc625691931.5634a721e19dd.jpg
            // https://mir-cdn.behance.net/v1/rendition/project_modules/1400/828dc625691931.5634a721e19dd.jpg
            // https://mir-s3-cdn-cf.behance.net/project_modules/fs/828dc625691931.5634a721e19dd.jpg
            //
            // https://mir-s3-cdn-cf.behance.net/project_modules/hd/ad62c919260569.562e23ee8f6be.jpg
            // https://mir-s3-cdn-cf.behance.net/project_modules/fs/ad62c919260569.562e23ee8f6be.jpg
            return src.replace(/\/project_modules\/[^/]*\//, "/project_modules/fs/");
        }

        if (domain === "www.worldatlas.com") {
            // https://www.worldatlas.com/r/w728-h425-c728x425/upload/22/a1/0a/shutterstock-330445028.jpg
            //   https://www.worldatlas.com/upload/22/a1/0a/shutterstock-330445028.jpg
            return src.replace(/(:\/\/[^/]*\/)r\/[^/]*\/(upload\/)/, "$1$2");
        }

        if (domain.match(/assets[0-9]*\.thrillist\.com/)) {
            // https://assets3.thrillist.com/v1/image/2642818/size/tmg-article_default_mobile.jpg
            // https://assets3.thrillist.com/v1/image/2642818/size/tl-horizontal_main.jpg
            // https://assets3.thrillist.com/v1/image/2729043/size/tl-right_rail_short.jpg
            // https://assets3.thrillist.com/v1/image/2728632/size/gn-gift_guide_variable_c.jpg
            // https://assets3.thrillist.com/v1/image/2442399/size/tmg-article_tall.jpg
            //   https://assets3.thrillist.com/v1/image/2442399
            // http://assets3.thrillist.com/v1/image/1210040
            return src.replace(/\/size\/[^/]*$/, "");
        }

        if (domain === "vacationidea.com" &&
            src.indexOf("/pix/") >= 0) {
            // http://vacationidea.com/pix/img25Hy8R/articles/t-b4_beautiful_places_oia,_santorin_27304_mobi.jpg
            //   http://vacationidea.com/pix/img25Hy8R/articles/t-b4_beautiful_places_oia,_santorin_27304.jpg
            return src.replace(/_mobi(\.[^/.]*)$/, "$1");
        }

        if (domain === "qph.fs.quoracdn.net") {
            // https://qph.fs.quoracdn.net/main-qimg-0f9434ad2ebdb0024bab1b334ce791a9-c
            return src.replace(/-[a-z]$/, "");
        }

        if (domain.indexOf(".fan.pw") >= 0 &&
            src.indexOf("/cpg/albums/") >= 0) {
            // http://actresses.fan.pw/cpg/albums/userpics/10001/thumb_001~64.jpg
            // http://actresses.fan.pw/cpg/albums/userpics/10001/normal_002~51.jpg
            //   http://actresses.fan.pw/cpg/albums/userpics/10001/002~51.jpg
            return src.replace(/\/[a-z]*_([^/]*)$/, "/$1");
        }

        if (domain.match(/c[0-9]*\.haibao\.cn/) && false) {
            // none work anymore
            // http://c3.haibao.cn/img/600_0_100_0/1258349756.6184/bigfiles/200946/1258349756.6184.jpg -- doesn't work
            // doesn't work: (any changes fail)
            // http://c3.haibao.cn/img/600_0_100_1/1443219715.4295/44ceff65db35a823fafb9572341a17e4.jpg
            // http://c2.haibao.cn/img/3620_5430_100_1/1498032292.4375/e2097b3504fdeefd6d94c0fbd8e3bcd6.jpg
            return src.replace(/\/img\/[0-9]+_[0-9]+_[0-9]+_[0-9]+\//, "/img/0_0_0_0/");
        }

        if (domain.match(/cdn[0-9]*\.hbimg\.cn/)) {
            // http://cdn4.hbimg.cn/store/thumbs/130_165/piccommon/1214/12147/D52599CFADB3EFF2DCBE83AF.jpg
            //   http://cdn4.hbimg.cn/store/wm/piccommon/1214/12147/D52599CFADB3EFF2DCBE83AF.jpg
            return src.replace(/\/thumbs\/[0-9]+(?:_[0-9]+)\//, "/wm/");
        }

        if (domain === "wallpaperset.com") {
            // https://wallpaperset.com/w/small/6/7/2/314686.jpg
            return src.replace(/(:\/\/[^/]*\/w\/)[^/]*\//, "$1full/");
        }

        // disabled due to redirects
        if ((domain.indexOf(".wallpapermania.eu") >= 0 ||
             domain_nowww === "wallpapermania.eu")) {
            // http://www.wallpapermania.eu/download/2012-04/1037/emma-roberts-11-sexy-hd-wallpaper_1366x768.jpg
            //   http://www.wallpapermania.eu/images/data/2012-04/1037_emma-roberts-11-sexy-hd-wallpaper.jpg
            // http://static.wallpapermania.eu/images/thumbs/2012-04/1030_emma-roberts-4-sexy-hd-wallpaper.jpg
            //   http://www.wallpapermania.eu/images/data/2012-04/1030_emma-roberts-4-sexy-hd-wallpaper.jpg
            // http://www.wallpapermania.eu/wallpaper/victoria-justice-6-sexy-hd-wallpaper
            // http://www.wallpapermania.eu/images/lthumbs/2012-04/2210_victoria-justice-6-sexy-hd-wallpaper.jpg
            //   http://www.wallpapermania.eu/images/data/2012-04/2210_victoria-justice-6-sexy-hd-wallpaper.jpg
            newsrc = src
                .replace("://static.wallpapermania.eu/", "://www.wallpapermania.eu/")
                .replace(/\/images\/[a-z]?thumbs\//, "/images/data/")
                .replace(/\/download\/([^/]*)\/([0-9]*)\/([^/.]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/images/data/$1/$2_$3$4");
            if (newsrc !== src) {
                var referer = newsrc.replace(/.*\/[0-9]+_([^/.]*)(?:_[0-9]+x[0-9]+)?\.[^/.]*$/,
                                             "http://www.wallpapermania.eu/wallpaper/$1");
                return {
                    url: newsrc,
                    headers: {
                        "Referer": referer
                    }
                };
            }
            //return newsrc;
        }

        if (domain === "img-aws.ehowcdn.com" ||
            domain === "img.aws.ehowcdn.com" ||
            domain === "img.aws.livestrongcdn.com" ||
            domain === "img-aws.livestrongcdn.com") {
            // wip
            // https://img-aws.ehowcdn.com/750x428p/photos.demandstudios.com/getty/article/165/202/96162194.jpg
            //   http://photos.demandstudios.com/getty/article/165/202/96162194.jpg
            //
            // https://img-aws.ehowcdn.com/1440x520/cme/uploadedimages.demandmedia/chocmouse.jpg
            //
            // https://img-aws.ehowcdn.com/640/cme/photography.prod.demandstudios.com/8f9cba5d-f28d-47e7-bcc7-985cc310ce6a.jpg
            // https://img-aws.ehowcdn.com/1440/cme/photography.prod.demandstudios.com/8f9cba5d-f28d-47e7-bcc7-985cc310ce6a.jpg
            // http://img.aws.ehowcdn.com/intl-300m200/ds-photo/getty/article/129/156/86543427.jpg
            // http://img.aws.ehowcdn.com/intl-1200x630/ehow/images/a04/8n/pn/sell-wholesale-pandora-jewelry-800x800.jpg
            // http://img-aws.ehowcdn.com/default/ds-photo/getty/article/190/38/153473402_XS.jpg
            // https://img-aws.ehowcdn.com/default/getty/xc/87706466.jpg?v=1&c=EWSAsset&k=2&d=910C62E22B9F47AA92D0F6B5F9282134E184698B84D1D7E2E240CBB021893A9E
            //
            // http://img.aws.livestrongcdn.com/ls-article-image-400/cme/cme_public_images/www_livestrong_com/photos.demandstudios.com/getty/article/106/30/113475809_XS.jpg
            /*newsrc = src.replace(/.*?:\/\/[^/]*\/[0-9]+x[0-9]+p\//, "http://")
            if (newsrc !== src) {
                return newsrc;
            }*/
            newsrc = src
                .replace(/(:\/\/[^/]*\/)[^/]*\//, "$1default/");
            // breaks some urls:
            // https://img-aws.ehowcdn.com/150X100/getty/xc/87613263.jpg?v=1&c=EWSAsset&k=2&d=860EC25688CC8B2E9617B166F6C00C467D8EB72EFB52D4B89BE18AFE639C03A0
            //   https://img-aws.ehowcdn.com/default/getty/xc/87613263.jpg?v=1&c=EWSAsset&k=2&d=860EC25688CC8B2E9617B166F6C00C467D8EB72EFB52D4B89BE18AFE639C03A0
            //.replace(/\?.*$/, "");
            if (newsrc !== src) {
                return newsrc;
            }

            // http://img-aws.ehowcdn.com/300x200/photos.demandstudios.com/getty/article/88/150/87682980.jpg
            // http://img.aws.livestrongcdn.com/default/cme/cme_public_images/www_livestrong_com/photos.demandstudios.com/getty/article/92/185/472711312_XS.jpg
            newsrc = src.replace(/.*?:\/\/[^/]*\/.*?\/(photos\.demandstudios\.com\/)/, "http://$1");
            if (newsrc !== src) {
                return newsrc;
            }

            // https://img-aws.ehowcdn.com/640/ehow-food-blog-us/files/2014/12/edits-2282-1024x682.jpg
            // http://food-ehow-com.blog.ehow.com/files/2014/12/edits-2282-1024x682.jpg
            //   http://food-ehow-com.blog.ehow.com/files/2014/12/edits-2282.jpg
            newsrc = src.replace(/.*?:\/\/[^/]*\/[^/]*\/ehow-([^-/.]*)-blog-([^/.]*)\//, "http://$1-ehow-com.blog.ehow.com/");
            if (newsrc !== src) {
                return newsrc;
            }

            // http://img-aws.ehowcdn.com/615x200/cpi-studiod-com/www_ehow_com/i.ehow.com/images/a07/ai/07/prevent-soggy-graham-cracker-crust-800x800.jpg
            //   http://i.ehow.com/images/a07/ai/07/prevent-soggy-graham-cracker-crust-800x800.jpg
            // https://img-aws.ehowcdn.com/default/cme/cme_public_images/www_ehow_com/i.ehow.com/images/a04/pc/d6/season-pizza-stone-800x800.jpg
            // http://img-aws.ehowcdn.com/default/cme/cme_public_images/www_ehow_com/cdn-write.demandstudios.com/upload/image/18/2F/99D61A9C-FD10-4110-9241-BAA39E072F18/99D61A9C-FD10-4110-9241-BAA39E072F18.jpg
            //   http://cdn-write.demandstudios.com/upload/image/18/2F/99D61A9C-FD10-4110-9241-BAA39E072F18/99D61A9C-FD10-4110-9241-BAA39E072F18.jpg
            // doesn't work:
            // https://img-aws.ehowcdn.com/default/s3.amazonaws.com/cme_public_images/www_demandstudios_com/sitelife.studiod.com/ver1.0/Content/images/store/5/12/45fe6090-8ca0-4f71-9cb1-14efedc73b2e.Small.jpg
            newsrc = src.replace(/.*?:\/\/[^/]*\/.*?\/www_ehow_com\/([^/.]*\.[^/]*)\//, "http://$1/");
            if (newsrc !== src) {
                return newsrc;
            }

            // https://img-aws.ehowcdn.com/default/s3.amazonaws.com/cme_public_images/www_demandstudios_com/sitelife.studiod.com/ver1.0/Content/images/store/5/12/45fe6090-8ca0-4f71-9cb1-14efedc73b2e.Small.jpg
            newsrc = src.replace(/.*?:\/\/[^/]*\/[^/]*\/s3\.amazonaws\.com\//, "https://s3.amazonaws.com/");
            if (newsrc !== src) {
                return newsrc;
            }
        }

        if (domain === "s3.amazonaws.com" &&
            src.indexOf("s3.amazonaws.com/cme_public_images/") >= 0) {
            // http://s3.amazonaws.com/cme_public_images/www_livestrong_com/photos.demandstudios.com/getty/article/142/9/78291574_XS.jpg
            newsrc = src.replace(/.*?:\/\/[^/]*\/.*?\/(photos\.demandstudios\.com\/)/, "http://$1");
            if (newsrc !== src) {
                return newsrc;
            }
        }

        if (domain === "imageproxy.themaven.net") {
            // https://imageproxy.themaven.net/http%3A%2F%2Fimg.aws.livestrongcdn.com%2Fls-1200x630%2Fcme%2Fcme_public_images%2Fwww_livestrong_com%2Fphotos.demandstudios.com%2Fgetty%2Farticle%2F178%2F99%2F79711775_XS.jpg
            // https://imageproxy.themaven.net/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fmaven-user-photos%2Fthe-maven%2Fpress%2FhAfH0nLTEU-5d4pCxu-TUA%2F2wNFvsqAbUaqAch2Ndhq9w?w=688&q=75&h=512&auto=format&fit=crop
            //   https://s3-us-west-2.amazonaws.com/maven-user-photos/the-maven/press/hAfH0nLTEU-5d4pCxu-TUA/2wNFvsqAbUaqAch2Ndhq9w
            return decodeURIComponent(src.replace(/^.*?:\/\/[^/]*\//, "").replace(/\?.*/, ""));
        }

        if (domain.match(/photos[0-9]*\.demandstudios\.com/) &&
            src.indexOf("/dm-resize/") >= 0) {
            // http://photos2.demandstudios.com/dm-resize/s3.amazonaws.com%2Fcme_public_images%2Fwww_livestrong_com%2Fphotos.demandstudios.com%2Fgetty%2Farticle%2F142%2F9%2F78291574_XS.jpg?w=267&h=10000&keep_ratio=1
            return decodeURIComponent(src.replace(/.*?\/dm-resize\/([^/?]*).*/, "http://$1"));
        }

        if (domain.match(/photos[0-9]*\.demandstudios\.com/)) {
            // http://photos.demandstudios.com/getty/article/92/121/114336181_XS.jpg
            //   http://photos.demandstudios.com/getty/article/92/121/114336181.jpg
            // http://photos.demandstudios.com/getty/article/94/77/145190904_XS.jpg
            // http://photos.demandstudios.com/getty/article/225/172/476257962_XS.jpg
            // doesn't work:
            // photos.demandstudios.com/74/208/fotolia_608243_XS.jpg
            return src.replace(/(\/[0-9]+)_XS(\.[^/.]*)$/, "$1$2");
        }

        if (domain.indexOf(".abcnews.com") >= 0) {
            // https://s.abcnews.com/images/International/WireAP_118c1517b7f34b8bb7746eedfc01c12d_12x5_992.jpg
            //   https://s.abcnews.com/images/International/WireAP_118c1517b7f34b8bb7746eedfc01c12d.jpg
            // https://s.abcnews.com/images/US/chicago-pd-funeral-02-ap-jrl-180217_16x9t_240.jpg
            //   https://s.abcnews.com/images/US/chicago-pd-funeral-02-ap-jrl-180217.jpg
            // http://a.abcnews.com/images/Entertainment/GTY_sophie_turner_jef_150528_7x10_1600.jpg
            //   http://a.abcnews.com/images/Entertainment/GTY_sophie_turner_jef_150528.jpg
            return src.replace(/_[0-9]+x[0-9]+[a-z]?_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.nationmultimedia.com") {
            // http://www.nationmultimedia.com/img/gallery/2017/10/14/194/9ef48d31930c4bbe00957654ab1aaf1a-vps.jpeg
            //   http://www.nationmultimedia.com/img/gallery/2017/10/14/194/9ef48d31930c4bbe00957654ab1aaf1a.jpeg
            // http://www.nationmultimedia.com/img/news/2018/02/18/30339149/b4065a2adeea2230b7d230a13eda5701-atwb.jpeg
            //   http://www.nationmultimedia.com/img/news/2018/02/18/30339149/b4065a2adeea2230b7d230a13eda5701.jpeg
            return src.replace(/-[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".indiatimes.com") >= 0 ||
            // https://img.etimg.com/thumb/msid-63592870,width-643,imgsize-125649,resizemode-4/how-rihannas-song-became-howard-universitys-protest-anthem.jpg
            //   https://img.etimg.com/photo/63592870.cms
            domain === "img.etimg.com" ||
            domain === "static.toiimg.com") {
            // https://timesofindia.indiatimes.com/thumb/msid-62829284,width-400,resizemode-4/62829284.jpg
            //   https://timesofindia.indiatimes.com/photo/62829284.cms
            // http://photogallery.indiatimes.com/thumb/62742103.cms?width=164&height=122
            //   http://photogallery.indiatimes.com/photo/62742103.cms
            // https://economictimes.indiatimes.com/thumb/msid-62966896,width-274,height-198/how-the-rs-11k-cr-nirav-modi-scandal-will-affect-diamantaires.jpg
            //   https://economictimes.indiatimes.com/photo/62966896.cms
            // https://static.toiimg.com/thumb/imgsize-376350,msid-62972146,width-200,resizemode-4/62972146.jpg
            //   https://static.toiimg.com/photo/62972146.cms
            newsrc = src.replace(/\/(?:thumb|photo)\/[^/]*msid-([0-9]*)[,/].*$/, "/photo/$1.cms");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/\/(?:thumb|photo)\/(?:[^/]*\/)?([0-9]*)\.[^/.]*$/, "/photo/$1.cms");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "www.jawapos.com") {
            // https://www.jawapos.com/thumbs/xs/news/2018/02/18/tips-menghadapi-kulit-kering-di-musim-hujan_m_189572.jpeg
            //   https://www.jawapos.com/thumbs/l/news/2018/02/18/tips-menghadapi-kulit-kering-di-musim-hujan_m_189572.jpeg
            //   https://www.jawapos.com/uploads/news/2018/02/18/tips-menghadapi-kulit-kering-di-musim-hujan_m_189572.jpeg
            return src.replace(/\/thumbs\/[^/]*\//, "/uploads/");
        }

        if (domain === "asia.nikkei.com") {
            // https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/20180208t/20180208_malaysia-worker/8879284-1-eng-GB/20180208_Malaysia-worker_article_thumbnail.jpg
            // https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/20180208t/20180208_malaysia-worker/8879284-1-eng-GB/20180208_Malaysia-worker_article_main_image.jpg
            // https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/0217n/0217n-audi/8939471-1-eng-GB/0217N-Audi_large_image.jpg
            // https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/20180213t/20180213_rocket/8908091-1-eng-GB/20180213_rocket_photo_galleries_thumbnail.jpg
            // https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/20180213t/20180213_rocket/8908091-1-eng-GB/20180213_rocket_article_main_image.jpg
            // https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/20180205t/20180130citiesocial-founder-eric-wang/8846170-2-eng-GB/20180130Citiesocial-Founder-Eric-Wang_more_in_thumbnail.jpg
            //   https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/20180205t/20180130citiesocial-founder-eric-wang/8846170-2-eng-GB/20180130Citiesocial-Founder-Eric-Wang.jpg
            // https://asia.nikkei.com/var/site_cache/storage/images/top/viewpoints/humphrey-hawksley/5784021-2-app-WF/Humphrey-Hawksley_square80_thumbnail.png
            // https://asia.nikkei.com/var/site_cache/storage/images/top/magazine/20180215/8920429-1-app-WF/FREEDOM-OF-THE-OPPRESSION_cover_image.jpg
            // https://asia.nikkei.com/var/site_cache/storage/images/node_43/node_51/2018/201802/20180217t/20180217_panda/8940872-1-eng-GB/20180217_Panda_medium_thumbnail.jpg
            return src.replace(/_(?:article|large|medium|photo_galleries|more_in_thumbnail|square[0-9]*|cover_image)(?:_[a-z_]*)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.tnnthailand.com") {
            // http://www.tnnthailand.com/stocks/media/thumb_big/0656a4.jpg
            //   http://www.tnnthailand.com/stocks/media/0656a4.jpg
            return src.replace(/\/media\/[^/]*\/([^/]*)$/, "/media/$1");
        }

        if (domain.match(/data[0-9]*\.ibtimes\.(?:co\.in|sg)/)) {
            // http://data1.ibtimes.co.in/cache-img-0-450/en/full/554638/1420537417_beant-singh.jpg
            //   http://data1.ibtimes.co.in/en/full/554638/1420537417_beant-singh.jpg
            // https://data1.ibtimes.co.in/cache-img-900-0-photo/en/full/66506/-62170003800_cannes-2017-aishwarya-rai-bachchan-looks-stunning-she-walks-red-carpet.jpg
            //   https://data1.ibtimes.co.in/en/full/66506/-62170003800_cannes-2017-aishwarya-rai-bachchan-looks-stunning-she-walks-red-carpet.jpg -- doesn't work
            //   The requested URL /en/full/6/65/66506.jpg was not found on this server.
            // https://data.ibtimes.sg/en/full/16882/changi-airport.jpg?w=564&h=340&l=50&t=40
            // https://data.ibtimes.sg/en/thumb/21008/finance-minister-heng-swee-keat.jpg
            return src
                .replace(/(:\/\/[^/]*\/)cache-img-[0-9]*-[0-9]*(?:-photo)?\//, "$1")
                .replace(/\/[a-z]*(\/[0-9]+\/[^/]*)$/, "/full$1")
                .replace(/\?.*$/, "");
        }

        if (domain.match(/astro-image-resizer\.([^.]*\.)?amazonaws\.com/)) {
            // http://astro-image-resizer.s3-ap-southeast-1.amazonaws.com/17/resize/rojakdaily/media/jessica-chua/news/2018/jan/saying%20goodbye%20to%20anw%20pj%20outlet/115x76_a-w.png
            //   http://astrokentico.s3.amazonaws.com/rojakdaily/media/jessica-chua/news/2018/jan/saying%20goodbye%20to%20anw%20pj%20outlet/a-w.png?ext=.png
            //   http://astrokentico.s3.amazonaws.com/rojakdaily/media/jessica-chua/news/2018/jan/saying%20goodbye%20to%20anw%20pj%20outlet/a-w.png
            return src
                .replace(/astro-image-resizer\.([^.]*\.)?amazonaws\.com/, "astrokentico.s3.amazonaws.com")
                .replace(/(:\/\/[^/]*)\/[0-9]*\/resize\//, "$1/")
                .replace(/\/[0-9]+x[0-9]+_/, "/");
        }

        if (domain === "s3.amazonaws.com" &&
            src.indexOf("s3.amazonaws.com/nxs-wkrgtv-media") >= 0) {
            // http://s3.amazonaws.com/nxs-wkrgtv-media-us-east-1/photo/2018/02/17/Bail_Bonds_0_34542427_ver1.0_320_180.jpg
            return src.replace(/_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if ((domain === "image.photohito.k-img.com" ||
             domain === "photohito.k-img.com") &&
            src.indexOf("/uploads/") >= 0) {
            // http://image.photohito.k-img.com/uploads/photo33/user32067/a/7/a77a9f46cca054d6d488ab039382d140/a77a9f46cca054d6d488ab039382d140_s.jpg
            //   http://image.photohito.k-img.com/uploads/photo33/user32067/a/7/a77a9f46cca054d6d488ab039382d140/a77a9f46cca054d6d488ab039382d140_o.jpg
            // http://photohito.k-img.com/uploads/photo82/user81866/5/4/54cc586ea0191c8ad108c74bfff0a09d/54cc586ea0191c8ad108c74bfff0a09d_l.jpg
            //   http://photohito.k-img.com/uploads/photo82/user81866/5/4/54cc586ea0191c8ad108c74bfff0a09d/54cc586ea0191c8ad108c74bfff0a09d_o.jpg -- 4000x6016
            // o, l, s
            return src.replace(/_[a-z]*(\.[^/]*)/, "_o$1");
        }

        if (domain === "image.yes24.com") {
            // http://image.yes24.com/goods/24213246/S
            // http://image.yes24.com/goods/24213246
            //   http://image.yes24.com/goods/24213246/L
            // http://image.yes24.com/dms/201802/%EC%8A%A4%EC%B9%B4%EC%9D%B4-%EA%B3%A0%EC%A0%95%EC%9A%B1.jpg
            return src.replace(/(:\/\/[^/]*\/goods\/[0-9]+)(?:\/.*)?$/, "$1/L");
        }

        if (domain === "img.danawa.com" ||
            // http://wallpoper.com/images/00/26/57/27/taylor-momsen_00265727_thumb.jpg
            //   http://wallpoper.com/images/00/26/57/27/taylor-momsen_00265727.jpg
            domain === "wallpoper.com" ||
            // https://cdn.maximsfinest.com/930d55d5bae81ab5ab5c4bca2a2eab8b42e503f85bbd48086c9a9c89945f12e7_thumb.jpg
            domain === "cdn.maximsfinest.com" ||
            // https://www.phileweb.com/news/photo/d-av/437/43780/2_thumb.jpg
            //  https://www.phileweb.com/news/photo/d-av/437/43780/2.jpg
            domain === "www.phileweb.com" ||
            // https://www.bellazon.com/main/uploads/monthly_01_2015/post-40923-0-58758100-1422215257_thumb.jpg
            domain_nowww === "bellazon.com") {
            // http://img.danawa.com/cms/img/2010/11/19/%C7%D6%C6%D1_thumb.png
            return src.replace(/_thumb(\.[^/.]*)$/, "$1");
        }

        if (domain === "item.ssgcdn.com") {
            // http://item.ssgcdn.com/58/31/79/item/1000023793158_i1_1000.jpg
            //   http://item.ssgcdn.com/58/31/79/item/1000023793158_i1.jpg
            return src.replace(/(\/item\/[^/]*)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain.match(/thumbnail[0-9]*\.coupangcdn\.com/)) {
            // https://thumbnail3.coupangcdn.com/thumbnails/remote/48x48ex/image/product/image/vendoritem/2016/11/02/3054079121/95e6ce14-cd6e-43ef-89af-6f50046c19e8.jpg
            //   https://image3.coupangcdn.com/image/product/image/vendoritem/2016/11/02/3054079121/95e6ce14-cd6e-43ef-89af-6f50046c19e8.jpg
            return src
                .replace(/thumbnail([0-9]*\.coupangcdn\.com)/, "image$1")
                .replace(/\/thumbnails\/remote\/[^/]*\//, "/");
        }

        if (domain === "image.notepet.co.kr") {
            // http://image.notepet.co.kr/resize/540x-/seimage/20160127%2F201601271000_61120010294826_1.jpg
            return src.replace(/\/resize\/[^/]*\//, "/");
        }

        if (domain_nowww === "koreamg.com" ||
            domain_nowww === "yufit.co.kr" ||
            domain_nowww === "fncstore.com") {
            // http://koreamg.com/web/product/big/201511/1198_shop1_844046.jpg
            // http://yufit.co.kr/web/product/medium/201802/1402_shop1_771117.jpg
            // http://fncstore.com/web/product/small/201805/624_shop1_15268628600267.jpg
            return src.replace(/\/web\/product\/(?:small|medium)\//, "/web/product/big/");
        }

        if (domain.indexOf(".mynavi.jp") >= 0) {
            // https://news.mynavi.jp/article/20160717-a030/images/004.jpg
            // https://news.mynavi.jp/article/20180219-586202/index_images/index.jpg/iapp
            //   https://news.mynavi.jp/article/20180219-586202/index_images/index.jpg
            //   https://news.mynavi.jp/article/20180219-586202/images/001l.jpg
            return src
                .replace(/\/index_images\/[^/]*(?:\/[^/]*)?$/, "/images/001l.jpg")
                .replace(/\/images\/([0-9]+)(\.[^/.]*)$/, "/images/$1l$2");
        }

        if (domain === "cdn.deview.co.jp") {
            // https://cdn.deview.co.jp/imgs/news_image.img.php?am_file=757f7eac8208248ef689a9c8f195cc0a.jpg&am_width=10&am_height=10
            // https://cdn.deview.co.jp/imgs/news_image.img.php?am_file=8a0abbef91348f3b44e2225c761fe8e8.jpg&am_width=0&am_height=0
            //   https://cdn.deview.co.jp/imgs/news/8/a/0/8a0abbef91348f3b44e2225c761fe8e8.jpg
            //return src.replace(/\/imgs\/news_image\.img\.php.*?(am_file=[^&]*).*/, "/imgs/news_image.img.php?$1&am_width=0&am_height=0");
            return src.replace(/\/imgs\/news_image\.img\.php.*?am_file=([^&])([^&])([^&])([^&]*).*/, "/imgs/news/$1/$2/$3/$1$2$3$4");
        }

        if (domain === "imgcache.dealmoon.com") {
            // http://imgcache.dealmoon.com/fsvr.dealmoon.com/dealmoon/082/3a3/a3a/e33/eed/93a/ffd/aae/d10/29e/37.jpg_600_0_15_363b.jpg
            //   http://fsvr.dealmoon.com/dealmoon/082/3a3/a3a/e33/eed/93a/ffd/aae/d10/29e/37.jpg
            return src.replace(/.*?:\/\/[^/]*\/(.*?)(\.[^/._]*)_[^/]*?$/, "http://$1$2");
        }

        // magento
        if (domain === "www.usmall.us" ||
            // http://www.sofiehouse.co/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/E/l/Elegant-Sweetheart-Long-Gold-Sequined-Taylor-Swift-Red-Carpet-Celebrity-Dress_2.jpg
            //   http://www.sofiehouse.co/media/catalog/product/E/l/Elegant-Sweetheart-Long-Gold-Sequined-Taylor-Swift-Red-Carpet-Celebrity-Dress_2.jpg
            domain === "www.sofiehouse.co" ||
            // https://www.thecelebritydresses.com/media/catalog/product/cache/1/small_image/295x/040ec09b1e35df139433887a97daa66f/t/a/taylor_swift_red_lace_party_dress_iheartradio_music_festival_2012_dresses_5.jpg
            //   https://www.thecelebritydresses.com/media/catalog/product/cache/1/image/650x/040ec09b1e35df139433887a97daa66f/t/a/taylor_swift_red_lace_party_dress_iheartradio_music_festival_2012_dresses_5.jpg
            //   https://www.thecelebritydresses.com/media/catalog/product/t/a/taylor_swift_red_lace_party_dress_iheartradio_music_festival_2012_dresses_5.jpg
            domain === "www.thecelebritydresses.com" ||
            // https://www.celebredcarpetdresses.com/media/catalog/product/cache/8/image/9df78eab33525d08d6e5fb8d27136e95/t/a/taylor-swift-at-the-2012-billboard-music-awards-2.jpg
            //   https://www.celebredcarpetdresses.com/media/catalog/product/t/a/taylor-swift-at-the-2012-billboard-music-awards-2.jpg
            domain === "www.celebredcarpetdresses.com" ||
            // https://www.minimal.co.id/media/catalog/product/cache/1/small_image/252x/7b8fef0172c2eb72dd8fd366c999954c/1/3/136_02_02dsc00253ed.jpg
            //   https://www.minimal.co.id/media/catalog/product/1/3/136_02_02dsc00253ed.jpg
            domain === "www.minimal.co.id" ||
            // http://www.bridesmaidca.ca/media/catalog/product/cache/1/thumbnail/56x90/9df78eab33525d08d6e5fb8d27136e95/B/D/BD2305-1832-01/BD2305CA1832-Mermaid-Trumpet-Blue-Stretch-Satin-V-Neck-Floor-Length-Bridesmaid-Dresses-11.jpg
            //   http://www.bridesmaidca.ca/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/B/D/BD2305-1832-01/BD2305CA1832-Mermaid-Trumpet-Blue-Stretch-Satin-V-Neck-Floor-Length-Bridesmaid-Dresses-31.jpg
            // http://www.bridesmaidca.ca/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/B/D/BD1749-03/Short-Lace-and-Tulle-Black-Bridesmaid-Dress-BD-CA1749-33.jpg
            // http://www.bridesmaidca.ca/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/B/D/BD1749-02/Short-Lace-and-Tulle-Black-Bridesmaid-Dress-BD-CA1749-32.jpg
            domain === "www.bridesmaidca.ca" || // doesn't work
            // http://www.sisley-paris.com/ko-KR/media/catalog/product/cache/3/sisley_hd_image/450x/9df78eab33525d08d6e5fb8d27136e95/sisley_hd_image/3473311704000.jpg
            //   http://www.sisley-paris.com/ko-KR/media/catalog/product/cache/3/sisley_hd_image/9df78eab33525d08d6e5fb8d27136e95/sisley_hd_image/3473311704000.jpg
            //   http://www.sisley-paris.com/ko-KR/media/catalog/product/sisley_hd_image/3473311704000.jpg
            domain === "www.sisley-paris.com" ||
            // https://d2ovdo5ynwfl3w.cloudfront.net/media/catalog/product/cache/5/image/03deeb199a85666540b12534551b8531/0/0/001CH-003-03172-1_1_1-DS.jpg
            domain === "d2ovdo5ynwfl3w.cloudfront.net" ||
            // https://d1cizyvjjqnss7.cloudfront.net/media/catalog/product/cache/1/image/700x700/af097278c5db4767b0fe9bb92fe21690/2/0/2017-9-26-isabelle-31991_2_2.jpg
            domain === "d1cizyvjjqnss7.cloudfront.net" ||
            // https://executiveponies.com/media/catalog/product/cache/2/thumbnail/90x144/9df78eab33525d08d6e5fb8d27136e95/3/2/327a6104_copy.jpg
            domain === "executiveponies.com" ||
            domain === "www.lizandliz.com" ||
            src.match(/(?:\/media)?\/catalog\/product\/cache\/(?:[0-9]*\/[^/]*\/)?(?:[0-9]+x(?:[0-9]+)?\/)?[0-9a-f]{32}\//)) {
            // https://www.sonassi.com/blog/knowledge-base/deconstructing-the-cache-image-path-on-magento
            //
            // http://www.usmall.us/media/catalog/product/cache/16/image/600x600/d58d44b981214661663244ef00ea7e30/1/7/17_9__2.jpg
            //   http://www.usmall.us/media/catalog/product/cache/16/image/d58d44b981214661663244ef00ea7e30/1/7/17_9__2.jpg
            // https://www.lizandliz.com/media/catalog/product/cache/4/thumbnail/492x705/9df78eab33525d08d6e5fb8d27136e95/t/a/taylor-swift-red-dress-cma-awards-2013-02.jpg
            //   https://www.lizandliz.com/media/catalog/product/cache/4/thumbnail/9df78eab33525d08d6e5fb8d27136e95/t/a/taylor-swift-red-dress-cma-awards-2013-02.jpg
            //   https://www.lizandliz.com/media/catalog/product/t/a/taylor-swift-red-dress-cma-awards-2013-02.jpg
            // https://www.lizandliz.com/media/catalog/product/cache/4/image/492x705/9df78eab33525d08d6e5fb8d27136e95/t/a/taylor-swift-red-dress-cma-awards-2013-01.jpg
            //   https://www.lizandliz.com/media/catalog/product/cache/4/image/9df78eab33525d08d6e5fb8d27136e95/t/a/taylor-swift-red-dress-cma-awards-2013-01.jpg
            //   https://www.lizandliz.com/media/catalog/product/t/a/taylor-swift-red-dress-cma-awards-2013-01.jpg
            // https://www.naturehills.com/media/catalog/product/cache/5643cdae475c4be953fc8c21f6960dc2/f/o/forsythia-fiesta-medium-shrub-425x425.jpg
            //   https://www.naturehills.com/media/catalog/product/f/o/forsythia-fiesta-medium-shrub-425x425.jpg
            /*return src
                .replace(/(\/cache\/[0-9]*\/)small_image\//, "$1/image/")
                .replace(/\/(thumbnail|image)\/[0-9]+x[0-9]+\//, "/$1/");*/
            return src.replace(/\/cache\/(?:[0-9]*\/[^/]*\/)?(?:[0-9]+x(?:[0-9]+)?\/)?[0-9a-f]{32}\/((?:.\/.\/)|(?:[^/]*\/))([^/]*)$/, "/$1$2");
            //return src.replace(/\/image\/[0-9]+x[0-9]+\//, "/image/");
        }

        if (domain === "cdn.okdress.co.nz" ||
            // https://www.promshopau.com/media/catalog/product/cache/1/small_image/400x600/va/cymz2697/5wxh3src.jpg?1496649473
            // forbidden
            (domain_nowww === "promshopau.com" && false)) {
            // https://cdn.okdress.co.nz/media/catalog/product/cache/1/small_image/400x600/va/crqx3207/yhhv4ee5.jpg?1497240049
            //   https://cdn.okdress.co.nz/media/catalog/product/va/crqx3207/yhhv4ee5.jpg?1497240049
            return src.replace(/(\/media\/catalog\/product\/)cache\/[0-9]*\/[^/]*\/[0-9]+x[0-9]+\//, "$1");
        }

        if (domain === "img.nextmag.com.tw") {
            // http://img.nextmag.com.tw//campaign/28/640x_dc09fc97b8f881555c21e8df08f39d01.jpg
            return src.replace(/\/[0-9]+x(?:[0-9]+)?_([^/]*)$/, "/$1");
        }

        if (domain.indexOf(".meitudata.com") >= 0) {
            // http://mvimg10.meitudata.com/568fd904846585397.jpg!thumb320
            return src.replace(/![^/]*$/, "");
        }

        if (domain === "www.shogakukan.co.jp") {
            // https://www.shogakukan.co.jp/thumbnail/books/09682221
            //   https://www.shogakukan.co.jp/thumbnail/snsbooks/09682221
            return src.replace(/\/thumbnail\/books\//, "/thumbnail/snsbooks/");
        }

        if (domain === "images.sysapi.mtg.now.com") {
            // https://images.sysapi.mtg.now.com/mposter/album/m/VASB00139622A_m.jpg
            //   https://images.sysapi.mtg.now.com/mposter/album/o/VASB00139622A_o.jpg
            return src.replace(/\/[a-z]\/([^/]*)_[a-z](\.[^/.]*)$/, "/o/$1_o$2");
        }

        if (domain.match(/img[0-9]*[^.]*\.lst\.fm/)) {
            // http://img2-ak.lst.fm/i/u/174s/ac79a7aa21de5694760ad9228e15c6a5.png
            //   http://img2-ak.lst.fm/i/u/ac79a7aa21de5694760ad9228e15c6a5.png
            return src.replace(/(\/i\/[a-z]\/)[0-9]+s\//, "$1");
        }

        if (domain === "www.hdwallpapers.in" ||
            domain === "freshwallpapers.in" ||
            domain === "www.freshwallpapers.in") {
            // https://www.hdwallpapers.in/download/selena_gomez_2018_4k_8k-1440x2560.jpg
            // https://www.hdwallpapers.in/thumbs/2018/selena_gomez_2018_4k_8k-t2.jpg
            //   https://www.hdwallpapers.in/walls/selena_gomez_2018_4k_8k-wide.jpg
            // http://freshwallpapers.in/thumbs/sonam_kapoor_sexy_wallpaper-t1.jpg
            //   http://freshwallpapers.in/walls/sonam_kapoor_sexy_wallpaper-wide.jpg
            return src
                .replace(/\/(?:download|thumbs)\//, "/walls/")
                .replace(/-[^-_/.]*(\.[^/.]*)$/, "-wide$1");
        }

        if ((domain.indexOf("images.deezer.com") >= 0 ||
             domain.indexOf("images.dzcdn.net") >= 0) && false) {
            // not reliable, can upscale
            // http://e-cdn-images.deezer.com/images/artist/7d026f08b34a098e270a663839d8ae8e/200x200-000000-80-0-0.jpg
            //   http://e-cdn-images.deezer.com/images/artist/7d026f08b34a098e270a663839d8ae8e/99999999999x99999999999-000000-100-0-0.jpg -- 1200x1200, unscaled
            //   http://e-cdn-images.deezer.com/images/artist/7d026f08b34a098e270a663839d8ae8e/99999999999x0-000000-100-0-0.jpg -- 800x1200, unscaled, more height, less detail
            // https://e-cdns-images.dzcdn.net/images/artist/aca61b38901f884503e9cb0fbf0b93b4/200x200-000000-80-0-0.jpg
            //   https://e-cdns-images.dzcdn.net/images/artist/aca61b38901f884503e9cb0fbf0b93b4/99999999999x0-000000-100-0-0.jpg -- 801x1200, definitely scaled
            return src.replace(/\/[0-9]+x[0-9]+-[0-9]+-[0-9]+-[0-9]+-[0-9]+(\.[^/.]*)$/, "/99999999999x0-000000-100-0-0$1");
        }

        if (domain === "cdn.wallpaper.com") {
            // https://cdn.wallpaper.com/main/styles/wp_medium_grid/s3/2018/02/astonmartindb11volantefrontsideview.jpg
            //   https://cdn.wallpaper.com/main/astonmartindb11volantefrontsideview.jpg
            // https://cdn.wallpaper.com/main/styles/wp_large/s3/2018/02/go_gardenofrussolo.jpg
            //   https://cdn.wallpaper.com/main/go_gardenofrussolo.jpg
            // https://cdn.wallpaper.com/main/styles/responsive_920w_scale/s3/baldacchino-by-stanton-williams-c-saverio-lombardi-vallauri_006_0.jpg
            //   https://cdn.wallpaper.com/main/baldacchino-by-stanton-williams-c-saverio-lombardi-vallauri_006_0.jpg
            // https://cdn.wallpaper.com/main/styles/wp_large/s3/l-kosmosbywonderglass_photoleonardoduggento02.jpg
            //   https://cdn.wallpaper.com/main/kosmosbywonderglass_photoleonardoduggento02.jpg
            // https://cdn.wallpaper.com/main/styles/wp_medium_grid/s3/2018/04/hermessalonedelmobile2018.jpg
            //   https://cdn.wallpaper.com/main/2018/04/hermessalonedelmobile2018.jpg
            //   https://cdn.wallpaper.com/main/hermessalonedelmobile2018.jpg -- doesn't work
            regex = /\/main\/styles\/[^/]*\/[^/]*\/(.*\/)?(?:l-)?([^/]*)/;
            return [src.replace(regex, "/main/$2"), src.replace(regex, "/main/$1$2")];
            //return src.replace(/\/styles\/[^/]*\/s[0-9]*\/[0-9]+\/[0-9]+\/([^/]*)$/, "/$1");
        }

        if (domain === "cdn.wallpaper.com") {
            // https://cdn.wallpaper.com/main/styles/responsive_920w_scale/s3/baldacchino-by-stanton-williams-c-saverio-lombardi-vallauri_006_0.jpg
            return src.replace(/\/main\/styles\/[^/]*\/[^/]*\//, "/");
        }

        if (domain === "static.warthunder.com") {
            // https://static.warthunder.com/upload/image/wallpapers/_thumbs/280x/magach_3_1920x1080_logo_com_73e9f4582d0d841a6abf1f2c75beaf4d.jpg
            //   https://static.warthunder.com/upload/image/wallpapers/magach_3_1920x1080_logo_com_73e9f4582d0d841a6abf1f2c75beaf4d.jpg
            return src.replace(/\/_thumbs\/[0-9]+x(?:[0-9]+)?\//, "/");
        }

        if (domain === "cdn.wallpaperdirect.com") {
            // https://cdn.wallpaperdirect.com/shared-assets/images/products/094269_163x163_thumb.jpg
            //   https://cdn.wallpaperdirect.com/shared-assets/images/products/094269orig.jpg
            return src.replace(/(\/[0-9]*)_[^/.]*(\.[^/.]*)$/, "$1orig$2");
        }

        if (domain.indexOf(".bamcontent.com") >= 0) {
            // https://nhl.bamcontent.com/images/photos/291203200/2568x1444/cut.jpg
            return src.replace(/(\/images\/photos\/[0-9]*\/)[0-9]+x[0-9]+\/[^/.]*(\.[^/.]*)$/, "$1raw$2");
        }

        if (domain.match(/filed.*\.mail\.ru$/) &&
            src.match(/:\/\/[^/]*\/pic/)) {
            // https://filed17-26.my.mail.ru/pic?url=https%3A%2F%2Fcontent-17.foto.my.mail.ru%2Fmail%2Faudioknigi.online%2F_musicplaylistcover%2Fi-760.jpg&sigt=a2f820fc2604a1526688be9b380e7e24&ts=1519171200&mw=156&mh=156&croped=1
            //   https://content-17.foto.my.mail.ru/mail/audioknigi.online/_musicplaylistcover/i-760.jpg
            return decodeURIComponent(src.replace(/.*\/pic.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "mg.soupingguo.com") {
            // http://mg.soupingguo.com/attchment2/AppImg/110x73/2016/01/26/c2d275d9-ffc4-4ca3-86d0-70f717f789dc.jpg
            //   http://mg.soupingguo.com/attchment2/AppImg/0x0/2016/01/26/c2d275d9-ffc4-4ca3-86d0-70f717f789dc.jpg
            return src.replace(/(\/attchment[^/]*\/[^/]*Img\/)[0-9]+x[0-9]+\//, "$10x0/");
        }

        if (domain === "img.yaplog.jp") {
            // http://img.yaplog.jp/img/17/mo/y/a/m/yamu98/24/24094.jpg
            //   http://img.yaplog.jp/img/17/pc/y/a/m/yamu98/24/24094.jpg
            return src.replace(/(\/img\/[^/]*\/)mo\//, "$1pc/");
        }

        if (domain === "www.hochi.co.jp") {
            // http://www.hochi.co.jp/photo/20180220/20180220-OHT1I50164-L.jpg
            // L, T, N
            return src.replace(/-[A-Z](\.[^/.]*)$/, "-L$1");
        }

        if (domain.indexOf(".wikispaces.com") >= 0) {
            // https://sweetteaandscience.wikispaces.com/file/view/111.jpg/539497268/460x315/111.jpg
            //   https://sweetteaandscience.wikispaces.com/file/view/111.jpg
            return src.replace(/(\/view\/[^/]*\.[^/]*)\/.*?$/, "$1");
        }

        if (domain === "cdn.mdpr.jp") {
            // wip
            // https://cdn.mdpr.jp/photo/images/9b/c4b/244c1e_129677c70cb47761dc2243224aee09db43068c042b172144.jpg
            // aligned:
            //   https://cdn.mdpr.jp/photo/images/9b/c4b/244c1e_  129677c70cb47761dc2243224aee09db43068c042b172144.jpg
            //   https://cdn.mdpr.jp/photo/images/9b/c4b/w700c-ez_129677c70cb47761dc22432245d7f66fdae68c042b172144.jpg
            // https://mdpr.jp/photo/images/2016/02/21/e_1997280.jpg
            //   https://mdpr.jp/photo/images/2016/02/21/1997280.jpg
            // https://mdpr.jp/photo/detail/3179461
            //   https://cdn.mdpr.jp/photo/images/73/014/w700c-ez_923f6fd535f050dd50a0c1844e00845cfda81f02f814a731.jpg
            // https://mdpr.jp/news/detail/1319088
            //   https://mdpr.jp/photo/images/2014/01/17/600c-_1181978.jpg
            //   https://mdpr.jp/photo/images/2014/01/17/e_1181978.jpg
            //   https://cdn.mdpr.jp/photo/images/de/f96/w700c-ez_5f31b9207ce33a447ceff0069f5057adc853bf29a07018d6.jpg
            // https://cdn.mdpr.jp/photo/images/ff/357/w720c-e_86733135a9e323a66d900f9f12614d8db65c8521f7b16fdc.jpg
            // http://mdpr.jp/news/detail/1672412
            //   https://cdn.mdpr.jp/photo/images/cb/aba/0_3c3602ff62198c52f8e11a287cfbf2542e7a8470e1cfdbc2.jpg
            //  https://mdpr.jp/photo/detail/2714005
            //   https://cdn.mdpr.jp/photo/images/4d/9be/0_eb892aca2b6f152631f04dbe0b7ec6d67bad6240e6373cd5.jpg
            //   https://cdn.mdpr.jp/photo/images/4d/9be/0_eb892aca2b6f152631f04dbe05759594bb7ec6d6e6373cd5.jpg - broken
            //   https://cdn.mdpr.jp/photo/images/4d/9be/w700c-ez_eb892aca2b6f152631f04dbe05759594bb7ec6d6e6373cd5.jpg
            //   https://cdn.mdpr.jp/photo/images/4d/9be/eb892aca2b6f152631f04dbe0b7ec6d67bad6240e6373cd5.jpg
        }

        if (domain === "www.sponichi.co.jp") {
            // http://www.sponichi.co.jp/entertainment/news/2017/12/12/jpeg/20171211s00041000381000p_thum.jpg
            //   http://www.sponichi.co.jp/entertainment/news/2017/12/12/jpeg/20171211s00041000381000p_view.jpg
            return src.replace(/_thum(\.[^/.]*)$/, "_view$1");
        }

        if (domain === "thumbnail.image.rakuten.co.jp") {
            // source:
            // https://books.rakuten.co.jp/rb/12499383/?scid=af_pc_etc&sc2id=af_111_1_10000673
            //
            // https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/3966/4907953093966.jpg?_ex=76x76
            //   https://tshop.r10s.jp/book/cabinet/3966/4907953093966.jpg?fitin=200:300&composite-to=*,*|200:300
            //   https://shop.r10s.jp/book/cabinet/3966/4907953093966.jpg
            return src.replace(/.*?:\/\/[^/]*\/@[^/]*\/([^?]*).*?$/, "http://shop.r10s.jp/$1");
        }

        if (domain_nowww === "billboard-japan.com") {
            // http://www.billboard-japan.com/scale/news/00000057/57632/800x_image.jpg - upscaled
            //   http://www.billboard-japan.com/scale/news/00000057/57632/image.jpg
            // http://www.billboard-japan.com/scale/news/00000057/57981/170x170_image.jpg
            //   http://www.billboard-japan.com/scale/news/00000057/57981/image.jpg
            return src.replace(/\/[0-9]+x(?:[0-9]+)?_([^/]*)$/, "/$1");
        }

        if (domain.indexOf("top.tsite.jp") >= 0 &&
            src.indexOf("/contents_image/") >= 0) {
            // http://cdn.top.tsite.jp/static/top/sys/contents_image/038/778/192/38778192_0_sl.jpg
            //   http://cdn.top.tsite.jp/static/top/sys/contents_image/038/778/192/38778192_0.jpg
            // http://cdn.top.tsite.jp/static/top/sys/contents_image/034/410/417/34410417_0_rl.jpg
            //   http://cdn.top.tsite.jp/static/top/sys/contents_image/034/410/417/34410417_0.jpg
            // http://top.tsite.jp/static/top/sys/contents_image/038/780/255/38780255_133963.jpg
            // http://cdn.top.tsite.jp/static/top/sys/contents_image/media_image/035/136/128/35136128_0.jpeg
            //return src.replace(/_sl(\.[^/.]*)$/, "$1");
            return src.replace(/(\/[0-9]+)_[0-9]+(?:_[^/.]+)?(\.[^/.]*)$/, "$1_0$2");
        }

        if (domain === "www.sanspo.com") {
            // http://www.sanspo.com/geino/images/20171108/geo17110807000004-m1.jpg
            //   http://www.sanspo.com/geino/images/20171108/geo17110807000004-p1.jpg
            // http://www.sanspo.com/geino/images/20140818/oth14081805030011-s3.jpg
            //   http://www.sanspo.com/geino/images/20140818/oth14081805030011-p3.jpg
            // http://www.sanspo.com/geino/images/20140818/oth14081805030011-m1.jpg
            //   http://www.sanspo.com/geino/images/20140818/oth14081805030011-p1.jpg
            //
            // p, m, n, s
            // https://sankei2img.durasite.net/images//uploads/creative/image1/111885/20180221_bmw_150x150.jpg
            //   http://www.sankei.com/images/news/180221/lif1802210001-p1.jpg -- unrelated?
            return src.replace(/(\/images\/[0-9]*\/[^/]*-)[a-z]([0-9]+\.[^/.]*)$/, "$1p$2");
        }

        if (domain === "www.sonymusicshop.jp") {
            // https://www.sonymusicshop.jp/img/1/item/SRC/L00/000/SRCL000009658_SHOP__576_320_102400_jpg.jpg?tf=gray
            //   https://www.sonymusicshop.jp/img/1/item/SRC/L00/000/SRCL000009658_SHOP__9999999999999999_9999999999999999_102400_jpg.jpg?tf=gray
            return src.replace(/__[0-9]+_[0-9]+(_[0-9]+_[a-z]+\.[a-z]*)(?:\?.*)?$/, "__9999999999999999_9999999999999999$1");
        }

        if (domain === "prtimes.jp") {
            // https://prtimes.jp/i/13546/1204/thumb/68x45/d13546-1204-280004-0.jpg
            //   https://prtimes.jp/i/13546/1204/original/d13546-1204-280004-0.jpg
            // https://prtimes.jp/i/13546/826/resize/d13546-826-654115-3.jpg
            //   https://prtimes.jp/i/13546/826/original/d13546-826-654115-3.jpg
            return src
                .replace(/\/thumb\/[0-9]+x[0-9]+\//, "/original/")
                .replace(/\/resize\/([^/]*)$/, "/original/$1");
        }

        if (domain.indexOf(".vietbao.vn") >= 0) {
            // http://vietbao.vn/The-gioi-giai-tri/Hot-girl-Le-Huyen-Anh-Mong-xuan-nay-co-nguoi-som-hoi-cuoi/2147799797/235/ - article
            // http://img.vietbao.vn/images/280/vn888/hot/v2014/cropping-1518416661-27540512-1833666450263816-461803420186171326-n.jpeg
            //   http://img.vietbao.vn/images/0/vn888/hot/v2014/cropping-1518416661-27540512-1833666450263816-461803420186171326-n.jpeg - larger, not full
            //      http://a9.vietbao.vn/images/vn888/hot/v2014/cropping-1518416661-27540512-1833666450263816-461803420186171326-n.jpeg - same
            //
            //   http://img.vietbao.vn/images/0/vn999/upload/hangct/27540512_1833666450263816_461803420186171326_n.jpg - full
            //      http://a9.vietbao.vn/images/vn999/upload/hangct/27540512_1833666450263816_461803420186171326_n.jpg - orig
            //
            // http://vietbao.vn/The-gioi-giai-tri/Thieu-gia-giau-nhat-Trung-Quoc-lao-dao-vi-tin-chong-lung-tang-sieu-xe-tien-ty-cho-Tara/55932319/235/ - article
            // http://a9.vietbao.vn/images/vn888/hot/v2014/cropping-1515483333-nhat-trung-quoc-lao-dao-vi-tin-chong-lung-tang-sieu-xe-tien-ty-cho-t-ara-1.jpeg
            //   http://a9.vietbao.vn/images/vn999/55/2018/01/20180109-ia-giau-nhat-trung-quoc-lao-dao-vi-tin-chong-lung-tang-sieu-xe-tien-ty-cho-t-ara-1.jpg
            return src
                //.replace(/\/images\/[0-9]+\//, "/images/0/")
                .replace(/:\/\/img\.vietbao\.vn\/images\/[0-9]+\//, "://a9.vietbao.vn/images/");
        }

        if (domain === "www.vir.com.vn") {
            // http://www.vir.com.vn/stores/news_dataimages/hung/022018/22/09/in_article/croped/fred-gives-shakhtar-edge-over-roma.jpg
            //   http://www.vir.com.vn/stores/news_dataimages/hung/022018/22/09/fred-gives-shakhtar-edge-over-roma.jpg
            return src
                .replace(/\/in_article\//, "/")
                .replace(/\/croped\//, "/");
        }

        if (domain === "media.tinnong.net.vn") {
            // http://media.tinnong.net.vn/uploaded/Images/Thumb/2018/02/22/Toi_dau_don_roi_bo_anh_de_den_voi_mot_nguoi_khong_binh_thuong_vi_mot_chu_hieu2_2202144833.jpg
            //   http://media.tinnong.net.vn/uploaded/Images/Original/2018/02/22/Toi_dau_don_roi_bo_anh_de_den_voi_mot_nguoi_khong_binh_thuong_vi_mot_chu_hieu2_2202144833.jpg
            return src.replace(/\/Images\/[^/]*\//, "/Images/Original/");
        }

        if (domain === "images.kienthuc.net.vn" ||
            // https://images.khoeplus24h.vn/zoomh/500/uploaded/anhtuan/2016_09_27/3/taylor-switt-dep-the-nao-moi-lan-xuat-hien-ben-ban-trai.jpg
            //   https://images.khoeplus24h.vn/uploaded/anhtuan/2016_09_27/3/taylor-switt-dep-the-nao-moi-lan-xuat-hien-ben-ban-trai.jpg
            domain === "images.khoeplus24h.vn") {
            // http://images.kienthuc.net.vn/zoomh/500/uploaded/nguyenvan/2018_02_22/vang/vang-1_CUMV.jpg
            //   http://images.kienthuc.net.vn/uploaded/nguyenvan/2018_02_22/vang/vang-1_CUMV.jpg
            return src.replace(/\/zoom[a-z]\/[0-9]*\//, "/");
        }

        if (domain === "rez.cdn.kul.vn" ||
            // http://longtake.it/media/cache/medium_poster/uploads/du/dunkirk/poster-dunkirk.jpeg
            //   http://longtake.it/uploads/du/dunkirk/poster-dunkirk.jpeg
            domain_nowww === "longtake.it") {
            // http://rez.cdn.kul.vn/media/cache/thumbnail_16x10_672x420/uploads/media/thumbnail/59db/29/thumbnail_16x9_t-ara4.jpg
            //   http://rez.cdn.kul.vn/uploads/media/kul/59db/28/kul_news_t-ara4.jpg
            return src.replace(/\/media\/cache\/[^/]*\//, "/");
        }

        if (domain === "static.kstyle.com") {
            // http://static.kstyle.com/stf/ad622b862613fa27895446d446bca918.jpg/r.580x0
            //   http://static.kstyle.com/stf/ad622b862613fa27895446d446bca918.jpg
            return src.replace(/\/r\.[0-9]+x[0-9]+$/, "");
        }

        if (domain === "lifesite-cache.s3.amazonaws.com") {
            // https://lifesite-cache.s3.amazonaws.com/images/made/images/remote/https_s3.amazonaws.com/lifesite/man_and_woman_arguing_with_signs_810_500_55_s_c1.jpg
            //   https://s3.amazonaws.com/lifesite/man_and_woman_arguing_with_signs.jpg
            // https://lifesite-cache.s3.amazonaws.com/images/made/images/remote/https_s3.amazonaws.com/lifesite/Billy_Graham__finger_pointing_720_470_55_s_c1.jpg
            //   https://s3.amazonaws.com/lifesite/Billy_Graham__finger_pointing.jpg
            return src
                .replace(/.*\/images\/remote\/([^_]*)_(.*)_[0-9]+_[0-9]+_[0-9]+_[a-z]_[a-z][0-9](\.[^/.]*)$/, "$1://$2$3");
        }

        if (domain.indexOf(".fap.to") >= 0) {
            // http://x3.fap.to/images/thumb/62/114/1146416891.jpg
            //   http://x3.fap.to/images/full/62/114/1146416891.jpg
            return src.replace(/\/images\/[a-z]*\//, "/images/full/");
        }

        if (domain === "www.gannett-cdn.com" &&
            src.indexOf("/-ip-/") >= 0) {
            // https://www.gannett-cdn.com/-ip-/https://media.gannett-cdn.com/29906170001/29906170001_5720100432001_5720093419001-vs.jpg?pubId=29906170001&quality=10
            //   https://media.gannett-cdn.com/29906170001/29906170001_5720100432001_5720093419001-vs.jpg
            return src.replace(/.*?\/-ip-\//, "");
        }

        if (domain === "cdn.mainichi.jp") {
            // https://cdn.mainichi.jp/vol1/2018/02/19/20180219p2g00m0sp060000p/4.jpg
            //   https://cdn.mainichi.jp/vol1/2018/02/19/20180219p2g00m0sp060000p/9.jpg
            return src.replace(/\/[0-9]+(\.[^/.]*)$/, "/9$1");
        }

        if (domain === "img.evbuc.com") {
            // forces download?
            // https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F37338904%2F45878487997%2F1%2Foriginal.jpg?w=1000&rect=0%2C236%2C1890%2C945&s=53555af848d3afd2d9a9b2cb603d9516
            return decodeURIComponent(src.replace(/.*:\/\/[^/]*\/([^?]*).*/, "$1"));
        }

        if (domain === "img.cdandlp.com") {
            // https://img.cdandlp.com/2017/08/imgL/118890893.jpg
            // https://img.cdandlp.com/2017/08/imgS/118890893.jpg
            // https://img.cdandlp.com/img_ssl/1274211304-73249-1.jpg
            // https://ring.cdandlp.com/sleazyx/photo_grande/115030078-3.jpg
            // https://content.cdandlp.com/superflyrecords/catalogue/40106.jpg
            // https://www.soundfinder.jp/img/products/102065/1507215600/59d727b5-151c-4c14-8768-62417697bade/1180602.jpg
            // https://img.cdandlp.com/2014/09/imgM/117153395.jpg
            return src.replace("/imgS/", "/imgL/").replace("/imgM/", "/imgL/");
        }

        if (domain === "walter.trakt.tv") {
            // https://walter.trakt.tv/images/shows/000/082/248/fanarts/thumb/04342b5daf.jpg.webp
            //   https://walter.trakt.tv/images/shows/000/082/248/fanarts/full/04342b5daf.jpg.webp
            return src.replace(/\/thumb\/([^/]*)$/, "/full/$1");
        }

        if (domain === "cdn.apk-cloud.com") {
            // http://cdn.apk-cloud.com/detail/screenshot/sYpEJNqANEbHAkHjLbYOOdRyn3sIhEtHgF8qSEpKXE38UR0RpI4X7b2eQfTQIiiljCrL.png
            // http://cdn.apk-cloud.com/detail/screenshot/sYpEJNqANEbHAkHjLbYOOdRyn3sIhEtHgF8qSEpKXE38UR0RpI4X7b2eQfTQIiiljCrL=h400.png
            return src
                .replace(/(?:=[a-z][0-9]*)?(\.[^/.]*)$/, "=h0$1");
        }

        if (domain.indexOf(".polyvoreimg.com") >= 0) {
            // https://ak2.polyvoreimg.com/cgi/img-thing/size/l/tid/3884489.jpg
            //   https://www.polyvore.com/cgi/img-thing?.out=jpg&size=l&tid=3884489
            // https://cfc.polyvoreimg.com/cgi/img-set/.sig/9ndQlKC89OQ6ut3OULMg/cid/230139023/id/tsrtpPy65xGAdEGMmAc2pA/size/c1024x1024.jpg
            //   https://cfc.polyvoreimg.com/cgi/img-set/cid/230139023/id/tsrtpPy65xGAdEGMmAc2pA/size/c1024x1024.jpg
            //   https://cfc.polyvoreimg.com/cgi/img-set/cid/230139023/size/c1024x1024.jpg
            //   https://www.polyvore.com/cgi/img-set?.out=jpg&.sig=9ndQlKC89OQ6ut3OULMg&cid=230139023&id=tsrtpPy65xGAdEGMmAc2pA&size=c1024x1024
            // http://ak2.polyvoreimg.com/cgi/img-set/cid/39051735/id/XHw8HlYH4RGZj34mPmiMmg/size/y.jpg
            // http://ak2.polyvoreimg.com/cgi/img-set/cid/39051735/size/y.jpg
            // y, x, e, l, g, m, s, t
            var cginame = src.replace(/.*\/cgi\/([^/]*)\/.*/, "$1");
            var paramsbase = src.replace(/.*\/cgi\/[^/]*/, "");
            var params = paramsbase.replace(/\/([^/]*)\/([^/]*)/g, "$1=$2&");
            params = params
                .replace(/(.*)\.([^/.&]*)&$/, ".out=$2&$1");
            return "https://www.polyvore.com/cgi/" + cginame + "?" + params;
        }

        if (domain === "www.polyvore.com" &&
            src.indexOf("/cgi/") >= 0) {
            // https://www.polyvore.com/cgi/img-thing?.out=jpg&size=l&tid=95293327
            //   https://www.polyvore.com/cgi/img-thing?.out=jpg&size=y&tid=95293327
            // https://www.polyvore.com/cgi/img-set?.out=jpg&.sig=9ndQlKC89OQ6ut3OULMg&cid=230139023&id=tsrtpPy65xGAdEGMmAc2pA&size=c1024x1024
            //   https://www.polyvore.com/cgi/img-set?.out=jpg&.sig=9ndQlKC89OQ6ut3OULMg&cid=230139023&id=tsrtpPy65xGAdEGMmAc2pA&size=c99999x99999
            return src
                .replace(/\/img-set(.*?)&size=[^&]*/, "/img-set$1&size=c99999x99999");
                //.replace(/\/img-thing(.*?)&size=[^&]*/, "/img-thing$1&size=y"); // doesn't work well
        }

        if (domain === "aliyun-cdn.hypebeast.cn" &&
            src.indexOf("/hypebeast.com/") >= 0) {
            // https://aliyun-cdn.hypebeast.cn/hypebeast.com/wp-content/blogs.dir/4/files/2018/01/louis-vuitton-2018-fall-winter-50.jpg?q=75&w=400
            return src.replace(/.*:\/\/[^/]*\//, "http://");
        }

        if (domain_nowww === "buro247.mn") {
            // http://www.buro247.mn/thumb/1000x700/local/images/buro/galleries/2018/01/_VUI0653.jpg
            //   http://www.buro247.mn/local/images/buro/galleries/2018/01/_VUI0653.jpg
            // https://www.buro247.kz/thumb/125x185/galleries/2018/01/Vuitton%20m%20RF18%201109.jpg -- doesn't work (not .mn though)
            return src.replace(/\/thumb\/[0-9]+x[0-9]+\//, "/");
        }

        if (// https://www.hairstyleinsider.com/thumbnail.php?file=2015/Emma_Watson_Bobby_Pinned_Updo_629726963.jpg&size=article_large
            domain === "www.hairstyleinsider.com" ||
            domain === "www.elle.rs") {
            // http://www.elle.rs/files.php?file=images/2018/01/kate_i_naomi_na_reviji_1_169904615.jpg
            // http://www.elle.rs/thumbnail.php?file=images/2018/02/gucci_moschino_fall_winter_2018_abs___983890735.jpg&size=summary_large
            //   http://www.elle.rs/files.php?file=images/2018/02/gucci_moschino_fall_winter_2018_abs___983890735.jpg
            return src.replace(/\/thumbnail.php.*?file=([^&]*).*/, "/files.php?file=$1");
        }

        if (domain === "www.zkpm.net") {
            // http://www.zkpm.net/img.php?url=http://mmbiz.qpic.cn/mmbiz_jpg/Hey2N7g1r13EPyvv9cxxvy7uYsT9NZuAkbahJGeFoQGO9r0Wwicu7Oh2YiceaMgfObxznBkn4hx61JzCYnwWwMNA/0?wx_fmt=jpeg
            return src.replace(/.*\/img\.php.*?url=(.*)/, "$1");
        }

        if (domain === "img.xiaohuazu.com") {
            // http://img.xiaohuazu.com/?tag=a&url=mmbizz-zqpicz-zcn/mmbiz_jpg/bm1gUegOAnjmwzCcibTuzlH2uqYZnAgPqZHUjew7icxAIAGIkfUdxFaBMuGs5wVEiboyXw4dS94DHATt6ibPhgCK1Q/0?wx_fmt=jpeg
            //   http://mmbiz.qpic.cn/mmbiz_jpg/bm1gUegOAnjmwzCcibTuzlH2uqYZnAgPqZHUjew7icxAIAGIkfUdxFaBMuGs5wVEiboyXw4dS94DHATt6ibPhgCK1Q/0?wx_fmt=jpeg
            return src.replace(/.*?[?&]url=(.*)/, "$1").replace(/z-z/g, ".").replace(/^/, "http://");
        }

        if (domain === "www.viewsofia.com") {
            // https://www.viewsofia.com/upload/fck_editor_thumb/fck_editor/Image/LV18/_VUI0653.jpg
            //   https://www.viewsofia.com/upload/fck_editor/fck_editor/Image/LV18/_VUI0653.jpg
            return src.replace("/fck_editor_thumb/", "/fck_editor/");
        }

        if (domain.indexOf(".static.media.condenast.ru") >= 0) {
            // https://d6.static.media.condenast.ru/vogue/collection/49d7fa92bdcb9696c7ebac700ca6983e.jpg/0ce73d99/o/t214x320
            //   https://d6.static.media.condenast.ru/vogue/collection/49d7fa92bdcb9696c7ebac700ca6983e.jpg/0ce73d99/o/w99999999
            // http://static.glamour.ru/iblock/d4c/71048307.jpg
            return src.replace(/\/[a-z][0-9]*(?:x[0-9]+)?$/, "/w99999999");
        }

        if (domain === "www.vogue.co.jp") {
            // https://www.vogue.co.jp/uploads/media/2017/01/25/ALEXANDRE_VAUTHIER_2017SS_Haute_Couture_Collection_runway_gallery-26-171-256.jpg
            //   https://www.vogue.co.jp/uploads/media/2017/01/25/ALEXANDRE_VAUTHIER_2017SS_Haute_Couture_Collection_runway_gallery-26.jpg
            return src.replace(/-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.vogue.mx") {
            // http://cdn.vogue.mx/uploads/images/thumbs/mx/vog/2/c/2017/04/alexandre_vauthier_pasarela_387309230_377x566.jpg
            //   http://cdn.vogue.mx/uploads/images/thumbs/mx/vog/2/c/2017/04/alexandre_vauthier_pasarela_387309230_1200x1800.jpg
            //   http://cdn.vogue.mx/uploads/images/mx/vog/c/2017/04/alexandre_vauthier_pasarela_170811342.jpg
            // http://cdn.vogue.mx/uploads/images/thumbs/mx/vog/2/c/2017/04/alexandre_vauthier_pasarela_170811342_185x278.jpg
            //   http://cdn.vogue.mx/uploads/images/mx/vog/c/2017/04/alexandre_vauthier_pasarela_170811342.jpg
            // http://cdn.vogue.mx/uploads/images/mx/vog/s/2016/10/familia_real_britanica_780685680.jpg
            return src
                .replace(/\/thumbs\/mx\/vog\/[0-9]*\/(.*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/mx/vog/$1$2");
        }

        if (domain.match(/\.ykt[0-9]*\.ru$/)) {
            // http://cs-msk-fd-4.ykt2.ru/media/upload/photo/2015/11/16/thumb/561772143a52dw350h530cr.jpeg
            // http://www.news.ykt.ru/upload/image/2017/04/55619/thumb/58ec2ea7219bd.jpg
            return src.replace(/\/thumb\/([^/]*)$/, "/$1");
        }

        if (domain === "i.guim.co.uk") {
            // https://static.guim.co.uk/sys-images/Guardian/Pix/pictures/2014/6/2/1401727592551/Jeremy-Paxman--014.jpg
            // https://i.guim.co.uk/img/media/25e99cf42defaf460da04eb3fa08fac1f10aac55/0_138_3500_2100/master/3500.jpg?w=600&q=20&auto=format&usm=12&fit=max&dpr=2&s=5366bc1d02c96c9062f7c1c19318626f
            //   https://media.guim.co.uk/25e99cf42defaf460da04eb3fa08fac1f10aac55/0_138_3500_2100/master/3500.jpg
            // https://i.guim.co.uk/img/static/sys-images/Guardian/Pix/pictures/2015/2/18/1424261816248/34329776-7c4a-488a-a767-57ee9477cad3-2060x1236.jpeg
            //   https://static.guim.co.uk/sys-images/Guardian/Pix/pictures/2015/2/18/1424261816248/34329776-7c4a-488a-a767-57ee9477cad3-2060x1236.jpeg
            return src.replace(/:\/\/[^/]*\/img\/([^/]*)\/([^?]*).*?$/, "://$1.guim.co.uk/$2");
        }

        if (domain === "media.guim.co.uk") {
            // https://media.guim.co.uk/25e99cf42defaf460da04eb3fa08fac1f10aac55/0_138_3500_2100/master/3500.jpg
            //   https://media.guim.co.uk/25e99cf42defaf460da04eb3fa08fac1f10aac55/0_138_3500_2100/3500.jpg
            return src.replace(/\/((?:[0-9]*_){3}[0-9]*)\/[^/]*\/([0-9]*\.[^/.]*)$/, "/$1/$2");
        }

        if (domain === "www.myproana.com") {
            // http://www.myproana.com/uploads/gallery/album_28122/med_gallery_463850_28122_30414.jpg
            return src.replace(/\/med_([^/]*)$/, "/$1");
        }

        if (domain === "vogue.gjstatic.nl") {
            // https://vogue.gjstatic.nl/thumbnails/GenjArticleBundle/Article/fileUpload/medium/00/58/12/dit-heeft-gigi-hadid-te-zeggen-tegen-al-haar-body-shamers-5812.jpg
            // https://vogue.gjstatic.nl/thumbnails/GenjArticleBundle/Article/fileUpload/detail/01/06/15/glitter-sparkle-shine-alexa-chung-staat-op-de-cover-van-vogue-december-2017-10615.jpg
            // https://vogue.gjstatic.nl/uploads/media/image/dolce-gabbana-make-capri-a-paparazzi-free-zone_9.jpg
            // https://vogue.gjstatic.nl/uploads/media/image/singer-songwriter-angela-vertelt-de-californie-hea-1.jpg
            // https://vogue.gjstatic.nl/thumbnails/GenjArticleBundle/Article/teaserFileUpload/teaser/00/84/17/tommy-x-gigi-has-landed-dit-zijn-vogue-s-favorieten-uit-de-ultieme-cali-girl-collectie-8417.jpg
            //   https://vogue.gjstatic.nl/thumbnails/GenjArticleBundle/Article/fileUpload/detail/00/84/17/tommy-x-gigi-has-landed-dit-zijn-vogue-s-favorieten-uit-de-ultieme-cali-girl-collectie-8417.jpg
            // https://vogue.gjstatic.nl/thumbnails/GenjArticleBundle/Article/fileUpload/detail/00/89/30/gigi-hadid-verlengt-samenwerking-met-tommy-hilfiger-8930.jpg
            //   https://vogue.gjstatic.nl/thumbnails/GenjArticleBundle/Article/fileUpload/big/00/89/30/gigi-hadid-verlengt-samenwerking-met-tommy-hilfiger-8930.jpg
            // https://designer-vintage.gjstatic.nl/thumbnails/GenjArticleBundle/Article/fileUpload/detail/00/19/42/the-top-5-best-snow-white-winter-bags-1942.jpg
            // https://designer-vintage.gjstatic.nl/uploads/media/image/the-exclusive-designer-vintage-summer-sale.jpg
            // https://designer-vintage.gjstatic.nl/thumbnails/GenjArticleBundle/Article/fileUpload/detail/00/13/27/the-exclusive-designer-vintage-summer-sale-1327.jpg
            return src
                .replace(/\/teaserFileUpload\//, "/fileUpload/") // doesn't work on all
                .replace(/\/fileUpload\/[^/]*\//, "/fileUpload/big/");
        }

        if (domain.match(/s[0-9]*\.favim\.com/)) {
            // https://s10.favim.com/mini/171202/book-Favim.com-5265965.jpeg
            //   https://s10.favim.com/orig/171202/book-Favim.com-5265965.jpeg
            // https://s8.favim.com/mini/151114/girls-generation-icons-snsd-taeyeon-Favim.com-3566828.png
            //   https://s8.favim.com/orig/151114/girls-generation-icons-snsd-taeyeon-Favim.com-3566828.png
            return src.replace(/(:\/\/[^/]*\/)[^/]*\//, "$1orig/");
        }

        if (domain === "derpicdn.net") {
            // https://derpicdn.net/img/2018/2/24/1664344/thumb.png
            //   https://derpicdn.net/img/2018/2/24/1664344/full.png
            return src.replace(/\/thumb(\.[^/.]*)$/, "/full$1");
        }

        if (domain.indexOf(".iimg.me") >= 0) {
            // http://mnetjapan.iimg.me/interest.php?url=http%3A%2F%2Fjp.mnet.com%2Fdata%2Fwww.mnetjapan.com%2Fadmin%2F000%2F172%2F494
            //   http://jp.mnet.com/data/www.mnetjapan.com/admin/000/172/494
            // http://s.iimg.me/profile.php?url=http%3A%2F%2Fs.iimg.me%2FprofileImage%2Fg%2F9%2F98g_1423385594_profile
            newsrc = src.replace(/.*\/[a-z]*\.php.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src && newsrc.indexOf("http") === 0) {
                return decodeURIComponent(newsrc);
            }
        }

        if (domain === "pix.avaxnews.com") {
            // http://pix.avaxnews.com/avaxnews/99/e2/0002e299_medium.jpeg
            //   http://pix.avaxnews.com/avaxnews/99/e2/0002e299.jpeg
            // https://pix.avaxnews.com/avaxnews/9c/e2/0002e29c_medium.jpeg
            //   https://pix.avaxnews.com/avaxnews/9c/e2/0002e29c.jpeg
            return src.replace(/_[^/]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "i.hurimg.com") {
            // http://i.hurimg.com/i/hdn/10/100x0/5a8becad18c7731320697a39.jpg
            //   http://i.hurimg.com/i/hdn/100/0x0/5a8becad18c7731320697a39.jpg
            return src.replace(/\/i\/hdn\/[0-9]+\/[0-9]+x[0-9]+\//, "/i/hdn/100/0x0/");
        }

        if (domain === "www.kurtkomaromi.com" ||
            // http://fashionweddingdress.typepad.com/.a/6a0147e0f2fc76970b01901cf76eda970b-800wi
            // http://attheloft.typepad.com/.a/6a00e54ecca8b9883301901f038a73970b-pi
            domain_nosub === "typepad.com" ||
            domain === "www.weeklystorybook.com") {
            // http://www.kurtkomaromi.com/.a/6a00d8341c764653ef01b8d144082f970c-500wi
            //   http://www.kurtkomaromi.com/.a/6a00d8341c764653ef01b8d144082f970c
            // http://www.weeklystorybook.com/.a/6a0105369e6edf970b01b8d0ebd465970c-400wi
            //   http://www.weeklystorybook.com/.a/6a0105369e6edf970b01b8d0ebd465970c
            return src.replace(/(\/\.a\/[^-/]*)-[^/]*$/, "$1");
        }

        if (domain === "img.jakpost.net") {
            // http://img.jakpost.net/c/2017/08/11/2017_08_11_30875_1502421112._small.jpg
            return src.replace(/\.[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "r.ddmcdn.com") {
            // http://r.ddmcdn.com/w_1330/s_f/o_1/cx_0/cy_0/cw_1330/ch_1995/TLC/uploads/2016/03/SYTTD_ep1407_051.jpg
            //   http://r.ddmcdn.com/cx_0/cy_0/cw_0/ch_0/TLC/uploads/2016/03/SYTTD_ep1407_051.jpg
            //   http://static.ddmcdn.com/TLC/uploads/2016/03/SYTTD_ep1407_051.jpg
            // http://r.ddmcdn.com/s_f/o_1/APL/uploads/2015/11/pangolin-ARTICLE-PAGE.jpg
            //   http://static.ddmcdn.com/APL/uploads/2015/11/pangolin-ARTICLE-PAGE.jpg
            // http://r.ddmcdn.com/w_2574/s_f/o_1/cx_7/cy_0/cw_2574/ch_1716/DSC/uploads/2015/01/mythbusters-228-07.jpg
            //   http://static.ddmcdn.com/DSC/uploads/2015/01/mythbusters-228-07.jpg
            return src.replace(/:\/\/[^/]*\/(?:[^/_]*_[^/_]*\/)*/, "://static.ddmcdn.com/");
        }

        if (domain.match(/images[0-9]*\.newegg\.com/)) {
            // https://images10.newegg.com/ProductImageCompressAll300/A24G_131515246497615592Gsxgghs342.jpg
            //   https://images10.newegg.com/ProductImageOriginal/A24G_131515246497615592Gsxgghs342.jpg
            // https://images10.newegg.com/NeweggImage/ProductImage/11-129-212-Z01.jpg
            //   https://images10.newegg.com/NeweggImage/ProductImageCompressAll1280/11-129-212-Z01.jpg
            //   https://images10.newegg.com/ProductImageOriginal/11-129-212-Z01.jpg
            // https://images10.newegg.com/NeweggImage/productimage/11-154-087-13.jpg
            //   https://images10.newegg.com/ProductImageOriginal/11-154-087-13.jpg
            // ignore:
            // https://images10.newegg.com/BizIntell/item/11/129/11-129-209/a6_120817.jpg
            return src.replace(/(:\/\/[^/]*\/)(?:NeweggImage\/)?(?:ProductImage|productimage)[^/]*\//, "$1ProductImageOriginal/");
        }

        if (domain === "images.costco-static.com" ||
            domain.match(/images\.costcobusinesscentre\..*/)) {
            // https://images.costco-static.com/ImageDelivery/imageService?profileId=12026539&imageId=1660214-894__1&recipeName=350
            //   https://images.costco-static.com/ImageDelivery/imageService?profileId=12026539&imageId=1660214-894__1
            // https://images.costcobusinesscentre.ca/ImageDelivery/imageService?profileId=12027981&imageId=1030100__1&recipeName=350
            //   https://images.costcobusinesscentre.ca/ImageDelivery/imageService?profileId=12027981&imageId=1030100__1
            return src
                .replace(/([?&])recipeName=[^&]*/, "$1")
                .replace(/&$/, "");
        }

        if (domain === "emerge-tech.s3.amazonaws.com") {
            // https://emerge-tech.s3.amazonaws.com/content/thumb/24764608_main_thumb.jpeg
            //   https://emerge-tech.s3.amazonaws.com/content/full/24764608_main_full.jpeg
            return src.replace(/\/[a-z]*\/([0-9]*_[a-z]*_)[a-z]*(\.[^/.]*)$/, "/full/$1full$2");
        }

        if (domain.match(/img[0-9]*(?:-[^.]*)?\.wfcdn\.com/)) {
            // https://secure.img1-fg.wfcdn.com/im/46823086/resize-h800%5Ecompr-r85/1292/12924520/Water+Resistant+Combination+Security+Safe+with+Dial+/+Combination/Key/Dual-Lock.jpg
            //   https://secure.img1-fg.wfcdn.com/im/46823086/compr-r85/1292/12924520/Water+Resistant+Combination+Security+Safe+with+Dial+/+Combination/Key/Dual-Lock.jpg
            // https://secure.img1-fg.wfcdn.com/lf/maxsquare/hash/11510/9457200/1/Waverly-Imperial-Dress-Porcelain-50-Curtain-Valance.jpg
            return src.replace(/(\/im\/[0-9]+\/)[^/]*\//, "$1compr-r85/");
        }

        if (domain.indexOf(".hdnux.com") >= 0) {
            // https://s.hdnux.com/photos/71/36/40/15067141/3/1024x1024.jpg
            //   https://s.hdnux.com/photos/71/36/40/15067141/3/rawImage.jpg
            // http://ww2.hdnux.com/photos/70/63/07/14889457/3/1024x1024.jpg
            //   https://s.hdnux.com/photos/70/63/07/14889457/3/rawImage.jpg
            // https://s.hdnux.com/photos/70/63/07/14889457/3/1024x1024.jpg
            return src.replace(/\/[0-9]+x[0-9]+(\.[^/.]*)$/, "/rawImage$1");
        }

        if (domain.match(/news[0-9]*\.busan\.com/)) {
            // http://news20.busan.com/content/image/2018/02/28/20180228000313_t.jpg
            //   http://news20.busan.com/content/image/2018/02/28/20180228000313_0.jpg
            return src.replace(/_t(\.[^/.]*)$/, "_0$1");
        }

        if (domain.indexOf(".amazonaws.com") >= 0 &&
            src.indexOf("/bucket.scribblelive.com/") >= 0) {
            // http://s3.amazonaws.com/bucket.scribblelive.com/12554/2016/6/27/9509e65e-3508-415c-9517-e378eec731b9_1000.jpg
            //   http://s3.amazonaws.com/bucket.scribblelive.com/12554/2016/6/27/9509e65e-3508-415c-9517-e378eec731b9.jpg
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.images.express.co.uk" && false) {
            // wip
            // https://cdn.images.express.co.uk/img/dynamic/mps/110x120/Barry-McElduff.jpg
            // https://cdn.images.express.co.uk/img/dynamic/79/590x/secondary/Sophie-Turner-295434.jpg - 590x832
            // https://cdn.images.express.co.uk/img/dynamic/59/590x/secondary/windows-10-creators-update-security-centre-settings-884921.png - 5464x2912
            // https://cdn.images.express.co.uk/img/dynamic/galleries/x701/45523.jpg
            // https://cdn.images.express.co.uk/img/dynamic/79/590x/361211_1.jpg
            // https://cdn.images.express.co.uk/img/dynamic/139/590x/secondary/screen-660225.png -- 3190x1790
        }

        if (domain === "www.dhresource.com" ||
            domain === "image.dhgate.com") {
            // https://www.dhresource.com/webp/m/100x100/f2/albu/g5/M01/44/8F/rBVaI1mBeuGAZgrYAAERdzyHfFk078.jpg
            //   https://www.dhresource.com/0x0/f2/albu/g5/M01/44/8F/rBVaI1mBeuGAZgrYAAERdzyHfFk078.jpg
            // https://www.dhresource.com/albu_385099241_00-1.0x0/ms-lure-large-size-sexy-lingerie-lace-thong.jpg
            // http://www.dhresource.com/albu_281896403_00/1.0x0.jpg
            // https://www.dhresource.com/100x100s/f2-albu-g5-M00-DC-58-rBVaI1kBY-yAf6R4AB3gjDk3S28974.jpg/new-arrive-lady-fashion-jumpsuits-long-palazzo.jpg
            //   https://www.dhresource.com/0x0s/f2-albu-g5-M00-DC-58-rBVaI1kBY-yAf6R4AB3gjDk3S28974.jpg/new-arrive-lady-fashion-jumpsuits-long-palazzo.jpg
            // http://www.dhresource.com/albu_1061302516_00-1.600x600/wholesale-mens-travel-holster-shoulder-wallet.jpg
            //   http://www.dhresource.com/albu_1061302516_00-1.0x0/wholesale-mens-travel-holster-shoulder-wallet.jpg
            // https://image.dhgate.com/albu_381865235_00/1.0x0.jpg
            return src
                .replace(/(:\/\/[^/]*\/albu_[0-9]+_[0-9]+[-/].*?)[0-9]+x[0-9]+/, "$10x0")
                .replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+/, "$10x0")
                .replace(/(:\/\/[^/]*\/)[^/]*\/[^/]*\/[0-9]+x[0-9]+\//, "$10x0/");
        }

        if (domain === "storify.com" &&
            src.indexOf("/services/proxy/") >= 0) {
            // https://storify.com/services/proxy/2/X3vpwL2T19SKqyTM4tGayg/http/www.navy.mil/management/photodb/photos/131112-N-TG831-184.JPG
            //   http://www.navy.mil/management/photodb/photos/131112-N-TG831-184.JPG
            // https://storify.com/services/proxy/2/zCwCS2c37byorPhrTXxeJQ/https/pbs.twimg.com/media/CnHZuSZWIAAfesh.jpg:large
            return src.replace(/.*\/services\/proxy\/[0-9]+\/[^/]*\/([a-z]+)\/(.*)$/, "$1://$2");
        }

        if (domain === "www.mbcsportsplus.com") {
            // http://www.mbcsportsplus.com/images/img.php?srv=1&type=m&src=/201803/99908540_2018030209204161.jpg&gImg=1&refresh=&w=300
            //   http://www.mbcsportsplus.com/data/home/data/msplMain/201803/99908540_2018030209204161.jpg
            if (src.match(/[?&]type=m[^a-z0-9A-Z]/))
                return src.replace(/\/images\/img\.php.*?[?&]src=([^&]*).*/, "/data/home/data/msplMain");
        }

        if (domain.match(/s[0-9]*cdn\.joomag\.com/)) {
            // https://view.joomag.com/%EB%85%84-%EC%9B%94%ED%98%B8-maxim%EB%A7%A5%EC%8B%AC-%ED%91%9C%EC%A7%80%EB%AA%A8%EB%8D%B8-%EB%A0%88%EC%9D%B8%EB%B3%B4%EC%9A%B0-%EC%A7%80%EC%88%99-%EC%B5%9C%ED%98%84%EC%84%9D-new-07-2015/0970864001438089053
            // https://s2cdn.joomag.com/mobile/0/548/548615/102_1-0.PNG?.1520177124
            //   https://s2cdn.joomag.com/mobile/0/548/548615/102_0-0.PNG?.1520177124
            //   https://www.joomag.com/Frontend/WebService/getPageCopy.php?uID=0/548/548615/102_0-0.PNG
            // https://s2cdn.joomag.com/res_mag/0/305/305387/548615/thumbs/spread/102.jpg?1458945882
            //   https://s2cdn.joomag.com/res_mag/0/305/305387/548615/thumbs/spread/101.jpg?1458945882 - 101 == 102
            return src.replace(/(\/mobile\/.*\/[0-9]+_)[0-9]+(-[0-9]*\.[^/]*)$/, "$10$2");
        }

        if (domain === "i.pximg.net" && false) {
            // only works if the referrer is correct
            // https://i.pximg.net/c/600x600/img-master/img/2017/06/25/17/53/43/63558968_p0_master1200.jpg
            //   https://i.pximg.net/img-original/img/2017/06/25/17/53/43/63558968_p0.jpg
            // https://i.pximg.net/c/600x600/img-master/img/2017/06/10/23/13/15/63320604_p0_master1200.jpg
            //   https://i.pximg.net/c/600x600/img-master/img/2017/06/10/23/13/15/63320604_p0_master1200.jpg
            // https://i.pximg.net/c/600x600/img-master/img/2017/06/10/23/13/15/63320604_p0_master1200.jpg
            //   https://i.pximg.net/img-original/img/2017/06/10/23/13/15/63320604_p0.jpg
            //   https://i.pximg.net/img-original/img/2017/06/10/23/13/15/63320604_p0.jpg
            //   referer: https://www.pixiv.net/member_illust.php?mode=medium&illust_id=63320604
        }

        if (domain === "cache-graphicslib.viator.com") {
            // http://cache-graphicslib.viator.com/graphicslib/media/e0/mt-vesuvius-photo_987616-770tall.jpg
            //   http://cache-graphicslib.viator.com/graphicslib/media/e0/mt-vesuvius-photo_987616-raw.jpg
            // https://cache-graphicslib.viator.com/graphicslib/thumbs360x240/2958/SITours/naples-shore-excursion-mt-vesuvius-half-day-trip-from-naples-in-naples-45216.jpg
            //   https://cache-graphicslib.viator.com/graphicslib/thumbs674x446/2958/SITours/naples-shore-excursion-mt-vesuvius-half-day-trip-from-naples-in-naples-45216.jpg
            //   https://cache-graphicslib.viator.com/graphicslib/2958/SITours/naples-shore-excursion-mt-vesuvius-half-day-trip-from-naples-in-naples-45216.jpg -- smaller
            // https://cache-graphicslib.viator.com/graphicslib/mm/28/the-original-london-sightseeing-tour-hop-on-hop-off-156128-raw.jpg
            // https://cache-graphicslib.viator.com/graphicslib/mm/83/i-amsterdam-card-city-pass-for-amsterdam-155183-raw.jpg
            return src.replace(/([-_][0-9]+)-[^-_/.]*(\.[^/.]*)$/, "$1-raw$2");
        }

        if (domain === "igx.4sqi.net") {
            // https://igx.4sqi.net/img/general/200x200/14154508__KFDGWAVvjjTcK6pEKNuQER_10kmzcBR7eU3BWbYGG4.jpg
            //   https://igx.4sqi.net/img/general/original/14154508__KFDGWAVvjjTcK6pEKNuQER_10kmzcBR7eU3BWbYGG4.jpg
            return src.replace(/\/img\/general\/[^/]*\//, "/img/general/original/");
        }

        if (domain === "static.panoramio.com" ||
            domain === "static.panoramio.com.storage.googleapis.com" ||
            // http://commondatastorage.googleapis.com/static.panoramio.com/photos/small/43008410.jpg
            //   http://commondatastorage.googleapis.com/static.panoramio.com/photos/original/43008410.jpg
            (domain === "commondatastorage.googleapis.com" && src.match(/:\/\/[^/]*\/static\.panoramio\.com\//))) {
            // http://static.panoramio.com/photos/small/6106783.jpg
            // http://static.panoramio.com/photos/large/6106783.jpg
            // http://static.panoramio.com/photos/original/6106783.jpg
            // https://static.panoramio.com.storage.googleapis.com/photos/large/8327198.jpg
            return src.replace(/\/photos\/[^/]*\//, "/photos/original/");
        }

        if (domain.match(/.*cdn.*\.myportfolio\.com$/)) {
            // https://pro2-bar-s3-cdn-cf.myportfolio.com/4b7b32c34c99b966ad6f0ba84341a0df/8c698e4c5561ed288f2350a6_rw_3840.jpg?h=ec899b0e004e5d1cd5bcf474b259302d
            //   https://pro2-bar-s3-cdn-cf.myportfolio.com/4b7b32c34c99b966ad6f0ba84341a0df/8c698e4c5561ed288f2350a6.jpg
            //   https://pro2-bar.myportfolio.com/v1/assets/4b7b32c34c99b966ad6f0ba84341a0df/8c698e4c5561ed288f2350a6.jpg -- hash is required
            // https://pro2-bar-s3-cdn-cf2.myportfolio.com/fc87a328b5563b3948ee90b56bb47c80/df42aa71-c29a-4ccb-b40d-70e9f87872bf_car_202x158.jpg?h=8332ff2d4ba2a81d4cd8957d4a8f9d85
            //   https://pro2-bar-s3-cdn-cf2.myportfolio.com/fc87a328b5563b3948ee90b56bb47c80/df42aa71-c29a-4ccb-b40d-70e9f87872bf_car_202x158.jpg - still works
            //   https://pro2-bar.myportfolio.com/v1/assets/fc87a328b5563b3948ee90b56bb47c80/df42aa71-c29a-4ccb-b40d-70e9f87872bf_car_202x158.jpg -- hash is required
            //   https://pro2-bar-s3-cdn-cf2.myportfolio.com/fc87a328b5563b3948ee90b56bb47c80/df42aa71-c29a-4ccb-b40d-70e9f87872bf.jpg:
            //     https://pro2-bar.myportfolio.com/v1/assets/fc87a328b5563b3948ee90b56bb47c80/df42aa71-c29a-4ccb-b40d-70e9f87872bf.jpg -- hash is required
            return src.replace(/_rw_[0-9]+(\.[^/.?]*)(?:\?.*)?$/, "$1");
        }

        if (domain === "i.dell.com") {
            // http://i.dell.com/das/xa.ashx/global-site-design%20web/00000000-0000-0000-0000-000000000000/1/LargePNG?id=Dell/Product_Images/Dell_Client_Products/Desktops/Inspiron_Desktops/Inspiron_3250_SFF/global_spi/desktop-inspiron-3250-small-form-factor-black-right-hero-504x350.psd
            //   http://i.dell.com/das/xa.ashx/global-site-design%20web/00000000-0000-0000-0000-000000000000/1/originalpng?id=Dell/Product_Images/Dell_Client_Products/Desktops/Inspiron_Desktops/Inspiron_3250_SFF/global_spi/desktop-inspiron-3250-small-form-factor-black-right-hero-504x350.psd
            // http://i.dell.com/sites/imagecontent/app-merchandizing/responsive/HomePage/en/PublishingImages/22437-home-desktop-inspiron-3650-silver-3656-red-150x120.png
            // http://i.dell.com/das/dih.ashx/189w/das/xa_____/global-site-design%20web/c09863ef-2675-4682-0704-6dc976226db3/1/originalpng?id=Dell/Product_Images/Dell_Client_Products/Desktops/Inspiron_Desktops/Inspiron_3250_SFF/global_spi/desktop-inspiron-3250-small-form-factor-black-left-bestof-500-ng.psd
            // http://si.cdn.dell.com/sites/imagecontent/consumer/merchandizing/en/publishingimages/24031-desktop-inspiron-3268-169x121.png
            return src.replace(/(\/(?:[0-9a-f]+-){4}[0-9a-f]+\/[0-9]+\/)LargePNG/, "$1originalpng");
        }

        if (domain === "thumb.zumst.com") {
            // http://thumb.zumst.com/530x0/http://static.news.zumst.com/images/23/2018/03/09/73abd6e986ec4160b1e9a8459532eed2.jpg
            //   http://static.news.zumst.com/images/23/2018/03/09/73abd6e986ec4160b1e9a8459532eed2.jpg
            // http://news.zum.com/articles/5254413
            //   http://static.news.zum.com/images/18/2013/01/18/20130118_1358493810.jpg - 2132x2845
            return src.replace(/.*:\/\/[^/]*\/[0-9]+[^/]*\//, "");
        }

        if (domain === "file.mk.co.kr") {
            // http://file.mk.co.kr/meet/2018/03/image_listtop_2018_156502_1520579288.jpg.thumb
            //   http://file.mk.co.kr/meet/2018/03/image_listtop_2018_156502_1520579288.jpg - slightly larger
            //   http://file.mk.co.kr/meet/2018/03/image_readtop_2018_156502_1520578294.jpg
            return src
                .replace(/\.thumb$/, "");
        }

        if (domain === "kobis.or.kr") {
            // http://kobis.or.kr/common/mast/movie/2016/04/thumb/thn_4ddde64e76f64663998f4123ae837fcc.jpg
            //   http://kobis.or.kr/common/mast/movie/2016/04/4ddde64e76f64663998f4123ae837fcc.jpg
            return src.replace("/thumb/thn_", "/");
        }

        if (domain === "www.breaknews.com" ||
            domain === "breaknews.com") {
            // http://www.breaknews.com/data/breaknews_com/mainimages/201803/2018020713038427.jpg
            //   http://www.breaknews.com/imgdata/breaknews_com/201802/2018020713038427.jpg
            // http://www.breaknews.com/sub_read.html?uid=488764&section=sc4
            //   http://www.breaknews.com/imgdata/breaknews_com/201701/2017012752287231.jpg - 2000x3159
            // http://breaknews.com/data/breaknews_com/mainimages/201803/2018030742107604.jpg
            // doesn't always work:
            // http://breaknews.com/data/breaknews_com/mainimages/201803/2018030742107604.jpg
            //   http://www.breaknews.com/imgdata/breaknews_com/201803/2018030742107604.jpg -- doesn't work
            //   http://www.breaknews.com/imgdata/breaknews_com/201803/2018030604302058.jpg -- works
            // http://breaknews.com/data/breaknews_com/mainimages/201803/2017090815222839.jpg
            //   http://breaknews.com/imgdata/breaknews_com/201709/2017090815222839.jpg -- works (not a problem with www.)
            return src.replace(/\/data\/([^/]*)\/mainimages\/[0-9]*\/([0-9]{6})/, "/imgdata/$1/$2/$2");
        }

        if (domain === "ilyo.co.kr") {
            // http://ilyo.co.kr/contents/article/images/2015/0306/thm200_1425610033458142.jpg
            //   http://ilyo.co.kr/contents/article/images/2015/0306/1425610033458142.jpg - 1788x2698
            return src.replace(/\/thm[0-9]+_/, "/");
        }

        if (domain === "www.joseilbo.com") {
            // http://www.joseilbo.com/gisa_img_origin/15090052681509005268_yumju423_origin.jpg - 5312x2988
            // http://www.joseilbo.com/gisa_img/1518397320.thumbnail.jpg
            //   http://www.joseilbo.com/gisa_img/1518397320.jpg
            // http://www.joseilbo.com/gisa_img/15199713541519971354_kiruki54.jpg
            //   http://www.joseilbo.com/gisa_img_origin/15199713541519971354_kiruki54_origin.jpg
            // http://www.joseilbo.com/xml/racing/image/6f1f52ac11d533a84f41705a5f09411f.thumbnail.jpg
            //   http://www.joseilbo.com/xml/racing/image/6f1f52ac11d533a84f41705a5f09411f.jpg
            return src
                .replace(/\.thumbnail(\.[^/.]*)$/, "$1")
                .replace(/\/gisa_img\/([0-9]+_[^/._]+)(\.[^/.]*)$/, "/gisa_img_origin/$1_origin$2");
        }

        if (domain.indexOf(".phncdn.com") >= 0) {
            // https://ci.phncdn.com/pics/albums/000/430/541/4503569/(m=eiJ_8b)(mh=EvXtHOjNcliZ7ja0)original_4503569.jpg
            //   https://ci.phncdn.com/pics/albums/000/430/541/4503569/original_4503569.jpg
            return src.replace(/\/(?:\([a-z]+=[^/)]*\))*([^/]*)$/, "/$1");
        }

        if (domain === "img.fril.jp") {
            // https://img.fril.jp/img/102398107/s/288867076.jpg?1506827930
            // l, m, s
            return src.replace(/\/[a-z]\/([^/]*)$/, "/l/$1");
        }

        if (domain === "img.cinematoday.jp") {
            // https://img.cinematoday.jp/a/E0000548/_size_c640x/_v_1337344420/18.JPG
            //   https://img.cinematoday.jp/a/E0000548/_v_1337344420/18.JPG
            // https://img.cinematoday.jp/res/GA/2015/0725_05/v1437812942/DSC_0027-cx.JPG
            //   https://img.cinematoday.jp/res/GA/2015/0725_05/v1437812942/DSC_0027.JPG
            // http://img.cinematoday.jp/res/GA/2014/0712_02/v1405139653/IMG_2930-x.JPG
            // https://img.cinematoday.jp/a/E0010088/_size_1200x/_v_1473853900/19.jpg
            // https://img.cinematoday.jp/res/GA/2015/1028_08/v1446033979/07-0x0.JPG
            //   https://img.cinematoday.jp/res/GA/2015/1028_08/v1446033979/07.JPG
            // http://s.cinematoday.jp/res/N0/04/86/v1355451846/N0048658_l.jpg
            //   http://s.cinematoday.jp/res/N0/04/86/v1355451846/N0048658.jpg -- smaller
            //   https://img.cinematoday.jp/res/N0/04/86/v1355451846/N0048658.jpg -- same
            // https://img.cinematoday.jp/res/GA/2016/0624_01/v1466737624/IMG_1177-560x600.JPG
            // https://img.cinematoday.jp/a/A0005070/_size_/_v_1469826000/11.jpg
            // https://img.cinematoday.jp/a/E0011605/_size_c640x/_v_1499569440/02.jpg
            return src
                .replace(/-[a-z0-9]*x[a-z0-9]*(\.[^/.]*)$/, "$1")
                .replace(/\/_size_[^/]*\//, "/");
        }

        if (domain.indexOf(".seesaa.net") >= 0) {
            // http://flamant.up.seesaa.net/image/1981AAA9-2780-4445-8DF7-C72FA57A6738-thumbnail2.jpg
            //   http://flamant.up.seesaa.net/image/1981AAA9-2780-4445-8DF7-C72FA57A6738.jpg
            return src.replace(/-thumbnail[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".biglobe.ne.jp") >= 0) {
            // https://news.biglobe.ne.jp/entertainment/1227/5332001629/nrn_2016-12-27-050012_thum630.jpg
            // https://news.biglobe.ne.jp/animal/0309/8840287090/pec_301481_thum500.png
            // removing thum[0-9]* makes it smaller
        }

        if (domain.match(/media[0-9]*\.ledevoir\.com/)) {
            // http://media2.ledevoir.com/images_galerie/nwl_602637_453756/image.jpg
            //   http://media2.ledevoir.com/images_galerie/nwdp_602637_453756/image.jpg
            // http://media1.ledevoir.com/images_galerie/nwlb_602533_453783/image.jpg
            //   http://media1.ledevoir.com/images_galerie/nwdp_602533_453783/image.jpg
            // http://media2.ledevoir.com/images_galerie/1_453723/le-coup-de-crayon-du-10-mars.jpg
            //   http://media2.ledevoir.com/images_galerie/nwdp_1_453723/le-coup-de-crayon-du-10-mars.jpg
            // http://media1.ledevoir.com/images_galerie/app_1_452365/le-coup-de-crayon-du-7-mars.jpg
            //   http://media1.ledevoir.com/images_galerie/nwdp_1_452365/le-coup-de-crayon-du-7-mars.jpg
            return src.replace(/\/images_galerie\/(?:[^-/._]*_)?([0-9]+_[0-9]+)\//, "/images_galerie/nwdp_$1/");
        }

        if (domain === "infotel.ca") {
            // https://infotel.ca/news/medialibrary/image/hl-mediaitemid50826-1365.jpg
            //   https://infotel.ca/news/medialibrary/image/hd-mediaitemid50826-1365.jpg
            //   https://infotel.ca/news/medialibrary/image/orig-mediaitemid50826-1365.jpg
            return src.replace(/\/medialibrary\/image\/[^-_/.]*-/, "/medialibrary/image/orig-");
        }

        if (domain === "www.eleconomista.com.mx" && src.indexOf("/img/") >= 0) {
            // https://www.eleconomista.com.mx/__export/1518538244604/sites/eleconomista/img/2018/02/13/mario_draghi.jpg_332989735.jpg
            //   https://www.eleconomista.com.mx/__export/1518538244604/sites/eleconomista/img/2018/02/13/mario_draghi.jpg
            return src.replace(/(\/[^/.]*\.[^/._]*)_[^/.]*\.[^/.]*$/, "$1");
        }

        if (domain === "gcm-v2.omerlocdn.com") {
            // https://gcm-v2.omerlocdn.com/production/global/files/image/16c89c8b-58a1-490f-b9a6-323adb16ca75_1024.jpg
            //   https://gcm-v2.omerlocdn.com/production/global/files/image/16c89c8b-58a1-490f-b9a6-323adb16ca75.jpg
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.dailystar.com.lb" ||
            domain === "dailystar.com.lb") {
            // https://www.dailystar.com.lb/dailystar/Comics/23-02-2018/7cartoon%20New%20maths%20teacher_636549414776995725_main.jpg
            //   https://www.dailystar.com.lb/dailystar/Comics/23-02-2018/7cartoon%20New%20maths%20teacher_636549414776995725.jpg
            // http://www.dailystar.com.lb/dailystar/Pictures/2011/06/27/SaudiSpecialForces03_634448139672228001_img900x550_img900x550_crop.jpg
            //   http://www.dailystar.com.lb/dailystar/Pictures/2011/06/27/SaudiSpecialForces03_634448139672228001.jpg
            // http://www.dailystar.com.lb/dailystar/Pictures/2011/05/06/Mirna-Chaker-Jeita-Grotto-4_634403009433363875_img900x550_img900x550_crop.jpg
            // http://www.dailystar.com.lb/dailystar/Pictures/2011/07/04/13_634453800140116703_img900x550_img900x550_crop.jpg
            // http://www.dailystar.com.lb/dailystar/Pictures/2018/01/11/669500_img900x550_img900x550_crop.jpg
            //   http://www.dailystar.com.lb/dailystar/Pictures/2018/01/11/669500.jpg
            // http://www.dailystar.com.lb/dailystar/Pictures/2015/04/27/411756_img900x550_img900x550_crop.jpg
            //   http://www.dailystar.com.lb/dailystar/Pictures/2015/04/27/411756.jpg
            // http://www.dailystar.com.lb/dailystar/Pictures/2014/02/26/253362_img900x550_img900x550_crop.jpg
            //   http://www.dailystar.com.lb/dailystar/Pictures/2014/02/26/253362.jpg
            // http://www.dailystar.com.lb/dailystar/Pictures/2011/07/12/IMG_0080_634461096008782915_img900x550_img900x550_crop.JPG
            //   http://www.dailystar.com.lb/dailystar/Pictures/2011/07/12/IMG_0080_634461096008782915.JPG
            // https://dailystar.com.lb/dailystar/Pictures/2018/02/18/679287_img650x420_img650x420_crop.jpg
            //   https://dailystar.com.lb/dailystar/Pictures/2018/02/18/679287.jpg
            return src.replace(/([0-9]+)(?:_[^0-9][^/.]*)*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "images.dailykos.com") {
            // https://images.dailykos.com/images/359004/story_image/2016_Comparison_of_Presidential_and_House_Election_Margins_-_Republican_Incumbents.png?1485791213
            //   https://images.dailykos.com/images/359004/original/2016_Comparison_of_Presidential_and_House_Election_Margins_-_Republican_Incumbents.png?1485791213
            // https://images.dailykos.com/images/402092/small/GettyImages-135785191.jpg?1495062293
            //   https://images.dailykos.com/images/402092/original/GettyImages-135785191.jpg?1495062293
            // https://images.dailykos.com/images/489359/small/GpfQTnJ_1_.gif?1514432636
            //   https://images.dailykos.com/images/489359/original/GpfQTnJ_1_.gif?1514432636
            // https://images.dailykos.com/avatars/363/small/image.jpg?1454078865
            //   https://images.dailykos.com/avatars/363/original/image.jpg?1454078865
            return src.replace(/(\/(?:images|avatars)\/[0-9]+\/)[^/]*\/([^/]*)$/, "$1original/$2");
        }

        // chevereto
        if (domain === "imgmax.com" ||
            domain === "404store.com") {
            // http://imgmax.com/images/2017/03/20/0OQhE.th.jpg
            //   http://imgmax.com/images/2017/03/20/0OQhE.jpg
            // https://404store.com/2017/11/12/b1Ik9Cj-emma-watson-wallpapers.th.jpg
            // https://404store.com/2017/05/18/wc1715233.md.jpg
            return src.replace(/\.(?:th|md)(\.[^/.]*)$/, "$1");
        }

        if (domain === "static.maxmodels.pl") {
            // https://static.maxmodels.pl/photos/1/c/b8/1cb801e95b178afa97bd106362bdec15_320123_thumb.jpg
            //   https://static.maxmodels.pl/photos/1/c/b8/1cb801e95b178afa97bd106362bdec15_320123.jpg
            // https://static.maxmodels.pl/article/e/f/e/efe5e8884994e41861fa95c6b48f4723_thumb.jpg
            //   https://static.maxmodels.pl/article/e/f/e/efe5e8884994e41861fa95c6b48f4723.jpg
            if (src.indexOf("/photos/") >= 0 || src.indexOf("/article/") >= 0) {
                return src.replace(/_thumb(\.[^/.]*)$/, "$1");
            }

            if (src.indexOf("/profile/") >= 0) {
                // https://static.maxmodels.pl/profile/6/c/9/6c9fd60f434f2a06212844dc6c073bf0_428915_428915_tinythumb.jpg
                //   https://static.maxmodels.pl/profile/6/c/9/6c9fd60f434f2a06212844dc6c073bf0_428915_428915_profile.jpg
                return src.replace(/_[a-z]+(\.[^/.]*)$/, "_profile$1");
            }
        }

        if (domain.indexOf(".img.yt") >= 0) {
            // https://x001.img.yt/small/2015/04/19/5532fb62ba401.jpg
            //   https://x001.img.yt/big/2015/04/19/5532fb62ba401.jpg
            return src.replace("/small/", "/big/");
        }

        if (domain === "cdn.wallpaperjam.com") {
            // http://cdn.wallpaperjam.com/static/images/m/2b/35/2b359c913f740935e350c0b42c8c5b9da9804763.jpg
            //   https://cdn.wallpaperjam.com/2b359c913f740935e350c0b42c8c5b9da9804763/image.jpg
            return src.replace(/\/static\/images\/.*?\/([a-f0-9]+)(\.[^/.]*)$/, "/$1/image$2");
        }

        if (domain === "media.tabloidbintang.com") {
            // https://media.tabloidbintang.com/files/thumb/yoona-snsd_dira_2.jpg/1500
            //   https://media.tabloidbintang.com/files/yoona-snsd_dira_2.jpg
            // https://media.tabloidbintang.com/files/thumb/8bb22765c251c7b2741c1f69d06f2f93.jpg/222/140/fit
            return src.replace(/\/thumb\/([^/]*\.[^/.]*)(?:\/.*)/, "/$1");
        }

        if (domain === "media.teen.co.id") {
            // https://media.teen.co.id/files/thumb/tay6.jpg?p=trias93/&w=300&h=220&m=fit
            // https://media.teen.co.id/files/thumb/bianca_hello_4.jpg?p=trias93/&w=1024&m=fit
            //   https://media.teen.co.id/files/view/bianca_hello_4.jpg?p=trias93/
            return src.replace(/\/thumb\/([^/?]*\.[^/.?]*).*?[?&](p=[^&]*).*/, "/view/$1?$2");
        }

        if (domain.indexOf(".att.hudong.com") >= 0) {
            // http://a0.att.hudong.com/62/10/20200000013920144739106585140_s.jpg
            //   http://a0.att.hudong.com/62/10/20200000013920144739106585140.jpg
            // http://a4.att.hudong.com/41/08/300022729906133502080921900_s.jpg
            //   http://a4.att.hudong.com/41/08/300022729906133502080921900.jpg
            return src.replace(/_s(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "ihanyu.com") {
            // http://www.ihanyu.com/cache/yiren/photo/0/2/130/2871.jpg
            //   http://www.ihanyu.com/uploadfile/yiren/photo/0/2/2871.jpg
            return src.replace(/\/cache\/([^/]*)\/([^/]*\/[0-9]+\/[0-9]+\/)[0-9]+\/([0-9]+\.[^/.]*)$/, "/uploadfile/$1/$2$3");
        }

        if (domain === "imgsh.jpnxcn.com" ||
            // http://gongl8.com/uploadfile/2018/0228/thumb_0_300_20180228054831686.jpg
            //   http://gongl8.com/uploadfile/2018/0228/20180228054831686.jpg
            domain_nowww === "gongl8.com" ||
            domain.match(/m[0-9]*\.ablwang\.com/)) {
            // http://imgsh.jpnxcn.com/pics/star/pic/thumb_180_0_5de4fc683a33a8e1731ecc044918e3b3.jpg
            //   http://imgsh.jpnxcn.com/pics/star/pic/5de4fc683a33a8e1731ecc044918e3b3.jpg
            // http://m1.ablwang.com/uploadfile/2018/0430/thumb_110_69_20180430070256125.jpg
            //   http://m1.ablwang.com/uploadfile/2018/0430/20180430070256125.jpg
            return src.replace(/\/thumb_[0-9]+_[0-9]+_/, "/");
        }

        if (domain_nowww === "gaobei.com" &&
            src.indexOf("/upload/") >= 0) {
            // s resizes up, b seems to be original
            // http://www.gaobei.com/upload/10001/article/2018_03/12175401_ace4sg_s.jpg
            //   http://www.gaobei.com/upload/10001/article/2018_03/12175401_ace4sg_b.jpg
            // http://www.gaobei.com/upload/10001/article/2015_12/28013712_kmxwsc_b.jpg - 2000x3000
            // http://www.gaobei.com/upload/10001/article/2016_05/10175130_1f7z15_b.jpg
            //   http://www.gaobei.com/upload/10001/article/2016_05/10175130_1f7z15.jpg -- doesn't work
            // http://www.gaobei.com/upload/10001/article/2017_10/20220510_cesgua.jpg
            //   http://www.gaobei.com/upload/10001/article/2017_10/20220510_cesgua_b.jpg -- doesn't work
            return src.replace(/_[a-z](\.[^/.]*)$/, "_b$1");
        }

        if (domain.match(/p[0-9]*\.pstatp\.com/)) {
            // http://p3.pstatp.com/medium/30f1001008f9067618b8
            //   http://p3.pstatp.com/large/30f1001008f9067618b8
            //   http://p3.pstatp.com/origin/30f1001008f9067618b8
            // https://p3.pstatp.com/list/190x124/12340017b4ef97c42e83
            //   https://p3.pstatp.com/origin/12340017b4ef97c42e83
            // http://p9.pstatp.com/large/1234001893bf059b82cf -- desaturated slightly
            //   http://p9.pstatp.com/origin/1234001893bf059b82cf
            return src.replace(/(:\/\/[^/]*\/)[a-z]*\/(?:[0-9]+x[0-9]+\/)?/, "$1origin/");
        }

        if (domain === "img.jizy.cn") {
            // l, m, s
            // https://img.jizy.cn/img/m/276318
            //   https://img.jizy.cn/img/l/276318
            return src.replace(/\/img\/[a-z]\//, "/img/l/");
        }

        if (domain === "v.img.pplive.cn") {
            // http://v.img.pplive.cn/sp240/ac/70/ac70a84165ea6782446f267948a0cd4e/3.jpg.webp
            //   http://v.img.pplive.cn/ac/70/ac70a84165ea6782446f267948a0cd4e/3.jpg.webp
            return src.replace(/(:\/\/[^/]*\/)sp[0-9]+\//, "$1");
        }

        if (domain === "uploadfile.bizhizu.cn") {
            // http://uploadfile.bizhizu.cn/2015/0821/20150821111539262.jpg
            //   http://uploadfile.bizhizu.cn/2015/0821/20150821111539262.jpg.source.jpg
            // http://uploadfile.bizhizu.cn/2017/1014/f9ddc2a68f0f516dcdbdbc0a32a7d187.jpg
            //   https://uploadfile.bizhizu.cn/2017/1014/f9ddc2a68f0f516dcdbdbc0a32a7d187.jpg.source.jpg
            return src.replace(/(\/[0-9a-f]*\.)([^/.]*)$/, "$1$2.source.$2");
        }

        if (domain.match(/\.tgbusdata\.cn$/) ||
            domain.match(/\.tuwandata\.com$/)) {
            // http://tv05.tgbusdata.cn/v3/thumb/jpg/YzhlMyw2MDAsNjAwLDQsMywxLC0xLDE=/u/shouji.tgbus.com/uploads/allimg/1508/17/3200-150QG32232.jpg
            //   http://shouji.tgbus.com/uploads/allimg/1508/17/3200-150QG32232.jpg
            // http://img2.tgbusdata.cn/v2/thumb/jpg/YzQ0NSw4MzAsNjQwLDQsMywxLC0xLDAscms1MA==/u/olpic.tgbusdata.cn/uploads/allimg/160324/238-160324160031.jpg
            //   http://olpic.tgbusdata.cn/uploads/allimg/160324/238-160324160031.jpg
            // http://img2.tgbusdata.cn/v2/thumb/jpg/MmIwZCw3MzAsNzMwLDQsMSwxLC0xLDAscms1MA==/u/olpic.tgbusdata.cn/uploads/allimg/121107/62-12110G34539.jpg
            //   http://olpic.tgbusdata.cn/uploads/allimg/121107/62-12110G34539.jpg
            // http://olpic.tgbusdata.cn/uploads/allimg/130415/62-1304151Q4110-L.jpg
            // http://ol04.tgbusdata.cn/v2/thumb/jpg/NmIxMSwwLDAsNCwzLDEsLTEsMCxyazUw/u/olpic.tgbusdata.cn/uploads/allimg/150408/144-15040QI505.jpg
            //   http://olpic.tgbusdata.cn/uploads/allimg/150408/144-15040QI505.jpg
            // http://img2.tgbusdata.cn/v2/thumb/jpg/NWM0NywwLDAsNCwzLDEsLTEsMCxyazUw/u/olpic.tgbusdata.cn/uploads/allimg/160321/274-160321115611.jpg
            //   http://olpic.tgbusdata.cn/uploads/allimg/160321/274-160321115611.jpg
            // http://img1.tuwandata.com/v2/thumb/all/NWI3OSw4MDEsMjAwLDQsMywxLC0xLDAsLCw5MA==/u/www.tuwan.com/uploads/allimg/1712/20/793-1G220135S0.jpg
            //   http://www.tuwan.com/uploads/allimg/1712/20/793-1G220135S0.jpg
            return src.replace(/.*\/thumb\/[^/]*\/[^/]*\/u\//, "http://");
        }

        if (domain === "img-toutiao.mia.com") {
            // https://img-toutiao.mia.com/d78e5392e7c518f7870c4ef9941b9809_img@base@tag=imgScale&q=60
            return src.replace(/\&.*/, ""); // removing @ works, but forces download, and very big images have imgScale so it's probably fine
        }

        if (domain.indexOf("pic.xeeok.com") >= 0) {
            // http://spic.xeeok.com/uploads/20171228/201712281413013469/297453_001_s.jpg
            //   http://spic.xeeok.com/uploads/20171228/201712281413013469/297453_001.jpg
            // http://pic.xeeok.com/uploads/20170406/201704060839007259/257437_001.jpg
            // http://pic.xeeok.com/uploads/20171208/201712080649411660/11988_007_s1024.jpg
            //   http://pic.xeeok.com/uploads/20171208/201712080649411660/11988_007.jpg
            //
            // http://pic.xeeok.com/uploads/20170902/201709021724546130/9683_010.jpg -- 001 = first image in album, not size
            return src.replace(/_s[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.laonanren.com") {
            // https://img.laonanren.com/upload2/2015-02/15020914251864t.jpg
            //   https://img.laonanren.com/upload2/2015-02/15020914251864.jpg
            return src.replace(/t(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".share.photo.xuite.net") >= 0) {
            // https://4.share.photo.xuite.net/sm06059201/1469f4f/2721202/257867165_c.jpg
            // https://e.share.photo.xuite.net/esther1793/1e6a1d9/19835410/1124368327_x.jpg
            // https://7.share.photo.xuite.net/anber314/17e2d43/16287589/875503326_z.jpg (z > y, but y = 1.9mb, z = 900kb. larger, but a bit of quality is lost)
            // x and X are the same etc., o doesn't work
            // z, y, x, l, m, s, c, q, t (c is larger than x for gifs)
            return src.replace(/_[a-zA-Z](\.[^/.]*)$/, "_y$1");
        }

        if (domain === "img.sportsv.net") {
            // https://img.sportsv.net/img/ablheadline/cover/6/56/fit-fcc38HPLxU-1045x340.jpg
            //   https://img.sportsv.net/img/ablheadline/cover/6/56/fcc38HPLxU.jpg
            // https://img.sportsv.net/img/photo/image/5/78295/aspect-f3qjUcGTB2-1000xauto.jpg
            //   https://img.sportsv.net/img/photo/image/5/78295/f3qjUcGTB2.jpg
            // https://img.sportsv.net/img/photo/image/1/161211/tPkQGdrO3s.jpg
            return src.replace(/\/[a-z]+-([^-/]*)-[0-9a-z]*x[0-9a-z]*(\.[^/.]*)$/, "/$1$2");
        }

        if (domain.indexOf(".espncdn.com") >= 0) {
            // http://a3.espncdn.com/combiner/i?img=%2Fphoto%2F2017%2F0115%2Fr171425.jpg
            //   http://a3.espncdn.com/photo/2017/0115/r171425.jpg
            // http://a.espncdn.com/photo/2014/0615/nba_a_gindunc_288x162.jpg
            // http://a3.espncdn.com/photo/2016/0114/r44141_1296x729_16-9.jpg
            //   http://a3.espncdn.com/photo/2016/0114/r44141.jpg
            // http://a3.espncdn.com/combiner/i?img=%2Fphoto%2F2015%2F0429%2Fnba_g_crittenton1x_1296x729.jpg
            //   http://a3.espncdn.com/photo/2015/0429/nba_g_crittenton1x_1296x729.jpg
            // http://a3.espncdn.com/photo/2013/0209/nba_jordan_36.jpg
            // http://a.espncdn.com/photo/2012/0930/rn_georgiatennessee_ms_21.jpg
            // http://a.espncdn.com/photo/2013/0922/nfl_u_darnelldockett_cmg_600.jpg
            // http://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/2968436.png&w=350&h=254
            //   http://a.espncdn.com/i/headshots/nba/players/full/2968436.png
            newsrc = decodeURIComponent(src.replace(/\/combiner\/i\?img=([^&]*).*/, "$1"));
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/(\/r[0-9]+)(?:_[^/.]*)(\.[^/.]*)$/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain.match(/blog-imgs-[0-9]*(?:-[^.]*)?.*\.fc2\.com/)) {
            // https://blog-imgs-118.fc2.com/s/h/i/shiomusubinokasu/20171212120106s.jpg
            //   https://blog-imgs-118-origin.fc2.com/s/h/i/shiomusubinokasu/20171212120106.jpg
            // https://blog-imgs-77-origin.fc2.com/t/r/e/trendbooks/IMG_0012_201804162120240e6s.jpg
            return src
                .replace(/:\/\/(blog-imgs-[0-9]*)\./, "://$1-origin.")
                .replace(/([/_][0-9]{8,}[^-/._]+)s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "photos.hancinema.net" ||
            domain === "www.hancinema.net") {
            // https://photos.hancinema.net/photos/posterphoto679289.jpg
            //   https://photos.hancinema.net/photos/fullsizephoto679289.jpg
            // https://www.hancinema.net/photos/photo954334.jpg
            //   https://www.hancinema.net/photos/fullsizephoto954334.jpg
            return src.replace(/\/photos\/[a-z]*(photo[0-9]*\.[^/.]*)$/, "/photos/fullsize$1");
        }

        if (domain === "inimura.com" ||
            // https://www.celebritydresses.shop/image/cache/data/category_59/1133Lisa%20Rinna%20Red%20Sexy%20Prom%20Dress%20For%20Women%202009%20SAG%20Awards%20Red%20Carpet-800x800.jpg
            domain_nowww === "celebritydresses.shop" ||
            // http://www.customcelebritydresses.com/image/cache/data/02014-08-20/Rita-Ora-Red-Sexy-High-Slit-Backless-V-neck-Prom-Dress-MTV-VMAs-2014-Red-Carpet-600x600.jpg
            domain_nowww === "customcelebritydresses.com" ||
            domain_nowww === "honeydear.my") {
            // https://inimura.com/image/cache/catalog/product/lingerie/0068-01-270x360.jpg
            //   https://inimura.com/image/catalog/product/lingerie/0068-01.jpg
            // http://www.honeydear.my/image/cache/data/YW1031WH/213%20(4)-850x1300.jpg
            //   http://www.honeydear.my/image/data/YW1031WH/213%20(4).jpg
            return src.replace(/\/cache\/(.*)-[0-9]+x[0-9]*(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "www.outlookweekly.net" &&
            src.indexOf("/images/") >= 0) {
            // http://www.outlookweekly.net/images/cfile5.uf.tistory.com/image/2338CD4D5312E8CF036158
            //   http://cfile5.uf.tistory.com/image/2338CD4D5312E8CF036158
            return src.replace(/.*:\/\/[^/]*\/images\//, "http://");
        }

        if (domain === "www.cdn.tv2.no") {
            // http://www.cdn.tv2.no/images?imageId=8999096&width=3000
            return src.replace(/\/images.*?[?&]imageId=([0-9]+).*/, "/images?imageId=$1&height=-1");
        }

        if (domain === "media-spiceee.net") {
            // https://media-spiceee.net/uploads/content/image/828907/small_zzzzzzzzzzzzzzzzzzzzzzzz156.jpg
            //   https://media-spiceee.net/uploads/content/image/828907/large_zzzzzzzzzzzzzzzzzzzzzzzz156.jpg
            //   https://media-spiceee.net/uploads/content/image/828907/zzzzzzzzzzzzzzzzzzzzzzzz156.jpg
            // https://media-spiceee.net/uploads/article/image/36221/thumb_lg_ee41b4b3-5fc8-453d-b160-2fa8c3f2ee07.png
            //   https://media-spiceee.net/uploads/article/image/36221/ee41b4b3-5fc8-453d-b160-2fa8c3f2ee07.png
            // https://media-spiceee.net/uploads/shopper/product_image/extra_image/2086/thumb_a8.jpg
            //   https://media-spiceee.net/uploads/shopper/product_image/extra_image/2086/a8.jpg
            return src.replace(/\/(?:large|small|thumb_lg|thumb)_([^/]*)$/, "/$1");
        }

        if (domain_nowww === "vettri.net") {
            // http://www.vettri.net/gallery/celeb/emma_watson/2015-Time-100-Gala/thumb/Emma_Watson_2015Time100Gala_Vettri.Net-03_resize.jpg
            //   http://www.vettri.net/gallery/celeb/emma_watson/2015-Time-100-Gala/Emma_Watson_2015Time100Gala_Vettri.Net-03.jpg
            return src.replace(/\/thumb\/([^/]*)_resize(\.[^/.]*)$/, "/$1$2");
        }

        // PrestaShop
        if (domain === "www.tiarashop.eu" ||
            // http://streetstylestore.com/img/p/7/4/7/7/3/74773-home_default.jpg
            //   http://streetstylestore.com/img/p/7/4/7/7/3/74773.jpg
            domain === "streetstylestore.com" ||
            // https://cdn.poplook.com/15360-92883-large_default/lane-bubble-sleeve-blouse-dusty-teal.jpg
            domain === "cdn.poplook.com" ||
            // https://www.directgardening.com/878-large_default/forsythia.jpg
            domain === "www.directgardening.com" ||
            // https://kanedashop.com/6388-large_default/outlet-taito-anohana-naruko-anjou-anaru-figure-ano-hi-mita-hana-no-namae.jpg
            //   https://kanedashop.com/6388/outlet-taito-anohana-naruko-anjou-anaru-figure-ano-hi-mita-hana-no-namae.jpg
            domain_nowww === "kanedashop.com" ||
            // http://flyhighstore.pl/2210-home_default/fh-cool-red-winter-jacket.jpg
            //   http://flyhighstore.pl/2210/fh-cool-red-winter-jacket.jpg
            domain === "flyhighstore.pl") {
            // https://www.tiarashop.eu/3412-home_default/o.jpg
            //   https://www.tiarashop.eu/3412/o.jpg
            return src
                .replace(/(:\/\/[^/]*\/img\/.*\/[0-9]*)[-_][^/.]*(\.[^/.]*)$/, "$1$2")
                .replace(/(:\/\/[^/]*\/[0-9]+(?:-[0-9]+)?)(?:[-_][^/]*?)?(\/[^/]*)$/, "$1$2");
        }

        if (domain === "skinzwearphotography.com") {
            // https://skinzwearphotography.com/prodMids/sexy-animal-print-boy-shorts-B78L-6517-F.jpg
            //   https://skinzwearphotography.com/prodImages/sexy-animal-print-boy-shorts-B78L-6517-F.jpg
            return src.replace(/\/prod[A-Z][a-z]*\//, "/prodImages/");
        }

        if (domain_nowww === "shelot.com") {
            // https://www.shelot.com/images/com_hikashop/upload/thumbnails/500x500f/0479_1199671901.jpg
            //   https://www.shelot.com/images/com_hikashop/upload/0479_1199671901.jpg
            //   https://www.shelot.com/images/BIKINI0400-0500/0479.jpg
            // https://www.shelot.com/images/com_hikashop/upload/thumbnails/500x500f/0480-5.jpg
            //   https://www.shelot.com/images/com_hikashop/upload/0480-5.jpg
            return src.replace(/\/upload\/thumbnails\/[0-9]+x[0-9]+[^/]*\//, "/upload/");
        }

        if (domain === "xo.lulus.com") {
            // https://xo.lulus.com/images/product/small-medium/2192052_408952.jpg
            //   https://xo.lulus.com/images/product/xlarge/2192052_408952.jpg
            //   https://xo.lulus.com/images/product/w_1.0/2192052_408952.jpg
            // https://xo.lulus.com/images/content/w_1.0/content_298_15400_holidaylanding02.jpg
            return src.replace(/(\/images\/[^/]*\/)[^/]*\/([^/]*)$/, "$1w_1.0/$2");
        }

        if (domain === "in-tense.se") {
            // http://in-tense.se/shop/thumbnails/shop/32353/art53/h1698/115801698-origpic-011d3c.jpg_0_0_100_100_405_654_85.jpg
            //   http://in-tense.se/shop/32353/art53/h1698/115801698-origpic-011d3c.jpg
            return src
                .replace(/\/thumbnails\/[^/]*\//, "/")
                .replace(/(\.[^/._])*_[^/]*$/, "$1");
        }

        if (domain === "image.brazilianbikinishop.com") {
            // https://image.brazilianbikinishop.com/images/products/cache_images/set-laplaya-aguas-do-mar-0_80_80_defined.jpg
            //   https://image.brazilianbikinishop.com/images/products/set-laplaya-aguas-do-mar-0.jpg
            return src.replace(/\/cache_images\/([^/_]*)_[^/.]*(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "greasyfork.org" &&
            src.search(/\/system\/screenshots\//) >= 0) {
            // https://greasyfork.org/system/screenshots/screenshots/000/010/208/thumb/Snipaste_2018-03-05_12-28-39.png?1520224343
            //   https://greasyfork.org/system/screenshots/screenshots/000/010/208/original/Snipaste_2018-03-05_12-28-39.png?1520224343
            return src.replace("/thumb/", "/original/");
        }

        if (domain === "i.embed.ly") {
            // https://i.embed.ly/1/display?key=fc778e44915911e088ae4040f9f86dcd&url=http://www.mixtapesaga.com/tapes/mixtape-covers/431.jpg
            //   http://www.mixtapesaga.com/tapes/mixtape-covers/431.jpg
            // https://i.embed.ly/1/display?key=fc778e44915911e088ae4040f9f86dcd&url=http%3A%2F%2Fis5.mzstatic.com%2Fimage%2Fthumb%2FMusic6%2Fv4%2F05%2Fd2%2Fdb%2F05d2db2b-a4a9-b1a4-53ef-36e192631a18%2Fsource%2F2400x2400bb.jpg
            // https://i.embed.ly/1/image?url=https%3A%2F%2Fscontent-iad3-1.cdninstagram.com%2Fvp%2Fbd3ac9237f46bffab2d0265b5e6c0cd7%2F5B335D8F%2Ft51.2885-15%2Fe35%2F25013144_505639503145174_6650174657859158016_n.jpg&key=fc778e44915911e088ae4040f9f86dcd
            return decodeURIComponent(src.replace(/.*\/(?:display|image).*?[?&]url=([^&]*).*/, "$1"));
        }

        if (domain === "i.genius.com") {
            // https://i.genius.com/1d14e3ce755b87a963559b9e1f888e097d194c9e?url=http%3A%2F%2Fis5.mzstatic.com%2Fimage%2Fthumb%2FMusic6%2Fv4%2F05%2Fd2%2Fdb%2F05d2db2b-a4a9-b1a4-53ef-36e192631a18%2Fsource%2F2400x2400bb.jpg
            return decodeURIComponent(src.replace(/.*\/[0-9a-f]+.*?[?&]url=([^&]*).*/, "$1"));
        }

        /*if (domain === "hdqwalls.com") {
            // http://hdqwalls.com/wallpapers/thumb/emma-watson-16-pic.jpg
            //   http://hdqwalls.com/wallpapers/emma-watson-16-pic.jpg
            return src.replace(/\/wallpapers\/thumb\//, "/wallpapers/");
        }*/

        if (domain_nowww === "hdqwalls.com") {
            // http://www.hdqwalls.com/wallpapers/bthumb/victoria-justice-4-do.jpg
            //   http://www.hdqwalls.com/wallpapers/victoria-justice-4-do.jpg
            // http://hdqwalls.com/wallpapers/thumb/victoria-justice.jpg
            //   http://hdqwalls.com/wallpapers/victoria-justice.jpg
            return src.replace(/\/wallpapers\/[a-z]?thumb\//, "/wallpapers/");
        }

        if (domain === "wallpaperclicker.com") {
            // http://wallpaperclicker.com/storage/Thumb/Emma-Watson-Hot-Photos-65420656.jpg
            //   https://wallpaperclicker.com/storage/wallpaper/Emma-Watson-Hot-Photos-65420656.jpg
            return src.replace(/\/storage\/Thumb\//, "/storage/wallpaper/");
        }

        if (domain.indexOf(".prothomalo.com") >= 0) {
            // http://en.prothomalo.com/contents/cache/images/300x0x1/uploads/media/2016/07/24/b2e9a47e2b605b04351f740d816b6bdc-Emmavv.jpg
            //   http://en.prothomalo.com/contents/uploads/media/2016/07/24/b2e9a47e2b605b04351f740d816b6bdc-Emmavv.jpg
            return src.replace(/\/cache\/images\/[0-9]+x[0-9]+(?:x[0-9]+)\//, "/");
        }

        if (domain === "c.tribune.com.pk") {
            // https://c.tribune.com.pk/2016/05/1101624-image-1462981240-590-640x480.JPG
            //   https://c.tribune.com.pk/2016/05/1101624-image-1462981240.JPG
            return src.replace(/-[0-9]+-[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".reutersmedia.net") >= 0) {
            // https://s1.reutersmedia.net/resources/r/?m=02&d=20140708&t=2&i=924720732&r=LYNXMPEA670U0&w=900
            //   https://s1.reutersmedia.net/resources/r/?d=20140708&t=2&i=924720732
            // https://pictures.reuters.com/Doc/RTR/Media/TR3_UNWATERMARKED/d/5/8/2/RTS1NLQY.jpg
            // https://s3.reutersmedia.net/resources/r/?d=20180418&t=2&i=1252629147
            var querystr = src.replace(/.*\/r\/\?/, "&");
            var d = querystr.replace(/.*&d=([^&]*).*/, "$1");
            var t = "2";//querystr.replace(/.*&t=([^&]*).*/, "$1");
            i = querystr.replace(/.*&i=([^&]*).*/, "$1");
            return src.replace(/\/r\/\?.*/, "/r/?d=" + d + "&t=" + t + "&i=" + i);
        }

        if (domain === "r.fod4.com") {
            // https://r.fod4.com/c=ar16x9/s=w400,pd1/o=80/http://t.fod4.com/t/1a93d97833/c1920x1080_1.jpg
            //   http://t.fod4.com/t/1a93d97833/c1920x1080_1.jpg
            return src.replace(/^[a-z]*:\/\/[^/]*\/.*\/([a-z]*:\/\/)/, "$1");
        }

        if (domain_nowww === "xdressy.com" ||
            // https://starcelebritydresses.com/uploads/product/1/R/1R284/dove-cameron-blush-lace-and-chiffon-short-sweet-16-dress-ted-baker-ss-2016-1-thumb.jpg
            domain_nowww === "starcelebritydresses.com") {
            // https://www.xdressy.com/uploads/product/1/R/1R550/emma-watson-vintage-queen-anne-neck-short-navy-cocktail-dress-lancome-dinner-1-thumb.jpg
            //   https://www.xdressy.com/uploads/product/1/R/1R550/emma-watson-vintage-queen-anne-neck-short-navy-cocktail-dress-lancome-dinner-1.jpg
            return src.replace(/-thumb(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.store-assets.com") {
            // https://cdn.store-assets.com/s/5319/i/1058445_480x.jpeg
            //   https://cdn.store-assets.com/s/5319/i/1058445.jpeg
            return src.replace(/_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.shopperboard.com") {
            // https://img.shopperboard.com/1184938/5a20a29ecfdea-small.jpg
            //   https://img.shopperboard.com/1184938/5a20a29ecfdea.jpg
            return src.replace(/-[a-z]+(\.[^/.]*)$/, "$1");
        }

        // OpenCart
        if (domain_nowww === "i-aurai.com" ||
            // http://www.onesieponatime.com/image/cache/data/NHL%20Edmongton%20Oilers%20Onesie-500x500.jpg
            //   http://www.onesieponatime.com/image/data/NHL%20Edmongton%20Oilers%20Onesie.jpg
            domain_nowww === "onesieponatime.com" ||
            // http://ucanstarjob.com/image/cache/catalog/651525photo_1478496700262_m-600x600.product_main.jpg
            //   http://ucanstarjob.com/image/catalog/651525photo_1478496700262_m.jpg
            domain_nowww === "ucanstarjob.com" ||
            // https://www.malaysiadropship.com/image/creativeffects/image/cache/data/all_product_images/product-1707/1sexy-bikini-babydoll-yw672-536-850x1000-700x700.jpg
            //   https://www.malaysiadropship.com/image/creativeffects/image/data/all_product_images/product-1707/1sexy-bikini-babydoll-yw672-536-850x1000.jpg
            domain_nowww === "malaysiadropship.com") {
            // http://www.i-aurai.com/OpenCart/image/cache/data/demo/apple_cinema_30-80x80.jpg
            //   http://www.i-aurai.com/OpenCart/image/data/demo/apple_cinema_30.jpg
            return src.replace(/\/image\/cache\/([a-z]+)\/(.*)-[0-9]+x(?:[0-9]+)?(?:\.[a-z_]+)?(\.[^/.]*)$/, "/image/$1/$2$3");
        }

        if (domain.match(/images.*\.gog\.com/)) {
            // https://images-2.gog.com/859a7d00d0c0d46c8c4a215906479580f06837daa13d90837deba59ad51fdd8a_product_card_screenshot_112.jpg
            //   https://images-2.gog.com/859a7d00d0c0d46c8c4a215906479580f06837daa13d90837deba59ad51fdd8a.jpg
            return src.replace(/(\/[0-9a-f]*)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.destructoid.com") {
            // https://www.destructoid.com/ul/494427-AB-t.jpg
            //   https://www.destructoid.com//ul/494427-AB.jpg'); -- yes, not a typo
            //   https://www.destructoid.com//ul/494427-AB.jpg
            // https://www.destructoid.com/ul/493655-review-surviving-mars/DWawyA4XcAAHojb-noscale.jpg
            //   https://www.destructoid.com/ul/493655-review-surviving-mars/DWawyA4XcAAHojb.jpg
            // https://www.destructoid.com//ul/492359-h1-t.jpg
            //   https://www.destructoid.com//ul/492359-h1.jpg
            return src.replace(/-(?:t|noscale)(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/images.*\.xboxlive\.com/) &&
            src.match(/\/image\?/)) {
            // https://images-eds-ssl.xboxlive.com/image?url=8Oaj9Ryq1G1_p3lLnXlsaZgGzAie6Mnu24_PawYuDYIoH77pJ.X5Z.MqQPibUVTc6mdXIF7EzzBzjbCi0PAFFm9oIFRURAIJY671mz65mpafwXTRitZCcs1mXngtlGKXGL6FtVwx1C9b1AIuJhv8KnSQBHdQ22A122Oh6Fpn5ncAYey7_nKGGXB7mkCs9jnrsclui.l_ItF9D7zgF8n0o3RXWpfe8IGE7Wkqn5ZMTac-&w=200&h=300&format=jpg
            //   https://images-eds-ssl.xboxlive.com/image?url=8Oaj9Ryq1G1_p3lLnXlsaZgGzAie6Mnu24_PawYuDYIoH77pJ.X5Z.MqQPibUVTc6mdXIF7EzzBzjbCi0PAFFm9oIFRURAIJY671mz65mpafwXTRitZCcs1mXngtlGKXGL6FtVwx1C9b1AIuJhv8KnSQBHdQ22A122Oh6Fpn5ncAYey7_nKGGXB7mkCs9jnrsclui.l_ItF9D7zgF8n0o3RXWpfe8IGE7Wkqn5ZMTac-
            newsrc = src.replace(/\/image[^/]?[?&]url=([^&]*).*/, "/image?url=$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "musicimage.xboxlive.com") {
            // https://musicimage.xboxlive.com/catalog/video.contributor.EF755600-0200-11DB-89CA-0019B92A3933/image?locale=en-CA&target=circle&mode=crop&q=90&h=373&w=373
            return {
                url: src.replace(/\/image\?.*/, "/image?locale=en-US"),
                can_head: false // GET, OPTIONS
            };
        }

        if (domain === "media.withtank.com") {
            // http://media.withtank.com/e077b4d7c8/img_6535_690_wide.jpg
            //   http://media.withtank.com/e077b4d7c8/img_6535.jpg
            // http://media.withtank.com/1d7cdaeb6c/bb_colour_swatch_720_wide.jpg
            //   http://media.withtank.com/1d7cdaeb6c/bb_colour_swatch.jpg
            return src.replace(/_[0-9]+_wide(\.[^/.]*)$/, "$1");
        }

        if (domain === "images.cdn.realviewdigital.com") {
            // http://images.cdn.realviewdigital.com/rvimageserver/Intimo%20Lingerie/The%20Intimo%20Opportunity/The%20Intimo%20Opportunity/page0000002.jpg?type=3&width=920&quality=70&v=v2
            //   http://images.cdn.realviewdigital.com/rvimageserver/Intimo%20Lingerie/The%20Intimo%20Opportunity/The%20Intimo%20Opportunity/page0000002.jpg?type=3
            var type = src.match(/[?&]type=([^&]*)/);
            return src.replace(/\?.*/, "?type=" + type[1]);
        }

        if (domain === "proxy.duckduckgo.com") {
            // https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%3Fid%3DOIP.-fIJ70TgJpidmW2R6qcp3QHaE1%26pid%3D15.1&f=1
            //   https://tse1.mm.bing.net/th?id=OIP.-fIJ70TgJpidmW2R6qcp3QHaE1
            return decodeURIComponent(src.replace(/.*\/iu\/.*?[?&]u=([^&]*).*/, "$1"));
        }

        // Mura CMS (http://www.getmura.com/)
        if (domain === "static.scientificamerican.com") {
            // https://static.scientificamerican.com/blogs/cache/file/95AC5EF1-B21C-4B68-8A6CA35ED072425A_medium.jpg?w=170&h=113&fit=crop
            //   https://static.scientificamerican.com/blogs/cache/file/95AC5EF1-B21C-4B68-8A6CA35ED072425A.jpg
            //   https://static.scientificamerican.com/blogs/cache/file/95AC5EF1-B21C-4B68-8A6CA35ED072425A_source.jpg
            // https://static.scientificamerican.com/sciam/cache/file/DD410F93-4B85-4031-90CEF95B8C722F36.jpg?w=590&h=393
            //   https://static.scientificamerican.com/sciam/cache/file/DD410F93-4B85-4031-90CEF95B8C722F36.jpg
            //   https://static.scientificamerican.com/sciam/cache/file/DD410F93-4B85-4031-90CEF95B8C722F36_source.jpg
            // https://static.scientificamerican.com/sciam/cache/file/6A6323ED-DC05-47CA-B132FF74AAEC4163_agenda.jpg?w=210&amp;h=140
            //   https://static.scientificamerican.com/sciam/cache/file/6A6323ED-DC05-47CA-B132FF74AAEC4163.jpg
            //   https://static.scientificamerican.com/sciam/cache/file/6A6323ED-DC05-47CA-B132FF74AAEC4163_source.jpg
            // https://static.scientificamerican.com/blogs/cache/file/95AC5EF1-B21C-4B68-8A6CA35ED072425A_small.jpg?fit=crop
            //   https://static.scientificamerican.com/blogs/cache/file/95AC5EF1-B21C-4B68-8A6CA35ED072425A.jpg
            //   https://static.scientificamerican.com/blogs/cache/file/95AC5EF1-B21C-4B68-8A6CA35ED072425A_source.jpg
            // https://static.scientificamerican.com/sciam/cache/file/E82AEBA1-0A06-4B0F-9B1CFF1CE6BD8745_source.png?w=220&amp;h=100
            //   https://static.scientificamerican.com/sciam/cache/file/E82AEBA1-0A06-4B0F-9B1CFF1CE6BD8745_source.png
            return src.replace(/(?:_[^/.]*)?(\.[^/.?]*)(?:\?.*)?$/, "_source$1");
        }

        if (domain.match(/s[0-9]*\.qwant\.com/) &&
            src.indexOf("/thumbr/") >= 0) {
            // https://s1.qwant.com/thumbr/0x110/a/6/415e8905eb30e1a48a6374550f1852/b_1_q_0_p_0.jpg?u=https%3A%2F%2Fb.fssta.com%2Fuploads%2Fcontent%2Fdam%2Ffsdigital%2Ffscom%2Fnfl%2Fimages%2F2016%2F09%2F19%2F9034572-kyle-fuller-nfl-detroit-lions-chicago-bears.vresize.1200.630.high.0.jpg&q=0&b=1&p=0&a=0
            //   https://b.fssta.com/uploads/content/dam/fsdigital/fscom/nfl/images/2016/09/19/9034572-kyle-fuller-nfl-detroit-lions-chicago-bears.vresize.1200.630.high.0.jpg
            return decodeURIComponent(src.replace(/.*[?&]u=([^&]*).*/, "$1"));
        }

        if (domain === "b.fssta.com") {
            // https://b.fssta.com/uploads/content/dam/fsdigital/fscom/nfl/images/2016/09/19/9034572-kyle-fuller-nfl-detroit-lions-chicago-bears.vresize.1200.630.high.0.jpg -- stretched
            //   https://b.fssta.com/uploads/content/dam/fsdigital/fscom/nfl/images/2016/09/19/9034572-kyle-fuller-nfl-detroit-lions-chicago-bears.jpg
            return src.replace(/(\/[^/.]*)\.[^/]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain.match(/media\..*\.espn\.com$/)) {
            // http://media.video-cdn.espn.com/motion/2018/0316/dm_180316_ncb_bilas_on_buffalo/dm_180316_ncb_bilas_on_buffalo_default.jpg
            //   http://media.video-cdn.espn.com/motion/2018/0316/dm_180316_ncb_bilas_on_buffalo/dm_180316_ncb_bilas_on_buffalo.jpg
            return src.replace(/(\/[0-9]+\/[0-9]+\/)([^/]*)\/[^/]*(\.[^/.]*)$/, "$1$2\/$2$3");
        }

        if (domain === "img.skysports.com" ||
            domain.indexOf(".365dm.com") >= 0) {
            // http://img.skysports.com/18/02/768x432/skysports-matt-patricia-detroit-lions_4225501.jpg?20180208065403
            //   http://img.skysports.com/18/02/master/skysports-matt-patricia-detroit-lions_4225501.jpg?20180208065403
            // http://img.skysports.com/18/02/1-1/40/skysports-matt-patricia-detroit-lions_4225501.jpg?20180208065403
            //   http://img.skysports.com/18/02/master/skysports-matt-patricia-detroit-lions_4225501.jpg?20180208065403
            // http://e2.365dm.com/18/02/1-1/40/skysports-matt-patricia-detroit-lions_4225501.jpg?20180208065403
            //   http://e2.365dm.com/18/02/master/skysports-matt-patricia-detroit-lions_4225501.jpg?20180208065403
            return src.replace(/(:\/\/[^/]*\/[0-9]*\/[0-9]*\/)[^/]*\/(?:[0-9]*\/)?([^/]*)$/, "$1master/$2");
        }

        if (domain.match(/f[0-9]*\.bcbits\.com/) &&
            src.indexOf("/img/") >= 0) {
            // https://f4.bcbits.com/img/0012903078_36.jpg
            //   https://f4.bcbits.com/img/0012903078_0.jpg
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "_0$1");
        }

        if (domain.indexOf(".motherlessmedia.com") >= 0) {
            // http://cdn4.thumbs.motherlessmedia.com/thumbs/FDE845E-zoom.jpg?fs=opencloud
            //   http://cdn4.images.motherlessmedia.com/images/FDE845E.jpg
            return src
                .replace(/(:\/\/cdn[0-9]*\.)thumbs(\.motherlessmedia\.com\/)/, "$1images$2")
                .replace(/\/thumbs\//, "/images/")
                .replace(/-[a-z]*(\.[^/.?]*)(?:\?.*)?$/, "$1");
        }

        if (domain.indexOf("shram.kiev.ua") >= 0 &&
            src.indexOf("/img/") >= 0) {
            // http://en.shram.kiev.ua/img/fun/emilia-clarke/Emilia_Clarke_2013-small.jpg
            //   http://en.shram.kiev.ua/img/fun/emilia-clarke/Emilia_Clarke_2013-big.jpg
            // http://en.shram.kiev.ua/img/fun/emilia-clarke/emilia-clarke2-w370.jpg
            //   http://en.shram.kiev.ua/img/fun/emilia-clarke/emilia-clarke2.jpg
            return src
                .replace(/-small(\.[^/.]*)$/, "-big$1")
                .replace(/-w[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain == "storage.googleapis.com" &&
            src.indexOf("/cr-resource/image/") >= 0) {
            // http://storage.googleapis.com/cr-resource/image/5a1100e09ab0cc45cb108bbcd5d1238d/nosenter/800/151e456e844516e04e222d9d9487e79c.jpg
            //   http://storage.googleapis.com/cr-resource/image/5a1100e09ab0cc45cb108bbcd5d1238d/nosenter/151e456e844516e04e222d9d9487e79c.jpg
            return src.replace(/\/[0-9]+(\/[0-9a-f]*\.[^/.]*)$/, "$1");
        }

        if (domain.indexOf(".iol.pt") >= 0 &&
            src.indexOf("/multimedia/") >= 0) {
            // http://www.iol.pt/multimedia/oratvi/multimedia/imagem/id/13513489/800
            // http://www.iol.pt/multimedia/oratvi/multimedia/imagem/id/5903556c0cf2572470620c62/800
            // http://www.tvi24.iol.pt/multimedia/oratvi/multimedia/imagem/id/5734c40c0cf209b36b78bd3a/600.jpg
            return src.replace(/(\/id\/[0-9a-f]+)\/[0-9]+(?:\.[^/.]*)?$/, "$1");
        }

        if (domain === "img.purch.com") {
            // https://img.purch.com/w/660/aHR0cDovL3d3dy5saXZlc2NpZW5jZS5jb20vaW1hZ2VzL2kvMDAwLzAwMy8xMjQvb3JpZ2luYWwvMDkwNjA4LWNvcm4tc25ha2UtMDIuanBn -- mildly stretched
            //   https://img.purch.com/o/aHR0cDovL3d3dy5saXZlc2NpZW5jZS5jb20vaW1hZ2VzL2kvMDAwLzAwMy8xMjQvb3JpZ2luYWwvMDkwNjA4LWNvcm4tc25ha2UtMDIuanBn
            // https://img.purch.com/rc/317x177/aHR0cDovL3d3dy5saXZlc2NpZW5jZS5jb20vaW1hZ2VzL2kvMDAwLzA2MC84MzQvb3JpZ2luYWwvYW5jaWVudC1mYWJyaWMzLmpwZw==
            //   https://img.purch.com/o/aHR0cDovL3d3dy5saXZlc2NpZW5jZS5jb20vaW1hZ2VzL2kvMDAwLzA2MC84MzQvb3JpZ2luYWwvYW5jaWVudC1mYWJyaWMzLmpwZw==
            return src.replace(/\/[a-z]+\/[0-9]+(?:x[0-9]+)?\//, "/o/");
        }

        if (domain.match(/img[0-9]*\.taobaocdn\.com/)) {
            // http://img03.taobaocdn.com/bao/uploaded/i3/14462022101110112/T1vwOaXppbXXXXXXXX_!!0-item_pic.jpg_310x310.jpg
            //   http://img03.taobaocdn.com/bao/uploaded/i3/14462022101110112/T1vwOaXppbXXXXXXXX_!!0-item_pic.jpg
            return src.replace(/(\.[^/._]*)_[^/.]*\.[^/.]*$/, "$1");
        }

        if (domain === "www.musictory.com" &&
            src.match(/\/pictures\//)) {
            // http://www.musictory.com/pictures/thumbnails/78647.jpg
            return src.replace(/\/pictures\/[a-z]*\//, "/pictures/originali/");
        }

        if (domain === "popdustroar-img.rbl.ms" ||
            // https://papermag-img.rbl.ms/simage/https%3A%2F%2Fassets.rbl.ms%2F3967597%2F1200x600.jpg/2000%2C2000/3Bthb8U2RPWmDNU8/img.jpg
            //   https://assets.rbl.ms/3967597/1200x600.jpg
            //   https://assets.rbl.ms/3967597/980x.jpg
            // https://assets.rbl.ms/17099886/210x.jpg
            // https://assets.rbl.ms/1361449/origin.jpg
            (domain.indexOf(".rbl.ms") >= 0 && src.indexOf("/simage/") >= 0)) {
            // https://popdustroar-img.rbl.ms/simage/https%3A%2F%2Fassets.rbl.ms%2F6588627%2F980x.jpg/2000%2C2000/FSxn6Qs9PAa0aHKs/img.jpg
            //   https://assets.rbl.ms/6588627/980x.jpg
            return decodeURIComponent(src.replace(/.*?\/simage\/([^/]*)\/.*/, "$1"));
        }

        if (domain === "assets.rbl.ms") {
            // https://odysseyonline-img.rbl.ms/simage/https%3A%2F%2Fassets.rbl.ms%2F10613549%2F980x.jpg/2000%2C2000/CUjBUrbDC4rUON8Q/img.jpg
            //   https://assets.rbl.ms/10613549/origin.jpg
            // https://assets.rbl.ms/17487152/origin.jpg - 3600x2400
            return src.replace(/(:\/\/[^/]*\/[0-9]+\/)[^/.]*(\.[^/.]*)$/, "$1origin$2");
        }

        if (domain.match(/media[0-9]*\.santabanta\.com/)) {
            // http://media1.santabanta.com/full1/Music%20Bands/The%20Pussycat%20Dolls/the-pussycat-dolls-33a.jpg
            //   http://media1.santabanta.com/full8/Music%20Bands/The%20Pussycat%20Dolls/the-pussycat-dolls-33a.jpg
            return src.replace(/\/full[0-9]+\//, "/full8/");
        }

        if (domain === "www.movieinsider.com" &&
            src.indexOf("/images/p/") >= 0) {
            // https://www.movieinsider.com/images/p/600//18408_m1273372143.jpg
            //   https://www.movieinsider.com/images/p//18408_m1273372143.jpg
            return src.replace(/\/images\/p\/[0-9]+\//, "/images/p/");
        }

        if (domain.indexOf(".kastden.org") >= 0) {
            // https://selca.kastden.org/thumb/1271876
            //   https://selca.kastden.org/original/1271876
            return src.replace(/\/thumb\//, "/original/");
        }

        if (domain === "img.hani.co.kr") {
            // http://img.hani.co.kr/imgdb/resize/2018/0324/53_1521866554_00500158_20180324.JPG
            //   http://img.hani.co.kr/imgdb/resize/2018/0324/00500158_20180324.JPG
            //   http://img.hani.co.kr/imgdb/original/2018/0324/00500158_20180324.JPG
            // http://img.hani.co.kr/imgdb/resize/2018/0325/52_1521866282_152186627183_20180325.JPG
            //   http://img.hani.co.kr/imgdb/resize/2018/0325/152186627183_20180325.JPG
            //   http://img.hani.co.kr/imgdb/original/2018/0325/152186627183_20180325.JPG
            // http://img.hani.co.kr/imgdb/thumbnail/2018/0223/151928494178_20180223.JPG
            //   http://img.hani.co.kr/imgdb/resize/2018/0223/151928494178_20180223.JPG
            //   http://img.hani.co.kr/imgdb/original/2018/0223/151928494178_20180223.JPG
            return src
                .replace(/\/(?:thumbnail|resize)\//, "/original/")
                .replace(/\/[0-9]+_[0-9]+_([0-9]+_[0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "flexible.img.hani.co.kr") {
            // http://flexible.img.hani.co.kr/flexible/box/120/120/imgdb/resize/2018/0320/00503324_20180320.JPG
            //   http://img.hani.co.kr/imgdb/resize/2018/0320/00503324_20180320.JPG
            // http://flexible.img.hani.co.kr/flexible/box/120/120/imgdb/resize/2012/0823/1345624227_134562400908_20120823.JPG
            //   http://img.hani.co.kr/imgdb/resize/2012/0823/1345624227_134562400908_20120823.JPG
            //   original doesn't work
            return src.replace(/:\/\/[^/]*\/flexible\/.*?\/imgdb\//, "://img.hani.co.kr/imgdb/");
        }

        if (domain === "static.ok.co.uk" ||
            domain === "static.ok.co.uk.s3.amazonaws.com" ||
            domain === "ns.hitcreative.com.s3.amazonaws.com") {
            // https://static.ok.co.uk/media/images/625x938_ct/1060392_GettyImages_488606950_ddcc7556b12de0d94bf5118cda2310d2.jpg
            //   https://static.ok.co.uk/media/images/original/1060392_GettyImages_488606950_ddcc7556b12de0d94bf5118cda2310d2.jpg
            // http://static.ok.co.uk.s3.amazonaws.com/media/images/625x938_ct/635516_1433940709_dani-dyer-age-of-kill-private-screening_ba3b9a6ae1c2f94238d6371b18ab9c9d.jpg
            //   http://static.ok.co.uk.s3.amazonaws.com/media/images/original/635516_1433940709_dani-dyer-age-of-kill-private-screening_ba3b9a6ae1c2f94238d6371b18ab9c9d.jpg -- same size
            // http://ns.hitcreative.com.s3.amazonaws.com/media/images/640x960/651.jpg
            //   http://ns.hitcreative.com.s3.amazonaws.com/media/images/original/651.jpg
            return src.replace(/\/media\/images\/[^/]*\//, "/media/images/original/");
        }

        if (domain.match(/rs[0-9]*\.galaxypub\.vn/)) {
            // http://rs100.galaxypub.vn/staticFile/Subject/2018/02/14/361011/2_141343791.jpg?w=300&h=168
            //   http://st.galaxypub.vn/staticFile/Subject/2018/02/14/361011/2_141343791.jpg
            return src.replace(/:\/\/[^/]*(\/.*?)(?:\?.*)?$/, "://st.galaxypub.vn$1");
        }

        if (domain_nowww === "implanetcorp.com" &&
            src.indexOf("/upload/ctoon/") >= 0) {
            // http://www.implanetcorp.com/upload/ctoon/gravure/15/2cx368d9b03d25a21839e3ff2c8b4ff3e266gyv5/15_thumb_0f4b73d6eb051c635a246df3e36d712c.jpg
            //   http://www.implanetcorp.com/upload/ctoon/gravure/15/2cx368d9b03d25a21839e3ff2c8b4ff3e266gyv5/resize/001.JPG
            //   http://www.implanetcorp.com/upload/ctoon/gravure/15/2cx368d9b03d25a21839e3ff2c8b4ff3e266gyv5/original/001.JPG
            // http://www.implanetcorp.com/upload/ctoon/gravure/15/m1648d5a7d3f7856e668c7fa20336f9a97bc6vro/15_thumb_fecc0a9e6650bca40094b86194629705.jpg
            //   http://www.implanetcorp.com/upload/ctoon/gravure/15/m1648d5a7d3f7856e668c7fa20336f9a97bc6vro/original/001.jpg
            return src
                //.replace(/\/[0-9]+_thumb_[0-9a-f]+(\.[^/.]*)$/, "/original/001.JPG")
                .replace(/\/[a-z]*\/([0-9]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "doramakun.ru") {
            // http://doramakun.ru/thumbs/users/15581/photo/84/TQPg5IWwQTQ-185.jpg
            //   http://doramakun.ru/users/15581/photo/84/TQPg5IWwQTQ.jpg
            // http://doramakun.ru/thumbs/users/15581/photo/84/bRhbKntPXhI-185.jpg
            //   http://doramakun.ru/thumbs/users/15581/photo/84/bRhbKntPXhI-413.jpg
            //   http://doramakun.ru/users/15581/photo/84/bRhbKntPXhI.jpg -- same size
            return src.replace(/\/thumbs\/(.*)-[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "1gr.cz") {
            // https://1gr.cz/fotky/idnes/15/043/cl5/ZAR5ab634_MA210_USA_ENTERTAINMENT_0421_11.JPG
            //   https://1gr.cz/fotky/idnes/15/043/org/ZAR5ab634_MA210_USA_ENTERTAINMENT_0421_11.JPG
            return src.replace(/(\/[0-9]+\/[0-9]+\/)[^/]*\/([^/]*)$/, "$1org/$2");
        }

        if (domain === "ancensored.com" &&
            src.match(/\/files\/images\//)) {
            // http://ancensored.com/files/images/vthumbs/r/f284d8efea6df08d1df56ced003397f2.jpg
            //   http://ancensored.com/files/images/vthumbs/r/f284d8efea6df08d1df56ced003397f2_full.jpg
            return src.replace(/(\/[0-9a-f]*)(?:_[a-z]*)?(\.[^/.]*)$/, "$1_full$2");
        }

        if (domain === "www.desktopbackground.org") {
            // https://www.desktopbackground.org/download/800x600/2014/11/15/856176_hd-wallpapers-4users-rachel-riley-hd-wallpapers-1080p_1600x1000_h.jpg
            //   https://www.desktopbackground.org/p/2014/11/15/856176_hd-wallpapers-4users-rachel-riley-hd-wallpapers-1080p_1600x1000_h.jpg
            //   https://www.desktopbackground.org/download/o/2014/11/15/856176_hd-wallpapers-4users-rachel-riley-hd-wallpapers-1080p_1600x1000_h.jpg
            return src
                .replace(/\/download\/[^/]*\//, "/download/o/")
                .replace(/(:\/\/[^/]*)\/p\//, "$1/download/o/");
        }

        if (domain === "image.mlive.com" ||
            // http://image.nj.com/home/njo-media/width600/img/sixers_main/photo/embiid-rihannajpg-f2240659a535f626.jpg
            //   http://media.nj.com/sixers_main/photo/embiid-rihannajpg-f2240659a535f626.jpg
            domain === "image.nj.com" ||
            // https://image.cleveland.com/home/cleve-media/width600/img/ent_impact_home/photo/rihanna-1075cbb4ed700882.jpg
            //   https://media.cleveland.com/ent_impact_home/photo/rihanna-1075cbb4ed700882.jpg
            domain === "image.cleveland.com") {
            // http://image.mlive.com/home/mlive-media/width307/img/grpress/news_impact/photo/24285148-standard.jpg
            //   https://image-api.advance.net/prod/resize?key=home/mlive-media/width307/img/grpress/news_impact/photo/24285148-standard.jpga
            //   http://media.mlive.com/grpress/news_impact/photo/24285148-standard.jpg
            return src.replace(/:\/\/image\.([^/]*)\/home\/[a-z]+-media\/[^/]*\/img\//, "://media.$1/");
        }

        if (domain.indexOf(".hwcdn.net") >= 0) {
            // https://s9v7j7a4.ssl.hwcdn.net/galleries/new_big/58/df/5c/58df5c4f13e698517e6a9aa00e311f9a/3.jpg
            //   https://s9v7j7a4.ssl.hwcdn.net/galleries/full/58/df/5c/58df5c4f13e698517e6a9aa00e311f9a/3.jpg
            return src.replace(/\/galleries\/[^/]*\//, "/galleries/full/");
        }

        if (domain === "aws-foto.amateri.com") {
            // https://aws-foto.amateri.com/foto/4/9/7/1/g1778419/14400873/170x220c.jpg
            //   https://aws-foto.amateri.com/foto/4/9/7/1/g1778419/14400873/x.jpg
            return src.replace(/\/[0-9]+x[^/.]*(\.[^/.]*)$/, "/x$1");
        }

        if (domain === "cdn.tobi.com") {
            // https://cdn.tobi.com/product_images/sm/1/natural-infinite-glow-layered-bracelet-set.jpg
            //   https://cdn.tobi.com/product_images/lg/1/natural-infinite-glow-layered-bracelet-set@2x.jpg
            // https://cdn.tobi.com/product_images/md/1/rose-eyes-on-you-knotted-maxi-dress.jpg
            //   https://cdn.tobi.com/product_images/lg/1/rose-eyes-on-you-knotted-maxi-dress@2x.jpg
            // https://cdn.tobi.com/product_images/xs/1/black-zeira-top.jpg
            //   https://cdn.tobi.com/product_images/lg/1/black-zeira-top@2x.jpg
            return src
                .replace(/\/product_images\/[a-z]+\//, "/product_images/lg/")
                .replace(/(\/[^/.@]*)(\.[^/.]*)$/, "$1@2x$2");
        }

        if (domain === "www.rfa.org") {
            // https://www.rfa.org/english/commentaries/energy_watch/tariff-row-may-do-little-economic-damage-in-china-04022018101727.html/china-shopper-supermarket-beijing-apr2-2018.jpg/@@images/0fe75452-e65b-4e6b-a5b3-3db87b335e19.jpeg
            //   https://www.rfa.org/english/commentaries/energy_watch/tariff-row-may-do-little-economic-damage-in-china-04022018101727.html/china-shopper-supermarket-beijing-apr2-2018.jpg
            // https://www.rfa.org/english/news/china/surveillance-03302018111415.html/china-security-camera-beijing-march-2018.jpg/@@images/87f9b6b7-fcea-43d1-845b-a1ae6a022908.jpeg
            //   https://www.rfa.org/english/news/china/surveillance-03302018111415.html/china-security-camera-beijing-march-2018.jpg
            return src.replace(/\/@@images\/.*/, "");
        }

        if (domain === "resize.blogsys.jp") {
            // http://resize.blogsys.jp/94afa543ba574167ccfea7dfa414f8f2672f474a/crop1/70x70/http://livedoor.blogimg.jp/destinychild/imgs/2/e/2eed2325.jpg
            //   http://livedoor.blogimg.jp/destinychild/imgs/2/e/2eed2325.jpg
            return src.replace(/^[a-z]*:\/\/.*\/([a-z]*:\/\/.*)$/, "$1");
        }

        if (domain === "bw-1651cf0d2f737d7adeab84d339dbabd3-gallery.s3.amazonaws.com") {
            // https://bw-1651cf0d2f737d7adeab84d339dbabd3-gallery.s3.amazonaws.com/images/image_2766690/b3c7292a567fb4de95fbf3cadfcecc67_thumbnail.jpg
            //   https://bw-1651cf0d2f737d7adeab84d339dbabd3-gallery.s3.amazonaws.com/images/image_2766690/b3c7292a567fb4de95fbf3cadfcecc67_large.jpg
            //   https://bw-1651cf0d2f737d7adeab84d339dbabd3-gallery.s3.amazonaws.com/images/image_2766690/b3c7292a567fb4de95fbf3cadfcecc67_original.jpg
            return src.replace(/_[a-z]+(\.[^/.]*)$/, "_original$1");
        }

        if (domain.match(/img[0-9]*\.rl0\.ru/)) {
            // https://img09.rl0.ru/a4a2e0b13fb27ee8aed0196cebf4a0bc/c500x281/i.imgur.com/a5MASCq.gif
            //   http://i.imgur.com/a5MASCq.gif
            // https://img02.rl0.ru/f0ae2d1540ad72f10378305af4ff7201/563x1000/news.rambler.ru/img/2017/09/18140001.943169.900.jpeg
            //   https://news.rambler.ru/img/2017/09/18140001.943169.900.jpeg
            // https://img.rl0.ru/afisha/144x144/newid.afisha.ru/StaticContent/UserPhoto/f0/8a/e4f2dc0aa41d4aaa99f508853432f08a.jpg
            //   http://newid.afisha.ru/StaticContent/UserPhoto/f0/8a/e4f2dc0aa41d4aaa99f508853432f08a.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/[a-z0-9]+\/c?[0-9]+x[0-9]+\//, "http://");
        }

        if (domain.match(/cdn-img-[0-9]+\.wanelo\.com/)) {
            // https://cdn-img-1.wanelo.com/p/914/ad1/157/33d5c0fef57bd90c33c7fd0/x354-q80.jpg
            //   https://cdn-img-1.wanelo.com/p/914/ad1/157/33d5c0fef57bd90c33c7fd0/full_size.jpg
            return src.replace(/\/[^/.]*(\.[^/.]*)$/, "/full_size$1");
        }

        if (domain === "static.kvraudio.com") {
            // https://static.kvraudio.com/i/s/g-sonique-neurofunker-xg6.jpg
            //   https://static.kvraudio.com/i/b/g-sonique-neurofunker-xg6.jpg
            return src.replace(/(:\/\/[^/]*\/i\/)[a-z]\//, "$1b/");
        }

        if (domain === "contents.dt.co.kr") {
            // http://contents.dt.co.kr/thum/99/2018040602100932052001_99_3.jpg
            //   http://contents.dt.co.kr/images/201804/2018040602100932052001[1].jpg
            //   http://contents.dt.co.kr/images/201804/2018040602100932052001.jpg
            return src.replace(/\/thum\/[0-9]+\/([0-9]{6})([0-9]+)_[^/.]*(\.[^/.]*)/, "/images/$1/$1$2$3");
        }

        if (domain === "eng.dt.co.kr") {
            // http://eng.dt.co.kr/images/thum/20180405111518001543.jpg
            //   http://eng.dt.co.kr/images/oriimg/20180405111518001543[0].jpg
            return src.replace(/\/images\/thum\/([0-9]+)/, "/images/oriimg/$1[0]");
        }

        // http://image.ytn.co.kr/general/jpg/2017/0831/201708311021406804_d.jpg
        if (domain === "image.ytn.co.kr" ||
            // http://img.sciencetv.kr/sciencetv/jpg/vod1142/2018/201801301101561712_h.jpg
            domain === "img.sciencetv.kr") {
            // http://image.ytn.co.kr/general/jpg/2018/0402/201804022235469141_h.jpg -- doesn't work:
            //   http://image.ytn.co.kr/general/jpg/2018/0402/201804022235469141_t.jpg -- works
            //   http://www.ytn.co.kr/_ln/0102_201804022235469141_002 -- is video thumbnail
            // d, t, h, k, j
            return src.replace(/(:\/\/[^/]*\/[^/]*\/jpg\/[^/]*\/[^/]*\/[0-9]+_)[a-z](\.[^/.]*)$/, "$1d$2");
        }

        if (domain === "photo.kmib.co.kr") {
            //http://photo.kmib.co.kr/index.asp?number=4925&page=6
            // http://photo.kmib.co.kr/data/4925/thumb_20150825103025.jpg
            //   http://photo.kmib.co.kr/data/4925/20150825103025.jpg
            return src.replace(/\/thumb_([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "r.kelkoo.com") {
            // http://r.kelkoo.com/r/uk/15002013/146501/auto/auto/https%253A%252F%252Fdyson-h.assetsadobe2.com%252Fis%252Fimage%252Fcontent%252Fdam%252Fdyson%252Fimages%252Fproducts%252Fprimary%252F231868-01.png%253F%2524responsive%2524%2526fmt%253Dpng-alpha%2526cropPathE%253Ddesktop%2526fit%253Dstretch%252C1%2526wid%253D800/T5JylUsrxw8XjkR2zJUTmqQIfK8oIrzwXgEbTo_Jtn0-?searchId=10769920122096_1520492759094_270260&offerId=206b270741bc0810a4c2fc0d1b48d86f
            //   https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary/231868-01.png?$responsive$&fmt=png-alpha&cropPathE=desktop&fit=stretch,1&wid=800
            return decodeURIComponent(decodeURIComponent(src.replace(/^[a-z]*:\/\/(?:[^/]*\/){7}(http[^/]*).*?$/, "$1")));
        }

        if (domain.indexOf(".assetsadobe2.com") >= 0) {
            // https://dyson-h.assetsadobe2.com/is/image//content/dam/dyson/products/hair-care/dyson-supersonic/customisation/personal-care-dyson-supersonic-customisation-homepage.jpg?scl=1
            // https://dyson-h.assetsadobe2.com/is/image//content/dam/dyson/icons/owner-footer/register-my-machine.png?scl=1&fmt=png-alpha
            // https://airbus-h.assetsadobe2.com/is/image/content/dam/products-and-solutions/commercial-aircraft/beluga/belugaxl/BelugaXL.jpg?wid=1920&fit=fit,1&qlt=85,0
            // https://dyson-h.assetsadobe2.com/is/image//content/dam/dyson/services-and-support/troubleshoot/hassle-free-repalcement.png
            if (src.match(/\.jpg(?:\?.*)?$/))
                return src.replace(/(?:\?.*)?$/, "?scl=1");
            else
                return src.replace(/(?:\?.*)?$/, "?scl=1&fmt=png-alpha");
        }

        if (domain === "sm.ign.com") {
            // http://sm.ign.com/t/ign_in/feature/a/afl-clubs-/afl-clubs-recognise-that-esports-are-sports-why-hasnt-everyo_azz8.300.jpg
            //   http://sm.ign.com/t/ign_in/feature/a/afl-clubs-/afl-clubs-recognise-that-esports-are-sports-why-hasnt-everyo_azz8.999999999999999.jpg
            return src.replace(/\.[0-9]+\.([^/.]*)$/, ".999999999999999.$1");
        }

        // nopCommerce
        if (domain === "shop.unitedcycle.com" &&
            src.indexOf("/images/thumbs/") >= 0) {
            // https://shop.unitedcycle.com/content/images/thumbs/0277134_mens-nhl-edmonton-oilers-connor-mcdavid-authentic-home-jersey_276.jpeg
            //   https://shop.unitedcycle.com/content/images/thumbs/0277134_mens-nhl-edmonton-oilers-connor-mcdavid-authentic-home-jersey.jpeg
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "imgr.es") {
            // https://imgr.es/4AVP/thumb
            //   https://imgr.es/4AVP
            return src.replace(/\/thumb$/, "");
        }

        if (domain.indexOf(".frgimages.com") >= 0 ||
            domain === "images.footballfanatics.com") {
            // http://nhl.frgimages.com/FFImage/thumb.aspx?i=/productImages/_2799000/ff_2799544_full.jpg&w=340
            //   http://nhl.frgimages.com/productImages/_2799000/ff_2799544_full.jpg
            // http://images.footballfanatics.com/FFImage/thumb.aspx?i=/productImages/_821000/ff_821054_xl.jpg&amp;w=200
            //   http://images.footballfanatics.com/productImages/_821000/ff_821054_xl.jpg
            //   http://images.footballfanatics.com/productImages/_821000/ff_821054_full.jpg
            // http://images.footballfanatics.com/FFImage/thumb.aspx?i=%2fproductImages%2f_1759000%2fff_1759679_xl.jpg&w=400
            //   http://images.footballfanatics.com/productImages/_1759000/ff_1759679_full.jpg
            newsrc = decodeURIComponent(src.replace(/\/FFImage\/thumb.aspx.*?[?&]i=([^&]*).*/, "$1"));
            if (newsrc !== src)
                return newsrc;

            return src
                .replace(/_[a-z]+(\.[^/.?&]*)$/, "_full$1");
        }

        if (domain === "myanimelist.cdn-dena.com") {
            // https://myanimelist.cdn-dena.com/r/23x32/images/characters/5/303016.webp?s=3e198afde53adfb2b47dc59782dc82f7
            //   https://myanimelist.cdn-dena.com/images/characters/5/303016.webp?s=3e198afde53adfb2b47dc59782dc82f7
            return src.replace(/\/r\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain === "picture-cdn.wheretoget.it") {
            // http://picture-cdn.wheretoget.it/qey8wu-i-c60x60.jpg
            //   http://picture-cdn.wheretoget.it/qey8wu-i.jpg
            return src.replace(/(\/[a-z0-9]*-[a-z])[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "sl.sbs.com.au") {
            // https://sl.sbs.com.au/public/image/file/4f4cf0a2-ec64-46e8-9958-faa712440c28/crop/16x9_medium
            //   https://sl.sbs.com.au/public/image/file/4f4cf0a2-ec64-46e8-9958-faa712440c28
            // https://sl.sbs.com.au/public/image/file/0c3ca54a-0cfa-400e-9cb0-d09631c81769/crop/1x1_small
            //   https://sl.sbs.com.au/public/image/file/0c3ca54a-0cfa-400e-9cb0-d09631c81769
            return src.replace(/(\/public\/image\/file\/[-a-f0-9]*)\/.*/, "$1");
        }

        if (domain.indexOf(".assets.prezly.com") >= 0) {
            // https://cdn.uc.assets.prezly.com/d24b5696-a65c-48d6-9cfd-1b0b98ca1f3c/-/preview/1108x1108/
            //   https://cdn.uc.assets.prezly.com/d24b5696-a65c-48d6-9cfd-1b0b98ca1f3c/-
            // https://cdn.uc.assets.prezly.com/6201f512-e09d-440f-95e3-d1aa316f70e6/-/resize/1108x/-/quality/best/
            //   https://cdn.uc.assets.prezly.com/6201f512-e09d-440f-95e3-d1aa316f70e6/-
            // https://cdn.uc.assets.prezly.com/c204db5f-a17a-4c64-96b2-112b0876cb84/-/preview/1108x1108/
            //   https://cdn.uc.assets.prezly.com/c204db5f-a17a-4c64-96b2-112b0876cb84/-
            return src.replace(/(:\/\/[^/]*\/[-a-f0-9]*\/).*/, "$1-");
        }

        if (domain === "cdn.iview.abc.net.au") {
            // https://cdn.iview.abc.net.au/thumbs/460/nn/NN1603D568368a49e2fa8.38197525_940.jpg
            //   https://cdn.iview.abc.net.au/thumbs/i/nn/NN1603D568368a49e2fa8.38197525_940.jpg
            return src.replace(/\/thumbs\/[0-9]+\//, "/thumbs/i/");
        }

        if (domain === "ipstatic.net" ||
            domain.indexOf(".ipstatic.net") >= 0) {
            // http://ipstatic.net/img?url=http%3A%2F%2Fstatic.independent.co.uk%2Fs3fs-public%2Fthumbnails%2Fimage%2F2015%2F12%2F22%2F23%2FSesame-Credit.jpg
            //   http://static.independent.co.uk/s3fs-public/thumbnails/image/2015/12/22/23/Sesame-Credit.jpg
            // http://ipstatic.net/img?url=http%3A%2F%2Fi.imgur.com%2FfauqaqC.png
            newsrc = decodeURIComponent(src.replace(/.*\/img.*?[?&]url=([^&]*).*?$/, "$1"));
            if (newsrc !== src)
                return newsrc;

            // https://th1-us.ipstatic.net/thumbs/100x100/57/26/700x699_830169982986518529_830172363316953088.jpg
            //   https://us.ipstatic.net/photos/57/26/700x699_830169982986518529_830172363316953088.jpg
            return src.replace(/\/thumbs\/[0-9]+x[0-9]+\//, "/photos/");
        }

        if (domain === "image.fnnews.com") {
            // http://image.fnnews.com/resource/paper/image/2018/02/22/f201802222005_s.jpg - 150x252
            //   http://image.fnnews.com/resource/paper/image/2018/02/22/f201802222005_m.jpg - 1024x1826
            //   http://image.fnnews.com/resource/paper/image/2018/02/22/f201802222005_l.jpg - 2048x3452
            //   http://image.fnnews.com/resource/paper/image/2018/02/22/f201802222005.jpg - 2294x3867
            // http://image.fnnews.com/resource/media/image/2015/01/07/201501071226571964.jpg
            // http://image.fnnews.com/resource/media/image/2015/02/09/201502091020442956_s.jpg
            //
            // http://image.fnnews.com/resource/crop_image/2018/03/28/thumb/201803280955183839_1522283684662.jpg
            //   http://image.fnnews.com/resource/media/image/2018/03/28/201803281002583124.jpg
            return src
                .replace(/(\/[a-z]?[0-9]+)_[a-z](\.[^/.]*)/, "$1$2");
        }

        if (domain.indexOf(".kym-cdn.com") >= 0) {
            // http://i0.kym-cdn.com/featured_items/icons/wide/000/007/926/46b.jpg
            //   http://i0.kym-cdn.com/featured_items/icons/original/000/007/926/46b.jpg
            // http://i0.kym-cdn.com/photos/images/newsfeed/001/318/958/c7d.png
            //   http://i0.kym-cdn.com/photos/images/original/001/318/958/c7d.png
            // http://i0.kym-cdn.com/entries/icons/mobile/000/025/888/the-problem-with-apu.jpg
            //   http://i0.kym-cdn.com/entries/icons/original/000/025/888/the-problem-with-apu.png
            return src.replace(/(:\/\/[^/]*\/[^/]*\/(?:images|icons)\/)[^/]*\//, "$1original/");
        }

        if (domain === "cmeimg-a.akamaihd.net" ||
            domain === "leafimg-a.akamaihd.net") {
            // https://cmeimg-a.akamaihd.net/640/photos.demandstudios.com/getty/article/144/8/178883146.jpg
            //   http://photos.demandstudios.com/getty/article/144/8/178883146.jpg
            // http://cmeimg-a.akamaihd.net/640/photos.demandstudios.com/getty/article/56/93/78034732.jpg
            //   http://photos.demandstudios.com/getty/article/56/93/78034732.jpg
            // https://cmeimg-a.akamaihd.net/640/ppds/1ad05338-0679-4fa1-b259-631df59b4a89.png -- default doesn't work
            // https://cmeimg-a.akamaihd.net/400x400/ppds/53e36ed7-8bb2-4448-b7f5-96acdc58ee1b.jpg
            //   https://cmeimg-a.akamaihd.net/default/ppds/53e36ed7-8bb2-4448-b7f5-96acdc58ee1b.jpg
            // https://cmeimg-a.akamaihd.net/x650/clsd/4/3/11bf5d91994d4b90a21192a6c464390c
            //   https://cmeimg-a.akamaihd.net/default/clsd/4/3/11bf5d91994d4b90a21192a6c464390c
            // https://cmeimg-a.akamaihd.net/400x269/photos.demandstudios.com/getty/article/181/85/492145443.jpg
            //   http://photos.demandstudios.com/getty/article/181/85/492145443.jpg
            // https://cmeimg-a.akamaihd.net/default/clsd/4/3/fb64bd3f01f541f3bbcd4fd0f3c821fc
            // https://cmeimg-a.akamaihd.net/default/ppds/d88f0042-735e-404f-8156-519ba9c85d8c.png
            // https://cmeimg-a.akamaihd.net/cute-article-rcp/photos.demandstudios.com/getty/article/110/112/87490270.jpg
            //   http://photos.demandstudios.com/getty/article/110/112/87490270.jpg
            // https://leafimg-a.akamaihd.net/640/ppds/00e86e6a-fcfc-4bea-b451-4b58187cf0cf.jpg
            //   https://leafimg-a.akamaihd.net/default/ppds/00e86e6a-fcfc-4bea-b451-4b58187cf0cf.jpg
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/(?:[0-9]+(?:x[0-9]+)?|x[0-9]+|cute-article-rcp)\/([^/.]*\.[^/]*\/.*)/, "http://$1");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/^([a-z]+:\/\/[^/]*\/)(?:[0-9]+(?:x[0-9]+)?|x[0-9]+)\//, "$1default/");
        }

        if (domain.match(/imagecdn[0-9]*\.luxnet\.ua/)) {
            // https://imagecdn1.luxnet.ua/football24/resources/photos/news/660x364_DIR/201803/443933.jpg?201803090027
            //   https://imagecdn1.luxnet.ua/football24/resources/photos/news/201803/443933.jpg?201803090027
            // https://imagecdn1.luxnet.ua/radio24/uploads/640_DIR/media_news/2017/07/16340fc3f938eec4245df2c441b49bf67fb0ad28.jpg
            //   https://imagecdn1.luxnet.ua/radio24/uploads/media_news/2017/07/16340fc3f938eec4245df2c441b49bf67fb0ad28.jpg
            return src.replace(/\/[0-9]+(?:x[0-9]+)?_DIR\//, "/");
        }

        if (domain === "userstyles.org") {
            // https://userstyles.org/style_screenshot_thumbnails/139772_after.jpeg
            //   https://userstyles.org/style_screenshots/139772_after.jpeg
            return src.replace("/style_screenshot_thumbnails/", "/style_screenshots/");
        }

        if (domain.indexOf(".narvii.com") >= 0) {
            // https://pm1.narvii.com/6144/3af419d28deec398f490c7b1e0106d41165f84e0_128.jpg
            //   https://pm1.narvii.com/6144/3af419d28deec398f490c7b1e0106d41165f84e0_hq.jpg
            // https://pm1.narvii.com/6795/59948b2d6d93878fcfbcbf091d9edfa9399b93c4v2_00.jpg
            //   https://pm1.narvii.com/6795/59948b2d6d93878fcfbcbf091d9edfa9399b93c4v2_hq.jpg
            return src.replace(/(\/[0-9a-fv]+_)[^/.]*(\.[^/.]*)/, "$1hq$2");
        }

        if (domain === "img.oastatic.com") {
            // https://img.oastatic.com/img2/14456082/671x335r/view-from-zumstein.jpg
            //   https://img.oastatic.com/img/14456082/view-from-zumstein.jpg -- much smaller
            //   https://img.oastatic.com/imgmax/14456082/view-from-zumstein.jpg -- smaller (2048x1149)
            //   https://img.oastatic.com/img2/14456082/full/view-from-zumstein.jpg (3648x2048)
            //   https://img.oastatic.com/imgsrc/14456082/view-from-zumstein.jpg (3648x2048)
            // https://img.oastatic.com/img/671/335/fit/3159891/baeume-im-urwald-reinhardswald.jpg
            //   https://img.oastatic.com/img2/3159891/full/baeume-im-urwald-reinhardswald.jpg
            // http://img.oastatic.com/img/800/600/7214820/7214820.jpg
            //   http://img.oastatic.com/img2/7214820/full/7214820.jpg
            // http://img.oastatic.com/img/22917128/.jpg
            //   http://img.oastatic.com/img2/22917128/full/.jpg
            // http://img.oastatic.com/imgmax/8078056/das-alte-oesterreichische-zollhaus-am-krimmler-tauern.jpg (2000x1328)
            //   http://img.oastatic.com/img2/8078056/full/das-alte-oesterreichische-zollhaus-am-krimmler-tauern.jpg (2000x1328)
            // https://img.oastatic.com/img2/4273466/671x335r/der-historic-firetower-am-gipfel-des-mount-revelstoke..jpg
            //   https://img.oastatic.com/img2/4273466/full/der-historic-firetower-am-gipfel-des-mount-revelstoke..jpg (4320x2880)
            //   https://img.oastatic.com/imgsrc/4273466/der-historic-firetower-am-gipfel-des-mount-revelstoke..jpg (4320x2880)
            // http://img.oastatic.com/imgsrc/6128163/.jpg
            // https://img.oastatic.com/img/6351623/der-septimer-pass-wo-koenige-und-kaiser-die-alpen-ueberschritten.jpg
            //   https://img.oastatic.com/img2/6351623/full/der-septimer-pass-wo-koenige-und-kaiser-die-alpen-ueberschritten.jpg -- doesn't work
            //   https://img.oastatic.com/imgsrc/6351623/der-septimer-pass-wo-koenige-und-kaiser-die-alpen-ueberschritten.jpg -- doesn't work
            return src
                .replace(/\/img\/[0-9]+\/[0-9]+(?:\/fit)?\/([0-9]+)\/([^/]*)$/, "/img/$1/$2")
                .replace(/\/img\/([0-9]+)\/([^/]*)$/, "/img2/$1/full/$2")
                .replace(/\/imgmax\/([0-9]+)\/([^/]*)$/, "/img2/$1/full/$2")
                .replace(/(\/img2\/[0-9]+\/)[^/]*\/([^/]*)$/, "$1full/$2")
                .replace(/\/img2\/([0-9]+)\/full\/([^/]*)$/, "/imgsrc/$1/$2");
        }

        if (domain === "img.valais.ch") {
            // https://img.valais.ch/?url=img.oastatic.com%2Fimg%2F22917128%2F.jpg&w=940&h=580&t=square&q=75
            //   http://img.oastatic.com/img/22917128/.jpg
            return "http://" + decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?[?&]url=([^&]*).*/, "$1"));
        }

        // Storenvy
        if (domain.indexOf(".cloudfront.net") >= 0 &&
            src.match(/:\/\/[^/]*\/product_photos\/[0-9]+\/[^/.]*_[^/.]*\.[^/.]*$/)) {
            // http://d2a2wjuuf1c30f.cloudfront.net/product_photos/52139630/2118646912_1845346882_original_original_medium.jpg
            //   http://d2a2wjuuf1c30f.cloudfront.net/product_photos/52139630/2118646912_1845346882_original_original_original.jpg
            // http://dlp2gfjvaz867.cloudfront.net/product_photos/62536200/file_e5a4ce5fa4_medium.jpg
            //   http://dlp2gfjvaz867.cloudfront.net/product_photos/62536200/file_e5a4ce5fa4_original.jpg
            return src.replace(/(\/product_photos\/[0-9]+\/[^/]*)_[^/._]*(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain.match(/img[0-9]*\.etsystatic\.com/)) {
            // https://img.etsystatic.com/il/ee4147/687832738/il_340x270.687832738_akcv.jpg?version=3
            //   https://img.etsystatic.com/il/ee4147/687832738/il_570xN.687832738_akcv.jpg?version=3
            //   https://img.etsystatic.com/il/ee4147/687832738/il_fullxfull.687832738_akcv.jpg?version=3
            // https://img0.etsystatic.com/024/0/41472418/icm_fullxfull.34237406_jkqru58m5s84804o448s.jpg
            // https://img0.etsystatic.com/204/0/116068862/iusa_fullxfull.52864766_sco2.jpg
            // https://img1.etsystatic.com/188/0/14551365/isla_fullxfull.26904175_4smpme6j.jpg
            // https://img1.etsystatic.com/182/0/6993388/iss_fullxfull.12517843_i8l62k59.jpg
            // https://img0.etsystatic.com/196/0/7799858/igwp_fullxfull.1357445390_9pt1mltn.jpg
            // https://img0.etsystatic.com/189/0/274695830074/inv_fullxfull.1434228736_9e2pmqxr.jpg
            // https://img1.etsystatic.com/191/0/96548065/imfs_fullxfull.22421_y67munzc.jpg
            // https://img.etsystatic.com/il/ed3eab/845091829/il_570xN.845091829_qcz9.jpg?version=0
            //   https://img.etsystatic.com/il/ed3eab/845091829/il_fullxfull.845091829_qcz9.jpg?version=0
            return src.replace(/(\/[a-z]+_)[0-9a-zA-Z]+x[0-9a-zA-Z]+\./, "$1fullxfull.");
        }

        if (domain.indexOf(".twnmm.com") >= 0) {
            // https://s1.twnmm.com/thumb?src=http://pelmorexpd-a.akamaihd.net/img/1942203455001/201804/1942203455001_5769239466001_5769162032001-vs.jpg?pubId=1942203455001&videoId=5769162032001&w=268&h=151&scale=1&crop=1
            //   http://pelmorexpd-a.akamaihd.net/img/1942203455001/201804/1942203455001_5769239466001_5769162032001-vs.jpg
            // https://s1.twnmm.com/thumb?src=//s1.twnmm.com/images/en_ca/12/GETTY%20-%20Snow%20and%20freezing%20rain-99295.jpg&w=145&h=80&scale=1&crop=1
            //   https://s1.twnmm.com/images/en_ca/12/GETTY%20-%20Snow%20and%20freezing%20rain-99295.jpg -- zero length image?
            return urljoin(src, src.replace(/^[a-z]+:\/\/[^/]*\/thumb.*?[?&]src=([^?&]*).*/, "$1"));
        }

        if (domain === "www.findx.com" &&
            src.indexOf("/api/images/assets/") >= 0) {
            // https://www.findx.com/api/images/assets/500,sJb7dhfdfn7FbXJ9txRO2ZJNsRJNSBrHH5D-lTi8zPa8/https://image.shutterstock.com/display_pic_with_logo/3323144/524606014/stock-vector-la-vie-est-belle-postcard-life-is-beautiful-in-french-ink-illustration-modern-brush-calligraphy-524606014.jpg
            //   https://image.shutterstock.com/display_pic_with_logo/3323144/524606014/stock-vector-la-vie-est-belle-postcard-life-is-beautiful-in-french-ink-illustration-modern-brush-calligraphy-524606014.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/api\/images\/assets\/[^/]*\//, "");
        }

        if (domain_nowww === "konsolinet.fi") {
            // https://www.konsolinet.fi/tuotekuvat/900x600/dims-quality-100-image_uri-http-3A-2F-2Fo-aolcdn-com-2Fhss-2Fstorage-2Fmidas-2Fc580709e7625f4ae45b7728ca8e4c68c-2F205370453-2Fmatterfall-cutscene-jpg-client-cbc79c14efcebee57402-signature-d89cb8da745b275966310f72eeb47f993dd3f470.jpg
            //   https://www.konsolinet.fi/tuotekuvat/dims-quality-100-image_uri-http-3A-2F-2Fo-aolcdn-com-2Fhss-2Fstorage-2Fmidas-2Fc580709e7625f4ae45b7728ca8e4c68c-2F205370453-2Fmatterfall-cutscene-jpg-client-cbc79c14efcebee57402-signature-d89cb8da745b275966310f72eeb47f993dd3f470.jpg
            return src.replace(/(:\/\/[^/]*\/[^/]*\/)[0-9]+x[0-9]+\//, "$1");
        }

        if (domain.match(/static[0-9]*\.vigbo\.com/) ||
            domain.match(/static[0-9]*\.gophotoweb\.com/)) {
            // http://static1.vigbo.com/u19820/22951/photos/3065711/1500-gophotoweb-5e9e0caa00352abf3c64dd6656552c8c.JPG
            //   http://static1.vigbo.com/u19820/22951/photos/3065711/2000-gophotoweb-5e9e0caa00352abf3c64dd6656552c8c.JPG
            // http://static1.gophotoweb.com/u4419/3425/photos/680943/500-alexey_trofimov-170b44c09e9fdabd1446bf2f125c2836.jpg
            // http://static1.gophotoweb.com/u5132/6272/photos/956409/1000-ilona_bitz-d03e78a0cbf053ad6f528185a36adb6e.jpg -- 2574x3861
            //   http://static1.gophotoweb.com/u5132/6272/photos/956409/2000-ilona_bitz-d03e78a0cbf053ad6f528185a36adb6e.jpg -- 2000x3000
            // http://static1.vigbo.com/u27635/36776/photos/2923250/27995e8e47fa8ce68f3bd8d453d39ef7.jpg
            // http://static1.vigbo.com/u25048/31970/blog/2516051/1515299/section/54291811154e5322f8bd5bb20dea92c9.JPG
            // http://static1.gophotoweb.com/u6358/7237/news/20481/olgailyina_011_small_size.jpg
            // http://static1.gophotoweb.com/u4846/4148/photos/3915482/500-angelina_popova-18dc621c7a32c1e2713004d4da7a448a.jpg -- 2832x3964
            //   http://static1.gophotoweb.com/u4846/4148/photos/3915482/2000-angelina_popova-18dc621c7a32c1e2713004d4da7a448a.jpg -- 2000x2799
            // http://static1.gophotoweb.com/u5582/8320/photos/1020204/1500-579c1845b3d10ee7c47879da356f7c96.jpg
            // http://static1.gophotoweb.com/u4101/2850/photos/68038/2000-MAXIM_PRUSAKOV-a9d75cf62aab8acd8b63bd08344f53e1.jpg
            // http://static1.gophotoweb.com/u3610/2156/photos/53740/1000-marinasapega%20%20-853ebe2afa24da5b6b817b6dbc97f492.jpg -- 3644x5466
            //   http://static1.gophotoweb.com/u3610/2156/photos/53740/2000-marinasapega%20%20-853ebe2afa24da5b6b817b6dbc97f492.jpg -- same size
            return src.replace(/\/[0-9]+-((?:[^/]*-)?[a-f0-9]{20,}\.[^/.]*)$/, "/2000-$1");
        }

        if (domain.match(/img[0-9]*.feelway\.com/)) {
            // http://img016.feelway.com/3188/smallbd305pd3188424229ed1.jpg
            //   http://img016.feelway.com/3188/bd305pd3188424229ed1.jpg
            //   http://img016.feelway.com/goods_image/fpho_3188_bd305pd3188424229ed1/Amiri_%EB%B9%84%EB%B9%84%EC%95%84%EB%85%B8_17SSMDT01DST_%EB%94%94%EC%8A%A4%EB%8D%94%ED%8B%B0%EC%98%A4%EC%9D%BC_%EB%8D%B0%EB%8B%98%EC%9E%90%EC%BC%93_%EC%95%84%EB%AF%B8%EB%A6%AC_AM_1.jpg -- same size
            return src.replace(/(\/[0-9]+\/)small([^/]*)$/, "$1$2");
        }

        if (domain.match(/\.pichunter\.com/)) {
            // https://y2.pichunter.com/3550353_9_t.jpg
            //   https://y2.pichunter.com/3550353_9.jpg
            //   https://y2.pichunter.com/3550353_9_o.jpg
            return src.replace(/(:\/\/[^/]*\/[0-9]+_[0-9]+)(?:_[a-z])?(\.[^/.]*)$/, "$1_o$2");
        }

        if (domain === "appdb.winehq.org") {
            // https://appdb.winehq.org/appimage.php?iId=27878&bThumbnail=true
            //   https://appdb.winehq.org/appimage.php?iId=27878
            return src.replace(/(\/appimage\.php.*?)([?&])bThumbnail=[^&]*/, "$1$2").replace(/&$/, "");
        }

        if (domain.indexOf(".ikea.com") >= 0 &&
            src.indexOf("/images/") >= 0) {
            // https://www.ikea.com/us/en/images/products/gurli-throw-green__0587646_PE672711_S4.JPG
            //   https://www.ikea.com/us/en/images/products/gurli-throw-green__0587646_PE672711_S5.JPG
            // https://www.ikea.com/ie/en/images/homepage/ikea-april-news-at-ikea__1364530466290-s2.jpg
            //   https://www.ikea.com/ie/en/images/homepage/ikea-april-news-at-ikea__1364530466290-s5.jpg
            // doesn't work:
            // https://www.ikea.com/gb/en/images/gb-img-fy15/ikea-sofa-guarantee__1364342102206-s4.jpg
            //   https://www.ikea.com/gb/en/images/gb-img-fy15/ikea-sofa-guarantee__1364342102206-s5.jpg -- doesn't work
            return src.replace(/([-_][sS])[0-9](\.[^/.]*)/, "$15$2");
        }

        if (domain === "img.onestore.co.kr") {
            // http://img.onestore.co.kr/thumbnails/img_sac/0_423_F20_95/data6/android/201411/19/IF1423406830820110607140552/0000677987/img/preview/0000677987_DP000103.jpg
            //   http://img.onestore.co.kr/thumbnails/img_sac/0_0_100/data6/android/201411/19/IF1423406830820110607140552/0000677987/img/preview/0000677987_DP000103.jpg
            // http://img.onestore.co.kr/thumbnails/img_sac/182_182_F10_95/data6/android/201411/19/IF1423406830820110607140552/0000677987/img/original/0000677987_DP000101.png
            //   http://img.onestore.co.kr/thumbnails/img_sac/0_0_100/data6/android/201411/19/IF1423406830820110607140552/0000677987/img/original/0000677987_DP000101.png
            return src.replace(/\/[0-9]+_[0-9]+_(?:F[0-9]+_)?[0-9]+\//, "/0_0_100/");
        }

        if (domain.indexOf(".ismcdn.jp") >= 0) {
            // http://www.afpbb.com/articles/-/3171540
            //   http://afpbb.ismcdn.jp/mwimgs/3/4/320x280/img_34b67f980d17e0eeb91b850dedddbfcd64467.jpg - thumbnail
            //     http://afpbb.ismcdn.jp/mwimgs/3/4/full//img_34b67f980d17e0eeb91b850dedddbfcd64467.jpg
            //     http://afpbb.ismcdn.jp/mwimgs/3/4/-//img_34b67f980d17e0eeb91b850dedddbfcd64467.jpg -- same
            //     http://afpbb.ismcdn.jp/mwimgs/6/b/full//img_6b3d3ed08132ac948cb47d119a152aad174843.jpg -- much larger
            // http://dol.ismcdn.jp/mwimgs/3/8/670m/img_38ec77dc8d6e7438877c3cf39207e20a26382.jpg
            //   http://dol.ismcdn.jp/mwimgs/3/8/-/img_38ec77dc8d6e7438877c3cf39207e20a26382.jpg
            return src.replace(/\/[0-9]+[xm](?:[0-9]+)?(\/[^/]*)$/, "/-$1");
        }

        if (domain.indexOf(".yomiuri.co.jp") >= 0 && src.indexOf("/photo/") >= 0) {
            // http://sp.yomiuri.co.jp/photo/20161027/20161027-OYT8I50121-L.jpg (1003x2393)
            //   http://sp.yomiuri.co.jp/photo/20161027/20161027-OYT8I50121-1.jpg (209x500)
            // http://sp.yomiuri.co.jp/photo/20180418/20180418-OYT1I50024-T.jpg
            //   http://sp.yomiuri.co.jp/photo/20180418/20180418-OYT1I50024-L.jpg
            // http://www.yomiuri.co.jp/photo/20180417/20180417-OYT8I50039-N.jpg
            //   http://www.yomiuri.co.jp/photo/20180417/20180417-OYT8I50039-L.jpg
            return src.replace(/-[A-Z0-9](\.[^/.]*)$/, "-L$1");
        }

        if (domain.match(/c[0-9]*\.newswitch\.jp/)) {
            // https://c01.newswitch.jp/cover?url=http%3A%2F%2Fnewswitch.jp%2Fimg%2Fupload%2FphpG8O8Wr_585240ce5a647.JPG
            //   http://newswitch.jp/img/upload/phpG8O8Wr_585240ce5a647.JPG
            return decodeURIComponent(src.replace(/^[a-z]*:\/\/[^/]*\/cover.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "www.fashion-headline.com") {
            // https://www.fashion-headline.com/api/image/width/2000/images/migration/2015/01/a9201396f5dfc04a665e58a118f8f6cf.jpg
            //   https://www.fashion-headline.com/images/migration/2015/01/a9201396f5dfc04a665e58a118f8f6cf.jpg
            return src.replace(/\/api\/image\/(?:width|height)\/[0-9]+\//, "/");
        }

        if (domain.indexOf("cdnext.stream.ne.jp") >= 0) {
            // https://c799eb2b0cad47596bf7b1e050e83426.cdnext.stream.ne.jp/img/article/000/227/336/0f58889dfd526d5ad4588cf35b598b5320180417142350635_262_262.jpg
            //   https://c799eb2b0cad47596bf7b1e050e83426.cdnext.stream.ne.jp/img/article/000/227/336/0f58889dfd526d5ad4588cf35b598b5320180417142350635.jpg
            return src.replace(/(\/[0-9a-f]+)_[0-9]*_[0-9]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain.indexOf(".kn3.net") >= 0) {
            // https://k61.kn3.net/taringa/2/7/6/8/4/7/96/drporn/c_147x147_46D.jpg
            //   https://k61.kn3.net/taringa/2/7/6/8/4/7/96/drporn/46D.jpg
            // https://t3.kn3.net/taringa/8/C/A/1/F/5/Theylor-/92x70_213.jpg
            //   https://t3.kn3.net/taringa/8/C/A/1/F/5/Theylor-/213.jpg
            return src.replace(/\/(?:c_)?[0-9]+x[0-9]+_([0-9A-Z]*\.[^/.]*)$/, "/$1");
        }

        if (domain === "ptcdn.info" ||
            domain.indexOf(".ptcdn.info") >= 0) {
            // https://ptcdn.info/movies/2018/NDeXUJq0TD-1522146022_s.jpg
            //   https://ptcdn.info/movies/2018/NDeXUJq0TD-1522146022_o.jpg
            // https://f.ptcdn.info/406/056/000/p4x3357tsNw7rwRxtqs-s.jpg
            //   https://f.ptcdn.info/406/056/000/p4x3357tsNw7rwRxtqs-o.jpg
            // doesn't work with all:
            // https://ptcdn.info/pick/185/000/000/p7aa3c5czjptg1MsPPd-s.jpg
            //   https://pantip.com/topic/37569184
            //   https://f.ptcdn.info/118/057/000/p7aa3c5czjptg1MsPPd-o.jpg
            return src.replace(/([-_])[a-z](\.[^/.]*)$/, "$1o$2");
        }

        if (domain.indexOf(".pikabu.ru") >= 0) {
            // https://cs7.pikabu.ru/post_img/2018/04/17/4/1523941253189748852.jpg
            //   https://cs7.pikabu.ru/post_img/big/2018/04/17/4/1523941253189748852.jpg
            // doesn't work for all:
            // https://cs8.pikabu.ru/post_img/big/2016/10/28/8/147765812818422511.jpg
            return src.replace(/\/post_img\/([0-9]+)\//, "/post_img/big/$1/");
        }

        if (domain.indexOf("podium.life") >= 0) {
            // https://c.podium.life/content/r/80/photo/2409/2409496/533aaf0ded61d.jpg
            //   https://c.podium.life/content/photo/2409/2409496/533aaf0ded61d.jpg
            // https://c.podium.life/content/r/2/p/28765/8112/5a81580060110.jpg
            //   https://c.podium.life/content/p/28765/8112/5a81580060110.jpg
            return src.replace(/\/content\/r\/[wh]?[0-9]*(?:x[0-9]+)?\//, "/content/");
        }

        if (domain.indexOf(".filesor.com") >= 0) {
            // http://ist5-1.filesor.com/pimpandhost.com/1/_/_/_/1/5/S/b/y/5Sbyx/IE001955316_ORG_l.jpg
            //   http://ist5-1.filesor.com/pimpandhost.com/1/_/_/_/1/5/S/b/y/5Sbyx/IE001955316_ORG.jpg
            return src.replace(/_[a-z](\.[^/.]*)/, "$1");
        }

        if (domain_nowww === "namooactors.com") {
            // http://www.namooactors.com/data/file/nm3002/thumb_latest/latest_120X160_2072965477_kGZly3he_HB_CHA-PO4_7.jpg.jpg
            //   http://www.namooactors.com/data/file/nm3002/2072965477_kGZly3he_HB_CHA-PO4_7.jpg
            // http://www.namooactors.com/data/file/nm3402/thumb/list_175px_2072965478_ZIMqombp_13419267_1093373410756804_4684262674469315848_n__1_.jpg.jpg
            //   http://www.namooactors.com/data/file/nm3402/2072965478_ZIMqombp_13419267_1093373410756804_4684262674469315848_n__1_.jpg
            return src.replace(/\/thumb(?:_[^/]*)?\/[a-z]+_[0-9]+(?:px|X[0-9]+)_(.*?\.[^/.]*)\.[^/.]*$/, "/$1");
        }

        if (domain === "ftopx.com") {
            // https://ftopx.com/mini/201801/5a6b3a6bbc364.jpg
            //   https://ftopx.com/pic/1280x1024/201801/5a6b3a6bbc364.jpg
            //   https://ftopx.com/images/201801/ftopx.com_5a6b3a6bbc364.jpg
            // https://ftopx.com/mini/201709/59c718085fb87.jpg
            //   https://ftopx.com/images/201709/ftop.ru_59c718085fb87.jpg
            var timestamp = parseInt(src.replace(/.*[/_]([a-f0-9]{10,})\.[^/.]*$/, "$1"), 16);
            var prefix = "ftop.ru";
            if (timestamp > 1579484587755500)
                prefix = "ftopx.com";
            return src
                .replace(/\/(?:mini|large)\/([0-9]+)\/([^/]*)$/, "/images/$1/" + prefix + "_$2")
                .replace(/\/pic\/[0-9]+x[0-9]+\/([0-9]+)\/([^/]*)$/, "/images/$1/" + prefix + "_$2");
        }

        if (domain_nowww === "wykop.pl" && src.indexOf("/cdn/") >= 0) {
            // https://www.wykop.pl/cdn/c3201142/comment_N6Pmm34BPk025H5hqkRnulsYFT9SvVHc,w400.jpg
            //   https://www.wykop.pl/cdn/c3201142/comment_N6Pmm34BPk025H5hqkRnulsYFT9SvVHc.jpg
            // https://www.wykop.pl/cdn/c3397993/link_AtyRCGO0byZiykQx9SX8p0KO34BFHSoB,w113h64.jpg
            //   https://www.wykop.pl/cdn/c3397993/link_AtyRCGO0byZiykQx9SX8p0KO34BFHSoB.jpg
            return src.replace(/,[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "phoronix.net") {
            // https://www.phoronix.net/image.php?id=tomb-raider-20&image=tomb_vulkan_1_med
            // https://www.phoronix.net/image.php?id=tomb-raider-20&image=tomb_vulkan_4_med
            return src.replace(/(\/image\.php.*?[?&]image=[^&]*)_med/, "$1");
        }

        if (domain.match(/s[0-9]*\.booth\.pm/)) {
            // https://s2.booth.pm/c/c_300/57b9c1d2-83c2-43ca-8368-8caef0f77ecf/i/740855/ce009797-aea2-4084-a029-a766159fa233.jpg
            //   https://s2.booth.pm/c/c_300/57b9c1d2-83c2-43ca-8368-8caef0f77ecf/i/740855/ce009797-aea2-4084-a029-a766159fa233.jpg
            // https://s2.booth.pm/c/f_128/users/4030105/icon_image/2a5bf25c-cf1e-4aaa-a537-483ce0a7cbb7.jpg
            //   https://s2.booth.pm/users/4030105/icon_image/2a5bf25c-cf1e-4aaa-a537-483ce0a7cbb7.jpg
            // https://s2.booth.pm/7279e569-4081-41f9-9188-21d28fa637cc/i/674179/e994efb8-f8a2-45e9-9b5b-27815aec0abc_c_72x72.jpg
            //   https://s2.booth.pm/7279e569-4081-41f9-9188-21d28fa637cc/i/674179/e994efb8-f8a2-45e9-9b5b-27815aec0abc.jpg
            // doesn't work for all, some are ".JPG" in the end instead of ".jpg"
            newsrc = src
                .replace(/\/c\/[a-z]_[0-9]+\//, "/")
                .replace(/_c_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
            if (newsrc !== src) {
                if (newsrc.match(/\.jpg$/)) {
                    return [newsrc, newsrc.replace(/\.jpg$/, ".JPG")];
                }
                return newsrc;
            }
        }

        if (domain === "image.diyidan.net" && false) {
            // https://www.diyidan.com/main/post/6294360860111032652/detail/1
            //   https://image.diyidan.net/post/2017/11/19/bWeT79y7vwR4GETq.jpg!weblarge
            //   https://image.diyidan.net/post/2017/11/19/bWeT79y7vwR4GETq.jpg
            // https://image.diyidan.net/user/2017/11/6/OKw88SkGjXLjINKS.jpg!tiny
            // it requires either a redirect from that page, or no headers whatsoever
            return src.replace(/!.*/, "");
        }

        if (domain === "www.hrkgame.com" &&
            src.indexOf("/.thumbnails/") >= 0) {
            // https://www.hrkgame.com/media/screens/245280/.thumbnails/ss_1fd48fdc4cc57663dbc04e87e5f131076eac11d6.600x338.jpg/ss_1fd48fdc4cc57663dbc04e87e5f131076eac11d6.600x338-800x500.jpg
            //   https://www.hrkgame.com/media/screens/245280/ss_1fd48fdc4cc57663dbc04e87e5f131076eac11d6.600x338.jpg
            return src.replace(/\/\.thumbnails\/([^/]*)\/.*/, "/$1");
        }

        if (domain.indexOf("www.dlcompare.com" >= 0) &&
            src.indexOf("/upload/cache/") >= 0) {
            // http://www.dlcompare.com/upload/cache/game_screenshot/img/enslaved-odyssey-to-the-west-screenshot-2.jpg
            //   http://www.dlcompare.com/upload/cache/slider/img/enslaved-odyssey-to-the-west-screenshot-2.jpg
            //   http://www.dlcompare.com:8042/img/enslaved-odyssey-to-the-west-img-4.jpg
            // http://www.dlcompare.com/upload/cache/slider/upload/gameimage/file/36257.jpeg - 3840x2160
            //   http://www.dlcompare.com/upload/gameimage/file/36257.jpeg -- same size
            // http://www.dlcompare.com/upload/cache/game_widget/upload/gameimage/file/21574.jpeg
            //   http://www.dlcompare.com/upload/gameimage/file/21574.jpeg
            //   http://www.dlcompare.com:8042/upload/gameimage/file/21575.jpeg -- much bigger
            return src.replace(/\/upload\/cache\/[^/]*\//, "/");
            /*newsrc = src.replace(/\/upload\/cache\/[^/]*\/upload\//, "/upload/");
            if (newsrc !== src)
                return newsrc;
            return src.replace(/\/upload\/cache\/[^/]*\//, "/upload/cache/slider/");*/
        }

        if (domain.match(/images[0-9]*\.alphacoders\.com/) ||
            domain === "artfiles.alphacoders.com" ||
            domain === "picfiles.alphacoders.com") {
            // https://images2.alphacoders.com/728/thumb-350-728780.jpg
            //   https://images2.alphacoders.com/728/728780.jpg
            // https://artfiles.alphacoders.com/741/thumb-74141.jpg
            //   https://artfiles.alphacoders.com/741/74141.jpg
            // https://picfiles.alphacoders.com/172/thumb-172338.jpg
            return src.replace(/\/thumb(?:-[0-9]*)?-([0-9]*\.[^/.]*)$/, "/$1");
        }

        if (domain === "gpstatic.com") {
            // https://gpstatic.com/acache/11/67/1/uk/s2_thumb-c5e9b414fd43a81842692da09938a394.jpg
            //   https://gpstatic.com/acache/11/67/1/uk/s2-c5e9b414fd43a81842692da09938a394.jpg
            return src.replace(/\/(s[0-9]*)_thumb(-[a-f0-9]*\.[^/.]*)$/, "/$1$2");
        }

        if (domain_nowww === "walldevil.com") {
            // https://www.walldevil.com/wallpapers/a81/thumb/enslaved-enslaved-odyssey-to-the-west.jpg
            //   https://www.walldevil.com/wallpapers/a81/enslaved-enslaved-odyssey-to-the-west.jpg
            return src.replace(/\/thumb\//, "/");
        }

        if (domain === "www.peency.com" &&
            src.indexOf("/images/") >= 0) {
            // http://www.peency.com/images/2016/09/28/6b7af02546a41cd54_full.png
            //   http://www.peency.com/images/2016/09/28/6b7af02546a41cd54.png
            // http://www.peency.com/images/2014/10/21/jessica-alba-hot-photoshoot-wallpaper-2560x1440_240x200.jpg
            //   http://www.peency.com/images/2014/10/21/jessica-alba-hot-photoshoot-wallpaper-2560x1440.jpg
            return src.replace(/_[^/._]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.wallpaperbetter.com" &&
            src.indexOf("/wallpaper/") >= 0) {
            // http://www.wallpaperbetter.com/wallpaper/659/286/567/sergey-fat-1080P-wallpaper-thumb.jpg
            //   http://www.wallpaperbetter.com/wallpaper/659/286/567/sergey-fat-1080P-wallpaper-middle-size.jpg
            //   http://www.wallpaperbetter.com/wallpaper/659/286/567/sergey-fat-1080P-wallpaper.jpg
            return src.replace(/-(?:thumb|middle-size)(\.[^/.]*)$/, "$1");
        }

        if (domain === "thiswallpaper.com" &&
            src.indexOf("/cdn/") >= 0) {
            // https://thiswallpaper.com/cdn/thumb/796/amazing%20rihanna%20full%20screen%20image.jpg
            //   https://thiswallpaper.com/cdn/hdwallpapers/796/amazing%20rihanna%20full%20screen%20image.jpg
            return src.replace("/cdn/thumb/", "/cdn/hdwallpapers/");
        }

        if (domain === "booklikes.com" &&
            src.indexOf("/upload/") >= 0) {
            // http://booklikes.com/photo/max/600/0/upload/post/a/8/azure_a8af8e2f197da5d3c84dbec44eb0ffed.jpg
            //   http://booklikes.com/upload/post/a/8/azure_a8af8e2f197da5d3c84dbec44eb0ffed.jpg
            return src.replace(/\/photo\/max\/[0-9]*\/[0-9]*\//, "/");
        }

        if (domain === "hdwallsource.com" &&
            src.indexOf("/img/") >= 0) {
            // https://hdwallsource.com/img/2016/6/thumb/jamie-bell-actor-wallpaper-background-hd-55539-57284-hd-wallpapers-thumb.jpg
            //   https://hdwallsource.com/img/2016/6/jamie-bell-actor-wallpaper-background-hd-55539-57284-hd-wallpapers.jpg
            return src.replace(/\/thumb\/([^/.]*)-thumb(\.[^/.]*)/, "/$1$2");
        }

        if (domain === "www.customity.com" &&
            src.indexOf("/storage/public/") >= 0) {
            // http://www.customity.com/storage/public/imagecache/0100x0100/image/wallpaper/201007/507-charlize-theron-wallpaper-1600x1200-customity.jpg
            //   http://www.customity.com/storage/public/image/wallpaper/201007/507-charlize-theron-wallpaper-1600x1200-customity.jpg
            return src.replace(/\/imagecache\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain === "www.desktopimages.org" &&
            src.indexOf("/pictures/") >= 0) {
            // http://www.desktopimages.org/pictures/2015/0713/1/th1_144184.jpg
            //   http://www.desktopimages.org/pictures/2015/0713/1/apple-os-x-el-capitans-wallpaper-144184.jpg
            //   http://www.desktopimages.org/pictures/2015/0713/1/orig_144184.jpg
            return src.replace(/\/[^/]*[-_]([0-9]+\.[^/.]*)$/, "/orig_$1");
        }

        if (domain === "www.bikerpunks.com" &&
            src.indexOf("/media/") >= 0) {
            // https://www.bikerpunks.com/media/thumbs/79687f0c3d11.jpg
            //   https://www.bikerpunks.com/media/largethumbs/79687f0c3d11.jpg
            //   https://www.bikerpunks.com/media/79687f0c3d11.jpg
            // doesn't work for all:
            // https://www.bikerpunks.com/media/thumbs/6c6820f9fb17.jpg
            //   https://www.bikerpunks.com/media/gallery/061e37dea07d99618dba00438d5f87ff.jpg
            return src.replace(/\/media\/[^/]*\/([0-9a-f]*\.[^/.]*)$/, "/media/$1");
        }

        if (domain.match(/i[a-z]*\.pics\.livejournal\.com/)) {
            // https://i.pics.livejournal.com/babymelaw/34311960/10819/10819_900.jpg
            //   https://i.pics.livejournal.com/babymelaw/34311960/10819/10819_original.jpg
            // https://ic.pics.livejournal.com/babymelaw/34311960/10819/10819_900.jpg
            //   https://ic.pics.livejournal.com/babymelaw/34311960/10819/10819_original.jpg
            return src.replace(/_[0-9]*(\.[^/.]*)$/, "_original$1");
        }

        if (domain === "img-fotki.yandex.ru") {
            // http://img-fotki.yandex.ru/get/4606/142895192.a/0_6776c_3e548a9d_XL.gif
            //   http://img-fotki.yandex.ru/get/4606/142895192.a/0_6776c_3e548a9d_orig.gif
            // http://img-fotki.yandex.ru/get/4606/142895192.a/0_6776c_3e548a9d_XL
            //   http://img-fotki.yandex.ru/get/4606/142895192.a/0_6776c_3e548a9d_orig
            return src.replace(/_[^-/._]*(\.[^/.]*)?$/, "_orig$1");
        }

        if (domain_nosub === "steemitimages.com") {
            // deprecated, it's returning hashed urls now
            // https://steemitimages.com/0x0/https://steemitimages.com/DQmUXTDZ82P2K8iK1naLZETucmAcz7W9vvReEbTi5osSh4U/quantstamp_network-1.png
            //   https://steemitimages.com/DQmUXTDZ82P2K8iK1naLZETucmAcz7W9vvReEbTi5osSh4U/quantstamp_network-1.png
            // https://cdn.steemitimages.com/0x0/https://i.redd.it/satbsuymrzwz.jpg
            //   https://i.redd.it/satbsuymrzwz.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+x[0-9]+\//, "");
        }

        if (domain.match(/steemit-production-imageproxy-[^-.]*\.s3\.amazonaws\.com/)) {
            // doesn't work in all cases? private images maybe?
            // https://steemit-production-imageproxy-thumbnail.s3.amazonaws.com/DQmUXTDZ82P2K8iK1naLZETucmAcz7W9vvReEbTi5osSh4U_1680x8400
            //   https://steemit-production-imageproxy-upload.s3.amazonaws.com/DQmUXTDZ82P2K8iK1naLZETucmAcz7W9vvReEbTi5osSh4U
            return src.replace(/-imageproxy-thumbnail\.([^/]*\/[A-Za-z0-9]*)_[0-9]+x[0-9]+$/, "-imageproxy-upload.$1");
        }

        if (domain === "newsprom.ru") {
            // http://newsprom.ru/i/n/913/237913/237913_b78a299e453f.jpg
            //   http://newsprom.ru/i/n/913/237913/tn_237913_b78a299e453f.jpg
            return src.replace(/\/([0-9]+_[a-f0-9]+\.[^/.]*)$/, "/tn_$1");
        }

        if (domain.match(/i[0-9]*\.fotocdn\.net/)) {
            // https://i07.fotocdn.net/s26/177/user_m/279/2643400368.jpg
            //   https://i07.fotocdn.net/s26/177/user_xl/279/2643400368.jpg
            // https://i10.fotocdn.net/s11/185/gallery_m/239/2308894392.jpg
            // https://i03.fotocdn.net/s28/142/user_l/328/2680637325.jpg
            // https://i01.fotocdn.net/s13/206/gallery_m/79/2370850509.jpg
            // https://i03.fotocdn.net/s10/119/public_pin_l/473/2467682422.jpg -- don't believe there's a public_pin_xl
            regex = /_[a-z]+(\/[0-9]+\/[0-9]+\.[^/.]*)$/;
            return [
                src.replace(regex, "_xl$1"),
                src.replace(regex, "_l$1")
            ];
        }

        if (domain_nowww === "news-people.fr" &&
            src.indexOf("/galerie/") >= 0) {
            // http://www.news-people.fr/galerie/731658/2.jpg
            //   http://www.news-people.fr/galerie/731658/2_hd.jpg
            return src.replace(/\/([0-9]*)(\.[^/.]*)$/, "/$1_hd$2");
        }

        if (domain.indexOf(".cdn107.com") >= 0) {
            // http://album2.cdn107.com/70/4d/704d6c866c741cced6136951968c51a1_sm.jpg
            //   http://album2.cdn107.com/70/4d/704d6c866c741cced6136951968c51a1.jpg
            // http://artist1.cdn107.com/16a/16a9b15e1220b200bb67f5fb4a46004c_lg.jpg
            //   http://artist1.cdn107.com/16a/16a9b15e1220b200bb67f5fb4a46004c.jpg
            return src.replace(/_[a-z]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "hairstyles.thehairstyler.com") {
            // https://hairstyles.thehairstyler.com/hairstyle_views/front_view_images/12346/icon/short-straight-hairstyle.jpg
            //   https://hairstyles.thehairstyler.com/hairstyle_views/front_view_images/12346/original/short-straight-hairstyle.jpg
            // https://hairstyles.thehairstyler.com/hairstyles/images/20324/tiny/short-straight-hairstyle-with-bangs.jpg
            //   https://hairstyles.thehairstyler.com/hairstyles/images/20324/original/short-straight-hairstyle-with-bangs.jpg
            // https://hairstyles.thehairstyler.com/hairstyles/images/20353/thumb/short-blonde-asymmetrical-hairstyle.jpg
            //   https://hairstyles.thehairstyler.com/hairstyles/images/20353/thumb/short-blonde-asymmetrical-hairstyle.jpg
            return src.replace(/(\/[0-9]*\/)[^/]*\/([^/]*)$/, "$1original/$2");
        }

        if (domain_nowww === "abload.de") {
            // http://www.abload.de/thumb/celebrity-paradise.coxdc2s.jpg
            //   http://www.abload.de/img/celebrity-paradise.coxdc2s.jpg
            return src.replace(/\/thumb\//, "/img/");
        }

        if (domain === "assets.capitalfm.com" ||
            domain === "assets.gcstatic.com") {
            // https://assets.capitalfm.com/2018/15/sprite-cucumber-1524239960-list-tablet-0.png
            //   https://assets.capitalfm.com/2018/15/sprite-cucumber-1524239960-herowidev4-0.png
            //   https://assets.capitalfm.com/2018/15/sprite-cucumber-1524239960.png
            // http://assets.gcstatic.com/u/apps/asset_manager/uploaded/2017/17/victorious--1493385031-custom-0.jpg
            //   http://assets.gcstatic.com/u/apps/asset_manager/uploaded/2017/17/victorious--1493385031.jpg
            // https://assets.capitalfm.com/2017/17/victorious-1493385935-herowidev4-0.jpg
            //   https://assets.capitalfm.com/2017/17/victorious-1493385935.jpg
            return src.replace(/(\/[^/]*-[0-9]{8,})-[^/]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.leathercelebrities.com") {
            // doesn't work
            // http://www.leathercelebrities.com/images/resized/victoria-justice-attends-lmdm-grand-opening-party-300x450.jpg
            //   http://www.leathercelebrities.com/images/uploads/Victoria-Justice-attends-LMDM-Grand005.jpg
            // http://www.leathercelebrities.com/images/uploads/21621/victoria_justice_attends_lmdm_grand002__thumb.jpg
            //   http://www.leathercelebrities.com/images/uploads/21621/victoria_justice_attends_lmdm_grand002.jpg
            return src.replace(/(\/uploads\/[0-9]*\/[^/]*)__thumb(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.cache.vevo.com") {
            // https://img.cache.vevo.com/thumb/cms/6adeb8f9fb65d67e94044181f4e102c6/281x159.jpg
            //   https://img.cache.vevo.com/thumb/cms/6adeb8f9fb65d67e94044181f4e102c6.jpg
            // https://img.cache.vevo.com/thumb/artist/victoria-justice/220x220.jpeg
            //   https://img.cache.vevo.com/thumb/artist/victoria-justice.jpeg
            return src.replace(/(\/thumb\/[^/]*\/[^/]*)\/[0-9]+x[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.superiorpics.com") {
            // http://www.superiorpics.com/pictures2/thumb168/1TeenChoRD2028754.jpg
            //   http://www.superiorpics.com/pictures2/1TeenChoRD2028754.jpg
            return src.replace(/\/thumb[0-9]+\//, "/");
        }

        if (domain === "www.celebjihad.com") {
            // https://www.celebjihad.com/celeb-jihad/harlots/victoria_justice38/t_victoria_justice1.jpg
            //   https://www.celebjihad.com/celeb-jihad/harlots/victoria_justice38/victoria_justice1.jpg
            return src.replace(/\/t_([^/]*)$/, "/$1");
        }

        if (domain === "www.looktothestars.org" &&
            src.indexOf("/photo/") >= 0 && false) {
            // https://www.looktothestars.org/photo/6950-victoria-justice-fronts-psa/story_wide.jpg
            //   https://www.looktothestars.org/photo/6950-victoria-justice-fronts-psa/large.jpg
            // https://www.looktothestars.org/photo/3-george-clooney/small_square-1503121378.jpg
            //   https://www.looktothestars.org/photo/3-george-clooney/large.jpg -- stretched
            return src.replace(/\/[^/]*(\.[^/.]*)$/, "/large$1");
        }

        if (domain === "cdn.teamcococdn.com") {
            // http://cdn.teamcococdn.com/image/1000x1000,scale:none/victoria-justice-54ed2693b4bf1.jpg -- stretched
            //   http://cdn.teamcococdn.com/file/victoria-justice-54ed2693b4bf1.jpg
            return src.replace(/\/image\/[^/]*\//, "/file/");
        }

        if ((domain.indexOf(".staticflickr.com") >= 0 ||
             domain.indexOf(".static.flickr.com") >= 0) &&
            src.match(/\/[0-9]+_[0-9a-f]+(?:_[a-z]*)?\.[^/.]*$/) &&
            !src.match(/\/[0-9]+_[0-9a-f]+_o\.[^/.]*$/) &&
            options && options.do_request && options.cb) {
            // https://c1.staticflickr.com/5/4190/34341416210_29e6098b30.jpg
            //   https://farm5.staticflickr.com/4190/34341416210_9f14cc1576_o.jpg
            // https://farm5.static.flickr.com/4157/34467046051_631ea7efa7_b.jpg
            //   https://farm5.staticflickr.com/4157/34467046051_9b6f0e9a7c_o.jpg
            // http://farm8.staticflickr.com/7034/6693295971_22e55a1b42_z.jpg%3C/br%3E
            //   https://farm8.staticflickr.com/7034/6693295971_36acecc53b_o.jpg
            src = src.replace(/(:\/\/[^/]*\/(?:[0-9]+\/)?[0-9]+\/[0-9]+_[0-9a-f]+(?:_[a-z])?\.[a-zA-Z0-9]*).*$/, "$1");
            options.do_request({
                url: "https://www.flickr.com/",
                method: "GET",
                headers: {
                    "Origin": "",
                    "Referer": "",
                    "Cookie": ""
                },
                onload: function(resp) {
                    if (resp.readyState === 4) {
                        var regex = /root\.YUI_config\.flickr\.api\.site_key *= *['"]([^'"]*)['"] *; */;
                        var matchobj = resp.responseText.match(regex);
                        if (!matchobj) {
                            cb(null);
                            return;
                        }

                        var key = matchobj[1];
                        var photoid = src.replace(/.*\/([0-9]+)_[^/]*$/, "$1");
                        var nexturl = "https://api.flickr.com/services/rest?csrf=&api_key=" + key + "&format=json&nojsoncallback=1&method=flickr.photos.getSizes&photo_id=" + photoid;
                        options.do_request({
                            url: nexturl,
                            method: "GET",
                            headers: {
                                "Origin": "",
                                "Referer": "",
                                "Cookie": ""
                            },
                            onload: function(resp) {
                                try {
                                    var out = JSON.parse(resp.responseText);
                                    var largesturl = null;
                                    var largestsize = 0;
                                    out.sizes.size.forEach((size) => {
                                        var currentsize = parseInt(size.width) * parseInt(size.height);
                                        if (currentsize > largestsize) {
                                            largestsize = currentsize;
                                            largesturl = size.source;
                                        }
                                    });
                                    options.cb(largesturl);
                                    return;
                                } catch (e) {
                                    options.cb(null);
                                    return;
                                }
                            }
                        });
                    }
                }
            });

            return {
                "waiting": true
            };
        }

        if (domain === "www.imagozone.com") {
            // http://www.imagozone.com/var/resizes/vedete/Victoria%20Justice/Victoria%20Justice%203012.jpg
            //   http://www.imagozone.com/var/albums/vedete/Victoria%20Justice/Victoria%20Justice%203012.jpg
            // http://www.imagozone.com/var/thumbs/vedete/Amber%20Heard/Amber%20Heard%20005.jpg?m=1312958883
            //   http://www.imagozone.com/var/albums/vedete/Amber%20Heard/Amber%20Heard%20005.jpg?m=1312958883
            // doesn't work:
            // http://www.imagozone.com/var/thumbs/vedete/Amber%20Heard/2007/.album.jpg?m=1312542209
            if (!src.match(/\/\.album\.[^/.]*$/))
                return src.replace(/\/var\/(?:resizes|thumbs)\//, "/var/albums/");
        }

        if (domain_nosub === "tunes.zone") {
            // http://ru.tunes.zone/poster/person/230x230/29/22/72/0/292272-fotografii-iz-victoria-justice.jpg
            //   http://tunes.zone/poster/person/full/29/22/72/0/292272-fotografii-iz-victoria-justice.jpg
            // http://ru.tunes.zone/poster/banner/400x250o/15/84/57/9/1584579/19572-spider-man-homecoming.jpg
            // doesn't work for all:
            // http://ru.tunes.zone/poster/person/100x100/29/22/68/0/292268-fotografii-iz-victoria-justice-4.jpg
            //   http://ru.tunes.zone/poster/person/full/29/22/68/0/292268-fotografii-iz-4.jpg
            // http://tunes.zone/poster/person/100x100/57/48/0/0/5748-photos-with-galia-albin-1.jpg
            //   http://tunes.zone/poster/person/full/57/48/0/0/5748-photos-with-1.jpg
            // http://es.tunes.zone/poster/person/full/33/52/63/0/335263-las-fotografias-de-2.jpg
            var basic = src.replace(/\/[0-9]+x[0-9]+[a-z]?\//, "/full/");
            if (basic !== src) {
                var other = basic.replace(/-[a-z]+-[a-z]+(-[0-9]+)?(\.[^/.]*)$/, "$1$2");
                if (basic.match(/-[0-9]+\.[^/.]*$/))
                    return [other, basic];
                else
                    return [basic, other];
            }
        }

        if (domain === "sf.co.ua") {
            // http://sf.co.ua/16/12/tn-4358.jpg
            //   http://sf.co.ua/16/12/wallpaper-4358.jpg
            return src.replace(/\/tn-([0-9]*\.[^/.]*)/, "/wallpaper-$1");
        }

        if (domain.match(/^s[^.]*.zerochan.net/)) {
            // https://s3.zerochan.net/IA.240.878867.jpg
            //   https://static.zerochan.net/IA.240.878867.jpg
            //   https://static.zerochan.net/IA.full.878867.jpg
            // https://static.zerochan.net/Kirigaya.Kazuto.600.1450176.jpg
            //   https://static.zerochan.net/Kirigaya.Kazuto.full.1450176.jpg
            return src
                .replace(/:\/\/s[^.]*.zerochan.net\//, "://static.zerochan.net/")
                .replace(/(:\/\/[^/]*\/[^/]*\.)[0-9]+(\.[0-9]+\.[^/.]*)$/, "$1full$2");
        }

        if (domain.indexOf(".donmai.us") >= 0) {
            // https://hijiribe.donmai.us/data/sample/__nishimori_yusa_otosaka_ayumi_and_tomori_nao_charlotte_anime_and_newtype_drawn_by_higashiji_kazuki_inoue_katsue_kato_chie_satou_youko_sekiguchi_kanami_and_sugawara_mika__sample-5bae8d2a395e9b9b9f9f803a8c3eb4b1.jpg
            //   https://hijiribe.donmai.us/data/__nishimori_yusa_otosaka_ayumi_and_tomori_nao_charlotte_anime_and_newtype_drawn_by_higashiji_kazuki_inoue_katsue_kato_chie_satou_youko_sekiguchi_kanami_and_sugawara_mika__5bae8d2a395e9b9b9f9f803a8c3eb4b1.jpg
            return src.replace(/\/data\/sample\/([^/]*__)sample-([0-9a-f]*\.[^/.]*)$/, "/data/$1$2");
        }

        if (domain === "cdn.vor.us") {
            // https://cdn.vor.us/event/350763/thumbsm/458aa4c3a2c74b409282dd83a36cbf25.image!jpeg.9752676.jpg._Z5J5526.jpg
            //   https://cdn.vor.us/event/350763/og/458aa4c3a2c74b409282dd83a36cbf25.image!jpeg.9752676.jpg._Z5J5526.jpg
            // https://cdn.vor.us/event/350763/thumbsm/0aa7913a692d4f97b1a549660eb80eba.image!jpeg.16170343.jpg._Z5J4082.jpg
            //   https://cdn.vor.us/event/350763/og/0aa7913a692d4f97b1a549660eb80eba.image!jpeg.16170343.jpg._Z5J4082.jpg
            return src.replace(/\/thumbs[a-z]?\//, "/og/");
        }

        if (domain === "wallpapers.wallhaven.cc") {
            // https://wallpapers.wallhaven.cc/wallpapers/thumb/small/th-68352.jpg
            //   https://wallpapers.wallhaven.cc/wallpapers/full/wallhaven-68352.jpg
            return src.replace(/\/thumb\/[^/]*\/th-/, "/full/wallhaven-");
        }

        if (domain === "cdn.animenewsnetwork.com") {
            // https://cdn.animenewsnetwork.com/thumbnails/max350x1000/cms/interview/40076/keyart.jpg.jpg
            //   https://cdn.animenewsnetwork.com/thumbnails/hotlink-full/cms/interview/40076/keyart.jpg.jpg
            return src.replace(/\/thumbnails\/[^/]*\//, "/thumbnails/hotlink-full/");
        }

        if (domain === "digitalart.io" &&
            src.indexOf("/storage/") >= 0) {
            // https://digitalart.io/storage/artworks/1301/h250_anime_protagonist-wide.jpeg
            //   https://digitalart.io/storage/artworks/1301/anime_protagonist-wide.jpeg
            // https://digitalart.io/storage/artworks/709/h250_Asuka-Langley-Neon-Genesis-Evangelist-Wallpaper.jpeg
            //   https://digitalart.io/storage/artworks/709/Asuka-Langley-Neon-Genesis-Evangelist-Wallpaper.jpeg
            return src.replace(/(\/[0-9]*\/)[wh][0-9]+_([^/]*)$/, "$1$2");
        }

        if (domain === "4everstatic.com" ||
            domain === "pictures.4ever.eu") {
            // still has logo though
            // http://4everstatic.com/pictures/850xX/cartoons/anime-and-fantasy/anime-girl,-red-dress,-river-218133.jpg
            //   http://4everstatic.com/pictures/cartoons/anime-and-fantasy/anime-girl,-red-dress,-river-218133.jpg
            //   http://pictures.4ever.eu/data/download/cartoons/anime-and-fantasy/anime-girl,-red-dress,-river-218133.jpg?no-logo
            return src.replace(/\/pictures\/[0-9X]+x[0-9X]+\//, "/pictures/");

            // removes the logo, but forces download
            //return src.replace(/:\/\/4everstatic\.com\/pictures\/(?:[0-9X]+x[0-9X]+\/)?([^?]*).*?$/, "://pictures.4ever.eu/data/download/$1?no-logo");
        }

        if (domain_nowww === "tapeciarnia.pl") {
            // https://tapeciarnia.pl/tapety/srednie/264402_dziewczyna_manga_anime.jpg
            //   https://tapeciarnia.pl/tapety/normalne/264402_dziewczyna_manga_anime.jpg
            return src.replace(/\/tapety\/[^/]*\//, "/tapety/normalne/");
        }

        if (domain === "files.yande.re") {
            // https://files.yande.re/sample/c3e3fd1d97b4e237e996e6b1bfafa4e6/yande.re%20190111%20sample%20anime_tenchou%20anizawa_meito%20cosplay%20hiiragi_kagami%20izumi_konata%20kusakabe_misao%20lucky_star%20seifuku%20sword%20takara_miyuki%20thighhighs%20vocaloid.jpg
            //   https://files.yande.re/image/c3e3fd1d97b4e237e996e6b1bfafa4e6/yande.re%20190111%20anime_tenchou%20anizawa_meito%20cosplay%20hiiragi_kagami%20izumi_konata%20kusakabe_misao%20lucky_star%20seifuku%20sword%20takara_miyuki%20thighhighs%20vocaloid.jpg
            return src
                .replace(/\/sample\//, "/image/");
        }

        if (domain === "assets.yande.re") {
            // https://assets.yande.re/data/preview/5c/0d/5c0dce008b820e531309e54a17c83f3a.jpg
            //   https://files.yande.re/image/5c0dce008b820e531309e54a17c83f3a.jpg
            return src.replace(/:\/\/assets.yande.re\/data\/preview\/[0-9a-f]+\/[0-9a-f]+\//, "://files.yande.re/image/");
        }

        if (domain_nowww === "zastavki.com") {
            // http://zastavki.com/pictures/640x480/2015/Anime_Picnic_on_the_lawn__anime_Klannad_102412_29.jpg
            //   http://zastavki.com/pictures/originals/2015/Anime_Picnic_on_the_lawn__anime_Klannad_102412_.jpg
            // http://www.zastavki.com/pictures/286x180/2015/Anime_Yuki_Asuna_smiles_092918_32.jpg
            //   http://www.zastavki.com/pictures/originals/2015/Anime_Yuki_Asuna_smiles_092918_.jpg
            // http://www.zastavki.com/pictures/640x480/2018Animals___Dogs_A_little_funny_puppy_with_his_tongue_hanging_out_122826_29.jpg
            //   http://www.zastavki.com/pictures/originals/2018Animals___Dogs_A_little_funny_puppy_with_his_tongue_hanging_out_122826_.jpg
            return src.replace(/\/pictures\/[0-9]+x[0-9]+\/(.*_[0-9]+)_[0-9]+(\.[^/.]*)$/, "/pictures/originals/$1_$2");
        }

        if (domain.match(/w[0-9]*\.wallls.com/)) {
            // http://w4.wallls.com/uploads/high-thumbnail/201702/01/121462.jpg
            //   http://w4.wallls.com/uploads/original/201702/01/wallls.com_121462.jpg
            // http://w4.wallls.com/uploads/thumbnail/201711/21/157267.jpg
            //   http://w4.wallls.com/uploads/original/201711/21/wallls.com_157267.jpg
            return src.replace(/\/uploads\/[^/]*\/([0-9]*\/[0-9]*\/)([0-9]*\.[^/.]*)$/, "/uploads/original/$1wallls.com_$2");
        }

        if (domain === "www.wallpaperflare.com" &&
            src.indexOf("/static/") >= 0) {
            // https://www.wallpaperflare.com/static/786/500/37/girl-anime-automaton-guns-wallpaper-preview.jpg
            //   https://www.wallpaperflare.com/static/786/500/37/girl-anime-automaton-guns-wallpaper.jpg
            return src.replace(/-preview(\.[^/.]*)$/, "$1");
        }

        if (domain === "content.hardtunes.com") {
            // https://content.hardtunes.com/albums/6541/6815/248x248.jpg
            //   https://content.hardtunes.com/albums/6541/6815/original.jpg
            return src.replace(/\/[0-9]+x[0-9]+(\.[^/.]*)$/, "/original$1");
        }

        if (domain_nowww === "4kw.in" &&
            src.indexOf("/Wallpapers/") >= 0) {
            // http://4kw.in/Wallpapers/Beautiful-anime-girl-4k-3840x21601.jpg
            //   http://www.4kw.in/Wallpapers/Beautiful-anime-girl-4k-3840x2160.jpg
            // http://4kw.in/Wallpapers/Anime-girl-ice-cream-desert-4k1.jpg
            //   http://4kw.in/Wallpapers/Anime-girl-ice-cream-desert-4k.jpg
            return src.replace(/1(\.[^/.]*)$/, "$1");
        }

        if (domain === "imgs-art-dragoart-386112.c.cdn77.org") {
            // https://imgs-art-dragoart-386112.c.cdn77.org/anime-girl-running-into-the-light_1_000000074972_4.jpg
            //   https://imgs-art-dragoart-386112.c.cdn77.org/anime-girl-running-into-the-light_1_000000074972_1.jpg
            return src.replace(/_[0-9]*(\.[^/.]*)$/, "_1$1");
        }

        if (domain.match(/archive-media-[0-9]*\.nyafuu\.org/)) {
            // https://archive-media-0.nyafuu.org/w/thumb/1524/41/1524414969310s.jpg
            //   https://archive-media-0.nyafuu.org/w/image/1524/41/1524414969310.jpg
            // doesn't work for all:
            // https://archive-media-0.nyafuu.org/w/thumb/1490/20/1490207933485s.jpg
            //   https://archive-media-0.nyafuu.org/w/image/1490/20/1490207933485.png
            return src
                .replace(/:\/\/archive-media-[0-9]*\./, "://archive-media-0.")
                .replace(/\/thumb\//, "/image/")
                .replace(/(\/[0-9]*)[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain.match(/s[0-9]*\.hulkshare\.com/)) {
            // http://s0.hulkshare.com//artists/180/c/3/6/c361bc7b2c033a83d663b8d9fb4be56e.jpg?dd=1513632152
            //   http://s0.hulkshare.com//artists/original/c/3/6/c361bc7b2c033a83d663b8d9fb4be56e.jpg?dd=1513632152
            // http://s3.hulkshare.com/song_images/120/a/3/4/a342dfe999a823948f4472afed3ecc74.jpg?dd=1405601334
            //   http://s3.hulkshare.com/song_images/original/a/3/4/a342dfe999a823948f4472afed3ecc74.jpg?dd=1405601334
            return src.replace(/\/[0-9]*\/([0-9a-f]\/[0-9a-f]\/[0-9a-f]\/[0-9a-f]*\.[^/.]*)$/, "/original/$1");
        }

        if (domain.match(/static\.[^.]*\.zumst\.com/)) {
            // http://static.news.zumst.com/images/thumb/18/2018/04/17/a9f0d24d1aa64b9f868a5743640e8de8.jpg
            //   http://static.news.zumst.com/images/18/2018/04/17/a9f0d24d1aa64b9f868a5743640e8de8.jpg
            return src.replace("/thumb/", "/");
        }

        if (domain_nowww === "wikihow.com" &&
            src.indexOf("/images/") >= 0) {
            // https://www.wikihow.com/images/thumb/b/ba/Roll-Sod-Step-14-Version-3.jpg/aid1391676-v4-728px-Roll-Sod-Step-14-Version-3.jpg
            //   https://www.wikihow.com/images/b/ba/Roll-Sod-Step-14-Version-3.jpg
            return src.replace(/\/thumb\/(.*?\.[^/.]*)(?:\/.*)/, "/$1");
        }

        if ((domain.indexOf(".kakaocdn.net") >= 0 ||
             domain.indexOf(".kakao.co.kr") >= 0) && false) {
            // https://dn-s-story.kakaocdn.net/dn/Qqfey/hytef1ArTx/qZmOLz8iP9oj5eZDEQEbDk/img_m.jpg?width=650&height=975&avg=%2523817f77&v=2
            //   http://dn-s-story.kakao.co.kr/dn/Qqfey/hytef1ArTx/qZmOLz8iP9oj5eZDEQEbDk/img_m.jpg
            //   https://dn-xl0-story.kakaocdn.net/dn/Qqfey/hytef1ArTx/qZmOLz8iP9oj5eZDEQEbDk/img_xl.jpg?width=650&height=975&avg=%2523817f77&v=2
            //   http://dn-s-story.kakao.co.kr/dn/Qqfey/hytef1ArTx/qZmOLz8iP9oj5eZDEQEbDk/img.jpg
            // http://dn-l1-story.kakao.co.kr/dn/bpU40i/hyglUiBxbK/TgKflthO9wKjHf1TemKnx0/img_l.jpg?width=1446&height=1920
            //   http://dn-l1-story.kakao.co.kr/dn/bpU40i/hyglUiBxbK/TgKflthO9wKjHf1TemKnx0/img_l.jpg
            //   http://dn-l1-story.kakao.co.kr/dn/bpU40i/hyglUiBxbK/TgKflthO9wKjHf1TemKnx0/img_xl.jpg -- stretched?
            //   http://dn-l1-story.kakao.co.kr/dn/bpU40i/hyglUiBxbK/TgKflthO9wKjHf1TemKnx0/img.jpg -- 404
        }

        if (domain === "obs.line-scdn.net") {
            // https://obs.line-scdn.net/0hHuiuzxHgF1pUDDvjJ95oDSBRETUtbw1SPnQAYCFaHXQhYABaPHYebDRcFjoqaAxUNzoQYm0OGQwONQBwIDgIQjpSPCl8YBUFNBxcfQleMT0BQQpJOHZYOHIJTWh4NVMMaGIKaXcLQW48PVkMODpcOnU/small
            //   https://obs.line-scdn.net/0hHuiuzxHgF1pUDDvjJ95oDSBRETUtbw1SPnQAYCFaHXQhYABaPHYebDRcFjoqaAxUNzoQYm0OGQwONQBwIDgIQjpSPCl8YBUFNBxcfQleMT0BQQpJOHZYOHIJTWh4NVMMaGIKaXcLQW48PVkMODpcOnU
            // https://obs.line-scdn.net/0hKIDhz0IEFGZ5ETjf-dFrMQ1MEgkAcg5uE2kDXAxHHkgMfQNmEWsdUBlBFQYHdQ9oGicTXkARHjcwVzJLLBYfaw5kPgYwegxiNjMJa1VXMwhdRzNZOmtbBF8UTlRRJlU4RX8JUFwZSFERIFowFSReCVo/small
            //   https://obs.line-scdn.net/0hKIDhz0IEFGZ5ETjf-dFrMQ1MEgkAcg5uE2kDXAxHHkgMfQNmEWsdUBlBFQYHdQ9oGicTXkARHjcwVzJLLBYfaw5kPgYwegxiNjMJa1VXMwhdRzNZOmtbBF8UTlRRJlU4RX8JUFwZSFERIFowFSReCVo
            // https://obs.line-scdn.net/0hC4kQ_ABvHBtWKDChhAhjTCJ1GnQvSwYTPFALISN-FjUjRAsbPlIVLTZ4HXsoTAcVNR4bI293JmJ8YBIxNBESKQEuR04wQyZPDDw3GwZMQlg-S10dPVJTeXAtRyN6GFpPakYBKHQvSi4-GVJNOk9UenU/small
            //   https://obs.line-scdn.net/0hC4kQ_ABvHBtWKDChhAhjTCJ1GnQvSwYTPFALISN-FjUjRAsbPlIVLTZ4HXsoTAcVNR4bI293JmJ8YBIxNBESKQEuR04wQyZPDDw3GwZMQlg-S10dPVJTeXAtRyN6GFpPakYBKHQvSi4-GVJNOk9UenU
            // https://obs.line-scdn.net/0hkNQBJYc8NGFsOxgIp3lLNiRmMg4VWC5pBkMjWxltPk8ZVyNhBEE4Vwt5LhIRVDZ1TCYNTk1aGQc2UiFvJikLRA96KRQ_YCx2LiQhDjZiAxADF3MzUFxzB088blNBAyFgUFp9AAw6bFQRXyY2VA/small
            //   https://obs.line-scdn.net/0hkNQBJYc8NGFsOxgIp3lLNiRmMg4VWC5pBkMjWxltPk8ZVyNhBEE4Vwt5LhIRVDZ1TCYNTk1aGQc2UiFvJikLRA96KRQ_YCx2LiQhDjZiAxADF3MzUFxzB088blNBAyFgUFp9AAw6bFQRXyY2VA - 4032x3168
            // https://obs.line-scdn.net/0hYJbHYMpsBmVfMSkJA2N5MmdsABImHwNhfRMIUSRtAAokHRNqf1FPA3I1XUlxAhEyY1FKAD8wX1B0B0dkZw/s375x375
            //   https://obs.line-scdn.net/0hYJbHYMpsBmVfMSkJA2N5MmdsABImHwNhfRMIUSRtAAokHRNqf1FPA3I1XUlxAhEyY1FKAD8wX1B0B0dkZw
            return {
                can_head: false,
                url: src.replace(/(:\/\/[^/]*\/[-_0-9A-Za-z]*)\/[a-z0-9]*$/, "$1")
            };
        }

        if (domain === "scdn.line-apps.com") {
            // https://scdn.line-apps.com/obs/0hYJbHYMpsBmVfMSkJA2N5MmdsABImHwNhfRMIUSRtAAokHRNqf1FPA3I1XUlxAhEyY1FKAD8wX1B0B0dkZw/s375x375
            //   https://scdn.line-apps.com/0hYJbHYMpsBmVfMSkJA2N5MmdsABImHwNhfRMIUSRtAAokHRNqf1FPA3I1XUlxAhEyY1FKAD8wX1B0B0dkZw/s375x375
            //   https://obs.line-scdn.net/0hYJbHYMpsBmVfMSkJA2N5MmdsABImHwNhfRMIUSRtAAokHRNqf1FPA3I1XUlxAhEyY1FKAD8wX1B0B0dkZw/s375x375
            //   https://obs.line-scdn.net/0hYJbHYMpsBmVfMSkJA2N5MmdsABImHwNhfRMIUSRtAAokHRNqf1FPA3I1XUlxAhEyY1FKAD8wX1B0B0dkZw
            return src.replace(/^[a-z]+:\/\/[^/]*\/(?:obs\/)?([-_0-9A-Za-z]*)(?:\/[a-z0-9]*)?$/, "https://obs.line-scdn.net/$1");
        }

        if (domain === "resize-image.lineblog.me") {
            // https://resize-image.lineblog.me/47c5e2ea477a5b48ce91fcca631bbd99655224b0/crop1/60x60/https://obs.line-scdn.net/0hKIDhz0IEFGZ5ETjf-dFrMQ1MEgkAcg5uE2kDXAxHHkgMfQNmEWsdUBlBFQYHdQ9oGicTXkARHjcwVzJLLBYfaw5kPgYwegxiNjMJa1VXMwhdRzNZOmtbBF8UTlRRJlU4RX8JUFwZSFERIFowFSReCVo/small
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9a-f]*\/.*?\/([a-z]+:\/\/.*)/, "$1");
        }

        if (domain.match(/^[0-9]*\.viki\.io/)) {
            // https://6.viki.io/image/8c632348fc5d4e8b80db59c38fbf6f29.jpeg?x=b&a=0x0&s=780x436&q=h&e=t&f=t&cb=1
            return {
                can_head: false,
                url: src.replace(/\?.*/, "")
            };
        }

        if (domain.match(/img[0-9]*\.[^/.]*\.crunchyroll\.com/)) {
            // http://img1.ak.crunchyroll.com/i/spire1/863ba423b729f58769a4004834e5554e1491069428_thumb.jpg
            //   http://img1.ak.crunchyroll.com/i/spire1/863ba423b729f58769a4004834e5554e1491069428_full.jpg
            return src.replace(/(\/[0-9a-f]+)_[a-z]*(\.[^/.]*)$/, "$1_full$2");
        }

        if (domain === "d3ieicw58ybon5.cloudfront.net") {
            // https://d3ieicw58ybon5.cloudfront.net/resize/1600/u/e33bc7c858c44506a860fc2409f80d7b.jpg.webp
            //   https://d3ieicw58ybon5.cloudfront.net/full/u/e33bc7c858c44506a860fc2409f80d7b.jpg.webp
            // https://d3ieicw58ybon5.cloudfront.net/ex/640.400/0.127.2455.1535/u/abbaffa834cc49f9aa318ae280fd10f0.jpg.webp
            //   https://d3ieicw58ybon5.cloudfront.net/full/u/abbaffa834cc49f9aa318ae280fd10f0.jpg.webp
            // https://d3ieicw58ybon5.cloudfront.net/ex/350.350/shop/product/bf108bdf69264ab9992775fbd8906521.jpg
            //   https://d3ieicw58ybon5.cloudfront.net/ex/350.350/shop/product/bf108bdf69264ab9992775fbd8906521.jpg
            return {
                url: src
                    .replace(/\/resize\/[0-9]+\//, "/full/")
                    .replace(/\/ex\/[0-9]+\.[0-9]+\/(?:(?:[0-9]+\.){3}[0-9]+\/)?/, "/full/"),
                can_head: false
            };
        }

        if (domain === "az616578.vo.msecnd.net") {
            // https://az616578.vo.msecnd.net/files/responsive/cover/main/desktop/2016/05/22/6359949242235344891413001074_All%20the%20anime.jpeg
            //   https://az616578.vo.msecnd.net/files/2016/05/22/6359949242235344891413001074_All%20the%20anime.jpeg
            return src.replace(/\/files\/responsive\/[^/]*\/[^/]*\/[^/]*\//, "/files/");
        }

        if (domain.match(/img[0-9]*\.dreamwiz\.net/)) {
            // http://img77.dreamwiz.net/E/Z/T/EZTk3KA_m.jpg
            //   http://img77.dreamwiz.net/E/Z/T/EZTk3KA_l.jpg
            //   http://img77.dreamwiz.net/E/Z/T/EZTk3KA_o.jpg
            // doesn't work for all:
            // http://img77.dreamwiz.com/20180425/INI_DATA/hottopic/IMAGE/l/t/N/ltNNq0A_m.jpg
            //   http://img77.dreamwiz.com/l/t/N/ltNNq0A_m.jpg -- doesn't work
            return src.replace(/_[a-z](\.[^/.]*)$/, "_o$1");
        }

        if ((domain.indexOf(".sportsworldi.com") >= 0 ||
             domain.indexOf(".segye.com") >= 0) &&
            src.indexOf("/content/image/") >= 0 && false) {
            // http://img.sportsworldi.com/content/image/2018/04/23/20180423000784_t.jpg
            //   http://img.sportsworldi.com/content/image/2018/04/23/20180423000784_0.jpg -- not larger
            // http://img.sportsworldi.com/content/image/2018/04/25/20180425002868_t.jpg
            //   http://img.sportsworldi.com/content/image/2018/04/25/20180425002868_0.jpg
            // http://img.segye.com/content/image/2018/04/23/20180423000737_t.jpg
            //   http://img.segye.com/content/image/2018/04/23/20180423000737_0.jpg
            // doesn't work for all:
            // http://m.sportsworldi.com/content/image/2018/01/01/20180101001612_t.jpg
            //   http://m.sportsworldi.com/content/image/2018/01/01/20180101001612_0.jpg -- smaller (same for img.sportsworldi.com too)
            // http://img.sportsworldi.com/content/image/2017/12/23/20171223000846_t.jpg
            //   http://img.sportsworldi.com/content/image/2017/12/23/20171223000846_0.jpg -- smaller
            // http://img.sportsworldi.com/content/image/2017/12/12/20171212001686_t.jpg -- 5208x3858
            //   http://img.sportsworldi.com/content/image/2017/12/12/20171212001686_0.jpg -- 500x370
            return src.replace(/_[a-z](\.[^/.]*)$/, "_0$1");
        }

        if (domain_nowww === "maximkorea.net" &&
            src.indexOf("/magdb/file/") >= 0) {
            // http://www.maximkorea.net/magdb/file/138/138_3289240590_img_400.jpg
            //   http://www.maximkorea.net/magdb/file/138/138_3289240590_img.jpg
            return src.replace(/_img_[0-9]+(\.[^/.]*)$/, "_img$1");
        }

        if (domain === "blogimgc.eximg.jp") {
            // https://blogimgc.eximg.jp/i=https%253A%252F%252Fpds.exblog.jp%252Fpds%252F1%252F201804%252F20%252F93%252Fd0150493_21520100.jpg,small=200,quality=75,type=jpg
            //   https://pds.exblog.jp/pds/1/201804/20/93/d0150493_21520100.jpg
            return decodeURIComponent(decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?i=([^,]*).*?$/, "$1")));
        }

        if (domain === "i.gzn.jp") {
            // https://i.gzn.jp/img/2016/05/05/costume-players-fashion-machiasobi16/P368001cf_m.jpg
            //   https://i.gzn.jp/img/2016/05/05/costume-players-fashion-machiasobi16/P368001cf.jpg
            // https://i.gzn.jp/img/2018/04/25/amazon-route-53-hacked/00_m.jpg
            //   https://i.gzn.jp/img/2018/04/25/amazon-route-53-hacked/00.jpg
            // doesn't work for all:
            // https://i.gzn.jp/img/2016/05/05/costume-players-fashion-machiasobi16/00_m.jpg
            return src.replace(/_[a-z](\.[^/.]*)$/, "$1");
        }

        if (domain === "c.okmusic.jp") {
            // https://c.okmusic.jp/news_items/images/261768/more_large.jpg?1524641204
            //   https://c.okmusic.jp/news_items/images/261768/original.jpg?1524641204
            // https://c.okmusic.jp/app_artist_media_files/images/149/large.jpg
            //   https://c.okmusic.jp/app_artist_media_files/images/149/original.jpg
            return src.replace(/(\/[0-9]*\/)[^/.]*(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "ure.pia.co.jp" && src.indexOf("/mwimgs/") >= 0) {
            // http://ure.pia.co.jp/mwimgs/1/1/150/img_11e927362deb536d06a148164711f753324690.jpg
            //   http://ure.pia.co.jp/mwimgs/1/1/-/img_11e927362deb536d06a148164711f753324690.jpg
            return src.replace(/(\/mwimgs\/[0-9a-f]+\/[0-9a-f]+\/)[0-9]+\//, "$1-/");
        }

        if (domain === "kai-you.net") {
            // https://kai-you.net/r/img/a/752x/160814_kc90_0043.jpg?20180417135722
            //   https://kai-you.net/press/img/160814_kc90_0043.jpg?20180417135722
            // http://kai-you.net/r/img/a/c192x192/160814_kc90_0039.jpg
            //   http://kai-you.net/press/img/160814_kc90_0039.jpg
            // https://kai-you.net/images/a/2018/04/c672x416/37538746dc80daa2447b2652c73fb88a.jpg
            //   https://kai-you.net/images/a/2018/04/37538746dc80daa2447b2652c73fb88a.jpg
            //   https://kai-you.net/press/img/a7b4d4ab27d40caa23a964184b4903db.jpg?20180425182556
            return src
                .replace(/\/r\/img\/[a-z]\/[a-z]?[0-9]+x(?:[0-9]+)?\//, "/press/img/")
                .replace(/(\/images\/.*)\/[a-z]?[0-9]+x(?:[0-9]+)?\/([^/]*)$/, "$1/$2");
        }

        if (domain === "cdn.fortune-girl.com") {
            // https://cdn.fortune-girl.com/medium/513f7c8a-e8a1-44e8-9eec-76b37b4e7e42.jpg?1496131561
            //   https://cdn.fortune-girl.com/original/513f7c8a-e8a1-44e8-9eec-76b37b4e7e42.jpg?1496131561
            return src.replace(/(:\/\/[^/]*\/)[a-z]*\/([-0-9a-f]*\.[^/.]*)$/, "$1original/$2");
        }

        if (domain === "storage.withnews.jp" ||
            amazon_container === "storage.withnews.jp") {
            // http://storage.withnews.jp/2014/08/17/5/b4/5b4bd1e0-s.jpg
            //   http://storage.withnews.jp/2014/08/17/5/b4/5b4bd1e0.jpg
            // https://s3-ap-northeast-1.amazonaws.com/storage.withnews.jp/2016/10/06/9/c8/9c867eb1-ml.jpg
            //   https://s3-ap-northeast-1.amazonaws.com/storage.withnews.jp/2016/10/06/9/c8/9c867eb1-l.jpg
            //   https://s3-ap-northeast-1.amazonaws.com/storage.withnews.jp/2016/10/06/9/c8/9c867eb1.jpg -- 3205x2133
            return src.replace(/-[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain.match(/ic[0-9]*-a\.wowma\.net/)) {
            // https://ic4-a.wowma.net/mi/gr/114/item5.goqsystem.com/goqdir/starriver/prodimg/30816_1.jpg
            //   http://item5.goqsystem.com/goqdir/starriver/prodimg/30816_1.jpg
            // https://ic4-a.wowma.net/mi/gr/115/item5.goqsystem.com/goqdir/starriver/prodimg/30816_2.jpg
            //   http://item5.goqsystem.com/goqdir/starriver/prodimg/30816_2.jpg
            // https://ic4-a.wowma.net/mi/w/1280/h/1280/q/90/bcimg1-a.wowma.net/plus/u10068283/pc/event/season/moccasin/img/mayumayu_img.jpg
            //   http://bcimg1-a.wowma.net/plus/u10068283/pc/event/season/moccasin/img/mayumayu_img.jpg
            return src.replace(/^[a-z]*:\/\/[^/]*\/mi\/.*?\/([^/]*\.[^/]*\/.*)/, "http://$1");
        }

        if (domain === "sokuup.net") {
            // https://sokuup.net/imgm/soku_30203.jpg
            //   https://sokuup.net/imgs/soku_30203.jpg
            //   https://sokuup.net/img/soku_30203.jpg -- 4000x6016
            return src.replace(/\/img[a-z]\//, "/img/");
        }

        if (domain.match(/image[0-9]\.cosp\.jp/)) {
            // http://image7.cosp.jp/thumb/member/g/487/487029/12414133s.gif
            //   http://image7.cosp.jp/images/member/g/487/487029/12414133b.jpg
            //   http://image7.cosp.jp/images/member/g/487/487029/12414133.jpg
            // http://image7.cosp.jp/thumb/member/g/487/487029/12412384s.gif
            //   http://image7.cosp.jp/images/member/g/487/487029/12412384.jpg
            return src
                .replace(/\/thumb\/(.*?\/[0-9]+)[a-z]\.gif$/, "/images/$1.jpg")
                .replace(/(\/[0-9]+)[a-z](\.[^/.]*)/, "$1$2");
        }

        if (domain_nowww === "gahag.net") {
            // can't have google's referrer
            // http://gahag.net/img/201605/11s/gahag-008493.jpg
            //   http://gahag.net/img/201605/11s/gahag-0084931896-1.jpg
            //   http://img01.gahag.net/201605/11o/gahag-0084931896.jpg
            // http://gahag.net/img/201605/12s/gahag-0085298715-1.jpg
            //   http://img01.gahag.net/201605/12o/gahag-0085298715.jpg
            return src.replace(/:\/\/[^/]*\/img\/([^/]*)\/([0-9]+)[a-z]\/([^-/]+-[0-9]+)-[0-9](\.[^/.]*)/,
                               "://img01.gahag.net/$1/$2o/$3$4");
        }

        if (domain === "img-cdn.jg.jugem.jp") {
            // http://img-cdn.jg.jugem.jp/584/719314/20131206_802592_t.jpg
            //   http://img-cdn.jg.jugem.jp/584/719314/20131206_802592.jpg
            //   http://img-cdn.jg.jugem.jp/584/719314/20131206_802592.jpg?guid=ON&view=mobile&tid=1 -- no difference
            return src.replace(/_[a-z](\.[^/.]*)$/, "$1");
        }

        if (domain === "public.muragon.com") {
            // https://public.muragon.com/6phbmj9m/16q9y7i0/crop/270x270.png
            //   https://public.muragon.com/6phbmj9m/16q9y7i0.png
            // https://public.muragon.com/6phbmj9m/y8zyxnww/resize/640x640.jpg?1508627308000
            //   https://public.muragon.com/6phbmj9m/y8zyxnww.jpg?1508627308000
            return src.replace(/\/(?:crop|resize)\/[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "base-ec2if.akamaized.net") {
            // https://base-ec2if.akamaized.net/w=76,a=0,q=90,u=1/images/item/origin/d38861ba6e9f258591fbbb495f133a62.jpg
            //   https://base-ec2if.akamaized.net/images/item/origin/d38861ba6e9f258591fbbb495f133a62.jpg
            return src.replace(/(:\/\/[^/]*\/)[^/]*[a-z]=[0-9][^/]*\//, "$1");
        }

        if (domain.match(/\.imageflux\.jp/)) {
            // https://p1-e6eeae93.imageflux.jp/c!/a=2,w=460,h=460/mytown/6761e7b2ef74bca9a858.jpeg
            //   https://p1-e6eeae93.imageflux.jp/mytown/6761e7b2ef74bca9a858.jpeg
            return src.replace(/\/c!\/[^/]*[a-z]=[0-9][^/]*\//, "/");
        }

        if (domain.indexOf(".bloguru.com") >= 0 &&
            src.indexOf("/userdata/") >= 0) {
            // http://jp.bloguru.com/userdata/173/173/201504062228130.JPG
            //   http://jp.bloguru.com/userdata/173/173/orig_201504062228130.JPG
            // http://en.bloguru.com/userdata/173/173/201504062228130.JPG
            //   http://en.bloguru.com/userdata/173/173/orig_201504062228130.JPG
            return src.replace(/\/([^/_]*)$/, "/orig_$1");
        }

        if (domain === "www.atpress.ne.jp") {
            // https://www.atpress.ne.jp/releases/112459/js_img_112459_3.jpg
            //   https://www.atpress.ne.jp/releases/112459/img_112459_3.jpg
            // https://www.atpress.ne.jp/releases/112459/js_img_112459_2.jpg
            //   https://www.atpress.ne.jp/releases/112459/img_112459_2.jpg
            return src.replace(/(\/[0-9]+\/)[a-z]+_(img_[0-9]+[^/]*\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img-proxy.blog-video.jp") {
            // https://img-proxy.blog-video.jp/images?url=http%3A%2F%2Fuguisu.skr.jp%2Frecollection%2Fimg%2Fyudai121014.jpg
            //   http://uguisu.skr.jp/recollection/img/yudai121014.jpg
            return decodeURIComponent(src.replace(/.*\/images.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "cdn.otamart.com") {
            // https://cdn.otamart.com/item-picture/18188083/0-1517534918796-thumbnail.jpg
            //   https://cdn.otamart.com/item-picture/18188083/0-1517534918796.jpg
            return src.replace(/-thumbnail(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.pakutaso.com") {
            // https://www.pakutaso.com/shared/img/thumb/yuseiIMGL2091_TP_V1.jpg
            //   https://www.pakutaso.com/shared/img/thumb/yuseiIMGL2091.jpg
            return src.replace(/(\/img\/thumb\/[^/_.]*)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "cdn.atwiki.jp") {
            // https://cdn.atwiki.jp/game/news/image/1553/small_2e8123c6-479e-4e49-a787-f20a36f5767e.jpg
            //   https://cdn.atwiki.jp/game/news/image/1553/2e8123c6-479e-4e49-a787-f20a36f5767e.jpg
            return src.replace(/\/small_([^/]*)$/, "/$1");
        }

        if (domain === "getfile.fmkorea.com") {
            // https://getfile.fmkorea.com/getfile.php?code=a210413ef29c311aa833f8b468e8d4dc&file=http%3A%2F%2Fimg.ruliweb.com%2Fdata%2Fnews18%2F06m%2F12%2Fmulti%2Fmai01s.jpg&r=
            //   http://img.ruliweb.com/data/news18/06m/12/multi/mai01s.jpg
            return decodeURIComponent(src.replace(/.*?\/getfile\.php.*?[?&]file=([^&]*).*/, "$1"));
        }

        if (domain === "img.ruliweb.com" ||
            // http://20.dtiblog.com/s/sstommy2/file/0701-5-7s.jpg
            //   http://20.dtiblog.com/s/sstommy2/file/0701-5-7.jpg
            // http://2.dtiblog.com/t/trackbackhonsya/file/eric-charlizes.jpg
            //   http://2.dtiblog.com/t/trackbackhonsya/file/eric-charlize.jpg
            domain.match(/[0-9]*\.dtiblog\.com/) ||
            // http://image-bankingf25.com/tokimeki/img/otakara/201702/mikami_yua/ie17021605-mikami_yua-06s.jpg
            //   http://image-bankingf25.com/tokimeki/img/otakara/201702/mikami_yua/ie17021605-mikami_yua-06.jpg
            domain === "image-bankingf25.com") {
            // http://img.ruliweb.com/data/news18/06m/12/multi/mai01s.jpg
            //   http://img.ruliweb.com/data/news18/06m/12/multi/mai01.jpg
            return src.replace(/s(\.[^/.]*)$/, "$1");
        }

        if (domain === "file.thisisgame.com") {
            // http://file.thisisgame.com/upload/nboard/news/2017/06/27/s_20170627110032_1557.jpg
            //   http://file.thisisgame.com/upload/nboard/news/2017/06/27/20170627110032_1557.jpg
            return src.replace(/\/s_([0-9]+_[0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "www.op.gg") {
            // http://www.op.gg/forum/outImage/https://attach.s.op.gg/forum/20180426004418_551404.png
            //   https://attach.s.op.gg/forum/20180426004418_551404.png
            return src.replace(/^.*?\/forum\/outImage\/(http.*)$/, "$1");
        }

        if (domain === "ssproxy.ucloudbiz.olleh.com") {
            // http://ssproxy.ucloudbiz.olleh.com/v1/AUTH_6a92e249-183a-47ef-870b-b6f2fb771cfa/gae9/trend/f4867c07f1d60768.small
            //   http://ssproxy.ucloudbiz.olleh.com/v1/AUTH_6a92e249-183a-47ef-870b-b6f2fb771cfa/gae9/trend/f4867c07f1d60768.orig
            return src.replace(/\.[a-z]*$/, ".orig");
        }

        if (domain.match(/cdn[a-z]*\.artstation\.com/)) {
            // https://cdnb.artstation.com/p/assets/images/images/001/982/361/small/kevin-lourdel-2012-06-12-09-53-11.jpg?1455539239
            //   https://cdnb.artstation.com/p/assets/images/images/001/982/361/large/kevin-lourdel-2012-06-12-09-53-11.jpg?1455539239
            // there's also /original/, but it's forbidden?
            return src.replace(/\/(?:small|medium)\/([^/]*)$/, "/large/$1");
        }

        if (domain === "static.cosplay-it.com") {
            // forces download (binary/octet-stream)
            // https://static.cosplay-it.com/b391a71e-4306-46df-9d3e-ff61e3c2f73b_medium.jpg
            //   https://static.cosplay-it.com/b391a71e-4306-46df-9d3e-ff61e3c2f73b.jpg -- forces download
            return src.replace(/(\/[-0-9a-f]*)_[a-z]+(\.[^/.]*)/, "$1$2");
        }

        if (domain === "a.fsdn.com") {
            // https://a.fsdn.com/con/app/proj/paintball2/screenshots/build036_midnight2_1.jpg/245/183/1
            //   https://a.fsdn.com/con/app/proj/paintball2/screenshots/build036_midnight2_1.jpg
            return src.replace(/(\/screenshots\/[^/]*)\/[0-9]+\/.*/, "$1");
        }

        if (domain === "media.moddb.com" ||
            domain === "media.indiedb.com") {
            // http://media.moddb.com/cache/images/mods/1/4/3463/crop_120x90/62199.jpg
            //   http://media.moddb.com/cache/images/mods/1/4/3463/thumb_620x2000/62199.jpg
            //   http://media.moddb.com/images/mods/1/4/3463/62199.jpg
            // http://media.indiedb.com/cache/images/articles/1/253/252120/crop_120x90/DevStream_Thumbnail2.png
            //   http://media.indiedb.com/images/articles/1/253/252120/DevStream_Thumbnail2.png
            return src.replace(/\/cache\/images\/(.*?)\/[a-z]+_[0-9]+[^/]*(\/[^/]*\.[^/.]*)$/, "/images/$1$2");
        }

        if (domain === "static.gamefront.com") {
            // https://static.gamefront.com/storage/images/games/thumbnails/Hd6mCPO4MFbqTI9c75olYsSgVXv5Za7EjEheIZ2L.jpeg
            //   https://static.gamefront.com/storage/images/games/Hd6mCPO4MFbqTI9c75olYsSgVXv5Za7EjEheIZ2L.jpeg
            return src.replace("/thumbnails/", "/");
        }

        if (domain === "thumb.test.mod.io") {
            // https://thumb.test.mod.io/mods/ca81/866/thumb_1020x2000/modio-bg.jpg
            //   https://image.test.mod.io/mods/ca81/866/modio-bg.jpg
            return src.replace(/:\/\/thumb\.([^/]*\..*?\/)[a-z]+_[0-9]+[^/]*\/([^/]*)$/, "://image.$1$2");
        }

        if (domain.match(/static[0-9]*\.scirra\.net/)) {
            // https://static4.scirra.net/avatars/128/eadc0da9f707ff5a5a5195d405639f71.png
            // error when using size 0:
            // https://pastebin.com/UkcRAMwt
            return src.replace(/\/avatars\/[0-9]+\//, "/avatars/256/");
        }

        if (domain === "cdn.gamer-network.net") {
            // https://cdn.gamer-network.net/2018/articles/2018-04-25-13-25/fifa.png/EG11/resize/690x-1/quality/75/format/jpg
            //   https://cdn.gamer-network.net/2018/articles/2018-04-25-13-25/fifa.png
            return src.replace(/(\/[^/.]*\.[^/.]*)\/EG[0-9]+\/.*/, "$1");
        }

        if (domain.match(/uploads[0-9]*\.wikiart\.org/)) {
            // https://uploads5.wikiart.org/images/anton-melbye/laguna-di-venezia-1878.jpg!PinterestSmall.jpg
            //   https://uploads5.wikiart.org/images/anton-melbye/laguna-di-venezia-1878.jpg
            return src.replace(/![^/]*$/, "");
        }

        if (domain.match(/media[0-9]*\.fdncms\.com/) ||
            // https://images1.miaminewtimes.com/imager/u/745x420/10228444/https_3a_2f_2fcdn.evbuc.com_2fimages_2f42846199_2f213046196680_2f1_2foriginal.jpg_h_200_w_450_rect_0_2c50_2c1542_2c771_s_5cbbeb572f467a67fed17f3f68594108
            //   https://images1.miaminewtimes.com/imager/u/original/10228444/https_3a_2f_2fcdn.evbuc.com_2fimages_2f42846199_2f213046196680_2f1_2foriginal.jpg_h_200_w_450_rect_0_2c50_2c1542_2c771_s_5cbbeb572f467a67fed17f3f68594108
            //   https://cdn.evbuc.com/images/42846199/213046196680/1/original.jpg
            // improper, but still works
            // https://images1.miaminewtimes.com/imager/u/original/10228444/https_3a_2f_2fcdn.evbuc.com_2fimages_2f42846199_2f213046196680_2f1_2foriginal.jpg_h_200_w_450_rect_0_2c50_2c1542_2c771_s_5cbbeb572f467a67fed17f3f68594108/https:_2f_2fcdn.evbuc.com_2fimages_2f42846199_2f213046196680_2f1_2foriginal.jpg_h_200_w_450_rect_0_2c50_2c1542_2c771_s_5cbbeb572f467a67fed17f3f68594108
            domain.match(/images[0-9]*\.miaminewtimes\.com/) ||
            // https://images1.phoenixnewtimes.com/imager/u/745x420/10442190/hidden_gems.jpg
            //   https://images1.phoenixnewtimes.com/imager/u/original/10442190/hidden_gems.jpg
            domain.match(/images[0-9]*\.phoenixnewtimes\.com/)) {
            // https://media2.fdncms.com/stranger/imager/u/small/26096836/1524685866-nether_render_2.jpg
            //   https://media2.fdncms.com/stranger/imager/u/original/26096836/1524685866-nether_render_2.jpg
            //return src.replace(/\/imager\/u\/[a-z]+\//, "/imager/u/original/");
            newsrc = src.replace(/\/imager\/u\/[^/]*\/([0-9]+\/[^/]*)(?:\/.*)?/, "/imager/u/original/$1");
            if (newsrc !== src)
                return newsrc;

            if (src.match(/\/imager\/u\/[^/]*\/[0-9]+\/https?_3[aA]/)) {
                newsrc = src
                    .replace(/.*?\/imager\/u\/[^/]*\/[0-9]+\/(https?_3[aA].*\.[^/._]*)(?:_[^/]*)?$/, "$1")
                    .replace(/_([0-9a-fA-F][0-9a-fA-F])/g, "%$1");
                newsrc = decodeURIComponent(newsrc);
                return newsrc;
            }
        }

        if (domain === "images.techhive.com" ||
            domain === "images.idgesg.net") {
            // https://images.techhive.com/images/article/2016/10/20161010210440_1-100687367-large.jpg
            //   https://images.techhive.com/images/article/2016/10/20161010210440_1-100687367-orig.jpg
            // https://images.techhive.com/images/article/2016/10/20161010204135_1-100687365-carousel.idge.jpg
            //   https://images.techhive.com/images/article/2016/10/20161010204135_1-100687365-orig.jpg
            // https://images.idgesg.net/images/article/2018/02/ryzen_3_2200g_3-100748962-large.jpg
            //   https://images.idgesg.net/images/article/2018/02/ryzen_3_2200g_3-100748962-orig.jpg
            return src.replace(/-[a-z]+(?:\.[^/.]*)?(\.[^/.]*)$/, "-orig$1");
        }

        if (domain.indexOf(".rimg.com.tw") >= 0 ||
            // http://b0.rimg.tw/wishseed/84c6485d_s.jpg
            //   http://b0.rimg.tw/wishseed/84c6485d.jpg
            // http://pcdn1.rimg.tw/photos/2906507_5j6ijbh_l.png?131541
            //   http://pcdn1.rimg.tw/photos/2906507_5j6ijbh_o.png?131541 -- removing _l doesn't work
            domain.indexOf(".rimg.tw") >= 0 ||
            // http://photo.roodo.com/photos/2830061_1frolhm_l.jpg?291733
            //   http://photo.roodo.com/photos/2830061_1frolhm_o.jpg?291733
            domain === "photo.roodo.com" ||
            // https://img.ruten.com.tw/s1/a/b0/15/21308219439125_793.jpg
            domain === "img.ruten.com.tw") {
            // https://a.rimg.com.tw/s1/a/b0/15/21308219439125_793_m.jpg

            if (src.match(/(\/photos\/[0-9]+_[0-9a-z]+_)[a-z](\.[^/.]*)$/)) {
                return src.replace(/(\/photos\/[0-9]+_[0-9a-z]+_)[a-z](\.[^/.]*)$/, "$1o$2");
            }

            return src.replace(/_[a-z](\.[^/.]*)$/, "$1");
        }

        if (domain === "buy.line-scdn.net") {
            // https://buy.line-scdn.net/d9ae5f0c/s/wb/images/2AA7830B6AA9A10B8FBA21C36BF8CF28A36BAB1D
            //   https://s.yimg.com/wb/images/2AA7830B6AA9A10B8FBA21C36BF8CF28A36BAB1D
            // https://buy.line-scdn.net/d9ae5f0c/s/ut/api/res/1.2/jGyoWt7od2NeNBE5FWHtLA--~B/dz02MDA7aD02MDA7cT04MTtmaT1maXQ7YXBwaWQ9eXR3bWFsbA--/http://imgcld.zenfs.com:80/ps_image_prod/item/p03761821666-item-0338xf3x0600x0600-m.jpg
            //   https://s.yimg.com/ut/api/res/1.2/jGyoWt7od2NeNBE5FWHtLA--~B/dz02MDA7aD02MDA7cT04MTtmaT1maXQ7YXBwaWQ9eXR3bWFsbA--/http://imgcld.zenfs.com:80/ps_image_prod/item/p03761821666-item-0338xf3x0600x0600-m.jpg
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/[a-f0-9]+\/s\//, "https://s.yimg.com/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain.match(/img[0-9]*\.hc360\.cn/)) {
            // https://img006.hc360.cn/m7/M01/9C/9B/wKhQpFczDoOEFjnwAAAAAFJvURI463.jpg..400x400.jpg
            //   https://img006.hc360.cn/m7/M01/9C/9B/wKhQpFczDoOEFjnwAAAAAFJvURI463.jpg
            return src.replace(/(\.[^/.]*)\.[^/]*$/, "$1");
        }

        if (domain.match(/photo[0-9]*\.ganref\.jp/)) {
            // https://photo1.ganref.jp/photo/0/7033e5f31807519185c42ec12a0e3b87/thumb5.jpg
            //   https://photo1.ganref.jp/photo/0/7033e5f31807519185c42ec12a0e3b87/original.jpg
            return src.replace(/(\/[0-9a-f]+\/)thumb[0-9]*(\.[^/.]*)$/, "$1original$2");
        }

        if (domain.match(/cdn(?:-[a-z]+)\.[a-z]\.st-hatena\.com/)) {
            // https://cdn-ak.f.st-hatena.com/images/fotolife/A/Amayadori-June/20180419/20180419183448_120.jpg
            //   https://cdn-ak.f.st-hatena.com/images/fotolife/A/Amayadori-June/20180419/20180419183448.jpg
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.cdn.nimg.jp") {
            // http://news.nicovideo.jp/watch/nw3468901
            // https://img.cdn.nimg.jp/s/niconews/articles/images/3468901/45213edfb355c57cd4794f0ef0c83a3463a6fdb540ccf59db7d2e094c0427a77f183c2c622560c45fa676d4febc525f15ce3aeb95a623b7533a96750725290c6/300x300s_FFFFFFFF?key=293b5fc6c8c97c8a96505ff25eadda2e537c4b415566571114ed309cca61acfb
            //   https://dcdn.cdn.nimg.jp/niconews/articles/images/3468901/45213edfb355c57cd4794f0ef0c83a3463a6fdb540ccf59db7d2e094c0427a77f183c2c622560c45fa676d4febc525f15ce3aeb95a623b7533a96750725290c6
            return src.replace(/:\/\/img\.cdn\.nimg\.jp\/s\/(.*?\/images\/[0-9]+\/[0-9a-f]+)\/.*/,
                               "://dcdn.cdn.nimg.jp/$1");
        }

        if (domain.match(/\.photozou\.jp/)) {
            // http://photozou.jp/photo/show/2422777/173992738?lang=ja
            // http://kura3.photozou.jp/pub/777/2422777/photo/173992771_thumbnail.v1524913392.jpg
            //   http://kura3.photozou.jp/pub/777/2422777/photo/173992771_org.v1524913392.jpg
            // http://kura1.photozou.jp/pub/777/2422777/photo/173992738_624.jpg
            //   http://kura1.photozou.jp/bin/photo/173992738/org.bin?size=1024
            //   http://kura1.photozou.jp/pub/777/2422777/photo/173992738_large.v1525158218.jpg
            //   http://kura1.photozou.jp/pub/777/2422777/photo/173992738_org.v1525158218.jpg
            return src
                .replace(/(\/photo\/[0-9]+\/org\.bin)\?.*$/, "$1")
                .replace(/(\/photo\/[0-9]+)_[a-z0-9]+(\.[^/]*)$/, "$1_org$2");
        }

        if (domain === "desktop.sakura.ne.jp") {
            // http://desktop.sakura.ne.jp/sblo_files/desktop/image/_MG_1072_DxO_raw-thumbnail2.jpg
            //   http://desktop.sakura.ne.jp/sblo_files/desktop/image/_MG_1072_DxO_raw.jpg
            return src.replace(/-thumbnail[0-9]*(\.[^/.]*)$/, "$1");
        }

        if ((domain === "www.ya.sakura.ne.jp" || domain === "mabi4751.orz.hm") &&
            src.indexOf("/~mabi/") >= 0) {
            // http://www.ya.sakura.ne.jp/~mabi/4751/
            //   http://www.ya.sakura.ne.jp/~mabi/etc/20180403/IMG_8319s.jpg
            //     http://www.ya.sakura.ne.jp/~mabi/etc/20180403/IMG_8319.jpg
            // http://mabi4751.orz.hm/~mabi/20110503F/index.html
            //   http://mabi4751.orz.hm/~mabi/20110503F/IMG_9905s.jpg
            //     http://mabi4751.orz.hm/~mabi/20110503F/IMG_9905s.jpg
            // http://mabi4751.orz.hm/~mabi/20100820B/index.html
            //   http://mabi4751.orz.hm/~mabi/20100820B/IMG_0119s.jpg
            //     http://mabi4751.orz.hm/~mabi/20100820B/IMG_0119.jpg
            return src.replace(/s(\.jpg|\.JPG)$/, "$1");
        }

        if (domain.match(/\.storage-yahoo\.jp$/)) {
            // https://blogs.yahoo.co.jp/thssythssy/64651630.html
            // https://blog-001.west.edge.storage-yahoo.jp/res/blog-03-7e/thssythssy/folder/1591373/30/64651630/img_0_m?1481865302
            //   https://blog-001.west.edge.storage-yahoo.jp/res/blog-03-7e/thssythssy/folder/1591373/30/64651630/img_0?1481865302
            // https://blog-001.west.edge.storage-yahoo.jp/res/blog-03-7e/thssythssy/folder/1591373/97/64967897/img_0_thumb?1506177062
            //   https://blog-001.west.edge.storage-yahoo.jp/res/blog-03-7e/thssythssy/folder/1591373/97/64967897/img_0?1506177062
            return src.replace(/_(?:m|thumb)(\?.*)?$/, "$1");
        }

        if (domain === "static-mercari-jp-imgtr2.akamaized.net") {
            // https://static-mercari-jp-imgtr2.akamaized.net/thumb/photos/m67374048071_1.jpg?1520960098
            //   https://static-mercari-jp-imgtr2.akamaized.net/photos/m67374048071_1.jpg?1520960098
            // https://static-mercari-jp-imgtr2.akamaized.net/thumb/members/583883227.jpg?1501875459
            //   https://static-mercari-jp-imgtr2.akamaized.net/members/583883227.jpg?1501875459 -- stretched
            // https://static-mercari-jp-imgtr2.akamaized.net/thumb/photos/m86027196730_1.jpg?1528127240
            //   https://static-mercari-jp-imgtr2.akamaized.net/photos/m86027196730_1.jpg?1528127240 -- 2448x3264
            return src.replace(/\/thumb\//, "/");
        }

        if (domain.match(/\.fbcdn\.net$/) && false) {
            // wip
            // https://www.facebook.com/Mahore.official.page/photos/a.1771049596262263.1073742012.148396778527561/1771049639595592/?type=3&theater
            // https://scontent.fcxh3-1.fna.fbcdn.net/v/t1.0-0/c0.0.200.200/p200x200/26804734_1771049639595592_724697207772414518_n.jpg?_nc_cat=0&oh=620d6a106e5646c7829532e0616e2c5f&oe=5B5EE91F
            // https://graph.facebook.com/1771049639595592?fields=images&access_token=
            // https://www.facebook.com/photo/download/?fbid=1771049639595592&ext=1525461615&hash=AeS2Z2X1LdqZYGmJ
            //   https://scontent.fcxh3-1.fna.fbcdn.net/v/t31.0-8/26756562_1771049639595592_724697207772414518_o.jpg?_nc_cat=0&oh=e184f1c97589b647994c3458cb20fb84&oe=5B5DF86F&dl=1
        }

        if (domain === "www.the-a.jp" && false) {
            // don't really plan on implementing this one unless a better way is found
            // http://www.the-a.jp/event.cgi?eventnum=071215 -- album
            // http://www.the-a.jp/view/view.php?file=071215001_001 -- image viewer
            // http://www.the-a.jp/thm.cgi?071215001_001 -- 120x160
            // http://www.the-a.jp/thm.php?image=071215001_001 -- 120x160
            // http://www.the-a.jp/photodata/07/071215/thumb/071215001_001.jpg -- 120x160
            // http://www.the-a.jp/imgresize.php?image=071215001_001 -- 240x320
            // http://www.the-a.jp/img.php?image=071215001_001 -- 582x861, badly scaled with badly scaled text
            // http://www.the-a.jp/imgtwit.php?image=071215001_001 -- 800x400, lots of blackspace after
            // to get the original image, stitch these 2 together
            // http://www.the-a.jp/imgdivide.php?image=071215001_001&dx=0 -- 393x836
            // http://www.the-a.jp/imgdivide.php?image=071215001_001&dx=1 -- 320x811
        }

        if (domain === "waichi.sakura.ne.jp") {
            // http://waichi.sakura.ne.jp/prev/chtft68/chtft68_pdx.html
            // http://waichi.sakura.ne.jp/prev/chtft68/momoko.jpg
            //   http://waichi.sakura.ne.jp/prev/chtft68/momoko_L.jpg
            return src.replace(/(\/[^/_.]*)(\.(?:jpg|JPG|jpeg|png|PNG))$/, "$1_L$2");
        }

        if (domain === "news.merumo.ne.jp") {
            // https://news.merumo.ne.jp/imgs/rect78/7372693
            //   https://news.merumo.ne.jp/img/7372693
            return src.replace(/\/imgs\/rect[0-9]*\//, "/img/");
        }

        if (domain.indexOf(".shikimori.org") >= 0 &&
            src.indexOf("/system/") >= 0) {
            // https://shikimori.org/animes/1887-lucky-star/cosplay
            // https://dere.shikimori.org/system/cosplay_images/preview/24174.jpg?1305086273
            //   https://dere.shikimori.org/system/cosplay_images/original/24174.jpg?1305086273
            //   https://nyaa.shikimori.org/system/cosplay_images/original/24174.jpg?1305086273
            // https://dere.shikimori.org/system/animes/preview/36949.jpg?1524536106
            //   https://dere.shikimori.org/system/animes/original/36949.jpg?1524536106
            // https://nyaa.shikimori.org/system/cosplay_images/original/26810.jpg?1306746150
            return src.replace(/\/[a-z]*\/([0-9]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "assets.survivalinternational.org") {
            // https://assets.survivalinternational.org/pictures/2015/img-9072_article_column.jpeg
            //   https://assets.survivalinternational.org/pictures/2015/img-9072_screen.jpeg
            //   https://assets.survivalinternational.org/pictures/2015/img-9072_original.jpeg
            // https://assets.survivalinternational.org/pictures/939/col-arh-yc-41_600_landscape.jpg
            //   https://assets.survivalinternational.org/pictures/939/col-arh-yc-41_original.jpg
            return src.replace(/_[0-9a-z_]+(\.[^/.]*)$/, "_original$1");
        }

        if (domain === "alioss.g-cores.com" &&
            src.indexOf("/uploads/image/") >= 0) {
            // https://alioss.g-cores.com/uploads/image/5c072496-cff6-427e-b465-ff189b68729c_watermark.jpg
            //   https://alioss.g-cores.com/uploads/image/5c072496-cff6-427e-b465-ff189b68729c.jpg
            // http://alioss.g-cores.com/uploads/image/07bc730f-0a7e-4af3-bdf9-4b8e45ad0cd4_watermark.jpg
            //   http://alioss.g-cores.com/uploads/image/07bc730f-0a7e-4af3-bdf9-4b8e45ad0cd4.jpg
            // https://alioss.g-cores.com/assets/5th/souvenir/1-5016dae53ea027acdb653e78d25208780cc556bde2ff35007b3d164b9a2b04ac.jpg
            return src.replace(/_watermark(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.nyato.com") {
            // https://img.nyato.com/data/upload/2016/1006/11/57f5cc2d9f2f1.jpg!300x300cut
            //   https://img.nyato.com/data/upload/2016/1006/11/57f5cc2d9f2f1.jpg
            // https://img.nyato.com/data/upload/avatar/22/2d/40/original.jpg!100x100cut
            //   https://img.nyato.com/data/upload/avatar/22/2d/40/original.jpg
            return src.replace(/!.*/, "");
        }

        if (domain === "inews.gtimg.com") {
            // http://inews.gtimg.com/newsapp_bt/0/21184296/1000
            //   https://inews.gtimg.com/newsapp_match/0/21184296/0
            // https://inews.gtimg.com/newsapp_ls/0/3457832104_150120/0
            //   https://inews.gtimg.com/newsapp_match/0/3457832104_150120/0 -- doesn't work
            // http://inews.gtimg.com/newsapp_bt/0/21184291/1000
            //   http://inews.gtimg.com/newsapp_match/0/21184291/0
            return {
                url: src.replace(/\/newsapp_[a-z]+\/([0-9]+\/[0-9]+\/)[0-9]+$/, "/newsapp_match/$10"),
                headers: {
                    "Referer": null
                }
            };
        }

        if ((domain === "acg.ms" ||
             domain === "m.acg.ms") &&
            src.indexOf("/photo/") >= 0) {
            // http://acg.ms/photo/19180_0_620.jpeg
            //   http://acg.ms/photo/19180_0_9999999.jpeg ->
            //     http://acg.ms/photo/19180_0_690.jpeg
            // http://m.acg.ms/photo/19183_0_600.jpeg
            return {
                redirects: true,
                url: src.replace(/(\/[0-9]+)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1_0_9999999$2")
            };
        }

        if (domain === "sl.news.livedoor.com") {
            // http://sl.news.livedoor.com/ed497b107aabc6a44a13236e45d22ce6456ce615/small_light(dw=120,dh=120,da=s,cw=120,ch=120,q=100,e=imagemagick,sharpen=radius,sigma)/http://image.news.livedoor.com/newsimage/stf/0/8/0812d_1408_a240b678079ee1be40cb46476262012a.jpg
            //   http://image.news.livedoor.com/newsimage/stf/0/8/0812d_1408_a240b678079ee1be40cb46476262012a.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/[a-f0-9]+\/[^/]*\//, "");
        }

        if (domain === "photo.tuchong.com") {
            // https://photo.tuchong.com/1171334/s/8210121.jpg
            //   https://photo.tuchong.com/1171334/f/8210121.jpg
            return src.replace(/\/[a-z]\/([0-9]+\.[^/.]*)/, "/f/$1");
        }

        if ((domain === "arine.akamaized.net" ||
             domain === "media-assets.aumo.jp") &&
            src.indexOf("/uploads/photo/") >= 0) {
            // https://arine.akamaized.net/uploads/photo/snap_photo/data/240902/xlarge_3b631896-390b-49ea-b962-f2b7a8dfa590.jpeg
            //   https://arine.akamaized.net/uploads/photo/snap_photo/data/240902/3b631896-390b-49ea-b962-f2b7a8dfa590.jpeg
            // https://media-assets.aumo.jp/uploads/photo/upload_photo/data/9459/xlarge_a280c9e6-11e7-4778-93c9-3ea4b82aa629.jpeg
            //   https://media-assets.aumo.jp/uploads/photo/upload_photo/data/9459/a280c9e6-11e7-4778-93c9-3ea4b82aa629.jpeg
            return src.replace(/(\/[0-9]+\/)[a-z]+_([-0-9a-z]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "newsimg.glossom.jp") {
            // https://newsimg.glossom.jp/public/img/article/36/86/2833686_580_04.jpg?5ac96eca
            //   https://newsimg.glossom.jp/public/img/article/36/86/2833686_org_04.jpg?5ac96eca
            return src.replace(/(\/[0-9]+_)[0-9]+(_[0-9]+\.[^/.]*)$/, "$1org$2");
        }

        if (domain === "www.vtianxia.cn") {
            // http://www.vtianxia.cn/uploadfile/news/s/2017/1231/1514696987_29121.jpg
            //   http://www.vtianxia.cn/uploadfile/news/big/2017/1231/1514696987_29121.jpg
            return src.replace(/(\/uploadfile\/[a-z]+\/)[a-z]+\//, "$1big/");
        }

        if (domain === "img.over-blog-kiwi.com" ||
            domain.indexOf(".idata.over-blog.com") >= 0) {
            // http://img.over-blog-kiwi.com/100x100-ct/0/93/38/59/20140217/ob_bb3768_cafe.jpg
            //   http://img.over-blog-kiwi.com/0/93/38/59/20140217/ob_bb3768_cafe.jpg
            // https://img.over-blog-kiwi.com/630x400-ct/1/50/73/92/20180426/ob_f976fb_p1270469.JPG
            //   https://img.over-blog-kiwi.com/1/50/73/92/20180426/ob_f976fb_p1270469.JPG
            // https://img.over-blog-kiwi.com/150x150/0/55/07/74/20180504/ob_20914b_2018-05-04-wooz-nao.jpg
            //   https://img.over-blog-kiwi.com/0/55/07/74/20180504/ob_20914b_2018-05-04-wooz-nao.jpg
            // http://a401.idata.over-blog.com/150x185/4/02/25/29/VRAC-3/FERRIE--2-.jpg
            //   http://a401.idata.over-blog.com/4/02/25/29/VRAC-3/FERRIE--2-.jpg
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+(?:-[a-z]+)?\//, "$1");
        }

        if (domain === "resize.over-blog.com") {
            // http://resize.over-blog.com/150x150.jpg?https://hoax-net.be/wp-content/uploads/2015/10/12063832_10207955947996766_7835521811747899900_n.jpg
            //   https://hoax-net.be/wp-content/uploads/2015/10/12063832_10207955947996766_7835521811747899900_n.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+x[0-9]+\.[^/.?]*\?/, "");
        }

        if (domain.match(/[0-9]*\.imgmini\.eastday\.com/)) {
            // http://09.imgmini.eastday.com/mobile/20160905/20160905080255_b9afa06a642df686fe424990c933a90a_1_mwpm_03200403.jpeg
            //   http://09.imgmini.eastday.com/mobile/20160905/20160905080255_b9afa06a642df686fe424990c933a90a_1.jpeg
            return src.replace(/(\/[0-9]+_[0-9a-f]+_[0-9]+)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain.indexOf(".so-net.ne.jp") >= 0) {
            // http://harrypotter-fun.c.blog.so-net.ne.jp/_images/blog/_985/harrypotter-fun/m_lunalovegood.jpg
            //   http://harrypotter-fun.c.blog.so-net.ne.jp/_images/blog/_985/harrypotter-fun/lunalovegood.jpg
            // http://news.so-net.ne.jp/photos/30/365455840452641889/S200_365455840452641889_365547478327575649_origin_1.jpg
            //   http://news.so-net.ne.jp/photos/30/365455840452641889/365455840452641889_365547478327575649_origin_1.jpg
            return src.replace(/\/(?:m|S[0-9]+)_([^/]*)$/, "/$1");
        }

        if (amazon_container === "rejob-v2-images-production") {
            // https://s3-ap-northeast-1.amazonaws.com/rejob-v2-images-production/files/client_shop_image/XSaB7Q/s1D8ah/L7RcjU/Um9yL7/bOo/minimum.jpg
            //   https://s3-ap-northeast-1.amazonaws.com/rejob-v2-images-production/files/client_shop_image/XSaB7Q/s1D8ah/L7RcjU/Um9yL7/bOo/detail_top.jpg
            //   https://s3-ap-northeast-1.amazonaws.com/rejob-v2-images-production/files/client_shop_image/XSaB7Q/s1D8ah/L7RcjU/Um9yL7/bOo/original.jpg
            return src.replace(/\/[^/.]*(\.[^/.]*)$/, "/original$1");
        }

        if (domain === "lohas.nicoseiga.jp") {
            // https://lohas.nicoseiga.jp/thumb/6494066i
            //   https://lohas.nicoseiga.jp/thumb/6494066l -- same size
            // https://lohas.nicoseiga.jp/thumb/7639531m
            //   https://lohas.nicoseiga.jp/thumb/7639531i -- doesn't work
            //   https://lohas.nicoseiga.jp/thumb/7639531l -- largest
            // larger images:
            // https://lohas.nicoseiga.jp/material/4e1a77/8032880
            // http://lohas.nicoseiga.jp/priv/5eb1a6e1e94c0e1a55c4b54145af82950dc5145e/1487849470/6505819
            // (l, i), d, m, t, c, u, z, q, s
            return src.replace(/(\/thumb\/[0-9]+)[a-z](\?.*)?$/, "$1l$2");
        }

        if (domain === "files.mastodon.social") {
            // https://files.mastodon.social/media_attachments/files/000/272/420/small/70972b69912d1e4d.png
            //   https://files.mastodon.social/media_attachments/files/000/272/420/original/70972b69912d1e4d.png
            return src.replace(/\/[a-z]+\/([0-9a-f]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "appdata.hungryapp.co.kr") {
            // http://appdata.hungryapp.co.kr/data_file/data_img_m/201712/22/W15139228709275643.jpg
            //   http://appdata.hungryapp.co.kr/data_file/data_img/201712/22/W15139228709275643.jpg
            return src.replace(/\/data_img_[a-z]\//, "/data_img/");
        }

        if (domain === "media.funradio.fr") {
            // https://media.funradio.fr/cache/6zVW4QAFrwxZgrBHWQ9VTQ/880v587-0/online/image/2017/1211/7791363662_selena-gomez.jpg -- upscaled?
            //   https://media.funradio.fr/online/image/2017/1211/7791363662_selena-gomez.jpg -- smaller
            return src.replace(/\/cache\/[0-9a-zA-Z]+\/[0-9a-z]+-[0-9]+\//, "/");
        }

        if (domain === "image.afcdn.com" && false) {
            // https://image.afcdn.com/story/20170706/selena-gomez-1102651_w767h767c1cx1816cy877.jpg
            //   https://image.afcdn.com/story/20170706/selena-gomez-1102651.jpg
            // https://image.afcdn.com/story/20130911/cara-delevingne-98052_w767h767c1cx345cy200.jpg
            //   https://image.afcdn.com/story/20130911/cara-delevingne-98052.jpg
            // https://image.afcdn.com/album/D20180221/allison-janney-phalbm25328123_w660.jpg
            //   https://image.afcdn.com/album/D20180221/allison-janney-phalbm25328123.jpg
            // doesn't work: (redirects to blank image, no content-length header, can't find differences in headers)
            // https://image.afcdn.com/story/20170706/selena-gomez-1102505_w670.jpg
            // https://image.afcdn.com/story/20170706/selena-gomez-1102441_w670.jpg
            return src.replace(/(-[0-9]+)_[a-z0-9]+(\.[^/.]*)/, "$1$2");
        }

        if (domain.match(/static[0-9]*\.greatsong\.net/)) {
            // https://static2.greatsong.net/artiste/250x250/selena-gomez-204596.jpg
            //   https://static2.greatsong.net/artiste/original/selena-gomez-204596.jpg
            return src.replace(/\/[0-9]+x[0-9]+\//, "/original/");
        }

        if (domain_nosub === "elle.co.jp") {
            // http://www.elle.co.jp/var/ellejp/storage/images/fashion/celeb/selenagomez-bestsnap-2016_17_02/node_1087470/19466418-1-jpn-JP/2017-6-7-NY_image_size_900_x.jpg
            //   http://elle.co.jp/var/ellejp/storage/images/fashion/celeb/selenagomez-bestsnap-2016_17_02/node_1087470/19466418-1-jpn-JP/2017-6-7-NY.jpg
            // http://img.elle.co.jp/var/ellejp/storage/images/fashion/celeb/selenagomez-bestsnap-2016_17_02/node_1087470/19466418-1-jpn-JP/2017-6-7-NY_image_size_192_x.jpg
            //   http://img.elle.co.jp/var/ellejp/storage/images/fashion/celeb/selenagomez-bestsnap-2016_17_02/node_1087470/19466418-1-jpn-JP/2017-6-7-NY.jpg
            return src.replace(/_image_size_[0-9]+_x(?:_[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "ipravda.sk") {
            // https://ipravda.sk/res/2018/05/03/thumbs/rok-2008-spevacka-adele-na-fotografii-z-new-yorku-stvorec.jpg
            //   https://ipravda.sk/res/2018/05/03/rok-2008-spevacka-adele-na-fotografii-z-new-yorku.jpg
            // https://ipravda.sk/res/2017/06/07/thumbs/selena-gomez_01-nestandard1.jpg
            //   https://ipravda.sk/res/2017/06/07/selena-gomez_01.jpg
            return src.replace(/\/thumbs\/([^/]*)-(?:stvorec|nestandard[0-9]*)(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com") {
            // https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/147002.max-620x600.jpg
            //   https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/147002.original.jpg
            // https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/76827.2e16d0ba.fill-276x245.jpg
            //   https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/76827.original.jpg
            // https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/ADAMMIRAI.2e16d0ba.fill-295x279.jpg
            //   https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/ADAMMIRAI.original.jpg
            // doesn't work for all:
            // https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/GettyImages-818219262.2e16d0ba.fill-295x279.jpg
            //   https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/GettyImages-818219262.original.jpg -- doesn't work
            // but it does work for other GettyImages:
            // https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/GettyImages-927227080.2e16d0ba.fill-295x279.jpg
            //   https://d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com/images/GettyImages-927227080.original.jpg
            return src.replace(/(\/images\/[^/.]+\.)[^/]*(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "nation.com.pk") {
            // https://nation.com.pk/print_images/small/2018-01-21/rihanna-moving-to-london-1516485654-4082.jpg
            // error when specifying other:
            // Please specify size. Eg: thumbnail, small, medium, large
            return src.replace(/\/print_images\/[a-z]+\//, "/print_images/large/");
        }

        if (domain === "dazedimg.dazedgroup.netdna-cdn.com") {
            // http://dazedimg.dazedgroup.netdna-cdn.com/320/0-0-558-372/azure/dazed-prod/1240/0/1240136.jpg
            //   https://dazedprod.blob.core.windows.net/dazed-prod/1240/0/1240136.jpg
            // http://dazedimg.dazedgroup.netdna-cdn.com/1600/azure/dazed-prod/1220/7/1227289.jpg
            //   https://dazedprod.blob.core.windows.net/dazed-prod/1220/7/1227289.jpg
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\/(?:[0-9]+-[0-9]+-[0-9]+-[0-9]+\/)?/, "$1");
        }

        if (domain === "www.fuse.tv") {
            // https://www.fuse.tv/image/5306185b012d11e57c000012/768/512/photo-of-rihanna-2005.jpg
            //   https://www.fuse.tv/image/5306185b012d11e57c000012/photo-of-rihanna-2005.jpg
            return src.replace(/(\/image\/[0-9a-f]+\/)[0-9]+\/[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain === "assets.capitalxtra.com") {
            // https://assets.capitalxtra.com/2018/17/rihanna-1525427948-hero-wide-v4-0.jpg
            //   https://assets.capitalxtra.com/2018/17/rihanna-1525427948.jpg
            return src.replace(/(\/[^/.]*-[0-9]{8,})-[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.ukmix.org") {
            // https://www.ukmix.org/proxy.php?code=3b69a1220d68c617d6dbba93ccf0ace35a34abf823b8a6e17ae123a692765a43&url=aHR0cDovL2NkbmkuY29uZGVuYXN0LmNvLnVrLzQxMHg1NDAva19uL25vdi0yMDA1X2NvdmVyczIwMDVfZ2xfMjJkZWMxMF9iLmpwZw%3D%3D
            //   https://cdni.condenast.co.uk/410x540/k_n/nov-2005_covers2005_gl_22dec10_b.jpg
            return atob(decodeURIComponent(src.replace(/.*\/proxy\.php.*?[?&]url=([^&]*).*/, "$1")));
        }

        if (domain === "www.washingtonpost.com" &&
            src.indexOf("/pbox.php?") >= 0) {
            // https://www.washingtonpost.com/pbox.php?url=http://m.static.newsvine.com/servista/imagesizer?file=meena-hart-duerson--today9358FF7B-91E7-365E-2C23-5DD8416B1703.jpg&width=500&w=1484&op=resize&opt=1&filter=antialias&t=20170517
            //   http://m.static.newsvine.com/servista/imagesizer?file=meena-hart-duerson--today9358FF7B-91E7-365E-2C23-5DD8416B1703.jpg
            newsrc = src.replace(/.*?\/pbox\.php.*?[?&]url=([^&]*).*$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "m.static.newsvine.com" &&
            src.indexOf("/servista/imagesizer?") >= 0) {
            // http://m.static.newsvine.com/servista/imagesizer?file=meena-hart-duerson--today9358FF7B-91E7-365E-2C23-5DD8416B1703.jpg&width=400
            //   http://m.static.newsvine.com/servista/imagesizer?file=meena-hart-duerson--today9358FF7B-91E7-365E-2C23-5DD8416B1703.jpg
            return src.replace(/(\/servista\/imagesizer).*?[?&](file=[^&]*).*/, "$1?$2");
        }

        if (domain.match(/theprecious[0-9]*\.cosplaywon\.com/)) {
            // https://theprecious.cosplaywon.com/uploads/post/photo/5198/small_1f3238d6-d48d-42a0-947b-546c14c4771d.jpg
            //   https://theprecious.cosplaywon.com/uploads/post/photo/5198/original_1f3238d6-d48d-42a0-947b-546c14c4771d.jpg -- 3396x5315
            //   https://theprecious.cosplaywon.com/uploads/post/photo/5198/1f3238d6-d48d-42a0-947b-546c14c4771d.jpg          -- 3396x5315
            // https://theprecious2.cosplaywon.com/uploads/post/photo/5051/medium_49ef7a15-37c2-4f6e-a147-4ab6c5bcbfa2.jpg
            //   https://theprecious2.cosplaywon.com/uploads/post/photo/5051/original_49ef7a15-37c2-4f6e-a147-4ab6c5bcbfa2.jpg
            return src.replace(/(\/photo\/[0-9]+\/)[a-z]+_([-0-9a-f]+\.[^/.]*)$/, "$1original_$2");
        }

        if (domain_nowww === "otaku.com") {
            // https://otaku.com/files/images/thumbs/THUMB_206306J2.JPG
            //   https://otaku.com/files/images/fullsize/206306J2.JPG
            // https://otaku.com/files/images/items/206306J.JPG
            //   https://otaku.com/files/images/fullsize/206306J.JPG
            return src.replace(/(\/files\/images\/)[^/]*\/(?:[A-Z]+_)?([^/]*)$/, "$1fullsize/$2");
        }

        if (domain.match(/img[0-9]*\.joyreactor\.com/)) {
            // http://img0.joyreactor.com/pics/post/art-shingeki-no-kyojin-anime-anime-art-2196554.jpeg
            //   http://img0.joyreactor.com/pics/post/full/art-shingeki-no-kyojin-anime-anime-art-2196554.jpeg
            return src.replace(/(\/pics\/post\/)([^/]*)$/, "$1full/$2");
        }

        if (domain_nowww === "coolwallpaperz.info") {
            // http://coolwallpaperz.info/user-content/uploads/wall/thumb/62/dark-anime-art-colorful-girl-free-hd-917493.jpg
            //   http://www.coolwallpaperz.info/user-content/uploads/wall/o/62/dark-anime-art-colorful-girl-free-hd-917493.jpg
            return src.replace(/(\/uploads\/wall\/)thumb(\/[0-9]+\/[^/]*)$/, "$1o$2");
        }

        if (domain_nowww === "besthqwallpapers.com") {
            // https://besthqwallpapers.com/Uploads/29-3-2018/46318/thumb2-vocaloid-kagamine-rin-kagamine-len-anime-characters-art.jpg
            //   https://besthqwallpapers.com/uploads/29-3-2018/46318/vocaloid-kagamine-rin-kagamine-len-anime-characters-art.jpg
            return src.replace(/(\/[0-9]+\/)thumb[0-9]*-([^/]*)$/, "$1$2");
        }

        if (domain === "avatanplus.com") {
            // https://avatanplus.com/files/resources/mid/5aedb0878e6e31633079919f.png -- 700x826
            //   https://avatanplus.com/files/resources/original/5aedb0878e6e31633079919f.png -- 823x972
            // https://avatanplus.com/resize.php?type=resources&mode=mid&file=5aedb0878e6e31633079919f.png
            //   https://avatanplus.com/files/resources/original/5aedb0878e6e31633079919f.png
            if (src.indexOf("/resize.php?") >= 0) {
                var type = url.searchParams.get("type");
                var file = url.searchParams.get("file");
                return "https://avatanplus.com/files/" + type + "/original/" + file;
            }
            return src
                .replace(/(\/files\/[a-z]+)\/[a-z]+\/([0-9a-f]+\.[^/.]*)$/, "$1/original/$2");
        }

        if (domain === "bbd-1tmxd3aba43noa.stackpathdns.com") {
            // https://bbd-1tmxd3aba43noa.stackpathdns.com/data/thumbs/full/595/196/145/0/0/bill-gates-jpg.jpg
            //   https://bbd-1tmxd3aba43noa.stackpathdns.com/data/images/full/595/bill-gates-jpg.jpg
            return src.replace(/\/data\/thumbs\/full\/([0-9]+)\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9]+\/([^/]*)$/,
                               "/data/images/full/$1/$2");
        }

        if (domain === "studiosol-a.akamaihd.net") {
            // https://studiosol-a.akamaihd.net/letras/215x215/fotos/c/d/e/1/cde1fd38a3142bc266c221f69fb9ee60.jpg
            //   https://studiosol-a.akamaihd.net/uploadfile/letras/fotos/c/d/e/1/cde1fd38a3142bc266c221f69fb9ee60.jpg
            // https://studiosol-a.akamaihd.net/letras/76x76/albuns/d/b/e/b/605161510258737-tb_180.jpg
            //   https://studiosol-a.akamaihd.net/uploadfile/letras/albuns/d/b/e/b/605161510258737-tb_180.jpg
            return src.replace(/(:\/\/[^/]*\/)([a-z]+)\/[0-9]+x[0-9]+\//, "$1uploadfile/$2/");
        }

        if (amazon_container === "quietus_production") {
            // http://s3.amazonaws.com/quietus_production/images/articles/24550/TFSMeatspace_1525802422_crop_168x168.jpg
            //   http://s3.amazonaws.com/quietus_production/images/articles/24550/TFSMeatspace_1525802422.jpg
            return src.replace(/_crop_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "bmi.com" &&
            src.indexOf("/images/") >= 0) {
            // https://www.bmi.com/images/photoblog/2010/cache/bmi_country_106052425ED006_58th_Annual__770_1103_90.JPG
            // https://www.bmi.com/images/photoblog/2010/cache/bmi_country_106052425ED006_58th_Annual__770_1103_90_s.JPG
            //   https://www.bmi.com/images/photoblog/2010/bmi_country_106052425ED006_58th_Annual_.JPG
            return src.replace(/\/cache\/([^/]*)_[0-9]+_[0-9]+_[0-9]+(?:_[a-z]+)?(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "i.warosu.org") {
            // https://i.warosu.org/data/lit/thumb/0062/33/1425676352426s.jpg
            //   https://i.warosu.org/data/lit/img/0062/33/1425676352426.jpg
            return src.replace(/\/thumb\/([0-9]+\/[0-9]+\/[0-9]+)s?(\.[^/.]*)$/, "/img/$1$2");
        }

        if (domain === "media.rbl.ms") {
            // haven't tested due to redirect
            // https://media.rbl.ms/image?u=%2Ffiles%2F2016%2F03%2F06%2F6359289786772823741235385117_articletaylor6.gif&ho=https%3A%2F%2Faz616578.vo.msecnd.net&s=473&h=bcac1953f8a26948e31526d400fd22ea593e9f404b32236b52589cc0d8dbf28e&size=980x&c=3774816102
            // https://az616578.vo.msecnd.net/files/2016/03/06/6359289786772823741235385117_articletaylor6.gif
            if (src.indexOf("/image?") >= 0) {
                var u = decodeURIComponent(url.searchParams.get("u")).replace(/^([^/])/, "/$1");
                var ho = decodeURIComponent(url.searchParams.get("ho")).replace(/\/$/, "");
                return ho + u;
            }
        }

        if (domain_nowww === "filepicker.io") {
            // https://filepicker.io/api/file/9ej84qIQYKLgNFAbt4bz/convert?align=top&fit=clip&h=500&w=698
            //   https://filepicker.io/api/file/9ej84qIQYKLgNFAbt4bz
            return {
                url: src.replace(/\/convert\?.*/, ""),
                head_wrong_contenttype: true
            };
        }

        if (domain === "cdn.teenidols4you.com" ||
            domain === "www.teenidols4you.com") {
            // http://cdn.teenidols4you.com/thumb/Actors/katyperry/88katy-perry-1379801521.jpg
            //   http://www.teenidols4you.com/thumb/Actors/katyperry/katy-perry-1379801521.jpg
            //   http://www.teenidols4you.com/blink/Actors/katyperry/katy-perry-1379801521.jpg
            return src.replace(/:\/\/[^/]*\/thumb\/(.*?)\/(?:[0-9]+)?([^/]*)$/, "://www.teenidols4you.com/blink/$1/$2");
        }

        if (domain === "cdn.pixabay.com") {
            // https://cdn.pixabay.com/photo/2017/03/10/12/16/airbus-2132610_960_720.jpg
            //   https://pixabay.com/en/photos/download/airbus-2132610.jpg
            newsrc = src.replace(/.*?\/photo\/.*\/([^/]*-[0-9]+)_+[0-9]+[^/]*(\.[^/.]*)$/,
                                 "https://pixabay.com/en/photos/download/$1$2");
            if (newsrc !== src)
                return {
                    url: newsrc,
                    redirects: true,
                    headers: {
                        Cookie: "is_human=1"
                    }
                };
        }

        if (domain.indexOf(".meetupstatic.com") >= 0) {
            // https://secure.meetupstatic.com/photos/member/4/b/1/6/thumb_180259222.jpeg
            // https://secure.meetupstatic.com/photo_api/event/rx308x180/cpt/cr308x180/ql90/sgb54c13bc46/314373292.jpeg
            //   https://secure.meetupstatic.com/photos/event/8/2/0/c/600_314373292.jpeg
            //   https://secure.meetupstatic.com/photos/event/8/2/0/c/highres_314373292.jpeg
            //   https://secure.meetupstatic.com/photos/event/0/0/0/highres_314373292.jpeg
            // http://photos3.meetupstatic.com/photos/event/1/e/1/a/highres_13507706.jpeg -- 3264x2448
            return src
                .replace(/\/photo_api\/([^/]*)\/.*\/([0-9]+\.[^/.]*)$/, "/photos/$1/0/0/0/highres_$2")
                .replace(/\/(?:thumb|[0-9]+)_([0-9]+\.[^/.]*)$/, "/highres_$1");
        }

        if (domain === "d38c5dutwb1t0j.cloudfront.net") {
            // https://d38c5dutwb1t0j.cloudfront.net/Pictures/780xany/7/6/2/130762_shutterstock_174080612.jpg
            //   https://d38c5dutwb1t0j.cloudfront.net/Pictures/9999999xany/7/6/2/130762_shutterstock_174080612.jpg
            return src.replace(/\/Pictures\/[0-9a-z]+x[0-9a-z]+\//, "/Pictures/9999999xany/");
        }

        if (domain === "img.drillspin.com") {
            // http://img.drillspin.com/oi/200/06/DSAX259106.jpg
            //   http://img.drillspin.com/oi/orig/06/DSAX259106.jpg
            // http://img.drillspin.com/ar/144/27/DSAX317727.jpg
            //   http://img.drillspin.com/ar/orig/27/DSAX317727.jpg
            return src.replace(/(:\/\/[^/]*\/[a-z]+\/)[0-9]+\//, "$1orig/");
        }

        if (domain === "pics.drillspin.com") {
            // http://pics.drillspin.com/url/park/db05/bf82/d9aa/9177/dec1/596a/7871/95e3/200.jpg
            //   http://pics.drillspin.com/url/park/db05/bf82/d9aa/9177/dec1/596a/7871/95e3/orig.jpg
            return src.replace(/\/[0-9]+(\.[^/.]*)$/, "/orig$1");
        }

        if (domain === "cdn.britannica.com") {
            // https://cdn.britannica.com/100x53/50/71350-118-1F17F9C4.jpg
            //   https://cdn.britannica.com/50/71350-118-1F17F9C4.jpg
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+\//, "$1");
        }

        if (domain_nowww === "pets4homes.co.uk") {
            // https://www.pets4homes.co.uk/images/articles/4276/large/why-might-your-cats-whiskers-fall-out-597f347251d52.jpg
            //   https://www.pets4homes.co.uk/images/articles/4276/original/why-might-your-cats-whiskers-fall-out-597f347251d52.jpg
            // https://www.pets4homes.co.uk/images/breeds/15/large/ea8fd9c9deb4550031c94c9bd7c104f5.jpeg
            //   https://www.pets4homes.co.uk/images/breeds/15/original/ea8fd9c9deb4550031c94c9bd7c104f5.jpeg
            return src.replace(/(\/images\/[^/]+\/[0-9]+\/)[a-z]+\/([^/]*)$/, "$1original/$2");
        }

        if (domain === "r.hswstatic.com") {
            // https://r.hswstatic.com/w_256/gif/now-EOAfigPY-tomatoeyes_hansneleman_gettyimagesjpg-1210-680.jpg
            //   https://s.hswstatic.com/gif/now-EOAfigPY-tomatoeyes_hansneleman_gettyimagesjpg-1210-680.jpg
            return src.replace(/:\/\/[^/]*\/[a-z]_[0-9]+\//, "://s.hswstatic.com/");
        }

        if (domain === "www.candb.com") {
            // https://www.candb.com/site/candb/cache/artwork/130/dragon-age_the-queen-of-staves_bioware-main_104x180.jpg
            //   https://www.candb.com/site/candb/images/artwork/dragon-age_the-queen-of-staves_bioware-main.jpg
            // https://www.candb.com/site/candb/cache/artwork/1600/dragon-age_the-queen-of-staves_bioware-main_926x1600_marked.jpg
            //   https://www.candb.com/site/candb/images/artwork/dragon-age_the-queen-of-staves_bioware-main.jpg
            return src.replace(/(\/candb\/)cache\/([^/]*\/)[0-9]+\/([^/]*)_[0-9]+x[0-9]+(?:[^/]*)?(\.[^/.]*)$/, "$1images/$2$3$4");
        }

        if (domain === "www.ottawalife.com") {
            // http://www.ottawalife.com/admin/cms/images/small/olmgamer-dives-back-into-thedas-with-dragonage-inquisition-3-jpg.jpg
            //   http://www.ottawalife.com/admin/cms/images/large/olmgamer-dives-back-into-thedas-with-dragonage-inquisition-3-jpg.jpg
            return src.replace(/\/cms\/images\/[a-z]+\//, "/cms/images/large/");
        }

        if (domain === "assets.rpgsite.net") {
            // https://assets.rpgsite.net/images/images/000/026/311/block/DAI_Jun92014_16.jpg
            //   https://assets.rpgsite.net/images/images/000/026/311/original/DAI_Jun92014_16.jpg
            return src.replace(/(\/images\/[0-9]+\/[0-9]+\/[0-9]+\/)[a-z]+\/([^/]+)$/, "$1original/$2");
        }

        if (domain_nowww === "nusabali.com") {
            // https://www.nusabali.com/article_images/30694/berryhardianto-juara-australia-terbuka-2018-thumb-2018-05-14-153840_0.jpg
            //   https://www.nusabali.com/article_images/30694/berryhardianto-juara-australia-terbuka-2018-2018-05-14-153840_0.jpg
            // https://www.nusabali.com/article_images/30694/berryhardianto-juara-australia-terbuka-2018-800-2018-05-14-153840_0.jpg
            //   https://www.nusabali.com/article_images/30694/berryhardianto-juara-australia-terbuka-2018-2018-05-14-153840_0.jpg
            // doesn't work for all:
            // https://www.nusabali.com/article_images/30669/pgri-bali-soroti-turunnya-nilai-un-800-2018-05-14-115025_0.jpg
            // https://www.nusabali.com/article_images/30669/pgri-bali-soroti-turunnya-nilai-un-thumb-2018-05-14-115025_0.jpg
            return src.replace(/(\/article_images\/[0-9]+\/[^/]*)-(?:thumb|800)(-[0-9]+-[0-9]+-[0-9]+-[0-9]+_[0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.wowkeren.com") {
            // https://www.wowkeren.com/display/images/160x117/2018/05/13/00208257.jpg
            //   https://www.wowkeren.com/display/images/photo/2018/05/13/00208257.jpg
            return src.replace(/\/display\/images\/[0-9]+x[0-9]+\//, "/display/images/photo/");
        }

        if (domain === "asset.kompas.com") {
            // https://asset.kompas.com/crop/113x0:787x449/185x124/data/photo/2018/05/14/4120396036.jpg
            //   https://asset.kompas.com/data/photo/2018/05/14/4120396036.jpg
            return src.replace(/\/crop\/[0-9x:]+\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain === "img.4plebs.org") {
            // http://img.4plebs.org/boards/hr/thumb/1526/06/1526064949904s.jpg
            //   http://img.4plebs.org/boards/hr/image/1526/06/1526064949904.jpg
            return src.replace(/\/thumb(\/[0-9]+\/[0-9]+\/[0-9]+)[a-z](\.[^/.]*)$/, "/image$1$2");
        }

        if (domain === "cdn.thinglink.me") {
            // https://cdn.thinglink.me/api/image/777977483742937091/1024/10/scaletowidth
            //   https://cdn.thinglink.me/api/image/777977483742937091
            return src.replace(/(\/api\/image\/[0-9]+)\/.*$/, "$1");
        }

        if (domain === "images.sk-static.com") {
            // https://images.sk-static.com/images/media/profile_images/artists/8825119/huge_avatar
            //   https://images.sk-static.com/images/media/profile_images/artists/8825119/original
            return src.replace(/(\/[0-9]+\/)[a-z_]+$/, "$1original");
        }

        if (domain === "www.stalkcelebs.com" && src.indexOf("/img-folder/") >= 0) {
            // http://www.stalkcelebs.com/img-folder/2018/04/dove-cameron-in-bikini-top-at-v-house-at-coachella-april-14-2018_t_119071958.jpg
            //   http://www.stalkcelebs.com/img-folder/2018/04/dove-cameron-in-bikini-top-at-v-house-at-coachella-april-14-2018_119071958.jpg
            return src.replace(/_t(_[0-9]+\.[^/.]*)$/, "$1");
        }

        if (domain === "www.picsofcelebrities.com") {
            // https://www.picsofcelebrities.com/media/celebrity/dove-cameron/pictures/medium/dove-cameron-kids.jpg
            //   https://www.picsofcelebrities.com/celebrity/dove-cameron/pictures/large/dove-cameron-kids.jpg
            // https://www.picsofcelebrities.com/media/celebrity/dove-cameron/pictures/medium/dove-cameron-2016.jpg
            //   https://www.picsofcelebrities.com/celebrity/dove-cameron/pictures/large/dove-cameron-2016.jpg
            return src.replace(/\/media(\/.*\/pictures\/)[a-z]+(\/[^/]*)$/, "$1large$2");
        }

        if (domain === "dxglax8otc2dg.cloudfront.net") {
            // https://dxglax8otc2dg.cloudfront.net/media/cache/people/idols/akiyama20090906-thumb.6648e6aae2cc.jpg
            //   https://dxglax8otc2dg.cloudfront.net/media/people/idols/akiyama20090906.jpg
            // https://dxglax8otc2dg.cloudfront.net/media/cache/people/groups/momusu_googleprofile_20150101_thumb.08ba8c8b3ef2.jpg
            //   https://dxglax8otc2dg.cloudfront.net/media/people/groups/momusu_googleprofile_20150101.jpg
            return src.replace(/\/media\/cache\/(.*)[-_]thumb\.[a-f0-9]+(\.[^/.]*)$/, "/media/$1$2");
        }

        if (domain === "photos.smugmug.com") {
            // thanks to /u/GarlicoinAccount on reddit for the example URLs and regex!
            // https://photos.smugmug.com/Portfolio/i-FsKpjtH/0/bc0067fc/L/Dubai%20at%20Dusk-L.jpg
            //   https://photos.smugmug.com/Portfolio/i-FsKpjtH/0/bc0067fc/O/Dubai%20at%20Dusk-O.jpg
            //   https://photos.smugmug.com/Portfolio/i-FsKpjtH/0/bc0067fc/O/.jpg
            // https://photos.smugmug.com/Galleries/Portfolio/i-97t56hx/0/85d1ded6/S/brentgoesoutside%20-%20Deep%20Cold%20-%2020180116_Deep%20Cold_Madison%20WI-S.jpg
            //   https://photos.smugmug.com/Portfolio/i-97t56hx/0/85d1ded6/O/brentgoesoutside%20-%20Deep%20Cold%20-%2020180116_Deep%20Cold_Madison%20WI-O.jpg
            //   gets redirected to:
            //   https://photos.smugmug.com/Galleries/Portfolio/i-97t56hx/0/85d1ded6/XL/brentgoesoutside%20-%20Deep%20Cold%20-%2020180116_Deep%20Cold_Madison%20WI-XL.jpg
            // https://photos.smugmug.com/Portfolio/i-97t56hx/0/85d1ded6/M/brentgoesoutside%20-%20Deep%20Cold%20-%2020180116_Deep%20Cold_Madison%20WI-M.jpg
            //   https://photos.smugmug.com/Portfolio/i-97t56hx/0/85d1ded6/O/brentgoesoutside%20-%20Deep%20Cold%20-%2020180116_Deep%20Cold_Madison%20WI-O.jpg
            // https://photos.smugmug.com/Outdoors/Los-Padres-National-Forest/i-Pm68s3d/0/f60a0297/X5/MCJ05326-X5.jpg
            //   https://photos.smugmug.com/Outdoors/Los-Padres-National-Forest/i-Pm68s3d/0/f60a0297/O/MCJ05326-O.jpg
            //   gets redirected to:
            //   https://photos.smugmug.com/Outdoors/Los-Padres-National-Forest/i-Pm68s3d/0/f60a0297/5K/MCJ05326-5K.jpg
            // https://photos.smugmug.com/Outdoors/Los-Padres-National-Forest/i-Pm68s3d/0/f60a0297/4K/MCJ05326-4K.jpg
            //   https://photos.smugmug.com/Outdoors/Los-Padres-National-Forest/i-Pm68s3d/0/f60a0297/O/MCJ05326-O.jpg
            // https://photos.smugmug.com/Outdoors/Los-Padres-National-Forest/i-Pm68s3d/0/f60a0297/XL/MCJ05326-XL.jpg
            //   https://photos.smugmug.com/Outdoors/Los-Padres-National-Forest/i-Pm68s3d/0/f60a0297/O/MCJ05326-O.jpg
            // https://photos.smugmug.com/Portfolio/Seattle-Sights/West-Seattle/i-PXJzQVB/1/7e0dd2ae/XL/DSC01014-Edit-1-XL.jpg
            //   https://photos.smugmug.com/Portfolio/Seattle-Sights/West-Seattle/i-PXJzQVB/1/7e0dd2ae/O/DSC01014-Edit-1-O.jpg -- 5168x3448, doesn't get redirected after
            //   https://photos.smugmug.com/Portfolio/Seattle-Sights/West-Seattle/i-PXJzQVB/1/7e0dd2ae/O/DSC01014-Edit-1-XL.jpg -- works too
            // https://photos.smugmug.com/Travel/Jongno-2018/i-647W9cb/0/686f9fdc/S/20180504-DSC_7229-Edit.jpg
            //   https://photos.smugmug.com/Travel/Jongno-2018/i-647W9cb/0/686f9fdc/O/20180504-DSC_7229-Edit.jpg
            // https://photos.smugmug.com/GWDC/2016/i-4WJhmJM/15/1b532670/X3/ATW06318-X3.jpg
            //   https://photos.smugmug.com/GWDC/2016/i-4WJhmJM/15/1b532670/4K/ATW06318-4K.jpg
            //return src.replace(/^((?:https?:)\/\/photos\.smugmug\.com\.?\/.+?\/)[A-Z0-9]{1,2}(\/[^\/]+?-)[A-Z0-9]{1,2}\.jpg(?:$|\?|#)/i,'$1O$2O.jpg');
            return {
                //url: src.replace(/(\/i-[A-Za-z0-9]+\/[0-9]\/[a-f0-9]+\/)[A-Z0-9]+(\/[^/.]*-)[A-Z0-9]+(\.[^/.?]*)(?:\?.*)?$/, "$1O$2O$3"),
                url: src.replace(/(\/i-[A-Za-z0-9]+\/[0-9]+\/[a-f0-9]+\/)[A-Z0-9]+(\/[^/]*)(?:\?.*)?$/, "$1O$2"),
                redirects: true
            };
        }

        if (domain.indexOf(".i.lithium.com") >= 0) {
            // https://spotify.i.lithium.com/t5/image/serverpage/image-id/84635i3C36019474421E94/image-size/large?v=1.0&px=999
            //   https://spotify.i.lithium.com/t5/image/serverpage/image-id/84635i3C36019474421E94/image-size/original?v=1.0
            var v = src.replace(/.*[?&](v=[^&]*).*/, "$1");
            if (v === src)
                v = "";
            else
                v = "?" + v;

            return {
                url: src.replace(/\/image-size\/[^/]*(?:\?.*)?$/, "/image-size/original" + v),
                head_wrong_contentlength: true
            };
        }

        if (domain === "www.favepeople.com") {
            // https://www.favepeople.com/photos/h0/35/h035d7s238i5e5o5c97b.jpg
            //   https://www.favepeople.com/photos/h0/35/h035d7s238i5e5o5c97b_b/Dove_Cameron_Red_Carpet_Style_3528.jpg
            // https://www.favepeople.com/photos/66/fe/66fe7i5d284bb46hnc04_s.jpg
            //   https://www.favepeople.com/photos/66/fe/66fe7i5d284bb46hnc04_b.jpg
            // https://www.favepeople.com/photos/a9/21/a921h8naond6e6d46es0/Pom_Klementieff_Red_Carpet_Style_38325.jpg -- 650x1069
            //   https://www.favepeople.com/photos/a9/21/a921h8naond6e6d46es0_b/Pom_Klementieff_Red_Carpet_Style_38325.jpg -- 2443x4020
            return src.replace(/(\/photos\/[0-9a-z]+\/[0-9a-z]+\/[0-9a-z]+)(?:_[a-z]+)?(\/[^/]*)?(\.[^/.]*)$/, "$1_b$2$3");
        }

        if (domain === "img.anews.com") {
            // https://img.anews.com/r/358x188/20161207/59703483.jpg
            //   https://img.anews.com/media/posts/images/20161207/59703483.jpg
            // https://img.anews.com/?url=https://img.anews.com/media/posts/images/20171210/81978684.jpg&w=358&h=188
            newsrc = src.replace(/.*\?url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);

            return src.replace(/\/r\/[0-9]+x[0-9]+\//, "/media/posts/images/");
        }

        if (domain_nowww === "realitytvworld.com" ||
            domain === "cdn.realitytvworld.com") {
            // https://cdn.realitytvworld.com/images/heads/gen/embedded/1064843-s.jpg
            //   https://cdn.realitytvworld.com/images/heads/gen/embedded/1064843-l.jpg
            return src.replace(/(\/heads\/gen\/embedded\/[0-9]+)-[a-z](\.[^/.]*)$/, "$1-l$2");
        }

        if (domain === "video.newsserve.net") {
            // https://video.newsserve.net/300/v/20170223/1487811916-Dove-Cameron-Shay-Mitchell-amp-amp-Ariel-Winter.jpg
            //   https://video.newsserve.net/v/20170223/1487811916-Dove-Cameron-Shay-Mitchell-amp-amp-Ariel-Winter.jpg
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\//, "$1");
        }

        if (domain === "m.aceshowbiz.com" ||
            domain === "www.aceshowbiz.com") {
            // https://m.aceshowbiz.com/images/wennpic/preview/dove-cameron-2017-iheartradio-mmva-arrivals-01.jpg
            //   https://www.aceshowbiz.com/images/wennpic/dove-cameron-2017-iheartradio-mmva-arrivals-01.jpg
            //   https://m.aceshowbiz.com/images/wennpic/dove-cameron-2017-iheartradio-mmva-arrivals-01.jpg
            // https://www.aceshowbiz.com/display/images/160x117/2018/05/18/00120311.jpg
            //   https://www.aceshowbiz.com/display/images/photo/2018/05/18/00120311.jpg
            return src
                .replace(/(\/display\/images\/)[0-9]+x[0-9]+\//, "$1/photo/")
                .replace(/(\/images\/[^/]*\/)preview\//, "$1");
        }

        if (domain_nowww === "laughspark.info") {
            // http://www.laughspark.info/thumbfiles/290X169/beautiful-dove-cameron-at-thirst-gala-20-635792432637591680-16984.jpg
            //   http://laughspark.info/uploadfiles/beautiful-dove-cameron-at-thirst-gala-20-635792432637591680-16984.jpg
            return src.replace(/\/thumbfiles\/[0-9]+X[0-9]+\//, "/uploadfiles/");
        }

        if (domain.match(/media[0-9]*.giphy.com/)) {
            // https://media.giphy.com/media/3og0IRYXdt9tTE52nK/giphy.gif
            // https://media.giphy.com/media/3og0IRYXdt9tTE52nK/giphy.mp4
            // https://media1.giphy.com/media/l0Iy0lyLZnfdEBmMg/200w.webp
            // https://media1.giphy.com/media/l0Iy0lyLZnfdEBmMg/200w.gif
            // https://media2.giphy.com/media/ZBg5XWrvDVzNe/200_s.gif
            return src.replace(/\/(?:giphy|[0-9]+[whs_]*)\.(?:gif|webp|mp4)/, "/source.gif");
        }

        if (domain === "pics.dmm.com" ||
            domain === "pics.dmm.co.jp") {
            // http://pics.dmm.com/mono/movie/n_612fxbr80160r/n_612fxbr80160rps.jpg
            //   http://pics.dmm.com/mono/movie/n_612fxbr80160r/n_612fxbr80160rpl.jpg
            // https://pics.dmm.co.jp/livechat/00776976/profile_s.jpg
            return src.replace(/s(\.[^/.]*)$/, "l$1");
        }

        if (domain === "www.showgle.co.kr" &&
            src.indexOf("/uploads/") >= 0) {
            // http://www.showgle.co.kr/uploads/data/team_info_new/photos/201803/7ede4d9a797f3899dcdc547f0fd673b2_m.jpg
            //   http://www.showgle.co.kr/uploads/data/team_info_new/photos/201803/7ede4d9a797f3899dcdc547f0fd673b2.jpg
            return src.replace(/(\/[0-9a-f]+)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain === "static.artbible.info") {
            // https://static.artbible.info/medium/lastman_kruisiging.jpg
            //   https://static.artbible.info/large/lastman_kruisiging.jpg
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\//, "$1large/");
        }

        // IIIF (todo: move to bottom, make generic)
        if (domain === "lakeimagesweb.artic.edu" ||
            domain === "gallica.bnf.fr") {
            // first is region:
            // java.lang.IllegalArgumentException: Invalid region
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.Region.fromUri(Region.java:56)
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.Parameters.(Parameters.java:78)
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.ImageResource.doGet(ImageResource.java:62)
            // second is size:
            // java.lang.IllegalArgumentException: Invalid size
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.Size.fromUri(Size.java:80)
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.Parameters.(Parameters.java:80)
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.ImageResource.doGet(ImageResource.java:62)
            // last is rotation:
            // java.lang.IllegalArgumentException: Invalid rotation
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.Rotation.fromUri(Rotation.java:29)
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.Parameters.(Parameters.java:79)
	    //   at edu.illinois.library.cantaloupe.resource.iiif.v2.ImageResource.doGet(ImageResource.java:62)
	    //   at sun.reflect.GeneratedMethodAccessor4.invoke(Unknown Source)

            // https://lakeimagesweb.artic.edu/iiif/2/08baefe5-1f78-bc4b-db7b-4f53d2edcc29/full/!800,800/0/default.jpg
            //   https://lakeimagesweb.artic.edu/iiif/2/08baefe5-1f78-bc4b-db7b-4f53d2edcc29/full/full/0/default.jpg
            // http://gallica.bnf.fr/iiif/ark:/12148/btv1b6000531z/f1/0,0,1024,1024/256,256/0/native.jpg
            //   http://gallica.bnf.fr/iiif/ark:/12148/btv1b6000531z/f1/full/full/0/native.jpg
            newsrc = src.replace(/(\/iiif\/.*?\/)[^/]+\/[^/]+\/[^/]+\/([^/]+\.[^/.]*)$/, "$1full/full/0/$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "gallica.bnf.fr") {
            return {
                url: src,
                head_wrong_contenttype: true
            };
        }

        if (domain_nowww === "koodtv.com") {
            // https://koodtv.com/data/apms/video/youtube/thumb-T-18eNTsNk0_180x320.jpg
            //   https://koodtv.com/data/apms/video/youtube/T-18eNTsNk0.jpg
            return src.replace(/\/thumb-([^/.]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "file.bodnara.co.kr") {
            // http://file.bodnara.co.kr/logo/insidelogo.php?image=%2Fhttp%3A%2F%2Ffile.bodnara.co.kr%2Fwebedit%2Fnews%2F2005%2F1150168644-3gate_at_computex2006_1.jpg
            //   http://file.bodnara.co.kr/webedit/news/2005/1150168644-3gate_at_computex2006_1.jpg
            return decodeURIComponent(src.replace(/.*?\/insidelogo\.php.*?[?&]image=([^&]*).*$/, "$1")).replace(/^\/*/, "");
        }

        if (domain === "passport.mobilenations.com") {
            // https://passport.mobilenations.com/avatars/000/000/000/100x100_42.jpg?r=9
            //   https://passport.mobilenations.com/avatars/000/000/000/42.jpg?r=9
            return src.replace(/\/[0-9]+x[0-9]+_([^/]*\.[^/.]*)$/, "/$1");
        }

        // monetate
        if (domain === "www.dollargeneral.com" &&
            src.indexOf("/media/") >= 0) {
            // https://www.dollargeneral.com/media/catalog/product/cache/image/700x700/e9c3970ab036de70892d86c6d221abfe/1/3/13480701.jpg
            //   https://www.dollargeneral.com/media/catalog/product/cache/image/e9c3970ab036de70892d86c6d221abfe/1/3/13480701.jpg
            // https://www.dollargeneral.com/media/catalog/product/cache/thumbnail/90x90/beff4985b56e3afdbeabfc89641a4582/1/3/13480701_6.jpg
            //   https://www.dollargeneral.com/media/catalog/product/cache/image/beff4985b56e3afdbeabfc89641a4582/1/3/13480701_6.jpg
            return src.replace(/\/cache\/(?:image|thumbnail)\/[0-9]+x[0-9]+\//, "/cache/image/");
        }

        if (domain === "www.dollartree.com" &&
            src.indexOf("/assets/") >= 0) {
            // https://www.dollartree.com/assets/product_images_2016/styles/xlarge/214435.jpg
            //   https://www.dollartree.com/assets/product_images_2016/styles/jumbo/214435.jpg
            // https://www.dollartree.com/assets/product_images_2016/styles/jumbo/114193.jpg -- 3000x3000
            return src.replace(/\/styles\/[^/]*\/([^/]*)$/, "/styles/jumbo/$1");
        }

        if (domain === "d2192bm55jmxp1.cloudfront.net") {
            // https://d2192bm55jmxp1.cloudfront.net/resize/s/article/201801/9e7b653cf2fd97604b64198dd954676e52819077d7e80540113ec5508f641629.jpg
            //   https://d2192bm55jmxp1.cloudfront.net/resize/l/article/201801/9e7b653cf2fd97604b64198dd954676e52819077d7e80540113ec5508f641629.jpg
            //   https://d2192bm55jmxp1.cloudfront.net/origin/article/201801/9e7b653cf2fd97604b64198dd954676e52819077d7e80540113ec5508f641629.jpg
            return src.replace(/\/resize\/[a-z]+\//, "/origin/");
        }

        if (domain === "i.marieclaire.com.tw") {
            // https://i.marieclaire.com.tw/assets/mc/201805/800X533/5AF92AC270A191526278850.jpg
            //   https://i.marieclaire.com.tw/assets/mc/201805/5AF92AC270A191526278850.jpeg
            // https://i.marieclaire.com.tw/assets/mc/201805/80X80/5AF92AC7DAA811526278855.jpg
            //   https://i.marieclaire.com.tw/assets/mc/201805/5AF92AC7DAA811526278855.jpeg
            newsrc = src.replace(/\/[0-9]+X[0-9]+\/([0-9A-F]+\.[^/.]*)$/, "/$1");
            if (newsrc !== src) {
                return [newsrc.replace(/\.jpg$/, ".jpeg"), newsrc];
            }
        }

        if (domain === "img.vogue.com.tw" ||
            // https://img.gq.com.tw/_rs/645/userfiles/sm/sm1024_images_A1/26353/2016021660174717.jpg
            //   https://img.gq.com.tw/userfiles/sm/sm1024_images_A1/26353/2016021660174717.jpg
            domain === "img.gq.com.tw") {
            // https://img.vogue.com.tw/_rs/960/userfiles/FCK/2018051404582865.jpg
            //   https://img.vogue.com.tw/userfiles/FCK/2018051404582865.jpg
            return src.replace(/\/_rs\/[0-9]+\//, "/");
        }

        if (domain === "niuerdata.donews.com") {
            // http://niuerdata.donews.com/data/shareimg_oss/new_thumb/2018/05/21/thumb_692f2b93a7d515a7c853ceb6020763a5.JPEG
            //   http://niuerdata.donews.com/data/shareimg_oss/big_media_img/2018/05/21/692f2b93a7d515a7c853ceb6020763a5.JPEG
            // http://niuerdata.donews.com/data/shareimg_oss/big_media_img/2018/04/16/6251df21989522b68b9cd500ec26894c.JPEG -- 4032x2269
            return src
                .replace(/\/new_thumb\//, "/big_media_img/")
                .replace(/\/thumb_([0-9a-f]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "pictures.icpress.cn") {
            // wip
            // http://pictures.icpress.cn/thumbs/imgs/2018/0511/20180511_83981s.jpg
            //   http://pictures.icpress.cn/thumbs/imgs/2018/0511/20180511_83981.jpg
            return src.replace(/s(\.[^/.]*)$/, "$1");
        }

        if ((domain === "interview365.mk.co.kr" &&
             src.indexOf("/images/") >= 0) && false) {
            // http://interview365.mk.co.kr/paper/data/news/images/2012/08/2915_S_1343748329.jpg -- 480x324
            //   http://interview365.mk.co.kr/paper/data/news/images/2012/08/2915_L_1343748329.jpg -- same
            // http://interview365.mk.co.kr/paper/data/news/images/2017/09/4272_S_1505186288.jpg -- 99x66
            //   http://interview365.mk.co.kr/paper/data/news/images/2017/09/4272_L_1505186288.jpg -- 2236x1488
            // doesn't work for all:
            // http://interview365.mk.co.kr/paper/data/news/images/2017/07/4273_S_1500613825.jpg -- 800x1024
            //   http://interview365.mk.co.kr/paper/data/news/images/2017/07/4273_L_1500613825.jpg -- not found
            return src.replace(/(\/[0-9]+_)[A-Z](_[0-9]+\.[^/.]*)$/, "$1L$2");
        }

        if (domain === "draw.acharts.net") {
            // https://draw.acharts.net/cover/93803-55f057f54dd47-s.jpg
            //   https://draw.acharts.net/cover/93803-55f057f54dd47-l.jpg
            return src.replace(/-[a-z](\.[^/.]*)$/, "-l$1");
        }

        if (domain === "www.renwenjun.com") {
            // http://www.renwenjun.com/uploads/allimg/170929/12012X635_lit.jpg
            //   http://www.renwenjun.com/uploads/allimg/170929/12012X635_0.jpg
            return src.replace(/_lit(\.[^/.]*)$/, "_0$1");
        }

        if (domain === "gqhotstuff.gq.com.mx") {
            // http://gqhotstuff.gq.com.mx/api/photos/small/886.jpg
            //   http://gqhotstuff.gq.com.mx/api/photos/medium/886.jpg
            //   http://gqhotstuff.gq.com.mx/api/photos/original/886.jpg
            // http://gqhotstuff.gq.com.mx/api/photos/medium/115.jpg -- upscaled
            //   http://gqhotstuff.gq.com.mx/api/photos/original/115.jpg -- smaller, not upscaled
            // http://gqhotstuff.gq.com.mx/api/photos/medium/100.jpg -- smaller
            //   http://gqhotstuff.gq.com.mx/api/photos/original/100.jpg -- larger, not upscaled
            return src.replace(/\/api\/photos\/[a-z]+\//, "/api/photos/original/");
        }

        if (domain === "images.apester.com") {
            // https://images.apester.com/user-images%2Faa%2Faaecb0949e6508374487f5f8dc120595.jpg/400/undefined/undefined
            //   https://images.apester.com/user-images%2Faa%2Faaecb0949e6508374487f5f8dc120595.jpg
            return src.replace(/(:\/\/[^/]*\/[^/]*\.[^/.]*)\/[/a-z0-9]+$/, "$1");
        }

        if (domain === "twt-thumbs.washtimes.com") {
            // https://twt-thumbs.washtimes.com/media/image/2017/04/25/tv-disney-descendants_77076_c0-218-2002-1385_s885x516.jpg?888310701b41d5af593b29f6b17ebf6bfadcfec1
            //   https://twt-media.washtimes.com/media/image/2017/04/25/tv-disney-descendants_77076.jpg
            // https://twt-thumbs.washtimes.com/media/image/2018/01/30/AP_17060654021879_s4096x2865.jpg?be8aca3bb879af6c6a7bfa91ffb108283c5ad921
            //   https://twt-media.washtimes.com/media/image/2018/01/30/AP_17060654021879.jpg
            return src.replace(/(:\/\/twt-)thumbs(\.[^/]*\/media\/image\/.*?)_[cs][0-9][-_0-9a-z]+(\.[^/.?]*)(?:\?.*)?$/, "$1media$2$3");
        }

        if (domain === "dynamicmedia.zuza.com") {
            // https://www.therecord.com/whatson-story/7496991-new-on-dvd-for-aug-15-descendants-2-alien-covenant-/
            // https://dynamicmedia.zuza.com/zz/m/original_/8/b/8b4ce612-1bac-40dd-ac6b-e4365811da43/B823485990Z.1_20170810201750_000_G5B1UCEI3.2_Super_Portrait.jpg
            //  https://dynamicmedia.zuza.com/zz/m/original_/8/b/8b4ce612-1bac-40dd-ac6b-e4365811da43/B823485990Z.1_20170810201750_000_G5B1UCEI3.2.jpg
            // https://dynamicmedia.zuza.com/zz/m/cropped_135x90/9/6/963074a2-e60d-43a9-9a9c-d4e5e3fae1aa/B88187086Z.1_20180518174044_000_GA76EN9Q.8-0_150x100.jpg
            //   https://dynamicmedia.zuza.com/zz/m/original_/9/6/963074a2-e60d-43a9-9a9c-d4e5e3fae1aa/B88187086Z.1_20180518174044_000_GA76EN9Q.8-0_150x100.jpg
            //   https://dynamicmedia.zuza.com/zz/m/original_/9/6/963074a2-e60d-43a9-9a9c-d4e5e3fae1aa/B88187086Z.1_20180518174044_000_GA76EN9Q.8-0_Super_Portrait.jpg
            //   https://dynamicmedia.zuza.com/zz/m/original_/9/6/963074a2-e60d-43a9-9a9c-d4e5e3fae1aa/B88187086Z.1_20180518174044_000_GA76EN9Q.8-0.jpg
            //   http://media.zuza.com/9/6/963074a2-e60d-43a9-9a9c-d4e5e3fae1aa/B88187086Z.1_20180518174044_000_GA76EN9Q.8-0_150x100.jpg -- https is not supported
            return src
                .replace(/\/zz\/m\/[^/]*\//, "/zz/m/original_/")
                .replace(/_[^-./]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "images.commeaucinema.com") {
            // http://images.commeaucinema.com/galerie/153509_5ddfccd27e59616c161c5742a63bfd42.jpg -- 260x192
            //   http://images.commeaucinema.com/galerie/big/153509_5ddfccd27e59616c161c5742a63bfd42.jpg -- 3152x2336
            return src.replace(/\/galerie\/([^/]*)$/, "/galerie/big/$1");
        }



        if (domain === "static.screenweek.it" ||
            amazon_container === "static.screenweek.it") {
            // https://s3-eu-west-1.amazonaws.com/static.screenweek.it/2016/11/29/Descendants%202%20Sofia%20Carson%20Dove%20Cameron%20foto%20dal%20film%202_mid.jpg?1480423066
            // http://static.screenweek.it/2016/11/29/Descendants%202%20Sofia%20Carson%20Dove%20Cameron%20foto%20dal%20film%202_mid.jpg?1480423066
            //   http://static.screenweek.it/2016/11/29/Descendants%202%20Sofia%20Carson%20Dove%20Cameron%20foto%20dal%20film%202_big.jpg?1480423066
            //   http://static.screenweek.it/2016/11/29/Descendants%202%20Sofia%20Carson%20Dove%20Cameron%20foto%20dal%20film%202.jpg?1480423066
            return src.replace(/_[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "filmstarjackets.com") {
            // https://filmstarjackets.com/image/cache/data/Nov15/mal-descendants-dove-cameron-leather-jacket-1000x1100.jpg
            //   https://filmstarjackets.com/image/data/Nov15/mal-descendants-dove-cameron-leather-jacket.jpg
            return src.replace(/\/image\/cache\/data\/(.*)-[0-9]+x[0-9]+(\.[^/.]*)$/, "/image/data/$1$2");
        }

        if (domain === "da4pli3l5vc0d.cloudfront.net") {
            // https://da4pli3l5vc0d.cloudfront.net/0f/dd/0fdd8b9ee75364aff60f148056780047a7dc282e/h=310,w=414,crop=top-20/?app=portal&sig=48add57365ba639191586c902db821d28579a8ebe483ba48027c34b5f221fa94
            //   https://da4pli3l5vc0d.cloudfront.net/0f/dd/0fdd8b9ee75364aff60f148056780047a7dc282e
            return src.replace(/(:\/\/[^/]*\/(?:(?:[0-9a-f]{2})\/){2}[0-9a-f]+)\/.*$/, "$1");
        }

        if (domain.match(/photo\.media[0-9]*\.hollywood\.com/)) {
            // http://photo.media.hollywood.com/prevcln/3/2/3/32368979.jpg
            //   http://photo.media.hollywood.com/full/3/2/3/32368979.jpg
            return src.replace(/(:\/\/[^/]*\/)[^/]*\//, "$1full/");
        }

        if (domain === "www.youloveit.ru" &&
            src.indexOf("/uploads/posts/") >= 0) {
            // http://www.youloveit.ru/uploads/posts/2017-07/thumbs/1499865322_youloveit_ru_nasledniki_2_foto_s_krasnoi_kovrovoi_dorogki02.jpg
            //   http://www.youloveit.ru/uploads/posts/2017-07/1499865322_youloveit_ru_nasledniki_2_foto_s_krasnoi_kovrovoi_dorogki02.jpg
            return src.replace(/\/thumbs\//, "/");
        }

        if (domain_nowww === "tooob.com" &&
            src.indexOf("/api/") >= 0) {
            // https://tooob.com/api/objs/read/noteid/28530874/__image.scaled_1024
            //   https://tooob.com/api/objs/read/noteid/28530874/
            return src.replace(/(\/[0-9]+\/)__[^/]*$/, "$1");
        }

        if (domain.match(/akphoto[0-9]*\.ask\.fm/)) {
            // https://akphoto1.ask.fm/7d2/b3007/cd69/4a06/af54/e29092f7214e/large/324723.jpg -- upscaled
            // doesn't work:
            // https://akimg0.ask.fm/385/22354/974c/48f4/80af/c420c25977ef/normal/5115678.jpg
            //   transforming to akphoto0, akphoto1, doesn't work, large doesn't work either
            return src.replace(/\/[a-z]+\/([0-9]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "alchetron.com") {
            // https://alchetron.com/cdn/dove-cameron-b073b951-002f-4a02-b6ee-947523dfd11-resize-750.jpeg
            //   https://alchetron.com/cdn/dove-cameron-b073b951-002f-4a02-b6ee-947523dfd11.jpeg
            return src.replace(/-resize-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.ltn.com.tw") {
            // thanks to @rEnr3n on github
            // http://img.ltn.com.tw/Upload/ent/page/800/2018/05/10/2422261_2.jpg -- 800x800
            //   http://img.ltn.com.tw/Upload/ent/page/orig/2018/05/10/2422261_2.jpg -- 2000x2000
            // http://img.ltn.com.tw/Upload/ent/page/400S/2018/05/22/phpsyErCP.jpg -- 400x533
            //   http://img.ltn.com.tw/Upload/ent/page/orig/2018/05/22/phpsyErCP.jpg -- 720x960
            // other:
            // http://img.ltn.com.tw/Upload/Module/2/497/1496422.jpg -- 650x400
            // http://img.ltn.com.tw/Upload/liveNews/BigPic/600_phpbfGlgC.jpg -- 600x402
            // http://img.ltn.com.tw/Upload/liveNews/BigPic/600_phpmMJrzu.jpg -- 2500x1268
            // http://img.ltn.com.tw/2013/new/oct/4/images/bigPic/600_43.jpg -- 1627x1627
            // http://img.ltn.com.tw/Upload/3c/page/2017/12/30/171230-32502-1.jpg -- 3801x2534
            return src.replace(/\/Upload\/ent\/page\/[^/]+\//, "/Upload/ent/page/orig/");
        }

        if (domain.match(/cdn[a-z]?\.lystit\.com/)) {
            // https://cdnc.lystit.com/520/650/n/photos/missguided/549604c4/missguided-designer-mustard-Mustard-Yellow-Satin-Asymmetric-Twist-Front-Maxi-Dress.jpeg
            //   https://cdnc.lystit.com/photos/missguided/549604c4/missguided-designer-mustard-Mustard-Yellow-Satin-Asymmetric-Twist-Front-Maxi-Dress.jpeg
            // https://cdnb.lystit.com/200/250/tr/photos/nordstrom/3c5054da/mulberry-Clay-Small-Zip-Bayswater-Classic-Leather-Tote.jpeg
            //   https://cdnb.lystit.com/photos/nordstrom/3c5054da/mulberry-Clay-Small-Zip-Bayswater-Classic-Leather-Tote.jpeg
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\/[0-9]+\/[0-9a-z]+\/photos\//, "$1photos/");
        }

        if (domain === "www.newshub.co.nz") {
            // http://www.newshub.co.nz/home/entertainment/2018/01/golden-globes-2018-red-carpet-highlights-a-red-carpet-flooded-in-black/_jcr_content/par/image_1284270800.dynimg.1200.q75.jpg/v1515372069805/GettyImages-902328010.jpg
            //   http://www.newshub.co.nz/home/entertainment/2018/01/golden-globes-2018-red-carpet-highlights-a-red-carpet-flooded-in-black/_jcr_content/par/image_1284270800.dynimg.full.q75.jpg/v1515372069805/GettyImages-902328010.jpg
            // https://www.newshub.co.nz/home/world/2017/12/how-one-plastic-bag-can-harm-millions-of-creatures/_jcr_content/par/image.dynimg.1280.q75.jpg/v1512865401357/GettyImages-612269120-plastic-bag-pollution-ocean-environment-1120.jpg
            //   https://www.newshub.co.nz/home/world/2017/12/how-one-plastic-bag-can-harm-millions-of-creatures/_jcr_content/par/image.dynimg.full.q75.jpg/v1512865401357/GettyImages-612269120-plastic-bag-pollution-ocean-environment-1120.jpg
            return src.replace(/(\/image(?:[_.][0-9]+)?\.dynimg\.)[^/]*(\.q[0-9]+\.[^/.]*)(\/.*)?$/, "$1full$2$3");
        }

        if (domain === "mediaassets.wxyz.com") {
            // https://mediaassets.wxyz.com/photo/2018/05/22/poster_22074aded9dd4214ae42eb62a4404769_87749608_ver1.0_320_240.jpg
            //   https://mediaassets.wxyz.com/photo/2018/05/22/poster_22074aded9dd4214ae42eb62a4404769_87749608_ver1.0.jpg
            return src.replace(/_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (amazon_container === "s3.931wolfcountry.com" ||
            // http://assets.instyle.co.uk/instyle/live/styles/article_landscape_600_wide/s3/14/01/schiaparelli-catwalk.jpg
            domain === "assets.instyle.co.uk" ||
            // https://kpopimg.s3.amazonaws.com/styles/article_image/s3/eunice-dia.jpg?itok=5JoH8xh6
            //   https://kpopimg.s3.amazonaws.com/eunice-dia.jpg?itok=5JoH8xh6
            domain === "kpopimg.s3.amazonaws.com") {
            // http://s3.amazonaws.com/s3.931wolfcountry.com/styles/full_content_width__775px_max_/s3/USATSI_10787675.jpg?itok=o8qUHpri
            //   http://s3.amazonaws.com/s3.931wolfcountry.com/USATSI_10787675.jpg?itok=o8qUHpri
            return src.replace(/\/styles\/[^/]*\/s3\//, "/");
        }

        if (domain.match(/media[0-9]*\.s-nbcnews\.com/)) {
            // https://media3.s-nbcnews.com/i/newscms/2017_24/1221281/headshot_nbc_b0b4262799627ca0e2e9fffd7b72458c.jpg -- 2832x4256
            // https://media4.s-nbcnews.com/i/newscms/2017_41/1289217/nialhoran-171016-today-tease_7e3030f1a03215e26135bb6d77ced11c.jpg -- 10721x6031
            // https://media3.s-nbcnews.com/j/newscms/2018_21/1340735/billboard-awards-jenna-dewan-today-180521_64d305c86902f706a7b4dc0667946774.760;1811;7;70;3.jpg -- 760x1811
            //   https://media3.s-nbcnews.com/i/newscms/2018_21/1340735/billboard-awards-jenna-dewan-today-180521_64d305c86902f706a7b4dc0667946774.jpg -- 1049x2500
            // https://media2.s-nbcnews.com/j/newscms/2018_21/1340737/billboard-awards-jlo-today-180521-main-art_aa1d851db712d9a513b768ee4646e442.focal-1000x500.jpg -- 1000x500
            //   https://media2.s-nbcnews.com/i/newscms/2018_21/1340737/billboard-awards-jlo-today-180521-main-art_aa1d851db712d9a513b768ee4646e442.jpg -- 2400x1200
            return src.replace(/(:\/\/[^/]*\/)j(\/.*\/[^/.]*)[^/]*(\.[^/.]*)$/, "$1i$2$3");
        }

        if (domain === "imgcp.aacdn.jp") {
            // https://imgcp.aacdn.jp/img-a/488/auto/global-aaj-front/article/2017/10/59d2800498c16_59d27ee42664e_1369399827.JPG
            //   https://imgcp.aacdn.jp/img-a/auto/auto/global-aaj-front/article/2017/10/59d2800498c16_59d27ee42664e_1369399827.JPG
            // https://imgcp.aacdn.jp/img-a/488/auto/global-aaj-front/article/2017/04/58dfa1fb6bf8b_58df9dd195c06_277476442.JPG
            //   https://imgcp.aacdn.jp/img-a/auto/auto/global-aaj-front/article/2017/04/58dfa1fb6bf8b_58df9dd195c06_277476442.JPG
            // https://imgcp.aacdn.jp/img-a/1720/auto/global-aaj-front/article/2017/02/589a9891100fd_589a94dd4439c_950604468.jpg
            //   https://imgcp.aacdn.jp/img-a/auto/auto/global-aaj-front/article/2017/02/589a9891100fd_589a94dd4439c_950604468.jpg
            return src.replace(/\/img-a\/[0-9a-z]+\/[0-9a-z]+\//, "/img-a/auto/auto/");
        }

        if (domain === "kpopselca.com") {
            // http://kpopselca.com/selca/thumb/49457_i-cant-breathe.jpg
            return src.replace(/\/selca\/thumb\//, "/selca/");
        }

        if (domain === "www.koogle.tv") {
            // http://www.koogle.tv/static/media/uploads/newest-news-2/.thumbnails/052418_blackpink_jennie_01-120x120.jpg
            //   http://www.koogle.tv/static/media/uploads/newest-news-2/052418_blackpink_jennie_01.jpg
            return src.replace(/\/\.thumbnails\/([^/]*)-[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "fanaru.com") {
            // http://fanaru.com/waup/image/thumb/188305-waup-wassup.jpg -- 280x210
            //   http://fanaru.com/waup/image/188305-waup-wassup.jpg -- 3888x2592
            return src.replace(/\/image\/thumb\//, "/image/");
        }

        if (domain === "d9nvuahg4xykp.cloudfront.net" ||
            // https://d1w8cc2yygc27j.cloudfront.net/1150484398913714461/8578329675259839686_thumbnail.jpg
            //   https://d1w8cc2yygc27j.cloudfront.net/1150484398913714461/8578329675259839686.jpg
            domain === "d1w8cc2yygc27j.cloudfront.net") {
            // https://d9nvuahg4xykp.cloudfront.net/-9212700925596145478/-1193646998958160813_thumbnail.jpg
            //   https://d9nvuahg4xykp.cloudfront.net/-9212700925596145478/-1193646998958160813.jpg
            return src.replace(/_thumbnail(\.[^/.]*)$/, "$1");
        }

        if (domain === "i.lihkg.com") {
            // https://i.lihkg.com/540/http://gifyu.com/images/cc018d69be4eb6e68887da85d6dd83b9.jpg
            //   https://gifyu.com/images/cc018d69be4eb6e68887da85d6dd83b9.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+\//, "");
        }

        if (domain === "www.nintendoworldreport.com" &&
            src.indexOf("/media/") >= 0) {
            // http://www.nintendoworldreport.com/media/37218/1/gallery/12.jpg
            //   http://www.nintendoworldreport.com/media/37218/1/12.jpg
            return src.replace(/\/gallery\/([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "nintendoeverything.com" &&
            src.indexOf("/gallery/") >= 0) {
            // https://www.nintendoeverything.com/wp-content/gallery/fatal-frame-maiden-of-black-water-8515/thumbs/thumbs_fatal-frame-18.jpg
            //   https://nintendoeverything.com/wp-content/gallery/fatal-frame-maiden-of-black-water-8515/fatal-frame-18.jpg
            return src.replace(/\/thumbs\/thumbs_([^/]*)$/, "/$1");
        }

        if (domain === "images.nintendolife.com") {
            // http://images.nintendolife.com/news/2015/09/first_impressions_taking_a_shot_at_fatal_frame_maiden_of_black_water/attachment/0/900x.jpg
            //   http://images.nintendolife.com/news/2015/09/first_impressions_taking_a_shot_at_fatal_frame_maiden_of_black_water/attachment/0/original.jpg
            return src.replace(/(\/attachment\/[^/]*\/)[^/]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "cdn.igromania.ru") {
            // https://cdn.igromania.ru/mnt/articles/4/b/7/9/4/d/30165/preview/e4c138a20130c713_336x189.jpg
            //   https://cdn.igromania.ru/mnt/articles/4/b/7/9/4/d/30165/preview/e4c138a20130c713_original.jpg
            // https://cdn.igromania.ru/mnt/articles/b/0/8/f/d/3/27221/70b17403b362d9c9_1200xH.jpg
            //   https://cdn.igromania.ru/mnt/articles/b/0/8/f/d/3/27221/70b17403b362d9c9.jpg
            // doesn't work for all:
            // https://cdn.igromania.ru/mnt/articles/b/0/8/f/d/3/27221/html/img/ca7afa51a9675c1d.jpg
            //   https://cdn.igromania.ru/mnt/articles/b/0/8/f/d/3/27221/html/img/ca7afa51a9675c1d_original.jpg -- 404
            // https://www.igromania.ru/mnt/news/9/4/4/8/4/1/74580/html/more/d97ea5df6c0eddf6_original.jpg -- but this works
            return src.replace(/(\/[0-9a-f]+)(?:_[^-_/.]*)?(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain === "i.blogs.es") {
            // https://i.blogs.es/824e4f/bayonetta/150_150.jpg
            //   https://i.blogs.es/824e4f/bayonetta/original.jpg
            return src.replace(/\/[0-9]+_[0-9]+(\.[^/.]*)$/, "/original$1");
        }

        if (domain === "resize.rbl.ms") {
            // https://resize.rbl.ms/image?source=https%3A%2F%2Fassets.rbl.ms%2F3689460%2F1216x700.jpg&size=2000%2C2000&c=qkxiCnuqMLv4GT53
            //   https://assets.rbl.ms/3689460/origin.jpg
            return decodeURIComponent(src.replace(/.*\/image.*?[?&]source=([^&]*).*/, "$1"));
        }

        if (domain === "i.paigeeworld.com") {
            // https://i.paigeeworld.com/user-media/1452729600000/5350f6d7ad9e9cec0bb7e1be_56978883e1cf0a1d06737577_320.jpg -- 320x226
            //   https://i.paigeeworld.com/user-media/1452729600000/5350f6d7ad9e9cec0bb7e1be_56978883e1cf0a1d06737577_rz.jpg -- 5787x4093
            return src.replace(/(\/user-media\/[0-9]+\/[0-9a-f]+_[0-9a-f]+_)[^/.]*(\.[^/.]*)$/, "$1rz$2");
        }

        if (domain === "1d31c772ec21a65b0a71-0707aae3004193da193e1ad4a942592d.ssl.cf2.rackcdn.com") {
            // https://1d31c772ec21a65b0a71-0707aae3004193da193e1ad4a942592d.ssl.cf2.rackcdn.com/24688/fatal_frame_treehouse__default-news-image.png
            //   https://1d31c772ec21a65b0a71-0707aae3004193da193e1ad4a942592d.ssl.cf2.rackcdn.com/24688/fatal_frame_treehouse.png
            // https://1d31c772ec21a65b0a71-0707aae3004193da193e1ad4a942592d.ssl.cf2.rackcdn.com/24680/fatalframelooksbrettygoodguizee32015__medium.png
            //   https://1d31c772ec21a65b0a71-0707aae3004193da193e1ad4a942592d.ssl.cf2.rackcdn.com/24680/fatalframelooksbrettygoodguizee32015.png
            return src.replace(/(:\/\/[^/]*\/[0-9]+\/[^/.]*)__[^_/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "i.nextmedia.com.au") {
            // https://i.nextmedia.com.au/Utils/ImageResizer.ashx?n=https%3A%2F%2Fi.nextmedia.com.au%2FFeatures%2Fvampyr3.jpg&w=820&c=0&s=1
            //   https://i.nextmedia.com.au/Features/vampyr3.jpg
            return decodeURIComponent(src.replace(/.*\/Utils\/ImageResizer\.ashx.*?[?&]n=([^&]*).*?$/, "$1"));
        }

        if (domain.match(/dyn[0-9]*\.heritagestatic\.com/)) {
            // https://dyn1.heritagestatic.com/lf?set=path%5B1%2F5%2F3%2F6%2F2%2F15362544%5D%2Csizedata%5B850x600%5D&call=url%5Bfile%3Aproduct.chain%5D
            //   ?set=path[1/5/3/6/2/15362544],sizedata[850x600]&call=url[file:product.chain]
            //
            //   https://dyn1.heritagestatic.com/lf?set=path%5B1%2F5%2F3%2F6%2F2%2F15362544%5D&call=url%5Bfile%3Aproduct.chain%5D
            // https://dyn1.heritagestatic.com/lf?set=path%5B1%2F5%2F3%2F6%2F2%2F15362543%5D&call=url%5Bfile%3Aproduct.chain%5D
            //   ?set=path[1/5/3/6/2/15362543]&call=url[file:product.chain]
            var set = url.searchParams.get("set");
            if (!set)
                return src;

            set = decodeURIComponent(set)
                .replace(/,sizedata\[[^,]*\]/, "")
                .replace(/,$/, "");

            return src.replace(/(.*[?&]set=)[^&]*(.*?)$/, "$1" + encodeURIComponent(set) + "$2");
        }

        if (domain === "natedsanders.com" &&
            src.indexOf("/ItemImages/") >= 0) {
            // https://natedsanders.com/ItemImages/000008/8339a_med.jpeg -- 600x163
            //   https://natedsanders.com/ItemImages/000008/8339a_lg.jpeg -- 4500x1224
            return src.replace(/(\/[0-9a-z]+)_[a-z]+(\.[^/.]*)$/, "$1_lg$2");
        }

        if (domain === "d1x0dndjbjw02n.cloudfront.net") {
            // https://d1x0dndjbjw02n.cloudfront.net/production/posts/eyecatches/000/001/438/thumb.jpg?1496817733
            //   https://d1x0dndjbjw02n.cloudfront.net/production/posts/eyecatches/000/001/438/original.jpg?1496817733
            return src.replace(/\/thumb(\.[^/.]*)$/, "/original$1");
        }

        if (domain === "summary-sv.fc2.com") {
            // https://summary-sv.fc2.com/api/resize_img.php?src=https%3A%2F%2Fsummary-img-sv.fc2.com%2Fsummaryfc2%2Fimg%2Fsummary%2Fwidget%2F100053655.jpeg&width=300&height=600&upd_date=2017-01-11%2008:28:37 -- upscaled
            //   https://summary-img-sv.fc2.com/summaryfc2/img/summary/widget/100053655.jpeg
            return decodeURIComponent(src.replace(/.*?\/api\/resize_img\.php.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain === "image.tmdb.org") {
            // https://image.tmdb.org/t/p/w500/76gfJrmdBADyJJXqI0GRgj01yUo.jpg -- 500x750
            //   https://image.tmdb.org/t/p/original/76gfJrmdBADyJJXqI0GRgj01yUo.jpg -- 2000x3000
            return src.replace(/\/[wh][0-9]+\/([0-9a-zA-Z]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain.indexOf(".nbcuni.com") >= 0 &&
            src.indexOf("/prod/image/") >= 0) {
            // http://tve-static-eonline.nbcuni.com/prod/image/698/238/TotalBellas_S3_Desktop_FeaturedMain_3000x1688_1500x844_1239294019624.jpg
            //   http://tve-static-eonline.nbcuni.com/prod/image/698/238/TotalBellas_S3_Desktop_FeaturedMain_3000x1688.jpg
            return src.replace(/_[0-9]+x[0-9]+_[0-9]{8,}(\.[^/.]*)$/, "$1");
        }

        if (domain === "embedly.massrelevance.com") {
            // https://embedly.massrelevance.com/1/image?key=fd577f7497bf11e0b95d4040d3dc5c07&url=https%3A%2F%2Finstagram.com%2Fp%2FBiPaOWNFUvm%2Fmedia%2F%3Fsize%3Dl
            //   https://instagram.com/p/BiPaOWNFUvm/media/?size=l
            return decodeURIComponent(src.replace(/.*\/image.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "img.day.az") {
            // https://img.day.az/2018/02/10/250x250f/sexiest-women-selena-gomez.jpg
            //   https://img.day.az/2018/02/10/sexiest-women-selena-gomez.jpg
            // https://img.day.az/2018/03/07/thumb/ali_kerimli.jpg
            //   https://img.day.az/2018/03/07/ali_kerimli.jpg
            return src.replace(/\/(?:(?:[0-9]+x[0-9]+[a-z]?)|thumb)(\/[^/]*)$/, "$1");
        }

        if (domain === "fotos.caras.uol.com.br") {
            // http://fotos.caras.uol.com.br/media/images/thumb/2017/05/08/img-767195-os-looks-dos-famosos-no-mtv-movie-tv-awards-201720170508101494249579.jpg
            //   http://fotos.caras.uol.com.br/media/images/large/2017/05/08/img-767195-os-looks-dos-famosos-no-mtv-movie-tv-awards-201720170508101494249579.jpg
            //   http://fotos.caras.uol.com.br/media/images/original/2017/05/08/img-767195-os-looks-dos-famosos-no-mtv-movie-tv-awards-201720170508101494249579.jpg
            return src.replace(/\/media\/images\/[^/]*\//, "/media/images/original/");
        }

        if (domain === "www.wmj.ru") {
            // https://www.wmj.ru/thumb/399x0/filters:quality(75)//imgs/2017/05/08/08/1061619/2968fac7cdf1514616b70339f0bd0a3b43c64341.jpg
            //   https://www.wmj.ru//imgs/2017/05/08/08/1061619/2968fac7cdf1514616b70339f0bd0a3b43c64341.jpg
            return src.replace(/\/thumb\/[0-9]+x[0-9]+\/filters:[^/]*\//, "/");
        }

        if (domain.indexOf("pic.centerblog.net") >= 0) {
            // http://thebootyhunter.t.h.pic.centerblog.net/de34e5dd.jpg
            //   http://thebootyhunter.t.h.pic.centerblog.net/o/de34e5dd.jpg
            // http://www.centerblog.net/ca/1e5f476d-s.jpg
            //   http://marilynjohn.m.a.pic.centerblog.net/1e5f476d-s.jpg
            //   http://marilynjohn.m.a.pic.centerblog.net/1e5f476d-m.jpg
            // http://marilynjohn.m.a.pic.centerblog.net/tumblr_p1edlhuTny1rxzh05o2_502.jpg
            //   http://marilynjohn.m.a.pic.centerblog.net/o/tumblr_p1edlhuTny1rxzh05o2_502.jpg
            // http://nounousylvie51.n.o.pic.centerblog.net/m/13174182_495970667254617_2594346124069563626_n_1.jpg
            //   http://nounousylvie51.n.o.pic.centerblog.net/o/13174182_495970667254617_2594346124069563626_n_1.jpg
            return src.replace(/(:\/\/[^/]*\/)(?:[a-z]\/)?([^/]*)$/, "$1o/$2");
        }

        if (domain === "d2n4wb9orp1vta.cloudfront.net") {
            // https://d2n4wb9orp1vta.cloudfront.net/cms/brand/PT/2017-PT/plastic-bag_bpf_2.jpeg;width=560
            //   https://d2n4wb9orp1vta.cloudfront.net/cms/brand/PT/2017-PT/plastic-bag_bpf_2.jpeg
            return src.replace(/;.*/, "");
        }

        if (domain === "gd.image-gmkt.com") {
            // https://gd.image-gmkt.com/li/353/589/801589353.g_400-w_g.jpg
            //   https://gd.image-gmkt.com/li/353/589/801589353.jpg
            return src.replace(/\.[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "toonpool.com") {
            // https://www.toonpool.com/user/589/thumbs/zombie_315250.jpg
            //   https://www.toonpool.com/user/589/files/zombie_3152505.jpg
            //   https://www.toonpool.com/user/589/files/zombie_3152509.jpg
            // https://www.toonpool.com/user/463/files/g7-finanzministertreffen_3153385.jpg
            //   https://www.toonpool.com/user/463/files/g7-finanzministertreffen_3153389.jpg
            // https://es.toonpool.com/user/589/files/smoke_signals_3044635.jpg
            //   https://es.toonpool.com/user/589/files/smoke_signals_3044639.jpg -- no watermark
            // 9 sometimes adds a watermark
            return src
                .replace(/(\/user\/[0-9]+\/)thumbs\/([^/.]+_[0-9]+)(\.[^/.]*)$/, "$1files/$29$3")
                .replace(/(\/user\/[0-9]+\/)files\/([^/.]+_[0-9]+)[0-9](\.[^/.]*)$/, "$1files/$29$3");
        }

        if (domain === "www.cartoonmovement.com") {
            // https://www.cartoonmovement.com/depot/cartoon_thumbnails/2018/06/04/executive_decision__paolo_calleri.jpeg
            //   https://www.cartoonmovement.com/depot/cartoons/2018/06/04/executive_decision__paolo_calleri.jpeg
            return src.replace(/\/cartoon_thumbnails\//, "/cartoons/");
        }

        if (domain_nosub === "sndimg.com") {
            // https://hgtvhome.sndimg.com/content/dam/images/hgtv/fullset/2015/5/11/0/HUHH2015-Curb-Appeal_Dallas-Chateau_4.jpg.rend.hgtvcom.231.231.suffix/1431354155331.jpeg
            //   https://hgtvhome.sndimg.com/content/dam/images/hgtv/fullset/2015/5/11/0/HUHH2015-Curb-Appeal_Dallas-Chateau_4.jpg
            return src.replace(/(\/[^/.]+\.[^/.]+)\.[^/]*(?:\/[^/]*)?$/, "$1");
        }

        if (domain === "st.hzcdn.com") {
            // https://st.hzcdn.com/fimgs/4da1bc970046413d_0612-w74-h74-b0-p0--home-design.jpg
            //   https://st.hzcdn.com/simgs/4da1bc970046413d_4-0612.jpg
            //   https://st.hzcdn.com/simgs/4da1bc970046413d_14-0612/transitional-kitchen.jpg
            // 14, 9, 4, 15, 8, 10, 11, 3, 13, 7, 2, 6, 1, 12, 5, 0
            return src
                .replace(/\/fimgs\/([0-9a-f]+)_([0-9]+)-[^/]*(\.[^/.]*)$/, "/simgs/$1_14-$2$3")
                .replace(/(\/simgs\/[0-9a-f]+)_[0-9]+(-[0-9]+[./])/, "$1_14$2");
        }

        if (domain === "www.axisanimation.com" &&
            src.indexOf("/assets/") >= 0) {
            // http://www.axisanimation.com/site/assets/files/1296/mjs5847.480x270.jpg
            //  http://www.axisanimation.com/site/assets/files/1296/mjs5847.jpg
            return src.replace(/\.[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "media.baselineresearch.com") {
            // https://media.baselineresearch.com/images/198582/198582_small.jpg
            //   https://media.baselineresearch.com/images/198582/198582_full.jpg
            return src.replace(/(\/[0-9]+_)[a-z]+(\.[^/.]*)$/, "$1full$2");
        }

        if (domain_nowww === "mireportz.com") {
            // http://www.mireportz.com/media/reviews/photos/thumbnail/300x300s/62/29/ad/6672-now-she-looks-like-trouble-taylor-swift-ditches-the-girlie-dresses-to-slink-onto-the-acm-red-carpet-in-a-sexy-crop-top-and-slit-skirt-44-1396850272.jpg
            //   http://www.mireportz.com/media/reviews/photos/original/62/29/ad/6672-now-she-looks-like-trouble-taylor-swift-ditches-the-girlie-dresses-to-slink-onto-the-acm-red-carpet-in-a-sexy-crop-top-and-slit-skirt-44-1396850272.jpg
            return src.replace(/\/photos\/thumbnail\/[0-9]+x[0-9]+[a-z]*\//, "/photos/original/");
        }

        if (domain.match(/bis?\.gazeta\.pl/)) {
            // http://bi.gazeta.pl/im/ca/69/16/z23502282J,Piekary-Slaskie--pielgrzymka-mezczyzn.jpg
            //   http://bi.gazeta.pl/im/ca/69/16/z23502282V,Piekary-Slaskie--pielgrzymka-mezczyzn.jpg
            //   http://bi.gazeta.pl/im/ca/69/16/z23502282V.jpg
            //   http://bi.gazeta.pl/im/ca/69/16/z23502282O.jpg
            //   http://bi.gazeta.pl/im/ca/69/16/z23502282O,Piekary-Slaskie--pielgrzymka-mezczyzn.jpg
            //   https://bis.gazeta.pl/im/ca/69/16/z23502282O,Piekary-Slaskie--pielgrzymka-mezczyzn.jpg
            // https://bi.gazeta.pl/im/1f/07/16/z23100191AA.jpg
            //   https://bi.gazeta.pl/im/1f/07/16/z23100191O.jpg
            return src.replace(/(\/z[0-9]+)[A-Z]+(,[^/.]*)?(\.[^/.]*)$/, "$1O$2$3");
        }

        if (domain.match(/cdn[0-9]*(-[a-z]+)?\.production\.[^./]*\.static6\.com$/)) {
            // https://cdn0-a.production.images.static6.com/ngR8X2ZyTXXuQwpawU-EyycTgbM=/673x379/smart/filters:quality(75):strip_icc():format(jpeg)/liputan6-media-production/medias/1961152/original/071093900_1520215866-20180304-Artis-Ini-Pose-Berbaring-di-Red-Carpet-Oscars-AP-1.jpg
            //   https://cdn0-a.production.liputan6.static6.com/medias/1961152/original/071093900_1520215866-20180304-Artis-Ini-Pose-Berbaring-di-Red-Carpet-Oscars-AP-1.jpg
            return src.replace(/(:\/\/cdn[0-9]*(?:-[a-z]+)?\.production\.)[^./]*(\.static6\.com)\/.*?\/([^/.-]+)-media-production\/(medias\/)/,
                               "$1$3$2/$4");
        }

        if (domain === "lajt.co.uk") {
            // http://lajt.co.uk/media/cache/235x177/uploads/article/2016/02/Pokochaj-koronki-2.jpg
            //   http://lajt.co.uk/media/cache/original/uploads/article/2016/02/Pokochaj-koronki-2.jpg
            return src.replace(/\/media\/cache\/[0-9]+x[0-9]+\//, "/media/cache/original/");
        }

        if (domain === "ellearabia.com") {
            // https://ellearabia.com/media/cache/photogallery_entry/uploads/cms/photo-gallery/entries/59b64fb94ef7b.jpg
            //   https://ellearabia.com/uploads/cms/photo-gallery/entries/59b64fb94ef7b.jpg
            return src.replace(/\/media\/cache\/[^/]*\//, "/");
        }

        if (domain === "static.t13.cl") {
            // http://static.t13.cl/ee_images/209706/063_488408753_(1)__360x.jpg
            //   http://static.t13.cl/ee_images/209706/063_488408753_(1).jpg
            return src.replace(/__[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.cosmo.com.ua") {
            // https://www.cosmo.com.ua/i/photos_publication/18451/400_535/5p74cZz7.jpg
            //   https://www.cosmo.com.ua/i/photos_publication/18451/5p74cZz7.jpg
            return src.replace(/(\/photos_publication\/[0-9]+\/)[0-9]+_[0-9]+\//, "$1");
        }

        if (domain.match(/p[0-9]*\.trrsf\.com/)) {
            // https://p2.trrsf.com/image/fget/cf/940/0/images.terra.com/2014/09/17/7-rihanna.jpg
            //   http://images.terra.com/2014/09/17/7-rihanna.jpg
            // https://p2.trrsf.com/image/fget/cf/552/370/217/0/620/300/images.terra.com/2018/06/07/lkjas.png
            //   http://images.terra.com/2018/06/07/lkjas.png
            return src.replace(/^[a-z]+:\/\/[^/]*\/image\/fget\/[^/]*\/(?:(?:[0-9]+\/){4})?[0-9]+\/[0-9]+\//, "http://");
        }

        if (domain === "c.igte.ch") {
            // http://c.igte.ch/?u=http:/%2Fwww.trendus.com/Content/Images/PhotoGallery/size1/rihanna-stili-79411-1162016234238.jpg
            //   http://www.trendus.com/Content/Images/PhotoGallery/size1/rihanna-stili-79411-1162016234238.jpg
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?[?&]u=([^&]*).*/, "$1"));
        }

        if (domain_nowww === "trendus.com") {
            // http://www.trendus.com/Content/Images/PhotoGallery/size2/rihanna-stili-79411-1162016234238.jpg
            //   http://trendus.com/Content/Images/PhotoGallery/original/rihanna-stili-79411-1162016234238.jpg
            return src.replace(/\/PhotoGallery\/size[0-9]*\//, "/PhotoGallery/original/");
        }

        if (domain === "mediacdn.grabone.co.nz") {
            // http://mediacdn.grabone.co.nz/asset/poDaw53KPl/box=615x0
            //   http://mediacdn.grabone.co.nz/asset/poDaw53KPl
            return src.replace(/(\/asset\/[-_=a-zA-Z0-9]+)\/[a-z]+=.*/, "$1");
        }

        if (domain === "cdn.glamour.es" ||
            // http://cdn.revistavanityfair.es/uploads/images/thumbs/201519/todos_los_looks_fabulosamente_indescriptibles_de_rihanna_38784214_93x125.jpg
            //   http://cdn.revistavanityfair.es/uploads/images/201519/todos_los_looks_fabulosamente_indescriptibles_de_rihanna_38784214.jpg
            domain === "cdn.revistavanityfair.es") {
            // http://cdn.glamour.es/uploads/images/thumbs/201419/gala_met_2014_todos_los_vestidos_de_la_alfombra_roja_343183988_667x1000.jpg
            //   http://cdn.glamour.es/uploads/images/201419/gala_met_2014_todos_los_vestidos_de_la_alfombra_roja_343183988.jpg
            return src.replace(/\/thumbs\/([0-9]+\/[^/.]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain.match(/i[0-9]*-cdn\.woman\.ru/)) {
            // http://i41-cdn.woman.ru/images/gallery/0/2/g_02d506839a15d0488cc92c0c4d9f892f_standart_2_1400x1100.jpg?02 -- stretched
            //   http://i41-cdn.woman.ru/images/gallery/0/2/g_02d506839a15d0488cc92c0c4d9f892f_standart.jpg?02
            return src.replace(/_[0-9]+_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        // https://ensimages-1tmxd3aba43noa.stackpathdns.com/data/images/full/30601/rihanna.jpg?h=700
        if (domain === "ensimages-1tmxd3aba43noa.stackpathdns.com" ||
            // http://images.enstarz.com/data/images/full/30601/rihanna.jpg?w=580
            // http://images.enstarz.com/data/thumbs/full/30601/810/0/0/0/rihanna.jpg
            //   http://images.enstarz.com/data/images/full/30601/rihanna.jpg
            domain === "images.enstarz.com" ||
            // https://bbd-1tmxd3aba43noa.stackpathdns.com/data/images/full/163561/rihanna-7-jpg.jpg?w=802&l=50&t=40
            domain === "bbd-1tmxd3aba43noa.stackpathdns.com") {
            return src
                .replace(/\/data\/thumbs\/[^/]*\/([0-9]+)\/(?:[0-9]+\/){4}/, "/data/images/full/$1/")
                .replace(/\?.*/, "");
        }

        if (domain === "image.brigitte.de" && false) {
            // https://image.brigitte.de/10933292/large1x1-622-622/585b7cb3885104046176db9052522e3f/GN/rihanna-bild.jpg
            //   https://image.brigitte.de/10933292/uncropped-0-0/c7d9d39acf0a47cc66553fd0536d4b58/rj/rihanna-bild.jpg
            //   https://image.brigitte.de/10933292/uncropped-0-0/585b7cb3885104046176db9052522e3f/GN/rihanna-bild.jpg -- doesn't work
            //return src.replace(/(:\/\/[^/]*\/[0-9]+\/)[^/]*(\/[0-9a-f]+\/)/, "$1uncropped-0-0$2"); // doesn't work
        }

        if (domain.match(/st-[^/.]*\.20minutos\.es/)) {
            // https://st-listas.20minutos.es/images/2016-07/413299/5021227_249px.jpg?1469993664
            //   https://st-listas.20minutos.es/images/2016-07/413299/5021227_original.jpg?1469993664
            return src.replace(/(\/[0-9]+)_[0-9]+px(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain.match(/cdn[0-9]*\.thehunt\.com/)) {
            // https://cdn1.thehunt.com/app/public/system/zine_images/4558527/zine_view_thumb/3d07f42e10e4992794c5f8246f8940ab.jpg
            //   https://cdn1.thehunt.com/app/public/system/zine_images/4558527/mobile/3d07f42e10e4992794c5f8246f8940ab.jpg
            //   https://cdn1.thehunt.com/app/public/system/zine_images/4558527/original/3d07f42e10e4992794c5f8246f8940ab.jpg
            // https://cdn1.thehunt.com/app/public/system/note_images/4585319/note_view/46cfbaeb48cf8001a85dec930875d86d.jpg
            //   https://cdn1.thehunt.com/app/public/system/note_images/4585319/original/46cfbaeb48cf8001a85dec930875d86d.jpg
            return src.replace(/(\/[0-9]+\/)[^/]*\/([0-9a-f]+\.[^/.]*)$/, "$1original/$2");
        }

        if (domain.match(/static[0-9]*\.devote\.se/)) {
            // http://static4.devote.se/gallery/small/20150708/257a5fd7c37599cc814b4760d98eeb81.jpg
            //   http://static4.devote.se/gallery/big/20150708/257a5fd7c37599cc814b4760d98eeb81.jpg
            return src.replace(/\/gallery\/[^/]+\//, "/gallery/big/");
        }

        if (domain_nowww === "vev.ru" &&
            src.indexOf("/uploads/images/") >= 0) {
            // http://www.vev.ru/uploads/images/00/01/43/2014/04/14/Rihanna-2014-MTV-Movie-Awards.jpg
            //   http://vev.ru/uploads/images/00/01/43/2014/04/14/Rihanna-2014-MTV-Movie-Awards_original.jpg
            return src.replace(/(?:_[a-z]+)?(\.[^/.]*)$/, "_original$1");
        }

        if (domain === "s.glbimg.com") {
            // http://s.glbimg.com/jo/eg/f/288x0/2012/11/14/156353044.jpg
            //   http://s.glbimg.com/jo/eg/f/original/2012/11/14/156353044.jpg
            return src.replace(/\/[0-9]+x[0-9]+\//, "/original/");
        }

        if (domain === "image.xahoi.com.vn") {
            // http://image.xahoi.com.vn/resize_580x1100/news/2014/12/15/taylor-swift22.jpg
            //   http://image.xahoi.com.vn/news/2014/12/15/taylor-swift22.jpg
            return src.replace(/\/resize_[0-9]+x[0-9]+\//, "/");
        }

        if (domain.match(/s[0-9]*\.intermoda\.ru/)) {
            // http://s1.intermoda.ru/p/max1400/1d/4dda/1e85e085d794e335925b586634813387.jpg
            //   http://s1.intermoda.ru/p/original/1d/4dda/1e85e085d794e335925b586634813387.jpg
            return src.replace(/\/p\/max[0-9]*\//, "/p/original/");
        }

        if (domain === "static.life.ru") {
            // https://static.life.ru/posts/2016/02/347017/5fef920a6117a660ad36961f31cd8e83__980x.jpg
            //   https://static.life.ru/posts/2016/02/347017/5fef920a6117a660ad36961f31cd8e83.jpg
            return src.replace(/__[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "a.ltrbxd.com") {
            // https://a.ltrbxd.com/resized/sm/upload/l1/y0/02/4c/anohana-1200-1200-675-675-crop-000000.jpg?k=dec61b1bd7
            //   https://a.ltrbxd.com/sm/upload/l1/y0/02/4c/anohana.jpg
            // https://a.ltrbxd.com/resized/film-poster/1/7/9/2/3/0/179230-anohana-the-flower-we-saw-that-day-the-movie-0-230-0-345-crop.jpg?k=00177b15f7
            return src.replace(/\/resized\/(.*)-(?:[0-9]+-){4}crop(?:-[0-9]+)?(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "images.goodsmile.info") {
            // http://images.goodsmile.info/cgm/images/product/20151117/5347/36478/medium/7c87232c87be286eaa9acf85ad86e2fb.jpg
            //   http://images.goodsmile.info/cgm/images/product/20151117/5347/36478/large/7c87232c87be286eaa9acf85ad86e2fb.jpg
            //   http://images.goodsmile.info/cgm/images/product/20151117/5347/36478/original/7c87232c87be286eaa9acf85ad86e2fb.jpg
            // doesn't work for all:
            // http://images.goodsmile.info/cgm/images/product/20111026/3326/15941/large/c0cb17556e0c49ccc02e5e47cfa642be.jpg
            //   http://images.goodsmile.info/cgm/images/product/20111026/3326/15941/original/c0cb17556e0c49ccc02e5e47cfa642be.jpg
            return src.replace(/\/[a-z]+(\/[0-9a-f]+\.[^/.]*)$/, "/original$1");
        }

        if (domain === "dzt1km7tv28ex.cloudfront.net") {
            // https://dzt1km7tv28ex.cloudfront.net/u/309884825181880320_35s_d.jpg
            //   https://dzt1km7tv28ex.cloudfront.net/u/309884825181880320_35s_o.jpg
            // https://dzt1km7tv28ex.cloudfront.net/u/195776329524707328_35s_d.jpg
            //   https://dzt1km7tv28ex.cloudfront.net/u/195776329524707328_35s_o.jpg
            return src.replace(/_[a-z](\.[^/.]*)$/, "_o$1");
        }

        if (domain_nowww === "ucarecdn.com") {
            // https://ucarecdn.com/ab72986c-0e99-4e1b-bb8e-562afa21df3c/-/stretch/off/-/resize/2000x/-/quality/normal/
            //   https://www.ucarecdn.com/ab72986c-0e99-4e1b-bb8e-562afa21df3c/
            return src.replace(/(:\/\/[^/]*\/[-0-9a-f]+\/).*/, "$1");
        }

        if (domain_nowww === "celebs-place.com") {
            // http://www.celebs-place.com/gallery/selena-gomez/image(468)_s.jpg
            //   http://www.celebs-place.com/gallery/selena-gomez/image(468).jpg
            return src.replace(/(\/gallery\/[^/]*\/[^/]*)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain === "static.vfiles.com") {
            // https://static.vfiles.com/api/v2/image/media/268246/preview
            return {
                url: src.replace(/(\/image\/media\/[0-9]+\/)[a-z]+(?:\?.*)?$/, "$1original"),
                can_head: false
            };
        }

        if (domain === "img.mediacentrum.sk") {
            // https://img.mediacentrum.sk/gallery/350/1846319.jpg
            //   https://img.mediacentrum.sk/gallery/original/1846319.jpg
            // https://img.mediacentrum.sk/gallery/nwo/maxwidth/233/1846375.jpg
            //   https://img.mediacentrum.sk/gallery/original/1846375.jpg
            return src.replace(/\/gallery\/(?:.*?\/[0-9]+\/)([0-9]+\.[^/.]*)$/, "/gallery/original/$1");
        }

        if (domain === "images.says.com") {
            // http://images.says.com/uploads/story_source/source_image/89484/big_thumb_2285.jpeg -- stretched
            //   http://images.says.com/uploads/story_source/source_image/89484/2285.jpeg
            return src.replace(/(\/[0-9]+\/)[a-z_]+_([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "wir.skyrock.net") {
            // https://wir.skyrock.net/wir/v1/resize/?c=isi&im=%2F7688%2F86157688%2Fpics%2F3171145327_1_9_XywnO238.jpg&w=252
            //   https://i.skyrock.net/7688/86157688/pics/3171145327_1_9_XywnO238.jpg
            return decodeURIComponent(src.replace(/:\/\/[^/]*\/.*[?&]im=([^&]*).*/, "://i.skyrock.net$1"));
        }

        if (domain === "i.skyrock.net") {
            // https://i.skyrock.net/4356/80274356/pics/photo_80274356_avatar_130.jpg
            //   https://i.skyrock.net/4356/80274356/pics/photo_80274356_130.jpg
            // https://i.skyrock.net/7688/86157688/pics/photo_86157688_small_22.jpg
            //   https://i.skyrock.net/7688/86157688/pics/photo_86157688_22.jpg
            // https://i.skyrock.net/5946/11875946/pics/350347040_small.jpg
            //   https://i.skyrock.net/5946/11875946/pics/350347040.jpg
            return src.replace(/(\/pics\/(?:photo_)?[0-9]+)_[a-z]+((?:_[0-9]+)?\.[^/.]*)$/, "$1$2");
        }

        if (domain.match(/thumb-p[0-9]*\.xhcdn\.com/)) {
            // https://thumb-p2.xhcdn.com/000/185/972/432_450.jpg
            //   https://thumb-p2.xhcdn.com/000/185/972/432_1000.jpg
            return src.replace(/(\/[0-9]+_)[0-9]+(\.[^/.]*)$/, "$11000$2");
        }

        if (domain.match(/img[0-9]*\.cache\.netease\.com/)) {
            // http://img4.cache.netease.com/photo/0026/2016-02-06/s_BF64NUDI43AJ0026.jpg
            //   http://img4.cache.netease.com/photo/0026/2016-02-06/t_BF64NUDI43AJ0026.jpg
            //   http://img4.cache.netease.com/photo/0026/2016-02-06/BF64NUDI43AJ0026.jpg
            return src.replace(/\/[a-z]_([^/]*)$/, "/$1");
        }

        if (domain === "img.lengding.cn") {
            // http://img.lengding.cn/article/getImage.php?url=https://mmbiz.qpic.cn/mmbiz_jpg/OBQWTDeVLCNUFv5o4U2RNVrCSTKphdIibJFyFfeyV1gnmtaGazdEibzuO2kicjH5OM3Uadly6ngQKrQxPLPQTwgpQ/640?wx_fmt=jpeg
            //   https://mmbiz.qpic.cn/mmbiz_jpg/OBQWTDeVLCNUFv5o4U2RNVrCSTKphdIibJFyFfeyV1gnmtaGazdEibzuO2kicjH5OM3Uadly6ngQKrQxPLPQTwgpQ/0
            return src.replace(/.*?\/getImage\.php.*?[?&]url=(.*)$/, "$1");
        }

        if (domain === "cdn.sabay.com") {
            // http://cdn.sabay.com/cdn/media.sabay.com/media/Kanha/Fashion/Feshion-4/selena-4_large.jpg
            return src.replace(/:\/\/[^/]+\/cdn\/([a-z]+\.[a-z]+\.[a-z]+\/)/, "://$1");
        }

        if (domain === "media.sabay.com") {
            // http://media.sabay.com/media/Kanha/Fashion/Feshion-4/selena-4_large.jpg
            //   http://media.sabay.com/media/Kanha/Fashion/Feshion-4/selena-4.jpg
            return src.replace(/_[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "media.nbcdfw.com") {
            // https://media.nbcdfw.com/images/652*367/calboy+picture.JPG
            //   https://media.nbcdfw.com/images/calboy+picture.JPG
            return src.replace(/\/images\/[0-9]+\*[0-9]+\//, "/images/");
        }

        // haven't found anything yet
        if (domain === "binaryapi.ap.org") {
            // http://binaryapi.ap.org/2df5c8e3642d4183a08cf802c2dd50b1/preview/AP13344549840.jpg
            // http://binaryapi.ap.org/12df59bdddfa40e1967ba8f9884c8f29/940x.jpg
            //   http://binaryapi.ap.org/12df59bdddfa40e1967ba8f9884c8f29/preview.jpg
            //   http://binaryapi.ap.org/12df59bdddfa40e1967ba8f9884c8f29/460x.jpg
            // any number is accepted, not upscaled
            return {
                url: src,
                can_head: false
            };
        }

        // don't know if nosub is correct or not
        if (domain_nosub === "ekladata.com") {
            // http://ekladata.com/Szr7glS4gLW9Qj87s75kpakvTPY@546x364.jpg
            //   http://ekladata.com/Szr7glS4gLW9Qj87s75kpakvTPY.jpg
            return src.replace(/@[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.geinoueroch.com" ||
            // https://img.momon-ga.com/imgs/2/f/2f380c51-s.jpg
            domain === "img.momon-ga.com") {
            // http://img.geinoueroch.com/imgs/f/c/fc3b9e51-s.jpg
            //   http://img.geinoueroch.com/imgs/f/c/fc3b9e51.jpg
            return src.replace(/-s(\.[^/.]*)$/, "$1");
        }

        if (domain === "note.taable.com" &&
            src.indexOf("/photo/") >= 0) {
            // http://note.taable.com/photo/scontent.xx.fbcdn.net/v/t31.0-0/p480x480/11182667_10153880871767871_5071962208418710934_o.jpg%3F_nc_cat%3D0%26oh%3D6bb4ad139609d4a1a828aac3d663b3c8%26oe%3D5B8E87B6%26ti%3D1451386800%26_wi%3D200
            //   https://scontent.xx.fbcdn.net/v/t31.0-0/p480x480/11182667_10153880871767871_5071962208418710934_o.jpg?_nc_cat=0&oh=6bb4ad139609d4a1a828aac3d663b3c8&oe=5B8E87B6&ti=1451386800&_wi=200
            return decodeURIComponent(src.replace(/:\/\/[^/]*\/photo\//, "://"));
        }

        if (domain.match(/img-[^.]*\.adult-gazou\.me/)) {
            // http://img-fdc03.adult-gazou.me/adult_b/2515/s/25.jpg
            //   http://img-fdc03.adult-gazou.me/adult_b/2515/l/25.jpg
            return src.replace(/\/[a-z](\/[0-9]*\.[^/.]*)$/, "/l$1");
        }

        if (domain.match(/\.fukugan\.com$/) &&
            src.indexOf("/rssimg/") >= 0) {
            // http://jpn6.fukugan.com/rssimg/thumb_cache/crop_fr0_185x150/http%253A%252F%252Flivedoor.blogimg.jp%252Fseisobitch%252Fimgs%252F8%252Fe%252F8e0df1a7.jpg.%2523FFFFFF.jpg
            //   http://livedoor.blogimg.jp/seisobitch/imgs/8/e/8e0df1a7.jpg
            return decodeURIComponent(decodeURIComponent(src.replace(/.*\/(https?[%:].*)/, "$1"))).replace(/\.#.*/, "");
        }

        if (domain.match(/img[0-9]*\.lostbird\.vn/)) {
            // http://img1.lostbird.vn/320x-/2018/02/27/79295/320x480_201312061146592vz0gfz60zu37ihp.jpg
            //   http://img1.lostbird.vn/2018/02/27/79295/320x480_201312061146592vz0gfz60zu37ihp.jpg
            return src.replace(/(:\/\/[^/]*\/)[-0-9]+x[-0-9]+\//, "$1");
        }

        if (domain === "img.biggo.com.tw") {
            // https://img.biggo.com.tw/120,fit,s7JNwTn1ERJnfry1vht0i1DbjsRTt5vOWIvAvWscdSBo/https://tshop.r10s.com/a85/93e/b037/66d8/7062/61bc/20f0/11bee787262c600c7376cd.jpg
            //   https://tshop.r10s.com/a85/93e/b037/66d8/7062/61bc/20f0/11bee787262c600c7376cd.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/[^/]*\//, "");
        }

        if ((domain.match(/im[0-9]*\.book\.com\.tw/) ||
             domain === "www.books.com.tw" ||
             domain === "buy.line-scdn.net") &&
            src.indexOf("/getImage") >= 0) {
            // http://im2.book.com.tw/image/getImage?i=https://www.books.com.tw/img/M01/004/93/M010049307.jpg&v=56d955b0&w=170&h=170m
            //   https://www.books.com.tw/img/M01/004/93/M010049307.jpg
            // https://www.books.com.tw/image/getImage?i=https%3A%2F%2Fwww.books.com.tw%2Fimg%2FM01%2F004%2F93%2FM010049307.jpg&width=170&height=240
            //   https://www.books.com.tw/img/M01/004/93/M010049307.jpg
            // https://buy.line-scdn.net/2962ea41/im1/image/getImage?i=https://www.books.com.tw/img/M01/004/93/M010049307.jpg&v=57bebab0&w=348&h=348
            //   https://www.books.com.tw/img/M01/004/93/M010049307.jpg
            return decodeURIComponent(src.replace(/.*\/getImage.*?[?&]i=([^&]*).*?$/, "$1"));
        }

        if (domain === "img.feebee.com.tw") {
            // https://img.feebee.com.tw/ip/80/V-mkCCEt4SsOwU_ATVl53cCQxY5b-fGCIJyxLtJ6L6Y=/https://img.feebee.com.tw/ip/80/x45LJqQkSKXB-QnsHKtYoXDSJ4Y30TxSBJ3D9W8aRwg=/https://s.yimg.com/ut/api/res/1.2/IwnHZ4UimV4jdmDNhzi5jQ--~B/dz02MDA7aD02MDA7cT04MTtmaT1maXQ7YXBwaWQ9eXR3bWFsbA--/https://s.yimg.com/fy/ba06/item/p0303104354614-item-0541xf4x0750x0750-m.jpg
            //   https://s.yimg.com/fy/ba06/item/p0303104354614-item-0541xf4x0750x0750-m.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/ip\/[0-9]+\/[^/]+=\//, "");
        }

        if (domain === "img.fireden.net") {
            // https://img.fireden.net/v/thumb/1470/95/1470959423951s.jpg
            //   https://img.fireden.net/v/image/1470/95/1470959423951.jpg
            return src.replace(/\/thumb(\/.*?)s(\.[^/.]*)$/, "/image$1$2");
        }

        if (domain === "www.consolefun.fr") {
            // http://www.consolefun.fr/fiche/ps4/thumbs/th_1523541277uwo0iwsr40b1rg0p3fq6.jpg
            //   http://www.consolefun.fr/fiche/ps4/1523541277uwo0iwsr40b1rg0p3fq6.jpg
            return src.replace(/\/thumbs\/th_/, "/");
        }

        if (domain === "ex.f3img.gq") {
            // https://ex.f3img.gq/api/image?url=https%3A%2F%2Fi.kinja-img.com%2Fgawker-media%2Fimage%2Fupload%2Fs--86MJ72ai--%2Fc_scale%2Cfl_progressive%2Cq_80%2Cw_800%2Fuwo0iwsr40b1rg0p3fq6.jpg&w=715
            //   https://i.kinja-img.com/gawker-media/image/upload/uwo0iwsr40b1rg0p3fq6.jpg
            return decodeURIComponent(src.replace(/.*?\/api\/image.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "images.everyeye.it") {
            // https://images.everyeye.it/img-topscheda/yakuza-6-the-song-of-life-v12-24174-1280.jpg
            //   https://images.everyeye.it/img-topscheda/yakuza-6-the-song-of-life-v12-24174.jpg
            return src.replace(/(-v[0-9]+-[0-9]+)-[0-9]+(\.[&/.]*)/, "$1$2");
        }

        if (domain === "www.bobx.com") {
            // http://www.bobx.com/thumbnail/av-idol/tsubomi-tsubomi/tsubomi-tsubomi-preview-04575180.jpg
            //   http://www.bobx.com/av-idol/tsubomi-tsubomi/tsubomi-tsubomi-04575180.jpg
            // http://www.bobx.com/thumbnail/av-idol/tsubomi-tsubomi/tsubomi-tsubomi-04575387.t.jpg
            //   http://www.bobx.com/av-idol/tsubomi-tsubomi/tsubomi-tsubomi-04575387.jpg
            return {
                url: src.replace(/\/thumbnail\/(.*)(?:-preview)?(-[0-9]+)(?:\.t)?(\.[^/.]*)$/, "/$1$2$3"),
                headers: {
                    Referer: null
                }
            };
        }

        if (domain === "www.altcine.com" &&
            src.indexOf("/photo/") >= 0) {
            // http://www.altcine.com/personsphoto/photo/205x205/Miljenovic_Dorde%20%20(Wikluh%20Sky).jpg
            //   http://www.altcine.com/personsphoto/photo/Miljenovic_Dorde%20%20(Wikluh%20Sky).jpg
            return src.replace(/\/[0-9]+x[0-9]+\/([^/]*)$/, "/$1");
        }

        if (domain === "www.spacetelescope.org" &&
            src.indexOf("/static/") >= 0) {
            // http://www.spacetelescope.org/static/archives/images/medium/heic1501a.jpg
            //   http://www.spacetelescope.org/static/archives/images/large/heic1501a.jpg -- 6780x7071
            return src.replace(/\/images\/[^/]*\//, "/images/large/");
        }

        if (domain === "static.qobuz.com") {
            // https://static.qobuz.com/images/covers/67/31/8606102083167_600.jpg
            //   https://static.qobuz.com/images/covers/67/31/8606102083167_org.jpg
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "_org$1");
        }

        if (domain_nowww === "sarajevo.travel" &&
            src.indexOf("/assets/photos/") >= 0) {
            // https://sarajevo.travel/assets/photos/events/small/tuborg-open-sara-jo-amp-sky-wikler-1503493807.jpg
            //   https://sarajevo.travel/assets/photos/events/big/tuborg-open-sara-jo-amp-sky-wikler-1503493807.jpg
            //   https://www.sarajevo.travel/assets/photos/events/original/tuborg-open-sara-jo-amp-sky-wikler-1503493807.jpg
            return src.replace(/\/[a-z]+\/([^/]*)$/, "/original/$1");
        }

        if (domain === "avatars.mds.yandex.net") {
            // https://avatars.mds.yandex.net/get-zen_doc/198938/pub_5af84b497425f5fcbcde8785_5af84b6583090599f5aded49/scale_600
            //   https://avatars.mds.yandex.net/get-zen_doc/198938/pub_5af84b497425f5fcbcde8785_5af84b6583090599f5aded49/orig
            return src.replace(/\/[a-z_0-9]+$/, "/orig");
        }

        if (domain === "t2online.com") {
            // http://t2online.com/unsafe/s3.ap-south-1.amazonaws.com/cms-abp-prod-media/library/T2_ONLINE/image/2018/5/d67c356e-5ddb-4976-9dcc-877d30a1e4a1.jpg
            //   http://s3.ap-south-1.amazonaws.com/cms-abp-prod-media/library/T2_ONLINE/image/2018/5/d67c356e-5ddb-4976-9dcc-877d30a1e4a1.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/unsafe\//, "http://");
        }

        if (domain_nowww === "filmnegah.com") {
            // http://filmnegah.com/Image/Resize?url=~%2FUploads%2FProduct323%2FDark.Knight.Rises.Poster.26.5.91.filmnegah.jpg&width=256
            //   http://www.filmnegah.com/Uploads/Product323/Dark.Knight.Rises.Poster.26.5.91.filmnegah.jpg
            // http://filmnegah.com/Image/Thumbnail?path=~%2FUploads%2FCelebrity%2FChristopher.Nolan.25.12.91.Filmnegah.jpg&width=64
            return decodeURIComponent(src.replace(/(:\/\/[^/]*)\/Image\/(?:Resize|Thumbnail).*?[?&](?:url|path)=~([^&]*).*?$/, "$1$2"));
        }

        if (domain_nowww === "niagara.sk" &&
            src.indexOf("/images/") >= 0) {
            // https://www.niagara.sk/images/persons/tmb-100-147/christopher-nolan.jpg
            //   https://niagara.sk/images/persons/big/christopher-nolan.jpg
            return src.replace(/\/tmb-[0-9]+(?:-[0-9]+)\//, "/big/");
        }

        if (domain === "www.cdn-cinenode.com") {
            // https://www.cdn-cinenode.com/author_picture/73/christopher-nolan-73464-250-400.jpg
            //   https://www.cdn-cinenode.com/author_picture/73/full/christopher-nolan-73464.jpg
            return src.replace(/(\/[0-9]+\/)([^/]*)-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1full/$2$3");
        }

        if (domain.match(/\.storage\.canalblog\.com$/)) {
            // http://p0.storage.canalblog.com/07/89/830600/116665408_m.jpg
            //   http://p0.storage.canalblog.com/07/89/830600/116665408.jpg
            //   http://p0.storage.canalblog.com/07/89/830600/116665408_o.jpg
            // http://p1.storage.canalblog.com/15/04/830600/116665417.to_resize_150x3000.png
            //   http://p1.storage.canalblog.com/15/04/830600/116665417_o.png
            return src
                .replace(/\.[^/]*(\.[^/.]*)$/, "$1")
                .replace(/(\/[0-9]+)(?:_[a-z])?(\.[^/.]*)$/, "$1_o$2");
        }

        if (domain_nowww === "film-like.com") {
            // http://film-like.com/images/film/thumb/2008/9908.jpg
            //   http://film-like.com/images/film/full/2008/9908.jpg
            return src.replace(/\/thumb\//, "/full/");
        }

        if (domain === "24smi.org") {
            // https://24smi.org/public/media/105x76/celebrity/2018/02/28/6gehfl9ng7ue-christopher-nolan.jpg
            //   https://24smi.org/public/media/celebrity/2018/02/28/6gehfl9ng7ue-christopher-nolan.jpg
            // https://24smi.org/adwiles2/img/200_150/0/c/0cab42e11498e98f9fb1df71669018a1.jpeg
            //   https://24smi.org/adwiles2/img/999999999_999999999/0/c/0cab42e11498e98f9fb1df71669018a1.jpeg
            return src
                .replace(/\/img\/[0-9]+_[0-9]+\//, "/img/999999999_999999999/")
                .replace(/\/public\/media\/[0-9]+x[0-9]+\//, "/public/media/");
        }

        if (domain === "cdn.metrotvnews.com" ||
            // https://cdn.medcom.id/dynamic/content/2017/04/10/684188/Jw85BLIVDb.jpg?w=720
            domain === "cdn.medcom.id") {
            // http://cdn.metrotvnews.com/dynamic/content/2017/07/20/732264/aSnEGWRr16.jpg?w=200
            //   http://cdn.metrotvnews.com/dynamic/content/2017/07/20/732264/aSnEGWRr16.jpg?w=99999999999
            return src.replace(/\?.*/, "?w=99999999999");
        }

        if (domain === "www.znqnet.com" &&
            src.indexOf("/fileupload/") >= 0) {
            // http://www.znqnet.com/fileupload/thumb/20150909/20150909104806_5775.jpg
            //   http://www.znqnet.com/fileupload/image/20150909/20150909104806_5775.jpg
            return src.replace(/\/fileupload\/thumb\//, "/fileupload/image/");
        }

        if (domain.match(/[a-z]\.rpp-noticias\.io/)) {
            // http://e.rpp-noticias.io/small/2018/02/12/593459_564005.jpg -- 244x126
            //   http://f.rpp-noticias.io/2018/02/12/593459_564005.jpg -- 5200x2925
            return src.replace(/:\/\/e\.rpp-noticias\.io\/[a-z]+\//, "://f.rpp-noticias.io/");
        }

        if (domain.match(/fotos[0-9]*\.diarioinformacion\.com/)) {
            // https://fotos01.diarioinformacion.com/2017/12/11/328x206/archivosalida20170719194704.jpg
            //   https://fotos01.diarioinformacion.com/2017/12/11/archivosalida20170719194704.jpg
            return src.replace(/\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain === "www.digi-film.ro") {
            // http://www.digi-film.ro/onedb/picture(width=200,crop=1)/56824f6695f9cfef07000000
            //   http://www.digi-film.ro/onedb/picture:56824f6695f9cfef07000000
            //   http://www.digi-film.ro/onedb/picture/56824f6695f9cfef07000000 -- redirected to:
            //     http://storage03dgf.rcs-rds.ro/storage/2015/12/29/545191_545191_nolan.jpg
            return src.replace(/\/onedb\/picture\([^/]*\//, "/onedb/picture/");
        }

        if (domain.match(/img[0-9]*\.jiemian\.com/)) {
            // http://img2.jiemian.com/101/original/20170902/15043383837444100_a580xH.jpg
            //   http://img2.jiemian.com/101/original/20170902/15043383837444100.jpg
            return src.replace(/\/([0-9]+)_[a-zA-Z0-9]+x[a-zA-Z0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "i.cnnturk.com") {
            // https://i.cnnturk.com/ps/cnnturk/75/630x0/582064a15659341ab0aea248.jpg
            //   https://i.cnnturk.com/ps/cnnturk/75/0x0/582064a15659341ab0aea248.jpg
            return src.replace(/\/[0-9]+x[0-9]+\/([0-9a-f]+\.[^/.]*)$/, "/0x0/$1");
        }

        if (domain === "cdn.highdefdigest.com") {
            // https://cdn.highdefdigest.com/uploads/2017/11/20/660/nolan.jpg
            //   https://cdn.highdefdigest.com/uploads/2017/11/20/nolan.jpg
            return src.replace(/(\/uploads\/[0-9]+\/[0-9]+\/[0-9]+\/)[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "ojosdecafe.com") {
            // http://ojosdecafe.com/img/upload/thumbs/750x450_christopher-nolan-dunkirk.jpg
            //   http://www.ojosdecafe.com/img/upload/christopher-nolan-dunkirk.jpg
            return src.replace(/\/thumbs\/[0-9]+x[0-9]+_/, "/");
        }

        if (domain === "img.gestion.pe") {
            // https://img.gestion.pe/files/ec_article_multimedia_gallery/uploads/2017/11/08/5a03a7dc67e6a.jpeg -- stretched
            //   https://img.gestion.pe/uploads/2017/11/08/5a03a7dc67e6a.jpeg
            return src.replace(/\/files\/[^/]*\/uploads\//, "/uploads/");
        }

        if (domain === "thumb.guucdn.net") {
            // https://thumb.guucdn.net/400x225/images.guucdn.net/full/2018/05/29/7426c2a3bfc916d4cad3b9e921b604087c246dfa.jpg
            //   https://images.guucdn.net/full/2018/05/29/7426c2a3bfc916d4cad3b9e921b604087c246dfa.jpg
            return src.replace(/:\/\/[^/]*\/[0-9]+x[0-9]+\//, "://");
        }

        if (domain === "game4v.com" &&
            src.indexOf("/thumb/thumb.php?") >= 0) {
            // http://game4v.com/thumb/thumb.php?w=560&src=http%3A%2F%2Fcdn2.game4v.com%2F2014%2F10%2Fphong-than-di-tuong-2.jpg
            //   http://cdn2.game4v.com/2014/10/phong-than-di-tuong-2.jpg
            return decodeURIComponent(src.replace(/.*?\/thumb\.php.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain === "static.santruyen.com") {
            // http://static.santruyen.com/medias/covers/49/49367_cover.jpg
            //   http://static.santruyen.com/medias/covers/49/49367_large.jpg
            //   http://static.santruyen.com/medias/covers/49/49367.jpg
            // http://static.santruyen.com/medias/covers/75/75215_thumbnail.jpg
            //   http://static.santruyen.com/medias/covers/75/75215.jpg
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (amazon_container === "boligsurf-production" &&
            src.indexOf("/assets/images/") >= 0) {
            // https://s3.eu-central-1.amazonaws.com/boligsurf-production/assets/images/005/979/084/fixed_500_400/e9f400a3478f97092c7456b9836ea888b367c857.jpg
            //   https://s3.eu-central-1.amazonaws.com/boligsurf-production/assets/images/005/979/084/original/e9f400a3478f97092c7456b9836ea888b367c857.jpg
            return src.replace(/\/fixed_[0-9]+_[0-9]+\//, "/original/");
        }

        if (domain === "bt.bmcdn.dk") {
            // https://bt.bmcdn.dk/media/cache/resolve/image_420/image/103/1032257/17913568-.jpg
            //   https://bt.bmcdn.dk/media/cache/resolve/image/image/103/1032257/17913568-.jpg
            return src.replace(/\/image_[0-9]+\/image\//, "/image/image/");
        }

        if (domain_nowww === "sonara.net") {
            // http://sonara.net/cro.php?width=108&height=80&cropratio=108:80&image=%2F20180610-1331171884648120.jpg
            //   http://images.sonara.net/20180610-1331171884648120.jpg
            return decodeURIComponent(src.replace(/:\/\/[^/]*\/cro\.php.*?[?&]image=([^&]*).*?$/, "://images.sonara.net$1"));
        }

        if (domain === "d2u7zfhzkfu65k.cloudfront.net" &&
            src.indexOf("/resize/wp-content/") >= 0) {
            // https://d2u7zfhzkfu65k.cloudfront.net/resize/wp-content/uploads/2018/5/8/15/f21a56c81474b277e24bca7575e94dc7.jpg?w=70&q=85
            //   https://d3kszy5ca3yqvh.cloudfront.net/wp-content/uploads/2018/5/8/15/f21a56c81474b277e24bca7575e94dc7.jpg
            return src.replace(/:\/\/[^/]*\/resize\//, "://d3kszy5ca3yqvh.cloudfront.net/");
        }

        if (domain === "imgbp.hotp.jp") {
            // https://imgbp.hotp.jp/CSP/IMG_SRC/60/26/B011156026/B011156026_271-361.jpg
            //   https://imgbp.hotp.jp/CSP/IMG_SRC/60/26/B011156026/B011156026.jpg
            return src.replace(/_[0-9]+-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "ro69-bucket.s3.amazonaws.com") {
            // https://ro69-bucket.s3.amazonaws.com/uploads/text_image/image/298198/200x200/resize_image.jpg
            //   https://ro69-bucket.s3.amazonaws.com/uploads/text_image/image/298198/default/resize_image.jpg
            // https://rockinon.com/images/entry/width:750/137595/1
            //   https://ro69-bucket.s3.amazonaws.com/uploads/text_image/image/206532/width:750/resize_image.gif
            //   https://ro69-bucket.s3.amazonaws.com/uploads/text_image/image/206532/default/resize_image.gif
            return src.replace(/(\/image\/[0-9]+\/)[^/]*\/resize_image/, "$1default/resize_image");
        }

        if (domain === "aimg-pictpix.akamaized.net") {
            // https://aimg-pictpix.akamaized.net/ts600x1/img/pictpix/25/74/04eeb5c81734927eb81cefb1d90e26aa8a340e0b.png
            //   https://aimg-pictpix.akamaized.net/img/pictpix/25/74/04eeb5c81734927eb81cefb1d90e26aa8a340e0b.png
            return src.replace(/(:\/\/[^/]*\/)ts[0-9]+x[0-9]+\/img\//, "$1img/");
        }

        if (domain === "lattepic.s3.amazonaws.com") {
            // https://lattepic.s3.amazonaws.com/column_bq/pn/fy/5s/n6/km/le/ub/le/tj/5o/wu/hr/u2/5s/xu_medium.png
            //   https://lattepic.s3.amazonaws.com/column_bq/pn/fy/5s/n6/km/le/ub/le/tj/5o/wu/hr/u2/5s/xu_org.png
            // https://lattepic.s3.amazonaws.com/column_pe/qo/iv/g3/lm/e3/6f/e7/q5/lb/b4/jf/rl/xw/ir/fl_square.png
            //   https://lattepic.s3.amazonaws.com/column_pe/qo/iv/g3/lm/e3/6f/e7/q5/lb/b4/jf/rl/xw/ir/fl_org.png
            //
            // https://latte.la/hair/style/10078
            // https://lattepic.s3.amazonaws.com/column_xn/ab/r5/hx/ib/zf/bt/r3/64/73/cn/sy/r2/xz/46/pg_org.png
            //   https://lattepic.s3.amazonaws.com/p_df/v2/3o/6q/kc/4c/ir/cu/4u/ao/un/rj/cy/g3/ev/cr_medium.jpeg?Signature=H6SKvjkyvvSS1bSCJ49ShC4NRG8%3D&Expires=2115594061&AWSAccessKeyId=AKIAIZXE7EOD2KQP55NQ&0
            //   https://lattepic.s3.amazonaws.com/p_df/v2/3o/6q/kc/4c/ir/cu/4u/ao/un/rj/cy/g3/ev/cr_real.jpeg?Signature=MfqquzcPlhIgA%2BM7tkiLegptfHY%3D&Expires=2115594061&AWSAccessKeyId=AKIAIZXE7EOD2KQP55NQ&0
            // doesn't work:
            // https://lattepic.s3.amazonaws.com/p_h3/3n/fe/k2/o5/ts/xf/d4/cc/fz/lb/b3/j6/f7/it/h2_square.jpeg?Signature=YHzaFGZAIkDlez6vmTfRA2KmKjU%3D&Expires=2115594061&AWSAccessKeyId=AKIAIZXE7EOD2KQP55NQ&0 -- signature cannot be removed
            return src.replace(/(\/[a-z]+_)[a-z]+(\.[^/.?]*)$/, "$1org$2");
        }

        if (domain === "coconala.akamaized.net") {
            // https://coconala.akamaized.net/coconala-public-files/service_images/132x132/2da9fdc5-657054.png
            //   https://coconala.akamaized.net/coconala-public-files/service_images/original/2da9fdc5-657054.png -- forces download
            return src.replace(/\/service_images\/[0-9]+x[0-9]+\//, "/service_images/original/");
        }

        if (domain === "dplhqivlpbfks.cloudfront.net") {
            // https://dplhqivlpbfks.cloudfront.net/box_resize/1220x1240/2da9fdc5-657054.png
            //   https://coconala.akamaized.net/coconala-public-files/service_images/original/2da9fdc5-657054.png
            return src.replace(/.*(\/[0-9a-f]+-[0-9]+\.[^/.]*)$/, "https://coconala.akamaized.net/coconala-public-files/service_images/original$1");
        }

        if (domain === "img.milli.az") {
            // https://img.milli.az/2017/07/01/250x250f/558980_30.jpg
            //   https://img.milli.az/2017/07/01/558980_30.jpg
            return src.replace(/\/[0-9]+x[0-9]+[a-z]*\/([^/]*)$/, "/$1");
        }

        if (domain === "www.ysbnow.com") {
            // http://www.ysbnow.com/dam?media-id=599db1edd74440326c7d50ce&width=800
            //   http://www.ysbnow.com/dam?media-id=599db1edd74440326c7d50ce -- 4608x2592
            return src.replace(/(:\/\/[^/]*\/dam).*?[?&](media-id=[^&]*).*?$/, "$1?$2");
        }

        if (domain === "www.quizz.biz" &&
            src.indexOf("/uploads/") >= 0) {
            // https://www.quizz.biz/uploads/quizz/962477/mini/1_1.jpg?1479738849
            //   https://www.quizz.biz/uploads/quizz/962477/orig/1.jpg?1479738849
            return src.replace(/(\/[0-9]+\/)[a-z]+(\/[0-9]+)(?:_[0-9]+)?(\.[^/.]*)$/,"$1orig$2$3");
        }

        if (domain.match(/c[0-9]*\.flipagramcdn\.com/)) {
            // https://c1.flipagramcdn.com/d30faeccb979f31d8eea6dd8ad649ddf691b6662_1865984247_1426694464742-small
            //   https://c1.flipagramcdn.com/d30faeccb979f31d8eea6dd8ad649ddf691b6662_1865984247_1426694464742-large?
            //   https://c1.flipagramcdn.com/d30faeccb979f31d8eea6dd8ad649ddf691b6662_1865984247_1426694464742
            return src.replace(/-[a-z]+(?:\?.*)?$/, "");
        }

        if (domain === "images-cdn.9gag.com" ||
            domain === "img-9gag-fun.9cache.com" ||
            domain === "miscmedia-9gag-fun.9cache.com") {
            // https://images-cdn.9gag.com/photo/aL2j4BM_460s_v1.jpg
            //   https://images-cdn.9gag.com/photo/aL2j4BM_700b_v1.jpg
            // https://images-cdn.9gag.com/photo/aVXP7Yy_460s.jpg
            //   https://images-cdn.9gag.com/photo/aVXP7Yy_700b.jpg
            // https://images-cdn.9gag.com/photo/a0br3MZ_460s.jpg
            //   https://images-cdn.9gag.com/photo/a0br3MZ_700b.jpg
            // https://img-9gag-fun.9cache.com/photo/a3KW8w7_460swp.webp
            //   https://img-9gag-fun.9cache.com/photo/a3KW8w7_700bwp.webp
            // https://miscmedia-9gag-fun.9cache.com/images/thumbnail-facebook/1482203076.0883_u8yQU9_100x100.jpg
            //   https://miscmedia-9gag-fun.9cache.com/images/thumbnail-facebook/1482203076.0883_u8yQU9_n.jpg
            return src
                .replace(/\/thumbnail-facebook\/([^/]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/thumbnail-facebook/$1_n$2")
                .replace(/_460swp(\.[^/.]*)$/, "_700bwp$1")
                .replace(/_460s(_v1)?(\.[^/.]*)$/, "_700b$1$2");
        }

        if (domain_nowww === "samironsheadshots.com" &&
            src.indexOf("/images/") >= 0) {
            // http://samironsheadshots.com/images/pages/small/1510138983.jpg
            //   http://samironsheadshots.com/images/pages/large/1510138983.jpg
            return src.replace(/\/small\/([^/]*)$/, "/large/$1");
        }

        if (domain === "cps-static.rovicorp.com") {
            // https://cps-static.rovicorp.com/2/Open/20th_Century_Fox_39/Program/22067798/_derived_jpg_q90_250x0_m0/walking%20with%20the%20enemy_PA.jpg?partner=allrovi.com
            //   https://cps-static.rovicorp.com/2/Open/20th_Century_Fox_39/Program/22067798/walking%20with%20the%20enemy_PA.jpg?partner=allrovi.com
            return src.replace(/\/_derived_[^/]*(\/[^/]*)$/, "$1");
        }

        if (domain.match(/i[0-9]*\.netflixmovies\.com/)) {
            // https://i1.netflixmovies.com/dibsl9ebc/image/upload/w_1024/mijahb8dbg5qdkxurlwh.jpg
            //   https://i1.netflixmovies.com/dibsl9ebc/image/upload/mijahb8dbg5qdkxurlwh.jpg
            return src.replace(/\/image\/upload\/[wh]_[0-9]+\//, "/image/upload/");
        }

        if (domain === "www.shakespearesglobe.com") {
            // http://www.shakespearesglobe.com/images/8610/normal
            //   http://www.shakespearesglobe.com/images/8610
            return src.replace(/(\/images\/[0-9]+)\/[a-z]+(?:\?.*)?$/, "$1");
        }

        if (domain.match(/cdn[0-9]*\.rsc\.org\.uk/)) {
            // https://cdn2.rsc.org.uk/sitefinity/images/productions/2017-shows/Titus-Andronicus/b7452-titus_review_web-amp-social_images_social-amp-hub.tmb-img-820.jpg?sfvrsn=1
            //   https://cdn2.rsc.org.uk/sitefinity/images/productions/2017-shows/Titus-Andronicus/b7452-titus_review_web-amp-social_images_social-amp-hub.jpg?sfvrsn=1
            return src.replace(/\.tmb-img-[0-9]*\./, ".");
        }

        if (domain === "images.fashionmodeldirectory.com") {
            // http://images.fashionmodeldirectory.com/model/000000592070-hanne_linhares-squaresmall.jpg
            //   http://images.fashionmodeldirectory.com/model/000000592070-hanne_linhares-fullsize.jpg
            return src.replace(/(\/[0-9]+-[^/]*-)[a-z]+(\.[^/.]*)$/, "$1fullsize$2");
        }

        if (domain === "crystal.cafe") {
            // https://crystal.cafe/hb/thumb/1497657761080.jpeg
            //   https://crystal.cafe/hb/src/1497657761080.jpeg
            return src.replace(/\/thumb\//, "/src/");
        }

        if (domain === "www.skinnygossip.com" &&
            src.indexOf("/community/proxy.php?") >= 0) {
            // https://www.skinnygossip.com/community/proxy.php?image=https%3A%2F%2Fwww.bellazon.com%2Fmain%2Fuploads%2Fmonthly_2017_11%2FGettyImages-876162714.jpg.6f0a67f5cb65d76069675b15e20ec73d.jpg&hash=087ffa4418cc3312b384c32dc19b765a
            //   https://www.bellazon.com/main/uploads/monthly_2017_11/GettyImages-876162714.jpg.6f0a67f5cb65d76069675b15e20ec73d.jpg
            return decodeURIComponent(src.replace(/.*?\/proxy\.php.*?[?&]image=([^&]*).*?$/, "$1"));
        }

        if (domain === "usa-grlk5lagedl.stackpathdns.com") {
            // http://usa-grlk5lagedl.stackpathdns.com/production/usa/images/1514913960191591-Rihanna.tif?w=1920&amp;h=800&amp;fit=crop&amp;crop=faces&amp;fm=pjpg&amp;auto=compress
            return src.replace(/(\/images\/[^/]*)\?.*$/, "$1?fm=pjpg");
        }

        if (domain === "static.sify.com") {
            // http://static.sify.com/cms/image/rh1m7Deiccjhi_thumb.jpg
            //   http://static.sify.com/cms/image/rh1m7Deiccjhi_small.jpg
            //   http://static.sify.com/cms/image/rh1m7Deiccjhi_medium.jpg
            //   http://static.sify.com/cms/image/rh1m7Deiccjhi_big.jpg
            //   http://static.sify.com/cms/image/rh1m7Deiccjhi.jpg
            return src.replace(/(\/cms\/image\/[^/]*)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "thumbs.wikifeet.com") {
            // https://thumbs.wikifeet.com/3398643.jpg
            //   https://pics.wikifeet.com/3398643.jpg
            return src.replace(/:\/\/[^/]*\//, "://pics.wikifeet.com/");
        }

        if (domain === "static.spotboye.com") {
            // http://static.spotboye.com/uploads/disha-patani-at-femina-awards_08cb1fd04740a924b584520c6087bc78_small.jpg
            //   http://static.spotboye.com/uploads/disha-patani-at-femina-awards_08cb1fd04740a924b584520c6087bc78_original.jpg
            return src.replace(/(_[0-9a-f]+)(?:_[a-z]+)?(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain === "img.news.goo.ne.jp") {
            // https://img.news.goo.ne.jp/cpimg/wedge.ismedia.jp/mwimgs/c/a/-/img_ca529af8c945704fb5432aceff2d60f2795379.jpg
            //   http://wedge.ismedia.jp/mwimgs/c/a/-/img_ca529af8c945704fb5432aceff2d60f2795379.jpg
            return src.replace(/^[a-z]+:\/\/[^/]*\/cpimg\/([^/]*\.[^/]*)/, "http://$1");
        }

        if (host_domain_nosub === "reddit.com" && options.element) {
            newsrc = (function() {
                function checkimage(url) {
                    if (bigimage_recursive(url, {
                        fill_object: false,
                        iterations: 3,
                        null_if_no_change: true,
                        do_request: false
                    }) !== null) {
                        return url;
                    }
                }

                function request(url) {
                    var id = url.replace(/.*\/comments\/([^/]*)\/[^/]*(?:\/(?:\?.*)?)?$/, "$1");
                    if (id !== url) {
                        do_request({
                            method: "GET",
                            url: "https://www.reddit.com/api/info.json?id=t3_" + id,
                            onload: function(result) {
                                try {
                                    var json = JSON.parse(result.responseText);
                                    var item = json.data.children[0].data;
                                    //var image = item.preview.images[0].source.url;
                                    var image = item.url;

                                    if (checkimage(image))
                                        return options.cb(image);
                                } catch (e) {
                                    console.error(e);
                                }

                                options.cb(null);
                            }
                        });

                        return {
                            waiting: true
                        };
                    }
                }

                if (options.element.parentElement && options.element.parentElement.parentElement) {
                    // classic reddit
                    var doubleparent = options.element.parentElement.parentElement;
                    newsrc = doubleparent.getAttribute("data-url");

                    if (newsrc) {
                        if (checkimage(newsrc))
                            return newsrc;
                        else
                            return;
                    } else if (doubleparent.parentElement) {
                        if (doubleparent.parentElement.tagName === "A" && options.do_request && options.cb) {
                            // card
                            newsrc = request(doubleparent.parentElement.href);
                            if (newsrc)
                                return newsrc;
                            else
                                return;
                        }

                        if (options.element.parentElement.tagName === "A" &&
                            // new classic with external url
                            (options.element.parentElement.getAttribute("target") === "_blank" ||
                             // new user page
                             options.element.parentElement.classList.contains("PostThumbnail"))) {

                            newsrc = options.element.parentElement.href;

                            if (checkimage(newsrc))
                                return newsrc;
                            else
                                return;
                        }

                        // new classic
                        var current = options.element;
                        var found = false;
                        while (current = current.parentElement) {
                            if (current.classList.contains("scrollerItem")) {
                                found = true;
                                break;
                            }
                        }

                        if (found) {
                            var elements = current.getElementsByTagName("a");
                            for (var i = 0; i < elements.length; i++) {
                                var element = elements[i];
                                if (element.getAttribute("data-click-id") === "body") {
                                    newsrc = request(element.href);
                                    if (newsrc)
                                        return newsrc;
                                    else
                                        return;
                                }
                            }
                        }
                    }
                }
            })();
            if (newsrc !== undefined)
                return newsrc;
        }

        if (domain === "i.redd.it" || domain === "i.redditmedia.com") {
            return src;
        }
















































































        if (src.match(/\/ImageGen\.ashx\?/)) {
            // http://www.lookalikes.info/umbraco/ImageGen.ashx?image=/media/97522/nick%20hewer%20-%20mark%20brown.jpeg&width=250&constrain=true
            //   http://www.lookalikes.info/media/97522/nick%20hewer%20-%20mark%20brown.jpeg
            return urljoin(src, src.replace(/.*\/ImageGen\.ashx.*?image=([^&]*).*/, "$1"));
        }

        // coppermine
        if (src.search(/\/(gallery|photos)\/albums\/[^/]*\/[^/]*\/(normal)|(thumb)_[^/.]*\.[^/.]*$/) >= 0 ||
           src.search(/\/(gallery|photos)\/albums\/[^/]*\/[^/]*\/[^/]*\/(normal)|(thumb)_[^/.]*\.[^/.]*$/) >= 0) {
            // http://emma-w.net/photos/albums/Events/2017/MARCH13/001/thumb_001.jpg
            //   http://emma-w.net/photos/albums/Events/2017/MARCH13/001/001.jpg
            // http://emilia-clarke.net/gallery/albums/Photoshoots/Session031/thumb_2013_10_12.jpg
            newsrc = src.replace(/(\/(?:gallery|photos)\/albums\/.*\/)[a-z]*_([^/.]*\.[^/.]*)$/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        // gnuboard
        // /data/editor/...
        // /data/file/...
        // /data/works/...
        if (src.match(/\/data\/[^/]*\/[^/]*\/[^/]*$/)) {
            return src.replace(/\/thumb-([^/]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        // various korean news sites (heraldpop etc.)
        // test:
        // http://cgeimage.commutil.kr/phpwas/restmb_allidxmake.php?idx=1&simg=2017111113495301086f97ee432d6203243244.jpg
        // http://res.heraldm.com/phpwas/restmb_jhidxmake.php?idx=999&simg=201712220654304807972_20171222065329_01.jpg
        // http://cgeimage.commutil.kr/phpwas/restmb_setimgmake.php?w=90&h=60&m=1&simg=201712231138280443342246731f35814122117.jpg
        //   http://cgeimage.commutil.kr/phpwas/restmb_allidxmake.php?idx=999&simg=201712231138280443342246731f35814122117.jpg
        // http://res.heraldm.com/phpwas/restmb_jhidxmake.php?idx=5&simg=201507120010285799190_20150712001052_01.jpg
        // http://nimage.globaleconomic.co.kr/phpwas/restmb_allidxmake.php?idx=5&simg=201403241833510093084_00.jpg
        //   http://nimage.globaleconomic.co.kr/phpwas/restmb_allidxmake.php?idx=999&simg=201403241833510093084_00.jpg -- same size
        // doesn't work:
        // http://cliimage.commutil.kr/phpwas/restmb_setimgmake.php?w=550&h=412&m=5&simg=2018030210280201075d307c1aeb0121131233211.jpg
        //   http://cliimage.commutil.kr/phpwas/restmb_setimgmake.php?idx=999&simg=2018030210280201075d307c1aeb0121131233211.jpg
        //   error: nIdx null
        //   http://cliimage.commutil.kr/phpwas/restmb_allidxmake.php?idx=999&simg=2018030210280201075d307c1aeb0121131233211.jpg - works
        if (src.search(/\/phpwas\/restmb_[a-z]*make\.php\?/) >= 0) {
            if (domain === "cgeimage.commutil.kr" ||
                domain === "cliimage.commutil.kr") {
                src = src.replace(/\/phpwas\/restmb_[a-z]*make\.php/, "/phpwas/restmb_allidxmake.php");
            }

            if (domain.indexOf("nimage.") === 0) {
                // http://nimage.newsway.kr/phpwas/restmb_idxmake.php?idx=200&simg=20180202000058_1024.jpg
                //   http://nimage.newsway.kr/photo/2018/02/02/20180202000058_1024.jpg
                // http://nimage.dailygame.co.kr/phpwas/restmb_idxmake.php?idx=3&simg=2015120515361257066_20151205153842_1.jpg
                //   http://nimage.dailygame.co.kr/photo/2015/12/05/2015120515361257066_20151205153842_1.jpg
                // doesn't work for all: (so keep to restmb_idxmake for now)
                // http://nimage.globaleconomic.co.kr/phpwas/restmb_allidxmake.php?idx=999&simg=201403241833510093084_00.jpg
                //   http://nimage.globaleconomic.co.kr/photo/2014/03/24/201403241833510093084_00.jpg -- doesn't work
                newsrc = src.replace(/\/phpwas\/restmb_idxmake\.php.*?simg=([0-9]{4})([0-9]{2})([0-9]{2})([^&]*).*?$/, "/photo/$1/$2/$3/$1$2$3$4");
                if (newsrc !== src)
                    return newsrc;
            }

            if (domain === "res.heraldm.com" &&
                decodeURIComponent(src.match(/simg=([^&]*)/)[1])[0] === "/") {
                // http://res.heraldm.com/phpwas/restmb_idxmake.php?idx=999&simg=%2Fcontent%2Fimage%2F2015%2F07%2F13%2F20150713001359_0.jpg
                //   http://res.heraldm.com/content/image/2015/07/13/20150713001359_0.jpg
                // http://res.heraldm.com/phpwas/restmb_idxmake.php?idx=999&simg=/content/image/2018/02/02/20180202000714_0.jpg
                //   http://res.heraldm.com/content/image/2018/02/02/20180202000714_0.jpg
                return urljoin(src, decodeURIComponent(src.match(/simg=([^&]*)/)[1]));
            }

            //return src.replace(/\/phpwas\/restmb_[a-z]*make\.php\?.*(simg=[^&]*)/, "/phpwas/restmb_allidxmake.php?idx=999&$1");
            return src.replace(/(\/phpwas\/restmb_[a-z]*make\.php)\?.*(simg=[^&]*)/, "$1?idx=999&$2");
        }

        if (src.match(/.*?\/timthumb\.php[?/].*?src=(.*)/)) {
            // http://dublinfilms.fr/wp-content/themes/purity/includes/timthumb.php?src=http://dublinfilms.fr/wp-content/uploads/2014/06/Actu-bandeau-bis.jpg&h=260&w=662&zc=1
            //   http://dublinfilms.fr/wp-content/uploads/2014/06/Actu-bandeau-bis.jpg
            // http://www.hcwd.com.tw/template/corporate_site/fk1/timthumb.php?src=http://www.hcwd.com.tw/snlev801/product/bimg/_MG_8893(001).jpg&w=410&s=1
            //   http://www.hcwd.com.tw/snlev801/product/bimg/_MG_8893(001).jpg
            // http://www.moviehotties.com/timthumb.php?src=/moviehotties/images/news-gallery/orig/Em-Rat-Met-G_1.jpg&w=85&h=85&q=100
            //   http://www.moviehotties.com/moviehotties/images/news-gallery/orig/Em-Rat-Met-G_1.jpg
            // https://www.wordonfire.org/wof-core/libraries/timthumb/timthumb.php?zc=1&w=1328&h=598&src=https://www.wordonfire.org/wof-site/media/brchristianitycrucifixion.jpg
            //   https://www.wordonfire.org/wof-site/media/brchristianitycrucifixion.jpg
            // http://imagecache.blastro.com/timthumb.php/src=http%3A%2F%2Fimages.blastro.com%2Fimages%2Fartist_images%2Ffull%2Ffull_booty_luv_artist_photo1.jpg&w=610&h=457&zc=2&a=T
            //   http://images.blastro.com/images/artist_images/full/full_booty_luv_artist_photo1.jpg
            return urljoin(src, decodeURIComponent(src.replace(/.*\/timthumb\.php[?/].*?src=([^&]*).*/, "$1")));
        }

        if (src.match(/\/fotogallery\/[0-9]+X[0-9]+\//)) {
            // http://static.pourfemme.it/pfcoppia/fotogallery/1200X0/11285/solene-rigot-e-zacharie-chasseriaud.jpg
            //   http://static.pourfemme.it/pfcoppia/fotogallery/99999999999X0/11285/solene-rigot-e-zacharie-chasseriaud.jpg
            // http://static.stylosophy.it/stshoes/fotogallery/1200X0/183603/decolletes-gioiello-gedebe-gialle.jpg
            //   http://static.stylosophy.it/stshoes/fotogallery/9999999999X0/183603/decolletes-gioiello-gedebe-gialle.jpg
            // http://static.qnm.it/www/fotogallery/1200X0/110767/martina-stella-bikini.jpg
            //   http://static.qnm.it/www/fotogallery/9999999999X0/110767/martina-stella-bikini.jpg
            // http://static.myluxury.it/myluxury/fotogallery/1200X0/119923/uovo-zen-by-nobu.jpg
            //   http://static.myluxury.it/myluxury/fotogallery/9999999999X0/119923/uovo-zen-by-nobu.jpg
            // http://static.derapate.it/derapate/fotogallery/1200X0/64729/grid-girls-motogp-le-ragazze-del-paddock-4.jpg
            //   http://static.derapate.it/derapate/fotogallery/9999999999X0/64729/grid-girls-motogp-le-ragazze-del-paddock-4.jpg
            return src.replace(/\/fotogallery\/[0-9]+X[0-9]+\//, "/fotogallery/9999999999X0/");
        }

        if (src.indexOf("/redim_recadre_photo.php") >= 0) {
            // probably the only site with this?
            // http://diffusionph.cccommunication.biz/jpgok/redim_recadre_photo.php?path_url=http://diffusionvid.cccommunication.biz/thumbnail_embed/46408.jpg&width=480&height=320
            //   http://diffusionvid.cccommunication.biz/thumbnail_embed/46408.jpg
            return src.replace(/.*\/redim_recadre_photo\.php\?.*?path_url=([^&]*).*/, "$1");
        }

        if (src.indexOf("/wp-apps/imrs.php?") >= 0) {
            // https://img.washingtonpost.com/wp-apps/imrs.php?src=https://img.washingtonpost.com/rw/2010-2019/Wires/Images/2017-10-15/AP/Britain_Hogwarts_Express_15930-4186c.jpg
            // https://img.washingtonpost.com/wp-apps/imrs.php?src=https://img.washingtonpost.com/news/comic-riffs/wp-content/uploads/sites/15/2017/11/PIXAR-COCO-frida-kahlo-cordova-buckley.jpg&w=480
            return src.replace(/.*\/wp-apps\/imrs\.php\?[^/]*src=([^&]*).*/, "$1");
        }

        if (src.match(/\/dynimage\/[^/]*\/[0-9]*\/[^/]*$/)) {
            // https://www.yield247.com/dynimage/imagesize10/1301/image.jpg
            // https://www.kyphimalta.com/dynimage/imagesize10/541/image.png
            // http://www.hitradingltd.com/dynimage/imagesize10/514/image.png
            return src.replace(/\/dynimage\/[^/]*\//, "/dynimage/original/"); // can be anything
        }

        if (src.match(/\/phocagallery\/.*\/thumbs\/[^/]*$/)) {
            // https://www.beautybybeccy.com.au/images/phocagallery/photoshoot/Promo%20Model%20shoot/thumbs/phoca_thumb_m_DSC09589-edit.jpg
            //   https://www.beautybybeccy.com.au/images/phocagallery/photoshoot/Promo%20Model%20shoot/DSC09589-edit.jpg
            return src.replace(/\/thumbs\/phoca_thumb_[^/._]*_/, "/");
        }

        if (src.match(/\/sfc\/servlet\.shepherd\/version\/renditionDownload/) && false) {
            // wip, need way to disable downloading?
            // sources:
            // https://salesforce.stackexchange.com/questions/171149/lightning-component-using-renditiondownload-to-view-files-img-doc-xlxs-etc
            // https://forum.bigcommerce.com/s/question/0D51B00003zftI0SAI/hide-the-bigcommerce-cdn-image-path-on-image-mouseover-product-detail-page
            // https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_rendition.htm
            // https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_preview_format.htm
            //
            // https://forum.bigcommerce.com/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=0681B0000064R3r&operationContext=CHATTER&contentId=05T1B00000GDv1i&page=0
            //   https://forum.bigcommerce.com/sfc/servlet.shepherd/version/renditionDownload?rendition=ORIGINAL_Png&versionId=0681B0000064R3r&operationContext=CHATTER&contentId=05T1B00000GDv1i
            //   https://forum.bigcommerce.com/sfc/servlet.shepherd/version/download/0681B0000064R3r (versionId, works, but requires download)
            // https://support.bigcommerce.com/servlet/rtaImage?eid=ka61B000000ClUi&feoid=00N1300000BR3CT&refid=0EM130000018Xoh
            //
            // doesn't work:
            // https://forum.bigcommerce.com/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=06813000005iizB&operationContext=CHATTER&contentId=05T1300000FCL6J
            //   https://forum.bigcommerce.com/sfc/servlet.shepherd/version/renditionDownload?rendition=ORIGINAL_Jpg&versionId=06813000005iizB&operationContext=CHATTER&contentId=05T1300000FCL6J -- works
            //return src.replace(/(\/renditionDownload.*?[?&]rendition=)[^&]*/, "$1ORIGINAL_Png");
        }

        if (domain.indexOf("cdn.vox-cdn.com") >= 0 ||
            domain === "thumbnails.trvl-media.com" ||
            domain === "thumbor-static.factorymedia.com" ||
            // https://cdnrockol-rockolcomsrl.netdna-ssl.com/Q3UJZHxl455fWTe78h_5zbtv-WY=/700x0/smart/http%3A%2F%2Fs.mxmcdn.net%2Fimages-storage%2Falbums%2F4%2F5%2F4%2F7%2F6%2F0%2F12067454_800_800.jpg
            //   http://s.mxmcdn.net/images-storage/albums/4/5/4/7/6/0/12067454_800_800.jpg
            domain === "cdnrockol-rockolcomsrl.netdna-ssl.com" ||
            // https://www.infobae.com/new-resizer/jfCQ7-AjnQyNdmWHdFGYvzYmVx4=/600x0/filters:quality(100)/arc-anglerfish-arc2-prod-infobae.s3.amazonaws.com/public/4IOFEV5GJVES3DVJ2XHDFXA2TE
            domain === "www.infobae.com" ||
            // http://s2.glbimg.com/i7GBoDhq8XYOfFinAMZv0YYZdPY=/e.glbimg.com/og/ed/f/original/2016/12/26/eb8.jpg
            //   http://e.glbimg.com/og/ed/f/original/2016/12/26/eb8.jpg
            // https://s2.glbimg.com/guJ0REQ3RhF8RtD-dacV89xdGQI=/140x111/e.glbimg.com/og/ed/f/original/2015/02/12/nicole_scherzinger.jpg
            //   http://e.glbimg.com/og/ed/f/original/2015/02/12/nicole_scherzinger.jpg
            domain.match(/s[0-9]*\.glbimg\.com/) ||
            // https://i.amz.mshcdn.com/vWTWthC534bzcGDk15NwrBy-dd4=/fit-in/1200x9600/https%3A%2F%2Fblueprint-api-production.s3.amazonaws.com%2Fuploads%2Fcard%2Fimage%2F54484%2FGettyImages-520238014.jpg
            //   https://blueprint-api-production.s3.amazonaws.com/uploads/card/image/54484/GettyImages-520238014.jpg
            domain === "i.amz.mshcdn.com" ||
            // https://img.ilcdn.fi/64wZEcZPDqMNu7XwxW5cDqWKPYQ=/full-fit-in/612x/img-s3.ilcdn.fi/e36990bb042d3364aa4c91d8105889fc29941e7ae97600defb8f12cbb87e55c6.jpg
            //   https://img.ilcdn.fi/64wZEcZPDqMNu7XwxW5cDqWKPYQ=/full-fit-in/612x/img-s3.ilcdn.fi/e36990bb042d3364aa4c91d8105889fc29941e7ae97600defb8f12cbb87e55c6.jpg -- 403
            domain === "img.ilcdn.fi" ||
            // https://img.fstatic.com/JOPw9nZjrfLTo9avaG2aY1drkko=/full-fit-in/640x480/https://cdn.fstatic.com/media/artists/avatar/2017/05/christopher-nolan_a8719.jpg
            //   https://cdn.fstatic.com/media/artists/avatar/2017/05/christopher-nolan_a8719.jpg
            domain === "img.fstatic.com" ||
            // https://img.mthcdn.com/ksCA14bSIxTz78rH3WvCXR9ZdkU=/798x1197/picpost.mthai.com/pic/2017/01/2025222.jpg
            //   https://picpost.mthai.com/pic/2017/01/2025222.jpg
            domain === "img.mthcdn.com" ||
            src.match(/:\/\/[^/]*\/thumbor\/[^/]*=\//) ||
            src.match(/:\/\/[^/]*\/resizer\/[^/]*=\/[0-9]+x[0-9]+(?::[^/]*\/[0-9]+x[0-9]+)?\/(?:filters:[^/]*\/)?/)) {
            // https://cdn.vox-cdn.com/thumbor/ta2xdyUViVrBXCLGapdwLY7is_s=/0x0:3000x2355/1200x800/filters:focal(1116x773:1596x1253)/cdn.vox-cdn.com/uploads/chorus_image/image/55856727/815434448.0.jpg
            // https://cdn.vox-cdn.com/thumbor/dXu99BQwBagCavae7oYNG0uBfxQ=/0x46:1100x779/1200x800/filters:focal(0x46:1100x779)/cdn.vox-cdn.com/assets/1763547/Screenshot_2012.11.12_10.39.10.jpg
            // https://cdn.vox-cdn.com/thumbor/iTJF1PhWPiR3-LoITuXxS2u8su0=/1200x0/filters:no_upscale()/cdn.vox-cdn.com/uploads/chorus_asset/file/4998263/keenan_2010.0.jpg
            // https://dotesports-cdn-prod-tqgiyve.stackpathdns.com/thumbor/baiRf8sOE9flXNjU5cHytZ9fqwA=/1200x0/filters:no_upscale()/https://dotesports-cdn-prod-tqgiyve.stackpathdns.com/article/ee3f5018-0e8b-4e5f-b040-c466c8979315.png
            //   https://dotesports-cdn-prod-tqgiyve.stackpathdns.com/article/ee3f5018-0e8b-4e5f-b040-c466c8979315.png
            // https://www.armytimes.com/resizer/M5qc8PYkbDFYKpOg0Bt-5rxWMXE=/1200x0/filters:quality(100)/arc-anglerfish-arc2-prod-mco.s3.amazonaws.com/public/QRMIMUNV7ZDDJFOLI5FJSYZKQI.jpg
            //   http://arc-anglerfish-arc2-prod-mco.s3.amazonaws.com/public/QRMIMUNV7ZDDJFOLI5FJSYZKQI.jpg
            // http://www.latimes.com/resizer/S-IaQvJtBOga26puDEgDkHihCqE=/1400x0/arc-anglerfish-arc2-prod-tronc.s3.amazonaws.com/public/TQAY2PZTVBAQVBCFEMZRY57HSE.jpg
            //   http://arc-anglerfish-arc2-prod-tronc.s3.amazonaws.com/public/TQAY2PZTVBAQVBCFEMZRY57HSE.jpg
            // https://thumbnails.trvl-media.com/8ngGMfPTsqKt4MGmUrf-ErVrGm4=/a.travel-assets.com/mediavault.le/media/9eed34ce4955bc445d38357fa3eb076400431778.jpeg
            //   http://a.travel-assets.com/mediavault.le/media/9eed34ce4955bc445d38357fa3eb076400431778.jpeg
            // https://thumbnails.trvl-media.com/cPqnei5uS1AEzRn7k5XzNoUjFuo=/534x356/images.trvl-media.com/hotels/1000000/30000/22100/22046/22046_358_y.jpg
            // https://www.theglobeandmail.com/resizer/fyZn3o3OC1db2M-zd1Vkc0Z-O8I=/0x80:5738x3906/400x0/filters:quality(80)/arc-anglerfish-tgam-prod-tgam.s3.amazonaws.com/public/GVZVQCEPZFKPHG4UAE2AEI3PQU.jpg
            //   http://arc-anglerfish-tgam-prod-tgam.s3.amazonaws.com/public/GVZVQCEPZFKPHG4UAE2AEI3PQU.jpg
            // https://thumbor-static.factorymedia.com/qBeNkBSFgEWpq0AbpElby6YyNTs=/1920x1080/smart/http%3A%2F%2Fcoresites-cdn.factorymedia.com%2Fmpora_new%2Fwp-content%2Fuploads%2F2015%2F12%2FSea-Life-Aquariums-Animal-Captivity-Beluga-Whale.jpg
            //   http://coresites-cdn.factorymedia.com/mpora_new/wp-content/uploads/2015/12/Sea-Life-Aquariums-Animal-Captivity-Beluga-Whale.jpg
            //return src.replace(/.*\/thumbor\/.*?\/([^/]*\..*)/, "http://$1");
            newsrc = src.replace(/.*\/(?:thumb(?:or)?|(?:new-)?resizer)\/.*?\/(?:filters:[^/]*\/)?([a-z]*:\/\/.*)/, "$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/.*\/(?:thumb(?:or)?|(?:new-)?resizer)\/.*?\/(?:filters:[^/]*\/)?([^/]*\..*)/, "http://$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/.*\/[-_A-Za-z0-9]+=\/(?:(?:full-)?fit-in\/)?(?:[0-9x:]+\/)?(?:smart\/)?(?:filters:[^/]*\/)?((?:https?:\/\/)?[^/]*\..*)/, "$1");
            if (newsrc.indexOf("http") !== 0) {
                newsrc = "http://" + newsrc;
            }

            if (newsrc.match(/^[a-z]*%3/))
                newsrc = decodeURIComponent(newsrc);
            return newsrc;
        }

        if (src.match(/:\/\/[^/]*\/astronaut\/uploads\/[a-z]_[^/]*$/)) {
            // http://zoodydesign.com/astronaut/uploads/m_dt8a0843-1.jpg
            // http://astronaut-project.com/astronaut/uploads/s_scenes-1.jpg
            // http://coffeemegane.com/astronaut/uploads/s_buttertoast3.jpg
            // m, s, t
            return src.replace(/\/[a-z]_([^/]*)$/, "/$1");
        }

        if (src.match(/\/spree\/images\/attachments\/[0-9]+\/[0-9]+\/[0-9]+\//) ||
            domain === "d3on60wtl1ot7i.cloudfront.net") {
            // https://static-assets.glossier.com/production/spree/images/attachments/000/001/802/square_tiny/1.jpg?1518217843
            //   https://static-assets.glossier.com/production/spree/images/attachments/000/001/802/original/1.jpg?1518217843
            // http://d3on60wtl1ot7i.cloudfront.net/system/topics/covers/000/000/122/medium/Sfondo-test-j-law.jpg?1460719638
            //   http://d3on60wtl1ot7i.cloudfront.net/system/topics/covers/000/000/122/big/Sfondo-test-j-law.jpg?1460719638
            return src.replace(/(\/[0-9]+\/[0-9]+\/[0-9]+\/)[^/]*\/([^/?]*)[^/]*?$/, "$1original/$2");
        }

        if (src.match(/\/applications\/core\/interface\/imageproxy\/imageproxy\.php/)) {
            // https://www.gfsquad.com/forums/applications/core/interface/imageproxy/imageproxy.php?img=http%3A%2F%2Fpds.joins.com%2Fnews%2Fcomponent%2Filgan_isplus%2F201701%2F13%2F2017011315392489300.jpeg&key=6b519f95396e21199c45a761bfe54fadbb09cf562c31b39591a14f25386ea26c
            //   http://pds.joins.com/news/component/ilgan_isplus/201701/13/2017011315392489300.jpeg
            return decodeURIComponent(src.replace(/.*\/imageproxy\/imageproxy\.php.*?[&?]img=([^&]*).*?$/, "$1"));
        }

        if (src.match(/\/dims[0-9]*\/.*?\/(?:(?:(?:thumbnail|resize)\/[0-9>%A-F]+[xX][0-9>%A-F]+[^/]*\/)|(?:crop\/[0-9]+[xX][0-9]+)).*?(?:\/https?:\/\/|\?url=https?%3A)/)) {
            // https://www.usnews.com/dims4/USNEWS/b09d13c/2147483647/thumbnail/970x647/quality/85/?url=http%3A%2F%2Fmedia.beam.usnews.com%2Fd0%2F686a3b584a63500605362dd3a1da31%2Ftag%3Areuters.com%2C2018%3Anewsml_LYNXNPEE25072%3A12018-03-06T044537Z_1_LYNXNPEE25072_RTROPTP_3_THAILAND-POLITICS.JPG
            // https://www.usnews.com/dims4/USNEWS/f128de1/2147483647/thumbnail/640x420/quality/85/?url=http%3A%2F%2Fmedia.beam.usnews.com%2Fbd%2F0cf00f10ccd3788e7b9a42f1717e9d%2Ftag%3Areuters.com%2C2018%3Anewsml_LYNXNPEE1R088%3A12018-02-28T035131Z_1_LYNXNPEE1R088_RTROPTP_3_NORTHKOREA-SOUTHKOREA.JPG
            // https://assets.sourcemedia.com/dims4/default/80669dd/2147483647/thumbnail/1200x630%3E/quality/90/?url=https%3A%2F%2Fassets.sourcemedia.com%2Fd9%2Fdf%2Fdf39cfb641848cd34eb997e96dc1%2Ffp-hockey-thumbnail-3-7-18.jpg
            // http://cdn.expansion.mx/dims4/default/5227468/2147483647/thumbnail/850x478%5E/quality/75/?url=https%3A%2F%2Fcdn.expansion.mx%2Fmedia%2F2010%2F06%2F08%2Fobreros-chinos-trabajadores-china.jpg
            // https://static.politico.com/dims4/default/cf5f5c0/2147483647/thumbnail/1160x629%5E/quality/90/?url=https%3A%2F%2Fstatic.politico.com%2F0f%2F99%2F94afe4ce45b9ab5aae5bab68ba12%2F23-donald-trump-145-gty-1160.jpg
            // https://cdn.peopleewnetwork.com/dims4/default/120c6ea/2147483647/thumbnail/1200x630/quality/90/?url=http%3A%2F%2Fpmd369713tn.download.theplatform.com.edgesuite.net%2FTime_Inc._-_OTT_-_Production%2F938%2F485%2Foscars-red-carpet-live-2018-thumbnail.jpg
            // https://d1nwosmzpc2sru.cloudfront.net/dims4/GG/54de7b9/2147483647/thumbnail/1350x580/quality/90/?url=https%3A%2F%2Fd1nwosmzpc2sru.cloudfront.net%2F27%2Fa8%2Ff64376a04a1babb29fe2f46c651c%2Fdp-bcg54217-online-store-generic-dl.png
            // http://cdn2.uvnimg.com/dims4/default/2fc4182/2147483647/thumbnail/400x250%3E/quality/75/?url=http%3A%2F%2Fcdn4.uvnimg.com%2F18%2F9e%2F0bc507aa44d6a563d06d223a647c%2Funtitled-1.jpg
            // https://cdn.video.nationalgeographic.com/dims4/default/8efd9cf/2147483647/thumbnail/354x199%3E/quality/90/?url=http%3A%2F%2Fcdn.video.nationalgeographic.com%2F6b%2F61%2F546ff7344acaac17399cd281fcef%2Fnw-seo-srt-013-nobel-prize-thumbnail-final.jpg
            //   http://cdn.video.nationalgeographic.com/6b/61/546ff7344acaac17399cd281fcef/nw-seo-srt-013-nobel-prize-thumbnail-final.jpg
            // https://mediadc.brightspotcdn.com/dims4/default/2a5e0c0/2147483647/strip/true/crop/2300x1302+0+16/resize/1060x600!/quality/90/?url=https%3A%2F%2Fmediadc.brightspotcdn.com%2F02%2F1d%2Fbbc21ecf48179b92cc23616443d3%2Fsun.jpg
            //   https://mediadc.brightspotcdn.com/02/1d/bbc21ecf48179b92cc23616443d3/sun.jpg
            // https://static.politico.com/dims4/default/b45191a/2147483647/resize/1160x%3E/quality/90/?url=https%3A%2F%2Fstatic.politico.com%2F85%2Fd5%2F3ffa5d764ae681f97ad70be2eecc%2F171205-mag-taylor-swift-ap-2-1160.jpg
            //   https://static.politico.com/85/d5/3ffa5d764ae681f97ad70be2eecc/171205-mag-taylor-swift-ap-2-1160.jpg
            //
            // https://d33ljpvc0tflz5.cloudfront.net/dims3/MMH/thumbnail/620x392/quality/75/?url=https%3A%2F%2Fd26ua9paks4zq.cloudfront.net%2F68%2F8d%2F197eef2a45cb84795efda4607102%2Fendoscopy-738x399-s1-stk-119373043.jpg
            //   https://d26ua9paks4zq.cloudfront.net/68/8d/197eef2a45cb84795efda4607102/endoscopy-738x399-s1-stk-119373043.jpg
            // http://o.aolcdn.com/dims-shared/dims3/MUSIC/thumbnail/280X390/quality/90/http://o.aolcdn.com/os/music/artist/wikipedia/the-platters-1970.jpg
            // http://o.aolcdn.com/dims-shared/dims3/MUSIC/thumbnail/280X390/http://o.aolcdn.com/os/music/artist/wikipedia/the-platters-1970.jpg
            //   http://o.aolcdn.com/os/music/artist/wikipedia/the-platters-1970.jpg
            // https://s.aolcdn.com/dims-shared/dims3/GLOB/crop/2039x3000+0+0/resize/630x927!/format/jpg/quality/85/https://s.aolcdn.com/hss/storage/midas/4d5ea3524916327c5b9a2d8b7b75dad6/205490598/cara-delevingne-attends-the-premiere-of-europacorp-and-stx-valerian-picture-id817090276
            //   https://s.aolcdn.com/hss/storage/midas/4d5ea3524916327c5b9a2d8b7b75dad6/205490598/cara-delevingne-attends-the-premiere-of-europacorp-and-stx-valerian-picture-id817090276
            newsrc = src.replace(/.*\/(?:thumbnail|crop|resize)\/.*?\/(https?:\/\/.*)/, "$1");
            if (newsrc !== src)
                return newsrc;
            return decodeURIComponent(src.replace(/.*\/(?:thumbnail|crop|resize)\/.*?\/\?url=(https?.*)/, "$1"));
        }

        // joomla
        if (src.match(/\/media\/k2\/items\/cache\/[^/]*_[^/]*\.[^/.]*$/)) {
            // http://www.truth-out.org/media/k2/items/cache/3393b2ec8c305f926fd19b07e9a77e2a_L.jpg
            //   http://www.truth-out.org/media/k2/items/src/3393b2ec8c305f926fd19b07e9a77e2a.jpg
            // http://www.frankie.com.au/media/k2/items/cache/d3a6ffb9fa95acd07ae12a9b3648acf3_M.jpg
            //   http://www.frankie.com.au/media/k2/items/src/d3a6ffb9fa95acd07ae12a9b3648acf3.jpg
            return src.replace(/\/cache\/([^/]*)_[^/._]*?(\.[^/.]*)$/, "/src/$1$2");
        }

        // xenforo
        if (src.match(/:\/\/[^/]*\/proxy\.php.*?[?&]image=http/)) {
            return decodeURIComponent(src.replace(/.*:\/\/[^/]*\/proxy\.php.*?[?&]image=(http[^&]*).*/, "$1"));
        }

        // django-photologue
        if (src.match(/\/media\/photologue\/photos\/cache\//)) {
            // http://www.thewesternstar.com/media/photologue/photos/cache/EDM113447235_large.jpg
            //   http://www.thewesternstar.com/media/photologue/photos/EDM113447235.jpg
            // http://www.django-photologue.net/media/photologue/photos/cache/312960255_85e378833b_o_thumbnail.jpg
            //   http://www.django-photologue.net/media/photologue/photos/312960255_85e378833b_o.jpg
            return src.replace(/\/cache\/([^/]*)_[a-z]+(\.[^/.]*)$/, "/$1$2");
        }

        if (src.match(/\/\.evocache\/([^/]*\.[^/]*)\/fit-[0-9]+x[0-9]+\.[^/.]*$/)) {
            // http://look.onemonkey.org/.evocache/LondonBUR.png/fit-80x80.png
            return src.replace(/\/\.evocache\/([^/]*\.[^/]*)\/[^/]*$/, "/$1");
        }

        if (src.match(/:\/\/[^/]*\/yahoo_site_admin[0-9]*\/assets\/images\//)) {
            // http://www.asthedj.com/yahoo_site_admin2/assets/images/IMG_5618.13210131_large.JPG
            //   http://www.asthedj.com/yahoo_site_admin2/assets/images/IMG_5618.13210131.JPG
            // http://gio-ott.com/yahoo_site_admin2/assets/images/_MG_9380.20591513_large.jpg
            //   http://gio-ott.com/yahoo_site_admin2/assets/images/_MG_9380.20591513.jpg
            // http://www.spiritwalkministry.com/yahoo_site_admin2/assets/images/stonehenge-full-moon-night.27260345_std.jpg
            //   http://www.spiritwalkministry.com/yahoo_site_admin2/assets/images/stonehenge-full-moon-night.27260345.jpg
            // http://www.merrickartgallery.org/yahoo_site_admin2/assets/images/Merrick_Masters_Cover.12375349_std.jpg
            //   http://www.merrickartgallery.org/yahoo_site_admin2/assets/images/Merrick_Masters_Cover.12375349.jpg
            return src.replace(/(\.[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }




        if (domain.indexOf("media.toofab.com") >= 0 && true) { // doesn't work for all urls
            // works:
            // https://media.toofab.com/2017/12/13/gettyimages-891360920-master-1000w.jpg
            // https://media.toofab.com/2017/12/13/gettyimages-891258416-master-1000w.jpg
            // doesn't work:
            // https://media.toofab.com/2017/10/31/screen-shot-2017-10-31-at-3-57-1000w.jpg (300x250 works)
            src = src.replace(/-[0-9]+w\.([^/.]*)/, ".$1");

            // works:
            // https://media.toofab.com/2018/01/02/stars-who-refuse-to-take-selfies-with-fans-split-480x360.jpg (1000w works too)
            // doesn't work: (access denied)
            // https://media.toofab.com/2018/01/02/0102-justin-timberlake-main-300x250.jpg
            // https://media.toofab.com/2018/01/02/0102-justin-timberlake-main-810x610.jpg
            // https://media.toofab.com/2017/10/23/gettyimages-844434368-810x610.jpg
            // https://media.toofab.com/2018/01/02/traveling-pants-everett-300x400.jpg
            // https://media.toofab.com/2017/11/01/timberlake-teaser-480x360.jpg
            // https://media.toofab.com/2017/12/22/1222-tom-katie-lala-main-300x250.jpg
            src = src.replace(/-[0-9]+x[0-9]+\.([^/.]*)/, ".$1");
        }

        if (options.null_if_no_change) {
            if (src !== origsrc)
                return src;
            return null;
        }

        return src;
    }
    // -- end bigimage --

    var fullurl_obj = function(currenturl, obj) {
        if (!obj)
            return obj;

        if (obj instanceof Array) {
            var newobj = [];
            obj.forEach((url) => {
                newobj.push(fullurl(currenturl, url));
            });
            return newobj;
        } else if (typeof(obj) === "object") {
            obj.url = fullurl_obj(currenturl, obj.url);
            return obj;
        } else {
            return fullurl(currenturl, obj);
        }
    };

    var fillobj = function(obj, baseobj) {
        if (obj instanceof Array ||
            typeof(obj) === "string") {
            obj = {url: obj};
        }

        var item;
        if (baseobj) {
            for (item in baseobj) {
                if (!(item in obj)) {
                    obj[item] = baseobj[item];
                }
            }
        }

        for (item in default_object) {
            if (!(item in obj)) {
                obj[item] = default_object[item];
            }
        }

        return obj;
    };

    var same_url = function(url, obj) {
        obj = fillobj(obj);
        if (obj.url instanceof Array) {
            return obj.url.indexOf(url) >= 0;
        } else {
            return !obj.url || (obj.url === url);
        }
    };

    var bigimage_recursive = function(url, options) {
        if (!options)
            options = {};

        for (var option in default_options) {
            if (!(option in options)) {
                options[option] = default_options[option];
            }
        }

        var cb = null;
        if (options.cb) {
            var orig_cb = options.cb;
            options.cb = function(x) {
                orig_cb(fillobj(x));
            };
        }

        var waiting = false;

        var newhref = url;
        var currenthref = newhref;
        var currentobj = null;
        for (var i = 0; i < options.iterations; i++) {
            waiting = false;
            /*if (newhref instanceof Array)
                currenthref = newhref[0];*/

            var big = bigimage(currenthref, options);
            if (!big && options.null_if_no_change) {
                if (newhref === url)
                    newhref = big;
                break;
            }

            var newhref1 = fullurl_obj(currenthref, big);
            if (!newhref1) {
                break;
            }

            var objified = fillobj(newhref1);

            if (typeof(newhref1) === "object") {
                currentobj = newhref1;
                if (newhref1.waiting) {
                    waiting = true;
                    if (!newhref1.url) {
                        newhref = newhref1;
                        break;
                    }
                }
            } else {
                currentobj = null;
            }

            if (same_url(currenthref, objified)) {
                break;
            } else {
                if (objified.url instanceof Array)
                    currenthref = objified.url[0];
                else
                    currenthref = objified.url;
                newhref = newhref1;
            }
            /*if (newhref1 !== currenthref) {
                if (newhref1 instanceof Array) {
                    if (newhref1.indexOf(currenthref) >= 0)
                        break;
                    currenthref = newhref1[0];
                } else if (typeof(newhref1) === "object") {
                    if (newhref1.waiting)
                        waiting = true;
                    if (newhref1.url instanceof Array) {
                        if (newhref1.url.indexOf(currenthref) >= 0)
                            break;
                        currenthref = newhref1.url[0];
                    } else if (!newhref1.url) {
                        newhref = newhref1;
                        break;
                    } else {
                        if (newhref1.url === currenthref)
                            break;
                        currenthref = newhref1.url;
                    }
                } else {
                    currenthref = newhref1;
                }
                newhref = newhref1;
            } else {
                break;
            }*/

            if (_nir_debug_) {
                break;
            }
        }

        if (options.fill_object) {
            newhref = fillobj(newhref, currentobj);
        }

        if (options.cb && !waiting) {
            options.cb(newhref);
        }

        return newhref;
    };

    var redirect = function(url) {
        if (_nir_debug_)
            return;

        if (url === document.location.href)
            return;

        // wrap in try/catch due to nano defender
        try {
            // avoid downloading more before redirecting
            window.stop();
        } catch (e) {
        }
        document.location = url;
    };

    var check_image = function(url, obj, err_cb) {
        if (url !== document.location.href) {
            var headers = obj.headers;
            console.log(url);
            if (!_nir_debug_ || !_nir_debug_.no_request) {
                document.documentElement.style.cursor = "wait";

                var url_domain = url.replace(/^([a-z]+:\/\/[^/]*).*?$/, "$1");

                var origheaders = JSON.parse(JSON.stringify(headers));

                var customheaders = true;
                if (!headers || Object.keys(headers).length === 0) {
                    customheaders = false;
                    headers = {
                        "Origin": url_domain,
                        "Referer": url
                    };
                } else if (!headers.Origin && !headers.origin) {
                    headers.Origin = url_domain;
                }

                if (customheaders) {
                    document.documentElement.style.cursor = "default";
                    console.log("Custom headers needed, currently unhandled");
                    return;
                }

                if (_nir_debug_)
                    console.dir(headers);

                //var http = new GM_xmlhttpRequest({
                do_request({
                    method: 'HEAD',
                    url: url,
                    headers: headers,
                    onload: function(resp) {
                        if (_nir_debug_)
                            console.dir(resp);

                        // nano defender removes this.DONE
                        if (resp.readyState == 4) {
                            document.documentElement.style.cursor = "default";

                            if (resp.finalUrl === document.location.href) {
                                console.log(resp.finalUrl);
                                console.log("Same URL");
                                return;
                            }

                            var headers = {};
                            var headers_splitted = resp.responseHeaders.split("\n");
                            headers_splitted.forEach((header) => {
                                header = header
                                    .replace(/^\s*/, "")
                                    .replace(/\s*$/, "");
                                var headername = header.replace(/^([^:]*?):\s*.*/, "$1");
                                var headerbody = header.replace(/^[^:]*?:\s*(.*)/, "$1");
                                headers[headername.toLowerCase()] = headerbody;
                            });

                            if (_nir_debug_)
                                console.dir(headers);


                            var digit = resp.status.toString()[0];

                            if (((digit === "4" || digit === "5") &&
                                 resp.status !== 405)) {
                                if (err_cb) {
                                    err_cb();
                                } else {
                                    console.error("Error: " + this.status);
                                }

                                return;
                            }

                            var content_type = headers["content-type"];
                            if (!content_type)
                                content_type = "";
                            content_type = content_type.toLowerCase();

                            if (content_type.match(/text\/html/) && !obj.head_wrong_contenttype) {
                                if (err_cb) {
                                    err_cb();
                                } else {
                                    console.error("Error: Not an image: " + content_type);
                                }

                                return;
                            }

                            if ((content_type.match(/binary\//) ||
                                 content_type.match(/application\//)) && !obj.head_wrong_contenttype) {
                                console.error("Forces download");
                                return;
                            }

                            if (headers["content-length"] && headers["content-length"] == "0" && !obj.head_wrong_contentlength) {
                                console.error("Zero-length image");
                                return;
                            }

                            if (!customheaders)
                                redirect(url);
                            else
                                console.log("Custom headers needed, currently unhandled");
                        }
                    }
                });
            }
        }
    };

    function do_export() {
        $$IMU_EXPORT$$ = bigimage_recursive;

        if (is_node) {
            module.exports = bigimage_recursive;
        } else if (is_scripttag) {
            imu_variable = bigimage_recursive;
        }
    }

    function do_redirect() {
        if (document.contentType.match(/^text\//)) {
            return;
        }

        bigimage_recursive(document.location.href, {
            fill_object: true,
            cb: function(newhref) {
                if (!newhref)
                    return;

                if (_nir_debug_)
                    console.dir(newhref);

                if (!newhref.can_head || newhref.always_ok) {
                    var newurl = newhref.url;
                    if (newurl instanceof Array) {
                        newurl = newurl[0];
                    }

                    if (newurl === document.location.href) {
                        return;
                    }

                    if (_nir_debug_) {
                        console.log("Not checking due to can_head == false || always_ok == true");
                    }

                    redirect(newhref.url);
                    return;
                }

                if (newhref.url instanceof Array) {
                    var index = 0;
                    var cb = function() {
                        index++;
                        if (index >= newhref.url.length)
                            return;
                        check_image(newhref.url[index], newhref, cb);
                    };
                    check_image(newhref.url[0], newhref, cb);
                } else {
                    check_image(newhref.url, newhref);
                }
            }
        });
    }

    function onload(cb) {
        if (document.readyState === "complete" ||
            document.readyState === "interactive") {
            cb();
        } else {
            var state_cb = function() {
                if (document.readyState === "complete" ||
                    document.readyState === "interactive") {
                    cb();

                    document.removeEventListener("readystatechange", state_cb);
                }
            };

            document.addEventListener("readystatechange", state_cb);
        }
    }

    function do_options() {
        var options_el = document.getElementById("options");
        options_el.innerHTML = "<h1>Options</h1>";

        for (var setting in settings) {
            (function(setting) {
                var meta = settings_meta[setting];
                var value = settings[setting];

                var option = document.createElement("div");
                option.classList.add("option");

                var name = document.createElement("strong");
                name.innerHTML = meta.name;
                name.title = meta.description;
                option.appendChild(name);

                var type = "options";
                var option_list = {};

                if (typeof value === "boolean") {
                    type = "options";
                    option_list["true"] = {name: "Yes"};
                    option_list["false"] = {name: "No"};
                    if (value)
                        option_list["true"].checked = true;
                    else
                        option_list["false"].checked = true;
                } else if (meta.options) {
                    type = "options";
                    option_list = JSON.parse(JSON.stringify(meta.options));
                    if (value in option_list)
                        option_list[value].checked = true;
                }

                if (type === "options") {
                    for (var op in option_list) {
                        var id = "input_" + setting + "_" + op;
                        var input = document.createElement("input");
                        input.setAttribute("type", "radio");
                        input.name = setting;
                        input.value = op;
                        input.id = id;
                        if (option_list[op].checked)
                            input.setAttribute("checked", "true");

                        input.addEventListener("change", function(event) {
                            var value = this.value;

                            if (value === "true")
                                value = true;

                            if (value === "false")
                                value = false;

                            set_value(setting, value);
                        });

                        option.appendChild(input);

                        var label = document.createElement("label");
                        label.setAttribute("for", id);
                        label.innerHTML = option_list[op].name;

                        if (option_list[op].description)
                            label.title = option_list[op].description;

                        option.appendChild(label);
                    }
                }

                options_el.appendChild(option);
            })(setting);
        }
    }

    function get_value(key, cb) {
        if (typeof GM_getValue !== "undefined") {
            return cb(GM_getValue(key, undefined));
        } else {
            GM.getValue(key, undefined).then(cb);
        }
    }

    function set_value(key, value) {
        console.log("Setting " + key + " = " + value);
        if (typeof GM_setValue !== "undefined") {
            return GM_setValue(key, value);
        } else {
            return GM.setValue(key, value);
        }
    }

    function do_config() {
        var settings_done = 0;
        for (var setting in settings) {
            (function(setting) {
                get_value(setting, function(value) {
                    settings_done++;
                    if (value !== undefined)
                        settings[setting] = value;
                    if (settings_done >= Object.keys(settings).length)
                        start();
                });
            })(setting);
        }
    }

    function do_mouseover() {
        var mouseX = 0;
        var mouseY = 0;

        var mouseAbsX = 0;
        var mouseAbsY = 0;

        var popups = [];
        var controlPressed = false;
        var waiting = false;

        var waitingel = null;
        var waitingsize = 200;

        var keycode;
        if (settings.mouseover_trigger === "ctrl") {
            keycode = 17;
        } else if (settings.mouseover_trigger === "shift") {
            keycode = 16;
        } else if (settings.mouseover_trigger === "alt") {
            keycode = 18;
        }

        function update_waiting() {
            waitingel.style.left = (mouseAbsX - (waitingsize / 2)) + "px";
            waitingel.style.top = (mouseAbsY - (waitingsize / 2)) + "px";
        }

        function start_waiting() {
            if (!waitingel) {
                waitingel = document.createElement("div");
                waitingel.style.zIndex = Number.MAX_SAFE_INTEGER;
                waitingel.style.cursor = "wait";
                waitingel.style.width = waitingsize + "px";
                waitingel.style.height = waitingsize + "px";
                waitingel.style.position = "absolute";
                document.body.appendChild(waitingel);
            }

            waiting = true;
            waitingel.style.display = "block";

            update_waiting();
        }

        function stop_waiting() {
            waitingel.style.display = "none";
            waiting = false;
        }

        function resetpopups() {
            popups.forEach(function (popup) {
                if (popup.parentNode)
                    popup.parentNode.removeChild(popup);

                var index = popups.indexOf(popup);
                if (index > -1) {
                    popups.splice(index, 1);
                }
            });
        }

        function check_image_get(images, obj, cb) {
            if (images.length === 0) {
                return cb(null);
            }

            function err_cb() {
                images.shift();
                return check_image_get(images, obj, cb);
            }

            //console.log(images);
            var url = images[0];

            var url_domain = url.replace(/^([a-z]+:\/\/[^/]*).*?$/, "$1");

            var headers = obj.headers;

            if (!headers || Object.keys(headers).length === 0) {
                headers = {
                    "Origin": url_domain,
                    "Referer": document.location.href
                };
            } else if (!headers.Origin && !headers.origin) {
                headers.Origin = url_domain;
            }

            do_request({
                method: 'GET',
                url: images[0],
                responseType: 'blob',
                headers: headers,
                onload: function(resp) {
                    if (resp.readyState == 4) {
                        var digit = resp.status.toString()[0];

                        if (((digit === "4" || digit === "5") &&
                             resp.status !== 405)) {
                            if (err_cb) {
                                err_cb();
                            } else {
                                console.error("Error: " + this.status);
                            }

                            return;
                        }

                        var a = new FileReader();
                        a.onload = function(e) {
                            var img = document.createElement("img");
                            img.src = e.target.result;
                            img.onload = function() {
                                cb(img, resp.finalUrl);
                            };
                        };
                        a.readAsDataURL(resp.response);
                    }
                }
            });
        }

        function makePopup(obj) {
            var x = mouseAbsX;
            var y = mouseAbsY;

            function cb(img, url) {
                if (!controlPressed && false) {
                    stop_waiting();
                    return;
                }

                if (!img) {
                    stop_waiting();
                    return;
                }

                var div = document.createElement("div");
                div.style.position = "absolute";
                div.style.zIndex = Number.MAX_SAFE_INTEGER;
                div.style.boxShadow = "0 0 15px rgba(0,0,0,.5)";

                var vw = window.visualViewport.width - 10;
                var vh = window.visualViewport.height - 10;
                img.style.maxWidth = vw + "px";
                img.style.maxHeight = vh + "px";

                var imgh = img.naturalHeight;
                var imgw = img.naturalWidth;

                if (imgh > vh ||
                    imgw > vw) {
                    var ratio;
                    if (imgh / vh >
                        imgw / vw) {
                        ratio = imgh / vh;
                    } else {
                        ratio = imgw / vw;
                    }

                    imgh /= ratio;
                    imgw /= ratio;
                }

                div.style.top = (scrollTop() + Math.min(Math.max((y - scrollTop()) - (imgh / 2), 5), Math.max(vh - imgh, 5))) + "px";
                div.style.left = (scrollLeft() + Math.min(Math.max((x - scrollLeft()) - (imgw / 2), 5), Math.max(vw - imgw, 5))) + "px";
                /*console.log(x - (imgw / 2));
                console.log(vw);
                console.log(imgw);
                console.log(vw - imgw);*/


                var a = document.createElement("a");
                a.href = url;
                a.target = "_blank";
                a.onclick = resetpopups;
                a.appendChild(img);
                div.appendChild(a);
                document.body.appendChild(div);
                popups.push(div);

                stop_waiting();
                //console.log(div);
            }

            if (obj.src instanceof Array) {
                check_image_get(obj.url, obj, cb);
            } else {
                check_image_get([obj.url], obj, cb);
            }
        }

        function getUnit(unit) {
            if (unit.match(/^ *([0-9]+)px *$/)) {
                return unit.replace(/^ *([0-9]+)px *$/, "$1");
            }

            // https://github.com/tysonmatanich/getEmPixels/blob/master/getEmPixels.js
            var important = "!important;";
            var style = "position:absolute!important;visibility:hidden!important;width:" + unit + "!important;font-size:" + unit + "!important;padding:0!important";

            var extraBody;

            var unitel;
            if (!unitel) {
                // Emulate the documentElement to get rem value (documentElement does not work in IE6-7)
                unitel = extraBody = document.createElement("body");
                extraBody.style.cssText = "font-size:" + unit + "!important;";
                document.documentElement.insertBefore(extraBody, document.body);
            }

            // Create and style a test element
            var testElement = document.createElement("i");
            testElement.style.cssText = style;
            unitel.appendChild(testElement);

            // Get the client width of the test element
            var value = testElement.clientWidth;

            if (extraBody) {
                // Remove the extra body element
                document.documentElement.removeChild(extraBody);
            }
            else {
                // Remove the test element
                unitel.removeChild(testElement);
            }

            // Return the em value in pixels
            return value;
        }

        function find_source(els) {
            if (popups.length >= 1)
                return;

            //console.log(els);

            var sources = {};
            var picture_sources = {};
            var picture_minw = false;
            var picture_maxw = false;
            var picture_minh = false;
            var picture_maxh = false;

            var id = 0;
            var minW = 0;
            var minH = 0;
            var minMinW = 0;
            var minMinH = 0;
            var minMaxW = 0;
            var minMaxH = 0;
            var minX = 0;

            var source;

            function getsource() {
                var thesource = null;
                var first = false;
                for (var source in sources) {
                    if (first)
                        return;
                    first = true;
                    thesource = sources[source];
                }
                return thesource;
            }

            function getfirstsource(sources) {
                var smallestid = Number.MAX_SAFE_INTEGER;
                var thesource = null;
                for (var source_url in sources) {
                    var source = sources[source_url];
                    if (source.id < smallestid) {
                        smallestid = source.id;
                        thesource = sources[source_url];
                    }
                }

                return thesource;
            }

            function norm(src) {
                return urljoin(document.location.href, src);
            }

            function addImage(src, el) {
                // blank images
                // https://www.harpersbazaar.com/celebrity/red-carpet-dresses/g7565/selena-gomez-style-transformation/?slide=2
                if (src.match(/^data:/) && src.length <= 500)
                    return false;

                if (!(src in sources)) {
                    sources[src] = {
                        count: 1,
                        src: src,
                        el: el,
                        id: id++
                    };
                } else {
                    sources[src].count++;
                }

                return true;
            }

            function addElement(el) {
                if (el.tagName === "IMG") {
                    var src = norm(el.src);
                    if (!addImage(src, el))
                        return;

                    sources[src].width = el.naturalWidth;
                    sources[src].height = el.naturalHeight;
                } else if (el.tagName === "PICTURE") {
                    for (var i = 0; i < el.children.length; i++) {
                        addElement(el.children[i]);
                    }
                } else if (el.tagName === "SOURCE") {
                    if (!el.srcset)
                        return;

                    var ssources = el.srcset.split(/ +[^ ,/],/);

                    var sizes = [];
                    if (el.sizes) {
                        sizes = el.sizes.split(",");
                    }

                    for (var i = 0; i < ssources.length; i++) {
                        var src = norm(ssources[i].replace(/ .*/, ""));
                        var desc = ssources[i].replace(/.* /, "");

                        if (!addImage(src, el))
                            continue;

                        picture_sources[src] = sources[src];

                        sources[src].picture = el.parentElement;

                        if (desc) {
                            sources[src].desc = desc;

                            if (desc.match(/^ *[0-9]*x *$/)) {
                                var desc_x = parseInt(desc.replace(/^ *([0-9]*)x *$/, "$1"));
                                if (!sources[src].desc_x || sources[src].desc_x > desc_x) {
                                    sources[src].desc_x = desc_x;
                                }
                            }
                        }

                        if (el.media) {
                            sources[src].media = el.media;
                            if (el.media.match(/min-width: *([0-9]+)/)) {
                                picture_minw = true;
                                var minWidth = getUnit(el.media.replace(/.*min-width: *([0-9.a-z]+).*/, "$1"));
                                if (!sources[src].minWidth || sources[src].minWidth > minWidth)
                                    sources[src].minWidth = minWidth;
                            }

                            if (el.media.match(/max-width: *([0-9]+)/)) {
                                picture_maxw = true;
                                var maxWidth = getUnit(el.media.replace(/.*max-width: *([0-9.a-z]+).*/, "$1"));
                                if (!sources[src].maxWidth || sources[src].maxWidth > maxWidth)
                                    sources[src].maxWidth = maxWidth;
                            }

                            if (el.media.match(/min-height: *([0-9]+)/)) {
                                picture_minh = true;
                                var minHeight = getUnit(el.media.replace(/.*min-height: *([0-9.a-z]+).*/, "$1"));
                                if (!sources[src].minHeight || sources[src].minHeight > minHeight)
                                    sources[src].minHeight = minHeight;
                            }

                            if (el.media.match(/max-height: *([0-9]+)/)) {
                                picture_maxh = true;
                                var maxHeight = getUnit(el.media.replace(/.*max-height: *([0-9.a-z]+).*/, "$1"));
                                if (!sources[src].maxHeight || sources[src].maxHeight > maxHeight)
                                    sources[src].maxHeight = maxHeight;
                            }
                        }
                    }
                }

                var style = window.getComputedStyle(el);
                if (style.backgroundImage) {
                    var bgimg = style.backgroundImage;
                    if (bgimg.match(/^ *url[(]/)) {
                        var src = norm(bgimg.replace(/^ *url[(]["']?(.*?)["']?[)] *$/, "$1"));
                        addImage(src, el);
                    }
                }
            }

            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                addElement(el);
            }

            //console.log(sources);

            if ((source = getsource()) !== undefined)
                return source;

            for (var source_url in sources) {
                var source = sources[source_url];

                if (source.width && source.width > minW)
                    minW = source.width;
                if (source.height && source.height > minH)
                    minH = source.height;

                if (source.minWidth && source.minWidth > minMinW)
                    minMinW = source.minWidth;
                if (source.minHeight && source.minHeight > minMinH)
                    minMinH = source.minHeight;

                if (source.maxWidth && source.maxWidth > minMaxW)
                    minMaxW = source.maxWidth;
                if (source.maxHeight && source.maxHeight > minMaxH)
                    minMaxH = source.maxHeight;

                if (source.desc_x && source.desc_x > minX)
                    minX = source.desc_x;
            }

            var newsources = {};

            /*console.log(minW);
              console.log(minH);
              console.log(minMinW);
              console.log(minMinH);
              console.log(minMaxW);
              console.log(minMaxH);
              console.log(minX);*/

            if (minW !== 0 ||
                minH !== 0 ||
                minMinW !== 0 ||
                minMinH !== 0 ||
                minMaxW !== 0 ||
                minMaxH !== 0 ||
                minX !== 0) {
                for (var source_url in sources) {
                    var source = sources[source_url];

                    if ((source.width && source.width >= minW) || (source.height && source.height >= minH))
                        newsources[source_url] = source;

                    if ((source.minWidth && source.minWidth >= minMinW) || (source.minHeight && source.minHeight >= minMinH))
                        newsources[source_url] = source;

                    if ((source.maxWidth && source.maxWidth >= minMaxW) || (source.maxHeight && source.maxHeight >= minMaxH))
                        newsources[source_url] = source;

                    if (source.desc_x && source.desc_x >= minX)
                        newsources[source_url] = source;
                }

                //console.log(newsources);

                sources = newsources;
                newsources = {};

                if ((source = getsource()) !== undefined)
                    return source;

                for (var source_url in sources) {
                    var source = sources[source_url];

                    if (!source.picture) {
                        newsources[source_url] = source;
                        continue;
                    }

                    if (picture_minw && (!source.minWidth || source.minWidth < minMinW))
                        continue;

                    if (picture_minh && (!source.minHeight || source.minHeight < minMinW))
                        continue;

                    if (picture_maxw && (!source.maxWidth || source.maxWidth < minMaxW))
                        continue;

                    if (picture_maxh && (!source.maxHeight || source.maxHeight < minMaxW))
                        continue;

                    if (source.desc_x && source.desc_x < minX)
                        continue;

                    newsources[source_url] = source;
                }

                //console.log(newsources);

                sources = newsources;
                newsources = {};

                if ((source = getsource()) !== undefined)
                    return source;
            }

            for (var source_url in sources) {
                var source = sources[source_url];

                if (source_url.match(/^data:/))
                    continue;

                newsources[source_url] = source;
            }

            var orig_sources = sources;
            sources = newsources;
            newsources = {};

            //console.log(sources);

            if (source = getsource())
                return source;
            else if (source === null)
                return getfirstsource(orig_sources);


            for (var source_url in sources) {
                var source = sources[source_url];

                var source_url_imu = bigimage_recursive(source_url, {
                    fill_object: false,
                    do_request: null
                });
                if (source_url_imu !== source_url)
                    newsources[source_url] = source;
            }

            var orig_sources = sources;
            sources = newsources;

            //console.log(sources);

            if (source = getsource())
                return source;
            else if (source === null)
                return getfirstsource(orig_sources);
            else
                return getfirstsource(sources);
        }

        document.addEventListener('keydown', function(event) {
            if (event.which === keycode) {
                controlPressed = true;
                var els = document.elementsFromPoint(mouseX, mouseY);

                var source = find_source(els);
                if (source) {
                    console.log(source);
                    start_waiting();
                    bigimage_recursive(source.src, {
                        fill_object: true,
                        host_url: document.location.href,
                        document: document,
                        window: unsafeWindow,
                        element: source.el,
                        cb: function(source_imu) {
                            console.log(source_imu);
                            makePopup(source_imu);
                        }
                    });
                }
            }
        });

        document.addEventListener('keyup', function(event) {
            if (event.which === keycode) {
                controlPressed = false;
                stop_waiting();

                resetpopups();
            }
        });

        function scrollLeft() {
            var doc = document.documentElement;
            var body = document.body;
            return (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                (doc && doc.clientLeft || body && body.clientLeft || 0);
        }

        function scrollTop() {
            var doc = document.documentElement;
            var body = document.body;
            return (doc && doc.scrollTop || body && body.scrollTop || 0) -
                (doc && doc.clientTop || body && body.clientTop || 0);
        }

        document.addEventListener('mousemove', function(event) {
            // https://stackoverflow.com/a/7790764
            event = event || window.event;

            if (event.pageX === null && event.clientX !== null) {
                eventDoc = (event.target && event.target.ownerDocument) || document;
                doc = eventDoc.documentElement;
                body = eventDoc.body;

                event.pageX = event.clientX + scrollLeft();
                event.pageY = event.clientY + scrollTop();
            }

            mouseX = event.clientX;
            mouseY = event.clientY;

            mouseAbsX = event.pageX;
            mouseAbsY = event.pageY;

            if (waiting) {
                update_waiting();
            }
        });
    }

    function start() {
        do_export();

        if (is_userscript) {
            if (settings.redirect)
                do_redirect();

            if (document.location.href.match(/^https?:\/\/qsniyg\.github\.io\/maxurl\/options\.html/)) {
                onload(function() {
                    do_options();
                });
            }

            if (settings.mouseover)
                do_mouseover();
        }
    }

    do_config();
})();
