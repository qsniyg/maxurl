// @license http://www.apache.org/licenses/LICENSE-2.0 Apache-2.0
// ^ for LibreJS (this comment has to be below)

"use strict";

var is_node = false;
if (typeof module === "undefined") {
  var module = {exports: {}};
} else {
  if (typeof document === "undefined") {
    is_node = true;
  }
}

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
module.exports.fuzzify = fuzzify;

function get_userscript_stats(response) {
  userscript_contents = response;
  userscript_rcontents = response
  //.replace(/^[\s\S]*function bigimage/, "")
    .replace(/^[\s\S]*\/\/ *-- *start *bigimage *--/, "")
    .replace(/\/\/ *-- *end *bigimage *--[\s\S]*$/, "");
  return [
    // rules
    //userscript_rcontents.match(/\n {8}(?:[/][*])?if /g).length,
    userscript_rcontents.match(/\n(?: {8}|\t{2})(?:[/][*])?if /g).length,
    // sites
    get_sites().length
    //userscript_rcontents.match(/[^/](?:domain(?:_[a-z]+)?|amazon_container|googlestorage_container) *===/g).length
  ];
}
module.exports.get_userscript_stats = get_userscript_stats;

function reqListener() {
  var response = this.responseText;
  var stats = get_userscript_stats(response);
  document.getElementById("rules").innerHTML = fuzzify(stats[0]);
  document.getElementById("sites").innerHTML = fuzzify(stats[1]);
}

function get_sites() {
  var sites = userscript_rcontents.match(/[^/](?:(?:host_)?domain(?:_[a-z]+)?|(?:amazon|googlestorage|digitalocean)_container) *=== *["'](?:.*?)["']/g);
  var siteslist = [];
  for (var i = 0; i < sites.length; i++) {
    var origsite = sites[i];
    sites[i] = sites[i].substr(1);
    var site = sites[i].match(/["'](.*?)["']$/)[1].replace(/^www\./, "");
    if (sites[i].match(/^amazon_/))
      site = site + ".s3.amazonaws.com";
    if (sites[i].match(/^googlestorage_/))
      site = site + ".storage.googleapis.com";
    if (sites[i].match(/^digitalocean_/))
      site = site + ".?.digitaloceanspaces.com";
    if (siteslist.indexOf(site) < 0) {
      if (site.length > 0)
        siteslist.push(site);
    } else {
      //console.log(site);
    }
  }
  siteslist.sort();

  return siteslist;
}
module.exports.get_sites = get_sites;

var userscript_contents = null;
var userscript_rcontents = null;
if (typeof document !== "undefined") {
  //var userscript_location = "https://gitcdn.xyz/repo/qsniyg/maxurl/master/userscript_smaller.user.js";
  var userscript_location = "userscript_smaller.user.js";

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
} else if (typeof require !== undefined && require.main == module) {
  var fs = require("fs");
  var data = fs.readFileSync(process.argv[2], {
    encoding: "utf8"
  });
  userscript_contents = data;
  var stats = get_userscript_stats(data);

  if (process.argv[3] === "sites") {
    console.log(get_sites().join("\n"));
  } else {
    console.log("Rules: " + stats[0]);
    console.log("Sites: " + stats[1]);
  }
}

// @license-end
