var spawn = require('child_process').spawn;
var fs = require('fs');

var get_uglifyjs_version = function(cb) {
	var prc = spawn("uglifyjs", ["--version"]);
	var data = "";
	prc.stdout.on('data', function(stdout_data) {
		data += stdout_data.toString();
	});

	prc.on('close', function(code) {
		var splitted = data.split(/\s+/);
		if (splitted.length > 1 && splitted[1].match(/^[0-9]+[0-9.]+$/)) {
			return cb(splitted[1]);
		} else {
			return cb(null);
		}
	});
};

var read_userscript_header = function(path) {
	var userscript = fs.readFileSync(path).toString();
	var lines = userscript.split("\n");

	var header = null;
	for (const line of lines) {
		var is_end_header = false;
		if (line.indexOf(" ==UserScript==") >= 0) {
			header = line;
		} else if (header) {
			if (line.indexOf(" ==/UserScript==") >= 0) {
				is_end_header = true;

				// present in userscript.user.js now, no need to keep this
				/*header += "\n" + "//";
				header += "\n" + "// This script is quickly approaching OpenUserJS's 1MB limit, so the update URL is set to github in order to future-proof updates";
				header += "\n" + "// @updateURL https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript.meta.js";
				header += "\n" + "// @downloadURL https://raw.githubusercontent.com/qsniyg/maxurl/master/userscript_smaller.user.js";*/
			}

			header += "\n" + line;
		}

		if (is_end_header) {
			header += "\n\n";
			break;
		}
	}

	return header;
};

var in_filename = "build/userscript_extr.user.js";
var out_filename = "build/userscript_extr_min.user.js";
var reserved = ["$__imu_get_bigimage"];

console.log("Minifying...");
var prc = spawn("uglifyjs", ['-m', '-c', '-o', out_filename, '--', in_filename], {stdio: "inherit"});
prc.on('close', function(code) {
	console.log("Finished minifying");
	if (code !== 0) {
		console.log("Wrong status code:", code);
		return;
	}

	var userscript_header = read_userscript_header(process.argv[2] || "userscript.user.js");
	fs.writeFileSync("userscript.meta.js", userscript_header);

	get_uglifyjs_version(function(version) {
		if (!version) {
			console.log("Warning: Unable to find UglifyJS version!");
			version = "v???";
		} else {
			version = "v" + version;
		}

		var extr_header = read_userscript_header(in_filename);

		extr_header += "// Due to OpenUserJS's 1MB limit, the source code had to be minified.\n";
		extr_header += "// The minification was done by gen_minified.js (in the maxurl repository below) using `uglifyjs -m -c` (" + version + ").\n";
		extr_header += "// This unfortunately renders the code pretty much unreadable, but it was the only way to fit it within the 1MB limit.\n";
		extr_header += "// You can view the original source code here: https://github.com/qsniyg/maxurl/blob/master/userscript.user.js\n";
		extr_header += "// Please let me know if you have any questions or concerns regarding the script.\n";
		extr_header += "\n";

		var min_userscript = fs.readFileSync(out_filename).toString();

		fs.writeFileSync(out_filename, extr_header + min_userscript);
	});
});
