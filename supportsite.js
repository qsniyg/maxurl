function reqsite_get_domain(url) {
    if (typeof url !== "string")
        return null;
    return url.replace(/^(?:[a-z]+:\/\/)?([^/]+)\/.*?$/, "$1");
}

function reqsite_cipher(text) {
    var newtext = [];
    for (var i = 0; i < text.length; i++) {
        newtext.push(String.fromCharCode(text.charCodeAt(i)^0x7f));
    }
    return newtext.join("");
}

// https://gist.github.com/jlevy/c246006675becc446360a798e2b2d781
function reqsite_simplehash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash; // Convert to 32bit integer
    }

    return hash;
}

// Commonly requested domains that currently cannot be supported.
// Please message me if you find a method to support these!
var reqsite_invalid_domains = [
    /\.fbcdn\.net$/,
    /\.cdninstagram\.com$/,
    /i\.discogs\.com$/,
    /www\.discogs\.com$/,
    /encrypted-tbn[0-9]*\.gstatic\.com$/
];

var reqsite_invalid_urls = [
    /^https?:\/\/i\.redd\.it\/+[0-9a-z]+\.[a-z]+$/,
    /^https?:\/\/i\.scdn\.co\/+image\/+[0-9a-f]{40}$/,
    /^https?:\/\/images\.genius\.com\/+[0-9a-f]{32}\.[0-9]+x[0-9]+x[0-9]+\.[a-z]+$/
];

function reqsite_valid_url(url) {
    if (typeof url !== "string" || !/^https?:\/\/[^/]+\//.test(url))
        return false;

    // If you self-host this, please don't disable this check unless you intend to update the userscript regularly.
    if (window.location.host && window.location.host !== "qsniyg.github.io")
        return false;

    for (var i = 0; i < reqsite_invalid_urls.length; i++) {
        if (reqsite_invalid_urls[i].test(url))
            return false;
    }

    var domain = reqsite_get_domain(url);
    if (!domain)
        return false;

    for (var i = 0; i < reqsite_invalid_domains.length; i++) {
        var invalid_domain = reqsite_invalid_domains[i];

        if (invalid_domain.test(domain))
            return false;
    }

    return true;
}

// User ID system as a basic protection against abuse (hashes multiple system values together to form a unique user ID)
// Feel free to override this function locally (e.g. using a userscript), but please don't abuse the request sytem!
function reqsite_userid() {
    var fields = [
        "userAgent",
        "languages",
        "deviceMemory",
        "hardwareConcurrency"
    ];

    var fields_str = [];

    for (var i = 0; i < fields.length; i++) {
        try {
            let field = navigator[fields[i]];
            if (Array.isArray(field)) {
                field = field[0];
            }
            fields_str.push(field);
        } catch (e) {};
    }

    try {
        fields_str.push(new Date().getTimezoneOffset());
    } catch (e) {}

    return reqsite_simplehash(fields_str.join("\n")).toString(16);
}

function reqsite_discord(siteurl, extrainfo, cb) {
    if (!siteurl || typeof siteurl !== "string") {
        return cb(false, "Invalid URL");
    }

    // simple protection against web scrapers
    var webhookurl = reqsite_cipher(atob('FwsLDwxFUFAbFgwcEA0bURwQElAeDxZQCBodFxAQFAxQTk9GRk5ITEpKRktPTEdOS0ZMTVAOHE0cFUkKGSYmR0sQCBYqPD4bKRg3Mz4eCSYvCyk2Mw8rCTMlCEsQOBYGDRcwLTcFE0kRTAg8HAkGFkYqLgUQHigbEg=='));

    var request = new XMLHttpRequest();
    request.open("POST", webhookurl, true);
    request.setRequestHeader("Content-Type", "application/json");

    var domain = reqsite_get_domain(siteurl);

    // to prevent discord from parsing the links
    var encodedurl = siteurl
        .replace(/^([a-z]+):\/\//, "$1...")
        .replace(/^http/, "----");
    encodedurl = btoa(encodedurl);

    var userid = reqsite_userid();

    var contents = [];
    contents.push("User: `" + userid + "`");
    contents.push("Domain: `" + domain + "`");
    contents.push("Link: `" + encodedurl + "`");
    if (extrainfo)
        contents.push("Extra: ```\n" + extrainfo + "\n```");

    var params = {
        username: "[Bot] Site Request",
        content: contents.join("\n")
    };

    var handler = function(e) {
        var status_string = request.status.toString();
        if (status_string[0] !== "2") {
            cb(false, "Unable to send message");
        } else {
            cb(true);
        }
    };

    request.onload = handler;
    request.onerror = handler;

    request.send(JSON.stringify(params));
}