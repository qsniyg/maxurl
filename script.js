var inputel = document.getElementById("input");
var maxael = document.getElementById("max_a");
var maxspanel = document.getElementById("max_span");
var maximgel = document.getElementById("max_img");
var currenturl = null;

// Wrapper for Image Max URL, overwritten by the userscript
function do_imu(url, cb) {
  var retval = window.imu_variable(url, {
    fill_object: true,
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
  var text = inputel.value;
  if (text.match(/^\s+https?:\/\//)) {
    inputel.value = text.replace(/^\s*/, "");
    text = inputel.value;
  }

  if (text.match(/^https?:\/\//)) {
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
}

// Google Analytics statistics
var last_ga = {};
var ga_thresh = 1000;
function track_ga(value) {
  var now = Date.now();

  if (last_ga[value] && (now - last_ga[value]) < ga_thresh) {
    return;
  }

  last_ga[value] = now;

  try {
    gtag('event', 'imu', {
      'event_category': 'engagement',
      'event_label': value
    });
  } catch (e) {
    console.error(e);
  }
}

function set_max(obj) {
  var error = true;

  if (obj === "loading") {
    maxspanel.innerHTML = "Loading...";
  } else if (obj === "error") {
    maxspanel.innerHTML = "Unknown error";
    track_ga("error");
  } else if (obj === "broken") {
    maxspanel.innerHTML = "Broken image";
    obj = false;
  } else if (obj === "invalid") {
    maxspanel.innerHTML = "Invalid URL";
    track_ga("invalid_url");
  } else if (obj === "blank") {
    maxspanel.innerHTML = "";
  } else if (!obj || (typeof obj === "string" && !obj.match(/^https?:\/\//))) {
    maxspanel.innerHTML = "Unknown error";
    track_ga("unknown_error");
  } else {
    error = false;
  }

  if (error) {
    resetels();
    return;
  }

  var urls = [];
  var waiting = false;

  if (obj instanceof Array) {
    for (var i = 0; i < obj.length; i++) {
      if (obj[i].url)
        urls.push(obj[i].url);
    }

    if (obj.length > 0)
      waiting = obj[0].waiting;
  } else {
    if (obj.url instanceof Array) {
      urls = obj.url;
    } else {
      urls = [obj.url];
    }

    waiting = obj.waiting;
  }

  if (urls.length === 0 || (urls.length === 1 && !urls[0])) {
    if (waiting) {
      maxspanel.innerHTML = "<p>The <a href='https://greasyfork.org/en/scripts/36662-image-max-url'>userscript</a> or <a href='https://addons.mozilla.org/en-US/firefox/addon/image-max-url/'>firefox add-on</a> is needed for this URL.</p><p>It requires a cross-origin request to find the original size.</p>";
      track_ga("userscript_needed");
    } else {
      maxspanel.innerHTML = "No larger image found";
      track_ga("no_larger_image");
    }

    resetels();
    return;
  }

  if (urls.length === 1 && urls[0] === currenturl) {
    maxspanel.innerHTML = "No larger image found";
    track_ga("no_larger_image");

    resetels();
    return;
  }

  track_ga("found");

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
