const fs = require("fs");
const maximage = require("../userscript.user.js");
const util = require("./util.js");

var split_value = function(lines, cmd, value) {
	var splitted = value.split("\n");

	for (var i = 0; i < splitted.length; i++) {
		var header = "";
		var line = splitted[i];

		if (i === 0) {
			header = cmd + " ";

			if (splitted.length > 1) {
				lines.push(header + '""');
				header = "";
			}
		}

		if ((i + 1) < splitted.length)
			line += "\n";

		if (line.length === 0)
			continue;

		lines.push(header + JSON.stringify(line));
	}
};

var start = function(userscript) {
	var pofiles = {};

	var supported_language_names = {
		"af": "Afrikaans",
		"ar": "Arabic",
		"be": "Belarusian",
		"bg": "Bulgarian",
		"ca": "Catalan",
		"cs": "Czech",
		"cy": "Welsh",
		"da": "Danish",
		"de": "German",
		"dv": "Divehi",
		"el": "Greek",
		"en": "English",
		"eo": "Esperanto",
		"es": "Spanish",
		"et": "Estonian",
		"eu": "Basque",
		"fa": "Farsi",
		"fi": "Finnish",
		"fo": "Faroese",
		"fr": "French",
		"gl": "Galician",
		"gu": "Gujarati",
		"he": "Hebrew",
		"hi": "Hindi",
		"hr": "Croatian",
		"hu": "Hungarian",
		"hy": "Armenian",
		"id": "Indonesian",
		"is": "Icelandic",
		"it": "Italian",
		"ja": "Japanese",
		"ka": "Georgian",
		"kk": "Kazakh",
		"kn": "Kannada",
		"ko": "Korean",
		"ky": "Kyrgyz",
		"lt": "Lithuanian",
		"lv": "Latvian",
		"mi": "Maori",
		"mn": "Mongolian",
		"mr": "Marathi",
		"ms": "Malay",
		"mt": "Maltese",
		"nb": "Norwegian",
		"nl": "Dutch",
		"pa": "Punjabi",
		"pl": "Polish",
		"ps": "Pashto",
		"pt": "Portuguese",
		"pt_BR": "Portuguese (Brazil)",
		"qu": "Quechua",
		"ro": "Romanian",
		"ru": "Russian",
		"sa": "Sanskrit",
		"sk": "Slovak",
		"sl": "Slovenian",
		"sq": "Albanian",
		"sv": "Swedish",
		"sw": "Swahili",
		"ta": "Tamil",
		"te": "Telugu",
		"th": "Thai",
		"tl": "Tagalog",
		"tn": "Tswana",
		"tr": "Turkish",
		"tt": "Tatar",
		"ts": "Tsonga",
		"uk": "Ukrainian",
		"ur": "Urdu",
		"vi": "Vietnamese",
		"xh": "Xhosa",
		"zh": "Chinese",
		"zh_CN": "Chinese",
		"zh_HK": "Chinese (Hong Kong)",
		"zh_TW": "Chinese (Taiwan)",
		"zu": "Zulu"
	};

	var supported_languages = userscript.match(/\n\tvar supported_languages = (\[(?:\n\t{2}"[-a-zA-Z]+",?)*\n\t\]);\n/);
	if (!supported_languages) {
		console.error("Unable to find supported languages match in userscript");
		return;
	}
	var supported_languages_json = JSON.parse(supported_languages[1]);

	var strings = userscript.match(/\n\tvar strings = ({[\s\S]+?});\n/);
	if (!strings) {
		console.error("Unable to find strings match in userscript");
		return;
	}

	var strings_json = JSON.parse(strings[1]);

	// add languages that only have descriptions
	if (strings_json["$description$"]) {
		var description = strings_json["$description$"];
		for (const lang in description) {
			if (supported_languages_json.indexOf(lang) < 0) {
				supported_languages_json.push(lang);
			}
		}
	}

	const language_options = maximage.internal.settings_meta.language.options;
	for (var supported_language of supported_languages_json) {
		var old_supported_language = supported_language;
		if (supported_language === "en") {
			supported_language = "imu";
		} else {
			supported_language = util.to_pocode(supported_language);
		}

		pofiles[supported_language] = [];

		if (supported_language !== "imu") {
			var language_name = supported_language_names[supported_language] || supported_language;
			pofiles[supported_language].push("# " + language_name + " translations for Image Max URL");
			pofiles[supported_language].push("#");
		}

		pofiles[supported_language].push("msgid \"\"");
		pofiles[supported_language].push("msgstr \"\"");
		pofiles[supported_language].push("\"Project-Id-Version: Image Max URL\\n\"");
		pofiles[supported_language].push("\"MIME-Version: 1.0\\n\"");
		pofiles[supported_language].push("\"Content-Type: text/plain; charset=UTF-8\\n\"");
		pofiles[supported_language].push("\"Content-Transfer-Encoding: 8bit\\n\"");

		if (supported_language !== "imu") {
			pofiles[supported_language].push("\"Language: " + supported_language + "\\n\"");
		}

		pofiles[supported_language].push("");
	}

	for (const string in strings_json) {
		var string_data = strings_json[string];

		var comments = {};
		for (const pofile in pofiles) comments[pofile] = [];

		if (string_data._info) {
			if (string_data._info.instances) {
				var comment = "#. ";

				var instances_text = [];
				for (const instance of string_data._info.instances) {
					instances_text.push(instance.setting + "." + instance.field);
				}

				comment += instances_text.join(", ");

				for (const pofile in pofiles) {
					comments[pofile].push(comment);
				}
			}

			if (string_data._info.comments) {
				var _comments = string_data._info.comments;

				for (const pofile in pofiles) {
					var comment = null;
					var langcode = util.to_langcode(pofile);
					if (langcode in _comments) comment = _comments[langcode];
					else if ("en" in _comments) comment = _comments.en;

					if (comment) {
						comments[pofile].push("# " + comment.replace(/\r?\n/g, "\n# "));
					}
				}
			}
		}

		if ("en" in string_data && string_data.en !== string) {
			for (const pofile in pofiles) {
				comments[pofile].push("#. English: " + string_data.en);
			}
		}

		for (const pofile in pofiles) {
			for (const comment of comments[pofile]) {
				pofiles[pofile].push(comment);
			}

			split_value(pofiles[pofile], "msgid", string);

			var langcode = util.to_langcode(pofile);

			if (pofile !== "imu" && langcode in string_data) {
				split_value(pofiles[pofile], "msgstr", string_data[langcode]);
			} else {
				pofiles[pofile].push("msgstr \"\"");
			}

			pofiles[pofile].push("");
		}
	}

	for (const pofile in pofiles) {
		var ext = "po";
		if (pofile === "imu")
			ext = "pot";

		var filename = "po/" + pofile + "." + ext;
		fs.writeFileSync(filename, pofiles[pofile].join("\n"));
	}
};

var userscript = fs.readFileSync(process.argv[2] || "userscript.user.js").toString();
start(userscript);
