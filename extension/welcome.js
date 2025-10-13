function get_option(name, cb, _default) {
    chrome.runtime.sendMessage({
        type: "getvalue",
        data: [name]
    }, function (response) {
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

document.getElementById("closebtn").onclick = () => { window.close(); }

let options = [
    {
        "name": "Enable redirection",
        "description": "Automatically redirect media opened in their own tab to their larger/original versions.\nThe URL is queried directly from your browser to the respective website (nothing is sent to us).\nQueried information:",
        "setting": "redirect",
        "list": [
            "Larger media URL (to ensure it exists)",
            "No data is sent to us."
        ]
    },
    {
        "name": "Rules using API calls",
        "description": "Supports ~1000 extra websites, which require API calls to find the media.\nThe API calls are sent directly from your browser to the respective website (nothing is sent to us).\nPossibly transmitted information (depending on the rule):",
        "setting": "allow_apicalls",
        "list": [
            "Current page URL or part of it (usually just the media ID)",
            "Website-specific user ID and/or session token (if required)",
            "No data is sent to us."
        ]
    },
    {
        "name": "Enable website request button",
        "description": "Enables a button: \"Request support for website\".\nClicking it will send us the current page URL so that we can take a look at the website to support it.\nTransmitted information (when clicked):",
        "setting": "website_request_enable_button",
        "list": [
            "Current page URL",
            "Anonymized fingerprint (to prevent abuse)",
            "Sent to us."
        ]
    }
];

let optionsdiv = document.getElementById("options_add");
for (let option of options) {
    let framediv = document.createElement("DIV");
    framediv.classList.add("subcat");
    framediv.classList.add("frame");

    let optiondiv = document.createElement("DIV");
    optiondiv.classList.add("option");
    optiondiv.id = "option_" + option.setting;
    framediv.appendChild(optiondiv);

    let tableel = document.createElement("TABLE");
    tableel.classList.add("option-table");
    optiondiv.appendChild(tableel);

    let trel = document.createElement("TR");
    tableel.appendChild(trel);

    let nametd = document.createElement("TD");
    nametd.classList.add("name_td");
    nametd.classList.add("name_td_va_middle");
    trel.appendChild(nametd);

    let strongel = document.createElement("STRONG");
    strongel.innerText = option.name;
    nametd.appendChild(strongel);

    let valuetd = document.createElement("TD");
    valuetd.classList.add("value_td");
    trel.appendChild(valuetd);

    let opts = {
        "true": "Yes",
        "false": "No"
    };

    for (let opt in opts) {
        let optname = opts[opt];

        let checkbox = document.createElement("INPUT");
        checkbox.type = "checkbox";
        checkbox.value = opt;
        checkbox.name = option.setting;
        checkbox.id = option.setting + "_" + opt;
        valuetd.appendChild(checkbox);

        let label = document.createElement("LABEL");
        label.for = option.setting + "_" + opt;
        label.innerText = optname;
        valuetd.appendChild(label);

        label.onclick = () => {
            checkbox.checked = true;

            let our_opt = opt;
            for (let opt in opts) {
                if (opt === our_opt)
                    continue;

                let el = document.getElementById(option.setting + "_" + opt);
                if (!el)
                    continue;

                el.checked = false;
            }

            let value = opt === "true" ? true : false;

            set_option(option.setting, value);
        };

        get_option(option.setting, function(value) {
            let valuestr = value + "";

            if (valuestr === opt && opt === "true")
                checkbox.checked = true;
        })
    }

    for (let str of option.description.split("\n")) {
        let descel = document.createElement("P");
        descel.classList.add("description");
        descel.innerText = str;
        optiondiv.appendChild(descel);
    }

    if (option.list) {
        let examples = document.createElement("UL");
        examples.classList.add("examples");

        for (let item of option.list) {
            let li = document.createElement("LI");
            li.innerText = item;
            examples.appendChild(li);
        }

        optiondiv.appendChild(examples);
    }

    optionsdiv.appendChild(framediv);
}
