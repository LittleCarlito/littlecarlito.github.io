import { GLTFLoader } from "three/examples/jsm/Addons.js";

export const GLTF_LOADER = new GLTFLoader();

// TODO Position needs to be a given parameter not a set variable
//          Can be a constant variable at the top of the files that is then passed in as parameter here

export const ASSETS = {
    AXE: {
        PATH: "assets/Axe.glb",
        scale: 20,
        mass: 5,
        restitution: .1,
    },
    DIPLOMA: {
        PATH: "assets/diploma.glb",
        scale: 10,
        mass: 1,
        restitution: .2,
    },
    DESK: {
        PATH: "assets/desk.glb",
        scale: 2,
        mass: 1,
        restitution: .5,
    }
}