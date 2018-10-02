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
  userscript_contents = response;
  response = response
    .replace(/^[\s\S]*function bigimage/, "")
    .replace(/\/\/ *-- *end *bigimage *--[\s\S]*$/, "");
  document.getElementById("rules").innerHTML = fuzzify(response.match(/\n        if /g).length);
  //document.getElementById("sites").innerHTML = fuzzify(response.match(/(?:domain[_ ]|[^(]domain\.)/g).length);
  document.getElementById("sites").innerHTML = fuzzify(response.match(/(?:domain[_ ]|amazon_container|googlestorage_container)/g).length);
}

function get_sites() {
  var sites = userscript_contents.match(/(?:domain(?:_[a-z]+)?|amazon_container|googlestorage_container) *=== *["'](.*?)["']/g);
  var siteslist = [];
  for (var i = 0; i < sites.length; i++) {
    var site = sites[i].match(/["'](.*?)["']$/)[1].replace(/^www\./, "");
    if (sites[i].match(/^amazon_/))
      site = site + ".s3.amazonaws.com";
    if (sites[i].match(/^googlestorage_/))
      site = site + ".storage.googleapis.com";
    if (siteslist.indexOf(site) < 0)
      siteslist.push(site);
  }
  siteslist.sort();

  return siteslist;
}

var userscript_location = "https://rawgit.com/qsniyg/maxurl/master/userscript.user.js";
var userscript_contents = null;

var oReq = new XMLHttpRequest();
oReq.addEventListener("load", reqListener);
oReq.open("GET", userscript_location);
oReq.send();

document.onreadystatechange = function() {
  if (document.readyState !== "complete")
    return;

  if (!("google_tag_manager" in window))
    document.getElementById("analytics-blocked").innerHTML = " but your browser has blocked it.";
};
