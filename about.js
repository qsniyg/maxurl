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

function get_userscript_stats(response) {
  userscript_contents = response;
  response = response
  //.replace(/^[\s\S]*function bigimage/, "")
    .replace(/^[\s\S]*\/\/ *-- *start *bigimage *--/, "")
    .replace(/\/\/ *-- *end *bigimage *--[\s\S]*$/, "");
  return [
    // rules
    response.match(/\n {8}(?:[/][*])?if /g).length,
    // sites
    response.match(/(?:domain(?:_[a-z]+)?|amazon_container|googlestorage_container) /g).length
  ];
}

function reqListener() {
  var response = this.responseText;
  var stats = get_userscript_stats(response);
  document.getElementById("rules").innerHTML = fuzzify(stats[0]);
  document.getElementById("sites").innerHTML = fuzzify(stats[1]);
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

var userscript_contents = null;
if (typeof document !== "undefined") {
  var userscript_location = "https://gitcdn.xyz/repo/qsniyg/maxurl/master/userscript_smaller.user.js";

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
} else if (typeof require !== undefined) {
  var fs = require("fs");
  var data = fs.readFileSync(process.argv[2], {
    encoding: "utf8"
  });
  userscript_contents = data;
  var stats = get_userscript_stats(data);
  console.log("Rules: " + stats[0]);
  console.log("Sites: " + stats[1]);
}
