var inputel = document.getElementById("input");
var maxael = document.getElementById("max_a");
var maxspanel = document.getElementById("max_span");
var maximgel = document.getElementById("max_img");
inputel.oninput = function() {
  var text = inputel.value;
  if (text.match(/^https?:\/\//)) {
    var newurl = imu_variable(text);
    if (newurl !== text) {
      set_max(newurl);
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

function set_max(url) {
  if (!url) {
    if (url === false)
      maxspanel.innerHTML = "No larger image found";
    else if (url === undefined)
      maxspanel.innerHTML = "Invalid URL";
    else if (url === null)
      maxspanel.innerHTML = "";

    maxael.innerHTML = "";
    maximgel.style.backgroundImage = "";

    return;
  }

  if (url === maxael.innerHTML)
    return;

  console.log(url);
  var proxyurl = proxify(url);
  maxspanel.innerHTML = "";
  maxael.innerHTML = url;
  maxael.href = url;
  SelectText("max_a");
  var successful = document.execCommand('copy');
  unselect();
  if (successful === true) {
    maxspanel.innerHTML = "Copied to clipboard!";
  }
  //maximgel.style.backgroundImage = "url('" + proxyurl + "')";
}
