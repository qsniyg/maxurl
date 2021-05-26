var process = require("process");
var util = require("./util.js");
var fs = require("fs");
const child_process = require("child_process");
process.chdir(__dirname + "/..");

var variables_list = [
	"_nir_debug_",
	"nir_debug",
	"Math_floor",
	"Math_round",
	"Math_random",
	"Math_max",
	"Math_min",
	"Math_abs",
	"get_random_text",
	"console_log",
	"console_error",
	"console_warn",
	"console_trace",
	"JSON_stringify",
	"JSON_parse",
	"base64_decode",
	"base64_encode",
	"is_array",
	"array_indexof",
	"string_indexof",
	//"native_blob",
	//"native_URL",
	"string_fromcharcode",
	"string_charat",
	"array_extend",
	"array_foreach",
	"array_or_null",
	"array_upush",
	"string_replaceall",
	"match_all",
	"obj_foreach",
	"obj_extend",
	"shallowcopy",
	"deepcopy",
	"_",
	"settings", // shouldn't be used, but just in case
	"new_map",
	"map_set",
	"map_get",
	"map_has",
	"map_remove",
	"map_foreach",
	"map_size",
	"new_set",
	"set_add",
	"set_has",
	"real_api_cache",
	"real_api_query",
	"real_website_query",
	"is_invalid_url",
	"mod",
	"norm_url",
	"urljoin",
	"fillobj",
	"fillobj_urls",
	"add_full_extensions",
	"add_extensions",
	"add_extensions_jpeg",
	"add_extensions_with_jpeg",
	"add_extensions_gif",
	"add_extensions_upper",
	"add_extensions_upper_jpeg",
	"add_http",
	"force_https",
	"decodeuri_ifneeded",
	"encodeuri_ifneeded",
	"replace_sizes",
	"zpadnum",
	"hex_to_ascii",
	"hex_to_numberarray",
	"numberarray_to_hex",
	"reverse_str",
	"decode_entities",
	"encode_entities",
	"encode_regex",
	"get_queries",
	"stringify_queries",
	"remove_queries",
	"keep_queries",
	"add_queries",
	"fuzzify_text",
	"fuzzy_date_compare",
	"parse_headers",
	"headers_list_to_dict",
	"headers_dict_to_list",
	"get_resp_finalurl",
	"get_ext_from_contenttype",
	"get_library",
	"normalize_whitespace",
	"strip_whitespace",
	"get_image_size",
	"sort_by_key",
	"sort_by_array",
	"parse_tag_def",
	"get_meta",
	"fixup_js_obj",
	"fixup_js_obj_proper",
	"common_functions",
	"get_domain_from_url",
	"get_domain_nosub",
	"looks_like_valid_link",
	"Cache",
	"url_basename"
];

var get_random_text = function(length) {
	var text = "";

	while (text.length < length) {
		var newtext = Math.floor(Math.random() * 10e8).toString(26);
		text += newtext;
	}

	text = text.substr(0, length);
	return text;
};

var nonce = get_random_text(16);

function get_bigimage(splitted) {
	var bigimage_start = -1;
	var bigimage_end = -1;

	for (var i = 0; i < splitted.length; i++) {
		if (bigimage_start < 0) {
			if (splitted[i] === "\tfunction bigimage(src, options) {") {
				bigimage_start = i;
			}
		} else {
			if (splitted[i] === "\t}" && splitted[i + 1] === "\t// -- end bigimage --") {
				bigimage_end = i;
				break;
			}
		}
	}

	if (bigimage_start < 0 || bigimage_end < 0) {
		console.error("Unable to find bigimage start/end", bigimage_start, bigimage_end);
		return null;
	}

	return [bigimage_start, bigimage_end];
}

var add_lines = function(in_arr, out_arr, fn) {
	for (var i = 0; i < in_arr.length; i++) {
		var line = fn(in_arr[i]);

		out_arr.push(line + ((i + 1) < in_arr.length ? "," : ""));
	}
}

function get_host_shim() {
	var lines = [];
	lines.push("var shared_variables = {");

	add_lines(variables_list, lines, function(variable) {
		return "\t'" + variable + "': " + variable;
	});

	lines.push("};");

	return lines;
}

function get_rules_shim() {
	var lines = [];

	for (var i = 0 ; i < variables_list.length; i++) {
		var variable = variables_list[i];

		lines.push("var " + variable + " = shared_variables['" + variable + "'];");
	}

	return lines;
}

function get_line_indentation(line) {
	return line.replace(/^(\s+).*$/, "$1");
}

function indent(lines, indentation) {
	var base_indent_regex = null;

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		if (!base_indent_regex && line.length > 0) {
			var our_indentation = line.replace(/^(\t*).*$/, "$1");
			if (our_indentation !== line && our_indentation.length > 0) {
				base_indent_regex = new RegExp("^\t{" + our_indentation.length + "}")
			} else {
				base_indent_regex = /^/;
			}
		}

		if (base_indent_regex) {
			line = line.replace(base_indent_regex, "");
		}

		if (line.length > 0)
			lines[i] = indentation + line;
	}

	return lines;
};

function replace_vars(line) {
	return line
		.replace(/__IMU_NONCE__/g, JSON.stringify(nonce))
		.replace(/__IMU_GETBIGIMAGE__/g, "$__imu_get_bigimage");
}

function gen_rules_js(lines, userscript_lines, startend) {
	var out_lines = [];

	for (var i = 0; i < lines.length; i++) {
		if (/^\s*\/\/ imu:/.test(lines[i])) {
			var indentation = get_line_indentation(lines[i]);
			if (lines[i].indexOf("imu:shared_variables") >= 0) {
				var rules_shim = get_rules_shim();
				indent(rules_shim, indentation);
				[].push.apply(out_lines, rules_shim);
			} else if (lines[i].indexOf("imu:bigimage") >= 0) {
				var bigimage_lines = indent(userscript_lines.slice(startend[0] + 1, startend[1]), indentation);
				[].push.apply(out_lines, bigimage_lines);
			}
		} else {
			out_lines.push(replace_vars(lines[i]));
		}
	}

	return out_lines;
}

function gen_userscript_replace(lines) {
	var out_lines = [];

	for (var i = 0; i < lines.length; i++) {
		if (/^\s*\/\/ imu:/.test(lines[i])) {
			var indentation = get_line_indentation(lines[i]);
			if (lines[i].indexOf("imu:shared_variables") >= 0) {
				var host_shim = get_host_shim();
				indent(host_shim, indentation);
				[].push.apply(out_lines, host_shim);
			}
		} else {
			out_lines.push(replace_vars(lines[i]));
		}
	}

	return out_lines;
}

function gen_userscript(lines, userscript_lines, startend) {
	var replace = gen_userscript_replace(lines);
	var indentation = get_line_indentation(userscript_lines[startend[0]]);
	indent(replace, indentation);

	replace.unshift((startend[1] + 2) - startend[0]);
	replace.unshift(startend[0]);

	[].splice.apply(userscript_lines, replace);

	return userscript_lines;
}

function rem_nonce(text) {
	return text.replace(/nonce: "[0-9a-z]+" \/\/ imu:nonce = .*/, "");
}

function get_commit_for(file) {
	var proc_result = child_process.spawnSync("git", ["log", "-1", file]);

	var stdout = proc_result.stdout.toString();

	var commit = stdout.match(/^commit ([0-9a-f]{20,})/);
	if (!commit) {
		return null;
	}

	return commit[1];
}

function modified_from_git(file) {
	var proc_result = child_process.spawnSync("git", ["diff-index", "HEAD", file]);

	return proc_result.stdout.length > 0;
}

function get_mb(text) {
	return parseInt((text.length / 1024 / 1024) * 10) / 10;
}

function start(userscript_filename) {
	var userscript_lines = util.read_as_lines(userscript_filename);
	var rules_lines = util.read_as_lines("tools/rules_template.js");
	var bigimage_lines = util.read_as_lines("tools/bigimage_template.js");

	var startend = get_bigimage(userscript_lines);
	if (!startend)
		return;

	var rules_js_lines = gen_rules_js(rules_lines, userscript_lines, startend);
	var rules_js = rules_js_lines.join("\n");

	var changed = true;
	try {
		var new_rules_js = fs.readFileSync("build/rules.js").toString();
		if (rem_nonce(new_rules_js) === rem_nonce(rules_js)) {
			console.log("Unchanged rules.js");
			rules_js = new_rules_js;
			changed = false;
		}
	} catch (e) {
		console.error(e);
	}

	var modified = true;
	var commit = null;

	if (changed) {
		fs.writeFileSync("build/rules.js", replace_vars(rules_js));
	} else {
		modified = modified_from_git("build/rules.js");
		if (!modified) {
			commit = get_commit_for("build/rules.js");
			if (!commit) {
				console.error("Unable to get commit for build/rules.js");
			}
		}
	}

	nonce = JSON.parse(rules_js.match(/\/\/ imu:nonce = ("[0-9a-z]+")/)[1]);

	userscript_lines = gen_userscript(bigimage_lines, userscript_lines, startend);
	var userscript_js = userscript_lines.join("\n");

	var userscript_require = userscript_js;
	if (commit) {
		var require_statement = [
			"//",
			"//  Greasyfork and OpenUserJS have 2MB and 1MB limits for userscripts (respectively).",
			"//  Because of this, the rules (~" + get_mb(rules_js) + "MB) have been split into a separate file, linked below.",
			"//  Note that jsdelivr.net might not always be reliable, but (AFAIK) this is the only reasonable option from what greasyfork allows.",
			"//  I'd recommend using the Github version of the script if you encounter any issues (linked in the 'Project links' section below).",
			"//",
			"// @require https://cdn.jsdelivr.net/gh/qsniyg/maxurl@" + commit + "/build/rules.js"
		].join("\n");
		userscript_require = userscript_require
			.replace(/\n\/\/\s*@(?:name|description):en.*/g, "") // greasyfork no longer allows this
			.replace(/^\/\/\s*imu:require_rules.*/m, require_statement)
			.replace(/\n\n\/\/\/ All comments within bigimage.*\n\/\/\/ You can view.*/, "\n");
	}

	// extr = external rules
	fs.writeFileSync("build/userscript_extr.user.js", userscript_require);

	fs.writeFileSync("build/userscript_extr_cat.user.js", rules_js + "\n\n" + userscript_js);
}

start("userscript_smaller.user.js");
