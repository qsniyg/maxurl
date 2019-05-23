// ==UserScript==
// @name         Image Max URL
// @namespace    http://tampermonkey.net/
// @version      0.9.0
// @description  Finds larger or original versions of images for 4200+ websites
// @author       qsniyg
// @homepageURL  https://qsniyg.github.io/maxurl/options.html
// @supportURL   https://github.com/qsniyg/maxurl/issues
// @icon         https://raw.githubusercontent.com/qsniyg/maxurl/master/resources/logo.png
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
//   or used to query various websites' API to get larger images.
// Search for do_request_raw if you want to see what the code does exactly.

// Due to Greasyfork's 2MB limit, all comments within bigimage() had to be removed
// You can view the original source code here: https://github.com/qsniyg/maxurl/blob/master/userscript.user.js



var $$IMU_EXPORT$$;

(function() {
    'use strict';

    var _nir_debug_ = false;

    if (_nir_debug_) {
        _nir_debug_ = {
            no_request: false
        };
    }

    var is_extension = false;
    var is_webextension = false;
    var extension_send_message = null;
    var extension_options_page = null;
    var is_extension_options_page = false;
    var is_options_page = false;
    var options_page = "https://qsniyg.github.io/maxurl/options.html";

    try {
        if (document.location.href.match(/^https?:\/\/qsniyg\.github\.io\/maxurl\/options\.html/) ||
            document.location.href.match(/^file:\/\/.*\/maxurl\/site\/options\.html/)) {
            is_options_page = true;
        }
    } catch(e) {
    }

    try {
        var extension_manifest = chrome.runtime.getManifest();
        is_extension = extension_manifest.name === "Image Max URL";

        extension_options_page = chrome.runtime.getURL("extension/options.html");
        is_extension_options_page = document.location.href.replace(/[?#].*$/, "") === extension_options_page;
        is_options_page = is_options_page || is_extension_options_page;
        //options_page = extension_options_page; // can't load from website

        if (is_extension) {
            extension_send_message = function(message, respond) {
                message = deepcopy(message, {json:true});
                return chrome.runtime.sendMessage(null, message, null, respond);
            };
        }
    } catch (e) {
    }

    var is_node = false;
    if ((typeof module !== 'undefined' && module.exports) &&
        typeof window === 'undefined' && typeof document === 'undefined') {
        is_node = true;
    }

    var is_scripttag = false;
    if (typeof imu_variable !== 'undefined' && (typeof(GM_xmlhttpRequest) === 'undefined' &&
                                                typeof(GM) === 'undefined'))
        is_scripttag = true;

    var is_userscript = false;
    if (!is_node && !is_scripttag && !is_extension)
        is_userscript = true;

    var do_request_raw = null;
    if (is_extension) {
        do_request_raw = function(data) {
            var onload = data.onload;
            var onerror = data.onerror;

            extension_send_message({
                type: "request",
                data: data
            }, function (response) {
                if (response.data.responseType === "blob") {
                    var enc = response.data._responseEncoded;

                    if (enc) {
                        var array = new Uint8Array(enc.value.length);
                        for (var i = 0; i < enc.value.length; i++) {
                            array[i] = enc.value.charCodeAt(i);
                        }
                        response.data.response = new Blob([array.buffer], { type: enc.type });
                    } else {
                        response.data.response = null;
                    }
                }

                if (response.type === "onload") {
                    onload(response.data);
                } else if (response.type === "onerror" && onerror) {
                    onerror(response.data);
                }
            });
        };
    } else if (typeof(GM_xmlhttpRequest) !== "undefined") {
        do_request_raw = GM_xmlhttpRequest;
    } else if (typeof(GM) !== "undefined" && typeof(GM.xmlHttpRequest) !== "undefined") {
        do_request_raw = GM.xmlHttpRequest;
    }

    var do_request = null;
    if (do_request_raw) {
        do_request = function(data) {
            if (!data.onerror)
                data.onerror = data.onload;

            return do_request_raw(data);
        };
    }

    var default_options = {
        fill_object: true,
        null_if_no_change: false,
        use_cache: true,
        iterations: 200,
        exclude_problems: [
            "watermark",
            "smaller",
            "possibly_different"
        ],
        include_pastobjs: true,
        force_page: false,
        fake: false,

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
        likely_broken: false,
        can_head: true,
        head_ok_errors: [],
        head_wrong_contenttype: false,
        head_wrong_contentlength: false,
        waiting: false,
        redirects: false,
        forces_download: false,
        is_private: false,
        is_original: false,
        norecurse: false,
        bad: false,
        headers: {},
        extra: {},
        problems: {
            watermark: false,
            smaller: false
        }
    };

    //var options_page = "https://qsniyg.github.io/maxurl/options.html";

    // restore console.log for websites that remove it (twitter)
    // https://gist.github.com/Ivanca/4586071
    //var console_log = function(){ return window.console.__proto__.log.apply(console, arguments) } ;
    //var console_error = function(){ return window.console.__proto__.error.apply(console, arguments) } ;

    // since the userscript is run first, this generally shouldn't be a problem
    var console_log = console.log;
    var console_error = console.error;
    var console_trace = console.trace;
    var JSON_stringify = JSON.stringify;
    var JSON_parse = JSON.parse;

    function deepcopy(x, options) {
        if (!options)
            options = {};
        if (!options.history)
            options.history = [];

        if (typeof x === "object") {
            if (options.history.indexOf(x) >= 0)
                return;
            else
                options.history.push(x);
        }

        var result;

        if (typeof x === "string") {
            return x;
        } else if ((typeof Element !== "undefined" && x instanceof Element) ||
                   (x && typeof x === "object" && (("namespaceURI" in x) && ("ariaSort" in x)))) {
            if (options.json) {
                return undefined;
            } else {
                return x;
            }
        } else if (typeof x === "function") {
            if (options.json) {
                return undefined;
            } else {
                return x;
            }
        } else if (x instanceof Array) {
            result = [];
            for (var i = 0; i < x.length; i++) {
                var item = x[i];
                result.push(deepcopy(item, options));
            }
            return result;
        } else if (typeof x === "object") {
            result = {};
            for (var key in x) {
                result[key] = deepcopy(x[key], options);
            }
            return result;
        } else {
            return x;
        }
    }


    var settings = {
        redirect: true,
        redirect_history: true,
        mouseover: true,
        // thanks to blue-lightning on github for the idea
        mouseover_open_behavior: "popup",
        //mouseover_trigger: ["ctrl", "shift"],
        mouseover_trigger_behavior: "keyboard",
        // thanks to 894-572 on github for the idea
        mouseover_trigger_key: ["shift", "alt", "i"],
        mouseover_trigger_delay: 1,
        mouseover_ui: true,
        mouseover_ui_opacity: 30,
        mouseover_ui_gallerycounter: true,
        mouseover_ui_gallerymax: 50,
        mouseover_ui_optionsbtn: is_userscript ? true : false,
        // also thanks to blue-lightning
        mouseover_close_behavior: "esc",
        mouseover_zoom_behavior: "fit",
        mouseover_pan_behavior: "drag",
        mouseover_scroll_behavior: "zoom",
        scroll_zoom_behavior: "fitfull",
        // thanks to 07416 on github for the idea
        mouseover_position: "cursor",
        // also thanks to 07416
        mouseover_links: false,
        // thanks to acid-crash on github for the idea
        mouseover_styles: "",
        website_image: true,
        extension_contextmenu: true,
        allow_watermark: false,
        allow_smaller: false,
        allow_possibly_different: false
    };
    var orig_settings = deepcopy(settings);

    var settings_meta = {
        redirect: {
            name: "Enable redirection",
            description: "Redirect images opened in their own tab",
            category: "redirection"
        },
        redirect_history: {
            name: "Add to history",
            description: "Redirection will add a new entry to the browser's history",
            requires: {
                redirect: true
            },
            category: "redirection"
        },
        mouseover: {
            name: "Enable mouseover popup",
            description: "Show a popup with the larger image when you mouseover an image with the trigger key held",
            category: "popup"
        },
        mouseover_open_behavior: {
            name: "Mouseover popup action",
            description: "Determines how the mouseover popup will open",
            extension_only: true,
            options: {
                _type: "or",
                popup: {
                    name: "Popup"
                },
                newtab: {
                    name: "New tab"
                }
            },
            requires: {
                mouseover: true
            },
            category: "popup"
        },
        mouseover_trigger: {
            name: "Popup trigger",
            description: "Trigger key that, when held, will show the popup",
            options: {
                _type: "and",
                _group1: {
                    _type: "and",
                    ctrl: {
                        name: "Ctrl"
                    },
                    shift: {
                        name: "Shift"
                    },
                    alt: {
                        name: "Alt"
                    }
                },
                _group2: {
                    _type: "or",
                    delay_1: {
                        name: "Delay 1s"
                    },
                    delay_3: {
                        name: "Delay 3s"
                    }
                }
            },
            requires: {
                mouseover: true
            },
            category: "popup"
        },
        mouseover_trigger_behavior: {
            name: "Mouseover popup trigger",
            description: "How the popup will get triggered",
            options: {
                mouse: {
                    name: "Mouseover",
                    description: "Triggers when your mouse is over the image"
                },
                keyboard: {
                    name: "Key trigger",
                    description: "Triggers when you press a key sequence when your mouse is over an image"
                }
            },
            requires: {
                mouseover: true
            },
            category: "popup"
        },
        mouseover_trigger_key: {
            name: "Popup trigger key",
            description: "Key sequence to trigger the popup",
            type: "keysequence",
            requires: {
                mouseover: true,
                mouseover_trigger_behavior: "keyboard"
            },
            category: "popup"
        },
        mouseover_trigger_delay: {
            name: "Popup trigger delay",
            description: "Delay (in seconds) before the popup shows",
            requires: {
                mouseover: true,
                mouseover_trigger_behavior: "mouse"
            },
            type: "number",
            number_unit: "seconds",
            category: "popup"
        },
        mouseover_ui: {
            name: "Popup UI",
            description: "Enables a UI on top of the popup",
            requires: {
                mouseover_open_behavior: "popup"
            },
            category: "popup"
        },
        mouseover_ui_opacity: {
            name: "Popup UI opacity",
            description: "Opacity of the UI on top of the popup",
            requires: {
                mouseover_ui: true
            },
            type: "number",
            number_unit: "%",
            number_max: 100,
            number_min: 0,
            number_int: true,
            category: "popup"
        },
        mouseover_ui_gallerycounter: {
            name: "Popup UI gallery counter",
            description: "Enables a gallery counter on top of the UI",
            requires: {
                mouseover_ui: true
            },
            category: "popup"
        },
        mouseover_ui_gallerymax: {
            name: "Gallery counter max",
            description: "Maximum amount of images to check in the counter",
            requires: {
                mouseover_ui_gallerycounter: true
            },
            type: "number",
            number_unit: "images",
            category: "popup"
        },
        mouseover_ui_optionsbtn: {
            name: "Popop UI Options Button",
            description: "Enables a button to go to the options screen for IMU",
            requires: {
                mouseover_ui: true
            },
            // While it works for the extension, it's more or less useless
            userscript_only: true,
            category: "popup"
        },
        mouseover_close_behavior: {
            name: "Keep popup open until",
            description: "Closes the popup when the selected condition is met",
            options: {
                _type: "or",
                _group1: {
                    any: {
                        name: "Any trigger is released"
                    }
                },
                _group2: {
                    all: {
                        name: "All triggers are released"
                    }
                },
                _group3: {
                    esc: {
                        name: "ESC/Close is pressed"
                    }
                }
            },
            requires: {
                mouseover_open_behavior: "popup"
            },
            category: "popup"
        },
        mouseover_zoom_behavior: {
            name: "Popup default zoom",
            description: "How the popup should be initially sized",
            options: {
                _type: "or",
                _group1: {
                    fit: {
                        name: "Fit to screen"
                    }
                },
                _group2: {
                    full: {
                        name: "Full size"
                    }
                }
            },
            requires: {
                mouseover_open_behavior: "popup"
            },
            category: "popup"
        },
        mouseover_pan_behavior: {
            name: "Popup panning method",
            description: "How the popup should be panned when larger than the screen",
            options: {
                _type: "or",
                movement: {
                    name: "Movement",
                    description: "The popup pans as you move your mouse"
                },
                drag: {
                    name: "Drag",
                    description: "Clicking and dragging pans the popup"
                }
            },
            requires: {
                mouseover_open_behavior: "popup"
            },
            category: "popup"
        },
        mouseover_scroll_behavior: {
            name: "Popup scroll action",
            description: "How the popup reacts to a scroll/mouse wheel event",
            options: {
                _type: "or",
                zoom: {
                    name: "Zoom"
                },
                pan: {
                    name: "Pan"
                },
                nothing: {
                    name: "None"
                }
            },
            requires: {
                mouseover_open_behavior: "popup"
            },
            category: "popup"
        },
        scroll_zoom_behavior: {
            name: "Zoom behavior",
            description: "How zooming should work",
            options: {
                _type: "or",
                fitfull: {
                    name: "Fit/Full",
                    description: "Toggles between the full size, and fit-to-screen"
                },
                incremental: {
                    name: "Incremental"
                }
            },
            requires: {
                mouseover_scroll_behavior: "zoom"
            },
            category: "popup"
        },
        mouseover_position: {
            name: "Popup position",
            description: "Where the popup will appear",
            options: {
                _type: "or",
                cursor: {
                    name: "Mouse cursor",
                    description: "Underneath the mouse cursor"
                },
                center: {
                    name: "Page middle"
                }
            },
            requires: {
                mouseover_open_behavior: "popup"
            },
            category: "popup"
        },
        mouseover_links: {
            name: "Popup for plain hyperlinks",
            description: "Whether or not the popup should also open for plain hyperlinks",
            requires: {
                mouseover: true
            },
            category: "popup"
        },
        mouseover_styles: {
            name: "Popup CSS style",
            description: "CSS style rules for the mouseover popup",
            type: "textarea",
            requires: {
                mouseover_open_behavior: "popup"
            },
            category: "popup"
        },
        website_image: {
            name: "Website image preview",
            description: "Enables a preview of the image on the Image Max URL website",
            userscript_only: true,
            category: "website"
        },
        extension_contextmenu: {
            name: "IMU entry in context menu",
            description: "Enables a custom entry for this extension in the right click/context menu",
            extension_only: true,
            category: "extension"
        },
        allow_watermark: {
            name: "Larger watermarked images",
            description: "Enables rules that return larger images that include watermarks",
            category: "rules"
        },
        allow_smaller: {
            name: "Smaller non-watermarked images",
            description: "Enables rules that return smaller images without watermarks",
            category: "rules"
        },
        allow_possibly_different: {
            name: "Possibly different images",
            description: "Enables rules that return images that possibly differ (such as YouTube)",
            category: "rules"
        }
    };

    var option_to_problems = {
        allow_watermark: "watermark",
        allow_smaller: "smaller",
        allow_possibly_different: "possibly_different"
    };

    var categories = {
        "redirection": "Redirection",
        "popup": "Popup",
        "rules": "Rules",
        "website": "Website",
        "extension": "Extension"
    };


    var url_cache = {};


    var urlparse = function(x) {
        return new URL(x);
    };

    if (is_node && typeof URL === 'undefined') {
        var url = require("url");
        urlparse = function(x) {
            var parsed = url.parse(x);
            parsed.searchParams = new Map();
            if (parsed.query) {
                parsed.query.split("&").forEach(function (query) {
                    var splitted = query.split("=");
                    parsed.searchParams.set(splitted[0], splitted[1]);
                });
            }
            return parsed;
        };
    }

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
            protocol: protocol,
            domain: domain,
            url: a
        };
    }

    function urljoin(a, b, browser) {
        if (b.length === 0)
            return a;
        if (b.match(/^[a-z]*:\/\//) || b.match(/^data:/))
            return b;

        var protocol_split = a.split("://");
        var protocol = protocol_split[0];
        var splitted = protocol_split[1].split("/");
        var domain = splitted[0];
        var start = protocol + "://" + domain;

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
                //return a.replace(/\/[^/]*$/, "/") + b.replace(/^\/*/, "");
                return a.replace(/^([^?]*)\/.*?$/, "$1/") + b.replace(/^\/*/, "");
        }
    }

    var fullurl = function(url, x) {
        if (x === undefined || x === null)
            return x;

        var a = document.createElement(a);
        a.href = x;
        return a.href;
    };

    var fillobj_urls = function(urls, obj) {
        var newobj = [];
        for (var i = 0; i < urls.length; i++) {
            var currentobj = deepcopy(obj);
            currentobj.url = urls[i];
            newobj.push(currentobj);
        }

        return newobj;
    };

    var add_full_extensions = function(obj, extensions) {
        if (!extensions)
            extensions = [
                "jpg", "jpeg", "png", "gif", "webp",
                "JPG", "JPEG", "PNG", "GIF"
            ];

        if (!(obj instanceof Array)) {
            obj = [obj];
        }

        var result = [];

        for (var i = 0; i < obj.length; i++) {
            var currentobj = obj[i];
            var url = currentobj;
            if (typeof currentobj !== "string") {
                url = currentobj.url;
            }

            var regex = /(.*)\.([^/.]*)([?#].*)?$/;
            if (!url.match(regex)) {
                result.push(currentobj);
                continue;
            }

            var ext = url.replace(regex, "$2");
            var basename = url.replace(regex, "$1");
            var query = url.replace(regex, "$3");

            //var result = [url];
            result.push(currentobj);

            for (var i = 0; i < extensions.length; i++) {
                if (ext === extensions[i])
                    continue;

                var currenturl = basename + "." + extensions[i] + query;
                if (typeof currentobj === "string") {
                    result.push(currenturl);
                } else {
                    var newobj = deepcopy(currentobj);
                    newobj.url = currenturl;
                    result.push(newobj);
                }
            }
        }

        return result;
    };

    var add_extensions = function(url) {
        return add_full_extensions(url, ["jpg", "png"]);

        if (url.match(/\.jpg(?:\?.*)?$/)) {
            return [url, url.replace(/\.jpg(\?.*)?$/, ".png$1")];
        } else {
            return [url, url.replace(/\.png(\?.*)?$/, ".jpg$1")];
        }
    };

    var add_extensions_jpeg = function(url) {
        return add_full_extensions(url, ["jpeg", "png"]);

        if (url.match(/\.jpeg(?:\?.*)?$/)) {
            return [url, url.replace(/\.jpeg(\?.*)?$/, ".png$1")];
        } else {
            return [url, url.replace(/\.png(\?.*)?$/, ".jpeg$1")];
        }
    };

    var add_extensions_with_jpeg = function(url) {
        return add_full_extensions(url, ["jpg", "jpeg", "png"]);

        if (url.match(/\.jpg(?:\?.*)?$/)) {
            return [url, url.replace(/\.jpg(\?.*)?$/, ".png$1"), url.replace(/\.jpg(\?.*)?$/, ".jpeg$1")];
        } else if (url.match(/\.jpeg(?:\?.*)?$/)) {
            return [url, url.replace(/\.jpeg(\?.*)?$/, ".png$1"), url.replace(/\.jpeg(\?.*)?$/, ".jpg$1")];
        } else {
            return [url, url.replace(/\.png(\?.*)?$/, ".jpg$1"), url.replace(/\.png(\?.*)?$/, ".jpeg$1")];
        }
    };

    var add_extensions_gif = function(url) {
        return add_full_extensions(url, ["jpg", "png", "gif"]);

        if (url.match(/\.jpg(?:\?.*)?$/)) {
            return [url, url.replace(/\.jpg(\?.*)?$/, ".png$1"), url.replace(/\.jpg(\?.*)?$/, ".gif$1")];
        } else if (url.match(/\.png(?:\?.*)?$/)) {
            return [url, url.replace(/\.png(\?.*)?$/, ".jpg$1"), url.replace(/\.png(\?.*)?$/, ".gif$1")];
        } else if (url.match(/\.gif(?:\?.*)?$/)) {
            return [url, url.replace(/\.gif(\?.*)?$/, ".jpg$1"), url.replace(/\.gif(\?.*)?$/, ".png$1")];
        }
    };

    var add_extensions_upper = function(url) {
        return add_full_extensions(url, ["jpg", "png", "JPG", "PNG"]);

        if (url.toLowerCase().match(/\.jpg(?:\?.*)?$/)) {
            if (url.match(/\.jpg(?:\?.*)?$/)) {
                return [url, url.replace(/\.jpg(\?.*)?$/, ".JPG$1"), url.replace(/\.jpg(\?.*)?$/, ".png$1"), url.replace(/\.jpg(\?.*)?$/, ".PNG$1")];
            } else {
                return [url, url.replace(/\.JPG(\?.*)?$/, ".jpg$1"), url.replace(/\.JPG(\?.*)?$/, ".png$1"), url.replace(/\.JPG(\?.*)?$/, ".PNG$1")];
            }
        } else {
            if (url.match(/\.png(?:\?.*)?$/)) {
                return [url, url.replace(/\.png(\?.*)?$/, ".PNG$1"), url.replace(/\.png(\?.*)?$/, ".jpg$1"), url.replace(/\.png(\?.*)?$/, ".JPG$1")];
            } else {
                return [url, url.replace(/\.PNG(\?.*)?$/, ".png$1"), url.replace(/\.PNG(\?.*)?$/, ".jpg$1"), url.replace(/\.PNG(\?.*)?$/, ".JPG$1")];
            }
        }
    };

    var add_extensions_upper_jpeg = function(url) {
        return add_full_extensions(url, ["jpg", "jpeg", "png", "JPG", "JPEG", "PNG"]);

        if (url.toLowerCase().match(/\.jpg(?:\?.*)?$/)) {
            if (url.match(/\.jpg(?:\?.*)?$/)) {
                return [url, url.replace(/\.jpg(\?.*)?$/, ".jpeg$1"), url.replace(/\.jpg(\?.*)?$/, ".JPEG$1"), url.replace(/\.jpg(\?.*)?$/, ".JPG$1"), url.replace(/\.jpg(\?.*)?$/, ".png$1"), url.replace(/\.jpg(\?.*)?$/, ".PNG$1")];
            } else {
                return [url, url.replace(/\.JPG(\?.*)?$/, ".jpg$1"), url.replace(/\.JPG(\?.*)?$/, ".png$1"), url.replace(/\.JPG(\?.*)?$/, ".PNG$1")];
            }
        } else {
            if (url.match(/\.png(?:\?.*)?$/)) {
                return [url, url.replace(/\.png(\?.*)?$/, ".PNG$1"), url.replace(/\.png(\?.*)?$/, ".jpg$1"), url.replace(/\.png(\?.*)?$/, ".JPG$1")];
            } else {
                return [url, url.replace(/\.PNG(\?.*)?$/, ".png$1"), url.replace(/\.PNG(\?.*)?$/, ".jpg$1"), url.replace(/\.PNG(\?.*)?$/, ".JPG$1")];
            }
        }
    };

    var add_http = function(url) {
        if (!url.match(/^[a-z]+:\/\//))
            return "http://" + url;
        return url;
    };

    var decodeuri_ifneeded = function(url) {
        if (url.match(/^https?:\/\//))
            return url;
        if (url.match(/^https?%3[aA]/))
            return decodeURIComponent(url);
        if (url.match(/^https?%253[aA]/))
            return decodeURIComponent(decodeURIComponent(url));
        return url;
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

        // to prevent infinite loops
        if (src.length >= 65535)
            return src;

        if (!src.match(/^https?:\/\//))
            return src;

        var origsrc = src;

        var url = urlparse(src);

        var protocol;
        var domain;
        var port;

        if (!src.match(/^data:/)) {
            var protocol_split = src.split("://");
            protocol = protocol_split[0];
            var splitted = protocol_split[1].split("/");
            domain = splitted[0];

            port = domain.replace(/.*:([0-9]+)$/, "$1");
            if (port === domain)
                port = "";
            domain = domain.replace(/(.*):[0-9]+$/, "$1");
        } else {
            protocol = "data";
            domain = "";
        }

        var domain_nowww = domain.replace(/^www\./, "");
        var domain_nosub = domain.replace(/^.*\.([^.]*\.[^.]*)$/, "$1");
        if (domain_nosub.match(/^co\.[a-z]{2}$/) ||
            domain_nosub.match(/^ne\.jp$/) || // stream.ne.jp
            domain_nosub.match(/^or\.jp$/) ||
            domain_nosub.match(/^com\.[a-z]{2}$/) ||
            domain_nosub.match(/^org\.[a-z]{2}$/) ||
            domain_nosub.match(/^net\.[a-z]{2}$/)) {
            domain_nosub = domain.replace(/^.*\.([^.]*\.[^.]*\.[^.]*)$/, "$1");
        }

        var amazon_container = null;
        if (domain.indexOf(".amazonaws.com") >= 0) {
            // https://timely-api-public.s3.us-west-2.amazonaws.com/116743_phpg7Ixww_small.JPG
            // https://pixls-discuss.s3.dualstack.us-east-1.amazonaws.com/optimized/3X/0/5/0530ef1424b7bace746cd10d2bc26b5cd58d5e27_2_690x388.png
            if (domain.match(/^s3(?:\.dualstack)?(?:[-.][-a-z0-9]+)?\.amazonaws\.com/))
                amazon_container = src.replace(/^[a-z]*:\/\/[^/]*\/([^/]*)\/.*/, "$1");
            else if (domain.match(/[^/]*\.s3(?:\.dualstack)?(?:[-.][-a-z0-9]+)?\.amazonaws\.com/))
                amazon_container = src.replace(/^[a-z]*:\/\/([^/]*)\.s3(?:\.dualstack)?(?:[-.][-a-z0-9]+)?\.amazonaws\.com\/.*/, "$1");
        }

        var googleapis_container = null;
        if (domain.indexOf(".googleapis.com") >= 0) {
            googleapis_container = src.replace(/^[a-z]*:\/\/[^/]*\/([^/]*)\/.*/, "$1");
        }

        var googlestorage_container = null;
        if (domain_nosub === "googleapis.com" &&
            (domain === "storage.googleapis.com" ||
             domain.match(/\.storage\.googleapis\.com$/) ||
             domain === "commondatastorage.googleapis.com" ||
             domain.match(/\.commondatastorage\.googleapis\.com$/))) {
            if (domain.match(/\.[a-z]+\.googleapis\.com$/)) {
                googlestorage_container = src.replace(/^[a-z]*:\/\/([^/]*)\.[a-z]+\.googleapis\.com\/.*/, "$1");
            } else {
                googlestorage_container = src.replace(/^[a-z]*:\/\/[^/]*\/([^/]*)\/.*/, "$1");
            }
        }

        var host_domain = "";
        var host_domain_nowww = "";
        var host_domain_nosub = "";
        if (options.host_url) {
            host_domain = options.host_url.replace(/^[a-z]+:\/\/([^/]*)(?:\/.*)?$/,"$1");

            host_domain_nowww = host_domain.replace(/^www\./, "");
            host_domain_nosub = host_domain.replace(/^.*\.([^.]*\.[^.]*)$/, "$1");
            if (host_domain_nosub.match(/^co\.[a-z]{2}$/)) {
                host_domain_nosub = host_domain.replace(/^.*\.([^.]*\.[^.]*\.[^.]*)$/, "$1");
            }
        }

        var newsrc, i, id, size, origsize, regex, match;

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
                    console_log(urlparts);
                }
            }
        }

        // -- start bigimage --

        /*if (domain.indexOf("img.tenasia.hankyung.com") >= 0 && false) {
            return src.replace(/-[0-9]+x[0-9]+\.([^/.]*)$/, ".$1");
            }*/

        if (domain === "img.hankyung.com" ||
            domain === "img.tenasia.hankyung.com") {
            if (src.match(/\.[0-9](\.[^/.]*)(?:[?#].*)?$/)) {
                newsrc = src.replace(/[?#].*$/, "");
                if (newsrc !== src)
                    return newsrc;

                return [
                    src.replace(/\.[0-9](\.[^/.]*)$/, ".4$1"),
                    src.replace(/\.[0-9](\.[^/.]*)$/, ".1$1")
                ];
            }
        }

        if (domain_nosub === "naver.net" ||
            domain_nosub === "pstatic.net") {
            if (domain.indexOf("gfmarket.") >= 0) {
                return src;
            }

            if (domain.match(/tv[0-9]*\.search\.naver\.net/) ||
                domain.match(/tv[0-9]*\.pstatic\.net/)) {
                return src.replace(/.*\/thm\?.*?q=/, "");
            }

            if (src.match(/[?&]src=/)) {
                return decodeURIComponent(src.replace(/.*src=*([^&]*).*/, "$1")).replace(/^"*/, '').replace(/"$/, '');
            }






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



            return src
                .replace(/postfiles[^/.]*\./, "blogfiles.")
                .replace(/m?blogthumb[^./]*/, "blogfiles")
                .replace(/blogfiles[^/.]*\./, "blogfiles.")
                .replace(/postfiles[^/.]*\./, "blogfiles.")

                .replace(/cafeptthumb[^./]*/, "cafefiles")

                .replace(/cafeskthumb[^./]*/, "cafefiles")
                .replace(/m?cafethumb[^./]*/, "cafefiles")
                .replace(/cafefiles[^/.]*\./, "cafefiles.")

                .replace(/mimgnews[^./]*/, "imgnews")

                .replace(/post\.phinf\./, "post-phinf.")
                .replace(/v\.phinf\./, "v-phinf.")
                .replace(/musicmeta\.phinf\./, "musicmeta-phinf.")
                .replace(/shopping\.phinf\./, "shopping-phinf.")
                .replace(/blogpfthumb\.phinf\./, "blogpfthumb-phinf.")

                .replace(/\.phinf\./, ".")
                .replace(".naver.net/", ".pstatic.net/");
        }

        if ((domain_nosub === "daumcdn.net" ||
             domain_nosub === "kakaocdn.net") &&
            src.indexOf("/thumb/") >= 0) {
            return decodeURIComponent(src.replace(/.*fname=([^&]*).*/, "$1"));
        }

        /*if (false && (src.indexOf("daumcdn.net/argon/") >= 0 ||
                      src.indexOf(".kakaocdn.net/argon/") >= 0)) {
        }*/

        if ((domain_nosub === "tistory.com" ||
              domain_nosub === "daum.net") &&
             (domain.match(/\.uf\.[a-z]+\.[a-z]+$/) ||
              domain.match(/^cfs[0-9]*\./))) {
            return src
                .replace("/attach/", "/original/")
                .replace("/media/" , "/original/")
                .replace("/image/", "/original/")
                .replace(/\/[RTC][0-9]*x[0-9]*\//, "/original/");
        }

        if (domain_nosub === "daumcdn.net" &&
            domain.match(/^t[0-9]*\.daumcdn\.net/)) {
            return src.replace(/(\/cfile\/(?:tistory\/)?[0-9A-F]+)(?:\\?.*)$/, "$1?original");
        }

        if (domain_nosub === "daumcdn.net" &&
            domain.match(/^i[0-9]*\.media\./)) {
            return src.replace(/\/uf\/image\//, "/uf/original/");
        }

        if (domain_nosub === "daumcdn.net" &&
            domain.match(/^[mi][0-9]*\.daumcdn\.net/)) {
            return src.replace(/:\/\/[^/]*\/(cfile[0-9]+)\//, "://$1.uf.daum.net/");
        }

        if (domain === "image.news1.kr") {
            return src
                .replace(/\/thumbnails\/(.*)\/thumb_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "/$1/original$2")
                .replace(/main_thumb\.jpg/, "original.jpg")
                .replace(/article.jpg/, "original.jpg")
                .replace(/no_water.jpg/, "original.jpg")
                .replace(/photo_sub_thumb.jpg/, "original.jpg")
                .replace(/section_top\.jpg/, "original.jpg")
                .replace(/high\.jpg/, "original.jpg");
        }

        if (domain.indexOf(".joins.com") >= 0) {
            newsrc = src.replace(/\.tn_[0-9]*\..*/, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "ir.joins.com") {
            return decodeURIComponent(src.replace(/.*\/\?.*?u=([^&]*).*$/, "$1"));
        }

        if (domain_nosub === "koreadaily.com" &&
            domain.match(/^thumb[0-9]*\./)) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/tn\.dll.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "uhd.img.topstarnews.net") {
            return src
                .replace("/file_attach_thumb/", "/file_attach/")
                .replace(/_[^/]*[0-9]*x[0-9]*_[^/]*(\.[^/]*)$/, "-org$1")
                .replace(/(-[0-9]*)(\.[^/]*)$/, "$1-org$2");
        }

        if (domain_nowww === "topstarnews.net") {
            return src
                .replace(/_v[0-9]+(\.[^/.]*)$/, "_org$1")
                .replace(/(_[0-9]+)(\.[^/.]*)$/, "$1_org$2")
                .replace("/thumbnail/", "/photo/");
        }

        if (domain === "cdn.topstarnews.net") {
            return src.replace(/:\/\/[^/]*\/(.*\/photo\/.*_[0-9]+)(\.[^/.]*)\/.*$/, "://www.topstarnews.net/$1_org$2");
        }

        if (domain === "thumb.mt.co.kr" ||
            domain === "thumb.mtstarnews.com") {
            src = src.replace(/:\/\/thumb\.([^/]*)\/[0-9]+\//, "://image.$1/");
        }

        if (domain === "menu.mt.co.kr" ||
            domain_nosub === "myskcdn.com") {



            var obj = src.match(/\/thumb\/(?:[0-9]+\/){3}([0-9]+)\//);
            if (obj && obj[1] !== "00") {
                var obj1_str = src.replace(/.*\/thumb\/([0-9]+\/[0-9]+\/[0-9]+\/).*/, "$1").replace(/\//g, "");
                var obj1 = parseInt(obj1_str);
                if (obj1 >= 20170526)
                    src = src.replace(/(\/thumb\/(?:[0-9]+\/){3})[0-9]+\//, "$100/");
                else
                    src = src.replace(/(\/thumb\/(?:[0-9]+\/){3})[0-9]+\//, "$106/");
            }

            return src
                .replace(/\/dims\/.*/, "");
        }

        if (domain === "img.enews24.cjenm.skcdn.com") {
            return src
                .replace(/\/News\/NewsThumbnail(\/[0-9]+\/)(?:[0-9]+_)?([0-9]+\.[^/.]*)$/, "/News/Contents$1$2")
                .replace(/(\/Photo\/Contents\/[0-9]+\/)[0-9]+_([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "stardailynews.co.kr" ||

            domain_nosub === "liveen.co.kr" ||
            domain_nosub === "ilyoseoul.co.kr" ||
            domain_nosub === "sportsq.co.kr" ||
            domain_nosub === "zenithnews.com" ||
            domain_nowww === "munhwanews.com" ||
            domain_nowww === "mhns.co.kr" ||
            domain === "www.ccdailynews.com" ||
            domain === "ph.kyeonggi.com" ||
            domain === "www.jemin.com" ||
            domain === "www.domin.co.kr" ||
            domain === "cdn.jejudomin.co.kr" ||
            domain === "ph.incheonilbo.com" ||
            domain === "www.hidomin.com" ||
            domain === "www.newsfreezone.co.kr" ||
            domain === "cdn.newsfreezone.co.kr" ||
            domain === "www.newsinside.kr" ||
            domain === "cdn.newsinside.kr" ||
            domain === "www.greenpostkorea.co.kr" ||
            domain === "www.egn.kr" ||
            domain === "www.whitepaper.co.kr" ||
            domain === "www.outdoornews.co.kr" ||
            domain === "www.shinailbo.co.kr" ||
            domain === "www.ngtv.tv" ||
            domain === "www.rnx.kr" ||
            domain === "www.intronews.net" ||
            domain === "www.hg-times.com" ||
            domain === "www.iemn.kr" ||
            domain_nowww === "newscj.com" ||
            domain === "www.ggilbo.com" ||
            domain === "www.bstoday.kr" ||
            domain === "interfootball.heraldcorp.com" ||
            domain === "www.ilyosisa.co.kr" ||
            domain === "www.ynnews.kr" ||
            domain === "www.starilbo.com" ||
            domain === "www.autoherald.co.kr" ||
            domain === "www.00news.co.kr" ||
            domain === "www.kstarfashion.com" ||
            domain === "www.inewspeople.co.kr" ||
            domain === "www.staraz.co.kr" ||
            domain === "www.wonnews.co.kr" ||
            domain_nosub === "gukjenews.com" ||
            domain === "www.lunarglobalstar.com" ||
            domain === "www.sundayjournal.kr" ||
            domain === "www.stnsports.co.kr" ||
            domain === "www.thekpm.com" ||
            domain === "chunchu.yonsei.ac.kr" ||
            domain === "www.e2news.com" ||
            domain_nowww === "newswiz.kr" ||
            domain === "ph.spotvnews.co.kr" ||
            domain_nowww === "sisunnews.co.kr" ||
            domain_nowww === "kpinews.co.kr" ||
            domain_nowww === "4th.kr" ||
            domain === "cds.topdaily.kr" ||
            domain_nowww === "kntimes.co.kr" ||
            domain_nowww === "senmedia.kr" ||
            domain_nowww === "siminilbo.co.kr" ||
            domain_nowww === "sisafocus.co.kr" ||
            domain_nowww === "futurekorea.co.kr" ||
            domain_nowww === "dailygrid.net" ||
            domain_nowww === "datanet.co.kr" ||
            domain_nowww === "newstown.co.kr") {
            return add_extensions_upper_jpeg(src
                                        .replace("/thumbnail/", "/photo/")
                                        .replace(/_v[0-9]*\.([^/]*)$/, ".$1")
                                        .replace(/(\/[0-9]+_[0-9]+_[0-9]+)_150(\.[^/.]*)$/, "$1$2"));
        }

        if (domain === "cdn.newsen.com" ||
            domain === "photo.newsen.com") {
            src = src.replace(/_ts\.[^/._]*$/, ".jpg").replace("/mphoto/", "/news_photo/");
            if (src.indexOf("/main_photo/") >= 0) {
                src = src.replace(/\/main_photo\/(?:mobile\/)?[^/]*_([0-9][0-9][0-9][0-9])([0-9][0-9])([0-9][0-9])([^/]*)$/, "/news_photo/$1/$2/$3/$1$2$3$4");
            }

            return src;
        }

        if (domain_nosub === "chosun.com" ||
            domain_nosub === "chosunonline.com") {

            if (domain === "sccdn.chosun.com") {
                return src.replace(/\/([0-9]*_)(?:scr_)?([^._/]*)(?:_t)?(\.[^/.]*)$/, "/$1$2$3");
            }

            return src
                .replace("/simg_thumb/", "/simg_org/")
                .replace(/\/thumb_dir\/(.*)_thumb(\.[^/.]*)$/, "/img_dir/$1$2")
                .replace(/\/thumbnail\/(.*?)(?:_thumb)?(\.[^/.]*)$/, "/image/$1$2");
        }

        /*if (domain.indexOf("ph.spotvnews.co.kr") >= 0 && false) {
            return src.replace("/thumbnail/", "/photo/").replace(/([0-9]+_[0-9]+_[0-9]+)_[0-9]+\.([^/]*)$/, "$1.$2");
        }*/

        if (domain === "photo.hankooki.com") {




            newsrc = src.replace("/arch/photo/", "/arch/original/")
                .replace("/arch/thumbs/", "/arch/original/")
                .replace(/(\/newsphoto\/[^/]*\/)thumbs\//, "$1");
            if (newsrc !== src) {
                return newsrc.replace(/(.*\/)t_?([^/]*)$/, "$1$2");
            } else {
                return src;
            }
        }

        if (domain === "thumb.hankooki.com") {
            return src.replace(/:\/\/[^/]*\/+(.*\/+)[0-9]+x[0-9]+x[^/]*@([^/]*)(?:[?#].*)?$/,
                               "://photo.hankooki.com/$1$2");
        }

        if (domain_nosub === "ettoday.net") {
            return src
                .replace(/\/[a-z]*([0-9]*\.[^/]*)$/, "/$1")
                .replace(/:\/\/cdn[0-9]*\./, "://static.");
        }

        if (domain === "img.mbn.co.kr") {
            return src.replace(/_s[0-9]+x[0-9]+(\.[^/]*)$/, "$1");
        }

        if ((domain_nosub === "inews24.com" &&
             domain.match(/image[0-9]*\.inews24\.com/)) ||
            (domain_nosub === "iwinv.net" &&
             domain.match(/inews24\.(?:ext[0-9]+\.)?cache\.iwinv\.net/))) {
            return src.replace("/thumbnail/", "/");
        }

        if (domain === "img.xml.inews24.com") {
            return src.replace(/:\/\/[^/]*\/(?:[0-9]+)?x[0-9]+\/+/, "://image.inews24.com/");
        }

        if (domain === "image-gd.inews24.com") {
            return src.replace(/:\/\/[^/]*\/image[0-9]*\.php\?u=([^&]*).*/, "://image3.inews24.com$1");
        }

        if (domain_nosub === "wowkorea.jp" &&
            (src.indexOf(".wowkorea.jp/img") >= 0 ||
             src.indexOf(".wowkorea.jp/upload") >= 0)) {

            newsrc = src.replace(/(\/upload\/+photoSpecial\/+[0-9]+\/+)re_([^/]*\.[^/.]*)(?:[?#].*)?$/, "$1$2");
            if (newsrc !== src)
                return newsrc;

            if (src.indexOf("/img/album/") < 0 &&
                !src.match(/\/upload\/news\/+[0-9]+\//)) {
                return src.replace(/([^/]*_)[a-z0-9]*(\.[^/.]*)$/, "$1l$2");
            }

            newsrc = src.replace(/_(?:[a-z0-9]|ss)(\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "saostar.vn" &&
            domain.match(/img[0-9]*\.saostar\.vn/)) {
            newsrc = src
                .replace(/saostar.vn\/fb[0-9]+[^/]*(\/.*\.[^/.]*)\/[^/]*$/, "saostar.vn$1")
                .replace(/saostar.vn\/[a-z][0-9]+\//, "saostar.vn/")
                .replace(/saostar.vn\/[0-9]+x[0-9]+\//, "saostar.vn/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub.match(/^google\./) &&
            src.match(/\/www\.google\.(?:[a-z]+\.)?[a-z]*\/url\?/)) {
            newsrc = src.replace(/.*url=([^&]*).*/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if ((domain_nowww === "lipstickalley.com" ||
             domain_nowww === "stephenking.com" ||
             domain.indexOf("forum.purseblog.com") >= 0) &&
            src.indexOf("/proxy.php?") >= 0) {
            return decodeURIComponent(src.replace(/.*image=([^&]*).*/, "$1"));
        }

        if (domain === "images.askmen.com") {
            return {
                url: src,
                head_wrong_contentlength: true
            };
        }

        if ((domain_nosub === "127.net" &&
             domain.indexOf("nosdn.127.net") >= 0) &&
            (src.indexOf("nosdn.127.net/img/") >= 0 ||
             src.indexOf("nosdn.127.net/photo/") >= 0)) { //lofter
                return {
                    url: src.replace(/\?.*$/, ""),
                    headers: {
                        "Referer": "https://lofter.com"
                    }
                };
        }

        if (domain === "board.makeshop.co.kr") {
            return src.replace(/\/[a-z]*::/, "/");
        }

        if (domain_nosub === "naver.jp" &&
            domain.match(/^rr\.img[0-9]*\.naver\./)) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/mig.*?[?&]src=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "imgcc.naver.jp") {
            return src
                .replace(/\/thumb(\/[0-9]+x[0-9]+x[0-9a-f]+)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1$2")
                .replace(/\/[0-9]+\/[0-9]+\/*(?:[?&].*)?$/, "");
        }

        if (domain === "dimg.donga.com") {
            return src
                .replace(/\/[ca]\/(?:[0-9]+\/){4}/, "/")
                .replace(/\/i\/[0-9]+\/[0-9]+\/[0-9]+\//, "/");
        }

        if (domain === "imgpark.donga.com" && src.indexOf("/fileUpload/") >= 0) {
            return {
                url: src,
                headers: {
                    Referer: "http://mlbpark.donga.com/"
                }
            };
        }

        if ((domain_nosub === "marishe.com" &&
             domain.match(/s[0-9]\.marishe\.com/)) ||
            (domain_nowww === "klik.gr" && src.indexOf("/uploads_image/") >= 0) ||
            (domain_nowww === "eroticasearch.net" && src.indexOf("/content/pics/") >= 0) ||
            domain === "resource.breakingnews.mn") {
            newsrc = src.replace(/(\/[^/]*)_[0-9]+(\.[^/.]*)$/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "klik.gr") {
            return {
                url: src,
                can_head: false
            };
        }

        /*if (domain.match(/img[0-9]*\.dreamwiz\.com/)) {
            return src.replace(/(\/[^/]*)_[a-z]\.([^/.]*)$/, "$1_o.$2");
        }*/

        if (domain === "cdn.hk01.com") {
            return src
                .replace(/(\/media\/images\/[^/]*\/)[^/]*\//, "$1org/")
                .replace(/\?.*/, "");
        }

        if (domain_nosub === "sinaimg.cn") {
            if (src.match(/:\/\/[^/]*\/max(?:width|height)\.[0-9]+\//)) {
                return {
                    url: src.replace(/(:\/\/[^/]*\/)[^/]*\//, "$1original/"),
                    can_head: false
                };
            }

            if (domain.match(/^ss/)) {
                src = src.replace(/\.sinaimg\.cn\/[^/]*\/([^/]*)\/*$/, ".sinaimg.cn/orignal/$1");
            } else {
                src = src.replace(/\.sinaimg\.cn\/[^/]*\/([^/]*)\/*$/, ".sinaimg.cn/large/$1");
            }

            if (domain.match(/^n\./)) {
                newsrc = src.replace(/(\/ent\/[0-9]+_)img(\/upload\/)/, "$1ori$2");
                if (newsrc !== src)
                    return newsrc;
            }

            return src.replace(/\/slidenews\/([^/_]*)_[^/_]*\//, "/slidenews/$1_img/"); // there's also _ori, but it seems to be smaller?
        }

        if (domain_nosub === "sina.com.cn" && domain.match(/^static[0-9]\.photo\.sina\.com\.cn/)) {
            return src.replace(/:\/\/static([0-9]*)\.photo\.sina\.com\.cn\//, "://ss$1.sinaimg.cn/");
        }

        if (domain === "thumbnail.egloos.net" ||
            domain === "thumb.egloos.net") {
            return src.replace(/^[a-z]+:\/\/thumb(?:nail)?\.egloos\.net\/[^/]*\/*/, "");
        }

        if (domain === "k.kakaocdn.net") {
            return src.replace(/\/img_[a-z]*\.([^./]*)$/, "/img.$1");
        }

        if (domain === "images.sportskhan.net" ||
            domain == "img.khan.co.kr") {
            return src
                .replace(/\/r\/[0-9]+x[0-9]+\//, "/")
                .replace(/\/[a-z]*_([0-9]+\.[a-z0-9A-Z]*)$/, "/$1")
                .replace(/\/c\/[0-9]*x[0-9]*\//, "/")
                .replace(/(\/news\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[0-9]{8}\.[0-9]+\.[0-9]+)[A-Z](\.[^/.]*)$/, "$1L$2")
                .replace(/\/photodb\//, "/PhotoDB/");
        }

        if (domain_nosub === "sbs.co.kr" &&
            domain.match(/^img[0-9]*\.sbs\.co\.kr/)) {
            newsrc = src.replace(/(\/[0-9]+)_[0-9v]+\.([a-z0-9A-Z]*)$/, "$1.$2");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/(\/[^_]*)_[^/.]*(\.[^/.]*)$/, "$1_ori$2");
        }

        if (domain === "image.board.sbs.co.kr") {
            return src.replace(/-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "edaily.co.kr" &&
            domain.indexOf("image.edaily.co.kr") >= 0 ||
            domain.indexOf("img.edaily.co.kr") >= 0) {

            return src
                .replace(/\/[a-z]_([A-Z0-9]+)\.([a-z0-9A-Z]*)$/, "/$1.$2")
                .replace(/(\/[A-Z0-9]+)[a-z]\.([a-z0-9A-Z]*)$/, "$1.$2");
        }

        if (domain === "media.glamour.com" ||

            domain === "assets.teenvogue.com" ||
            domain === "assets.vogue.com" ||
            domain === "media.vanityfair.com" ||
            domain === "media.gq.com" ||
            domain === "media.wmagazine.com" ||
            domain === "media.self.com" ||
            domain === "media.pitchfork.com" ||
            domain === "media.wired.com" ||
            domain === "media.golfdigest.com" ||
            domain === "media.architecturaldigest.com" ||
            domain === "media.cntraveler.com" ||
            domain === "media.allure.com" ||
            src.match(/:\/\/[^/]*\/photos\/[0-9a-f]{24}\/[^/]*\/[^/]*\/[^/]*$/)) {
            newsrc = src.replace(/\/[^/]*\/[^/]*\/([^/]*)$/, "/original/original/$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "cloudinary.com" ||
            domain === "images.playmates.com" ||
            domain === "images.playboy.com" ||
            (domain_nosub === "engoo.com" && domain.match(/^transcode[0-9]*\.app\./)) ||
            domain === "images.thehollywoodgossip.com" ||
            domain === "images.taboola.com") {
            if (src.search(/:\/\/[^/]*\/(?:[^/]*\/+)?image\/+fetch\//) >= 0) {
                newsrc = src.replace(/.*?:\/\/[^/]*\/(?:[^/]*\/)?image\/fetch\/(?:.*?(?:\/|%2F))?([^/%]*(?::|%3A).*)/, "$1");
                if (newsrc.match(/^[^/:]*%3A/))
                    newsrc = decodeURIComponent(newsrc);
                return newsrc;
            }

            newsrc = src.replace(/(\/iu\/[^/]*)\/.*?(\/v[0-9]*\/)/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "jpimedia.uk" && domain.match(/^images(?:-[a-z])?\./)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/+imagefetch\/+.*?\/(https?:\/\/)/, "$1");
        }

        if ((domain_nosub === "cloudinary.com" &&
             (domain.indexOf("res.cloudinary.com") >= 0 ||
              domain.match(/res-[0-9]*\.cloudinary\.com/))) ||
            domain === "i.kinja-img.com") {
            newsrc = src
                .replace(/\/image\/upload\/s\-\-[^/]*\-\-\//, "/image/upload/")
                .replace(/\/iu\/s\-\-[^/]*\-\-\//, "/iu/")
                .replace(/\/image\/upload\/[^/]*_[^/]*\//, "/image/upload/")
                .replace(/\/image\/upload\/v[0-9]+\//, "/image/upload/")
                .replace(/(\/private_images\/)[^/]*\//, "$1c_limit/")
                .replace(/(\/image\/private\/)[^s][^-][^/]*\//, "$1c_limit/")
                .replace(/(:\/\/[^/]*\/)[^/]*\/(ch\/images\/[0-9]+\/[^/]*$)/, "$1$2");
            if (newsrc !== src) {
                return newsrc;
            }

        }

        if (domain === "fiverr-res.cloudinary.com" ||
            domain === "assets.lybrate.com") {
            return src.replace(/(:\/\/[^/]*\/+(?:images\/+)?)[a-z]_[^/]*\//, "$1");
        }

        if (domain === "images.complex.com") {
            return src.replace(/\/(images|image\/upload)\/[^/]*_[^/]*\//, "/$1/");
        }

        if (domain === "images.spot.im" ||
            domain === "fashionista.com" ||
            domain === "images.pigeonsandplanes.com" ||
            domain === "images.sftcdn.net" ||
            domain === "cdn.primedia.co.za" ||
            domain === "www.maxim.com" ||
            domain === "img.thedailybeast.com" ||
            domain === "alibaba.kumpar.com" ||
            domain === "5b0988e595225.cdn.sohucs.com" ||
            domain === "images-cdn.moviepilot.com" ||
            domain === "img.playbuzz.com" ||
            domain === "images.discerningassets.com" ||
            domain === "images.radio-canada.ca" ||
            domain === "img.wcdn.co.il" ||
            domain === "images.haarets.co.il" ||
            domain === "images.cdn.yle.fi" ||
            (domain_nowww === "sol.no" && src.indexOf("/img/") >= 0)||
            (domain === "prof.prepics-cdn.com" && src.indexOf("/image/upload/") >= 0) ||
            domain === "images.ezvid.com" ||
            domain === "img.peerspace.com" ||
            domain === "dhgywazgeek0d.cloudfront.net" ||
            domain === "assets.nuuvem.com" ||
            domain === "images.lanouvellerepublique.fr" ||
            domain === "images.fastcompany.net" ||
            domain === "dwgyu36up6iuz.cloudfront.net" ||
            (domain_nosub === "minutemediacdn.com" && domain.match(/^images[0-9]*\./)) ||
            (domain_nosub === "cloudinary.com" && domain.indexOf("res.cloudinary.com") >= 0 && src.indexOf("/images/") >= 0) ||
            domain === "images.moviepilot.com") {
            return src
                .replace(/%2C/g, ",")
                .replace(/\/[a-z]+_[^/_,]+(?:,[^/]*)?\//, "/")
                .replace(/\/fl_any_format\.[^/]*\//, "/")
                .replace(/\/fl_keep_iptc[^/]*\//, "/")
                .replace("/t_mp_quality/", "/")
                .replace(/\/image\/+upload\/+t_[^/]*\//, "/image/upload/")
                .replace(/\/v[0-9]+\//, "/");
        }

        if (domain === "image.kkday.com") {
            return src.replace(/\/image\/+get\/+[^/]*(?:%2C|,)[^/]*\//, "/image/get/");
        }

        if (domain === "cdn.skim.gs") {
            return src
                .replace(/\/image\/upload\/[^/]*_[^/]*\//, "/image/upload/")
                .replace(/\/images\/[^/]*_[^/]*\//, "/images/");
        }

        if (((domain_nosub === "biography.com" ||
              domain === "www.guitarworld.com" ||
              domain === "www.guitaraficionado.com" ||
              domain === "www.psneurope.com") &&
             src.indexOf("/.image/") >= 0) ||
            src.match(/:\/\/[^/]*\/\.image\/[^/]*_[^/]*\/[A-Za-z-0-9]{24}\/[^/]*$/)) {
            newsrc = src.replace(/(\/.image)\/[^/]*(\/[^/]*\/[^/]*)$/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "popsugar-assets.com" ||
            domain_nosub === "onsugar.com") {
            newsrc = src.replace(/\/thumbor\/[^/]*\/(?:fit-in\/)?[^/]*\/(?:filters:[^/]*\/)?/, "/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/\.(?:preview_)?(?:[a-z]*|_original)(?:_(?:[0-9x]+|wm))?(\/i\/[^/]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/\.(?:preview|x*large)(?:_(?:[0-9x]+|wm))?(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "ceros.com" && domain.match(/^media[-.]/)) {
            newsrc = src.replace(/\?.*/, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "elleuk.cdnds.net") {
            newsrc = src.replace(/:\/\/.*\/[^/]*assets-elleuk-com-gallery-([0-9]*)-([^/]*)-([^-/.]*)\.[^-/.]*$/, "://assets.elleuk.com/gallery/$1/$2.$3");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "cdnds.net" &&
            !src.match(/\/[0-9]*x[0-9]*-[^/]*$/)) {

            newsrc = src
                .replace(/\/[0-9]+x[0-9]+\/gallery_/, "/")
                .replace(/\/[0-9]+x[0-9]+\/([^/]*)$/, "/$1")
                .replace(/\/[ML]\/([^/]*)$/, "/$1")
                .replace(/\/(?:landscape|hd-aspect|gallery)-([^/]*)$/, "/$1")
                .replace(/(\/[^/]*)\?[^/]*$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "redonline.cdnds.net") {
            return src.replace(/__[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.usmagazine.com") {
            return src.replace(/(.*?[^:])\/[0-9]*-[^/]*\//, "$1/");
        }

        if (domain_nosub === "gannett-cdn.com" &&
            src.indexOf("/-mm-/") >= 0) {
            newsrc = src.replace(/.*?\/-mm-\/[0-9a-f]*\/[^/]*\/(http[^/]*)\/(.*)$/, "$1://$2");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/\/-mm-\/.*?\/-\//, "/");
        }

        if (domain_nosub === "aolcdn.com") {
            var regex1 = /.*image_uri=([^&]*).*/;

            if (src.match(regex1)) {
                newsrc = decodeURIComponent(src.replace(/.*image_uri=([^&]*).*/, "$1"));
            } else if (src.match(/.*o\.aolcdn\.com\/images\//)) {
                newsrc = decodeURIComponent(src).replace(/.*o\.aolcdn\.com\/images\/[^:]*\/([^:/]*:.*)/, "$1");
            } else if (src.match(/^[a-z]+:\/\/[^/]*\/hss\/storage\/midas\//)) {
                return src.replace(/\/[0-9]+_([^/]*)$/, "/$1");
            }

            if (newsrc && newsrc !== src)
                return newsrc;
        }

        if (domain === "imagesvc.timeincapp.com") {
            return decodeURIComponent(src.replace(/.*\/foundry\/+image\/?.*?[?&]url=(http[^&]*).*/, "$1"));
        }

        /*if (domain.indexOf(".photoshelter.com") >= 0) {
          return src.replace(/\/s\/[0-9]*\/[0-9]*\//, "/");
          }*/

        if (domain_nosub === "photoshelter.com") {
            return src
                .replace(/\/img-get2\/([^/]*)\/(?:[a-z]+=[^/]*\/)*([^/]*)$/, "/img-get2/$1/fit=99999999999/$2")
                .replace(/\/img-get\/([^/]*)(?:\/[ts]\/[0-9]+\/(?:[0-9]+\/)?)?([^/]*)$/, "/img-get2/$1/fit=99999999999/$2")
                .replace(/\/+fit=[0-9x]+\/+fit=[0-9x]+/, "/fit=99999999999");
        }

        if (domain_nowww === "celebzz.com" &&
            src.indexOf("/wp-content/uploads/") >= 0) {
            newsrc = src.replace(/_thumbnail(\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "images-amazon.com" ||

            domain_nosub === "ssl-images-amazon.com" ||
            domain_nosub === "media-amazon.com" ||
            domain_nosub === "media-imdb.com" ||
            domain === "i.gr-assets.com") {
            return {
                url: src.replace(/\.[^/]*\.([^./]*)$/, ".$1"), // for now this seems to work for all images
                always_ok: true,
                can_head: false
            };
        }

        if (domain_nosub === "otapol.jp") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/img\/amazon\/size[0-9]+\/([^/]*)$/,
                                 "https://images-na.ssl-images-amazon.com/images/I/$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "movpins.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[a-z]+\/+(.)([a-zA-Z0-9]+(?:@+)?)(?:\.[^/]*)?\/[^/]*(\.[^/.]*)$/,
                               "https://ia.media-imdb.com/images/$1/$1$2$3");
        }

        /*if (domain.indexOf("cdn-img.instyle.com") >= 0) {
          return src.replace(/(\/files\/styles\/)[^/]*(\/public)/, "$1original$2");
          }

          if (domain.indexOf("static.independent.co.uk") >= 0) {
          return src.replace(/(\/styles\/)story_[^/]*(\/public)/, "$1story_large$2");
          }*/

        if (domain === "cdn-img.instyle.com" ||

            domain === "static.independent.co.uk" ||
            domain === "static.standard.co.uk" ||
            /*domain.indexOf("www.billboard.com") >= 0 ||
              domain.indexOf("www.harpersbazaararabia.com") >= 0 ||
              domain.indexOf("www.etonline.com") >= 0 ||*/
            domain === "o.oystermag.com" ||
            /*domain.indexOf("www.metro.us") >= 0 ||
              domain.indexOf("www.mtv.co.uk") >= 0 ||
              domain.indexOf("www.grammy.com") >= 0 ||*/
            (domain_nosub === "thr.com" && domain.match(/cdn[0-9]*\.thr\.com/)) ||
            domain.match(/s[0-9]*\.ibtimes\.com/) ||
            src.match(/\/s3fs-public\/styles\/[^/]*\/public\//) ||
            domain === "media.pri.org" ||
            domain === "www.wwe.com" ||
            domain === "akm-img-a-in.tosshub.com" ||
            domain === "cdn.9razia.de" ||
            domain_nowww === "bravo.de" ||
            domain === "static.reservationvacances.com" ||
            domain === "cdn.okmag.de" ||
            src.match(/\/sites\/[^/]*\/files2?\/styles\/[^/]*/) ||
            src.match(/\/sites\/[^/]*\/files2?\/[^/]*\/styles\/[^/]*/) ||
            src.match(/(?:(?:\/sites\/+[^/]*)?\/files\/+|\/sites\/+[^/]*\/+)imagecache\/+[^/]*/) ||
            src.search(/\/files\/styles\/[^/]*\/(?:public|private)\//) >= 0 ||
            src.search(/\/files\/[^/]*\/styles\/[^/]*\/(?:public|private)\//) >= 0) {

            newsrc = src
                .replace(/\/styles\/+.*?\/+(?:public|private)\//, "/")
                .replace(/\/imagecache\/+[^/]*\/+(?:files\/)?/, "/")
                .replace(/\?.*$/, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "etonline.com") {
            return {
                url: src,
                head_wrong_contentlength: true
            };
        }

        if (domain === "cdn.okmag.de" ||
            domain === "cdn.9razia.de") {
            return src.replace(/(:\/\/[^/]*\/)s\/[^/]*\/public\/(media\/)/, "$1$2");
        }

        if (domain === "img.elcomercio.pe" ||
            domain === "img.peru21.pe" ||
            domain_nowww === "elpais.com.co") {
            return src.replace(/\/files\/[^/]*\/uploads\//, "/uploads/");
        }

        if (domain_nowww === "trbimg.com") {
            return src.replace(/\/[0-9]*\/[0-9]*x[0-9]*\/*$/, "/").replace(/\/[0-9]*\/*$/, "/");
        }

        if ((domain_nosub === "blogspot.com" && domain.indexOf(".bp.blogspot.com") >= 0) ||

            ((domain_nosub === "googleusercontent.com" ||
              domain_nosub.match(/^google\./)) &&
             (domain.match(/^lh[0-9]\./) ||
              domain.match(/^gp[0-9]\./) ||
              domain.match(/^ci[0-9]\./))) ||
            domain === "d2yal1mtmg1ts6.cloudfront.net" ||
            (domain_nosub === "blogger.com" && domain.match(/^bp[0-9]*\.blogger\.com/)) ||
            domain_nosub === "ggpht.com") {
            return src
                .replace(/#.*$/, "")
                .replace(/\?.*$/, "")
                .replace(/\/[swh][0-9]*(-[^/]*]*)?\/([^/]*)$/, "/s0/$2")
                .replace(/(=[^/]*)?$/, "=s0?imgmax=0");
        }

        if (domain_nosub === "googleusercontent.com" &&
            domain.indexOf("opensocial.googleusercontent.com") >= 0) {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/gadgets\/proxy.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        /*if (domain === "images.thestar.com") {
            newsrc = src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
            if (newsrc !== src)
                return newsrc;
                }*/

        if (domain === "cdn.narcity.com" ||
            domain_nowww === "narcity.com") {
            return src.replace(/(\/[^/.]*\.[^/._]*)_[^/]*$/, "$1");
        }

        if (domain === "images.vanityfair.it") {
            return src.replace(/(\/gallery\/[0-9]*\/)[^/]*\//, "$1Original/");
        }

        if (domain_nosub === "r29static.com") {
            return src.replace(/(\/bin\/(?:entry|public)\/[^/]*)\/(?:[0-9]+,[0-9]+,[0-9]+,[0-9]+\/)?[^/]*(?:,[^/]*)?\/([^,]*)$/, "$1/x,100/$2");
        }

        if (domain === "img.huffingtonpost.com") {
            return src
                .replace(/\/asset\/[^/]*\/([^/.]*\.[^/.]*)$/, "/asset/$1")
                .replace(/\?[^/]*$/, "");
        }

        if (domain === "images.huffingtonpost.com" ||
            (domain_nowww === "kisax.com" && src.indexOf("/images/") >= 0) ||
            (domain_nosub === "nicepik.com" && domain.match(/^i[0-9]*\./) && src.indexOf("/files/") >= 0) ||
            (domain === "www.womansdiary.gr" && src.match(/\/articles\/[0-9]+\/[-0-9a-f]+-thumb/))) {
            return src.replace(/-thumb(\.[^/.]*)$/, "$1");
        }

        if (domain === "i.huffpost.com" ||
            domain === "s-i.huffpost.com") {

            return src
                .replace(/(\/gadgets\/slideshows\/[0-9]*\/slide_[^/]*_)[a-z]*(\.[^/.]*)$/, "$1original$2")
                .replace(/(\/gen\/[0-9]*\/).*(\.[^/.?]*)(?:\?[^/]*)?$/, "$1original$2");
        }

        if ((domain_nosub === "washingtonpost.com" ||
             domain === "c.o0bg.com" ||
             domain === "www.statesman.com" ||
             domain === "www.myajc.com" ||
             domain === "www.lastampa.it" ||
             domain === "www.whio.com" ||
             domain === "www.daytondailynews.com" ||
             domain_nowww === "livemint.com" ||
             domain_nowww === "bostonglobe.com" ||
             domain === "www.hindustantimes.com") &&
            src.indexOf("/rf/") >= 0) {



            newsrc = src
                .replace(/(.*?:\/\/[^/]*\/)rf\/[^/]*\/(.*)$/, "$1rw/$2")
                .replace(/[?&].*$/, "")
                .replace(/\.r(\.[^/.]*)$/, "$1");
            if (newsrc !== src) {
                return newsrc;
            }

        }

        /*if (domain_nowww === "livemint.com" && false) {
            return src.replace(/\/rf\/[^/]*\/(.*)$/, "/rw/$1");
        }*/

        if (domain_nosub === "foxnews.com" &&
            domain.match(/^a[0-9]*\.foxnews\.com/)) {
            if (src.replace(/.*\/a[0-9]*\.foxnews\.com\/([^/]*).*/, "$1") !== "images.foxnews.com") {
                return src.replace(/.*\/a[0-9]*\.foxnews\.com\/(.*)\/[0-9]+\/[0-9]+\/([^/]*)$/, "http://$1/$2");
            }
            return src.replace(/(\/a[0-9]*\.foxnews\.com\/.*)\/[0-9]+\/[0-9]+\/([^/?]*)(?:\?.*)?$/, "$1/0/0/$2");
        }

        if (domain === "cdn.cliqueinc.com" ||
            domain_nosub === "cliqueimg.com") {
            return src
                .replace(/(\/[^/]*)\.[0-9]*x[0-9]*[^/.]*\.([^./]*)$/, "$1.$2")
                .replace(/\/cache\/posts\//, "/posts/");
        }

        if (domain_nosub === "hubstatic.com") {
            return src.replace(/_[^_/.]*\.([^/.]*)$/, ".$1");
        }

        if ((domain === "pbs.twimg.com" &&
             src.indexOf("pbs.twimg.com/media/") >= 0) ||
            (domain === "ton.twitter.com" &&
             src.indexOf("/ton/data/dm/") >= 0)) {

            newsrc = src
                .replace(/(\/[^?&.]*)(?:\.[^/.?&]*)?([^/]*)[?&]format=([^&]*)/, "$1.$3$2")
                .replace(/(\/[^?&]*)[?&][^/]*$/, "$1")
                .replace(/(:[^/]*)?$/, ":orig")
                .replace(/\.([^/.:]*)(?::[^/.]*)$/, ".$1?name=orig");
            if (newsrc !== src) {
                if (newsrc.match(/\.png(\?.*)?$/)) {
                    return [newsrc, newsrc.replace(/\.png(\?.*)?$/, ".jpg$1")];
                } else {
                    return newsrc;
                }
            }
        }

        if (domain === "pbs.twimg.com" &&
            src.indexOf("pbs.twimg.com/profile_images/") >= 0) {
            return src
                .replace(/_bigger\.([^/_]*)$/, "\.$1")
                .replace(/_normal\.([^/_]*)$/, "\.$1")
                .replace(/_mini\.([^/_]*)$/, "\.$1")
                .replace(/_[0-9]+x[0-9]+\.([^/_]*)$/, "\.$1");
        }

        if (domain === "pbs.twimg.com" &&
            src.indexOf("pbs.twimg.com/card_img/") >= 0 ||
            src.indexOf("/ext_tw_video_thumb/") >= 0) {
            return src.replace(/(\?[^/]*&?name=)[^&/]*([^/]*)$/, "$1orig$2");
        }

        if (domain === "pbs.twimg.com" &&
            src.indexOf("pbs.twimg.com/profile_banners/") >= 0) {
            return src.replace(/\/[0-9]+x[0-9]+$/, "");
        }

        if (domain === "ytimg.googleusercontent.com" ||
            (domain_nosub === "ytimg.com" && domain.match(/^i[0-9]*\./)) ||
            domain === "img.youtube.com") {

            newsrc = src.replace(/^([a-z]+:\/\/)i[0-9]+(\.ytimg\.com\/vi\/+[^/]+\/+[a-z]+\.)/, "$1i$2");
            if (newsrc !== src)
                return {
                    url: newsrc,
                    problems: {
                        possibly_different: true
                    }
                };

            regex = /(\/+vi\/+[^/]*\/+)(?:[a-z]+|0)(\.[^/.?#]*)(?:[?#].*)?$/;
            return fillobj_urls([
                src.replace(regex, "$1maxresdefault$2"),
                src.replace(regex, "$1sddefault$2"),
                src.replace(regex, "$1hqdefault$2"),
                src.replace(regex, "$1mqdefault$2")
            ], {
                problems: {
                    possibly_different: true
                }
            });
        }

        if (domain === "image.bugsm.co.kr") {
            return src.replace(/\/images\/[0-9]*\//, "/images/original/").replace(/\?.*$/, "");
        }

        if (domain_nosub === "wp.com" &&
            domain.match(/i[0-9]\.wp\.com/)) {
            return src.replace(/.*\/i[0-9]\.wp\.com\/(.*?)(?:\?.*)?$/, "http://$1");
        }

        if (domain === "imagesmtv-a.akamaihd.net" && false) {
            return src.replace(/.*\/uri\/([a-z:]*:)?/, "http://");
        }

        if (domain === "img.voi.pmdstatic.net" ||

            domain === "voi.img.pmdstatic.net") {
            var base = src.replace(/.*\/fit\/([^/]*)\/.*/, "$1");
            base = base.replace(/\./g, "%");
            base = decodeURIComponent(base);
            return base;
        }

        if (domain === "dynaimage.cdn.cnn.com") {
            return decodeURIComponent(src.replace(/.*\/cnn\/[^/]*\//, ""));
        }

        if (domain === "wcmimages.ottawasun.com" ||
            domain === "wcmimages.torontosun.com" ||
            domain === "wcmimages.winnipegsun.com" ||
            domain === "wcmimages.edmontonjournal.com" ||
            src.match(/^[a-z]+:\/\/wcmimages\.[^/]*\/images\?url=http/)) {
            newsrc = decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/images.*?[?&]url=([^&]*).*/, "$1"));
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "i.amz.mshcdn.com" && false) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/[^/]*=\/[0-9]+x[0-9]+\/(?:filters:[^/]*\/)?(https?(?:%3A|:\/\/))/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if ((domain_nosub === "yimg.com" && domain.match(/^[sl][0-9]*\.yimg\.com/)) ||
           domain_nosub === "yahoo.com.tw") {
            return src
                .replace(/.*\/[^/]*\/api\/res\/[^/]*\/[^/]*\/[^/]*\/(.*?)(?:\.cf\.(?:jpg|webp))?$/, "$1")
                .replace(/^([a-z]*:\/)([^/])/, "$1/$2");
        }

        if (domain === "image.iol.co.za") {
            return decodeURIComponent(src.replace(/.*\/process\/.*\?.*source=([^&]*).*/, "$1"));
        }

        /*if (domain.indexOf("imageresizer.static9.net.au") >= 0) {
            return decodeURIComponent(src.replace(/.*imageresizer\.static9\.net\.au\/.*?\/([^/.?&]*%3A%2F%2F)/, "$1"));
        }*/

        if (domain_nosub === "squarespace.com" &&
            domain.match(/^static[0-9]*\.squarespace\.com/)) {
            newsrc = src.replace(/(?:\?.*)?$/, "?format=original");
            if (newsrc !== src)
                return {
                    url: newsrc,
                    head_wrong_contentlength: true
                };
        }

        if (domain === "images.squarespace-cdn.com") {

            var contenttype = url.searchParams.get("content-type");
            var append = "";
            if (contenttype) {
                append = "content-type=" + encodeURIComponent(decodeURIComponent(contenttype));
            } else {
                append = "";
            }

            var aappend = append ? "&" + append : "";
            var qappend = append ? "?" + append : "";

            newsrc = src
                .replace(/\?.*/, "")
                .replace(/\/+[0-9]+w$/, "");

            return [
                newsrc + "?format=original" + aappend,
                newsrc + "?format=2500w" + aappend,
                newsrc + qappend
            ];
        }

        if ((domain_nosub === "wordpress.com" && domain.indexOf(".files.wordpress.com") >= 0) ||

            ((domain_nosub === "imgix.net" ||
              domain === "imgix.bustle.com" ||
              domain === "imgix.ovp.tv2.dk" ||
              domain === "imgix.elitedaily.com" ||
              domain === "imgix.thezoereport.com" ||
              domain === "cdn-imgix-open.headout.com" ||
              domain === "imgix.romper.com") &&
             !src.match(/[?&]s=[^/]*$/)) ||

            amazon_container === "hmg-prod" ||
            domain === "blogs-images.forbes.com" ||
            domain === "images-production.global.ssl.fastly.net" ||
            domain === "images-production.freetls.fastly.net" ||
            domain_nosub === "cdnds.net" ||
            /*domain.indexOf("hbz.h-cdn.co") >= 0 ||
              domain.indexOf("cos.h-cdn.co") >= 0 ||*/
            domain_nosub === "h-cdn.co" ||
            domain === "cdn.newsapi.com.au" ||
            domain === "images.indianexpress.com" ||
            domain === "images.contentful.com" ||
            domain === "imagesmtv-a.akamaihd.net" ||
            domain === "d.ibtimes.co.uk" ||
            domain === "akns-images.eonline.com" ||
            /*domain.indexOf("www.telegraph.co.uk") >= 0 ||
            domain === "subscriber.telegraph.co.uk" ||
            domain.indexOf("aws.telegraph.co.uk") >= 0 ||*/
            (domain_nosub === "telegraph.co.uk" && src.indexOf("/content/dam/") >= 0) ||
            domain === "img.buzzfeed.com" ||
            (domain_nosub === "126.net" && domain.match(/^p[0-9]*\.music\.126\.net/)) ||
            domain === "stat.profile.ameba.jp" ||
            domain === "stat.blogskin.ameba.jp" ||
            domain === "stat.ameba.jp" ||
            domain === "image.uczzd.cn" ||
            domain === "img.danawa.com" ||
            domain === "img-www.tf-cdn.com"||
            domain_nosub === "viki.io" ||
            (domain_nosub === "githubusercontent.com" && domain.match(/^avatars[0-9]*\./)) ||
            (domain_nosub === "townnews.com" && domain.match(/bloximages\..*vip\.townnews\.com/)) ||
            domain === "asset.wsj.net" ||
            domain === "images.wsj.net" ||
            domain === "steamuserimages-a.akamaihd.net" ||
            /*domain === "image.assets.pressassociation.io" ||
            domain === "content.assets.pressassociation.io" ||*/
            (domain_nosub === "pressassociation.io" && domain.match(/\.assets\.pressassociation\.io$/)) ||
            domain === "media.immediate.co.uk" ||
            domain === "images.immediate.co.uk" ||
            domain === "cdn.heatworld.com" ||
            domain === "static.ok.co.uk" ||
            domain === "media.planetradio.co.uk" ||
            domain === "media.npr.org" ||
            domain === "assets.teamrock.com" ||
            (domain_nosub === "woopic.com" && domain.match(/^media[0-9]\.woopic\.com/)) ||
            (domain_nosub === "libe.com" && domain.match(/^md[0-9]\.libe\.com/)) ||
            domain === "medias.liberation.fr" ||
            domain === "cdn.graziadaily.co.uk" ||
            domain === "regmedia.co.uk" ||
            domain === "imageservice.nordjyske.dk" ||
            (domain === "cms.algoafm.co.za" && src.indexOf("/img/") >= 0) ||
            domain === "wac.450f.edgecastcdn.net" ||
            (domain === "www.gosoutheast.com" && src.indexOf("/images/") >= 0) ||
            (domain_nosub === "nikkeibp.co.jp" && src.toLowerCase().match(/\.(?:jpg|png)/)) ||
            (domain_nosub === "best.gg" && domain.match(/s-a[0-9]*\.best\.gg/)) ||
            (domain_nosub === "walmartimages.com" && domain.match(/i[0-9]*\.walmartimages\.com/)) ||
            domain === "nails.newsela.com" ||
            domain === "ojsfile.ohmynews.com" ||
            domain === "lumiere-a.akamaihd.net" ||
            domain === "img.lum.dolimg.com" ||
            domain_nowww === "xxlmag.com" ||
            (domain_nosub === "nyt.com" && domain.match(/^static[0-9]*\.nyt\.com/)) ||
            (domain_nosub === "vice.com" && domain.match(/-images\.vice\.com$/)) ||
            domain === "i.imgur.com" ||
            domain === "media.discordapp.net" ||
            domain === "images.discordapp.net" ||
            domain === "images.theconversation.com" ||
            (domain === "www.rspb.org.uk" && src.indexOf("/globalassets/") >= 0) ||
            domain === "media.beliefnet.com" ||
            (domain_nosub === "vietnamnet.vn" && domain.match(/img\.cdn[0-9]*\.vietnamnet\.vn/)) ||
            domain === "i.gadgets360cdn.com" ||
            domain === "i.ndtvimg.com" ||
            domain === "d3lp4xedbqa8a5.cloudfront.net" ||
            (domain === "brnow.org" && src.indexOf("/getattachment/") >= 0) ||
            (domain_nosub === "btime.com" && domain.match(/p[0-9]*\.(?:ssl\.)?cdn\.btime\.com/)) ||
            domain === "images.twistmagazine.com" ||
            domain === "sites.google.com" ||
            domain === "images.pexels.com" ||
            domain === "images.unsplash.com" ||
            domain === "tshop.r10s.jp" ||
            domain === "rakuma.r10s.jp" ||
            domain === "image.thanhnien.vn" ||
            domain === "static.netlife.vn" ||
            domain === "rs.phunuonline.com.vn" ||
            domain === "images.nbcolympics.com" ||
            domain === "compote.slate.com" ||
            domain_nosub === "gannett-cdn.com" ||
            (domain_nowww === "rdfm-radio.fr" && src.indexOf("/medias/") >= 0) ||
            domain === "image-api.nrj.fr" ||
            domain === "api.hdwallpapers5k.com" ||
            (domain_nosub === "koreaportal.com" && domain.match(/images\.[^.]*\.koreaportal\.com/)) ||
            (domain === "www.officialcharts.com" && src.indexOf("/media/") >= 0) ||
            (domain === "citywonders.com" && src.indexOf("/media/") >= 0) ||
            (domain_nosub === "agoda.net" && domain.match(/pix[0-9]*\.agoda\.net/)) ||
            domain === "images.pottermore.com" ||
            (domain === "www.google.com" && src.match(/\/photos\/public\/[^/]*$/)) ||
            domain === "images.streamable.com" ||
            domain === "cdn.amebaowndme.com" ||
            (domain === "www.kaixian.tv" && src.indexOf("/file/") >= 0) ||
            (domain === "sumo.cdn.tv2.no" && src.indexOf("/imageapi/") >= 0) ||
            domain === "media.missguided.com" ||
            domain === "photo.venus.com" ||
            domain === "cdn-images.prettylittlething.com" ||
            (domain === "www.oxfordmail.co.uk" && src.indexOf("/resources/") >= 0) ||
            (domain === "popcrush.com" && src.indexOf("/files/") >= 0) ||
            (domain === "screencrush.com" && src.indexOf("/files/") >= 0) ||
            (domain_nosub === "nineentertainment.com.au" && domain.match(/assets\.[^.]*\.nineentertainment\.com\.au/)) ||
            (domain === "www.thenational.ae" && src.indexOf("/image/") >= 0) ||
            (domain_nosub === "kh1.co" && domain.match(/s[0-9]*\.kh1\.co/)) ||
            domain === "uploads.disquscdn.com" ||
            (domain_nowww === "voidu.com" && src.indexOf("/gallery/") >= 0) ||
            (domain === "store.playstation.com" && src.indexOf("/image?") >= 0) ||
            domain === "images.interactives.dk" ||
            domain === "toyo-arhxo0vh6d1oh9i0c.stackpathdns.com" ||
            (domain === "www.zmonline.com" && src.indexOf("/media/") >= 0) ||
            domain === "img-s-msn-com.akamaized.net" ||
            (domain_nowww === "heraldscotland.com" && src.indexOf("/resources/images/") >= 0) ||
            (domain_nowww === "theboltonnews.co.uk" && src.indexOf("/resources/images/") >= 0) ||
            domain === "cdn.instructables.com" ||
            domain === "images.performgroup.com" ||
            domain === "media.playmobil.com" ||
            domain === "img.crocdn.co.uk" ||
            (domain === "www.calgaryherald.com" && src.indexOf("/cms/") >= 0) ||
            (domain_nowww === "montrealgazette.com" && src.indexOf("/cms/") >= 0) ||
            (domain_nosub === "ikea.com" && src.indexOf("/images/") >= 0) ||
            (domain === "colorwallpaper.net" && src.indexOf("/img/") >= 0) ||
            domain === "img.cache.vevo.com" ||
            (domain === "drop.ndtv.com" && src.indexOf("/albums/") >= 0) ||
            (domain_nosub === "christiandaily.com" && domain.indexOf("images.christianitydaily.com") >= 0) ||
            (domain_nosub === "christiandaily.co.kr" && domain.indexOf("images.christiandaily.co.kr") >= 0) ||
            domain === "images.christiantoday.co.kr" ||
            domain === "blogimg.goo.ne.jp" ||
            domain === "cdn.clien.net" ||
            (domain_nosub === "imgs.cc" && domain.match(/s[0-9]*\.imgs\.cc/)) ||
            (domain_nosub === "amebame.com" && domain.indexOf("stat.amebame.com") >= 0) ||
            domain === "i.iheart.com" ||
            domain === "cdn-hit.scadigital.io" ||
            (domain === "displate.com" && src.indexOf("/displates/") >= 0) ||
            (domain_nosub === "picsart.com" && domain.match(/cdn[0-9]*\.picsart\.com/)) ||
            domain === "cdn.ndtv.com" ||
            (domain_nosub === "kompasiana.com" && domain.match(/assets(?:-[a-z][0-9])?\.kompasiana\.com/)) ||
            domain === "images.popbuzz.com" ||
            (domain_nosub === "adis.ws" && domain.match(/i[0-9]*\.adis\.ws/)) ||
            (domain_nosub === "9c9media.com" && domain.match(/^images[0-9]*\.9c9media\.com/)) ||
            (domain_nosub === "newser.com" && domain.match(/img[0-9]*(?:-[a-z]+)?\.newser\.com/)) ||
            domain === "images.m-magazine.com" ||
            domain === "www.zoom.co.uk" ||
            domain === "ctd-thechristianpost.netdna-ssl.com" ||
            domain === "img.vidible.tv" ||
            (domain_nosub === "j-14.com" && domain.match(/images\.(?:[a-z]+\.)?j-14\.com/)) ||
            domain === "cdn.abcotvs.com" ||
            (domain_nowww === "tasteofcountry.com" && src.indexOf("/files/") >= 0) ||
            domain === "images.thewest.com.au" ||
            (domain_nosub === "ntv.com.tr" && domain.match(/cdn[0-9]*\.ntv\.com\.tr/)) ||
            (domain_nosub === "hotnessrater.com" && domain.match(/img[0-9]*\.hotnessrater\.com/)) ||
            domain_nowww === "starcrush.com" ||
            (domain === "www.chrichri.dk" && src.indexOf("/media/") >= 0) ||
            (domain === "www.rightstufanime.com" && src.indexOf("/images/") >= 0) ||
            domain === "assets.bigcartel.com" ||
            (domain === "www.thenorthernecho.co.uk" && src.indexOf("/resources/images/") >= 0) ||
            domain === "binaryapi.ap.org" ||
            domain === "images.8tracks.com" ||
            (domain_nosub === "spoilercat.com" && domain.match(/cdn[0-9]*\.spoilercat\.com/)) ||
            (domain === "www.mumbailive.com" && src.indexOf("/images/") >= 0) ||
            domain === "static.juksy.com" ||
            domain === "img.reblog.hu" ||
            (domain_nowww === "thefw.com" && src.indexOf("/files/") >= 0) ||
            domain === "img.csfd.cz" ||
            domain === "img.timesnownews.com" ||
            domain === "img.siksinhot.com" ||
            domain === "mp-seoul-image-production-s3.mangoplate.com" ||
            domain === "api.theweek.com" ||
            domain === "i.smalljoys.me" ||
            (domain_nosub === "huanqiu.cn" && domain.match(/t[0-9]*\.huanqiu.cn/)) ||
            (domain_nowww === "radiotimes.com" && src.indexOf("/uploads/") >= 0) ||
            (domain === "hypebeast.com" && src.indexOf("/image/") >= 0) ||
            (domain === "dramaguru.net" && src.indexOf("/images/") >= 0) ||
            domain === "sos.vfan.vlive.tv" ||
            (domain_nosub === "journalmedia.ie" && domain.match(/^img[0-9]*\./)) ||
            (domain_nosub === "thejournal.ie" && domain.match(/^img[0-9]*\./)) ||
            (domain === "external.polskieradio.pl" && src.indexOf("/files/") >= 0) ||
            domain === "bbd-1tmxd3aba43noa.stackpathdns.com" ||
            domain === "thumb.netz.id" ||
            (domain_nosub === "tchyn.io" && src.indexOf("/snopes-production/uploads/") >= 0) ||
            domain === "img.diply.com" ||
            domain === "img-mdpr.freetls.fastly.net" ||
            domain === "cdn-assets.ziniopro.com" ||
            domain === "netherlands-grlk5lagedl.stackpathdns.com" ||
            (domain_nosub === "stackpathdns.com" && domain.indexOf("-grlk5lagedl.stackpathdns.com") >= 0) ||
            (domain === "www.beautycrew.com.au" && src.indexOf("/media/") >= 0) ||
            domain_nosub === "mtvnimages.com" ||
            (domain === "dsx.weather.com" && src.indexOf("/util/image/") >= 0) ||
            domain === "img.r7.com" ||
            domain === "cdn-images.rtp.pt" ||
            domain === "media.ouest-france.fr" ||
            (domain_nowww === "rbsdirect.com.br" && src.indexOf("/imagesrc/") >= 0) ||
            (domain_nowww === "newfoundlandlabrador.com" && src.indexOf("/-/media/") >= 0) ||
            domain === "images.businessoffashion.com" ||
            (domain_nosub === "pg0.cn" && domain.match(/cmsfile\.pg0\.cn/)) ||
            domain === "api.ning.com" ||
            (domain_nosub === "mpinteractiv.ro" && domain.match(/^storage[0-9]*\./) && src.indexOf("/media/") >= 0) ||
            (domain_nosub === "muscache.com" && src.match(/\/im\/pictures\/[-0-9a-f]+\./)) ||
            (domain_nowww === "wedd.today" && src.indexOf("/wallpaper/") >= 0) ||
            (domain_nowww === "looklive.at" && src.match(/\/media\/[0-9]+\//)) ||
            domain === "t.tudocdn.net" ||
            (domain === "me.phununet.com" && src.indexOf("/resources/img/") >= 0) ||
            (domain === "cdn.diario26.com.ar" && src.indexOf("/media/image/") >= 0) ||
            (domain_nowww === "discovermagazine.com" && src.indexOf("/media/Images/") >= 0) ||
            domain === "steamusercontent-a.akamaihd.net" ||
            (domain_nowww === "qfeast.com" && src.indexOf("/imret/") >= 0) ||
            (domain === "statis.gamen.vn" && src.indexOf("/images/upload/") >= 0) ||
            domain === "img.anikore.jp" ||
            (domain_nosub === "newsplex.pt" && domain.match(/^cdn[0-9]*\./)) ||
            (domain === "static.origos.hu" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "robertocavada.com" && src.indexOf("/Images/") >= 0) ||
            domain === "images.mncdn.pl" ||
            (domain_nowww === "imgsearches.com" && src.indexOf("/i/") >= 0) ||
            (domain_nowww === "thetimesnews.com" && (
                src.indexOf("/storyimage/") >= 0 ||
                    src.indexOf("/galleryimage/") >= 0)) ||
            domain === "static.fthis.gr" ||
            (domain === "img.pixelz.com" && src.indexOf("/blog/") >= 0) ||
            (domain_nosub === "hellomagazine.com" && src.indexOf("/imagenes/") >= 0) ||
            (domain_nosub === "1616.ro" && domain.match(/^i[0-9]*\./)) ||
            domain === "images.lifeandstylemag.com" ||
            domain === "img.freepik.com" ||
            (domain_nosub === "fonwall.ru" && domain.match(/^img[0-9]*\./)) ||
            (domain_nowww === "wonderwall.com" && src.indexOf("/photos/") >= 0) ||
            (domain_nowww === "thestar.com.my" && src.indexOf("/~/media/online/") >= 0) ||
            (domain_nowww === "vancouversun.com" && src.indexOf("/cms/") >= 0) ||
            domain === "imageproxy.viewbook.com" ||
            (domain === "image.lag.vn" && src.indexOf("/upload/") >= 0) ||
            (domain_nowww === "booktrust.org.uk" && src.indexOf("/globalassets/images/") >= 0) ||
            (domain_nosub === "ccio.co" && domain.match(/^ind[0-9]*\./)) ||
            (domain_nosub === "cpcache.com" && domain.match(/^i[0-9]*\./)) ||
            domain === "i.rocdn.com" ||
            domain === "cdn.closeronline.co.uk" ||
            (domain === "resource.globenewswire.com" && src.indexOf("/Resource/Download/") >= 0) ||
            (domain_nowww === "townsquare.media" && src.match(/\/+site\/+[0-9]+\/+files\/+/)) ||
            domain === "images.reference.com" ||
            domain === "assets.pcmag.com" ||
            domain === "images.jg-cdn.com" ||
            (domain_nosub === "qingstor.com" && src.indexOf("/images/articles/") >= 0) ||
            domain === "img.ibxk.com.br" ||
            (domain === "image.biccamera.com" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "g-mark.org" && src.indexOf("/media/") >= 0) ||
            ((domain === "kubrick.htvapps.com" || amazon_container === "htv-prod-media") && src.indexOf("/images/") >= 0) ||
            domain === "images.france.fr" ||
            (domain === "az877327.vo.msecnd.net" && src.indexOf("/media/images/") >= 0) ||
            (domain_nosub === "hoteljardinlebrea.com" && src.indexOf("/usermedia/") >= 0) ||
            (domain_nosub === "veltra.com" && domain.match(/^cdn[0-9]*\./)) ||
            (domain === "img.letgo.com" && src.indexOf("/images/") >= 0) ||
            (domain === "images.musement.com" && src.indexOf("/cover/") >= 0) ||
            domain === "media-manager.noticiasaominuto.com" ||
            domain === "i.playground.ru" ||
            (domain_nowww === "treeoftheyear.org" && src.indexOf("/getmedia/") >= 0) ||
            (domain === "cdn.indicium.nu" && src.indexOf("/source/grazia/") >= 0) ||
            domain === "news-img.51y5.net" ||
            (domain === "st.automobilemag.com" && src.indexOf("/uploads/sites/") >= 0) ||
            (domain === "styles.redditmedia.com" && src.indexOf("/styles/") >= 0) ||
            domain === "img.webmd.com" ||
            domain === "embedwistia-a.akamaihd.net" ||
            src.match(/\/demandware\.static\//) ||
            src.match(/\?i10c=[^/]*$/) ||
            src.indexOf("/wp-content/blogs.dir/") >= 0 ||
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/\?.*$/, "");
        }

        if ((domain_nosub === "hoopchina.com.cn" && domain.match(/[ci][0-9]*\.hoopchina\.com\.cn/)) ||
            domain === "cdn.odigo.net" ||
            domain === "i.linkeddb.com" ||
            domain === "img.heypik.com" ||
            domain === "club-img.kdslife.com" ||
            domain === "wangsuimg.fanshuapp.com" ||
            domain === "img.aiji66.com" ||
            domain === "imgs.aixifan.com" ||
            (domain_nosub === "ofashion.com.cn" && domain.match(/^img[0-9]*\.ofashion.com.cn/)) ||
            domain === "kanfaimage.oss-cn-beijing.aliyuncs.com" ||
            domain === "imgcdn.thecover.cn" ||
            domain === "img.shelive.net" ||
            domain === "img.qdaily.com" ||
            domain === "qimage.owhat.cn" ||
            domain === "img.ksl.com" ||
            (domain_nosub === "mioreport.com" && domain.match(/^s[0-9]*\./)) ||
            (domain_nosub === "tapimg.com" && domain.match(/^img[0-9]*\./)) ||
            domain === "7xka0y.com1.z0.glb.clouddn.com" ||
            (domain_nosub === "mafengwo.net" && domain.match(/^p[0-9]*(?:-[a-z]+)\./)) ||
            (domain_nosub === "myqcloud.com" && domain.match(/image\.myqcloud\.com/)) ||
            domain === "ci.xiaohongshu.com" ||
            (domain_nosub === "yohobuy.com" && domain.match(/^img[a-z]*[0-9]*\.yohobuy\.com$/)) ||
            (domain_nosub === "715083.com" && domain.match(/^i-[0-9]*-yxdown\./)) ||
            (domain_nosub === "yxdown.com" && domain.match(/^i-[0-9]*\./)) ||
            (domain === "jkcdn.pajk.com.cn" && src.indexOf("/image/") >= 0) ||
            (domain_nosub === "hola.com" && src.indexOf("/imagenes/") >= 0) ||
            domain === "upload-images.jianshu.io") {
            src = src.replace(/\?.*$/, "");
        }

        if (domain === "mtv.mtvnimages.com" ||
            (domain_nosub === "tradesy.com" && domain.match(/^item[0-9]*\.tradesy/) && src.indexOf("/images/") >= 0)) {
            return {
                url: src.replace(/\?.*$/, ""),
                can_head: false
            };
        }

        if (domain === "store-images.microsoft.com" ||
            domain === "store-images.s-microsoft.com") {
            return {
                url: src.replace(/\?.*$/, ""),
                head_wrong_contenttype: true
            };
        }

        if (domain_nowww === "dailyherald.com") {
            newsrc = src.replace(/[?&].*$/, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "imimg.com" ||
            domain === "blogs-images.forbes.com" ||
            domain === "static.thesuperficial.com" ||
            domain === "static.celebuzz.com" ||
            domain === "img.vogue.co.kr" ||
            domain === "static.spin.com" ||
            domain_nowww === "zrockr.com" ||
            domain_nowww === "electricegg.co.uk" ||
            (domain_nosub === "hw-static.com" && domain.match(/www\.media[0-9]*\.hw-static\.com/)) ||
            (domain_nosub === "turner.com" && domain.indexOf(".cdn.turner.com") >= 0) ||
            domain_nowww === "k99.com" ||
            domain_nowww === "97rockonline.com" ||
            domain_nowww === "wfgr.com" ||
            domain_nowww === "wblk.com" ||
            domain_nowww === "fun107.com" ||
            domain_nowww === "965viki.com" ||
            domain_nowww === "1079ishot.com" ||
            domain === "edge.alluremedia.com.au" ||
            (amazon_container === "blogs-prod-media" && src.indexOf("/uploads/") >= 0) ||
            domain === "d36tnp772eyphs.cloudfront.net" ||
            domain === "img.allurekorea.com" ||
            domain_nowww === "psu.com" ||
            domain === "media.popculture.com" ||
            domain_nowww === "rap-up.com" ||
            (domain_nosub === "hankyung.com" && domain.match(/img\..*?\.hankyung\.com$/)) ||
            domain_nowww === "traveltipy.com" ||
            domain_nowww === "coveteur.com" ||
            (domain_nosub === "ehow.com" && domain.indexOf(".blog.ehow.com") >= 0) ||
            (domain_nosub === "theheartysoul.com" && domain.match(/cdn[0-9]*\.theheartysoul\.com/)) ||
            domain_nowww === "bandt.com.au" ||
            domain === "www.theepochtimes.com" ||
            domain === "m.theepochtimes.com" ||
            domain === "images.gamme.com.tw" ||
            domain === "images.gamme.com.cn" ||
            domain === "cdn.hoahoctro.vn" ||
            domain === "vnn-imgs-f.vgcloud.vn" ||
            domain === "static.vibe.com" ||
            domain === "rightsinfo.org" ||
            domain === "img.marieclairekorea.com" ||
            domain === "tokyopopline.com" ||
            domain === "px1img.getnews.jp" ||
            domain === "media.thetab.com" ||
            domain === "assets.rockpapershotgun.com" ||
            domain === "spotted.tv" ||
            (domain_nosub === "vietnamnet.vn" && domain.indexOf(".imgs.vietnamnet.vn") >= 0) ||
            domain === "sloanreview.mit.edu" ||
            domain === "business.inquirer.net" ||
            domain === "static.thefrisky.com" ||
            domain === "hobby.dengeki.com" ||
            domain === "cdn-blog.adafruit.com" ||
            (domain_nosub === "uuhy.com" && domain.match(/s?img\.uuhy\.com/)) ||
            domain === "img.butongshe.com" ||
            domain === "myreco.asia" ||
            domain === "d3p157427w54jq.cloudfront.net" ||
            domain === "cdn.harpersbazaar.com.sg" ||
            domain_nosub === "myconfinedspace.com" ||
            amazon_container === "hiphopdx-production" ||
            domain === "assets.wonderlandmagazine.com" ||
            (domain_nosub === "akamaized.net" && domain.match(/^am[0-9]*\./) && src.indexOf("/tms/cnt/uploads/") >= 0) ||
            (domain_nosub === "pressassociation.io" && domain.indexOf("static.pressassociation.io") >= 0) ||
            (domain_nosub === "digitaltrends.com" && domain.match(/icdn[0-9]*\.digitaltrends\.com/)) ||
            domain === "assets.vg247.com" ||
            (domain_nowww === "theblemish.com" && src.indexOf("/images/") >= 0) ||
            (domain === "www.dailyxtra.com" && src.indexOf("/content/uploads/") >= 0) ||
            domain === "media.metrolatam.com" ||
            domain === "media.comicbook.com" ||
            domain === "www.grazia.it" ||
            domain === "img.kpopmap.com" ||
            domain === "s.nbst.gr" ||
            domain === "assets.metrolatam.com" ||
            domain_nosub === "mthai.com" ||
            domain === "cdn.webnoviny.sk" ||
            domain === "bloggar.expressen.se" ||
            (domain_nosub === "saostar.vn" && domain.match(/img[0-9]*\.saostar\.vn/)) ||
            (domain_nosub === "gossipcop.com" && domain.match(/s[0-9]*\.gossipcop\.com/)) ||
            domain === "petapixel.com" ||
            domain === "d3i6fh83elv35t.cloudfront.net" ||
            domain === "d17fnq9dkz9hgj.cloudfront.net" ||
            domain_nowww === "pinknews.co.uk" ||
            domain === "images.everyeye.it" ||
            googlestorage_container === "koreaboo-cdn" ||
            (domain_nowww === "behindzscene.net" && src.indexOf("/file/") >= 0) ||
            (domain_nowww === "hipertextual.com" && src.indexOf("/files/") >= 0) ||
            (domain_nowww === "geeksofdoom.com" && src.indexOf("/img/") >= 0) ||
            domain === "newsimages.fashionmodeldirectory.com" ||
            domain === "akm-img-a-in.tosshub.com" ||
            domain === "img.blogtamsu.vn" ||
            (domain_nosub === "starsdaily.net" && domain.match(/cdn[0-9]+\.starsdaily\.net/)) ||
            (domain_nowww === "nextnature.net" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "vooks.net" && src.indexOf("/img/") >= 0) ||
            domain === "i.ido.bi" ||
            domain === "cdn.techgyd.com" ||
            (domain_nowww === "4girls.co.il" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "gceleb.com" && src.indexOf("/photo/") >= 0) ||
            (domain === "www.seriouseats.com" && src.indexOf("/images/") >= 0) ||
            domain === "i.epochtimes.com" ||
            domain === "cdn.thammysen.vn" ||
            domain === "d1lofqbqbj927c.cloudfront.net" ||
            (domain_nowww === "180grados.com.mx" && src.indexOf("/img/") >= 0) ||
            domain === "photo.tin8.co" ||
            (domain_nosub === "whatculture.com" && domain.match(/^cdn[0-9]*\.whatculture\.com/) && src.indexOf("/images/") >= 0) ||
            (domain === "www.electronicbeats.net" && src.indexOf("/uploads/") >= 0) ||
            domain === "media.iconsingapore.com" ||
            domain === "p.cosmopolitan.bg" ||
            domain === "cache.pakistantoday.com.pk" ||
            domain === "media.breitbart.com" ||
            domain === "s.rozali.com" ||
            domain === "s.sdgcdn.com" ||
            (domain === "ticket.heraldtribune.com" && src.indexOf("/files/") >= 0) ||
            domain === "blog.hola.com" ||
            (domain_nowww === "therussiantimes.com" && src.indexOf("/uploads/") >= 0) ||
            domain === "static.idolator.com" ||
            domain === "images.saloona.co.il" ||
            (domain_nowww === "bellezaenvena.com" && src.indexOf("/my_uploads/") >= 0) ||
            (domain_nosub === "thejournal.ie" && src.indexOf("/media/") >= 0) ||
            domain_nowww === "tvperson.ru" ||
            domain_nowww === "iwantpix.com" ||
            domain_nowww === "nudemodelpics.com" ||
            (domain === "images.chr.bg" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "woman.ua" && src.indexOf("/file/images/") >= 0) ||
            domain === "gdsit.cdn-immedia.net" ||
            domain_nowww === "cseditors.com" ||
            (domain_nowww === "imcdn.org" && src.indexOf("/uploads/") >= 0) ||
            domain === "t.a4vn.com" ||
            domain_nowww === "dodskypict.com" ||
            domain === "files.dals.media" ||
            domain === "cdn.crhoy.net" ||
            domain_nowww === "longwallpapers.com" ||
            domain === "files.greatermedia.com" ||
            (domain_nowww === "tsundora.com" && src.indexOf("/image/") >= 0) ||
            (domain_nosub === "twitch.tv" && domain.match(/^clips-media-assets[0-9]*\./) && src.match(/-preview-[0-9]+x[0-9]+\.[^/.]*$/)) ||
            (domain === "file.immo.vlan.be" && src.indexOf("/Image/Wordpress/") >= 0) ||
            domain === "media.trud.bg" ||
            (domain_nowww === "rotativo.com.mx" && src.indexOf("/assets/") >= 0) ||
            (domain_nowww === "chfi.com" && src.indexOf("/wp-content/") >= 0) ||
            googlestorage_container === "sin-cdn" ||
            domain === "cdn.appleigeek.com" ||
            domain === "media.cnnchile.com" ||
            (domain_nowww === "festivalteen.com.br" && src.indexOf("/uploads/") >= 0) ||
            (amazon_container === "rhodiesworld" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "ntdtv.kr" && src.indexOf("/assets/") >= 0) ||
            domain === "xdn.tf.rs" ||
            domain === "static.acg12.com" ||
            (domain_nowww === "delas.pt" && src.indexOf("/files/") >= 0) ||
            domain === "img.zone5.ru" ||
            (domain_nosub === "bssl.es" && domain.match(/^i[0-9]*\./)) ||
            domain === "images.virgula.com.br" ||
            (domain_nowww === "rotana.net" && src.indexOf("/assets/uploads/") >= 0) ||
            (domain === "elle.unitedinfluencers.org" && src.indexOf("/content/uploads/") >= 0) ||
            (domain_nowww === "notredamedeparis.fr" && src.indexOf("/content/uploads/") >= 0) ||
            (domain === "zenska.hudo.com" && src.indexOf("/files/") >= 0) ||
            (amazon_container === "seenitblog" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "marieclaire.hu" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "infinitymemories.com" && src.indexOf("/files/") >= 0) ||
            (domain_nowww === "tuxboard.com" && src.indexOf("/photos/") >= 0) ||
            (domain_nosub === "mundotkm.com" && domain.match(/^arcdn[0-9]*\./)) ||
            (domain_nosub === "game4v.com" && domain.match(/^cdn[0-9]*\./)) ||
            (domain_nosub === "cosplaytime.pl" && src.indexOf("/uploads/") >= 0) ||
            domain === "img.wkorea.com" ||
            domain === "static.stereogum.com" ||
            (domain === "i.mdel.net" && src.indexOf("/newfaces/i/") >= 0) ||
            domain === "media.celebmasta.com" ||
            domain === "media.korea25.com" ||
            (domain_nowww === "sexyfandom.com" && src.indexOf("/images/") >= 0) ||
            domain === "i.dmarge.com" ||
            domain === "assets.boundingintocomics.com" ||
            domain === "media.profootballfocus.com" ||
            (domain_nowww === "redu.pl" && src.indexOf("/img/") >= 0) ||
            (domain === "multifiles.pressherald.com" && src.indexOf("/uploads/") >= 0) ||
            domain === "img.time2draw.com" ||
            (domain === "ffw.uol.com.br" && src.indexOf("/app/uploads/") >= 0) ||
            domain === "images.harianjogja.com" ||
            domain === "images.hamodia.com" ||
            (domain_nowww === "bz-berlin.de" && src.indexOf("/data/uploads/multimedia/") >= 0) ||
            domain_nowww === "worldcupgirls.net" ||
            (domain_nosub === "playstationlifestyle.net" && domain.match(/^cdn[0-9]*-www\./) && src.indexOf("/assets/uploads/") >= 0) ||
            domain === "assets.cdn.moviepilot.de" ||
            (domain_nosub === "aving.net" && domain.match(/^image[0-9]*\./)) ||
            domain === "ss-images.catscdn.vn" ||
            (domain === "blogs.gnome.org" && src.indexOf("/files/") >= 0) ||
            (domain_nosub === "zoomit.ir" && domain.match(/^cdn[0-9]*\./)) ||
            domain === "img.myfirstshow.com" ||
            (domain_nosub === "musicfeeds.com.au" && domain.match(/^cdn[0-9]*/) && src.indexOf("/assets/uploads/")) ||
            (domain === "d13vpcwfpcq1p8.cloudfront.net" && src.indexOf("/contents/") >= 0) ||
            domain === "imagebox.cz.osobnosti.cz" ||
            (domain_nosub === "paperblog.fr" && domain.match(/^media[0-9]*\./)) ||
            (domain === "bikini.sbgefree.org" && src.indexOf("/files/") >= 0) ||
            (domain_nowww === "redbust.com" && src.indexOf("/stuff/") >= 0) ||
            domain === "img.providr.com" ||
            domain === "static.hiphopdx.com" ||
            amazon_container === "queerty-prodweb" ||
            domain === "static.timesofisrael.com" ||
            (domain_nowww === "hairstylesweekly.com" && src.indexOf("/images/") >= 0) ||
            (domain_nowww === "famousbirthsdeaths.com" && src.indexOf("/fbd-uploads/") >= 0) ||
            domain === "img.leaksx.com" ||
            (domain_nowww === "top10films.co.uk" && src.indexOf("/img/") >= 0) ||
            domain_nowww === "hotel-aramis.com" ||
            (domain === "dvfmubv4tjrqd.cloudfront.net" && src.indexOf("/uploads/") >= 0) ||
            amazon_container === "assets.whatson.cityofsydney.nsw.gov.au" ||
            domain === "static.hasselblad.com" ||
            (domain_nowww === "saywho.fr" && src.indexOf("/app/uploads/") >= 0) ||
            (domain_nowww === "talentandpartner.com" && src.indexOf("/data/uploads/") >= 0) ||
            domain === "files.vividscreen.info" ||
            (amazon_container === "lilianpacce" && src.indexOf("/media/") >= 0) ||
            (amazon_container === "chl-network" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "starkbros.com" && src.indexOf("/images/dynamic/") >= 0) ||
            (domain === "m.actve.net" && src.indexOf("/image/") >= 0) ||
            (domain === "d279m997dpfwgl.cloudfront.net" && src.indexOf("/wp/") >= 0) ||
            (domain_nowww === "telegraf.com.ua" && src.indexOf("/files/") >= 0) ||
            domain === "media.womanista.com" ||
            (domain_nowww === "jenny.gr" && src.indexOf("/storage/photos/") >= 0) ||
            (domain === "static.infomusic.ro" && src.indexOf("/media/") >= 0) ||
            (domain_nowww === "csiete.net" && src.indexOf("/contenido/imagenes/") >= 0) ||
            (domain_nowww === "wallpaper4rest.com" && src.indexOf("/wallpaper/") >= 0) ||
            (domain_nowww === "ichip.ru" && src.indexOf("/blobimgs/uploads/") >= 0) ||
            (domain_nowww === "pophaircuts.com" && src.indexOf("/images/") >= 0) ||
            (domain_nowww === "she12.com" && src.indexOf("/uploads/") >= 0) ||
            (domain === "cdn.stylefrizz.com" && src.indexOf("/img/") >= 0) ||
            (domain_nosub === "windows7themes.net" && src.indexOf("/wp-content/files/") >= 0) ||
            (domain === "quotes.whyfame.com" && src.indexOf("/files/") >= 0) ||
            (domain_nosub === "mozilla.org" && src.match(/:\/\/[^/]*\/files\/+[0-9]{4}\/+[0-9]{2}\/+/)) ||
            src.indexOf("/wp-content/blogs.dir/") >= 0 ||
            src.indexOf("/wp/wp-content/images/") >= 0 ||
            src.indexOf("/wp-content/photos/") >= 0 ||
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/-[0-9]*x[0-9]*\.([^/]*)$/, ".$1");
        }

        if ((domain === "store.pinseyun.com" && src.indexOf("/uploads/") >= 0) ||
            (domain === "media.coindesk.com" && src.indexOf("/uploads/") >= 0)) {
            return {
                url: src.replace(/-[0-9]*x[0-9]*\.([^/.]*)$/, ".$1"),
                can_head: false
            };
        }

        if (domain === "cdn.fashionmagazine.com") {
            return src.replace(/(\/+wp-content\/+uploads\/+[0-9]{4}\/+[0-9]{2}\/+[^/]*)-[0-9]+x[0-9]+-c-[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "cdn.heatworld.com" ||
            domain === "www.sohobluesgallery.com" ||
            domain === "i.vimeocdn.com" ||
            domain === "media.indiatimes.in" ||
            domain === "vcdn-ione.vnecdn.net" ||
            domain_nowww === "bangkokpost.com" ||
            (domain_nosub === "mensxp.com" && domain.match(/media[0-9]*\./) && src.indexOf("/media/") >= 0) ||
            domain === "221.132.38.109" ||
            domain === "i-ngoisao.vnecdn.net" ||
            (domain_nowww === "jpcoast.com" && src.indexOf("/img/") >= 0) ||
            domain === "pics.prcm.jp" ||
            (domain_nosub === "lprs1.fr" && domain.match(/s[0-9]*\.lprs1\.fr/)) ||
            domain === "m.wsj.net" ||
            domain === "img.lifestyler.co.kr" ||
            (domain_nosub === "eporner.com" && domain.match(/static-(?:[a-z]+-)?cdn\.eporner\.com/)) ||
            domain === "fototo.blox.pl" ||
            domain === "media.nvyouj.com" ||
            (domain === "cl.buscafs.com" && src.indexOf("/www.tomatazos.com/") >= 0) ||
            (domain === "tomatazos.buscafs.com" && src.indexOf("/uploads/images/") >= 0) ||
            (domain === "nisfeldunia.ahram.org.eg" && src.indexOf("/Media/") >= 0) ||
            domain === "d2t7cq5f1ua57i.cloudfront.net" ||
            domain === "image.ibb.co" ||
            domain === "socdn.smtown.com" ||
            (domain === "www.lecturas.com" && src.indexOf("/medio/") >= 0) ||
            (domain_nowww === "clara.es" && src.indexOf("/medio/") >= 0) ||
            domain === "images.anandtech.com" ||
            domain === "cdn.popbela.com" ||
            (domain_nosub === "lizhi.fm" && domain.match(/^cdnimg[0-9]*\./)) ||
            domain === "img.cf.47news.jp" ||
            domain === "static.filmin.es" ||
            (domain_nosub === "ropose.com" && domain.match(/^img[0-9]*\./)) ||
            domain === "resource.info.mn" ||
            (domain_nosub === "thegioitre.vn" && domain.match(/^image[0-9]*\./)) ||
            domain === "vcdn-giaitri.vnecdn.net" ||
            domain === "img.uduba.com" ||
            domain === "img.51ztzj.com" ||
            (domain === "mediaresources.idiva.com" && src.indexOf("/media/") >= 0) ||
            domain === "static.bangkokpost.com" ||
            ((domain_nowww === "lepoint.fr" || domain === "static.lpnt.fr") && src.indexOf("/images/") >= 0) ||
            (domain_nosub === "sdpnoticias.com" && domain.match(/^i[0-9]*\./)) ||
            domain === "images.cinefil.com") {
            newsrc = src.replace(/_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "mediaonlinevn.com") {
            src = src.replace(/-[0-9]*x[0-9]*(?:_[a-z])?\.([^/.]*)$/, ".$1");
        }

        if (src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/\(pp_w[0-9]+_h[0-9]+\)(\.[^/.]*)$/, "$1");
        }


        if (//domain.indexOf(".files.wordpress.com") >= 0 ||
            src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/__[0-9]{2,}(\.[^/.]*)$/, "$1");
        }

        if (src.indexOf("/wp-content/uploads/") >= 0 ||
            src.indexOf("/wp/uploads/") >= 0) {
            src = src.replace(/-[0-9]+x[0-9]+-c-default(\.[^/.]*)$/, "$1");
        }

        /*if (domain === "storage.journaldemontreal.com" ||
            domain === "storage.torontosun.com" ||
            domain === "storage.ottawasun.com") {
            return {
                url: src,
                head_wrong_contenttype: true
            };
        }*/

        if (domain === "pictures.ozy.com" ||
            domain_nowww === "retail-jeweller.com" ||
            domain === "d1nslcd7m2225b.cloudfront.net") {
            return src.replace(/(\/[Pp]ictures\/)[0-9any]+x[0-9any]+(?:[a-z]+)?\//, "$199999999x99999999/");
        }

        if (domain === "static.gofugyourself.com") {
            return src.replace(/-(?:[0-9]+x[0-9]+|compressed)(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain === "hips.hearstapps.com") {
            newsrc = src.replace(/.*hips\.hearstapps\.com\/([^/]+\.[^/]+)/, "http://$1");
            if (newsrc !== src)
                return newsrc;
            return src.replace(/\?[^/]*$/, "");
        }

        if (domain === "img.wennermedia.com") {
            return src.replace(/:\/\/img\.wennermedia\.com\/[^?#]*\/([^/]*)$/, "://img.wennermedia.com/$1");
        }

        if (domain_nosub === "forbesimg.com" && domain.indexOf("images.forbesimg.com") >= 0) {
            return {
                url: src.replace(/\/[0-9]*x[0-9]*\.([^/.?]*)(\?.*)?/, "/0x0.$1"),
                head_wrong_contentlength: true
            };
        }

        if (domain === "pixel.nymag.com") {
            return src
                .replace(/\/([^/.]*)(\.[^/]*)?\.([^/.]*)$/, "/$1.$3")
                .replace(/(\/slideshows\/.*\/[^/]*)\.[a-z](\.[^/.]*)\/[^/]*(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "assets.nydailynews.com" ||

            (domain_nosub === "nydailynews.com" && domain.match(/^static[0-9]*\./)) ||
            domain === "i.cbc.ca" ||
            domain === "cdn.newsday.com" ||
            domain_nowww === "stripes.com" ||
            domain_nowww === "irishtimes.com" ||
            domain_nowww === "ctvnews.ca" ||
            domain_nowww === "lancashirelife.co.uk" ||
            domain === "images.archant.co.uk" ||
            domain === "images.glaciermedia.ca" ||
            domain === "static.gulfnews.com" ||
            domain === "www.cp24.com" ||
            domain_nosub === "anandabazar.com" ||
            domain === "www.islingtongazette.co.uk" ||
            domain_nowww === "vrak.tv" ||
            domain === "images.haaretz.co.il" ||
            domain_nowww === "edp24.co.uk") {
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
            return src.replace(/(\/image\.[^_/]*_gen\/derivatives\/)[^/]*\//, "$1default/");
        }

        if (domain_nosub === "bbci.co.uk" &&
            domain.match(/ichef(?:-[0-9]*)?.bbci.co.uk/)) {
            newsrc = src.replace(/\/[0-9]+_[0-9]+\//, "/original/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/(\.[^/.]*)\/[0-9]+$/, "$1/0");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/(:\/\/[^/]*)\/images\/ic\/[0-9n]+x[0-9n]+\//, "$1/images/ic/raw/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/.*\.bbci\.co\.uk\/news\/[0-9]*\/(?:[^/]*\/)?media\//, "http://news.bbcimg.co.uk/media/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/:\/\/[^/]*\/food\/ic\/[^/]*\//, "://food-images.files.bbci.co.uk/food/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/\/images\/ic\/credit(\/[0-9]+x[0-9]+\/)/, "/images/ic$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/.*\/cpsprodpb\//, "https://c.files.bbci.co.uk/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/news\/[0-9]+\/[^/]*\//, "https://c.files.bbci.co.uk/");
            if (newsrc !== src)
                return newsrc;

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
            return urljoin(src, src.replace(/^[a-z]+:\/\/amp\.([^/]*)\/images\/([a-f0-9]+)-[0-9]+(?:-[0-9]+)?(\.[^/.]*)$/, "//static2.$1/image/$2/"));
        }

        if ((domain_nosub === "businessinsider.com" ||
             domain_nosub === "thisisinsider.com") &&
            domain.match(/^static[0-9]*\./)) {
            return src.replace(/(\/image\/[0-9a-f]+)(?:-[^/]*|\.[^/]*)?(?:\/.*)?$/, "$1/");
        }

        if (domain === "media.nbcwashington.com" ||
            domain === "media.nbcnewyork.com" ||
            domain === "media.graytvinc.com" ||
            domain === "media.telemundochicago.com" ||
            domain === "media.nbcdfw.com" ||
            domain === "media.nbcphiladelphia.com" ||
            domain === "media.nbcsandiego.com" ||
            domain === "media.heartlandtv.com" ||
            domain === "media.nbcmiami.com" ||
            domain === "media.nbcconnecticut.com" ||
            domain === "media.nbclosangeles.com" ||
            domain === "media.nbcboston.com" ||
            domain === "media.nbcbayarea.com" ||
            domain === "media.nbcchicago.com") {
            return src.replace(/\/images\/+[0-9]+\*[0-9]+\//, "/images/");
        }

        if (domain_nowww === "bet.com") {
            return src
                .replace(/\/(_jcr_content.*?\/[^/]*)\.custom[0-9]+fx[0-9]+fx[0-9]+xcrop\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.custom[0-9]+x[0-9]+\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.featured[0-9]+x[0-9]+\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.featuredlist\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.ampheroimage\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.feedcontainer\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.[^/.]*\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/")
                .replace(/\/(_jcr_content.*?\/[^/]*)\.relatedinline[0-9]+x[0-9]+\.([^/]*)\//, "/$1.custom0fx0fx0xcrop.$2/");
        }

        if ((domain_nosub === "cbsistatic.com" &&
             (domain.match(/^cbsnews[0-9]*\./) ||
              domain.match(/^dl[0-9]*\./) ||
              domain.match(/zdnet[0-9]*\./))) ||
            domain === "sportshub.cbsistatic.com" ||
            domain === "cimg.tvgcdn.net") {
            newsrc = src
                .replace(/\/resize\/[0-9a-z]*x[0-9a-z]*\//, "/")
                .replace(/\/crop\/[^/]*\//, "/")
                .replace(/\/thumbnail\/[^/]*\//, "/");
            if (newsrc !== src) {
                return {
                    url: newsrc,
                    head_wrong_contentlength: true
                };
            }
        }

        if (domain_nosub === "cbsistatic.com" &&
            domain.match(/cnet[0-9]*\.cbsistatic\.com/)) {
            return src.replace(/\/img\/[^/]*=\/(?:fit-in\/)?(?:[0-9]+x[0-9]+:[0-9]+x[0-9]+\/)?(?:[0-9]+x[0-9]+\/)?(.*)/, "/img/$1");
        }

        if (domain_nosub === "cbsstatic.com" &&
            domain.match(/wwwimage[0-9]*(?:-secure)?\.cbsstatic\.com/)) {
            return src
                .replace(/\/thumbnails\/([^/]*)\/[-a-z0-9:]*\//, "/thumbnails/$1/files/")
                .replace("/thumbnails/photos/files/", "/base/files/");
        }

        if (domain === "api.fidji.lefigaro.fr") {
            return src.replace("://api.fidji.lefigaro.fr/", "://i.f1g.fr/");
        }

        if (domain === "i.f1g.fr") {
            newsrc = src.replace(/.*i\.f1g\.fr\/media\/ext\/[^/]*\//, "http://");
            var newdomain = newsrc.replace(/^http:\/\/([^/]*)\/.*/, "$1");
            if (newsrc !== src &&
                newdomain !== "img.tvmag.lefigaro.fr")
                return newsrc;

            return src.replace(/\/media\/([a-z]*)\/[^/]*\//, "/media/$1/orig/");
        }

        if ((domain_nosub === "h-cdn.co" ||
             (domain_nosub === "cosmopolitan.nl" && domain.match(/h\.cdn\.cosmopolitan\./))) &&
            src.indexOf("/assets/") >= 0) {
            return src.replace(/\/[0-9]*x[0-9]*\//, "/");
        }

        if (domain === "imgix.ranker.com") {
            return src.replace(/\?[^/]*$/, "?fm=png");
        }

        if (domain_nosub === "rnkr-static.com" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/+((?:user_)?node_img\/+[0-9]+\/+[0-9]+)\/+[^/]*\/+([^/]*)\.[^/.]*(?:[?#].*)?$/,
                               "https://imgix.ranker.com/$1/original/$2?fm=png");
        }

        if (domain === "driftt.imgix.net" ||
            domain === "pathwright.imgix.net") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\.imgix\.net\/([^?]*).*?$/, "$1"));
        }

        if (domain === "data.whicdn.com") {
            return src.replace(/\/[^/.]*\.([^/.]*)$/, "/original.$1");
        }

        if (domain_nosub === "whicdn.com" && domain.match(/^data[0-9]*\./)) {
            return src.replace(/:\/\/data[0-9]*\./, "://data.");
        }

        if (domain === "cdn.empireonline.com") {
            return src.replace(/cdn\.empireonline\.com\/(?:jpg|png|gif)\/(?:[^/.]+\/){12}/, "cdn.empireonline.com/");
        }

        if (domain_nosub === "celebmafia.com" ||
            domain_nosub === "hawtcelebs.com") {
            return src.replace(/\/([^/]*)_thumbnail\.([^/.]*)$/, "/$1.$2");
        }

        if ((domain_nosub === "pixhost.org" ||
             domain_nosub === "pixhost.to") &&
            domain.match(/^[a-z]*[0-9]*\./)) {
            return src
                .replace(/(:\/\/[^/]*\.)pixhost\.org\//, "$1pixhost.to/")
                .replace(/\/t([0-9]*\.pixhost\.[a-z]*)\/thumbs\//, "/img$1/images/");
        }

        /*if (domain.indexOf("ssli.ulximg.com") >= 0) {
            return src.replace(/\/image\/[0-9]+x[0-9]+\//, "/image/full/");
        }*/

        if (domain_nosub === "ulximg.com" ||
            domain_nowww === "hotnewhiphop.com") {
            return src
                .replace(/\/image\/[0-9a-z]*x[0-9a-z]*\//, "/image/full/");
        }

        if (domain === "fm.cnbc.com") {
            return src.replace(/\.[0-9]+x[0-9]+\.([^/.]*)$/, ".$1");
        }

        if (domain === "images.bwwstatic.com" ||
            domain === "newimages.bwwstatic.com") {
            return src
                .replace(/\/tn-[0-9]+_([^/]*)$/, "/$1")
                .replace(/\/(?:[0-9]+)?x(?:[0-9]*)(?:x[0-9]+)?([^/]*)\.pagespeed\.[^/]*(?:[?#].*)?$/, "/$1");
        }

        if (domain.indexOf("img.rasset.ie") >= 0 && false) {
            return src.replace(/(\/[^/]*)-[0-9]*(\.[^/.]*)$/, "$1-9999$2");
        }

        if (domain === "i.pinimg.com" ||
            (domain_nosub === "pinimg.com" && domain.match(/^(?:i|media-cache)-[^.]*\.pinimg/)) ||
            amazon_container === "media.pinterest.com") {
            src = src.replace(/[?#].*$/, "");

            if (src.match(/:\/\/[^/]*\/media\.pinterest\.com\//))
                newsrc = src.replace(/(:\/\/[^/]*\/media\.pinterest\.com\/)[^/]*(\/.*\/[^/]*\.[^/.]*)$/, "$1originals$2");
            else
                newsrc = src.replace(/(:\/\/[^/]*\/)[^/]*(\/.*\/[^/]*\.[^/.]*)$/, "$1originals$2");

            if (newsrc !== src) {
                return add_extensions_gif(newsrc);
            }
        }

        if (domain_nosub === "condecdn.net" && domain.indexOf("images.condecdn.net") >= 0) {
            return src.replace(/(\/image\/[^/]*\/).*/, "$1original/");
        }

        if (domain === "media.fromthegrapevine.com" ||
            (domain_nowww === "gretschpages.com" && src.indexOf("/media/img/") >= 0) ||
            (domain_nowww === "pornstars.me" && src.indexOf("/media/") >= 0) ||
            domain_nowww === "mediavillage.com") {
            return src.replace(/\/([^/.]*\.[^/.]*)\.[^/.]*\.[^/.]*$/, "/$1");
        }

        if (domain_nosub === "acsta.net" && domain.search(/img[0-9]*\.acsta\.net/) >= 0) {
            newsrc = src.replace(/acsta\.net\/[^/]*\/pictures\//, "acsta.net/pictures/");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/\/[rc]_[0-9]+_[0-9]+\//, "/");
        }

        if (domain === "em.wattpad.com") {
            return src.replace(/.*\.wattpad\.com\/[a-f0-9]*\/([a-f0-9]*).*/, "$1").replace(/([0-9A-Fa-f]{2})/g, function() {
                return String.fromCharCode(parseInt(arguments[1], 16));
            });
        }

        if (domain_nosub === "nocookie.net" &&
            domain.match(/^vignette[0-9]*\.wikia\./)) {
            return src
                .replace(/\/revision\/([^/]*)\/.*?(\?.*)?$/, "/revision/$1/$2")
                .replace(/^http:\/\//, "https://");
        }

        if (domain === "static.asiachan.com") {
            return src
                .replace(/(\/[^/]*\.)[0-9]*(\.[0-9]*\.[^/.]*$)/, "$1full$2")
                .replace(/(:\/\/[^/]*\/)[0-9]+(\/[0-9]+\/[0-9]+\/[0-9]+\.[^/.]*)$/, "$1full$2");
        }

        if (domain === "pic.xiami.net" ||
            domain === "club-img.kdslife.com" ||
            domain === "p0.meituan.net" ||
            domain === "img.sdxapp.com") {
            return src.replace(/@[^/]*$/, "");
        }

        if ((domain_nosub === "yinyuetai.com" && domain.match(/^img[0-9]*\.c\.yinyuetai\.com/)) ||
            (domain_nosub === "yytcdn.com" && domain.match(/^img[0-9]*\./))) {
            return src.replace(/[0-9]+x[0-9]+(\.[^/.]*)$/, "0x0$1");
        }

        if (domain.search(/mp[0-9]*\.qiyipic\.com/) >= 0 && src.indexOf("/passport/") < 0) {
            return src.replace(/[0-9]*_[0-9]*(\.[^/.]*)$/, "0_0$1");
        }

        if (domain === "b-ssl.duitang.com") {
            return src.replace(/\.thumb\.[0-9]+_[0-9]+\./, ".");
        }

        if (domain_nosub === "vcimg.com" &&
            domain.match(/i-[0-9]\.vcimg.com/)) {
            return src.replace(/\/(?:crop|trim)\//, "/").replace(/(\/[0-9a-f]+)\([0-9]+x(?:[0-9]+)?\)\//, "$1/");
        }

        if (domain_nosub === "zhimg.com" &&
            domain.match(/pic[0-9]\.zhimg\.com/)) {
            return src.replace(/_[^/._]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.hb.aicdn.com" ||
            domain_nosub === "upaiyun.com") {
            return {
                url: src.replace(/_[^/_]*$/, ""),
                headers: {
                    "Referer": ""
                }
            };
        }

        if (domain === "imagev2.xmcdn.com") {
            return src.replace(/![^/]*$/, "").replace(/(\/[^/]*?)(?:_[a-z_]+)?(\.[^/.]*)$/, "$1$2");
        }

        if ((domain_nosub === "bdimg.com" || domain_nosub === "baidu.com") &&
            (domain.match(/timg.*?\.bdimg\.com/) ||
             domain.match(/timg.*?\.baidu\.com/))) {
            newsrc = decodeURIComponent(src.replace(/.*\/[^/]*[?&]src=([^&]*).*/, "$1"));
            if (newsrc !== src)
                return newsrc;
        }

        if ((domain_nosub === "bdstatic.com" ||
             domain_nosub === "baidu.com") &&
            domain.match(/gss[0-9]*\./)) {
            if (src.indexOf("/timg?") >= 0) {
                return {
                    url: decodeURIComponent(src.replace(/.*?\/timg.*?[?&]src=([^&]*).*/, "$1")),
                    head_wrong_contenttype: true
                };
            }

            if (src.indexOf("/sign=") >= 0 ||
                src.indexOf("/pic/item/") >= 0) {
                return {
                    url: src.replace(/:\/\/[^/]*\/[^/]*\//, "://imgsrc.baidu.com/"),
                    head_wrong_contenttype: true
                };
            }
        }

        if (domain === "imgsrc.baidu.com" ||
            (domain_nosub === "baidu.com" && domain.match(/^(?:[a-z]\.)?hiphotos\./)) ||
            domain === "imgsa.baidu.com") {
            newsrc = decodeURIComponent(src.replace(/.*\/[^/]*[?&]src=([^&]*).*/, "$1"));
            if (newsrc !== src)
                return newsrc;

            newsrc = src
                .replace("/abpic/item/", "/pic/item/")
                .replace(/\/[^/]*(?:=|%3D)[^/]*\/sign=[^/]*\//, "/pic/item/");
            return {
                url: newsrc,
                head_wrong_contenttype: true
            };
        }

        if (domain_nosub === "baidu.com" && domain.indexOf("himg.baidu.com") >= 0) {
            return src.replace(/\/sys\/[^/]*\/item\//, "/sys/original/item/");
        }

        /*if (domain.search(/p[0-9]*\.xiaohx\.net/) >= 0) {
            return src.replace("/thumb/", "/");
        }*/

        if (domain_nosub === "doubanio.com" &&
            domain.match(/^img[0-9]*\./)) {
            newsrc = src
                .replace(/\/[a-z]+(\/public\/[a-f0-9]+\.[^/.]*)$/, "/raw$1")
                .replace(/\/(?:small|medium)\//, "/large/")
                .replace(/\/[a-z]pic\//, "/opic/")
                .replace(/\/+img\/+([^/]*)\/+[^/]*\/+([0-9]+[^/]*)(?:[?#].*)?$/,
                         "/pview/$1/raw/public/p$2");

            if (newsrc !== src)
                return newsrc;

            if (src.match(/\/+view\/+([^/]*)\/+[^/]*\/+/)) {
                newsrc = src.replace(/\/+view\/+([^/]*)\/+[^/]*\/+/, "/pview/$1/raw/");

                if (newsrc !== src)
                    return add_extensions(newsrc.replace(/\.webp(?:[?#].*)?$/, ".jpg"));
            }
        }

        if (domain === "img.idol001.com") {
            return src
                .replace(/^(.*?idol001\.com\/)[^/]*\//, "$1origin/")
                .replace(/(\/[0-9a-f]+)_watermark(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "image-api.nrj.fr" &&
            src.indexOf("/http/") >= 0) {
            return "http://" + decodeURIComponent(src.replace(/.*\.nrj\.fr\/http\/([^/?&]*).*/, "$1"));
        }

        if (domain_nowww === "norwalkreflector.com" &&
            src.indexOf("/image/") >= 0) {
            return src.replace(/(\/image\/[0-9]*\/[0-9]*\/[0-9]*\/)[^/]*\/([^/]+)$/, "$1$2");
        }

        if (domain === "assets.bwbx.io") {
            return src.replace(/\/[0-9]*x(-[0-9]*\.[^/]*)$/, "/-1x$1");
        }

        if (domain === "file.osen.co.kr") {
            newsrc = src.replace(/\/article_thumb\/+([0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[0-9]+(?:_[^/._]*)?)_[0-9]+x(?:[0-9]+)?(\.[^/.]*)(?:[?#].*)?$/,
                                 "/article/$1$2");
            if (newsrc !== src)
                return newsrc;

            return src
                .replace("/article_thumb/", "/article/")
                .replace(/\/article\/+([0-9]{4})\//, "/article/original/$1/")
                .replace(/_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "thumbnews.nateimg.co.kr") {
            return src.replace(/.*\/(?:view|m?news)[0-9]*\//, "");
        }

        if (domain === "thumb.pann.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[^/]*\//, "");
        }

        if (domain_nosub === "nate.com" && domain.indexOf(".video.nate.com") >= 0) {
            return src.replace(/\/img\/thumb\/[0-9]+[^/]*\//, "/img/");
        }

        if (false && domain.indexOf("img.sedaily.com") >= 0) {
            return src.replace(/(\/[0-9]*)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "stat.ameba.jp" ||
            domain === "stat.profile.ameba.jp") {
            return src.replace(/\/t[0-9]*_([^/]*)$/, "/o$1");
        }

        if (domain_nosub === "blogimg.jp" ||
            domain === "image.news.livedoor.com") {
            return src.replace(/(\/[^/.]*)-[^/.]*(\.[^/.]*)/, "$1$2");
        }

        if (domain === "image.cine21.com") {
            return src
                .replace("/resize/", "/")
                .replace(/\/(?:small|medium)(\/[^/]*)$/, "/large$1")
                .replace(/\?.*$/, "")
                .replace(/\[[WH][-0-9]*\](\.[^/.]*)$/, "$1")
                .replace(/\[[XF][0-9]+,[0-9]+\](\.[^/.]*)$/, "$1");
        }

        if (domain === "cdnimg.melon.co.kr" ||
            domain === "image.melon.co.kr" ||
            domain === "cmtimg.melon.co.kr"/* &&
            (src.indexOf("/images/") >= 0 ||
             src.indexOf("/image/") >= 0 ||
             src.indexOf("/user_images/") >= 0)*/) {




            newsrc = src.replace(/(\.[a-zA-Z]+)\/melon\/.*/, "$1");
            if (newsrc !== src)
                return newsrc;

            if (src.indexOf("/images/main/") >= 0) {
                return src.replace(/(images\/.*\/[^/_]*)((_[^/.]*)_)?(_?[^/._]*)?(\.[^/.?]*)(?:[?/].*)?$/, "$1$3$5");
            } else {
                return src.replace(/(images\/.*\/[^/_]*)((_[^/.]*)_)?(_?[^/._]*)?(\.[^/.?]*)(?:[?/].*)?$/, "$1$3_org$5");
            }
        }

        if (domain_nosub === "mzstatic.com" && domain.match(/is[0-9](-ssl)?\.mzstatic\.com/) &&
            src.indexOf("/image/thumb/") >= 0) {
            return src.replace(/\/[0-9]*x[0-9]*[a-z]*(?:-[0-9]+)?(\.[^/.]*)$/, "/999999999x0w$1");
        }

        if (domain_nosub === "alicdn.com" &&
            (domain.match(/[0-9]*\.alicdn\.com/) ||
             domain === "img.alicdn.com")) {
            return src
                .replace(/_[0-9]+x[0-9]+[^/]*?$/, "")
                .replace(/\.[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1")
                .replace(/\?.*/, "");
        }

        if (domain_nosub === "1818lao.com" &&
            domain.match(/^i[0-9]*\./)) {
            return src.replace(/:\/\/[^/]*\/aliexpress[0-9]*(\/kf\/)/, "://ae01.alicdn.com$1");
        }

        if (domain === "thumbor.forbes.com") {
            return decodeURIComponent(src.replace(/.*\/([^/]*%3A%2F%2F[^/]*).*/, "$1"));
        }

        if (domain === "lastfm-img2.akamaized.net") {
            return src.replace(/\/i\/u\/[^/]*\//, "/i/u/");
        }

        if (domain_nosub === "myspacecdn.com" &&
            domain.match(/a[0-9](?:\...)?-images\.myspacecdn\.com/)) {
            return src.replace(/\/[^/.]*(\.[^/.]*)$/, "/full$1");
        }

        if (domain === "geo-media.beatport.com") {
            return src.replace(/\/image_size\/[0-9]*x[0-9]*\//, "/image_size/0x0/");
        }

        if (domain_nosub === "tumblr.com" &&
            domain.indexOf("media.tumblr.com") > 0) {

            newsrc = src
                .replace(/\.pnj(\?.*)?$/, ".png$1")
                .replace(/\.gifv(\?.*)?$/, ".gif$1");
            if (newsrc !== src)
                return newsrc;

            if (!src.match(/_[0-9]*\.gif$/))
                return src.replace(/(\/tumblr(?:_(?:static|inline))?_[0-9a-zA-Z]+(?:_r[0-9]*)?)_[0-9]*(\.[^/.]*)$/, "$1_1280$2");

            if (src.match(/:\/\/[^/]*\/[0-9a-f]*\/tumblr_[0-9a-zA-Z]+(?:_r[0-9]+)?_[0-9]+\.[^/]*$/) && false) {
                return src
                    .replace(/:\/\/[^/]*\/(.*)_[0-9]*(\.[^/.]*)$/, "://s3.amazonaws.com/data.tumblr.com/$1_raw$2");
            } else if (src.match(/:\/\/[^/]*\/[^/]*$/)) {
                if (!src.match(/_[0-9]*\.gif$/)) // disable gif support as it's notoriously problematic
                    return src.replace(/_[0-9]*(\.[^/.]*)$/, "_1280$1");
            }
        }

        if (domain === "wc-ahba9see.c.sakurastorage.jp" && false) {
            if (src.indexOf("/max-1200/") >= 0) {
                return {
                    url: src.replace(/-[0-9a-z]+(\.[^/.]*)$/, "-1200$1"),
                    can_head: false
                };
            } else {
                return {
                    url: src.replace(/-[0-9a-z]+(\.[^/.]*)$/, "-3000$1"),
                    can_head: false,
                    headers: {
                        Referer: ""
                    }
                };
            }
        }

        if (domain === "www.nautiljon.com" &&
            src.match(/\/images[a-z]*\//)) {
            return src
                .replace(/\/imagesmin\//, "/images/")
                .replace(/\/images\/[0-9]+x[0-9]+\//, "/images/")
                .replace(/\/mini\/([^/]*)$/, "/$1")
                .replace(/(\/[0-9]+\/[0-9]+\/)[a-z]+\/([^/]*)$/, "$1$2");
        }


        if (domain === "art.wsj.net") {
            if (src.indexOf("/api/photos/gams-files/") >= 0) {
                return src.replace(/\/gams-files\/[^-_/.]*-[^-_/.]*_([^/_.]*)_.*$/, "/gams-id:$1");
            }

            if (src.indexOf("/api/photos/gams-id:") >= 0) {
                return src.replace(/(\/gams-id:[^/]*)\/.*$/, "$1");
            }
        }

        if (domain_nosub === "fanpop.com" &&
            domain.match(/images[0-9]*\.fanpop\.com/)) {
            return src
                .replace(/([0-9]+)-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1$2")
                .replace(/([0-9]+)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "image.jimcdn.com") {
            return src.replace(/(\/app\/cms\/image\/transf\/)[^/]*\//, "$1none/");
        }

        if (false && domain === "u.jimdo.com") {
            return src.replace(/:\/\/[^/]*\/www[0-9]*\/[a-z]\/([0-9a-z]+)\/img\/(i[0-9a-f]+)\/([0-9]+)\/[^/]*\/([^/]\.[^/.]*)$/,
                               "://image.jimcdn.com/app/cms/image/transf/none/path/$1/image/$2/version/$3/$4");
        }

        if (domain_nosub === "ladmedia.fr" &&
            (domain.match(/resize[0-9]*-[a-z]*\.ladmedia\.fr/) ||
             domain.match(/cdn[0-9]*-[a-z]*\.ladmedia\.fr/))) {
            return {
                url: src
                    .replace(/\/(?:r|crop|rcrop)\/[^/]*\//, "/")
                    .replace(/:\/\/resize[0-9]*-([a-z]+)[^/]*?\/img\/var\//, "://cdn-$1.ladmedia.fr/var/")
                    .replace(/_[a-z0-9_]+(\.[^/.]*)$/, "$1"),
                can_head: true
            };
        }

        if (domain_nosub === "imgbox.com" &&
            (domain.match(/^thumbs[0-9]*\./) ||
             domain.match(/images[0-9]*\./))) {
            return src
                .replace(/\/thumbs([0-9]*)\.imgbox\.com\//, "/images$1.imgbox.com/")
                .replace(/_[a-z]*(\.[^/.]*)/, "_o$1");
        }

        if ((domain_nosub === "steamstatic.com" && domain.match(/cdn\.[^.]*\.steamstatic\.com/)) ||
            (domain_nosub === "akamaihd.net" && domain.match(/steamcdn(?:-[a-z]*)?\.akamaihd\.net/))) {
            if (src.indexOf("/public/images/avatars/") >= 0) {
                src = src.replace(/(?:_[^/.]*)?(\.[^/.]*)$/, "_full$1");
            }
            return src.replace(/\.[0-9]+x[0-9]+(\.[^/]*)$/, "$1");
        }

        if (domain_nosub === "medium.com" &&
            (domain.match(/cdn-images-[0-9]*\.medium\.com/) ||
             domain === "miro.medium.com")) {
            return src.replace(/(:\/\/[^/]*\/).*?\/([^/]*)$/, "$1$2");
        }

        if ((domain_nosub === "zimbio.com" ||
             domain_nosub === "stylebistro.com" ||
             domain_nosub === "livingly.com") &&
            domain.match(/www[0-9]*\.pictures\.(.*\.)?[a-z]+\.com/)) {
            return src.replace(/[a-z](\.[^/.]*)$/, "x$1");
        }

        if (domain_nowww === "theplace2.ru" ||
            domain_nowww === "theplace.ru" ||
            domain === "image.chaojimote.com" ||
            domain === "moviepic.manmankan.com" ||
            domain === "img.star.iecity.com") {
            newsrc = src.replace(/_[a-z](\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "theplace2.ru" ||
            domain_nowww === "theplace.ru") {
            return src.replace(/(:\/\/[^/]*\/)cache\/(.*?)-g[^/.]*(\.[^/.]*)/, "$1$2$3");
        }

        if ((domain_nosub === "craveonline.com" && domain.match(/cdn[0-9]*-www\.craveonline\.com/)) ||
            domain_nowww === "legswiki.com" ||
            (domain_nosub === "mandatory.com" && domain.match(/^cdn[0-9]*-www\./)) ||
            domain_nowww === "indiancinemagallery.com" ||
            (domain_nowww === "allwomensites.com" && src.indexOf("/gallery/") >= 0) ||
            domain_nowww === "zemanceleblegs.com" ||
            (domain_nosub === "dogtime.com" && domain.match(/cdn[0-9]*-www\.dogtime\.com/))) {
            return src.replace("/thumbs/thumbs_", "/");
        }

        if (domain === "static.tvgcdn.net") {
            return src
                .replace("/smallcrops/", "/")
                .replace("/thumbs/", "/")
                .replace(/sm(\.[^/.]*)$/, "$1")
                .replace(/_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "blogcdn.com") {
            return src
                .replace(/(\/S[0-9]+\/)[a-z](\.[^/.]*)$/, "$1l$2")
                .replace(/\/slug\/[a-z]\//, "/slug/l/");
        }

        if (domain === "photos.imageevent.com") {
            return src.replace(/\/(?:small|large|huge|giant|icons)\/([^/]*)$/, "/$1");
        }

        if (domain === "image.ajunews.com") {
            return src.replace(/_[0-9]*_[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "telegraph.co.uk" &&
            (domain === "www.telegraph.co.uk" ||
             domain.indexOf("aws.telegraph.co.uk") >= 0 ||
             domain === "subscriber.telegraph.co.uk")) {
            return src.replace(/-(?:x*(?:large|medium|small))(_[^/]*)?(\.[^/.]*$)$/, "$1$2");
        }

        if (false && (domain === "i.telegraph.co.uk" ||
                      domain === "secure.i.telegraph.co.uk")) {
        }

        if (domain === "image.munhwa.com") {
            return src.replace("/gen_thumb/", "/gen_news/").replace(/_[^/._]*(\.[^/.]*$)/, "_b$1");
        }

        if (domain_nosub === "dspmedia.co.kr") {
            return src.replace(/(\/file\/[^/]*\/)thumb_[0-9]*x[0-9]*[^/]*\//, "$1");
        }

        if (domain === "static.wixstatic.com" ||
            domain_nosub === "wixmp.com") {
            newsrc = src.replace(/(:\/\/[^/]*\/)(f\/+[-0-9a-f]{36}\/+.*?)[?&]token=.*$/, "$1intermediary/$2");
            if (newsrc !== src)
                return {
                    url: newsrc,
                    likely_broken: true
                };

            if (!src.match(/[?&]token=.{30,}/)) {
                newsrc = src
                    .replace(/(\.[^/.]*)\/v1\/.*/, "$1")
                    .replace(/(\/[^/.]*\.[^/.]*?)_[_0-9.a-z]*$/, "$1");

                if (newsrc !== src)
                    return newsrc;
            }
        }

        if (domain_nosub === "wixmp.com" &&
            options && options.do_request && options.cb) {
            match = src.match(/^[a-z]+:\/\/(?:images-)?wixmp-[0-9a-f]+\.wixmp\.com\/+(?:intermediary\/+)?[^/]*\/+[-0-9a-f]+\/+([0-9a-z]+)-[-0-9a-f]+\.[^/.]+(?:\/+v[0-9]*\/.*?)?(?:[?#].*)?$/);
            if (match) {
                id = match[1];
                options.do_request({
                    url: "http://fav.me/" + id,
                    method: "GET",
                    onload: function(result) {
                        if (result.status !== 200) {
                            options.cb({
                                url: null,
                                waiting: false
                            });
                            return;
                        }

                        var fake_deviantart_image = {
                            url: "http://img.deviantart.net/fake_image/i/0000/000/0/0/_fake_image-" + id + ".jpg",
                            fake: true
                        };
                        var obj = [fake_deviantart_image, {
                            url: src,
                            extra: {
                                page: result.finalUrl
                            }
                        }];

                        options.cb(obj);
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nosub === "kukinews.com" ||
            domain === "www.inews365.com" ||
            domain_nowww === "newsinstar.com" ||
            domain === "www.artkoreatv.com" ||
            domain === "www.ddaily.co.kr") {
            return src
                .replace(/\/data\/cache\/public\//, "/data/")
                .replace(/_[0-9]+x[0-9]+(?:_c[0-9]*)?\.([^/.]*)/, ".$1");
        }

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
            (domain_nosub === "imgspice.com" && domain.match(/^img[0-9]*\./)) ||
            (domain_nosub === "pixroute.com" && domain.match(/img[0-9]*\./))) {
            return src.replace(/(\/i\/.*\/[^/.]*)_t(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "imagetwist.com" && src.match(/:\/\/[^/]*\/error\.[^/.]*(?:[?#].*)?$/)) {
            return {
                url: src,
                bad: true
            };
        }

        if ((domain_nosub === "imagetwist.com" ||
             domain_nosub === "picshick.com") &&
            domain.match(/i(?:mg)?[0-9]*\./)) {

            id = src.replace(/^([a-z]+:\/\/)(?:[^/.]*\.)?([^/.]+\.[^/.]+\/)th\/+[0-9]+\/+([0-9a-z]+)(?:\.[^/.].*)?$/,
                             "$1$2$3");
            console_log(id);
            if (id !== src && options && options.cb && options.do_request) {
                options.do_request({
                    method: "GET",
                    url: id,
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match =resp.responseText.match(/<a\s+href=["'](https?:\/\/.*?)["'][^>]*\sdownload>/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }

            return {
                url: src.replace(/\/th\//, "/i/"),
                headers: {
                    Referer: src.replace(/:\/\/(?:[^/]*\.)?([^/.]*\.[^/.]*)\/.*/, "://$1/"),
                    Origin: src.replace(/:\/\/(?:[^/]*\.)?([^/.]*\.[^/.]*)\/.*/, "://$1/"),
                    "Sec-Metadata": "destination=image, site=same-site"
                }
            };
        }

        if (domain === "www.theactuary.com") {
            return src.replace(/getresource\.axd\?.*(AssetID=[0-9]*).*/, "getresource.axd?$1");
        }

        if (domain === "static.new-magazine.co.uk" ||
            amazon_container === "star-magazine.co.uk") {
            return src.replace(/(\/prod\/media\/images\/)[^/]*\//, "$1original/");
        }

        if (domain === "www.irishexaminer.com" ||
            domain === "www.breakingnews.ie" ||
            domain === "ip.index.hr" ||
            domain === "ip.trueachievements.com") {
            newsrc = src.replace(/.*:\/\/[^/]*\/remote\/([^?]*).*/, "$1");
            if (newsrc !== src)
                return "http://" + decodeURIComponent(newsrc);
        }

        if ((domain === "tellymix-spykawebgroup.netdna-ssl.com" ||
             domain_nosub === "tellymixcdn.com") &&
            src.match(/:\/\/[^/]*\/+ts\//)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/+ts\/+[0-9]*\/+[0-9]*\/+/, "http://");
        }

        if (domain === "assets.goodhousekeeping.co.uk") {
            return src.replace(/(\/(?:embedded|galleries)\/+(?:[0-9]*\/+)[^/]*)__[^/.]*(\.[^/]*)$/, "$1$2");
        }

        if ((domain === "www.femalefirst.co.uk" ||
             domain === "www.malextra.com") &&
            src.indexOf("/image-library/") >= 0 && false) {
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
            return src
                .replace(/_big(\.[^/.]*)$/, "_dblbig$1")
                .replace(/_wide(\.[^/.]*)$/, "_dblbig$1")
                .replace(/_dblwide(\.[^/.]*)$/, "_dblbig$1");
        }

        if (domain === "www.thegenealogist.co.uk") {
            return src.replace("/images/featuredarticles/header_sm/", "/images/featuredarticles/header_lg/");
        }

        if (domain === "251d2191a60056d6ba74-1671eccf3a0275494885881efb0852a4.ssl.cf1.rackcdn.com" ||
            domain === "8583b52b4a309671f69d-b436b898353c7dc300b5887446a26466.ssl.cf1.rackcdn.com" ||
            domain === "2e0a24317f4a9294563f-26c3b154822345d9dde0204930c49e9c.ssl.cf1.rackcdn.com" ||
            domain === "7f9c61237bd6e732e57e-5fa18836a2ae6b5e7c49abcc89b20237.ssl.cf1.rackcdn.com" ||
            domain === "b6c18f286245704fe3e9-05e2055f4cd9122af02914269431c9f6.ssl.cf1.rackcdn.com" ||
            domain === "41dcdfcd4dea0e5aba20-931851ca4d0d7cdafe33022cf8264a37.ssl.cf1.rackcdn.com" ||
            domain === "575717b777ff8d928c6b-704c46a8034042e4fc898baf7b3e75d9.ssl.cf1.rackcdn.com" ||
            domain === "598d5fcf392acad97538-395e64798090ee0a3a571e8c148d44f2.ssl.cf1.rackcdn.com") {
            return src.replace(/(\/[^/.]*)_[a-z](\.[^/.?]*)(?:\?[^/]*)?$/, "$1$2");
        }

        if (domain === "be35832fa5168a30acd6-5c7e0f2623ae37b4a933167fe83d71b5.ssl.cf3.rackcdn.com") {
            return src.replace(/__hero(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain === "cdn.shopify.com") {
            return src.replace(/_(?:large|medium|small|grande|compact|[0-9]+x(?:[0-9]+)?)(?:@[0-9]+x)?(?:_crop_[a-z]+)?(?:\.progressive)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.itv.com") {
            return src.replace(/\/[a-z]*_([^/_]*)$/, "/$1");
        }

        if (domain === "thumbnailer.mixcloud.com") {
            return src.replace(/\/unsafe\/[0-9]+x[0-9]+\//, "/unsafe/0x0/");
        }

        if (domain === "d3mkh5naggjddw.cloudfront.net" ||
            domain === "img.blvds.com" ||
            domain === "resizer.mundotkm.com" ||
            domain === "d2isyty7gbnm74.cloudfront.net" ||
            domain === "thumb.connect360.vn" ||
            domain === "img.movietimes.com" ||
            domain === "t.t2online.co.in" ||
            domain === "thum.buzzni.com" ||
            (domain_nosub === "genius.com" && domain.match(/t[0-9]*\.genius\.com/))) {
            return add_http(decodeURIComponent(src
                                               .replace(/.*\/unsafe\/smart\/(?:filters:[^/]*\/)?/, "")
                                               .replace(/.*\/unsafe\/fit-in\/smart\//, "")
                                               .replace(/.*\/unsafe\/(?:fit-in\/)?(?:[0-9]*x[0-9]*\/)?(?:center\/)?(?:smart\/)?/, "")));
        }

        if (domain === "elsewhere.scdn3.secure.raxcdn.com") {
            return src.replace(/\/images\/[sv][0-9]+\/articles\//, "/images/downloads/articles/");
        }

        if (domain === "japantoday-asset.scdn3.secure.raxcdn.com") {
            return src.replace(/(\/+img\/+store\/+[0-9a-f]{2}\/+[0-9a-f]{2}\/+[0-9a-f]+\/+[^/]*)(?:\/+_[wh][0-9]+)?(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "static01.nyt.com" ||
            (domain_nosub === "nytimes.com" && domain.match(/^graphics[0-9]*\./)) ||
            domain === "cdn1.nyt.com") {
            var matched = src.match(/-([^-_/.]*?)(?:-v[0-9]*)?\.[^/.]*$/);
            if (matched) {
                if (matched[1] === "jumbo" ||
                    matched[1] === "thumbStandard" ||
                    matched[1] === "facebookJumbo" ||
                    matched[1] === "articleInline" ||
                    matched[1] === "articleLarge" ||
                    matched[1] === "sfSpan" ||
                    matched[1] === "videoLarge" ||
                    matched[1] === "thumbLarge" ||
                    matched[1].match(/^videoSixteenByNine(?:Jumbo)?[0-9]*/) ||
                    matched[1].match(/^mediumThreeByTwo[0-9]*/) ||
                    matched[1].match(/^watch[0-9]*$/) ||
                    matched[1].slice(0, 6) === "master" ||
                    matched[1].slice(0, 6) === "square" ||
                    matched[1].slice(0, 4) === "blog") {
                    newsrc = src.replace(/-[^-_/.]*(-v[0-9]*)?(\.[^/.]*)$/, "-superJumbo$1$2");
                    if (newsrc !== src) {
                        if (newsrc.match(/-v[0-9]*\.[^/.]*$/)) {
                            return [
                                newsrc,
                                newsrc.replace(/-v[0-9]*(\.[^/.]*)$/, "$1")
                            ];
                        } else {
                            return [
                                newsrc,
                                newsrc.replace(/-superJumbo(\.[^/.]*)$/, "-jumbo$1")
                            ];
                        }
                    }
                }
            }
        }

        if (domain === "render.fineartamerica.com") {
            return src.replace(/render\.fineartamerica\.com\/images\/rendered\/search\/print\/[^/]*(-[0-9]*)\/([^/]*)$/, "images.fineartamerica.com/images-medium-large$1/$2");
        }

        if (domain === "media.npr.org") {
            return src
                .replace(/(\/[^/]*)-[sc][0-9]*(?:-[sc][0-9]*)?(\.[^/.]*)/, "$1$2")
                .replace(/_[a-z]+-([a-f0-9]{30,})(\.[^/.]*)$/, "-$1$2");
        }

        if (domain_nosub === "pbsrc.com" && domain.match(/rs[0-9]*\.pbsrc\.com/)) {
            return src
                .replace(/rs([0-9]*)\.pbsrc\.com/, "i$1.photobucket.com")
                .replace(/\?.*/, "")
                .replace(/(?:~[^/.]*)?$/, "~original");
        }

        if (domain === "www.welt.de") {
            return src.replace(/-w[0-9]*(\/[^/]*)$/, "-w0$1");
        }

        if (domain === "cdn.baeblemusic.com") {
            return src.replace(/-[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "deviantart.net" &&
            domain.match(/t[0-9]*\.deviantart\.net/)) {
            return src.replace(/:\/\/.*?\.deviantart\.net\/.*?\/[0-9]*x[0-9]*\/[^/]*\/([^/]*)\/(.*)/, "://$1\.deviantart\.net/$2");
        }

        if (domain_nosub === "grazia.fr" && domain.match(/img[0-9]*\.grazia\.fr/) ||
            domain_nowww === "glamour.de" ||
            domain === "asia.nikkei.com" ||
            domain_nosub === "elle.co.jp" ||
            domain_nowww === "harpersbazaar.jp" ||
            domain_nowww === "fotogramas.es" ||
            domain_nosub === "ellegirl.jp" ||
            domain_nosub === "esquire.jp" ||
            domain === "img.25ans.jp" ||
            domain_nowww === "cosmopolitan.com.hk" ||
            domain_nowww === "elle.com.hk" ||
            domain_nosub === "vogue.de" ||
            (domain_nosub === "telestar.fr" && domain.match(/img[0-9]*\.telestar\.fr/)) ||
            domain_nowww === "haz.de" ||
            domain_nowww === "connexionfrance.com" ||
            (domain_nosub === "closermag.fr" && domain.match(/(?:img|file)[0-9]*\.closermag\.fr/))) {
            return src.replace(/(:\/\/[^/]*\/var\/+(?:[^/]*\/+)?storage\/+images\/+.*\/[^/]+?)(?:_[a-z][^-/.]*)?(\.[^/.?]*)(?:[?#].*)?$/, "$1$2");
        }

        if ((domain_nosub === "purepeople.com" ||
             domain_nosub === "purepeople.com.br" ||
             domain_nosub === "purebreak.com" ||
             domain_nosub === "purebreak.com.br" ||
             domain_nosub === "get-the-look.ca" ||
             domain_nosub === "hairstyle.com" ||
             domain_nosub === "puretrend.com") &&
            domain.match(/^static[0-9]*\./)) {
            return src.replace(/([-_])[0-9]+(?:x[0-9]+)?(-[0-9]\.[^/.]*)/, "$1999999999x0$2");
        }

        if (domain_nosub === "belezaextraordinaria.com.br" && domain.match(/^static[0-9]*\./)) {
            return src.replace(/([-_])(?:[0-9]+(?:x[0-9]+)?|(?:article|opengraph)_[^-/.]+)(-[0-9]\.[^/.]*)/, "$1article_news$2");
        }

        if (domain === "medias.unifrance.org") {
            return src.replace("/format_web/", "/format_page/");
        }

        if (domain_nosub === "lisimg.com" ||
            domain_nosub === "listal.com") {
            return src
                .replace(/:\/\/[^\./]*\.lisimg\.com\//, "://ilarge.lisimg.com/")
                .replace(/\/([^/]*)\.jpg$/, "/99999999999full.jpg");
        }

        if (domain_nosub === "lesinrocks.com") {
            return src.replace(/\/width-[0-9]*-height-[0-9]*/, "/width-0-height-0");
        }

        if (domain === "media.senscritique.com") {
            return src.replace(/\/[0-9]*_[0-9]*\/([^/]*)$/, "/0_0/$1");
        }

        if (domain === "www.franceinter.fr" ||
            domain === "cdn.radiofrance.fr") {
            return src.replace(/\/[0-9]+(?:x[0-9]+)?_([^/]*\.jpg)$/, "/$1");
        }

        if (domain === "www.vod.lu" &&
            src.indexOf("/media/cache/") >= 0) {

            return src.replace(/\/media\/cache\/(resolve\/)?[0-9]+x[0-9]+\//, "/media/cache/$19999999x9999999/");
        }

        if (domain === "1645110239.rsc.cdn77.org") {
            return src
                .replace(/\/image\/[a-z][0-9]+\//, "/image/") // to be repeated
                .replace(/\/image\/x[0-9]+x[0-9]+\//, "/image/")
                .replace(/\/([^/.]*)\.[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "diymag.com" &&
            src.indexOf("/media/img") >= 0) {
            return src.replace(/(\/media\/img\/.*\/)_[^/]*\/([^/]*)$/, "$1$2");
        }

        if (domain === "1.fwcdn.pl" && false) {
            return src.replace(/(\/[^/.]*)(?:\.[0-9]*)?(\.[^/.]*)$/, "$1.1$2");
        }

        if (domain === "www.semainedelacritique.com" &&
            src.indexOf("/ttimg-rsz") >= 0) {
            return urljoin(src, src.replace(/.*\/ttimg-rsz\?.*?src=([^&]*).*/, "$1"));
        }

        if (domain_nosub === "pmdstatic.net" && domain.match(/img\..*?pmdstatic\.net$/)) {
            return decodeURIComponent(src.replace(/.*?\.pmdstatic\.net\/fit\/([^/]*).*/, "$1").replace(/\./g, "%"));
        }

        if (domain === "photo.gala.fr") {
            return {
                url: src,
                head_wrong_contentlength: true
            };
        }

        if (domain === "cdn.cnn.com" ||
            (domain_nosub === "turner.com" && domain.match(/(?:i[0-9]*\.)?cdn\.turner\.com/))) {
            return {
                url: src.replace(/-(?:small|medium|large|exlarge|super|full|overlay|alt|tease|story-top|horizontal)(?:-(?:small|medium|large|exlarge|super|full|overlay|alt|tease))?(?:-(?:[0-9]+|gallery))?(\.[^/.]*)$/, "$1"),
                can_head: false
            };
        }

        if (domain === "ugc.kn3.net"/* &&
            src.indexOf("/i/origin/") >= 0*/) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/i\/[0-9a-z]+\//, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "media.shoko.fr" ||
            domain === "media.fan2.fr" ||
            domain === "media.melty.it" ||
            domain === "media.virginradio.fr" ||
            domain === "media.melty.fr") {
            return src
                .replace(/(:\/\/[^/]*)\/([^/]*?)-[^-/]*((?:-f[^/]*)?\.[^/.]*)$/, "$1/$2-redim$3")
                .replace(/(:\/\/[^/]*)\/([^/-]*?-[0-9]*-)[^/-]*(-f[^/]*)?\//, "$1/$2redim$3/");
        }

        if (domain_nosub === "vogue.fr" ||
            domain === "www.glamourparis.com" ||
            domain === "www.gqmagazine.fr") {
            src = src
                .replace("/images/thumbs/", "/images/");
            newsrc = src.replace(/(\.[^/._]*)_[^/]*$/, "$1");
            if (newsrc !== src)
                return newsrc;
            return src.replace(/_north_[0-9]*x(?:[0-9]+)?_(?:white|transparent)(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.culturacolectiva.com") {
            return src.replace(/-(?:high|medium|low)(\.[^/.]*)$/, "$1");
        }

        if ((domain_nosub === "reveliststatic.com" ||
             domain_nosub === "cafemomstatic.com") &&
            domain.match(/^ugc(?:-[0-9]*)?\./)) {

            return src.replace(/\/gen\/(?:constrain|crop|resize)\/[0-9]*\/[0-9]*\/[0-9]*\//, "/gen/full/");
        }

        if (domain === "static.giantbomb.com") {
            return src.replace(/\/uploads\/[^/]*\//, "/uploads/original/");
        }

        if (domain === "images.shazam.com") {
            return src.replace(/_s[0-9]+(\.[^/.]*)$/, "_s0$1");
        }

        if (domain_nosub === "ebayimg.com") {

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

        if ((domain_nosub === "ebaystatic.com" && domain.match(/thumbs[0-9]*\.ebaystatic\.com/)) ||
            domain === "securethumbs.ebay.com") {
            newsrc = src
                .replace(/^[a-z]*:\/\/[^/]*\/(.*?)\/[0-9]+(\.[^/.]*)$/, "https://ssli.ebayimg.com/images/$1/s-l9999$2")
                .replace(/^[a-z]*:\/\/[^/]*\/d\/l[0-9]+\/([a-z]\/[^/]*)(\.[^/.]*)$/, "https://ssli.ebayimg.com/images/$1/s-l9999$2");
            if (newsrc !== src) {
                return newsrc;
            }

            newsrc = src.replace(/\/d\/[a-z][0-9]+\/pict\//, "/d/l9999/pict/");
            if (newsrc !== src) {
                return {
                    url: src.replace(/\/d\/[a-z][0-9]+\/pict\//, "/d/l9999/pict/"),
                    can_head: false // it just hangs
                };
            }
        }

        if (domain === "www.picclickimg.com") {
            return src
                .replace(/:\/\/www.picclickimg.com\/d\//, "://thumbs.ebaystatic.com/d/")
                .replace(/:\/\/www.picclickimg.com(\/[0-9]+\/s\/)/, "://i.ebayimg.com$1");
        }

        if (domain_nowww === "ezcorporateembroidery.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/packs\/images[a-z]+\/(https?:\/\/)/, "$1");
            if (newsrc !== src)
                return newsrc;
            return src.replace(/^[a-z]+:\/\/[^/]*\/images\/scale\/([a-z][0-9]+\/)/, "https://securethumbs.ebay.com/d/$1");
        }

        if (domain_nowww === "dealsanimg.com") {
            return src.replace(/^[a-z]+:\/\/(?:www\.)?dealsanimg\.com\/d\//, "https://securethumbs.ebay.com/d/");
        }

        if (domain === "i.slkimg.com") {
            return src
                .replace(/\/fill\/[0-9]+,[0-9]+\//, "/")
                .replace(/[0-9]+(\.[^/.]*)$/, "999999999$1");
        }

        if (domain === "i.vimeocdn.com" &&
            src.indexOf("/filter/overlay") >= 0) {
            return decodeURIComponent(src.replace(/.*\/overlay\?.*?src0=([^&]*).*/, "$1"));
        }

        if (domain === "imagelab.nownews.com") {
            return decodeURIComponent(src.replace(/.*[/?&]src=(.*)$/, "$1"));
        }

        if (domain === "cdn.discordapp.com") {
            return src.replace(/\?size=[0-9]*$/, "?size=2048");
        }

        if (domain_nosub === "discordapp.net" && domain.match(/images-ext-[0-9]*\.discordapp\.net/)) {
            return decodeURIComponent(src.replace(/.*\/external\/[^/]*\/(?:([^/]*)\/)?(https?)\/(.*?)(?:\?[^/]*)?$/, "$2://$3$1"));
        }

        if (domain === "hot-korea.net") {
            return src.replace(/\/uploads\/([^/]*\/)thumbs\//, "/uploads/$1");
        }

        if (domain_nosub === "sndcdn.com" && domain.match(/i[0-9]*\.sndcdn\.com/)) {
            return src.replace(/-[^-/.]*(\.[^/.]*)$/, "-original$1");
        }

        if (domain === "media.licdn.com") {
            return src.replace(/\/shrinknp_[0-9]+_[0-9]+\//, "/");
        }

        if ((domain_nosub === "townnews.com" && domain.match(/bloximages\..*vip\.townnews\.com/)) ||
            amazon_container === "syd.cdn.coreweb.com.au") {
            return src.replace(/^(.*?:\/\/)[^/]*\//, "http://");
        }

        if (domain_nosub === "psbin.com" && domain.match(/cdn[^.]*\.psbin\.com/)) {
            return {
                url: src.replace(/\/img\/[^/]*=[^/]*\//, "/img/"), // repeated
                head_wrong_contentlength: true
            };
        }

        if (domain === "wac.450f.edgecastcdn.net") {
            return src.replace(/^(.*?:\/\/)[^/]*\/80450F\//, "http://");
        }

        if (domain === "gp1.wac.edgecastcdn.net") {
            return src.replace(/(\/images\/[0-9]*\/[^/]*\/)[^/]*:[^/]*\//, "$1"); // repeated
        }

        if (domain === "www.century21.com") {
            return src.replace(/.*?\/photo\/[0-9a-z]*x[0-9a-z]*\//, "http://");
        }

        if (domain === "cdn.instructables.com") {
            return src.replace(/(:\/\/[^/]*\/)(.*)\.[^/.]*(\.[^/.]*)$/, "$1ORIG/$2$3");
        }

        if (domain_nosub === "pressreader.com" && domain.match(/cdn[0-9]*-img\.pressreader\.com/)) {
            return src.replace(/getimage\.aspx[^/]*[?&](regionKey=[^&]*).*$/, "getimage.aspx?$1");
        }

        if (domain === "layfielddesign.com") {
            return src.replace(/\/uploads\/([^/]*)\/_[^/]*\//, "/uploads/$1/");
        }

        if (googlestorage_container === "mediaslide-europe") {
            return src.replace(/\/[a-z]*-([^/]*)$/, "/$1");
        }

        if (domain_nosub === "netinfo.bg" && domain.match(/m[^.]*\.netinfo\.bg/)) {
            return src.replace(/([/=]media\/images\/[0-9]*\/[0-9]*\/)(?:r-)?[^-/.]*-[^-/.]*/, "$1orig-orig");
        }

        if (domain === "i.imgur.com" &&
            !src.match(/\.gifv(?:\?.*)?$/)) {

            if (src.match(/\/removed\.[a-zA-Z]+(?:[?#].*)?$/))
                return {
                    url: src,
                    bad: true
                };

            return {
                url: src.replace(/\/([a-zA-Z0-9]{7})(?:[hrlgmtbs]|_d)(\.[^/.?]*)$/, "/$1$2"),
                headers: {
                    Referer: null
                }
            };
        }

        if (domain === "imgur.dcard.tw") {
            return src.replace(/:\/\/[^/]*\//, "://i.imgur.com/");
        }

        if (domain_nowww === "siamzone.com") {
            return src
                .replace(/^[a-z]+:\/\/[^/]*\/board\/+(?:imgur\.php\?|imgur\/+.\/+)([^/]*)$/, "https://i.imgur.com/$1");
        }

        if (domain_nowww === "vidble.com") {
            return src.replace(/_[^/._]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "itpro.nikkeibp.co.jp") {
            return src.replace(/\/thumb_[0-9]+_([^/]*)$/, "/$1");
        }

        if (domain === "media-cdn.tripadvisor.com") {
            return src.replace(/\/media\/photo-[a-z]\//, "/media/photo-o/");
        }

        if (domain === "www.traveller.com.au" ||
            domain === "resources.stuff.co.nz" ||
            domain_nowww === "fairfaxstatic.com.au" ||
            domain_nowww === "smh.com.au" ||
            domain_nowww === "dailylife.com.au" ||
            domain === "www.essentialbaby.com.au") {
            return src.replace(/(\/images\/(?:[0-9a-z]\/){4,}image\.).*$/, "$1");
        }

        if (domain === "getwallpapers.com" ||
            domain_nowww == "hintergrundbild.org" ||
            domain === "wallpapertag.com") {
            return src.replace(/\/wallpaper\/[^/]*\//, "/wallpaper/full/");
        }

        if (domain === "ideascdn.lego.com") {
            return src
                .replace(/-thumbnail[^/.]*(\.[^/.]*)$/, "$1")
                .replace(/-square[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "legocdn.com" &&
            src.indexOf("/is/image/") >= 0) {
            return src.replace(/(?:\?.*)?$/, "?scl=1");
        }

        if (domain === "images.newindianexpress.com") {
            return src.replace(/\/[wh][0-9]+X[0-9]*\//, "/original/");
        }

        if (domain === "image.spreadshirtmedia.com" && false) {
            return src.replace(/(\/[0-9]*),(?:[^=/,]*=[^=/,]*,?){1,}(\/[^/]*$)/, "$1$2");
        }

        if (domain_nosub === "blastingcdn.com" && domain.match(/staticr[0-9]*\.blastingcdn\.com/)) {
            return src
                .replace(/\/b_[0-9]+x[0-9]+\/([^/]*)$/, "/$1")
                .replace(/\/[0-9]+x[0-9]+\/([^/]*)$/, "/main/$1");
        }

        if (domain_nowww === "gjdream.com") {
            return src.replace(/_tmb(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.imaeil.com") {
            return src.replace(/\/m_wiz\/imgsrc[0-9]\.php.*?[?&]src=([^&]*).*/, "/$1");
        }

        if (domain === "www.kwnews.co.kr") {
            return src.replace(/\/kwnews_view\.asp?.*?kwurl=([0-9]{4})([0-9]{2})[0-9]*-([0-9]*)-[0-9]*(\.[^/.]*)$/, "/newsphoto/$1/$2/$3$4");
        }

        if (domain_nowww === "yeongnam.com" &&
            src.indexOf("/Photo/") >= 0) {
            return src.replace(/\/[A-Z]([^/]*)$/, "/R$1");
        }

        if (domain_nowww === "yeongnam.com" &&
            src.indexOf("/news/screennews/") >= 0) {
            return src
                .replace(/\/news\/screennews\/[0-9]+_[0-9]+_[A-Z]([0-9]{4})([0-9]{2})([0-9]{2})_([0-9]+)(\.[^/.]*)/,
                         "/Photo/$1/$2/$3/R$1$2$3.$4.jpeg");
        }

        if (domain === "db.kookje.co.kr") {
            return src.replace(/\/[A-Z]([^/]*)$/, "/L$1");
        }

        if (domain_nowww === "kookje.co.kr") {
            return src
                .replace("/thumb/", "/")
                .replace(/.*\/[0-9]+_[0-9]+_([0-9]{4})([0-9]{4})([^/]*)$/, "http://db.kookje.co.kr/news2000/photo/$1/$2/L$1$2$3");
        }

        if (domain_nowww === "joongdo.co.kr") {
            return src.replace(/\/webdata\/content\//, "/file/").replace(/\/[^0-9]*([0-9]*\.[^/.]*)$/, "/$1");
        }

        if (domain === "img.asiatoday.co.kr" && false) {
            regex = /\/webdata\/content\/(.*)_[0-9]+_[0-9]+(\.[^/.]*)$/;
            return [
                src.replace(regex, "/file/$1_1$2"),
                src.replace(regex, "/file/$11$2")
            ];
        }

        if (domain === "jmagazine.joins.com" ||
            (domain === "www.urbanbug.net" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "celebs-news.ru" && src.indexOf("/images/") >= 0) ||
            domain_nowww === "popco.net") {
            return src.replace(/\/thumb_([^/]*)$/, "/$1");
        }

        if (domain === "img.tvreport.co.kr") {
            return src.replace(/_[0-9]*(\.[^/.]*)$/, "_0$1");
        }

        if (domain === "ojsfile.ohmynews.com") {
            return src
                .replace(/\/CT_T_IMG\/(.*?)\/([^/]*)_[A-Z]+(\.[^/.]*?)(?:\?.*)?$/, "/ORG_IMG_FILE/$1/$2_ORG$3")
                .replace(/\/[A-Z]*_IMG_FILE\/(.*?)\/([^/]*)_[A-Z]*(\.[^/.]*)(?:\?.*)?$/, "/ORG_IMG_FILE/$1/$2_ORG$3");
        }

        if (domain === "cmsimg.mnet.com" ||
            domain === "cmsimg.global.mnet.com") {
            regex = /(\/clipimage\/.*?[^0-9]\/)[0-9]+\/([0-9]+\/[0-9]+\/[0-9]+\.[^/.]*)$/;
            return [
                src.replace(regex, "$1$2"),
                src.replace(regex, "$11024/$2")
            ];
        }

        if (domain === "image.cloud.sbs.co.kr") {
            return src.replace(/_[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "st-hatena.com" &&
            (domain.match(/cdn-ak-scissors\.[a-z]\.st-hatena\.com/) ||
             domain === "cdn.image.st-hatena.com")) {
            newsrc = src.replace(/.*?\/image\/(?:scale|square)\/[^/]*\/[^/]*\/(.*)$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "pimg.togetter.com") {
            return src.replace(/\?[^/]*$/, "?w=o&h=o");
        }

        if (domain === "nimage.newsway.kr") {
            if (src.match(/[?&]simg=[%/]/)) {
                return decodeURIComponent(src.replace(/\/phpwas\/restmb_idxmake\.php.*?simg=([^&]*).*?$/, "$1"));
            }

        }

        if (domain === "imgsrv.piclick.me") {
            return src.replace(/\/cimg\/[0-9]+x[0-9]+x/, "/cimg/");
        }

        if (domain_nowww === "slate.com") {
            return src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
        }

        if (domain === "img.cinemablend.com" ||
            domain === "img.minq.com") {
            return src.replace(/(:\/\/[^/]*\/)filter:[^/]*\/(.*?)(?:\?[^/]*)?$/, "$1$2");
        }

        if (((domain_nosub === "abcimg.es" && domain.match(/r[0-9]*\.abcimg\.es/)) ||
             domain === "resizer.elcorreo.com") &&
            src.indexOf("/resizer.php") >= 0) {
            return decodeURIComponent(src.replace(/.*\/resizer\.php.*?[?&]imagen=([^&]*).*$/, "$1"));
        }

        if (domain === "vz.cnwimg.com") {
            return src.replace(/\/thumb[a-z]*-[0-9]+x[0-9]+\//, "/");
        }

        if (domain_nowww === "coleman-rayner.com" &&
            src.indexOf("/watermark/insertwm.php?") >= 0) {
            return {
                can_head: false,
                url: decodeURIComponent(src.replace(/.*\/watermark\/insertwm\.php.*?[?&]src=([^&]*).*$/, "$1"))
            };
        }

        if (domain === "media.guestofaguest.com") {
            return src.replace(/(:\/\/[^/]*\/)[^/]*\/(wp-content|gofg-media)\//, "$1$2/");
        }

        if (domain_nosub === "heartyhosting.com" &&
            domain.match(/i[0-9]*\.heartyhosting\.com/)) {
            return src.replace(/.*?:\/\/[^/]*\//, "http://");
        }

        if (domain === "images.contactmusic.com") {
            newsrc = src.replace(/-cm(\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "contactmusic.com") {
            var retarray = [];

            newsrc = src.replace(/\/pics\/[a-z]([a-z]?\/)/,"/pics/s$1");
            if (newsrc !== src)
                retarray.push({
                    url: newsrc,
                    problems: {
                        smaller: true
                    }
                });

            newsrc = src.replace(/\/pics\/[a-z]([a-z]?\/)/,"/pics/l$1");
            if (newsrc !== src)
                retarray.push({
                    url: newsrc,
                    problems: {
                        watermark: true
                    }
                });

            if (retarray.length > 0)
                return retarray;
        }

        if (domain === "d15mj6e6qmt1na.cloudfront.net") {
            return src.replace(/(\/i\/[0-9]*)\/.*/, "$1");
        }

        if ((domain_nosub === "bing.net" && domain.match(/tse[0-9]*\.(?:mm|explicit)\.bing\.net/)) ||
            domain_nosub === "bing.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/th[^/]*[?&]rurl=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);

            newsrc = src.replace(/(:\/\/[^/]*)\/th[^/]*[?&]id=([^&]*)&[^/]*$/, "$1/th?id=$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "cdn.4archive.org") {
            return src.replace(/(\/img\/[^/.]{7})m(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "i.4cdn.org" ||
            domain === "i.4pcdn.org") {
            return src.replace(/(\/[0-9]*)s(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "thebarchive.com" ||
            domain_nosub === "desu-usergeneratedcontent.xyz" ||
            domain_nowww === "archiveofsins.com") {
            return add_extensions(src.replace(/(\/)thumb(\/.*\/[0-9]+)s(\.[^/.]*)$/, "$1image$2$3"));
        }

        if (domain === "ii.yakuji.moe" ||
            domain === "aqua.komica.org") {
            return src.replace(/\/thumb\/([0-9]+)s(\.[^/.]*)$/, "/src/$1$2");
        }

        if (domain === "file.tinnhac.com" ||
            domain === "file.tintuckpop.net" ||
            domain === "media.bongda.com.vn" ||
            domain_nosub === "404content.com" ||
            domain === "image.vtcns.com" ||
            domain === "image.vtc.vn") {
            return src
                .replace(/\/crop\/[-0-9]+x[-0-9]+\//, "/")
                .replace(/\/resize\/[-0-9]+x[-0-9]+\//, "/");
        }

        if (domain_nosub === "zadn.vn" ||
            (domain_nosub === "vov.vn" && domain.match(/images?\.(?:[^/.]*\.)?vov\.vn/)) ||
            domain === "ss-images.catscdn.vn" ||
            domain === "img.v3.news.zdn.vn" ||
            domain === "img.vietnamplus.vn" ||
            domain === "cdnimg.vietnamplus.vn" ||
            (domain_nosub === "baonghean.vn" && domain.match(/^image[0-9]*\./)) ||
            domain === "image.baophapluat.vn" ||
            domain === "image.giaoducthoidai.vn" ||
            domain === "image.laodong.com.vn" ||
            (domain_nosub === "tienphong.vn" && domain.match(/image[0-9]*\.tienphong\.vn/)) ||
            domain === "media.laodong.vn") {
            return src
                .replace(/(:\/\/[^/]*)\/[wht][0-9]+x?(?:_[^/]*)?(?:[0-9]+)?\//, "$1/")
                .replace(/(:\/\/[^/]*)\/[-0-9]+x[-0-9]+\//, "$1/")
                .replace(/(?:\.ashx)?\?.*$/, "");
        }

        if (domain === "cdn.tuoitre.vn" ||
            domain === "dantricdn.com" ||
            domain === "afamilycdn.com" ||
            domain_nosub === "cafebizcdn.vn" ||
            domain_nosub === "sohacdn.com" ||
            domain_nosub === "kenh14cdn.com" ||
            domain === "dantricdn.com" ||
            domain === "cafebiz.cafebizcdn.vn" ||
            domain_nosub === "vcmedia.vn" ||
            domain_nosub === "genkcdn.vn" ||
            domain === "icdn.dantri.com.vn" ||
            domain_nosub === "mediacdn.vn") {
            return src
                .replace(/\/zoom\/[^/]*\//, "/")
                .replace(/-[0-9]+-[0-9]+-[0-9]+-[0-9]+-crop-[0-9]+(\.[^/.]*)$/, "$1")
                .replace(/-crop-[0-9]{13,}(\.[^/.]*)$/, "$1")
                .replace(/(:\/\/[^/]*)\/thumb_[a-z]\/[0-9]+\//, "$1/");
        }

        if (domain_nosub === "24hstatic.com" ||
            domain_nosub === "24h.com.vn" ||
            (domain_nosub === "danviet.vn" && domain.match(/^streaming[0-9]*\./)) ||
            (domain_nosub === "eva.vn" && domain.match(/^image(?:-[a-z]+)?\./)) ||
            domain === "anh.eva.vn") {
            if (src.match(/\/upload\/+[0-9]+-[0-9]{4}\/+images\//)) {
                return src
                    .replace(/(\/images\/.*)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1$2")
                    .replace(/-watermark(\.[^/.]*)$/, "$1")
                    .replace(/-auto-crop-[0-9]+x[0-9]+(\.[^/.]*)$/, "$1")
                    .replace(/(\/images\/[0-9]*-[0-9]*-[0-9]*\/)[^/]*\/([^/]*)$/, "$1$2");
            }
        }

        if ((domain_nosub === "yan.vn" && domain.match(/static[0-9]*\.yan\.vn/)) ||
            (domain_nosub === "autoimg.cn" && domain.match(/^car[0-9]*\.autoimg\.cn/)) ||
            (domain === "myzutv.ro" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "rainews.it" && src.indexOf("/img/") >= 0) ||
            (domain === "www.mjuznews.com" && src.indexOf("/photos/") >= 0)) {
            return src.replace(/\/[0-9]+x[0-9]+_([^/]*)$/, "/$1");
        }

        if (domain === "image.thanhnien.vn") {
            return src.replace(/(:\/\/[^/]*)\/[0-9]*\//, "$1/");
        }

        if (domain === "media-local.phunu365.net" ||
            domain === "media-local.mywow.vn") {
            return src.replace(/.*?\/api[0-9]+x[0-9]+\/res\/ext\/[0-9]+x[0-9]+\/[^/]*\//, "http://");
        }

        if ((domain_nosub === "nguoiduatin.vn" && domain.match(/.*media[0-9]*\.nguoiduatin\.vn/)) ||
            domain === "media.doisongphapluat.com" ||
            domain === "media.vietq.vn" ||
            domain_nowww === "baouc.com" ||
            domain === "media.hotbirthdays.com") {
            return src.replace(/(:\/\/[^/]*)\/[^/]*x[0-9]+x(?:[0-9]+)?\//, "$1/");
        }

        if (domain === "www.wowkorea.live" ||
            (domain_nowww === "fotofap.net" && src.indexOf("/img/") >= 0) ||
            domain === "images.vfl.ru") {
            return src.replace(/(\/[0-9]*)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "seoul.co.kr" && domain.match(/img[^.]*\.seoul\.co\.kr/)) {
            return src.replace(/_[A-Z](?:[0-9]){0,2}(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.yonhapnews.co.kr" ||
            domain === "vmg.yonhapnews.co.kr" ||
            (domain_nosub === "yna.co.kr" && domain.match(/^img[0-9]*\./))) {
            return src
                .replace(/(\/PYH[^/_.]*)_[^/.]*(\.[^/.]*)$/, "$1_P4$2")
                .replace(/(\/AKR[^/_.]*_[0-9]+_i)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "yonhapnews.co.kr" && domain.match(/big[0-9]*\.yonhapnews\.co\.kr/)) {
            return src.replace(/.*:\/\/[^/]*\/gate\/[^/]*\//, "http://");
        }

        if (domain_nosub === "bunjang.net") {
            return {
                url: src.replace(/_[wh][0-9]*(\.[^/.]*)$/, "$1"),
                can_head: false // 404
            };
        }

        if (domain === "betanews.heraldcorp.com" ||
            domain_nowww === "betanews.net") {
            return src
                .replace(/(\/imagedb\/(:?[^/]*\/)?)(?:first|thumb)\//, "$1orig/");
        }

        if (domain === "img.smlounge.co.kr") {
            return src.replace(/\/thumb\/([^/.]*)-sample[^/.-]*(\.[^/.]*)$/, "/$1$2");
        }

        if (false && domain === "img.etoday.co.kr") {
        }

        if (domain === "img.etoday.co.kr") {
            return src.replace(/(\/pto_db\/+[0-9]{4}\/+[0-9]{2}\/+)[0-9]+\/+([0-9]+_[0-9]+[^/]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "image.tving.com" &&
            src.indexOf("tving.com/resize.php") >= 0) {
            return src.replace(/.*:\/\/[^/]*\/resize\.php.*?[?&]u=([^&]*).*/, "$1");
        }

        if (domain === "cdn.pastemagazine.com") {
            return src.replace(/(\/[^/]*\/)assets_[^/]*\/[0-9]*\/[0-9]*\/([^-]*)-.*(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain === "www.beauty-co.jp") {
            return src.replace(/\/news\/assets_[^/]*\/[0-9]*\/[0-9]*\/([^-]*)-.*(\.[^/.]*)$/, "/news/img/$1$2");
        }

        if (domain === "seichimap.jp") {
            newsrc = src.replace(/(\/[^/]*\/)assets_[^/]*\/[0-9]*\/[0-9]*\/([^-]*)-.*(\.[^/.]*)$/, "$1pht/$2$3");
            if (newsrc !== src) {
                return [
                    newsrc,
                    newsrc.replace(".jpg", ".JPG")
                ];
            }
        }

        if (domain === "www.agencyteo.com") {
            return src
                .replace(/-[0-9]*[wh]*(\.[^/.]*)$/, "$1")
                .replace(/(\/download\/[0-9]*\/)[wh]\/[0-9]*\//, "$1");
        }

        if (domain_nosub === "riotpixels.net" && domain.match(/s[0-9]*\.riotpixels\.net/)) {
            return src.replace(/(\/data\/[a-f0-9]*\/[a-f0-9]*\/[^./]*\.[^/.]*)[./].*$/, "$1");
        }

        if ((domain_nosub === "ignimgs.com" ||
             domain_nosub === "ign.com") &&
            domain.match(/^assets[0-9]*\./)) {
            return src.replace(/_[^-_/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "static.gamespot.com") {
            return add_extensions(src.replace(/\/uploads\/[^/]*\//, "/uploads/original/"));
        }

        if (domain === "i.neoseeker.com" &&
            src.match(/\/size\/[0-9]+x[0-9]+\//)) {
            return src.replace(/\/size\/[0-9]+x[0-9]+\//, "/size/0x0/");
        }

        if (domain === "i.neoseeker.com" &&
            src.match(/\/p\/[0-9]*\/[0-9]*\//)) {
            return src.replace(/_thumb_([^/]*$)/, "_image_$1");
        }

        if (domain === "resource.supercheats.com") {
            return src.replace(/\/library\/(?:(?:[0-9]*[wh])|thumbs)\//, "/library/");
        }

        if (amazon_container === "intergi-phoenix") {
            return src.replace(/\/images\/thumb_large_([^/]*)$/, "/images/$1");
        }

        if (domain === "www.primagames.com" ||
            domain === "assets.rockpapershotgun.com") {
            return src.replace(/(\/[^/]*\.[^/.]*)\/[A-Z]+\/(?:resize|format|crop|quality)?\/.*$/, "$1");
        }

        if ((domain_nosub === "ixquick.com" ||
             domain_nosub === "startpage.com") &&
            domain.match(/s[0-9]*-[^.]*\./)) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/+cgi-bin\/+serveimage.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "beta.ems.ladbiblegroup.com") {
            return src.replace(/\/s3\/content\/[0-9]+x[0-9]+\//, "/s3/content/");
        }

        if (domain === "mtv-intl.mtvnimages.com") {
            return src.replace(/(\?ep=[^&]*).*/, "$1");
        }

        if (domain === "gaia.adage.com") {
            return src.replace(/\/images\/bin\/image\/[^/]*\//, "/images/bin/image/");
        }

        if (domain === "t-eska.cdn.smcloud.net") {
            return src.replace(/\/[^/]*?n-([^/]*)$/, "/n-$1");
        }

        if (domain === "cdn.wegow.com") {
            return src.replace(/\.[-0-9]*x[-0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.ecestaticos.com") {
            return src.replace(/\/clipping\/[0-9]*\//, "/clipping/0/");
        }

        if (domain_nowww === "sonarreykjavik.com" ||
            domain_nowww === "gamer.ru" ||
            domain_nowww === "sonar.es") {
            return src
                .replace(/(\/attached_images\/+[0-9]*\/+)[a-z]+\/+/, "$1original/")
                .replace(/(\/attached_images\/+images\/+(?:[0-9]+\/+){3})[a-z]+\/+/, "$1original/");
        }

        if (domain === "pgw.udn.com.tw") {
            return src.replace(/.*\/photo\.php.*?[?&]u=([^&]*).*/, "$1");
        }

        if (domain === "uc.udn.com.tw") {
            return {
                url: src,
                can_head: false
            };
        }

        if ((domain_nosub === "hdslb.com" && domain.match(/i[0-9]*\.hdslb\.com/)) ||
            domain === "img.xiaohongshu.com" ||
            (domain_nosub === "xiaoka.tv" && domain.match(/alcdn\.img\.xiaoka\.tv/))) {
            return src
                .replace(/(:\/\/[^/]*\/)[0-9]+_[0-9]+\//, "$1")
                .replace(/(\.[^/.]*)@[_0-9a-z]*(?:\.[^/.]*)?$/, "$1");
        }

        if (domain === "d.ifengimg.com") {

            return src.replace(/.*?\/[a-z]+[0-9]*(?:_[whq][0-9]*)?\//, "http://");
        }

        if (domain === "www.nationalgeographic.com") {
            return src.replace(/\.[^/]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "media.mnn.com" ||
            domain === "alljapantours.com" ||
            domain === "shows.gqimg.com.cn" ||
            domain === "shows.vogueimg.com.cn" ||
            (domain_nosub === "webcollage.net" && domain.indexOf("media.webcollage.net") >= 0) ||
            domain === "www.metronews.ca" ||
            domain === "images.meredith.com" ||
            domain === "img-cdn.jg.jugem.jp" ||
            domain_nowww === "anime-thai.net" ||
            domain_nowww === "mymypic.net" ||
            domain_nowww === "styleyen.com" ||
            domain === "www.nbstr.org" ||
            (domain_nosub === "forbiddenplanet.com" && domain.match(/^dyn[0-9]*\.media\.forbiddenplanet\.com/)) ||
            domain === "media.treehugger.com" ||
            (domain_nowww === "attitude.co.uk" && src.indexOf("/media/images/") >= 0) ||
            domain === "media.allyou.net" ||
            domain === "image.pbs.org" ||
            (domain_nowww === "plasticsurgerystar.com" && src.indexOf("/images/") >= 0) ||
            (domain_nowww === "peoplite.com" && src.indexOf("/public/album_photo/") >= 0) ||
            domain === "d26oc3sg82pgk3.cloudfront.net" ||
            domain === "d53l9d6fqlxs2.cloudfront.net") {
            newsrc = src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "media.contentapi.ea.com") {
            newsrc = src.replace(/(\/[^/.]*\.[^/.]*)\.[^/]*$/, "$1");
            if (newsrc !== src)
                return {
                    url: newsrc,
                    can_head: false
                };
        }


        if (domain === "img.bleacherreport.net") {
            return src
                .replace(/\/crop_exact_([^/]*)$/, "/$1")
                .replace(/\?.*$/, "?w=999999999999&h=999999999999");
        }

        if (domain === "images.gr-assets.com") {
            return src
                .replace(/(\/(?:authors|users)\/[0-9]*p)[0-9]\//, "$18/")
                .replace(/(\/books\/[0-9]*)[a-z]\//, "$1l/");
        }

        if (domain === "dynamic.indigoimages.ca") {
            return src.replace(/(\?.*)?$/, "?width=999999999");
        }

        if (domain === "cdn.mos.cms.futurecdn.net") {
            return src.replace(/-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.allkpop.com") {
            return src.replace(/\/af\/([0-9]*\/[^/]*)$/, "/af_org/$1");
        }

        if (domain === "cwcontent.asiae.co.kr") {
            return src
                .replace(/^(.*?:\/\/).*\/[^/]*resize\/[0-9]*\/([^/]*)$/, "$1cphoto.asiae.co.kr/listimglink/4/$2");
        }

        if (domain === "cphoto.asiae.co.kr") {
            return src
                .replace(/\/listimglink\/[0-9]*\//, "/listimglink/4/")
                .replace(/\/resizeimglink\/[0-9]*\//, "/listimglink/4/")
                .replace(/\/listimg_link\.php.*?[?&]no=([^&]*).*?$/, "/listimg_link.php?idx=4&no=$1");
        }

        if (domain === "thumbs-prod.si-cdn.com") {
            return src.replace(/.*\/(https?:\/\/)/, "$1");
        }

        if (domain === "assets.atlasobscura.com") {
            return src.replace(/\/article_images\/[0-9]*x\//, "/article_images/");
        }

        if (domain === "wonderopolis.org" &&
            src.indexOf("/_img") >= 0) {
            return src.replace(/\/_img.*?[?&](img=[^&]*).*/, "/_img?$1");
        }

        if (domain === "www.thehindu.com" ||
            domain === "www.gloria.hr" ||
            ((domain_nosub === "mirror.co.uk" ||
              domain_nosub === "birminghammail.co.uk" ||
              domain_nosub === "dailypost.co.uk" ||
              domain_nosub === "bristolpost.co.uk" ||
              domain_nosub === "irishmirror.ie" ||
              domain_nosub === "coventrytelegraph.net" ||
              domain_nosub === "dublinlive.ie") &&
             domain.match(/i[0-9]*(?:-prod)?\./)) ||
            domain === "www.mirror.co.uk" ||
            domain === "beta.images.theglobeandmail.com" ||
            domain === "www.globalblue.com" ||
            (domain_nosub === "belfasttelegraph.co.uk" && domain.match(/cdn(-[0-9]+)?\.belfasttelegraph\.co\.uk/)) ||
            domain === "www.ladylike.gr" ||
            domain_nowww === "24horas.cl" ||
            domain_nowww === "jyllands-posten.dk" ||
            domain_nowww === "svtstatic.se" ||
            domain_nowww === "adressa.no" ||
            domain_nowww === "belfasttelegraph.co.uk" ||
            domain_nowww === "miamiherald.com" ||
            src.match(/\/incoming\/article[^/]*\.(?:ece|svt)\/(?:[^/]*\/)?(?:alternates|ALTERNATES)\//) ||
            src.match(/:\/\/i[0-9]*(?:-prod)?\..*\/article[^/]*\.(?:ece|svt)\//) ||
            domain_nosub === "independent.ie") {
            newsrc = src.replace(/(?:alternates|ALTERNATES|AUTOCROP|autocrop|binary|BINARY)\/[^/]*\/([^/]*)$/, "BINARY/$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "ekstrabladet.dk") {
            return src.replace(/\/IMAGE_ALTERNATES\/+[^/]*\/+/, "/IMAGE_BINARY/original/");
        }

        if (domain === "images.fandango.com" ||
            domain === "www.statf.com") {
            newsrc = src.replace(/\/ImageRenderer\/.*?\/images\//, "/images/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "images.fandango.com") {
            return src.replace(/_[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (amazon_container === "assets.forward.com") {
            return src.replace(/.*:\/\/[^/]*\//, "http://");
        }

        if (domain === "assets.forward.com" ||
            domain === "assets.forwardcdn.com") {
            return src.replace(/\/images\/cropped\//, "/images/");
        }

        if (domain === "www.thejewelleryeditor.com") {
            return src.replace(/\/images_thumbnails\/[^/]*_thumbnails\/([^/]*\/[0-9]*\/[^/.]*\.[^_/.]*)__[^/]*$/, "/images/$1");
        }

        if (domain_nowww === "sass.com.ua") {
            return src.replace(/\/static\/media\/[^/]*(\/public\/.*\/[^/]*?\.[a-z]+)__[^/]*$/, "/static/media$1");
        }

        if (domain === "files.sharenator.com") {
            return src.replace(/(:\/\/[^/]*\/)[^/.]+-s[0-9]+x[0-9]+-([0-9]{4,})(?:-[0-9]*)?(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain === "cdn.jolie.de" ||
            domain === "cdn.maedchen.de") {
            return src.replace(/\/image[0-9]*[wh]\//, "/original/");
        }

        if (domain === "img.mp.itc.cn" ||
            (domain_nowww === "wallpapercraze.com" && src.indexOf("/images/wallpapers/") >= 0) ||
            domain === "img.mp.sohu.com") {
            return src.replace(/_th(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "qpic.cn") {
            if (!domain.match(/^t[0-9]*\.qpic\.cn$/))
                return src.replace(/\/[0-9]*(?:\.[^/.]*)?(?:\?.*)?$/, "/0");
        }

        if (domain === "vogue.ua") {
            return src
                .replace(/\/media\/+cache\/+resolve\//, "/cache/")
                .replace(/\/cache\/[^/]*\/uploads\//, "/uploads/");
        }

        if (domain === "imagesvc.timeincuk.net" ||
            domain === "imagesvc.meredithcorp.io") {
            return decodeuri_ifneeded(src.replace(/^[a-z]+:\/\/[^/]*\/v3\/+(?:keystone|mm)\/+image.*?[?&]url=([^&]*).*/, "$1"));
        }

        if (domain === "img.timeinc.net") {
            return src.replace(/\/[0-9]+_([^/_]+_[0-9]+(?:_[^/]*)?\.[^/.]*)$/, "/$1");
        }

        if (domain === "i.ksd-i.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/+s\/+[0-9]+_[0-9]+_[0-9a-f]+\/+/, "http://");
        }

        if (domain === "a.ksd-i.com") {
            return src.replace(/.*:\/\/[^/]*\/s\/[^/]*\//, "http://");
        }

        if (domain === "static.koreastardaily.com") {
            return src.replace(/.*:\/\/[^/]*\/([0-9]+-[0-9]+-[0-9]+\/[0-9]+-[0-9]+\.[^/.]*)$/, "https://a.ksd-i.com/a/$1");
        }

        if (domain === "pic.pimg.tw") {
            return src.replace(/_[a-z](\.[^/]*)$/, "$1");
        }

        if (domain_nowww === "helloidol.com" &&
            src.indexOf("/script/get_pic.php") >= 0) {
            return src.replace(/.*\/script\/get_pic\.php.*?[?&]src=([^&]*).*?$/, "$1");
        }

        if (domain === "yams.akamaized.net" &&
            src.indexOf("/Assets/") >= 0) {
            return src.replace(/\/(?:[^/._]*_)?([^/_]*)$/, "/l_$1");
        }

        if (domain_nosub === "pixpo.net" && domain.match(/img[0-9]\.pixpo\.net/)) {
            return src.replace(/_t[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.mirrormedia.mg" &&
            src.indexOf("/assets/images/") >= 0) {
            return src.replace(/-desktop(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "kknews.cc" && domain.match(/i[0-9]*\.kknews\.cc/)) {
            return src.replace(/_[a-z]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "resource.holyshare.com.tw") {
            return src.replace(/\/article\/[0-9]*x[0-9]*\//, "/article/");
        }

        if (domain_nowww === "kyeongin.com") {
            return src.replace("/file_m/", "/file/");
        }

        if (domain === "www.wallpaperup.com") {
            return src.replace(/-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if ((domain_nosub === "wallhere.com" ||
             domain_nosub === "pxhere.com") &&
            domain.match(/^[a-z]*\./)) {
            return src
                .replace(/[a-z]*\.wallhere\.com/, "get.wallhere.com")
                .replace(/[a-z]*\.pxhere\.com/, "get.pxhere.com")
                .replace(/\/(?:photos|images)\/[0-9a-f]*\/[0-9a-f]*\/([^/.]*\.[^/.!]*).*?$/, "/photo/$1")
                .replace(/\/[0-9]+x[0-9]+-px-([^/]*)$/, "/$1")
                .replace(/-[0-9]+x[0-9]+-px-([0-9]+\.[^/.]*)$/, "-$1");
        }

        if (domain === "img.grouponcdn.com") {
            return src.replace(/\/v[0-9]+\/[^/]*$/, "");
        }

        if ((domain_nosub === "goodfon.com" ||
             domain_nosub === "goodfon.ru" ||
            domain_nosub === "badfon.ru") &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/)[^/]*\/[^/]*\//, "$1wallpaper/original/");
        }

        if (domain_nosub === "greatfon.com" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/(\/uploads\/+picture\/.*\/)thumbs_([^/]*)(?:[?#].*)?$/, "$1$2");
        }

        if ((domain_nosub === "yimg.jp" && domain.indexOf(".c.yimg.jp") >= 0) &&
            src.match(/:\/\/[^/]*\/im_/)) {
            return src.replace(/(:\/\/[^/]*\/)im_[^/]*\//, "$1");
        }

        if ((domain_nosub === "yimg.jp" && domain.indexOf(".c.yimg.jp") >= 0) &&
            src.match(/:\/\/[^/]*\/sim\?/)) {
            return src.replace(/.*:\/\/[^/]*\/sim.*?[?&]furl=([^&]*).*/, "http://$1");
        }

        if ((domain_nosub === "yimg.jp" && domain.indexOf(".c.yimg.jp") >= 0) &&
            src.match(/\/Images\/(?:[a-z]_)?[0-9]+(\.[^/]*)$/)) {
            return src.replace(/\/Images\/(?:[a-z]_)?([0-9]+\.[^/.]*)$/, "/Images/f_$1");
        }

        if (domain_nosub === "yimg.jp" && domain.indexOf(".c.yimg.jp") >= 0 &&
            src.match(/:\/\/[^/]*\/yjimage\?/)) {
            return src.replace(/^([a-z]+:\/\/[^/]*\/yjimage).*$/, "$1") + "?q=" + url.searchParams.get("q") + "&sig=" + url.searchParams.get("sig");
        }

        if (domain === "av.watch.impress.co.jp") {
            return src.replace(/(\/[0-9]+)_s(\.[^/.]*)$/, "$1_o$2");
        }

        if (domain === "internet.watch.impress.co.jp") {
            return src.replace(/(\/[0-9]+)_s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "media.image.infoseek.co.jp") {
            return src.replace(/-[a-z]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "s.eximg.jp") {
            return src.replace(/(_[0-9]+)_s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "imgc.eximg.jp") {
            newsrc = src.replace(/.*?\/i=([^,&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeuri_ifneeded(newsrc);
            newsrc = src.replace(/.*?\/cv\/+(?:resize|trim)\?i=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeuri_ifneeded(newsrc);
        }

        if (domain === "image.itmedia.co.jp" &&
            !src.match(/\/l_[^/]*$/) &&
            !src.match(/\/[0-9]+_[^/]*$/)) {
            return src.replace(/\/([^/]*)$/, "/l_$1");
        }

        if (domain_nosub === "bigcommerce.com" && domain.match(/cdn[0-9]*\.bigcommerce\.com/)) {
            return {
                url: src.replace(/\/images\/stencil\/[0-9]+x[0-9]+\//, "/images/stencil/original/"),
                head_wrong_contentlength: true
            };
        }

        if (domain_nosub === "behance.net" &&
            src.indexOf("/project_modules/") >= 0) {
            return [
                src.replace(/\/project_modules\/+[^/]*\//, "/project_modules/source/"),
                src.replace(/\/project_modules\/+[^/]*\//, "/project_modules/fs/")
            ];
        }

        if (domain === "www.worldatlas.com") {
            return src.replace(/(:\/\/[^/]*\/)r\/[^/]*\/(upload\/)/, "$1$2");
        }

        if (domain_nosub === "thrillist.com" && domain.match(/assets[0-9]*\.thrillist\.com/)) {
            return src.replace(/\/size\/[^/]*$/, "");
        }

        if (domain_nowww === "vacationidea.com" &&
            src.indexOf("/pix/") >= 0) {
            return src.replace(/_mobi(\.[^/.]*)$/, "$1");
        }

        if (domain === "qph.fs.quoracdn.net") {
            return src.replace(/-[a-z]$/, "");
        }

        if (false && domain_nosub === "fan.pw" &&
            src.indexOf("/cpg/albums/") >= 0) {
            return src.replace(/\/[a-z]*_([^/]*)$/, "/$1");
        }

        if (false && domain.match(/c[0-9]*\.haibao\.cn/)) {
            return src.replace(/\/img\/[0-9]+_[0-9]+_[0-9]+_[0-9]+\//, "/img/0_0_0_0/");
        }

        if (domain_nosub === "haibao.cn" && domain.match(/c[0-9]*\.haibao\.cn/)) {
            return {
                url: src.replace(/:\/\/[^/]*\/(.*)\/imagecut\/[0-9]+_[0-9]+\//, "://c3.haibao.cn/$1/"),
                can_head: false
            };
        }

        if (domain_nosub === "hbimg.cn" && domain.match(/cdn[0-9]*\.hbimg\.cn/)) {
            return src.replace(/\/thumbs\/[0-9]+(?:_[0-9]+)\//, "/wm/");
        }

        if (domain === "wallpaperset.com") {
            return src.replace(/(:\/\/[^/]*\/w\/)[^/]*\//, "$1full/");
        }

        if (domain_nosub === "wallpapermania.eu") {
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
        }

        if (domain === "img-aws.ehowcdn.com" ||
            domain === "img.aws.ehowcdn.com" ||
            domain === "img.aws.livestrongcdn.com" ||
            domain === "img-aws.livestrongcdn.com") {
            /*newsrc = src.replace(/.*?:\/\/[^/]*\/[0-9]+x[0-9]+p\//, "http://")
            if (newsrc !== src) {
                return newsrc;
            }*/
            newsrc = src
                .replace(/(:\/\/[^/]*\/)[^/]*\//, "$1default/");
            if (newsrc !== src) {
                return newsrc;
            }

            newsrc = src.replace(/.*?:\/\/[^/]*\/.*?\/(photos\.demandstudios\.com\/)/, "http://$1");
            if (newsrc !== src) {
                return newsrc;
            }

            newsrc = src.replace(/.*?:\/\/[^/]*\/[^/]*\/ehow-([^-/.]*)-blog-([^/.]*)\//, "http://$1-ehow-com.blog.ehow.com/");
            if (newsrc !== src) {
                return newsrc;
            }

            newsrc = src.replace(/.*?:\/\/[^/]*\/.*?\/www_ehow_com\/([^/.]*\.[^/]*)\//, "http://$1/");
            if (newsrc !== src) {
                return newsrc;
            }

            newsrc = src.replace(/.*?:\/\/[^/]*\/[^/]*\/s3\.amazonaws\.com\//, "https://s3.amazonaws.com/");
            if (newsrc !== src) {
                return newsrc;
            }
        }

        if (domain === "s3.amazonaws.com" &&
            src.indexOf("s3.amazonaws.com/cme_public_images/") >= 0) {
            newsrc = src.replace(/.*?:\/\/[^/]*\/.*?\/(photos\.demandstudios\.com\/)/, "http://$1");
            if (newsrc !== src) {
                return newsrc;
            }
        }

        if (domain === "imageproxy.themaven.net") {
            return decodeURIComponent(src.replace(/^.*?:\/\/[^/]*\//, "").replace(/\?.*/, ""));
        }

        if ((domain_nosub === "demandstudios.com" && domain.match(/photos[0-9]*\.demandstudios\.com/)) &&
            src.indexOf("/dm-resize/") >= 0) {
            return decodeURIComponent(src.replace(/.*?\/dm-resize\/([^/?]*).*/, "http://$1"));
        }

        if (domain_nosub === "demandstudios.com" && domain.match(/photos[0-9]*\.demandstudios\.com/)) {
            return src.replace(/(\/[0-9]+)_XS(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "abcnews.com") {
            return src.replace(/_[0-9]+x[0-9]+[a-z]?_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.nationmultimedia.com") {
            return src.replace(/-[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "indiatimes.com" ||
            domain === "img.etimg.com" ||
            domain === "etimg.etb2bimg.com" ||
            domain === "telugu.samayam.com" ||
            domain === "static.toiimg.com") {
            newsrc = src.replace(/(:\/\/[^/]*\/)thumb\//, "$1photo/");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/\/(?:thumb|photo)\/[^/]*msid-([0-9]*)[,/].*$/, "/photo/$1.cms");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/\/(?:thumb|photo)\/(?:[^/]*\/)?([0-9]*)\.[^/.]*$/, "/photo/$1.cms");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "opt.toiimg.com") {
            return src.replace(/\/recuperator\/+img\/+toi\/+m-([0-9]+)(?:,[^/]*)\/+.*/,
                               "/recuperator/img/toi/$1.cms");
        }

        if (domain === "www.jawapos.com") {
            return src.replace(/\/thumbs\/[^/]*\//, "/uploads/");
        }

        if (domain === "www.tnnthailand.com") {
            return src.replace(/\/media\/[^/]*\/([^/]*)$/, "/media/$1");
        }

        if ((domain_nosub === "ibtimes.co.in" ||
             domain_nosub === "ibtimes.sg") &&
            domain.match(/data[0-9]*\.ibtimes\./)) {
            return src
                .replace(/(:\/\/[^/]*\/)cache-img-[0-9]*-[0-9]*(?:-photo)?\//, "$1")
                .replace(/\/[a-z]*(\/[0-9]+\/[^/]*)$/, "/full$1")
                .replace(/\?.*$/, "");
        }

        if (amazon_container === "astro-image-resizer") {
            return src
                .replace(/astro-image-resizer\.([^.]*\.)?amazonaws\.com/, "astrokentico.s3.amazonaws.com")
                .replace(/(:\/\/s3[^/.]*\.amazonaws\.com\/)astro-image-resizer\//, "://astrokentico.s3.amazonaws.com/")
                .replace(/(:\/\/[^/]*)\/[0-9]*\/resize\//, "$1/")
                .replace(/\/[0-9]+x[0-9]+_/, "/");
        }

        if ((amazon_container && amazon_container.indexOf("nxs-wkrgtv-media") >= 0) ||
            (domain_nosub === "win4000.com" && domain.match(/^pic[0-9]*\.win4000\.com/)) ||
            domain === "media.fox29.com" ||
            domain === "sharedmedia.grahamdigital.com" ||
            domain === "mediaassets.wxyz.com") {
            return src.replace(/_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "bobcat.grahamdigital.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/image\/+upload\/+view.*?[?&]url=([^&]*).*?$/, "$1");
        }

        if ((domain === "image.photohito.k-img.com" ||
             domain === "photohito.k-img.com") &&
            src.indexOf("/uploads/") >= 0) {
            return src.replace(/_[a-z]*(\.[^/]*)/, "_o$1");
        }

        if (domain === "eiga.k-img.com") {
            return src
                .replace(/(\/images\/[a-z]+\/[0-9]+\/)[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1original$2")
                .replace(/(\/images\/[a-z]+\/[0-9]+\/(?:[a-z]+\/)?[0-9a-f]+)\/[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "image.yes24.com") {
            return src.replace(/(:\/\/[^/]*\/goods\/[0-9]+)(?:\/.*)?$/, "$1/L");
        }

        if (domain === "img.danawa.com" ||
            domain === "wallpoper.com" ||
            domain === "cdn.maximsfinest.com" ||
            domain === "www.phileweb.com" ||
            (domain_nowww === "imgpic.org" && src.indexOf("/upload/images/") >= 0) ||
            (domain_nosub === "imgdino.com" && domain.match(/img[0-9]*\.imgdino\.com/) && src.indexOf("/images/") >= 0) ||
            (domain === "storage.cobak.co" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "mycotopia.net" && src.indexOf("/uploads/") >= 0) ||
            (domain === "static.becomegorgeous.com" && src.indexOf("/img/") >= 0) ||
            domain === "i.imagepow.com" ||
            (domain_nosub === "techadvisor.co.uk" && domain.match(/^cdn[0-9]*\./)) ||
            (domain_nowww === "funtasticecards.com" && src.indexOf("/images/") >= 0) ||
            (domain_nowww === "hockey-live.sk" && src.indexOf("/images/") >= 0) ||
            domain_nowww === "bellazon.com") {
            return src.replace(/_thumb(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nosub === "pcgames.com.cn" && domain.match(/^img[0-9]*\./)) {
            return src.replace(/_(?:thumb|small|medium)(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "mosaicon.hu" && src.indexOf("/wallpapers/") >= 0) {
            return src.replace(/_(?:large)?thumb(\.[^/.]*)$/, "$1");
        }

        if (domain === "item.ssgcdn.com") {
            return src.replace(/(\/item\/[^/]*)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "coupangcdn.com" && domain.match(/thumbnail[0-9]*\.coupangcdn\.com/)) {
            return src
                .replace(/thumbnail([0-9]*\.coupangcdn\.com)/, "image$1")
                .replace(/\/thumbnails\/remote\/[^/]*\//, "/");
        }

        if (domain === "image.notepet.co.kr") {
            return src.replace(/\/resize\/[^/]*\//, "/");
        }

        if (domain_nowww === "koreamg.com" ||
            domain_nowww === "yufit.co.kr" ||
            domain_nowww === "lovelanc.com" ||
            domain_nowww === "mimibabi.com" ||
            domain === "akamai.poxo.com" ||
            domain_nowww === "getbarrel.com" ||
            domain_nowww === "sexypet.co.kr" ||
            domain_nowww === "fncstore.com") {
            newsrc = src.replace(/\/web\/product\/(?:tiny|small|medium)\//, "/web/product/big/");
            if (newsrc !== src) {
                return [newsrc, newsrc.replace(/0(\.[^/.]*)(?:[?#].*)?$/, "00$1")];
            }
        }

        if (domain_nosub === "mynavi.jp") {
            return src
                .replace(/\/index_images\/[^/]*(?:\/[^/]*)?$/, "/images/001l.jpg")
                .replace(/\/images\/([0-9]+)(\.[^/.]*)$/, "/images/$1l$2");
        }

        if (domain === "cdn.deview.co.jp") {
            return src.replace(/\/imgs\/news_image\.img\.php.*?am_file=([^&])([^&])([^&])([^&]*).*/, "/imgs/news/$1/$2/$3/$1$2$3$4");
        }

        if (domain === "imgcache.dealmoon.com") {
            return src.replace(/.*?:\/\/[^/]*\/(.*?)(\.[^/._]*)_[^/]*?$/, "http://$1$2");
        }

        if (domain === "www.usmall.us" ||
            domain === "www.sofiehouse.co" ||
            domain === "www.thecelebritydresses.com" ||
            domain === "www.celebredcarpetdresses.com" ||
            domain === "www.minimal.co.id" ||
            domain === "www.bridesmaidca.ca" || // doesn't work
            domain === "www.sisley-paris.com" ||
            domain === "d2ovdo5ynwfl3w.cloudfront.net" ||
            domain === "d1cizyvjjqnss7.cloudfront.net" ||
            domain_nowww === "executiveponies.com" ||
            domain_nowww === "trendygowns.com" ||
            domain === "www.lizandliz.com" ||
            src.match(/(?:\/media)?\/catalog\/product\/cache\/(?:[0-9]*\/[^/]*\/)?(?:[0-9]+x(?:[0-9]+)?\/)?[0-9a-f]{32}\//)) {
            /*return src
                .replace(/(\/cache\/[0-9]*\/)small_image\//, "$1/image/")
                .replace(/\/(thumbnail|image)\/[0-9]+x[0-9]+\//, "/$1/");*/
            newsrc = src.replace(/\/+cache\/+(?:[0-9]*\/+[^/]*\/+)?(?:[0-9]+x(?:[0-9]+)?\/+)?[0-9a-f]{32}\/+((?:.\/+.\/+)|(?:[^/]*\/+))([^/]*)$/, "/$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "cdn.okdress.co.nz" ||
            (domain_nowww === "promshopau.com" && false)) {
            return src.replace(/(\/media\/catalog\/product\/)cache\/[0-9]*\/[^/]*\/[0-9]+x[0-9]+\//, "$1");
        }

        if (domain === "img.nextmag.com.tw") {
            return src.replace(/\/[0-9]+x(?:[0-9]+)?_([^/]*)$/, "/$1");
        }

        if (domain_nosub === "meitudata.com") {
            return src.replace(/![^/]*$/, "");
        }

        if (domain === "www.shogakukan.co.jp") {
            return src.replace(/\/thumbnail\/books\//, "/thumbnail/snsbooks/");
        }

        if (domain === "images.sysapi.mtg.now.com") {
            return src.replace(/\/[a-z]\/([^/]*)_[a-z](\.[^/.]*)$/, "/o/$1_o$2");
        }

        if (domain_nosub === "lst.fm" && domain.match(/img[0-9]*[^.]*\.lst\.fm/)) {
            return src.replace(/(\/i\/[a-z]\/)(?:avatar)?[0-9]+s\//, "$1");
        }

        if (domain === "www.hdwallpapers.in" ||
            domain_nowww === "bhmpics.com" ||
            domain_nowww === "freshwallpapers.in") {
            return src
                .replace(/\/(?:download|thumbs)\//, "/walls/")
                .replace(/-[^-_/.]*(\.[^/.]*)$/, "-wide$1");
        }

        if (false && (domain.indexOf("images.deezer.com") >= 0 ||
                      domain.indexOf("images.dzcdn.net") >= 0)) {
            return src.replace(/\/[0-9]+x[0-9]+-[0-9]+-[0-9]+-[0-9]+-[0-9]+(\.[^/.]*)$/, "/99999999999x0-000000-100-0-0$1");
        }

        if (domain === "cdn.wallpaper.com") {
            regex = /\/main\/styles\/[^/]*\/[^/]*\/(.*\/)?(?:l-)?([^/]*)/;
            return [src.replace(regex, "/main/$2"), src.replace(regex, "/main/$1$2")];
        }

        if (domain === "cdn.wallpaper.com") {
            return src.replace(/\/main\/styles\/[^/]*\/[^/]*\//, "/");
        }

        if (domain === "static.warthunder.com") {
            return src.replace(/\/_thumbs\/[0-9]+x(?:[0-9]+)?\//, "/");
        }

        if (domain === "cdn.wallpaperdirect.com") {
            return src.replace(/(\/[0-9]*)_[^/.]*(\.[^/.]*)$/, "$1orig$2");
        }

        if (domain_nosub === "bamcontent.com") {
            return src.replace(/(\/images\/photos\/[0-9]*\/)[0-9]+x[0-9]+\/[^/.]*(\.[^/.]*)$/, "$1raw$2");
        }

        if (domain_nosub === "mail.ru" &&
            domain.match(/filed.*\.mail\.ru$/) &&
            src.match(/:\/\/[^/]*\/pic/)) {
            return decodeURIComponent(src.replace(/.*\/pic.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain_nosub === "mail.ru" &&
            domain.match(/^avt.*\.foto\.mail\.ru/)) {
            return src.replace(/\/_avatar[0-9]+(?:[?#].*)?$/, "/_avatarbig");
        }

        if (domain === "games.mail.ru") {
            return src.replace(/\/pre_(?:[0-9]+x[0-9]+|[a-z]+)_resize\/+pic\/+/, "/pic/");
        }

        if (domain === "mg.soupingguo.com") {
            return src.replace(/(\/attchment[^/]*\/[^/]*Img\/)[0-9]+x[0-9]+\//, "$10x0/");
        }

        if (domain === "img.yaplog.jp") {
            return src.replace(/(\/img\/[^/]*\/)mo\//, "$1pc/");
        }

        if (domain === "www.hochi.co.jp") {
            return src.replace(/-[A-Z](\.[^/.]*)$/, "-L$1");
        }

        if (domain_nosub === "wikispaces.com") {
            return src.replace(/(\/view\/[^/]*\.[^/]*)\/.*?$/, "$1");
        }

        if (false && domain === "cdn.mdpr.jp") {
        }

        if (domain_nowww === "sponichi.co.jp") {
            return {
                url: src.replace(/_thum(\.[^/.]*)$/, "_view$1"),
                can_head: false
            };
        }

        if (domain === "thumbnail.image.rakuten.co.jp") {
            return src.replace(/.*?:\/\/[^/]*\/@[^/]*\/([^?]*).*?$/, "http://shop.r10s.jp/$1");
        }

        if (domain_nowww === "billboard-japan.com" ||
            domain === "fotos.jornaldacidadeonline.com.br") {
            return src.replace(/\/[0-9]+x(?:[0-9]+)?_([^/]*)$/, "/$1");
        }

        if (domain_nosub === "tsite.jp" &&
            domain.indexOf("top.tsite.jp") >= 0 &&
            src.indexOf("/contents_image/") >= 0) {
            return src.replace(/(\/[0-9]+)_[0-9]+(?:_[^/.]+)?(\.[^/.]*)$/, "$1_0$2");
        }

        if (domain === "www.sanspo.com") {
            return src.replace(/(\/images\/[0-9]*\/[^/]*-)[a-z]([0-9]+\.[^/.]*)$/, "$1p$2");
        }

        if (domain === "www.sonymusicshop.jp") {
            return src.replace(/__[0-9]+_[0-9]+_[0-9]+_([a-z]+\.[a-z]*)(?:\?.*)?$/, "_$1");
        }

        if (domain === "prtimes.jp") {
            return src
                .replace(/\/thumb\/[0-9]+x[0-9]+\//, "/original/")
                .replace(/\/resize\/([^/]*)$/, "/original/$1");
        }

        if (domain_nosub === "vietbao.vn") {
            return src
                .replace(/:\/\/img\.vietbao\.vn\/images\/[0-9]+\//, "://a9.vietbao.vn/images/");
        }

        if (domain === "www.vir.com.vn") {
            return src
                .replace(/\/in_article\//, "/")
                .replace(/\/croped\//, "/");
        }

        if (domain === "media.tinnong.net.vn") {
            return src.replace(/\/Images\/[^/]*\//, "/Images/Original/");
        }

        if (domain === "images.kienthuc.net.vn" ||
            domain === "images.khoeplus24h.vn") {
            return src.replace(/\/zoom[a-z]\/[0-9]*\//, "/");
        }

        if (domain === "rez.cdn.kul.vn" ||
            domain_nowww === "glamour.pl" ||
            domain_nowww === "al3arabi.com" ||
            domain_nowww === "starwars-holocron.net" ||
            domain_nowww === "elle.pl" ||
            domain_nowww === "gala.pl" ||
            domain_nowww === "longtake.it") {
            return src.replace(/\/media\/cache\/[^/]*\//, "/");
        }

        if (domain_nowww === "themebeta.com") {
            return src.replace(/\/media\/cache\/[0-9]+x[0-9]+\/files\//, "/files/");
        }

        if (domain === "static.kstyle.com") {
            return src.replace(/\/r\.[0-9]+x[0-9]+$/, "");
        }

        if (amazon_container === "lifesite-cache" ||
            domain_nowww === "golocalprov.com" ||
            (domain_nosub === "thelineofbestfit.com" && domain.match(/^cdn[0-9]*\.thelineofbestfit\.com/))) {
            return src
                .replace(/.*\/images\/remote\/([^_]*)_(.*?)(?:_[0-9]+_[0-9]+_[0-9]+(?:_[a-z]_[a-z][0-9])?)?(\.[^/.]*)$/, "$1://$2$3");
        }

        if (domain_nosub === "fap.to") {
            return src
                .replace(/(:\/\/[^/]*\/)[a-z0-9.]+\/images\//, "$1images/")
                .replace(/\/images\/[a-z]*\//, "/images/full/");
        }

        if (domain === "www.gannett-cdn.com" &&
            src.indexOf("/-ip-/") >= 0) {
            return src.replace(/.*?\/-ip-\//, "");
        }

        if (domain === "cdn.mainichi.jp") {
            return src.replace(/\/[0-9]+(\.[^/.]*)$/, "/9$1");
        }

        if (domain === "img.evbuc.com") {
            return decodeURIComponent(src.replace(/.*:\/\/[^/]*\/([^?]*).*/, "$1"));
        }

        if (domain === "img.cdandlp.com") {
            return src.replace("/imgS/", "/imgL/").replace("/imgM/", "/imgL/");
        }

        if (domain === "walter.trakt.tv") {
            return src.replace(/\/thumb\/([^/]*)$/, "/full/$1");
        }

        if (domain === "cdn.apk-cloud.com") {
            return src
                .replace(/(?:=[a-z][0-9]*)?(\.[^/.]*)$/, "=h0$1");
        }

        if (domain_nosub === "polyvoreimg.com") {
            var cginame = src.replace(/.*\/cgi\/([^/]*)\/.*/, "$1");
            var paramsbase = src.replace(/.*\/cgi\/[^/]*/, "");
            var params = paramsbase.replace(/\/([^/]*)\/([^/]*)/g, "$1=$2&");
            params = params
                .replace(/(.*)\.([^/.&]*)&$/, ".out=$2&$1");
            return "https://www.polyvore.com/cgi/" + cginame + "?" + params;
        }

        if (domain === "www.polyvore.com" &&
            src.indexOf("/cgi/") >= 0) {
            return src
                .replace(/\/img-set(.*?)&size=[^&]*/, "/img-set$1&size=c99999x99999");
        }

        if (domain === "aliyun-cdn.hypebeast.cn" &&
            src.indexOf("/hypebeast.com/") >= 0) {
            return src.replace(/.*:\/\/[^/]*\//, "http://");
        }

        if (domain_nowww === "girlscene.nl") {
            return src.replace(/\/thumb\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain_nowww === "hdfullfilmizle.com") {
            return src.replace(/\/thumb\/[0-9]+x[0-9]+\/uploads\//, "/uploads/");
        }

        if (domain === "www.hairstyleinsider.com" ||
            domain === "sites.eveyo.com" ||
            domain_nowww === "24sata.info" ||
            domain_nowww === "alankabout.com" ||
            domain === "www.elle.rs") {
            return src.replace(/\/(?:thumbnail|files).php.*?file=([^&]*).*/, "/files/$1");
        }

        if (domain === "www.zkpm.net" ||
            domain === "img.viyuedu.com") {
            return src.replace(/.*\/img\.php.*?url=(.*)/, "$1");
        }

        if (domain === "img.xiaohuazu.com") {
            return src.replace(/.*?[?&]url=(.*)/, "$1").replace(/z-z/g, ".").replace(/^/, "http://");
        }

        if (domain === "www.viewsofia.com") {
            return src.replace("/fck_editor_thumb/", "/fck_editor/");
        }

        if (domain_nosub === "condenast.ru" && domain.indexOf(".static.media.condenast.ru") >= 0) {
            return src.replace(/\/[a-z][0-9]*(?:x[0-9]+)?$/, "/w99999999");
        }

        if (domain === "www.vogue.co.jp") {
            return src.replace(/-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.vogue.mx" ||
            domain === "cdn.glamour.mx" ||
            domain === "cdn.vogue.es") {
            return src
                .replace(/\/uploads\/images\/thumbs(?:(\/mx\/(?:vog|glam)\/)[0-9]*)?\/(.*)_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "/uploads/images/$1$2$3");
        }

        if (domain_nosub === "ykt.ru" ||
            domain_nosub === "ykt2.ru") {
            return src.replace(/\/thumb\/([^/]*)$/, "/$1");
        }

        if (domain === "i.guim.co.uk") {
            return src.replace(/:\/\/[^/]*\/img\/([^/]*)\/([^?]*).*?$/, "://$1.guim.co.uk/$2");
        }

        if (domain === "media.guim.co.uk") {
            return src
                .replace(/\/((?:[0-9]*_){3}[0-9]*)\/[^/]*\/([0-9]*\.[^/.]*)$/, "/$1/$2")
                .replace(/(\/[0-9]+_[0-9]+_([0-9]+)_[0-9]+\/)[0-9]+(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain_nowww === "myproana.com" ||
            domain_nowww === "tesall.ru") {
            return src
                .replace(/(\/uploads\/gallery\/(?:album|category)_[0-9]+\/)[a-z]+_(gallery_[0-9]+[^/]*\.[^/.]*)$/, "$1$2")
                .replace(/(\/uploads\/profile\/photo-)thumb-([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "g2d.co.in") {
            return src.replace(/(\/img\/+Photo\/+[0-9]+\/+)(?:sml|med)_([^/]*\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "vogue.gjstatic.nl" ||
            domain === "glamour.gjstatic.nl") {
            return src
                .replace(/\/teaserFileUpload\//, "/fileUpload/") // doesn't work on all
                .replace(/\/fileUpload\/[^/]*\//, "/fileUpload/big/");
        }

        if (domain_nosub === "favim.com" && domain.match(/s[0-9]*\.favim\.com/)) {
            return src.replace(/(:\/\/[^/]*\/)[^/]*\//, "$1orig/");
        }

        if (domain === "derpicdn.net") {
            return src.replace(/\/(?:thumb|large)(\.[^/.]*)$/, "/full$1");
        }

        if (domain_nosub === "iimg.me") {
            newsrc = src.replace(/.*\/[a-z]*\.php.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src && newsrc.indexOf("http") === 0) {
                return decodeURIComponent(newsrc);
            }
        }

        if (domain === "pix.avaxnews.com" ||
            domain_nowww === "pxhst.co") {
            return src.replace(/_[^/]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "i.hurimg.com" ||
            domain === "img.posta.com.tr" ||
            domain === "icdn.pstimg.com" ||
            domain === "img.fanatik.com.tr" ||
            domain === "assets.dogannet.tv" ||
            domain === "i.cnnturk.com") {

            return src.replace(/\/[0-9]+\/[0-9]+x[0-9]+\/([0-9a-f]+(?:\.[^/.]*)?)(\?.*)?$/, "/100/0x0/$1");
        }

        if (domain === "www.kurtkomaromi.com" ||
            domain_nosub === "typepad.com" ||
            domain === "blogs.elpais.com" ||
            domain === "www.summerofdan.net" ||
            domain_nowww === "thequeenofstyle.com" ||
            domain_nowww === "thequestforit.com" ||
            domain === "www.weeklystorybook.com") {
            return src.replace(/(\/\.a\/[^-/]*)-[^/]*$/, "$1");
        }

        if (domain_nowww === "bathingnews.com") {
            return {
                can_head: false,
                url: src.replace(/(\/\.a\/[^-/]*)-[^/]*$/, "$1")
            };
        }

        if (domain === "gd.image-qoo10.jp") {
            return src.replace(/\.[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.jakpost.net") {
            return [
                src.replace(/\.[^/.]*(\.[^/.]*)$/, "$1"),
                src.replace(/\._[a-z]+(\.[^/.]*)$/, "._large$1")
            ];
        }

        if (domain === "r.ddmcdn.com") {
            return src.replace(/:\/\/[^/]*\/(?:[^/_]*_[^/_]*\/)*/, "://static.ddmcdn.com/");
        }

        if (domain_nosub === "newegg.com" && domain.match(/images[0-9]*\.newegg\.com/)) {
            return src.replace(/(:\/\/[^/]*\/)(?:NeweggImage\/)?(?:ProductImage|productimage)[^/]*\//, "$1ProductImageOriginal/");
        }

        if (domain === "images.costco-static.com" ||
            domain === "images.costcobusinesscentre.ca") {
            return src
                .replace(/([?&])recipeName=[^&]*/, "$1")
                .replace(/&$/, "");
        }

        if (amazon_container === "emerge-tech") {
            return src.replace(/\/[a-z]*\/([0-9]*_[a-z]*_)[a-z]*(\.[^/.]*)$/, "/full/$1full$2");
        }

        if (domain_nosub === "wfcdn.com" && domain.match(/img[0-9]*(?:-[^.]*)?\.wfcdn\.com/)) {
            return src.replace(/(\/im\/[0-9]+\/)[^/]*\//, "$1compr-r85/");
        }

        if (domain_nosub === "hdnux.com") {
            return src.replace(/\/[0-9]+x[0-9]+(\.[^/.]*)$/, "/rawImage$1");
        }

        if (domain_nosub === "busan.com" && domain.match(/news[0-9]*\.busan\.com/)) {
            return src.replace(/_t(\.[^/.]*)$/, "_0$1");
        }

        if (amazon_container === "bucket.scribblelive.com" ||
            domain === "images.scribblelive.com") {
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (false && domain === "cdn.images.express.co.uk") {
        }

        if (domain === "www.dhresource.com" ||
            domain === "image.dhgate.com") {
            return src
                .replace(/(:\/\/[^/]*\/albu_[0-9]+_[0-9]+[-/].*?)[0-9]+x[0-9]+/, "$10x0")
                .replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+/, "$10x0")
                .replace(/(:\/\/[^/]*\/)[^/]*\/[^/]*\/[0-9]+x[0-9]+\//, "$10x0/");
        }

        if (domain === "storify.com" &&
            src.indexOf("/services/proxy/") >= 0) {
            return src.replace(/.*\/services\/proxy\/[0-9]+\/[^/]*\/([a-z]+)\/(.*)$/, "$1://$2");
        }

        if (domain === "www.mbcsportsplus.com") {
            if (src.match(/[?&]type=m[^a-z0-9A-Z]/))
                return src.replace(/\/images\/img\.php.*?[?&]src=([^&]*).*/, "/data/home/data/msplMain");
        }

        if (domain_nosub === "joomag.com" && domain.match(/s[0-9]*cdn\.joomag\.com/)) {
            return src.replace(/(\/mobile\/.*\/[0-9]+_)[0-9]+(-[0-9]*\.[^/]*)$/, "$10$2");
        }

        if (domain === "i.pximg.net") {
            newsrc = src
                .replace(/\/c\/[0-9]+x[0-9]+(?:_[0-9]+)?(?:_[a-z]+[0-9]+)?\//, "/")
                .replace(/\/img-master\//, "/img-original/")
                .replace(/(\/[0-9]+_p[0-9]+)_[^/]*(\.[^/.]*)$/, "$1$2");

            var referer_url = "https://www.pixiv.net/member_illust.php?mode=medium&illust_id=" + src.replace(/.*\/([0-9]+)_[^/]*$/, "$1");
            return fillobj_urls(add_extensions(newsrc), {
                headers: {
                    Referer: referer_url
                },
                extra: {
                    page: referer_url
                }
            });
        }

        if (domain_nosub === "booth.pm" && domain.match(/s[0-9]*\.booth\.pm/)) {
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

        if (domain === "booth.pximg.net") {
            newsrc = src.replace(/(:\/\/[^/]*\/)c\/[0-9]+x[0-9]+(?:_[^/]*)?\//, "$1");
            if (newsrc !== src)
                return add_extensions(newsrc);

            return add_extensions(src.replace(/(\/[-0-9a-f]+)_[^/.]*(\.[^/.]*)$/, "$1$2"));
        }

        if (domain === "cache-graphicslib.viator.com") {
            return {
                url: src.replace(/([-_][0-9]+)-[^-_/.]*(\.[^/.]*)$/, "$1-raw$2"),
                head_wrong_contentlength: true
            };
        }

        if (domain === "igx.4sqi.net") {
            return src.replace(/\/img\/general\/[^/]*\//, "/img/general/original/");
        }

        if (domain === "static.panoramio.com" ||
            googlestorage_container === "static.panoramio.com") {
            return src.replace(/\/photos\/[^/]*\//, "/photos/original/");
        }

        if (domain_nosub === "myportfolio.com" && domain.match(/.*cdn.*\.myportfolio\.com$/)) {
            return src.replace(/_rw_[0-9]+(\.[^/.?]*)(?:\?.*)?$/, "$1");
        }

        if (domain === "i.dell.com") {
            return src.replace(/(\/(?:[0-9a-f]+-){4}[0-9a-f]+\/[0-9]+\/)LargePNG/, "$1originalpng");
        }

        if (domain === "thumb.zumst.com") {
            return src.replace(/.*:\/\/[^/]*\/[0-9]+[^/]*\//, "");
        }

        if ((domain_nosub === "zumst.com" ||
             domain_nosub === "zum.com") &&
            domain.match(/^static\./)) {
            return src.replace(/\/([0-9a-f]+)_[0-9]+x[0-9]+[a-z]?(\.[^/.]*)(?:[?#].*)?$/, "/$1$2");
        }

        if (domain === "file.mk.co.kr") {
            return src
                .replace(/\.thumb$/, "");
        }

        if (domain === "kobis.or.kr") {
            return src.replace("/thumb/thn_", "/");
        }

        if (domain === "www.breaknews.com" ||
            domain === "breaknews.com") {
            return src.replace(/\/data\/([^/]*)\/mainimages\/[0-9]*\/([0-9]{6})/, "/imgdata/$1/$2/$2");
        }

        if (domain_nowww === "ilyo.co.kr" ||
            domain_nowww === "ohfun.net") {
            return src.replace(/\/thm[0-9]+_/, "/");
        }

        if (domain === "www.joseilbo.com") {
            return src
                .replace(/\.thumbnail(\.[^/.]*)$/, "$1")
                .replace(/\/gisa_img\/([0-9]+_[^/._]+)(\.[^/.]*)$/, "/gisa_img_origin/$1_origin$2");
        }

        if (domain_nosub === "phncdn.com") {
            return add_extensions_gif(src.replace(/\/(?:\([a-z]+=[^/)]*\))*([^/]*)$/, "/$1"));
        }

        if (domain_nosub === "t8cdn.com") {
            return src.replace(/(\/originals\/[0-9]+)(?:\([a-z]+=[^/)]*\))*([^/]*)$/, "$1$2");
        }

        if (domain === "cci.xnxx.fan") {
            return src.replace(/(\/original\/)(?:\([a-z]+=[^/)]*\))*([^/]*)$/, "$1$2");
        }

        if (domain === "img.fril.jp") {
            return src.replace(/\/[a-z]\/([^/]*)$/, "/l/$1");
        }

        if (domain === "img.cinematoday.jp") {
            return src
                .replace(/-[a-z0-9]*x[a-z0-9]*(\.[^/.]*)$/, "$1")
                .replace(/\/_size_[^/]*\//, "/");
        }

        if (domain_nosub === "seesaa.net" ||
            (domain_nowww === "fanblogs.jp" && src.indexOf("/file/") >= 0)) {
            return src.replace(/-thumbnail[0-9]*(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (false && domain_nosub === "biglobe.ne.jp") {
        }

        if (domain_nosub === "ledevoir.com" && domain.match(/media[0-9]*\.ledevoir\.com/)) {
            return src.replace(/\/images_galerie\/(?:[^-/._]*_)?([0-9]+_[0-9]+)\//, "/images_galerie/nwdp_$1/");
        }

        if (domain === "infotel.ca") {
            return src.replace(/\/medialibrary\/image\/[^-_/.]*-/, "/medialibrary/image/orig-");
        }

        if ((domain === "www.eleconomista.com.mx" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "informador.mx" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "eldeber.com.bo" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "chispa.tv" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "debate.com.mx" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "diarioshow.com" && src.indexOf("/img/") >= 0) ||
            (domain === "wp.eldeber.com.bo" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "tribuna.com.mx" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "nacionrex.com" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "enpareja.com" && src.indexOf("/img/") >= 0) ||
            (domain === "laverdadnoticias.com" && src.indexOf("/img/") >= 0)) {
            return src.replace(/(\/[^/.]*\.[^/._]*)_[^/.]*\.[^/.]*$/, "$1");
        }

        if (domain === "gcm-v2.omerlocdn.com") {
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.dailystar.com.lb" ||
            domain === "dailystar.com.lb") {
            return src.replace(/([0-9]+)(?:_[^0-9][^/.]*)*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "images.dailykos.com") {
            return src.replace(/(\/(?:images|avatars)\/[0-9]+\/)[^/]*\/([^/]*)$/, "$1original/$2");
        }

        if (domain_nowww === "imgmax.com" ||
            domain_nowww === "404store.com" ||
            domain_nowww === "imgpost.co.uk" ||
            domain === "ap.imagensbrasil.org" ||
            domain_nowww === "picture-post.com" ||
            domain_nowww === "stakimages.me" ||
            domain_nowww === "imgsnap.com" ||
            domain === "img.imgmax.com" ||
            domain_nowww === "imgpile.com" ||
            domain === "i.img.ie" ||
            domain === "i.lensdump.com" ||
            domain === "img.faploads.com" ||
            (domain_nowww === "celebact.org" && src.indexOf("/images/") >= 0) ||
            domain_nosub === "imghost.io" ||
            domain_nosub === "img26.com" ||
            (domain_nowww === "cheapesthosting.xyz" && src.indexOf("/i/images/") >= 0) ||
            domain_nowww === "s4tu.com" ||
            domain_nowww === "jiopic.com" ||
            domain_nowww === "beautifulmodels.xyz" ||
            domain === "images.superimg.com" ||
            (domain_nowww === "ultraimg.com" && src.indexOf("/images/") >= 0) ||
            (domain_nowww === "celebfeetpics.com" && src.indexOf("/images/") >= 0) ||
            domain_nowww === "image-bugs.com") {
            return src.replace(/\.(?:th|md)(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "cheapesthosting.xyz") {
            return src.replace(/\/upload\/[a-z]+(\/[0-9]+\/[0-9]+\/[0-9]+\/)/, "/upload/big$1");
        }

        if (domain === "static.maxmodels.pl") {
            if (src.indexOf("/photos/") >= 0 || src.indexOf("/article/") >= 0) {
                return src.replace(/_thumb(\.[^/.]*)$/, "$1");
            }

            if (src.indexOf("/profile/") >= 0) {
                return src.replace(/_[a-z]+(\.[^/.]*)$/, "_profile$1");
            }
        }

        if (domain_nosub === "img.yt") {
            return src.replace("/small/", "/big/");
        }

        if (domain === "cdn.wallpaperjam.com") {
            return src.replace(/\/static\/images\/.*?\/([a-f0-9]+)(\.[^/.]*)$/, "/$1/image$2");
        }

        if (domain === "cdn.oboi7.com") {
            return src.replace(/\/static\/images\/[a-z]\//, "/content/images/");
        }

        if (domain === "media.tabloidbintang.com") {
            return src.replace(/\/thumb\/([^/]*\.[^/.]*)(?:\/.*)/, "/$1");
        }

        if (domain === "media.teen.co.id") {
            return src.replace(/\/thumb\/([^/?]*\.[^/.?]*).*?[?&](p=[^&]*).*/, "/view/$1?$2");
        }

        if ((domain_nosub === "hudong.com" && domain.indexOf(".att.hudong.com") >= 0) ||
            (domain_nowww === "kaigai-drama-board.com" && src.indexOf("/assets/medias/") >= 0)) {
            newsrc = src.replace(/_s(\.[^/.]*)$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "hudong.com" && domain.indexOf(".att.hudong.com") >= 0) {
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "ihanyu.com") {
            return src.replace(/\/cache\/([^/]*)\/([^/]*\/[0-9]+\/[0-9]+\/)[0-9]+\/([0-9]+\.[^/.]*)$/, "/uploadfile/$1/$2$3");
        }

        if (domain === "imgsh.jpnxcn.com" ||
            domain_nowww === "gongl8.com" ||
            domain === "upload.mcchina.com" ||
            domain_nowww === "suanning.com" ||
            domain === "upload.site.cnhubei.com" ||
            domain_nowww === "artsbj.com" ||
            domain === "img.94hnr.com" ||
            (domain_nosub === "ablwang.com" && domain.match(/m[0-9]*\.ablwang\.com/))) {
            return src.replace(/\/thumb_[0-9]+_[0-9]+_/, "/");
        }

        if (domain_nowww === "gaobei.com" &&
            src.indexOf("/upload/") >= 0) {
            return src.replace(/_[a-z](\.[^/.]*)$/, "_b$1");
        }

        if (domain_nosub === "pstatp.com" && domain.match(/[pi][a-z]?[0-9]*\.pstatp\.com/)) {
            return src.replace(/(:\/\/[^/]*\/)[a-z]*\/(?:[0-9]+x[0-9]+\/)?/, "$1origin/");
        }

        if (domain === "img-bcy-qn.pstatp.com") {
            return src
                .replace(/(\/post\/[a-z0-9]+\/[a-z0-9]+\.[^/.]*)\/[^/]*(?:[?#].*)?$/, "$1")
                .replace(/(\/avatar\/[0-9]+\/[a-f0-9]+\/[^/]*\.[^/.]*)\/[^/]*(?:[?#].*)?$/, "$1");
        }

        if (domain === "img.jizy.cn") {
            return src.replace(/\/img\/[a-z]\//, "/img/l/");
        }

        if (domain === "v.img.pplive.cn") {
            return src.replace(/(:\/\/[^/]*\/)sp[0-9]+\//, "$1");
        }

        if (domain === "uploadfile.bizhizu.cn") {
            return src.replace(/(\/[0-9a-f]*\.)([^/.]*)(?:\.[0-9]+\.[0-9]+\.[^/.]*)?$/, "$1$2.source.$2");
        }

        if (domain_nosub === "tgbusdata.cn" ||
            domain_nosub === "tuwandata.com") {
            return src.replace(/.*\/thumb\/[^/]*\/[^/]*\/u\//, "http://");
        }

        if (domain_nowww === "dajiazhao.com" ||
            domain_nowww === "hscbw.com" ||
            domain_nowww === "xgkoushi.com" ||
            domain_nowww === "youdew88yl.com" ||
            domain_nowww === "ynjzsf.com") {
            return src.replace(/(\/(?:uploads|upfile)\/allimg\/[0-9]+\/[0-9A-Z]+-[0-9A-Z]+)(?:-lp)(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.renwenjun.com") {
            return src.replace(/_lit(\.[^/.]*)$/, "_0$1");
        }

        if (domain_nowww === "lrfczp.com") {
            return src.replace(/_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "img-toutiao.mia.com") {
            return src.replace(/\&.*/, ""); // removing @ works, but forces download, and very big images have imgScale so it's probably fine
        }

        if (domain_nosub === "xeeok.com" && domain.indexOf("pic.xeeok.com") >= 0) {
            return src.replace(/_s[0-9]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.laonanren.com" ||
            domain === "cf.whl4u.jp") {
            return src.replace(/t(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "xuite.net" && domain.indexOf(".share.photo.xuite.net") >= 0) {
            return src.replace(/_[a-zA-Z](\.[^/.]*)$/, "_y$1");
        }

        if (domain === "img.sportsv.net") {
            return src.replace(/\/[a-z]+-([^-/]*)-[0-9a-z]*x[0-9a-z]*(\.[^/.]*)$/, "/$1$2");
        }

        if (domain_nosub === "espncdn.com") {
            newsrc = decodeURIComponent(src.replace(/\/combiner\/i\?img=([^&]*).*/, "$1"));
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/(\/r[0-9]+)(?:_[^/.]*)(\.[^/.]*)$/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "fc2.com" && domain.match(/blog-imgs-[0-9]*(?:-[^.]*)?.*\.fc2\.com/)) {
            return src
                .replace(/:\/\/(blog-imgs-[0-9]*)\./, "://$1-origin.")
                .replace(/([/_][0-9]{8,}[^-/._]+)s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "photos.hancinema.net" ||
            domain === "www.hancinema.net") {
            return src.replace(/\/photos\/[a-z]*(photo[0-9]*\.[^/.]*)$/, "/photos/fullsize$1");
        }

        if (domain === "inimura.com" ||
            domain_nowww === "celebritydresses.shop" ||
            domain_nowww === "thecelebritydresses.us" ||
            domain_nowww === "customcelebritydresses.com" ||
            domain_nowww === "realistgold.com" ||
            domain_nowww === "supersoccershop.com" ||
            domain_nowww === "cheap-promdresses.com" ||
            domain_nowww === "weandestudio.com" ||
            domain_nowww === "black-leatherjacket.com" ||
            domain_nowww === "kpopultra.net" ||
            domain_nowww === "myhaircare.com.au" ||
            domain_nowww === "ultimateapparels.com" ||
            domain_nowww === "cajalwinterconference.es" ||
            domain_nowww === "justfashionnow.com" ||
            domain_nowww === "honeydear.my") {
            return src
                .replace(/\/image_cache\/+resize\/+[0-9]+x[0-9]+\/+image\/+/, "/image/")
                .replace(/\/cache\/(.*)-[0-9]+x[0-9]*(?:-[a-z_]+)?(?:_[0-9]+)?(\.[^/.]*)$/, "/$1$2");
        }

        if (domain_nowww === "i-aurai.com" ||
            domain_nowww === "onesieponatime.com" ||
            domain_nowww === "ucanstarjob.com" ||
            domain === "beniko.ninethemes.net" ||
            domain_nowww === "duvardamoda.com" ||
            domain_nowww === "fresh38.ru" ||
            domain_nowww === "malaysiadropship.com") {
            return src.replace(/\/image\/cache\/([a-z]+)\/(.*)-[0-9]+x(?:[0-9]+(?:[wh])?)?(?:\.[a-z_]+)?(\.[^/.]*)$/, "/image/$1/$2$3");
        }

        if (domain === "www.outlookweekly.net" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/.*:\/\/[^/]*\/images\//, "http://");
        }

        if (domain === "www.cdn.tv2.no") {
            return src.replace(/\/images.*?[?&]imageId=([0-9]+).*/, "/images?imageId=$1&height=-1");
        }

        if (domain === "media-spiceee.net") {
            return src.replace(/\/(?:large|small|thumb_lg|thumb)_([^/]*)$/, "/$1");
        }

        if (domain_nowww === "vettri.net") {
            return src.replace(/\/thumb\/([^/]*)_resize(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "www.tiarashop.eu" ||
            domain === "streetstylestore.com" ||
            domain === "cdn.poplook.com" ||
            domain === "www.directgardening.com" ||
            domain_nowww === "kanedashop.com" ||
            domain === "www.myamericanmarket.com" ||
            domain_nowww === "lapakfiguremiina.com" ||
            (domain_nosub === "nin-nin-game.com" && domain.match(/^media[0-9]*\.nin/)) ||
            domain_nowww === "adintime.com" ||
            domain === "shop.marymary.gr" ||
            domain_nowww === "evawigs.com" ||
            domain_nowww === "tehrankbs.pw" ||
            domain === "flyhighstore.pl") {
            return src
                .replace(/(:\/\/[^/]*\/img\/.*\/[0-9]*)[-_][^/.]*(\.[^/.]*)$/, "$1$2")
                .replace(/(:\/\/[^/]*\/[0-9]+(?:-[0-9]+)?)(?:[-_][^/]*?)?(\/[^/]*)$/, "$1$2");
        }

        if (domain === "skinzwearphotography.com") {
            return src.replace(/\/prod[A-Z][a-z]*\//, "/prodImages/");
        }

        if (domain_nowww === "shelot.com") {
            return src.replace(/\/upload\/thumbnails\/[0-9]+x[0-9]+[^/]*\//, "/upload/");
        }

        if (domain === "xo.lulus.com") {
            return src.replace(/(\/images\/[^/]*\/)[^/]*\/([^/]*)$/, "$1w_1.0/$2");
        }

        if (domain === "in-tense.se") {
            return src
                .replace(/\/thumbnails\/[^/]*\//, "/")
                .replace(/(\.[^/._])*_[^/]*$/, "$1");
        }

        if (domain === "image.brazilianbikinishop.com") {
            return src.replace(/\/cache_images\/([^/_]*)_[^/.]*(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "greasyfork.org" &&
            src.search(/\/system\/screenshots\//) >= 0) {
            return src.replace("/thumb/", "/original/");
        }

        if (domain === "i.embed.ly") {
            return decodeURIComponent(src.replace(/.*\/(?:display|image).*?[?&]url=([^&]*).*/, "$1"));
        }

        if (domain === "i.genius.com") {
            return decodeURIComponent(src.replace(/.*\/[0-9a-f]+.*?[?&]url=([^&]*).*/, "$1"));
        }

        if (domain_nowww === "hdqwalls.com") {

            return src
                .replace(/\/wallpapers\/[a-z]?thumb\//, "/wallpapers/");
        }

        if (domain === "wallpaperclicker.com") {
            if (src.match(/\/storage\/+Thumb\/+/)) {
                return [
                    src.replace(/\/storage\/+Thumb\/+/, "/storage/wallpaper/"),
                    src.replace(/\/storage\/+Thumb\/+/, "/storage/image/")
                ];
            }

            return src
                .replace(/\/download\/+Image\.aspx.*?[?&]Imagefilename=([^&]*).*?$/, "/storage/Thumb/$1")
                .replace(/\/wallpaper\/+Download\.aspx.*?[?&]wallfilename=([^&]*).*?$/, "/storage/Thumb/$1");
        }

        if (domain_nosub === "prothomalo.com") {
            return src.replace(/\/cache\/images\/[0-9]+x[0-9]+(?:x[0-9]+)\//, "/");
        }

        if (domain === "c.tribune.com.pk") {
            return src.replace(/-[0-9]+-[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "reutersmedia.net") {
            var querystr = src.replace(/.*\/r\/\?/, "&");
            var d = querystr.replace(/.*&d=([^&]*).*/, "$1");
            var t = "2";//querystr.replace(/.*&t=([^&]*).*/, "$1");
            i = querystr.replace(/.*&i=([^&]*).*/, "$1");
            return src.replace(/\/r\/\?.*/, "/r/?d=" + d + "&t=" + t + "&i=" + i);
        }

        if (domain === "r.fod4.com") {
            return src.replace(/^[a-z]*:\/\/[^/]*\/.*\/([a-z]*:\/\/)/, "$1");
        }

        if (domain === "p.fod4.com") {
            return src.replace(/(\/media\/[0-9a-f]+\/)[a-z]=[a-z0-9]+\//, "$1");
        }

        if (domain_nowww === "xdressy.com" ||
            domain_nowww === "starcelebritydresses.com") {
            return src.replace(/-thumb(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "wallpaperflare.com" && src.match(/\/static\//)) {
            return src.replace(/-(?:thumb|preview)(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.store-assets.com") {
            return src.replace(/_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.shopperboard.com") {
            return src.replace(/-[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "gog.com" && domain.match(/images.*\.gog\.com/)) {
            return src.replace(/(\/[0-9a-f]*)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.destructoid.com") {
            return src.replace(/-(?:t|noscale)(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "xboxlive.com" &&
            domain.match(/images.*\.xboxlive\.com/) &&
            src.match(/\/image\?/)) {
            newsrc = src.replace(/\/image[^/]?[?&]url=([^&]*).*/, "/image?url=$1");
            if (newsrc !== src)
                return newsrc;

            return {
                url: src,
                head_wrong_contenttype: true
            };
        }

        if (domain === "musicimage.xboxlive.com") {
            return {
                url: src.replace(/\/image\?.*/, "/image?locale=en-US"),
                can_head: false // GET, OPTIONS
            };
        }

        if (domain === "media.withtank.com") {
            return src.replace(/_[0-9]+_wide(\.[^/.]*)$/, "$1");
        }

        if (domain === "images.cdn.realviewdigital.com") {
            var type = src.match(/[?&]type=([^&]*)/);
            return src.replace(/\?.*/, "?type=" + type[1]);
        }

        if (domain === "proxy.duckduckgo.com") {
            return decodeURIComponent(src.replace(/.*\/iur?\/.*?[?&]u=([^&]*).*/, "$1"));
        }

        if (domain === "static.scientificamerican.com") {
            return src.replace(/(?:_[^/.]*)?(\.[^/.?]*)(?:\?.*)?$/, "_source$1");
        }

        if (domain_nosub === "qwant.com" && domain.match(/s[0-9]*\.qwant\.com/) &&
            src.indexOf("/thumbr/") >= 0) {
            return decodeURIComponent(src.replace(/.*[?&]u=([^&]*).*/, "$1"));
        }

        if (domain === "b.fssta.com") {
            return src.replace(/(\/[^/.]*)\.[^/]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "espn.com" && domain.match(/media\..*\.espn\.com$/)) {
            return src.replace(/(\/[0-9]+\/[0-9]+\/)([^/]*)\/[^/]*(\.[^/.]*)$/, "$1$2\/$2$3");
        }

        if (domain === "img.skysports.com" ||
            domain_nosub === "365dm.com") {
            return src.replace(/(:\/\/[^/]*\/[0-9]*\/[0-9]*\/)[^/]*\/(?:[0-9]*\/)?([^/]*)$/, "$1master/$2");
        }

        if (domain_nosub === "bcbits.com" &&
            domain.match(/f[0-9]*\.bcbits\.com/) &&
            src.indexOf("/img/") >= 0) {
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "_0$1");
        }

        if (domain_nosub === "motherlessmedia.com") {
            return src
                .replace(/(:\/\/cdn[0-9]*\.)thumbs(\.motherlessmedia\.com\/)/, "$1images$2")
                .replace(/\/thumbs\//, "/images/")
                .replace(/-[a-z]*(\.[^/.?]*)(?:\?.*)?$/, "$1");
        }

        if (domain_nosub === "kiev.ua" &&
            domain.indexOf("shram.kiev.ua") >= 0 &&
            src.indexOf("/img/") >= 0) {
            return src
                .replace(/-small(\.[^/.]*)$/, "-big$1")
                .replace(/-w[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (googlestorage_container === "cr-resource" &&
            src.indexOf("/image/") >= 0) {
            return src.replace(/\/[0-9]+(\/[0-9a-f]*\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "iol.pt" &&
            src.indexOf("/multimedia/") >= 0) {
            return src.replace(/(\/id\/[0-9a-f]+)\/[0-9]+(?:\.[0-9a-f]+)?(?:\.[^/.]*)?$/, "$1");
        }

        if (domain === "img.purch.com") {
            return src
                .replace(/\/[a-z]+\/[0-9]+(?:x[0-9]+)?\//, "/o/")
                .replace(/\/[a-z0-9]+-[0-9]+x[0-9]+(?:-[^/]*)?\/o\//, "/o/");
        }

        if ((domain_nosub === "taobaocdn.com" ||
             domain_nosub === "tbcdn.cn") &&
            domain.match(/img[0-9]*\./)) {
            return src.replace(/(\.[^/._]*)_[^/.]*\.[^/.]*$/, "$1");
        }

        if (domain === "www.musictory.com" &&
            src.match(/\/pictures\//)) {
            return src.replace(/\/pictures\/[a-z]*\//, "/pictures/originali/");
        }

        if (domain_nosub === "santabanta.com" && domain.match(/media[0-9]*\.santabanta\.com/)) {
            newsrc = src
                .replace(/_th(\.[^/.]*)$/, "$1")
                .replace(/:\/\/media\.santabanta\.com\/medium[0-9]*\//, "://media1.santabanta.com/full1/");
            if (newsrc !== src)
                return newsrc;

            if (src.match(/\/full[0-9]*\//)) {
                return [
                    src.replace(/\/full[0-9]*\//, "/full8/"),
                    src.replace(/\/full[0-9]*\//, "/full7/"),
                    src.replace(/\/full[0-9]*\//, "/full6/"),
                    src.replace(/\/full[0-9]*\//, "/full5/")
                ];
            }
        }

        if (domain === "www.movieinsider.com" &&
            src.indexOf("/images/p/") >= 0) {
            return src.replace(/\/images\/p\/[0-9]+\//, "/images/p/");
        }

        if (domain_nosub === "kastden.org") {
            return src.replace(/\/thumb\//, "/original/");
        }

        if (domain === "img.hani.co.kr") {
            return src
                .replace(/\/(?:thumbnail|resize)\//, "/original/")
                .replace(/\/[0-9]+_[0-9]+_([0-9]+_[0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "flexible.img.hani.co.kr") {
            return src.replace(/:\/\/[^/]*\/flexible\/.*?\/imgdb\//, "://img.hani.co.kr/imgdb/");
        }

        if (domain === "static.ok.co.uk" ||
            amazon_container === "static.ok.co.uk" ||
            domain === "images.24ur.com" ||
            domain === "image.dnevnik.hr" ||
            domain === "img.bg.sof.cmestatic.com" ||
            domain === "static.altchar.com" ||
            domain === "img.cz.prg.cmestatic.com" ||
            amazon_container === "ns.hitcreative.com") {
            return src.replace(/\/media\/images\/[^/]*\//, "/media/images/original/");
        }

        if (domain_nosub === "galaxypub.vn" && domain.match(/rs[0-9]*\.galaxypub\.vn/)) {
            return src.replace(/:\/\/[^/]*(\/.*?)(?:\?.*)?$/, "://st.galaxypub.vn$1");
        }

        if (domain_nowww === "implanetcorp.com" &&
            src.indexOf("/upload/ctoon/") >= 0) {
            return src
                .replace(/\/[a-z]*\/([0-9]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "doramakun.ru") {
            return src.replace(/\/thumbs\/(.*)-[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "1gr.cz") {
            return src.replace(/(\/[0-9]+\/[0-9]+\/)[^/]*\/([^/]*)$/, "$1org/$2");
        }

        if (domain_nosub === "ancensored.com" &&
            src.match(/\/files\/images\//)) {
            return src.replace(/(\/[0-9a-f]*)(?:_[a-z]*)?(\.[^/.]*)$/, "$1_full$2");
        }

        if (domain_nowww === "desktopbackground.org" ||
            domain_nowww === "desktop-background.com") {
            return src
                .replace(/\/download\/[^/]*\//, "/download/o/")
                .replace(/(:\/\/[^/]*)\/[pt]\//, "$1/download/o/");
        }

        if (domain === "image.mlive.com" ||
            domain === "image.nj.com" ||
            domain === "image.cleveland.com") {
            return src.replace(/:\/\/image\.([^/]*)\/home\/[a-z]+-media\/[^/]*\/img\//, "://media.$1/");
        }

        if (domain_nosub === "hwcdn.net") {
            return src.replace(/\/galleries\/[^/]*\//, "/galleries/full/");
        }

        if (domain === "aws-foto.amateri.com") {
            return src.replace(/\/[0-9]+x[^/.]*(\.[^/.]*)$/, "/x$1");
        }

        if (domain === "cdn.tobi.com") {
            return src
                .replace(/\/product_images\/[a-z]+\//, "/product_images/lg/")
                .replace(/(\/[^/.@]*)(\.[^/.]*)$/, "$1@2x$2");
        }

        if (domain === "www.rfa.org") {
            return src.replace(/\/@@images\/.*/, "");
        }

        if (domain === "resize.blogsys.jp") {
            return src.replace(/^[a-z]*:\/\/.*\/([a-z]*:\/\/.*)$/, "$1");
        }

        if (amazon_container === "bw-1651cf0d2f737d7adeab84d339dbabd3-gallery") {
            return src.replace(/_[a-z]+(\.[^/.]*)$/, "_original$1");
        }

        if (domain_nosub === "rl0.ru" && domain.match(/img[0-9]*\.rl0\.ru/)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[a-z0-9]+\/c?[-0-9]+x[-0-9]+\//, "http://");
        }

        if (domain_nosub === "wanelo.com" && domain.match(/cdn-img-[0-9]+\.wanelo\.com/)) {
            return src.replace(/\/[^/.]*(\.[^/.]*)$/, "/full_size$1");
        }

        if (domain === "static.kvraudio.com") {
            return src.replace(/(:\/\/[^/]*\/i\/)[a-z]\//, "$1b/");
        }

        if (domain === "contents.dt.co.kr") {
            return src.replace(/\/thum\/[0-9]+\/([0-9]{6})([0-9]+)_[^/.]*(\.[^/.]*)/, "/images/$1/$1$2$3");
        }

        if (domain === "eng.dt.co.kr") {
            return src.replace(/\/images\/thum\/([0-9]+)/, "/images/oriimg/$1[0]");
        }

        if (domain === "image.ytn.co.kr" ||
            domain === "img.sciencetv.kr") {
            return src
                .replace(/(:\/\/[^/]*\/[^/]*\/jpg\/[^/]*\/[^/]*\/[0-9]+_)[a-z](\.[^/.]*)$/, "$1d$2")
                .replace(/^[a-z]+:\/\/[^/]*\/osen\/+([0-9]{4}\/+[0-9]{2}\/+)([0-9]{6})([0-9]{2})([^/]*)(?:[?#].*)?$/,
                         "http://file.osen.co.kr/article/$1$3/$2$3$4");
        }

        if (domain === "photo.kmib.co.kr") {
            return src.replace(/\/thumb_([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "r.kelkoo.com") {
            return decodeURIComponent(decodeURIComponent(src.replace(/^[a-z]*:\/\/(?:[^/]*\/){7}(http[^/]*).*?$/, "$1")));
        }

        if (domain_nosub === "assetsadobe2.com") {
            if (src.match(/\.jpg(?:\?.*)?$/))
                return src.replace(/(?:\?.*)?$/, "?scl=1");
            else
                return src.replace(/(?:\?.*)?$/, "?scl=1&fmt=png-alpha");
        }

        if (domain === "sm.ign.com") {
            return src.replace(/\.[0-9]+\.([^/.]*)$/, ".999999999999999.$1");
        }

        if ((domain === "shop.unitedcycle.com" ||
             domain_nowww === "4my3boyz.com") &&
            src.indexOf("/images/thumbs/") >= 0) {
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "imgr.es") {
            return src.replace(/\/thumb$/, "");
        }

        if (domain_nosub === "frgimages.com" ||
            domain === "images.footballfanatics.com") {
            newsrc = decodeURIComponent(src.replace(/\/FFImage\/thumb.aspx.*?[?&]i=([^&]*).*/, "$1"));
            if (newsrc !== src)
                return newsrc;

            return src
                .replace(/_[a-z]+(\.[^/.?&]*)$/, "_full$1");
        }

        if (domain === "myanimelist.cdn-dena.com") {
            return src.replace(/\/r\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain === "picture-cdn.wheretoget.it") {
            return src.replace(/(\/[a-z0-9]*-[a-z])[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "sl.sbs.com.au") {
            return src.replace(/(\/public\/image\/file\/[-a-f0-9]*)\/.*/, "$1");
        }

        if ((domain_nosub === "prezly.com" && domain.indexOf(".assets.prezly.com") >= 0) ||
            domain === "cdn.slant.co") {
            return src.replace(/(:\/\/[^/]*\/[-a-f0-9]*\/).*/, "$1-");
        }

        if (domain === "leonardo.osnova.io") {
            return src.replace(/(:\/\/[^/]*\/[-a-f0-9]*\/)-\/.*/, "$1");
        }

        if (domain === "cdn.iview.abc.net.au") {
            return src.replace(/\/thumbs\/[0-9]+\//, "/thumbs/i/");
        }

        if (domain_nosub === "ipstatic.net") {
            newsrc = decodeURIComponent(src.replace(/.*\/img.*?[?&]url=([^&]*).*?$/, "$1"));
            if (newsrc !== src)
                return newsrc;

            return src.replace(/\/thumbs\/[0-9]+x[0-9]+\//, "/photos/");
        }

        if (domain === "image.fnnews.com") {
            return src
                .replace(/(\/[a-z]?[0-9]+)_[a-z](\.[^/.]*)/, "$1$2");
        }

        if (domain_nosub === "kym-cdn.com") {
            return add_extensions({
                url: src.replace(/(:\/\/[^/]*\/[^/]*\/(?:images|icons)\/)[^/]*\//, "$1original/"),
                is_original: true
            });
        }

        if (domain === "cmeimg-a.akamaihd.net" ||
            domain === "leafimg-a.akamaihd.net") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/(?:[0-9]+(?:x[0-9]+)?|x[0-9]+|cute-article-rcp)\/([^/.]*\.[^/]*\/.*)/, "http://$1");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/^([a-z]+:\/\/[^/]*\/)(?:[0-9]+(?:x[0-9]+)?|x[0-9]+)\//, "$1default/");
        }

        if ((domain_nosub === "luxnet.ua" && domain.match(/imagecdn[0-9]*\.luxnet\.ua/)) ||
            domain_nowww === "beztabu.net" ||
            domain_nowww === "24tv.ua" ||
            domain_nowww === "lux.fm") {
            return src.replace(/\/[0-9]+(?:x[0-9]+)?_DIR\//, "/");
        }

        if (domain === "userstyles.org") {
            return src.replace("/style_screenshot_thumbnails/", "/style_screenshots/");
        }

        if (domain_nosub === "narvii.com" &&
            domain.match(/^[a-z]+[0-9]*\./)) {
            return src.replace(/(\/[0-9a-z]+(?:-[-0-9a-z]+)?_)[^/.]*(\.[^/.]*)/, "$1hq$2");
        }

        if (domain === "img.oastatic.com") {
            return src
                .replace(/\/img\/[0-9]+\/[0-9]+(?:\/fit)?\/([0-9]+)\/([^/]*)$/, "/img/$1/$2")
                .replace(/\/img\/([0-9]+)\/([^/]*)$/, "/img2/$1/full/$2")
                .replace(/\/imgmax\/([0-9]+)\/([^/]*)$/, "/img2/$1/full/$2")
                .replace(/(\/img2\/[0-9]+\/)[^/]*\/([^/]*)$/, "$1full/$2")
                .replace(/\/img2\/([0-9]+)\/full\/([^/]*)$/, "/imgsrc/$1/$2");
        }

        if (domain === "img.valais.ch" ||
            domain === "images.weserv.nl" ||
            domain === "nimg.ws.126.net") {
            return add_http(decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?[?&]url=([^&]*).*/, "$1")));
        }

        if (domain_nosub === "etsystatic.com" &&
            (domain.match(/img[0-9]*\.etsystatic\.com/) ||
             domain === "i.etsystatic.com")) {
            return src.replace(/(\/[a-z]+_)[0-9a-zA-Z]+x[0-9a-zA-Z]+\./, "$1fullxfull.");
        }

        if (domain_nosub === "twnmm.com") {
            return urljoin(src, src.replace(/^[a-z]+:\/\/[^/]*\/thumb.*?[?&]src=([^?&]*).*/, "$1"));
        }

        if (domain === "www.findx.com" &&
            src.indexOf("/api/images/assets/") >= 0) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/api\/images\/assets\/[^/]*\//, "");
        }

        if (domain_nowww === "konsolinet.fi") {
            return src.replace(/(:\/\/[^/]*\/[^/]*\/)[0-9]+x[0-9]+\//, "$1");
        }

        if ((domain_nosub === "vigbo.com" ||
             domain_nosub === "gophotoweb.com") &&
            domain.match(/^static[0-9]*\./)) {
            return src.replace(/\/[0-9]+-((?:[^/]*-)?[a-f0-9]{20,}\.[^/.]*)$/, "/2000-$1");
        }

        if (domain_nosub === "feelway.com" && domain.match(/img[0-9]*.feelway\.com/)) {
            return src.replace(/(\/[0-9]+\/)small([^/]*)$/, "$1$2");
        }

        if (domain_nosub === "pichunter.com") {
            newsrc = src.replace(/(:\/\/[^/]*\/+(?:[0-9]+\/+[0-9]+\/+[0-9]+\/+)?[0-9]+_[0-9]+)(?:_[a-z])?(\.[^/.]*)(?:[?#].*)?$/, "$1_o$2");
            if (newsrc !== src) {
                return {
                    url: newsrc,
                    headers: {
                        Referer: "https://www.pichunter.com/"
                    }
                };
            }
        }

        if (domain === "appdb.winehq.org") {
            return src.replace(/(\/appimage\.php.*?)([?&])bThumbnail=[^&]*/, "$1$2").replace(/&$/, "");
        }

        if (domain_nosub === "ikea.com" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/([-_][sS])[0-9](\.[^/.]*)/, "$15$2");
        }

        if (domain === "img.onestore.co.kr") {
            return src.replace(/\/[0-9]+_[0-9]+_(?:F[0-9]+_)?[0-9]+\//, "/0_0_100/");
        }

        if (domain_nosub === "ismcdn.jp" ||
            domain_nowww === "afpbb.com") {
            return src.replace(/\/[0-9]+[xm](?:[0-9]+)?(\/[^/]*)$/, "/-$1");
        }

        if (domain_nosub === "yomiuri.co.jp" && src.indexOf("/photo/") >= 0) {
            return src.replace(/-[A-Z0-9](\.[^/.]*)$/, "-L$1");
        }

        if (domain_nosub === "newswitch.jp" && domain.match(/c[0-9]*\.newswitch\.jp/)) {
            return decodeURIComponent(src.replace(/^[a-z]*:\/\/[^/]*\/cover.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "www.fashion-headline.com") {
            return src.replace(/\/api\/image\/(?:width|height)\/[0-9]+\//, "/");
        }

        if (domain_nosub === "stream.ne.jp" && domain.indexOf("cdnext.stream.ne.jp") >= 0) {
            return src.replace(/(\/[0-9a-f]+)_[0-9]*_[0-9]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "kn3.net") {
            return src.replace(/\/(?:c_)?[0-9]+x[0-9]+_([0-9A-Z]*\.[^/.]*)$/, "/$1");
        }

        if (domain_nosub === "ptcdn.info") {
            return src.replace(/([-_])[a-z](\.[^/.]*)$/, "$1o$2");
        }

        if (domain_nosub === "pikabu.ru") {
            return src.replace(/\/post_img\/([0-9]+)\//, "/post_img/big/$1/");
        }

        if (domain_nosub === "podium.life") {
            return src.replace(/\/content\/r\/[wh]?[0-9]*(?:x[0-9]+)?\//, "/content/");
        }

        if (domain_nosub === "filesor.com" && false) {
            return src.replace(/_(?:[a-z]|[0-9])(\.[^/.]*)/, "$1");
        }

        if (domain_nowww === "namooactors.com") {
            return src.replace(/\/thumb(?:_[^/]*)?\/[a-z]+_[0-9]+(?:px|X[0-9]+)_(.*?\.[^/.]*)\.[^/.]*$/, "/$1");
        }

        if (domain_nowww === "ftopx.com" ||
            domain_nowww === "goodwp.com" ||
            domain_nowww === "kartinkijane.ru" ||
            domain_nowww === "nastol.com.ua" ||
            domain_nowww === "artleo.com") {
            var prefix;

            if (domain_nowww === "ftopx.com") {
                var timestamp = parseInt(src.replace(/.*[/_]([a-f0-9]{10,})\.[^/.]*$/, "$1"), 16);
                prefix = ["ftop.ru", "ftopx.com"];
                if (timestamp > 1579484587755500)
                    prefix = ["ftopx.com", "ftop.ru"];
            } else {
                prefix = domain_nosub;
            }

            regex = /\/(?:(?:mini?|large)|pic\/+[0-9]+x[0-9]+)\/+([0-9]+)\/+([^/]*)$/;

            if (prefix instanceof Array) {
                var urls = [];
                for (i = 0; i < prefix.length; i++) {
                    urls.push(src.replace(regex, "/images/$1/" + prefix[i] + "_$2"));
                }
                return urls;
            } else {
                return src.replace(regex, "/images/$1/" + prefix + "_$2");
            }
        }

        if (domain_nowww === "wykop.pl" && src.indexOf("/cdn/") >= 0) {
            return src.replace(/,[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "phoronix.net") {
            return src.replace(/(\/image\.php.*?[?&]image=[^&]*)_med/, "$1");
        }

        if (domain === "image.diyidan.net") {
            return {
                url: src.replace(/!.*/, ""),
                headers: {
                    Referer: "https://www.diyidan.com/"
                }
            };
        }

        if (domain === "www.hrkgame.com" &&
            src.indexOf("/.thumbnails/") >= 0) {
            return src.replace(/\/\.thumbnails\/([^/]*)\/.*/, "/$1");
        }

        if (domain_nowww === "dlcompare.com" &&
            src.indexOf("/upload/cache/") >= 0) {
            return src.replace(/\/upload\/cache\/[^/]*\//, "/");
            /*newsrc = src.replace(/\/upload\/cache\/[^/]*\/upload\//, "/upload/");
            if (newsrc !== src)
                return newsrc;
            return src.replace(/\/upload\/cache\/[^/]*\//, "/upload/cache/slider/");*/
        }

        if (domain_nosub === "alphacoders.com" &&
            (domain.match(/images[0-9]*\.alphacoders\.com/) ||
             domain === "artfiles.alphacoders.com" ||
             domain === "picfiles.alphacoders.com" ||
             domain === "avatarfiles.alphacoders.com" ||
             domain === "coverfiles.alphacoders.com" ||
             domain === "photofiles.alphacoders.com")) {
            return src.replace(/\/thumb(?:-[0-9]*)?-([0-9]*\.[^/.]*)$/, "/$1");
        }

        if (domain === "mfiles.alphacoders.com" &&
            options && options.cb && options.do_request) {
            id = src.replace(/.*\/thumb(?:-[0-9]*)?-([0-9]+)\.[^/.]*$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "https://mobile.alphacoders.com/wallpapers/view/" + id + "/",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/"([a-z]+:\/\/wall\.alphacoders\.com\/big\.php\?i=[0-9]+)"/);
                            if (match) {
                                options.do_request({
                                    url: match[1],
                                    method: "GET",
                                    onload: function(resp) {
                                        if (resp.readyState === 4) {
                                            var match = resp.responseText.match(/<meta *property="og:image" *content="([^"]*)"/);
                                            if (match) {
                                                options.cb(match[1]);
                                            } else {
                                                options.cb(null);
                                            }
                                        }
                                    }
                                });
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "gpstatic.com") {
            return src.replace(/\/(s[0-9]*)_thumb(-[a-f0-9]*\.[^/.]*)$/, "/$1$2");
        }

        if (domain_nosub === "walldevil.com") {
            return src.replace(/\/(?:thumb|preview)\//, "/");
        }

        if (domain === "www.peency.com" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/_[^/._]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.wallpaperbetter.com" &&
            src.indexOf("/wallpaper/") >= 0) {
            return src.replace(/-(?:thumb|middle-size)(\.[^/.]*)$/, "$1");
        }

        if (domain === "thiswallpaper.com" &&
            src.indexOf("/cdn/") >= 0) {
            return src.replace("/cdn/thumb/", "/cdn/hdwallpapers/");
        }

        if (domain === "booklikes.com" &&
            src.indexOf("/upload/") >= 0) {
            return src.replace(/\/photo\/max\/[0-9]*\/[0-9]*\//, "/");
        }

        if (domain === "hdwallsource.com" &&
            src.indexOf("/img/") >= 0) {
            return src.replace(/\/thumb\/([^/.]*)-thumb(\.[^/.]*)/, "/$1$2");
        }

        if ((domain === "www.customity.com" &&
             src.indexOf("/storage/public/") >= 0) ||
            (domain === "www.wisebread.com" &&
             src.indexOf("/files/") >= 0)) {
            return src.replace(/\/imagecache\/[0-9]+x[0-9]+\//, "/");
        }

        if ((domain === "www.desktopimages.org" ||
             domain_nowww === "hdbilder.eu" ||
             domain_nowww === "hdfondos.eu" ||
             domain_nowww === "banktapet.pl" ||
             domain_nowww === "fondsecran.eu")) {
            if (src.indexOf("/pictures/") >= 0) {
                newsrc = src.replace(/\/[^/]*[-_]([0-9]+\.[^/.]*)$/, "/orig_$1");
                if (newsrc !== src)
                    return newsrc;
            }

            if (options && options.cb && options.do_request &&
                src.match(/\/p\/get_photo\/[0-9]+\/[0-9]+/)) {
                var querysrc = src.replace(/\/p\/get_photo\/([0-9]+\/[0-9]+)(?:\/.*)?$/, "/p/$1/0/o");
                options.do_request({
                    url: querysrc,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<img *src="([^">]*\/orig_[^/">]*)"/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain === "www.bikerpunks.com" &&
            src.indexOf("/media/") >= 0) {
            return src.replace(/\/media\/[^/]*\/([0-9a-f]*\.[^/.]*)$/, "/media/$1");
        }

        if (domain_nosub === "livejournal.com" && domain.match(/i[a-z]*\.pics\.livejournal\.com/)) {
            return src
                .replace(/(\/pic\/[0-9a-z]+\/)s[0-9]+x[0-9]+(?:[?#].*)?$/, "$1")
                .replace(/_[0-9]*(\.[^/.]*)$/, "_original$1")
                .replace(/(\/[0-9]+\/)[0-9]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "img-fotki.yandex.ru") {
            return src.replace(/_[^-/._]*(\.[^/.]*)?$/, "_orig$1");
        }

        if (domain_nosub === "steemitimages.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+x[0-9]+\//, "");
        }

        if (amazon_container &&
            amazon_container.match(/steemit-production-imageproxy-[^-.]*/)) {
            return src
                .replace(/-imageproxy-thumbnail((?:\.[^/]*)?\/[A-Za-z0-9]*)_[0-9]+x[0-9]+$/, "-imageproxy-upload$1");
        }

        if (domain_nowww === "newsprom.ru") {
            return src.replace(/\/([0-9]+_[a-f0-9]+\.[^/.]*)$/, "/tn_$1");
        }

        if (domain_nosub === "fotocdn.net" && domain.match(/i[0-9]*\.fotocdn\.net/)) {
            regex = /_(?:[a-z]+|[0-9]+c)(\/[0-9]+\/[0-9]+\.[^/.]*)$/;
            return [
                src.replace(regex, "_xl$1"),
                src.replace(regex, "_l$1")
            ];
        }

        if (domain_nowww === "news-people.fr" &&
            src.indexOf("/galerie/") >= 0) {
            return src.replace(/\/([0-9]*)(\.[^/.]*)$/, "/$1_hd$2");
        }

        if (domain_nosub === "cdn107.com") {
            return src.replace(/_[a-z]*(\.[^/.]*)$/, "$1");
        }

        if (domain === "hairstyles.thehairstyler.com") {
            return src.replace(/(\/[0-9]*\/)[^/]*\/([^/]*)$/, "$1original/$2");
        }

        if (domain_nowww === "abload.de" ||
            domain === "wallpaperpulse.com") {
            return src.replace(/\/thumb\//, "/img/");
        }

        if (domain === "assets.capitalfm.com" ||
            domain === "assets.gcstatic.com") {
            return src.replace(/(\/[^/]*-[0-9]{8,})-[^/]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.leathercelebrities.com") {
            return decodeURIComponent(src
                                      .replace(/^[a-z]+:\/\/[^/]*\/download\.php.*?[?&]file=([^&]*).*?$/, "$1")
                                      .replace(/(\/uploads\/[0-9]*\/[^/]*)__thumb(\.[^/.]*)$/, "$1$2"));
        }

        if (domain === "img.cache.vevo.com" ||
            domain === "scache.vevo.com") {
            newsrc = src.replace(/[?#].*$/, "");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/(\/thumb\/[^/]*\/[^/]*)\/[0-9]+x[0-9]+(\.[^/.]*?)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "www.superiorpics.com" ||
            domain === "i.bollywoodmantra.com") {
            return src.replace(/\/thumb[0-9]+\//, "/");
        }

        if (domain === "www.celebjihad.com" ||
            domain === "image.dek-d.com") {
            return src.replace(/\/t_([^/]*)$/, "/$1");
        }

        if (domain === "www.looktothestars.org" &&
            src.indexOf("/photo/") >= 0 && false) {
            return src.replace(/\/[^/]*(\.[^/.]*)$/, "/large$1");
        }

        if (domain === "cdn.teamcococdn.com") {
            return src.replace(/\/image\/[^/]*\//, "/file/");
        }

        if ((domain_nosub === "staticflickr.com" ||
             (domain_nosub === "flickr.com" && domain.indexOf(".static.flickr.com") >= 0)) &&
            src.match(/\/[0-9]+_[0-9a-f]+(?:_[a-z]*)?\.[a-z]+.*$/) &&
            !src.match(/\/[0-9]+_[0-9a-f]+_o\.[a-z]+.*$/) &&
            options && options.do_request && options.cb) {
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
                                    var out = JSON_parse(resp.responseText);
                                    var largesturl = null;
                                    var largestsize = 0;
                                    out.sizes.size.forEach(function (size) {
                                        var currentsize = parseInt(size.width) * parseInt(size.height);
                                        if (currentsize > largestsize || size.label === "Original") {
                                            largestsize = currentsize;
                                            largesturl = size.source;
                                        }
                                    });

                                    if (options.force_page) {
                                        var photoid = src.replace(/.*\/([0-9]+)_[^/]*$/, "$1");
                                        var photosecret = src.replace(/.*\/[0-9]+_([0-9a-z]+)_[^/]*$/, "$1");
                                        var nexturl = "https://api.flickr.com/services/rest?csrf=&api_key=" + key + "&format=json&nojsoncallback=1&method=flickr.photos.getInfo&photo_id=" + photoid + "&secret=" + photosecret;
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
                                                    var out = JSON_parse(resp.responseText);
                                                    var obj = {
                                                        url: largesturl,
                                                        extra: {
                                                            page: out.photo.urls.url[0]._content
                                                        }
                                                    };

                                                    options.cb(obj);
                                                } catch (e) {
                                                    options.cb(largesturl);
                                                }
                                            }
                                        });
                                    } else {
                                        options.cb(largesturl);
                                    }
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

        if (domain === "www.imagozone.com" ||
            domain_nowww === "imagozone.ro" ||
            domain_nowww === "ohsohumorous.com" ||
            domain_nowww === "travelseyahat.com" ||
            domain_nowww === "carphotoshow.com" ||
            domain_nowww === "celebritiestown.com") {
            if (!src.match(/\/\.album\.[^/.]*$/))
                return src.replace(/\/var\/(?:resizes|thumbs)\//, "/var/albums/");
        }

        if (domain_nowww === "bjwinslow.com") {
            return src.replace(/(\/albums\/.*)\.sized(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "tunes.zone") {
            var basic = src.replace(/\/[0-9]+x[0-9]+[a-z]?\//, "/full/");
            if (basic !== src) {
                var other = basic.replace(/-[a-z]+-[a-z]+(-[0-9]+)?(\.[^/.]*)$/, "$1$2");
                var other1 = basic.replace(/(\/[0-9]+-+)[^/]*-([0-9]+\.[^/.]*)$/, "$1$2");
                if (basic.match(/\/[0-9]+--/))
                    return [other1, basic, other];
                else if (basic.match(/-[0-9]+\.[^/.]*$/))
                    return [other, basic, other1];
                else
                    return [basic, other, other1];
            }
        }

        if (domain === "sf.co.ua") {
            return src.replace(/\/tn-([0-9]*\.[^/.]*)/, "/wallpaper-$1");
        }

        if (domain_nosub === "zerochan.net" && domain.match(/^s[^.]*.zerochan.net/)) {
            return src
                .replace(/:\/\/s[^.]*.zerochan.net\//, "://static.zerochan.net/")
                .replace(/(:\/\/[^/]*\/[^/]*\.)[0-9]+(\.[0-9]+\.[^/.]*)$/, "$1full$2");
        }

        if (domain_nosub === "donmai.us") {
            newsrc = src
                .replace(/\/data\/sample\/([^/]*__)?sample-([0-9a-f]*\.[^/.]*)$/, "/data/$1$2")
                .replace(/:\/\/danbooru\.donmai\.us\/data\/preview\//, "://hijiribe.donmai.us/data/")
                .replace(/\/data\/preview\/([^/]*)$/, "/data/__original__$1");

            if (newsrc !== src)
                return add_extensions(newsrc);
        }

        if ((domain_nosub === "e621.net" &&
             domain.match(/static[0-9]*\.e621\.net/)) ||
            domain_nowww === "behoimi.org") {
            newsrc = src.replace(/(:\/\/[^/]*\/)data\/(?:preview|sample)\//, "$1data/");
            if (newsrc !== src) {
                return add_extensions(newsrc);
            }
        }

        if (domain_nowww === "hypnohub.net") {
            newsrc = src.replace(/\/data\/(?:preview|sample)\/([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "/data/image/$1");
            if (newsrc !== src) {
                return add_extensions(newsrc);
            }
        }

        if (domain === "files.yande.re") {
            return add_extensions(src
                                  .replace(/\/(?:sample|jpeg)\/+([0-9a-f]+\/)/, "/image/$1"));
        }

        if (domain === "assets.yande.re") {
            return add_extensions(src.replace(/:\/\/assets.yande.re\/data\/preview\/[0-9a-f]+\/[0-9a-f]+\//, "://files.yande.re/image/"));
        }

        if (domain_nowww === "konachan.net" && false) {
            regex = /\/data\/preview\/[0-9a-f]{2}\/[0-9a-f]{2}\/([0-9a-f]+\.[^/.]*)$/;
            return [src.replace(regex, "/jpeg/$1"),
                    src.replace(regex, "/image/$1")];
        }

        if (domain_nowww === "konachan.com" ||
            domain_nowww === "konachan.net") {
            newsrc = src.replace(/(?:\/data\/preview\/[0-9a-f]+\/[0-9a-f]+\/|\/(?:sample|jpeg)\/)([0-9a-f]+)(\/[^/]*)?(\.[^/.?]*)(?:[?#]*)?$/, "/image/$1$3");
            if (newsrc !== src)
                return add_extensions(newsrc);

            return {
                url: src,
                headers: {
                    Referer: "https://konachan.com/post"
                }
            };
        }

        if (domain_nowww === "gelbooru.com") {
            return src.replace(/:\/\/[^/]*\/thumbnails\//, "://img2.gelbooru.com/thumbnails/");
        }

        if (domain_nosub === "gelbooru.com" &&
            domain.match(/^s?img[0-9]*\.gelbooru\.com/)) {
            return src
                .replace(/\/thumbnails\/([0-9a-f]+\/[0-9a-f]+\/)thumbnail_/, "/images/$1")
                .replace(/\/samples\/([0-9a-f]+\/[0-9a-f]+\/)sample_/, "/images/$1");
        }

        if (domain_nowww === "safebooru.org" ||
            domain_nowww === "tbib.org" ||
            domain === "img.xbooru.com" ||
            domain_nowww === "realbooru.com") {
            return add_full_extensions(src.replace(/\/(?:thumbnails|samples)(\/[0-9]+\/)(?:thumbnail|sample)_([0-9a-f]+\.[^/.]*)$/, "/images$1$2"));
        }

        if (domain === "cdn.vor.us") {
            return src.replace(/\/thumbs[a-z]?\//, "/og/");
        }

        if (domain === "wallpapers.wallhaven.cc" ||
            domain === "alpha.wallhaven.cc") {
            return src.replace(/\/thumb\/[^/]*\/th-/, "/full/wallhaven-");
        }

        if (domain === "cdn.animenewsnetwork.com" ||
            domain_nowww === "animenewsnetwork.com") {
            return src.replace(/\/thumbnails\/[^/]*\/cms\//, "/images/cms/");
        }

        if ((domain === "digitalart.io" && src.indexOf("/storage/") >= 0) ||
            domain_nowww === "fashion-press.net" && src.indexOf("/img/") >= 0) {
            return src.replace(/(\/[0-9]*\/)[wh][0-9]+_([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "4everstatic.com" ||
            domain === "pictures.4ever.eu") {

            if (!src.match(/:\/\/[^/]*\/data\/download\//)) {
                return [
                    src.replace(/:\/\/[^/]*\/[a-z]+\/(?:[0-9X]+x[0-9X]+\/)?([^?]*).*?$/, "://pictures.4ever.eu/data/download/$1?no-logo"),

                    src.replace(/(:\/\/[^/]*\/[a-z]+\/)[0-9X]+x[0-9X]+\//, "$1")
                ];
            }
        }

        if (domain_nowww === "tapeciarnia.pl") {
            return src.replace(/\/tapety\/[^/]*\//, "/tapety/normalne/");
        }

        if (domain_nowww === "zastavki.com") {
            return src.replace(/\/pictures\/[0-9]+x[0-9]+\/(.*_[0-9]+)_[0-9]+(\.[^/.]*)$/, "/pictures/originals/$1_$2");
        }

        if (domain_nosub === "wallls.com" && domain.match(/w[0-9]*\.wallls.com/)) {
            return src.replace(/\/uploads\/[^/]*\/([0-9]*\/[0-9]*\/)([0-9]*\.[^/.]*)$/, "/uploads/original/$1wallls.com_$2");
        }

        if (domain === "www.wallpaperflare.com" &&
            src.indexOf("/static/") >= 0) {
            return src.replace(/-preview(\.[^/.]*)$/, "$1");
        }

        if (domain === "content.hardtunes.com") {
            return src.replace(/\/[0-9]+x[0-9]+(\.[^/.]*)$/, "/original$1");
        }

        if (domain_nowww === "4kw.in" &&
            src.indexOf("/Wallpapers/") >= 0) {
            return src.replace(/1(\.[^/.]*)$/, "$1");
        }

        if (domain === "imgs-art-dragoart-386112.c.cdn77.org") {
            return src.replace(/_[0-9]*(\.[^/.]*)$/, "_1$1");
        }

        if (domain_nosub === "nyafuu.org" && domain.match(/archive-media-[0-9]*\.nyafuu\.org/)) {
            return src
                .replace(/:\/\/archive-media-[0-9]*\./, "://archive-media-0.")
                .replace(/\/thumb\//, "/image/")
                .replace(/(\/[0-9]*)[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "hulkshare.com" && domain.match(/s[0-9]*\.hulkshare\.com/)) {
            return src.replace(/\/[0-9]*\/([0-9a-f]\/[0-9a-f]\/[0-9a-f]\/[0-9a-f]*\.[^/.]*)$/, "/original/$1");
        }

        if (domain_nosub === "zumst.com" && domain.match(/static\.[^.]*\.zumst\.com/)) {
            return src.replace("/thumb/", "/");
        }

        if (domain_nowww === "wikihow.com" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/\/thumb\/(.*?\.[^/.]*)(?:\/.*)/, "/$1");
        }

        if (domain_nosub === "kakaocdn.net" ||
            domain_nosub === "kakao.co.kr") {
            return src
                .replace(/(\/img(?:_[a-z]+)?\.[^/.?#]*)(?:[?#].*)?$/, "$1")
                .replace(/\/img_[a-z]+(\.[^/.]*)$/, "/img$1");
        }

        if (domain === "obs.line-scdn.net") {
            return {
                can_head: false,
                url: src.replace(/(:\/\/[^/]*\/[-_0-9A-Za-z]*)\/[a-z0-9]*$/, "$1")
            };
        }

        if (domain === "scdn.line-apps.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/(?:obs\/)?([-_0-9A-Za-z]*)(?:\/[a-z0-9]*)?$/, "https://obs.line-scdn.net/$1");
        }

        if (domain === "cdn-obs.line-apps.com") {
            return src.replace(/(\/[-0-9A-F]+\.[0-9a-z]+)\/[^/]*$/, "$1");
        }

        if (domain === "resize-image.lineblog.me") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9a-f]*\/.*?\/([a-z]+:\/\/.*)/, "$1");
        }

        if (domain_nosub === "viki.io" && domain.match(/^[0-9]*\.viki\.io/)) {
            return {
                can_head: false,
                url: src.replace(/\?.*/, "")
            };
        }

        if (domain_nosub === "crunchyroll.com" && domain.match(/img[0-9]*\.[^/.]*\.crunchyroll\.com/)) {
            return src.replace(/(\/[0-9a-f]+)_[a-z]*(\.[^/.]*)$/, "$1_full$2");
        }

        if (domain === "d3ieicw58ybon5.cloudfront.net") {
            return {
                url: src
                    .replace(/\/resize\/[0-9]+\//, "/full/")
                    .replace(/\/ex\/[0-9]+\.[0-9]+\/(?:(?:[0-9]+\.){3}[0-9]+\/)?/, "/full/"),
                can_head: false
            };
        }

        if (domain === "az616578.vo.msecnd.net") {
            return src.replace(/\/files\/responsive\/[^/]*\/[^/]*\/[^/]*\//, "/files/");
        }

        if ((domain_nosub === "dreamwiz.net" && domain.match(/img[0-9]*\.dreamwiz\.net/)) ||
            domain === "kep.cdn.index.hu" ||
            domain === "kep.cdn.indexvas.hu") {
            return src.replace(/_(?:[a-z]|wm)(\.[^/.]*)$/, "_o$1");
        }

        if ((domain_nosub === "sportsworldi.com" ||
             domain_nosub === "segye.com") &&
            src.indexOf("/content/image/") >= 0) {

            return src.replace(/(\/content\/+image\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+)[0-9]+\/+([0-9]+(?:_[^/.]*)?\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "maximkorea.net") {
            return src.replace(/(\/[0-9]+_[0-9]+(?:_[0-9]+)?_img)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "blogimgc.eximg.jp") {
            return decodeURIComponent(decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?i=([^,]*).*?$/, "$1")));
        }

        if (domain === "i.gzn.jp" ||
            (domain_nosub === "uludagsozluk.com" && domain.match(/^galeri[0-9]*\./))) {
            return src.replace(/_[a-z](\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "okmusic.jp" ||
            domain === "newsimg.music-book.jp") {
            return src.replace(/(\/images\/[0-9]*\/)[^/.]*(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "ure.pia.co.jp" && src.indexOf("/mwimgs/") >= 0) {
            return src.replace(/(\/mwimgs\/[0-9a-f]+\/[0-9a-f]+\/)[0-9]+\//, "$1-/");
        }

        if (domain === "kai-you.net") {
            return src
                .replace(/\/r\/img\/[a-z]\/[a-z]?[0-9]+x(?:[0-9]+)?\//, "/press/img/")
                .replace(/(\/images\/.*)\/[a-z]?[0-9]+x(?:[0-9]+)?\/([^/]*)$/, "$1/$2");
        }

        if (domain === "cdn.fortune-girl.com" ||
            domain_nowww === "girlspolish.jp" ||
            domain_nowww === "joah-girls.com") {
            return src.replace(/\/[a-z]*\/([-0-9a-f]*\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "storage.withnews.jp" ||
            amazon_container === "storage.withnews.jp") {
            return src.replace(/-[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "wowma.net" && domain.match(/ic[0-9]*-a\.wowma\.net/)) {
            return src.replace(/^[a-z]*:\/\/[^/]*\/mis?\/.*?\/([^/]*\.[^/]*\/.*)/, "http://$1");
        }

        if (domain === "sokuup.net") {
            return src.replace(/\/img[a-z]\//, "/img/");
        }

        if (domain_nosub === "cosp.jp" && domain.match(/image[0-9]\.cosp\.jp/)) {
            return src
                .replace(/\/thumb\/(.*?\/[0-9]+)[a-z]\.(?:gif|jpg)$/, "/images/$1.jpg")
                .replace(/(\/images\/.*\/[0-9]+)_[0-9]+(\.[^/.]*)$/, "$1$2")
                .replace(/(\/[0-9]+)[a-z](\.[^/.]*)/, "$1$2");
        }

        if (domain_nowww === "gahag.net") {
            return {
                url: src.replace(/:\/\/[^/]*\/img\/([^/]*)\/([0-9]+)[a-z]\/([^-/]+-[0-9]+)-[0-9](\.[^/.]*)/,
                                 "://img01.gahag.net/$1/$2o/$3$4"),
                headers: {
                    Referer: "http://gahag.net/",
                }
            };
        }

        if (domain === "img-cdn.jg.jugem.jp") {
            return src.replace(/_[a-z](\.[^/.]*)$/, "$1");
        }

        if (domain === "public.muragon.com") {
            return src.replace(/\/(?:crop|resize)\/[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "base-ec2if.akamaized.net") {
            return src.replace(/(:\/\/[^/]*\/)[^/]*[a-z]=[0-9][^/]*\//, "$1");
        }

        if (domain_nosub === "imageflux.jp") {
            return src.replace(/\/c!\/[^/]*[a-z]=[0-9][^/]*\//, "/");
        }

        if (domain_nosub === "bloguru.com" &&
            src.indexOf("/userdata/") >= 0) {
            return src.replace(/\/([^/_]*)$/, "/orig_$1");
        }

        if (domain === "www.atpress.ne.jp") {
            return src.replace(/(\/[0-9]+\/)[a-z]+_(img_[0-9]+[^/]*\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img-proxy.blog-video.jp" ||
            domain === "api.pddataservices.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/images.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "cdn.otamart.com") {
            return src.replace(/-thumbnail(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.pakutaso.com") {
            return src.replace(/(\/img\/thumb\/[^/_.]*)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "cdn.atwiki.jp" ||
            (domain === "kinohron.mskcentrum.sk" && src.indexOf("/data-files/") >= 0) ||
            (domain_nowww === "neosite.pl" && src.indexOf("/upload/user/"))) {
            return src.replace(/\/small_([^/]*)$/, "/$1");
        }

        if (domain === "getfile.fmkorea.com") {
            return decodeURIComponent(src.replace(/.*?\/getfile\.php.*?[?&]file=([^&]*).*/, "$1"));
        }

        if (domain === "img.ruliweb.com" ||
            (domain_nosub === "dtiblog.com" && domain.match(/[0-9]*\.dtiblog\.com/)) ||
            domain === "img.korewaeroi.com" ||
            domain === "abc.imgxyqpdrs.xyz" ||
            domain === "image-bankingf25.com") {
            return src.replace(/s(\.[^/.]*)$/, "$1");
        }

        if (domain === "img2.ruliweb.com") {
            return src.replace(/(\/mypi\/gup\/a\/[0-9]+\/[0-9]+\/)[a-z]+(\/[0-9]+\.[^/.]*)$/, "$1o$2");
        }

        if (domain === "file.thisisgame.com") {
            return src.replace(/\/s_([0-9]+_[0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "www.op.gg") {
            return src.replace(/^.*?\/forum\/outImage\/(http.*)$/, "$1");
        }

        if (domain === "ssproxy.ucloudbiz.olleh.com" ||
            domain === "s.gae9.com") {
            return src.replace(/\.[a-z]*(?:[?#].*)?$/, ".orig");
        }

        if (domain_nosub === "artstation.com" && domain.match(/cdn[a-z]*\.artstation\.com/)) {
            regex = /(\/assets\/+images\/+images\/+[0-9]{3}\/+[0-9]{3}\/+[0-9]{3}\/+)(?:[0-9]+\/+)?(?:small(?:er)?|micro|medium|large)(?:_square)?\/([^/]*)$/;
            return [
                src.replace(regex, "$1original/$2"),
                src.replace(regex, "$1large/$2")
            ];
        }

        if (domain === "static.cosplay-it.com") {
            return src.replace(/(\/[-0-9a-f]*)_[a-z]+(\.[^/.]*)/, "$1$2");
        }

        if (domain === "a.fsdn.com") {
            return src.replace(/(\/screenshots\/[^/]*)\/[0-9]+\/.*/, "$1");
        }

        if (domain === "media.moddb.com" ||
            domain === "media.indiedb.com") {
            return src.replace(/\/cache\/images\/(.*?)\/[a-z]+_[0-9]+[^/]*(\/[^/]*\.[^/.]*)$/, "/images/$1$2");
        }

        if (domain === "static.gamefront.com" ||
            domain === "cg.adultwork.com") {
            return src.replace("/thumbnails/", "/");
        }

        if (domain === "thumb.test.mod.io") {
            return src.replace(/:\/\/thumb\.([^/]*\..*?\/)[a-z]+_[0-9]+[^/]*\/([^/]*)$/, "://image.$1$2");
        }

        if (domain_nosub === "scirra.net" && domain.match(/static[0-9]*\.scirra\.net/)) {
            return src.replace(/\/avatars\/[0-9]+\//, "/avatars/256/");
        }

        if (domain === "cdn.gamer-network.net" ||
            domain === "d2skuhm0vrry40.cloudfront.net") {
            return src.replace(/(\.[^/.]*)\/EG[0-9]+\/.*/, "$1");
        }

        if (domain_nosub === "wikiart.org" && domain.match(/uploads[0-9]*\.wikiart\.org/)) {
            return src.replace(/![^/]*$/, "");
        }

        if ((domain_nosub === "fdncms.com" ||
             domain_nosub === "miaminewtimes.com" ||
             domain_nosub === "houstonpress.com" ||
             domain_nosub === "laweekly.com" ||
             domain_nosub === "phoenixnewtimes.com") &&
            domain.match(/^images[0-9]*\./)) {
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
            return src.replace(/-[a-z]+(?:\.[^/.]*)?(\.[^/.]*)$/, "-orig$1");
        }

        if (domain_nosub === "rimg.com.tw" ||
            domain_nosub === "rimg.tw" ||
            domain === "photo.roodo.com" ||
            domain === "img.ruten.com.tw") {

            if (src.match(/(\/photos\/[0-9]+_[0-9a-z]+_)[a-z](\.[^/.]*)$/)) {
                return src.replace(/(\/photos\/[0-9]+_[0-9a-z]+_)[a-z](\.[^/.]*)$/, "$1o$2");
            }

            return {
                url: src.replace(/_[a-z](\.[^/.]*)$/, "$1"),
                headers: {
                    Referer: "https://goods.ruten.com.tw/item/show"
                }
            };
        }

        if (domain === "buy.line-scdn.net") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/[a-f0-9]+\/s\//, "https://s.yimg.com/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "hc360.cn" && domain.match(/img[0-9]*\.hc360\.cn/)) {
            return src.replace(/(\.[^/.]*)\.[^/]*$/, "$1");
        }

        if (domain_nosub === "ganref.jp" && domain.match(/photo[0-9]*\.ganref\.jp/)) {
            return src.replace(/(\/[0-9a-f]+\/)thumb[0-9]*(\.[^/.]*)$/, "$1original$2");
        }

        if (domain_nosub === "st-hatena.com" && domain.match(/cdn(?:-[a-z]+)\.[a-z]\.st-hatena\.com/)) {
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.cdn.nimg.jp") {
            return src.replace(/:\/\/img\.cdn\.nimg\.jp\/s\/(.*?\/images\/[0-9]+\/[0-9a-f]+)\/.*/,
                               "://dcdn.cdn.nimg.jp/$1");
        }

        if (domain_nosub === "photozou.jp") {
            return src
                .replace(/(\/photo\/[0-9]+\/org\.bin)\?.*$/, "$1")
                .replace(/(\/photo\/[0-9]+)_[a-z0-9]+(\.[^/]*)$/, "$1_org$2");
        }

        if (domain === "desktop.sakura.ne.jp" ||
            domain === "kysiamesecat.sakura.ne.jp") {
            return src.replace(/-thumbnail[0-9]*(\.[^/.]*)$/, "$1");
        }

        if ((domain === "www.ya.sakura.ne.jp" || domain === "mabi4751.orz.hm") &&
            src.indexOf("/~mabi/") >= 0) {
            return src.replace(/s(\.jpg|\.JPG)$/, "$1");
        }

        if (domain === "waganeko.sakura.ne.jp") {
            return src.replace(/\/\.thumbnail\/([^/]*\.[^/.]*)\.[^/.]*$/, "/$1");
        }

        if (domain_nosub === "storage-yahoo.jp") {
            return src.replace(/_(?:m|thumb)(\?.*)?$/, "$1");
        }

        if (domain === "static-mercari-jp-imgtr2.akamaized.net") {
            return src.replace(/\/thumb\//, "/");
        }

        if (false && domain.match(/\.fbcdn\.net$/)) {
        }

        if (false && domain === "www.the-a.jp") {
        }

        if (domain === "waichi.sakura.ne.jp") {
            return src.replace(/(\/[^/_.]*)(\.(?:jpg|JPG|jpeg|png|PNG))$/, "$1_L$2");
        }

        if (domain === "news.merumo.ne.jp") {
            return src.replace(/\/imgs\/rect[0-9]*\//, "/img/");
        }

        if (domain_nosub === "shikimori.org" &&
            src.indexOf("/system/") >= 0) {
            return src.replace(/\/[a-z]*\/([0-9]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "assets.survivalinternational.org") {
            return src.replace(/_[0-9a-z_]+(\.[^/.]*)$/, "_original$1");
        }

        if (domain === "alioss.g-cores.com" &&
            src.indexOf("/uploads/image/") >= 0) {
            return src.replace(/_watermark(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.nyato.com" ||
            domain === "img.ifun01.com" ||
            domain === "img.itw01.com" ||
            domain === "img.mttmp.com" ||
            domain === "img.maoduoer.com" ||
            domain === "img.sycs.net" ||
            domain === "img.6jyx.com" ||
            domain === "dn-kdt-img.qbox.me" ||
            domain === "bpic.588ku.com" ||
            domain === "588ku.qiao88.com" ||
            domain === "pic-cdn.35pic.com" ||
            domain === "img.mgpyh.com") {
            return src.replace(/!.*/, "");
        }

        if (domain_nosub === "woyaogexing.com" && domain.match(/^img[0-9]*\./)) {
            return src.replace(/(\/[0-9a-z]+)![^/]*(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "inews.gtimg.com") {
            return {
                url: src.replace(/\/newsapp_[a-z]+\/([0-9]+\/[0-9]+\/)[0-9]+(?:[?#].*)?$/, "/newsapp_match/$10"),
                headers: {
                    "Origin": "",
                    "Referer": ""
                }
            };
        }

        if ((domain === "acg.ms" ||
             domain === "m.acg.ms") &&
            src.indexOf("/photo/") >= 0) {
            return {
                redirects: true,
                url: src.replace(/(\/[0-9]+)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1_0_9999999$2")
            };
        }

        if (domain === "sl.news.livedoor.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[a-f0-9]+\/[^/]*\//, "");
        }

        if (domain === "photo.tuchong.com") {
            return src.replace(/\/[a-z]\/([0-9]+\.[^/.]*)/, "/f/$1");
        }

        if ((domain === "arine.akamaized.net" ||
             domain === "media-assets.aumo.jp") &&
            src.indexOf("/uploads/photo/") >= 0) {
            return src.replace(/(\/[0-9]+\/)[a-z]+_([-0-9a-z]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "newsimg.glossom.jp") {
            return src.replace(/(\/[0-9]+_)[0-9]+(_[0-9]+\.[^/.]*)$/, "$1org$2");
        }

        if (domain === "www.vtianxia.cn") {
            return src.replace(/(\/uploadfile\/[a-z]+\/)[a-z]+\//, "$1big/");
        }

        if (domain === "img.over-blog-kiwi.com" ||
            domain === "img.over-blog.com" ||
            (domain_nosub === "over-blog.com" && domain.indexOf(".idata.over-blog.com") >= 0)) {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+(?:-[a-z]+)?\//, "$1");
        }

        if (domain === "resize.over-blog.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+x[0-9]+(?:-[a-z]+)?\.[^/.?]*\?/, "");
        }

        if (domain_nosub === "eastday.com" && domain.match(/[0-9]*\.imgmini\.eastday\.com/)) {
            return src.replace(/(\/[0-9]+_[0-9a-f]+_[0-9]+)_[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "so-net.ne.jp") {
            return src.replace(/\/(?:m|S[0-9]+)_([^/]*)$/, "/$1");
        }

        if (amazon_container === "rejob-v2-images-production" ||
            (amazon_container === "mosaia" && src.match(/\/images\/[0-9]+\/[^/]*$/))) {
            return src.replace(/\/[^/.]*(\.[^/.]*)$/, "/original$1");
        }

        if (domain === "lohas.nicoseiga.jp") {
            return src.replace(/(\/thumb\/[0-9]+)[a-z](\?.*)?$/, "$1l$2");
        }

        if (domain === "files.mastodon.social") {
            return src.replace(/\/[a-z]+\/([0-9a-f]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain === "appdata.hungryapp.co.kr") {
            return src
                .replace(/\/data_img_[a-z]\//, "/data_img/")
                .replace(/(\/[0-9]{6}\/[0-9]{2}\/[^/]*\.[^/.]*)\/hungryapp\/.*/, "$1");
        }

        if (domain === "media.funradio.fr") {
            return src.replace(/\/cache\/[0-9a-zA-Z]+\/[0-9a-z]+-[0-9]+\//, "/");
        }

        if (domain === "image.afcdn.com" ||
            domain === "assets.afcdn.com" ||
            domain === "imalbum.aufeminin.com" ||
            domain === "imworld.aufeminin.com") {
            return {
                url: src
                    .replace(/(\/acc[0-9]+_(?:[a-z]+_)?[0-9]+\/+[a-z0-9]+)_[a-z0-9]+(\.[^/.]*)/, "$1$2")
                    .replace(/(-[0-9]+_[A-Z0-9]+_)[A-Z](?:_[a-z[0-9]+)?(\.[^/.]*)/, "$1L$2")
                    .replace(/(-(?:[a-z]+)?[0-9]+)_[a-z0-9]+(\.[^/.]*)/, "$1$2"),
                headers: {
                    Origin: "https://www.sofeminine.co.uk/",
                    Referer: "https://www.sofeminine.co.uk/"
                }
            };
        }

        if ((domain_nosub === "greatsong.net" && domain.match(/static[0-9]*\.greatsong\.net/)) ||
            (domain_nosub === "china.com" && domain.match(/img[0-9]*\.(?:[a-z]+\.)?china\.com/))) {
            return src.replace(/\/[0-9]+x[0-9]+\//, "/original/");
        }

        if (domain === "ipravda.sk") {
            return src.replace(/\/thumbs\/([^/]*)-(?:stvorec|nestandard[0-9]*|galeria|clanokW?|strednaW?|malaW?)(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "d919ce141ef35c47fc40-b9166a60eccf0f83d2d9c63fa65b9129.ssl.cf5.rackcdn.com" ||
            domain === "media.phillyvoice.com") {
            return src.replace(/(\/images\/[^/.]+\.)[^/]*(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "nation.com.pk") {
            return src.replace(/\/print_images\/[a-z]+\//, "/print_images/large/");
        }

        if (domain === "dazedimg.dazedgroup.netdna-cdn.com" ||
            domain === "dazedimg-dazedgroup.netdna-ssl.com") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\/(?:[0-9]+-[0-9]+-[0-9]+-[0-9]+\/)?/, "$1");
        }

        if (domain === "www.fuse.tv") {
            return src.replace(/(\/image\/[0-9a-f]+\/)[0-9]+\/[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain === "assets.capitalxtra.com") {
            return src.replace(/(\/[^/.]*-[0-9]{8,})-[^/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.ukmix.org") {
            return atob(decodeURIComponent(src.replace(/.*\/proxy\.php.*?[?&]url=([^&]*).*/, "$1")));
        }

        if (domain === "www.washingtonpost.com" &&
            src.indexOf("/pbox.php?") >= 0) {
            newsrc = src.replace(/.*?\/pbox\.php.*?[?&]url=([^&]*).*$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "m.static.newsvine.com" &&
            src.indexOf("/servista/imagesizer?") >= 0) {
            return src.replace(/(\/servista\/imagesizer).*?[?&](file=[^&]*).*/, "$1?$2");
        }

        if (domain_nosub === "cosplaywon.com" && domain.match(/theprecious[0-9]*\.cosplaywon\.com/)) {
            return src.replace(/(\/photo\/[0-9]+\/)[a-z]+_([-0-9a-f]+\.[^/.]*)$/, "$1original_$2");
        }

        if (domain_nowww === "otaku.com") {
            return src.replace(/(\/files\/images\/)[^/]*\/(?:[A-Z]+_)?([^/]*)$/, "$1fullsize/$2");
        }

        if ((domain_nosub === "joyreactor.com" ||
             domain_nosub === "reactor.cc" ||
             domain_nosub === "joyreactor.cc") &&
            domain.match(/^img[0-9]*\./)) {
            newsrc = src.replace(/(\/pics\/post\/)([^/]*)$/, "$1full/$2");
            if (newsrc !== src)
                return newsrc;

            id = src.replace(/.*\/pics\/thumbnail\/post-([0-9]+)\.[^/.]*$/, "$1");
            if (id !== src && options && options.cb && options.do_request) {
                options.do_request({
                    url: src.replace(/:\/\/img[0-9]*\.([^/]*\/).*/, "://$1post/" + id),
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<div class="image">\s*(?:<a[^>]*>)?\s*<img[^>]*src="([^"]*)"/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "coolwallpaperz.info") {
            return src.replace(/(\/uploads\/wall\/)thumb(\/[0-9]+\/[^/]*)$/, "$1o$2");
        }

        if (domain_nowww === "besthqwallpapers.com" ||
            domain_nowww === "brightwallpapers.com.ua") {
            return src.replace(/(\/[Uu]ploads\/+[0-9]+-[0-9]+-[0-9]{4}\/+(?:[0-9]+|[-0-9a-f]+)\/+)thumb[0-9]*-([^/]*)$/, "$1$2");
        }

        if (domain === "avatanplus.com") {
            if (src.indexOf("/resize.php?") >= 0) {
                var type = url.searchParams.get("type");
                var file = url.searchParams.get("file");
                return "https://avatanplus.com/files/" + type + "/original/" + file;
            }
            return src
                .replace(/(\/files\/[a-z]+)\/[a-z]+\/([0-9a-f]+\.[^/.]*)$/, "$1/original/$2");
        }

        if (domain === "bbd-1tmxd3aba43noa.stackpathdns.com" ||
            domain === "kpoimages-1tmxd3aba43noa.stackpathdns.com" ||
            domain === "data.japanese.kpopstarz.com" ||
            domain === "image.kpopstarz.com" ||
            domain === "images.kpopstarz.com" ||
            domain === "images.kstars.kr" ||
            domain === "cdn.breathecast.com" ||
            domain === "kdrimages-1tmxd3aba43noa.stackpathdns.com") {

            newsrc = src
                .replace(/\/data\/thumbs\/full\/([0-9]+)\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9]+\/([^/]*)$/,
                         "/data/images/full/$1/$2")
                .replace(/[?#].*$/, "");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "studiosol-a.akamaihd.net") {
            return src
                .replace(/(:\/\/[^/]*\/)([a-z]+)\/[0-9]+x[0-9]+\//, "$1uploadfile/$2/")
                .replace(/-tb_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "letradamusica.net" && src.indexOf("/fotos/") >= 0) {
            return src.replace(/-tb(?:_[0-9]+)?(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (amazon_container === "quietus_production") {
            return src.replace(/_crop_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "bmi.com" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/\/cache\/([^/]*)_[0-9]+_[0-9]+_[0-9]+(?:_[a-z]+)?(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "i.warosu.org") {
            return src.replace(/\/thumb\/([0-9]+\/[0-9]+\/[0-9]+)s?(\.[^/.]*)$/, "/img/$1$2");
        }

        if (domain === "media.rbl.ms") {
            if (src.indexOf("/image?") >= 0) {
                var u = decodeURIComponent(url.searchParams.get("u")).replace(/^([^/])/, "/$1");
                var ho = decodeURIComponent(url.searchParams.get("ho")).replace(/\/$/, "");
                return ho + u;
            }
        }

        if (domain_nowww === "filepicker.io" ||
            domain === "d1t35hkz8sx2bl.cloudfront.net") {
            return {
                url: src.replace(/\/convert\?.*/, ""),
                head_wrong_contenttype: true
            };
        }

        if (domain === "cdn.filestackcontent.com") {
            return src.replace(/(:\/\/[^/]*\/)(?:(?:[a-z]+=[^/]*\/+)+|api\/+file\/+)?([^/?]*)(?:\/+(?:convert.*)?|\/*\?.*)?$/, "$1$2");
        }

        if (domain === "cdn.teenidols4you.com" ||
            domain === "www.teenidols4you.com") {
            return src.replace(/:\/\/[^/]*\/thumb\/(.*?)\/(?:[0-9]+)?([^/]*)$/, "://www.teenidols4you.com/blink/$1/$2");
        }

        if (domain === "cdn.pixabay.com") {
            newsrc = src.replace(/.*?\/photo\/.*\/([^/]*-[0-9]+)_+[0-9]+[^/]*(\.[^/.]*)$/,
                                 "https://pixabay.com/en/photos/download/$1$2");

            var obj = {
                url: src,
                redirects: true,
                headers: {
                    Referer: "https://pixabay.com/"
                }
            };

            var ret = [obj];

            if (newsrc !== src) {
                var newobj = deepcopy(obj);
                newobj.url = newsrc;
                ret.unshift(newobj);
            }

            return ret;
        }

        if (domain_nosub === "meetupstatic.com") {
            return src
                .replace(/\/photo_api\/([^/]*)\/.*\/([0-9]+\.[^/.]*)$/, "/photos/$1/0/0/0/highres_$2")
                .replace(/\/(?:thumb|[0-9]+)_([0-9]+\.[^/.]*)$/, "/highres_$1");
        }

        if (domain === "d38c5dutwb1t0j.cloudfront.net") {
            return src.replace(/\/Pictures\/[0-9a-z]+x[0-9a-z]+\//, "/Pictures/9999999xany/");
        }

        if (domain === "img.drillspin.com") {
            return src.replace(/(:\/\/[^/]*\/[a-z]+\/)[0-9]+\//, "$1orig/");
        }

        if (domain === "pics.drillspin.com") {
            return src.replace(/\/[0-9]+(\.[^/.]*)$/, "/orig$1");
        }

        if ((domain_nosub === "bestie.vn" && domain.match(/^static[0-9]*\./)) ||
            domain === "cdn.sinemia.com") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+\//, "$1");
        }

        if (domain === "cdn.britannica.com") {
            return src.replace(/(:\/\/[^/]*\/)(?:s:)?[0-9]+x[0-9]+\//, "$1");
        }

        if (domain_nowww === "pets4homes.co.uk") {
            return src.replace(/(\/images\/[^/]+\/[0-9]+\/)[a-z]+\/([^/]*)$/, "$1original/$2");
        }

        if (domain === "r.hswstatic.com") {
            return src.replace(/:\/\/[^/]*\/[a-z]_[0-9]+\//, "://s.hswstatic.com/");
        }

        if (domain === "www.candb.com") {
            return src.replace(/(\/candb\/)cache\/([^/]*\/)[0-9]+\/([^/]*)_[0-9]+x[0-9]+(?:[^/]*)?(\.[^/.]*)$/, "$1images/$2$3$4");
        }

        if (domain === "www.ottawalife.com") {
            return src.replace(/\/cms\/images\/[a-z]+\//, "/cms/images/large/");
        }

        if (domain === "assets.rpgsite.net") {
            return src.replace(/(\/images\/[0-9]+\/[0-9]+\/[0-9]+\/)[a-z]+\/([^/]+)$/, "$1original/$2");
        }

        if (domain_nowww === "nusabali.com") {
            return src.replace(/(\/article_images\/[0-9]+\/[^/]*)-(?:thumb|800)(-[0-9]+-[0-9]+-[0-9]+-[0-9]+_[0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.wowkeren.com") {
            return src
                .replace(/\/display\/images\/[0-9]+x[0-9]+\//, "/display/images/photo/")
                .replace(/\/images\/events\/[^/]*\//, "/images/events/ori/");
        }

        if (domain === "asset.kompas.com" ||
            (domain_nosub === "grid.id" && domain.match(/^asset(?:-[a-z]*)?\./))) {
            return src.replace(/\/crop\/[0-9x:]+\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain === "img.4plebs.org") {
            return src.replace(/\/thumb(\/[0-9]+\/[0-9]+\/[0-9]+)[a-z](\.[^/.]*)$/, "/image$1$2");
        }

        if (domain === "cdn.thinglink.me") {
            return src.replace(/(\/api\/image\/[0-9a-zA-Z]+)\/.*$/, "$1");
        }

        if (domain === "images.sk-static.com") {
            return src.replace(/(\/[0-9]+\/)[a-z_]+$/, "$1original");
        }

        if (domain === "www.stalkcelebs.com" && src.indexOf("/img-folder/") >= 0) {
            return src.replace(/_t(_[0-9]+\.[^/.]*)$/, "$1");
        }

        if (domain === "www.picsofcelebrities.com") {
            return src.replace(/\/media(\/.*\/pictures\/)[a-z]+(\/[^/]*)$/, "$1large$2");
        }

        if (domain === "dxglax8otc2dg.cloudfront.net") {
            return src.replace(/\/media\/cache\/(.*)[-_]thumb\.[a-f0-9]+(\.[^/.]*)$/, "/media/$1$2");
        }

        if (domain_nosub === "smugmug.com" ||
            domain === "photos.smugmug.com") {
            return {
                url: src.replace(/(\/i-[A-Za-z0-9]+\/[0-9]+\/[a-f0-9]+\/)(?:[A-Z0-9x]+|Ti)(\/[^/]*)(?:\?.*)?$/, "$1O$2"),
                redirects: true
            };
        }

        if (domain_nosub === "lithium.com" && domain.indexOf(".i.lithium.com") >= 0) {
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
            return src.replace(/(\/photos\/[0-9a-z]+\/[0-9a-z]+\/[0-9a-z]+)(?:_[a-z]+)?(\/[^/]*)?(\.[^/.]*)$/, "$1_b$2$3");
        }

        if (domain === "img.anews.com") {
            newsrc = src.replace(/.*\?url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);

            return src.replace(/\/r\/[0-9]+x[0-9]+\//, "/media/posts/images/");
        }

        if (domain === "immagini.quotidiano.net") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/\?url=([^&]*).*?$/, "$1"));
        }

        if (domain_nowww === "realitytvworld.com" ||
            domain === "cdn.realitytvworld.com") {
            var regex = /(\/heads\/gen\/embedded\/[0-9]+)-[a-z](\.[^/.]*)$/;
            return [
                src.replace(regex, "$1-a$2"),
                src.replace(regex, "$1-l$2")
            ];
        }

        if (domain === "video.newsserve.net" ||
            domain === "cdn.newsserve.net") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\//, "$1");
        }

        if (domain === "m.aceshowbiz.com" ||
            domain_nowww === "aceshowbiz.com") {
            return src
                .replace(/(\/display\/images\/)[0-9]+x[0-9]+\//, "$1/photo/")
                .replace(/(\/images\/[^/]*\/)preview\//, "$1");
        }

        if (domain_nowww === "laughspark.info") {
            return src.replace(/\/thumbfiles\/[0-9]+X[0-9]+\//, "/uploadfiles/");
        }

        if (domain_nosub === "giphy.com" && domain.match(/media[0-9]*.giphy.com/)) {
            return src.replace(/\/(?:giphy|[0-9]+[whs_]*)\.(?:gif|webp|mp4)/, "/source.gif");
        }

        if (domain === "pics.dmm.com" ||
            domain === "pics.dmm.co.jp") {
            return src.replace(/s(\.[^/.]*)$/, "l$1");
        }

        if (domain === "www.showgle.co.kr" && src.indexOf("/uploads/") >= 0) {
            return src.replace(/(\/[0-9a-f]+)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain === "photos.modelmayhem.com") {
            return src
                .replace(/(\/photos\/[0-9]+\/[0-9a-f]+\/[0-9a-f]+)_[a-z](\.[^/.]*)$/, "$1$2")
                .replace(/(\/potd\/entrants\/[0-9]+\/[^/]*)-[a-z]+(\.[^/.]*)$/, "$1-big$2");
        }

        if (domain === "static.artbible.info") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\//, "$1large/");
        }

        if (domain === "lakeimagesweb.artic.edu" ||
            (domain_nosub === "oclc.org" && domain.match(/\.contentdm\./)) ||
            domain === "gallica.bnf.fr") {

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

        if (domain_nosub === "oclc.org" && domain.match(/\.contentdm\./)) {
            newsrc = src
                .replace(/\/+digital\/+api\/+singleitem\/+image\/+([^/]*\/+[0-9]+)\/+.*(\.[^/.?#]*)(?:[?#].*)?$/,
                         "/digital/iiif/$1/full/full/0/default$2")
                .replace(/\/+digital\/+download\/+collection\/+([^/]*)\/(?:.*\/)?id\/+([0-9]+).*?$/,
                         "/digital/api/singleitem/image/$1/$2/default.jpg");

            if (newsrc !== src)
                return newsrc;

            if (src.match(/:\/\/[^/]*\/+utils\/+ajaxhelper\/+/)) {
                var folder = url.searchParams.get("CISOROOT");
                var id = url.searchParams.get("CISOPTR");

                return src.replace(/(:\/\/[^/]*\/).*$/, "$1digital/api/singleitem/image/" + folder + "/" + id + "/default.jpg");
            }
        }

        if (domain_nowww === "koodtv.com") {
            return src.replace(/\/thumb-([^/.]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "file.bodnara.co.kr") {
            return decodeURIComponent(src.replace(/.*?\/insidelogo\.php.*?[?&]image=([^&]*).*$/, "$1")).replace(/^\/*/, "");
        }

        if (domain === "passport.mobilenations.com" ||
            (domain_nowww === "timpul.md" && src.indexOf("/uploads/") >= 0)) {
            return src.replace(/\/[0-9]+x[0-9]+_([^/]*\.[^/.]*)$/, "/$1");
        }

        if (domain === "www.dollargeneral.com" &&
            src.indexOf("/media/") >= 0) {
            return src.replace(/\/cache\/(?:image|thumbnail)\/[0-9]+x[0-9]+\//, "/cache/image/");
        }

        if (domain === "www.dollartree.com" &&
            src.indexOf("/assets/") >= 0) {
            return src.replace(/\/styles\/[^/]*\/([^/]*)$/, "/styles/jumbo/$1");
        }

        if (domain === "d2192bm55jmxp1.cloudfront.net") {
            return src.replace(/\/resize\/[a-z]+\//, "/origin/");
        }

        if (domain === "i.marieclaire.com.tw") {
            newsrc = src.replace(/\/[0-9]+X[0-9]+\/([0-9A-F]+\.[^/.]*)$/, "/$1");
            if (newsrc !== src) {
                return [newsrc.replace(/\.jpg$/, ".jpeg"), newsrc];
            }
        }

        if (domain === "img.vogue.com.tw" ||
            domain === "img.gq.com.tw") {
            return src
                .replace(/\/_rs\/[0-9]+\//, "/")
                .replace(/\/userfiles\/sm\/sm[0-9]+_images/, "/userfiles/images");
        }

        if (domain === "niuerdata.donews.com" ||
            domain === "niuerdata.g.com.cn") {
            return src
                .replace(/\/new_thumb\//, "/big_media_img/")
                .replace(/\/thumb_([0-9a-f]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "pictures.icpress.cn") {
            return src.replace(/s(\.[^/.]*)$/, "$1");
        }

        if ((domain === "interview365.mk.co.kr" &&
             src.indexOf("/images/") >= 0)) {
            return src.replace(/(\/[0-9]+_)[A-Z](_[0-9]+\.[^/.]*)$/, "$1L$2");
        }

        if (domain === "draw.acharts.net") {
            return src.replace(/-[a-z](\.[^/.]*)$/, "-l$1");
        }

        if (domain === "gqhotstuff.gq.com.mx") {
            return src.replace(/\/api\/photos\/[a-z]+\//, "/api/photos/original/");
        }

        if (domain === "images.apester.com") {
            return src.replace(/(:\/\/[^/]*\/[^/]*\.[^/.]*)\/[/a-z0-9]+$/, "$1");
        }

        if (domain === "twt-thumbs.washtimes.com") {
            return src.replace(/(:\/\/twt-)thumbs(\.[^/]*\/media\/(?:image|img)\/.*?)_[cs][0-9][-_0-9a-z]+(\.[^/.?]*)(?:\?.*)?$/, "$1media$2$3");
        }

        if (domain === "dynamicmedia.zuza.com") {
            return src
                .replace(/\/zz\/m\/[^/]*\//, "/zz/m/original_/")
                .replace(/(\.[0-9]*(?:-[0-9]+)?)_[^-./]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "images.commeaucinema.com") {
            return src.replace(/\/galerie\/([^/]*)$/, "/galerie/big/$1");
        }

        if (domain === "static.screenweek.it" ||
            amazon_container === "static.screenweek.it") {
            return src.replace(/_[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "filmstarjackets.com" ||
            domain_nowww === "moviesjacket.com") {
            return src.replace(/\/image\/cache\/data\/(.*)-[0-9]+x[0-9]+(\.[^/.]*)$/, "/image/data/$1$2");
        }

        if (domain === "da4pli3l5vc0d.cloudfront.net") {
            return src.replace(/(:\/\/[^/]*\/(?:(?:[0-9a-f]{2})\/){2}[0-9a-f]+)\/.*$/, "$1");
        }

        if (domain_nosub === "hollywood.com" && domain.match(/photo\.media[0-9]*\.hollywood\.com/)) {
            return src.replace(/(:\/\/[^/]*\/)[^/]*\//, "$1full/");
        }

        if (((domain === "www.doodoo.ru" ||
              domain === "www.youloveit.ru" ||
              domain_nowww === "take.az" ||
              domain_nowww === "starmodels.ru" ||
              domain_nowww === "nevseoboi.com.ua" ||
              domain_nowww === "photoofnude.com" ||
              domain_nowww === "hronika.info" ||
              domain_nowww === "qadin.net" ||
              domain_nowww === "allday2.com" ||
              domain_nowww === "tonshuul.mn" ||
              domain_nowww === "animechan.ru" ||
              domain_nowww === "sexs-foto.com" ||
              domain_nowww === "sexs-foto.info" ||
              domain_nowww === "informaplus.ru" ||
              domain_nowww === "modnaya.org" ||
              domain_nowww === "negani.com" ||
              domain_nowww === "chukcha.net" ||
              domain_nowww === "opa.kg" ||
              domain_nowww === "pirojok.net" ||
              domain_nowww === "femanes.ru" ||
              domain_nowww === "vistanews.ru" ||
              domain_nowww === "tour-rest.ru" ||
              domain_nowww === "znamenitka.ru" ||
              domain_nowww === "all-stars.su" ||
              domain === "bugaga.ru") &&
             src.indexOf("/uploads/") >= 0) ||
            domain === "cdn.prognozist.ru" ||
            src.match(/^[a-z]+:\/\/[^/]*\/uploads\/posts\/[0-9]{4}-[0-9]{2}\/(?:thumbs|medium)\/[0-9]+(?:_[^/]*)?\.[^/.]*$/) ||
            src.match(/^[a-z]+:\/\/[^/]*\/uploads\/[a-z]+\/(?:[0-9]+x[0-9]+\/)?[0-9]{4}-[0-9]{2}\/thumbs\/[0-9]+x[0-9]+_crop_[0-9]+_[^/]*$/)) {
            newsrc = src.replace(/\/uploads\/[a-z]+\/(?:[0-9]+x[0-9]+\/)?([0-9]+-[0-9]+\/)(?:(?:thumbs|medium)\/)?(?:[0-9]+x[0-9]+_crop_)?([^/]*)$/,
                                 "/uploads/posts/$1$2");
            if (newsrc !== src)
                return newsrc;
            newsrc = src.replace(/(\/+posts\/+[0-9]{4}-[0-9]{2}\/+)thumbs\/+/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "goldwallpapers.com") {
            return src.replace(/(\/uploads\/posts\/[^/]*\/)thumb\/([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "tooob.com" &&
            src.indexOf("/api/") >= 0) {
            return src.replace(/(\/[0-9]+\/)__[^/]*$/, "$1");
        }

        if (domain_nosub === "ask.fm" && domain.match(/akphoto[0-9]*\.ask\.fm/) ||
            domain === "dok7xy59qfw9h.cloudfront.net") {
            return src.replace(/\/[a-z]+\/((?:[0-9]+|.+)\.[^/.]*)$/, "/large/$1");
        }

        if (domain === "alchetron.com") {
            return src.replace(/-resize-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.ltn.com.tw") {
            return src.replace(/\/Upload\/ent\/page\/[^/]+\//, "/Upload/ent/page/orig/");
        }

        if (domain_nosub === "lystit.com" && domain.match(/cdn[a-z]?\.lystit\.com/)) {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\/[0-9]+\/[0-9a-z]+\/photos\//, "$1photos/");
        }

        if (domain === "www.newshub.co.nz") {
            return {
                url: src.replace(/(\/image(?:[_.][0-9]+)?\.dynimg\.)[^/]*(\.q[0-9]+\.[^/.]*)(\/.*)?$/, "$1full$2$3"),
                can_head: false
            };
        }

        if (amazon_container === "s3.931wolfcountry.com" ||
            domain === "assets.instyle.co.uk" ||
            domain === "d2nzqyyfd6k6c7.cloudfront.net" ||
            (amazon_container && amazon_container.match(/^s3(?:\.[^/]*)?\.radio\.com$/)) ||
            domain === "qtxasset.com" ||
            amazon_container === "wpr-public" ||
            amazon_container === "prod-media.gameinformer.com" ||
            domain === "community-content-assets.minecraft.net" ||
            domain === "cdn-s3.si.com" ||
            (domain_nosub === "hercampus.com" && domain.match(/^cdn[0-9]*\./)) ||
            amazon_container === "southbank-ipcmedia-com" ||
            domain === "cdn.newsbusters.org" ||
            amazon_container === "kpopimg") {
            newsrc = src.replace(/\/styles\/[^/]*\/s3(?:fs)?\//, "/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "s-nbcnews.com" && domain.match(/media[0-9]*\.s-nbcnews\.com/)) {
            return src.replace(/(:\/\/[^/]*\/)j(\/.*\/[^/.]*)[^/]*(\.[^/.]*)$/, "$1i$2$3");
        }

        if (domain === "imgcp.aacdn.jp") {
            return src.replace(/\/img-a\/[0-9a-z]+\/[0-9a-z]+\//, "/img-a/auto/auto/");
        }

        if (domain === "kpopselca.com") {
            return src.replace(/\/selca\/thumb\//, "/selca/");
        }

        if (domain === "www.koogle.tv") {
            return src.replace(/\/\.thumbnails\/([^/]*)-[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain_nowww === "fanaru.com" ||
            domain_nowww === "stuffpoint.com") {
            return src.replace(/\/image\/thumb\//, "/image/");
        }

        if (domain === "d9nvuahg4xykp.cloudfront.net" ||
            domain === "d1w8cc2yygc27j.cloudfront.net") {
            return src.replace(/_thumbnail(\.[^/.]*)$/, "$1");
        }

        if (domain === "i.lihkg.com" ||
            domain_nowww === "f3img.gq") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+\//, "");
        }

        if (domain === "www.nintendoworldreport.com" &&
            src.indexOf("/media/") >= 0) {
            return src.replace(/\/gallery\/([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "nintendoeverything.com" &&
            src.indexOf("/gallery/") >= 0) {
            return src.replace(/\/thumbs\/thumbs_([^/]*)$/, "/$1");
        }

        if (domain === "images.nintendolife.com") {
            return src.replace(/(\/attachment\/[^/]*\/)[^/]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "cdn.igromania.ru") {
            return src.replace(/(\/[0-9a-f]+)(?:_[^-_/.]*)?(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain === "i.blogs.es") {
            return src.replace(/\/[0-9]+_[0-9]+(\.[^/.]*)$/, "/original$1");
        }

        /*if (domain === "popdustroar-img.rbl.ms" ||
            (domain.indexOf(".rbl.ms") >= 0 && src.indexOf("/simage/") >= 0)) {
            return decodeURIComponent(src.replace(/.*?\/simage\/([^/]*)\/.*\/, "$1")); // fix
        }*/

        if (domain_nosub === "rbl.ms") {

            newsrc = src.replace(/.*\/image.*?[?&]source=([^&]*).*/, "$1");
            if (newsrc !== src) {
                return decodeURIComponent(newsrc);
            }

            newsrc = src.replace(/.*?\/simage\/([^/]*)\/.*/, "$1");
            if (newsrc !== src) {
                return decodeURIComponent(newsrc);
            }
        }

        if (domain === "resize-rbl-ms.cdn.ampproject.org") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/ii\/[wh][0-9]+\/s\//, "http://");
        }

        if (domain === "assets.rbl.ms") {
            return src.replace(/(:\/\/[^/]*\/[0-9]+\/)[^/.]*(\.[^/.]*)$/, "$1origin$2");
        }

        if (domain === "i.paigeeworld.com" ||
            domain === "d395qfwg4461au.cloudfront.net") {
            return src.replace(/(\/user-(?:uploads|media\/[0-9]+)\/[0-9a-f]+_[0-9a-f]+_)[^/.]*(\.[^/.]*)$/, "$1rz$2");
        }

        if (domain === "1d31c772ec21a65b0a71-0707aae3004193da193e1ad4a942592d.ssl.cf2.rackcdn.com") {
            return src.replace(/(:\/\/[^/]*\/[0-9]+\/[^/.]*)__[^_/.]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "i.nextmedia.com.au") {
            return decodeURIComponent(src.replace(/.*\/Utils\/ImageResizer\.ashx.*?[?&]n=([^&]*).*?$/, "$1"));
        }

        if (domain_nosub === "heritagestatic.com" && domain.match(/dyn[0-9]*\.heritagestatic\.com/)) {
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
            return src.replace(/(\/[0-9a-z]+)_[a-z]+(\.[^/.]*)$/, "$1_lg$2");
        }

        if (domain === "d1x0dndjbjw02n.cloudfront.net" ||
            amazon_container === "cdn.panda-gossips.com") {
            return src.replace(/\/thumb(\.[^/.]*)$/, "/original$1");
        }

        if (domain === "summary-sv.fc2.com") {
            return decodeURIComponent(src.replace(/.*?\/api\/resize_img\.php.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain === "image.tmdb.org") {
            return src.replace(/\/[wh][0-9]+(?:_and[^/]*)?\/([0-9a-zA-Z]+\.[^/.]*)$/, "/original/$1");
        }

        if (false && (domain_nosub === "nbcuni.com" &&
                      src.indexOf("/prod/image/") >= 0)) {
            return src.replace(/_[0-9]+x[0-9]+_[0-9]{8,}(\.[^/.]*)$/, "$1");
        }

        if (domain === "embedly.massrelevance.com") {
            return decodeURIComponent(src.replace(/.*\/image.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "media.lolusercontent.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/api\/embedly\/1\/image\/resize.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "img.day.az" ||
            domain === "img.milli.az") {
            return src.replace(/\/(?:(?:[0-9]+x[0-9]+[a-z]?)|thumb)(\/[^/]*)$/, "$1");
        }

        if (domain_nowww === "publika.az") {
            return src.replace(/(\/storage\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/)[0-9]+x[0-9]+[a-z]?\/([^/]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "fotos.caras.uol.com.br") {
            return src.replace(/\/media\/images\/[^/]*\//, "/media/images/original/");
        }

        if (domain === "www.wmj.ru" ||
            domain === "sih.avn.com" ||
            domain_nowww === "passion.ru") {
            return src.replace(/(:\/\/[^/]*\/)(?:thumb\/)?[0-9]+x[0-9]+\/(?:top\/)?filters:[^/]*\//, "$1");
        }

        if (domain_nosub === "centerblog.net" && domain.indexOf("pic.centerblog.net") >= 0) {
            return src.replace(/(:\/\/[^/]*\/)(?:[a-z]\/)?([^/]*)$/, "$1o/$2");
        }

        if (domain === "d2n4wb9orp1vta.cloudfront.net") {
            return src.replace(/;.*/, "");
        }

        if (domain === "gd.image-gmkt.com") {
            return src.replace(/\.[^/.]*(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "toonpool.com") {
            return {
                url: src
                    .replace(/(\/user\/[0-9]+\/)thumbs\/([^/.]+_[0-9]+)(\.[^/.]*)$/, "$1files/$29$3")
                    .replace(/(\/user\/[0-9]+\/)files\/([^/.]+_[0-9]+)[0-9](\.[^/.]*)$/, "$1files/$29$3"),
                problems: {
                    watermark: true
                }
            };
        }

        if (domain === "www.cartoonmovement.com") {
            return src.replace(/\/cartoon_thumbnails\//, "/cartoons/");
        }

        if (domain_nosub === "sndimg.com") {
            return src.replace(/(\/[^/.]+\.[^/.]+)\.[^/]*(?:\/[^/]*)?$/, "$1");
        }

        if (domain === "st.hzcdn.com") {
            return src
                .replace(/\/fimgs\/([0-9a-f]+)_([0-9]+)-[^/]*(\.[^/.]*)$/, "/simgs/$1_14-$2$3")
                .replace(/(\/simgs\/[0-9a-f]+)_[0-9]+(-[0-9]+[./])/, "$1_14$2");
        }

        if (domain === "www.axisanimation.com" &&
            src.indexOf("/assets/") >= 0) {
            return src.replace(/\.[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "media.baselineresearch.com") {
            return src.replace(/(\/[0-9]+_)[a-z]+(\.[^/.]*)$/, "$1full$2");
        }

        if (domain_nowww === "mireportz.com" ||
            domain_nowww === "pakistani.pk") {
            return src.replace(/\/photos\/thumbnail\/[0-9]+x[0-9]+[a-z]*\//, "/photos/original/");
        }

        if (domain_nosub === "gazeta.pl" && domain.match(/bis?\.gazeta\.pl/)) {
            return src.replace(/(\/z[0-9]+)[A-Z]+(,[^/.]*)?(\.[^/.]*)$/, "$1O$2$3");
        }

        if (domain_nosub === "static6.com" && domain.match(/cdn[0-9]*(-[a-z]+)?\.production\.[^./]*\.static6\.com$/)) {
            return src.replace(/(:\/\/cdn[0-9]*(?:-[a-z]+)?\.production\.)[^./]*(\.static6\.com)\/.*?\/([^/.-]+)-media-production\/(medias\/)/,
                               "$1$3$2/$4");
        }

        if (domain === "lajt.co.uk") {
            return src.replace(/\/media\/cache\/[0-9]+x[0-9]+\//, "/media/cache/original/");
        }

        if (domain === "ellearabia.com" ||
            domain_nowww === "national-geographic.pl" ||
            domain_nowww === "ecranlarge.com" ||
            domain === "estaticos.marie-claire.es") {
            return src.replace(/\/+media\/+cache\/+[^/]*\/+/, "/");
        }

        if (domain === "static.t13.cl") {
            return src.replace(/__[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "www.cosmo.com.ua") {
            return src.replace(/(\/photos_publication\/[0-9]+\/)[0-9]+_[0-9]+\//, "$1");
        }

        if (domain_nosub === "trrsf.com" && domain.match(/p[0-9]*\.trrsf\.com/)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/image\/fget\/[^/]*\/(?:(?:[0-9]+\/){4})?[0-9]+\/[0-9]+\//, "http://");
        }

        if (domain === "c.igte.ch" ||
            domain === "img.digitalag.ro") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?[?&]u=([^&]*).*/, "$1"));
        }

        if (domain_nowww === "trendus.com" ||
            domain_nowww === "boxerdergisi.com.tr") {
            return src.replace(/\/PhotoGallery\/size[0-9]*\//, "/PhotoGallery/original/");
        }

        if (domain === "mediacdn.grabone.co.nz") {
            return src.replace(/(\/asset\/[-_=a-zA-Z0-9]+)\/[a-z]+=.*/, "$1");
        }

        if (domain === "cdn.glamour.es" ||
            domain === "cdn.gq.com.mx" ||
            domain === "cdn.revistavanityfair.es") {

            return src.replace(/(\/uploads\/images)\/thumbs(?:(\/[a-z]+\/(?:vf|gq))\/[0-9]+)?(\/.*)_[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1$2$3$4");
        }

        if (domain_nosub === "woman.ru" && domain.match(/i[0-9]*-cdn\.woman\.ru/)) {
            return src.replace(/_[0-9]+_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "ensimages-1tmxd3aba43noa.stackpathdns.com" ||
            domain === "images.enstarz.com" ||
            domain === "bbd-1tmxd3aba43noa.stackpathdns.com") {
            return src
                .replace(/\/data\/thumbs\/[^/]*\/([0-9]+)\/(?:[0-9]+\/){4}/, "/data/images/full/$1/")
                .replace(/\?.*/, "");
        }

        if (domain === "image.brigitte.de" && false) {
        }

        if (domain_nosub === "20minutos.es" && domain.match(/st-[^/.]*\.20minutos\.es/)) {
            return src.replace(/(\/[0-9]+)_[0-9]+px(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain_nosub === "thehunt.com" && domain.match(/cdn[0-9]*\.thehunt\.com/)) {
            return src.replace(/(\/[0-9]+\/)[^/]*\/([0-9a-f]+\.[^/.]*)$/, "$1original/$2");
        }

        if (domain_nosub === "devote.se" && domain.match(/static[0-9]*\.devote\.se/)) {
            return src.replace(/\/gallery\/[^/]+\//, "/gallery/big/");
        }

        if (domain_nowww === "vev.ru" &&
            src.indexOf("/uploads/images/") >= 0) {
            return src.replace(/(?:_[a-z]+)?(\.[^/.]*)$/, "_original$1");
        }

        if (domain === "s.glbimg.com") {
            return src.replace(/\/[0-9]+x[0-9]+\//, "/original/");
        }

        if (domain === "image.xahoi.com.vn" ||
            domain === "media.tinmoi.vn" ||
            domain === "media.ngoisao.vn") {
            return src.replace(/(:\/\/[^/]*\/)resize_[0-9]+(?:x[0-9]+)?\//, "$1");
        }

        if (domain_nosub === "intermoda.ru" && domain.match(/s[0-9]*\.intermoda\.ru/)) {
            return src.replace(/\/p\/(?:max|h|w)[0-9]*\//, "/p/original/");
        }

        if (domain === "static.life.ru") {
            return src.replace(/__[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "a.ltrbxd.com") {
            return src.replace(/\/resized\/(.*)-(?:[0-9]+-){4}crop(?:-[0-9]+)?(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "images.goodsmile.info") {
            return src.replace(/\/[a-z]+(\/[0-9a-f]+\.[^/.]*)$/, "/original$1");
        }

        if (domain === "dzt1km7tv28ex.cloudfront.net") {
            return src.replace(/_[a-z](\.[^/.]*)$/, "_o$1");
        }

        if (domain_nowww === "ucarecdn.com") {
            return src.replace(/(:\/\/[^/]*\/[-0-9a-f]+\/).*/, "$1");
        }

        if (domain_nowww === "celebs-place.com") {
            return src.replace(/(\/(?:gallery|news\/+pics)\/+[^/]*\/+[^/]*)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain === "static.vfiles.com") {
            return {
                url: src.replace(/(\/image\/media\/[0-9]+\/)[a-z]+(?:\?.*)?$/, "$1original"),
                can_head: false
            };
        }

        if (domain === "img.mediacentrum.sk") {
            return src.replace(/\/gallery\/(?:.*?\/)?[0-9]+\/([0-9]+\.[^/.]*)$/, "/gallery/original/$1");
        }

        if (domain === "images.says.com") {
            return src.replace(/(\/[0-9]+\/)[a-z_]+_([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "wir.skyrock.net") {
            return decodeURIComponent(src.replace(/:\/\/[^/]*\/.*[?&]im=([^&]*).*/, "://i.skyrock.net$1"));
        }

        if (domain === "i.skyrock.net") {
            return src
                .replace(/(\/pics\/(?:photo_)?[0-9]+)_[a-z]+((?:_[0-9]+)?\.[^/.]*)$/, "$1$2")
                .replace(/(\/pics\/[0-9]+)_[0-9]_([0-9]+_[A-Za-z0-9]+\.[^/.]*)$/, "$1_1_$2");
        }

        if (domain_nosub === "xhcdn.com" &&
            (domain.match(/thumb-p[0-9]*\.xhcdn\.com/) ||
             domain === "upt.xhcdn.com" ||
             domain === "ept.xhcdn.com")) {
            newsrc = src.replace(/(:\/\/[^/]*\/)a\/+[-_a-zA-Z0-9]{10,}\/+([0-9]+\/)/, "$1$2");
            if (newsrc !== src)
                return newsrc;

            return src.replace(/(\/[0-9]+_)[0-9]+(\.[^/.]*)$/, "$11000$2");
        }

        if (domain_nosub === "netease.com" && domain.match(/img[0-9]*\.cache\.netease\.com/)) {
            return src
                .replace(/\/(?:[a-z]|[0-9]+x[0-9]+)_([^/]*)$/, "/$1")
                .replace(/_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.lengding.cn") {
            return src.replace(/.*?\/getImage\.php.*?[?&]url=(.*)$/, "$1");
        }

        if (domain === "cdn.sabay.com") {
            return src.replace(/:\/\/[^/]+\/cdn\/([a-z]+\.[a-z]+\.[a-z]+\/)/, "://$1");
        }

        if (domain === "media.sabay.com" ||
            (domain === "static.addiyar.com" && src.indexOf("/storage/attachments/") >= 0) ||
            (domain_nosub === "annahar.com" && domain.match(/^static[0-9]*\.annahar/) && src.indexOf("/storage/attachments/"))) {
            return src.replace(/_[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "binaryapi.ap.org") {
            return {
                url: src,
                can_head: false
            };
        }

        if (domain_nosub === "ekladata.com") {
            return src.replace(/@[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "img.geinoueroch.com" ||
            domain === "image.hoopchina.com" ||
            (domain === "san.imatin.net" && src.indexOf("/images/") >= 0) ||
            domain === "img.momon-ga.com") {
            return src.replace(/-s(\.[^/.]*)$/, "$1");
        }

        if (domain === "note.taable.com" &&
            src.indexOf("/photo/") >= 0) {
            return decodeURIComponent(src.replace(/:\/\/[^/]*\/photo\//, "://"));
        }

        if (domain_nosub === "adult-gazou.me" && domain.match(/img-[^.]*\.adult-gazou\.me/)) {
            return src.replace(/\/[a-z](\/[0-9]*\.[^/.]*)$/, "/l$1");
        }

        if (domain_nosub === "fukugan.com" &&
            src.indexOf("/rssimg/") >= 0) {
            return decodeURIComponent(decodeURIComponent(src.replace(/.*\/(https?[%:].*)/, "$1"))).replace(/\.#.*/, "");
        }

        if (domain_nosub === "lostbird.vn" && domain.match(/img[0-9]*\.lostbird\.vn/)) {
            return src.replace(/(:\/\/[^/]*\/)[-0-9]+x[-0-9]+\//, "$1");
        }

        if (domain === "img.biggo.com.tw") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[^/]*\//, "");
        }

        if (((domain_nosub === "book.com.tw" && domain.match(/im[0-9]*\.book\.com\.tw/)) ||
             domain === "www.books.com.tw" ||
             domain === "buy.line-scdn.net") &&
            src.indexOf("/getImage") >= 0) {
            return decodeURIComponent(src.replace(/.*\/getImage.*?[?&]i=([^&]*).*?$/, "$1"));
        }

        if (domain === "img.feebee.com.tw") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/ip\/[0-9]+\/[^/]+=\//, "");
        }

        if (domain === "img.fireden.net") {
            return add_full_extensions(src.replace(/\/thumb(\/.*?)s(\.[^/.]*)$/, "/image$1$2"));
        }

        if (domain === "www.consolefun.fr" ||
            domain_nowww === "nude-gals.com") {
            return src.replace(/\/thumbs\/th_/, "/");
        }

        if (domain === "ex.f3img.gq") {
            return decodeURIComponent(src.replace(/.*?\/api\/image.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "images.everyeye.it") {
            return src.replace(/(-v[0-9]+-[0-9]+)-[0-9]+(\.[&/.]*)/, "$1$2");
        }

        if (domain === "www.bobx.com") {
            newsrc = src
                .replace(/\/thumbnail\/(.*?)(?:-preview)?(-[0-9]+)(?:\.t)?(\.[^/.]*)$/, "/$1$2$3")
                .replace(/--([0-9]+\.[^/.]*)$/, "-$1");
            return {
                url: newsrc,
                headers: {
                    Cookie: null,
                    Referer: newsrc.replace(/\.[^/.]*$/, ".html")
                }
            };
        }

        if ((domain === "www.altcine.com" && src.indexOf("/photo/") >= 0) ||
            domain === "gallery-cdn.tiscali.it" ||
            (domain === "img.amur.info" && src.indexOf("/res/") >= 0) ||
            (domain_nowww === "dspdaily.com" && src.indexOf("/data/") >= 0)) {
            return src.replace(/\/[0-9]+x[0-9]+\/([^/]*)$/, "/$1");
        }

        if (domain === "www.spacetelescope.org" &&
            src.indexOf("/static/") >= 0) {
            return src.replace(/\/images\/[^/]*\//, "/images/large/");
        }

        if (domain === "static.qobuz.com") {
            return src.replace(/_[0-9]+(\.[^/.]*)$/, "_org$1");
        }

        if (domain_nowww === "sarajevo.travel" &&
            src.indexOf("/assets/photos/") >= 0) {
            return src.replace(/\/[a-z]+\/([^/]*)$/, "/original/$1");
        }

        if (domain === "avatars.mds.yandex.net" ||
            domain === "avatars.yandex.net") {
            return src.replace(/\/[a-z_0-9]+([?&].*)?$/, "/orig$1");
        }

        if (domain === "t2online.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/unsafe\//, "http://");
        }

        if (domain_nowww === "filmnegah.com") {
            return decodeURIComponent(src.replace(/(:\/\/[^/]*)\/Image\/(?:Resize|Thumbnail).*?[?&](?:url|path)=~([^&]*).*?$/, "$1$2"));
        }

        if (domain_nowww === "niagara.sk" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/\/tmb-[0-9]+(?:-[0-9]+)\//, "/big/");
        }

        if (domain === "www.cdn-cinenode.com") {
            return src.replace(/(\/[0-9]+\/)([^/]*)-[0-9]+-[0-9]+(\.[^/.]*)$/, "$1full/$2$3");
        }

        if (domain_nosub === "canalblog.com" && domain.match(/\.storage\.canalblog\.com$/)) {
            return src
                .replace(/\.[^/]*(\.[^/.]*)$/, "$1")
                .replace(/(\/[0-9]+)(?:_[a-z])?(\.[^/.]*)$/, "$1_o$2");
        }

        if (domain_nowww === "film-like.com") {
            return src.replace(/\/thumb\//, "/full/");
        }

        if (domain === "24smi.org") {
            return src
                .replace(/\/img\/[0-9]+_[0-9]+\//, "/img/999999999_999999999/")
                .replace(/\/public\/media\/[0-9]+x[0-9]+\//, "/public/media/");
        }

        if (domain === "cdn.metrotvnews.com" ||
            domain === "cdn.medcom.id") {
            return src.replace(/\?.*/, "?w=99999999999");
        }

        if (domain === "www.znqnet.com" &&
            src.indexOf("/fileupload/") >= 0) {
            return src.replace(/\/fileupload\/thumb\//, "/fileupload/image/");
        }

        if (domain_nosub === "rpp-noticias.io" && domain.match(/[a-z]\.rpp-noticias\.io/)) {
            return src.replace(/:\/\/e\.rpp-noticias\.io\/[a-z]+\//, "://f.rpp-noticias.io/");
        }

        if (domain_nosub === "diarioinformacion.com" && domain.match(/fotos[0-9]*\.diarioinformacion\.com/)) {
            return src.replace(/\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain === "imagenes-cdn.diarioinformacion.com" && src.indexOf("/multimedia/fotos/")) {
            return src.replace(/_[a-z](\.[^/.]*)$/, "$1");
        }

        if (domain === "www.digi-film.ro") {
            return src.replace(/\/onedb\/picture\([^/]*\//, "/onedb/picture/");
        }

        if (domain_nosub === "jiemian.com" && domain.match(/img[0-9]*\.jiemian\.com/)) {
            return src.replace(/\/([0-9]+)_[a-zA-Z0-9]+x[a-zA-Z0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "cdn.highdefdigest.com") {
            return src.replace(/(\/uploads\/[0-9]+\/[0-9]+\/[0-9]+\/)[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "ojosdecafe.com") {
            return src.replace(/\/thumbs\/[0-9]+x[0-9]+_/, "/");
        }

        if (domain === "img.gestion.pe") {
            return src.replace(/\/files\/[^/]*\/uploads\//, "/uploads/");
        }

        if (domain === "thumb.guucdn.net") {
            return src.replace(/:\/\/[^/]*\/[0-9]+x[0-9]+\//, "://");
        }

        if ((domain === "game4v.com" &&
             src.indexOf("/thumb/thumb.php?") >= 0) ||
            domain === "static.pinwallpapers.com") {
            return decodeURIComponent(src.replace(/.*?\/thumb\.php.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain_nowww === "newpal.ps" ||
            domain_nosub === "iravunk.com" ||
            domain_nowww === "pardisgame.net") {
            newsrc = decodeURIComponent(src.replace(/.*?\/thumb\.php.*?[?&]src=([^&]*).*?$/, "$1"));
            if (newsrc !== src) {
                if (newsrc.match(/^[a-z]+:\/\//))
                    return newsrc;
                else
                    return urljoin(src, ("/" + newsrc).replace(/^\/\//, "/"));
            }
        }

        if (domain === "static.santruyen.com") {
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (amazon_container === "boligsurf-production" &&
            src.indexOf("/assets/images/") >= 0) {
            return src.replace(/\/fixed_[0-9]+_[0-9]+\//, "/original/");
        }

        if (domain === "bt.bmcdn.dk") {
            return src.replace(/\/image_[0-9]+(?:x[0-9]+)?\/image\//, "/image/image/");
        }

        if (domain_nowww === "sonara.net") {
            return decodeURIComponent(src.replace(/:\/\/[^/]*\/cro\.php.*?[?&]image=([^&]*).*?$/, "://images.sonara.net$1"));
        }

        if (domain === "d2u7zfhzkfu65k.cloudfront.net" &&
            src.indexOf("/resize/wp-content/") >= 0) {
            return src.replace(/:\/\/[^/]*\/resize\//, "://d3kszy5ca3yqvh.cloudfront.net/");
        }

        if (domain === "imgbp.hotp.jp") {
            return src.replace(/_[0-9]+-[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (amazon_container === "ro69-bucket") {
            return src.replace(/(\/image\/[0-9]+\/)[^/]*\/resize_image/, "$1default/resize_image");
        }

        if (domain === "aimg-pictpix.akamaized.net") {
            return src.replace(/(:\/\/[^/]*\/)ts[0-9]+x[0-9]+\/img\//, "$1img/");
        }

        if (amazon_container === "lattepic") {
            return src.replace(/(\/[a-z]+_)[a-z]+(\.[^/.?]*)$/, "$1org$2");
        }

        if (domain === "coconala.akamaized.net") {
            return src.replace(/\/service_images\/[0-9]+x[0-9]+\//, "/service_images/original/");
        }

        if (domain === "dplhqivlpbfks.cloudfront.net") {
            return src.replace(/.*(\/[0-9a-f]+-[0-9]+\.[^/.]*)$/, "https://coconala.akamaized.net/coconala-public-files/service_images/original$1");
        }

        if (domain === "www.ysbnow.com") {
            return src.replace(/(:\/\/[^/]*\/dam).*?[?&](media-id=[^&]*).*?$/, "$1?$2");
        }

        if (domain === "www.quizz.biz" &&
            src.indexOf("/uploads/") >= 0) {
            return src.replace(/(\/[0-9]+\/)[a-z]+(\/[0-9]+)(?:_[0-9]+)?(\.[^/.]*)$/,"$1orig$2$3");
        }

        if (domain_nosub === "flipagramcdn.com" && domain.match(/c[0-9]*\.flipagramcdn\.com/)) {
            return src.replace(/-[a-z]+(?:\?.*)?$/, "");
        }

        if (domain === "images-cdn.9gag.com" ||
            domain === "img-9gag-fun.9cache.com" ||
            domain === "d24w6bsrhbeh9d.cloudfront.net" ||
            domain === "miscmedia-9gag-fun.9cache.com") {
            return src
                .replace(/\/thumbnail-facebook\/([^/]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/thumbnail-facebook/$1_n$2")
                .replace(/_460swp(\.[^/.]*)$/, "_700bwp$1")
                .replace(/_460s(_v1)?(\.[^/.]*)$/, "_700b$1$2");
        }

        if (domain_nowww === "samironsheadshots.com" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/\/small\/([^/]*)$/, "/large/$1");
        }

        if (domain === "cps-static.rovicorp.com") {
            return src.replace(/\/_derived_[^/]*(\/[^/]*)$/, "$1");
        }

        if (domain_nosub === "netflixmovies.com" && domain.match(/i[0-9]*\.netflixmovies\.com/)) {
            return src.replace(/\/image\/upload\/[wh]_[0-9]+\//, "/image/upload/");
        }

        if (domain === "www.shakespearesglobe.com") {
            return src.replace(/(\/images\/[0-9]+)\/[a-z]+(?:\?.*)?$/, "$1");
        }

        if (domain_nosub === "rsc.org.uk" && domain.match(/cdn[0-9]*\.rsc\.org\.uk/)) {
            return src.replace(/\.tmb-img-[0-9]*\./, ".");
        }

        if (domain === "images.fashionmodeldirectory.com") {
            return src.replace(/(\/[0-9]+-[^/]*-)[a-z]+(\.[^/.]*)$/, "$1fullsize$2");
        }

        if (domain === "cdn.public.hegre.com") {
            return src.replace(/-image-[0-9]+x(\.[^/.]*)(?:[?#].*)?$/, "-image-fullsize$1");
        }

        if (domain === "crystal.cafe" ||
            domain === "cdn.syn-ch.com" ||
            domain_nowww === "alphachan.org" ||
            (domain_nowww === "zonadelta.net" && src.indexOf("/deltachan/") >= 0) ||
            domain_nowww === "lolcow.farm") {
            return add_extensions(src.replace(/\/thumb\//, "/src/"));
        }

        if ((domain === "www.skinnygossip.com" ||
             domain_nowww === "alternatehistory.com" ||
             domain_nowww === "gtplanet.net" ||
             domain_nowww === "burbuja.info" ||
             domain_nowww === "kadinlarkulubu.com" ||
             domain_nowww === "arrse.co.uk") &&
            src.indexOf("/proxy.php?") >= 0) {
            return decodeURIComponent(src.replace(/.*?\/proxy\.php.*?[?&]image=([^&]*).*?$/, "$1"));
        }

        if (domain === "usa-grlk5lagedl.stackpathdns.com") {
            return src.replace(/(\/images\/[^/]*)\?.*$/, "$1?fm=pjpg");
        }

        if (domain === "static.sify.com") {
            return src.replace(/(\/cms\/image\/[^/]*)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "thumbs.wikifeet.com") {
            return src.replace(/:\/\/[^/]*\//, "://pics.wikifeet.com/");
        }

        if (domain === "static.spotboye.com") {
            return src.replace(/(_[0-9a-f]+)(?:_[a-z]+)?(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain === "img.news.goo.ne.jp") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/cpimg\/([^/]*\.[^/]*)/, "http://$1");
        }

        if (domain === "preview.redd.it") {
            return src.replace(/:\/\/preview\.redd\.it\/([^/.]*\.[^/.?]*)\?.*$/, "://i.redd.it/$1");
        }

        if (domain === "i.reddituploads.com") {
            return src.replace(/(:\/\/[^/]*\/[0-9a-f]+)\?.*$/, "$1");
        }

        if ((domain_nosub === "redditmedia.com" ||
             domain_nosub === "redd.it") &&
            host_domain_nosub === "reddit.com" &&
            options.element && options.do_request && options.cb) {
            newsrc = (function() {
                function checkimage(url) {
                    url = urljoin(options.host_url, url, true);
                    if (url.match(/^(?:[a-z]+)?:\/\/[^/]*\.redditmedia\.com\//) ||
                        url.match(/^(?:[a-z]+)?:\/\/[^/]*\.redd\.it\//))
                        return url;

                    if (bigimage_recursive(url, {
                        fill_object: false,
                        iterations: 3,
                        use_cache: false,
                        null_if_no_change: true,
                        do_request: function(){},
                        cb: function(){}
                    }) !== null) {
                        return url;
                    }
                }

                function request(url) {
                    var id;

                    if (url.match(/^t3_/))
                        id = url;
                    else {
                        id = url.replace(/.*\/comments\/([^/]*)\/[^/]*(?:\/(?:\?.*)?)?$/, "$1");
                        if (id === url) {
                            return;
                        }

                        id = "t3_" + id;
                    }

                    options.do_request({
                        method: "GET",
                        url: "https://www.reddit.com/api/info.json?id=" + id,
                        onload: function(result) {
                            try {
                                var json = JSON_parse(result.responseText);
                                var item = json.data.children[0].data;
                                var image = item.url;

                                if (!checkimage(image)) {
                                    if (item.preview.images[0].variants.gif)
                                        image = item.preview.images[0].variants.gif.source.url;
                                    else
                                        image = item.preview.images[0].source.url;

                                    image = image.replace(/&amp;/g, "&");
                                }

                                return options.cb(image);
                            } catch (e) {
                                console_log(id);
                                console_log(result);
                                console_error(e);
                            }

                            options.cb(null);
                        }
                    });

                    return {
                        waiting: true
                    };
                }

                if (options.element.parentElement && options.element.parentElement.parentElement) {
                    var doubleparent = options.element.parentElement.parentElement;
                    newsrc = doubleparent.getAttribute("data-url");

                    if (newsrc) {
                        if (checkimage(newsrc))
                            return newsrc;
                        else {
                            var id = doubleparent.getAttribute("data-fullname");
                            if (id) {
                                newsrc = request(id);
                                if (newsrc)
                                    return newsrc;
                            }
                        }
                    }

                    if (doubleparent.parentElement) {
                        if (doubleparent.parentElement.tagName === "A" && options.do_request && options.cb) {
                            newsrc = request(doubleparent.parentElement.href);
                            if (newsrc)
                                return newsrc;
                        }

                        if (options.element.parentElement.tagName === "A" &&
                            (options.element.parentElement.getAttribute("target") === "_blank" ||
                             options.element.parentElement.classList.contains("PostThumbnail"))) {

                            newsrc = options.element.parentElement.href;
                            if (checkimage(newsrc))
                                return newsrc;
                        }

                        var current = options.element;
                        var found = false;
                        while ((current = current.parentElement)) {
                            if (current.classList.contains("scrollerItem") ||
                                current.classList.contains("Post__top")) {
                                found = true;
                                break;
                            }
                        }

                        if (found) {
                            var elements = current.getElementsByTagName("a");
                            for (var i = 0; i < elements.length; i++) {
                                var element = elements[i];
                                if (element.getAttribute("data-click-id") === "body" ||
                                    element.classList.contains("Post__absoluteLink")) {
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

        if ((domain_nosub === "gstatic.com" ||
             domain === "") &&
            host_domain_nosub.match(/^google\./) && options.element) {
            newsrc = (function() {
                var current = options.element;
                while ((current = current.parentElement)) {
                    if (current.tagName !== "A")
                        continue;

                    if (!current.href.match(/\/imgres\?/))
                        continue;

                    return decodeURIComponent(current.href.replace(/.*?\/imgres.*?[?&]imgurl=([^&]*).*?$/, "$1"));
                }

                current = options.element;
                while ((current = current.parentElement)) {
                    if (current.tagName !== "A")
                        continue;

                    if (!current.href.match(/\/search\?/))
                        continue;

                    var parent = current.parentElement;
                    if (parent.tagName !== "DIV")
                        continue;

                    var notranslate = parent.getElementsByClassName("notranslate");
                    if (!notranslate.length) {
                        parent = parent.parentElement;
                        if (!parent || parent.tagName !== "DIV")
                            break;

                        notranslate = parent.getElementsByClassName("notranslate");
                        if (!notranslate.length)
                            continue;
                    }

                    for (var i = 0; i < notranslate.length; i++) {
                        var el = notranslate[i];
                        if (!el.innerHTML.match(/^ *{/))
                            continue;

                        var json = JSON_parse(el.innerHTML);

                        if (json.ou.match(/^[a-z]+:/))
                            return json.ou;

                        break;
                    }
                }
            })();
            if (newsrc !== undefined)
                return newsrc;
        }

        if (domain_nosub === "fbcdn.net" &&
            host_domain_nosub === "facebook.com" && options.element) {
            var element = options.element;

            if (element.tagName === "IMG") {
                while ((element = element.parentElement)) {
                    if (element.tagName === "A") {
                        var ploi = element.getAttribute("data-ploi");
                        if (ploi && ploi.match(/^https?:\/\/[^/]*fbcdn\.net\//))
                            return ploi;
                    }
                }
            }
        }

        if (domain === "thumbnail.named.com" ||
            domain === "thumb.named.com") {
            return [
                src.replace(/:\/\/[^/]*\/.*?(\/+file\/+photo\/+.*)/, "://thumb.named.com/normal/resize/origin$1")
            ];
        }

        if (domain_nosub === "bing.com" &&
            host_domain_nosub === "bing.com" && options.element) {
            var current = options.element;
            while ((current = current.parentElement)) {
                if (current.tagName !== "A")
                    continue;

                console_log(current.href);
                if (!current.href.match(/\/images\/search\?.*mediaurl=/))
                    continue;

                return decodeURIComponent(current.href.replace(/.*?\/search.*?[?&]mediaurl=([^&]*).*?$/, "$1"));
            }
        }

        if (domain_nosub === "deviantart.net" &&
            (domain.match(/^pre[0-9]*\.deviantart\.net/) ||
             domain.match(/^img[0-9]*\.deviantart\.net/)) &&
            src.match(/\/[a-z0-9]\/[0-9]+\/[0-9a-z]+\/[0-9a-z]+\/[0-9a-z]+\/[^/]*-[0-9a-z]+\.[^/.]*$/) &&
            options && options.do_request && options.cb) {

            newsrc = (function() {
                var id = src.replace(/.*-([0-9a-z]+)\.[^/.]*$/, "$1");

                options.do_request({
                    method: "GET",
                    url: "http://fav.me/" + id,
                    onload: function(result) {
                        if (result.status !== 200) {
                            console_log(result);
                            options.cb(null);
                            return;
                        }

                        var obj = {
                            url: null,
                            waiting: false,
                            extra: {
                                page: result.finalUrl
                            }
                        };

                        if (!src.match(/:\/\/[^/]*\/fake_image\//))
                            obj.url = src;

                        try {
                            var hrefre = /href=["'](https?:\/\/www\.deviantart\.com\/download\/[0-9]+\/[^/>'"]*?)["']/;
                            var match = result.responseText.match(hrefre);
                            if (!match) {
                                console_error("No public download for " + src);

                                if (true) {
                                    try {
                                        var hrefre = /<img[^>]*?src=["'](https?:\/\/(?:images-wixmp)[^>'"]*?)["'][^>]*class=["']dev-content-/g;
                                        var match = result.responseText.match(hrefre);
                                        if (match) {
                                            var maxres = 0;
                                            var maxurl = null;
                                            for (var i = 0; i < match.length; i++) {
                                                var whmatch = match[i].match(/width=["']?([0-9]+)/);
                                                var oururl = match[i].match(/\ssrc=['"](http[^'"]*)/);
                                                if (!oururl)
                                                    continue;
                                                oururl = oururl[1];
                                                var base = 0;
                                                if (!whmatch)
                                                    continue;
                                                base = parseInt(whmatch[1]);
                                                whmatch = match[i].match(/height=["']?([0-9]+)/);
                                                if (!whmatch)
                                                    continue;
                                                base *= parseInt(whmatch[1]);

                                                if (base > maxres) {
                                                    maxres = maxres;
                                                    maxurl = oururl;
                                                }
                                            }

                                            if (maxurl &&
                                                maxurl.replace(/\?.*/) !== src.replace(/\?.*/)) {
                                                obj.url = maxurl;
                                                obj.likely_broken = false;
                                                options.cb(obj);
                                                return;
                                            }
                                        }
                                        return options.cb(obj);
                                    } catch (e) {
                                        console_error(e);
                                    }
                                }
                                return;
                            }

                            var href = match[1].replace("&amp;", "&");

                            options.do_request({
                                method: "HEAD",
                                url: href,
                                onload: function(result) {
                                    if (result.status !== 200 && result.status !== 405) {
                                        console_log("Error fetching DeviantArt download link:");
                                        console_log(result);
                                        options.cb(obj);
                                        return;
                                    }

                                    var finalurl = result.finalUrl;
                                    if (finalurl.match(/^[a-z]+:\/\/(?:www\.)?deviantart\.com\/users\/outgoing\?/)) {
                                        finalurl = finalurl.replace(/^[a-z]+:\/\/(?:www\.)?deviantart\.com\/users\/outgoing\?/, "");
                                    }
                                    obj.url = finalurl;
                                    obj.likely_broken = false;
                                    options.cb(obj);
                                }
                            });
                        } catch (e) {
                            console_error(e);
                            options.cb(obj);
                        }
                    }
                });
            })();

            return {
                "waiting": true
            };
        }

        if (domain_nowww === "af-hobby.com" ||
            domain === "sky-seller.com") {
            return src.replace(/\/image\/cache\/(.*)-[0-9]+x[0-9]+(\.[^/.]*)$/, "/image/$1$2");
        }

        if (domain === "www.huangdi5000.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/p\.php.*?[?&]p=(.*)$/, "$1"));
        }

        if (domain === "www.popcornfor2.com" &&
            src.indexOf("/upload/") >= 0) {
            return src.replace(/\/news-[a-z]+-([0-9]+\.[^/.]*)$/, "/news-full-$1");
        }

        if (domain === "img.daily.co.kr") {
            return src.replace("/content_watermark/", "/content/");
        }

        if (domain === "file.gamedonga.co.kr") {
            return src.replace(/(\/files\/[0-9]+\/[0-9]+\/[0-9]+\/)[a-z]\/([^/]*)$/, "$1$2");
        }

        if (domain === "jrimage.dongascience.com") {
            return src.replace(/(\/[0-9]+)_thumb(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "cloud.tcusercontent.net") {
            return src.replace(/(-[0-9]+-[0-9a-f]+)-[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "image.entertainment-topics.jp" ||
            domain === "image.code-file.jp" ||
            domain === "image.make-book.jp") {
            return src.replace(/(:\/\/[^/]*\/)(item\/image\/|article\/)[a-z]+(\/[^/]*)$/, "$1$2original$3");
        }

        if ((domain_nosub === "styapokupayu.ru" &&
             src.indexOf("/images/") >= 0) ||
            (domain_nosub === "yapokupayu.ru" &&
             src.indexOf("/system/images/") >= 0)) {
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain_nowww === "thai.ac") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/news\/tn\/.*?[?&]fn=([^&]*).*?/, "$1"));
        }

        if (domain_nosub === "styleshare.kr" &&
            domain.match(/usercontents(?:-[a-z])?\.styleshare\.kr/)) {
            return src.replace(/(\/images\/[0-9]+\/)[-0-9]+x[-0-9]+(?:\?.*)?$/, "$1original");
        }

        if (domain === "images.vingle.net") {
            return src.replace(/(:\/\/[^/]*\/upload\/)t_[^/]*\/([^/]*)$/, "$1$2");
        }

        if (domain === "www.anewsa.com") {
            return src.replace(/(_images\/[0-9]+\/[0-9]+\/[0-9]+\/)mark(\/[^/]*)$/, "$1original$2");
        }

        if (domain === "img.newspim.com") {
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.insectidentification.org") {
            return src.replace(/(\/imgs\/[a-z]+\/)thumbnails\//, "$1");
        }

        if (domain_nowww === "a-z-animals.com") {
            return src.replace(/\/images\/[0-9]+x[0-9]+\//, "/images/original/");
        }

        if (domain_nosub === "nicematin.com" &&
            domain.match(/cdn\.static[0-9]*\.nicematin\.com/)) {
            return src.replace(/(:\/\/[^/]*\/media\/[^/]*\/)[^/]*(\/[0-9]+\/[0-9]+\/[^/]*)$/, "$1original$2");
        }

        if (((domain_nosub === "fbcdn.net" && domain.match(/^instagram\./)) ||
             domain_nosub === "cdninstagram.com") &&
            host_domain_nosub === "instagram.com" && options.element &&
            options.do_request && options.cb) {
            newsrc = (function() {
                var query_ig = function(url, cb) {
                    options.do_request({
                        method: "GET",
                        url: url,
                        onload: function(result) {
                            if (result.readyState !== 4)
                                return;

                            try {
                                var text = result.responseText;

                                var regex1 = /window\._sharedData = *(.*?);?<\/script>/;
                                var regex2 = /window\._sharedData *= *(.*?}) *;[\s]*window\.__initialDataLoaded/;

                                var match = text.match(regex1);
                                if (!match) {
                                    match = text.match(regex2);
                                }

                                cb(JSON_parse(match[1]));
                            } catch (e) {
                                console_log(result);
                                console_error(e);
                                cb(null);
                            }
                        }
                    });
                };

                var uid_from_sharedData = function(json) {
                    if (json.id)
                        return json.id;
                    else {
                        return json.entry_data.ProfilePage[0].graphql.user.id;
                    }
                };

                var username_to_uid = function(username, cb) {
                    if (username.match(/^http/)) {
                        username = username.replace(/^[a-z]+:\/\/[^/]*\/([^/]*)(?:\/.*)?$/, "$1");
                    }

                    query_ig("https://www.instagram.com/" + username + "/", function(json) {
                        try {
                            cb(uid_from_sharedData(json));
                        } catch (e) {
                            console_error(e);
                            cb(null);
                        }
                    });
                };

                var uid_to_profile = function(uid, cb) {
                    var url = "https://i.instagram.com/api/v1/users/" + uid + "/info/";
                    options.do_request({
                        method: "GET",
                        url: url,
                        onload: function(result) {
                            if (result.readyState !== 4)
                                return;

                            try {
                                cb(JSON_parse(result.responseText).user);
                            } catch (e) {
                                console_log(result);
                                console_error(e);
                                cb(null);
                            }
                        }
                    });
                };

                var profile_to_url = function(profile) {
                    return profile.hd_profile_pic_url_info.url;
                };

                var request_profile = function(username) {
                    username_to_uid(username, function(uid) {
                        if (!uid) {
                            options.cb(null);
                            return;
                        }

                        uid_to_profile(uid, function(profile) {
                            if (!profile) {
                                options.cb(null);
                                return;
                            }

                            options.cb(profile_to_url(profile));
                        });
                    });

                    return {
                        waiting: true
                    };
                };

                var request_post_inner = function(post_url, image_url, cb) {
                    query_ig(post_url, function(json) {
                        if (!json) {
                            cb(null);
                            return;
                        }

                        try {
                            var media = json.entry_data.PostPage[0].graphql.shortcode_media;

                            var images = [];
                            var parse_image = function(node) {
                                var image = node.display_src;
                                if (!image)
                                    image = node.display_url;

                                if (image && images.indexOf(image) < 0) {
                                    images.push(image);
                                }
                            };

                            parse_image(media);

                            if (media.edge_sidecar_to_children) {
                                var edges = media.edge_sidecar_to_children.edges;
                                for (var i = 0; i < edges.length; i++) {
                                    var edge = edges[i];
                                    if (edge.node)
                                        edge = edge.node;

                                    parse_image(edge);
                                }
                            }

                            var image_id = image_url.replace(/.*\/([^/.]*)\.[^/.]*(?:[?#].*)?$/, "$1");
                            for (var i = 0; i < images.length; i++) {
                                if (images[i].indexOf(image_id) > 0) {
                                    cb(images[i]);
                                    return;
                                }
                            }

                            cb(null);
                        } catch (e) {
                            console_error(e);
                            cb(null);
                        }
                    });

                    return {
                        waiting: true
                    };
                };

                var request_post = function(post_url, image_url) {
                    return request_post_inner(post_url, image_url, options.cb);
                };

                var current = options.element;
                while ((current = current.parentElement)) {
                    if (current.tagName !== "A")
                        continue;

                    if (current.href.match(/:\/\/[^/]*\/p\//)) {
                        newsrc = request_post(current.href, options.element.src);
                        if (newsrc)
                            return newsrc;
                    } else if (current.href.match(/:\/\/[^/]*\/[^/]*(?:\/(?:\?.*)?)?$/)) {
                        newsrc = request_profile(current.href);
                        if (newsrc)
                            return newsrc;
                    }
                }

                current = options.element;
                while ((current = current.parentElement)) {
                    if (current.tagName === "HEADER") {
                        var sharedData = null;

                        var scripts = document.getElementsByTagName("script");
                        for (var i = 0; i < scripts.length; i++) {
                            if (scripts[i].innerText.match(/^ *window\._sharedData/)) {
                                sharedData = scripts[i].innerText.replace(/^ *window\._sharedData *= *({.*}) *;.*?/, "$1");
                            }
                        }

                        if (!sharedData) {
                            console_error("Shared data not found");
                            continue;
                        } else {
                            sharedData = JSON.parse(sharedData);
                        }

                        uid_to_profile(uid_from_sharedData(sharedData), function(profile) {
                            if (!profile) {
                                options.cb(null);
                                return;
                            }

                            options.cb(profile_to_url(profile));
                        });

                        return {
                            waiting: true
                        };
                    }

                    if (current.tagName === "DIV" && current.getAttribute("role") === "dialog") {
                        newsrc = request_post(document.location.href, options.element.src);
                        if (newsrc)
                            return newsrc;
                    }
                }
            })();
            if (newsrc !== undefined)
                return newsrc;
        }

        if (domain_nosub === "instagram.com" &&
            !(domain_nowww === "instagram.com" &&
              (src.match(/:\/\/[^/]*\/p\/[^/]*/) ||
               src.match(/:\/\/[^/]*\/[-a-zA-Z0-9_.]+(?:\?.*)?$/)))) {
            return {
                url: src,
                headers: {
                    "Referer": "https://www.instagram.com"
                }
            };
        }

        if (domain === "cdns.klimg.com" ||
            domain === "cdn.klimg.com") {
            return src
                .replace(/(:\/\/[^/]*\/+[^/]*\.[^/]*\/+)resized\/+[0-9]+x(?:[0-9]+)?\/+/, "$1")
                .replace(/\/resized\/[0-9]+x(?:[0-9]+)?\//, "/kapanlagi.com/")
                .replace(/(\/g\/.\/.\/[^/]*\/)t\/([^/]*)$/, "$1$2")
                .replace(/(\/p\/+[^/]*\/+)[0-9]+x[0-9]+\/+([^/]*$)/, "$1$2");
        }

        if (domain_nosub === "nintendo-europe.com" &&
            domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/_image[0-9]*[wh](\.[^/.]*)$/, "$1");
        }

        if ((domain_nowww === "gonintendo.com" && src.indexOf("/file_uploads/uploads/") >= 0) ||
            (domain === "gozzip.id" && src.indexOf("/BlogBody/photos/") >= 0)) {
            return src.replace(/(\/[0-9]+\/[0-9]+\/[0-9]+)\/[a-z]+\/([^/]*)$/, "$1/original/$2");
        }

        if (domain_nosub === "15min.lt" &&
            domain.match(/s[0-9]*\.15min\.lt/) &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/\/[a-z]+(\/[^/]*)$/, "/original$1");
        }

        if (domain_nosub === "bdbphotos.com" &&
            domain.match(/^img[0-9]*\.bdbphotos\.com/) && false) {
            return {
                url: src.replace(/\/images\/[a-z]+\//, "/images/orig/"),
                headers: {
                    Referer: "https://www.famousfix.com/"
                }
            };
        }

        if (domain_nosub === "lazygirls.info" &&
            domain.match(/^img[0-9]*\.lazygirls\.info/)) {
            return src.replace(/:\/\/.*\/([^/.]*)\.[^/]*$/, "://lzimages.lazygirls.info/$1");
        }

        if (domain === "lzimages.lazygirls.info") {
            return src.replace(/\.(?:thumb|sized)$/, "");
        }

        if (domain === "image.way2enjoy.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/misc\/lazyg\/.*?\/([^/]*)\.[^/.]*\.[^/.]*$/,
                               "http://lzimages.lazygirls.info/$1");
        }

        if (domain === "www.mobtada.com") {
            return src.replace(/(:\/\/[^/]*\/)resize.*?[?&]src=([^&]*).*?$/, "$1$2");
        }

        if (domain_nowww === "art-dept.com") {
            return src.replace(/\/cache\/([^/]*)_[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "static.stylosophy.it") {
            newsrc = src.replace(/(:\/\/[^/]*\/)(r\/)[0-9]+[xX][0-9]+\//, "$1$2999999999999x0/");
            if (newsrc !== src)
                return newsrc;
        }

        if (amazon_container === "nikeinc" &&
            src.indexOf("/assets/") >= 0) {
            return src.replace(/_hd_[0-9]+(\.[^/.]*)$/, "_original$1");
        }

        if (domain_nowww === "mitazamagica.com" &&
            src.indexOf("/Shops/") >= 0) {
            return src.replace(/_[a-z]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "imgbase.info" &&
            src.indexOf("/images/safe-wallpapers/") >= 0) {
            newsrc = src.replace(/\/[a-z]+_([0-9]+[^/]*)$/, "/$1");
            return {
                url: newsrc,
                headers: {
                    Referer: "https://www.wallpapervortex.com/wallpaper-" + src.replace(/\/[a-z]+_([0-9]+[^/]*)\.[^/.]*$/, "$1") + ".html"
                }
            };
        }

        if (domain_nowww === "paperlief.com" ||
            domain_nowww === "celebritywc.com" ||
            domain_nowww === "eskipaper.com") {
            return src.replace(/\/images[0-9]+_([0-9]+)?\//, "/images/");
        }

        if (domain_nosub === "anidb.net" &&
            domain.match(/img[0-9]*(?:-[a-z]+)?\.anidb\.net/)) {
            return src.replace(/\/thumbs\/[0-9]+x[0-9]+(\/[0-9]+\.[^/.-]*)-thumb\.[^/.]*$/, "$1");
        }

        if (domain === "web-ace.jp") {
            return src.replace(/\/rp\/[0-9_]+\/[0-9]+_[0-9]+\/img\//, "/img/");
        }

        if (domain_nowww === "classy-girls.com") {
            return src.replace(/\/images\/+thumbnails\//, "/images/");
        }

        if (domain === "staticdelivery.nexusmods.com") {
            return src.replace(/\/images\/+thumbnails\//, "/images/");
        }

        if (domain === "forums.nexusmods.com") {
            return src.replace(/\/uploads\/profile\/photo-thumb-([0-9]+)/, "/uploads/profile/photo-$1");
        }

        if ((domain_nowww === "kb4images.com" ||
             domain_nowww === "99desktopwallpapers.com") &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/-small(\.[^/.]*)$/, "$1");
        }

        if (domain === "pics.me.me") {
            return src.replace(/\/thumb_([^/]*-[0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "image.winudf.com") {
            return src
                .replace(/\?[wh]=[0-9]+&/, "?")
                .replace(/&[wh]=[0-9]+/, "");
        }

        if (domain === "i.supload.com") {
            return src.replace(/\/[0-9]+x[0-9]+\//, "/");
        }

        if (domain_nosub === "yaplakal.com" &&
            domain.match(/s[0-9]*\.yaplakal\.com/)) {
            return src.replace(/\/pics\/pics_[a-z]+\//, "/pics/pics_original/");
        }

        if (domain === "static.comicvine.com") {
            return src.replace(/\/uploads\/[^/]*\//, "/uploads/original/");
        }

        if (domain === "preview.ibb.co" && false) {
        }

        if (domain === "image.ibb.co" ||
            domain === "preview.ibb.co") {
            return src.replace(/(_id[0-9]{5,})_[0-9a-z_]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "cdn.imagepush.to") {
            return src.replace(/(:\/\/[^/]*\/)(?:in|out)\/[0-9]+x[0-9]+\//, "$1");
        }

        if (domain_nosub === "luscious.net" &&
            domain.match(/cdn[a-z]*\.luscious\.net/)) {
            newsrc = src
                .replace(/\.[0-9]+x[0-9]+(\.[^/]*)$/, "$1")
                .replace(/\/resized\/[0-9]+\//, "/");
            if (newsrc !== src) {
                return [newsrc, newsrc.replace(/\.jpg$/, ".png")];
            }
        }

        if (domain === "d2pqhom6oey9wx.cloudfront.net") {
            return src.replace(/\/img_resize\//, "/img_original/");
        }

        if (domain === "i.gyazo.com") {
            return src.replace(/\/thumb\/[0-9]+\/([0-9a-f]+)-([a-z]+)\.[^/.]*$/, "/$1.$2");
        }

        if (domain === "cdn.theatlantic.com" &&
            src.match(/\/assets\/media\/(?:[^/]*\/)?img\//)) {
            return src.replace(/\/[^/.]*(\.[^/.]*)$/, "/original$1");
        }

        if (domain === "media.tag24.de") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\//, "$10/");
        }

        if ((amazon_container && amazon_container.match(/^customink-iotw/)) ||
            domain === "d2fzf9bbqh0om5.cloudfront.net") {
            return src.replace(/(\/images\/[0-9]+\/)[^/]*\//, "$1original/");
        }

        if (domain === "www.mypokecard.com") {
            return src.replace(/\/galery\/thumbs\//, "/galery/");
        }

        if (domain === "media.women.com" &&
            src.indexOf("/images/images/") >= 0) {
            return src.replace(/\/[a-z]+\/([^/]*)$/, "/original/$1");
        }

        if (domain_nowww === "alternathistory.com") {
            return src.replace(/\/files\/resize(\/.*\/[^/]*)-[0-9]+x[0-9]+(\.[^/.]*)$/, "/files$1$2");
        }

        if (domain_nowww === "mtvwe.com") {
            return src
                .replace(/\/vpic\.php.*?[?&]f=([^&]*).*?$/, "/$1")
                .replace(/(:\/\/[^/]*\/)\/*/, "$1");
        }

        if (domain === "yahoo.tw.weibo.com") {
            return src.replace(/(:\/\/[^/]+\/)[a-z]+\//, "$1large/");
        }

        if (domain === "mobile.pic.people.com.cn") {
            return src.replace(/\/thumbs\/[0-9]+\/[0-9]+\//, "/");
        }

        if (domain === "images.asianstar.cz") {
            return src.replace(/\/[a-z]+_([^/]*)$/, "/$1");
        }

        if (domain === "picservice.qimai.cn") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/get\//, "");
        }

        if (domain_nowww === "wxzixun.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/p\//, "");
        }

        if (domain === "mediaday.co.kr" ||
            domain_nowww === "5rs-1.com") {
            return src.replace(/\/uploads\/cache\/(.*)\/thumb-([0-9a-f]+(?:_[0-9]+)?)_[0-9]+x[0-9]+(\.[^/.]*)$/,
                               "/uploads/$1/$2$3");
        }

        if (domain === "up.kpop.re") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+(\/[0-9a-f]{2}\/[0-9a-f]+\.[^/.]*)(?:\/[^/]*)?$/, "$1src$2");
        }

        if (domain === "st.kp.yandex.net" &&
            src.indexOf("/images/") >= 0) {
            return src.replace(/\/[a-z]+_([0-9]+(?:_[^/]*)?\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "startfilm.ru" && src.indexOf("/images/") >= 0) {
            return src.replace(/\/sm_([0-9]+_[^/]*)$/, "/$1");
        }

        if (domain_nowww === "publicfeet.com") {
            return src.replace(/\/img\/t([0-9]+\.[^/.]*)$/, "/img/$1");
        }

        if (domain_nowww === "twatis.com") {
            return src.replace(/\/thumb(\.[^/.]*)$/, "/photo$1");
        }

        if (domain === "images.starlets.photos") {
            return src.replace(/(\/[0-9]+-)[a-z]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "s.smutty.com") {
            return src.replace(/\/m\/([^/]*)$/, "/p/$1");
        }

        if (domain === "welovesexyfeet.com" ||
            domain_nowww === "podolatria.net" ||
            domain === "img.ibxk.com.br") {
            return src.replace(/-t[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "tfk.thefreekick.com" ||
            domain_nowww === "discourse-cdn-sjc1.com" ||
            domain_nowww === "swagup.co.kr" ||
            amazon_container === "pixls-discuss" ||
            domain === "forum.combustionpunks.co.uk") {
            return src.replace(/(:\/\/[^/]*\/|\/uploads\/[a-z]+\/)?optimized(\/.*\/[0-9a-f]+)_[0-9]+_[0-9]+x[0-9]+(\.[^/.]*)$/,
                               "$1original$2$3");
        }

        if (domain_nowww === "hotflick.net" ||
            amazon_container === "hotflicknet") {
            return src
                .replace(/(:\/\/[^/]*\/.*\/[0-9]+\/)tn\/[0-9]+_[a-z]+\/([^/]*)$/, "$1$2")
                .replace(/\/+(?:tn[0-9]+|Thumb)\/+([^/]*)(?:[?#].*)?$/, "/$1")
                .replace(/:\/\/(?:[^/.]*-)?s3\.amazonaws\.com\/hotflicknet\/(.*\/)tn\/([^/]*)$/, "://hotflicknet.s3.amazonaws.com/$1$2")
                .replace(/:\/\/[^/]*\/(.*\/)tn\/([^/]*)$/, "://hotflicknet.s3.amazonaws.com/$1$2");
        }

        if (domain === "www.seniorclassaward.com" ||
            domain_nowww === "zocalo.com.mx") {
            return src.replace(/\/images\/sized(\/images\/.*)-[0-9]+x[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "www.hentairing.com") {
            return src
                .replace(/\/(?:width|height)-[0-9]+\/([^/]*)$/, "/$1")
                .replace(/\?.*/, "");
        }

        if (domain_nosub === "enterdesk.com" &&
            domain.match(/^up\./)) {
            return src.replace(/\/edpic_[0-9]+(?:_[0-9]+)?\//, "/edpic_source/");
        }

        if (domain_nosub === "gtimg.com" &&
            domain.match(/img[0-9]*\.gtimg\.com/)) {
            return src.replace(/_[0-9]+x[0-9]+_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "zol-img.com.cn") {
            return src
                .replace(/(:\/\/[^/]*\/)t_[0-9a-z]+\//, "$1")
                .replace(/(\/article\/[0-9]+)_[0-9]+x[0-9]+\//, "$1/");
        }

        if (domain === "img.faxing11.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/img\//, "http://");
        }

        if (domain === "static.congnghe.vn") {
            return src
                .replace(/\/srv_thumb\.ashx.*?[?&]f=([^&]*).*/, "/$1")
                .replace(/\\/g, "/")
                .replace(/\/[^/]*-([0-9]+\.[^/.]*)\.[0-9]+\.[0-9]+\.[^/.]*$/, "/$1");
        }

        if (domain === "images.foody.vn") {
            return src.replace(/\/s[0-9]+x[0-9]+\/([^/]*)$/, "/s/$1");
        }

        if (domain === "programma.sorrisi.com") {
            return src.replace(/\/uploads\/media\/cache\/.*?\/uploads\//, "/uploads/");
        }

        if (domain === "www.vidofa.com" &&
            src.indexOf("/module/thumb/sr.php") >= 0) {
            return decodeURIComponent(src.replace(/.*?\/module\/thumb\/sr\.php.*?[?&]src=([^&]*)$/, "$1"));
        }

        if (domain === "free4kwallpapers.com") {
            return src
                .replace(/\/uploads\/wallpaper\/([0-9]{2}\/.*)-[0-9]+x[0-9]+-wallpaper(\.[^/.]*)$/, "/uploads/originals/20$1$2")
                .replace(/\/uploads\/originals\//, "/no-watermarks/originals/");
        }

        if (domain_nosub === "webnode.com.br" ||
            domain_nosub === "webnode.com") {
            return src.replace(/(:\/\/[^/]*\/_files\/)[^/]*_([0-9]+-[0-9a-f]+(?:-[a-z]+)?\/[^/]*)$/, "$1$2");
        }

        if (amazon_container === "cdn.roosterteeth.com") {
            return src.replace(/(\/images\/[-0-9a-f]+\/)[a-z]+(\/[^/]*)$/, "$1original$2");
        }

        if (domain === "www.wallpaperk.com") {
            return src.replace(/\/resoluciones\/[0-9]+\/([^/]*)_[0-9]+x[0-9]+_([0-9]+\.[^/.]*)$/, "/$1-$2");
        }

        if (domain === "pic.58pic.com" ||
            domain_nosub === "90sjimg.com" ||
            domain === "pic.qiantucdn.com") {
            return src.replace(/!.*/, "");
        }

        if (domain === "img.wallpapersafari.com") {
            return src
                .replace(/\/img[0-9]+\//, "/")
                .replace(/\/desktop\/[0-9]+\/[0-9]+\//, "/");
        }

        if (domain_nosub === "fjcdn.com" &&
            domain.match(/static[0-9]*\.fjcdn\.com/)) {
            return src
                .replace(/\/thumbnails\/comments\//, "/comments/")
                .replace(/\/pictures\/[^/]*_([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]+_[0-9]+\.[^/.]*)$/, "/large/pictures/$1/$2/$1$2$3");
        }

        if (googlestorage_container === "kendam-148811.appspot.com") {
            return src.replace(/\/thumb[0-9]+\/tn[0-9]+_/, "/temp/");
        }

        if (domain === "image-cdn.hypb.st") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/([^&]*).*/, "$1"));
        }

        if (domain_nowww == "productionparadise.com") {
            return src.replace(/(\/photos\/[0-9]+\/)[a-z]+(\/[^/]*)$/, "$1original$2");
        }

        if (domain_nosub === "cargocollective.com" &&
            domain.match(/payload[0-9]*\.cargocollective\.com/)) {
            return src.replace(/_[0-9]{3,4}(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "imagebam.com" &&
            (domain.match(/^thumbs[0-9]*\.imagebam\.com/) ||
             domain.match(/^thumbnails[0-9]*\.imagebam\.com/)) &&
            options && options.cb && options.do_request) {
            id = src.replace(/.*\/([0-9a-f]+)\.[^/.]*$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "http://www.imagebam.com/image/" + id,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<meta *property="og:image" *content="([^"]*)"/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });
                return {
                    waiting: true
                };
            }
        }

        if (domain_nosub === "imagevenue.com" &&
            domain.match(/^img[0-9]+\.imagevenue\.com/) &&
            src.match(/\/th_([^/]*)$/) &&
            options && options.cb && options.do_request) {
            id = src.replace(/.*\/th_([^/]*?)(?:[?#].*)?$/, "$1");
            if (id !== src) {
                var requrl = src.replace(/(:\/\/[^/]*\/).*/, "$1img.php?image=" + id);
                options.do_request({
                    url: requrl,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<img *id=['"]thepic['"][^>]* (?:src|SRC)=['"]([^"']*)['"]/);
                            if (match) {
                                options.cb(urljoin(requrl, match[1], true));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });
                return {
                    waiting: true
                };
            }
        }

        if (domain === "static.cinemagia.ro") {
            return src.replace(/\/img\/resize\/db\/(.*\/[^/]*?-[0-9]+[a-z])-[^/.]*?(\.[^/.]*)$/, "/img/db/$1$2");
        }

        if (domain === "static.kinokopilka.pro") {
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain === "d1uzk9o9cg136f.cloudfront.net") {
            return src.replace(/(\/[a-f0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "static.azteca.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/crop\/crop\.php.*?[?&]img=([^&]*).*?$/, "$1"));
        }

        if (domain === "www.tasoeur.biz") {
            return src.replace(/\/thumbs\/([^/]*)\.thumb(\.[^/.]*)$/, "/$1$2");
        }

        if (domain === "imageproxy.ifcdn.com") {
            return src.replace(/:\/\/[^/]*\/[^/]*(\/images\/[^/]*)$/, "://img.ifcdn.com$1");
        }

        if (domain === "resource.mingweekly.com") {
            return src.replace(/\/userfiles\/sm\/sm[0-9]+_images/, "/userfiles/images");
        }

        if (domain_nosub === "allegroimg.com") {
            return src.replace(/(:\/\/[^/]*\/)s[0-9]+\//, "$1original/");
        }

        if (domain === "mmc.tirto.id") {
            return src.replace(/\/image\/otf\/[0-9]+x[0-9]+\//, "/image/");
        }

        if (domain === "ia.tmgrup.com.tr") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/[^/]*\/(?:[0-9]+\/){5}[0-9]+\/?.*?[?&]u=([^&]*).*?$/, "$1"));
        }

        if (domain === "img.erogazou.co") {
            return src.replace(/\/thumb\//, "/photo/");
        }

        if (domain === "tracks.content.hardstyle.com") {
            return src.replace(/\/thumbs\/[0-9]+x[0-9]+\//, "/original/");
        }

        if ((domain_nosub === "thedjlist.com" && domain.match(/i[0-9]*\./)) ||
            domain === "static.inaturalist.org") {
            return src.replace(/(\/photos\/[0-9]+\/)[a-z]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "artist-assets.hubbardradio.com") {
            return src.replace(/_v[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.ebaumsworld.com" ||
            domain === "images.ebaumsworld.com") {
            return src.replace(/\/thumbs\/(?:picture|gallery)\//, "/mediaFiles/picture/");
        }

        if (domain_nosub === "kapook.com") {
            return src.replace(/\/rf\/[0-9]+\/[0-9]+\//, "/o/");
        }

        if (domain_nosub === "amcn.in" &&
            domain.match(/^cdn[0-9]*\.amcn\.in/)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/a\/([^/.]*\.[^/]*\/)/, "http://$1");
        }

        if (domain_nosub === "litlepups.net" &&
            domain.match(/^cdn[0-9]*\.litlepups\.net/)) {
            return src.replace(/:\/\/[^/]*\/resize\/(.*)\/[a-z]+-([^/]*)$/, "://cdn.litlepups.net/$1/$2");
        }

        if (domain_nowww === "wede-mail.com" ||
            domain_nowww === "warnerchappell.com") {
            return src.replace(/\/slir\/(?:[whc][0-9:]+(?:-[^/]*)|orig)\//, "/");
        }

        if (domain_nowww === "photorator.com" ||
            domain_nowww === "contrastspace.ru" ||
            domain_nowww === "pornopics.co") {
            return src.replace(/\/photos\/(?:thumbs|small)\//, "/photos/images/");
        }

        if (domain_nosub === "cdn-expressen.se") {
            return src
                .replace(/\/[0-9]+(?:@[0-9]+)?(\.[^/.]*)$/, "/original$1")
                .replace(/(\/[0-9a-f]+\/)[0-9]+x[0-9]+(\/[^/]*)$/, "$1annan$2");
        }

        if (domain === "images.csmonitor.com") {
            return src.replace(/(?:\?.*)?$/, "?alias=original");
        }

        if (domain === "www.incimages.com" ||
            domain_nowww === "firenewsfeed.com") {
            return src.replace(/\/image\/[0-9]+x[0-9]+\//, "/image/");
        }

        if (domain === "cached.imagescaler.hbpl.co.uk") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/resize\/[^/]*\/[0-9]+\/([^/]*\.[^/]*\/)/, "http://$1");
        }

        if (domain === "i.tuenlinea.com") {
            return src.replace(/(\/[^/]*(\.[^/.]*))\.img[wh]\.[0-9]+\.[0-9]+\.[^/.]*$/, "$1.imgo$2");
        }

        if (domain === "cdn-photos.extratv.com") {
            return src.replace(/_thumb(\.[^/.]*)$/, "_full$1");
        }

        if (domain === "media.extratv.com") {
            return src.replace(/-(?:[0-9]+x[0-9]+|[0-9]+[wh])(?:-[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "i.wpimg.pl") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/(?:[A-Z]\/)?[0-9]+x[0-9]+\//, "http://");
        }

        if (domain === "static.keptelenseg.hu") {
            return src.replace(/\/thumbs\/thumb\/p\//, "/p/");
        }

        if (domain_nosub === "wdfiles.com") {
            return src.replace(/\/local--resized-images\/(.*\.[^/.]*)\/[a-z]+\.[^/.]*$/, "/local--files/$1");
        }

        if (domain_nowww === "astrofactor.com") {
            return src.replace(/(\/imgs\/[^/]*\/)[0-9]+(\/[^/]*)$/, "$1full$2");
        }

        if (domain === "makeup.nuovogennarino.org") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/static\/[0-9]+\/img\/([^/.]+\.[^/]+)/, "http://$1");
        }

        if (domain === "img.newsdog.today" ||
            amazon_container === "img.newsdog.today") {
            return src.replace(/(img\.newsdog\.today\/)[a-z_]+_([a-f0-9]+)$/, "$1origin_$2");
        }

        if (domain === "d1qikntta4cp8k.cloudfront.net") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?[?&]url=([^&]*)$/, "$1"));
        }

        if (domain_nosub === "img.com.ua") {
            newsrc = src.replace(/\/[0-9]+x[0-9]+(\/[0-9a-f]\/[0-9a-f]{2}\/[0-9a-f]+\.[^/.]*)$/, "/orig$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "rs.img.com.ua") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/crop.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src) {
                return urljoin(src, decodeURIComponent(newsrc));
            }
        }

        if (domain === "img-hw.xvideos.com") {
            return src.replace(/(\/pic_[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_big$2");
        }

        if (domain === "camo.derpicdn.net") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/[0-9a-f]+\?url=([^&]*).*?$/, "$1"));
        }

        if (domain === "live.store.cmcm.com") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\/(liveme\/)/, "$1$2");
        }

        if (domain === "media.timeout.com") {
            return src.replace(/(\/images\/[0-9]+\/)[0-9]+\/[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "tokkoro.com") {
            return src.replace(/\/thumbs\//, "/picsup/");
        }

        if (domain === "www.wallpapermaiden.com") {
            newsrc = src.replace(/(\/image\/[0-9]+\/[0-9]+\/[0-9]+\/[^/]*)-resized(\.[^/.]*)$/, "$1$2");
            if (newsrc !== src)
                return newsrc;

            id = src.replace(/(\/wallpaper\/[0-9]+\/)download\/[0-9]+x[0-9]+\/([^/]*)\.[^/.]*(?:[?#].*)?$/,
                             "$1$2");
            if (id !== src &&
                options && options.cb && options.do_request) {
                options.do_request({
                    url: id,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<meta *property="og:image" *content="([^"]*)"/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });
            }
        }

        if (domain === "2ch.hk" ||
            domain_nowww == "shisharc.com") {
            return add_extensions(src.replace(/\/thumb\/([0-9]+\/[0-9]+)s(\.[^/.]*)$/, "/src/$1$2"));
        }

        if (domain === "s.heavenlynudes.net" ||
            domain === "s.nufap.com" ||
            domain === "s.papajizz.com") {
            return src.replace(/\/thumbs\/([0-9a-f]+\.[^/.]*)$/, "/$1");
        }

        if (domain_nosub === "bbend.net" &&
            domain.match(/cdn[0-9]*\.bbend\.net/)) {
            return src.replace(/\/photos\/thumb\/([^/]*)$/, "/photos/full/$1");
        }

        if (domain === "static.fustany.com") {
            return {
                url: src.replace(/\/photo\/[a-z]+_([^/]*)$/, "/photo/$1"),
                headers: {
                    Referer: "http://fustany.com/en/fashion/celebrity-style/front-row-celebrities-at-new-york-fashion-week-spring-2015"
                }
            };
        }

        if (domain_nosub === "protv.md" &&
            domain.match(/^assets[0-9]*\.protv/)) {
            return src.replace(/:\/\/[^/]*\/articles\/files\/thumbs\/[0-9]+x(?:[0-9]+)?(\/[0-9]+\.[^/.]*)$/,
                               "://retete.perfecte.md/assets/articles/images/original$1");
        }

        if (domain_nowww === "bgol.us" ||
            domain_nowww === "defenceforumindia.com") {
            return decodeURIComponent(src.replace(/.*?\/forum\/proxy\.php.*?[?&]image=([^&]*).*?$/, "$1"));
        }

        if (domain === "resources.tidal.com") {
            return src.replace(/\/[0-9]+x[0-9]+(\.[^/.]*)$/, "/origin$1");
        }

        if (domain === "i.kfs.io") {
            return src.replace(/\/fit\/[0-9]+x[0-9]+(\.[^/.]*)$/, "/original$1");
        }

        if (domain_nosub === "fuskator.com") {
            return {
                url: src
                    .replace(/(:\/\/[^/]*\/)small\//, "$1large/"),
                can_head: false
            };
        }

        if (domain === "ssref.net") {
            return decodeURIComponent(src.replace(/.*?\/image_resize\.cgi.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if ((domain_nosub === "m1905.cn" && domain.match(/image[0-9]*\.m1905\.cn/)) ||
            domain_nowww === "ozanyerli.com" ||
            domain_nowww === "entline.cn" ||
            domain_nowww === "69876.com") {
            newsrc = src.replace(/\/(?:thumb_[0-9]+_[0-9]+_(?:[0-9]+_)?)?([0-9]+)(?:_watermark)?(\.[^/.]*)$/, "/$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "intermedia.ge"/* &&
            domain.match(/server[0-9]*\.intermedia\.ge/)*/) {
            return src
                .replace(/(\/article_images[0-9]*\/)[a-z]+\//, "$1large/")
                .replace(/\/pictures\/[a-z]+\//, "/pictures/original/");
        }

        if (domain === "www.sqshi.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/img\.php.*?[?&]imgurl=([^&]*).*?$/, "$1"));
        }

        if (domain === "i.annihil.us") {
            return src.replace(/(\/[0-9a-f]+\/)detail(\.[^/.]*)$/, "$1clean$2");
        }

        if (domain === "pimg.mycdn.me" ||
            (domain_nosub === "sywcdn.net" && domain.match(/^s[0-9]*\./))) {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/getImage.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "www.dissidia-france.com") {
            return src.replace(/\/small\/([^/]*)$/, "/big/$1");
        }

        if (domain === "cdn.asiatatler.com" ||
            domain_nowww === "indonesiatatler.com") {
            return src.replace(/_(?:cropped|resized)_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "stylowi.pl" &&
            domain.match(/^img[0-9]*\.stylowi\.pl/)) {
            return src.replace(/\/images\/items\/[a-z]\//, "/images/items/o/");
        }

        if (domain === "files.dals.media") {
            return src.replace(/__[a-z]+__(\.[^/.]*)$/, "__original__$1");
        }

        if (domain === "media.linkonlineworld.com") {
            return src.replace(/\/img\/large\//, "/img/original/");
        }

        if (amazon_container === "marieclairebucket") {
            return src.replace(/000[0-9]+?x[0-9]+(\.[^/.]*)$/, "000$1");
        }

        if (domain_nosub === "nh.ee" ||
            domain_nosub === "dcdn.lt") {
            return src.replace(/\/images\/pix\/[0-9]+x[0-9]+\//, "/images/pix/");
        }

        if (domain === "read.html5.qq.com" ||
            domain === "cdn.read.html5.qq.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/image.*?[?&]imageUrl=([^&]*).*?$/, "$1"));
        }

        if (domain === "img.chuansong.me" ||
            domain === "img.weiduba.net" ||
            (domain_nosub === "jinciwei.cn" && domain.match(/img[0-9]*\./))) {
            return src.replace(/:\/\/[^/]*\/(mmbiz(?:_[a-z]+)?)\//, "://mmbiz.qpic.cn/$1/");
        }

        if (domain === "cdn.iguang.co") {
            return src.replace(/:\/\/[^/]*\/[0-9a-f]+\/(mmbiz(?:_[a-z]+)?)\//, "://mmbiz.qpic.cn/$1/");
        }

        if (domain === "pic.kuaizhan.com") {
            return src.replace(/\/imageView\/v[0-9]*\/.*/, "");
        }

        if ((domain_nosub === "popcornnews.ru" && domain.match(/v[0-9]*\.popcornnews\.ru/)) ||
            domain === "static.kinoafisha.info") {
            return src
                .replace(/(:\/\/[^/]*\/)[a-z]+\/[a-z]+\/[0-9]+(?:x[0-9]+)?\/upload\//, "$1upload/")
                .replace(/(:\/\/[^/]*\/upload\/+)_[0-9]+_[0-9]+_[0-9]+_([^/_.]*\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "amorq.com" ||
            domain_nowww === "prikolno.cc" ||
            domain_nowww === "interesno.cc" ||
            domain_nowww === "obaldenno.com") {
            return src.replace(/\/uploads\/tumb(\/[a-z]+\/[0-9]+\/[^/.]+)_tumb_[0-9]+(\.[^/.]*)$/, "/uploads$1$2");
        }

        if (domain_nosub === "pinme.ru" &&
            domain.match(/^cdn/)) {
            return src.replace(/\/+tumb\/+[0-9]+\/+photo\//, "/photo/");
        }

        if (domain_nosub === "postila.ru" &&
            domain.match(/^img[0-9]*\.postila\.ru/)) {
            return urljoin(src, decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/resize.*?[?&]src=([^&]*).*?$/, "$1")), true);
        }

        if (domain_nowww === "enolivier.com" ||
            domain_nowww === "fotoventasdigital.com") {
            return src.replace(/\/_thumb\/([^/]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/_fullsize/$1$2");
        }

        if (domain === "ss.metronews.ru" ||
            domain === "ss.sport-express.ru") {
            return src.replace(/(\/userfiles\/materials\/[0-9]+\/[0-9]+\/)(?:[0-9]+x[0-9]+|[a-z]+)(\.[^/.]*)$/, "$1origin$2");
        }

        if (domain_nosub === "mtvnimages.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/uri\/mgid:file:(https?):shared:([^/:]*\/)/, "$1://$2");
        }

        if (domain_nowww === "vh1.com") {
            return {
                url: src,
                can_head: false
            };
        }

        if (domain === "user-uploads.aznude.com") {
            return src.replace(/(:\/\/[^/]*\/data\/)thumbs\//, "$1azncdn/");
        }

        if (domain_nowww === "bstars.eu") {
            return src.replace(/(\/media\/djcatalog2\/.*\.[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "media.toofab.com" ||
            domain === "toofab.akamaized.net") { // doesn't work for all urls
            src = src.replace(/-[0-9]+w\.([^/.]*)/, ".$1");

            src = src.replace(/-[0-9]+x[0-9]+\.([^/.]*)/, ".$1");

            return src;
        }

        if (domain === "thumb.tvpalace.org") {
            return src.replace(/\/[wh][0-9]+_([^/]*\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "mafab.hu") {
            return src.replace(/\/static\/thumb\/[wh][0-9]+\//, "/static/");
        }

        if (domain === "film.kinootziv.com" ||
            (domain_nosub === "moviesfan.org" && domain.match(/^static/)) ||
            domain_nowww === "kinokach.com") {
            return src.replace(/(:\/\/[^/]*\/source\/files\/[^/]*)_thumbs\//, "$1/");
        }

        if (amazon_container === "harmony-assets-live") {
            return {
                src: url,
                can_head: false
            };
        }

        if (domain === "cdn.kme.si") {
            return src.replace(/\/public\/images-cache\/[0-9X]+x[0-9X]+\/([0-9]+\/[0-9]+\/[0-9]+\/)[0-9a-f]+\/[0-9a-f]+\/([0-9a-f]+\.[^/.]*)$/,
                               "/public/images/$1$2");
        }

        if (domain_nosub === "slidely.com" &&
            domain.match(/cdn\.slidely\.com$/)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/img-proxy\//, "http://");
        }

        if (domain_nosub === "hochu.ua") {
            return src.replace(/\/thumbnails\/articles\/crop[a-z]*_[0-9]+x[0-9]+\//, "/images/articles/");
        }

        if (domain === "media.professionali.ru") {
            return src.replace(/(\/processor\/[a-z]+\/)[^/]*\//, "$1original/");
        }

        if (domain_nowww === "stars-naked.ru") {
            return src.replace(/(:\/\/[^/]*\/pictures\/[^/]*\/)[^/]*\/[a-z]+_([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "avsforum.com" ||
            domain_nowww === "sitcomsonline.com") {
            return src.replace(/(\/photopost\/data\/[0-9]+\/)(?:thumbs|medium)\//, "$1");
        }

        if (domain_nowww === "pgmscreen.fr") {
            newsrc = decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/(?:protect|watermark)\.php.*?[?&]src=([^&]*).*?$/, "$1"));
            if (newsrc !== src)
                return newsrc;
            return src.replace(/\/galerie\/[a-z]+\/[a-z]+-/, "/galerie/grande/max-");
        }

        if (domain === "celeb.gate.cc") {
            return src.replace(/(:\/\/[^/]*\/media\/cache\/)[a-z]+\/upload\//, "$1original/upload/");
        }

        if (domain_nowww === "modagid.ru") {
            return src.replace(/(\/files\/photos\/imgs\/[0-9]+\/[0-9]+\/)[a-z]+_/, "$1original_");
        }

        if (domain_nowww === "zdf.de" &&
            src.indexOf("/assets/") >= 0) {
            return src.replace(/~[0-9]+x[0-9]+([?#].*)?$/, "~original$1");
        }

        if (domain_nowww === "arcinfo.ch" ||
            domain_nowww === "lacote.ch") {
            return src.replace(/(\/media\/image\/[0-9]*\/)[^/]*\/([0-9]+-[0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "gulf365.co" ||
            domain_nowww === "mogaznews.com" ||
            domain_nowww === "alsharqtimes.com") {
            return src
                .replace(/(:\/\/[^/]*\/)temp\/(?:thumb|resized)\/[^-/_.]+_uploads,([0-9]+),([0-9]+),([0-9]+),([0-9a-f]+\.[^/.]*)$/,
                         "$1content/uploads/$2/$3/$4/$5")
                .replace(/(:\/\/[^/]*\/)temp\/(?:thumb|resized)\/[a-z]+_([0-9]+)-([0-9]+)-([0-9]+)-([0-9a-f]+\.[^/.]*)$/,
                         "$1content/uploads/$2/$3/$4/$5");
        }

        if (domain_nowww === "aljazeera.com") {
            return src.replace(/\/mritems\/imagecache\/[^/]*\/mritems\//, "/mritems/");
        }

        if (domain === "media.publika.md") {
            return src.replace(/\/[wh][0-9]+\/([^/]+_[0-9]+\.[^/.]*)$/, "/full/$1");
        }

        if (domain === "www1.wdr.de") {
            return src.replace(/~_v-[a-z0-9]+(\.[^/.]*)$/, "~_v-original$1");
        }

        if (domain_nowww === "xrimaonline.gr") {
            return src.replace(/\/photos\/[a-z]_[0-9]+px[^/]*\/articles\//, "/photos/w_999999999999px/articles/");
        }

        if (domain_nosub === "avisen.dk" &&
            domain.match(/^media[0-9]*\.avisen\.dk/)) {
            return src.replace(/([?&]sizeid=)[0-9]+/, "$1255");
        }

        if (domain_nowww === "elimparcial.es" &&
            src.indexOf("/fotos/") >= 0) {
            return src.replace(/_thumb_[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nosub === "agora.md" &&
            domain.match(/^st[0-9]*\.agora\.md/)) {
            return src.replace(/(:\/\/[^/]*\/news\/)[a-z]+\//, "$1big/");
        }

        if (domain_nowww === "demokrathaber.org") {
            return src.replace(/\/images\/resize\/[0-9]+\/[0-9]+x[0-9]+\//, "/images/");
        }

        if (domain === "imgl.krone.at") {
            return src.replace(/(\/scaled\/[0-9]+\/[0-9a-z]+\/)[0-9]+x[0-9]+([?#].*)?$/, "$1full$2");
        }

        if (domain_nowww === "elfinanciero.com.mx" &&
            src.indexOf("/uploads/") >= 0) {
            return src.replace(/(\/[0-9a-f]+)_[a-z_]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "redcdn.pl" &&
            domain.indexOf("dcs.redcdn.pl") >= 0) {
            return src.replace(/(:\/\/[^/]*\/)scale(\/.*?)(?:[?#].*)?$/, "$1dcs/$2");
        }

        if (domain === "media.nu.nl") {
            return src.replace(/(:\/\/[^/]*\/[a-z]\/[0-9a-z]+)_[0-9a-z]+(\.[^/.]*)(?:\/[^/]*\.[^/.]*)?$/, "$1$2");
        }

        if (domain === "cloudia.hnonline.sk") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]?[0-9]+x[0-9]+[a-z]?\/([0-9a-f]+\.[^/.]*?)(?:\?.*)?$/, "$1$2");
        }

        if (googlestorage_container === "nana10img") {
            return src.replace(/\/crop\/(?:_[a-z]-[0-9]+){1,}\/images\//, "/images/");
        }

        if ((domain_nowww === "webnews.bg" ||
             domain === "static.dir.bg") &&
            src.indexOf("/uploads/images/") >= 0) {
            return src.replace(/\/[0-9]+x(?:[0-9]+)?(\.[^/.]*)$/, "/orig$1");
        }

        if (domain === "static.ffx.io") {
            return src.replace(/\/images\/\$[^/]*\/.*\/([0-9a-f]+)([?#].*)?$/, "/images/$1$2");
        }

        if (domain === "images.stv.tv") {
            return src.replace(/\/articles\/[wh][0-9]+(?:xh[0-9]+)?(?:xm[^/]*)?\/([^/]*)$/, "/articles/master/$1");
        }

        if (domain === "cdn.cretalive.gr") {
            return src.replace(/(:\/\/[^/]*\/)_[a-z]+Image\//, "$1");
        }

        if ((domain_nosub === "ellingtoncms.com" &&
             domain.match(/\.media\.clients\.ellingtoncms\.com$/)) ||
            domain === "media.spokesman.com") {
            return src.replace(/_t[0-9]*(?:x[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain === "ajo.prod.reuters.tv") {
            return src.replace(/(\/img\/[0-9a-f]+-[0-9]+).*?[?&](location=[^&]*).*?$/, "$1?$2");
        }

        if (domain_nowww === "nos.nl") {
            return src.replace(/(\/data\/image\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9]+\/)[a-z]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain_nowww === "braunschweiger-zeitung.de" ||
            domain === "img.derwesten.de" ||
            domain_nowww === "thueringen24.de" ||
            domain_nowww === "helmstedter-nachrichten.de") {
            return src.replace(/\/img\/(?:panorama|welt)\/crop([0-9]+)\/.*(\.[^/.]*)$/, "/bin/src-$1$2");
        }

        if (domain === "iprx.ten.com.au") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/ImageHandler\.ashx.*?[?&]u=([^&]*).*?$/, "$1"));
        }

        if (domain === "images.sudouest.fr") {
            return src.replace(/(\/[0-9a-f]+\/)[a-z]+\/[0-9]+x[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain === "gdb.rferl.org" ||
            domain === "gdb.voanews.com" ||
            domain === "gdb.radiosawa.us") {
            return src.replace(/(:\/\/[^/]*\/[-0-9A-F]+)(?:_c?[a-z][0-9]*){1,}(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.nzz.ch") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/(?:[A-Z]=[^/]+\/){1,}(https?:\/\/)/, "$1");
        }

        if (domain === "images-cdn.impresa.pt") {
            return src
                .replace(/\/(?:[0-9]+x[0-9]+|original)\/m[wh]-[0-9]+(?:\?.*)?$/, "/original")
                .replace(/\?.*/, "");
        }

        if (domain === "awsimages.detik.net.id") {
            if (src.match(/\/customthumb\//)) {
                return src.replace(/\?.*/, "");
            }
            return src.replace(/\?.*/, "?a=1");
        }

        if (domain_nowww === "sexhd.pics" ||
            domain_nowww === "sexphotos.pw" ||
            domain_nosub === "yespornpics.com" ||
            domain_nowww === "babe.today" ||
            domain_nowww === "xxxporn.pics" ||
            domain_nosub === "jjgirls.com") {
            newsrc = src
                .replace(/(:\/\/[^/]*\/)photo(\/.*\/)hd-([^/]*)$/, "$1gallery$2$3")
                .replace(/(:\/\/[^/]*\/)image(\/.*\/)hd-([^/]*)$/, "$1xxx$2$3")
                .replace(/(:\/\/[^/]*\/)thumbs(\/.*\/)hd-([^/]*)$/, "$1pictures$2$3")
                .replace(/(:\/\/[^/]*\/)thumb(\/.*\/)hd-([^/]*)$/, "$1media$2$3")
                .replace(/(:\/\/[^/]*\/)pic(\/.*\/)hd-([^/]*)$/, "$1pics$2$3");

            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "pics.tubetubetube.com") {
            return src.replace(/(:\/\/[^/]*\/)thumbs(\/.*\/)hd-([^/]*)$/, "$1pornpics$2$3")
        }

        if (domain_nowww === "javhd.pics" ||
            domain_nowww === "javpornpics.com") {
            return src.replace(/(:\/\/[^/]*\/)media(\/.*\/)(?:u?hd|pin)-([^/]*)$/, "$1photos$2$3");
        }

        if (domain_nowww === "javpics.com") {
            return src.replace(/(:\/\/[^/]*\/)xxx(\/.*\/)(?:u?hd|pin)-([^/]*)$/, "$1images$2$3");
        }

        if (domain_nowww === "purejapanese.com" ||
            domain_nowww === "jjgirls.com" ||
            domain_nowww === "1pondo.com" ||
            domain_nowww === "asiauncensored.com" ||
            domain_nowww === "69dv.com" ||
            domain_nowww === "javtube.com") {
            newsrc = src.replace(/(:\/\/[^/]*\/)(pic|tokyopic|uncensored|javmodel|japansex|heydouga|japanese(?:girl)?)(\/.*\/)cute-([^/]*)$/, "$1$2$3$4");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "jjgirls.com") {
            return src
                .replace(/(\/photo\/+[^/]*\/+[^/]*\/+[^/]*\/+[0-9]+)t(\.[^/.]*)(?:[?#].*)?$/, "$1$2")
                .replace(/(\/photo\/+[^/]*\/+[^/]*\/+[^/]*\/+[^/]*)_small(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "javbtc.com") {
            return src.replace(/(:\/\/[^/]*\/)media(\/.*\/)hd-([^/]*)$/, "$1photos$2$3");
        }

        if (domain_nowww === "japanesebeauties.net") {
            return src.replace(/\/media\/+(.*\/)hd-([^/]*)(?:[?#].*)?$/, "/$1$2");
        }

        if (domain_nowww === "tubetubetube.com") {
            return src.replace(/(:\/\/[^/]*\/)media(\/.*\/)(?:u?hd|pin)-([^/]*)$/, "$1pics$2$3");
        }

        if (domain_nowww === "nuceleb.ru") {
            return src.replace(/(\/assets\/images\/resources\/[0-9]+\/)[0-9]+x[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain_nosub === "imgserve.net") {
            return {
                url: src.replace(/(:\/\/[^/]*\/)images\/[a-z]+\//, "$1images/big/"),
                headers: {
                    Referer: src
                }
            };
        }

        if (domain === "image.celebrityrave.com") {
            return src.replace(/(\/[0-9a-f]*)-[0-9a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "vjav.com") {
            newsrc = src.replace(/\/get_image\/[0-9a-f]\/[0-9a-f]+\/main\/(.*?)\/+(?:[?#].*)?$/, "/contents/albums/main/$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "photo.addyoursex.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/remote_control\.php.*?[?&]file=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return urljoin(src, decodeURIComponent(newsrc));
        }

        if (domain_nowww === "zceleb.com" ||
            domain === "cdn.faponix.com" ||
            (domain_nosub === "fapality.com" && domain.match(/^i[0-9]*\.fapality\.com/)) ||
            domain === "alb-xb.hellcdn.net" ||
            domain_nowww === "vjav.com" ||
            domain === "i.tubsexer.com" ||
            domain === "i.pornsexer.com" ||
            domain_nowww === "pervertedmilfs.com" ||
            domain === "cdn.pornstill.com") {
            return {
                url: src.replace(/\/main\/+[0-9]+x[0-9]+\/+/, "/sources/"),
                headers: {
                    Origin: "http://" + domain_nosub,
                    Referer: "http://" + domain_nosub + "/"
                }
            };
        }

        if (domain_nowww === "celebcafe.net") {
            return src.replace(/\/blog\/thumbs\//, "/blog/pics/");
        }

        if (domain === "image.jeuxvideo.com") {
            return {
                url: src.replace(/(:\/\/[^/]*\/medias)-[a-z]+(\/[0-9]+\/)/, "$1$2"),
                can_head: false
            };
        }

        if (domain === "images.pushsquare.com") {
            return src
                .replace(/(\/screenshots\/[0-9]+\/)(?:[0-9]+x(?:[0-9]+)?|[a-z]+)(\.[^/.]*)$/, "$1original$2")
                .replace(/(\/news\/[0-9]+\/[0-9]+\/[^/]+\/)(?:[0-9]+x(?:[0-9]+)?|[a-z]+)(\.[^/.]*)$/, "$1original$2")
                .replace(/(\/games\/.*\/cover)(?:_[a-z]+)?(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain_nowww === "pcgames.de") {
            return src.replace(/\/screenshots\/[0-9]+x[0-9]+\//, "/screenshots/original/");
        }

        if (domain_nowww === "collinsdictionary.com") {
            return src.replace(/\/images\/thumb\/([^/]*)_[0-9]+(\.[^/.]*)(\?.*)?$/, "/images/full/$1$2$3");
        }

        if (domain_nowww === "abc.net.au") {
            return src
                .replace(/(\/pluck-cache\/images\/[-0-9a-f]+\.)[A-Z][a-z]+(\.[^/.]*)$/, "$1Full$2")
                .replace(/(\/cm\/rimage\/[0-9]+-[0-9]+x[0-9]+-)[a-z]+(\.[^/.]*)$/, "$1large$2");
        }

        if (domain_nowww === "1x.com") {
            return src
                .replace(/(:\/\/[^/]*\/)img\/[^/]*?[?&]id=([0-9a-f]+).*$/, "$1images/user/$2-hd4.jpg")
                .replace(/(\/images\/user\/[0-9a-f]+)-[a-z]+(?:[0-9]+)?(\.[^/.]*)$/, "$1-hd4$2");
        }

        if (domain === "fotografroku.ifotovideo.cz") {
            return src.replace(/(:\/\/[^/]*\/image\.php).*?[?&]id=([0-9]+).*?$/, "$1?id=$2&size=2");
        }

        if (domain === "img.kutikomiya.jp") {
            return src.replace(/\/thumbnail(\/[^/]*\/)W[0-9]+(?:xH[0-9]+)?\//, "/album$1");
        }

        if (domain === "attach.setn.com") {
            return src.replace(/(\/newsimages\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9]+)-[A-Z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "heyzo.com") {
            return src.replace(/\/gallery\/thumbnail_([0-9]+\.[^/.]*)$/, "/gallery/$1");
        }

        if (domain === "img.picabcd.com") {
            return src.replace(/\/thumbnail\/images\//, "/images/");
        }

        if (domain === "mozishop.cdn.shoprenter.hu") {
            return src.replace(/\/mozishop\/image\/cache\/(?:[a-z]{1,}[0-9]+){1,}\//, "/mozishop/image/data/");
        }

        if (domain === "terrigen-cdn-dev.marvel.com") {
            return src.replace(/(\/content\/[a-z]+\/)1x\//, "$12x/");
        }

        if (domain_nowww === "czmodels.cz" ||
            domain_nowww === "phmodels.cz") {
            return src.replace(/(\/image\/itemid-([0-9]+)\/).*/, "$1q-100/$2.jpg");
        }

        if (domain_nosub === "amazonaws.com" &&
            domain.match(/^[a-z0-9]+\.execute-api\./)) {
            return src.replace(/(:\/\/[^/]*\/image\/)fit-in\/[0-9]+x[0-9]+\//, "$1");
        }

        if (domain === "cdn.pudra.com") {
            return src.replace(/(:\/\/[^/]*\/[0-9]+\/)fit[a-z]?[0-9]+x[0-9]+\//, "$1");
        }

        if (domain === "arhiva.dalje.com") {
            return src.replace(/(\/slike_[0-9]*\/)r[0-9]*(\/g[0-9]+\/)/, "$1r1$2");
        }

        if (domain === "media.super.cz") {
            return src.replace(/(:\/\/[^/]*\/images\/+)[^/]+\/(.*?)(?:[?#].*)?$/, "$1original/$2");
        }

        if (domain_nowww === "d1g.com") {
            return src.replace(/(\/photos\/[0-9]+\/[0-9]+\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_max$2");
        }

        if (domain_nowww === "e-shuushuu.net") {
            return add_extensions_jpeg(src.replace(/(:\/\/[^/]*\/images\/)thumbs\//, "$1"));
        }

        if (domain === "cdn.anime-pictures.net" ||
            domain_nosub === "anime-pictures.net") {
            return src.replace(/(\/[0-9a-f]+)_[a-z]+(\.[^/.]*)(?:\.webp)?(\?.*)?$/, "$1$2$3");
        }

        if (domain === "images.treccani.it") {
            return src.replace(/\/enc\/media\/share\/images\/[a-z]+\/system\//, "/enc/media/share/images/orig/system/");
        }

        if (domain === "image-store.slidesharecdn.com") {
            return src.replace(/(:\/\/[^/]*\/[-0-9a-f]+)-large(\.[^/.]*)$/, "$1-original$2");
        }

        if (domain_nosub === "stgy.ovh" &&
            domain.match(/citynews-riminitoday\.stgy\.ovh/)) {
            return src.replace(/\/~media\/[-a-z]+(\/[0-9]+\/)/, "/~media/$1");
        }

        if (domain === "media.raccweb.com") {
            return src.replace(/(:\/\/[^/]*\/)__sized__\/(.*)-thumbnail-[0-9]+x[0-9]+-[0-9]+(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain_nowww === "mormonnewsroom.org") {
            return src.replace(/\/media\/[0-9]+x[0-9]+\//, "/media/original/");
        }

        if (domain === "contents.mediadecathlon.com") {
            return src.replace(/(\/p[0-9]+\/)(?:[0-9]+x[0-9]+\/)?(?:[a-z]+\/)?([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "overcast.fm") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/art.*?[?&]u=([^&]*).*?$/, "$1"));
        }

        if (domain === "spottappeu01prd.blob.core.windows.net") {
            return src.replace(/(\/[0-9a-f]+\/)[0-9]+(?:_[0-9]+)(\.[^/.]*)$/, "$10$2");
        }

        if (domain === "medias.spotern.com") {
            return src.replace(/\/[wh][0-9]+\/([0-9]+(?:_[0-9a-f]+)?(?:-[0-9]+)?\.[^/.]*)$/, "/original/$1");
        }

        if (domain_nosub === "ounousa.com") {
            return src.replace(/\/Content\/ResizedImages\/[0-9]+\/[0-9]+\/[a-z]+(\/[0-9]+\.[^/.]*)$/, "/content/uploads/Article$1");
        }

        if (domain_nowww === "divahair.ro") {
            return src.replace(/(\/articole_imagini\/[^/]*\/[0-9]+\.[0-9]+\.[0-9]+\/)[0-9]+x[0-9]+\/([^/]*)_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain_nowww === "wall.hr") {
            return src.replace(/\/cdn\/uploads\/[0-9]+x\//, "/cdn/uploads/");
        }

        if (domain_nosub === "tialoto.bg") {
            return src.replace(/(\/media\/tialoto\/files\/[a-z]+\/)[0-9]+x[0-9]+(?:[a-z]+)?(\/[0-9a-f]+\.[^/.]*)$/, "$1orig$2");
        }

        if (domain === "bizweb.dktcdn.net") {
            return src.replace(/(:\/\/[^/]*\/)thumb\/[a-z]+\//, "$1");
        }

        if (domain_nowww === "socialbliss.com") {
            return src.replace(/\/img\/[0-9]+x[0-9]+\/assets\//, "/assets/");
        }

        if (domain_nowww === "forumfr.com") {
            return "http://" + src.replace(/.*\/applications\/core\/interface\/imageproxy\/ximageproxy\.php.*?,qimg=,h(.*?)(?:,[^_].*)?$/, "$1").replace(/,_/g, "/");
        }

        if (domain_nowww === "pinkomatic.com") {
            return src.replace(/(\/images\/[0-9]+\/)[a-z]+\//, "$1full/");
        }

        if (domain_nowww === "khmeread.com") {
            return src.replace(/(\/images\/[0-9]+\/)[a-z]+\//, "$1original/");
        }

        if (domain === "cfshopeetw-a.akamaihd.net" ||
            domain === "cf.shopee.tw" ||
            domain === "cf.shopee.vn") {
            return src.replace(/(\/file\/[0-9a-f]+)_tn(?:\?.*)?$/, "$1");
        }

        if (domain_nowww === "theredlist.com") {
            return src.replace(/\/media\/\.cache\/database\/(.*\/)[0-9]+-([^/]*)$/, "/media/database/$1$2");
        }

        if ((domain_nosub === "hentai-cosplay.com" ||
             domain_nosub === "hentai-image.com" ||
             domain_nosub === "porn-image-xxx.com" ||
             domain_nosub === "porn-movie-xxx.com" ||
             domain_nosub === "aniimg.com") &&
            domain.match(/^static[0-9]*\./) &&
            src.indexOf("/upload/") >= 0) {
            newsrc = src
                .replace(/^[a-z]+:\/\/[^/]*\/upload\/cache\/thumbnail\/create\.php.*?[?&]image=([^&]*).*?$/, "$1");
            if (newsrc !== src) {
                return newsrc;
            }

            return src
                .replace(/(\/+[0-9]+\/+)(?:[a-z]+=[^/]*\/+){1,}([0-9]+\.[^/.]*)$/, "$1$2")
                .replace(/(\/+[0-9A-Z]+\/+)(?:[a-z]+=[^/]*\/+){1,}([0-9A-Z]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "d1in1v57myx5v.cloudfront.net") {
            return src.replace(/\/pics\/Thumbnails\//, "/pics/Images/");
        }

        if (domain_nowww === "artistic-nude-images.com") {
            return src.replace(/\/thumbnail\/tn-([^/]*)$/, "/$1");
        }

        if (domain_nowww === "babefilter.net") {
            return {
                url: src.replace(/(\/i\/[0-9a-f]+\/[0-9a-f]+)_tn(\.[^/.]*)$/, "$1$2"),
                headers: {
                    Referer: src
                }
            };
        }

        if ((domain_nosub === "dagospia.com" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "sutki.net" && src.indexOf("/img/") >= 0) ||
            (domain_nowww === "screensonic.net" && src.indexOf("/images/") >= 0)) {
            return src.replace(/_tn(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "redcarpetnudes.com") {
            return src.replace(/-tn(\.[^/.]*)$/, "$1");
        }

        if (domain === "pat.primecdn.net") {
            return src.replace(/\/pics\/[a-z]+(\/[0-9a-f]+\/[0-9a-f]+\.[^/.]*)$/, "/pics/original$1");
        }

        if (domain_nosub === "imagearn.com") {
            return src.replace(/(:\/\/[^/]*\/)([0-9]+\/[0-9]+\.[^/.]*)$/, "$1imags/$2");
        }

        if (domain === "img.static-smb.be" ||
            domain === "img.static-rmg.be") {
            return src.replace(/\/view\/q[0-9]*\/w[0-9]*\/h[0-9]*\//, "/view/q100/w/h/");
        }

        if (domain_nosub === "buro247.mn" ||
            domain_nosub === "buro247.sg" ||
            domain_nosub === "buro247.kz" ||
            domain_nosub === "buro247.mx" ||
            domain_nosub === "buro247.com.au" ||
            domain_nosub === "buro247.ru") {
            return src
                .replace(/(\/thumb\/[^/]*\/)galleries\//, "$1local/images/buro/galleries/")
                .replace(/\/thumb\/[0-9]+x[0-9]+(?:_0)?((?:\/local)?\/(?:images|thumb)\/)/, "$1");
        }

        if (domain === "images.vogue.it") {
            return src.replace(/(\/gallery\/[0-9]+\/)[A-Za-z]+(\/[-0-9a-f]+\.[^/.]*)$/, "$1Original$2");
        }

        if (domain === "blogs.glamour.de") {
            return src.replace(/\/thumbs\/[^/]*\//, "/files/");
        }

        if (domain === "img.beatles.ru") {
            return src.replace(/(\/[0-9]+)(\/[0-9]+\.[^/.]*)$/, "$1b$2");
        }

        if (domain_nowww === "boutique.az") {
            return src.replace(/(\/images\/[0-9]+)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "izum.ua") {
            return src.replace(/(_[0-9]+)_sml[0-9]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "senatus.net" &&
            domain.match(/^cache[0-9]*\./)) {
            return src.replace(/\/files\/albums\/resized(?:[0-9]+x)?\//, "/files/albums/");
        }

        if (domain_nowww === "max-pix.com" ||
            domain_nowww === "kollywoodzone.com" ||
            domain_nowww === "celebwallpaper.org" ||
            domain_nosub === "moregirls.org") {
            return src.replace(/\/data\/thumbnails(\/[0-9]+\/)/, "/data/media$1");
        }

        if (domain_nowww === "tapeteos.pl") {
            return src
                .replace(/\/data\/thumbnails(\/[0-9]+\/)/, "/data/media$1big/")
                .replace(/(\/data\/media\/[0-9]+\/)([^/]*)$/, "$1big/$2")
                .replace(/__resized_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "media.8ch.net") {
            return src.replace(/\/file_store\/thumb\//, "/file_store/");
        }

        if (domain_nowww === "elles-se-mettent-nues-pour-nous.fr") {
            return src.replace(/(\/photos\/[^/]+\/)thumb\//, "$1");
        }

        if (domain_nosub === "fashionnetwork.com" &&
            domain.match(/^(?:[a-z]+\.)?media\./)) {
            return src.replace(/(\/[a-f0-9]+\/)[0-9]+x[0-9]+\.[0-9]+\/([a-f0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "media.filmz.ru") {
            return src.replace(/\/photos\/[a-z]+\/([^/_]*_)?[a-z](_[0-9]+\.[^/.]*)$/, "/photos/full/$1f$2");
        }

        if (domain_nowww === "kinofilms.ua") {
            return src.replace(/\/images\/photos\/[a-z0-9]+\/([0-9]+\.[^/.]*)$/, "/images/photos/hd/$1");
        }

        if (domain_nowww === "grandmagazine.gr") {
            return src.replace(/\/cache\/uploaded_images\/(.*)\/[0-9]+_[0-9]+_([^/]*)$/, "/uploaded_images/$1/$2");
        }

        if (domain === "a69.g.akamai.net") {
            return add_http(src.replace(/^[a-z]+:\/\/[^/]*\/[a-z]+\/[0-9]+\/[0-9]+\/v[0-9]+\//, ""));
        }

        if (domain === "cdn-media.rtl.fr") {
            return src.replace(/\/cache\/[-a-zA-Z0-9_]+\/[0-9]+v[0-9]+(?:-[0-9]+)?\/online\//, "/online/");
        }

        if (domain === "bcdn.newshunt.com" ||
            (domain_nosub === "dailyhunt.in" && domain.match(/bcdn[-.]/))) {
            return src.replace(/\/cmd\/[a-z]+\/[^/]*\/(fetchdata[0-9]*\/images\/)/, "/rx/$1");
        }

        if (domain === "media.search.lt") {
            return src.replace(/\/GetFile\.php.*?[?&](OID=[0-9]+).*?$/, "/GetFile.php?$1&filetype=4");
        }

        if (domain_nowww === "wallofcelebrities.com") {
            return {
                url: src.replace(/\/pictures\/[a-z]+\/([^/]*_[0-9]+\.[^/.]*)$/, "/pictures/original/$1"),
                headers: {
                    Referer: "https://www.wallofcelebrities.com/"
                }
            };
        }

        if (domain_nosub === "lmstube.com") {
            return src.replace(/\/[0-9]+x[0-9]+\/([^/]*)$/, "/$1");
        }

        if (domain === "assets.mubi.com") {
            return src.replace(/\/image-[a-z0-9]+(\.[^/.]*)$/, "/image-original$1");
        }

        if (domain_nowww === "fundir.org") {
            return src.replace(/(:\/\/[^/]*\/)th\//, "$1img/");
        }

        if (domain_nowww === "spletnik.ru") {
            return src.replace(/\/thumb\/[0-9]+x[0-9]+(?:_[0-9]+)?\/img\//, "/img/");
        }

        if (domain === "r.mtdata.ru") {
            return src.replace(/:\/\/[^/]*\/[a-z][-0-9]+x[-0-9]+\//, "://mtdata.ru/");
        }

        if (domain_nowww === "mtdata.ru" &&
            src.match(/:\/\/[^/]*\/u[0-9]+\/photo/)) {
            return src.replace(/\/(?:huge|big)(\.[^/.]*)$/, "/original$1");
        }

        if (domain === "img.uduba.com") {
            newsrc = src.replace(/:\/\/[^/]*\/mtdata\.ru\//, "://mtdata.ru/");
            if (newsrc !== src) {
                return newsrc.replace(/\/[a-z]+_[0-9]+x[0-9]+(\.[^/.]*)$/, "/original$1");
            }
        }

        if (domain_nowww === "russianpulse.ru") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/img\/([a-z]+:\/\/.*)$/, "$1");
        }

        if (domain === "img.noobzone.ru") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/getimg\.php.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "media.aintitcool.com") {
            return src.replace(/_(?:large|big|huge)(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww == "lichnosti.net") {
            return src.replace(/\/rs\/thumbs\/([0-9]+)\/set_([^/]*)_([a-z]+)_[0-9]+_[0-9]+_[0-9]+\.[^/.]*$/,
                               "/photos/$1/sets/$2.$3");
        }

        if (domain_nosub === "zmones.lt" &&
            domain.match(/^s[0-9]*\.zmones\.lt/)) {
            return src.replace(/(\/images\/photos\/[0-9]+\/[0-9]+\/[0-9]+\/)[a-z]+(\/[^/]*\.[^/.]*)$/, "$1original$2");
        }

        if (domain_nosub === "hsmedia.ru" ||
            domain_nosub === "elle.ru") {
            return src.replace(/(:\/\/[^/]*\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]+\/)[0-9]+x[0-9]+_[^/]*@([0-9]+x[0-9]+_[^/]*)$/, "$1$2");
        }

        if (domain_nowww === "starbeat.ru" &&
            src.indexOf("/gallery/") >= 0) {
            return src.replace(/\/(?:small|medium)\/([^/]*)$/, "/$1");
        }

        if ((domain === "image.kilimall.com" ||
             domain === "d2lpfujvrf17tu.cloudfront.net") &&
            src.indexOf("/shop/store/") >= 0) {
            return src.replace(/(\/[0-9]+_[0-9]+)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "zevenmart.com") {
            return src.replace(/\/resized\/([^/]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2");
        }

        if (domain_nowww === "superherotv.net" ||
            domain_nowww === "starsplanet.ru") {
            return src.replace(/\/photo\/images_small\//, "/photo/images_large/");
        }

        if (domain_nowww === "xxx-photo.com") {
            return src.replace(/\/photo\/t\/(.*?)(?:_t)?(\.[^/.]*)$/, "/photo/i/$1$2");
        }

        if (domain_nowww === "div.bg") {
            return src.replace(/(\/pictures\/[0-9]+)_[0-9]+_(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "cdn.hqsluts.com" ||
            domain_nowww === "hqbabes.com" ||
            domain === "c.xme.net") {
            return src.replace(/(:\/\/[^/]*\/(?:t\/)?[0-9]+)[a-z]([0-9]+(?:\.[^/.]*)?)$/, "$1c$2");
        }

        if ((domain_nowww === "sensualgirls.org" ||
             domain_nowww === "girlsofdesire.org") &&
            src.match(/\/media\/pictures(?:_new)?\//)) {
            return {
                url: src.replace(/(\/[^/.]*)_thumb(\.[^/.]*)$/, "$1$2"),
                headers: {
                    Origin: "https://" + domain,
                    Referer: "https://" + domain + "/"
                }
            };
        }

        if ((domain_nosub === "mainbabes.com" && domain.match(/^content[0-9]*\./)) ||
            (domain_nosub === "livejasminbabes.net" && domain.match(/^content[0-9]*\./)) ||
            (domain_nosub === "babesandgirls.com" && domain.match(/^content[0-9]*\./)) ||
            (domain_nosub === "exgirlfriendmarket.com" && domain.match(/^content[0-9a-z]*\./)) ||
            (domain_nosub === "rossoporn.com" && domain.match(/^content[0-9a-z]*\./)) ||
            (domain_nosub === "novostrong.com" && domain.match(/^content[0-9a-z]*\./)) ||
            (domain_nosub === "novoporn.com" && domain.match(/^content[0-9a-z]*\./)) ||
            (domain && domain.match(/^content[0-9a-z]*\./) && src.match(/^[a-z]+:\/\/[^/]*\/[^/.]*\.[^/.]*\/[0-9]{4,}\/(?:[^/]*_)?tn_[0-9]{2}\.[^/.]*(?:[?#].*)?$/)) ||
            (domain_nosub === "thousandbabes.com" && domain.match(/^content[0-9a-z]*\./)) ||
            (domain_nosub === "morazzia.com" && domain.match(/^content[0-9a-z]*\./)) ||
            domain_nosub === "pornodontstop.com") {
            newsrc = src.replace(/(\/(?:[^/]*_)?)tn_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "livejasminbabes.net" && domain.match(/^content[0-9]*\./)) {
            return src.replace(/\/upload\/main\/tn\//, "/upload/main/");
        }

        if ((domain_nowww === "captaingoodlink.com" && src.indexOf("/celebrities/") >= 0) ||
            (domain_nosub === "tacamateurs.com" && domain.match(/^cdn(?:-[^/]*)?\./) && src.match(/\/tn_pic[0-9]+\./))) {
            return src.replace(/\/tn_([^/]*\.[^/.]*)$/, "/$1");
        }

        if (domain_nosub === "pornodontstop.com" ||
            domain === "hosted.amourangels.com" ||
            domain_nowww === "hornyteen.pro" ||
            domain_nowww === "theasianpics.com" ||
            domain_nowww === "teengalleries.mobi") {
            return src.replace(/\/th_([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "i.girlstop.info" ||
            domain_nowww === "girlstop.info") {
            return src.replace(/\/thumbs\/[0-9]+px_([^/]*)$/, "/$1");
        }

        if (domain === "img.freeones.com") {
            return src.replace(/\/pinned_pictures\/pin\//, "/pinned_pictures/original/");
        }

        if (domain === "photos.freeones.com") {
            return src.replace(/(:\/\/[^/]*\/[^/]*_[^/]*\/+[^/]*\/+[^/]*\/+)([^/]*)(?:[?#].*)?$/, "$1images/$2");
        }

        if (domain_nowww === "starspics.ru" ||
            domain_nowww === "otherstars.ru") {
            return src.replace(/(:\/\/[^/]*\/)thumbs\//, "$1img/");
        }

        if (domain === "images.apina.biz") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\/[a-z]+_([0-9]+\.[^/.]*)$/, "$1full/$2");
        }

        if (domain_nowww === "pluska.sk") {
            return src.replace(/\/thumb\/images\//, "/images/");
        }

        if (domain_nowww === "mad-movies.com") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+-[0-9]+-[0-9]+-images\//, "$1images/");
        }

        if (domain === "assets.mycast.io") {
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain === "cdn.cinemur.fr") {
            return src.replace(/(?:\/cache\/[0-9]+x[0-9]+_|\/blur\/)([0-9]+\.[^/.]*)$/, "/original/$1");
        }

        if (domain_nowww === "farfarawaysite.com") {
            return src.replace(/\/hires\/t\//, "/hires/");
        }

        if (domain === "movieplayer.net-cdn.it" ||
            domain === "d17vsf20mehj1i.cloudfront.net" ||
            domain === "multiplayer.net-cdn.it") {
            return src.replace(/(?:\/(?:thumbs|t))?(\/+images\/.*?|:\/\/[^/]*\/[^/]*)_([a-z]+)_(?:[0-9]+x[0-9]+_)?(?:crop_)?(?:upscale_)?(?:q[0-9]+)?(\.[^/.]*)$/, "$1.$2");
        }

        if (domain === "u.livelib.ru") {
            return src
                .replace(/\/[a-z](\/[a-z0-9]+\/)[^/]*(\.[^/.]*)$/, "/o$1o-o$2")
                .replace(/\.jpg(\?.*)?$/, ".jpeg$1");
        }

        if (domain_nowww === "dbstatic.no") {
            return src.replace(/(:\/\/[^/]*\/[0-9]+\.[^/.]*?)(?:\?.*)?$/, "$1?width=-1&height=-1");
        }

        if (domain_nosub === "celebsnetworth.org") {
            return src.replace(/(:\/\/[^/]*\/main\/)thumbs\//, "$1images/");
        }

        if (domain_nowww === "multimedios.com") {
            return src.replace(/(:\/\/[^/]*\/)files\/[^/]*\/uploads\//, "$1uploads/");
        }

        if (domain === "file.hstatic.net") {
            return src.replace(/(\/file\/[^/]*-[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "sm.askmen.com") {
            return src.replace(/(:\/\/[^/]*\/)t\/(.*\/[^/]*)\.[0-9]+(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain_nowww === "elsiglodetorreon.com.mx") {
            return src
                .replace(/:\/\/[^/]*\/m\/ni\/(.*\/[0-9]+)\.[0-9]+(\.[^/.]*)$/,
                         "://media22.elsiglodetorreon.com.mx/i/$1$2")
                .replace(/\.jpg(\?.*)?$/, ".jpeg$1");
        }

        if (domain_nowww === "elsiglo.mx") {
            return src
                .replace(/(:\/\/[^/]*\/m\/)n([a-z]\/.*\/[0-9]+)\.[0-9]+(\.[^/.]*)$/,
                         "$1$2$3")
                .replace(/(\/[0-9]+)_[a-z](\.[^/.]*)$/, "$1$2")
                .replace(/\.jpg(\?.*)?$/, ".jpeg$1");
        }

        if (domain === "img.richestcelebrities.org" ||
            domain_nowww === "celebritypictures.wiki" ||
            domain === "img.networthpost.org" ||
            domain_nowww === "thefappeningpics.com") {
            return src.replace(/(:\/\/[^/]*\/)thumbs\//, "$1images/");
        }

        if (domain_nowww === "fashionscene.nl") {
            return src.replace(/_thumb_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "monitor.bg") {
            return src.replace(/\/gallery\/thumb_[0-9]+x[0-9]+_([^/]*)$/, "/gallery/$1");
        }

        if (domain_nowww === "textilwirtschaft.de" ||
            domain_nowww === "fashionmagazine.it") {
            return src.replace(/(\/gallery\/media\/[0-9]+\/[0-9]+)-[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "horizont.net" && src.indexOf("/media/") >= 0) {
            return src.replace(/(-[0-9]+)-[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "twproxy.stiletto.fr") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9a-z]+\/[wh][0-9]+\//, "http://");
        }

        if (domain_nowww === "we123.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/img\/p\.php.*?[?&]p=([^&]*).*?$/, "$1"));
        }

        if (domain_nosub === "vagalume.com" &&
            domain.match(/^s[0-9]*\.vagalume/)) {
            return src.replace(/(\/images\/[0-9]+)[wh][0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "storage.gra1.cloud.ovh.net" &&
            src.match(/\/Futurenet[^/]*Images\//)) {
            return src.replace(/_[0-9]+x[0-9]+(\?.*)?$/, "$1");
        }

        if (domain === "iasbh.tmgrup.com.tr") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/[0-9a-f]+\/(?:[0-9]+\/){5}[0-9]+.*?[?&]u=([^&]*).*?$/,"$1"));
        }

        if (domain_nowww === "bideew.com") {
            return src.replace(/(\/photos\/thumbnail\/[0-9]+\/)[a-z]+(\/*)(\?.*)?$/, "$1master$2$3");
        }

        if (domain === "media.filfan.com") {
            return src.replace(/(\/NewsPics\/[^/]*\/)[a-z]+(\/[^/]*)$/, "$1original$2");
        }

        if (domain_nowww === "ana.rs") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/forum\/thumbs\/img\.php.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain_nosub === "itvnet.lv" &&
            src.match(/\/upload[0-9]*\/articles\//)) {
            return src
                .replace(/\/thumbs\/[0-9]+([^/]*)$/, "/images/$1")
                .replace(/\/images\/([^_][^/]*)$/, "/images/_origin_$1");
        }

        if (domain_nowww === "connectgalaxy.com") {
            return src.replace(/\/gallery\/icon\/([0-9]+)\/[a-z0-9]+(\?.*)?$/, "/gallery/download/$1");
        }

        if (domain === "nst.sky.it") {
            return src.replace(/(\/[^/]*\.[^/.]*)\/_jcr_content\/renditions\/.*/, "$1");
        }

        if (domain === "cdnimage.terbitsport.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/image\.php.*?[?&]image=([^&]*).*?$/, "$1"));
        }

        if (domain_nowww === "beimg.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/fangimg\.php.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain_nowww === "que.es") {
            return src.replace(/-[0-9X]+x[0-9X]+(?:x[0-9]+)?(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "independent.com.mt") {
            return src.replace(/(:\/\/[^/]*\/file\.aspx).*?[?&](f=[0-9]+).*?$/, "$1?$2");
        }

        if (domain === "img.selenka.pl") {
            return src.replace(/(\/(?:fb)?walls\/[0-9a-f]+\/)[a-z](\.[^/.]*)$/, "$1o$2");
        }

        if (domain === "ki.ill.in.ua") {
            return src.replace(/\/[0-9]+x[0-9]+(\/[0-9]+\.[^/.]*)$/, "/0x0$1");
        }

        if (domain === "stg.pcg.space") {
            return src.replace(/\/[a-z]+(\.[^/.]*)$/, "/org$1");
        }

        if (domain === "static.noticiasaominuto.com" ||
            domain === "static.noticiasaominuto.com.br") {
            return src.replace(/(\/stockimages\/)(?:gallery\/)?[^/]*(\/[^/]*)$/, "$1hires_original$2");
        }

        if (domain_nowww === "harry-potter.net.pl") {
            return src.replace(/(\/images\/photoalbum\/[^/]*\/[^/]*)_t[0-9](\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "super.ru") {
            return src.replace(/(\/upload\/iblock\/[0-9a-f]+\/[0-9a-f]+)_[a-z0-9_]+(\.[^/.]*)$/, "$1$2");
        }

        if ((domain_nosub === "kanobu.ru" ||
             domain_nosub === "kanobu.net") &&
            domain.match(/^i[0-9]*\./)) {
            return src.replace(/:\/\/[^/]*\/r\/[0-9a-f]+\/[-0-9]+x[-0-9]+\//, "://");
        }

        if (domain_nowww === "tv3.lt") {
            return src
                .replace(/(:\/\/[^/]*\/)usi\/.*[?&]f=([^&]*).*?$/, "$1$2")
                .replace(/(:\/\/[^/]*\/)\/*/, "$1");
        }

        if (domain_nosub === "gallery.ru" &&
            domain.match(/^data[0-9]*\.(?:i\.)?gallery\.ru/)) {
            return src.replace(/(\/albums\/gallery\/[^/]*-[0-9]{5,}-)[whmc]?[0-9]+(?:x[0-9]+)?(?:-[0-9a-z]+)?(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "fotosdefamosas.tk") {
            return src.replace(/\/miniaturas\/TN_([^/]*)$/, "/$1");
        }

        if (domain_nowww === "starwiki.org") {
            return {
                url: src.replace(/\/thumbs\/photos\//, "/photos/"),
                head_wrong_contenttype: true
            };
        }

        if (domain_nowww === "postervdom.ru" && src.indexOf("/upload/") >= 0) {
            return src.replace(/(\/item_[0-9]+\/)[a-z]+_(item_[0-9]+[^/]*)$/, "$1$2");
        }

        if (domain_nosub === "fastpic.ru" &&
            domain.match(/^i[0-9]*\.fastpic\.ru/)) {
            return src.replace(/(:\/\/[^/]*\/)thumb(\/.*\.)jpeg/, "$1big$2jpg?noht=1");
        }

        if (domain === "i.nahraj.to") {
            return src.replace(/(:\/\/[^/]*\/)[a-z](\/[^/]+\.[^/.]*)$/, "$1f$2");
        }

        if (domain === "skwww.plusden.sk") {
            return src.replace(/\/thumb(\/images\/gallery\/.*?)(?:\?.*)?$/, "$1");
        }

        if (domain_nowww === "admags.xyz") {
            return src.replace(/_tb(\/[^/]*)$/, "$1");
        }

        if (domain === "img.topky.sk" && false) {
            newsrc = src.replace(/\/[0-9]+px\/([^/]*)(\/[^/]*)?$/, "/big/$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "img.topky.sk") {
            return src.replace(/(\/dc\/+[0-9]+\/+)thumb\//, "$1");
        }

        if (domain_nowww === "kungahuset.org") {
            return src.replace(/\/uploads\/thumb\/[0-9]+X[0-9]+_/, "/uploads/");
        }

        if (domain_nosub === "e-monsite.com") {
            return src.replace(/\/resize_[0-9]+_[0-9]+\//, "/");
        }

        if (domain === "static.guide.supereva.it" ||
            domain === "media.fashionblog.it") {
            return src.replace(/\/thn_([^/]*)$/, "/$1");
        }

        if (domain_nowww === "apachan.net" ||
            domain_nowww === "prokote.info") {
            return src.replace(/(:\/\/[^/]*\/)(?:thumbs|previews)\//, "$1images/");
        }

        if (domain === "imggaleri.hurriyet.com.tr" ||
            domain === "imgkelebek.hurriyet.com.tr") {
            return src.replace(/(\/+LiveImages\/+[^/]*\/+[0-9]+\/+[^/]*)(?:\/+ThumbFolder)?\/+([^/]*)$/, "$1/LargeFolder/$2");
        }

        if (domain_nowww === "army.mil") {
            return src.replace(/(\/e2\/c\/images\/)(.*\/)size[0-9]*(\.[^/.]*)$/, "$1$2original$3");
        }

        if (domain_nosub === "disquscdn.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/get.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain_nowww === "smore.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/external_image.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "images.ctfassets.net") {
            return src.replace(/\?.*$/, "?h=4000");
        }

        if (domain_nosub === "okccdn.com") {
            return src.replace(/(\/php\/load_okc_image\.php\/images\/)(?:[0-9]+(?:x[0-9]+)?\/){1,}([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "metapix.net") {
            newsrc = src.replace(/\/files\/[a-z]+\/([0-9]+\/[^/]*)$/, "/files/full/$1");
            if (newsrc !== src)
                return newsrc;

            return add_extensions(src.replace(/\/thumbnails\/[a-z]*\/([0-9]+\/[0-9]+[^/]*)_noncustom(\.[^/.]*)$/, "/files/full/$1$2"));
        }

        if (domain === "cdn.furiffic.com") {
            return add_extensions(src.replace(/(:\/\/[^/]*\/)[a-z]+(\/[0-9]+\.[^/.]*)$/, "$1originals$2"));
        }

        if (domain === "d3gz42uwgl1r1y.cloudfront.net") {
            return add_extensions(src.replace(/(\/submission\/[0-9]+\/[0-9]+\/[0-9a-f]+)\/[0-9]+x[0-9]+(\.[^/.]*)$/, "$1$2"));
        }

        if (domain_nosub === "route50.net") {
            return src.replace(/(\/data\/gallery\/submissions\/[0-9a-f]+_)[a-z]+(\.[^/.]*)$/, "$1full$2");
        }

        if (domain === "img.luxusbenz.com" ||
            domain === "img.bmwcase.com" ||
            domain === "img.benzspirit.com") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+(\/[a-f0-9]+(?:-[^/]*)?\.[^/.]*)$/, "$1full$2");
        }

        if (domain === "dot.asahi.com") {
            return src.replace(/\/upload\/[0-9]+_([0-9]{10,}_[0-9]+\.[^/.]*)$/, "/upload/$1");
        }

        if (domain === "news-img.dwango.jp") {
            return src.replace(/(\/uploads\/[a-z]+\/file\/.*\/)(?:md|sm|lg)_([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "getnews.jp") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/thumb2\/ext\/([a-z]+:\/\/.*)$/, "$1");
        }

        if (domain_nowww === "amuro.fr") {
            return src.replace(/\/_data\/i(\/upload\/.*)-cu_s[0-9]+x[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "cdn-news30.it") {
            return src.replace(/\/blobs\/variants\/((?:[a-f0-9]\/){4}[-0-9a-f]+)_[a-z]+(\.[^/.]*)$/, "/blobs/full/$1$2");
        }

        if (domain === "imagebox.cz.osobnosti.cz") {
            return src.replace(/\/[A-Z]([0-9]+-[0-9a-z]+\.[^/.]*)$/, "/O$1");
        }

        if (domain === "spicy.southdreamz.com") {
            return src.replace(/\/cache\/(.*?)(?:_[0-9]+|(?:(?:_[a-z][0-9]+){1,}(?:_thumb)?))(\.[^/.]*)$/, "/spicysource/$1$2");
        }

        if (domain === "img.miumag.pl") {
            return src.replace(/\/[a-z]([0-9]+\.[^/.]*)$/, "/c$1");
        }

        if (domain_nowww === "hotnews.bg") {
            return src.replace(/(\/uploads\/news\/[^/]*\/)thumb(\/[0-9]+\.[^/.]*)$/, "$1images$2");
        }

        if (domain === "c6oxm85c.cloudimg.io" ||
            domain === "ce8737e8c.cloudimg.io") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/(?:cdn[a-z]\/n\/)?(?:(?:width|height)\/[0-9]+\/){0,}q[0-9]*\/([a-z]*:\/\/)/, "$1");
        }

        if (domain_nowww === "kinataka.ru") {
            return src.replace(/\/photos\/[0-9]+\/([^/]*)$/, "/photos/$1");
        }

        if (domain === "easttouch.my-magazine.me") {
            return src.replace(/(\/upload\/photoalbum\/)thumbnail(\/[0-9a-f]+\/[0-9a-f]+\.[^/.]*)$/, "$1original$2");
        }

        if (domain === "tvdaily.asiae.co.kr") {
            return src.replace(/\/upimages\/photoda\//, "/upimages/gisaimg/");
        }

        if (domain === "img.thefactjp.com") {
            return src.replace(/(\/service\/[a-z]+\/[0-9]+\/[0-9]+\/[0-9]+\/)(?:[0-9]+|thumb)\/([0-9a-f]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "rlv.zcache.co.nz" ||
            domain === "rlv.zcache.com.br") {
            return src.replace(/(-r[0-9a-f]+(?:_[_0-9a-z]+)?)_[0-9]+(\.[^/.?]*)(?:\?.*?)?$/, "$1_999999999$2?rvtype=content");
        }

        if (domain_nowww === "empireposter.de") {
            return src.replace(/\/bilder\/bilder_[a-z]\//, "/bilder/bilder_l/");
        }

        if (domain === "dg31sz3gwrwan.cloudfront.net") {
            return src.replace(/(\/[0-9]+\/[0-9]+)_[a-z]+(?:-optimized-[0-9]*)?(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.mach-shiko.net") {
            return src.replace(/(\/images\/[0-9]+\/[0-9]+\/)[a-z]\/([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.geinou-img.com") {
            return src.replace(/(\/[_0-9]+\/)[a-z]\/([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "showbiz.cz") {
            return src.replace(/(\/files\/gallery\/)thumb\/([0-9a-f]+\/[0-9a-f]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "images.nudereviews.com") {
            return src.replace(/(\/data\/media\/image\/)[a-z]+\//, "$1original/");
        }

        if (domain_nowww === "thefamouspeople.com") {
            return src.replace(/\/profiles\/thumbs\//, "/profiles/images/");
        }

        if (domain === "i.trust.ua") {
            return src.replace(/\/files\/photo\/[0-9]+\//, "/files/photo/source/");
        }

        if (domain === "media.beritagar.id") {
            return src.replace(/\/lme-([^/]*\/)(?:[a-z]+_[0-9]+\/)?([0-9a-f]+)(?:_imresized)?(\.[^/.]*)$/, "/$1$2$3");
        }

        if (domain === "imgs.ckcdn.com" ||
            domain === "i.imgscc.com") {
            return {
                url: src.replace(/\?.*$/, ""),//src.replace(/\?.*$/, "?_w=9999999999999"),
                headers: {
                    Origin: null,
                    Referer: null
                },
                can_head: false
            };
        }

        if (domain === "im.mtv.fi") {
            return src.replace(/\/image(\/[0-9]+\/)(?:(?:portrait|landscape[^/]*)\/[0-9]+\/[0-9]+\/)?([0-9a-f]+\/)[a-zA-Z0-9]{2}\/([^/.]+)(\.[^/.]*)$/,
                               "/blob$1$2$3-data$4");
        }

        if (domain_nowww === "imageweb.ws" ||
            domain_nowww === "pussyspot.net") {
            return src.replace(/\/media\/images_[0-9]+\//, "/media/images/");
        }

        if ((domain === "t.imageweb.ws" ||
             (domain_nosub === "pussyspot.net" && domain.match(/^cdn[0-9]*\./))
            ) &&
            src.indexOf("/media/") && options && options.cb && options.do_request) {
            match = src.match(/\/media\/[^/]*\/[0-9]+\/[0-9]+\/([0-9]+)\.[^/.]*/);
            if (match) {
                id = match[1];

                var queryurl = "http://www." + domain_nosub + "/a/" + id + ".html";
                options.do_request({
                    url: queryurl,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/href="(\/media\/images\/[^"]*)"/);
                            if (match) {
                                options.cb(urljoin("http://www." + domain_nosub + "/", match[1]).replace(/\?.*/, ""));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });
            }

            return {
                waiting: true
            };
        }

        if (domain_nosub === "pictoa.com" &&
            domain.match(/^s[0-9]*\.pictoa\.com/)) {
            return src.replace(/(\/media\/galleries\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\/)thumbs\/([^/]*)$/, "$1$2");
        }

        if (domain_nosub === "vcg.com" &&
            domain.match(/goss[0-9]*\.vcg/)) {
            return src.replace(/\/editorial\/vcg\/[0-9]+\//, "/editorial/vcg/nowarter800/");
        }

        if (domain_nosub === "renault-dacia.com.ua") {
            newsrc = urljoin("http://www.renault-dacia.com.ua/", decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/im\.php.*?[?&]image=([^&]*).*?$/, "$1")));
            if (newsrc !== src)
                return newsrc;

            return src.replace(/\/pictgen\/[0-9]+\//, "/topicsfoto/");
        }

        if (domain_nowww === "numberoneturk.com.tr" ||
            domain_nowww === "fashionone.com.tr") {
            return src.replace(/(\/plog-content\/+)thumbs(\/+.*\/+)[a-z]+\/+[0-9]+-([^/]*)$/, "$1images$2$3");
        }

        if (domain === "prsize.allviki.com") {
            return src.replace(/:\/\/[^/]*\/resize_[0-9]+(?:x[0-9]+)?\//, "://pic.allviki.com/");
        }

        if (domain_nowww === "celebritygalls.com") {
            return src.replace(/\/cache\/(.*)_[0-9]+_cw[0-9]+_ch[0-9]+_thumb(\.[^/.]*)$/, "/albums/$1$2");
        }

        if (domain_nowww === "instantfap.com") {
            return src.replace(/:\/\/[^/]*\/image\/([^/]*)$/, "://i.imgur.com/$1");
        }

        if (domain_nowww === "agensite.com" ||
            domain === "cdn.agensite.online" ||
            domain === "cdn.conexaohost.com.br") {
            return {
                url: src
                    .replace(/\/img\/[0-9]+x[0-9]+\//, "/img/original/")
                    .replace(/\/temp\/img\/([0-9a-z]+)_([0-9]+)_([0-9a-z]+)_([0-9a-z]+)_([0-9]+)_([a-z]+)_[^/]*$/,
                             "/img/original/0/0/png/$1/$2/$3/$4/$5.$6")
                    .replace(/\/imagizer_export\.php\?([^,]*).*/, "/img/original/0/0/png/$1"),
                redirects: true
            };
        }

        if (domain === "images.mtvnn.com") {
            return src.replace(/(:\/\/[^/]*\/[0-9a-f]+\/)[0-9]+(?:x[0-9]+)?_?(\.[^/.?]*)?(?:[?#].*)?$/, "$1original$2");
        }


        if (domain_nowww === "hipernoticias.com.br") {
            return src.replace(/(\/storage\/webdisco\/[0-9]+\/[0-9]+\/[0-9]+\/).*(\/[0-9a-f]+\.[^/.]*)$/, "$1original$2");
        }

        if (domain_nowww === "bd-journal.com") {
            match = src.match(/\/image-contents\/[0-9]+x[0-9]+x[0-9]+\/news-photos\/((?:[0-9]+\/){2,})([-0-9a-zA-Z_=+]+)(?:[?#].*)?$/);
            if (match) {
                return src.replace(/(:\/\/[^/]*\/).*/, "$1") + "assets/news_photos/" + match[1] + atob(match[2]);
            }
        }

        if (domain_nowww === "myidol.com.vn") {
            return src.replace(/\/pictures\/pic[a-z]+(\/[0-9]+\/[0-9]+\/[0-9]+\/)[0-9]+\/([a-z]+[0-9]+\.[^/.]*)$/,
                               "/pictures/picfullsizes/$1$2");
        }

        if (domain_nowww === "dw.com") {
            return src.replace(/(:\/\/[^/]*\/image\/[0-9]+_)[0-9]+(\.[^/.]*)$/, "$17$2");
        }

        if (domain_nowww === "finds.ir") {
            return src.replace(/\/img\/tu\//, "/img/");
        }

        if ((domain_nosub === "xuk.mobi" ||
             domain_nosub === "xuk.ooo") &&
            domain.match(/^img[0-9]*\./) &&
            src.indexOf("/images/photos/") >= 0) {
            return src.replace(/\/thumb\/([0-9a-f]+\.[^/.]*)$/, "/origin/$1");
        }

        if (domain === "s.filmsextv.com") {
            return src.replace(/(\/[0-9a-f]+\/)thumbs\/([0-9a-f]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "lanita.ru" &&
            src.indexOf("/images/offer/") >= 0) {
            return src.replace(/(\/[0-9]+)-thumb(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "backalleypics.net") {
            return src.replace(/(\/images\/[0-9]+-[0-9]+-[0-9]+\/)thumbs\/([^/]*)$/, "$1$2");
        }

        if ((domain_nosub === "turboimg.net" ||
             domain_nosub === "turboimagehost.com") &&
            options && options.cb && options.do_request) {
            id = src.replace(/.*\/([0-9]+)_([^/]*)$/, "$1/$2");
            if (id !== src) {
                var nid = id.split("/")[0];
                var pid = id.split("/")[1];
                var queryurl = "http://www.turboimagehost.com/p/" + nid + "/" + pid + ".html";
                options.do_request({
                    url: queryurl,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<meta *property="og:image" *content="([^"]*)"/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "arhivach.cf") {
            return src.replace(/(\/storage[0-9]*\/)t\/([0-9a-f])([0-9a-f]{2})([0-9a-f]+\.[^/.]*)$/, "$1$2/$3/$2$3$4");
        }

        if (domain === "content.wafflegirl.com" ||
            domain === "cdnwg.youx.xxx" ||
            domain === "cdn.pornpictureshq.com") {
            return src.replace(/\/galleries\/gthumb\/(.*)(?:__x[0-9]+|_[0-9]+x(?:[0-9]+)?_?)(\.[^/.]*)$/, "/galleries/content/$1$2");
        }

        if (domain_nowww === "anawalls.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/repic\/image\.php.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain === "d3ofq03apmfb8c.cloudfront.net" ||
            domain_nowww === "lipstickalley.com" ||
            (domain_nosub === "mandatory.com" && domain.match(/^cdn[0-9]*-hfboards\./)) ||
            domain === "forum.purseblog.com" ||
            (domain_nowww === "behindbigbrother.com" && src.indexOf("/forums/data/") >= 0) ||
            domain_nowww === "simsettlements.com") {
            var regex = /\/data\/avatars\/[a-z]\/([0-9]+\/[0-9]+\.[^/.]*)$/;
            return [
                src.replace(regex, "/data/avatars/o/$1"),
                src.replace(regex, "/data/avatars/l/$1")
            ];
        }

        if (domain === "img-cache.cdn.gaiaonline.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9a-f]+\//, "");
        }

        if (domain === "y.zdmimg.com") {
            return src.replace(/(\/[0-9a-f]+\.[^/._]*)_[a-z][0-9]+\.[^/.]*$/, "$1");
        }

        if (domain_nosub === "oboi.ws") {
            return src.replace(/\/wallpapers\/(?:[0-9]+|[a-z])_([0-9]+_[^/]*)(?:_[0-9]+x[0-9]+)?(\.[^/.]*)$/, "/originals/original_$1$2");
        }

        if (domain === "images.wallpaperscraft.com" &&
           options && options.cb && options.do_request) {
            id = src.replace(/.*\/([^/]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1/$2");
            if (id !== src) {
                var pid = id.split("/")[0];
                var ext = id.split("/")[1];
                options.do_request({
                    url: "https://wallpaperscraft.com/wallpaper/" + pid,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState !== 4) {
                            return;
                        }

                        var match = resp.responseText.match(/<a[^>]*\/download\/[^>]*>\s*Original Resolution: *([0-9]+x[0-9]+)/);
                        if (match) {
                            options.cb("https://images.wallpaperscraft.com/image/" + pid + "_" + match[1] + ext);
                        } else {
                            options.cb(null);
                        }
                    }
                });
            }

            return {
                waiting: true
            };
        }

        if (domain === "cdn.eso.org" ||
            domain_nowww === "eso.org") {
            return src.replace(/(\/images\/|\/archives\/postcards\/)[^/]*\/([^/.]*\.[^/.]*)$/, "$1large/$2");
        }

        if (domain === "www.galex.caltech.edu" ||
            domain === "galex.caltech.edu") {
            return src
                .replace(/(_img[0-9]*)_(?:Sm|small)(\.[^/.]*)$/, "$1$2")
                .replace(/(_vid[0-9]*)_tn(\.[^/.]*)$/, "$1_shot$2");
        }

        if (domain_nowww === "astro-austral.cl") {
            return src.replace(/(\/imagenes\/galaxies\/[^/]*\/)[a-z]+(\.[^/.]*)$/, "$1max$2");
        }

        if (domain === "cdn.spacetelescope.org") {
            return src.replace(/(\/archives\/images\/)[^/]*(\/[^/.]*\.[^/.]*)$/, "$1large$2");
        }

        if (domain_nowww === "buddhistdoor.net") {
            return src.replace(/(\/upload\/file\/[0-9]+\/[0-9]+\/[0-9a-f]+)_[0-9]+(?:__[0-9]+)?(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "agraroldal.hu") {
            return add_extensions(src.replace(/\/[^/]*\/[0-9]+x[0-9]+\/([0-9]+\.[^/.]*)$/, "/upload/upimages/$1"));
        }

        if (domain === "media.lamsao.com") {
            return src.replace(/\/Thumbnail\/Cache\/*Data\/(.*)_[0-9]+_[0-9]+(\.[^/.]*)$/, "/Data/$1$2");
        }

        if (domain === "tupian.aladd.net") {
            return src.replace(/(\.[^-/.]*)-[0-9]+(?:[?#]*)?$/, "$1");
        }

        if (domain === "uploadfile.huiyi8.com" ||
            (domain_nowww === "popwindshop.com" && src.indexOf("/pics/") >= 0)) {
            return src.replace(/(\.[^/.]*)\.[0-9]+\.[^/.]*$/, "$1");
        }

        if ((domain_nosub === "redocn.com" && domain.match(/^img[0-9]*\./)) ||
            domain === "image.tupian114.com") {
            return {
                url: src.replace(/(\/[^/]*\.[^/.]*)\.[0-9]+\.[^/.]*$/, "$1"),
                problems: {
                    watermark: true
                }
            };
        }

        if (domain === "media.alienwarearena.com") {
            return src.replace(/\/thumbnail_[0-9]+x[0-9]+\/([0-9a-f]+\.[^/.]*)$/, "/media/$1");
        }

        if (domain_nowww === "6asian.com") {
            return src.replace(/(\/imglink\/[a-z]+)-thumb[0-9]+x[0-9]+\//, "$1/");
        }

        if (domain === "music.fetnet.net") {
            return src.replace(/(\/img\/album\/[0-9]+)-[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "wallpaperscave.ru") {
            return src.replace(/\/images\/thumbs\/[^/]*\/[0-9]+x[0-9]+\//, "/images/original/");
        }

        if (domain_nowww === "lilit.lv") {
            return src.replace(/\/[0-9]+px_([0-9]+_[0-9a-f]+\.[^/.]*)$/, "/full_$1");
        }

        if (domain === "img.kurocore.com") {
            return src.replace(/(:\/\/[^/]*\/)thumbnail\/p\//, "$1p/");
        }

        if (domain_nowww === "mocah.org") {
            return src.replace(/(:\/\/[^/]*\/)thumbs\/([0-9]+-[^/]*)$/, "$1uploads/posts/$2");
        }

        if (domain_nowww === "anime-zone.ru") {
            return src.replace(/(\/inc\/goods_[a-z]+\/[^/]*\/)[a-z]+\/([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "99px.ru") {
            return src.replace(/:\/\/[^/]*\/sstorage\/[0-9]+\/[0-9]+\/[0-9]+\/[a-z]+_([0-9]+)_[0-9]+\.[^/.]*$/,
                               "://wallpapers.99px.ru/cms/mhost.php?tid=53&act=getimage&id=$1");
        }

        if (domain_nowww === "wall2born.com") {
            return src.replace(/\/file\/download\/[0-9]+x[0-9]+\/([0-9]+\/[^/]*)-[0-9]+x[0-9]+(\.[^/.]*)$/,
                               "/data/out/$1$2");
        }

        if (domain_nowww === "wallpapersexpert.com") {
            return src.replace(/\/images\/+file\/+([0-9]+\/+)[0-9]+x[0-9]+-([0-9]+-)/, "/data/out/$1$2");
        }

        if (amazon_container === "desktop-backgrounds-org") {
            return src.replace(/\/(?:[^-/]*-)?[0-9]+x[0-9]+\/([^/]*\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "oboi.cc" ||
            domain_nowww === "oboik.ru") {
            return src.replace(/\/(?:[-0-9]+)?uploads(?:_full)?(\/[0-9]+_[0-9]+_[0-9]+\/)[a-z]+(\/[0-9]+\/[^/]*)$/,
                               "/uploads$1view$2");
        }

        if (domain === "img.getbg.net") {
            return src.replace(/\/upload\/[a-z]+\/([0-9]*\/)(?:thumbnail_)?([^/]*)$/,
                               "/upload/full/$1$2");
        }

        if ((domain_nosub === "fichub.com" ||
             domain === "scontent.ccdn.cloud")
            && src.indexOf("/image/") >= 0) {
            return src.replace(/(\/[-0-9a-f]+\/[^/]*)-(?:maxw-[0-9]+|[0-9]+x[0-9]+)(\.[^/.]*)$/,
                               "$1$2");
        }

        if (domain_nowww === "nishinippon.co.jp" && src.indexOf("/import/") >= 0) {
            return src.replace(/(\/[0-9]+\/[0-9]+_[0-9]+)_s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "resource.shuud.mn") {
            return src.replace(/(\/[0-9]+)_t(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "anime-fresh.ru") {
            return src.replace(/(\/upload\/[a-z]+\/)thumbs\/([^/]*)$/, "$1$2");
        }

        if (domain === "imgfiles.plaync.com") {
            return src.replace(/\/download_thumbnail\/([^/]*)$/, "/download/$1");
        }

        if (domain_nowww === "jjdao.com") {
            return src.replace(/(\/wiki\/uploads\/[0-9]+\/[0-9+][0-9a-zA-Z]+)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain === "t.huv.kr") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/thumb_crop_resize\.php.*?[?&]url=([^&?]*).*?$/, "$1"));
        }

        if (domain === "down.humoruniv.org") {
            return {
                url: src,
                headers: {
                    Referer: ""
                }
            };
        }

        if (domain_nosub === "pocoimg.cn" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/_[WH][0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "qcmt.bid") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/upload\/.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain === "pic.xiao4j.com") {
            return src.replace(/(\/[0-9]+\.[^/._]*)_[0-9]+_[0-9]+\.[^/.]*$/, "$1");
        }

        if (domain === "img.mm29.com") {
            return src.replace(/(\/[0-9]+\.[^/.]*)\/[0-9]+\.[^/.]*$/, "$1");
        }

        if (domain_nosub === "2chmatome2.jp" &&
            domain.match(/^image[0-9]*\./)) {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/v2\/thumb\/app\/[0-9]+\/[0-9]+\/.*?[?&]url=([^&]*).*?$/, "$1"));
        }

        if (domain === "file.2chmatome2.jp") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/(http)/, "$1");
            if (newsrc !== src) {
                return decodeURIComponent(decodeURIComponent(newsrc));
            }
        }

        if (domain_nowww === "wnacg.net") {
            return src.replace(/\/data\/thumb\//, "/data/");
        }

        if (domain === "rs.n1info.com") {
            return src.replace(/\/Thumbnail(\/[0-9]+\/)/, "/Picture$1");
        }

        if (domain === "s.iw.ro") {
            return src.replace(/\.thumb(\.[^/.]+)([?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "adevarul.ro" && src.indexOf("/MRImage/") >= 0) {
            return src.replace(/\/[0-9]+x[0-9]+(\.[^/.]*)$/, "/orig$1");
        }

        if (domain_nowww === "eva.bg") {
            return src.replace(/\/media_cache\/[^/]*\/media\//, "/media/");
        }

        if (domain_nosub === "blogspot.es") {
            return src.replace(/\/cache\/media\/files\//, "/files/");
        }

        if (domain === "data.kontrakty.ua") {
            return src.replace(/(\/cache\/[a-z]+\/)[0-9]+\//, "$1orig/");
        }

        if (domain === "d3t543lkaz1xy.cloudfront.net") {
            return src.replace(/(\/photo\/[0-9a-f]+)_[a-z](?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "merokhabar.net") {
            return src.replace(/\/thumbnail\/thumb([^/]*)$/, "/original/ori$1");
        }

        if (domain_nosub === "ali213.net" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/\/[0-9]+_([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "reseuro.magzter.com" ||
            domain === "rse.magzter.com") {
            return src
                .replace(/:\/\/[^/]*\/[0-9]+x[0-9]+\/articles\//, "://magarticles.magzter.com/articles/")
                .replace(/:\/\/rse\.[^/]*\/[0-9]+x[0-9]+\//, "://cdn.magzter.com/");
        }

        if (domain === "dev.magzter.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/dynimage\/thumb_news\.php.*?[?&]src=([^&]*).*$/, "$1"));
        }

        if (domain === "img.bulawayo24.com") {
            return src.replace(/\/articles\/thumbs\/[0-9]+x[0-9]+\//, "/articles/");
        }

        if (domain === "static.eva.ro") {
            return src.replace(/\/img\/auto_resized\/db\/(.*)-[0-9]+x[0-9]+(?:-.-[0-9a-f]+)?(\.[^/.]*)$/, "/img/db/$1$2");
        }

        if (domain === "s-image.hnol.net") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/x\/[0-9]+x[0-9]+\/auto\/(https?):\/\/?/, "$1://");
        }

        if (domain === "cdn.tower.jp") {
            return src.replace(/(:\/\/[^/]*\/za\/)[a-z]\//, "$1o/");
        }

        if (domain_nowww === "gamers-onlineshop.jp" ||
            domain_nowww === "animate-onlineshop.jp" ||
            domain_nowww === "acoop-onlineshop.jp" ||
            domain === "cdn.melonbooks.co.jp" ||
            domain_nowww === "melonbooks.co.jp" ||
            domain === "melonbooks.akamaized.net") {
            return src.replace(/(:\/\/[^/]*\/)(?:user_data\/packages\/)?resize_image\.php.*?[?&]image=([^&]*).*$/, "$1upload/save_image/$2");
        }

        if (domain_nowww === "hmv.com.hk") {
            return src.replace(/\/data\/upload\/[0-9]+\//, "/data/upload/");
        }

        if (domain_nowww === "buysmartjapan.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/images\/[0-9a-f]+.*?[?&]original=([^&]*).*$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain_nowww === "sonymusic.co.jp") {
            return src.replace(/(\/adm_image\/common\/.*)__[0-9]+_[0-9]+_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "imageban.ru" &&
            domain.match(/^i[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/)thumbs\/([0-9]+)\.([0-9]+)\.([0-9]+)\/([0-9a-f]+\.[^/.]*)$/, "$1out/$2/$3/$4/$5");
        }

        if (domain === "image.hackadoll.com") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/thumbs.*?[?&]u=([^&]*).*$/, "$1"));
        }

        if (domain === "images.niooz.fr") {
            return urljoin(src, decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/safe_image\.php.*?[?&]i=([^&]*).*$/, "$1")));
        }

        if (domain_nowww === "mengchongzhi.com") {
            return src.replace(/\/uploadfile\/thumb\//, "/uploadfile/");
        }

        if (domain_nowww === "playground33.com") {
            return src.replace(/(\/uploads\/(?:[0-9]\/){4}[0-9]+\/[0-9]+)(\.[^/.]*)$/, "$1_orig$2");
        }

        if (domain_nosub === "trends.com.cn" &&
            domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/-tweb\.[a-z]+(?:\.[^/.]*)?(?:[?#].*)?$/, "");
        }

        if (domain_nowww === "la-soubrette.fr") {
            return src.replace(/\/thumbs-photo-nue\//, "/photo-ps-nue/");
        }

        if (domain === "static.feber.se" && src.indexOf("/article_images/") >= 0) {
            return src.replace(/(\/[0-9]+)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "previiew.com") {
            return {
                url: src.replace(/(\/webfile\/img\/[0-9]+)(?:\/[xy]=[0-9]+){0,}(?:[?#].*)?$/, "$1"),
                can_head: false
            };
        }

        if (domain === "d2e7nuz2r6mjca.cloudfront.net") {
            return src.replace(/-[0-9]+[wh](\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "vplate.ru" ||
            domain_nowww === "wlooks.ru") {
            return src.replace(/\/images\/article\/cropped\/[0-9]+-[0-9]+\//, "/images/article/orig/");
        }

        if (domain === "media.vogue.com") {
            return src.replace(/(:\/\/[^/]*\/)r\/[a-z]_[0-9]+(?:,[a-z]_[0-9]+){0,}\//, "$1r/original/");
        }

        if (domain_nosub === "efu.com.cn" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/(\/upfile\/[^/]*\/photo\/)[a-z]+\/([0-9]+\/[0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "images.stopgame.ru") {
            return src
                .replace(/(\/articles\/[0-9]+\/[0-9]+\/[0-9]+\/)c[0-9]+x[0-9]+\/[0-9a-zA-Z]+\/([^/]*)$/, "$1$2")
                .replace(/(\/articles\/[0-9]+\/[0-9]+\/[0-9]+\/[^/]*-[0-9]+)-s(\.[^/.]*)$/, "$1$2")
                .replace(/(\/uploads\/images\/[0-9]+\/[a-z]+\/[0-9]+\/[0-9]+\/[0-9]+\/)[a-z]+_([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "pure-nude-celebs.com") {
            return src.replace(/\/pic-([^/]*)$/, "/$1");
        }

        if (domain_nowww === "pincelebs.net") {
            return src.replace(/\/thumbs(\/(?:[0-9a-f]\/){3}[0-9a-f]+\.[^/.]*)$/, "/images$1");
        }

        if (domain === "img.new2005.com") {
            return src.replace(/(\/[0-9a-f]+\.[^/._]+)_old(?:[?#].*)?$/, "$1");
        }

        if (domain === "s.libertaddigital.com") {
            return src
                .replace(/(:\/\/[^/]*\/[0-9]+\/[0-9]+\/[0-9]+\/)[0-9]+\/[0-9]+\/fit\/([^/]*)$/, "$1$2")
                .replace(/(\/fotos\/(?:galerias\/[^/]*\/|[a-z]+\/))[0-9]+\/[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "imgstudio.org" ||
            domain_nowww === "imgadult.com" ||
            domain_nowww === "imageboom.net" ||
            domain_nowww === "acidimg.cc" ||
            domain_nosub === "imgcredit.xyz") {
            return src.replace(/\/upload\/[-a-z]+\//, "/upload/big/");
        }

        if (domain === "i.acidimg.cc") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\//, "$1big/");
        }

        if (domain_nowww === "imgwallet.com" ||
            domain_nowww === "imgdrive.net" ||
            domain_nowww === "imgtaxi.com") {
            return src.replace(/\/images\/[-a-z]+\//, "/images/big/");
        }

        if (domain === "img.depo.ua") {
            return src.replace(/(:\/\/[^/]*\/)[0-9X]+x[0-9X]+\//, "$1original/");
        }

        if ((domain_nowww === "elfagr.com" ||
             domain_nowww === "albawabhnews.com") &&
            src.indexOf("/upload/photo/") >= 0) {
            return src.replace(/\/[0-9]+x[0-9]+[a-z]?\/([^/]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nowww === "cdnimpuls.com") {
            return src.replace(/\/-[0-9]+-[0-9]+-([0-9a-f]+(?:_[^/]*)?\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "mshreqnews.net" ||
            domain_nowww === "pdfkul.com") {
            return src.replace(/\/img\/[0-9]+x[0-9]+\/([^/]*)$/, "/img/$1");
        }

        if (domain_nowww === "choisirunfilm.fr") {
            return src.replace(/\/persons\/small\/([0-9]+\.[^/.]*)$/, "/persons/$1");
        }

        if (domain_nowww === "gazetaexpress.com") {
            return src.replace(/(\/public\/uploads\/image\/[0-9]+\/[0-9]+\/)[0-9]+x[0-9]+\/([^/]*)$/, "$1$2");
        }

        if (domain_nowww === "haynews.am") {
            return src.replace(/\/thumbs\/[0-9]+x(?:[0-9]+)?\//, "/images/");
        }

        if (domain_nowww === "emlakkulisi.com") {
            return src.replace(/\/resim\/[a-z]+\//, "/resim/orjinal/");
        }

        if (domain_nowww === "aquarellefm.md" && src.indexOf("/storage/") >= 0) {
            return src.replace(/_Fit_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "joy.hu" ||
            domain === "static.marquardmedia.hu") {
            return src.replace(/(\/data\/[^/]*\/[0-9]+\/[0-9]+)(?:-[^/.]*)?\.[0-9]+(?:x[0-9]+)?(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "ivoirematin.com") {
            return src.replace(/(\/images\/[0-9]+-[0-9]+\/)fb_([0-9a-f]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.theqoo.net") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/proxy\.php.*?[?&]url=([^&]*).*?$/, "$1");

            if (newsrc === src) {
                newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/proxy\/(.*)$/, "$1");
            }

            if (newsrc !== src) {
                if (!newsrc.match(/^[a-z]+:\/\//))
                    newsrc = "http://" + newsrc;
                return newsrc;
            }
        }

        if (domain_nowww === "gpslifetime.com.br" && src.indexOf("/uploads/") >= 0) {
            return src.replace(/\/image\/thumbs\//, "/image/");
        }

        if (domain_nowww === "lasillarota.com" ||
            domain === "lasillarotarm.blob.core.windows.net.optimalcdn.com" ||
            domain === "info7rm.blob.core.windows.net.optimalcdn.com") {
            return src
                .replace(/:\/\/[^/]*lasillarota\.com\/images\/tnfocus\/(?:[0-9]+\/){4}([0-9]+\/[0-9]+\/[0-9]+\/[^/]*)$/, "://lasillarotarm.blob.core.windows.net.optimalcdn.com/images/$1")
                .replace(/(\/images\/[0-9]+\/[0-9]+\/[0-9]+\/[^/]*)-focus(?:-[0-9]+){4}(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "znaj.ua") {
            return src.replace(/\/crops\/[a-z0-9]+\/[0-9]+x[0-9]+\/[0-9]+\/[0-9]+\/([0-9]+\/[0-9]+\/[0-9]+\/[^/]*)$/, "/images/$1");
        }

        if (domain_nowww === "raragente.com.br") {
            return src.replace(/\/imagem\/noticia\/[0-9]+\/[0-9]+\//, "/images/materias/");
        }

        if (domain_nowww === "pastefs.com") {
            return src.replace(/\/resource\/[a-z]+\//, "/resource/files/");
        }

        if (domain_nowww === "sigmalive.com") {
            return src.replace(/\/application\/cache\/[^/]*\/(images\/[^/]*\/)[0-9]+x[0-9]+\//, "/uploads/$1");
        }

        if (domain_nowww === "luna.ovh") {
            return src.replace(/\/imgw\/[0-9]+px\//, "/imgw/");
        }

        if (domain_nowww === "shalala.ru") {
            return src.replace(/(\/upload\/artists\/[0-9]+\/)[a-z]+\/([0-9]+_[0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "fay3.com") {
            return src.replace(/\/assets\/uploads\/(?:images_)?thumbs\//, "/assets/uploads/images/");
        }

        if (domain_nowww === "vijesti.ba" ||
            domain === "m.novi.ba") {
            return src.replace(/(\/storage\/[0-9]+\/[0-9]+\/[0-9]+\/)thumbs\/([^/]*)-(?:previewOrg|[0-9]+x[0-9]+)(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain === "m.smedata.sk") {
            return src.replace(/(\/api-media\/media\/image\/.*)_[0-9]+x(\.[^/.]*)$/, "$1$2");
        }

        if ((domain_nosub === "diariolibre.com" && domain.match(/estatico[0-9]*\.diariolibre\.com/)) ||
            domain_nowww === "canarias7.es") {
            return src.replace(/\/binrepository\/[0-9]+x[0-9]+\/.*(\/[^/]*)(?:[?#].*)?$/, "/binrepository$1");
        }

        if (domain_nowww === "modelisto.com") {
            return src.replace(/(-[0-9]+)@[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "media.kg-portal.ru") {
            return src.replace(/t(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "desktopwallpaperhd.net") {
            return src.replace(/(:\/\/[^/]*\/)thumbs\//, "$1wallpapers/");
        }

        if (domain_nowww === "wallpaperplay.com") {
            return src.replace(/\/walls\/[^/]*\//, "/walls/full/");
        }

        if (domain_nosub === "pics.vc" &&
            domain.match(/^s[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/pics\/)[a-z]\//, "$1o/");
        }

        if ((domain_nosub === "imageshack.us" ||
             domain_nosub === "imageshack.com") &&
            domain.match(/^imagizer/)) {
            return src.replace(/(:\/\/[^/]*\/v2\/)[^/]*\//, "$1x/");
        }

        if (domain_nowww === "girlofthehour.com") {
            return src.replace(/\/IMG\/poster_resized\//, "/IMG/poster/");
        }

        if (domain === "hwcdn.ddstatic.com") {
            regex = /(-gal-)[0-9]+(-[a-z]+\/[^/]*)$/;
            return [
                src.replace(regex, "$11600$2"),
                src.replace(regex, "$11024$2")
            ];
        }

        if (domain === "img.sexpornpages.com") {
            return src.replace(/\/converted\/+[a-z]+\/+([a-z]+[0-9]*\/)/, "/$1");
        }

        if (domain_nosub === "taopic.com" &&
            domain.match(/^pic[0-9]*\./)) {
            return src.replace(/:\/\/pic([0-9]*\.[^/]*\/[0-9]+\/[0-9]+-[A-Z0-9]+)-[a-z]+(\.[^/.]*)$/,
                               "://img$1$2");
        }

        if (domain === "static.hdw.eweb4.com" &&
            options && options.cb && options.do_request) {
            id = src.replace(/.*\/media\/thumbs\/.*\/([0-9]+)\.[^/.]*$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "http://hdw.eweb4.com/out/" + id + ".html",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<meta *property="og:image" *content="([^"]*)"/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "wallpaperbackgrounds.com") {
            return src.replace(/(\/Content\/wallpapers\/.*\/)thumb-([0-9]+-[0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.barelist.com") {
            return src.replace(/(\/images\/hosted\/[^/]*\/[^/]*\/)thumbs\//, "$1pics/");
        }

        if (domain === "proxy.imgsmail.ru") {
            return add_http(decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?[?&]url[0-9]*=([^&]*).*?$/, "$1")));
        }

        if (domain_nowww === "pornoonline.com.pl") {
            return src.replace(/(\/images\/galerie\/[0-9]+\/)[a-z]+\/[a-z]+_([0-9a-f]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "photo-erotique.org") {
            return src.replace(/(\/girls\/[0-9]+\/)thumb_([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "s.mediasole.ru") {
            return src.replace(/:\/\/[^/]*\/cache\/preview\/data\//, "://mediasole.ru/data/");
        }

        if (domain_nosub === "godsartnudes.com" &&
            domain.match(/^pics[0-9]*\./)) {
            return src.replace(/(-[0-9]+_[0-9]+)(?:_[a-z]+)?(\.[^/.]*)$/, "$1_big$2");
        }

        if (domain_nowww === "gotgalleries.com") {
            return src.replace(/th([0-9]*\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "perfectnaked.com" && src.indexOf("/galleries/") >= 0) {
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_big$2");
        }

        if (domain === "cdn.eroticbeauties.net" ||
            domain === "media.pinkworld.com") {
            return src.replace(/(\/content\/+[^/]*\/+)(?:[^/]*\/+[^/]*\/+)?(?:tn@[^/]*|[0-9]+)\/+([0-9]+\.[^/.]*)$/, "$1full/$2");
        }

        if (domain_nowww === "barahla.net") {
            return src.replace(/(\/images\/photo\/[0-9]+\/[0-9]+\/[0-9]+\/)(?:[a-z]+\/)?([0-9]+)(?:_[a-z]+)?(\.[^/.]*)$/, "$1big/$2_big$3");
        }

        if (domain === "i.pipec.info") {
            return src.replace(/\/[0-9]+px\/([^/]*)$/, "/$1");
        }

        if (domain_nosub === "hothag.com" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/\/media\/galleries_[0-9]+\//, "/media/galleries/");
        }

        if ((domain_nosub === "1zoom.ru" ||
             domain_nosub === "1zoom.me") &&
            domain.match(/^s[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/)big[0-9]*\//, "$1big3/");
        }

        if (domain === "st-gdefon.gallery.world" ||
            domain === "st.gde-fon.com") {
            return src.replace(/\/wallpapers_[a-z]+(\/[0-9]+_[^/]*)$/, "/wallpapers_original$1");
        }

        if (domain_nowww === "boorp.com") {
            return src.replace(/\/miniature(\/[^/]*)$/, "$1");
        }

        if (domain === "d2pptc4exyus09.cloudfront.net") {
            return src.replace(/(\/puzzle\/[0-9]+\/[0-9]+\/)[a-z]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain_nowww === "sfondo.info") {
            return src.replace(/\/i\/[a-z]+\//, "/i/original/");
        }

        if (domain_nosub === "yiihuu.com" &&
            domain.match(/^img[0-9]*\./)) {
            return src
                .replace(/\/[0-9]+X[0-9]+\/upimg\//, "/upimg/")
                .replace(/\?.*/, "");
        }

        if (domain_nowww === "superwall.us") {
            return src.replace(/(:\/\/[^/]*\/)thumbnail\//, "$1wallpaper/");
        }

        if (domain_nosub === "mangadrawing.net") {
            return src.replace(/\/imagecache\/display\/image\//, "/image/");
        }

        if (domain_nosub === "ucoz.ru") {
            return src.replace(/(\/_ph\/[0-9]+\/)[0-9]+\/([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "wallpapersdig.com") {
            return src.replace(/\/images\/[a-z]+(?:\/.*)?(\/[^/]*-[0-9]+\.[^/.]*)$/, "/images/original$1");
        }

        if (domain === "img.hebus.com") {
            return src.replace(/\/[a-z]+\/[a-z]?([0-9]+_[0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "content.eroo.pl") {
            return src.replace(/(\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "timdir.com") {
            return src.replace(/\.tn(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "live-stats.me") {
            return src.replace(/\/pics\/thumbs\//, "/pics/images/");
        }

        if (domain_nowww === "z-celebs.com" ||
            domain_nowww === "easycelebritys.com") {
            return src.replace(/\/pics\/+thumbs\/+/, "/pics/");
        }

        if (domain === "cdn.xpics.me" ||
            domain === "cdn.pussy-porn-pics.com") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]\//, "$10/");
        }

        if (domain_nowww === "nehuha.net" && src.indexOf("/data/photo/") >= 0) {
            return src.replace(/\/thumb\.([^/]*)$/, "/$1");
        }

        if (domain_nowww === "pornrice.com" ||
            domain_nowww === "monocdn.com" ||
            domain === "media.jpegworld.com" ||
            domain_nowww === "tokyoteenies.com" ||
            domain_nowww === "galleryportal.com") {
            newsrc = src.replace(/(:\/\/[^/]*|\/media)\/+thumbs\/+((?:[0-9a-f]\/){5}[0-9a-f]+\/)[0-9]+x[0-9]+\//, "$1/galleries/$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nowww === "tokyoteenies.com") {
            return src.replace(/(\/content\/+[^/]*\/+)thumbs_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1image_$2");
        }

        if (domain === "wallpapers.jami.lt") {
            return src.replace(/_big(\.[^/.]*)$/, "$1");
        }

        if (domain === "y.yarn.co") {
            return src.replace(/(:\/\/[^/]*\/[-0-9a-f]+)_thumb(\.[^/.]*)$/,
                               "$1_screenshot$2");
        }

        if (domain === "images.genius.com") {
            return src.replace(/\/avatars\/[a-z]+\/([0-9a-f]+)(?:[?#].*)?$/, "/avatars/original/$1");
        }

        if (domain_nosub === "smcloud.net" &&
            domain.match(/^cdn[0-9]*\.thumbs\.common\./)) {
            return src.replace(/:\/\/[^/]*\/common\/.\/.\/s\/([^/]*\.[^/.]*)\/.*/, "://static.common.smcloud.net/s/$1");
        }

        if (domain_nowww === "recordeli.com") {
            return src.replace(/(\/items\/[0-9]+\/image_)[a-z]+(?:[?#].*)?$/, "$1big");
        }

        if (domain_nosub === "liveinternet.ru" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/(\/[0-9]+)_[a-z]+(_+[0-9A-Za-z]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "assets.heart.co.uk" ||
            domain === "assets.popbuzz.com") {
            return src.replace(/(-[0-9]+)-(?:view|herowidev[0-9]*)-[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "kms.yawmiyati.com") {
            return src.replace(/\/Images\/[0-9io]+x[0-9io]+x[0-9io]+\//, "/content/uploads/Article/");
        }

        if (domain === "pic.chinasspp.com") {
            return src.replace(/_s_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "eveningecho.ie") {
            return src.replace(/(\/portalsuite\/image\/+[-0-9a-f]+)\/+[^/]*(\.[^/.]*)$/,
                               "$1/mainMediaSize=FILE__image$2");
        }

        if (domain_nowww === "drunkenstepfather.com") {
            return src.replace(/\/cms\/ul\/t-/, "/cms/ul/");
        }

        if (domain_nowww === "fraufluger.ru") {
            return src.replace(/(\/files\/images\/html_gallerys\/[^/]*\/[0-9a-f]+)_[0-9]+(\.[^/.]*)$/, "$1_origin$2");
        }

        if (domain_nowww === "alfacdn.com") {
            return src.replace(/(\/[0-9]+)h?(\.[^/.]*)/, "$1m$2");
        }

        if (domain === "s.img.mix.sina.com.cn") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/auto\/resize.*?[?&]img=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "albums.timg.co.il") {
            return src.replace(/(\/userFolders\/[0-9]+\/[0-9]+\/)[a-z]+\/([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "aljanh.net") {
            return src.replace(/(\/data\/archive\/)[a-z]+\/(img\/[0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (amazon_container === "files.d20.io") {
            return src.replace(/(\/images\/[0-9]+\/[^/]*\/)[a-z]+(\.[^/.?]*)(?:[?#].*)?$/, "$1max$2");
        }

        if (domain_nowww === "wallpaperdx.com") {
            return src.replace(/\/photo(\/[^/]*)-[0-9]+-[0-9]+(\.[^/.]*)$/, "/images$1$2");
        }

        if (domain_nowww === "patrasevents.gr") {
            return src.replace(/(\/imgsrv\/.\/)[0-9]+x\//, "$1full/");
        }

        if (domain_nowww === "bestfon.info") {
            return src.replace(/\/images\/+joomgallery\/+[a-z]+\//, "/images/joomgallery/originals/");
        }

        if (domain_nowww === "alazmenah.com" ||
            domain_nowww === "syria-in.com") {
            return src.replace(/\/thumb_photo\//, "/photo/");
        }

        if (domain === "images.alwatanvoice.com") {
            return src.replace(/\/news\/thumbs\//, "/news/large/");
        }

        if (domain_nowww === "ammanalyoum.com") {
            return {
                url: src.replace(/(\/images\/upload\/[^/]*\.[^/.]*)\/[0-9]+\/[0-9]+\/[0-9]+(?:[?#].*)?$/, "$1"),
                can_head: false // 403
            };
        }

        if (domain_nowww === "shitpostbot.com") {
            newsrc = src.replace(/(:\/\/[^/]*\/)resize\/[0-9]+\/[0-9]+.*?[?&]img=([^&]*).*?$/, "$1$2");
            if (newsrc !== src) {
                return decodeURIComponent(newsrc).replace(/(:\/\/[^/]*)\/+/, "$1/");
            }
        }

        if (domain_nowww === "extremnews.com") {
            return src.replace(/\/images\/[a-z_]+-([0-9a-f]+\.[^/.]*)$/, "/images/full-$1");
        }

        if (domain === "contestimg.wish.com") {
            return {
                url: src.replace(/(\/api\/webimage\/[0-9a-f]+(?:-[0-9]+)?)-[a-z]+(\.[^/.?]*)(?:[?#].*)?$/, "$1-original$2"),
                head_wrong_contenttype: true
            };
        }

        if (domain === "image.phimmoi.net") {
            return src.replace(/(\/profile\/[0-9]+\/)[a-z]+(\.[^/.]*)$/, "$1full$2");
        }

        if (domain_nosub === "static-bluray.com" &&
            domain.match(/^images[0-9]*\./)) {
            return src.replace(/(\/[0-9]+_[0-9]+_)[a-z]+(\.[^/.]*)$/, "$1original$2");
        }

        if (domain_nowww === "titus.kz" ||
            domain_nowww === "shymkent.kz") {
            return src.replace(/(\/load_theme\/files\/[0-9a-f]+)\.[^/]*(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "mfoxes.net") {
            return src
                .replace(/\/[a-z],[0-9]+,[^/]*\/gal\//, "/gal/")
                .replace(/\/castimagethumb-([0-9]+\.[^/.]*)$/, "/castimage-$1");
        }

        if (domain === "i.ucrazy.ru") {
            return src.replace(/(\/files\/i\/[0-9]+\.[0-9]+\.[0-9]+\/)thumbs\//, "$1");
        }

        if (domain_nowww === "athinorama.gr") {
            return src.replace(/(\/articles\/[0-9]+\/[^/.]*\.[^/.]*)\.ashx\?.*$/, "$1");
        }

        if (domain_nowww === "murekkephaber.com") {
            return src.replace(/(\/images\/[^/]*\/[0-9]+\/[0-9]+\/[^/]*)_t(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "dienvienvietnam.vn" &&
            src.indexOf("/assets/img/") >= 0) {
            return src.replace(/(_[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_grande$2");
        }

        if (amazon_container === "s3bucketvn") {
            return src.replace(/\/images\/thumbs\/[a-z]+\/([0-9a-f]+\.[^/.]*)$/, "/images/$1");
        }

        if (domain_nosub === "gazeta.ua" &&
            domain.match(/^static[0-9]*\./)) {
            return src.replace(/(\/img2?\/+)[a-z]+\/+([a-z]+\/+[0-9]+\/+[0-9]+(?:_[0-9]+)?)_[^/]*(\.[^/.]*)$/, "$1original/$2$3");
        }

        if (domain_nowww === "gazzettadiparma.it" ||
            domain === "img.liberoquotidiano.it" ||
            domain_nowww === "dundalkdemocrat.ie" ||
            domain_nowww === "liberoquotidiano.it") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/resizer_ext\/[-0-9]+\/[-0-9]+\/[a-z]+\/(http)/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc).replace(/--(\.[^/.]*)$/, "");

            newsrc = src.replace(/\/resizer\/[-0-9]+\/[-0-9]+\/[a-z]+\/([0-9]+\.[^-/.]+)--.*/, "/upload/$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/\/resizer\/[-0-9]+\/[-0-9]+\/[a-z]+\//, "/resizer/-1/-1/false/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "multimidia.correiodopovo.com.br") {
            return src.replace(/(:\/\/[^/]*\/)thumb\.aspx.*?Caminho=([^&]*).*?$/, "$1$2");
        }

        if (domain_nosub === "diziler.com" &&
            domain.match(/^s[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/)img\/[0-9]+x[0-9]+\//, "$1original/");
        }

        if (domain === "g.denik.cz") {
            return src.replace(/_sip-[0-9]+up(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "imperiodefamosas.com") {
            return src.replace(/(:\/\/[^/]*\/)image_cache\.php.*?[?&]file=([^&]*).*?$/, "$1$2");
        }

        if (domain_nowww === "lostfilm.info") {
            return src.replace(/\/images\/[0-9]+photo/, "/images/photo");
        }

        if (domain_nowww === "hinhnenso1.com") {
            return src.replace(/(\/images\/blogs\/[0-9]+\/[0-9]+\/)[a-z]+\//, "$1original/");
        }

        if (domain_nowww === "avatarko.ru") {
            return src.replace(/(:\/\/[^/]*\/img\/)[a-z]+\//, "$1kartinka/");
        }

        if (domain_nowww === "ppe.pl") {
            return src.replace(/(\/upload\/news\/(?:[0-9]+\/){3})[a-z]+_([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "storge.pic2.me") {
            return src.replace(/\/cm?\/[0-9]+x[0-9]+\//, "/upload/");
        }

        if (domain_nowww === "serey.io") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/imageproxy\/[0-9]+x[0-9]+\/(https?:\/\/)/, "$1");
        }

        if (domain === "static.pjmedia.com") {
            return src.replace(/\.sized-[0-9t]+x[0-9t]+x[0-9t]+(\.[^/.]*)$/, "$1");
        }

        if (domain === "file.nxing.cn") {
            return src.replace(/(\/uploads\/uploads\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9a-f]+)-size[0-9]+x[0-9]+(?:_[^/]*)?(\.[^/.]*)$/, "$1$2");
        }

        if (amazon_container === "kateryan" ||
            (domain_nosub === "lookbookspro.com" && domain.match(/assets\.lookbookspro\.com$/))) {
            return src.replace(/\/[a-z]+_/, "/gxxl_");
        }

        if (domain_nowww === "havepussy.com") {
            return src.replace(/\/uploads\/photos\/previews\/([0-9]+_[^/]*)$/, "/0-0/$1");
        }

        if (domain === "news.walkerplus.com") {
            return src.replace(/(\/article\/[0-9]+\/[0-9]+)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.jj20.com") {
            return src.replace(/(\/[0-9A-Z]+-[0-9]+)-[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "i.iplsc.com") {
            return src.replace(/(\/[0-9A-Z]+)-C[0-9]+(?:-F[0-9]+)?(\.[^/.]*)$/, "$1-C0$2");
        }

        if (domain === "s3.viva.pl") {
            return src.replace(/-GALLERY_[0-9]+(\.[^/.]*)$/, "-GALLERY_BIG$1");
        }

        if ((domain_nosub === "vogue.com.tr" && domain.match(/^cdn[0-9]*\./)) ||
            (domain_nosub === "gq.com.tr" && domain.match(/^cdn[0-9]*\./)) ||
            domain === "wr3mii5n.rocketcdn.com" ||
            domain === "voguecdn.blob.core.windows.net") {
            return src.replace(/\/files\/img\/[^/]*\//, "/files/original/");
        }

        if (domain_nosub === "clients-cdnnow.ru" ||
            domain === "s.properm.ru") {
            return src
                .replace(/(\/[a-z]+Storage\/(?:(?:post|news)\/)?(?:[0-9a-f]{2}\/){1,}[0-9a-f]+)_resizedScaled_[0-9]+to[0-9]+(\.[^/.]*)$/, "$1$2")
                .replace(/(:\/\/[^/]*\/)[a-z]+Storage\/+/, "$1originalStorage/");
        }

        if (domain_nowww === "hollywoodtuna.com") {
            return src.replace(/\/images([0-9])\/([^/]*)$/, "/images$1/bigimages$1/$2");
        }

        if (domain_nosub === "soupcdn.com" &&
            domain.match(/^asset-.\./)) {
            return src.replace(/(\/asset\/[0-9]+\/[0-9]+_[0-9a-z]+)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "qqmofasi.com" &&
            domain.match(/^pic[0-9]*\./)) {
            return src.replace(/_crop(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "download-rooz.com") {
            return src.replace(/\/img\/[0-9]+-[0-9]+\//, "/img/");
        }

        if (domain_nowww === "know.cf") {
            return src.replace(/\/imgw\/[0-9]+px\/([^/]*)$/, "/imgw/$1");
        }

        if (amazon_container === "timely-api-public") {
            return src.replace(/(\/timely-api-public[^/]*\/[0-9]+_[0-9a-zA-Z]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "image-share.com") {
            return src.replace(/(\/upload\/[0-9]+\/[0-9]+)m(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "amando.it") {
            return src.replace(/\/imagesdyn\/gallery_plus\/(?:[0-9]+x[0-9]+|orig_[0-9]+)\//,
                               "/imagesdyn/gallery_plus/orig/");
        }

        if (domain_nowww === "textureking.com") {
            return add_extensions_upper(src.replace(/\/content\/img\/stock\/([^/]*)$/, "/content/img/stock/big/$1"));
        }

        if (domain_nowww === "textures.com") {
            if (src.match(/\/system\/gallery\/photos\/[^/]*\/[^/]*\/[0-9]+\/[^/]*$/)) {
                return {
                    url: src.replace(/(\/[0-9]+\/)([^/]*_)(?:download)?[0-9]+(\.[^/.]*)$/, "$1hotlink-ok/$2shared$3"),
                    problems: {
                        watermark: true
                    }
                };
            }
        }

        if ((domain_nosub === "gmbox.ru" ||
             domain_nosub === "vestifinance.ru") &&
            domain.match(/^[a-z][0-9]*\./)) {
            return src.replace(/(\/c\/[0-9]+)\.[0-9]+x[0-9p]+(?:c[0-9]+)?(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "game2day.ru") {
            return src.replace(/\/images\/made\/[0-9a-f]+\/([0-9]+-[0-9]+)_[0-9]+_[0-9]+_(?:s_)?c[0-9]+(\.[^/.]*)$/,
                               "/uploads/userfiles/images/$1$2");
        }

        if (domain_nosub === "nupics.pro" ||
            domain_nowww === "epicsoid.com" ||
            domain_nowww === "xwetpics.com" ||
            domain_nowww === "xsexpics.com" ||
            domain_nowww === "picsninja.club" ||
            domain_nowww === "hotnupics.com" ||
            domain_nowww === "ehotpics.com" ||
            domain_nowww === "picsegg.com" ||
            domain_nowww === "repicsx.com") {
            return src.replace(/(\/pics\/[0-9]+\/)_([^/]*)$/, "$1$2");
        }

        if (domain_nosub === "cloud.it" &&
            domain.match(/^ldm[0-9]*\.r1-it\.storage\./)) {
            return src
                .replace(/(\/img\/.*\/)big\/([0-9]+_[0-9a-f]+\.[0-9]+\.[^/.]*)$/, "$1$2")
                .replace(/(\/(?:av|logo)\/.*\/)thumbs\/([0-9a-f]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "m2ch.hk") {
            return src.replace(/\/big\/thumb(\/[0-9]+\/[0-9]+)s(\.[^/.]*)$/, "/src/$1$2");
        }

        if (domain_nosub === "cfimg.com" &&
            domain.match(/^i[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/[0-9]+\/[0-9a-f]+)s(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "i.chzbgr.com") {
            return src.replace(/\/thumb[0-9]*\//, "/full/");
        }

        if (domain === "img.memecdn.com") {
            return add_full_extensions(src.replace(/(:\/\/[^/]*\/[^/]*_)[a-z]+(_[0-9]+\.[^/.]*)(?:[?#].*)?$/,
                                              "$1o$2"));
        }

        if (domain === "p.memecdn.com") {
            return src.replace(/\/avatars\/+[a-z]+_([0-9]+_[0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "/avatars/$1");
        }

        if (domain_nowww === "mmorpg.org.pl" ||
            domain_nowww === "esportivo.net" ||
            domain_nowww === "pvgroup.ru" ||
            domain_nowww === "leit.is" ||
            domain_nowww === "rovina-project.eu") {
            return src.replace(/(\/system\/(?:post_pictures\/(?:files|assets|pictures)\/|posts\/posters\/|events\/images\/)(?:[0-9]+\/){3})[a-z]+(\/[^/]*)$/, "$1original$2");
        }

        if (domain_nosub === "123rf.com") {
            if (!src.match(/:\/\/[a-z]+cdn\./) &&
                src.match(/:\/\/[^/]*\/(?:images|[0-9]+wm)\//)) {
                var full = src.replace(/:\/\/[^/]*\/[^/]*\//, "://previews.123rf.com/images/");
                var small = src.replace(/:\/\/[^/]*\/[^/]*\//, "://us.123rf.com/450wm/");

                return [
                    {
                        url: full,
                        problems: {
                            watermark: true
                        }
                    },
                    {
                        url: small,
                        problems: {
                            smaller: true
                        }
                    }
                ];
            }
        }

        if (domain_nowww === "chenderroad.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/image\.php.*?[?&]src=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain_nosub === "estranky.cz" ||
            domain_nosub === "estranky.sk") {
            if (domain !== "s3a.estranky.sk") {
                return src
                    .replace(/(:\/\/[^/]*\/img\/)[a-z]+\//, "$1original/")
                    .replace(/(:\/\/[^/]*\/img\/original\/[0-9]+)(\.[^/.]*)/, "$1/image$2");
            }
        }

        if (domain_nowww === "stagelook.ru") {
            return src.replace(/\/images\/tumbs\//, "/images/");
        }

        if (domain === "media.taaze.tw") {
            return src.replace(/\/showProdImageByPK\.html.*?[?&]pid=([0-9]+).*?$/, "/showTakeLook/$1.jpg");
        }

        if (domain === "st.cdjapan.co.jp") {
            return src.replace(/\/pictures\/s\//, "/pictures/l/");
        }

        if (domain === "image.blozoo.info") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/v2\/thumb\/[0-9]+\/[0-9]+\/.*?[?&]url=(http[^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "img.suilengea.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/img\.php.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return add_http(decodeURIComponent(newsrc));
        }

        if (domain === "files.sirclocdn.xyz") {
            return src.replace(/(\/products\/_[0-9]+_[^/._]*)(?:_[a-z]+)?(\.[^/.]*)$/, "$1_ori$2");
        }

        if (domain === "s.tvp.pl") {
            return src.replace(/(\/images2?\/(?:[0-9a-f]\/){3})[-_a-zA-Z0-9]*(uid_[0-9a-f]+)[^/.]*?(\.[^/.]*)$/,"$1$2_width_9999999999999$3");
        }

        if (domain === "sf.be.com") {
            return src.replace(/(\/photo\/[0-9]+\/[0-9a-z]+\/[^/]*-)[a-z][0-9]+(\.[^/.]*)$/, "$1img$2");
        }

        if (domain_nowww === "fitwell.bg") {
            return src.replace(/(\/pictures\/[0-9]+)_[0-9]+_*(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "bilder.bild.de") {
            return src.replace(/\/fotos-skaliert(\/[^/]*\/)([0-9]+),[^/.]*(\.bild\.[^/.]*)$/, "/fotos$1Bild/$2$3");
        }

        if (domain === "galeria.cdn.divany.hu") {
            return src.replace(/(\/[0-9]+_[0-9a-f]+)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.cncenter.cz") {
            return src.replace(/(\/img\/[0-9]+\/)[a-z]+(\/[^/]*)$/, "$1full$2");
        }

        if (domain_nowww === "cosmopolitan.de") {
            return src.replace(/\/bilder\/[0-9]+(?:x[0-9]+)?\//, "/assets/");
        }

        if (domain === "d1o73ibskzeirn.cloudfront.net") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+\/content\//, "$10x0/content/");
        }

        if (domain_nowww === "elle.co.za") {
            return src.replace(/\/uploads\/files\/_[0-9AUTO]+x[0-9AUTO]+[^/]*\//, "/uploads/files/");
        }

        if (domain_nowww === "kartinnay-galerey.ru") {
            return src.replace(/\/uploads\/posts\/news_thumb\//, "/uploads/posts/");
        }

        if (domain_nowww === "imhomir.com") {
            return src.replace(/(\/uploads\/[a-z]+\/preview\/.*)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "mumsnet.com") {
            return src.replace(/(\/uploads\/talk\/[0-9]+\/)[a-z]+-([0-9]+-[^/]*)$/, "$1$2");
        }

        if (domain === "static.stylemagazin.hu") {
            return src.replace(/(\/medias\/[0-9]+\/)[0-9]+x[0-9]+\//, "$1");
        }

        if (domain === "img.thoibao.today") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/home\/fetch.*?[?&]u=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (amazon_container === "photo.elcinema.com") {
            return src.replace(/\/uploads\/_[0-9]+x(?:[0-9]+)?_([0-9a-f]+\.[^/.]*)$/, "/uploads/$1");
        }

        if (domain_nowww === "colors.life") {
            return src.replace(/(\/upload\/blogs\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]+)_RSZ_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "clickatlife.gr" && false) {
        }

        if (domain_nosub === "tnews.ir" && domain.match(/^i[0-9]*\./)) {
            return src.replace(/(\/[0-9]+\/[0-9]+\/[0-9]+\/)Thumbnail\//, "$1");
        }

        if (domain === "multimedia.mmc.com.do") {
            return src.replace(/(\/multimedia\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9a-f]+)_max.?_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "img.europapress.es") {
            return src.replace(/(\/fotoweb\/[a-z]+_(?:[0-9]+-)?[0-9]+)(?:_[0-9]+)?(\.[^/.]*)$/, "$1_9999$2");
        }

        if (domain === "img.estadao.com.br") {
            return src.replace(/\/thumbs\/[0-9]+\/resources\//, "/resources/");
        }

        if (domain_nosub === "asianews.cc" &&
            domain.match(/^s[0-9]*\./)) {
            return src.replace(/(\/[0-9]+\/[0-9a-f]+)_[a-z]+(\.[^/.]*)$/, "$1_orgn$2");
        }

        if (domain_nosub === "wallpapermix.club" ||
            domain_nosub === "wallpaper-planet.com") {
            return src.replace(/(\/doc\/wallpaper\/img\/)[a-z]\//, "$1l/");
        }

        if (domain_nowww === "utaten.com" && src.indexOf("/uploads/images/") >= 0) {
            return src.replace(/_(?:[a-z]|[0-9]+x[0-9]+)(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "frostsnow.com") {
            return add_extensions_with_jpeg(src
                                            .replace(/\/x([^/.]*\.[^/.]*)\.pagespeed\.[^/]*$/, "/$1")
                                            .replace(/\/[0-9]+x[0-9]+\/([^/]*)$/, "/$1"));
        }

        if (domain_nowww === "mewch.net") {
            return src.replace(/\/\.media\/t_([0-9a-f]+-imagejpeg)(?:[?#].*)?$/, "/.media/$1.jpg");
        }

        if (domain === "media.mehrnews.com") {
            return src.replace(/\/old\/[^/]*\/([0-9]+\/)/, "/old/Original/$1");
        }

        if (domain_nowww === "barking-moonbat.com") {
            return src.replace(/(\/images\/uploads\/[^/]*)_thumb(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "deseretnews.com") {
            return src.replace(/\/images\/article\/[a-z]+res\//, "/images/article/hires/");
        }

        if (domain_nowww === "orsm.net") {
            return src.replace(/(\/i\/galleries\/[^/]*\/)thumbnails\//, "$1");
        }

        if (domain_nowww === "niklife.com.ua") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+[A-Z]?\/images\//, "$1images/");
        }

        if (domain === "img.ef43.com.cn") {
            return src.replace(/(\/newsImages\/[0-9]+\/[0-9]+\/[0-9]+)small(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "st.clopotel.t1.ro") {
            return src.replace(/(\/_files\/datafiles\/.*\/)thumbs\/([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "akamaized.net" &&
            domain.match(/^cdn[0-9]*-production-images-kly\./)) {
            return src.replace(/:\/\/[^/]*\/.*?\/kly-media-production\/([a-z]+\/[0-9]+\/)/, "://cdn-production-assets-kly.akamaized.net/$1");
        }

        if (domain === "cdn.xn--cumpleaosdefamosos-t0b.com") {
            return src.replace(/(\/gallery\/[0-9]+\/[0-9]+\/[^/]*\/[^/]*)_thumb(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "up.zhuoku.org" ||
            domain === "up.padtu.com" ||
            domain === "up.8desk.com") {
            return src.replace(/\/pic_[0-9]+\//, "/pic/");
        }

        if (domain_nowww === "apherald.com" && src.indexOf("/ImageStore/images/") >= 0) {
            return src.replace(/\/tn-([^/]*)$/, "/$1");
        }

        if (domain_nowww === "luxo.co.za") {
            return src.replace(/\/system-files\/[a-z]+\//, "/system-files/");
        }

        if (domain_nowww === "longroom.com") {
            return src.replace(/\/uploads\/stock\/[a-z]+_([0-9]+\.[^/.]*)$/, "/uploads/stock/$1");
        }

        if (domain === "img.cdn.cennoticias.com") {
            return src.replace(/:\/\/[^/]*\/([-0-9a-f]+)(?:[?#].*)?$/, "://raw.cdn.cennoticias.com/$1");
        }

        if (domain === "cdn-tehran.wisgoon.com") {

            return src.replace(/\/dlir-s3\/([0-9]+)?[0-9]{3}x[0-9]{3}_([0-9]+\.[^/.]*)$/, "/dlir-s3/$1$2");
        }

        if (domain === "s.stylemode.com") {
            return src.replace(/(\/uploads\/(?:(?:article|blog|album|recommend)(?:_desc|detail)?)\/)(?:[0-9]+x[0-9]+|deal)\//, "$1origin/");
        }

        if (domain_nosub === "akairan.com" && domain.match(/^cdn[0-9]*\./) &&
            src.indexOf("/files/images/") >= 0) {
            return src.replace(/waterM(\.[^/.]*)$/, "$1");
        }

        if (domain === "cdn.idntimes.com" && src.indexOf("/content-images/") >= 0) {
            return src.replace(/_[0-9auto]+x[0-9auto]+(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "comicsblog.fr") {
            return src.replace(/\/images\/galerie\/[a-z]+image\/(?:small_)?/, "/images/galerie/bigimage/");
        }

        if (domain === "ent.sina.com.cn") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/([^/]*\.sinaimg\.cn\/)/, "http://$1");
        }

        if (domain_nowww === "analisadaily.com") {
            return src.replace(/\/assets\/image\/news\/small\//, "/assets/image/news/big/");
        }

        if (domain === "fi.realself.com") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+(\/[0-9a-f]+\/)/, "$1full$2");
        }

        if (domain_nosub === "babeimpact.com" && domain.match(/^content[0-9]*\./)) {
            return src.replace(/_tn(_[0-9]+\.[^/.]*)$/, "$1");
        }

        if (domain === "i.widelec.org") {
            return src.replace(/_[a-z](\.[^/.]*)$/, "$1");
        }

        if (domain === "image.kurier.at") {
            return src.replace(/\/images\/[^/]*(\/[0-9]+\/)/, "/images/original$1");
        }

        if (domain === "media.game8.vn") {
            newsrc = src.replace(/\.[0-9]+\.(?:[0-9]+\.)?cache(?:[?#].*)?$/, "");
            if (newsrc !== src)
                return newsrc;

            if (src.indexOf("/srv_thumb.ashx") >= 0) {
                return urljoin("http://media.game8.vn/", url.searchParams.get("f"), true) + "." + url.searchParams.get("w");
            }
        }

        if (domain_nosub === "xiongyan.tv" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/\/[a-z]+_([0-9a-f]+[0-9A-Za-z]+\.[^/.]*)$/, "/origin_$1");
        }

        if (domain_nowww === "coffelt.me") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/image.*?[?&]q=([^&]*)$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "kiev.segodnya.ua") {
            return src.replace(/(\/img\/gallery\/[0-9]+\/[0-9]+\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1_main$2");
        }

        if (domain === "image.jjang0u.service.concdn.com" ||
            (domain_nowww === "metartdb.com" && src.indexOf("/images/galleries/") >= 0)) {
            return src.replace(/\/t_([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "fotoshoots.be") {
            return src.replace(/(\/images\/fotografen\/[0-9]+\/)thumbs\//, "$1");
        }

        if (domain_nosub === "tapatalk.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/groups\/[^/]*\/imageproxy\.php.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "dl.backbook.me") {
            return src.replace(/(:\/\/[^/]*\/)[a-z_]+(\/[0-9a-f]+\.[^/.]*)$/, "$1full$2");
        }

        if (domain === "nthumb.cyworld.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/thumb.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain === "e.porosenka.net") {
            return src.replace(/(\/uploads\/[0-9a-f]\/[0-9a-f]+\/[0-9a-f]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if ((domain_nosub === "qhimg.com" ||
             domain_nosub === "qhmsg.com") &&
            domain.match(/^p[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/+)[a-z]+\/+[0-9]+_[0-9]+_\/+/, "$1");
        }

        if (domain_nosub === "gamersky.com" && domain.match(/^img[0-9]*\./)) {
            return src
                .replace(/(\/upimg\/pic\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2")
                .replace(/(\/upimg\/users\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/)[a-z]+_([^/]*)$/, "$1origin_$2");
        }

        if (domain_nosub === "game234.com" && domain.match(/^webimg[0-9]*\./)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/([a-z]+:\/\/)/, "$1");
        }

        if (domain === "cdn.snsimg.carview.co.jp") {
            return src.replace(/(\/blog\/(?:[0-9]+\/){5}[^/]*)[sm](\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "wallpapersontheweb.net") {
            regex = /\/wallpapers\/[a-z]\/(?:(?:[0-9]+x[0-9]+)?\/)?(?:(?:[a-z]|[0-9]+x[0-9]+)-)?([^/]*)-([0-9]+)(\.[^/.]*)$/;
            return {
                url: src.replace(regex, "/wallpapers/l/$1-$2$3"),
                headers: {
                    Referer: src.replace(regex, "/$2-$1/")
                }
            };
        }

        if (domain_nosub === "funon.cc" && domain.match(/^s[0-9]*\./)) {
            return src.replace(/(\/img\/)[a-z]+(\/[0-9]+\/)/, "$1orig$2");
        }

        if (domain === "img.joemonster.org") {
            return src.replace(/(\/upload\/[^/]*\/)[a-z]_([0-9a-f]+[0-9a-z]+\.[^/.]*)$/, "$1$2");
        }

        if (domain === "mobimg.b-cdn.net") {
            return src.replace(/\/pic\/v2\/gallery\/[^/]*\//, "/pic/v2/gallery/real/");
        }

        if (domain === "img.wanduorou.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/imgs\/([^/.]*\.[^/]*\/)/, "http://$1");
        }

        if (domain === "i.gbc.tw") {
            return src.replace(/(\/gb_img\/[0-9]+)[a-z](\.[^/.]*)$/, "$1$2");
        }

        if ((domain_nosub === "xuehuaimg.com" && domain.match(/^pic[0-9]*\./)) ||
            (domain_nosub === "11street.my" && domain.match(/^cdn[0-9]*\./))) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/proxy\/([a-z]+:\/\/)/, "$1");
        }

        if (domain === "img.tgchengzi.com") {
            return src.replace(/(\/Uploads\/ueditor\/php\/upload\/image\/[0-9]+\/[0-9]+)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain_nosub === "doyo.cn" &&
            domain.match(/^s[0-9]*\./)) {
            return src.replace(/(\/img\/(?:[0-9a-f]{2}\/){2}[0-9a-f]+\.[^/._]*)_[a-z]+(?:[?#].*)?$/, "$1");
        }

        if (domain === "newsimg.hankookilbo.com" ||
            domain === "betaimage.hankookilbo.com") {
            return src.replace(/(\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/(?:[0-9]+_[0-9]+|[-0-9a-f]+))_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (domain === "dispatch.cdnser.be") {
            return src.replace(/(\/[0-9]+[^-/_.]*_)T[0-9]*(_[0-9]+\.[^/.]*)$/, "$1T5$2");
        }

        if (domain === "cms.artandarchaeology.princeton.edu") {
            return src.replace(/\/media\/thumbnails\/([^/?]*)\?.*$/, "/media/files/$1");
        }

        if (domain_nowww === "pronto.com.ar") {
            return src.replace(/\/asset\/thumbnail[,%][^/]*\/media\//, "/media/");
        }

        if (domain === "cdn.thebest.gr") {
            return src.replace(/\/media\/images\/[^/]*\//, "/media/images/original/");
        }

        if (domain_nowww === "glow.gr" ||
            domain === "omegalive-sf.cdn.edgeport.net" ||
            domain_nowww === "omegalive.com.cy") {
            return src.replace(/(:\/\/[^/]*\/)(?:image|[a-z]+-img)\/+[^/]+(\/+[0-9]+\/+[^/]*\.[^/.?#]*)(?:[?#].*)?$/,
                               "$1image/original$2");
        }

        if (domain_nowww === "scifi-forum.de" ||
            domain_nowww === "phica.net") {
            return src.replace(/\/filedata\/fetch.*?[?&](id=[0-9]+).*?$/, "/filedata/fetch?$1");
        }

        if (domain === "cache.net-a-porter.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/content\/images\/(story-[^/]*\.[^/.]*)\/[^/]*$/, "https://assets.ynap-content.com/$1");
        }

        if (domain_nowww === "celluloidportraits.com" && src.indexOf("/img/") >= 0) {
            return src.replace(/(_[0-9]+_)[A-Z](\.[^/.]*)$/, "$1L$2");
        }

        if (domain_nowww === "nowtoronto.com") {
            return src.replace(/(\/downloads\/[0-9]+\/download\/[^/?#]*)(?:.*?[?&](cb=[0-9a-f]+).*?)?$/, "$1?$2");
        }

        if (domain === "cde.peru.com") {
            return src.replace(/(\/ima\/(?:[0-9]\/){5}(?:[0-9]+\/)?)(?:[0-9]+x[0-9]+|thumb)\/([^/]*)$/, "$1$2");
        }

        if (domain === "cd.cinescape.com.pe") {
            match = src.match(/^[a-z]+:\/\/[^/]*\/cinescape-[0-9]+x[0-9]+-([0-9]+)(\.[^/.]*)(?:[?#].*)?$/);
            if (match) {
                var digits = match[1].replace(/[0-9]{3}$/, "");
                let length = digits.length;
                for (i = length; i < 5; i++) {
                    digits = "0" + digits;
                }
                return "http://e.cinescape.americadigital.pe/ima/"
                    + digits[0] + "/" + digits[1] + "/" + digits[2] + "/" + digits[3] + "/" + digits[4] + "/" + match[1] + match[2];
            }
        }

        if (domain_nowww === "celebritytalent.net") {
            return src.replace(/\/photos\/[a-z]+\/([0-9]+\.[^/.]*)$/, "/photos/lg/$1");
        }

        if (domain === "img-ovh-cloud.zszywka.pl") {
            return src.replace(/\/thb_([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain_nosub === "clickthecity.com" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/\/profiles\/[0-9]+(\/[0-9]+(?:_[0-9]+)?\.[^/.]*)$/, "/profiles$1");
        }

        if (domain_nowww === "lafactoriadelshow.com") {
            return src.replace(/\/[a-z]+_([0-9a-f]+_[0-9]+\.[^/.]*)$/, "/full_$1");
        }

        if (domain_nowww === "elintra.com.ar" ||
            domain_nowww === "elintransigente.com") {
            return src.replace(/\/fotografias\/m\/([0-9]{4}\/[0-9]+\/[0-9]+\/)f[0-9]+x[0-9]+-([0-9]+)_[0-9]+[^/]*(\.[^/.]*)$/,
                               "/fotografias/fotosnoticias/$1$2$3");
        }

        if (domain === "f.aukro.cz") {
            return src.replace(/(\/images\/[^/]*\/)[0-9]+x[0-9]+\/([-0-9a-f]+)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "wallpapershome.com" ||
            domain_nowww === "wallpapershome.ru" && false) {
        }

        if (domain === "envivoblog.estrellatv.com") {
            return src.replace(/\/_resampled\/Set(?:Width|Height)[0-9]+-([^/]*)$/, "/$1");
        }

        if (domain === "images.sex.com") {
            return src.replace(/(\/images\/pinporn\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/)(?:300|460)\//, "$1620/");
        }

        if (domain === "fotografias.antena3.com" ||
            domain === "image.europafm.com" ||
            src.match(/^[a-z]+:\/\/[^/]*\/clipping\/cmsimages[0-9]*\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[-0-9A-F]+\/[^/]*\.[^/.]*$/)) {
            newsrc = src.replace(/(\/clipping\/cmsimages[0-9]*\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[-0-9A-F]+\/)[^/]*(\.[^/.]*)$/,
                                 "$1default$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain_nosub === "nickiswift.com" && domain.match(/^img[0-9]*\./)) {
            return src.replace(/-[0-9]+x[0-9]+(?:_rev[0-9]*)?(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "marieclaire.ru" && false) {
            return src.replace(/\/images\/th\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\/(([0-9]+)@([0-9]+)@[0-9a-f]+)-[^/.]*(\.[^/.?#]*)(?:[?#].*)?$/,
                               "/images/$2/$3/$1$4");
        }

        if (amazon_container === "sphm-female-site-production") {
            return src.replace(/-[0-9]+px(\.[^/.]*)$/, "$1");
        }

        if (domain_nowww === "maxpapendieck.com") {
            return src.replace(/(\/app\/webroot\/upload\/[0-9]+\/[^/]*)-(?:large|medium|thumb)(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "i.mdel.net") {
            return src.replace(/(\/i\/db\/[0-9]+\/[0-9]+\/[0-9]+\/[0-9]+)-[0-9]+[a-z]n?(\.[^/.]*)$/, "$1-orig$2");
        }

        if (domain === "cdn-img.fimfiction.net") {
            return src
                .replace(/(\/story\/[^-/]*-[0-9]+-[0-9]+-)[a-z]+([?#].*)?$/, "$1full$2")
                .replace(/(\/user\/[^-/]*-[0-9]+-[0-9]+-)[0-9]+([?#].*)?$/, "$1512$2");
        }

        if (domain_nosub === "tv-happening.com" && domain.match(/^img(?:-[a-z]+)?[0-9]*\./)) {
            return src.replace(/\/[a-z]\/([0-9]+\.[^/.]*)$/, "/b/$1");
        }

        if (domain_nowww === "kbbs.jp" ||
            domain_nowww === "ibbs.info") {
            return src.replace(/\/fitimg\/cache\/([^/]*)\/[0-9]+\/[^/_.]*_([^/]*)(?:[?#].*)?$/, "/data/$1/img/$2");
        }

        if (domain_nowww === "pzy.be") {
            return src.replace(/(:\/\/[^/]*\/)t(\/[0-9]+\/[^/]*)$/, "$1i$2");
        }

        if ((domain_nosub === "blick.ch" && domain.match(/^f[0-9]*\./)) ||
            domain === "static.pulse.ng" ||
            domain === "static.pulselive.co.ke" ||
            domain === "static.pulse.com.gh") {
            return src.replace(/\/img\/[a-z]+\/(?:origs|crop)([0-9]*)\/[0-9]+(?:-[^/]*)?\/([^/?#]*\.[^/.?#]*)(?:[?#].*)?$/,
                               "/media/$1/$2");
        }

        if (domain === "img.blick.ch") {
            return src.replace(/\?.*/, "?ratio=FREE");
        }

        if (domain_nowww === "mixnews.lv") {
            return src.replace(/(\/uploads\/media\/image\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^/]*)_medium\.png(?:[?#].*)?$/,
                               "$1.jpg");
        }

        if (domain_nosub === "promiflash.de" &&
            domain.match(/^content[0-9]*\./)) {
            return src.replace(/\/article-images\/gallery1024\//, "/article-images/gallery2048/");
        }

        if (domain_nowww === "mycharm.ru") {
            return src.replace(/(\/data\/cache\/[0-9]{4}[a-z]+\/.*)thumb[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "images.worthpoint.com") {
            return src.replace(/(\/files\/[^/]*\/)tn\//, "$1");
        }

        if (domain_nowww === "benishop.co" ||
            domain === "cdn.benishop.co" ||
            domain_nowww === "awanshop.co") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/imgcdn\/[0-9]+\/([a-z]+)\/(.*)_\.[^/.]*$/, "$1://$2");
        }

        if (domain === "img.auctiva.com") {
            return src.replace(/(\/[0-9]+_)[a-z]+(\.[^/.]*)$/, "$1o$2");
        }

        if (domain === "img.networthpost.com") {
            return src.replace(/\/thumbs\/([0-9]+_)/, "/images/$1");
        }

        if (domain === "img.static.butygirls.com") {
            return src.replace(/\/resize\/[0-9]+\/[0-9]+\/[0-9]+(\/[0-9a-f]+\.[^/.]*)$/, "$1");
        }

        if (domain === "coubsecure-s.akamaihd.net") {
            return src.replace(/\/[a-z]+_([0-9]+_image\.[^/.]*)$/, "/$1");
        }

        if (domain_nowww === "wallpapersmug.com" ||
            domain_nowww === "picstatio.com") {
            return src.replace(/\/(?:download\/+[0-9]+x[0-9]+|(?:thumb|large))\/+([-0-9a-z]+\/+[^/]*)(?:[?#].*)?$/, "/u/$1");
        }

        if (domain === "cp12.nevsepic.com.ua") {
            return src.replace(/(\/[0-9]+\/)thumbs\/([0-9]+-[0-9]+-[^/]*)$/, "$1$2");
        }

        if (domain === "itn.dmarge.com") {
            return src.replace(/:\/\/[^/]*\/[0-9]+x[0-9]+\//, "://i.dmarge.com/");
        }

        if (domain_nosub === "idnes.cz" && domain.match(/^img[0-9]*\./)) {
            return src.replace(/\/thumb\//, "/images/");
        }

        if (domain_nowww === "funsubstance.com") {
            return src.replace(/\/uploads\/[a-z]+\//, "/uploads/original/");
        }

        if (domain === "global.unitednations.entermediadb.net") {
            return src.replace(/\/image[0-9]+x[0-9]+(?:cropped)?(\.[^/.]*)$/, "/image$1");
        }

        if (domain === "rimg.bookwalker.jp") {
            return src.replace(/:\/\/[^/]*\/([0-9]+)\/[0-9a-zA-Z_]+(\.[^/.]*)$/, "://c.bookwalker.jp/$1/t_700x780$2");
        }

        if (domain === "c.bookwalker.jp") {
            match = src.match(/:\/\/[^/]*\/([0-9]+)\/[^/]*(?:[?#].*)?$/);
            if (match) {
                var number = match[1];
                var reversed_number = parseInt(number.split("").reverse().join("")) - 1;
                return "https://c.bookwalker.jp/coverImage_" + reversed_number + src.replace(/.*(\.[^/.?#]*)(?:[?#].*)?$/, "$1");
            }
        }

        if (domain === "images.cdn.circlesix.co") {
            return src.replace(/\/image\/(?:[0-9]+\/){3}uploads\//, "/image/uploads/");
        }

        if (domain === "static.japanhdv.com") {
            return src.replace(/(:\/\/[^/]*\/)cache\/(.*)\.[0-9]+x[0-9]+(\.[^/.]*)$/, "$1$2$3");
        }

        if (domain === "mosaic.tnaflix.com") {
            return src.replace(/(\/[0-9a-z]+):[0-9a-z]+(\/|\.[^/.]*)/, "$1$2");
        }

        if (domain_nosub === "tnastatic.com" && domain.match(/^img[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/)[^/]*\/(pics|thumbs)\//, "$1q100/$2/");
        }

        if (domain === "image.gala.de") {
            return src.replace(/(:\/\/[^/]*\/v[0-9]*\/cms\/[^/]*\/[^/]*_[0-9]+-)[a-z]+[-_][^/]*(\.[^/.]*)$/, "$1original-lightbox$2");
        }

        if (domain_nosub === "fashionwelike.com" &&
            domain.match(/^static[0-9]*\./)) {
            return src.replace(/\/photos\/thumbnail\//, "/photos/original/");
        }

        if (domain === "images.metmuseum.org") {
            return src.replace(/(\/CRDImages\/+[^/]*\/+)[^/]*\/+/, "$1original/");
        }

        if (domain === "images-assets.nasa.gov") {
            return src.replace(/~[a-z]+(\.[^/.]*)$/, "~orig$1");
        }

        if (amazon_container === "attachments.readmedia.com") {
            return src.replace(/(\/+files\/+[0-9]+\/+)[a-z]+\/+([^/]*)(?:[?#].*)?$/, "$1original/$2");
        }

        if (domain === "files.sexyandfunny.com") {
            return src.replace(/\/(?:img|gallery)_[a-z]+\//, "/img_orig/");
        }

        if (domain === "mb.cision.com") {
            return src.replace(/(\/Public\/+[0-9]+\/+[0-9]+\/+[0-9a-f]+)_[^/_]*(\.[^/.]*)$/, "$1_org$2");
        }

        if (domain_nowww === "ftvmagic.com") {
            return src
                .replace(/(\/+grand-media\/+image\/+)thumb\//, "$1")
                .replace(/-[0-9]+x[0-9]+(\.[^/.]*)$/, "$1")
                .replace(/(\/post_pics\/+[0-9]+\/+[0-9]+\/+[0-9]+)_thumb(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "wdb.space" ||
            domain_nowww === "onlythere.com") {
            return src.replace(/(\/media\/[^/]*\/[^/]*)_scale_[0-9]+x[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "iphone8wallpapers.com" && src.indexOf("/media/uploads/") >= 0) {
            return {
                url: src.replace(/-[0-9]+x[0-9]+(\.[^/.]*)$/, "$1"),
                headers: {
                    Referer: src.replace(/(:\/\/[^/]*\/).*/, "$1") // works without, but adds a "click here full resolution, no hotlinking" watermark
                }
            };
        }

        if (domain === "upload.sanqin.com") {
            return src.replace(/\/thumb_[0-9]+__([^/]*)(?:[?#]*.*)?$/, "/$1");
        }

        if (domain_nosub === "best-wallpaper.net" && src.indexOf("/wallpaper/") >= 0 &&
            options && options.do_request && options.cb) {
            match = src.match(/\/wallpaper\/+[^/]+\/[0-9]+\/([^/]*)_[^-_/.]+\.[^/.]*$/);
            if (match) {
                options.do_request({
                    url: "https://best-wallpaper.net/" + match[1] + "_wallpapers.html",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            if (resp.status !== 200) {
                                console_log(result);
                                options.cb(null);
                                return;
                            }

                            var match = resp.responseText.match(/<img ID="viewImg"[^>]*data-src="([^">]*)"/);
                            if (match) {
                                options.cb(urljoin(src, match[1], true));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nosub === "trueart.com" &&
            domain.match(/^s[0-9]*\./)) {
            return src.replace(/(\/[0-9]+)_[0-9]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "atkfan.com") {
            return src.replace(/\/thumbs(\/[^/]*)_[0-9]+(\.[^/.]*)$/, "/set$1$2");
        }

        if (domain === "imbbsfile.imbc.com") {
            return src.replace(/\/thnb_([^/]*\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nowww === "hdwall.us") {
            return {
                url: src.replace(/(:\/\/[^/]*\/+)(?:wallpaper|thumbnail)[^/]*\/+([^/]*\.[^/.]*)(?:[?#].*)?$/, "$1wallpaper/$2"),
                problems: {
                    watermark: true
                }
            };
        }

        if (domain === "thmbs.baklol.com") {
            return src.replace(/:\/\/thmbs\./, "://images.");
        }

        if (domain_nowww === "svtstatic.se") {
            return {
                url: src.replace(/\/image\/+[^/]*\/+[^/]*\/+([0-9]+\/+[0-9]+)(?:\.[^/?#]*)?(?:[?#].*)?$/,
                                 "/image/original/unscaled/$1.png"),
                head_wrong_contentlength: true
            };
        }

        if (domain === "thmb.inkfrog.com" ||
            amazon_container === "thmb.inkfrog.com") {
            return src
                .replace(/^[a-z]+:\/\/.*\/+thumb[^/]*\/+([^/]*\/+[^/]*\.[^/.=]*)(?:=[0-9]+)?(?:[?#].*)?$/,
                         "https://imgs.inkfrog.com/pix/$1")
                .replace(/^[a-z]+:\/\/.*\/+pix\/+([^/]*\/+[^/]*\.[^/.]*)\/+[0-9]+\/+[0-9]+(?:[?#].*)?$/,
                         "https://imgs.inkfrog.com/pix/$1");
        }

        if (domain_nosub === "xnostars.com" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/(\/fotos\/+[^/]*)\/+thumbs\/+/, "$1/");
        }

        if (domain_nowww === "mobilmusic.ru") {
            return src.replace(/(\/mfile\/+[0-9a-f]{2}\/+[0-9a-f]{2}\/+[0-9a-f]{2}\/+[0-9]+)-[0-9]+(\.[^/.]*)$/,
                               "$1$2");
        }

        if (domain === "pics.definebabe.com") {
            return src.replace(/\/thumbs\/+thumb_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nosub === "definebabe.com" &&
            domain.match(/^cdn-i[0-9]+\./)) {
            return src.replace(/(\/+[0-9a-f]+\/+)[a-z]?[0-9]+\/+([0-9]+\.[^/.]*)$/, "$1$2");
        }

        if (amazon_container === "everipedia-storage") {
            return add_extensions_upper(src.replace(/(\/NewlinkFiles\/+[0-9]+\/+(?:[^/]*\/+)?[^/]+)_[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2"));
        }

        if (domain_nowww === "w-dog.net") {
            return src.replace(/(\/wallpapers\/+[0-9]+\/+[0-9]+\/+)[a-z]+(\/[0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "wsimg.com" &&
            domain.match(/^img[0-9]*\.wsimg\.com/)) {
            return src.replace(/(\/+isteam\/+ip\/+[-0-9a-f]+\/+[^/]*\.[^/.]*)(?:\/+:\/+.*)?(?:[?#].*)?$/, "$1");
        }

        if (domain === "img.lovpho.com") {
            return src.replace(/\/+anh\/+(?:width|height)[0-9]+\//, "/anh/");
        }

        if (domain_nowww === "divnil.com") {
            return src.replace(/(\/wallpaper\/.*_[0-9a-f]+_)[a-z]+(\.[^/.]*)$/, "$1raw$2");
        }

        if (domain === "images.dbnaked.com") {
            return src.replace(/\/thumb_(?:[0-9]+x[0-9]+_)?([0-9]+\.[^/.]*)$/, "/$1");
        }

        if (domain === "img.iseephoto.com") {
            return src.replace(/(\/+files\/+[^/]*\/+)thumes\/+/, "$1");
        }

        if (domain === "media.elle.gr") {

            return src.replace(/.*\/engine\/[^/]*?_([0-9]+)_([0-9]+)(?:_type[0-9]+)?\.[^/.]*(?:[?#].*)?$/,
                               "http://engine.numatek.netuse.gr/?imgid=$2&srcid=$1&type=2");
        }

        if (domain === "engine.numatek.netuse.gr") {
            var imgid = url.searchParams.get("imgid");
            var srcid = url.searchParams.get("srcid");
            if (imgid && srcid) {
                return "http://engine.numatek.netuse.gr/?imgid=" + imgid + "&srcid=" + srcid + "&type=2";
            }
        }

        if (domain === "actualite.benchmark.fr") {
            return src.replace(/_diaporama_[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "showstudio.com") {
            return src.replace(/(\/+img\/+images\/+[0-9]+-[0-9]+\/+[0-9]+)_[^/]*(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "static.trendme.net") {
            newsrc = src.replace(/\/showThumb\.php.*?[?&]src=([^&]*).*?$/, "/showThumb.php?src=$1&h=99999999&height=99999999&zc=3");
            if (newsrc !== src)
                return newsrc;

            return src
                .replace(/\/+temp\/+thumbs\/+[0-9]+-[0-9]+-[0-9]+-[0-9]+\/+/, "/pictures/items/")
                .replace(/\/showThumb\.php.*?[?&]src=([^&]*).*?$/, "/pictures/items/$1");
        }

        if (domain_nowww === "ifairer.com") {
            return src.replace(/\/+article_image\/+[a-z]+[0-9]+\/+/, "/article_image/");
        }

        if (amazon_container === "khaskhabar") {
            return src.replace(/\/+khaskhabarimages\/+[a-z]+img\/+img[0-9]+\/+/, "/khaskhabarimages/img500/");
        }

        if (domain === "i.infospesial.net") {
            return src.replace(/:\/\/[^/]*\/+[0-9]+x(?:[0-9]+)?\/+p\/+/, "://media.infospesial.net/image/p/");
        }

        if (domain === "nik.bot.nu") {
            return src.replace(/(:\/\/[^/]*\/+)[a-z]([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1o$2");
        }

        if (domain_nosub === "eyeem.com" &&
            domain.match(/^cdn[0-9]*\./)) {
            return {
                url: src.replace(/(\/+thumb\/+[0-9a-f]+-[0-9]+\/+).*$/, "$1full"),
                problems: {
                    watermark: true
                }
            };
        }

        if (domain === "3c1703fe8d.site.internapcdn.net") {
            newsrc = src.replace(/\/newman\/+[a-z]+\/+([^/]*)\/+[^/]*\/+([0-9]{4}\/+[^/]*)(?:[?#].*)?$/, "/newman/gfx/$1/$2");
            if (newsrc !== src)
                return newsrc;

            return newsrc.replace(/\/+newman\/+gfx\/+([^/]*)\/+([0-9]{4}\/+[^/]*)(?:[?#].*)?$/,
                                  "/newman/gfx/$1/hires/$2");
        }

        if (domain_nowww === "sott.net") {
            return src.replace(/(\/+image\/+s[0-9]+\/+[0-9]+\/+)[a-z]+\//, "$1full/");
        }

        if (domain_nowww === "fimgs.net") {
            return src.replace(/\/(?:images|mdimg)\/+([^/]*)\/+[^/.]*\.([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "/images/$1/o.$2");
        }

        if ((domain_nosub === "ndsstatic.com" ||
             domain_nosub === "gentside.co.uk") &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/+)article\/+[0-9]+\/+/, "$1article/");
        }

        if (domain_nowww === "stickpng.com") {
            return src.replace(/\/+assets\/+[a-z]+\/+([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/,
                               "/assets/images/$1");
        }

        if (domain === "media.bizj.us") {
            return src.replace(/(\/view\/img\/[0-9]+\/[^/*]*)\*[^/.]*(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "assets.becomegorgeous.com") {
            return src.replace(/:\/\/[^/]*\/+assets\/+(static\.becomegorgeous\.com\/)/, "://$1");
        }

        if (domain === "static.becomegorgeous.com") {
            return src.replace(/\/+gallery\/+thumbs\/+thumb_/, "/gallery/pictures/");
        }

        if (domain_nowww === "styleslum.com") {
            return src.replace(/\/+main_image_thumbs\/+([^/]*\.[^/.]*)\.thumb_[^/.]*\.[^/.]*(?:[?#].*)?$/, "/main_image/$1");
        }

        if (domain_nowww === "sideshowtoy.com") {
            return src.replace(/(\/+assets\/+products\/+[0-9]+-[^/]*\/+)[a-z]+\/+/, "$1lg/");
        }

        if (domain === "cdn.suwalls.com" &&
            options && options.cb && options.do_request) {
            newsrc = src.replace(/\/+_media\/+users_[0-9]+x[0-9]+\/+/, "/_media/users/");
            if (newsrc !== src)
                return newsrc;

            id = src.replace(/.*\/+wallpapers\/+([^/]+\/+[^/]*-[0-9]+)-[0-9]+x[0-9]+\.[^/.]*(?:[?#].*)?$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "https://suwalls.com/" + id + "/",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<a[^>]* href="(https?:\/\/cdn\.suwalls\.com\/+wallpapers\/+[^">]*)"[^>]*>\s*<img/);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "japanator.com") {
            return src.replace(/(\/+ul\/+[0-9]+-\/+[0-9]+)-[0-9]+x(?:[0-9]+)?(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "cs.mg.co.za") {
            return src.replace(/\/+crop\/+(content\/+images\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[^/]*\.[^/.]*)\/+[0-9]+x[0-9]+\/*(?:[?#].*)?$/,
                               "/$1");
        }

        if (domain_nowww === "drytickets.com.au") {
            return src.replace(/\/+assets\/+upload\/+[0-9]+\/+[0-9]+\/+[0-9]+\/+/, "/assets/upload/");
        }

        if (domain_nowww === "filmibeat.com") {
            newsrc = src
                .replace(/\/ph-[^/]*\/+/, "/ph-big/")
                .replace(/\/+imgh\/+[0-9]+x[0-9]+\/+/, "/ph-big/")
                .replace(/\/img\/+[0-9]+x[0-9]+(?:x[0-9]*)?\//, "/img/");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "g.ahan.in") {
            return src.replace(/\/+thumbnails\/+([^/]*\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nowww === "behindwoods.com") {
            newsrc = src.replace(/\/+thumbnails\/+([^/]*\.[^/.]*)(?:[?#].*)?$/, "/$1");
            if (newsrc !== src) {
                return {
                    url: newsrc,
                    problems: {
                        watermark: true
                    }
                };
            }
        }

        if (domain === "gallery.123telugu.com") {
            return src.replace(/\/+thumbs\/+tn_([^/]*)(?:[?#].*)?$/, "/images/$1");
        }

        if (domain === "images.gludy.com") {
            return src.replace(/(\/+photos\/+[0-9]+\/+[^/]*)_[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "static.az-cdn.ch") {
            return src.replace(/\/n-[^/]*(?:[?#].*)?$/, "/teaser-goldbach");
        }

        if (domain === "resizer.elnortedecastilla.es" ||
            domain === "resizer.ideal.es" ||
            domain === "resizer.nortecastilla.es") {

            if (false) {
                return {
                    url: src.replace(/\/+resizer\.php.*?[?&](imagen=[^&]*).*/, "/resizer.php?$1"),
                    head_wrong_contentlength: true
                };
            } else {
                return src
                    .replace(/:\/\/[^/]*\/+resizer\/+resizer\.php.*?[?&]imagen=\/+deliverty\/+[^/]*\/resources\/+([^&]*).*/, "://foto-cache.elnortedecastilla.es/$1")
                    .replace(/^[a-z]+:\/\/[^/]*\/+resizer\/+resizer\.php.*?[?&]imagen=(http[^&]*).*/, "$1");
            }
        }

        if (domain_nowww === "starchive.ru") {
            return src.replace(/\/+thumbnails_foto\/+thumb_/, "/foto/");
        }

        if (domain === "pre.aichi.jp") {
            return src.replace(/\/+archive\/+storage\/+thumb\/+/, "/archive/storage/");
        }

        if (domain === "img.kaikai.ch") {
            return src.replace(/\/thumb(?:_[a-z]+)\//, "/img/");
        }

        if (domain_nowww === "4fzone.com") {
            return src.replace(/(\/+uploads\/+images\/+clip_[0-9]+_[0-9]+)_[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1_poster$2");
        }

        if ((domain_nosub === "s1sf.com" ||
             domain_nosub === "isanook.com") &&
             domain.match(/^(?:s|p[0-9]+)\./)) {
            return src.replace(/\/+rp\/+r\/+[wh][0-9]+\/+/, "/rp/r/w9999999/");
        }

        if (domain_nosub === "caping.co.id" &&
            domain.match(/^image[0-9]*\./)) {
            return src.replace(/(\.[^/._]+)_[0-9A-Z]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "zozchat.com") {
            return src.replace(/\/+thumb-news\/+[0-9]+\/+[0-9]+\/+/, "/images/uploads/images/");
        }

        if (domain === "media.tintuc.vn") {
            return src.replace(/(\/+uploads\/+medias\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+)[0-9]+x[0-9]+\//, "$1");
        }

        if (domain_nosub === "gigacircle.com") {
            return src.replace(/\/+media\/+[0-9]+x[0-9]+_/, "/media/");
        }

        if (domain_nowww === "ckywf.com") {
            return {
                url: src.replace(/(\/+data\/+[^/]*\/+[0-9]{4}\/+[0-9]{2}\/[0-9a-f]+)_thumb(\.[^/.]*)$/, "$1$2"),
                head_wrong_contenttype: true
            };
        }

        if (domain_nowww === "hao.news") {
            return src.replace(/(\/+Uploads\/+Picture\/+[0-9]{4}-[0-9]{2}-[0-9]{2}\/+[0-9a-f]+)_[0-9]+_[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "img.joinfo.ua") {
            return src.replace(/(\/+g\/+[0-9]{4}\/+[0-9]{2}\/+)[0-9]+x[0-9]+\/+/, "$1");
        }

        if (domain === "imgtt.hebeilong.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/+img\.php\?(http.*)$/, "$1");
        }

        if (domain === "cdn.blogimage2.crooz.jp") {
            return src.replace(/\/smp_thum_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nosub === "lockerdome.com" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/(\/+uploads\/+[0-9a-f]+)_[a-z]+(?:[?#].*)?$/, "$1_facebook");
        }

        if (domain === "images.headlines.pw") {
            return src.replace(/(\/[0-9a-f]+)_[0-9]+_[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "harianbernas.com") {
            return src.replace(/\/image_news_[0-9]+\//, "/image_news/");
        }

        if (domain === "static.weloveshopping.com") {
            return src.replace(/(\/[^/_.]*)_[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "heykorean.com" &&
            domain.match(/^store[0-9]*\./)) {
            return src.replace(/(\/+board\/+[0-9]+\/+[0-9]+\/+)thumb\//, "$1");
        }

        if (domain === "searx.info") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]+\/+image_proxy.*?[?&]url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain_nosub === "nocutnews.co.kr" &&
            domain.match(/^file[0-9]*\./)) {
            return src.replace(/(\/[0-9]+)_preview(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "flixcart.com") {
            return src.replace(/(:\/\/[^/]*\/+image)\/+[0-9]+\/+[0-9]+\/+([0-9a-z]+\/+(?:[^/]*\/+)?.\/+.\/+.\/+[^/]*\.[^/.?]*)(?:[?#].*)?$/, "$1/$2");
        }

        if (domain === "conteudo.imguol.com.br") {
            return src.replace(/(\/[^/]*\.[^/.?#]*)x(?:[?#].*)?$/, "$1");
        }

        if (domain === "media.vandal.net") {
            return src.replace(/\/i\/[0-9]+x[0-9]+\//, "/i/99999999999x99999999999/");
        }

        if (domain === "images.gog.com") {
            return src.replace(/(:\/\/[^/]*\/+[0-9a-f]+)_[^/]*(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "imx.to") {
            return src
                .replace(/:\/\/[^/]*\/u\/t\//, "://t.imx.to/t/")
                .replace(/:\/\/[^/]*\/upload\/+[a-z]+\/+/, "://x001.imx.to/i/");
        }

        if (domain === "t.imx.to") {
            return src.replace(/:\/\/[^/]*\/t\//, "://i.imx.to/i/");
        }

        if (domain_nosub === "imx.to" &&
            domain.match(/^x[0-9]+\./)) {
            return src.replace(/(:\/\/[^/]*\/)t\//, "$1i/");
        }

        if (domain_nowww === "sisajb.com") {
            newsrc = src.replace(/\/data\/newsThumb\/([0-9]+&&).*/, "/data/newsData/$1.jpg");
            if (newsrc !== src)
                return add_extensions_upper(newsrc);
        }

        if (domain === "assets.cdn.moviepilot.de") {
            return src.replace(/(\/+files\/+[0-9a-f]+)\/+limit\/+[0-9]+\/+[0-9]+\/+/, "$1/");
        }

        if (domain === "img.xuehi.cn") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/+(?:[^/]*\/+){3}([^/]*%2F.*?)![0-9]+[^/]*(?:[?#].*)?$/, "$1");
            if (newsrc !== src)
                return add_http(decodeURIComponent(newsrc));
        }

        if (domain_nowww === "infectedbyart.com" && src.indexOf("/Images/") >= 0) {
            return {
                url: src.replace(/\/+thumbs\/+/, "/"),
                problems: {
                    watermark: true
                }
            };
        }

        if (domain === "static.doramatv.me") {
            return src.replace(/(\/uploads\/+pics\/+.*\/[0-9]+)(\.[^/.]*)(?:[?#].*)?$/, "$1_o$2");
        }

        if (domain === "chi.gomtv.com") {
            return src.replace(/\/imgview\.cgi.*?[?&]nid=([0-9]+).*?$/, "/imgview.cgi?nid=$1&type=0");
        }

        if (domain === "static-thechristianpost.netdna-ssl.com") {
            return src
                .replace(/\/files\/+cache\/+image\/+([0-9]{1,2}\/+[0-9]{1,2}\/+[0-9]+)_(?:[wh]_[0-9]+|(?:a(?:_[0-9]+){4}))(\.[^/.]*)(?:[?#].*)?$/,
                         "/files/original/image/$1$2")
                .replace(/(\/image\/+[^/]*\.[^/.?#]+)(?:[?#].*)?$/, "$1");
        }

        if (domain === "prnewswire2-a.akamaihd.net") {
            return src.replace(/(\/+entry_id\/+[0-9a-z]+_[0-9a-z]+\/+).*$/, "$1def_height/0/def_width/0");
        }

        if (domain_nosub === "eldarioncloud.com" &&
            domain.match(/^radiocms-images\./)) {
            return src.replace(/^[a-z]+:\/\/[^/]*\/+resize\/+[0-9]+\/+(https?:)/, "$1");
        }

        if (domain === "media.ntslive.co.uk") {
            return src.replace(/\/(?:crop|resize)\/+[0-9]+x[0-9]+\/+/, "/images/");
        }

        if (domain_nosub === "tedsby.com" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/\/tb\/+[a-z]+\/+storage\//, "/storage/");
        }

        if (domain_nowww === "cumicumi.com") {
            return src.replace(/(\/uploads\/+public\/+(?:[0-9a-f]+\/+){3})th_[0-9]+x[0-9]+_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "kanal247.com") {
            return src.replace(/\/images\/+media\/+[0-9]+x[0-9]+\/+/, "/images/media/photo/");
        }

        if (domain_nowww === "sportuvai.bg") {
            return src.replace(/(\/pictures\/+[0-9]+_{1,2})[0-9]+(_+(?:[0-9]+)?)?(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2$3");
        }

        if (domain_nosub === "imgsmail.ru" &&
            domain.match(/^filapp[0-9]*\./)) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/+pic.*?[?^]url=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain_nosub === "thetimes.co.uk" && src.indexOf("/imageserver/image/") >= 0) {
            return {
                url: src.replace(/(?:\?.*)?$/, "?resize=999999999"),
                head_wrong_contentlength: true
            };
        }

        if (domain === "cdn.celebyolo.com") {
            return src.replace(/\/+(?:thumbnails\/+)?([^/]*-[0-9]+)-[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "/$1$2");
        }

        if (domain_nowww === "voice.fi") {
            return src.replace(/(\/+files\/+media\/+image\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{4}_[0-9]{2}_[0-9]{2}_[0-9a-f]+)_[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "funtime.ge") {
            return src
                .replace(/\/+img\/+[0-9]+\/+uploaded\/+/, "/uploaded/")
                .replace(/(\/+uploaded\/+[a-z]+\/+[0-9]{4}-[0-9]{2}\/+[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain === "t.nhentai.net") {
            return src.replace(/:\/\/t\.([^/]*\/+galleries\/+[0-9]+\/+[0-9]+)t(\.[^/.]*)(?:[?#].*)?$/, "://i.$1$2");
        }

        if (domain_nosub === "hitomi.la") {
            var regex = /:\/\/[a-z]?tn\.hitomi\.la\/+[a-z]+\/+([0-9]+\/+p?[0-9]+\.[^/.]*)\.[^/.]*(?:[?#].*)?$/;

            if (src.match(regex)) {
                return [
                    src.replace(regex, "://aa.hitomi.la/galleries/$1"),
                    src.replace(regex, "://ba.hitomi.la/galleries/$1"),
                ];
            } else {
                var pageid = src.replace(/^[a-z]+:\/\/[^/]*\/+[a-z]+\/+([0-9]+)\/+.*/, "$1");
                var page = "https://hitomi.la/galleries/" + pageid + ".html";

                return {
                    url: src,
                    extra: { page: page }
                };
            }
        }

        if (domain === "img.insight.co.kr") {
            return src.replace(/(\/static\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+)[0-9]+\/+([0-9a-z]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "express.de") {
            return src.replace(/\/+image\/+([0-9]+)\/+[0-9]+x[0-9]+\/+[0-9]+\/+[0-9]+\/+([0-9a-f]+)\/+..\/+([^/.]*)(\.[^/]*)(?:[?#].*)?$/,
                               "/blob/$1/$2/$3-data$4");
        }

        if (domain === "media.news.de") {
            return src.replace(/:\/\/[^/]*\/(?:images\/+[0-9]+|resources)\/+images\/+([0-9a-f]{2}\/+[0-9a-f]{2}\/+)([0-9a-f]+)\/+.*(\.[^/.]*)(?:[?#].*)?$/,
                               "://media.news.de/resources/images/$1$2$3");
        }

        if (domain === "store.live.ksmobile.net") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\/+liveme\/+/, "$1liveme/");
        }

        if (domain === "c.fantia.jp") {
            return src.replace(/(\/uploads\/.*\/)[a-z]+_((?:[0-9a-f]+-){4}[0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (host_domain_nowww === "e-hentai.org" &&
            options.host_url.match(/:\/\/[^/]*\/s\//) &&
            options && options.element && options.document && options.cb && options.do_request) {
            if (options.element.tagName === "IMG" && options.element.id === "img" &&
                options.element.src === src) {
                var els = options.document.getElementsByTagName("a");
                for (var i = 0; i < els.length; i++) {
                    var el = els[i];
                    if (!el.href.match(/https?:\/\/(?:www\.)?e-hentai\.org\/fullimg\.php/))
                        continue;

                    options.do_request({
                        url: el.href,
                        method: "HEAD",
                        headers: {
                            Cookie: document.cookie
                        },
                        onload: function(resp) {
                            if (resp.readyState === 4) {
                                if (resp.status === 200) {
                                    options.cb(resp.finalUrl.replace(/[?#].*$/, ""));
                                }
                            }
                        }
                    });

                    return {
                        waiting: true
                    };
                }
            }
        }

        if (host_domain_nowww === "e-hentai.org" &&
            options.host_url.match(/:\/\/[^/]*\/g\//) &&
            domain_nowww === "ehgt.org" &&
            options && options.element && options.document && options.cb && options.do_request) {
            var el = options.element.children[0];
            if (el && el.tagName === "A") {
                options.do_request({
                    url: el.href,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            if (resp.status !== 200) {
                                options.cb(null);
                                return;
                            }

                            var mainurl = null;
                            var match = resp.responseText.match(/<img *id=["']img["'] *src=["'](.*?)["']/);
                            if (match) {
                                mainurl = match[1];
                            } else {
                                return options.cb(null);
                            }

                            match = resp.responseText.match(/href=["'](https?:\/\/(?:www\.)?e-hentai\.org\/fullimg\.php.*?)["']/);
                            if (match) {
                                var url = match[1]
                                    .replace(/&amp;/g, "&");

                                options.do_request({
                                    url: url,
                                    method: "HEAD",
                                    headers: {
                                        Cookie: document.cookie
                                    },
                                    onload: function(resp) {
                                        if (resp.readyState === 4) {
                                            if (resp.status === 200) {
                                                options.cb(resp.finalUrl.replace(/[?#].*$/, ""));
                                            } else {
                                                options.cb(mainurl);
                                            }
                                        }
                                    }
                                });
                            } else {
                                options.cb(mainurl);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain === "cdn.zenfolio.net" && false) {
            return src.replace(/:\/\/[^/]*\/cdn[0-9]*\/+pub\/+(?:[^?#]*)(\/s\/+[^/]*\/+p[0-9]+-[0-9]+\.[^/.?#]*)(?:[?#].*)?$/,
                               "://www.zenfolio.com/img$1");
        }

        if (domain_nosub === "zenfolio.com" && false) {
            var regex = /(\/img\/s\/v-[0-9]+\/p[0-9]+)-[0-9]+(\.[^/.?#]*)(?:[?#].*)?$/;
            return [
                src.replace(regex, "$1$2"),
                src.replace(regex, "$1-7$2"),
                src.replace(regex, "$1-6$2"),
                src.replace(regex, "$1-5$2"),
                src.replace(regex, "$1-4$2")
            ];
        }

        if (domain === "gallery.greatandhra.com") {
            return src.replace(/(\/upload\/+[0-9]+\/+)[a-z]+\/+/, "$1images/");
        }

        if (domain_nowww === "fortstore.net") {
            return src.replace(/(\/data_server_[0-9]+\/+[0-9]+\/+)[a-z]+\/+[a-z]+_([^/]*\.[^/.]*)(?:[?#].*)?$/,
                               "$1big/$2");
        }

        if (domain === "static.jpg.pl") {
            return src.replace(/(\/static\/+photos\/+[0-9a-f]+\/+[0-9a-f]+\/+[0-9a-f]+)_[a-z]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1_original$2");
        }

        if ((domain_nosub === "nevsepic.com.ua" ||
             domain_nosub === "nevseoboi.com.ua") &&
            domain.match(/^c[po][0-9]*\./)) {
            return src.replace(/(\/[0-9]{3}\/+[0-9]+\/+)thumbs\//, "$1");
        }

        if (domain === "static.pulsk.com") {
            return src.replace(/(\/images\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+)thumb_[0-9]+_([^/]*\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "pornchampion.com") {
            return src.replace(/\/images\/+[^/]*\/+([0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/)/, "/images/big_images/$1");
        }

        if (domain === "cdn.vthumbs.com") {
            return src.replace(/:\/\/[^/]*\/thumbs\/[0-9]+px\/content\//, "://content.pornpics.com/");
        }

        if (domain === "content.pornpics.com") {
            return src.replace(/:\/\/[^/]*\/([0-9]{4}-[0-9]{2}-[0-9]{2}\/+[0-9]+_[0-9]+)(\.[^/.]*)(?:[?#].*)?$/,
                               "://cdn.pornpics.com/pics/$1big$2");
        }

        if (domain_nowww === "vipissy.com" ||
            domain === "media.puffynetwork.com") {
            return src.replace(/(\/fhg\/+[0-9a-f]+\/+)thumbs\//, "$1files/");
        }

        if (domain === "images.porninspector.com") {
            return src.replace(/\/tmb_([^/]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "sportky.zoznam.sk") {
            return src.replace(/:\/\/[^/]*\/cacheImg\/[^/]*\/([0-9]+px)\/(?:[^/.]*-)?([0-9]+[^/]*)(?:[?#].*)?$/, "://static.sportky.zoznam.sk/$1/$2");
        }

        if (domain === "static.sportky.zoznam.sk") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+px\//, "$1original/");
        }

        if (domain_nowww === "wallhalla.com" &&
            options && options.cb && options.do_request) {
            id = src.replace(/.*\/thumbs\/.*\/([^/.]*)[^/]*(?:[?#].*)?$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "https://wallhalla.com/wallpaper/" + id,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/ data-wallurl=["']([^"']*)["']/);
                            if (match) {
                                options.cb(urljoin(src, match[1]));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain === "i.artfile.ru") {
            id = src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+x[0-9]+_([0-9]+)_.*$/, "$1");
            if (id === src) {
                id = src.replace(/^[a-z]+:\/\/[^/]*\/s\/+([0-9]+)_[0-9]+_[^/]*(?:[?#].*)?$/, "$1");
            }
            if (id !== src) {
                options.do_request({
                    url: "http://www.artfile.ru/i.php?i=" + id,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/top.location.href *= *["'](https?:\/\/i\.artfile\.ru\/[^"']*)["']/);
                            if (match) {
                                options.cb(urljoin(src, match[1]));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "relook.ru" ||
            domain === "st.relook.ru") {
            return src.replace(/(\/data\/+cache\/+.*)(?:nothumb[0-9]+|-[0-9]+x[0-9]+)(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "izhevsk.ru") {
            return src.replace(/(\/forum_pictures\/+[^/]*\/+)thm\//, "$1");
        }

        if (domain === "img.navodayatimes.in") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/default\.aspx.*?[?&]img=([^&]*).*?$/,
                               "$1");
        }

        if (domain_nowww === "wallmachine.pl") {
            return src.replace(/(\/media\/+ecommerce\/+products\/+product[0-9]+\/+)[0-9]+x[0-9]+_(?:true|false)_/, "$1");
        }

        if (domain === "ds393qgzrxwzn.cloudfront.net") {
            return src.replace(/\/resize\/m[0-9]+x[0-9]+\//, "/");
        }

        if (domain_nowww === "religionpeace.ru") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/[0-9]+\/+[0-9]+\/+(https?)\/(.*)$/, "$1://$2");
        }

        if (domain_nowww === "specialone.co.kr") {
            return src.replace(/(\/alldata\/+[^/]*\/+)thum_([^/]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "static.mellbimbo.eu") {
            return {
                url: src.replace(/(:\/\/[^/]*\/)thumb\//, "$1files/"),
                headers: {
                    Origin: "http://mellbimbo.eu",
                    Referer: "http://mellbimbo.eu"
                }
            };
        }

        if (domain_nowww === "8xxx.net" &&
            options && options.do_request && options.cb) {
            id = src.replace(/^[a-z]+:\/\/[^/]*\/preview\/+[0-9]\/+[0-9]{3}\/+([0-9]+)\.[^/.]*(?:[?#].*)?$/,
                             "$1");
            if (id !== src) {
                options.do_request({
                    url: "http://8xxx.net/pictures/" + id,
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<p><a href=["'](.*?)["']>https?:\/\//);
                            if (match) {
                                options.cb(match[1]);
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain === "i.frg.im") {
            return src.replace(/_[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "thehshq.com") {
            regex = /\/d\/+([0-9]+)(-[0-9]+\/+[^/]*)(?:[?#].*)?$/;
            match = src.match(regex);
            if (match) {
                var parsed = parseInt(match[1]);
                return [
                    {
                        url: src.replace(regex, "/d/" + (parsed - 2) + "$2"),
                        norecurse: true
                    },
                    {
                        url: src.replace(regex, "/d/" + (parsed - 1) + "$2"),
                        norecurse: true
                    }
                ];
            }
        }

        if (domain_nowww === "wfmynews2.com") {
            return add_http(src.replace(/^[a-z]+:\/\/[^/]*\/img\/+resize\/+([^/]*\.[^/]*\/.*?)(?:[?#].*)?$/,
                                        "$1"));
        }

        if (domain_nowww === "celeb6free.com") {
            newsrc = src.replace(/\/pics\/+tn_([^/]*)(?:[?#].*)?$/, "/pics/$1");
            if (newsrc !== src) {
                return {
                    url: newsrc,
                    extra: {
                        page: newsrc.replace(/\/pics\/[^/]*$/, "/")
                    }
                };
            }
        }

        if (domain === "images.poms.omroep.nl") {
            return src.replace(/\/image\/+(?:s[0-9]+(?:x[0-9]+)?|c[0-9]+(?:x[0-9]+)?)\/+/, "/image/");
        }

        if (domain_nosub === "tvbuzer.com" &&
            domain.match(/^static[0-9]*\./)) {
            return src.replace(/(\/images\/+[a-z]+\/+)([0-9a-f]+\/+[0-9a-f]+-[0-9]+)-[0-9]+-[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1sources/$2$3");
        }

        if (domain_nosub === "mrskincdn.com" &&
            domain.match(/^assets[0-9]*\./)) {
            return src.replace(/(\/[^/]*-[0-9a-f]+)_[a-z_]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "spankbang.com" &&
            domain.match(/^cdnthumb[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+\/+([0-9]\/+[0-9]\/+[0-9]+-t)/, "$10/$2");
        }

        if (domain_nowww === "kosova-sot.info") {
            return src.replace(/(\/uploads\/+images\/+[0-9]{4}\/+[A-Z][a-z]+\/+[0-9]+\/+)(?:auto|thumb|thumbauto|[0-9]+x[0-9]+)_([^/]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "img.mako.co.il") {
            return src.replace(/(:\/\/[^/]*\/[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[^/]*)_[a-z](\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "okeinfo.net" &&
            domain.match(/^img(?:-[^.]*)?\./)) {
            return src.replace(/(:\/\/[^/]*\/)[^/]*\/+[0-9]+\/+content\//, "$1content/");
        }

        if (domain_nowww === "freexcafe.com" ||
            domain_nowww === "foxyporn.com") {
            return src
                .replace(/\/img\/([0-9]+)(\.[^/.]*)(?:[?#].*)?$/, "/pics/pics$1$2")
                .replace(/\/img\/([0-9a-f]+)-thumb[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "/pics/$1$2");
        }

        if (domain === "cdn-webimages.wimages.net") {
            return src.replace(/(:\/\/[^/]*\/[0-9a-f]+)-[-a-z]+(\.[^/.]*)$/,
                               "$1$2");
        }

        if (domain === "portal-images.azureedge.net") {
            return src.replace(/\/images\/([-0-9a-f]+\.[^/.]*?)(?:[?#].*)?$/, "/images/$1");
        }

        if (domain === "img.goldlive.co.kr") {
            return src.replace(/\/resize_[0-9]+x[0-9]+\//, "/");
        }

        if (domain_nowww === "nicegirl.io" ||
            domain_nowww === "sexypic.org") {
            return src.replace(/(\/album_[0-9]+\/+)t_(i_[^/]*)(?:[?#].*)?$/, "$1$2");
        }

        if ((domain_nosub === "35photo.ru" ||
             domain_nosub === "35photo.pro") &&
            src.match(/:\/\/[^/]*\/photos_/)) {
            return src
                .replace(/:\/\/m[0-9]*\.35photo[^/]*\//, "://35photo.pro/")
                .replace(/\/photos_(?:col|temp)\/+(?:r[0-9]|sizes)\/+([0-9]+\/[0-9]+)_[^/.]*(\.[^/.]*)(?:[?#].*)?$/,
                               "/photos_main/$1$2");
        }

        if (domain === "pw.artfile.me" ||
            domain === "i.artfile.me") {
            id = src.replace(/.*\/wallpaper\/+[0-9]+-[0-9]+-[0-9]{4}\/+[0-9]+x[0-9]+\/+([^/.?#]*).*?$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "https://artfile.me/wallpaper/" + id + ".html",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<meta *property="og:description" *content="([^"]*)"/);
                            if (match) {
                                var size = match[1].replace(/.*?размер: ([0-9]+x[0-9]+).*?$/, "$1");
                                if (size !== match[1]) {
                                    return options.cb(src
                                                      .replace(/\/[0-9]+x[0-9]+\//, "/" + size + "/")
                                                      .replace(/:\/\/pw\.artfile/, "://i.artfile"));
                                }
                            }

                            options.cb(null);
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nosub === "fotokto.ru" && domain.match(/^s[0-9]*\./)) {
            return src.replace(/\/photo\/+[a-z]+\//, "/photo/full/");
        }

        if (domain === "drscdn.500px.org") {
            id = src.replace(/^[a-z]+:\/\/[^/]*\/photo\/+([0-9]+)\/.*$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "https://500px.com/photo/" + id + "/",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<meta *content='(https?:\/\/drscdn[^']*)' *property='og:image'/);
                            if (match) {
                                options.cb(match[1].replace("&amp;", "&"));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "xportsnews.com") {
            return src.replace(/(\/contents\/+images\/+upload\/+.*\/)thm_/, "$1");
        }

        if (domain === "img.cdn.baca.co.id") {
            return src.replace(/(:\/\/[^/]*\/[-0-9a-f]+)_thumbnail(?:[?#].*)?$/, "$1");
        }

        if (domain === "contents.innolife.net") {
            return src.replace(/(\/mobile\/img\/item\/[0-9]+_)[a-z]+(\.[^/.]*)$/, "$1l$2");
        }

        if (domain_nowww === "blognews.am") {
            return src.replace(/\/static\/+news\/+[a-z]\/+/, "/static/news/b/");
        }

        if (domain_nowww === "sasisa.ru") {
            return src.replace(/(\/blog\/+content\/+[0-9]+\/+[0-9a-f]+)_[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "i.photographers.ua" ||
            domain_nowww === "photographers.ua") {
            return src.replace(/\/thumbnails\/+((?:pictures|users)\/+[0-9]+)\/+[0-9]+x([^/.]*\.[^/.]*)(?:[?#].*)?$/,
                               "/images/$1/$2");
        }

        if (domain_nowww === "copia-di-arte.com" &&
            src.indexOf("/kunst/") >= 0) {
            return src.replace(/_lo(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nosub === "photosight.ru" &&
            domain.match(/^prv-[0-9]{4}-[0-9]+\./)) {
            return src.replace(/:\/\/prv(-.*\/)pv_([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "://img$1$2");
        }

        if (domain === "rs.kantie.org") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/it\/(https?:)/, "$1");
        }

        if (domain_nowww === "zmut.com") {
            return src.replace(/\/uploads\/cache\/(pins\/+[0-9]{4}\/+[0-9]{2}\/+[^/]*)-[0-9]+x(\.[^/.]*)(?:[?#].*)?$/,
                               "/uploads/$1$2");
        }

        if (domain_nosub === "2photo.ru" &&
            domain.match(/^i[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*)\/[a-z]+\/+(.\/+.\/+[0-9]+\.)/, "$1/$2");
        }

        if (domain === "mcdn.wallpapersafari.com") {
            return src.replace(/:\/\/mcdn(\.[^/]*\/)(?:medium|small)\/+/, "://cdn$1");
        }

        if (domain === "m.salon24.pl") {
            return src.replace(/(:\/\/[^/]*\/[0-9a-f]+)(?:,[0-9]+){4}(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "cdn.fishki.net" ||
           domain === "cdn-tn.fishki.net") {
            return src
                .replace(/(\/upload\/+post\/+[0-9]{6}\/+[0-9]{2}\/+[0-9]+\/+)tn\/+/, "$1")
                .replace(/:\/\/cdn-tn\.([^/]*\/)(?:[0-9]+\/+)?upload\//, "://cdn.$1upload/");
        }

        if (domain_nowww === "ravshaniya.com") {
            return src.replace(/\/uploads\/+photos\/+thumbs\/+[0-9]+\/+/, "/uploads/photos/");
        }

        if (domain_nowww === "onlyhdwallpapers.com" ||
            domain_nowww === "hdwallpapers.cat") {
            var cookie = null;
            var watermark = true;
            if (options.document && options.document.cookie) {
                cookie = options.document.cookie;
                watermark = false;
            }

            return {
                url: src.replace(/(:\/\/[^/]*\/)thumbnail(?:_[a-z]+)?\/+/, "$1wallpaper/"),
                headers: {
                    Origin: "https://" + domain,
                    Referer: src,
                    Cookie: cookie
                },
                problems: {
                    watermark
                }
            };
        }

        if (domain_nowww === "bestpornbabes.com") {
            return src.replace(/(\/media\/+galleries\/+[0-9a-f]+\/+)thumbs\//, "$1");
        }

        if (domain === "staticpopopics.popopics.com") {
            return src.replace(/\/uploads\/(?:thumb|display)\//, "/uploads/original/");
        }

        if (domain_nowww === "stopga.me") {
            return src.replace(/(\/images\/+uploads\/+images\/+[0-9]+\/+.*\/)[a-z]+_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "foap.com" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/(\/images\/+[-0-9a-f]+\/+)[wh][0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1original$2");
        }

        if (domain_nosub === "foap.com" && domain.match(/^images[0-9]*\./)) {
            return src.replace(/:\/\/images[0-9]*(\.foap\.com\/images\/+[-0-9a-f]+\/+)[^/.]*(\.[^/.?#]*)(?:[?#].*)?$/,
                               "://cdn2$1original$2");
        }

        if (domain_nowww === "themepack.me") {
            return src.replace(/\/i\/+c\/+[0-9]+x[0-9]+\/+media\/+/, "/media/");
        }

        if (domain === "static.mycuteasian.com") {
            return src.replace(/\/cache\/+(content\/+pictures\/+.*)\.[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "/$1$2");
        }

        if (domain_nowww === "jiji.com") {
            return src.replace(/(\/v[0-9]*_photos\/.*)_[sm](\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "storage.mantan-web.jp") {
            return src.replace(/(\/[^/]*)_(?:size[0-9]*|thumb)(\.[^/.]*)(?:[?#].*)?$/, "$1_size10$2");
        }

        if (domain_nosub === "akamaized.net" &&
            domain.match(/^p[0-9]*-tiktokcdn-com\./)) {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\//, "$1obj/");
        }

        if (domain_nowww === "cinra.net") {
            return src.replace(/(\/uploads\/+img\/+.*)_[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1_full$2");
        }

        if (domain === "e00-telva.uecdn.es") {
            return src.replace(/_inc(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain === "fs.kinomania.ru") {
            return src.replace(/\/image(\/+file\/.*\/[0-9a-f]+)\.[0-9]+\.[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "notigape.com") {
            return src.replace(/\/thumburl\/+thumbnail\/+[0-9]+x[0-9]+\/+outbound\/+uploads\/+/, "/uploads/");
        }

        if (domain_nowww === "prdelinky.cz") {
            return src.replace(/\/uploaded\/+gallery\/+thumb_/, "/uploaded/gallery/");
        }

        if (domain_nosub === "selfimg.com.cn" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/)[^/]*vogue[^/]*\//, "$1uedvoguecms/");
        }

        if (domain === "hp.funrahi.com") {
            return src.replace(/(:\/\/[^/]*\/[0-9]{4}\/+[0-9]{2}\/+[^/]*\/+[^/]*)_t(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "img.007shoes.com") {
            return src.replace(/^[a-z]+:\/\/[^/]*\/\?img_url=(https?:)/, "$1");
        }

        if (domain_nowww === "cineol.net") {
            return src.replace(/\/fotos\/+thumb[0-9]+_/, "/fotos/");
        }

        if (domain_nowww === "nosolocine.es") {
            return src.replace(/\/images\/+galeria\/+thumbs\/+/, "/images/galeria/");
        }

        if (domain === "pics.filmaffinity.com") {
            return src.replace(/-s[0-9]*(\.[^/.]*)(?:[?#].*)?$/, "-large$1");
        }

        if (domain === "fitsnews.files.wordpress.com") {
            newsrc = src.replace(/\.thumbnail(\.[^/.]*)(?:[?#].*)?$/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (domain === "data.okinny.heypo.net") {
            return {
                url: src.replace(/\/image\/+thumb\/+([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "/image/large/$1"),
                can_head: false
            };
        }

        if (domain_nosub === "mgstage.com" &&
            domain.match(/^(?:spimg[0-9]*|image)\./)) {
            return src.replace(/(\/[^/_]*_)[^/_]*(_[^/]*)(?:[?#].*)?$/, "$1e$2");
        }

        if (domain_nosub === "gettextbooks.com" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/(\/pi\/+[0-9]+\/+)[-0-9]+\/+[-0-9]+(?:\/+)?(?:[?#].*)?$/, "$1999999999/999999999");
        }

        if (domain_nosub === "y3600.cn" &&
            domain.match(/^img[0-9]*\./)) {
            return src.replace(/\/z(?:resize|crop)?\/+[0-9]+\/+[0-9]+\//, "/zresize/999999999999/999999999999/");
        }

        if (domain_nowww === "life.tw" ||
            domain === "amazon.life.com.tw") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/proxy\.php\?url=([^&]*).*?$/, "$1");
            if (newsrc !== src) {
                return decodeURIComponent(newsrc);
            }
        }

        if (domain_nowww === "onlyfans.com" ||
            domain === "media.onlyfans.com" ||
            amazon_container === "of2media") {
            return src.replace(/:\/\/[^/]*\/(?:of2media\/+)?files\/+thumbs\/+[wh][0-9]+\/+/, "://media.onlyfans.com/files/");
        }

        if (domain === "img.mfcimg.com") {
            return src.replace(/(\/photos2\/+[0-9]+\/+[0-9]+\/+[-0-9]+)\.[0-9x]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "webnewtype.com") {
            return {
                url: src.replace(/(\/rsz\/+S[0-9]*\/+[0-9]+\/+[^/.]*\.[^/.?#]*)(?:\/[wh][0-9]+.*)?(?:[?#].*)?$/,
                                 "$1"),
                can_head: false // returns 404
            };
        }

        if (domain === "cdn.themis-media.com") {
            return src.replace(/\/media\/+global\/+images\/+galleries\/+[a-z]+\/+/,
                               "/media/global/images/galleries/full/");
        }

        if (domain === "tn.nozomi.la") {
            newsrc = src.replace(/:\/\/tn\.([^/]*\/[0-9a-f]+\/+[0-9a-f]+\/+[0-9a-f]+)(\.[^/.]*)(?:\.[^/.]*)(?:[?#].*)?$/,
                                 "://i.$1$2");
            if (newsrc !== src) {
                return {
                    url: newsrc,
                    headers: {
                        Referer: "https://nozomi.la/"
                    }
                };
            }
        }

        if (domain === "pic.baike.soso.com") {
            return src.replace(/(\/baikepic[0-9]*\/+[^/]*\/+[^/]*\/+)[0-9]+(?:[?#].*)?$/, "$10");
        }

        if (domain_nosub === "jpopasia.com" && domain.match(/^i[0-9]*\./)) {
            return add_extensions(src.replace(/(\/(?:assets|news)\/+[0-9]+\/+[^/]*)-t(\.[^/.]*)(?:[?#].*)?$/, "$1$2"));
        }

        if (domain_nowww === "jpgravure.com" ||
            domain_nowww === "thethaigirls.com") {
            return src.replace(/(\/galleries\/.*\/)tn([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "highasianporn.com") {
            return src.replace(/(\/g\/.*\/)tn([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "1pondo.tv") {
            return src
                .replace(/(\/assets\/+sample\/+[0-9]+_[0-9]+\/+[^/]*)_s(\.[^/.]*)(?:[?#].*)?$/, "$1$2")
                .replace(/(\/assets\/+sample\/+[0-9]+_[0-9]+\/+)thum_[0-9]+(\/+[0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1popu$2");
        }

        if (domain === "cdn.pics.fhg.javhd.com") {
            return src.replace(/(\/[0-9]+\/+[0-9]+)t(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "galleries.allgravure.com") {
            return src.replace(/(\/[0-9]+\/+[^/]*\/+[0-9]+)t(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "bravoerotica.com") {
            return src.replace(/(\/[0-9]+)t(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "japanesepussyclub.com" ||
            domain_nowww === "kabukicho-girls.com") {
            return {
                url: src.replace(/(\/+[^/]*\/+)thumbnails\/+([^/]*)_tn(\.[^/.]*)(?:[?#].*)?$/, "$1images/$2$3"),
                headers: {
                    Referer: "http://" + domain
                }
            };
        }

        if (domain_nowww === "asianthumbs.org") {
            return src.replace(/(\/gallery\/+.*\/+)tn\/+([^/]*\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "images.anilos.com" ||
            domain === "images.nubiles.net") {
            return src.replace(/\/tn\/+([^/]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "cdn.handjobjapan.com") {
            return src.replace(/(\/preview\/+[0-9a-z]+\/+[0-9]+)s(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "cre.ma" && domain.match(/^assets[0-9]*\./)) {
            return src.replace(/(\/image[0-9]*\/+)thumbnail_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "cdn.megacountry.livenation.com") {
            return src.replace(/(\/production\/+[^/]*-photo\/+[0-9]+\/+)[a-z]+_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "annangelxxx.com") {
            return src.replace(/(\/tgp\/+[^/]*\/+[0-9]+\/+)thumbnails\/+tn([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1originalimages/$2");
        }

        if (domain_nosub === "coedcherry.com" &&
            domain.match(/^content[0-9]*\./)) {
            return src.replace(/\/th[0-9]+x[0-9]+_([^/]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nowww === "nicsgalleries.com") {
            return src.replace(/(\/g\/.*\/[0-9a-f]+\/+)thumbs\/+thumb_([^/]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "hiqqu.xxx") {
            return src.replace(/\/files\/+[0-9]+x[0-9]+\/+/, "/files/");
        }

        if (domain === "img.chan4chan.com") {
            return {
                url: src.replace(/(\/img\/+[0-9]{4}-[0-9]{2}-[0-9]{2}\/+)tn_([^/]*)(?:[?#].*)?$/, "$1$2"),
                can_head: false // 404
            };
        }

        if (domain === "img.indexxx.com") {
            return {
                url: src.replace(/\/images\/+thumbs\/+[0-9]+x[0-9]+\/+/, "/images/"),
                headers: {
                    Referer: "https://www.indexxx.com/"
                }
            };
        }

        if (domain === "atkgalleria.ero.today" ||
            domain_nosub === "oldax.com") {
            newsrc = src.replace(/\/p\/+[0-9]+x[0-9]+_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/m$1");
            if (newsrc !== src) {
                return {
                    url: newsrc,
                    headers: {
                        Referer: "http://www." + domain_nosub + "/"
                    }
                };
            }
        }

        if (domain_nosub === "dreamercdn.com") {
            return src.replace(/(\/media\/+[0-9]+\/+[0-9]+\/+)[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1original$2");
        }

        if (amazon_container === "images.charitybuzz.com" ||
            domain === "images.charitybuzz.com") {
            return src.replace(/(\/images\/+[0-9]+\/+)[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1original$2");
        }

        if (domain === "media.movieassets.com") {
            return src.replace(/(\/static\/+images\/+.*\/)[0-9]+\/+[0-9]+\/+(?:[^/]*-)?([0-9a-f]{20,}\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2")
        }

        if (domain_nosub === "happyhair.sk") {
            return src.replace(/\/celebrity_img\/+thumbs[^/]*\/+/, "/celebrity_img/");
        }

        if (domain_nosub === "wn.com" &&
            domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/(\/[0-9a-f]{20,}[-_])small(\.[^/.]*)(?:[?#].*)?$/, "$1large$2");
        }

        if (domain_nowww === "atoananet.com.br") {
            return src.replace(/(\/links\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[^/]*)_[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "img.ifcdn.com") {
            regex = /(\/images\/+[0-9a-f]+_)[0-9]+(\.[^/.]*)(?:[?#].*)?$/;
            return [
                src.replace(regex, "$13$2"),
                {
                    url: src.replace(regex, "$11$2"),
                    problems: {
                        watermark: true
                    }
                }
            ];
        }

        if (domain_nowww === "babeprofiles.com") {
            return src.replace(/(\/media\/+models\/.*\/)[0-9]+x[0-9]+\/+([^/]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "meetmecdna.com") {
            return src.replace(/\/thumb_userimages(\/+.*\/)thm_/, "/userimages$1");
        }

        if (domain === "images.spicyadulttools.com") {
            return src.replace(/\/images\/+thumb\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "/images/full/$1");
        }

        if (domain_nosub === "trafficdeposit.com" &&
            domain.match(/^s[0-9]*\./)) {
            return src.replace(/(\/vid\/+[0-9a-f]+\/+[0-9a-f]+\/+)[a-z]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1full$2");
        }

        if (domain_nowww === "babepedia.com") {
            return src.replace(/\/galleries-thumbs\/+/, "/galleries/");
        }

        if (domain_nowww === "yourdailygirls.com") {
            return src.replace(/(\/galleries\/.*\/[^/]*)-tn(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "static.ftvgirls.com" ||
            domain === "promo.ftvgirls.com") {
            return src.replace(/(\/galleries\/.*\/[0-9]+)-thumb(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "image.istyle24.com") {
            return src.replace(/(\/upload\/+ProductImage\/+[0-9]+\/+[0-9]+\/+[0-9]+_(?:[0-9]+_)?)[a-zA-Z]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1L$2");
        }

        if (domain_nowww === "bbstar.kr") {
            return src.replace(/(\/model\/+[^/]*[0-9]+)s(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "asn.im" && domain.match(/^i[0-9]*\./)) {
            return src.replace(/(:\/\/[^/]*\/[^/]*)-[a-z](\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "bebzol.com") {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/thumbs.*?[?&]i=([^&]*).*?$/, "$1");
            if (newsrc !== src) {
                return urljoin(src, "/" + decodeURIComponent(newsrc));
            }
        }

        if (domain_nowww === "thecandidforum.com") {
            return src.replace(/(\/attachments\/+[0-9a-f]+)t(-[^/]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "hottystop.com") {
            return src.replace(/\/smallimage([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "img.highviral.news") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+\/+([0-9]+_[0-9a-f]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "mondrian.mashable.com") {
            newsrc = src.replace(/(:\/\/[^/]*\/[^/?]*%252F[^/?]*)\?.*$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(decodeURIComponent(newsrc));
        }

        if (domain === "image.wisetrail.com") {
            return src.replace(/(\/bookmark[0-9]+\/+[^/]*)_small(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "internationallovescout.com") {
            return src
                .replace(/(\/entries\/+[0-9]+\/+)thumb_/, "$1")
                .replace(/(\/images\/+uploads\/.*)-[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain.match(/^images\.locanto\./)) {
            return src.replace(/(:\/\/[^/]*\/[^/]*\/+)[a-z]+_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "dailytravelphotos.com") {
            return src.replace(/(\/images\/+[0-9]+)t(\/[^/]*)_th(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "galleries.grooby.com") {
            return src.replace(/\/tn-([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nosub === "adult-empire.com" &&
            domain.match(/^pbs(?:-[0-9]+)?\./)) {
            newsrc = src
                .replace(/\/tns\/+tn([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1")
                .replace(/\/thumb\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/pics/$1")
                .replace(/\/pic\/+t(?:n[0-9]*\/+)?([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/pic/$1")
                .replace(/\/(?:thumbnails|tm)\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1")
                .replace(/\/thumbs\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/pics/$1")
                .replace(/\/t\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/p/$1")
                .replace(/\/tumb\/+tumb([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/pics/$1")
                .replace(/\/pics\/+thumbs\/+p([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/pics/p$1")
                .replace(/(\/[0-9]+)xxx(\.[^/.]*)(?:[?#].*)?$/, "$1$2")
                .replace(/\/th\/+thumbnails\/+tn([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1")
                .replace(/(\/[0-9]+)_resize(\.[^/.]*)(?:[?#].*)?$/, "$1$2")
                .replace(/\/tn(chicksandbeasts\.com-[0-9]+\.[^/.]*)(?:[?#].*)?$/, "/www.$1")
                .replace(/\/th([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1")
                .replace(/(\/[0-9]+)a(\.[^/.]*)(?:[?#].*)?$/, "$1$2")
                .replace(/\/thumbs\/+thumb([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/pics/pic$1")
                .replace(/(:\/\/[^/]*\/[^/]*\/+[^/]*\/+[^/]*\/+)tn([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
            if (newsrc !== src)
                return newsrc;

            regex = /\/thumbnails\/+tn([0-9]+\.[^/.]*)(?:[?#].*)?$/;
            if (src.match(regex)) {
                return [
                    src.replace(regex, "/images/$1"),
                    src.replace(regex, "/$1")
                ];
            }
        }

        if (domain_nowww === "exl.io") {
            return src.replace(/(\/[0-9a-f]{20,}\/+)tmd([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "idols69.net") {
            return src.replace(/(\/pictures\/+[^/]*\/+)t([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "fhg.mycuteasian.com" ||
            domain === "fhg.avidolz.com") {
            return src.replace(/(\/picture\/+[^/._]*_)t([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "teenfilipina.net") {
            return src
                .replace(/\/thumbs\//, "/")
                .replace(/(-[0-9]+)thumb(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "rexxx.co") {
            return src.replace(/(:\/\/[^/]*\/[0-9]+\/[0-9]+)(\.[^/.]*)(?:[?#].*)?$/,
                               "$1f$2");
        }

        if (domain_nosub === "mobile9.com") {
            return src.replace(/\/download\/+thumb\/+([0-9]+)\/+[0-9]+\/+([^/]*\.[^/.]*)(?:[?#].*)?$/,
                               "/download/media/$1/$2");
        }

        if (domain === "s.fap5.com" ||
            domain === "s.mycosplayclub.com") {
            return src.replace(/(\/[0-9a-f]{15,}\/+)thumbs\/+([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "coolspotters.com") {
            return src.replace(/(\/files\/+photos\/+[0-9]+\/+[^/]*)-(?:small|large|medium|micro|popover)(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "celebsdump.com") {
            return src.replace(/(\/posts\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]+\/+)thumbs\/+/, "$1images/");
        }

        if (domain === "photos.laineygossip.com") {
            return src.replace(/\/thumbs\/+tmb_[0-9]+x[0-9]+_/, "/articles/");
        }

        if (domain_nowww === "laineygossip.com") {
            return urljoin(src, src
                           .replace(/^[a-z]+:\/\/[^/]*\/Thumbnail\.axd.*?[?&]p=([^&]*).*?$/, "$1")
                           .replace(/[+]/g, "%20"));
        }

        if (domain === "images.successstory.com") {
            return src.replace(/(\/img_[a-z]+\/+[^/]*\/+)[0-9]+X[0-9]+\/+/, "$1");
        }

        if (domain_nosub === "flixster.com" &&
            domain.match(/^content[0-9]*\./)) {
            return src.replace(/(\/photo\/+[0-9]+\/+[0-9]+\/+[0-9]+\/+[0-9]+_)[a-z]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1ori$2");
        }

        if (amazon_container === "focusmicrosites") {
            return src.replace(/(\/assets\/+uploads\/+)_tmp\/+([^/]*)-[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2$3");
        }

        if (domain === "i.digiguide.tv") {
            return src.replace(/(\/p\/+[0-9]+\/+)tn-/, "$1");
        }

        if (domain_nowww === "azquotes.com") {
            return src.replace(/(\/public\/+pictures\/+.*\/)c_([0-9a-f]+[^/]*)_thumb(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2$3");
        }

        if (domain_nowww === "newsarama.com" ||
            domain === "i.newsarama.com") {
            return src.replace(/(\/images\/+i\/+[0-9]+\/+[0-9]+\/+[0-9]+\/+)i[0-9]+\/+/,"$1original/");
        }

        if (domain_nowww === "moly.hu") {
            newsrc = src.replace(/(\/system\/+authors\/+[0-9]+\/+image_)[a-z]+\./,
                                 "$1original.");
            if (newsrc !== src)
                return newsrc;

            regex = /(\/system\/+[^/]*\/+)[a-z]+(\/+[a-z]+_[0-9]+\.)/;
            newsrc = src.replace(regex, "$1original$2");
            if (newsrc !== src)
                return [newsrc, src.replace(regex, "$1big$2")];
        }

        if (domain_nowww === "arasale.com") {
            return src.replace(/(\/photo[0-9]*\/+[^/]*\/+[0-9]+)_small(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "imgth.com") {
            return src.replace(/\/thumbs\/+/, "/images/");
        }

        if (domain_nowww === "intimatecelebs.com") {
            return src.replace(/(\.[^/.]*)\.icthumb\.[^/.]*(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "celebriot.com") {
            return src.replace(/(\.[^/.]*)\.thumb_[0-9]+x[0-9]+\.[^/.]*(?:[?#].*)?$/, "$1");
        }

        if (domain_nosub === "paheal.net") {
            return src.replace(/:\/\/[^/]*\/_thumbs\//, "://peach.paheal.net/_images/");
        }

        if (domain === "cache.lovethispic.com") {
            return src.replace(/\/uploaded_images\/+thumbs\/+/, "/uploaded_images/");
        }

        if (domain_nowww === "zwz.cz" &&
            options && options.do_request && options.cb) {
            id = src.replace(/^[a-z]+:\/\/[^/]*\/o[^/]*\.zwz\/+([A-Z0-9]+)\.[^/.]*(?:[?#].*)?$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "http://zwz.cz/f/" + id,
                    method: "GET",
                    headers: {
                        Cookie: "agree=yes"
                    },
                    onload: function(result) {
                        if (result.readyState === 4) {
                            if (result.status !== 200) {
                                console_log(result);
                                options.cb(null);
                                return;
                            }

                            var match = result.responseText.match(/<img *id=['"]?pic["']? *class[^>]*?src=["']([^'"]*)['"]/);
                            if (match) {
                                options.cb(urljoin(src, match[1]));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nowww === "hockeygods.com") {
            return src.replace(/(\/system\/+gallery_images\/+[0-9]+\/+)[a-z]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1original$2");
        }

        if (domain === "galleries.cosmid.net") {
            return src.replace(/(:\/\/[^/]*\/[0-9]+)\/+thumbs\/+/, "$1/");
        }

        if (domain === "video.soloteengirls.net") {
            return src.replace(/\/materials\/+thumbs\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "/materials/$1");
        }

        if (domain_nosub === "fantasti.cc" &&
            domain.match(/^cdn(?:-[a-z]+)?\./)) {
            return src.replace(/\/thumb\/+([^/]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "images.larepubliquedespyrenees.fr") {
            return src.replace(/(\/[0-9a-f]{20,}\/+)golden\/+[0-9]+x[0-9]+\/+/, "$1");
        }

        if (domain === "img.aws.la-croix.com") {
            return src.replace(/_[0-9]+_[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "getty.edu") {
            return src.replace(/\/media\/+images\/+web\/+[^/]*\/+/, "/media/images/web/download/");
        }

        if (domain_nosub === "yelpcdn.com") {
            return src.replace(/(\/bphoto\/+[^/]*\/+)(?:[0-9]+s|[a-z]+)(\.[^/.]*)(?:[?#].*)?$/,
                               "$1o$2");
        }

        if (domain_nosub === "rtbf.be" &&
            domain.match(/^(?:[^/]*\.)?static\./)) {
            return src.replace(/\/article\/+image\/+[0-9]+x[0-9]+\/+/, "/article/image/original/");
        }

        if (domain === "d5xydlzdo08s0.cloudfront.net") {
            return src.replace(/(\/media\/+[^/]*\/+[0-9]+\/+(?:[^/]*\/)?[^/]*)(?:__[A-Z]|_[0-9]+)(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "photos.geni.com") {
            return src.replace(/_[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "_original$1");
        }

        if (false && googlestorage_container === "dbc-wkzlfm") {
        }

        if (domain === "cdn.hipwallpaper.com") {
            return src.replace(/(:\/\/[^/]*\/)m\/+/, "$1i/");
        }

        if (domain === "photos.bandsintown.com" ||
            amazon_container === "bit-photos") {
            return src.replace(/\/thumb\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/large/$1");
        }

        if (domain === "d1dojdv0rym6r6.cloudfront.net") {
            return src.replace(/\/imgs\/+[a-z]+\/+([0-9]+_pic[0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "/imgs/large/$1")
        }

        if (domain_nowww === "mynetsit.ir") {
            return src.replace(/(:\/\/[^/]*\/).*?[?&]dt=([^/&]*).*?$/, "$1?di=$2");
        }

        if (domain === "cf.kizlarsoruyor.com") {
            return src.replace(/(\/[a-z][0-9]+\/+[a-z][0-9]+-[-0-9a-f]+)-m(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "static.framar.bg") {
            return src.replace(/\/thumbs\/+[0-9]+\/+lifestyle\/+/,
                               "/snimki/lstyle/");
        }

        if (domain === "life.tert.am") {
            return src.replace(/(:\/\/[^/]*\/)[^/]*\/+cache_image\/+(.*)-[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2$3");
        }

        if (domain_nowww === "woman.at") {
            return src
                .replace(/\/storage\/+[^/]*\/+file\/+/, "/storage/master/file/") // this doesn't seem to do any difference
                .replace(/(\/file\/+[0-9]+\/+)download\/+/, "$1"); // removes force-downloading
        }

        if (domain === "files.elfann.com") {
            return src.replace(/\/imagine\/+pictures_[0-9]+\/+/, "/pictures/");
        }

        if (domain === "cdn.axar.az") {
            return src.replace(/(:\/\/[^/]*\/[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+)[0-9]+\/+([^/]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "media.milovana.com") {
            return src.replace(/\/timg\/+tb_[a-z]+\/+/, "/timg/tb_l/");
        }

        if (domain === "uploads.spiritfanfiction.com") {
            return src.replace(/\/fanfics\/+thumbs\/+/, "/fanfics/historias/");
        }

        if (domain === "pic.homepornbay.com") {
            return src.replace(/(\/[0-9]+)s(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain === "cdn.funpic.us") {
            return src.replace(/(-[0-9]+)-[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nowww === "themanwiththehat.de") {
            return src.replace(/\/files\/+attachments\/+[0-9]+\/+/, "/files/attachments/");
        }

        if (domain_nosub === "motorsport.com" &&
            domain.match(/^cdn(?:-[0-9]*)?\./)) {
            return src.replace(/(\/images\/+[^/]*\/+[^/]*\/+)s[5897]\/+/, "$1s10/");
        }

        if (domain_nowww === "epicwallpapers.com" ||
            domain_nowww === "alliswall.com") {
            return src
                .replace(/\/imagecache\/+thumbnails\/+([0-9]+)\/+[0-9]+x[0-9]+\.[^/.]*(?:[?#].*)?$/,
                         "/file/$1/0x0/crop/")
                .replace(/(\/file\/+[0-9]+)\/+[0-9]+x[0-9]+\/+(?:crop|[0-9]+:[0-9]+)\/+/, "$1/0x0/crop/");
        }

        if (domain === "kookbang.dema.mil.kr") {
            return src.replace(/(\/upload\/+[0-9]{8}\/+)thumb[0-9]*\/+/, "$1");
        }

        if (domain === "dyaaf063c1cms.cloudfront.net") {
            return src.replace(/(:\/\/[^/]*\/[0-9a-f]+\/)(?:sq[0-9]+|medium)_/, "$1large_");
        }

        if (domain_nowww === "specialfruit.com") {
            return src
                .replace(/\/thumbnail\/+product[^/]*\/+/, "/thumbnail/productFull/")
                .replace(/\/thumbnail\/+inline\/+/, "/thumbnail/full/");
        }

        if (domain === "static.planetminecraft.com") {
            return src.replace(/(\/files\/.*_[0-9]+)_[a-z]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "mytinyphone.com") {
            return src.replace(/(\/uploads\/.*\/)sm[0-9]*\/([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "wallcoo.net") {
            return src.replace(/\/s\/+([^/]*_[0-9]+)s(\.[^/.]*)(?:[?#].*)?$/, "/images/$1$2");
        }

        if (domain_nowww === "absfreepic.com") {
            return src.replace(/\/[a-z]+_photos\/+([^/]*)(?:[?#].*)?$/, "/original_photos/$1");
        }

        if (domain_nowww === "gif-favicon.com") {
            return src.replace(/\/images\/+download\.php.*?[?&]image=([^&]*).*?$/,
                               "/images/$1");
        }

        if (domain_nowww === "ametart.com") {
            return src.replace(/\/thumbs\/+([0-9]+\/+[0-9]+\/+)[0-9]+x_([^/]*)(?:[?#].*)?$/,
                               "/photos/$1$2");
        }

        if (domain_nowww === "nicepornphotos.com") {
            return src.replace(/(\/images\/+galleries\/+[0-9]+\/+[0-9]+\/+[0-9a-f]+)-t(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "hostave2.net") {
            return src.replace(/(\/photo\/+[^/]*\/+[^/]*\/+)th\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "i.penisbot.com") {
            return src.replace(/\/tmb_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nowww === "erowall.com") {
            return src
                .replace(/\/download_img\.php.*?[?&]dimg=([0-9]+).*?$/, "/wallpapers/original/$1.jpg")
                .replace(/\/wallpapers\/+[a-z]+\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/wallpapers/original/$1");
        }

        if (domain === "promo.mattsmodels.com") {
            return src.replace(/(\/galleries\/+[^/]*\/+[^/]*\/+)thumbs\/+/, "$1");
        }

        if (domain === "galleries.allover30.com") {
            return src.replace(/\/Z[0-9]+\/+([^/]*)(?:[?#].*)?$/,
                               "/$1");
        }

        if (domain === "images.sxx.com") {
            return src.replace(/\/thumbs\/+([^/]*)_tb(\.[^/.]*)(?:[?#].*)?$/,
                               "/$1$2");
        }

        if (domain === "ww2.aziani.com") {
            return src.replace(/\/t_([^/]*-[0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "fhg.karupsow.com") {
            return src.replace(/\/images\/+thumbs(-[^/]*\/)/, "/images/pics$1");
        }

        if (domain_nowww === "stockingvideos.com") {
            return src.replace(/\/images\/thumbs\/thumb([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "/images/full/full$1");
        }

        if (domain === "media.virbcdn.com") {
            return src.replace(/\/cdn_images\/+resize_[0-9]+x[0-9]+\/+/, "/images/");
        }

        if (domain === "images.yuku.com") {
            return src.replace(/(\/image\/+[^/]*\/+[0-9a-f]+(?:\.[0-9]+)?)_[^/.]*(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "kpopping.com") {
            return src.replace(/\/uploads\/+documents\/+[^/]*\/+([^/]*)(?:[?#].*)?$/,
                               "/uploads/documents/$1");
        }

        if (domain_nosub === "tin247.com" &&
            domain.match(/^image[0-9]*\./)) {
            return src.replace(/\/picsmall\/+([0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+)[0-9]+\/+/,
                               "/$1");
        }

        if (domain === "assets.blogr.xxx" ||
            domain === "assets-old.blogr.xxx") {
            return src.replace(/\/posts\/+[^/]*\/+([0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+)/, "/posts/large/$1");
        }

        if (domain_nowww === "internationalcelebrityfeet.com") {
            return src.replace(/\/thumbs\/([^/]*)thumb(\.[^/.]*)(?:[?#].*)?$/, "/pics/$1$2");
        }

        if (domain === "content.gulte.com") {
            return src.replace(/(\/content\/+[0-9]{4}\/+[0-9]{2}\/+photos\/+events\/+[^/]*\/+)thumb\/+([^/]*)(?:[?#].*)?$/,
                               "$1normal/$2");
        }

        if (domain_nowww === "moda.ru") {
            return src.replace(/(\/files\/+user\/+(?:[0-9]{2}\/+){3}content\/+[0-9]+\/+)[0-9]+x[0-9]+x[0-9]+_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "sodonsolution.org" &&
            domain.match(/^resource[0-9]*\./)) {
            return src.replace(/(\/images\/[0-9]{4}\/+[0-9]+\/+[0-9a-f]+\/+[0-9a-z]+)_[a-z](\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "youmediafanpage.akamaized.net") {
            return src.replace(/(\/gallery\/+[0-9a-f]+_[0-9a-f]+_)p[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1o$2");
        }

        if (domain_nosub === "hayatapp.com" &&
            domain.match(/^cdn-media-[0-9]+\./)) {
            return src.replace(/(\/uploads\/+backend_wysiwyg_asset\/+asset\/+)[a-z]+_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "static.klix.ba") {
            return src.replace(/(\/media\/+images\/+vijesti\/+[0-9]+\.[0-9]+)(?:_[a-z]+)?(\.[^/.]*)(?:[?#].*)?$/,
                               "$1_mn$2");
        }

        if (domain === "img.nga.178.com") {
            return src.replace(/(\/attachments\/+[^/]*_[0-9]{6}\/+[0-9]+\/+[^/]*)\.thumb\.[^/.]*(?:[?#].*)?$/,
                               "$1");
        }

        if (domain_nowww === "livesport.ru") {
            return src.replace(/\/picture--[0-9]+(\.[^/.]*)(?:[?#].*)$/, "/picture$1");
        }

        if (domain_nowww === "vseprosport.ru") {
            return src.replace(/(\/images\/+uploads[0-9]+\/+)thumbs\/+[0-9]+x[0-9]+\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "evrimagaci.org") {
            return src.replace(/\/public\/+content_media\/+[0-9]+\/+/, "/public/content_media/");
        }

        if (domain_nowww === "jagranimages.com") {
            return src.replace(/(\/images\/+[0-9]{2}_[0-9]{2}_[0-9]{4}-[^-/_]+)_[a-z](\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "cdn.doctailieu.com") {
            return src.replace(/(\/images\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[^/]*)-rs[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "cdn-redfin.com") {
            return src.replace(/(\/photo\/+[0-9]+\/+)[^/]*\/+([0-9]+\/+)[^/.]*\.((?:[0-9A-Z]+-)?[0-9A-Z]+_[0-9A-Z]+(?:_[0-9A-Z]+)?\.[^/.]*)(?:[?#].*)?$/,
                               "$1bigphoto/$2$3");
        }

        if (domain === "images.estately.net") {
            return src.replace(/_[0-9]+x[0-9]+[a-z]?(\.[^/.]*)(?:[?#].*)?$/,
                               "$1");
        }

        if (domain_nowww === "mjolbybillack.se") {
            return src.replace(/\/img\/+media\/+[sl]_/, "/img/media/");
        }

        if (domain_nowww === "mathworks.com") {
            return src.replace(/\/responsive_image\/+(?:[0-9]+\/+){5}cache\/+/, "/");
        }

        if (domain === "images.kz.prom.st") {
            return src.replace(/(:\/\/[^/]*\/[0-9]+)(?:_[wh][0-9]+){1,}(_[^/]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "treesale.sccd.org") {
            newsrc = urljoin(src, src.replace(/^[a-z]+:\/\/[^/]*\/thumbnail\.asp.*?[?&]file=([^&]*).*?$/,
                                              "$1"), true);
            if (newsrc !== src)
                return newsrc;

            return src.replace(/(\/assets\/+images\/+[^/]+)_thumbnail(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "zive.cz") {
            return src.replace(/\/GetThumbNail\.aspx.*?[?&](id_file=[0-9]+).*?$/,
                               "/GetFile.aspx?$1");
        }

        if (domain === "hasbrouck.asu.edu") {
            regex = /(\/imglib\/+.*)_[a-z]+(\.[^/.]*)(?:[?#].*)?$/;
            return [
                src.replace(regex, "$1_lg$2"),
                src.replace(regex, "$1_web$2")
            ];
        }

        if (domain_nowww === "parsstock.ir") {
            return {
                url: src.replace(/(:\/\/[^/]*\/)thumbs\/+([0-9]+\/)/, "$1photos/$2"),
                problems: {
                    watermark: true
                }
            };
        }

        if (domain === "media.istockphoto.com") {
            return {
                url: src.replace(/(\/photos\/+[^/]*-id[0-9]+)\?s=[0-9]+x[0-9]+$/, "$1"),
                problems: {
                    watermark: true
                }
            };
        }

        if (domain === "img.pixers.pics") {
            return src
                .replace(/:\/\/[^/]*\/pho_wat[(]s3:([^,)]*).*/, "://s3.pixers.pics/pixers/$1")
                .replace(/:\/\/[^/]*\/pho_wat[(]cms:([^,)]*).*/, "://s3.pixers.pics/cms/$1");
        }

        if (domain === "d7hftxdivxxvm.cloudfront.net") {
            return decodeURIComponent(src.replace(/^[a-z]+:\/\/[^/]*\/.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain === "d32dm0rphc51dk.cloudfront.net") {
            return src.replace(/\/large(\.[^/.]*)(?:[?#].*)?$/, "/larger$1");
        }

        if (domain_nowww === "royalparks.org.uk") {
            return src.replace(/(\/_gallery\/+[^/]*\.[^/.]*)\/+[^/]*\.[^/.]*(?:[?#].*)?$/, "$1");
        }

        if (domain === "cdn.downtoearth.org.in") {
            return src.replace(/\/library\/+[a-z]+\/+([0-9]{4}-[0-9]{2}-[0-9]{2}\/)/, "/library/original/$1");
        }

        if (domain_nowww === "arborday.org") {
            return src.replace(/(\/images\/+hero\/+)[a-z]+\/+/, "$1");
        }

        if (domain === "assets.publishing.service.gov.uk") {
            return src.replace(/(\/image_data\/+file\/+[0-9]+\/+)s[0-9]+_([^/]*)(?:[?#].*)?$/, "$1$2");
        }

        if (false && domain === "cf.ltkcdn.net") {
        }

        if (domain === "media.swncdn.com") {
            return src.replace(/\.[0-9]+[wh]\.tn(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain === "media.wnyc.org") {
            return src.replace(/(:\/\/[^/]*\/i)\/+[0-9]+\/+[0-9]+\/+(?:[cl]\/[0-9]+\/)?/, "$1/raw/");
        }

        if (domain_nowww === "tagbrand.com") {
            return src.replace(/(\/uploads\/+[0-9]+\/+[0-9a-f]+)_[a-z](\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "7sur7.be" &&
            domain.match(/^static[0-9]*\./)) {
            return src.replace(/\/media_[a-z]+_([0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "/crop_$1");
        }

        if (domain_nowww === "suryaa.com") {
            return src.replace(/\/thumbnail[0-9]*\/+([^/]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "phapluatdansinh.phapluatxahoi.vn") {
            return src.replace(/\/upload\/+zoom\/+[0-9]+_[0-9]+\/+/, "/upload/");
        }

        if (domain === "assets.sport.ro") {
            return src
                .replace(/\/t_size[0-9]*\/+thumb_/, "/")
                .replace(/_size[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "diarioarapiraca.com.br" ||
            domain_nowww === "todosegundo.com.br") {
            return urljoin(src, decodeuri_ifneeded(src.replace(/^[a-z]+:\/\/[^/]*\/thumbs\.php.*?[?&]imagem=([^&]*).*?$/, "$1")), true);
        }

        if (domain === "static.ilike.com.vn") {
            return src.replace(/\/thumb\/+s[0-9]+\//, "/thumb/origin/");
        }

        if (domain === "b.njus.me") {
            return src.replace(/\/[a-z]_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain_nowww === "wallpaperstream.com") {
            return src.replace(/\/thumbnails\/(.*)_thumb(\.[^/.]*)(?:[?#].*)?$/,
                               "/full/$1$2");
        }

        if (domain_nowww === "wallpapersite.com" &&
            options && options.cb && options.do_request) {
            id = src.replace(/.*\/images\/+pages\/+[^/]*\/+([0-9]+)\.[^/.]*(?:[?#].*)?$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "https://wallpapersite.com/anime/-" + id + ".html",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/<a\s+href=["'](\/images\/wallpapers\/[^'"]*)["']\s+class=["']?original/);
                            if (match) {
                                options.cb(urljoin(src, match[1]));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain === "cdn.record.pt") {
            return src.replace(/(\/images\/+[0-9]{4}-[0-9]{2}\/+)img_[0-9]+x[0-9]+[$]/, "$1OriginalSize$");
        }

        if (domain_nowww === "latestwall.com") {
            newsrc = src
                .replace(/\/imagecache\/+thumb[a-z]+\/+/, "/images/wallpaper/")
                .replace(/\/main-image\/+cache\/+([^/]*)\/+[0-9]+(?:\/+[0-9]+)(?:[?#].*)?$/, "/images/wallpaper/$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/\/download\/+[0-9]+~[0-9]+~([^/]*)(?:[?#].*)?$/, "/images/wallpaper/$1.jpg");
            if (newsrc !== src)
                return add_full_extensions(newsrc);
        }

        if (domain_nosub === "hdxwallpaper.com" && domain.match(/^orig[0-9]*\./)) {
            return {
                url: src.replace(/-[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1"),
                headers: {
                    Referer: "https://hdxwallpaper.com"
                }
            };
        }

        if (domain === "cacheimg.bonsante.fr") {
            return decodeuri_ifneeded(src.replace(/^[a-z]+:\/\/[^/]*\/i\.php.*?[?&]img=([^&]*).*?$/, "$1"));
        }

        if (domain_nowww === "generations.fr") {
            return src.replace(/\/thumb\/+[0-9]+x[0-9]+_([^/]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "images.gsp.ro") {
            return src.replace(/\/thumbs\/+thumb_[0-9]+_x_[0-9]+\//, "/imagini/");
        }

        if (domain === "tt.inf.ua") {
            return src.replace(/(\/files\/+upload\/+(?:[0-9a-f]{2}\/+){3}[0-9a-f]+)\.[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "ckm.pl" && domain.match(/^static[0-9]*\./)) {
            return src.replace(/\/\.thumbnails\/+[0-9]+x[0-9]+\/+/, "/");
        }

        if (domain_nowww === "zurnal.mk") {
            return urljoin(src, decodeuri_ifneeded(src.replace(/^[a-z]+:\/\/[^/]*\/image\.php\/+.*?[?&]image=([^&]*).*?$/, "$1")), true);
        }

        if (domain === "cde.laprensa.e3.pe") {
            return src.replace(/(\/ima\/+(?:[0-9]\/+){5}[0-9]+)\/+[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "myclip.vn" && domain.match(/^static[0-9]*\./)) {
            return src.replace(/(\/image[0-9]*\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[0-9]{2}\/+[0-9a-f]+\/+[-0-9a-f]+)_[0-9]+_[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "elsalvadortimes.com") {
            return src.replace(/\/asset\/+[^/]*\/+media\/+/, "/media/");
        }

        if (domain === "assets.media-platform.com") {
            return src.replace(/(\/images\/+[0-9]{4}\/+(?:[0-9]{2}\/+){2}[0-9]{8}_[^/]*)-[wh][0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "noticiastudoaqui.com") {
            return decodeuri_ifneeded(src.replace(/^[a-z]+:\/\/[^/]*\/tim\.php.*?[?&]src=([^&]*).*?$/, "$1"));
        }

        if (domain === "images.buzzerie.com") {
            return src.replace(/_[0-9]+x[0-9wh]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "cocacolabrasil.com.br") {
            return src.replace(/\.rendition\.[0-9]+\.[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain === "img.uodoo.com") {
            return src.replace(/;,.*/, "");
        }

        if (domain_nowww === "bumm.sk") {
            return src.replace(/(\/uploads\/+news\/+[0-9]+\/+[0-9]+\/+)[0-9]+x[0-9]+\/+/, "$1");
        }

        if (domain === "multimedia.larepublica.pe" ||
            domain === "prod.media.larepublica.pe" ||
            domain === "prod.presets.larepublica.pe") {
            return src.replace(/(:\/\/[^/]*\/)(?:[0-9]+)?x(?:[0-9]+)?\//, "$1x/");
        }

        if (domain_nowww === "wallpaperfm.com") {
            return src.replace(/\/img\/+[a-z]+\/+/, "/img/original/");
        }

        if (domain === "dux7id0k7hacn.cloudfront.net") {
            return src.replace(/(\/cmi\/+(?:[0-9]\/+){4}[0-9]+\/+[^/]*\.[^/.]*)\/.*$/, "$1");
        }

        if (domain_nowww === "printel.biz" ||
            domain_nowww === "steklozerkalo116.ru" ||
            domain_nowww === "studio-14.ru") {
            return src.replace(/\/thumb\/.*(\/d\/+[^/]*\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "10wallpaper.com" &&
            options && options.cb && options.do_request) {
            var id = src.replace(/.*\/wallpaper\/+[^/]*\/+[0-9]+\/+([^/]*)_[^./_]+\.[^/.]*(?:[?#].*)?$/, "$1");
            if (id !== src) {
                options.do_request({
                    url: "https://www.10wallpaper.com/view/" + id + ".html",
                    method: "GET",
                    onload: function(resp) {
                        if (resp.readyState === 4) {
                            var match = resp.responseText.match(/>Original Resolution: <a\s+href=["'](\/wallpaper\/[^'"]+)/);
                            if (match) {
                                options.cb(urljoin(src, match[1], true));
                            } else {
                                options.cb(null);
                            }
                        }
                    }
                });

                return {
                    waiting: true
                };
            }
        }

        if (domain_nosub === "wallpapersok.com" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/\/(?:crop\/+)?(uploads\/+picture\/+[0-9]{3}\/+[0-9]{3}\/+[0-9]+\/+)(?:thumbs_)?([^/?]*)(?:[?#].*)?$/,
                               "/$1$2");
        }

        if (domain_nowww === "woweiquan.com") {
            return decodeuri_ifneeded(src.replace(/^[a-z]+:\/\/[^/]*\/Service\/+Img\/+wx.*?[?&]url=([^&].*)?.*?$/, "$1"));
        }

        if (domain === "s.kaskus.id") {
            return {
                url: src.replace(/\/r[0-9]+x[0-9]+\/+images\/+/, "/images/"),
                headers: {
                    Referer: "https://www.kaskus.co.id"
                }
            };
        }

        if (domain_nowww === "shofona.net") {
            return src.replace(/\/cached_uploads\/+resize\/+[0-9]+\/+[0-9]+\/+/, "/cached_uploads/full/");
        }

        if (domain_nowww === "bayanbox.ir") {
            return src.replace(/\/preview\/+([0-9]+)\/+/, "/view/$1/");
        }

        if (domain_nowww === "guiadasemana.com.br") {
            return src
                .replace(/(\/contentFiles\/+image\/+)opt_[^/]*\/+/, "$1")
                .replace(/(\/contentFiles\/+system\/+pictures\/+[0-9]{4}\/+[0-9]+\/+[0-9]+\/+)[a-z]+\/+/, "$1original/");
        }

        if (domain === "img.arabstoday.net") {
            return src.replace(/(\/[0-9]{4}\/+[0-9]{2}\/+)[a-z]+\/+/, "$1normal/");
        }

        if (domain_nowww === "nodud.com") {
            return src.replace(/\/sized\/+(source\/+.*\/[0-9a-z]+)-[^/]*(\.[^/.]*)(?:[?#].*)?$/, "/$1$2");
        }

        if (domain === "g.acdn.no") {
            newsrc = src.replace(/.*?\/API\/+dynamic\/+r1\/+external\/+[^/]*\/+[^/]*\/+(https?.*?)(?:[?#].*)?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (domain_nowww === "pensorosa.com") {
            return src.replace(/\/upload\/+[a-z]+\/+/, "/upload/images/");
        }

        if (domain === "smlycdn.akamaized.net") {
            return src.replace(/\/products\/+[^/]*\/+[0-9a-f]+\/+([0-9a-f]+)(\.[^/.]*)(?:[?#].*)?$/,
                               "/data/product2/2/$1_l$2");
        }

        if (domain === "cdn.aizel.ru") {
            return src.replace(/\/i\/+[0-9]+x[0-9]+\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/i/$1");
        }

        if (domain_nowww === "trelisecooperonline.com") {
            return src.replace(/\/user\/+images\/+([0-9]+)_[0-9]+_[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "/user/images/$1$2");
        }

        if (domain_nowww === "thairomances.com") {
            return src.replace(/(\/userfiles\/+[^/]*\/+[0-9]+\/+[0-9]+-)[0-9]+x[0-9]+\./, "$1full_size.");
        }

        if (domain === "cn.opendesktop.org") {
            return src.replace(/\/cache\/+[0-9]+x[0-9]+(?:-[a-z0-9]+)?\/+img\/+/, "/img/");
        }

        if (domain_nowww === "3dnews.ru") {
            return src
                .replace(/(\/assets\/.*\/)[a-z]+\.([0-9A-Z]+)\.[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1$2$3")
                .replace(/\/z\/.*?\/([0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[0-9a-f]+\/+[0-9a-fA-Z]+\.[^/.]*)(?:\/+[0-9]+)?(?:[?#].*)?$/,
                         "/assets/external/galleries/$1");
        }

        if (domain === "mix.tn.kz") {
            return src.replace(/\/thumb_[a-z]+\/+(photo_[0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "/$1");
        }

        if (domain === "st.overclockers.ru") {
            return src.replace(/\/c\/+[0-9]+\/+[0-9]+\/+images\//, "/images/");
        }

        if (domain_nosub === "kpcdn.net" &&
            domain.match(/^s[0-9]*\.stc\.all\./)) {
            return src.replace(/(\/share\/+i\/+[0-9]+\/+[0-9]+\/+)(?:inx[0-9]+|[a-z]+)x[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1original$2");
        }

        if (domain_nowww === "oplace.ru") {
            return src.replace(/\/images\/+photos\/+[a-z]+\/+([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "/images/photos/$1");
        }

        if (domain_nosub === "rightinthebox.com" && domain.match(/^li/)) {
            newsrc = src.replace(/(:\/\/[^/]*\/images\/+)[0-9]+x[0-9]+\//, "$1v/");
            if (newsrc !== src) {
                return {
                    url: newsrc,
                    problems: {
                        watermark: true
                    }
                };
            }

            return {
                url: src,
                headers: {
                    Origin: "https://www.lightinthebox.com",
                    Referer: "https://www.lightinthebox.com/"
                }
            };
        }

        if (domain === "img.esportnews.gg") {
            return src.replace(/(\/pictures\/+content\/+[0-9]+\/+[0-9]+)_[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "img.tyt.by") {
            return src.replace(/(:\/\/[^/]*\/)[0-9]+x[0-9]+[a-z]\/+/, "$1");
        }

        if (domain === "vi.ill.in.ua") {
            return src.replace(/(:\/\/[^/]*\/[a-z]\/+)[0-9]+x[0-9]+\/+/, "$10x0/");
        }

        if (domain_nosub === "vsco.co" && domain.match(/^image-aws.*/)) {
            return src.replace(/(\/[0-9a-f]{20,}\/+)[0-9]+x[0-9]+\/+(vsco[0-9a-f]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "screenbeauty.com") {
            return src.replace(/\/image\/+compress\/+/, "/image/wallpapers/");
        }

        if (domain === "e.radio-studio92.io") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\/+([0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[0-9]+(?:_[0-9]+)?\.[^/.]*)(?:[?#].*)?$/,
                               "$1xlarge/$2");
        }

        if (amazon_container === "topdesk") {
            return src.replace(/\/((?:[0-9]{3}\/+){3})[a-z]+\/+([^/]*)(?:[?#].*)?$/, "/$1original/$2");
        }

        if (domain === "static.hdw.eweb4.com") {
            return src.replace(/\/media\/+wp_[0-9]+\/+/, "/media/wallpapers/");
        }

        if (domain_nowww === "sitioandino.com.ar") {
            return src.replace(/(\/files\/+image\/+[0-9]+\/+[0-9]+\/+[0-9a-f]+)_[0-9]+_[0-9]+!(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain === "demo.brainymore.com") {
            return src.replace(/\/thumbs\/+([0-9]+)_[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "/$1$2");
        }

        if (domain_nosub === "1freewallpapers.com" && domain.match(/^data[0-9]*\./)) {
            return src
                .replace(/(:\/\/[^/]*\/)download\/+([^/]+)-[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1original/$2$3")
                .replace(/(:\/\/[^/]*\/)[a-z]+\/+([^/]*\.[^/.]*)(?:[?#].*)?$/, "$1original/$2");
        }

        if (domain_nowww === "downloadwallpapers.info") {
            return src.replace(/(:\/\/[^/]*\/)(?:thumbs|preview|dl\/+[^/]*)\/+([0-9]{4})\/+/, "$1dl/o/$2/");
        }

        if (domain_nowww === "miyanali.com") {
            return src.replace(/(:\/\/[^/]*\/)patch2image\.php.*?[?&]patch=(usr\/[^&]*).*?$/, "$1$2");
        }

        if (domain_nowww === "all4desktop.com") {
            return src.replace(/\/data_images\/+[0-9]+(?:%20|\s)*x(?:%20|\s)*[0-9]+\/+/, "/data_images/original/");
        }

        if (amazon_container === "hsdreams1") {
            return src.replace(/(\/[0-9]{4}\/+[0-9]{2}\/+)[a-z]+(\/+[0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "$1big$2");
        }

        if (domain === "cdn.quotesgram.com") {
            return src.replace(/(:\/\/[^/]*\/)[a-z]+\/+/, "$1img/");
        }

        if (domain_nowww === "razdachi.net" ||
            domain_nowww === "wallpaperfuel.com") {
            return src.replace(/(:\/\/[^/]*\/)thumbnail\/+/, "$1wallpaper/");
        }

        if (domain_nowww === "zazzybabes.com") {
            return src.replace(/\/(girls)\/+([^/]*\/+)thumb-([^/]*\.[^/.]*)(?:[?#].*)?$/, "/$1/$2$3");
        }

        if (domain_nosub === "mtime.cn" && domain.match(/^img[0-9]*\./)) {
            return src.replace(/_[0-9]+X[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain === "images.gutefrage.net") {
            return src.replace(/(\/bilder\/+[^/]*\/+[0-9]+_)[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1original$2");
        }

        if (domain === "v.angel-porns.com") {
            return src.replace(/\/tn(sn[0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (domain === "cdn15764270.ahacdn.me") {
            return src.replace(/(\/galleries\/+[^/]*\/+[0-9a-f]+\/+)[0-9]+x[0-9]+(\/+[^/]*\.[^/.]*)(?:[?#].*)?$/,
                               "$1origin$2");
        }

        if (domain === "images.nubilefilms.com") {
            return src.replace(/\/photos\/+tn\/+([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/photos/$1");
        }

        if (domain === "g.bnrslks.com") {
            return src.replace(/\/tn\/+([^/]*\.[^/.]*)(?:[?#].*)?$/, "/full/$1");
        }

        if (domain_nosub === "joymii.com" && domain.match(/^n[0-9]*\./)) {
            return src.replace(/\/thumbs-[0-9]+x[0-9]+\//, "/fhg/");
        }

        if (domain_nowww === "famechain.com") {
            return src.replace(/\/images\/+resized-image\/+[^/]*\/+([0-9]+)(?:[?#].*)?$/, "/images/image/$1");
        }

        if (domain_nosub === "autoevolution.com" &&
            domain.match(/^s[0-9]*\.cdn\./)) {
            return src.replace(/\/images\/+news-gallery-[0-9]+x\/+([^/]*)-thumbnail(_[0-9]+\.[^/.]*)(?:[?#].*)?$/,
                               "/images/news/gallery/$1$2");
        }

        if (domain === "pics.haircutshairstyles.com") {
            return src.replace(/\/img\/+photos\/+thumbs\/+([0-9]{4}-[0-9]{2})\/+thumb_/,
                               "/img/photos/full/$1/");
        }

        if (domain === "clzmovies.r.sizr.io") {
            return src.replace(/(:\/\/[^/]*\/core\/+[a-z]+\/+)[a-z]+(\/+[0-9a-f]{2}\/+[0-9a-f]{2}_[^/]*)(?:[?#].*)?$/,
                               "$1original$2");
        }

        if (domain === "images.firstpost.com") {
            return src.replace(/\/fpimages\/+[0-9]+x[0-9]+\/+[a-z]+\/+[a-z]+\/+([0-9]{4}\/+[0-9]{2}\/+)/,
                               "/wp-content/uploads/$1");
        }

        if ((domain_nowww === "hustlebunny.com" && src.indexOf("/content/") >= 0) ||
            (domain === "24.p3k.hu" && src.indexOf("/uploads/") >= 0) ||
            (domain === "static.soltana.ma" && src.indexOf("/uploads/") >= 0) ||
            (domain_nowww === "pedestrian.tv" && src.indexOf("/content/") >= 0)) {
            return src
                .replace(/-[0-9]+x[0-9]+(\.[^/.]*)(?:[?#].*)?$/, "$1")
                .replace(/-e[0-9]{8,}(\.[^/.]*)(?:[?#].*)?$/, "$1");
        }

        if (domain_nowww === "vanishingtattoo.com") {
            return src.replace(/_thumbnails\/+([^/]*)_th(_[0-9]+\.[^/.]*)(?:[?#].*)?$/, "_large/$1$2");
        }

        if (domain_nowww === "wallpaperama.com") {
            return src.replace(/(\/post-images\/+wallpapers\/+[a-z]+\/+[^/]*)-t[0-9]+(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nowww === "hashtaglegend.com") {
            return src.replace(/(\/storage\/+app\/+media\/+)cropped-images\/+([^/]*)(?:-[0-9]+){4}-[0-9]{8,}(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2$3");
        }

        if (domain_nowww === "anime-planet.com") {
            return src.replace(/(\/images\/+[a-z]+\/+)thumbs\/+/, "$1");
        }

        if (domain === "di2ponv0v5otw.cloudfront.net" ||
            domain === "dtpmhvbsmffsz.cloudfront.net") {
            return src.replace(/(\/[a-z]+\/+[0-9]{4}\/+[0-9]{2}\/+[0-9]{2}\/+[0-9a-f]+\/+)[a-z]_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (domain_nosub === "freeasianpics.net" && domain.match(/^cdn[0-9]*\./)) {
            return src.replace(/\/_[a-z]_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "/$1");
        }

        if (amazon_container === "nudiez-production") {
            return src.replace(/(\/photos\/(?:[-0-9a-f]{3}\/+){3})[a-z]+\/+data(?:[?#].*)?$/, "$1original/data");
        }

        if (amazon_container === "img.avdbs.com" ||
            domain === "img.avdbs.com") {
            return src.replace(/(\/[0-9]+_[0-9]+_)[sr](\.[^/.]*)(?:[?#].*)?$/, "$1o$2");
        }

        if (domain === "cdn.lengmenjun.com") {
            return src.replace(/!lengmenjun-[0-9]+(?:[?#].*)?$/, "!lengmenjun");
        }

        if (amazon_container === "gallerist") {
            return src.replace(/(\/products\/+[0-9]+\/+)[a-z]+\/+([^/]*)(?:[?#].*)?$/, "$1original/$2");
        }

        if (domain === "dingo.care2.com") {
            return src.replace(/(\/pictures\/+.*\/[0-9]+-[0-9]+-)[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1orig$2");
        }

        if (domain === "newsinteractives.cbc.ca") {
            return src.replace(/(\/images\/+[^/]*\/+)_[a-z]+\/+/, "$1");
        }

        if (domain_nowww === "clipartmax.com") {
            return src.replace(/(:\/\/[^/]*\/(?:png|jpg|jpeg|gif)\/+)[a-z]+\/+/, "$1full/");
        }

        if (domain_nowww === "createphotocalendars.com") {
            return src.replace(/(\/studio\/+generated[a-zA-Z]+\/+[^/]*\/+)thumbs\/+/i, "$1/");
        }

        if (domain_nowww === "larutadelsorigens.cat") {
            return src.replace(/\/filelook\/+[a-z]+\/+/, "/filelook/full/");
        }

        if (domain === "wwcdn.weddingwire.com") {
            return src.replace(/(\/wedding\/+[0-9]+_[0-9]+\/+[0-9]+\/+)thumbnails\/+[0-9]+x[0-9]+_/, "$1");
        }

        if (domain_nowww === "weddingandpartynetwork.com") {
            return src.replace(/\/gallery\/+photos\/+thumb\/+([0-9]+)(?:[?#].*)?$/, "/gallery/photos/$1");
        }

        if (domain_nowww === "sandinyoureye.co.uk") {
            return src.replace(/\/files\/+gallery\/+_[0-9]+x[0-9]+_[^/]*\/+/, "/files/gallery/");
        }

        if (amazon_container === "static.lovely-media.jp") {
            return src.replace(/(\/(?:[0-9]{3}\/+){3})[a-z]+(\.[^/.]*)(?:[?#].*)?$/, "$1original$2");
        }

        if (domain_nowww === "foto4ka.com") {
            return src.replace(/(:\/\/[^/]*\/)thumbnails\/+([0-9]+\/+)/, "$1wallpapers/$2");
        }

        if (domain_nowww === "showwallpaper.com") {
            return src.replace(/(\/wallpaper\/+[0-9]+\/+)tn_([0-9]+\.[^/.]*)(?:[?#].*)?$/, "$1$2");
        }

        if (domain_nosub === "cduniverse.ws" && domain.match(/^c[0-9]*\./)) {
            return src.replace(/(\/resized[a-z]*\/+)[0-9]+x[0-9]+\/+/, "$19000x9000/");
        }


































































































































































































        if (src.match(/\/ImageGen\.ashx\?/)) {
            return urljoin(src, src.replace(/.*\/ImageGen\.ashx.*?image=([^&]*).*/, "$1"));
        }

        if (src.search(/(?::\/\/[^/]*\/(gallery|photos|photogallery)|:\/\/gallery\.[^/]*)?\/albums\/+[^/]*(?:\/+.*)?\/+(normal|thumb|userpics)_[^/.]*\.[^/.]*$/) >= 0) {
            newsrc = src.replace(/(\/albums\/.*\/)[a-z]*_([^/.]*\.[^/.]*)$/, "$1$2");
            if (newsrc !== src)
                return newsrc;
        }

        if (src.match(/\/data\/[^/]*\/[^/]*\/(?:_thumb\/[^/]*\/|thumbs\/)?[^/]*$/)) {
            return src
                .replace(/\/thumb-([^/]*)_[0-9]+x[0-9]+(\.[^/.]*)$/, "/$1$2")
                .replace(/(\/data\/[^/]*\/[0-9]+\/)_thumb\/[0-9]+x[0-9]_[0-9]+\//, "$1")
                .replace(/(\/data\/[^/]*\/[0-9]+\/)thumbs\//, "$1");
        }

        if (src.search(/\/phpwas\/restmb_[a-z]*make\.php\?/) >= 0) {
            if (domain === "cgeimage.commutil.kr" ||
                domain === "cliimage.commutil.kr") {
                src = src.replace(/\/phpwas\/restmb_[a-z]*make\.php/, "/phpwas/restmb_allidxmake.php");
            }

            if (domain.indexOf("nimage.") === 0) {
                newsrc = src.replace(/\/phpwas\/restmb_idxmake\.php.*?simg=([0-9]{4})([0-9]{2})([0-9]{2})([^&]*).*?$/, "/photo/$1/$2/$3/$1$2$3$4");
                if (newsrc !== src)
                    return newsrc;
            }

            if (domain === "res.heraldm.com" &&
                decodeURIComponent(src.match(/simg=([^&]*)/)[1])[0] === "/") {
                return urljoin(src, decodeURIComponent(src.match(/simg=([^&]*)/)[1]));
            }

            return src.replace(/(\/phpwas\/restmb_[a-z]*make\.php)\?.*(simg=[^&]*)/, "$1?idx=999&$2");
        }

        if (src.match(/.*?\/timthumb(?:\/index)?\.php[?/].*?src=(.*)/)) {
            return urljoin(src, decodeURIComponent(src.replace(/.*\/timthumb(?:\/index)?\.php[?/].*?src=([^&]*).*/, "$1")), true);
        }

        if (src.match(/\/fotogallery\/[0-9]+X[0-9]+\//)) {
            return src.replace(/\/fotogallery\/[0-9]+X[0-9]+\//, "/fotogallery/9999999999X0/");
        }

        if (src.indexOf("/redim_recadre_photo.php") >= 0) {
            return src.replace(/.*\/redim_recadre_photo\.php\?.*?path_url=([^&]*).*/, "$1");
        }

        if (src.indexOf("/wp-apps/imrs.php?") >= 0) {
            return src.replace(/.*\/wp-apps\/imrs\.php\?[^/]*src=([^&]*).*/, "$1");
        }

        if (src.match(/\/dynimage\/[^/]*\/[0-9]*\/[^/]*$/)) {
            return src.replace(/\/dynimage\/[^/]*\//, "/dynimage/original/"); // can be anything
        }

        if (src.match(/\/phocagallery\/.*\/thumbs\/[^/]*$/)) {
            return src.replace(/\/thumbs\/phoca_thumb_[^/._]*_/, "/");
        }

        if (src.match(/\/sfc\/servlet\.shepherd\/version\/renditionDownload/)) {
            return src.replace(/\/renditionDownload.*?[?&]versionId=([^&]*).*/, "/download/$1");
        }

        if (domain === "cdn.ome.lt") {
            return src.replace(/(:\/\/[^/]*\/)[-_A-Za-z0-9]+=\/(?:(?:full-)?fit-in\/)?(?:[0-9x:]+\/)?(?:[0-9x:]+\/)?(?:(?:top|center|middle)\/)?(?:(?:smart|top|center|middle)\/)?(?:filters:[^/]*\/)?/, "$1");
        }

        if ((domain_nosub === "vox-cdn.com" && domain.indexOf("cdn.vox-cdn.com") >= 0) ||
            domain === "thumbnails.trvl-media.com" ||
            domain === "thumbor-static.factorymedia.com" ||
            domain === "cdnrockol-rockolcomsrl.netdna-ssl.com" ||
            domain === "thumbor-titelmediaug.netdna-ssl.com" ||
            domain === "www.infobae.com" ||
            (domain_nosub === "glbimg.com" && domain.match(/s[0-9]*\.glbimg\.com/)) ||
            domain === "i.amz.mshcdn.com" ||
            domain === "img.ilcdn.fi" ||
            domain === "img.fstatic.com" ||
            domain === "img.mthcdn.com" ||
            domain === "images.thestar.com" ||
            (domain_nosub === "holidaypirates.com" && domain.match(/thumb[0-9]*\.holidaypirates\.com/)) ||
            domain === "img.yasmina.com" ||
            domain === "resize.abcradio.net.au" ||
            domain === "th.pinkblog.it" ||
            domain === "th.blogosfere.it" ||
            domain === "th.fashionblog.it" ||
            domain === "images.jovempanfm.uol.com.br" ||
            domain === "img.atyabtabkha.com" ||
            domain === "imageresizer.static9.net.au" ||
            domain === "img-ha.mthcdn.com" ||
            domain === "imagenes.milenio.com" ||
            domain_nowww === "dyn.media.titanbooks.com" ||
            domain === "i.osvigaristas.net.br" ||
            domain === "svirtus.cdnvideo.ru" ||
            src.match(/:\/\/[^/]*\/thumbor\/[^/]*=\//) ||
            src.match(/:\/\/[^/]*\/resizer\/[^/]*=\/[0-9]+x[0-9]+(?::[^/]*\/[0-9]+x[0-9]+)?\/(?:filters:[^/]*\/)?/)) {
            newsrc = src.replace(/.*\/(?:thumb(?:or)?|(?:new-)?resizer)\/.*?\/(?:filters:[^/]*\/)?([a-z]*:\/\/.*)/, "$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/.*\/(?:thumb(?:or)?|(?:new-)?resizer)\/.*?\/(?:filters:[^/]*\/)?([^%/]*\..*)/, "http://$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/[-_A-Za-z0-9]{64}\/([^%/]*\.[^/]*\/)/, "http://$1");
            if (newsrc !== src)
                return newsrc;

            newsrc = src.replace(/.*\/[-_A-Za-z0-9]+=\/(?:(?:full-)?fit-in\/)?(?:[0-9x:]+\/)?(?:[0-9x:]+\/)?(?:(?:smart|top|center|middle)\/)?(?:(?:smart|top|center|middle)\/)?(?:filters:[^/]*\/)?((?:https?(?::\/\/|%3[aA]%2[fF]%2[fF]))?[^/%]*\..*)/, "$1");
            if (newsrc.match(/^[^/]*%2/))
                newsrc = decodeURIComponent(newsrc);

            if (newsrc.indexOf("http") !== 0) {
                newsrc = "http://" + newsrc;
            }

            if (newsrc.match(/^[a-z]*%3/) && false)
                newsrc = decodeURIComponent(newsrc);
            return newsrc;
        }

        if (src.match(/:\/\/[^/]*\/astronaut\/uploads\/[a-z]_[^/]*$/)) {
            return src.replace(/\/[a-z]_([^/]*)$/, "/$1");
        }

        if (src.match(/\/spree\/images\/attachments\/[0-9]+\/[0-9]+\/[0-9]+\//) ||
            domain === "d3on60wtl1ot7i.cloudfront.net") {
            return src.replace(/(\/[0-9]+\/[0-9]+\/[0-9]+\/)[^/]*\/([^/?]*)[^/]*?$/, "$1original/$2");
        }

        if (src.match(/\/applications\/core\/interface\/imageproxy\/imageproxy\.php/)) {
            return decodeURIComponent(src.replace(/.*\/imageproxy\/imageproxy\.php.*?[&?]img=([^&]*).*?$/, "$1"));
        }

        if (src.match(/\/dims[0-9]*\/.*?\/(?:(?:(?:thumbnail|resize)\/[0-9>%A-F]+[xX][0-9>%A-F]+[^/]*\/)|(?:crop\/[0-9]+[xX][0-9]+)).*?(?:\/https?:\/\/|\?url=https?%3A)/)) {
            newsrc = src.replace(/.*\/(?:thumbnail|crop|resize)\/.*?\/(https?:\/\/.*)/, "$1");
            if (newsrc !== src)
                return newsrc;
            newsrc = src.replace(/.*\/(?:thumbnail|crop|resize)\/.*?\/\?url=(https?.*)/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);
        }

        if (src.match(/\/dims\/CSFF\/[0-9]+\/[-0-9]+\/[-0-9]+\/[-0-9]+\/https?:\/\//)) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/dims\/CSFF\/[0-9]+\/[-0-9]+\/[-0-9]+\/[-0-9]+\/(https?:\/\/)/, "$1");
            if (newsrc !== src)
                return newsrc;
        }

        if (src.match(/\/media\/k2\/items\/cache\/[^/]*_[^/]*\.[^/.]*$/)) {
            return src.replace(/\/cache\/([^/]*)_[^/._]*?(\.[^/.]*)$/, "/src/$1$2");
        }

        if (src.match(/^[a-z]+:\/\/[^/]*\/index\.php\?.*=com_joomgallery/) ||
            src.match(/^[a-z]+:\/\/[^/]*\/component\/+joomgallery\/+image\./)) {


            if (src.match(/:\/\/[^/]*\/index\.php\?/)) {
                if (url.searchParams.get("option") === "com_joomgallery" &&
                    url.searchParams.get("view") === "image" &&
                    url.searchParams.get("id")) {
                    return src.replace(/(:\/\/[^/]*\/).*/, "$1component/joomgallery/image.raw?view=image&type=orig&format=raw&option=com_joomgallery&id=" + url.searchParams.get("id"));
                }
            }

            return src.replace(/\/component\/joomgallery\/image\..*?[?&]id=([0-9]+).*?$/, "/component/joomgallery/image.raw?view=image&type=orig&format=raw&option=com_joomgallery&id=$1");
        }

        if (src.match(/:\/\/[^/]*\/proxy\.php.*?[?&]image=http/)) {
            return decodeURIComponent(src.replace(/.*:\/\/[^/]*\/proxy\.php.*?[?&]image=(http[^&]*).*/, "$1"));
        }

        if (src.match(/\/media\/photologue\/photos\/cache\//)) {
            return src.replace(/\/cache\/([^/]*)_[a-z]+(\.[^/.]*)$/, "/$1$2");
        }

        if (src.match(/\/\.evocache\/([^/]*\.[^/]*)\/fit-[0-9]+x[0-9]+\.[^/.]*$/)) {
            return src.replace(/\/\.evocache\/([^/]*\.[^/]*)\/[^/]*$/, "/$1");
        }

        if (src.match(/:\/\/[^/]*\/yahoo_site_admin[0-9]*\/assets\/images\//)) {
            return src.replace(/(\.[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if (domain_nowww === "dvdprime.com" ||
            src.match(/\/data\/cheditor[0-9]*\/[0-9]+\/view_thumbnail\/[^/]*$/)) {
            return src.replace(/\/view_thumbnail\/([^/]*)$/, "/$1");
        }

        if (src.match(/\/images\/easyblog_articles\/[0-9]+\/b2ap3_[^/]*$/)) {
            return src.replace(/\/b2ap3_[a-z]+_([^/]*)$/, "/$1");
        }

        if (src.match(/\/wp-content\/plugins\/BdSGallery\//)) {
            return src.replace(/(\/BdSGallery\/BdSGaleria\/[0-9]+)_[a-z]+(\.[^/.]*)$/, "$1$2");
        }

        if ((((domain_nosub === "fbcdn.net" &&
               domain.match(/^external\..*\.fbcdn\.net/)) ||
              domain === "img.globuya.com" ||
              domain === "img.gluseum.com" ||
              domain === "img.govserv.org" ||
              domain === "img.gleauty.com") || (
                  src.match(/^[a-z]+:\/\/[^/]*\/2\/safe_image\.php.*?[?&]url=http/)
              )) && src.indexOf("safe_image.php") >= 0) {
            return decodeURIComponent(src.replace(/.*safe_image\.php.*?[?&]url=([^&]*).*/, "$1"));
        }

        if (src.match(/^[a-z]+:\/\/[^/]*\/product_photos\/[0-9]+\/[^/.]*_[^/.]*\.[^/.]*$/)) {
            return src.replace(/(\/product_photos\/[0-9]+\/[^/]*)_[^/._]*(\.[^/.]*)$/, "$1_original$2");
        }

        if (domain_nowww === "beckygworld.com" ||
            domain_nowww === "mariahsworld.com" ||
            domain_nowww === "nferaclub.com" ||
            domain_nowww === "tdjakes.com" ||
            src.match(/^[a-z]+:\/\/[^/]*\/public\/img\/posts\/photos\/[0-9]+_[0-9a-f]+_[a-z]\.[^/.]*$/)) {
            return src.replace(/(\/img\/posts\/photos\/[0-9]+_[0-9a-f]+)_[a-z](\.[^/.]*)$/, "$1$2");
        }

        if (src.match(/\/wp-content\/uploads\/(?:.*?\/)?nggallery\/(?:.*?\/)?dynamic\/[^/]*\.[^-_/.]*-nggid[0-9]+-ngg0dyn-[^/]*$/)) {
            return src.replace(/\/dynamic(\/[^/]*\.[^-_/.]*)-[^/]*$/, "$1");
        }

        if (src.match(/\/+wp-content\/+uploads\/+cache\/+[0-9]{4}\/+[0-9]{2}\/+[^/]*\/+[0-9]+\.[^/.]*(?:[?#].*)?$/)) {
            return src.replace(/\/+wp-content\/+uploads\/+cache\/+([0-9]{4}\/+[0-9]{2}\/+[^/]*)\/+[0-9]+(\.[^/.]*)([?#].*)?$/,
                               "/wp-content/uploads/$1$2$3");
        }

        if (src.match(/\/+wp-content\/+gallery\/+[^/]*\/+thumbs\/+thumbs_([^/]*\.[^/.]*)(?:[?#].*)?$/)) {
            return src.replace(/(\/+wp-content\/+gallery\/+[^/]*\/+)thumbs\/+thumbs_([^/]*\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2");
        }

        if (src.match(/\/+wp-content\/+plugins\/+doptg\/+uploads\/+thumbs\/+/)) {
            return src.replace(/\/+wp-content\/+plugins\/+doptg\/+uploads\/+thumbs\/+/, "/wp-content/plugins/doptg/uploads/");
        }

        if (src.match(/\/wp-content\/+plugins\/+phastpress\/+phast\.php\/+/)) {
            newsrc = src.replace(/.*\/wp-content\/+plugins\/+phastpress\/+phast\.php\/+([^/]*)\/.*?$/, "$1");
            if (newsrc !== src) {
                return newsrc.replace(/(-[0-9A-F][0-9A-F])/g, function(x){return decodeURIComponent(x.replace(/^-/, "%"));});
            }
        }

        if (domain_nowww === "krauzer.ru" ||
            domain === "kino.tricolor.tv" ||
            domain_nosub === "prostitutki.today" ||
            domain_nowww === "menslife.com" ||
            domain_nowww === "sncmedia.ru" ||
            src.match(/:\/\/[^/]*\/upload\/+resize_cache\/+iblock\/+[0-9a-f]{3}\/+[0-9]+_[0-9]+_/) ||
            src.match(/:\/\/[^/]*\/(?:upload\/+)?resize_cache_imm\/+iblock\/+[0-9a-f]{3}\/+[0-9a-f]{4}\/+[0-9]+x[0-9]+_Quality[0-9]+_[0-9a-f]+\./)) {
            return src
                .replace(/\/resize_cache(\/.*\/)[0-9]+_[0-9]+_[0-9]+\/([0-9a-f]+(?:-[0-9]+x[0-9]+)?\.[^/.]*)$/, "$1$2")
                .replace(/\/resize_cache(\/.*\/)[0-9]+_[0-9]+_[0-9a-f]+\/([^\.]+(?:-[0-9]+x[0-9]+)?\.[^/.]*)$/, "$1$2")
                .replace(/\/resize_cache_imm\/+(iblock\/+[0-9a-f]{3}\/+)[0-9a-f]{4}\/+[0-9]+x[0-9]+_Quality[0-9]+_([0-9a-f]+\.[^/.]*)(?:[?#].*)?$/, "/$1$2");
        }

        if (domain === "storage.journaldemontreal.com" ||
            domain === "storage.torontosun.com" ||
            domain === "storage.ottawasun.com" ||
            domain === "storage.chathamthisweek.com" ||
            domain === "storage.journaldequebec.com" ||
            domain === "storage.journaldemontreal.com" ||
            domain === "storage.canoe.com" ||
            domain === "storage-cube.quebecormedia.com" ||
            src.match(/^[a-z]+:\/\/storage\.[^/]*\/v[0-9]*\/dynamic_resize\/sws_path\//)) {
            newsrc = src.replace(/^[a-z]+:\/\/[^/]*\/v[0-9]*\/dynamic_resize\/*.*?[?&]src=([^&]*).*?$/, "$1");
            if (newsrc !== src)
                return decodeURIComponent(newsrc);

            newsrc = src
                .replace(/\/dynamic_resize\/sws_path\//, "/")
                .replace(/_(?:JDX-[0-9]+x[0-9]+_[A-Z]+|LARGE_BOX)(\.[^/.]*)$/, "_ORIGINAL$1")
                .replace(/\?[^/]*$/, "");
            if (newsrc !== src)
                return newsrc;

            return {
                url: src,
                head_wrong_contenttype: true
            };
        }

        if (domain === "upload.wikimedia.org" ||
            domain_nowww === "generasia.com" ||
            domain === "cdn.wikimg.net" ||
            domain === "liquipedia.net" ||
            domain === "i.know.cf" ||
            src.match(/\/thumb\/.\/..\/[^/]*\.[^/]*\/[0-9]*px-/)) {
            newsrc = src.replace(/\/(?:thumb\/)?(.)\/(..)\/([^/]*)\/.*/, "/$1/$2/$3");
            if (newsrc !== src)
                return newsrc;
        }

        if (src.match(/\/uploads\/+monthly_[0-9]{2}_[0-9]{4}\/+post-[0-9]+-[0-9]+-[0-9]+-[0-9]+(?:_thumb)\.[^/]*(?:[?#].*)?/)) {
            return src.replace(/(\/uploads\/+monthly_[0-9]{2}_[0-9]{4}\/+post-[0-9]+-[0-9]+-[0-9]+-[0-9]+)_thumb(\.[^/.]*)(?:[?#].*)?$/,
                               "$1$2")
        }

        if (domain_nowww === "wikitoes.com" ||
            src.match(/\/lib\/+exe\/+fetch\.php.*?[?&]media=[^&]*.*?$/)) {
            return src.replace(/\/lib\/+exe\/+fetch\.php.*?[?&](media=[^&]*).*?$/,
                               "/lib/exe/fetch.php?$1");
        }


















        if (domain === "blogs-images.forbes.com" ||
            domain === "images-origin.playboy.com" ||
            domain === "images.kpopstarz.com" ||
            domain === "etimg.etb2bimg.com" ||
            domain_nosub === "thetimes.co.uk" ||
            domain === "mediaresources.idiva.com" ||
            domain === "telugu.samayam.com" ||
            (domain_nosub === "cpcache.com" && domain.match(/^i[0-9]*\./)) ||
            domain_nowww === "filmibeat.com" ||
            domain === "images.contentful.com") {
            return {
                url: src,
                head_wrong_contentlength: true
            };
        }

        if ((domain_nosub === "appspot.com" && domain.match(/^wixmp-[0-9a-f]+\./)) ||
            (domain_nosub === "wixmp.com" && domain.match(/^api-da(?:.*)?\./) && src.indexOf("/download/file") >= 0)) {
            return {
                url: src,
                head_wrong_contentlength: true,
                head_wrong_contenttype: true,
                forces_download: true,
                is_private: true
            };
        }

        if (domain_nowww === "ozanyerli.com" ||
            domain === "cdn.akb48.co.jp") {
            return {
                url: src,
                head_wrong_contenttype: true
            };
        }

        if ((domain === "images.thestar.com" && src.indexOf("/content/dam/") >= 0) ||
            (domain_nowww === "thestar.com" && src.indexOf("/content/dam/") >= 0) ||
            (domain_nosub === "akamaihd.net" && domain.match(/^steamuserimages-[a-z]\./)) ||
            (domain_nosub === "irishmirror.ie" && domain.match(/i[0-9]*(?:-prod)?\./))) {
            return {
                url: src,
                can_head: false
            };
        }

        if (domain_nosub === "radikal.ru" &&
            domain.match(/^s[0-9]*\./)) {
            return {
                url: src,
                headers: {
                    Referer: ""
                }
            };
        }










        if (options.null_if_no_change) {
            if (src !== origsrc)
                return src;
            return null;
        }

        return src;
    }
    // -- end bigimage --

    function get_helpers(options) {
        var host_domain = "";
        var host_domain_nowww = "";
        var host_domain_nosub = "";
        if (options.host_url) {
            host_domain = options.host_url.replace(/^[a-z]+:\/\/([^/]*)(?:\/.*)?$/,"$1");

            host_domain_nowww = host_domain.replace(/^www\./, "");
            host_domain_nosub = host_domain.replace(/^.*\.([^.]*\.[^.]*)$/, "$1");
            if (host_domain_nosub.match(/^co\.[a-z]{2}$/)) {
                host_domain_nosub = host_domain.replace(/^.*\.([^.]*\.[^.]*\.[^.]*)$/, "$1");
            }
        }



        if (host_domain_nosub === "imgur.com") {
            return {
                gallery: function(el, nextprev) {
                    if (!el)
                        return null;

                    try {
                        var images = unsafeWindow.runSlots.item.album_images.images;
                        var current_hash = bigimage_recursive(el.src, {fill_object: true})[0].url.replace(/.*\/([^/._]*?)\.[^/.]*?(?:[?#].*)?$/, "$1");
                        if (current_hash !== el.src) {
                            for (var i = 0; i < images.length; i++) {
                                if (images[i].hash === current_hash) {
                                    var image_id;
                                    if (nextprev) {
                                        if (i + 1 >= images.length)
                                            return null;

                                        image_id = i + 1;
                                    } else {
                                        if (i - 1 < 0)
                                            return null;

                                        image_id = i - 1;
                                    }

                                    // Convert videos to images for now, until video support is properly added
                                    // for the popup
                                    var ext = images[image_id].ext;
                                    if (ext === ".mp4" || ext === ".webm")
                                        ext = ".jpg";

                                    var newel = document.createElement("img");
                                    newel.src = "https://i.imgur.com/" + images[image_id].hash + ext;
                                    return newel;
                                }
                            }
                        }
                    } catch (e) {
                        console.error(e);
                    }

                    var current = el;
                    while ((current = current.parentElement)) {
                        if (current.tagName === "DIV" &&
                            current.classList && current.classList.contains("post-image-container")) {
                            while (current) {
                                var next = current.nextElementSibling;
                                if (!nextprev)
                                    next = current.previousElementSibling;

                                current = next;
                                if (!current)
                                    return null;

                                var img = current.querySelector("img");
                                if (img) {
                                    return img;
                                }
                            }
                        }
                    }

                    return null;
                }
            };
        }

        return null;
    }

    var fullurl_obj = function(currenturl, obj) {
        if (!obj)
            return obj;

        if (!(obj instanceof Array)) {
            obj = [obj];
        }

        var newobj = [];
        obj.forEach(function (url) {
            if (typeof(url) === "string") {
                newobj.push(fullurl(currenturl, url));
            } else {
                if (url.url) {
                    if (url.url instanceof Array) {
                        for (var i = 0; i < url.url.length; i++) {
                            url.url[i] = fullurl(currenturl, url.url[i]);
                        }
                    } else {
                        url.url = fullurl(currenturl, url.url);
                    }
                }
                newobj.push(url);
            }
        });

        return newobj;
    };

    var fillobj = function(obj, baseobj) {
        //if (typeof obj === "undefined")
        if (!obj)
            return [];

        if (!(obj instanceof Array)) {
            obj = [obj];
        }

        if (!baseobj)
            baseobj = {};

        if (baseobj instanceof Array)
            baseobj = baseobj[0];

        for (var i = 0; i < obj.length; i++) {
            if (typeof(obj[i]) === "undefined") {
                continue;
            }

            if (typeof(obj[i]) === "string") {
                obj[i] = {url: obj[i]};
            }

            var item;
            for (item in baseobj) {
                if (!(item in obj[i])) {
                    obj[i][item] = baseobj[item];
                }
            }

            for (item in default_object) {
                if (!(item in obj[i])) {
                    obj[i][item] = default_object[item];
                }
            }
        }

        return obj;
    };

    var same_url = function(url, obj) {
        obj = fillobj(obj);

        if (obj[0] && obj[0].url === url)
            return true;

        return false;

        for (var i = 0; i < obj.length; i++) {
            // handle !obj.url?
            if (obj[i].url === url)
                return true;
        }

        return false;
    };

    var bigimage_recursive = function(url, options) {
        if (!url)
            return url;

        if (!options)
            options = {};

        for (var option in default_options) {
            if (!(option in options)) {
                options[option] = default_options[option];
            }
        }

        if (is_userscript || is_extension) {
            for (var option in settings) {
                if (settings[option] && option in option_to_problems) {
                    options.exclude_problems.splice(options.exclude_problems.indexOf(option_to_problems[option]), 1);
                }
            }
        }

        var waiting = false;

        var newhref = url;
        var currenthref = url;
        var pasthrefs = [url];
        var lastobj = fillobj(newhref);
        var pastobjs = [];
        var currentobj = null;
        var used_cache = false;
        var i = 0;

        var do_cache = function() {
            if (!newhref || !currentobj)
                return;

            currenthref = get_currenthref(fillobj(newhref, currentobj));
            if (!used_cache && options.use_cache && !waiting) {
                for (var i = 0; i < pasthrefs.length; i++) {
                    var href = pasthrefs[i];

                    if (href !== currenthref || true)
                        url_cache[href] = newhref;
                }
            }
        };

        var get_currenthref = function(objified) {
            if (!objified) {
                return objified;
            }

            if (objified instanceof Array) {
                objified = objified[0];
            }

            if (!objified) {
                return objified;
            }

            if (objified.url instanceof Array)
                currenthref = objified.url[0];
            else
                currenthref = objified.url;
            return currenthref;
        };

        var parse_bigimage = function(big) {
            if (!big) {
                if (newhref === url && options.null_if_no_change)
                    newhref = big;
                return false;
            }

            var newhref1 = fullurl_obj(currenthref, big);
            if (!newhref1) {
                return false;
            }

            var important_properties = {};
            if (pastobjs.length > 0 && pastobjs[0].likely_broken) {
                important_properties.likely_broken = pastobjs[0].likely_broken;
            }

            var objified = fillobj(deepcopy(newhref1), important_properties);

            for (var i = 0; i < objified.length; i++) {
                var obj = objified[i];

                if (obj.url === null && !obj.waiting) {
                    objified.splice(i, 1);
                    if (newhref1 instanceof Array) {
                        newhref1.splice(i, 1);
                    }

                    i--;
                    continue;
                }

                for (var problem in obj.problems) {
                    if (obj.problems[problem] &&
                        options.exclude_problems.indexOf(problem) >= 0) {
                        objified.splice(i, 1);
                        if (newhref1 instanceof Array) {
                            newhref1.splice(i, 1);
                        }

                        i--;
                    }
                }
            }

            if (objified.length === 0) {
                return false;
            }

            waiting = false;
            var temp_newhref1 = newhref1;
            if (newhref1 instanceof Array)
                temp_newhref1 = newhref1[0];
            if (typeof(temp_newhref1) === "object") {
                currentobj = newhref1;
                if (temp_newhref1.waiting) {
                    waiting = true;
                    if (!temp_newhref1.url) {
                        newhref = newhref1;
                        return false;
                    }
                }
            } else {
                currentobj = null;
            }

            if (same_url(currenthref, objified)) {
                return false;
            } else {
                for (var i = 0; i < pasthrefs.length; i++) {
                    if (same_url(pasthrefs[i], objified)) {
                        return false;
                    }
                }
                currenthref = get_currenthref(objified);
                newhref = newhref1;
            }

            pasthrefs.push(currenthref);
            var current_pastobjs = [];
            for (var i = 0; i < objified.length; i++) {
                current_pastobjs.push(objified[i]);
            }

            for (var i = 0; i < pastobjs.length; i++) {
                current_pastobjs.push(pastobjs[i]);
            }

            pastobjs = current_pastobjs;

            if (!waiting)
                lastobj = newhref;

            if (objified[0].norecurse)
                return false;

            if (_nir_debug_) {
                return false;
            }

            return true;
        };

        var do_bigimage = function() {
            if (options.use_cache && (currenthref in url_cache)) {
                newhref = url_cache[currenthref];
                used_cache = true;
                return false;
            }

            var big;

            try {
                big = bigimage(currenthref, options);
            } catch(e) {
                console_error(e);
                console_error(e.stack);
            }

            return parse_bigimage(big);
        };

        var finalize = function() {
            if (options.fill_object) {
                newhref = fillobj(newhref, currentobj);

                if (options.include_pastobjs) {
                    for (var i = 0; i < pastobjs.length; i++) {
                        if (obj_indexOf(newhref, pastobjs[i].url) < 0 && !pastobjs[i].fake)
                            newhref.push(pastobjs[i]);
                    }
                }
            }
        };

        var cb = null;
        if (options.cb) {
            var orig_cb = options.cb;
            options.cb = function(x) {
                var do_end = function() {
                    finalize();
                    do_cache();

                    var blankurl = null;
                    if (!options.null_if_no_change)
                        blankurl = pasthrefs[pasthrefs.length - 1];

                    if (!newhref || (newhref instanceof Array && !newhref[0])) {
                        newhref = blankurl;
                    } else if (typeof newhref === "string") {
                        newhref = blankurl;
                    } else if (newhref instanceof Array && typeof newhref[0] === "string") {
                        newhref[0] = blankurl;
                    } else if (newhref instanceof Array && newhref[0] && !newhref[0].url) {
                        newhref[0].url = blankurl;
                    }

                    orig_cb(newhref);
                };

                if (!parse_bigimage(x) || (i + 1) >= options.iterations) {
                    do_end();
                } else {
                    for (; i < options.iterations; i++) {
                        if (!do_bigimage()) {
                            break;
                        }
                    }

                    if (!waiting) {
                        do_end();
                    }
                }
            };
        }

        for (i = 0; i < options.iterations; i++) {
            if (!do_bigimage())
                break;
        }

        finalize();
        do_cache();

        if (options.cb && !waiting) {
            options.cb(newhref);
        }

        return newhref;
    };

    var obj_to_simplelist = function(obj) {
        var out = [];
        for (var i = 0; i < obj.length; i++) {
            out.push(obj[i].url);
        }
        return out;
    };

    var obj_indexOf = function(obj, url) {
        return obj_to_simplelist(obj).indexOf(url);
    };

    var bigimage_recursive_loop = function(url, options, query, fine_urls, tried_urls) {
        var newoptions = {};
        if (!fine_urls) {
            fine_urls = [];
        }

        if (!tried_urls) {
            tried_urls = [];
        }

        for (var option in options) {
            if (option === "cb") {
                newoptions.cb = function(obj) {
                    var images = obj_to_simplelist(obj);

                    for (var i = 0; i < fine_urls.length; i++) {
                        var index = images.indexOf(fine_urls[i][0]);
                        if (index >= 0) {
                            obj = [obj[index]];
                            return options.cb(obj, fine_urls[i][1]);
                        }
                    }

                    for (var i = 0; i < tried_urls.length; i++) {
                        if (tried_urls[i][0] === url) {
                            var index = images.indexOf(tried_urls[i][2]);
                            if (index >= 0) {
                                obj = [obj[index]];
                                return options.cb(obj, tried_urls[i][1]);
                            } else {
                                return options.cb(null, tried_urls[i][1]);
                            }
                        }
                    }

                    query(obj, function(newurl, data) {
                        if (!newurl) {
                            return options.cb(null, data);
                        }

                        fine_urls.push([newurl, data]);
                        tried_urls.push([url, data, newurl]);

                        //if (images.indexOf(newurl) < 0 && newurl !== url || true) {
                        if (images.indexOf(newurl) < 0 || !obj[images.indexOf(newurl)].norecurse) {
                            bigimage_recursive_loop(newurl, options, query, fine_urls, tried_urls);
                        } else {
                            //obj = obj.slice(images.indexOf(newurl));
                            obj = [obj[images.indexOf(newurl)]];
                            options.cb(obj, data);
                        }
                    });
                };
            } else {
                newoptions[option] = options[option];
            }
        }
        return bigimage_recursive(url, newoptions);
    };

    var send_redirect = function(obj, cb) {
        if (is_extension) {
            extension_send_message({
                type: "redirect",
                data: obj
            }, function() {
                cb();
            });
        } else {
            cb();
        }
    };

    var redirect = function(url, obj) {
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

        send_redirect(obj, function() {
            if (settings.redirect_history) {
                document.location = url;
            } else {
                window.location.replace(url);
            }
        });
    };

    var cursor_wait = function() {
        document.documentElement.style.cursor = "wait";
    };

    var cursor_default = function() {
        document.documentElement.style.cursor = "default";
    };


    var infobox_timer = null;
    var show_image_infobox = function(text) {
        var div = document.createElement("div");
        div.style.backgroundColor = "#fffabb";
        div.style.position = "absolute";
        div.style.top = "0px";
        div.style.left = "0px";
        div.style.padding = ".4em .8em";
        div.style.boxShadow = "0px 0px 20px rgba(0,0,0,.6)";
        div.style.margin = ".8em";

        div.innerHTML = text;

        div.onclick = function() {
            document.body.removeChild(div);

            if (infobox_timer) {
                clearTimeout(infobox_timer);
                infobox_timer = null;
            }
        };

        document.body.appendChild(div);

        var do_timeout = function() {
            if (infobox_timer)
                return;

            infobox_timer = setTimeout(function() {
                document.body.removeChild(div);
            }, 7000);
        };

        if (document.hasFocus()) {
            do_timeout();
        } else {
            document.onfocus = function() {
                do_timeout();
                document.onfocus = null;
            };

            window.onfocus = function() {
                do_timeout();
                window.onfocus = null;
            };
        }
    };

    var check_ok_error = function(ok_errors, error) {
        if (ok_errors && ok_errors instanceof Array) {
            for (var i = 0; i < ok_errors.length; i++) {
                if (error.toString() === ok_errors[i].toString()) {
                    return true;
                }
            }

            return false;
        }

        return null;
    };

    var get_trigger_key_text = function(list) {
        list = list.sort(function(a, b) {
            if (a === b)
                return 0;

            if (a === "ctrl")
                return -1;
            if (b === "ctrl")
                return 1;
            if (a === "shift")
                return -1;
            if (b === "shift")
                return 1;
            if (a === "super")
                return -1;
            if (b === "super")
                return 1;
            if (a === "alt")
                return -1;
            if (b === "alt")
                return 1;
            if (a < b)
                return -1;
            if (b > a)
                return 1;
        });

        var newlist = [];
        for (var i = 0; i < list.length; i++) {
            newlist.push(list[i].charAt(0).toUpperCase() + list[i].slice(1));
        }

        return newlist.join("+");
    };

    var check_image = function(obj, err_cb, ok_cb) {
        if (obj instanceof Array) {
            obj = obj[0];
        }

        if (!obj || !obj.url) {
            ok_cb(obj);
            return;
        }

        var url = obj.url;
        var err_txt;

        if (url === document.location.href) {
            ok_cb(url);
        } else  {
            var headers = obj.headers;
            console_log(obj.url);

            if (obj && obj.bad) {
                err_txt = "Bad image";
                if (err_cb) {
                    err_cb(err_txt);
                } else {
                    console_error(err_txt);
                }
                return;
            }

            var mouseover_text = function(reason) {
                var mouseover;
                if (!settings.mouseover) {
                    mouseover = "disabled";
                } else if (settings.mouseover_trigger_behavior === "keyboard") {
                    mouseover = get_trigger_key_text(settings.mouseover_trigger_key);
                } else if (settings.mouseover_trigger_behavior === "mouse") {
                    mouseover = "delay " + settings.mouseover_trigger_delay + "s";
                }

                show_image_infobox("Mouseover popup (<a style='color:blue; font-weight:bold' href='" + options_page + "' target='_blank'>" + mouseover + "</a>) is needed to display the original version (" + reason + ")");
            };

            if (!_nir_debug_ || !_nir_debug_.no_request) {
                cursor_wait();

                var url_domain = url.replace(/^([a-z]+:\/\/[^/]*).*?$/, "$1");

                var origheaders = deepcopy(headers);

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

                if (customheaders && !is_extension) {
                    document.documentElement.style.cursor = "default";
                    console_log("Custom headers needed, currently unhandled");

                    mouseover_text("custom headers");
                    return;
                }

                if (_nir_debug_)
                    console.dir(headers);

                do_request({
                    method: 'HEAD',
                    url: url,
                    headers: headers,
                    onload: function(resp) {
                        if (_nir_debug_)
                            console.dir(resp);

                        // nano defender removes this.DONE
                        if (resp.readyState == 4) {
                            cursor_default();

                            if (resp.finalUrl === document.location.href) {
                                console_log(resp.finalUrl);
                                console_log("Same URL");
                                return;
                            }

                            var headers = {};
                            var headers_splitted = resp.responseHeaders.split("\n");
                            headers_splitted.forEach(function (header) {
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

                            var ok_error = check_ok_error(obj.head_ok_errors, resp.status);

                            if (((digit === "4" || digit === "5") &&
                                 resp.status !== 405) &&
                                ok_error !== true) {
                                err_txt = "Error: " + resp.status;
                                if (err_cb) {
                                    err_cb(err_txt);
                                } else {
                                    console_error(err_txt);
                                }

                                return;
                            }

                            var content_type = headers["content-type"];
                            if (!content_type)
                                content_type = "";
                            content_type = content_type.toLowerCase();

                            if (content_type.match(/text\/html/) && !obj.head_wrong_contenttype &&
                                ok_error !== true) {
                                var err_txt = "Error: Not an image: " + content_type;
                                if (err_cb) {
                                    err_cb(err_txt);
                                } else {
                                    console_error(err_txt);
                                }

                                return;
                            }

                            if (!is_extension) {
                                if (obj.forces_download || ((content_type.match(/binary\//) ||
                                      content_type.match(/application\//)) && !obj.head_wrong_contenttype) ||
                                    (headers["content-disposition"] &&
                                     headers["content-disposition"].toLowerCase().match(/^ *attachment/))) {
                                    console_error("Forces download");
                                    mouseover_text("forces download");
                                    return;
                                }
                            }

                            if (headers["content-length"] && headers["content-length"] == "0" && !obj.head_wrong_contentlength) {
                                console_error("Zero-length image");
                                return;
                            }

                            if (!customheaders || is_extension)
                                ok_cb(url);
                            else
                                console_log("Custom headers needed, currently unhandled");
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

        cursor_wait();

        bigimage_recursive_loop(document.location.href, {
            fill_object: true,
            document: document,
            window: window,
            cb: function(newhref) {
                cursor_default();

                if (!newhref) {
                    return;
                }

                var newurl = newhref[0].url;

                if (newurl === document.location.href)
                    return;

                if (!newurl)
                    return;

                if (_nir_debug_)
                    console.dir(newhref);

                redirect(newurl, newhref);
            }
        }, function(newhref, finalcb) {
            if (_nir_debug_)
                console.dir(newhref);

            if (!newhref[0].can_head || newhref[0].always_ok) {
                var newurl = newhref[0].url;

                if (newurl === document.location.href) {
                    cursor_default();
                    return;
                }

                if (_nir_debug_) {
                    console_log("Not checking due to can_head == false || always_ok == true");
                }

                finalcb(newurl);
                return;
            }

            var index = 0;
            var cb = function(err_txt) {
                index++;
                if (index >= newhref.length) {
                    cursor_default();
                    console_error(err_txt);
                    return;
                }
                check_image(newhref[index], cb, finalcb);
            };
            check_image(newhref[0], cb, finalcb);
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

    function get_keystrs_map(event, value) {
        var keys = {};

        if (event.ctrlKey) {
            keys.ctrl = true;
        } else {
            keys.ctrl = false;
        }

        /*if (event.metaKey) {
            keys["super"] = true;
        } else {
            keys["super"] = false;
        }*/

        if (event.altKey) {
            keys.alt = true;
        } else {
            keys.alt = false;
        }

        if (event.shiftKey) {
            keys.shift = true;
        } else {
            keys.shift = false;
        }

        var str = keycode_to_str(event.which);
        if (str === undefined) {
            return keys;
        }

        keys[str] = value;
        return keys;
    }

    function do_options() {
        var recording_keys = false;
        var options_chord = [];
        var current_options_chord = [];

        function update_options_chord(event, value) {
            if (!recording_keys)
                return;

            var map = get_keystrs_map(event, value);

            if (keycode_to_str(event.which) &&
                current_options_chord.length === 0) {
                options_chord = [];
            }

            for (var key in map) {
                update_options_chord_sub(key, map[key]);
            }

            recording_keys();
        }

        function update_options_chord_sub(str, value) {
            if (value) {
                if (options_chord.indexOf(str) < 0) {
                    options_chord.push(str);
                }

                if (current_options_chord.indexOf(str) < 0) {
                    current_options_chord.push(str);
                }
            } else {
                if (current_options_chord.indexOf(str) >= 0) {
                    current_options_chord.splice(current_options_chord.indexOf(str), 1);
                }
            }
        }

        document.addEventListener('keydown', function(event) {
            update_options_chord(event, true);
        });

        document.addEventListener('keyup', function(event) {
            update_options_chord(event, false);
        });

        var options_el = document.getElementById("options");

        if (!is_extension_options_page)
            options_el.innerHTML = "<h1>Options</h1>";
        else
            options_el.innerHTML = "";

        var saved_el = document.createElement("div");
        saved_el.innerHTML = "<p>Saved! Refresh the target page for changes to take effect</p>";
        saved_el.id = "saved";
        saved_el.classList.add("topsaved");
        //saved_el.style.pointer_events = "none";
        saved_el.style.visibility = "hidden";
        //saved_el.style.textAlign = "center";
        //saved_el.style.paddingTop = "1em";
        //saved_el.style.fontStyle = "italic";
        //saved_el.style.color = "#0af";
        var saved_timeout = null;

        function check_disabled_options() {
            var options = options_el.querySelectorAll("div.option");

            var enabled_map = {};

            function check_option(setting) {
                var meta = settings_meta[setting];
                var enabled = true;

                enabled_map[setting] = "processing";

                if (meta.requires) {
                    // fixme: this only works for one option in meta.requires
                    for (var required_setting in meta.requires) {
                        var value = settings[required_setting];

                        if (!(required_setting in enabled_map)) {
                            check_option(required_setting);
                        }

                        if (enabled_map[required_setting] === "processing") {
                            console_error("Dependency cycle detected for: " + setting + ", " + required_setting);
                            return;
                        }

                        if (enabled_map[required_setting] && value === meta.requires[required_setting]) {
                            enabled = true;
                        } else {
                            enabled = false;
                            break;
                        }
                    }
                }

                enabled_map[setting] = enabled;

                return enabled;
            }

            for (var i = 0; i < options.length; i++) {
                var setting = options[i].id.replace(/^option_/, "");

                //var meta = settings_meta[setting];
                /*var enabled = true;
                if (meta.requires) {
                    // fixme: this only works for one option in meta.requires
                    for (var required_setting in meta.requires) {
                        var value = settings[required_setting];


                        if (value === meta.requires[required_setting]) {
                            enabled = true;
                        } else {
                            enabled = false;
                            break;
                        }
                    }
                    }*/
                var enabled = check_option(setting);

                if (enabled) {
                    options[i].classList.remove("disabled");

                    options[i].querySelectorAll("input, textarea, button").forEach((input) => {
                        input.disabled = false;
                    });
                } else {
                    options[i].classList.add("disabled");

                    options[i].querySelectorAll("input, textarea, button").forEach((input) => {
                        input.disabled = true;
                    });
                }
            }
        }

        function show_saved_message() {
            saved_el.setAttribute("style", "");
            saved_el.classList.remove("fadeout");

            if (saved_timeout)
                clearTimeout(saved_timeout);

            saved_timeout = setTimeout(function() {
                saved_el.classList.add("fadeout");
            }, 2000);
        }

        var category_els = [];

        for (var category in categories) {
            var div = document.createElement("div");
            div.id = "cat_" + category;
            div.classList.add("category");
            var h2 = document.createElement("h2");
            h2.innerText = categories[category];
            div.appendChild(h2);
            category_els[category] = div;
            options_el.appendChild(div);
        }

        for (var setting in settings) {
            (function(setting) {
                var meta = settings_meta[setting];
                if (!meta) {
                    return;
                }

                var value = settings[setting];
                var orig_value = orig_settings[setting];

                if (meta.userscript_only && !is_userscript)
                    return;

                if (meta.extension_only && !is_extension)
                    return;

                var option = document.createElement("div");
                option.classList.add("option");
                option.id = "option_" + setting;

                var table = document.createElement("table");
                table.style.border = "0";

                var tr = document.createElement("tr");
                table.appendChild(tr);

                var name = document.createElement("strong");
                name.innerText = meta.name;
                name.title = meta.description;

                var name_td = document.createElement("td");
                name_td.style.verticalAlign = "middle";
                name_td.classList.add("name_td");
                name_td.appendChild(name);
                tr.appendChild(name_td);

                var value_td = document.createElement("td");
                value_td.classList.add("value_td");

                var type = "options";
                var option_list = {};

                if (typeof orig_value === "boolean") {
                    type = "options";
                    option_list["true"] = {name: "Yes"};
                    option_list["false"] = {name: "No"};
                    if (value)
                        option_list["true"].checked = true;
                    else
                        option_list["false"].checked = true;
                } else if (meta.options) {
                    type = "options";
                    option_list = deepcopy(meta.options);

                    var check_optionlist = function(val, list) {
                        if (val in list) {
                            list[val].checked = true;
                        } else {
                            for (var item in list) {
                                if (item.match(/^_group/)) {
                                    check_optionlist(val, list[item]);
                                }
                            }
                        }
                    };

                    if (value instanceof Array) {
                        value.forEach(function (val) {
                            check_optionlist(val, option_list);
                        });
                    } else {
                        check_optionlist(value, option_list);
                    }
                } else if (meta.type) {
                    if (meta.type === "textarea" ||
                        meta.type === "keysequence" ||
                        meta.type === "number")
                        type = meta.type
                }

                if (type === "options") {
                    var option_type = option_list._type;
                    if (!option_type)
                        option_type = "or";

                    var add_setting = function(parent, op, val, option_type, group, group_type) {
                        var id = "input_" + setting + "_" + op;
                        var name = setting;
                        if (group && group_type === "and")
                            name += "_" + group;

                        var input = document.createElement("input");
                        if (option_type === "or" && false)
                            input.setAttribute("type", "radio");
                        else if (option_type === "and" || true)
                            input.setAttribute("type", "checkbox");
                        input.name = name;
                        input.value = op;
                        input.id = id;
                        if (val.checked)
                            input.setAttribute("checked", "true");

                        input.addEventListener("change", function(event) {
                            var value = this.value;

                            if (value === "true") {
                                value = true;
                            }

                            if (value === "false")
                                value = false;

                            if (this.checked) {
                                if (group && group_type === "or") {
                                    for (var child_i = 0; child_i < value_td.children.length; child_i++) {
                                        var child = value_td.children[child_i];
                                        if (child.id !== (setting + group)) {
                                            for (var subchild_i = 0; subchild_i < child.children.length; subchild_i++) {
                                                var subchild = child.children[subchild_i];
                                                if (subchild.tagName === "INPUT") {
                                                    subchild.checked = false;
                                                }
                                            }
                                        }
                                    }
                                }

                                if (option_type === "or") {
                                    for (var child_i = 0; child_i < parent.children.length; child_i++) {
                                        var child = parent.children[child_i];
                                        if (child.tagName === "INPUT" && child.id != input.id) {
                                            child.checked = false;
                                        }
                                    }
                                }
                            } else {
                                var onechecked = false;
                                for (var child_i = 0; child_i < value_td.children.length; child_i++) {
                                    var child = value_td.children[child_i];
                                    for (var subchild_i = 0; subchild_i < child.children.length; subchild_i++) {
                                        var subchild = child.children[subchild_i];
                                        if (subchild.tagName === "INPUT") {
                                            if (subchild.checked) {
                                                onechecked = true;
                                                break;
                                            }
                                        }
                                    }
                                    if (onechecked)
                                        break;
                                }

                                if (!onechecked) {
                                    this.checked = true;
                                }
                            }

                            var new_value = value;
                            if (group || option_type !== "or") {
                                var out_value = [];

                                var inputs = value_td.getElementsByTagName("input");
                                for (var child_i = 0; child_i < inputs.length; child_i++) {
                                    var child = inputs[child_i];
                                    if (child.checked) {
                                        out_value.push(child.value);
                                    }
                                }

                                new_value = out_value;
                                set_value(setting, new_value);
                            } else {
                                set_value(setting, value);
                            }

                            settings[setting] = new_value;
                            check_disabled_options();

                            show_saved_message();
                        });

                        parent.appendChild(input);

                        var label = document.createElement("label");
                        label.setAttribute("for", id);
                        label.innerText = val.name;

                        if (val.description) {
                            label.title = val.description;
                        }

                        parent.appendChild(label);
                    };

                    for (var op in option_list) {
                        if (op.match(/^_group/)) {
                            var option_type1 = option_list[op]._type;
                            if (!option_type1)
                                option_type1 = "or";

                            var sub = document.createElement("div");
                            sub.classList.add("group");
                            sub.id = setting + op;
                            for (var op1 in option_list[op]) {
                                if (!op1.match(/^_/))
                                    add_setting(sub, op1, option_list[op][op1], option_type1, op, option_type);
                            }
                            value_td.appendChild(sub);
                        } else if (!op.match(/^_/)) {
                            add_setting(value_td, op, option_list[op], option_type);
                        }
                    }
                } else if (type === "textarea") {
                    var sub = document.createElement("table");
                    var sub_tr = document.createElement("tr");
                    var sub_ta_td = document.createElement("td");
                    sub_ta_td.style.verticalAlign = "middle";
                    //sub_ta_td.style.height = "1px";
                    var sub_button_tr = document.createElement("tr");
                    var sub_button_td = document.createElement("td");
                    sub_button_td.style.textAlign = "center";
                    //sub_button_td.style.verticalAlign = "middle";
                    //sub_button_td.style.height = "1px";
                    var textarea = document.createElement("textarea");
                    textarea.style.height = "5em";
                    textarea.style.width = "20em";
                    if (value)
                        textarea.value = value;
                    var savebutton = document.createElement("button");
                    savebutton.innerHTML = "Save";
                    savebutton.onclick = function() {
                        set_value(setting, textarea.value);
                        settings[setting] = textarea.value;

                        show_saved_message();
                    };

                    sub_ta_td.appendChild(textarea);
                    sub_button_td.appendChild(savebutton);
                    sub_button_tr.appendChild(sub_button_td);
                    sub_tr.appendChild(sub_ta_td);
                    sub.appendChild(sub_tr);
                    sub.appendChild(sub_button_tr);

                    value_td.appendChild(sub);
                } else if (type === "number") {
                    var sub = document.createElement("table");
                    var sub_tr = document.createElement("tr");
                    var sub_in_td = document.createElement("td");
                    sub_in_td.style = "display:inline";
                    var input = document.createElement("input");
                    input.type = "number";
                    input.style = "text-align:right";
                    if (meta.number_max !== undefined)
                        input.setAttribute("max", meta.number_max.toString());
                    if (meta.number_min !== undefined)
                        input.setAttribute("min", meta.number_min.toString());
                    if (meta.number_int)
                        input.setAttribute("step", "1");
                    if (value !== undefined)
                        input.value = value;
                    input.oninput = function(x) {
                        var value = input.value.toString();

                        var value = parseFloat(value);
                        var orig_value = value;

                        if (isNaN(value)) {
                            return;
                        }

                        if (meta.number_int) {
                            value = parseInt(value);
                        }

                        if (meta.number_max !== undefined)
                            value = Math.min(value, meta.number_max);
                        if (meta.number_min !== undefined)
                            value = Math.max(value, meta.number_min);

                        if (isNaN(value)) {
                            console_error("Error: number is NaN after min/max");
                            return;
                        }

                        if (meta.number_int || value !== orig_value)
                            input.value = value;

                        set_value(setting, value);
                        settings[setting] = value;

                        show_saved_message();
                    }

                    var sub_units_td = document.createElement("td");
                    sub_units_td.style = "display:inline";
                    if (meta.number_unit)
                        sub_units_td.innerText = meta.number_unit;

                    sub_tr.appendChild(input);
                    sub_tr.appendChild(sub_units_td);
                    sub.appendChild(sub_tr);
                    value_td.appendChild(sub);
                } else if (type === "keysequence") {
                    var sub = document.createElement("table");
                    var sub_tr = document.createElement("tr");
                    var sub_key_td = document.createElement("td");
                    sub_key_td.style = "display:inline;font-family:monospace;font-size:1.1em";
                    if (value) {
                        sub_key_td.innerText = get_trigger_key_text(value);
                    }
                    var sub_record_td = document.createElement("td");
                    sub_record_td.style = "display:inline";
                    var sub_record_btn = document.createElement("button");
                    sub_record_btn.innerText = "Record";
                    var sub_cancel_btn = document.createElement("button");
                    sub_cancel_btn.innerText = "Cancel";
                    sub_cancel_btn.style = "display:none";
                    var do_cancel = function() {
                        recording_keys = false;
                        sub_record_btn.innerText = "Record";
                        sub_cancel_btn.style = "display:none";
                        sub_key_td.innerText = get_trigger_key_text(settings[setting]);
                    };
                    sub_cancel_btn.onclick = do_cancel;
                    sub_record_btn.onclick = function() {
                        if (recording_keys) {
                            set_value(setting, options_chord);
                            settings[setting] = options_chord;

                            show_saved_message();
                            do_cancel();
                        } else {
                            options_chord = [];
                            current_options_chord = [];
                            recording_keys = function() {
                                sub_key_td.innerText = get_trigger_key_text(options_chord);
                            };
                            sub_record_btn.innerText = "Save";
                            sub_cancel_btn.style = "display:inline-block";
                        }
                    };

                    sub_tr.appendChild(sub_key_td);
                    sub_record_td.appendChild(sub_record_btn);
                    sub_record_td.appendChild(sub_cancel_btn);
                    sub_tr.appendChild(sub_record_td);
                    sub.appendChild(sub_tr);
                    value_td.appendChild(sub);
                }

                tr.appendChild(value_td);

                option.appendChild(table);

                if (meta.category)
                    category_els[meta.category].appendChild(option);
                else
                    options_el.appendChild(option);
            })(setting);
        }

        check_disabled_options();

        for (var category in category_els) {
            var category_el = category_els[category]
            if (category_el.querySelectorAll(".option").length === 0) {
                category_el.parentNode.removeChild(category_el);
            }
        }

        options_el.appendChild(saved_el);
    }

    function parse_value(value) {
        try {
            return JSON_parse(value);
        } catch (e) {
            return value;
        }
    }

    function serialize_value(value) {
        return JSON_stringify(value);
    }

    function get_value(key, cb) {
        if (is_extension) {
            chrome.storage.sync.get([key], function(response) {
                cb(parse_value(response[key]));
            });
        } else if (typeof GM_getValue !== "undefined") {
            return cb(parse_value(GM_getValue(key, undefined)));
        } else if (typeof GM !== "undefined" && GM.getValue) {
            GM.getValue(key, undefined).then(function (value) {
                cb(parse_value(value));
            });
        }
    }

    function set_value(key, value) {
        value = serialize_value(value);
        console_log("Setting " + key + " = " + value);
        if (is_extension) {
            var kv = {};
            kv[key] = value;
            //chrome.storage.sync.set(kv, function() {});
            extension_send_message({
                type: "setvalue",
                data: kv
            }, function() {});
        } else if (typeof GM_setValue !== "undefined") {
            return GM_setValue(key, value);
        } else if (typeof GM !== "undefined" && GM.getValue) {
            return GM.setValue(key, value);
        }
    }

    function update_setting(key, value) {
        settings[key] = value;
        set_value(key, value);
    }

    function upgrade_settings(cb) {
        // TODO: merge this get_value in do_config for performance
        get_value("settings_version", function(version) {
            if (!version) {
                version = 0;
            } else if (typeof version !== "number") {
                version = parseInt(version);
                if (isNaN(version))
                    version = 0;
            }

            if (version === 0) {
                if (settings.mouseover_trigger) {
                    var trigger_keys = [];
                    for (var i = 0; i < settings.mouseover_trigger.length; i++) {
                        var trigger = settings.mouseover_trigger[i];
                        if (trigger.match(/^delay_[0-9]+/)) {
                            var delay = parseInt(settings.mouseover_trigger[i].replace(/^delay_([0-9]+).*?$/, "$1"));
                            if (delay <= 0 || isNaN(delay))
                                delay = false;
                            if (typeof delay === "number" && delay >= 10)
                                delay = 10;
                            update_setting("mouseover_trigger_delay", delay);
                            continue;
                        }

                        trigger_keys.push(trigger);
                    }



                    if (trigger_keys.length === 0) {
                        update_setting("mouseover_trigger_key", orig_settings["mouseover_trigger_key"]);
                        update_setting("mouseover_trigger_behavior", "mouse");
                    } else {
                        update_setting("mouseover_trigger_key", trigger_keys);
                        update_setting("mouseover_trigger_behavior", "keyboard");
                    }
                }

                update_setting("settings_version", 1);
            }

            cb();
        });
    }

    function do_config() {
        if (is_userscript || is_extension) {
            var settings_done = 0;
            for (var setting in settings) {
                (function(setting) {
                    get_value(setting, function(value) {
                        settings_done++;
                        if (value !== undefined) {
                            if (typeof settings[setting] === "number") {
                                value = parseFloat(value);
                            }
                            settings[setting] = value;
                        }
                        if (settings_done >= Object.keys(settings).length)
                            upgrade_settings(start);
                    });
                })(setting);
            }
        } else {
            start();
        }
    }

    function check_image_get(obj, cb, processing) {
        if (!obj || !obj[0]) {
            return cb(null);
        }

        if (!processing.running) {
            return cb(null);
        }

        var method = "GET";
        var responseType = "blob";

        if (processing.head) {
            method = "HEAD";
            responseType = undefined;
        }

        if (obj[0].url.match(/^data:/)) {
            var img = document.createElement("img");
            img.src = obj[0].url;
            img.onload = function() {
                cb(img, obj[0].url);
            };
            return;
        }

        function err_cb() {
            obj.shift();
            return check_image_get(obj, cb, processing);
        }

        var url = obj[0].url;

        console_log("Trying " + url);

        if (obj[0] && obj[0].bad) {
            console_log("Bad image");
            return err_cb();
        }

        var url_domain = url.replace(/^([a-z]+:\/\/[^/]*).*?$/, "$1");

        var headers = obj[0].headers;

        if (!headers || Object.keys(headers).length === 0) {
            headers = {
                "Origin": url_domain,
                "Referer": document.location.href
            };
        } else if (!headers.Origin && !headers.origin) {
            headers.Origin = url_domain;
        }

        do_request({
            method: method,
            url: url,
            responseType: responseType,
            headers: headers,
            onload: function(resp) {
                if (!processing.running) {
                    return cb(null);
                }

                if (resp.readyState == 4) {
                    var digit = resp.status.toString()[0];

                    var ok_error = check_ok_error(obj[0].head_ok_errors, resp.status);

                    if (((digit === "4" || digit === "5") &&
                         resp.status !== 405) && obj[0].can_head &&
                        ok_error !== true) {
                        if (err_cb) {
                            console_log("Bad status: " + resp.status + " ( " + url + " )");
                            err_cb();
                        } else {
                            console_error("Error: " + resp.status);
                        }

                        return;
                    }

                    if (processing.head) {
                        cb(resp, obj[0]);
                        return;
                    }

                    if (!resp.response) {
                        err_cb();
                        return;
                    }

                    var a = new FileReader();
                    a.onload = function(e) {
                        try {
                            var img = document.createElement("img");
                            img.src = e.target.result;
                            img.onload = function() {
                                cb(img, resp.finalUrl, obj[0]);
                            };
                            img.onerror = function() {
                                err_cb();
                            };
                        } catch (e) {
                            console_error(e);
                            console_error(e.stack);
                            err_cb();
                        }
                    };
                    a.readAsDataURL(resp.response);
                }
            }
        });
    }

    var str_to_keycode_table = {
        backspace: 8,
        enter: 13,
        shift: 16,
        ctrl: 17,
        alt: 19,
        space: 32,
        left: 37,
        up: 38,
        right: 39,
        down: 40,
        //"super": 91,
        ";": 186,
        "=": 187,
        ",": 188,
        "-": 189,
        ".": 190,
        "/": 191,
        "`": 192,
        "[": 219,
        "\\": 220,
        "]": 221,
        "'": 222
    };

    var keycode_to_str_table = {
        8: "backspace",
        13: "enter",
        16: "shift",
        17: "ctrl",
        18: "alt",
        32: "space",

        37: "left",
        38: "up",
        39: "right",
        40: "down",

        //91: "super",

        // numpad
        111: "/",
        106: "*",
        107: "+",
        109: "-",
        110: ".",

        186: ";",
        187: "=",
        188: ",",
        189: "-",
        190: ".",
        191: "/",
        192: "`",
        219: "[",
        220: "\\",
        221: "]",
        222: "'"
    };

    var maxzindex = 2147483647;

    function keycode_to_str(x) {
        if (x in keycode_to_str_table) {
            return keycode_to_str_table[x];
        }

        // lowercase
        if (x >= 96 && x <= 105) {
            x -= 45;
        }
        if (!(x >= 65 && x <= 90 ||
              // numbers
              x >= 48 && x <= 57)) {
            return;
        }

        return String.fromCharCode(x).toLowerCase();
    }

    function str_to_keycode(x) {
        if (x in str_to_keycode_table) {
            return str_to_keycode_table[x];
        }
        return x.toUpperCase().charCodeAt(0);
    }

    function do_mouseover() {
        var mouseX = 0;
        var mouseY = 0;
        var mouseAbsX = 0;
        var mouseAbsY = 0;

        var mouseContextX = 0;
        var mouseContextY = 0;
        var mouseAbsContextX = 0;
        var mouseAbsContextY = 0;

        var mouseDelayX = 0;
        var mouseDelayY = 0;

        var lastX = 0;
        var lastY = 0;

        var processing_list = [];
        var popups = [];
        var popup_el = null;
        var popups_active = false;
        var dragstart = false;
        var dragstartX = null;
        var dragstartY = null;
        var dragoffsetX = null;
        var dragoffsetY = null;
        var dragged = false;
        var controlPressed = false;
        var waiting = false;

        var waitingel = null;
        var waitingsize = 200;

        var current_chord = [];

        function resetifout(e) {
            // doesn't work, as e doesn't contain ctrlKey etc.
            if (!trigger_complete(e)) {
                //current_chord = [];
                stop_waiting();
                resetpopups();
            }
        }

        // runs on every focusout, not just window
        /*document.addEventListener("focusout", resetifout);
          document.addEventListener("blur", resetifout);
          unsafeWindow.addEventListener("focusout", resetifout);
          unsafeWindow.addEventListener("blur", resetifout);*/

        var disable_click = false;
        document.addEventListener("click", function(e) {
            if (disable_click && popups.length > 0 && false) {
                e.stopPropagation();
                e.stopImmediatePropagation();

                return true;
                //return false;
            }
        }, true);

        var delay = false;
        var delay_handle = null;
        var delay_mouseonly = true;

        function update_waiting() {
            var x = mouseX;//mouseAbsX;
            var y = mouseY;//mouseAbsY;
            waitingel.style.left = (x - (waitingsize / 2)) + "px";
            waitingel.style.top = (y - (waitingsize / 2)) + "px";
        }

        function start_waiting() {
            if (!waitingel) {
                waitingel = document.createElement("div");
                waitingel.style.zIndex = maxzindex;
                waitingel.style.cursor = "wait";
                waitingel.style.width = waitingsize + "px";
                waitingel.style.height = waitingsize + "px";
                //waitingel.style.pointerEvents = "none"; // works, but defeats the purpose, because the cursor isn't changed
                waitingel.style.position = "fixed";//"absolute";

                var simevent = function(e, eventtype) {
                    waitingel.style.display = "none";
                    document.elementFromPoint(e.clientX, e.clientY).dispatchEvent(new MouseEvent(eventtype, e));
                    waitingel.style.display = "block";
                };

                waitingel.addEventListener("click", function(e) {
                    return simevent(e, "click");
                });

                waitingel.addEventListener("contextmenu", function(e) {
                    return simevent(e, "contextmenu");
                });

                document.documentElement.appendChild(waitingel);
            }

            waiting = true;
            waitingel.style.cursor = "wait";
            waitingel.style.display = "block";

            update_waiting();
        }

        function start_progress() {
            start_waiting();
            waitingel.style.cursor = "progress";
        }

        function stop_waiting() {
            if (waitingel)
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

            disable_click = false;
            popups_active = false;
            popup_el = null;

            if (!delay_mouseonly && delay_handle) {
                clearTimeout(delay_handle);
                delay_handle = null;
            }
        }

        function get_viewport() {
            if (window.visualViewport) {
                return [
                    window.visualViewport.width,
                    window.visualViewport.height
                ];
            } else {
                return [
                    window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
                    window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight
                ];
            }
        }

        function strip_whitespace(str) {
            if (!str || typeof str !== "string")
                return str;

            return str
                .replace(/^\s+/, "")
                .replace(/\s+$/, "");
        }

        function apply_styles(el, str) {
            if (!str || typeof str !== "string" || !strip_whitespace(str))
                return;

            var splitted = str.split(/[;\n]/);
            for (var i = 0; i < splitted.length; i++) {
                var current = strip_whitespace(splitted[i]);
                if (!current)
                    continue;

                if (current.indexOf(":") < 0)
                    continue;

                var property = strip_whitespace(current.replace(/^(.*?)\s*:.*/, "$1"));
                var value = strip_whitespace(current.replace(/^.*?:\s*(.*)$/, "$1"));

                var important = false;
                if (value.match(/!important$/)) {
                    important = true;
                    value = strip_whitespace(value.replace(/!important$/, ""));
                }

                if (value.match(/^['"].*['"]$/)) {
                    value = value.replace(/^["'](.*)["']$/, "$1");
                }

                if (important) {
                    el.style.setProperty(property, value, "important");
                } else {
                    el.style.setProperty(property, value);
                }
            }
        }

        function makePopup(obj, orig_url, processing, data) {
            var openb = get_single_setting("mouseover_open_behavior");
            if (openb === "newtab") {
                stop_waiting();

                var theobj = data.data.obj;
                theobj.url = data.data.resp.finalUrl;

                extension_send_message({
                    type: "newtab",
                    data: {
                        imu: theobj
                    }
                }, function() {
                    //popups_active = true;
                });
                return;
            }

            //var x = mouseX;//mouseAbsX;
            //var y = mouseY;//mouseAbsY;
            var x = data.x;
            var y = data.y;

            function cb(img, url) {
                if (!controlPressed && false) {
                    if (processing.running)
                        stop_waiting();
                    return;
                }

                if (!img) {
                    if (processing.running)
                        stop_waiting();
                    return;
                }

                var estop = function(e) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return true;
                };

                lastX = x;
                lastY = y;

                var initial_zoom_behavior = get_single_setting("mouseover_zoom_behavior");

                //img.onclick = estop;
                //img.onmousedown = estop;
                //img.addEventListener("click", estop, true);
                //img.addEventListener("mousedown", estop, true);

                var outerdiv = document.createElement("div");
                outerdiv.style.all = "initial";
                outerdiv.style.position = "fixed";
                outerdiv.style.zIndex = maxzindex - 2;

                var div = document.createElement("div");
                var popupshown = false;
                div.style.all = "initial";
                div.style.boxShadow = "0 0 15px rgba(0,0,0,.5)";
                div.style.border = "3px solid white";
                div.style.position = "relative";
                div.style.top = "0px";
                div.style.left = "0px";
                div.style.display = "block";

                /*var styles = settings.mouseover_styles.replace("\n", ";");
                div.setAttribute("style", styles);
                if (!styles.match(/^\s*box-shadow\s*:/) &&
                    !styles.match(/;\s*box-shadow\s*:/)) {
                    div.style.boxShadow = "0 0 15px rgba(0,0,0,.5)";
                }
                if (!styles.match(/^\s*border(?:-[a-z]+)?\s*:/) &&
                    !styles.match(/;\s*border(?:-[a-z]+)?\s*:/)) {
                    div.style.border = "3px solid white";
                    }*/

                apply_styles(div, settings.mouseover_styles);
                outerdiv.appendChild(div);

                //div.style.position = "fixed"; // instagram has top: -...px
                //div.style.zIndex = maxzindex - 2;


                //div.onclick = estop;
                //div.onmousedown = estop;
                //div.addEventListener("click", estop, true);
                //div.addEventListener("mousedown", estop, true);
                // useful for instagram
                //disable_click = true;


                var border_thresh = 15;
                var viewport;
                var vw;
                var vh;

                /*if (window.visualViewport) {
                    vw = window.visualViewport.width;
                    vh = window.visualViewport.height;
                } else {
                    vw = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                    vh = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
                    }*/

                function update_vwh() {
                    viewport = get_viewport();
                    vw = viewport[0];
                    vh = viewport[1];

                    vw -= border_thresh * 2;
                    vh -= border_thresh * 2;
                }

                // https://stackoverflow.com/a/23270007
                function get_lefttopouter() {
                    var style = outerdiv.currentStyle || window.getComputedStyle(outerdiv);
                    return [style.marginLeft + style.borderLeftWidth,
                            style.marginTop + style.borderTopWidth];
                }

                update_vwh();

                img.style.all = "initial";
                img.style.cursor = "pointer";
                // https://stackoverflow.com/questions/7774814/remove-white-space-below-image
                img.style.verticalAlign = "bottom";
                img.style.setProperty("display", "block", "important");

                if (initial_zoom_behavior === "fit") {
                    img.style.maxWidth = vw + "px";
                    img.style.maxHeight = vh + "px";
                }

                var imgh = img.naturalHeight;
                var imgw = img.naturalWidth;

                if (imgh < 20 ||
                    imgw < 20) {
                    stop_waiting();
                    return;
                }

                if (initial_zoom_behavior === "fit" && (imgh > vh ||
                                                        imgw > vw)) {
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

                var sct = scrollTop();
                var scl = scrollLeft();
                sct = scl = 0;

                var mouseover_position = get_single_setting("mouseover_position");

                if (mouseover_position === "cursor") {
                    outerdiv.style.top = (sct + Math.min(Math.max((y - sct) - (imgh / 2), border_thresh), Math.max(vh - imgh, border_thresh))) + "px";
                    outerdiv.style.left = (scl + Math.min(Math.max((x - scl) - (imgw / 2), border_thresh), Math.max(vw - imgw, border_thresh))) + "px";
                } else if (mouseover_position === "center") {
                    outerdiv.style.top = (sct + Math.min(Math.max(((vh / 2) - sct) - (imgh / 2), border_thresh), Math.max(vh - imgh, border_thresh))) + "px";
                    outerdiv.style.left = (scl + Math.min(Math.max(((vw / 2) - scl) - (imgw / 2), border_thresh), Math.max(vw - imgw, border_thresh))) + "px";
                }
                /*console_log(x - (imgw / 2));
                  console_log(vw);
                  console_log(imgw);
                  console_log(vw - imgw);*/

                var defaultopacity = (settings.mouseover_ui_opacity / 100);
                if (defaultopacity > 1)
                    defaultopacity = 1;
                if (defaultopacity < 0)
                    defaultopacity = 0;
                function opacity_hover(el) {
                    el.onmouseover = function(e) {
                        el.style.opacity = "1.0";
                    };
                    el.onmouseout = function(e) {
                        el.style.opacity = defaultopacity;
                    };
                }

                var btndown = false;
                function addbtn(text, title, action, istop) {
                    var tagname = "span";
                    if (typeof action === "string")
                        tagname = "a";

                    var btn = document.createElement(tagname);

                    if (action) {
                        if (typeof action === "function") {
                            btn.addEventListener("click", function(e) {
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                e.preventDefault();
                                action();
                                return false;
                            }, true);
                        } else if (typeof action === "string") {
                            btn.href = action;
                            btn.target = "_blank";

                            btn.addEventListener("click", function(e) {
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                            }, true);
                        }
                    }

                    btn.addEventListener("mousedown", function(e) {
                        btndown = true;
                    }, true);
                    btn.addEventListener("mouseup", function(e) {
                        btndown = false;
                    }, true);
                    if (!istop) {
                        opacity_hover(btn);
                    }
                    btn.style.all = "initial";
                    if (action) {
                        btn.style.cursor = "pointer";
                    }
                    btn.style.background = "#333";
                    btn.style.border = "3px solid white";
                    btn.style.borderRadius = "10px";
                    btn.style.color = "white";
                    btn.style.padding = "4px";
                    btn.style.lineHeight = "1em";
                    btn.style.whiteSpace = "nowrap";
                    btn.style.fontSize = "14px";
                    btn.style.fontFamily = "sans-serif";
                    btn.style.zIndex = maxzindex - 1;
                    if (!istop) {
                        btn.style.position = "absolute";
                        btn.style.opacity = defaultopacity;
                    } else {
                        btn.style.position = "relative";
                        btn.style.marginRight = ".3em";
                    }
                    if (action)
                        btn.style.userSelect = "none";
                    btn.innerText = text;
                    if (title)
                        btn.title = title;
                    return btn;
                }

                var ui_els = [];

                var cached_previmages = 0;
                var cached_nextimages = 0;

                function create_ui(use_cached_gallery) {
                    for (var el_i = 0; el_i < ui_els.length; el_i++) {
                        var ui_el = ui_els[el_i];
                        ui_el.parentNode.removeChild(ui_el);
                    }

                    ui_els = [];

                    var emi = 14;
                    var em1 = emi + "px"
                    var emhalf = (emi / 2) + "px";
                    var gallerycount_fontsize = "13px";

                    var topbarel = document.createElement("div");
                    topbarel.style.all = "initial";
                    topbarel.style.position = "absolute";
                    topbarel.style.left = "-" + em1;
                    topbarel.style.top = "-" + em1;
                    topbarel.style.opacity = defaultopacity;
                    topbarel.style.zIndex = maxzindex - 1;

                    opacity_hover(topbarel);

                    var closebtn = addbtn("×", "Close (ESC)", function() {
                        resetpopups();
                    }, true);
                    topbarel.appendChild(closebtn);
                    outerdiv.appendChild(topbarel);
                    ui_els.push(topbarel);


                    var prev_images = 0;
                    var next_images = 0;

                    var add_lrhover = function(isleft, btnel, action) {
                        if ((popupshown && outerdiv.clientWidth < 200) ||
                            imgw < 200)
                            return;

                        var lrhover = document.createElement("div");
                        lrhover.style.all = "initial";
                        if (isleft) {
                            lrhover.style.left = "0em";
                        } else {
                            lrhover.style.right = "0em";
                        }
                        lrhover.style.top = "0em";
                        lrhover.style.position = "absolute";
                        lrhover.style.width = "15%";
                        lrhover.style.height = "100%";
                        lrhover.style.zIndex = maxzindex - 2;
                        lrhover.style.cursor = "pointer";
                        var forwardevent = function(e) {
                            btnel.dispatchEvent(new MouseEvent(e.type, e));
                        };
                        lrhover.addEventListener("mouseover", forwardevent, true);
                        lrhover.addEventListener("mouseout", forwardevent, true);
                        lrhover.addEventListener("click", function(e) {
                            if (dragged) {
                                return false;
                            }

                            //forwardevent(e);
                            estop(e);
                            action(e);
                            return false;
                        }, true);
                        outerdiv.appendChild(lrhover);
                        ui_els.push(lrhover);
                        return lrhover;
                    };

                    function lraction(isright) {
                        if (!trigger_gallery(isright)) {
                            create_ui();
                        }
                    }

                    if (is_valid_el(wrap_gallery_func(false))) {
                        var leftaction = function() {
                            return lraction(false);
                        };

                        var leftbtn = addbtn("←", "Previous (Left Arrow)", leftaction);
                        leftbtn.style.top = "calc(50% - 7px - " + emhalf + ")";
                        leftbtn.style.left = "-" + em1;
                        outerdiv.appendChild(leftbtn);
                        ui_els.push(leftbtn);

                        add_lrhover(true, leftbtn, leftaction);

                        if (settings.mouseover_ui_gallerycounter) {
                            if (use_cached_gallery) {
                                prev_images = cached_previmages;
                            } else {
                                prev_images = count_gallery(false);
                                cached_previmages = prev_images;
                            }
                        }
                    }

                    if (is_valid_el(wrap_gallery_func(true))) {
                        var rightaction = function() {
                            return lraction(true);
                        };

                        var rightbtn = addbtn("→", "Next (Right Arrow)", rightaction);
                        rightbtn.style.top = "calc(50% - 7px - " + emhalf + ")";
                        rightbtn.style.left = "initial";
                        rightbtn.style.right = "-" + em1;
                        outerdiv.appendChild(rightbtn);
                        ui_els.push(rightbtn);

                        add_lrhover(false, rightbtn, rightaction);

                        if (settings.mouseover_ui_gallerycounter) {
                            if (use_cached_gallery) {
                                next_images = cached_nextimages;
                            } else {
                                next_images = count_gallery(true);
                                cached_nextimages = next_images;
                            }
                        }
                    }

                    if (prev_images + next_images > 0) {
                        var text;
                        if (prev_images + next_images > settings.mouseover_ui_gallerymax) {
                            text = settings.mouseover_ui_gallerymax + "+";
                        } else {
                            text = (prev_images + 1) + " / " + (prev_images + next_images + 1);
                        }

                        var images_total = addbtn(text, "", null, true);
                        images_total.style.fontSize = gallerycount_fontsize;
                        topbarel.appendChild(images_total);
                    }

                    if (settings.mouseover_ui_optionsbtn) {
                        var optionsurl = options_page;
                        var optionsbtn = addbtn("⚙", "Options", options_page, true);
                        topbarel.appendChild(optionsbtn);
                    }
                }

                if (settings.mouseover_ui)
                    create_ui();

                var a = document.createElement("a");
                //a.addEventListener("click", function(e) {
                a.onclick = function(e) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return true;
                };
                a.style.all = "initial";
                a.style.cursor = "pointer";
                a.style.setProperty("vertical-align", "bottom", "important");
                a.style.setProperty("display", "block", "important");
                a.href = url;
                a.target = "_blank";
                a.appendChild(img);
                div.appendChild(a);

                function startdrag(e) {
                    dragstart = true;
                    dragged = false;
                    dragstartX = e.clientX;
                    dragstartY = e.clientY;
                    dragoffsetX = dragstartX - parseFloat(outerdiv.style.left);
                    dragoffsetY = dragstartY - parseFloat(outerdiv.style.top);
                }

                if (get_single_setting("mouseover_pan_behavior") === "drag") {
                    div.ondragstart = a.ondragstart = img.ondragstart = function(e) {
                        //dragstart = true;
                        //dragged = false;
                        startdrag(e);
                        //e.stopPropagation();
                        estop(e);
                        return false;
                    };

                    //div.ondrop = estop;

                    div.onmousedown = a.onmousedown = function(e) {
                        if (btndown || e.button !== 0)
                            return;

                        //dragstart = true;
                        //dragged = false;
                        startdrag(e);

                        e.preventDefault();
                        estop(e);
                        return false;
                    };

                    img.onmousedown = function(e) {
                        if (btndown || e.button !== 0)
                            return;

                        //dragstart = true;
                        //dragged = false;
                        startdrag(e);

                        estop(e);
                        return true;
                    };

                    div.onmouseup = div.onclick = a.onmouseup = a.onclick = function(e) {
                        dragstart = false;

                        if (dragged) {
                            //estop(e);
                            return false;
                        }

                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        return true;
                    };

                    // Enabling this makes buttons not work after clicking the link
                    //div.addEventListener("click", div.onclick, true);
                    //a.addEventListener("click", a.onclick, true);

                    img.onmouseup = img.onclick = function(e) {
                        dragstart = false;
                        //estop(e);
                        return true;
                    };
                }

                var currentmode = initial_zoom_behavior;

                outerdiv.onwheel = function(e) {
                    if (get_single_setting("mouseover_scroll_behavior") === "pan") {
                        estop(e);
                        outerdiv.style.left = (parseInt(outerdiv.style.left) + e.deltaX) + "px";
                        outerdiv.style.top = (parseInt(outerdiv.style.top) + e.deltaY) + "px";
                        return false;
                    }

                    if (get_single_setting("mouseover_scroll_behavior") !== "zoom") {
                        return;
                    }

                    estop(e);

                    var changed = false;

                    var offsetX = e.clientX - parseFloat(outerdiv.style.left);
                    var offsetY = e.clientY - parseFloat(outerdiv.style.top);

                    var percentX = offsetX / outerdiv.clientWidth;
                    var percentY = offsetY / outerdiv.clientHeight;

                    var scroll_zoom = get_single_setting("scroll_zoom_behavior");

                    if (scroll_zoom === "fitfull") {
                        if (e.deltaY > 0 && currentmode !== "fit") {
                            update_vwh();
                            img.style.maxWidth = vw + "px";
                            img.style.maxHeight = vh + "px";

                            currentmode = "fit";
                            changed = true;
                        } else if (e.deltaY < 0 && currentmode !== "full") {
                            img.style.maxWidth = "initial";
                            img.style.maxHeight = "initial";

                            currentmode = "full";
                            changed = true;
                        }
                    } else if (scroll_zoom === "incremental") {
                        var imgwidth = img.clientWidth;
                        var imgheight = img.clientHeight;

                        var mult = 1;
                        if (imgwidth < img.naturalWidth) {
                            mult = img.naturalWidth / imgwidth;
                        } else {
                            mult = imgwidth / img.naturalWidth;
                        }

                        mult = Math.round(mult);

                        if (imgwidth < img.naturalWidth) {
                            mult = 1 / mult;
                        }

                        if (e.deltaY > 0) {
                            mult /= 2;
                        } else {
                            mult *= 2;
                        }

                        imgwidth = img.naturalWidth * mult;
                        imgheight = img.naturalHeight * mult;

                        if (imgwidth < 64 || imgheight < 64 ||
                            imgwidth > img.naturalWidth * 16 ||
                            imgheight > img.naturalHeight * 16) {
                            return false;
                        }

                        img.style.maxWidth = imgwidth + "px";
                        img.style.maxHeight = imgheight + "px";
                        img.style.width = imgwidth + "px";
                        img.style.height = imgheight + "px";
                        changed = true;
                    }

                    if (!changed)
                        return false;

                    var imgwidth = outerdiv.clientWidth;
                    var imgheight = outerdiv.clientHeight;

                    var newx, newy;

                    if ((imgwidth <= vw && imgheight <= vh) || scroll_zoom === "incremental" || true) {
                        // centers wanted region to pointer
                        newx = (e.clientX - percentX * imgwidth);
                        newy = (e.clientY - percentY * imgheight);
                    } else if (imgwidth > vw || imgheight > vh) {
                        // centers wanted region to center of screen
                        newx = (vw / 2) - percentX * imgwidth;
                        var endx = newx + imgwidth;
                        if (newx > border_thresh && endx > (vw - border_thresh))
                            newx = Math.max(border_thresh, (vw + border_thresh) - imgwidth);

                        if (newx < border_thresh && endx < (vw - border_thresh))
                            newx = Math.min(border_thresh, (vw + border_thresh) - imgwidth);

                        newy = (vh / 2) - percentY * imgheight;
                        var endy = newy + imgheight;
                        if (newy > border_thresh && endy > (vh - border_thresh))
                            newy = Math.max(border_thresh, (vh + border_thresh) - imgheight);

                        if (newy < border_thresh && endy < (vh - border_thresh))
                            newy = Math.min(border_thresh, (vh + border_thresh) - imgheight);
                    }

                    if (imgwidth <= vw && imgheight <= vh) {
                        newx = Math.max(newx, border_thresh);
                        if (newx + imgwidth > (vw - border_thresh)) {
                            newx = (vw + border_thresh) - imgwidth;
                        }

                        newy = Math.max(newy, border_thresh);
                        if (newy + imgheight > (vh - border_thresh)) {
                            newy = (vh + border_thresh) - imgheight;
                        }
                    }

                    //var lefttop = get_lefttopouter();
                    outerdiv.style.left = (newx/* - lefttop[0]*/) + "px";
                    outerdiv.style.top = (newy/* - lefttop[1]*/) + "px";

                    create_ui(true);

                    return false;
                };

                document.documentElement.appendChild(outerdiv);
                popups.push(outerdiv);
                popupshown = true;

                stop_waiting();
                popups_active = true;
                //console_log(div);
            }

            cb(data.data.img, data.data.newurl);
            return;

            var newobj = deepcopy(obj);
            if (orig_url && obj_indexOf(orig_url) < 0) {
                newobj.push(fillobj(orig_url)[0]);
            }

            check_image_get(newobj, cb, processing);
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

        function valid_source(source) {
            var thresh = 20;

            if (source.tagName !== "PICTURE" &&
                source.tagName !== "IMG" &&
                source.tagName !== "SOURCE") {
                var style = get_computed_style(source);
                if (style.getPropertyValue("background-image")) {
                    var bgimg = style.getPropertyValue("background-image");
                    if (!bgimg.match(/^ *url[(]/)) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            return !(source.width && source.width < thresh ||
                     source.height && source.height < thresh);
        }

        function get_computed_style(el) {
            return el.currentStyle || window.getComputedStyle(el);
        }

        function find_source(els) {
            // resetpopups() is already called in trigger_popup()
            /*if (popups.length >= 1)
                return;*/

            //console_log(els);

            var sources = {};
            var picture_sources = {};
            var links = {};
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

            var thresh = 20;

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
                return urljoin(document.location.href, src, true);
            }

            function addImage(src, el, options) {
                // blank images
                // https://www.harpersbazaar.com/celebrity/red-carpet-dresses/g7565/selena-gomez-style-transformation/?slide=2
                var el_style = null;
                if (el) {
                    el_style = window.getComputedStyle(el);
                }

                if (src.match(/^data:/) && src.length <= 500 ||
                    // https://www.smugmug.com/
                    (el_style && (el_style.opacity === '0' ||
                                  el_style.visibility === "hidden")))
                    return false;

                if (!options) {
                    options = {};
                }

                if (!(src in sources)) {
                    sources[src] = {
                        count: 1,
                        src: src,
                        el: el,
                        id: id++
                    };

                    if (options.isbg)
                        sources[src].isbg = true;
                } else {
                    sources[src].count++;
                }

                return true;
            }

            function addTagElement(el) {
                if (el.tagName === "PICTURE") {
                    for (var i = 0; i < el.children.length; i++) {
                        addElement(el.children[i]);
                    }
                } else if (el.tagName === "SOURCE" || el.tagName === "IMG") {
                    if (el.src) {
                        var src = norm(el.src);
                        if (!addImage(src, el))
                            return;

                        sources[src].width = el.naturalWidth;
                        sources[src].height = el.naturalHeight;
                    }

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
                } else if (el.tagName === "A") {
                    var src = el.href;
                    links[src] = {
                        count: 1,
                        src: src,
                        el: el,
                        id: id++
                    };
                }
            }

            function addElement(el) {
                addTagElement(el);

                var style = window.getComputedStyle(el);
                if (style.getPropertyValue("background-image")) {
                    var bgimg = style.getPropertyValue("background-image");
                    if (bgimg.match(/^ *url[(]/)) {
                        // url('https://t00.deviantart.net/I94eYVLky718W9_zFjV-SJ-_qm8=/300x200/filters:fixed_height(100,100):origin()/pre00/abda/th/pre/i/2013/069/9/0/black_rock_shooter_by_mrtviolet-d5xktg7.jpg');
                        var src = norm(bgimg.replace(/^ *url[(](?:(?:'(.*?)')|(?:"(.*?)")|(?:([^)]*)))[)].*$/, "$1$2$3"));
                        if (src !== bgimg)
                            addImage(src, el, {
                                isbg: true
                            });
                    }
                }
            }

            // todo: do multiple passes, one per layer
            // would fix google+, with large backgrounds and small profile images

            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                addElement(el);
            }

            /*console_log(els);
            console_log(sources);*/

            if ((source = getsource()) !== undefined) {
                if (source === null && get_single_setting("mouseover_links")) {
                    if (Object.keys(links).length > 0) {
                        return links[Object.keys(links)[0]];
                    }
                }

                return source;
            }

            // disable for now, fix later, for websites that don't work with imu
            if (false) {
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
            }

            var newsources = {};

            /*console_log(minW);
              console_log(minH);
              console_log(minMinW);
              console_log(minMinH);
              console_log(minMaxW);
              console_log(minMaxH);
              console_log(minX);*/

            /*if (minW <= thresh)
                minW = 0;

            if (minH <= thresh)
                minH = 0;

            if (minMinW <= thresh)
                minMinW = 0;

            if (minMinH <= thresh)
                minMinH = 0;

            if (minMaxW <= thresh)
                minMaxW = 0;

            if (minMaxH <= thresh)
            minMaxH = 0;*/

            // Remove hidden elements
            // Test: https://www.vogue.com/article/lady-gaga-met-gala-2019-entrance-behind-the-scenes-video
            for (var source_url in sources) {
                var source = sources[source_url];

                var visible = true;
                var el = source.el;
                do {
                    if (!el || !el.style)
                        break;

                    if (el.style.opacity.toString().match(/^0(?:\.0*)?$/)) {
                        visible = false;
                        break;
                    }
                } while (el = el.parentElement);

                if (!visible)
                    continue;

                newsources[source_url] = source;
            }

            sources = newsources;
            newsources = {};

            if ((source = getsource()) !== undefined)
                return source;

            for (var source_url in sources) {
                var source = sources[source_url];

                if (source.width && source.width < thresh ||
                    source.height && source.height < thresh)
                    continue;

                newsources[source_url] = source;
            }

            sources = newsources;
            newsources = {};

            if ((source = getsource()) !== undefined)
                return source;

            if ((minW !== 0 ||
                 minH !== 0 ||
                 minMinW !== 0 ||
                 minMinH !== 0 ||
                 minMaxW !== 0 ||
                 minMaxH !== 0 ||
                 minX !== 0) && false) {
                for (var source_url in sources) {
                    var source = sources[source_url];

                    if ((source.width && source.width > thresh && source.width >= minW) || (source.height && source.height > thresh && source.height >= minH))
                        newsources[source_url] = source;

                    if ((source.minWidth && source.minWidth > thresh && source.minWidth >= minMinW) || (source.minHeight && source.minHeight > thresh && source.minHeight >= minMinH))
                        newsources[source_url] = source;

                    if ((source.maxWidth && source.maxWidth > thresh && source.maxWidth >= minMaxW) || (source.maxHeight && source.maxHeight > thresh && source.maxHeight >= minMaxH))
                        newsources[source_url] = source;

                    if (source.desc_x && source.desc_x >= minX)
                        newsources[source_url] = source;

                    if (source.width === undefined &&
                        source.height === undefined &&
                        source.minWidth === undefined &&
                        source.minHeight === undefined &&
                        source.maxWidth === undefined &&
                        source.maxHeight === undefined)
                        newsources[source_url] = source;

                }

                //console_log(newsources);

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

                //console_log(newsources);

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

            //console_log(sources);

            if (source = getsource())
                return source;
            else if (source === null)
                return getfirstsource(orig_sources);


            // if there are background images ahead of an image, it's likely to be masks
            if (Object.keys(sources).length > 1 && sources[Object.keys(sources)[0]].isbg) {
                for (var source in sources) {
                    if (!sources[source].isbg)
                        return sources[source];
                }
            }

            if (false) {
                for (var source_url in sources) {
                    var source = sources[source_url];

                    var source_url_imu = bigimage_recursive(source_url, {
                        fill_object: false,
                        use_cache: false,
                        do_request: function() {},
                        cb: function() {}
                    });
                    if (source_url_imu !== source_url)
                        newsources[source_url] = source;
                }

                var orig_sources = sources;
                sources = newsources;
            }

            //console_log(sources);

            if (source = getsource())
                return source;
            else if (source === null)
                return getfirstsource(orig_sources);
            else
                return getfirstsource(sources);
        }

        function get_next_in_gallery(el, nextprev) {
            if (!el)
                return null;

            var stack = [el.tagName];
            var current_el = el;
            var firstchild = false;

            while (true) {
                if (!firstchild) {
                    var next = current_el.nextElementSibling;
                    if (!nextprev)
                        next = current_el.previousElementSibling;

                    if (!next) {
                        current_el = current_el.parentElement;
                        if (!current_el)
                            break;

                        stack.unshift(current_el.tagName);
                        continue;
                    }

                    current_el = next;
                } else {
                    firstchild = false;
                }

                if (current_el.tagName === stack[0]) {
                    if (stack.length === 1) {
                        if (valid_source(current_el))
                            return current_el;
                        continue;
                    }

                    if (nextprev) {
                        for (var i = 0; i < current_el.children.length; i++) {
                            if (current_el.children[i].tagName === stack[1]) {
                                current_el = current_el.children[i];
                                stack.shift();
                                firstchild = true;
                                break;
                            }
                        }
                    } else {
                        for (var i = current_el.children.length - 1; i >= 0; i--) {
                            if (current_el.children[i].tagName === stack[1]) {
                                current_el = current_el.children[i];
                                stack.shift();
                                firstchild = true;
                                break;
                            }
                        }
                    }
                }
            }

            return null;
        }

        /*function normalize_trigger() {
            if (!(settings.mouseover_trigger instanceof Array)) {
                settings.mouseover_trigger = [settings.mouseover_trigger];
            }
        }

        normalize_trigger();*/

        delay = settings.mouseover_trigger_delay;
        if (delay <= 0 || isNaN(delay))
            delay = false;
        if (typeof delay === "number" && delay >= 10)
            delay = 10;

        if (settings.mouseover_trigger_behavior === "mouse") {
            delay_mouseonly = true;
        } else {
            delay = false;
            delay_mouseonly = false;
        }

        function keystr_in_trigger(str) {
            return settings.mouseover_trigger_key.indexOf(str) >= 0;
        }

        function key_in_trigger(key) {
            var str = keycode_to_str(key);
            if (str === undefined)
                return false;

            return keystr_in_trigger(str);
        }

        function set_chord_sub(str, value) {
            if (value) {
                if (current_chord.indexOf(str) < 0) {
                    current_chord.push(str);
                    //console_log("+" + str);
                    return true;
                }
            } else {
                if (current_chord.indexOf(str) >= 0) {
                    current_chord.splice(current_chord.indexOf(str), 1);
                    //console_log("-" + str);
                    return true;
                }
            }

            return false;
        }

        function set_chord(e, value) {
            var map = get_keystrs_map(e, value)

            var changed = false;
            for (var key in map) {
                if (!keystr_in_trigger(key))
                    continue;

                if (set_chord_sub(key, map[key]))
                    changed = true;
            }

            return changed;
        }

        function trigger_complete(e) {
            for (var i = 0; i < settings.mouseover_trigger_key.length; i++) {
                var key = settings.mouseover_trigger_key[i];

                if (current_chord.indexOf(key) < 0)
                    return false;
            }

            return true;
        }

        function trigger_partially_complete(e) {
            for (var i = 0; i < settings.mouseover_trigger_key.length; i++) {
                var key = settings.mouseover_trigger_key[i];

                if (current_chord.indexOf(key) >= 0)
                    return true;
            }

            return false;
        }

        function get_single_setting(setting) {
            if (settings[setting] instanceof Array)
                return settings[setting][0];
            return settings[setting];
        }

        function get_close_behavior() {
            return get_single_setting("mouseover_close_behavior");
        }

        function find_els_at_point(xy, els, prev) {
            if (!prev) {
                prev = [];
            }

            var ret = [];

            if (!els) {
                els = document.elementsFromPoint(xy[0], xy[1]);
                ret = els;
            }

            for (var i = 0; i < els.length; i++) {
                var el = els[i];

                if (prev.indexOf(el) >= 0)
                    continue;

                prev.push(el);

                var rect = el.getBoundingClientRect();
                if (rect.left <= xy[0] && rect.right >= xy[0] &&
                    rect.top <= xy[1] && rect.bottom >= xy[1] &&
                    ret.indexOf(el) < 0) {
                    ret.push(el);
                }

                if (el.children && el.children.length > 0) {
                    var newels = find_els_at_point(xy, el.children, prev);
                    for (var j = 0; j < newels.length; j++) {
                        var newel = newels[j];
                        if (ret.indexOf(newel) < 0)
                            ret.push(newel);
                    }
                }
            }

            return ret;
        }

        function trigger_popup(is_contextmenu) {
            controlPressed = true;
            //var els = document.elementsFromPoint(mouseX, mouseY);
            var point = [mouseX, mouseY];
            if (is_contextmenu)
                point = [mouseContextX, mouseContextY];
            var els = find_els_at_point(point);
            //console_log(els);

            var source = find_source(els);
            if (source) {
                trigger_popup_with_source(source);
            }
        }

        function trigger_popup_with_source(source, automatic, use_last_pos) {
            var processing = {running: true};
            for (var i = 0; i < processing_list.length; i++) {
                processing_list[i].running = false;
            }
            processing_list = [processing];

            //console_log(source);

            var do_popup = function() {
                start_waiting();

                var x = mouseX;
                var y = mouseY;

                if (use_last_pos) {
                    x = lastX;
                    y = lastY;
                }

                var realcb = function(source_imu, data) {
                    //console_log(source_imu);
                    //console_log(data);
                    if ((!source_imu && false) || !data) {
                        stop_waiting();
                        return;
                    }

                    //console_log(source_imu);
                    resetpopups();

                    popup_el = source.el;
                    makePopup(source_imu, source.src, processing, {
                        data: data,
                        x: x,
                        y: y
                    });
                };

                try {
                    bigimage_recursive_loop(source.src, {
                        fill_object: true,
                        host_url: document.location.href,
                        document: document,
                        window: window,
                        element: source.el,
                        cb: realcb
                    }, function(obj, finalcb) {
                        var newobj = deepcopy(obj);

                        if (source.src && obj_indexOf(newobj, source.src) < 0)
                            newobj.push(fillobj(source.src)[0]);

                        var openb = get_single_setting("mouseover_open_behavior");

                        if (openb === "newtab") {
                            processing.head = true;
                        }

                        check_image_get(newobj, function(img, newurl) {
                            if (!img) {
                                return finalcb(null);
                            }

                            var data = {img: img, newurl: newurl};
                            var newurl1 = newurl;

                            if (openb === "newtab") {
                                data = {resp: img, obj: newurl};
                                newurl1 = data.resp.finalUrl;
                            }

                            finalcb(newurl1, data);
                            return;
                            // why?
                            if (newurl == source.src) {
                                realcb(obj, data);
                            } else {
                                finalcb(newurl, data);
                            }
                        }, processing);
                    });
                } catch (e) {
                    console_error(e);
                    //console.trace();
                    // this doesn't work
                    makePopup(source.src);
                }
            };

            if (delay && !delay_mouseonly && !automatic) {
                start_progress();
                delay_handle = setTimeout(function() {
                    delay_handle = null;
                    do_popup();
                }, delay * 1000);
            } else {
                do_popup();
            }
        }

        function wrap_gallery_func(nextprev, el) {
            if (!el)
                el = popup_el;

            var options = {
                element: popup_el,
                host_url: document.location.href
            };

            var helpers = get_helpers(options);
            var gallery = get_next_in_gallery;

            if (helpers && helpers.gallery) {
                gallery = function(el, nextprev) {
                    var value = helpers.gallery(el, nextprev);
                    if (value)
                        return value;

                    return get_next_in_gallery(el, nextprev);
                };
            }

            return gallery(el, nextprev);
        }

        function is_valid_el(el) {
            if (!el)
                return false;

            return !!find_source([el]);
        }

        function count_gallery(nextprev, el) {
            var count = 0;
            while ((el = wrap_gallery_func(nextprev, el))) {
                if (!is_valid_el(el))
                    break;

                count++;

                if (count >= settings.mouseover_ui_gallerymax)
                    break;
            }

            return count;
        }

        function trigger_gallery(nextprev) {
            var newel = wrap_gallery_func(nextprev);

            if (newel) {
                var source = find_source([newel]);
                if (source) {
                    trigger_popup_with_source(source, true, true);
                    return true;
                }
            }

            return false;
        }

        document.addEventListener('keydown', function(event) {
            if (set_chord(event, true)) {
                if (trigger_complete(event) && !popups_active) {
                    if (!delay_handle)
                        trigger_popup();
                }
            }

            if (popups.length > 0 && popup_el) {
                var ret = undefined;

                if (event.which === 37) { // left
                    trigger_gallery(false);
                    ret = false;
                } else if (event.which === 39) { // right
                    trigger_gallery(true);
                    ret = false;
                }

                if (ret === false) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    event.stopPropagation();
                }

                return ret;
            }
        }, true);

        document.addEventListener('keyup', function(event) {
            var condition = set_chord(event, false);

            var close_behavior = get_close_behavior();
            if (condition && close_behavior === "all") {
                condition = !trigger_partially_complete(event);
            }

            if (condition && close_behavior !== "esc") {
                controlPressed = false;
                stop_waiting();

                resetpopups();

                return;
            }

            // esc
            if (event.which === 27 ||
                delay_handle) {
                stop_waiting();
                resetpopups();
            }
        }, true);

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

        function do_popup_pan(popup, event, mouseX, mouseY) {
            var pan_behavior = get_single_setting("mouseover_pan_behavior");
            if (pan_behavior === "drag" && (event.buttons === 0 || !dragstart))
                return;

            var viewport = get_viewport();
            var edge_buffer = 40;
            var min_move_amt = 5;

            if (pan_behavior === "drag" && dragstart) {
                var origleft = parseInt(popup.style.left);
                //var left = origleft + event.movementX;
                var left = mouseX - dragoffsetX;

                if (left !== origleft) {
                    if (dragged || Math.abs(left - origleft) >= min_move_amt) {
                        lastX = left - (origleft - lastX);
                        popup.style.left = left + "px";
                        dragged = true;
                    }
                }
            } else if (pan_behavior === "movement" && popup.offsetWidth > viewport[0]) {
                var mouse_edge = Math.min(Math.max((mouseX - edge_buffer), 0), viewport[0] - edge_buffer * 2);
                var percent = mouse_edge / (viewport[0] - (edge_buffer * 2));
                popup.style.left = percent * (viewport[0] - popup.offsetWidth) + "px";
            }

            if (pan_behavior === "drag" && dragstart) {
                var origtop = parseInt(popup.style.top);
                //var top = origtop + event.movementY;
                var top = mouseY - dragoffsetY;

                if (top !== origtop) {
                    if (dragged || Math.abs(top - origtop) >= min_move_amt) {
                        lastY = top - (origtop - lastY);
                        popup.style.top = top + "px";
                        dragged = true;
                    }
                }
            } else if (pan_behavior === "movement" && popup.offsetHeight > viewport[1]) {
                var mouse_edge = Math.min(Math.max((mouseY - edge_buffer), 0), viewport[1] - edge_buffer * 2);
                var percent = mouse_edge / (viewport[1] - (edge_buffer * 2));
                popup.style.top = percent * (viewport[1] - popup.offsetHeight) + "px";
            }
        }

        if (is_extension) {
            chrome.runtime.onMessage.addListener(function(message, sender, respond) {
                //console_log("ON_MESSAGE", message);
                if (message.type === "context_imu") {
                    trigger_popup(true);
                }
            });
        }

        document.addEventListener('contextmenu', function(event) {
            mouseContextX = event.clientX;
            mouseContextY = event.clientY;

            mouseAbsContextX = event.pageX;
            mouseAbsContextY = event.pageY;
        });

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

            if (popups.length > 0) {
                do_popup_pan(popups[0], event, mouseX, mouseY);
            }

            if (delay !== false && typeof delay === "number" && delay_mouseonly) {
                if (delay_handle) {
                    clearTimeout(delay_handle);

                    if (waiting)
                        stop_waiting();

                    if (popups.length > 0) {
                        var jitter_threshx = 40;
                        var jitter_threshy = jitter_threshx;

                        var img = popups[0].getElementsByTagName("img")[0];
                        if (img) {
                            var w = Math.min(parseInt(img.style.maxWidth), img.naturalWidth);
                            var h = Math.min(parseInt(img.style.maxHeight), img.naturalHeight);

                            jitter_threshx = Math.min(Math.max(jitter_threshx, w / 3), img.naturalWidth);
                            jitter_threshy = Math.min(Math.max(jitter_threshy, h / 3), img.naturalHeight);
                        }

                        if (Math.abs(mouseX - mouseDelayX) > jitter_threshx ||
                            Math.abs(mouseY - mouseDelayY) > jitter_threshy) {
                            resetpopups();
                        }
                    }
                }

                if (popups.length === 0) {
                    mouseDelayX = mouseX;
                    mouseDelayY = mouseY;

                    delay_handle = setTimeout(trigger_popup, delay * 1000);
                }
            }
        });
    }

    function do_websitehome() {
        unsafeWindow.imu_variable = bigimage_recursive;
        unsafeWindow.imu_inject = 1;
        unsafeWindow.do_imu = function(url, cb) {
            return unsafeWindow.imu_variable(url, {
                fill_object: true,
                do_request: do_request,
                cb: cb
            });
        };

        var orig_set_max = unsafeWindow.set_max;
        unsafeWindow.set_max = function(obj) {
            if (!obj || !obj[0].url) {
                orig_set_max(obj);
                return;
            }

            var loop_url = function(obj, cb, options, lasturl) {
                check_image_get(obj, function(img, newurl) {
                    var finalurl = newurl;
                    if (!newurl && img && img.finalUrl) {
                        finalurl = img.finalUrl;
                    }

                    if (!finalurl) {
                        cb(img, newurl);
                        return;
                    }

                    if (obj_indexOf(obj, finalurl) < 0 &&
                        lasturl !== finalurl) {
                        bigimage_recursive(finalurl, {
                            fill_object: true,
                            do_request: do_request,
                            cb: function(obj) {
                                loop_url(obj, cb, options, finalurl);
                            }
                        });
                    } else {
                        cb(img, newurl);
                    }
                }, options);
            };

            if (settings.website_image) {
                loop_url(obj, function(img, url) {
                    if (!img) {
                        orig_set_max("broken");
                    } else {
                        orig_set_max([{url: url}]);
                        maximgel.src = img.src;
                    }
                }, {running: true});
            } else if (obj.can_head) {
                loop_url(obj, function(resp) {
                    if (!resp) {
                        orig_set_max("broken");
                    } else {
                        orig_set_max([{url: resp.finalUrl}]);
                    }
                }, {running: true, head: true});
            } else {
                orig_set_max(obj);
            }
        };
    }

    function start() {
        do_export();

        if (is_userscript || is_extension) {
            if (settings.redirect)
                do_redirect();

            if (document.location.href.match(/^https?:\/\/qsniyg\.github\.io\/maxurl\/options\.html/) ||
                document.location.href.match(/^file:\/\/.*\/maxurl\/site\/options\.html/) ||
                (is_extension && is_extension_options_page)) {
                onload(function() {
                    do_options();
                });
            }

            if (document.location.href.match(/^https?:\/\/qsniyg\.github\.io\/maxurl(\/|\/index\.html(?:[?#].*)?)?$/) ||
                document.location.href.match(/^file:\/\/.*\/maxurl\/site\/index\.html/)) {
                if (typeof(unsafeWindow) !== "undefined") {
                    onload(function() {
                        do_websitehome();
                    });
                }
            }

            if (settings.mouseover)
                do_mouseover();
        }
    }

    do_config();
})();
