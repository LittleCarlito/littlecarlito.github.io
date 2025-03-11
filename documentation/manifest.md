# Asset Configuration Manifest Documentation

## Overview

The manifest.json file provides a centralized configuration system for 3D assets in the ThreeJS application. It decouples asset configuration from code, making it easier to manage, update, and extend the application without code changes.

This document describes the structure and usage of the manifest.json file.

## File Structure

The manifest.json file has the following top-level structure:

```json
{
    "manifest_version": "1.0",
    "name": "Scene Configuration",
    "description": "Configuration for 3D scene and assets",
    "author": "",
    "created_date": "",
    "updated_date": "",
    "custom_types": [...],
    "asset_groups": [...],
    "application_assets": [...],
    "system_assets": [...],
    "scene_data": {...}
}
```

### Required Fields

Fields marked with `*` are required. All other fields are optional and will use default values if not provided.

## Custom Types

Custom types allow you to define reusable templates for different kinds of assets. Each custom type specifies the default properties that can be overridden by specific asset instances.

```json
{
    "name": "example_type", // * Required
    "version": "1.0",
    "load_layers": {
        "viewable": true,
        "collision": false,
        "display": false
    },
    "paths": {
        "asset": "path/to/model.glb",
        "script": "path/to/script.js"
    },
    "size": {
        "radius": 0,
        "width": 0,
        "height": 0,
        "depth": 0
    },
    "scale": {
        "x": 1,
        "y": 1,
        "z": 1,
        "ui": {
            "x": 1,
            "y": 1,
            "z": 1
        }
    },
    "physics": {
        "restitution": 1.0,
        "sleep_timer": 500,
        "mass": 1.0,
        "gravity_scale": 1.0,
        "friction": 0.5,
        "collision_groups": [],
        "collision_mask": []
    },
    "visual": {
        "emitting": false,
        "emission_color": "0xffffff",
        "emission_intensity": 1.0,
        "opacity": 1.0,
        "cast_shadow": false,
        "receive_shadow": true,
        "debug": {
            "enabled": true,
            "opacity": 0.6,
            "color": "0xffffff"
        }
    }
}
```

### Custom Type Properties

| Property | Description | Default |
|----------|-------------|---------|
| `name` | Unique identifier for the custom type | *Required* |
| `version` | Version of this custom type | "1.0" |
| `load_layers.viewable` | Whether the asset has a visible mesh | true |
| `load_layers.collision` | Whether the asset has a collision mesh | false |
| `load_layers.display` | Whether the asset has a display layer | false |
| `paths.asset` | Path to the 3D model file | "" |
| `paths.script` | Path to associated script file | "" |
| `size.radius` | Bounding radius for the asset | 0 |
| `size.width` | Width of the asset | 0 |
| `size.height` | Height of the asset | 0 |
| `size.depth` | Depth of the asset | 0 |
| `scale.x` | X scale factor | 1 |
| `scale.y` | Y scale factor | 1 |
| `scale.z` | Z scale factor | 1 |
| `scale.ui.x` | X scale factor for UI representation | 1 |
| `scale.ui.y` | Y scale factor for UI representation | 1 |
| `scale.ui.z` | Z scale factor for UI representation | 1 |
| `physics.restitution` | Bounciness factor (0-1) | 1.0 |
| `physics.sleep_timer` | Milliseconds before physics object sleeps | 500 |
| `physics.mass` | Mass in kg | 1.0 |
| `physics.gravity_scale` | Multiplier for gravity effect | 1.0 |
| `physics.friction` | Surface friction coefficient | 0.5 |
| `physics.collision_groups` | Groups this object belongs to | [] |
| `physics.collision_mask` | Groups this object collides with | [] |
| `visual.emitting` | Whether object emits light | false |
| `visual.emission_color` | Hex color code for emission | "0xffffff" |
| `visual.emission_intensity` | Intensity of emission | 1.0 |
| `visual.opacity` | Transparency (0-1) | 1.0 |
| `visual.cast_shadow` | Whether object casts shadows | false |
| `visual.receive_shadow` | Whether object receives shadows | true |
| `visual.debug.enabled` | Show debug visualization | true |
| `visual.debug.opacity` | Debug visualization opacity | 0.6 |
| `visual.debug.color` | Debug visualization color | "0xffffff" |

## Joint Data

Joints connect two physics objects together, constraining their relative movement. Both connected assets must declare matching joint data.

```json
{
    "type": "FIXED", // * Required - RAPIER joint type
    "position": {
        "x": 0,
        "y": 0,
        "z": 0
    },
    "rotation": {
        "x": 0,
        "y": 0,
        "z": 0
    },
    "target_id": "target_asset_id",
    "limits": {
        "angular": {
            "x": { "min": 0, "max": 0 },
            "y": { "min": 0, "max": 0 },
            "z": { "min": 0, "max": 0 }
        },
        "linear": {
            "x": { "min": 0, "max": 0 },
            "y": { "min": 0, "max": 0 },
            "z": { "min": 0, "max": 0 }
        }
    },
    "parameters": {
        "stiffness": 0,
        "damping": 0
    }
}
```

### Joint Types

Supported RAPIER joint types:
- `FIXED` - No relative movement
- `BALL` - Allows rotation in all directions
- `PRISMATIC` - Allows movement along one axis
- `REVOLUTE` - Allows rotation around one axis

## Asset Groups

Asset groups allow you to organize related assets and control them together.

```json
{
    "id": "group1", // * Required
    "name": "Furniture Group",
    "description": "All furniture assets",
    "tags": ["furniture", "indoor"],
    "assets": ["desk1", "chair1"],
    "active": true,
    "toggle_behavior": "ALL"
}
```

### Asset Group Properties

| Property | Description | Default |
|----------|-------------|---------|
| `id` | Unique identifier for the group | *Required* |
| `name` | Human-readable name | "" |
| `description` | Description of the group | "" |
| `tags` | Array of tag strings for filtering | [] |
| `assets` | Array of asset IDs in this group | [] |
| `active` | Whether the group is initially active | true |
| `toggle_behavior` | How assets activate ("ALL" or "SEQUENCE") | "ALL" |

## Asset Data

Asset data defines individual instances of assets in the scene.

```json
{
    "id": "desk1", // * Required
    "type": "CUSTOM", // * Required - SYSTEM or CUSTOM
    "asset_type": "desk", // * Required - matches custom_type or system type
    "version": "1.0",
    "config": {
        "collidable": true,
        "hidden": false,
        "disabled": false,
        "sleeping": true,
        "gravity": true,
        "interactable": true,
        "selectable": true,
        "highlightable": true
    },
    "tags": ["furniture", "workspace"],
    "group_id": "furniture_group",
    "joints": [],
    "parent": {},
    "children": [],
    "position": {
        "x": 0,
        "y": 0,
        "z": 0
    },
    "rotation": {
        "x": 0,
        "y": 0,
        "z": 0
    },
    "target": {
        "id": "target_id",
        "position": {
            "x": 0,
            "y": 0,
            "z": 0
        }
    },
    "additional_properties": {}
}
```

### Asset Data Properties

| Property | Description | Default |
|----------|-------------|---------|
| `id` | Unique identifier for the asset | *Required* |
| `type` | Either "SYSTEM" or "CUSTOM" | *Required* |
| `asset_type` | Type of asset (custom type name or system type) | *Required* |
| `version` | Version of this asset configuration | "1.0" |
| `config.collidable` | Whether the asset has collision | true |
| `config.hidden` | Whether the asset is visible | false |
| `config.disabled` | Whether the asset logic is enabled | false |
| `config.sleeping` | Whether physics starts in sleep state | true |
| `config.gravity` | Whether gravity affects this asset | true |
| `config.interactable` | Whether the asset can be picked up | true |
| `config.selectable` | Whether the asset can be selected | true |
| `config.highlightable` | Whether the asset can be highlighted | true |
| `tags` | Array of tag strings for filtering | [] |
| `group_id` | ID of asset group this asset belongs to | "" |
| `joints` | Array of joint data objects | [] |
| `parent` | Parent asset data (if any) | null |
| `children` | Array of child asset data | [] |
| `position.x` | X position in world space | 0 |
| `position.y` | Y position in world space | 0 |
| `position.z` | Z position in world space | 0 |
| `rotation.x` | X rotation in radians | 0 |
| `rotation.y` | Y rotation in radians | 0 |
| `rotation.z` | Z rotation in radians | 0 |

### Additional Properties

Additional properties provide specialized configuration for different asset types:

#### Lights
```json
"additional_properties": {
    "color": "0xffffff",
    "intensity": 1.0,
    "max_distance": 0,
    "angle": 0.5,
    "penumbra": 0.0,
    "sharpness": 0.0,
    "cast_shadows": true,
    "blur_samples": 8,
    "bias": 0.0,
    "normal_bias": 0.0
}
```

#### Cameras
```json
"additional_properties": {
    "fov": 75,
    "aspect_ratio": 1.6,
    "near_clipping": 0.1,
    "far_clipping": 10000.0
}
```

#### Animations
```json
"additional_properties": {
    "animations": [
        {
            "name": "idle",
            "autoplay": true,
            "loop": true,
            "duration": 2.0,
            "clamp": true
        }
    ]
}
```

## Scene Data

Scene data provides global configuration for the entire scene.

```json
{
    "version": "1.0",
    "name": "Main Scene",
    "description": "The main interactive scene",
    "base_url": "",
    "greeting_data": {
        "display": true,
        "modal_path": "pages/under_construction.html"
    },
    "background": {
        "type": "IMAGE",
        "image_path": "images/skybox.jpg"
    },
    "environment": {
        "gravity": {
            "x": 0.0,
            "y": 9.8,
            "z": 0.0
        },
        "ambient_light": {
            "color": "0xffffff",
            "intensity": 0.5
        },
        "fog": {
            "enabled": false,
            "color": "0xffffff",
            "near": 1,
            "far": 1000
        }
    },
    "physics": {
        "enabled": true,
        "update_rate": 60,
        "substeps": 1,
        "debug_draw": false
    },
    "rendering": {
        "shadows": true,
        "antialiasing": true,
        "tone_mapping_exposure": 1.0,
        "output_encoding": "sRGB_ENCODING"
    },
    "post_processing": {
        "enabled": false,
        "bloom": {
            "enabled": false,
            "strength": 0.5,
            "threshold": 0.9,
            "radius": 0.5
        },
        "ssao": {
            "enabled": false,
            "radius": 4,
            "intensity": 1.5,
            "blur": true
        }
    },
    "default_camera": {
        "position": {"x": 0, "y": 5, "z": 10},
        "target": {"x": 0, "y": 0, "z": 0},
        "fov": 75,
        "near": 0.1,
        "far": 1000,
        "controls": {
            "type": "ORBIT",
            "enable_damping": true,
            "damping_factor": 0.05,
            "min_distance": 1,
            "max_distance": 100,
            "min_polar_angle": 0,
            "max_polar_angle": 3.14159,
            "enable_zoom": true,
            "enable_rotate": true,
            "enable_pan": true
        }
    }
}
```

## Scene Data Properties

The top-level properties in the `scene_data` section define basic information about the scene.

| Property | Description | Default |
|----------|-------------|---------|
| `version` | Version of the scene data | "1.0" |
| `name` | Name of the scene | - |
| `description` | Description of the scene | - |
| `base_url` | Base URL for relative paths | "" |
| `greeting_data` | Configuration for greeting message display | - |
| `greeting_data.display` | Whether to show a greeting message | false |
| `greeting_data.modal_path` | Path to the modal HTML file to display (required if display is true) | - |

## Environment Properties

The `environment` section defines global environment settings for the scene.

| Property | Description | Default |
|----------|-------------|---------|
| `gravity.x` | X component of gravity vector | 0.0 |
| `gravity.y` | Y component of gravity vector (typically positive for downward gravity) | 9.8 |
| `gravity.z` | Z component of gravity vector | 0.0 |
| `ambient_light.color` | Hex color code for ambient light | "0xffffff" |
| `ambient_light.intensity` | Intensity of ambient light | 0.5 |
| `fog.enabled` | Whether fog is enabled | false |
| `fog.color` | Hex color code for fog | "0xffffff" |
| `fog.near` | Distance where fog starts | 1 |
| `fog.far` | Distance where fog is at maximum density | 1000 |

## Physics Properties

The `physics` section in `scene_data` defines global physics settings for the scene.

| Property | Description | Default |
|----------|-------------|---------|
| `physics.enabled` | Whether the physics engine is enabled | true |
| `physics.update_rate` | Physics update rate in Hz | 60 |
| `physics.substeps` | Number of substeps per physics update | 1 |
| `physics.debug_draw` | Whether to render physics debug visualization | false |
| `physics.allow_sleep` | Whether objects can sleep when inactive | true |
| `physics.linear_sleep_threshold` | Linear velocity threshold for sleep | 0.2 |
| `physics.angular_sleep_threshold` | Angular velocity threshold for sleep | 0.1 |
| `physics.sleep_threshold` | General sleep threshold | 0.1 |
| `physics.max_velocity_iterations` | Maximum velocity solver iterations | 2 |
| `physics.max_velocity_friction` | Maximum velocity iterations for friction | 4 |
| `physics.integration_parameters.dt` | Fixed timestep delta time | 0.01666667 |
| `physics.integration_parameters.erp` | Error reduction parameter | 0.8 |
| `physics.integration_parameters.warmstart_coeff` | Coefficient for warm starting | 0.8 |
| `physics.integration_parameters.allowed_linear_error` | Allowed linear error tolerance | 0.001 |

## Background Types

The `background` section in `scene_data` supports three different types of backgrounds:

### IMAGE Type
Use an image as the background:
```json
"background": {
    "type": "IMAGE",
    "image_path": "images/background.jpg"
}
```

### COLOR Type
Use a solid color as the background:
```json
"background": {
    "type": "COLOR",
    "color_value": "0x87CEEB"
}
```

### SKYBOX Type
Use a skybox as the background:
```json
"background": {
    "type": "SKYBOX",
    "skybox": {
        "enabled": true,
        "skybox_path": "images/skybox/"
    }
}
```

Note: Only include the properties relevant to the selected type. For example, if using the IMAGE type, only include the "type" and "image_path" properties.

## Usage Examples

### Basic Scene Configuration

```json
{
    "manifest_version": "1.0",
    "name": "Simple Scene",
    "custom_types": [],
    "asset_groups": [],
    "application_assets": [],
    "system_assets": [],
    "scene_data": {
        "version": "1.0",
        "background": {
            "color": "0x87CEEB"
        },
        "environment": {
            "gravity": {
                "x": 0.0,
                "y": 9.8,
                "z": 0.0
            },
            "ambient_light": {
                "color": "0xffffff",
                "intensity": 0.5
            }
        },
        "physics": {
            "enabled": true,
            "update_rate": 60,
            "allow_sleep": true,
            "linear_sleep_threshold": 0.2,
            "integration_parameters": {
                "erp": 0.8
            }
        }
    }
}
```

### Custom Type Example

```json
{
    "custom_types": [
        {
            "name": "furniture",
            "version": "1.0",
            "paths": {
                "asset": "assets/furniture.glb"
            },
            "physics": {
                "mass": 10.0,
                "restitution": 0.2,
                "gravity_scale": 1.0
            },
            "visual": {
                "cast_shadow": true,
                "receive_shadow": true
            }
        }
    ]
}
```

### Asset Instance Example

```json
{
    "application_assets": [
        {
            "id": "desk1",
            "type": "CUSTOM",
            "asset_type": "furniture",
            "config": {
                "interactable": false
            },
            "position": {
                "x": 0,
                "y": 0,
                "z": -3
            },
            "rotation": {
                "y": 1.57
            }
        }
    ]
}
```

## Best Practices

1. **Organize by Type**: Group similar assets using asset groups and custom types.
2. **Use Version Control**: Track changes to your manifest file with version numbers.
3. **Validate JSON**: Always validate your manifest JSON before deploying.
4. **Default Values**: Rely on default values for common properties to keep your manifest clean.
5. **Naming Conventions**: Use consistent naming patterns for IDs and asset types.

## Common Issues and Solutions

### Issue: Assets not appearing in scene
- Check that file paths are correct and relative to the base URL
- Verify the asset's "hidden" config is not set to true
- Ensure position values place the asset within the visible area

### Issue: Physics not working correctly
- Check that the physics engine is enabled in scene_data
- Verify mass, restitution, and other physics properties are appropriate
- Ensure colliding objects have compatible collision groups/masks

### Issue: Joints not connecting properly
- Both assets must declare matching joint data
- Verify the target_id refers to a valid asset ID
- Check that joint position and rotation are properly configured

## Schema Validation

For automated validation of your manifest file, consider using a JSON Schema validator with the accompanying schema file. This helps catch errors before they cause problems at runtime.