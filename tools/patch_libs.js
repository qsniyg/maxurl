var patch_lib = null;

// wrap in anonymous function because it can be included in background.js
(function() {
	function strip_trailing_whitespace(text) {
		return text.replace(/[ \t]*$/mg, "");
	}

	function dos_to_unix(text) {
		return text.replace(/\r*\n/g, "\n");
	}

	function libexport_shim(text, varname, add_newline) {
		var base = [text];

		if (add_newline)
			base.push("");

		base.push(
			"var lib_export = " + varname + ";",
			"if (typeof module !== 'undefined')",
			"\tmodule.exports = lib_export;",
			""
		)

		return base.join("\n");
	}

	var lib_patches = {};

	// slowaes needs to be patched to match testcookie's version of slowaes
	// patch is adapted from https://raw.githubusercontent.com/kyprizel/testcookie-nginx-module/eb9f7d65f50f054a0e7525cf6ad225ca076d1173/util/aes.patch
	function patch_slowaes(text) {
		var patched = text
			.replace(/(var blockSize = 16;\s*)(for \(var i = data\.length - 1;)/, "$1if (data.length > 16) {\r\n\t\t$2")
			.replace(/(data\.splice\(data\.length - padCount, padCount\);\r\n)/, "$1\t\t}\r\n");

		// dos_to_unix because web archive does this and therefore integrity checks for the userscript can fail
		patched = dos_to_unix(patched);
		// this section is to ensure byte-for-byte correctness with the old build_libs.sh version, it's otherwise useless
		var matchregex = /for \(var i = data\.length - 1;[\s\S]+data\.splice\(data\.length - padCount, padCount\);/
		var match = patched.match(matchregex);
		var indented = match[0].replace(/^/mg, "\t");
		patched = patched.replace(matchregex, indented);
		patched = strip_trailing_whitespace(patched);

		return libexport_shim(patched, "slowAES");
	}
	lib_patches["slowaes"] = {
		patch: patch_slowaes,
		files: "slowaes.js"
	};

	function patch_cryptojs_aes(text) {
		var patched = libexport_shim(text, "CryptoJS");

		return dos_to_unix(strip_trailing_whitespace(patched));
	}
	lib_patches["cryptojs_aes"] = {
		patch: patch_cryptojs_aes,
		files: "cryptojs_aes.js"
	};

	function patch_muxjs(text) {
		// don't store in window
		return text
			.replace(/^/, "var muxjs=null;\n")
			.replace(/\(function\(f\){if\(typeof exports/, "(function(f){muxjs = f();return;if(typeof exports");
	}
	lib_patches["muxjs"] = {
		patch: patch_muxjs,
		files: "mux.js",
		cached: true
	};

	function patch_shaka(data) {
		var text = data["shaka-player.compiled.debug.js"];

		text = [
			data["muxjs"],

			// move exportTo outside the anonymous function scope
			"var _fakeGlobal={};var exportTo={};\n",
			text.replace(/var exportTo={};/g, "")
		].join("");

		text = text
		// XHR is to allow overriding, the others fix the content script failing under FF
			.replace(/window\.(XMLHttpRequest|decodeURIComponent|parseInt|muxjs)/g, "$1")
			.replace(/innerGlobal\.shaka/g, "_fakeGlobal.shaka")
			.replace(/goog\.global\.XMLHttpRequest/g, "XMLHttpRequest") // more XHR
			.replace(/(HttpFetchPlugin\.isSupported=function..{)/g, "$1return false;") // disable fetch to force XHR
			.replace(/\r*\n\/\/# sourceMappingURL=.*/, "") // remove sourcemapping to avoid warnings under devtools
		;

		text = libexport_shim(text, "exportTo.shaka");
		return strip_trailing_whitespace(dos_to_unix(text));
	}
	lib_patches["shaka"] = {
		patch: patch_shaka,
		files: "shaka-player.compiled.debug.js",
		requires: "muxjs"
	};

	function patch_jszip(text) {
		// don't store in window
		text = text
			.replace(/^/, "var _fakeWindow={};\n")
			.replace(/\("undefined"!=typeof window.window:"undefined"!=typeof global.global:"undefined"!=typeof self.self:this\)/g, "(_fakeWindow)")
			.replace(/\("undefined"!=typeof window.window:void 0!==...:"undefined"!=typeof self\?self:this\)/g, "(_fakeWindow)")
			.replace(/if\(typeof window!=="undefined"\){g=window}/, 'if(typeof _fakeWindow!=="undefined"){g=_fakeWindow}')
			.replace(/typeof global !== "undefined" . global/, 'typeof _fakeWindow !== "undefined" ? _fakeWindow');

		return libexport_shim(text, "_fakeWindow.JSZip");
	}
	lib_patches["jszip"] = {
		patch: patch_jszip,
		files: "jszip.js"
	};

	var unwrap_object = function(obj) {
		var keys = Object.keys(obj);
		if (keys.length !== 1)
			return obj;
		return obj[keys[0]];
	}

	var cache = {};
	async function do_patch(libname, getfile) {
		if (!(libname in lib_patches)) {
			console.error("Invalid library", libname);
			return null;
		}

		if (libname in cache)
			return cache[libname];

		var patchinfo = lib_patches[libname];
		var data = {};

		var fetched_file = await getfile(patchinfo.files);
		if (!fetched_file) {
			console.error("Unable to load file", patchinfo.files);
			return null;
		} else {
			data[patchinfo.files] = fetched_file;
		}

		if (patchinfo.requires) {
			var fetched_require = await do_patch(patchinfo.requires, getfile);
			if (!fetched_require) {
				console.error("Unable to load dependency", patchinfo.requires);
				return null;
			}

			data[patchinfo.requires] = fetched_require;
		}

		var patched = patchinfo.patch(unwrap_object(data));
		if (patchinfo.cached)
			cache[libname] = patched;

		return patched;
	}
	patch_lib = do_patch;

	// https://stackoverflow.com/a/42587206
	var isCLI = typeof navigator === "undefined" && !module.parent;
	if (isCLI) {
		var fs = require("fs");
		var readfile = function(file) {
			return fs.readFileSync(file).toString();
		};

		var process_cli = async function(argv) {
			var patch = argv[2];
			if (!patch) {
				console.error("Need patch type");
				return;
			}

			if (!(patch in lib_patches)) {
				console.error("Invalid patch", patch);
				return;
			}

			var dirname = argv[3];
			if (!dirname) {
				console.error("Need orig library dirname");
				return;
			}

			process.stdout.write(await do_patch(patch, function(libname) {
				return readfile(dirname + "/" + libname);
			}));
		};

		process_cli(process.argv);
	}
})();
