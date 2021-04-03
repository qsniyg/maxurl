var util = require("./util.js");
var maximage = require("../userscript.user.js");

var get_descriptions = function(strings) {
	var descriptions = {};

	var userscript = util.read_userscript();
	var match_regex = /\/\/ @description:([-a-zA-Z]+) +(.*)/;
	var matches = userscript.match(new RegExp(match_regex, "g"));
	for (const match_str of matches) {
		var match = match_str.match(match_regex);
		descriptions[match[1]] = match[2];
	}

	for (const lang in descriptions) {
		var value = descriptions[lang];
		strings["$description$"][lang] = value;
	}
};

var process_strings = function(internal) {
	/*for (var string in strings) {
		if (!("en" in strings[string])) {
			strings[string]["en"] = string;
		}
	}*/

	var settings_meta = internal.settings_meta;
	var settings = internal.settings;
	var strings = internal.strings;

	for (var setting in settings_meta) {
		var meta = settings_meta[setting];

		// don't add dead settings to translate
		if (!(setting in settings)) {
			continue;
		}

		var add_info_field = function(setting, fieldname, value) {
			if (!value)
				return;

			if (!(value in strings)) {
				strings[value] = {};
			} else if (true) {
				// reordering
				var oldvalue = strings[value];
				delete strings[value];
				strings[value] = oldvalue;
			}

			if (!("_info" in strings[value])) {
				strings[value]._info = {};
			}

			if (!("instances" in strings[value]._info)) {
				strings[value]._info.instances = [];
			}

			var instance = {
				setting: setting,
				field: fieldname
			};

			var instancejson = JSON.stringify(instance);

			var instances = strings[value]._info.instances;
			var found = false;
			for (var i = 0; i < instances.length; i++) {
				if (JSON.stringify(instances[i]) === instancejson) {
					found = true;
					break;
				}
			}

			if (!found)
				instances.push(instance);
		};

		add_info_field(setting, "name", meta.name);
		add_info_field(setting, "description", meta.description);
		add_info_field(setting, "description_userscript", meta.description_userscript);
		add_info_field(setting, "number_unit", meta.number_unit);

		if (meta.warning) {
			for (var key in meta.warning) {
				add_info_field(setting, "warning." + key, meta.warning[key]);
			}
		}

		if (meta.options) {
			var process_options = function(options) {
				for (var key in options) {
					if (/^_group/.test(key)) {
						process_options(options[key]);
					} else if (key[0] !== "_") {
						add_info_field(setting, "options." + key + ".name", options[key].name);
						add_info_field(setting, "options." + key + ".description", options[key].description);
					}
				};
			}

			process_options(meta.options);
		}

		if (meta.documentation) {
			add_info_field(setting, "documentation.title", meta.documentation.title);
			add_info_field(setting, "documentation.value", meta.documentation.value);
		}

		if (meta.example_websites) {
			for (var i = 0; i < meta.example_websites.length; i++) {
				add_info_field(setting, "example_websites[" + i + "]", meta.example_websites[i]);
			}
		}
	}

	for (var stringname in strings) {
		var stringvalue = strings[stringname];

		var warn = function(message) {
			console.warn(JSON.stringify(stringname), message);
		};

		if (!("_info" in stringvalue)) {
			continue;
		}

		var info = stringvalue._info;
		if (!("instances" in info))
			continue;

		var instances = info.instances;
		var validinstances = [];
		for (var i = 0; i < instances.length; i++) {
			var instance = instances[i];
			if (!instance.setting || !instance.field)
				continue;

			if (!(instance.setting in settings)) {
				warn("Setting not found in settings: " + instance.setting);
				continue;
			}

			if (!(instance.setting in settings_meta)) {
				warn("Setting not found in settings_meta: " + instance.setting);
				continue;
			}

			var meta = settings_meta[instance.setting];

			var value;

			try {
				if (/^options\./.test(instance.field)) {
					var option_match = instance.field.match(/^options\.(.*?)\.(name|description)$/);
					if (!option_match) {
						warn("Unable to find match for: " + instance.field);
						continue;
					}

					var option_name = option_match[1];

					var check_option = function(options) {
						for (var key in options) {
							if (/^_group/.test(key)) {
								var value = check_option(options[key]);
								if (value)
									return value;
							} else {
								if (key === option_name)
									return options[key];
							}
						}

						return false;
					};

					var option_value = check_option(meta.options);
					if (!option_value) {
						// hacky but it works
						throw "test";
					}

					if (!(option_match[2] in option_value))
						throw "test";

					value = option_value[option_match[2]];
				} else {
					value = eval("meta." + instance.field);
				}
			} catch (e) {
				warn("Field: " + instance.field + " not found for: " + instance.setting);
				continue;
			}

			if (value === undefined) {
				warn("Field: " + instance.field + " not found for: " + instance.setting);
				continue;
			}

			if (value !== stringname) {
				warn("Different value: " + JSON.stringify(value));
				continue;
			}

			validinstances.push(instance);
		}

		info.instances = validinstances;

		if (validinstances.length === 0) {
			warn("No valid instances found");
			delete strings[stringname];
		}
	}

	var string_order = ["_info", "en"];
	for (var string in strings) {
		var value = strings[string];

		strings[string] = {};
		var keys = Object.keys(value).sort(function(a, b) {
			var a_index = string_order.indexOf(a);
			var b_index = string_order.indexOf(b);

			if (a_index < 0) {
				if (b_index >= 0)
					return 1;
				else
					return a.localeCompare(b);
			} else {
				if (b_index < 0)
					return -1;
				else
					return a_index - b_index;
			}
		});

		// lists strings that don't have instances (non-setting strings)
		if (false && keys[0] !== "_info") {
			console.error("'_info' should be first", string, keys);
		}

		for (var i = 0; i < keys.length; i++) {
			strings[string][keys[i]] = value[keys[i]];
		}
	}

	return strings;
};

var start = function() {
	var strings = process_strings(maximage.internal);
	get_descriptions(strings);
	util.update_userscript_strings(strings);
};

start();
