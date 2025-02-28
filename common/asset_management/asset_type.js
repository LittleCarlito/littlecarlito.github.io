import { THREE } from "..";

// Define all possible asset types that can be loaded and spawned
export const ASSET_TYPE = {
    AXE: 'AXE',
    DIPLOMA: 'education',
    DESK: 'DESK',
    CHAIR: 'CHAIR',
    BOOK: 'BOOK',
    ROOM: 'ROOM',
    TABLET: 'contact',
    DESKPHOTO: 'about',
    CUBE: 'CUBE',  // Simple geometric primitive for testing
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    UNIQUE: 'unique'
};
Object.freeze(ASSET_TYPE);

// Configuration for each asset type, including model paths, physics properties, and scaling
export const ASSET_CONFIGS = {
    [ASSET_TYPE.AXE]: {
        PATH: "assets/Axe.glb",
        scale: 20,
        mass: 5,
        restitution: .1,
    },
    [ASSET_TYPE.DIPLOMA]: {
        PATH: "assets/diploma_bot.glb",
        scale: 10,
        mass: 1,
        restitution: .2,
    },
    [ASSET_TYPE.DESK]: {
        PATH: "assets/desk.glb",
        scale: 2,
        mass: 1,
        restitution: .5,
    },
    // Load in room
    [ASSET_TYPE.ROOM]: {
        PATH: "assets/room.glb",
        scale: 5,
        mass: 1,
        restitution: .2
    },
    // Load in book
    [ASSET_TYPE.BOOK]: {
        PATH: "assets/book.glb",
        scale: 5,
        mass: 1,
        restitution: 1
    },
    // Load in chair
    [ASSET_TYPE.CHAIR]: {
        PATH: "assets/chair.glb",
        scale: 5,
        mass: 1.2,
        restitution: 1
    },
    [ASSET_TYPE.TABLET]: {
        PATH: "assets/tablet.glb",
        scale: 5,
        mass: 1,
        restitution: 1
    },
    [ASSET_TYPE.DESKPHOTO]: {
        PATH: "assets/deskphoto.glb",
        scale: 5,
        mass: 1,
        restitution: 1
    },
    [ASSET_TYPE.CUBE]: {
        // No PATH needed as it's a primitive
        scale: 1,
        mass: 1,
        restitution: 1.1,
        geometry: new THREE.BoxGeometry(1, 1, 1),
        // Function to create material - allows for dynamic color assignment
        create_material: (color) => new THREE.MeshStandardMaterial({ color: color })
    }
};
