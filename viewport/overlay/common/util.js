import * as THREE from 'three';

export const TEXTURE_LOADER = new THREE.TextureLoader();
// Constants
export const PAN_SPEED = 800;
export const ROTATE_SPEED = 300;
export const FOCUS_ROTATION = .7;
export const LINK_RADIUS = .44;
export const HIDE_WIDTH = 1;
export const HIDE_HEIGHT = 1;
// Object types
export const CONATINER = "container_";
export const LABEL = "label_";
export const TEXT = "text_";
export const TEXT_BLOCK = "textblock_"
export const BACKGROUND = "background_"
export const LINK = "link_"
export const HIDE = "hide_"
// Links
export const LINK_PATHS = [
    "links/github_link.svg",
    "links/twitch_link.svg",
    "links/linkedin_link.svg",
    "links/tiktok_link.svg"
]
export const GITHUB = "github";
export const TWITCH = "twitch";
export const LINKEDIN = "linkedin";
export const TIKTOK = "tiktok";
export const LINK_LABELS = [
    GITHUB,
    TWITCH,
    LINKEDIN,
    TIKTOK
];
export const LINK_URLS = new Map();
LINK_URLS.set(GITHUB, "https://github.com/blooooork");
LINK_URLS.set(TWITCH, "https://www.twitch.tv/blooooork");
LINK_URLS.set(LINKEDIN, "https://www.linkedin.com/in/meiersteven");
LINK_URLS.set(TIKTOK, "https://www.tiktok.com/@blooooork");


/**
 * Takes a named object and returns the substring before '_' character
 * @param {*} incoming_object any named object
 * @returns Extracts the substring before '_' character
 */
export function extract_type(incoming_object) {
    console.log(`Incoming name ${incoming_object.name}`);
    const split_intersected_name = incoming_object.name.split("_");
    const name_type = split_intersected_name[0] + "_";
    if(name_type != "") {
        return name_type;
    }
}