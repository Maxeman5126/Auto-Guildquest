"use strict";

const SettingsUI = require("tera-mod-ui").Settings;

module.exports = function AutoGuildquest(mod) {
	let myQuestId = 0,
		cleared = 0,
		entered = false,
		hold = false,
		daily = 0,
		playTimeInterval = null,
		previousPlayTimeCheck = null;
	mod.game.initialize("inventory");
	
	mod.dispatch.addDefinition("C_RECEIVE_PLAYTIME_EVENT_REWARD", 99, [
		["unk1", "uint32"],
		["unk2", "uint32"],
		["row", "int32"],
		["column", "int32"]
	]);

	mod.game.me.on("change_zone", zone => {
		if (mod.settings.battleground.includes(zone)) {
			hold = true;
		} else if (hold && myQuestId !== 0) {
			hold = false;
			completeQuest();
			dailycredit();
		}
	});

	mod.game.on("enter_game", () => {
		daily = 0;
		playTimeConfig();
	});

	mod.hook("S_AVAILABLE_EVENT_MATCHING_LIST", 3, event => {
		daily = event.currDailyBonusCompleted
	});

	mod.hook("S_LOGIN", "event", () => {
		mod.hookOnce("S_SPAWN_ME", "event", () => {
			mod.setTimeout(dailycredit, 1000 + Math.random() * 250);
		});
	});

	mod.hook("S_FIELD_EVENT_ON_ENTER", "raw", () => {
		entered = true;
	});

	mod.hook("C_RETURN_TO_LOBBY", "raw", () => {
		entered = false;
	});

	mod.hook("S_COMPLETE_EVENT_MATCHING_QUEST", 1, event => {
		daily++;
		if (mod.settings.Vanguard) {
			myQuestId = event.id;
			if (!hold) {
				mod.setTimeout(completeQuest, 1000 + Math.random() * 250);
			}
		}
	});

	mod.hook("S_FIELD_EVENT_PROGRESS_INFO", 1, () => {
		if (mod.settings.Guardian) {
			mod.setTimeout(completeGuardian, 2000 + Math.random() * 250);
		}
	});

	mod.hook("S_UPDATE_GUILD_QUEST_STATUS", 1, event => {
		if (mod.settings.GQuest) {
			if (event.targets[0].completed == event.targets[0].total) {
				mod.setTimeout(() => {
					mod.send("C_REQUEST_FINISH_GUILD_QUEST", 1, { "quest": event.quest });
				}, 2000 + Math.random() * 1000);
				mod.setTimeout(() => {
					mod.send("C_REQUEST_START_GUILD_QUEST", 1, { "questId": event.quest });
				}, 4000 + Math.random() * 1000);
			}
		}
	});

	mod.hook("S_FIELD_POINT_INFO", 2, event => {
		if (entered && event.cleared != cleared && event.cleared - 1 > event.claimed) {
			mod.send("S_CHAT", mod.majorPatchVersion >= 108 ? 4 : 3, {
				"channel": 21,
				"gm": true,
				"name": "Guardian Mission",
				"message": `${event.cleared} / 40`
			});
		}
		cleared = event.cleared;
	});

	function completeQuest() {
		mod.send("C_COMPLETE_DAILY_EVENT", 1, { "id": myQuestId });
		mod.setTimeout(() => {
			mod.send("C_COMPLETE_EXTRA_EVENT", 1, { "type": 0 });
		}, 500 + Math.random() * 250);
		mod.setTimeout(() => {
			mod.send("C_COMPLETE_EXTRA_EVENT", 1, { "type": 1 });
		}, 1000 + Math.random() * 250);
		myQuestId = 0;
		if (mod.settings.VLog) {
			report();
		}
		if (mod.settings.VGChestEnabled) {
			checkChests();
		}
	}

	function report() {
		if (daily < 16) {
			mod.command.message(`Daily Vanguard Requests completed: ${ daily}`);
		} else {
			mod.command.message("You have completed all 16 Vanguard Requests today.");
		}
	}

	function checkChests() {
		let vgChests = mod.game.inventory.getTotalAmountInBagOrPockets(Number(mod.settings.VGChestItem));
		if (vgChests > 90) mod.command.message(`You're at ${vgChests} VG chests. Open or bank them soon.`); //Warn us in chat starting at 90 vg chests
		if (vgChests >=97) { //Use notice (only visible to yourself) starting at 97 chests
			mod.send("S_CHAT", mod.majorPatchVersion >= 108 ? 4 : 3, {
			"channel": 21,
			"message": `You're at ${vgChests} VG chests. Open or bank them immediately.`
			});
		}
	}

	function completeGuardian() {
		mod.send("C_REQUEST_FIELD_POINT_REWARD", 1, {});
		mod.setTimeout(() => {
			mod.send("C_REQUEST_ONGOING_FIELD_EVENT_LIST", 1, {});
		}, 2000 + Math.random() * 500);
	}

	function dailycredit() {
		if (mod.settings.Daily) {
			const _ = mod.trySend("C_REQUEST_RECV_DAILY_TOKEN", 1, {});
			!_ ? mod.log("Unmapped protocol packet 'C_REQUEST_RECV_DAILY_TOKEN'.") : null;
		}
	}

	function playTimeConfig() {
		if (mod.settings.playTimeEnabled) {
			checkPlayTime();
			playTimeInterval = mod.setInterval(checkPlayTime, 1800000);
		} else {
			mod.clearInterval(playTimeInterval);
		}
	}

	function checkPlayTime() {
		mod.send("C_REQUEST_PLAYTIME", 1, {});
	};

	mod.hook("S_PLAYTIME_EVENT_REWARD_DATA", 1, e => {
		if (!mod.settings.playTimeEnabled) return;
		//Game sometimes spams multiple packets, so we avoid sending multiple claims by ensuring we wait at least 5 seconds between each check.
		if (previousPlayTimeCheck && (Date.now() - previousPlayTimeCheck) < 5000) return;
		previousPlayTimeCheck = Date.now();
		e.items.forEach((item) => {
			if (item.timeRequired < 600 && item.redeemable == 1) {
				mod.send("C_RECEIVE_PLAYTIME_EVENT_REWARD", 99, {
					"row": item.row,
					"column": item.column
				});
			}
		})
	});

	let ui = null;
	if (global.TeraProxy.GUIMode) {
		ui = new SettingsUI(mod, require("./settings_structure"), mod.settings, { "alwaysOnTop": true, "width": 550, "height": 232 });
		ui.on("update", settings => { mod.settings = settings; playTimeConfig(); });
		this.destructor = () => {
			if (ui) {
				ui.close();
				ui = null;
			}
		};
	}

	mod.command.add("auto", {
		"VG": () => {
			mod.settings.Vanguard = !mod.settings.Vanguard;
			mod.command.message(`Auto-Vanguardquest: ${ mod.settings.Vanguard ? "On" : "Off"}`);
		},
		"GQ": () => {
			mod.settings.GQuest = !mod.settings.GQuest;
			mod.command.message(`Auto-Guildquest: ${ mod.settings.GQuest ? "On" : "Off"}`);
		},
		"GL": () => {
			mod.settings.Guardian = !mod.settings.Guardian;
			mod.command.message(`Auto-Gardian-Legion: ${ mod.settings.Guardian ? "On" : "Off"}`);
		},
		"DC": () => {
			mod.settings.Daily = !mod.settings.Daily;
			mod.command.message(`Auto-Daily-Credit: ${ mod.settings.Daily ? "On" : "Off"}`);
		},
		"VGLog": () => {
			mod.settings.VLog = !mod.settings.VLog;
			mod.command.message(`Vanguard-Quest Logger: ${ mod.settings.VLog ? "On" : "Off"}`);
		},
		"VGChest": () => {
			mod.settings.VGChestEnabled = !mod.settings.VGChestEnabled;
			mod.command.message(`Vanguard-Chest Notifier: ${ mod.settings.VGChestEnabled ? "On" : "Off"}`);
		},
		"PT": () => {
			mod.settings.playTimeEnabled = !mod.settings.playTimeEnabled;
			mod.command.message(`Auto Claim Daily playTime Rewards: ${ mod.settings.playTimeEnabled ? "On" : "Off"}`);
			playTimeConfig();
		},
		"UI": () => {
			ui.show();
		},
		"$default": () => {
			mod.command.message("Invalid argument. usasge command with 'auto'"),
			mod.command.message("UI | Show the ui setting"),
			mod.command.message("VQ | Auto-Vanguard"),
			mod.command.message("GQ | Auto-GuildQuest with relaunch"),
			mod.command.message("VGLog |Vanguard-Quest-Logger"),
			mod.command.message("VGChest | Vanguard Chest-Notifier"),
			mod.command.message("PT | Auto Claim Daily playTime Rewards"),
			mod.command.message("GL | Auto claim box in Gardian legion"),
			mod.command.message("DC | Auto claim Daily credit ");
		}
	});
};