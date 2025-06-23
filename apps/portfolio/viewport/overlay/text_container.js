import { clamp } from 'three/src/math/MathUtils.js';
import { TextFrame, IFRAME } from './text_frame';
import { get_screen_size, get_associated_position, NORTH, SOUTH, EAST, WEST, CATEGORIES, extract_type, PAN_SPEED, TYPES, VALID_DIRECTIONS } from './overlay_common';
import { Easing, FLAGS, THREE, Tween } from '../../common';
import { 
	AssetStorage, 
	AssetHandler,
	MaterialFactory,
	CSS3DFactory,
	CustomTypeManager, 
	BLORKPACK_FLAGS 
}  from '@littlecarlito/blorkpack';

export class TextContainer {
	container_width;
	container_height;
	text_frames = new Map();
	css3d_frames = new Map();
	focused_text_name = "";
	particles = [];
	asset_handler;
	css3d_factory;
	#ASSET_TYPE = CustomTypeManager.getTypes();
	#ASSET_CONFIGS = CustomTypeManager.getConfigs();

	constructor(incoming_parent, incoming_camera) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.text_box_container = new THREE.Object3D();
		this.material_factory = new MaterialFactory();
		this.css3d_factory = new CSS3DFactory();
		this.asset_handler = AssetHandler.get_instance(this.parent, null);
		this.parent.add(this.text_box_container);
		
		console.log('TextContainer: Initializing with CSS3D frame management');

		const create_background = (incoming_category, incoming_box) => {
			this.container_width = this.get_text_box_width();
			this.container_height = this.get_text_box_height();
			const box_geometry = new THREE.BoxGeometry(this.container_width, this.container_height, .01);
			const box_material = new THREE.MeshBasicMaterial({
				color: incoming_category.color,
				depthTest: false,
				transparent: true
			});
			const text_box_background = new THREE.Mesh(box_geometry, box_material);
			text_box_background.name = `${TYPES.BACKGROUND}${incoming_category.value}`;
			text_box_background.renderOrder = -1;
			incoming_box.add(text_box_background);
		};

		const create_text_frame = (incoming_category, incoming_box) => {
			const new_frame = new TextFrame(incoming_box, this.camera, this.container_width, this.container_height);
			new_frame.simple_name = incoming_category.value;
			new_frame.name = `${TYPES.TEXT_BLOCK}${incoming_category.value}`;
			this.text_frames.set(new_frame.name, new_frame);
		};

		const create_asset_background = async (incoming_box, asset_type, options = {}) => {
			this.container_width = this.get_text_box_width();
			this.container_height = this.get_text_box_height();
			
			const config = {
				horizontalStretch: 1.0,
				verticalStretch: 1.0,
				position: new THREE.Vector3(0, 0, -0.05),
				positionOffsetX: 0,
				positionOffsetY: 0,
				positionOffsetZ: 0,
				scaleFactor: 0.12,
				...options
			};
			
			config.position.x += config.positionOffsetX;
			config.position.y += config.positionOffsetY;
			config.position.z += config.positionOffsetZ;

			const asset_config = this.#ASSET_CONFIGS[asset_type];
			if (!asset_config) {
				console.error(`No configuration found for asset type: ${asset_type}`);
				return null;
			}
			const gltf = await AssetStorage.get_instance().loader.loadAsync(asset_config.PATH);

			const asset = gltf.scene.clone();

			const asset_bounding_box = new THREE.Box3().setFromObject(asset);
			const asset_width = (asset_bounding_box.max.x - asset_bounding_box.min.x);
			const asset_height = asset_bounding_box.max.y - asset_bounding_box.min.y;

			const width_scale = this.container_width / asset_width * config.scaleFactor;
			const height_scale = this.container_height / asset_height * config.scaleFactor;

			const final_width_scale = width_scale * config.horizontalStretch;
			const final_height_scale = height_scale * config.verticalStretch;

			const base_scale = Math.min(final_width_scale, final_height_scale) * asset_config.scale;

			if (config.horizontalStretch !== config.verticalStretch) {
				const x_scale = base_scale * (config.horizontalStretch / config.verticalStretch);
				const y_scale = base_scale;
				asset.scale.set(x_scale, y_scale, base_scale);
			} else {
				asset.scale.set(base_scale, base_scale, base_scale);
			}

			asset.position.copy(config.position);

			if (config.rotation) {
				asset.rotation.copy(config.rotation);
			}

			let createdFrame = null;

			asset.traverse((child) => {
				if (child.isMesh) {
					if (child.name.startsWith('display_')){
						console.log(`TextContainer: Creating CSS3D frame for display mesh: ${child.name}, asset: ${asset_type}`);
						this.css3d_factory.createFrameOnDisplay(child, this.camera, document.body, asset_type, options.contentPath)
							.then(frameTracker => {
								console.log(`TextContainer: CSS3D frame created for ${asset_type}, storing reference`);
								this.css3d_frames.set(asset_type, frameTracker);
								createdFrame = frameTracker;
							});
					}
					else if (child.name.startsWith('col_')) {
						child.visible = false;
						return;
					}

					const original_material = child.material;
					if (FLAGS.ASSET_LOGS) console.log('Original material:', {
						name: child.name,
						map: original_material.map?.image?.src,
						color: original_material.color?.getHexString()
					});

					child.material = new THREE.MeshBasicMaterial();
					child.material.copy(original_material);
					child.material.needsUpdate = true;

					child.material.transparent = true;
					child.material.depthTest = false;
					child.material.side = THREE.DoubleSide;
					child.renderOrder = 998;

					if (FLAGS.ASSET_LOGS) console.log('New material:', {
						name: child.name,
						map: child.material.map?.image?.src,
						color: child.material.color?.getHexString()
					});
				}
			});

			this.material_factory.applyUnlitMaterial(asset);
			incoming_box.add(asset);
			return asset;
		};

		Object.values(CATEGORIES).forEach((category, i) => {
			if (typeof category === 'function') return;
			const text_box = new THREE.Object3D();
			text_box.position.x = get_associated_position(WEST, this.camera) * 2;
			text_box.position.y = this.get_text_box_y();
			text_box.simple_name = category.value;
			text_box.name = `${TYPES.TEXT}${category.value}`;
			if (FLAGS.LAYER) {
				text_box.layers.set(1);
			}
			this.text_box_container.add(text_box);

			switch (category.value) {
			case CATEGORIES.EDUCATION.value:
				const rotation = new THREE.Euler(-Math.PI / 2, Math.PI, Math.PI, 'XYZ');
				const position_one_offset = new THREE.Vector3(0, 3, 0);
				const position_two_offset = new THREE.Vector3(0, -3, 0);

				(async () => {
					const top_asset_config = this.#ASSET_CONFIGS[this.#ASSET_TYPE.DIPLOMA_TOP];
					const top_gltf = await AssetStorage.get_instance().loader.loadAsync(top_asset_config.PATH);

					[position_one_offset].forEach(position => {
						const top_diploma = top_gltf.scene.clone();
						top_diploma.scale.set(top_asset_config.ui_scale, top_asset_config.ui_scale, top_asset_config.ui_scale);
						top_diploma.position.copy(position);
						top_diploma.rotation.copy(rotation);
						if(BLORKPACK_FLAGS.ASSET_LOGS) {
							console.log('Top Diploma UI Scale:', top_asset_config.ui_scale);
							console.log('Top Diploma Applied Scale:', top_diploma.scale);
						}

						top_diploma.traverse((child) => {
							if (child.isMesh) {
								if (child.name.startsWith('col_')) {
									child.visible = false;
									return;
								}

								const originalMaterial = child.material;
								if (FLAGS.ASSET_LOGS) console.log('Original material:', {
									name: child.name,
									map: originalMaterial.map?.image?.src,
									color: originalMaterial.color.getHexString()
								});

								child.material = new THREE.MeshBasicMaterial();
								child.material.copy(originalMaterial);
								child.material.needsUpdate = true;

								child.material.transparent = true;
								child.material.depthTest = false;
								child.material.side = THREE.DoubleSide;
								child.renderOrder = 999;

								if (FLAGS.ASSET_LOGS) console.log('New material:', {
									name: child.name,
									map: child.material.map?.image?.src,
									color: child.material.color.getHexString()
								});
							}
						});
						this.material_factory.applyUnlitMaterial(top_diploma);
						text_box.add(top_diploma);
					});

					const bot_asset_config = this.#ASSET_CONFIGS[this.#ASSET_TYPE.DIPLOMA_BOT];
					const bot_gltf = await AssetStorage.get_instance().loader.loadAsync(bot_asset_config.PATH);

					[position_two_offset].forEach(position => {
						const bot_diploma = bot_gltf.scene.clone();
						bot_diploma.scale.set(bot_asset_config.ui_scale, bot_asset_config.ui_scale, bot_asset_config.ui_scale);
						bot_diploma.position.copy(position);
						bot_diploma.rotation.copy(rotation);
						if(BLORKPACK_FLAGS.ASSET_LOGS) {
							console.log('Bottom Diploma UI Scale:', bot_asset_config.ui_scale);
							console.log('Bottom Diploma Applied Scale:', bot_diploma.scale);
						}

						bot_diploma.traverse((child) => {
							if (child.isMesh) {
								if (child.name.startsWith('col_')) {
									child.visible = false;
									return;
								}

								const originalMaterial = child.material;
								if (FLAGS.ASSET_LOGS) console.log('Original material:', {
									name: child.name,
									map: originalMaterial.map?.image?.src,
									color: originalMaterial.color.getHexString()
								});

								child.material = new THREE.MeshBasicMaterial();
								child.material.copy(originalMaterial);
								child.material.needsUpdate = true;

								child.material.transparent = true;
								child.material.depthTest = false;
								child.material.side = THREE.DoubleSide;
								child.renderOrder = 999;

								if (FLAGS.ASSET_LOGS) console.log('New material:', {
									name: child.name,
									map: child.material.map?.image?.src,
									color: child.material.color.getHexString()
								});
							}
						});

						this.material_factory.applyUnlitMaterial(bot_diploma);
						text_box.add(bot_diploma);

					});
				})();
				if(BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log('Text Box Container Scale:', text_box.scale);
					console.log('Text Box Container Size:', text_box.geometry ? text_box.geometry.parameters : 'No geometry');
				}
				create_background(category, text_box);
				break;
			case CATEGORIES.CONTACT.value:
				(async () => {
					await create_asset_background(text_box, this.#ASSET_TYPE.TABLET, {
						horizontalStretch: 1.1,
						verticalStretch: 0.6,
						rotation: new THREE.Euler(-Math.PI / 2, 0, Math.PI, 'XYZ'),
						contentPath: '/pages/contact.html'
					});
				})();
				break;
			case CATEGORIES.ABOUT.value:
				(async () => {
					const aboutFrame = await this.css3d_factory.createCSS3DFrame(
						Math.floor(this.container_width * 50),
						Math.floor(this.container_height * 50),
						'/pages/about.html',
						text_box,
						'ABOUT'
					);
					this.css3d_frames.set('ABOUT', aboutFrame);
				})();
				create_background(category, text_box);
				break;
			case CATEGORIES.WORK.value:
				(async () => {
					await create_asset_background(text_box, this.#ASSET_TYPE.MONITOR, {
						horizontalStretch: 2,
						verticalStretch: 2,
						positionOffsetX: 2.85,
						positionOffsetY: -9.27,
						positionOffsetZ: 0,
						rotation: new THREE.Euler(Math.PI, Math.PI, Math.PI, 'XYZ'),
						contentPath: '/pages/work.html'
					});

					setTimeout(() => {
						const monitorModels = text_box.children.filter(child => child.name?.includes('monitor'));
						if (monitorModels.length > 0 && monitorModels[0].children.length > 0) {
							const monitorModel = monitorModels[0].children[0];
						}
					}, 100);
				})();
				break;
			default:
				create_background(category, text_box);
				create_text_frame(category, text_box);
				break;
			}
		});

		setTimeout(() => {
			const workFrame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${CATEGORIES.WORK.value}`);
			if (workFrame) {
				if (workFrame.original_width && workFrame.original_height) {
					workFrame.fixedWidth = workFrame.original_width;
					workFrame.fixedHeight = workFrame.original_height;
				}

				const monitorModels = this.text_box_container.children
					.filter(child => child.name?.includes('monitor'))
					.map(child => child.children[0]);
				if (monitorModels.length > 0 && monitorModels[0]) {
					const monitorModel = monitorModels[0];
					const textBoxPos = this.get_focused_text_x();
					workFrame.originalPositionOffset = monitorModel.position.x - textBoxPos;
					workFrame.positionInitialized = true;
					if (FLAGS.SELECT_LOGS) {
						console.log('Work frame initialized with fixed size:', {
							fixedWidth: workFrame.fixedWidth,
							fixedHeight: workFrame.fixedHeight,
							positionOffset: workFrame.originalPositionOffset
						});
					}
				}
			}
		}, 500);
	}

	focus_text_box(incoming_name, is_column_left) {
		const found_index = incoming_name.indexOf('_');
		const new_name = TYPES.TEXT + incoming_name.substring(found_index + 1);
		const category = incoming_name.substring(found_index + 1);
		
		if (FLAGS.SELECT_LOGS) {
			console.log('TextContainer: Focusing text box:', {
				incoming_name,
				new_name,
				category,
				available_frames: Array.from(this.text_frames.keys()),
				available_css3d_frames: Array.from(this.css3d_frames.keys()),
				is_column_left
			});
		}

		if (is_column_left) {
			if (FLAGS.SELECT_LOGS) {
				console.log('TextContainer: Cannot focus text box while column is on left side');
			}
			this.lose_focus_text_box(WEST);
			return;
		}

		if (new_name != this.focused_text_name) {
			if (this.focused_text_name != "") {
				const currentCategory = this.focused_text_name.replace(TYPES.TEXT, '');
				const currentFrame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${currentCategory}`);
				if (currentFrame && currentFrame.iframe.contentWindow) {
					try {
						currentFrame.iframe.contentWindow.postMessage(
							{ type: 'visibility', visible: false },
							'*'
						);
					} catch (e) {
						console.error('Error sending visibility message:', e);
					}

					if (currentFrame.simple_name === CATEGORIES.EDUCATION.value) {
						const visibilityEvent = new Event('visibilitychange');
						Object.defineProperty(currentFrame.iframe.contentDocument, 'hidden', {
							value: true,
							writable: false
						});
						currentFrame.iframe.contentDocument.dispatchEvent(visibilityEvent);
					}
				}
				this.lose_focus_text_box(SOUTH);
			}
			this.focused_text_name = new_name;

			const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${category}`);
			
			console.log(`TextContainer: Checking for CSS3D frame for category: ${category}`);
			const css3dFrame = this.css3d_frames.get(this.getCss3dAssetType(category));
			
			if (css3dFrame) {
				console.log(`TextContainer: Found CSS3D frame for ${category}, calling play()`);
				css3dFrame.play();
			} else {
				console.log(`TextContainer: No CSS3D frame found for category: ${category}`);
			}

			if (FLAGS.SELECT_LOGS) {
				console.log('Frame lookup:', {
					category,
					frameKey: `${TYPES.TEXT_BLOCK}${category}`,
					frameFound: !!frame,
					css3dFrameFound: !!css3dFrame,
					frameWindow: frame?.iframe?.contentWindow ? 'exists' : 'missing',
					hasAnimation: frame?.iframe?.contentWindow?.trigger_frame_animation ? 'yes' : 'no'
				});
			}

			if (frame && frame.iframe.contentWindow) {
				try {
					frame.iframe.contentWindow.postMessage(
						{ type: 'visibility', visible: true },
						'*'
					);
				} catch (e) {
					console.error('Error sending visibility message:', e);
				}

				if (typeof frame.iframe.contentWindow.trigger_frame_animation === 'function') {
					frame.iframe.contentWindow.trigger_frame_animation();
				}
			}

			if (category === CATEGORIES.WORK.value && frame) {
				const monitorModels = this.text_box_container.children
					.filter(child => child.name?.includes('monitor'))
					.map(child => child.children[0]);
				if (monitorModels.length > 0) {
					const monitorModel = monitorModels[0];
					const focusedX = this.get_focused_text_x();

					if (frame.originalPositionOffset !== undefined) {
						new Tween(monitorModel.position)
							.to({ x: focusedX + frame.originalPositionOffset }, 285)
							.easing(Easing.Sinusoidal.Out)
							.start();
						if (FLAGS.SELECT_LOGS) {
							console.log('Aligning monitor with work iframe:', {
								iframeX: focusedX,
								monitorX: focusedX + frame.originalPositionOffset,
								offset: frame.originalPositionOffset
							});
						}
					} else {
						const currentOffset = monitorModel.position.x - focusedX;
						frame.originalPositionOffset = currentOffset;
						if (FLAGS.SELECT_LOGS) {
							console.log('First-time monitor alignment:', {
								offset: currentOffset,
								monitorX: monitorModel.position.x,
								iframeX: focusedX
							});
						}
					}

					if (frame.fixedWidth && frame.fixedHeight) {
						setTimeout(() => {
							this.update_iframe_size(frame.simple_name, frame.fixedWidth, frame.fixedHeight);
						}, 300);
					}
				}
			}
		}

		const selected_text_box = this.text_box_container.getObjectByName(this.focused_text_name);
		if (selected_text_box) {
			if (FLAGS.LAYER) {
				this.set_content_layer(this.focused_text_name, 0);
			}
			new Tween(selected_text_box.position)
				.to({ x: this.get_focused_text_x() }, 285)
				.easing(Easing.Sinusoidal.Out)
				.start();
		} else if (FLAGS.SELECT_LOGS) {
			console.error(`Failed to find text box: ${this.focused_text_name}`);
		}
	}

	getCss3dAssetType(category) {
		switch (category) {
			case CATEGORIES.CONTACT.value:
				return this.#ASSET_TYPE.TABLET;
			case CATEGORIES.WORK.value:
				return this.#ASSET_TYPE.MONITOR;
			case CATEGORIES.ABOUT.value:
				return 'ABOUT';
			default:
				return null;
		}
	}

	lose_focus_text_box(move_direction = "") {
		if (this.focused_text_name != "") {
			if (move_direction == "" || VALID_DIRECTIONS.includes(move_direction)) {
				const existing_focus_box = this.text_box_container.getObjectByName(this.focused_text_name);

				const category = this.focused_text_name.replace(TYPES.TEXT, '');
				const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${category}`);
				if (frame && frame.iframe.contentWindow) {
					try {
						frame.iframe.contentWindow.postMessage(
							{ type: 'visibility', visible: false },
							'*'
						);
					} catch (e) {
						console.error('Error sending visibility message:', e);
					}
				}

				if (move_direction == "") {
					existing_focus_box.position.x = get_associated_position(WEST, this.camera);
				} else {
					const move_position = get_associated_position(move_direction, this.camera);
					const determined_speed = PAN_SPEED * .2;
					switch (move_direction) {
					case NORTH:
						new Tween(existing_focus_box.position)
							.to({ y: move_position }, determined_speed)
							.easing(Easing.Sinusoidal.Out)
							.start()
							.onComplete(() => {
								if (FLAGS.LAYER) {
									this.set_content_layer(existing_focus_box.name, 1);
								}
								existing_focus_box.position.y = this.get_text_box_y();
								existing_focus_box.position.x = get_associated_position(WEST, this.camera);
							});
						break;
					case SOUTH:
						new Tween(existing_focus_box.position)
							.to({ y: move_position }, determined_speed)
							.easing(Easing.Sinusoidal.Out)
							.start()
							.onComplete(() => {
								if (FLAGS.LAYER) {
									this.set_content_layer(existing_focus_box.name, 1);
								}
								existing_focus_box.position.y = this.get_text_box_y();
								existing_focus_box.position.x = 2 * get_associated_position(WEST, this.camera);
							});
						break;
					case EAST:
						new Tween(existing_focus_box.position)
							.to({ x: move_position }, determined_speed)
							.easing(Easing.Sinusoidal.Out)
							.start()
							.onComplete(() => {
								if (FLAGS.LAYER) {
									this.set_content_layer(existing_focus_box.name, 1);
								}
								existing_focus_box.position.x = (get_associated_position(WEST, this.camera))
							});
						break;
					case WEST:
						new Tween(existing_focus_box.position)
							.to({ x: move_position }, determined_speed)
							.easing(Easing.Sinusoidal.Out)
							.start().onComplete(() => {
								if (FLAGS.LAYER) {
									this.set_content_layer(existing_focus_box.name, 1);
								}
							});
						break;
					}
				}
				this.focused_text_name = "";
			}
		}
	}

	resize() {
		const prevWidth = this.container_width;
		const prevHeight = this.container_height;

		this.container_width = this.get_text_box_width(this.camera);
		this.container_height = this.get_text_box_height(this.camera);
		const new_text_geometry = new THREE.BoxGeometry(this.container_width, this.container_height, 0);
		this.text_box_container.children.forEach(c => {
			c.children.forEach(inner_c => {
				if (!inner_c || !inner_c.name) return;
				const type = extract_type(inner_c);
				switch (type) {
				case TYPES.BACKGROUND:
					inner_c.geometry.dispose();
					inner_c.geometry = new_text_geometry;
					break;
				case IFRAME:
					if (inner_c.simple_name) {
						let width = this.container_width;
						let height = this.container_height;

						const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${inner_c.simple_name}`);
						if (frame) {
							if (inner_c.simple_name === CATEGORIES.WORK.value) {
								const monitorModels = this.text_box_container.children
									.filter(child => child.name?.includes('monitor'))
									.map(child => child.children[0]);

								if (monitorModels.length > 0) {
									const monitorModel = monitorModels[0];

									if (!frame.positionInitialized && monitorModel) {
										if (!frame.fixedWidth && frame.original_width) {
											frame.fixedWidth = frame.original_width;
											frame.fixedHeight = frame.original_height;
										}

										const textBoxPos = this.get_focused_text_x();
										frame.originalPositionOffset = monitorModel.position.x - textBoxPos;
										frame.positionInitialized = true;
										if (FLAGS.SELECT_LOGS) {
											console.log('Work frame position initialized:', {
												monitorX: monitorModel.position.x,
												textBoxX: textBoxPos,
												offset: frame.originalPositionOffset,
												fixedWidth: frame.fixedWidth,
												fixedHeight: frame.fixedHeight
											});
										}
									}

									if (this.focused_text_name === `${TYPES.TEXT}${CATEGORIES.WORK.value}`) {
										const currentTextBoxPos = this.get_focused_text_x();
										const offset = frame.originalPositionOffset || 0.5;
										monitorModel.position.x = currentTextBoxPos + offset;
									}

									if (frame.fixedWidth && frame.fixedHeight) {
										width = frame.fixedWidth;
										height = frame.fixedHeight;
									} else if (frame.original_width && frame.original_height) {
										width = frame.original_width;
										height = frame.original_height;
									}
								}
							} else {
								if (frame.widthFactor) {
									width = this.container_width * frame.widthFactor;
									height = this.container_height * frame.heightFactor;
								}
							}

							this.update_iframe_size(inner_c.simple_name, width, height);
						}
					}
					break;
				}
			});
		});

		const aboutFrame = this.css3d_frames.get('ABOUT');
		if (aboutFrame) {
			const iframe = aboutFrame.frame.element;
			iframe.style.width = `${Math.floor(this.container_width * 50)}px`;
			iframe.style.height = `${Math.floor(this.container_height * 50)}px`;
		}
	}

	update_iframe_size(incoming_simple_name, incoming_width, incoming_height) {
		const matched_frame = Array.from(this.text_frames.values()).find(frame => (frame.simple_name == incoming_simple_name));
		if (matched_frame) {
			const previousWidth = matched_frame.pixel_width || 0;

			if (incoming_simple_name === CATEGORIES.WORK.value && matched_frame.fixedWidth) {
				incoming_width = matched_frame.fixedWidth;
				incoming_height = matched_frame.fixedHeight;
			}
			matched_frame.update_size(incoming_width, incoming_height);

			if (incoming_simple_name === CATEGORIES.CONTACT.value && matched_frame.iframe.contentWindow) {
				const isExtremeResize = previousWidth < 500 && matched_frame.pixel_width > 800;

				matched_frame.iframe.contentWindow.postMessage(
					isExtremeResize ? 'extreme-resize' : 'resize',
					'*'
				);

				if (isExtremeResize) {
					const tabletModels = this.text_box_container.children
						.filter(child => child.name?.includes('tablet'))
						.map(child => child.children[0]);
					if (tabletModels.length > 0) {
						tabletModels.forEach(model => {
							if (!model.userData.originalScale) {
								model.userData.originalScale = model.scale.clone();
							}

							const scaleMultiplier = 1.02;
							model.scale.set(
								model.userData.originalScale.x * scaleMultiplier,
								model.userData.originalScale.y * scaleMultiplier,
								model.userData.originalScale.z * scaleMultiplier
							);
						});
					}
				}
			}
		}
	}

	reposition(is_column_left) {
		if (this.focused_text_name != "") {
			this.focus_text_box(this.focused_text_name, is_column_left);

			if (this.focused_text_name === `${TYPES.TEXT}${CATEGORIES.WORK.value}`) {
				const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${CATEGORIES.WORK.value}`);
				if (frame) {
					const monitorModels = this.text_box_container.children
						.filter(child => child.name?.includes('monitor'))
						.map(child => child.children[0]);
					if (monitorModels.length > 0) {
						const monitorModel = monitorModels[0];
						const focusedX = this.get_focused_text_x();

						let offset = frame.originalPositionOffset;
						if (offset === undefined) {
							offset = monitorModel.position.x - focusedX;
							frame.originalPositionOffset = offset;
						}

						monitorModel.position.x = focusedX + offset;

						if (frame.fixedWidth && frame.fixedHeight) {
							this.update_iframe_size(frame.simple_name, frame.fixedWidth, frame.fixedHeight);
						}
					}
				}
			}
		}
		this.text_box_container.children.forEach(c => {
			if (c.name != this.focused_text_name) {
				c.position.x = get_associated_position(WEST, this.camera) * 2;
				c.position.y = this.get_text_box_y(this.camera);
			}
		});
	}

	offscreen_reposition() {
		const offscreen_x = -(this.container_width * 3);
		const y_position = this.get_text_box_y(this.camera);
		this.text_box_container.children.forEach(c => {
			if (this.focused_text_name && c.name === this.focused_text_name) {
				new Tween(c.position)
					.to({ x: this.get_focused_text_x(), y: y_position })
					.easing(Easing.Elastic.Out)
					.start();
			} else {
				c.position.x = offscreen_x;
				c.position.y = y_position;
			}
		});
	}

	set_content_layer(incoming_object_name, incoming_layer) {
		const existing_object = this.text_box_container.getObjectByName(incoming_object_name);
		existing_object.children.forEach(c => {
			c.layers.set(incoming_layer);
		});
	}

	get_focused_text_x() {
		return -(get_screen_size(this.camera).x / 2 * .36)
	}

	get_text_box_y() {
		return -(get_screen_size(this.camera).y * 0.05);
	}

	get_text_box_height() {
		return get_screen_size(this.camera).y * .6;
	}

	get_text_box_width() {
		return clamp(get_screen_size(this.camera).x * .5, 12, 18);
	}

	is_text_box_active() {
		return this.focused_text_name != "";
	}

	get_active_text_box() {
		return this.text_box_container.getObjectByName(this.focused_text_name);
	}

	trigger_overlay(is_overlay_hidden, tween_map) {
		const current_pos = this.text_box_container.position.clone();
		const target_y = is_overlay_hidden ? get_associated_position(SOUTH, this.camera) : this.get_text_box_y();
		if (FLAGS.TWEEN_LOGS) {
			console.log(`Text Container - Starting overlay animation:
                Hidden: ${is_overlay_hidden}
                Current Position: (${current_pos.x.toFixed(2)}, ${current_pos.y.toFixed(2)}, ${current_pos.z.toFixed(2)})
                Target Y: ${target_y.toFixed(2)}
                Map Size: ${tween_map.size}`);
		}
		if (!is_overlay_hidden && FLAGS.LAYER) {
			this.set_content_layer(0);
		}
		const new_tween = new Tween(this.text_box_container.position)
			.to({ y: target_y }, 680)
			.easing(Easing.Elastic.InOut)
			.start()
			.onComplete(() => {
				const final_pos = this.text_box_container.position.clone();
				if (FLAGS.TWEEN_LOGS) {
					console.log(`Text Container - Completed overlay animation:
                        Hidden: ${is_overlay_hidden}
                        Final Position: (${final_pos.x.toFixed(2)}, ${final_pos.y.toFixed(2)}, ${final_pos.z.toFixed(2)})`);
				}
				this.current_tween = null;
				if (is_overlay_hidden && FLAGS.LAYER) {
					this.set_content_layer(1);
				}
				tween_map.delete(this.text_box_container.name);
			});
		tween_map.set(this.text_box_container.name, new_tween);
	}
}