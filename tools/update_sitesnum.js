// git clone the gh-pages branch into site
var about = require("../site/about.js");
var util = require("./util.js");

var userscript = util.read_userscript();

about.get_userscript_stats(userscript);
var sites = about.get_sites();
var total_sites = sites.length;
var fuzzy_sites = (((total_sites / 100)|0) * 100) | 0;
var fuzzy_sites_str = fuzzy_sites + "";
var fuzzy_sites_fstr = fuzzy_sites_str.replace(/^([0-9])/, "$1 "); // 1 234

var lines = userscript.split("\n");
var changed = false;
for (var i = 0; i < lines.length; i++) {
	var line = lines[i];

	if (!/^\/\/ @description(?:[:][-a-zA-Z]+)?\s+/.test(line)) continue;

	var oldline = lines[i];
	lines[i] = lines[i]
		.replace(/([^0-9])[0-9]{4}([^0-9])/, "$1" + fuzzy_sites_str + "$2")
		.replace(/([^0-9])[0-9] [0-9]{3}([^0-9])/, "$1" + fuzzy_sites_fstr + "$2");

	if (lines[i] !== oldline) changed = true;
}

if (changed) {
	util.write_userscript_lines(lines);
	console.log("Changed to: ", fuzzy_sites_str);
} else {
	console.log("Unchanged: ", fuzzy_sites_str);
}
