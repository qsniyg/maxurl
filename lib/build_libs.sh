#!/bin/bash

cd "`dirname "$0"`"

strip_whitespace() {
	sed -i -e 's/[ \t]*$//g' -e 's/^ *$//g' "$1"
}

wget https://raw.githubusercontent.com/Dash-Industry-Forum/dash.js/v3.0.3/dist/dash.all.debug.js -O dash.all.debug.orig.js
cat dash.all.debug.orig.js dash_shim.js > dash.all.debug.js
dos2unix dash.all.debug.js
strip_whitespace dash.all.debug.js

wget https://raw.githubusercontent.com/escolarea-labs/slowaes/f53404fb0aba47fcd336ae32623033bffa1dab41/js/aes.js -O aes.orig.js
cp aes.orig.js aes.patched.js
# patch is adapted from https://raw.githubusercontent.com/kyprizel/testcookie-nginx-module/eb9f7d65f50f054a0e7525cf6ad225ca076d1173/util/aes.patch
patch -p0 aes.patched.js < aes1.patch
cat aes.patched.js aes_shim.js > testcookie_slowaes.js
dos2unix testcookie_slowaes.js
strip_whitespace testcookie_slowaes.js
unix2dos testcookie_slowaes.js

wget https://github.com/video-dev/hls.js/releases/download/v0.13.2/hls.js -O hls.orig.js
# avoids some warnings in devtools
sed '/\/\/# sourceMappingURL=hls.js.map/d' hls.orig.js > hls.patched.js
cat hls.patched.js hls_shim.js > hls.js
strip_whitespace hls.js

CLEANUP=1
if [ $CLEANUP -eq 1 ]; then
	rm dash.all.debug.orig.js aes.orig.js aes.patched.js hls.patched.js hls.orig.js
fi