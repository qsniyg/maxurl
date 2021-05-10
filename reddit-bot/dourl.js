var request = require("request");
//require("request-debug")(request);
var bigimage = require('../userscript.user.js');
var probe = require('probe-image-size');
var iconv = require("iconv-lite");

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

var db = null;
var db_content = null;

var usemongo = false;
if (usemongo) {
  MongoClient.connect(url, (err, client) => {
    if (err) {
      console.dir(err);
      return;
    }

    console.log("Connected to MongoDB");

    db = client.db("maximage");
    db_content = db.collection("content");
  });
}

var blacklist = [
	// Posts that would be insensitive to comment on
	"killed",
	"died",
	"death",
	"murdered",
	"murder",
	"martyr",
	"martyred",
	"nazi",
	"nazis",
	"rape",
	"rapes",
	"raped",
	"raping",
	"molest",
	"molested",
	"molesting",
	"traffick",
	"trafficking",
	"trafick",
	"traficking",
	"misconduct",
	"allegation",
	"alegation",
	"allegations",
	"alegations",
	"supremacist",
	"supremacists",
	"supremacy",
	"kkk",
	"charged",
	"crime",
	"criminal",
	"convicted",
	"abuse",
	"abuses",
	"exploiting",
	"exploits",
	"minor",
	"minors",
	"assaults",
	"assaulted",
	"drugged",

	// Posts in-between the first and second category
	"embarrassed",
	"embarrassing",
	"cringe",
	"cringiest",
	"cringefest",
	"shame",
	"shames",
	"shaming",

	// Posts that people commonly dislike the bot commenting on
	"punch",
	"punchable",
	"ugly",
	"fat"
];

function inblacklist(x, blacklist) {
	var black = false;
	x.toLowerCase().replace(/[-_.,!?'"]/g, " ").split(" ").forEach((word) => {
		word = word
			.replace(/^[^a-z]*/, "")
			.replace(/[^a-z]*$/, "");
		if (blacklist.indexOf(word) >= 0) {
			black = true;
			return;
		}
	});

	return black;
}

function inuserblacklist(x, blacklist) {
	x = x.toLowerCase();
	return blacklist.indexOf(x) >= 0;
}

var base_headers = {
	//"user-agent": 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36',
	"user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36",
	"pragma": 'no-cache',
	"cache-control": 'max-age=0',
	"accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
	"accept-encoding": "gzip, deflate",
	"accept-language": "en-US,en;q=0.9"
};

function getimagesize(url, is_first) {
	if (typeof (url) === "string") {
		var headers = JSON.parse(JSON.stringify(base_headers));
		headers.Referer = "https://www.reddit.com/r/all/";

		// for Tumblr
		if (is_first)
			headers.accept = "*/*";

		return probe(url, {
			// mimic the browser to avoid problems with photobucket or wikia urls
			headers: headers
		});
	}

	/*if (typeof(url.url) === "string") {
	  return getimagesize(url.url);
	}*/

	return new Promise((resolve, reject) => {
		var do_getimage = function (urls, err) {
			if (urls.length === 0) {
				reject(err);
				return;
			}

			if (urls[0].is_private) {
				console.log("Private URL: ", urls);
				return reject("private");
				return do_getimage(urls.slice(1), "private");
			}

			getimagesize(urls[0].url).then(
				(data) => {
					resolve({
						newdata: data,
						big: urls[0]
					});
				},
				(err) => {
					do_getimage(urls.slice(1), err);
				}
			);
		};

		do_getimage(url);
	});
}

function log(log_entry) {
	//console.dir(log_entry);

	if (db_content) {
		db_content.insert(log_entry, (err, result) => {
			if (err) {
				console.dir(err);
				return;
			}
		});
	}
}

function log_if_image(log_entry, post) {
	return;

	if (!post)
		return;

	var url = log_entry.reddit.url;
	if ((post.post_hint === "image" ||
		url.match(/\.(?:jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|tif|TIF|tiff|TIFF|svg|SVG|webp|WEBP)(?:[.?/].*)?$/)) &&
		// don't include these because of disk constraints
		post.domain !== "i.redd.it" &&
		!post.domain.match(/\.redditmedia\.com$/) &&
		post.domain !== "imgur.com" &&
		post.domain !== "i.imgur.com") {
		log(log_entry);
	}
}

function is_googlephotos(domain, url) {
	// example URL:
	// https://lh3.googleusercontent.com/d0S766DSecCcu1Q544n3s46uWD5oe7YpSZUqTyZlSTpNP2SF7-RSWuw3XXZ3iGddkYHzrNnopdxxwGPWVWvAwDQBl8We-b6cij1icKXgnl--E3VA9RWLQb4jFSOLq8Oicrpr7J89B2irwIIRfni5j91my2_V61LT3XmhORrWABfA5PIj_r2tsJwU7Oj8f3o0cnmjCZcea7UauXwlckPPi16cPmc3w5kRBGCbsnBlDpLLUlYgJIVJM0_usk83WwCL4XQmP6sK4NFR3m3jMgi6gV0Ocq3PsRXcL9ansYTzfFxaaYow_ugCJWX4cW_GP9cGLEs4nYAOJxCZaYJU5dwnaCbItXYXXRtDaOiTz69ZW0LvVZhBxrH9FDXKVACPa7IJoSrAJXSIBX59SzwxWC50qPyVdSS70PXdj2B1VWXRaduUYmpoaspVsW4IptE18vn2m6tWMT-OFRLdRaF3Vd6VplmCnnr9bdl0LOiLUChctwscQE9Lp4N3mwt2l65HXpB6wMo11HSDG1ARcLyUecFWiNzyUoimwGdX0P4X02at54cOeqCeIoqEP14uvLo=s0?imgmax=0
	// still working:
	// https://lh3.googleusercontent.com/ET-I3WGzylf5h2QIpdyuRrWGoTb3C3DVRow4oAOpt7VuOccWLjyUoWb2iW0kmgle-mN8yTYCZkYJvM6w-FLDuo7Yp7TpTi1YzldjX1Y2qzAfWQ_0Yd0LlGwS18gpYUpROhnmEBO6CeqjuTvBPZTtrf-eTnqCgTaOLNL0ENOgW0EUS1ZxJsdZ_TYHznqUveHD8hcko93CETrh2IeGXKYDGzM0wDmfD836jgroWJTHOXKUr7wFbKghZmmudMfsU4EEn8WrkU_8GJYaDCRnxj_aGtIWBXn1wh4gqOY7OnTR7BQXp7I0eH06B6Cy3C9sTFWuJU5NBoZORLlSs5zCJ-b3Bbc_BEB0xbsHJ_mAziE6bsHCcniOdJ8SNqNQgW9uoW38tY5MKFg-knhfSNxAk2sGBTQ2wczQV6uTUll5ZVOWAPVkwYCX9Ky6gjd-s9ymx-pR7Ray10mDv1KZ1NeqAXdbVAV30tPYv6HnCe1n4C9y_PnuBI688t9k0NNqBjDj-h8pEVdmCjUx2ZEFp5mTBxJCau2sgI59HGrE_6D7XaUWm294kWlOfGrkPeTE_S8ssaCE7DV-CBmtRoWQFHXlZOa9AL750j9dgMurdn4PjpROUALhl7bHpim9o8jc_vOrAc_ZJdAVmcXigFx8KD_ltLq8MbwNpCoMKZr-uQ=w958-h719-no
	//   https://lh3.googleusercontent.com/ET-I3WGzylf5h2QIpdyuRrWGoTb3C3DVRow4oAOpt7VuOccWLjyUoWb2iW0kmgle-mN8yTYCZkYJvM6w-FLDuo7Yp7TpTi1YzldjX1Y2qzAfWQ_0Yd0LlGwS18gpYUpROhnmEBO6CeqjuTvBPZTtrf-eTnqCgTaOLNL0ENOgW0EUS1ZxJsdZ_TYHznqUveHD8hcko93CETrh2IeGXKYDGzM0wDmfD836jgroWJTHOXKUr7wFbKghZmmudMfsU4EEn8WrkU_8GJYaDCRnxj_aGtIWBXn1wh4gqOY7OnTR7BQXp7I0eH06B6Cy3C9sTFWuJU5NBoZORLlSs5zCJ-b3Bbc_BEB0xbsHJ_mAziE6bsHCcniOdJ8SNqNQgW9uoW38tY5MKFg-knhfSNxAk2sGBTQ2wczQV6uTUll5ZVOWAPVkwYCX9Ky6gjd-s9ymx-pR7Ray10mDv1KZ1NeqAXdbVAV30tPYv6HnCe1n4C9y_PnuBI688t9k0NNqBjDj-h8pEVdmCjUx2ZEFp5mTBxJCau2sgI59HGrE_6D7XaUWm294kWlOfGrkPeTE_S8ssaCE7DV-CBmtRoWQFHXlZOa9AL750j9dgMurdn4PjpROUALhl7bHpim9o8jc_vOrAc_ZJdAVmcXigFx8KD_ltLq8MbwNpCoMKZr-uQ=s0?imgmax=0
	if (domain.match(/\.googleusercontent\.com$/) ||
		domain.match(/\.ggpht\.com$/)) {
		if (/\/proxy\//.test(url))
			return true;

		var p1 = url.replace(/^[a-z]+:\/\/[^/]*\/([^/]*).*?$/, "$1");
		console.log(p1.length);
		return p1.length > 450;
	}

	return false;
}

function is_youtube_url(url) {
	var regexes = [
		/^[a-z]+:\/\/(?:(?:www|m)\.)?youtube\.com\/+watch\?(?:.*&)?v=([^&#]*)/,
		/^[a-z]+:\/\/(?:(?:www|m)\.)?youtu\.be\/+([^?&#]*)/,
		/^[a-z]+:\/\/i\.ytimg\.com\/+([^?&#]*)/,
		/^[a-z]+:\/\/(?:[^/]+\.)?(?:gfycat|redgifs)\.com\//,
		/^[a-z]+:\/\/(?:[^/]+\.)?(?:instagram|facebook|patreon)\.com\//,
		/^[a-z]+:\/\/(?:www\.)?(?:vimeo|dailymotion)\.com\//,
		/^[a-z]+:\/\/(?:www\.)?twitter\.com\//,
		/^[a-z]+:\/\/(?:www\.)?imgur\.com\/+(?:(?:a|gallery)\/+)?[^/.]+(?:[?#].*)?$/,
		/^[a-z]+:\/\/(?:(?:www|v)\.)?reddit\.com\//
	];

	for (var regex of regexes) {
		if (regex.test(url))
			return true;
	}

	return false;
}

function npify(text) {
	return text.replace(/:\/\/www\.reddit\./g, "://np.reddit.");
}

function post_in_moderated(post) {
	// TODO: improve?
	return "approved" in post;
}

function dourl_inner(big, url, post, options, cb) {
	//console.dir(JSON.parse(JSON.stringify(post)));

	var log_entry = {
		reddit: {},
		blacklisted: false,
		posted: false
	};

	var savefields = [
		"subreddit_name_prefixed",
		"title",
		"name",
		"domain",
		"created_utc",
		"over_18",
		"author",
		"permalink",
		"url"
	];

	var json_post;
	if (post) {
		json_post = JSON.parse(JSON.stringify(post));

		savefields.forEach((field) => {
			log_entry.reddit[field] = json_post[field];
		});
	}

	if (big.length === 1 && big[0].url === url) {
		log_if_image(log_entry, post);
		return;
	}

	if (post && post.over_18 && !options.allow_nsfw) {
		console.log("Post is NSFW, disallowed by options");
		return;
	}

	if (post && options.exclude_mod && post_in_moderated(post)) {
		console.log("Post is in moderated subreddit, excluding");
		return;
	}

	/*if (big === url) {
	  return;
	}*/

	if (options.blacklist && post && inblacklist(post.title, options.blacklist)) {
		console.log("Post blacklisted:\n" + post.title + "\n" + post.permalink + "\n" + post.url + "\n=====\n\n");
		log_entry.blacklisted = true;
		log(log_entry);
		return;
	}

	if (options.user_blacklist && post && inuserblacklist(post.author.name, options.user_blacklist)) {
		console.log("User blacklisted: " + post.author.name);
		return;
	}

	for (var i = 0; i < big.length; i++) {
		if (big[i].is_pagelink) {
			// allow imgur pagelinks
			if (/^[a-z]+:\/\/(?:www\.)?imgur\.com\//.test(big[i].url)) {
				big.splice(i, 1);
				break;
			}

			console.log("Page link: ", big[i]);
			return;
		}
	}

	console.log(url);
	console.log(big);
	console.log("---");

	getimagesize(url, true).then(
		(data) => {
			log_entry.orig_probe = data;
			if ("headers" in log_entry.orig_probe)
				delete log_entry.orig_probe.headers;

			getimagesize(big).then(
				(obj) => {
					var newdata = obj.newdata;
					big = obj.big;

					var resp = {
						responseHeaders: ""
					};

					for (var header in newdata.headers) {
						resp.responseHeaders += header + ": " + newdata.headers[header] + "\r\n";
					}

					if (big.bad || bigimage.check_bad_if(big.bad_if, resp)) {
						console.log("Bad image");
						return;
					}

					log_entry.new_probe = JSON.parse(JSON.stringify(newdata));
					if ("headers" in log_entry.new_probe)
						delete log_entry.new_probe.headers;

					if (newdata.headers) {
						if (newdata.headers["content-type"]) {
							log_entry.new_probe.headers = {
								"content-type": newdata.headers["content-type"]
							};

							var ctype = newdata.headers["content-type"];
							if (ctype.match(/^ *text\//) /*&& !big.head_wrong_contenttype*/ ||
								ctype.match(/^ *image\/tiff *$/)) {
								console.log("Content-Type = " + ctype);
								log(log_entry);
								return;
							}

							if (ctype.match(/binary\//) ||
								ctype.match(/application\//) ||
								!ctype.match(/^image\//)) {
								console.log("Content-Type = " + ctype + " (forces download)");
								log(log_entry);
								return;
							}
						}

						if (newdata.headers["content-disposition"]) {
							var cdisposition = newdata.headers["content-disposition"];
							if (cdisposition.match(/^attachment/)) {
								console.log("Content-Disposition = " + cdisposition);
								log(log_entry);
								return;
							}
						}
					}

					var orig_domain = url.replace(/^[a-z]+:\/\/([^/]*)\/.*/, "$1");
					var new_domain = newdata.url.replace(/^[a-z]+:\/\/([^/]*)\/.*/, "$1");

					var wr = newdata.width / data.width;
					var hr = newdata.height / data.height;

					if (data.type === "gif" && newdata.type !== "gif") {
						console.log("Would un-gifify image");
						return;
					}

					var r;

					if (true) {
						r = (wr + hr) / 2;
					} else {
						r = (newdata.width * newdata.height) / (data.width * data.height);
					}

					if (r >= options.min_ratio && (((newdata.width - data.width) > options.thresh_px &&
						newdata.height > data.height) ||
						((newdata.height - data.height) > options.thresh_px &&
							newdata.width > data.width))) {
						var times = "" + r.toFixed(1) + "x";

						if (r < 1.995) {
							times = "" + ((r - 1) * 100).toFixed(0) + "%";
						}

						times += " larger";

						var comment = "";

						var filesize_text = "";
						var mbs = newdata.length / 1024 / 1024;
						if (mbs > 2) {
							filesize_text = ", " + mbs.toFixed(1) + "MB";
						}

						var linkcomment = "";
						if ((newdata.height * newdata.width) > (10*1000 * 10*1000)) {
							linkcomment = " (due to its size, opening this may consume a significant amount of RAM)";
						} else if (options.shocking) {
							linkcomment = " (click at your own risk...)";
						}

						if (options.comment_header)
							comment += options.comment_header + "\n\n";

						comment += times + " (" + parseInt(newdata.width) + "x" + parseInt(newdata.height) + filesize_text + ") version of linked image:\n\n";
						comment += "[" + newdata.url
							.replace(/\\/g, "\\\\")
							.replace(/_/g, "\\_")
							.replace(/\*/g, "\\*")
							.replace(/[[]/g, "\\[")
							.replace(/]/g, "\\]") + "](" + newdata.url.replace(/[)]/g, "\\)") + ")" + linkcomment + "\n\n";

						if (new_domain === "pbs.twimg.com" &&
							newdata.url.indexOf("?name=orig") >= 0 &&
							// seems like twitter resizes to 2048 height (or width?) as of late
							// https://pbs.twimg.com/media/EN19OKgVAAEmK0E.jpg?name=orig -- 2048x1408
							newdata.width !== 4096 && newdata.height !== 4096 && newdata.height !== 2048 && newdata.width !== 2048) {
							// https://pbs.twimg.com/media/EApe63wXkAA_GXZ.jpg?name=orig -- 4711x3141, maybe only check height?
							big.is_original = true;
						}

						var is_original = big.is_original;

						if (options.explain_original) {
							// explain imgur, as the urls often confuse people
							if (orig_domain === "i.imgur.com" &&
								new_domain === "i.imgur.com" && !big.is_original) {
								is_original = true;
								comment += "*This is the original size uploaded to imgur";

								if (url.length - 1 === newdata.url.length) {
									var id1_regex = /^[a-z]+:\/\/[^/]*\/([^/.]*)(.)\.[^/.]*(?:[?#].*)?$/;
									var id2_regex = /^[a-z]+:\/\/[^/]*\/([^/.]*)\.[^/.]*(?:[?#].*)?$/;
									var imgur_id_1 = url.replace(id1_regex, "$1");
									var imgur_id_2 = newdata.url.replace(id2_regex, "$1");
									if (imgur_id_2 === imgur_id_1) {
										comment += " (`" + url.replace(id1_regex, "$2") + "` was removed from the end of the filename)";
									}
								}
								comment += "*\n\n";
							} else if (big.is_original) {
								comment += "*This is the original size of the image stored on the site. If the image looks upscaled, it's likely because the image stored on the site is itself upscaled.*\n\n";
							}
						}

						if (options.only_original && !is_original) {
							console.log("Not original, ignoring");
							return;
						}

						if (is_googlephotos(orig_domain, url) &&
							is_googlephotos(new_domain, newdata.url)) {
							// Google Photos sometimes works, sometimes expire.
							console.log("Google photos, ignoring");
							return;
							comment += "*****\n\n**Note to OP:** Your linked image (as well as the image linked by this bot) could expire within a few hours, as it looks like a temporary image link from Google. Consider reuploading this image to a different host.\n\n";
						}

						if (options.original_page && big.extra && big.extra.page) {
							// this would just be spammy
							if (new_domain !== "i.imgur.com")
								comment += "*****\n\nOriginal page: " + big.extra.page + "\n\n";
						}

						//var faq_link = "https://www.reddit.com/r/MaxImage/comments/8znfgw/faq/";
						//var faq_link = "https://www.reddit.com/r/MaxImage/comments/d0zshj/faq/";
						var faq_link = "https://www.reddit.com/r/MaxImage/comments/ffxfj1/faq/";
						if (options.np)
							faq_link = npify(faq_link);

						comment += "*****\n\n";
						//comment += "^[why?](https://www.reddit.com/r/MaxImage/comments/8znfgw/faq/)&nbsp;|&nbsp;to&nbsp;find&nbsp;larger&nbsp;images:&nbsp;[website](https://qsniyg.github.io/maxurl/)&nbsp;/&nbsp;[userscript](https://greasyfork.org/en/scripts/36662-image-max-url)";
						//comment += "[why?](https://www.reddit.com/r/MaxImage/comments/8znfgw/faq/) | to find larger images yourself: [website](https://qsniyg.github.io/maxurl/) / [userscript](https://greasyfork.org/en/scripts/36662-image-max-url)";
						// show the extension link instead of the website, as gitcdn is really off and on (need to find something else)
						var sections = [];

						if (options.add_about_link) {
							sections.push("[why?](" + faq_link + ")");
						}

						if (options.add_imu_links) {
							sections.push("to find larger images yourself: [extension](https://addons.mozilla.org/en-US/firefox/addon/image-max-url/) / [userscript](https://greasyfork.org/en/scripts/36662-image-max-url) / [website](https://qsniyg.github.io/maxurl/) ([guide](https://www.reddit.com/r/MaxImage/wiki/pictures))");
						}

						//comment += "[why?](" + faq_link + ") | to find larger images yourself: [extension](https://addons.mozilla.org/en-US/firefox/addon/image-max-url/) / [userscript](https://greasyfork.org/en/scripts/36662-image-max-url) / [website](https://qsniyg.github.io/maxurl/) ([guide](https://www.reddit.com/r/MaxImage/wiki/pictures))";
						comment += sections.join(" | ");
						if (options.np)
							comment = npify(comment);
						console.log(comment);
						if (post) {
							var logged = false;
							try {
								post.reply(comment).then((comment_data) => {
									log_entry.posted = comment_data.id;

									log_entry.error = null;

									if (!logged) {
										log(log_entry);
										logged = true;
									}

									var operations = [];

									var semifinal_cb = function(comment_data) {
										if (options.lock_comment) {
											comment_data.lock();
										}

										if (cb) {
											cb(comment_data);
										}
									};

									if (options.removable) {
										operations.push(function(comment_data) {
											if (sections.length > 0) {
												comment += " | ";
											}

											// np.reddit.com to avoid the "no participation" warning
											return comment_data.edit(
												//comment + "&nbsp;|&nbsp;[remove](https://np.reddit.com/message/compose/?to=MaxImageBot&subject=delete:+" + comment_data.id + "&message=If%20you%20are%20the%20one%20who%20submitted%20the%20post%2C%20it%20should%20be%20deleted%20within%20~20%20seconds.%20If%20it%20isn%27t%2C%20please%20check%20the%20FAQ%3A%20https%3A%2F%2Fnp.reddit.com%2Fr%2FMaxImage%2Fcomments%2F8znfgw%2Ffaq%2F)"
												comment + "[remove](https://np.reddit.com/message/compose/?to=MaxImageBot&subject=delete:+" + comment_data.id + "&message=If%20you%20are%20the%20one%20who%20submitted%20the%20post%2C%20it%20should%20be%20deleted%20within%20~20%20seconds.%20If%20it%20isn%27t%2C%20please%20check%20the%20FAQ%3A%20" + encodeURIComponent(faq_link) + ")"
											);
										});
									}

									if (options.lock_comment) {
										operations.push(function(comment_data) {
											return comment_data.lock();
										});
									}

									if (options.sticky_comment || options.distinguish_comment) {
										operations.push(function(comment_data) {
											return comment_data.distinguish({
												status: true, // needs to be distinguished regardless to be sticky
												sticky: options.sticky_comment
											});
										});
									}

									if (options.lock_post) {
										operations.push(function(comment_data) {
											return post.lock();
										});
									}

									if (options.report_post) {
										operations.push(function(comment_data) {
											return post.report({
												reason: options.report_post
											});
										});
									}

									if (options.set_post_flair) {
										operations.push(function(comment_data) {
											var flairdata = {
												text: options.set_post_flair[0]
											};

											if (options.set_post_flair.length > 1) {
												flairdata.cssClass = options.set_post_flair[1];
											}

											return post.assignFlair(flairdata);
										});
									}

									if (options.remove_post) {
										operations.push(function(comment_data) {
											return post.remove();
										});
									}

									var run_operation = function() {
										if (operations.length === 0) {
											if (cb) {
												cb(comment_data);
											}
										} else {
											var current_op = operations.shift();

											current_op(comment_data).then(
												new_comment_data => {
													// doesn't work for .edit()
													//comment_data = new_comment_data;
													run_operation();
												},
												error => {
													console.error(error);
													run_operation();
												}
											);
										}
									};

									run_operation();
								});
							} catch (e) {
								console.error(e);

								log_entry.error = e.toString();

								if (!logged) {
									log(log_entry);
									logged = true;
								}
							}
						}
					} else {
						if (wr != 1 || hr != 1)
							console.log("Ratio too small: " + wr + ", " + hr + " (" + r + ", min: " + options.min_ratio + ")");
						if (post)
							log(log_entry);
					}
					console.log("========");
				},
				(err) => {
					console.dir(err);
					if (post) {
						log_entry.err = JSON.parse(JSON.stringify(err));
						log(log_entry);
					}
					return;
				}
			);
		},
		(err) => {
			console.dir(err);
			if (post) {
				log_entry.err = JSON.parse(JSON.stringify(err));
				log(log_entry);
			}
			return;
		}
	);
}

var base_options = {
	exclude_mod: false,
	removable: true,
	lock_comment: false,
	sticky_comment: false,
	distinguish_comment: false,
	remove_post: false,
	set_post_flair: null,
	report_post: false,
	lock_post: false,
	explain_original: true,
	original_page: true,
	blacklist: blacklist,
	user_blacklist: [],
	only_original: false,
	allow_nsfw: true,
	comment_header: null,
	add_about_link: true,
	add_imu_links: true,
	imgur_ua: null,
	//imgur_cookie: null,
	imgur_cookie: "frontpagebetav2=1; retina=0; over18=1",
	min_ratio: 1.3,
	thresh_px: 200
};

function dourl(url, post, options, cb) {
	if (!url.match(/^https?:\/\//) ||
		url.match(/^https?:\/\/(127\.0\.0\.1|192\.168\.|10\.[0-9]+\.|localhost|[^/.]+\/)/)) {
		console.log("Invalid URL: " + post.url);
		return;
	}

	if (is_youtube_url(url)) {
		console.log("Youtube URL: " + url);
		return;
	}

	var jar = request.jar();

	var imgurcookies = {
		//"frontpagebetav2": "1",
		"retina": "0",
		"over18": "1",
		"postpagebeta": "0",
		"postpagebetalogged": "0"
	};

	for (var cookiename in imgurcookies) {
		var cookievalue = imgurcookies[cookiename];
		jar.setCookie(request.cookie(cookiename + "=" + cookievalue), "https://www.imgur.com");
		jar.setCookie(request.cookie(cookiename + "=" + cookievalue), "https://imgur.com");
	}

	//console.log(jar);

	if (!options) {
		options = {};
	}

	for (var option in base_options) {
		if (!(option in options)) {
			options[option] = base_options[option];
		}
	}

	var bigimage_options = {
		fill_object: true,
		force_page: true,
		rule_specific: {},
		//exclude_videos: true,
		//allow_thirdparty: true,
		filter: function (url) {
			if (!bigimage.is_internet_url(url))
				return false;
			return true;
		},
		do_request: function (options) {
			var headers = JSON.parse(JSON.stringify(base_headers));
			if (options.headers) {
				for (var header in options.headers) {
					var headername = header.toLowerCase();
					var value = options.headers[headername];
					if (value)
						headers[headername] = value;
					else
						delete headers[headername];
				}
			}

			console.log("Requesting ", options.url);

			var requestopts = {
				method: options.method,
				uri: options.url,
				jar: jar,
				headers: headers,
				followRedirect: true,
				gzip: true,
				encoding: null
			};

			if (options.data) {
				requestopts.body = options.data;
			}

			request(requestopts, function (error, response, body) {
				if (error) {
					console.error(error);
					//console.log(requestopts);
				}

				if (!response) {
					console.error("Unable to get response");
					return;
				}

				var loc = response.caseless.get('location');
				if (!loc)
					loc = response.request.href;

				var encoding = "utf8";
				if (options.overrideMimeType) {
					var charsetmatch = options.overrideMimeType.match(/;\s*charset=([^;]*)/);
					if (charsetmatch) {
						encoding = charsetmatch[1];
					}
				}

				body = iconv.decode(body, encoding);

				var resp = {
					readyState: 4,
					finalUrl: loc,
					responseText: body,
					status: response.statusCode,
					statusText: response.statusMessage
				};

				options.onload(resp);
			});
		},
		cb: function (big) {
			dourl_inner(big, url, post, options, cb);
		}
	};

	if (options.imgur_cookie) {
		bigimage_options.rule_specific.imgur_nsfw_headers = {
			cookie: options.imgur_cookie
			//"User-Agent": options.imgur_ua
		};

		if (options.imgur_ua) {
			bigimage_options.rule_specific.imgur_nsfw_headers["user-agent"] = options.imgur_ua;
		}
	}

	// no video support, so this is useless
	bigimage_options.rule_specific.tiktok_no_watermarks = false;
	bigimage_options.rule_specific.twitter_use_ext = true; // we don't want ?name=orig&format=jpg instead of .jpg?name=orig

	bigimage(url, bigimage_options);
}

// large image
//dourl("https://i.guim.co.uk/img/media/856021cc9b024ee18480297110f6a9f38923b4ee/0_0_15637_9599/master/15637.jpg?w=1920&q=55&auto=format&usm=12&fit=max&s=774b471892a2a1870261227f29e9d77a");
// returns text/html if browser
//dourl("https://vignette.wikia.nocookie.net/arresteddevelopment/images/0/03/2x12_Hand_to_God_%2856%29.png/revision/latest/scale-to-width-down/670?cb=20130123233849");
// has an original page
//dourl("https://img00.deviantart.net/f4a7/i/2016/187/9/8/_brs__strength_by_aikiyun-da8xomm.jpg");
// non-previewable format
//dourl("https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/President_Roosevelt_-_Pach_Bros.tif/lossy-page1-800px-President_Roosevelt_-_Pach_Bros.tif.jpg");
// one letter difference in Imgur
//dourl("https://i.imgur.com/jrT3cjuh.png");
// originally had an odd image size, now fixed?
//dourl("https://i.cbc.ca/1.4883897.1540910176!/cpImage/httpImage/image.jpg_gen/derivatives/16x9_780/yosemite-deaths.jpg");
// deviantart page with a non-deviantart url
// https://www.deviantart.com/motesoegyi/art/Mileena-770165734
// https://wixmp-ed30a86b8c4ca887773594c2.appspot.com/_api/download/file?downloadToken=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsImV4cCI6MTU0MDk0ODQ4NCwiaWF0IjoxNTQwOTQ3ODc0LCJqdGkiOiI1YmQ4ZmZhYzFhZTgzIiwib2JqIjpudWxsLCJhdWQiOlsidXJuOnNlcnZpY2U6ZmlsZS5kb3dubG9hZCJdLCJwYXlsb2FkIjp7InBhdGgiOiJcL2ZcL2JjMTFhNWJkLWM4NWEtNGUwNy1hODkwLWE4M2NlMjg2Y2ZlZVwvZGNxamJvbS01YjQyMzA4Yi0xODFjLTRiYjYtOTEwOC01Y2UzNTA4OTg2ZTQuanBnIn19.dDWxHmko8CQMMz--4byYPJYSKxrEGxg7VYut2x0wCl0
// https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/intermediary/f/bc11a5bd-c85a-4e07-a890-a83ce286cfee/dcqjbom-5b42308b-181c-4bb6-9108-5ce3508986e4.jpg
// https://orig00.deviantart.net/49c2/f/2018/301/0/2/mileena_by_motesoegyi-dcqjbom.jpg
//dourl("https://pre00.deviantart.net/d54e/th/pre/i/2018/301/6/4/mileena_by_motesoegyi-dcqjbom.jpg");
// original image:
//dourl("http://i0.kym-cdn.com/photos/images/newsfeed/001/318/958/c7d.png");
//dourl("https://preview.redd.it/vjf4vjav3j131.jpg?width=640&crop=smart&auto=webp&s=2ceddce951cfff3ec2c627fc6e16c9865f187f02");
//dourl("https://pbs.twimg.com/media/D--plbeWkAEziX_.jpg");
//dourl("https://thumbs3.imgbox.com/e4/3f/eLFM9k0c_t.jpg");
// not original:
//dourl("https://pbs.twimg.com/media/DYlCdhxVMAAi8OM.jpg");
// can return a wrong image:
//dourl("https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/3953b6c9-6b84-493b-9832-cc14ba59fa07/d1fl69c-907907a6-ce19-48b2-b915-f823507cbbc4.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzM5NTNiNmM5LTZiODQtNDkzYi05ODMyLWNjMTRiYTU5ZmEwN1wvZDFmbDY5Yy05MDc5MDdhNi1jZTE5LTQ4YjItYjkxNS1mODIzNTA3Y2JiYzQuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.5IJp0mWnHzp_yKTxTaoNvw5c1r_1-PhUvzcvVdt_8Vk");
// post request
//dourl("https://it1.imgtown.net/i/00735/hm00jfc5ry20_t.jpg");
// overrideMimeType: (needs allow_thirdparty: true, and it fails due to photo.newsen.com requiring newsen to be the referer)
//dourl("http://photo.newsen.com/news_photo/2018/07/13/201807131531391510_1.jpg");
// test for shocking:
//dourl("https://i.imgur.com/jrT3cjuh.png", null, {shocking: true});
// test for np:
//dourl("https://i.imgur.com/jrT3cjuh.png", null, {np: true});
// requires libraries
//dourl("http://www.imgflare.com/i/00026/u6j8ulxub2su_t.jpg");
// private image:
//dourl("https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/55843f0c-f773-4b11-b8b1-89ed55c0b243/ddi92x8-76c983c5-4968-4058-be5e-a8442c4f69a8.png/v1/fill/w_1063,h_752,q_70,strp/colt_x_bo_nsfw_by_inflamedurethra_ddi92x8-pre.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9OTA1IiwicGF0aCI6IlwvZlwvNTU4NDNmMGMtZjc3My00YjExLWI4YjEtODllZDU1YzBiMjQzXC9kZGk5Mng4LTc2Yzk4M2M1LTQ5NjgtNDA1OC1iZTVlLWE4NDQyYzRmNjlhOC5wbmciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.LeeiL-h6ir-ZMDO91siBlegbFy0OYq-DXFlvRecBQlY");
// bad_if:
//dourl("https://thumbs.ebaystatic.com/d/l225/pict/400793189705_4.jpg");
// imgur nsfw that should still return a larger image
//dourl("https://i.imgur.com/L4BmEfg_d.jpg?maxwidth=640&shape=thumb&fidelity=medium");
// shouldn't show anything if exclude_videos == true
//dourl("https://thumbs.gfycat.com/YellowTornCockatiel-size_restricted.gif");
// should fail (content-disposition: attachment)
//dourl("https://connectgalaxy.com/gallery/icon/309557/taggable");
// should fail (bad-if), nsfw!
//dourl("https://i.imgur.com/4dLcGhR.gif")
// tumblr ("br" encoding shouldn't be supported)
//dourl("https://66.media.tumblr.com/2b129630fe50ae796d9383c5ba6ba35b/9e0fb8a88fdd1bdf-10/s640x960/d1a52d700422d91b37d653867fcadf46e933a1b1.jpg");
//dourl("https://66.media.tumblr.com/5f828c461e4b7b78246ce02e98c92406/be7c88941cb30a9f-d6/s540x810/f48956b3c78b9bc234a4878221ddf67514d177a9.png");
// huge image (10652x14204), nsfw!
//dourl("https://i.imgur.com/zsSsjXJ.jpg");
//dourl("https://img39.pixhost.to/images/373/138394353_3s3a1fiv9wfy.jpg");
// ungififying, nsfw!
//dourl("https://i.imgur.com/MdHTKCp.gif");
// youtube url
//dourl("https://i.ytimg.com/vi/q8skXJreN2Y/mqdefault.jpg");

module.exports = dourl;
