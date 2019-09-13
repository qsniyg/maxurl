document.body.oncontextmenu = function(e) {
    return true;
    e.preventDefault();
    return false;
};

document.getElementById("replaceimages").onclick = function() {
    chrome.runtime.sendMessage({
        type: "popupaction",
        data: {
            action: "replace_images"
        }
    });
};

function get_option(name, cb, _default) {
    chrome.storage.sync.get([name], function(response) {
        var value = _default;

        if (Object.keys(response).length > 0 && response[name] !== undefined) {
            value = JSON.parse(response[name]);
        }

        cb(value);
    });
}

function set_option(name, value, cb) {
    var kv = {};
    kv[name] = value;
    chrome.storage.sync.set(kv, function(result) {
        if (cb)
            cb(result);
    });
}

function update_logo(value) {
    var filter = "none";

    if (!value) {
        filter = "saturate(0%)";
    }

    document.getElementById("logo").style.filter = filter;

    if (value) {
        document.getElementById("enabled-state").classList.remove("disabled");
        document.getElementById("enabled-state").innerText = "Enabled";
    } else {
        document.getElementById("enabled-state").classList.add("disabled");
        document.getElementById("enabled-state").innerText = "Disabled";
    }
}

function toggle_enabled() {
    get_option("imu_enabled", function(value) {
        set_option("imu_enabled", !value);
        update_logo(!value);
    }, true);
}

document.getElementById("logo").onclick = toggle_enabled;
//document.getElementById("enabled-state").onclick = toggle_enabled;

get_option("imu_enabled", function(value) {
    update_logo(value);
}, true);
