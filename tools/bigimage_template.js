var bigimage = function(src, options) {
    if (options.null_if_no_change)
        return null;

    return src;
};

var _get_bigimage = function() {
    // imu:shared_variables

    if (typeof __IMU_GETBIGIMAGE__ === "undefined") {
        require_rules_failed = {
            type: "undefined",
            data: __IMU_GETBIGIMAGE__,
            func: __IMU_GETBIGIMAGE__,
            message: "Rules library not included"
        };
    } else {
        try {
            var bigimage_obj = __IMU_GETBIGIMAGE__(shared_variables);

            if (!bigimage_obj || !bigimage_obj.bigimage) {
                require_rules_failed = {
                    type: "returned_falsey",
                    data: bigimage_obj,
                    message: "Unable to get bigimage function"
                };
            } else if (bigimage_obj.nonce !== __IMU_NONCE__) {
                // This could happen if for some reason the userscript manager updates the userscript,
                // but not the required libraries.
                require_rules_failed = {
                    type: "bad_nonce",
                    data: bigimage_obj.nonce,
                    message: "Bad nonce, expected: " + __IMU_NONCE__
                };
            } else {
                bigimage = bigimage_obj.bigimage;
            }

            if (require_rules_failed) {
                require_rules_failed.func = __IMU_GETBIGIMAGE__;
            }
        } catch (e) {
            require_rules_failed = {
                type: "js_error",
                data: e,
                message: "JS error fetching bigimage function",
                func: __IMU_GETBIGIMAGE__
            };
        }

        // in case the userscript is loaded in the window context
        delete __IMU_GETBIGIMAGE__;
    }

    if (require_rules_failed) {
        console_error(require_rules_failed);
    }
};
_get_bigimage();
