// This is heavily based on ViolentMonkey's implementation:
// https://github.com/violentmonkey/violentmonkey/blob/9e672d5590aea144840681b6f2ce0c267d57fc13/src/background/utils/requests.js
// https://github.com/violentmonkey/violentmonkey/blob/9e672d5590aea144840681b6f2ce0c267d57fc13/src/common/index.js

var background_tab = null;
chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
	background_tab = tabs[0];
});

var requests = {};
var redirects = {};
var loading_urls = {};
var loading_redirects = {};
var tabs_ready = {};
var request_headers = {};
var override_headers = {};
var override_download = {};
var reqid_to_redid = {};
var notifications = {};

var ready_functions = [];
var on_ready = function(f) {
	ready_functions.push(f);
};

var run_ready = function() {
	ready_functions.forEach(function(f) {
		f();
	});
};

var handle_error = function(context) {
	var last_error = chrome.runtime.lastError;
	if (last_error) {
		console.error(JSON.stringify(last_error), context);
	}
}

var background_userscript_tabid = "::IMU::background_userscript";

var storage = null;

var set_storage_to_local = function() {
	console.warn("Unable to use sync storage, using local storage instead");
	storage = chrome.storage.local;
};

try {
	storage = chrome.storage.sync;
	storage.get("nonexistent value", function() {
		// This can happen if webextensions.storage.sync is disabled: https://github.com/qsniyg/maxurl/issues/287#issuecomment-612106677
		if (chrome.runtime.lastError && chrome.runtime.lastError.toString().indexOf("webextensions.storage.sync.enabled") >= 0) {
			set_storage_to_local();
		}

		run_ready();
	});
} catch (e) {
	console.error(e);
	storage = null;
}

if (!storage) {
	set_storage_to_local();
}

var is_firefox = navigator.userAgent.indexOf("Firefox") >= 0;

var nir_debug = false;
var debug = function() {
	if (nir_debug) {
		return console.log.apply(this, arguments);
	}
};

var get_random_id = function(obj) {
	var rand = Math.floor((1+Math.random())*100000000000).toString(36);
	var id = Date.now().toString(36) + rand;

	if (obj !== undefined && (id in obj)) {
		return get_random_id(obj);
	}

	return id;
};

var header_nonce = get_random_id();
//var header_url_regex = new RegExp("^https?:\/\/[^/]+\/+#IMU-" + header_nonce + "-(.*)");

var get_imu_header_name = function(header_name, type) {
	if (!type) type = "H";
	return "X-IMU-" + header_nonce + "-" + type + "-" + header_name;
};

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

	return headers;
};

var stringify_headers = function(headers) {
	var newheaders = [];

	for (var i = 0; i < headers.length; i++) {
		newheaders.push(headers[i].name + ": " + headers[i].value);
	}

	return newheaders.join("\r\n");
};

var create_cookieheader = function(cookies) {
	var array = [];

	for (var i = 0; i < cookies.length; i++) {
		array.push(cookies[i].name + "=" + cookies[i].value);
	}

	return array.join("; ");
};

var get_domain = function(url) {
	return url.replace(/^[a-z]+:\/\/(?:www\.)?([^/]+)(?:\/*.*)?$/, "$1");
};

var same_cookie_domain = function(url1, url2) {
	return get_domain(url1) === get_domain(url2);
};

var use_header = function(value) {
	return value !== "" && value !== null;
};

var is_override_relevant = function(override, details) {
	return override.url === details.url && override.method === details.method;
};

var get_overrides = function(details) {
	var overrides = [];

	if (!(details.tabId in override_headers)) return overrides;

	for (const override of override_headers[details.tabId]) {
		if (is_override_relevant(override, details)) {
			overrides.push(override);
		}
	}

	return overrides;
};

// currently used to detect if the extension is unloaded
chrome.runtime.onConnect.addListener(function() {});

var do_request = function(request, sender) {
	debug("do_request", request, sender);

	var id = get_random_id(requests);
	var method = request.method || "GET";

	var xhr = new XMLHttpRequest();
	xhr.open(method, request.url, true);

	if (request.responseType) {
		if (request.responseType === "arraybuffer") {
			request.responseType = "blob";
			request.wanted_responseType = "arraybuffer";
		}

		xhr.responseType = request.responseType;
	}

	if (request.timeout) {
		xhr.timeout = request.timeout;
	}

	var headers = request.headers || {};
	var cookie_overridden = false;
	for (var header in headers) {
		if (header.toLowerCase() == "cookie")
			cookie_overridden = true;

		var value = headers[header];
		if (use_header(value)) {
			xhr.setRequestHeader(get_imu_header_name(header), headers[header]);
		} else {
			xhr.setRequestHeader(get_imu_header_name(header, "D"), "true");
		}
	}

	//xhr.setRequestHeader("IMU-Verify", id);

	var do_final = function(event, final, cb) {
		var server_headers = null;
		if (requests[id].server_headers) {
			server_headers = requests[id].server_headers;
		}

		if (final)
			delete requests[id];

		debug("XHR", xhr);

		var resp = {
			readyState: xhr.readyState,
			finalUrl: xhr.responseURL,
			responseHeaders: xhr.getAllResponseHeaders(),
			responseType: xhr.responseType,
			status: xhr.status, // file:// returns 0, tracking protection also returns 0
			realStatus: xhr.status,
			statusText: xhr.statusText,

			// progress
			lengthComputable: event.lengthComputable,
			loaded: event.loaded,
			total: event.total
		};

		if (server_headers) {
			var parsed_responseheaders = parse_headers(resp.responseHeaders);
			var keys = {};

			parsed_responseheaders.forEach(header => {
				keys[header.name] = true;
			});

			server_headers.forEach(header => {
				if (!(header.name.toLowerCase() in keys)) {
					header.value.split("\n").forEach(value => {
						parsed_responseheaders.push({ name: header.name.toLowerCase(), value: value });
					});
				}
			});

			resp.responseHeaders = stringify_headers(parsed_responseheaders);
		}

		var endcb = function(data) {
			debug("XHR (result)", data);
			cb(data);
		};

		if (resp.readyState === 4) {
			try {
				resp.responseText = xhr.responseText;
			} catch (e) {
			}

			if (resp.responseType === "blob") {
				if (request.wanted_responseType)
					resp._wanted_responseType = request.wanted_responseType;

				var body = xhr.response;
				if (!body) {
					resp.status = xhr.status;
					endcb(resp);
					return;
				}

				var use_blob_url = true;

				// firefox doesn't support sending blob urls to different context IDs
				// fixme: is there a way to find our contextId? querying our background tab doesn't show this info as it's only available under MessageSender.
				if (is_firefox && background_tab && sender.tab.cookieStoreId !== background_tab.cookieStoreId)
					use_blob_url = false;

				if (!use_blob_url) {
					var reader = new FileReader();
					reader.onload = function() {
						var array = new Uint8Array(reader.result);
						var value = '';
						for (let i = 0; i < array.length; i += 1) {
							value += String.fromCharCode(array[i]);
						}

						resp._responseEncoded = {
							value,
							type: body.type,
							name: body.name,
							lastModified: body.lastModified
						};

						endcb(resp);
					};
					reader.readAsArrayBuffer(body);
				} else {
					var objurl = URL.createObjectURL(body);
					resp._responseEncoded = {
						objurl: objurl,
						type: body.type,
						name: body.name,
						lastModified: body.lastModified
					};

					endcb(resp);
				}
			} else {
				endcb(resp);
			}
		} else {
			endcb(resp);
		}
	};

	var add_handler = function(event, final, empty) {
		xhr[event] = function(e) {
			debug("XHR event: ", event);

			var obj = {
				tabid: sender.tab.id,
				event: event,
				final: final,
				reqid: id
			};

			if (empty) {
				return xhr_final_handler(null, obj);
			}

			do_final(e, final, function(resp) {
				xhr_final_handler(resp, obj);
			});
		};
	};

	add_handler("onload", true);
	add_handler("onerror", true);
	add_handler("onprogress", false);
	add_handler("onabort", true, true);
	add_handler("ontimeout", true);

	requests[id] = {
		id: id,
		xhr: xhr,
		url: request.url
	};

	var send_request = function() {
		try {
			xhr.send(request.data);
		} catch (e) {
			console.error(e);
			xhr.abort();
		}
	};

	if (!cookie_overridden) {
		var cookies_options = {};

		// doesn't exist for background userscript
		if (sender.tab.id) cookies_options.tabid = sender.tab.id;
		if (sender.tab.cookieStoreId) cookies_options.store = sender.tab.cookieStoreId;

		var cookie_url = request.cookie_url || request.url;

		get_cookies(cookie_url, function(cookies) {
			if (cookies !== null) {
				xhr.setRequestHeader(get_imu_header_name("Cookie"), create_cookieheader(cookies));
				requests[id].cookies_added = true;
			}

			send_request();
		}, cookies_options);
	} else {
		send_request();
	}

	return id;
};

// failed experiment to try to run requests in the page
if (false) {
	var onBeforeRequest_listener = function(details) {
		console.log("onBeforeRequest", details);

		var header_url_match = details.url.match(header_url_regex);
		if (header_url_match) {
			return {
				redirectUrl: decodeURIComponent(header_url_match[1])
			};
		}

		return {};
	};
	chrome.webRequest.onBeforeRequest.addListener(
		onBeforeRequest_listener,
		{
			urls: ['<all_urls>'],
			types: ['xmlhttprequest']
		},
		['blocking', 'requestBody']
	);
}

// Modify request headers if needed
var onBeforeSendHeaders_listener = function(details) {
	debug("onBeforeSendHeaders", details);

	var headers = details.requestHeaders;
	var new_headers = [];
	var imu_headers = [];
	var remove_headers = [];
	var request_id;

	if (details.tabId in redirects) {
		var redirect = redirects[details.tabId];
		//delete redirects[details.tabId];

		if (!(redirect instanceof Array))
			redirect = [redirect];

		debug("Redirect", details.tabId, redirect);

		loading_urls[details.tabId] = details.url;

		if (!redirect) {
			return;
		}

		var rheaders = null;
		for (var i = 0; i < redirect.length; i++) {
			if (redirect[i].url === details.url) {
				loading_redirects[details.tabId] = redirect[i];
				rheaders = redirect[i].headers;
				break;
			}
		}

		if (!rheaders) {
			//return;
		}

		for (var header in rheaders) {
			headers.push({
				name: get_imu_header_name(header),
				value: rheaders[header]
			});
		}
	}

	debug("Headers", headers);

	headers.forEach(function(header) {
		if (!header.name.startsWith("X-IMU-" + header_nonce + "-")) {
			new_headers.push(header);
			return;
		}

		var simple_name = header.name.slice(("X-IMU-" + header_nonce + "-").length);
		var wanted_header_name = simple_name.slice(2);

		if (simple_name.startsWith("H-")) {
			imu_headers.push({
				name: wanted_header_name,
				value: header.value
			});
		} else if (simple_name.startsWith("D-")) {
			remove_headers.push(wanted_header_name.toLowerCase());
		} else {
			console.error("Unknown header", header);
		}
	});

	if (imu_headers.length === 0) {
		// This is useful for redirects, which strip IMU headers
		if (details.requestId in request_headers) {
			imu_headers = JSON.parse(JSON.stringify(request_headers[details.requestId]));
		} else if (details.tabId in override_headers) {
			var overrides = get_overrides(details);
			if (overrides.length > 0) {
				var override = overrides[0];

				imu_headers = [];
				for (var header in override.headers) {
					imu_headers.push({
						name: header,
						value: override.headers[header]
					});
				}
			}
		}
	}

	if (request_id && request_id in requests) {
		for (var i = 0; i < imu_headers.length; i++) {
			if (imu_headers[i].name.toLowerCase() === "cookie" && !same_cookie_domain(requests[request_id].url, details.url)) {
				imu_headers.splice(i, 1);
				i--;
			}
		}
	}

	// no need to do anything
	if (!imu_headers.length && !remove_headers.length) return;

	if (imu_headers.length > 0) {
		request_headers[details.requestId] = imu_headers;
	}

	for (const remove of remove_headers) {
		for (var i = 0; i < new_headers.length; i++) {
			if (new_headers[i].name.toLowerCase() === remove) {
				new_headers.splice(i, 1);
				break;
			}
		}
	}

	for (var i = 0; i < imu_headers.length; i++) {
		var use_this = use_header(imu_headers[i].value);
		if (use_this)
			imu_headers[i].value = imu_headers[i].value.toString(); // e.g. for numbers

		var found = false;
		for (var j = 0; j < new_headers.length; j++) {
			if (new_headers[j].name === imu_headers[i].name) {

				if (use_this) {
					new_headers[j] = imu_headers[i];
				} else {
					new_headers.splice(j, 1);
				}

				found = true;
				break;
			}
		}

		if (!found && use_this)
			new_headers.push(imu_headers[i]);
	}

	debug("New headers", new_headers);

	return {
		requestHeaders: new_headers
	};
}

var onBeforeSendHeaders_filter = {
	urls: ['<all_urls>'],
	types: ['xmlhttprequest', 'main_frame', 'sub_frame', 'image', 'media']
};

try {
	chrome.webRequest.onBeforeSendHeaders.addListener(
		onBeforeSendHeaders_listener, onBeforeSendHeaders_filter,
		['blocking', 'requestHeaders', 'extraHeaders']
	);
} catch (e) {
	chrome.webRequest.onBeforeSendHeaders.addListener(
		onBeforeSendHeaders_listener, onBeforeSendHeaders_filter,
		['blocking', 'requestHeaders']
	);
}

function parse_contentdisposition(cdp) {
	var out = [];
	var current_kv = [];
	var current = "";
	var in_quote = false;
	for (var i = 0; i < cdp.length; i++) {
		var c = cdp[i];

		if (!in_quote && c == ";") {
			if (current.length > 0) {
				if (current_kv.length === 0)
					current = current.toLowerCase();
				current_kv.push(current);
			}

			out.push(current_kv);
			current_kv = [];
			current = "";
			in_quote = false;
		}

		if (!in_quote && /\s/.test(c)) {
			continue;
		}

		if (current_kv.length !== 0) {
			if (in_quote && c === in_quote) {
				in_quote = false;
			} else if (!in_quote && (c === "'" || c === '"')) {
				in_quote = c;
			}
		} else {
			if (c === "=") {
				current_kv.push(current.toLowerCase());
				current = "";
				in_quote = false;
				continue;
			}
		}

		current += c;
	}

	if (current.length > 0)
		current_kv.push(current);

	if (current_kv.length > 0)
		out.push(current_kv);

	return out;
}

function stringify_contentdisposition(cdp) {
	var out_strings = [];
	for (var i = 0; i < cdp.length; i++) {
		var quotec = '"';

		if (cdp[i].length > 1) {
			if (cdp[i][1].indexOf('"') >= 0) {
				quotec = "'";
			}

			if (!cdp[i][1].match(/\s/g)) {
				quotec = "";
			}

			out_strings.push(cdp[i][0] + "=" + quotec + cdp[i][1] + quotec);
		} else {
			out_strings.push(cdp[i][0]);
		}
	}

	return out_strings.join("; ");
}

function parse_contentsecurity(csp) {
	var obj = {};

	var splitted = csp.split(/\s*;\s*/);
	for (var i = 0; i < splitted.length; i++) {
		var sources = splitted[i].split(/\s+/);
		var name = sources.shift();

		if (name in obj) {
			[].push.apply(obj[name], sources);
		} else {
			obj[name] = sources;
		}
	}

	return obj;
}

function get_nonce(sources, defaultobj) {
	if (sources.indexOf("'none'") >= 0)
		return false;

	var obj = {
		nonce: null,
		unsafe_inline: null,
		data: null
	};

	if (defaultobj) {
		obj.nonce = defaultobj.nonce;
		obj.unsafe_inline = defaultobj.unsafe_inline;
		obj.data = defaultobj.data;
	}

	if (sources.indexOf("'unsafe-inline'") >= 0)
		obj.unsafe_inline = true;

	if (sources.indexOf("'strict-dynamic'") >= 0)
		obj.unsafe_inline = false;

	for (var i = 0; i < sources.length; i++) {
		var match = sources[i].match(/^nonce-(.*)$/);
		if (match) {
			obj.nonce = match[1];
			obj.unsafe_inline = false;
			break;
		}
	}

	if (sources.indexOf("data:") >= 0)
		obj.data = true;

	return obj;
}

function get_nonces(parsed_csp) {
	var default_obj = false;
	var img_obj, style_obj = null;

	if ("default-src" in parsed_csp) {
		default_obj = get_nonce(parsed_csp["default-src"]);
	}

	if ("img-src" in parsed_csp) {
		img_obj = get_nonce(parsed_csp["img-src"], default_obj);
	}

	if ("style-src" in parsed_csp) {
		style_obj = get_nonce(parsed_csp["style-src"], default_obj);
	}

	return {
		img: img_obj,
		style: style_obj
	};
}

// Intercept response headers if needed
var onHeadersReceived = function(details) {
	debug("onHeadersReceived", details);

	if (details.requestId in reqid_to_redid) {
		var redid = reqid_to_redid[details.requestId];
		requests[redid].server_headers = details.responseHeaders;
	}

	// this has to be before the in loading_urls check because it's also in loading_urls
	if (details.tabId in override_download) {
		var newheaders = [];

		var override_data = override_download[details.tabId];
		var contentdisposition_data = [["attachment"]];
		if (override_data.filename) {
			contentdisposition_data.push(["filename", override_data.filename]);
		}

		details.responseHeaders.forEach((header) => {
			if (header.name.toLowerCase() === "content-disposition")
				return;

			newheaders.push(header);
		});

		newheaders.push({
			name: "Content-Disposition",
			value: stringify_contentdisposition(contentdisposition_data)
		});

		debug("(override_download) Old headers", details.responseHeaders);
		debug("(override_download) New headers", newheaders, contentdisposition_data);

		return {
			responseHeaders: newheaders
		};
	} else if (details.tabId in loading_urls) {
		var newheaders = [];

		var imu = {};
		if (details.tabId in loading_redirects)
			imu = loading_redirects[details.tabId];

		var filename = imu.filename;
		if (typeof filename !== "string" || filename.length === 0)
			filename = undefined;

		var replaced_filename = false;

		details.responseHeaders.forEach((header) => {
			var name = header.name.toLowerCase();
			var value = header.value;

			if (name === "content-type") {
				// [image/png] -> image/png
				value = value.replace(/^ *\[(.*?)\]/, "$1");
				header.value = value;
				if (!value.match(/^ *binary\//) &&
						!value.match(/^ *application\//)) {
					newheaders.push(header);
				}
			} else if (name === "x-content-type-options") {
				// x-content-type-options: nosniff -- if content-type is removed, nosniff will display it as plain text
				return;
			} else if (name === "content-disposition") {
				try {
					var parsed = parse_contentdisposition(value);

					// Disable forced downloads
					if (parsed.length > 0 && parsed[0].length === 1 && parsed[0][0].toLowerCase() === "attachment")
						parsed[0][0] = "inline";

					if (filename !== undefined) {
						for (var i = 0; i < parsed.length; i++) {
							// TODO: support filename*
							if (parsed[i][0] === "filename") {
								parsed[i][1] = filename;
								replaced_filename = true;
							}
						}

						if (!replaced_filename) {
							parsed.push(["filename", filename]);
							replaced_filename = true;
						}
					}

					newheaders.push({
						name: "Content-Disposition",
						value: stringify_contentdisposition(parsed)
					});
				} catch (e) {
					console.error(e);
					newheaders.push(header);
				}
			} else {
				newheaders.push(header);
			}
		});

		if (!replaced_filename && filename !== undefined) {
			var cdp = [
				["inline"],
				["filename", filename]
			];

			newheaders.push({
				name: "Content-Disposition",
				value: stringify_contentdisposition(cdp)
			});
		}

		//debug(details);
		debug("Old headers", details.responseHeaders);
		debug("New headers", newheaders);

		return {
			responseHeaders: newheaders
		};
	} else if (!details.documentUrl && details.type === "main_frame") {
		// new document replacing page
		if (typeof imu_userscript_message_sender === "function") {
			imu_userscript_message_sender({
				type: "bg_redirect",
				data: details
			});
		}
	} else {
		// crossorigin=anonymous requests (e.g. ttloader from tiktok) can fail to load without Access-Control-Allow-Origin
		var overrides = get_overrides(details);
		if (overrides.length && (overrides[0].anonymous || overrides[0].content_type)) {
			var override_hdrs = [];

			if (overrides[0].anonymous) {
				override_hdrs.push({
					name: "Access-Control-Allow-Origin",
					value: "*"
				});
			}

			if (overrides[0].content_type) {
				override_hdrs.push({
					name: "Content-Type",
					value: overrides[0].content_type
				});
			}

			var newheaders = [];
			details.responseHeaders.forEach(function(header) {
				for (const hdr of override_hdrs) {
					if (header.name.toLowerCase() === hdr.name.toLowerCase())
						return;
				}

				newheaders.push(header);
			});

			[].push.apply(newheaders, override_hdrs);

			//debug(details);
			debug("Overrides", overrides[0]);
			debug("Old headers", details.responseHeaders);
			debug("New headers", newheaders);

			return {
				responseHeaders: newheaders
			};
		}
	}
};

var received_types = ['xmlhttprequest', 'main_frame', 'sub_frame', 'image', 'media'];
try {
	chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {
		urls: ['<all_urls>'],
		types: received_types
	}, ['blocking', 'responseHeaders', 'extraHeaders']);
} catch (e) {
	chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {
		urls: ['<all_urls>'],
		types: received_types
	}, ['blocking', 'responseHeaders']);
}


// Remove loading_urls once headers have finished loading
chrome.webRequest.onResponseStarted.addListener(function(details) {
	debug("onResponseStarted", details, loading_urls);

	if (details.tabId in loading_urls) {
		delete loading_urls[details.tabId];
	}

	if (details.tabId in loading_redirects) {
		delete loading_redirects[details.tabId];
	}

	if (details.tabId in override_headers) {
		var new_override = [];
		var removed = false;
		for (const override of override_headers[details.tabId]) {
			if (removed || !is_override_relevant(override, details)) {
				new_override.push(override);
			} else {
				removed = true;
			}
		}

		//debug("old override_headers", override_headers[details.tabId]);
		//debug("new override_headers", new_override);
		override_headers[details.tabId] = new_override;
	}

	if (details.requestId in request_headers) {
		delete request_headers[details.requestId];
	}

	if (details.requestId in reqid_to_redid) {
		delete reqid_to_redid[details.requestId];
	}
}, {
	urls: ['<all_urls>'],
	types: ['xmlhttprequest', 'main_frame', 'sub_frame']
}, ['responseHeaders']);

function get_cookies(url, cb, options) {
	if (!options) options = {};

	var end = function (store) {
		var base_options = { url: url };
		if (store) base_options.storeId = store;

		var new_options = JSON.parse(JSON.stringify(base_options));
		new_options.firstPartyDomain = null;

		var endcb = function(cookies) {
			debug("get_cookies: " + url, cookies, store);
			cb(JSON.parse(JSON.stringify(cookies)));
		};

		try {
			chrome.cookies.getAll(new_options, endcb);
		} catch (e) {
			try {
				chrome.cookies.getAll(base_options, endcb);
			} catch (e) {
				console.error(e);
				cb(null);
			}
		}
	};

	if (!options.store) {
		var tabid = options.tabid;
		if (tabid === background_userscript_tabid) tabid = null;

		// TODO: cache
		try {
			chrome.cookies.getAllCookieStores(function (stores) {
				var store = null;
				for (var i = 0; i < stores.length; i++) {
					if ((tabid && stores[i].tabIds.indexOf(tabid) >= 0) || !tabid) {
						store = stores[i].id;
						break;
					}
				}

				if (store) {
					return end(store);
				} else {
					return end();
				}
			});
		} catch (e) {
			console.error(e);
			end();
		}
	} else {
		end(options.store);
	}
}

var xhr_final_handler = function(_data, obj) {
	var message_data = {
		type: "request",
		data: {
			event: obj.event,
			final: obj.final,
			id: obj.reqid,
			data: _data
		}
	};

	if (obj.tabid !== background_userscript_tabid) {
		chrome.tabs.sendMessage(obj.tabid, message_data);
	} else {
		imu_userscript_message_sender(message_data);
	}
};

var download_with_tabs = function(tab_options, imu, filename, respond) {
	chrome.tabs.create(tab_options, function (tab) {
		debug("newTab (download)", tab);
		redirects[tab.id] = imu;

		override_download[tab.id] = {
			filename: filename
		};

		respond({
			type: "download"
		});
	});
};

// Message handler
var extension_message_handler = (message, sender, respond) => {
	if (message && message.type !== "getvalue") {
		debug("onMessage", message, sender, respond);
	}

	if (message.type === "request") {
		var reqid;

		reqid = do_request(message.data, sender);
		respond({
			type: "id",
			data: reqid
		});

		return true;
	} else if (message.type === "abort_request") {
		if (!(message.data in requests)) {
			console.error("Unable to find request ID: " + message.data);
			return;
		}

		requests[message.data].xhr.abort();
	} else if (message.type === "get_request_nonce") {
		respond({
			type: "request_nonce",
			data: header_nonce
		});

		return true;
	} else if (message.type === "redirect") {
		var tabid = message.data.tabId || sender.tab.id;
		redirects[tabid] = message.data.obj;
	} else if (message.type === "newtab") {
		var tab_options = {
			url: message.data.imu.url,
			openerTabId: sender.tab.id
		};

		if (message.data.background)
			tab_options.active = false;
		else if (message.data.background === false) // if undefined, don't set it so that it will use the browser's default
			tab_options.active = true;

		chrome.tabs.create(tab_options, function (tab) {
			debug("newTab", tab);
			redirects[tab.id] = message.data.imu;
			respond({
				type: "newtab"
			});
		});

		return true;
	} else if (message.type === "getvalue") {
		storage.get(message.data, function(response) {
			respond({
				type: "getvalue",
				data: response
			});
		});

		return true;
	} else if (message.type === "setvalue") {
		storage.set(message.data, function() {
			if ("extension_contextmenu" in message.data) {
				if (JSON.parse(message.data.extension_contextmenu)) {
					create_contextmenu();
				} else {
					destroy_contextmenu();
				}
			}
		});
	} else if (message.type === "popupaction") {
		if (message.data.action === "replace_images" ||
				message.data.action === "highlight_images") {
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
				var currentTab = tabs[0];
				chrome.tabs.sendMessage(currentTab.id, message);
			});
		}
	} else if (message.type === "getcookies") {
		get_cookies(message.data.url, function(cookies) {
			respond({
				type: "cookies",
				data: cookies
			});
		});

		return true;
	} else if (message.type === "ready") {
		// Sometimes tab is undefined. Catching this error shouldn't be needed though
		tabready(sender.tab.id);
	} else if (message.type === "get_lib") {
		debug("get_lib", message);

		var xhr = new XMLHttpRequest();
		xhr.open("GET", chrome.runtime.getURL("/lib/" + message.data.name + ".js"), true);

		xhr.onload = function() {
			if (xhr.readyState !== 4)
				return;

			if (xhr.status !== 200 && xhr.status !== 0)
				return respond({
					type: "get_lib",
					data: null
				});

			respond({
				type: "get_lib",
				data: {
					text: xhr.responseText
				}
			});
		};

		xhr.onerror = function() {
			respond({
				type: "get_lib",
				data: null
			});
		};

		xhr.send();
		return true;
	} else if (message.type === "override_next_headers") {
		debug("override_next_headers", message);

		if (!(sender.tab.id in override_headers))
			override_headers[sender.tab.id] = [];

		override_headers[sender.tab.id].push({
			url: message.data.url,
			method: message.data.method,
			headers: message.data.headers,
			anonymous: !!message.data.anonymous,
			content_type: message.data.content_type || null
		});

		// In order to prevent races
		respond({
			type: "override_next_headers",
			data: null
		});

		return true;
	} else if (message.type === "download") {
		debug("download", message);

		var tab_options = {
			url: message.data.imu.url,
			openerTabId: sender.tab.id,
			active: false
		};

		var do_download_with_tabs = function() {
			download_with_tabs(tab_options, message.data.imu, message.data.filename, respond);
		}

		if (!message.data.force_saveas) {
			do_download_with_tabs();
		} else {
			try {
				var download_headers = [];
				if (message.data.imu.headers) {
					for (const header in message.data.imu.headers) {
						const header_obj = {name: header, value: message.data.imu.headers[header] || ""};
						download_headers.push(header_obj);
					}
				}

				chrome.downloads.download({
					url: message.data.imu.url,
					headers: download_headers,
					filename: message.data.filename,
					saveAs: true
				}, function(id) {
					var do_with_tabs = false;

					if (chrome.runtime.lastError) {
						console.error(chrome.runtime.lastError.message);

						// under Chrome:  Unsafe request header name
						// under Firefox: Forbidden request header name
						if (chrome.runtime.lastError.message.indexOf("request header name") >= 0) {
							do_with_tabs = true;
						}

						// under Firefox, cancelling the download will result in: Download canceled by the user
						// therefore, we must check the lastError's message instead of just 'id === "undefined"', as it also returns an undefined id for that too.
					}

					if (typeof id === "undefined" && do_with_tabs) {
						return do_download_with_tabs();
					}
				});

				if (chrome.runtime.lastError) {
					console.log(chrome.runtime.lastError);
				}
			} catch (e) {
				console.error(e);

				// fall back to non-downloads if we don't have the permission
				do_download_with_tabs();
			}
		}

		return true;
	} else if (message.type === "remote" || message.type === "remote_reply") {
		debug(message.type, message);

		chrome.tabs.sendMessage(sender.tab.id, message);
	} else if (message.type === "permission" && false) { // This is unused!
		debug("permission", message);

		if (["history", "notifications"].indexOf(message.data.permission) >= 0) {
			chrome.permissions.request({
				permissions: [message.data.permission]
			}, function(granted) {
				respond({
					type: "permission",
					data: {
						permission: message.data.permission,
						granted: granted
					}
				});

				if (granted && message.data.permission === "notifications") {
					create_notification_handlers();
				}
			});
		} else {
			respond({
				type: "permission",
				data: {
					permission: message.data.permission,
					granted: false
				}
			});
		}

		return true;
	} else if (message.type === "permission_handler") {
		debug("permission_handler", message);

		if (message.data.permission === "notifications") {
			create_notification_handlers();
		}
	} else if (message.type === "add_to_history") {
		debug("add_to_history", message);

		try {
			chrome.history.addUrl({
				url: message.data.url
			});
		} catch (e) {
			console.error(e);
		}
	} else if (message.type === "notification") {
		debug("notification", message);

		try {
			var notif_id = get_random_id(notifications);
			chrome.notifications.create(notif_id, {
				type: "basic",
				iconUrl: message.data.image || chrome.extension.getURL("/resources/logo_96.png"),
				title: message.data.title || "Image Max URL",
				message: message.data.text
			}, function(notif_id) {
				notifications[notif_id] = function(action) {
					// FIXME: since this is a response, only one of clicked/closed can be sent
					respond({
						type: "notification",
						data: {
							status: "success",
							action: action
						}
					});
				};
			});

			// closing won't return
			if (!message.data.onclick)
				return;
		} catch (e) {
			console.error(e);

			respond({
				type: "notification",
				data: {
					status: "noperm"
				}
			});
		}

		return true;
	}
};

var notification_handler = function(notif_id, action, byuser) {
	debug("notification_handler", notif_id, action, byuser);

	if (!(notif_id in notifications)) {
		console.error(notif_id, "not in notifications");
		return;
	}

	if (action === "clicked") {
		notifications[notif_id](action);
	}

	delete notifications[notif_id];
};

var added_notification_handlers = false;
var create_notification_handlers = function() {
	try {
		chrome.notifications.onClicked.addListener(function(notif_id) {
			notification_handler(notif_id, "clicked");
		});

		chrome.notifications.onClosed.addListener(function(notif_id, byuser) {
			notification_handler(notif_id, "closed", byuser);
		});
	} catch (e) {
		console.warn("Notifications not allowed");
	}
};
create_notification_handlers();

chrome.runtime.onMessage.addListener(extension_message_handler);

var userscript_extension_message_handler = function(message, respond) {
	if (!respond) {
		respond = function(){};
	}

	if (!extension_message_handler(message, {tab: {id: background_userscript_tabid}}, respond)) {
		respond();
	}
};

var imu_userscript_message_sender = null;

function contextmenu_imu(data, tab) {
	debug("contextMenu", data);
	chrome.tabs.sendMessage(tab.id, {
		"type": "context_imu"
	});
}

var contextmenu = null;
function create_contextmenu() {
	if (contextmenu)
		return;

	contextmenu = chrome.contextMenus.create({
		title: "Try to find larger image (IMU)",
		contexts: ["page", "link", "image", "video", "audio"],
		onclick: contextmenu_imu
	});
}

function destroy_contextmenu() {
	chrome.contextMenus.removeAll();
	contextmenu = null;
}

function get_option(name, cb, _default) {
	storage.get([name], function(response) {
			var value = _default;

			if (Object.keys(response).length > 0 && response[name] !== undefined) {
					value = JSON.parse(response[name]);
			}

			cb(value);
	});
}

on_ready(function() {
	get_option("extension_contextmenu", function(value) {
		if (value) {
			create_contextmenu();
		}
	}, true);
});

function update_browseraction_enabled(enabled) {
	var disabled_text = "";
	if (!enabled)
		disabled_text = " (disabled)";

	chrome.browserAction.setTitle({
		title: "Image Max URL" + disabled_text
	});

	if (enabled) {
		chrome.browserAction.setIcon({
			path: {
				"40": "../resources/logo_40.png",
				"48": "../resources/logo_48.png",
				"96": "../resources/logo_96.png"
			}
		});
	} else {
		chrome.browserAction.setIcon({
			path: {
				"40": "../resources/disabled_40.png",
				"48": "../resources/disabled_48.png",
				"96": "../resources/disabled_96.png"
			}
		});
	}
}

on_ready(function() {
	get_option("imu_enabled", update_browseraction_enabled, true);
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
	if (nir_debug)
		console.log("storage.onChanged", changes);

	if (namespace !== "sync" && namespace !== "local")
		return;

	for (var key in changes) {
		if (key === "imu_enabled") {
			update_browseraction_enabled(JSON.parse(changes[key].newValue));
		}
	}

	var message = {
		"type": "settings_update",
		"data": {
			"changes": changes
		}
	};

	chrome.tabs.query({}, function (tabs) {
		tabs.forEach((tab) => {
			try {
				debug("Sending storage changes to tab", tab.id);

				chrome.tabs.sendMessage(tab.id, JSON.parse(JSON.stringify(message)));
			} catch (e) {
				console.error(e);
			}
		});
	});

	if (typeof imu_userscript_message_sender === "function") {
		imu_userscript_message_sender(message);
	}
});

function tabremoved(tabid) {
	if (nir_debug)
		console.log("Removed tab: ", tabid);

	delete tabs_ready[tabid];

	if (tabid === currenttab)
		enable_contextmenu(false);

	if (tabid in loading_urls) {
		delete loading_urls[tabid];
	}

	if (tabid in loading_redirects) {
		delete loading_redirects[tabid];
	}

	if (tabid in override_headers) {
		delete override_headers[tabid];
	}

	if (tabid in override_download) {
		delete override_download[tabid];
	}

	if (tabid in redirects) {
		delete redirects[tabid];
	}
}

function tabready(tabid) {
	if (nir_debug)
		console.log("Tab ready: ", tabid);

	tabs_ready[tabid] = true;

	if (tabid === currenttab)
		enable_contextmenu(true);

	if (tabid in override_download) {
		chrome.tabs.remove(tabid);
	}
}

chrome.tabs.onRemoved.addListener(function(tabid) {
	if (nir_debug)
		console.log("tabs.onRemoved");

	tabremoved(tabid)
});

chrome.tabs.onReplaced.addListener(function (added, removed) {
	if (nir_debug)
		console.log("tabs.onReplaced");

	tabremoved(removed);
	tabremoved(added);
});

chrome.tabs.onUpdated.addListener(function(tabid, info, tab) {
	if (info.status === "loading") {
		if (nir_debug)
			console.log("tabs.onUpdated: loading");

		// probably incorrect, breaks downloads (https://github.com/qsniyg/maxurl/issues/275)
		//tabremoved(tabid);
	} else if (info.status === "complete") {
		tabready(tabid);
	}
});

function enable_contextmenu(enabled) {
	if (!contextmenu)
		return;

	if (nir_debug)
		console.log("Setting contextmenu: " + enabled);

	chrome.contextMenus.update(contextmenu, {
		enabled: enabled
	});
}

var currenttab = null;
chrome.tabs.onActivated.addListener(function(activeInfo) {
	currenttab = activeInfo.tabId;

	if (activeInfo.tabId in tabs_ready) {
		enable_contextmenu(true);
	} else {
		enable_contextmenu(false);

		// Disable, because this likely means the extension was reloaded, which means the context menu won't work anyways
		if (false) {
			chrome.tabs.getCurrent(function (tab) {
				if (tab.status === "complete") {
					tabready(tab.id);
				}
			});
		}
	}
});

var broadcast_message = function(message) {
	chrome.tabs.query({}, function(tabs) {
		for (var i = 0; i < tabs.length; i++) {
			chrome.tabs.sendMessage(tabs[i].id, message);
		}
	});
};

// disable for now, doesn't seem to do anything, and untested if it does anything
/*chrome.runtime.onSuspend.addListener(function() {
	broadcast_message({type: "suspend"});
});

chrome.runtime.onSuspendCanceled.addListener(function() {
	broadcast_message({type: "unsuspend"});
});*/

// https://stackoverflow.com/a/61074058
var hotload = function() {
	chrome.tabs.query({}, function(tabs) {
		var userscript_file = chrome.runtime.getManifest().content_scripts[0].js[0];
		for (var i = 0; i < tabs.length; i++) {
			var tab = tabs[i];

			try {
				if (!tab || tab.discarded || !tab.url) continue;
				if (!/^(https?|file):\/\//.test(tab.url)) continue;
			} catch (e) {
				console.error(e);
				continue;
			}

			(function(tab) {
				// yield
				setTimeout(function() {
					chrome.tabs.executeScript(tab.id, {
						file: userscript_file
					}, function(){handle_error();});
				}, 1);
			})(tab);
		}
	});
};

chrome.runtime.onInstalled.addListener(function() {
	get_option("extension_hotreload", function(value) {
		if (value) hotload();
	}, true);
});
