const DefaultSettings = {
	"Vanguard": true,
	"VLog": false,
	"VGChestEnabled": true,
	"VGChestItem": 156426,
	"GQuest": true,
	"Guardian": true,
	"Daily": true,
	"battleground": [
		102,
		103,
		110,
		111,
		112,
		116,
		117,
		118,
		119
	],
	"playTimeEnabled": true
};

module.exports = function MigrateSettings(from_ver, to_ver, settings) {
	if (from_ver === undefined) {
		// Migrate legacy config file
		return { ...DefaultSettings, ...settings };
	} else if (from_ver === null) {
		// No config file exists, use default settings
		return DefaultSettings;
	} else {
		// Migrate from older version (using the new system) to latest one
		if (from_ver + 1 < to_ver) { // Recursively upgrade in one-version steps
			settings = MigrateSettings(from_ver, from_ver + 1, settings);
			return MigrateSettings(from_ver + 1, to_ver, settings);
		}
		// If we reach this point it's guaranteed that from_ver === to_ver - 1, so we can implement
		// a switch for each version step that upgrades to the next version. This enables us to
		// upgrade from any version to the latest version without additional effort!
		switch (to_ver) {
            case 2:
                settings.VGChestEnabled = true;
                settings.VGChestItem = 156426;
                break;
			case 3:
				settings.playTimeEnabled = true;
				break;
			default:
				const oldsettings = settings;
				settings = Object.assign(DefaultSettings, {});
				for (const option in oldsettings) {
					if (settings[option]) {
						settings[option] = oldsettings[option];
					}
				}
				break;
		}
		return settings;
	}
};
