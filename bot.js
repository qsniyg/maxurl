var bigimage = require('./userscript.user.js');
var sizeOf = require('image-size');
var probe = require('probe-image-size');
var http = require('http');
var https = require('https');
var url = require('url');
const NodeCache = require( "node-cache" );
var fs = require("fs");

var blacklist_json = JSON.parse(fs.readFileSync("./blacklist.json"));

require('dotenv').config();

var thresh_px = 200;

const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');

const r = new Snoowrap({
    userAgent: 'pc:maximage:v0.0.1 (by /u/MaxImageBot)',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS
});
const client = new Snoostorm(r);

var blacklist = [
  "killed",
  "died",
  "death",
  "murdered",
  "murder"
];

function inblacklist(x) {
  var black = false;
  x.toLowerCase().split(" ").forEach((word) => {
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


var submissionStream = client.SubmissionStream({
  "subreddit": "all",
  "results": 100,
  "pollTime": 3000
});

/*function getimagesize(imgUrl, olddata) {
  var options = url.parse(imgUrl);
  return new Promise((resolve, reject) => {
    var getter = http;
    if (options.protocol === "https:")
      getter = https;
    getter.get(options, function(response) {
      if (response.statusCode !== 200) {
        reject({
          "status": response.statusCode
        });
        return;
      }

      var finish = function() {
        var buffer = Buffer.concat(chunks);
        response.destroy();
        try {
          var dimensions = sizeOf(buffer);
          resolve({
            length: length,
            width: dimensions.width,
            height: dimensions.height
          });
          return;
        } catch (e) {
          reject(e);
          return;
        }
      };

      var length = response.getHeader('content-length');
      if (length === olddata.length) {
        reject({
          "identical_length": length
        });
        return;
      }

      var chunks = [];
      var size = 0;
      response.on('data', function (chunk) {
        chunks.push(chunk);
        size += chunk.length;
        if (size > 2048) {
          finish();
        }
      }).on('end',function() {
        finish();
      });
    });
  });
  }*/

function getimagesize(url) {
  return probe(url);
}

function dourl(url, post) {
  var big = bigimage(url);
  if (big === url) {
    return;
  }

  if (inblacklist(post.title)) {
    console.log("Post blacklisted:\n" + post.title + "\n" + post.permalink + "\n" + post.url + "\n=====\n\n");
    return;
  }

  console.log(url);
  console.log(big);
  console.log("---");

  getimagesize(url).then(
    (data) => {
      getimagesize(big).then(
        (newdata) => {
          var wr = newdata.width / data.width;
          var hr = newdata.height / data.height;
          var r = (wr + hr) / 2;
          if (r >= 1.1 && (((newdata.width - data.width) > thresh_px &&
                            newdata.height > data.height) ||
                           ((newdata.height - data.height) > thresh_px &&
                            newdata.width > data.width))) {
            var comment = "" + r.toFixed(1) + "x larger (" + newdata.width + "x" + newdata.height + ") version of linked image:\n\n" + big + "\n\n";
            comment += "*****\n\n";
            comment += "^[source&nbsp;code](https://github.com/qsniyg/maxurl)&nbsp;|&nbsp;[userscript&nbsp;(redirects&nbsp;images)](https://greasyfork.org/en/scripts/36662-image-max-url)";
            console.log(comment);
            if (post) {
              post.reply(comment).then((comment_data) => {
                comment_data.edit(
                  comment + "&nbsp;|&nbsp;[remove](https://www.reddit.com/message/compose/?to=MaxImageBot&subject=delete:+" + comment_data.id + "&message=delete)"
                );
              });
            }
          } else {
            console.log("Ratio too small: " + wr + ", " + hr);
          }
          console.log("========");
        },
        (err) => {
          console.dir(err);
          return;
        }
      );
    },
    (err) => {
      console.dir(err);
      return;
    }
  );
}

const links = new NodeCache({ stdTTL: 600, checkperiod: 1000 });

setInterval(() => {
  r.getInbox({"filter":"messages"}).then((inbox) => {
    inbox.forEach((message_data) => {
      if (message_data.subject.indexOf("delete: ") !== 0 ||
          message_data.subject.length >= 50) {
        return;
      }

      var comment = message_data.subject.replace(/.*: *([A-Za-z0-9_]+).*/, "$1");
      if (comment === message_data.subject)
        return;

      r.getComment(comment).fetch().then((comment_data) => {
        if (comment_data.author.name.toLowerCase() !== "maximagebot")
          return;

        r.getComment(comment_data.parent_id).fetch().then((post_data) => {
          if (post_data.author.name.toLowerCase() !== message_data.author.name.toLowerCase()) {
            return;
          }

          console.log("Deleting " + comment);
          comment_data.delete();
          message_data.deleteFromInbox();
        });
      });
    });
  });
}, 10*1000);

//console.dir(blacklist_json.disallowed);
submissionStream.on("submission", function(post) {
  if (post.domain.startsWith("self.")) {
    return;
  }

  if (post.subreddit.display_name) {
    if (blacklist_json.disallowed.indexOf(post.subreddit.display_name.toLowerCase()) >= 0) {
      //console.log(post.subreddit);
      return;
    }
  }

  if (links.get(post.permalink) === true) {
    //console.log("Already processed " + post.permalink + ", skipping");
    return;
  }

  links.set(post.permalink, true);

  var url = post.url;
  dourl(url, post);
});
