// git clone the gh-pages branch into site
var about = require("../site/about.js");
var util = require("./util.js");

const fs = require("fs");
const process = require("process");
process.chdir(__dirname + "/..");

var userscript_smaller = util.read_userscript("userscript_smaller.user.js");
about.get_userscript_stats(userscript_smaller);

var userscript = util.read_userscript();

var sites = about.get_sites();
var total_sites = sites.length;
var fuzzy_sites = (((total_sites / 100)|0) * 100) | 0;
var fuzzy_sites_str = fuzzy_sites + "";
var fuzzy_sites_fstr = fuzzy_sites_str.replace(/^([0-9])/, "$1 "); // 1 234

var update_sitesnum_line = function(line) {
	return line
		.replace(/([^0-9])[0-9]{4}([^0-9])/, "$1" + fuzzy_sites_str + "$2")
		.replace(/([^0-9])[0-9] [0-9]{3}([^0-9])/, "$1" + fuzzy_sites_fstr + "$2");
};

var update_pofile = function(pofile) {
	var str = fs.readFileSync(pofile).toString();
	var splitted = str.split(/\n/);
	var found = false;
	for (var i = 0; i < splitted.length; i++) {
		var line = splitted[i];
		if (line.indexOf("msgid \"$description$\"") >= 0) {
			found = true;
			continue;
		}

		if (!found) continue;

		if (line.indexOf("msgid ") >= 0) {
			console.log(line)
			console.warn("Unable to replace sitesnum for", pofile);
			return;
		}

		var newline = update_sitesnum_line(line);
		if (newline !== line) {
			splitted[i] = newline;
			break;
		}
	}

	fs.writeFileSync(pofile, splitted.join("\n"));
};

var lines = userscript.split("\n");
var changed = false;
for (var i = 0; i < lines.length; i++) {
	var line = lines[i];

	if (!/^\/\/ @description(?:[:][-a-zA-Z]+)?\s+/.test(line)) continue;

	var oldline = lines[i];
	lines[i] = update_sitesnum_line(lines[i]);

	if (lines[i] !== oldline) changed = true;
}

if (changed) {
	util.write_userscript_lines(lines);

	var pofiles = fs.readdirSync("po");
	for (const pofile of pofiles) {
		if (!/\.po$/.test(pofile)) continue;

		update_pofile("po/" + pofile);
	}

	console.log("Changed to: ", fuzzy_sites_str);
} else {
	console.log("Unchanged: ", fuzzy_sites_str);
}
