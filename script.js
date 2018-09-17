var inputel = document.getElementById("input");
var maxael = document.getElementById("max_a");
var maxspanel = document.getElementById("max_span");
var maximgel = document.getElementById("max_img");
var currenturl = null;

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

// thanks to /u/GarlicoinAccount for noticing the need to run this
// separately, as input can be sent before the page is fully loaded
function process_input() {
  var text = inputel.value;
  if (text.match(/^ +https?:\/\//)) {
    inputel.value = text.replace(/^ */, "");
    text = inputel.value;
  }

  if (text.match(/^https?:\/\//)) {
    set_max("loading");
    try {
      window.do_imu(text, function(newurl) {
        set_max(newurl);
        return;
        if (newurl.url instanceof Array) {
          set_max(newurl);
          /*if (newurl.url.indexOf(text) >= 0) {
            set_max(false);
            } else {
            set_max(newurl.url);
            }*/
        } else if (newurl.url !== text) {
          set_max(newurl);
        } else {
          set_max(false);
        }
      });
    } catch (e) {
      console.error(e);
      set_max("error");
    }

  } else if (text === "") {
    set_max(null);
  } else {
    set_max();
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


function proxify(url) {
  // doesn't get rid of referrers
  //return "https://proxy.duckduckgo.com/iu/?u=" + encodeURIComponent(url);

  // doesn't work with ?
  //return "https://i0.wp.com/" + url.replace(/^[a-z]+:\/\//, "");

  // works
  //return "https://img.blvds.com/unsafe/smart/filters:format(jpeg)/" + encodeURIComponent(url);

  // works
  return "https://imageproxy.themaven.net/" + encodeURIComponent(url);

  // sort of works
  //return "https://imagesvc.timeincapp.com/v3/foundry/image/?url=" + encodeURIComponent(url);
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

function set_max(obj) {
  if (obj === "loading") {
    maxspanel.innerHTML = "Loading...";
    resetels();
    return;
  } else if (obj === "error") {
    maxspanel.innerHTML = "Unknown error";
    resetels();
    return;
  } else if (obj === "broken") {
    obj = false;
  }

  if (!obj) {
    if (obj === undefined)
      maxspanel.innerHTML = "Invalid URL";
    else if (obj === null)
      maxspanel.innerHTML = "";
    else if (obj === false)
      maxspanel.innerHTML = "No larger image found";

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
      maxspanel.innerHTML = "<p>The <a href='https://greasyfork.org/en/scripts/36662-image-max-url'>userscript</a> is needed for this URL.</p><p>It requires a cross-origin request to find the original size</p>";
    } else {
      maxspanel.innerHTML = "No larger image found";
    }

    resetels();
    return;
  }

  if (urls.indexOf(currenturl) >= 0)
    return;

  //var proxyurl = proxify(url);

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
  /*maxael.innerHTML = url;
  maxael.href = url;*/

  currenturl = urls;

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
  //maximgel.style.backgroundImage = "url('" + proxyurl + "')";
}

if (document.location.origin === "file://") {
  console.log("Local installation detected, using local script instead");
  var script = document.createElement("script");
  var loc = document.location.href;
  script.src = loc.replace(/\/[^/]*\/[^/]*$/, "/userscript.user.js");
  document.body.appendChild(script);
}
