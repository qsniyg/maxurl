"use strict";

function fuzzify(num) {
  console.log(num);
  var baseh = parseInt(num/100);
  if (parseInt((num+25)/100) > baseh) {
    return (baseh + 1) * 100;
  }

  var basef = parseInt(num/50);
  if (parseInt((num+25)/50) > basef || basef % 2 === 1) {
    return baseh * 100 + 50;
  }

  return baseh * 100;
}

function reqListener () {
  var response = this.responseText;
  response = response
    .replace(/^[\s\S]*function bigimage/, "")
    .replace(/\/\/ *-- *end *bigimage *--[\s\S]*$/, "");
  document.getElementById("rules").innerHTML = fuzzify(response.match(/if /g).length);
  document.getElementById("sites").innerHTML = fuzzify(response.match(/domain/g).length);
}

var oReq = new XMLHttpRequest();
oReq.addEventListener("load", reqListener);
oReq.open("GET", "https://rawgit.com/qsniyg/maxurl/master/userscript.user.js");
oReq.send();

document.onreadystatechange = function() {
  if (document.readyState !== "complete")
    return;

  if (!("google_tag_manager" in window))
    document.getElementById("analytics-blocked").innerHTML = " but your browser has blocked it.";
};
