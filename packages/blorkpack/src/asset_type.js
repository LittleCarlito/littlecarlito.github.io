import { THREE } from "./index.js";

const SCALE_FACTOR = 5;

// Define all possible asset types that can be loaded and spawned
export const ASSET_TYPE = {
    BOOK: 'BOOK',
    CAT: 'CAT',
    CHAIR: 'CHAIR',
    COMPUTER: 'COMPUTER',
    DESK: 'DESK',
    DESKPHOTO: 'about',
    DIPLOMA_BOT: 'education',
    DIPLOMA_TOP: 'DIPOLOMA_TOP',
    KEYBOARD: 'KEYBOARD',
    MONITOR: 'work',
    MOUSE: 'MOUSE',
    MOUSEPAD: 'MOUSEPAD',
    NOTEBOOK_CLOSED: 'NOTEBOOK_CLOSED',
    NOTEBOOK_OPENED: 'projects',
    PLANT: 'PLANT',
    TABLET: 'contact',
    ROOM: 'ROOM',
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    UNIQUE: 'unique'
};
Object.freeze(ASSET_TYPE);

// Configuration for each asset type, including model paths, physics properties, and scaling
export const ASSET_CONFIGS = {
    [ASSET_TYPE.BOOK]: {
        PATH: "assets/book.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1
    },
    [ASSET_TYPE.CAT]: {
        PATH: "assets/cat.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 3
    },
    [ASSET_TYPE.CHAIR]: {
        PATH: "assets/chair.glb",
        scale: SCALE_FACTOR,
        mass: 1.2,
        restitution: 1
    },
    [ASSET_TYPE.COMPUTER]: {
        PATH: "assets/computer.glb",
        scale: SCALE_FACTOR,
        mass: 8,
        restitution: 1
    },
    [ASSET_TYPE.DESK]: {
        PATH: "assets/desk.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: .5,
    },
    [ASSET_TYPE.DESKPHOTO]: {
        PATH: "assets/deskphoto.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1
    },
    [ASSET_TYPE.DIPLOMA_BOT]: {
        PATH: "assets/diploma_bot.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1,
        ui_scale: 10
    },
    [ASSET_TYPE.DIPLOMA_TOP]: {
        PATH: "assets/diploma_top.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1,
        ui_scale: 10
    },
    [ASSET_TYPE.KEYBOARD]: {
        PATH: "assets/keyboard.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: .2,
    },
    [ASSET_TYPE.MONITOR]: {
        PATH: "assets/monitor.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: .2,
        ui_scale: 10
    },
    [ASSET_TYPE.MOUSE]: {
        PATH: "assets/mouse.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: .2,
    },
    [ASSET_TYPE.MOUSEPAD]: {
        PATH: "assets/mousepad.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: .2,
    },
    [ASSET_TYPE.NOTEBOOK_CLOSED]: {
        PATH: "assets/notebook_closed.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1,
    },
    [ASSET_TYPE.NOTEBOOK_OPENED]: {
        PATH: "assets/notebook_open.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1,
    },
    [ASSET_TYPE.PLANT]: {
        PATH: "assets/plant.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1,
    },
    [ASSET_TYPE.TABLET]: {
        PATH: "assets/tablet.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: 1
    },
    // Load in room
    [ASSET_TYPE.ROOM]: {
        PATH: "assets/room.glb",
        scale: SCALE_FACTOR,
        mass: 1,
        restitution: .2
    }
}; 