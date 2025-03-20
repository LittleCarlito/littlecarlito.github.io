import * as M from "three";
import { Controls as dt, Vector3 as N, MOUSE as J, TOUCH as Q, Quaternion as de, Spherical as De, Vector2 as k, Ray as ut, Plane as ht, MathUtils as Ye, TrianglesDrawMode as pt, TriangleFanDrawMode as Te, TriangleStripDrawMode as Ze, Loader as ft, LoaderUtils as oe, FileLoader as qe, MeshPhysicalMaterial as G, Color as Y, LinearSRGBColorSpace as K, SRGBColorSpace as ie, SpotLight as mt, PointLight as gt, DirectionalLight as yt, Matrix4 as ue, InstancedMesh as xt, InstancedBufferAttribute as bt, Object3D as Qe, TextureLoader as Tt, ImageBitmapLoader as _t, BufferAttribute as pe, InterleavedBuffer as Et, InterleavedBufferAttribute as At, LinearMipmapLinearFilter as Je, NearestMipmapLinearFilter as wt, LinearMipmapNearestFilter as Mt, NearestMipmapNearestFilter as St, LinearFilter as _e, NearestFilter as et, RepeatWrapping as Ee, MirroredRepeatWrapping as Rt, ClampToEdgeWrapping as Lt, PointsMaterial as vt, Material as fe, LineBasicMaterial as Ct, MeshStandardMaterial as tt, DoubleSide as It, MeshBasicMaterial as se, PropertyBinding as Dt, BufferGeometry as Nt, SkinnedMesh as Ot, Mesh as Pt, LineSegments as Ut, Line as kt, LineLoop as Ft, Points as jt, Group as me, PerspectiveCamera as Bt, OrthographicCamera as Ht, Skeleton as zt, AnimationClip as Gt, Bone as Vt, InterpolateDiscrete as Kt, InterpolateLinear as nt, Texture as Ne, VectorKeyframeTrack as Oe, NumberKeyframeTrack as Pe, QuaternionKeyframeTrack as Ue, ColorManagement as ke, FrontSide as $t, Interpolant as Wt, Box3 as Xt, Sphere as Yt } from "three";
const Fe = { type: "change" }, ve = { type: "start" }, st = { type: "end" }, le = new ut(), je = new ht(), Zt = Math.cos(70 * Ye.DEG2RAD), I = new N(), O = 2 * Math.PI, S = {
		NONE: -1,
		ROTATE: 0,
		DOLLY: 1,
		PAN: 2,
		TOUCH_ROTATE: 3,
		TOUCH_PAN: 4,
		TOUCH_DOLLY_PAN: 5,
		TOUCH_DOLLY_ROTATE: 6
	}, ge = 1e-6;
/**
 *
 */
class Ce extends dt {
	/**
	 *
	 */
	constructor(e, t = null) {
		super(e, t), this.state = S.NONE, this.enabled = !0, this.target = new N(), this.cursor = new N(), this.minDistance = 0, this.maxDistance = 1 / 0, this.minZoom = 0, this.maxZoom = 1 / 0, this.minTargetRadius = 0, this.maxTargetRadius = 1 / 0, this.minPolarAngle = 0, this.maxPolarAngle = Math.PI, this.minAzimuthAngle = -1 / 0, this.maxAzimuthAngle = 1 / 0, this.enableDamping = !1, this.dampingFactor = 0.05, this.enableZoom = !0, this.zoomSpeed = 1, this.enableRotate = !0, this.rotateSpeed = 1, this.keyRotateSpeed = 1, this.enablePan = !0, this.panSpeed = 1, this.screenSpacePanning = !0, this.keyPanSpeed = 7, this.zoomToCursor = !1, this.autoRotate = !1, this.autoRotateSpeed = 2, this.keys = { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" }, this.mouseButtons = { LEFT: J.ROTATE, MIDDLE: J.DOLLY, RIGHT: J.PAN }, this.touches = { ONE: Q.ROTATE, TWO: Q.DOLLY_PAN }, this.target0 = this.target.clone(), this.position0 = this.object.position.clone(), this.zoom0 = this.object.zoom, this._domElementKeyEvents = null, this._lastPosition = new N(), this._lastQuaternion = new de(), this._lastTargetPosition = new N(), this._quat = new de().setFromUnitVectors(e.up, new N(0, 1, 0)), this._quatInverse = this._quat.clone().invert(), this._spherical = new De(), this._sphericalDelta = new De(), this._scale = 1, this._panOffset = new N(), this._rotateStart = new k(), this._rotateEnd = new k(), this._rotateDelta = new k(), this._panStart = new k(), this._panEnd = new k(), this._panDelta = new k(), this._dollyStart = new k(), this._dollyEnd = new k(), this._dollyDelta = new k(), this._dollyDirection = new N(), this._mouse = new k(), this._performCursorZoom = !1, this._pointers = [], this._pointerPositions = {}, this._controlActive = !1, this._onPointerMove = Qt.bind(this), this._onPointerDown = qt.bind(this), this._onPointerUp = Jt.bind(this), this._onContextMenu = an.bind(this), this._onMouseWheel = nn.bind(this), this._onKeyDown = sn.bind(this), this._onTouchStart = on.bind(this), this._onTouchMove = rn.bind(this), this._onMouseDown = en.bind(this), this._onMouseMove = tn.bind(this), this._interceptControlDown = ln.bind(this), this._interceptControlUp = cn.bind(this), this.domElement !== null && this.connect(), this.update();
	}
	/**
	 *
	 */
	connect() {
		this.domElement.addEventListener("pointerdown", this._onPointerDown), this.domElement.addEventListener("pointercancel", this._onPointerUp), this.domElement.addEventListener("contextmenu", this._onContextMenu), this.domElement.addEventListener("wheel", this._onMouseWheel, { passive: !1 }), this.domElement.getRootNode().addEventListener("keydown", this._interceptControlDown, { passive: !0, capture: !0 }), this.domElement.style.touchAction = "none";
	}
	/**
	 *
	 */
	disconnect() {
		this.domElement.removeEventListener("pointerdown", this._onPointerDown), this.domElement.removeEventListener("pointermove", this._onPointerMove), this.domElement.removeEventListener("pointerup", this._onPointerUp), this.domElement.removeEventListener("pointercancel", this._onPointerUp), this.domElement.removeEventListener("wheel", this._onMouseWheel), this.domElement.removeEventListener("contextmenu", this._onContextMenu), this.stopListenToKeyEvents(), this.domElement.getRootNode().removeEventListener("keydown", this._interceptControlDown, { capture: !0 }), this.domElement.style.touchAction = "auto";
	}
	/**
	 *
	 */
	dispose() {
		this.disconnect();
	}
	/**
	 *
	 */
	getPolarAngle() {
		return this._spherical.phi;
	}
	/**
	 *
	 */
	getAzimuthalAngle() {
		return this._spherical.theta;
	}
	/**
	 *
	 */
	getDistance() {
		return this.object.position.distanceTo(this.target);
	}
	/**
	 *
	 */
	listenToKeyEvents(e) {
		e.addEventListener("keydown", this._onKeyDown), this._domElementKeyEvents = e;
	}
	/**
	 *
	 */
	stopListenToKeyEvents() {
		this._domElementKeyEvents !== null && (this._domElementKeyEvents.removeEventListener("keydown", this._onKeyDown), this._domElementKeyEvents = null);
	}
	/**
	 *
	 */
	saveState() {
		this.target0.copy(this.target), this.position0.copy(this.object.position), this.zoom0 = this.object.zoom;
	}
	/**
	 *
	 */
	reset() {
		this.target.copy(this.target0), this.object.position.copy(this.position0), this.object.zoom = this.zoom0, this.object.updateProjectionMatrix(), this.dispatchEvent(Fe), this.update(), this.state = S.NONE;
	}
	/**
	 *
	 */
	update(e = null) {
		const t = this.object.position;
		I.copy(t).sub(this.target), I.applyQuaternion(this._quat), this._spherical.setFromVector3(I), this.autoRotate && this.state === S.NONE && this._rotateLeft(this._getAutoRotationAngle(e)), this.enableDamping ? (this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor, this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor) : (this._spherical.theta += this._sphericalDelta.theta, this._spherical.phi += this._sphericalDelta.phi);
		let o = this.minAzimuthAngle, s = this.maxAzimuthAngle;
		isFinite(o) && isFinite(s) && (o < -Math.PI ? o += O : o > Math.PI && (o -= O), s < -Math.PI ? s += O : s > Math.PI && (s -= O), o <= s ? this._spherical.theta = Math.max(o, Math.min(s, this._spherical.theta)) : this._spherical.theta = this._spherical.theta > (o + s) / 2 ? Math.max(o, this._spherical.theta) : Math.min(s, this._spherical.theta)), this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi)), this._spherical.makeSafe(), this.enableDamping === !0 ? this.target.addScaledVector(this._panOffset, this.dampingFactor) : this.target.add(this._panOffset), this.target.sub(this.cursor), this.target.clampLength(this.minTargetRadius, this.maxTargetRadius), this.target.add(this.cursor);
		let i = !1;
		if (this.zoomToCursor && this._performCursorZoom || this.object.isOrthographicCamera)
			this._spherical.radius = this._clampDistance(this._spherical.radius);
		else {
			const r = this._spherical.radius;
			this._spherical.radius = this._clampDistance(this._spherical.radius * this._scale), i = r != this._spherical.radius;
		}
		if (I.setFromSpherical(this._spherical), I.applyQuaternion(this._quatInverse), t.copy(this.target).add(I), this.object.lookAt(this.target), this.enableDamping === !0 ? (this._sphericalDelta.theta *= 1 - this.dampingFactor, this._sphericalDelta.phi *= 1 - this.dampingFactor, this._panOffset.multiplyScalar(1 - this.dampingFactor)) : (this._sphericalDelta.set(0, 0, 0), this._panOffset.set(0, 0, 0)), this.zoomToCursor && this._performCursorZoom) {
			let r = null;
			if (this.object.isPerspectiveCamera) {
				const l = I.length();
				r = this._clampDistance(l * this._scale);
				const a = l - r;
				this.object.position.addScaledVector(this._dollyDirection, a), this.object.updateMatrixWorld(), i = !!a;
			} else if (this.object.isOrthographicCamera) {
				const l = new N(this._mouse.x, this._mouse.y, 0);
				l.unproject(this.object);
				const a = this.object.zoom;
				this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale)), this.object.updateProjectionMatrix(), i = a !== this.object.zoom;
				const c = new N(this._mouse.x, this._mouse.y, 0);
				c.unproject(this.object), this.object.position.sub(c).add(l), this.object.updateMatrixWorld(), r = I.length();
			} else
				console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."), this.zoomToCursor = !1;
			r !== null && (this.screenSpacePanning ? this.target.set(0, 0, -1).transformDirection(this.object.matrix).multiplyScalar(r).add(this.object.position) : (le.origin.copy(this.object.position), le.direction.set(0, 0, -1).transformDirection(this.object.matrix), Math.abs(this.object.up.dot(le.direction)) < Zt ? this.object.lookAt(this.target) : (je.setFromNormalAndCoplanarPoint(this.object.up, this.target), le.intersectPlane(je, this.target))));
		} else if (this.object.isOrthographicCamera) {
			const r = this.object.zoom;
			this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale)), r !== this.object.zoom && (this.object.updateProjectionMatrix(), i = !0);
		}
		return this._scale = 1, this._performCursorZoom = !1, i || this._lastPosition.distanceToSquared(this.object.position) > ge || 8 * (1 - this._lastQuaternion.dot(this.object.quaternion)) > ge || this._lastTargetPosition.distanceToSquared(this.target) > ge ? (this.dispatchEvent(Fe), this._lastPosition.copy(this.object.position), this._lastQuaternion.copy(this.object.quaternion), this._lastTargetPosition.copy(this.target), !0) : !1;
	}
	/**
	 *
	 */
	_getAutoRotationAngle(e) {
		return e !== null ? O / 60 * this.autoRotateSpeed * e : O / 60 / 60 * this.autoRotateSpeed;
	}
	/**
	 *
	 */
	_getZoomScale(e) {
		const t = Math.abs(e * 0.01);
		return Math.pow(0.95, this.zoomSpeed * t);
	}
	/**
	 *
	 */
	_rotateLeft(e) {
		this._sphericalDelta.theta -= e;
	}
	/**
	 *
	 */
	_rotateUp(e) {
		this._sphericalDelta.phi -= e;
	}
	/**
	 *
	 */
	_panLeft(e, t) {
		I.setFromMatrixColumn(t, 0), I.multiplyScalar(-e), this._panOffset.add(I);
	}
	/**
	 *
	 */
	_panUp(e, t) {
		this.screenSpacePanning === !0 ? I.setFromMatrixColumn(t, 1) : (I.setFromMatrixColumn(t, 0), I.crossVectors(this.object.up, I)), I.multiplyScalar(e), this._panOffset.add(I);
	}
	// deltaX and deltaY are in pixels; right and down are positive
	/**
	 *
	 */
	_pan(e, t) {
		const o = this.domElement;
		if (this.object.isPerspectiveCamera) {
			const s = this.object.position;
			I.copy(s).sub(this.target);
			let i = I.length();
			i *= Math.tan(this.object.fov / 2 * Math.PI / 180), this._panLeft(2 * e * i / o.clientHeight, this.object.matrix), this._panUp(2 * t * i / o.clientHeight, this.object.matrix);
		} else this.object.isOrthographicCamera ? (this._panLeft(e * (this.object.right - this.object.left) / this.object.zoom / o.clientWidth, this.object.matrix), this._panUp(t * (this.object.top - this.object.bottom) / this.object.zoom / o.clientHeight, this.object.matrix)) : (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."), this.enablePan = !1);
	}
	/**
	 *
	 */
	_dollyOut(e) {
		this.object.isPerspectiveCamera || this.object.isOrthographicCamera ? this._scale /= e : (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."), this.enableZoom = !1);
	}
	/**
	 *
	 */
	_dollyIn(e) {
		this.object.isPerspectiveCamera || this.object.isOrthographicCamera ? this._scale *= e : (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."), this.enableZoom = !1);
	}
	/**
	 *
	 */
	_updateZoomParameters(e, t) {
		if (!this.zoomToCursor)
			return;
		this._performCursorZoom = !0;
		const o = this.domElement.getBoundingClientRect(), s = e - o.left, i = t - o.top, r = o.width, l = o.height;
		this._mouse.x = s / r * 2 - 1, this._mouse.y = -(i / l) * 2 + 1, this._dollyDirection.set(this._mouse.x, this._mouse.y, 1).unproject(this.object).sub(this.object.position).normalize();
	}
	/**
	 *
	 */
	_clampDistance(e) {
		return Math.max(this.minDistance, Math.min(this.maxDistance, e));
	}
	//
	// event callbacks - update the object state
	//
	/**
	 *
	 */
	_handleMouseDownRotate(e) {
		this._rotateStart.set(e.clientX, e.clientY);
	}
	/**
	 *
	 */
	_handleMouseDownDolly(e) {
		this._updateZoomParameters(e.clientX, e.clientX), this._dollyStart.set(e.clientX, e.clientY);
	}
	/**
	 *
	 */
	_handleMouseDownPan(e) {
		this._panStart.set(e.clientX, e.clientY);
	}
	/**
	 *
	 */
	_handleMouseMoveRotate(e) {
		this._rotateEnd.set(e.clientX, e.clientY), this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);
		const t = this.domElement;
		this._rotateLeft(O * this._rotateDelta.x / t.clientHeight), this._rotateUp(O * this._rotateDelta.y / t.clientHeight), this._rotateStart.copy(this._rotateEnd), this.update();
	}
	/**
	 *
	 */
	_handleMouseMoveDolly(e) {
		this._dollyEnd.set(e.clientX, e.clientY), this._dollyDelta.subVectors(this._dollyEnd, this._dollyStart), this._dollyDelta.y > 0 ? this._dollyOut(this._getZoomScale(this._dollyDelta.y)) : this._dollyDelta.y < 0 && this._dollyIn(this._getZoomScale(this._dollyDelta.y)), this._dollyStart.copy(this._dollyEnd), this.update();
	}
	/**
	 *
	 */
	_handleMouseMovePan(e) {
		this._panEnd.set(e.clientX, e.clientY), this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed), this._pan(this._panDelta.x, this._panDelta.y), this._panStart.copy(this._panEnd), this.update();
	}
	/**
	 *
	 */
	_handleMouseWheel(e) {
		this._updateZoomParameters(e.clientX, e.clientY), e.deltaY < 0 ? this._dollyIn(this._getZoomScale(e.deltaY)) : e.deltaY > 0 && this._dollyOut(this._getZoomScale(e.deltaY)), this.update();
	}
	/**
	 *
	 */
	_handleKeyDown(e) {
		let t = !1;
		switch (e.code) {
		case this.keys.UP:
			e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateUp(O * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(0, this.keyPanSpeed), t = !0;
			break;
		case this.keys.BOTTOM:
			e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateUp(-O * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(0, -this.keyPanSpeed), t = !0;
			break;
		case this.keys.LEFT:
			e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateLeft(O * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(this.keyPanSpeed, 0), t = !0;
			break;
		case this.keys.RIGHT:
			e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateLeft(-O * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(-this.keyPanSpeed, 0), t = !0;
			break;
		}
		t && (e.preventDefault(), this.update());
	}
	/**
	 *
	 */
	_handleTouchStartRotate(e) {
		if (this._pointers.length === 1)
			this._rotateStart.set(e.pageX, e.pageY);
		else {
			const t = this._getSecondPointerPosition(e), o = 0.5 * (e.pageX + t.x), s = 0.5 * (e.pageY + t.y);
			this._rotateStart.set(o, s);
		}
	}
	/**
	 *
	 */
	_handleTouchStartPan(e) {
		if (this._pointers.length === 1)
			this._panStart.set(e.pageX, e.pageY);
		else {
			const t = this._getSecondPointerPosition(e), o = 0.5 * (e.pageX + t.x), s = 0.5 * (e.pageY + t.y);
			this._panStart.set(o, s);
		}
	}
	/**
	 *
	 */
	_handleTouchStartDolly(e) {
		const t = this._getSecondPointerPosition(e), o = e.pageX - t.x, s = e.pageY - t.y, i = Math.sqrt(o * o + s * s);
		this._dollyStart.set(0, i);
	}
	/**
	 *
	 */
	_handleTouchStartDollyPan(e) {
		this.enableZoom && this._handleTouchStartDolly(e), this.enablePan && this._handleTouchStartPan(e);
	}
	/**
	 *
	 */
	_handleTouchStartDollyRotate(e) {
		this.enableZoom && this._handleTouchStartDolly(e), this.enableRotate && this._handleTouchStartRotate(e);
	}
	/**
	 *
	 */
	_handleTouchMoveRotate(e) {
		if (this._pointers.length == 1)
			this._rotateEnd.set(e.pageX, e.pageY);
		else {
			const o = this._getSecondPointerPosition(e), s = 0.5 * (e.pageX + o.x), i = 0.5 * (e.pageY + o.y);
			this._rotateEnd.set(s, i);
		}
		this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);
		const t = this.domElement;
		this._rotateLeft(O * this._rotateDelta.x / t.clientHeight), this._rotateUp(O * this._rotateDelta.y / t.clientHeight), this._rotateStart.copy(this._rotateEnd);
	}
	/**
	 *
	 */
	_handleTouchMovePan(e) {
		if (this._pointers.length === 1)
			this._panEnd.set(e.pageX, e.pageY);
		else {
			const t = this._getSecondPointerPosition(e), o = 0.5 * (e.pageX + t.x), s = 0.5 * (e.pageY + t.y);
			this._panEnd.set(o, s);
		}
		this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed), this._pan(this._panDelta.x, this._panDelta.y), this._panStart.copy(this._panEnd);
	}
	/**
	 *
	 */
	_handleTouchMoveDolly(e) {
		const t = this._getSecondPointerPosition(e), o = e.pageX - t.x, s = e.pageY - t.y, i = Math.sqrt(o * o + s * s);
		this._dollyEnd.set(0, i), this._dollyDelta.set(0, Math.pow(this._dollyEnd.y / this._dollyStart.y, this.zoomSpeed)), this._dollyOut(this._dollyDelta.y), this._dollyStart.copy(this._dollyEnd);
		const r = (e.pageX + t.x) * 0.5, l = (e.pageY + t.y) * 0.5;
		this._updateZoomParameters(r, l);
	}
	/**
	 *
	 */
	_handleTouchMoveDollyPan(e) {
		this.enableZoom && this._handleTouchMoveDolly(e), this.enablePan && this._handleTouchMovePan(e);
	}
	/**
	 *
	 */
	_handleTouchMoveDollyRotate(e) {
		this.enableZoom && this._handleTouchMoveDolly(e), this.enableRotate && this._handleTouchMoveRotate(e);
	}
	// pointers
	/**
	 *
	 */
	_addPointer(e) {
		this._pointers.push(e.pointerId);
	}
	/**
	 *
	 */
	_removePointer(e) {
		delete this._pointerPositions[e.pointerId];
		for (let t = 0; t < this._pointers.length; t++)
			if (this._pointers[t] == e.pointerId) {
				this._pointers.splice(t, 1);
				return;
			}
	}
	/**
	 *
	 */
	_isTrackingPointer(e) {
		for (let t = 0; t < this._pointers.length; t++)
			if (this._pointers[t] == e.pointerId) return !0;
		return !1;
	}
	/**
	 *
	 */
	_trackPointer(e) {
		let t = this._pointerPositions[e.pointerId];
		t === void 0 && (t = new k(), this._pointerPositions[e.pointerId] = t), t.set(e.pageX, e.pageY);
	}
	/**
	 *
	 */
	_getSecondPointerPosition(e) {
		const t = e.pointerId === this._pointers[0] ? this._pointers[1] : this._pointers[0];
		return this._pointerPositions[t];
	}
	//
	/**
	 *
	 */
	_customWheelEvent(e) {
		const t = e.deltaMode, o = {
			clientX: e.clientX,
			clientY: e.clientY,
			deltaY: e.deltaY
		};
		switch (t) {
		case 1:
			o.deltaY *= 16;
			break;
		case 2:
			o.deltaY *= 100;
			break;
		}
		return e.ctrlKey && !this._controlActive && (o.deltaY *= 10), o;
	}
}

/**
 *
 */
function qt(n) {
	this.enabled !== !1 && (this._pointers.length === 0 && (this.domElement.setPointerCapture(n.pointerId), this.domElement.addEventListener("pointermove", this._onPointerMove), this.domElement.addEventListener("pointerup", this._onPointerUp)), !this._isTrackingPointer(n) && (this._addPointer(n), n.pointerType === "touch" ? this._onTouchStart(n) : this._onMouseDown(n)));
}

/**
 *
 */
function Qt(n) {
	this.enabled !== !1 && (n.pointerType === "touch" ? this._onTouchMove(n) : this._onMouseMove(n));
}

/**
 *
 */
function Jt(n) {
	switch (this._removePointer(n), this._pointers.length) {
	case 0:
		this.domElement.releasePointerCapture(n.pointerId), this.domElement.removeEventListener("pointermove", this._onPointerMove), this.domElement.removeEventListener("pointerup", this._onPointerUp), this.dispatchEvent(st), this.state = S.NONE;
		break;
	case 1:
		const e = this._pointers[0], t = this._pointerPositions[e];
		this._onTouchStart({ pointerId: e, pageX: t.x, pageY: t.y });
		break;
	}
}

/**
 *
 */
function en(n) {
	let e;
	switch (n.button) {
	case 0:
		e = this.mouseButtons.LEFT;
		break;
	case 1:
		e = this.mouseButtons.MIDDLE;
		break;
	case 2:
		e = this.mouseButtons.RIGHT;
		break;
	default:
		e = -1;
	}
	switch (e) {
	case J.DOLLY:
		if (this.enableZoom === !1) return;
		this._handleMouseDownDolly(n), this.state = S.DOLLY;
		break;
	case J.ROTATE:
		if (n.ctrlKey || n.metaKey || n.shiftKey) {
			if (this.enablePan === !1) return;
			this._handleMouseDownPan(n), this.state = S.PAN;
		} else {
			if (this.enableRotate === !1) return;
			this._handleMouseDownRotate(n), this.state = S.ROTATE;
		}
		break;
	case J.PAN:
		if (n.ctrlKey || n.metaKey || n.shiftKey) {
			if (this.enableRotate === !1) return;
			this._handleMouseDownRotate(n), this.state = S.ROTATE;
		} else {
			if (this.enablePan === !1) return;
			this._handleMouseDownPan(n), this.state = S.PAN;
		}
		break;
	default:
		this.state = S.NONE;
	}
	this.state !== S.NONE && this.dispatchEvent(ve);
}

/**
 *
 */
function tn(n) {
	switch (this.state) {
	case S.ROTATE:
		if (this.enableRotate === !1) return;
		this._handleMouseMoveRotate(n);
		break;
	case S.DOLLY:
		if (this.enableZoom === !1) return;
		this._handleMouseMoveDolly(n);
		break;
	case S.PAN:
		if (this.enablePan === !1) return;
		this._handleMouseMovePan(n);
		break;
	}
}

/**
 *
 */
function nn(n) {
	this.enabled === !1 || this.enableZoom === !1 || this.state !== S.NONE || (n.preventDefault(), this.dispatchEvent(ve), this._handleMouseWheel(this._customWheelEvent(n)), this.dispatchEvent(st));
}

/**
 *
 */
function sn(n) {
	this.enabled !== !1 && this._handleKeyDown(n);
}

/**
 *
 */
function on(n) {
	switch (this._trackPointer(n), this._pointers.length) {
	case 1:
		switch (this.touches.ONE) {
		case Q.ROTATE:
			if (this.enableRotate === !1) return;
			this._handleTouchStartRotate(n), this.state = S.TOUCH_ROTATE;
			break;
		case Q.PAN:
			if (this.enablePan === !1) return;
			this._handleTouchStartPan(n), this.state = S.TOUCH_PAN;
			break;
		default:
			this.state = S.NONE;
		}
		break;
	case 2:
		switch (this.touches.TWO) {
		case Q.DOLLY_PAN:
			if (this.enableZoom === !1 && this.enablePan === !1) return;
			this._handleTouchStartDollyPan(n), this.state = S.TOUCH_DOLLY_PAN;
			break;
		case Q.DOLLY_ROTATE:
			if (this.enableZoom === !1 && this.enableRotate === !1) return;
			this._handleTouchStartDollyRotate(n), this.state = S.TOUCH_DOLLY_ROTATE;
			break;
		default:
			this.state = S.NONE;
		}
		break;
	default:
		this.state = S.NONE;
	}
	this.state !== S.NONE && this.dispatchEvent(ve);
}

/**
 *
 */
function rn(n) {
	switch (this._trackPointer(n), this.state) {
	case S.TOUCH_ROTATE:
		if (this.enableRotate === !1) return;
		this._handleTouchMoveRotate(n), this.update();
		break;
	case S.TOUCH_PAN:
		if (this.enablePan === !1) return;
		this._handleTouchMovePan(n), this.update();
		break;
	case S.TOUCH_DOLLY_PAN:
		if (this.enableZoom === !1 && this.enablePan === !1) return;
		this._handleTouchMoveDollyPan(n), this.update();
		break;
	case S.TOUCH_DOLLY_ROTATE:
		if (this.enableZoom === !1 && this.enableRotate === !1) return;
		this._handleTouchMoveDollyRotate(n), this.update();
		break;
	default:
		this.state = S.NONE;
	}
}

/**
 *
 */
function an(n) {
	this.enabled !== !1 && n.preventDefault();
}

/**
 *
 */
function ln(n) {
	n.key === "Control" && (this._controlActive = !0, this.domElement.getRootNode().addEventListener("keyup", this._interceptControlUp, { passive: !0, capture: !0 }));
}

/**
 *
 */
function cn(n) {
	n.key === "Control" && (this._controlActive = !1, this.domElement.getRootNode().removeEventListener("keyup", this._interceptControlUp, { passive: !0, capture: !0 }));
}

/**
 *
 */
function dn(n) {
	return n.scene = new M.Scene(), n.scene.background = new M.Color(2236962), n.camera = new M.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1e3), n.camera.position.z = 1, n.camera.position.y = 0.5, n.renderer = un(), hn(n.scene), n.controls = new Ce(n.camera, n.renderer.domElement), n.controls.enableDamping = !0, n.controls.dampingFactor = 0.05, n.controls.target.set(0, 0, 0), window.addEventListener("resize", () => pn(n)), n;
}

/**
 *
 */
function un() {
	const n = new M.WebGLRenderer({ antialias: !0 });
	return n.setSize(window.innerWidth, window.innerHeight), n.setPixelRatio(window.devicePixelRatio), n.outputEncoding = M.sRGBEncoding, document.body.appendChild(n.domElement), n.domElement.style.display = "none", n;
}

/**
 *
 */
function hn(n) {
	const e = new M.AmbientLight(16777215, 1);
	n.add(e);
	const t = new M.DirectionalLight(16777215, 1);
	t.position.set(1, 1, 1), n.add(t);
	const o = new M.DirectionalLight(16777215, 0.8);
	o.position.set(-1, 0.5, -1), n.add(o);
}

/**
 *
 */
function pn(n) {
	n.camera.aspect = window.innerWidth / window.innerHeight, n.camera.updateProjectionMatrix(), n.renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 *
 */
function ot(n) {
	requestAnimationFrame(() => ot(n)), n.controls && n.controls.update(), fn(n), n.renderer && n.scene && n.camera && n.renderer.render(n.scene, n.camera);
}

/**
 *
 */
function fn(n) {
	const e = performance.now() * 1e-3;
	n.modelObject && n.modelObject.traverse((t) => {
		t.isMesh && t.material instanceof M.ShaderMaterial && t.material.uniforms && t.material.uniforms.u_time && (t.material.uniforms.u_time.value = e);
	});
}

/**
 *
 */
function mn(n) {
	if (!n.renderer) {
		const e = new M.WebGLRenderer({
			antialias: !0,
			alpha: !0
		});
		if (e.setSize(window.innerWidth, window.innerHeight), e.setPixelRatio(window.devicePixelRatio), e.setClearColor(0, 1), e.outputEncoding = M.sRGBEncoding, document.body.appendChild(e.domElement), e.domElement.style.display = "none", n.renderer = e, !n.scene) {
			const t = new M.Scene();
			n.scene = t;
		}
		n.camera || gn(n), xn(n), bn(n), console.log("Renderer initialized");
	}
	return n.renderer;
}

/**
 *
 */
function gn(n) {
	if (!n.camera) {
		const e = new M.PerspectiveCamera(
			45,
			// FOV
			window.innerWidth / window.innerHeight,
			// Aspect ratio
			0.1,
			// Near plane
			1e3
			// Far plane
		);
		e.position.z = 5, n.camera = e, yn(n);
	}
	return n.camera;
}

/**
 *
 */
function yn(n) {
	if (!n.controls && n.camera && n.renderer) {
		const e = new Ce(n.camera, n.renderer.domElement);
		e.enableDamping = !0, e.dampingFactor = 0.05, e.screenSpacePanning = !0, n.controls = e;
	}
	return n.controls;
}

/**
 *
 */
function xn(n) {
	if (!n.renderer || !n.scene || !n.camera) return;
	const e = () => {
		requestAnimationFrame(e), n.controls && n.controls.update(), n.isDebugMode && n.renderer.render(n.scene, n.camera);
	};
	e();
}

/**
 *
 */
function bn(n) {
	window.addEventListener("resize", () => {
		!n.renderer || !n.camera || (n.camera.aspect = window.innerWidth / window.innerHeight, n.camera.updateProjectionMatrix(), n.renderer.setSize(window.innerWidth, window.innerHeight));
	});
}

/**
 *
 */
function Tn(n) {
	if (!n.scene) return;
	const e = [];
	n.scene.traverse((r) => {
		r.isLight && e.push(r);
	}), e.forEach((r) => {
		r.parent.remove(r);
	});
	const t = new M.AmbientLight(16777215, 0.5);
	n.scene.add(t);
	const o = new M.DirectionalLight(16777215, 0.8);
	o.position.set(0, 0, 10), n.scene.add(o);
	const s = new M.DirectionalLight(16777215, 0.3);
	s.position.set(0, 0, -10), n.scene.add(s);
	const i = new M.DirectionalLight(16777215, 0.3);
	i.position.set(0, 10, 0), n.scene.add(i);
}

/**
 *
 */
function _n(n) {
	if (!n.camera) {
		const e = new M.PerspectiveCamera(
			45,
			// FOV
			window.innerWidth / window.innerHeight,
			// Aspect ratio
			0.1,
			// Near plane
			1e3
			// Far plane
		);
		e.position.z = 5, n.camera = e, n.renderer && En(n), console.log("Camera initialized");
	}
	return n.camera;
}

/**
 *
 */
function En(n) {
	if (!n.controls && n.camera && n.renderer) {
		const e = new Ce(n.camera, n.renderer.domElement);
		e.enableDamping = !0, e.dampingFactor = 0.05, e.screenSpacePanning = !0, e.minDistance = 1, e.maxDistance = 20, n.controls = e, console.log("Orbit controls initialized");
	}
	return n.controls;
}

/**
 *
 */
function Be(n, e) {
	if (e === pt)
		return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."), n;
	if (e === Te || e === Ze) {
		let t = n.getIndex();
		if (t === null) {
			const r = [], l = n.getAttribute("position");
			if (l !== void 0) {
				for (let a = 0; a < l.count; a++)
					r.push(a);
				n.setIndex(r), t = n.getIndex();
			} else
				return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."), n;
		}
		const o = t.count - 2, s = [];
		if (e === Te)
			for (let r = 1; r <= o; r++)
				s.push(t.getX(0)), s.push(t.getX(r)), s.push(t.getX(r + 1));
		else
			for (let r = 0; r < o; r++)
				r % 2 === 0 ? (s.push(t.getX(r)), s.push(t.getX(r + 1)), s.push(t.getX(r + 2))) : (s.push(t.getX(r + 2)), s.push(t.getX(r + 1)), s.push(t.getX(r)));
		s.length / 3 !== o && console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");
		const i = n.clone();
		return i.setIndex(s), i.clearGroups(), i;
	} else
		return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:", e), n;
}

/**
 *
 */
class An extends ft {
	/**
	 *
	 */
	constructor(e) {
		super(e), this.dracoLoader = null, this.ktx2Loader = null, this.meshoptDecoder = null, this.pluginCallbacks = [], this.register(function(t) {
			return new Ln(t);
		}), this.register(function(t) {
			return new vn(t);
		}), this.register(function(t) {
			return new Fn(t);
		}), this.register(function(t) {
			return new jn(t);
		}), this.register(function(t) {
			return new Bn(t);
		}), this.register(function(t) {
			return new In(t);
		}), this.register(function(t) {
			return new Dn(t);
		}), this.register(function(t) {
			return new Nn(t);
		}), this.register(function(t) {
			return new On(t);
		}), this.register(function(t) {
			return new Rn(t);
		}), this.register(function(t) {
			return new Pn(t);
		}), this.register(function(t) {
			return new Cn(t);
		}), this.register(function(t) {
			return new kn(t);
		}), this.register(function(t) {
			return new Un(t);
		}), this.register(function(t) {
			return new Mn(t);
		}), this.register(function(t) {
			return new Hn(t);
		}), this.register(function(t) {
			return new zn(t);
		});
	}
	/**
	 *
	 */
	load(e, t, o, s) {
		const i = this;
		let r;
		if (this.resourcePath !== "")
			r = this.resourcePath;
		else if (this.path !== "") {
			const c = oe.extractUrlBase(e);
			r = oe.resolveURL(c, this.path);
		} else
			r = oe.extractUrlBase(e);
		this.manager.itemStart(e);
		const l = function(c) {
				s ? s(c) : console.error(c), i.manager.itemError(e), i.manager.itemEnd(e);
			}, a = new qe(this.manager);
		a.setPath(this.path), a.setResponseType("arraybuffer"), a.setRequestHeader(this.requestHeader), a.setWithCredentials(this.withCredentials), a.load(e, function(c) {
			try {
				i.parse(c, r, function(d) {
					t(d), i.manager.itemEnd(e);
				}, l);
			} catch (d) {
				l(d);
			}
		}, o, l);
	}
	/**
	 *
	 */
	setDRACOLoader(e) {
		return this.dracoLoader = e, this;
	}
	/**
	 *
	 */
	setKTX2Loader(e) {
		return this.ktx2Loader = e, this;
	}
	/**
	 *
	 */
	setMeshoptDecoder(e) {
		return this.meshoptDecoder = e, this;
	}
	/**
	 *
	 */
	register(e) {
		return this.pluginCallbacks.indexOf(e) === -1 && this.pluginCallbacks.push(e), this;
	}
	/**
	 *
	 */
	unregister(e) {
		return this.pluginCallbacks.indexOf(e) !== -1 && this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e), 1), this;
	}
	/**
	 *
	 */
	parse(e, t, o, s) {
		let i;
		const r = {}, l = {}, a = new TextDecoder();
		if (typeof e == "string")
			i = JSON.parse(e);
		else if (e instanceof ArrayBuffer)
			if (a.decode(new Uint8Array(e, 0, 4)) === it) {
				try {
					r[E.KHR_BINARY_GLTF] = new Gn(e);
				} catch (u) {
					s && s(u);
					return;
				}
				i = JSON.parse(r[E.KHR_BINARY_GLTF].content);
			} else
				i = JSON.parse(a.decode(e));
		else
			i = e;
		if (i.asset === void 0 || i.asset.version[0] < 2) {
			s && s(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));
			return;
		}
		const c = new ns(i, {
			path: t || this.resourcePath || "",
			crossOrigin: this.crossOrigin,
			requestHeader: this.requestHeader,
			manager: this.manager,
			ktx2Loader: this.ktx2Loader,
			meshoptDecoder: this.meshoptDecoder
		});
		c.fileLoader.setRequestHeader(this.requestHeader);
		for (let d = 0; d < this.pluginCallbacks.length; d++) {
			const u = this.pluginCallbacks[d](c);
			u.name || console.error("THREE.GLTFLoader: Invalid plugin found: missing name"), l[u.name] = u, r[u.name] = !0;
		}
		if (i.extensionsUsed)
			for (let d = 0; d < i.extensionsUsed.length; ++d) {
				const u = i.extensionsUsed[d], h = i.extensionsRequired || [];
				switch (u) {
				case E.KHR_MATERIALS_UNLIT:
					r[u] = new Sn();
					break;
				case E.KHR_DRACO_MESH_COMPRESSION:
					r[u] = new Vn(i, this.dracoLoader);
					break;
				case E.KHR_TEXTURE_TRANSFORM:
					r[u] = new Kn();
					break;
				case E.KHR_MESH_QUANTIZATION:
					r[u] = new $n();
					break;
				default:
					h.indexOf(u) >= 0 && l[u] === void 0 && console.warn('THREE.GLTFLoader: Unknown extension "' + u + '".');
				}
			}
		c.setExtensions(r), c.setPlugins(l), c.parse(o, s);
	}
	/**
	 *
	 */
	parseAsync(e, t) {
		const o = this;
		return new Promise(function(s, i) {
			o.parse(e, t, s, i);
		});
	}
}

/**
 *
 */
function wn() {
	let n = {};
	return {
		get: function(e) {
			return n[e];
		},
		add: function(e, t) {
			n[e] = t;
		},
		remove: function(e) {
			delete n[e];
		},
		removeAll: function() {
			n = {};
		}
	};
}

const E = {
	KHR_BINARY_GLTF: "KHR_binary_glTF",
	KHR_DRACO_MESH_COMPRESSION: "KHR_draco_mesh_compression",
	KHR_LIGHTS_PUNCTUAL: "KHR_lights_punctual",
	KHR_MATERIALS_CLEARCOAT: "KHR_materials_clearcoat",
	KHR_MATERIALS_DISPERSION: "KHR_materials_dispersion",
	KHR_MATERIALS_IOR: "KHR_materials_ior",
	KHR_MATERIALS_SHEEN: "KHR_materials_sheen",
	KHR_MATERIALS_SPECULAR: "KHR_materials_specular",
	KHR_MATERIALS_TRANSMISSION: "KHR_materials_transmission",
	KHR_MATERIALS_IRIDESCENCE: "KHR_materials_iridescence",
	KHR_MATERIALS_ANISOTROPY: "KHR_materials_anisotropy",
	KHR_MATERIALS_UNLIT: "KHR_materials_unlit",
	KHR_MATERIALS_VOLUME: "KHR_materials_volume",
	KHR_TEXTURE_BASISU: "KHR_texture_basisu",
	KHR_TEXTURE_TRANSFORM: "KHR_texture_transform",
	KHR_MESH_QUANTIZATION: "KHR_mesh_quantization",
	KHR_MATERIALS_EMISSIVE_STRENGTH: "KHR_materials_emissive_strength",
	EXT_MATERIALS_BUMP: "EXT_materials_bump",
	EXT_TEXTURE_WEBP: "EXT_texture_webp",
	EXT_TEXTURE_AVIF: "EXT_texture_avif",
	EXT_MESHOPT_COMPRESSION: "EXT_meshopt_compression",
	EXT_MESH_GPU_INSTANCING: "EXT_mesh_gpu_instancing"
};
/**
 *
 */
class Mn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_LIGHTS_PUNCTUAL, this.cache = { refs: {}, uses: {} };
	}
	/**
	 *
	 */
	_markDefs() {
		const e = this.parser, t = this.parser.json.nodes || [];
		for (let o = 0, s = t.length; o < s; o++) {
			const i = t[o];
			i.extensions && i.extensions[this.name] && i.extensions[this.name].light !== void 0 && e._addNodeRef(this.cache, i.extensions[this.name].light);
		}
	}
	/**
	 *
	 */
	_loadLight(e) {
		const t = this.parser, o = "light:" + e;
		let s = t.cache.get(o);
		if (s) return s;
		const i = t.json, a = ((i.extensions && i.extensions[this.name] || {}).lights || [])[e];
		let c;
		const d = new Y(16777215);
		a.color !== void 0 && d.setRGB(a.color[0], a.color[1], a.color[2], K);
		const u = a.range !== void 0 ? a.range : 0;
		switch (a.type) {
		case "directional":
			c = new yt(d), c.target.position.set(0, 0, -1), c.add(c.target);
			break;
		case "point":
			c = new gt(d), c.distance = u;
			break;
		case "spot":
			c = new mt(d), c.distance = u, a.spot = a.spot || {}, a.spot.innerConeAngle = a.spot.innerConeAngle !== void 0 ? a.spot.innerConeAngle : 0, a.spot.outerConeAngle = a.spot.outerConeAngle !== void 0 ? a.spot.outerConeAngle : Math.PI / 4, c.angle = a.spot.outerConeAngle, c.penumbra = 1 - a.spot.innerConeAngle / a.spot.outerConeAngle, c.target.position.set(0, 0, -1), c.add(c.target);
			break;
		default:
			throw new Error("THREE.GLTFLoader: Unexpected light type: " + a.type);
		}
		return c.position.set(0, 0, 0), c.decay = 2, V(c, a), a.intensity !== void 0 && (c.intensity = a.intensity), c.name = t.createUniqueName(a.name || "light_" + e), s = Promise.resolve(c), t.cache.add(o, s), s;
	}
	/**
	 *
	 */
	getDependency(e, t) {
		if (e === "light")
			return this._loadLight(t);
	}
	/**
	 *
	 */
	createNodeAttachment(e) {
		const t = this, o = this.parser, i = o.json.nodes[e], l = (i.extensions && i.extensions[this.name] || {}).light;
		return l === void 0 ? null : this._loadLight(l).then(function(a) {
			return o._getNodeRef(t.cache, l, a);
		});
	}
}
/**
 *
 */
class Sn {
	/**
	 *
	 */
	constructor() {
		this.name = E.KHR_MATERIALS_UNLIT;
	}
	/**
	 *
	 */
	getMaterialType() {
		return se;
	}
	/**
	 *
	 */
	extendParams(e, t, o) {
		const s = [];
		e.color = new Y(1, 1, 1), e.opacity = 1;
		const i = t.pbrMetallicRoughness;
		if (i) {
			if (Array.isArray(i.baseColorFactor)) {
				const r = i.baseColorFactor;
				e.color.setRGB(r[0], r[1], r[2], K), e.opacity = r[3];
			}
			i.baseColorTexture !== void 0 && s.push(o.assignTexture(e, "map", i.baseColorTexture, ie));
		}
		return Promise.all(s);
	}
}
/**
 *
 */
class Rn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_EMISSIVE_STRENGTH;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const s = this.parser.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = s.extensions[this.name].emissiveStrength;
		return i !== void 0 && (t.emissiveIntensity = i), Promise.resolve();
	}
}
/**
 *
 */
class Ln {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_CLEARCOAT;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [], r = s.extensions[this.name];
		if (r.clearcoatFactor !== void 0 && (t.clearcoat = r.clearcoatFactor), r.clearcoatTexture !== void 0 && i.push(o.assignTexture(t, "clearcoatMap", r.clearcoatTexture)), r.clearcoatRoughnessFactor !== void 0 && (t.clearcoatRoughness = r.clearcoatRoughnessFactor), r.clearcoatRoughnessTexture !== void 0 && i.push(o.assignTexture(t, "clearcoatRoughnessMap", r.clearcoatRoughnessTexture)), r.clearcoatNormalTexture !== void 0 && (i.push(o.assignTexture(t, "clearcoatNormalMap", r.clearcoatNormalTexture)), r.clearcoatNormalTexture.scale !== void 0)) {
			const l = r.clearcoatNormalTexture.scale;
			t.clearcoatNormalScale = new k(l, l);
		}
		return Promise.all(i);
	}
}
/**
 *
 */
class vn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_DISPERSION;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const s = this.parser.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = s.extensions[this.name];
		return t.dispersion = i.dispersion !== void 0 ? i.dispersion : 0, Promise.resolve();
	}
}
/**
 *
 */
class Cn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_IRIDESCENCE;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [], r = s.extensions[this.name];
		return r.iridescenceFactor !== void 0 && (t.iridescence = r.iridescenceFactor), r.iridescenceTexture !== void 0 && i.push(o.assignTexture(t, "iridescenceMap", r.iridescenceTexture)), r.iridescenceIor !== void 0 && (t.iridescenceIOR = r.iridescenceIor), t.iridescenceThicknessRange === void 0 && (t.iridescenceThicknessRange = [100, 400]), r.iridescenceThicknessMinimum !== void 0 && (t.iridescenceThicknessRange[0] = r.iridescenceThicknessMinimum), r.iridescenceThicknessMaximum !== void 0 && (t.iridescenceThicknessRange[1] = r.iridescenceThicknessMaximum), r.iridescenceThicknessTexture !== void 0 && i.push(o.assignTexture(t, "iridescenceThicknessMap", r.iridescenceThicknessTexture)), Promise.all(i);
	}
}
/**
 *
 */
class In {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_SHEEN;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [];
		t.sheenColor = new Y(0, 0, 0), t.sheenRoughness = 0, t.sheen = 1;
		const r = s.extensions[this.name];
		if (r.sheenColorFactor !== void 0) {
			const l = r.sheenColorFactor;
			t.sheenColor.setRGB(l[0], l[1], l[2], K);
		}
		return r.sheenRoughnessFactor !== void 0 && (t.sheenRoughness = r.sheenRoughnessFactor), r.sheenColorTexture !== void 0 && i.push(o.assignTexture(t, "sheenColorMap", r.sheenColorTexture, ie)), r.sheenRoughnessTexture !== void 0 && i.push(o.assignTexture(t, "sheenRoughnessMap", r.sheenRoughnessTexture)), Promise.all(i);
	}
}
/**
 *
 */
class Dn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_TRANSMISSION;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [], r = s.extensions[this.name];
		return r.transmissionFactor !== void 0 && (t.transmission = r.transmissionFactor), r.transmissionTexture !== void 0 && i.push(o.assignTexture(t, "transmissionMap", r.transmissionTexture)), Promise.all(i);
	}
}
/**
 *
 */
class Nn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_VOLUME;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [], r = s.extensions[this.name];
		t.thickness = r.thicknessFactor !== void 0 ? r.thicknessFactor : 0, r.thicknessTexture !== void 0 && i.push(o.assignTexture(t, "thicknessMap", r.thicknessTexture)), t.attenuationDistance = r.attenuationDistance || 1 / 0;
		const l = r.attenuationColor || [1, 1, 1];
		return t.attenuationColor = new Y().setRGB(l[0], l[1], l[2], K), Promise.all(i);
	}
}
/**
 *
 */
class On {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_IOR;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const s = this.parser.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = s.extensions[this.name];
		return t.ior = i.ior !== void 0 ? i.ior : 1.5, Promise.resolve();
	}
}
/**
 *
 */
class Pn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_SPECULAR;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [], r = s.extensions[this.name];
		t.specularIntensity = r.specularFactor !== void 0 ? r.specularFactor : 1, r.specularTexture !== void 0 && i.push(o.assignTexture(t, "specularIntensityMap", r.specularTexture));
		const l = r.specularColorFactor || [1, 1, 1];
		return t.specularColor = new Y().setRGB(l[0], l[1], l[2], K), r.specularColorTexture !== void 0 && i.push(o.assignTexture(t, "specularColorMap", r.specularColorTexture, ie)), Promise.all(i);
	}
}
/**
 *
 */
class Un {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.EXT_MATERIALS_BUMP;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [], r = s.extensions[this.name];
		return t.bumpScale = r.bumpFactor !== void 0 ? r.bumpFactor : 1, r.bumpTexture !== void 0 && i.push(o.assignTexture(t, "bumpMap", r.bumpTexture)), Promise.all(i);
	}
}
/**
 *
 */
class kn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_MATERIALS_ANISOTROPY;
	}
	/**
	 *
	 */
	getMaterialType(e) {
		const o = this.parser.json.materials[e];
		return !o.extensions || !o.extensions[this.name] ? null : G;
	}
	/**
	 *
	 */
	extendMaterialParams(e, t) {
		const o = this.parser, s = o.json.materials[e];
		if (!s.extensions || !s.extensions[this.name])
			return Promise.resolve();
		const i = [], r = s.extensions[this.name];
		return r.anisotropyStrength !== void 0 && (t.anisotropy = r.anisotropyStrength), r.anisotropyRotation !== void 0 && (t.anisotropyRotation = r.anisotropyRotation), r.anisotropyTexture !== void 0 && i.push(o.assignTexture(t, "anisotropyMap", r.anisotropyTexture)), Promise.all(i);
	}
}
/**
 *
 */
class Fn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.KHR_TEXTURE_BASISU;
	}
	/**
	 *
	 */
	loadTexture(e) {
		const t = this.parser, o = t.json, s = o.textures[e];
		if (!s.extensions || !s.extensions[this.name])
			return null;
		const i = s.extensions[this.name], r = t.options.ktx2Loader;
		if (!r) {
			if (o.extensionsRequired && o.extensionsRequired.indexOf(this.name) >= 0)
				throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");
			return null;
		}
		return t.loadTextureImage(e, i.source, r);
	}
}
/**
 *
 */
class jn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.EXT_TEXTURE_WEBP, this.isSupported = null;
	}
	/**
	 *
	 */
	loadTexture(e) {
		const t = this.name, o = this.parser, s = o.json, i = s.textures[e];
		if (!i.extensions || !i.extensions[t])
			return null;
		const r = i.extensions[t], l = s.images[r.source];
		let a = o.textureLoader;
		if (l.uri) {
			const c = o.options.manager.getHandler(l.uri);
			c !== null && (a = c);
		}
		return this.detectSupport().then(function(c) {
			if (c) return o.loadTextureImage(e, r.source, a);
			if (s.extensionsRequired && s.extensionsRequired.indexOf(t) >= 0)
				throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");
			return o.loadTexture(e);
		});
	}
	/**
	 *
	 */
	detectSupport() {
		return this.isSupported || (this.isSupported = new Promise(function(e) {
			const t = new Image();
			t.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", t.onload = t.onerror = function() {
				e(t.height === 1);
			};
		})), this.isSupported;
	}
}
/**
 *
 */
class Bn {
	/**
	 *
	 */
	constructor(e) {
		this.parser = e, this.name = E.EXT_TEXTURE_AVIF, this.isSupported = null;
	}
	/**
	 *
	 */
	loadTexture(e) {
		const t = this.name, o = this.parser, s = o.json, i = s.textures[e];
		if (!i.extensions || !i.extensions[t])
			return null;
		const r = i.extensions[t], l = s.images[r.source];
		let a = o.textureLoader;
		if (l.uri) {
			const c = o.options.manager.getHandler(l.uri);
			c !== null && (a = c);
		}
		return this.detectSupport().then(function(c) {
			if (c) return o.loadTextureImage(e, r.source, a);
			if (s.extensionsRequired && s.extensionsRequired.indexOf(t) >= 0)
				throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");
			return o.loadTexture(e);
		});
	}
	/**
	 *
	 */
	detectSupport() {
		return this.isSupported || (this.isSupported = new Promise(function(e) {
			const t = new Image();
			t.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=", t.onload = t.onerror = function() {
				e(t.height === 1);
			};
		})), this.isSupported;
	}
}
/**
 *
 */
class Hn {
	/**
	 *
	 */
	constructor(e) {
		this.name = E.EXT_MESHOPT_COMPRESSION, this.parser = e;
	}
	/**
	 *
	 */
	loadBufferView(e) {
		const t = this.parser.json, o = t.bufferViews[e];
		if (o.extensions && o.extensions[this.name]) {
			const s = o.extensions[this.name], i = this.parser.getDependency("buffer", s.buffer), r = this.parser.options.meshoptDecoder;
			if (!r || !r.supported) {
				if (t.extensionsRequired && t.extensionsRequired.indexOf(this.name) >= 0)
					throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");
				return null;
			}
			return i.then(function(l) {
				const a = s.byteOffset || 0, c = s.byteLength || 0, d = s.count, u = s.byteStride, h = new Uint8Array(l, a, c);
				return r.decodeGltfBufferAsync ? r.decodeGltfBufferAsync(d, u, h, s.mode, s.filter).then(function(p) {
					return p.buffer;
				}) : r.ready.then(function() {
					const p = new ArrayBuffer(d * u);
					return r.decodeGltfBuffer(new Uint8Array(p), d, u, h, s.mode, s.filter), p;
				});
			});
		} else
			return null;
	}
}
/**
 *
 */
class zn {
	/**
	 *
	 */
	constructor(e) {
		this.name = E.EXT_MESH_GPU_INSTANCING, this.parser = e;
	}
	/**
	 *
	 */
	createNodeMesh(e) {
		const t = this.parser.json, o = t.nodes[e];
		if (!o.extensions || !o.extensions[this.name] || o.mesh === void 0)
			return null;
		const s = t.meshes[o.mesh];
		for (const c of s.primitives)
			if (c.mode !== B.TRIANGLES && c.mode !== B.TRIANGLE_STRIP && c.mode !== B.TRIANGLE_FAN && c.mode !== void 0)
				return null;
		const r = o.extensions[this.name].attributes, l = [], a = {};
		for (const c in r)
			l.push(this.parser.getDependency("accessor", r[c]).then((d) => (a[c] = d, a[c])));
		return l.length < 1 ? null : (l.push(this.parser.createNodeMesh(e)), Promise.all(l).then((c) => {
			const d = c.pop(), u = d.isGroup ? d.children : [d], h = c[0].count, p = [];
			for (const m of u) {
				const T = new ue(), g = new N(), f = new de(), y = new N(1, 1, 1), v = new xt(m.geometry, m.material, h);
				for (let A = 0; A < h; A++)
					a.TRANSLATION && g.fromBufferAttribute(a.TRANSLATION, A), a.ROTATION && f.fromBufferAttribute(a.ROTATION, A), a.SCALE && y.fromBufferAttribute(a.SCALE, A), v.setMatrixAt(A, T.compose(g, f, y));
				for (const A in a)
					if (A === "_COLOR_0") {
						const L = a[A];
						v.instanceColor = new bt(L.array, L.itemSize, L.normalized);
					} else A !== "TRANSLATION" && A !== "ROTATION" && A !== "SCALE" && m.geometry.setAttribute(A, a[A]);
				Qe.prototype.copy.call(v, m), this.parser.assignFinalMaterial(v), p.push(v);
			}
			return d.isGroup ? (d.clear(), d.add(...p), d) : p[0];
		}));
	}
}
const it = "glTF", ne = 12, He = { JSON: 1313821514, BIN: 5130562 };
/**
 *
 */
class Gn {
	/**
	 *
	 */
	constructor(e) {
		this.name = E.KHR_BINARY_GLTF, this.content = null, this.body = null;
		const t = new DataView(e, 0, ne), o = new TextDecoder();
		if (this.header = {
			magic: o.decode(new Uint8Array(e.slice(0, 4))),
			version: t.getUint32(4, !0),
			length: t.getUint32(8, !0)
		}, this.header.magic !== it)
			throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");
		if (this.header.version < 2)
			throw new Error("THREE.GLTFLoader: Legacy binary file detected.");
		const s = this.header.length - ne, i = new DataView(e, ne);
		let r = 0;
		for (; r < s; ) {
			const l = i.getUint32(r, !0);
			r += 4;
			const a = i.getUint32(r, !0);
			if (r += 4, a === He.JSON) {
				const c = new Uint8Array(e, ne + r, l);
				this.content = o.decode(c);
			} else if (a === He.BIN) {
				const c = ne + r;
				this.body = e.slice(c, c + l);
			}
			r += l;
		}
		if (this.content === null)
			throw new Error("THREE.GLTFLoader: JSON content not found.");
	}
}
/**
 *
 */
class Vn {
	/**
	 *
	 */
	constructor(e, t) {
		if (!t)
			throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");
		this.name = E.KHR_DRACO_MESH_COMPRESSION, this.json = e, this.dracoLoader = t, this.dracoLoader.preload();
	}
	/**
	 *
	 */
	decodePrimitive(e, t) {
		const o = this.json, s = this.dracoLoader, i = e.extensions[this.name].bufferView, r = e.extensions[this.name].attributes, l = {}, a = {}, c = {};
		for (const d in r) {
			const u = Ae[d] || d.toLowerCase();
			l[u] = r[d];
		}
		for (const d in e.attributes) {
			const u = Ae[d] || d.toLowerCase();
			if (r[d] !== void 0) {
				const h = o.accessors[e.attributes[d]], p = ee[h.componentType];
				c[u] = p.name, a[u] = h.normalized === !0;
			}
		}
		return t.getDependency("bufferView", i).then(function(d) {
			return new Promise(function(u, h) {
				s.decodeDracoFile(d, function(p) {
					for (const m in p.attributes) {
						const T = p.attributes[m], g = a[m];
						g !== void 0 && (T.normalized = g);
					}
					u(p);
				}, l, c, K, h);
			});
		});
	}
}
/**
 *
 */
class Kn {
	/**
	 *
	 */
	constructor() {
		this.name = E.KHR_TEXTURE_TRANSFORM;
	}
	/**
	 *
	 */
	extendTexture(e, t) {
		return (t.texCoord === void 0 || t.texCoord === e.channel) && t.offset === void 0 && t.rotation === void 0 && t.scale === void 0 || (e = e.clone(), t.texCoord !== void 0 && (e.channel = t.texCoord), t.offset !== void 0 && e.offset.fromArray(t.offset), t.rotation !== void 0 && (e.rotation = t.rotation), t.scale !== void 0 && e.repeat.fromArray(t.scale), e.needsUpdate = !0), e;
	}
}
/**
 *
 */
class $n {
	/**
	 *
	 */
	constructor() {
		this.name = E.KHR_MESH_QUANTIZATION;
	}
}
/**
 *
 */
class rt extends Wt {
	/**
	 *
	 */
	constructor(e, t, o, s) {
		super(e, t, o, s);
	}
	/**
	 *
	 */
	copySampleValue_(e) {
		const t = this.resultBuffer, o = this.sampleValues, s = this.valueSize, i = e * s * 3 + s;
		for (let r = 0; r !== s; r++)
			t[r] = o[i + r];
		return t;
	}
	/**
	 *
	 */
	interpolate_(e, t, o, s) {
		const i = this.resultBuffer, r = this.sampleValues, l = this.valueSize, a = l * 2, c = l * 3, d = s - t, u = (o - t) / d, h = u * u, p = h * u, m = e * c, T = m - c, g = -2 * p + 3 * h, f = p - h, y = 1 - g, v = f - h + u;
		for (let A = 0; A !== l; A++) {
			const L = r[T + A + l], x = r[T + A + a] * d, _ = r[m + A + l], w = r[m + A] * d;
			i[A] = y * L + v * x + g * _ + f * w;
		}
		return i;
	}
}
const Wn = new de();
/**
 *
 */
class Xn extends rt {
	/**
	 *
	 */
	interpolate_(e, t, o, s) {
		const i = super.interpolate_(e, t, o, s);
		return Wn.fromArray(i).normalize().toArray(i), i;
	}
}
const B = {
		POINTS: 0,
		LINES: 1,
		LINE_LOOP: 2,
		LINE_STRIP: 3,
		TRIANGLES: 4,
		TRIANGLE_STRIP: 5,
		TRIANGLE_FAN: 6
	}, ee = {
		5120: Int8Array,
		5121: Uint8Array,
		5122: Int16Array,
		5123: Uint16Array,
		5125: Uint32Array,
		5126: Float32Array
	}, ze = {
		9728: et,
		9729: _e,
		9984: St,
		9985: Mt,
		9986: wt,
		9987: Je
	}, Ge = {
		33071: Lt,
		33648: Rt,
		10497: Ee
	}, ye = {
		SCALAR: 1,
		VEC2: 2,
		VEC3: 3,
		VEC4: 4,
		MAT2: 4,
		MAT3: 9,
		MAT4: 16
	}, Ae = {
		POSITION: "position",
		NORMAL: "normal",
		TANGENT: "tangent",
		TEXCOORD_0: "uv",
		TEXCOORD_1: "uv1",
		TEXCOORD_2: "uv2",
		TEXCOORD_3: "uv3",
		COLOR_0: "color",
		WEIGHTS_0: "skinWeight",
		JOINTS_0: "skinIndex"
	}, W = {
		scale: "scale",
		translation: "position",
		rotation: "quaternion",
		weights: "morphTargetInfluences"
	}, Yn = {
		CUBICSPLINE: void 0,
		// We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
		// keyframe track will be initialized with a default interpolation type, then modified.
		LINEAR: nt,
		STEP: Kt
	}, xe = {
		OPAQUE: "OPAQUE",
		MASK: "MASK",
		BLEND: "BLEND"
	};

/**
 *
 */
function Zn(n) {
	return n.DefaultMaterial === void 0 && (n.DefaultMaterial = new tt({
		color: 16777215,
		emissive: 0,
		metalness: 1,
		roughness: 1,
		transparent: !1,
		depthTest: !0,
		side: $t
	})), n.DefaultMaterial;
}

/**
 *
 */
function X(n, e, t) {
	for (const o in t.extensions)
		n[o] === void 0 && (e.userData.gltfExtensions = e.userData.gltfExtensions || {}, e.userData.gltfExtensions[o] = t.extensions[o]);
}

/**
 *
 */
function V(n, e) {
	e.extras !== void 0 && (typeof e.extras == "object" ? Object.assign(n.userData, e.extras) : console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, " + e.extras));
}

/**
 *
 */
function qn(n, e, t) {
	let o = !1, s = !1, i = !1;
	for (let c = 0, d = e.length; c < d; c++) {
		const u = e[c];
		if (u.POSITION !== void 0 && (o = !0), u.NORMAL !== void 0 && (s = !0), u.COLOR_0 !== void 0 && (i = !0), o && s && i) break;
	}
	if (!o && !s && !i) return Promise.resolve(n);
	const r = [], l = [], a = [];
	for (let c = 0, d = e.length; c < d; c++) {
		const u = e[c];
		if (o) {
			const h = u.POSITION !== void 0 ? t.getDependency("accessor", u.POSITION) : n.attributes.position;
			r.push(h);
		}
		if (s) {
			const h = u.NORMAL !== void 0 ? t.getDependency("accessor", u.NORMAL) : n.attributes.normal;
			l.push(h);
		}
		if (i) {
			const h = u.COLOR_0 !== void 0 ? t.getDependency("accessor", u.COLOR_0) : n.attributes.color;
			a.push(h);
		}
	}
	return Promise.all([
		Promise.all(r),
		Promise.all(l),
		Promise.all(a)
	]).then(function(c) {
		const d = c[0], u = c[1], h = c[2];
		return o && (n.morphAttributes.position = d), s && (n.morphAttributes.normal = u), i && (n.morphAttributes.color = h), n.morphTargetsRelative = !0, n;
	});
}

/**
 *
 */
function Qn(n, e) {
	if (n.updateMorphTargets(), e.weights !== void 0)
		for (let t = 0, o = e.weights.length; t < o; t++)
			n.morphTargetInfluences[t] = e.weights[t];
	if (e.extras && Array.isArray(e.extras.targetNames)) {
		const t = e.extras.targetNames;
		if (n.morphTargetInfluences.length === t.length) {
			n.morphTargetDictionary = {};
			for (let o = 0, s = t.length; o < s; o++)
				n.morphTargetDictionary[t[o]] = o;
		} else
			console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.");
	}
}

/**
 *
 */
function Jn(n) {
	let e;
	const t = n.extensions && n.extensions[E.KHR_DRACO_MESH_COMPRESSION];
	if (t ? e = "draco:" + t.bufferView + ":" + t.indices + ":" + be(t.attributes) : e = n.indices + ":" + be(n.attributes) + ":" + n.mode, n.targets !== void 0)
		for (let o = 0, s = n.targets.length; o < s; o++)
			e += ":" + be(n.targets[o]);
	return e;
}

/**
 *
 */
function be(n) {
	let e = "";
	const t = Object.keys(n).sort();
	for (let o = 0, s = t.length; o < s; o++)
		e += t[o] + ":" + n[t[o]] + ";";
	return e;
}

/**
 *
 */
function we(n) {
	switch (n) {
	case Int8Array:
		return 1 / 127;
	case Uint8Array:
		return 1 / 255;
	case Int16Array:
		return 1 / 32767;
	case Uint16Array:
		return 1 / 65535;
	default:
		throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.");
	}
}

/**
 *
 */
function es(n) {
	return n.search(/\.jpe?g($|\?)/i) > 0 || n.search(/^data\:image\/jpeg/) === 0 ? "image/jpeg" : n.search(/\.webp($|\?)/i) > 0 || n.search(/^data\:image\/webp/) === 0 ? "image/webp" : n.search(/\.ktx2($|\?)/i) > 0 || n.search(/^data\:image\/ktx2/) === 0 ? "image/ktx2" : "image/png";
}

const ts = new ue();
/**
 *
 */
class ns {
	/**
	 *
	 */
	constructor(e = {}, t = {}) {
		this.json = e, this.extensions = {}, this.plugins = {}, this.options = t, this.cache = new wn(), this.associations = /* @__PURE__ */ new Map(), this.primitiveCache = {}, this.nodeCache = {}, this.meshCache = { refs: {}, uses: {} }, this.cameraCache = { refs: {}, uses: {} }, this.lightCache = { refs: {}, uses: {} }, this.sourceCache = {}, this.textureCache = {}, this.nodeNamesUsed = {};
		let o = !1, s = -1, i = !1, r = -1;
		if (typeof navigator < "u") {
			const l = navigator.userAgent;
			o = /^((?!chrome|android).)*safari/i.test(l) === !0;
			const a = l.match(/Version\/(\d+)/);
			s = o && a ? parseInt(a[1], 10) : -1, i = l.indexOf("Firefox") > -1, r = i ? l.match(/Firefox\/([0-9]+)\./)[1] : -1;
		}
		typeof createImageBitmap > "u" || o && s < 17 || i && r < 98 ? this.textureLoader = new Tt(this.options.manager) : this.textureLoader = new _t(this.options.manager), this.textureLoader.setCrossOrigin(this.options.crossOrigin), this.textureLoader.setRequestHeader(this.options.requestHeader), this.fileLoader = new qe(this.options.manager), this.fileLoader.setResponseType("arraybuffer"), this.options.crossOrigin === "use-credentials" && this.fileLoader.setWithCredentials(!0);
	}
	/**
	 *
	 */
	setExtensions(e) {
		this.extensions = e;
	}
	/**
	 *
	 */
	setPlugins(e) {
		this.plugins = e;
	}
	/**
	 *
	 */
	parse(e, t) {
		const o = this, s = this.json, i = this.extensions;
		this.cache.removeAll(), this.nodeCache = {}, this._invokeAll(function(r) {
			return r._markDefs && r._markDefs();
		}), Promise.all(this._invokeAll(function(r) {
			return r.beforeRoot && r.beforeRoot();
		})).then(function() {
			return Promise.all([
				o.getDependencies("scene"),
				o.getDependencies("animation"),
				o.getDependencies("camera")
			]);
		}).then(function(r) {
			const l = {
				scene: r[0][s.scene || 0],
				scenes: r[0],
				animations: r[1],
				cameras: r[2],
				asset: s.asset,
				parser: o,
				userData: {}
			};
			return X(i, l, s), V(l, s), Promise.all(o._invokeAll(function(a) {
				return a.afterRoot && a.afterRoot(l);
			})).then(function() {
				for (const a of l.scenes)
					a.updateMatrixWorld();
				e(l);
			});
		}).catch(t);
	}
	/**
   * Marks the special nodes/meshes in json for efficient parse.
   */
	_markDefs() {
		const e = this.json.nodes || [], t = this.json.skins || [], o = this.json.meshes || [];
		for (let s = 0, i = t.length; s < i; s++) {
			const r = t[s].joints;
			for (let l = 0, a = r.length; l < a; l++)
				e[r[l]].isBone = !0;
		}
		for (let s = 0, i = e.length; s < i; s++) {
			const r = e[s];
			r.mesh !== void 0 && (this._addNodeRef(this.meshCache, r.mesh), r.skin !== void 0 && (o[r.mesh].isSkinnedMesh = !0)), r.camera !== void 0 && this._addNodeRef(this.cameraCache, r.camera);
		}
	}
	/**
   * Counts references to shared node / Object3D resources. These resources
   * can be reused, or "instantiated", at multiple nodes in the scene
   * hierarchy. Mesh, Camera, and Light instances are instantiated and must
   * be marked. Non-scenegraph resources (like Materials, Geometries, and
   * Textures) can be reused directly and are not marked here.
   *
   * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
   *
   * @param {Object} cache
   * @param {Object3D} index
   */
	_addNodeRef(e, t) {
		t !== void 0 && (e.refs[t] === void 0 && (e.refs[t] = e.uses[t] = 0), e.refs[t]++);
	}
	/**
   * Returns a reference to a shared resource, cloning it if necessary.
   *
   * @param {Object} cache
   * @param {Number} index
   * @param {Object} object
   * @return {Object}
   */
	_getNodeRef(e, t, o) {
		if (e.refs[t] <= 1) return o;
		const s = o.clone(), i = (r, l) => {
			const a = this.associations.get(r);
			a != null && this.associations.set(l, a);
			for (const [c, d] of r.children.entries())
				i(d, l.children[c]);
		};
		return i(o, s), s.name += "_instance_" + e.uses[t]++, s;
	}
	/**
	 *
	 */
	_invokeOne(e) {
		const t = Object.values(this.plugins);
		t.push(this);
		for (let o = 0; o < t.length; o++) {
			const s = e(t[o]);
			if (s) return s;
		}
		return null;
	}
	/**
	 *
	 */
	_invokeAll(e) {
		const t = Object.values(this.plugins);
		t.unshift(this);
		const o = [];
		for (let s = 0; s < t.length; s++) {
			const i = e(t[s]);
			i && o.push(i);
		}
		return o;
	}
	/**
   * Requests the specified dependency asynchronously, with caching.
   * @param {string} type
   * @param {number} index
   * @return {Promise<Object3D|Material|THREE.Texture|AnimationClip|ArrayBuffer|Object>}
   */
	getDependency(e, t) {
		const o = e + ":" + t;
		let s = this.cache.get(o);
		if (!s) {
			switch (e) {
			case "scene":
				s = this.loadScene(t);
				break;
			case "node":
				s = this._invokeOne(function(i) {
					return i.loadNode && i.loadNode(t);
				});
				break;
			case "mesh":
				s = this._invokeOne(function(i) {
					return i.loadMesh && i.loadMesh(t);
				});
				break;
			case "accessor":
				s = this.loadAccessor(t);
				break;
			case "bufferView":
				s = this._invokeOne(function(i) {
					return i.loadBufferView && i.loadBufferView(t);
				});
				break;
			case "buffer":
				s = this.loadBuffer(t);
				break;
			case "material":
				s = this._invokeOne(function(i) {
					return i.loadMaterial && i.loadMaterial(t);
				});
				break;
			case "texture":
				s = this._invokeOne(function(i) {
					return i.loadTexture && i.loadTexture(t);
				});
				break;
			case "skin":
				s = this.loadSkin(t);
				break;
			case "animation":
				s = this._invokeOne(function(i) {
					return i.loadAnimation && i.loadAnimation(t);
				});
				break;
			case "camera":
				s = this.loadCamera(t);
				break;
			default:
				if (s = this._invokeOne(function(i) {
					return i != this && i.getDependency && i.getDependency(e, t);
				}), !s)
					throw new Error("Unknown type: " + e);
				break;
			}
			this.cache.add(o, s);
		}
		return s;
	}
	/**
   * Requests all dependencies of the specified type asynchronously, with caching.
   * @param {string} type
   * @return {Promise<Array<Object>>}
   */
	getDependencies(e) {
		let t = this.cache.get(e);
		if (!t) {
			const o = this, s = this.json[e + (e === "mesh" ? "es" : "s")] || [];
			t = Promise.all(s.map(function(i, r) {
				return o.getDependency(e, r);
			})), this.cache.add(e, t);
		}
		return t;
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferIndex
   * @return {Promise<ArrayBuffer>}
   */
	loadBuffer(e) {
		const t = this.json.buffers[e], o = this.fileLoader;
		if (t.type && t.type !== "arraybuffer")
			throw new Error("THREE.GLTFLoader: " + t.type + " buffer type is not supported.");
		if (t.uri === void 0 && e === 0)
			return Promise.resolve(this.extensions[E.KHR_BINARY_GLTF].body);
		const s = this.options;
		return new Promise(function(i, r) {
			o.load(oe.resolveURL(t.uri, s.path), i, void 0, function() {
				r(new Error('THREE.GLTFLoader: Failed to load buffer "' + t.uri + '".'));
			});
		});
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferViewIndex
   * @return {Promise<ArrayBuffer>}
   */
	loadBufferView(e) {
		const t = this.json.bufferViews[e];
		return this.getDependency("buffer", t.buffer).then(function(o) {
			const s = t.byteLength || 0, i = t.byteOffset || 0;
			return o.slice(i, i + s);
		});
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
   * @param {number} accessorIndex
   * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
   */
	loadAccessor(e) {
		const t = this, o = this.json, s = this.json.accessors[e];
		if (s.bufferView === void 0 && s.sparse === void 0) {
			const r = ye[s.type], l = ee[s.componentType], a = s.normalized === !0, c = new l(s.count * r);
			return Promise.resolve(new pe(c, r, a));
		}
		const i = [];
		return s.bufferView !== void 0 ? i.push(this.getDependency("bufferView", s.bufferView)) : i.push(null), s.sparse !== void 0 && (i.push(this.getDependency("bufferView", s.sparse.indices.bufferView)), i.push(this.getDependency("bufferView", s.sparse.values.bufferView))), Promise.all(i).then(function(r) {
			const l = r[0], a = ye[s.type], c = ee[s.componentType], d = c.BYTES_PER_ELEMENT, u = d * a, h = s.byteOffset || 0, p = s.bufferView !== void 0 ? o.bufferViews[s.bufferView].byteStride : void 0, m = s.normalized === !0;
			let T, g;
			if (p && p !== u) {
				const f = Math.floor(h / p), y = "InterleavedBuffer:" + s.bufferView + ":" + s.componentType + ":" + f + ":" + s.count;
				let v = t.cache.get(y);
				v || (T = new c(l, f * p, s.count * p / d), v = new Et(T, p / d), t.cache.add(y, v)), g = new At(v, a, h % p / d, m);
			} else
				l === null ? T = new c(s.count * a) : T = new c(l, h, s.count * a), g = new pe(T, a, m);
			if (s.sparse !== void 0) {
				const f = ye.SCALAR, y = ee[s.sparse.indices.componentType], v = s.sparse.indices.byteOffset || 0, A = s.sparse.values.byteOffset || 0, L = new y(r[1], v, s.sparse.count * f), x = new c(r[2], A, s.sparse.count * a);
				l !== null && (g = new pe(g.array.slice(), g.itemSize, g.normalized)), g.normalized = !1;
				for (let _ = 0, w = L.length; _ < w; _++) {
					const R = L[_];
					if (g.setX(R, x[_ * a]), a >= 2 && g.setY(R, x[_ * a + 1]), a >= 3 && g.setZ(R, x[_ * a + 2]), a >= 4 && g.setW(R, x[_ * a + 3]), a >= 5) throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.");
				}
				g.normalized = m;
			}
			return g;
		});
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
   * @param {number} textureIndex
   * @return {Promise<THREE.Texture|null>}
   */
	loadTexture(e) {
		const t = this.json, o = this.options, i = t.textures[e].source, r = t.images[i];
		let l = this.textureLoader;
		if (r.uri) {
			const a = o.manager.getHandler(r.uri);
			a !== null && (l = a);
		}
		return this.loadTextureImage(e, i, l);
	}
	/**
	 *
	 */
	loadTextureImage(e, t, o) {
		const s = this, i = this.json, r = i.textures[e], l = i.images[t], a = (l.uri || l.bufferView) + ":" + r.sampler;
		if (this.textureCache[a])
			return this.textureCache[a];
		const c = this.loadImageSource(t, o).then(function(d) {
			d.flipY = !1, d.name = r.name || l.name || "", d.name === "" && typeof l.uri == "string" && l.uri.startsWith("data:image/") === !1 && (d.name = l.uri);
			const h = (i.samplers || {})[r.sampler] || {};
			return d.magFilter = ze[h.magFilter] || _e, d.minFilter = ze[h.minFilter] || Je, d.wrapS = Ge[h.wrapS] || Ee, d.wrapT = Ge[h.wrapT] || Ee, d.generateMipmaps = !d.isCompressedTexture && d.minFilter !== et && d.minFilter !== _e, s.associations.set(d, { textures: e }), d;
		}).catch(function() {
			return null;
		});
		return this.textureCache[a] = c, c;
	}
	/**
	 *
	 */
	loadImageSource(e, t) {
		const o = this, s = this.json, i = this.options;
		if (this.sourceCache[e] !== void 0)
			return this.sourceCache[e].then((u) => u.clone());
		const r = s.images[e], l = self.URL || self.webkitURL;
		let a = r.uri || "", c = !1;
		if (r.bufferView !== void 0)
			a = o.getDependency("bufferView", r.bufferView).then(function(u) {
				c = !0;
				const h = new Blob([u], { type: r.mimeType });
				return a = l.createObjectURL(h), a;
			});
		else if (r.uri === void 0)
			throw new Error("THREE.GLTFLoader: Image " + e + " is missing URI and bufferView");
		const d = Promise.resolve(a).then(function(u) {
			return new Promise(function(h, p) {
				let m = h;
				t.isImageBitmapLoader === !0 && (m = function(T) {
					const g = new Ne(T);
					g.needsUpdate = !0, h(g);
				}), t.load(oe.resolveURL(u, i.path), m, void 0, p);
			});
		}).then(function(u) {
			return c === !0 && l.revokeObjectURL(a), V(u, r), u.userData.mimeType = r.mimeType || es(r.uri), u;
		}).catch(function(u) {
			throw console.error("THREE.GLTFLoader: Couldn't load texture", a), u;
		});
		return this.sourceCache[e] = d, d;
	}
	/**
   * Asynchronously assigns a texture to the given material parameters.
   *
   * @param {Object} materialParams
   * @param {string} mapName
   * @param {Object} mapDef
   * @param {string} colorSpace
   * @return {Promise<Texture>}
   */
	assignTexture(e, t, o, s) {
		const i = this;
		return this.getDependency("texture", o.index).then(function(r) {
			if (!r) return null;
			if (o.texCoord !== void 0 && o.texCoord > 0 && (r = r.clone(), r.channel = o.texCoord), i.extensions[E.KHR_TEXTURE_TRANSFORM]) {
				const l = o.extensions !== void 0 ? o.extensions[E.KHR_TEXTURE_TRANSFORM] : void 0;
				if (l) {
					const a = i.associations.get(r);
					r = i.extensions[E.KHR_TEXTURE_TRANSFORM].extendTexture(r, l), i.associations.set(r, a);
				}
			}
			return s !== void 0 && (r.colorSpace = s), e[t] = r, r;
		});
	}
	/**
   * Assigns final material to a Mesh, Line, or Points instance. The instance
   * already has a material (generated from the glTF material options alone)
   * but reuse of the same glTF material may require multiple threejs materials
   * to accommodate different primitive types, defines, etc. New materials will
   * be created if necessary, and reused from a cache.
   * @param  {Object3D} mesh Mesh, Line, or Points instance.
   */
	assignFinalMaterial(e) {
		const t = e.geometry;
		let o = e.material;
		const s = t.attributes.tangent === void 0, i = t.attributes.color !== void 0, r = t.attributes.normal === void 0;
		if (e.isPoints) {
			const l = "PointsMaterial:" + o.uuid;
			let a = this.cache.get(l);
			a || (a = new vt(), fe.prototype.copy.call(a, o), a.color.copy(o.color), a.map = o.map, a.sizeAttenuation = !1, this.cache.add(l, a)), o = a;
		} else if (e.isLine) {
			const l = "LineBasicMaterial:" + o.uuid;
			let a = this.cache.get(l);
			a || (a = new Ct(), fe.prototype.copy.call(a, o), a.color.copy(o.color), a.map = o.map, this.cache.add(l, a)), o = a;
		}
		if (s || i || r) {
			let l = "ClonedMaterial:" + o.uuid + ":";
			s && (l += "derivative-tangents:"), i && (l += "vertex-colors:"), r && (l += "flat-shading:");
			let a = this.cache.get(l);
			a || (a = o.clone(), i && (a.vertexColors = !0), r && (a.flatShading = !0), s && (a.normalScale && (a.normalScale.y *= -1), a.clearcoatNormalScale && (a.clearcoatNormalScale.y *= -1)), this.cache.add(l, a), this.associations.set(a, this.associations.get(o))), o = a;
		}
		e.material = o;
	}
	/**
	 *
	 */
	getMaterialType() {
		return tt;
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
   * @param {number} materialIndex
   * @return {Promise<Material>}
   */
	loadMaterial(e) {
		const t = this, o = this.json, s = this.extensions, i = o.materials[e];
		let r;
		const l = {}, a = i.extensions || {}, c = [];
		if (a[E.KHR_MATERIALS_UNLIT]) {
			const u = s[E.KHR_MATERIALS_UNLIT];
			r = u.getMaterialType(), c.push(u.extendParams(l, i, t));
		} else {
			const u = i.pbrMetallicRoughness || {};
			if (l.color = new Y(1, 1, 1), l.opacity = 1, Array.isArray(u.baseColorFactor)) {
				const h = u.baseColorFactor;
				l.color.setRGB(h[0], h[1], h[2], K), l.opacity = h[3];
			}
			u.baseColorTexture !== void 0 && c.push(t.assignTexture(l, "map", u.baseColorTexture, ie)), l.metalness = u.metallicFactor !== void 0 ? u.metallicFactor : 1, l.roughness = u.roughnessFactor !== void 0 ? u.roughnessFactor : 1, u.metallicRoughnessTexture !== void 0 && (c.push(t.assignTexture(l, "metalnessMap", u.metallicRoughnessTexture)), c.push(t.assignTexture(l, "roughnessMap", u.metallicRoughnessTexture))), r = this._invokeOne(function(h) {
				return h.getMaterialType && h.getMaterialType(e);
			}), c.push(Promise.all(this._invokeAll(function(h) {
				return h.extendMaterialParams && h.extendMaterialParams(e, l);
			})));
		}
		i.doubleSided === !0 && (l.side = It);
		const d = i.alphaMode || xe.OPAQUE;
		if (d === xe.BLEND ? (l.transparent = !0, l.depthWrite = !1) : (l.transparent = !1, d === xe.MASK && (l.alphaTest = i.alphaCutoff !== void 0 ? i.alphaCutoff : 0.5)), i.normalTexture !== void 0 && r !== se && (c.push(t.assignTexture(l, "normalMap", i.normalTexture)), l.normalScale = new k(1, 1), i.normalTexture.scale !== void 0)) {
			const u = i.normalTexture.scale;
			l.normalScale.set(u, u);
		}
		if (i.occlusionTexture !== void 0 && r !== se && (c.push(t.assignTexture(l, "aoMap", i.occlusionTexture)), i.occlusionTexture.strength !== void 0 && (l.aoMapIntensity = i.occlusionTexture.strength)), i.emissiveFactor !== void 0 && r !== se) {
			const u = i.emissiveFactor;
			l.emissive = new Y().setRGB(u[0], u[1], u[2], K);
		}
		return i.emissiveTexture !== void 0 && r !== se && c.push(t.assignTexture(l, "emissiveMap", i.emissiveTexture, ie)), Promise.all(c).then(function() {
			const u = new r(l);
			return i.name && (u.name = i.name), V(u, i), t.associations.set(u, { materials: e }), i.extensions && X(s, u, i), u;
		});
	}
	/**
   * When Object3D instances are targeted by animation, they need unique names.
   *
   * @param {String} originalName
   * @return {String}
   */
	createUniqueName(e) {
		const t = Dt.sanitizeNodeName(e || "");
		return t in this.nodeNamesUsed ? t + "_" + ++this.nodeNamesUsed[t] : (this.nodeNamesUsed[t] = 0, t);
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
   *
   * Creates BufferGeometries from primitives.
   *
   * @param {Array<GLTF.Primitive>} primitives
   * @return {Promise<Array<BufferGeometry>>}
   */
	loadGeometries(e) {
		const t = this, o = this.extensions, s = this.primitiveCache;

		/**
		 *
		 */
		function i(l) {
			return o[E.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(l, t).then(function(a) {
				return Ve(a, l, t);
			});
		}

		const r = [];
		for (let l = 0, a = e.length; l < a; l++) {
			const c = e[l], d = Jn(c), u = s[d];
			if (u)
				r.push(u.promise);
			else {
				let h;
				c.extensions && c.extensions[E.KHR_DRACO_MESH_COMPRESSION] ? h = i(c) : h = Ve(new Nt(), c, t), s[d] = { primitive: c, promise: h }, r.push(h);
			}
		}
		return Promise.all(r);
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
   * @param {number} meshIndex
   * @return {Promise<Group|Mesh|SkinnedMesh>}
   */
	loadMesh(e) {
		const t = this, o = this.json, s = this.extensions, i = o.meshes[e], r = i.primitives, l = [];
		for (let a = 0, c = r.length; a < c; a++) {
			const d = r[a].material === void 0 ? Zn(this.cache) : this.getDependency("material", r[a].material);
			l.push(d);
		}
		return l.push(t.loadGeometries(r)), Promise.all(l).then(function(a) {
			const c = a.slice(0, a.length - 1), d = a[a.length - 1], u = [];
			for (let p = 0, m = d.length; p < m; p++) {
				const T = d[p], g = r[p];
				let f;
				const y = c[p];
				if (g.mode === B.TRIANGLES || g.mode === B.TRIANGLE_STRIP || g.mode === B.TRIANGLE_FAN || g.mode === void 0)
					f = i.isSkinnedMesh === !0 ? new Ot(T, y) : new Pt(T, y), f.isSkinnedMesh === !0 && f.normalizeSkinWeights(), g.mode === B.TRIANGLE_STRIP ? f.geometry = Be(f.geometry, Ze) : g.mode === B.TRIANGLE_FAN && (f.geometry = Be(f.geometry, Te));
				else if (g.mode === B.LINES)
					f = new Ut(T, y);
				else if (g.mode === B.LINE_STRIP)
					f = new kt(T, y);
				else if (g.mode === B.LINE_LOOP)
					f = new Ft(T, y);
				else if (g.mode === B.POINTS)
					f = new jt(T, y);
				else
					throw new Error("THREE.GLTFLoader: Primitive mode unsupported: " + g.mode);
				Object.keys(f.geometry.morphAttributes).length > 0 && Qn(f, i), f.name = t.createUniqueName(i.name || "mesh_" + e), V(f, i), g.extensions && X(s, f, g), t.assignFinalMaterial(f), u.push(f);
			}
			for (let p = 0, m = u.length; p < m; p++)
				t.associations.set(u[p], {
					meshes: e,
					primitives: p
				});
			if (u.length === 1)
				return i.extensions && X(s, u[0], i), u[0];
			const h = new me();
			i.extensions && X(s, h, i), t.associations.set(h, { meshes: e });
			for (let p = 0, m = u.length; p < m; p++)
				h.add(u[p]);
			return h;
		});
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
   * @param {number} cameraIndex
   * @return {Promise<THREE.Camera>}
   */
	loadCamera(e) {
		let t;
		const o = this.json.cameras[e], s = o[o.type];
		if (!s) {
			console.warn("THREE.GLTFLoader: Missing camera parameters.");
			return;
		}
		return o.type === "perspective" ? t = new Bt(Ye.radToDeg(s.yfov), s.aspectRatio || 1, s.znear || 1, s.zfar || 2e6) : o.type === "orthographic" && (t = new Ht(-s.xmag, s.xmag, s.ymag, -s.ymag, s.znear, s.zfar)), o.name && (t.name = this.createUniqueName(o.name)), V(t, o), Promise.resolve(t);
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
   * @param {number} skinIndex
   * @return {Promise<Skeleton>}
   */
	loadSkin(e) {
		const t = this.json.skins[e], o = [];
		for (let s = 0, i = t.joints.length; s < i; s++)
			o.push(this._loadNodeShallow(t.joints[s]));
		return t.inverseBindMatrices !== void 0 ? o.push(this.getDependency("accessor", t.inverseBindMatrices)) : o.push(null), Promise.all(o).then(function(s) {
			const i = s.pop(), r = s, l = [], a = [];
			for (let c = 0, d = r.length; c < d; c++) {
				const u = r[c];
				if (u) {
					l.push(u);
					const h = new ue();
					i !== null && h.fromArray(i.array, c * 16), a.push(h);
				} else
					console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', t.joints[c]);
			}
			return new zt(l, a);
		});
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   * @param {number} animationIndex
   * @return {Promise<AnimationClip>}
   */
	loadAnimation(e) {
		const t = this.json, o = this, s = t.animations[e], i = s.name ? s.name : "animation_" + e, r = [], l = [], a = [], c = [], d = [];
		for (let u = 0, h = s.channels.length; u < h; u++) {
			const p = s.channels[u], m = s.samplers[p.sampler], T = p.target, g = T.node, f = s.parameters !== void 0 ? s.parameters[m.input] : m.input, y = s.parameters !== void 0 ? s.parameters[m.output] : m.output;
			T.node !== void 0 && (r.push(this.getDependency("node", g)), l.push(this.getDependency("accessor", f)), a.push(this.getDependency("accessor", y)), c.push(m), d.push(T));
		}
		return Promise.all([
			Promise.all(r),
			Promise.all(l),
			Promise.all(a),
			Promise.all(c),
			Promise.all(d)
		]).then(function(u) {
			const h = u[0], p = u[1], m = u[2], T = u[3], g = u[4], f = [];
			for (let y = 0, v = h.length; y < v; y++) {
				const A = h[y], L = p[y], x = m[y], _ = T[y], w = g[y];
				if (A === void 0) continue;
				A.updateMatrix && A.updateMatrix();
				const R = o._createAnimationTracks(A, L, x, _, w);
				if (R)
					for (let D = 0; D < R.length; D++)
						f.push(R[D]);
			}
			return new Gt(i, void 0, f);
		});
	}
	/**
	 *
	 */
	createNodeMesh(e) {
		const t = this.json, o = this, s = t.nodes[e];
		return s.mesh === void 0 ? null : o.getDependency("mesh", s.mesh).then(function(i) {
			const r = o._getNodeRef(o.meshCache, s.mesh, i);
			return s.weights !== void 0 && r.traverse(function(l) {
				if (l.isMesh)
					for (let a = 0, c = s.weights.length; a < c; a++)
						l.morphTargetInfluences[a] = s.weights[a];
			}), r;
		});
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
   * @param {number} nodeIndex
   * @return {Promise<Object3D>}
   */
	loadNode(e) {
		const t = this.json, o = this, s = t.nodes[e], i = o._loadNodeShallow(e), r = [], l = s.children || [];
		for (let c = 0, d = l.length; c < d; c++)
			r.push(o.getDependency("node", l[c]));
		const a = s.skin === void 0 ? Promise.resolve(null) : o.getDependency("skin", s.skin);
		return Promise.all([
			i,
			Promise.all(r),
			a
		]).then(function(c) {
			const d = c[0], u = c[1], h = c[2];
			h !== null && d.traverse(function(p) {
				p.isSkinnedMesh && p.bind(h, ts);
			});
			for (let p = 0, m = u.length; p < m; p++)
				d.add(u[p]);
			return d;
		});
	}
	// ._loadNodeShallow() parses a single node.
	// skin and child nodes are created and added in .loadNode() (no '_' prefix).
	/**
	 *
	 */
	_loadNodeShallow(e) {
		const t = this.json, o = this.extensions, s = this;
		if (this.nodeCache[e] !== void 0)
			return this.nodeCache[e];
		const i = t.nodes[e], r = i.name ? s.createUniqueName(i.name) : "", l = [], a = s._invokeOne(function(c) {
			return c.createNodeMesh && c.createNodeMesh(e);
		});
		return a && l.push(a), i.camera !== void 0 && l.push(s.getDependency("camera", i.camera).then(function(c) {
			return s._getNodeRef(s.cameraCache, i.camera, c);
		})), s._invokeAll(function(c) {
			return c.createNodeAttachment && c.createNodeAttachment(e);
		}).forEach(function(c) {
			l.push(c);
		}), this.nodeCache[e] = Promise.all(l).then(function(c) {
			let d;
			if (i.isBone === !0 ? d = new Vt() : c.length > 1 ? d = new me() : c.length === 1 ? d = c[0] : d = new Qe(), d !== c[0])
				for (let u = 0, h = c.length; u < h; u++)
					d.add(c[u]);
			if (i.name && (d.userData.name = i.name, d.name = r), V(d, i), i.extensions && X(o, d, i), i.matrix !== void 0) {
				const u = new ue();
				u.fromArray(i.matrix), d.applyMatrix4(u);
			} else
				i.translation !== void 0 && d.position.fromArray(i.translation), i.rotation !== void 0 && d.quaternion.fromArray(i.rotation), i.scale !== void 0 && d.scale.fromArray(i.scale);
			return s.associations.has(d) || s.associations.set(d, {}), s.associations.get(d).nodes = e, d;
		}), this.nodeCache[e];
	}
	/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
   * @param {number} sceneIndex
   * @return {Promise<Group>}
   */
	loadScene(e) {
		const t = this.extensions, o = this.json.scenes[e], s = this, i = new me();
		o.name && (i.name = s.createUniqueName(o.name)), V(i, o), o.extensions && X(t, i, o);
		const r = o.nodes || [], l = [];
		for (let a = 0, c = r.length; a < c; a++)
			l.push(s.getDependency("node", r[a]));
		return Promise.all(l).then(function(a) {
			for (let d = 0, u = a.length; d < u; d++)
				i.add(a[d]);
			const c = (d) => {
				const u = /* @__PURE__ */ new Map();
				for (const [h, p] of s.associations)
					(h instanceof fe || h instanceof Ne) && u.set(h, p);
				return d.traverse((h) => {
					const p = s.associations.get(h);
					p != null && u.set(h, p);
				}), u;
			};
			return s.associations = c(i), i;
		});
	}
	/**
	 *
	 */
	_createAnimationTracks(e, t, o, s, i) {
		const r = [], l = e.name ? e.name : e.uuid, a = [];
		W[i.path] === W.weights ? e.traverse(function(h) {
			h.morphTargetInfluences && a.push(h.name ? h.name : h.uuid);
		}) : a.push(l);
		let c;
		switch (W[i.path]) {
		case W.weights:
			c = Pe;
			break;
		case W.rotation:
			c = Ue;
			break;
		case W.position:
		case W.scale:
			c = Oe;
			break;
		default:
			switch (o.itemSize) {
			case 1:
				c = Pe;
				break;
			case 2:
			case 3:
			default:
				c = Oe;
				break;
			}
			break;
		}
		const d = s.interpolation !== void 0 ? Yn[s.interpolation] : nt, u = this._getArrayFromAccessor(o);
		for (let h = 0, p = a.length; h < p; h++) {
			const m = new c(
				a[h] + "." + W[i.path],
				t.array,
				u,
				d
			);
			s.interpolation === "CUBICSPLINE" && this._createCubicSplineTrackInterpolant(m), r.push(m);
		}
		return r;
	}
	/**
	 *
	 */
	_getArrayFromAccessor(e) {
		let t = e.array;
		if (e.normalized) {
			const o = we(t.constructor), s = new Float32Array(t.length);
			for (let i = 0, r = t.length; i < r; i++)
				s[i] = t[i] * o;
			t = s;
		}
		return t;
	}
	/**
	 *
	 */
	_createCubicSplineTrackInterpolant(e) {
		e.createInterpolant = function(o) {
			const s = this instanceof Ue ? Xn : rt;
			return new s(this.times, this.values, this.getValueSize() / 3, o);
		}, e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = !0;
	}
}

/**
 *
 */
function ss(n, e, t) {
	const o = e.attributes, s = new Xt();
	if (o.POSITION !== void 0) {
		const l = t.json.accessors[o.POSITION], a = l.min, c = l.max;
		if (a !== void 0 && c !== void 0) {
			if (s.set(
				new N(a[0], a[1], a[2]),
				new N(c[0], c[1], c[2])
			), l.normalized) {
				const d = we(ee[l.componentType]);
				s.min.multiplyScalar(d), s.max.multiplyScalar(d);
			}
		} else {
			console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
			return;
		}
	} else
		return;
	const i = e.targets;
	if (i !== void 0) {
		const l = new N(), a = new N();
		for (let c = 0, d = i.length; c < d; c++) {
			const u = i[c];
			if (u.POSITION !== void 0) {
				const h = t.json.accessors[u.POSITION], p = h.min, m = h.max;
				if (p !== void 0 && m !== void 0) {
					if (a.setX(Math.max(Math.abs(p[0]), Math.abs(m[0]))), a.setY(Math.max(Math.abs(p[1]), Math.abs(m[1]))), a.setZ(Math.max(Math.abs(p[2]), Math.abs(m[2]))), h.normalized) {
						const T = we(ee[h.componentType]);
						a.multiplyScalar(T);
					}
					l.max(a);
				} else
					console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
			}
		}
		s.expandByVector(l);
	}
	n.boundingBox = s;
	const r = new Yt();
	s.getCenter(r.center), r.radius = s.min.distanceTo(s.max) / 2, n.boundingSphere = r;
}

/**
 *
 */
function Ve(n, e, t) {
	const o = e.attributes, s = [];

	/**
	 *
	 */
	function i(r, l) {
		return t.getDependency("accessor", r).then(function(a) {
			n.setAttribute(l, a);
		});
	}

	for (const r in o) {
		const l = Ae[r] || r.toLowerCase();
		l in n.attributes || s.push(i(o[r], l));
	}
	if (e.indices !== void 0 && !n.index) {
		const r = t.getDependency("accessor", e.indices).then(function(l) {
			n.setIndex(l);
		});
		s.push(r);
	}
	return ke.workingColorSpace !== K && "COLOR_0" in o && console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${ke.workingColorSpace}" not supported.`), V(n, e), ss(n, e, t), Promise.all(s).then(function() {
		return e.targets !== void 0 ? qn(n, e.targets, t) : n;
	});
}

const q = /* @__PURE__ */ new WeakMap();

/**
 *
 */
function at(n, e) {
	if (console.log(`Switching to UV channel: ${e}`), !n.modelObject || !n.textureObject) {
		console.warn("Cannot switch UV channel: Model or texture not loaded");
		return;
	}
	let t;
	if (typeof e == "number")
		t = e === 0 ? "uv" : `uv${e + 1}`;
	else if (typeof e == "string") {
		t = e;
		const i = t === "uv" ? 0 : parseInt(t.replace("uv", "")) - 1;
		n.currentUvSet = i;
	} else {
		console.error("Invalid UV channel type:", typeof e);
		return;
	}
	let o = 0, s = 0;
	n.modelObject.traverse((i) => {
		if (i.isMesh && (i.userData.originalMaterial || (i.userData.originalMaterial = i.material.clone()), i.name.toLowerCase().includes("screen") || i.name.toLowerCase().includes("display") || i.name.toLowerCase().includes("monitor"))) {
			s++;
			const l = i.geometry && i.geometry.attributes[t] !== void 0;
			if (console.log(`Processing screen mesh: ${i.name}, has ${t}: ${l}`), n.textureObject && l) {
				o++;
				const a = new M.MeshStandardMaterial();
				a.roughness = 0.1, a.metalness = 0.2;
				const c = n.textureObject.clone();
				c.flipY = !1, c.encoding = M.sRGBEncoding, c.offset.set(0, 0), c.repeat.set(1, 1), c.needsUpdate = !0, !q.has(i) && i.geometry.attributes.uv && (q.set(i, i.geometry.attributes.uv.clone()), console.log(`Stored original UV data for ${i.name}`)), a.map = c, a.emissiveMap = c, a.emissive.set(1, 1, 1), t === "uv" ? q.has(i) && (i.geometry.attributes.uv = q.get(i).clone(), i.geometry.attributes.uv.needsUpdate = !0, console.log(`Restored original UV data for ${i.name}`)) : i.geometry.attributes[t] && (q.has(i) || (q.set(i, i.geometry.attributes.uv.clone()), console.log(`Stored original UV data for ${i.name}`)), i.geometry.attributes.uv = i.geometry.attributes[t].clone(), i.geometry.attributes.uv.needsUpdate = !0, console.log(`Applied ${t} to primary UV channel for ${i.name}`)), a.needsUpdate = !0, i.material = a, n.screenMeshes || (n.screenMeshes = []), n.screenMeshes.includes(i) || n.screenMeshes.push(i);
			}
		}
	}), is(n, typeof e == "number" ? e : t === "uv" ? 0 : parseInt(t.replace("uv", "")) - 1), console.log(`Switched to UV channel ${t}: ${o}/${s} screen meshes affected`), n.renderer && n.camera && n.scene && n.renderer.render(n.scene, n.camera), os(n, t);
}

/**
 *
 */
function os(n, e) {
	if (!n.scene) return null;
	let t = 1, o = 1, s = 0, i = 0, r = !1, l;
	if (typeof e == "number")
		l = e === 0 ? "uv" : `uv${e + 1}`;
	else if (typeof e == "string")
		l = e;
	else
		return console.error("Invalid channel type in analyzeUvBounds:", typeof e), null;
	if (n.scene.traverse((c) => {
		if (c.isMesh && c.geometry && c.geometry.attributes && c.visible) {
			const u = c.geometry.attributes[l];
			if (u && u.array) {
				r = !0;
				for (let h = 0; h < u.count; h++) {
					const p = u.getX(h), m = u.getY(h);
					isNaN(p) || isNaN(m) || (t = Math.min(t, p), o = Math.min(o, m), s = Math.max(s, p), i = Math.max(i, m));
				}
			}
		}
	}), !r)
		return null;
	const a = 0.01;
	return t = Math.max(0, t - a), o = Math.max(0, o - a), s = Math.min(1, s + a), i = Math.min(1, i + a), {
		min: [t, o],
		max: [s, i]
	};
}

/**
 *
 */
function is(n, e) {
	const t = document.getElementById("uv-info-container");
	if (!t) return;
	let o;
	if (typeof e == "number")
		o = e === 0 ? "uv" : `uv${e + 1}`;
	else if (typeof e == "string")
		o = e;
	else {
		console.error("Invalid UV channel type in updateUvDisplayInformation:", typeof e);
		return;
	}
	let s = 0, i = 0, r = 0, l = 0, a = 1 / 0, c = -1 / 0, d = 1 / 0, u = -1 / 0, h = "", p = [];
	n.scene.traverse((y) => {
		if (y.isMesh) {
			r++;
			const v = y.geometry;
			if (v && v.attributes) {
				const A = y.name.toLowerCase().includes("screen") || y.name.toLowerCase().includes("display") || y.name.toLowerCase().includes("monitor"), L = v.attributes[o];
				if (L) {
					s++, A && i++, l += L.count;
					for (let x = 0; x < L.count; x++) {
						const _ = L.getX(x), w = L.getY(x);
						isNaN(_) || isNaN(w) || (a = Math.min(a, _), c = Math.max(c, _), d = Math.min(d, w), u = Math.max(u, w));
					}
					if (A && p.length === 0) {
						h = y.name;
						const x = Math.min(5, L.count);
						for (let _ = 0; _ < x; _++)
							p.push({
								index: _,
								u: L.getX(_),
								v: L.getY(_)
							});
						L.count > x && p.push({
							note: `... and ${L.count - x} more vertices`
						});
					}
				}
			}
		}
	});
	let m = "Unknown", T = "Unknown";
	if (a === 1 / 0) {
		t.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">No meshes with ${o} channel found</span>`;
		return;
	}
	if (c > 1 || a < 0 || u > 1 || d < 0)
		m = "Tiling / Repeating";
	else {
		m = "Standard (0-1 Range)";
		const y = c - a, v = u - d;
		y < 0.5 || v < 0.5 ? T = "Partial Texture" : T = "Full Texture";
	}
	const g = document.getElementById("uv-channel-select");
	if (g)
		for (let y = 0; y < g.options.length; y++)
			g.options[y].value === o && (g.options[y].textContent = `${o.toUpperCase()} - ${T} (U: ${a.toFixed(2)}-${c.toFixed(2)}, V: ${d.toFixed(2)}-${u.toFixed(2)})`);
	let f = '<div style="background-color: #222; padding: 10px; border-radius: 5px;">';
	f += '<div style="color: #f1c40f; font-weight: bold; margin-bottom: 5px;">UV Channel Info:</div>', f += `<div>Channel Name: <span style="color: #3498db;">${o}</span></div>`, f += `<div>Mapping Type: <span style="color: #3498db;">${m}</span></div>`, f += `<div>Texture Usage: <span style="color: #3498db;">${T}</span></div>`, f += '<div style="color: #f1c40f; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">Mesh Statistics:</div>', f += `<div>Meshes with this UV: <span style="color: #3498db;">${s} of ${r}</span></div>`, f += `<div>Screen Meshes: <span style="color: #3498db;">${i}</span></div>`, f += `<div>Total Vertices: <span style="color: #3498db;">${l}</span></div>`, f += `<div>UV Range: U: <span style="color: #3498db;">${a.toFixed(4)} to ${c.toFixed(4)}</span>, V: <span style="color: #3498db;">${d.toFixed(4)} to ${u.toFixed(4)}</span></div>`, h && p.length > 0 && (f += `<div style="color: #f1c40f; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">Sample UV Coordinates from ${h}:</div>`, p.forEach((y) => {
		y.note ? f += `<div>${y.note}</div>` : f += `<div>Vertex ${y.index}: (${y.u.toFixed(4)}, ${y.v.toFixed(4)})</div>`;
	})), f += "</div>", t.innerHTML = f;
}

/**
 *
 */
function rs(n) {
	if (!n.scene) return ["uv"];
	const e = /* @__PURE__ */ new Set(["uv"]);
	return n.scene.traverse((t) => {
		t.isMesh && t.geometry && t.geometry.attributes && (t.geometry.attributes.uv2 && e.add("uv2"), t.geometry.attributes.uv3 && e.add("uv3"));
	}), Array.from(e);
}

/**
 *
 */
function as(n) {
	if (!n.scene || !n.modelFile)
		return null;
	const e = {
		name: n.modelFile.name,
		size: n.modelFile.size,
		uvSets: rs(n),
		meshes: []
	};
	return n.scene.traverse((t) => {
		t.isMesh && e.meshes.push(t);
	}), e;
}

/**
 *
 */
async function ls(n, e) {
	return new Promise((t, o) => {
		if (!e) {
			o(new Error("No texture file provided"));
			return;
		}
		const s = new M.TextureLoader(), i = URL.createObjectURL(e);
		s.load(
			i,
			(r) => {
				console.log("Texture loaded:", r), n.textureObject = r, r.flipY = !1, r.encoding = M.sRGBEncoding, n.modelLoaded && n.modelObject && cs(n);
				const l = {
					name: e.name,
					size: e.size,
					dimensions: {
						width: r.image.width,
						height: r.image.height
					}
				};
				Se && Se(l), URL.revokeObjectURL(i), document.dispatchEvent(new CustomEvent("textureLoaded")), t(r);
			},
			void 0,
			// Progress callback
			(r) => {
				console.error("Error loading texture:", r), URL.revokeObjectURL(i), o(r);
			}
		);
	});
}

/**
 *
 */
function cs(n) {
	if (!n.modelObject || !n.textureObject) {
		console.warn("Cannot apply texture: Model or texture not loaded", {
			modelExists: !!n.modelObject,
			textureExists: !!n.textureObject
		});
		return;
	}
	if (console.log("Applying texture to model", n.textureObject), n.modelObject.traverse((e) => {
		if (e.isMesh && e.material && (e.userData.originalMaterial || (e.userData.originalMaterial = e.material.clone()), e.name.toLowerCase().includes("screen") || e.name.toLowerCase().includes("display") || e.name.toLowerCase().includes("monitor"))) {
			if (console.log(`Setting up screen mesh: ${e.name}`), e.geometry) {
				let s = "UV Sets: ";
				const i = [];
				for (let r = 0; r < 8; r++)
					i.push(r === 0 ? "uv" : `uv${r + 1}`);
				i.forEach((r) => {
					e.geometry.attributes[r] && (s += `${r}, `);
				}), console.log(s);
			}
			const o = new M.MeshStandardMaterial();
			e.userData.originalMaterial ? (o.roughness = e.userData.originalMaterial.roughness || 0.1, o.metalness = e.userData.originalMaterial.metalness || 0.2) : (o.roughness = 0.1, o.metalness = 0.2), o.map = n.textureObject.clone(), o.map.flipY = !1, o.map.encoding = M.sRGBEncoding, o.map.wrapS = M.ClampToEdgeWrapping, o.map.wrapT = M.ClampToEdgeWrapping, o.map.minFilter = M.LinearFilter, o.map.magFilter = M.LinearFilter, o.emissiveMap = o.map, o.emissive.set(1, 1, 1), o.map.offset.set(0, 0), o.map.repeat.set(1, 1), o.emissiveMap.offset.set(0, 0), o.emissiveMap.repeat.set(1, 1), o.map.needsUpdate = !0, o.emissiveMap.needsUpdate = !0, o.needsUpdate = !0, e.material = o, n.screenMeshes || (n.screenMeshes = []), n.screenMeshes.includes(e) || n.screenMeshes.push(e);
		}
	}), n.renderer && n.camera && n.scene) {
		console.log("Forcing render update"), n.renderer.render(n.scene, n.camera);
		try {
			Promise.resolve().then(() => ys).then((e) => {
				console.log("Auto-showing texture atlas visualization"), e.createAtlasVisualization(n), n.renderer && n.camera && n.scene && setTimeout(() => {
					n.renderer.render(n.scene, n.camera), console.log("Atlas visualization should now be visible");
				}, 100);
			});
		} catch (e) {
			console.error("Failed to auto-show atlas visualization:", e);
		}
	}
}

/**
 *
 */
function Is(n) {
	return n < 1024 ? n + " bytes" : n < 1024 * 1024 ? (n / 1024).toFixed(1) + " KB" : (n / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 *
 */
function Ds(n) {
	return n.slice((n.lastIndexOf(".") - 1 >>> 0) + 2);
}

/**
 *
 */
function Ns(n, e = {}, t = []) {
	const o = document.createElement(n);
	return Object.entries(e).forEach(([s, i]) => {
		if (s === "style" && typeof i == "object")
			Object.assign(o.style, i);
		else if (s === "className")
			o.className = i;
		else if (s === "textContent")
			o.textContent = i;
		else if (s.startsWith("on") && typeof i == "function") {
			const r = s.slice(2).toLowerCase();
			o.addEventListener(r, i);
		} else
			o[s] = i;
	}), t.forEach((s) => {
		typeof s == "string" ? o.appendChild(document.createTextNode(s)) : s instanceof Node && o.appendChild(s);
	}), o;
}

let C = null;

/**
 *
 */
function ds(n) {
	if (!n.textureObject) {
		alert("No texture loaded. Please load a texture first.");
		return;
	}
	if (C) {
		const i = C.style.display !== "none";
		C.style.display = i ? "none" : "block";
		return;
	}
	C = document.createElement("div"), C.id = "texture-editor", C.style.position = "fixed", C.style.left = "50%", C.style.top = "50%", C.style.transform = "translate(-50%, -50%)", C.style.width = "80%", C.style.maxWidth = "800px", C.style.maxHeight = "80vh", C.style.backgroundColor = "rgba(40, 40, 40, 0.95)", C.style.color = "white", C.style.padding = "20px", C.style.borderRadius = "8px", C.style.zIndex = "1000", C.style.boxShadow = "0 0 20px rgba(0, 0, 0, 0.5)", C.style.overflowY = "auto";
	const e = document.createElement("div");
	e.style.display = "flex", e.style.justifyContent = "space-between", e.style.alignItems = "center", e.style.marginBottom = "20px";
	const t = document.createElement("h2");
	t.textContent = "Texture Editor", t.style.margin = "0";
	const o = document.createElement("button");
	o.textContent = "×", o.style.background = "none", o.style.border = "none", o.style.color = "white", o.style.fontSize = "24px", o.style.cursor = "pointer", o.addEventListener("click", () => {
		C.style.display = "none";
	}), e.appendChild(t), e.appendChild(o), C.appendChild(e);
	const s = document.createElement("div");
	s.style.textAlign = "center", s.style.padding = "40px", s.style.color = "#aaa", s.innerHTML = `
    <p>Texture Editor will be implemented in a future update.</p>
    <p>Planned features include:</p>
    <ul style="text-align: left; display: inline-block;">
      <li>Basic adjustments (brightness, contrast, saturation)</li>
      <li>Channel viewing and editing</li>
      <li>UV island visualization</li>
      <li>Texture baking tools</li>
    </ul>
  `, C.appendChild(s), document.body.appendChild(C);
}

let b = null;

/**
 *
 */
function Ie(n) {
	if (!n.textureObject) {
		console.warn("No texture loaded. Cannot create atlas visualization.");
		return;
	}
	const e = document.querySelectorAll("#atlas-visualization");
	if (e.length > 1)
		for (let d = 1; d < e.length; d++)
			document.body.contains(e[d]) && document.body.removeChild(e[d]);
	if (b) {
		b.style.display === "none" && (b.style.display = "block"), he(n.textureObject, n.currentUvRegion || { min: [0, 0], max: [1, 1] });
		return;
	}
	b = document.createElement("div"), b.id = "atlas-visualization", b.style.position = "absolute", b.style.bottom = "20px", b.style.left = "20px", b.style.width = "300px", b.style.height = "auto", b.style.backgroundColor = "rgba(0, 0, 0, 0.8)", b.style.border = "1px solid #666", b.style.borderRadius = "5px", b.style.color = "white", b.style.fontFamily = "monospace", b.style.fontSize = "12px", b.style.zIndex = "1000", b.style.boxSizing = "border-box", b.style.overflow = "hidden";
	const t = document.createElement("div");
	t.style.display = "flex", t.style.justifyContent = "space-between", t.style.alignItems = "center", t.style.padding = "10px", t.style.cursor = "move", t.style.borderBottom = "1px solid #444";
	const o = document.createElement("div");
	o.style.display = "flex", o.style.alignItems = "center";
	const s = document.createElement("span");
	s.textContent = "▼", s.style.marginRight = "5px", s.style.cursor = "pointer", s.style.fontSize = "10px", s.style.color = "#aaa", s.style.transition = "transform 0.2s";
	const i = document.createElement("div");
	i.className = "atlas-content", i.style.padding = "10px", i.style.paddingTop = "5px", i.style.display = "block", s.addEventListener("click", (d) => {
		if (d.stopPropagation(), i.style.display === "none")
			i.style.display = "block", s.textContent = "▼", t.style.borderBottom = "1px solid #444", b.style.transition = "height 0.3s ease", b.style.height = "auto", setTimeout(() => {
				b.style.transition = "";
			}, 300);
		else {
			const h = t.offsetHeight;
			i.style.display = "none", s.textContent = "►", t.style.borderBottom = "none", b.style.transition = "height 0.3s ease", b.style.height = `${h}px`, setTimeout(() => {
				b.style.transition = "";
			}, 300);
		}
	}), o.appendChild(s);
	const r = document.createElement("div");
	r.className = "atlas-title", r.textContent = "Atlas Texture Visualization", r.style.fontWeight = "bold", o.appendChild(r), t.appendChild(o);
	const l = document.createElement("button");
	l.textContent = "×", l.style.background = "none", l.style.border = "none", l.style.color = "white", l.style.fontSize = "16px", l.style.cursor = "pointer", l.style.padding = "0 5px", l.addEventListener("click", (d) => {
		d.stopPropagation(), b.style.display = "none";
	}), t.appendChild(l), b.appendChild(t), b.appendChild(i);
	const a = document.createElement("canvas");
	a.style.width = "100%", a.style.border = "1px solid #444", a.style.display = "block", a.style.maxHeight = "400px", i.appendChild(a);
	const c = document.createElement("div");
	return c.className = "coords-text", c.style.marginTop = "5px", c.style.fontSize = "10px", c.style.color = "#aaa", c.textContent = "UV coordinates: Full texture is shown", i.appendChild(c), document.body.appendChild(b), he(n.textureObject, { min: [0, 0], max: [1, 1] }), console.log("Atlas visualization created with HTML canvas"), gs(b), b;
}

/**
 *
 */
function us(n) {
	if (!n.textureObject || !b) return;
	const e = n.currentUvRegion || { min: [0, 0], max: [1, 1] };
	he(n.textureObject, e), b.style.display === "none" && (b.style.display = "block"), console.log("Atlas visualization updated with new texture");
}

/**
 *
 */
function he(n, e = { min: [0, 0], max: [1, 1] }) {
	if (!b || !n || !n.image) return;
	let t = b.querySelector("canvas");
	if (!t) {
		t = document.createElement("canvas"), t.style.width = "100%", t.style.border = "1px solid #444", t.style.display = "block", t.style.maxHeight = "300px";
		const c = b.querySelector(".atlas-content");
		c ? c.appendChild(t) : b.appendChild(t);
	}
	const o = 280, s = 280, i = n.image.height / n.image.width;
	t.width = Math.min(n.image.width, o), t.height = Math.min(t.width * i, s);
	const r = t.getContext("2d");
	r.clearRect(0, 0, t.width, t.height);
	try {
		r.drawImage(n.image, 0, 0, t.width, t.height);
	} catch (c) {
		console.error("Error drawing texture to canvas:", c);
	}
	hs(r, t.width, t.height), ps(r, e, t.width, t.height);
	let l = b.querySelector(".coords-text");
	if (!l) {
		l = document.createElement("div"), l.className = "coords-text", l.style.marginTop = "5px", l.style.marginBottom = "0", l.style.fontSize = "10px", l.style.color = "#aaa";
		const c = b.querySelector(".atlas-content");
		c ? c.appendChild(l) : b.appendChild(l);
	}
	e.min[0] === 0 && e.min[1] === 0 && e.max[0] === 1 && e.max[1] === 1 ? l.textContent = "Currently using: Full texture (0,0) to (1,1)" : l.textContent = `Currently using: (${e.min[0].toFixed(2)},${e.min[1].toFixed(2)}) to (${e.max[0].toFixed(2)},${e.max[1].toFixed(2)})`;
}

/**
 *
 */
function hs(n, e, t) {
	n.strokeStyle = "rgba(255, 255, 255, 0.3)", n.lineWidth = 1;
	for (let o = 1; o < 10; o++) {
		const s = e * o / 10;
		n.beginPath(), n.moveTo(s, 0), n.lineTo(s, t), n.stroke();
	}
	for (let o = 1; o < 10; o++) {
		const s = t * o / 10;
		n.beginPath(), n.moveTo(0, s), n.lineTo(e, s), n.stroke();
	}
	n.fillStyle = "white", n.font = "10px monospace", n.fillText("0,0", 2, t - 2), n.fillText("1,0", e - 20, t - 2), n.fillText("0,1", 2, 10), n.fillText("1,1", e - 20, 10);
}

/**
 *
 */
function ps(n, e, t, o) {
	n.strokeStyle = "red", n.lineWidth = 2, n.beginPath();
	const s = t * e.min[0], i = o * (1 - e.max[1]), r = t * (e.max[0] - e.min[0]), l = o * (e.max[1] - e.min[1]);
	n.rect(s, i, r, l), n.stroke(), n.fillStyle = "rgba(255, 0, 0, 0.1)", n.fill();
}

/**
 *
 */
function fs() {
	b && (document.body.contains(b) && document.body.removeChild(b), b = null);
}

/**
 *
 */
function ms(n, e, t) {
	if (t.textureObject)
		return t.currentUvRegion = { min: n, max: e }, b && (he(t.textureObject, t.currentUvRegion), b.style.display === "none" && (b.style.display = "block")), console.log(`Updated current UV region to: (${n[0].toFixed(2)},${n[1].toFixed(2)}) - (${e[0].toFixed(2)},${e[1].toFixed(2)})`), t.currentUvRegion;
}

/**
 *
 */
function gs(n) {
	let e = !1, t = { x: 0, y: 0 };
	const o = { left: 20, bottom: 20 }, s = 50, i = n.querySelector("div:first-child");
	i && (i.style.cursor = "move", i.addEventListener("mousedown", (r) => {
		e = !0, t.x = r.clientX - n.offsetLeft, t.y = r.clientY - n.offsetTop, n.style.opacity = "0.8";
	}), document.addEventListener("mousemove", (r) => {
		if (!e) return;
		const l = r.clientX - t.x, a = r.clientY - t.y, c = window.innerWidth - n.offsetWidth, d = window.innerHeight - n.offsetHeight;
		n.style.left = Math.min(Math.max(0, l), c) + "px", n.style.top = Math.min(Math.max(0, a), d) + "px", n.style.bottom = "auto";
	}), document.addEventListener("mouseup", () => {
		if (!e) return;
		e = !1, n.style.opacity = "1";
		const r = n.getBoundingClientRect(), l = r.left, a = window.innerHeight - r.bottom, c = Math.abs(l - o.left) < s, d = Math.abs(a - o.bottom) < s;
		c && d && (n.style.transition = "left 0.3s ease, bottom 0.3s ease, top 0.3s ease", n.style.left = `${o.left}px`, n.style.bottom = `${o.bottom}px`, n.style.top = "auto", setTimeout(() => {
			n.style.transition = "";
		}, 300));
	}));
}

const ys = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
	__proto__: null,
	createAtlasVisualization: Ie,
	removeAtlasVisualization: fs,
	setCurrentUvRegion: ms,
	updateAtlasVisualization: us
}, Symbol.toStringTag, { value: "Module" }));
let Me = null, Se = null;

/**
 *
 */
function xs(n) {
	Ts(n);
}

/**
 *
 */
function bs(n) {
	console.log("Starting debugging with files:", n.modelFile, n.textureFile);
	const e = document.getElementById("drop-container");
	e && (e.style.display = "none");
	const t = document.getElementById("loading");
	t && (t.style.display = "flex"), n.renderer && (n.renderer.domElement.style.display = "block"), n.isDebugMode = !0;
	const o = document.getElementById("debug-panel");
	o && (o.style.display = "block");
}

/**
 *
 */
function Ts(n) {
	const e = document.createElement("div");
	e.id = "debug-panel", e.style.position = "fixed", e.style.top = "20px", e.style.right = "20px", e.style.backgroundColor = "rgba(0, 0, 0, 0.7)", e.style.padding = "15px", e.style.borderRadius = "8px", e.style.width = "300px", e.style.maxHeight = "calc(100vh - 40px)", e.style.overflowY = "auto", e.style.zIndex = "100", e.style.display = "none", e.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.5)";
	const t = document.createElement("h3");
	t.textContent = "Asset Debug Info", t.style.marginTop = "0", t.style.color = "#3498db", e.appendChild(t);
	const o = document.createElement("div");
	o.className = "debug-section", o.style.marginBottom = "15px";
	const s = document.createElement("div");
	s.className = "debug-label", s.textContent = "Model Info:", s.style.fontWeight = "bold", s.style.marginBottom = "5px", s.style.color = "#95a5a6";
	const i = document.createElement("div");
	i.id = "model-info", i.className = "debug-value", i.textContent = "No model loaded", i.style.fontFamily = "monospace", i.style.backgroundColor = "rgba(0, 0, 0, 0.5)", i.style.padding = "5px", i.style.borderRadius = "3px", i.style.wordBreak = "break-word", o.appendChild(s), o.appendChild(i), e.appendChild(o);
	const r = document.createElement("div");
	r.className = "debug-section", r.style.marginBottom = "15px";
	const l = document.createElement("div");
	l.className = "debug-label", l.textContent = "Texture Info:", l.style.fontWeight = "bold", l.style.marginBottom = "5px", l.style.color = "#95a5a6";
	const a = document.createElement("div");
	a.id = "texture-info", a.className = "debug-value", a.textContent = "No texture loaded", a.style.fontFamily = "monospace", a.style.backgroundColor = "rgba(0, 0, 0, 0.5)", a.style.padding = "5px", a.style.borderRadius = "3px", a.style.wordBreak = "break-word", r.appendChild(l), r.appendChild(a), e.appendChild(r);
	const c = document.createElement("div");
	c.className = "debug-section", c.style.marginBottom = "15px";
	const d = document.createElement("div");
	d.className = "debug-label", d.textContent = "Mesh Visibility:", d.style.fontWeight = "bold", d.style.marginBottom = "5px", d.style.color = "#95a5a6";
	const u = document.createElement("div");
	u.id = "mesh-toggles";
	const h = document.createElement("div");
	h.style.fontSize = "0.85em", h.style.color = "#999", h.style.marginTop = "5px", h.textContent = "Toggle visibility of individual meshes or entire groups.", c.appendChild(d), c.appendChild(u), c.appendChild(h), e.appendChild(c);
	const p = document.createElement("div");
	p.className = "debug-section", p.id = "uv-info-section", e.appendChild(p);
	const m = document.createElement("div");
	m.className = "debug-section";
	const T = document.createElement("button");
	T.className = "debug-button", T.textContent = "Show Texture Atlas", T.style.width = "100%", T.style.padding = "8px", T.style.marginBottom = "10px", T.style.backgroundColor = "#e67e22", T.addEventListener("click", () => {
		Ie(n);
	}), m.appendChild(T), e.appendChild(m);
	const g = document.createElement("div");
	g.className = "debug-section";
	const f = document.createElement("button");
	f.className = "debug-button", f.textContent = "Open Texture Editor", f.style.width = "100%", f.style.padding = "8px", f.style.marginTop = "10px", f.style.backgroundColor = "#9b59b6", f.addEventListener("click", () => {
		ds(n);
	}), g.appendChild(f), e.appendChild(g), document.body.appendChild(e);

	/**
	 *
	 */
	function y(x) {
		const _ = document.getElementById("model-info");
		if (_)
			if (x) {
				let w = "";
				w += `Name: ${x.name || "Unknown"}<br>`, w += `Size: ${L(x.size || 0)}<br>`, x.uvSets && x.uvSets.length > 0 ? (w += `<span style="color: #3498db; font-weight: bold;">UV Maps: ${x.uvSets.join(", ")}</span><br>`, console.log("UV Sets detected:", x.uvSets)) : w += '<span style="color: #e74c3c;">No UV maps detected</span><br>', x.meshes && x.meshes.length > 0 && (w += `<br>Meshes: ${x.meshes.length}<br>`, v(x.meshes)), _.innerHTML = w;
			} else
				_.textContent = "No model loaded";
	}

	/**
	 *
	 */
	function v(x) {
		const _ = document.getElementById("mesh-toggles");
		if (!_) return;
		_.innerHTML = "";
		const w = {};
		x.forEach((R) => {
			let D = "unclassified";
			if (R.name) {
				const P = R.name.indexOf("_");
				P > 0 ? D = R.name.substring(0, P) : D = R.name;
			} else R.parent && R.parent.name && (D = R.parent.name);
			w[D] || (w[D] = []), w[D].push(R);
		});
		for (const R in w) {
			const D = w[R], P = document.createElement("div");
			P.style.marginBottom = "15px", P.style.padding = "8px", P.style.backgroundColor = "rgba(0, 0, 0, 0.3)", P.style.borderRadius = "5px";
			const z = document.createElement("div");
			z.style.display = "flex", z.style.justifyContent = "space-between", z.style.alignItems = "center", z.style.marginBottom = "8px", z.style.cursor = "pointer";
			const re = document.createElement("div");
			re.textContent = `Group: ${R} (${D.length} mesh${D.length > 1 ? "es" : ""})`, re.style.fontWeight = "bold", re.style.color = "#3498db", z.appendChild(re);
			const U = document.createElement("button");
			U.textContent = "Hide", U.className = "debug-button", U.style.marginLeft = "10px", U.style.marginRight = "10px", U.style.padding = "2px 8px", U.style.minWidth = "45px", U.style.backgroundColor = "#3498db", U.style.color = "white", U.style.fontWeight = "bold", U.addEventListener("click", (H) => {
				H.stopPropagation();
				const $ = D.some((F) => F.visible);
				D.forEach((F) => {
					F.visible = !$;
				}), U.textContent = $ ? "Show" : "Hide", U.style.backgroundColor = $ ? "#95a5a6" : "#3498db", Z.querySelectorAll(".mesh-toggle").forEach((F) => {
					F.style.backgroundColor = $ ? "#95a5a6" : "#3498db";
				});
			}), z.appendChild(U);
			const te = document.createElement("span");
			te.textContent = "▼", te.style.transition = "transform 0.3s", z.appendChild(te), P.appendChild(z);
			const Z = document.createElement("div");
			Z.style.display = "none";
			const ae = document.createElement("div");
			ae.style.marginLeft = "10px", ae.style.marginTop = "5px", D.forEach((H) => {
				const $ = document.createElement("div");
				$.style.margin = "5px 0";
				const F = document.createElement("button");
				F.textContent = H.name || "Unnamed Mesh", F.className = "debug-button mesh-toggle", F.style.backgroundColor = H.visible ? "#3498db" : "#95a5a6", F.addEventListener("click", (ct) => {
					ct.stopPropagation(), H.visible = !H.visible, F.style.backgroundColor = H.visible ? "#3498db" : "#95a5a6";
				}), $.appendChild(F), ae.appendChild($);
			}), Z.appendChild(ae), P.appendChild(Z), z.addEventListener("click", () => {
				const H = Z.style.display === "none";
				Z.style.display = H ? "block" : "none", te.textContent = H ? "▲" : "▼", te.style.transform = "rotate(0deg)";
			}), _.appendChild(P);
		}
	}

	/**
	 *
	 */
	function A(x) {
		const _ = document.getElementById("texture-info");
		if (_)
			if (x && x.textureFile) {
				const w = x.textureFile;
				let R = "";
				R += `Name: ${w.name || "Unknown"}<br>`, R += `Size: ${L(w.size || 0)}<br>`, x.textureObject && x.textureObject.image && (R += `Dimensions: ${x.textureObject.image.width} x ${x.textureObject.image.height}<br>`), _.innerHTML = R;
			} else if (x) {
				let w = "";
				w += `Name: ${x.name || "Unknown"}<br>`, w += `Size: ${L(x.size || 0)}<br>`, x.dimensions && (w += `Dimensions: ${x.dimensions.width} x ${x.dimensions.height}<br>`), _.innerHTML = w;
			} else
				_.textContent = "No texture loaded";
	}

	/**
	 *
	 */
	function L(x, _ = 2) {
		if (x === 0) return "0 Bytes";
		const w = 1024, R = _ < 0 ? 0 : _, D = ["Bytes", "KB", "MB", "GB"], P = Math.floor(Math.log(x) / Math.log(w));
		return parseFloat((x / Math.pow(w, P)).toFixed(R)) + " " + D[P];
	}

	return Me = y, Se = A, n.updateModelInfo = y, n.updateTextureInfo = A, e;
}

/**
 *
 */
function Ke(n) {
	if (!n.modelObject || !n.textureObject) {
		console.log("Cannot show atlas visualization: Model or texture not loaded");
		return;
	}
	console.log("Auto-showing atlas visualization"), n.availableUvSets = [], n.uvSetNames = [];
	const e = [];
	for (let s = 0; s < 8; s++)
		e.push(s === 0 ? "uv" : `uv${s + 1}`);
	const t = /* @__PURE__ */ new Map();
	n.modelObject.traverse((s) => {
		s.isMesh && s.geometry && e.forEach((i) => {
			if (s.geometry.attributes[i]) {
				t.has(i) || t.set(i, {
					count: 0,
					minU: 1 / 0,
					maxU: -1 / 0,
					minV: 1 / 0,
					maxV: -1 / 0,
					sampleUVs: null,
					sampleMesh: null,
					meshes: []
				});
				const r = t.get(i);
				r.count++, r.meshes.push(s), (s.name.toLowerCase().includes("screen") || s.name.toLowerCase().includes("display") || s.name.toLowerCase().includes("monitor")) && !r.sampleUVs && (r.sampleUVs = s.geometry.attributes[i].array, r.sampleMesh = s);
				const a = s.geometry.attributes[i];
				for (let c = 0; c < a.count; c++) {
					const d = a.getX(c), u = a.getY(c);
					isNaN(d) || isNaN(u) || (r.minU = Math.min(r.minU, d), r.maxU = Math.max(r.maxU, d), r.minV = Math.min(r.minV, u), r.maxV = Math.max(r.maxV, u));
				}
			}
		});
	}), t.forEach((s, i) => {
		let r = "Unknown";
		if (!(s.maxU > 1 || s.minU < 0 || s.maxV > 1 || s.minV < 0)) {
			const a = s.maxU - s.minU, c = s.maxV - s.minV;
			a < 0.5 || c < 0.5 ? r = "Partial Texture" : r = "Full Texture";
		}
		n.availableUvSets.push(i);
		const l = `${i.toUpperCase()} - ${r} (U: ${s.minU.toFixed(2)}-${s.maxU.toFixed(2)}, V: ${s.minV.toFixed(2)}-${s.maxV.toFixed(2)})`;
		n.uvSetNames.push(l);
	}), console.log("Available UV sets:", n.availableUvSets), console.log("UV set display names:", n.uvSetNames), _s(n);
	let o = null;
	if (n.availableUvSets.includes("uv") ? (o = "uv", console.log("Using industry standard UV1 (uv) as default")) : n.availableUvSets.length > 0 && (o = n.availableUvSets[0], console.log(`UV1 not found, using ${o} as fallback`)), o || (o = "uv", console.log("No UV channels found, defaulting to uv")), o) {
		const s = n.availableUvSets.indexOf(o);
		s !== -1 && (n.currentUvSet = s, console.log(`Setting initial UV channel to ${o} (index: ${s})`), at(n, o));
	}
	Ie(n);
}

/**
 *
 */
function _s(n) {
	const e = document.getElementById("uv-info-section");
	if (!e) return;
	for (; e.firstChild; )
		e.removeChild(e.firstChild);
	const t = document.createElement("div");
	if (t.className = "debug-label", t.textContent = "UV Information:", t.style.fontWeight = "bold", t.style.marginBottom = "10px", t.style.color = "#95a5a6", e.appendChild(t), n.availableUvSets.length === 0) {
		const l = document.createElement("div");
		l.className = "debug-value", l.style.padding = "10px", l.style.backgroundColor = "rgba(0, 0, 0, 0.5)", l.style.borderRadius = "5px", l.textContent = "No UV data found in this model.", e.appendChild(l);
		return;
	}
	const o = document.createElement("div");
	o.id = "uv-controls", o.style.marginBottom = "15px";
	const s = document.createElement("div");
	s.textContent = "Select UV Channel:", s.style.marginBottom = "5px", s.style.color = "white", o.appendChild(s);
	const i = document.createElement("select");
	i.id = "uv-channel-select", i.style.width = "100%", i.style.backgroundColor = "#333", i.style.color = "white", i.style.padding = "8px", i.style.border = "1px solid #555", i.style.borderRadius = "3px", i.style.marginBottom = "10px", i.style.cursor = "pointer", n.uvSetNames.forEach((l, a) => {
		const c = document.createElement("option");
		c.value = a, c.textContent = l, i.appendChild(c);
	}), n.currentUvSet !== void 0 && n.currentUvSet >= 0 && n.currentUvSet < n.availableUvSets.length ? (i.value = n.currentUvSet, console.log(`Setting dropdown to UV set index ${n.currentUvSet}: ${n.availableUvSets[n.currentUvSet]}`)) : (i.selectedIndex = 0, n.currentUvSet = 0, console.log(`Defaulting dropdown to first UV set: ${n.availableUvSets[0]}`)), console.log(`UV Dropdown initialized with value: ${i.value}, text: ${i.options[i.selectedIndex].text}`), i.addEventListener("change", function() {
		const l = parseInt(this.value);
		n.currentUvSet = l;
		const a = n.availableUvSets[l];
		at(n, a);
	}), o.appendChild(i), e.appendChild(o);
	const r = document.createElement("div");
	r.id = "uv-info-container", r.className = "debug-value", r.style.fontFamily = "monospace", r.style.backgroundColor = "rgba(0, 0, 0, 0.5)", r.style.padding = "10px", r.style.borderRadius = "5px", r.style.marginBottom = "15px", r.style.color = "#ddd", r.style.lineHeight = "1.4", e.appendChild(r);
}

/**
 *
 */
async function Es(n, e) {
	return new Promise((t, o) => {
		if (!e) return;
		const s = new An(), i = new FileReader();
		i.onload = function(r) {
			const l = r.target.result;
			s.parse(l, "", (a) => {
				n.modelObject = a.scene, n.scene.add(a.scene), As(n), Tn(n);
				const c = as(n);
				Me && Me(c), console.log("Model loaded successfully:", a), t(a);
			}, void 0, (a) => {
				console.error("Error loading model:", a), alert("Error loading the model file. Please try a different file."), lt(n), o(a);
			});
		}, i.readAsArrayBuffer(e);
	});
}

/**
 *
 */
function As(n) {
	if (!n.modelObject) return;
	const e = new M.Box3().setFromObject(n.modelObject), t = e.getCenter(new M.Vector3()), o = e.getSize(new M.Vector3());
	n.modelObject.position.x = -t.x, n.modelObject.position.y = -t.y, n.modelObject.position.z = -t.z;
	const s = Math.max(o.x, o.y, o.z), i = n.camera.fov * (Math.PI / 180);
	let r = Math.abs(s / 2 / Math.tan(i / 2));
	r *= 1.5, n.camera.position.z = r, n.controls.target.set(0, 0, 0), n.controls.update();
}

/**
 *
 */
function ws(n) {
	const e = document.getElementById("drop-container");
	if (!e) {
		console.error("Drop container not found");
		return;
	}
	const t = document.getElementById("drop-zone-model"), o = document.getElementById("drop-zone-texture");
	if (!t || !o) {
		console.error("Drop zones not found");
		return;
	}
	$e(t, (i) => {
		if (i.name.toLowerCase().endsWith(".glb") || i.name.toLowerCase().endsWith(".gltf")) {
			n.modelFile = i;
			const r = document.getElementById("model-file-info");
			r && (r.textContent = i.name), t.classList.add("has-file"), Re(n);
		} else
			alert("Please drop a valid model file (GLB or GLTF)");
	}), $e(o, (i) => {
		const r = ["jpg", "jpeg", "png", "webp"], l = i.name.split(".").pop().toLowerCase();
		if (r.includes(l)) {
			n.textureFile = i;
			const a = document.getElementById("texture-file-info");
			a && (a.textContent = i.name), o.classList.add("has-file"), Re(n);
		} else
			alert("Please drop a valid image file (JPG, PNG, WEBP)");
	});
	const s = document.getElementById("start-button");
	s && s.addEventListener("click", () => {
		Ss(n);
	}), e.style.display = "flex", console.log("Drag and drop initialized with the following elements:"), console.log("- dropContainer:", e), console.log("- modelDropZone:", t), console.log("- textureDropZone:", o), console.log("- startButton:", s);
}

/**
 *
 */
function $e(n, e) {
	["dragenter", "dragover", "dragleave", "drop"].forEach((t) => {
		n.addEventListener(t, Ms, !1);
	}), ["dragenter", "dragover"].forEach((t) => {
		n.addEventListener(t, () => {
			n.classList.add("active");
		});
	}), ["dragleave", "drop"].forEach((t) => {
		n.addEventListener(t, () => {
			n.classList.remove("active");
		});
	}), n.addEventListener("drop", (t) => {
		if (t.dataTransfer.files.length > 0) {
			const o = t.dataTransfer.files[0];
			e(o);
		}
	}), n.addEventListener("click", () => {
		const t = document.createElement("input");
		t.type = "file", n.id === "drop-zone-model" ? t.accept = ".glb,.gltf" : n.id === "drop-zone-texture" && (t.accept = ".jpg,.jpeg,.png,.webp"), t.addEventListener("change", (o) => {
			o.target.files.length > 0 && e(o.target.files[0]);
		}), t.click();
	});
}

/**
 *
 */
function Re(n) {
	const e = document.getElementById("start-button");
	e && (n.modelFile || n.textureFile ? (e.disabled = !1, e.style.display = "block") : (e.disabled = !0, e.style.display = "none"));
}

/**
 *
 */
function Ms(n) {
	n.preventDefault(), n.stopPropagation();
}

/**
 *
 */
function lt(n) {
	const e = document.getElementById("loading");
	e && (e.style.display = "none"), n.renderer && n.renderer.domElement && (n.renderer.domElement.style.display = "none");
	const t = document.getElementById("debug-panel");
	t && (t.style.display = "none"), n.isDebugMode = !1, n.modelLoaded = !1, n.textureLoaded = !1, n.modelFile = null, n.textureFile = null;
	const o = document.getElementById("drop-zone-model"), s = document.getElementById("drop-zone-texture");
	o && o.classList.remove("has-file"), s && s.classList.remove("has-file");
	const i = document.getElementById("model-file-info"), r = document.getElementById("texture-file-info");
	i && (i.textContent = ""), r && (r.textContent = ""), Re(n);
	const l = document.getElementById("drop-container");
	l && (l.style.display = "flex");
}

/**
 *
 */
async function Ss(n) {
	ce("Initializing..."), n.renderer || mn(n), n.camera || _n(n);
	try {
		if (n.modelFile && (console.log("Loading model:", n.modelFile.name), ce("Loading model..."), await Es(n, n.modelFile), n.modelLoaded = !0, console.log("Model loaded successfully")), n.textureFile)
			console.log("Loading texture:", n.textureFile.name), ce("Loading texture..."), await ls(n, n.textureFile), n.textureLoaded = !0, console.log("Texture loaded successfully");
		else if (n.modelLoaded) {
			console.log("No texture provided, creating a sample texture."), ce("Creating sample texture...");
			const e = document.createElement("canvas");
			e.width = 512, e.height = 512;
			const t = e.getContext("2d"), o = 64;
			for (let i = 0; i < e.height; i += o)
				for (let r = 0; r < e.width; r += o) {
					const l = (r / o + i / o) % 2 === 0;
					t.fillStyle = l ? "#3498db" : "#2980b9", t.fillRect(r, i, o, o), t.fillStyle = "#ffffff", t.font = "16px Arial", t.fillText(`${(r / e.width).toFixed(1)},${(i / e.height).toFixed(1)}`, r + 10, i + 30);
				}
			const s = new M.CanvasTexture(e);
			n.textureObject = s, n.textureFile = {
				name: "sample_texture.png",
				size: e.width * e.height * 4
			}, n.updateTextureInfo && n.updateTextureInfo({
				name: n.textureFile.name,
				size: n.textureFile.size,
				dimensions: { width: e.width, height: e.height }
			}), n.textureLoaded = !0, console.log("Sample texture created successfully");
		}
		if (n.modelLoaded || n.textureLoaded) {
			const e = document.getElementById("drop-container");
			e && (e.style.display = "none"), bs(n), We();
		}
	} catch (e) {
		console.error("Error handling file uploads:", e), We(), alert("Error processing files. Please try again."), lt(n);
	}
}

/**
 *
 */
function ce(n = "Loading...") {
	const e = document.getElementById("loading"), t = e == null ? void 0 : e.querySelector("div:not(.spinner)");
	e && (e.style.display = "flex"), t && (t.textContent = n);
}

/**
 *
 */
function We() {
	const n = document.getElementById("loading");
	n && (n.style.display = "none");
}

/**
 *
 */
function Rs(n) {
	window.addEventListener("resize", () => Ls(n)), window.addEventListener("keydown", (e) => vs(e, n)), console.log("Event listeners initialized");
}

/**
 *
 */
function Ls(n) {
	!n.camera || !n.renderer || (n.camera.aspect = window.innerWidth / window.innerHeight, n.camera.updateProjectionMatrix(), n.renderer.setSize(window.innerWidth, window.innerHeight));
}

/**
 *
 */
function vs(n, e) {
	n.key === "Escape" && e.isDebugMode && (typeof window.resetToDropZone == "function" ? window.resetToDropZone(e) : console.warn("resetToDropZone function not available")), (n.key === "r" || n.key === "R") && e.camera && e.controls && (e.camera.position.set(0, 0, 5), e.controls.target.set(0, 0, 0), e.controls.update()), (n.key === "t" || n.key === "T") && e.isDebugMode && typeof window.toggleTextureEditor == "function" && window.toggleTextureEditor(e);
}

const j = {
	// Scene-related state
	scene: null,
	camera: null,
	renderer: null,
	controls: null,
	// Content-related state
	modelFile: null,
	textureFile: null,
	modelObject: null,
	textureObject: null,
	modelInfo: null,
	additionalTextures: [],
	// UI state
	isDebugMode: !1,
	currentUvSet: 0,
	multiTextureMode: !1,
	// UV data
	screenMeshes: [],
	availableUvSets: [],
	uvSetNames: []
};

/**
 *
 */
function Le() {
	console.log("Asset Debugger Tool initialized"), dn(j), xs(j), ws(j), Rs(j);
	const n = document.getElementById("loading");
	n && (n.style.display = "none"), ot(j), document.addEventListener("textureLoaded", () => {
		j.textureObject && j.modelObject && Ke(j);
	}), document.addEventListener("modelLoaded", () => {
		j.textureObject && j.modelObject && Ke(j);
	});
}

typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Le) : Le());
const Xe = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
		__proto__: null,
		init: Le,
		state: j
	}, Symbol.toStringTag, { value: "Module" })), Os = {
		// Asset Debugger Tool
		assetDebugger: {
			init: () => Promise.resolve().then(() => Xe).then((n) => n.init()),
			// Legacy entry point is now the same as the standard entry point
			legacy: () => Promise.resolve().then(() => Xe)
		}
	}, Ps = "1.0.0";
export {
	Ps as VERSION,
	Ns as createElement,
	Is as formatFileSize,
	Ds as getFileExtension,
	Le as init,
	j as state,
	Os as tools
};
//# sourceMappingURL=index.js.map
