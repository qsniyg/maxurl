const NodeCache = require("node-cache");
var fs = require("fs");
var yaml = require("js-yaml");

var blacklist_json = JSON.parse(fs.readFileSync("./blacklist.json"));
var env_json = {};

require('dotenv').config({ path: "./.env-common" });
require('dotenv').config({ path: "./.env-service" });
env_json.user_agent = process.env.USERAGENT;
env_json.client_id = process.env.CLIENT_ID;
env_json.client_secret = process.env.CLIENT_SECRET;
env_json.refresh_token = process.env.REFRESH_TOKEN;
env_json.access_token = process.env.ACCESS_TOKEN;
env_json.imgur_ua = process.env.IMGUR_UA;
env_json.imgur_cookie = process.env.IMGUR_COOKIE;
//env_json.username = process.env.REDDIT_USER;
//env_json.password = process.env.REDDIT_PASS;

//console.dir(env_json);

const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');

const r = new Snoowrap(env_json);

r.config({ requestDelay: 1001 });
const client = new Snoostorm(r);

var dourl = require("./dourl.js");

const links = new NodeCache({ stdTTL: 0, checkperiod: 100 });

function is_number(n) {
	if (typeof n === "number")
		return true;

	if (typeof n === "string" && /^(?:[0-9]+|[0-9]+\.[0-9]+)$/.test(n)) {
		if (n.length > 30)
			return false;

		return true;
	}

	return false;
}

function strip_whitespace(x) {
	return x.replace(/^\s*|\s*$/g, "");
}

function parse_wiki_doc(doc, options) {
	if (!doc || typeof doc !== "object") {
		//console.log("Invalid YAML document");
		return;
	}

	var options_map = {
		"removable": true,
		"lock_comment": true,
		"sticky_comment": true,
		"distinguish_comment": true,
		"lock_post": true,
		"remove_post": true,
		"report_post": "text",
		//"set_post_flair": "array",
		"explain_original": true,
		"original_page": true,
		//"blacklisted_words": "blacklist",
		//"blacklisted_users": "blacklist",
		"only_original": true,
		"allow_nsfw": true,
		"comment_header": "text",
		"add_about_link": true,
		"add_imu_links": true
		//"min_ratio": true,
		//"min_pixels": "thresh_px"
	};

	for (var option in options_map) {
		if (option in doc) {
			var value;

			if (options_map[option] === true) {
				value = !!doc[option];
			} else if (options_map[option] === "text") {
				value = doc[option];
				if (typeof value !== "string" || value.length < 1)
					continue;
			}

			options[option] = value;
		}
	}

	if ("blacklisted_words" in doc && Array.isArray(doc.blacklisted_words)) {
		if (!("blacklist" in options)) {
			options.blacklist = [];
		}

		doc.blacklisted_words.forEach(function(word) {
			if (typeof word === "string") {
				options.blacklist.push(strip_whitespace(word.toLowerCase()));
			}
		});
	}

	if ("blacklisted_users" in doc && Array.isArray(doc.blacklisted_users)) {
		if (!("user_blacklist" in options)) {
			options.user_blacklist = [];
		}

		doc.blacklisted_users.forEach(function(user) {
			if (typeof user === "string") {
				options.user_blacklist.push(strip_whitespace(user.toLowerCase()));
			}
		});
	}

	if ("min_ratio" in doc && is_number(doc.min_ratio)) {
		var value = parseFloat(doc.min_ratio);
		if (isNaN(value) || value < 1)
			value = 1;

		options.min_ratio = value;
	}

	if ("min_pixels" in doc && is_number(doc.min_pixels)) {
		var value = parseInt(doc.min_pixels);
		if (isNaN(value) || value < 0)
			value = 0;

		options.thresh_px = value;
	}

	/*if ("report_post" in doc && typeof doc.report_post === "string" && doc.report_post.length > 0) {
		options.report_post = doc.report_post;
	}*/

	if ("set_post_flair" in doc && Array.isArray(doc.set_post_flair) && (doc.set_post_flair.length === 1 || doc.set_post_flair.length === 2)) {
		options.set_post_flair = doc.set_post_flair;
	}
}

var default_options = {};

function get_options_for_wikitext(wikitext) {
	if (wikitext.length > 10*1024) {
		console.log("Wiki text is too big!");
		return null;
	}

	var options = {};

	try {
		yaml.safeLoadAll(wikitext, function(doc) {
			parse_wiki_doc(doc, options);
		}, {json: true});
	} catch (e) {
		console.error(e);
	}

	return options;
}

var wikioptions = new NodeCache({ stdTTL: 20, checkperiod: 60 });

function get_wikitext_for_subreddit(subreddit, cb) {
	r.getSubreddit(subreddit).getWikiPage("maximagebot").fetch().then(
		wikipage => {
			cb(wikipage.content_md);
		},
		error => {
			//console.error(error);
			//console.error("Unable to fetch maximagebot wiki page for ", subreddit);
			cb(null);
		}
	);
}

function get_wikioptions_for_subreddit(subreddit, cb) {
	subreddit = subreddit.toLowerCase();

	var options = wikioptions.get(subreddit);
	if (options) {
		cb(options);
	} else {
		get_wikitext_for_subreddit(subreddit, function(text) {
			if (!text) {
				return cb({});
			}

			options = get_options_for_wikitext(text);
			if (options) {
				wikioptions.set(subreddit, options);
			}

			cb(options);
		});
	}
}

//var lastchecked = Date.now();

var started = Date.now();

var whitelisted_subreddits = [
	"maximagetest"
];
//console.dir(blacklist_json.disallowed);
if (true) {
	var submissionStream = client.SubmissionStream({
		"subreddit": "mod",
		"results": 100,
		// using a polltime of 1010 results in ratelimits
		"pollTime": 10*1000
	});

	setInterval(() => {
		r.getInbox({ "filter": "messages" }).then((inbox) => {
			inbox.forEach((message_data) => {
				if (!message_data["new"])
					return;

				var subreddit = message_data.subreddit_name_prefixed;

				if (/^invitation to moderate \/?(?:[ru]|user)\/\S+$/.test(message_data.subject)) {
					console.log("Invited to moderate " + subreddit);

					try {
						message_data.markAsRead();
						r.getSubreddit(subreddit).acceptModeratorInvite();
					} catch (e) {
						console.error(e);
					}
				}
			});
		});
	}, 10 * 1000);

	submissionStream.on("submission", function (post) {
		if (!post || !post.subreddit || !post.subreddit.display_name) {
			console.error("Post is invalid", post);
			return;
		}

		// for testing purposes
		var post_subreddit = post.subreddit.display_name.toLowerCase();
		if (false) {
			if (whitelisted_subreddits.indexOf(post_subreddit) < 0)
				return;
		}

		if (post.domain.startsWith("self.")) {
			return;
		}

		var current_time = Date.now();
		var created_millis = post.created_utc * 1000;
		/*if ((current_time - created_millis) > 60*1000) {
			console.log("Post is too old", post.permalink, current_time, created_millis, current_time - created_millis);
			return;
		}*/
		if (created_millis < started) {
			console.log("Post is too old", post.permalink, started, created_millis, started - created_millis);
			return;
		}

		var options = {
			imgur_ua: env_json.imgur_ua,
			imgur_cookie: env_json.imgur_cookie,
			exclude_mod: false,
			blacklist: []
		};

		// service bot, so this section is useless
		if (false && post.subreddit.display_name) {
			if (blacklist_json.disallowed.indexOf(post.subreddit.display_name.toLowerCase()) >= 0 ||
				blacklist_json.users.indexOf(post.author.name.toLowerCase()) >= 0) {
				console.log(post.subreddit);
				return;
			}

			if (blacklist_json.shocking.indexOf(post.subreddit.display_name.toLowerCase()) >= 0) {
				options.shocking = true;
			}

			if (blacklist_json.np.indexOf(post.subreddit.display_name.toLowerCase()) >= 0) {
				options.np = true;
			}
		}

		if (links.get(post.id) === true) {
			//console.log("Already processed " + post.permalink + ", skipping");
			return;
		}

		links.set(post.id, true);

		var url = post.url;

		get_wikioptions_for_subreddit(post_subreddit, function(new_options) {
			for (var option in new_options) {
				options[option] = new_options[option];
			}

			console.log(options);

			try {
				dourl(url, post, options);
			} catch (e) {
				console.error(e);
			}
		});
	});
}
