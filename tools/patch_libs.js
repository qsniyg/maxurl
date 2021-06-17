function strip_trailing_whitespace(text) {
	return text.replace(/[ \t]*$/mg, "");
}

function dos_to_unix(text) {
	return text.replace(/\r*\n/g, "\n");
}

function libexport_shim(text, varname) {
	return [
		text,
		//"",
		"var lib_export = " + varname + ";",
		"if (typeof module !== 'undefined')",
		"\tmodule.exports = lib_export;",
		""
	].join("\n");
}

var patches = {};

// slowaes needs to be patched to match testcookie's version of slowaes
// patch is adapted from https://raw.githubusercontent.com/kyprizel/testcookie-nginx-module/eb9f7d65f50f054a0e7525cf6ad225ca076d1173/util/aes.patch
function patch_slowaes(text) {
	var patched = text
		.replace(/(var blockSize = 16;\s*)(for \(var i = data\.length - 1;)/, "$1if (data.length > 16) {\r\n\t\t$2")
		.replace(/(data\.splice\(data\.length - padCount, padCount\);\r\n)/, "$1\t\t}\r\n");

	// this section is to ensure byte-for-byte correctness with the old build_libs.sh version, it's otherwise useless
	patched = dos_to_unix(patched);
	var matchregex = /for \(var i = data\.length - 1;[\s\S]+data\.splice\(data\.length - padCount, padCount\);/
	var match = patched.match(matchregex);
	var indented = match[0].replace(/^/mg, "\t");
	patched = patched.replace(matchregex, indented);
	patched = strip_trailing_whitespace(patched);

	return libexport_shim(patched, "slowAES");
}
patches["slowaes"] = patch_slowaes;

module.exports = patches;

// https://stackoverflow.com/a/42587206
var isCLI = !module.parent;
if (isCLI) {
	var fs = require("fs");
	var readfile = function(file) {
		return fs.readFileSync(file).toString();
	};

	var process_cli = function(argv) {
		var patch = process.argv[2];
		if (!patch) {
			console.error("Need patch type");
			return;
		}

		if (!(patch in patches)) {
			console.error("Invalid patch", patch);
			return;
		}

		var filename = process.argv[3];
		if (!filename) {
			console.error("Need filename");
			return;
		}

		var read = readfile(filename);
		process.stdout.write(patches[patch](read));
	};

	process_cli(process.argv);
}
