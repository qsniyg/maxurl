## Image Max URL

Website (https://qsniyg.github.io/maxurl/), userscript (https://greasyfork.org/en/scripts/36662-image-max-url) and reddit bot ([/u/MaxImageBot](https://www.reddit.com/user/MaxImageBot/)) to redirect images to larger/original versions.

### For users

Either use the website or install the userscript, which redirects to larger/original versions of images when you open them in a new tab.

### For developers

The userscript also functions as a node module.

    var maximage = require('./userscript.user.js');

    maximage(smallimage, {
      // If set to false, it will return only the URL if there aren't any special properties
      fill_object: true,

      // Maximum amount of times it should be run.
      //  Recommended to be at least 5
      iterations: 200,

      // Whether or not to store to, and use an internal cache
      use_cache: true,

      // Helper function to perform HTTP requests, used for sites like Flickr
      //  The API is expected to be like GM_xmlHTTPRequest's API.
      do_request: function(options) {
        // options = {
        //   url: "",
        //   method: "GET",
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

    {
      // Array or String, see code example above
      url: null,

      // Whether it's expected that it will always work or not.
      //  Don't rely on this value if you don't have to
      always_ok: false,

      // Whether or not the server supports a HEAD request.
      can_head: true,

      // Whether or not the server might return the wrong Content-Type header in the HEAD request
      head_wrong_contenttype: false,

      // Whether or not the server might return the wrong Content-Length header in the HEAD request
      head_wrong_contentlength: false,

      // This is used in the return value of the exported function.
      //  If you're using a callback (as shown in the code example above),
      /   this value will always be false
      waiting: false,

      // Whether or not the returned URL is expected to redirect to another URL
      redirects: false,

      // Whether or not this URL should be used
      bad: false,

      // Headers required to view the returned URL
      //  If a header is null, don't include that header.
      headers: {}
    }
