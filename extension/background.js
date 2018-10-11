// This is heavily based on ViolentMonkey's implementation:
// https://github.com/violentmonkey/violentmonkey/blob/9e672d5590aea144840681b6f2ce0c267d57fc13/src/background/utils/requests.js
// https://github.com/violentmonkey/violentmonkey/blob/9e672d5590aea144840681b6f2ce0c267d57fc13/src/common/index.js

var requests = {};
var redirects = {};
var loading_urls = {};

var nir_debug = false;
var debug = function() {
  if (nir_debug) {
    return console.log.apply(this, arguments);
  }
};

var get_random_id = function() {
  var rand = Math.floor((1+Math.random())*100000000000).toString(36);
  return Date.now().toString(36) + rand;
};

var do_request = function(request) {
  debug("do_request", request);

  var id = get_random_id();
  var method = request.method || "GET";

  var xhr = new XMLHttpRequest();
  xhr.open(method, request.url, true);

  if (request.responseType)
    xhr.responseType = request.responseType;

  var headers = request.headers || {};
  for (var header in headers) {
    xhr.setRequestHeader("IMU--" + header, headers[header]);
  }

  xhr.setRequestHeader("IMU-Verify", id);

  var do_final = function(override, cb) {
    delete requests[id];

    debug("XHR", xhr);

    var resp = {
      readyState: xhr.readyState,
      finalUrl: xhr.responseURL,
      responseHeaders: xhr.getAllResponseHeaders(),
      responseType: xhr.responseType,
      status: xhr.status || 200, // file:// returns 0
      statusText: xhr.statusText
    };

    if (resp.readyState === 4) {
      try {
        resp.responseText = xhr.responseText;
      } catch (e) {
      }

      if (resp.responseType === "blob") {
        var body = xhr.response;
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

          cb(resp);
        };
        reader.readAsArrayBuffer(body);
      } else {
        cb(resp);
      }
    } else {
      cb(resp);
    }
  };

  xhr.onload = function() {
    do_final({}, function(resp) {
      request.onload(resp);
    });
  };

  xhr.onerror = function() {
    do_final({}, function(resp) {
      request.onerror(resp);
    });
  };

  requests[id] = {
    id: id,
    xhr: xhr
  };

  xhr.send();
};

// Modify request headers if needed
chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
  debug("onBeforeSendHeaders", details);

  var headers = details.requestHeaders;
  var new_headers = [];
  var imu_headers = [];
  var verify_ok = false;

  if (details.tabId in redirects) {
    verify_ok = true;

    var redirect = redirects[details.tabId];
    delete redirects[details.tabId];

    debug("Redirect", details.tabId);

    loading_urls[details.tabId] = details.url;

    if (!redirect) {
      return;
    }

    var rheaders = null;
    for (var i = 0; i < redirect.length; i++) {
      if (redirect[i].url === details.url) {
        rheaders = redirect[i].headers;
        break;
      }
    }

    if (!rheaders) {
      return;
    }

    for (var header in rheaders) {
      headers.push({
        name: "IMU--" + header,
        value: rheaders[header]
      });
    }
  }

  debug("Headers", headers);

  headers.forEach((header) => {
    if (header.name.startsWith("IMU--")) {
      imu_headers.push({
        name: header.name.slice(5),
        value: header.value
      });
    } else if (header.name === "IMU-Verify") {
      verify_ok = header.value in requests;
    } else {
      new_headers.push(header);
    }
  });

  if (!verify_ok) {
    return;
  }

  var use_header = function(value) {
    return value !== "" && value !== null;
  };

  for (var i = 0; i < imu_headers.length; i++) {
    var found = false;
    for (var j = 0; j < new_headers.length; j++) {
      if (new_headers[j].name === imu_headers[i].name) {
        if (use_header(imu_headers[i].value))
          new_headers[j] = imu_headers[i];
        else
          new_headers.splice(j, 1);

        found = true;
        break;
      }
    }

    if (!found && use_header(imu_headers[i].value))
      new_headers.push(imu_headers[i]);
  }

  debug("New headers", new_headers);

  return {
    requestHeaders: new_headers
  };
}, {
  urls: ['<all_urls>'],
  types: ['xmlhttprequest', 'main_frame', 'sub_frame']
}, ['blocking', 'requestHeaders']);

// Intercept response headers if needed
chrome.webRequest.onHeadersReceived.addListener(function(details) {
  if (details.tabId in loading_urls) {
    var newheaders = [];

    details.responseHeaders.forEach((header) => {
      var name = header.name.toLowerCase();
      var value = header.value;

      if (name === "content-type") {
        if (!value.match(/^ *binary\//) &&
            !value.match(/^ *application\//)) {
          newheaders.push(header);
        }
      } else if (name === "content-disposition") {
        if (!value.toLowerCase().match(/^ *attachment/)) {
          newheaders.push(header);
        }
      } else {
        newheaders.push(header);
      }
    });

    //debug(details);
    debug("Old headers", details.responseHeaders);
    debug("New headers", newheaders);

    return {
      responseHeaders: newheaders
    };
  }
}, {
  urls: ['<all_urls>'],
  types: ['xmlhttprequest', 'main_frame', 'sub_frame']
}, ['blocking', 'responseHeaders']);

// Remove loading_urls once headers have finished loading
chrome.webRequest.onResponseStarted.addListener(function(details) {
  debug("ResponseStarted", details, loading_urls);

  if (details.tabId in loading_urls) {
    delete loading_urls[details.tabId];
  }
}, {
  urls: ['<all_urls>'],
  types: ['xmlhttprequest', 'main_frame', 'sub_frame']
}, ['responseHeaders']);

// Message handler
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  debug("onMessage", message, sender, respond);

  if (message.type === "request") {
    message.data.onload = function(data) {
      respond({
        type: "onload",
        data: data
      });
    };

    message.data.onerror = function(data) {
      respond({
        type: "onerror",
        data: data
      });
    };

    do_request(message.data);
    return true;
  } else if (message.type === "redirect") {
    redirects[sender.tab.id] = message.data;
  }
});
