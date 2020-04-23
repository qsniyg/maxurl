const NodeCache = require("node-cache");
var fs = require("fs");

var blacklist_json = JSON.parse(fs.readFileSync("./blacklist.json"));
var env_json = {};

require('dotenv').config({ path: "./.env-common" });
require('dotenv').config({ path: "./.env-comment" });
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

const links = new NodeCache({ stdTTL: 600, checkperiod: 100 });

//console.dir(blacklist_json.disallowed);
if (true) {
	var submissionStream = client.SubmissionStream({
		"subreddit": "all",
		"results": 100,
		// using a polltime of 1010 results in ratelimits
		"pollTime": 2000
	});

	setInterval(() => {
		r.getInbox({ "filter": "messages" }).then((inbox) => {
			inbox.forEach((message_data) => {
				if (message_data.subject.indexOf("delete:") !== 0 ||
					message_data.subject.length >= 50 ||
					!message_data["new"]) {
					return;
				}

				var comment = message_data.subject.replace(/.*:[ +]*([A-Za-z0-9_]+).*/, "$1");
				if (comment === message_data.subject)
					return;
				console.log(comment);

				r.getComment(comment).fetch().then((comment_data) => {
					if (!comment_data) {
						console.log("Unable to fetch comment data for " + comment);
						message_data.deleteFromInbox();
						return;
					}

					if (!comment_data.author ||
						comment_data.author.name === "[deleted]") {
						console.log("Removing message for " + comment);
						message_data.deleteFromInbox();
						//return;
					}

					if (comment_data.author.name.toLowerCase() !== "maximagebot")
						return;

					// only delete top-level comments, if the parent is a comment, don't delete it
					// parent should be t3_ (link)
					if (/^t1_/.test(comment_data.parent_id)) {
						return;
					}

					r.getComment(comment_data.parent_id).fetch().then((post_data) => {
						if (!post_data.author ||
							!message_data.author ||
							post_data.author.name !== "[deleted]" &&
							post_data.author.name.toLowerCase() !== message_data.author.name.toLowerCase()) {
							return;
						}

						console.log("Deleting " + comment);
						comment_data.delete();
						message_data.deleteFromInbox();
					});
				});
			});
		});
	}, 10 * 1000);

	submissionStream.on("submission", function (post) {
		if (post.domain.startsWith("self.")) {
			return;
		}

		var options = {
			imgur_ua: env_json.imgur_ua,
			imgur_cookie: env_json.imgur_cookie
		};

		if (post.subreddit.display_name) {
			if (blacklist_json.disallowed.indexOf(post.subreddit.display_name.toLowerCase()) >= 0 ||
				blacklist_json.users.indexOf(post.author.name.toLowerCase()) >= 0) {
				//console.log(post.subreddit);
				return;
			}

			if (blacklist_json.shocking.indexOf(post.subreddit.display_name.toLowerCase()) >= 0) {
				options.shocking = true;
			}

			if (blacklist_json.np.indexOf(post.subreddit.display_name.toLowerCase()) >= 0) {
				options.np = true;
			}
		}

		if (links.get(post.permalink) === true) {
			//console.log("Already processed " + post.permalink + ", skipping");
			return;
		}

		links.set(post.permalink, true);

		var url = post.url;
		try {
			dourl(url, post, options);
		} catch (e) {
			console.error(e);
		}
	});
}
