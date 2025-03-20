export const LINKS = {
	GITHUB: {
		value: "github",
		url: "https://github.com/blooooork",
		icon_path: "links/github_link.svg"
	},
	TWITCH: {
		value: "twitch",
		url: "https://www.twitch.tv/blooooork",
		icon_path: "links/twitch_link.svg"
	},
	LINKEDIN: {
		value: "linkedin",
		url: "https://www.linkedin.com/in/meiersteven",
		icon_path: "links/linkedin_link.svg"
	},
	TIKTOK: {
		value: "tiktok",
		url: "https://www.tiktok.com/@blooooork",
		icon_path: "links/tiktok_link.svg"
	}
};

// Attach the function as a non-enumerable property.
Object.defineProperty(LINKS, "get_link", {
	value: function(incoming_string) {
		for (const key in this) {
			// Ensure we only process objects that represent links
			if (this[key] && typeof this[key] === "object" && this[key].value === incoming_string) {
				return this[key].url;
			}
		}
		return null;
	},
	enumerable: false  // so that get_link is not included in iterations
});

Object.freeze(LINKS);