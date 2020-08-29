// https://stackoverflow.com/a/31652607/13255485
var json_escape_unicode = function(stringified) {
    return stringified.replace(/[\u007F-\uFFFF]/g, function(chr) {
		return "\\u" + ("0000" + chr.charCodeAt(0).toString(16).toUpperCase()).substr(-4)
	});
};
module.exports.json_escape_unicode = json_escape_unicode;
