var bigimage = require('./userscript');
var sizeOf = require('image-size');
var probe = require('probe-image-size');
var http = require('http');
var https = require('https');
var url = require('url');

require('dotenv').config();

var thresh_px = 300;

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


var submissionStream = client.SubmissionStream({
  "subreddit": "all",
  "results": 100,
  "pollTime": 2000
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
          if (((newdata.width - data.width) > thresh_px &&
               newdata.height > data.height) ||
              ((newdata.height - data.height) > thresh_px &&
               newdata.width > data.width)) {
            var comment = "Larger (" + r.toFixed(1) + "x) version of linked image:\n\n" + big + "\n\n";
            comment += "*****\n\n";
            comment += "^^[source&nbsp;code](https://github.com/qsniyg/maxurl)&nbsp;|&nbsp;[userscript](https://greasyfork.org/en/scripts/36662-image-max-url)";
            console.log(comment);
            post.reply(comment);
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

submissionStream.on("submission", function(post) {
  if (post.domain.startsWith("self.")) {
    return;
  }

  /*if (post.domain === "i.imgur.com" || post.domain === "i.redd.it")
    return;*/

  var url = post.url;
  dourl(url, post);
});
