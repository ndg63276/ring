var snapshotresponse;

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

const user_agent = "sdfghjklabcdef/1.0";
const hardware_id = "a0b6c35c-8f77-43ef-a197-f7e69a915d54";
const OAUTH_URI = "https://oauth.ring.com/oauth/token";
const CLIENT_ID = "ring_official_android";
const CLIENT_SECRET = "";
const API_URI = "https://api.ring.com";
const NEW_SESSION_ENDPOINT = "/clients_api/session";
const DEVICES_ENDPOINT = "/clients_api/ring_devices";
const CHIMES_ENDPOINT = "/clients_api/chimes/";
const DOORBELLS_ENDPOINT = "/clients_api/doorbots/";
const LIGHTS_ENDPOINT = "/floodlight_light_";
const URL_RECORDING = "/clients_api/dings/"
const SNAPSHOT_TIMESTAMP_ENDPOINT = "/clients_api/snapshots/timestamps";
const SNAPSHOT_ENDPOINT = "/clients_api/snapshots/image/";
const API_VERSION = "9";

var user_info = {};

// Jquery ready is deprecated since 3.0
$(document).ready(function () {
	testFirstCookie();
	document.getElementById("password").onkeydown = function (e) {
		if (e.key === 'Enter') {
			do_login();
		}
	};
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
		"2fa-support": "false",
		"Authorization": "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET)
	}
	if (otpcode != "") {
		headers["2fa-support"] = "true";
		headers["2fa-code"] = otpcode;
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
		},
		error: function (response) {
			json = response["responseJSON"];
			console.log(json);
			if ("tsv_state" in json && json["tsv_state"] == "sms") {
				document.getElementById("usernameWrapper").classList.add("hidden");
				document.getElementById("passwordWrapper").classList.add("hidden");
				document.getElementById("storecredsWrapper").classList.add("hidden");
				phoneNumber = json["phone"];
				document.getElementById("otpcodeLabel").innerHTML = "Please enter the code sent to "+phoneNumber+":";
				document.getElementById("otpcodeWrapper").classList.remove("hidden");
				setTimeout(function() {
					document.getElementById("otpcode").focus();
				}, 0);
			} else if ("tsv_state" in json && json["tsv_state"] == "totp") {
				document.getElementById("usernameWrapper").classList.add("hidden");
				document.getElementById("passwordWrapper").classList.add("hidden");
				document.getElementById("storecredsWrapper").classList.add("hidden");
				document.getElementById("otpcodeLabel").innerHTML = "Please enter the code from your authenticator app:";
				document.getElementById("otpcodeWrapper").classList.remove("hidden");
				setTimeout(function() {
					document.getElementById("otpcode").focus();
				}, 0);
			} else if ("tsv_state" in json && json["tsv_state"] == "email") {
				document.getElementById("usernameWrapper").classList.add("hidden");
				document.getElementById("passwordWrapper").classList.add("hidden");
				document.getElementById("storecredsWrapper").classList.add("hidden");
				phoneNumber = json["phone"];
				document.getElementById("otpcodeLabel").innerHTML = "An email has been sent to "+phoneNumber;
				document.getElementById("otpcodeLabel").innerHTML += ". Follow the instrcutions to generate a verification code:";
				document.getElementById("otpcodeWrapper").classList.remove("hidden");
				setTimeout(function() {
					document.getElementById("otpcode").focus();
				}, 0);
			}
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

function get_recording_url(id) {
	refresh_token();
	var el = document.getElementById(id);
	if (id.startsWith("id")) {
		id = id.substr(2);
	}
	var url = API_URI + URL_RECORDING + id + "/share/play";
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
			el.href = json["url"];
			el.target = "_blank";
		}
	});
}

function get_snapshot(id, snapshotTimestamp) {
	var timestamp = moment(snapshotTimestamp);
	document.getElementById("snapshotTimestamp").innerHTML = timestamp;
	var snapshot = document.getElementById("snapshot");
	var url = API_URI + SNAPSHOT_ENDPOINT + id;
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function(){
		if (this.readyState == 4 && this.status == 200){
			console.log(this.response, typeof this.response);
			snapshot.src = URL.createObjectURL(this.response);
			document.getElementById("snapshotOuter").classList.remove("hidden");
			snapshot.classList.remove("hidden");
		}
	}
	xhr.open("GET", proxyurl + url);
	xhr.setRequestHeader("Authorization", "Bearer " + user_info["ring_access_token"]);
	xhr.responseType = 'blob';
	xhr.send();
}

function check_for_snapshots(id) {
	var to_return = false;
	var url = API_URI + SNAPSHOT_TIMESTAMP_ENDPOINT;
	var headers = {
		"Authorization": "Bearer " + user_info["ring_access_token"]
	}
	data = {
		"doorbot_ids": [id]
	}
	$.ajax({
		url: proxyurl + url,
		type: "POST",
		headers: headers,
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			if ("timestamps" in json && json["timestamps"].length > 0) {
				to_return = json["timestamps"][0]["timestamp"];
				console.log(to_return);
			}
		}
	});
	return to_return;
}

function close_history() {
	document.getElementById("historyOuter").classList.add("hidden");
}

function close_snapshot() {
	document.getElementById("snapshotOuter").classList.add("hidden");
}

function get_history(id) {
	var history = document.getElementById("historyInner");
	var historyinnerHTML = "<br /><br />";
	var url = API_URI + DOORBELLS_ENDPOINT + id + "/history";
	var headers = {
		"Authorization": "Bearer " + user_info["ring_access_token"]
	}
	data = {
		"api_version": API_VERSION,
		"limit": 10,
	}
	$.ajax({
		url: proxyurl + url,
		type: "GET",
		headers: headers,
		data: data,
		dataType: "text",
		async: false,
		success: function (text) {
			let stringedJSON = text.replace(/:\s*([-+Ee0-9.]{10,})/g, ': "id$1"');
			let json = JSON.parse(stringedJSON);
			console.log(json);
			historyinnerHTML += "<ul id='myUL'>";
			for (key in json) {
				createdAt = moment(json[key]["created_at"]).format("ddd Do MMM HH:mm:ss");
				kind = json[key]["kind"];
				doorbot = json[key]["doorbot"]["description"];
				recording = json[key]["recording"]["status"];
				if (recording == "ready") {
					dingId = json[key]["id"];
					recording = "<a id='"+dingId+"' href='#' onclick='get_recording_url(\""
					recording += dingId + "\")'>Show</a>"
				}
				answered = json[key]["answered"] ? "(answered)" : "(not answered)";
				historyinnerHTML += "<li><span class='caret'>" + createdAt + "</span>";
				historyinnerHTML += "<ul class='nested'>";
				historyinnerHTML += "<li>Doorbot: " + doorbot + "</li>"
				historyinnerHTML += "<li>Kind: " + kind + " " + answered + "</li>"
				historyinnerHTML += "<li>Recording: " + recording + "</li>"
				historyinnerHTML += "</ul></li>"
			}
			historyinnerHTML += "</ul><br /><br />";
			historyinnerHTML += "<center><button onclick='close_history()'>Close</button></center>";
			history.innerHTML = historyinnerHTML;
		}
	});
	var toggler = document.getElementsByClassName("caret");
	for (var i=0; i<toggler.length; i++) {
		toggler[i].addEventListener("click", function() {
			thisNest = this.parentElement.querySelector(".nested");
			thisNestActive = thisNest.classList.contains("active");
			for (el of document.getElementsByClassName("nested")) {
				el.classList.remove("active");
			}
			for (el of document.getElementsByClassName("caret")) {
				el.classList.remove("caret-down");
			}
			if (!thisNestActive) {
				thisNest.classList.add("active");
				this.classList.add("caret-down");
			}
		});
	}
	document.getElementById("historyOuter").classList.remove("hidden");
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

function toggle_light(id, state) {
	var url = API_URI + DOORBELLS_ENDPOINT + id + LIGHTS_ENDPOINT + state;
	var headers = {
		"Authorization": "Bearer " + user_info["ring_access_token"]
	}
	data = {
		"api_version": API_VERSION,
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
			button = document.getElementById(id + "_light");
			if (state == "on") {
				button.innerHTML = "Turn light off";
				button.onclick = function() {toggle_light(id, "off")};
			} else {
				button.innerHTML = "Turn light on";
				button.onclick = function() {toggle_light(id, "on")};
			}
		}
	});
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
			td.classList.add("small");
			text = document.createTextNode("("+tidyDeviceTypes(device_type)+")");
			td.appendChild(text);
			tr.appendChild(td);
			table.appendChild(tr);
			if (device_type == "doorbots" || device_type == "authorized_doorbots") {
				bat1 = thisDevice["battery_life"] || null;
				bat2 = thisDevice["battery_life_2"] || null;
				if (bat1 != null || bat2 != null) {
					battery = 0;
					if (bat1 != null) {
						battery += parseInt(bat1);
					}
					if (bat2 != null) {
						battery += parseInt(bat2);
					}
					tr = createElement("tr");
					text = document.createTextNode("Battery: " + battery + "%");
					tr.appendChild(text);
					table.appendChild(tr);
				}
				tr = createElement("tr");
				online = thisDevice["health"]["connected"] ? "Online" : "Offline";
				text = document.createTextNode("Network status: ");
				span = createElement("span");
				span.classList.add(online == "Online" ? "green" : "red");
				span.innerHTML = online;
				tr.appendChild(text);
				tr.appendChild(span);
				table.appendChild(tr);
				tr = createElement("tr");
				strength = thisDevice["health"]["rssi"];
				text = document.createTextNode("Signal strength: RSSI " + strength);
				tr.appendChild(text);
				table.appendChild(tr);
				tr = createElement("tr");
				healthcheck = new Date(thisDevice["health"]["last_update_time"]*1000);
				text = document.createTextNode("Last health check: " + healthcheck.toLocaleString());
				tr.appendChild(text);
				table.appendChild(tr);
				tr = createElement("tr");
				firmware = thisDevice["health"]["firmware_version"];
				text = document.createTextNode("Firmware version: " + firmware);
				tr.appendChild(text);
				table.appendChild(tr);
				tr = createElement("tr");
				firmwareStatus = thisDevice["health"]["firmware_version_status"];
				text = document.createTextNode("Firmware status: ");
				span = createElement("span");
				span.classList.add(firmwareStatus == "Up to Date" ? "green" : "red");
				span.innerHTML = firmwareStatus;
				tr.appendChild(text);
				tr.appendChild(span);
				table.appendChild(tr);
				tr = createElement("tr");
				button = createElement("button");
				button.innerHTML = "Show history";
				button.onclick = function() {get_history(thisId)};
				tr.appendChild(button);
				table.appendChild(tr);
				let snapshotTimestamp = check_for_snapshots(thisId);
				if (snapshotTimestamp != false) {
					tr = createElement("tr");
					button = createElement("button");
					button.innerHTML = "Show snapshot";
					button.onclick = function() {get_snapshot(thisId, snapshotTimestamp)};
					tr.appendChild(button);
					table.appendChild(tr);
				}
			}
			if (device_type == "stickup_cams" && "led_status" in thisDevice) {
				tr = createElement("tr");
				button = createElement("button");
				button.id = thisId + "_light";
				if (thisDevice["led_status"] == "on") {
					button.innerHTML = "Turn light off";
					button.onclick = function() {toggle_light(thisId, "off")};
				} else {
					button.innerHTML = "Turn light on";
					button.onclick = function() {toggle_light(thisId, "on")};
				}
				tr.appendChild(button);
				table.appendChild(tr);
			}
			if (device_type == "chimes") {
				tr = createElement("tr");
				button = createElement("button");
				button.innerHTML = "Test Ring";
				button.onclick = function() {test_chime(thisId, "ding")};
				tr.appendChild(button);
				table.appendChild(tr);
				tr = createElement("tr");
				button = createElement("button");
				button.innerHTML = "Test Motion";
				button.onclick = function() {test_chime(thisId, "motion")};
				tr.appendChild(button);
				table.appendChild(tr);
				tr = createElement("tr");
				text = document.createTextNode("Volume:");
				br = createElement("br");
				slider = createElement("input");
				slider.type = "range";
				slider.max = 10;
				slider.value = thisDevice["settings"]["volume"];
				slider.onchange = function() { set_volume(thisId, this.value) };
				tr.appendChild(text);
				tr.appendChild(br);
				tr.appendChild(slider);
				table.appendChild(tr);
			}
			div.appendChild(table);
			devicesDiv.appendChild(div);
		}
	}
}

function on_logout() {
	var devices = document.getElementById("devices");
	devices.classList.add("hidden");
	var login_div = document.getElementById("login");
	login_div.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
	setTimeout(function() {
		document.getElementById("username").focus();
	}, 1000);
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


function tidyDeviceTypes(str) {
	str = str.replace("doorbot", "doorbell");
	str = str.replace("authorized", "shared");
	str = capitalise(str);
	str = str.replaceAll("_", " ");
	str = singular(str);
	return str;
}
