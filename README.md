## Image Max URL

Userscript (https://greasyfork.org/en/scripts/36662-image-max-url) and reddit bot ([/u/MaxImageBot](https://www.reddit.com/user/MaxImageBot/)) to redirect images to larger versions.

### For users

Install the userscript, and it will redirect to larger/original versions of images when you open them in a new tab.

### For developers

The userscript also functions as a node module:

    var maximage = require('./userscript.user.js');
    var bigimage = maximage(smallimage);
    if (bigimage !== smallimage) {
      // larger image is available
    }
