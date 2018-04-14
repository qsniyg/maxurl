## Image Max URL

Website (https://qsniyg.github.io/maxurl/), userscript (https://greasyfork.org/en/scripts/36662-image-max-url) and reddit bot ([/u/MaxImageBot](https://www.reddit.com/user/MaxImageBot/)) to redirect images to larger/original versions.

### For users

Either use the website or install the userscript, which redirects to larger/original versions of images when you open them in a new tab.

### For developers

The userscript also functions as a node module:

    var maximage = require('./userscript.user.js');
    var bigimage = maximage(smallimage);
    if (bigimage !== smallimage) {
      // larger image is available
    }
