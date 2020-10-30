#!/bin/bash

cd "`dirname "$0"`"

strip_whitespace() {
	sed -i -e 's/[ \t]*$//g' -e 's/^ *$//g' "$1"
}

# 3.1.2 has issues with our generated coub dash streams
wget http://cdn.dashjs.org/v3.1.1/dash.all.debug.js -O dash.all.debug.orig.js
cat dash.all.debug.orig.js dash_shim.js > dash.all.debug.js
dos2unix dash.all.debug.js
sed -i -e '/\/\/# sourceMappingURL=/d' dash.all.debug.js
strip_whitespace dash.all.debug.js

wget https://raw.githubusercontent.com/escolarea-labs/slowaes/f53404fb0aba47fcd336ae32623033bffa1dab41/js/aes.js -O aes.orig.js
cp aes.orig.js aes.patched.js
# patch is adapted from https://raw.githubusercontent.com/kyprizel/testcookie-nginx-module/eb9f7d65f50f054a0e7525cf6ad225ca076d1173/util/aes.patch
patch -p0 aes.patched.js < aes1.patch
cat aes.patched.js aes_shim.js > testcookie_slowaes.js
dos2unix testcookie_slowaes.js
strip_whitespace testcookie_slowaes.js
unix2dos testcookie_slowaes.js

wget https://github.com/video-dev/hls.js/releases/download/v0.14.13/hls.js -O hls.orig.js
# 1/2: don't use window.XMLHttpRequest, in order to allow overriding it
# 3: avoids some warnings in devtools
sed -e 's/xhr_loader_window\.XMLHttpRequest/XMLHttpRequest/g' -e 's/window\.XMLHttpRequest/XMLHttpRequest/g' -e '/\/\/# sourceMappingURL=hls.js.map/d' hls.orig.js > hls.patched.js
cat hls.patched.js hls_shim.js > hls.js
strip_whitespace hls.js

wget https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/aes.js -O cryptojs_aes.orig.js
cat cryptojs_aes.orig.js cryptojs_aes_shim.js > cryptojs_aes.js

wget https://ajax.googleapis.com/ajax/libs/shaka-player/3.0.5/shaka-player.compiled.debug.js -O shaka.debug.orig.js
cat shaka.debug.orig.js shaka_shim.js > shaka.debug.js
sed -i \
    -e 's/window\.XMLHttpRequest/XMLHttpRequest/g' \
	-e 's/goog\.global\.XMLHttpRequest/XMLHttpRequest/g' \
	-e 's/\(HttpFetchPlugin.isSupported=function..{\)/\1return false;/g' \
	-e '/\/\/# sourceMappingURL=/d' shaka.debug.js

CLEANUP=1
if [ $CLEANUP -eq 1 ]; then
	rm dash.all.debug.orig.js aes.orig.js aes.patched.js hls.patched.js hls.orig.js cryptojs_aes.orig.js shaka.debug.orig.js
fi
