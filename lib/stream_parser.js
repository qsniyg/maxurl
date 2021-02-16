var _fakeGlobal={window: window};
/*! @name mpd-parser @version 0.15.0 @license Apache-2.0 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('global/window'), require('xmldom')) :
  typeof define === 'function' && define.amd ? define(['exports', 'global/window', 'xmldom'], factory) :
  (global = global || self, factory(global.mpdParser = {}, global.window, global.window));
}(_fakeGlobal, (function (exports, window, xmldom) { 'use strict';

  window = window && Object.prototype.hasOwnProperty.call(window, 'default') ? window['default'] : window;

  var version = "0.15.0";

  var isObject = function isObject(obj) {
    return !!obj && typeof obj === 'object';
  };

  var merge = function merge() {
    for (var _len = arguments.length, objects = new Array(_len), _key = 0; _key < _len; _key++) {
      objects[_key] = arguments[_key];
    }

    return objects.reduce(function (result, source) {
      if (typeof source !== 'object') {
        return result;
      }

      Object.keys(source).forEach(function (key) {
        if (Array.isArray(result[key]) && Array.isArray(source[key])) {
          result[key] = result[key].concat(source[key]);
        } else if (isObject(result[key]) && isObject(source[key])) {
          result[key] = merge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      });
      return result;
    }, {});
  };
  var values = function values(o) {
    return Object.keys(o).map(function (k) {
      return o[k];
    });
  };

  var range = function range(start, end) {
    var result = [];

    for (var i = start; i < end; i++) {
      result.push(i);
    }

    return result;
  };
  var flatten = function flatten(lists) {
    return lists.reduce(function (x, y) {
      return x.concat(y);
    }, []);
  };
  var from = function from(list) {
    if (!list.length) {
      return [];
    }

    var result = [];

    for (var i = 0; i < list.length; i++) {
      result.push(list[i]);
    }

    return result;
  };
  var findIndexes = function findIndexes(l, key) {
    return l.reduce(function (a, e, i) {
      if (e[key]) {
        a.push(i);
      }

      return a;
    }, []);
  };

  var errors = {
    INVALID_NUMBER_OF_PERIOD: 'INVALID_NUMBER_OF_PERIOD',
    DASH_EMPTY_MANIFEST: 'DASH_EMPTY_MANIFEST',
    DASH_INVALID_XML: 'DASH_INVALID_XML',
    NO_BASE_URL: 'NO_BASE_URL',
    MISSING_SEGMENT_INFORMATION: 'MISSING_SEGMENT_INFORMATION',
    SEGMENT_TIME_UNSPECIFIED: 'SEGMENT_TIME_UNSPECIFIED',
    UNSUPPORTED_UTC_TIMING_SCHEME: 'UNSUPPORTED_UTC_TIMING_SCHEME'
  };

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var urlToolkit = createCommonjsModule(function (module, exports) {
  // see https://tools.ietf.org/html/rfc1808

  (function (root) {
    var URL_REGEX = /^((?:[a-zA-Z0-9+\-.]+:)?)(\/\/[^\/?#]*)?((?:[^\/?#]*\/)*[^;?#]*)?(;[^?#]*)?(\?[^#]*)?(#.*)?$/;
    var FIRST_SEGMENT_REGEX = /^([^\/?#]*)(.*)$/;
    var SLASH_DOT_REGEX = /(?:\/|^)\.(?=\/)/g;
    var SLASH_DOT_DOT_REGEX = /(?:\/|^)\.\.\/(?!\.\.\/)[^\/]*(?=\/)/g;

    var URLToolkit = {
      // If opts.alwaysNormalize is true then the path will always be normalized even when it starts with / or //
      // E.g
      // With opts.alwaysNormalize = false (default, spec compliant)
      // http://a.com/b/cd + /e/f/../g => http://a.com/e/f/../g
      // With opts.alwaysNormalize = true (not spec compliant)
      // http://a.com/b/cd + /e/f/../g => http://a.com/e/g
      buildAbsoluteURL: function (baseURL, relativeURL, opts) {
        opts = opts || {};
        // remove any remaining space and CRLF
        baseURL = baseURL.trim();
        relativeURL = relativeURL.trim();
        if (!relativeURL) {
          // 2a) If the embedded URL is entirely empty, it inherits the
          // entire base URL (i.e., is set equal to the base URL)
          // and we are done.
          if (!opts.alwaysNormalize) {
            return baseURL;
          }
          var basePartsForNormalise = URLToolkit.parseURL(baseURL);
          if (!basePartsForNormalise) {
            throw new Error('Error trying to parse base URL.');
          }
          basePartsForNormalise.path = URLToolkit.normalizePath(
            basePartsForNormalise.path
          );
          return URLToolkit.buildURLFromParts(basePartsForNormalise);
        }
        var relativeParts = URLToolkit.parseURL(relativeURL);
        if (!relativeParts) {
          throw new Error('Error trying to parse relative URL.');
        }
        if (relativeParts.scheme) {
          // 2b) If the embedded URL starts with a scheme name, it is
          // interpreted as an absolute URL and we are done.
          if (!opts.alwaysNormalize) {
            return relativeURL;
          }
          relativeParts.path = URLToolkit.normalizePath(relativeParts.path);
          return URLToolkit.buildURLFromParts(relativeParts);
        }
        var baseParts = URLToolkit.parseURL(baseURL);
        if (!baseParts) {
          throw new Error('Error trying to parse base URL.');
        }
        if (!baseParts.netLoc && baseParts.path && baseParts.path[0] !== '/') {
          // If netLoc missing and path doesn't start with '/', assume everthing before the first '/' is the netLoc
          // This causes 'example.com/a' to be handled as '//example.com/a' instead of '/example.com/a'
          var pathParts = FIRST_SEGMENT_REGEX.exec(baseParts.path);
          baseParts.netLoc = pathParts[1];
          baseParts.path = pathParts[2];
        }
        if (baseParts.netLoc && !baseParts.path) {
          baseParts.path = '/';
        }
        var builtParts = {
          // 2c) Otherwise, the embedded URL inherits the scheme of
          // the base URL.
          scheme: baseParts.scheme,
          netLoc: relativeParts.netLoc,
          path: null,
          params: relativeParts.params,
          query: relativeParts.query,
          fragment: relativeParts.fragment,
        };
        if (!relativeParts.netLoc) {
          // 3) If the embedded URL's <net_loc> is non-empty, we skip to
          // Step 7.  Otherwise, the embedded URL inherits the <net_loc>
          // (if any) of the base URL.
          builtParts.netLoc = baseParts.netLoc;
          // 4) If the embedded URL path is preceded by a slash "/", the
          // path is not relative and we skip to Step 7.
          if (relativeParts.path[0] !== '/') {
            if (!relativeParts.path) {
              // 5) If the embedded URL path is empty (and not preceded by a
              // slash), then the embedded URL inherits the base URL path
              builtParts.path = baseParts.path;
              // 5a) if the embedded URL's <params> is non-empty, we skip to
              // step 7; otherwise, it inherits the <params> of the base
              // URL (if any) and
              if (!relativeParts.params) {
                builtParts.params = baseParts.params;
                // 5b) if the embedded URL's <query> is non-empty, we skip to
                // step 7; otherwise, it inherits the <query> of the base
                // URL (if any) and we skip to step 7.
                if (!relativeParts.query) {
                  builtParts.query = baseParts.query;
                }
              }
            } else {
              // 6) The last segment of the base URL's path (anything
              // following the rightmost slash "/", or the entire path if no
              // slash is present) is removed and the embedded URL's path is
              // appended in its place.
              var baseURLPath = baseParts.path;
              var newPath =
                baseURLPath.substring(0, baseURLPath.lastIndexOf('/') + 1) +
                relativeParts.path;
              builtParts.path = URLToolkit.normalizePath(newPath);
            }
          }
        }
        if (builtParts.path === null) {
          builtParts.path = opts.alwaysNormalize
            ? URLToolkit.normalizePath(relativeParts.path)
            : relativeParts.path;
        }
        return URLToolkit.buildURLFromParts(builtParts);
      },
      parseURL: function (url) {
        var parts = URL_REGEX.exec(url);
        if (!parts) {
          return null;
        }
        return {
          scheme: parts[1] || '',
          netLoc: parts[2] || '',
          path: parts[3] || '',
          params: parts[4] || '',
          query: parts[5] || '',
          fragment: parts[6] || '',
        };
      },
      normalizePath: function (path) {
        // The following operations are
        // then applied, in order, to the new path:
        // 6a) All occurrences of "./", where "." is a complete path
        // segment, are removed.
        // 6b) If the path ends with "." as a complete path segment,
        // that "." is removed.
        path = path.split('').reverse().join('').replace(SLASH_DOT_REGEX, '');
        // 6c) All occurrences of "<segment>/../", where <segment> is a
        // complete path segment not equal to "..", are removed.
        // Removal of these path segments is performed iteratively,
        // removing the leftmost matching pattern on each iteration,
        // until no matching pattern remains.
        // 6d) If the path ends with "<segment>/..", where <segment> is a
        // complete path segment not equal to "..", that
        // "<segment>/.." is removed.
        while (
          path.length !== (path = path.replace(SLASH_DOT_DOT_REGEX, '')).length
        ) {}
        return path.split('').reverse().join('');
      },
      buildURLFromParts: function (parts) {
        return (
          parts.scheme +
          parts.netLoc +
          parts.path +
          parts.params +
          parts.query +
          parts.fragment
        );
      },
    };

    module.exports = URLToolkit;
  })();
  });

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var URLToolkit__default = /*#__PURE__*/_interopDefaultLegacy(urlToolkit);
  var window__default = /*#__PURE__*/_interopDefaultLegacy(window);

  var resolveUrl = function resolveUrl(baseUrl, relativeUrl) {
    // return early if we don't need to resolve
    if (/^[a-z]+:/i.test(relativeUrl)) {
      return relativeUrl;
    } // if the base URL is relative then combine with the current location


    if (!/\/\//i.test(baseUrl)) {
      baseUrl = URLToolkit__default['default'].buildAbsoluteURL(window__default['default'].location && "" || '', baseUrl);
    }

    return URLToolkit__default['default'].buildAbsoluteURL(baseUrl, relativeUrl);
  };

  var resolveUrl_1 = resolveUrl;

  /**
   * @typedef {Object} SingleUri
   * @property {string} uri - relative location of segment
   * @property {string} resolvedUri - resolved location of segment
   * @property {Object} byterange - Object containing information on how to make byte range
   *   requests following byte-range-spec per RFC2616.
   * @property {String} byterange.length - length of range request
   * @property {String} byterange.offset - byte offset of range request
   *
   * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.35.1
   */

  /**
   * Converts a URLType node (5.3.9.2.3 Table 13) to a segment object
   * that conforms to how m3u8-parser is structured
   *
   * @see https://github.com/videojs/m3u8-parser
   *
   * @param {string} baseUrl - baseUrl provided by <BaseUrl> nodes
   * @param {string} source - source url for segment
   * @param {string} range - optional range used for range calls,
   *   follows  RFC 2616, Clause 14.35.1
   * @return {SingleUri} full segment information transformed into a format similar
   *   to m3u8-parser
   */

  var urlTypeToSegment = function urlTypeToSegment(_ref) {
    var _ref$baseUrl = _ref.baseUrl,
        baseUrl = _ref$baseUrl === void 0 ? '' : _ref$baseUrl,
        _ref$source = _ref.source,
        source = _ref$source === void 0 ? '' : _ref$source,
        _ref$range = _ref.range,
        range = _ref$range === void 0 ? '' : _ref$range,
        _ref$indexRange = _ref.indexRange,
        indexRange = _ref$indexRange === void 0 ? '' : _ref$indexRange;
    var segment = {
      uri: source,
      resolvedUri: resolveUrl_1(baseUrl || '', source)
    };

    if (range || indexRange) {
      var rangeStr = range ? range : indexRange;
      var ranges = rangeStr.split('-');
      var startRange = parseInt(ranges[0], 10);
      var endRange = parseInt(ranges[1], 10); // byterange should be inclusive according to
      // RFC 2616, Clause 14.35.1

      segment.byterange = {
        length: endRange - startRange + 1,
        offset: startRange
      };
    }

    return segment;
  };
  var byteRangeToString = function byteRangeToString(byterange) {
    // `endRange` is one less than `offset + length` because the HTTP range
    // header uses inclusive ranges
    var endRange = byterange.offset + byterange.length - 1;
    return byterange.offset + "-" + endRange;
  };

  /**
   * Functions for calculating the range of available segments in static and dynamic
   * manifests.
   */

  var segmentRange = {
    /**
     * Returns the entire range of available segments for a static MPD
     *
     * @param {Object} attributes
     *        Inheritied MPD attributes
     * @return {{ start: number, end: number }}
     *         The start and end numbers for available segments
     */
    static: function _static(attributes) {
      var duration = attributes.duration,
          _attributes$timescale = attributes.timescale,
          timescale = _attributes$timescale === void 0 ? 1 : _attributes$timescale,
          sourceDuration = attributes.sourceDuration;
      return {
        start: 0,
        end: Math.ceil(sourceDuration / (duration / timescale))
      };
    },

    /**
     * Returns the current live window range of available segments for a dynamic MPD
     *
     * @param {Object} attributes
     *        Inheritied MPD attributes
     * @return {{ start: number, end: number }}
     *         The start and end numbers for available segments
     */
    dynamic: function dynamic(attributes) {
      var NOW = attributes.NOW,
          clientOffset = attributes.clientOffset,
          availabilityStartTime = attributes.availabilityStartTime,
          _attributes$timescale2 = attributes.timescale,
          timescale = _attributes$timescale2 === void 0 ? 1 : _attributes$timescale2,
          duration = attributes.duration,
          _attributes$start = attributes.start,
          start = _attributes$start === void 0 ? 0 : _attributes$start,
          _attributes$minimumUp = attributes.minimumUpdatePeriod,
          minimumUpdatePeriod = _attributes$minimumUp === void 0 ? 0 : _attributes$minimumUp,
          _attributes$timeShift = attributes.timeShiftBufferDepth,
          timeShiftBufferDepth = _attributes$timeShift === void 0 ? Infinity : _attributes$timeShift;
      var now = (NOW + clientOffset) / 1000;
      var periodStartWC = availabilityStartTime + start;
      var periodEndWC = now + minimumUpdatePeriod;
      var periodDuration = periodEndWC - periodStartWC;
      var segmentCount = Math.ceil(periodDuration * timescale / duration);
      var availableStart = Math.floor((now - periodStartWC - timeShiftBufferDepth) * timescale / duration);
      var availableEnd = Math.floor((now - periodStartWC) * timescale / duration);
      return {
        start: Math.max(0, availableStart),
        end: Math.min(segmentCount, availableEnd)
      };
    }
  };
  /**
   * Maps a range of numbers to objects with information needed to build the corresponding
   * segment list
   *
   * @name toSegmentsCallback
   * @function
   * @param {number} number
   *        Number of the segment
   * @param {number} index
   *        Index of the number in the range list
   * @return {{ number: Number, duration: Number, timeline: Number, time: Number }}
   *         Object with segment timing and duration info
   */

  /**
   * Returns a callback for Array.prototype.map for mapping a range of numbers to
   * information needed to build the segment list.
   *
   * @param {Object} attributes
   *        Inherited MPD attributes
   * @return {toSegmentsCallback}
   *         Callback map function
   */

  var toSegments = function toSegments(attributes) {
    return function (number, index) {
      var duration = attributes.duration,
          _attributes$timescale3 = attributes.timescale,
          timescale = _attributes$timescale3 === void 0 ? 1 : _attributes$timescale3,
          periodIndex = attributes.periodIndex,
          _attributes$startNumb = attributes.startNumber,
          startNumber = _attributes$startNumb === void 0 ? 1 : _attributes$startNumb;
      return {
        number: startNumber + number,
        duration: duration / timescale,
        timeline: periodIndex,
        time: index * duration
      };
    };
  };
  /**
   * Returns a list of objects containing segment timing and duration info used for
   * building the list of segments. This uses the @duration attribute specified
   * in the MPD manifest to derive the range of segments.
   *
   * @param {Object} attributes
   *        Inherited MPD attributes
   * @return {{number: number, duration: number, time: number, timeline: number}[]}
   *         List of Objects with segment timing and duration info
   */

  var parseByDuration = function parseByDuration(attributes) {
    var _attributes$type = attributes.type,
        type = _attributes$type === void 0 ? 'static' : _attributes$type,
        duration = attributes.duration,
        _attributes$timescale4 = attributes.timescale,
        timescale = _attributes$timescale4 === void 0 ? 1 : _attributes$timescale4,
        sourceDuration = attributes.sourceDuration;

    var _segmentRange$type = segmentRange[type](attributes),
        start = _segmentRange$type.start,
        end = _segmentRange$type.end;

    var segments = range(start, end).map(toSegments(attributes));

    if (type === 'static') {
      var index = segments.length - 1; // final segment may be less than full segment duration

      segments[index].duration = sourceDuration - duration / timescale * index;
    }

    return segments;
  };

  /**
   * Translates SegmentBase into a set of segments.
   * (DASH SPEC Section 5.3.9.3.2) contains a set of <SegmentURL> nodes.  Each
   * node should be translated into segment.
   *
   * @param {Object} attributes
   *   Object containing all inherited attributes from parent elements with attribute
   *   names as keys
   * @return {Object.<Array>} list of segments
   */

  var segmentsFromBase = function segmentsFromBase(attributes) {
    var baseUrl = attributes.baseUrl,
        _attributes$initializ = attributes.initialization,
        initialization = _attributes$initializ === void 0 ? {} : _attributes$initializ,
        sourceDuration = attributes.sourceDuration,
        _attributes$indexRang = attributes.indexRange,
        indexRange = _attributes$indexRang === void 0 ? '' : _attributes$indexRang,
        duration = attributes.duration; // base url is required for SegmentBase to work, per spec (Section 5.3.9.2.1)

    if (!baseUrl) {
      throw new Error(errors.NO_BASE_URL);
    }

    var initSegment = urlTypeToSegment({
      baseUrl: baseUrl,
      source: initialization.sourceURL,
      range: initialization.range
    });
    var segment = urlTypeToSegment({
      baseUrl: baseUrl,
      source: baseUrl,
      indexRange: indexRange
    });
    segment.map = initSegment; // If there is a duration, use it, otherwise use the given duration of the source
    // (since SegmentBase is only for one total segment)

    if (duration) {
      var segmentTimeInfo = parseByDuration(attributes);

      if (segmentTimeInfo.length) {
        segment.duration = segmentTimeInfo[0].duration;
        segment.timeline = segmentTimeInfo[0].timeline;
      }
    } else if (sourceDuration) {
      segment.duration = sourceDuration;
      segment.timeline = 0;
    } // This is used for mediaSequence


    segment.number = 0;
    return [segment];
  };
  /**
   * Given a playlist, a sidx box, and a baseUrl, update the segment list of the playlist
   * according to the sidx information given.
   *
   * playlist.sidx has metadadata about the sidx where-as the sidx param
   * is the parsed sidx box itself.
   *
   * @param {Object} playlist the playlist to update the sidx information for
   * @param {Object} sidx the parsed sidx box
   * @return {Object} the playlist object with the updated sidx information
   */

  var addSegmentsToPlaylist = function addSegmentsToPlaylist(playlist, sidx, baseUrl) {
    // Retain init segment information
    var initSegment = playlist.sidx.map ? playlist.sidx.map : null; // Retain source duration from initial master manifest parsing

    var sourceDuration = playlist.sidx.duration; // Retain source timeline

    var timeline = playlist.timeline || 0;
    var sidxByteRange = playlist.sidx.byterange;
    var sidxEnd = sidxByteRange.offset + sidxByteRange.length; // Retain timescale of the parsed sidx

    var timescale = sidx.timescale; // referenceType 1 refers to other sidx boxes

    var mediaReferences = sidx.references.filter(function (r) {
      return r.referenceType !== 1;
    });
    var segments = []; // firstOffset is the offset from the end of the sidx box

    var startIndex = sidxEnd + sidx.firstOffset;

    for (var i = 0; i < mediaReferences.length; i++) {
      var reference = sidx.references[i]; // size of the referenced (sub)segment

      var size = reference.referencedSize; // duration of the referenced (sub)segment, in  the  timescale
      // this will be converted to seconds when generating segments

      var duration = reference.subsegmentDuration; // should be an inclusive range

      var endIndex = startIndex + size - 1;
      var indexRange = startIndex + "-" + endIndex;
      var attributes = {
        baseUrl: baseUrl,
        timescale: timescale,
        timeline: timeline,
        // this is used in parseByDuration
        periodIndex: timeline,
        duration: duration,
        sourceDuration: sourceDuration,
        indexRange: indexRange
      };
      var segment = segmentsFromBase(attributes)[0];

      if (initSegment) {
        segment.map = initSegment;
      }

      segments.push(segment);
      startIndex += size;
    }

    playlist.segments = segments;
    return playlist;
  };

  var mergeDiscontiguousPlaylists = function mergeDiscontiguousPlaylists(playlists) {
    var mergedPlaylists = values(playlists.reduce(function (acc, playlist) {
      // assuming playlist IDs are the same across periods
      // TODO: handle multiperiod where representation sets are not the same
      // across periods
      var name = playlist.attributes.id + (playlist.attributes.lang || ''); // Periods after first

      if (acc[name]) {
        var _acc$name$segments;

        // first segment of subsequent periods signal a discontinuity
        if (playlist.segments[0]) {
          playlist.segments[0].discontinuity = true;
        }

        (_acc$name$segments = acc[name].segments).push.apply(_acc$name$segments, playlist.segments); // bubble up contentProtection, this assumes all DRM content
        // has the same contentProtection


        if (playlist.attributes.contentProtection) {
          acc[name].attributes.contentProtection = playlist.attributes.contentProtection;
        }
      } else {
        // first Period
        acc[name] = playlist;
      }

      return acc;
    }, {}));
    return mergedPlaylists.map(function (playlist) {
      playlist.discontinuityStarts = findIndexes(playlist.segments, 'discontinuity');
      return playlist;
    });
  };

  var addSegmentInfoFromSidx = function addSegmentInfoFromSidx(playlists, sidxMapping) {
    if (sidxMapping === void 0) {
      sidxMapping = {};
    }

    if (!Object.keys(sidxMapping).length) {
      return playlists;
    }

    for (var i in playlists) {
      var playlist = playlists[i];

      if (!playlist.sidx) {
        continue;
      }

      var sidxKey = playlist.sidx.uri + '-' + byteRangeToString(playlist.sidx.byterange);
      var sidxMatch = sidxMapping[sidxKey] && sidxMapping[sidxKey].sidx;

      if (playlist.sidx && sidxMatch) {
        addSegmentsToPlaylist(playlist, sidxMatch, playlist.sidx.resolvedUri);
      }
    }

    return playlists;
  };

  var formatAudioPlaylist = function formatAudioPlaylist(_ref) {
    var _attributes;

    var attributes = _ref.attributes,
        segments = _ref.segments,
        sidx = _ref.sidx;
    var playlist = {
      attributes: (_attributes = {
        NAME: attributes.id,
        BANDWIDTH: attributes.bandwidth,
        CODECS: attributes.codecs
      }, _attributes['PROGRAM-ID'] = 1, _attributes),
      uri: '',
      endList: (attributes.type || 'static') === 'static',
      timeline: attributes.periodIndex,
      resolvedUri: '',
      targetDuration: attributes.duration,
      segments: segments,
      mediaSequence: segments.length ? segments[0].number : 1
    };

    if (attributes.contentProtection) {
      playlist.contentProtection = attributes.contentProtection;
    }

    if (sidx) {
      playlist.sidx = sidx;
    }

    return playlist;
  };
  var formatVttPlaylist = function formatVttPlaylist(_ref2) {
    var _m3u8Attributes;

    var attributes = _ref2.attributes,
        segments = _ref2.segments;

    if (typeof segments === 'undefined') {
      // vtt tracks may use single file in BaseURL
      segments = [{
        uri: attributes.baseUrl,
        timeline: attributes.periodIndex,
        resolvedUri: attributes.baseUrl || '',
        duration: attributes.sourceDuration,
        number: 0
      }]; // targetDuration should be the same duration as the only segment

      attributes.duration = attributes.sourceDuration;
    }

    var m3u8Attributes = (_m3u8Attributes = {
      NAME: attributes.id,
      BANDWIDTH: attributes.bandwidth
    }, _m3u8Attributes['PROGRAM-ID'] = 1, _m3u8Attributes);

    if (attributes.codecs) {
      m3u8Attributes.CODECS = attributes.codecs;
    }

    return {
      attributes: m3u8Attributes,
      uri: '',
      endList: (attributes.type || 'static') === 'static',
      timeline: attributes.periodIndex,
      resolvedUri: attributes.baseUrl || '',
      targetDuration: attributes.duration,
      segments: segments,
      mediaSequence: segments.length ? segments[0].number : 1
    };
  };
  var organizeAudioPlaylists = function organizeAudioPlaylists(playlists, sidxMapping) {
    if (sidxMapping === void 0) {
      sidxMapping = {};
    }

    var mainPlaylist;
    var formattedPlaylists = playlists.reduce(function (a, playlist) {
      var role = playlist.attributes.role && playlist.attributes.role.value || '';
      var language = playlist.attributes.lang || '';
      var label = 'main';

      if (language) {
        var roleLabel = role ? " (" + role + ")" : '';
        label = "" + playlist.attributes.lang + roleLabel;
      } // skip if we already have the highest quality audio for a language


      if (a[label] && a[label].playlists[0].attributes.BANDWIDTH > playlist.attributes.bandwidth) {
        return a;
      }

      a[label] = {
        language: language,
        autoselect: true,
        default: role === 'main',
        playlists: addSegmentInfoFromSidx([formatAudioPlaylist(playlist)], sidxMapping),
        uri: ''
      };

      if (typeof mainPlaylist === 'undefined' && role === 'main') {
        mainPlaylist = playlist;
        mainPlaylist.default = true;
      }

      return a;
    }, {}); // if no playlists have role "main", mark the first as main

    if (!mainPlaylist) {
      var firstLabel = Object.keys(formattedPlaylists)[0];
      formattedPlaylists[firstLabel].default = true;
    }

    return formattedPlaylists;
  };
  var organizeVttPlaylists = function organizeVttPlaylists(playlists, sidxMapping) {
    if (sidxMapping === void 0) {
      sidxMapping = {};
    }

    return playlists.reduce(function (a, playlist) {
      var label = playlist.attributes.lang || 'text'; // skip if we already have subtitles

      if (a[label]) {
        return a;
      }

      a[label] = {
        language: label,
        default: false,
        autoselect: false,
        playlists: addSegmentInfoFromSidx([formatVttPlaylist(playlist)], sidxMapping),
        uri: ''
      };
      return a;
    }, {});
  };
  var formatVideoPlaylist = function formatVideoPlaylist(_ref3) {
    var _attributes2;

    var attributes = _ref3.attributes,
        segments = _ref3.segments,
        sidx = _ref3.sidx;
    var playlist = {
      attributes: (_attributes2 = {
        NAME: attributes.id,
        AUDIO: 'audio',
        SUBTITLES: 'subs',
        RESOLUTION: {
          width: attributes.width,
          height: attributes.height
        },
        CODECS: attributes.codecs,
        BANDWIDTH: attributes.bandwidth
      }, _attributes2['PROGRAM-ID'] = 1, _attributes2),
      uri: '',
      endList: (attributes.type || 'static') === 'static',
      timeline: attributes.periodIndex,
      resolvedUri: '',
      targetDuration: attributes.duration,
      segments: segments,
      mediaSequence: segments.length ? segments[0].number : 1
    };

    if (attributes.contentProtection) {
      playlist.contentProtection = attributes.contentProtection;
    }

    if (sidx) {
      playlist.sidx = sidx;
    }

    return playlist;
  };
  var toM3u8 = function toM3u8(dashPlaylists, locations, sidxMapping) {
    var _mediaGroups;

    if (sidxMapping === void 0) {
      sidxMapping = {};
    }

    if (!dashPlaylists.length) {
      return {};
    } // grab all master attributes


    var _dashPlaylists$0$attr = dashPlaylists[0].attributes,
        duration = _dashPlaylists$0$attr.sourceDuration,
        _dashPlaylists$0$attr2 = _dashPlaylists$0$attr.type,
        type = _dashPlaylists$0$attr2 === void 0 ? 'static' : _dashPlaylists$0$attr2,
        suggestedPresentationDelay = _dashPlaylists$0$attr.suggestedPresentationDelay,
        minimumUpdatePeriod = _dashPlaylists$0$attr.minimumUpdatePeriod;

    var videoOnly = function videoOnly(_ref4) {
      var attributes = _ref4.attributes;
      return attributes.mimeType === 'video/mp4' || attributes.mimeType === 'video/webm' || attributes.contentType === 'video';
    };

    var audioOnly = function audioOnly(_ref5) {
      var attributes = _ref5.attributes;
      return attributes.mimeType === 'audio/mp4' || attributes.mimeType === 'audio/webm' || attributes.contentType === 'audio';
    };

    var vttOnly = function vttOnly(_ref6) {
      var attributes = _ref6.attributes;
      return attributes.mimeType === 'text/vtt' || attributes.contentType === 'text';
    };

    var videoPlaylists = mergeDiscontiguousPlaylists(dashPlaylists.filter(videoOnly)).map(formatVideoPlaylist);
    var audioPlaylists = mergeDiscontiguousPlaylists(dashPlaylists.filter(audioOnly));
    var vttPlaylists = dashPlaylists.filter(vttOnly);
    var master = {
      allowCache: true,
      discontinuityStarts: [],
      segments: [],
      endList: true,
      mediaGroups: (_mediaGroups = {
        AUDIO: {},
        VIDEO: {}
      }, _mediaGroups['CLOSED-CAPTIONS'] = {}, _mediaGroups.SUBTITLES = {}, _mediaGroups),
      uri: '',
      duration: duration,
      playlists: addSegmentInfoFromSidx(videoPlaylists, sidxMapping)
    };

    if (minimumUpdatePeriod >= 0) {
      master.minimumUpdatePeriod = minimumUpdatePeriod * 1000;
    }

    if (locations) {
      master.locations = locations;
    }

    if (type === 'dynamic') {
      master.suggestedPresentationDelay = suggestedPresentationDelay;
    }

    if (audioPlaylists.length) {
      master.mediaGroups.AUDIO.audio = organizeAudioPlaylists(audioPlaylists, sidxMapping);
    }

    if (vttPlaylists.length) {
      master.mediaGroups.SUBTITLES.subs = organizeVttPlaylists(vttPlaylists, sidxMapping);
    }

    return master;
  };

  /**
   * Calculates the R (repetition) value for a live stream (for the final segment
   * in a manifest where the r value is negative 1)
   *
   * @param {Object} attributes
   *        Object containing all inherited attributes from parent elements with attribute
   *        names as keys
   * @param {number} time
   *        current time (typically the total time up until the final segment)
   * @param {number} duration
   *        duration property for the given <S />
   *
   * @return {number}
   *        R value to reach the end of the given period
   */
  var getLiveRValue = function getLiveRValue(attributes, time, duration) {
    var NOW = attributes.NOW,
        clientOffset = attributes.clientOffset,
        availabilityStartTime = attributes.availabilityStartTime,
        _attributes$timescale = attributes.timescale,
        timescale = _attributes$timescale === void 0 ? 1 : _attributes$timescale,
        _attributes$start = attributes.start,
        start = _attributes$start === void 0 ? 0 : _attributes$start,
        _attributes$minimumUp = attributes.minimumUpdatePeriod,
        minimumUpdatePeriod = _attributes$minimumUp === void 0 ? 0 : _attributes$minimumUp;
    var now = (NOW + clientOffset) / 1000;
    var periodStartWC = availabilityStartTime + start;
    var periodEndWC = now + minimumUpdatePeriod;
    var periodDuration = periodEndWC - periodStartWC;
    return Math.ceil((periodDuration * timescale - time) / duration);
  };
  /**
   * Uses information provided by SegmentTemplate.SegmentTimeline to determine segment
   * timing and duration
   *
   * @param {Object} attributes
   *        Object containing all inherited attributes from parent elements with attribute
   *        names as keys
   * @param {Object[]} segmentTimeline
   *        List of objects representing the attributes of each S element contained within
   *
   * @return {{number: number, duration: number, time: number, timeline: number}[]}
   *         List of Objects with segment timing and duration info
   */


  var parseByTimeline = function parseByTimeline(attributes, segmentTimeline) {
    var _attributes$type = attributes.type,
        type = _attributes$type === void 0 ? 'static' : _attributes$type,
        _attributes$minimumUp2 = attributes.minimumUpdatePeriod,
        minimumUpdatePeriod = _attributes$minimumUp2 === void 0 ? 0 : _attributes$minimumUp2,
        _attributes$media = attributes.media,
        media = _attributes$media === void 0 ? '' : _attributes$media,
        sourceDuration = attributes.sourceDuration,
        _attributes$timescale2 = attributes.timescale,
        timescale = _attributes$timescale2 === void 0 ? 1 : _attributes$timescale2,
        _attributes$startNumb = attributes.startNumber,
        startNumber = _attributes$startNumb === void 0 ? 1 : _attributes$startNumb,
        timeline = attributes.periodIndex;
    var segments = [];
    var time = -1;

    for (var sIndex = 0; sIndex < segmentTimeline.length; sIndex++) {
      var S = segmentTimeline[sIndex];
      var duration = S.d;
      var repeat = S.r || 0;
      var segmentTime = S.t || 0;

      if (time < 0) {
        // first segment
        time = segmentTime;
      }

      if (segmentTime && segmentTime > time) {
        // discontinuity
        // TODO: How to handle this type of discontinuity
        // timeline++ here would treat it like HLS discontuity and content would
        // get appended without gap
        // E.G.
        //  <S t="0" d="1" />
        //  <S d="1" />
        //  <S d="1" />
        //  <S t="5" d="1" />
        // would have $Time$ values of [0, 1, 2, 5]
        // should this be appened at time positions [0, 1, 2, 3],(#EXT-X-DISCONTINUITY)
        // or [0, 1, 2, gap, gap, 5]? (#EXT-X-GAP)
        // does the value of sourceDuration consider this when calculating arbitrary
        // negative @r repeat value?
        // E.G. Same elements as above with this added at the end
        //  <S d="1" r="-1" />
        //  with a sourceDuration of 10
        // Would the 2 gaps be included in the time duration calculations resulting in
        // 8 segments with $Time$ values of [0, 1, 2, 5, 6, 7, 8, 9] or 10 segments
        // with $Time$ values of [0, 1, 2, 5, 6, 7, 8, 9, 10, 11] ?
        time = segmentTime;
      }

      var count = void 0;

      if (repeat < 0) {
        var nextS = sIndex + 1;

        if (nextS === segmentTimeline.length) {
          // last segment
          if (type === 'dynamic' && minimumUpdatePeriod > 0 && media.indexOf('$Number$') > 0) {
            count = getLiveRValue(attributes, time, duration);
          } else {
            // TODO: This may be incorrect depending on conclusion of TODO above
            count = (sourceDuration * timescale - time) / duration;
          }
        } else {
          count = (segmentTimeline[nextS].t - time) / duration;
        }
      } else {
        count = repeat + 1;
      }

      var end = startNumber + segments.length + count;
      var number = startNumber + segments.length;

      while (number < end) {
        segments.push({
          number: number,
          duration: duration / timescale,
          time: time,
          timeline: timeline
        });
        time += duration;
        number++;
      }
    }

    return segments;
  };

  var identifierPattern = /\$([A-z]*)(?:(%0)([0-9]+)d)?\$/g;
  /**
   * Replaces template identifiers with corresponding values. To be used as the callback
   * for String.prototype.replace
   *
   * @name replaceCallback
   * @function
   * @param {string} match
   *        Entire match of identifier
   * @param {string} identifier
   *        Name of matched identifier
   * @param {string} format
   *        Format tag string. Its presence indicates that padding is expected
   * @param {string} width
   *        Desired length of the replaced value. Values less than this width shall be left
   *        zero padded
   * @return {string}
   *         Replacement for the matched identifier
   */

  /**
   * Returns a function to be used as a callback for String.prototype.replace to replace
   * template identifiers
   *
   * @param {Obect} values
   *        Object containing values that shall be used to replace known identifiers
   * @param {number} values.RepresentationID
   *        Value of the Representation@id attribute
   * @param {number} values.Number
   *        Number of the corresponding segment
   * @param {number} values.Bandwidth
   *        Value of the Representation@bandwidth attribute.
   * @param {number} values.Time
   *        Timestamp value of the corresponding segment
   * @return {replaceCallback}
   *         Callback to be used with String.prototype.replace to replace identifiers
   */

  var identifierReplacement = function identifierReplacement(values) {
    return function (match, identifier, format, width) {
      if (match === '$$') {
        // escape sequence
        return '$';
      }

      if (typeof values[identifier] === 'undefined') {
        return match;
      }

      var value = '' + values[identifier];

      if (identifier === 'RepresentationID') {
        // Format tag shall not be present with RepresentationID
        return value;
      }

      if (!format) {
        width = 1;
      } else {
        width = parseInt(width, 10);
      }

      if (value.length >= width) {
        return value;
      }

      return "" + new Array(width - value.length + 1).join('0') + value;
    };
  };
  /**
   * Constructs a segment url from a template string
   *
   * @param {string} url
   *        Template string to construct url from
   * @param {Obect} values
   *        Object containing values that shall be used to replace known identifiers
   * @param {number} values.RepresentationID
   *        Value of the Representation@id attribute
   * @param {number} values.Number
   *        Number of the corresponding segment
   * @param {number} values.Bandwidth
   *        Value of the Representation@bandwidth attribute.
   * @param {number} values.Time
   *        Timestamp value of the corresponding segment
   * @return {string}
   *         Segment url with identifiers replaced
   */

  var constructTemplateUrl = function constructTemplateUrl(url, values) {
    return url.replace(identifierPattern, identifierReplacement(values));
  };
  /**
   * Generates a list of objects containing timing and duration information about each
   * segment needed to generate segment uris and the complete segment object
   *
   * @param {Object} attributes
   *        Object containing all inherited attributes from parent elements with attribute
   *        names as keys
   * @param {Object[]|undefined} segmentTimeline
   *        List of objects representing the attributes of each S element contained within
   *        the SegmentTimeline element
   * @return {{number: number, duration: number, time: number, timeline: number}[]}
   *         List of Objects with segment timing and duration info
   */

  var parseTemplateInfo = function parseTemplateInfo(attributes, segmentTimeline) {
    if (!attributes.duration && !segmentTimeline) {
      // if neither @duration or SegmentTimeline are present, then there shall be exactly
      // one media segment
      return [{
        number: attributes.startNumber || 1,
        duration: attributes.sourceDuration,
        time: 0,
        timeline: attributes.periodIndex
      }];
    }

    if (attributes.duration) {
      return parseByDuration(attributes);
    }

    return parseByTimeline(attributes, segmentTimeline);
  };
  /**
   * Generates a list of segments using information provided by the SegmentTemplate element
   *
   * @param {Object} attributes
   *        Object containing all inherited attributes from parent elements with attribute
   *        names as keys
   * @param {Object[]|undefined} segmentTimeline
   *        List of objects representing the attributes of each S element contained within
   *        the SegmentTimeline element
   * @return {Object[]}
   *         List of segment objects
   */

  var segmentsFromTemplate = function segmentsFromTemplate(attributes, segmentTimeline) {
    var templateValues = {
      RepresentationID: attributes.id,
      Bandwidth: attributes.bandwidth || 0
    };
    var _attributes$initializ = attributes.initialization,
        initialization = _attributes$initializ === void 0 ? {
      sourceURL: '',
      range: ''
    } : _attributes$initializ;
    var mapSegment = urlTypeToSegment({
      baseUrl: attributes.baseUrl,
      source: constructTemplateUrl(initialization.sourceURL, templateValues),
      range: initialization.range
    });
    var segments = parseTemplateInfo(attributes, segmentTimeline);
    return segments.map(function (segment) {
      templateValues.Number = segment.number;
      templateValues.Time = segment.time;
      var uri = constructTemplateUrl(attributes.media || '', templateValues);
      return {
        uri: uri,
        timeline: segment.timeline,
        duration: segment.duration,
        resolvedUri: resolveUrl_1(attributes.baseUrl || '', uri),
        map: mapSegment,
        number: segment.number
      };
    });
  };

  /**
   * Converts a <SegmentUrl> (of type URLType from the DASH spec 5.3.9.2 Table 14)
   * to an object that matches the output of a segment in videojs/mpd-parser
   *
   * @param {Object} attributes
   *   Object containing all inherited attributes from parent elements with attribute
   *   names as keys
   * @param {Object} segmentUrl
   *   <SegmentURL> node to translate into a segment object
   * @return {Object} translated segment object
   */

  var SegmentURLToSegmentObject = function SegmentURLToSegmentObject(attributes, segmentUrl) {
    var baseUrl = attributes.baseUrl,
        _attributes$initializ = attributes.initialization,
        initialization = _attributes$initializ === void 0 ? {} : _attributes$initializ;
    var initSegment = urlTypeToSegment({
      baseUrl: baseUrl,
      source: initialization.sourceURL,
      range: initialization.range
    });
    var segment = urlTypeToSegment({
      baseUrl: baseUrl,
      source: segmentUrl.media,
      range: segmentUrl.mediaRange
    });
    segment.map = initSegment;
    return segment;
  };
  /**
   * Generates a list of segments using information provided by the SegmentList element
   * SegmentList (DASH SPEC Section 5.3.9.3.2) contains a set of <SegmentURL> nodes.  Each
   * node should be translated into segment.
   *
   * @param {Object} attributes
   *   Object containing all inherited attributes from parent elements with attribute
   *   names as keys
   * @param {Object[]|undefined} segmentTimeline
   *        List of objects representing the attributes of each S element contained within
   *        the SegmentTimeline element
   * @return {Object.<Array>} list of segments
   */


  var segmentsFromList = function segmentsFromList(attributes, segmentTimeline) {
    var duration = attributes.duration,
        _attributes$segmentUr = attributes.segmentUrls,
        segmentUrls = _attributes$segmentUr === void 0 ? [] : _attributes$segmentUr; // Per spec (5.3.9.2.1) no way to determine segment duration OR
    // if both SegmentTimeline and @duration are defined, it is outside of spec.

    if (!duration && !segmentTimeline || duration && segmentTimeline) {
      throw new Error(errors.SEGMENT_TIME_UNSPECIFIED);
    }

    var segmentUrlMap = segmentUrls.map(function (segmentUrlObject) {
      return SegmentURLToSegmentObject(attributes, segmentUrlObject);
    });
    var segmentTimeInfo;

    if (duration) {
      segmentTimeInfo = parseByDuration(attributes);
    }

    if (segmentTimeline) {
      segmentTimeInfo = parseByTimeline(attributes, segmentTimeline);
    }

    var segments = segmentTimeInfo.map(function (segmentTime, index) {
      if (segmentUrlMap[index]) {
        var segment = segmentUrlMap[index];
        segment.timeline = segmentTime.timeline;
        segment.duration = segmentTime.duration;
        segment.number = segmentTime.number;
        return segment;
      } // Since we're mapping we should get rid of any blank segments (in case
      // the given SegmentTimeline is handling for more elements than we have
      // SegmentURLs for).

    }).filter(function (segment) {
      return segment;
    });
    return segments;
  };

  var generateSegments = function generateSegments(_ref) {
    var attributes = _ref.attributes,
        segmentInfo = _ref.segmentInfo;
    var segmentAttributes;
    var segmentsFn;

    if (segmentInfo.template) {
      segmentsFn = segmentsFromTemplate;
      segmentAttributes = merge(attributes, segmentInfo.template);
    } else if (segmentInfo.base) {
      segmentsFn = segmentsFromBase;
      segmentAttributes = merge(attributes, segmentInfo.base);
    } else if (segmentInfo.list) {
      segmentsFn = segmentsFromList;
      segmentAttributes = merge(attributes, segmentInfo.list);
    }

    var segmentsInfo = {
      attributes: attributes
    };

    if (!segmentsFn) {
      return segmentsInfo;
    }

    var segments = segmentsFn(segmentAttributes, segmentInfo.timeline); // The @duration attribute will be used to determin the playlist's targetDuration which
    // must be in seconds. Since we've generated the segment list, we no longer need
    // @duration to be in @timescale units, so we can convert it here.

    if (segmentAttributes.duration) {
      var _segmentAttributes = segmentAttributes,
          duration = _segmentAttributes.duration,
          _segmentAttributes$ti = _segmentAttributes.timescale,
          timescale = _segmentAttributes$ti === void 0 ? 1 : _segmentAttributes$ti;
      segmentAttributes.duration = duration / timescale;
    } else if (segments.length) {
      // if there is no @duration attribute, use the largest segment duration as
      // as target duration
      segmentAttributes.duration = segments.reduce(function (max, segment) {
        return Math.max(max, Math.ceil(segment.duration));
      }, 0);
    } else {
      segmentAttributes.duration = 0;
    }

    segmentsInfo.attributes = segmentAttributes;
    segmentsInfo.segments = segments; // This is a sidx box without actual segment information

    if (segmentInfo.base && segmentAttributes.indexRange) {
      segmentsInfo.sidx = segments[0];
      segmentsInfo.segments = [];
    }

    return segmentsInfo;
  };
  var toPlaylists = function toPlaylists(representations) {
    return representations.map(generateSegments);
  };

  var findChildren = function findChildren(element, name) {
    return from(element.childNodes).filter(function (_ref) {
      var tagName = _ref.tagName;
      return tagName === name;
    });
  };
  var getContent = function getContent(element) {
    return element.textContent.trim();
  };

  var parseDuration = function parseDuration(str) {
    var SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
    var SECONDS_IN_MONTH = 30 * 24 * 60 * 60;
    var SECONDS_IN_DAY = 24 * 60 * 60;
    var SECONDS_IN_HOUR = 60 * 60;
    var SECONDS_IN_MIN = 60; // P10Y10M10DT10H10M10.1S

    var durationRegex = /P(?:(\d*)Y)?(?:(\d*)M)?(?:(\d*)D)?(?:T(?:(\d*)H)?(?:(\d*)M)?(?:([\d.]*)S)?)?/;
    var match = durationRegex.exec(str);

    if (!match) {
      return 0;
    }

    var _match$slice = match.slice(1),
        year = _match$slice[0],
        month = _match$slice[1],
        day = _match$slice[2],
        hour = _match$slice[3],
        minute = _match$slice[4],
        second = _match$slice[5];

    return parseFloat(year || 0) * SECONDS_IN_YEAR + parseFloat(month || 0) * SECONDS_IN_MONTH + parseFloat(day || 0) * SECONDS_IN_DAY + parseFloat(hour || 0) * SECONDS_IN_HOUR + parseFloat(minute || 0) * SECONDS_IN_MIN + parseFloat(second || 0);
  };
  var parseDate = function parseDate(str) {
    // Date format without timezone according to ISO 8601
    // YYY-MM-DDThh:mm:ss.ssssss
    var dateRegex = /^\d+-\d+-\d+T\d+:\d+:\d+(\.\d+)?$/; // If the date string does not specifiy a timezone, we must specifiy UTC. This is
    // expressed by ending with 'Z'

    if (dateRegex.test(str)) {
      str += 'Z';
    }

    return Date.parse(str);
  };

  var parsers = {
    /**
     * Specifies the duration of the entire Media Presentation. Format is a duration string
     * as specified in ISO 8601
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The duration in seconds
     */
    mediaPresentationDuration: function mediaPresentationDuration(value) {
      return parseDuration(value);
    },

    /**
     * Specifies the Segment availability start time for all Segments referred to in this
     * MPD. For a dynamic manifest, it specifies the anchor for the earliest availability
     * time. Format is a date string as specified in ISO 8601
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The date as seconds from unix epoch
     */
    availabilityStartTime: function availabilityStartTime(value) {
      return parseDate(value) / 1000;
    },

    /**
     * Specifies the smallest period between potential changes to the MPD. Format is a
     * duration string as specified in ISO 8601
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The duration in seconds
     */
    minimumUpdatePeriod: function minimumUpdatePeriod(value) {
      return parseDuration(value);
    },

    /**
     * Specifies the suggested presentation delay. Format is a
     * duration string as specified in ISO 8601
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The duration in seconds
     */
    suggestedPresentationDelay: function suggestedPresentationDelay(value) {
      return parseDuration(value);
    },

    /**
     * specifices the type of mpd. Can be either "static" or "dynamic"
     *
     * @param {string} value
     *        value of attribute as a string
     *
     * @return {string}
     *         The type as a string
     */
    type: function type(value) {
      return value;
    },

    /**
     * Specifies the duration of the smallest time shifting buffer for any Representation
     * in the MPD. Format is a duration string as specified in ISO 8601
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The duration in seconds
     */
    timeShiftBufferDepth: function timeShiftBufferDepth(value) {
      return parseDuration(value);
    },

    /**
     * Specifies the PeriodStart time of the Period relative to the availabilityStarttime.
     * Format is a duration string as specified in ISO 8601
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The duration in seconds
     */
    start: function start(value) {
      return parseDuration(value);
    },

    /**
     * Specifies the width of the visual presentation
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed width
     */
    width: function width(value) {
      return parseInt(value, 10);
    },

    /**
     * Specifies the height of the visual presentation
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed height
     */
    height: function height(value) {
      return parseInt(value, 10);
    },

    /**
     * Specifies the bitrate of the representation
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed bandwidth
     */
    bandwidth: function bandwidth(value) {
      return parseInt(value, 10);
    },

    /**
     * Specifies the number of the first Media Segment in this Representation in the Period
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed number
     */
    startNumber: function startNumber(value) {
      return parseInt(value, 10);
    },

    /**
     * Specifies the timescale in units per seconds
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The aprsed timescale
     */
    timescale: function timescale(value) {
      return parseInt(value, 10);
    },

    /**
     * Specifies the constant approximate Segment duration
     * NOTE: The <Period> element also contains an @duration attribute. This duration
     *       specifies the duration of the Period. This attribute is currently not
     *       supported by the rest of the parser, however we still check for it to prevent
     *       errors.
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed duration
     */
    duration: function duration(value) {
      var parsedValue = parseInt(value, 10);

      if (isNaN(parsedValue)) {
        return parseDuration(value);
      }

      return parsedValue;
    },

    /**
     * Specifies the Segment duration, in units of the value of the @timescale.
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed duration
     */
    d: function d(value) {
      return parseInt(value, 10);
    },

    /**
     * Specifies the MPD start time, in @timescale units, the first Segment in the series
     * starts relative to the beginning of the Period
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed time
     */
    t: function t(value) {
      return parseInt(value, 10);
    },

    /**
     * Specifies the repeat count of the number of following contiguous Segments with the
     * same duration expressed by the value of @d
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {number}
     *         The parsed number
     */
    r: function r(value) {
      return parseInt(value, 10);
    },

    /**
     * Default parser for all other attributes. Acts as a no-op and just returns the value
     * as a string
     *
     * @param {string} value
     *        value of attribute as a string
     * @return {string}
     *         Unparsed value
     */
    DEFAULT: function DEFAULT(value) {
      return value;
    }
  };
  /**
   * Gets all the attributes and values of the provided node, parses attributes with known
   * types, and returns an object with attribute names mapped to values.
   *
   * @param {Node} el
   *        The node to parse attributes from
   * @return {Object}
   *         Object with all attributes of el parsed
   */

  var parseAttributes = function parseAttributes(el) {
    if (!(el && el.attributes)) {
      return {};
    }

    return from(el.attributes).reduce(function (a, e) {
      var parseFn = parsers[e.name] || parsers.DEFAULT;
      a[e.name] = parseFn(e.value);
      return a;
    }, {});
  };

  function _interopDefaultLegacy$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var window__default$1 = /*#__PURE__*/_interopDefaultLegacy$1(window);

  var atob = function atob(s) {
    return window__default$1['default'].atob ? window__default$1['default'].atob(s) : Buffer.from(s, 'base64').toString('binary');
  };

  function decodeB64ToUint8Array(b64Text) {
    var decodedString = atob(b64Text);
    var array = new Uint8Array(decodedString.length);

    for (var i = 0; i < decodedString.length; i++) {
      array[i] = decodedString.charCodeAt(i);
    }

    return array;
  }

  var decodeB64ToUint8Array_1 = decodeB64ToUint8Array;

  var keySystemsMap = {
    'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b': 'org.w3.clearkey',
    'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'com.widevine.alpha',
    'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'com.microsoft.playready',
    'urn:uuid:f239e769-efa3-4850-9c16-a903c6932efb': 'com.adobe.primetime'
  };
  /**
   * Builds a list of urls that is the product of the reference urls and BaseURL values
   *
   * @param {string[]} referenceUrls
   *        List of reference urls to resolve to
   * @param {Node[]} baseUrlElements
   *        List of BaseURL nodes from the mpd
   * @return {string[]}
   *         List of resolved urls
   */

  var buildBaseUrls = function buildBaseUrls(referenceUrls, baseUrlElements) {
    if (!baseUrlElements.length) {
      return referenceUrls;
    }

    return flatten(referenceUrls.map(function (reference) {
      return baseUrlElements.map(function (baseUrlElement) {
        return resolveUrl_1(reference, getContent(baseUrlElement));
      });
    }));
  };
  /**
   * Contains all Segment information for its containing AdaptationSet
   *
   * @typedef {Object} SegmentInformation
   * @property {Object|undefined} template
   *           Contains the attributes for the SegmentTemplate node
   * @property {Object[]|undefined} timeline
   *           Contains a list of atrributes for each S node within the SegmentTimeline node
   * @property {Object|undefined} list
   *           Contains the attributes for the SegmentList node
   * @property {Object|undefined} base
   *           Contains the attributes for the SegmentBase node
   */

  /**
   * Returns all available Segment information contained within the AdaptationSet node
   *
   * @param {Node} adaptationSet
   *        The AdaptationSet node to get Segment information from
   * @return {SegmentInformation}
   *         The Segment information contained within the provided AdaptationSet
   */

  var getSegmentInformation = function getSegmentInformation(adaptationSet) {
    var segmentTemplate = findChildren(adaptationSet, 'SegmentTemplate')[0];
    var segmentList = findChildren(adaptationSet, 'SegmentList')[0];
    var segmentUrls = segmentList && findChildren(segmentList, 'SegmentURL').map(function (s) {
      return merge({
        tag: 'SegmentURL'
      }, parseAttributes(s));
    });
    var segmentBase = findChildren(adaptationSet, 'SegmentBase')[0];
    var segmentTimelineParentNode = segmentList || segmentTemplate;
    var segmentTimeline = segmentTimelineParentNode && findChildren(segmentTimelineParentNode, 'SegmentTimeline')[0];
    var segmentInitializationParentNode = segmentList || segmentBase || segmentTemplate;
    var segmentInitialization = segmentInitializationParentNode && findChildren(segmentInitializationParentNode, 'Initialization')[0]; // SegmentTemplate is handled slightly differently, since it can have both
    // @initialization and an <Initialization> node.  @initialization can be templated,
    // while the node can have a url and range specified.  If the <SegmentTemplate> has
    // both @initialization and an <Initialization> subelement we opt to override with
    // the node, as this interaction is not defined in the spec.

    var template = segmentTemplate && parseAttributes(segmentTemplate);

    if (template && segmentInitialization) {
      template.initialization = segmentInitialization && parseAttributes(segmentInitialization);
    } else if (template && template.initialization) {
      // If it is @initialization we convert it to an object since this is the format that
      // later functions will rely on for the initialization segment.  This is only valid
      // for <SegmentTemplate>
      template.initialization = {
        sourceURL: template.initialization
      };
    }

    var segmentInfo = {
      template: template,
      timeline: segmentTimeline && findChildren(segmentTimeline, 'S').map(function (s) {
        return parseAttributes(s);
      }),
      list: segmentList && merge(parseAttributes(segmentList), {
        segmentUrls: segmentUrls,
        initialization: parseAttributes(segmentInitialization)
      }),
      base: segmentBase && merge(parseAttributes(segmentBase), {
        initialization: parseAttributes(segmentInitialization)
      })
    };
    Object.keys(segmentInfo).forEach(function (key) {
      if (!segmentInfo[key]) {
        delete segmentInfo[key];
      }
    });
    return segmentInfo;
  };
  /**
   * Contains Segment information and attributes needed to construct a Playlist object
   * from a Representation
   *
   * @typedef {Object} RepresentationInformation
   * @property {SegmentInformation} segmentInfo
   *           Segment information for this Representation
   * @property {Object} attributes
   *           Inherited attributes for this Representation
   */

  /**
   * Maps a Representation node to an object containing Segment information and attributes
   *
   * @name inheritBaseUrlsCallback
   * @function
   * @param {Node} representation
   *        Representation node from the mpd
   * @return {RepresentationInformation}
   *         Representation information needed to construct a Playlist object
   */

  /**
   * Returns a callback for Array.prototype.map for mapping Representation nodes to
   * Segment information and attributes using inherited BaseURL nodes.
   *
   * @param {Object} adaptationSetAttributes
   *        Contains attributes inherited by the AdaptationSet
   * @param {string[]} adaptationSetBaseUrls
   *        Contains list of resolved base urls inherited by the AdaptationSet
   * @param {SegmentInformation} adaptationSetSegmentInfo
   *        Contains Segment information for the AdaptationSet
   * @return {inheritBaseUrlsCallback}
   *         Callback map function
   */

  var inheritBaseUrls = function inheritBaseUrls(adaptationSetAttributes, adaptationSetBaseUrls, adaptationSetSegmentInfo) {
    return function (representation) {
      var repBaseUrlElements = findChildren(representation, 'BaseURL');
      var repBaseUrls = buildBaseUrls(adaptationSetBaseUrls, repBaseUrlElements);
      var attributes = merge(adaptationSetAttributes, parseAttributes(representation));
      var representationSegmentInfo = getSegmentInformation(representation);
      return repBaseUrls.map(function (baseUrl) {
        return {
          segmentInfo: merge(adaptationSetSegmentInfo, representationSegmentInfo),
          attributes: merge(attributes, {
            baseUrl: baseUrl
          })
        };
      });
    };
  };
  /**
   * Tranforms a series of content protection nodes to
   * an object containing pssh data by key system
   *
   * @param {Node[]} contentProtectionNodes
   *        Content protection nodes
   * @return {Object}
   *        Object containing pssh data by key system
   */

  var generateKeySystemInformation = function generateKeySystemInformation(contentProtectionNodes) {
    return contentProtectionNodes.reduce(function (acc, node) {
      var attributes = parseAttributes(node);
      var keySystem = keySystemsMap[attributes.schemeIdUri];

      if (keySystem) {
        acc[keySystem] = {
          attributes: attributes
        };
        var psshNode = findChildren(node, 'cenc:pssh')[0];

        if (psshNode) {
          var pssh = getContent(psshNode);
          var psshBuffer = pssh && decodeB64ToUint8Array_1(pssh);
          acc[keySystem].pssh = psshBuffer;
        }
      }

      return acc;
    }, {});
  };
  /**
   * Maps an AdaptationSet node to a list of Representation information objects
   *
   * @name toRepresentationsCallback
   * @function
   * @param {Node} adaptationSet
   *        AdaptationSet node from the mpd
   * @return {RepresentationInformation[]}
   *         List of objects containing Representaion information
   */

  /**
   * Returns a callback for Array.prototype.map for mapping AdaptationSet nodes to a list of
   * Representation information objects
   *
   * @param {Object} periodAttributes
   *        Contains attributes inherited by the Period
   * @param {string[]} periodBaseUrls
   *        Contains list of resolved base urls inherited by the Period
   * @param {string[]} periodSegmentInfo
   *        Contains Segment Information at the period level
   * @return {toRepresentationsCallback}
   *         Callback map function
   */


  var toRepresentations = function toRepresentations(periodAttributes, periodBaseUrls, periodSegmentInfo) {
    return function (adaptationSet) {
      var adaptationSetAttributes = parseAttributes(adaptationSet);
      var adaptationSetBaseUrls = buildBaseUrls(periodBaseUrls, findChildren(adaptationSet, 'BaseURL'));
      var role = findChildren(adaptationSet, 'Role')[0];
      var roleAttributes = {
        role: parseAttributes(role)
      };
      var attrs = merge(periodAttributes, adaptationSetAttributes, roleAttributes);
      var contentProtection = generateKeySystemInformation(findChildren(adaptationSet, 'ContentProtection'));

      if (Object.keys(contentProtection).length) {
        attrs = merge(attrs, {
          contentProtection: contentProtection
        });
      }

      var segmentInfo = getSegmentInformation(adaptationSet);
      var representations = findChildren(adaptationSet, 'Representation');
      var adaptationSetSegmentInfo = merge(periodSegmentInfo, segmentInfo);
      return flatten(representations.map(inheritBaseUrls(attrs, adaptationSetBaseUrls, adaptationSetSegmentInfo)));
    };
  };
  /**
   * Maps an Period node to a list of Representation inforamtion objects for all
   * AdaptationSet nodes contained within the Period
   *
   * @name toAdaptationSetsCallback
   * @function
   * @param {Node} period
   *        Period node from the mpd
   * @param {number} periodIndex
   *        Index of the Period within the mpd
   * @return {RepresentationInformation[]}
   *         List of objects containing Representaion information
   */

  /**
   * Returns a callback for Array.prototype.map for mapping Period nodes to a list of
   * Representation information objects
   *
   * @param {Object} mpdAttributes
   *        Contains attributes inherited by the mpd
   * @param {string[]} mpdBaseUrls
   *        Contains list of resolved base urls inherited by the mpd
   * @return {toAdaptationSetsCallback}
   *         Callback map function
   */

  var toAdaptationSets = function toAdaptationSets(mpdAttributes, mpdBaseUrls) {
    return function (period, index) {
      var periodBaseUrls = buildBaseUrls(mpdBaseUrls, findChildren(period, 'BaseURL'));
      var periodAtt = parseAttributes(period);
      var parsedPeriodId = parseInt(periodAtt.id, 10); // fallback to mapping index if Period@id is not a number

      var periodIndex = isNaN(parsedPeriodId) ? index : parsedPeriodId;
      var periodAttributes = merge(mpdAttributes, {
        periodIndex: periodIndex
      });
      var adaptationSets = findChildren(period, 'AdaptationSet');
      var periodSegmentInfo = getSegmentInformation(period);
      return flatten(adaptationSets.map(toRepresentations(periodAttributes, periodBaseUrls, periodSegmentInfo)));
    };
  };
  /**
   * Traverses the mpd xml tree to generate a list of Representation information objects
   * that have inherited attributes from parent nodes
   *
   * @param {Node} mpd
   *        The root node of the mpd
   * @param {Object} options
   *        Available options for inheritAttributes
   * @param {string} options.manifestUri
   *        The uri source of the mpd
   * @param {number} options.NOW
   *        Current time per DASH IOP.  Default is current time in ms since epoch
   * @param {number} options.clientOffset
   *        Client time difference from NOW (in milliseconds)
   * @return {RepresentationInformation[]}
   *         List of objects containing Representation information
   */

  var inheritAttributes = function inheritAttributes(mpd, options) {
    if (options === void 0) {
      options = {};
    }

    var _options = options,
        _options$manifestUri = _options.manifestUri,
        manifestUri = _options$manifestUri === void 0 ? '' : _options$manifestUri,
        _options$NOW = _options.NOW,
        NOW = _options$NOW === void 0 ? Date.now() : _options$NOW,
        _options$clientOffset = _options.clientOffset,
        clientOffset = _options$clientOffset === void 0 ? 0 : _options$clientOffset;
    var periods = findChildren(mpd, 'Period');

    if (!periods.length) {
      throw new Error(errors.INVALID_NUMBER_OF_PERIOD);
    }

    var locations = findChildren(mpd, 'Location');
    var mpdAttributes = parseAttributes(mpd);
    var mpdBaseUrls = buildBaseUrls([manifestUri], findChildren(mpd, 'BaseURL'));
    mpdAttributes.sourceDuration = mpdAttributes.mediaPresentationDuration || 0;
    mpdAttributes.NOW = NOW;
    mpdAttributes.clientOffset = clientOffset;

    if (locations.length) {
      mpdAttributes.locations = locations.map(getContent);
    }

    return {
      locations: mpdAttributes.locations,
      representationInfo: flatten(periods.map(toAdaptationSets(mpdAttributes, mpdBaseUrls)))
    };
  };

  var stringToMpdXml = function stringToMpdXml(manifestString) {
    if (manifestString === '') {
      throw new Error(errors.DASH_EMPTY_MANIFEST);
    }

    var parser = new xmldom.DOMParser();
    var xml;
    var mpd;

    try {
      xml = parser.parseFromString(manifestString, 'application/xml');
      mpd = xml && xml.documentElement.tagName === 'MPD' ? xml.documentElement : null;
    } catch (e) {// ie 11 throwsw on invalid xml
    }

    if (!mpd || mpd && mpd.getElementsByTagName('parsererror').length > 0) {
      throw new Error(errors.DASH_INVALID_XML);
    }

    return mpd;
  };

  /**
   * Parses the manifest for a UTCTiming node, returning the nodes attributes if found
   *
   * @param {string} mpd
   *        XML string of the MPD manifest
   * @return {Object|null}
   *         Attributes of UTCTiming node specified in the manifest. Null if none found
   */

  var parseUTCTimingScheme = function parseUTCTimingScheme(mpd) {
    var UTCTimingNode = findChildren(mpd, 'UTCTiming')[0];

    if (!UTCTimingNode) {
      return null;
    }

    var attributes = parseAttributes(UTCTimingNode);

    switch (attributes.schemeIdUri) {
      case 'urn:mpeg:dash:utc:http-head:2014':
      case 'urn:mpeg:dash:utc:http-head:2012':
        attributes.method = 'HEAD';
        break;

      case 'urn:mpeg:dash:utc:http-xsdate:2014':
      case 'urn:mpeg:dash:utc:http-iso:2014':
      case 'urn:mpeg:dash:utc:http-xsdate:2012':
      case 'urn:mpeg:dash:utc:http-iso:2012':
        attributes.method = 'GET';
        break;

      case 'urn:mpeg:dash:utc:direct:2014':
      case 'urn:mpeg:dash:utc:direct:2012':
        attributes.method = 'DIRECT';
        attributes.value = Date.parse(attributes.value);
        break;

      case 'urn:mpeg:dash:utc:http-ntp:2014':
      case 'urn:mpeg:dash:utc:ntp:2014':
      case 'urn:mpeg:dash:utc:sntp:2014':
      default:
        throw new Error(errors.UNSUPPORTED_UTC_TIMING_SCHEME);
    }

    return attributes;
  };

  var VERSION = version;

  var parse = function parse(manifestString, options) {
    if (options === void 0) {
      options = {};
    }

    var parsedManifestInfo = inheritAttributes(stringToMpdXml(manifestString), options);
    var playlists = toPlaylists(parsedManifestInfo.representationInfo);
    return toM3u8(playlists, parsedManifestInfo.locations, options.sidxMapping);
  };
  /**
   * Parses the manifest for a UTCTiming node, returning the nodes attributes if found
   *
   * @param {string} manifestString
   *        XML string of the MPD manifest
   * @return {Object|null}
   *         Attributes of UTCTiming node specified in the manifest. Null if none found
   */


  var parseUTCTiming = function parseUTCTiming(manifestString) {
    return parseUTCTimingScheme(stringToMpdXml(manifestString));
  };

  var addSidxSegmentsToPlaylist = addSegmentsToPlaylist;

  exports.VERSION = VERSION;
  exports.addSidxSegmentsToPlaylist = addSidxSegmentsToPlaylist;
  exports.inheritAttributes = inheritAttributes;
  exports.parse = parse;
  exports.parseUTCTiming = parseUTCTiming;
  exports.stringToMpdXml = stringToMpdXml;
  exports.toM3u8 = toM3u8;
  exports.toPlaylists = toPlaylists;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
/*! @name m3u8-parser @version 4.5.0 @license Apache-2.0 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('global/window')) :
  typeof define === 'function' && define.amd ? define(['exports', 'global/window'], factory) :
  (global = global || self, factory(global.m3u8Parser = {}, global.window));
}(_fakeGlobal, function (exports, window) { 'use strict';

  window = window && window.hasOwnProperty('default') ? window['default'] : window;

  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;
    subClass.__proto__ = superClass;
  }

  var inheritsLoose = _inheritsLoose;

  /*! @name @videojs/vhs-utils @version 2.2.1 @license MIT */

  /**
   * @file stream.js
   */

  /**
   * A lightweight readable stream implemention that handles event dispatching.
   *
   * @class Stream
   */
  var Stream = /*#__PURE__*/function () {
    function Stream() {
      this.listeners = {};
    }
    /**
     * Add a listener for a specified event type.
     *
     * @param {string} type the event name
     * @param {Function} listener the callback to be invoked when an event of
     * the specified type occurs
     */


    var _proto = Stream.prototype;

    _proto.on = function on(type, listener) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }

      this.listeners[type].push(listener);
    }
    /**
     * Remove a listener for a specified event type.
     *
     * @param {string} type the event name
     * @param {Function} listener  a function previously registered for this
     * type of event through `on`
     * @return {boolean} if we could turn it off or not
     */
    ;

    _proto.off = function off(type, listener) {
      if (!this.listeners[type]) {
        return false;
      }

      var index = this.listeners[type].indexOf(listener); // TODO: which is better?
      // In Video.js we slice listener functions
      // on trigger so that it does not mess up the order
      // while we loop through.
      //
      // Here we slice on off so that the loop in trigger
      // can continue using it's old reference to loop without
      // messing up the order.

      this.listeners[type] = this.listeners[type].slice(0);
      this.listeners[type].splice(index, 1);
      return index > -1;
    }
    /**
     * Trigger an event of the specified type on this stream. Any additional
     * arguments to this function are passed as parameters to event listeners.
     *
     * @param {string} type the event name
     */
    ;

    _proto.trigger = function trigger(type) {
      var callbacks = this.listeners[type];

      if (!callbacks) {
        return;
      } // Slicing the arguments on every invocation of this method
      // can add a significant amount of overhead. Avoid the
      // intermediate object creation for the common case of a
      // single callback argument


      if (arguments.length === 2) {
        var length = callbacks.length;

        for (var i = 0; i < length; ++i) {
          callbacks[i].call(this, arguments[1]);
        }
      } else {
        var args = Array.prototype.slice.call(arguments, 1);
        var _length = callbacks.length;

        for (var _i = 0; _i < _length; ++_i) {
          callbacks[_i].apply(this, args);
        }
      }
    }
    /**
     * Destroys the stream and cleans up.
     */
    ;

    _proto.dispose = function dispose() {
      this.listeners = {};
    }
    /**
     * Forwards all `data` events on this stream to the destination stream. The
     * destination stream should provide a method `push` to receive the data
     * events as they arrive.
     *
     * @param {Stream} destination the stream that will receive all `data` events
     * @see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
     */
    ;

    _proto.pipe = function pipe(destination) {
      this.on('data', function (data) {
        destination.push(data);
      });
    };

    return Stream;
  }();

  var stream = Stream;

  /**
   * A stream that buffers string input and generates a `data` event for each
   * line.
   *
   * @class LineStream
   * @extends Stream
   */

  var LineStream =
  /*#__PURE__*/
  function (_Stream) {
    inheritsLoose(LineStream, _Stream);

    function LineStream() {
      var _this;

      _this = _Stream.call(this) || this;
      _this.buffer = '';
      return _this;
    }
    /**
     * Add new data to be parsed.
     *
     * @param {string} data the text to process
     */


    var _proto = LineStream.prototype;

    _proto.push = function push(data) {
      var nextNewline;
      this.buffer += data;
      nextNewline = this.buffer.indexOf('\n');

      for (; nextNewline > -1; nextNewline = this.buffer.indexOf('\n')) {
        this.trigger('data', this.buffer.substring(0, nextNewline));
        this.buffer = this.buffer.substring(nextNewline + 1);
      }
    };

    return LineStream;
  }(stream);

  /**
   * "forgiving" attribute list psuedo-grammar:
   * attributes -> keyvalue (',' keyvalue)*
   * keyvalue   -> key '=' value
   * key        -> [^=]*
   * value      -> '"' [^"]* '"' | [^,]*
   */

  var attributeSeparator = function attributeSeparator() {
    var key = '[^=]*';
    var value = '"[^"]*"|[^,]*';
    var keyvalue = '(?:' + key + ')=(?:' + value + ')';
    return new RegExp('(?:^|,)(' + keyvalue + ')');
  };
  /**
   * Parse attributes from a line given the separator
   *
   * @param {string} attributes the attribute line to parse
   */


  var parseAttributes = function parseAttributes(attributes) {
    // split the string using attributes as the separator
    var attrs = attributes.split(attributeSeparator());
    var result = {};
    var i = attrs.length;
    var attr;

    while (i--) {
      // filter out unmatched portions of the string
      if (attrs[i] === '') {
        continue;
      } // split the key and value


      attr = /([^=]*)=(.*)/.exec(attrs[i]).slice(1); // trim whitespace and remove optional quotes around the value

      attr[0] = attr[0].replace(/^\s+|\s+$/g, '');
      attr[1] = attr[1].replace(/^\s+|\s+$/g, '');
      attr[1] = attr[1].replace(/^['"](.*)['"]$/g, '$1');
      result[attr[0]] = attr[1];
    }

    return result;
  };
  /**
   * A line-level M3U8 parser event stream. It expects to receive input one
   * line at a time and performs a context-free parse of its contents. A stream
   * interpretation of a manifest can be useful if the manifest is expected to
   * be too large to fit comfortably into memory or the entirety of the input
   * is not immediately available. Otherwise, it's probably much easier to work
   * with a regular `Parser` object.
   *
   * Produces `data` events with an object that captures the parser's
   * interpretation of the input. That object has a property `tag` that is one
   * of `uri`, `comment`, or `tag`. URIs only have a single additional
   * property, `line`, which captures the entirety of the input without
   * interpretation. Comments similarly have a single additional property
   * `text` which is the input without the leading `#`.
   *
   * Tags always have a property `tagType` which is the lower-cased version of
   * the M3U8 directive without the `#EXT` or `#EXT-X-` prefix. For instance,
   * `#EXT-X-MEDIA-SEQUENCE` becomes `media-sequence` when parsed. Unrecognized
   * tags are given the tag type `unknown` and a single additional property
   * `data` with the remainder of the input.
   *
   * @class ParseStream
   * @extends Stream
   */


  var ParseStream =
  /*#__PURE__*/
  function (_Stream) {
    inheritsLoose(ParseStream, _Stream);

    function ParseStream() {
      var _this;

      _this = _Stream.call(this) || this;
      _this.customParsers = [];
      _this.tagMappers = [];
      return _this;
    }
    /**
     * Parses an additional line of input.
     *
     * @param {string} line a single line of an M3U8 file to parse
     */


    var _proto = ParseStream.prototype;

    _proto.push = function push(line) {
      var _this2 = this;

      var match;
      var event; // strip whitespace

      line = line.trim();

      if (line.length === 0) {
        // ignore empty lines
        return;
      } // URIs


      if (line[0] !== '#') {
        this.trigger('data', {
          type: 'uri',
          uri: line
        });
        return;
      } // map tags


      var newLines = this.tagMappers.reduce(function (acc, mapper) {
        var mappedLine = mapper(line); // skip if unchanged

        if (mappedLine === line) {
          return acc;
        }

        return acc.concat([mappedLine]);
      }, [line]);
      newLines.forEach(function (newLine) {
        for (var i = 0; i < _this2.customParsers.length; i++) {
          if (_this2.customParsers[i].call(_this2, newLine)) {
            return;
          }
        } // Comments


        if (newLine.indexOf('#EXT') !== 0) {
          _this2.trigger('data', {
            type: 'comment',
            text: newLine.slice(1)
          });

          return;
        } // strip off any carriage returns here so the regex matching
        // doesn't have to account for them.


        newLine = newLine.replace('\r', ''); // Tags

        match = /^#EXTM3U/.exec(newLine);

        if (match) {
          _this2.trigger('data', {
            type: 'tag',
            tagType: 'm3u'
          });

          return;
        }

        match = /^#EXTINF:?([0-9\.]*)?,?(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'inf'
          };

          if (match[1]) {
            event.duration = parseFloat(match[1]);
          }

          if (match[2]) {
            event.title = match[2];
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-TARGETDURATION:?([0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'targetduration'
          };

          if (match[1]) {
            event.duration = parseInt(match[1], 10);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#ZEN-TOTAL-DURATION:?([0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'totalduration'
          };

          if (match[1]) {
            event.duration = parseInt(match[1], 10);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-VERSION:?([0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'version'
          };

          if (match[1]) {
            event.version = parseInt(match[1], 10);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-MEDIA-SEQUENCE:?(\-?[0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'media-sequence'
          };

          if (match[1]) {
            event.number = parseInt(match[1], 10);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-DISCONTINUITY-SEQUENCE:?(\-?[0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'discontinuity-sequence'
          };

          if (match[1]) {
            event.number = parseInt(match[1], 10);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-PLAYLIST-TYPE:?(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'playlist-type'
          };

          if (match[1]) {
            event.playlistType = match[1];
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-BYTERANGE:?([0-9.]*)?@?([0-9.]*)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'byterange'
          };

          if (match[1]) {
            event.length = parseInt(match[1], 10);
          }

          if (match[2]) {
            event.offset = parseInt(match[2], 10);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-ALLOW-CACHE:?(YES|NO)?/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'allow-cache'
          };

          if (match[1]) {
            event.allowed = !/NO/.test(match[1]);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-MAP:?(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'map'
          };

          if (match[1]) {
            var attributes = parseAttributes(match[1]);

            if (attributes.URI) {
              event.uri = attributes.URI;
            }

            if (attributes.BYTERANGE) {
              var _attributes$BYTERANGE = attributes.BYTERANGE.split('@'),
                  length = _attributes$BYTERANGE[0],
                  offset = _attributes$BYTERANGE[1];

              event.byterange = {};

              if (length) {
                event.byterange.length = parseInt(length, 10);
              }

              if (offset) {
                event.byterange.offset = parseInt(offset, 10);
              }
            }
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-STREAM-INF:?(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'stream-inf'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]);

            if (event.attributes.RESOLUTION) {
              var split = event.attributes.RESOLUTION.split('x');
              var resolution = {};

              if (split[0]) {
                resolution.width = parseInt(split[0], 10);
              }

              if (split[1]) {
                resolution.height = parseInt(split[1], 10);
              }

              event.attributes.RESOLUTION = resolution;
            }

            if (event.attributes.BANDWIDTH) {
              event.attributes.BANDWIDTH = parseInt(event.attributes.BANDWIDTH, 10);
            }

            if (event.attributes['PROGRAM-ID']) {
              event.attributes['PROGRAM-ID'] = parseInt(event.attributes['PROGRAM-ID'], 10);
            }
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-MEDIA:?(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'media'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-ENDLIST/.exec(newLine);

        if (match) {
          _this2.trigger('data', {
            type: 'tag',
            tagType: 'endlist'
          });

          return;
        }

        match = /^#EXT-X-DISCONTINUITY/.exec(newLine);

        if (match) {
          _this2.trigger('data', {
            type: 'tag',
            tagType: 'discontinuity'
          });

          return;
        }

        match = /^#EXT-X-PROGRAM-DATE-TIME:?(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'program-date-time'
          };

          if (match[1]) {
            event.dateTimeString = match[1];
            event.dateTimeObject = new Date(match[1]);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-KEY:?(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'key'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]); // parse the IV string into a Uint32Array

            if (event.attributes.IV) {
              if (event.attributes.IV.substring(0, 2).toLowerCase() === '0x') {
                event.attributes.IV = event.attributes.IV.substring(2);
              }

              event.attributes.IV = event.attributes.IV.match(/.{8}/g);
              event.attributes.IV[0] = parseInt(event.attributes.IV[0], 16);
              event.attributes.IV[1] = parseInt(event.attributes.IV[1], 16);
              event.attributes.IV[2] = parseInt(event.attributes.IV[2], 16);
              event.attributes.IV[3] = parseInt(event.attributes.IV[3], 16);
              event.attributes.IV = new Uint32Array(event.attributes.IV);
            }
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-START:?(.*)$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'start'
          };

          if (match[1]) {
            event.attributes = parseAttributes(match[1]);
            event.attributes['TIME-OFFSET'] = parseFloat(event.attributes['TIME-OFFSET']);
            event.attributes.PRECISE = /YES/.test(event.attributes.PRECISE);
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-CUE-OUT-CONT:?(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'cue-out-cont'
          };

          if (match[1]) {
            event.data = match[1];
          } else {
            event.data = '';
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-CUE-OUT:?(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'cue-out'
          };

          if (match[1]) {
            event.data = match[1];
          } else {
            event.data = '';
          }

          _this2.trigger('data', event);

          return;
        }

        match = /^#EXT-X-CUE-IN:?(.*)?$/.exec(newLine);

        if (match) {
          event = {
            type: 'tag',
            tagType: 'cue-in'
          };

          if (match[1]) {
            event.data = match[1];
          } else {
            event.data = '';
          }

          _this2.trigger('data', event);

          return;
        } // unknown tag type


        _this2.trigger('data', {
          type: 'tag',
          data: newLine.slice(4)
        });
      });
    }
    /**
     * Add a parser for custom headers
     *
     * @param {Object}   options              a map of options for the added parser
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {string}   options.customType   the custom type to register to the output
     * @param {Function} [options.dataParser] function to parse the line into an object
     * @param {boolean}  [options.segment]    should tag data be attached to the segment object
     */
    ;

    _proto.addParser = function addParser(_ref) {
      var _this3 = this;

      var expression = _ref.expression,
          customType = _ref.customType,
          dataParser = _ref.dataParser,
          segment = _ref.segment;

      if (typeof dataParser !== 'function') {
        dataParser = function dataParser(line) {
          return line;
        };
      }

      this.customParsers.push(function (line) {
        var match = expression.exec(line);

        if (match) {
          _this3.trigger('data', {
            type: 'custom',
            data: dataParser(line),
            customType: customType,
            segment: segment
          });

          return true;
        }
      });
    }
    /**
     * Add a custom header mapper
     *
     * @param {Object}   options
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {Function} options.map          function to translate tag into a different tag
     */
    ;

    _proto.addTagMapper = function addTagMapper(_ref2) {
      var expression = _ref2.expression,
          map = _ref2.map;

      var mapFn = function mapFn(line) {
        if (expression.test(line)) {
          return map(line);
        }

        return line;
      };

      this.tagMappers.push(mapFn);
    };

    return ParseStream;
  }(stream);

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var _extends_1 = createCommonjsModule(function (module) {
  function _extends() {
    module.exports = _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  module.exports = _extends;
  });

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  var assertThisInitialized = _assertThisInitialized;

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var window__default = /*#__PURE__*/_interopDefaultLegacy(window);

  var atob = function atob(s) {
    return window__default['default'].atob ? window__default['default'].atob(s) : Buffer.from(s, 'base64').toString('binary');
  };

  function decodeB64ToUint8Array(b64Text) {
    var decodedString = atob(b64Text);
    var array = new Uint8Array(decodedString.length);

    for (var i = 0; i < decodedString.length; i++) {
      array[i] = decodedString.charCodeAt(i);
    }

    return array;
  }

  var decodeB64ToUint8Array_1 = decodeB64ToUint8Array;

  /**
   * A parser for M3U8 files. The current interpretation of the input is
   * exposed as a property `manifest` on parser objects. It's just two lines to
   * create and parse a manifest once you have the contents available as a string:
   *
   * ```js
   * var parser = new m3u8.Parser();
   * parser.push(xhr.responseText);
   * ```
   *
   * New input can later be applied to update the manifest object by calling
   * `push` again.
   *
   * The parser attempts to create a usable manifest object even if the
   * underlying input is somewhat nonsensical. It emits `info` and `warning`
   * events during the parse if it encounters input that seems invalid or
   * requires some property of the manifest object to be defaulted.
   *
   * @class Parser
   * @extends Stream
   */

  var Parser =
  /*#__PURE__*/
  function (_Stream) {
    inheritsLoose(Parser, _Stream);

    function Parser() {
      var _this;

      _this = _Stream.call(this) || this;
      _this.lineStream = new LineStream();
      _this.parseStream = new ParseStream();

      _this.lineStream.pipe(_this.parseStream);
      /* eslint-disable consistent-this */


      var self = assertThisInitialized(_this);
      /* eslint-enable consistent-this */


      var uris = [];
      var currentUri = {}; // if specified, the active EXT-X-MAP definition

      var currentMap; // if specified, the active decryption key

      var _key;

      var noop = function noop() {};

      var defaultMediaGroups = {
        'AUDIO': {},
        'VIDEO': {},
        'CLOSED-CAPTIONS': {},
        'SUBTITLES': {}
      }; // This is the Widevine UUID from DASH IF IOP. The same exact string is
      // used in MPDs with Widevine encrypted streams.

      var widevineUuid = 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed'; // group segments into numbered timelines delineated by discontinuities

      var currentTimeline = 0; // the manifest is empty until the parse stream begins delivering data

      _this.manifest = {
        allowCache: true,
        discontinuityStarts: [],
        segments: []
      }; // keep track of the last seen segment's byte range end, as segments are not required
      // to provide the offset, in which case it defaults to the next byte after the
      // previous segment

      var lastByterangeEnd = 0; // update the manifest with the m3u8 entry from the parse stream

      _this.parseStream.on('data', function (entry) {
        var mediaGroup;
        var rendition;
        ({
          tag: function tag() {
            // switch based on the tag type
            (({
              'allow-cache': function allowCache() {
                this.manifest.allowCache = entry.allowed;

                if (!('allowed' in entry)) {
                  this.trigger('info', {
                    message: 'defaulting allowCache to YES'
                  });
                  this.manifest.allowCache = true;
                }
              },
              byterange: function byterange() {
                var byterange = {};

                if ('length' in entry) {
                  currentUri.byterange = byterange;
                  byterange.length = entry.length;

                  if (!('offset' in entry)) {
                    /*
                     * From the latest spec (as of this writing):
                     * https://tools.ietf.org/html/draft-pantos-http-live-streaming-23#section-4.3.2.2
                     *
                     * Same text since EXT-X-BYTERANGE's introduction in draft 7:
                     * https://tools.ietf.org/html/draft-pantos-http-live-streaming-07#section-3.3.1)
                     *
                     * "If o [offset] is not present, the sub-range begins at the next byte
                     * following the sub-range of the previous media segment."
                     */
                    entry.offset = lastByterangeEnd;
                  }
                }

                if ('offset' in entry) {
                  currentUri.byterange = byterange;
                  byterange.offset = entry.offset;
                }

                lastByterangeEnd = byterange.offset + byterange.length;
              },
              endlist: function endlist() {
                this.manifest.endList = true;
              },
              inf: function inf() {
                if (!('mediaSequence' in this.manifest)) {
                  this.manifest.mediaSequence = 0;
                  this.trigger('info', {
                    message: 'defaulting media sequence to zero'
                  });
                }

                if (!('discontinuitySequence' in this.manifest)) {
                  this.manifest.discontinuitySequence = 0;
                  this.trigger('info', {
                    message: 'defaulting discontinuity sequence to zero'
                  });
                }

                if (entry.duration > 0) {
                  currentUri.duration = entry.duration;
                }

                if (entry.duration === 0) {
                  currentUri.duration = 0.01;
                  this.trigger('info', {
                    message: 'updating zero segment duration to a small value'
                  });
                }

                this.manifest.segments = uris;
              },
              key: function key() {
                if (!entry.attributes) {
                  this.trigger('warn', {
                    message: 'ignoring key declaration without attribute list'
                  });
                  return;
                } // clear the active encryption key


                if (entry.attributes.METHOD === 'NONE') {
                  _key = null;
                  return;
                }

                if (!entry.attributes.URI) {
                  this.trigger('warn', {
                    message: 'ignoring key declaration without URI'
                  });
                  return;
                } // check if the content is encrypted for Widevine
                // Widevine/HLS spec: https://storage.googleapis.com/wvdocs/Widevine_DRM_HLS.pdf


                if (entry.attributes.KEYFORMAT === widevineUuid) {
                  var VALID_METHODS = ['SAMPLE-AES', 'SAMPLE-AES-CTR', 'SAMPLE-AES-CENC'];

                  if (VALID_METHODS.indexOf(entry.attributes.METHOD) === -1) {
                    this.trigger('warn', {
                      message: 'invalid key method provided for Widevine'
                    });
                    return;
                  }

                  if (entry.attributes.METHOD === 'SAMPLE-AES-CENC') {
                    this.trigger('warn', {
                      message: 'SAMPLE-AES-CENC is deprecated, please use SAMPLE-AES-CTR instead'
                    });
                  }

                  if (entry.attributes.URI.substring(0, 23) !== 'data:text/plain;base64,') {
                    this.trigger('warn', {
                      message: 'invalid key URI provided for Widevine'
                    });
                    return;
                  }

                  if (!(entry.attributes.KEYID && entry.attributes.KEYID.substring(0, 2) === '0x')) {
                    this.trigger('warn', {
                      message: 'invalid key ID provided for Widevine'
                    });
                    return;
                  } // if Widevine key attributes are valid, store them as `contentProtection`
                  // on the manifest to emulate Widevine tag structure in a DASH mpd


                  this.manifest.contentProtection = {
                    'com.widevine.alpha': {
                      attributes: {
                        schemeIdUri: entry.attributes.KEYFORMAT,
                        // remove '0x' from the key id string
                        keyId: entry.attributes.KEYID.substring(2)
                      },
                      // decode the base64-encoded PSSH box
                      pssh: decodeB64ToUint8Array_1(entry.attributes.URI.split(',')[1])
                    }
                  };
                  return;
                }

                if (!entry.attributes.METHOD) {
                  this.trigger('warn', {
                    message: 'defaulting key method to AES-128'
                  });
                } // setup an encryption key for upcoming segments


                _key = {
                  method: entry.attributes.METHOD || 'AES-128',
                  uri: entry.attributes.URI
                };

                if (typeof entry.attributes.IV !== 'undefined') {
                  _key.iv = entry.attributes.IV;
                }
              },
              'media-sequence': function mediaSequence() {
                if (!isFinite(entry.number)) {
                  this.trigger('warn', {
                    message: 'ignoring invalid media sequence: ' + entry.number
                  });
                  return;
                }

                this.manifest.mediaSequence = entry.number;
              },
              'discontinuity-sequence': function discontinuitySequence() {
                if (!isFinite(entry.number)) {
                  this.trigger('warn', {
                    message: 'ignoring invalid discontinuity sequence: ' + entry.number
                  });
                  return;
                }

                this.manifest.discontinuitySequence = entry.number;
                currentTimeline = entry.number;
              },
              'playlist-type': function playlistType() {
                if (!/VOD|EVENT/.test(entry.playlistType)) {
                  this.trigger('warn', {
                    message: 'ignoring unknown playlist type: ' + entry.playlist
                  });
                  return;
                }

                this.manifest.playlistType = entry.playlistType;
              },
              map: function map() {
                currentMap = {};

                if (entry.uri) {
                  currentMap.uri = entry.uri;
                }

                if (entry.byterange) {
                  currentMap.byterange = entry.byterange;
                }
              },
              'stream-inf': function streamInf() {
                this.manifest.playlists = uris;
                this.manifest.mediaGroups = this.manifest.mediaGroups || defaultMediaGroups;

                if (!entry.attributes) {
                  this.trigger('warn', {
                    message: 'ignoring empty stream-inf attributes'
                  });
                  return;
                }

                if (!currentUri.attributes) {
                  currentUri.attributes = {};
                }

                _extends_1(currentUri.attributes, entry.attributes);
              },
              media: function media() {
                this.manifest.mediaGroups = this.manifest.mediaGroups || defaultMediaGroups;

                if (!(entry.attributes && entry.attributes.TYPE && entry.attributes['GROUP-ID'] && entry.attributes.NAME)) {
                  this.trigger('warn', {
                    message: 'ignoring incomplete or missing media group'
                  });
                  return;
                } // find the media group, creating defaults as necessary


                var mediaGroupType = this.manifest.mediaGroups[entry.attributes.TYPE];
                mediaGroupType[entry.attributes['GROUP-ID']] = mediaGroupType[entry.attributes['GROUP-ID']] || {};
                mediaGroup = mediaGroupType[entry.attributes['GROUP-ID']]; // collect the rendition metadata

                rendition = {
                  default: /yes/i.test(entry.attributes.DEFAULT)
                };

                if (rendition.default) {
                  rendition.autoselect = true;
                } else {
                  rendition.autoselect = /yes/i.test(entry.attributes.AUTOSELECT);
                }

                if (entry.attributes.LANGUAGE) {
                  rendition.language = entry.attributes.LANGUAGE;
                }

                if (entry.attributes.URI) {
                  rendition.uri = entry.attributes.URI;
                }

                if (entry.attributes['INSTREAM-ID']) {
                  rendition.instreamId = entry.attributes['INSTREAM-ID'];
                }

                if (entry.attributes.CHARACTERISTICS) {
                  rendition.characteristics = entry.attributes.CHARACTERISTICS;
                }

                if (entry.attributes.FORCED) {
                  rendition.forced = /yes/i.test(entry.attributes.FORCED);
                } // insert the new rendition


                mediaGroup[entry.attributes.NAME] = rendition;
              },
              discontinuity: function discontinuity() {
                currentTimeline += 1;
                currentUri.discontinuity = true;
                this.manifest.discontinuityStarts.push(uris.length);
              },
              'program-date-time': function programDateTime() {
                if (typeof this.manifest.dateTimeString === 'undefined') {
                  // PROGRAM-DATE-TIME is a media-segment tag, but for backwards
                  // compatibility, we add the first occurence of the PROGRAM-DATE-TIME tag
                  // to the manifest object
                  // TODO: Consider removing this in future major version
                  this.manifest.dateTimeString = entry.dateTimeString;
                  this.manifest.dateTimeObject = entry.dateTimeObject;
                }

                currentUri.dateTimeString = entry.dateTimeString;
                currentUri.dateTimeObject = entry.dateTimeObject;
              },
              targetduration: function targetduration() {
                if (!isFinite(entry.duration) || entry.duration < 0) {
                  this.trigger('warn', {
                    message: 'ignoring invalid target duration: ' + entry.duration
                  });
                  return;
                }

                this.manifest.targetDuration = entry.duration;
              },
              totalduration: function totalduration() {
                if (!isFinite(entry.duration) || entry.duration < 0) {
                  this.trigger('warn', {
                    message: 'ignoring invalid total duration: ' + entry.duration
                  });
                  return;
                }

                this.manifest.totalDuration = entry.duration;
              },
              start: function start() {
                if (!entry.attributes || isNaN(entry.attributes['TIME-OFFSET'])) {
                  this.trigger('warn', {
                    message: 'ignoring start declaration without appropriate attribute list'
                  });
                  return;
                }

                this.manifest.start = {
                  timeOffset: entry.attributes['TIME-OFFSET'],
                  precise: entry.attributes.PRECISE
                };
              },
              'cue-out': function cueOut() {
                currentUri.cueOut = entry.data;
              },
              'cue-out-cont': function cueOutCont() {
                currentUri.cueOutCont = entry.data;
              },
              'cue-in': function cueIn() {
                currentUri.cueIn = entry.data;
              }
            })[entry.tagType] || noop).call(self);
          },
          uri: function uri() {
            currentUri.uri = entry.uri;
            uris.push(currentUri); // if no explicit duration was declared, use the target duration

            if (this.manifest.targetDuration && !('duration' in currentUri)) {
              this.trigger('warn', {
                message: 'defaulting segment duration to the target duration'
              });
              currentUri.duration = this.manifest.targetDuration;
            } // annotate with encryption information, if necessary


            if (_key) {
              currentUri.key = _key;
            }

            currentUri.timeline = currentTimeline; // annotate with initialization segment information, if necessary

            if (currentMap) {
              currentUri.map = currentMap;
            } // prepare for the next URI


            currentUri = {};
          },
          comment: function comment() {// comments are not important for playback
          },
          custom: function custom() {
            // if this is segment-level data attach the output to the segment
            if (entry.segment) {
              currentUri.custom = currentUri.custom || {};
              currentUri.custom[entry.customType] = entry.data; // if this is manifest-level data attach to the top level manifest object
            } else {
              this.manifest.custom = this.manifest.custom || {};
              this.manifest.custom[entry.customType] = entry.data;
            }
          }
        })[entry.type].call(self);
      });

      return _this;
    }
    /**
     * Parse the input string and update the manifest object.
     *
     * @param {string} chunk a potentially incomplete portion of the manifest
     */


    var _proto = Parser.prototype;

    _proto.push = function push(chunk) {
      this.lineStream.push(chunk);
    }
    /**
     * Flush any remaining input. This can be handy if the last line of an M3U8
     * manifest did not contain a trailing newline but the file has been
     * completely received.
     */
    ;

    _proto.end = function end() {
      // flush any buffered input
      this.lineStream.push('\n');
    }
    /**
     * Add an additional parser for non-standard tags
     *
     * @param {Object}   options              a map of options for the added parser
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {string}   options.type         the type to register to the output
     * @param {Function} [options.dataParser] function to parse the line into an object
     * @param {boolean}  [options.segment]    should tag data be attached to the segment object
     */
    ;

    _proto.addParser = function addParser(options) {
      this.parseStream.addParser(options);
    }
    /**
     * Add a custom header mapper
     *
     * @param {Object}   options
     * @param {RegExp}   options.expression   a regular expression to match the custom header
     * @param {Function} options.map          function to translate tag into a different tag
     */
    ;

    _proto.addTagMapper = function addTagMapper(options) {
      this.parseStream.addTagMapper(options);
    };

    return Parser;
  }(stream);

  exports.LineStream = LineStream;
  exports.ParseStream = ParseStream;
  exports.Parser = Parser;

  Object.defineProperty(exports, '__esModule', { value: true });

}));

var lib_export = { dash: _fakeGlobal.mpdParser, hls: _fakeGlobal.m3u8Parser };
if (typeof module !== 'undefined')
	module.exports = lib_export;
