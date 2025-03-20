export const CATEGORIES = {
	CONTACT: {
		value: "contact",
		icon: "categories/contact_raised.svg",
		color: 0xe5ce38,
		html: "pages/contact.html"
	},
	PROJECTS: {
		value: "projects",
		icon: "categories/projects_raised.svg",
		color: 0x834eb4,
		html: "pages/projects.html"
	},
	WORK: {
		value: "work",
		icon: "categories/work_raised.svg",
		color: 0xb44444,
		html: "pages/work.html"
	},
	EDUCATION: {
		value: "education",
		icon: "categories/education_raised.svg",
		color: 0x25973a,
		html: "pages/education.html"
	},
	ABOUT: {
		value: "about",
		icon: "categories/about_raised.svg",
		color: 0x3851e5,
		html: "pages/about.html"
	}
};
// Helper methods
Object.defineProperty(CATEGORIES, "getValues", {
	value: function() {
		return Object.values(this).map(cat => cat.value);
	},
	enumerable: false
});
Object.defineProperty(CATEGORIES, "getIcons", {
	value: function() {
		return Object.values(this).map(cat => cat.icon);
	},
	enumerable: false
});
Object.defineProperty(CATEGORIES, "getColors", {
	value: function() {
		return Object.values(this).map(cat => cat.color);
	},
	enumerable: false
});
Object.defineProperty(CATEGORIES, "getHtmlPaths", {
	value: function() {
		return Object.values(this).map(cat => cat.html);
	},
	enumerable: false
});
Object.freeze(CATEGORIES);