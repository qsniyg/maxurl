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
