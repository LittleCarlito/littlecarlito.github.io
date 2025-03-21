import { THREE, RAPIER } from "../../../index.js";
import { BLORKPACK_FLAGS } from "../../../blorkpack_flags.js";
import { SystemAssetType } from "../../common/system_asset_types.js";
import { IdGenerator } from "../../common/id_generator.js";
import { AssetStorage } from "../../../asset_storage.js";

export { create_spotlight, create_spotlight_debug_mesh, update_debug_meshes, forceSpotlightDebugUpdate } from './spotlight_spawner.js';
export { create_primitive_box } from './box_spawner.js';
export { create_primitive_capsule } from './capsule_spawner.js';
export { create_primitive_cylinder } from './cylinder_spawner.js';
export { create_primitive_sphere } from './sphere_spawner.js';

export { THREE, RAPIER, BLORKPACK_FLAGS, SystemAssetType, IdGenerator, AssetStorage }; 