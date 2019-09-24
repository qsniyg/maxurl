// This is heavily based on ViolentMonkey's implementation:
// https://github.com/violentmonkey/violentmonkey/blob/9e672d5590aea144840681b6f2ce0c267d57fc13/src/background/utils/requests.js
// https://github.com/violentmonkey/violentmonkey/blob/9e672d5590aea144840681b6f2ce0c267d57fc13/src/common/index.js

var requests = {};
var redirects = {};
var loading_urls = {};
var loading_redirects = {};
var tabs_ready = {};

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
      status: xhr.status || 200, // file:// returns 0, tracking protection also returns 0
      statusText: xhr.statusText
    };

    if (xhr.status === 0 && xhr.responseURL === "")
      resp.status = 0;

    if (resp.readyState === 4) {
      try {
        resp.responseText = xhr.responseText;
      } catch (e) {
      }

      if (resp.responseType === "blob") {
        var body = xhr.response;
        if (!body) {
          resp.status = xhr.status;
          cb(resp);
          return;
        }

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

  xhr.send(request.data);
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

    if (!(redirect instanceof Array))
      redirect = [redirect];

    debug("Redirect", details.tabId);

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

// Intercept response headers if needed
chrome.webRequest.onHeadersReceived.addListener(function(details) {
  if (details.tabId in loading_urls) {
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
  }
}, {
  urls: ['<all_urls>'],
  types: ['xmlhttprequest', 'main_frame', 'sub_frame']
}, ['blocking', 'responseHeaders']);

// Remove loading_urls once headers have finished loading
chrome.webRequest.onResponseStarted.addListener(function(details) {
  debug("onResponseStarted", details, loading_urls);

  if (details.tabId in loading_urls) {
    delete loading_urls[details.tabId];
  }

  if (details.tabId in loading_redirects) {
    delete loading_redirects[details.tabId];
  }
}, {
  urls: ['<all_urls>'],
  types: ['xmlhttprequest', 'main_frame', 'sub_frame']
}, ['responseHeaders']);

// Currently unused, will be used later if the Cookie header needs to be modified
// Originally this was intended for submitting cookies to URLs,
//   but not including the "Cookie" header works just as well.
function get_cookies(url, cb) {
  chrome.cookies.getAll({url: url}, function(cookies) {
    debug("get_cookies: " + url, cookies);
    cb(JSON.parse(JSON.stringify(cookies)));
  });
}

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
  } else if (message.type === "newtab") {
    chrome.tabs.create({
      url: message.data.imu.url,
      openerTabId: sender.tab.id
    }, function (tab) {
      debug("newTab", tab);
      redirects[tab.id] = message.data.imu;
      respond({
        type: "newtab"
      });
    });

    return true;
  } else if (message.type === "setvalue") {
    chrome.storage.sync.set(message.data, function() {
      if ("extension_contextmenu" in message.data) {
        if (JSON.parse(message.data.extension_contextmenu)) {
          create_contextmenu();
        } else {
          destroy_contextmenu();
        }
      }
    });
  } else if (message.type === "popupaction") {
    if (message.data.action === "replace_images") {
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
    tabready(sender.tab.id);
  }
});

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
    contexts: ["page", "link", "image"],
    onclick: contextmenu_imu
  });
}

function destroy_contextmenu() {
  chrome.contextMenus.removeAll();
  contextmenu = null;
}

function get_option(name, cb, _default) {
  chrome.storage.sync.get([name], function(response) {
      var value = _default;

      if (Object.keys(response).length > 0 && response[name] !== undefined) {
          value = JSON.parse(response[name]);
      }

      cb(value);
  });
}

get_option("extension_contextmenu", function(value) {
  if (value) {
    create_contextmenu();
  }
}, true);

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

get_option("imu_enabled", update_browseraction_enabled, true);

chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (nir_debug)
    console.log("storage.onChanged", changes);

  if (namespace !== "sync")
    return;

  for (var key in changes) {
    if (key === "imu_enabled") {
      update_browseraction_enabled(JSON.parse(changes[key].newValue));
    }
  }

  chrome.tabs.query({}, function (tabs) {
    tabs.forEach((tab) => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          "type": "settings_update",
          "data": {
            "changes": changes
          }
        });
      } catch (e) {
        console.error(e);
      }
    });
  });
});

function tabremoved(tabid) {
  if (nir_debug)
    console.log("Removed tab: ", tabid);

  delete tabs_ready[tabid];

  if (tabid === currenttab)
    enable_contextmenu(false);
}

function tabready(tabid) {
  if (nir_debug)
    console.log("Tab ready: ", tabid);

  tabs_ready[tabid] = true;

  if (tabid === currenttab)
    enable_contextmenu(true);
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
      console.log("loading");

    tabremoved(tabid);
  } else if (info.status === "complete") {
    tabready(tabid);
  }
});

function enable_contextmenu(enabled) {
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
