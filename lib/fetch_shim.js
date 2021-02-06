// somewhat inspired by https://github.com/developit/unfetch/blob/master/src/index.mjs
var fetch = function(url, options) {
	if (!options) options = {};

	return new Promise(function(resolve, reject) {
		//console.log("fetching", url, options);
		var xhr = new XMLHttpRequest();

		var get_response = function() {
			// Response is needed for wasm
			// this shim is not trying to support fetch for browsers that don't support it, but rather to wrap XHR
			return new Response(xhr.response, {
				status: xhr.status,
				statusText: xhr.statusText,
				// todo: headers
			});
		};

		xhr.open(options.method || "GET", url, true);

		xhr.responseType = "blob";

		xhr.onload = function() {
			// todo: get headers
			resolve(get_response());
		};
		xhr.onerror = reject;

		xhr.withCredentials = options.credentials === "include";

		for (var header in options.headers) {
			xhr.setRequestHeader(header, options.headers[header]);
		}

		xhr.send(options.body || null);
	});
};
