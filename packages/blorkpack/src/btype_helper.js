/**
 * Takes a named object and returns the substring before '_' character
 * @param {*} incoming_object any named object
 * @returns Extracts the substring before '_' character
 */
export function extract_type(incoming_object) {
	if (!incoming_object || !incoming_object.name) {
		return "";
	}
	const split_intersected_name = incoming_object.name.split("_");
	const name_type = split_intersected_name[0] + "_";
	return name_type;
}