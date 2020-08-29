const fs = require("fs");

var start = function(userscript) {
    var pofiles = {};

    var supported_language_names = {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "ko": "Korean"
    };

    var supported_languages = userscript.match(/\n\tvar supported_languages = (\[.*?\]);\n/);
    if (!supported_languages) {
        console.error("Unable to find supported languages match in userscript");
        return;
    }
    var supported_languages_json = JSON.parse(supported_languages[1]);
    for (const supported_language of supported_languages_json) {
        if (supported_language === "en")
            continue;
        pofiles[supported_language] = [];

        var language_name = supported_language_names[supported_language] || supported_language;
        pofiles[supported_language].push("# " + language_name + " translation of Image Max URL");
        pofiles[supported_language].push("#");
        pofiles[supported_language].push("msgid \"\"");
        pofiles[supported_language].push("msgstr \"\"");
        pofiles[supported_language].push("\"Project-Id-Version: Image Max URL\\n\"");
        pofiles[supported_language].push("\"MIME-Version: 1.0\\n\"");
        pofiles[supported_language].push("\"Content-Type: text/plain; charset=UTF-8\\n\"");
        pofiles[supported_language].push("\"Content-Transfer-Encoding: 8bit\\n\"");
        pofiles[supported_language].push("\"Language: " + supported_language + "\\n\"");

        pofiles[supported_language].push("");
    }

    var strings = userscript.match(/\n\tvar strings = ({[\s\S]+?});\n/);
    if (!strings) {
        console.error("Unable to find strings match in userscript");
        return;
    }

    var strings_json = JSON.parse(strings[1]);

    for (const string in strings_json) {
        var string_data = strings_json[string];

        var comment = null;
        if (string_data._info) {
            comment = "#. ";

            var instances_text = [];
            for (const instance of string_data._info.instances) {
                instances_text.push(instance.setting + "." + instance.field);
            }

            comment += instances_text.join(", ");
        }

        for (const pofile in pofiles) {
            if (comment) {
                pofiles[pofile].push(comment);
            }

            pofiles[pofile].push("msgid " + JSON.stringify(string));

            if (pofile in string_data) {
                pofiles[pofile].push("msgstr " + JSON.stringify(string_data[pofile]));
            } else {
                pofiles[pofile].push("msgstr \"\"");
            }

            pofiles[pofile].push("");
        }
    }

    for (const pofile in pofiles) {
        var filename = "po/" + pofile + ".po";
        fs.writeFileSync(filename, pofiles[pofile].join("\n"));
    }
};

var userscript = fs.readFileSync(process.argv[2] || "userscript.user.js").toString();
start(userscript);
