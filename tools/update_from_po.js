const fs = require("fs");
const util = require("./util.js");
const maximage = require("../userscript.user.js");

const process = require("process");
process.chdir(__dirname + "/..");

var parse = function(lines) {
	var strings = {};

	var current_ref = null;
	var current_command = null;
	var current_text = null;

	var apply_current = function() {
		if (current_command === "msgid") {
			current_ref = current_text;
		} else if (current_command === "msgstr") {
			if (current_ref === null) {
				console.error("msgstr without msgid?", current_command, current_text);
			} else if (current_ref !== "") {
				strings[current_ref] = current_text;
			}
		}

		current_command = null;
		current_text = null;
	};

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		if (!line.length || line[0] === "#")
			continue;

		var match = line.match(/^(msg(?:id|str)) (".*")\s*$/);
		if (match) {
			apply_current();
			current_command = match[1];
			current_text = JSON.parse(match[2]);
		} else {
			match = line.match(/^(".*")\s*$/);
			if (match) {
				current_text += JSON.parse(match[1]);
			} else {
				console.error("Unknown line:", line);
			}
		}
	}

	apply_current();

	return strings;
};

var read_po = function(filename) {
	var pofile = fs.readFileSync(filename).toString();
	return parse(pofile.split("\n"));
};

var update_userscript_strings = function(newstrings) {
	var filename = "userscript.user.js"
	var userscript = fs.readFileSync(filename).toString();
	var strings_regex = /(\n\tvar strings = )({[\s\S]+?})(;\n)/;

	var match = userscript.match(strings_regex);
	if (!match) {
		console.error("Unable to find strings match in userscript");
		return;
	}

	var strings_json = JSON.parse(match[2]);
	for (var string in newstrings) {
		if (!(string in strings_json)) {
			console.warn("msgid not in userscript?", string);
			continue;
		}

		var newstring = newstrings[string]
		for (const lang in newstring) {
			if (!newstring[lang]) {
				if (lang in strings_json[string]) {
					console.warn("Deleting", lang, "for", string);
					delete strings_json[string][lang];
				}
			} else {
				strings_json[string][lang] = newstring[lang];
			}
		}
	}

	var stringified = JSON.stringify(strings_json, null, "\t").replace(/\n/g, "\n\t");
	stringified = util.json_escape_unicode(stringified);

	userscript = userscript.replace(strings_regex, "$1" + stringified + "$3");

	fs.writeFileSync(filename, userscript);
};

var update_userscript_supported_languages = function(supported_languages) {
	var filename = "userscript.user.js"
	var userscript = fs.readFileSync(filename).toString();
	var strings_regex = /(\n\tvar supported_languages = )(\[[\s\S]+?\])(;\n)/;

	var match = userscript.match(strings_regex);
	if (!match) {
		console.error("Unable to find supported languages match in userscript");
		return;
	}

	util.sort_by_array(supported_languages, ["en"]);

	var stringified = JSON.stringify(supported_languages, null, "\t").replace(/\n/g, "\n\t");
	stringified = util.json_escape_unicode(stringified);

	userscript = userscript.replace(strings_regex, "$1" + stringified + "$3");

	fs.writeFileSync(filename, userscript);
};

var get_all_strings = function() {
	var strings = {};

	var supported_languages = ["en"];

	fs.readdir("./po", function (err, files) {
		files.forEach(function(file) {
			var match = file.match(/^([-_a-zA-Z]+)\.po$/)
			if (!match)
				return;

			var langcode = match[1];
			var langstrings = read_po("./po/" + file);

			for (var string in langstrings) {
				if (string === "$language_native$")
					continue;

				if (!(string in strings))
					strings[string] = {};

				strings[string][langcode] = langstrings[string];
			}

			supported_languages.push(langcode);
		});

		update_userscript_strings(strings);
		update_userscript_supported_languages(supported_languages);
	});
};

get_all_strings();
