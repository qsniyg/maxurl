

Translations
============

Translations are done through standard .po (gettext) files, located in the [po subdirectory](https://github.com/qsniyg/maxurl/tree/master/po).
You can either translate it manually using a text editor, or use one of the numerous .po translation tools, such as [poedit](https://poedit.net/) or [poeditor](https://poeditor.com/) (online).

To test a modified translation, run: `node tools/update_from_po.js`. This will update userscript.user.js with the translations from the po subdirectory.

Note: when submitting a pull request for a translation, please do not include the modified userscript.user.js, as it will increase the risk of merge conflicts.

To add support for a new language, create a new .po file for the language code from [po/imu.pot](https://github.com/qsniyg/maxurl/blob/master/po/imu.pot),
and make sure to translate `$language_native$` (the native word for your language, such as Français for French, or 한국어 for Korean).

Website/rule contributions
==========================

If you spot any issue with existing rules, or want to suggest a new websites, **the easiest way for the moment is if you file an issue**.

Pull requests are also accepted (especially if the rule you want to submit is complex), but since everything is currently stored in one file (userscript.user.js),
it can lead to merge conflicts.

------------

If you decide to make a pull request, here are the general guidelines I follow when adding a new rule. Don't worry too much about getting it
perfect though, I often get it wrong myself :) I can fix it up if you make a mistake.

- Check if the rule already exists

  - There's a chance the rule might already exist, but without support for the specific website you want to add support for.
    Try doing a regex search of the script to see if a similar rule has already been created.

- New website-specific rules are generally added before the `// -- general rules --` line (there's a large whitespace gap above it to make it clear).

  - General rules are added at the end of the general rules section (after the aforementioned line)
  - Sometimes some rules need to be above others for various reasons (e.g. host-specific rules).

- Use `domain`, `domain_nosub` or `domain_nowww` with a `===` comparison if possible for the `if` check.

  - If a regex test is needed, use `/regex/.test(...)`, and always try to make sure that it's after the initial `===` comparison.
    For example, if you want to match `img[0-9]+\.example\.com`, you can use `if (domain_nosub === "example.com" && /^img[0-9]+\./.test(domain))`.
    This helps to ensure that performance won't be too terrible :)
  - `domain_nowww` matches both example.com and www.example.com. Unless both domains are different (or one is nonexistant), use `domain_nowww`
    when referring to either of these domains.
  - An exception for this is with amazon buckets (e.g. bucket.s3.amazonaws.com or s3.amazonaws.com/bucket/). Use `amazon_container === "bucket"` instead.
    Note that both URL forms are usually (always?) valid, so make sure the rule accounts for both.
    For example, be careful when doing something like: `://[^/]+\/+images\/+` as it won't work for the second form.

- Use the script's wrapper functions over builtin functions:

  - For example, `array_indexof` or `string_indexof` instead of `foo.indexOf()`, `base64_decode` instead of `atob`, `JSON_parse` instead of `JSON.parse`, etc.
    This is because some websites (or adblock) override these functions with broken implementations.
    IMU will use its own implementation of these functions if the browser's version fails a few sanity checks.
    - Search for `var JSON_parse` in the userscript to find a list of them.

- The script has a lot of helper functions that may be useful (you can find a list of them in `variables_list` in [tools/gen_rules_js.js](https://github.com/qsniyg/maxurl/blob/master/tools/gen_rules_js.js)). They're currently undocumented, but here is a list of commonly used ones:

  - `get_queries`: Returns the queries as an object:
    - `get_queries("https://example.com/?a=5&b=10")` -> `{a: 5, b: 10}`

  - `remove_queries`: Removes the specified queries:
    - `remove_queries("https://example.com/?a=5&b=10&c=20", ["b, c"])` -> `"https://example.com/?a=5"`
    - `remove_queries("https://example.com/?a=5&b=10&c=20", "b")` -> `"https://example.com/?a=5&c=20"`

  - `keep_queries`: Removes every query except for the specified queries:
    - `keep_queries("https://example.com/?a=5&b=10&c=20", ["b", c"])` -> `"https://example.com/?b=10&c=20"`
    - `keep_queries("https://example.com/?a=5&b=10&c=20", "b")` -> `"https://example.com/?b=10"`
    - `keep_queries("https://example.com/?a=5&b=10&c=20", ["b", "c"], {overwrite: {"c": 1, "d": 2}})` -> `"https://example.com/?b=10&c=1&d=2"`
    - `keep_queries("https://example.com/?a=5&b=10", ["b", "c"], {required: ["c"]})` -> `"https://example.com/?a=5&b=10"`

  - `add_queries`: Adds or overwrites queries:
    - `add_queries("https://example.com/?a=5&b=10", {b: 20, c: 30})` -> `"https://example.com/?a=5&b=20&c=30"`

  - `decodeuri_ifneeded`: Runs `decodeURIComponent` only if a url looks encoded:
    - `decodeuri_ifneeded("https%3A%2F%2Fexample.com%2F")` -> `"https://example.com/"`
    - `decodeuri_ifneeded("https%253A%252F%252Fexample.com%252F")` -> `"https://example.com/"` (it supports decoding more than one time)
    - `decodeuri_ifneeded("https://example.com/?a=5%20")` -> `"https://example.com/?a=5%20"` (unchanged because `https://` is not encoded)
    - Use this function if you want to return a URL from a query (e.g. `https://example.com/thumb.php?img=https%3A%2F%2Fexample.com%2Ftest.png`)

- Add test cases

  - The general format is:

    ```
    // https://img1.example.com/thumbs/image.jpg -- smaller image (-- denotes a comment)
    //   https://img1.example.com/medium/image.jpg -- a larger image of the one above available on the website that this rule also works for
    //   https://img1.example.com/images/image.jpg -- largest image returned by this rule from any of the above (/medium/ or /thumbs/)
    ```

  - The "format" is quite loose though, don't worry too much about getting it right.
  - Please avoid adding NSFW test cases if possible.

- Regex style

  - Folder identifiers (`/`) should be referred to as `/+` (unless the web server distinguishes between one or more slashes)
  - Account for query strings or hash strings possibly including a /. The way I usually do it is to add `(?:[?#].*)?$` at the end
  - Try to keep the rule as tight as possible (within reason). For example:

    ```
    // https://www.example.com/images/image_500.jpg
    //   https://www.example.com/images/image.jpg
    return src.replace(/(\/images\/+[^/?#]+)_[0-9]+(\.[^/.]+(?:[?#].*)?)$/, "$1$2"); // good
    return src.replace(/_[0-9]+(\.[^/.]+(?:[?#].*)?)$/, "$1$2"); // bad
    ```

  - While not a strict rule, I don't use `\d` or `\w` as I find that specifying exactly which characters are allowed allows it to be easier
    to understand and modify. Your choice though :)

- Ensure that no modern JS (ES2015+) is used, at least without a fallback that should work on all browsers.

  - The only exception to this that comes to mind is requiring `BigInt` for certain calculations. However, note that the `n` suffix is not used, and it is surrounded by a try/catch block. This is to ensure the rest of the script will work, even if that one particular section doesn't.
    - Note that implementing a `BigInt` fallback for older browsers isn't out of scope, just low priority.

- You'll probably see that a lot of the rules don't follow many of the guidelines above. More recent rules tend to follow the guidelines better, but older
  rules haven't been updated, and are often either too specific or too generic as a result. I try to update them as I see them, but since there are literally thousands
  of rules, and each update often breaks something (meaning at least a few edits are required to update a single rule), I haven't been able to update the
  majority of the script yet. The wonders of organically written software!

As mentioned earlier, these are just guidelines, and you don't have to get it to be perfect to submit a rule :)

If you're testing the userscript, I'd recommend running `node tools/remcomments.js`. This will generate userscript_smaller.user.js and the files under the
build/ subdirectory. It will watch for changes to userscript.user.js in the background and automatically update the files as it changes.

Personally I install build/userscript_extr_cat.js as a userscript under Violentmonkey, with the "Track local file..." setting enabled. This allows the userscript
to be automatically updated within ~5 seconds after saving. Using the built file instead of userscript.user.js also has a few advantages:

 - Due to the size of the userscript, your editor might take a while to save the entire script, which can lead to a race condition where Violentmonkey will
   update an incomplete version of the userscript. While it's still possible when using a built version, it's significantly less likely.
 - Since the built version is the one that is published on Greasyfork/OUJS, in case there are any issues with it (such as if a shared variable is missing),
   this allows one to catch the issues much quicker.

### API calls/Pagelink rules

There are a few considerations for implementing rules that use API calls:

- Check for `options.do_request` and `options.cb`

  - There are a few parts of the script that call `bigimage` without `do_request`, which will cause API calls to crash if the check isn't present.
  - This isn't required if you use `website_query`, it will do this automatically for you.

- Return `{waiting: true}` at the end of the function if the result will be returned in a callback (`options.cb`).

  - Otherwise it will result in inconsistent behavior (such as multiple popups).

- Use `api_cache` wherever possible in order to reduce duplicate API calls.

  - Unless there's a good reason not to, prefer `api_cache.fetch` over `api_cache.has/get` + `api_cache.set`. This allows for much simpler logic, as well as avoiding races.
  - You (likely) don't need to interact with `api_cache` if using `api_query` or `website_query` (more on that later)
  - For cache duration, my general (though admittedly rather arbitrary) rule is an hour (`60*60`) for data that has been generated (or is otherwise expected to change within a day or so), and 6 hours (`6*60*60`) for permanent data, unless it's huge (e.g. html pages, scripts, or images).

- Use `api_query` over `api_cache.fetch` + `options.do_request` if possible.

  - This allows for much simpler code with less indentation. Note that even though `options.do_request` is called implicitly, you must still check for it.

- Use pagelink rules (`website_query`) over `api_query` or direct `options.do_request` if possible.

  - Pagelink rules are relatively new to the script, but allow for (usually) simpler code, access to the main media embedded in a page from only the link, and for code deduplication without relying on `common_functions`.

The idea behind pagelink rules is to support a public-facing URL, generally (always?) an HTML page, then return the main media (or an album).

To document it, I'll give an example with an imaginary social network:

```
if (domain_nowww === "mysocialnetwork.com") {
  // https://mysocialnetwork.com/post/123

  // Note that newsrc is defined at the beginning of bigimage, so no need to `var newsrc = ...`.
  newsrc = website_query({
    // Regex(es) for the supported URLs.
    // The capture group is the ID, which will internally be used for the cache key (mysocialnetwork.com:ID),
    //  as well as externally to query the page or API call.
    // This can also be an array (for multiple different patterns) if needed.
    website_regex: /^[a-z]+:\/\/[^/]+\/+post\/+([0-9]+)(?:[?#].*)?$/,

    // ${id} is replaced to the first capture. You can also use ${1}, ${2}, etc. for the first, second, ... capture group.
    // This will query the page, then run `process`.
    query_for_id: "https://mysocialnetwork.com/post/${id}",

    // Same arguments as for api_query, with "match" added, which is the regex match.
    process: function(done, resp, cache_key, match) {
      var img_match = resp.responseText.match(/<img id="main-image" src="([^"]+)" \/>/);
      if (!img_match) {
        // An error to make it easier to debug if it fails
        console_error(cache_key, "Unable to find image match for", resp);

        // First argument is the result (null) and the second is how long to store it (false means not to store it)
        return done(null, false);
      }

      var title = get_meta(resp.responseText, "og:description");

      // Remember that the inside of tags may also use html entities (such as &quot;).
      // While unlikely for image sources, it also never hurts to add this.
      var src = decode_entities(img_match[1]);

      return done({
        url: src,
        extra: {
          caption: title
        }
      }, 6*60*60);
    }
  });

  // newsrc will either be undefined (if the URL doesn't match, or if options.do_request doesn't exist), or {waiting: true}
  if (newsrc) return newsrc;
}

if (domain === "image.mysocialnetwork.com") {
  // https://image.mysocialnetwork.com/postimage/123.jpg?width=500

  newsrc = src.replace(/(\/postimage\/+[0-9]+\.[^/.?#]+)(?:[?#].*)?$/, "$1$2");
  // This allows us to fall through to the next portion of the rule if the URL hasn't been replaced.
  // Since bigimage is (generally) run more than once, this will result in a history,
  //  which allows it to fall back to this URL (or the previous) if the next one fails.
  if (newsrc !== src)
    return newsrc;

  match = src.match(/\/postimage\/+([0-9]+)\./);
  if (match) {
    return {
      url: "https://mysocialnetwork.com/post/" + match[1],

      // In case bigimage isn't run again for whatever reason, this will prevent it from wrongfully
      //  redirecting to/querying the page in the popup.
      is_pagelink: true
    };
  }
}
```

---

Thank you very much for whatever contribution you wish to give to this script, it's really appreciated!
