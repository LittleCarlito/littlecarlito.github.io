(function(R,d){typeof exports=="object"&&typeof module<"u"?d(exports,require("three")):typeof define=="function"&&define.amd?define(["exports","three"],d):(R=typeof globalThis<"u"?globalThis:R||self,d(R.blorktools={},R.THREE))})(this,function(R,d){"use strict";

	/**
 *
 */
	function Pe(n){const e=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(n){for(const t in n)if(t!=="default"){const o=Object.getOwnPropertyDescriptor(n,t);Object.defineProperty(e,t,o.get?o:{enumerable:!0,get:()=>n[t]})}}return e.default=n,Object.freeze(e)}

	const L=Pe(d),ge={type:"change"},oe={type:"start"},ye={type:"end"},H=new d.Ray,xe=new d.Plane,Ue=Math.cos(70*d.MathUtils.DEG2RAD),N=new d.Vector3,U=2*Math.PI,v={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},ie=1e-6;/**
 *
 */
	class re extends d.Controls{/**
 *
 */
		constructor(e,t=null){super(e,t),this.state=v.NONE,this.enabled=!0,this.target=new d.Vector3,this.cursor=new d.Vector3,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:d.MOUSE.ROTATE,MIDDLE:d.MOUSE.DOLLY,RIGHT:d.MOUSE.PAN},this.touches={ONE:d.TOUCH.ROTATE,TWO:d.TOUCH.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new d.Vector3,this._lastQuaternion=new d.Quaternion,this._lastTargetPosition=new d.Vector3,this._quat=new d.Quaternion().setFromUnitVectors(e.up,new d.Vector3(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new d.Spherical,this._sphericalDelta=new d.Spherical,this._scale=1,this._panOffset=new d.Vector3,this._rotateStart=new d.Vector2,this._rotateEnd=new d.Vector2,this._rotateDelta=new d.Vector2,this._panStart=new d.Vector2,this._panEnd=new d.Vector2,this._panDelta=new d.Vector2,this._dollyStart=new d.Vector2,this._dollyEnd=new d.Vector2,this._dollyDelta=new d.Vector2,this._dollyDirection=new d.Vector3,this._mouse=new d.Vector2,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Ee.bind(this),this._onPointerDown=Re.bind(this),this._onPointerUp=ke.bind(this),this._onContextMenu=Ke.bind(this),this._onMouseWheel=je.bind(this),this._onKeyDown=Ve.bind(this),this._onTouchStart=Ge.bind(this),this._onTouchMove=ze.bind(this),this._onMouseDown=Fe.bind(this),this._onMouseMove=Be.bind(this),this._interceptControlDown=$e.bind(this),this._interceptControlUp=We.bind(this),this.domElement!==null&&this.connect(),this.update()}/**
 *
 */
		connect(){this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}/**
 *
 */
		disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}/**
 *
 */
		dispose(){this.disconnect()}/**
 *
 */
		getPolarAngle(){return this._spherical.phi}/**
 *
 */
		getAzimuthalAngle(){return this._spherical.theta}/**
 *
 */
		getDistance(){return this.object.position.distanceTo(this.target)}/**
 *
 */
		listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}/**
 *
 */
		stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}/**
 *
 */
		saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}/**
 *
 */
		reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(ge),this.update(),this.state=v.NONE}/**
 *
 */
		update(e=null){const t=this.object.position;N.copy(t).sub(this.target),N.applyQuaternion(this._quat),this._spherical.setFromVector3(N),this.autoRotate&&this.state===v.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let o=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(o)&&isFinite(s)&&(o<-Math.PI?o+=U:o>Math.PI&&(o-=U),s<-Math.PI?s+=U:s>Math.PI&&(s-=U),o<=s?this._spherical.theta=Math.max(o,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(o+s)/2?Math.max(o,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let i=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const r=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),i=r!=this._spherical.radius}if(N.setFromSpherical(this._spherical),N.applyQuaternion(this._quatInverse),t.copy(this.target).add(N),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let r=null;if(this.object.isPerspectiveCamera){const l=N.length();r=this._clampDistance(l*this._scale);const a=l-r;this.object.position.addScaledVector(this._dollyDirection,a),this.object.updateMatrixWorld(),i=!!a}else if(this.object.isOrthographicCamera){const l=new d.Vector3(this._mouse.x,this._mouse.y,0);l.unproject(this.object);const a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),i=a!==this.object.zoom;const c=new d.Vector3(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(l),this.object.updateMatrixWorld(),r=N.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;r!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(r).add(this.object.position):(H.origin.copy(this.object.position),H.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(H.direction))<Ue?this.object.lookAt(this.target):(xe.setFromNormalAndCoplanarPoint(this.object.up,this.target),H.intersectPlane(xe,this.target))))}else if(this.object.isOrthographicCamera){const r=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),r!==this.object.zoom&&(this.object.updateProjectionMatrix(),i=!0)}return this._scale=1,this._performCursorZoom=!1,i||this._lastPosition.distanceToSquared(this.object.position)>ie||8*(1-this._lastQuaternion.dot(this.object.quaternion))>ie||this._lastTargetPosition.distanceToSquared(this.target)>ie?(this.dispatchEvent(ge),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}/**
 *
 */
		_getAutoRotationAngle(e){return e!==null?U/60*this.autoRotateSpeed*e:U/60/60*this.autoRotateSpeed}/**
 *
 */
		_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}/**
 *
 */
		_rotateLeft(e){this._sphericalDelta.theta-=e}/**
 *
 */
		_rotateUp(e){this._sphericalDelta.phi-=e}/**
 *
 */
		_panLeft(e,t){N.setFromMatrixColumn(t,0),N.multiplyScalar(-e),this._panOffset.add(N)}/**
 *
 */
		_panUp(e,t){this.screenSpacePanning===!0?N.setFromMatrixColumn(t,1):(N.setFromMatrixColumn(t,0),N.crossVectors(this.object.up,N)),N.multiplyScalar(e),this._panOffset.add(N)}/**
 *
 */
		_pan(e,t){const o=this.domElement;if(this.object.isPerspectiveCamera){const s=this.object.position;N.copy(s).sub(this.target);let i=N.length();i*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*i/o.clientHeight,this.object.matrix),this._panUp(2*t*i/o.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/o.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/o.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}/**
 *
 */
		_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}/**
 *
 */
		_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}/**
 *
 */
		_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const o=this.domElement.getBoundingClientRect(),s=e-o.left,i=t-o.top,r=o.width,l=o.height;this._mouse.x=s/r*2-1,this._mouse.y=-(i/l)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}/**
 *
 */
		_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}/**
 *
 */
		_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}/**
 *
 */
		_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}/**
 *
 */
		_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}/**
 *
 */
		_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(U*this._rotateDelta.x/t.clientHeight),this._rotateUp(U*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}/**
 *
 */
		_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}/**
 *
 */
		_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}/**
 *
 */
		_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}/**
 *
 */
		_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(U*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-U*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(U*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-U*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}/**
 *
 */
		_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),o=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(o,s)}}/**
 *
 */
		_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),o=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(o,s)}}/**
 *
 */
		_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),o=e.pageX-t.x,s=e.pageY-t.y,i=Math.sqrt(o*o+s*s);this._dollyStart.set(0,i)}/**
 *
 */
		_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}/**
 *
 */
		_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}/**
 *
 */
		_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const o=this._getSecondPointerPosition(e),s=.5*(e.pageX+o.x),i=.5*(e.pageY+o.y);this._rotateEnd.set(s,i)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(U*this._rotateDelta.x/t.clientHeight),this._rotateUp(U*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}/**
 *
 */
		_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),o=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(o,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}/**
 *
 */
		_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),o=e.pageX-t.x,s=e.pageY-t.y,i=Math.sqrt(o*o+s*s);this._dollyEnd.set(0,i),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const r=(e.pageX+t.x)*.5,l=(e.pageY+t.y)*.5;this._updateZoomParameters(r,l)}/**
 *
 */
		_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}/**
 *
 */
		_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}/**
 *
 */
		_addPointer(e){this._pointers.push(e.pointerId)}/**
 *
 */
		_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}/**
 *
 */
		_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}/**
 *
 */
		_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new d.Vector2,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}/**
 *
 */
		_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}/**
 *
 */
		_customWheelEvent(e){const t=e.deltaMode,o={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:o.deltaY*=16;break;case 2:o.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(o.deltaY*=10),o}}

	/**
 *
 */
	function Re(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n)))}

	/**
 *
 */
	function Ee(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}

	/**
 *
 */
	function ke(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(ye),this.state=v.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}

	/**
 *
 */
	function Fe(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case d.MOUSE.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=v.DOLLY;break;case d.MOUSE.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=v.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=v.ROTATE}break;case d.MOUSE.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=v.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=v.PAN}break;default:this.state=v.NONE}this.state!==v.NONE&&this.dispatchEvent(oe)}

	/**
 *
 */
	function Be(n){switch(this.state){case v.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case v.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case v.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}

	/**
 *
 */
	function je(n){this.enabled===!1||this.enableZoom===!1||this.state!==v.NONE||(n.preventDefault(),this.dispatchEvent(oe),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(ye))}

	/**
 *
 */
	function Ve(n){this.enabled!==!1&&this._handleKeyDown(n)}

	/**
 *
 */
	function Ge(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case d.TOUCH.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=v.TOUCH_ROTATE;break;case d.TOUCH.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=v.TOUCH_PAN;break;default:this.state=v.NONE}break;case 2:switch(this.touches.TWO){case d.TOUCH.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=v.TOUCH_DOLLY_PAN;break;case d.TOUCH.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=v.TOUCH_DOLLY_ROTATE;break;default:this.state=v.NONE}break;default:this.state=v.NONE}this.state!==v.NONE&&this.dispatchEvent(oe)}

	/**
 *
 */
	function ze(n){switch(this._trackPointer(n),this.state){case v.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case v.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case v.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case v.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=v.NONE}}

	/**
 *
 */
	function Ke(n){this.enabled!==!1&&n.preventDefault()}

	/**
 *
 */
	function $e(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}

	/**
 *
 */
	function We(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}

	/**
 *
 */
	function Xe(n){return n.scene=new L.Scene,n.scene.background=new L.Color(2236962),n.camera=new L.PerspectiveCamera(75,window.innerWidth/window.innerHeight,.1,1e3),n.camera.position.z=1,n.camera.position.y=.5,n.renderer=Ye(),qe(n.scene),n.controls=new re(n.camera,n.renderer.domElement),n.controls.enableDamping=!0,n.controls.dampingFactor=.05,n.controls.target.set(0,0,0),window.addEventListener("resize",()=>Ze(n)),n}

	/**
 *
 */
	function Ye(){const n=new L.WebGLRenderer({antialias:!0});return n.setSize(window.innerWidth,window.innerHeight),n.setPixelRatio(window.devicePixelRatio),n.outputEncoding=L.sRGBEncoding,document.body.appendChild(n.domElement),n.domElement.style.display="none",n}

	/**
 *
 */
	function qe(n){const e=new L.AmbientLight(16777215,1);n.add(e);const t=new L.DirectionalLight(16777215,1);t.position.set(1,1,1),n.add(t);const o=new L.DirectionalLight(16777215,.8);o.position.set(-1,.5,-1),n.add(o)}

	/**
 *
 */
	function Ze(n){n.camera.aspect=window.innerWidth/window.innerHeight,n.camera.updateProjectionMatrix(),n.renderer.setSize(window.innerWidth,window.innerHeight)}

	/**
 *
 */
	function be(n){requestAnimationFrame(()=>be(n)),n.controls&&n.controls.update(),Qe(n),n.renderer&&n.scene&&n.camera&&n.renderer.render(n.scene,n.camera)}

	/**
 *
 */
	function Qe(n){const e=performance.now()*.001;n.modelObject&&n.modelObject.traverse(t=>{t.isMesh&&t.material instanceof L.ShaderMaterial&&t.material.uniforms&&t.material.uniforms.u_time&&(t.material.uniforms.u_time.value=e)})}

	/**
 *
 */
	function He(n){if(!n.renderer){const e=new L.WebGLRenderer({antialias:!0,alpha:!0});if(e.setSize(window.innerWidth,window.innerHeight),e.setPixelRatio(window.devicePixelRatio),e.setClearColor(0,1),e.outputEncoding=L.sRGBEncoding,document.body.appendChild(e.domElement),e.domElement.style.display="none",n.renderer=e,!n.scene){const t=new L.Scene;n.scene=t}n.camera||Je(n),tt(n),nt(n),console.log("Renderer initialized")}return n.renderer}

	/**
 *
 */
	function Je(n){if(!n.camera){const e=new L.PerspectiveCamera(45,window.innerWidth/window.innerHeight,.1,1e3);e.position.z=5,n.camera=e,et(n)}return n.camera}

	/**
 *
 */
	function et(n){if(!n.controls&&n.camera&&n.renderer){const e=new re(n.camera,n.renderer.domElement);e.enableDamping=!0,e.dampingFactor=.05,e.screenSpacePanning=!0,n.controls=e}return n.controls}

	/**
 *
 */
	function tt(n){if(!n.renderer||!n.scene||!n.camera)return;const e=()=>{requestAnimationFrame(e),n.controls&&n.controls.update(),n.isDebugMode&&n.renderer.render(n.scene,n.camera)};e()}

	/**
 *
 */
	function nt(n){window.addEventListener("resize",()=>{!n.renderer||!n.camera||(n.camera.aspect=window.innerWidth/window.innerHeight,n.camera.updateProjectionMatrix(),n.renderer.setSize(window.innerWidth,window.innerHeight))})}

	/**
 *
 */
	function st(n){if(!n.scene)return;const e=[];n.scene.traverse(r=>{r.isLight&&e.push(r)}),e.forEach(r=>{r.parent.remove(r)});const t=new L.AmbientLight(16777215,.5);n.scene.add(t);const o=new L.DirectionalLight(16777215,.8);o.position.set(0,0,10),n.scene.add(o);const s=new L.DirectionalLight(16777215,.3);s.position.set(0,0,-10),n.scene.add(s);const i=new L.DirectionalLight(16777215,.3);i.position.set(0,10,0),n.scene.add(i)}

	/**
 *
 */
	function ot(n){if(!n.camera){const e=new L.PerspectiveCamera(45,window.innerWidth/window.innerHeight,.1,1e3);e.position.z=5,n.camera=e,n.renderer&&it(n),console.log("Camera initialized")}return n.camera}

	/**
 *
 */
	function it(n){if(!n.controls&&n.camera&&n.renderer){const e=new re(n.camera,n.renderer.domElement);e.enableDamping=!0,e.dampingFactor=.05,e.screenSpacePanning=!0,e.minDistance=1,e.maxDistance=20,n.controls=e,console.log("Orbit controls initialized")}return n.controls}

	/**
 *
 */
	function _e(n,e){if(e===d.TrianglesDrawMode)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),n;if(e===d.TriangleFanDrawMode||e===d.TriangleStripDrawMode){let t=n.getIndex();if(t===null){const r=[],l=n.getAttribute("position");if(l!==void 0){for(let a=0;a<l.count;a++)r.push(a);n.setIndex(r),t=n.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),n}const o=t.count-2,s=[];if(e===d.TriangleFanDrawMode)for(let r=1;r<=o;r++)s.push(t.getX(0)),s.push(t.getX(r)),s.push(t.getX(r+1));else for(let r=0;r<o;r++)r%2===0?(s.push(t.getX(r)),s.push(t.getX(r+1)),s.push(t.getX(r+2))):(s.push(t.getX(r+2)),s.push(t.getX(r+1)),s.push(t.getX(r)));s.length/3!==o&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const i=n.clone();return i.setIndex(s),i.clearGroups(),i}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),n}

	/**
 *
 */
	class rt extends d.Loader{/**
 *
 */
		constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new ut(t)}),this.register(function(t){return new ht(t)}),this.register(function(t){return new At(t)}),this.register(function(t){return new wt(t)}),this.register(function(t){return new Mt(t)}),this.register(function(t){return new ft(t)}),this.register(function(t){return new mt(t)}),this.register(function(t){return new gt(t)}),this.register(function(t){return new yt(t)}),this.register(function(t){return new dt(t)}),this.register(function(t){return new xt(t)}),this.register(function(t){return new pt(t)}),this.register(function(t){return new _t(t)}),this.register(function(t){return new bt(t)}),this.register(function(t){return new lt(t)}),this.register(function(t){return new St(t)}),this.register(function(t){return new Tt(t)})}/**
 *
 */
		load(e,t,o,s){const i=this;let r;if(this.resourcePath!=="")r=this.resourcePath;else if(this.path!==""){const c=d.LoaderUtils.extractUrlBase(e);r=d.LoaderUtils.resolveURL(c,this.path)}else r=d.LoaderUtils.extractUrlBase(e);this.manager.itemStart(e);const l=function(c){s?s(c):console.error(c),i.manager.itemError(e),i.manager.itemEnd(e)},a=new d.FileLoader(this.manager);a.setPath(this.path),a.setResponseType("arraybuffer"),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(c){try{i.parse(c,r,function(u){t(u),i.manager.itemEnd(e)},l)}catch(u){l(u)}},o,l)}/**
 *
 */
		setDRACOLoader(e){return this.dracoLoader=e,this}/**
 *
 */
		setKTX2Loader(e){return this.ktx2Loader=e,this}/**
 *
 */
		setMeshoptDecoder(e){return this.meshoptDecoder=e,this}/**
 *
 */
		register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}/**
 *
 */
		unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}/**
 *
 */
		parse(e,t,o,s){let i;const r={},l={},a=new TextDecoder;if(typeof e=="string")i=JSON.parse(e);else if(e instanceof ArrayBuffer)if(a.decode(new Uint8Array(e,0,4))===Ae){try{r[w.KHR_BINARY_GLTF]=new Lt(e)}catch(h){s&&s(h);return}i=JSON.parse(r[w.KHR_BINARY_GLTF].content)}else i=JSON.parse(a.decode(e));else i=e;if(i.asset===void 0||i.asset.version[0]<2){s&&s(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const c=new Bt(i,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let u=0;u<this.pluginCallbacks.length;u++){const h=this.pluginCallbacks[u](c);h.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),l[h.name]=h,r[h.name]=!0}if(i.extensionsUsed)for(let u=0;u<i.extensionsUsed.length;++u){const h=i.extensionsUsed[u],p=i.extensionsRequired||[];switch(h){case w.KHR_MATERIALS_UNLIT:r[h]=new ct;break;case w.KHR_DRACO_MESH_COMPRESSION:r[h]=new vt(i,this.dracoLoader);break;case w.KHR_TEXTURE_TRANSFORM:r[h]=new Ct;break;case w.KHR_MESH_QUANTIZATION:r[h]=new It;break;default:p.indexOf(h)>=0&&l[h]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+h+'".')}}c.setExtensions(r),c.setPlugins(l),c.parse(o,s)}/**
 *
 */
		parseAsync(e,t){const o=this;return new Promise(function(s,i){o.parse(e,t,s,i)})}}

	/**
 *
 */
	function at(){let n={};return{get:function(e){return n[e]},add:function(e,t){n[e]=t},remove:function(e){delete n[e]},removeAll:function(){n={}}}}

	const w={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};/**
 *
 */
	class lt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}/**
 *
 */
		_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let o=0,s=t.length;o<s;o++){const i=t[o];i.extensions&&i.extensions[this.name]&&i.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,i.extensions[this.name].light)}}/**
 *
 */
		_loadLight(e){const t=this.parser,o="light:"+e;let s=t.cache.get(o);if(s)return s;const i=t.json,a=((i.extensions&&i.extensions[this.name]||{}).lights||[])[e];let c;const u=new d.Color(16777215);a.color!==void 0&&u.setRGB(a.color[0],a.color[1],a.color[2],d.LinearSRGBColorSpace);const h=a.range!==void 0?a.range:0;switch(a.type){case"directional":c=new d.DirectionalLight(u),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new d.PointLight(u),c.distance=h;break;case"spot":c=new d.SpotLight(u),c.distance=h,a.spot=a.spot||{},a.spot.innerConeAngle=a.spot.innerConeAngle!==void 0?a.spot.innerConeAngle:0,a.spot.outerConeAngle=a.spot.outerConeAngle!==void 0?a.spot.outerConeAngle:Math.PI/4,c.angle=a.spot.outerConeAngle,c.penumbra=1-a.spot.innerConeAngle/a.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+a.type)}return c.position.set(0,0,0),c.decay=2,z(c,a),a.intensity!==void 0&&(c.intensity=a.intensity),c.name=t.createUniqueName(a.name||"light_"+e),s=Promise.resolve(c),t.cache.add(o,s),s}/**
 *
 */
		getDependency(e,t){if(e==="light")return this._loadLight(t)}/**
 *
 */
		createNodeAttachment(e){const t=this,o=this.parser,i=o.json.nodes[e],l=(i.extensions&&i.extensions[this.name]||{}).light;return l===void 0?null:this._loadLight(l).then(function(a){return o._getNodeRef(t.cache,l,a)})}}/**
 *
 */
	class ct{/**
 *
 */
		constructor(){this.name=w.KHR_MATERIALS_UNLIT}/**
 *
 */
		getMaterialType(){return d.MeshBasicMaterial}/**
 *
 */
		extendParams(e,t,o){const s=[];e.color=new d.Color(1,1,1),e.opacity=1;const i=t.pbrMetallicRoughness;if(i){if(Array.isArray(i.baseColorFactor)){const r=i.baseColorFactor;e.color.setRGB(r[0],r[1],r[2],d.LinearSRGBColorSpace),e.opacity=r[3]}i.baseColorTexture!==void 0&&s.push(o.assignTexture(e,"map",i.baseColorTexture,d.SRGBColorSpace))}return Promise.all(s)}}/**
 *
 */
	class dt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_EMISSIVE_STRENGTH}/**
 *
 */
		extendMaterialParams(e,t){const s=this.parser.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=s.extensions[this.name].emissiveStrength;return i!==void 0&&(t.emissiveIntensity=i),Promise.resolve()}}/**
 *
 */
	class ut{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_CLEARCOAT}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[],r=s.extensions[this.name];if(r.clearcoatFactor!==void 0&&(t.clearcoat=r.clearcoatFactor),r.clearcoatTexture!==void 0&&i.push(o.assignTexture(t,"clearcoatMap",r.clearcoatTexture)),r.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=r.clearcoatRoughnessFactor),r.clearcoatRoughnessTexture!==void 0&&i.push(o.assignTexture(t,"clearcoatRoughnessMap",r.clearcoatRoughnessTexture)),r.clearcoatNormalTexture!==void 0&&(i.push(o.assignTexture(t,"clearcoatNormalMap",r.clearcoatNormalTexture)),r.clearcoatNormalTexture.scale!==void 0)){const l=r.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new d.Vector2(l,l)}return Promise.all(i)}}/**
 *
 */
	class ht{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_DISPERSION}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const s=this.parser.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=s.extensions[this.name];return t.dispersion=i.dispersion!==void 0?i.dispersion:0,Promise.resolve()}}/**
 *
 */
	class pt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_IRIDESCENCE}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[],r=s.extensions[this.name];return r.iridescenceFactor!==void 0&&(t.iridescence=r.iridescenceFactor),r.iridescenceTexture!==void 0&&i.push(o.assignTexture(t,"iridescenceMap",r.iridescenceTexture)),r.iridescenceIor!==void 0&&(t.iridescenceIOR=r.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),r.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=r.iridescenceThicknessMinimum),r.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=r.iridescenceThicknessMaximum),r.iridescenceThicknessTexture!==void 0&&i.push(o.assignTexture(t,"iridescenceThicknessMap",r.iridescenceThicknessTexture)),Promise.all(i)}}/**
 *
 */
	class ft{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_SHEEN}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[];t.sheenColor=new d.Color(0,0,0),t.sheenRoughness=0,t.sheen=1;const r=s.extensions[this.name];if(r.sheenColorFactor!==void 0){const l=r.sheenColorFactor;t.sheenColor.setRGB(l[0],l[1],l[2],d.LinearSRGBColorSpace)}return r.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=r.sheenRoughnessFactor),r.sheenColorTexture!==void 0&&i.push(o.assignTexture(t,"sheenColorMap",r.sheenColorTexture,d.SRGBColorSpace)),r.sheenRoughnessTexture!==void 0&&i.push(o.assignTexture(t,"sheenRoughnessMap",r.sheenRoughnessTexture)),Promise.all(i)}}/**
 *
 */
	class mt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_TRANSMISSION}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[],r=s.extensions[this.name];return r.transmissionFactor!==void 0&&(t.transmission=r.transmissionFactor),r.transmissionTexture!==void 0&&i.push(o.assignTexture(t,"transmissionMap",r.transmissionTexture)),Promise.all(i)}}/**
 *
 */
	class gt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_VOLUME}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[],r=s.extensions[this.name];t.thickness=r.thicknessFactor!==void 0?r.thicknessFactor:0,r.thicknessTexture!==void 0&&i.push(o.assignTexture(t,"thicknessMap",r.thicknessTexture)),t.attenuationDistance=r.attenuationDistance||1/0;const l=r.attenuationColor||[1,1,1];return t.attenuationColor=new d.Color().setRGB(l[0],l[1],l[2],d.LinearSRGBColorSpace),Promise.all(i)}}/**
 *
 */
	class yt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_IOR}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const s=this.parser.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=s.extensions[this.name];return t.ior=i.ior!==void 0?i.ior:1.5,Promise.resolve()}}/**
 *
 */
	class xt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_SPECULAR}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[],r=s.extensions[this.name];t.specularIntensity=r.specularFactor!==void 0?r.specularFactor:1,r.specularTexture!==void 0&&i.push(o.assignTexture(t,"specularIntensityMap",r.specularTexture));const l=r.specularColorFactor||[1,1,1];return t.specularColor=new d.Color().setRGB(l[0],l[1],l[2],d.LinearSRGBColorSpace),r.specularColorTexture!==void 0&&i.push(o.assignTexture(t,"specularColorMap",r.specularColorTexture,d.SRGBColorSpace)),Promise.all(i)}}/**
 *
 */
	class bt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.EXT_MATERIALS_BUMP}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[],r=s.extensions[this.name];return t.bumpScale=r.bumpFactor!==void 0?r.bumpFactor:1,r.bumpTexture!==void 0&&i.push(o.assignTexture(t,"bumpMap",r.bumpTexture)),Promise.all(i)}}/**
 *
 */
	class _t{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_MATERIALS_ANISOTROPY}/**
 *
 */
		getMaterialType(e){const o=this.parser.json.materials[e];return!o.extensions||!o.extensions[this.name]?null:d.MeshPhysicalMaterial}/**
 *
 */
		extendMaterialParams(e,t){const o=this.parser,s=o.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const i=[],r=s.extensions[this.name];return r.anisotropyStrength!==void 0&&(t.anisotropy=r.anisotropyStrength),r.anisotropyRotation!==void 0&&(t.anisotropyRotation=r.anisotropyRotation),r.anisotropyTexture!==void 0&&i.push(o.assignTexture(t,"anisotropyMap",r.anisotropyTexture)),Promise.all(i)}}/**
 *
 */
	class At{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.KHR_TEXTURE_BASISU}/**
 *
 */
		loadTexture(e){const t=this.parser,o=t.json,s=o.textures[e];if(!s.extensions||!s.extensions[this.name])return null;const i=s.extensions[this.name],r=t.options.ktx2Loader;if(!r){if(o.extensionsRequired&&o.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,i.source,r)}}/**
 *
 */
	class wt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.EXT_TEXTURE_WEBP,this.isSupported=null}/**
 *
 */
		loadTexture(e){const t=this.name,o=this.parser,s=o.json,i=s.textures[e];if(!i.extensions||!i.extensions[t])return null;const r=i.extensions[t],l=s.images[r.source];let a=o.textureLoader;if(l.uri){const c=o.options.manager.getHandler(l.uri);c!==null&&(a=c)}return this.detectSupport().then(function(c){if(c)return o.loadTextureImage(e,r.source,a);if(s.extensionsRequired&&s.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");return o.loadTexture(e)})}/**
 *
 */
		detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){const t=new Image;t.src="data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}}/**
 *
 */
	class Mt{/**
 *
 */
		constructor(e){this.parser=e,this.name=w.EXT_TEXTURE_AVIF,this.isSupported=null}/**
 *
 */
		loadTexture(e){const t=this.name,o=this.parser,s=o.json,i=s.textures[e];if(!i.extensions||!i.extensions[t])return null;const r=i.extensions[t],l=s.images[r.source];let a=o.textureLoader;if(l.uri){const c=o.options.manager.getHandler(l.uri);c!==null&&(a=c)}return this.detectSupport().then(function(c){if(c)return o.loadTextureImage(e,r.source,a);if(s.extensionsRequired&&s.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");return o.loadTexture(e)})}/**
 *
 */
		detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){const t=new Image;t.src="data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}}/**
 *
 */
	class St{/**
 *
 */
		constructor(e){this.name=w.EXT_MESHOPT_COMPRESSION,this.parser=e}/**
 *
 */
		loadBufferView(e){const t=this.parser.json,o=t.bufferViews[e];if(o.extensions&&o.extensions[this.name]){const s=o.extensions[this.name],i=this.parser.getDependency("buffer",s.buffer),r=this.parser.options.meshoptDecoder;if(!r||!r.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return i.then(function(l){const a=s.byteOffset||0,c=s.byteLength||0,u=s.count,h=s.byteStride,p=new Uint8Array(l,a,c);return r.decodeGltfBufferAsync?r.decodeGltfBufferAsync(u,h,p,s.mode,s.filter).then(function(f){return f.buffer}):r.ready.then(function(){const f=new ArrayBuffer(u*h);return r.decodeGltfBuffer(new Uint8Array(f),u,h,p,s.mode,s.filter),f})})}else return null}}/**
 *
 */
	class Tt{/**
 *
 */
		constructor(e){this.name=w.EXT_MESH_GPU_INSTANCING,this.parser=e}/**
 *
 */
		createNodeMesh(e){const t=this.parser.json,o=t.nodes[e];if(!o.extensions||!o.extensions[this.name]||o.mesh===void 0)return null;const s=t.meshes[o.mesh];for(const c of s.primitives)if(c.mode!==B.TRIANGLES&&c.mode!==B.TRIANGLE_STRIP&&c.mode!==B.TRIANGLE_FAN&&c.mode!==void 0)return null;const r=o.extensions[this.name].attributes,l=[],a={};for(const c in r)l.push(this.parser.getDependency("accessor",r[c]).then(u=>(a[c]=u,a[c])));return l.length<1?null:(l.push(this.parser.createNodeMesh(e)),Promise.all(l).then(c=>{const u=c.pop(),h=u.isGroup?u.children:[u],p=c[0].count,f=[];for(const g of h){const A=new d.Matrix4,y=new d.Vector3,m=new d.Quaternion,x=new d.Vector3(1,1,1),O=new d.InstancedMesh(g.geometry,g.material,p);for(let S=0;S<p;S++)a.TRANSLATION&&y.fromBufferAttribute(a.TRANSLATION,S),a.ROTATION&&m.fromBufferAttribute(a.ROTATION,S),a.SCALE&&x.fromBufferAttribute(a.SCALE,S),O.setMatrixAt(S,A.compose(y,m,x));for(const S in a)if(S==="_COLOR_0"){const I=a[S];O.instanceColor=new d.InstancedBufferAttribute(I.array,I.itemSize,I.normalized)}else S!=="TRANSLATION"&&S!=="ROTATION"&&S!=="SCALE"&&g.geometry.setAttribute(S,a[S]);d.Object3D.prototype.copy.call(O,g),this.parser.assignFinalMaterial(O),f.push(O)}return u.isGroup?(u.clear(),u.add(...f),u):f[0]}))}}const Ae="glTF",Z=12,we={JSON:1313821514,BIN:5130562};/**
 *
 */
	class Lt{/**
 *
 */
		constructor(e){this.name=w.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,Z),o=new TextDecoder;if(this.header={magic:o.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Ae)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const s=this.header.length-Z,i=new DataView(e,Z);let r=0;for(;r<s;){const l=i.getUint32(r,!0);r+=4;const a=i.getUint32(r,!0);if(r+=4,a===we.JSON){const c=new Uint8Array(e,Z+r,l);this.content=o.decode(c)}else if(a===we.BIN){const c=Z+r;this.body=e.slice(c,c+l)}r+=l}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}/**
 *
 */
	class vt{/**
 *
 */
		constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=w.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}/**
 *
 */
		decodePrimitive(e,t){const o=this.json,s=this.dracoLoader,i=e.extensions[this.name].bufferView,r=e.extensions[this.name].attributes,l={},a={},c={};for(const u in r){const h=le[u]||u.toLowerCase();l[h]=r[u]}for(const u in e.attributes){const h=le[u]||u.toLowerCase();if(r[u]!==void 0){const p=o.accessors[e.attributes[u]],f=X[p.componentType];c[h]=f.name,a[h]=p.normalized===!0}}return t.getDependency("bufferView",i).then(function(u){return new Promise(function(h,p){s.decodeDracoFile(u,function(f){for(const g in f.attributes){const A=f.attributes[g],y=a[g];y!==void 0&&(A.normalized=y)}h(f)},l,c,d.LinearSRGBColorSpace,p)})})}}/**
 *
 */
	class Ct{/**
 *
 */
		constructor(){this.name=w.KHR_TEXTURE_TRANSFORM}/**
 *
 */
		extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}}/**
 *
 */
	class It{/**
 *
 */
		constructor(){this.name=w.KHR_MESH_QUANTIZATION}}/**
 *
 */
	class Me extends d.Interpolant{/**
 *
 */
		constructor(e,t,o,s){super(e,t,o,s)}/**
 *
 */
		copySampleValue_(e){const t=this.resultBuffer,o=this.sampleValues,s=this.valueSize,i=e*s*3+s;for(let r=0;r!==s;r++)t[r]=o[i+r];return t}/**
 *
 */
		interpolate_(e,t,o,s){const i=this.resultBuffer,r=this.sampleValues,l=this.valueSize,a=l*2,c=l*3,u=s-t,h=(o-t)/u,p=h*h,f=p*h,g=e*c,A=g-c,y=-2*f+3*p,m=f-p,x=1-y,O=m-p+h;for(let S=0;S!==l;S++){const I=r[A+S+l],b=r[A+S+a]*u,M=r[g+S+l],T=r[g+S]*u;i[S]=x*I+O*b+y*M+m*T}return i}}const Ot=new d.Quaternion;/**
 *
 */
	class Dt extends Me{/**
 *
 */
		interpolate_(e,t,o,s){const i=super.interpolate_(e,t,o,s);return Ot.fromArray(i).normalize().toArray(i),i}}const B={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},X={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Se={9728:d.NearestFilter,9729:d.LinearFilter,9984:d.NearestMipmapNearestFilter,9985:d.LinearMipmapNearestFilter,9986:d.NearestMipmapLinearFilter,9987:d.LinearMipmapLinearFilter},Te={33071:d.ClampToEdgeWrapping,33648:d.MirroredRepeatWrapping,10497:d.RepeatWrapping},ae={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},le={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},K={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},Nt={CUBICSPLINE:void 0,LINEAR:d.InterpolateLinear,STEP:d.InterpolateDiscrete},ce={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};

	/**
 *
 */
	function Pt(n){return n.DefaultMaterial===void 0&&(n.DefaultMaterial=new d.MeshStandardMaterial({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:d.FrontSide})),n.DefaultMaterial}

	/**
 *
 */
	function W(n,e,t){for(const o in t.extensions)n[o]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[o]=t.extensions[o])}

	/**
 *
 */
	function z(n,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(n.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}

	/**
 *
 */
	function Ut(n,e,t){let o=!1,s=!1,i=!1;for(let c=0,u=e.length;c<u;c++){const h=e[c];if(h.POSITION!==void 0&&(o=!0),h.NORMAL!==void 0&&(s=!0),h.COLOR_0!==void 0&&(i=!0),o&&s&&i)break}if(!o&&!s&&!i)return Promise.resolve(n);const r=[],l=[],a=[];for(let c=0,u=e.length;c<u;c++){const h=e[c];if(o){const p=h.POSITION!==void 0?t.getDependency("accessor",h.POSITION):n.attributes.position;r.push(p)}if(s){const p=h.NORMAL!==void 0?t.getDependency("accessor",h.NORMAL):n.attributes.normal;l.push(p)}if(i){const p=h.COLOR_0!==void 0?t.getDependency("accessor",h.COLOR_0):n.attributes.color;a.push(p)}}return Promise.all([Promise.all(r),Promise.all(l),Promise.all(a)]).then(function(c){const u=c[0],h=c[1],p=c[2];return o&&(n.morphAttributes.position=u),s&&(n.morphAttributes.normal=h),i&&(n.morphAttributes.color=p),n.morphTargetsRelative=!0,n})}

	/**
 *
 */
	function Rt(n,e){if(n.updateMorphTargets(),e.weights!==void 0)for(let t=0,o=e.weights.length;t<o;t++)n.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){const t=e.extras.targetNames;if(n.morphTargetInfluences.length===t.length){n.morphTargetDictionary={};for(let o=0,s=t.length;o<s;o++)n.morphTargetDictionary[t[o]]=o}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}

	/**
 *
 */
	function Et(n){let e;const t=n.extensions&&n.extensions[w.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+de(t.attributes):e=n.indices+":"+de(n.attributes)+":"+n.mode,n.targets!==void 0)for(let o=0,s=n.targets.length;o<s;o++)e+=":"+de(n.targets[o]);return e}

	/**
 *
 */
	function de(n){let e="";const t=Object.keys(n).sort();for(let o=0,s=t.length;o<s;o++)e+=t[o]+":"+n[t[o]]+";";return e}

	/**
 *
 */
	function ue(n){switch(n){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}

	/**
 *
 */
	function kt(n){return n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0?"image/jpeg":n.search(/\.webp($|\?)/i)>0||n.search(/^data\:image\/webp/)===0?"image/webp":n.search(/\.ktx2($|\?)/i)>0||n.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}

	const Ft=new d.Matrix4;/**
 *
 */
	class Bt{/**
 *
 */
		constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new at,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let o=!1,s=-1,i=!1,r=-1;if(typeof navigator<"u"){const l=navigator.userAgent;o=/^((?!chrome|android).)*safari/i.test(l)===!0;const a=l.match(/Version\/(\d+)/);s=o&&a?parseInt(a[1],10):-1,i=l.indexOf("Firefox")>-1,r=i?l.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||o&&s<17||i&&r<98?this.textureLoader=new d.TextureLoader(this.options.manager):this.textureLoader=new d.ImageBitmapLoader(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new d.FileLoader(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}/**
 *
 */
		setExtensions(e){this.extensions=e}/**
 *
 */
		setPlugins(e){this.plugins=e}/**
 *
 */
		parse(e,t){const o=this,s=this.json,i=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(r){return r._markDefs&&r._markDefs()}),Promise.all(this._invokeAll(function(r){return r.beforeRoot&&r.beforeRoot()})).then(function(){return Promise.all([o.getDependencies("scene"),o.getDependencies("animation"),o.getDependencies("camera")])}).then(function(r){const l={scene:r[0][s.scene||0],scenes:r[0],animations:r[1],cameras:r[2],asset:s.asset,parser:o,userData:{}};return W(i,l,s),z(l,s),Promise.all(o._invokeAll(function(a){return a.afterRoot&&a.afterRoot(l)})).then(function(){for(const a of l.scenes)a.updateMatrixWorld();e(l)})}).catch(t)}/**
 *
 */
		_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],o=this.json.meshes||[];for(let s=0,i=t.length;s<i;s++){const r=t[s].joints;for(let l=0,a=r.length;l<a;l++)e[r[l]].isBone=!0}for(let s=0,i=e.length;s<i;s++){const r=e[s];r.mesh!==void 0&&(this._addNodeRef(this.meshCache,r.mesh),r.skin!==void 0&&(o[r.mesh].isSkinnedMesh=!0)),r.camera!==void 0&&this._addNodeRef(this.cameraCache,r.camera)}}/**
 *
 */
		_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}/**
 *
 */
		_getNodeRef(e,t,o){if(e.refs[t]<=1)return o;const s=o.clone(),i=(r,l)=>{const a=this.associations.get(r);a!=null&&this.associations.set(l,a);for(const[c,u]of r.children.entries())i(u,l.children[c])};return i(o,s),s.name+="_instance_"+e.uses[t]++,s}/**
 *
 */
		_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let o=0;o<t.length;o++){const s=e(t[o]);if(s)return s}return null}/**
 *
 */
		_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const o=[];for(let s=0;s<t.length;s++){const i=e(t[s]);i&&o.push(i)}return o}/**
 *
 */
		getDependency(e,t){const o=e+":"+t;let s=this.cache.get(o);if(!s){switch(e){case"scene":s=this.loadScene(t);break;case"node":s=this._invokeOne(function(i){return i.loadNode&&i.loadNode(t)});break;case"mesh":s=this._invokeOne(function(i){return i.loadMesh&&i.loadMesh(t)});break;case"accessor":s=this.loadAccessor(t);break;case"bufferView":s=this._invokeOne(function(i){return i.loadBufferView&&i.loadBufferView(t)});break;case"buffer":s=this.loadBuffer(t);break;case"material":s=this._invokeOne(function(i){return i.loadMaterial&&i.loadMaterial(t)});break;case"texture":s=this._invokeOne(function(i){return i.loadTexture&&i.loadTexture(t)});break;case"skin":s=this.loadSkin(t);break;case"animation":s=this._invokeOne(function(i){return i.loadAnimation&&i.loadAnimation(t)});break;case"camera":s=this.loadCamera(t);break;default:if(s=this._invokeOne(function(i){return i!=this&&i.getDependency&&i.getDependency(e,t)}),!s)throw new Error("Unknown type: "+e);break}this.cache.add(o,s)}return s}/**
 *
 */
		getDependencies(e){let t=this.cache.get(e);if(!t){const o=this,s=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(s.map(function(i,r){return o.getDependency(e,r)})),this.cache.add(e,t)}return t}/**
 *
 */
		loadBuffer(e){const t=this.json.buffers[e],o=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[w.KHR_BINARY_GLTF].body);const s=this.options;return new Promise(function(i,r){o.load(d.LoaderUtils.resolveURL(t.uri,s.path),i,void 0,function(){r(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}/**
 *
 */
		loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(o){const s=t.byteLength||0,i=t.byteOffset||0;return o.slice(i,i+s)})}/**
 *
 */
		loadAccessor(e){const t=this,o=this.json,s=this.json.accessors[e];if(s.bufferView===void 0&&s.sparse===void 0){const r=ae[s.type],l=X[s.componentType],a=s.normalized===!0,c=new l(s.count*r);return Promise.resolve(new d.BufferAttribute(c,r,a))}const i=[];return s.bufferView!==void 0?i.push(this.getDependency("bufferView",s.bufferView)):i.push(null),s.sparse!==void 0&&(i.push(this.getDependency("bufferView",s.sparse.indices.bufferView)),i.push(this.getDependency("bufferView",s.sparse.values.bufferView))),Promise.all(i).then(function(r){const l=r[0],a=ae[s.type],c=X[s.componentType],u=c.BYTES_PER_ELEMENT,h=u*a,p=s.byteOffset||0,f=s.bufferView!==void 0?o.bufferViews[s.bufferView].byteStride:void 0,g=s.normalized===!0;let A,y;if(f&&f!==h){const m=Math.floor(p/f),x="InterleavedBuffer:"+s.bufferView+":"+s.componentType+":"+m+":"+s.count;let O=t.cache.get(x);O||(A=new c(l,m*f,s.count*f/u),O=new d.InterleavedBuffer(A,f/u),t.cache.add(x,O)),y=new d.InterleavedBufferAttribute(O,a,p%f/u,g)}else l===null?A=new c(s.count*a):A=new c(l,p,s.count*a),y=new d.BufferAttribute(A,a,g);if(s.sparse!==void 0){const m=ae.SCALAR,x=X[s.sparse.indices.componentType],O=s.sparse.indices.byteOffset||0,S=s.sparse.values.byteOffset||0,I=new x(r[1],O,s.sparse.count*m),b=new c(r[2],S,s.sparse.count*a);l!==null&&(y=new d.BufferAttribute(y.array.slice(),y.itemSize,y.normalized)),y.normalized=!1;for(let M=0,T=I.length;M<T;M++){const C=I[M];if(y.setX(C,b[M*a]),a>=2&&y.setY(C,b[M*a+1]),a>=3&&y.setZ(C,b[M*a+2]),a>=4&&y.setW(C,b[M*a+3]),a>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}y.normalized=g}return y})}/**
 *
 */
		loadTexture(e){const t=this.json,o=this.options,i=t.textures[e].source,r=t.images[i];let l=this.textureLoader;if(r.uri){const a=o.manager.getHandler(r.uri);a!==null&&(l=a)}return this.loadTextureImage(e,i,l)}/**
 *
 */
		loadTextureImage(e,t,o){const s=this,i=this.json,r=i.textures[e],l=i.images[t],a=(l.uri||l.bufferView)+":"+r.sampler;if(this.textureCache[a])return this.textureCache[a];const c=this.loadImageSource(t,o).then(function(u){u.flipY=!1,u.name=r.name||l.name||"",u.name===""&&typeof l.uri=="string"&&l.uri.startsWith("data:image/")===!1&&(u.name=l.uri);const p=(i.samplers||{})[r.sampler]||{};return u.magFilter=Se[p.magFilter]||d.LinearFilter,u.minFilter=Se[p.minFilter]||d.LinearMipmapLinearFilter,u.wrapS=Te[p.wrapS]||d.RepeatWrapping,u.wrapT=Te[p.wrapT]||d.RepeatWrapping,u.generateMipmaps=!u.isCompressedTexture&&u.minFilter!==d.NearestFilter&&u.minFilter!==d.LinearFilter,s.associations.set(u,{textures:e}),u}).catch(function(){return null});return this.textureCache[a]=c,c}/**
 *
 */
		loadImageSource(e,t){const o=this,s=this.json,i=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(h=>h.clone());const r=s.images[e],l=self.URL||self.webkitURL;let a=r.uri||"",c=!1;if(r.bufferView!==void 0)a=o.getDependency("bufferView",r.bufferView).then(function(h){c=!0;const p=new Blob([h],{type:r.mimeType});return a=l.createObjectURL(p),a});else if(r.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const u=Promise.resolve(a).then(function(h){return new Promise(function(p,f){let g=p;t.isImageBitmapLoader===!0&&(g=function(A){const y=new d.Texture(A);y.needsUpdate=!0,p(y)}),t.load(d.LoaderUtils.resolveURL(h,i.path),g,void 0,f)})}).then(function(h){return c===!0&&l.revokeObjectURL(a),z(h,r),h.userData.mimeType=r.mimeType||kt(r.uri),h}).catch(function(h){throw console.error("THREE.GLTFLoader: Couldn't load texture",a),h});return this.sourceCache[e]=u,u}/**
 *
 */
		assignTexture(e,t,o,s){const i=this;return this.getDependency("texture",o.index).then(function(r){if(!r)return null;if(o.texCoord!==void 0&&o.texCoord>0&&(r=r.clone(),r.channel=o.texCoord),i.extensions[w.KHR_TEXTURE_TRANSFORM]){const l=o.extensions!==void 0?o.extensions[w.KHR_TEXTURE_TRANSFORM]:void 0;if(l){const a=i.associations.get(r);r=i.extensions[w.KHR_TEXTURE_TRANSFORM].extendTexture(r,l),i.associations.set(r,a)}}return s!==void 0&&(r.colorSpace=s),e[t]=r,r})}/**
 *
 */
		assignFinalMaterial(e){const t=e.geometry;let o=e.material;const s=t.attributes.tangent===void 0,i=t.attributes.color!==void 0,r=t.attributes.normal===void 0;if(e.isPoints){const l="PointsMaterial:"+o.uuid;let a=this.cache.get(l);a||(a=new d.PointsMaterial,d.Material.prototype.copy.call(a,o),a.color.copy(o.color),a.map=o.map,a.sizeAttenuation=!1,this.cache.add(l,a)),o=a}else if(e.isLine){const l="LineBasicMaterial:"+o.uuid;let a=this.cache.get(l);a||(a=new d.LineBasicMaterial,d.Material.prototype.copy.call(a,o),a.color.copy(o.color),a.map=o.map,this.cache.add(l,a)),o=a}if(s||i||r){let l="ClonedMaterial:"+o.uuid+":";s&&(l+="derivative-tangents:"),i&&(l+="vertex-colors:"),r&&(l+="flat-shading:");let a=this.cache.get(l);a||(a=o.clone(),i&&(a.vertexColors=!0),r&&(a.flatShading=!0),s&&(a.normalScale&&(a.normalScale.y*=-1),a.clearcoatNormalScale&&(a.clearcoatNormalScale.y*=-1)),this.cache.add(l,a),this.associations.set(a,this.associations.get(o))),o=a}e.material=o}/**
 *
 */
		getMaterialType(){return d.MeshStandardMaterial}/**
 *
 */
		loadMaterial(e){const t=this,o=this.json,s=this.extensions,i=o.materials[e];let r;const l={},a=i.extensions||{},c=[];if(a[w.KHR_MATERIALS_UNLIT]){const h=s[w.KHR_MATERIALS_UNLIT];r=h.getMaterialType(),c.push(h.extendParams(l,i,t))}else{const h=i.pbrMetallicRoughness||{};if(l.color=new d.Color(1,1,1),l.opacity=1,Array.isArray(h.baseColorFactor)){const p=h.baseColorFactor;l.color.setRGB(p[0],p[1],p[2],d.LinearSRGBColorSpace),l.opacity=p[3]}h.baseColorTexture!==void 0&&c.push(t.assignTexture(l,"map",h.baseColorTexture,d.SRGBColorSpace)),l.metalness=h.metallicFactor!==void 0?h.metallicFactor:1,l.roughness=h.roughnessFactor!==void 0?h.roughnessFactor:1,h.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(l,"metalnessMap",h.metallicRoughnessTexture)),c.push(t.assignTexture(l,"roughnessMap",h.metallicRoughnessTexture))),r=this._invokeOne(function(p){return p.getMaterialType&&p.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(p){return p.extendMaterialParams&&p.extendMaterialParams(e,l)})))}i.doubleSided===!0&&(l.side=d.DoubleSide);const u=i.alphaMode||ce.OPAQUE;if(u===ce.BLEND?(l.transparent=!0,l.depthWrite=!1):(l.transparent=!1,u===ce.MASK&&(l.alphaTest=i.alphaCutoff!==void 0?i.alphaCutoff:.5)),i.normalTexture!==void 0&&r!==d.MeshBasicMaterial&&(c.push(t.assignTexture(l,"normalMap",i.normalTexture)),l.normalScale=new d.Vector2(1,1),i.normalTexture.scale!==void 0)){const h=i.normalTexture.scale;l.normalScale.set(h,h)}if(i.occlusionTexture!==void 0&&r!==d.MeshBasicMaterial&&(c.push(t.assignTexture(l,"aoMap",i.occlusionTexture)),i.occlusionTexture.strength!==void 0&&(l.aoMapIntensity=i.occlusionTexture.strength)),i.emissiveFactor!==void 0&&r!==d.MeshBasicMaterial){const h=i.emissiveFactor;l.emissive=new d.Color().setRGB(h[0],h[1],h[2],d.LinearSRGBColorSpace)}return i.emissiveTexture!==void 0&&r!==d.MeshBasicMaterial&&c.push(t.assignTexture(l,"emissiveMap",i.emissiveTexture,d.SRGBColorSpace)),Promise.all(c).then(function(){const h=new r(l);return i.name&&(h.name=i.name),z(h,i),t.associations.set(h,{materials:e}),i.extensions&&W(s,h,i),h})}/**
 *
 */
		createUniqueName(e){const t=d.PropertyBinding.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}/**
 *
 */
		loadGeometries(e){const t=this,o=this.extensions,s=this.primitiveCache;

			/**
 *
 */
			function i(l){return o[w.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(l,t).then(function(a){return Le(a,l,t)})}

			const r=[];for(let l=0,a=e.length;l<a;l++){const c=e[l],u=Et(c),h=s[u];if(h)r.push(h.promise);else{let p;c.extensions&&c.extensions[w.KHR_DRACO_MESH_COMPRESSION]?p=i(c):p=Le(new d.BufferGeometry,c,t),s[u]={primitive:c,promise:p},r.push(p)}}return Promise.all(r)}/**
 *
 */
		loadMesh(e){const t=this,o=this.json,s=this.extensions,i=o.meshes[e],r=i.primitives,l=[];for(let a=0,c=r.length;a<c;a++){const u=r[a].material===void 0?Pt(this.cache):this.getDependency("material",r[a].material);l.push(u)}return l.push(t.loadGeometries(r)),Promise.all(l).then(function(a){const c=a.slice(0,a.length-1),u=a[a.length-1],h=[];for(let f=0,g=u.length;f<g;f++){const A=u[f],y=r[f];let m;const x=c[f];if(y.mode===B.TRIANGLES||y.mode===B.TRIANGLE_STRIP||y.mode===B.TRIANGLE_FAN||y.mode===void 0)m=i.isSkinnedMesh===!0?new d.SkinnedMesh(A,x):new d.Mesh(A,x),m.isSkinnedMesh===!0&&m.normalizeSkinWeights(),y.mode===B.TRIANGLE_STRIP?m.geometry=_e(m.geometry,d.TriangleStripDrawMode):y.mode===B.TRIANGLE_FAN&&(m.geometry=_e(m.geometry,d.TriangleFanDrawMode));else if(y.mode===B.LINES)m=new d.LineSegments(A,x);else if(y.mode===B.LINE_STRIP)m=new d.Line(A,x);else if(y.mode===B.LINE_LOOP)m=new d.LineLoop(A,x);else if(y.mode===B.POINTS)m=new d.Points(A,x);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+y.mode);Object.keys(m.geometry.morphAttributes).length>0&&Rt(m,i),m.name=t.createUniqueName(i.name||"mesh_"+e),z(m,i),y.extensions&&W(s,m,y),t.assignFinalMaterial(m),h.push(m)}for(let f=0,g=h.length;f<g;f++)t.associations.set(h[f],{meshes:e,primitives:f});if(h.length===1)return i.extensions&&W(s,h[0],i),h[0];const p=new d.Group;i.extensions&&W(s,p,i),t.associations.set(p,{meshes:e});for(let f=0,g=h.length;f<g;f++)p.add(h[f]);return p})}/**
 *
 */
		loadCamera(e){let t;const o=this.json.cameras[e],s=o[o.type];if(!s){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return o.type==="perspective"?t=new d.PerspectiveCamera(d.MathUtils.radToDeg(s.yfov),s.aspectRatio||1,s.znear||1,s.zfar||2e6):o.type==="orthographic"&&(t=new d.OrthographicCamera(-s.xmag,s.xmag,s.ymag,-s.ymag,s.znear,s.zfar)),o.name&&(t.name=this.createUniqueName(o.name)),z(t,o),Promise.resolve(t)}/**
 *
 */
		loadSkin(e){const t=this.json.skins[e],o=[];for(let s=0,i=t.joints.length;s<i;s++)o.push(this._loadNodeShallow(t.joints[s]));return t.inverseBindMatrices!==void 0?o.push(this.getDependency("accessor",t.inverseBindMatrices)):o.push(null),Promise.all(o).then(function(s){const i=s.pop(),r=s,l=[],a=[];for(let c=0,u=r.length;c<u;c++){const h=r[c];if(h){l.push(h);const p=new d.Matrix4;i!==null&&p.fromArray(i.array,c*16),a.push(p)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new d.Skeleton(l,a)})}/**
 *
 */
		loadAnimation(e){const t=this.json,o=this,s=t.animations[e],i=s.name?s.name:"animation_"+e,r=[],l=[],a=[],c=[],u=[];for(let h=0,p=s.channels.length;h<p;h++){const f=s.channels[h],g=s.samplers[f.sampler],A=f.target,y=A.node,m=s.parameters!==void 0?s.parameters[g.input]:g.input,x=s.parameters!==void 0?s.parameters[g.output]:g.output;A.node!==void 0&&(r.push(this.getDependency("node",y)),l.push(this.getDependency("accessor",m)),a.push(this.getDependency("accessor",x)),c.push(g),u.push(A))}return Promise.all([Promise.all(r),Promise.all(l),Promise.all(a),Promise.all(c),Promise.all(u)]).then(function(h){const p=h[0],f=h[1],g=h[2],A=h[3],y=h[4],m=[];for(let x=0,O=p.length;x<O;x++){const S=p[x],I=f[x],b=g[x],M=A[x],T=y[x];if(S===void 0)continue;S.updateMatrix&&S.updateMatrix();const C=o._createAnimationTracks(S,I,b,M,T);if(C)for(let P=0;P<C.length;P++)m.push(C[P])}return new d.AnimationClip(i,void 0,m)})}/**
 *
 */
		createNodeMesh(e){const t=this.json,o=this,s=t.nodes[e];return s.mesh===void 0?null:o.getDependency("mesh",s.mesh).then(function(i){const r=o._getNodeRef(o.meshCache,s.mesh,i);return s.weights!==void 0&&r.traverse(function(l){if(l.isMesh)for(let a=0,c=s.weights.length;a<c;a++)l.morphTargetInfluences[a]=s.weights[a]}),r})}/**
 *
 */
		loadNode(e){const t=this.json,o=this,s=t.nodes[e],i=o._loadNodeShallow(e),r=[],l=s.children||[];for(let c=0,u=l.length;c<u;c++)r.push(o.getDependency("node",l[c]));const a=s.skin===void 0?Promise.resolve(null):o.getDependency("skin",s.skin);return Promise.all([i,Promise.all(r),a]).then(function(c){const u=c[0],h=c[1],p=c[2];p!==null&&u.traverse(function(f){f.isSkinnedMesh&&f.bind(p,Ft)});for(let f=0,g=h.length;f<g;f++)u.add(h[f]);return u})}/**
 *
 */
		_loadNodeShallow(e){const t=this.json,o=this.extensions,s=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const i=t.nodes[e],r=i.name?s.createUniqueName(i.name):"",l=[],a=s._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return a&&l.push(a),i.camera!==void 0&&l.push(s.getDependency("camera",i.camera).then(function(c){return s._getNodeRef(s.cameraCache,i.camera,c)})),s._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){l.push(c)}),this.nodeCache[e]=Promise.all(l).then(function(c){let u;if(i.isBone===!0?u=new d.Bone:c.length>1?u=new d.Group:c.length===1?u=c[0]:u=new d.Object3D,u!==c[0])for(let h=0,p=c.length;h<p;h++)u.add(c[h]);if(i.name&&(u.userData.name=i.name,u.name=r),z(u,i),i.extensions&&W(o,u,i),i.matrix!==void 0){const h=new d.Matrix4;h.fromArray(i.matrix),u.applyMatrix4(h)}else i.translation!==void 0&&u.position.fromArray(i.translation),i.rotation!==void 0&&u.quaternion.fromArray(i.rotation),i.scale!==void 0&&u.scale.fromArray(i.scale);return s.associations.has(u)||s.associations.set(u,{}),s.associations.get(u).nodes=e,u}),this.nodeCache[e]}/**
 *
 */
		loadScene(e){const t=this.extensions,o=this.json.scenes[e],s=this,i=new d.Group;o.name&&(i.name=s.createUniqueName(o.name)),z(i,o),o.extensions&&W(t,i,o);const r=o.nodes||[],l=[];for(let a=0,c=r.length;a<c;a++)l.push(s.getDependency("node",r[a]));return Promise.all(l).then(function(a){for(let u=0,h=a.length;u<h;u++)i.add(a[u]);const c=u=>{const h=new Map;for(const[p,f]of s.associations)(p instanceof d.Material||p instanceof d.Texture)&&h.set(p,f);return u.traverse(p=>{const f=s.associations.get(p);f!=null&&h.set(p,f)}),h};return s.associations=c(i),i})}/**
 *
 */
		_createAnimationTracks(e,t,o,s,i){const r=[],l=e.name?e.name:e.uuid,a=[];K[i.path]===K.weights?e.traverse(function(p){p.morphTargetInfluences&&a.push(p.name?p.name:p.uuid)}):a.push(l);let c;switch(K[i.path]){case K.weights:c=d.NumberKeyframeTrack;break;case K.rotation:c=d.QuaternionKeyframeTrack;break;case K.position:case K.scale:c=d.VectorKeyframeTrack;break;default:switch(o.itemSize){case 1:c=d.NumberKeyframeTrack;break;case 2:case 3:default:c=d.VectorKeyframeTrack;break}break}const u=s.interpolation!==void 0?Nt[s.interpolation]:d.InterpolateLinear,h=this._getArrayFromAccessor(o);for(let p=0,f=a.length;p<f;p++){const g=new c(a[p]+"."+K[i.path],t.array,h,u);s.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(g),r.push(g)}return r}/**
 *
 */
		_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const o=ue(t.constructor),s=new Float32Array(t.length);for(let i=0,r=t.length;i<r;i++)s[i]=t[i]*o;t=s}return t}/**
 *
 */
		_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(o){const s=this instanceof d.QuaternionKeyframeTrack?Dt:Me;return new s(this.times,this.values,this.getValueSize()/3,o)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}

	/**
 *
 */
	function jt(n,e,t){const o=e.attributes,s=new d.Box3;if(o.POSITION!==void 0){const l=t.json.accessors[o.POSITION],a=l.min,c=l.max;if(a!==void 0&&c!==void 0){if(s.set(new d.Vector3(a[0],a[1],a[2]),new d.Vector3(c[0],c[1],c[2])),l.normalized){const u=ue(X[l.componentType]);s.min.multiplyScalar(u),s.max.multiplyScalar(u)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const i=e.targets;if(i!==void 0){const l=new d.Vector3,a=new d.Vector3;for(let c=0,u=i.length;c<u;c++){const h=i[c];if(h.POSITION!==void 0){const p=t.json.accessors[h.POSITION],f=p.min,g=p.max;if(f!==void 0&&g!==void 0){if(a.setX(Math.max(Math.abs(f[0]),Math.abs(g[0]))),a.setY(Math.max(Math.abs(f[1]),Math.abs(g[1]))),a.setZ(Math.max(Math.abs(f[2]),Math.abs(g[2]))),p.normalized){const A=ue(X[p.componentType]);a.multiplyScalar(A)}l.max(a)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}s.expandByVector(l)}n.boundingBox=s;const r=new d.Sphere;s.getCenter(r.center),r.radius=s.min.distanceTo(s.max)/2,n.boundingSphere=r}

	/**
 *
 */
	function Le(n,e,t){const o=e.attributes,s=[];

		/**
 *
 */
		function i(r,l){return t.getDependency("accessor",r).then(function(a){n.setAttribute(l,a)})}

		for(const r in o){const l=le[r]||r.toLowerCase();l in n.attributes||s.push(i(o[r],l))}if(e.indices!==void 0&&!n.index){const r=t.getDependency("accessor",e.indices).then(function(l){n.setIndex(l)});s.push(r)}return d.ColorManagement.workingColorSpace!==d.LinearSRGBColorSpace&&"COLOR_0"in o&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${d.ColorManagement.workingColorSpace}" not supported.`),z(n,e),jt(n,e,t),Promise.all(s).then(function(){return e.targets!==void 0?Ut(n,e.targets,t):n})}

	const Y=new WeakMap;

	/**
 *
 */
	function ve(n,e){if(console.log(`Switching to UV channel: ${e}`),!n.modelObject||!n.textureObject){console.warn("Cannot switch UV channel: Model or texture not loaded");return}let t;if(typeof e=="number")t=e===0?"uv":`uv${e+1}`;else if(typeof e=="string"){t=e;const i=t==="uv"?0:parseInt(t.replace("uv",""))-1;n.currentUvSet=i}else{console.error("Invalid UV channel type:",typeof e);return}let o=0,s=0;n.modelObject.traverse(i=>{if(i.isMesh&&(i.userData.originalMaterial||(i.userData.originalMaterial=i.material.clone()),i.name.toLowerCase().includes("screen")||i.name.toLowerCase().includes("display")||i.name.toLowerCase().includes("monitor"))){s++;const l=i.geometry&&i.geometry.attributes[t]!==void 0;if(console.log(`Processing screen mesh: ${i.name}, has ${t}: ${l}`),n.textureObject&&l){o++;const a=new L.MeshStandardMaterial;a.roughness=.1,a.metalness=.2;const c=n.textureObject.clone();c.flipY=!1,c.encoding=L.sRGBEncoding,c.offset.set(0,0),c.repeat.set(1,1),c.needsUpdate=!0,!Y.has(i)&&i.geometry.attributes.uv&&(Y.set(i,i.geometry.attributes.uv.clone()),console.log(`Stored original UV data for ${i.name}`)),a.map=c,a.emissiveMap=c,a.emissive.set(1,1,1),t==="uv"?Y.has(i)&&(i.geometry.attributes.uv=Y.get(i).clone(),i.geometry.attributes.uv.needsUpdate=!0,console.log(`Restored original UV data for ${i.name}`)):i.geometry.attributes[t]&&(Y.has(i)||(Y.set(i,i.geometry.attributes.uv.clone()),console.log(`Stored original UV data for ${i.name}`)),i.geometry.attributes.uv=i.geometry.attributes[t].clone(),i.geometry.attributes.uv.needsUpdate=!0,console.log(`Applied ${t} to primary UV channel for ${i.name}`)),a.needsUpdate=!0,i.material=a,n.screenMeshes||(n.screenMeshes=[]),n.screenMeshes.includes(i)||n.screenMeshes.push(i)}}}),Gt(n,typeof e=="number"?e:t==="uv"?0:parseInt(t.replace("uv",""))-1),console.log(`Switched to UV channel ${t}: ${o}/${s} screen meshes affected`),n.renderer&&n.camera&&n.scene&&n.renderer.render(n.scene,n.camera),Vt(n,t)}

	/**
 *
 */
	function Vt(n,e){if(!n.scene)return null;let t=1,o=1,s=0,i=0,r=!1,l;if(typeof e=="number")l=e===0?"uv":`uv${e+1}`;else if(typeof e=="string")l=e;else return console.error("Invalid channel type in analyzeUvBounds:",typeof e),null;if(n.scene.traverse(c=>{if(c.isMesh&&c.geometry&&c.geometry.attributes&&c.visible){const h=c.geometry.attributes[l];if(h&&h.array){r=!0;for(let p=0;p<h.count;p++){const f=h.getX(p),g=h.getY(p);isNaN(f)||isNaN(g)||(t=Math.min(t,f),o=Math.min(o,g),s=Math.max(s,f),i=Math.max(i,g))}}}}),!r)return null;const a=.01;return t=Math.max(0,t-a),o=Math.max(0,o-a),s=Math.min(1,s+a),i=Math.min(1,i+a),{min:[t,o],max:[s,i]}}

	/**
 *
 */
	function Gt(n,e){const t=document.getElementById("uv-info-container");if(!t)return;let o;if(typeof e=="number")o=e===0?"uv":`uv${e+1}`;else if(typeof e=="string")o=e;else{console.error("Invalid UV channel type in updateUvDisplayInformation:",typeof e);return}let s=0,i=0,r=0,l=0,a=1/0,c=-1/0,u=1/0,h=-1/0,p="",f=[];n.scene.traverse(x=>{if(x.isMesh){r++;const O=x.geometry;if(O&&O.attributes){const S=x.name.toLowerCase().includes("screen")||x.name.toLowerCase().includes("display")||x.name.toLowerCase().includes("monitor"),I=O.attributes[o];if(I){s++,S&&i++,l+=I.count;for(let b=0;b<I.count;b++){const M=I.getX(b),T=I.getY(b);isNaN(M)||isNaN(T)||(a=Math.min(a,M),c=Math.max(c,M),u=Math.min(u,T),h=Math.max(h,T))}if(S&&f.length===0){p=x.name;const b=Math.min(5,I.count);for(let M=0;M<b;M++)f.push({index:M,u:I.getX(M),v:I.getY(M)});I.count>b&&f.push({note:`... and ${I.count-b} more vertices`})}}}}});let g="Unknown",A="Unknown";if(a===1/0){t.innerHTML=`<span style="color: #e74c3c; font-weight: bold;">No meshes with ${o} channel found</span>`;return}if(c>1||a<0||h>1||u<0)g="Tiling / Repeating";else{g="Standard (0-1 Range)";const x=c-a,O=h-u;x<.5||O<.5?A="Partial Texture":A="Full Texture"}const y=document.getElementById("uv-channel-select");if(y)for(let x=0;x<y.options.length;x++)y.options[x].value===o&&(y.options[x].textContent=`${o.toUpperCase()} - ${A} (U: ${a.toFixed(2)}-${c.toFixed(2)}, V: ${u.toFixed(2)}-${h.toFixed(2)})`);let m='<div style="background-color: #222; padding: 10px; border-radius: 5px;">';m+='<div style="color: #f1c40f; font-weight: bold; margin-bottom: 5px;">UV Channel Info:</div>',m+=`<div>Channel Name: <span style="color: #3498db;">${o}</span></div>`,m+=`<div>Mapping Type: <span style="color: #3498db;">${g}</span></div>`,m+=`<div>Texture Usage: <span style="color: #3498db;">${A}</span></div>`,m+='<div style="color: #f1c40f; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">Mesh Statistics:</div>',m+=`<div>Meshes with this UV: <span style="color: #3498db;">${s} of ${r}</span></div>`,m+=`<div>Screen Meshes: <span style="color: #3498db;">${i}</span></div>`,m+=`<div>Total Vertices: <span style="color: #3498db;">${l}</span></div>`,m+=`<div>UV Range: U: <span style="color: #3498db;">${a.toFixed(4)} to ${c.toFixed(4)}</span>, V: <span style="color: #3498db;">${u.toFixed(4)} to ${h.toFixed(4)}</span></div>`,p&&f.length>0&&(m+=`<div style="color: #f1c40f; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">Sample UV Coordinates from ${p}:</div>`,f.forEach(x=>{x.note?m+=`<div>${x.note}</div>`:m+=`<div>Vertex ${x.index}: (${x.u.toFixed(4)}, ${x.v.toFixed(4)})</div>`})),m+="</div>",t.innerHTML=m}

	/**
 *
 */
	function zt(n){if(!n.scene)return["uv"];const e=new Set(["uv"]);return n.scene.traverse(t=>{t.isMesh&&t.geometry&&t.geometry.attributes&&(t.geometry.attributes.uv2&&e.add("uv2"),t.geometry.attributes.uv3&&e.add("uv3"))}),Array.from(e)}

	/**
 *
 */
	function Kt(n){if(!n.scene||!n.modelFile)return null;const e={name:n.modelFile.name,size:n.modelFile.size,uvSets:zt(n),meshes:[]};return n.scene.traverse(t=>{t.isMesh&&e.meshes.push(t)}),e}

	/**
 *
 */
	async function $t(n,e){return new Promise((t,o)=>{if(!e){o(new Error("No texture file provided"));return}const s=new L.TextureLoader,i=URL.createObjectURL(e);s.load(i,r=>{console.log("Texture loaded:",r),n.textureObject=r,r.flipY=!1,r.encoding=L.sRGBEncoding,n.modelLoaded&&n.modelObject&&Wt(n);const l={name:e.name,size:e.size,dimensions:{width:r.image.width,height:r.image.height}};fe&&fe(l),URL.revokeObjectURL(i),document.dispatchEvent(new CustomEvent("textureLoaded")),t(r)},void 0,r=>{console.error("Error loading texture:",r),URL.revokeObjectURL(i),o(r)})})}

	/**
 *
 */
	function Wt(n){if(!n.modelObject||!n.textureObject){console.warn("Cannot apply texture: Model or texture not loaded",{modelExists:!!n.modelObject,textureExists:!!n.textureObject});return}if(console.log("Applying texture to model",n.textureObject),n.modelObject.traverse(e=>{if(e.isMesh&&e.material&&(e.userData.originalMaterial||(e.userData.originalMaterial=e.material.clone()),e.name.toLowerCase().includes("screen")||e.name.toLowerCase().includes("display")||e.name.toLowerCase().includes("monitor"))){if(console.log(`Setting up screen mesh: ${e.name}`),e.geometry){let s="UV Sets: ";const i=[];for(let r=0;r<8;r++)i.push(r===0?"uv":`uv${r+1}`);i.forEach(r=>{e.geometry.attributes[r]&&(s+=`${r}, `)}),console.log(s)}const o=new L.MeshStandardMaterial;e.userData.originalMaterial?(o.roughness=e.userData.originalMaterial.roughness||.1,o.metalness=e.userData.originalMaterial.metalness||.2):(o.roughness=.1,o.metalness=.2),o.map=n.textureObject.clone(),o.map.flipY=!1,o.map.encoding=L.sRGBEncoding,o.map.wrapS=L.ClampToEdgeWrapping,o.map.wrapT=L.ClampToEdgeWrapping,o.map.minFilter=L.LinearFilter,o.map.magFilter=L.LinearFilter,o.emissiveMap=o.map,o.emissive.set(1,1,1),o.map.offset.set(0,0),o.map.repeat.set(1,1),o.emissiveMap.offset.set(0,0),o.emissiveMap.repeat.set(1,1),o.map.needsUpdate=!0,o.emissiveMap.needsUpdate=!0,o.needsUpdate=!0,e.material=o,n.screenMeshes||(n.screenMeshes=[]),n.screenMeshes.includes(e)||n.screenMeshes.push(e)}}),n.renderer&&n.camera&&n.scene){console.log("Forcing render update"),n.renderer.render(n.scene,n.camera);try{Promise.resolve().then(()=>sn).then(e=>{console.log("Auto-showing texture atlas visualization"),e.createAtlasVisualization(n),n.renderer&&n.camera&&n.scene&&setTimeout(()=>{n.renderer.render(n.scene,n.camera),console.log("Atlas visualization should now be visible")},100)})}catch(e){console.error("Failed to auto-show atlas visualization:",e)}}}

	/**
 *
 */
	function Xt(n){return n<1024?n+" bytes":n<1024*1024?(n/1024).toFixed(1)+" KB":(n/(1024*1024)).toFixed(1)+" MB"}

	/**
 *
 */
	function Yt(n){return n.slice((n.lastIndexOf(".")-1>>>0)+2)}

	/**
 *
 */
	function qt(n,e={},t=[]){const o=document.createElement(n);return Object.entries(e).forEach(([s,i])=>{if(s==="style"&&typeof i=="object")Object.assign(o.style,i);else if(s==="className")o.className=i;else if(s==="textContent")o.textContent=i;else if(s.startsWith("on")&&typeof i=="function"){const r=s.slice(2).toLowerCase();o.addEventListener(r,i)}else o[s]=i}),t.forEach(s=>{typeof s=="string"?o.appendChild(document.createTextNode(s)):s instanceof Node&&o.appendChild(s)}),o}

	let D=null;

	/**
 *
 */
	function Zt(n){if(!n.textureObject){alert("No texture loaded. Please load a texture first.");return}if(D){const i=D.style.display!=="none";D.style.display=i?"none":"block";return}D=document.createElement("div"),D.id="texture-editor",D.style.position="fixed",D.style.left="50%",D.style.top="50%",D.style.transform="translate(-50%, -50%)",D.style.width="80%",D.style.maxWidth="800px",D.style.maxHeight="80vh",D.style.backgroundColor="rgba(40, 40, 40, 0.95)",D.style.color="white",D.style.padding="20px",D.style.borderRadius="8px",D.style.zIndex="1000",D.style.boxShadow="0 0 20px rgba(0, 0, 0, 0.5)",D.style.overflowY="auto";const e=document.createElement("div");e.style.display="flex",e.style.justifyContent="space-between",e.style.alignItems="center",e.style.marginBottom="20px";const t=document.createElement("h2");t.textContent="Texture Editor",t.style.margin="0";const o=document.createElement("button");o.textContent="×",o.style.background="none",o.style.border="none",o.style.color="white",o.style.fontSize="24px",o.style.cursor="pointer",o.addEventListener("click",()=>{D.style.display="none"}),e.appendChild(t),e.appendChild(o),D.appendChild(e);const s=document.createElement("div");s.style.textAlign="center",s.style.padding="40px",s.style.color="#aaa",s.innerHTML=`
    <p>Texture Editor will be implemented in a future update.</p>
    <p>Planned features include:</p>
    <ul style="text-align: left; display: inline-block;">
      <li>Basic adjustments (brightness, contrast, saturation)</li>
      <li>Channel viewing and editing</li>
      <li>UV island visualization</li>
      <li>Texture baking tools</li>
    </ul>
  `,D.appendChild(s),document.body.appendChild(D)}

	let _=null;

	/**
 *
 */
	function he(n){if(!n.textureObject){console.warn("No texture loaded. Cannot create atlas visualization.");return}const e=document.querySelectorAll("#atlas-visualization");if(e.length>1)for(let u=1;u<e.length;u++)document.body.contains(e[u])&&document.body.removeChild(e[u]);if(_){_.style.display==="none"&&(_.style.display="block"),J(n.textureObject,n.currentUvRegion||{min:[0,0],max:[1,1]});return}_=document.createElement("div"),_.id="atlas-visualization",_.style.position="absolute",_.style.bottom="20px",_.style.left="20px",_.style.width="300px",_.style.height="auto",_.style.backgroundColor="rgba(0, 0, 0, 0.8)",_.style.border="1px solid #666",_.style.borderRadius="5px",_.style.color="white",_.style.fontFamily="monospace",_.style.fontSize="12px",_.style.zIndex="1000",_.style.boxSizing="border-box",_.style.overflow="hidden";const t=document.createElement("div");t.style.display="flex",t.style.justifyContent="space-between",t.style.alignItems="center",t.style.padding="10px",t.style.cursor="move",t.style.borderBottom="1px solid #444";const o=document.createElement("div");o.style.display="flex",o.style.alignItems="center";const s=document.createElement("span");s.textContent="▼",s.style.marginRight="5px",s.style.cursor="pointer",s.style.fontSize="10px",s.style.color="#aaa",s.style.transition="transform 0.2s";const i=document.createElement("div");i.className="atlas-content",i.style.padding="10px",i.style.paddingTop="5px",i.style.display="block",s.addEventListener("click",u=>{if(u.stopPropagation(),i.style.display==="none")i.style.display="block",s.textContent="▼",t.style.borderBottom="1px solid #444",_.style.transition="height 0.3s ease",_.style.height="auto",setTimeout(()=>{_.style.transition=""},300);else{const p=t.offsetHeight;i.style.display="none",s.textContent="►",t.style.borderBottom="none",_.style.transition="height 0.3s ease",_.style.height=`${p}px`,setTimeout(()=>{_.style.transition=""},300)}}),o.appendChild(s);const r=document.createElement("div");r.className="atlas-title",r.textContent="Atlas Texture Visualization",r.style.fontWeight="bold",o.appendChild(r),t.appendChild(o);const l=document.createElement("button");l.textContent="×",l.style.background="none",l.style.border="none",l.style.color="white",l.style.fontSize="16px",l.style.cursor="pointer",l.style.padding="0 5px",l.addEventListener("click",u=>{u.stopPropagation(),_.style.display="none"}),t.appendChild(l),_.appendChild(t),_.appendChild(i);const a=document.createElement("canvas");a.style.width="100%",a.style.border="1px solid #444",a.style.display="block",a.style.maxHeight="400px",i.appendChild(a);const c=document.createElement("div");return c.className="coords-text",c.style.marginTop="5px",c.style.fontSize="10px",c.style.color="#aaa",c.textContent="UV coordinates: Full texture is shown",i.appendChild(c),document.body.appendChild(_),J(n.textureObject,{min:[0,0],max:[1,1]}),console.log("Atlas visualization created with HTML canvas"),nn(_),_}

	/**
 *
 */
	function Qt(n){if(!n.textureObject||!_)return;const e=n.currentUvRegion||{min:[0,0],max:[1,1]};J(n.textureObject,e),_.style.display==="none"&&(_.style.display="block"),console.log("Atlas visualization updated with new texture")}

	/**
 *
 */
	function J(n,e={min:[0,0],max:[1,1]}){if(!_||!n||!n.image)return;let t=_.querySelector("canvas");if(!t){t=document.createElement("canvas"),t.style.width="100%",t.style.border="1px solid #444",t.style.display="block",t.style.maxHeight="300px";const c=_.querySelector(".atlas-content");c?c.appendChild(t):_.appendChild(t)}const o=280,s=280,i=n.image.height/n.image.width;t.width=Math.min(n.image.width,o),t.height=Math.min(t.width*i,s);const r=t.getContext("2d");r.clearRect(0,0,t.width,t.height);try{r.drawImage(n.image,0,0,t.width,t.height)}catch(c){console.error("Error drawing texture to canvas:",c)}Ht(r,t.width,t.height),Jt(r,e,t.width,t.height);let l=_.querySelector(".coords-text");if(!l){l=document.createElement("div"),l.className="coords-text",l.style.marginTop="5px",l.style.marginBottom="0",l.style.fontSize="10px",l.style.color="#aaa";const c=_.querySelector(".atlas-content");c?c.appendChild(l):_.appendChild(l)}e.min[0]===0&&e.min[1]===0&&e.max[0]===1&&e.max[1]===1?l.textContent="Currently using: Full texture (0,0) to (1,1)":l.textContent=`Currently using: (${e.min[0].toFixed(2)},${e.min[1].toFixed(2)}) to (${e.max[0].toFixed(2)},${e.max[1].toFixed(2)})`}

	/**
 *
 */
	function Ht(n,e,t){n.strokeStyle="rgba(255, 255, 255, 0.3)",n.lineWidth=1;for(let o=1;o<10;o++){const s=e*o/10;n.beginPath(),n.moveTo(s,0),n.lineTo(s,t),n.stroke()}for(let o=1;o<10;o++){const s=t*o/10;n.beginPath(),n.moveTo(0,s),n.lineTo(e,s),n.stroke()}n.fillStyle="white",n.font="10px monospace",n.fillText("0,0",2,t-2),n.fillText("1,0",e-20,t-2),n.fillText("0,1",2,10),n.fillText("1,1",e-20,10)}

	/**
 *
 */
	function Jt(n,e,t,o){n.strokeStyle="red",n.lineWidth=2,n.beginPath();const s=t*e.min[0],i=o*(1-e.max[1]),r=t*(e.max[0]-e.min[0]),l=o*(e.max[1]-e.min[1]);n.rect(s,i,r,l),n.stroke(),n.fillStyle="rgba(255, 0, 0, 0.1)",n.fill()}

	/**
 *
 */
	function en(){_&&(document.body.contains(_)&&document.body.removeChild(_),_=null)}

	/**
 *
 */
	function tn(n,e,t){if(t.textureObject)return t.currentUvRegion={min:n,max:e},_&&(J(t.textureObject,t.currentUvRegion),_.style.display==="none"&&(_.style.display="block")),console.log(`Updated current UV region to: (${n[0].toFixed(2)},${n[1].toFixed(2)}) - (${e[0].toFixed(2)},${e[1].toFixed(2)})`),t.currentUvRegion}

	/**
 *
 */
	function nn(n){let e=!1,t={x:0,y:0};const o={left:20,bottom:20},s=50,i=n.querySelector("div:first-child");i&&(i.style.cursor="move",i.addEventListener("mousedown",r=>{e=!0,t.x=r.clientX-n.offsetLeft,t.y=r.clientY-n.offsetTop,n.style.opacity="0.8"}),document.addEventListener("mousemove",r=>{if(!e)return;const l=r.clientX-t.x,a=r.clientY-t.y,c=window.innerWidth-n.offsetWidth,u=window.innerHeight-n.offsetHeight;n.style.left=Math.min(Math.max(0,l),c)+"px",n.style.top=Math.min(Math.max(0,a),u)+"px",n.style.bottom="auto"}),document.addEventListener("mouseup",()=>{if(!e)return;e=!1,n.style.opacity="1";const r=n.getBoundingClientRect(),l=r.left,a=window.innerHeight-r.bottom,c=Math.abs(l-o.left)<s,u=Math.abs(a-o.bottom)<s;c&&u&&(n.style.transition="left 0.3s ease, bottom 0.3s ease, top 0.3s ease",n.style.left=`${o.left}px`,n.style.bottom=`${o.bottom}px`,n.style.top="auto",setTimeout(()=>{n.style.transition=""},300))}))}

	const sn=Object.freeze(Object.defineProperty({__proto__:null,createAtlasVisualization:he,removeAtlasVisualization:en,setCurrentUvRegion:tn,updateAtlasVisualization:Qt},Symbol.toStringTag,{value:"Module"}));let pe=null,fe=null;

	/**
 *
 */
	function on(n){an(n)}

	/**
 *
 */
	function rn(n){console.log("Starting debugging with files:",n.modelFile,n.textureFile);const e=document.getElementById("drop-container");e&&(e.style.display="none");const t=document.getElementById("loading");t&&(t.style.display="flex"),n.renderer&&(n.renderer.domElement.style.display="block"),n.isDebugMode=!0;const o=document.getElementById("debug-panel");o&&(o.style.display="block")}

	/**
 *
 */
	function an(n){const e=document.createElement("div");e.id="debug-panel",e.style.position="fixed",e.style.top="20px",e.style.right="20px",e.style.backgroundColor="rgba(0, 0, 0, 0.7)",e.style.padding="15px",e.style.borderRadius="8px",e.style.width="300px",e.style.maxHeight="calc(100vh - 40px)",e.style.overflowY="auto",e.style.zIndex="100",e.style.display="none",e.style.boxShadow="0 4px 8px rgba(0, 0, 0, 0.5)";const t=document.createElement("h3");t.textContent="Asset Debug Info",t.style.marginTop="0",t.style.color="#3498db",e.appendChild(t);const o=document.createElement("div");o.className="debug-section",o.style.marginBottom="15px";const s=document.createElement("div");s.className="debug-label",s.textContent="Model Info:",s.style.fontWeight="bold",s.style.marginBottom="5px",s.style.color="#95a5a6";const i=document.createElement("div");i.id="model-info",i.className="debug-value",i.textContent="No model loaded",i.style.fontFamily="monospace",i.style.backgroundColor="rgba(0, 0, 0, 0.5)",i.style.padding="5px",i.style.borderRadius="3px",i.style.wordBreak="break-word",o.appendChild(s),o.appendChild(i),e.appendChild(o);const r=document.createElement("div");r.className="debug-section",r.style.marginBottom="15px";const l=document.createElement("div");l.className="debug-label",l.textContent="Texture Info:",l.style.fontWeight="bold",l.style.marginBottom="5px",l.style.color="#95a5a6";const a=document.createElement("div");a.id="texture-info",a.className="debug-value",a.textContent="No texture loaded",a.style.fontFamily="monospace",a.style.backgroundColor="rgba(0, 0, 0, 0.5)",a.style.padding="5px",a.style.borderRadius="3px",a.style.wordBreak="break-word",r.appendChild(l),r.appendChild(a),e.appendChild(r);const c=document.createElement("div");c.className="debug-section",c.style.marginBottom="15px";const u=document.createElement("div");u.className="debug-label",u.textContent="Mesh Visibility:",u.style.fontWeight="bold",u.style.marginBottom="5px",u.style.color="#95a5a6";const h=document.createElement("div");h.id="mesh-toggles";const p=document.createElement("div");p.style.fontSize="0.85em",p.style.color="#999",p.style.marginTop="5px",p.textContent="Toggle visibility of individual meshes or entire groups.",c.appendChild(u),c.appendChild(h),c.appendChild(p),e.appendChild(c);const f=document.createElement("div");f.className="debug-section",f.id="uv-info-section",e.appendChild(f);const g=document.createElement("div");g.className="debug-section";const A=document.createElement("button");A.className="debug-button",A.textContent="Show Texture Atlas",A.style.width="100%",A.style.padding="8px",A.style.marginBottom="10px",A.style.backgroundColor="#e67e22",A.addEventListener("click",()=>{he(n)}),g.appendChild(A),e.appendChild(g);const y=document.createElement("div");y.className="debug-section";const m=document.createElement("button");m.className="debug-button",m.textContent="Open Texture Editor",m.style.width="100%",m.style.padding="8px",m.style.marginTop="10px",m.style.backgroundColor="#9b59b6",m.addEventListener("click",()=>{Zt(n)}),y.appendChild(m),e.appendChild(y),document.body.appendChild(e);

		/**
 *
 */
		function x(b){const M=document.getElementById("model-info");if(M)if(b){let T="";T+=`Name: ${b.name||"Unknown"}<br>`,T+=`Size: ${I(b.size||0)}<br>`,b.uvSets&&b.uvSets.length>0?(T+=`<span style="color: #3498db; font-weight: bold;">UV Maps: ${b.uvSets.join(", ")}</span><br>`,console.log("UV Sets detected:",b.uvSets)):T+='<span style="color: #e74c3c;">No UV maps detected</span><br>',b.meshes&&b.meshes.length>0&&(T+=`<br>Meshes: ${b.meshes.length}<br>`,O(b.meshes)),M.innerHTML=T}else M.textContent="No model loaded"}

		/**
 *
 */
		function O(b){const M=document.getElementById("mesh-toggles");if(!M)return;M.innerHTML="";const T={};b.forEach(C=>{let P="unclassified";if(C.name){const k=C.name.indexOf("_");k>0?P=C.name.substring(0,k):P=C.name}else C.parent&&C.parent.name&&(P=C.parent.name);T[P]||(T[P]=[]),T[P].push(C)});for(const C in T){const P=T[C],k=document.createElement("div");k.style.marginBottom="15px",k.style.padding="8px",k.style.backgroundColor="rgba(0, 0, 0, 0.3)",k.style.borderRadius="5px";const G=document.createElement("div");G.style.display="flex",G.style.justifyContent="space-between",G.style.alignItems="center",G.style.marginBottom="8px",G.style.cursor="pointer";const ne=document.createElement("div");ne.textContent=`Group: ${C} (${P.length} mesh${P.length>1?"es":""})`,ne.style.fontWeight="bold",ne.style.color="#3498db",G.appendChild(ne);const F=document.createElement("button");F.textContent="Hide",F.className="debug-button",F.style.marginLeft="10px",F.style.marginRight="10px",F.style.padding="2px 8px",F.style.minWidth="45px",F.style.backgroundColor="#3498db",F.style.color="white",F.style.fontWeight="bold",F.addEventListener("click",V=>{V.stopPropagation();const $=P.some(j=>j.visible);P.forEach(j=>{j.visible=!$}),F.textContent=$?"Show":"Hide",F.style.backgroundColor=$?"#95a5a6":"#3498db",q.querySelectorAll(".mesh-toggle").forEach(j=>{j.style.backgroundColor=$?"#95a5a6":"#3498db"})}),G.appendChild(F);const Q=document.createElement("span");Q.textContent="▼",Q.style.transition="transform 0.3s",G.appendChild(Q),k.appendChild(G);const q=document.createElement("div");q.style.display="none";const se=document.createElement("div");se.style.marginLeft="10px",se.style.marginTop="5px",P.forEach(V=>{const $=document.createElement("div");$.style.margin="5px 0";const j=document.createElement("button");j.textContent=V.name||"Unnamed Mesh",j.className="debug-button mesh-toggle",j.style.backgroundColor=V.visible?"#3498db":"#95a5a6",j.addEventListener("click",bn=>{bn.stopPropagation(),V.visible=!V.visible,j.style.backgroundColor=V.visible?"#3498db":"#95a5a6"}),$.appendChild(j),se.appendChild($)}),q.appendChild(se),k.appendChild(q),G.addEventListener("click",()=>{const V=q.style.display==="none";q.style.display=V?"block":"none",Q.textContent=V?"▲":"▼",Q.style.transform="rotate(0deg)"}),M.appendChild(k)}}

		/**
 *
 */
		function S(b){const M=document.getElementById("texture-info");if(M)if(b&&b.textureFile){const T=b.textureFile;let C="";C+=`Name: ${T.name||"Unknown"}<br>`,C+=`Size: ${I(T.size||0)}<br>`,b.textureObject&&b.textureObject.image&&(C+=`Dimensions: ${b.textureObject.image.width} x ${b.textureObject.image.height}<br>`),M.innerHTML=C}else if(b){let T="";T+=`Name: ${b.name||"Unknown"}<br>`,T+=`Size: ${I(b.size||0)}<br>`,b.dimensions&&(T+=`Dimensions: ${b.dimensions.width} x ${b.dimensions.height}<br>`),M.innerHTML=T}else M.textContent="No texture loaded"}

		/**
 *
 */
		function I(b,M=2){if(b===0)return"0 Bytes";const T=1024,C=M<0?0:M,P=["Bytes","KB","MB","GB"],k=Math.floor(Math.log(b)/Math.log(T));return parseFloat((b/Math.pow(T,k)).toFixed(C))+" "+P[k]}

		return pe=x,fe=S,n.updateModelInfo=x,n.updateTextureInfo=S,e}

	/**
 *
 */
	function Ce(n){if(!n.modelObject||!n.textureObject){console.log("Cannot show atlas visualization: Model or texture not loaded");return}console.log("Auto-showing atlas visualization"),n.availableUvSets=[],n.uvSetNames=[];const e=[];for(let s=0;s<8;s++)e.push(s===0?"uv":`uv${s+1}`);const t=new Map;n.modelObject.traverse(s=>{s.isMesh&&s.geometry&&e.forEach(i=>{if(s.geometry.attributes[i]){t.has(i)||t.set(i,{count:0,minU:1/0,maxU:-1/0,minV:1/0,maxV:-1/0,sampleUVs:null,sampleMesh:null,meshes:[]});const r=t.get(i);r.count++,r.meshes.push(s),(s.name.toLowerCase().includes("screen")||s.name.toLowerCase().includes("display")||s.name.toLowerCase().includes("monitor"))&&!r.sampleUVs&&(r.sampleUVs=s.geometry.attributes[i].array,r.sampleMesh=s);const a=s.geometry.attributes[i];for(let c=0;c<a.count;c++){const u=a.getX(c),h=a.getY(c);isNaN(u)||isNaN(h)||(r.minU=Math.min(r.minU,u),r.maxU=Math.max(r.maxU,u),r.minV=Math.min(r.minV,h),r.maxV=Math.max(r.maxV,h))}}})}),t.forEach((s,i)=>{let r="Unknown";if(!(s.maxU>1||s.minU<0||s.maxV>1||s.minV<0)){const a=s.maxU-s.minU,c=s.maxV-s.minV;a<.5||c<.5?r="Partial Texture":r="Full Texture"}n.availableUvSets.push(i);const l=`${i.toUpperCase()} - ${r} (U: ${s.minU.toFixed(2)}-${s.maxU.toFixed(2)}, V: ${s.minV.toFixed(2)}-${s.maxV.toFixed(2)})`;n.uvSetNames.push(l)}),console.log("Available UV sets:",n.availableUvSets),console.log("UV set display names:",n.uvSetNames),ln(n);let o=null;if(n.availableUvSets.includes("uv")?(o="uv",console.log("Using industry standard UV1 (uv) as default")):n.availableUvSets.length>0&&(o=n.availableUvSets[0],console.log(`UV1 not found, using ${o} as fallback`)),o||(o="uv",console.log("No UV channels found, defaulting to uv")),o){const s=n.availableUvSets.indexOf(o);s!==-1&&(n.currentUvSet=s,console.log(`Setting initial UV channel to ${o} (index: ${s})`),ve(n,o))}he(n)}

	/**
 *
 */
	function ln(n){const e=document.getElementById("uv-info-section");if(!e)return;for(;e.firstChild;)e.removeChild(e.firstChild);const t=document.createElement("div");if(t.className="debug-label",t.textContent="UV Information:",t.style.fontWeight="bold",t.style.marginBottom="10px",t.style.color="#95a5a6",e.appendChild(t),n.availableUvSets.length===0){const l=document.createElement("div");l.className="debug-value",l.style.padding="10px",l.style.backgroundColor="rgba(0, 0, 0, 0.5)",l.style.borderRadius="5px",l.textContent="No UV data found in this model.",e.appendChild(l);return}const o=document.createElement("div");o.id="uv-controls",o.style.marginBottom="15px";const s=document.createElement("div");s.textContent="Select UV Channel:",s.style.marginBottom="5px",s.style.color="white",o.appendChild(s);const i=document.createElement("select");i.id="uv-channel-select",i.style.width="100%",i.style.backgroundColor="#333",i.style.color="white",i.style.padding="8px",i.style.border="1px solid #555",i.style.borderRadius="3px",i.style.marginBottom="10px",i.style.cursor="pointer",n.uvSetNames.forEach((l,a)=>{const c=document.createElement("option");c.value=a,c.textContent=l,i.appendChild(c)}),n.currentUvSet!==void 0&&n.currentUvSet>=0&&n.currentUvSet<n.availableUvSets.length?(i.value=n.currentUvSet,console.log(`Setting dropdown to UV set index ${n.currentUvSet}: ${n.availableUvSets[n.currentUvSet]}`)):(i.selectedIndex=0,n.currentUvSet=0,console.log(`Defaulting dropdown to first UV set: ${n.availableUvSets[0]}`)),console.log(`UV Dropdown initialized with value: ${i.value}, text: ${i.options[i.selectedIndex].text}`),i.addEventListener("change",function(){const l=parseInt(this.value);n.currentUvSet=l;const a=n.availableUvSets[l];ve(n,a)}),o.appendChild(i),e.appendChild(o);const r=document.createElement("div");r.id="uv-info-container",r.className="debug-value",r.style.fontFamily="monospace",r.style.backgroundColor="rgba(0, 0, 0, 0.5)",r.style.padding="10px",r.style.borderRadius="5px",r.style.marginBottom="15px",r.style.color="#ddd",r.style.lineHeight="1.4",e.appendChild(r)}

	/**
 *
 */
	async function cn(n,e){return new Promise((t,o)=>{if(!e)return;const s=new rt,i=new FileReader;i.onload=function(r){const l=r.target.result;s.parse(l,"",a=>{n.modelObject=a.scene,n.scene.add(a.scene),dn(n),st(n);const c=Kt(n);pe&&pe(c),console.log("Model loaded successfully:",a),t(a)},void 0,a=>{console.error("Error loading model:",a),alert("Error loading the model file. Please try a different file."),Oe(n),o(a)})},i.readAsArrayBuffer(e)})}

	/**
 *
 */
	function dn(n){if(!n.modelObject)return;const e=new L.Box3().setFromObject(n.modelObject),t=e.getCenter(new L.Vector3),o=e.getSize(new L.Vector3);n.modelObject.position.x=-t.x,n.modelObject.position.y=-t.y,n.modelObject.position.z=-t.z;const s=Math.max(o.x,o.y,o.z),i=n.camera.fov*(Math.PI/180);let r=Math.abs(s/2/Math.tan(i/2));r*=1.5,n.camera.position.z=r,n.controls.target.set(0,0,0),n.controls.update()}

	/**
 *
 */
	function un(n){const e=document.getElementById("drop-container");if(!e){console.error("Drop container not found");return}const t=document.getElementById("drop-zone-model"),o=document.getElementById("drop-zone-texture");if(!t||!o){console.error("Drop zones not found");return}Ie(t,i=>{if(i.name.toLowerCase().endsWith(".glb")||i.name.toLowerCase().endsWith(".gltf")){n.modelFile=i;const r=document.getElementById("model-file-info");r&&(r.textContent=i.name),t.classList.add("has-file"),me(n)}else alert("Please drop a valid model file (GLB or GLTF)")}),Ie(o,i=>{const r=["jpg","jpeg","png","webp"],l=i.name.split(".").pop().toLowerCase();if(r.includes(l)){n.textureFile=i;const a=document.getElementById("texture-file-info");a&&(a.textContent=i.name),o.classList.add("has-file"),me(n)}else alert("Please drop a valid image file (JPG, PNG, WEBP)")});const s=document.getElementById("start-button");s&&s.addEventListener("click",()=>{pn(n)}),e.style.display="flex",console.log("Drag and drop initialized with the following elements:"),console.log("- dropContainer:",e),console.log("- modelDropZone:",t),console.log("- textureDropZone:",o),console.log("- startButton:",s)}

	/**
 *
 */
	function Ie(n,e){["dragenter","dragover","dragleave","drop"].forEach(t=>{n.addEventListener(t,hn,!1)}),["dragenter","dragover"].forEach(t=>{n.addEventListener(t,()=>{n.classList.add("active")})}),["dragleave","drop"].forEach(t=>{n.addEventListener(t,()=>{n.classList.remove("active")})}),n.addEventListener("drop",t=>{if(t.dataTransfer.files.length>0){const o=t.dataTransfer.files[0];e(o)}}),n.addEventListener("click",()=>{const t=document.createElement("input");t.type="file",n.id==="drop-zone-model"?t.accept=".glb,.gltf":n.id==="drop-zone-texture"&&(t.accept=".jpg,.jpeg,.png,.webp"),t.addEventListener("change",o=>{o.target.files.length>0&&e(o.target.files[0])}),t.click()})}

	/**
 *
 */
	function me(n){const e=document.getElementById("start-button");e&&(n.modelFile||n.textureFile?(e.disabled=!1,e.style.display="block"):(e.disabled=!0,e.style.display="none"))}

	/**
 *
 */
	function hn(n){n.preventDefault(),n.stopPropagation()}

	/**
 *
 */
	function Oe(n){const e=document.getElementById("loading");e&&(e.style.display="none"),n.renderer&&n.renderer.domElement&&(n.renderer.domElement.style.display="none");const t=document.getElementById("debug-panel");t&&(t.style.display="none"),n.isDebugMode=!1,n.modelLoaded=!1,n.textureLoaded=!1,n.modelFile=null,n.textureFile=null;const o=document.getElementById("drop-zone-model"),s=document.getElementById("drop-zone-texture");o&&o.classList.remove("has-file"),s&&s.classList.remove("has-file");const i=document.getElementById("model-file-info"),r=document.getElementById("texture-file-info");i&&(i.textContent=""),r&&(r.textContent=""),me(n);const l=document.getElementById("drop-container");l&&(l.style.display="flex")}

	/**
 *
 */
	async function pn(n){ee("Initializing..."),n.renderer||He(n),n.camera||ot(n);try{if(n.modelFile&&(console.log("Loading model:",n.modelFile.name),ee("Loading model..."),await cn(n,n.modelFile),n.modelLoaded=!0,console.log("Model loaded successfully")),n.textureFile)console.log("Loading texture:",n.textureFile.name),ee("Loading texture..."),await $t(n,n.textureFile),n.textureLoaded=!0,console.log("Texture loaded successfully");else if(n.modelLoaded){console.log("No texture provided, creating a sample texture."),ee("Creating sample texture...");const e=document.createElement("canvas");e.width=512,e.height=512;const t=e.getContext("2d"),o=64;for(let i=0;i<e.height;i+=o)for(let r=0;r<e.width;r+=o){const l=(r/o+i/o)%2===0;t.fillStyle=l?"#3498db":"#2980b9",t.fillRect(r,i,o,o),t.fillStyle="#ffffff",t.font="16px Arial",t.fillText(`${(r/e.width).toFixed(1)},${(i/e.height).toFixed(1)}`,r+10,i+30)}const s=new L.CanvasTexture(e);n.textureObject=s,n.textureFile={name:"sample_texture.png",size:e.width*e.height*4},n.updateTextureInfo&&n.updateTextureInfo({name:n.textureFile.name,size:n.textureFile.size,dimensions:{width:e.width,height:e.height}}),n.textureLoaded=!0,console.log("Sample texture created successfully")}if(n.modelLoaded||n.textureLoaded){const e=document.getElementById("drop-container");e&&(e.style.display="none"),rn(n),De()}}catch(e){console.error("Error handling file uploads:",e),De(),alert("Error processing files. Please try again."),Oe(n)}}

	/**
 *
 */
	function ee(n="Loading..."){const e=document.getElementById("loading"),t=e==null?void 0:e.querySelector("div:not(.spinner)");e&&(e.style.display="flex"),t&&(t.textContent=n)}

	/**
 *
 */
	function De(){const n=document.getElementById("loading");n&&(n.style.display="none")}

	/**
 *
 */
	function fn(n){window.addEventListener("resize",()=>mn(n)),window.addEventListener("keydown",e=>gn(e,n)),console.log("Event listeners initialized")}

	/**
 *
 */
	function mn(n){!n.camera||!n.renderer||(n.camera.aspect=window.innerWidth/window.innerHeight,n.camera.updateProjectionMatrix(),n.renderer.setSize(window.innerWidth,window.innerHeight))}

	/**
 *
 */
	function gn(n,e){n.key==="Escape"&&e.isDebugMode&&(typeof window.resetToDropZone=="function"?window.resetToDropZone(e):console.warn("resetToDropZone function not available")),(n.key==="r"||n.key==="R")&&e.camera&&e.controls&&(e.camera.position.set(0,0,5),e.controls.target.set(0,0,0),e.controls.update()),(n.key==="t"||n.key==="T")&&e.isDebugMode&&typeof window.toggleTextureEditor=="function"&&window.toggleTextureEditor(e)}

	const E={scene:null,camera:null,renderer:null,controls:null,modelFile:null,textureFile:null,modelObject:null,textureObject:null,modelInfo:null,additionalTextures:[],isDebugMode:!1,currentUvSet:0,multiTextureMode:!1,screenMeshes:[],availableUvSets:[],uvSetNames:[]};

	/**
 *
 */
	function te(){console.log("Asset Debugger Tool initialized"),Xe(E),on(E),un(E),fn(E);const n=document.getElementById("loading");n&&(n.style.display="none"),be(E),document.addEventListener("textureLoaded",()=>{E.textureObject&&E.modelObject&&Ce(E)}),document.addEventListener("modelLoaded",()=>{E.textureObject&&E.modelObject&&Ce(E)})}

	typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",te):te());const Ne=Object.freeze(Object.defineProperty({__proto__:null,init:te,state:E},Symbol.toStringTag,{value:"Module"})),yn={assetDebugger:{init:()=>Promise.resolve().then(()=>Ne).then(n=>n.init()),legacy:()=>Promise.resolve().then(()=>Ne)}},xn="1.0.0";R.VERSION=xn,R.createElement=qt,R.formatFileSize=Xt,R.getFileExtension=Yt,R.init=te,R.state=E,R.tools=yn,Object.defineProperty(R,Symbol.toStringTag,{value:"Module"})});
//# sourceMappingURL=index.umd.cjs.map
