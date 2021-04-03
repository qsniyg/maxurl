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
	var current_comment = null;

	var apply_current = function() {
		if (current_command === "msgid") {
			current_ref = current_text;
		} else if (current_command === "msgstr") {
			if (current_ref === null) {
				console.error("msgstr without msgid?", current_command, current_text);
			} else if (current_ref !== "") {
				strings[current_ref] = current_text;

				if (current_comment) {
					strings[current_ref + "#comment"] = current_comment;
				}
			}

			current_comment = null;
		}

		current_command = null;
		current_text = null;
	};

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		var match = line.match(/^#\s+(.*)$/);
		if (match) {
			var comment = match[1];
			if (current_comment) {
				current_comment += "\n";
			} else {
				current_comment = "";
			}

			current_comment += comment;
			continue;
		}

		if (!line.length && current_command === "msgstr") {
			apply_current();
			continue;
		}

		if (line[0] === "#")
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

var update_userscript_language_options = function(languages) {
	var filename = "userscript.user.js"
	var userscript = fs.readFileSync(filename).toString();
	var strings_regex = /(\n\t\tlanguage: {\n[^}]+?\n\t\t\toptions: )(\{\n\t{4}_type: "combo",(?:\n\t{4}(?:"[^"]+"|[_a-z]+): \{\n\t{5}name: "[^"]+"(?:,\n\t{5}name_gettext: false)?\n\t{4}\},?)*\n\t{3}\})(,\n)/;

	var match = userscript.match(strings_regex);
	if (!match) {
		console.error("Unable to find language options match in userscript");
		return;
	}

	languages = util.sort_keys_by_array(languages, ["_type", "en"]);

	for (var key in languages) {
		if (key === "_type")
			continue;
		languages[key] = {name: languages[key], name_gettext: false};
	}

	var stringified = JSON.stringify(languages, null, "\t").replace(/\n/g, "\n\t\t\t");
	stringified = util.json_escape_unicode(stringified);
	stringified = stringified.replace(/(\t)"([_a-z]+)":/g, "$1$2:");

	userscript = userscript.replace(strings_regex, "$1" + stringified + "$3");

	fs.writeFileSync(filename, userscript);
};

var update_userscript_description = function(languages) {
	var filename = "userscript.user.js"
	var userscript = fs.readFileSync(filename).toString();

	for (var key in languages) {
		var regex = new RegExp("(// @description:" + key + " +).*");
		userscript = userscript.replace(regex, "$1" + languages[key]);
	}

	fs.writeFileSync(filename, userscript);
};

var get_all_strings = function() {
	var strings = {};

	var supported_languages = ["en"];
	var language_options = {"_type": "combo", "en": "English"};
	var descriptions = {};

	fs.readdir("./po", function (err, files) {
		files.forEach(function(file) {
			var match = file.match(/^([-_a-zA-Z]+)\.pot?$/)
			if (!match)
				return;

			var langcode = match[1];

			// for comments
			var fake_lang = false;
			if (langcode === "imu") {
				langcode = "en";
				fake_lang = true;
			}

			var real_langcode = util.to_langcode(langcode); // en_US -> en-US

			var langstrings = read_po("./po/" + file);
			var valid_strings = 0;

			for (var string in langstrings) {
				if (string.indexOf("#comment") >= 0) {
					var real_string = string.replace(/#.*/, "");
					if (!(real_string in strings)) strings[real_string] = {};
					if (!("_info" in strings[real_string])) strings[real_string]._info = {};
					if (!("comments" in strings[real_string]._info)) strings[real_string]._info.comments = {};

					strings[real_string]._info.comments[real_langcode] = langstrings[string];
					continue;
				}

				if (fake_lang || !langstrings[string])
					continue;

				valid_strings++;

				if (string === "$language_native$") {
					language_options[real_langcode] = langstrings[string];
					valid_strings--;
				}

				if (string === "$description$") {
					descriptions[real_langcode] = langstrings[string];
					valid_strings--;
				}

				if (!(string in strings))
					strings[string] = {};

				strings[string][real_langcode] = langstrings[string];
			}

			if (!fake_lang && valid_strings > 0)
				supported_languages.push(real_langcode);
		});

		for (const string_name in strings) {
			var string = strings[string_name];
			if (!("_info" in string)) continue;
			if (!("comments" in string._info)) continue;

			var comments = string._info.comments;
			if (!comments.en) continue;

			for (const lang in comments) {
				if (lang === "en") continue;
				if (comments[lang] === comments.en) delete comments[lang];
			}
		}

		update_userscript_strings(strings);
		update_userscript_supported_languages(supported_languages);
		update_userscript_language_options(language_options);
		update_userscript_description(descriptions);
	});
};

get_all_strings();
