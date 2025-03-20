import { THREE } from "../../../common";
// Directions
export const NORTH = "north";
export const SOUTH = "south";
export const EAST = "east";
export const WEST = "west";
export const VALID_DIRECTIONS =[
	NORTH,
	SOUTH,
	EAST,
	WEST
]
/** Calculates screen size based off a distance of 15 */
export function get_screen_size(incoming_camera) {
	const screen_size = new THREE.Vector2();
	incoming_camera.getViewSize(15, screen_size);
	return screen_size;
}
/** Gets final location of assicated direction given current camera 
 ** incoming_direction must be a member of DIRECTIONS
*/
export function get_associated_position(incoming_direction, incoming_camera) {
	if(VALID_DIRECTIONS.includes(incoming_direction)) {
		const screen_size = get_screen_size(incoming_camera);
		switch(incoming_direction) {
		case NORTH:
			return screen_size.y;
		case SOUTH:
			return -screen_size.y;
		case EAST:
			return screen_size.x;
		case WEST:
			return -screen_size.x;
		}
	}
}