

Translations
============

Translations are done through standard .po (gettext) files, located in the [po subdirectory](https://github.com/qsniyg/maxurl/tree/master/po).
You can either translate it manually using a text editor, or use one of the numerous .po translation tools, such as [poedit](https://poedit.net/) or [poeditor](https://poeditor.com/) (online).

To test a modified translation, run: `node tools/update_from_po.js`. This will update userscript.user.js with the translations from the po subdirectory.

Note: when submitting a pull request for a translation, please do not include the modified userscript.user.js, as it will increase the risk of merge conflicts.

To add support for a new language:

 - Add the language code to the `supported_languages` array in userscript.user.js
 - Add the language as a new option under the `language` setting in userscript.user.js (search for `language: {`)
 - Add the English name for the language under the `supported_language_names` object in tools/gen_po.js
 - Run: `node tools/gen_po.js`

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

- You'll probably see that a lot of the rules don't follow the guidelines above. More recent rules tend to follow the guidelines better, but older
  rules haven't been updated, and are often either too specific or too generic as a result. I try to update them as I see them, but since there are literally thousands
  of rules, and each update often breaks something (meaning at least a few edits are required to update a single rule), I haven't been able to update the
  majority of the script yet. The wonders of organically written software! :)

Thank you very much for whatever contribution you wish to give to this script, it's really appreciated!
As mentioned earlier, these are just guidelines, and you don't have to get it to be perfect to submit a rule :)
