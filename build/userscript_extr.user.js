// @license http://www.apache.org/licenses/LICENSE-2.0 Apache-2.0
// ^ for LibreJS (this has to be the first comment in the file)

// ==UserScript==
// @name              Image Max URL
// @name:en           Image Max URL
// @name:ko           Image Max URL
// @name:fr           Image Max URL
// @name:es           Image Max URL
// @name:ru           Image Max URL
// @name:de           Image Max URL
// @name:ja           Image Max URL
// @name:zh           Image Max URL
// @name:zh-CN        Image Max URL
// @name:zh-TW        Image Max URL
// @name:zh-HK        Image Max URL
// @namespace         http://tampermonkey.net/
// @version           0.14.7
// @description       Finds larger or original versions of images and videos for 7400+ websites, including a powerful media popup feature
// @description:en    Finds larger or original versions of images and videos for 7400+ websites, including a powerful media popup feature
// @description:ko    7400개 이상의 사이트에 대해 고화질이나 원본 이미지를 찾아드립니다
// @description:fr    Trouve des versions plus grandes ou originales d'images et de vidéos pour plus de 7 400 sites web, y compris une puissante fonction de popup média
// @description:es    Encuentra imágenes más grandes y originales para más de 7400 sitios
// @description:ru    Находит увеличенные или оригинальные версии изображений для более чем 7400 веб-сайтов
// @description:de    Sucht nach größeren oder originalen Versionen von Bildern und Videos für mehr als 7400 Websites
// @description:ja    7400以上のウェブサイトで高画質や原本画像を見つけ出します
// @description:zh    为7400多个网站查找更大或原始图像
// @description:zh-CN 为7400多个网站查找更大或原始图像
// @description:zh-TW 為7400多個網站查找更大或原始圖像
// @description:zh-HK 為7400多個網站查找更大或原始圖像
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
// non-greasyfork/oujs versions need updateURL and downloadURL to auto-update for certain userscript managers
// @updateURL         https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript.meta.js
// @downloadURL       https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript_smaller.user.js
//
//  Greasyfork and OpenUserJS have 2MB and 1MB limits for userscripts (respectively).
//  Because of this, the rules (~1.3MB) have been split into a separate file, linked below.
//  Note that jsdelivr.net might not always be reliable, but (AFAIK) this is the only reasonable option from what greasyfork allows.
//  I'd recommend using the Github version of the script if you encounter any issues (linked in the 'Project links' section below).
//
// @require https://cdn.jsdelivr.net/gh/qsniyg/maxurl@e1499d17b59b9ad874d26baca98ecdff77460a0f/build/rules.js
// ==/UserScript==

// If you see "A userscript wants to access a cross-origin resource.", it's used for:
//   * Detecting whether or not the destination URL exists before redirecting
//   * API calls for various websites to find the larger image (e.g. for Flickr)
//     * You can control this with the "Rules using API calls" setting
//   * Downloading the image for the popup
//   * Querying a third-party library
//     * You can control this with the "Rules using 3rd-party libraries" setting.
//       3rd-party libraries are disabled by default for security reasons.
// Search for do_request, api_query, and website_query if you want to see what the code does exactly.
//
// Please contact me if you have any questions or concerns regarding the script.
//
// Project links:
//
//   * Github:          https://github.com/qsniyg/maxurl
//   * Discord:         https://discord.gg/fH9Pf54
//   * Reddit:          https://www.reddit.com/r/MaxImage/
//   * Website:         https://qsniyg.github.io/maxurl/
//   * Guide:           https://qsniyg.github.io/maxurl/guide.html
//   * Userscript:
//     * Greasyfork:    https://greasyfork.org/scripts/36662-image-max-url
//     * OpenUserJS:    https://openuserjs.org/scripts/qsniyg/Image_Max_URL
//     * Github:        https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript_smaller.user.js
//     * Github (beta): https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript.user.js
//   * Firefox addon:   https://addons.mozilla.org/firefox/addon/image-max-url/
//   * Opera extension: https://addons.opera.com/en/extensions/details/image-max-url/




var $$IMU_EXPORT$$;

// Disable linting because otherwise editing is incredibly slow
// jshint ignore: start
(function() {
	// Don't 'use strict', as it prevents nested functions
	//'use strict';

	var _nir_debug_ = false;

	if (_nir_debug_) {
		_nir_debug_ = {
			no_request: false,
			no_recurse: false,
			no_redirect: true,

			// channels
			map: true,
			cache: true,
			bigimage_recursive: true,
			input: true,
			check_image_get: true,
			find_source: true
		};

		console.log("Loaded");
	}

	var nullfunc = function(){};

	var is_extension = false;
	var is_webextension = false;
	var is_extension_bg = false;
	var is_firefox_webextension = false;
	var extension_send_message = null;
	var extension_options_page = null;
	var is_extension_options_page = false;
	var is_options_page = false;
	var is_maxurl_website = false;
	var window_location = null;
	var options_page = "https://qsniyg.github.io/maxurl/options.html";
	var preferred_options_page = options_page;
	var firefox_addon_page = "https://addons.mozilla.org/en-US/firefox/addon/image-max-url/";
	var userscript_update_url = "https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript_smaller.user.js";
	var greasyfork_update_url = userscript_update_url;
	//var greasyfork_update_url = "https://greasyfork.org/scripts/36662-image-max-url/code/Image%20Max%20URL.user.js";
	var github_issues_page = "https://github.com/qsniyg/maxurl/issues";
	var imu_icon = "https://raw.githubusercontent.com/qsniyg/maxurl/b5c5488ec05e6e2398d4e0d6e32f1bbad115f6d2/resources/logo_256.png";
	var current_version = null;
	var imagetab_ok_override = false;

	// -- Currently this is unused, it'll be used in a future release (to workaround the 1MB and 2MB limits for OUJS and Greasyfork respectively) --
	// This is only set for the Greasyfork/OUJS versions if it fails to @require the rules (contents of bigimage).
	// The likely causes would be either a CDN failure, or that the userscript manager doesn't support @require.
	var require_rules_failed = false;

	var get_window = function() {
		if (typeof(unsafeWindow) !== "undefined")
			return unsafeWindow || this.window || window;

		return this.window || window;
	};

	try {
		window_location = window.location.href;

		if (/^https?:\/\/qsniyg\.github\.io\/+maxurl\/+options\.html/.test(window_location) ||
			/^file:\/\/.*\/maxurl\/site\/options\.html/.test(window_location)) {
			is_options_page = true;
			is_maxurl_website = true;
		} else if (/^https?:\/\/qsniyg\.github\.io\/+maxurl\/+/.test(window_location) ||
			/^file:\/\/.*\/maxurl\/site\/(?:index|about|options)\.html/.test(window_location)) {
			is_maxurl_website = true;
		}
	} catch(e) {
	}

	var check_if_extension = function() {
		if (typeof chrome !== "object" || typeof chrome.runtime !== "object")
			return;

		try {
			var extension_manifest = chrome.runtime.getManifest();
			is_extension = extension_manifest.name === "Image Max URL";

			if (!is_extension)
				return;

			var location = window.location.href;

			is_extension_bg = location.match(/^([-a-z]+)extension:\/\/[^/]+\/+_generated_background_page\.html/);

			extension_options_page = chrome.runtime.getURL("extension/options.html");
			is_extension_options_page = location.replace(/[?#].*$/, "") === extension_options_page;
			is_options_page = is_options_page || is_extension_options_page;
			//options_page = extension_options_page; // can't load from website
			preferred_options_page = extension_options_page;

			is_webextension = true;
			if (navigator.userAgent.indexOf("Firefox") >= 0)
				is_firefox_webextension = true;

			current_version = extension_manifest.version;

			extension_send_message = function(message, respond) {
				message = deepcopy(message, {json:true});
				if (!respond)
					respond = nullfunc;

				if (is_extension_bg) {
					return userscript_extension_message_handler(message, respond);
				} else {
					return chrome.runtime.sendMessage(null, message, null, respond);
				}
			};
		} catch (e) {
		};
	};

	check_if_extension();

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

	// https://stackoverflow.com/a/326076
	var check_in_iframe = function() {
		try {
			return window.self !== window.top;
		} catch (e) {
			return true;
		}
	};
	var is_in_iframe = check_in_iframe();
	var is_remote_possible = false;

	var is_interactive = (is_extension || is_userscript) && !is_extension_bg;

	var userscript_manager = "unknown";
	var userscript_manager_version = "";
	if (is_userscript) {
		var gm_info = undefined;

		if (typeof GM_info === "function") {
			gm_info = GM_info();
		} else if (typeof GM_info === "object") {
			gm_info = GM_info;
		}

		if (typeof gm_info === "object") {
			if (gm_info.scriptHandler) {
				userscript_manager = gm_info.scriptHandler;
			}

			if (gm_info.version) {
				userscript_manager_version = gm_info.version;
			}
		} else if (typeof GM_fetch === 'function' && gm_info === null) {
			// Unfortunately FireMonkey currently doesn't implement GM_info's scriptHandler:
			//   https://github.com/erosman/support/issues/98#issuecomment-534671229
			// We currently have to rely on this hack
			userscript_manager = "FireMonkey";
			gm_info = {scriptHandler: userscript_manager};
		}

		if (_nir_debug_ && false) {
			console.log("GM_info", gm_info);
		}

		try {
			current_version = gm_info.script.version;
		} catch (e) {
			current_version = null;
		};
	}

	// restore console.log for websites that remove it (twitter)
	// https://gist.github.com/Ivanca/4586071
	//var console_log = function(){ return window.console.__proto__.log.apply(console, arguments) } ;
	//var console_error = function(){ return window.console.__proto__.error.apply(console, arguments) } ;

	// since the userscript is run first, this generally shouldn't be a problem
	var console_log = console.log;
	var console_error = console.error;
	var console_warn = console.warn;
	var console_trace = console.trace;

	var nir_debug = function() {};
	if (_nir_debug_) {
		nir_debug = function() {
			var channel = arguments[0];
			if (!_nir_debug_[channel])
				return;

			var args = [];
			for (var i = 1; i < arguments.length; i++) {
				args.push(arguments[i]);
			}

			console_log.apply(this, args);
		};
	}

	var JSON_stringify = JSON.stringify;
	var JSON_parse = JSON.parse;

	var base64_decode, base64_encode,
		is_array, array_indexof, string_indexof,
		// https://www.bing.com/ overrides Blob
		// https://www.dpreview.com/ overrides URL
		native_blob, native_URL,
		our_EventTarget, our_addEventListener, our_removeEventListener,
		string_fromcharcode, string_charat,
		document_createElement;

	if (is_node) {
		base64_decode = function(a) {
			return Buffer.from(a, 'base64').toString('binary');
		};

		base64_encode = function(a) {
			return Buffer.from(a).toString('base64');
		};
	}

	var get_compat_functions = function() {
		var native_functions_to_get = [];

		// Nano Defender(?) overrides this on some sites.
		var get_orig_eventtarget = function() {
			// native_functions returns iframe
			var EventTarget_addEventListener, EventTarget_removeEventListener;

			if (is_interactive) {
				our_EventTarget = EventTarget;
				EventTarget_addEventListener = our_EventTarget.prototype.addEventListener;
				EventTarget_removeEventListener = our_EventTarget.prototype.removeEventListener;
			}

			var eventhandler_map = null;

			var init_eventhandler_map = function() {
				if (!eventhandler_map)
					eventhandler_map = new_map();
			};

			our_addEventListener = function(element, event, handler, options) {
				// VM compatibility
				if (element === window && element.unsafeWindow)
					element = element.unsafeWindow;

				// i??.fastpic.ru: needles are 'click' and 'popMagic'
				var new_handler = function(e) {
					return handler(e);
				};

				init_eventhandler_map();
				map_set(eventhandler_map, handler, new_handler);

				EventTarget_addEventListener.call(element, event, new_handler, options);
			};

			our_removeEventListener = function(element, event, handler, options) {
				init_eventhandler_map();
				var new_handler = map_get(eventhandler_map, handler);
				if (!new_handler) {
					console_warn("Modified handler not found, defaulting to specified handler");
					new_handler = handler;
				} else {
					map_remove(eventhandler_map, new_handler);
				}

				EventTarget_removeEventListener.call(element, event, new_handler, options);
			};
		};
		get_orig_eventtarget();

		// i??.fastpic.ru with violentmonkey
		var get_orig_createelement = function() {
			var HTMLDocument_createElement;

			if (is_interactive) {
				HTMLDocument_createElement = HTMLDocument.prototype.createElement;
			}

			document_createElement = function(element) {
				return HTMLDocument_createElement.call(document, element);
			};
		};
		get_orig_createelement();

		var sanity_test = function(orig, correct, check, native_func) {
			if (!orig)
				return correct;

			if (check) {
				try {
					if (check(orig))
						return orig;
				} catch (e) {};
			}

			if (native_func) {
				native_functions_to_get.push(native_func);
			}

			return correct;
		};

		var get_is_array = function() {
			var is_array_orig = Array.isArray;
			var is_array_correct = function(x) {
				return x instanceof Array;
			};

			if (is_array_orig) {
				is_array = is_array_orig;
			} else {
				is_array = is_array_correct;
			}

			// FIXME: why is there no check? is this a bug, or was this intentional?
			//is_array = sanity_test(is_array_orig, is_array_correct);
		};
		get_is_array();

		// kickass.com
		var get_compat_string_fromcharcode = function() {
			var string_fromcharcode_orig = null;
			// ublock on clipwatching blocks this entirely
			try {
				var string_fromcharcode_orig = String.fromCharCode;
			} catch (e) {}

			var fromcharcode_check = function(func) {
				return func(50) === "2" && func(100) === "d" && func("50", "100") === "2d";
			};

			var fromcharcode_correct = function() {
				var unicode = "";

				for (var i = 0; i < arguments.length; i++) {
					unicode += "\\u" + ("0000" + parseInt(arguments[i]).toString(16)).slice(-4);
				}

				return JSON_parse('"' + unicode + '"');
			};

			string_fromcharcode = sanity_test(string_fromcharcode_orig, fromcharcode_correct, fromcharcode_check);
		};
		get_compat_string_fromcharcode();

		// porn.com (ublock)
		var get_compat_string_charat = function() {
			var string_prototype_charat = String.prototype.charAt;
			var string_charat_orig = function(string, x) {
				return string_prototype_charat.call(string, x);
			};

			var string_charat_correct = function(string, x) {
				var result = string[x];
				if (result === undefined)
					result = "";

				return result;
			};

			var string_charat_check = function(func) {
				var test_string = "abc";
				if (func(test_string, 0) === "a" &&
					func(test_string, 1) === "b" &&
					func(test_string, -1) === "" &&
					func(test_string, 3) === "") {
					return true;
				}

				return false;
			};

			string_charat = sanity_test(string_charat_orig, string_charat_correct, string_charat_check);
		};
		get_compat_string_charat();

		var get_compat_base64 = function() {
			if (is_node)
				return;

			// Some websites replace atob, so we have to provide our own implementation in those cases
			// https://stackoverflow.com/a/15016605
			// unminified version: https://stackoverflow.com/a/3058974
			var base64_decode_correct = function(s) {
				var e={},i,b=0,c,x,l=0,a,r='',w=string_fromcharcode,L=s.length;
				var A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
				for(i=0;i<64;i++){e[string_charat(A, i)]=i;}
				for(x=0;x<L;x++){
					c=e[string_charat(s, x)];b=(b<<6)+c;l+=6;
					while(l>=8){((a=(b>>>(l-=8))&0xff)||(x<(L-2)))&&(r+=w(a));}
				}
				return r;
			};

			var base64_decode_test = function(func) {
				if (func("dGVzdA==") === "test") {
					return true;
				}

				return false;
			};

			base64_decode = sanity_test(atob, base64_decode_correct, base64_decode_test, "atob");

			var base64_encode_test = function(func) {
				if (func("test") === "dGVzdA==") {
					return true;
				}

				return false;
			};

			var fake_base64_encode = function(s) {
				console_warn("Using fake base64 encoder");
				return s;
			};

			base64_encode = sanity_test(btoa, fake_base64_encode, base64_encode_test, "btoa");
		};
		get_compat_base64();

		var get_compat_array_indexof = function() {
			// https://www.mycomicshop.com/search?minyr=1938&maxyr=1955&TID=29170235
			// this site replaces Array.indexOf
			// cache Array.prototype.indexOf in case it changes while the script is executing
			var array_prototype_indexof = Array.prototype.indexOf;
			var array_indexof_orig = function(array, x) {
				return array_prototype_indexof.call(array, x);
			};

			var array_indexof_correct = function(array, x) {
				if (typeof array === "string") {
					// TODO: make sure Array.from is sane
					array = Array.from(array);
				}

				for (var i = 0; i < array.length; i++) {
					if (array[i] === x) {
						return i;
					}
				}

				return -1;
			};

			var array_indexof_check = function(func) {
				var test_array = ["a", "b"];
				var test_string = "abc";
				if (func(test_array, "not here") === -1 &&
					func(test_array, "b") === 1 &&
					func(test_string, "n") === -1 &&
					func(test_string, "b") === 1 &&
					func(test_string, "bc") === -1) {
					return true;
				}

				return false;
			};

			array_indexof = sanity_test(array_indexof_orig, array_indexof_correct, array_indexof_check);
		};
		get_compat_array_indexof();

		var get_compat_string_indexof = function() {
			var string_prototype_indexof = String.prototype.indexOf;
			var string_indexof_orig = function(string, x) {
				return string_prototype_indexof.call(string, x);
			};

			var string_indexof_correct = function(string, x) {
				if (x.length === 0)
					return 0;

				var x_i = 0;
				for (var i = 0; i < string.length; i++) {
					if (string_charat(string, i) === string_charat(x, x_i)) {
						if (x_i + 1 === x.length) {
							return i - x_i;
						} else {
							x_i++;
						}
					} else {
						x_i = 0;
					}
				}

				return -1;
			};

			var string_indexof_check = function(func) {
				var test_string = "abc";
				if (func(test_string, "n") === -1 &&
					func(test_string, "b") === 1 &&
					func(test_string, "bc") === 1 &&
					func(test_string, "bcz") === -1 &&
					func(test_string, "") === 0) {
					return true;
				}

				return false;
			};

			string_indexof = sanity_test(string_indexof_orig, string_indexof_correct, string_indexof_check);
		};
		get_compat_string_indexof();

		var get_compat_url = function() {
			if (is_node)
				return;

			var native_url_check = function(URL) {
				if (typeof URL !== "function" || typeof URL.prototype !== "object")
					return false;

				if (!("searchParams" in URL.prototype))
					return false;

				if (is_interactive) {
					if (!("createObjectURL" in URL) || !("revokeObjectURL" in URL))
						return false;
				}

				return true;
			};

			var orig_URL = URL || webkitURL;
			native_URL = sanity_test(orig_URL, nullfunc, native_url_check, "URL");
		};
		get_compat_url();

		var get_compat_blob = function() {
			if (is_node)
				return;

			var native_blob_check = function(Blob) {
				if (typeof Blob !== "function" || typeof Blob.prototype !== "object")
					return false;

				// doesn't seem to work under Firefox
				// it does exist after a while, but not while checking
				if (false && Blob.name !== "Blob")
					return false;

				if (/*!("arrayBuffer" in Blob.prototype) ||*/ // Not implemented in pale moon
					!("slice" in Blob.prototype) ||
					!("size" in Blob.prototype))
					return false;

				return true;
			};

			var fake_blob = function() {
				console_warn("This is a fake Blob object, you will almost certainly encounter problems.");
			};

			native_blob = sanity_test(Blob, fake_blob, native_blob_check, "Blob");
		};
		get_compat_blob();

		// this is rather slow (~25ms according to fireattack's profile)
		var native_functions = {};
		var get_native_functions = function(functions) {
			// thanks to tophf here: https://github.com/violentmonkey/violentmonkey/issues/944
			var iframe = document_createElement("iframe");
			iframe.srcdoc = ""; //"javascript:0"
			document.documentElement.appendChild(iframe);
			var frame_window = iframe.contentWindow;

			for (var i = 0; i < functions.length; i++) {
				var func = functions[i];
				native_functions[func] = frame_window[func];
			}

			iframe.parentElement.removeChild(iframe);
		};

		// FIXME: this doesn't work under pale moon: https://github.com/qsniyg/maxurl/issues/349
		if (native_functions_to_get.length > 0) {
			try {
				get_native_functions(native_functions_to_get);
			} catch (e) {
				console_error(e);
			}

			if ("Blob" in native_functions) {
				native_blob = native_functions.Blob;
			}

			if ("URL" in native_functions) {
				native_URL = native_functions.URL;
			}

			if ("atob" in native_functions) {
				base64_decode = native_functions.atob;
			}

			if ("btoa" in native_functions) {
				base64_encode = native_functions.btoa;
			}
		}
	};
	get_compat_functions();

	var array_extend = function(array, other) {
		[].push.apply(array, other);
	};

	var array_foreach = function(array, cb) {
		for (var i = 0; i < array.length; i++) {
			if (cb(array[i], i) === false)
				return;
		}
	};

	var array_or_null = function(array) {
		if (!array || !array.length)
			return null;

		return array;
	};

	var array_upush = function(array, item) {
		if (array_indexof(array, item) < 0)
			array.push(item);
	};

	var string_replaceall = function(str, find, replace) {
		// TODO: make faster
		return str.split(find).join(replace);
	};

	var match_all = function(str, regex) {
		var global_regex = new RegExp(regex, "g");

		var matches = str.match(global_regex);
		if (!matches)
			return null;

		var result = [];
		array_foreach(matches, function(match) {
			result.push(match.match(regex));
		});

		return result;
	};

	var obj_foreach = function(obj, cb) {
		for (var key in obj) {
			if (cb(key, obj[key]) === false)
				return;
		}
	};

	var common_functions = {};

	common_functions.nullfunc = function() {};

	common_functions.nullobjfunc = function() {
		var x = {
			func: function() {}
		};

		return x;
	};

	common_functions.run_arrayd_string = function(str, options) {
		str = str.split("");
		options.cb(str);
		return str.join("");
	};

	common_functions.new_vm = function() {
		// si[n] = nth stack item (last = 0)
		var vm_arch = [
			// 0: Push data to the stack
			function(vm) {
				vm.stack.unshift(vm.data);
			},
			// 1: Push arg to the stack
			function(vm) {
				vm.stack.unshift(vm.arg);
			},
			// 2: Pop si[0] .. si[arg]
			function(vm) {
				for (var i = 0; i < vm.arg; i++) {
					vm.stack.shift();
				}
			},
			// 3: Push si[arg] to si[0]
			function(vm) {
				vm.stack.unshift(vm.stack[vm.arg]);
			},
			// 4: Append si[1] to si[0]
			function(vm) {
				vm.stack[0].push(vm.stack[1]);
			},
			// 5: Prepend si[1] to si[0]
			function(vm) {
				vm.stack[0].unshift(vm.stack[1]);
			},
			// 6: Reverse si[0]
			function(vm) {
				vm.stack[0].reverse();
			},
			// 7: Swaps the values at si[1] and si[2] in si[0]
			function(vm) {
				var register = vm.stack[0][vm.stack[2]];
				vm.stack[0][vm.stack[2]] = vm.stack[0][vm.stack[1] % vm.stack[0].length];
				vm.stack[0][vm.stack[1] % vm.stack[0].length] = register;
			},
			// 8: Removes si[1] (id) from si[0]
			function(vm) {
				vm.stack[0].splice(vm.stack[1], 1);
			},
			// 9: Removes everything from the beginning of si[0] to si[1]
			function(vm) {
				vm.stack[0].splice(0, vm.stack[1]);
			},
			// 10: Removes everything from si[1] to the end of si[0]
			function(vm) {
				vm.stack[0].splice(vm.stack[1], vm.stack[0].length);
			},
			// 11: Adds si[2] to the value at si[1] in si[0]
			function(vm) {
				vm.stack[0][vm.stack[1]] += vm.stack[2];
			},
			// 12: Multiplies si[2] with the value at si[1] in si[0]
			function(vm) {
				vm.stack[0][vm.stack[1]] *= vm.stack[2];
			},
			// 13: Negates the value at si[1] in si[0]
			function(vm) {
				vm.stack[0][vm.stack[1]] *= -1;
			},
		];

		var _run_vm = function(ops, data) {
			var vm = {
				stack: [],
				data: data
			};

			for (var i = 0; i < ops.length; i += 2) {
				var inst = ops[i];
				var arg = ops[i + 1];

				vm.arg = arg;
				vm_arch[inst](vm);
			}

			return data;
		};

		var run_vm = function(ops, data) {
			if (typeof data === "string") {
				return common_functions.run_arrayd_string(data, {
					cb: function(data) {
						return _run_vm(ops, data);
					}
				});
			} else {
				return _run_vm(ops, data);
			}
		};

		return {
			arch: vm_arch,
			op_start: 4, // first 4 are push/pop
			total_instrs: Object.keys(vm_arch).length,
			run: run_vm
		};
	};

	common_functions.create_vm_ops = function(instructions) {
		var ops = [];

		// initialize stack
		for (var i = 0; i < 3; i++) {
			ops.push(1, 0);
		}

		array_foreach(instructions, function(inst) {
			var opcode = inst[0];

			// push arguments
			for (var i = 1; i < inst.length; i++) {
				ops.push(1, inst[i]);
			}
			var args_count = inst.length - 1;

			ops.push(
				// push data
				0, null,

				// run operation
				opcode, null,

				// pop data+args
				2, 1 + args_count
			);
		});

		// cleanup
		ops.push(2, 3);

		return ops;
	};

	// ublock blocks accessing Math on sites like gfycat
	var Math_floor, Math_round, Math_random, Math_max, Math_min, Math_abs;
	var get_compat_math = function() {
		if (is_node)
			return;

		try {
			Math_floor = Math.floor;
			Math_round = Math.round;
			Math_random = Math.random;
			Math_max = Math.max;
			Math_min = Math.min;
			Math_abs = Math.abs;
		} catch (e) {
			Math_floor = function(x) {
				return x || 0;
			};

			Math_round = function(x) {
				return Math_floor(x + 0.5);
			};

			var math_seed = Date.now();
			var math_vm = null;
			Math_random = function() {
				if (!math_vm) {
					math_vm = common_functions.new_vm();
				}

				if (math_vm) {
					var total_instrs = math_vm.total_instrs - math_vm.op_start;
					var bad_instrs = [8, 9, 10, 13];

					var instructions = [];

					var times = math_seed & 0xf;
					if (!times)
						times = 4;
					for (var i = 0; i < times; i++) {
						var instr = (((math_seed >> 4) & 0xf) + ((math_seed >> (i%8)) & 0xf)) % total_instrs + math_vm.op_start;

						if (array_indexof(bad_instrs, instr) >= 0) {
							times++;
							continue;
						}

						instructions.push([
							instr,

							(math_seed & 0xff) + i,
							((math_seed & 0xf) + i) % 5
						]);
					}

					var ops = common_functions.create_vm_ops(instructions);

					try {
						var new_math_seed = parseFloat(math_vm.run(ops, math_seed + ""));

						if (!isNaN(new_math_seed))
							math_seed += new_math_seed;
					} catch (e) {
						//console_warn(e);
					}
				}

				math_seed += Date.now();
				math_seed %= 1e8;
				return math_seed / 1e8;
			};

			Math_max = function() {
				var max = -Infinity;

				for (var i = 0; i < arguments.length; i++) {
					if (arguments[i] > max)
						max = arguments[i];
				}

				return max;
			};

			Math_min = function() {
				var min = Infinity;

				for (var i = 0; i < arguments.length; i++) {
					if (arguments[i] < min)
						min = arguments[i];
				}

				return min;
			};

			Math_abs = function(x) {
				if (x < 0)
					return -x;

				return x;
			};
		}
	};
	get_compat_math();

	var get_random_text = function(length) {
		var text = "";

		while (text.length < length) {
			var newtext = Math_floor(Math_random() * 10e8).toString(26);
			text += newtext;
		}

		text = text.substr(0, length);
		return text;
	};

	var get_random_id = function() {
		return get_random_text(10) + Date.now();
	};

	var id_to_iframe = {};

	// todo: move to do_mouseover
	var get_frame_info = function() {
		return {
			id: current_frame_id,
			//url: window.location.href, // doesn't get updated for the iframe src's attribute?
			url: current_frame_url,
			size: [
				document.documentElement.scrollWidth,
				document.documentElement.scrollHeight
			]
		};
	};

	// todo: move to do_mouseover
	var find_iframe_for_info = function(info) {
		if (info.id in id_to_iframe)
			return id_to_iframe[info.id];

		var finish = function(iframe) {
			if (!iframe)
				return iframe;

			id_to_iframe[info.id] = iframe;
			return iframe;
		}

		var iframes = document.getElementsByTagName("iframe");
		var newiframes = [];
		for (var i = 0; i < iframes.length; i++) {
			if (iframes[i].src !== info.url)
				continue;

			newiframes.push(iframes[i]);
		}

		if (newiframes.length <= 1)
			return finish(newiframes[0]);

		iframes = newiframes;
		newiframes = [];
		for (var i = 0; i < iframes.length; i++) {
			if (iframes[i].scrollWidth !== info.size[0] ||
				iframes[i].scrollHeight !== info.size[1]) {
				continue;
			}

			newiframes.push(iframes[i]);
		}

		if (newiframes.length <= 1)
			return finish(newiframes[0]);

		// TODO: check cursor too
		return null;
	};

	var iframe_to_id = function(iframe) {
		for (var id in id_to_iframe) {
			if (id_to_iframe[id] === iframe)
				return id;
		}

		return null;
	};

	var id_to_iframe_window = function(id) {
		if (!(id in id_to_iframe))
			return null;

		// no need for contentWindow in top
		if (id !== "top") {
			try {
				if (id_to_iframe[id].contentWindow)
					return id_to_iframe[id].contentWindow;
			} catch (e) {
				// not allowed
				return false;
			}
		}

		return id_to_iframe[id];
	};

	var remote_send_message = null;
	var remote_send_reply = null;
	var remote_reply_ids = {};
	var current_frame_id = null;
	var current_frame_url = null;

	var raw_remote_send_message = null;
	var remote_send_message = common_functions.nullfunc;
	var remote_send_reply = common_functions.nullfunc;
	var imu_message_key = "__IMU_MESSAGE__";

	if (is_extension) {
		raw_remote_send_message = function(to, message) {
			extension_send_message(message)
		};

		is_remote_possible = true;
	} else if (is_interactive) {
		if (is_in_iframe && window.parent) {
			id_to_iframe["top"] = window.parent;
		}

		raw_remote_send_message = function(to, message) {
			if (!to && is_in_iframe)
				to = "top"; // fixme?

			var specified_window;
			if (to && to in id_to_iframe) {
				specified_window = id_to_iframe_window(to);
				if (!specified_window) {
					if (_nir_debug_) {
						console_warn("Unable to find window for", to, {is_in_iframe: is_in_iframe, id_to_iframe: id_to_iframe});
					}
					// not allowed
					return;
				}
			}

			message.imu = true;

			var wrapped_message = {};
			wrapped_message[imu_message_key] = message;

			if (!specified_window) {
				for (var i = 0; i < window.frames.length; i++) {
					try {
						window.frames[i].postMessage(wrapped_message, "*");
					} catch (e) {
						if (_nir_debug_) {
							console_warn("Unable to send message to", window.frames[i], e);
						}
						// not allowed
						continue;
					}
				}
			} else {
				specified_window.postMessage(wrapped_message, "*");
			}
		};

		is_remote_possible = true;

		if (window.location.hostname === "cafe.daum.net") {
			// unfortunately they interpret all message events, leading to bugs in their website. thanks to ambler on discord for noticing
			is_remote_possible = false;
		}
	}

	if (is_remote_possible) {
		current_frame_url = window.location.href;
		current_frame_id = get_random_id() + " " + current_frame_url;

		if (!is_in_iframe)
			current_frame_id = "top";

		remote_send_message = function(to, data, cb) {
			var id = undefined;

			if (cb) {
				id = get_random_id();
				remote_reply_ids[id] = cb;
			}

			var message = {
				type: "remote",
				data: data,
				to: to,
				from: current_frame_id,
				response_id: id
			};

			if (_nir_debug_) {
				console_log("remote_send_message", to, message);
			}

			//console_log("remote", data);
			raw_remote_send_message(to, message);
		};

		remote_send_reply = function(to, response_id, data) {
			raw_remote_send_message(to, {
				type: "remote_reply",
				data: data,
				response_id: response_id
			});
		};
	}

	var can_use_remote = function() {
		return is_remote_possible && settings.allow_remote;
	};

	var can_iframe_popout = function() {
		return can_use_remote() && settings.mouseover_use_remote;
	};

	var do_request_browser = function (request) {
		if (_nir_debug_) {
			console_log("do_request_browser", request);
		}

		var method = request.method || "GET";

		var xhr = new XMLHttpRequest();
		xhr.open(method, request.url, true);

		if (request.responseType)
			xhr.responseType = request.responseType;

		var do_final = function(override, cb) {
			if (_nir_debug_) {
				console_log("do_request_browser's do_final", xhr, cb);
			}

			var resp = {
				readyState: xhr.readyState,
				finalUrl: xhr.responseURL,
				responseHeaders: xhr.getAllResponseHeaders(),
				responseType: xhr.responseType,
				status: xhr.status, // file:// returns 0, tracking protection also returns 0
				statusText: xhr.statusText,
				timeout: xhr.timeout
			};

			resp.response = xhr.response;

			try {
				resp.responseText = xhr.responseText;
			} catch (e) {}

			cb(resp);
		};

		var add_handler = function(event, empty) {
			xhr[event] = function() {
				if (empty) {
					return request[event](null);
				}

				do_final({}, function(resp) {
					request[event](resp);
				});
			};
		};

		add_handler("onload");
		add_handler("onerror");
		add_handler("onprogress");
		add_handler("onabort", true);
		add_handler("ontimeout", true);

		xhr.send(request.data);

		return {
			abort: function() {
				xhr.abort();
			}
		};
	};

	try {
		if (typeof XMLHttpRequest !== "function") {
			do_request_browser = null;
		}
	} catch (e) {
		// adblock on jizzbunker.com, sends an exception with a random magic string if XMLHttpRequest is accessed
		do_request_browser = null;
	}

	var extension_requests = {};

	var do_request_raw = null;
	if (is_extension) {
		do_request_raw = function(data) {
			var reqid;
			var do_abort = false;

			extension_send_message({
				type: "request",
				data: data
			}, function (response) {
				if (response.type !== "id") {
					console_error("Internal error: Wrong response", response);
					return;
				}

				reqid = response.data;

				extension_requests[reqid] = {
					id: reqid,
					data: data
				};

				if (do_abort) {
					extension_send_message({
						type: "abort_request",
						data: reqid
					});

					return;
				}
			});

			return {
				abort: function() {
					if (reqid === undefined) {
						console_warn("abort() was called before the request was initialized");
						do_abort = true;
						return;
					}

					extension_send_message({
						type: "abort_request",
						data: reqid
					});
				}
			};
		};
	} else if (typeof(GM_xmlhttpRequest) !== "undefined") {
		do_request_raw = GM_xmlhttpRequest;
	} else if (typeof(GM) !== "undefined" && typeof(GM.xmlHttpRequest) !== "undefined") {
		do_request_raw = GM.xmlHttpRequest;
	}

	var register_menucommand = common_functions.nullfunc;
	var unregister_menucommand = common_functions.nullfunc;
	var num_menucommands = 0;

	if (is_userscript) {
		if (typeof(GM_registerMenuCommand) !== "undefined") {
			register_menucommand = function(name, func) {
				num_menucommands++;

				var caption = "[" + num_menucommands + "] " + name;
				var id = GM_registerMenuCommand(caption, func);

				if (id === undefined || id === null)
					id = caption;
				return id;
			};
		}

		if (typeof(GM_unregisterMenuCommand) !== "undefined") {
			unregister_menucommand = function(id) {
				num_menucommands--;

				return GM_unregisterMenuCommand(id);
			};
		}
	}

	var open_in_tab = common_functions.nullfunc;

	if (is_userscript) {
		if (typeof(GM_openInTab) !== "undefined") {
			open_in_tab = GM_openInTab;
		} else if (typeof(GM) !== "undefined" && typeof(GM.openInTab) !== "undefined") {
			open_in_tab = GM.openInTab;
		}

		if (open_in_tab !== common_functions.nullfunc) {
			register_menucommand("Options", function() {
				// this gets run for every frame the script is injected in
				if (is_in_iframe)
					return;

				open_in_tab(options_page);
			});
		}
	}

	var open_in_tab_imu = function(imu, bg, cb) {
		if (is_extension) {
			extension_send_message({
				type: "newtab",
				data: {
					imu: imu,
					background: bg
				}
			}, cb);
		} else if (is_userscript && open_in_tab) {
			open_in_tab(imu.url, bg);
			if (cb) {
				cb();
			}
		}
	};

	var check_tracking_blocked = function(result) {
		// FireMonkey returns null for result if blocked
		// GreaseMonkey returns null for status if blocked
		if (!result || result.status === 0 || result.status === null) {
			if (result && result.finalUrl && /^file:\/\//.test(result.finalUrl))
				return false;

			return true;
		}
		return false;
	};

	var do_request = null;
	if (do_request_raw) {
		do_request = function(data) {
			if (_nir_debug_) {
				console_log("do_request", deepcopy(data));
			}

			// For cross-origin cookies
			if (!("withCredentials" in data)) {
				data.withCredentials = true;
			}

			if (!("headers" in data)) {
				data.headers = {};
			}

			if (data.imu_mode) {
				var headers_to_set = {};

				if (data.imu_mode === "document") {
					headers_to_set.accept = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9";
					headers_to_set["Sec-Fetch-Dest"] = "document";
					headers_to_set["Sec-Fetch-Mode"] = "navigate";
					headers_to_set["Sec-Fetch-Site"] = "none";
					headers_to_set["Sec-Fetch-User"] = "?1";
				} else if (data.imu_mode === "xhr") {
					headers_to_set.accept = "*/*";
					headers_to_set["Sec-Fetch-Dest"] = "empty";
					headers_to_set["Sec-Fetch-Mode"] = "cors";
					headers_to_set["Sec-Fetch-Site"] = "same-origin";

					headers_to_set.origin = data.url.replace(/^([a-z]+:\/\/[^/]+)(?:\/+.*)?$/, "$1");
				} else if (data.imu_mode === "image") {
					headers_to_set.accept = "image/webp,image/apng,image/*,*/*;q=0.8";
					headers_to_set["Sec-Fetch-Dest"] = "image";
					headers_to_set["Sec-Fetch-Mode"] = "no-cors";
					headers_to_set["Sec-Fetch-Site"] = "same-site";
				}

				delete data.imu_mode;

				for (var header in headers_to_set) {
					if (headerobj_get(data.headers, header) === undefined) {
						headerobj_set(data.headers, header, headers_to_set[header]);
					}
				}
			}

			if (data.imu_multipart) {
				//var boundary = "-----------------------------" + get_random_text(20);
				var boundary = "----WebKitFormBoundary" + get_random_text(16);

				// TODO: fix? only tested for one key
				var postdata = "";
				for (var key in data.imu_multipart) {
					var value = data.imu_multipart[key];

					postdata += "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + key + "\"\r\n\r\n";
					postdata += value + "\r\n";
				}

				postdata += "--" + boundary + "--\r\n";

				headerobj_set(data.headers, "Content-Type", "multipart/form-data; boundary=" + boundary);
				data.data = postdata;

				delete data.imu_multipart;
			}

			var orig_data = deepcopy(data);

			if (!data.onerror)
				data.onerror = data.onload;

			var raw_request_do = do_request_raw;
			if (is_userscript && settings.allow_browser_request) {
				if (userscript_manager === "Falkon GreaseMonkey" ||
					// USI doesn't properly support blob responses: https://bitbucket.org/usi-dev/usi/issues/13/various-problems-with-gm_xmlhttprequest
					(userscript_manager === "USI" && data.need_blob_response)) {
					raw_request_do = do_request_browser;
					delete data.trackingprotection_failsafe;
				}
			}

			if (data.retry_503) {
				if (data.retry_503 === true || typeof data.retry_503 !== "number")
					data.retry_503 = parseInt(settings.retry_503_times) || 0;

				if (data.retry_503 > 0) {
					var real_onload_503 = data.onload;
					var real_onerror_503 = data.onerror;

					var finalcb_503 = function(resp, iserror) {
						if (_nir_debug_) {
							console_log("do_request's finalcb_503:", resp, iserror, deepcopy(data));
						}

						if (resp.status === 503) {
							console_warn("Received status 503, retrying request", resp, orig_data);
							orig_data.retry_503 = data.retry_503 - 1;

							setTimeout(function() {
								do_request(orig_data);
							}, parseInt(settings.retry_503_ms) || 1);
						} else {
							if (iserror) {
								real_onerror_503(resp);
							} else {
								real_onload_503(resp);
							}
						}
					};

					data.onload = function(resp) {
						finalcb_503(resp, false);
					};

					data.onerror = function(resp) {
						finalcb_503(resp, true);
					};
				}
			}

			if (data.trackingprotection_failsafe && settings.allow_browser_request && do_request_browser) {
				var real_onload = data.onload;
				var real_onerror = data.onerror;

				var finalcb = function(resp, iserror) {
					if (_nir_debug_) {
						console_log("do_request's finalcb:", resp, iserror);
					}

					if (check_tracking_blocked(resp)) {
						// Workaround for a bug in FireMonkey where it calls both onload and onerror: https://github.com/erosman/support/issues/134
						data.onload = null;
						data.onerror = null;

						var newdata = shallowcopy(data);
						newdata.onload = real_onload;
						newdata.onerror = real_onerror;

						if (newdata.imu_responseType === "blob") {
							newdata.responseType = "blob";
						}

						return do_request_browser(newdata);
					} else {
						if (iserror) {
							real_onerror(resp);
						} else {
							real_onload(resp);
						}
					}
				};

				data.onload = function(resp) {
					finalcb(resp, false);
				};

				data.onerror = function(resp) {
					finalcb(resp, true);
				};
			}

			if (data.responseType === "blob" && !settings.use_blob_over_arraybuffer) {
				(function(real_onload) {
					data.onload = function(resp) {
						var newresp = resp;

						if (resp.response) {
							var mime = null;
							// hack for extension for performance
							if (is_extension && "_responseEncoded" in resp && resp._responseEncoded.type) {
								mime = resp._responseEncoded.type
							} else if (resp.responseHeaders) {
								var parsed_headers = headers_list_to_dict(parse_headers(resp.responseHeaders));
								if (parsed_headers["content-type"]) {
									mime = parsed_headers["content-type"];
								}
							}

							newresp = shallowcopy(resp);
							var blob_options = undefined;
							if (mime) {
								blob_options = {type: mime};
							}

							newresp.response = new native_blob([resp.response], blob_options);
						}

						if (_nir_debug_) {
							console_log("do_request's arraybuffer->blob:", deepcopy(resp), newresp);
						}

						real_onload(newresp);
					};
				})(data.onload);

				data.responseType = "arraybuffer";
				data.imu_responseType = "blob";
			}

			if (_nir_debug_) {
				console_log("do_request (modified data):", deepcopy(data));
			}

			return raw_request_do(data);
		};
	} else if (is_interactive) {
		console.warn("Unable to initialize do_request, most functions will likely fail");
	}

	var get_cookies = null;
	if (is_extension) {
		get_cookies = function(url, cb) {
			if (settings.browser_cookies === false) {
				return cb(null);
			}

			extension_send_message({
				type: "getcookies",
				data: {url: url}
			}, function(message) {
				cb(message.data);
			});
		};
	}

	var cookies_to_httpheader = function(cookies) {
		// deduplication apparently isn't necessary (browser duplicates them too)

		var strs = [];
		for (var i = 0; i < cookies.length; i++) {
			var str = cookies[i].name + "=" + cookies[i].value;
			strs.push(str);
		}

		return strs.join("; ");
	};

	var bigimage_filter = function() {
		return true;
	};

	if (is_interactive) {
		bigimage_filter = function(url) {
			for (var i = 0; i < blacklist_regexes.length; i++) {
				if (blacklist_regexes[i].test(url))
					return false;
			}

			return true;
		}
	}

	var default_options = {
		fill_object: true,
		null_if_no_change: false,
		catch_errors: true,
		use_cache: true,
		use_api_cache: true,
		urlcache_time: 60*60,
		iterations: 200,
		exclude_problems: [
			"watermark",
			"smaller",
			"possibly_different",
			"possibly_broken"
		],
		exclude_videos: false,
		include_pastobjs: true,
		force_page: false,
		allow_thirdparty: false,
		allow_thirdparty_libs: true,
		allow_thirdparty_code: false,
		process_format: {},
		filter: bigimage_filter,

		rule_specific: {
			deviantart_prefer_size: false,
			deviantart_support_download: true,
			imgur_source: true,
			imgur_nsfw_headers: null,
			instagram_use_app_api: true,
			instagram_dont_use_web: false,
			instagram_gallery_postlink: false,
			snapchat_orig_media: true,
			tiktok_no_watermarks: false,
			tiktok_thirdparty: null,
			tumblr_api_key: null,
			linked_image: false,
		},

		do_request: do_request,
		get_cookies: get_cookies,
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
		need_blob: false,
		need_data_url: false,
		waiting: false,
		redirects: false,
		forces_download: false,
		is_private: false,
		is_pagelink: false,
		is_original: false,
		norecurse: false,
		forcerecurse: false,
		can_cache: true,
		bad: false,
		bad_if: [],
		fake: false,
		video: false,
		album_info: null,
		headers: {},
		referer_ok: {
			same_domain: false,
			same_domain_nosub: false
		},
		extra: {
			page: null,
			caption: null
		},
		filename: "",
		problems: {
			watermark: false,
			smaller: false,
			possibly_different: false,
			possibly_broken: false,
			possibly_upscaled: false,
			bruteforce: false
		}
	};

	function is_element(x) {
		if (!x || typeof x !== "object")
			return false;

		if (("namespaceURI" in x) && ("nodeType" in x) && ("nodeName" in x) && ("childNodes" in x)) {
			return true;
		}

		// window
		if (typeof x.HTMLElement === "function" && typeof x.navigator === "object") {
			return true;
		}

		// very slow
		if (is_interactive) {
			if ((x instanceof Node) ||
				(x instanceof Element) ||
				(x instanceof HTMLDocument) ||
				(x instanceof Window)) {
				return true;
			}
		}

		return false;
	}

	function is_iterable_object(x) {
		return typeof x === "object" && x !== null && !is_array(x) && !is_element(x);
	}

	var shallowcopy_obj = function(x) {
		result = {};

		for (var key in x) {
			result[key] = x[key];
		}
		return result;
	};

	if ("assign" in Object) {
		// FIXME: should this be kept? it's faster, but it causes issues with object instances, like dom rects. it works fine with plain objects though
		// it's about as good as JSON.parse(JSON.stringify(x)), but shallow
		shallowcopy_obj = function(x) {
			return Object.assign({}, x);
		};
	}

	function shallowcopy(x) {
		var result = x;

		if (!is_iterable_object(x)) {
			return result;
		} else if (is_array(x)) {
			result = [];
			for (var i = 0; i < x.length; i++) {
				var item = x[i];
				result.push(item);
			}
			return result;
		} else if (typeof x === "object") {
			return shallowcopy_obj(x);
		}

		return result;
	}

	function deepcopy(x, options) {
		if (!options)
			options = {};
		if (!options.history)
			options.history = [];

		var result;

		if (typeof x === "string" || x === null || typeof x === "undefined") {
			return x;
		} else if (is_element(x) || x instanceof RegExp) {
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
		} else if (typeof x === "object") {
			if (array_indexof(options.history, x) >= 0)
				return;
			else
				options.history.push(x);

			if (is_array(x)) {
				result = [];
				for (var i = 0; i < x.length; i++) {
					var item = x[i];
					result.push(deepcopy(item, options));
				}
			} else {
				result = {};
				for (var key in x) {
					try {
						result[key] = deepcopy(x[key], options);
					} catch (e) {
						result[key] = x[key];
					}
				}
			}

			return result;
		} else {
			return x;
		}
	}

	var serialize_event = function(event) {
		return deepcopy(event, {json: true});
	};

	var get_nonsensitive_settings = function() {
		var new_settings = JSON_parse(JSON_stringify(settings));

		for (var i = 0; i < sensitive_settings.length; i++) {
			delete new_settings[sensitive_settings[i]];
		}

		return new_settings;
	};

	// Note: None of this information is automatically sent anywhere, it's only displayed to the user when something crashes.
	var get_crashlog_info = function() {
		var ua = "";
		try {ua = window.navigator.userAgent;} catch (e) {}

		var imu_version = "(!!!UNKNOWN, PLEASE FILL IN!!!)\n";
		try {imu_version = gm_info.script.version;} catch (e) {}

		var our_settings_text = "(unable to find)";
		try {our_settings_text = JSON_stringify(get_nonsensitive_settings());} catch (e) {}

		var keys = [
			"User agent: " + ua,
			"Is userscript: " + is_userscript,
			"Is addon: " + is_extension,
			"Image Max URL version: " + imu_version,
			"Settings: " + our_settings_text
		];

		if (is_userscript) {
			try {
				keys.push("Userscript manager: " + userscript_manager);
				keys.push("Userscript manager version: " + userscript_manager_version);
			} catch (e) {}
		}

		return keys.join("\n");
	};

	function overlay_object(base, obj) {
		if (typeof base === "function" || is_array(base))
			return obj; // FIXME?

		if (typeof base === "object") {
			if (typeof obj !== "object")
				return obj;

			for (var key in obj) {
				if (key in base) {
					base[key] = overlay_object(base[key], obj[key]);
				} else {
					base[key] = obj[key];
				}
			}

			return base;
		}

		return obj;
	}

	var parse_boolean = function(bool) {
		if (bool === "true" || bool === true || bool === 1)
			return true;

		if (bool === "false" || bool === false || bool === 0)
			return false;

		return;
	};

	// https://stackoverflow.com/a/25603630
	function get_language() {
		if (typeof navigator === "undefined")
			return "en";

		if (navigator.languages)
			return navigator.languages[0];

		return navigator.language || navigator.userLanguage;
	}

	var supported_languages = [
		"en",
		"es",
		"fr",
		"ko"
	];

	var browser_language = "en";
	try {
		browser_language = get_language().toLowerCase();
		if (array_indexof(supported_languages, browser_language) < 0) {
			browser_language = browser_language.replace(/-.*/, "");
			if (array_indexof(supported_languages, browser_language) < 0)
				browser_language = "en";
		}
	} catch (e) {
		console_error(e);

		// just in case
		if (array_indexof(supported_languages, browser_language) < 0)
			browser_language = "en";
	}

	// This section is automatically generated using tools/update_from_po.js.
	// To modify translations, edit the respective .po file under the po subdirectory.
	// Refer to the Translations section in CONTRIBUTING.md for more information.
	var strings = {
		"options_header": {
			"en": "Options",
			"es": "Opciones",
			"ko": "\uC635\uC158"
		},
		"yes": {
			"en": "Yes",
			"es": "S\u00ED",
			"fr": "Oui",
			"ko": "\uC608"
		},
		"no": {
			"en": "No",
			"es": "No",
			"fr": "Non",
			"ko": "\uC544\uB2C8\uC624"
		},
		"Import": {
			"ko": "\uAC00\uC838\uC624\uAE30"
		},
		"Export": {
			"ko": "\uB0B4\uBCF4\uB0B4\uAE30"
		},
		"Requires:": {
			"ko": "\uC694\uAD6C\uC0AC\uD56D:"
		},
		"category_redirection": {
			"en": "Redirection",
			"es": "Redirecci\u00F3n",
			"ko": "\uB9AC\uB514\uB809\uC158"
		},
		"category_popup": {
			"en": "Popup",
			"es": "Popup",
			"ko": "\uD31D\uC5C5"
		},
		"subcategory_settings": {
			"en": "Settings",
			"es": "Ajustes"
		},
		"subcategory_ui": {
			"en": "UI",
			"es": "Interfaz"
		},
		"subcategory_trigger": {
			"en": "Trigger",
			"es": "Acciones del popup",
			"fr": "D\u00E9clencheur",
			"ko": "\uD2B8\uB9AC\uAC70"
		},
		"subcategory_open_behavior": {
			"en": "Open Behavior",
			"es": "Comportamiento al Abrir",
			"ko": "\uC5F4\uAE30 \uB3D9\uC791"
		},
		"subcategory_close_behavior": {
			"en": "Close Behavior",
			"es": "Comportamiento al Cerrar",
			"ko": "\uB2EB\uAE30 \uB3D9\uC791"
		},
		"subcategory_behavior": {
			"en": "Popup Behavior",
			"es": "Comportamiento del Popup"
		},
		"subcategory_video": {
			"en": "Video",
			"es": "Video",
			"ko": "\uC601\uC0C1"
		},
		"subcategory_gallery": {
			"en": "Gallery",
			"es": "Galeria"
		},
		"subcategory_popup_other": {
			"en": "Other",
			"es": "Otro",
			"fr": "Autre"
		},
		"subcategory_cache": {
			"en": "Cache"
		},
		"Mouse cursor": {
			"ko": "\uB9C8\uC6B0\uC2A4 \uCEE4\uC11C"
		},
		"category_rules": {
			"en": "Rules",
			"fr": "R\u00E8gles",
			"ko": "\uADDC\uCE59"
		},
		"subcategory_rule_specific": {
			"en": "Rule-specific"
		},
		"category_website": {
			"en": "Website",
			"fr": "Site",
			"ko": "\uC6F9\uC0AC\uC774\uD2B8"
		},
		"saved_refresh_target": {
			"en": "Saved! Refresh the target page for changes to take effect",
			"fr": "Enregistr\u00E9! Actualiser la page que vous visitez pour que les changements prennent effet",
			"ko": "\uC800\uC7A5\uB429\uB2C8\uB2E4. \uBC88\uACBD\uC0AC\uD56D \uC801\uC6A9\uD558\uB824\uBA74 \uB300\uC0C1 \uC6F9\uD398\uC774\uC9C0 \uB2E4\uC2DC \uB85C\uB4DC\uD558\uC2ED\uC2DC\uC624"
		},
		"saved_no_refresh": {
			"en": "Saved!",
			"fr": "Enregistr\u00E9!",
			"ko": "\uC800\uC7A5\uB429\uB2C8\uB2E4"
		},
		"save": {
			"en": "Save",
			"fr": "Enregistrer",
			"ko": "\uC800\uC7A5"
		},
		"record": {
			"en": "Record"
		},
		"cancel": {
			"en": "Cancel",
			"fr": "Annuler",
			"ko": "\uCDE8\uC18C"
		},
		"Mouseover popup (%%1) is needed to display the original version": {
			"fr": "Popup (%%1) est n\u00E9cessaire pour trouver la version originale",
			"ko": "\uC6D0\uBCF8 \uC774\uBBF8\uC9C0 \uBCF4\uB824\uBA74 \uD31D\uC5C5 (%%1) \uD544\uC694\uD569\uB2C8\uB2E4"
		},
		"custom headers": {
			"fr": "en-t\u00EAtes sp\u00E9ciales",
			"ko": "\uD2B9\uC815 \uD5E4\uB354"
		},
		"forces download": {
			"en": "forces download"
		},
		"Close": {
			"fr": "Fermer",
			"ko": "\uB2EB\uAE30"
		},
		"Previous": {
			"fr": "Image pr\u00E9c\u00E9dente",
			"ko": "\uC774\uC804"
		},
		"Next": {
			"fr": "Image suivante",
			"ko": "\uB2E4\uC74C"
		},
		"Left Arrow": {
			"fr": "Fl\u00E8che gauche",
			"ko": "\uC67C\uCABD \uD654\uC0B4\uD45C"
		},
		"Right Arrow": {
			"fr": "Fl\u00E8che droite",
			"ko": "\uC624\uB978\uCABD \uD654\uC0B4\uD45C"
		},
		"category_extension": {
			"en": "Extension"
		},
		"rotate_left_btn": {
			"en": "Rotate Left"
		},
		"rotate_right_btn": {
			"en": "Rotate Right"
		},
		"category_extra": {
			"en": "Buttons"
		},
		"subcategory_replaceimages": {
			"en": "Replace Images"
		},
		"subcategory_highlightimages": {
			"en": "Highlight Images"
		},
		"category_general": {
			"en": "General",
			"es": "General",
			"ko": "\uC77C\uBC18"
		},
		"Language": {
			"es": "Lenguaje",
			"ko": "\uC5B8\uC5B4"
		},
		"Dark mode": {
			"ko": "\uB2E4\uD06C \uBAA8\uB4DC"
		},
		"Changes the colors to have light text on a dark background": {
			"ko": "\uC5B4\uB450\uC6B4 \uBC30\uACBD, \uBC1D\uC740 \uD14D\uC2A4\uD2B8\uAC00 \uD45C\uC2DC\uB418\uB3C4\uB85D \uBCC0\uACBD\uD569\uB2C8\uB2E4."
		},
		"Description below options": {
			"ko": "\uC635\uC158 \uC544\uB798\uC5D0 \uC124\uBA85 \uD45C\uC2DC"
		},
		"Shows the description below the options (otherwise the description is only shown when you hover over the option's name)": {
			"ko": "\uC635\uC158 \uC544\uB798\uC5D0 \uC124\uBA85 \uD45C\uC2DC (\uBE44\uD65C\uC131\uD654 \uC2DC, \uC635\uC158 \uC774\uB984 \uC704\uC5D0 \uB9C8\uC6B0\uC2A4\uB97C \uC62C\uB824 \uB193\uC744 \uB54C\uB9CC \uC124\uBA85\uC774 \uD45C\uC2DC\uB428)"
		},
		"Show disabled options": {
			"ko": "\uBE44\uD65C\uC131\uD654\uB41C \uC124\uC815 \uD45C\uC2DC"
		},
		"Requirements below disabled options": {
			"ko": "\uBE44\uD65C\uC131\uD654\uB41C \uC635\uC158 \uC544\uB798\uC758 \uC694\uAD6C \uC0AC\uD56D"
		},
		"If an option is disabled, the requirements to enable the option will be displayed below it": {
			"ko": "\uC635\uC158\uC774 \uBE44\uD65C\uC131\uD654\uB418\uBA74 \uC635\uC158\uC744 \uD65C\uC131\uD654\uD558\uAE30 \uC704\uD55C \uC694\uAD6C \uC0AC\uD56D\uC774 \uC544\uB798\uC5D0 \uD45C\uC2DC\uB428"
		},
		"Check for updates": {
			"ko": "\uC5C5\uB370\uC774\uD2B8 \uD655\uC778"
		},
		"Update check interval": {
			"ko": "\uC5C5\uB370\uC774\uD2B8 \uD655\uC778 \uAC04\uACA9"
		},
		"How often to check for updates": {
			"ko": "\uC5C5\uB370\uC774\uD2B8 \uD655\uC778 \uBE48\uB3C4"
		},
		"hours": {
			"ko": "\uC2DC\uAC04"
		},
		"Notify when update is available": {
			"ko": "\uC5C5\uB370\uC774\uD2B8\uAC00 \uC788\uC744 \uB54C \uC54C\uB9BC"
		},
		"Creates a browser notification when an update is available": {
			"ko": "\uC5C5\uB370\uC774\uD2B8\uAC00 \uC788\uC744 \uB54C \uBE0C\uB77C\uC6B0\uC800 \uC54C\uB9BC\uC744 \uBC1B\uC2B5\uB2C8\uB2E4."
		},
		"Show advanced settings": {
			"ko": "\uACE0\uAE09 \uC124\uC815 \uD45C\uC2DC"
		},
		"If disabled, settings that might be harder to understand will be hidden": {
			"ko": "\uBE44\uD65C\uC131\uD654 \uC2DC, \uC774\uD574\uD558\uAE30 \uC5B4\uB824\uC6B8 \uC218 \uC788\uB294 \uC124\uC815\uC774 \uC228\uACA8\uC9D0"
		},
		"Use tabs": {
			"ko": "\uD0ED \uC0AC\uC6A9"
		},
		"If disabled, all settings will be shown on a single page": {
			"ko": "\uBE44\uD65C\uC131\uD654 \uC2DC, \uBAA8\uB4E0 \uC124\uC815\uC774 \uD55C \uD398\uC774\uC9C0\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4."
		},
		"Enable redirection": {
			"es": "Habilitar redirecci\u00F3n",
			"fr": "Activer la redirection",
			"ko": "\uB9AC\uB514\uB809\uC158 \uC0AC\uC6A9"
		},
		"Redirect images opened in their own tab": {
			"ko": "\uC790\uC2E0\uC758 \uD0ED\uC5D0\uC11C \uC5F4\uB9B0 \uC774\uBBF8\uC9C0 \uB9AC\uB514\uB809\uC158"
		},
		"Add to history": {
			"es": "Agregar al historial",
			"fr": "Ajouter \u00E0 l'historique",
			"ko": "\uBE0C\uB77C\uC6B0\uC800 \uAE30\uB85D\uC5D0 \uCD94\uAC00"
		},
		"Redirection will add a new entry to the browser's history": {
			"ko": "\uB9AC\uB514\uB809\uC158 \uC2DC, \uBE0C\uB77C\uC6B0\uC800\uC758 \uAE30\uB85D\uC5D0 \uC0C8 \uD56D\uBAA9\uC774 \uCD94\uAC00\uB428"
		},
		"Use GET if HEAD is unsupported": {
			"es": "Utilizar GET si HEAD no es soportado",
			"fr": "Utiliser GET si HEAD n'est pas support\u00E9",
			"ko": "HEAD \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uC73C\uBA74 GET \uC0AC\uC6A9"
		},
		"Try finding original page/caption": {
			"es": "Intentar de encontrar la p\u00E1gina original/t\u00EDtulo",
			"fr": "Essayer de trouver la page d'origine/sous-titre"
		},
		"Show image URL in tooltip": {
			"ko": "\uD234\uD301\uC5D0 \uC774\uBBF8\uC9C0 URL \uD45C\uC2DC"
		},
		"If the popup is needed to display the larger version of an image, display the image link in the tooltip": {
			"ko": "\uB354 \uD070 \uBC84\uC804\uC758 \uC774\uBBF8\uC9C0\uB97C \uD45C\uC2DC\uD558\uAE30 \uC704\uD574 \uD31D\uC5C5\uC774 \uD544\uC694\uD55C \uACBD\uC6B0 \uC774\uBBF8\uC9C0 \uB9C1\uD06C\uB97C \uD234\uD301\uC5D0 \uD45C\uC2DC\uD568"
		},
		"Hide tooltip after": {
			"ko": "\uD234\uD301 \uC228\uAE30\uAE30"
		},
		"Hides the tooltip after the specified number of seconds (or when the mouse clicks on it). Set to 0 to never hide automatically": {
			"ko": "\uC9C0\uC815\uB41C \uC2DC\uAC04(\uCD08) \uD6C4\uC5D0(\uB610\uB294 \uB9C8\uC6B0\uC2A4\uAC00 \uD234\uD301\uC744 \uD074\uB9AD\uD560 \uB54C) \uD234\uD301\uC744 \uC228\uAE34\uB2E4. \uC790\uB3D9\uC73C\uB85C \uC228\uAE30\uC9C0 \uC54A\uC73C\uB824\uBA74 0\uC73C\uB85C \uC124\uC815"
		},
		"Redirect to largest without issues": {
			"ko": "\uBB38\uC81C\uC5C6\uC774 \uCD5C\uB300\uB85C \uB9AC\uB514\uB809\uC158"
		},
		"Redirects to the largest image found that doesn't require custom headers or forces download": {
			"ko": "\uC0AC\uC6A9\uC790 \uC9C0\uC815 \uD5E4\uB354\uB098 \uAC15\uC81C \uB2E4\uC6B4\uB85C\uB4DC\uAC00 \uD544\uC694 \uC5C6\uB294 \uAC00\uC7A5 \uD070 \uC774\uBBF8\uC9C0\uB85C \uB9AC\uB514\uB809\uC158"
		},
		"Enable mouseover popup": {
			"en": "Enable image popup",
			"es": "Activar popup de la imagen",
			"fr": "Activer le popup",
			"ko": "\uC774\uBBF8\uC9C0 \uD31D\uC5C5 \uC0AC\uC6A9"
		},
		"Show a popup with the larger image when you mouseover an image with the trigger key held (if applicable)": {
			"ko": "\uD2B8\uB9AC\uAC70 \uD0A4\uB97C \uB204\uB978 \uC0C1\uD0DC\uB85C \uC601\uC0C1\uC744 \uB9C8\uC6B0\uC2A4\uB85C \uAC00\uB9AC\uD0AC \uB54C \uB354 \uD070 \uC774\uBBF8\uC9C0\uB85C \uD31D\uC5C5 \uD45C\uC2DC (\uAC00\uB2A5\uD55C \uACBD\uC6B0)"
		},
		"Mouseover popup action": {
			"en": "Popup action",
			"es": "Acci\u00F3n del popup",
			"ko": "\uC774\uBBF8\uC9C0 \uD31D\uC5C5 \uC791\uC5C5"
		},
		"Determines how the mouseover popup will open": {
			"ko": "\uB9C8\uC6B0\uC2A4\uC624\uBC84 \uD31D\uC5C5\uC774 \uC5F4\uB9AC\uB294 \uBC29\uC2DD"
		},
		"New tab": {
			"es": "Nueva pesta\u00F1a",
			"fr": "Nouvel onglet",
			"ko": "\uC0C8 \uD0ED"
		},
		"Mouseover popup trigger": {
			"en": "Popup trigger",
			"es": "Acci\u00F3n del popup al mover el rat\u00F3n encima",
			"fr": "D\u00E9clencheur du popup",
			"ko": "\uD31D\uC5C5 \uD2B8\uB9AC\uAC70"
		},
		"How the popup will get triggered": {
			"ko": "\uD31D\uC5C5 \uC791\uB3D9 \uBC29\uBC95"
		},
		"Mouseover": {
			"es": "Mover rat\u00F3n encima",
			"ko": "\uB9C8\uC6B0\uC2A4"
		},
		"Key trigger": {
			"es": "Tecla de acci\u00F3n",
			"ko": "\uD0A4 \uBC14\uC778\uB529"
		},
		"Popup trigger key": {
			"es": "Tecla de acci\u00F3n del popup",
			"ko": "\uD31D\uC5C5 \uD0A4 \uBC14\uC778\uB529"
		},
		"Key sequence to trigger the popup": {
			"ko": "\uD31D\uC5C5\uC774 \uC791\uB3D9\uD558\uB294 \uD0A4"
		},
		"Popup trigger delay": {
			"es": "Retraso de acci\u00F3n del popup",
			"ko": "\uD31D\uC5C5 \uC791\uC5C5 \uC9C0\uC5F0 \uC2DC\uAC04"
		},
		"Delay (in seconds) before the popup shows": {
			"ko": "\uD31D\uC5C5\uC774 \uD45C\uC2DC\uB420 \uB54C\uAE4C\uC9C0 \uC9C0\uC5F0 (\uCD08)"
		},
		"Allow showing partially loaded": {
			"ko": "\uBD80\uBD84\uC801\uC73C\uB85C \uB85C\uB4DC\uB41C \uC0C1\uD0DC\uB85C \uD45C\uC2DC \uD5C8\uC6A9"
		},
		"This will allow the popup to open for partially loaded media, but this might break some images": {
			"ko": "\uBD80\uBD84\uC801\uC73C\uB85C \uBD88\uB7EC\uC628 \uBBF8\uB514\uC5B4\uC5D0 \uB300\uD574 \uD31D\uC5C5\uC774 \uC5F4\uB9B4 \uC218 \uC788\uC9C0\uB9CC \uC774\uB85C \uC778\uD574 \uC77C\uBD80 \uC774\uBBF8\uC9C0\uAC00 \uC190\uC0C1\uB420 \uC218 \uC788\uC74C"
		},
		"Video": {
			"es": "Video",
			"ko": "\uC601\uC0C1"
		},
		"Media": {
			"es": "Medios",
			"ko": "\uBBF8\uB514\uC5B4"
		},
		"Both images and video": {
			"es": "Im\u00E1genes y video",
			"ko": "\uC0AC\uC9C4+\uC601\uC0C1"
		},
		"Use `not-allowed` cursor when unsupported": {
			"ko": "\uC9C0\uC6D0\uB418\uC9C0 \uC54A\uC744 \uB54C \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uB294 \uCEE4\uC11C\uB97C \uC0AC\uC6A9"
		},
		"If the image isn't supported, the mouse cursor will change to a `not-allowed` cursor for a brief duration": {
			"ko": "\uC774\uBBF8\uC9C0\uAC00 \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uC73C\uBA74 \uB9C8\uC6B0\uC2A4 \uCEE4\uC11C\uAC00 \uC7A0\uC2DC \uB3D9\uC548 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uB294 \uCEE4\uC11C\uB85C \uBCC0\uACBD\uB428"
		},
		"If the image fails to load, the mouse cursor will change to a `not-allowed` cursor for a brief duration": {
			"ko": "\uC774\uBBF8\uC9C0\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC73C\uBA74 \uB9C8\uC6B0\uC2A4 \uCEE4\uC11C\uAC00 \uC7A0\uC2DC \uB3D9\uC548 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uB294 \uCEE4\uC11C\uB85C \uBCC0\uACBD\uB428"
		},
		"Exclude page background": {
			"ko": "\uD398\uC774\uC9C0 \uBC30\uACBD \uC81C\uC678"
		},
		"Excludes the page background for the popup": {
			"ko": "\uD31D\uC5C5\uC5D0 \uB300\uD55C \uD398\uC774\uC9C0 \uBC30\uACBD \uC81C\uC678"
		},
		"Minimum image size": {
			"ko": "\uCD5C\uC18C \uC774\uBBF8\uC9C0 \uD06C\uAE30"
		},
		"Smallest size acceptable for the popup to open (this option is ignored for background images)": {
			"ko": "\uD31D\uC5C5\uC774 \uC5F4\uB9B4 \uC218 \uC788\uB294 \uCD5C\uC18C \uD06C\uAE30 (\uBC31\uADF8\uB77C\uC6B4\uB4DC \uC774\uBBF8\uC9C0\uC5D0\uC11C\uB294 \uC774 \uC635\uC158\uC774 \uBB34\uC2DC\uB428)"
		},
		"Exclude `background-image`s": {
			"ko": "\uBC30\uACBD \uC774\uBBF8\uC9C0 \uC81C\uC678"
		},
		"Excludes `background-image`s for the popup. Might prevent the popup from working on many images": {
			"ko": "\uD31D\uC5C5\uC758 \uBC30\uACBD \uC774\uBBF8\uC9C0 \uC81C\uC678. \uD31D\uC5C5\uC774 \uB9CE\uC740 \uC774\uBBF8\uC9C0\uC5D0\uC11C \uC791\uB3D9\uD558\uC9C0 \uC54A\uC744 \uC218 \uC788\uC74C"
		},
		"Exclude image tabs": {
			"ko": "\uC774\uBBF8\uC9C0 \uD0ED \uC81C\uC678"
		},
		"Excludes images that are opened in their own tabs": {
			"ko": "\uC790\uC2E0\uC758 \uD0ED\uC5D0\uC11C \uC5F4\uB9B0 \uC774\uBBF8\uC9C0 \uC81C\uC678"
		},
		"Exclude if image URL is unchanged": {
			"ko": "\uC774\uBBF8\uC9C0 URL\uC774 \uBCC0\uACBD\uB418\uC9C0 \uC54A\uC740 \uACBD\uC6B0 \uC81C\uC678"
		},
		"Don't pop up if the new image is the same as the thumbnail image": {
			"ko": "\uC0C8 \uC774\uBBF8\uC9C0\uAC00 \uBBF8\uB9AC\uBCF4\uAE30(thumbnail) \uC774\uBBF8\uC9C0\uC640 \uB3D9\uC77C\uD55C \uACBD\uC6B0 \uD31D\uC5C5 \uC548 \uD568"
		},
		"Only popup for linked images": {
			"ko": "\uB9C1\uD06C\uB41C \uC774\uBBF8\uC9C0\uC758 \uD31D\uC5C5\uB9CC"
		},
		"Don't pop up if the image isn't hyperlinked": {
			"ko": "\uC774\uBBF8\uC9C0\uAC00 \uD558\uC774\uD37C\uB9C1\uD06C\uB418\uC9C0 \uC54A\uC740 \uACBD\uC6B0 \uD31D\uC5C5 \uC548 \uD568"
		},
		"Popup link for linked images": {
			"ko": "\uB9C1\uD06C\uB41C \uC774\uBBF8\uC9C0\uC5D0 \uB300\uD55C \uD31D\uC5C5 \uB9C1\uD06C"
		},
		"If the linked image cannot be made larger, pop up for the link instead of the image": {
			"ko": "\uB9C1\uD06C\uB41C \uC774\uBBF8\uC9C0\uB97C \uB354 \uD06C\uAC8C \uB9CC\uB4E4 \uC218 \uC5C6\uB294 \uACBD\uC6B0 \uC774\uBBF8\uC9C0 \uB300\uC2E0 \uB9C1\uD06C \uD31D\uC5C5"
		},
		"Exclude image maps": {
			"ko": "\uC774\uBBF8\uC9C0 \uB9F5 \uC81C\uC678"
		},
		"Don't pop up if the image is an image map (image with multiple clickable areas)": {
			"ko": "\uC774\uBBF8\uC9C0\uAC00 \uC774\uBBF8\uC9C0 \uB9F5(\uD074\uB9AD \uAC00\uB2A5\uD55C \uC601\uC5ED\uC774 \uC5EC\uB7EC \uAC1C\uB97C \uAC00\uC9C4 \uC774\uBBF8\uC9C0)\uC778 \uACBD\uC6B0 \uD31D\uC5C5 \uD45C\uC2DC \uC548 \uD568"
		},
		"Popup UI": {
			"es": "Interfaz del Popup",
			"ko": "\uD31D\uC5C5 UI"
		},
		"Opacity": {
			"es": "Opacidad",
			"fr": "Opacit\u00E9",
			"ko": "\uBD88\uD22C\uBA85"
		},
		"Gallery counter": {
			"es": "N\u00FAmero de im\u00E1genes a contar en la galer\u00EDa",
			"fr": "Nombre d'images dans la galerie",
			"ko": "\uAC24\uB7EC\uB9AC \uC774\uBBF8\uC9C0 \uC218"
		},
		"Gallery counter max": {
			"es": "N\u00FAmero m\u00E1ximo de im\u00E1genes a contar para la galer\u00EDa",
			"fr": "Nombre max d'images a compter pour la galerie",
			"ko": "\uAC24\uB7EC\uB9AC \uC774\uBBF8\uC9C0 \uC218\uC758 \uCD5C\uB300\uAC12"
		},
		"Options Button": {
			"es": "Bot\u00F3n de Opciones",
			"ko": "\uC124\uC815 \uB9C1\uD06C"
		},
		"Keep popup open until": {
			"es": "Mantener popup abierto hasta que",
			"ko": "\uD31D\uC5C5 \uB2EB\uC73C\uB824\uBA74"
		},
		"Closes the popup when the selected condition is met": {
			"ko": "\uC120\uD0DD\uD55C \uC870\uAC74\uC774 \uCDA9\uC871\uB418\uBA74 \uD31D\uC5C5 \uB2EB\uAE30"
		},
		"Any trigger is released": {
			"es": "Cualquier acci\u00F3n se deja ir",
			"ko": "\uC5B4\uB5A4 \uB3D9\uC791\uC5D0\uB3C4 \uB2EB\uD798"
		},
		"All triggers are released": {
			"ko": "\uBAA8\uB4E0 \uB3D9\uC791\uC5D0\uC11C \uB2EB\uD798"
		},
		"ESC/Close is pressed": {
			"ko": "ESC/\uB2EB\uAE30 \uB204\uB974\uAE30"
		},
		"Don't close until mouse leaves": {
			"ko": "\uB9C8\uC6B0\uC2A4\uAC00 \uB5A0\uB0A0 \uB54C\uAE4C\uC9C0 \uB2EB\uC9C0 \uB9C8\uC2ED\uC2DC\uC624."
		},
		"If true, this keeps the popup open even if all triggers are released if the mouse is still over the image": {
			"ko": "\uD65C\uC131\uD654 \uC2DC, \uB9C8\uC6B0\uC2A4\uAC00 \uC774\uBBF8\uC9C0 \uC704\uC5D0 \uC788\uB294 \uACBD\uC6B0 \uBAA8\uB4E0 \uB3D9\uC791\uC5D0\uC11C \uB2EB\uD798\uC744 \uC120\uD0DD\uD588\uB354\uB77C\uB3C4 \uD31D\uC5C5\uC774 \uACC4\uC18D \uC5F4\uB9B0 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uB428"
		},
		"Threshold to leave image": {
			"ko": "\uC774\uBBF8\uC9C0\uB97C \uB5A0\uB098\uAE30 \uC704\uD55C \uC784\uACC4\uAC12"
		},
		"How many pixels outside of the image before the cursor is considered to have left the image": {
			"ko": "\uCEE4\uC11C\uAC00 \uC774\uBBF8\uC9C0\uB97C \uB5A0\uB09C \uAC83\uC73C\uB85C \uD30C\uC545\uD560 \uC218 \uC788\uB294 \uC774\uBBF8\uC9C0 \uD53D\uC140 \uC218"
		},
		"Leaving thumbnail cancels loading": {
			"ko": "\uBBF8\uB9AC\uBCF4\uAE30\uB97C \uB0A8\uAE30\uBA74 \uB85C\uB529\uC774 \uCDE8\uC18C\uB428"
		},
		"Cancels the current popup loading when the cursor has left the thumbnail image": {
			"ko": "\uCEE4\uC11C\uAC00 \uCD95\uC18C \uC774\uBBF8\uC9C0\uC5D0\uC11C \uBC97\uC5B4\uB0A0 \uB54C \uD604\uC7AC \uD31D\uC5C5 \uB85C\uB529 \uCDE8\uC18C"
		},
		"ESC cancels loading": {
			"ko": "ESC \uB85C\uB529 \uCDE8\uC18C"
		},
		"Cancels the current popup loading if ESC is pressed": {
			"ko": "ESC\uB97C \uB204\uB974\uBA74 \uD604\uC7AC \uD31D\uC5C5 \uB85C\uB529\uC774 \uCDE8\uC18C\uB428"
		},
		"Releasing triggers cancels loading": {
			"ko": "\uD2B8\uB9AC\uAC70\uB97C \uD574\uC81C\uD558\uBA74 \uB85C\uB529\uC774 \uCDE8\uC18C\uB428"
		},
		"Cancels the current popup loading if all/any triggers are released (as set by the \"Keep popup open until\" setting)": {
			"ko": "\uC5B4\uB5A4/\uBAA8\uB4E0 \uB3D9\uC791\uC5D0 \uB2EB\uD798\uC744 \uC120\uD0DD\uD55C \uACBD\uC6B0 \uD604\uC7AC \uD31D\uC5C5 \uB85C\uB529 \uCDE8\uC18C (\"\uD31D\uC5C5\uC744 \uB2EB\uC73C\uB824\uBA74\" \uC124\uC815\uC5D0 \uC758\uC874\uD568)"
		},
		"Automatically close after timeout": {
			"ko": "\uC2DC\uAC04 \uCD08\uACFC \uD6C4 \uC790\uB3D9\uC73C\uB85C \uB2EB\uAE30"
		},
		"Closes the popup automatically after a specified period of time has elapsed": {
			"ko": "\uC9C0\uC815\uB41C \uC2DC\uAC04\uC774 \uACBD\uACFC\uD55C \uD6C4 \uD31D\uC5C5 \uC790\uB3D9 \uB2EB\uAE30"
		},
		"Timeout to close popup": {
			"ko": "\uD31D\uC5C5\uC744 \uB2EB\uAE30 \uC704\uD55C \uC2DC\uAC04 \uCD08\uACFC \uC2DC\uAC04(\uCD08)"
		},
		"Amount of time to elapse before automatically closing the popup": {
			"ko": "\uD31D\uC5C5\uC744 \uC790\uB3D9\uC73C\uB85C \uB2EB\uAE30 \uC804 \uACBD\uACFC \uC2DC\uAC04"
		},
		"Use hold key": {
			"ko": "\uACE0\uC815 \uD0A4 \uC0AC\uC6A9"
		},
		"Enables the use of a hold key that, when pressed, will keep the popup open": {
			"ko": "\uB204\uB974\uBA74 \uD31D\uC5C5\uC774 \uC5F4\uB9B0 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uB418\uB294 \uACE0\uC815 \uD0A4 \uC0AC\uC6A9"
		},
		"Hold key": {
			"ko": "\uACE0\uC815 \uD0A4"
		},
		"Hold key that, when pressed, will keep the popup open": {
			"ko": "\uACE0\uC815 \uD0A4\uB97C \uB204\uB974\uBA74 \uD31D\uC5C5\uC774 \uC5F4\uB9B0 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uB428"
		},
		"Center popup on hold": {
			"ko": "\uC911\uC559 \uD31D\uC5C5 \uACE0\uC815"
		},
		"Centers the popup to the middle of the page when the popup is held": {
			"ko": "\uD31D\uC5C5\uC774 \uC5F4\uB9B4 \uB54C \uD31D\uC5C5\uC744 \uD398\uC774\uC9C0 \uC911\uC559\uC5D0 \uBC30\uCE58"
		},
		"Close popup on unhold": {
			"ko": "\uACE0\uC815 \uD574\uC81C \uC2DC, \uD31D\uC5C5 \uB2EB\uAE30"
		},
		"Closes the popup when the hold key is pressed again, after having previously held the popup": {
			"ko": "\uD31D\uC5C5\uC744 \uACE0\uC815\uD55C \uD6C4 \uACE0\uC815 \uD0A4\uB97C \uB2E4\uC2DC \uB204\uB974\uBA74 \uD31D\uC5C5\uC774 \uB2EB\uD798"
		},
		"Enable pointer events on hold": {
			"ko": "\uD3EC\uC778\uD130 \uC774\uBCA4\uD2B8 \uACE0\uC815 \uC0AC\uC6A9"
		},
		"Enables previously disabled pointer events when the popup is held": {
			"ko": "\uD31D\uC5C5\uC774 \uACE0\uC815\uB420 \uB54C \uC774\uC804\uC5D0 \uBE44\uD65C\uC131\uD654\uB41C \uD3EC\uC778\uD130 \uC774\uBCA4\uD2B8 \uD65C\uC131\uD654"
		},
		"Clicking outside the popup closes": {
			"ko": "\uD31D\uC5C5 \uBC14\uAE65\uCABD\uC744 \uD074\uB9AD\uD558\uBA74 \uB2EB\uD798"
		},
		"Closes the popup when the mouse clicks outside of it": {
			"ko": "\uB9C8\uC6B0\uC2A4\uAC00 \uD31D\uC5C5 \uBC14\uAE65\uCABD\uC744 \uD074\uB9AD\uD560 \uB54C \uD31D\uC5C5 \uB2EB\uAE30"
		},
		"Close when leaving": {
			"ko": "\uB5A0\uB0A0 \uB54C \uB2EB\uAE30"
		},
		"Thumbnail": {
			"ko": "\uBBF8\uB9AC\uBCF4\uAE30(\uC378\uB124\uC77C)"
		},
		"Popup": {
			"ko": "\uD31D\uC5C5"
		},
		"Both": {
			"ko": "\uB458 \uB2E4"
		},
		"Allow inter-frame communication": {
			"ko": "\uD504\uB808\uC784 \uAC04 \uD1B5\uC2E0 \uD5C8\uC6A9"
		},
		"Allows communication between frames in windows, improving support for keybindings": {
			"ko": "\uCC3D\uC758 \uD504\uB808\uC784 \uAC04 \uD1B5\uC2E0\uC744 \uD5C8\uC6A9\uD558\uC5EC \uD0A4 \uBC14\uC778\uB529\uC5D0 \uB300\uD55C \uC9C0\uC6D0\uC744 \uAC1C\uC120\uD55C\uB2E4."
		},
		"Allows communication between frames in windows, improving support for keybindings. Can pose a fingerprinting risk when used through the userscript": {
			"ko": "\uCC3D\uC758 \uD504\uB808\uC784 \uAC04 \uD1B5\uC2E0\uC744 \uD5C8\uC6A9\uD558\uC5EC \uD0A4 \uBC14\uC778\uB529\uC5D0 \uB300\uD55C \uC9C0\uC6D0\uC744 \uAC1C\uC120\uD569\uB2C8\uB2E4. \uC720\uC800\uC2A4\uD06C\uB9BD\uD2B8\uB97C \uD1B5\uD574 \uC0AC\uC6A9 \uC2DC, \uBCF4\uC548\uC5D0 \uC704\uD611\uC774 \uC788\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4"
		},
		"Pop out of frames": {
			"ko": "\uD504\uB808\uC784\uC5D0\uC11C \uD31D\uC5C5"
		},
		"Opens the popup on the top frame instead of within iframes. Still in beta": {
			"ko": "iframes \uB300\uC2E0 \uC0C1\uB2E8 \uD504\uB808\uC784\uC758 \uD31D\uC5C5 \uC5F4\uAE30 \u2500 \uBCA0\uD0C0 \uC0C1\uD0DC"
		},
		"Popup default zoom": {
			"ko": "\uD655\uB300/\uCD95\uC18C \uAE30\uBCF8\uAC12"
		},
		"How the popup should be initially sized": {
			"ko": "\uD31D\uC5C5\uC758 \uCD08\uAE30 \uD06C\uAE30 \uC870\uC815 \uBC29\uBC95"
		},
		"Fit to screen": {
			"fr": "Adapter a l'ecran",
			"ko": "\uD654\uBA74 \uD06C\uAE30\uC5D0 \uB9DE\uCDA4"
		},
		"Fill screen": {
			"ko": "\uD654\uBA74 \uCC44\uC6B0\uAE30"
		},
		"Full size": {
			"fr": "Taille r\u00E9elle",
			"ko": "\uC804\uCCB4 \uD06C\uAE30"
		},
		"Custom size": {
			"ko": "\uB9DE\uCDA4 \uD06C\uAE30"
		},
		"Custom zoom percent": {
			"ko": "\uC0AC\uC6A9\uC790 \uC9C0\uC815 \uD655\uB300/\uCD95\uC18C \uBE44\uC728"
		},
		"Custom percent to initially size the popup": {
			"ko": "\uD31D\uC5C5 \uC124\uC815 \uC2DC, \uCD08\uAE30 \uC0AC\uC6A9\uC790 \uC9C0\uC815 \uD655\uB300/\uCD95\uC18C \uBE44\uC728"
		},
		"Maximum width": {
			"ko": "\uCD5C\uB300 \uAC00\uB85C \uAE38\uC774"
		},
		"Maximum width for the initial popup size. Set to `0` for unlimited.": {
			"ko": "\uCD08\uAE30 \uD31D\uC5C5 \uD06C\uAE30\uC758 \uCD5C\uB300 \uAC00\uB85C \uAE38\uC774. \uBB34\uC81C\uD55C\uC758 \uACBD\uC6B0 0\uC73C\uB85C \uC124\uC815\uD558\uC2ED\uC2DC\uC624."
		},
		"Maximum height": {
			"ko": "\uCD5C\uB300 \uC138\uB85C \uAE38\uC774"
		},
		"Maximum height for the initial popup size. Set to `0` for unlimited.": {
			"ko": "\uCD08\uAE30 \uD31D\uC5C5 \uD06C\uAE30\uC758 \uCD5C\uB300 \uC138\uB85C \uAE38\uC774. \uBB34\uC81C\uD55C\uC73C\uB85C '0'\uC73C\uB85C \uC124\uC815\uD55C\uB2E4."
		},
		"Popup panning method": {
			"ko": "\uC774\uBBF8\uC9C0 \uC774\uB3D9\uD558\uB824\uBA74"
		},
		"Movement": {
			"ko": "\uB9C8\uC6B0\uC2A4 \uC6C0\uC9C1\uC785\uB2C8\uB2E4"
		},
		"Drag": {
			"ko": "\uB055\uB2C8\uB2E4"
		},
		"Zoom": {
			"ko": "\uC90C"
		},
		"Pan": {
			"ko": "\uC774\uB3D9"
		},
		"None": {
			"ko": "\uC5C6\uB2E4"
		},
		"Cursor": {
			"ko": "\uCEE4\uC11C"
		},
		"Zoom behavior": {
			"ko": "\uC90C \uB3D9\uC791"
		},
		"Fit/Full": {
			"ko": "\uD654\uBA74\uB9DE\uCDA4/\uC804\uCCB4"
		},
		"Incremental": {
			"fr": "Incr\u00E9mentale",
			"ko": "\uC99D\uBD84"
		},
		"Zoom out fully to close": {
			"ko": "\uB2EB\uAE30 \uC704\uD574 \uC644\uC804\uD788 \uCD95\uC18C"
		},
		"Closes the popup if you zoom out past the minimum zoom": {
			"ko": "\uCD5C\uC18C \uD06C\uAE30\uB85C \uCD95\uC18C\uD560 \uACBD\uC6B0 \uD31D\uC5C5 \uB2EB\uAE30"
		},
		"Popup position": {
			"ko": "\uD31D\uC5C5 \uC704\uCE58"
		},
		"Where the popup will appear": {
			"ko": "\uD31D\uC5C5\uC774 \uD45C\uC2DC\uB418\uB294 \uC704\uCE58"
		},
		"Cursor middle": {
			"ko": "\uCEE4\uC11C \uC911\uAC04"
		},
		"Underneath the mouse cursor": {
			"ko": "\uB9C8\uC6B0\uC2A4 \uCEE4\uC11C \uC544\uB798"
		},
		"Beside cursor": {
			"ko": "\uCEE4\uC11C \uC606"
		},
		"Page middle": {
			"ko": "\uD398\uC774\uC9C0 \uC911\uAC04"
		},
		"Popup for plain hyperlinks": {
			"ko": "\uC77C\uBC18\uC801\uC778 \uB9C1\uD06C\uC5D0\uB3C4 \uD31D\uC5C5"
		},
		"Whether or not the popup should also open for plain hyperlinks": {
			"ko": "\uC77C\uBC18 \uD558\uC774\uD37C\uB9C1\uD06C\uC758 \uD31D\uC5C5 \uC5F4\uAE30 \uC5EC\uBD80"
		},
		"Only for links that look valid": {
			"ko": "\uC720\uD6A8\uD574 \uBCF4\uC774\uB294 \uB9C1\uD06C\uC5D0\uB9CC \uD574\uB2F9"
		},
		"Enabling this option will only allow links to be popped up if they look valid (such as if they have a known image/video extension, or are explicitly supported)": {
			"ko": "\uC774 \uC635\uC158\uC744 \uD65C\uC131\uD654\uD558\uBA74 \uB9C1\uD06C\uAC00 \uC720\uD6A8\uD55C \uAC83\uC73C\uB85C \uBCF4\uC774\uB294 \uACBD\uC6B0\uC5D0\uB9CC(\uC608: \uC54C\uB824\uC9C4 \uC774\uBBF8\uC9C0/\uBE44\uB514\uC624 \uD655\uC7A5\uBA85\uC774 \uC788\uAC70\uB098 \uBA85\uC2DC\uC801\uC73C\uB85C \uC9C0\uC6D0\uB418\uB294 \uACBD\uC6B0) \uB9C1\uD06C\uAC00 \uD31D\uC5C5\uB420 \uC218 \uC788\uC74C"
		},
		"Popup for `<iframe>`": {
			"ko": "<iframe>\uC5D0 \uB300\uD55C \uD31D\uC5C5"
		},
		"Allows `<iframe>` elements to be popped up as well. Storing images/videos in this way is rather uncommon, but it can allow embeds to be supported": {
			"ko": "<iframe>\uC758 \uC694\uC18C\uB4E4\uB3C4 \uD31D\uC5C5\uC774 \uC791\uB3D9\uD558\uB3C4\uB85D \uD5C8\uC6A9. \uC774\uB7F0 \uC2DD\uC73C\uB85C \uC774\uBBF8\uC9C0/\uBE44\uB514\uC624\uB97C \uC800\uC7A5\uD558\uB294 \uAC83\uC740 \uB2E4\uC18C \uB4DC\uBB38 \uC77C\uC774\uC9C0\uB9CC, embeds\uB97C \uC9C0\uC6D0\uD560 \uC218 \uC788\uC74C"
		},
		"Popup for `<canvas>`": {
			"ko": "<canvas>\uC5D0 \uB300\uD55C \uD31D\uC5C5"
		},
		"Allows `<canvas>` elements to be popped up as well. This will likely cause popups with any kind of web-based games, so it's recommended to keep this disabled": {
			"ko": "<canvas>\uC758 \uC694\uC18C\uB4E4\uB3C4 \uD31D\uC5C5\uC774 \uC791\uB3D9\uD558\uB3C4\uB85D \uD5C8\uC6A9. \uC774\uAC83\uC740 \uC5B4\uB5A4 \uC885\uB958\uC758 \uC6F9 \uAE30\uBC18 \uAC8C\uC784\uC774\uB77C\uB3C4 \uD31D\uC5C5\uC744 \uC720\uBC1C\uD560 \uAC00\uB2A5\uC131\uC774 \uB192\uC73C\uBBC0\uB85C, \uC774 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uB3C4\uB85D \uC720\uC9C0\uD558\uB294 \uAC83\uC774 \uC88B\uC74C"
		},
		"Popup for `<svg>`": {
			"ko": "<svg>\uC5D0 \uB300\uD55C \uD31D\uC5C5"
		},
		"Allows `<svg>` elements to be popped up as well. These are usually used for icons, and can occasionally cause problems for websites that overlay icons on top of images": {
			"ko": "<canvas>\uC758 \uC694\uC18C\uB4E4\uB3C4 \uD31D\uC5C5\uC774 \uC791\uB3D9\uD558\uB3C4\uB85D \uD5C8\uC6A9. \uC774\uAC83\uC740 \uBCF4\uD1B5 \uC544\uC774\uCF58\uC5D0 \uC0AC\uC6A9\uB418\uBA70, \uB54C\uB54C\uB85C \uC774\uBBF8\uC9C0 \uC704\uC5D0 \uC544\uC774\uCF58\uC744 \uC624\uBC84\uB808\uC774\uD558\uB294 \uC6F9 \uC0AC\uC774\uD2B8\uC5D0 \uBB38\uC81C\uB97C \uC77C\uC73C\uD0AC \uC218 \uC788\uC74C"
		},
		"Popup CSS style": {
			"ko": "\uD31D\uC5C5 CSS"
		},
		"Don't popup blacklisted images": {
			"ko": "\uBE14\uB799\uB9AC\uC2A4\uD2B8\uC5D0 \uC788\uB294 \uC774\uBBF8\uC9C0 \uD31D\uC5C5 \uC548 \uD568"
		},
		"This option prevents a popup from appearing altogether for blacklisted images": {
			"ko": "\uC774 \uC635\uC158\uC744 \uC120\uD0DD\uD558\uBA74 \uBE14\uB799\uB9AC\uC2A4\uD2B8\uC5D0 \uC788\uB294 \uC774\uBBF8\uC9C0\uC5D0 \uB300\uD55C \uD31D\uC5C5\uC774 \uBAA8\uB450 \uD45C\uC2DC\uB418\uC9C0 \uC54A\uC74C"
		},
		"Apply blacklist for host websites": {
			"ko": "\uD638\uC2A4\uD2B8 \uC6F9 \uC0AC\uC774\uD2B8\uC5D0 \uBE14\uB799\uB9AC\uC2A4\uD2B8 \uC801\uC6A9"
		},
		"This option prevents the script from applying any popups to host websites that are in the blacklist. For example, adding `twitter.com` to the blacklist would prevent any popup from opening on twitter.com. If disabled, this option only applies to image URLs (such as twimg.com), not host URLs": {
			"ko": "\uC774 \uC635\uC158\uC740 \uC2A4\uD06C\uB9BD\uD2B8\uAC00 \uBE14\uB799\uB9AC\uC2A4\uD2B8\uC5D0 \uC788\uB294 \uD638\uC2A4\uD2B8 \uC6F9 \uC0AC\uC774\uD2B8\uC5D0 \uD31D\uC5C5\uC744 \uC801\uC6A9\uD558\uB294 \uAC83\uC744 \uBC29\uC9C0\uD55C\uB2E4. \uC608\uB97C \uB4E4\uC5B4 twitter.com\uC744 \uBE14\uB799\uB9AC\uC2A4\uD2B8\uC5D0 \uCD94\uAC00\uD558\uBA74 twitter.com\uC5D0\uC11C \uC5B4\uB5A4 \uD31D\uC5C5\uB3C4 \uC5F4\uB9AC\uC9C0 \uC54A\uAC8C \uB41C\uB2E4. \uBE44\uD65C\uC131\uD654\uB41C \uACBD\uC6B0 \uC774 \uC635\uC158\uC740 \uD638\uC2A4\uD2B8 URL\uC774 \uC544\uB2CC \uC774\uBBF8\uC9C0 URL(\uC608: twimg.com)\uC5D0\uB9CC \uC801\uC6A9\uB428"
		},
		"Don't popup video for image": {
			"ko": "\uC774\uBBF8\uC9C0\uC5D0 \uB300\uD55C \uBE44\uB514\uC624 \uD31D\uC5C5 \uC548 \uD568"
		},
		"This option prevents the popup from loading a video when the source was an image. Vice-versa is also applied": {
			"ko": "\uC6D0\uBCF8\uC774 \uC774\uBBF8\uC9C0\uC77C \uB54C \uD31D\uC5C5\uC774 \uBE44\uB514\uC624\uB97C \uB85C\uB4DC\uD558\uB294 \uAC83\uC744 \uBC29\uC9C0\uD568.  \uBC18\uB300\uC758 \uACBD\uC6B0\uB3C4 \uC801\uC6A9\uD568."
		},
		"Support `pointer-events:none`": {
			"ko": "`\uD3EC\uC778\uD130 \uC774\uBCA4\uD2B8 : \uC5C6\uC74C` \uC9C0\uC6D0"
		},
		"Manually looks through every element on the page to see if the cursor is beneath them. Supports more images, but also results in a higher CPU load for websites such as Facebook.": {
			"ko": "\uCEE4\uC11C \uC544\uB798 \uC788\uB294 \uD398\uC774\uC9C0\uC758 \uBAA8\uB4E0 \uC694\uC18C\uB97C \uC218\uB3D9\uC73C\uB85C \uD655\uC778\uD569\uB2C8\uB2E4. \uB354 \uB9CE\uC740 \uC774\uBBF8\uC9C0\uB97C \uC9C0\uC6D0\uD558\uC9C0\uB9CC, Facebook\uACFC \uAC19\uC740 \uC6F9\uC0AC\uC774\uD2B8\uC758 CPU \uBD80\uD558\uAC00 \uB354 \uB192\uC544\uC9C4\uB2E4."
		},
		"Use userscript": {
			"fr": "Utiliser ce userscript",
			"ko": "\uC720\uC800\uC2A4\uD06C\uB9BD\uD2B8 \uC0AC\uC6A9\uD558\uAE30"
		},
		"Website image preview": {
			"ko": "\uB9C1\uD06C \uBD99\uC778 \uD6C4 \uC774\uBBF8\uC9C0 \uBBF8\uB9AC\uBCF4\uAE30"
		},
		"Larger watermarked images": {
			"ko": "\uB354 \uD06C\uC9C0\uB9CC \uC6CC\uD130\uB9C8\uD06C \uC788\uB294 \uC774\uBBF8\uC9C0"
		},
		"Smaller non-watermarked images": {
			"ko": "\uB354 \uC791\uC9C0\uB9CC \uC6CC\uD130\uB9C8\uD06C \uC5C6\uB294 \uC774\uBBF8\uC9C0"
		},
		"Possibly different images": {
			"fr": "Images possiblement diff\u00E9rentes",
			"ko": "\uB2E4\uB97C \uC218 \uC788\uB294 \uC774\uBBF8\uC9C0"
		},
		"Possibly broken images": {
			"fr": "Images possiblement bris\u00E9e",
			"ko": "\uC190\uC0C1\uB420 \uC218 \uC788\uB294 \uC774\uBBF8\uC9C0"
		},
		"Rules using 3rd-party websites": {
			"fr": "R\u00E8gles utilisant des sites 3rd-party",
			"ko": "\uC11C\uB4DC\uD30C\uD2F0 \uC0AC\uC774\uD2B8\uB97C \uC0AC\uC6A9\uD558\uB294 \uADDC\uCE59"
		},
		"Newsen": {
			"ko": "\uB274\uC2A4\uC5D4"
		},
		"Blacklist": {
			"ko": "\uBE14\uB799\uB9AC\uC2A4\uD2B8"
		},
		"Blacklist engine": {
			"ko": "\uBE14\uB799\uB9AC\uC2A4\uD2B8 \uC5D4\uC9C4"
		},
		"Simple (glob)": {
			"ko": "\uB2E8\uC21C (glob)"
		},
		"Regex": {
			"ko": "\uC815\uADDC\uC2DD"
		},
		"images": {
			"es": "im\u00E1genes",
			"ko": "\uC774\uBBF8\uC9C0"
		},
		"seconds": {
			"es": "segundos",
			"ko": "\uCD08"
		}
	};

	function _(str) {
		if (typeof str !== "string") {
			return str;
		}

		var language = settings.language;

		if (str in strings) {
			if (language in strings[str]) {
				str = strings[str][language];
			} else if ("en" in strings[str]) {
				str = strings[str]["en"];
			}
		}

		// most strings don't contain %
		if (string_indexof(str, "%") < 0) {
			return str;
		}

		var parts = [];
		var currentpart = "";
		for (var i = 0; i < str.length; i++) {
			if (str[i] == '%') {
				if ((i + 2) < str.length) {
					if (str[i + 1] == '%') {
						var num = parseInt(str[i + 2]);
						if (!isNaN(num)) {
							parts.push(currentpart);
							currentpart = "";
							parts.push(arguments[num]);
							i += 2;
							continue;
						}
					}
				}
			}

			currentpart += str[i];
		}

		parts.push(currentpart);
		return parts.join("");
	}

	var old_settings_keys = [
		"mouseover_trigger",
		"mouseover_use_fully_loaded_video",
		"mouseover_use_fully_loaded_image",
		"mouseover_close_on_leave_el",
		"mouseover_scroll_behavior",
		"mouseover_mask_styles",
		"mouseover_video_seek_vertical_scroll",
		"mouseover_video_seek_horizontal_scroll"
	];

	var settings = {
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-530760246
		imu_enabled: true,
		language: browser_language,
		check_updates: true,
		check_update_interval: 24,
		check_update_notify: false,
		// thanks to forefix on firefox for the idea: https://github.com/qsniyg/maxurl/issues/189
		dark_mode: false,
		settings_tabs: false,
		// thanks to ambler on discord for the idea
		settings_alphabetical_order: false,
		settings_visible_description: true,
		settings_show_disabled: true,
		settings_show_requirements: true,
		advanced_options: false,
		allow_browser_request: true,
		retry_503_times: 3,
		retry_503_ms: 2000,
		use_blob_over_arraybuffer: false,
		allow_live_settings_reload: true,
		allow_remote: true,
		disable_keybind_when_editing: true,
		enable_gm_download: true,
		gm_download_max: 15,
		// thanks to pax romana on discord for the idea: https://github.com/qsniyg/maxurl/issues/372
		// this must be false, because it requires a permission
		enable_webextension_download: false,
		redirect: true,
		redirect_history: true,
		redirect_extension: true,
		canhead_get: true,
		redirect_force_page: false,
		// thanks to fireattack on discord for the idea: https://github.com/qsniyg/maxurl/issues/324
		redirect_infobox_url: false,
		redirect_infobox_timeout: 7,
		print_imu_obj: false,
		redirect_disable_for_responseheader: false,
		redirect_to_no_infobox: false,
		mouseover: true,
		// thanks to blue-lightning on github for the idea: https://github.com/qsniyg/maxurl/issues/16
		mouseover_open_behavior: "popup",
		//mouseover_trigger: ["ctrl", "shift"],
		mouseover_trigger_behavior: "keyboard",
		// thanks to 894-572 on github for the idea: https://github.com/qsniyg/maxurl/issues/30
		mouseover_trigger_key: ["shift", "alt", "i"],
		mouseover_trigger_delay: 1,
		mouseover_trigger_mouseover: false,
		// thanks to lnp5131 on github for the idea: https://github.com/qsniyg/maxurl/issues/421
		mouseover_trigger_enabledisable_toggle: "disable",
		mouseover_trigger_prevent_key: ["shift"],
		// also thanks to blue-lightning: https://github.com/qsniyg/maxurl/issues/16
		mouseover_close_behavior: "esc",
		// thanks to acid-crash on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-436594057
		mouseover_close_need_mouseout: true,
		mouseover_jitter_threshold: 30,
		mouseover_cancel_popup_when_elout: true,
		mouseover_cancel_popup_with_esc: true,
		// thanks to cosuwi on github for the idea: https://github.com/qsniyg/maxurl/issues/367
		mouseover_cancel_popup_when_release: true,
		// thanks to remlap on discord for the idea: https://github.com/qsniyg/maxurl/issues/250
		mouseover_auto_close_popup: false,
		mouseover_auto_close_popup_time: 5,
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-530760246
		mouseover_use_hold_key: true,
		mouseover_hold_key: ["i"],
		mouseover_hold_position_center: false,
		mouseover_hold_close_unhold: false,
		mouseover_hold_unclickthrough: true,
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-531549043
		//mouseover_close_on_leave_el: true,
		mouseover_close_el_policy: "both",
		// thanks to hosa dokha on greasyfork for the idea: https://greasyfork.org/en/forum/discussion/71894/this-script-is-a-dream-come-true-just-1-thing
		mouseover_close_click_outside: false,
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/126
		mouseover_allow_partial: is_extension ? "media" : "video",
		mouseover_partial_avoid_head: false,
		mouseover_use_blob_over_data: false,
		mouseover_enable_notallowed: true,
		// thanks to Rnksts on discord for the idea
		mouseover_enable_notallowed_cant_load: true,
		mouseover_notallowed_duration: 300,
		//mouseover_use_fully_loaded_image: is_extension ? false : true,
		//mouseover_use_fully_loaded_video: false,
		mouseover_minimum_size: 20,
		mouseover_exclude_backgroundimages: false,
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-530760246
		mouseover_exclude_page_bg: true,
		mouseover_exclude_imagemaps: true,
		// thanks to Jin on discord for the idea
		mouseover_only_links: false,
		mouseover_linked_image: false,
		mouseover_exclude_sameimage: false,
		mouseover_exclude_imagetab: true,
		mouseover_video_controls: false,
		mouseover_video_controls_key: ["c"],
		mouseover_video_loop: true,
		// thanks to Runakanta on discord for the idea: https://github.com/qsniyg/maxurl/issues/403
		mouseover_video_autoloop_max: 0,
		mouseover_video_playpause_key: ["space"],
		mouseover_video_muted: false,
		mouseover_video_mute_key: ["m"],
		mouseover_video_volume: 100,
		mouseover_video_volume_down_key: ["9"],
		mouseover_video_volume_up_key: ["0"],
		mouseover_video_volume_change_amt: 5,
		mouseover_video_resume_from_source: false,
		mouseover_video_resume_if_different: false,
		mouseover_video_pause_source: true,
		mouseover_video_seek_amount: 10,
		mouseover_video_seek_left_key: ["shift", "left"],
		mouseover_video_seek_right_key: ["shift", "right"],
		//mouseover_video_seek_vertical_scroll: false,
		//mouseover_video_seek_horizontal_scroll: false,
		mouseover_video_frame_prev_key: [","],
		mouseover_video_frame_next_key: ["."],
		mouseover_video_framerate: 25,
		mouseover_video_speed_down_key: ["["],
		mouseover_video_speed_up_key: ["]"],
		mouseover_video_speed_amount: 0.25,
		// thanks to Rnksts on discord for the idea
		mouseover_video_reset_speed_key: ["backspace"],
		mouseover_ui: true,
		mouseover_ui_opacity: 80,
		mouseover_ui_use_safe_glyphs: false,
		mouseover_ui_imagesize: true,
		mouseover_ui_zoomlevel: true,
		mouseover_ui_filesize: false,
		mouseover_ui_gallerycounter: true,
		mouseover_ui_gallerymax: 50,
		// thanks to pacep94616 on github for the idea: https://github.com/qsniyg/maxurl/issues/225
		mouseover_ui_gallerybtns: true,
		mouseover_ui_closebtn: true,
		mouseover_ui_optionsbtn: is_userscript ? true : false,
		mouseover_ui_downloadbtn: false,
		mouseover_ui_rotationbtns: false,
		mouseover_ui_caption: true,
		mouseover_ui_wrap_caption: true,
		mouseover_ui_caption_link_page: true,
		mouseover_ui_link_underline: true,
		mouseover_use_remote: false,
		mouseover_zoom_behavior: "fit",
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-531080061
		mouseover_zoom_custom_percent: 100,
		mouseover_zoom_max_width: 0,
		mouseover_zoom_max_height: 0,
		mouseover_pan_behavior: "drag",
		mouseover_movement_inverted: true,
		mouseover_drag_min: 5,
		mouseover_scrolly_behavior: "zoom",
		mouseover_scrollx_behavior: "gallery",
		// thanks to Runakanta on discord for the idea
		mouseover_scrolly_video_behavior: "default",
		mouseover_scrolly_video_invert: false,
		mouseover_scrollx_video_behavior: "default",
		// thanks to regis on discord for the idea
		scroll_override_page: false,
		// thanks to regis on discord for the idea
		scroll_zoom_origin: "cursor",
		scroll_zoom_behavior: "fitfull",
		// thanks to regis on discord for the idea
		scroll_incremental_mult: 1.25,
		mouseover_move_with_cursor: false,
		// thanks to regis on discord for the idea
		mouseover_move_within_page: true,
		zoom_out_to_close: false,
		// thanks to 07416 on github for the idea: https://github.com/qsniyg/maxurl/issues/20#issuecomment-439599984
		mouseover_position: "cursor",
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-531549043
		mouseover_prevent_cursor_overlap: true,
		mouseover_add_link: true,
		mouseover_add_video_link: false,
		// thanks to bitst0rm on greasyfork for the idea: https://github.com/qsniyg/maxurl/issues/498
		mouseover_click_image_close: false,
		mouseover_click_video_close: false,
		mouseover_download: false,
		mouseover_hide_cursor: false,
		mouseover_hide_cursor_after: 0,
		mouseover_mouse_inactivity_jitter: 5,
		// thanks to thewhiterabbit- on reddit for the idea: https://github.com/qsniyg/maxurl/issues/331
		mouseover_clickthrough: false,
		// also thanks to 07416: https://github.com/qsniyg/maxurl/issues/25
		mouseover_links: false,
		// thanks to LoneFenris: https://github.com/qsniyg/maxurl/issues/25#issuecomment-482880122
		mouseover_only_valid_links: true,
		mouseover_allow_iframe_el: false,
		mouseover_allow_canvas_el: false,
		mouseover_allow_svg_el: false,
		mouseover_enable_gallery: true,
		mouseover_gallery_cycle: false,
		mouseover_gallery_prev_key: ["left"],
		mouseover_gallery_next_key: ["right"],
		mouseover_gallery_move_after_video: false,
		// thanks to acid-crash on github for the idea: https://github.com/qsniyg/maxurl/issues/20
		mouseover_styles: "",
		mouseover_enable_fade: true,
		mouseover_enable_zoom_effect: false,
		mouseover_zoom_effect_move: false,
		mouseover_fade_time: 100,
		mouseover_enable_mask_styles: false,
		mouseover_mask_styles2: "background-color: rgba(0, 0, 0, 0.5)",
		mouseover_mask_fade_time: 100,
		mouseover_ui_styles: "",
		// thanks to decembre on github for the idea: https://github.com/qsniyg/maxurl/issues/14#issuecomment-541065461
		mouseover_wait_use_el: false,
		mouseover_add_to_history: false,
		mouseover_close_key: ["esc"],
		mouseover_download_key: [["s"], ["ctrl", "s"]],
		mouseover_open_new_tab_key: ["o"],
		mouseover_open_bg_tab_key: ["shift", "o"],
		mouseover_open_options_key: ["p"],
		// thanks to Иван Хомяков on greasyfork for the idea: https://greasyfork.org/en/forum/discussion/comment/99404/#Comment_99404
		mouseover_open_orig_page_key: ["n"],
		mouseover_rotate_left_key: ["e"],
		mouseover_rotate_right_key: ["r"],
		mouseover_flip_horizontal_key: ["h"],
		mouseover_flip_vertical_key: ["v"],
		mouseover_zoom_in_key: [["+"], ["="], ["shift", "="]],
		mouseover_zoom_out_key: [["-"]],
		mouseover_zoom_full_key: ["1"],
		mouseover_zoom_fit_key: ["2"],
		mouseover_fullscreen_key: ["f"],
		mouseover_apply_blacklist: true,
		apply_blacklist_host: false,
		mouseover_matching_media_types: false,
		mouseover_support_pointerevents_none: false,
		popup_allow_cache: true,
		popup_cache_duration: 30,
		popup_cache_itemlimit: 20,
		popup_cache_resume_video: true,
		website_inject_imu: true,
		website_image: true,
		extension_contextmenu: true,
		allow_video: true,
		allow_dash_video: false,
		allow_hls_video: false,
		custom_xhr_for_lib: is_extension ? true : false,
		hls_dash_use_max: true,
		max_video_quality: null,
		allow_watermark: false,
		allow_smaller: false,
		allow_possibly_different: false,
		allow_possibly_broken: false,
		allow_possibly_upscaled: false,
		allow_thirdparty: false,
		allow_apicalls: true,
		allow_thirdparty_libs: is_userscript ? false : true,
		allow_thirdparty_code: false,
		allow_bruteforce: false,
		process_format: {},
		//browser_cookies: true,
		deviantart_prefer_size: false,
		deviantart_support_download: true,
		imgur_filename: false,
		imgur_source: false,
		instagram_use_app_api: true,
		instagram_dont_use_web: false,
		instagram_gallery_postlink: false,
		snapchat_orig_media: true,
		tiktok_no_watermarks: false,
		tiktok_thirdparty: null,
		// just a very small protection against github scraping bots :)
		tumblr_api_key: base64_decode("IHhyTXBMTThuMWVDZUwzb1JZU1pHN0NMQUx3NkVIaFlEZFU2V3E1ZUQxUGJNa2xkN1kx").substr(1),
		// thanks to LukasThyWalls on github for the idea: https://github.com/qsniyg/maxurl/issues/75
		bigimage_blacklist: "",
		bigimage_blacklist_engine: "glob",
		replaceimgs_enable_keybinding: false,
		replaceimgs_keybinding: ["shift", "alt", "r"],
		replaceimgs_auto: false,
		replaceimgs_replaceimgs: true,
		replaceimgs_addlinks: false,
		replaceimgs_replacelinks: false,
		replaceimgs_usedata: is_userscript ? true : false,
		replaceimgs_wait_fullyloaded: true,
		replaceimgs_totallimit: 8,
		replaceimgs_domainlimit: 2,
		replaceimgs_delay: 0,
		highlightimgs_enable_keybinding: false,
		highlightimgs_keybinding: ["shift", "alt", "h"],
		highlightimgs_enable: false,
		highlightimgs_auto: "never",
		highlightimgs_onlysupported: true,
		highlightimgs_css: "outline: 4px solid yellow",

		// cache entries (not settings, but this is the most convenient way to do it)
		last_update_check: 0,
		last_update_version: null,
		last_update_url: null
	};
	var orig_settings = deepcopy(settings);

	var sensitive_settings = [
		"tumblr_api_key"
	];

	var user_defined_settings = {};

	var settings_meta = {
		imu_enabled: {
			name: "Enable extension",
			description: "Globally enables or disables the extension",
			category: "general",
			// Userscript users can easily disable it from the userscript menu,
			//   and enabling it again isn't as trivial as it is for the extension
			extension_only: true,
			imu_enabled_exempt: true
		},
		language: {
			name: "Language",
			description: "Language for this extension",
			category: "general",
			options: {
				_type: "combo",
				en: {
					name: "English"
				},
				es: {
					name: "Espa\u00F1ol"
				},
				fr: {
					name: "Fran\u00E7ais"
				},
				ko: {
					name: "\uD55C\uAD6D\uC5B4"
				}
			},
			onedit: function() {
				run_soon(do_options);
			},
			imu_enabled_exempt: true
		},
		dark_mode: {
			name: "Dark mode",
			description: "Changes the colors to have light text on a dark background",
			category: "general",
			onedit: update_dark_mode,
			onupdate: update_dark_mode,
			imu_enabled_exempt: true
		},
		settings_visible_description: {
			name: "Description below options",
			description: "Shows the description below the options (otherwise the description is only shown when you hover over the option's name)",
			category: "general",
			subcategory: "settings",
			onedit: function() {
				run_soon(do_options);
			},
			imu_enabled_exempt: true
		},
		settings_show_disabled: {
			name: "Show disabled options",
			description: "If disabled, options that are disabled due to their requirements being unmet will not be displayed",
			category: "general",
			subcategory: "settings",
			onedit: function() {
				run_soon(do_options);
			},
			imu_enabled_exempt: true
		},
		settings_show_requirements: {
			name: "Requirements below disabled options",
			description: "If an option is disabled, the requirements to enable the option will be displayed below it",
			category: "general",
			subcategory: "settings",
			onedit: function() {
				run_soon(do_options);
			},
			requires: {
				settings_show_disabled: true
			},
			imu_enabled_exempt: true
		},
		check_updates: {
			name: "Check for updates",
			description: "Periodically checks for updates. If a new update is available, it will be shown at the top of the options page",
			category: "general",
		},
		check_update_interval: {
			name: "Update check interval",
			description: "How often to check for updates",
			category: "general",
			requires: {
				check_updates: true
			},
			type: "number",
			number_min: 1,
			number_int: true,
			number_unit: "hours",
		},
		check_update_notify: {
			name: "Notify when update is available",
			description: "Creates a browser notification when an update is available",
			category: "general",
			requires: {
				check_updates: true
			},
			required_permission: "notifications"
		},
		advanced_options: {
			name: "Show advanced settings",
			description: "If disabled, settings that might be harder to understand will be hidden",
			category: "general",
			subcategory: "settings",
			onedit: function() {
				run_soon(do_options);
			},
			imu_enabled_exempt: true
		},
		settings_tabs: {
			name: "Use tabs",
			description: "If disabled, all settings will be shown on a single page",
			category: "general",
			subcategory: "settings",
			onedit: function() {
				run_soon(do_options);
			},
			imu_enabled_exempt: true
		},
		settings_alphabetical_order: {
			name: "Alphabetical order",
			description: "Lists options in alphabetical order",
			category: "general",
			subcategory: "settings",
			onedit: function() {
				run_soon(do_options);
			},
			imu_enabled_exempt: true
		},
		allow_browser_request: {
			name: "Allow using browser XHR",
			description: "This allows XHR requests to be run in the browser's context if they fail in the extension (e.g. when Tracking Protection is set to High)",
			category: "general",
			imu_enabled_exempt: true,
			advanced: true
		},
		retry_503_times: {
			name: "Retry requests with 503 errors",
			description: "Amount of times to retry a request when 503 (service unavailable) is returned by the server",
			category: "general",
			type: "number",
			number_min: 0,
			number_int: true,
			number_unit: "times",
			imu_enabled_exempt: true,
			advanced: true
		},
		retry_503_ms: {
			name: "Delay between 503 retries",
			description: "Time (in milliseconds) to delay between retrying requests that received 503",
			category: "general",
			type: "number",
			number_min: 0,
			number_int: true,
			number_unit: "ms",
			imu_enabled_exempt: true,
			advanced: true
		},
		use_blob_over_arraybuffer: {
			name: "Use `Blob` over `ArrayBuffer`",
			description: "Uses `Blob`s for XHRs instead of `ArrayBuffer`s. Keep this enabled unless your userscript manager doesn't support blob requests",
			category: "general",
			imu_enabled_exempt: true,
			advanced: true,
			hidden: true
		},
		allow_live_settings_reload: {
			name: "Live settings reloading",
			description: "Enables/disables live settings reloading. There shouldn't be a reason to disable this unless you're experiencing issues with this feature",
			category: "general",
			hidden: is_userscript && typeof GM_addValueChangeListener === "undefined",
			imu_enabled_exempt: true,
			advanced: true
		},
		disable_keybind_when_editing: {
			name: "Disable keybindings when editing text",
			description: "Disables IMU keybindings when key events are sent to an input area on the page",
			category: "general",
			imu_enabled_exempt: true,
			advanced: true
		},
		enable_gm_download: {
			name: "Use `GM_download` if available",
			description: "Prefers using `GM_download` over simple browser-based downloads, if the function is available. Some userscript managers download the entire file before displaying a save dialog, which can be undesirable for large video files",
			category: "general",
			userscript_only: true,
			imu_enabled_exempt: true,
			advanced: true
		},
		gm_download_max: {
			name: "Maximum size to `GM_download`",
			description: "If a file is larger than this size, use a simple browser-based download instead. Set to `0` for unlimited.",
			category: "general",
			userscript_only: true,
			imu_enabled_exempt: true,
			requires: {
				enable_gm_download: true
			},
			type: "number",
			number_min: 0,
			number_unit: "MB",
			advanced: true
		},
		enable_webextension_download: {
			name: "Force save dialog when downloading",
			description: "Tries to ensure the 'save as' dialog displays when downloading. This requires the 'downloads' permission to work, and will sometimes not work when custom headers are required.",
			category: "general",
			extension_only: true,
			imu_enabled_exempt: true,
			required_permission: "downloads"
		},
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
		redirect_extension: {
			name: "Do redirection in extension",
			description: "Performs the redirection in the extension instead of the content script. This is significantly faster and shouldn't cause issues in theory, but this option is kept in case of regressions",
			requires: {
				redirect: true
			},
			extension_only: true,
			advanced: true,
			category: "redirection"
		},
		canhead_get: {
			name: "Use GET if HEAD is unsupported",
			description: "Use a GET request to check an image's availability, if the server does not support HEAD requests",
			requires: {
				redirect: true
			},
			category: "redirection",
			advanced: true
		},
		redirect_force_page: {
			name: "Try finding original page/caption",
			description: "Enables methods that use API calls for finding the original page or caption",
			example_websites: [
				"Flickr",
				"SmugMug",
				"..."
			],
			category: "rules"
		},
		redirect_infobox_url: {
			name: "Show image URL in tooltip",
			description: "If the popup is needed to display the larger version of an image, display the image link in the tooltip",
			category: "redirection",
			requires: {
				redirect: true
			},
			userscript_only: true // tooltip isn't shown in the extension
		},
		redirect_infobox_timeout: {
			name: "Hide tooltip after",
			description: "Hides the tooltip after the specified number of seconds (or when the mouse clicks on it). Set to 0 to never hide automatically",
			requires: {
				redirect: true
			},
			type: "number",
			number_min: 0,
			number_unit: "seconds",
			category: "redirection",
			userscript_only: true // tooltip isn't shown in the extension
		},
		print_imu_obj: {
			name: "Log IMU object to console",
			description: "Prints the full IMU object to the console whenever a popup/redirect is found",
			category: "rules",
			advanced: true
		},
		redirect_disable_for_responseheader: {
			name: "Disable when response headers need modifying",
			description: "This option works around Chrome's migration to manifest v3, redirecting some images to being force-downloaded",
			extension_only: true,
			hidden: true, // Doesn't seem to be needed?
			category: "redirection",
			advanced: true
		},
		redirect_to_no_infobox: {
			name: "Redirect to largest without issues",
			description: "Redirects to the largest image found that doesn't require custom headers or forces download",
			userscript_only: true,
			category: "redirection"
		},
		mouseover: {
			name: "Enable mouseover popup",
			description: "Show a popup with the larger image when you mouseover an image with the trigger key held (if applicable)",
			category: "popup"
		},
		mouseover_open_behavior: {
			name: "Mouseover popup action",
			description: "Determines how the mouseover popup will open",
			// While it won't work for some images without the extension, let's not disable it outright either
			//extension_only: true,
			hidden: is_userscript && open_in_tab === common_functions.nullfunc,
			options: {
				_type: "or",
				_group1: {
					popup: {
						name: "Popup"
					}
				},
				_group2: {
					newtab: {
						name: "New tab"
					}
				},
				_group3: {
					download: {
						name: "Download"
					}
				}
			},
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
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
			category: "popup",
			subcategory: "trigger"
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
				},
				none: {
					name: "None",
					description: "Disables the popup from being triggered (useful if you only want to use the context menu item)",
					extension_only: true
				}
			},
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "trigger"
		},
		mouseover_trigger_key: {
			name: "Popup trigger key",
			description: "Key sequence to trigger the popup",
			type: "keysequence",
			requires: {
				mouseover: true,
				mouseover_trigger_behavior: "keyboard"
			},
			category: "popup",
			subcategory: "trigger"
		},
		mouseover_trigger_delay: {
			name: "Popup trigger delay",
			description: "Delay (in seconds) before the popup shows",
			requires: {
				mouseover: true,
				mouseover_trigger_behavior: "mouse"
			},
			type: "number",
			number_min: 0,
			number_unit: "seconds",
			category: "popup",
			subcategory: "trigger"
		},
		mouseover_trigger_mouseover: {
			name: "Use mouseover event",
			description: "Uses the mouseover event instead of mousemove to figure out where to trigger the popup. This more closely matches the way other image popup addons work, at the cost of configurability",
			requires: {
				mouseover_trigger_behavior: "mouse"
			},
			advanced: true,
			category: "popup",
			subcategory: "trigger"
		},
		mouseover_trigger_enabledisable_toggle: {
			name: "Enable/disable toggle",
			description: "Controls whether the 'Popup enable/disable key' will enable or disable the popup from opening",
			options: {
				enable: {
					name: "Enable"
				},
				disable: {
					name: "Disable"
				}
			},
			requires: {
				mouseover_trigger_behavior: "mouse"
			},
			category: "popup",
			subcategory: "trigger"
		},
		mouseover_trigger_prevent_key: {
			name: "Popup enable/disable key",
			description: "Holding down this key will enable or disable the popup from being opened, depending on the 'Enable/disable toggle' setting",
			requires: {
				mouseover: true,
				mouseover_trigger_behavior: "mouse"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "trigger"
		},
		mouseover_allow_partial: {
			name: "Allow showing partially loaded",
			description: "This will allow the popup to open for partially loaded media",
			description_userscript: "This will allow the popup to open for partially loaded media, but this might break some images",
			requires: {
				mouseover: true,
				mouseover_open_behavior: "popup"
			},
			options: {
				_type: "or",
				video: {
					name: "Video"
				},
				media: {
					name: "Media",
					description: "Both images and video"
				},
				none: {
					name: "None"
				}
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_partial_avoid_head: {
			name: "Avoid HEAD request for partially loaded media",
			description: "Avoids a possibly unnecessary HEAD request before displaying partially loaded images, which further decreases the delay before opening the popup. This can cause issues if the server returns an error, but still returns an image",
			requires: [
				{mouseover_allow_partial: "video"},
				{mouseover_allow_partial: "media"}
			],
			category: "popup",
			subcategory: "open_behavior",
			advanced: true
		},
		mouseover_use_blob_over_data: {
			name: "Use `blob:` over `data:` URLs",
			description: "Blob URLs are more efficient, but aren't supported by earlier browsers. Some websites also block `blob:` URLs",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "open_behavior",
			advanced: true
		},
		mouseover_use_fully_loaded_image: {
			name: "Wait until image is fully loaded",
			description: "Wait until the image has fully loaded before displaying it",
			requires: {
				mouseover: true,
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_use_fully_loaded_video: {
			name: "Wait until video is fully loaded",
			description: "Wait until the video has fully loaded before displaying it (this may significantly increase memory usage with larger videos)",
			requires: {
				mouseover: true,
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_enable_notallowed: {
			name: "Use `not-allowed` cursor when unsupported",
			description: "If the image isn't supported, the mouse cursor will change to a `not-allowed` cursor for a brief duration",
			requires: {
				mouseover_trigger_behavior: "keyboard"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_enable_notallowed_cant_load: {
			name: "Use `not-allowed` cursor when unable to load",
			description: "If the image fails to load, the mouse cursor will change to a `not-allowed` cursor for a brief duration",
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_notallowed_duration: {
			name: "`not-allowed` cursor duration",
			description: "How long the `not-allowed` cursor should last",
			requires: [
				{mouseover_enable_notallowed: true},
				{mouseover_enable_notallowed_cant_load: true}
			],
			type: "number",
			number_min: 0,
			number_int: true,
			number_unit: "ms",
			advanced: true,
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_exclude_page_bg: {
			name: "Exclude page background",
			description: "Excludes the page background for the popup",
			requires: {
				mouseover: true,
				mouseover_exclude_backgroundimages: false
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_minimum_size: {
			name: "Minimum image size",
			description: "Smallest size acceptable for the popup to open (this option is ignored for background images)",
			requires: {
				mouseover: true
			},
			type: "number",
			number_min: 0,
			number_unit: "pixels",
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_exclude_backgroundimages: {
			name: "Exclude `background-image`s",
			description: "Excludes `background-image`s for the popup. Might prevent the popup from working on many images",
			requires: {
				mouseover: true
			},
			disabled_if: {
				mouseover_trigger_mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_exclude_imagetab: {
			name: "Exclude image tabs",
			description: "Excludes images that are opened in their own tabs",
			requires: {
				mouseover: true,
				mouseover_trigger_behavior: "mouse"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_exclude_sameimage: {
			name: "Exclude if image URL is unchanged",
			description: "Don't pop up if the new image is the same as the thumbnail image",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_only_links: {
			name: "Only popup for linked images",
			description: "Don't pop up if the image isn't hyperlinked",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_linked_image: {
			name: "Popup link for linked images",
			description: "If the linked image cannot be made larger, pop up for the link instead of the image",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_exclude_imagemaps: {
			name: "Exclude image maps",
			description: "Don't pop up if the image is an image map (image with multiple clickable areas)",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_video_controls: {
			name: "Show video controls",
			description: "Shows native video controls. Note that this prevents dragging under Firefox",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_controls_key: {
			name: "Toggle video controls",
			description: "Key to toggle whether the video controls are shown",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_loop: {
			name: "Loop video",
			description: "Allows the video to automatically restart to the beginning after finishing playing",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			disabled_if: {
				mouseover_gallery_move_after_video: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_autoloop_max: {
			name: "Max duration for looping",
			description: "Videos longer than the specified duration will not be automatically looped. Setting this to `0` will always enable looping, regardless of duration.",
			requires: {
				mouseover_video_loop: true
			},
			type: "number",
			number_min: 0,
			number_unit: "seconds",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_playpause_key: {
			name: "Play/pause key",
			description: "Key to toggle whether the video is playing or paused",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_muted: {
			name: "Mute video",
			description: "Mutes the video by default",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_mute_key: {
			name: "Toggle mute key",
			description: "Key to toggle whether the video is muted or unmuted",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_volume: {
			name: "Default volume",
			description: "Default volume for the video",
			requires: {
				mouseover_video_muted: false
			},
			type: "number",
			number_min: 0,
			number_max: 100,
			number_int: true,
			number_unit: "%",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_volume_up_key: {
			name: "Volume up key",
			description: "Key to increase the volume for the video",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_volume_down_key: {
			name: "Volume down key",
			description: "Key to decrease the volume for the video",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_volume_change_amt: {
			name: "Volume change amount",
			description: "Percent for volume to increase/decrease when using the volume up/down keys",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "number",
			number_min: 0,
			number_max: 100,
			number_int: true,
			number_unit: "%",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_resume_from_source: {
			name: "Resume playback from source",
			description: "If enabled, playback will resume from where the source video left off",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_resume_if_different: {
			name: "Resume if different length",
			description: "If disabled, it will not resume if the source video has a different length from the video in the popup (e.g. from a preview video to a full one)",
			requires: {
				mouseover_video_resume_from_source: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_pause_source: {
			name: "Pause source video",
			description: "Pauses the source video once the popup has opened",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_seek_amount: {
			name: "Seek amount",
			description: "Amount of time to seek forward/back when using the seek keys",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "number",
			number_min: 0,
			number_unit: "seconds",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_seek_left_key: {
			name: "Seek left key",
			description: "Key to seek backwards in a video by the specified amount",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_seek_right_key: {
			name: "Seek right key",
			description: "Key to seek forwards in a video by the specified amount",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_seek_vertical_scroll: {
			name: "Vertical scroll seeks",
			description: "Scrolling vertically will seek the video forward/backward",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_seek_horizontal_scroll: {
			name: "Horizontal scroll seeks",
			description: "Scrolling horizontally will seek the video forward/backward",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_frame_prev_key: {
			name: "Previous frame key",
			description: "Rewinds the video one \"frame\" backward. Due to current limitations, the frame size is static (but configurable), and might not match the video's framerate",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_frame_next_key: {
			name: "Next frame key",
			description: "Advances the video one \"frame\" forward. Due to current limitations, the frame size is static (but configurable), and might not match the video's framerate",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_framerate: {
			name: "Frame rate",
			description: "Frame rate for videos to seek forward/back with the next/previous frame keys",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "number",
			number_min: 0,
			number_unit: "FPS",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_speed_down_key: {
			name: "Speed down key",
			description: "Key to speed the video down by a specified amount",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_speed_up_key: {
			name: "Speed up key",
			description: "Key to speed the video up by a specified amount",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_speed_amount: {
			name: "Speed up/down amount",
			description: "How many times faster/slower to speed the video up/down",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "number",
			number_min: 0,
			number_unit: "x",
			category: "popup",
			subcategory: "video"
		},
		mouseover_video_reset_speed_key: {
			name: "Reset speed key",
			description: "Resets the video playback to normal speed",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "video"
		},
		mouseover_ui: {
			name: "Popup UI",
			description: "Enables a UI on top of the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_opacity: {
			name: "Opacity",
			description: "Opacity of the UI on top of the popup",
			requires: {
				mouseover_ui: true
			},
			type: "number",
			number_unit: "%",
			number_max: 100,
			number_min: 0,
			number_int: true,
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_use_safe_glyphs: {
			name: "Use safe glyphs",
			description: "Uses glyphs that are more likely to be available on all fonts. Enable this option if the following characters render as boxes: \uD83E\uDC47 \ud83e\udc50 \ud83e\udc52",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_imagesize: {
			name: "Media resolution",
			description: "Displays the original media dimensions on top of the UI.\nCSS ID: `#sizeinfo`",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_zoomlevel: {
			name: "Zoom percent",
			description: "Displays the current zoom level on top of the UI.\nCSS ID: `#sizeinfo`",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_filesize: {
			name: "File size",
			description: "Displays the media's file size on top of the UI. For the moment, this will not work with partially loaded media if 'Avoid HEAD request for partially loaded media' is enabled.\nCSS ID: `#sizeinfo`",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_gallerycounter: {
			name: "Gallery counter",
			description: "Enables a gallery counter on top of the UI.\nCSS ID: `#gallerycounter`",
			requires: {
				mouseover_ui: true,
				mouseover_enable_gallery: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_gallerymax: {
			name: "Gallery counter max",
			description: "Maximum amount of images to check in the counter (this can be slightly CPU-intensive)",
			requires: {
				mouseover_ui_gallerycounter: true,
				mouseover_enable_gallery: true
			},
			type: "number",
			number_min: 0,
			number_unit: "images",
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_gallerybtns: {
			name: "Gallery buttons",
			description: "Enables buttons to go left/right in the gallery.\nCSS IDs: `#galleryprevbtn`, `#gallerynextbtn`",
			requires: {
				mouseover_ui: true,
				mouseover_enable_gallery: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_closebtn: {
			name: "Close Button",
			description: "Enables a button to close the popup.\nCSS ID: `#closebtn`",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_optionsbtn: {
			name: "Options Button",
			description: "Enables a button to go to this page.\nCSS ID: `#optionsbtn`",
			requires: {
				mouseover_ui: true
			},
			// While it works for the extension, it's more or less useless
			userscript_only: true,
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_downloadbtn: {
			name: "Download Button",
			description: "Enables a button to download the image.\nCSS ID: `#downloadbtn`",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_rotationbtns: {
			name: "Rotation Buttons",
			description: "Enables buttons on the UI to rotate the image by 90 degrees.\nCSS IDs: `#rotleftbtn`, `#rotrightbtn`",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_caption: {
			name: "Caption",
			description: "Shows the image's caption (if available) at the top.\nCSS ID: `#caption`",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_wrap_caption: {
			name: "Wrap caption text",
			description: "Wraps the caption if it's too long",
			requires: {
				mouseover_ui_caption: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_caption_link_page: {
			name: "Link original page in caption",
			description: "Links the original page (if it exists) in the caption",
			requires: {
				mouseover_ui_caption: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_ui_link_underline: {
			name: "Underline links",
			description: "Adds an underline to links (such as the original page)",
			requires: {
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
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
				mouseover_open_behavior: "popup",
				mouseover_trigger_behavior: "keyboard"
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_close_need_mouseout: {
			name: "Don't close until mouse leaves",
			description: "If true, this keeps the popup open even if all triggers are released if the mouse is still over the image",
			requires: [
				{mouseover_close_behavior: "any"},
				{mouseover_close_behavior: "all"}
			],
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_jitter_threshold: {
			name: "Threshold to leave image",
			description: "How many pixels outside of the image before the cursor is considered to have left the image",
			requires: [
				{
					mouseover_open_behavior: "popup",
					mouseover_close_need_mouseout: true
				},
				{
					mouseover_open_behavior: "popup",
					mouseover_trigger_behavior: "mouse"
				}
			],
			type: "number",
			number_unit: "pixels",
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_cancel_popup_when_elout: {
			name: "Leaving thumbnail cancels loading",
			description: "Cancels the current popup loading when the cursor has left the thumbnail image",
			requires: {
				mouseover: true,
				mouseover_trigger_behavior: "mouse"
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_cancel_popup_with_esc: {
			name: "ESC cancels loading",
			description: "Cancels the current popup loading if ESC is pressed",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_cancel_popup_when_release: {
			name: "Releasing triggers cancels loading",
			description: "Cancels the current popup loading if all/any triggers are released (as set by the \"Keep popup open until\" setting)",
			requires: [
				{mouseover_close_behavior: "any"},
				{mouseover_close_behavior: "all"}
			],
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_auto_close_popup: {
			name: "Automatically close after timeout",
			description: "Closes the popup automatically after a specified period of time has elapsed",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_auto_close_popup_time: {
			name: "Timeout to close popup",
			description: "Amount of time to elapse before automatically closing the popup",
			requires: {
				mouseover_auto_close_popup: true
			},
			type: "number",
			number_min: 0,
			number_unit: "seconds",
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_use_hold_key: {
			name: "Use hold key",
			description: "Enables the use of a hold key that, when pressed, will keep the popup open",
			requires: [
				{
					mouseover_trigger_behavior: "mouse",
					mouseover_open_behavior: "popup"
				},
				{
					mouseover_auto_close_popup: true,
					mouseover_open_behavior: "popup"
				},
				{
					mouseover_close_need_mouseout: true,
					mouseover_open_behavior: "popup"
				},
			],
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_hold_key: {
			name: "Hold key",
			description: "Hold key that, when pressed, will keep the popup open",
			requires: {
				mouseover_use_hold_key: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_hold_position_center: {
			name: "Center popup on hold",
			description: "Centers the popup to the middle of the page when the popup is held",
			requires: {
				mouseover_use_hold_key: true
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_hold_close_unhold: {
			name: "Close popup on unhold",
			description: "Closes the popup when the hold key is pressed again, after having previously held the popup",
			requires: {
				mouseover_use_hold_key: true
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_hold_unclickthrough: {
			name: "Enable pointer events on hold",
			description: "Enables previously disabled pointer events when the popup is held",
			requires: {
				mouseover_use_hold_key: true,
				mouseover_clickthrough: true
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_close_on_leave_el: {
			name: "Close when leaving thumbnail",
			description: "Closes the popup when the mouse leaves the thumbnail element (won't close if the mouse instead moves to the popup)",
			requires: {
				mouseover_open_behavior: "popup",
				mouseover_trigger_behavior: "mouse",
				mouseover_position: "beside_cursor"
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_close_click_outside: {
			name: "Clicking outside the popup closes",
			description: "Closes the popup when the mouse clicks outside of it",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_close_el_policy: {
			name: "Close when leaving",
			description: "Closes the popup when the mouse leaves the thumbnail element, the popup, or both",
			requires: [
				{
					mouseover_open_behavior: "popup",
					mouseover_trigger_behavior: "mouse"
				},
				{
					mouseover_open_behavior: "popup",
					mouseover_trigger_behavior: "keyboard",
					mouseover_close_need_mouseout: true
				}
			],
			options: {
				_type: "or",
				thumbnail: {
					name: "Thumbnail"
				},
				popup: {
					name: "Popup"
				},
				both: {
					name: "Both"
				}
			},
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_wait_use_el: {
			name: "Use invisible element when waiting",
			description: "Creates an invisible element under the cursor when waiting for the popup instead of a style element (can improve performance on websites with many elements, but prevents the cursor from clicking anything while loading the popup)",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "popup_other",
			advanced: true
		},
		mouseover_add_to_history: {
			name: "Add popup link to history",
			description: "Adds the image/video link opened through the popup to the browser's history",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "popup_other",
			required_permission: "history",
			extension_only: true
		},
		allow_remote: {
			name: "Allow inter-frame communication",
			description: "Allows communication between frames in windows, improving support for keybindings",
			description_userscript: "Allows communication between frames in windows, improving support for keybindings. Can pose a fingerprinting risk when used through the userscript",
			requires: {
				mouseover: true
			},
			category: "general"
		},
		mouseover_use_remote: {
			name: "Pop out of frames",
			description: "Opens the popup on the top frame instead of within iframes. Still in beta",
			requires: {
				mouseover_open_behavior: "popup",
				allow_remote: true
			},
			category: "popup",
			subcategory: "open_behavior"
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
					fill: {
						name: "Fill screen"
					}
				},
				_group3: {
					full: {
						name: "Full size"
					}
				},
				_group4: {
					custom: {
						name: "Custom size"
					}
				}
			},
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_zoom_custom_percent: {
			name: "Custom zoom percent",
			description: "Custom percent to initially size the popup",
			type: "number",
			number_min: 0,
			number_unit: "%",
			requires: {
				mouseover_zoom_behavior: "custom"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_zoom_max_width: {
			name: "Maximum width",
			description: "Maximum width for the initial popup size. Set to `0` for unlimited.",
			type: "number",
			number_min: 0,
			number_unit: "px",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_zoom_max_height: {
			name: "Maximum height",
			description: "Maximum height for the initial popup size. Set to `0` for unlimited.",
			type: "number",
			number_min: 0,
			number_unit: "px",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "open_behavior"
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
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_movement_inverted: {
			name: "Invert movement",
			description: "Inverts the movement of the mouse. For example, if the mouse moves left, the popup moves right. If disabled, it feels more like the popup is being invisibly dragged.",
			requires: {
				mouseover_pan_behavior: "movement"
			},
			// It's doubtful many users will want this option enabled
			advanced: true,
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_drag_min: {
			name: "Minimum drag amount",
			description: "How many pixels the mouse should move to start a drag",
			type: "number",
			number_min: 0,
			number_int: true,
			number_unit: "pixels",
			requires: {
				mouseover_pan_behavior: "drag"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_scrolly_behavior: {
			name: "Vertical scroll action",
			description: "How the popup reacts to a vertical scroll/mouse wheel event",
			options: {
				_type: "or",
				_group1: {
					zoom: {
						name: "Zoom"
					},
					pan: {
						name: "Pan"
					},
					gallery: {
						name: "Gallery",
						requires: [{
							mouseover_enable_gallery: true
						}]
					}
				},
				_group2: {
					nothing: {
						name: "None"
					}
				}
			},
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_scrollx_behavior: {
			name: "Horizontal scroll action",
			description: "How the popup reacts to a horizontal scroll/mouse wheel event",
			options: {
				_type: "or",
				_group1: {
					pan: {
						name: "Pan"
					},
					gallery: {
						name: "Gallery",
						requires: [{
							mouseover_enable_gallery: true
						}]
					},
					nothing: {
						name: "None"
					}
				}
			},
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_scrolly_video_behavior: {
			name: "Vertical video scroll action",
			description: "Overrides the vertical scroll action for videos. Set to `Default` to avoid overriding the behavior.",
			options: {
				_type: "combo",
				default: {
					name: "Default"
				},
				seek: {
					name: "Seek"
				},
				nothing: {
					name: "None"
				}
			},
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_scrolly_video_invert: {
			name: "Invert vertical scroll seek",
			description: "Inverts the seek direction when scrolling vertically: Scrolling up will seek right, scrolling down will seek left.",
			requires: {
				mouseover_scrolly_video_behavior: "seek"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_scrollx_video_behavior: {
			name: "Horizontal video scroll action",
			description: "Overrides the horizontal scroll action for videos. Set to `Default` to avoid overriding the behavior.",
			options: {
				_type: "combo",
				default: {
					name: "Default"
				},
				seek: {
					name: "Seek"
				},
				nothing: {
					name: "None"
				}
			},
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		scroll_override_page: {
			name: "Override scroll outside of popup",
			description: "Scroll events performed outside of the popup are still acted on",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		scroll_zoom_origin: {
			name: "Zoom origin",
			description: "The point on the image it's zoomed in/out from",
			options: {
				_type: "or",
				cursor: {
					name: "Cursor"
				},
				center: {
					name: "Center"
				}
			},
			requires: [
				{mouseover_scrollx_behavior: "zoom"},
				{mouseover_scrolly_behavior: "zoom"}
			],
			category: "popup",
			subcategory: "behavior"
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
			requires: [
				{mouseover_scrollx_behavior: "zoom"},
				{mouseover_scrolly_behavior: "zoom"}
			],
			category: "popup",
			subcategory: "behavior"
		},
		scroll_incremental_mult: {
			name: "Incremental zoom multiplier",
			description: "How much to zoom in/out by (for incremental zooming)",
			type: "number",
			number_min: 1,
			number_unit: "x",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_move_with_cursor: {
			name: "Move with cursor",
			description: "Moves the popup as the cursor moves",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_move_within_page: {
			name: "Move within page",
			description: "Ensures the popup doesn't leave the page",
			requires: {
				mouseover_move_with_cursor: true
			},
			category: "popup",
			subcategory: "behavior"
		},
		zoom_out_to_close: {
			name: "Zoom out fully to close",
			description: "Closes the popup if you zoom out past the minimum zoom",
			requires: [
				{mouseover_scrollx_behavior: "zoom"},
				{mouseover_scrolly_behavior: "zoom"}
			],
			category: "popup",
			subcategory: "close_behavior"
		},
		mouseover_position: {
			name: "Popup position",
			description: "Where the popup will appear",
			options: {
				_type: "or",
				_group1: {
					cursor: {
						name: "Cursor middle",
						description: "Underneath the mouse cursor"
					}
				},
				_group2: {
					beside_cursor: {
						name: "Beside cursor"
					}
				},
				_group3: {
					center: {
						name: "Page middle"
					}
				}
			},
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_prevent_cursor_overlap: {
			name: "Prevent cursor overlap",
			description: "Prevents the image from overlapping with the cursor",
			requires: {
				mouseover_position: "beside_cursor"
			},
			hidden: true, // no longer applicable with new beside_cursor implementation
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_hide_cursor: {
			name: "Hide cursor over popup",
			description: "Hides the cursor when the mouse is over the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_hide_cursor_after: {
			name: "Hide cursor after",
			description: "Hides the cursor over the popup after a specified period of time (in milliseconds), 0 always hides the cursor",
			requires: {
				mouseover_hide_cursor: true
			},
			type: "number",
			number_unit: "ms",
			number_int: true,
			number_min: 0,
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_mouse_inactivity_jitter: {
			name: "Mouse jitter threshold",
			description: "Threshold for mouse movement before the mouse cursor is shown again, 0 always shows the cursor after any movement",
			requires: {
				mouseover_hide_cursor: true
			},
			type: "number",
			number_unit: "px",
			number_int: true,
			number_min: 0,
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_clickthrough: {
			name: "Disable pointer events",
			description: "Enabling this option will allow you to click on links underneath the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_add_link: {
			name: "Link image",
			description: "Adds a link to the image in the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_add_video_link: {
			name: "Link video",
			description: "Adds a link to the video in the popup",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true
			},
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_click_image_close: {
			name: "Clicking image closes",
			description: "Clicking the popup image closes the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			disabled_if: [
				{mouseover_add_link: true},
				{mouseover_clickthrough: true}
			],
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_click_video_close: {
			name: "Clicking video closes",
			description: "Clicking the popup video closes the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			disabled_if: [
				{mouseover_add_video_link: true},
				{mouseover_clickthrough: true}
			],
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_download: {
			name: "Clicking link downloads",
			description: "Instead of opening the link in a new tab, it will download the image/video instead",
			requires: [
				{
					mouseover_open_behavior: "popup",
					mouseover_add_link: true
				},
				{
					mouseover_open_behavior: "popup",
					mouseover_add_video_link: true
				},
			],
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_close_key: {
			name: "Close key",
			description: "Closes the popup when this key is pressed. Currently, ESC will also close the popup regardless of the value of this setting.",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_download_key: {
			name: "Download key",
			description: "Downloads the image in the popup when this key is pressed",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_open_new_tab_key: {
			name: "Open in new tab key",
			description: "Opens the image in the popup in a new tab when this key is pressed",
			hidden: is_userscript && open_in_tab === common_functions.nullfunc,
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_open_bg_tab_key: {
			name: "Open in background tab key",
			description: "Opens the image in the popup in a new tab without switching to it when this key is pressed",
			hidden: is_userscript && open_in_tab === common_functions.nullfunc,
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_open_options_key: {
			name: "Open options key",
			description: "Opens this page in a new tab when this key is pressed",
			hidden: is_userscript && open_in_tab === common_functions.nullfunc,
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_open_orig_page_key: {
			name: "Open original page key",
			description: "Opens the original page (if available) when this key is pressed",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_rotate_left_key: {
			name: "Rotate left key",
			description: "Rotates the popup 90 degrees to the left",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_rotate_right_key: {
			name: "Rotate right key",
			description: "Rotates the popup 90 degrees to the right",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_flip_horizontal_key: {
			name: "Horizontal flip key",
			description: "Flips the image horizontally",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_flip_vertical_key: {
			name: "Vertical flip key",
			description: "Flips the image vertically",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_zoom_in_key: {
			name: "Zoom in key",
			description: "Incrementally zooms into the image",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_zoom_out_key: {
			name: "Zoom out key",
			description: "Incrementally zooms out of the image",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_zoom_full_key: {
			name: "Full zoom key",
			description: "Sets the image to be at a 100% zoom, even if it overflows the screen",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_zoom_fit_key: {
			name: "Fit screen key",
			description: "Sets the image to either be at a 100% zoom, or to fit the screen, whichever is smaller",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_fullscreen_key: {
			name: "Toggle fullscreen key",
			description: "Toggles fullscreen mode for the image/video in the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			type: "keysequence",
			category: "popup",
			subcategory: "behavior"
		},
		mouseover_links: {
			name: "Popup for plain hyperlinks",
			description: "Whether or not the popup should also open for plain hyperlinks",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_only_valid_links: {
			name: "Only for links that look valid",
			description: "Enabling this option will only allow links to be popped up if they look valid (such as if they have a known image/video extension, or are explicitly supported)",
			requires: {
				mouseover_links: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_allow_iframe_el: {
			name: "Popup for `<iframe>`",
			description: "Allows `<iframe>` elements to be popped up as well. Storing images/videos in this way is rather uncommon, but it can allow embeds to be supported",
			requires: {
				mouseover_links: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_allow_canvas_el: {
			name: "Popup for `<canvas>`",
			description: "Allows `<canvas>` elements to be popped up as well. This will likely cause popups with any kind of web-based games, so it's recommended to keep this disabled",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_allow_svg_el: {
			name: "Popup for `<svg>`",
			description: "Allows `<svg>` elements to be popped up as well. These are usually used for icons, and can occasionally cause problems for websites that overlay icons on top of images",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_enable_gallery: {
			name: "Enable gallery",
			description: "Toggles whether gallery detection support should be enabled",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "gallery"
		},
		mouseover_gallery_cycle: {
			name: "Cycle gallery",
			description: "Going to the previous image for the first image will lead to the last image and vice-versa",
			requires: {
				mouseover_open_behavior: "popup",
				mouseover_enable_gallery: true
			},
			category: "popup",
			subcategory: "gallery"
		},
		mouseover_gallery_prev_key: {
			name: "Previous gallery item",
			description: "Key to trigger the previous gallery item",
			requires: {
				mouseover_open_behavior: "popup",
				mouseover_enable_gallery: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "gallery"
		},
		mouseover_gallery_next_key: {
			name: "Next gallery item",
			description: "Key to trigger the next gallery item",
			requires: {
				mouseover_open_behavior: "popup",
				mouseover_enable_gallery: true
			},
			type: "keysequence",
			category: "popup",
			subcategory: "gallery"
		},
		mouseover_gallery_move_after_video: {
			name: "Move to next when video finishes",
			description: "Moves to the next gallery item when a video finishes playing",
			requires: {
				mouseover_open_behavior: "popup",
				allow_video: true,
				mouseover_enable_gallery: true
			},
			category: "popup",
			subcategory: "gallery"
		},
		mouseover_styles: {
			name: "Popup CSS style",
			description: "Custom CSS styles for the popup",
			documentation: {
				title: "Documentation",
				value: [
					"Most valid CSS is supported, with these differences:",
					"<ul><li>Multiline comments (<code>/* ... */</code>) are currently not supported</li>",
					"<li>Single comments (<code>// ...</code>) are supported, but only at the beginning of a line</li>",
					"<li><code>%thumburl%</code> is the URL of the thumbnail image. For example, you could use it like this: <code>background-image: url(%thumburl%)</code><br />",
					"The URL is properly encoded, so quotes are not necessary (but not harmful either)</li>",
					"<li><code>%fullurl%</code> is the URL of the full image. If IMU fails to find a larger image, it will be the same as <code>%thumburl%</code></li>",
					"<li>Styles are <code>!important</code> by default</li></ul>",
					"<p>For Button CSS style, you can also customize the CSS for individual buttons through their IDs. For example:</p>",
					"<pre>",
					"#closebtn {",
					"  background-color: red;",
					"  // -imu-text allows you to set the text inside the button",
					"  -imu-text: \"Close\";",
					"}",
					"#galleryprevbtn, #gallerynextbtn {",
					"  border-radius: 100px;",
					"}",
					"</pre>"
				].join("\n")
			},
			type: "textarea",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_enable_fade: {
			name: "Enable popup fade",
			description: "Enables a fade in/out effect when the popup is opened/closed",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_enable_zoom_effect: {
			name: "Enable zoom effect",
			description: "Toggles whether the popup should 'zoom' when opened/closed",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_zoom_effect_move: {
			name: "Move from thumbnail when zooming",
			description: "Moves the popup from the thumbnail to the final location while zooming. The animation can be a little rough",
			requires: {
				mouseover_enable_zoom_effect: true
			},
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_fade_time: {
			name: "Popup animation time",
			description: "Fade/zoom animation duration (in milliseconds) for the popup",
			requires: [
				{mouseover_enable_fade: true},
				{mouseover_enable_zoom_effect: true}
			],
			type: "number",
			number_min: 0,
			number_unit: "ms",
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_enable_mask_styles: {
			name: "Enable background CSS",
			description: "Toggles whether CSS styles for the background when the popup is active is enabled",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_mask_styles2: {
			name: "Background CSS style",
			description: "CSS style for the background when the popup is active. See the documentation for Popup CSS style for more information (the thumb/full URL variables aren't supported here)",
			requires: {
				mouseover_open_behavior: "popup",
				mouseover_enable_mask_styles: true
			},
			type: "textarea",
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_mask_fade_time: {
			name: "Background fade",
			description: "Fade in/out time (in milliseconds) for the page background, set to 0 to disable",
			requires: {
				mouseover_open_behavior: "popup",
				mouseover_enable_mask_styles: true
			},
			type: "number",
			number_min: 0,
			number_unit: "ms",
			category: "popup",
			subcategory: "popup_other"
		},
		mouseover_ui_styles: {
			name: "Button CSS style",
			description: "Custom CSS styles for the popup's UI buttons. See the documentation for Popup CSS style for more information (the thumb/full URL variables aren't supported here)",
			type: "textarea",
			requires: {
				mouseover_open_behavior: "popup",
				mouseover_ui: true
			},
			category: "popup",
			subcategory: "ui"
		},
		mouseover_apply_blacklist: {
			name: "Don't popup blacklisted images",
			description: "This option prevents a popup from appearing altogether for blacklisted images",
			requires: {
				mouseover: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		apply_blacklist_host: {
			name: "Apply blacklist for host websites",
			description: "This option prevents the script from applying any popups to host websites that are in the blacklist. For example, adding `twitter.com` to the blacklist would prevent any popup from opening on twitter.com. If disabled, this option only applies to image URLs (such as twimg.com), not host URLs",
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_matching_media_types: {
			name: "Don't popup video for image",
			description: "This option prevents the popup from loading a video when the source was an image. Vice-versa is also applied",
			requires: {
				mouseover: true,
				allow_video: true
			},
			category: "popup",
			subcategory: "open_behavior"
		},
		mouseover_support_pointerevents_none: {
			name: "Support `pointer-events:none`",
			description: "Manually looks through every element on the page to see if the cursor is beneath them. Supports more images, but also results in a higher CPU load for websites such as Facebook.",
			requires: {
				mouseover: true
			},
			//advanced: true, // Commenting this out because the option is important
			category: "popup",
			subcategory: "open_behavior"
		},
		popup_allow_cache: {
			name: "Use cache",
			description: "Allows use of a media cache for the popup",
			requires: {
				mouseover_open_behavior: "popup"
			},
			category: "popup",
			subcategory: "cache"
		},
		popup_cache_duration: {
			name: "Cache duration",
			description: "How long for media to remain cached. Set to `0` for unlimited.",
			requires: {
				popup_allow_cache: true
			},
			type: "number",
			number_min: 0,
			number_unit: "minutes",
			category: "popup",
			subcategory: "cache"
		},
		popup_cache_itemlimit: {
			name: "Cache item limit",
			description: "Maximum number of individual media to remain cached. Set to `0` for unlimited.",
			requires: {
				popup_allow_cache: true
			},
			type: "number",
			number_min: 0,
			number_unit: "items",
			category: "popup",
			subcategory: "cache"
		},
		popup_cache_resume_video: {
			name: "Resume videos",
			description: "If a video popup was closed then reopened, the video will resume from where it left off",
			requires: {
				popup_allow_cache: true
			},
			category: "popup",
			subcategory: "cache"
		},
		website_inject_imu: {
			name: "Use userscript",
			description: "Replaces the website's IMU instance with the userscript",
			userscript_only: true,
			category: "website"
		},
		website_image: {
			name: "Website image preview",
			description: "Enables a preview of the image on the Image Max URL website",
			userscript_only: true,
			requires: {
				website_inject_imu: true
			},
			category: "website"
		},
		extension_contextmenu: {
			name: "IMU entry in context menu",
			description: "Enables a custom entry for this extension in the right click/context menu",
			extension_only: true,
			category: "extension",
			imu_enabled_exempt: true
		},
		allow_video: {
			name: "Videos",
			description: "Allows videos to be returned",
			category: "rules",
			onupdate: update_rule_setting
		},
		allow_dash_video: {
			name: "Allow DASH videos",
			description: "Allows playback of DASH video streams. Some videos may not work with other websites due to hotlinking protection.",
			description_userscript: "Allows playback of DASH video streams. Some videos may not work with other websites due to hotlinking protection, and it may even break video playback for some websites. Use with caution.",
			category: "rules",
			requires: {
				allow_thirdparty_libs: true
			}
		},
		allow_hls_video: {
			name: "Allow HLS videos",
			description: "Allows playback of HLS video streams. Some videos may not work with other websites due to hotlinking protection.",
			description_userscript: "Allows playback of HLS video streams. Some videos may not work with other websites due to hotlinking protection, and it may even break video playback for some websites. Use with caution.",
			category: "rules",
			requires: {
				allow_thirdparty_libs: true
			}
		},
		custom_xhr_for_lib: {
			name: "Custom XHR for libraries",
			description: "Allows the use of more powerful XHR for 3rd-party libraries. This allows for certain DASH streams to work.",
			description_userscript: "Allows the use of more powerful XHR for 3rd-party libraries. This allows for certain DASH streams to work. Using this with the userscript version currently poses a potential security risk.",
			category: "rules",
			example_websites: [
				"Kakao"
			],
			requires: {
				allow_thirdparty_libs: true
			},
			advanced: true,
			needrefresh: true // todo: clear the library cache (or only for xhr ones)
		},
		hls_dash_use_max: {
			name: "HLS/DASH maximum quality",
			description: "Uses the maximum quality for HLS/DASH videos",
			requires: [
				{allow_dash_video: true},
				{allow_hls_video: true}
			],
			category: "rules"
		},
		max_video_quality: {
			name: "Maximum video quality",
			description: "Maximum quality for videos",
			requires: {
				allow_video: true
			},
			options: {
				_type: "combo",
				"unlimited": {
					name: "(unlimited)",
					is_null: true
				},
				// h prefix is important to keep the order
				"h2160": {
					name: "4K"
				},
				"h1440": {
					name: "1440p"
				},
				"h1080": {
					name: "1080p"
				},
				"h720": {
					name: "720p"
				},
				"h480": {
					name: "480p"
				}
			},
			category: "rules"
		},
		allow_watermark: {
			name: "Larger watermarked images",
			description: "Enables rules that return larger images that include watermarks",
			category: "rules",
			example_websites: [
				"Stock photo websites"
			],
			onupdate: update_rule_setting
		},
		allow_smaller: {
			name: "Smaller non-watermarked images",
			description: "Enables rules that return smaller images without watermarks",
			category: "rules",
			onupdate: update_rule_setting
		},
		allow_possibly_different: {
			name: "Possibly different images",
			description: "Enables rules that return images that possibly differ",
			category: "rules",
			example_websites: [
				"YouTube video thumbnails"
			],
			hidden: true, // not currently used
			onupdate: update_rule_setting
		},
		allow_possibly_broken: {
			name: "Possibly broken images",
			description: "Enables rules that return images that are possibly broken",
			category: "rules",
			hidden: true, // not currently used
			onupdate: update_rule_setting
		},
		allow_possibly_upscaled: {
			name: "Possibly upscaled images",
			description: "Enables rules that return images that are possibly upscaled",
			category: "rules",
			onupdate: update_rule_setting
		},
		allow_thirdparty: {
			name: "Rules using 3rd-party websites",
			description: "Enables rules that use 3rd-party websites",
			category: "rules",
			example_websites: [
				"Newsen"
			],
			onupdate: update_rule_setting
		},
		allow_apicalls: {
			name: "Rules using API calls",
			description: "Enables rules that use API calls. Strongly recommended to keep this enabled",
			category: "rules",
			example_websites: [
				"Instagram",
				"Flickr",
				"..."
			],
			onupdate: update_rule_setting
		},
		allow_thirdparty_libs: {
			name: "Rules using 3rd-party libraries",
			description: "Enables rules that use 3rd-party libraries",
			description_userscript: "Enables rules that use 3rd-party libraries. There is a possible (but unlikely) security risk for the userscript version",
			category: "rules",
			example_websites: [
				"Sites using testcookie (slowAES)"
			],
			onupdate: function() {
				update_rule_setting();
				real_api_cache.clear();
			}
		},
		allow_thirdparty_code: {
			name: "Rules executing 3rd-party code",
			description: "Enables rules that execute arbitrary 3rd-party code stored on websites.",
			warning: {
				"true": "This could lead to security risks, please be careful when using this option!"
			},
			category: "rules",
			onupdate: function() {
				update_rule_setting();
				real_api_cache.clear();
			},
			hidden: true // not currently used
		},
		allow_bruteforce: {
			name: "Rules using brute-force",
			description: "Enables rules that require using brute force (through binary search) to find the original image",
			warning: {
				"true": "This could lead to rate limiting or IP bans"
			},
			category: "rules",
			example_websites: [
				"Deezer"
			],
			onupdate: update_rule_setting
		},
		browser_cookies: {
			name: "Use browser cookies",
			description: "Uses the browser's cookies for API calls in order to access otherwise private data",
			category: "rules",
			example_websites: [
				"Private Flickr images"
			],
			// Until GM_Cookie is implemented
			extension_only: true,
			onupdate: update_rule_setting
		},
		deviantart_prefer_size: {
			name: "DeviantART: Prefer size over original",
			description: "Prefers a larger (but not upscaled) thumbnail image over a smaller original animated image",
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		deviantart_support_download: {
			name: "DeviantART: Use download links",
			description: "Prefers using the download link (if available) by default",
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		imgur_filename: {
			name: "Imgur: Use original filename",
			description: "If the original filename (the one used to upload the image) is found, use it instead of the image ID",
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		imgur_source: {
			name: "Imgur: Use source image",
			description: "If a source image is found for Imgur, try using it instead. Only works for old-style Imgur webpages (set `postpagebeta=0; postpagebetalogged=0` as cookies)",
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		instagram_use_app_api: {
			name: "Instagram: Use native API",
			description: "Uses Instagram's native API if possible, requires you to be logged into Instagram",
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		instagram_dont_use_web: {
			name: "Instagram: Don't use web API",
			description: "Avoids using Instagram's web API if possible, which increases performance, but will occasionally sacrifice quality for videos",
			requires: [{instagram_use_app_api: true}],
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		instagram_gallery_postlink: {
			name: "Instagram: Use albums for post thumbnails",
			description: "Queries Instagram for albums when using the popup on a post thumbnail",
			category: "rules",
			subcategory: "rule_specific"
		},
		snapchat_orig_media: {
			name: "Snapchat: Use original media without captions",
			description: "Prefers using original media instead of media with captions and tags overlayed",
			category: "rules",
			subcategory: "rule_specific"
		},
		tiktok_no_watermarks: {
			name: "TikTok: Don't use watermarked videos",
			description: "Uses non-watermarked videos for TikTok if possible. This will introduce an extra delay when loading the video as two extra requests need to be performed. It will also fail for any videos uploaded after ~late July 2020",
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		tiktok_thirdparty: {
			name: "TikTok: 3rd-party watermark removal",
			description: "Uses a 3rd-party watermark removal site for TikTok.\nI do not endorse any of the sites supported. They may log your IP address and videos you submit. Use this option with caution.\n`LQ` = Low quality, `PL` = Public log",
			requires: [{
				allow_thirdparty: true
			}],
			options: {
				_type: "combo",
				_randomize: true,
				"null": {
					name: "(none)",
					is_null: true
				},
				"ttloader.com:ttt": {
					name: "ttloader.com"
				},
				"onlinetik.com:ttt": {
					name: "onlinetik.com"
				},
				"tiktokdownloader.in:ttt": {
					name: "tiktokdownloader.in"
				},
				"savevideo.ninja:ttt": {
					name: "savevideo.ninja"
				},
				// removing watermark doesn't work
				"keeptiktok.com": {
					name: "keeptiktok.com (LQ)"
				},
				"ssstiktok.io:1": {
					name: "ssstiktok.io (LQ)"
				},
				"musicallydown.com:1": {
					name: "musicallydown.com (LQ/PL)"
				},
				"snaptik.app": {
					name: "snaptik.app (LQ)"
				}
			},
			category: "rules",
			subcategory: "rule_specific",
			onupdate: update_rule_setting
		},
		tumblr_api_key: {
			name: "Tumblr: API key",
			description: "API key for finding larger images on Tumblr",
			category: "rules",
			subcategory: "rule_specific",
			type: "lineedit",
			onupdate: update_rule_setting
		},
		bigimage_blacklist: {
			name: "Blacklist",
			description: "A list of URLs that are blacklisted from being processed",
			category: "rules",
			type: "textarea",
			onupdate: function() {
				update_rule_setting();
				create_blacklist_regexes();
			},
			onedit: function() {
				var errors = create_blacklist_regexes();

				var errordiv;

				try {
					errordiv = document.querySelector("#option_bigimage_blacklist .error");
					errordiv.innerText = "";
				} catch (e) {
				}

				if (errors) {
					for (var i = 0; i < errors.length; i++) {
						if (errordiv)
							errordiv.innerText += errors[i].message + "\n";

						console.error(errors[i]);
					}
				}
			},
			documentation: {
				title: "Documentation",
				value: [
					"The examples below are written for the simple (glob) engine, not the regex engine. The glob engine is generally based on the UNIX glob syntax.<br />",
					"<ul><br />",
					"<li><code>google.com</code> will block https://google.com/, https://www.google.com/, https://abcdef.google.com/, https://def.abc.google.com/, etc.</li>",
					"<li><code>abc.google.com</code> will block https://abc.google.com/, https://def.abc.google.com/, etc.</li>",
					"<li><code>*.google.com</code> will block https://www.google.com/, https://def.abc.google.com/, etc. but not https://google.com/</li>",
					"<li><code>google.*/</code> will block https://google.com/, https://www.google.co.uk, etc.</li>",
					"<li><code>http://google.com</code> will block http://google.com/, but not https://google.com/, http://www.google.com/, etc.</li>",
					"<li><code>google.com/test</code> will block https://google.com/test, https://www.google.com/test/abcdef, but not https://google.com/, etc.</li>",
					"<li><code>google.com/*/test</code> will block https://google.com/abc/test, but not https://google.com/test or https://google.com/abc/def/test</li>",
					"<li><code>google.com/**/test</code> will block https://google.com/abc/test, https://google.com/abc/def/test, https://google.com/abc/def/ghi/test, etc. but not https://google.com/test</li>",
					"<li><code>g??gle.com</code> will block https://google.com/, https://gaagle.com/, https://goagle.com/, etc.</li>",
					"<li><code>google.{com,co.uk}</code> will block https://google.com/ and https://google.co.uk/</li>",
					"<li><code>g[oau]ogle.com</code> will block https://google.com/, https://gaogle.com/, and http://www.guogle.com/</li>",
					"<li><code>g[0-9]ogle.com</code> will block https://g0ogle.com/, https://g1ogle.com/, etc. (up to https://g9ogle.com/)</li>",
					"</ul>"
				].join("\n")
			}
		},
		bigimage_blacklist_engine: {
			name: "Blacklist engine",
			description: "How the blacklist should be processed",
			category: "rules",
			options: {
				glob: {
					name: "Simple (glob)"
				},
				regex: {
					name: "Regex"
				}
			}
		},
		replaceimgs_enable_keybinding: {
			name: "Enable trigger key",
			description: "Enables the use of the trigger key to run it without needing to use the menu",
			category: "extra",
			subcategory: "replaceimages",
		},
		replaceimgs_keybinding: {
			name: "Trigger key",
			description: "Trigger keybinding that will run the Replace Images function",
			requires: {
				replaceimgs_enable_keybinding: true
			},
			type: "keysequence",
			category: "extra",
			subcategory: "replaceimages"
		},
		replaceimgs_auto: {
			name: "Automatically replace images",
			description: "Automatically replace images to larger versions on pages you view",
			warning: {
				"true": "This could lead to rate limiting or IP bans"
			},
			// Auto-updating is disabled due to the warning above
			needrefresh: true,
			category: "extra",
			subcategory: "replaceimages"
		},
		replaceimgs_usedata: {
			name: "Use data URLs",
			description: "Uses data:// URLs instead of image links. Disabling this may improve compatibility with some bulk image downloader extensions",
			category: "extra",
			subcategory: "replaceimages",
			imu_enabled_exempt: true
		},
		replaceimgs_wait_fullyloaded: {
			name: "Wait until image is fully loaded",
			description: "Waits until the image being replaced is fully loaded before moving on to the next image",
			category: "extra",
			subcategory: "replaceimages",
			requires: {
				replaceimgs_usedata: false
			},
			imu_enabled_exempt: true
		},
		replaceimgs_totallimit: {
			name: "Max images to process at once",
			description: "The maximum amount of images to process at once",
			type: "number",
			number_min: 1,
			number_int: true,
			number_unit: "images",
			category: "extra",
			subcategory: "replaceimages",
			imu_enabled_exempt: true
		},
		replaceimgs_domainlimit: {
			name: "Max images per domain at once",
			description: "The maximum amount of images per domain to process at once",
			type: "number",
			number_min: 1,
			number_int: true,
			number_unit: "images",
			category: "extra",
			subcategory: "replaceimages",
			imu_enabled_exempt: true
		},
		replaceimgs_delay: {
			name: "Delay between same-domain images",
			description: "New requests for images in the same domain will be delayed by this amount of seconds. Useful for bypassing rate limits.",
			type: "number",
			number_min: 0,
			number_unit: "seconds",
			category: "extra",
			subcategory: "replaceimages",
			imu_enabled_exempt: true
		},
		replaceimgs_replaceimgs: {
			name: "Replace images",
			description: "Replaces images to their larger versions when the button is pressed",
			category: "extra",
			subcategory: "replaceimages",
			imu_enabled_exempt: true
		},
		replaceimgs_addlinks: {
			name: "Add links",
			description: "Adds links around images if a link doesn't already exist",
			category: "extra",
			subcategory: "replaceimages",
			imu_enabled_exempt: true
		},
		replaceimgs_replacelinks: {
			name: "Replace links",
			description: "Replaces links if they already exist",
			category: "extra",
			subcategory: "replaceimages",
			requires: {
				replaceimgs_addlinks: true
			},
			imu_enabled_exempt: true
		},
		highlightimgs_enable_keybinding: {
			name: "Enable trigger key",
			description: "Enables the use of the trigger key to run it without needing to use the menu",
			category: "extra",
			subcategory: "highlightimages",
		},
		highlightimgs_keybinding: {
			name: "Trigger key",
			description: "Trigger keybinding that will run the Highlight Images function",
			requires: {
				highlightimgs_enable_keybinding: true
			},
			type: "keysequence",
			category: "extra",
			subcategory: "highlightimages"
		},
		highlightimgs_enable: {
			name: "Enable button",
			description: "Enables the 'Highlight Images' button",
			category: "extra",
			subcategory: "highlightimages",
			imu_enabled_exempt: true
		},
		highlightimgs_auto: {
			name: "Automatically highlight images",
			description: "Automatically highlights images as you view pages",
			options: {
				_type: "or",
				always: {
					name: "Always"
				},
				hover: {
					name: "Hover",
					description: "When hovering over an image"
				},
				never: {
					name: "Never"
				}
			},
			category: "extra",
			subcategory: "highlightimages"
		},
		highlightimgs_onlysupported: {
			name: "Only explicitly supported images",
			description: "Only highlights images that can be made larger or the original version can be found",
			requires: [
				{highlightimgs_enable: true},
				{highlightimgs_auto: "always"},
				{highlightimgs_auto: "hover"}
			],
			category: "extra",
			subcategory: "highlightimages"
		},
		highlightimgs_css: {
			name: "Highlight CSS",
			description: "CSS style to apply for highlight. See the documentation for Popup CSS style for more information (the thumb/full URL variables aren't supported here)",
			type: "textarea",
			requires: [
				{highlightimgs_enable: true},
				{highlightimgs_auto: "always"},
				{highlightimgs_auto: "hover"}
			],
			category: "extra",
			subcategory: "highlightimages",
			imu_enabled_exempt: true
		}
	};

	var option_to_problems = {
		allow_watermark: "watermark",
		allow_smaller: "smaller",
		allow_possibly_different: "possibly_different",
		allow_possibly_broken: "possibly_broken",
		allow_possibly_upscaled: "possibly_upscaled",
		allow_bruteforce: "bruteforce"
	};

	var categories = {
		"general": "category_general",
		"redirection": "category_redirection",
		"popup": "category_popup",
		"rules": "category_rules",
		"website": "category_website",
		"extension": "category_extension",
		"extra": "category_extra"
	};

	var subcategories = {
		"general": {
			"settings": "subcategory_settings"
		},
		"popup": {
			"trigger": "subcategory_trigger",
			"open_behavior": "subcategory_open_behavior",
			"close_behavior": "subcategory_close_behavior",
			"behavior": "subcategory_behavior",
			"cache": "subcategory_cache",
			"gallery": "subcategory_gallery",
			"video": "subcategory_video",
			"ui": "subcategory_ui",
			"popup_other": "subcategory_popup_other"
		},
		"rules": {
			"rule_specific": "subcategory_rule_specific"
		},
		"extra": {
			"replaceimages": "subcategory_replaceimages",
			"highlightimages": "subcategory_highlightimages"
		}
	};


	for (var option in option_to_problems) {
		var problem = option_to_problems[option];
		settings[option] = array_indexof(default_options.exclude_problems, problem) < 0;
	}

	var settings_history = {};

	var new_map = function() {
		var map;

		try {
			map = new Map();
		} catch (e) {
			map = {
				imu_map: true,
				object: {},
				array: []
			};
		}

		return map;
	};

	var _map_is_key_primitive = function(key) {
		return typeof key === "string" || typeof key === "number";
	};

	var _map_indexof = function(map, key) {
		for (var i = 0; i < map.array.length; i++) {
			if (map.array[i].key === key) {
				return i;
			}
		}

		return -1;
	};

	var map_set = function(map, key, value) {
		nir_debug("map", "map_set", deepcopy(key), deepcopy(value));

		if (!map.imu_map) {
			map.set(key, value);
		} else {
			if (_map_is_key_primitive(key)) {
				map.object[key] = value;
			} else {
				var index = _map_indexof(map, key);
				if (index < 0) {
					map.array.push({key: key, value: value});
				} else {
					map.array[index].value = value;
				}
			}
		}

		return value;
	};

	var map_get = function(map, key) {
		if (!map.imu_map) {
			return map.get(key);
		} else {
			if (_map_is_key_primitive(key)) {
				return map.object[key];
			} else {
				var index = _map_indexof(map, key);
				if (index >= 0) {
					return map.array[index].value;
				} else {
					return undefined;
				}
			}
		}
	};

	var map_has = function(map, key) {
		if (!map.imu_map) {
			return map.has(key);
		} else {
			if (_map_is_key_primitive(key)) {
				return key in map.object;
			} else {
				return _map_indexof(map, key) >= 0;
			}
		}
	};

	var map_remove = function(map, key) {
		if (!map.imu_map) {
			map.delete(key);
		} else {
			if (_map_is_key_primitive(key)) {
				delete map.object[key];
			} else {
				var index = _map_indexof(map, key);
				if (index >= 0) {
					map.array.splice(index, 1);
				}
			}
		}
	};

	var map_foreach = function(map, cb) {
		if (!map.imu_map) {
			var keys = map.keys();
			while (true) {
				var key_it = keys.next();
				if (key_it.done)
					break;

				var key = key_it.value;
				cb(key, map.get(key));
			}
		} else {
			for (var key in map.object) {
				cb(key, map.object[key]);
			}

			for (var i = 0; i < map.array.length; i++) {
				cb(map.array[i].key, map.array[i].value);
			}
		}
	};

	var map_size = function(map) {
		if (!map.imu_map) {
			return map.size;
		} else {
			return Object.keys(map.object).length + map.array.length;
		}
	};

	var new_set = function() {
		return new_map();
	};

	var set_add = function(set, key) {
		return map_set(set, key, true);
	};

	var set_has = function(set, key) {
		return map_has(set, key);
	};

	function Cache(options) {
		if (!options)
			options = {};

		this.data = new_map();
		this.times = new_map();

		this.fetches = new_map();

		this.set = function(key, value, time) {
			nir_debug("cache", "Cache.set key:", key, ", time=" + time + ", value:", deepcopy(value));

			this.remove(key);

			if (options.max_keys) {
				var current_size = map_size(this.data);
				if (current_size > options.max_keys) {
					var all_keys = [];

					map_foreach(this.times, function(key, value) {
						all_keys.push({key: key, end_time: value.end_time, added_time: value.added_time});
					});

					// we prioritize removing the key closest to expiry before the oldest key
					all_keys.sort(function(a, b) {
						if (a.end_time) {
							if (!b.end_time)
								return -1;

							return a.end_time - b.end_time;
						} else {
							if (b.end_time)
								return 1;

							return a.added_time - b.added_time;
						}
					});

					var keys_to_remove = current_size - options.max_keys;
					var key_id = 0;
					while (key_id < all_keys.length && keys_to_remove > 0) {
						this.remove(all_keys[key_id++].key);
						keys_to_remove--;
					}
				}
			}

			map_set(this.data, key, value);

			var added_time = Date.now();
			if (typeof time === "number" && time > 0) {
				var cache = this;
				var timer = setTimeout(function() {
					cache.remove(key);
				}, time * 1000);

				// Ensures the process can exit in node.js
				if (is_node && "unref" in timer) {
					timer.unref();
				}

				map_set(this.times, key, {
					timer: timer,
					time: time,
					added_time: added_time,
					end_time: added_time + time
				});
			} else {
				map_set(this.times, key, {
					added_time: added_time
				});
			}
		};

		this.has = function(key) {
			var has_key = map_has(this.data, key);

			nir_debug("cache", "Cache.has key:", key, has_key);

			return has_key;
		};

		this.get = function(key) {
			// TODO: maybe renew timeout per-get?
			var value = map_get(this.data, key);

			nir_debug("cache", "Cache.get key:", key, deepcopy(value));

			return value;
		};

		this.fetch = function(key, done, fetcher) {
			var exists = map_has(this.data, key);

			nir_debug("cache", "Cache.fetch key:", key, ", exists=" + exists);

			if (!exists) {
				if (map_has(this.fetches, key)) {
					map_get(this.fetches, key).push(done);
				} else {
					map_set(this.fetches, key, []);

					var _this = this;

					fetcher(function(data, time) {
						if (time !== false)
							_this.set.bind(_this)(key, data, time);

						done(data);

						var our_fetches = map_get(_this.fetches, key);
						for (var i = 0; i < our_fetches.length; i++) {
							our_fetches[i](data);
						}

						map_remove(_this.fetches, key);
					});
				}
			} else {
				done(map_get(this.data, key));
			}
		};

		this.remove = function(key) {
			nir_debug("cache", "Cache.remove key:", key);

			if (map_has(this.times, key)) {
				var timeobj = map_get(this.times, key);

				if ("timer" in timeobj);
					clearTimeout(timeobj.timer);
			}

			if (options.destructor && map_has(this.data, key)) {
				options.destructor(key, map_get(this.data, key));
			}

			map_remove(this.times, key);
			map_remove(this.data, key);
		};

		this.clear = function() {
			nir_debug("cache", "Cache.clear");

			map_foreach(this.times, function(key, value) {
				if ("timer" in value) {
					clearTimeout(value.timer);
				}
			});

			if (options.destructor) {
				map_foreach(this.data, function(key, value) {
					options.destructor(key, value);
				});
			}

			this.times = new_map();
			this.data = new_map();
		};
	};

	var url_cache = new Cache();
	var real_api_cache = new Cache();
	var lib_cache = new Cache();
	var cookie_cache = new Cache();

	var real_api_query = function(api_cache, do_request, key, request, cb, process) {
		api_cache.fetch(key, cb, function(done) {
			if (!("method" in request))
				request.method = "GET";

			request.onload = function(resp) {
				if (resp.status !== 200) {
					if (!request.silent)
						console_error(key, resp);
					return done(null, false);
				}

				try {
					var out_resp = resp;

					if (request.json) {
						out_resp = JSON_parse(resp.responseText);
					}

					return process(done, out_resp, key);
				} catch (e) {
					console_error(key, e);
					return done(null, false);
				}
			};

			do_request(request);
		});
	};

	var real_website_query = function(options) {
		if (!is_array(options.website_regex)) {
			options.website_regex = [options.website_regex];
		}

		var website_match = null;

		for (var i = 0; i < options.website_regex.length; i++) {
			website_match = options.url.match(options.website_regex[i]);
			if (website_match)
				break;
		}

		if (!website_match)
			return null;

		var page_nullobj = {
			url: options.url,
			is_pagelink: true
		};

		if (!options.do_request || !options.cb) {
			return page_nullobj;
		}

		var domain = options.url.replace(/^[a-z]+:\/\/([^/]+)\/+.*$/, "$1");
		var domain_nosub = get_domain_nosub(domain);
		if (!options.cache_key) {
			options.cache_key = domain_nosub;
		}

		var cb = function(data) {
			if (!data) {
				return options.cb(page_nullobj);
			} else {
				if (!is_array(data)) {
					data = [data];
				}

				data.push(page_nullobj);

				return options.cb(data);
			}
		};

		if (!options.override_cb) {
			options.override_cb = function(cb, data) {
				cb(data);
			};
		}

		if (!options.run) {
			options.run = function(cb, website_match, options) {
				var id = website_match[1];

				var query = options.query_for_id;

				if (typeof options.query_for_id === "string") {
					query = {
						url: query
					};
				}

				if (typeof query === "object" && query.url) {
					query.url = query.url
						.replace(/\${id}/g, id)
						.replace(/\${([0-9]+)}/g, function(_, x) {
							return website_match[x];
						});
				} else {
					query = query(id);
				}

				real_api_query(options.api_cache, options.do_request, options.cache_key + ":" + id, query, cb, function(done, resp, cache_key) {
					return options.process(done, resp, cache_key, website_match, options)
				});
			};
		}

		options.run(function(data) {
			options.override_cb(cb, data);
		}, website_match, options);

		return {
			waiting: true
		};
	};

	// temporary hack for Instagram returning urls with %00
	// thanks to fireattack on discord for reporting
	var is_invalid_url = function(url) {
		// yes, a null url is technically invalid, but this check is used to detect if it has invalid characters.
		// it's better to just return false here.
		// thanks to remlap on discord for noticing that this caused issues for regular instagram posts.
		if (!url)
			return false;

		for (var i = 0; i < url.length; i++) {
			if (url.charCodeAt(i) === 0) {
				return true;
			}
		}

		return false;
	};

	// https://stackoverflow.com/a/17323608
	function mod(n, m) {
		return ((n % m) + m) % m;
	}

	// unused, but likely useful
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

	function urlnorm(a) {
		var protocol_split = a.split("://");
		var splitted = protocol_split[1].split("/");
		var newsplitted = [];
		for (var i = 0; i < splitted.length; i++) {
			if (splitted[i] === "..")
				newsplitted.pop();
			else
				newsplitted.push(splitted[i]);
		}

		return protocol_split[0] + "://" + newsplitted.join("/");
	}

	var is_valid_resource_url = function(url) {
		var match = url.match(/^([-a-z]+):/);
		if (match) {
			var valid_schemes = ["http", "https", "ftp", "data", "x-raw-image", "blob", "chrome", "file"];
			return array_indexof(valid_schemes, match[1].toLowerCase()) >= 0;
		}

		return true;
	};

	var norm_url = function(url) {
		return url
		// https://www.test.com?test -> https://www.test.com/?test
			.replace(/^([a-z]+:\/\/[^/]+)(\?.*)/, "$1/$2")
		// https://www.test.com./ -> https://www.test.com/
			.replace(/^([a-z]+:\/\/[^/]+\.[^/]+)\.([?#/].*)?$/, "$1$2");
	};

	function urljoin(a, b, browser) {
		if (b.length === 0)
			return a;
		if (b.match(/^[-a-z]*:\/\//) || b.match(/^(?:data|x-raw-image|blob|about|javascript):/))
			return b;

		var protocol_split = a.split("://");

		// FIXME? for URLs like about:blank
		if (protocol_split.length < 2) {
			return a;
		}

		var protocol = protocol_split[0];
		var splitted = protocol_split[1].split("/");
		var domain = splitted[0];
		var start = protocol + "://" + domain;

		if (!browser) {
			// simple path join
			// urljoin("http://site.com/index.html", "file.png") = "http://site.com/index.html/file.png"
			return a.replace(/\/*$/, "") + "/" + b.replace(/^\/*/, "");
		} else {
			if (b.length >= 2 && b.slice(0, 2) === "//")
				return protocol + ":" + b;
			if (b.length >= 1 && b.slice(0, 1) === "/")
				return start + b;

			if (b.length >= 2 && b.slice(0, 2) === "./")
				b = b.substring(2);

			// to emulate the browser's behavior instead
			// urljoin("http://site.com/index.html", "file.png") = "http://site.com/file.png"
			if (!a.match(/\/$/))
				a = a.replace(/^([^?]*)\/.*?$/, "$1/");

			return urlnorm(a + b.replace(/^\/*/, ""));
			//return a.replace(/\/[^/]*$/, "/") + b.replace(/^\/*/, "");
			//return urlnorm(a.replace(/^([^?]*)\/.*?$/, "$1/") + b.replace(/^\/*/, ""));
		}
	}

	var fullurl = function(url, x) {
		if (x === undefined || x === null)
			return x;

		var a = document_createElement(a);
		a.href = x;
		return a.href;
	};

	var fillobj_urls = function(urls, obj) {
		var newobj = [];
		for (var i = 0; i < urls.length; i++) {
			var currentobj = deepcopy(obj);

			if (typeof urls[i] === "string") {
				currentobj.url = urls[i];
			} else {
				for (var key in urls[i]) {
					currentobj[key] = urls[i][key];
				}
			}

			newobj.push(currentobj);
		}

		return newobj;
	};

	var add_full_extensions = function(obj, extensions, prefer_order) {
		if (!extensions)
			extensions = [
				"jpg", "jpeg", "png", "gif", "webp",
				"JPG", "JPEG", "PNG", "GIF"
			];

		if (!is_array(obj)) {
			obj = [obj];
		}

		var result = [];

		for (var i = 0; i < obj.length; i++) {
			var currentobj = obj[i];
			var url = currentobj;
			if (typeof currentobj !== "string") {
				url = currentobj.url;
			}

			var regex = /(.*)\.([^/.]*?)([?#].*)?$/;
			if (!url.match(regex)) {
				result.push(currentobj);
				continue;
			}

			var ext = url.replace(regex, "$2");
			var basename = url.replace(regex, "$1");
			var query = url.replace(regex, "$3");

			//var result = [url];
			if (!prefer_order)
				result.push(currentobj);

			for (var i = 0; i < extensions.length; i++) {
				if (!prefer_order && ext === extensions[i])
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

			if (prefer_order && array_indexof(result, currentobj) < 0)
				result.push(currentobj);
		}

		return result;
	};

	var add_extensions = function(url) {
		return add_full_extensions(url, ["jpg", "png"]);
	};

	var add_extensions_jpeg = function(url) {
		return add_full_extensions(url, ["jpeg", "png"]);
	};

	var add_extensions_with_jpeg = function(url) {
		return add_full_extensions(url, ["jpg", "jpeg", "png"]);
	};

	var add_extensions_gif = function(url) {
		return add_full_extensions(url, ["jpg", "png", "gif"]);
	};

	var add_extensions_upper = function(url) {
		return add_full_extensions(url, ["jpg", "png", "JPG", "PNG"]);
	};

	var add_extensions_upper_jpeg = function(url) {
		return add_full_extensions(url, ["jpg", "jpeg", "png", "JPG", "JPEG", "PNG"]);
	};

	var add_http = function(url) {
		if (!url.match(/^[a-z]+:\/\//))
			return "http://" + url;
		return url;
	};

	var force_https = function(url) {
		return url.replace(/^http:\/\//, "https://");
	};

	var decodeuri_ifneeded = function(url) {
		if (url.match(/^https?:\/\//))
			return url;
		if (url.match(/^https?%3[aA]/) || /^[^/]*%2[fF]/.test(url))
			return decodeURIComponent(url);
		if (url.match(/^https?%253[aA]/))
			return decodeURIComponent(decodeURIComponent(url));
		return url;
	};

	var encodeuri_ifneeded = function(url) {
		// TODO: improve
		if (string_indexof(url, "%") < 0) {
			return encodeURI(url);
		}

		return url;
	};

	var replace_sizes = function(src, sizes) {
		var current_problems = null;
		for (var i = 0; i < sizes.length; i++) {
			var url = sizes[i];
			if (typeof url === "object")
				url = url.url;

			if (url === src) {
				if (typeof sizes[i] === "object" && sizes[i].problems)
					current_problems = sizes[i].problems;

				sizes.splice(i, sizes.length);
				break;
			}
		}

		if (current_problems) {
			for (var i = 0; i < sizes.length; i++) {
				if (typeof sizes[i] !== "object")
					continue;

				if (sizes[i].problems) {
					for (var problem in sizes[i].problems) {
						if (sizes[i].problems[problem] === current_problems[problem]) {
							delete sizes[i].problems[problem];
						}
					}
				}
			}
		}

		return sizes;
	};

	// https://stackoverflow.com/a/10073788
	var zpadnum = function(n, width, z) {
		z = z || '0';
		n = n + '';
		return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
	}

	// https://www.w3resource.com/javascript-exercises/javascript-string-exercise-28.php
	function hex_to_ascii(str1) {
		var hex = str1.toString();
		var str = '';
		for (var n = 0; n < hex.length; n += 2) {
			str += string_fromcharcode(parseInt(hex.substr(n, 2), 16));
		}
		return str;
	}

	function hex_to_numberarray(str) {
		var result = [];

		for (var i = 0; i < str.length; i += 2) {
			result.push(parseInt(str.substr(i, 2), 16));
		}

		return result;
	}

	function numberarray_to_hex(arr) {
		var str = "";

		for (var i = 0; i < arr.length; i++) {
			if (arr[i] < 16)
				str += "0";
			str += arr[i].toString(16);
		}

		return str;
	}

	function reverse_str(str) {
		return run_arrayd_string(str, {
			cb: function(arr) {
				return arr.reverse();
			}
		});
	}

	function decode_entities(str) {
		var match = str.match(/^\s*<!\[CDATA\[([\s\S]+)\]\]>\s*$/);
		if (match)
			return match[1];

		return str
			.replace(/&nbsp;/g, " ")
			.replace(/&#([0-9]+);/g, function (full, num) { return string_fromcharcode(num); })
			.replace(/&amp;/g, "&");
	}

	function encode_entities(str) {
		return str.replace(/&/g, "&amp;");
	}

	function encode_regex(str) {
		return str.replace(/([\^$])/g, "\\$1");
	}

	function get_queries(url, options) {
		// TODO: handle things like: ?a=b&c=b#&d=e
		var querystring = url.replace(/^[^#]*?\?/, "");
		if (!querystring || querystring === url)
			return {};

		if (!options) {
			options = {};
		}

		var queries = {};

		var splitted = querystring.split("&");
		for (var i = 0; i < splitted.length; i++) {
			var name = splitted[i];
			var value = true;

			var match = splitted[i].match(/^(.*?)=(.*)/);
			if (match) {
				name = match[1];
				value = match[2];
			}

			if (name.length === 0)
				continue;

			if (options.decode) {
				value = decodeURIComponent(value);
			}

			queries[name] = value;
		}

		return queries;
	}

	function stringify_queries(queries) {
		var queriesstr = [];

		for (var query in queries) {
			if (query.length === 0)
				continue;

			var current_query = query;
			if (queries[query] !== true) {
				current_query += "=" + queries[query];
			}

			queriesstr.push(current_query);
		}

		return queriesstr.join("&");
	}

	function remove_queries(url, queries) {
		if (!is_array(queries)) {
			queries = [queries];
		}

		var beforequery = url.replace(/^([^#]*?)\?(.*)$/, "$1");
		var afterquery = url.replace(/^([^#]*?)\?(.*)$/, "$2");

		// TODO: handle things like: ?a=b&c=b#&d=e

		// no query string
		if (beforequery === url)
			return url;

		var splitted = afterquery.split("&");
		var newsplitted = [];
		for (var i = 0; i < splitted.length; i++) {
			var property = splitted[i].replace(/^(.*?)=.*/, "$1");
			if (array_indexof(queries, property) < 0) {
				newsplitted.push(splitted[i]);
			}
		}

		if (newsplitted.length === 0) {
			afterquery = "";
		} else {
			afterquery = "?" + newsplitted.join("&");
		}

		return beforequery + afterquery;
	}

	function keep_queries(url, queries, options) {
		if (!is_array(queries)) {
			queries = [queries];
		}

		if (!options) {
			options = {};
		}

		var url_queries = get_queries(url);

		var kept_queries = [];
		var has_queries = new_set();
		array_foreach(queries, function(query) {
			if (query in url_queries) {
				var querystr = query + "=";

				if (options.overwrite && query in options.overwrite) {
					querystr += options.overwrite[query];
				} else {
					querystr += url_queries[query];
				}

				kept_queries.push(querystr);
				set_add(has_queries, query);
			}
		});

		if (options.required) {
			if (options.required === true)
				options.required = queries;

			var required_total = 0;
			array_foreach(options.required, function(query) {
				if (set_has(has_queries, query)) {
					required_total++;
				} else {
					return false;
				}
			});

			if (required_total < options.required.length)
				return url;
		}

		if (options.overwrite) {
			for (var query in options.overwrite) {
				if (!set_has(has_queries, query)) {
					kept_queries.push(query + "=" + options.overwrite[query]);
				}
			}
		}

		var afterquery;
		if (kept_queries.length === 0)
			afterquery = "";
		else
			afterquery = "?" + kept_queries.join("&");

		return url.replace(/\?.*/, "") + afterquery;
	}

	function add_queries(url, queries) {
		var parsed_queries = get_queries(url);

		for (var query in queries) {
			parsed_queries[query] = queries[query];
		}

		var newquerystring = stringify_queries(parsed_queries);
		if (newquerystring) {
			return url.replace(/^([^#]*?)(?:\?.*)?$/, "$1?" + newquerystring);
		} else {
			return url;
		}
	}

	var raw_do_notify = null;
	if (is_userscript) {
		if (typeof GM_notification !== "undefined") {
			raw_do_notify = GM_notification;
		} else if (typeof GM !== "undefined" && GM.notification) {
			raw_do_notify = GM.notification;
		}
	} else if (is_extension) {
		raw_do_notify = function(details, ondone) {
			var jsoned_details = deepcopy(details, {json: true});
			if (details.onclick)
				jsoned_details.onclick = true;

			extension_send_message({
				type: "notification",
				data: jsoned_details
			}, function(response) {
				// if there's no onclick
				if (!response || !response.data)
					return;

				if (response.data.action === "clicked") {
					if (details.onclick) {
						details.onclick();
					}
				} else if (response.data.action === "closed") {
					ondone = details.ondone || ondone;
					if (ondone) {
						ondone();
					}
				}
			});
		};
	}

	var do_notify = function(details) {
		if (!raw_do_notify)
			return;

		if (!details.title) {
			details.title = _("Image Max URL");
		}

		if (!details.image) {
			details.image = imu_icon;
		}

		raw_do_notify(details, details.ondone || null);
	};

	function fuzzify_text(str) {
		return str
			.replace(/(?:[-=_!?$#"'’‘”“]|\[|])/g, " ")
			.replace(/\s+/g, " ")
			.replace(/^\s+|\s+$/g, "");
	}

	var _version_compare_pad_0 = function(array, amount) {
		if (amount <= 0)
			return;

		for (var i = 0; i < amount; i++) {
			array.push(0);
		}
	};

	function version_compare(a, b) {
		var version_regex = /^[0-9]+(\.[0-9]+){0,}$/;
		if (!version_regex.test(a) ||
			!version_regex.test(b))
			return null;

		var a_split = a.split(".");
		var b_split = b.split(".");

		if (a_split.length !== b_split.length) {
			_version_compare_pad_0(a_split, b_split - a_split);
			_version_compare_pad_0(b_split, a_split - b_split);
		}

		for (var i = 0; i < a_split.length; i++) {
			var an = parseInt(a_split[i]);
			var bn = parseInt(b_split[i]);

			if (an < bn)
				return 1;
			if (an > bn)
				return -1;
		}

		return 0;
	}

	var check_updates_firefox = function(cb) {
		do_request({
			url: firefox_addon_page,
			method: "GET",
			onload: function(resp) {
				if (resp.readyState < 4)
					return;

				if (resp.status !== 200)
					return cb(null);

				var match = resp.responseText.match(/<script[^>]*id=["']redux-store-state["']\s*>\s*({.*?})\s*<\/script>/);
				if (!match) {
					return cb(null);
				}

				try {
					var json = JSON_parse(match[1]);
					var addoninfo = json.addons.byID["1003321"];
					var versionid = addoninfo.currentVersionId;
					var versioninfo = json.versions.byId[versionid];
					var version = versioninfo.version;
					var downloadurl = versioninfo.platformFiles.all.url.replace(/\?src=.*/, "?src=external-updatecheck");

					cb({
						version: version,
						downloadurl: downloadurl
					});
				} catch (e) {
					console_error("Unable to parse mozilla addon info", e);
					return cb(null);
				}
			}
		});
	};

	var check_updates_github = function(cb) {
		do_request({
			url: "https://api.github.com/repos/qsniyg/maxurl/tags",
			method: "GET",
			headers: {
				Referer: ""
			},
			onload: function(resp) {
				if (resp.readyState <4 )
					return;

				if (resp.status !== 200)
					return cb(null);

				try {
					var json = JSON_parse(resp.responseText);

					for (var i = 0; i < json.length; i++) {
						var version = json[i].name;

						if (!version.match(/^v[0-9.]+$/)) {
							continue;
						}

						return cb({
							version: version.replace(/^v([0-9])/, "$1")
						});
					}
				} catch (e) {
					console_error("Unable to parse github info", e);
				}

				return cb(null);
			}
		});
	};

	var check_updates = function(cb) {
		// Firefox blocks these requests
		if (false && is_firefox_webextension) {
			check_updates_firefox(function(data) {
				if (!data) {
					check_updates_github(cb);
				} else {
					cb(data);
				}
			});
		} else {
			check_updates_github(cb);
		}
	};

	var get_update_url = function() {
		var link = settings.last_update_url;
		if (!link) {
			if (is_firefox_webextension) {
				link = firefox_addon_page;
			} else if (is_userscript) {
				link = userscript_update_url;
			} else {
				link = null;
			}
		}

		return link;
	};

	var check_updates_if_needed = function() {
		// if last_update_check == 0, it means for some reason it's not able to store values
		if (!settings.imu_enabled || !settings.check_updates || !current_version || !settings.last_update_check) {
			return;
		}

		var update_check_delta = Date.now() - settings.last_update_check;
		if (update_check_delta > (settings.check_update_interval*60*60*1000)) {
			check_updates(function(data) {
				update_setting("last_update_check", Date.now());

				if (!data || !data.version)
					return;

				if (!data.downloadurl) {
					update_setting("last_update_url", null);
				} else {
					update_setting("last_update_url", data.downloadurl);
				}

				update_setting("last_update_version", data.version);

				if (settings.check_update_notify && !is_in_iframe && version_compare(current_version, data.version) === 1) {
					var notify_obj = {
						text: _("Update available (%%1)", data.version)
					};

					var downloadurl = get_update_url();
					// FIXME? if !downloadurl, clicking won't close the popup. this might not be a problem though, as it's expected behavior?
					if (downloadurl) {
						notify_obj.onclick = function() {
							open_in_tab_imu({
								url: downloadurl
							});
						};
					}

					do_notify(notify_obj);
				}
			});
		}
	};

	function _fuzzy_compare_rollover(a, b, lim) {
		if (a === b)
			return true;

		if (a - 1 === b || a + 1 === b)
			return true;

		for (var i = 0; i < lim.length; i++) {
			if (a === lim[i]) {
				if (b === 1)
					return true;
			} else if (b === lim[i]) {
				if (a === 1)
					return true;
			}
		}

		return false;
	}

	function _is_larger_rollover(a, b, end) {
		if (a === 1 && array_indexof(end, b) >= 0)
			return true;

		if (b === 1 && array_indexof(end, a) >= 0)
			return true;

		return false;
	}

	function fuzzy_date_compare(a, b) {
		if (a === b)
			return true;

		if (a.length !== 8 || b.length !== 8)
			return false;

		var a_d = parseInt(a.substr(6, 2));
		var b_d = parseInt(b.substr(6, 2));

		if (!_fuzzy_compare_rollover(a_d, b_d, [28, 29, 30, 31]))
			return false;

		var a_m = parseInt(a.substr(4, 2));
		var b_m = parseInt(b.substr(4, 2));

		var d_rollover = _is_larger_rollover(a_d, b_d, [28, 29, 30, 31]);
		if (a_m !== b_m) {
			if (!d_rollover)
				return false;
			if (!_fuzzy_compare_rollover(a_m, b_m, [12]))
				return false;
		}

		var a_y = parseInt(a.substr(0, 4));
		var b_y = parseInt(b.substr(0, 4));

		if (a_y !== b_y) {
			if (!d_rollover || !_is_larger_rollover(a_m, b_m, [12]))
				return false;
			if (!_fuzzy_compare_rollover(a_y, b_y, []))
				return false;
		}

		return true;
	}

	function run_soon(func) {
		setTimeout(func, 1);
	}

	// bug in chrome, see
	// https://github.com/qsniyg/maxurl/issues/7
	// https://our.umbraco.org/forum/using-umbraco-and-getting-started/91715-js-error-when-aligning-content-left-center-right-justify-in-richtext-editor
	if (is_node || true) {
		fullurl = function(url, x) {
			return urljoin(url, x, true);
		};
	}

	var blacklist_regexes = [];

	function update_rule_setting() {
		url_cache.clear();
	}

	function create_blacklist_regexes() {
		blacklist_regexes = [];
		var blacklist = settings.bigimage_blacklist || "";
		if (typeof blacklist !== "string") {
			console_warn("Invalid blacklist", blacklist);
			return;
		}

		blacklist = blacklist.split("\n");

		for (var i = 0; i < blacklist.length; i++) {
			var current = blacklist[i].replace(/^\s+|\s+$/, "");
			//console_log(current);
			if (current.length === 0)
				continue;

			if (settings.bigimage_blacklist_engine === "regex") {
				try {
					blacklist_regexes.push(new RegExp(current));
				} catch (e) {
					return [e];
				}
			} else if (settings.bigimage_blacklist_engine === "glob") {
				var newcurrent = "";
				var sbracket = -1;
				var cbracket = -1;
				for (var j = 0; j < current.length; j++) {
					if (sbracket >= 0) {
						if (current[j] === "]") {
							newcurrent += current.substr(sbracket, j - sbracket + 1);
							sbracket = -1;
						}
						continue;
					}

					if (cbracket >= 0) {
						if (current[j] === "}") {
							var options = current.substr(cbracket + 1, j - cbracket - 1).split(",");
							var newoptions = [];
							for (var k = 0; k < options.length; k++) {
								newoptions.push(options[k].replace(/(.)/g, "[$1]"));
							}
							if (newoptions.length > 0 && (newoptions.length > 1 || newoptions[0].length > 0))
								newcurrent += "(?:" + newoptions.join("|") + ")";
							cbracket = -1;
						}

						continue;
					}

					if (current[j] !== "*") {
						if (current[j] === "{") {
							cbracket = j;
						} else if (current[j] === "[") {
							sbracket = j;
						} else if (current[j] === "?") {
							newcurrent += "[^/]";
						} else if (current[j] === ".") {
							newcurrent += "\\.";
						} else {
							newcurrent += current[j];
						}
						continue;
					}

					var doublestar = false;
					if ((j + 1) < current.length) {
						if (current[j+1] === "*") {
							doublestar = true;
							j++;
						}
					}

					if (doublestar)
						newcurrent += ".+";
					else
						newcurrent += "[^/]+";
				}

				current = newcurrent;

				if (current[0] !== "*") {
					newcurrent = current.replace(/^[a-z]*:\/\//, "[a-z]+://");
					if (newcurrent !== current) {
						current = newcurrent;
					} else {
						current = "[a-z]+://[^/]*" + current;
					}
				}

				current = "^" + current;

				try {
					blacklist_regexes.push(new RegExp(current));
				} catch (e) {
					return [e];
				}
			}
		}

		//console_log(blacklist_regexes);
	}

	var parse_headers = function(headerstr) {
		var headers = [];

		var splitted = headerstr.split("\r\n");
		for (var i = 0; i < splitted.length; i++) {
			var header_name = splitted[i].replace(/^\s*([^:]*?)\s*:[\s\S]*/, "$1").toLowerCase();
			var header_value = splitted[i].replace(/^[^:]*?:\s*([\s\S]*?)\s*$/, "$1");

			if (header_name === splitted[i] || header_value === splitted[i])
				continue;

			var value_split = header_value.split("\n");
			for (var j = 0; j < value_split.length; j++) {
				headers.push({name: header_name, value: value_split[j]});
			}
		}

		if (_nir_debug_)
			console_log("parse_headers", headerstr, deepcopy(headers));

		return headers;
	};

	var headers_list_to_dict = function(headers) {
		var dict = {};

		for (var i = 0; i < headers.length; i++) {
			dict[headers[i].name.toLowerCase()] = headers[i].value;
		}

		return dict;
	};

	var headers_dict_to_list = function(headers) {
		var list = [];

		for (var header in headers) {
			list.push({name: header, value: headers[header]});
		}

		return list;
	};

	var parse_cookieheader = function(cookieheader) {
		var cookies = {};

		do {
			var match = cookieheader.match(/^\s*([^=]*?)\s*=\s*([^;]*?)\s*(?:;\s*(.*))?$/);
			if (!match)
				break;

			cookies[match[1]] = match[2];
			cookieheader = match[3];
		} while (cookieheader);

		if (_nir_debug_)
			console_log("parse_cookieheader", cookieheader, deepcopy(cookies));

		return cookies;
	};

	var create_cookieheader_from_headers = function(headers, cookieheader) {
		headers = parse_headers(headers);

		var cookies = {};
		for (var i = 0; i < headers.length; i++) {
			if (headers[i].name !== "set-cookie")
				continue;

			var cookie_match = headers[i].value.match(/^\s*([^=]*?)\s*=\s*([^;]*?)\s*;.*/);
			if (!cookie_match) {
				console_error("Unable to match cookie: ", headers[i]);
				continue;
			}

			cookies[cookie_match[1]] = cookie_match[2];
		}

		if (_nir_debug_)
			console_log("create_cookieheader_from_headers", headers, cookieheader, deepcopy(cookies));

		if (cookieheader) {
			var parsed = parse_cookieheader(cookieheader);

			for (var key in parsed) {
				if (!(key in cookies)) {
					cookies[key] = parsed[key];
				}
			}
		}

		var cookies_array = [];
		for (var key in cookies) {
			cookies_array.push(key + "=" + cookies[key]);
		}

		return cookies_array.join("; ");
	};

	var headerobj_get = function(headerobj, header) {
		for (var key in headerobj) {
			if (key.toLowerCase() === header.toLowerCase()) {
				return headerobj[key];
			}
		}
	};

	var headerobj_set = function(headerobj, header, value) {
		for (var key in headerobj) {
			if (key.toLowerCase() === header.toLowerCase()) {
				return headerobj[key] = value;
			}
		}

		return headerobj[header] = value;
	};

	var get_resp_finalurl = function(resp) {
		var parsed = parse_headers(resp.responseHeaders);
		if (!parsed)
			return resp.finalUrl;

		var dict = headers_list_to_dict(parsed);
		if (!dict || !dict.location)
			return resp.finalUrl;

		return dict.location;
	};

	var extmap = {
		"jpeg": "jpg"
	};

	var get_ext_from_contenttype = function(contenttype) {
		var split = contenttype.match(/^\s*\[?([^/]+)\/([^/]+)\]?\s*$/);

		if (!split)
			return null;

		if (split[0] !== "image" && split[0] !== "video")
			return null;

		if (split[1] in extmap)
			return extmap[split[1]];

		return split[1];
	};

	// https://stackoverflow.com/a/18639999
	var makeCRCTable = function() {
		var c;
		var crcTable = [];
		for (var n =0; n < 256; n++) {
			c = n;
			for (var k =0; k < 8; k++) {
				c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
			}
			crcTable[n] = c;
		}
		return crcTable;
	};

	var cached_crc_table = null;
	var crc32 = function(str) {
		var crcTable = cached_crc_table || (cached_crc_table = makeCRCTable());
		var crc = 0 ^ (-1);

		for (var i = 0; i < str.length; i++) {
			crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
		}

		return (crc ^ (-1)) >>> 0;
	};

	var custom_xhr = function() {
		this._headers = {};
		this._response_headers = {};
		this._reqobj = null;
		this._last_readyState = null;

		this.open = function(method, url, synchronous) {
			this._method = method;
			this._url = url;
		};

		this.setRequestHeader = function(headername, headervalue) {
			headerobj_set(this._headers, headername, headervalue);
		};

		this.getResponseHeader = function(headername) {
			return headerobj_get(this._response_headers, headername);
		};

		this.getAllResponseHeaders = function() {
			return this._response_headers_raw;
		};

		this._handle_event = function(name, data) {
			if (data) {
				this.status = data.status || 0;
				this.statusText = data.statusText;
				this.response = data.response;
				this.readyState = data.readyState;
				this.responseText = data.responseText;
				this.responseType = data.responseType;
				this.responseURL = data.finalUrl;
				this._response_headers_raw = data.responseHeaders;
			}

			var event = {
				currentTarget: this,
				target: this,

				loaded: this.loaded,
				lengthComputable: this.lengthComputable,
				total: this.total
			};

			if (data && data.responseHeaders) {
				this._response_headers = headers_list_to_dict(parse_headers(data.responseHeaders));
			} else if (data) {
				this._response_headers = null;
			}

			if (this.readyState !== this._last_readyState) {
				if (this.onreadystatechange) this.onreadystatechange.bind(this)(event);
				this._last_readyState = this.readyState;
			}

			if (name === "load") {
				if (this.onload) this.onload.bind(this)(event);
				if (this.onloadend) this.onloadend.bind(this)(event);
			}

			if (name === "error") {
				if (this.onerror) this.onerror.bind(this)(event);
				if (this.onloadend) this.onloadend.bind(this)(event);
			}

			if (name === "abort") {
				if (this.onabort) this.onabort.bind(this)(event);
				if (this.onloadend) this.onloadend.bind(this)(event);
			}

			if (name === "progress") {
				if (this.onprogress) this.onprogress.bind(this)(event);
			}

			if (name === "timeout") {
				if (this.ontimeout) this.ontimeout.bind(this)(event);
			}
		};

		this.send = function(data) {
			var reqobj = {
				method: this._method,
				url: this._url,
				data: data,
				timeout: this.timeout || 0,
				withCredentials: this.withCredentials || true,
				responseType: this.responseType
			};

			if (Object.keys(this._headers).length > 0)
				reqobj.headers = this._headers;

			var add_listener = function(_this, event) {
				reqobj["on" + event] = function(resp) {
					_this._handle_event.bind(_this)(event, resp);
				};
			};

			add_listener(this, "load");
			add_listener(this, "error");
			add_listener(this, "abort");
			add_listener(this, "progress");
			add_listener(this, "timeout");

			this._reqobj = custom_xhr.do_request(reqobj);
		};

		this.abort = function() {
			if (!this._reqobj)
				return;

			this._reqobj.abort();
		};
	};

	custom_xhr.do_request = do_request;

	var run_sandboxed_lib = function(fdata, xhr) {
		if (true) {
			if (!xhr) {
				return new Function(fdata + ";return lib_export;")();
			} else {
				var overridden_xhr = true;
				if (!settings.custom_xhr_for_lib)
					overridden_xhr = false;

				var endshim = ";return {lib: lib_export, xhr: XMLHttpRequest, overridden_xhr: " + overridden_xhr + "};";
				if (overridden_xhr) {
					return new Function("XMLHttpRequest", fdata + endshim)(custom_xhr);
				} else {
					return new Function(fdata + endshim)();
				}
			}
		} else {
			// doesn't work unfortunately
			var frame = document_createElement('iframe');
			frame.srcdoc = ""; //"javascript:0"
			document.body.appendChild(frame);
			var result = frame.contentWindow.Function(fdata + ";return lib_export;")();
			frame.parentElement.removeChild(frame);

			return result;
		}
	};

	var lib_urls = {
		"testcookie_slowaes": {
			name: "testcookie_slowaes",
			url: "https://raw.githubusercontent.com/qsniyg/maxurl/5af5c0e8bd18fb0ae716aac04ac42992d2ddc2e5/lib/testcookie_slowaes.js",
			size: 31248,
			crc32: 2955697328,
			crc32_size: 2558359850
		},
		"dash": {
			name: "dash.all.debug",
			url: "https://raw.githubusercontent.com/qsniyg/maxurl/adbd983cf2982c4fc048c4aac9a2faa4ef35bed0/lib/dash.all.debug.js",
			size: 2232063,
			crc32: 73842610,
			crc32_size: 2151727295,
			xhr: true
		},
		"hls": {
			name: "hls",
			url: "https://raw.githubusercontent.com/qsniyg/maxurl/86ac4687d49aaf888674d4216cdbacd3b2e701e6/lib/hls.js",
			size: 711701,
			crc32: 3250521667,
			crc32_size: 2585153,
			xhr: true
		},
		"shaka": {
			name: "shaka.debug",
			url: "https://raw.githubusercontent.com/qsniyg/maxurl/92181434d66e43c70fdbb3e0660364b5e7e4cb14/lib/shaka.debug.js",
			size: 725133,
			crc32: 4071792531,
			crc32_size: 321129409,
			xhr: true
		},
		"cryptojs_aes": {
			name: "cryptojs_aes",
			url: "https://raw.githubusercontent.com/qsniyg/maxurl/22df70495741c2f90092f4cc0c504a1a2f6e6259/lib/cryptojs_aes.js",
			size: 13453,
			crc32: 4282597182,
			crc32_size: 3521118067
		}
	};

	var get_library = function(name, options, do_request, cb) {
		if (!options.allow_thirdparty_libs) {
			console_warn("Refusing to request library " + name + " due to 3rd-party library support being disabled");
			return cb(null);
		}

		if (!(name in lib_urls)) {
			console_error("Invalid library", name);
			return cb(null);
		}

		var lib_obj = lib_urls[name];

		if (is_scripttag) {
			return cb(null);
		} else if (is_node) {
			try {
				var lib = require("./lib/" + lib_obj.name + ".js");
				return cb(lib);
			} catch (e) {
				console.error(e);
				return cb(null);
			}
		}

		if (is_extension || is_userscript) {
			// Unfortunately in these cases it's less clean
			// Without building separate version of this for each use case, we have to fall back on "eval"ing (through `new Function`)
			lib_cache.fetch(name, cb, function (done) {
				if (is_extension) {
					// Thankfully in this case can query directly from the extension, removing possibility for XSS
					extension_send_message({
						type: "get_lib",
						data: {
							name: lib_obj.name
						}
					}, function (response) {
						if (!response || !response.data || !response.data.text)
							return done(null, 0); // 0 instead of false because it will never be available

						//done(new Function(response.data.text + ";return lib_export;")(), 0);
						done(run_sandboxed_lib(response.data.text, lib_obj.xhr), 0);
					});
				} else {
					// For the userscript, we have no other choice than to query and run arbitrary JS.
					// The commit is specified in lib_urls in order to prevent possible incompatibilities.
					// Unfortunately this still cannot prevent a very dedicated hostile takeover.
					// This is why we use the dual CRC32 check. Not bulletproof, but much better than nothing.
					// On my system it takes 6-30ms to do both CRC32 checks, so performance isn't really an issue.
					// FIXME: Perhaps this is unnecessary? The commit hash should change if the commit changes

					do_request({
						method: "GET",
						url: lib_obj.url,
						headers: {
							Referer: ""
						},
						onload: function(result) {
							if (result.readyState !== 4)
								return;

							if (result.status !== 200) {
								console_error(result);
								return done(null, false);
							}


							if (result.responseText.length !== lib_obj.size) {
								console_error("Wrong response length for " + name + ": " + result.responseText.length + " (expected " + lib_obj.size + ")");
								return done(null, false);
							}

							var crc = crc32(result.responseText);
							if (crc !== lib_obj.crc32) {
								console_error("Wrong crc32 for " + name + ": " + crc + " (expected " + lib_obj.crc32 + ")");
								return done(null, false);
							}

							crc = crc32(result.responseText + (lib_obj.size + ""));
							if (crc !== lib_obj.crc32_size) {
								console_error("Wrong crc32 #2 for " + name + ": " + crc + " (expected " + lib_obj.crc32_size + ")");
								return done(null, false);
							}


							done(run_sandboxed_lib(result.responseText, lib_obj.xhr), 0);
							//done(new Function(result.responseText + ";return lib_export;")(), 0);
						}
					});
				}
			});
		} else {
			return cb(null);
		}
	};


	var normalize_whitespace = function(str) {
		// https://stackoverflow.com/a/11305926
		return str
			.replace(/[\u200B-\u200D\uFEFF]/g, '')
			.replace(/[\u2800]/g, ' ');
	};

	var strip_whitespace_simple = function(str) {
		if (!str || typeof str !== "string") {
			return str;
		}

		return str
			.replace(/^\s+/, "")
			.replace(/\s+$/, "");
	};

	var strip_whitespace = function(str) {
		if (!str || typeof str !== "string") {
			return str;
		}

		return strip_whitespace_simple(normalize_whitespace(str));
	};

	var get_image_size = function(url, cb) {
		var image = new Image(url);
		var timeout = null;

		var finalcb = function(e) {
			image.onload = null;
			image.onerror = null;
			clearTimeout(timeout);

			var x, y;
			if (!image.naturalHeight || !image.naturalWidth) {
				x = null;
				y = null;
			}

			x = parseInt(image.naturalWidth);
			y = parseInt(image.naturalHeight);

			image.src = ""; // stop loading

			cb(x, y);
		};

		image.onload = image.onerror = finalcb;
		timeout = setInterval(function() {
			if (image.naturalHeight && image.naturalWidth) {
				finalcb();
			}
		}, 10);

		image.src = url;
	};

	if (is_node || typeof "Image" === "undefined") {
		get_image_size = null;
	}

	var sort_by_key = function(array, key) {
		return array.sort(function(a, b) {
			return (parseFloat(a[key]) || 0) - (parseFloat(b[key]) || 0);
		});
	};

	var parse_tag_def = function(tag) {
		var match = tag.match(/^<([-a-zA-Z0-9]+)((?:\s+[-a-z0-9A-Z]+(?:=(?:"[^"]+"|'[^']+'|[-_a-zA-Z0-9]+))?)*)\s*(\/?)>/);

		if (!match) {
			return null;
		}

		var parsed = {
			tagname: match[1],
			selfclosing: !!match[3],
			args: {},
			args_array: []
		};

		var args_regex = /\s+([-a-z0-9A-Z]+)(?:=("[^"]+"|'[^']+'|[-_a-zA-Z0-9]+))?/;
		var args = match[2];
		match = args.match(new RegExp(args_regex, "g"));
		if (!match)
			return parsed;

		for (var i = 0; i < match.length; i++) {
			var submatch = match[i].match(args_regex);

			var argname = submatch[1].toLowerCase();
			var argvalue = submatch[2];

			if (!argvalue) {
				argvalue = "";
			} else {
				argvalue = decode_entities(argvalue.replace(/^["'](.*)["']$/, "$1"));
			}

			parsed.args[argname] = argvalue;
			parsed.args_array.push({name: submatch[1], value: argvalue});
		}

		return parsed;
	};

	var get_meta = function(text, property) {
		var regex = new RegExp("<meta\\s+(?:(?:property|name)=[\"']" + property + "[\"']\\s+(?:content|value)=[\"']([^'\"]+)[\"']|(?:content|value)=[\"']([^'\"]+)[\"']\\s+(?:property|name)=[\"']" + property + "[\"'])\\s*\/?>");
		var match = text.match(regex);
		if (!match)
			return null;

		return decode_entities(match[1] || match[2]);
	};

	var fixup_js_obj = function(objtext) {
		return objtext
			.replace(/([{,])\s*([^[{,"'\s:]+)\s*:/g, "$1 \"$2\":")
			.replace(/(\"[^\s:"]+?\":)\s*'([^']*)'(\s*[,}])/g, "$1 \"$2\"$3")
			.replace(/,\s*}$/, "}");
	};

	// note: this is technically incorrect (too loose), as it'll allow things like:
	// {x: {} y: {}}
	// this is intentional, as otherwise it grows with exponential complexity ("kvcw*", "kvw?")
	var js_obj_token_types = {
		whitespace: /\s+/,
		jvarname: /[$_a-zA-Z][$_a-zA-Z0-9]*/,
		jpropname: /[$_a-zA-Z0-9]+/,
		number: /-?(?:[0-9]*\.[0-9]+|[0-9]+|[0-9]+\.)(?:e[0-9]+)?/,
		objstart: /{/,
		objend: /}/,
		object: ["objstart", "whitespace?", "kvcw*", "objend"],
		arrstart: /\[/,
		arrend: /]/,
		array: ["arrstart", "whitespace?", "valuecw*", "arrend"],
		true: /true/,
		false: /false/,
		null: /null/,
		value: [["array"], ["object"], ["sstring"], ["dstring"], ["number"], ["true"], ["false"], ["null"]],
		valuew: ["value", "whitespace?"],
		valuec: ["valuew", "comma?"],
		valuecw: ["valuec", "whitespace?"],
		comma: /,/,
		colon: /:/,
		squote: /'/,
		dquote: /"/,
		sstring: ["squote", "sliteral", "squote"],
		dstring: ["dquote", "dliteral", "dquote"],
		propname: [["jpropname"], ["sstring"], ["dstring"]],
		kv: ["propname", "whitespace?", "colon", "whitespace?", "value"],
		kvw: ["kv", "whitespace?"],
		kvc: ["kvw", "comma?"],
		kvcw: ["kvc", "whitespace?"],
		doc: [["object"], ["array"]]
	};

	var parse_js_obj = function(objtext, js_obj_token_types) {
		// for testing purposes
		/*var is_array = function(x) {
			return Array.isArray(x);
		};

		var array_extend = function(array, other) {
			[].push.apply(array, other);
		};*/

		js_obj_token_types = deepcopy(js_obj_token_types);

		for (var key in js_obj_token_types) {
			var value = js_obj_token_types[key];

			if (value instanceof RegExp) {
				js_obj_token_types[key] = {
					type: "regex",
					value: new RegExp("^" + value.source)
				};
			} else if (is_array(value)) {
				if (is_array(value[0])) {
					js_obj_token_types[key] = {
						type: "or",
						value: value
					};
				} else {
					js_obj_token_types[key] = {
						type: "and",
						value: value
					};
				}
			}
		}

		//console_log(js_obj_token_types);
		var times_ran = 0;
		var token_frequency = {};
		var stack_frequency = {};

		var find_token_regex = function(token_type, tt, i) {
			var text = objtext.substring(i);
			//console.log(text, tt, i);
			var match = text.match(tt);
			if (!match || match.index !== 0) {
				return null;
			} else {
				return [{
					name: token_type,
					i: i,
					ni: i + match[0].length,
					value: match[0],
					length: match[0].length
				}];
			}
		};

		var find_token_sliteral = function(token_type, i) {
			var quote = token_type === "dliteral" ? '"' : "'";
			var text = "";
			var escaping = false;
			var j;
			for (j = i; j < objtext.length; j++) {
				var ch = objtext[j];

				if (escaping) {
					escaping = false;
					if (ch === "x") {
						text += "\\u00" + objtext.substr(j+1, 2);
						j += 2;
					} else if (ch !== '"' && ch !== "'") {
						text += "\\" + ch;
					} else {
						text += ch;
					}

					continue;
				}

				if (ch === quote) {
					break;
				} else if (ch === "\\") {
					escaping = true;
				} else {
					text += ch;
				}
			}

			return [{
				name: token_type,
				i: i,
				ni: j,
				value: text,
				length: j - i
			}];
		}

		var find_token = function(token_type, i, stack) {
			//console_log(token_type, i);
			times_ran++;

			if (!(token_type in token_frequency))
				token_frequency[token_type] = 0;
			token_frequency[token_type]++;

			if (!(stack in stack_frequency))
				stack_frequency[stack] = 0;
			stack_frequency[stack]++;

			if (token_type === "sliteral" || token_type === "dliteral") {
				return find_token_sliteral(token_type, i);
			}

			var tt = js_obj_token_types[token_type];
			//console.log(token_type, tt);

			if (tt.type === "and") {
				return find_token_array_and(tt, i, stack);
			} else if (tt.type === "or") {
				return find_token_array_or(tt, i, stack);
			} else {
				return find_token_regex(token_type, tt.value, i);
			}
		};

		var find_token_array = function(array, i, stack) {
			var tokens = [];

			for (var j = 0; j < array.length; j++) {
				var token_type = array[j];
				var lastchar = token_type[token_type.length - 1];
				var minuslast = token_type.substring(0, token_type.length - 1);

				if (lastchar === "?") {
					//console.log("[START ?]", token_type, i, stack);
					var token = find_token(minuslast, i, stack+1);
					//console.log("[END ?]", token_type, i, stack, token);
					if (!token || token.length === 0)
						continue;

					array_extend(tokens, token);
					i = token[token.length - 1].ni;
				} else if (lastchar === "*") {
					while (true) {
						//console.log("[START *]", token_type, i, stack);
						var token = find_token(minuslast, i, stack+1);
						//console.log("[END *]", token_type, i, stack, token);
						if (!token || token.length === 0)
							break;

						array_extend(tokens, token);
						i = token[token.length - 1].ni;
					}
				} else {
					var token = find_token(token_type, i, stack+1);
					if (!token || token.length === 0) {
						if (tokens.length > 10 && false)
							console.log(tokens, token_type, i);
						return null;
					}

					array_extend(tokens, token);
					i = token[token.length - 1].ni;
				}
			}

			return tokens;
		};

		var find_token_array_and = function(tt, i, stack) {
			return find_token_array(tt.value, i, stack);
		};

		var find_token_array_or = function(tt, i, stack) {
			for (var j = 0; j < tt.value.length; j++) {
				var token = find_token_array(tt.value[j], i, stack);
				if (token && token.length) {
					return token;
				}
			}

			return null;
		};

		var outer_tokens = find_token("doc", 0, 0);
		return outer_tokens;
	};

	var fixup_js_obj_proper = function(objtext) {
		var parsed = parse_js_obj(objtext, js_obj_token_types);
		//console.log(parsed);
		if (!parsed)
			throw "unable to parse";

		var token_types = {
			whitespace: " ",
			jvarname: function(x) { return '"' + x + '"'; },
			jpropname: function(x) { return '"' + x + '"'; },
			squote: "\"",
			sliteral: function(x) { return x.replace(/"/g, "\\\""); },
			dliteral: function(x) { return x.replace(/"/g, "\\\""); }
		};

		var stringified = "";
		for (var i = 0; i < parsed.length; i++) {
			var token = parsed[i];

			if (token.name in token_types) {
				var tt = token_types[token.name];

				if (typeof tt === "function") {
					stringified += tt(token.value);
				} else {
					stringified += tt;
				}
			} else {
				stringified += token.value;
			}
		}

		return stringified;
	};

	// cookie: postpagebeta=0; postpagebetalogged=0
	common_functions.fetch_imgur_webpage = function(do_request, api_cache, headers, url, cb) {
		var cache_key = "imgur_webpage:" + url.replace(/^https?:\/\/(?:www\.)?imgur/, "imgur").replace(/[?#].*/, "");

		var apply_headers = false;

		var real_fetch = function(done) {
			var request_url = url.replace(/^http:/, "https:");

			var request_headers;
			if (apply_headers) {
				request_headers = headers;
			}

			do_request({
				url: request_url,
				method: "GET",
				headers: request_headers,
				onload: function(resp) {
					if (resp.readyState !== 4)
						return;

					if (resp.status !== 200) {
						console_error("Bad status for Imgur: " + resp.status);

						if (resp.status === 404) {
							return done({
								bad: true
							}, false);
						}

						return done(null, false);
					}

					var ogvideo, ogimage;

					var ogmatch = resp.responseText.match(/<meta\s+property=["']og:video["']\s+content=["'](.*?)["']/);
					if (ogmatch) {
						ogvideo = decode_entities(ogmatch[1]).replace(/\?.*/, "");
					}

					ogmatch = resp.responseText.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/);
					if (ogmatch) {
						ogimage = decode_entities(ogmatch[1]).replace(/\?.*/, "");
					}

					var retobj = {
						ogvideo: ogvideo,
						ogimage: ogimage
					};

					var imageinfo;
					var match = resp.responseText.match(/\.\s*mergeConfig\s*\(\s*["']gallery["']\s*,\s*{[\s\S]+?image\s*:\s*({.*?})\s*,\s*\n/);
					if (!match) {
						retobj.found_match = false;

						var nsfwmatch = resp.responseText.match(/<a.*?btn-wall--yes.*?\.(?:signin|cookie)\(/);
						var msg = "Unable to find match for Imgur page";

						if (nsfwmatch) {
							msg += " (it's probably NSFW and you aren't logged in)";
							retobj.nsfw = true;
						}

						console_warn(msg);

						if (headers && !apply_headers) {
							console_log("Retrying with custom headers");
							apply_headers = true;
							return real_fetch(done);
						}

						// Only cache it for 15 seconds (helpful if the user logs in)
						done(retobj, 15);
					} else {
						retobj.found_match = true;

						imageinfo = match[1];

						try {
							imageinfo = JSON_parse(imageinfo);
							retobj.imageinfo = imageinfo;

							if (imageinfo.source && imageinfo.hash && !imageinfo.is_album) {
								api_cache.set("imgur_imageinfo:" + imageinfo.hash, imageinfo, 6*60*60);
							}
						} catch (e) {
							console_error(e);
							console_log(match);
							imageinfo = undefined;
						}

						done(retobj, 6*60*60);
					};
				}
			});
		};

		api_cache.fetch(cache_key, cb, real_fetch);
	};

	common_functions.imgur_run_api = function(do_request, api_cache, endpoint, query, cb) {
		if (!query)
			query = {};

		query.client_id = base64_decode("IDU0NmMyNWE1OWM1OGFkNw==").slice(1);

		url = endpoint + "?" + stringify_queries(query);

		real_api_query(api_cache, do_request, "imgur_api:" + url, {
			url: url,
			imu_mode: "xhr",
			headers: {
				Referer: "https://imgur.com/"
			},
			json: true
		}, cb,
		function(done, resp) {
			return done(resp, 60*60);
		});
	};

	common_functions.imgur_api_fetch_album_media = function(do_request, api_cache, type, id, cb) {
		// another option: https://api.imgur.com/3/image/id?client_id=...
		//                 https://api.imgur.com/3/album/id?client_id=...
		// works for logged in accounts, does it work for anonymous accounts too? is there a reason to use this instead?

		if (type === "album")
			type = "albums";
		else if (type === "image")
			type = "media";

		var endpoint = "https://api.imgur.com/post/v1/" + type + "/" + id;
		// FIXME: is adconfig,account required?
		var query = {include: "media,adconfig,account"};

		return common_functions.imgur_run_api(do_request, api_cache, endpoint, query, cb);
	};

	common_functions.imgur_fetch_album_media = function(options, api_cache, type, id, cb) {
		if (type !== "album" && type !== "image") {
			console_error("Bug! Invalid type:", type);
			return cb(null);
		}

		var finalcb = function(data) {
			if (!data)
				return cb(data);

			var normalized = common_functions.imgur_normalize(data);
			return cb(normalized);
		};

		if (("rule_specific" in options) && ("imgur_source" in options.rule_specific) && options.rule_specific.imgur_source) {
			var url = "https://imgur.com/";
			if (type === "album")
				url += "a/";

			url += id;

			common_functions.fetch_imgur_webpage(options.do_request, api_cache, null, url, function(data) {
				// either new webpage or nsfw
				//console_log(data);
				if (!data || !data.found_match || !data.imageinfo) {
					return common_functions.imgur_api_fetch_album_media(options.do_request, api_cache, type, id, finalcb);
				} else {
					return finalcb(data.imageinfo);
				}
			});
		} else {
			return common_functions.imgur_api_fetch_album_media(options.do_request, api_cache, type, id, finalcb);
		}
	};

	common_functions.imgur_normalize = function(obj) {
		// v1
		if (!("media" in obj)) {
			if (obj.album_images) {
				// old web
				obj.media = obj.album_images.images;
			} else if (obj.images) {
				// v3
				obj.media = obj.images;
			}
		}

		// v1
		if (!("is_album" in obj)) {
			// old web
			if ("album_images" in obj)
				obj.is_album = true;
		}

		// v1
		if (!("url" in obj)) {
			if (obj.link) {
				// v3
				obj.url = obj.link;
			} else if (obj.hash) {
				// old web
				var prefix = "https://imgur.com/";
				if (obj.is_album) {
					prefix += "a/";
				}

				obj.url = prefix + obj.hash
			}
		}
		return obj;
	};

	common_functions.imgur_image_to_obj = function(options, baseobj, json) {
		var retobj = [];

		try {
			//if (!json.is_album && json.media && json.media.length === 1)
			//	json = json.media[0];

			var metadata = json;

			// api
			if (json.metadata)
				metadata = json.metadata;

			if (metadata.description || metadata.title) {
				baseobj.extra.caption = metadata.description || metadata.title;
			}

			if (!json.hash) {
				// v1?
				if (json.id) {
					json.hash = json.id;
				}
			}

			baseobj.extra.page = "https://imgur.com/" + json.hash;

			if (json.ext) {
				// v1?
				if (json.ext[0] !== ".")
					json.ext = "." + json.ext;
			}

			var realfilename = null;
			if (json.hash && json.ext) {
				realfilename = json.hash + json.ext;

				var base1obj = deepcopy(baseobj);

				// v1
				if (("rule_specific" in options) && ("imgur_filename" in options.rule_specific) && options.rule_specific.imgur_filename) {
					if (json.name)
						base1obj.filename = json.name;
				}

				var obj = deepcopy(base1obj);
				obj.url = "https://i.imgur.com/" + realfilename;

				var mimetype = json.mimetype || json.mime_type;
				if (/^video\//.test(mimetype)) {
					obj.video = true;
					retobj.push(obj);

					var obj = deepcopy(base1obj);
					obj.url = "https://i.imgur.com/" + json.hash + ".jpg"
					retobj.push(obj);
				} else {
					// Prefer video if possible
					var animated = metadata.is_animated || json.animated;
					// fixme: prefer_video isn't in the api version
					if (animated && (json.prefer_video || true)) {
						var newobj = deepcopy(base1obj);
						newobj.url = "https://i.imgur.com/" + json.hash + ".mp4";
						newobj.video = true;

						retobj.push(newobj);
					}

					retobj.push(obj);
				}
			}

			// (old) webpage
			if (json.source && /^https?:\/\//.test(json.source)) {
				if (!("rule_specific" in options) || !("imgur_source" in options.rule_specific) || options.rule_specific.imgur_source === true) {
					var newobj = {url: json.source};
					retobj.unshift(newobj);
				}
			}
		} catch (e) {
			console_error(e);

			retobj = [];
		}

		return retobj;
	};

	common_functions.deviantart_page_from_id = function(do_request, api_cache, id, cb) {
		var cache_key = "deviantart_page_from_id:" + id;

		api_cache.fetch(cache_key, cb, function (done) {
			do_request({
				method: "GET",
				url: "http://fav.me/" + id,
				onload: function (result) {
					if (result.status !== 200) {
						console_log(cache_key, result);
						return done(null, false);
					}

					done(result, 60 * 60);
				}
			});
		});
	};

	common_functions.wix_image_info = function(url) {
		// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/06653b48-43c3-403f-9d72-c1c5519db560/ddl6lkp-cde05779-5a0a-47d8-8d43-f31a063fd30e.jpg/v1/fill/w_623,h_350,q_100/into_the_light_by_pajunen_ddl6lkp-350t.jpg
		// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/faa48d2d-12c2-43d1-bf23-b5e99857825b/ddo0eau-c742e0f9-07f9-4a22-8d47-933e9fd3fb2b.png/v1/crop/w_244,h_350,x_0,y_0,scl_0.066812705366922,q_70,strp/railway_road_to_the_stars_by_ellysiumn_ddo0eau-350t.jpg

		// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/intermediary/f/e04c7e93-4504-4dbe-91f9-fd353fc145f2/dcx503r-30c02b72-c26d-4732-9c9f-14fcbc633aaa.jpg
		var match = url.match(/^[a-z]+:\/\/[^/]+\/+(?:intermediary\/+)?([if])\/+[-0-9a-f]{20,}\/+[^/?]+([?#].*)?$/);
		if (match) {
			var obj = {};
			if (match[3] && match[3][0] === "?") {
				obj.has_token = true;
			}

			if (match[1] === "i") {
				obj.preview = true;
			} else {
				obj.original = true;
			}

			return obj;
		}

		var match = url.match(/^[a-z]+:\/\/[^/]+\/+(?:intermediary\/+)?[if]\/+[-0-9a-f]{20,}\/+[^/]+\/+v1\/+(?:fit|fill|crop)\/+([^/]+)\/+[^/]+(?:[?#].*)?$/);
		if (!match) {
			return null;
		}

		var infostr = match[1];
		var splitted = infostr.split(",");

		var obj = {};

		for (var i = 0; i < splitted.length; i++) {
			if (splitted[i].match(/^[a-z]+$/)) {
				obj[splitted[i]] = true;
				continue;
			}

			var name = splitted[i].replace(/_.*$/, "");
			var value = splitted[i].replace(/^.*?_/, "");

			if (value.match(/^[-0-9.]+$/))
				value = parseFloat(value);

			obj[name] = value;
		}

		if (obj.w && obj.h) {
			obj.pixels = obj.w * obj.h;
		}

		return obj;
	};

	common_functions.wix_compare = function(url1, url2, prefer_size) {
		if (_nir_debug_)
			console_log("wix_compare", url1, url2, prefer_size);

		if (!url2)
			return url1;

		var info1 = common_functions.wix_image_info(url1);
		var info2 = common_functions.wix_image_info(url2);

		if (_nir_debug_)
			console_log("wix_compare (info1:", info1, "info2:", info2, ")");

		if (!info1 || !info2)
			return null;

		// needed to avoid constant reloading between /intermediary/ and /f/.*?token
		// thanks to Wisedrow on discord for reporting
		// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/intermediary/f/4ac770c0-c37b-43a0-866f-2a2707ea61c7/d854mkr-cf30cc53-6b99-4651-916d-1703c943255c.jpg
		if (info1.original && info2.original) {
			if (info2.has_token) {
				return url1;
			} else {
				return url2;
			}
		}

		if (info1.original && (!prefer_size || !info2.preview))
			return url1;

		if (info2.original && (!prefer_size || !info1.preview))
			return url2;

		if (info1.pixels && info2.pixels) {
			if (info1.pixels > info2.pixels)
				return url1;
			else if (info2.pixels > info1.pixels)
				return url2;
			else if (info1.q && info2.q) {
				if (info1.q > info2.q) {
					return url1;
				} else if (info2.q > info1.q) {
					return url2;
				}
			}
		}

		return null;
	};

	common_functions._wix_bigimage_inner = function(src) {
		newsrc = src.replace(/(:\/\/[^/]*\/)(f\/+[-0-9a-f]{36}\/+[0-9a-z]+-[-0-9a-f]{20,}(?:\.[^/.]*)?\/+v1\/+fill\/+w_[0-9]+,h_[0-9]+)(?:,[^/]+)?(\/+.*[?&]token=.*)$/, "$1$2,q_100$3");
		if (newsrc !== src) {
			return newsrc;
		}

		// thanks to MrSeyker on greasyfork: https://greasyfork.org/en/scripts/36662-image-max-url/discussions/34976#comment-160842
		newsrc = src.replace(/(:\/\/[^/]*\/f\/+[-0-9a-f]{36}\/+[0-9a-z]+-[-0-9a-f]{20,}\.(?:png|PNG)\/+v1\/+fill\/+[^/]+\/+[^/?#]+)\.[^/.?#]+(\?.*)?$/, "$1.png$2");
		if (newsrc !== src) {
			return newsrc;
		}

		newsrc = src.replace(/(:\/\/[^/]*\/)(f\/+[-0-9a-f]{36}\/+.*?)[?&]token=.*$/, "$1intermediary/$2");
		if (newsrc !== src) {
			return newsrc;
		}

		if (!src.match(/[?&]token=.{30,}/)) {
			newsrc = src
				.replace(/(\.[^/.]*)\/v1\/.*/, "$1")
				.replace(/(\/[^/.]*\.[^/.]*?)_[_0-9.a-z]*$/, "$1");

			if (newsrc !== src) {
				return newsrc;
			}
		}

		return null;
	};

	// FIXME: this is basically replicating bigimage_recursive
	common_functions.wix_bigimage = function(src) {
		var urls = [];

		while (src) {
			urls.unshift(src);
			src = common_functions._wix_bigimage_inner(src);
		}

		return urls;
	};

	common_functions.deviantart_fullimage = function(options, api_cache, src, id, cb) {
		// animated:
		// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/db0d85b1-b8b9-4790-bef0-121edb2dce7d/ddabn1h-5342115a-06a6-4f89-9c54-a2843719553a.jpg/v1/fit/w_150,h_150,q_70,strp/spaghetti_high_by_f1x_2_ddabn1h-150.jpg
		// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/db0d85b1-b8b9-4790-bef0-121edb2dce7d/ddabn1h-5342115a-06a6-4f89-9c54-a2843719553a.jpg -- 1920x1080, but original size says 1280x720 and is animated. however, it doesn't look upscaled either
		//   https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/db0d85b1-b8b9-4790-bef0-121edb2dce7d/ddabn1h-1d7ac558-1fa8-4943-a3b6-0ad8b06be106.gif
		common_functions.deviantart_page_from_id(options.do_request, api_cache, id, function(result) {
			if (!result) {
				return cb(null);
			}

			var obj = {
				url: null,
				waiting: false,
				extra: {
					page: result.finalUrl
				}
			};

			var urls = [];

			if (!src.match(/:\/\/[^/]*\/fake_image\//)) {
				array_extend(urls, common_functions.wix_bigimage(src));
			}

			var deviationid = result.finalUrl.replace(/.*-([0-9]+)(?:[?#].*)?$/, "$1");
			if (deviationid === result.finalUrl)
				deviationid = null;

			// Support the redesign
			var initialstate = result.responseText.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\((".*")\);\s*(?:window\.|<\/script)/);
			if (initialstate && deviationid) {
				initialstate = JSON_parse(JSON_parse(initialstate[1]));
				//console_log(initialstate);

				try {
					var entities = initialstate["@@entities"];
					var deviation = entities.deviation[deviationid];

					var deviationExtended = null;
					if (entities.deviationExtended)
						deviationExtended = entities.deviationExtended[deviationid];

					if (_nir_debug_) {
						console_log("Deviation object", deviation);
						console_log("Extended deviation object", deviationExtended);
					}

					if (deviation.title)
						obj.extra.caption = deviation.title;

					var maxurl = obj.url;

					var files = deviation.files;

					if (is_array(files)) {
						for (var i = files.length - 1; i >= 0; i--) {
							var current = files[i];
							var newurl = common_functions.wix_compare(current.src, maxurl, options.rule_specific.deviantart_prefer_size);
							if (newurl === current.src)
								maxurl = newurl;
						}
					} else if ("media" in deviation && is_array(deviation.media.types)) {
						if (deviation.media.prettyName)
							obj.filename = deviation.media.prettyName;

						var types = deviation.media.types;

						for (var i = types.length - 1; i >= 0; i--) {
							var link = null;

							var tokenid = 0;

							// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/40458dca-4360-4b4b-8aca-ba831f8db36d/ddsdflz-9484b31e-187e-4761-9724-6853698242a7.png/v1/fill/w_712,h_1123,q_100/morning_sun_by_pegaite_ddsdflz-pre.png
							// https://www.deviantart.com/pegaite/art/Morning-Sun-833716295
							if ("r" in types[i] && types[i].r < deviation.media.token.length)
								tokenid = types[i].r;

							var tokenq = "?token=" + deviation.media.token[tokenid];

							if (types[i].c) {
								link = deviation.media.baseUri + "/" + types[i].c.replace("<prettyName>", deviation.media.prettyName) + tokenq;
							} else if (types[i].b) { // e.g. animated gifs
								link = types[i].b + tokenq;
							} else if (types[i].t === "fullview" && "r" in types[i]) {
								// TODO: improve check?
								link = deviation.media.baseUri + tokenq;
							}

							// Occasionally this exists for some images, where it instead has:
							// s: "https://st.deviantart.net/misc/noentrythumb-200.png" (for t: "social_preview")
							if (!link)
								continue;

							var newurl = common_functions.wix_compare(link, maxurl, options.rule_specific.deviantart_prefer_size);
							if (newurl === link)
								maxurl = newurl;
						}
					}

					var suburls = [];
					var ourobj = {};

					suburls = common_functions.wix_bigimage(maxurl);

					var image_info = common_functions.wix_image_info(maxurl);
					if (false && image_info && image_info.original) {
						ourobj.is_original = true;
					}

					// basically: array_prepend(urls, suburls);
					array_extend(suburls, urls);
					urls = suburls;

					if (deviationExtended) {
						if (options.rule_specific.deviantart_support_download && deviationExtended.download && deviationExtended.download.url) {
							urls.unshift({
								url: deviationExtended.download.url,
								is_private: true
							});
						}
					}
				} catch (e) {
					console_error(e);
				}
			}

			if (false) {
				// remove duplicates (todo: factor this out?)
				var prevurls = new_set();
				for (var i = 0; i < urls.length; i++) {
					if (set_has(prevurls, urls[i].url)) {
						urls.splice(i, 1);
						i--;
					} else {
						set_add(prevurls, urls[i].url);
					}
				}
			}

			return cb(fillobj_urls(urls, obj));
		});
	};

	common_functions.get_testcookie_cookie = function(options, api_cache, site, cb) {
		var cache_key = "testcookie_cookie:" + site;
		var do_request = options.do_request;

		api_cache.fetch(cache_key, cb, function (done) {
			get_library("testcookie_slowaes", options, options.do_request, function (lib) {
				if (!lib) {
					console_error(cache_key, "Unable to fetch patched slowAES library");
					return done(null, false);
				}

				do_request({
					method: "GET",
					url: site,
					headers: {
						Referer: "",
						Cookie: ""
					},
					onload: function (result) {
						if (result.readyState !== 4)
							return;

						if (result.status !== 200) {
							console_log(cache_key, result);
							return done(null, false);
						}

						var matches = result.responseText.match(/[a-z]=\s*toNumbers\(["'][0-9a-f]+["']/g);
						if (!matches) {
							console_log(cache_key, "Unable to find toNumbers match", result);
							return done(null, false);
						}

						var vartable = {};
						for (var i = 0; i < matches.length; i++) {
							var match = matches[i].match(/([a-z])=toNumbers\(["']([0-9a-f]+)["']/);
							vartable[match[1]] = hex_to_numberarray(match[2]);
						}

						var slowaesmatch = result.responseText.match(/slowAES\.decrypt\s*\(\s*(.)\s*,\s*(.)\s*,\s*(.)\s*,\s*(.)\s*\)/);
						if (!slowaesmatch) {
							console_log(cache_key, "Unable to find slowAES match", result);
							return done(null, false);
						}

						var cookiename = result.responseText.match(/document\.cookie\s*=\s*["']([^='"]*?)=/);
						if (!cookiename) {
							console_log(cache_key, "Unable to find cookie name match", result);
							return done(null, false);
						} else {
							cookiename = cookiename[1];
						}

						var getarg = function(x) {
							if (/[a-z]/.test(x))
								return vartable[x];
							return parseInt(x);
						};

						var cookievalue = numberarray_to_hex(lib.decrypt(
							getarg(slowaesmatch[1]), getarg(slowaesmatch[2]),
							getarg(slowaesmatch[3]), getarg(slowaesmatch[4])));

						done(cookiename + "=" + cookievalue, 6*60*60);
					}
				});
			});
		});
	};

	common_functions.static_unpack_packer = function(format, base, in_table_length, in_table) {
		var encode_base62 = function(n) {
			var output = "";

			if (n >= base) {
				output = encode_base62(parseInt(n / base));
			}

			n = n % base;

			if (n > 35) {
				output += string_fromcharcode(n + 29);
			} else {
				output += n.toString(36);
			}

			return output;
		};

		var encode_base10 = function(n) {
			return n + "";
		};

		var encode_base36 = function(n) {
			return n.toString(base);
		};

		var encode;
		if (base === 10) {
			encode = encode_base10;
		} else if (base <= 36) {
			encode = encode_base36;
		} else { // base can be things like 14 too
			encode = encode_base62;
		}

		var table = {};

		for (var i = in_table_length; i >= 0; i--) {
			var encoded = encode(i);
			table[encoded] = in_table[i] || encoded;
		}

		return format.replace(/\b\w+\b/g, function(e) {
			return table[e];
		});
	};

	common_functions.unpack_packer = function(packed) {
		var regex = /eval\(function\(p,a,c,k,e,[rd]\){.*?return p}\('(.*?)',([0-9]+),([0-9]+),'(.*?)'\.split\('[|]'\)(?:,0,{})?\)\)/;
		var match = packed.match(regex);
		if (!match) {
			return null;
		}

		var format = match[1].replace(/([^\\])\\'/g, "$1'");
		var base = parseInt(match[2]);
		var table_length = parseInt(match[3]);
		var table = match[4].split("|");

		return common_functions.static_unpack_packer(format, base, table_length, table);
	};

	common_functions.instagram_username_from_sharedData = function(json) {
		if (json.username)
			return json.username;
		else {
			var entrydata = json.entry_data;

			if (entrydata.ProfilePage)
				return entrydata.ProfilePage[0].graphql.user.username;
			else
				return entrydata.PostPage[0].graphql.shortcode_media.owner.username;
		}
	};

	common_functions.instagram_get_imageid = function(image_url) {
		if (!image_url)
			return image_url;

		return image_url.replace(/.*\/([^/.]*)\.[^/.]*(?:[?#].*)?$/, "$1");
	};

	common_functions.instagram_norm_url = function(src) {
		// thanks to remlap on github: https://github.com/qsniyg/maxurl/issues/239
		return remove_queries(src, ["se", "_nc_cat", "_nc_rid", "efg", "ig_cache_key"]);
		// these remove_queries calls are separated in case the next one doesn't work.
		/*newsrc = remove_queries(src, ["se"]);
		if (newsrc !== src)
			return newsrc;

		newsrc = remove_queries(src, ["_nc_cat", "_nc_rid", "efg", "ig_cache_key"]);
		if (newsrc !== src)
			return newsrc;*/
	};

	common_functions.instagram_parse_el_info = function(api_cache, do_request, use_app_api, dont_use_web, info, host_url, cb) {
		var host_is_ig = /^[a-z]+:\/\/[^/]*\.instagram\.com\//.test(host_url);

		var shortcode_to_url = function(type, shortcode) {
			return "https://www.instagram.com/" + type + "/" + shortcode + "/";
		};

		var url_to_shortcode = function(url) {
			match = url.match(/^[a-z]+:\/\/[^/]+\/+(?:[^/]+\/+)?(?:p|tv|reel)\/+([^/]+)/);
			if (match)
				return match[1];
			return null;
		};

		var id_to_shortcode, shortcode_to_id;

		try {
			var shortcode_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
			var sixtyfour = BigInt(64);

			// TODO: don't use recursion
			var _id_to_shortcode = function(id) {
				if (id < sixtyfour) {
					return shortcode_table[parseInt(id)];
				} else {
					return id_to_shortcode(id / sixtyfour) + shortcode_table[id % sixtyfour];
				}
			};

			id_to_shortcode = function(id) {
				return _id_to_shortcode(BigInt(id));
			};

			var shortcode_to_id = function(shortcode) {
				shortcode = shortcode.substring(0, 11); // truncate for private ids
				var base = BigInt(0);

				for (var i = 0; i < shortcode.length; i++) {
					var index = BigInt(string_indexof(shortcode_table, shortcode[i]));
					base *= sixtyfour;
					base += index;
				}

				return base.toString();
			};
		} catch (e) {
			id_to_shortcode = shortcode_to_id = function() {
				console_warn("BigInt is not supported in your browser");
				return null;
			};
		}

		var get_sharedData_from_resptext = function(text) {
			try {
				var regex1 = /window\._sharedData = *(.*?);?<\/script>/;
				var regex2 = /window\._sharedData *= *(.*?}) *;[\s]*window\.__initialDataLoaded/;

				var match = text.match(regex1);
				if (!match) {
					match = text.match(regex2);
				}

				var parsed = JSON_parse(match[1]);

				var regex3 = /window\.__additionalDataLoaded\(["'].*?["']\s*,\s*({.*?})\);?\s*<\/script>/;
				match = text.match(regex3);
				if (match) {
					var parsed1 = JSON_parse(match[1]);
					for (var key in parsed.entry_data) {
						if (is_array(parsed.entry_data[key])) {
							parsed.entry_data[key][0] = overlay_object(parsed.entry_data[key][0], parsed1);
						}
					}
				}

				return parsed;
			} catch (e) {
				console_error(e);
			}

			return null;
		};

		var query_ig = function(url, cb) {
			if (!do_request)
				return cb(null);

			// Normalize the URL to reduce duplicate cache checks
			url = url
				.replace(/[?#].*/, "")
				.replace(/([^/])$/, "$1/")
				.replace(/^http:/, "https:")
				.replace(/(:\/\/)(instagram\.com\/)/, "$1www.$2")
				.replace(/(:\/\/.*?)\/\/+/g, "$1/");

			var cache_key = "instagram_sharedData_query:" + url;
			api_cache.fetch(cache_key, cb, function (done) {
				do_request({
					method: "GET",
					url: url,
					onload: function (result) {
						if (result.readyState !== 4)
							return;

						var parsed = get_sharedData_from_resptext(result.responseText);
						if (!parsed) {
							console_log("instagram_sharedData", result);
							return done(null, false);
						} else {
							return done(parsed, 60*60);
						}
					}
				});
			});
		};

		var uid_from_sharedData = function(json) {
			if (json.id)
				return json.id;
			else {
				var entrydata = json.entry_data;

				if (entrydata.ProfilePage)
					return entrydata.ProfilePage[0].graphql.user.id;
				else
					return entrydata.PostPage[0].graphql.shortcode_media.owner.id;
			}
		};

		var username_to_uid = function(username, cb) {
			if (username.match(/^http/)) {
				username = username.replace(/^[a-z]+:\/\/[^/]*\/+(?:stories\/+)?([^/]*)(?:\/.*)?(?:[?#].*)?$/, "$1");
			}

			var cache_key = "instagram_username_uid:" + username;
			api_cache.fetch(cache_key, cb, function (done) {
				query_ig("https://www.instagram.com/" + username + "/", function (json) {
					try {
						done(uid_from_sharedData(json), 5*60);
					} catch (e) {
						console_error(cache_key, e);
						done(null, false);
					}
				});
			});
		};

		var uid_to_profile = function(uid, cb) {
			var cache_key = "instagram_uid_to_profile:" + uid;
			api_cache.fetch(cache_key, cb, function (done) {
				var url = "https://i.instagram.com/api/v1/users/" + uid + "/info/";
				app_api_call(url, function (result) {
					if (!result)
						return done(null, false);

					if (result.readyState !== 4)
						return;

					try {
						var parsed = JSON_parse(result.responseText).user;

						// 5 minutes since they can change their profile pic often
						done(parsed, 5 * 60);
					} catch (e) {
						console_log("instagram_uid_to_profile", result);
						console_error("instagram_uid_to_profile", e);
						done(null, false);
					}
				});
			});
		};

		var get_instagram_cookies = function(cb) {
			// For now, we'll disable this as it doesn't appear to be needed
			if (true) {
				cb(null);
			} else {
				var cookie_cache_key = "instagram";
				if (cookie_cache.has(cookie_cache_key)) {
					return cb(cookie_cache.get(cookie_cache_key));
				}

				if (options.get_cookies) {
					options.get_cookies("https://www.instagram.com/", function(cookies) {
						cookie_cache.set(cookie_cache_key, cookies);
						cb(cookies);
					});
				} else {
					cb(null);
				}
			}
		};

		var app_api_call = function (url, cb) {
			if (!do_request) {
				return cb(null);
			}

			var headers = {
				//"User-Agent": "Instagram 10.26.0 (iPhone7,2; iOS 10_1_1; en_US; en-US; scale=2.00; gamut=normal; 750x1334) AppleWebKit/420+",
				//"User-Agent": "Instagram 10.26.0 Android (23/6.0.1; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US)",
				// thanks to ambler on discord for reporting, earlier UAs don't receive stories anymore
				"User-Agent": "Instagram 146.0.0.27.125 Android (23/6.0.1; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US)",
				"X-IG-Capabilities": "36oD",
				"Accept": "*/*",
				"Accept-Language": "en-US,en;q=0.8"
			};

			get_instagram_cookies(function(cookies) {
				if (cookies) {
					headers.Cookie = cookies_to_httpheader(cookies);
				}

				if (!use_app_api)
					headers.Cookie = "";

				do_request({
					method: "GET",
					url: url,
					headers: headers,
					onload: cb
				});
			});
		};

		var mediainfo_api = function(id, cb) {
			if (!use_app_api)
				return cb(null);

			var cache_key = "instagram_mediainfo:" + id;
			api_cache.fetch(cache_key, cb, function (done) {
				var url = "https://i.instagram.com/api/v1/media/" + id + "/info/";
				app_api_call(url, function (result) {
					if (!result)
						return done(null, false);

					if (result.readyState !== 4)
						return;

					if (result.status === 200) {
						var parsed = null;

						try {
							parsed = JSON_parse(result.responseText);
						} catch (e) {
							console_log("instagram_mediainfo", result);
							console_error("instagram_mediainfo", e);
						}

						if (_nir_debug_) {
							console_log("instagram_mediainfo", parsed);
						}

						if (parsed) {
							return done(parsed, 60 * 60);
						}
					} else {
						console_error(cache_key, result);
					}

					done(null, false);
				});
			});
		};

		var get_all_stories_api = function(uid, cb) {
			if (!use_app_api)
				return cb(null);

			var story_cache_key = "instagram_story_uid:" + uid;
			api_cache.fetch(story_cache_key, cb, function (done) {
				var url = "https://i.instagram.com/api/v1/feed/user/" + uid + "/reel_media/";
				app_api_call(url, function(result) {
					if (!result)
						return done(null, false);

					if (result.readyState !== 4)
						return;

					if (result.status !== 200) {
						console_log(story_cache_key, result);
						return done(null, false);
					}

					try {
						var parsed = JSON_parse(result.responseText);

						return done(parsed, 10*60);
					} catch(e) {
						console_log(story_cache_key, result);
						console_error(story_cache_key, e);
					}

					return done(null, false);
				});
			});
		};

		var story_api = function(picid, uid, cb) {
			var get_stories = function(cb) {
				get_all_stories_api(uid, function(result) {
					if (!result) {
						return cb(null);
					}

					try {
						var items = result.items;
						var all_images = [];
						var our_item = null;

						for (var i = 0; i < items.length; i++) {
							var item = items[i];

							var images = get_maxsize_app(item);
							if (images.length < 1) {
								console_warn("No images found for", item);
								continue;
							}
							var image = images[0];
							all_images.push(image);

							var item_picid = common_functions.instagram_get_imageid(image.src);
							api_cache.set("instagram_story_pic:" + item_picid, image, 6*60*60);

							if (image.video) {
								var item_vidid = common_functions.instagram_get_imageid(image.video);
								api_cache.set("instagram_story_pic:" + item_vidid, image, 6*60*60);
							}

							if (picid && (item_picid === picid || item_vidid === picid)) {
								our_item = image;
							}
						}

						if (picid) {
							if (our_item !== null)
								return cb(our_item);
						} else {
							return cb(all_images);
						}

						return cb(null);
					} catch (e) {
						console_log(cache_key, result);
						console_error(cache_key, e);
						return cb(null);
					}
				});
			};

			if (picid) {
				var cache_key = "instagram_story_pic:" + picid;
				api_cache.fetch(cache_key, cb, function (done) {
					get_stories(function(result) {
						if (result) {
							return done(result, 6*60*60);
						} else {
							return done(result, false);
						}
					});
				});
			} else {
				get_stories(cb);
			}
		};

		var profile_to_url = function(profile) {
			try {
				// Try using the app's API
				return profile.hd_profile_pic_url_info.url;
			} catch (e) {
				// Try using the normal browser json
				try {
					return profile.profile_pic_url;
				} catch (e) {
					console_error(e, profile);
					return null;
				}
			}
		};

		var request_profile = function(username, cb) {
			username_to_uid(username, function(uid) {
				if (!uid) {
					return cb(null);
				}

				uid_to_profile(uid, function(profile) {
					if (!profile) {
						return cb(null);
					}

					return cb(profile_to_url(profile));
				});
			});

			return {
				waiting: true
			};
		};

		var parse_caption = function(caption) {
			if (typeof caption === "string")
				return caption;

			if (caption.text)
				return caption.text;

			if (caption.edges && caption.edges.length > 0)
				return caption.edges[0].node.text;

			return null;
		};

		var get_caption = function(item) {
			if (item.caption)
				return parse_caption(item.caption);

			if (item.title)
				return parse_caption(item.title);

			if (item.edge_media_to_caption)
				return parse_caption(item.edge_media_to_caption);

			return undefined;
		};

		var get_page = function(item) {
			var shortcode = item.shortcode || item.code;
			if (!shortcode)
				return null;

			if (item.product_type === "igtv") {
				return shortcode_to_url("tv", shortcode);
			} else if (item.product_type === "clips") {
				return shortcode_to_url("reel", shortcode);
			} else {
				return shortcode_to_url("p", shortcode);
			}
		};

		var imageid_in_objarr = function(imageid, objarr) {
			for (var i = 0; i < objarr.length; i++) {
				if (imageid === "first")
					return objarr[i];

				if (string_indexof(objarr[i].src, imageid) > 0)
					return objarr[i];
			}

			return null;
		}

		var image_in_objarr = function(image, objarr, objarr1) {
			var imageid = common_functions.instagram_get_imageid(image);

			var largest = imageid_in_objarr(imageid, objarr);
			if (!largest)
				return null;

			var smallest = null;
			if (objarr1) {
				smallest = imageid_in_objarr(imageid, objarr1);
			}

			var retobj = {
				largest: largest
			};

			if (smallest && smallest !== largest) {
				retobj.smallest = smallest;
			}

			return retobj;
		};

		var get_maxsize_app = function(item) {
			var images = [];

			var get_corrected_height = function(img, candidate) {
				var corrected_height = candidate.height;
				if (!corrected_height) {
					corrected_height = (img.original_height / img.original_width) * candidate.width;
				}

				return corrected_height;
			};

			var parse_image = function (img) {
				var candidates = img.image_versions2.candidates;
				var maxsize = 0;
				var maxobj = null;

				for (var i = 0; i < candidates.length; i++) {
					candidates[i].corrected_height = get_corrected_height(img, candidates[i]);

					var size = candidates[i].width * candidates[i].corrected_height;
					if (size > maxsize) {
						maxsize = size;
						maxobj = candidates[i];
					}
				}

				var image = null;
				if (maxobj !== null) {
					image = {
						src: maxobj.url,
						caption: get_caption(item),
						page: get_page(item),
						width: maxobj.width,
						height: maxobj.height
					};
				}

				if (image && img.video_versions) {
					maxsize = 0;
					maxobj = null;
					var videos = img.video_versions;

					for (var i = 0; i < videos.length; i++) {
						videos[i].corrected_height = get_corrected_height(img, videos[i]);
						var size = videos[i].width * videos[i].corrected_height;
						if (size > maxsize) {
							maxsize = size;
							maxobj = videos[i];
						}
					}

					if (maxobj !== null) {
						image.video = maxobj.url;
						image.width = maxobj.width;
						image.height = maxobj.corrected_height;
					}
				}

				if (image !== null) {
					images.push(image);
				}
			};

			if ("carousel_media" in item) {
				for (var i = 0; i < item.carousel_media.length; i++) {
					parse_image(item.carousel_media[i]);
				}
			} else {
				parse_image(item);
			}

			return images;
		};

		var get_maxsize_graphql = function(media) {
			var images = [];

			var parse_image = function(node) {
				var image = node.display_src;
				if (!image)
					image = node.display_url;

				var width = 0, height = 0;
				if (node.dimensions) {
					width = node.dimensions.width;
					height = node.dimensions.height;
				}

				if (!image)
					return;

				var found_image = image_in_objarr(image, images);
				if (found_image) {
					var found_size = found_image.largest.width * found_image.largest.height;
					var our_size = width * height;

					// fixme: why is this check even here? it breaks width=0, height=0 videos
					if (our_size <= found_size || true)
						return;
				}

				if (node.video_url) {
					// width/height corresponds to the image, not the video
					// apparently not anymore?
					// https://www.instagram.com/p/CAIJRpshE0z/ (thanks to fireattack on discord)
					// https://www.instagram.com/p/CAatETTofMK/ graphql returns 640x640 but states it to be 750x750. app api returns 720x720, but is of a lower quality than 640x640 (thanks to remlap and Regis on discord)

					//width = 0;
					//height = 0;

					// This is a terrible hack, but it works
					if (width > 640) {
						var ratio = 640. / width;
						width *= ratio;
						height *= ratio;
					}
				}

				// hack to work around an issue in instagram's servers where they have null characters in their urls
				// thanks to fireattack on discord for reporting
				if (is_invalid_url(node.video_url) || is_invalid_url(image)) {
					width = 0;
					height = 0;
				}

				images.push({
					src: image,
					video: node.video_url,
					caption: get_caption(media),
					page: get_page(media),
					width: width,
					height: height
				});
			};

			if (media.edge_sidecar_to_children) {
				var edges = media.edge_sidecar_to_children.edges;
				for (var i = 0; i < edges.length; i++) {
					var edge = edges[i];
					if (edge.node)
						edge = edge.node;

					parse_image(edge);
				}
			}

			parse_image(media);

			return images;
		};

		var raw_image_to_obj = function(image, obj) {
			var extra = {};
			if (image.caption)
				extra.caption = image.caption;
			if (image.page)
				extra.page = image.page;

			if (image.video) {
				obj.push({url: common_functions.instagram_norm_url(image.video), video: true, extra: extra});
				obj.push({url: common_functions.instagram_norm_url(image.src), extra: extra});
			} else {
				obj.push({
					url: common_functions.instagram_norm_url(image.src),
					extra: extra
				});
			}

			return obj;
		};

		var image_to_obj = function(image) {
			if (!image)
				return null;

			var obj = [];

			raw_image_to_obj(image.largest, obj);
			if (image.smallest)
				raw_image_to_obj(image.smallest, obj);

			// TODO: maybe put videos before images?

			return obj;
		};

		var cache_graphql_post = function(edge) {
			if (edge.shortcode) {
				api_cache.set("graphql_ig_post:" + edge.shortcode, edge);
			}
		};

		var fill_graphql_cache_with_postpage = function(postpage_text) {
			if (!host_is_ig)
				return;

			var shareddata = get_sharedData_from_resptext(postpage_text);
			if (!shareddata)
				return;

			try {
				var entry_data = shareddata.entry_data;
				if ("ProfilePage" in entry_data) {
					var edges = entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges;

					for (var i = 0; i < edges.length; i++) {
						var edge = edges[i].node;
						cache_graphql_post(edge);
					}
				} else if ("PostPage" in entry_data) {
					var shortcode_media = entry_data.PostPage[0].graphql.shortcode_media;
					cache_graphql_post(shortcode_media);
				}
			} catch (e) {
				console_error(e, shareddata);
			}
		};

		var request_query_ig_post = function(url, cb) {
			query_ig(url, function(json) {
				if (!json) {
					return cb(null);
				}

				try {
					var media = json.entry_data.PostPage[0].graphql.shortcode_media;
					return cb(media);
				} catch (e) {
					console_error(e);
				}

				return cb(null);
			});
		};

		var request_ig_post = function(url, code, cb) {
			if (!code)
				return cb(null);

			var cache_key = "graphql_ig_post:" + code;

			api_cache.fetch(cache_key, function(data) {
				var needs_ig_query = false;

				if (data.__typename === "GraphVideo" && !data.video_url) {
					needs_ig_query = true;
				} else if (data.__typename === "GraphSidecar") {
					if (data.edge_sidecar_to_children && data.edge_sidecar_to_children.edges && data.edge_sidecar_to_children.edges.length > 0) {
						var edges = data.edge_sidecar_to_children.edges;

						for (var i = 0; i < edges.length; i++) {
							if (!edges[i] || !edges[i].node) {
								needs_ig_query = true;
								break;
							}

							if (edges[i].node.__typename === "GraphVideo" && !edges[i].node.video_url) {
								needs_ig_query = true;
								break;
							}
						}
					} else {
						needs_ig_query = true;
					}
				}

				if (needs_ig_query && do_request) {
					request_query_ig_post(url, function(newdata) {
						if (newdata) {
							api_cache.set(cache_key, newdata);
							data = newdata;
						}

						cb(data);
					});
				} else {
					cb(data);
				}
			}, function(done) {
				request_query_ig_post(url, function(data) {
					if (data) {
						return done(data, 60*60);
					} else {
						return done(null, false);
					}
				});
			});
		};

		var get_shortcode_to_id = function(post_url, shortcode, cb) {
			api_cache.fetch("ig_shortcode_to_id:" + shortcode, cb, function(done) {
				var id = shortcode_to_id(shortcode);
				if (id) {
					return done(id, 24*60*60);
				} else {
					request_ig_post(post_url, shortcode, function(media) {
						if (!media || !media.id) {
							return done(null, false);
						}

						return done(media.id, 24*60*60);
					});
				}
			});
		};

		var request_post_inner = function(post_url, image_url, cb) {
			var shortcode = url_to_shortcode(post_url);

			get_shortcode_to_id(post_url, shortcode, function(media_id) {
				if (!media_id) {
					return cb(null);
				}

				try {
					//media.id + "_" + media.owner.id
					mediainfo_api(media_id, function(app_response) {
						var images = [];
						var images_small = [];

						var images_app = [];
						var images_graphql = [];

						var need_graphql = !dont_use_web;

						if (app_response !== null) {
							images_app = get_maxsize_app(app_response.items[0]);
						} else {
							if (use_app_api) {
								console_warn("Unable to use API to find Instagram image, you may need to login to Instagram");
							}

							need_graphql = true;
						}

						var final = function() {
							if (_nir_debug_) {
								console_log("images_app", images_app);
								console_log("images_graphql", images_graphql);
							}

							if (!images_app || !images_app.length)
								images_app = null;

							if (!images_graphql || !images_graphql.length)
								images_graphql = null;

							if (!images_app && !images_graphql) {
								return cb(null);
							}

							if (images_app && images_graphql && images_app.length === images_graphql.length) {
								for (var i = 0; i < images_app.length; i++) {
									var app_size = images_app[i].width * images_app[i].height;
									var graphql_size = images_graphql[i].width * images_graphql[i].height;

									if (graphql_size > app_size) {
										//console_log("Using graphql image", images[i], images_graphql[i]);
										images[i] = images_graphql[i];
										images_small[i] = images_app[i];
									} else {
										images[i] = images_app[i];
										images_small[i] = images_graphql[i];
									}
								}
							} else {
								if (images_app) {
									images = images_app;
									images_small = images_graphql;
								} else {
									images = images_graphql;
									images_small = images_app;
								}
							}

							if (_nir_debug_) {
								console_log("images_small", images_small);
								console_log("images", images, image_url);
							}

							if (image_url) {
								var image = image_in_objarr(image_url, images, images_small);
								if (image)
									return cb(image_to_obj(image));
							} else {
								return cb(images);
							}

							cb(null);
						};

						if (need_graphql) {
							request_ig_post(post_url, shortcode, function(media) {
								if (media) {
									images_graphql = get_maxsize_graphql(media);
								}

								final();
							});
						} else {
							final();
						}
					});
				} catch (e) {
					console_error(e);
					cb(null);
				}
			});

			return {
				waiting: true
			};
		};

		var request_post = function(post_url, image_url, cb) {
			if (typeof document !== "undefined")
				fill_graphql_cache_with_postpage(document.documentElement.innerHTML);

			return request_post_inner(post_url, image_url, cb);
		};

		var request_stories = function(url, image_url, cb, all) {
			var username = url.replace(/.*\/stories\/+([^/]*).*$/, "$1");
			if (username === url)
				return null;

			username_to_uid(username, function(uid) {
				if (!uid) {
					return cb(null);
				}

				var image_id = common_functions.instagram_get_imageid(image_url);
				story_api(image_id, uid, function(result) {
					if (!result) {
						return cb(null);
					}

					var images = result;
					if (!is_array(images))
						images = [images];

					if (image_id) {
						var image = image_in_objarr(image_url, images);
						if (!image) {
							console_warn("Unable to find", image_url, "in", images);
							return cb(null);
						}

						return cb(image_to_obj(image));
					} else {
						return cb(images);
					}
				});
			});

			return {
				waiting: true
			};
		};

		var parse_single_el_info = function(info, cb) {
			var retval;

			if (info.type === "post") {
				if (info.all)
					info.image = null;

				retval = request_post(info.url, info.image, cb);
				if (retval)
					return retval;
			} else if (info.type === "profile") {
				retval = request_profile(info.url, cb);
				if (retval)
					return retval;
			} else if (info.type === "story") {
				if (info.all)
					info.image = null;

				retval = request_stories(info.url, info.image, cb);
				if (retval)
					return retval;
			}

			return retval;
		};

		var parse_el_info = function(info, cb) {
			var retval;

			for (var i = 0; i < info.length; i++) {
				retval = parse_single_el_info(info[i], cb);
				if (retval)
					return retval;
			}

			return retval;
		};

		return parse_el_info(info, cb);
	};

	common_functions.instagram_get_el_for_imageid = function(element) {
		var newel = element;
		if (newel.tagName === "SOURCE") {
			newel = newel.parentElement;
		}

		if (newel.tagName === "VIDEO" && newel.parentElement) {
			try {
				newel = newel.parentElement.querySelectorAll("img[srcset]");
				if (!newel || newel.length === 0)
					newel = element;
				else
					newel = newel[0];
			} catch (e) {
				console_error(e);
				newel = element;
			}
		} else {
			newel = element;
		}

		return newel;
	};

	common_functions.instagram_get_image_src_from_el = function(el) {
		if (el.tagName === "VIDEO") {
			// use the poster instead as the larger video urls differ
			return el.poster || el.src;
		} else if (el.tagName === "IMG") {
			return el.src;
		} else if (el.tagName === "DIV") {
			return el.style.backgroundImage.replace(/^url\(["'](.*)["']\)$/, "$1");
		}

		console_error("Unable to find source for", el);
		return;
	}

	common_functions.instagram_find_el_info = function(document, element, host_url) {
		var possible_infos = [];

		var element_src = common_functions.instagram_get_image_src_from_el(element);

		if (element.hasAttribute("data-imu-info")) {
			try {
				var json = JSON_parse(element.getAttribute("data-imu-info"));
				for (var i = 0; i < json.length; i++) {
					json[i].element = element;

					if (!json[i].image)
						json[i].image = element.src;

					delete json[i].all;
				}

				return json;
			} catch (e) {
				console_error("Unable to parse data-imu-info for", element);
			}
		}

		// check for links first
		var current = element;
		while ((current = current.parentElement)) {
			if (current.tagName !== "A")
				continue;

			if (current.href.match(/:\/\/[^/]+\/+(?:[^/]+\/+)?(?:p|tv|reel)\//)) {
				// link to post
				possible_infos.push({
					type: "post",
					subtype: "link",
					url: current.href,
					image: element_src,
					element: current
				});
			} else if (current.href.match(/:\/\/[^/]+\/+[^/]+(?:\/+(?:[?#].*)?)?$/)) {
				// link to profile (e.g. for someone who comments on a post)
				possible_infos.push({
					type: "profile",
					subtype: "link",
					url: current.href,
					element: current
				});
			}
		}

		current = element;
		while ((current = current.parentElement)) {
			// profile image
			// a better way would be to check the username from the h2 > a (title, href, innerText)
			if (current.tagName === "HEADER") {
				var sharedData = null;

				// Still keep this code because this way we can know it exists?
				// We can't use this directly because the user might have switched the profile they're currently viewing
				if (true) {
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
						sharedData = JSON_parse(sharedData);
					}
				}

				var url = host_url;
				if (url.match(/:\/\/[^/]+\/+p\//)) {
					var username;

					if (element.parentElement.tagName === "SPAN" && element.parentElement.getAttribute("role") === "link") {
						var as = current.getElementsByTagName("a");
						for (var i = 0; i < as.length; i++) {
							var a = as[i];
							var amatch = a.href.match(/^[a-z]+:\/\/[^/]+\/+([^/]+)\/*(?:[?#].*)?$/);
							if (amatch) {
								if (strip_whitespace(a.innerText).toLowerCase() === amatch[1].toLowerCase()) {
									username = strip_whitespace(a.innerText).toLowerCase();
									break;
								}
							}
						}
					}

					if (!username) {
						try {
							var h2 = current.querySelector("h2 > a");
							if (strip_whitespace(h2.innerText) === strip_whitespace(h2.title)) {
								username = h2.innerText;
							}
						} catch (e) {}
					}

					if (!username) {
						try {
							// There are 2 h1's, the first should be the username (the second is the person's "name")
							username = current.querySelector("section h1").innerText;
						} catch (e) {
							console_error(e);
						}
					}

					if (username) {
						url = "https://www.instagram.com/" + strip_whitespace(username);//common_functions.instagram_username_from_sharedData(sharedData);
					} else {
						url = null;
					}
				}

				if (url) {
					possible_infos.push({
						type: "profile",
						subtype: "page",
						url: url,
						element: current
					});
				}
			}

			// popup
			if ((current.tagName === "DIV" && current.getAttribute("role") === "dialog") ||
				// post page
				(current.tagName === "BODY" && host_url.match(/:\/\/[^/]*\/+(?:[^/]+\/+)?(?:p|tv|reel)\//))) {
				possible_infos.push({
					type: "post",
					subtype: current.tagName === "BODY" ? "page" : "popup",
					url: host_url,
					image: element_src,
					element: current
				});
			}

			// home
			if (current.tagName === "ARTICLE" && host_url.match(/:\/\/[^/]+\/+(?:[?#].*)?$/)) {
				var timeel = current.querySelector("a > time");
				if (timeel) {
					var href = timeel.parentElement.href;
					if (/:\/\/[^/]*\/+(?:[^/]+\/+)?p\//.test(href)) {
						possible_infos.push({
							type: "post",
							subtype: "home",
							url: href,
							image: element_src,
							element: current
						});
					}
				}
			}

			// stories
			// https://www.instagram.com/stories/hollyearl__/2271839116690161119/
			if (current.tagName === "BODY" && host_url.match(/:\/\/[^/]*\/+stories\/+([^/]*)(?:\/+[0-9]+)?\/*(?:[?#].*)?$/)) {
				// try to find image instead of video because video ids change for app stories
				var newel = common_functions.instagram_get_el_for_imageid(element);

				possible_infos.push({
					type: "story",
					url: host_url,
					image: newel.src,
					element: current
				});
			}
		}

		return possible_infos;
	};

	common_functions.get_twitter_caption = function(el) {
		var currentel = el;
		while ((currentel = currentel.parentElement)) {
			if (currentel.tagName === "ARTICLE") {
				var captiondiv = currentel.querySelectorAll("div[lang]");
				if (captiondiv && captiondiv.length === 1) {
					return captiondiv[0].innerText;
				}

				break;
			}
		}

		return null;
	};

	common_functions.get_twitter_video_tweet = function(el, window) {
		if (el.tagName !== "VIDEO" || !el.src.match(/^blob:/))
			return null;

		var poster = el.poster;
		if (!poster)
			return null;

		// note that the numbers here corresponds to the media id, not the tweet id, so it can't be used
		if (!/\/ext_tw_video_thumb\/+[0-9]+\/+pu\/+img\//.test(poster))
			return null;

		var href = window.location.href;

		// embedded video
		var match = href.match(/\/i\/+videos\/+tweet\/+([0-9]+)(?:[?#].*)?$/);
		if (match) {
			return {
				id: match[1]
			};
		}

		var currentel = el;
		while ((currentel = currentel.parentElement)) {
			if (currentel.tagName === "ARTICLE") {
				var our_as = currentel.querySelectorAll("a[role='link']");
				for (var i = 0; i < our_as.length; i++) {
					var our_href = our_as[i].href;
					if (!our_href)
						continue;

					var match = our_href.match(/\/status\/+([0-9]+)(?:\/+(?:retweets|likes)|\/*)(?:[?#].*)?$/);
					if (match) {
						return {
							id: match[1]
						};
					}
				}
				break;
			}
		}

		return null;
	};

	common_functions.get_snapchat_story = function(api_cache, do_request, username, cb) {
		var cache_key = "snapchat_story:" + username;
		api_cache.fetch(cache_key, cb, function(done) {
			do_request({
				method: "GET",
				url: "https://search.snapchat.com/lookupStory?id=" + username,
				headers: {
					"sec-fetch-dest": "empty",
					"sec-fetch-mode": "cors",
					"sec-fetch-site": "same-site",
					"Origin": "https://www.snapchat.com",
					"Referer": "https://www.snapchat.com/add/" + username // maybe use real url instead?
				},
				onload: function(resp) {
					if (resp.readyState !== 4)
						return;

					if (resp.status !== 200) {
						console_error(resp);
						return done(null, false);
					}

					try {
						var json = JSON_parse(resp.responseText);
						return done(json, 60); // story can change, so 60 seconds? or less?
					} catch (e) {
						console_error(e, resp);
						return done(null, false);
					}
				}
			});
		});
	};

	common_functions.get_snapchat_storysharing = function(api_cache, do_request, username, cb) {
		var cache_key = "snapchat_storysharing:" + username;
		api_cache.fetch(cache_key, cb, function(done) {
			do_request({
				method: "GET",
				url: "https://storysharing.snapchat.com/v1/fetch/" + username + "?request_origin=ORIGIN_WEB_PLAYER",
				headers: {
					"sec-fetch-dest": "empty",
					"sec-fetch-mode": "cors",
					"sec-fetch-site": "same-site",
					"Origin": "https://www.snapchat.com",
					"Referer": "https://www.snapchat.com/add/" + username // maybe use real url instead?
				},
				onload: function(resp) {
					if (resp.readyState !== 4)
						return;

					if (resp.status !== 200) {
						console_error(resp);
						return done(null, false);
					}

					try {
						var json = JSON_parse(resp.responseText);
						var story = json.story;
						return done(story, 60); // story can change, so 60 seconds? or less?
					} catch (e) {
						console_error(e, resp);
						return done(null, false);
					}
				}
			});
		});
	};

	common_functions.snap_norm_obj = function(obj) {
		// ids are not very human-readable, maybe add an option?
		match = obj.url.match(/:\/\/[^/]+\/+[0-9a-f]{2}\/+([^/]{10,})\//);
		if (match) {
			// = causes issues with ffmpeg (thanks to remlap on discord for reporting), - can cause issues with command-line args
			obj.filename = match[1].replace(/[-=]/g, "");
		}

		return obj;
	};

	common_functions.snap_to_obj = function(snap) {
		var caption = null;

		// Apparently this isn't related to the caption?
		if (false) {
			caption = snap.snapTitle + snap.snapSubtitles;
			caption = caption.replace(/^\s*([\s\S]*)\s*$/, "$1");
		}

		var obj = {
			url: snap.media.mediaUrl,//snap.snapUrls.mediaUrl,
			extra: {
				caption: caption || null
			},
			need_blob: true
		};

		common_functions.snap_norm_obj(obj);

		return obj;
	};

	common_functions.get_snapchat_info_from_el = function(el) {
		if (el.getAttribute("data-imu")) {
			return {
				username: el.getAttribute("data-username"),
				pos: parseInt(el.getAttribute("data-pos")),
				url: el.getAttribute("data-url")
			};
		}

		if (el.tagName !== "VIDEO" && el.tagName !== "IMG") {
			// <div class="css-crr1df" style="background-image: url(&quot;blob:https://www.snapchat.com/...&quot;);"></div>
			if (el.tagName !== "DIV" || !el.style.backgroundImage || el.style.backgroundImage.indexOf("blob:") < 0) {
				return null;
			}
		}

		var current = el;
		while ((current = current.parentElement)) {
			if (current.tagName === "DIV" && current.getAttribute("role") === "presentation") {
				var username = "";

				var as = current.getElementsByTagName("a");
				for (var i = 0; i < as.length; i++) {
					var match = as[i].href.match(/^[a-z]+:\/\/story\.snapchat\.com\/+s\/+([^/?#]+)(?:[?#].*)?$/);
					if (match) {
						username = match[1];
						break;
					}
				}

				var pos = 0;

				var prevbutton = current.querySelector("#PrevButton");
				if (prevbutton) {
					pos = 1;
				}

				var nextbutton = current.querySelector("#NextButton");
				if (!nextbutton) {
					pos = -1;
				}

				return {
					username: username,
					pos: pos
				};
			}
		}

		return null;
	};

	common_functions.get_obj_from_snap_info = function(api_cache, do_request, info, cb) {
		if (!info) {
			return cb(null);
		}

		common_functions.get_snapchat_storysharing(api_cache, do_request, info.username, function(data) {
			if (!data) {
				return cb(null);
			}

			if (info.pos === -1) {
				info.pos = data.snaps.length - 1;//data.snapList.length - 1;
			}

			return cb(common_functions.snap_to_obj(data./*snapList*/snaps[info.pos]));
		});
	};

	common_functions.get_md5 = function(options, text, cb) {
		get_library("cryptojs_aes", options, options.do_request, function(CryptoJS) {
			if (!CryptoJS) {
				console_error("Unable to fetch CryptoJS");
				return cb(null);
			}

			try {
				return cb(CryptoJS.MD5(text).toString());
			} catch (e) {
				console_error(e);
				return cb(null);
			}
		});
	};

	common_functions.get_tiktok_urlvidid = function(url) {
		var match = url.match(/^[a-z]+:\/\/[^/]+\/+(?:[0-9a-f]{32}\/+[0-9a-f]{8}\/+)?video\/+(?:[^/]+\/+)?[^/]+\/+[^/]+\/+([0-9a-f]{32})\/*\?/);
		if (match)
			return match[1];

		return null;
	};

	common_functions.set_tiktok_vid_filename = function(obj) {
		var vidid = common_functions.get_tiktok_urlvidid(obj.url);
		if (vidid) {
			obj.filename = vidid + ".mp4"; // hack, but needed because firefox etc. doesn't automatically set the extension, because content-type isn't set
			return true;
		}

		return false;
	};

	common_functions.get_tiktok_weburl_parts = function(url) {
		var match = url.match(/^[a-z]+:\/\/[^/]+\/+@([^/]+)\/+video\/+([0-9]+)(?:[?#].*)?$/);
		if (!match) {
			return null;
		}

		return {
			username: match[1],
			web_vid: match[2]
		};
	};

	common_functions.get_tiktok_from_ttloader = function(site, api_cache, do_request, url, cb) {
		// https://codecanyon.net/item/tiktok-video-downloader-wordpress-plugin/26370715
		// returns hd (720p)
		// ttloader.com, onlinetik.com, demo.wppress.net, tiktokdownloader.in, savevideo.ninja
		// uses older versions (watermarked):
		// tiktoktoolstation.com (video.src)
		var cache_key = site + ":" + url;
		site = site.replace(/:.*/, "");
		real_api_query(api_cache, do_request, cache_key, {
			url: "https://" + site + "/wp-json/wppress/tiktok-downloader/videos?search=" + encodeURIComponent(url) + "&type=video_url&max=0",
			headers: {
				Referer: "https://" + site + "/?tiktok-search=" + encodeURIComponent(url),
				"X-Requested-With": "XMLHttpRequest",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
				"Accept": "application/json, text/javascript, */*; q=0.01"
			},
			json: true
		}, cb, function(done, resp, cache_key) {
			var nowm = resp.items[0].video.noWatermark;
			if (!nowm) {
				console_error(cache_key, "Unable to find noWatermark from", resp);
				return done(null, false);
			}

			return done(nowm, 60*60);
		});
	};

	common_functions.get_tiktok_from_ttloader_token = function(site, api_cache, do_request, url, cb, options) {
		url = url.replace(/\?.*/, "");

		var cache_key = site + ":" + url;
		site = site.replace(/:.*/, "");

		var referer = "https://" + site + "/?tiktok-search=" + encodeURIComponent(url);
		if (site === "savevideo.ninja")
			referer = "https://" + site + "/tiktok-no-watermark-video-downloader/?tiktok-search=" + encodeURIComponent(url);

		var get_raw_token = function(cb) {
			real_api_query(api_cache, do_request, site + ":token", {
				method: "POST",
				url: "https://" + site + "/wp-json/wppress/tiktok-downloader/token",
				imu_mode: "xhr",
				data: "",
				headers: {
					Origin: "https://" + site,
					Referer: referer,
					"x-requested-with": "XMLHttpRequest"
				},
				json: true
			}, cb, function(done, resp, cache_key) {
				if (resp.token)
					return done(resp.token, 60*60);

				console_error(cache_key, "Unable to find token from", resp);
				return done(null, false);
			});
		};

		var parse_raw_token = function(raw_token, url, requesttype, useragent, cb) {
			var urladd = "";
			if (requesttype === "videos")
				urladd = "0";

			var catted = raw_token + ":" + url + urladd + ":" + useragent;
			var encoded = unescape(encodeURIComponent(catted));

			//console_log(encoded);
			common_functions.get_md5(options, encoded, cb);
		};

		var get_video_api = function(token, url, cb) {
			real_api_query(api_cache, do_request, cache_key, {
				method: "POST",
				url: "https://" + site + "/wp-json/wppress/tiktok-downloader/videos",
				data: "search=" + encodeURIComponent(url) + "&type=video_url&max=0&token=" + token,
				imu_mode: "xhr",
				headers: {
					Referer: referer,
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
					"x-requested-with": "XMLHttpRequest"
				},
				json: true
			}, cb, function(done, resp, cache_key) {
				var nowm = resp.items[0].video.noWatermark;
				if (!nowm) {
					console_warn(cache_key, "Unable to find noWatermark from", resp);

					if (false) {
						nowm = resp.items[0].video.playAddr;
						if (!nowm) {
							console_error(cache_key, "Unable to find downloadAddr from", resp);
							return done(null, false);
						}
					} else {
						return done(null, false);
					}
				}

				return done(nowm, 60*60);
			});
		};

		var get_nowatermark_videourl = function(token, url) {
			var url = "https://" + site + "/wp-admin/admin-ajax.php?action=wppress_tt_download&url=" + encodeURIComponent(url) + "&key=no-watermark&token=" + token;
			return {
				url: url,
				headers: {
					Referer: "https://" + site + "/?tiktok-search=" + encodeURIComponent(url),
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
					"Sec-Fetch-Dest": "document",
					"Sec-Fetch-Mode": "navigate",
					"Sec-Fetch-Site": "same-origin",
					"Sec-Fetch-User": "?1"
				},
				// linked to user-agent
				is_private: true
			};
		};

		get_raw_token(function(raw_token) {
			if (!raw_token)
				return cb(null);

			if (false) {
				parse_raw_token(raw_token, url, "videos", navigator.userAgent, function(token) {
					if (!token)
						return cb(null);

					//console_log(token);
					get_video_api(token, url, cb);
				});
			} else {
				parse_raw_token(raw_token, url, "nowatermark", navigator.userAgent, function(token) {
					if (!token)
						return cb(null);

					return cb(get_nowatermark_videourl(token, url));
				});
			}
		});
	};

	common_functions.get_tiktok_from_socialvideodownloader = function(site, api_cache, do_request, url, cb) {
		// https://codecanyon.net/item/social-video-downloader-wordpress-plugin/26563734?s_rank=3
		// https://demo.wppress.net/social-video-downloader/
		// hd:
		// savevideo.ninja (thanks to remlap on discord)
		var cache_key = site + ":" + url;
		site = site.replace(/:.*/, "");
		real_api_query(api_cache, do_request, cache_key, {
			url: "https://" + site + "/wp-json/wppress/video-downloader/videos?url=" + encodeURIComponent(url),
			headers: {
				Referer: "https://" + site + "/",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
				"Accept": "application/json, text/javascript, */*"
			},
			json: true
		}, cb, function(done, resp, cache_key) {
			var urls = resp[0].urls;
			var ids = {};
			for (var i = 0; i < urls.length; i++) {
				ids[urls[i].id] = urls[i];
			}

			if (!("vid-no-watermark" in ids)) {
				console_error(cache_key, "Unable to find vid-no-watermark in", {ids: ids, resp: resp});
				return done(null, false);
			}

			return done(ids["vid-no-watermark"]["src"], 60*60);
		});
	};

	common_functions.get_tiktok_from_keeptiktok = function(site, api_cache, do_request, url, cb) {
		var urlparts = common_functions.get_tiktok_weburl_parts(url);
		if (!urlparts) {
			console_error("Invalid url", url);
			return cb(null);
		}

		var cache_key = site + ":" + url;
		real_api_query(api_cache, do_request, cache_key, {
			url: "https://" + site + "/" + urlparts.username + "/" + urlparts.web_vid
		}, cb, function(done, resp, cache_key) {
			var match = resp.responseText.match(/<video[^>]+>\s*<source src="(https?:\/\/[^/]*tiktokcdn\.[^"]+)"/);
			if (!match) {
				console_error(cache_key, "Unable to find match for", resp);
				return done(null, false);
			}

			return done(decode_entities(match[1]), 60*60);
		});
	};

	common_functions.get_tiktok_from_snaptik = function(site, api_cache, do_request, url, cb) {
		var urlparts = common_functions.get_tiktok_weburl_parts(url);
		if (!urlparts) {
			console_error("Invalid url", url);
			return cb(null);
		}

		var query_snaptik_1 = function(url) {
			url = url.replace(/[?#].*/, "");
			var cache_key = site + ":" + url;
			api_cache.fetch(cache_key, cb, function(done) {
				// first query is to populate the cookies
				do_request({
					url: "https://snaptik.app/", //pre_download.php?aweme_id=" + urlparts.web_vid,
					imu_mode: "document",
					method: "GET",
					onload: function(resp) {
						if (resp.status !== 200) {
							console_error(cache_key, resp);
							return done(null, false);
						}

						// this query is needed for the third to work
						do_request({
							method: "POST",
							url: "https://snaptik.app/check_user.php",
							imu_mode: "xhr",
							headers: {
								Referer: "https://" + site + "/"
							},
							imu_multipart: {},
							onload: function(resp) {
								if (resp.status !== 200) {
									console_error(cache_key, resp);
									return done(null, false);
								}

								do_request({
									method: "POST",
									url: "https://" + site + "/action-v9.php",
									imu_mode: "xhr",
									imu_multipart: {
										url: url
									},
									headers: {
										Referer: "https://snaptik.app/", //pre_download.php?aweme_id=" + urlparts.web_vid,
									},
									onload: function(resp) {
										if (resp.status !== 200) {
											console_error(cache_key, resp);
											return done(null, false)
										}

										var match = resp.responseText.match(/<a[^>]*\s+href=["']https?:\/\/sv[0-9]*\.snaptik.app\/+dl\.php\?token=([^&]+)/);
										if (!match) {
											console_error(cache_key, "Unable to find match for", resp);
											return done(null, false);
										}

										return done(base64_decode(decodeURIComponent(decode_entities(match[1]))), 60*60);
									}
								});
							}
						});
					}
				});
			});
		}

		query_snaptik_1(url);
	};

	common_functions.get_tiktok_from_musicallydown = function(site, api_cache, do_request, url, cb) {
		var get_token_data = function(cb) {
			// using real_api_query even if we don't cache because it's just less code than do_request
			real_api_query(api_cache, do_request, "musicallydown:vtoken", {
				url: "https://musicallydown.com"
			}, cb, function(done, resp, cache_key) {
				var match = resp.responseText.match(/<input name="(_[a-zA-Z0-9]+)" type="hidden" value="([0-9a-f]{5,})" \/>/);
				if (!match) {
					console_error(cache_key, "Unable to find token from", resp);
					return done(null, false);
				}

				var obj = {
					token_name: match[1],
					token_value: match[2]
				};

				match = resp.responseText.match(/<input name="(_[a-zA-Z0-9]+)" type="text"[^/]+id="link_url"/);
				if (!match) {
					console_error(cache_key, "Unable to find link name from", resp);
					return done(null, false);
				}

				obj.link_name = match[1];

				return done(obj, false);
			});
		};

		var query_musicallydown = function(url, token, cb) {
			var cache_key = site + ":" + url;
			real_api_query(api_cache, do_request, cache_key, {
				url: "https://musicallydown.com/download",
				method: "POST",
				imu_mode: "document",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"Origin": "https://musicallydown.com",
					"Referer": "https://musicallydown.com/",
				},
				data: token.link_name + "=" + encodeURIComponent(url) + "&" + token.token_name + "=" + token.token_value
			}, cb, function(done, resp, cache_key) {
				var match = resp.responseText.match(/<a\s+(?:style="[^"]+"\s+)?target="_blank" rel="noreferrer" href="(https?:\/\/[^/]*tiktokcdn\.com\/[^"]+)"[^>]*>\s*<i[^>]*>\s*<\/i>\s*Download MP4/);
				if (!match) {
					console_error(cache_key, "Unable to find match from", resp);
					return done(null, false);
				}

				return done(decode_entities(match[1]), 60*60);
			});
		};

		get_token_data(function(token) {
			if (!token)
				return cb(null);

			query_musicallydown(url, token, cb);
		});
	};

	common_functions.get_tiktok_from_ssstiktok = function(site, api_cache, do_request, url, cb) {
		var get_token = function(cb) {
			real_api_query(api_cache, do_request, "ssstiktok:token", {
				url: "https://ssstiktok.io"
			}, cb, function(done, resp, cache_key) {
				var match = resp.responseText.match(/<form.*?data-hx-post=".*?>/);
				if (!match) {
					console_error(cache_key, "Unable to find match from", resp);
					return done(null, false);
				}

				var parsed = parse_tag_def(match[0]);
				var url = urljoin("https://ssstiktok.io/", parsed.args["data-hx-post"], true);

				try {
					var include_vals = JSON_parse(fixup_js_obj("{" + parsed.args["include-vals"] + "}"));
				} catch (e) {
					console_error(cache_key, e);
					return done(null, false);
				}

				match = resp.responseText.match(/<input id="locale".*?>/);
				if (!match) {
					console_error(cache_key, "Unable to find locale", resp);
					return done(null, false);
				}

				parsed = parse_tag_def(match[0]);
				include_vals.locale = parsed.args.value;

				return done({
					url: url,
					queries: include_vals
				}, false);
			});
		};

		var query_ssstiktok = function(url, token, cb) {
			var cache_key = site + ":" + url;
			token.queries.id = encodeURIComponent(url);
			real_api_query(api_cache, do_request, cache_key, {
				url: token.url,
				method: "POST",
				imu_mode: "xhr",
				headers: {
					"HX-Active-Element": "submit",
					"HX-Current-URL": "https://ssstiktok.io/",
					"HX-Request": "true",
					"HX-Target": "target",
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
				},
				data: stringify_queries(token.queries)
			}, cb, function(done, resp, cache_key) {
				var match = resp.responseText.match(/<a href="(https?:\/\/[^/]*tiktokcdn\.com\/[^"]+)"[^>]*>Without watermark/);
				if (!match) {
					console_error(cache_key, "Unable to find match for", resp);
					return done(null, false);
				}

				return done(decode_entities(match[1]), 60*60);
			});
		};

		get_token(function(token) {
			if (!token)
				return cb(null);

			query_ssstiktok(url, token, cb);
		});
	};

	// This is a terrible duct-tape solution, but required until I can find a proper way to fix get_best_tiktok_url
	// Note that this will NOT be called unless "Rules using 3rd-party websites" is enabled (it's disabled by default)
	common_functions.get_tiktok_from_3rdparty = function(site, api_cache, options, url, cb) {
		var sites = {
			// hd
			"ttloader.com:ttt": common_functions.get_tiktok_from_ttloader_token,
			"onlinetik.com:ttt": common_functions.get_tiktok_from_ttloader_token,
			"demo.wppress.net:tt": common_functions.get_tiktok_from_ttloader,
			"tiktokdownloader.in:ttt": common_functions.get_tiktok_from_ttloader_token,
			"savevideo.ninja:ttt": common_functions.get_tiktok_from_ttloader_token,

			"demo.wppress.net:svd": common_functions.get_tiktok_from_socialvideodownloader,
			"savevideo.ninja:svd": common_functions.get_tiktok_from_socialvideodownloader,

			// not hd
			"keeptiktok.com": common_functions.get_tiktok_from_keeptiktok,
			"ssstiktok.io:1": common_functions.get_tiktok_from_ssstiktok,
			"musicallydown.com:1": common_functions.get_tiktok_from_musicallydown,
			"snaptik.app": common_functions.get_tiktok_from_snaptik
		};

		if (!(site in sites)) {
			console_error("Invalid site", site, sites);
			return cb(null);
		}

		sites[site](site, api_cache, options.do_request, url, cb, options);
	};

	common_functions.get_best_tiktok_url = function(api_cache, do_request, src, cb) {
		var get_tiktok_vidid_key = function(url) {
			var urlvidid = common_functions.get_tiktok_urlvidid(url);
			if (!urlvidid) {
				console_warn("Unknown video URL:", url);
				return null;
			}

			return "tiktok_vidid:" + urlvidid;
		};

		var query_tiktok_vidid = function(url, cb) {
			var cache_key = get_tiktok_vidid_key(url);
			if (!cache_key)
				return cb(null);

			api_cache.fetch(cache_key, cb, function(done) {
				var request_handle;
				var request_aborted = false;

				var progress_cb = function(resp) {
					if (request_aborted)
						return;

					if (!resp.responseText) {
						if (resp.readyState !== 4)
							return;

						// Tampermonkey has a bug with onprogress: https://github.com/Tampermonkey/tampermonkey/issues/906
						if (resp.loaded && resp.total && resp.status === 200)
							return;

						request_handle.abort();
						request_aborted = true;

						console_error(resp);
						return done(null, false);
					}

					var match = resp.responseText.match(/mdtacomment[\s\S]{10,400}vid:([0-9a-z]{32})/);
					// after that, it stores 0, 0, 0, 37, with 37 being the length of vid:..., is this related?
					if (!match) {
						if (false) {
							var is_orig = /mdta[\s\S]{10,400}mdtacom\.apple\.quicktime\.description/.test(resp.responseText);
							if (is_orig) {
								request_handle.abort();
								request_aborted = true;

								console_log("Probably original video, skipping remainder of download", url);
								return done(null, 60*60);
							}
						}

						if (resp.readyState !== 4) {
							return;
						}

						if (resp.readyState === 4) {
							request_handle.abort();
							request_aborted = true;

							console_warn("Unable to find video ID for", url);

							if (resp.status !== 200) {
								done(null, false);
							} else {
								done(null, 60);
							}
						}
					} else {
						request_handle.abort();
						request_aborted = true;

						done(match[1], 24*60*60);
					}
				};

				request_handle = do_request({
					url: url,
					method: "GET",
					headers: {
						Referer: "https://www.tiktok.com/"
					},
					onprogress: progress_cb,
					onload: progress_cb
				});
			});
		};

		var get_nowatermark_for_vidid = function(vidid, cb) {
			var cache_key = "tiktok_watermarkfree:" + vidid;
			api_cache.fetch(cache_key, cb, function(done) {
				//var request_url = "https://api.tiktokv.com/aweme/v1/playwm/?video_id=" + vidid + "&ratio=default&improve_bitrate=1";
				var request_url = "https://api2-16-h2.musical.ly/aweme/v1/play/?video_id=" + vidid + "&ratio=default&improve_bitrate=1";

				var request_video = function(times) {
					do_request({
						// &ratio=1080p actually lowers the resolution to 480x* (instead of 576x*):
						// &ratio=default returns the original version (thanks to remlap on discord)
						// https://www.tiktok.com/@mariamenounos/video/6830547359403937030
						url: request_url,
						headers: {
							Referer: "https://www.tiktok.com/",
							//Accept: "text/html",
							Accept: "*/*",
							"Sec-Fetch-Dest": "video",
							"Sec-Fetch-Mode": "no-cors",
							"Sec-Fetch-Site": "cross-site"
						},
						method: "HEAD",
						onload: function(resp) {
							if (resp.readyState !== 4)
								return;

							// https://www.tiktok.com/@auliicravalho/video/6813323310521224454 - returns 302
							// sometimes it can return 503 (service unavailable), but still return a video url (thanks to JoshuaCalvert on discord for reporting)
							//   the video url still doesn't work though, so let's not check for that?
							if (resp.status === 503) {
								if (times < 5) {
									return setTimeout(function() {
										request_video(times + 1);
									}, 500);
								}
							}

							if (resp.status !== 200 && resp.status !== 302 /*&& string_indexof(resp.finalUrl, "/video/") <= 0*/) {
								console_error(resp);
								return done(null, false);
							}

							var finalurl = force_https(get_resp_finalurl(resp));

							// probably the application/json, content-length: 0 bug
							if (finalurl === request_url) {
								if (times < 5) {
									return setTimeout(function() {
										request_video(times + 1);
									}, 500);
								}
							}

							var finalurl_urlvidid = common_functions.get_tiktok_urlvidid(finalurl);
							if (finalurl_urlvidid) {
								var finalurl_cache_key = "tiktok_vidid:" + finalurl_urlvidid;

								if (!api_cache.has(finalurl_cache_key)) {
									api_cache.set(finalurl_cache_key, vidid, 60*60);
								}
							}

							return done(finalurl, 60*60);
						}
					});
				};

				request_video(0);
			});
		};

		var get_newurl_if_changed = function(newsrc, src) {
			var old_urlvidid = common_functions.get_tiktok_urlvidid(src);

			if (!newsrc)
				newsrc = src;
			var new_urlvidid = common_functions.get_tiktok_urlvidid(newsrc);

			// to avoid infinite redirects
			if (new_urlvidid === old_urlvidid) {
				newsrc = src;
			}

			return newsrc;
		};

		query_tiktok_vidid(src, function(vidid) {
			if (!vidid) {
				return cb(null);
			}

			get_nowatermark_for_vidid(vidid, function(newsrc) {
				cb(get_newurl_if_changed(newsrc, src));
			});
		});
	};

	common_functions.tiktok_remove_watermark = function(api_cache, options, url, weburl, cb) {
		if (!options.rule_specific) {
			return cb(null);
		}

		var funcs = [];

		if (options.rule_specific.tiktok_no_watermarks) {
			funcs.push("[local]");
		}

		if (options.rule_specific.tiktok_thirdparty && weburl) {
			var thirdparty = options.rule_specific.tiktok_thirdparty;

			// fixme (once/if multiple third party sites are supported)
			if (is_array(thirdparty))
				thirdparty = thirdparty[0];

			funcs.push(thirdparty);
		}

		var process_func = function(newurl) {
			if (newurl) {
				return cb(newurl);
			}

			if (funcs.length === 0) {
				return cb(null);
			}

			var func = funcs[0];
			funcs.shift();

			if (func === "[local]") {
				common_functions.get_best_tiktok_url(api_cache, options.do_request, url, process_func);
			} else {
				common_functions.get_tiktok_from_3rdparty(func, api_cache, options, weburl, process_func);
			}
		};

		process_func();
	};

	common_functions.youtube_fetch_watchpage_raw = function(api_cache, options, id, cb) {
		real_api_query(api_cache, options.do_request, "youtube_watchpage_raw:" + id, {
			url: "https://www.youtube.com/watch?v=" + id
		}, cb, function(done, resp, cache_key) {
			return done(resp.responseText, 60*60);
		});
	};

	common_functions.youtube_fetch_watchpage_config = function(api_cache, options, id, context, cb) {
		var cache_key = "youtube_watchpage_config:" + id + ":" + context;
		api_cache.fetch(cache_key, cb, function(done) {
			common_functions.youtube_fetch_watchpage_raw(api_cache, options, id, function(data) {
				if (!data)
					return done(null, false);

				var contexts = [context];
				if (context !== "config")
					contexts.push("config");

				var match;
				array_foreach(contexts, function(context) {
					var regex = new RegExp("ytplayer\\." + context + "\\s*=\\s*({.*?});");
					match = data.match(regex);
					if (match) {
						return false;
					}
				});

				if (!match) {
					console_warn(cache_key, "Unable to find ytplayer." + context + " for", resp);
					return done(null, false);
				}

				try {
					var json = JSON_parse(match[1]);
					return done(json, 5*60*60);
				} catch (e) {
					console_error(cache_key, e, match[1]);
				}

				return done(null, false);
			});
		});
	};

	common_functions.youtube_fetch_watchpage = function(api_cache, options, id, cb) {
		return common_functions.youtube_fetch_watchpage_config(api_cache, options, id, "config", function(json) {
			if (!json)
				return cb(null);

			try {
				var player_response = json.args.player_response;
				var player_response_json = JSON_parse(player_response);
				return cb(player_response_json);
			} catch (e) {
				console_error(e, json);
			}

			return cb(null);
		});
	};

	common_functions.youtube_fetch_asset = function(api_cache, options, id, asset, cb) {
		var cache_key = "youtube_asset:" + asset;

		api_cache.fetch(cache_key, cb, function(done) {
			common_functions.youtube_fetch_watchpage_config(api_cache, options, id, "web_player_context_config", function(data) {
				if (!data) return done(null, false);

				var asseturl = null;

				// old (within "config")
				if (data.assets) {
					asseturl = data.assets[asset];
				} else if ((asset + "Url") in data) {
					asseturl = data[asset + "Url"];
				}

				if (!asseturl)
					return done(null, false);

				var asset_url = urljoin("https://www.youtube.com/", asseturl, true);
				options.do_request({
					url: asset_url,
					method: "GET",
					headers: {
						Referer: "https://www.youtube.com/"
					},
					onload: function(resp) {
						if (resp.status !== 200) {
							console_error(cache_key, resp);
							return done(null, false);
						}

						return done(resp.responseText, 60*60);
					}
				});
			});
		});
	};

	common_functions.youtube_fetch_embed = function(api_cache, options, id, cb) {
		var cache_key = "youtube_embed_info:" + id;
		api_cache.fetch(cache_key, cb, function(done) {
			options.do_request({
				url: "https://www.youtube.com/get_video_info?video_id=" + id,
				method: "GET",
				onload: function(resp) {
					if (resp.readyState !== 4)
						return;

					if (resp.status !== 200) {
						console_error(resp);
						return done(null, false);
					}

					// todo: use get_queries instead
					var splitted = resp.responseText.split("&");
					var found_player_response = false;
					for (var i = 0; i < splitted.length; i++) {
						if (/^player_response=/.test(splitted[i])) {
							found_player_response = true;
							var data = decodeURIComponent(splitted[i].replace(/^[^=]+=/, "").replace(/\+/g, "%20"));

							try {
								var json = JSON_parse(data);

								// sometimes fails with: playabilityStatus { status: UNPLAYABLE, reason: Video+unavailable }
								// also fails when video is about to premiere
								//var formats = json.streamingData.formats; // just to make sure it exists
								return done(json, 5*60*60); // video URLs expire in 6 hours
							} catch (e) {
								console_error(e, resp, splitted[i], data);
							}

							break;
						}
					}

					if (!found_player_response) {
						console_error("Unable to find player_response in", splitted[i]);
					}

					done(null, false);
				}
			});
		});
	};

	common_functions.parse_flixv2 = function(resp, cache_key) {
		var regex = /<item>\s*<res>([^<]+)<\/res>\s*<videoLink>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/videoLink>/;
		var global_regex = new RegExp(regex, "g");

		var match = resp.responseText.match(global_regex);
		if (!match) {
			console_error(cache_key, "Unable to find items in", resp);
			return null;
		}

		var urls = [];
		for (var i = 0; i < match.length; i++) {
			var smatch = match[i].match(regex);

			var quality = smatch[1];
			var url = decode_entities(smatch[2]);

			urls.push({
				url: url,
				quality: parseInt(quality),
				video: true
			});
		}

		urls.sort(function(a, b) {
			return b.quality - a.quality;
		});

		for (var i = 0; i < urls.length; i++) {
			delete urls[i].quality;
		}

		return urls;
	};

	common_functions.parse_mediadefinition = function(src, data, cache_key) {
		if (!data) {
			return null;
		}

		try {
			var maxdef = 0;
			var maxobj = null;
			for (var i = 0; i < data.mediaDefinition.length; i++) {
				// e.g. 1080p videos for non-logged in members
				if (!data.mediaDefinition[i].videoUrl)
					continue;

				if (data.mediaDefinition[i].quality > maxdef) {
					maxdef = data.mediaDefinition[i].quality;
					maxobj = data.mediaDefinition[i];
				}
			}

			// the queries constantly change, so to avoid constantly refreshing, let's make sure the base URL is different
			// the domain can also change (cv/ev) so remove that as well
			var newsrc = maxobj.videoUrl;
			var noq = src.replace(/[?#].*$/, "").replace(/^[a-z]+:\/\/[^/]+\/+/, "");
			var newnoq = newsrc.replace(/[?#].*$/, "").replace(/^[a-z]+:\/\/[^/]+\/+/, "");

			if (noq === newnoq)
				newsrc = src;

			return {
				url: newsrc,
				extra: {
					page: data.link_url,
					caption: data.video_title
				},
				headers: {
					Referer: data.link_url
				},
				video: true,
				is_private: true // linked to IP
			};
		} catch(e) {
			console_error(cache_key, e);
		}

		return null;
	};

	common_functions.get_link_el_matching = function(el, match) {
		var current = el;

		var func = match;
		if (typeof func === "object" && func instanceof RegExp) {
			var regex = func;
			func = function(x) {
				return regex.test(x.href);
			};
		}

		while (current) {
			if (current.tagName === "A" && func(current)) {
				return current;
			}

			current = current.parentElement;
		}

		return null;
	};

	common_functions.get_pagelink_el_matching = function(el, match) {
		var link_el = common_functions.get_link_el_matching(el, match);
		if (!link_el)
			return null;

		return {
			url: link_el.href,
			is_pagelink: true
		};
	};

	common_functions.is_pinterest_domain = function(domain) {
		var domain_nosub = get_domain_nosub(domain);
		return !!(/^pinterest\./.test(domain_nosub));
	};

	common_functions.get_jsonformatter_for_cryptojs = function(CryptoJS) {
		var JsonFormatter = {
			stringify: function(cipherParams) {
				var jsonObj = { ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64) };

				if (cipherParams.iv) {
					jsonObj.iv = cipherParams.iv.toString();
				}

				if (cipherParams.salt) {
					jsonObj.s = cipherParams.salt.toString();
				}

				return JSON_stringify(jsonObj);
			},
			parse: function(jsonStr) {
				var jsonObj = JSON_parse(jsonStr);

				var cipherParams = CryptoJS.lib.CipherParams.create({
					ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
				});

				if (jsonObj.iv) {
					cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv);
				}

				if (jsonObj.s) {
					cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s);
				}

				return cipherParams;
			}
		};

		return JsonFormatter;
	};

	common_functions.create_dash_stream = function(data) {
		var header = "<?xml version=\"1.0\"?>\n"
		header += "<MPD xmlns=\"urn:mpeg:dash:schema:mpd:2011\" type=\"static\"";

		var get_attrib = function(attrib, value) {
			if (value === undefined)
				return "";

			return " " + attrib + "=\"" + encode_entities(value + "") + "\"";
		};

		if (data.duration) {
			var hours = (data.duration / 60 / 60) | 0;
			var minutes = ((data.duration / 60) | 0) % 60;
			var seconds = data.duration % 60;

			header += get_attrib("mediaPresentationDuration", "PT" + hours + "H" + minutes + "M" + seconds + "S");
		}

		header += " profiles=\"urn:mpeg:dash:profile:isoff-main:2011\">\n";
		header += "<Period>\n";

		var get_range_str = function(range) {
			return range.start + "-" + range.end;
		}

		var create_representation = function(representation) {
			var rep = "  <Representation";

			rep += get_attrib("mimeType", representation.mime);
			rep += get_attrib("codecs", representation.codecs);
			rep += get_attrib("bandwidth", representation.bandwidth);
			rep += get_attrib("width", representation.width);
			rep += get_attrib("height", representation.height);
			rep += get_attrib("id", representation.id);

			rep += ">\n";
			rep += "    <BaseURL>" + encode_entities(representation.url) + "</BaseURL>\n";

			if (representation.index_range || representation.init_range) {
				rep += "    <SegmentBase";
				rep += get_attrib("indexRange", get_range_str(representation.index_range));
				rep += ">\n";

				if (representation.init_range) {
					rep += "      <Initialization"
					rep += get_attrib("range", get_range_str(representation.init_range));
					rep += " />\n";
				}

				rep += "    </SegmentBase>\n";
			}

			rep += "  </Representation>";

			return rep;
		};

		var create_adaptationset = function(mime, items) {
			var as = "<AdaptationSet mimeType=\"" + mime + "\">\n";

			array_foreach(items, function(item) {
				as += create_representation(item) + "\n";
			});

			as += "</AdaptationSet>";

			return as;
		};

		if (!data.mimes) {
			data.mimes = {};

			var add_video_audio = function(audiovideo) {
				var array = audiovideo === "audio" ? data.audios : data.videos;

				array_foreach(array, function(item) {
					if (!item.mime) {
						// todo: create common_function for getting the extension
						var ext = item.url.replace(/^[^?#]+\.([^/.?#]+)(?:[?#].*)?$/, "$1");

						if (ext !== item.url) {
							if (!item.codecs) {
								// https://cconcolato.github.io/media-mime-support/
								if (ext === "mp4")
									item.codecs = "avc1.640028";
								else if (ext === "mp3")
									item.codecs = "mp3";
							}

							if (ext === "mp3") ext = "mp4";

							item.mime = audiovideo + "/" + ext;
						} else {
							console_warn("Unable to get mime for", item);
							return;
						}
					}

					if (!(item.mime in data.mimes))
						data.mimes[item.mime] = [];

					data.mimes[item.mime].push(item);
				});
			};

			add_video_audio("video");
			add_video_audio("audio");
		}

		for (var mime in data.mimes) {
			header += create_adaptationset(mime, data.mimes[mime]) + "\n";
		}

		header += "</Period>\n</MPD>\n";

		return header;
	};

	var _sources_or_null = function(sources) {
		if (!sources.video.length) {
			if (!sources.image.length) {
				console_warn("Unable to find video sources");
				return null;
			}
		}

		return sources;
	};

	common_functions.get_videotag_sources = function(text) {
		var videomatch = text.match(/<video[\s\S]+?<\/video>/i);
		if (!videomatch) {
			console_error("Unable to find video tag from", {text: text});
			return null;
		}

		var video_parsed = parse_tag_def(videomatch[0]);
		if (!video_parsed) {
			console_error("Unable to parse <video> tag", videomatch[0]);
			return null;
		}

		var add_source = function(parsed) {
			parsed.url = parsed.args.src;
			sources.video.push(parsed);
		};

		var sources = {
			video: [],
			image: []
		};
		if (video_parsed.args.src)
			add_source(video_parsed);

		if (video_parsed.args.poster) {
			sources.image.push(video_parsed.args.poster);
		}

		var sources_match = videomatch[0].match(/<source.*?\/?>\s*(?:<\/source>)?/g);
		if (!sources_match) {
			return _sources_or_null(sources);
		}

		array_foreach(sources_match, function(source) {
			var parsed = parse_tag_def(source);
			if (!parsed) {
				console_warn("Unable to parse <source> tag", source);
				return;
			}

			if (parsed.args.src)
				add_source(parsed);
		});

		return _sources_or_null(sources);
	};

	common_functions.get_holaplayer_sources = function(objtext) {
		if (objtext[0] !== "{") {
			var match = objtext.match(/window\.hola_player\(({.*?}),\s*function/);
			if (match) {
				objtext = match[1];
			} else {
				console_error("Unable to find hola_player match from", {text: objtext});
				return null;
			}
		}

		match = objtext.match(/sources["']?:\s*(\[{.*?}\]),/);
		if (!match) {
			console_error("Unable to find sources match for", {text: objtext});
			return null;
		}

		var video_sources = JSON_parse(fixup_js_obj(match[1]));

		var poster = null;
		match = objtext.match(/poster["']?:\s*["'](https?:\/\/[^"']+)["'],/);
		if (!match) {
			console_warn("Unable to find poster match for", {text: objtext});
		} else {
			poster = match[1];
		}

		var sources = {
			video: [],
			image: []
		};

		if (poster) {
			sources.image.push(poster);
		}

		array_foreach(video_sources, function(source) {
			sources.video.push({
				src: source.src,
				type: source.type,
				url: source.src
			});
		});

		return _sources_or_null(sources);
	};

	common_functions.get_obj_from_videosources = function(page, sources) {
		var urls = [];
		array_foreach(sources.video, function(source) {
			var video = true;
			if (source.type === "application/x-mpegURL" || string_indexof(source.url, ".m3u8") >= 0) {
				video = "hls";
			}

			// TODO: DASH

			urls.push({
				url: urljoin(page, source.url, true),
				video: video
			});
		});

		array_foreach(sources.image, function(image) {
			urls.push(urljoin(page, image, true));
		});

		return urls;
	};

	common_functions.get_videotag_obj = function(resp) {
		var sources = common_functions.get_videotag_sources(resp.responseText);
		if (!sources)
			return null;

		var page = get_meta(resp.responseText, "og:url");
		if (page)
			page = urljoin(resp.finalUrl, page, true);
		else
			page = resp.finalUrl;

		var obj = {
			headers: {
				Referer: page
			},
			extra: {
				page: page
			}
		};

		var caption = get_meta(resp.responseText, "og:title");
		if (caption) obj.extra.caption = caption;

		var video_urls = [];
		array_foreach(sources.video, function(source) {
			video_urls.push(urljoin(page, source.url, true));
		});

		var image_urls = [];
		array_foreach(sources.image, function(image) {
			image_urls.push(urljoin(page, image, true));
		});

		var ogimage = get_meta(resp.responseText, "og:image");
		if (ogimage) {
			array_upush(image_urls, urljoin(page, ogimage, true));
		}

		var urls = [];
		array_foreach(video_urls, function(url) {
			urls.push({
				url: url,
				video: true
			});
		});

		array_extend(urls, image_urls);

		return fillobj_urls(urls, obj);
	};

	common_functions.update_album_info_links = function(obj, cmp) {
		var links = obj.album_info.links;

		var found = false;
		array_foreach(links, function(link, i) {
			if (!found && cmp(link.url)) {
				links[i].is_current = true;
				obj.url = links[i].url;
				found = true;
			} else {
				links[i].is_current = false;
			}
		});

		return obj;
	};

	common_functions.run_msml_op = function(state, process_data, cb) {
		var matches = state.matches;
		var op = process_data.op;
		var waiting = false;

		//console_log(process_data);

		if (op === "obj_set") {
			var value;

			if (process_data.value) {
				value = process_data.value;
			} else if (process_data.match) {
				value = matches[process_data.match];
			}

			if (process_data.subkey) {
				value = value[process_data.subkey];
			}

			var outfolder = matches;
			var outvar = process_data.out;

			if (process_data.out_subkey) {
				outfolder = matches[process_data.out];
				outvar = process_data.out_subkey;
			}

			outfolder[outvar] = value;
		} else if (op === "run") {
			var args = [];
			array_foreach(process_data.args, function(arg) {
				var value;

				if (typeof arg !== "object")
					arg = {value: arg};

				if (arg.value) {
					value = arg.value;
				} else if (arg.match) {
					value = matches[arg.match];
				} else if (arg.self) {
					value = state.ms_data[arg.self];
				}

				if (arg.subkey) {
					value = value[arg.subkey];
				}

				if (arg.regex)
					value = encode_regex(value);

				if (arg.cb) {
					value = function(data) {
						if (process_data.out) {
							matches[process_data.out] = data;
						}

						if ("bad" in process_data && data === process_data.bad) {
							cb(false);
						} else {
							cb(true);
						}
					};

					waiting = true;
				}

				args.push(value);
			});

			var obj = common_functions;
			if (process_data.match) {
				obj = matches[process_data.match];
			}

			var result = obj[process_data.key].apply(this, args);

			if ("bad" in process_data && result === process_data.bad) {
				console_error("Error running", process_data);
				return false;
			}

			if (process_data.out) {
				matches[process_data.out] = result;
			}
		} else if (op === "regex") {
			var flags = deepcopy(state.ms_data[process_data.flags]);

			obj_foreach(flags, function(key, data) {
				if (typeof data === "object") {
					if (data.replace_match) {
						delete flags[key];

						obj_foreach(data.replace_match, function(key1, value1) {
							key = string_replaceall(key, "%" + key1 + "%", encode_regex(matches[value1]));
						});

						flags[key] = data.source;
					}
				}
			});

			var regex_str = common_functions[process_data.key](common_functions[process_data.base], flags, state.ms_dadta);

			var in_match = process_data.in || "in";
			var match = matches[in_match].match(new RegExp(regex_str));
			if (!match) {
				console_error("Unable to find match from", {
					str: matches[in_match],
					regex: regex_str
				});
				return false;
			}

			matches[process_data.out] = match[process_data.save];
		} else if (op === "parse_queries") {
			var url = matches[process_data.match];
			if (!/^(?:https?:)?\//.test(url))
				url = "?" + url;

			var queries = get_queries(url, {decode: true});

			if (is_array(process_data.out)) {
				var keys = Object.keys(queries).sort();
				array_foreach(keys, function(key, i) {
					if (i in process_data.out) {
						matches[process_data.out[i]] = queries[key];
					} else {
						return false;
					}
				});
			} else {
				obj_foreach(process_data.out, function(key, value) {
					if (key in queries)
						matches[value] = queries[key];
				});
			}
		} else if (op === "add_queries") {
			url = matches[process_data.match];
			var queries = {};

			array_foreach(process_data.queries, function(query_obj) {
				var query = query_obj.query;
				var value = query_obj.value;

				if (typeof query === "object") query = matches[query.match];
				if (typeof value === "object") value = matches[value.match];

				queries[query] = value;
			});

			matches[process_data.out] = add_queries(url, queries);
		} else if (op === "parse_match") {
			var out = [];

			array_foreach(matches[process_data.match], function(sdata) {
				var subarr = [];

				obj_foreach(sdata, function(key, value) {
					if (typeof value === "string") {
						subarr.push(matches[process_data.subkey][value]);
					} else if (is_array(value)) {
						subarr.push(value[value.length - 1]);
					} else {
						subarr.push(value);
					}
				});

				out.push(deepcopy(subarr));
			});

			matches[process_data.out] = out;
		} else if (op === "final") {
			state.ok = true;
		} else {
			console_error("Unknown operation", process_data);
		}

		if (waiting)
			return "waiting";
	};

	common_functions.run_msml_oplist = function(state, oplist, cb) {
		state.ok = false;
		var waiting = false;
		try {
			array_foreach(oplist, function(op, i) {
				var result = common_functions.run_msml_op(state, op, function(success) {
					if (!success) {
						state.ok = false;
						return cb(state.ok);
					} else {
						common_functions.run_msml_oplist(state, oplist.slice(i + 1), cb);
					}
				});
				if (!result) return result;

				if (result === "waiting") {
					waiting = true;
					return false;
				}
			});
		} catch (e) {
			console_error("Error running oplist", state.matches);
			throw e;
		}

		if (!waiting) cb(state.ok);
	};

	common_functions.run_msml = function(ms_data, in_data, cb) {
		if (!ms_data || !in_data) {
			return cb(null);
		}

		var state = {
			matches: {},
			ms_data: ms_data
		};

		var our_run = function(data, cb) {
			var our_state = {
				matches: deepcopy(state.matches),
				ms_data: ms_data
			};

			our_state.matches.in = data;
			common_functions.run_msml_oplist(our_state, our_state.ms_data.run, function(ok) {
				if (!ok) {
					return cb(null);
				}

				cb(our_state.matches.out);
			});
		};

		if (state.ms_data.bootstrap) {
			state.matches.in = in_data;
			common_functions.run_msml_oplist(state, state.ms_data.bootstrap, function(ok) {
				if (!ok) {
					return cb(null);
				}

				cb(our_run);
			});
		} else {
			cb(our_run);
		}
	};

	common_functions.process_formats = function(api_cache, options, formats, cb) {
		var total = 0;
		var processed = 0;
		var msmls = {};

		var do_cb = function() {
			//console_log(processed, total);

			if (processed >= total) {
				cb(formats);
				processed = -1; // don't run final twice
			}
		};

		//console_log(deepcopy(formats));

		array_foreach(formats, function(format) {
			obj_foreach(format, function(key) {
				if (!format[key] || !options.process_format || !(key in options.process_format)) {
					return;
				}

				total++;

				if (!(key in msmls)) {
					msmls[key] = [];
				}

				msmls[key].push(format);
			});
		});

		obj_foreach(msmls, function(key) {
			msmls[key][0].imu_msml_options = options;
			msmls[key][0].imu_msml_api_cache = api_cache;

			common_functions.run_msml(options.process_format[key], msmls[key][0], function(msml) {
				if (!msml) {
					processed++;
					do_cb();
					return;
				}

				array_foreach(msmls[key], function(format) {
					msml(format, function() {
						processed++;
						do_cb();
					});
				});
			});
		});

		do_cb();
	};

	common_functions.normalize_function = function(func, vars) {
		var body = func.toString()
			.replace(/\/\/.*/g, "") // fixme: this would break "//"
			.replace(/(return|var)\s+/g, "$1##") // awful hack
			.replace(/\s*/g, "")
			.replace(/(return|var)##/g, "$1 ")
			.replace(/^(?:function\([^)]*\))?{(.*?);*}$/, "{$1}");

		if (vars) {
			for (var out_var in vars) {
				var values = vars[out_var];
				if (!is_array(values))
					values = [values];

				array_foreach(values, function(our_var) {
					if (typeof our_var === "string") {
						our_var = {source: our_var};
					}

					if (our_var.regex) {
						body = body.replace(new RegExp(our_var.source, "g"), out_var);
					} else {
						body = string_replaceall(body, our_var.source, out_var);
					}
				});
			}
		}

		return body;
	};

	common_functions.get_mappings_for_objstr = function(funcs, objstr, vars) {
		var debug_info = {
			funcs: funcs,
			objstr: objstr,
			vars: vars
		};

		var funcmapping_regex = new RegExp("(" + js_obj_token_types.jvarname.source + ")[\"']?\\s*:\\s*function\\s*[(][^)]*[)]\\s*({.*?})(?:,|};?$)");
		var matches = match_all(objstr, funcmapping_regex);
		if (!matches) {
			console_error("Unable to find mappings", debug_info);
			return null;
		}

		var mappings = {};
		var mappings_ok = true;

		var func_norm = [];
		array_foreach(funcs, function(func) {
			func_norm.push(common_functions.normalize_function(func, vars));
		});

		array_foreach(matches, function(match) {
			var func_name = match[1];
			var func_body = common_functions.normalize_function(match[2]);

			array_foreach(func_norm, function(our_body, i) {
				if (our_body === func_body) {
					mappings[func_name] = i;
					return false;
				}
			});

			if (!mappings[func_name]) {
				debug_info.matches = matches;
				debug_info.match = match;
				console_error("Unable to find mapping", debug_info);
				mappings_ok = false;
				return false;
			}
		});

		if (!mappings_ok) {
			return null;
		} else {
			return mappings;
		}
	};

	common_functions.parse_js_calls = function(namespace, code) {
		var regex = "";

		if (namespace) {
			regex = namespace + "\\.";
		} else {
			regex = "[^$_a-zA-Z0-9]";
		}

		regex += "(" + js_obj_token_types.jvarname.source + ")[(]([^)]*)[)][;\\s}]";

		var matches = match_all(code, new RegExp(regex));
		if (!matches) {
			return null;
		}

		var calls = [];

		array_foreach(matches, function(match) {
			var call = {
				name: match[1],
				args: []
			};

			var arg_matches = match_all(match[2], /([$_a-zA-Z0-9.]+)\s*(?:,|$)/);
			if (!arg_matches) {
				return;
			}
			array_foreach(arg_matches, function(argmatch) {
				var argval = argmatch[1];

				if (js_obj_token_types.number.test(argval)) {
					argval = parseFloat(argval);
				}

				call.args.push(argval);
			});

			calls.push(call);
		});

		return calls;
	};

	common_functions.find_actual_largest_image = function(current, images, cb, cache) {
		if (images.length < 2) {
			return cb(images[0]);
		}

		if (!cache) {
			cache = {};
		}

		var nullcb = function(i) {
			if (images[i] === current) {
				cb(null);
			} else {
				images.splice(i, 1);
				common_functions.find_actual_largest_image(current, images, cb, cache);
			}
		};

		var our_get_image_size = function(src, cb) {
			if (src in cache) {
				return cb(cache[src][0], cache[src][1]);
			}

			get_image_size(src, function(x, y) {
				if (!x || !y) {
					return cb(x, y);
				}

				cache[src] = [x, y];
				cb(x, y);
			});
		};

		our_get_image_size(images[0], function(x, y) {
			if (!x || !y) {
				return nullcb(0);
			}

			our_get_image_size(images[1], function(ox, oy) {
				if (!ox || !oy) {
					return nullcb(1);
				}

				if (x*y > ox*oy) {
					return cb(images[0]);
				} else {
					return cb(images[1]);
				}
			});
		});
	};

	var get_domain_from_url = function(url) {
		return url.replace(/^[a-z]+:\/\/([^/]+)(?:\/+.*)?$/, "$1");
	};

	var get_domain_nosub = function(domain) {
		var domain_nosub = domain.replace(/^.*\.([^.]*\.[^.]*)$/, "$1");
		// stream.ne.jp
		if (/^(?:(?:com?|org|net)\.[a-z]{2}|(?:ne|or)\.jp)$/.test(domain_nosub)) {
			domain_nosub = domain.replace(/^.*\.([^.]*\.[^.]*\.[^.]*)$/, "$1");
		}

		return domain_nosub;
	};

	var looks_like_valid_link = function(src, el) {
		if (/\.(?:jpe?g|png|web[mp]|gif|mp4|mkv|og[gv]|svg)(?:[?#].*)?$/i.test(src))
			return true;

		if (el && check_highlightimgs_supported_image(el))
			return true;

		return false;
	};

	var bigimage = function(src, options) {
	    if (options.null_if_no_change)
	        return null;

	    return src;
	};

	var _get_bigimage = function() {
	    var shared_variables = {
	    	'_nir_debug_': _nir_debug_,
	    	'nir_debug': nir_debug,
	    	'Math_floor': Math_floor,
	    	'Math_round': Math_round,
	    	'Math_random': Math_random,
	    	'Math_max': Math_max,
	    	'Math_min': Math_min,
	    	'Math_abs': Math_abs,
	    	'get_random_text': get_random_text,
	    	'console_log': console_log,
	    	'console_error': console_error,
	    	'console_warn': console_warn,
	    	'console_trace': console_trace,
	    	'JSON_stringify': JSON_stringify,
	    	'JSON_parse': JSON_parse,
	    	'base64_decode': base64_decode,
	    	'base64_encode': base64_encode,
	    	'is_array': is_array,
	    	'array_indexof': array_indexof,
	    	'string_indexof': string_indexof,
	    	'string_fromcharcode': string_fromcharcode,
	    	'string_charat': string_charat,
	    	'array_extend': array_extend,
	    	'array_foreach': array_foreach,
	    	'array_or_null': array_or_null,
	    	'array_upush': array_upush,
	    	'string_replaceall': string_replaceall,
	    	'match_all': match_all,
	    	'obj_foreach': obj_foreach,
	    	'shallowcopy': shallowcopy,
	    	'deepcopy': deepcopy,
	    	'_': _,
	    	'settings': settings,
	    	'new_map': new_map,
	    	'map_set': map_set,
	    	'map_get': map_get,
	    	'map_has': map_has,
	    	'map_remove': map_remove,
	    	'map_foreach': map_foreach,
	    	'map_size': map_size,
	    	'new_set': new_set,
	    	'set_add': set_add,
	    	'set_has': set_has,
	    	'real_api_cache': real_api_cache,
	    	'real_api_query': real_api_query,
	    	'real_website_query': real_website_query,
	    	'is_invalid_url': is_invalid_url,
	    	'mod': mod,
	    	'norm_url': norm_url,
	    	'urljoin': urljoin,
	    	'fillobj_urls': fillobj_urls,
	    	'add_full_extensions': add_full_extensions,
	    	'add_extensions': add_extensions,
	    	'add_extensions_jpeg': add_extensions_jpeg,
	    	'add_extensions_with_jpeg': add_extensions_with_jpeg,
	    	'add_extensions_gif': add_extensions_gif,
	    	'add_extensions_upper': add_extensions_upper,
	    	'add_extensions_upper_jpeg': add_extensions_upper_jpeg,
	    	'add_http': add_http,
	    	'force_https': force_https,
	    	'decodeuri_ifneeded': decodeuri_ifneeded,
	    	'encodeuri_ifneeded': encodeuri_ifneeded,
	    	'replace_sizes': replace_sizes,
	    	'zpadnum': zpadnum,
	    	'hex_to_ascii': hex_to_ascii,
	    	'hex_to_numberarray': hex_to_numberarray,
	    	'numberarray_to_hex': numberarray_to_hex,
	    	'reverse_str': reverse_str,
	    	'decode_entities': decode_entities,
	    	'encode_entities': encode_entities,
	    	'encode_regex': encode_regex,
	    	'get_queries': get_queries,
	    	'stringify_queries': stringify_queries,
	    	'remove_queries': remove_queries,
	    	'keep_queries': keep_queries,
	    	'add_queries': add_queries,
	    	'fuzzify_text': fuzzify_text,
	    	'fuzzy_date_compare': fuzzy_date_compare,
	    	'parse_headers': parse_headers,
	    	'headers_list_to_dict': headers_list_to_dict,
	    	'headers_dict_to_list': headers_dict_to_list,
	    	'get_resp_finalurl': get_resp_finalurl,
	    	'get_ext_from_contenttype': get_ext_from_contenttype,
	    	'get_library': get_library,
	    	'normalize_whitespace': normalize_whitespace,
	    	'strip_whitespace': strip_whitespace,
	    	'get_image_size': get_image_size,
	    	'sort_by_key': sort_by_key,
	    	'parse_tag_def': parse_tag_def,
	    	'get_meta': get_meta,
	    	'fixup_js_obj': fixup_js_obj,
	    	'fixup_js_obj_proper': fixup_js_obj_proper,
	    	'common_functions': common_functions,
	    	'get_domain_nosub': get_domain_nosub,
	    	'looks_like_valid_link': looks_like_valid_link,
	    	'Cache': Cache
	    };

	    if (typeof $__imu_get_bigimage === "undefined") {
	        require_rules_failed = {
	            type: "undefined",
	            data: $__imu_get_bigimage,
	            func: $__imu_get_bigimage,
	            message: "Rules library not included"
	        };
	    } else {
	        try {
	            var bigimage_obj = $__imu_get_bigimage(shared_variables);

	            if (!bigimage_obj || !bigimage_obj.bigimage) {
	                require_rules_failed = {
	                    type: "returned_falsey",
	                    data: bigimage_obj,
	                    message: "Unable to get bigimage function"
	                };
	            } else if (bigimage_obj.nonce !== "47fjda1i68n44131") {
	                // This could happen if for some reason the userscript manager updates the userscript,
	                // but not the required libraries.
	                require_rules_failed = {
	                    type: "bad_nonce",
	                    data: bigimage_obj.nonce,
	                    message: "Bad nonce, expected: " + "47fjda1i68n44131"
	                };
	            } else {
	                bigimage = bigimage_obj.bigimage;
	            }

	            if (require_rules_failed) {
	                require_rules_failed.func = $__imu_get_bigimage;
	            }
	        } catch (e) {
	            require_rules_failed = {
	                type: "js_error",
	                data: e,
	                message: "JS error fetching bigimage function",
	                func: $__imu_get_bigimage
	            };
	        }

	        // in case the userscript is loaded in the window context
	        delete $__imu_get_bigimage;
	    }

	    if (require_rules_failed) {
	        console_error(require_rules_failed);
	    }
	};
	_get_bigimage();


	var get_helpers = function(options) {
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

		try {
			if (options.document)
				document = options.document;
			if (options.window)
				window = options.window;
		} catch (e) {
			//console_warn("Failed to set document/window", e);
		}


		var new_image = function(src) {
			var img = document_createElement("img");
			img.src = src;
			return img;
		};

		var new_video = function(src) {
			var video = document_createElement("video");
			video.src = src;
			return video;
		};

		var new_media = function(src, is_video) {
			if (is_video)
				return new_video(src);
			else
				return new_image(src);
		};

		var get_nextprev_el = function(el, nextprev) {
			if (nextprev) {
				return el.nextElementSibling;
			} else {
				return el.previousElementSibling;
			}
		};

		var get_nextprev_from_list = function(el, list, nextprev) {
			var el_src = get_img_src(el);
			var index = -1;
			for (var i = 0; i < list.length; i++) {
				if (typeof list[i] === "string") {
					if (el_src === list[i]) {
						index = i;
						break;
					}
				} else {
					if (el === list[i]) {
						index = i;
						break;
					}
				}
			}

			if (index === -1)
				return null;

			if (nextprev) {
				if (index >= list.length)
					return false;
				else
					return list[index + 1];
			} else {
				if (index < 0)
					return false;
				else
					return list[index - 1];
			}
		};


		if (host_domain_nosub === "imgur.com" && host_domain !== "i.imgur.com") {
			return {
				gallery: function(el, nextprev) {
					if (!el)
						return "default";

					var find_from_el = function() {
						if (options.host_url.match(/\/a\/+[^/]+\/+embed/)) {
							return "default";
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
										return "default";

									var img = current.querySelector("img");
									if (img) {
										return img;
									}
								}
							}
						}

						return "default";
					};

					// "default" isn't used here because it's only used as find_from_api ||
					var find_from_api = function(images) {
						var big = bigimage_recursive(el.src, {
							fill_object: true,
							use_cache: false,
							rule_specific: {imgur_source: false}
						});

						var current_hash = big[0].url.replace(/.*\/([^/._]+?)(?:_[^/]+)?\.[^/.]*?(?:[?#].*)?$/, "$1");
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

									var ext = images[image_id].ext;
									if (options.exclude_videos && (ext === ".mp4" || ext === ".webm"))
										ext = ".jpg";

									var newel = document_createElement("img");
									newel.src = "https://i.imgur.com/" + images[image_id].hash + ext;
									return newel;
								}
							}
						}

						return null;
					};

					var find_from_both = function(images) {
						return find_from_api(images) || find_from_el();
					};

					if (!window.runSlots && options.do_request) {
						common_functions.fetch_imgur_webpage(options.do_request, real_api_cache, undefined, options.host_url, function(data) {
							if (!data || !data.imageinfo || data.bad) {
								return options.cb(find_from_el());
							}

							try {
								return options.cb(find_from_both(data.imageinfo.album_images.images));
							} catch (e) {
								console_error(e);
								return options.cb(find_from_el());
							}
						});

						return "waiting";
					} else {
						try {
							return find_from_both(window.runSlots.item.album_images.images);
						} catch (e) {
							console_error(e);
							return find_from_el();
						}
					}
				}
			};
		}

		if (host_domain_nosub === "instagram.com") {
			return {
				gallery: function(el, nextprev) {
					if (!el)
						return "default";

					var query_el = el;
					if (!el.parentElement) { // check if it's a fake element returned by this function
						query_el = options.element;
					}

					var info = common_functions.instagram_find_el_info(document, query_el, options.host_url);
					var can_apply = false;
					var use_default_after = false;
					for (var i = 0; i < info.length; i++) {
						if ((info[i].type === "post" && (info[i].subtype === "popup" || info[i].subtype === "page" || info[i].subtype === "home" || (info[i].subtype === "link" && options.rule_specific.instagram_gallery_postlink && !options.is_counting))) ||
							 info[i].type === "story") {
							info[i].all = true;
							can_apply = true;

							if (info[i].type === "post" && info[i].subtype === "link")
								use_default_after = true;
						}
					}

					if (can_apply) {
						var imageid_el = common_functions.instagram_get_el_for_imageid(el);
						var imageid_el_src = common_functions.instagram_get_image_src_from_el(imageid_el);
						var our_imageid = common_functions.instagram_get_imageid(imageid_el_src);
						var add = nextprev ? 1 : -1;
						common_functions.instagram_parse_el_info(real_api_cache, options.do_request, options.rule_specific.instagram_use_app_api, options.rule_specific.instagram_dont_use_web, info, options.host_url, function(data) {
							if (!data) {
								return options.cb("default");
							}

							for (var i = nextprev ? 0 : 1; i < data.length - (nextprev ? 1 : 0); i++) {
								var current_imageid = common_functions.instagram_get_imageid(data[i].src);
								var current_videoid = "null";
								if (data[i].video) {
									current_videoid = common_functions.instagram_get_imageid(data[i].video);
								}

								if (our_imageid === current_imageid || our_imageid === current_videoid) {
									var our_data = data[i + add];

									var cb_media = new_media(our_data.video || our_data.src, our_data.video);
									cb_media.setAttribute("data-imu-info", JSON_stringify(deepcopy(info, {json: true})));
									cb_media.setAttribute("data-imu-data", JSON_stringify(deepcopy(our_data, {json: true})));

									return options.cb(cb_media);
								}
							}

							if (!use_default_after)
								return options.cb(null);
							else
								return options.cb(get_next_in_gallery(options.element, nextprev));
						});

						return "waiting";
					}

					return "default";
				}
			};
		}

		if (host_domain_nosub === "tiktok.com") {
			return {
				gallery: function(el, nextprev) {
					if (el.tagName === "VIDEO" && el.parentElement && el.parentElement.parentElement) {
						if (el.parentElement.classList.contains("video-card") &&
							el.parentElement.parentElement.classList.contains("image-card")) {
							return get_next_in_gallery(el.parentElement.parentElement, nextprev);
						}
					}

					return "default";
				}
			};
		}

		if (host_domain_nowww === "twitter.com") {
			return {
				gallery: function(el, nextprev) {
					var is_photo_a = function(el) {
						return el.tagName === "A" && el.href && /\/status\/+[0-9]+\/+photo\/+/.test(el.href);
					};

					var get_img_from_photo_a = function(el) {
						var imgel = el.querySelector("img");
						if (imgel) {
							// don't return the <img> element because opacity: 0
							var prev = imgel.previousElementSibling;
							if (prev && prev.tagName === "DIV" && prev.style.backgroundImage)
								return prev;
						}

						return imgel;
					}

					var get_nextprev = function(el) {
						if (nextprev) {
							return el.nextElementSibling;
						} else {
							return el.previousElementSibling;
						}
					};

					var get_photoel_from_photo_container = function(nextel) {
						if (nextel.tagName === "A") {
							return get_img_from_photo_a(nextel);
						} else if (nextel.tagName === "DIV") {
							var childid = nextprev ? 0 : (nextel.children.length - 1);

							if (nextel.children.length > 0 && is_photo_a(nextel.children[childid])) {
								return get_img_from_photo_a(nextel.children[childid]);
							}
						} else {
							return "default";
						}
					};

					// tweet albums: https://twitter.com/phoronix/status/1229117085432926209
					var current = el;
					while ((current = current.parentElement)) {
						if (is_photo_a(current)) {
							var nextel = get_nextprev(current);

							if (nextel) {
								return get_photoel_from_photo_container(nextel);
							} else {
								var parent = current.parentElement;
								var sibling = get_nextprev(parent);

								if (sibling) {
									return get_photoel_from_photo_container(sibling);
								}
							}

							return null;
						}
					}

					return "default";
				},
				element_ok: function(el) {
					var tweet = common_functions.get_twitter_video_tweet(el, window);
					// disable for now as this method needs to be implemented
					if (tweet && false) {
						return true;
					}

					return "default";
				}
			};
		}

		if (host_domain_nowww === "500px.com") {
			return {
				element_ok: function(el) {
					if (el.tagName === "A" && el.classList.contains("photo_link") && el.querySelector("div.nsfw_placeholder_content")) {
						return true;
					}

					return "default";
				}
			};
		}

		if (host_domain_nosub === "snapchat.com") {
			return {
				gallery: function(el, nextprev) {
					// useless because get_snapchat_info_from_el does this check for us
					if (false && el.tagName !== "VIDEO" && el.tagName !== "IMG")
						return "default";

					var info = common_functions.get_snapchat_info_from_el(el);
					if (info) {
						common_functions.get_snapchat_storysharing(real_api_cache, options.do_request, info.username, function(data) {
							if (!data) {
								return options.cb(null);
							}

							if (!("pos" in info) || info.pos === -1) {
								for (var i = 0; i < data.snaps.length; i++) {
									if (data.snaps[i].media.mediaUrl === info.url) {
										info.pos = i;
										break;
									}
								}
							}

							// mirroring to get_obj_from_snap_info
							if (info.pos === -1) {
								info.pos = data.snaps.length - 1;
							}

							if (!("pos" in info)) {
								return options.cb(null);
							}

							var diff = nextprev ? 1 : -1;
							var newpos = info.pos + diff;

							if (newpos < 0 || newpos >= data.snaps.length)
								return options.cb(null);

							var url = data.snaps[newpos].media.mediaUrl;
							var mediael = new_media(url, /\.mp4(?:[?#].*)?$/.test(url) && false);
							mediael.setAttribute("data-username", info.username);
							mediael.setAttribute("data-pos", newpos);
							mediael.setAttribute("data-url", url);
							mediael.setAttribute("data-imu", "true");

							return options.cb(mediael);
						});

						return "waiting";
					}

					return "default";
				},
				element_ok: function(el) {
					if (el.tagName === "VIDEO") {
						return true;
					}

					if (el.tagName === "DIV" && el.children.length === 1 && el.children[0].tagName === "VIDEO") {
						// to fix the pointer-events: none issue (thanks to remlap on discord for reporting)
						return el.children[0];
					}

					return "default";
				}
			};
		}

		if (host_domain_nosub === "allmusic.com") {
			return {
				gallery: function(el, nextprev) {
					// thanks to nimuxoha on github: https://github.com/qsniyg/maxurl/issues/279
					// https://www.allmusic.com/album/release/mr0002329530
					// https://www.allmusic.com/album/release/mr0002781134 -- no gallery
					// https://www.allmusic.com/album/release/mr0000570239
					// https://www.allmusic.com/album/release/mr0001144566 -- no gallery

					if (el.tagName !== "IMG" || !el.parentElement)
						return "default";

					if (!el.classList.contains("gallery-main-image"))
						return "default";

					var carousel_img = el.parentElement.querySelector("#carousel > ul > li.thumb-img > img.highlight-on");
					if (!carousel_img) {
						console_warn("Unable to find carousel thumbnail image");
						return "default";
					}

					var valid_or_null = function(el) {
						if (!el.classList.contains("thumb-img"))
							return null;
						return el.querySelector("img");
					}

					var li = carousel_img.parentElement;
					if (nextprev) {
						return valid_or_null(li.nextElementSibling);
					} else {
						return valid_or_null(li.previousElementSibling);
					}
				}
			};
		}

		if (host_domain_nosub === "reddit.com") {
			return {
				element_ok: function(el) {
					if (el.tagName === "VIDEO") {
						return true;
					}

					return "default";
				}
			};
		}

		if (host_domain_nosub === "flickr.com") {
			return {
				element_ok: function(el) {
					var current = el;
					while ((current = current.parentElement)) {
						if (current.tagName === "DIV" && current.classList.contains("restricted-interstitial")) {
							return true;
						}
					}

					return "default";
				}
			};
		}

		if (host_domain_nosub === "modelmayhem.com") {
			return {
				element_ok: function(el) {
					var current = el;
					while ((current = current.parentElement)) {
						// https://www.modelmayhem.com/portfolio/pic/45372959
						if (current.tagName === "DIV" && current.id === "viewpic") {
							return true;
						}
					}

					return "default";
				}
			};
		}

		if (host_domain_nowww === "imagefap.com" && /\/photo\/+[0-9]+\//.test(options.host_url)) {
			return {
				gallery: function(el, nextprev) {
					if (el.tagName !== "IMG" || !options.do_request)
						return "default";

					var is_navigation = false;
					var current = el.parentElement;
					if (!current && el.hasAttribute("data-imu-imagefap-album")) {
						is_navigation = true;
					} else {
						while ((current = current.parentElement)) {
							if ((current.tagName === "DIV" && current.id === "navigation") ||
								// main image
								current.tagName === "DIV" && current.classList.contains("image-wrapper")) {
								is_navigation = true;
								break;
							}
						}
					}

					if (!is_navigation)
						return "default";

					var query_imagefap_album = function(id, cb) {
						var cache_key = "imagefap_album:" + id;

						real_api_cache.fetch(cache_key, cb, function(done) {
							options.do_request({
								url: "https://www.imagefap.com/photo/" + id + "/",
								method: "GET",
								onload: function(resp) {
									if (resp.status !== 200) {
										console_error(cache_key, resp);
										return done(null, false);
									}

									var matches = match_all(resp.responseText, /<li>\s*<a href=\"https:\/\/[^/.]+\.imagefap\.com\/+images\/[^"]+".*?>\s*<img border=0 src2="(https:\/\/[^/.]+\.imagefap\.com\/[^"]+)"/);
									if (!matches) {
										console_warn(cache_key, "Unable to find album matches for", resp);
										return done(null, false);
									}

									var albumentries = [];
									array_foreach(matches, function(match) {
										albumentries.push(decode_entities(match[1]));
									});

									return done(albumentries, 60*60);
								}
							});
						});
					};

					var get_imagefap_photo_id = function(url) {
						var id = url.replace(/.*\/images\/+.*\/([0-9]+)\.[^/.]+(?:[?#].*)?$/, "$1");
						if (id !== url)
							return id;

						return null;
					};

					var our_photo_id = get_imagefap_photo_id(el.src);
					if (!our_photo_id)
						return "default";

					var our_album_id = options.host_url.match(/\/photo\/+([0-9]+)\//);
					our_album_id = our_album_id[1];

					query_imagefap_album(our_album_id, function(data) {
						if (!data) {
							return options.cb("default");
						}

						for (var i = 0; i < data.length; i++) {
							var data_id = get_imagefap_photo_id(data[i]);

							if (our_photo_id === data_id) {
								var nexti = i + (nextprev ? 1 : -1);
								if (nexti < 0 || nexti >= data.length) {
									return options.cb(null);
								} else {
									var our_el = new_image(data[nexti]);
									our_el.setAttribute("data-imu-imagefap-album", "true");
									return options.cb(our_el);
								}
							}
						}

						return options.cb("default");
					});

					return "waiting";
				}
			};
		}

		if (host_domain_nowww === "gog.com") {
			// https://www.gog.com/game/virtuaverse
			return {
				gallery: function(el, nextprev) {
					var current = el;

					while ((current = current.parentElement)) {
						if (current.tagName === "DIV" && current.classList.contains("productcard-thumbnails-slider__slide-item")) {
							var next_container = get_nextprev_el(current, nextprev);
							if (!next_container) {
								if (!current.parentElement.classList.contains("productcard-thumbnails-slider__slide")) {
									return null;
								}

								next_container = get_nextprev_el(current.parentElement, nextprev);
								if (!next_container)
									return null;

								if (!nextprev) {
									next_container = next_container.children[next_container.children.length - 1];
								} else {
									next_container = next_container.children[0];
								}

								if (!next_container)
									return null;
							}

							return next_container.querySelector("picture, img");
						}
					}

					return "default";
				}
			};
		}

		if (host_domain_nosub === "booth.pm") {
			return {
				element_ok: function(el) {
					// https://hawawa-temple.booth.pm/
					// thumbnails on https://hawawa-temple.booth.pm/items/1219489
					if (el.tagName === "DIV" && (el.classList.contains("swap-image") || el.classList.contains("thumb")) && el.children.length > 0 && el.children[0].tagName === "IMG") {
						return el.children[0];
					}

					return "default";
				}
			};
		}

		if (common_functions.is_pinterest_domain(host_domain)) {
			return {
				element_ok: function(el) {
					if (el.tagName === "VIDEO")
						return true;
				}
			};
		}

		if (host_domain_nosub === "instyle.com") {
			// thanks to remlap on discord for reporting: https://www.instyle.com/celebrity/zendaya-september-2020-cover
			return {
				element_ok: function(el) {
					if (el.tagName === "DIV" && el.classList.contains("lazy-image"))
						return el.querySelector(".image-overlay > img");
				}
			};
		}

		if (host_domain_nosub === "asiansister.com") {
			// thanks to Urkchar on discord for reporting
			return {
				element_ok: function(el) {
					if (el.tagName === "DIV" && el.id === "myModal") {
						return el.querySelector("img.modalTest-content");
					}
				}
			};
		}

		if (host_domain_nosub === "naver.com" && /\/viewer\/+postView\.nhn\?/.test(options.host_url)) {
			// thanks to Urkchar on discord for reporting
			return {
				gallery: function(el, nextprev) {
					var current = el;

					if (current.tagName === "IMG" && current.classList.contains("se_mediaImage")) {
						while ((current = current.parentElement)) {
							if (current.tagName === "DIV" && current.classList.contains("sect_dsc")) {
								var all_els = current.querySelectorAll("img.se_mediaImage");

								var nextprev_el = get_nextprev_from_list(el, all_els, nextprev);
								if (nextprev_el !== null) {
									return nextprev_el || null;
								}
							}
						}
					}

					return "default";
				}
			};
		}

		if (host_domain_nosub === "fetlife.com") {
			return {
				element_ok: function(el) {
					// a = profile link (image)
					if (el.tagName === "DIV" || el.tagName === "A") {
						for (var i = 0; i < el.children.length; i++) {
							var child = el.children[i];
							// .fl-disable-interaction is used for the profile pic when on the profile
							if (child.tagName === "IMG" && (child.classList.contains("ipp") || child.classList.contains("fl-disable-interaction"))) {
								return el.children[i];
							}
						}
					}
				}
			};
		}

		if (host_domain_nosub === "youtube.com") {
			return {
				element_ok: function(el) {
					// thanks to ambler on discord for reporting
					if (el.tagName === "DIV" && el.id === "background") {
						var newel = el.querySelector("div#backgroundFrontLayer");
						if (newel)
							return newel;
					}
				}
			};
		}

		if (host_domain_nowww === "ray-web.jp") {
			return {
				element_ok: function(el) {
					if (!el.children)
						return;

					var imgchild = null;
					array_foreach(el.children, function(child) {
						// all imgs are pointer-events: none
						if (child.tagName === "IMG") {
							imgchild = child;
							return false;
						}
					});

					if (imgchild)
						return imgchild;
				}
			};
		}

		return null;
	};

	var _get_album_info_gallery = function(album_info, el, nextprev) {
		if (album_info.type === "links") {
			var current_link_id = -1;

			array_foreach(album_info.links, function(link, i) {
				if (link.is_current) {
					current_link_id = i;
					return false;
				}
			});

			// unable to find current link
			if (current_link_id < 0)
				return null;

			for (var i = 0; i < album_info.links.length; i++) {
				delete album_info.links[i].is_current;
			}

			current_link_id += nextprev ? 1 : -1;
			if (current_link_id < 0 || current_link_id >= album_info.links.length)
				return false; // or null if we want to be able to move past the current gallery

			album_info.links[current_link_id].is_current = true;

			return album_info.links[current_link_id].url;
		}

		// unsupported type
		return null;
	};

	var get_album_info_gallery = function(popup_obj, el, nextprev) {
		var album_info;

		if (popup_obj)
			album_info = popup_obj.album_info;

		if (el) {
			var album_info_json = el.getAttribute("imu-album-info");
			if (album_info_json) {
				try {
					album_info = JSON_parse(album_info_json);
				} catch (e) {
					console_error(e);
				}
			}
		}

		if (!album_info)
			return null;

		album_info = deepcopy(album_info);
		var result = _get_album_info_gallery(album_info, el, nextprev);
		if (!result)
			return result;

		if (typeof result === "string") {
			var url = result;
			result = document_createElement("img");
			result.src = url;
		}

		if (!result.hasAttribute("imu-album-info")) {
			// album_info can be modified by _get_album_info_gallery, so we must re-stringify it
			result.setAttribute("imu-album-info", JSON_stringify(album_info));
		}

		return result;
	};

	var get_next_in_gallery = null;

	var fullurl_obj = function(currenturl, obj) {
		if (!obj)
			return obj;

		if (!is_array(obj)) {
			obj = [obj];
		}

		var newobj = [];
		array_foreach(obj, function(url) {
			if (typeof(url) === "string") {
				newobj.push(fullurl(currenturl, url));
			} else {
				if (url.url) {
					if (is_array(url.url)) {
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

	var basic_fillobj = function(obj) {
		if (!obj) {
			obj = {};
		}

		if (!is_array(obj)) {
			obj = [obj];
		}

		array_foreach(obj, function(sobj, i) {
			if (typeof sobj === "string") {
				obj[i] = {url: sobj};
			}
		});

		return obj;
	};

	var fillobj = function(obj, baseobj) {
		//if (typeof obj === "undefined")
		if (!obj) {
			//return [];
			obj = {};
		}

		if (!is_array(obj)) {
			obj = [obj];
		}

		if (!baseobj)
			baseobj = {};

		if (is_array(baseobj))
			baseobj = baseobj[0];

		//var oldobj = deepcopy(obj);

		for (var i = 0; i < obj.length; i++) {
			if (typeof(obj[i]) === "undefined") {
				continue;
			}

			if (typeof(obj[i]) === "string") {
				obj[i] = {url: obj[i]};
			}

			var item;
			// Only copy from baseobj if the urls are the same (or n/a)
			if (!obj[i].url || !baseobj.url || baseobj.url === obj[i].url)  {
				for (item in baseobj) {
					if (!(item in obj[i])) {
						obj[i][item] = baseobj[item];
					}
				}
			}

			for (item in default_object) {
				if (!(item in obj[i])) {
					obj[i][item] = default_object[item];
				}
			}
		}

		//console_log("fillobj", deepcopy(oldobj), deepcopy(obj));
		return obj;
	};

	var same_url = function(url, obj) {
		obj = fillobj(obj);

		if (obj[0] && obj[0].url === url)
			return true;

		return false;
	};

	var get_bigimage_extoptions_first = function(options) {
		var our_settings = [
			"allow_thirdparty",
			"allow_apicalls",
			"allow_thirdparty_libs",
			"allow_thirdparty_code",
			{
				our: "process_format",
				settings: "process_format",
				obj: true
			}
		];

		for (var i = 0; i < our_settings.length; i++) {
			var our_setting_obj = our_settings[i];

			var our_setting;
			var settings_setting;
			var is_obj = false;
			if (typeof our_setting_obj === "string") {
				our_setting = our_setting_obj;
				settings_setting = our_setting;
			} else {
				our_setting = our_setting_obj.our;
				settings_setting = our_setting_obj.settings;
				is_obj = !!our_setting_obj.obj;
			}

			if (!is_obj) {
				if (!(our_setting in options)) {
					options[our_setting] = (settings[settings_setting] + "") === "true";
				}
			} else {
				if (!(our_setting in options)) {
					options[our_setting] = {};
				}

				obj_foreach(settings[settings_setting], function(key, value) {
					if (!(key in options[our_setting])) {
						options[our_setting][key] = value;
					}
				});
			}
		}

		return options;
	};

	var get_bigimage_extoptions = function(options) {
		if ("exclude_problems" in options) {
			for (var option in settings) {
				if (option in option_to_problems) {
					var problem = option_to_problems[option];
					var index = array_indexof(options.exclude_problems, problem);

					if (settings[option]) {
						if (index >= 0)
							options.exclude_problems.splice(index, 1);
					} else {
						if (index < 0)
							options.exclude_problems.push(problem);
					}
				}
			}
		}

		if (!options.allow_apicalls) {
			options.do_request = null;
		}

		if ("rule_specific" in options) {
			var rule_specific_map = {
				"deviantart_prefer_size": true,
				"deviantart_support_download": true,
				"imgur_filename": true,
				"imgur_source": true,
				"instagram_use_app_api": true,
				"instagram_dont_use_web": true,
				"instagram_gallery_postlink": true,
				"snapchat_orig_media": true,
				"tiktok_no_watermarks": true,
				"tiktok_thirdparty": true,
				"tumblr_api_key": true,
				"mouseover_linked_image": "linked_image"
			};

			for (var rule_specific in rule_specific_map) {
				var rule_specific_value = rule_specific_map[rule_specific];

				if (rule_specific_value === true) {
					rule_specific_value = rule_specific;
				}

				options.rule_specific[rule_specific_value] = settings[rule_specific];
			}
		}

		// Doing this here breaks things like Imgur, which will redirect to an image if a video was opened in a new tab
		if (false && !settings.allow_video) {
			options.exclude_videos = true;
		} else {
			options.exclude_videos = false;
		}

		return options;
	};

	var bigimage_recursive = function(url, options) {
		// breaks element_ok on elements without sources
		if (false && !url)
			return url;

		if (!options)
			options = {};

		if (is_userscript || is_extension) {
			get_bigimage_extoptions_first(options);
		}

		for (var option in bigimage_recursive.default_options) {
			if (!(option in options)) {
				options[option] = deepcopy(bigimage_recursive.default_options[option]);
				continue;
			}

			if (is_iterable_object(options[option])) {
				for (var rsoption in bigimage_recursive.default_options[option]) {
					if (!(rsoption in options[option])) {
						options[option][rsoption] = deepcopy(bigimage_recursive.default_options[option][rsoption]);
					}
				}
			}
		}

		if (is_userscript || is_extension) {
			get_bigimage_extoptions(options);
		}

		var waiting = false;
		var forcerecurse = false;

		var url_is_data = false;
		var origurl = url;
		if (typeof url === "string" && /^(?:data|blob):/.test(url)) {
			url_is_data = true;
		}

		var newhref = url;
		var endhref;
		var currenthref = url;
		var pasthrefs = [url];
		//var lastobj = fillobj(newhref);
		//var lastobj = newhref;
		var pastobjs = [];
		var currentobj = null;
		var used_cache = false;
		var loop_i = 0;

		var do_cache = function() {
			nir_debug("bigimage_recursive", "do_cache (endhref, currentobj):", deepcopy(endhref), deepcopy(currentobj));

			if (!endhref)
				return;

			if (!get_currenthref(endhref))
				return;

			var cache_endhref = fillobj(endhref, currentobj);

			if (!cache_endhref || !cache_endhref.can_cache) {
				nir_debug("bigimage_recursive", "do_cache: skipping cache because cache_endhref.can_cache == false");
				return;
			}

			currenthref = get_currenthref(cache_endhref);
			if (!currenthref)
				return;

			if (!used_cache && (options.use_cache === true) && !waiting) {
				for (var i = 0; i < pasthrefs.length; i++) {
					var href = pasthrefs[i];

					if (href) {
						nir_debug("bigimage_recursive", "do_cache:", href, "=", deepcopy(cache_endhref));

						url_cache.set(href, deepcopy(cache_endhref), options.urlcache_time);
					}
				}
			}
		};

		var get_currenthref = function(objified) {
			if (!objified) {
				return objified;
			}

			if (is_array(objified)) {
				objified = objified[0];
			}

			if (!objified) {
				return objified;
			}

			if (is_array(objified.url))
				currenthref = objified.url[0];
			else
				currenthref = objified.url;
			return currenthref;
		};

		var prop_in_objified = function(prop, objified) {
			if (!is_array(objified)) {
				objified = [objified];
			}

			var found_prop = false;
			array_foreach(objified, function(obj) {
				if (prop in obj) {
					found_prop = true;
					return false;
				}
			});

			return found_prop;
		}

		var parse_bigimage = function(big) {
			nir_debug("bigimage_recursive", "parse_bigimage (big)", deepcopy(big));

			if (!big) {
				if (newhref === url && options.null_if_no_change)
					newhref = big;
				return false;
			}

			var newhref1 = fullurl_obj(currenthref, big);
			nir_debug("bigimage_recursive", "parse_bigimage (newhref1)", deepcopy(newhref1));

			if (!newhref1) {
				return false;
			}

			var copy_props = ["extra", "album_info"];

			// Copy important old properties
			var important_properties = {};
			if (pastobjs.length > 0) {
				if (pastobjs[0].likely_broken)
					important_properties.likely_broken = pastobjs[0].likely_broken;
				if (pastobjs[0].fake)
					important_properties.fake = pastobjs[0].fake;

				array_foreach(copy_props, function(prop) {
					//console_log(prop, deepcopy(pastobjs[0]));
					if (prop in pastobjs[0]) {
						important_properties[prop] = deepcopy(pastobjs[0][prop]);
					}
				});
			}

			var objified = fillobj(deepcopy(newhref1), important_properties);
			nir_debug("bigimage_recursive", "parse_bigimage (objified)", deepcopy(objified));

			for (var i = 0; i < objified.length; i++) {
				var obj = objified[i];

				var remove_obj = function() {
					objified.splice(i, 1);
					if (is_array(newhref1)) {
						newhref1.splice(i, 1);
					}

					i--;
				};

				// Remove null URLs
				if (obj.url === null && !obj.waiting) {
					remove_obj();
					continue;
				}

				if (obj.url === "" && url_is_data) {
					obj.url = origurl;
				}

				// Remove problems in exclude_problems
				for (var problem in obj.problems) {
					if (obj.problems[problem] &&
						array_indexof(options.exclude_problems, problem) >= 0) {
						nir_debug("bigimage_recursive", "Removing problematic:", obj.url, "because of", problem);
						remove_obj();
						continue;
					}
				}

				if (obj.url && options.filter && !options.filter(obj.url)) {
					console_log("Blacklisted:", obj.url);
					remove_obj();
					continue;
				}

				if (options.exclude_videos && obj.video) {
					remove_obj();
					continue;
				}

				if (pastobjs[0]) {
					if (obj._copy_old_props) {
						for (var j = 0; j < obj._copy_old_props.length; j++) {
							var prop = obj._copy_old_props[j];
							obj[prop] = deepcopy(pastobjs[0][prop]);
						}
					}
				}
			}

			nir_debug("bigimage_recursive", "parse_bigimage (objified, processed)", deepcopy(objified));

			if (objified.length === 0) {
				nir_debug("bigimage_recursive", "parse_bigimage: objified.length == 0");
				return false;
			}

			waiting = false;
			forcerecurse = false;
			var temp_newhref1 = newhref1;
			if (is_array(newhref1))
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

				if (temp_newhref1.forcerecurse) {
					forcerecurse = true;
				}
			} else {
				currentobj = null;
			}

			// check if objified (our object) has the same url/href as the last url (currenthref)
			if (same_url(currenthref, objified) && !forcerecurse) {
				nir_debug("bigimage_recursive", "parse_bigimage: sameurl(currenthref, objified) == true (newhref, nh1, pastobjs)", deepcopy(currenthref), deepcopy(objified), deepcopy(newhref), deepcopy(newhref1), deepcopy(pastobjs));

				// FIXME: this is a terrible hack
				try {
					var cond = !options.fill_object || (newhref[0].waiting === true && !objified[0].waiting);
					if (cond) {
						newhref = objified;
					} else {
						// TODO: refactor
						var _apply = function(newobj) {
							array_foreach(basic_fillobj(newobj), function(sobj, i) {
								sobj = deepcopy(sobj);

								// FIXME? untested (url should resolve to the one right below it)
								if (!sobj.url) {
									sobj.url = currenthref;
								}

								array_foreach(pastobjs, function(psobj) {
									if (psobj.url === sobj.url) {
										for (prop in sobj) {
											psobj[prop] = sobj[prop];
										}

										return false;
									}
								});
							});
						};

						apply(newhref);
						// strikinglycdn needs newhref1 to be applied, because it has two rules, the cloudinary one, then the {url: src, can_head: false} one
						// the second one is only set in newhref1, not newhref
						apply(newhref1);

						newhref = null;
						currentobj = pastobjs[0];
					}

					if (false) {
						if (!cond) {
							array_foreach(copy_props, function(prop) {
								// using newhref1 instead of objified because otherwise it'll always be true (objified is the filled object, all props are in it)
								// the prop_in_objified check breaks facebook albums
								// [photo.php, post] -> [url+extra, photo.php] (album_info is missing because url is just a url, doesn't have album_info)
								//   but newhref = [url+extra, photo.php]
								//   we don't want to disregard newhref, as it contains new information (extra)
								//   newhref1 = [url]
								// but removing it breaks normal photos, e.g. mixdrop:
								// mp4(+headers) -> return src (.mp4 without headers)
								if (!(prop in newhref[0]) && (prop in important_properties) /*&& prop_in_objified(prop, newhref1)*/) {
									cond = true;
									return false;
								}
							});
						}

						if (cond)
							newhref = objified;
					}
				} catch (e) {}

				return false;
			} else {
				if (!forcerecurse) {
					for (var i = 0; i < pasthrefs.length; i++) {
						if (same_url(pasthrefs[i], objified)) {
							nir_debug("bigimage_recursive", "parse_bigimage: sameurl(pasthrefs[" + i + "], objified) == true", deepcopy(pasthrefs[i]), deepcopy(objified), deepcopy(newhref));

							// TODO: copy changes above here, or better yet, refactor
							// FIXME: is this even correct?
							if (newhref && newhref.length) {
								var cond = false;
								array_foreach(copy_props, function(prop) {
									// using newhref1 instead of objified because otherwise it'll always be true? (objified is the filled object, all props are in it)
									if (!(prop in newhref[0]) && (prop in important_properties) && prop_in_objified(prop, newhref1)) {
										cond = true;
										return false;
									}
								});

								if (cond)
									newhref = objified;
							}

							return false;
						}
					}
				}

				nir_debug("bigimage_recursive", "parse_bigimage: setting currenthref and newhref");
				currenthref = get_currenthref(objified);
				newhref = newhref1;
			}

			pasthrefs.push(currenthref);

			// Prepend objified to pastobjs
			var current_pastobjs = [];
			array_extend(current_pastobjs, objified);
			array_extend(current_pastobjs, pastobjs);

			pastobjs = current_pastobjs;

			if (false && !waiting) {
				// lastobj isn't used
				lastobj = newhref;
			}

			if (objified[0].norecurse)
				return false;

			if (_nir_debug_ && _nir_debug_.no_recurse) {
				return false;
			}

			return true;
		};

		var do_bigimage = function() {
			nir_debug("bigimage_recursive", "do_bigimage", currenthref, deepcopy(options));

			if (options.use_cache && url_cache.has(currenthref) && !forcerecurse) {
				nir_debug("bigimage_recursive", "do_bigimage: newhref = url_cache[" + currenthref + "]", deepcopy(url_cache.get(currenthref)));

				newhref = url_cache.get(currenthref);
				used_cache = true;
				return false;
			}

			if (options.filter) {
				if (!options.filter(currenthref)) {
					console_log("Blacklisted: " + currenthref);
					return false;
				}
			}

			var big;

			if (options.catch_errors) {
				try {
					big = bigimage(currenthref, options);
				} catch(e) {
					console_error(e);
					console_error(e.stack);
				}
			} else {
				big = bigimage(currenthref, options);
			}

			return parse_bigimage(big);
		};

		var finalize = function() {
			if (options.fill_object) {
				nir_debug("bigimage_recursive", "finalize (fillobj(newhref, currentobj))", deepcopy(newhref), deepcopy(currentobj));

				if (used_cache && newhref === null) {
					endhref = deepcopy(currentobj);
				} else {
					// the reason for using fillobj(..., currentobj) is for objects that add to the last object (e.g. {url: src, head_wrong_contentlength: true})
					endhref = fillobj(deepcopy(newhref), currentobj);
				}

				if (options.include_pastobjs) {
					for (var i = 0; i < pastobjs.length; i++) {
						if (obj_indexOf(endhref, pastobjs[i].url) < 0 && !pastobjs[i].fake)
							endhref.push(deepcopy(pastobjs[i]));
					}
				}
			} else {
				nir_debug("bigimage_recursive", "finalize (newhref)", deepcopy(newhref));
				endhref = deepcopy(newhref);
			}

			nir_debug("bigimage_recursive", "endhref =", deepcopy(endhref));
		};

		var cb = null;
		if (options.cb) {
			var orig_cb = options.cb;
			options.cb = function(x) {
				// Is this needed?
				if (false) {
					for (var i = 0; i < pastobjs.length; i++) {
						if (pastobjs[i].url === null && pastobjs[i].waiting) {
							pastobjs.splice(i, 1);
							i--;
						}
					};
				}

				nir_debug("bigimage_recursive", "options.cb", deepcopy(x));

				var do_end = function() {
					nir_debug("bigimage_recursive", "do_end");

					finalize();
					do_cache();

					var blankurl = null;
					if (!options.null_if_no_change)
						blankurl = pasthrefs[pasthrefs.length - 1];

					if (!endhref || (is_array(endhref) && !endhref[0])) {
						endhref = blankurl;
					} else if (typeof endhref === "string") {
						endhref = blankurl;
					} else if (is_array(endhref) && typeof endhref[0] === "string") {
						endhref[0] = blankurl;
					} else if (is_array(endhref) && endhref[0] && !endhref[0].url) {
						endhref[0].url = blankurl;
					}

					nir_debug("bigimage_recursive", "do_end (endhref, pasthrefs, pastobjs)", endhref, pasthrefs, pastobjs);

					orig_cb(endhref);
				};

				var parseresult = parse_bigimage(x);
				if ((!parseresult || (loop_i + 1) >= options.iterations) && !forcerecurse) {
					do_end();
				} else {
					for (; loop_i < options.iterations; loop_i++) {
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

		options._internal_info = {};

		for (loop_i = 0; loop_i < options.iterations; loop_i++) {
			if (!do_bigimage())
				break;
		}

		nir_debug("bigimage_recursive", "return finalize");

		finalize();
		do_cache();

		newhref = null;

		if (options.cb && !waiting) {
			options.cb(endhref);
		}

		return deepcopy(endhref);
	};
	bigimage_recursive.default_options = default_options;

	bigimage_recursive.internal = {
		settings: settings,
		settings_meta: settings_meta,
		strings: strings
	};

	function is_internet_url(url) {
		if (!url || typeof url !== "string")
			return false;

		if (!/^https?:\/\//.test(url))
			return false;

		// local addresses (IPv4)
		if (/^[a-z]+:\/\/(127\.0\.0\.1|192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+|172\.(?:1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+|localhost|[^/.]+)\//.test(url))
			return false;

		// IPv6 (TODO: implement)
		if (/^[a-z]+:\/\/(?:[0-9a-f]*\:){1,}\//.test(url))
			return false;

		return true;
	}
	bigimage_recursive.is_internet_url = is_internet_url;

	function clear_all_caches() {
		url_cache.clear();
		real_api_cache.clear();
		cookie_cache.clear();
	}
	bigimage_recursive.clear_caches = clear_all_caches;

	var obj_to_simplelist = function(obj) {
		var out = [];
		for (var i = 0; i < obj.length; i++) {
			out.push(obj[i].url);
		}
		return out;
	};

	var obj_indexOf = function(obj, url) {
		return array_indexof(obj_to_simplelist(obj), url);
	};

	var obj_merge = function(newobj, oldobj) {
		var newobj_simple = obj_to_simplelist(newobj);

		for (var i = 0; i < oldobj.length; i++) {
			var index = array_indexof(newobj_simple, oldobj[i].url);
			if (index >= 0) {
				for (var key in oldobj[i]) {
					var old_value = oldobj[i][key];
					var new_value = newobj[index][key];

					// e.g. for headers, extra, etc.
					if (new_value !== old_value && JSON_stringify(new_value) === JSON_stringify(default_object[key])) {
						newobj[index][key]= old_value;
					}
				}

				continue;
			}
			newobj.push(oldobj[i]);
		}

		return newobj;
	}

	var bigimage_recursive_loop = function(url, options, query, fine_urls, tried_urls, oldobj) {
		var newoptions = {};
		if (!fine_urls) {
			fine_urls = [];
		}

		if (!tried_urls) {
			tried_urls = [];
		}

		if (!oldobj) {
			oldobj = [];
		}

		for (var option in options) {
			if (option === "cb") {
				newoptions.cb = function(obj) {
					if (_nir_debug_) {
						console_log("bigimage_recursive_loop's cb: obj:", deepcopy(obj));
						console_log("bigimage_recursive_loop's cb: oldobj:", deepcopy(oldobj));
					}

					obj = obj_merge(obj, oldobj);
					var images = obj_to_simplelist(obj);

					for (var i = 0; i < obj.length; i++) {
						// TODO: also remove bad_if
						if (obj[i].bad) {
							var obj_url = obj[i].url;
							var orig_url = null;

							obj.splice(i, 1);
							images.splice(i, 1);
							i--;

							for (var j = 0; j < tried_urls.length; j++) {
								if (tried_urls[j].newurl === obj_url) {
									var orig_url = tried_urls[j].newobj.url;
									var index = array_indexof(images, orig_url);
									tried_urls[j].unk = true;

									if (index >= 0) {
										obj.splice(index, 1);
										images.splice(index, 1);

										if (index < i)
											i -= 2;
										else if (index === i)
											i--;
									}

									break;
								}
							}
						}
					}

					if (_nir_debug_) {
						console_log("bigimage_recursive_loop's cb: obj after:", deepcopy(obj));
						console_log("bigimage_recursive_loop's cb: images after:", deepcopy(images));
						console_log("bigimage_recursive_loop's cb: fine_urls:", deepcopy(fine_urls));
						console_log("bigimage_recursive_loop's cb: tried_urls:", deepcopy(tried_urls));
					}

					for (var i = 0; i < fine_urls.length; i++) {
						var index = array_indexof(images, fine_urls[i].url);
						if (index >= 0) {
							obj = [obj[index]];
							if (_nir_debug_) {
								console_log("bigimage_recursive_loop's cb: returning fine_url", deepcopy(obj), deepcopy(fine_urls[i]));
							}
							return options.cb(obj, fine_urls[i].data);
						}
					}

					var try_any = false;
					for (var i = 0; i < tried_urls.length; i++) {
						if (tried_urls[i].url === url || try_any) {
							if (tried_urls[i].unk === true) {
								try_any = true;
								continue;
							}

							var index = array_indexof(images, tried_urls[i].newurl);
							if (index >= 0) {
								obj = [obj[index]];
								if (_nir_debug_) {
									console_log("bigimage_recursive_loop's cb: returning tried_url", deepcopy(obj), deepcopy(tried_urls[i]), try_any);
								}
								return options.cb(obj, tried_urls[i].data);
							} else {
								if (_nir_debug_) {
									console_log("bigimage_recursive_loop's cb: returning null tried_url", deepcopy(tried_urls[i]), try_any);
								}
								return options.cb(null, tried_urls[i].data);
							}
						}
					}

					if (_nir_debug_) {
						console_log("bigimage_recursive_loop: about to query", deepcopy(obj));
					}

					query(obj, function (newurl, newobj, data) {
						if (_nir_debug_) {
							console_log("bigimage_recursive_loop (query: newurl, newobj, data):", deepcopy(newurl), deepcopy(newobj), data);
						}

						if (!newurl) {
							if (_nir_debug_) {
								console_log("bigimage_recursive_loop (query): returning null", data);
							}
							return options.cb(null, data);
						}

						fine_urls.push({
							url: newurl,
							data: data
						});

						tried_urls.push({
							url: url,
							data: data,
							newurl: newurl,
							newobj: deepcopy(newobj),

							// This is why you use objects instead of arrays
							// I forgot what exactly this variable was supposed to accomplish
							unk: false
						});

						//if (array_indexof(images, newurl) < 0 && newurl !== url || true) {
						var newurl_index = array_indexof(images, newurl);
						if (newurl_index < 0 || !obj[newurl_index].norecurse) {
							bigimage_recursive_loop(newurl, options, query, fine_urls, tried_urls, obj);
						} else {
							//obj = obj.slice(array_indexof(images, newurl));
							obj = [obj[newurl_index]];

							if (_nir_debug_) {
								console_log("bigimage_recursive_loop (query): returning", deepcopy(obj), data);
							}
							options.cb(obj, data);
						}
					});
				};
			} else {
				newoptions[option] = options[option];
			}
		}

		if (_nir_debug_) {
			console_log("bigimage_recursive_loop", url, deepcopy(options), query, deepcopy(fine_urls), deepcopy(tried_urls), deepcopy(oldobj));
		}

		return bigimage_recursive(url, newoptions);
	};
	bigimage_recursive.loop = bigimage_recursive_loop;

	var get_tagname = function(el) {
		return el.tagName.toUpperCase();
	};

	var get_img_src = function(el) {
		if (typeof el === "string")
			return el;

		var el_tagname = get_tagname(el);

		if (el_tagname === "A")
			return el.href;

		if (el_tagname === "IFRAME") {
			return el.src.replace(/^javascript:window\.location\.replace\(["']([^"']+)["']\)$/, "$1");
		}

		if (el_tagname === "CANVAS") {
			try {
				return el.toDataURL();
			} catch (e) {
				// "Tainted canvases may not be exported", CORS error in some pages
				return;
			}
		}

		if (el_tagname === "SVG") {
			if (settings.mouseover_allow_svg_el) {
				return get_svg_src(el);
			} else {
				return null;
			}
		}

		if (el_tagname === "VIDEO") {
			return el.currentSrc || el.src || el.poster;
		}

		if (el_tagname === "IMAGE") {
			var xlink_href = el.getAttribute("xlink:href");

			if (xlink_href) {
				return xlink_href;
			} else {
				return null;
			}
		}

		// IMG or IFRAME
		// currentSrc is used if another image is used in the srcset
		return el.currentSrc || el.src;
	};

	var check_highlightimgs_supported_image = function(el) {
		var src = get_img_src(el);

		var options = {
			fill_object: true,
			exclude_problems: [], // todo: use settings' exclude_problems instead
			use_cache: "read",
			//use_cache: false,
			use_api_cache: false,
			cb: function() {},
			do_request: function() {}
		};

		if (is_interactive) {
			options.host_url = window.location.href;
			options.element = el;
			options.document = document;
			options.window = window;
		}

		var imu_output = bigimage_recursive(src, options);

		// TODO: consolidate into its own routine
		if (imu_output.length !== 1)
			return true;

		var imu_obj = imu_output[0];
		if (imu_obj.url !== src)
			return true;

		for (var key in imu_obj) {
			if (key === "url")
				continue;

			if (!(key in default_object))
				return true;

			// e.g. for []
			if (JSON_stringify(default_object[key]) !== JSON_stringify(imu_obj[key]))
				return true;
		}

		return false;
	};

	var send_redirect = function(obj, cb, tabId) {
		if (is_extension) {
			extension_send_message({
				type: "redirect",
				data: {
					obj: obj,
					tabId: tabId
				}
			}, function() {
				cb();
			});
		} else {
			cb();
		}
	};

	var redirect = function(url, obj) {
		if (_nir_debug_) {
			console_log("redirect", url, obj);
		}

		if (_nir_debug_ && _nir_debug_.no_redirect)
			return;

		if (url === window.location.href)
			return;

		// wrap in try/catch due to nano defender
		try {
			// avoid downloading more before redirecting
			window.stop();
		} catch (e) {
		}

		send_redirect(obj, function() {
			if (settings.redirect_history) {
				window.location.assign(url);
			} else {
				window.location.replace(url);
			}
		});
	};

	// these functions can run before the document has loaded
	var cursor_wait = function() {
		if (document.documentElement)
			document.documentElement.style.cursor = "wait";
	};

	var cursor_default = function() {
		if (document.documentElement)
			document.documentElement.style.cursor = "default";
	};


	var infobox_timer = null;
	var show_image_infobox = function(text) {
		var div = document_createElement("div");
		div.style.backgroundColor = "#fffabb";
		div.style.position = "absolute";
		div.style.top = "0px";
		div.style.left = "0px";
		div.style.padding = ".3em .8em";
		div.style.boxShadow = "0px 0px 20px rgba(0,0,0,.6)";
		div.style.margin = ".8em";
		div.style.lineHeight = "1.5em";

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
			if (infobox_timer || settings.redirect_infobox_timeout <= 0)
				return;

			infobox_timer = setTimeout(function() {
				document.body.removeChild(div);
			}, settings.redirect_infobox_timeout * 1000);
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
		if (ok_errors && is_array(ok_errors)) {
			for (var i = 0; i < ok_errors.length; i++) {
				if (error.toString() === ok_errors[i].toString()) {
					return true;
				}
			}

			return false;
		}

		return null;
	};

	var get_single_trigger_key_text = function(list) {
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
			var capitalized = string_charat(list[i], 0).toUpperCase() + list[i].slice(1);
			if (list.length === 1 && (capitalized === "Left" || capitalized === "Right" || capitalized === "Up" || capitalized === "Down")) {
				capitalized += " Arrow";
			}

			newlist.push(_(capitalized));
		}

		return newlist.join("+");
	};

	var get_trigger_key_texts = function(list) {
		if (!is_array(list[0])) {
			list = [list];
		}

		var result = [];

		for (var i = 0; i < list.length; i++) {
			result.push(get_single_trigger_key_text(list[i]));
		}

		return result;
	};

	var get_trigger_key_text = function(list) {
		return get_trigger_key_texts(list).join(" / ");
	};

	var truncate_with_ellipsis = function(text, maxchars) {
		var truncate_regex = new RegExp("^((?:.{" + maxchars + "}|.{0," + maxchars + "}[\\r\\n]))[\\s\\S]+?$");
		// "$1…"
		return text.replace(truncate_regex, decodeURIComponent("%241%E2%80%A6"));
	};

	var size_to_text = function(size) {
		var sizes = ["", "K", "M", "G", "T", "P"];

		while (size > 1024 && sizes.length > 1) {
			size /= 1024.;
			sizes.shift();
		}

		return size.toFixed(2).replace(/\.00$/, "") + sizes[0] + "B";
	};

	var check_image = function(obj, page_url, err_cb, ok_cb, no_infobox) {
		if (_nir_debug_)
			console_log("check_image", deepcopy(obj), page_url, no_infobox);

		if (is_array(obj)) {
			obj = obj[0];
		}

		if (!obj || !obj.url) {
			ok_cb(obj);
			return;
		}

		var print_orig = function() {
			if (obj && obj.extra) {
				if (obj.extra.page) {
					console_log("Original page: " + obj.extra.page);
				}

				if (obj.extra.caption) {
					console_log("Caption: " + obj.extra.caption);
				}
			}
		};

		var url = obj.url;
		var err_txt;

		if (url === page_url) {
			print_orig();

			if (_nir_debug_)
				console_log("(check_image) url == page_url", url, page_url);

			ok_cb(url);
		} else  {
			var headers = obj.headers;
			console_log(obj.url);

			print_orig();

			if (obj) {
				if (obj.bad) {
					err_txt = "Bad image";
				} else if (obj.video && obj.video !== true) {
					err_txt = "Can't redirect to streaming video type " + JSON_stringify(obj.video);
				} else if (obj.is_pagelink) {
					err_txt = "Can't redirect to page";
				}

				if (err_txt) {
					if (err_cb) {
						err_cb(err_txt);
					} else {
						console_error(err_txt);
					}
					return;
				}
			}

			var mouseover_text = function(reason) {
				if (!is_interactive)
					return;

				if (no_infobox) {
					return err_cb(reason, true);
				}

				var mouseover;
				if (!settings.mouseover) {
					mouseover = "disabled";
				} else if (settings.mouseover_trigger_behavior === "keyboard") {
					mouseover = get_trigger_key_text(settings.mouseover_trigger_key);
				} else if (settings.mouseover_trigger_behavior === "mouse") {
					mouseover = "delay " + settings.mouseover_trigger_delay + "s";
				}

				// TODO: another option could be to allow it whenever the image can be imu'd
				imagetab_ok_override = true;

				var trigger_options_link = "<a style='color:blue; font-weight:bold' href='" + options_page + "' target='_blank' rel='noreferrer'>" + mouseover + "</a>";
				var infobox_text = _("Mouseover popup (%%1) is needed to display the original version", trigger_options_link) + " (" + _(reason) + ")";

				if (settings.redirect_infobox_url) {
					var link = document_createElement("a");
					link.href = url;
					link.innerText = truncate_with_ellipsis(url, 80);
					link.setAttribute("target", "_blank");

					infobox_text += "<br />" + link.outerHTML;
				}

				try {
					show_image_infobox(infobox_text);
				} catch (e) {
					console_error(e);
				}
			};

			if (!_nir_debug_ || !_nir_debug_.no_request) {
				if (is_interactive)
					cursor_wait();

				var url_domain = url.replace(/^([a-z]+:\/\/[^/]*).*?$/, "$1");

				var origheaders = deepcopy(headers);

				var customheaders = true;
				if (!headers || Object.keys(headers).length === 0) {
					headers = {};
					customheaders = false;
				}

				var specified_headers = new_set();
				for (var header in headers) {
					set_add(specified_headers, header.toLowerCase());
				}

				var base_headers = {
					// Origin is not often added by the browser, and doesn't work for some sites
					//"origin": url_domain,
					"referer": page_url,
					// e.g. for Tumblr URLs, this is sent by the browser when redirecting
					"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
					"sec-fetch-dest": "document",
					"sec-fetch-mode": "navigate",
					"sec-fetch-site": "cross-site"
				};

				for (var header in base_headers) {
					if (!set_has(specified_headers, header)) {
						headers[header] = base_headers[header];
					}
				}

				if (customheaders && Object.keys(origheaders).length === 1 && ("Referer" in origheaders)) {
					var domain = page_url;
					domain = domain.replace(/^[a-z]+:\/\/([^/]*).*?$/, "$1");
					var url_domain = url.replace(/^[a-z]+:\/\/([^/]*).*?$/, "$1");

					if (obj.referer_ok.same_domain && domain === url_domain) {
						customheaders = false;
					} else if (obj.referer_ok.same_domain_nosub && get_domain_nosub(domain) === get_domain_nosub(url_domain)) {
						customheaders = false;
					}
				}

				if (customheaders && !is_extension) {
					document.documentElement.style.cursor = "default";
					console_log("Custom headers needed, currently unhandled");

					mouseover_text("custom headers");
					return;
				}

				if (_nir_debug_)
					console_log("(check_image) headers", headers);

				if (obj.always_ok ||
					(!obj.can_head && !settings.canhead_get)) {
					if (_nir_debug_) {
						console_log("(check_image) always_ok || !can_head", url, deepcopy(obj));
					}

					return ok_cb(url);
				}

				var method = "HEAD";
				if (!obj.can_head && settings.canhead_get) {
					if (_nir_debug_)
						console_log("Trying GET");
					method = "GET";
				}

				var handled = false;

				var onload_cb = function(resp) {
					if (handled)
						return;

					handled = true;

					if (_nir_debug_)
						console_log("(check_image) resp", resp);

					// FireMonkey returns null when tracking protection blocks a URL
					if (is_userscript && userscript_manager === "FireMonkey" && !resp) {
						err_txt = "Error: resp == null (tracking protection blocked, FireMonkey bug)";
						if (err_cb) {
							err_cb(err_txt);
						} else {
							console_error(err_txt);
						}

						return;
					}

					// nano defender removes this.DONE
					if (resp.readyState < 2) {
						return;
					}

					if (is_userscript && !resp.status && resp.readyState < 4) {
						// Tampermonkey and Greasemonkey have a bug where status isn't set for onprogress events
						// Tampermonkey issue: https://github.com/Tampermonkey/tampermonkey/issues/857
						// Greasemonkey issue: https://github.com/greasemonkey/greasemonkey/issues/3068
						handled = false;
						return;
					}

					if (resp.readyState < 4) {
						if (req && req.abort)
							req.abort();
					}

					if (resp.status === 0 ||
						check_tracking_blocked(resp)) {
						// error loading image (IP doesn't exist, etc.), ignore
						err_txt = "Error: status == 0";
						if (err_cb) {
							err_cb(err_txt);
						} else {
							console_error(err_txt);
						}

						return;
					}

					cursor_default();

					if (resp.finalUrl === page_url) {
						console_log(resp.finalUrl);
						console_log("Same URL");
						return;
					}

					var headers_list = parse_headers(resp.responseHeaders);
					var headers = headers_list_to_dict(headers_list);

					if (_nir_debug_)
						console_log("(check_image) resp headers", headers);


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

					// https://1.f.ix.de/scale/crop/3840x2160/q75/se/ct/motive/image/4291/ct-motiv-07-2019_3840x2160.jpg
					//   https://www.heise.de/ct/motive/image/4291/ct-motiv-07-2019_3840x2160.jpg -- no content-type header
					if ((content_type.match(/text\/html/) || !content_type) && !obj.head_wrong_contenttype &&
						ok_error !== true) {
						var err_txt = "Error: Not an image: " + (content_type || "(no content-type)");
						if (err_cb) {
							err_cb(err_txt);
						} else {
							console_error(err_txt);
						}

						return;
					}

					if (!is_extension || settings.redirect_disable_for_responseheader) {
						if (obj.forces_download || (
							(content_type.match(/(?:binary|application|multipart|text)\//) ||
								// such as [image/png] (server bug)
								content_type.match(/^ *\[/)) && !obj.head_wrong_contenttype) ||
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

					if (check_bad_if(obj.bad_if, resp)) {
						console_error("Bad image (bad_if)", obj.bad_if, resp);
						return err_cb("bad image");
					}

					if (!customheaders || is_extension) {
						if (_nir_debug_) {
							console_log("(check_image) finalUrl", resp.finalUrl || url, resp, deepcopy(obj));
						}

						ok_cb(resp.finalUrl || url);
					} else {
						console_log("Custom headers needed, currently unhandled");
					}
				};

				var req = do_request({
					method: method,
					url: url,
					headers: headers,
					trackingprotection_failsafe: true,
					onprogress: function(resp) {
						// 2 = HEADERS_RECEIVED
						if (resp.readyState >= 2 && resp.responseHeaders) {
							onload_cb(resp);
						}
					},
					onload: onload_cb
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

	function contenttype_can_be_redirected(contentType) {
		// amazonaws's error page are application/xml
		return !(/^(?:text|application)\//.test(contentType));
	}

	function currenttab_is_image() {
		return contenttype_can_be_redirected(document.contentType);
	}

	function do_redirect_sub(page_url, force_page, redirect) {
		var bigimage_obj = {
			fill_object: true,
			force_page: force_page,
			cb: function(newhref) {
				if (_nir_debug_) {
					console_log("do_redirect (final)", newhref);
				}

				cursor_default();

				if (!newhref) {
					return;
				}

				if (is_interactive && settings.print_imu_obj)
					console_log(newhref);

				var newurl = newhref[0].url;

				if (false && newhref[0].extra && newhref[0].extra.page) {
					console_log("Original page: " + newhref[0].extra.page);
				}

				if (newurl === page_url)
					return;

				if (!newurl)
					return;

				if (_nir_debug_)
					console_log("redirect (recursive loop)", newhref);

				redirect(newurl, newhref);
			}
		};

		if (is_interactive) {
			bigimage_obj.document = document;
			bigimage_obj.window = get_window();
		}

		bigimage_recursive_loop(page_url, bigimage_obj, function(newhref, real_finalcb) {
			if (_nir_debug_) {
				console_log("do_redirect", newhref);
			}

			var currentobj = null;
			var finalcb = function(newurl, data, newobj) {
				real_finalcb(newurl, newobj || currentobj, data);
			};

			if (false && (!newhref[0].can_head || newhref[0].always_ok)) {
				var newurl = newhref[0].url;

				if (newurl === window.location.href) {
					cursor_default();
					return;
				}

				if (_nir_debug_) {
					console_log("Not checking due to can_head == false || always_ok == true");
				}

				finalcb(newurl);
				return;
			}

			var new_newhref = newhref;

			if (!settings.allow_video) {
				var new_newhref = [];
				for (var i = 0; i < newhref.length; i++) {
					if (!newhref[i].video) {
						new_newhref.push(newhref[i]);
					}
				}
			}

			var no_infobox = settings.redirect_to_no_infobox;
			var infobox_urls = [];
			var use_infobox = false;

			// TODO: avoid requesting again for second round after no_infobox (e.g. for force_download errors)
			var index = 0;
			var cb = function(err_txt, is_infobox) {
				if (_nir_debug_) {
					console_log("do_redirect_sub's err_cb:", err_txt, is_infobox);
				}

				if (is_infobox)
					infobox_urls.push(new_newhref[index]);

				index++;

				var array = new_newhref;
				if (use_infobox)
					array = infobox_urls;

				if (index >= array.length) {
					if (no_infobox && infobox_urls.length > 0) {
						use_infobox = true;
						no_infobox = false;
						index = 0;
					} else {
						cursor_default();
						console_error(err_txt);
						return;
					}
				}

				// FIXME: deduplicate
				if (same_url(window.location.href, array[index]) && no_infobox && infobox_urls.length > 0) {
					use_infobox = true;
					no_infobox = false;
					index = 0;
				}

				currentobj = array[index];
				check_image(currentobj, page_url, cb, finalcb, no_infobox);
			};
			currentobj = new_newhref[0];
			check_image(currentobj, page_url, cb, finalcb, no_infobox);
		});
	}

	function do_redirect() {
		if (!currenttab_is_image()) {
			return;
		}

		cursor_wait();

		var force_page = false;
		if ((settings["redirect_force_page"] + "") === "true")
			force_page = true;

		do_redirect_sub(window.location.href, force_page, redirect);
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

					our_removeEventListener(document, "readystatechange", state_cb);
				}
			};

			our_addEventListener(document, "readystatechange", state_cb);
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

		if (event.buttons !== undefined) {
			var buttonnames = ["button1", "button2", "button3", "button4", "button5"];
			var buttons = event.buttons;
			while (buttonnames.length > 0) {
				if (buttons & 1) {
					keys[buttonnames[0]] = true;
				} else {
					keys[buttonnames[0]] = false;
				}

				buttons >>= 1;
				buttonnames.shift();
			}
		}

		if (event.type === "wheel") {
			if (event.deltaY < 0) {
				keys.wheelUp = true;
			} else if (event.deltaY > 0) {
				keys.wheelDown = true;
			}

			if (event.deltaX < 0) {
				keys.wheelLeft = true;
			} else if (event.deltaX > 0) {
				keys.wheelRight = true;
			}
		}

		var str = keycode_to_str(event);
		if (str === undefined) {
			return keys;
		}

		keys[str] = value;
		return keys;
	}

	var keystr_is_wheel = function(keystr) {
		return /^wheel/.test(keystr);
	};

	var keystr_is_button12 = function(keystr) {
		return keystr === "button1" || keystr === "button2";
	}

	var chord_is_only_wheel = function(chord) {
		for (var i = 0; i < chord.length; i++) {
			if (!keystr_is_wheel(chord[i]) && !keystr_is_button12(chord[i])) {
				return false;
			}
		}

		return true;
	};

	var keysequence_bad = function(keyseq) {
		if (chord_is_only_wheel(keyseq))
			return true;

		if (keyseq.length !== 1)
			return false;

		return keystr_is_button12(keyseq[0]);
	};

	var keysequence_valid = function(keyseq) {
		if (keyseq.length === 0)
			return false;

		if (keysequence_bad(keyseq))
			return false;

		if (keyseq.length > 1)
			return true;

		return true;
	};

	var prefers_dark_mode = function() {
		try {
			return window.matchMedia("(prefers-color-scheme: dark)").matches;
		} catch (e) {
			return false;
		}
	};

	function update_dark_mode() {
		if (!is_maxurl_website && !is_options_page) {
			return;
		}

		if (prefers_dark_mode()) {
			set_default_value("dark_mode", true);
		}

		if (settings.dark_mode) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}

	var request_permission = function(permission, cb) {
		if (!is_extension)
			return cb(false);

		// This has to be done in the content script under firefox: https://github.com/qsniyg/maxurl/issues/254
		if (true) {
			try {
				chrome.permissions.request({
					permissions: [permission]
				}, function(granted) {
					if (granted) {
						extension_send_message({
							type: "permission_handler",
							data: {
								permission: permission
							}
						});
					}

					cb(granted);
				});
			} catch(e) {
				console_error(e);
				cb(false);
			}
		} else {
			extension_send_message({
				type: "permission",
				data: {
					permission: permission
				}
			}, function(result) {
				cb(result.data.granted);
			});
		}
	};

	var current_options_tab = "general";
	function do_options() {
		update_dark_mode();

		var recording_keys = false;
		var options_chord = [];
		var current_options_chord = [];

		function update_options_chord(event, value) {
			if (!recording_keys)
				return;

			var map = get_keystrs_map(event, value);

			if ((keycode_to_str(event) || event.type === "mousedown") &&
				current_options_chord.length === 0) {
				// Don't clear the options chord for either left or right mouse buttons
				if (event.button !== 0 && event.button !== 2)
					options_chord = [];
			}

			var old_options_chord = deepcopy(options_chord);
			for (var key in map) {
				update_options_chord_sub(key, map[key]);
			}

			if (keysequence_bad(options_chord))
				options_chord = old_options_chord;

			recording_keys();
		}

		function update_options_chord_sub(str, value) {
			if (value) {
				if (array_indexof(options_chord, str) < 0) {
					options_chord.push(str);
				}

				if (array_indexof(current_options_chord, str) < 0) {
					current_options_chord.push(str);
				}
			} else {
				if (array_indexof(current_options_chord, str) >= 0) {
					current_options_chord.splice(array_indexof(current_options_chord, str), 1);
				}
			}
		}

		document.addEventListener('keydown', function(event) {
			update_options_chord(event, true);

			if (recording_keys) {
				event.preventDefault();
				return false;
			}
		});

		document.addEventListener('mousedown', function(event) {
			update_options_chord(event, true);

			if (recording_keys) {
				event.preventDefault();
				//event.stopImmediatePropagation();
				return false;
			}
		});

		document.addEventListener('wheel', function(event) {
			update_options_chord(event, true);

			if (recording_keys) {
				event.preventDefault();
				event.stopImmediatePropagation();
				event.stopPropagation();
				return false;
			}
		}, {
			capture: true,
			passive: false
		});

		document.addEventListener("contextmenu", function(event) {
			if (recording_keys) {
				event.preventDefault();
				event.stopImmediatePropagation();
				return false;
			}
		});

		document.addEventListener('keyup', function(event) {
			update_options_chord(event, false);

			if (recording_keys) {
				event.preventDefault();
				return false;
			}
		});

		document.addEventListener('mouseup', function(event) {
			if (event.button === 1)
				return;

			update_options_chord(event, false);

			if (recording_keys) {
				event.preventDefault();
				event.stopImmediatePropagation();
				return false;
			}
		});

		var options_el = document.getElementById("options");

		if (!is_extension_options_page)
			options_el.innerHTML = "<h1>" + _("options_header") + "</h1>";
		else
			options_el.innerHTML = "";

		var saved_el = document.getElementById("saved");
		if (!saved_el) {
			saved_el = document_createElement("div");
			saved_el.style.visibility = "hidden";
			saved_el.id = "saved";
			saved_el.classList.add("topsaved");
		}

		var get_default_saved_text = function() {
			var text = "saved_refresh_target";
			if (is_extension || typeof GM_addValueChangeListener !== "undefined") {
				text = "saved_no_refresh";
			}

			return text;
		};

		var set_saved_text = function(id) {
			saved_el.innerHTML = "<p>" + _(id) + "</p>";
		};

		set_saved_text(get_default_saved_text());
		//saved_el.style.pointer_events = "none";
		//saved_el.style.textAlign = "center";
		//saved_el.style.paddingTop = "1em";
		//saved_el.style.fontStyle = "italic";
		//saved_el.style.color = "#0af";
		var saved_timeout = null;

		var create_update_available = function() {
			var update_available_el = document_createElement("div");
			update_available_el.classList.add("update-available");
			update_available_el.innerHTML = "Update available: v" + current_version + " -&gt; ";

			var link = get_update_url();

			if (link) {
				update_available_el.innerHTML += "<a href=\"" + link + "\" target=\"_blank\" rel=\"noreferer\">v" + settings.last_update_version + "</a>";
			} else {
				update_available_el.innerHTML += "v" + settings.last_update_version;
			}

			return update_available_el;
		};

		if (settings.check_updates && version_compare(current_version, settings.last_update_version) === 1) {
			options_el.appendChild(create_update_available());
		}

		var rules_failed_el = document.createElement("p");
		if (set_require_rules_failed_el(rules_failed_el)) {
			options_el.appendChild(rules_failed_el);
		}

		var topbtns_holder = document_createElement("div");
		topbtns_holder.id = "topbtns";
		options_el.appendChild(topbtns_holder);

		var importexport_ocontainer = document_createElement("div");
		importexport_ocontainer.id = "importexport";
		importexport_ocontainer.classList.add("center-outer");
		importexport_ocontainer.style.display = "none";
		options_el.appendChild(importexport_ocontainer);

		var importexport_container = document_createElement("div");
		importexport_container.classList.add("center-inner");
		importexport_ocontainer.appendChild(importexport_container);

		var importexport_text = document_createElement("textarea");
		importexport_container.appendChild(importexport_text);

		var importexport_btn = document_createElement("button");
		importexport_btn.innerText = _("Import");
		importexport_btn.onclick = function() {
			var value;
			var append = false;

			var import_text = importexport_text.value;
			import_text = strip_whitespace_simple(import_text);

			if (import_text[0] === "+") {
				append = true;
				import_text = import_text.substring(1);
			}

			try {
				value = JSON_parse(import_text);
			} catch (e) {
				console_error(e);
				importexport_text.value = "Error!";
				return;
			}

			var changed = false;

			var current_settings = deepcopy(settings);

			var new_settings;
			if (!append)
				new_settings = deepcopy(orig_settings);
			else
				new_settings = deepcopy(settings);

			var settings_version;
			for (var key in value) {
				if (!(key in settings)) {
					if (key === "settings_version") {
						settings_version = value[key];
						continue;
					} else {
						console_warn("Unknown key in imported settings:", key);
					}
				}

				new_settings[key] = value[key];
			}

			for (var key in new_settings) {
				if (JSON_stringify(new_settings[key]) !== JSON_stringify(current_settings[key])) {
					settings[key] = new_settings[key];
					set_value(key, new_settings[key]);
					changed = true;
				}
			}

			if (settings_version === undefined) {
				settings_version = 1;
			}

			upgrade_settings_with_version(settings_version, new_settings, function(new_changed) {
				if (changed || new_changed) {
					console_log("Settings imported");

					setTimeout(function() {
						do_options();
					}, 1);
				} else {
					console_log("No settings changed");
				}

				show_importexport(false);
			});
		};
		importexport_container.appendChild(importexport_btn);

		var show_importexport = function(show, btn) {
			if (show) {
				importexport_ocontainer.style.display = "block";
			} else {
				importexport_state = null;

				importexport_ocontainer.style.display = "none";
			}

			if (btn) {
				if (show)
					importexport_state = "import";

				importexport_btn.style.display = "inline-block";
			} else {
				if (show)
					importexport_state = "export";

				importexport_btn.style.display = "none";
			}
		};

		var importexport_state = null;

		var import_btn = document_createElement("button");
		import_btn.id = "importbtn";
		import_btn.innerText = _("Import");
		import_btn.title = _("Import settings");
		import_btn.onclick = function() {
			if (importexport_state === "import")
				return show_importexport(false);

			importexport_text.value = "";

			show_importexport(true, true);
		};
		topbtns_holder.appendChild(import_btn);

		var export_btn = document_createElement("button");
		export_btn.id = "exportbtn";
		export_btn.innerText = _("Export");
		export_btn.title = _("Export settings");
		export_btn.onclick = function() {
			if (importexport_state === "export")
				return show_importexport(false);

			var newsettings = deepcopy(settings);
			get_value("settings_version", function(value) {
				if (value !== undefined)
					newsettings.settings_version = value;
				importexport_text.value = JSON_stringify(newsettings);

				show_importexport(true, false);
			});
		};
		topbtns_holder.appendChild(export_btn);

		var enabled_map = {};
		var reason_map = {};

		var check_sub_option = function(meta, reason) {
			if (typeof reason === "undefined") {
				reason = {};
			}

			var enabled = true;

			var prepare_array = function(value) {
				var result = deepcopy(value);
				if (!result) {
					return null;
				}

				if (!is_array(result)) {
					result = [result];
				}

				return result;
			}

			var requires = prepare_array(meta.requires);
			var disabled_if = prepare_array(meta.disabled_if);

			if (!meta.imu_enabled_exempt) {
				if (!settings.imu_enabled) {
					enabled = false;
				}
			}

			reason.good = [];
			reason.bad = [];
			if (enabled && requires) {
				enabled = check_validity(requires, reason);
				reason.good = [];
			}

			if (enabled && disabled_if) {
				reason.good = [];
				reason.bad = [];

				enabled = !check_validity(disabled_if, reason);
				reason.bad = [];
			}

			return enabled;
		};

		var check_option = function(setting) {
			var meta = settings_meta[setting];

			enabled_map[setting] = "processing";
			reason_map[setting] = {};
			var enabled = check_sub_option(meta, reason_map[setting]);
			enabled_map[setting] = enabled;

			return enabled;
		};

		var check_validity = function(array, reason) {
			for (var i = 0; i < array.length; i++) {
				var current = array[i];
				var current_valid = true;

				var good_reason, bad_reason;

				if (typeof reason !== "undefined") {
					good_reason = [];
					bad_reason = [];
				}

				for (var required_setting in current) {
					if (required_setting[0] === "_")
						continue;

					var required_value = current[required_setting];

					var value = settings[required_setting];
					if (is_array(value) && !is_array(required_value))
						value = value[0];

					if (!(required_setting in enabled_map)) {
						check_option(required_setting);
					}

					if (enabled_map[required_setting] === "processing") {
						console_error("Dependency cycle detected for: " + setting + ", " + required_setting);
						return;
					}

					var current_reason = {
						setting: required_setting,
						required_value: required_value,
						current_value: value,
						enabled: enabled_map[required_setting]
					};

					if (enabled_map[required_setting] && value === required_value) {
						//current_valid = true;
						if (typeof good_reason !== "undefined") {
							good_reason.push(current_reason);
						}
					} else {
						current_valid = false;

						if (typeof bad_reason !== "undefined") {
							bad_reason.push(current_reason);
						}
					}

					if (!current_valid && typeof reason === "undefined") {
						break;
					}
				}

				if (typeof reason !== "undefined") {
					reason.good.push(good_reason);
					reason.bad.push(bad_reason);
				}

				if (current_valid) {
					return true;
				}
			}

			return false;
		};

		var get_option_from_options = function(options, option) {
			if (option in options)
				return options[option];

			for (var option_name in options) {
				if (/^_group/.test(option_name)) {
					return get_option_from_options(options[option_name], option);
				}
			}

			return null;
		};

		var is_nonempty_reason = function(goodbad) {
			for (var i = 0; i < goodbad.length; i++) {
				if (goodbad[i].length !== 0)
					return true;
			}

			return false;
		};

		var is_reason_goodbad = function(reason) {
			if (is_nonempty_reason(reason.good))
				return "good";

			if (is_nonempty_reason(reason.bad))
				return "bad";

			return null;
		};

		var fill_requirements = function(reason, div) {
			div.innerHTML = "";

			if (!settings.settings_show_requirements)
				return;

			var goodbad = is_reason_goodbad(reason);
			if (!goodbad)
				return;

			var requires_p = document_createElement("p");
			requires_p.innerText = _("Requires:");
			div.appendChild(requires_p);

			var els = [];

			var array = reason[goodbad];
			for (var i = 0; i < array.length; i++) {
				if (array[i].length === 0)
					continue;

				var ul = document_createElement("ul");

				for (var j = 0; j < array[i].length; j++) {
					var single_reason = array[i][j];

					var option_name = single_reason.setting;
					if (single_reason.setting in settings_meta) {
						option_name = _(settings_meta[single_reason.setting].name);
					}

					// TODO: don't check label_texts, this doesn't work with tabs. Instead, do proper parsing
					//var wanted_value_el = document.querySelector("label[for=\"input_" + single_reason.setting + "_" + single_reason.required_value + "\"]");
					var wanted_value = single_reason.required_value;
					var input_id = "input_" + single_reason.setting + "_" + single_reason.required_value;
					if (input_id in label_texts) {
						wanted_value = label_texts[input_id];
					}

					var equals = "=";
					if (goodbad === "good")
						equals = "!=";

					var li = document_createElement("li");
					li.innerText = option_name + " " + equals + " " + wanted_value;
					ul.appendChild(li);
				}

				els.push(ul);
			}

			var newels = [];
			for (var i = 0; i < els.length - 1; i++) {
				newels.push(els[i]);

				// FIXME: this should be 'and' for disabled_if
				var or_p = document_createElement("p");
				or_p.innerText = _("Or:");

				newels.push(or_p);
			}

			newels.push(els[els.length-1]);

			for (var i = 0; i < newels.length; i++) {
				div.appendChild(newels[i]);
			}
		};

		function check_disabled_options() {
			var options = options_el.querySelectorAll("div.option");

			enabled_map = {};

			for (var i = 0; i < options.length; i++) {
				var setting = options[i].id.replace(/^option_/, "");

				var enabled = check_option(setting);

				if (enabled) {
					options[i].classList.remove("disabled");
					options[i].classList.remove("disabled-hidden");

					options[i].getElementsByClassName("requirements")[0].classList.add("hidden");

					var meta = settings_meta[setting];
					var meta_options = meta.options;
					var regexp = new RegExp("^input_" + setting + "_");

					var els = options[i].querySelectorAll("input, textarea, button, select");
					for (var j = 0; j < els.length; j++) {
						var input = els[j];

						input.disabled = false;

						if (meta_options) {
							var option_name = input.id.replace(regexp, "");
							if (option_name !== input.id) {
								var option_value = get_option_from_options(meta_options, option_name);
								if (option_value) {
									if (!check_sub_option(option_value)) {
										input.disabled = true;
									}
								}
							}
						}
					}
				} else {
					options[i].classList.add("disabled");

					if (!settings.settings_show_disabled)
						options[i].classList.add("disabled-hidden");

					var els = options[i].querySelectorAll("input, textarea, button, select");
					for (var j = 0; j < els.length; j++) {
						var input = els[j];
						input.disabled = true;
					}

					var requirements_div = options[i].getElementsByClassName("requirements")[0];
					//requirements_div.style.display = "block";
					requirements_div.classList.remove("hidden");
					fill_requirements(reason_map[setting], requirements_div);
				}
			}
		}

		function show_warnings() {
			var options = options_el.querySelectorAll("div.option");
			for (var i = 0; i < options.length; i++) {
				var setting = options[i].id.replace(/^option_/, "");

				var meta = settings_meta[setting];
				if (meta.warning) {
					var warning = meta.warning[settings[setting] + ""];
					var el = options[i].querySelector(".warning");
					if (!el)
						continue;

					if (warning) {
						el.innerHTML = warning;
						el.style.display = "block";
					} else {
						el.style.display = "none";
					}
				}
			}
		}

		function show_saved_message(meta) {
			if (meta.needrefresh) {
				set_saved_text("saved_refresh_target");
			} else {
				set_saved_text(get_default_saved_text());
			}

			saved_el.setAttribute("style", "");
			saved_el.classList.remove("fadeout");

			if (saved_timeout)
				clearTimeout(saved_timeout);

			saved_timeout = setTimeout(function() {
				saved_el.classList.add("fadeout");
			}, 2000);
		}

		function md_to_html(parent, text) {
			var current_el = null;
			var current_text = "";
			var current_tag = null;

			var apply_tag = function() {
				if (current_text.length === 0)
					return;

				if (current_tag === "`") {
					current_el = document_createElement("code");
				} else {
					current_el = document_createElement("span");
				}

				current_el.innerText = current_text;
				current_text = "";
				parent.appendChild(current_el);
			}

			// fast path
			if (string_indexof(text, "`") < 0 && string_indexof(text, "\n") < 0) {
				current_text = text;
				apply_tag();
				return;
			}

			for (var i = 0; i < text.length; i++) {
				if (text[i] === current_tag) {
					apply_tag();
					current_tag = null;
					continue;
				}

				if (text[i] === "`") {
					apply_tag();
					current_tag = text[i];
					continue;
				}

				if (text[i] === "\n") {
					apply_tag();
					parent.appendChild(document_createElement("br"));
					continue;
				}

				current_text += text[i];
			}

			apply_tag();
		}

		var tabscontainer;
		if (settings.settings_tabs) {
			tabscontainer = document_createElement("div");
			tabscontainer.id = "tabs";
			options_el.appendChild(tabscontainer);
		}

		var category_els = {};
		var subcategory_els = {};

		for (var category in categories) {
			var catname = _(categories[category]);

			var div = document_createElement("div");
			div.id = "cat_" + category;
			div.classList.add("category");

			category_els[category] = [div];

			if (settings.settings_tabs) {
				div.classList.add("tabbed");

				var tab = document_createElement("span");
				tab.classList.add("tab");
				//tab.href = "#cat_" + category;
				tab.id = "tab_cat_" + category;
				tab.innerText = catname;

				(function(category) {
					tab.onclick = function() {
						current_options_tab = category;
						do_options();
					};
				})(category);

				if (category === current_options_tab) {
					tab.classList.add("active");
				} else {
					div.style.display = "none";
				}

				category_els[category].push(tab);

				tabscontainer.appendChild(tab);
			} else {
				var h2 = document_createElement("h2");
				h2.innerText = catname;
				div.appendChild(h2);
			}

			var subdiv = document_createElement("div");
			subdiv.id = "subcat_" + category;
			subdiv.classList.add("subcat");
			subdiv.classList.add("frame");
			div.appendChild(subdiv);
			subcategory_els[category] = subdiv;

			if (category in subcategories) {
				for (var subcat in subcategories[category]) {
					var newsubdiv = document_createElement("div");
					newsubdiv.id = "subcat_" + subcat;
					newsubdiv.classList.add("subcat");
					newsubdiv.classList.add("frame");

					var h3 = document_createElement("h3");
					h3.innerText = _(subcategories[category][subcat]);
					newsubdiv.appendChild(h3);

					div.appendChild(newsubdiv);
					subcategory_els[subcat] = newsubdiv;
				}
			}

			options_el.appendChild(div);
		}

		var show_advanced = settings.advanced_options;

		var normalize_value = function(value) {
			if (is_array(value) && value.length === 1) {
				return JSON.stringify(value[0]);
			}

			return JSON.stringify(value);
		};

		var category_settings = {};
		var label_texts = {};

		var add_setting_dom = function(setting) {
			var meta = settings_meta[setting];
			if (!meta) {
				return;
			}

			if (!(setting in orig_settings))
				return;

			var value = settings[setting];
			var orig_value = orig_settings[setting];

			if (meta.hidden)
				return;

			if (meta.userscript_only && !is_userscript)
				return;

			if (meta.extension_only && !is_extension)
				return;

			if (meta.advanced && !show_advanced)
				return;

			category_settings[meta.category] = true;
			if (settings.settings_tabs && meta.category !== current_options_tab)
				return;

			var option = document_createElement("div");
			option.classList.add("option");
			option.id = "option_" + setting;

			var table = document_createElement("table");
			table.classList.add("option-table");

			var tr = document_createElement("tr");
			table.appendChild(tr);

			var name = document_createElement("strong");
			md_to_html(name, _(meta.name));

			var description = _(meta.description);
			if (meta.description_userscript && is_userscript)
				description = _(meta.description_userscript);

			name.title = description;

			var name_td = document_createElement("td");
			name_td.classList.add("name_td");
			name_td.classList.add("name_td_va_middle");

			var revert_btn = document.createElement("button");
			// \u2b8c = ⮌
			revert_btn.innerText = "\u2b8c";
			revert_btn.classList.add("revert-button");
			revert_btn.title = _("Revert");

			revert_btn.onclick = function() {
				if (revert_btn.disabled) return;

				do_update_setting(setting, orig_value, meta);

				run_soon(do_options);
			};

			var check_value_orig_different = function(value) {
				var value_norm = normalize_value(value);
				var orig_norm = normalize_value(orig_value);

				if (meta.type === "keysequence") {
					value_norm = JSON_stringify(normalize_keychord(value));
					orig_norm = JSON_stringify(normalize_keychord(orig_value));
				}

				var value_orig_different = value_norm !== orig_norm;
				if (value_orig_different) {
					name_td.classList.add("value_modified");
					name_td.appendChild(revert_btn);
				} else {
					name_td.classList.remove("value_modified");

					if (revert_btn.parentElement === name_td)
						name_td.removeChild(revert_btn);
				}
			};

			var do_update_setting_real = function(setting, new_value, meta) {
				update_setting(setting, new_value);

				run_soon(function() {
					check_value_orig_different(new_value);
				});

				show_saved_message(meta);
			};

			var do_update_setting = function(setting, new_value, meta) {
				if (is_extension && meta.required_permission) {
					request_permission(meta.required_permission, function(granted) {
						if (granted) {
							do_update_setting_real(setting, new_value, meta);
						} else {
							do_options();
						}
					});
				} else {
					do_update_setting_real(setting, new_value, meta);
				}
			};

			name_td.appendChild(name);
			check_value_orig_different(value);
			tr.appendChild(name_td);

			var value_td = document_createElement("td");
			value_td.classList.add("value_td");

			var type = "options";
			var option_list = {};

			if (typeof orig_value === "boolean") {
				type = "options";
				option_list["true"] = {name: _("yes")};
				option_list["false"] = {name: _("no")};
				if (value)
					option_list["true"].checked = true;
				else
					option_list["false"].checked = true;
			} else if (meta.options) {
				if (meta.options._randomize) {
					var keys = Object.keys(meta.options);

					var new_options = {};
					// prepend options that do need to be properly sorted
					for (var option_name in meta.options) {
						if (option_name[0] == "_" || meta.options[option_name].is_null) {
							new_options[option_name] = meta.options[option_name];
						}
					}

					keys.sort(function() {
						return (Math_floor(Math_random() * 2) ? 1 : -1);
					});

					for (var i = 0; i < keys.length; i++) {
						if (keys[i] in new_options)
							continue;

						new_options[keys[i]] = meta.options[keys[i]];
					}

					meta.options = new_options;
				}

				if (meta.options._type === "combo") {
					type = "combo";
				} else {
					type = "options";
					option_list = deepcopy(meta.options);

					var check_optionlist = function (val, list) {
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

					if (is_array(value)) {
						value.forEach(function (val) {
							check_optionlist(val, option_list);
						});
					} else {
						check_optionlist(value, option_list);
					}
				}
			} else if (meta.type) {
				if (meta.type === "textarea" ||
					meta.type === "keysequence" ||
					meta.type === "number" ||
					meta.type === "lineedit")
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

					var input = document_createElement("input");
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
							do_update_setting(setting, new_value, meta);
						} else {
							do_update_setting(setting, value, meta);
						}

						//settings[setting] = new_value;
						check_disabled_options();
						show_warnings();
					});

					parent.appendChild(input);

					var label = document_createElement("label");
					label.setAttribute("for", id);

					label_texts[id] = _(val.name);
					label.innerText = label_texts[id];

					if (val.description) {
						label.title = _(val.description);
					}

					parent.appendChild(label);
				};

				for (var op in option_list) {
					if (option_list[op].extension_only && !is_extension)
						continue;

					if (op.match(/^_group/)) {
						var option_type1 = option_list[op]._type;
						if (!option_type1)
							option_type1 = "or";

						var sub = document_createElement("div");
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
				var sub = document_createElement("table");
				var sub_tr = document_createElement("tr");
				var sub_ta_td = document_createElement("td");
				sub_ta_td.style.verticalAlign = "middle";
				//sub_ta_td.style.height = "1px";
				var sub_button_tr = document_createElement("tr");
				var sub_button_td = document_createElement("td");
				sub_button_td.style.textAlign = "center";
				//sub_button_td.style.verticalAlign = "middle";
				//sub_button_td.style.height = "1px";
				var textarea = document_createElement("textarea");
				textarea.style.height = "5em";
				textarea.style.width = "20em";
				if (value)
					textarea.value = value;
				var savebutton = document_createElement("button");
				savebutton.innerText = _("save");
				savebutton.onclick = function() {
					do_update_setting(setting, textarea.value, meta);

					// Background CSS style unlocks Background fade
					check_disabled_options();
					//settings[setting] = textarea.value;
				};

				sub_ta_td.appendChild(textarea);
				sub_button_td.appendChild(savebutton);
				sub_button_tr.appendChild(sub_button_td);
				sub_tr.appendChild(sub_ta_td);
				sub.appendChild(sub_tr);
				sub.appendChild(sub_button_tr);

				value_td.appendChild(sub);
			} else if (type === "number" || type === "lineedit") {
				var sub = document_createElement("table");
				var sub_tr = document_createElement("tr");
				var sub_in_td = document_createElement("td");
				sub_in_td.style = "display:inline";
				var input = document_createElement("input");

				if (false && type === "number") {
					// doesn't work properly on Waterfox, most of the functionality is implemented here anyways
					// thanks to decembre on github for reporting: https://github.com/qsniyg/maxurl/issues/14#issuecomment-531080061
					input.type = "number";
				} else {
					input.type = "text";
				}

				input.setAttribute("spellcheck", false);

				if (type === "number") {
					input.style = "text-align:right";
					if (meta.number_max !== undefined)
						input.setAttribute("max", meta.number_max.toString());
					if (meta.number_min !== undefined)
						input.setAttribute("min", meta.number_min.toString());
					if (meta.number_int)
						input.setAttribute("step", "1");
				}

				if (value !== undefined)
					input.value = value;

				input.oninput = input.onblur = function(e) {
					var need_correct = false;
					var do_update = true;
					if (e.type === "blur") {
						need_correct = true;
						do_update = false;
					}

					var value = input.value.toString();

					if (type === "number") {
						value = parseFloat(value);
						var orig_value = value;

						if (isNaN(value)) {
							if (!need_correct)
								return;

							value = 0;
						}

						if (meta.number_int) {
							value = parseInt(value);
						}

						if (meta.number_max !== undefined)
							value = Math_min(value, meta.number_max);
						if (meta.number_min !== undefined)
							value = Math_max(value, meta.number_min);

						if (isNaN(value)) {
							console_error("Error: number is NaN after min/max");
							return;
						}

						if (meta.number_int || value !== orig_value)
							input.value = value;

						value = parseFloat(value);

						if (e.type === "blur" && value !== orig_value) {
							do_update = true;
						}
					}

					if (do_update)
						do_update_setting(setting, value, meta);
				}

				var sub_units_td = document_createElement("td");
				//sub_units_td.style = "display:inline";
				sub_units_td.classList.add("number_units");
				if (meta.number_unit)
					sub_units_td.innerText = _(meta.number_unit);

				sub_tr.appendChild(input);
				sub_tr.appendChild(sub_units_td);
				sub.appendChild(sub_tr);
				value_td.appendChild(sub);
			} else if (type === "keysequence") {
				var sub = document_createElement("table");

				var values = deepcopy(value);

				if (values.length > 0 && !is_array(values[0]))
					values = [values];

				var indices = [];
				for (var i = 0; i < values.length; i++) {
					indices.push(i);
				}

				var is_only_keyseq = function() {
					var active_indices = 0;
					for (var i = 0; i < indices.length; i++) {
						if (indices[i] >= 0)
							active_indices++;
					}

					return active_indices < 2;
				};

				var update_keyseq_setting = function() {
					var result = [];

					for (var i = 0; i < indices.length; i++) {
						if (indices[i] >= 0 && values[i].length > 0) {
							result.push(values[i]);
						}
					}

					do_update_setting(setting, result, meta);
				};

				var recalculate_removebtns = function() {
					var do_remove = !meta.keyseq_allow_none && is_only_keyseq();

					for (var i = 0; i < sub.children.length; i++) {
						var child = sub.children[i];

						var removebtns = child.getElementsByClassName("removebtn");
						if (removebtns.length > 0) {
							if (do_remove) {
								removebtns[0].style.display = "none";
							} else {
								removebtns[0].style.display = "initial";
							}
						}
					}
				};

				var add_keyseq_tr = function(index, start_recording) {
					var sub_tr = document_createElement("tr");
					sub_tr.classList.add("keyseq");

					var sub_key_td = document_createElement("td");
					//sub_key_td.style = "display:inline;font-family:monospace";
					sub_key_td.classList.add("record_keybinding");
					if (value) {
						sub_key_td.innerText = get_trigger_key_texts(values)[index];
					}

					var sub_record_td = document_createElement("td");
					sub_record_td.style = "display:inline";

					var sub_record_btn = document_createElement("button");
					sub_record_btn.innerText = _("record");

					var do_record = function() {
						if (recording_keys) {
							if (keysequence_valid(options_chord)) {
								values[index] = options_chord;
								update_keyseq_setting();
								//do_update_setting(setting, options_chord, meta);
								//settings[setting] = options_chord;

								do_cancel();
							}
						} else {
							options_chord = [];
							current_options_chord = [];
							recording_keys = function() {
								var our_chord = options_chord;
								if (our_chord.length === 0)
									our_chord = values[index];

								sub_key_td.innerText = get_trigger_key_texts(our_chord);

								if (keysequence_valid(options_chord)) {
									sub_record_btn.classList.remove("disabled");
								} else {
									sub_record_btn.classList.add("disabled");
								}
							};
							sub_record_btn.innerText = _("save");
							sub_cancel_btn.style = "display:inline-block";
						}
					};
					sub_record_btn.onmousedown = do_record;

					var sub_cancel_btn = document_createElement("button");
					sub_cancel_btn.innerText = _("cancel");
					sub_cancel_btn.style = "display:none";

					var do_cancel = function() {
						recording_keys = false;
						sub_record_btn.innerText = _("Record");
						sub_record_btn.classList.remove("disabled");
						sub_cancel_btn.style = "display:none";
						sub_key_td.innerText = get_trigger_key_texts(values)[index];
					};
					sub_cancel_btn.onmousedown = do_cancel;

					var sub_remove_btn = document_createElement("button");
					//sub_remove_btn.innerText = "—";
					sub_remove_btn.innerText = "\xD7";
					sub_remove_btn.title = _("Remove");
					sub_remove_btn.classList.add("removebtn");
					sub_remove_btn.classList.add("small");

					if (!meta.keyseq_allow_none && is_only_keyseq()) {
						sub_remove_btn.style = "display:none";
					}

					sub_remove_btn.onclick = function() {
						if (!meta.keyseq_allow_none && is_only_keyseq())
							return;

						recording_keys = false;

						indices[index] = -1;
						for (var i = index + 1; i < indices.length; i++) {
							indices[i]--;
						}

						sub_tr.parentElement.removeChild(sub_tr);
						recalculate_removebtns();

						update_keyseq_setting();
					};

					sub_tr.appendChild(sub_key_td);
					sub_record_td.appendChild(sub_record_btn);
					sub_record_td.appendChild(sub_cancel_btn);
					sub_record_td.appendChild(sub_remove_btn);
					sub_tr.appendChild(sub_record_td);

					if (start_recording)
						do_record();

					return sub_tr;
				};

				for (var i = 0; i < indices.length; i++) {
					sub.appendChild(add_keyseq_tr(i));
				}

				var sub_add_tr = document_createElement("tr");
				var sub_add_td = document_createElement("td");
				var sub_add_btn = document_createElement("button");
				sub_add_btn.innerText = "+";
				sub_add_btn.title = _("Add keybinding");
				sub_add_btn.classList.add("small");
				sub_add_btn.onclick = function() {
					var last_index = -1;

					for (var i = indices.length - 1; i >= 0; i--) {
						if (indices[i] >= 0) {
							last_index = indices[i];
							break;
						}
					}

					indices.push(last_index + 1);
					values.push([]);

					sub.insertBefore(add_keyseq_tr(indices.length - 1, true), sub_add_tr);
					recalculate_removebtns();
				};
				sub_add_td.appendChild(sub_add_btn);
				sub_add_tr.appendChild(sub_add_td);

				sub.appendChild(sub_add_tr);
				value_td.appendChild(sub);
			} else if (type === "combo") {
				var sub = document_createElement("select");

				var null_option = null;
				for (var coption in meta.options) {
					if (!coption || coption[0] === '_')
						continue;

					var optionel = document_createElement("option");
					optionel.innerText = _(meta.options[coption].name);
					optionel.value = coption;

					if (meta.options[coption].is_null)
						null_option = coption;

					sub.appendChild(optionel);
				}

				var sub_value = settings[setting];
				if (sub_value === null && null_option) {
					sub_value = null_option;
				}
				sub.value = sub_value;

				sub.onchange = function() {
					var value = sub.value;
					if (value in meta.options && meta.options[value].is_null) {
						value = null;
					}

					do_update_setting(setting, value, meta);

					check_disabled_options();
					show_warnings();
				};

				value_td.appendChild(sub);
			}

			tr.appendChild(value_td);

			option.appendChild(table);

			if (settings.settings_visible_description) {
				var description_el = document_createElement("p");
				md_to_html(description_el, description);
				//description_el.innerText = description;
				description_el.classList.add("description");

				option.appendChild(description_el);
			}

			if (meta.warning) {
				var warning = document_createElement("p");
				warning.style.display = "none";
				warning.classList.add("warning");

				option.appendChild(warning);
			}

			var requirements = document_createElement("div");
			//requirements.style.display = "none";
			requirements.classList.add("requirements");
			requirements.classList.add("hidden");
			option.appendChild(requirements);

			if (meta.example_websites) {
				var examples = document_createElement("ul");
				examples.classList.add("examples");
				for (var example_i = 0; example_i < meta.example_websites.length; example_i++) {
					var example_text = meta.example_websites[example_i];
					var example_el = document_createElement("li");
					example_el.innerText = _(example_text);
					examples.appendChild(example_el);
				}

				option.appendChild(examples);
			}

			if (meta.documentation) {
				var get_title = function(expanded) {
					// ⯈
					var arrow = "%E2%AF%88";
					if (expanded) {
						// ⯆
						arrow = "%E2%AF%86";
					}

					return decodeURIComponent(arrow) + " " + _(meta.documentation.title);
				};

				var text = get_title(false);

				var spoiler_title = document_createElement("span");
				spoiler_title.classList.add("spoiler-title");
				spoiler_title.innerText = text;

				var expanded = false;
				spoiler_title.onclick = function() {
					expanded = !expanded;

					if (expanded) {
						spoiler_contents.style.display = "block";
					} else {
						spoiler_contents.style.display = "none";
					}

					spoiler_title.innerText = get_title(expanded);
				};

				var spoiler_contents = document_createElement("div");
				spoiler_contents.classList.add("spoiler-contents");
				spoiler_contents.style.display = "none";
				spoiler_contents.innerHTML = meta.documentation.value;

				option.appendChild(spoiler_title);
				option.appendChild(spoiler_contents);
			}

			var errordiv = document_createElement("div");
			errordiv.classList.add("error");
			option.appendChild(errordiv);

			if (meta.category) {
				var subcat = meta.category;
				if (meta.subcategory)
					subcat = meta.subcategory;

				subcategory_els[subcat].appendChild(option);
			} else {
				options_el.appendChild(option);
			}
		};

		var settingslist = Object.keys(settings);
		if (settings.settings_alphabetical_order) {
			settingslist.sort(function(a, b) {
				var a_meta = settings_meta[a];
				var b_meta = settings_meta[b];

				if (!a_meta || !b_meta || !a_meta.name || !b_meta.name) {
					return a.localeCompare(b);
				}

				return _(a_meta.name).localeCompare(_(b_meta.name));
			});
		}

		for (var i = 0; i < settingslist.length; i++) {
			add_setting_dom(settingslist[i]);
		}

		check_disabled_options();
		show_warnings();

		for (var category in category_els) {
			var our_els = category_els[category]

			if (!(category in category_settings)) {
				for (var i = 0; i < our_els.length; i++) {
					our_els[i].parentNode.removeChild(our_els[i])
				}
			}
		}

		for (var subcategory in subcategory_els) {
			var our_el = subcategory_els[subcategory];

			if (our_el.querySelectorAll(".option").length === 0) {
				our_el.parentNode.removeChild(our_el);
			}
		}

		document.body.appendChild(saved_el);
	}

	function get_single_setting_raw(value) {
		if (is_array(value))
			return value[0];
		return value;
	}

	function get_single_setting(setting) {
		return get_single_setting_raw(settings[setting]);
	}

	function parse_value(value) {
		try {
			// undefined, "true" and "false" are the most common ones, let's avoid calling JSON_parse unless necessary
			// this improves performance
			if (value === undefined) {
				return value;
			} else if (value === "true") {
				return true;
			} else if (value === "false") {
				return false;
			}

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
			extension_send_message({
				type: "getvalue",
				data: [key]
			}, function(response) {
				response = response.data;
				cb(parse_value(response[key]));
			});
		} else if (typeof GM_getValue !== "undefined" &&
				   // Unfortunately FireMonkey currently implements GM_getValue as a mapping to GM.getValue for some reason
				   //   https://github.com/erosman/support/issues/98
				   // Until this is fixed, we cannot use GM_getValue for FireMonkey
				   userscript_manager !== "FireMonkey") {
			return cb(parse_value(GM_getValue(key, undefined)));
		} else if (typeof GM !== "undefined" && GM.getValue) {
			GM.getValue(key, undefined).then(function (value) {
				cb(parse_value(value));
			});
		}
	}

	var updating_options = 0;
	function set_value(key, value, cb) {
		if (key in settings_meta && settings_meta[key].onedit) {
			settings_meta[key].onedit(value);
		}

		value = serialize_value(value);
		//console_log("Setting " + key + " = " + value);

		if (is_extension) {
			var kv = {};
			kv[key] = value;
			//chrome.storage.sync.set(kv, function() {});
			updating_options++;
			extension_send_message({
				type: "setvalue",
				data: kv
			}, function() {
				updating_options--;

				cb && cb();
			});
		} else if (typeof GM_setValue !== "undefined") {
			GM_setValue(key, value);

			cb && cb();
		} else if (typeof GM !== "undefined" && GM.getValue) {
			GM.setValue(key, value).then(function() {
				cb && cb();
			});
		}
	}

	function update_setting(key, value) {
		if (value === settings[key])
			return false;

		value = deepcopy(value);
		settings[key] = value;

		if (is_extension) {
			if (!(key in settings_history))
				settings_history[key] = [];

			settings_history[key].push(value);
		}

		set_value(key, value);
		return true;
	}

	function set_default_value(key, value) {
		if (!(key in user_defined_settings)) {
			settings[key] = value;
		}
	}

	function settings_updated_cb(changes) {
		if (!settings.allow_live_settings_reload)
			return;

		//console_log(message);
		var changed = false;

		for (var key in changes) {
			if (changes[key].newValue === undefined)
				continue;

			//console_log("Setting " + key + " = " + changes[key].newValue);
			var newvalue = JSON_parse(changes[key].newValue);
			if (key in settings_history) {
				var index = array_indexof(settings_history[key], newvalue);

				var pass = false
				if (index >= 0 && index < settings_history[key].length - 1) {
					pass = true;
				}

				settings_history[key].splice(index, 1);

				if (pass)
					continue;
			}

			var setting_updated = update_setting_from_host(key, newvalue);
			changed = setting_updated || changed;

			if (setting_updated && key in settings_meta && "onupdate" in settings_meta[key]) {
				settings_meta[key].onupdate();
			}
		}

		if (changed && updating_options <= 0 && is_options_page) {
			//console_log("Refreshing options");
			do_options();
		}
	};

	function upgrade_settings_with_version(version, new_settings, cb) {
		if (!version) {
			version = 0;
		} else if (typeof version !== "number") {
			version = parseInt(version);
			if (isNaN(version))
				version = 0;
		}

		if (new_settings === undefined)
			new_settings = settings;

		var changed = false;

		if (version === 0) {
			if (new_settings.mouseover_trigger) {
				var trigger_keys = [];
				for (var i = 0; i < new_settings.mouseover_trigger.length; i++) {
					var trigger = new_settings.mouseover_trigger[i];
					if (trigger.match(/^delay_[0-9]+/)) {
						var delay = parseInt(new_settings.mouseover_trigger[i].replace(/^delay_([0-9]+).*?$/, "$1"));
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
			changed = true;

			version = 1;
		}

		if (version === 1) {
			var partial_setting = "none";
			var partial_setting_set = new_settings.mouseover_use_fully_loaded_video !== undefined ||
									  new_settings.mouseover_use_fully_loaded_image !== undefined;

			if (partial_setting_set) {
				if (new_settings.mouseover_use_fully_loaded_video === false ||
					new_settings.mouseover_use_fully_loaded_video === undefined) {
					partial_setting = "video";
				}

				if (new_settings.mouseover_use_fully_loaded_image === undefined) {
					if (!orig_settings.mouseover_use_fully_loaded_image) {
						partial_setting = "media";
					}
				} else if (new_settings.mouseover_use_fully_loaded_image === false) {
					partial_setting = "media";
				}

				update_setting("mouseover_allow_partial", partial_setting);
			}

			update_setting("settings_version", 2);
			changed = true;

			version = 2;
		}

		if (version === 2) {
			if ("mouseover_close_on_leave_el" in new_settings) {
				var policy;

				if (new_settings.mouseover_close_on_leave_el) {
					policy = "both";
				} else {
					policy = "popup";
				}

				update_setting("mouseover_close_el_policy", policy);
			}

			update_setting("settings_version", 3);
			changed = true;

			version = 3;
		}

		if (version === 3) {
			if ("mouseover_scroll_behavior" in new_settings) {
				if (get_single_setting_raw(new_settings.mouseover_scroll_behavior) !== "zoom") {
					update_setting("mouseover_scrollx_behavior", new_settings.mouseover_scroll_behavior);
				}

				update_setting("mouseover_scrolly_behavior", new_settings.mouseover_scroll_behavior);
			}

			update_setting("settings_version", 4);
			changed = true;

			version = 4;
		}

		if (version === 4) {
			if ("mouseover_mask_styles" in new_settings && new_settings.mouseover_mask_styles) {
				update_setting("mouseover_mask_styles2", new_settings.mouseover_mask_styles);
				update_setting("mouseover_enable_mask_styles", true);
			}

			update_setting("settings_version", 5);
			changed = true;

			version = 5;
		}

		if (version === 5) {
			if ("mouseover_video_seek_vertical_scroll" in new_settings && new_settings.mouseover_video_seek_vertical_scroll) {
				update_setting("mouseover_scrolly_video_behavior", "seek");
			}

			if ("mouseover_video_seek_horizontal_scroll" in new_settings && new_settings.mouseover_video_seek_horizontal_scroll) {
				update_setting("mouseover_scrollx_video_behavior", "seek");
			}

			update_setting("settings_version", 6);
			changed = true;

			version = 6;
		}

		cb(changed);
	}

	function upgrade_settings(cb) {
		try {
			create_blacklist_regexes();
		} catch(e) {
			console_error(e);
		}

		if (!settings.last_update_check) {
			update_setting("last_update_check", Date.now());
		}

		check_updates_if_needed();

		// TODO: merge this get_value in do_config for performance
		get_value("settings_version", function(version) {
			upgrade_settings_with_version(version, settings, cb);
		});
	}

	function update_setting_from_host(setting, value) {
		if (value !== undefined) {
			if (typeof settings[setting] === "number") {
				value = parseFloat(value);
			}

			user_defined_settings[setting] = value;

			if (value !== settings[setting]) {
				settings[setting] = value;
				return true;
			}
		}

		return false;
	}

	function do_config() {
		if (_nir_debug_) {
			console_log("do_config");
		}

		if (is_userscript || is_extension) {
			var settings_done = 0;
			var total_settings = Object.keys(settings).length + old_settings_keys.length;

			var add_value_change_listeners = function(cb) {
				if (typeof GM_addValueChangeListener === "undefined") {
					return cb();
				}

				// run in timeout to prevent this from further delaying initial page load times
				// takes ~2-3ms. not huge, but still significant
				setTimeout(function() {
					for (var setting in settings) {
						GM_addValueChangeListener(setting, function(name, oldValue, newValue, remote) {
							if (remote === false)
								return;

							var updated = {};
							updated[name] = {newValue: newValue};
							settings_updated_cb(updated);
						});
					}
				}, 1);

				cb();
			};

			var process_setting = function(setting) {
				get_value(setting, function(value) {
					settings_done++;
					update_setting_from_host(setting, value);

					if (settings_done >= total_settings)
						upgrade_settings(function(value) {
							add_value_change_listeners(function() {
								start(value);
							});
						});
				});
			};

			for (var setting in settings) {
				process_setting(setting);
			}

			for (var i = 0; i < old_settings_keys.length; i++) {
				process_setting(old_settings_keys[i]);
			}
		} else {
			start();
		}
	}

	var can_use_subzindex = true;

	try {
		// uBlock Origin: div > div[style*="z-index:"]
		if (/^[a-z]+:\/\/[^/]*txxx\.com\//.test(window.location.href)) {
			can_use_subzindex = false;
		}
	} catch (e) {}

	function set_el_all_initial(el) {
		if (can_use_subzindex) {
			el.style.all = "initial";
		} // removing zIndex doesn't work if all = "initial";

		// Under Waterfox, if offsetInlineStart is set to anything (even unset), it'll set the left to 0
		// Thanks to decembre on github for reporting this: https://github.com/qsniyg/maxurl/issues/14#issuecomment-531080061
		el.style.removeProperty("offset-inline-start");
	}

	function check_bad_if(badif, resp) {
		if (_nir_debug_)
			console_log("check_bad_if", badif, resp);

		if (!badif || !is_array(badif) || badif.length === 0) {
			if (_nir_debug_)
				console_log("check_bad_if (!badif)");
			return false;
		}

		var headers = parse_headers(resp.responseHeaders);

		var check_single_badif = function(badif) {
			if (badif.headers) {
				for (var header in badif.headers) {
					var header_lower = header.toLowerCase();

					var found = false;
					for (var i = 0; i < headers.length; i++) {
						if (headers[i].name.toLowerCase() === header_lower) {
							if (typeof (badif.headers[header]) === "function") {
								found = badif.headers[header](headers[i].value);
							} else if (typeof (badif.headers[header]) === "string") {
								found = headers[i].value === badif.headers[header];
							}

							if (found) {
								break;
							} else {
								return false;
							}
						}
					}

					if (!found)
						return false;
				}
			}

			return true;
		};

		for (var j = 0; j < badif.length; j++) {
			if (check_single_badif(badif[j]))
				return true;
		}

		return false;
	}
	bigimage_recursive.check_bad_if = check_bad_if;

	function is_probably_video(obj) {
		if (obj.video)
			return true;

		if (/\.(?:mp4|webm|mkv|mpg|ogv|wmv)/i.test(obj.url))
			return true;

		return false;
	}

	function is_video_contenttype(contenttype) {
		if (/^\s*\[?video\//.test(contenttype))
			return true;

		// https://upload.wikimedia.org/wikipedia/commons/7/74/Leucochloridium.ogv
		if (/^application\/og[gv]$/.test(contenttype))
			return true;

		return false;
	}

	var is_video_type_supported = function(videotype) {
		if (videotype === true)
			return true;

		if (typeof videotype === "string")
			videotype = {type: videotype};

		if (videotype.type === "direct") {
			return true;
		}

		if (videotype.need_custom_xhr) {
			if (!settings.custom_xhr_for_lib)
				return false;
		}

		if (videotype.type === "dash") {
			return settings.allow_thirdparty_libs && settings.allow_dash_video;
		}

		if (videotype.type === "hls") {
			return settings.allow_thirdparty_libs && settings.allow_hls_video;
		}

		return false;
	};

	function get_event_error(e) {
		// https://stackoverflow.com/a/46064096
		var error = e;

		if (e.path && e.path[0]) {
			error = e.path[0].error;
		}

		if (e.originalTarget) {
			error = e.originalTarget.error;
		}

		return error;
	}

	var trigger_gallery;

	function serialize_img(img) {
		var obj = {
			tag: img.tagName.toLowerCase(),
			src: img.src,
			autoplay: img.getAttribute("autoplay"),
			controls: img.getAttribute("controls"),
			loop: img.getAttribute("loop"),
			muted: img.muted,
			volume: img.volume
		};

		return obj;
	}

	function deserialize_img(obj, cb) {
		var el = document_createElement(obj.tag);
		if (obj.tag === "video") {
			if (obj.autoplay)
				video.setAttribute("autoplay", obj.autoplay);
			if (obj.controls)
				video.setAttribute("controls", obj.controls);
			if (obj.loop)
				video.setAttribute("loop", obj.loop)
			if (obj.muted)
				video.muted = obj.muted;
			if (obj.volume !== undefined)
				video.volume = obj.volume;

			video.onloadedmetadata = function() {
				cb(el);
			};
		}

		el.src = obj.src;

		if (obj.tag !== "video") {
			cb(el);
		}
	}

	var get_window_url = function() {
		return native_URL;// || window.URL || window.webkitURL;
	};

	var create_dataurl = function(blob, cb) {
		var a = new FileReader();
		a.onload = function(e) {
			try {
				cb(e.target.result);
			} catch (e) {
				console_error(e);
				console_error(e.stack);
				cb(null);
			}
		};
		a.readAsDataURL(blob);
	};

	var create_objecturl = function(blob) {
		return get_window_url().createObjectURL(blob);
	};

	var revoke_objecturl = function(objecturl) {
		if (is_element(objecturl))
			objecturl = objecturl.src;

		return get_window_url().revokeObjectURL(objecturl);
	};

	var is_video_el = function(el) {
		if (el.tagName === "VIDEO")
			return true;

		if (el.tagName !== "SOURCE")
			return false;

		if (el.parentElement && el.parentElement.tagName === "VIDEO")
			return true;
		return false;
	};

	var destroy_image = function(image) {
		if (_nir_debug_)
			console_log("destroy_image", image);

		// TODO: maybe check to make sure it's a blob? according to the spec, this will silently fail, but browsers may print an error
		revoke_objecturl(image.src);
		image.setAttribute("imu-destroyed", "true");
	};

	// TODO: maybe move to a generic reference class, like Cache?
	var check_image_refs = new_map();
	var check_image_ref = function(image) {
		if (map_has(check_image_refs, image)) {
			var refs = map_get(check_image_refs, image);
			refs++;
			map_set(check_image_refs, image, refs);
		} else {
			map_set(check_image_refs, image, 1);
		}
	};

	var check_image_unref = function(image) {
		if (!map_has(check_image_refs, image))
			return;

		var refs = map_get(check_image_refs, image);
		refs--;

		if (refs <= 0) {
			destroy_image(image);
			map_remove(check_image_refs, image);
		} else {
			map_set(check_image_refs, image, refs);
		}
	};

	var check_image_cache = null;
	function check_image_get(obj, cb, processing) {
		nir_debug("check_image_get", "check_image_get", deepcopy(obj), cb, deepcopy(processing));

		if (!obj || !obj[0] || !obj[0].url) {
			return cb(null);
		}

		if (!processing.running) {
			return cb(null);
		}

		if (processing.set_cache || processing.use_cache) {
			if (!check_image_cache) {
				var maximum_items = settings.popup_cache_itemlimit;
				if (maximum_items <= 0)
					maximum_items = null;

				check_image_cache = new Cache({
					max_keys: maximum_items,
					destructor: function(key, value) {
						if (value && value.img)
							check_image_unref(value.img);
					}
				});
			}
		}

		if (processing.use_cache) {
			if (check_image_cache.has(obj[0].url)) {
				var cached_result = check_image_cache.get(obj[0].url);

				nir_debug("check_image_get", "check_image_get(cached):", cached_result.img, cached_result.resp, obj[0]);

				var img = cached_result.img;
				var destroyed = false;
				if (img) {
					if (img.tagName === "VIDEO" && !settings.popup_cache_resume_video) {
						img.currentTime = cached_result.currentTime || 0;
					}

					if (img.hasAttribute("imu-destroyed"))
						destroyed = true;
				}

				if (!destroyed) {
					cb(cached_result.img, cached_result.resp.finalUrl, obj[0], cached_result.resp);
					return;
				}
			}
		}

		var method = "GET";
		var responseType = "blob";
		var last_objecturl = null;

		var obj_is_probably_video = is_probably_video(obj[0]);
		var incomplete_request = false;
		if (processing.incomplete_image || (obj_is_probably_video && processing.incomplete_video))
			incomplete_request = true;

		if (obj[0].need_blob || obj[0].need_data_url)
			incomplete_request = false;

		if (processing.head || incomplete_request) {
			if (incomplete_request && !obj[0].can_head) {
				method = "GET";
			} else {
				method = "HEAD";
			}

			responseType = undefined;
		}

		// this is for dash videos, but FIXME for normal videos
		if (obj[0].url.match(/^data:/) && !obj[0].video) {
			var img = document_createElement("img");
			img.src = obj[0].url;
			img.onload = function() {
				cb(img, obj[0].url, obj[0]);
			};
			img.onerror = function(e) {
				console_log("Error loading image", e);
				err_cb();
			};
			return;
		}

		function err_cb() {
			revoke_objecturl(last_objecturl);
			obj.shift();

			nir_debug("check_image_get", "check_image_get(err_cb):", obj, processing);

			return check_image_get(obj, cb, processing);
		}

		var url = obj[0].url;

		console_log("Trying " + url);

		if (obj[0] && obj[0].video) {
			if (!settings.allow_video) {
				console_log("Video, skipping due to user setting");
				return err_cb();
			}

			if (!is_video_type_supported(obj[0].video)) {
				console_warn("Video type", obj[0].video, "is not supported");
				return err_cb();
			}
		}

		if (obj[0] && obj[0].bad) {
			console_log("Bad image");
			return err_cb();
		}

		if (obj[0] && obj[0].is_pagelink) {
			console_log("Page link");
			return err_cb();
		}

		if (obj[0] && is_invalid_url(obj[0].url)) {
			console_log("Invalid URL");
			return err_cb();
		}

		var url_domain = url.replace(/^([a-z]+:\/\/[^/]*).*?$/, "$1");

		var headers = obj[0].headers;

		if (!headers || Object.keys(headers).length === 0) {
			headers = {
				//"Origin": url_domain,
				"Referer": window.location.href
			};
		} else if (!headers.Origin && !headers.origin) {
			//headers.Origin = url_domain;
		}

		var handled = false;
		var onload_cb = function(resp) {
			if (handled) {
				return;
			}

			handled = true;

			if (!processing.running) {
				return cb(null);
			}

			if (resp.readyState == 4 || true) {
				nir_debug("check_image_get", "check_image_get(onload)", deepcopy(resp), resp.readyState);

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

				if (check_bad_if(obj[0].bad_if, resp)) {
					console_log("Bad image (bad_if)", resp, obj[0].bad_if);
					return err_cb();
				}

				if (processing.head) {
					cb(resp, obj[0]);
					return;
				}

				var parsed_headers = headers_list_to_dict(parse_headers(resp.responseHeaders));
				var is_video = false;
				var video_type = {type: "direct"};

				// TODO: improve
				if (obj[0].video || parsed_headers["content-type"] && is_video_contenttype(parsed_headers["content-type"])) {
					is_video = true;

					if (obj[0].video && obj[0].video !== true) {
						video_type = obj[0].video;
						if (typeof video_type === "string")
							video_type = {type: video_type};
					}

					if (!is_video_type_supported(video_type)) {
						console_warn("Video type", video_type, "is not supported");
						return err_cb();
					}
				}

				if (is_video && !settings.allow_video) {
					console_log("Video, skipping due to user setting");
					return err_cb();
				}

				if (settings.mouseover_matching_media_types && processing && processing.source && processing.source.el) {
					if (is_video_el(processing.source.el)) {
						if (!is_video) {
							console_log("!video, source was video, skipping");
							return err_cb();
						}
					} else {
						if (is_video) {
							console_log("video, source was image, skipping");
							return err_cb();
						}
					}
				}

				var good_cb = function(img) {
					nir_debug("check_image_get", "check_image_get(good_cb):", img, resp.finalUrl, obj[0], resp);

					if (processing.set_cache) {
						var cache_obj = {
							img: img,
							resp: resp
						};

						if (img.tagName === "VIDEO")
							cache_obj.currentTime = img.currentTime;

						check_image_cache.set(obj[0].url, cache_obj, (parseFloat(settings.popup_cache_duration) || 0) * 60);
					}

					if (img)
						check_image_ref(img);

					cb(img, resp.finalUrl, obj[0], resp);
				};

				if (parsed_headers["content-length"] && parseInt(parsed_headers["content-length"]) > 100) {
					obj[0].filesize = parseInt(parsed_headers["content-length"]);
				}

				var create_video_el = function() {
					var video = document_createElement("video");

					video.setAttribute("autoplay", "autoplay");

					if (settings.mouseover_video_controls)
						video.setAttribute("controls", "controls");

					if (settings.mouseover_video_loop && !settings.mouseover_gallery_move_after_video)
						video.setAttribute("loop", true);

					if (settings.mouseover_video_muted) {
						video.muted = true;
					} else {
						// TODO: always set the volume, so that when the video is unmuted, it'll be at the wanted volume
						var volume = parseInt(settings.mouseover_video_volume);
						volume = Math_max(Math_min(volume, 100), 0);
						video.volume = volume / 100.;
					}

					var remove_loaded_metadata_listener = function() {
						video.onloadedmetadata = null;
						video.removeEventListener("loadedmetadata", loaded_metadata_listener);
					};

					var errorhandler = function(e) {
						console_error("Error loading video", get_event_error(e));

						remove_loaded_metadata_listener();
						err_cb();
					};

					var ran_loadedmetadata_listener = false;
					var loaded_metadata_listener = function() {
						if (!ran_loadedmetadata_listener) {
							ran_loadedmetadata_listener = true;
						} else {
							return;
						}

						video.removeEventListener("error", errorhandler, true);
						remove_loaded_metadata_listener();

						if (video.hasAttribute("loop")) {
							if (settings.mouseover_video_autoloop_max && settings.mouseover_video_autoloop_max < video.duration)
								video.removeAttribute("loop");
						}

						var source_video = null;

						if (processing.source && processing.source.el) {
							var sourceel = processing.source.el;
							if (sourceel.tagName === "SOURCE") {
								sourceel = sourceel.parentElement;
							}

							if (sourceel.tagName === "VIDEO") {
								source_video = sourceel;
							}
						}

						if (settings.mouseover_video_resume_from_source && source_video && source_video.currentTime) {
							// https://github.com/qsniyg/maxurl/issues/256
							if (settings.mouseover_video_resume_if_different ||
								Math_abs(source_video.duration - video.duration) < 1 || Math_abs(1 - (source_video.duration / video.duration)) < 0.01) {
								video.currentTime = source_video.currentTime;
							}
						}

						if (settings.mouseover_video_pause_source && source_video) {
							source_video.pause();
						}

						run_soon(function() {
							good_cb(video)
						});
					};

					video.onloadedmetadata = loaded_metadata_listener;
					video.addEventListener("loadedmetadata", loaded_metadata_listener);

					video.onended = function() {
						if (settings.mouseover_enable_gallery && settings.mouseover_gallery_move_after_video) {
							trigger_gallery(1);
						}
					};

					video.addEventListener("error", errorhandler, true);

					return video;
				};

				var set_video_src = function(video, src) {
					var add_xhr_hook = function(lib) {
						if (lib.overridden_xhr) {
							lib.xhr.do_request = function(data) {
								if (!data.headers) data.headers = {};

								if (obj[0].headers) {
									for (var header in obj[0].headers) {
										headerobj_set(data.headers, header, obj[0].headers[header]);
									}
								}

								//console_log(data);
								return do_request(data);
							};
						}
					};

					if (video_type.type === "direct") {
						video.src = src;
					} else {
						var max_video_quality = get_single_setting("max_video_quality");
						if (max_video_quality) {
							max_video_quality = parseInt(max_video_quality.substr(1));
						}

						var get_wanted_variant = function(variants) {
							var wanted_variant = -1;
							array_foreach(variants, function(variant, i) {
								if (variant.height === max_video_quality) {
									wanted_variant = i;
									return false;
								}

								if (variant.height > max_video_quality) {
									if (i === 0) {
										wanted_variant = i;
									} else {
										wanted_variant = i - 1;
									}

									return false;
								}
							});

							return wanted_variant;
						};

						if (video_type.type === "dash") {
							// don't use shaka for hls yet, as mux.js is needed
							get_library("shaka", settings, do_request, function(_shaka) {
								if (!_shaka) {
									video.src = src;
									return;
								}

								var shaka = _shaka.lib;

								if (true) {
									shaka.log.setLevel(shaka.log.Level.ERROR);
								} else {
									shaka.log.setLevel(shaka.log.Level.DEBUG);
								}

								//shaka.polyfill.installAll();
								if (!shaka.Player.isBrowserSupported()) {
									console_warn("Unsupported browser for Shaka");
									video.src = src;
									return;
								}

								add_xhr_hook(_shaka);

								var player = new shaka.Player(video);

								var shaka_error_handler = function(e) {
									console_error(e);

									video.src = src;
									return;
								};

								player.addEventListener("error", shaka_error_handler);

								player.load(src).then(function() {
									var variants = player.getVariantTracks();

									if (settings.hls_dash_use_max) {
										variants.sort(function(a, b) {
											return b.bandwidth - a.bandwidth;
										});
										//console_log(variants);

										player.configure("abr.enabled", false);
										player.selectVariantTrack(variants[0], true, 0);
									}

									if (max_video_quality) {
										variants.sort(function(a, b) {
											var diff = a.height - b.height;
											if (diff) return diff;

											return a.bandwidth - b.bandwidth;
										});

										var wanted_variant = get_wanted_variant(variants);

										if (wanted_variant >= 0) {
											player.configure("abr.enabled", false);
											player.selectVariantTrack(variants[wanted_variant], true, 0);
										}
									}
								}, shaka_error_handler);
							});
						}
						else if (false && video_type.type === "dash") {
							get_library("dash", settings, do_request, function(_dashjs) {
								if (!_dashjs) {
									video.src = src;
									return;
								}

								var dashjs = _dashjs.lib;

								add_xhr_hook(_dashjs);

								var player = dashjs.MediaPlayer().create();

								if (settings.hls_dash_use_max) {
									player.updateSettings({
										streaming: {
											abr: {
												initialBitrate: {
													audio: Number.MAX_SAFE_INTEGER,
													video: Number.MAX_SAFE_INTEGER
												},
												autoSwitchBitrate: {
													audio: false,
													video: false
												}
											}
										}
									});
								}

								player.initialize(video, src, true);
							});
						} else if (video_type.type === "hls") {
							get_library("hls", settings, do_request, function(_hls_wrap) {
								if (!_hls_wrap) {
									video.src = src;
									return;
								}

								var hls_wrap = _hls_wrap.lib;
								if (!hls_wrap || !hls_wrap.Hls || !hls_wrap.Hls.isSupported()) {
									console_warn("HLS isn't supported");
									// this will work if (video.canPlayType('application/vnd.apple.mpegurl'))
									// if not, it will fail, then go to the next URL
									video.src = src;
									return;
								}

								add_xhr_hook(_hls_wrap);

								var Hls = hls_wrap.Hls;
								var hls = new Hls();

								hls.loadSource(src);
								hls.attachMedia(video);
								hls.on(Hls.Events.MANIFEST_PARSED, function() {
									if (settings.hls_dash_use_max) {
										//console_log(hls.levels);
										var maxlevel = -1;
										var maxbitrate = -1;
										for (var i = 0; i < hls.levels.length; i++) {
											if (hls.levels[i].bitrate > maxbitrate) {
												maxlevel = i;
												maxbitrate = hls.levels[i].bitrate;
											}
										}

										if (maxlevel >= 0)
											hls.nextLevel = maxlevel;
									}

									if (max_video_quality) {
										var levels = deepcopy(hls.levels);
										levels.sort(function(a, b) {
											var diff = a.height - b.height;
											if (diff) return diff;

											return a.bitrate - b.bitrate;
										});

										var level = get_wanted_variant(levels);
										if (level >= 0)
											hls.nextLevel = level;
									}

									hls.startLoad(-1);
									video.play();
								});

								hls.on(Hls.Events.ERROR, function(e) {
									console_error("Error loading HLS", e, e.toString());
									err_cb();
								});
							});
						}
					}
				};

				if (incomplete_request) {
					var load_image;

					if (!is_video) {
						load_image = function () {
							var img = document_createElement("img");
							img.src = resp.finalUrl;

							var end_cbs = function () {
								clearInterval(height_interval);
								img.onload = null;
								img.onerror = null;
							};

							img.onload = function () {
								end_cbs();

								if (img.naturalWidth === 0 || img.naturalHeight === 0) {
									if (_nir_debug_)
										console_log("naturalWidth or naturalHeight == 0", img);

									return err_cb();
								}

								good_cb(img);
							};

							img.onerror = function (e) {
								if (_nir_debug_)
									console_log("Error loading image", img, e);

								end_cbs();
								err_cb();
							};

							var height_interval = setInterval(function () {
								if (img.naturalWidth !== 0 && img.naturalHeight !== 0) {
									end_cbs();
									good_cb(img);
								}
							}, 15);
						};
					} else {
						load_image = function () {
							var video = create_video_el();
							set_video_src(video, resp.finalUrl);
						};
					}

					if (is_extension) {
						extension_send_message({
							type: "override_next_headers",
							data: {
								url: resp.finalUrl,
								method: "GET",
								headers: headers
							}
						}, function() {
							load_image();
						});
					} else {
						load_image();
					}

					return;
				}

				if (!resp.response) {
					err_cb();
					return;
				}

				var loadcb = function(urldata) {
					if (_nir_debug_) {
						console_log("check_image_get's loadcb", urldata, is_video);
					}

					last_objecturl = urldata;

					if (!urldata) {
						return err_cb();
					}

					if (!is_video) {
						var img = document_createElement("img");
						img.src = urldata;
						img.onload = function() {
							// Firefox thinks SVGs have an empty naturalWidth/naturalHeight
							if (img.naturalWidth === 0 || img.naturalHeight === 0) {
								return err_cb();
							}

							good_cb(img);
						};
						img.onerror = function(e) {
							if (_nir_debug_)
								console_log("Error loading image", img, e);

							err_cb();
						};
					} else {
						var video = create_video_el();
						set_video_src(video, urldata);
					}
				};

				if (obj[0].need_data_url || (!settings.mouseover_use_blob_over_data && !obj[0].need_blob)) {
					create_dataurl(resp.response, loadcb);
				} else {
					var objecturl = create_objecturl(resp.response);
					loadcb(objecturl);
				}
			}
		};

		var req = null;

		if (settings.mouseover_partial_avoid_head && incomplete_request && (!obj[0].bad_if || obj[0].bad_if.length === 0)) {
			onload_cb({
				status: 200,
				responseHeaders: "Content-Type: " + (obj_is_probably_video ? "video/mp4" : "image/jpeg"),
				readyState: 3,
				finalUrl: obj[0].url
			});

			return;
		}

		req = do_request({
			method: method,
			url: url,
			responseType: responseType,
			headers: headers,
			trackingprotection_failsafe: true,
			need_blob_response: method == "GET",
			retry_503: true,
			onprogress: function(resp) {
				var do_abort = function() {
					if (!req || !req.abort) {
						console_warn("Unable to abort request");
						return;
					}

					req.abort();
				};

				if (!processing.running) {
					do_abort();
				}

				if (incomplete_request && resp.readyState >= 2 && resp.responseHeaders) {
					do_abort();
					onload_cb(resp);
				}
			},
			onload: onload_cb
		});
	}

	var str_to_keycode_table = {
		backspace: 8,
		enter: 13,
		shift: 16,
		ctrl: 17,
		alt: 18,
		esc: 27,
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
		27: "esc",
		32: "space",

		37: "left",
		38: "up",
		39: "right",
		40: "down",

		//91: "super",

		// numpad
		97: "1",
		98: "2",
		99: "3",
		100: "4",
		101: "5",
		102: "6",
		103: "7",
		104: "8",
		105: "9",
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

	//var maxzindex = 2147483647;
	// some sites have z-index: 99999999999999 (http://www.topstarnews.net/)
	// this gets scaled down to 2147483647 in the elements panel, but it gets seen as higher than 9999* by the browser
	// Number.MAX_VALUE doesn't work at all (z-index doesn't get set)
	var maxzindex = Number.MAX_SAFE_INTEGER;
	// sites like topstarnews under Firefox somehow change sans-serif as the default font
	var sans_serif_font = '"Noto Sans", Arial, Helvetica, sans-serif';

	var get_safe_glyph = function(font, glyphs) {
		if (settings.mouseover_ui_use_safe_glyphs)
			return glyphs[glyphs.length - 1];

		try {
			for (var i = 0; i < glyphs.length; i++) {
				if (document.fonts.check(font, glyphs[i]))
					return glyphs[i];
			}
		} catch (e) {
			console_error(e);
		}

		return glyphs[glyphs.length - 1];
	};

	function keycode_to_str(event) {
		var x = event.which;

		if (event.code) {
			// when pressing Shift
			var match = event.code.match(/^Numpad([0-9]+)$/);
			if (match) {
				return match[1];
			};
		}

		if (x in keycode_to_str_table) {
			return keycode_to_str_table[x];
		}

		if (!((x >= 65 && x <= 90) ||
			  // numbers
			  (x >= 48 && x <= 57))) {
			return;
		}

		return string_fromcharcode(x).toLowerCase();
	}

	function str_to_keycode(x) {
		if (x in str_to_keycode_table) {
			return str_to_keycode_table[x];
		}
		return x.toUpperCase().charCodeAt(0);
	}

	function normalize_keychord(keychord) {
		if (keychord.length === 0)
			return [[]];

		if (!is_array(keychord[0]))
			return [keychord];

		return keychord;
	}

	function general_extension_message_handler(message, sender, respond) {
		if (_nir_debug_) {
			console_log("general_extension_message_handler", message);
		}

		if (message.type === "settings_update") {
			//console_log(message);
			settings_updated_cb(message.data.changes);
		} else if (message.type === "request") {
			var response = message.data;

			if (!(response.id in extension_requests)) {
				// this happens when there's more than one frame per tab
				if (_nir_debug_) {
					console_log("Request ID " + response.id + " not in extension_requests");
				}

				return;
			}

			if (response.data && response.data.responseType === "blob") {
				var enc = response.data._responseEncoded;

				if (enc) {
					var array = new Uint8Array(enc.value.length);
					for (var i = 0; i < enc.value.length; i++) {
						array[i] = enc.value.charCodeAt(i);
					}

					var wanted_responseType = "blob";
					if (response.data._wanted_responseType === "arraybuffer")
						wanted_responseType = "arraybuffer";

					if (wanted_responseType === "blob") {
						try {
							response.data.response = new native_blob([array.buffer], { type: enc.type });
						} catch(e) {
							console_error(e);
							response.data.response = null;
						}
					} else {
						response.data.response = array.buffer;
					}
				} else {
					response.data.response = null;
				}
			} else if (response.data && response.data.responseText && !response.data.response) {
				response.data.response = response.data.responseText;
			}

			var reqdata = extension_requests[response.id].data;

			var events = [
				"onload",
				"onerror",
				"onprogress",
				"onabort"
			];

			var handled = false;
			for (var i = 0; i < events.length; i++) {
				var event = events[i];

				if (response.event === event && reqdata[event]) {
					if (_nir_debug_) {
						console_log("Running " + event + " for response", response);
					}

					reqdata[event](response.data);
					handled = true;
				}
			}

			if (_nir_debug_ && !handled) {
				console_warn("No event handler for", response);
			}

			if (response.final) {
				delete extension_requests[response.id];
			}
		} else if (message.type === "bg_redirect") {
			if (settings.redirect && settings.redirect_extension) {
				try {
					var headers = headers_list_to_dict(message.data.responseHeaders);
					if (headers["content-type"] && contenttype_can_be_redirected(headers["content-type"])) {
						do_redirect_sub(message.data.url, false, function(newurl, obj) {
							send_redirect(obj, function() {
								chrome.tabs.update(message.data.tabId, {
									url: newurl
								});
							}, message.data.tabId);
						});
					}
				} catch (e) {
					console_error(e);
				}
			}
		}
	}

	function do_mouseover() {
		if (_nir_debug_)
			console_log("do_mouseover ran");

		var mouseover_enabled = function() {
			var base_enabled = settings.imu_enabled && settings.mouseover;

			if (settings.apply_blacklist_host && !bigimage_filter(window.location.href))
				return false;

			return base_enabled;
		};

		var mouseover_mouse_enabled = function() {
			return mouseover_enabled() && delay !== false && typeof delay === "number" && delay_mouseonly;
		};

		var mousepos_initialized = false;

		var mouseX = 0;
		var mouseY = 0;
		var mouseAbsX = 0;
		var mouseAbsY = 0;
		var mouse_frame_id = "top";

		var mouseContextX = 0;
		var mouseContextY = 0;
		var mouseAbsContextX = 0;
		var mouseAbsContextY = 0;

		var mouse_in_image_yet = false;
		var mouseDelayX = 0;
		var mouseDelayY = 0;

		var lastX = 0;
		var lastY = 0;

		var processing_list = [];
		var popups = [];
		var mask_el = null;
		var popup_obj = null;
		var popup_objecturl = null;
		var previous_album_links = null;
		var popup_contentlength = null;
		var popup_el = null;
		var popup_el_is_video = false;
		var popup_orig_url = null;
		var resetpopup_timeout = null;
		var real_popup_el = null;
		var next_popup_el = null;
		var last_popup_el = null;
		var popup_orig_el = null;
		var popup_el_automatic = false;
		var popup_el_remote = false;
		var popups_active = false;
		var popup_trigger_reason = null;
		var can_close_popup = [false, false];
		var popup_hold = false;
		var popup_hold_func = common_functions.nullfunc;
		var popup_zoom_func = common_functions.nullfunc;
		var popup_wheel_cb = null;
		var popup_update_pos_func = null;
		var popup_hidecursor_func = common_functions.nullfunc;
		var popup_hidecursor_timer = null;
		var popup_cursorjitterX = 0;
		var popup_cursorjitterY = 0;
		var popup_client_rect_cache = null;
		var last_popup_client_rect_cache = 0;
		var popup_media_client_rect_cache = null;
		var last_popup_media_client_rect_cache = 0;
		var dragstart = false;
		var dragstartX = null;
		var dragstartY = null;
		var dragoffsetX = null;
		var dragoffsetY = null;
		var popupOpenX = null;
		var popupOpenY = null;
		var popupOpenLastX = null;
		var popupOpenLastY = null;
		var dragged = false;
		var waiting = false;

		var waitingel = null;
		var waitingstyleel = null;
		var waitingel_cursor = null;
		var elwaitingstyleclass = null;
		var elwaitingstyleel = null;
		var waitingsize = 200;

		var current_chord = [];
		var current_chord_timeout = {};
		var release_ignore = [];
		var editing_text = false;

		var host_location = window.location.href;
		var host_domain = get_domain_from_url(host_location);
		var host_domain_nosub = get_domain_nosub(host_domain);

		function resetifout(e) {
			// doesn't work, as e doesn't contain ctrlKey etc.
			if (!trigger_complete(settings.mouseover_trigger_key)) {
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

		if (false) {
			var disable_click = false;
			document.addEventListener("click", function(e) {
				if (disable_click && popups_active && false) {
					e.stopPropagation();
					e.stopImmediatePropagation();

					return true;
					//return false;
				}
			}, true);
		}

		var delay = false;
		var delay_handle = null;
		var delay_handle_triggering = false;
		var delay_mouseonly = true;
		var delay_el = null;

		function update_waiting() {
			if (!waitingel)
				return;

			var x = mouseX;//mouseAbsX;
			var y = mouseY;//mouseAbsY;
			waitingel.style.left = (x - (waitingsize / 2)) + "px";
			waitingel.style.top = (y - (waitingsize / 2)) + "px";
		}

		function start_waiting(el, cursor) {
			if (!cursor)
				cursor = "wait";

			waitingel_cursor = cursor;

			waiting = true;

			if (!settings.mouseover_wait_use_el) {
				if (waitingstyleel) {
					stop_waiting();
				}

				waitingstyleel = document_createElement("style");
				waitingstyleel.innerText = "*,a,img,video {cursor: " + cursor + "!important}";
				document.documentElement.appendChild(waitingstyleel);
				return;
			}

			if (!waitingel) {
				waitingel = document_createElement("div");
				set_el_all_initial(waitingel);
				waitingel.style.zIndex = maxzindex;
				waitingel.style.cursor = cursor;
				waitingel.style.width = waitingsize + "px";
				waitingel.style.height = waitingsize + "px";
				//waitingel.style.pointerEvents = "none"; // works, but defeats the purpose, because the cursor isn't changed
				waitingel.style.position = "fixed";//"absolute";

				var simevent = function(e, eventtype) {
					waitingel.style.display = "none";
					document.elementFromPoint(e.clientX, e.clientY).dispatchEvent(new MouseEvent(eventtype, e));
					waitingel.style.display = "block";
				};

				our_addEventListener(waitingel, "click", function(e) {
					return simevent(e, "click");
				});

				our_addEventListener(waitingel, "contextmenu", function(e) {
					return simevent(e, "contextmenu");
				});

				document.documentElement.appendChild(waitingel);
			}

			waitingel.style.cursor = cursor;
			waitingel.style.display = "block";

			update_waiting();
		}

		function start_progress(el) {
			start_waiting(el, "progress");
		}

		function stop_waiting() {
			if (_nir_debug_) {
				console_log("stop_waiting");
			}

			waiting = false;

			if (!settings.mouseover_wait_use_el) {
				if (waitingstyleel) {
					waitingstyleel.parentElement.removeChild(waitingstyleel);
					waitingstyleel = null;
				}
			}

			if (waitingel)
				waitingel.style.display = "none";
		}

		// camhub.cc (ublock origin blocks any setTimeout'd function with 'stop' in the name)
		function dont_wait_anymore() {
			stop_waiting();
		}

		var not_allowed_timer = null;
		function cursor_not_allowed() {
			if (_nir_debug_) {
				console_log("cursor_not_allowed");
			}

			start_waiting(undefined, "not-allowed");

			if (not_allowed_timer) {
				clearTimeout(not_allowed_timer);
			}

			not_allowed_timer = setTimeout(function() {
				not_allowed_timer = null;

				if (waitingel_cursor === "not-allowed")
					dont_wait_anymore();
			}, settings.mouseover_notallowed_duration);
		}

		function stop_waiting_cant_load() {
			if (settings.mouseover_enable_notallowed_cant_load) {
				cursor_not_allowed();
			} else {
				stop_waiting();
			}
		}

		function in_clientrect(mouseX, mouseY, rect, border) {
			if (isNaN(border) || border === undefined)
				border = 0;

			if (mouseX >= (rect.left - border) && mouseX <= (rect.right + border) &&
				mouseY >= (rect.top - border) && mouseY <= (rect.bottom + border)) {
				return true;
			} else {
				return false;
			}
		}

		function stop_processing() {
			for (var i = 0; i < processing_list.length; i++) {
				processing_list[i].running = false;
			}
		}

		var clear_resetpopup_timeout = function() {
			if (resetpopup_timeout) {
				clearTimeout(resetpopup_timeout);
				resetpopup_timeout = null;
			}
		};

		var add_resetpopup_timeout = function() {
			if (!settings.mouseover_auto_close_popup || !settings.mouseover_auto_close_popup_time)
				return;

			clear_resetpopup_timeout();

			resetpopup_timeout = setTimeout(resetpopups, settings.mouseover_auto_close_popup_time * 1000);
		};

		var removepopups_timer = null;
		function removepopups() {
			popups.forEach(function (popup) {
				var els = popup.querySelectorAll("img, video");
				for (var i = 0; i < els.length; i++) {
					if (els[i].tagName === "VIDEO")
						els[i].pause();

					check_image_unref(els[i]);
				}

				if (popup.parentNode)
					popup.parentNode.removeChild(popup);

				var index = array_indexof(popups, popup);
				if (index > -1) {
					popups.splice(index, 1);
				}
			});

			if (removepopups_timer) {
				clearTimeout(removepopups_timer);
				removepopups_timer = null;
			}
		}

		var remove_mask = function() {
			if (mask_el) {
				if (mask_el.parentElement)
					mask_el.parentElement.removeChild(mask_el);
				mask_el = null;
			}

			if (removemask_timer) {
				clearTimeout(removemask_timer);
				removemask_timer = null;
			}
		};

		var removemask_timer = null;
		function resetpopups(options) {
			if (_nir_debug_) {
				console_log("resetpopups(", options, ")");
			}

			if (!options) {
				options = {};
			}

			var from_remote = !!options.from_remote;

			popups.forEach(function (popup) {
				if (settings.mouseover_fade_time > 0 && (settings.mouseover_enable_fade || settings.mouseover_enable_zoom_effect)) {
					if (settings.mouseover_enable_fade) {
						popup.style.opacity = 0;
					}

					if (settings.mouseover_enable_zoom_effect) {
						popup.style.transform = "scale(0)";
					}

					if (!removepopups_timer) {
						removepopups_timer = setTimeout(removepopups, settings.mouseover_fade_time);
					}
				} else {
					// FIXME: this is called for each popup
					removepopups();
				}
			});

			if (mask_el) {
				set_important_style(mask_el, "pointer-events", "none");

				if (settings.mouseover_mask_fade_time > 0) {
					set_important_style(mask_el, "opacity", 0);

					if (!removemask_timer) {
						removemask_timer = setTimeout(remove_mask, settings.mouseover_mask_fade_time);
					}
				} else {
					remove_mask();
				}
			}

			if (!from_remote && can_use_remote()) {
				if (is_in_iframe) {
					remote_send_message("top", {type: "resetpopups"});
				} else if (popup_el_remote) {
					remote_send_message(popup_el_remote, {type: "resetpopups"});
				}
			}

			disable_click = false;
			popups_active = false;
			delay_handle_triggering = false;

			clear_resetpopup_timeout();

			next_popup_el = null;
			if (popup_el)
				last_popup_el = popup_el;
			popup_el = null;
			real_popup_el = null;
			popup_el_automatic = false;
			popup_el_remote = false;
			popup_el_is_video = false;
			popup_orig_url = null;
			popup_hold_func = common_functions.nullfunc;
			popup_zoom_func = common_functions.nullfunc;
			popup_wheel_cb = null;
			popup_update_pos_func = null;
			popup_client_rect_cache = null;
			last_popup_client_rect_cache = 0;
			popup_media_client_rect_cache = null;
			last_popup_media_client_rect_cache = 0;

			if (!options.automatic) {
				popup_hold = false;
			}

			if (!options.new_popup) {
				can_close_popup = [false, false];
			}

			stop_processing();

			if (!options.new_popup || settings.mouseover_wait_use_el) {
				// don't recalculate style until after the popup is open
				stop_waiting();
			}

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

		var parse_styles = function(str) {
			if (typeof str !== "string")
				return;

			str = strip_whitespace(str);
			if (!str)
				return;

			var blocks = {};
			var current_block = "default";

			var splitted = str.split(/[;\n]/);
			for (var i = 0; i < splitted.length; i++) {
				var current = strip_whitespace(splitted[i]);
				if (!current)
					continue;

				// note: c/css multiline comments (/* */) aren't supported yet
				// c++-style comments
				if (/^\/\//.test(current))
					continue;

				var match = current.match(/^(#[-a-zA-Z0-9]+(?:\s*,\s*#[-a-zA-Z0-9]+){0,})\s*{/);
				if (match) {
					if (current_block !== "default") {
						console_error("Nested blocks aren't supported");
						return;
					}

					current_block = match[1].split(/\s*,\s*/);
					splitted[i--] = current.substr(match[0].length);
					continue;
				}

				if (current[0] === "}") {
					if (current_block === "default") {
						console_error("No block to escape from");
						return;
					}

					current_block = "default";
					continue;
				}

				if (string_indexof(current, ":") < 0)
					continue;

				var next_block = current_block;
				if (current_block !== "default" && /}$/.test(current)) {
					current = strip_whitespace(current.replace(/}$/, ""));
					next_block = "default";
				}

				var property = strip_whitespace(current.replace(/^(.*?)\s*:.*/, "$1"));
				var value = strip_whitespace(current.replace(/^.*?:\s*(.*)$/, "$1"));

				var important = false;
				if (value.match(/!important$/)) {
					important = true;
					value = strip_whitespace(value.replace(/!important$/, ""));
				}

				var c_blocks = current_block;
				if (!is_array(c_blocks)) c_blocks = [c_blocks];

				array_foreach(c_blocks, function(block) {
					if (!(block in blocks))
						blocks[block] = {};
					blocks[block][property] = {value: value, important: important};
				});

				current_block = next_block;
			}

			return blocks;
		};

		function get_processed_styles(str) {
			if (!str || typeof str !== "string" || !strip_whitespace(str))
				return;

			var styles = {};
			var splitted = str.split(/[;\n]/);
			for (var i = 0; i < splitted.length; i++) {
				var current = strip_whitespace(splitted[i]);
				if (!current)
					continue;

				if (string_indexof(current, ":") < 0)
					continue;

				if (/^\s*\/\//.test(current))
					continue;

				var property = strip_whitespace(current.replace(/^(.*?)\s*:.*/, "$1"));
				var value = strip_whitespace(current.replace(/^.*?:\s*(.*)$/, "$1"));

				var important = false;
				if (value.match(/!important$/)) {
					important = true;
					value = strip_whitespace(value.replace(/!important$/, ""));
				}

				styles[property] = {value: value, important: important};
			}

			return styles;
		}

		function get_styletag_styles(str) {
			// TODO: use parse_styles instead
			var styles = get_processed_styles(str);
			if (!styles)
				return;

			var styles_array = [];
			for (var property in styles) {
				var current = property + ": " + styles[property].value;
				if (styles[property].important || true) {
					current += " !important"
				}

				styles_array.push(current);
			}

			return styles_array.join("; ");
		}

		function apply_styles(el, str, options) {
			var style_blocks = parse_styles(str);
			if (!style_blocks)
				return;

			var oldstyle = el.getAttribute("style");
			if (oldstyle) {
				el.setAttribute("data-imu-oldstyle", oldstyle);
			}

			var styles = {};

			if ("default" in style_blocks)
				styles = style_blocks["default"];

			if (options.id && ("#" + options.id) in style_blocks) {
				var block = style_blocks["#" + options.id];
				for (var property in block)
					styles[property] = block[property];
			}

			for (var property in styles) {
				var obj = styles[property];
				var value = obj.value;

				// todo: maybe handle escape sequences with JSON_parse?
				if (value.match(/^['"].*['"]$/)) {
					value = value.replace(/^["'](.*)["']$/, "$1");
				}

				if (options.variables) {
					for (var variable in options.variables) {
						value = string_replaceall(value, variable, options.variables[variable]);
					}
				}

				if (options.properties) {
					if (property in options.properties) {
						options.properties[property](value, property);
					}
				}

				if (obj.important || options.force_important) {
					el.style.setProperty(property, value, "important");
				} else {
					el.style.setProperty(property, value);
				}

				el.setAttribute("data-imu-newstyle", true);
			}
		}

		function revert_styles(el) {
			var oldstyle = el.getAttribute("data-imu-oldstyle");

			if (oldstyle) {
				el.setAttribute("style", oldstyle);
				el.removeAttribute("data-imu-oldstyle");
			} else if (el.getAttribute("style") && el.getAttribute("data-imu-newstyle")) {
				el.removeAttribute("style");
			}

			el.removeAttribute("data-imu-newstyle");
		}

		function set_important_style(el, property, value) {
			el.style.setProperty(property, value, "important");
		}

		function get_caption(obj, el) {
			if (obj && obj.extra && obj.extra.caption) {
				return strip_whitespace(obj.extra.caption);
			}

			if (el) {
				do {
					// don't use el.title/el.alt because if the element is <form>, it refers to form > input[name="title"]
					var el_title = el.getAttribute("title");
					var el_alt = el.getAttribute("alt");

					if (el_title || el_alt) {
						var caption = el_title || el_alt;

						// When opening an image in a new tab in Firefox, alt is set to the src
						if (caption === el.src)
							return null;

						return strip_whitespace(caption);
					}
				} while ((el = el.parentElement));
			}

			return null;
		}

		function get_el_dimensions(el) {
			if (get_tagname(el) === "VIDEO") {
				return [
					el.videoWidth,
					el.videoHeight
				];
			} else if (get_tagname(el) === "CANVAS") {
				return [
					el.width,
					el.height
				];
			} else if (get_tagname(el) === "SVG") {
				return [
					el.width.animVal.value,
					el.height.animVal.value
				];
			} else {
				return [
					el.naturalWidth,
					el.naturalHeight
				]
			}
		}

		function add_link_to_history(link) {
			if (is_extension) {
				extension_send_message({
					type: "add_to_history",
					data: {
						url: link
					}
				});
			}
		}

		var fill_obj_filename = function(newobj, url, respdata) {
			if (typeof newobj.filename !== "string")
				newobj.filename = "";

			var newobj_ext = null;
			if (newobj.filename.length === 0 && respdata) {
				try {
					var headers = parse_headers(respdata.responseHeaders);
					for (var h_i = 0; h_i < headers.length; h_i++) {
						var header_name = headers[h_i].name.toLowerCase();
						var header_value = headers[h_i].value;

						if (header_name === "content-disposition") {
							// http://cfile7.uf.tistory.com/original/227CF24E57ABEC701869E7
							// Content-Disposition: inline; filename="160731 LA Kcon stage - 15 copy.jpg"; filename*=UTF-8''160731%20LA%20Kcon%20stage%20-%2015%20copy.jpg
							var loops = 0;
							while (loops < 100 && typeof header_value === "string" && header_value.length > 0) {
								var current_value = header_value.replace(/^\s*([^;]*?)\s*(?:;.*)?$/, "$1");
								//header_value = header_value.replace(/^[^;]*(?:;\s*(.*))?$/, "$1");

								var attr = current_value.replace(/^\s*([^=;]*?)\s*(?:[=;].*)?$/, "$1").toLowerCase();
								var a_match = header_value.match(/^[^=;]*(?:(?:=\s*(?:(?:["']([^'"]*?)["'])|([^;]*?))\s*(;.*)?\s*)|;\s*(.*))?$/);
								if (!a_match) {
									console_error("Header value does not match pattern:", header_value);
									break;
								}
								var a_value = a_match[1] || a_match[2];

								// TODO: implement properly
								/*if (attr === "filename*") {
									newobj.filename = a_value;
								}*/

								if (newobj.filename.length === 0 && attr === "filename" && typeof a_value === "string" && a_value.length > 0) {
									newobj.filename = a_value;
								}

								header_value = a_match[3] || a_match[4];
								loops++;
							}
						} else if (header_name === "content-type") {
							newobj_ext = get_ext_from_contenttype(header_value);
						}

						if (newobj.filename.length > 0)
							break;
					}
				} catch (e) {
					console_error(e);
				}

				var found_filename_from_url = false;
				if (newobj.filename.length === 0) {
					newobj.filename = url.replace(/.*\/([^?#/]*)(?:[?#].*)?$/, "$1");
					found_filename_from_url = true;

					// Disable as there's no use for this
					if (false && (newobj.filename.split(".").length - 1) === 1) {
						newobj.filename = newobj.filename.replace(/(.*)\.[^.]*?$/, "$1");
					}
				}

				// e.g. for /?...
				if (newobj.filename.length === 0) {
					newobj.filename = "download";
				}

				if (string_indexof(newobj.filename, ".") < 0 && newobj_ext) {
					newobj.filename += "." + newobj_ext;
				}

				// thanks to fireattack on discord for reporting.
				// test: https://hiyoko-bunko.com/specials/h0xmtix1pv/
				// https://images.microcms-assets.io/protected/ap-northeast-1:92243b3c-cb7c-44e8-9c84-28ba954120c5/service/hiyoko-bunko/media/hb_sns_%E3%82%A4%E3%83%98%E3%82%99%E3%83%B3%E3%83%88%E5%BD%93%E6%97%A5_200831.jpg
				if (found_filename_from_url) {
					newobj.filename = decodeURIComponent(newobj.filename);
				}
			}
		};

		function makePopup(obj, orig_url, processing, data) {
			if (_nir_debug_) {
				console_log("makePopup", obj, orig_url, processing, data);
			}

			if (settings.mouseover_add_to_history) {
				add_link_to_history(data.data.obj.url);
			}

			var openb = get_single_setting("mouseover_open_behavior");
			if (openb === "newtab" || openb === "download") {
				stop_waiting();

				var theobj = data.data.obj;
				theobj.url = data.data.resp.finalUrl;

				fill_obj_filename(theobj, theobj.url, data.data.resp);
				popup_obj = theobj;

				if (openb === "newtab") {
					open_in_tab_imu(theobj);
				} else if (openb === "download") {
					download_popup_image();
				}
				return;
			}

			//var x = mouseX;//mouseAbsX;
			//var y = mouseY;//mouseAbsY;
			var x = data.x;
			var y = data.y;

			if (x === null || x === undefined) {
				x = lastX;
			}

			if (y === null || y === undefined) {
				y = lastY;
			}

			dragged = false;
			dragstart = false;
			var seekstart = false;

			function cb(img, url) {
				if (!img) {
					delay_handle_triggering = false;

					if (processing.running) {
						stop_waiting_cant_load();
					}
					return;
				}

				var is_video = img.tagName === "VIDEO";

				var newobj = data.data.obj;

				if (!newobj)
					newobj = {};

				popup_obj = newobj;

				var estop = function(e) {
					e.stopPropagation();
					e.stopImmediatePropagation();
					return true;
				};

				var estop_pd = function(e) {
					e.preventDefault();
					estop(e);
					return true;
				};

				lastX = x;
				lastY = y;

				popupOpenX = x;
				popupOpenY = y;
				popupOpenLastX = x;
				popupOpenLastY = y;

				var initial_zoom_behavior = get_single_setting("mouseover_zoom_behavior");

				//img.onclick = estop;
				//img.onmousedown = estop;
				//img.addEventListener("click", estop, true);
				//img.addEventListener("mousedown", estop, true);

				var bgcolor = "#333";
				var fgcolor = "#fff";
				var textcolor = "#fff";
				var shadowcolor = "rgba(0,0,0,.5)";

				var setup_mask_el = function(mask) {
					set_el_all_initial(mask);

					set_important_style(mask, "opacity", 1);
					if (settings.mouseover_enable_mask_styles)
						apply_styles(mask, settings.mouseover_mask_styles2, {
							force_important: true
						});

					if (!settings.mouseover_close_click_outside) {
						set_important_style(mask, "pointer-events", "none");
					}

					set_important_style(mask, "position", "fixed");
					set_important_style(mask, "z-index", maxzindex - 3);
					set_important_style(mask, "width", "100%");
					set_important_style(mask, "height", "100%");
					set_important_style(mask, "left", "0px");
					set_important_style(mask, "top", "0px");

					if (settings.mouseover_mask_fade_time > 0) {
						set_important_style(mask, "transition", "opacity " + (settings.mouseover_mask_fade_time / 1000.) + "s");

						// this allows us to respect a custom opacity for mouseover_mask_styles
						var old_opacity = mask.style.opacity;

						if (!popup_el_automatic) {
							set_important_style(mask, "opacity", 0);
							// this is needed in order to make the transition happen
							setTimeout(function() {
								set_important_style(mask, "opacity", old_opacity);
							}, 1);
						} else {
							set_important_style(mask, "opacity", old_opacity);
						}
					}

					our_addEventListener(mask, "click", function() {
						if (!settings.mouseover_close_click_outside)
							return;

						set_important_style(mask, "pointer-events", "none");
						resetpopups();
					}, true);

					return mask;
				};

				remove_mask();

				if (settings.mouseover_close_click_outside || settings.mouseover_enable_mask_styles) {
					mask_el = document_createElement("div");
					setup_mask_el(mask_el);
				}

				var outerdiv = document_createElement("div");
				set_el_all_initial(outerdiv);
				set_important_style(outerdiv, "position", "fixed");
				set_important_style(outerdiv, "z-index", maxzindex - 2);

				var zoom_move_effect_enabled = false;
				if (settings.mouseover_fade_time > 0 && !popup_el_automatic) {
					var transition_effects = [];
					var temp_transition_effects = [];
					var fade_s = (settings.mouseover_fade_time / 1000.) + "s";

					if (settings.mouseover_enable_fade) {
						transition_effects.push("opacity " + fade_s);
						set_important_style(outerdiv, "opacity", 0);
					}

					if (settings.mouseover_enable_zoom_effect) {
						transition_effects.push("transform " + fade_s);
						set_important_style(outerdiv, "transform", "scale(0)");

						if (settings.mouseover_zoom_effect_move) {
							temp_transition_effects.push("top " + fade_s);
							temp_transition_effects.push("left " + fade_s);
							zoom_move_effect_enabled = true;
						}
					}

					if (transition_effects.length > 0) {
						var orig_transition_string = transition_effects.join(", ");

						array_extend(transition_effects, temp_transition_effects);
						var temp_transition_string = transition_effects.join(", ");
						set_important_style(outerdiv, "transition", temp_transition_string);

						if (temp_transition_effects.length > 0) {
							setTimeout(function() {
								set_important_style(outerdiv, "transition", orig_transition_string);
							}, settings.mouseover_fade_time);
						}
					}

					// setTimeout is needed in order to make the transition happen
					setTimeout(function() {
						set_important_style(outerdiv, "opacity", 1);
						set_important_style(outerdiv, "transform", "scale(1)");
					}, 1);
				}

				var div = document_createElement("div");
				var popupshown = false;
				set_el_all_initial(div);
				set_important_style(div, "box-shadow", "0 0 15px " + shadowcolor);
				set_important_style(div, "border", "3px solid " + fgcolor);
				set_important_style(div, "position", "relative");
				set_important_style(div, "top", "0px");
				set_important_style(div, "left", "0px");
				set_important_style(div, "display", "block");
				set_important_style(div, "background-color", "rgba(255,255,255,.5)");

				// http://png-pixel.com/
				var transparent_gif = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
				var styles_variables = {};
				if (popup_orig_url && !popup_el_is_video) {
					styles_variables["%thumburl%"] = encodeuri_ifneeded(popup_orig_url);
				} else {
					styles_variables["%thumburl%"] = transparent_gif;
				}

				if (!is_video) {
					styles_variables["%fullurl%"] = encodeuri_ifneeded(get_img_src(img));
				} else {
					styles_variables["%fullurl%"] = transparent_gif;
				}

				apply_styles(div, settings.mouseover_styles, {
					force_important: true,
					variables: styles_variables
				});
				outerdiv.appendChild(div);

				//div.style.position = "fixed"; // instagram has top: -...px
				//div.style.zIndex = maxzindex - 2;


				//div.onclick = estop;
				//div.onmousedown = estop;
				//div.addEventListener("click", estop, true);
				//div.addEventListener("mousedown", estop, true);
				// useful for instagram
				//disable_click = true;


				var outer_thresh = 16;
				var border_thresh = 20;
				var top_thresh = 30;
				var top_mb = top_thresh - border_thresh;
				var viewport;
				var vw;
				var vh;

				var v_mx = Math_max(x - border_thresh, 0);
				var v_my = Math_max(y - top_thresh, 0);

				var update_vwh = function(x, y) {
					viewport = get_viewport();
					vw = viewport[0];
					vh = viewport[1];

					vw -= border_thresh * 2;
					vh -= border_thresh + top_thresh;

					if (typeof x !== "undefined") {
						v_mx = Math_min(vw, Math_max(x - border_thresh, 0));
						v_my = Math_min(vh, Math_max(y - top_thresh, 0));
					}
				};

				var set_top = function(x) {
					outerdiv.style.top = x + "px";
				};

				var set_left = function(x) {
					outerdiv.style.left = x + "px";
				};

				var set_lefttop = function(xy) {
					set_top(xy[1]);
					set_left(xy[0]);
				};

				// https://stackoverflow.com/a/23270007
				function get_lefttopouter() {
					var style = outerdiv.currentStyle || window.getComputedStyle(outerdiv);
					return [style.marginLeft + style.borderLeftWidth,
							style.marginTop + style.borderTopWidth];
				}

				update_vwh(x, y);

				var el_dimensions = get_el_dimensions(img);
				set_el_all_initial(img);

				var add_link = false;
				if (!is_video && settings.mouseover_add_link) {
					add_link = true;
				} else if (is_video && settings.mouseover_add_video_link) {
					add_link = true;
				}

				if (add_link) {
					// don't !important because it'll override the waiting cursor for automatic (gallery) popups
					img.style.cursor = "pointer";
				}
				// https://stackoverflow.com/questions/7774814/remove-white-space-below-image
				img.style.verticalAlign = "bottom";

				set_important_style(img, "display", "block");

				var update_img_display = function(style) {
					img.style.setProperty("display", style[0], style[1]);
				};

				var visibility_workarounds = [
					// uBlock Origin on pornhub blocks: video[style*="display: block !important;"]
					{
						domain_nosub: /^pornhub(?:premium)?\./,
						img_display: ["block"]
					},
					{
						domain_nosub: /^pornhub(?:premium)?\./,
						img_display: ["initial", "important"]
					},

					// uBlock Origin on gelbooru blocks:
					//   a[target="_blank"] > img
					//   a[target="_blank"] > div
					// https://github.com/qsniyg/maxurl/issues/430#issuecomment-686768694
					{
						domain_nosub: /^gelbooru\./,
						func: function() {
							var span_el = document_createElement("span");
							span_el.appendChild(img);
							a.appendChild(span_el);
						}
					}
				];

				var check_visibility_workaround = function(workaround) {
					if (workaround.domain_nosub) {
						if (!workaround.domain_nosub.test(host_domain_nosub))
							return false;
					}

					return true;
				};

				var apply_visibility_workaround = function(workaround) {
					if (workaround.img_display) {
						update_img_display(workaround.img_display);
					} else if (workaround.func) {
						workaround.func();
					}
				};

				var check_img_visibility = function() {
					setTimeout(function() {
						var computed = get_computed_style(img);
						if (computed.display !== "none") {
							return;
						}

						while (visibility_workarounds.length > 0) {
							var current_workaround = visibility_workarounds.shift();

							if (!check_visibility_workaround(current_workaround))
								continue;

							apply_visibility_workaround(current_workaround);

							if (visibility_workarounds.length > 0)
								check_img_visibility();

							break;
						}
					}, 50);
				};
				check_img_visibility();

				// https://github.com/qsniyg/maxurl/issues/330
				set_important_style(img, "object-fit", "contain");

				var img_naturalHeight, img_naturalWidth;

				img_naturalWidth = el_dimensions[0];
				img_naturalHeight = el_dimensions[1];

				var imgh = img_naturalHeight;
				var imgw = img_naturalWidth;

				if (initial_zoom_behavior === "fit" || initial_zoom_behavior === "fill") {
					img.style.maxWidth = vw + "px";
					img.style.maxHeight = vh + "px";

					if (initial_zoom_behavior === "fill" && (imgw < vw && imgh < vh)) {
						var zoom_percent = 1;
						if (imgh > imgw) {
							zoom_percent = vh / imgh;
						} else {
							zoom_percent = vw / imgw;
						}

						imgw = imgw * zoom_percent;
						imgh = imgh * zoom_percent;

						img.style.maxWidth = imgw + "px";
						img.style.width = img.style.maxWidth;
						img.style.maxHeight = imgh + "px";
						img.style.height = img.style.maxHeight;
					}
				} else if (initial_zoom_behavior === "custom") {
					var zoom_percent = settings.mouseover_zoom_custom_percent / 100;
					imgw = Math_max(imgw * zoom_percent, 20);
					imgh = Math_max(imgh * zoom_percent, 20);
					img.style.maxWidth = imgw + "px";
					img.style.width = img.style.maxWidth;
					img.style.maxHeight = imgh + "px";
					img.style.height = img.style.maxHeight;
				}

				if (imgh < 20 || imgw < 20) {
					// FIXME: This will stop "custom" percentages with low percentages for small images
					stop_waiting_cant_load();
					console_error("Image too small to popup (" + imgw + "x" + imgh + ")");
					return;
				}

				var get_imghw_for_fit = function(width, height) {
					if (width === undefined)
						width = vw;

					if (height === undefined)
						height = vh;

					//height -= border_thresh * 2;
					//width  -= border_thresh * 2;

					var our_imgh = imgh;
					var our_imgw = imgw;

					if (imgh > height || imgw > width) {
						var ratio;
						if (imgh / height >
							imgw / width) {
							ratio = imgh / height;
						} else {
							ratio = imgw / width;
						}

						our_imgh /= ratio;
						our_imgw /= ratio;
					}

					return [our_imgw, our_imgh];
				};

				function calc_imghw_for_fit(width, height) {
					var new_imghw = get_imghw_for_fit(width, height);

					imgw = new_imghw[0];
					imgh = new_imghw[1];
				}

				if (initial_zoom_behavior === "fit" || initial_zoom_behavior === "fill") {
					calc_imghw_for_fit();
				}

				var max_width = settings.mouseover_zoom_max_width || undefined;
				var max_height = settings.mouseover_zoom_max_height || undefined;
				if (max_width || max_height) {
					calc_imghw_for_fit(max_width, max_height);
				}

				popup_update_pos_func = function(x, y, resize) {
					var popup_left, popup_top;

					update_vwh(x, y);

					var sct = scrollTop();
					var scl = scrollLeft();
					sct = scl = 0;

					var mouseover_position = get_single_setting("mouseover_position");
					if (popup_hold && settings.mouseover_hold_position_center)
						mouseover_position = "center";

					if (mouseover_position === "cursor") {
						popup_top =  sct + Math_min(Math_max(v_my - (imgh / 2), 0), Math_max(vh - imgh, 0));
						popup_left = scl + Math_min(Math_max(v_mx - (imgw / 2), 0), Math_max(vw - imgw, 0));
					} else if (mouseover_position === "center") {
						popup_top =  sct + Math_min(Math_max((vh / 2) - (imgh / 2), 0), Math_max(vh - imgh, 0));
						popup_left = scl + Math_min(Math_max((vw / 2) - (imgw / 2), 0), Math_max(vw - imgw, 0));
					} else if (mouseover_position === "beside_cursor") {
						var update_imghw;
						if (resize) {
							update_imghw = function(w, h) {
								calc_imghw_for_fit(w, h);
							};
						} else {
							update_imghw = common_functions.nullfunc;
						}

						var calc_imgrect = function(w, h) {
							var new_imghw = [imgw, imgh];

							if (resize) {
								new_imghw = get_imghw_for_fit(w, h);
							}

							if (new_imghw[0] > w || new_imghw[1] > h)
								return null;

							return new_imghw;
						};

						var cursor_thresh = border_thresh;
						var ovw = vw - cursor_thresh;
						var ovh = vh - cursor_thresh;

						var calc_imgposd = function(lefttop, info, popupd) {
							var moused = lefttop ? v_mx : v_my;
							var vd = lefttop ? ovw : ovh;

							switch (info) {
								case -1:
									return Math_min(vd - popupd, Math_max(0, moused - (popupd / 2)));
								case 0:
									return Math_max(0, moused - popupd - cursor_thresh);
								case 1:
									return Math_min(vd - popupd, moused + cursor_thresh);
							}
						};

						var all_rects = [
							// top
							[-1, 0, ovw, v_my - cursor_thresh],
							// right
							[1, -1, ovw - v_mx - cursor_thresh, ovh],
							// bottom
							[-1, 1, ovw, ovh - v_my - cursor_thresh],
							// left
							[0, -1, v_mx - cursor_thresh, ovh]
						];

						var rects = [];

						// TODO: move the current popup position to the top

						if (x > viewport[0] / 2) {
							rects.push(all_rects[3]);
						} else {
							rects.push(all_rects[1]);
						}

						if (y > viewport[1] / 2) {
							rects.push(all_rects[0]);
						} else {
							rects.push(all_rects[2]);
						}

						for (var i = 0; i < all_rects.length; i++) {
							if (array_indexof(rects, all_rects[i]) < 0) {
								rects.push(all_rects[i]);
							}
						}

						var largest_rectsize = -1;
						var largest_rect = null;
						var largest_origrect = null;

						for (var i = 0; i < rects.length; i++) {
							var our_rect = calc_imgrect(rects[i][2], rects[i][3]);
							if (!our_rect)
								continue;

							var our_rectsize = our_rect[0] * our_rect[1];
							if (our_rectsize > largest_rectsize) {
								largest_rectsize = our_rectsize;
								largest_rect = our_rect;
								largest_origrect = rects[i];
							}
						}

						if (!largest_origrect) {
							largest_rectsize = -1;
							for (var i = 0; i < rects.length; i++) {
								var rectsize = rects[i][2] * rects[i][3];
								if (rectsize > largest_rectsize) {
									largest_origrect = rects[i];
									largest_rectsize = rectsize;
								}
							}
						}

						if (largest_origrect) {
							update_imghw(largest_origrect[2], largest_origrect[3]);

							popup_top = calc_imgposd(false, largest_origrect[1], imgh);
							popup_left = calc_imgposd(true, largest_origrect[0], imgw);
						} else {
							// ???
						}
					} else if (mouseover_position === "beside_cursor_old") {
						// TODO: maybe improve this to be more interpolated?

						var popupx;
						var popupy;

						var cursor_thresh = border_thresh;

						var ovw = vw - cursor_thresh;
						var ovh = vh - cursor_thresh;

						var update_imghw;
						if (resize) {
							update_imghw = function(w, h) {
								calc_imghw_for_fit(w, h);
							};
						} else {
							update_imghw = common_functions.nullfunc;
						}

						update_imghw(ovw, ovh);

						for (var loop_i = 0; loop_i < (resize ? 16 : 1); loop_i++) {
							if (y > viewport[1] / 2) {
								popupy = v_my - imgh - cursor_thresh;
							} else if (popupy === undefined) {
								popupy = v_my + cursor_thresh;
							}

							if (x > viewport[0] / 2) {
								popupx = v_mx - imgw - cursor_thresh;
							} else if (popupx === undefined) {
								popupx = v_mx + cursor_thresh;
							}

							if (popupy < 0) {
								popupy = 0;

								if (settings.mouseover_prevent_cursor_overlap) {
									update_imghw(ovw, v_my);
									//continue;
								}
							}

							if (popupx < 0) {
								popupx = 0;

								if (settings.mouseover_prevent_cursor_overlap) {
									update_imghw(v_mx, ovh);
									//continue;
								}
							}

							if ((popupy + imgh) > vh) {
								if (settings.mouseover_prevent_cursor_overlap) {
									update_imghw(ovw, ovh - v_my);
									//continue;
								} else {
									popupy = Math_max(vh - imgh - cursor_thresh, 0);
								}
							}

							if ((popupx + imgw) > vw) {
								if (settings.mouseover_prevent_cursor_overlap) {
									update_imghw(ovw - v_mx, ovh);
									//continue;
								} else {
									popupx = Math_max(vw - imgw - cursor_thresh, 0);
								}
							}

							//break;
						}

						popup_top =  popupy;
						popup_left = popupx;
					}

					return [
						popup_left + border_thresh,
						popup_top + top_thresh
					];
				};

				var initialpos = popup_update_pos_func(x, y, true);

				if (!zoom_move_effect_enabled) {
					set_lefttop(initialpos);
				} else {
					set_lefttop([x - imgw/2, y - imgh/2]);

					setTimeout(function() {
						set_lefttop(initialpos);
					}, 1);
				}

				var set_popup_size_helper = function(size, maxsize, widthheight) {
					if (maxsize === undefined)
						maxsize = size;

					if (typeof size === "number")
						size = size + "px";
					if (typeof maxsize === "number")
						maxsize = maxsize + "px";

					if (widthheight) {
						img.style.width = size;
						img.style.maxWidth = maxsize;
					} else {
						img.style.height = size;
						img.style.maxHeight = maxsize;
					}
				};

				var set_popup_width = function(width, maxwidth) {
					set_popup_size_helper(width, maxwidth, true);
				};

				var set_popup_height = function(height, maxheight) {
					set_popup_size_helper(height, maxheight, false);
				};

				set_popup_width(imgw, "initial");
				set_popup_height(imgh, "initial");
				/*console_log(x - (imgw / 2));
				  console_log(vw);
				  console_log(imgw);
				  console_log(vw - imgw);*/

				function get_defaultopacity() {
					var defaultopacity = (settings.mouseover_ui_opacity / 100);
					if (isNaN(defaultopacity))
						defaultopacity = 1;
					if (defaultopacity > 1)
						defaultopacity = 1;
					if (defaultopacity < 0)
						defaultopacity = 0;

					return defaultopacity;
				}

				var defaultopacity = get_defaultopacity();

				function opacity_hover(el, targetel, action) {
					if (!targetel)
						targetel = el;

					our_addEventListener(el, "mouseover", function(e) {
						targetel.style.opacity = "1.0";

						if (action)
							targetel.style.boxShadow = "0px 0px 5px 1px white";
					}, true);
					our_addEventListener(el, "mouseout", function(e) {
						targetel.style.opacity = get_defaultopacity();

						if (action)
							targetel.style.boxShadow = "none";
					}, true);
				}

				var get_popup_dimensions = function() {
					return [
						(popupshown && outerdiv.clientWidth) || imgw,
						(popupshown && outerdiv.clientHeight) || imgh
					];
				};

				var btndown = false;
				function addbtn(options) {
					var tagname = "span";
					if (typeof options.action === "string")
						tagname = "a";

					var btn = document_createElement(tagname);

					if (options.action) {
						var do_action = function() {
							return !btn.hasAttribute("data-btn-noaction");
						};

						if (typeof options.action === "function") {
							our_addEventListener(btn, "click", function(e) {
								if (!do_action())
									return;

								//console_log(e);
								e.stopPropagation();
								e.stopImmediatePropagation();
								e.preventDefault();
								options.action();
								return false;
							}, true);
						} else if (typeof options.action === "string") {
							btn.href = options.action;
							btn.target = "_blank";
							btn.setAttribute("rel", "noreferrer");

							our_addEventListener(btn, "click", function(e) {
								e.stopPropagation();
								e.stopImmediatePropagation();
							}, true);
						}

						our_addEventListener(btn, "mouseover", function(e) {
							set_important_style(btn, "box-shadow", "0px 0px 5px 1px white");
						}, true);

						our_addEventListener(btn, "mouseout", function(e) {
							set_important_style(btn, "box-shadow", "none");
						}, true);
					}

					our_addEventListener(btn, "mousedown", function(e) {
						btndown = true;
					}, true);
					our_addEventListener(btn, "mouseup", function(e) {
						btndown = false;
					}, true);
					if (false && !options.istop) {
						opacity_hover(btn, undefined, true);
					} else if (typeof options.text === "object" && options.text.truncated !== options.text.full) {
						our_addEventListener(btn, "mouseover", function(e) {
							var computed_style = get_computed_style(btn);
							set_important_style(btn, "width", computed_style.width || (btn.clientWidth + "px"));

							btn.innerText = options.text.full;

						}, true);

						our_addEventListener(btn, "mouseout", function(e) {
							btn.innerText = options.text.truncated;
							btn.style.width = "initial";
						}, true);
					}

					set_el_all_initial(btn);
					if (options.action) {
						set_important_style(btn, "cursor", "pointer");
					}

					set_important_style(btn, "background", bgcolor);
					set_important_style(btn, "border", "3px solid " + fgcolor);
					set_important_style(btn, "border-radius", "10px");
					// test: https://www.yeshiva.org.il/ (topbarel sets this to ltr, so it must be set to the initial value in order to respect the direction)
					set_important_style(btn, "direction", text_direction);

					// workaround for emojis: https://stackoverflow.com/a/39776303
					if (typeof options.text === "string" && options.text.length === 1 && options.text.charCodeAt(0) > 256) {
						set_important_style(btn, "color", "transparent");
						set_important_style(btn, "text-shadow", "0 0 0 " + textcolor);
					} else {
						set_important_style(btn, "color", textcolor);
					}

					set_important_style(btn, "padding", "4px");
					set_important_style(btn, "line-height", "1em");
					//btn.style.whiteSpace = "nowrap";
					set_important_style(btn, "font-size", "14px");
					set_important_style(btn, "font-family", sans_serif_font);

					// TODO: cache the styles
					apply_styles(btn, settings.mouseover_ui_styles, {
						id: options.id,
						force_important: true,
						properties: {
							"-imu-text": function(value) {
								// TODO: support emojis properly
								if (typeof options.text === "object")
									options.text.truncated = value;
								else
									options.text = value;
							},
							"-imu-pos": function(value) {
								options.pos = value;

								if (array_indexof(["top-left", "top-middle", "top-right",
									               "left", "middle", "right",
									               "bottom-left", "bottom-middle", "bottom-right"], value) < 0) {
									console_warn("Invalid pos", value);
									options.pos = "top-left";
								}
							}
						}
					});

					set_important_style(btn, "z-index", maxzindex - 1);
					if (false && !options.istop) {
						set_important_style(btn, "position", "absolute");
						set_important_style(btn, "opacity", defaultopacity);
					} else {
						set_important_style(btn, "position", "relative");
						set_important_style(btn, "margin-right", "4px");
					}
					set_important_style(btn, "vertical-align", "top");
					//btn.style.maxWidth = "50%";
					set_important_style(btn, "white-space", "pre-wrap");
					set_important_style(btn, "display", "inline-block");
					if (options.action) {
						set_important_style(btn, "user-select", "none");
					}

					if (typeof options.text === "object" && options.text.link_underline && settings.mouseover_ui_link_underline) {
						set_important_style(btn, "text-decoration", "underline");
					}

					if (typeof options.text === "string") {
						btn.innerText = options.text;
					} else {
						btn.innerText = options.text.truncated;
					}

					if (options.title)
						btn.title = options.title;

					if (options.containers && options.pos) {
						var container = options.containers[options.pos];

						container.appendChild(btn);

						// FIXME: container.clientWidth is 0 until it's visible
						var dimensions = get_popup_dimensions();
						if (container.hasAttribute("data-imu-middle_x")) {
							set_important_style(container, "left", ((dimensions[0] - container.clientWidth) / 2) + "px");
						}

						if (container.hasAttribute("data-imu-middle_y")) {
							set_important_style(container, "top", ((dimensions[1] - container.clientHeight) / 2) + "px");
						}
					}

					return btn;
				}

				var ui_els = [];

				var text_direction = "initial";

				var popup_el_style;
				if (popup_el) {
					popup_el_style = get_computed_style(popup_el);
				} else {
					popup_el_style = get_computed_style(document.body);
				}

				if (popup_el_style && popup_el_style.direction === "rtl") {
					text_direction = "rtl";
				}

				var cached_previmages = 0;
				var cached_nextimages = 0;

				function lraction(isright) {
					trigger_gallery(isright ? 1 : -1, function(changed) {
						if (!changed) {
							create_ui();
						}
					});
				}

				var create_containerel = function(x, y, margin) {
					var topbarel = document_createElement("div");
					set_el_all_initial(topbarel);
					set_important_style(topbarel, "position", "absolute");
					set_important_style(topbarel, "opacity", defaultopacity);
					if (can_use_subzindex)
						set_important_style(topbarel, "z-index", maxzindex - 1);
					set_important_style(topbarel, "white-space", "nowrap");

					// test: https://www.yeshiva.org.il/
					// otherwise, the buttons are in the wrong order
					set_important_style(topbarel, "direction", "ltr");

					var left = null;
					var top = null;
					var bottom = null;
					var right = null;

					if (x === "left") {
						left = "-" + margin;
					} else if (x === "middle") {
						left = "calc(50%)";
						topbarel.setAttribute("data-imu-middle_x", "true");
					} else if (x === "right") {
						right = "-" + margin;
					}

					if (y === "top") {
						top = "-" + margin;
					} else if (y === "middle") {
						// TODO: add buttons vertically, not horizontally
						top = "calc(50%)";
						topbarel.setAttribute("data-imu-middle_y", "true");
					} else if (y === "bottom") {
						bottom = "-" + margin;
					}

					if (left) set_important_style(topbarel, "left", left);
					if (right) set_important_style(topbarel, "right", right);
					if (top) set_important_style(topbarel, "top", top);
					if (bottom) set_important_style(topbarel, "bottom", bottom);

					return topbarel;
				};

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
					var galleryinput_fontsize = "12px";

					var css_fontcheck = "14px " + sans_serif_font;

					var containers = {};

					containers["top-left"] = create_containerel("left", "top", em1);
					containers["top-middle"] = create_containerel("middle", "top", em1);
					containers["top-right"] = create_containerel("right", "top", em1);
					containers["left"] = create_containerel("left", "middle", em1);
					containers["middle"] = create_containerel("middle", "middle", em1);
					containers["right"] = create_containerel("right", "middle", em1);
					containers["bottom-left"] = create_containerel("left", "bottom", em1);
					containers["bottom-middle"] = create_containerel("middle", "bottom", em1);
					containers["bottom-right"] = create_containerel("right", "bottom", em1);

					if (!settings.mouseover_ui) {
						// Not sure why this is needed, but without it, clicking and dragging images doesn't work under Firefox (#78)
						outerdiv.appendChild(containers["top-left"]);
						return;
					}

					for (var pos in containers) {
						opacity_hover(containers[pos]);
						outerdiv.appendChild(containers[pos]);
						ui_els.push(containers[pos]);
					}

					if (settings.mouseover_ui_closebtn) {
						var closebtn = addbtn({
							id: "closebtn",
							// \xD7 = ×
							text: "\xD7",
							title: _("Close") + " (" + _("ESC") + ")",
							action: function() {
								resetpopups();
							},
							pos: "top-left",
							containers: containers
						});
					}

					var get_img_height = function() {
						var rect = img.getBoundingClientRect();
						// This is needed if img isn't displayed yet
						var rect_height = rect.height || imgh;

						if (isNaN(rect_height))
							rect_height = img_naturalHeight;

						return rect_height;
					};


					var prev_images = 0;
					var next_images = 0;

					function get_imagesizezoom_text() {
						var text = "";

						var rect_height = get_img_height();

						var zoom_percent = rect_height / img_naturalHeight;
						var currentzoom = parseInt(zoom_percent * 100);
						var filesize = 0;

						if (newobj && newobj.filesize)
							filesize = newobj.filesize;

						var format = "";

						var formatorder = [
							{
								value: img_naturalWidth + "x" + img_naturalHeight,
								valid: settings.mouseover_ui_imagesize,
							},
							{
								value: currentzoom + "%",
								valid_paren: currentzoom !== 100 ? true : false,
								valid: settings.mouseover_ui_zoomlevel
							},
							{
								value: size_to_text(filesize),
								valid: settings.mouseover_ui_filesize && filesize
							}
						];

						var entries = [];
						for (var i = 0; i < formatorder.length; i++) {
							var our_format = formatorder[i];

							if (!our_format.valid)
								continue;

							if (entries.length > 0 && our_format.valid_paren === false)
								continue;

							entries.push(our_format.value);
						}

						if (entries.length === 0)
							return "";

						text = entries[0];
						if (entries.length > 1) {
							text += " (" + entries.slice(1).join(", ") + ")";
						}

						return text;
					}

					if (settings.mouseover_ui_imagesize || settings.mouseover_ui_zoomlevel || settings.mouseover_ui_filesize) {
						var imagesize = addbtn({
							id: "sizeinfo",
							text: get_imagesizezoom_text(100),
							pos: "top-left",
							containers: containers
						});
						set_important_style(imagesize, "font-size", gallerycount_fontsize);
					}

					var get_imagestotal_text = function() {
						if (prev_images + next_images > settings.mouseover_ui_gallerymax) {
							return settings.mouseover_ui_gallerymax + "+";
						} else {
							return (prev_images + 1) + " / " + (prev_images + next_images + 1);
						}
					};

					var update_imagestotal = function() {
						if (images_total_input_active)
							return;

						if (prev_images + next_images > 0) {
							set_important_style(images_total, "display", "inline-block");
							images_total.innerText = get_imagestotal_text();
						} else {
							set_important_style(images_total, "display", "none");
						}
					};

					var imagestotal_input_enable = function() {
						images_total_input_active = true;
						editing_text = true;
						images_total.innerText = "";

						set_important_style(images_total_input, "display", "initial");
						images_total_input.value = prev_images + 1;
						images_total.setAttribute("data-btn-noaction", true);
						images_total.appendChild(images_total_input);

						// https://stackoverflow.com/a/19498477
						setTimeout(function() {
							images_total_input.select();
							images_total_input.setSelectionRange(0, images_total_input.value.length);
						}, 100);
					};

					var imagestotal_input_disable = function() {
						editing_text = false;
						if (!images_total_input_active)
							return;

						set_important_style(images_total_input, "display", "none");
						images_total.removeChild(images_total_input);
						images_total.removeAttribute("data-btn-noaction");
						images_total_input_active = false;

						update_imagestotal();
					};

					var popup_width = (popupshown && outerdiv.clientWidth) || imgw;

					if (settings.mouseover_enable_gallery && settings.mouseover_ui_gallerycounter) {
						var images_total = addbtn({
							id: "gallerycounter",
							text: get_imagestotal_text(),
							action: imagestotal_input_enable,
							pos: "top-left",
							containers: containers
						});
						set_important_style(images_total, "font-size", gallerycount_fontsize);
						set_important_style(images_total, "display", "none");

						var images_total_input = document_createElement("input");
						var images_total_input_active = false;
						set_el_all_initial(images_total_input);
						set_important_style(images_total_input, "display", "none");
						set_important_style(images_total_input, "background-color", "white");
						set_important_style(images_total_input, "font-family", sans_serif_font);
						set_important_style(images_total_input, "font-size", galleryinput_fontsize);
						set_important_style(images_total_input, "padding", "1px");
						set_important_style(images_total_input, "padding-left", "2px");
						set_important_style(images_total_input, "width", "5em");
						our_addEventListener(images_total_input, "mouseout", imagestotal_input_disable);
						our_addEventListener(images_total_input, "keydown", function(e) {
							if (e.which === 13) { // enter
								var parsednum = images_total_input.value.replace(/\s+/g, "");
								if (/^[0-9]+$/.test(parsednum)) {
									parsednum = parseInt(parsednum);
									trigger_gallery(parsednum - (prev_images + 1));
								}

								imagestotal_input_disable();

								e.stopPropagation();
								e.preventDefault();
								return false;
							}
						}, true);
					}

					if (settings.mouseover_ui_optionsbtn) {
						// \u2699 = ⚙
						var optionsbtn = addbtn({
							id: "optionsbtn",
							text: "\u2699",
							title: _("Options"),
							action: options_page,
							pos: "top-left",
							containers: containers
						});
					}

					if (settings.mouseover_ui_downloadbtn) {
						// \u2193 = ↓
						// \ud83e\udc6b = 🡫
						// \uD83E\uDC47 = 🡇
						var download_glyphs = ["\uD83E\uDC47", "\ud83e\udc6b", "\u2193"];
						var download_glyph = get_safe_glyph(css_fontcheck, download_glyphs);
						var downloadbtn = addbtn({
							id: "downloadbtn",
							text: download_glyph,
							title: _("Download (" + get_trigger_key_text(settings.mouseover_download_key) + ")"),
							action: download_popup_image,
							pos: "top-left",
							containers: containers
						});
					}

					if (settings.mouseover_ui_rotationbtns) {
						var get_rotate_title = function(leftright) {
							return _("rotate_" + leftright + "_btn") + " (" + get_trigger_key_text(settings["mouseover_rotate_" + leftright + "_key"]) + ")";
						};

						// \u21B6 = ↶
						var rotateleftbtn = addbtn({
							id: "rotleftbtn",
							text: "\u21B6",
							title: get_rotate_title("left"),
							action: function() {rotate_gallery(-90)},
							pos: "top-left",
							containers: containers
						});
						// \u21B7 = ↷
						var rotaterightbtn = addbtn({
							id: "rotrightbtn",
							text: "\u21B7",
							title: get_rotate_title("right"),
							action: function() {rotate_gallery(90)},
							pos: "top-left",
							containers: containers
						});
					}

					if (settings.mouseover_ui_caption) {
						var caption = get_caption(newobj, popup_el);
						var caption_link_page = settings.mouseover_ui_caption_link_page && newobj.extra && newobj.extra.page;

						if (!caption && caption_link_page) {
							caption = "(original page)";
						}

						if (caption) {
							var btntext = caption;

							if (settings.mouseover_ui_wrap_caption) {
								// /10 is arbitrary, but seems to work well
								// TODO: make top-left dynamic
								var chars = parseInt(Math_max(10, Math_min(60, (popup_width - containers["top-left"].clientWidth) / 10)));

								btntext = {
									truncated: truncate_with_ellipsis(caption, chars),
									full: caption,
									link_underline: caption_link_page
								};
							}

							var caption_link = null;
							if (caption_link_page) {
								caption_link = newobj.extra.page;
							}

							var caption_btn = addbtn({
								id: "caption",
								text: btntext,
								title: caption,
								action: caption_link,
								pos: "top-left",
								containers: containers
							});
						}
					}

					var add_lrhover = function(isleft, btnel, action, title) {
						if (!settings.mouseover_enable_gallery || popup_width < 200)
							return;

						var img_height = get_img_height();
						var bottom_heights = 0;
						var top_heights = 20;
						if (is_video) {
							bottom_heights = 60;
						}

						if (img_height < 100) {
							top_heights = 0;
						}

						var lrheight = img_height - top_heights - bottom_heights;
						if (lrheight < 10)
							return;

						var lrhover = document_createElement("div");
						set_el_all_initial(lrhover);
						lrhover.title = title;
						if (isleft) {
							lrhover.style.left = "0em";
						} else {
							lrhover.style.right = "0em";
						}

						lrhover.style.top = top_heights + "px";
						lrhover.style.height = lrheight + "px";
						lrhover.style.position = "absolute";
						lrhover.style.width = "15%";
						lrhover.style.maxWidth = "200px";
						//lrhover.style.height = "100%";
						lrhover.style.zIndex = maxzindex - 2;
						lrhover.style.cursor = "pointer";

						opacity_hover(lrhover, btnel, true);
						our_addEventListener(lrhover, "click", function(e) {
							if (dragged) {
								return false;
							}

							estop(e);
							action(e);
							return false;
						}, true);
						outerdiv.appendChild(lrhover);
						ui_els.push(lrhover);
						return lrhover;
					};

					var add_leftright_gallery_button = function(leftright) {
						if (!settings.mouseover_enable_gallery || !settings.mouseover_ui_gallerybtns)
							return;

						var action = function() {
							return lraction(leftright);
						};

						var name = leftright ? "Next" : "Previous";

						// \u2190 = ←
						// \ud83e\udc50 = 🡐
						var left_glyphs = ["\ud83e\udc50", "\u2190"];
						// \u2192 = →
						// \ud83e\udc52 = 🡒
						var right_glyphs = ["\ud83e\udc52", "\u2192"];

						var lr_glyphs = leftright? right_glyphs : left_glyphs;
						var icon = get_safe_glyph(css_fontcheck, lr_glyphs);

						var keybinding = leftright ? settings.mouseover_gallery_next_key : settings.mouseover_gallery_prev_key;
						var keybinding_text = get_trigger_key_text(keybinding);

						var title = _(name) + " (" + _(keybinding_text) + ")";

						var id = "gallery";
						id += leftright ? "next" : "prev";
						id += "btn";

						var btn = addbtn({
							id: id,
							text: icon,
							title: title,
							action: action,
							containers: containers,
							pos: leftright ? "right" : "left"
						});
						/*btn.style.top = "calc(50% - 7px - " + emhalf + ")";
						if (!leftright) {
							btn.style.left = "-" + em1;
						} else {
							btn.style.left = "initial";
							btn.style.right = "-" + em1;
						}*/
						//outerdiv.appendChild(btn);
						//ui_els.push(btn);

						add_lrhover(!leftright, btn, action, title);

						if (settings.mouseover_enable_gallery && settings.mouseover_ui_gallerycounter) {
							if (use_cached_gallery) {
								if (!leftright) {
									prev_images = cached_previmages;
								} else {
									next_images = cached_nextimages;
								}

								update_imagestotal();
							} else {
								count_gallery(leftright, undefined, true, undefined, undefined, function(total) {
									if (!leftright) {
										prev_images = total;
										cached_previmages = prev_images;
									} else {
										next_images = total;
										cached_nextimages = next_images;
									}

									update_imagestotal();
								});
							}
						}
					};

					var add_leftright_gallery_button_if_valid = function(leftright) {
						if (!settings.mouseover_enable_gallery)
							return;

						is_nextprev_valid(leftright, function(valid) {
							if (valid) {
								add_leftright_gallery_button(leftright);
							}
						});
					};

					add_leftright_gallery_button_if_valid(false);
					add_leftright_gallery_button_if_valid(true);
				}

				create_ui();

				fill_obj_filename(newobj, url, data.data.respdata);

				var a = document_createElement("a");
				set_el_all_initial(a);

				if (add_link) {
					a.style.cursor = "pointer";

					//a.addEventListener("click", function(e) {
					a.onclick = function(e) {
						e.stopPropagation();
						e.stopImmediatePropagation();
						return true;
					};
				}

				a.style.setProperty("vertical-align", "bottom", "important");
				a.style.setProperty("display", "block", "important");

				var update_popup_clickthrough = function(clickthrough) {
					var value = "none";
					if (!clickthrough)
						value = "initial";

					set_important_style(a, "pointer-events", value);
					set_important_style(img, "pointer-events", value);
					set_important_style(div, "pointer-events", value);
					set_important_style(outerdiv, "pointer-events", value);
				};

				if (settings.mouseover_clickthrough)
					update_popup_clickthrough(true);

				popup_hold_func = function() {
					if (popup_hold) {
						if (settings.mouseover_hold_unclickthrough) {
							update_popup_clickthrough(false);
						}
					} else {
						if (settings.mouseover_clickthrough) {
							update_popup_clickthrough(true);
						} else {
							update_popup_clickthrough(false);
						}
					}
				};

				if (add_link) {
					a.href = url;

					// set this here instead of outside this block for gelbooru: https://github.com/qsniyg/maxurl/issues/430
					a.target = "_blank";
					if (settings.mouseover_download) {
						if (false) {
							a.href = img.src;

							if (newobj.filename.length > 0) {
								a.setAttribute("download", newobj.filename);
							} else {
								var attr = document.createAttribute("download");
								a.setAttributeNode(attr);
							}
						} else {
							a.href = "#";
							our_addEventListener(a, "click", function(e) {
								download_popup_image();

								e.preventDefault();
								e.stopPropagation();
								return false;
							}, true);
						}
					}
				} else {
					var click_close = false;

					if (!is_video && settings.mouseover_click_image_close) {
						click_close = true;
					} else if (is_video && settings.mouseover_click_video_close) {
						click_close = true;
					}

					if (click_close) {
						our_addEventListener(a, "click", function(e) {
							if (dragged)
								return;

							resetpopups();

							e.preventDefault()
							e.stopPropagation();
							return false;
						});
					}
				}

				a.appendChild(img);
				div.appendChild(a);

				popup_hidecursor_timer = null;
				var orig_a_cursor = a.style.cursor;
				var orig_img_cursor = img.style.cursor;
				popup_hidecursor_func = function(hide) {
					popup_cursorjitterX = mouseX;
					popup_cursorjitterY = mouseY;
					if (settings.mouseover_hide_cursor && hide) {
						a.style.cursor = "none";
						img.style.cursor = "none";
					} else {
						if (popup_hidecursor_timer) {
							clearTimeout(popup_hidecursor_timer);
							popup_hidecursor_timer = null;
						}

						a.style.cursor = orig_a_cursor;
						img.style.cursor = orig_img_cursor;
					}
				};

				popup_cursorjitterX = Infinity;
				popup_cursorjitterY = Infinity;

				if (settings.mouseover_hide_cursor && settings.mouseover_hide_cursor_after <= 0) {
					popup_hidecursor_func(true);
				}

				div.onmouseover = div.onmousemove = function(e) {
					if ((Math_abs(mouseX - popup_cursorjitterX) < settings.mouseover_mouse_inactivity_jitter) &&
						(Math_abs(mouseY - popup_cursorjitterY) < settings.mouseover_mouse_inactivity_jitter)) {
						return;
					}

					if (settings.mouseover_hide_cursor_after > 0 || !settings.mouseover_hide_cursor) {
						popup_hidecursor_func(false);

						if (settings.mouseover_hide_cursor) {
							popup_hidecursor_timer = setTimeout(function() {
								popup_hidecursor_func(true);
							}, settings.mouseover_hide_cursor_after);
						}
					}
				};

				function startdrag(e) {
					dragstart = true;
					dragged = false;
					dragstartX = e.clientX;
					dragstartY = e.clientY;
					dragoffsetX = dragstartX - parseFloat(outerdiv.style.left);
					dragoffsetY = dragstartY - parseFloat(outerdiv.style.top);
				}

				// TODO: allow this to be live-reloaded
				if (get_single_setting("mouseover_pan_behavior") === "drag") {
					if (is_video) {
						img.onseeking = function(e) {
							seekstart = true;
						};

						img.onseeked = function(e) {
							seekstart = false;
						};
					}

					div.ondragstart = a.ondragstart = img.ondragstart = function(e) {
						if (seekstart)
							return;

						//dragstart = true;
						//dragged = false;
						startdrag(e);
						//e.stopPropagation();
						estop(e);
						return false;
					};

					//div.ondrop = estop;

					div.onmousedown = div.onpointerdown = a.onmousedown = a.onpointerdown = function(e) {
						//console_log("(div,a).mousedown", e);
						if (btndown || e.button !== 0 || seekstart)
							return;

						//dragstart = true;
						//dragged = false;
						startdrag(e);

						e.preventDefault();
						estop(e);
						return false;
					};

					img.onmousedown = img.onpointerdown = function(e) {
						//console_log("img.onmousedown", e);
						if (btndown || e.button !== 0 || seekstart)
							return;

						//dragstart = true;
						//dragged = false;
						startdrag(e);

						estop(e);
						return true;
					};

					a.onclick = function(e) {
						//console_log("a.onclick", e);
						dragstart = false;

						if (dragged) {
							estop(e);
							dragged = false;
							return false;
						}

						e.stopPropagation();
						e.stopImmediatePropagation();
						return true;
					};

					div.onmouseup = div.onpointerup = div.onclick = a.onmouseup = a.onpointerup = /*a.onclick =*/ function(e) {
						//console_log("(div,a).mouseup", e);
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

					img.onmouseup = img.onpointerup = img.onclick = function(e) {
						//console_log("img.mouseup", e);
						dragstart = false;
						//estop(e);
						return true;
					};

					if (is_video && !settings.mouseover_video_controls) {
						img.onclick = function(e) {
							if (!dragged) {
								if (!img.paused) {
									img.pause();
								} else {
									img.play();
								}
							}

							//console_log("img.mouseup", e);
							dragstart = false;
							//estop(e);
							return true;
						};
					}
				}

				var currentmode = initial_zoom_behavior;
				if (currentmode === "fill")
					currentmode = "fit";

				popup_zoom_func = function(zoom_mode, zoomdir, x, y, zoom_out_to_close) {
					var changed = false;

					var popup_left = parseFloat(outerdiv.style.left);
					var popup_top = parseFloat(outerdiv.style.top);

					var popup_width = outerdiv.clientWidth;
					var popup_height = outerdiv.clientHeight;

					if (x === undefined && y === undefined) {
						// TODO: if mouse is within the popup, use the mouse's coordinates instead
						//   This will have to check the zoom_origin setting.
						//x = mouseAbsX;
						//y = mouseAbsY;

						var visible_left = Math_max(popup_left, 0);
						var visible_top = Math_max(popup_top, 0);

						var visible_right = Math_min(visible_left + popup_width, vw);
						var visible_bottom = Math_min(visible_top + popup_height, vh);

						// get the middle of the visible portion of the popup
						x = visible_left + (visible_right - visible_left) / 2;
						y = visible_top + (visible_bottom - visible_top) / 2;
					} else {
						// ensure it's clamped, e.g. when scrolling on the document instead of the popup
						if (x < popup_left)
							x = popup_left;
						else if (x > popup_left + popup_width)
							x = popup_left + popup_width;

						if (y < popup_top)
							y = popup_top;
						else if (y > popup_top + popup_height)
							y = popup_top + popup_height;
					}

					var offsetX = x - popup_left;
					var offsetY = y - popup_top;

					var percentX = offsetX / outerdiv.clientWidth;
					var percentY = offsetY / outerdiv.clientHeight;

					if (zoom_mode === "fitfull") {
						if (zoom_out_to_close && currentmode === "fit" && zoomdir > 0) {
							resetpopups();
							return false;
						}

						if (zoomdir > 0 && currentmode !== "fit") {
							update_vwh();

							imgh = img_naturalHeight;
							imgw = img_naturalWidth;
							calc_imghw_for_fit();

							var oldwidth = parseFloat(img.style.width);
							var oldheight = parseFloat(img.style.height);

							set_popup_width(imgw, vw);
							set_popup_height(imgh, vh);

							if (zoom_out_to_close && parseFloat(img.style.width) === oldwidth && parseFloat(img.style.height) === oldheight) {
								resetpopups();
								return false;
							}

							currentmode = "fit";
							changed = true;
						} else if (zoomdir < 0 && currentmode !== "full") {
							set_popup_width(img_naturalWidth, "initial");
							set_popup_height(img_naturalHeight, "initial");

							currentmode = "full";
							changed = true;
						}
					} else if (zoom_mode === "incremental") {
						var imgwidth = img.clientWidth;
						var imgheight = img.clientHeight;

						var mult = 1;
						if (imgwidth < img_naturalWidth) {
							mult = img_naturalWidth / imgwidth;
						} else {
							mult = imgwidth / img_naturalWidth;
						}

						var increment = settings.scroll_incremental_mult - 1;

						mult = Math_round(mult / increment);
						mult *= increment;

						if (imgwidth < img_naturalWidth) {
							if (mult !== 0)
								mult = 1 / mult;
						}

						if (zoomdir > 0) {
							mult /= 1 + increment;
						} else {
							mult *= 1 + increment;
						}

						imgwidth = img_naturalWidth * mult;
						imgheight = img_naturalHeight * mult;

						var too_small = zoomdir > 0 && (imgwidth < 64 || imgheight < 64);
						var too_big = zoomdir < 0 && (imgwidth > img_naturalWidth * 512 || imgheight > img_naturalHeight * 512);

						if (too_small || too_big) {
							if (zoom_out_to_close && too_small)
								resetpopups();
							return false;
						}

						set_popup_width(imgwidth);
						set_popup_height(imgheight);
						changed = true;
					}

					if (!changed)
						return false;

					var imgwidth = outerdiv.clientWidth;
					var imgheight = outerdiv.clientHeight;

					var newx, newy;

					if (true || (imgwidth <= vw && imgheight <= vh) || zoom_mode === "incremental") {
						// centers wanted region to pointer
						newx = (x - percentX * imgwidth);
						newy = (y - percentY * imgheight);
					} else if (imgwidth > vw || imgheight > vh) {
						// centers wanted region to center of screen
						newx = (vw / 2) - percentX * imgwidth;
						var endx = newx + imgwidth;
						if (newx > border_thresh && endx > (vw - border_thresh))
							newx = Math_max(border_thresh, (vw + border_thresh) - imgwidth);

						if (newx < border_thresh && endx < (vw - border_thresh))
							newx = Math_min(border_thresh, (vw + border_thresh) - imgwidth);

						newy = (vh / 2) - percentY * imgheight;
						var endy = newy + imgheight;
						if (newy > border_thresh && endy > (vh - border_thresh))
							newy = Math_max(border_thresh, (vh + border_thresh) - imgheight);

						if (newy < border_thresh && endy < (vh - border_thresh))
							newy = Math_min(border_thresh, (vh + border_thresh) - imgheight);
					}

					if (imgwidth <= vw && imgheight <= vh) {
						newx = Math_max(newx, border_thresh);
						if (newx + imgwidth > (vw - border_thresh)) {
							newx = (vw + border_thresh) - imgwidth;
						}

						newy = Math_max(newy, border_thresh);
						if (newy + imgheight > (vh - border_thresh)) {
							newy = (vh + border_thresh) - imgheight;
						}
					}

					//var lefttop = get_lefttopouter();
					outerdiv.style.left = (newx/* - lefttop[0]*/) + "px";
					outerdiv.style.top = (newy/* - lefttop[1]*/) + "px";

					create_ui(true);

					// The mouse could accidentally land outside the image in theory
					mouse_in_image_yet = false;

					return false;
				};

				outerdiv.onwheel = popup_wheel_cb = function(e, is_document) {
					var handledx = false;
					var handledy = false;

					var handle_seek = function(xy) {
						var isright = false;

						if (xy) {
							if (e.deltaX < 0)
								isright = false;
							else if (e.deltaX > 0)
								isright = true;
							else return;
						} else {
							if (e.deltaY < 0)
								isright = false;
							else if (e.deltaY > 0)
								isright = true;
							else return;

							if (settings.mouseover_scrolly_video_invert)
								isright = !isright;
						}

						seek_popup_video(!isright);
						estop_pd(e);
						return true;
					};

					var actionx = true;
					var actiony = true;

					if (is_video) {
						var video_scrollx = get_single_setting("mouseover_scrollx_video_behavior");
						var video_scrolly = get_single_setting("mouseover_scrolly_video_behavior");

						if (!handledx && video_scrollx !== "default") {
							if (video_scrollx === "seek") {
								if (handle_seek(true)) {
									handledx = true;
								}
							} else if (video_scrollx === "nothing") {
								actionx = false;
							}
						}

						if (!handledy && video_scrolly !== "default") {
							if (video_scrolly === "seek") {
								if (handle_seek(false)) {
									handledy = true;
								}
							} else if (video_scrollx === "nothing") {
								actiony = false;
							}
						}
					}

					var scrollx_behavior = get_single_setting("mouseover_scrollx_behavior");
					var scrolly_behavior = get_single_setting("mouseover_scrolly_behavior");

					var handle_gallery = function(xy) {
						if (!settings.mouseover_enable_gallery)
							return;

						var isright = false;

						if (xy) {
							if (e.deltaX < 0)
								isright = false;
							else if (e.deltaX > 0)
								isright = true;
							else return;
						} else {
							if (e.deltaY < 0)
								isright = false;
							else if (e.deltaY > 0)
								isright = true;
							else return;
						}

						lraction(isright);
						estop_pd(e);
						return true;
					};

					if (actionx && !handledx) {
						if (scrollx_behavior === "pan") {
							outerdiv.style.left = (parseInt(outerdiv.style.left) + e.deltaX) + "px";
							handledx = true;
						} else if (scrollx_behavior === "gallery") {
							if (handle_gallery(true)) {
								return;
							}

							handledx = true;
						}
					}

					if (actiony && !handledy) {
						if (scrolly_behavior === "pan") {
							outerdiv.style.top = (parseInt(outerdiv.style.top) + e.deltaY) + "px";
							handledy = true;
						} else if (scrolly_behavior === "gallery") {
							if (handle_gallery(false)) {
								return;
							}

							handledy = true;
						}
					}

					if (handledy) {
						estop_pd(e);
						return false;
					}

					if (!actiony || scrolly_behavior !== "zoom" || e.deltaY === 0) {
						return;
					}

					estop_pd(e);

					var cursor_x = e.clientX;
					var cursor_y = e.clientY;
					if (get_single_setting("scroll_zoom_origin") === "center") {
						cursor_x = undefined;
						cursor_y = undefined;
					}

					var zoom_mode = get_single_setting("scroll_zoom_behavior");
					if (popup_zoom_func(zoom_mode, e.deltaY, cursor_x, cursor_y, settings.zoom_out_to_close) === false)
						return false;
				};

				if (mask_el) {
					document.documentElement.appendChild(mask_el);
				}

				document.documentElement.appendChild(outerdiv);

				removepopups();

				check_image_ref(img);

				// even if autoplay is enabled, if the element is cached, it won't play automatically
				if (is_video) {
					img.play();
				}

				popups.push(outerdiv);
				popupshown = true;

				if (data.data.respdata && data.data.respdata.responseHeaders) {
					var parsed_headers = headers_list_to_dict(parse_headers(data.data.respdata.responseHeaders));
					if ("content-length" in parsed_headers) {
						popup_contentlength = parseInt(parsed_headers["content-length"]) || 0;
					}
				}

				//can_close_popup = [false, false];
				// don't set [0] to false, in case "Keep popup open until" == Any/All and keys are released before popup opens
				can_close_popup[1] = false;

				// don't unhold if in gallery
				if (!popup_el_automatic)
					popup_hold = false;

				mouse_in_image_yet = false;
				delay_handle_triggering = false;

				// causes issues with "Don't close until mouse leaves" if the mouse doesn't move
				if (false && popup_trigger_reason !== "mouse") {
					can_close_popup[1] = true;
				}

				setTimeout(function() {
					dont_wait_anymore();
				}, 1);

				popups_active = true;
				//console_log(div);

				add_resetpopup_timeout();
			}

			cb(data.data.img, data.data.newurl, obj);
		}

		var getunit_el = null;
		var getunit_cache = new Cache();
		// getUnit is really slow, e.g. on forbiddenplanet.com (max-width: 39em)
		function getUnit(unit) {
			if (unit.match(/^ *([0-9]+)px *$/)) {
				return unit.replace(/^ *([0-9]+)px *$/, "$1");
			}

			if (getunit_cache.has(unit)) {
				return getunit_cache.get(unit);
			}

			// https://github.com/tysonmatanich/getEmPixels/blob/master/getEmPixels.js
			var important = "!important;";
			var style = "position:absolute!important;visibility:hidden!important;width:" + unit + "!important;font-size:" + unit + "!important;padding:0!important";

			var extraBody;

			var unitel = document.body;
			if (!unitel) {
				// Emulate the documentElement to get rem value (documentElement does not work in IE6-7)
				unitel = extraBody = document_createElement("body");
				extraBody.style.cssText = "font-size:" + unit + "!important;";
				document.documentElement.insertBefore(extraBody, document.body);
			}

			// Create and style a test element
			if (!getunit_el) {
				getunit_el = document_createElement("i");
				set_el_all_initial(getunit_el);
				set_important_style(getunit_el, "position", "absolute");
				set_important_style(getunit_el, "visibility", "hidden");
				set_important_style(getunit_el, "padding", "0");
			}

			set_important_style(getunit_el, "width", unit);
			set_important_style(getunit_el, "font-size", unit);
			//getunit_el.style.cssText = style;
			unitel.appendChild(getunit_el);

			// Get the client width of the test element
			var value = getunit_el.clientWidth;
			getunit_cache.set(unit, value, 5*60);

			if (extraBody) {
				// Remove the extra body element
				document.documentElement.removeChild(extraBody);
			}
			else {
				// Remove the test element
				unitel.removeChild(getunit_el);
			}

			// Return the em value in pixels
			return value;
		}

		function valid_source(source) {
			var thresh = 20;

			if (source.tagName !== "PICTURE" &&
				source.tagName !== "VIDEO" &&
				source.tagName !== "IMG" &&
				source.tagName !== "SOURCE") {
				var style = get_computed_style(source);
				if (style.getPropertyValue("background-image")) {
					var bgimg = style.getPropertyValue("background-image");
					if (!bgimg.match(/^(.*?\)\s*,)?\s*url[(]/)) {
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

		var recalculate_rect = function(rect) {
			rect.left = rect.x;
			rect.top = rect.y;
			rect.right = rect.left + rect.width;
			rect.bottom = rect.top + rect.height;

			return rect;
		};

		var copy_rect = function(rect) {
			// simplified copy, need to use recalculate_rect after
			return {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height
			};
		};

		var parse_zoom = function(zoom) {
			if (typeof zoom === "number")
				return zoom;

			var match = zoom.match(/^([-0-9.]+)%$/);
			if (match)
				return parseFloat(match[1]) / 100.;

			match = zoom.match(/^([-0-9.]+)$/);
			if (match) {
				return parseFloat(match[1]);
			}

			return null;
		};

		function get_bounding_client_rect_inner(el, mapcache, need_rect) {
			// test: https://4seasonstaeyeon.tumblr.com/post/190710743124 (bottom images)
			if (!el)
				return null;

			if (mapcache && mapcache.has(el)) {
				var value = mapcache.get(el);

				if (need_rect) {
					if (value.orig_rect)
						return value;
				} else {
					return value;
				}
			}

			var parent = {};
			var parentel = el.parentElement;
			if (parentel) {
				parent = get_bounding_client_rect_inner(parentel, mapcache, false);
			}

			var orig_rect = null;
			if (need_rect)
				orig_rect = el.getBoundingClientRect();

			var rect = null;
			var zoom = 1;

			//var computed_style = get_computed_style(el);
			// computed_style is slow, and also might not be what we're looking for, as it might contain the parent's zoom
			// this is still very slow though (50ms on facebook)
			// https://thisistian.github.io/publication/real-time-subsurface-with-adaptive-sampling/
			// math tags don't have style
			if ("style" in el && el.style.zoom) {
				zoom = parse_zoom(el.style.zoom);
				if (zoom && zoom !== 1) {
					if (!orig_rect)
						orig_rect = el.getBoundingClientRect();

					rect = copy_rect(orig_rect);

					rect.width *= zoom;
					rect.height *= zoom;
				}
			}

			if (parent.zoom && parent.zoom !== 1) {
				if (!orig_rect)
					orig_rect = el.getBoundingClientRect();

				if (!rect)
					rect = copy_rect(orig_rect);

				rect.x *= parent.zoom;
				rect.y *= parent.zoom;
				rect.width *= parent.zoom;
				rect.height *= parent.zoom;

				zoom *= parent.zoom;
				//console.log(el, zoom, deepcopy(rect));
			}

			// this is surprisingly slow, so rect is optimized out if possible
			if (false && parent.rect && parent.orig_rect) {
				if (!orig_rect)
					orig_rect = el.getBoundingClientRect();

				if (!rect)
					rect = copy_rect(orig_rect);

				rect.x += parent.rect.x - parent.orig_rect.x;
				rect.y += parent.rect.y - parent.orig_rect.y;
			}

			if (rect)
				recalculate_rect(rect);

			var result = {
				zoom: zoom
			};

			if (orig_rect)
				result.orig_rect = orig_rect

			if (rect)
				result.rect = rect;

			if (mapcache) {
				mapcache.set(el, result);
			}

			return result;
		}

		function get_bounding_client_rect(el, mapcache) {
			var obj = get_bounding_client_rect_inner(el, mapcache, true);
			return obj.rect || obj.orig_rect;
		}

		function get_popup_client_rect() {
			if (!popups || !popups[0])
				return null;

			var current_date = Date.now();
			if (!popup_client_rect_cache || (current_date - last_popup_client_rect_cache) > 50) {
				popup_client_rect_cache = get_bounding_client_rect(popups[0]);
				last_popup_client_rect_cache = current_date;
			}

			return popup_client_rect_cache;
		};

		function get_popup_media_client_rect() {
			if (!popups || !popups[0])
				return null;

			var img = get_popup_media_el();
			if (!img)
				return null;

			var current_date = Date.now();
			if (!popup_media_client_rect_cache || (current_date - last_popup_media_client_rect_cache) > 30) {
				popup_media_client_rect_cache = img.getBoundingClientRect();
				last_popup_media_client_rect_cache = current_date;
			}

			return popup_media_client_rect_cache;
		};

		function is_popup_el(el) {
			var current = el;
			do {
				if (array_indexof(popups, current) >= 0) {
					//console_error("Trying to find popup");
					return true;
				}
			} while ((current = current.parentElement))

			return false;
		}

		var get_svg_src = function(el) {
			var remove_attributes = [
				"class",
				"id",
				"tabindex",
				"style"
			];

			var newel = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			newel.innerHTML = el.innerHTML;

			newel.setAttribute("xmlns", "http://www.w3.org/2000/svg");

			var attrs = el.attributes;
			for (var i = 0; i < attrs.length; i++) {
				var attr_name = attrs[i].name;

				if (array_indexof(remove_attributes, attr_name) >= 0 || /^on/.test(attr_name) || /^aria-/.test(attr_name)) {
					continue;
				}

				newel.setAttribute(attr_name, attrs[i].value);
			}


			var computed_style = get_computed_style(el);
			var fillval = el.getAttribute("fill") || computed_style.fill;
			if (fillval) {
				newel.setAttribute("fill", fillval);
			}

			//var header = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n';
			var header = ""; // unneeded
			var svgdoc = header + newel.outerHTML;

			// thanks to Rnksts on discord for these test images (base64 encode didn't work for unicode characters)
			// https://codepen.io/Rnksts/full/KKdJWvq
			return "data:image/svg+xml," + encodeURIComponent(svgdoc);
		};

		function is_valid_src(src, isvideo) {
			return src && (!(/^blob:/.test(src)) || !isvideo);
		}

		function find_source(els) {
			//console_log(els);
			var ok_els = [];
			var result = _find_source(els, ok_els);

			nir_debug("find_source", "find_source: result =", result, "ok_els =", ok_els);

			if (!result)
				return result;

			var ret_bad = function() {
				if (ok_els.length > 0)
					return ok_els[0];
				return null;
			};

			if (result.el) {
				if (is_popup_el(result.el)) {
					nir_debug("find_source", "find_source: result.el is popup el", result.el);
					return ret_bad();
				}
			}

			if (!result.is_ok_el && !is_valid_src(result.src, is_video_el(result.el))) {
				nir_debug("find_source", "find_source: invalid src", result);
				return ret_bad();
			}

			var thresh = parseInt(settings.mouseover_minimum_size);
			// if it can be imu'd, ignore the treshold because the image could be any size
			if (isNaN(thresh) || result.imu)
				thresh = 0;

			if ((!isNaN(result.width) && result.width > 0 && result.width < thresh) ||
				(!isNaN(result.height) && result.height > 0 && result.height < thresh)) {
				nir_debug("find_source", "find_source: result size is too small");

				return ret_bad();
			}

			return result;
		}

		function _find_source(els, ok_els) {
			// resetpopups() is already called in trigger_popup()
			/*if (popups_active)
				return;*/

			nir_debug("find_source", "_find_source (els)", els);

			var sources = {};
			//var picture_sources = {};
			var links = {};
			var layers = [];

			var id = 0;

			var thresh = parseInt(settings.mouseover_minimum_size);
			if (isNaN(thresh))
				thresh = 0;

			var helpers = do_get_helpers({});

			var source;

			function check_visible(el) {
				do {
					if (!el)
						break;

					var style = get_computed_style(el);
					if (!style)
						break;

					if (style.opacity.toString().match(/^0(?:\.0*)?$/))
						return false;
					if (style.visibility === "hidden")
						return false;
				} while (el = el.parentElement);

				return true;
			}

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
				return urljoin(window.location.href, src, true);
			}

			function imu_check(src, el) {
				var result = bigimage_recursive(src, {
					fill_object: true,
					use_cache: "read",
					do_request: null,
					document: document,
					window: get_window(),
					host_url: window.location.href,
					element: el,
					include_pastobjs: true,
					iterations: 2,
					cb: null
				});

				var newurl = src;

				for (var i = 0; i < result.length; i++) {
					if (result[i].url !== src) {
						if (newurl === src)
							newurl = result[i].url;

						continue;
					}

					if (result[i].bad)
						return false;

					// if result.length > 1, then it can be imu'd
					if (result.length > 1) {
						return newurl || true;
					} else {
						return undefined;
					}
				}

				return newurl || true;
			}

			function addImage(src, el, options) {
				nir_debug("find_source", "_find_source (addImage)", src, el, check_visible(el), options);

				if (!is_valid_resource_url(src))
					return false;

				if (src && settings.mouseover_apply_blacklist && !bigimage_filter(src)) {
					nir_debug("find_source", "blacklisted");
					return false;
				}

				if (!(src in sources)) {
					sources[src] = {
						count: 0,
						src: src,
						el: el,
						id: id++,
					};
				}

				// blank images
				// https://www.harpersbazaar.com/celebrity/red-carpet-dresses/g7565/selena-gomez-style-transformation/?slide=2
				var el_style = null;
				if (el) {
					el_style = window.getComputedStyle(el) || el.style;
				}

				if (!options) {
					options = {};
				}

				if (options.isbg && settings.mouseover_exclude_backgroundimages) {
					return false;
				}

				var imucheck = imu_check(src, el);
				if (imucheck === false) {
					nir_debug("find_source", "Bad image", el);
					return false;
				}

				if (!("imu" in sources[src])) {
					sources[src].imu = !!imucheck;
				}

				if (imucheck === true) {
					// do this after imu_check, for lazy loaded images that have 1x1 images
					if (src && (src.match(/^data:/) && !(/^data:image\/svg\+xml;/.test(src)) && src.length <= 500)) {
						nir_debug("find_source", "Tiny data: image", el, src);
						return false;
					}
				}

				// https://www.smugmug.com/
				// https://www.vogue.com/article/lady-gaga-met-gala-2019-entrance-behind-the-scenes-video
				// https://www.pinterest.com/
				if (!check_visible(el)) {
					nir_debug("find_source", "Invisible: image", el);
					return false;
				}

				if (settings.mouseover_only_links) {
					if (!el)
						return false;

					var has_link = false;
					var current = el;
					do {
						if (get_tagname(current) === "A") {
							has_link = true;
							break;
						}
					} while (current = current.parentElement);

					if (!has_link)
						return false;
				}

				if ("layer" in options) {
					if (!(options.layer in layers)) {
						layers[options.layer] = [];
					}

					layers[options.layer].push(src);
				}

				sources[src].count++;

				return true;
			}

			function addTagElement(el, layer) {
				if (helpers && helpers.element_ok) {
					var element_ok_result = helpers.element_ok(el);
					var ok_el_obj = {
						count: 1,
						src: null,
						el: el,
						id: id++,
						is_ok_el: true
					};

					if (element_ok_result === true) {
						ok_els.push(ok_el_obj);
					} else {
						if (is_element(element_ok_result)) {
							ok_el_obj.el = element_ok_result;
							ok_els.push(ok_el_obj);

							el = element_ok_result;
						}
					}
				}

				var el_tagname = get_tagname(el);
				if (el_tagname === "PICTURE" || el_tagname === "VIDEO") {
					for (var i = 0; i < el.children.length; i++) {
						addElement(el.children[i], layer);
					}
				}

				if (el_tagname === "SOURCE" || el_tagname === "IMG" || el_tagname === "IMAGE" || el_tagname === "VIDEO" ||
					(settings.mouseover_allow_canvas_el && el_tagname === "CANVAS") ||
					(settings.mouseover_allow_svg_el && el_tagname === "SVG")) {

					if (settings.mouseover_exclude_imagemaps && el_tagname === "IMG" && el.hasAttribute("usemap")) {
						var mapel = document.querySelector("map[name=\"" + el.getAttribute("usemap").replace(/^#/, "") + "\"]");
						if (mapel) {
							nir_debug("find_source", "_find_source skipping", el, "due to image map", mapel);
							return;
						}
					}

					var el_src = get_img_src(el);

					if (el_src) {
						var src = norm(el_src);

						addImage(src, el, { layer: layer });

						if (!el.srcset && src in sources) {
							var dimensions = get_el_dimensions(el);
							sources[src].width = dimensions[0];
							sources[src].height = dimensions[1];
						}
					}

					if (!el.srcset)
						return;

					var ssources = [];
					var srcset = el.srcset;

					// https://www.erinyamagata.com/art-direction/kiernan-shipka
					// https://format-com-cld-res.cloudinary.com/image/private/s--hNRUHHWH--/c_crop,h_1596,w_1249,x_0,y_0/c_fill,g_center,w_2500/fl_keep_iptc.progressive,q_95/v1/986aaf7dd74bd5041ddfc495c430bf0d/KShipkaR29MW_FULL_3468.jpg?2500 2500w 3194h, https://format-com-cld-res.cloudinary.com/image/private/s--VSup0NR3--/c_crop,h_1596,w_1249,x_0,y_0/c_fill,g_center,w_900/fl_keep_iptc.progressive,q_95/v1/986aaf7dd74bd5041ddfc495c430bf0d/KShipkaR29MW_FULL_3468.jpg?900 900w 1150h
					// newlines: https://www.rt.com/russia/447357-miss-moscow-2018-photos/
					//
					// https://cdni.rt.com/files/2018.12/xxs/5c221e1ffc7e9397018b4600.jpg 280w,
					// https://cdni.rt.com/files/2018.12/xs/5c221e1ffc7e9397018b4601.jpg 320w,
					// https://cdni.rt.com/files/2018.12/thumbnail/5c221e1ffc7e9397018b45ff.jpg 460w,
					// https://cdni.rt.com/files/2018.12/m/5c221e1ffc7e9397018b4602.jpg 540w,
					// https://cdni.rt.com/files/2018.12/l/5c221e1ffc7e9397018b4603.jpg 768w,
					// https://cdni.rt.com/files/2018.12/article/5c221e1ffc7e9397018b45fe.jpg 980w,
					// https://cdni.rt.com/files/2018.12/xxl/5c221e20fc7e9397018b4604.jpg 1240w
					while (srcset.length > 0) {
						var old_srcset = srcset;
						srcset = srcset.replace(/^\s+/, "");
						var match = srcset.match(/^(\S+(?:\s+[^,]+)?)(?:,[\s\S]*)?\s*$/);
						if (match) {
							ssources.push(match[1].replace(/\s*$/, ""));
							srcset = srcset.substr(match[1].length);
						}

						srcset = srcset.replace(/^\s*,/, "");
						if (srcset === old_srcset)
							break;
					}
					//var ssources = el.srcset.split(/ +[^ ,/],/);

					var sizes = [];
					if (el.sizes) {
						sizes = el.sizes.split(",");
					}

					// https://www.gamestar.de/artikel/red-dead-redemption-2-pc-vorabversion-mit-limit-bei-120-fps-directx-12-und-vulkan,3350718.html
					// sidebar articles: //8images.cgames.de/images/gamestar/256/red-dead-redemption-2_6062507.jpg, //8images.cgames.de/images/gamestar/210/red-dead-redemption-2_6062507.jpg 2x
					for (var i = 0; i < ssources.length; i++) {
						var src = norm(ssources[i].replace(/^(\S+)(?:\s+[\s\S]+)?\s*$/, "$1"));
						var desc = ssources[i].slice(src.length).replace(/^\s*([\s\S]*?)\s*$/, "$1");

						if (!addImage(src, el, {layer:layer}))
							continue;

						//picture_sources[src] = sources[src];

						sources[src].picture = el.parentElement;

						if (desc) {
							sources[src].desc = desc;

							// https://format-com-cld-res.cloudinary.com/image/pr…dc82/004_003_03-000083520001.jpg?2500 2500w 1831h
							while (desc.length > 0) {
								desc = desc.replace(/^\s+/, "");
								var whxmatch = desc.match(/^([0-9.]+)([whx])(?:\s+[0-9.]+[\s\S]*)?\s*$/);
								if (whxmatch) {
									var number = parseFloat(whxmatch[1]);

									if (number > 0) {
										// if width/height/desc_x > number, then number is probably more accurate (multiple els, see rt link above)
										if (whxmatch[2] === "w" && (!sources[src].width || sources[src].width > number))
											sources[src].width = number;
										else if (whxmatch[2] === "h" && (!sources[src].height || sources[src].height > number))
											sources[src].height = number;
										else if (whxmatch[2] === "x" && (!sources[src].desc_x || sources[src].desc_x > number))
											sources[src].desc_x = number;
									}

									desc = desc.substr(whxmatch[1].length + whxmatch[2].length);
								} else {
									break;
								}
							}
						}

						if (el.media) {
							sources[src].media = el.media;
							if (el.media.match(/min-width:\s*([0-9]+)/)) {
								picture_minw = true;
								var minWidth = getUnit(el.media.replace(/.*min-width:\s*([0-9.a-z]+).*/, "$1"));
								if (!sources[src].minWidth || sources[src].minWidth > minWidth)
									sources[src].minWidth = minWidth;
							}

							if (el.media.match(/max-width:\s*([0-9]+)/)) {
								picture_maxw = true;
								var maxWidth = getUnit(el.media.replace(/.*max-width:\s*([0-9.a-z]+).*/, "$1"));
								if (!sources[src].maxWidth || sources[src].maxWidth > maxWidth)
									sources[src].maxWidth = maxWidth;
							}

							if (el.media.match(/min-height:\s*([0-9]+)/)) {
								picture_minh = true;
								var minHeight = getUnit(el.media.replace(/.*min-height:\s*([0-9.a-z]+).*/, "$1"));
								if (!sources[src].minHeight || sources[src].minHeight > minHeight)
									sources[src].minHeight = minHeight;
							}

							if (el.media.match(/max-height:\s*([0-9]+)/)) {
								picture_maxh = true;
								var maxHeight = getUnit(el.media.replace(/.*max-height:\s*([0-9.a-z]+).*/, "$1"));
								if (!sources[src].maxHeight || sources[src].maxHeight > maxHeight)
									sources[src].maxHeight = maxHeight;
							}
						}
					}
				}

				if (el_tagname === "A" || (settings.mouseover_allow_iframe_el && el_tagname === "IFRAME")) {
					var src = get_img_src(el);
					links[src] = {
						count: 1,
						src: src,
						el: el,
						id: id++
					};
				}
			}

			function _tokenize_css_value(str) {
				var tokensets = [];
				var tokens = [];

				var current_token = "";
				var quote = null;
				var escaping = false;
				for (var i = 0; i < str.length; i++) {
					var char = str[i];

					if (escaping) {
						current_token += char;
						escaping = false;
						continue;
					}

					if (quote) {
						if (char === quote) {
							quote = null;

							tokens.push(current_token);
							current_token = "";
						} else {
							current_token += char;
						}

						continue;
					}

					if (/\s/.test(char)) {
						if (current_token.length > 0) {
							tokens.push(current_token);
							current_token = "";
						}

						continue;
					} else if (char === '\\') {
						escaping = true;
						continue;
					} else if (char === '"' || char === "'") {
						quote = char;
						continue;
					} else if (char === '(') {
						var subtokens = _tokenize_css_value(str.substr(i + 1));
						tokens.push({name: current_token, tokens: subtokens[0]});
						i += subtokens[1];
						current_token = "";
						continue;
					} else if (char === ')') {
						i++;
						break;
					} else if (char === ',') {
						if (current_token)
							tokens.push(current_token);

						tokensets.push(tokens);

						tokens = [];
						current_token = "";
						continue;
					}

					current_token += char;
				}

				if (current_token)
					tokens.push(current_token);

				if (tokens)
					tokensets.push(tokens);

				return [tokensets, i];
			}

			function has_bgimage_url(tokenized) {
				for (var i = 0; i < tokenized.length; i++) {
					if (tokenized[i].length < 1)
						continue;

					if (typeof tokenized[i][0] !== "object")
						continue;

					var our_func = tokenized[i][0];

					var funcname = our_func.name;

					// TODO: support image() and cross-fade()
					var allowed = [
						"url",
						"-webkit-image-set",
						"image-set"
					];

					if (array_indexof(allowed, funcname) < 0)
						continue;

					if (funcname === "url") {
						if (our_func.tokens.length >= 1 && our_func.tokens[0].length > 0 && our_func.tokens[0][0].length > 0)
							return true;
					} else {
						if (has_bgimage_url(our_func.tokens))
							return true;
					}
				}

				return false;
			}

			function get_urlfunc_url(func) {
				if (typeof func !== "object")
					return null;;

				if (func.name !== "url")
					return null;

				if (func.tokens.length < 1 || func.tokens[0].length < 1 || func.tokens[0][0].length === 0)
					return null;

				return func.tokens[0][0];
			}

			function get_imageset_urls(func) {
				var urls = [];
				for (var i = 0; i < func.tokens.length; i++) {
					if (func.tokens[i].length < 1) {
						continue;
					}

					var url = get_urlfunc_url(func.tokens[i][0]);
					if (!url)
						continue;

					var source = {
						src: url
					};

					for (var j = 1; j < func.tokens[i].length; j++) {
						var desc = func.tokens[i][j];
						var whxmatch = desc.match(/^([0-9.]+)(x|dp(?:px|i|cm))$/);

						if (whxmatch) {
							var number = parseFloat(whxmatch[1]);

							if (number > 0) {
								var unit = whxmatch[2];

								// https://drafts.csswg.org/css-values-3/#cm
								if (unit === "dppx") {
									number *= 96;
									unit = "dpi";
								} else if (unit === "dpcm") {
									number *= 96/2.54;
									unit = "dpi";
								}

								if (unit === "x")
									source.desc_x = number;
								else if (unit === "dpi")
									source.dpi = number;
							}
						} else {
							console_warn("Unknown descriptor: " + desc);
						}
					}

					urls.push(source);
				}

				return urls;
			}

			function get_bgimage_urls(tokenized) {
				var urls = [];

				for (var i = 0; i < tokenized.length; i++) {
					if (tokenized[i].length < 1)
						continue;

					if (typeof tokenized[i][0] !== "object")
						continue;

					var our_func = tokenized[i][0];

					var funcname = our_func.name;

					// TODO: support image() and cross-fade()
					var allowed = [
						"url",
						"-webkit-image-set",
						"image-set"
					];

					if (array_indexof(allowed, funcname) < 0)
						continue;

					if (funcname === "url") {
						var url = get_urlfunc_url(our_func);
						if (url) {
							urls.push(url);
						}
					} else if (funcname === "-webkit-image-set" || funcname === "image-set") {
						var newurls = get_imageset_urls(our_func);
						if (newurls) {
							array_extend(urls, newurls);
						}
					}
				}

				return urls;
			}

			function get_urls_from_css(str, elstr) {
				var str_tokenized = _tokenize_css_value(str)[0];

				if (!has_bgimage_url(str_tokenized))
					return null;

				// -webkit-image-set(url('https://carbonmade-media.accelerator.net/34754698;460x194/lossless.webp') 1x, url('https://carbonmade-media.accelerator.net/34754698;920x388/lossless.webp') 2x)

				//var emptystrregex = /^(.*?\)\s*,)?\s*url[(]["']{2}[)]/;
				//if (!str.match(/^(.*?\)\s*,)?\s*url[(]/) || emptystrregex.test(str))
				//	return null;

				// window.getComputedStyle returns the window's URL in this case for some reason, so we need the element's style to find the empty string
				var elstr_tokenized;
				if (elstr) {
					elstr_tokenized = _tokenize_css_value(elstr)[0];
					if (!has_bgimage_url(elstr_tokenized))
						return null;
				}

				return get_bgimage_urls(str_tokenized);
			}

			function add_urls_from_css(el, str, elstr, layer, bg) {
				var urls = get_urls_from_css(str, elstr);
				if (urls) {
					var url;

					for (var i = 0; i < urls.length; i++) {
						url = urls[i];
						if (typeof url !== "string") {
							url = url.src;
						}

						addImage(url, el, {
							isbg: bg,
							layer: layer
						});

						if (typeof urls[i] !== "string") {
							var props = ["desc_x", "dpi"];

							for (var j = 0; j < props.length; j++) {
								var prop = props[j];

								if (urls[i][prop] && (!sources[url][prop] || sources[url][prop] > urls[i][prop])) {
									sources[url][prop] = urls[i][prop];
								}
							}
						}
					}
				}
			}

			function add_bgimage(layer, el, style, beforeafter) {
				if (!style || !("style" in el))
					return;

				if (style.getPropertyValue("background-image")) {
					var bgimg = style.getPropertyValue("background-image");
					add_urls_from_css(el, bgimg, el.style.getPropertyValue("background-image"), layer, beforeafter || true);
				}

				if (beforeafter) {
					if (style.getPropertyValue("content")) {
						add_urls_from_css(el, style.getPropertyValue("content"), undefined, layer, beforeafter);
					}
				}
			}

			function addElement(el, layer) {
				nir_debug("find_source", "_find_source (addElement)", el, layer);

				if (settings.mouseover_exclude_page_bg && el.tagName === "BODY") {
					return;
				}

				if (typeof layer === "undefined")
					layer = layers.length;

				addTagElement(el, layer);

				add_bgimage(layer, el, window.getComputedStyle(el));
				add_bgimage(layer, el, window.getComputedStyle(el, ":before"), "before");
				add_bgimage(layer, el, window.getComputedStyle(el, ":after"), "after");
			}

			for (var i = 0; i < els.length; i++) {
				// sidebar articles on https://www.rt.com/russia/447357-miss-moscow-2018-photos/
				// the <picture> element has a size of 0, and hence isn't added to find_els_at_point
				if (els[i].tagName === "IMG" && els[i].parentElement && els[i].parentElement.tagName === "PICTURE" && array_indexof(els, els[i].parentElement) < 0) {
					els.splice(i + 1, 0, els[i].parentElement);
				}

				// remove every element before PICTURE as they will be added automatically anyways
				// this messes up the layering
				if (els[i].tagName === "PICTURE" && i == 1) {
					els.splice(0, i);
					i = 0;
					break;
				}
			}

			for (var i = 0; i < els.length; i++) {
				var el = els[i];
				addElement(el);
			}

			if (_nir_debug_) {
				//console_log(els);
				nir_debug("find_source", "_find_source (sources)", deepcopy(sources));
				nir_debug("find_source", "_find_source (layers)", deepcopy(layers));
				nir_debug("find_source", "_find_source (ok_els)", deepcopy(ok_els));
			}

			// remove sources that aren't used
			var activesources = [];
			for (var i = 0; i < layers.length; i++) {
				for (var j = 0; j < layers[i].length; j++) {
					if (array_indexof(activesources, layers[i][j]) < 0)
						activesources.push(layers[i][j]);
				}
			}

			var ok_els_sources = [];
			for (var source in sources) {
				for (var i = 0; i < ok_els.length; i++) {
					if (sources[source].el === ok_els[i].el) {
						ok_els[i] = sources[source];
						ok_els_sources[i] = true;
					}
				}

				if (array_indexof(activesources, source) < 0)
					delete sources[source];
			}

			for (var i = 0; i < ok_els.length; i++) {
				if (!ok_els_sources[i] && !ok_els[i].src) {
					addElement(ok_els[i].el);
				}
			}

			if ((source = getsource()) !== undefined) {
				nir_debug("find_source", "_find_source (getsource())", source);

				if (source === null) {
					if (ok_els.length > 0) {
						return ok_els[0];
					} else if (get_single_setting("mouseover_links")) {
						if (Object.keys(links).length > 0) {
							var our_key = null;

							for (var link in links) {
								if (!settings.mouseover_only_valid_links) {
									our_key = link;
									break;
								}

								if (looks_like_valid_link(link, links[link].el)) {
									our_key = link;
									break;
								}
							}

							if (our_key)
								return links[our_key];
						}
					}
				}

				return source;
			}

			for (var i = 0; i < layers.length; i++) {
				var minW = 0;
				var elW = null;
				var minH = 0;
				var elH = null;
				var minMinW = 0;
				var elMinW = null;
				var minMinH = 0;
				var elMinH = null;
				var minMaxW = 0;
				var elMaxW = null;
				var minMaxH = 0;
				var elMaxH = null;
				var minX = 0;
				var elX = null;
				var minDpi = 0;
				var elDpi = null;

				var okurls = {};

				var have_something = false;

				for (var j = 0; j < layers[i].length; j++) {
					var source_url = layers[i][j];

					var source = sources[source_url];

					if (source.width && source.width > minW) {
						minW = source.width;
						elW = source;
						have_something = true;
					}

					if (source.height && source.height > minH) {
						minH = source.height;
						elH = source;
						have_something = true;
					}

					if (source.minWidth && source.minWidth > minMinW) {
						minMinW = source.minWidth;
						elMinW = source;
						have_something = true;
					}

					if (source.minHeight && source.minHeight > minMinH) {
						minMinH = source.minHeight;
						elMinH = source;
						have_something = true;
					}

					if (source.maxWidth && source.maxWidth > minMaxW) {
						minMaxW = source.maxWidth;
						elMaxW = source;
					}

					if (source.maxHeight && source.maxHeight > minMaxH) {
						minMaxH = source.maxHeight;
						elMaxH = source;
					}

					if (source.desc_x && source.desc_x > minX) {
						minX = source.desc_x;
						elX = source;
						have_something = true;
					}

					if (source.dpi && source.dpi > minDpi) {
						dpiX = source.dpi;
						elDpi = source;
						have_something = true;
					}

					if (source.isbg) {
						okurls[source.src] = true;
						have_something = true;
					}
				}

				if (!have_something)
					continue;

				if (minX > 1) {
					okurls[elX.src] = true;
				}

				if (minDpi > 96) {
					okurls[elDpi.src] = true;
				}

				if (minW > thresh && minW > minMinW) {
					okurls[elW.src] = true;
				}

				if (minH > thresh && minH > minMinH) {
					okurls[elH.src] = true;
				}

				if (minMinW > thresh && minMinW >= minW) {
					okurls[elMinW.src] = true;
				}

				if (minMinH > thresh && minMinH >= minH) {
					okurls[elMinH.src] = true;
				}

				layers[i] = [];
				for (var url in okurls) {
					layers[i].push(url);
				}
			}

			// TODO: improve?
			function pickbest(layer) {
				for (var i = 0; i < layer.length; i++) {
					var source_url = layer[i];
					var source = sources[source_url];

					if (source.desc_x)
						return source;
				}

				return sources[layer[0]];
			}

			function rebuildlayers() {
				var newlayers = [];
				for (var i = 0; i < layers.length; i++) {
					if (layers[i].length === 0)
						continue;
					newlayers.push(layers[i]);
				}
				layers = newlayers;
			}

			nir_debug("find_source", "_find_source (new layers)", deepcopy(layers));
			rebuildlayers();
			nir_debug("find_source", "_find_source (rebuilt layers)", deepcopy(layers));

			// If there are background images ahead of an image, it's likely to be masks
			// Maybe check if there's more than one element of ancestry between them?
			// Except: https://www.flickr.com/account/upgrade/pro (featured pro, the avatar's image is a bg image, while the image behind isn't)
			if (layers.length > 1 && layers[0].length === 1 && sources[layers[0][0]].isbg) {
				for (var i = 1; i < layers.length; i++) {
					if (layers[i].length === 1 && sources[layers[i][0]].isbg)
						continue;
					return pickbest(layers[i]);
				}
			}

			if (layers.length > 0) {
				return pickbest(layers[0]);
			}

			if (source = getsource())
				return source;
			else
				return getfirstsource(sources);
		}

		var get_next_in_gallery_generic = function(el, nextprev) {
			if (!el)
				return null;

			// https://www.gog.com/game/shadow_warrior_complete
			// "Buy series" gallery
			if (array_indexof(["SOURCE", "IMG"], el.tagName) >= 0 && el.parentElement && array_indexof(["PICTURE", "VIDEO"], el.parentElement.tagName) >= 0) {
				el = el.parentElement;
			}

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
						//if (valid_source(current_el))
						if (is_valid_el(current_el))
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
		};

		get_next_in_gallery = function(el, nextprev) {
			var value = get_album_info_gallery(popup_obj, el, nextprev);
			if (value || value === false)
				return value;

			if (!el.parentElement) {
				if (el.hasAttribute("imu-album-info")) {
					el = popup_orig_el;
				}
			}

			// FIXME: this is a rather bad hack to fix https://github.com/qsniyg/maxurl/issues/467
			previous_album_links = [];
			// FIXME: disabling because get_next_in_gallery can be called multiple times, just for checking links, not for actually redirecting
			if (false && popup_obj && popup_obj.album_info && popup_obj.album_info.type === "links") {
				array_foreach(popup_obj.album_info.links, function(link) {
					previous_album_links.push(link.url);
				});
			}

			return get_next_in_gallery_generic(el, nextprev);
		};

		/*function normalize_trigger() {
			if (!is_array(settings.mouseover_trigger)) {
				settings.mouseover_trigger = [settings.mouseover_trigger];
			}
		}

		normalize_trigger();*/

		function update_mouseover_trigger_delay() {
			delay = settings.mouseover_trigger_delay;
			if (delay < 0 || isNaN(delay))
				delay = false;
			if (typeof delay === "number" && delay >= 10)
				delay = 10;

			if (settings.mouseover_trigger_behavior === "mouse") {
				delay_mouseonly = true;
			} else {
				delay = false;
				delay_mouseonly = false;
			}

			if (delay_handle) {
				clearTimeout(delay_handle);
				delay_handle = null;
			}
		}

		update_mouseover_trigger_delay();

		settings_meta.mouseover_trigger_delay.onupdate = update_mouseover_trigger_delay;
		settings_meta.mouseover_trigger_behavior.onupdate = update_mouseover_trigger_delay;

		function can_add_to_chord(str) {
			if (!keystr_is_wheel(str))
				return true;

			return !chord_is_only_wheel(current_chord);
		}

		function clear_chord_wheel() {
			for (var i = 0; i < current_chord.length; i++) {
				if (keystr_is_wheel(current_chord[i])) {
					current_chord.splice(i, 1);
					i--;
				}
			}
		}

		function clear_chord() {
			current_chord = [];
			current_chord_timeout = {};
		}

		function clear_chord_if_only_wheel() {
			if (chord_is_only_wheel(current_chord))
				clear_chord();
		}

		function keystr_in_trigger(str, wanted_chord) {
			if (wanted_chord === undefined)
				wanted_chord = settings.mouseover_trigger_key;

			return array_indexof(wanted_chord, str) >= 0;
		}

		function key_would_modify_single_chord(str, value) {
			if (value) {
				if (!can_add_to_chord(str))
					return false;

				if (array_indexof(current_chord, str) < 0)
					return true;
			} else {
				if (array_indexof(current_chord, str) >= 0)
					return true;
			}

			return false;
		}

		function set_chord_sub(str, value) {
			if (value) {
				if (!can_add_to_chord(str))
					return false;

				current_chord_timeout[str] = Date.now();
				if (array_indexof(current_chord, str) < 0) {
					current_chord.push(str);
					//console_log("+" + str);
					return true;
				}
			} else {
				delete current_chord_timeout[str];
				if (array_indexof(current_chord, str) >= 0) {
					current_chord.splice(array_indexof(current_chord, str), 1);
					clear_chord_if_only_wheel();
					//console_log("-" + str);
					return true;
				}
			}

			return false;
		}

		function event_in_single_chord(e, wanted_chord) {
			var map = get_keystrs_map(e, true);

			for (var key in map) {
				// otherwise, modifiers like ctrl etc. get counted, even if they're not pressed (because get_keystrs_map reports them as false)
				// todo: if this function is ever called in keyup, another solution is needed.
				// for now, it'll only ever be called on keydown
				if (!map[key])
					continue;

				if (keystr_in_trigger(key, wanted_chord))
					return true;
			}

			return false;
		}

		function event_in_chord(e, wanted_chord) {
			wanted_chord = normalize_keychord(wanted_chord);

			for (var i = 0; i < wanted_chord.length; i++) {
				if (event_in_single_chord(e, wanted_chord[i]))
					return true;
			}

			return false;
		}

		function remove_old_keys() {
			var now = Date.now();

			for (var key in current_chord_timeout) {
				if (now - current_chord_timeout[key] > 5000)
					set_chord_sub(key, false);
			}
		}

		function update_chord(e, value) {
			var map = get_keystrs_map(e, value);

			remove_old_keys();

			var changed = false;
			for (var key in map) {
				if (set_chord_sub(key, map[key]))
					changed = true;
			}

			return changed;
		}

		function event_would_modify_single_chord(e, value, wanted_chord) {
			var map = get_keystrs_map(e, value)

			for (var key in map) {
				if (wanted_chord !== undefined && !keystr_in_trigger(key, wanted_chord))
					continue;

				if (key_would_modify_single_chord(key, map[key]))
					return true;
			}

			return false;
		}

		function event_would_modify_chord(e, value, wanted_chord) {
			wanted_chord = normalize_keychord(wanted_chord);

			for (var i = 0; i < wanted_chord.length; i++) {
				if (event_would_modify_single_chord(e, value, wanted_chord[i]))
					return true;
			}

			return false;
		}

		function trigger_complete_single(wanted_chord) {
			for (var i = 0; i < wanted_chord.length; i++) {
				var key = wanted_chord[i];

				if (array_indexof(current_chord, key) < 0)
					return false;
			}

			// e.g. if the user presses shift+r, but the chord is r, then it should fail
			for (var i = 0; i < current_chord.length; i++) {
				if (keystr_is_wheel(current_chord[i]))
					continue;

				if (array_indexof(wanted_chord, current_chord[i]) < 0)
					return false;
			}

			return true;
		}

		function trigger_complete(wanted_chord) {
			if (wanted_chord === undefined)
				wanted_chord = settings.mouseover_trigger_key;

			wanted_chord = normalize_keychord(wanted_chord);

			for (var i = 0; i < wanted_chord.length; i++) {
				if (trigger_complete_single(wanted_chord[i]))
					return true;
			}

			return false;
		}

		function trigger_partially_complete_single(e, wanted_chord) {
			for (var i = 0; i < wanted_chord.length; i++) {
				var key = wanted_chord[i];

				if (array_indexof(current_chord, key) >= 0)
					return true;
			}

			return false;
		}

		function trigger_partially_complete(e, wanted_chord) {
			if (wanted_chord === undefined)
				wanted_chord = settings.mouseover_trigger_key;

			wanted_chord = normalize_keychord(wanted_chord);

			for (var i = 0; i < wanted_chord.length; i++) {
				if (trigger_partially_complete_single(e, wanted_chord[i]))
					return true;
			}

			return false;
		}

		function get_close_behavior() {
			return get_single_setting("mouseover_close_behavior");
		}

		function get_close_need_mouseout() {
			return settings.mouseover_close_need_mouseout && get_close_behavior() !== "esc";
		}

		function get_close_on_leave_el() {
			return settings.mouseover_close_on_leave_el && get_single_setting("mouseover_position") === "beside_cursor";
		}

		function should_exclude_imagetab() {
			return settings.mouseover_exclude_imagetab && get_single_setting("mouseover_trigger_behavior") === "mouse" &&
				   currenttab_is_image() && !imagetab_ok_override;
		}

		function find_els_at_point(xy, els, prev, zoom_cache) {
			// test for pointer-events: none: https://www.shacknews.com/article/114834/should-you-choose-vulkan-or-directx-12-in-red-dead-redemption-2

			if (false && _nir_debug_)
				console_log("find_els_at_point", deepcopy(xy), deepcopy(els), deepcopy(prev));

			if (!prev) {
				prev = new_set();
			}

			if (zoom_cache === undefined) {
				try {
					zoom_cache = new Map();
				} catch (e) {
					zoom_cache = null;
				}
			}

			var ret = [];
			var afterret = [];

			if (!els) {
				els = document.elementsFromPoint(xy[0], xy[1]);
				afterret = els;

				if (!settings.mouseover_support_pointerevents_none)
					return els;
			}

			for (var i = 0; i < els.length; i++) {
				var el = els[i];

				if (set_has(prev, el))
					continue;

				set_add(prev, el);

				var el_has_children = false;
				var el_children = null;
				var el_shadow_children = null;

				if (el.childElementCount > 0) {
					el_children = el.children;
					el_has_children = true;
				}

				if (el.shadowRoot && el.shadowRoot.childElementCount > 0) {
					el_shadow_children = el.shadowRoot.children;
					el_has_children = true;
				}

				// FIXME: should we stop checking if not in bounding client rect?
				// this would depend on the fact that children are always within the bounding rect
				//  - probably not, there are cases where the parent div has a size of 0, but children have proper sizes
				if (el_has_children) {
					// reverse, because the last element is (usually) the highest z
					var newchildren = [];

					if (el_children) {
						for (var j = el_children.length - 1; j >= 0; j--) {
							newchildren.push(el_children[j]);
						}
					}

					// shadow is above non-shadow?
					if (el_shadow_children) {
						for (var j = el_shadow_children.length - 1; j >= 0; j--) {
							newchildren.push(el_shadow_children[j]);
						}
					}

					var newels = find_els_at_point(xy, newchildren, prev, zoom_cache);
					for (var j = 0; j < newels.length; j++) {
						var newel = newels[j];
						//console_log("about to add", newel, deepcopy(ret))
						if (array_indexof(ret, newel) < 0) {
							//console_log("adding", newel);
							ret.push(newel);
						}
					}
				}

				// youtube links on: https://old.reddit.com/r/anime/comments/btlmky/wt_mushishi_a_beautifully_melancholic_take_on_the/
				// they pop up outside of the cursor
				var rect = get_bounding_client_rect(el, zoom_cache);
				if (rect && rect.width > 0 && rect.height > 0 &&
					rect.left <= xy[0] && rect.right >= xy[0] &&
					rect.top <= xy[1] && rect.bottom >= xy[1] &&
					array_indexof(ret, el) < 0) {
					ret.push(el);
				}
			}

			for (var i = 0; i < afterret.length; i++) {
				if (array_indexof(ret, afterret[i]) < 0)
					ret.push(afterret[i]);
			}

			if (_nir_debug_ && ret.length > 0) {
				console_log("find_els_at_point (unsorted ret)", shallowcopy(ret));
			}

			var get_zindex_raw = function(el) {
				var zindex = get_computed_style(el).zIndex;

				var parent_zindex = 0;
				if (el.parentElement) {
					var parent_zindex = get_zindex(el.parentElement);// + 0.001; // hack: child elements appear above parent elements
					// don't use the above hack, it breaks z-ordering, the indexOf thing works already
				}

				if (zindex === "auto") {
					return parent_zindex;
				} else {
					zindex = parseFloat(zindex);

					// https://robertsspaceindustries.com/orgs/LUG/members
					if (zindex < parent_zindex)
						return parent_zindex + zindex; // hack:
						// <div style="z-index: 9"></div>
						// <div style="z-index: 10">
						//   <div style="z-index: 2">this is above z-index: 9 because it's a child of z-index: 10</div>
						// </div>
					else
						return zindex;
				}
			};

			var get_zindex = function(el) {
				if (zoom_cache) {
					var cached = map_get(zoom_cache, el);
					if (!cached || !("zIndex" in cached)) {
						var zindex = get_zindex_raw(el);

						if (cached) {
							cached.zIndex = zindex;
						} else {
							map_set(zoom_cache, el, {
								zIndex: zindex
							});
						}

						return zindex;
					} else {
						return cached.zIndex;
					}
				} else {
					return get_zindex_raw(el);
				}
			};

			// TODO: only sort elements that were added outside of elementsFromPoint
			ret.sort(function(a, b) {
				var a_zindex, b_zindex;

				a_zindex = get_zindex(a);
				b_zindex = get_zindex(b);

				//console_log(a_zindex, b_zindex, a, b);
				if (b_zindex === a_zindex) {
					// Don't modify the sort order
					return array_indexof(ret, a) - array_indexof(ret, b);
				} else {
					// opposite because we want it to be reversed (largest first)
					return b_zindex - a_zindex;
				}
			});

			if (_nir_debug_ && ret.length > 0)
				console_log("find_els_at_point (ret)", els, shallowcopy(ret), xy);

			return ret;
		}

		var get_physical_popup_el = function(el) {
			if (el.parentElement && el.tagName === "SOURCE")
				return el.parentElement;
			return el;
		}

		function trigger_popup(is_contextmenu) {
			if (_nir_debug_)
				console_log("trigger_popup (is_contextmenu=" + is_contextmenu + ")", current_frame_id);

			delay_handle_triggering = true;
			//var els = document.elementsFromPoint(mouseX, mouseY);
			var point = null;

			if (mousepos_initialized)
				point = [mouseX, mouseY];
			if (is_contextmenu)
				point = [mouseContextX, mouseContextY];

			if (point === null) {
				delay_handle_triggering = false;
				return;
			}

			var els = find_els_at_point(point);
			//console_log(els);

			if (_nir_debug_)
				console_log("trigger_popup: els =", els, "point =", point);

			var source = find_source(els);

			if (_nir_debug_)
				console_log("trigger_popup: source =", source);

			if (source && (popup_trigger_reason !== "mouse" || get_physical_popup_el(source.el) !== last_popup_el)) {
				trigger_popup_with_source(source);
			} else {
				if (popup_trigger_reason === "keyboard") {
					if (settings.mouseover_enable_notallowed) {
						cursor_not_allowed();
					}
				}

				delay_handle_triggering = false;
			}
		}

		function trigger_popup_with_source(source, automatic, use_last_pos, cb) {
			next_popup_el = get_physical_popup_el(source.el);

			if (!cb) cb = common_functions.nullfunc;

			var use_head = false;
			var openb = get_single_setting("mouseover_open_behavior");
			if (openb === "newtab" || openb === "download") {
				use_head = true;
			}

			return get_final_from_source(source, {
				automatic: automatic,
				multi: false,
				use_head: use_head,
				use_last_pos: use_last_pos
			}, function(source_imu, source, processing, data) {
				if (!source_imu && !source && !processing && !data) {
					delay_handle_triggering = false;
					stop_waiting();
					return cb(false);
				}

				// FIXME: this shouldn't fail, but rather go to the next element
				if (automatic && previous_album_links && source_imu && source_imu[0]) {
					if (array_indexof(previous_album_links, source_imu[0].url) >= 0) {
						delay_handle_triggering = false;
						stop_waiting();
						return cb(false);
					}
				}

				//console_log(source_imu);
				resetpopups({
					new_popup: true,
					automatic: automatic
				});

				if (automatic) {
					popup_el_automatic = true;
					removepopups(); // don't fade out
				}

				real_popup_el = source.el;
				popup_el = get_physical_popup_el(real_popup_el);
				if (popup_el.parentElement) // check if it's a fake element returned by a gallery helper
					popup_orig_el = popup_el;
				popup_el_is_video = is_video_el(popup_el);

				popup_orig_url = get_img_src(popup_el);

				if (is_in_iframe && can_iframe_popout() && get_single_setting("mouseover_open_behavior") === "popup") {
					data.data.img = serialize_img(data.data.img);
					remote_send_message("top", {
						type: "make_popup",
						data: {
							source_imu: source_imu,
							src: source.src,
							processing: processing,
							data: data
						}
					});
				} else {
					makePopup(source_imu, source.src, processing, data);

					if (is_in_iframe && can_use_remote() && get_single_setting("mouseover_open_behavior") === "popup") {
						remote_send_message("top", {
							type: "popup_open"
						});
					}
				}

				cb(true);
			});
		}

		function get_final_from_source(source, options, cb) {
			// FIXME: "multi" is used purely for replace_images,
			//   so it's used as a check for many options that have nothing to do with multi

			var processing = {running: true};

			if (!options.multi) {
				stop_processing();
				processing_list = [processing];
			}

			//console_log(source);

			var do_popup = function() {
				if (!options.multi)
					start_waiting(source.el);

				var x = mouseX;
				var y = mouseY;

				var realcb = function(source_imu, data) {
					//console_log(source_imu);
					//console_log(data);
					if ((!source_imu && false) || !data) {
						if (!options.multi) {
							stop_waiting_cant_load();
						}

						return cb();
					}

					// In case the user has dragged while loading the next image (#154)
					if (options.use_last_pos) {
						x = null;
						y = null;
					}

					cb(source_imu, source, processing, {
						data: data,
						x: x,
						y: y
					});
				};

				try {
					// FIXME: shouldn't this be ||?
					var force_page = settings.mouseover_ui_caption && settings.redirect_force_page;

					bigimage_recursive_loop(source.src, {
						fill_object: true,
						host_url: window.location.href,
						document: document,
						window: get_window(),
						element: source.el,
						force_page: force_page,
						cb: realcb
					}, function(obj, finalcb) {
						var orig_obj = obj;

						if (_nir_debug_)
							console_log("do_popup: brl query:", obj);

						if (options.multi && obj[0].url === source.src) {
							return finalcb(source.src, obj[0], null);
						}

						var newobj = deepcopy(obj);

						// TODO: find a way to fix bad images popping up because they weren't caught in addImage (because of do_request: null)
						// brl returns [] if they're bad, but the bad sources are added right back here
						if (!settings.mouseover_exclude_sameimage) {
							if (source.src && obj_indexOf(newobj, source.src) < 0)
								newobj.push(fillobj(source.src)[0]);
						} else if (source.src) {
							var index;

							while ((index = obj_indexOf(newobj, source.src)) >= 0) {
								newobj.splice(index, 1);
							}
						}

						if (!options.multi) {
							var partial = get_single_setting("mouseover_allow_partial");

							if (partial === "media") {
								processing.incomplete_image = true;
								processing.incomplete_video = true;
							} else if (partial === "video") {
								processing.incomplete_video = true;
							}

							if (is_in_iframe && can_iframe_popout()) {
								processing.incomplete_image = true;
								processing.incomplete_video = true;
							}
						}

						if (options.use_head) {
							processing.head = true;
						}

						if (settings.popup_allow_cache) {
							processing.set_cache = true;
							processing.use_cache = true;
						}

						processing.source = source;

						check_image_get(newobj, function(img, newurl, obj, respdata) {
							if (_nir_debug_)
								console_log("do_popup: check_image_get response:", img, newurl, obj, respdata);

							if (!img) {
								return finalcb(null);
							}

							var data = {img: img, newurl: newurl, obj: obj, respdata: respdata};
							var newurl1 = newurl;

							if (options.use_head) {
								data = {resp: img, obj: newurl};
								newurl1 = data.resp.finalUrl;
							}

							if (settings.print_imu_obj)
								console_log(orig_obj);

							finalcb(newurl1, data.obj, data);

							if (false) {
								// why?
								if (newurl == source.src) {
									realcb(obj, data);
								} else {
									finalcb(newurl, data);
								}
							}
						}, processing);
					});
				} catch (e) {
					console_error(e);
					//console.trace();
					// this doesn't work
					//makePopup(source.src);
				}
			};

			if (delay && !delay_mouseonly && !options.automatic) {
				start_progress(source.el);
				delay_handle = setTimeout(function() {
					if (delay_handle_triggering)
						return;

					delay_handle = null;
					do_popup();
				}, delay * 1000);
			} else {
				do_popup();
			}
		}

		function do_get_helpers(options) {
			var baseoptions = {
				document: document,
				window: get_window(),
				host_url: window.location.href,
				do_request: do_request,
				rule_specific: {}
			};

			for (var option in options) {
				baseoptions[option] = options[option];
			}

			return get_helpers(baseoptions);
		}

		function wrap_gallery_func(nextprev, origel, el, cb, new_options) {
			if (!el)
				el = real_popup_el;

			if (!origel)
				origel = popup_orig_el;

			var options = {
				element: origel,
				document: document,
				window: get_window(),
				host_url: window.location.href,
				do_request: do_request,
				rule_specific: {},
				cb: function(result) {
					if (result === undefined || result === "default") {
						return cb(get_next_in_gallery(el, nextprev));
					} else {
						cb(result);
					}
				}
			};

			if (new_options) {
				for (var key in new_options) {
					options[key] = new_options[key];
				}
			}

			get_bigimage_extoptions_first(options);
			get_bigimage_extoptions(options);

			var helpers = get_helpers(options);
			var gallery = get_next_in_gallery;

			if (helpers && helpers.gallery) {
				gallery = function(el, nextprev) {
					var value = helpers.gallery(el, nextprev);
					if (value || value === null)
						return value;

					return get_next_in_gallery(el, nextprev);
				};
			}

			var value = gallery(el, nextprev);
			if (value === "waiting") {
				return;
			} else if (value === "default") {
				return cb(get_next_in_gallery(el, nextprev));
			}

			return cb(value);
		}

		function is_valid_el(el) {
			if (!el)
				return false;

			return !!find_source([el]);
		}

		function count_gallery(nextprev, max, is_counting, origel, el, cb) {
			var count = 0;

			if (max === undefined)
				max = settings.mouseover_ui_gallerymax;

			var firstel = el;
			if (!firstel)
				firstel = real_popup_el;

			if (!firstel && popup_el_remote && can_iframe_popout() && !is_in_iframe) {
				return remote_send_message(popup_el_remote, {
					type: "count_gallery",
					data: {
						nextprev: nextprev,
						is_counting: is_counting,
						max: max
					}
				}, function(count) {
					cb(count);
				});
			}

			var loop = function() {
				wrap_gallery_func(nextprev, origel, el, function(newel) {
					if (!newel || !is_valid_el(newel))
						return cb(count, el);

					count++;

					if (count >= max)
						return cb(count, newel);

					el = newel;
					loop();
				}, {is_counting: is_counting, counting_firstel: firstel});
			};

			loop();
		}

		function wrap_gallery_cycle(dir, origel, el, cb) {
			if (!el)
				el = real_popup_el;

			if (dir === 0)
				return cb();

			var nextprev = true;
			var max = dir;
			if (dir < 0) {
				nextprev = false;
				max = -dir;
			}

			count_gallery(nextprev, max, false, origel, el, function(count, newel) {
				if (count < max) {
					if (settings.mouseover_gallery_cycle) {
						count_gallery(!nextprev, undefined, true, origel, el, function(count, newel) {
							cb(newel);
						});
					} else {
						cb(null);
					}
				} else {
					cb(newel);
				}
			});
		}

		function is_nextprev_valid(nextprev, cb) {
			if (popup_el_remote && can_iframe_popout() && !is_in_iframe) {
				return remote_send_message(popup_el_remote, {
					type: "is_nextprev_valid",
					data: {
						nextprev: nextprev
					}
				}, function(valid) {
					cb(valid);
				});
			}

			wrap_gallery_cycle(nextprev ? 1 : -1, undefined, undefined, function(el) {
				cb(is_valid_el(el));
			});
		}

		trigger_gallery = function(dir, cb) {
			if (!cb) {
				cb = common_functions.nullfunc;
			}

			if (popup_el_remote && can_iframe_popout() && !is_in_iframe) {
				return remote_send_message(popup_el_remote, {
					type: "trigger_gallery",
					data: {
						dir: dir
					}
				}, function(triggered) {
					cb(triggered);
				});
			}

			wrap_gallery_cycle(dir, undefined, undefined, function(newel) {
				if (newel) {
					var source = find_source([newel]);
					if (source) {
						trigger_popup_with_source(source, true, true, function(changed) {
							cb(changed)
						});

						return;
					}
				}

				return cb(false);
			});
		}

		var parse_transforms = function(transform) {
			var transforms = [];
			var transform_types = {};

			var last = 0;
			for (var i = 0; i < transform.length; i++) {
				if (transform[i] === ')') {
					var our_transform = strip_whitespace(transform.substr(last, (i - last) + 1));
					var type = our_transform.replace(/\(.*/, "");
					transforms.push(our_transform);

					if (!(type in transform_types)) {
						transform_types[type] = [];
					}
					transform_types[type].push(transforms.length - 1);

					last = i + 1;
					continue;
				}
			}

			return {transforms: transforms, types: transform_types};
		};

		var get_popup_transforms = function() {
			var style = popups[0].querySelector("img").parentElement.parentElement.style;
			if (style.transform) {
				return parse_transforms(style.transform);
			} else {
				return {transforms: [], types: {}};
			}
		}

		var stringify_transforms = function(transforms) {
			return transforms.transforms.join(" ");
		};

		var set_popup_transforms = function(transforms) {
			popups[0].querySelector("img").parentElement.parentElement.style.transform = stringify_transforms(transforms);
		};

		function rotate_gallery(dir) {
			if (!popups_active)
				return;

			var transforms = get_popup_transforms();

			var index = 0;
			if ("rotate" in transforms.types) {
				index = transforms.types.rotate[0];
			} else {
				transforms.transforms.unshift("rotate(0deg)");
			}

			var match = transforms.transforms[index].match(/^rotate\(([-0-9]+)deg\)$/);
			var deg = 0;
			if (match) {
				deg = parseInt(match[1]);
			}

			transforms.transforms[index] = "rotate(" + (deg + dir) + "deg)";
			set_popup_transforms(transforms);
		}

		// hv: vertical = true, horizontal = false
		var flip_gallery = function(hv) {
			if (!popups_active)
				return;

			var transforms = get_popup_transforms();

			var index = transforms.transforms.length;
			if ("scale" in transforms.types) {
				index = transforms.types.scale[0];
			} else {
				transforms.transforms.push("scale(1,1)");
			}

			var match = transforms.transforms[index].match(/^scale\(([-0-9.]+)\s*,\s*([-0-9.]+)\)$/);
			var scaleh = 1;
			var scalev = 1;

			if (match) {
				scaleh = parseFloat(match[1]);
				scalev = parseFloat(match[2]);
			}

			if (hv) {
				scalev = -scalev;
			} else {
				scaleh = -scaleh;
			}

			transforms.transforms[index] = "scale(" + scaleh + ", " + scalev + ")";
			set_popup_transforms(transforms);
		};

		function create_progress_el() {
			var progressc_el = document_createElement("div");
			set_el_all_initial(progressc_el);
			progressc_el.style.backgroundColor = "rgba(0,0,0,0.7)";
			//progressc_el.style.padding = "1em";
			progressc_el.style.height = "2em";
			progressc_el.style.zIndex = maxzindex - 2;

			var progressb_el = document_createElement("div");
			set_el_all_initial(progressb_el);
			progressb_el.style.position = "absolute";
			progressb_el.style.top = "0px";
			progressb_el.style.left = "0px";
			//progressb_el.style.backgroundColor = "#00aa00";
			progressb_el.style.backgroundColor = "#00aaff";
			progressb_el.style.height = "100%";
			progressb_el.style.width = "0%";
			progressb_el.style.zIndex = maxzindex - 1;

			progressc_el.appendChild(progressb_el);

			return progressc_el;
		}

		function update_progress_el(el, percent) {
			var bar = el.children[0];

			if (typeof percent === "number") {
				if (bar.getAttribute("data-timer")) {
					clearInterval(parseInt(bar.getAttribute("data-timer")));
					bar.removeAttribute("data-timer");
				}

				bar.style.width = (percent * 100) + "%";
			} else if (percent == "unknown") {
				bar.style.width = "10%";

				if (!bar.getAttribute("data-timer")) {
					bar.style.left = "0%";
					bar.setAttribute("data-dir", "right");
					var timer = setInterval(function() {
						var left = parseFloat(bar.style.left);
						var delta = (15/1000) * 1;
						var size = 90;

						if (bar.getAttribute("data-dir") == "right") {
							left += (delta * size);
							if (left >= size) {
								left = size - (left - size);
								bar.setAttribute("data-dir", "left");
							}
						} else {
							left -= (delta * size);
							if (left <= 0) {
								left = -left;
								bar.setAttribute("data-dir", "right");
							}
						}

						bar.style.left = left + "%";
					}, 15);

					bar.setAttribute("data-timer", timer);
				}
			}
		}

		var is_img_pic_vid = function(el) {
			return el.tagName === "IMG" || el.tagName === "PICTURE" || el.tagName === "VIDEO";
		};

		var is_img_pic_vid_link = function(el) {
			if (is_img_pic_vid(el))
				return true;

			if (settings.mouseover_links) {
				if (el.tagName === "A")
					return true;
			}

			return false;
		}

		var get_all_valid_els = function(el) {
			if (!el)
				el = document;
			return el.querySelectorAll("img, picture, video");
		};

		var get_all_valid_els_link = function(el) {
			var query = "img, picture, video";
			if (settings.mouseover_links) {
				query += ", a";
			}

			if (!el)
				el = document;
			return el.querySelectorAll(query);
		};

		var replacing_imgs = false;
		var replaceimgs_elcache = new Cache();
		function replace_images(options) {
			if (replacing_imgs || currenttab_is_image())
				return;

			var raw_imgs = options.images;

			if (raw_imgs === undefined) {
				raw_imgs = get_all_valid_els();
			}

			// remove non-images/videos
			var imgs = [];
			for (var i = 0; i < raw_imgs.length; i++) {
				if (is_img_pic_vid(raw_imgs[i])) {
					imgs.push(raw_imgs[i]);
				}
			}

			if (imgs.length === 0)
				return;

			if (options.use_progressbar)
				console_log("Replacing images");

			var finished = 0;

			var finish_img = function() {
				finished++;

				if (options.use_progressbar) {
					update_progress_el(progressc_el, finished / total_imgs);
					console_log("Finished " + finished + "/" + total_imgs);
				}

				if (finished >= total_imgs) {
					if (options.use_progressbar)
						progressc_el.parentElement.removeChild(progressc_el);

					replacing_imgs = false;
				} else {
					next_img();
				}
			};

			var next_img = function () {
				var total_limit = parseInt(settings.replaceimgs_totallimit);
				if (currently_processing > total_limit) {
					currently_processing--;
					return;
				} else if (currently_processing < total_limit) {
					currently_processing++;
					next_img();
				}


				var our_source = null;
				var our_domain = null;

				var now = Date.now();

				for (var domain in domains) {
					if (domains_processing[domain] >= parseInt(settings.replaceimgs_domainlimit)) {
						continue;
					}

					var delta = now - domains_lastrequest[domain];
					var replaceimgs_delay = parseFloat(settings.replaceimgs_delay) * 1000.0;
					var wait_delay = replaceimgs_delay - delta;
					if (wait_delay > 0) {
						if (domains_timeout[domain] === null) {
							// wrap in closure to capture domain for the callback
							(function(domain) {
								domains_timeout[domain] = setTimeout(function() {
									domains_timeout[domain] = null;
									next_img();
								}, wait_delay + 1);
							})(domain);
						}

						continue;
					}

					our_domain = domain;

					domains_processing[domain]++;
					domains_lastrequest[domain] = now;

					our_source = domains[domain][0];
					domains[domain].splice(0, 1);

					if (domains[domain].length === 0) {
						delete domains[domain];
					}

					break;
				}

				if (our_source) {
					if (options.use_elcache) {
						if (replaceimgs_elcache.has(our_source.el)) {
							return finish_img();
						} else {
							// Not perfect, but 5 seconds should be enough
							replaceimgs_elcache.set(our_source.el, true, 5);
						}
					}

					get_final_from_source(our_source, {
						automatic: true,
						multi: true,
						use_head: !get_single_setting("replaceimgs_usedata"),
						use_last_pos: false
					}, function (source_imu, source, processing, data) {
						if (our_domain)
							domains_processing[our_domain]--;

						var replace_func = function(el, newsrc, url) {
							if (options.replace_imgs && get_img_src(el) !== newsrc) {
								el.src = newsrc;
							}

							if (options.add_links) {
								var current = el;

								while (current = current.parentElement) {
									if (current.tagName === "A") {
										if (!options.replace_links)
											return;
										else
											break;
									}
								}

								if (!current) {
									current = document_createElement("a");

									el.parentElement.insertBefore(current, el);
									current.appendChild(el);
								}

								if (current.href !== url) {
									current.href = url;
								}
							}
						};

						if (!data) {
							replace_func(our_source.el, our_source.src, our_source.src);
							return finish_img();
						}

						var waiting = false;
						if (data.data.img) {
							replace_func(source.el, data.data.img.src, data.data.obj.url);
						} else if (data.data.obj) {
							var load_image = function() {
								if (settings.replaceimgs_wait_fullyloaded && options.replace_imgs) {
									// Preload the image, as adding onload/onerror to existing images won't fire the event
									var image = new Image();
									var finish_image = function () {
										replace_func(source.el, image.src, data.data.obj.url);
										finish_img();
									};

									image.onload = finish_image;
									image.onerror = finish_img;
									image.src = data.data.obj.url;
								} else {
									replace_func(source.el, data.data.obj.url, data.data.obj.url);
									finish_img();
								}
							};

							if (is_extension) {
								extension_send_message({
									type: "override_next_headers",
									data: {
										url: data.data.obj.url,
										headers: data.data.obj.headers,
										method: "GET"
									}
								}, function() {
									load_image();
								});
							} else {
								load_image();
							}

							waiting = true;
						}

						if (!waiting)
							finish_img();
					});
				} else {
					if (our_source === null && other.length > 0) {
						our_source = other[0];
						other.splice(0, 1);
					}

					currently_processing--;
				}
			};

			var progressc_el;

			if (options.use_progressbar) {
				progressc_el = create_progress_el();
				progressc_el.style.position = "fixed";
				progressc_el.style.top = "0px";
				progressc_el.style.left = "0px";
				progressc_el.style.width = "80%";
				progressc_el.style.marginTop = "100px";
				progressc_el.style.marginLeft = "10%";
				document.documentElement.appendChild(progressc_el);
			}

			var domains = {};
			var domains_processing = {};
			var domains_lastrequest = {};
			var domains_timeout = {};
			var other = [];

			var total_imgs = imgs.length;

			for (var i = 0; i < imgs.length; i++) {
				var source = find_source([imgs[i]]);
				if (!source) {
					total_imgs--;
					continue;
				}

				if (!source.src) {
					other.push(source);
					continue;
				}

				var domain = source.src.match(/^https?:\/\/([^/]+)\//);
				if (!domain) {
					other.push(source);
					continue;
				}

				if (!(domain[1] in domains)) {
					domains[domain[1]] = [];
					domains_processing[domain[1]] = 0;
					domains_lastrequest[domain[1]] = 0;
					domains_timeout[domain[1]] = null;
				}

				domains[domain[1]].push(source);
			}

			var currently_processing = 1;
			next_img();
		}

		var replace_images_full = function(options) {
			var base_options = {
				replace_imgs: settings.replaceimgs_replaceimgs,
				add_links: settings.replaceimgs_addlinks,
				replace_links: settings.replaceimgs_replacelinks,
				use_progressbar: true
			};

			if (!options)
				options = {};

			for (var key in options) {
				base_options[key] = options[key];
			}

			return replace_images(base_options);
		};

		register_menucommand("Replace images", replace_images_full);

		var generate_random_class = function(name) {
			return "imu-" + get_random_text(10) + "-" + name;
		};

		var highlightimgs_styleel = null;
		var highlightimgs_classname = generate_random_class("highlight");
		var update_highlight_styleel = function() {
			if (!/^text\//.test(document.contentType))
				return;

			if (!highlightimgs_styleel) {
				highlightimgs_styleel = document_createElement("style");
				document.documentElement.appendChild(highlightimgs_styleel);
			}

			highlightimgs_styleel.innerText = "." + highlightimgs_classname + "{" + get_styletag_styles(settings.highlightimgs_css) + "}";
		}

		onload(function() {
			try {
				update_highlight_styleel();
			} catch (e) {
				console_error(e);
			}
		});

		(function() {
			var oldfunc = settings_meta.highlightimgs_css.onupdate;
			settings_meta.highlightimgs_css.onupdate = function() {
				update_highlight_styleel();

				if (oldfunc)
					return oldfunc.apply(this, arguments);
			};
		})();

		var apply_highlight_style = function(target) {
			target.classList.add(highlightimgs_classname);
		};

		var remove_highlight_style = function(target) {
			target.classList.remove(highlightimgs_classname);
		}

		var check_highlightimgs_valid_image = function(el) {
			var src = get_img_src(el);
			if (!is_valid_src(src, is_video_el(el)) || (el.tagName === "A" && !looks_like_valid_link(src, el)))
				return false;
			return true;
		};

		var get_highlightimgs_valid_image = function(el) {
			// TODO: dynamic attribute name
			if (el.hasAttribute("data-imu-valid")) {
				return !!parse_boolean(el.getAttribute("data-imu-valid"));
			}

			var valid = check_highlightimgs_valid_image(el);
			el.setAttribute("data-imu-valid", valid + "");
			return valid;
		};

		var get_highlightimgs_supported_image = function(el) {
			// TODO: dynamic attribute name
			if (el.hasAttribute("data-imu-supported")) {
				return !!parse_boolean(el.getAttribute("data-imu-supported"));
			}

			var supported = check_highlightimgs_supported_image(el);
			el.setAttribute("data-imu-supported", supported + "");
			return supported;
		};

		var auto_highlighted_imgs = [];
		var highlight_images = function(options) {
			if (currenttab_is_image() && settings.mouseover_exclude_imagetab)
				return;

			if (!options) {
				options = {}
			}

			var images = options.images;
			if (images === undefined) {
				images = get_all_valid_els_link();
			}

			if (!images.length)
				return;

			for (var i = 0; i < images.length; i++) {
				if (!get_highlightimgs_valid_image(images[i]))
					continue;

				supported = !settings.highlightimgs_onlysupported;

				if (settings.highlightimgs_onlysupported) {
					supported = get_highlightimgs_supported_image(images[i]);
				}

				if (!options.hoveronly) {
					if (supported) {
						if (options.is_auto && array_indexof(auto_highlighted_imgs, images[i]) < 0) {
							auto_highlighted_imgs.push(images[i]);
						}

						apply_highlight_style(images[i]);
					} else {
						remove_highlight_style(images[i]);
					}
				}
			}
		};

		(function() {
			var added = false;
			var id = null;

			var update_button = function() {
				if (settings.highlightimgs_enable) {
					if (!added) {
						id = register_menucommand("Highlight images", highlight_images);
						added = true;
					}
				} else {
					if (added) {
						unregister_menucommand(id);
						added = false;
					}
				}
			};

			update_button();

			var origfunc = settings_meta.highlightimgs_enable.onupdate;
			settings_meta.highlightimgs_enable.onupdate = function() {
				update_button();

				if (origfunc)
					return origfunc.apply(this, arguments);
			};
		})();

		var popup_mouse_head = function() {
			if (delay_handle_triggering)
				return false;

			var enabledisable_toggle = get_single_setting("mouseover_trigger_enabledisable_toggle");
			if (trigger_complete(settings.mouseover_trigger_prevent_key)) {
				if (enabledisable_toggle === "disable")
					return false;
			} else {
				if (enabledisable_toggle === "enable")
					return false;
			}

			popup_trigger_reason = "mouse";
			return true;
		};

		var image_mouseover = function(e) {
			if (currenttab_is_image() && settings.mouseover_exclude_imagetab)
				return;

			if (get_single_setting("highlightimgs_auto") === "hover" && get_highlightimgs_valid_image(e.target)) {
				var supported = !settings.highlightimgs_onlysupported;
				if (!supported) {
					supported = get_highlightimgs_supported_image(e.target);
				}

				if (supported) {
					if (array_indexof(auto_highlighted_imgs, e.target) < 0)
						auto_highlighted_imgs.push(e.target);
					apply_highlight_style(e.target);
				}
			}

			if (mouseover_mouse_enabled() && settings.mouseover_trigger_mouseover && !delay_handle && !should_exclude_imagetab()) {
				delay_el = e.target;
				update_mouse_from_event(e);

				delay_handle = setTimeout(function() {
					delay_el = null;

					if (delay_handle) {
						clearTimeout(delay_handle);
						delay_handle = null;
					}

					if (!popup_mouse_head())
						return;

					// TODO: make configurable
					if (false) {
						var source = find_source([e.target]);

						if (source && get_physical_popup_el(source.el) !== last_popup_el) {
							trigger_popup_with_source(source);
						}
					} else {
						trigger_popup();
					}
				}, delay * 1000);
			}
		};

		var image_mouseout = function(e) {
			if (get_single_setting("highlightimgs_auto") === "hover" && get_highlightimgs_valid_image(e.target)) {
				remove_highlight_style(e.target);
			}

			if (mouseover_mouse_enabled() && settings.mouseover_trigger_mouseover && delay_handle) {
				if (delay_el === e.target) {
					clearTimeout(delay_handle);
					delay_handle = null;
				}
			}
		};

		function on_new_images(images) {
			var highlight = get_single_setting("highlightimgs_auto");
			if (highlight === "always" || highlight === "hover")
				highlight_images({images: images, hoveronly: highlight === "hover", is_auto: true});

			for (var i = 0; i < images.length; i++) {
				// apparently this isn't needed to ensure no duplicate event listeners?
				our_removeEventListener(images[i], "mouseover", image_mouseover);
				our_removeEventListener(images[i], "mouseout", image_mouseout);

				our_addEventListener(images[i], "mouseover", image_mouseover);
				our_addEventListener(images[i], "mouseout", image_mouseout);
			}

			if (settings.replaceimgs_auto)
				replace_images_full({images: images, use_progressbar: false, use_elcache: true});
		};

		(function() {
			if (!settings.imu_enabled)
				return;

			// TODO: allow this to be automatically updated
			if (settings.apply_blacklist_host && !bigimage_filter(window.location.href))
				return;

			var observer;

			var observe_options = {childList: true, subtree: true, attributes: true};

			var new_mutationobserver = function() {
				return new MutationObserver(function(mutations, observer) {
					var images = [];

					var add_nodes = function(nodes) {
						for (var i = 0; i < nodes.length; i++) {
							if (is_img_pic_vid_link(nodes[i])) {
								images.push(nodes[i]);
							}

							if (nodes[i].children) {
								add_nodes(nodes[i].children);
							}
						}
					};

					for (var i = 0; i < mutations.length; i++) {
						var mutation = mutations[i];

						if (mutation.addedNodes) {
							add_nodes(mutation.addedNodes);
						}

						if (mutation.target && mutation.type === "attributes") {
							if (mutation.attributeName === "src" || mutation.attributeName === "href" || mutation.attributeName === "srcset") {
								add_nodes([mutation.target]);
							}
						}
					}

					if (images.length > 0) {
						on_new_images(images);
					}
				});
			}

			var observe = function() {
				if (!settings.imu_enabled)
					return;

				on_new_images(get_all_valid_els_link());

				if (!observer)
					return;
				observer.observe(document, observe_options);
			};

			var remove_all_highlights = function() {
				for (var i = 0; i < auto_highlighted_imgs.length; i++) {
					remove_highlight_style(auto_highlighted_imgs[i]);
				}

				auto_highlighted_imgs = [];
			}

			var disconnect = function() {
				remove_all_highlights();

				if (!observer)
					return;

				observer.disconnect();
			};

			var needs_observer = function() {
				var highlight = get_single_setting("highlightimgs_auto");
				return highlight === "always" || highlight === "hover" || settings.replaceimgs_auto || (mouseover_mouse_enabled() && settings.mouseover_trigger_mouseover);
			};

			var create_mutationobserver = function() {
				try {
					// In case the browser doesn't support MutationObservers
					observer = new_mutationobserver();
				} catch (e) {
					console_warn(e);
				}

				if (needs_observer()) {
					observe();
				}
			};

			create_mutationobserver();

			var update_highlightimgs_func = function() {
				if (needs_observer()) {
					if (get_single_setting("highlightimgs_auto") !== "always") {
						remove_all_highlights();
					}

					observe();
				} else {
					disconnect();
				}
			};

			// replaceimgs_auto is intentionally not added here due to the warning
			var orig_highlightfunc = settings_meta.highlightimgs_auto.onupdate;
			settings_meta.highlightimgs_auto.onupdate = function() {
				if (orig_highlightfunc)
					orig_highlightfunc();

				update_highlightimgs_func();
			};

			var orig_imuenabledfunc = settings_meta.imu_enabled.onupdate;
			settings_meta.imu_enabled.onupdate = function() {
				if (orig_imuenabledfunc)
					orig_imuenabledfunc.apply(this, arguments);

				if (settings.imu_enabled) {
					update_highlightimgs_func();
				} else {
					disconnect();
				}
			};
		})();

		var get_popup_media_el = function() {
			var imgels = popups[0].getElementsByTagName("video");
			if (imgels.length === 0)
				imgels = popups[0].getElementsByTagName("img");

			if (imgels.length > 0)
				return imgels[0];
			else
				return null;
		};

		var get_popup_media_url = function() {
			var el = get_popup_media_el();

			if (el)
				return el.src;
			else
				return null;
		};

		var do_browser_download = function(imu, filename, cb) {
			if (_nir_debug_) {
				console_log("do_browser_download", imu, filename, cb);
			}

			var a = document_createElement("a");

			a.href = imu.url;

			if (filename && filename.length > 0) {
				a.setAttribute("download", filename);
			} else {
				var attr = document.createAttribute("download");
				a.setAttributeNode(attr);
			}

			a.style.display = "none";
			a.onclick = function(e) {
				e.stopPropagation();
				e.stopImmediatePropagation();
				return true;
			};

			document.body.appendChild(a);
			a.click();

			setTimeout(function() {
				document.body.removeChild(a);
			}, 500);

			if (cb)
				cb();
		};

		var do_download = function(imu, filename, size, cb) {
			if (_nir_debug_) {
				console_log("do_download", imu, filename, size, cb);
			}

			var use_gm_download = is_userscript && typeof GM_download !== "undefined" && settings.enable_gm_download;
			var gm_download_max = parseFloat(settings.gm_download_max) || 0;
			if (use_gm_download && size && gm_download_max) {
				if ((gm_download_max * 1024 * 1024) < size) {
					use_gm_download = false;
				}
			}

			if (is_extension) {
				extension_send_message({
					type: "download",
					data: {
						imu: imu,
						force_saveas: !!settings.enable_webextension_download
					}
				}, function() {
					if (cb)
						cb();
				});
			} else if (use_gm_download) {
				var headers;

				if (imu.headers)
					headers = headers_dict_to_list(imu.headers);

				var download_obj = {
					url: imu.url,
					headers: headers,
					saveAs: true,
					onerror: function(error) {
						if (error && error.error && error.error !== "not_succeeded") {
							do_browser_download(imu, filename, cb);
						}
					}
				};

				if (filename) {
					download_obj.name = filename;
				} else {
					download_obj.name = "download"; // it can't be blank
				}

				if (_nir_debug_) {
					console_log("GM_download", deepcopy(download_obj));
				}

				GM_download(download_obj);
			} else {
				do_browser_download(imu, filename, cb);
			}
		};

		var download_popup_image = function() {
			do_download(popup_obj, popup_obj.filename, popup_contentlength);
		};

		var get_popup_video = function() {
			var videoel = popups[0].getElementsByTagName("video");
			if (!videoel || videoel.length === 0)
				return null;

			return videoel[0];
		};

		var seek_popup_video = function(leftright, amount) {
			var timemul = leftright ? -1 : 1;

			if (typeof amount === "undefined")
				amount = settings.mouseover_video_seek_amount;

			var time = timemul * amount;

			var videoel = get_popup_video();
			if (!videoel)
				return;

			videoel.currentTime += time;
		};

		var framestep_popup_video = function(leftright) {
			var videoel = get_popup_video();
			if (!videoel)
				return;

			videoel.pause();

			seek_popup_video(leftright, 1.0 / settings.mouseover_video_framerate);
		};

		var popup_video_speed = function(downup) {
			var videoel = get_popup_video();
			if (!videoel)
				return;

			if (typeof downup !== "number") {
				var amount = settings.mouseover_video_speed_amount;
				if (downup === true)
					amount = -amount;

				videoel.playbackRate += amount;
			} else {
				videoel.playbackRate = downup;
			}
		};

		var popup_video_volume = function(downup) {
			var videoel = get_popup_video();
			if (!videoel)
				return;

			if (typeof downup !== "number") {
				var amount = settings.mouseover_video_volume_change_amt;
				if (downup === true)
					amount = -amount;

				var new_volume = videoel.volume + (amount / 100.);
				new_volume = Math_min(Math_max(new_volume, 0), 1);

				videoel.volume = new_volume;
			} else {
				videoel.volume = downup;
			}
		};

		var toggle_video_muted = function() {
			var videoel = get_popup_video();
			if (!videoel)
				return;

			videoel.muted = !videoel.muted;
		};

		var toggle_video_controls = function() {
			var videoel = get_popup_video();
			if (!videoel)
				return;

			if (videoel.getAttribute("controls") === "controls") {
				videoel.removeAttribute("controls");
			} else {
				videoel.setAttribute("controls", "controls");
			}
		};

		var toggle_video_playing = function() {
			var videoel = get_popup_video();
			if (!videoel)
				return;

			if (videoel.paused) {
				videoel.play();
			} else {
				videoel.pause();
			}
		};

		var is_fullscreen = function() {
			return document.fullscreenElement !== null || document.fullscreen;
		};

		var popup_fullscreen = function() {
			if (!is_fullscreen()) {
				get_popup_media_el().requestFullscreen();
			} else {
				document.exitFullscreen();
			}
		};

		var popup_active = function() {
			return popups_active && popup_el;
		};

		var can_use_hold_key = function() {
			if (!popups_active)
				return false;

			if (popup_trigger_reason !== "mouse") {
				var auto_close = settings.mouseover_auto_close_popup && settings.mouseover_auto_close_popup_time;
				var close_mouseout = get_close_need_mouseout();

				if (!auto_close && !close_mouseout) return false;
			}

			return settings.mouseover_use_hold_key;
		};

		var update_popup_hold = function() {
			if (!popups_active)
				return;

			if (popup_update_pos_func && settings.mouseover_hold_position_center) {
				var newpos = popup_update_pos_func(mouseX, mouseY, true);
				popups[0].style.top = newpos[1] + "px";
				popups[0].style.left = newpos[0] + "px";
			}

			popup_hold_func();
		};

		var action_handler = function(action) {
			if (_nir_debug_) {
				console_log("action_handler", action);
			}

			if (action.needs_popup && !popup_active())
				return;

			switch (action.type) {
				case "resetpopups":
					resetpopups();
					return true;
				case "replace_images":
					replace_images_full();
					return true;
				case "highlight_images":
					highlight_images();
					return true;
				case "trigger_popup":
					if (action.trigger === "keyboard") {
						popup_trigger_reason = "keyboard";
					}

					trigger_popup();
					return true;
				case "gallery_prev":
					trigger_gallery(-1);
					return true;
				case "gallery_next":
					trigger_gallery(1);
					return true;
				case "download":
					download_popup_image();
					return true;
				case "open_in_new_tab":
					open_in_tab_imu(popup_obj, action.background_tab);
					return true;
				case "rotate_left":
					rotate_gallery(-90);
					return true;
				case "rotate_right":
					rotate_gallery(90);
					return true;
				case "flip_horizontal":
					flip_gallery(false);
					return true;
				case "flip_vertical":
					flip_gallery(true);
					return true;
				case "zoom_in":
					popup_zoom_func("incremental", -1);
					return true;
				case "zoom_out":
					popup_zoom_func("incremental", 1);
					return true;
				case "zoom_full":
					popup_zoom_func("fitfull", -1);
					return true;
				case "zoom_fit":
					popup_zoom_func("fitfull", 1);
					return true;
				case "fullscreen":
					popup_fullscreen();
					return true;
				case "seek_left":
					seek_popup_video(true);
					return true;
				case "seek_right":
					seek_popup_video(false);
					return true;
				case "frame_left":
					framestep_popup_video(true);
					return true;
				case "frame_right":
					framestep_popup_video(false);
					return true;
				case "speed_down":
					popup_video_speed(true);
					return true;
				case "speed_up":
					popup_video_speed(false);
					return true;
				case "reset_speed":
					popup_video_speed(1);
					return true;
				case "volume_up":
					popup_video_volume(false);
					return true;
				case "volume_down":
					popup_video_volume(true);
					return true;
				case "toggle_mute":
					toggle_video_muted();
					return true;
				case "toggle_controls":
					toggle_video_controls();
					return true;
				case "toggle_play_pause":
					toggle_video_playing();
					return true;
				case "open_options":
					open_in_tab_imu({url: preferred_options_page}, false);
					return true;
				case "open_orig_page":
					if (popup_obj && popup_obj.extra && popup_obj.extra.page) {
						open_in_tab_imu({url: popup_obj.extra.page}, false);
					} else {
						console_log("Unable to find original page for", popup_obj);
					}
					return true;
				case "hold":
					update_popup_hold();
					return true;
			}

			return false;
		};

		var action_remote = function(actions) {
			// use can_use_remote instead of can_iframe_popout because this doesn't necessarily pop out of iframes
			if (can_use_remote()) {
				var recipient = "top";
				var has_mouse = true;

				if (!is_in_iframe) {
					recipient = mouse_frame_id;
					if (recipient === "top") {
						has_mouse = false;

						if (popup_el_remote) {
							recipient = popup_el_remote;
						} else {
							return;
						}
					}
				}

				//console_log(deepcopy(actions));
				for (var i = 0; i < actions.length; i++) {
					if (!has_mouse && actions[i].requires_mouse) {
						actions.splice(i, 1);
						i--;
					}
				}

				if (actions.length > 0) {
					remote_send_message(recipient, {
						type: "action",
						data: actions
					});
				}
			}
		};

		var keydown_cb = function(event) {
			// otherwise rebinding the trigger key will fail
			if (is_options_page)
				return;

			nir_debug("input", "keydown_cb", event);

			if (!mouseover_enabled())
				return;

			if (event.type === "wheel" && chord_is_only_wheel(current_chord))
				return;

			if (event.type === "keydown") {
				// thanks to lnp5131 on github: https://github.com/qsniyg/maxurl/issues/415#issuecomment-684847125
				// it seems that even keys like control will cause a repeat under certain configurations
				if (event.repeat)
					return;

				if (editing_text)
					return;

				if (settings.disable_keybind_when_editing) {
					if (event.target.tagName === "TEXTAREA")
						return;

					if (event.target.tagName === "INPUT") {
						if (!event.target.hasAttribute("type") || event.target.getAttribute("type") === "text") {
							return;
						}
					}

					// TODO: support editable divs?
				}
			}

			var ret = undefined;
			var actions = [];

			update_chord(event, true);

			if (settings.mouseover_trigger_behavior === "keyboard" && event_in_chord(event, settings.mouseover_trigger_key)) {
				if (trigger_complete(settings.mouseover_trigger_key) && !popups_active) {
					// clear timeout so that all/any close behavior works
					current_chord_timeout = {};
					if (!delay_handle) {
						actions.push({
							requires_mouse: true,
							type: "trigger_popup",
							trigger: "keyboard"
						});

						ret = false;
						release_ignore = settings.mouseover_trigger_key;
					}
				}

				var close_behavior = get_close_behavior();
				if (close_behavior === "all" || (close_behavior === "any" && trigger_complete(settings.mouseover_trigger_key))) {
					can_close_popup[0] = false;
				}
			}

			if (can_use_hold_key() && event_in_chord(event, settings.mouseover_hold_key)) {
				if (trigger_complete(settings.mouseover_hold_key)) {
					popup_hold = !popup_hold;
					clear_resetpopup_timeout();

					if (!popup_hold && (can_close_popup[1] || settings.mouseover_hold_close_unhold)) {
						actions.push({type: "resetpopups"});
					} else {
						actions.push({type: "hold"});
					}
				}
			}


			if (settings.replaceimgs_enable_keybinding && trigger_complete(settings.replaceimgs_keybinding)) {
				actions.push({type: "replace_images"});

				ret = false;
				release_ignore = settings.replaceimgs_keybinding;
			}

			if (settings.highlightimgs_enable_keybinding && trigger_complete(settings.highlightimgs_keybinding)) {
				actions.push({type: "highlight_images"});

				ret = false;
				release_ignore = settings.highlightimgs_keybinding;
			}


			// don't run if another function above was already triggered (e.g. when close is bound to the same key as trigger)
			if (ret !== false) {
				var is_popup_active = popup_el_remote || (popup_active());

				var keybinds = [
					{
						key: settings.mouseover_close_key,
						action: {type: "resetpopups"}
					},
					{
						key: settings.mouseover_gallery_prev_key,
						action: {type: "gallery_prev"},
						requires: settings.mouseover_enable_gallery
					},
					{
						key: settings.mouseover_gallery_next_key,
						action: {type: "gallery_next"},
						requires: settings.mouseover_enable_gallery
					},
					{
						key: settings.mouseover_download_key,
						// Clear the chord because keyup might not be called due to the save dialog popup
						clear: true,
						action: {type: "download"}
					},
					{
						key: settings.mouseover_open_new_tab_key,
						// Clear the chord because opening in a new tab will not release the keys
						clear: true,
						action: {type: "open_in_new_tab"}
					},
					{
						key: settings.mouseover_open_bg_tab_key,
						action: {type: "open_in_new_tab", background_tab: true}
					},
					{
						key: settings.mouseover_open_options_key,
						// Clear the chord because opening in a new tab will not release the keys
						clear: true,
						action: {type: "open_options"}
					},
					{
						key: settings.mouseover_open_orig_page_key,
						// Clear the chord because opening in a new tab will not release the keys
						clear: true,
						action: {type: "open_orig_page"}
					},
					{
						key: settings.mouseover_rotate_left_key,
						action: {type: "rotate_left"}
					},
					{
						key: settings.mouseover_rotate_right_key,
						action: {type: "rotate_right"}
					},
					{
						key: settings.mouseover_flip_horizontal_key,
						action: {type: "flip_horizontal"}
					},
					{
						key: settings.mouseover_flip_vertical_key,
						action: {type: "flip_vertical"}
					},
					{
						key: settings.mouseover_zoom_in_key,
						action: {type: "zoom_in"}
					},
					{
						key: settings.mouseover_zoom_out_key,
						action: {type: "zoom_out"}
					},
					{
						key: settings.mouseover_zoom_full_key,
						action: {type: "zoom_full"}
					},
					{
						key: settings.mouseover_zoom_fit_key,
						action: {type: "zoom_fit"}
					},
					{
						key: settings.mouseover_fullscreen_key,
						action: {type: "fullscreen"}
					},
					{
						key: settings.mouseover_video_seek_left_key,
						action: {type: "seek_left"}
					},
					{
						key: settings.mouseover_video_seek_right_key,
						action: {type: "seek_right"}
					},
					{
						key: settings.mouseover_video_frame_prev_key,
						action: {type: "frame_left"}
					},
					{
						key: settings.mouseover_video_frame_next_key,
						action: {type: "frame_right"}
					},
					{
						key: settings.mouseover_video_speed_down_key,
						action: {type: "speed_down"}
					},
					{
						key: settings.mouseover_video_speed_up_key,
						action: {type: "speed_up"}
					},
					{
						key: settings.mouseover_video_reset_speed_key,
						action: {type: "reset_speed"}
					},
					{
						key: settings.mouseover_video_volume_up_key,
						action: {type: "volume_up"}
					},
					{
						key: settings.mouseover_video_volume_down_key,
						action: {type: "volume_down"}
					},
					{
						key: settings.mouseover_video_mute_key,
						action: {type: "toggle_mute"}
					},
					{
						key: settings.mouseover_video_controls_key,
						action: {type: "toggle_controls"}
					},
					{
						key: settings.mouseover_video_playpause_key,
						action: {type: "toggle_play_pause"}
					}
				];

				for (var i = 0; i < keybinds.length; i++) {
					if (trigger_complete(keybinds[i].key)) {
						if ("requires" in keybinds[i]) {
							if (!keybinds[i].requires)
								continue;
						}

						var action = keybinds[i].action;
						action.needs_popup = true;

						actions.push(action);

						if (keybinds[i].clear)
							clear_chord();

						if (is_popup_active) {
							release_ignore = keybinds[i].key;
							ret = false;
						}

						break;
					}
				}
			}

			if (!release_ignore || !release_ignore.length) {
				release_ignore = [];
			} else {
				release_ignore = deepcopy(release_ignore);
			}

			if (actions && actions.length > 0) {
				clear_chord_wheel();

				for (var i = 0; i < actions.length; i++) {
					action_handler(actions[i]);
				}

				action_remote(actions);
			}

			if (ret === false) {
				try {
					event.preventDefault();
					event.stopImmediatePropagation();
					event.stopPropagation();
				} catch (e) {}
			}

			return ret;
		};

		var eventlistener_opts = {
			capture: true,
			passive: false
		};

		our_addEventListener(document, 'keydown', keydown_cb, eventlistener_opts);
		our_addEventListener(document, 'mousedown', keydown_cb, eventlistener_opts);
		our_addEventListener(document, 'contextmenu', keydown_cb, eventlistener_opts);
		our_addEventListener(document, 'wheel', keydown_cb, eventlistener_opts);

		var keyup_cb = function(event) {
			nir_debug("input", "keyup_cb", event);

			if (!mouseover_enabled())
				return;

			var ret = undefined;

			var condition = event_would_modify_chord(event, false, settings.mouseover_trigger_key);

			update_chord(event, false);

			var close_behavior = get_close_behavior();
			if (condition && close_behavior === "all") {
				condition = !trigger_partially_complete(event);
			}

			var can_cancel = popups_active;
			if (!can_cancel) {
				if (settings.mouseover_cancel_popup_when_release ||
					// this probably makes the most sense (#417, thanks to lnp5131 on github for reporting)
					(settings.mouseover_close_need_mouseout && !can_close_popup[1])) {
					can_cancel = true;
				}
			}

			if (condition && close_behavior !== "esc" && popup_trigger_reason === "keyboard" && can_cancel) {
				if (!settings.mouseover_close_need_mouseout || can_close_popup[1]) {
					stop_waiting();
					resetpopups();
				} else {
					can_close_popup[0] = true;
				}

				return;
			}

			// 27 = esc
			if (event.which === 27) {
				if (delay_handle_triggering && popup_trigger_reason === "mouse" && !settings.mouseover_cancel_popup_with_esc)
					return;

				stop_waiting();
				resetpopups();
			}

			if (release_ignore.length > 0) {
				var map = get_keystrs_map(event, false);
				for (var key in map) {
					var index = array_indexof(release_ignore, key);
					if (index >= 0) {
						release_ignore.splice(index, 1);
						ret = false;
					}
				}
			}

			if (ret === false) {
				try {
					event.preventDefault();
					event.stopImmediatePropagation();
					event.stopPropagation();
				} catch (e) {}
			}

			return ret;
		};

		our_addEventListener(document, 'keyup', keyup_cb, eventlistener_opts);
		our_addEventListener(document, 'mouseup', keyup_cb, eventlistener_opts);

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

		var get_move_with_cursor = function() {
			// don't require this for now, because esc can also be used to close the popup
			//var close_el_policy = get_single_setting("mouseover_close_el_policy");
			// maybe disable if popup position == center, and "move within page" is activated?
			return settings.mouseover_move_with_cursor && !popup_hold;// && close_el_policy === "thumbnail";
		};

		function do_popup_pan(popup, event, mouseX, mouseY) {
			var pan_behavior = get_single_setting("mouseover_pan_behavior");
			var move_with_cursor = get_move_with_cursor();
			if (pan_behavior === "drag" && (event.buttons === 0 || !dragstart) && !move_with_cursor)
				return;

			var viewport = get_viewport();
			var edge_buffer = 40;
			var border_thresh = 20;
			var min_move_amt = parseInt(settings.mouseover_drag_min);
			var moved = false;

			// lefttop: true = top, false = left

			var dodrag = function(lefttop) {
				var orig = parseInt(lefttop ? popup.style.top : popup.style.left);

				var mousepos = lefttop ? mouseY : mouseX;
				var dragoffset = lefttop ? dragoffsetY : dragoffsetX;
				var last = lefttop ? lastY : lastX;

				var current = mousepos - dragoffset;

				if (current !== orig) {
					if (dragged || Math_abs(current - orig) >= min_move_amt) {
						var newlast = current - (orig - last);

						if (lefttop) {
							lastY = newlast;
							popup.style.top = current + "px";
						} else {
							lastX = newlast;
							popup.style.left = current + "px";
						}

						dragged = true;
						moved = true;
					}
				}
			};

			var popup_clientrect = null;
			var domovement = function(lefttop) {
				if (!popup_clientrect) {
					popup_clientrect = get_popup_client_rect();
				}

				// offset* is very slow, slower than setting top/left! 250ms vs 30ms after a while
				//var offsetD = lefttop ? popup.offsetHeight : popup.offsetWidth;
				var offsetD = lefttop ? popup_clientrect.height : popup_clientrect.width;
				var viewportD = lefttop ? viewport[1] : viewport[0];
				var mousepos = lefttop ? mouseY : mouseX;

				if (!settings.mouseover_movement_inverted)
					mousepos = viewportD - mousepos;

				if (offsetD > viewportD) {
					var mouse_edge = Math_min(Math_max((mousepos - edge_buffer), 0), viewportD - edge_buffer * 2);
					var percent = mouse_edge / (viewportD - (edge_buffer * 2));

					var newpos = (percent * (viewportD - offsetD - border_thresh * 2) + border_thresh) + "px";

					if (lefttop)
						popup.style.top = newpos;
					else
						popup.style.left = newpos;

					moved = true;
				}
			};

			var update_pos_cache = null;
			var domovewith = function(lefttop) {
				var orig = parseInt(lefttop ? popup.style.top : popup.style.left);

				var mousepos = lefttop ? mouseY : mouseX;
				//var popupopen = lefttop ? popupOpenY : popupOpenX;
				var last = lefttop ? popupOpenLastY : popupOpenLastX;

				var current = mousepos - last + orig;

				if (settings.mouseover_move_within_page) {
					if (false) {
						var offsetD = lefttop ? popup.offsetHeight : popup.offsetWidth;
						var viewportD = lefttop ? viewport[1] : viewport[0];

						current = Math_max(current, border_thresh);

						if (current + offsetD > (viewportD - border_thresh)) {
							current = viewportD - border_thresh - offsetD;
						}
					} else if (popup_update_pos_func) {
						if (!update_pos_cache)
							update_pos_cache = popup_update_pos_func(mouseX, mouseY, false);

						current = update_pos_cache[lefttop ? 1 : 0];
					}
				}

				if (current === orig)
					return;

				var newlast = mousepos;

				if (lefttop) {
					popupOpenLastY = newlast;
					popup.style.top = current + "px";
				} else {
					popupOpenLastX = newlast;
					popup.style.left = current + "px";
				}
			};

			if (pan_behavior === "drag" && dragstart) {
				dodrag(false);
				dodrag(true);
			} else if (pan_behavior === "movement") {
				domovement(false);
				domovement(true);
			}

			if (move_with_cursor) {
				// make sure to fix this for remote (this is called at the top frame, but popup_el is remote)
				//var popup_el_rect = popup_el.getBoundingClientRect();
				var popup_el_rect = null;
				// don't check for now, maybe add this as an option later?
				if (true || in_clientrect(mouseX, mouseY, popup_el_rect)) {
					domovewith(false);
					domovewith(true);
				}
			}

			if (moved) {
				mouse_in_image_yet = false;
			}
		}

		var remote_handle_message = function(message, sender, respond) {
			if (_nir_debug_) {
				console_log("ON_REMOTE_MESSAGE", message, sender, respond);
			}

			if (message.type === "make_popup") {
				if (!is_in_iframe) {
					resetpopups();

					deserialize_img(message.data.data.data.img, function(el) {
						message.data.data.data.img = el;

						popup_el_remote = sender;
						popup_el = null;
						real_popup_el = null;
						//console_log("Making popup", message);
						makePopup(message.data.source_imu, message.data.src, message.data.processing, message.data.data);
					});
				}
			} else if (message.type === "count_gallery") {
				count_gallery(message.data.nextprev, message.data.max, message.data.is_counting, undefined, undefined, function(count) {
					respond(count);
				});
			} else if (message.type === "is_nextprev_valid") {
				is_nextprev_valid(message.data.nextprev, function(valid) {
					respond(valid);
				});
			} else if (message.type === "trigger_gallery") {
				trigger_gallery(message.data.dir, function(triggered) {
					respond(triggered);
				});
			} else if (message.type === "resetpopups") {
				resetpopups({
					from_remote: true
				});
			} else if (message.type === "mousemove") {
				// todo: offset iframe location
				mousemove_cb(message.data);
			} else if (message.type === "action") {
				for (var i = 0; i < message.data.length; i++) {
					action_handler(message.data[i]);
				}
			} else if (message.type === "popup_open") {
				popup_el_remote = sender;
				last_popup_el = null;
			}
		};

		var handle_remote_event = function(message) {
			if (message.type === "remote") {
				var respond = function() {};
				if (message.response_id) {
					var response_id = message.response_id;

					respond = function(data) {
						remote_send_reply(message.from, response_id, data);
					};
				}

				if (message.from === current_frame_id || (message.to && current_frame_id !== message.to)) {
					return true;
				}

				remote_handle_message(message.data, message.from, respond);
				return true;
			} else if (message.type === "remote_reply") {
				if (message.response_id in remote_reply_ids) {
					var response_id = message.response_id;
					delete message.response_id;

					remote_reply_ids[response_id](message.data);
				}

				return true;
			}

			return false;
		}

		if (is_extension) {
			// TODO: move out of do_mouseover
			chrome.runtime.onMessage.addListener(function(message, sender, respond) {
				if (_nir_debug_) {
					console_log("chrome.runtime.onMessage", message);
				}

				if (message.type === "context_imu") {
					popup_trigger_reason = "contextmenu";
					trigger_popup(true);
				} else if (message.type === "popupaction") {
					if (message.data.action === "replace_images") {
						replace_images_full();
					} else if (message.data.action === "highlight_images") {
						highlight_images();
					}
				} else if (message.type === "remote" || message.type === "remote_reply") {
					handle_remote_event(message);
				} else {
					general_extension_message_handler(message, sender, respond);
				}
			});
		} else {
			our_addEventListener(window, "message", function(event) {
				if (_nir_debug_) {
					console_log("window.onMessage", event);
				}

				if (!can_use_remote() || !event.data || typeof event.data !== "object" || !(imu_message_key in event.data))
					return;

				// TODO: update id_to_iframe with event.source (remember that event.source is a window object, not an iframe)

				handle_remote_event(event.data[imu_message_key]);
			}, false);
		}

		our_addEventListener(document, 'contextmenu', function(event) {
			mouseContextX = event.clientX;
			mouseContextY = event.clientY;

			mouseAbsContextX = event.pageX;
			mouseAbsContextY = event.pageY;
		});

		var last_remote_mousemove = 0;
		var last_remote_mousemove_timer = null;
		var last_remote_mousemove_event = null;

		var wheel_cb = function(event) {
			if (settings.scroll_override_page && popups_active && popup_wheel_cb) {
				return popup_wheel_cb(event, true);
			}
		};

		our_addEventListener(document, "wheel", wheel_cb, {
			passive: false
		});

		var update_mouse_from_event = function(event) {
			if (event.pageX === null && event.clientX !== null) {
				eventDoc = (event.target && event.target.ownerDocument) || document;
				doc = eventDoc.documentElement;
				body = eventDoc.body;

				event.pageX = event.clientX + scrollLeft();
				event.pageY = event.clientY + scrollTop();
			}

			if (can_use_remote()) {
				if (event.remote_info && event.remote_info.id !== current_frame_id) {
					var iframe = find_iframe_for_info(event.remote_info);
					if (!iframe) {
						return;
					}

					//console_log(iframe);
					var bb = get_bounding_client_rect(iframe);

					// fixme: should this be done?
					event.clientX += bb.left;
					event.clientY += bb.top;

					event.pageX += bb.left + window.scrollX;
					event.pageY += bb.top + window.scrollY;
				} else if (is_in_iframe) {
					// todo: add timeouts to avoid too much cpu usage
					last_remote_mousemove_event = event;

					var mindelta = 16;
					if (!settings.mouseover_use_remote) {
						mindelta = 300; // we don't need precise movements, all we need is to inform the top frame that the mouse is here
					}

					var current_time = Date.now();
					var timeout = mindelta - (current_time - last_remote_mousemove);
					if (timeout < 1)
						timeout = 1;

					if (!last_remote_mousemove_timer) {
						last_remote_mousemove_timer = setTimeout(function() {
							if (!("remote_info" in last_remote_mousemove_event)) {
								last_remote_mousemove_event.remote_info = get_frame_info();
							}

							last_remote_mousemove_timer = null;
							last_remote_mousemove = Date.now();
							remote_send_message("top", {
								type: "mousemove",
								data: serialize_event(last_remote_mousemove_event)
							});
						}, timeout);
					}
				}

				mouse_frame_id = event.remote_info ? event.remote_info.id : current_frame_id;
			}

			mouseX = event.clientX;
			mouseY = event.clientY;

			mouseAbsX = event.pageX;
			mouseAbsY = event.pageY;
		};

		var mousemove_cb = function(event) {
			mousepos_initialized = true;

			// https://stackoverflow.com/a/7790764
			event = event || window.event;

			update_mouse_from_event(event);

			if (waiting) {
				update_waiting();
			}

			if (popups_active) {
				do_popup_pan(popups[0], event, mouseX, mouseY);
			}

			var jitter_base = settings.mouseover_jitter_threshold;

			var do_mouse_close_kbd = popup_trigger_reason === "keyboard" && get_close_need_mouseout() && popups_active;
			var do_mouse_close_mouse = popup_trigger_reason === "mouse";

			if (do_mouse_close_kbd || do_mouse_close_mouse) {
				if (popups_active) {
					// FIXME: why was this not in if (popups_active)?
					// The reason for putting it here is that if the mouse moves (even within jitter thresh) after a single popup is open, it will cancel the popup request
					if (delay_handle) {
						clearTimeout(delay_handle);
						delay_handle = null;

						if (false && waiting)
							stop_waiting();
					}

					var jitter_threshx = 40;
					var jitter_threshy = jitter_threshx;

					//var img = popups[0].getElementsByTagName("img")[0];
					var img = get_popup_media_el();
					var imgmiddleX = null;
					var imgmiddleY = null;
					var in_img_jitter = false;
					if (img) {
						var rect = get_popup_media_client_rect();

						in_img_jitter = in_clientrect(mouseX, mouseY, rect, jitter_base);

						var w = rect.width;
						var h = rect.height;

						imgmiddleX = rect.x + rect.width / 2;
						imgmiddleY = rect.y + rect.height / 2;

						jitter_threshx = Math_max(jitter_threshx, w / 2);
						jitter_threshy = Math_max(jitter_threshy, h / 2);

						jitter_threshx += jitter_base;
						jitter_threshy += jitter_base;

						/*console_log(jitter_threshx, img.naturalWidth, w);
						console_log(jitter_threshy, img.naturalHeight, h);*/
						if (mouse_in_image_yet === false) {
							if (in_clientrect(mouseX, mouseY, rect)) {
								mouse_in_image_yet = true;
							}
						}
					}

					var do_mouse_reset = function() {
						if (popup_hold) {
							can_close_popup[1] = true;
						} else {
							resetpopups();
						}
					};

					var close_el_policy = get_single_setting("mouseover_close_el_policy");
					var close_on_leave_el = (close_el_policy === "thumbnail" || close_el_policy === "both") && popup_el && !popup_el_automatic;
					var outside_of_popup_el = false;
					var popup_el_hidden = false;

					// check if we should check if the mouse has left popup_el (the source/thumbnail that was popped up from, _not_ the element of the popup)
					if (close_on_leave_el) {
						var popup_el_rect = get_bounding_client_rect(popup_el);

						// check if the source element is visible
						if (popup_el_rect && popup_el_rect.width > 0 && popup_el_rect.height > 0) {
							var our_in_img_jitter = in_img_jitter;
							if (close_el_policy === "thumbnail")
								our_in_img_jitter = false; // if not "both", we don't care if the mouse is still in the popup, only if it has left the thumbnail

							if (!in_clientrect(mouseX, mouseY, popup_el_rect) && !our_in_img_jitter) {
								outside_of_popup_el = true;

								if (close_el_policy === "thumbnail") {
									return do_mouse_reset();
								}
							}
						} else {
							// the element must be hidden
							popup_el_hidden = true;
						}
					}

					can_close_popup[1] = false;
					if (mouse_in_image_yet && (!close_on_leave_el || outside_of_popup_el || popup_el_hidden)) {
						if (imgmiddleX && imgmiddleY &&
							(Math_abs(mouseX - imgmiddleX) > jitter_threshx ||
							 Math_abs(mouseY - imgmiddleY) > jitter_threshy)) {
							//console_log(mouseX, imgmiddleX, jitter_threshx);
							//console_log(mouseY, imgmiddleY, jitter_threshy);

							do_mouse_reset();
						}
					} else if (close_on_leave_el) {
						if (outside_of_popup_el) {
							do_mouse_reset();
						}
					}
				} else if (do_mouse_close_mouse && delay_handle_triggering) {
					if (next_popup_el && settings.mouseover_cancel_popup_when_elout) {
						var popup_el_rect = get_bounding_client_rect(next_popup_el);
						if (!in_clientrect(mouseX, mouseY, popup_el_rect)) {
							resetpopups();
						}
					}
				}
			}

			if (mouseover_mouse_enabled()) {
				// FIXME: this is rather weird. Less CPU usage, but doesn't behave in the way one would expect
				if ((!popups_active || popup_el_automatic) && !should_exclude_imagetab()) {
					if (delay_handle && !settings.mouseover_trigger_mouseover) {
						var trigger_mouse_jitter_thresh = 10;

						if (Math_abs(mouseX - mouseDelayX) < trigger_mouse_jitter_thresh &&
							Math_abs(mouseY - mouseDelayY) < trigger_mouse_jitter_thresh)
							return;

						clearTimeout(delay_handle);
						delay_handle = null;
					}

					mouseDelayX = mouseX;
					mouseDelayY = mouseY;
					//mouse_in_image_yet = false;

					if (last_popup_el) {
						var popup_el_rect = get_bounding_client_rect(last_popup_el);
						if (!in_clientrect(mouseX, mouseY, popup_el_rect)) {
							last_popup_el = null;
						}
					}

					if (!settings.mouseover_trigger_mouseover) {
						delay_handle = setTimeout(function() {
							if (!popup_mouse_head())
								return;

							trigger_popup();
						}, delay * 1000);
					}
				}
			}
		};

		our_addEventListener(document, 'mousemove', mousemove_cb);
	}

	function do_websitehome() {
		if (require_rules_failed)
			return;

		unsafeWindow.imu_variable = bigimage_recursive;
		unsafeWindow.imu_inject = 1;
		unsafeWindow.do_imu = function(url, cb) {
			return bigimage_recursive(url, {
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
								check_image_unref(img);
								loop_url(obj, cb, options, finalurl);
							}
						});
					} else {
						cb(img, newurl, obj[obj_indexOf(obj, finalurl)]);
					}
				}, options);
			};

			if (settings.website_image) {
				loop_url(obj, function(img, url, obj) {
					if (!img) {
						orig_set_max("broken");
					} else {
						var newobj = obj;
						if (!newobj)
							newobj = {url: url};

						orig_set_max([newobj]);
						maximgel.src = img.src;
					}
				}, {running: true});
			} else if (obj.can_head) {
				loop_url(obj, function(resp) {
					if (!resp) {
						orig_set_max("broken");
					} else {
						var newobj = obj;
						if (!newobj)
							newobj = {url: resp.finalUrl};

						orig_set_max([newobj]);
					}
				}, {running: true, head: true});
			} else {
				orig_set_max(obj);
			}
		};
	}

	var set_require_rules_failed_el = function(el) {
		if (!require_rules_failed)
			return false;

		el.style.color = "#ff3333";

		el.innerText = "Error: Rules cannot be loaded.\nPlease either try reinstalling the script, or ";

		var github_link = document.createElement("a");
		github_link.href = userscript_update_url;
		github_link.target = "_blank";
		github_link.innerText = "install the github version";
		el.appendChild(github_link);

		var reason_el = document.createElement("p");
		reason_el.innerText = "Error reason:";
		reason_el.style.color = "#000";
		reason_el.style.marginTop = "1em";
		reason_el.style.marginBottom = "1em";

		try {
			var error_message = document.createElement("pre");
			error_message.style.color = "#000";
			error_message.innerText = require_rules_failed.message;

			el.appendChild(reason_el);
			el.appendChild(error_message);
		} catch (e) {
			console_error(e);
		}

		return true;
	}

	var do_userscript_page = function(imgel, latest_version) {
		var status_container_el = document_createElement("div");
		status_container_el.style.marginBottom = "2em";

		var version_el = document_createElement("span");
		version_el.style.fontSize = "90%";
		version_el.style.fontWeight = 800;
		version_el.style.marginRight = "2em";

		var version = null;
		try {
			version = gm_info.script.version;
		} catch (e) {
		}

		if (!set_require_rules_failed_el(version_el)) {
			version_el.innerText = "Installed";

			if (version !== null) {
				version_el.innerText += " (v" + version;

				if (latest_version) {
					var compared = version_compare(latest_version, version);
					if (compared === -1) {
						version_el.innerText += ", update available";
					}
				}

				version_el.innerText += ")";
			}

			options_el = document_createElement("a");
			options_el.innerText = "Options";
			options_el.style.background = "#0af";
			options_el.style.padding = "0.5em 1em";
			options_el.style.color = "white";
			options_el.style.display = "inline-block";
			options_el.style.textDecoration = "none";
			options_el.target = "_blank";
			options_el.href = "https://qsniyg.github.io/maxurl/options.html";
		}

		status_container_el.appendChild(version_el);
		if (!require_rules_failed) status_container_el.appendChild(options_el);
		imgel.parentElement.appendChild(status_container_el);
	};

	var do_greasyfork_page = function() {
		var imgel = document.querySelector("div.script-author-description > center > img[alt='Image Max URL']");

		// greasyfork redesign
		if (!imgel)
			imgel = document.querySelector("#additional-info > center > img[alt='Image Max URL']");

		if (!imgel)
			return;

		// make sure it's the same general layout
		if (imgel.parentElement.previousElementSibling ||
			imgel.parentElement.nextElementSibling.tagName !== "UL")
			return;

		var gf_version = null;
		var gf_version_el = document.querySelector("dd.script-show-version");
		if (gf_version_el) {
			gf_version = gf_version_el.innerText.replace(/^\s*|\s*$/, "");
		}

		do_userscript_page(imgel, gf_version);
	};

	var do_oujs_page = function() {
		var imgel = document.querySelector("div#user-content > p[align='center'] img[alt='Image Max URL']");
		if (!imgel)
			return;

		// make sure it's the same general layout
		if ((imgel.parentElement.previousElementSibling && imgel.parentElement.previousElementSibling.tagName !== "HR") ||
			imgel.parentElement.nextElementSibling.tagName !== "UL")
			return;

		var latest_version = null;
		var version_icon_el = document.querySelector("div.script-meta i.fa-history");
		if (version_icon_el) {
			var code_el = version_icon_el.parentElement.querySelector("code");
			if (code_el) {
				latest_version = code_el.innerText.replace(/[+].*/, "");
				if (!/^[0-9.]+$/.test(latest_version))
					latest_version = null;
			}
		}

		do_userscript_page(imgel, latest_version);
	};

	function start() {
		do_export();

		if (is_interactive) {
			if (is_maxurl_website || is_options_page) {
				onload(function() {
					update_dark_mode();
				});
			}

			if (is_options_page) {
				onload(function() {
					try {
						do_options();
					} catch (e) {
						console_error(e);

						var error_pre = document_createElement("pre");
						error_pre.style.fontFamily = "monospace";
						error_pre.style.margin = "1em";
						error_pre.innerText = get_crashlog_info() + "\n" + e.toString() + "\n" + e.stack;

						var error_div = document_createElement("div");
						var error_div_text = "Error loading options page, please report this to <a href='" + github_issues_page + "'>" + github_issues_page + "</a>, ";
						error_div_text += "and include the following information in the report:";
						error_div.innerHTML = error_div_text;

						error_div.appendChild(error_pre);

						document.body.innerHTML = error_div.outerHTML;
					}
				});
			}

			if (settings.imu_enabled) {
				if (settings.redirect) {
					do_redirect();
				}

				if (settings.website_inject_imu &&
					(window.location.href.match(/^https?:\/\/qsniyg\.github\.io\/+maxurl(\/+|\/+index\.html)?(?:[?#].*)?$/) ||
						window.location.href.match(/^file:\/\/.*\/maxurl\/site\/index\.html/))) {
					if (typeof (unsafeWindow) !== "undefined") {
						onload(function () {
							do_websitehome();
						});
					}
				}
			}

			if (is_userscript) {
				if (window.location.href.match(/^https?:\/\/(?:www\.)?greasyfork\.org\/+[^/]*\/+scripts\/+36662(?:-[^/]*)?(?:[?#].*)?$/)) {
					onload(function() {
						do_greasyfork_page();
					});
				} else if (window.location.href.match(/^https?:\/\/(?:www\.)?openuserjs\.org\/+scripts\/+qsniyg\/+Image_Max_URL(?:[?#].*)?$/)) {
					onload(function() {
						do_oujs_page();
					});
				}
			}

			do_mouseover();

			if (is_extension) {
				extension_send_message({
					type: "ready"
				});
			}
		} else if (is_extension_bg) {
			imu_userscript_message_sender = general_extension_message_handler;
		}
	}

	if (_nir_debug_)
		console_log("Finished initial loading");

	do_config();
})();

// @license-end
