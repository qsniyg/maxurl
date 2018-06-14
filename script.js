var inputel = document.getElementById("input");
var maxael = document.getElementById("max_a");
var maxspanel = document.getElementById("max_span");
var maximgel = document.getElementById("max_img");
var currenturl = null;
inputel.oninput = function() {
  var text = inputel.value;
  if (text.match(/^https?:\/\//)) {
    var newurl = imu_variable(text, {fill_object:true});
    if (newurl.url instanceof Array) {
      if (newurl.url.indexOf(text) >= 0) {
        set_max(false);
      } else {
        set_max(newurl.url);
      }
    } else if (newurl.url !== text) {
      set_max(newurl.url);
    } else {
      set_max(false);
    }
  } else if (text === "") {
    set_max(null);
  } else {
    set_max();
  }
};

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

function set_max(urls) {
  if (!urls) {
    if (urls === false)
      maxspanel.innerHTML = "No larger image found";
    else if (urls === undefined)
      maxspanel.innerHTML = "Invalid URL";
    else if (urls === null)
      maxspanel.innerHTML = "";

    maxael.innerHTML = "";
    maximgel.style.backgroundImage = "";

    return;
  }

  if (JSON.stringify(urls) === JSON.stringify(currenturl))
    return;

  console.log(urls);
  //var proxyurl = proxify(url);

  maxael.innerHTML = "";
  maxspanel.innerHTML = "";

  if (!(urls instanceof Array)) {
    urls = [urls];
  }

  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];

    var suba = document.createElement("a");
    suba.setAttribute("rel", "noreferrer");
    suba.href = url;
    suba.innerHTML = url;
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
