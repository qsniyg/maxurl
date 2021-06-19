.. raw:: html

   <p align="center">
     <img src="https://raw.githubusercontent.com/qsniyg/maxurl/master/resources/imu_opera_banner_transparent.png" alt="Image Max URL" title="Image Max URL" />
   </p>

Image Max URL is a program that will try to find larger/original versions of images and videos, usually by replacing URL patterns.

It currently contains support for >8000 hardcoded websites (full list in `sites.txt <https://github.com/qsniyg/maxurl/blob/master/sites.txt>`__),
but it also supports a number of generic engines (such as Wordpress and MediaWiki), which means it can work for many other websites as well.

It is currently released as:

- Userscript: `Greasyfork <https://greasyfork.org/scripts/36662-image-max-url>`__ | `OpenUserJS <https://openuserjs.org/scripts/qsniyg/Image_Max_URL>`__ (most browsers)

  - `userscript.user.js <https://github.com/qsniyg/maxurl/blob/master/userscript.user.js>`__ is also the base for everything listed below
  - It also serves as a node module (used by the reddit bot), and can be embedded in a website

- Browser extension: `Firefox Quantum <https://addons.mozilla.org/firefox/addon/image-max-url/>`__ | `Opera Beta/Developer <https://addons.opera.com/en/extensions/details/image-max-url/>`__ (other browsers supporting WebExtensions can sideload the extension through this git repository)

  - Since addons have more privileges than userscripts, it has a bit of extra functionality over the userscript
  - Source code is in `manifest.json <https://github.com/qsniyg/maxurl/blob/master/manifest.json>`__ and the `extension <https://github.com/qsniyg/maxurl/tree/master/extension>`__ folder

- `Website <https://qsniyg.github.io/maxurl/>`__

  - Due to browser security constraints, some URLs (requiring cross-origin requests) can't be supported by the website
  - Source code is in the `gh-pages <https://github.com/qsniyg/maxurl/tree/gh-pages>`__ branch

- Reddit bot (`/u/MaxImageBot <https://www.reddit.com/user/MaxImageBot/>`__)

  - Source code is in `reddit-bot/comment-bot.js <https://github.com/qsniyg/maxurl/blob/master/reddit-bot/comment-bot.js>`__ and `reddit-bot/dourl.js <https://github.com/qsniyg/maxurl/blob/master/reddit-bot/dourl.js>`__

Community:

- `Discord Server <https://discord.gg/fH9Pf54>`__

- `Matrix <https://matrix.to/#/#image-max-url:tedomum.net?via=tedomum.net>`__ (``#image-max-url:tedomum.net``)

- `Subreddit <http://reddit.com/r/MaxImage>`__

*************************
Sideloading the extension
*************************

The extension is currently unavailable to other browsers' addon stores (such as Chrome and Microsoft Edge),
but you can sideload this repository if you wish to use the extension version instead of the userscript.

- Repository:

  - Download the repository however you wish (I'd recommend cloning it through git as it allows easier updating)
  - Chromium:

    - Go to chrome://extensions, make sure "Developer mode" is enabled, click "Load unpacked [extension]", and navigate to the maxurl repository

  - Firefox:

    - Go to about:debugging->This Firefox, select "Load temporary Add-on...", and navigate to "manifest.json" within the maxurl repository
    - Note that the addon will be deleted once Firefox is closed. There's unfortunately nothing I can do about this.

- CRX (Chromium-based browsers):

  - Download the CRX build from https://github.com/qsniyg/maxurl/blob/master/build/ImageMaxURL_crx3.crx
  - Go to chrome://extensions, make sure "Developer mode" is enabled, then drag&drop the downloaded CRX file onto the page.

- XPI (Firefox-based browsers):

  - Download the XPI build from https://github.com/qsniyg/maxurl/blob/master/build/ImageMaxURL_signed.xpi
  - Go to about:addons, click on the gear icon, then select "Install Add-on from From File...", and navigate to the downloaded XPI file.

************
Contributing
************

Any contribution is greatly appreciated! If you have any bug reports, feature requests, or new websites you want supported, please file an issue here.

If you don't have a Github account, feel free to either use one of the community links above or `contact me directly <https://qsniyg.github.io/>`__.

If you wish to contribute to the repository itself (code contributions, translations, etc.), please check `CONTRIBUTING.md <https://github.com/qsniyg/maxurl/blob/master/CONTRIBUTING.md>`__
for more information.

*******************************
Integrating IMU in your program
*******************************

As mentioned above, userscript.user.js also functions as a node module.

.. code-block:: javascript

    var maximage = require('./userscript.user.js');

    maximage(smallimage, {
      // If set to false, it will return only the URL if there aren't any special properties
      // Recommended to keep true.
      //
      // The only reason this option exists is as a small hack for a helper userscript used to find new rules,
      //  to check if IMU already supports a rule.
      fill_object: true,

      // Maximum amount of times it should be run.
      // Recommended to be at least 5.
      iterations: 200,

      // Whether or not to store to, and use an internal cache for URLs.
      // Set this to "read" if you want to use the cache without storing results to it.
      use_cache: true,

      // Timeout (in seconds) for cache entries in the URL cache
      urlcache_time: 60*60,

      // List of "problems" (such as watermarks or possibly broken image) to exclude.
      //
      // By default, all problems are excluded.
      // You can access the excluded problems through maximage.default_options.exclude_problems
      // By setting it to [], no problems will be excluded.
      //exclude_problems: [],

      // Whether or not to exclude videos
      exclude_videos: false,

      // This will include a "history" of objects found through iterations.
      // Disabling this will only keep the objects found through the last successful iteration.
      include_pastobjs: true,

      // This will try to find the original page for an image, even if it requires extra requests.
      force_page: false,

      // This allows rules that use 3rd-party websites to find larger images
      allow_thirdparty: false,

      // This is useful for implementing a blacklist or whitelist.
      //  If unspecified, it accepts all URLs.
      filter: function(url) {
        return true;
      },

      // Helper function to perform HTTP requests, used for sites like Flickr
      //  The API is expected to be like GM_xmlHTTPRequest's API.
      // An implementation using node's request module can be found in reddit-bot/dourl.js
      do_request: function(options) {
        // options = {
        //   url: "",
        //   method: "GET",
        //   data: "", // for method: "POST"
        //   overrideMimeType: "", // used to decode alternate charsets
        //   headers: {}, // If a header is null or "", don't include that header
        //   onload: function(resp) {
        //     // resp is expected to be XMLHttpRequest-like object, implementing these fields:
        //     //   finalUrl
        //     //   readyState
        //     //   responseText
        //     //   status
        //   }
        // }
      },

      // Callback
      cb: function(result) {
        if (!result)
          return;

        if (result.length === 1 && result[0].url === smallimage) {
           // No larger image was found
           return;
        }

        for (var i = 0; i < result.length; i++) {
          // Do something with the object
        }
      }
    });

The result is a list of objects that contain properties that may be useful in using the returned image(s):

.. code-block:: javascript

    [{
      // The URL of the image
      url: null,

      // Whether or not this URL is a video
      video: false,

      // Whether it's expected that it will always work or not.
      //  Don't rely on this value if you don't have to
      always_ok: false,

      // Whether or not the URL is likely to work.
      likely_broken: false,

      // Whether or not the server supports a HEAD request.
      can_head: true,

      // HEAD errors that can be ignored
      head_ok_errors: [],

      // Whether or not the server might return the wrong Content-Type header in the HEAD request
      head_wrong_contenttype: false,

      // Whether or not the server might return the wrong Content-Length header in the HEAD request
      head_wrong_contentlength: false,

      // This is used in the return value of the exported function.
      //  If you're using a callback (as shown in the code example above),
      //  this value will always be false
      waiting: false,

      // Whether or not the returned URL is expected to redirect to another URL
      redirects: false,

      // Whether or not the URL is temporary/only works on the current IP (such as a generated download link)
      is_private: false,

      // Whether or not the URL is expected to be the original image stored on the website's servers.
      is_original: false,

      // If this is true, you shouldn't input this URL again into IMU.
      norecurse: false,

      // Whether or not this URL should be used.
      // If true, treat this like a 404
      // If "mask", this image is an overlayed mask
      bad: false,

      // Same as above, but contains a list of objects, e.g.:
      // [{
      //    headers: {"Content-Length": "1000"},
      //    status: 301
      // }]
      // If one of the objects matches the response, it's a bad image.
      // You can use maximage.check_bad_if(bad_if, resp) to check.
      //  (resp is expected to be an XHR-like object)
      bad_if: [],

      // Whether or not this URL is a "fake" URL that was used internally (i.e. if true, don't use this)
      fake: false,

      // Headers required to view the returned URL
      //  If a header is null, don't include that header.
      headers: {},

      // Additional properties that could be useful
      extra: {
        // The original page where this image was hosted
        page: null,

        // The title/caption attached to the image
        caption: null
      },

      // If set, this is a more descriptive filename for the image
      filename: "",

      // A list of problems with this image. Use exclude_problems to exclude images with specific problems
      problems: {
        // If true, the image is likely larger than the one inputted, but it also has a watermark (when the inputted one doesn't)
        watermark: false,

        // If true, the image is likely smaller than the one inputted, but it has no watermark
        smaller: false,

        // If true, the image might be entirely different from the one inputted
        possibly_different: false,

        // If true, the image might be broken (such as GIFs on Tumblr)
        possibly_broken: false
      }
    }]
