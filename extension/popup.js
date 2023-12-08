document.body.oncontextmenu = function(e) {
    if (false) {
        return true;
    } else {
        e.preventDefault();
        return false;
    }
};

// Firefox needs a specified height
function updateheight() {
    setTimeout(function() {
        var html = document.getElementsByTagName("html")[0];
        html.style.height = document.body.scrollHeight + "px";
    }, 1);
}

function addactionbtn(info) {
    var buttons_el = document.getElementById("buttons");

    var button_container_el = document.createElement("li");
    button_container_el.classList.add("action");
    button_container_el.id = info.id + "_container";

    var button_el = document.createElement("button");
    button_el.classList.add("action");
    button_el.id = info.id;
    button_el.innerText = info.name;
    button_el.onclick = function() {
        chrome.runtime.sendMessage({
            type: "popupaction",
            data: {
                action: info.action
            }
        });
    };
    button_container_el.appendChild(button_el);

    return new Promise(function(resolve) {
        if (!info.toggle_setting) {
            buttons_el.appendChild(button_container_el);
            resolve();
        } else {
            get_option(info.toggle_setting, function(value) {
                if (value) {
                    buttons_el.appendChild(button_container_el);
                }

                resolve();
            }, info.toggle_default || false)
        }
        resolve();
    })
}

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

function get_menucommands(cb) {
    chrome.runtime.sendMessage({
        type: "get_menucommands",
    }, function(response) {
        cb(response.data);
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

    if (value) {
        container.style.display = "block";
    } else {
        container.style.display = "none";
    }

    updateheight();
}

var prefers_dark_mode = function() {
    try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
        return false;
    }
};

function update_dark_mode(value) {
    if (value === undefined)
        value = prefers_dark_mode();

    if (value) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
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

get_option("dark_mode", function(value) {
    update_dark_mode(value);
}, undefined);

get_option("imu_enabled", function(value) {
    update_logo(value);
}, true);

get_menucommands(function(menuitems) {
    var promises = [];

    for (let item of menuitems) {
        promises.push(addactionbtn({
            id: item.id,
            action: item.id,
            name: item.name
        }));
    }

    Promise.all(promises).then(updateheight);
});
