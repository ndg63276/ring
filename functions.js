// Main source: https://github.com/tchellomello/python-ring-doorbell

// Insert the address of your cors anywhere server here, eg
const defaultCorsServer = "https://cors-anywhere.herokuapp.com/";

const approvedHosts = [
	"smartathome.co.uk",
	"www.smartathome.co.uk",
	"192.168.1.93:8000",
	"192.168.1.93:4443"
]

var proxyurl;
if (approvedHosts.includes(location.host)) {
	proxyurl = "https://cors.smartathome.co.uk/";
} else {
	proxyurl = defaultCorsServer;
}

const user_agent = "sdfghjklabcdef/1.0"
const hardware_id = 'a0b6c35c-8f77-43ef-a197-f7e69a915d54'
const OAUTH_URI = "https://oauth.ring.com/oauth/token"
const CLIENT_ID = "ring_official_android"
const CLIENT_SECRET = ""
const API_URI = "https://api.ring.com"
const NEW_SESSION_ENDPOINT = "/clients_api/session"
const DEVICES_ENDPOINT = "/clients_api/ring_devices"
const CHIMES_ENDPOINT = "/clients_api/chimes/"

const API_VERSION = "9"

var user_info = {};

// Jquery ready is deprecated since 3.0
$(document).ready(function () {
	testFirstCookie();
	document.getElementById("otpcode").onkeydown = function (e) {
		if (e.key === 'Enter') {
			do_login();
		}
	};
	user_info = {
		"ring_access_token": getCookie("ring_access_token"),
		"ring_refresh_token": getCookie("ring_refresh_token"),
		"ring_expires_in": getCookie("ring_expires_in")
	};
	console.log(user_info);

	logged_in = check_login();
	if (logged_in["success"] === true) {
		user_info["devices"] = logged_in["devices"];
		on_login();
		user_info["logged_in"] = true;
	} else {
		on_logout();
		user_info["logged_in"] = false;
	}

	readLocalStorage();
});

function login(username, password, otpcode, storecreds) {
	var headers = {
		"hardware_id": hardware_id,
		"2fa-support": "true",
		"2fa-code": otpcode,
		"Authorization": "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET)
	}
	var data = {
		'grant_type': 'password',
		'username': username,
		'password': password,
		'scope': 'client'
	}

	$.ajax({
		url: proxyurl + OAUTH_URI,
		type: "POST",
		headers: headers,
		data: data,
		dataType: "json",
		async: false,
		success: function (json) {
			store_tokens(json, storecreds);
		}
	});
}

function store_tokens(json, storecreds) {
	if ("access_token" in json) {
		user_info["ring_access_token"] = json["access_token"];
		user_info["ring_refresh_token"] = json["refresh_token"];
		user_info["ring_expires_in"] = Date.now() + json["expires_in"] * 1000;
		user_info["logged_in"] = true;
		if (storecreds === true) {
			setCookie("ring_access_token", json["access_token"], json["expires_in"] / 3600);
			setCookie("ring_refresh_token", json["refresh_token"], json["expires_in"] / 3600);
			setCookie("ring_expires_in", Date.now() + json["expires_in"] * 1000, json["expires_in"] / 3600);
		}
	}
}

function get_device_list(refresh_access_token) {
	if (refresh_access_token === true) {
		refresh_token();
	}
	to_return = {};
	var url = API_URI + DEVICES_ENDPOINT;
	var headers = {
		"Authorization": "Bearer " + user_info["ring_access_token"]
	}
	data = {
		"api_version": API_VERSION
	}
	$.ajax({
		url: proxyurl + url,
		type: "GET",
		headers: headers,
		data: data,
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			to_return["devices"] = json;
			to_return["success"] = true;
			localStorage.devices = JSON.stringify(to_return["devices"]);
		}
	});
	return to_return
}

function test_chime(id, kind) {
	to_return = {};
	var url = API_URI + CHIMES_ENDPOINT + id + "/play_sound";
	var headers = {
		"Authorization": "Bearer " + user_info["ring_access_token"]
	}
	data = {
		"api_version": API_VERSION,
		"kind": kind,
	}
	$.ajax({
		url: proxyurl + url,
		type: "POST",
		headers: headers,
		data: jQuery.param(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
		}
	});
	return to_return
}

function set_volume(id, volume) {
	to_return = {};
	var url = API_URI + CHIMES_ENDPOINT + id;
	var headers = {
		"Authorization": "Bearer " + user_info["ring_access_token"]
	}
	data = {
		"api_version": API_VERSION,
		"chime[settings][volume]": volume,
	}
	$.ajax({
		url: proxyurl + url,
		type: "PUT",
		headers: headers,
		data: jQuery.param(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
		}
	});
	return to_return
}


function refresh_token() {
	params = { "grant_type": "refresh_token", "refresh_token": user_info["ring_refresh_token"] }
	$.ajax({
		url: proxyurl + OAUTH_URI,
		type: "POST",
		data: params,
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			new_info = store_tokens(json, true);
		}
	});
}

function do_login() {
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.remove("hidden");
	var username = document.getElementById("username").value;
	var password = document.getElementById("password").value;
	var otpcode = document.getElementById("otpcode").value;
	var storecreds = document.getElementById("storecreds").checked;
	setTimeout(function () {
		login(username, password, otpcode, storecreds);
		if (user_info["logged_in"] === true) {
			device_list = get_device_list(false);
			user_info["devices"] = device_list["devices"]
			on_login();
		} else {
			on_logout();
			document.getElementById("loginfailed").innerHTML = "Login failed";
		}
	}, 100);
}

function check_login() {
	if (user_info["ring_access_token"] !== "") {
		console.log("Getting devices");
		device_list = get_device_list(false);
		return device_list;
	} else {
		console.log("No access_token");
		return { "success": false };
	}
}

function readLocalStorage() {
	// Not initialized
	if (localStorage.theme == null) {
		localStorage.theme = "a";
	}
	if (localStorage.theme !== "a") {
		checkTheme();
	}
}

function checkTheme() {
	switchTheme();
	localStorage.theme = $("#page").attr("data-theme");
}

function on_login() {
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var devices = document.getElementById("devices");
	devices.classList.remove("hidden");
	var buttons = document.getElementById("buttons");
	buttons.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
	update_devices(false);
}

function update_devices(force_update) {
	if (force_update === true) {
		device_list = get_device_list(true);
		user_info["devices"] = device_list["devices"];
	}
	var devicesDiv = document.getElementById("devices");
	devicesDiv.innerHTML = "";
	var devices = user_info["devices"];
	for (device_type in devices) {
		console.log("device_type: " + device_type);
		for (device in devices[device_type]) {
			thisDevice = devices[device_type][device];
			console.log("  device: " + thisDevice["id"]);
			let thisId = thisDevice["id"];
			div = createElement("div", "gridElem singleDevice borderShadow ui-btn"); // ui-btn-up-b ui-btn-hover-b");
			table = createElement("table");
			tr = createElement("tr");
			td = createElement("td");
			text = document.createTextNode(thisDevice["description"]);
			td.appendChild(text);
			tr.appendChild(td);
			table.appendChild(tr);
			tr = createElement("tr");
			td = createElement("td");
			text = document.createTextNode(singular(capitalise(device_type)));
			td.appendChild(text);
			tr.appendChild(td);
			table.appendChild(tr);

			if (device_type == "chimes") {
				tr = createElement("tr");
				td = createElement("td");
				button = createElement("button");
				button.innerHTML = "Test Ring";
				button.onclick = function() {test_chime(thisId, "ding")};
				td.appendChild(button);
				tr.appendChild(td);
				table.appendChild(tr);
				tr = createElement("tr");
				td = createElement("td");
				button = createElement("button");
				button.innerHTML = "Test Motion";
				button.onclick = function() {test_chime(thisId, "motion")};
				td.appendChild(button);
				tr.appendChild(td);
				table.appendChild(tr);
				tr = createElement("tr");
				td = createElement("td");
				slider = createElement("input");
				slider.type = "range";
				slider.max = 10;
				slider.value = thisDevice["settings"]["volume"];
				slider.onchange = function() { set_volume(thisId, this.value) };
				td.appendChild(slider);
				tr.appendChild(td);
				table.appendChild(tr);
			}
			div.appendChild(table);
		}
		devicesDiv.appendChild(div);
	}
}

function on_logout() {
	var devices = document.getElementById("devices");
	devices.classList.add("hidden");
	var login_div = document.getElementById("login");
	login_div.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
}

function logout() {
	setCookie("ring_access_token", "", -1);
	setCookie("ring_refresh_token", "", -1);
	setCookie("ring_expires_in", "", -1);
	location.reload();
}

function createElement(typeName, className) {
	var elem = document.createElement(typeName);
	if (!isNullOrEmpty(className)) {
		elem.className = className;
	}
	return elem;
}

function isNullOrEmpty(entry) {
	return entry == null || entry === '';
}

function singular(text) {
	if (text.endsWith("s")) {
		text = text.slice(0, -1);
	}
	return text;
}
