#!/bin/bash

cd "`dirname "$0"`"

strip_whitespace() {
	sed -i -e 's/[ \t]*$//g' -e 's/^ *$//g' "$1"
}

# 3.1.2 has issues with our generated coub dash streams
wget http://cdn.dashjs.org/v3.1.1/dash.all.debug.js -O dash.all.debug.js
echo "" >> dash.all.debug.js
echo "var lib_export = dashjs;" >> dash.all.debug.js
cat generic_shim.js >> dash.all.debug.js
dos2unix dash.all.debug.js
sed -i -e '/\/\/# sourceMappingURL=/d' dash.all.debug.js
strip_whitespace dash.all.debug.js

wget https://raw.githubusercontent.com/escolarea-labs/slowaes/f53404fb0aba47fcd336ae32623033bffa1dab41/js/aes.js -O aes.orig.js
cp aes.orig.js aes.patched.js
# patch is adapted from https://raw.githubusercontent.com/kyprizel/testcookie-nginx-module/eb9f7d65f50f054a0e7525cf6ad225ca076d1173/util/aes.patch
patch -p0 aes.patched.js < aes1.patch
cat aes.patched.js > testcookie_slowaes.js
echo "" >> testcookie_slowaes.js
echo "var lib_export = slowAES;" >> testcookie_slowaes.js
cat generic_shim.js >> testcookie_slowaes.js
dos2unix testcookie_slowaes.js
strip_whitespace testcookie_slowaes.js
unix2dos testcookie_slowaes.js

wget https://github.com/video-dev/hls.js/releases/download/v0.14.13/hls.js -O hls.js
# 1/2: don't use window.XMLHttpRequest, in order to allow overriding it
# 3: avoids some warnings in devtools
sed -i \
	-e 's/xhr_loader_window\.XMLHttpRequest/XMLHttpRequest/g' \
	-e 's/window\.XMLHttpRequest/XMLHttpRequest/g' \
	-e '/\/\/# sourceMappingURL=hls.js.map/d' hls.js
echo "" >> hls.js
echo "var lib_export = this;" >> hls.js
strip_whitespace hls.js

wget https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/aes.js -O cryptojs_aes.js
echo "" >> cryptojs_aes.js
echo "var lib_export = CryptoJS;" >> cryptojs_aes.js
cat generic_shim.js >> cryptojs_aes.js

wget https://unpkg.com/mux.js@5.7.0/dist/mux.js -O mux.orig.js
echo 'var muxjs=null;' > mux.lib.js
cat mux.orig.js >> mux.lib.js
# don't store in window
#sed -i 's/g\.muxjs *=/muxjs =/' mux.lib.js
sed -i 's/^(function(f){if(typeof exports/(function(f){muxjs = f();return;if(typeof exports/' mux.lib.js

wget https://ajax.googleapis.com/ajax/libs/shaka-player/3.0.6/shaka-player.compiled.debug.js -O shaka.debug.orig.js
# move exportTo outside the anonymous function scope
echo 'var _fakeGlobal={};var exportTo={};' > shaka_global.js
sed -i 's/var exportTo={};//g' shaka.debug.orig.js
cat mux.lib.js shaka_global.js shaka.debug.orig.js shaka_shim.js > shaka.debug.js
# XHR is same as above, to allow overriding
# the other window.* changes fixes it failing under the firefox addon
# disable fetch in order to force XHR
# remove sourcemapping to avoid warnings under devtools
sed -i \
    -e 's/window\.XMLHttpRequest/XMLHttpRequest/g' \
	-e 's/window\.decodeURIComponent/decodeURIComponent/g' \
	-e 's/window\.parseInt/parseInt/g' \
	-e 's/window\.muxjs/muxjs/g' \
	-e 's/innerGlobal\.shaka/_fakeGlobal.shaka/g' \
	-e 's/goog\.global\.XMLHttpRequest/XMLHttpRequest/g' \
	-e 's/\(HttpFetchPlugin.isSupported=function..{\)/\1return false;/g' \
	-e '/\/\/# sourceMappingURL=/d' shaka.debug.js

# untested
wget https://unpkg.com/@ffmpeg/ffmpeg@0.9.2/dist/ffmpeg.min.js -O ffmpeg.min.orig.js
# window.* and self->_fakeGlobal are for preventing leaking
# remove sourcemapping to avoid warnings under devtools
sed -i \
	-e 's/window.FFMPEG_CORE_WORKER_SCRIPT/FFMPEG_CORE_WORKER_SCRIPT/g' \
	-e 's/window\.createFFmpegCore/createFFmpegCore/g' \
	-e 's/(self,(function/(_fakeGlobal,(function/' \
	-e '/\/\/# sourceMappingURL=/d' ffmpeg.min.orig.js
wget https://unpkg.com/@ffmpeg/core@0.8.5/dist/ffmpeg-core.js -O ffmpeg-core.orig.js
# since ffmpeg-core is being prepended, this is necessary in order to have requests work properly
# note that the unpkg url is used instead of integrating it in the repo. this is for cache reasons, as all other scripts using ffmpeg.js will use the same url
sed -i 's/{return [a-z]*\.locateFile\?[a-z]*\.locateFile(a,[^}]*}var/{return "https:\/\/unpkg.com\/@ffmpeg\/core@0.8.5\/dist\/" + a}var/' ffmpeg-core.orig.js
echo "var FFMPEG_CORE_WORKER_SCRIPT;var _fakeGlobal={window:window};" > ffmpeg.js
cat ffmpeg-core.orig.js ffmpeg.min.orig.js >> ffmpeg.js
echo "" >> ffmpeg.js
echo "var lib_export = _fakeGlobal.FFmpeg;" >> ffmpeg.js
cat generic_shim.js >> stream_parser.js

# untested
wget https://unpkg.com/mpd-parser@0.15.0/dist/mpd-parser.js -O mpd-parser.orig.js
sed -i 's/}(this, (function (exports/}(_fakeGlobal, (function (exports/' mpd-parser.orig.js
wget https://unpkg.com/m3u8-parser@4.5.0/dist/m3u8-parser.js -O m3u8-parser.orig.js
sed -i 's/}(this, (function (exports/}(_fakeGlobal, (function (exports/' m3u8-parser.orig.js
echo "var _fakeGlobal={window: window};" > stream_parser.js
cat mpd-parser.orig.js m3u8-parser.orig.js >> stream_parser.js
echo "" >> stream_parser.js
echo "var lib_export = { dash: _fakeGlobal.mpdParser, hls: _fakeGlobal.m3u8Parser };" >> stream_parser.js
cat generic_shim.js >> stream_parser.js

CLEANUP=1
if [ $CLEANUP -eq 1 ]; then
	rm \
		aes.orig.js aes.patched.js \
		shaka.debug.orig.js shaka_global.js \
		mux.orig.js mux.lib.js \
		ffmpeg.min.orig.js ffmpeg-core.orig.js \
		mpd-parser.orig.js m3u8-parser.orig.js
fi
