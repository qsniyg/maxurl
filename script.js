// @license http://www.apache.org/licenses/LICENSE-2.0 Apache-2.0
// ^ for LibreJS (this comment has to be below)

var inputel = document.getElementById("input");
var maxael = document.getElementById("max_a");
var maxspanel = document.getElementById("max_span");
var maximgel = document.getElementById("max_img");
var origpageel = document.getElementById("original_page");
var currenturl = null;

// Wrapper for Image Max URL, overwritten by the userscript
function do_imu(url, cb) {
  var retval = window.imu_variable(url, {
    fill_object: true,
    catch_errors: false,
    do_request: function() {},
    cb: cb
  });

  if (retval && retval[0] && retval[0].waiting) {
    cb(retval);
  }

  return retval;
}

// Thanks to /u/GarlicoinAccount for noticing the need to run this
// separately, as input can be sent before the page is fully loaded
function process_input() {
  if (ignore_input)
    return;

  var text = inputel.value;
  if (text.match(/^\s+https?:\/\//)) {
    inputel.value = text.replace(/^\s*/, "");
    text = inputel.value;
  }

  var valid_url = /^https?:\/\//.test(text);

  try {
    new URL(text);
  } catch (e) {
    valid_url = false;
  }

  if (valid_url) {
    set_max("loading");
    try {
      currenturl = text;
      window.do_imu(text, function(newurl) {
        set_max(newurl);
      });
    } catch (e) {
      console.error(e);
      set_max("error");
    }

  } else if (text === "" || (typeof text === "string" && text.match(/^\s*$/))) {
    set_max("blank");
  } else {
    set_max("invalid");
  }
}

var decodeuri_ifneeded = function(url) {
  if (url.match(/^https?:\/\//))
    return url;
  if (url.match(/^https?%3[aA]/) || /^[^/]*%2[fF]/.test(url))
    return decodeURIComponent(url);
  if (url.match(/^https?%253[aA]/))
    return decodeURIComponent(decodeURIComponent(url));
  return url;
};

var ignore_input = false;
// thanks to MillennialDIYer on github for the idea: https://github.com/qsniyg/maxurl/issues/665#url=test
if (window.location.hash) {
  var lochash = window.location.hash;

  if (/#imu-request-site&/.test(lochash)) {
    setTimeout(function() {
      main_reqsupport();
      ignore_input = false;
    }, 10);

    lochash = lochash.replace(/#imu-request-site&/, "#");
    ignore_input = true;
  }

  var hash_urlmatch = lochash.match(/#url=(https?[:%][^#]*)(?:#.*)?$/);
  if (hash_urlmatch) {
    inputel.value = decodeuri_ifneeded(hash_urlmatch[1]);
  }
}

if (inputel.value !== "") {
  process_input();
}

inputel.oninput = process_input;

// https://stackoverflow.com/a/987376
function SelectText(element) {
  var doc = document
  , text = doc.getElementById(element)
  , range, selection
  ;
  if (doc.body.createTextRange) {
    range = document.body.createTextRange();
    range.moveToElementText(text);
    range.select();
  } else if (window.getSelection) {
    selection = window.getSelection();
    range = document.createRange();
    range.selectNodeContents(text);
    //range.selectNode(text);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function unselect() {
  if (window.getSelection) {
    var selection = window.getSelection();
    selection.removeAllRanges();
  }
}


// https://stackoverflow.com/a/7124052
function sanitize_url(url) {
  return url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resetels() {
  maxael.innerHTML = "";
  maximgel.src = "";
  origpageel.innerHTML = "";
}

var sent_requests = {};

var sending_request = false;
function main_reqsupport(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  var url = inputel.value.replace(/^\s*|\s*$/, "");
  if (!/^https?:\/\//.test(url))
    url = null;

  if (!url || url in sent_requests)
    return;

  if (!reqsite_valid_url(url)) {
    maxspanel.innerHTML = "Failed to send site request: Please <a href=\"https://github.com/qsniyg/maxurl/issues\">file an issue on Github</a>.";
    return;
  }

  if (sending_request)
    return;

  sending_request = true;

  maxspanel.innerHTML = "Requesting...";

  reqsite_discord(url, null, function(status, msg) {
    sent_requests[url] = true;
    sending_request = false;

    if (status) {
      maxspanel.innerHTML = "Site request sent!";
    } else {
      maxspanel.innerHTML = "Failed to send request: " + msg;
    }
  });

  if (e)
    return false;
}

function get_nolargerimagefound_text() {
  var base_text = "<p>No larger image found</p>";

  var url = inputel.value.replace(/^\s*|\s*$/, "");
  if (!reqsite_valid_url(url))
    return base_text;

  base_text += "<p><a href=\"#\" onclick=\"main_reqsupport(event)\">Request support for this site</a></p>";

  return base_text;
}

function set_max(obj) {
  var error = true;

  if (false)
    console.log(obj);

  if (obj === "loading") {
    maxspanel.innerHTML = "Loading...";
  } else if (obj === "error") {
    maxspanel.innerHTML = "<p>Unknown error</p><p>Please <a href=\"https://github.com/qsniyg/maxurl/issues\">file an issue on Github</a> including the URL you entered</p>";
  } else if (obj === "broken") {
    maxspanel.innerHTML = "Broken image";
    obj = false;
  } else if (obj === "invalid") {
    maxspanel.innerHTML = "Invalid URL";
  } else if (obj === "blank") {
    maxspanel.innerHTML = "";
  } else if (!obj || (typeof obj === "string" && !obj.match(/^https?:\/\//))) {
    maxspanel.innerHTML = "Unknown error";
  } else {
    error = false;
  }

  if (error) {
    resetels();
    return;
  }

  var urls = [];
  var waiting = false;
  var likely_broken = false;

  if (obj instanceof Array) {
    var first_obj = true;
    for (var i = 0; i < obj.length; i++) {
      if (obj[i].url) {
        if (first_obj) {
          likely_broken = obj[i].likely_broken;
          first_obj = false;
        }

        urls.push(obj[i].url);
      }
    }

    if (obj.length > 0) {
      waiting = obj[0].waiting;
    }
  } else {
    if (obj.url instanceof Array) {
      urls = obj.url;
    } else {
      urls = [obj.url];
    }

    waiting = obj.waiting;
  }

  if (urls.length === 0 || (urls.length === 1 && !urls[0]) || (waiting && likely_broken)) {
    if (waiting || likely_broken) {
      maxspanel.innerHTML = "<p>The <a href='https://greasyfork.org/en/scripts/36662-image-max-url'>userscript</a> or <a href='https://addons.mozilla.org/en-US/firefox/addon/image-max-url/'>firefox add-on</a> is needed for this URL.</p><p>It requires a cross-origin request to find the original size.</p>";
    } else {
      maxspanel.innerHTML = "No larger image found";
    }

    resetels();
    return;
  }

  var origpage = null;
  for (var i = 0; i < obj.length; i++) {
    if (obj[i] && obj[i].extra && obj[i].extra.page) {
      origpage = obj[i].extra.page;
      break;
    }
  }

  function set_orig_page() {
    if (origpage) {
      var origpagea = document.createElement("a");
      origpageel.innerText = "Original page: ";
      origpagea.setAttribute("rel", "noreferrer");
      origpagea.href = origpage;
      origpagea.innerText = origpage;
      origpageel.appendChild(origpagea);
    }
  }

  if (urls.length === 1 && urls[0] === currenturl) {
    maxspanel.innerHTML = get_nolargerimagefound_text();

    resetels();
    set_orig_page();
    return;
  }

  maxael.innerHTML = "";
  maxspanel.innerHTML = "";

  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];

    var suba = document.createElement("a");
    suba.setAttribute("rel", "noreferrer");
    suba.href = url;
    suba.innerHTML = sanitize_url(url);
    var subp = document.createElement("p");
    subp.innerHTML = "OR";
    maxael.appendChild(suba);

    if ((i + 1) < urls.length)
      maxael.appendChild(subp);
  }

  set_orig_page();

  //currenturl = urls;

  if (urls.length === 1) {
    SelectText("max_a");
    var successful = document.execCommand('copy');
    unselect();
    if (successful === true) {
      maxspanel.innerHTML = "Copied to clipboard!";
    } else {
      maxspanel.innerHTML = "Failed to copy to clipboard";
    }
  }
}

if (document.location.origin === "file://") {
  console.log("Local installation detected, using local script instead");
  var script = document.createElement("script");
  var loc = document.location.href;
  script.src = loc.replace(/\/[^/]*\/[^/]*$/, "/userscript.user.js");
  document.body.appendChild(script);
}

// @license-end
