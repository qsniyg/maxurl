document.body.oncontextmenu = function(e) {
    if (false) {
        return true;
    } else {
        e.preventDefault();
        return false;
    }
};

document.getElementById("replaceimages").onclick = function() {
    chrome.runtime.sendMessage({
        type: "popupaction",
        data: {
            action: "replace_images"
        }
    });
};

document.getElementById("highlightimages").onclick = function() {
    chrome.runtime.sendMessage({
        type: "popupaction",
        data: {
            action: "highlight_images"
        }
    });
};

function get_option(name, cb, _default) {
    chrome.runtime.sendMessage({
        type: "getvalue",
        data: [name]
    }, function(response) {
        response = response.data;

        var value = _default;

        if (Object.keys(response).length > 0 && response[name] !== undefined) {
            value = JSON.parse(response[name]);
        }

        cb(value);
    });
}

function set_option(name, value) {
    var kv = {};
    kv[name] = JSON.stringify(value);

    chrome.runtime.sendMessage({
        type: "setvalue",
        data: kv
    });
}

function update_logo(value) {
    if (value) {
        document.getElementById("enabled-state").classList.remove("disabled");
        document.getElementById("enabled-state").innerText = "Enabled";

        document.getElementById("enabled-logo").style = "";
        document.getElementById("disabled-logo").style = "display:none";
    } else {
        document.getElementById("enabled-state").classList.add("disabled");
        document.getElementById("enabled-state").innerText = "Disabled";

        document.getElementById("enabled-logo").style = "display:none";
        document.getElementById("disabled-logo").style = "";
    }
}

function update_highlightimages(value) {
    var container = document.getElementById("highlightimages_container");
    var html = document.getElementsByTagName("html")[0];

    var addheight = function(off) {
        html.style.height = (parseInt(html.style.height) + off) + "px";
    };

    if (value) {
        if (container.style.display === "none") {
            addheight(50);
        }
        container.style.display = "block";
    } else {
        if (container.style.display === "block") {
            addheight(-50);
        }
        container.style.display = "none";
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

get_option("highlightimgs_enable", function(value) {
    update_highlightimages(value);
}, false);
