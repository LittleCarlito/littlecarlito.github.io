import { initState } from "../scene/state";
import { setupDropzones } from "./dropzone-util";

export function initalizeLandingPage() {
    initState();
    setupDropzones();
}