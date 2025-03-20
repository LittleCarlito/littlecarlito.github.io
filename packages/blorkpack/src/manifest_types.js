/**
 * @fileoverview Type definitions for manifest.json structure
 * This file provides JSDoc type definitions for the manifest structure,
 * which can be used for documentation, reference, and type checking.
 */
/**
 * @typedef {Object} CustomType
 * @property {string} name - Unique name identifier for this custom type
 * @property {string} version - Version of the custom type
 * @property {Object} load_layers - Which layers to load for this asset type
 * @property {boolean} load_layers.viewable - Whether to load the viewable layer
 * @property {boolean} load_layers.collision - Whether to load the collision layer  
 * @property {boolean} load_layers.display - Whether to load the display layer
 * @property {Object} paths - Paths to associated resources
 * @property {string} paths.asset - Path to the 3D model file
 * @property {string} [paths.script] - Optional path to associated script
 * @property {Object} size - Physical size properties
 * @property {number} size.radius - Radius if applicable
 * @property {number} size.width - Width dimension
 * @property {number} size.height - Height dimension
 * @property {number} size.depth - Depth dimension
 * @property {Object} scale - Scaling factors for rendering
 * @property {number} scale.x - X-axis scale
 * @property {number} scale.y - Y-axis scale
 * @property {number} scale.z - Z-axis scale
 * @property {Object} [scale.ui] - UI-specific scaling
 * @property {number} scale.ui.x - UI X-axis scale
 * @property {number} scale.ui.y - UI Y-axis scale
 * @property {number} scale.ui.z - UI Z-axis scale
 * @property {Object} physics - Physics properties
 * @property {number} physics.restitution - Bounciness factor
 * @property {number} physics.sleep_timer - Time until object goes to sleep
 * @property {number} physics.mass - Object mass
 * @property {number} physics.gravity_scale - How much gravity affects this object
 * @property {number} physics.friction - Surface friction
 * @property {Array<string>} physics.collision_groups - Groups this object belongs to
 * @property {Array<string>} physics.collision_mask - Groups this object collides with
 * @property {Object} visual - Visual properties
 * @property {boolean} visual.emitting - Whether object emits light
 * @property {string} visual.emission_color - Hex color code for emission
 * @property {number} visual.emission_intensity - Intensity of emission
 * @property {number} visual.opacity - Object opacity
 * @property {boolean} visual.cast_shadow - Whether object casts shadows
 * @property {boolean} visual.receive_shadow - Whether object receives shadows
 * @property {Object} visual.debug - Debug visualization properties
 * @property {boolean} visual.debug.enabled - Whether debug visualization is enabled
 * @property {number} visual.debug.opacity - Debug visualization opacity
 * @property {string} visual.debug.color - Hex color code for debug visualization
 */
/**
 * @typedef {Object} JointData
 * @property {string} type - Joint type (FIXED, REVOLUTE, etc.)
 * @property {Vector3} position - Joint position
 * @property {Vector3} rotation - Joint rotation
 * @property {string} target_id - ID of target object
 * @property {Object} limits - Joint constraints
 * @property {Object} limits.angular - Angular limits
 * @property {Object} limits.angular.x - X-axis angular limits
 * @property {number} limits.angular.x.min - Minimum X-axis angle
 * @property {number} limits.angular.x.max - Maximum X-axis angle
 * @property {Object} limits.angular.y - Y-axis angular limits
 * @property {number} limits.angular.y.min - Minimum Y-axis angle
 * @property {number} limits.angular.y.max - Maximum Y-axis angle
 * @property {Object} limits.angular.z - Z-axis angular limits
 * @property {number} limits.angular.z.min - Minimum Z-axis angle
 * @property {number} limits.angular.z.max - Maximum Z-axis angle
 * @property {Object} limits.linear - Linear limits
 * @property {Object} limits.linear.x - X-axis linear limits
 * @property {number} limits.linear.x.min - Minimum X-axis position
 * @property {number} limits.linear.x.max - Maximum X-axis position
 * @property {Object} limits.linear.y - Y-axis linear limits
 * @property {number} limits.linear.y.min - Minimum Y-axis position
 * @property {number} limits.linear.y.max - Maximum Y-axis position
 * @property {Object} limits.linear.z - Z-axis linear limits
 * @property {number} limits.linear.z.min - Minimum Z-axis position
 * @property {number} limits.linear.z.max - Maximum Z-axis position
 * @property {Object} parameters - Additional joint parameters
 * @property {number} parameters.stiffness - Joint stiffness
 * @property {number} parameters.damping - Joint damping
 */
/**
 * @typedef {Object} AssetGroup
 * @property {string} id - Unique identifier for the group
 * @property {string} name - Display name
 * @property {string} description - Description of the group
 * @property {Array<string>} tags - Tags for filtering/categorization
 * @property {Array<string>} assets - IDs of assets in this group
 * @property {boolean} active - Whether the group is active
 * @property {string} toggle_behavior - Behavior when toggling (ALL, ONE_AT_A_TIME, etc.)
 */
/**
 * @typedef {Object} Vector3
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} z - Z coordinate
 */
/**
 * @typedef {Object} AssetConfig
 * @property {boolean} collidable - Whether the asset can collide
 * @property {boolean} hidden - Whether the asset is hidden
 * @property {boolean} disabled - Whether the asset is disabled
 * @property {boolean} sleeping - Whether the asset starts in sleep state
 * @property {boolean} gravity - Whether the asset is affected by gravity
 * @property {boolean} interactable - Whether the asset can be interacted with
 * @property {boolean} selectable - Whether the asset can be selected
 * @property {boolean} highlightable - Whether the asset can be highlighted
 */
/**
 * @typedef {Object} AssetData
 * @property {string} id - Unique identifier
 * @property {string} type - Asset type (CUSTOM, PRIMITIVE, etc.)
 * @property {string} asset_type - Reference to custom type if type is CUSTOM
 * @property {string} version - Asset version
 * @property {AssetConfig} config - Asset configuration
 * @property {Array<string>} tags - Tags for filtering/categorization
 * @property {string} group_id - ID of the group this asset belongs to
 * @property {Array<JointData>} joints - Joint data for connected assets
 * @property {Object} parent - Parent asset reference
 * @property {Array<Object>} children - Child assets
 * @property {Vector3} position - Position in 3D space
 * @property {Vector3} rotation - Rotation in 3D space
 * @property {Object} target - Target information
 * @property {string} target.id - ID of target asset
 * @property {Vector3} target.position - Position of target
 * @property {Object} additional_properties - Extra properties specific to asset type
 * @property {string} [additional_properties.color] - Color in hex format
 * @property {number} [additional_properties.intensity] - Light intensity
 * @property {number} [additional_properties.max_distance] - Maximum distance (0 = unlimited)
 * @property {number} [additional_properties.angle] - Spotlight cone angle
 * @property {number} [additional_properties.penumbra] - Spotlight edge softness
 * @property {number} [additional_properties.sharpness] - Spotlight sharpness
 * @property {boolean} [additional_properties.cast_shadows] - Whether it casts shadows
 * @property {boolean} [additional_properties.receive_shadows] - Whether it receives shadows
 * @property {Object} [additional_properties.shadow] - Shadow configuration
 * @property {number} [additional_properties.shadow.blur_samples] - Number of blur samples
 * @property {number} [additional_properties.shadow.radius] - Blur radius
 * @property {Object} [additional_properties.shadow.map_size] - Shadow map dimensions
 * @property {number} [additional_properties.shadow.map_size.width] - Shadow map width
 * @property {number} [additional_properties.shadow.map_size.height] - Shadow map height
 * @property {Object} [additional_properties.shadow.camera] - Shadow camera settings
 * @property {number} [additional_properties.shadow.camera.near] - Shadow camera near plane
 * @property {number} [additional_properties.shadow.camera.far] - Shadow camera far plane
 * @property {number} [additional_properties.shadow.camera.fov] - Shadow camera field of view
 * @property {number} [additional_properties.shadow.bias] - Shadow bias
 * @property {number} [additional_properties.shadow.normal_bias] - Shadow normal bias
 * @property {number} [additional_properties.fov] - Field of view for cameras
 * @property {number} [additional_properties.near] - Near clipping plane
 * @property {number} [additional_properties.far] - Far clipping plane
 * @property {number} [additional_properties.aspect_ratio] - Camera aspect ratio
 * @property {number} [additional_properties.near_clipping] - Near clipping distance
 * @property {number} [additional_properties.far_clipping] - Far clipping distance
 * @property {Object} [additional_properties.physical_dimensions] - Physical dimensions
 * @property {number} [additional_properties.physical_dimensions.width] - Width
 * @property {number} [additional_properties.physical_dimensions.height] - Height
 * @property {number} [additional_properties.physical_dimensions.depth] - Depth
 * @property {Object} [additional_properties.collider_dimensions] - Collider dimensions
 * @property {number} [additional_properties.collider_dimensions.width] - Collider width
 * @property {number} [additional_properties.collider_dimensions.height] - Collider height
 * @property {number} [additional_properties.collider_dimensions.depth] - Collider depth
 * @property {number} [additional_properties.restitution] - Bounciness factor
 * @property {number} [additional_properties.mass] - Physics mass
 * @property {number} [additional_properties.friction] - Surface friction
 * @property {boolean} [additional_properties.raycast_disabled] - Whether raycast is disabled
 * @property {Array} [additional_properties.animations] - Animation configurations
 */
/**
 * @typedef {Object} SceneData
 * @property {string} version - Scene data version
 * @property {string} name - Scene name
 * @property {string} description - Scene description
 * @property {string} base_url - Base URL for assets
 * @property {Object} greeting_data - Configuration for greeting message display
 * @property {boolean} greeting_data.display - Whether to show a greeting message
 * @property {string} greeting_data.modal_path - Path to the modal HTML file to display (required if display is true)
 * @property {Object} background - Background settings
 * @property {string} background.type - Type of background (IMAGE, COLOR, or SKYBOX)
 * @property {string} background.image_path - Path to background image (only include when type is IMAGE)
 * @property {string} background.color_value - Background color hex (only include when type is COLOR)
 * @property {Object} background.skybox - Skybox settings (only include when type is SKYBOX)
 * @property {boolean} background.skybox.enabled - Whether skybox is enabled
 * @property {string} background.skybox.skybox_path - Path to skybox
 * @property {Object} environment - Environment settings
 * @property {Vector3} environment.gravity - Gravity vector
 * @property {Object} environment.ambient_light - Ambient light settings
 * @property {string} environment.ambient_light.color - Light color hex
 * @property {number} environment.ambient_light.intensity - Light intensity
 * @property {Object} environment.fog - Fog settings
 * @property {boolean} environment.fog.enabled - Whether fog is enabled
 * @property {string} environment.fog.color - Fog color hex
 * @property {number} environment.fog.near - Near fog distance
 * @property {number} environment.fog.far - Far fog distance
 * @property {Object} physics - Physics settings
 * @property {boolean} physics.enabled - Whether physics is enabled
 * @property {number} physics.update_rate - Physics update rate
 * @property {number} physics.substeps - Physics substeps
 * @property {boolean} physics.debug_draw - Whether to draw debug visualization
 * @property {boolean} physics.allow_sleep - Whether to allow objects to sleep when inactive
 * @property {number} physics.linear_sleep_threshold - Threshold for linear velocity sleep determination
 * @property {number} physics.angular_sleep_threshold - Threshold for angular velocity sleep determination
 * @property {number} physics.sleep_threshold - General sleep threshold
 * @property {number} physics.max_velocity_iterations - Maximum velocity solver iterations
 * @property {number} physics.max_velocity_friction - Maximum velocity iterations for friction
 * @property {Object} physics.integration_parameters - Physics integration parameters
 * @property {number} physics.integration_parameters.dt - Fixed timestep delta time
 * @property {number} physics.integration_parameters.erp - Error reduction parameter
 * @property {number} physics.integration_parameters.warmstart_coeff - Coefficient for warm starting
 * @property {number} physics.integration_parameters.allowed_linear_error - Allowed linear error tolerance
 * @property {Object} rendering - Rendering settings
 * @property {boolean} rendering.shadows - Whether to enable shadows
 * @property {boolean} rendering.antialiasing - Whether to enable antialiasing
 * @property {number} rendering.tone_mapping_exposure - Tone mapping exposure
 * @property {string} rendering.output_encoding - Output encoding
 * @property {Object} post_processing - Post-processing settings
 * @property {boolean} post_processing.enabled - Whether post-processing is enabled
 * @property {Object} post_processing.bloom - Bloom effect settings
 * @property {boolean} post_processing.bloom.enabled - Whether bloom is enabled
 * @property {number} post_processing.bloom.strength - Bloom strength
 * @property {number} post_processing.bloom.threshold - Bloom threshold
 * @property {number} post_processing.bloom.radius - Bloom radius
 * @property {Object} post_processing.ssao - SSAO effect settings
 * @property {boolean} post_processing.ssao.enabled - Whether SSAO is enabled
 * @property {number} post_processing.ssao.radius - SSAO radius
 * @property {number} post_processing.ssao.intensity - SSAO intensity
 * @property {boolean} post_processing.ssao.blur - Whether to blur SSAO
 * @property {Object} default_camera - Default camera settings
 * @property {Vector3} default_camera.position - Camera position
 * @property {Vector3} default_camera.target - Camera target
 * @property {number} default_camera.fov - Field of view
 * @property {number} default_camera.near - Near clipping plane
 * @property {number} default_camera.far - Far clipping plane
 * @property {number} default_camera.ui_distance - Distance for UI placement in front of camera
 * @property {Object} default_camera.controls - Camera controls
 * @property {string} default_camera.controls.type - Control type (ORBIT, FLY, etc.)
 * @property {boolean} default_camera.controls.enable_damping - Whether to enable damping
 * @property {number} default_camera.controls.damping_factor - Damping factor
 * @property {number} default_camera.controls.min_distance - Minimum distance
 * @property {number} default_camera.controls.max_distance - Maximum distance
 * @property {number} default_camera.controls.min_polar_angle - Minimum polar angle
 * @property {number} default_camera.controls.max_polar_angle - Maximum polar angle
 * @property {boolean} default_camera.controls.enable_zoom - Whether to enable zoom
 * @property {boolean} default_camera.controls.enable_rotate - Whether to enable rotation
 * @property {boolean} default_camera.controls.enable_pan - Whether to enable panning
 * @property {Object} default_camera.shoulder_lights - Shoulder light settings
 * @property {boolean} default_camera.shoulder_lights.enabled - Whether shoulder lights are enabled
 * @property {Object} default_camera.shoulder_lights.left - Left shoulder light settings
 * @property {Object} default_camera.shoulder_lights.left.position - Position of left shoulder light
 * @property {number} default_camera.shoulder_lights.left.position.x - X position
 * @property {number} default_camera.shoulder_lights.left.position.y - Y position
 * @property {number} default_camera.shoulder_lights.left.position.z - Z position
 * @property {Object} default_camera.shoulder_lights.left.rotation - Rotation of left shoulder light
 * @property {number} default_camera.shoulder_lights.left.rotation.pitch - Pitch rotation 
 * @property {number} default_camera.shoulder_lights.left.rotation.yaw - Yaw rotation
 * @property {number} default_camera.shoulder_lights.left.angle - Angle of left spotlight cone
 * @property {number} default_camera.shoulder_lights.left.max_distance - Maximum distance (0 = unlimited)
 * @property {number} default_camera.shoulder_lights.left.intensity - Light intensity
 * @property {Object} default_camera.shoulder_lights.right - Right shoulder light settings
 * @property {Object} default_camera.shoulder_lights.right.position - Position of right shoulder light
 * @property {number} default_camera.shoulder_lights.right.position.x - X position
 * @property {number} default_camera.shoulder_lights.right.position.y - Y position
 * @property {number} default_camera.shoulder_lights.right.position.z - Z position
 * @property {Object} default_camera.shoulder_lights.right.rotation - Rotation of right shoulder light
 * @property {number} default_camera.shoulder_lights.right.rotation.pitch - Pitch rotation
 * @property {number} default_camera.shoulder_lights.right.rotation.yaw - Yaw rotation
 * @property {number} default_camera.shoulder_lights.right.angle - Angle of right spotlight cone
 * @property {number} default_camera.shoulder_lights.right.max_distance - Maximum distance (0 = unlimited)
 * @property {number} default_camera.shoulder_lights.right.intensity - Light intensity
 */
/**
 * @typedef {Object} Manifest
 * @property {string} manifest_version - Version of the manifest format
 * @property {string} name - Manifest name
 * @property {string} description - Manifest description
 * @property {string} author - Author of the manifest
 * @property {string} created_date - Creation date
 * @property {string} updated_date - Last update date
 * @property {Array<CustomType>} custom_types - Custom type definitions
 * @property {JointData} joint_data - Joint data for connecting assets
 * @property {Array<AssetGroup>} asset_groups - Asset groups
 * @property {Object<string, AssetData>} asset_data - Asset data indexed by ID
 * @property {Array<Object>} application_assets - Application-specific assets
 * @property {Array<Object>} system_assets - System assets
 * @property {SceneData} scene_data - Scene configuration
 */
// Export the type definitions
export const MANIFEST_TYPES = {
	// This empty object helps with imports
};
// Export symbols for documentation purposes
export const typeDefs = {
	Manifest: '/** @type {Manifest} */',
	CustomType: '/** @type {CustomType} */',
	JointData: '/** @type {JointData} */',
	AssetGroup: '/** @type {AssetGroup} */',
	AssetData: '/** @type {AssetData} */',
	SceneData: '/** @type {SceneData} */'
}; 