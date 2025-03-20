/* BUILD TIMESTAMP: 2025-03-20T12:45:20.997Z */
var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _assetConfigs, _assetTypes, _instance, _disposed, _assetTypes2, _assetConfigs2, _instance2, _disposed2, _assetTypes3, _assetConfigs3;
import { TrianglesDrawMode, TriangleFanDrawMode, TriangleStripDrawMode, Loader, LoaderUtils, FileLoader, MeshPhysicalMaterial, Vector2, Color, LinearSRGBColorSpace, SRGBColorSpace, SpotLight, PointLight, DirectionalLight, Matrix4, Vector3, Quaternion, InstancedMesh, InstancedBufferAttribute, Object3D, TextureLoader, ImageBitmapLoader, BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, LinearMipmapLinearFilter, NearestMipmapLinearFilter, LinearMipmapNearestFilter, NearestMipmapNearestFilter, LinearFilter, NearestFilter, RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping, PointsMaterial, Material, LineBasicMaterial, MeshStandardMaterial, DoubleSide, MeshBasicMaterial, PropertyBinding, BufferGeometry, SkinnedMesh, Mesh, LineSegments, Line, LineLoop, Points, Group as Group$1, PerspectiveCamera, MathUtils, OrthographicCamera, Skeleton, AnimationClip, Bone, InterpolateDiscrete, InterpolateLinear, Texture, VectorKeyframeTrack, NumberKeyframeTrack, QuaternionKeyframeTrack, ColorManagement, FrontSide, Interpolant, Box3, Sphere, Float32BufferAttribute, ShaderMaterial, UniformsUtils, WebGLRenderTarget, HalfFloatType, NoBlending, Clock, RawShaderMaterial, SRGBTransfer, LinearToneMapping, ReinhardToneMapping, CineonToneMapping, ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, AdditiveBlending } from "three";
function clone(source) {
  const sourceLookup = /* @__PURE__ */ new Map();
  const cloneLookup = /* @__PURE__ */ new Map();
  const clone2 = source.clone();
  parallelTraverse(source, clone2, function(sourceNode, clonedNode) {
    sourceLookup.set(clonedNode, sourceNode);
    cloneLookup.set(sourceNode, clonedNode);
  });
  clone2.traverse(function(node) {
    if (!node.isSkinnedMesh) return;
    const clonedMesh = node;
    const sourceMesh = sourceLookup.get(node);
    const sourceBones = sourceMesh.skeleton.bones;
    clonedMesh.skeleton = sourceMesh.skeleton.clone();
    clonedMesh.bindMatrix.copy(sourceMesh.bindMatrix);
    clonedMesh.skeleton.bones = sourceBones.map(function(bone) {
      return cloneLookup.get(bone);
    });
    clonedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix);
  });
  return clone2;
}
function parallelTraverse(a, b, callback) {
  callback(a, b);
  for (let i = 0; i < a.children.length; i++) {
    parallelTraverse(a.children[i], b.children[i], callback);
  }
}
var Easing = Object.freeze({
  Linear: Object.freeze({
    None: function(amount) {
      return amount;
    },
    In: function(amount) {
      return this.None(amount);
    },
    Out: function(amount) {
      return this.None(amount);
    },
    InOut: function(amount) {
      return this.None(amount);
    }
  }),
  Quadratic: Object.freeze({
    In: function(amount) {
      return amount * amount;
    },
    Out: function(amount) {
      return amount * (2 - amount);
    },
    InOut: function(amount) {
      if ((amount *= 2) < 1) {
        return 0.5 * amount * amount;
      }
      return -0.5 * (--amount * (amount - 2) - 1);
    }
  }),
  Cubic: Object.freeze({
    In: function(amount) {
      return amount * amount * amount;
    },
    Out: function(amount) {
      return --amount * amount * amount + 1;
    },
    InOut: function(amount) {
      if ((amount *= 2) < 1) {
        return 0.5 * amount * amount * amount;
      }
      return 0.5 * ((amount -= 2) * amount * amount + 2);
    }
  }),
  Quartic: Object.freeze({
    In: function(amount) {
      return amount * amount * amount * amount;
    },
    Out: function(amount) {
      return 1 - --amount * amount * amount * amount;
    },
    InOut: function(amount) {
      if ((amount *= 2) < 1) {
        return 0.5 * amount * amount * amount * amount;
      }
      return -0.5 * ((amount -= 2) * amount * amount * amount - 2);
    }
  }),
  Quintic: Object.freeze({
    In: function(amount) {
      return amount * amount * amount * amount * amount;
    },
    Out: function(amount) {
      return --amount * amount * amount * amount * amount + 1;
    },
    InOut: function(amount) {
      if ((amount *= 2) < 1) {
        return 0.5 * amount * amount * amount * amount * amount;
      }
      return 0.5 * ((amount -= 2) * amount * amount * amount * amount + 2);
    }
  }),
  Sinusoidal: Object.freeze({
    In: function(amount) {
      return 1 - Math.sin((1 - amount) * Math.PI / 2);
    },
    Out: function(amount) {
      return Math.sin(amount * Math.PI / 2);
    },
    InOut: function(amount) {
      return 0.5 * (1 - Math.sin(Math.PI * (0.5 - amount)));
    }
  }),
  Exponential: Object.freeze({
    In: function(amount) {
      return amount === 0 ? 0 : Math.pow(1024, amount - 1);
    },
    Out: function(amount) {
      return amount === 1 ? 1 : 1 - Math.pow(2, -10 * amount);
    },
    InOut: function(amount) {
      if (amount === 0) {
        return 0;
      }
      if (amount === 1) {
        return 1;
      }
      if ((amount *= 2) < 1) {
        return 0.5 * Math.pow(1024, amount - 1);
      }
      return 0.5 * (-Math.pow(2, -10 * (amount - 1)) + 2);
    }
  }),
  Circular: Object.freeze({
    In: function(amount) {
      return 1 - Math.sqrt(1 - amount * amount);
    },
    Out: function(amount) {
      return Math.sqrt(1 - --amount * amount);
    },
    InOut: function(amount) {
      if ((amount *= 2) < 1) {
        return -0.5 * (Math.sqrt(1 - amount * amount) - 1);
      }
      return 0.5 * (Math.sqrt(1 - (amount -= 2) * amount) + 1);
    }
  }),
  Elastic: Object.freeze({
    In: function(amount) {
      if (amount === 0) {
        return 0;
      }
      if (amount === 1) {
        return 1;
      }
      return -Math.pow(2, 10 * (amount - 1)) * Math.sin((amount - 1.1) * 5 * Math.PI);
    },
    Out: function(amount) {
      if (amount === 0) {
        return 0;
      }
      if (amount === 1) {
        return 1;
      }
      return Math.pow(2, -10 * amount) * Math.sin((amount - 0.1) * 5 * Math.PI) + 1;
    },
    InOut: function(amount) {
      if (amount === 0) {
        return 0;
      }
      if (amount === 1) {
        return 1;
      }
      amount *= 2;
      if (amount < 1) {
        return -0.5 * Math.pow(2, 10 * (amount - 1)) * Math.sin((amount - 1.1) * 5 * Math.PI);
      }
      return 0.5 * Math.pow(2, -10 * (amount - 1)) * Math.sin((amount - 1.1) * 5 * Math.PI) + 1;
    }
  }),
  Back: Object.freeze({
    In: function(amount) {
      var s = 1.70158;
      return amount === 1 ? 1 : amount * amount * ((s + 1) * amount - s);
    },
    Out: function(amount) {
      var s = 1.70158;
      return amount === 0 ? 0 : --amount * amount * ((s + 1) * amount + s) + 1;
    },
    InOut: function(amount) {
      var s = 1.70158 * 1.525;
      if ((amount *= 2) < 1) {
        return 0.5 * (amount * amount * ((s + 1) * amount - s));
      }
      return 0.5 * ((amount -= 2) * amount * ((s + 1) * amount + s) + 2);
    }
  }),
  Bounce: Object.freeze({
    In: function(amount) {
      return 1 - Easing.Bounce.Out(1 - amount);
    },
    Out: function(amount) {
      if (amount < 1 / 2.75) {
        return 7.5625 * amount * amount;
      } else if (amount < 2 / 2.75) {
        return 7.5625 * (amount -= 1.5 / 2.75) * amount + 0.75;
      } else if (amount < 2.5 / 2.75) {
        return 7.5625 * (amount -= 2.25 / 2.75) * amount + 0.9375;
      } else {
        return 7.5625 * (amount -= 2.625 / 2.75) * amount + 0.984375;
      }
    },
    InOut: function(amount) {
      if (amount < 0.5) {
        return Easing.Bounce.In(amount * 2) * 0.5;
      }
      return Easing.Bounce.Out(amount * 2 - 1) * 0.5 + 0.5;
    }
  }),
  generatePow: function(power) {
    if (power === void 0) {
      power = 4;
    }
    power = power < Number.EPSILON ? Number.EPSILON : power;
    power = power > 1e4 ? 1e4 : power;
    return {
      In: function(amount) {
        return Math.pow(amount, power);
      },
      Out: function(amount) {
        return 1 - Math.pow(1 - amount, power);
      },
      InOut: function(amount) {
        if (amount < 0.5) {
          return Math.pow(amount * 2, power) / 2;
        }
        return (1 - Math.pow(2 - amount * 2, power)) / 2 + 0.5;
      }
    };
  }
});
var now = function() {
  return performance.now();
};
var Group = (
  /** @class */
  function() {
    function Group2() {
      this._tweens = {};
      this._tweensAddedDuringUpdate = {};
    }
    Group2.prototype.getAll = function() {
      var _this = this;
      return Object.keys(this._tweens).map(function(tweenId) {
        return _this._tweens[tweenId];
      });
    };
    Group2.prototype.removeAll = function() {
      this._tweens = {};
    };
    Group2.prototype.add = function(tween) {
      this._tweens[tween.getId()] = tween;
      this._tweensAddedDuringUpdate[tween.getId()] = tween;
    };
    Group2.prototype.remove = function(tween) {
      delete this._tweens[tween.getId()];
      delete this._tweensAddedDuringUpdate[tween.getId()];
    };
    Group2.prototype.update = function(time, preserve) {
      if (time === void 0) {
        time = now();
      }
      if (preserve === void 0) {
        preserve = false;
      }
      var tweenIds = Object.keys(this._tweens);
      if (tweenIds.length === 0) {
        return false;
      }
      while (tweenIds.length > 0) {
        this._tweensAddedDuringUpdate = {};
        for (var i = 0; i < tweenIds.length; i++) {
          var tween = this._tweens[tweenIds[i]];
          var autoStart = !preserve;
          if (tween && tween.update(time, autoStart) === false && !preserve) {
            delete this._tweens[tweenIds[i]];
          }
        }
        tweenIds = Object.keys(this._tweensAddedDuringUpdate);
      }
      return true;
    };
    return Group2;
  }()
);
var Interpolation = {
  Linear: function(v, k) {
    var m = v.length - 1;
    var f = m * k;
    var i = Math.floor(f);
    var fn = Interpolation.Utils.Linear;
    if (k < 0) {
      return fn(v[0], v[1], f);
    }
    if (k > 1) {
      return fn(v[m], v[m - 1], m - f);
    }
    return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);
  },
  Utils: {
    Linear: function(p0, p1, t) {
      return (p1 - p0) * t + p0;
    }
  }
};
var Sequence = (
  /** @class */
  function() {
    function Sequence2() {
    }
    Sequence2.nextId = function() {
      return Sequence2._nextId++;
    };
    Sequence2._nextId = 0;
    return Sequence2;
  }()
);
var mainGroup = new Group();
var Tween = (
  /** @class */
  function() {
    function Tween2(_object, _group) {
      if (_group === void 0) {
        _group = mainGroup;
      }
      this._object = _object;
      this._group = _group;
      this._isPaused = false;
      this._pauseStart = 0;
      this._valuesStart = {};
      this._valuesEnd = {};
      this._valuesStartRepeat = {};
      this._duration = 1e3;
      this._isDynamic = false;
      this._initialRepeat = 0;
      this._repeat = 0;
      this._yoyo = false;
      this._isPlaying = false;
      this._reversed = false;
      this._delayTime = 0;
      this._startTime = 0;
      this._easingFunction = Easing.Linear.None;
      this._interpolationFunction = Interpolation.Linear;
      this._chainedTweens = [];
      this._onStartCallbackFired = false;
      this._onEveryStartCallbackFired = false;
      this._id = Sequence.nextId();
      this._isChainStopped = false;
      this._propertiesAreSetUp = false;
      this._goToEnd = false;
    }
    Tween2.prototype.getId = function() {
      return this._id;
    };
    Tween2.prototype.isPlaying = function() {
      return this._isPlaying;
    };
    Tween2.prototype.isPaused = function() {
      return this._isPaused;
    };
    Tween2.prototype.getDuration = function() {
      return this._duration;
    };
    Tween2.prototype.to = function(target, duration) {
      if (duration === void 0) {
        duration = 1e3;
      }
      if (this._isPlaying)
        throw new Error("Can not call Tween.to() while Tween is already started or paused. Stop the Tween first.");
      this._valuesEnd = target;
      this._propertiesAreSetUp = false;
      this._duration = duration < 0 ? 0 : duration;
      return this;
    };
    Tween2.prototype.duration = function(duration) {
      if (duration === void 0) {
        duration = 1e3;
      }
      this._duration = duration < 0 ? 0 : duration;
      return this;
    };
    Tween2.prototype.dynamic = function(dynamic) {
      if (dynamic === void 0) {
        dynamic = false;
      }
      this._isDynamic = dynamic;
      return this;
    };
    Tween2.prototype.start = function(time, overrideStartingValues) {
      if (time === void 0) {
        time = now();
      }
      if (overrideStartingValues === void 0) {
        overrideStartingValues = false;
      }
      if (this._isPlaying) {
        return this;
      }
      this._group && this._group.add(this);
      this._repeat = this._initialRepeat;
      if (this._reversed) {
        this._reversed = false;
        for (var property in this._valuesStartRepeat) {
          this._swapEndStartRepeatValues(property);
          this._valuesStart[property] = this._valuesStartRepeat[property];
        }
      }
      this._isPlaying = true;
      this._isPaused = false;
      this._onStartCallbackFired = false;
      this._onEveryStartCallbackFired = false;
      this._isChainStopped = false;
      this._startTime = time;
      this._startTime += this._delayTime;
      if (!this._propertiesAreSetUp || overrideStartingValues) {
        this._propertiesAreSetUp = true;
        if (!this._isDynamic) {
          var tmp = {};
          for (var prop in this._valuesEnd)
            tmp[prop] = this._valuesEnd[prop];
          this._valuesEnd = tmp;
        }
        this._setupProperties(this._object, this._valuesStart, this._valuesEnd, this._valuesStartRepeat, overrideStartingValues);
      }
      return this;
    };
    Tween2.prototype.startFromCurrentValues = function(time) {
      return this.start(time, true);
    };
    Tween2.prototype._setupProperties = function(_object, _valuesStart, _valuesEnd, _valuesStartRepeat, overrideStartingValues) {
      for (var property in _valuesEnd) {
        var startValue = _object[property];
        var startValueIsArray = Array.isArray(startValue);
        var propType = startValueIsArray ? "array" : typeof startValue;
        var isInterpolationList = !startValueIsArray && Array.isArray(_valuesEnd[property]);
        if (propType === "undefined" || propType === "function") {
          continue;
        }
        if (isInterpolationList) {
          var endValues = _valuesEnd[property];
          if (endValues.length === 0) {
            continue;
          }
          var temp = [startValue];
          for (var i = 0, l = endValues.length; i < l; i += 1) {
            var value = this._handleRelativeValue(startValue, endValues[i]);
            if (isNaN(value)) {
              isInterpolationList = false;
              console.warn("Found invalid interpolation list. Skipping.");
              break;
            }
            temp.push(value);
          }
          if (isInterpolationList) {
            _valuesEnd[property] = temp;
          }
        }
        if ((propType === "object" || startValueIsArray) && startValue && !isInterpolationList) {
          _valuesStart[property] = startValueIsArray ? [] : {};
          var nestedObject = startValue;
          for (var prop in nestedObject) {
            _valuesStart[property][prop] = nestedObject[prop];
          }
          _valuesStartRepeat[property] = startValueIsArray ? [] : {};
          var endValues = _valuesEnd[property];
          if (!this._isDynamic) {
            var tmp = {};
            for (var prop in endValues)
              tmp[prop] = endValues[prop];
            _valuesEnd[property] = endValues = tmp;
          }
          this._setupProperties(nestedObject, _valuesStart[property], endValues, _valuesStartRepeat[property], overrideStartingValues);
        } else {
          if (typeof _valuesStart[property] === "undefined" || overrideStartingValues) {
            _valuesStart[property] = startValue;
          }
          if (!startValueIsArray) {
            _valuesStart[property] *= 1;
          }
          if (isInterpolationList) {
            _valuesStartRepeat[property] = _valuesEnd[property].slice().reverse();
          } else {
            _valuesStartRepeat[property] = _valuesStart[property] || 0;
          }
        }
      }
    };
    Tween2.prototype.stop = function() {
      if (!this._isChainStopped) {
        this._isChainStopped = true;
        this.stopChainedTweens();
      }
      if (!this._isPlaying) {
        return this;
      }
      this._group && this._group.remove(this);
      this._isPlaying = false;
      this._isPaused = false;
      if (this._onStopCallback) {
        this._onStopCallback(this._object);
      }
      return this;
    };
    Tween2.prototype.end = function() {
      this._goToEnd = true;
      this.update(Infinity);
      return this;
    };
    Tween2.prototype.pause = function(time) {
      if (time === void 0) {
        time = now();
      }
      if (this._isPaused || !this._isPlaying) {
        return this;
      }
      this._isPaused = true;
      this._pauseStart = time;
      this._group && this._group.remove(this);
      return this;
    };
    Tween2.prototype.resume = function(time) {
      if (time === void 0) {
        time = now();
      }
      if (!this._isPaused || !this._isPlaying) {
        return this;
      }
      this._isPaused = false;
      this._startTime += time - this._pauseStart;
      this._pauseStart = 0;
      this._group && this._group.add(this);
      return this;
    };
    Tween2.prototype.stopChainedTweens = function() {
      for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
        this._chainedTweens[i].stop();
      }
      return this;
    };
    Tween2.prototype.group = function(group) {
      if (group === void 0) {
        group = mainGroup;
      }
      this._group = group;
      return this;
    };
    Tween2.prototype.delay = function(amount) {
      if (amount === void 0) {
        amount = 0;
      }
      this._delayTime = amount;
      return this;
    };
    Tween2.prototype.repeat = function(times) {
      if (times === void 0) {
        times = 0;
      }
      this._initialRepeat = times;
      this._repeat = times;
      return this;
    };
    Tween2.prototype.repeatDelay = function(amount) {
      this._repeatDelayTime = amount;
      return this;
    };
    Tween2.prototype.yoyo = function(yoyo) {
      if (yoyo === void 0) {
        yoyo = false;
      }
      this._yoyo = yoyo;
      return this;
    };
    Tween2.prototype.easing = function(easingFunction) {
      if (easingFunction === void 0) {
        easingFunction = Easing.Linear.None;
      }
      this._easingFunction = easingFunction;
      return this;
    };
    Tween2.prototype.interpolation = function(interpolationFunction) {
      if (interpolationFunction === void 0) {
        interpolationFunction = Interpolation.Linear;
      }
      this._interpolationFunction = interpolationFunction;
      return this;
    };
    Tween2.prototype.chain = function() {
      var tweens = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        tweens[_i] = arguments[_i];
      }
      this._chainedTweens = tweens;
      return this;
    };
    Tween2.prototype.onStart = function(callback) {
      this._onStartCallback = callback;
      return this;
    };
    Tween2.prototype.onEveryStart = function(callback) {
      this._onEveryStartCallback = callback;
      return this;
    };
    Tween2.prototype.onUpdate = function(callback) {
      this._onUpdateCallback = callback;
      return this;
    };
    Tween2.prototype.onRepeat = function(callback) {
      this._onRepeatCallback = callback;
      return this;
    };
    Tween2.prototype.onComplete = function(callback) {
      this._onCompleteCallback = callback;
      return this;
    };
    Tween2.prototype.onStop = function(callback) {
      this._onStopCallback = callback;
      return this;
    };
    Tween2.prototype.update = function(time, autoStart) {
      var _this = this;
      var _a2;
      if (time === void 0) {
        time = now();
      }
      if (autoStart === void 0) {
        autoStart = true;
      }
      if (this._isPaused)
        return true;
      var property;
      var endTime = this._startTime + this._duration;
      if (!this._goToEnd && !this._isPlaying) {
        if (time > endTime)
          return false;
        if (autoStart)
          this.start(time, true);
      }
      this._goToEnd = false;
      if (time < this._startTime) {
        return true;
      }
      if (this._onStartCallbackFired === false) {
        if (this._onStartCallback) {
          this._onStartCallback(this._object);
        }
        this._onStartCallbackFired = true;
      }
      if (this._onEveryStartCallbackFired === false) {
        if (this._onEveryStartCallback) {
          this._onEveryStartCallback(this._object);
        }
        this._onEveryStartCallbackFired = true;
      }
      var elapsedTime = time - this._startTime;
      var durationAndDelay = this._duration + ((_a2 = this._repeatDelayTime) !== null && _a2 !== void 0 ? _a2 : this._delayTime);
      var totalTime = this._duration + this._repeat * durationAndDelay;
      var calculateElapsedPortion = function() {
        if (_this._duration === 0)
          return 1;
        if (elapsedTime > totalTime) {
          return 1;
        }
        var timesRepeated = Math.trunc(elapsedTime / durationAndDelay);
        var timeIntoCurrentRepeat = elapsedTime - timesRepeated * durationAndDelay;
        var portion = Math.min(timeIntoCurrentRepeat / _this._duration, 1);
        if (portion === 0 && elapsedTime === _this._duration) {
          return 1;
        }
        return portion;
      };
      var elapsed = calculateElapsedPortion();
      var value = this._easingFunction(elapsed);
      this._updateProperties(this._object, this._valuesStart, this._valuesEnd, value);
      if (this._onUpdateCallback) {
        this._onUpdateCallback(this._object, elapsed);
      }
      if (this._duration === 0 || elapsedTime >= this._duration) {
        if (this._repeat > 0) {
          var completeCount = Math.min(Math.trunc((elapsedTime - this._duration) / durationAndDelay) + 1, this._repeat);
          if (isFinite(this._repeat)) {
            this._repeat -= completeCount;
          }
          for (property in this._valuesStartRepeat) {
            if (!this._yoyo && typeof this._valuesEnd[property] === "string") {
              this._valuesStartRepeat[property] = // eslint-disable-next-line
              // @ts-ignore FIXME?
              this._valuesStartRepeat[property] + parseFloat(this._valuesEnd[property]);
            }
            if (this._yoyo) {
              this._swapEndStartRepeatValues(property);
            }
            this._valuesStart[property] = this._valuesStartRepeat[property];
          }
          if (this._yoyo) {
            this._reversed = !this._reversed;
          }
          this._startTime += durationAndDelay * completeCount;
          if (this._onRepeatCallback) {
            this._onRepeatCallback(this._object);
          }
          this._onEveryStartCallbackFired = false;
          return true;
        } else {
          if (this._onCompleteCallback) {
            this._onCompleteCallback(this._object);
          }
          for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
            this._chainedTweens[i].start(this._startTime + this._duration, false);
          }
          this._isPlaying = false;
          return false;
        }
      }
      return true;
    };
    Tween2.prototype._updateProperties = function(_object, _valuesStart, _valuesEnd, value) {
      for (var property in _valuesEnd) {
        if (_valuesStart[property] === void 0) {
          continue;
        }
        var start = _valuesStart[property] || 0;
        var end = _valuesEnd[property];
        var startIsArray = Array.isArray(_object[property]);
        var endIsArray = Array.isArray(end);
        var isInterpolationList = !startIsArray && endIsArray;
        if (isInterpolationList) {
          _object[property] = this._interpolationFunction(end, value);
        } else if (typeof end === "object" && end) {
          this._updateProperties(_object[property], start, end, value);
        } else {
          end = this._handleRelativeValue(start, end);
          if (typeof end === "number") {
            _object[property] = start + (end - start) * value;
          }
        }
      }
    };
    Tween2.prototype._handleRelativeValue = function(start, end) {
      if (typeof end !== "string") {
        return end;
      }
      if (end.charAt(0) === "+" || end.charAt(0) === "-") {
        return start + parseFloat(end);
      }
      return parseFloat(end);
    };
    Tween2.prototype._swapEndStartRepeatValues = function(property) {
      var tmp = this._valuesStartRepeat[property];
      var endValue = this._valuesEnd[property];
      if (typeof endValue === "string") {
        this._valuesStartRepeat[property] = this._valuesStartRepeat[property] + parseFloat(endValue);
      } else {
        this._valuesStartRepeat[property] = this._valuesEnd[property];
      }
      this._valuesEnd[property] = tmp;
    };
    return Tween2;
  }()
);
Sequence.nextId;
var TWEEN = mainGroup;
TWEEN.getAll.bind(TWEEN);
TWEEN.removeAll.bind(TWEEN);
TWEEN.add.bind(TWEEN);
TWEEN.remove.bind(TWEEN);
var update = TWEEN.update.bind(TWEEN);
let loadedTHREE = null;
let loadedRAPER = null;
let rapierInitialized = false;
async function load_three() {
  if (!loadedTHREE) {
    const threeModule2 = await import("three");
    loadedTHREE = {
      THREE: threeModule2
    };
  }
  return loadedTHREE;
}
async function load_rapier() {
  if (!loadedRAPER) {
    const RAPIER2 = await import("./rapier.es-CcZf2jie.js");
    loadedRAPER = RAPIER2;
  }
  return loadedRAPER;
}
async function ensure_rapier_initialized() {
  const RAPIER2 = await load_rapier();
  if (!rapierInitialized) {
    await RAPIER2.init();
    rapierInitialized = true;
  }
  return RAPIER2;
}
let rapierModule = null;
let isInitialized$2 = false;
let initPromise$1 = null;
function createRapierProxy() {
  return new Proxy({
    // Special method to initialize the module
    init: async function() {
      if (initPromise$1) return initPromise$1;
      initPromise$1 = (async () => {
        const module = await ensure_rapier_initialized();
        rapierModule = module;
        isInitialized$2 = true;
        return module;
      })();
      return initPromise$1;
    }
  }, {
    // Handle property access
    get(target, prop) {
      if (prop === "init") {
        return target.init;
      }
      if (!isInitialized$2) {
        if (typeof prop === "symbol" || prop === "then" || prop === "catch") {
          return void 0;
        }
        throw new Error(`RAPIER.${String(prop)} cannot be accessed before initialization. Call initRapier() first.`);
      }
      return rapierModule[prop];
    }
  });
}
let threeModule = null;
let isInitialized$1 = false;
let initPromise = null;
function createThreeProxy() {
  return new Proxy({
    // Special method to initialize the module
    init: async function() {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        const module = await load_three();
        threeModule = module.THREE;
        isInitialized$1 = true;
        return threeModule;
      })();
      return initPromise;
    }
  }, {
    // Handle property access
    get(target, prop) {
      if (prop === "init") {
        return target.init;
      }
      if (!isInitialized$1) {
        if (typeof prop === "symbol" || prop === "then" || prop === "catch") {
          return void 0;
        }
        throw new Error(`THREE.${String(prop)} cannot be accessed before initialization. Call initThree() first.`);
      }
      return threeModule[prop];
    }
  });
}
function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === TrianglesDrawMode) {
    console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.");
    return geometry;
  }
  if (drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode) {
    let index = geometry.getIndex();
    if (index === null) {
      const indices = [];
      const position = geometry.getAttribute("position");
      if (position !== void 0) {
        for (let i = 0; i < position.count; i++) {
          indices.push(i);
        }
        geometry.setIndex(indices);
        index = geometry.getIndex();
      } else {
        console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.");
        return geometry;
      }
    }
    const numberOfTriangles = index.count - 2;
    const newIndices = [];
    if (drawMode === TriangleFanDrawMode) {
      for (let i = 1; i <= numberOfTriangles; i++) {
        newIndices.push(index.getX(0));
        newIndices.push(index.getX(i));
        newIndices.push(index.getX(i + 1));
      }
    } else {
      for (let i = 0; i < numberOfTriangles; i++) {
        if (i % 2 === 0) {
          newIndices.push(index.getX(i));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i + 2));
        } else {
          newIndices.push(index.getX(i + 2));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i));
        }
      }
    }
    if (newIndices.length / 3 !== numberOfTriangles) {
      console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");
    }
    const newGeometry = geometry.clone();
    newGeometry.setIndex(newIndices);
    newGeometry.clearGroups();
    return newGeometry;
  } else {
    console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:", drawMode);
    return geometry;
  }
}
class GLTFLoader extends Loader {
  constructor(manager) {
    super(manager);
    this.dracoLoader = null;
    this.ktx2Loader = null;
    this.meshoptDecoder = null;
    this.pluginCallbacks = [];
    this.register(function(parser) {
      return new GLTFMaterialsClearcoatExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsDispersionExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFTextureBasisUExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFTextureWebPExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFTextureAVIFExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsSheenExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsTransmissionExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsVolumeExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsIorExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsEmissiveStrengthExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsSpecularExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsIridescenceExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsAnisotropyExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsBumpExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFLightsExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMeshoptCompression(parser);
    });
    this.register(function(parser) {
      return new GLTFMeshGpuInstancing(parser);
    });
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    let resourcePath;
    if (this.resourcePath !== "") {
      resourcePath = this.resourcePath;
    } else if (this.path !== "") {
      const relativeUrl = LoaderUtils.extractUrlBase(url);
      resourcePath = LoaderUtils.resolveURL(relativeUrl, this.path);
    } else {
      resourcePath = LoaderUtils.extractUrlBase(url);
    }
    this.manager.itemStart(url);
    const _onError = function(e) {
      if (onError) {
        onError(e);
      } else {
        console.error(e);
      }
      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    };
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(url, function(data) {
      try {
        scope.parse(data, resourcePath, function(gltf) {
          onLoad(gltf);
          scope.manager.itemEnd(url);
        }, _onError);
      } catch (e) {
        _onError(e);
      }
    }, onProgress, _onError);
  }
  setDRACOLoader(dracoLoader) {
    this.dracoLoader = dracoLoader;
    return this;
  }
  setKTX2Loader(ktx2Loader) {
    this.ktx2Loader = ktx2Loader;
    return this;
  }
  setMeshoptDecoder(meshoptDecoder) {
    this.meshoptDecoder = meshoptDecoder;
    return this;
  }
  register(callback) {
    if (this.pluginCallbacks.indexOf(callback) === -1) {
      this.pluginCallbacks.push(callback);
    }
    return this;
  }
  unregister(callback) {
    if (this.pluginCallbacks.indexOf(callback) !== -1) {
      this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(callback), 1);
    }
    return this;
  }
  parse(data, path, onLoad, onError) {
    let json;
    const extensions = {};
    const plugins = {};
    const textDecoder = new TextDecoder();
    if (typeof data === "string") {
      json = JSON.parse(data);
    } else if (data instanceof ArrayBuffer) {
      const magic = textDecoder.decode(new Uint8Array(data, 0, 4));
      if (magic === BINARY_EXTENSION_HEADER_MAGIC) {
        try {
          extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data);
        } catch (error) {
          if (onError) onError(error);
          return;
        }
        json = JSON.parse(extensions[EXTENSIONS.KHR_BINARY_GLTF].content);
      } else {
        json = JSON.parse(textDecoder.decode(data));
      }
    } else {
      json = data;
    }
    if (json.asset === void 0 || json.asset.version[0] < 2) {
      if (onError) onError(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));
      return;
    }
    const parser = new GLTFParser(json, {
      path: path || this.resourcePath || "",
      crossOrigin: this.crossOrigin,
      requestHeader: this.requestHeader,
      manager: this.manager,
      ktx2Loader: this.ktx2Loader,
      meshoptDecoder: this.meshoptDecoder
    });
    parser.fileLoader.setRequestHeader(this.requestHeader);
    for (let i = 0; i < this.pluginCallbacks.length; i++) {
      const plugin = this.pluginCallbacks[i](parser);
      if (!plugin.name) console.error("THREE.GLTFLoader: Invalid plugin found: missing name");
      plugins[plugin.name] = plugin;
      extensions[plugin.name] = true;
    }
    if (json.extensionsUsed) {
      for (let i = 0; i < json.extensionsUsed.length; ++i) {
        const extensionName = json.extensionsUsed[i];
        const extensionsRequired = json.extensionsRequired || [];
        switch (extensionName) {
          case EXTENSIONS.KHR_MATERIALS_UNLIT:
            extensions[extensionName] = new GLTFMaterialsUnlitExtension();
            break;
          case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
            extensions[extensionName] = new GLTFDracoMeshCompressionExtension(json, this.dracoLoader);
            break;
          case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
            extensions[extensionName] = new GLTFTextureTransformExtension();
            break;
          case EXTENSIONS.KHR_MESH_QUANTIZATION:
            extensions[extensionName] = new GLTFMeshQuantizationExtension();
            break;
          default:
            if (extensionsRequired.indexOf(extensionName) >= 0 && plugins[extensionName] === void 0) {
              console.warn('THREE.GLTFLoader: Unknown extension "' + extensionName + '".');
            }
        }
      }
    }
    parser.setExtensions(extensions);
    parser.setPlugins(plugins);
    parser.parse(onLoad, onError);
  }
  parseAsync(data, path) {
    const scope = this;
    return new Promise(function(resolve, reject) {
      scope.parse(data, path, resolve, reject);
    });
  }
}
function GLTFRegistry() {
  let objects = {};
  return {
    get: function(key) {
      return objects[key];
    },
    add: function(key, object) {
      objects[key] = object;
    },
    remove: function(key) {
      delete objects[key];
    },
    removeAll: function() {
      objects = {};
    }
  };
}
const EXTENSIONS = {
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
class GLTFLightsExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;
    this.cache = { refs: {}, uses: {} };
  }
  _markDefs() {
    const parser = this.parser;
    const nodeDefs = this.parser.json.nodes || [];
    for (let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
      const nodeDef = nodeDefs[nodeIndex];
      if (nodeDef.extensions && nodeDef.extensions[this.name] && nodeDef.extensions[this.name].light !== void 0) {
        parser._addNodeRef(this.cache, nodeDef.extensions[this.name].light);
      }
    }
  }
  _loadLight(lightIndex) {
    const parser = this.parser;
    const cacheKey = "light:" + lightIndex;
    let dependency = parser.cache.get(cacheKey);
    if (dependency) return dependency;
    const json = parser.json;
    const extensions = json.extensions && json.extensions[this.name] || {};
    const lightDefs = extensions.lights || [];
    const lightDef = lightDefs[lightIndex];
    let lightNode;
    const color = new Color(16777215);
    if (lightDef.color !== void 0) color.setRGB(lightDef.color[0], lightDef.color[1], lightDef.color[2], LinearSRGBColorSpace);
    const range = lightDef.range !== void 0 ? lightDef.range : 0;
    switch (lightDef.type) {
      case "directional":
        lightNode = new DirectionalLight(color);
        lightNode.target.position.set(0, 0, -1);
        lightNode.add(lightNode.target);
        break;
      case "point":
        lightNode = new PointLight(color);
        lightNode.distance = range;
        break;
      case "spot":
        lightNode = new SpotLight(color);
        lightNode.distance = range;
        lightDef.spot = lightDef.spot || {};
        lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== void 0 ? lightDef.spot.innerConeAngle : 0;
        lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== void 0 ? lightDef.spot.outerConeAngle : Math.PI / 4;
        lightNode.angle = lightDef.spot.outerConeAngle;
        lightNode.penumbra = 1 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
        lightNode.target.position.set(0, 0, -1);
        lightNode.add(lightNode.target);
        break;
      default:
        throw new Error("THREE.GLTFLoader: Unexpected light type: " + lightDef.type);
    }
    lightNode.position.set(0, 0, 0);
    lightNode.decay = 2;
    assignExtrasToUserData(lightNode, lightDef);
    if (lightDef.intensity !== void 0) lightNode.intensity = lightDef.intensity;
    lightNode.name = parser.createUniqueName(lightDef.name || "light_" + lightIndex);
    dependency = Promise.resolve(lightNode);
    parser.cache.add(cacheKey, dependency);
    return dependency;
  }
  getDependency(type, index) {
    if (type !== "light") return;
    return this._loadLight(index);
  }
  createNodeAttachment(nodeIndex) {
    const self2 = this;
    const parser = this.parser;
    const json = parser.json;
    const nodeDef = json.nodes[nodeIndex];
    const lightDef = nodeDef.extensions && nodeDef.extensions[this.name] || {};
    const lightIndex = lightDef.light;
    if (lightIndex === void 0) return null;
    return this._loadLight(lightIndex).then(function(light) {
      return parser._getNodeRef(self2.cache, lightIndex, light);
    });
  }
}
class GLTFMaterialsUnlitExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;
  }
  getMaterialType() {
    return MeshBasicMaterial;
  }
  extendParams(materialParams, materialDef, parser) {
    const pending = [];
    materialParams.color = new Color(1, 1, 1);
    materialParams.opacity = 1;
    const metallicRoughness = materialDef.pbrMetallicRoughness;
    if (metallicRoughness) {
      if (Array.isArray(metallicRoughness.baseColorFactor)) {
        const array = metallicRoughness.baseColorFactor;
        materialParams.color.setRGB(array[0], array[1], array[2], LinearSRGBColorSpace);
        materialParams.opacity = array[3];
      }
      if (metallicRoughness.baseColorTexture !== void 0) {
        pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture, SRGBColorSpace));
      }
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsEmissiveStrengthExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_EMISSIVE_STRENGTH;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const emissiveStrength = materialDef.extensions[this.name].emissiveStrength;
    if (emissiveStrength !== void 0) {
      materialParams.emissiveIntensity = emissiveStrength;
    }
    return Promise.resolve();
  }
}
class GLTFMaterialsClearcoatExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.clearcoatFactor !== void 0) {
      materialParams.clearcoat = extension.clearcoatFactor;
    }
    if (extension.clearcoatTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "clearcoatMap", extension.clearcoatTexture));
    }
    if (extension.clearcoatRoughnessFactor !== void 0) {
      materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor;
    }
    if (extension.clearcoatRoughnessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "clearcoatRoughnessMap", extension.clearcoatRoughnessTexture));
    }
    if (extension.clearcoatNormalTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "clearcoatNormalMap", extension.clearcoatNormalTexture));
      if (extension.clearcoatNormalTexture.scale !== void 0) {
        const scale = extension.clearcoatNormalTexture.scale;
        materialParams.clearcoatNormalScale = new Vector2(scale, scale);
      }
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsDispersionExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_DISPERSION;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const extension = materialDef.extensions[this.name];
    materialParams.dispersion = extension.dispersion !== void 0 ? extension.dispersion : 0;
    return Promise.resolve();
  }
}
class GLTFMaterialsIridescenceExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_IRIDESCENCE;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.iridescenceFactor !== void 0) {
      materialParams.iridescence = extension.iridescenceFactor;
    }
    if (extension.iridescenceTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "iridescenceMap", extension.iridescenceTexture));
    }
    if (extension.iridescenceIor !== void 0) {
      materialParams.iridescenceIOR = extension.iridescenceIor;
    }
    if (materialParams.iridescenceThicknessRange === void 0) {
      materialParams.iridescenceThicknessRange = [100, 400];
    }
    if (extension.iridescenceThicknessMinimum !== void 0) {
      materialParams.iridescenceThicknessRange[0] = extension.iridescenceThicknessMinimum;
    }
    if (extension.iridescenceThicknessMaximum !== void 0) {
      materialParams.iridescenceThicknessRange[1] = extension.iridescenceThicknessMaximum;
    }
    if (extension.iridescenceThicknessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "iridescenceThicknessMap", extension.iridescenceThicknessTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsSheenExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_SHEEN;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    materialParams.sheenColor = new Color(0, 0, 0);
    materialParams.sheenRoughness = 0;
    materialParams.sheen = 1;
    const extension = materialDef.extensions[this.name];
    if (extension.sheenColorFactor !== void 0) {
      const colorFactor = extension.sheenColorFactor;
      materialParams.sheenColor.setRGB(colorFactor[0], colorFactor[1], colorFactor[2], LinearSRGBColorSpace);
    }
    if (extension.sheenRoughnessFactor !== void 0) {
      materialParams.sheenRoughness = extension.sheenRoughnessFactor;
    }
    if (extension.sheenColorTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "sheenColorMap", extension.sheenColorTexture, SRGBColorSpace));
    }
    if (extension.sheenRoughnessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "sheenRoughnessMap", extension.sheenRoughnessTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsTransmissionExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.transmissionFactor !== void 0) {
      materialParams.transmission = extension.transmissionFactor;
    }
    if (extension.transmissionTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "transmissionMap", extension.transmissionTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsVolumeExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_VOLUME;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    materialParams.thickness = extension.thicknessFactor !== void 0 ? extension.thicknessFactor : 0;
    if (extension.thicknessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "thicknessMap", extension.thicknessTexture));
    }
    materialParams.attenuationDistance = extension.attenuationDistance || Infinity;
    const colorArray = extension.attenuationColor || [1, 1, 1];
    materialParams.attenuationColor = new Color().setRGB(colorArray[0], colorArray[1], colorArray[2], LinearSRGBColorSpace);
    return Promise.all(pending);
  }
}
class GLTFMaterialsIorExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_IOR;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const extension = materialDef.extensions[this.name];
    materialParams.ior = extension.ior !== void 0 ? extension.ior : 1.5;
    return Promise.resolve();
  }
}
class GLTFMaterialsSpecularExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_SPECULAR;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    materialParams.specularIntensity = extension.specularFactor !== void 0 ? extension.specularFactor : 1;
    if (extension.specularTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "specularIntensityMap", extension.specularTexture));
    }
    const colorArray = extension.specularColorFactor || [1, 1, 1];
    materialParams.specularColor = new Color().setRGB(colorArray[0], colorArray[1], colorArray[2], LinearSRGBColorSpace);
    if (extension.specularColorTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "specularColorMap", extension.specularColorTexture, SRGBColorSpace));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsBumpExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_MATERIALS_BUMP;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    materialParams.bumpScale = extension.bumpFactor !== void 0 ? extension.bumpFactor : 1;
    if (extension.bumpTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "bumpMap", extension.bumpTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsAnisotropyExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_ANISOTROPY;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.anisotropyStrength !== void 0) {
      materialParams.anisotropy = extension.anisotropyStrength;
    }
    if (extension.anisotropyRotation !== void 0) {
      materialParams.anisotropyRotation = extension.anisotropyRotation;
    }
    if (extension.anisotropyTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "anisotropyMap", extension.anisotropyTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFTextureBasisUExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_TEXTURE_BASISU;
  }
  loadTexture(textureIndex) {
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[this.name]) {
      return null;
    }
    const extension = textureDef.extensions[this.name];
    const loader = parser.options.ktx2Loader;
    if (!loader) {
      if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) {
        throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");
      } else {
        return null;
      }
    }
    return parser.loadTextureImage(textureIndex, extension.source, loader);
  }
}
class GLTFTextureWebPExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
    this.isSupported = null;
  }
  loadTexture(textureIndex) {
    const name = this.name;
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[name]) {
      return null;
    }
    const extension = textureDef.extensions[name];
    const source = json.images[extension.source];
    let loader = parser.textureLoader;
    if (source.uri) {
      const handler = parser.options.manager.getHandler(source.uri);
      if (handler !== null) loader = handler;
    }
    return this.detectSupport().then(function(isSupported) {
      if (isSupported) return parser.loadTextureImage(textureIndex, extension.source, loader);
      if (json.extensionsRequired && json.extensionsRequired.indexOf(name) >= 0) {
        throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");
      }
      return parser.loadTexture(textureIndex);
    });
  }
  detectSupport() {
    if (!this.isSupported) {
      this.isSupported = new Promise(function(resolve) {
        const image = new Image();
        image.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
        image.onload = image.onerror = function() {
          resolve(image.height === 1);
        };
      });
    }
    return this.isSupported;
  }
}
class GLTFTextureAVIFExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_TEXTURE_AVIF;
    this.isSupported = null;
  }
  loadTexture(textureIndex) {
    const name = this.name;
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[name]) {
      return null;
    }
    const extension = textureDef.extensions[name];
    const source = json.images[extension.source];
    let loader = parser.textureLoader;
    if (source.uri) {
      const handler = parser.options.manager.getHandler(source.uri);
      if (handler !== null) loader = handler;
    }
    return this.detectSupport().then(function(isSupported) {
      if (isSupported) return parser.loadTextureImage(textureIndex, extension.source, loader);
      if (json.extensionsRequired && json.extensionsRequired.indexOf(name) >= 0) {
        throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");
      }
      return parser.loadTexture(textureIndex);
    });
  }
  detectSupport() {
    if (!this.isSupported) {
      this.isSupported = new Promise(function(resolve) {
        const image = new Image();
        image.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=";
        image.onload = image.onerror = function() {
          resolve(image.height === 1);
        };
      });
    }
    return this.isSupported;
  }
}
class GLTFMeshoptCompression {
  constructor(parser) {
    this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION;
    this.parser = parser;
  }
  loadBufferView(index) {
    const json = this.parser.json;
    const bufferView = json.bufferViews[index];
    if (bufferView.extensions && bufferView.extensions[this.name]) {
      const extensionDef = bufferView.extensions[this.name];
      const buffer = this.parser.getDependency("buffer", extensionDef.buffer);
      const decoder = this.parser.options.meshoptDecoder;
      if (!decoder || !decoder.supported) {
        if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) {
          throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");
        } else {
          return null;
        }
      }
      return buffer.then(function(res) {
        const byteOffset = extensionDef.byteOffset || 0;
        const byteLength = extensionDef.byteLength || 0;
        const count = extensionDef.count;
        const stride = extensionDef.byteStride;
        const source = new Uint8Array(res, byteOffset, byteLength);
        if (decoder.decodeGltfBufferAsync) {
          return decoder.decodeGltfBufferAsync(count, stride, source, extensionDef.mode, extensionDef.filter).then(function(res2) {
            return res2.buffer;
          });
        } else {
          return decoder.ready.then(function() {
            const result = new ArrayBuffer(count * stride);
            decoder.decodeGltfBuffer(new Uint8Array(result), count, stride, source, extensionDef.mode, extensionDef.filter);
            return result;
          });
        }
      });
    } else {
      return null;
    }
  }
}
class GLTFMeshGpuInstancing {
  constructor(parser) {
    this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING;
    this.parser = parser;
  }
  createNodeMesh(nodeIndex) {
    const json = this.parser.json;
    const nodeDef = json.nodes[nodeIndex];
    if (!nodeDef.extensions || !nodeDef.extensions[this.name] || nodeDef.mesh === void 0) {
      return null;
    }
    const meshDef = json.meshes[nodeDef.mesh];
    for (const primitive of meshDef.primitives) {
      if (primitive.mode !== WEBGL_CONSTANTS.TRIANGLES && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_STRIP && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_FAN && primitive.mode !== void 0) {
        return null;
      }
    }
    const extensionDef = nodeDef.extensions[this.name];
    const attributesDef = extensionDef.attributes;
    const pending = [];
    const attributes = {};
    for (const key in attributesDef) {
      pending.push(this.parser.getDependency("accessor", attributesDef[key]).then((accessor) => {
        attributes[key] = accessor;
        return attributes[key];
      }));
    }
    if (pending.length < 1) {
      return null;
    }
    pending.push(this.parser.createNodeMesh(nodeIndex));
    return Promise.all(pending).then((results) => {
      const nodeObject = results.pop();
      const meshes = nodeObject.isGroup ? nodeObject.children : [nodeObject];
      const count = results[0].count;
      const instancedMeshes = [];
      for (const mesh of meshes) {
        const m = new Matrix4();
        const p = new Vector3();
        const q = new Quaternion();
        const s = new Vector3(1, 1, 1);
        const instancedMesh = new InstancedMesh(mesh.geometry, mesh.material, count);
        for (let i = 0; i < count; i++) {
          if (attributes.TRANSLATION) {
            p.fromBufferAttribute(attributes.TRANSLATION, i);
          }
          if (attributes.ROTATION) {
            q.fromBufferAttribute(attributes.ROTATION, i);
          }
          if (attributes.SCALE) {
            s.fromBufferAttribute(attributes.SCALE, i);
          }
          instancedMesh.setMatrixAt(i, m.compose(p, q, s));
        }
        for (const attributeName in attributes) {
          if (attributeName === "_COLOR_0") {
            const attr = attributes[attributeName];
            instancedMesh.instanceColor = new InstancedBufferAttribute(attr.array, attr.itemSize, attr.normalized);
          } else if (attributeName !== "TRANSLATION" && attributeName !== "ROTATION" && attributeName !== "SCALE") {
            mesh.geometry.setAttribute(attributeName, attributes[attributeName]);
          }
        }
        Object3D.prototype.copy.call(instancedMesh, mesh);
        this.parser.assignFinalMaterial(instancedMesh);
        instancedMeshes.push(instancedMesh);
      }
      if (nodeObject.isGroup) {
        nodeObject.clear();
        nodeObject.add(...instancedMeshes);
        return nodeObject;
      }
      return instancedMeshes[0];
    });
  }
}
const BINARY_EXTENSION_HEADER_MAGIC = "glTF";
const BINARY_EXTENSION_HEADER_LENGTH = 12;
const BINARY_EXTENSION_CHUNK_TYPES = { JSON: 1313821514, BIN: 5130562 };
class GLTFBinaryExtension {
  constructor(data) {
    this.name = EXTENSIONS.KHR_BINARY_GLTF;
    this.content = null;
    this.body = null;
    const headerView = new DataView(data, 0, BINARY_EXTENSION_HEADER_LENGTH);
    const textDecoder = new TextDecoder();
    this.header = {
      magic: textDecoder.decode(new Uint8Array(data.slice(0, 4))),
      version: headerView.getUint32(4, true),
      length: headerView.getUint32(8, true)
    };
    if (this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC) {
      throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");
    } else if (this.header.version < 2) {
      throw new Error("THREE.GLTFLoader: Legacy binary file detected.");
    }
    const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
    const chunkView = new DataView(data, BINARY_EXTENSION_HEADER_LENGTH);
    let chunkIndex = 0;
    while (chunkIndex < chunkContentsLength) {
      const chunkLength = chunkView.getUint32(chunkIndex, true);
      chunkIndex += 4;
      const chunkType = chunkView.getUint32(chunkIndex, true);
      chunkIndex += 4;
      if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON) {
        const contentArray = new Uint8Array(data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength);
        this.content = textDecoder.decode(contentArray);
      } else if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN) {
        const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
        this.body = data.slice(byteOffset, byteOffset + chunkLength);
      }
      chunkIndex += chunkLength;
    }
    if (this.content === null) {
      throw new Error("THREE.GLTFLoader: JSON content not found.");
    }
  }
}
class GLTFDracoMeshCompressionExtension {
  constructor(json, dracoLoader) {
    if (!dracoLoader) {
      throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");
    }
    this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
    this.json = json;
    this.dracoLoader = dracoLoader;
    this.dracoLoader.preload();
  }
  decodePrimitive(primitive, parser) {
    const json = this.json;
    const dracoLoader = this.dracoLoader;
    const bufferViewIndex = primitive.extensions[this.name].bufferView;
    const gltfAttributeMap = primitive.extensions[this.name].attributes;
    const threeAttributeMap = {};
    const attributeNormalizedMap = {};
    const attributeTypeMap = {};
    for (const attributeName in gltfAttributeMap) {
      const threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
      threeAttributeMap[threeAttributeName] = gltfAttributeMap[attributeName];
    }
    for (const attributeName in primitive.attributes) {
      const threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
      if (gltfAttributeMap[attributeName] !== void 0) {
        const accessorDef = json.accessors[primitive.attributes[attributeName]];
        const componentType = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
        attributeTypeMap[threeAttributeName] = componentType.name;
        attributeNormalizedMap[threeAttributeName] = accessorDef.normalized === true;
      }
    }
    return parser.getDependency("bufferView", bufferViewIndex).then(function(bufferView) {
      return new Promise(function(resolve, reject) {
        dracoLoader.decodeDracoFile(bufferView, function(geometry) {
          for (const attributeName in geometry.attributes) {
            const attribute = geometry.attributes[attributeName];
            const normalized = attributeNormalizedMap[attributeName];
            if (normalized !== void 0) attribute.normalized = normalized;
          }
          resolve(geometry);
        }, threeAttributeMap, attributeTypeMap, LinearSRGBColorSpace, reject);
      });
    });
  }
}
class GLTFTextureTransformExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;
  }
  extendTexture(texture, transform) {
    if ((transform.texCoord === void 0 || transform.texCoord === texture.channel) && transform.offset === void 0 && transform.rotation === void 0 && transform.scale === void 0) {
      return texture;
    }
    texture = texture.clone();
    if (transform.texCoord !== void 0) {
      texture.channel = transform.texCoord;
    }
    if (transform.offset !== void 0) {
      texture.offset.fromArray(transform.offset);
    }
    if (transform.rotation !== void 0) {
      texture.rotation = transform.rotation;
    }
    if (transform.scale !== void 0) {
      texture.repeat.fromArray(transform.scale);
    }
    texture.needsUpdate = true;
    return texture;
  }
}
class GLTFMeshQuantizationExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;
  }
}
class GLTFCubicSplineInterpolant extends Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  copySampleValue_(index) {
    const result = this.resultBuffer, values = this.sampleValues, valueSize = this.valueSize, offset = index * valueSize * 3 + valueSize;
    for (let i = 0; i !== valueSize; i++) {
      result[i] = values[offset + i];
    }
    return result;
  }
  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer;
    const values = this.sampleValues;
    const stride = this.valueSize;
    const stride2 = stride * 2;
    const stride3 = stride * 3;
    const td = t1 - t0;
    const p = (t - t0) / td;
    const pp = p * p;
    const ppp = pp * p;
    const offset1 = i1 * stride3;
    const offset0 = offset1 - stride3;
    const s2 = -2 * ppp + 3 * pp;
    const s3 = ppp - pp;
    const s0 = 1 - s2;
    const s1 = s3 - pp + p;
    for (let i = 0; i !== stride; i++) {
      const p0 = values[offset0 + i + stride];
      const m0 = values[offset0 + i + stride2] * td;
      const p1 = values[offset1 + i + stride];
      const m1 = values[offset1 + i] * td;
      result[i] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;
    }
    return result;
  }
}
const _q = new Quaternion();
class GLTFCubicSplineQuaternionInterpolant extends GLTFCubicSplineInterpolant {
  interpolate_(i1, t0, t, t1) {
    const result = super.interpolate_(i1, t0, t, t1);
    _q.fromArray(result).normalize().toArray(result);
    return result;
  }
}
const WEBGL_CONSTANTS = {
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6
};
const WEBGL_COMPONENT_TYPES = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array
};
const WEBGL_FILTERS = {
  9728: NearestFilter,
  9729: LinearFilter,
  9984: NearestMipmapNearestFilter,
  9985: LinearMipmapNearestFilter,
  9986: NearestMipmapLinearFilter,
  9987: LinearMipmapLinearFilter
};
const WEBGL_WRAPPINGS = {
  33071: ClampToEdgeWrapping,
  33648: MirroredRepeatWrapping,
  10497: RepeatWrapping
};
const WEBGL_TYPE_SIZES = {
  "SCALAR": 1,
  "VEC2": 2,
  "VEC3": 3,
  "VEC4": 4,
  "MAT2": 4,
  "MAT3": 9,
  "MAT4": 16
};
const ATTRIBUTES = {
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
};
const PATH_PROPERTIES = {
  scale: "scale",
  translation: "position",
  rotation: "quaternion",
  weights: "morphTargetInfluences"
};
const INTERPOLATION = {
  CUBICSPLINE: void 0,
  // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
  // keyframe track will be initialized with a default interpolation type, then modified.
  LINEAR: InterpolateLinear,
  STEP: InterpolateDiscrete
};
const ALPHA_MODES = {
  OPAQUE: "OPAQUE",
  MASK: "MASK",
  BLEND: "BLEND"
};
function createDefaultMaterial(cache) {
  if (cache["DefaultMaterial"] === void 0) {
    cache["DefaultMaterial"] = new MeshStandardMaterial({
      color: 16777215,
      emissive: 0,
      metalness: 1,
      roughness: 1,
      transparent: false,
      depthTest: true,
      side: FrontSide
    });
  }
  return cache["DefaultMaterial"];
}
function addUnknownExtensionsToUserData(knownExtensions, object, objectDef) {
  for (const name in objectDef.extensions) {
    if (knownExtensions[name] === void 0) {
      object.userData.gltfExtensions = object.userData.gltfExtensions || {};
      object.userData.gltfExtensions[name] = objectDef.extensions[name];
    }
  }
}
function assignExtrasToUserData(object, gltfDef) {
  if (gltfDef.extras !== void 0) {
    if (typeof gltfDef.extras === "object") {
      Object.assign(object.userData, gltfDef.extras);
    } else {
      console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, " + gltfDef.extras);
    }
  }
}
function addMorphTargets(geometry, targets, parser) {
  let hasMorphPosition = false;
  let hasMorphNormal = false;
  let hasMorphColor = false;
  for (let i = 0, il = targets.length; i < il; i++) {
    const target = targets[i];
    if (target.POSITION !== void 0) hasMorphPosition = true;
    if (target.NORMAL !== void 0) hasMorphNormal = true;
    if (target.COLOR_0 !== void 0) hasMorphColor = true;
    if (hasMorphPosition && hasMorphNormal && hasMorphColor) break;
  }
  if (!hasMorphPosition && !hasMorphNormal && !hasMorphColor) return Promise.resolve(geometry);
  const pendingPositionAccessors = [];
  const pendingNormalAccessors = [];
  const pendingColorAccessors = [];
  for (let i = 0, il = targets.length; i < il; i++) {
    const target = targets[i];
    if (hasMorphPosition) {
      const pendingAccessor = target.POSITION !== void 0 ? parser.getDependency("accessor", target.POSITION) : geometry.attributes.position;
      pendingPositionAccessors.push(pendingAccessor);
    }
    if (hasMorphNormal) {
      const pendingAccessor = target.NORMAL !== void 0 ? parser.getDependency("accessor", target.NORMAL) : geometry.attributes.normal;
      pendingNormalAccessors.push(pendingAccessor);
    }
    if (hasMorphColor) {
      const pendingAccessor = target.COLOR_0 !== void 0 ? parser.getDependency("accessor", target.COLOR_0) : geometry.attributes.color;
      pendingColorAccessors.push(pendingAccessor);
    }
  }
  return Promise.all([
    Promise.all(pendingPositionAccessors),
    Promise.all(pendingNormalAccessors),
    Promise.all(pendingColorAccessors)
  ]).then(function(accessors) {
    const morphPositions = accessors[0];
    const morphNormals = accessors[1];
    const morphColors = accessors[2];
    if (hasMorphPosition) geometry.morphAttributes.position = morphPositions;
    if (hasMorphNormal) geometry.morphAttributes.normal = morphNormals;
    if (hasMorphColor) geometry.morphAttributes.color = morphColors;
    geometry.morphTargetsRelative = true;
    return geometry;
  });
}
function updateMorphTargets(mesh, meshDef) {
  mesh.updateMorphTargets();
  if (meshDef.weights !== void 0) {
    for (let i = 0, il = meshDef.weights.length; i < il; i++) {
      mesh.morphTargetInfluences[i] = meshDef.weights[i];
    }
  }
  if (meshDef.extras && Array.isArray(meshDef.extras.targetNames)) {
    const targetNames = meshDef.extras.targetNames;
    if (mesh.morphTargetInfluences.length === targetNames.length) {
      mesh.morphTargetDictionary = {};
      for (let i = 0, il = targetNames.length; i < il; i++) {
        mesh.morphTargetDictionary[targetNames[i]] = i;
      }
    } else {
      console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.");
    }
  }
}
function createPrimitiveKey(primitiveDef) {
  let geometryKey;
  const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION];
  if (dracoExtension) {
    geometryKey = "draco:" + dracoExtension.bufferView + ":" + dracoExtension.indices + ":" + createAttributesKey(dracoExtension.attributes);
  } else {
    geometryKey = primitiveDef.indices + ":" + createAttributesKey(primitiveDef.attributes) + ":" + primitiveDef.mode;
  }
  if (primitiveDef.targets !== void 0) {
    for (let i = 0, il = primitiveDef.targets.length; i < il; i++) {
      geometryKey += ":" + createAttributesKey(primitiveDef.targets[i]);
    }
  }
  return geometryKey;
}
function createAttributesKey(attributes) {
  let attributesKey = "";
  const keys = Object.keys(attributes).sort();
  for (let i = 0, il = keys.length; i < il; i++) {
    attributesKey += keys[i] + ":" + attributes[keys[i]] + ";";
  }
  return attributesKey;
}
function getNormalizedComponentScale(constructor) {
  switch (constructor) {
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
function getImageURIMimeType(uri) {
  if (uri.search(/\.jpe?g($|\?)/i) > 0 || uri.search(/^data\:image\/jpeg/) === 0) return "image/jpeg";
  if (uri.search(/\.webp($|\?)/i) > 0 || uri.search(/^data\:image\/webp/) === 0) return "image/webp";
  if (uri.search(/\.ktx2($|\?)/i) > 0 || uri.search(/^data\:image\/ktx2/) === 0) return "image/ktx2";
  return "image/png";
}
const _identityMatrix = new Matrix4();
class GLTFParser {
  constructor(json = {}, options = {}) {
    this.json = json;
    this.extensions = {};
    this.plugins = {};
    this.options = options;
    this.cache = new GLTFRegistry();
    this.associations = /* @__PURE__ */ new Map();
    this.primitiveCache = {};
    this.nodeCache = {};
    this.meshCache = { refs: {}, uses: {} };
    this.cameraCache = { refs: {}, uses: {} };
    this.lightCache = { refs: {}, uses: {} };
    this.sourceCache = {};
    this.textureCache = {};
    this.nodeNamesUsed = {};
    let isSafari = false;
    let safariVersion = -1;
    let isFirefox = false;
    let firefoxVersion = -1;
    if (typeof navigator !== "undefined") {
      const userAgent = navigator.userAgent;
      isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) === true;
      const safariMatch = userAgent.match(/Version\/(\d+)/);
      safariVersion = isSafari && safariMatch ? parseInt(safariMatch[1], 10) : -1;
      isFirefox = userAgent.indexOf("Firefox") > -1;
      firefoxVersion = isFirefox ? userAgent.match(/Firefox\/([0-9]+)\./)[1] : -1;
    }
    if (typeof createImageBitmap === "undefined" || isSafari && safariVersion < 17 || isFirefox && firefoxVersion < 98) {
      this.textureLoader = new TextureLoader(this.options.manager);
    } else {
      this.textureLoader = new ImageBitmapLoader(this.options.manager);
    }
    this.textureLoader.setCrossOrigin(this.options.crossOrigin);
    this.textureLoader.setRequestHeader(this.options.requestHeader);
    this.fileLoader = new FileLoader(this.options.manager);
    this.fileLoader.setResponseType("arraybuffer");
    if (this.options.crossOrigin === "use-credentials") {
      this.fileLoader.setWithCredentials(true);
    }
  }
  setExtensions(extensions) {
    this.extensions = extensions;
  }
  setPlugins(plugins) {
    this.plugins = plugins;
  }
  parse(onLoad, onError) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    this.cache.removeAll();
    this.nodeCache = {};
    this._invokeAll(function(ext) {
      return ext._markDefs && ext._markDefs();
    });
    Promise.all(this._invokeAll(function(ext) {
      return ext.beforeRoot && ext.beforeRoot();
    })).then(function() {
      return Promise.all([
        parser.getDependencies("scene"),
        parser.getDependencies("animation"),
        parser.getDependencies("camera")
      ]);
    }).then(function(dependencies) {
      const result = {
        scene: dependencies[0][json.scene || 0],
        scenes: dependencies[0],
        animations: dependencies[1],
        cameras: dependencies[2],
        asset: json.asset,
        parser,
        userData: {}
      };
      addUnknownExtensionsToUserData(extensions, result, json);
      assignExtrasToUserData(result, json);
      return Promise.all(parser._invokeAll(function(ext) {
        return ext.afterRoot && ext.afterRoot(result);
      })).then(function() {
        for (const scene of result.scenes) {
          scene.updateMatrixWorld();
        }
        onLoad(result);
      });
    }).catch(onError);
  }
  /**
   * Marks the special nodes/meshes in json for efficient parse.
   */
  _markDefs() {
    const nodeDefs = this.json.nodes || [];
    const skinDefs = this.json.skins || [];
    const meshDefs = this.json.meshes || [];
    for (let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex++) {
      const joints = skinDefs[skinIndex].joints;
      for (let i = 0, il = joints.length; i < il; i++) {
        nodeDefs[joints[i]].isBone = true;
      }
    }
    for (let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
      const nodeDef = nodeDefs[nodeIndex];
      if (nodeDef.mesh !== void 0) {
        this._addNodeRef(this.meshCache, nodeDef.mesh);
        if (nodeDef.skin !== void 0) {
          meshDefs[nodeDef.mesh].isSkinnedMesh = true;
        }
      }
      if (nodeDef.camera !== void 0) {
        this._addNodeRef(this.cameraCache, nodeDef.camera);
      }
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
  _addNodeRef(cache, index) {
    if (index === void 0) return;
    if (cache.refs[index] === void 0) {
      cache.refs[index] = cache.uses[index] = 0;
    }
    cache.refs[index]++;
  }
  /**
   * Returns a reference to a shared resource, cloning it if necessary.
   *
   * @param {Object} cache
   * @param {Number} index
   * @param {Object} object
   * @return {Object}
   */
  _getNodeRef(cache, index, object) {
    if (cache.refs[index] <= 1) return object;
    const ref = object.clone();
    const updateMappings = (original, clone2) => {
      const mappings = this.associations.get(original);
      if (mappings != null) {
        this.associations.set(clone2, mappings);
      }
      for (const [i, child] of original.children.entries()) {
        updateMappings(child, clone2.children[i]);
      }
    };
    updateMappings(object, ref);
    ref.name += "_instance_" + cache.uses[index]++;
    return ref;
  }
  _invokeOne(func) {
    const extensions = Object.values(this.plugins);
    extensions.push(this);
    for (let i = 0; i < extensions.length; i++) {
      const result = func(extensions[i]);
      if (result) return result;
    }
    return null;
  }
  _invokeAll(func) {
    const extensions = Object.values(this.plugins);
    extensions.unshift(this);
    const pending = [];
    for (let i = 0; i < extensions.length; i++) {
      const result = func(extensions[i]);
      if (result) pending.push(result);
    }
    return pending;
  }
  /**
   * Requests the specified dependency asynchronously, with caching.
   * @param {string} type
   * @param {number} index
   * @return {Promise<Object3D|Material|THREE.Texture|AnimationClip|ArrayBuffer|Object>}
   */
  getDependency(type, index) {
    const cacheKey = type + ":" + index;
    let dependency = this.cache.get(cacheKey);
    if (!dependency) {
      switch (type) {
        case "scene":
          dependency = this.loadScene(index);
          break;
        case "node":
          dependency = this._invokeOne(function(ext) {
            return ext.loadNode && ext.loadNode(index);
          });
          break;
        case "mesh":
          dependency = this._invokeOne(function(ext) {
            return ext.loadMesh && ext.loadMesh(index);
          });
          break;
        case "accessor":
          dependency = this.loadAccessor(index);
          break;
        case "bufferView":
          dependency = this._invokeOne(function(ext) {
            return ext.loadBufferView && ext.loadBufferView(index);
          });
          break;
        case "buffer":
          dependency = this.loadBuffer(index);
          break;
        case "material":
          dependency = this._invokeOne(function(ext) {
            return ext.loadMaterial && ext.loadMaterial(index);
          });
          break;
        case "texture":
          dependency = this._invokeOne(function(ext) {
            return ext.loadTexture && ext.loadTexture(index);
          });
          break;
        case "skin":
          dependency = this.loadSkin(index);
          break;
        case "animation":
          dependency = this._invokeOne(function(ext) {
            return ext.loadAnimation && ext.loadAnimation(index);
          });
          break;
        case "camera":
          dependency = this.loadCamera(index);
          break;
        default:
          dependency = this._invokeOne(function(ext) {
            return ext != this && ext.getDependency && ext.getDependency(type, index);
          });
          if (!dependency) {
            throw new Error("Unknown type: " + type);
          }
          break;
      }
      this.cache.add(cacheKey, dependency);
    }
    return dependency;
  }
  /**
   * Requests all dependencies of the specified type asynchronously, with caching.
   * @param {string} type
   * @return {Promise<Array<Object>>}
   */
  getDependencies(type) {
    let dependencies = this.cache.get(type);
    if (!dependencies) {
      const parser = this;
      const defs = this.json[type + (type === "mesh" ? "es" : "s")] || [];
      dependencies = Promise.all(defs.map(function(def, index) {
        return parser.getDependency(type, index);
      }));
      this.cache.add(type, dependencies);
    }
    return dependencies;
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferIndex
   * @return {Promise<ArrayBuffer>}
   */
  loadBuffer(bufferIndex) {
    const bufferDef = this.json.buffers[bufferIndex];
    const loader = this.fileLoader;
    if (bufferDef.type && bufferDef.type !== "arraybuffer") {
      throw new Error("THREE.GLTFLoader: " + bufferDef.type + " buffer type is not supported.");
    }
    if (bufferDef.uri === void 0 && bufferIndex === 0) {
      return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body);
    }
    const options = this.options;
    return new Promise(function(resolve, reject) {
      loader.load(LoaderUtils.resolveURL(bufferDef.uri, options.path), resolve, void 0, function() {
        reject(new Error('THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".'));
      });
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferViewIndex
   * @return {Promise<ArrayBuffer>}
   */
  loadBufferView(bufferViewIndex) {
    const bufferViewDef = this.json.bufferViews[bufferViewIndex];
    return this.getDependency("buffer", bufferViewDef.buffer).then(function(buffer) {
      const byteLength = bufferViewDef.byteLength || 0;
      const byteOffset = bufferViewDef.byteOffset || 0;
      return buffer.slice(byteOffset, byteOffset + byteLength);
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
   * @param {number} accessorIndex
   * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
   */
  loadAccessor(accessorIndex) {
    const parser = this;
    const json = this.json;
    const accessorDef = this.json.accessors[accessorIndex];
    if (accessorDef.bufferView === void 0 && accessorDef.sparse === void 0) {
      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
      const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
      const normalized = accessorDef.normalized === true;
      const array = new TypedArray(accessorDef.count * itemSize);
      return Promise.resolve(new BufferAttribute(array, itemSize, normalized));
    }
    const pendingBufferViews = [];
    if (accessorDef.bufferView !== void 0) {
      pendingBufferViews.push(this.getDependency("bufferView", accessorDef.bufferView));
    } else {
      pendingBufferViews.push(null);
    }
    if (accessorDef.sparse !== void 0) {
      pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.indices.bufferView));
      pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.values.bufferView));
    }
    return Promise.all(pendingBufferViews).then(function(bufferViews) {
      const bufferView = bufferViews[0];
      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
      const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
      const elementBytes = TypedArray.BYTES_PER_ELEMENT;
      const itemBytes = elementBytes * itemSize;
      const byteOffset = accessorDef.byteOffset || 0;
      const byteStride = accessorDef.bufferView !== void 0 ? json.bufferViews[accessorDef.bufferView].byteStride : void 0;
      const normalized = accessorDef.normalized === true;
      let array, bufferAttribute;
      if (byteStride && byteStride !== itemBytes) {
        const ibSlice = Math.floor(byteOffset / byteStride);
        const ibCacheKey = "InterleavedBuffer:" + accessorDef.bufferView + ":" + accessorDef.componentType + ":" + ibSlice + ":" + accessorDef.count;
        let ib = parser.cache.get(ibCacheKey);
        if (!ib) {
          array = new TypedArray(bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes);
          ib = new InterleavedBuffer(array, byteStride / elementBytes);
          parser.cache.add(ibCacheKey, ib);
        }
        bufferAttribute = new InterleavedBufferAttribute(ib, itemSize, byteOffset % byteStride / elementBytes, normalized);
      } else {
        if (bufferView === null) {
          array = new TypedArray(accessorDef.count * itemSize);
        } else {
          array = new TypedArray(bufferView, byteOffset, accessorDef.count * itemSize);
        }
        bufferAttribute = new BufferAttribute(array, itemSize, normalized);
      }
      if (accessorDef.sparse !== void 0) {
        const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
        const TypedArrayIndices = WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType];
        const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
        const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;
        const sparseIndices = new TypedArrayIndices(bufferViews[1], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices);
        const sparseValues = new TypedArray(bufferViews[2], byteOffsetValues, accessorDef.sparse.count * itemSize);
        if (bufferView !== null) {
          bufferAttribute = new BufferAttribute(bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized);
        }
        bufferAttribute.normalized = false;
        for (let i = 0, il = sparseIndices.length; i < il; i++) {
          const index = sparseIndices[i];
          bufferAttribute.setX(index, sparseValues[i * itemSize]);
          if (itemSize >= 2) bufferAttribute.setY(index, sparseValues[i * itemSize + 1]);
          if (itemSize >= 3) bufferAttribute.setZ(index, sparseValues[i * itemSize + 2]);
          if (itemSize >= 4) bufferAttribute.setW(index, sparseValues[i * itemSize + 3]);
          if (itemSize >= 5) throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.");
        }
        bufferAttribute.normalized = normalized;
      }
      return bufferAttribute;
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
   * @param {number} textureIndex
   * @return {Promise<THREE.Texture|null>}
   */
  loadTexture(textureIndex) {
    const json = this.json;
    const options = this.options;
    const textureDef = json.textures[textureIndex];
    const sourceIndex = textureDef.source;
    const sourceDef = json.images[sourceIndex];
    let loader = this.textureLoader;
    if (sourceDef.uri) {
      const handler = options.manager.getHandler(sourceDef.uri);
      if (handler !== null) loader = handler;
    }
    return this.loadTextureImage(textureIndex, sourceIndex, loader);
  }
  loadTextureImage(textureIndex, sourceIndex, loader) {
    const parser = this;
    const json = this.json;
    const textureDef = json.textures[textureIndex];
    const sourceDef = json.images[sourceIndex];
    const cacheKey = (sourceDef.uri || sourceDef.bufferView) + ":" + textureDef.sampler;
    if (this.textureCache[cacheKey]) {
      return this.textureCache[cacheKey];
    }
    const promise = this.loadImageSource(sourceIndex, loader).then(function(texture) {
      texture.flipY = false;
      texture.name = textureDef.name || sourceDef.name || "";
      if (texture.name === "" && typeof sourceDef.uri === "string" && sourceDef.uri.startsWith("data:image/") === false) {
        texture.name = sourceDef.uri;
      }
      const samplers = json.samplers || {};
      const sampler = samplers[textureDef.sampler] || {};
      texture.magFilter = WEBGL_FILTERS[sampler.magFilter] || LinearFilter;
      texture.minFilter = WEBGL_FILTERS[sampler.minFilter] || LinearMipmapLinearFilter;
      texture.wrapS = WEBGL_WRAPPINGS[sampler.wrapS] || RepeatWrapping;
      texture.wrapT = WEBGL_WRAPPINGS[sampler.wrapT] || RepeatWrapping;
      texture.generateMipmaps = !texture.isCompressedTexture && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
      parser.associations.set(texture, { textures: textureIndex });
      return texture;
    }).catch(function() {
      return null;
    });
    this.textureCache[cacheKey] = promise;
    return promise;
  }
  loadImageSource(sourceIndex, loader) {
    const parser = this;
    const json = this.json;
    const options = this.options;
    if (this.sourceCache[sourceIndex] !== void 0) {
      return this.sourceCache[sourceIndex].then((texture) => texture.clone());
    }
    const sourceDef = json.images[sourceIndex];
    const URL2 = self.URL || self.webkitURL;
    let sourceURI = sourceDef.uri || "";
    let isObjectURL = false;
    if (sourceDef.bufferView !== void 0) {
      sourceURI = parser.getDependency("bufferView", sourceDef.bufferView).then(function(bufferView) {
        isObjectURL = true;
        const blob = new Blob([bufferView], { type: sourceDef.mimeType });
        sourceURI = URL2.createObjectURL(blob);
        return sourceURI;
      });
    } else if (sourceDef.uri === void 0) {
      throw new Error("THREE.GLTFLoader: Image " + sourceIndex + " is missing URI and bufferView");
    }
    const promise = Promise.resolve(sourceURI).then(function(sourceURI2) {
      return new Promise(function(resolve, reject) {
        let onLoad = resolve;
        if (loader.isImageBitmapLoader === true) {
          onLoad = function(imageBitmap) {
            const texture = new Texture(imageBitmap);
            texture.needsUpdate = true;
            resolve(texture);
          };
        }
        loader.load(LoaderUtils.resolveURL(sourceURI2, options.path), onLoad, void 0, reject);
      });
    }).then(function(texture) {
      if (isObjectURL === true) {
        URL2.revokeObjectURL(sourceURI);
      }
      assignExtrasToUserData(texture, sourceDef);
      texture.userData.mimeType = sourceDef.mimeType || getImageURIMimeType(sourceDef.uri);
      return texture;
    }).catch(function(error) {
      console.error("THREE.GLTFLoader: Couldn't load texture", sourceURI);
      throw error;
    });
    this.sourceCache[sourceIndex] = promise;
    return promise;
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
  assignTexture(materialParams, mapName, mapDef, colorSpace) {
    const parser = this;
    return this.getDependency("texture", mapDef.index).then(function(texture) {
      if (!texture) return null;
      if (mapDef.texCoord !== void 0 && mapDef.texCoord > 0) {
        texture = texture.clone();
        texture.channel = mapDef.texCoord;
      }
      if (parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]) {
        const transform = mapDef.extensions !== void 0 ? mapDef.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM] : void 0;
        if (transform) {
          const gltfReference = parser.associations.get(texture);
          texture = parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM].extendTexture(texture, transform);
          parser.associations.set(texture, gltfReference);
        }
      }
      if (colorSpace !== void 0) {
        texture.colorSpace = colorSpace;
      }
      materialParams[mapName] = texture;
      return texture;
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
  assignFinalMaterial(mesh) {
    const geometry = mesh.geometry;
    let material = mesh.material;
    const useDerivativeTangents = geometry.attributes.tangent === void 0;
    const useVertexColors = geometry.attributes.color !== void 0;
    const useFlatShading = geometry.attributes.normal === void 0;
    if (mesh.isPoints) {
      const cacheKey = "PointsMaterial:" + material.uuid;
      let pointsMaterial = this.cache.get(cacheKey);
      if (!pointsMaterial) {
        pointsMaterial = new PointsMaterial();
        Material.prototype.copy.call(pointsMaterial, material);
        pointsMaterial.color.copy(material.color);
        pointsMaterial.map = material.map;
        pointsMaterial.sizeAttenuation = false;
        this.cache.add(cacheKey, pointsMaterial);
      }
      material = pointsMaterial;
    } else if (mesh.isLine) {
      const cacheKey = "LineBasicMaterial:" + material.uuid;
      let lineMaterial = this.cache.get(cacheKey);
      if (!lineMaterial) {
        lineMaterial = new LineBasicMaterial();
        Material.prototype.copy.call(lineMaterial, material);
        lineMaterial.color.copy(material.color);
        lineMaterial.map = material.map;
        this.cache.add(cacheKey, lineMaterial);
      }
      material = lineMaterial;
    }
    if (useDerivativeTangents || useVertexColors || useFlatShading) {
      let cacheKey = "ClonedMaterial:" + material.uuid + ":";
      if (useDerivativeTangents) cacheKey += "derivative-tangents:";
      if (useVertexColors) cacheKey += "vertex-colors:";
      if (useFlatShading) cacheKey += "flat-shading:";
      let cachedMaterial = this.cache.get(cacheKey);
      if (!cachedMaterial) {
        cachedMaterial = material.clone();
        if (useVertexColors) cachedMaterial.vertexColors = true;
        if (useFlatShading) cachedMaterial.flatShading = true;
        if (useDerivativeTangents) {
          if (cachedMaterial.normalScale) cachedMaterial.normalScale.y *= -1;
          if (cachedMaterial.clearcoatNormalScale) cachedMaterial.clearcoatNormalScale.y *= -1;
        }
        this.cache.add(cacheKey, cachedMaterial);
        this.associations.set(cachedMaterial, this.associations.get(material));
      }
      material = cachedMaterial;
    }
    mesh.material = material;
  }
  getMaterialType() {
    return MeshStandardMaterial;
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
   * @param {number} materialIndex
   * @return {Promise<Material>}
   */
  loadMaterial(materialIndex) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    const materialDef = json.materials[materialIndex];
    let materialType;
    const materialParams = {};
    const materialExtensions = materialDef.extensions || {};
    const pending = [];
    if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {
      const kmuExtension = extensions[EXTENSIONS.KHR_MATERIALS_UNLIT];
      materialType = kmuExtension.getMaterialType();
      pending.push(kmuExtension.extendParams(materialParams, materialDef, parser));
    } else {
      const metallicRoughness = materialDef.pbrMetallicRoughness || {};
      materialParams.color = new Color(1, 1, 1);
      materialParams.opacity = 1;
      if (Array.isArray(metallicRoughness.baseColorFactor)) {
        const array = metallicRoughness.baseColorFactor;
        materialParams.color.setRGB(array[0], array[1], array[2], LinearSRGBColorSpace);
        materialParams.opacity = array[3];
      }
      if (metallicRoughness.baseColorTexture !== void 0) {
        pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture, SRGBColorSpace));
      }
      materialParams.metalness = metallicRoughness.metallicFactor !== void 0 ? metallicRoughness.metallicFactor : 1;
      materialParams.roughness = metallicRoughness.roughnessFactor !== void 0 ? metallicRoughness.roughnessFactor : 1;
      if (metallicRoughness.metallicRoughnessTexture !== void 0) {
        pending.push(parser.assignTexture(materialParams, "metalnessMap", metallicRoughness.metallicRoughnessTexture));
        pending.push(parser.assignTexture(materialParams, "roughnessMap", metallicRoughness.metallicRoughnessTexture));
      }
      materialType = this._invokeOne(function(ext) {
        return ext.getMaterialType && ext.getMaterialType(materialIndex);
      });
      pending.push(Promise.all(this._invokeAll(function(ext) {
        return ext.extendMaterialParams && ext.extendMaterialParams(materialIndex, materialParams);
      })));
    }
    if (materialDef.doubleSided === true) {
      materialParams.side = DoubleSide;
    }
    const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;
    if (alphaMode === ALPHA_MODES.BLEND) {
      materialParams.transparent = true;
      materialParams.depthWrite = false;
    } else {
      materialParams.transparent = false;
      if (alphaMode === ALPHA_MODES.MASK) {
        materialParams.alphaTest = materialDef.alphaCutoff !== void 0 ? materialDef.alphaCutoff : 0.5;
      }
    }
    if (materialDef.normalTexture !== void 0 && materialType !== MeshBasicMaterial) {
      pending.push(parser.assignTexture(materialParams, "normalMap", materialDef.normalTexture));
      materialParams.normalScale = new Vector2(1, 1);
      if (materialDef.normalTexture.scale !== void 0) {
        const scale = materialDef.normalTexture.scale;
        materialParams.normalScale.set(scale, scale);
      }
    }
    if (materialDef.occlusionTexture !== void 0 && materialType !== MeshBasicMaterial) {
      pending.push(parser.assignTexture(materialParams, "aoMap", materialDef.occlusionTexture));
      if (materialDef.occlusionTexture.strength !== void 0) {
        materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;
      }
    }
    if (materialDef.emissiveFactor !== void 0 && materialType !== MeshBasicMaterial) {
      const emissiveFactor = materialDef.emissiveFactor;
      materialParams.emissive = new Color().setRGB(emissiveFactor[0], emissiveFactor[1], emissiveFactor[2], LinearSRGBColorSpace);
    }
    if (materialDef.emissiveTexture !== void 0 && materialType !== MeshBasicMaterial) {
      pending.push(parser.assignTexture(materialParams, "emissiveMap", materialDef.emissiveTexture, SRGBColorSpace));
    }
    return Promise.all(pending).then(function() {
      const material = new materialType(materialParams);
      if (materialDef.name) material.name = materialDef.name;
      assignExtrasToUserData(material, materialDef);
      parser.associations.set(material, { materials: materialIndex });
      if (materialDef.extensions) addUnknownExtensionsToUserData(extensions, material, materialDef);
      return material;
    });
  }
  /**
   * When Object3D instances are targeted by animation, they need unique names.
   *
   * @param {String} originalName
   * @return {String}
   */
  createUniqueName(originalName) {
    const sanitizedName = PropertyBinding.sanitizeNodeName(originalName || "");
    if (sanitizedName in this.nodeNamesUsed) {
      return sanitizedName + "_" + ++this.nodeNamesUsed[sanitizedName];
    } else {
      this.nodeNamesUsed[sanitizedName] = 0;
      return sanitizedName;
    }
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
   *
   * Creates BufferGeometries from primitives.
   *
   * @param {Array<GLTF.Primitive>} primitives
   * @return {Promise<Array<BufferGeometry>>}
   */
  loadGeometries(primitives) {
    const parser = this;
    const extensions = this.extensions;
    const cache = this.primitiveCache;
    function createDracoPrimitive(primitive) {
      return extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(primitive, parser).then(function(geometry) {
        return addPrimitiveAttributes(geometry, primitive, parser);
      });
    }
    const pending = [];
    for (let i = 0, il = primitives.length; i < il; i++) {
      const primitive = primitives[i];
      const cacheKey = createPrimitiveKey(primitive);
      const cached = cache[cacheKey];
      if (cached) {
        pending.push(cached.promise);
      } else {
        let geometryPromise;
        if (primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) {
          geometryPromise = createDracoPrimitive(primitive);
        } else {
          geometryPromise = addPrimitiveAttributes(new BufferGeometry(), primitive, parser);
        }
        cache[cacheKey] = { primitive, promise: geometryPromise };
        pending.push(geometryPromise);
      }
    }
    return Promise.all(pending);
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
   * @param {number} meshIndex
   * @return {Promise<Group|Mesh|SkinnedMesh>}
   */
  loadMesh(meshIndex) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    const meshDef = json.meshes[meshIndex];
    const primitives = meshDef.primitives;
    const pending = [];
    for (let i = 0, il = primitives.length; i < il; i++) {
      const material = primitives[i].material === void 0 ? createDefaultMaterial(this.cache) : this.getDependency("material", primitives[i].material);
      pending.push(material);
    }
    pending.push(parser.loadGeometries(primitives));
    return Promise.all(pending).then(function(results) {
      const materials = results.slice(0, results.length - 1);
      const geometries = results[results.length - 1];
      const meshes = [];
      for (let i = 0, il = geometries.length; i < il; i++) {
        const geometry = geometries[i];
        const primitive = primitives[i];
        let mesh;
        const material = materials[i];
        if (primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || primitive.mode === void 0) {
          mesh = meshDef.isSkinnedMesh === true ? new SkinnedMesh(geometry, material) : new Mesh(geometry, material);
          if (mesh.isSkinnedMesh === true) {
            mesh.normalizeSkinWeights();
          }
          if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleStripDrawMode);
          } else if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleFanDrawMode);
          }
        } else if (primitive.mode === WEBGL_CONSTANTS.LINES) {
          mesh = new LineSegments(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.LINE_STRIP) {
          mesh = new Line(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.LINE_LOOP) {
          mesh = new LineLoop(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.POINTS) {
          mesh = new Points(geometry, material);
        } else {
          throw new Error("THREE.GLTFLoader: Primitive mode unsupported: " + primitive.mode);
        }
        if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
          updateMorphTargets(mesh, meshDef);
        }
        mesh.name = parser.createUniqueName(meshDef.name || "mesh_" + meshIndex);
        assignExtrasToUserData(mesh, meshDef);
        if (primitive.extensions) addUnknownExtensionsToUserData(extensions, mesh, primitive);
        parser.assignFinalMaterial(mesh);
        meshes.push(mesh);
      }
      for (let i = 0, il = meshes.length; i < il; i++) {
        parser.associations.set(meshes[i], {
          meshes: meshIndex,
          primitives: i
        });
      }
      if (meshes.length === 1) {
        if (meshDef.extensions) addUnknownExtensionsToUserData(extensions, meshes[0], meshDef);
        return meshes[0];
      }
      const group = new Group$1();
      if (meshDef.extensions) addUnknownExtensionsToUserData(extensions, group, meshDef);
      parser.associations.set(group, { meshes: meshIndex });
      for (let i = 0, il = meshes.length; i < il; i++) {
        group.add(meshes[i]);
      }
      return group;
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
   * @param {number} cameraIndex
   * @return {Promise<THREE.Camera>}
   */
  loadCamera(cameraIndex) {
    let camera;
    const cameraDef = this.json.cameras[cameraIndex];
    const params = cameraDef[cameraDef.type];
    if (!params) {
      console.warn("THREE.GLTFLoader: Missing camera parameters.");
      return;
    }
    if (cameraDef.type === "perspective") {
      camera = new PerspectiveCamera(MathUtils.radToDeg(params.yfov), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6);
    } else if (cameraDef.type === "orthographic") {
      camera = new OrthographicCamera(-params.xmag, params.xmag, params.ymag, -params.ymag, params.znear, params.zfar);
    }
    if (cameraDef.name) camera.name = this.createUniqueName(cameraDef.name);
    assignExtrasToUserData(camera, cameraDef);
    return Promise.resolve(camera);
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
   * @param {number} skinIndex
   * @return {Promise<Skeleton>}
   */
  loadSkin(skinIndex) {
    const skinDef = this.json.skins[skinIndex];
    const pending = [];
    for (let i = 0, il = skinDef.joints.length; i < il; i++) {
      pending.push(this._loadNodeShallow(skinDef.joints[i]));
    }
    if (skinDef.inverseBindMatrices !== void 0) {
      pending.push(this.getDependency("accessor", skinDef.inverseBindMatrices));
    } else {
      pending.push(null);
    }
    return Promise.all(pending).then(function(results) {
      const inverseBindMatrices = results.pop();
      const jointNodes = results;
      const bones = [];
      const boneInverses = [];
      for (let i = 0, il = jointNodes.length; i < il; i++) {
        const jointNode = jointNodes[i];
        if (jointNode) {
          bones.push(jointNode);
          const mat = new Matrix4();
          if (inverseBindMatrices !== null) {
            mat.fromArray(inverseBindMatrices.array, i * 16);
          }
          boneInverses.push(mat);
        } else {
          console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', skinDef.joints[i]);
        }
      }
      return new Skeleton(bones, boneInverses);
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   * @param {number} animationIndex
   * @return {Promise<AnimationClip>}
   */
  loadAnimation(animationIndex) {
    const json = this.json;
    const parser = this;
    const animationDef = json.animations[animationIndex];
    const animationName = animationDef.name ? animationDef.name : "animation_" + animationIndex;
    const pendingNodes = [];
    const pendingInputAccessors = [];
    const pendingOutputAccessors = [];
    const pendingSamplers = [];
    const pendingTargets = [];
    for (let i = 0, il = animationDef.channels.length; i < il; i++) {
      const channel = animationDef.channels[i];
      const sampler = animationDef.samplers[channel.sampler];
      const target = channel.target;
      const name = target.node;
      const input = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.input] : sampler.input;
      const output = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.output] : sampler.output;
      if (target.node === void 0) continue;
      pendingNodes.push(this.getDependency("node", name));
      pendingInputAccessors.push(this.getDependency("accessor", input));
      pendingOutputAccessors.push(this.getDependency("accessor", output));
      pendingSamplers.push(sampler);
      pendingTargets.push(target);
    }
    return Promise.all([
      Promise.all(pendingNodes),
      Promise.all(pendingInputAccessors),
      Promise.all(pendingOutputAccessors),
      Promise.all(pendingSamplers),
      Promise.all(pendingTargets)
    ]).then(function(dependencies) {
      const nodes = dependencies[0];
      const inputAccessors = dependencies[1];
      const outputAccessors = dependencies[2];
      const samplers = dependencies[3];
      const targets = dependencies[4];
      const tracks = [];
      for (let i = 0, il = nodes.length; i < il; i++) {
        const node = nodes[i];
        const inputAccessor = inputAccessors[i];
        const outputAccessor = outputAccessors[i];
        const sampler = samplers[i];
        const target = targets[i];
        if (node === void 0) continue;
        if (node.updateMatrix) {
          node.updateMatrix();
        }
        const createdTracks = parser._createAnimationTracks(node, inputAccessor, outputAccessor, sampler, target);
        if (createdTracks) {
          for (let k = 0; k < createdTracks.length; k++) {
            tracks.push(createdTracks[k]);
          }
        }
      }
      return new AnimationClip(animationName, void 0, tracks);
    });
  }
  createNodeMesh(nodeIndex) {
    const json = this.json;
    const parser = this;
    const nodeDef = json.nodes[nodeIndex];
    if (nodeDef.mesh === void 0) return null;
    return parser.getDependency("mesh", nodeDef.mesh).then(function(mesh) {
      const node = parser._getNodeRef(parser.meshCache, nodeDef.mesh, mesh);
      if (nodeDef.weights !== void 0) {
        node.traverse(function(o) {
          if (!o.isMesh) return;
          for (let i = 0, il = nodeDef.weights.length; i < il; i++) {
            o.morphTargetInfluences[i] = nodeDef.weights[i];
          }
        });
      }
      return node;
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
   * @param {number} nodeIndex
   * @return {Promise<Object3D>}
   */
  loadNode(nodeIndex) {
    const json = this.json;
    const parser = this;
    const nodeDef = json.nodes[nodeIndex];
    const nodePending = parser._loadNodeShallow(nodeIndex);
    const childPending = [];
    const childrenDef = nodeDef.children || [];
    for (let i = 0, il = childrenDef.length; i < il; i++) {
      childPending.push(parser.getDependency("node", childrenDef[i]));
    }
    const skeletonPending = nodeDef.skin === void 0 ? Promise.resolve(null) : parser.getDependency("skin", nodeDef.skin);
    return Promise.all([
      nodePending,
      Promise.all(childPending),
      skeletonPending
    ]).then(function(results) {
      const node = results[0];
      const children = results[1];
      const skeleton = results[2];
      if (skeleton !== null) {
        node.traverse(function(mesh) {
          if (!mesh.isSkinnedMesh) return;
          mesh.bind(skeleton, _identityMatrix);
        });
      }
      for (let i = 0, il = children.length; i < il; i++) {
        node.add(children[i]);
      }
      return node;
    });
  }
  // ._loadNodeShallow() parses a single node.
  // skin and child nodes are created and added in .loadNode() (no '_' prefix).
  _loadNodeShallow(nodeIndex) {
    const json = this.json;
    const extensions = this.extensions;
    const parser = this;
    if (this.nodeCache[nodeIndex] !== void 0) {
      return this.nodeCache[nodeIndex];
    }
    const nodeDef = json.nodes[nodeIndex];
    const nodeName = nodeDef.name ? parser.createUniqueName(nodeDef.name) : "";
    const pending = [];
    const meshPromise = parser._invokeOne(function(ext) {
      return ext.createNodeMesh && ext.createNodeMesh(nodeIndex);
    });
    if (meshPromise) {
      pending.push(meshPromise);
    }
    if (nodeDef.camera !== void 0) {
      pending.push(parser.getDependency("camera", nodeDef.camera).then(function(camera) {
        return parser._getNodeRef(parser.cameraCache, nodeDef.camera, camera);
      }));
    }
    parser._invokeAll(function(ext) {
      return ext.createNodeAttachment && ext.createNodeAttachment(nodeIndex);
    }).forEach(function(promise) {
      pending.push(promise);
    });
    this.nodeCache[nodeIndex] = Promise.all(pending).then(function(objects) {
      let node;
      if (nodeDef.isBone === true) {
        node = new Bone();
      } else if (objects.length > 1) {
        node = new Group$1();
      } else if (objects.length === 1) {
        node = objects[0];
      } else {
        node = new Object3D();
      }
      if (node !== objects[0]) {
        for (let i = 0, il = objects.length; i < il; i++) {
          node.add(objects[i]);
        }
      }
      if (nodeDef.name) {
        node.userData.name = nodeDef.name;
        node.name = nodeName;
      }
      assignExtrasToUserData(node, nodeDef);
      if (nodeDef.extensions) addUnknownExtensionsToUserData(extensions, node, nodeDef);
      if (nodeDef.matrix !== void 0) {
        const matrix = new Matrix4();
        matrix.fromArray(nodeDef.matrix);
        node.applyMatrix4(matrix);
      } else {
        if (nodeDef.translation !== void 0) {
          node.position.fromArray(nodeDef.translation);
        }
        if (nodeDef.rotation !== void 0) {
          node.quaternion.fromArray(nodeDef.rotation);
        }
        if (nodeDef.scale !== void 0) {
          node.scale.fromArray(nodeDef.scale);
        }
      }
      if (!parser.associations.has(node)) {
        parser.associations.set(node, {});
      }
      parser.associations.get(node).nodes = nodeIndex;
      return node;
    });
    return this.nodeCache[nodeIndex];
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
   * @param {number} sceneIndex
   * @return {Promise<Group>}
   */
  loadScene(sceneIndex) {
    const extensions = this.extensions;
    const sceneDef = this.json.scenes[sceneIndex];
    const parser = this;
    const scene = new Group$1();
    if (sceneDef.name) scene.name = parser.createUniqueName(sceneDef.name);
    assignExtrasToUserData(scene, sceneDef);
    if (sceneDef.extensions) addUnknownExtensionsToUserData(extensions, scene, sceneDef);
    const nodeIds = sceneDef.nodes || [];
    const pending = [];
    for (let i = 0, il = nodeIds.length; i < il; i++) {
      pending.push(parser.getDependency("node", nodeIds[i]));
    }
    return Promise.all(pending).then(function(nodes) {
      for (let i = 0, il = nodes.length; i < il; i++) {
        scene.add(nodes[i]);
      }
      const reduceAssociations = (node) => {
        const reducedAssociations = /* @__PURE__ */ new Map();
        for (const [key, value] of parser.associations) {
          if (key instanceof Material || key instanceof Texture) {
            reducedAssociations.set(key, value);
          }
        }
        node.traverse((node2) => {
          const mappings = parser.associations.get(node2);
          if (mappings != null) {
            reducedAssociations.set(node2, mappings);
          }
        });
        return reducedAssociations;
      };
      parser.associations = reduceAssociations(scene);
      return scene;
    });
  }
  _createAnimationTracks(node, inputAccessor, outputAccessor, sampler, target) {
    const tracks = [];
    const targetName = node.name ? node.name : node.uuid;
    const targetNames = [];
    if (PATH_PROPERTIES[target.path] === PATH_PROPERTIES.weights) {
      node.traverse(function(object) {
        if (object.morphTargetInfluences) {
          targetNames.push(object.name ? object.name : object.uuid);
        }
      });
    } else {
      targetNames.push(targetName);
    }
    let TypedKeyframeTrack;
    switch (PATH_PROPERTIES[target.path]) {
      case PATH_PROPERTIES.weights:
        TypedKeyframeTrack = NumberKeyframeTrack;
        break;
      case PATH_PROPERTIES.rotation:
        TypedKeyframeTrack = QuaternionKeyframeTrack;
        break;
      case PATH_PROPERTIES.position:
      case PATH_PROPERTIES.scale:
        TypedKeyframeTrack = VectorKeyframeTrack;
        break;
      default:
        switch (outputAccessor.itemSize) {
          case 1:
            TypedKeyframeTrack = NumberKeyframeTrack;
            break;
          case 2:
          case 3:
          default:
            TypedKeyframeTrack = VectorKeyframeTrack;
            break;
        }
        break;
    }
    const interpolation = sampler.interpolation !== void 0 ? INTERPOLATION[sampler.interpolation] : InterpolateLinear;
    const outputArray = this._getArrayFromAccessor(outputAccessor);
    for (let j = 0, jl = targetNames.length; j < jl; j++) {
      const track = new TypedKeyframeTrack(
        targetNames[j] + "." + PATH_PROPERTIES[target.path],
        inputAccessor.array,
        outputArray,
        interpolation
      );
      if (sampler.interpolation === "CUBICSPLINE") {
        this._createCubicSplineTrackInterpolant(track);
      }
      tracks.push(track);
    }
    return tracks;
  }
  _getArrayFromAccessor(accessor) {
    let outputArray = accessor.array;
    if (accessor.normalized) {
      const scale = getNormalizedComponentScale(outputArray.constructor);
      const scaled = new Float32Array(outputArray.length);
      for (let j = 0, jl = outputArray.length; j < jl; j++) {
        scaled[j] = outputArray[j] * scale;
      }
      outputArray = scaled;
    }
    return outputArray;
  }
  _createCubicSplineTrackInterpolant(track) {
    track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline(result) {
      const interpolantType = this instanceof QuaternionKeyframeTrack ? GLTFCubicSplineQuaternionInterpolant : GLTFCubicSplineInterpolant;
      return new interpolantType(this.times, this.values, this.getValueSize() / 3, result);
    };
    track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;
  }
}
function computeBounds(geometry, primitiveDef, parser) {
  const attributes = primitiveDef.attributes;
  const box = new Box3();
  if (attributes.POSITION !== void 0) {
    const accessor = parser.json.accessors[attributes.POSITION];
    const min = accessor.min;
    const max = accessor.max;
    if (min !== void 0 && max !== void 0) {
      box.set(
        new Vector3(min[0], min[1], min[2]),
        new Vector3(max[0], max[1], max[2])
      );
      if (accessor.normalized) {
        const boxScale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[accessor.componentType]);
        box.min.multiplyScalar(boxScale);
        box.max.multiplyScalar(boxScale);
      }
    } else {
      console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
      return;
    }
  } else {
    return;
  }
  const targets = primitiveDef.targets;
  if (targets !== void 0) {
    const maxDisplacement = new Vector3();
    const vector = new Vector3();
    for (let i = 0, il = targets.length; i < il; i++) {
      const target = targets[i];
      if (target.POSITION !== void 0) {
        const accessor = parser.json.accessors[target.POSITION];
        const min = accessor.min;
        const max = accessor.max;
        if (min !== void 0 && max !== void 0) {
          vector.setX(Math.max(Math.abs(min[0]), Math.abs(max[0])));
          vector.setY(Math.max(Math.abs(min[1]), Math.abs(max[1])));
          vector.setZ(Math.max(Math.abs(min[2]), Math.abs(max[2])));
          if (accessor.normalized) {
            const boxScale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[accessor.componentType]);
            vector.multiplyScalar(boxScale);
          }
          maxDisplacement.max(vector);
        } else {
          console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
        }
      }
    }
    box.expandByVector(maxDisplacement);
  }
  geometry.boundingBox = box;
  const sphere = new Sphere();
  box.getCenter(sphere.center);
  sphere.radius = box.min.distanceTo(box.max) / 2;
  geometry.boundingSphere = sphere;
}
function addPrimitiveAttributes(geometry, primitiveDef, parser) {
  const attributes = primitiveDef.attributes;
  const pending = [];
  function assignAttributeAccessor(accessorIndex, attributeName) {
    return parser.getDependency("accessor", accessorIndex).then(function(accessor) {
      geometry.setAttribute(attributeName, accessor);
    });
  }
  for (const gltfAttributeName in attributes) {
    const threeAttributeName = ATTRIBUTES[gltfAttributeName] || gltfAttributeName.toLowerCase();
    if (threeAttributeName in geometry.attributes) continue;
    pending.push(assignAttributeAccessor(attributes[gltfAttributeName], threeAttributeName));
  }
  if (primitiveDef.indices !== void 0 && !geometry.index) {
    const accessor = parser.getDependency("accessor", primitiveDef.indices).then(function(accessor2) {
      geometry.setIndex(accessor2);
    });
    pending.push(accessor);
  }
  if (ColorManagement.workingColorSpace !== LinearSRGBColorSpace && "COLOR_0" in attributes) {
    console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${ColorManagement.workingColorSpace}" not supported.`);
  }
  assignExtrasToUserData(geometry, primitiveDef);
  computeBounds(geometry, primitiveDef, parser);
  return Promise.all(pending).then(function() {
    return primitiveDef.targets !== void 0 ? addMorphTargets(geometry, primitiveDef.targets, parser) : geometry;
  });
}
const BLORKPACK_FLAGS = {
  // Functionality flags
  COLLISION_VISUAL_DEBUG: false,
  SPOTLIGHT_VISUAL_DEBUG: false,
  // Log flags
  ASSET_LOGS: false,
  ACTIVATE_LOGS: false,
  PHYSICS_LOGS: false,
  MANIFEST_LOGS: false,
  ANIMATION_LOGS: false,
  DEFAULT_CONFIG_LOGS: false,
  // Log when default configurations are used instead of manifest values
  DEBUG_LOGS: false
};
const SCALE_FACTOR = 5;
const _CustomTypeManager = class _CustomTypeManager {
  /**
   *
   */
  constructor() {
    if (_CustomTypeManager.instance) {
      return _CustomTypeManager.instance;
    }
    this.types = {};
    this.configs = {};
    this.customTypesLoaded = false;
    _CustomTypeManager.instance = this;
  }
  /**
      * Gets the singleton instance
      */
  static getInstance() {
    if (!_CustomTypeManager.instance) {
      _CustomTypeManager.instance = new _CustomTypeManager();
    }
    return _CustomTypeManager.instance;
  }
  /**
      * Static method to load custom types from a JSON file
      * @param {string} customTypesPath - Path to the custom types JSON file
      */
  static async loadCustomTypes(customTypesPath) {
    return _CustomTypeManager.getInstance().loadCustomTypes(customTypesPath);
  }
  /**
      * Loads custom types from a JSON file
      * @param {string} customTypesPath - Path to the custom types JSON file
      */
  async loadCustomTypes(customTypesPath) {
    if (this.customTypesLoaded) {
      if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log("Custom types already loaded, skipping");
      }
      return this;
    }
    try {
      if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Loading custom types from: ${customTypesPath}`);
      }
      const response = await fetch(customTypesPath);
      if (!response.ok) {
        throw new Error(`Failed to load custom types: ${response.status} ${response.statusText}`);
      }
      const customTypesData = await response.json();
      if (!customTypesData || !customTypesData.custom_configs) {
        throw new Error("Invalid custom types data: missing custom_configs");
      }
      Object.keys(customTypesData.custom_configs).forEach((typeName) => {
        const config = customTypesData.custom_configs[typeName];
        if (!config.key) {
          if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
            console.warn(`Custom type ${typeName} missing key property, using typeName as key`);
          }
        }
        const typeKey = config.key || typeName;
        this.types[typeName] = typeKey;
        if (config.PATH) {
          this.configs[typeKey] = {
            PATH: config.PATH,
            scale: config.scale || SCALE_FACTOR,
            mass: config.mass || 1,
            restitution: config.restitution || 1,
            ...config.ui_scale && { ui_scale: config.ui_scale },
            ...config.display_layer && { display_layer: config.display_layer }
          };
        } else if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
          console.warn(`Custom type ${typeName} has no PATH property, configs may be incomplete`);
        }
      });
      if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Successfully loaded ${Object.keys(this.types).length} custom types from ${customTypesPath}:`);
        console.log("Mapped config keys:", Object.keys(this.configs));
      }
      let mismatchCount = 0;
      if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
        Object.keys(this.types).forEach((typeName) => {
          const typeValue = this.types[typeName];
          if (typeName !== typeValue && !this.configs[typeValue]) {
            console.warn(`Type name '${typeName}' maps to '${typeValue}', but no config exists for '${typeValue}'`);
            mismatchCount++;
          }
        });
        if (mismatchCount > 0) {
          console.warn(`Found ${mismatchCount} type mapping mismatches. Running debugTypeMappings() for details.`);
          this.debugTypeMappings();
        }
      }
      this.customTypesLoaded = true;
      Object.freeze(this.types);
      return this;
    } catch (error) {
      console.error("Error loading custom types:", error);
      return this;
    }
  }
  /**
      * Gets all custom types
      */
  getTypes() {
    return this.types;
  }
  /**
      * Gets a specific custom type
      */
  getType(typeName) {
    if (typeName in this.types) {
      return this.types[typeName];
    }
    const typeValues = Object.values(this.types);
    if (typeValues.includes(typeName)) {
      if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
        console.warn(`Note: '${typeName}' is a type value, not a type name. Returning as-is.`);
      }
      return typeName;
    }
    if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
      console.warn(`Type '${typeName}' not found in custom types.`);
    }
    return typeName;
  }
  /**
      * Gets all custom configurations
      */
  getConfigs() {
    return this.configs;
  }
  /**
      * Gets configuration for a specific custom type
      */
  getConfig(type) {
    if (this.configs[type]) {
      return this.configs[type];
    }
    const typeValue = this.getType(type);
    if (typeValue !== type && this.configs[typeValue]) {
      if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
        console.warn(`Note: Using config for '${typeValue}' instead of '${type}'`);
      }
      return this.configs[typeValue];
    }
    return null;
  }
  /**
      * Checks if a particular custom type exists
      */
  hasType(typeName) {
    const directCheck = typeName in this.types;
    const isTypeValue = Object.values(this.types).includes(typeName);
    return directCheck || isTypeValue;
  }
  /**
      * Checks if custom types have been loaded
      */
  hasLoadedCustomTypes() {
    const result = this.customTypesLoaded;
    if (!result && BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
      console.warn("Custom types have not been loaded yet. Call loadCustomTypes() first.");
      console.warn("Current types:", Object.keys(this.types).length);
    }
    return result;
  }
  /**
      * Debug method to print all type mappings and check for configuration discrepancies
      */
  debugTypeMappings() {
    if (!BLORKPACK_FLAGS || !BLORKPACK_FLAGS.ASSET_LOGS) return;
    console.log("=== Custom Type Manager Debug ===");
    console.log(`Loaded ${Object.keys(this.types).length} types, ${Object.keys(this.configs).length} configs`);
    console.log("=== End Debug ===");
  }
  /**
      * Static method to debug type mappings
      */
  static debugTypeMappings() {
    return _CustomTypeManager.getInstance().debugTypeMappings();
  }
};
__publicField(_CustomTypeManager, "instance", null);
let CustomTypeManager = _CustomTypeManager;
const CustomTypeManager$1 = CustomTypeManager.getInstance();
const _AssetStorage = class _AssetStorage {
  /**
   *
   */
  constructor() {
    __publicField(this, "stored_info", /* @__PURE__ */ new Map());
    __publicField(this, "cached_models", /* @__PURE__ */ new Map());
    __publicField(this, "loader");
    // Cache CustomTypeManager data
    __privateAdd(this, _assetConfigs, null);
    if (_AssetStorage.instance) {
      return _AssetStorage.instance;
    }
    this.stored_info = /* @__PURE__ */ new Map();
    this.cached_models = /* @__PURE__ */ new Map();
    this.loader = new GLTFLoader();
    __privateSet(this, _assetConfigs, CustomTypeManager$1.getConfigs());
    this.loaded_assets = /* @__PURE__ */ new Map();
    this.dynamic_bodies = /* @__PURE__ */ new Map();
    this.static_meshes = /* @__PURE__ */ new Map();
    this.loading_promises = /* @__PURE__ */ new Map();
    this.material_cache = /* @__PURE__ */ new Map();
    this.emission_states = /* @__PURE__ */ new Map();
    this.currently_activated_name = "";
    this.instance_counter = 0;
    _AssetStorage.instance = this;
  }
  /**
      * Gets or creates the singleton instance of AssetStorage.
      * @returns {AssetStorage} The singleton instance.
      */
  static get_instance() {
    if (!_AssetStorage.instance) {
      _AssetStorage.instance = new _AssetStorage();
    }
    return _AssetStorage.instance;
  }
  /**
      * Loads an asset of the specified type asynchronously.
      * @param {string} asset_type The type of asset to load.
      * @returns {Promise<Object>} A promise that resolves with the loaded asset.
      */
  async load_asset_type(asset_type) {
    if (this.cached_models.has(asset_type)) {
      return this.cached_models.get(asset_type);
    }
    try {
      const asset_config = __privateGet(this, _assetConfigs)[asset_type];
      if (!asset_config) {
        console.error(`No configuration found for asset type: ${asset_type}`);
        return null;
      }
      const gltf = await this.loader.loadAsync(asset_config.PATH);
      this.cached_models.set(asset_type, gltf);
      return gltf;
    } catch (error) {
      console.error(`Error loading asset type: ${asset_type}`, error);
      return null;
    }
  }
  /**
      * Adds an object to the storage system.
      * @param {THREE.Object3D} incoming_mesh - The mesh to add
      * @param {RAPIER.RigidBody} incoming_body - The physics body (optional)
      * @returns {string} The instance ID of the added object
      */
  add_object(incoming_mesh, incoming_body) {
    const instance_id = this.get_new_instance_id();
    if (incoming_body) {
      this.store_dynamic_body(instance_id, [incoming_mesh, incoming_body]);
      incoming_mesh.userData.physicsBody = incoming_body;
      incoming_mesh.userData.instanceId = instance_id;
      const position = incoming_body.translation();
      incoming_mesh.position.set(position.x, position.y, position.z);
      const rotation = incoming_body.rotation();
      incoming_mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      if (BLORKPACK_FLAGS.PHYSICS_LOGS) console.log(`Added dynamic body with ID: ${instance_id}`);
    } else {
      this.store_static_mesh(instance_id, incoming_mesh);
      incoming_mesh.userData.instanceId = instance_id;
      if (BLORKPACK_FLAGS.ASSET_LOGS) console.log(`Added static mesh with ID: ${instance_id}`);
    }
    return instance_id;
  }
  /**
      * Updates physics bodies and their corresponding meshes.
      * Called every frame to synchronize visual representation with physics.
      */
  update() {
    this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
      if (body && mesh) {
        if (body.isSleeping() && !body.isKinematic()) {
          return;
        }
        const position = body.translation();
        mesh.position.set(position.x, position.y, position.z);
        const rotation = body.rotation();
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        if (mesh.userData.isMoving && body.isSleeping()) {
          body.wakeUp();
        }
      }
    });
  }
  /**
   *
   */
  cleanup() {
    this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
      if (mesh) {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => {
              if (material.map) material.map.dispose();
              material.dispose();
            });
          } else {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
          }
        }
      }
    });
    this.get_all_static_meshes().forEach((mesh) => {
      if (mesh) {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => {
              if (material.map) material.map.dispose();
              material.dispose();
            });
          } else {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
          }
        }
      }
    });
    this.dynamic_bodies.clear();
    this.static_meshes.clear();
    this.emission_states.clear();
    this.material_cache.clear();
    this.instance_counter = 0;
    this.currently_activated_name = "";
    if (BLORKPACK_FLAGS.ASSET_LOGS) console.log("Asset storage cleaned up");
  }
  /**
   *
   */
  get_new_instance_id() {
    return `instance_${this.instance_counter++}`;
  }
  /**
   *
   */
  store_loaded_asset(asset_type, gltf) {
    this.loaded_assets.set(asset_type, gltf);
  }
  /**
   *
   */
  get_loaded_asset(asset_type) {
    return this.loaded_assets.get(asset_type);
  }
  /**
   *
   */
  has_loaded_asset(asset_type) {
    return this.loaded_assets.has(asset_type);
  }
  /**
   *
   */
  set_loading_promise(asset_type, promise) {
    this.loading_promises.set(asset_type, promise);
  }
  /**
   *
   */
  get_loading_promise(asset_type) {
    return this.loading_promises.get(asset_type);
  }
  /**
   *
   */
  has_loading_promise(asset_type) {
    return this.loading_promises.has(asset_type);
  }
  /**
   *
   */
  delete_loading_promise(asset_type) {
    this.loading_promises.delete(asset_type);
  }
  /**
   *
   */
  store_dynamic_body(instance_id, body_pair) {
    if (BLORKPACK_FLAGS.PHYSICS_LOGS) console.log(`Storing dynamic body: ${instance_id}`);
    this.dynamic_bodies.set(instance_id, body_pair);
  }
  /**
   *
   */
  get_dynamic_body(instance_id) {
    return this.dynamic_bodies.get(instance_id);
  }
  /**
   *
   */
  get_all_dynamic_bodies() {
    return Array.from(this.dynamic_bodies.values());
  }
  /**
   *
   */
  get_body_pair_by_mesh(mesh) {
    for (const [id, [object_mesh, body]] of this.dynamic_bodies.entries()) {
      if (object_mesh === mesh) {
        return [object_mesh, body];
      }
      if (object_mesh.children && object_mesh.children.includes(mesh)) {
        return [object_mesh, body];
      }
      let foundInHierarchy = false;
      object_mesh.traverse((child) => {
        if (child === mesh) {
          foundInHierarchy = true;
        }
      });
      if (foundInHierarchy) {
        return [object_mesh, body];
      }
    }
    const meshName = mesh.name;
    for (const [id, [object_mesh, body]] of this.dynamic_bodies.entries()) {
      if (object_mesh.name === meshName) {
        return [object_mesh, body];
      }
    }
    return null;
  }
  /**
   *
   */
  store_static_mesh(instance_id, mesh) {
    this.static_meshes.set(instance_id, mesh);
  }
  /**
   *
   */
  get_static_mesh(instance_id) {
    return this.static_meshes.get(instance_id);
  }
  /**
   *
   */
  get_all_static_meshes() {
    return Array.from(this.static_meshes.values());
  }
  /**
   *
   */
  store_material(key, material) {
    this.material_cache.set(key, material);
  }
  /**
   *
   */
  get_material(key, originalMaterial) {
    if (this.has_material(key)) {
      return this.material_cache.get(key);
    }
    if (originalMaterial) {
      const material2 = originalMaterial.clone();
      this.store_material(key, material2);
      return material2;
    }
    const material = new THREE.MeshStandardMaterial();
    this.store_material(key, material);
    return material;
  }
  /**
   *
   */
  has_material(key) {
    return this.material_cache.has(key);
  }
  /**
   *
   */
  set_emission_state(object_name, state) {
    this.emission_states.set(object_name, state);
  }
  /**
   *
   */
  get_emission_state(object_name) {
    return this.emission_states.get(object_name);
  }
  /**
   *
   */
  delete_emission_state(object_name) {
    this.emission_states.delete(object_name);
  }
  /**
   *
   */
  set_currently_activated_name(name) {
    this.currently_activated_name = name;
  }
  /**
   *
   */
  get_currently_activated_name() {
    return this.currently_activated_name;
  }
  /**
   *
   */
  contains_object(object_name) {
    return this.emission_states.has(object_name);
  }
  /**
      * Gets all assets (both dynamic bodies and static meshes).
      * @returns {Array} Array of all assets.
      */
  get_all_assets() {
    const dynamic = this.get_all_dynamic_bodies().map(([mesh, body]) => {
      var _a2;
      return {
        mesh,
        body,
        type: ((_a2 = mesh.userData) == null ? void 0 : _a2.type) || "unknown"
      };
    });
    const static_meshes = this.get_all_static_meshes().map((mesh) => {
      var _a2;
      return {
        mesh,
        body: null,
        type: ((_a2 = mesh.userData) == null ? void 0 : _a2.type) || "unknown"
      };
    });
    return [...dynamic, ...static_meshes];
  }
};
_assetConfigs = new WeakMap();
__publicField(_AssetStorage, "instance", null);
let AssetStorage = _AssetStorage;
const _AssetActivator = class _AssetActivator {
  /**
   *
   */
  constructor(camera, renderer) {
    __publicField(this, "name", "[AssetActivator]");
    __publicField(this, "activations", /* @__PURE__ */ new Map());
    // Cache the CustomTypeManager types
    __privateAdd(this, _assetTypes, null);
    if (_AssetActivator.instance) {
      return _AssetActivator.instance;
    }
    this.camera = camera;
    this.renderer = renderer;
    this.storage = AssetStorage.get_instance();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.active_objects = /* @__PURE__ */ new Set();
    __privateSet(this, _assetTypes, CustomTypeManager$1.getTypes());
    _AssetActivator.instance = this;
  }
  /**
      * Gets or creates the singleton instance of AssetActivator.
      * @param {THREE.Camera} camera - The camera for raycasting.
      * @param {THREE.WebGLRenderer} renderer - The renderer.
      * @returns {AssetActivator} The singleton instance.
      */
  static get_instance(camera, renderer) {
    if (!_AssetActivator.instance) {
      _AssetActivator.instance = new _AssetActivator(camera, renderer);
    } else {
      if (camera) _AssetActivator.instance.camera = camera;
      if (renderer) _AssetActivator.instance.renderer = renderer;
    }
    return _AssetActivator.instance;
  }
  /**
      * Checks if a mesh has active emission properties.
      * @param {THREE.Mesh|THREE.Object3D} mesh - The mesh to check for emission.
      * @returns {boolean} True if the mesh has active emission properties.
      */
  is_mesh_emissive(mesh) {
    if (!mesh) return false;
    let has_emissive = false;
    const check_material = (material) => {
      return material && material.emissive && material.emissiveIntensity > 0 && material.emissiveIntensity === 9;
    };
    if (mesh.isGroup || mesh.isObject3D) {
      mesh.traverse((child) => {
        if (child.isMesh && !child.name.startsWith("col_")) {
          if (check_material(child.material)) {
            has_emissive = true;
          }
        }
      });
    } else if (mesh.isMesh) {
      has_emissive = check_material(mesh.material);
    }
    return has_emissive;
  }
  /**
      * Activates an object in the scene, applying emission effects.
      * @param {string} object_name - The name of the object to activate.
      * @returns {boolean} True if activation was successful.
      */
  activate_object(object_name) {
    if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Activating: ${object_name}`);
    if (!this.storage.contains_object(object_name)) {
      if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object not found: ${object_name}`);
      return false;
    }
    if (this.storage.get_currently_activated_name() === object_name) {
      if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object already activated: ${object_name}`);
      return true;
    }
    const mesh = this.storage.get_static_mesh(object_name);
    if (!mesh) {
      if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Mesh not found for: ${object_name}`);
      return false;
    }
    mesh.traverse((child) => {
      if (child.isMesh && !child.name.startsWith("col_")) {
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (material.emissive) {
              if (!material._originalEmissive) {
                material._originalEmissive = material.emissive.clone();
                material._originalEmissiveIntensity = material.emissiveIntensity;
              }
              material.emissive.set(16777215);
              material.emissiveIntensity = 9;
            }
          });
        }
      }
    });
    this.storage.set_emission_state(object_name, true);
    this.storage.set_currently_activated_name(object_name);
    this.active_objects.add(object_name);
    return true;
  }
  /**
      * Deactivates an object, removing emission effects.
      * @param {string} object_name - The name of the object to deactivate.
      * @returns {boolean} True if deactivation was successful.
      */
  deactivate_object(object_name) {
    if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating: ${object_name}`);
    if (!this.storage.contains_object(object_name)) {
      return false;
    }
    const mesh = this.storage.get_static_mesh(object_name);
    if (!mesh) {
      return false;
    }
    mesh.traverse((child) => {
      if (child.isMesh && !child.name.startsWith("col_")) {
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (material.emissive && material._originalEmissive) {
              material.emissive.copy(material._originalEmissive);
              material.emissiveIntensity = material._originalEmissiveIntensity || 0;
            }
          });
        }
      }
    });
    this.storage.set_emission_state(object_name, false);
    if (this.storage.get_currently_activated_name() === object_name) {
      this.storage.set_currently_activated_name("");
    }
    this.active_objects.delete(object_name);
    return true;
  }
  /**
      * Deactivates all currently active objects.
      * @returns {void}
      */
  deactivate_all_objects() {
    if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating all objects`);
    const activeObjectsCopy = new Set(this.active_objects);
    activeObjectsCopy.forEach((object_name) => {
      this.deactivate_object(object_name);
    });
  }
  /**
      * Handles mouse movement for interaction.
      * @param {MouseEvent} event - The mouse event.
      */
  onMouseMove(event) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  /**
      * Performs a raycast to find intersected objects.
      * @param {THREE.Scene} scene - The scene to raycast against.
      * @returns {Array} Array of intersected objects.
      */
  raycast(scene) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(scene.children, true);
  }
  /**
      * Cleans up resources and resets state.
      */
  cleanup() {
    this.deactivate_all_objects();
    this.active_objects.clear();
    _AssetActivator.instance = null;
  }
};
_assetTypes = new WeakMap();
__publicField(_AssetActivator, "instance", null);
let AssetActivator = _AssetActivator;
class SystemAssetType {
  /**
      * Checks if the provided asset type string matches a system asset type.
      * @param {string} typeValue - The asset type string to check
      * @returns {boolean} True if the type is a system asset type
      */
  static isSystemAssetType(typeValue) {
    return Object.values(this).some((type) => type.value === typeValue);
  }
  /**
      * Gets the system asset type enum object from a string value.
      * @param {string} typeValue - The string value to convert to an enum
      * @returns {Object|null} The enum object or null if not found
      */
  static fromValue(typeValue) {
    return Object.values(this).find((type) => type.value === typeValue) || null;
  }
}
__publicField(SystemAssetType, "PRIMITIVE_BOX", { value: "primitive_box" });
__publicField(SystemAssetType, "PRIMITIVE_SPHERE", { value: "primitive_sphere" });
__publicField(SystemAssetType, "PRIMITIVE_CAPSULE", { value: "primitive_capsule" });
__publicField(SystemAssetType, "PRIMITIVE_CYLINDER", { value: "primitive_cylinder" });
__publicField(SystemAssetType, "SPOTLIGHT", { value: "spotlight" });
// TODO Create spawner for camera
__publicField(SystemAssetType, "CAMERA", { value: "camera" });
const _IdGenerator = class _IdGenerator {
  /**
   *
   */
  constructor() {
    if (_IdGenerator.instance) {
      return _IdGenerator.instance;
    }
    this.counter = 0;
    _IdGenerator.instance = this;
  }
  /**
      * Gets or creates the singleton instance of IdGenerator.
      * @returns {IdGenerator} The singleton instance.
      */
  static get_instance() {
    if (!_IdGenerator.instance) {
      _IdGenerator.instance = new _IdGenerator();
    }
    return _IdGenerator.instance;
  }
  /**
      * Generates a unique asset ID using timestamp and random numbers.
      * @returns {string} A unique ID string
      */
  generate_asset_id() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1e4);
    return `asset_${timestamp}_${random}`;
  }
  /**
      * Generates a unique numeric ID.
      * @returns {number} A unique numeric ID
      */
  generate_numeric_id() {
    return ++this.counter;
  }
  /**
      * Generates a unique ID with a custom prefix.
      * @param {string} prefix - The prefix to use for the ID
      * @returns {string} A unique ID string with the specified prefix
      */
  generate_prefixed_id(prefix) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1e4);
    return `${prefix}_${timestamp}_${random}`;
  }
};
__publicField(_IdGenerator, "instance", null);
let IdGenerator = _IdGenerator;
async function create_primitive_box(scene, world, width, height, depth, position, rotation, options = {}) {
  var _a2, _b2, _c;
  position = position || new THREE.Vector3();
  let quaternion;
  if (rotation instanceof THREE.Quaternion) {
    quaternion = rotation;
  } else if (rotation instanceof THREE.Euler) {
    quaternion = new THREE.Quaternion().setFromEuler(rotation);
  } else {
    quaternion = new THREE.Quaternion();
  }
  const geometry = new THREE.BoxGeometry(width, height, depth);
  let color_value = options.color || 8421504;
  if (typeof color_value === "string") {
    if (color_value.startsWith("0x")) {
      color_value = parseInt(color_value, 16);
    } else if (color_value.startsWith("#")) {
      color_value = parseInt(color_value.substring(1), 16);
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: color_value,
    transparent: options.opacity < 1,
    opacity: options.opacity || 1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.quaternion.copy(quaternion);
  mesh.castShadow = options.cast_shadow || false;
  mesh.receiveShadow = options.receive_shadow || false;
  await new Promise((resolve) => setTimeout(resolve, 0));
  scene.add(mesh);
  if (options.raycast_disabled) {
    mesh.raycast = () => null;
  }
  let body = null;
  if (options.collidable !== false) {
    let body_desc;
    if (options.mass <= 0 || options.gravity === false) {
      body_desc = RAPIER.RigidBodyDesc.fixed();
    } else {
      body_desc = RAPIER.RigidBodyDesc.dynamic().setMass(options.mass).setCanSleep(options.sleeping !== false);
    }
    body_desc.setTranslation(position.x, position.y, position.z);
    body_desc.setRotation({
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w
    });
    body = world.createRigidBody(body_desc);
    let collider_desc;
    const collider_width = ((_a2 = options.collider_dimensions) == null ? void 0 : _a2.width) !== void 0 ? options.collider_dimensions.width : width / 2;
    const collider_height = ((_b2 = options.collider_dimensions) == null ? void 0 : _b2.height) !== void 0 ? options.collider_dimensions.height : height / 2;
    const collider_depth = ((_c = options.collider_dimensions) == null ? void 0 : _c.depth) !== void 0 ? options.collider_dimensions.depth : depth / 2;
    collider_desc = RAPIER.ColliderDesc.cuboid(collider_width, collider_height, collider_depth);
    collider_desc.setRestitution(options.restitution || 0.5);
    collider_desc.setFriction(options.friction || 0.5);
    world.createCollider(collider_desc, body);
  }
  const instance_id = IdGenerator.get_instance().generate_asset_id();
  return {
    mesh,
    body,
    instance_id,
    type: SystemAssetType.PRIMITIVE_BOX.value,
    options
  };
}
async function create_primitive_sphere(scene, world, id, radius, position, rotation, options = {}) {
  position = position || new THREE.Vector3();
  rotation = rotation || new THREE.Quaternion();
  if (BLORKPACK_FLAGS.ASSET_LOGS) {
    console.log(`Creating primitive sphere for ${id} with radius: ${radius}`);
  }
  const geometry = new THREE.SphereGeometry(radius, 32, 24);
  let color_value = options.color || 8421504;
  if (typeof color_value === "string") {
    if (color_value.startsWith("0x")) {
      color_value = parseInt(color_value, 16);
    } else if (color_value.startsWith("#")) {
      color_value = parseInt(color_value.substring(1), 16);
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: color_value,
    transparent: options.opacity < 1,
    opacity: options.opacity || 1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.quaternion.copy(rotation);
  mesh.castShadow = options.cast_shadow || false;
  mesh.receiveShadow = options.receive_shadow || false;
  await new Promise((resolve) => setTimeout(resolve, 0));
  scene.add(mesh);
  if (options.raycast_disabled) {
    mesh.raycast = () => null;
  }
  let body = null;
  if (options.collidable !== false && world) {
    let body_desc;
    if (options.mass <= 0 || options.gravity === false) {
      body_desc = RAPIER.RigidBodyDesc.fixed();
    } else {
      body_desc = RAPIER.RigidBodyDesc.dynamic().setMass(options.mass).setCanSleep(options.sleeping !== false);
    }
    body_desc.setTranslation(position.x, position.y, position.z);
    body_desc.setRotation({
      x: rotation.x,
      y: rotation.y,
      z: rotation.z,
      w: rotation.w
    });
    body = world.createRigidBody(body_desc);
    const collider_desc = RAPIER.ColliderDesc.ball(radius);
    collider_desc.setRestitution(options.restitution || 0.5);
    collider_desc.setFriction(options.friction || 0.5);
    world.createCollider(collider_desc, body);
  }
  const instance_id = IdGenerator.get_instance().generate_asset_id();
  return {
    mesh,
    body,
    instance_id,
    type: SystemAssetType.PRIMITIVE_SPHERE.value,
    options
  };
}
async function create_primitive_capsule(scene, world, id, radius, height, position, rotation, options = {}) {
  position = position || new THREE.Vector3();
  rotation = rotation || new THREE.Quaternion();
  if (BLORKPACK_FLAGS.ASSET_LOGS) {
    console.log(`Creating primitive capsule for ${id} with radius: ${radius}, height: ${height}`);
  }
  const geometry = new THREE.CapsuleGeometry(radius, height, 16, 32);
  let color_value = options.color || 8421504;
  if (typeof color_value === "string") {
    if (color_value.startsWith("0x")) {
      color_value = parseInt(color_value, 16);
    } else if (color_value.startsWith("#")) {
      color_value = parseInt(color_value.substring(1), 16);
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: color_value,
    transparent: options.opacity < 1,
    opacity: options.opacity || 1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.quaternion.copy(rotation);
  mesh.castShadow = options.cast_shadow || false;
  mesh.receiveShadow = options.receive_shadow || false;
  await new Promise((resolve) => setTimeout(resolve, 0));
  scene.add(mesh);
  if (options.raycast_disabled) {
    mesh.raycast = () => null;
  }
  let body = null;
  if (options.collidable !== false && world) {
    let body_desc;
    if (options.mass <= 0 || options.gravity === false) {
      body_desc = RAPIER.RigidBodyDesc.fixed();
    } else {
      body_desc = RAPIER.RigidBodyDesc.dynamic().setMass(options.mass).setCanSleep(options.sleeping !== false);
    }
    body_desc.setTranslation(position.x, position.y, position.z);
    body_desc.setRotation({
      x: rotation.x,
      y: rotation.y,
      z: rotation.z,
      w: rotation.w
    });
    body = world.createRigidBody(body_desc);
    const collider_desc = RAPIER.ColliderDesc.capsule(height / 2, radius);
    collider_desc.setRestitution(options.restitution || 0.5);
    collider_desc.setFriction(options.friction || 0.5);
    world.createCollider(collider_desc, body);
  }
  const instance_id = IdGenerator.get_instance().generate_asset_id();
  return {
    mesh,
    body,
    instance_id,
    type: SystemAssetType.PRIMITIVE_CAPSULE.value,
    options
  };
}
async function create_primitive_cylinder(scene, world, id, radius, height, position, rotation, options = {}) {
  position = position || new THREE.Vector3();
  rotation = rotation || new THREE.Quaternion();
  if (BLORKPACK_FLAGS.ASSET_LOGS) {
    console.log(`Creating primitive cylinder for ${id} with radius: ${radius}, height: ${height}`);
  }
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
  let color_value = options.color || 8421504;
  if (typeof color_value === "string") {
    if (color_value.startsWith("0x")) {
      color_value = parseInt(color_value, 16);
    } else if (color_value.startsWith("#")) {
      color_value = parseInt(color_value.substring(1), 16);
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: color_value,
    transparent: options.opacity < 1,
    opacity: options.opacity || 1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.quaternion.copy(rotation);
  mesh.castShadow = options.cast_shadow || false;
  mesh.receiveShadow = options.receive_shadow || false;
  await new Promise((resolve) => setTimeout(resolve, 0));
  scene.add(mesh);
  if (options.raycast_disabled) {
    mesh.raycast = () => null;
  }
  let body = null;
  if (options.collidable !== false && world) {
    let body_desc;
    if (options.mass <= 0 || options.gravity === false) {
      body_desc = RAPIER.RigidBodyDesc.fixed();
    } else {
      body_desc = RAPIER.RigidBodyDesc.dynamic().setMass(options.mass).setCanSleep(options.sleeping !== false);
    }
    body_desc.setTranslation(position.x, position.y, position.z);
    body_desc.setRotation({
      x: rotation.x,
      y: rotation.y,
      z: rotation.z,
      w: rotation.w
    });
    body = world.createRigidBody(body_desc);
    const collider_desc = RAPIER.ColliderDesc.cylinder(height / 2, radius);
    collider_desc.setRestitution(options.restitution || 0.5);
    collider_desc.setFriction(options.friction || 0.5);
    world.createCollider(collider_desc, body);
  }
  const instance_id = IdGenerator.get_instance().generate_asset_id();
  return {
    mesh,
    body,
    instance_id,
    type: SystemAssetType.PRIMITIVE_CYLINDER.value,
    options
  };
}
const UNLIMITED_SPOTLIGHT_DEBUG_LENGTH = 400;
async function create_spotlight(scene, id, position, rotation, options = {}, asset_data = {}) {
  var _a2, _b2, _c, _d, _e, _f;
  if (BLORKPACK_FLAGS.ASSET_LOGS) {
    console.log(`Creating spotlight for ${id}`);
  }
  const color = parseInt(options.color || "0xffffff", 16);
  const intensity = ((_a2 = asset_data == null ? void 0 : asset_data.additional_properties) == null ? void 0 : _a2.intensity) || options.intensity || 0.3;
  const max_distance = ((_b2 = asset_data == null ? void 0 : asset_data.additional_properties) == null ? void 0 : _b2.max_distance) || options.max_distance || 0;
  const angle = ((_c = asset_data == null ? void 0 : asset_data.additional_properties) == null ? void 0 : _c.angle) || options.angle || Math.PI / 8;
  const penumbra = ((_d = asset_data == null ? void 0 : asset_data.additional_properties) == null ? void 0 : _d.penumbra) || options.penumbra || 0.1;
  const sharpness = ((_e = asset_data == null ? void 0 : asset_data.additional_properties) == null ? void 0 : _e.sharpness) || options.sharpness || 0.5;
  if (BLORKPACK_FLAGS.ASSET_LOGS) {
    console.log(`Spotlight properties: color=${color.toString(16)}, intensity=${intensity}, max_distance=${max_distance}, angle=${angle}, penumbra=${penumbra}, sharpness=${sharpness}`);
  }
  try {
    const spotlight = new THREE.SpotLight(
      color,
      intensity,
      max_distance,
      angle,
      penumbra,
      sharpness
    );
    spotlight.position.copy(position);
    if (options.cast_shadow) {
      spotlight.castShadow = true;
      if ((_f = asset_data == null ? void 0 : asset_data.additional_properties) == null ? void 0 : _f.shadow) {
        const shadow_props = asset_data.additional_properties.shadow;
        if (shadow_props.map_size) {
          spotlight.shadow.mapSize.width = shadow_props.map_size.width || 2048;
          spotlight.shadow.mapSize.height = shadow_props.map_size.height || 2048;
        }
        if (shadow_props.blur_samples) {
          spotlight.shadow.blurSamples = shadow_props.blur_samples;
        }
        if (shadow_props.radius !== void 0) {
          spotlight.shadow.radius = shadow_props.radius;
        }
        if (shadow_props.camera) {
          spotlight.shadow.camera.near = shadow_props.camera.near || 10;
          spotlight.shadow.camera.far = shadow_props.camera.far || 100;
          spotlight.shadow.camera.fov = shadow_props.camera.fov || 30;
        }
        if (shadow_props.bias !== void 0) {
          spotlight.shadow.bias = shadow_props.bias;
        }
        if (shadow_props.normal_bias !== void 0) {
          spotlight.shadow.normalBias = shadow_props.normal_bias;
        }
      } else {
        spotlight.shadow.blurSamples = 32;
        spotlight.shadow.radius = 4;
        spotlight.shadow.mapSize.width = 2048;
        spotlight.shadow.mapSize.height = 2048;
        spotlight.shadow.camera.near = 10;
        spotlight.shadow.camera.far = 100;
        spotlight.shadow.camera.fov = 30;
        spotlight.shadow.bias = -2e-3;
        spotlight.shadow.normalBias = 0.02;
      }
    }
    const target = new THREE.Object3D();
    let hasCustomTarget = false;
    if ((asset_data == null ? void 0 : asset_data.target) && asset_data.target.position) {
      target.position.set(
        asset_data.target.position.x || 0,
        asset_data.target.position.y || 0,
        asset_data.target.position.z || 0
      );
      hasCustomTarget = true;
    } else {
      const targetDistance = 100;
      let rotX, rotY;
      if (rotation instanceof THREE.Euler) {
        rotX = rotation.x || 0;
        rotY = rotation.y || 0;
      } else {
        rotX = rotation.x || 0;
        rotY = rotation.y || 0;
      }
      const x = Math.sin(rotY) * Math.cos(rotX) * targetDistance;
      const y = Math.sin(rotX) * targetDistance;
      const z = Math.cos(rotY) * Math.cos(rotX) * targetDistance;
      target.position.set(
        position.x + x,
        position.y + y,
        position.z + z
      );
      hasCustomTarget = false;
    }
    spotlight.target = target;
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      scene.add(spotlight);
      scene.add(target);
    } catch (sceneError) {
      console.error(`Error adding spotlight to scene:`, sceneError);
    }
    spotlight.userData = {
      ...spotlight.userData,
      type: SystemAssetType.SPOTLIGHT.value,
      hasCustomTarget
    };
    if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
      const helpers = await create_spotlight_helper(scene, spotlight);
      spotlight.userData.debugHelpers = helpers;
    }
    const asset_object = {
      mesh: spotlight,
      body: null,
      // No physics for lights
      objects: [spotlight, target],
      type: SystemAssetType.SPOTLIGHT.value
    };
    try {
      const storage = AssetStorage.get_instance();
      const spotlight_id = storage.get_new_instance_id();
      storage.store_static_mesh(spotlight_id, spotlight);
      spotlight.userData.type = SystemAssetType.SPOTLIGHT.value;
      spotlight.userData.id = id;
      spotlight.userData.instanceId = spotlight_id;
    } catch (storageError) {
      console.error(`Error storing spotlight in asset storage:`, storageError);
    }
    return asset_object;
  } catch (spotlightError) {
    console.error(`ERROR CREATING SPOTLIGHT: ${id}`, spotlightError);
    return null;
  }
}
async function create_spotlight_helper(scene, spotlight) {
  if (!spotlight) {
    console.error(`Cannot create helper: spotlight is null or undefined`);
    return null;
  }
  const sharedDebugMaterials = {
    helper: new THREE.LineBasicMaterial({ color: 65280 }),
    cone: new THREE.MeshBasicMaterial({
      color: 65280,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    })
  };
  const helper = new THREE.SpotLightHelper(spotlight);
  helper.material = sharedDebugMaterials.helper;
  helper.visible = BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG;
  const originalUpdate = helper.update;
  helper.update = () => {
    originalUpdate.call(helper);
    helper.traverse((child) => {
      if (child.material && child !== helper) {
        child.material = sharedDebugMaterials.helper;
      }
    });
  };
  helper.raycast = () => null;
  helper.traverse((child) => {
    child.raycast = () => null;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  scene.add(helper);
  const spotlightToTarget = new THREE.Vector3().subVectors(
    spotlight.target.position,
    spotlight.position
  );
  spotlightToTarget.length();
  let height;
  if (spotlight.distance > 0) {
    height = spotlight.distance;
  } else {
    height = UNLIMITED_SPOTLIGHT_DEBUG_LENGTH;
  }
  const radius = Math.tan(spotlight.angle) * height;
  const geometry = new THREE.ConeGeometry(radius, height, 32, 32, true);
  geometry.translate(0, -height / 2, 0);
  const cone = new THREE.Mesh(geometry, sharedDebugMaterials.cone);
  cone.visible = BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG;
  cone.raycast = () => null;
  cone.traverse((child) => {
    child.raycast = () => null;
  });
  cone.position.copy(spotlight.position);
  const direction = spotlightToTarget.normalize();
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
  cone.quaternion.copy(quaternion);
  await new Promise((resolve) => setTimeout(resolve, 0));
  scene.add(cone);
  return {
    helper,
    cone
  };
}
async function update_helpers(scene) {
  if (!scene) return;
  const spotlights = [];
  scene.traverse((obj) => {
    if (obj.type === "SpotLight") {
      spotlights.push(obj);
    }
  });
  spotlights.forEach((spotlight) => {
    if (spotlight.userData.debugHelpers) {
      const { helper, cone } = spotlight.userData.debugHelpers;
      if (helper) {
        helper.update();
        helper.visible = BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG;
      }
      if (cone) {
        cone.position.copy(spotlight.position);
        const spotlightToTarget = new THREE.Vector3().subVectors(
          spotlight.target.position,
          spotlight.position
        );
        const direction = spotlightToTarget.normalize();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
        cone.quaternion.copy(quaternion);
        cone.visible = BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG;
      }
    }
  });
}
const spotlight_spawner = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  create_spotlight,
  update_helpers
}, Symbol.toStringTag, { value: "Module" }));
const _SystemFactory = class _SystemFactory {
  /**
   *
   */
  constructor(scene, world) {
    if (_SystemFactory.instance) {
      return _SystemFactory.instance;
    }
    this.scene = scene;
    this.world = world;
    _SystemFactory.instance = this;
  }
  /**
      * Gets or creates the singleton instance of SystemFactory.
      * @param {THREE.Scene} scene - The Three.js scene to add objects to.
      * @param {RAPIER.World} world - The Rapier physics world.
      * @returns {SystemFactory} The singleton instance.
      */
  static get_instance(scene, world) {
    if (!_SystemFactory.instance) {
      _SystemFactory.instance = new _SystemFactory(scene, world);
    } else {
      if (scene) _SystemFactory.instance.scene = scene;
      if (world) _SystemFactory.instance.world = world;
    }
    return _SystemFactory.instance;
  }
  /**
      * Spawns assets from the manifest's system_assets array.
      * This method handles system-level assets defined in the manifest.
      * 
      * @param {Object} manifest_manager - Instance of ManifestManager
      * @param {Function} progress_callback - Optional callback function for progress updates
      * @returns {Promise<Array>} Array of spawned system assets
      */
  async spawn_system_assets(manifest_manager, progress_callback = null) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q2, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E;
    const spawned_assets = [];
    try {
      const system_assets = manifest_manager.get_system_assets();
      if (!system_assets || system_assets.length === 0) {
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
          console.log("No system assets found in manifest");
        }
        return spawned_assets;
      }
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Found ${system_assets.length} system assets to spawn`);
      }
      for (const asset_data of system_assets) {
        if (progress_callback) {
          progress_callback(`Loading system asset: ${asset_data.id}...`);
        }
        const asset_type_str = asset_data.asset_type;
        let asset_type = asset_type_str;
        if (SystemAssetType.isSystemAssetType(asset_type_str)) {
          asset_type = SystemAssetType.fromValue(asset_type_str);
        }
        const position = new THREE.Vector3(
          ((_a2 = asset_data.position) == null ? void 0 : _a2.x) || 0,
          ((_b2 = asset_data.position) == null ? void 0 : _b2.y) || 0,
          ((_c = asset_data.position) == null ? void 0 : _c.z) || 0
        );
        const rotation = new THREE.Euler(
          ((_d = asset_data.rotation) == null ? void 0 : _d.x) || 0,
          ((_e = asset_data.rotation) == null ? void 0 : _e.y) || 0,
          ((_f = asset_data.rotation) == null ? void 0 : _f.z) || 0
        );
        const quaternion = new THREE.Quaternion().setFromEuler(rotation);
        const options = {
          // Asset configuration
          collidable: ((_g = asset_data.config) == null ? void 0 : _g.collidable) !== void 0 ? asset_data.config.collidable : true,
          hidden: ((_h = asset_data.config) == null ? void 0 : _h.hidden) !== void 0 ? asset_data.config.hidden : false,
          disabled: ((_i = asset_data.config) == null ? void 0 : _i.disabled) !== void 0 ? asset_data.config.disabled : false,
          sleeping: ((_j = asset_data.config) == null ? void 0 : _j.sleeping) !== void 0 ? asset_data.config.sleeping : true,
          gravity: ((_k = asset_data.config) == null ? void 0 : _k.gravity) !== void 0 ? asset_data.config.gravity : true,
          interactable: ((_l = asset_data.config) == null ? void 0 : _l.interactable) !== void 0 ? asset_data.config.interactable : true,
          selectable: ((_m = asset_data.config) == null ? void 0 : _m.selectable) !== void 0 ? asset_data.config.selectable : true,
          highlightable: ((_n = asset_data.config) == null ? void 0 : _n.highlightable) !== void 0 ? asset_data.config.highlightable : true,
          // Properties from additional_properties
          color: ((_o = asset_data.additional_properties) == null ? void 0 : _o.color) || "0xffffff",
          cast_shadow: ((_p = asset_data.additional_properties) == null ? void 0 : _p.cast_shadows) !== void 0 ? asset_data.additional_properties.cast_shadows : false,
          receive_shadow: ((_q2 = asset_data.additional_properties) == null ? void 0 : _q2.receive_shadows) !== void 0 ? asset_data.additional_properties.receive_shadows : true,
          // Physics properties
          mass: ((_r = asset_data.additional_properties) == null ? void 0 : _r.mass) !== void 0 ? asset_data.additional_properties.mass : 1,
          restitution: ((_s = asset_data.additional_properties) == null ? void 0 : _s.restitution) !== void 0 ? asset_data.additional_properties.restitution : 0.5,
          friction: ((_t = asset_data.additional_properties) == null ? void 0 : _t.friction) !== void 0 ? asset_data.additional_properties.friction : 0.5,
          // Size properties
          dimensions: ((_u = asset_data.additional_properties) == null ? void 0 : _u.physical_dimensions) || {
            width: 1,
            height: 1,
            depth: 1
          },
          // Collider dimensions if specified
          collider_dimensions: (_v = asset_data.additional_properties) == null ? void 0 : _v.collider_dimensions,
          // Additional properties
          custom_data: asset_data.additional_properties,
          raycast_disabled: (_w = asset_data.additional_properties) == null ? void 0 : _w.raycast_disabled
        };
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
          console.log(`Creating system asset: ${asset_data.id} (${asset_type_str})`, {
            position,
            dimensions: options.dimensions,
            color: options.color
          });
        }
        let result = null;
        const assetSpawner = AssetSpawner.get_instance();
        result = await assetSpawner.spawn_asset(
          asset_type,
          position,
          quaternion,
          // For non-Euler rotation types
          {
            ...options,
            id: asset_data.id,
            asset_data,
            rotation_euler: rotation
            // Store original Euler rotation if needed
          }
        );
        if (!result) {
          if (BLORKPACK_FLAGS.ASSET_LOGS) {
            console.warn(`Fallback to legacy system spawners for: ${asset_data.id} (${asset_type_str})`);
          }
          if (asset_type_str === SystemAssetType.PRIMITIVE_BOX.value) {
            result = await create_primitive_box(
              this.scene,
              this.world,
              options.dimensions.width,
              options.dimensions.height,
              options.dimensions.depth,
              position,
              quaternion,
              options
            );
          } else if (asset_type_str === SystemAssetType.SPOTLIGHT.value) {
            result = await create_spotlight(
              this.scene,
              asset_data.id,
              position,
              rotation,
              options,
              asset_data
            );
          } else if (asset_type_str === SystemAssetType.PRIMITIVE_SPHERE.value) {
            const radius = ((_x = options.dimensions) == null ? void 0 : _x.radius) || ((_y = options.dimensions) == null ? void 0 : _y.width) / 2 || 0.5;
            result = await create_primitive_sphere(
              this.scene,
              this.world,
              asset_data.id,
              radius,
              position,
              quaternion,
              options
            );
          } else if (asset_type_str === SystemAssetType.PRIMITIVE_CAPSULE.value) {
            const radius = ((_z = options.dimensions) == null ? void 0 : _z.radius) || ((_A = options.dimensions) == null ? void 0 : _A.width) / 2 || 0.5;
            const height = ((_B = options.dimensions) == null ? void 0 : _B.height) || 1;
            result = await create_primitive_capsule(
              this.scene,
              this.world,
              asset_data.id,
              radius,
              height,
              position,
              quaternion,
              options
            );
          } else if (asset_type_str === SystemAssetType.PRIMITIVE_CYLINDER.value) {
            const radius = ((_C = options.dimensions) == null ? void 0 : _C.radius) || ((_D = options.dimensions) == null ? void 0 : _D.width) / 2 || 0.5;
            const height = ((_E = options.dimensions) == null ? void 0 : _E.height) || 1;
            result = await create_primitive_cylinder(
              this.scene,
              this.world,
              asset_data.id,
              radius,
              height,
              position,
              quaternion,
              options
            );
          }
        }
        if (result) {
          result.id = asset_data.id;
          result.asset_type = asset_type_str;
          spawned_assets.push(result);
          if (BLORKPACK_FLAGS.ASSET_LOGS) {
            console.log(`Spawned system asset: ${asset_data.id} (${asset_type_str})`);
          }
        }
      }
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Spawned ${spawned_assets.length} system assets from manifest`);
      }
      return spawned_assets;
    } catch (error) {
      console.error("Error spawning system assets:", error);
      return spawned_assets;
    }
  }
  /**
      * Spawns a system asset of the specified type at the given position with the given rotation.
      * @param {string|SystemAssetType} asset_type - The type of asset to spawn.
      * @param {THREE.Vector3} position - The position to spawn the asset at.
      * @param {THREE.Quaternion} rotation - The rotation of the asset.
      * @param {Object} options - Additional options for spawning.
      * @returns {Promise<Object>} A promise that resolves with the spawned asset details.
      * @throws {Error} If the requested system type is not supported
      */
  async spawn_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h;
    let type_value = typeof asset_type === "object" && asset_type.value ? asset_type.value : asset_type;
    if (!SystemAssetType.isSystemAssetType(type_value)) {
      throw new Error(`Requested type "${type_value}" is not a supported system asset type`);
    }
    const asset_type_enum = SystemAssetType.fromValue(type_value);
    switch (asset_type_enum) {
      case SystemAssetType.PRIMITIVE_BOX:
        const { width = 1, height = 1, depth = 1 } = options.dimensions || {};
        return create_primitive_box(
          this.scene,
          this.world,
          width,
          height,
          depth,
          position,
          rotation,
          options
        );
      case SystemAssetType.PRIMITIVE_SPHERE:
        const radius = ((_a2 = options.dimensions) == null ? void 0 : _a2.radius) || ((_b2 = options.dimensions) == null ? void 0 : _b2.width) / 2 || 0.5;
        return create_primitive_sphere(
          this.scene,
          this.world,
          options.id || IdGenerator.get_instance().generate_asset_id(),
          radius,
          position,
          rotation,
          options
        );
      case SystemAssetType.PRIMITIVE_CAPSULE:
        const capsuleRadius = ((_c = options.dimensions) == null ? void 0 : _c.radius) || ((_d = options.dimensions) == null ? void 0 : _d.width) / 2 || 0.5;
        const capsuleHeight = ((_e = options.dimensions) == null ? void 0 : _e.height) || 1;
        return create_primitive_capsule(
          this.scene,
          this.world,
          options.id || IdGenerator.get_instance().generate_asset_id(),
          capsuleRadius,
          capsuleHeight,
          position,
          rotation,
          options
        );
      case SystemAssetType.PRIMITIVE_CYLINDER:
        const cylinderRadius = ((_f = options.dimensions) == null ? void 0 : _f.radius) || ((_g = options.dimensions) == null ? void 0 : _g.width) / 2 || 0.5;
        const cylinderHeight = ((_h = options.dimensions) == null ? void 0 : _h.height) || 1;
        return create_primitive_cylinder(
          this.scene,
          this.world,
          options.id || IdGenerator.get_instance().generate_asset_id(),
          cylinderRadius,
          cylinderHeight,
          position,
          rotation,
          options
        );
      case SystemAssetType.SPOTLIGHT:
        return create_spotlight(
          this.scene,
          options.id || IdGenerator.get_instance().generate_asset_id(),
          position,
          rotation,
          options,
          options.asset_data || {}
        );
      default:
        throw new Error(`System asset type "${type_value}" is not supported`);
    }
  }
};
__publicField(_SystemFactory, "instance", null);
let SystemFactory = _SystemFactory;
const _CustomFactory = class _CustomFactory {
  /**
      * Constructor
      * @param {THREE.Scene} scene - The Three.js scene to add objects to
      * @param {RAPIER.World} world - The physics world
      */
  constructor(scene = null, world = null) {
    __publicField(this, "storage");
    __publicField(this, "scene");
    __publicField(this, "world");
    // Cache the types and configs from CustomTypeManager
    __privateAdd(this, _assetTypes2, null);
    __privateAdd(this, _assetConfigs2, null);
    if (__privateGet(_CustomFactory, _instance)) {
      throw new Error("CustomFactory is a singleton. Use CustomFactory.get_instance() instead.");
    }
    this.storage = AssetStorage.get_instance();
    this.scene = scene;
    this.world = world;
    __privateSet(this, _assetTypes2, CustomTypeManager$1.getTypes());
    __privateSet(this, _assetConfigs2, CustomTypeManager$1.getConfigs());
    __privateSet(_CustomFactory, _instance, this);
    __privateSet(_CustomFactory, _disposed, false);
  }
  /**
      * Gets or creates the singleton instance of CustomFactory
      * @param {THREE.Scene} scene - The Three.js scene to add objects to
      * @param {RAPIER.World} world - The physics world
      * @returns {CustomFactory} The singleton instance
      */
  static get_instance(scene, world) {
    if (__privateGet(_CustomFactory, _disposed)) {
      __privateSet(_CustomFactory, _instance, null);
      __privateSet(_CustomFactory, _disposed, false);
    }
    if (!__privateGet(_CustomFactory, _instance)) {
      __privateSet(_CustomFactory, _instance, new _CustomFactory(scene, world));
    } else if (scene || world) {
      if (scene) __privateGet(_CustomFactory, _instance).scene = scene;
      if (world) __privateGet(_CustomFactory, _instance).world = world;
    }
    return __privateGet(_CustomFactory, _instance);
  }
  /**
      * Dispose of the factory instance and clean up resources
      */
  dispose() {
    if (!__privateGet(_CustomFactory, _instance)) return;
    this.scene = null;
    this.world = null;
    this.storage = null;
    __privateSet(this, _assetTypes2, null);
    __privateSet(this, _assetConfigs2, null);
    __privateSet(_CustomFactory, _disposed, true);
    __privateSet(_CustomFactory, _instance, null);
  }
  /**
   *
   */
  static dispose_instance() {
    if (__privateGet(_CustomFactory, _instance)) {
      __privateGet(_CustomFactory, _instance).dispose();
    }
  }
  /**
      * Spawns a custom asset of the specified type at the given position with the given rotation
      * @param {string} asset_type - The type of asset to spawn
      * @param {THREE.Vector3} position - The position to spawn the asset at
      * @param {THREE.Quaternion} rotation - The rotation of the asset
      * @param {Object} options - Additional options for spawning
      * @returns {Promise<Object>} A promise that resolves with the spawned asset details
      */
  async spawn_custom_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
    try {
      if (!CustomTypeManager$1.hasLoadedCustomTypes()) {
        console.error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
        console.error(`Failed to spawn asset type: "${asset_type}"`);
        return null;
      }
      if (!CustomTypeManager$1.hasType(asset_type)) {
        console.error(`Unsupported asset type: "${asset_type}". Cannot spawn asset.`);
        console.error(`Available types:`, Object.keys(CustomTypeManager$1.getTypes()));
        return null;
      }
      const customTypeKey = CustomTypeManager$1.getType(asset_type);
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Spawning custom asset type: ${asset_type} (key: ${customTypeKey})`);
      }
      const gltfData = await this.storage.load_asset_type(customTypeKey);
      if (!gltfData) {
        console.error(`Failed to load custom asset type: ${customTypeKey}`);
        return null;
      }
      let asset_config = __privateGet(this, _assetConfigs2)[customTypeKey];
      if (!asset_config) {
        asset_config = CustomTypeManager$1.getConfig(customTypeKey);
        if (asset_config) {
          __privateGet(this, _assetConfigs2)[customTypeKey] = asset_config;
        } else {
          console.error(`No configuration found for custom asset type: ${customTypeKey}`);
          return null;
        }
      }
      const originalModel = gltfData.scene;
      const model = AssetUtils.cloneSkinnedMesh(originalModel);
      const scale = asset_config.scale || 1;
      model.scale.set(scale, scale, scale);
      model.position.copy(position);
      model.quaternion.copy(rotation);
      const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      model.name = `interactable_${customTypeKey}_${uniqueId}`;
      const collisionMeshes = [];
      const displayMeshes = [];
      model.traverse((child) => {
        if (child.isMesh) {
          if (child.name.startsWith("col_")) {
            child.visible = false;
            collisionMeshes.push(child);
          } else if (child.name.startsWith("display_")) {
            child.visible = true;
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
              console.log(`Setting display mesh ${child.name} to transparent by default`);
            }
            const displayMaterial = this.createDisplayMeshMaterial(0);
            child.material = displayMaterial;
            if (model.userData) {
              model.userData.currentDisplayImage = 0;
              if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Set userData.currentDisplayImage to 0 (transparent) for ${model.name}`);
              }
            }
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
              console.log(`Applied transparent material to display mesh: ${child.name} in ${customTypeKey}`);
            }
            displayMeshes.push(child);
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
              console.log(`Found display mesh: ${child.name} in ${customTypeKey}`);
            }
          } else {
            const childId = child.id || Math.floor(Math.random() * 1e4);
            child.name = `interactable_${customTypeKey}_${child.name || "part"}_${childId}`;
          }
        }
      });
      if (displayMeshes.length > 0) {
        model.userData.displayMeshes = displayMeshes;
        model.userData.switchDisplayImage = (imageIndex) => {
          if (imageIndex < 0 || imageIndex > 2) {
            console.error(`Invalid image index: ${imageIndex}. Must be between 0 and 2.`);
            return;
          }
          displayMeshes.forEach((mesh) => {
            if (mesh.material && mesh.material.map) {
              const texture = mesh.material.map;
              texture.offset.x = imageIndex / 3;
              texture.needsUpdate = true;
            }
          });
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      this.scene.add(model);
      model.userData.assetType = customTypeKey;
      let physicsBody = null;
      if (options.enablePhysics !== false && this.world) {
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z).setLinearDamping(0.5).setAngularDamping(0.6);
        rigidBodyDesc.setGravityScale(1);
        if (rotation) {
          rigidBodyDesc.setRotation(rotation);
        }
        physicsBody = this.world.createRigidBody(rigidBodyDesc);
        if (collisionMeshes.length > 0) {
          for (const collisionMesh of collisionMeshes) {
            await this.create_collider_from_mesh(collisionMesh, physicsBody, asset_config, options);
          }
        } else {
          const halfScale = asset_config.scale / 2;
          let collider_desc;
          if (options.colliderType === "sphere") {
            collider_desc = RAPIER.ColliderDesc.ball(halfScale);
          } else if (options.colliderType === "capsule") {
            collider_desc = RAPIER.ColliderDesc.capsule(halfScale, halfScale * 0.5);
          } else {
            collider_desc = RAPIER.ColliderDesc.cuboid(halfScale, halfScale, halfScale);
          }
          collider_desc.setRestitution(asset_config.restitution || 0.5);
          collider_desc.setFriction(asset_config.friction || 0.5);
          this.world.createCollider(collider_desc, physicsBody);
          if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
            try {
              await this.create_debug_wireframe(
                "box",
                { width: halfScale * 2, height: halfScale * 2, depth: halfScale * 2 },
                position,
                rotation,
                { color: 65280, opacity: 0.3, body: physicsBody }
              );
            } catch (error) {
              console.warn("Failed to create debug wireframe:", error);
            }
          }
        }
        if (BLORKPACK_FLAGS.PHYSICS_LOGS) {
          console.log(`Created physics body for ${customTypeKey} with mass: ${asset_config.mass || 1}, scale: ${scale}`);
        }
      }
      const instance_id = this.storage.add_object(model, physicsBody);
      return {
        mesh: model,
        body: physicsBody,
        instance_id
      };
    } catch (error) {
      console.error(`Error spawning custom asset ${asset_type}:`, error);
      return null;
    }
  }
  /**
      * Creates a collider from a mesh
      * @param {THREE.Mesh} mesh - The mesh to create a collider from
      * @param {RAPIER.RigidBody} body - The rigid body to attach the collider to
      * @param {Object} asset_config - Asset configuration data
      * @param {Object} [options={}] - Additional options for collider creation
      * @returns {Promise<RAPIER.Collider>} The created collider
      */
  async create_collider_from_mesh(mesh, body, asset_config, options = {}) {
    var _a2, _b2, _c;
    if (!mesh || !body) return null;
    const geometry = mesh.geometry;
    if (!geometry) return null;
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const meshScale = new THREE.Vector3();
    mesh.updateWorldMatrix(true, false);
    mesh.matrixWorld.decompose(position, quaternion, meshScale);
    const bodyPos = body.translation();
    const relativePos = {
      x: position.x - bodyPos.x,
      y: position.y - bodyPos.y,
      z: position.z - bodyPos.z
    };
    const box = geometry.boundingBox;
    const box_width = (box.max.x - box.min.x) * meshScale.x;
    const box_height = (box.max.y - box.min.y) * meshScale.y;
    const box_depth = (box.max.z - box.min.z) * meshScale.z;
    const localCenter = new THREE.Vector3();
    box.getCenter(localCenter);
    if (Math.abs(localCenter.x) > 1e-3 || Math.abs(localCenter.y) > 1e-3 || Math.abs(localCenter.z) > 1e-3) {
      const rotatedCenter = localCenter.clone().applyQuaternion(quaternion);
      relativePos.x += rotatedCenter.x * meshScale.x;
      relativePos.y += rotatedCenter.y * meshScale.y;
      relativePos.z += rotatedCenter.z * meshScale.z;
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Adjusted position for ${mesh.name} due to non-centered geometry:`, {
          localCenter: `${localCenter.x.toFixed(2)}, ${localCenter.y.toFixed(2)}, ${localCenter.z.toFixed(2)}`,
          rotatedCenter: `${rotatedCenter.x.toFixed(2)}, ${rotatedCenter.y.toFixed(2)}, ${rotatedCenter.z.toFixed(2)}`,
          newRelativePos: `${relativePos.x.toFixed(2)}, ${relativePos.y.toFixed(2)}, ${relativePos.z.toFixed(2)}`
        });
      }
    }
    if (BLORKPACK_FLAGS.ASSET_LOGS) {
      console.log(`Creating collider for ${mesh.name}:`, {
        worldPos: `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`,
        bodyPos: `${bodyPos.x.toFixed(2)}, ${bodyPos.y.toFixed(2)}, ${bodyPos.z.toFixed(2)}`,
        relativePos: `${relativePos.x.toFixed(2)}, ${relativePos.y.toFixed(2)}, ${relativePos.z.toFixed(2)}`,
        meshScale: `${meshScale.x.toFixed(2)}, ${meshScale.y.toFixed(2)}, ${meshScale.z.toFixed(2)}`
      });
    }
    let collider_desc;
    if (mesh.name.includes("sphere") || mesh.name.includes("ball")) {
      geometry.computeBoundingSphere();
      const radius = geometry.boundingSphere.radius * meshScale.x;
      collider_desc = RAPIER.ColliderDesc.ball(radius);
    } else if (mesh.name.includes("capsule")) {
      const height = (box.max.y - box.min.y) * meshScale.y;
      const radius = Math.max(
        box.max.x - box.min.x,
        box.max.z - box.min.z
      ) * meshScale.x * 0.5;
      collider_desc = RAPIER.ColliderDesc.capsule(height * 0.5, radius);
    } else {
      const collider_width = ((_a2 = options.collider_dimensions) == null ? void 0 : _a2.width) !== void 0 ? options.collider_dimensions.width : box_width / 2;
      const collider_height = ((_b2 = options.collider_dimensions) == null ? void 0 : _b2.height) !== void 0 ? options.collider_dimensions.height : box_height / 2;
      const collider_depth = ((_c = options.collider_dimensions) == null ? void 0 : _c.depth) !== void 0 ? options.collider_dimensions.depth : box_depth / 2;
      collider_desc = RAPIER.ColliderDesc.cuboid(collider_width, collider_height, collider_depth);
    }
    collider_desc.setTranslation(relativePos.x, relativePos.y, relativePos.z);
    collider_desc.setRotation(quaternion);
    if (asset_config.mass) {
      collider_desc.setMass(asset_config.mass);
    }
    if (asset_config.restitution) {
      collider_desc.setRestitution(asset_config.restitution);
    }
    collider_desc.setFriction(0.7);
    const collider = this.world.createCollider(collider_desc, body);
    mesh.userData.physicsCollider = collider;
    return collider;
  }
  /**
      * Creates a material for display meshes based on the specified display mode
      * @param {number} displayMode - 0: Transparent, 1: Black Screen, 2: White Screen
      * @returns {THREE.Material} The created material
      */
  createDisplayMeshMaterial(displayMode = 0) {
    let material;
    switch (displayMode) {
      case 0:
        material = new THREE.MeshStandardMaterial({
          color: 16777215,
          // White base color
          transparent: true,
          // Enable transparency
          opacity: 0,
          // Fully transparent
          side: THREE.DoubleSide
        });
        break;
      case 1:
        material = new THREE.MeshStandardMaterial({
          color: 0,
          // Black base color
          emissive: 0,
          // No emission (black)
          emissiveIntensity: 0,
          // No emission intensity
          side: THREE.DoubleSide
        });
        break;
      case 2:
        material = new THREE.MeshStandardMaterial({
          color: 16777215,
          // White base color
          emissive: 16777215,
          // White emission
          emissiveIntensity: 0.3,
          // Moderate emission intensity to avoid too bright
          side: THREE.DoubleSide
        });
        break;
      default:
        console.warn(`Invalid display mode: ${displayMode}, defaulting to transparent`);
        material = new THREE.MeshStandardMaterial({
          color: 16777215,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide
        });
    }
    return material;
  }
  /**
      * Creates a debug wireframe for visualizing physics shapes
      * @param {string} type - The type of wireframe to create
      * @param {Object} dimensions - The dimensions of the wireframe
      * @param {THREE.Vector3} position - The position of the wireframe
      * @param {THREE.Quaternion} rotation - The rotation of the wireframe
      * @param {Object} options - Additional options for the wireframe
      * @returns {Promise<THREE.Mesh>} The created wireframe mesh
      */
  async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
    let geometry;
    if (type === "mesh" && options.geometry) {
      geometry = options.geometry;
    } else {
      const size = dimensions || { x: 1, y: 1, z: 1 };
      switch (type) {
        case "cuboid":
          geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
          break;
        case "sphere":
          geometry = new THREE.SphereGeometry(size.radius || 1, 16, 16);
          break;
        case "capsule":
          geometry = new THREE.CylinderGeometry(size.radius, size.radius, size.height, 16);
          break;
        default:
          geometry = new THREE.BoxGeometry(1, 1, 1);
      }
    }
    const staticColor = 65280;
    const blueColors = [
      255,
      // Pure blue
      4474111,
      // Light blue
      35071,
      // Sky blue
      43775,
      // Azure
      65535,
      // Cyan
      26316,
      // Medium blue
      13226,
      // Dark blue
      3368703,
      // Royal blue
      6711039,
      // Periwinkle
      39372
      // Ocean blue
    ];
    let color;
    if (options.isStatic === true) {
      color = staticColor;
    } else {
      let hash = 0;
      const posX = Math.round(position.x * 10);
      const posY = Math.round(position.y * 10);
      const posZ = Math.round(position.z * 10);
      hash = Math.abs(posX + posY * 31 + posZ * 47) % blueColors.length;
      color = blueColors[hash];
    }
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.quaternion.copy(rotation);
    if (options.scale && type === "mesh") {
      mesh.scale.copy(options.scale);
    }
    mesh.renderOrder = 999;
    mesh.userData.physicsBodyId = options.bodyId;
    mesh.userData.debugType = type;
    mesh.userData.originalObject = options.originalObject;
    mesh.userData.isStatic = options.isStatic;
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
      this.scene.add(mesh);
      this.debugMeshes.set(mesh.uuid, mesh);
    }
    return mesh;
  }
  /**
      * Spawns all custom assets from the manifest
      * @param {Object} manifest_manager - Instance of ManifestManager
      * @param {Function} progress_callback - Optional callback function for progress updates
      * @returns {Promise<Array>} Array of spawned custom assets
      */
  async spawn_custom_assets(manifest_manager, progress_callback = null) {
    var _a2, _b2, _c, _d, _e, _f;
    const spawned_assets = [];
    try {
      const custom_assets = manifest_manager.get_custom_assets();
      if (!custom_assets || custom_assets.length === 0) {
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
          console.log("No custom assets found in manifest");
        }
        return spawned_assets;
      }
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Found ${custom_assets.length} custom assets to spawn`);
      }
      for (const asset_data of custom_assets) {
        const position = new THREE.Vector3(
          ((_a2 = asset_data.position) == null ? void 0 : _a2.x) || 0,
          ((_b2 = asset_data.position) == null ? void 0 : _b2.y) || 0,
          ((_c = asset_data.position) == null ? void 0 : _c.z) || 0
        );
        const rotation = new THREE.Euler(
          ((_d = asset_data.rotation) == null ? void 0 : _d.x) || 0,
          ((_e = asset_data.rotation) == null ? void 0 : _e.y) || 0,
          ((_f = asset_data.rotation) == null ? void 0 : _f.z) || 0
        );
        const quaternion = new THREE.Quaternion().setFromEuler(rotation);
        const options = {
          scale: asset_data.scale,
          material: asset_data.material,
          collider: asset_data.collider,
          mass: asset_data.mass,
          ...asset_data.options
        };
        const result = await this.spawn_custom_asset(
          asset_data.asset_type,
          position,
          quaternion,
          options
        );
        if (result) {
          result.id = asset_data.id;
          spawned_assets.push(result);
        }
      }
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Spawned ${spawned_assets.length} custom assets from manifest`);
      }
      return spawned_assets;
    } catch (error) {
      console.error("Error spawning custom assets:", error);
      return spawned_assets;
    }
  }
};
_instance = new WeakMap();
_disposed = new WeakMap();
_assetTypes2 = new WeakMap();
_assetConfigs2 = new WeakMap();
__privateAdd(_CustomFactory, _instance, null);
__privateAdd(_CustomFactory, _disposed, false);
let CustomFactory = _CustomFactory;
const _AssetSpawner = class _AssetSpawner {
  /**
      * Constructor
      * @param {Object} target_container - The container to spawn assets into
      * @param {Object} target_world - The physics world
      */
  constructor(target_container = null, target_world = null) {
    __publicField(this, "storage");
    __publicField(this, "container");
    __publicField(this, "world");
    __publicField(this, "scene");
    // Cache the types and configs from CustomTypeManager
    __privateAdd(this, _assetTypes3, null);
    __privateAdd(this, _assetConfigs3, null);
    if (__privateGet(_AssetSpawner, _instance2)) {
      throw new Error("AssetSpawner is a singleton. Use AssetSpawner.get_instance() instead.");
    }
    this.storage = AssetStorage.get_instance();
    this.container = target_container;
    this.world = target_world;
    __privateSet(this, _assetTypes3, CustomTypeManager$1.getTypes());
    __privateSet(this, _assetConfigs3, CustomTypeManager$1.getConfigs());
    __privateSet(_AssetSpawner, _instance2, this);
    __privateSet(_AssetSpawner, _disposed2, false);
  }
  /**
      * Gets or creates the singleton instance of AssetSpawner.
      * @param {THREE.Scene} scene - The Three.js scene to add objects to.
      * @param {RAPIER.World} world - The Rapier physics world.
      * @returns {AssetSpawner} The singleton instance.
      */
  static get_instance(scene, world) {
    if (__privateGet(_AssetSpawner, _disposed2)) {
      __privateSet(_AssetSpawner, _instance2, null);
      __privateSet(_AssetSpawner, _disposed2, false);
    }
    if (!__privateGet(_AssetSpawner, _instance2)) {
      __privateSet(_AssetSpawner, _instance2, new _AssetSpawner(scene, world));
    } else if (scene || world) {
      if (scene) __privateGet(_AssetSpawner, _instance2).scene = scene;
      if (world) __privateGet(_AssetSpawner, _instance2).world = world;
    }
    return __privateGet(_AssetSpawner, _instance2);
  }
  /**
      * Spawns an asset of the specified type at the given position with the given rotation.
      * @param {string} asset_type - The type of asset to spawn.
      * @param {THREE.Vector3} position - The position to spawn the asset at.
      * @param {THREE.Quaternion} rotation - The rotation of the asset.
      * @param {Object} options - Additional options for spawning.
      * @returns {Promise<Object>} A promise that resolves with the spawned asset details.
      */
  async spawn_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
    let type_value = typeof asset_type === "object" && asset_type.value ? asset_type.value : asset_type;
    try {
      if (SystemAssetType.isSystemAssetType(type_value)) {
        if (type_value === SystemAssetType.CAMERA.value) {
          return this.spawn_scene_camera(options);
        }
        if (type_value === SystemAssetType.SPOTLIGHT.value) {
          const system_factory2 = SystemFactory.get_instance(this.scene, this.world);
          return await system_factory2.spawn_asset(asset_type, position, rotation, options);
        }
        const system_factory = SystemFactory.get_instance(this.scene, this.world);
        return await system_factory.spawn_asset(asset_type, position, rotation, options);
      }
      if (CustomTypeManager$1.hasLoadedCustomTypes()) {
        if (CustomTypeManager$1.hasType(type_value)) {
          const custom_factory = CustomFactory.get_instance(this.scene, this.world);
          return await custom_factory.spawn_custom_asset(type_value, position, rotation, options);
        } else {
          if (!CustomTypeManager$1.hasLoadedCustomTypes()) {
            console.error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
            console.error(`Failed to spawn asset type: "${type_value}"`);
          } else {
            console.error(`Unsupported asset type: "${type_value}". Cannot spawn asset.`);
            console.error(`Available types:`, Object.keys(CustomTypeManager$1.getTypes()));
          }
          return null;
        }
      }
    } catch (error) {
      if (typeof type_value !== "undefined") {
        console.error(`Error spawning asset ${type_value}:`, error);
      } else {
        console.error(`Error spawning asset (type unknown):`, error);
        console.error(`Original asset_type:`, asset_type);
      }
      return null;
    }
  }
  /**
      * @deprecated
      * Creates a debug wireframe for visualizing physics shapes.
      * @param {string} type - The type of wireframe to create.
      * @param {Object} dimensions - The dimensions of the wireframe.
      * @param {THREE.Vector3} position - The position of the wireframe.
      * @param {THREE.Quaternion} rotation - The rotation of the wireframe.
      * @param {Object} options - Additional options for the wireframe.
      * @returns {Promise<THREE.Mesh>} The created wireframe mesh.
      */
  async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
    let geometry;
    if (type === "mesh" && options.geometry) {
      geometry = options.geometry;
    } else {
      const size = dimensions || { x: 1, y: 1, z: 1 };
      switch (type) {
        case "cuboid":
          geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
          break;
        case "sphere":
          geometry = new THREE.SphereGeometry(size.radius || 1, 16, 16);
          break;
        case "capsule":
          geometry = new THREE.CylinderGeometry(size.radius, size.radius, size.height, 16);
          break;
        default:
          geometry = new THREE.BoxGeometry(1, 1, 1);
      }
    }
    const staticColor = 65280;
    const blueColors = [
      255,
      // Pure blue
      4474111,
      // Light blue
      35071,
      // Sky blue
      43775,
      // Azure
      65535,
      // Cyan
      26316,
      // Medium blue
      13226,
      // Dark blue
      3368703,
      // Royal blue
      6711039,
      // Periwinkle
      39372
      // Ocean blue
    ];
    let color;
    if (options.isStatic === true) {
      color = staticColor;
    } else {
      let hash = 0;
      const posX = Math.round(position.x * 10);
      const posY = Math.round(position.y * 10);
      const posZ = Math.round(position.z * 10);
      hash = Math.abs(posX + posY * 31 + posZ * 47) % blueColors.length;
      color = blueColors[hash];
    }
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.quaternion.copy(rotation);
    if (options.scale && type === "mesh") {
      mesh.scale.copy(options.scale);
    }
    mesh.renderOrder = 999;
    mesh.userData.physicsBodyId = options.bodyId;
    mesh.userData.debugType = type;
    mesh.userData.originalObject = options.originalObject;
    mesh.userData.isStatic = options.isStatic;
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
      this.scene.add(mesh);
      this.debugMeshes.set(mesh.uuid, mesh);
    }
    return mesh;
  }
  /**
      * @deprecated
      * Updates the positions of debug wireframes based on physics bodies.
      */
  update_debug_wireframes() {
    if (!BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) return;
    const dynamicBodies = this.storage.get_all_dynamic_bodies();
    this.debugMeshes.forEach((mesh) => {
      let foundBody = null;
      if (mesh.userData.physicsBodyId) {
        for (const [bodyMesh, body] of dynamicBodies) {
          if (body.handle === mesh.userData.physicsBodyId) {
            foundBody = body;
            break;
          }
        }
      }
      if (!foundBody) {
        const bodyPair = this.storage.get_body_pair_by_mesh(mesh);
        if (bodyPair) {
          foundBody = bodyPair[1];
        }
      }
      if (foundBody) {
        const position = foundBody.translation();
        mesh.position.set(position.x, position.y, position.z);
        const rotation = foundBody.rotation();
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
  }
  /**
      * Core cleanup of essential resources.
      */
  cleanup() {
    __privateSet(_AssetSpawner, _instance2, null);
    if (this.storage) {
      const allAssets = this.storage.get_all_assets();
      allAssets.forEach((asset) => {
        if (asset && asset.mesh && asset.mesh.parent) {
          asset.mesh.parent.remove(asset.mesh);
        }
      });
    }
    if (this.world) {
      const dynamicBodies = this.storage.get_all_dynamic_bodies();
      dynamicBodies.forEach(([mesh, body]) => {
        if (body) {
          this.world.removeRigidBody(body);
        }
      });
    }
    this.storage = null;
    this.container = null;
    this.world = null;
    __privateSet(this, _assetTypes3, null);
    __privateSet(this, _assetConfigs3, null);
  }
  /**
      * @deprecated
      * Cleanup of debug-specific resources.
      * This will be removed in future refactoring.
      */
  cleanup_debug() {
    if (this.debugMeshes) {
      this.debugMeshes.forEach((mesh) => {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          mesh.material.dispose();
        }
      });
      this.debugMeshes.clear();
    }
    const allAssets = this.storage.get_all_assets();
    allAssets.forEach((asset) => {
      if (asset && asset.type === SystemAssetType.SPOTLIGHT.value) {
        if (asset.objects) {
          asset.objects.forEach((obj) => {
            if (obj && obj.parent) {
              obj.parent.remove(obj);
            }
          });
        }
        if (asset.mesh && asset.mesh.parent) {
          asset.mesh.parent.remove(asset.mesh);
        }
      }
    });
  }
  /**
      * Updates all visual elements including debug wireframes and spotlight helpers.
      * This is the new method to use instead of the deprecated performCleanup().
      */
  update_visualizations() {
    if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
      this.update_debug_wireframes();
    }
    this.update_helpers();
  }
  /**
      * @deprecated
      * Creates a material for display meshes based on the specified display mode
      * @param {number} displayMode - 0: Transparent, 1: Black Screen, 2: White Screen
      * @returns {THREE.Material} The created material
      */
  static createDisplayMeshMaterial(displayMode = 0) {
    let material;
    switch (displayMode) {
      case 0:
        material = new THREE.MeshStandardMaterial({
          color: 16777215,
          // White base color
          transparent: true,
          // Enable transparency
          opacity: 0,
          // Fully transparent
          side: THREE.DoubleSide
        });
        break;
      case 1:
        material = new THREE.MeshStandardMaterial({
          color: 0,
          // Black base color
          emissive: 0,
          // No emission (black)
          emissiveIntensity: 0,
          // No emission intensity
          side: THREE.DoubleSide
        });
        break;
      case 2:
        material = new THREE.MeshStandardMaterial({
          color: 16777215,
          // White base color
          emissive: 16777215,
          // White emission
          emissiveIntensity: 0.3,
          // Moderate emission intensity to avoid too bright
          side: THREE.DoubleSide
        });
        break;
      default:
        console.warn(`Invalid display mode: ${displayMode}, defaulting to transparent`);
        material = new THREE.MeshStandardMaterial({
          color: 16777215,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide
        });
    }
    return material;
  }
  /**
      * @deprecated
      * Creates a collider from a mesh
      * @param {THREE.Mesh} mesh - The mesh to create a collider from
      * @param {RAPIER.RigidBody} body - The rigid body to attach the collider to
      * @param {Object} asset_config - Asset configuration data
      * @param {Object} [options={}] - Additional options for collider creation
      * @returns {Promise<RAPIER.Collider>} The created collider
      */
  async create_collider_from_mesh(mesh, body, asset_config, options = {}) {
    var _a2, _b2, _c;
    if (!mesh || !body) return null;
    const geometry = mesh.geometry;
    if (!geometry) return null;
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const meshScale = new THREE.Vector3();
    mesh.updateWorldMatrix(true, false);
    mesh.matrixWorld.decompose(position, quaternion, meshScale);
    const bodyPos = body.translation();
    const relativePos = {
      x: position.x - bodyPos.x,
      y: position.y - bodyPos.y,
      z: position.z - bodyPos.z
    };
    const box = geometry.boundingBox;
    const box_width = (box.max.x - box.min.x) * meshScale.x;
    const box_height = (box.max.y - box.min.y) * meshScale.y;
    const box_depth = (box.max.z - box.min.z) * meshScale.z;
    const localCenter = new THREE.Vector3();
    box.getCenter(localCenter);
    if (Math.abs(localCenter.x) > 1e-3 || Math.abs(localCenter.y) > 1e-3 || Math.abs(localCenter.z) > 1e-3) {
      const rotatedCenter = localCenter.clone().applyQuaternion(quaternion);
      relativePos.x += rotatedCenter.x * meshScale.x;
      relativePos.y += rotatedCenter.y * meshScale.y;
      relativePos.z += rotatedCenter.z * meshScale.z;
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Adjusted position for ${mesh.name} due to non-centered geometry:`, {
          localCenter: `${localCenter.x.toFixed(2)}, ${localCenter.y.toFixed(2)}, ${localCenter.z.toFixed(2)}`,
          rotatedCenter: `${rotatedCenter.x.toFixed(2)}, ${rotatedCenter.y.toFixed(2)}, ${rotatedCenter.z.toFixed(2)}`,
          newRelativePos: `${relativePos.x.toFixed(2)}, ${relativePos.y.toFixed(2)}, ${relativePos.z.toFixed(2)}`
        });
      }
    }
    if (BLORKPACK_FLAGS.ASSET_LOGS) {
      console.log(`Creating collider for ${mesh.name}:`, {
        worldPos: `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`,
        bodyPos: `${bodyPos.x.toFixed(2)}, ${bodyPos.y.toFixed(2)}, ${bodyPos.z.toFixed(2)}`,
        relativePos: `${relativePos.x.toFixed(2)}, ${relativePos.y.toFixed(2)}, ${relativePos.z.toFixed(2)}`,
        meshScale: `${meshScale.x.toFixed(2)}, ${meshScale.y.toFixed(2)}, ${meshScale.z.toFixed(2)}`
      });
    }
    let collider_desc;
    if (mesh.name.includes("sphere") || mesh.name.includes("ball")) {
      geometry.computeBoundingSphere();
      const radius = geometry.boundingSphere.radius * meshScale.x;
      collider_desc = RAPIER.ColliderDesc.ball(radius);
    } else if (mesh.name.includes("capsule")) {
      const height = (box.max.y - box.min.y) * meshScale.y;
      const radius = Math.max(
        box.max.x - box.min.x,
        box.max.z - box.min.z
      ) * meshScale.x * 0.5;
      collider_desc = RAPIER.ColliderDesc.capsule(height * 0.5, radius);
    } else {
      const collider_width = ((_a2 = options.collider_dimensions) == null ? void 0 : _a2.width) !== void 0 ? options.collider_dimensions.width : box_width / 2;
      const collider_height = ((_b2 = options.collider_dimensions) == null ? void 0 : _b2.height) !== void 0 ? options.collider_dimensions.height : box_height / 2;
      const collider_depth = ((_c = options.collider_dimensions) == null ? void 0 : _c.depth) !== void 0 ? options.collider_dimensions.depth : box_depth / 2;
      collider_desc = RAPIER.ColliderDesc.cuboid(collider_width, collider_height, collider_depth);
    }
    collider_desc.setTranslation(relativePos.x, relativePos.y, relativePos.z);
    collider_desc.setRotation(quaternion);
    if (asset_config.mass) {
      collider_desc.setMass(asset_config.mass);
    }
    if (asset_config.restitution) {
      collider_desc.setRestitution(asset_config.restitution);
    }
    collider_desc.setFriction(0.7);
    const collider = this.world.createCollider(collider_desc, body);
    mesh.userData.physicsCollider = collider;
    return collider;
  }
  /**
      * @deprecated
      * Sets the collision debug state for this spawner.
      * This allows the main application to control debug visualization.
      * @param {boolean} enabled - Whether collision debug should be enabled
      */
  async set_collision_debug(enabled) {
    BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG = enabled;
    if (!enabled) {
      this.debugMeshes.forEach((mesh) => {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          mesh.material.dispose();
        }
      });
      this.debugMeshes.clear();
      return;
    }
    await this.create_debug_wireframes_for_all_bodies();
  }
  /**
      * @deprecated
      * Creates debug wireframes for all physics bodies.
      * This is used when enabling debug visualization after objects are already created.
      */
  async create_debug_wireframes_for_all_bodies() {
    this.debugMeshes.forEach((mesh) => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        mesh.material.dispose();
      }
    });
    this.debugMeshes.clear();
    if (BLORKPACK_FLAGS.ASSET_LOGS) {
      console.log("Creating all debug wireframes");
    }
    const dynamicBodies = this.storage.get_all_dynamic_bodies();
    for (const [mesh, body] of dynamicBodies) {
      if (!body) continue;
      body.translation();
      body.rotation();
      const collisionMeshes = [];
      mesh.traverse((child) => {
        if (child.isMesh && child.name.startsWith("col_")) {
          collisionMeshes.push(child);
        }
      });
      if (collisionMeshes.length > 0) {
        for (const colMesh of collisionMeshes) {
          const worldPosition = new THREE.Vector3();
          const worldQuaternion = new THREE.Quaternion();
          const worldScale = new THREE.Vector3();
          colMesh.updateWorldMatrix(true, false);
          colMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
          const clonedGeometry = colMesh.geometry.clone();
          if (BLORKPACK_FLAGS.ASSET_LOGS) {
            console.log(`Creating dynamic wireframe for: ${colMesh.name}`);
          }
          await this.create_debug_wireframe(
            "mesh",
            null,
            // Dimensions not needed when using actual geometry
            worldPosition,
            worldQuaternion,
            {
              bodyId: body.handle,
              geometry: clonedGeometry,
              originalObject: colMesh,
              objectId: colMesh.id,
              scale: worldScale,
              isStatic: false
              // Explicitly mark as NOT static
            }
          );
        }
      } else {
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        const size = boundingBox.getSize(new THREE.Vector3());
        const center = boundingBox.getCenter(new THREE.Vector3());
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
          console.log(`Creating fallback dynamic wireframe for: ${mesh.name}`);
        }
        await this.create_debug_wireframe(
          "cuboid",
          {
            x: size.x * 0.5,
            y: size.y * 0.5,
            z: size.z * 0.5
          },
          center,
          mesh.quaternion,
          {
            bodyId: body.handle,
            originalObject: mesh,
            objectId: mesh.id,
            isStatic: false
            // Explicitly mark as NOT static
          }
        );
      }
    }
    const staticMeshes = this.storage.get_all_static_meshes();
    for (const mesh of staticMeshes) {
      if (!mesh) continue;
      if (mesh.name.includes("ROOM") || mesh.name.includes("FLOOR")) {
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
          console.log(`Processing static mesh: ${mesh.name}`);
        }
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        const size = boundingBox.getSize(new THREE.Vector3());
        const center = boundingBox.getCenter(new THREE.Vector3());
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
          console.log(`Creating static wireframe for room: ${mesh.name}`);
        }
        await this.create_debug_wireframe(
          "cuboid",
          {
            x: size.x * 0.5,
            y: size.y * 0.5,
            z: size.z * 0.5
          },
          center,
          mesh.quaternion,
          {
            originalObject: mesh,
            objectId: mesh.id,
            isStatic: true
            // Explicitly mark as static
          }
        );
      }
    }
  }
  /**
      * Spawns assets from asset groups defined in the manifest
      * @param {Object} manifest_manager - Instance of ManifestManager
      * @param {Function} progress_callback - Optional callback function for progress updates
      * @returns {Promise<Array>} Array of spawned assets
      */
  async spawn_asset_groups(manifest_manager, progress_callback = null) {
    var _a2, _b2, _c, _d, _e, _f;
    const spawned_assets = [];
    try {
      const asset_groups = manifest_manager.get_all_asset_groups();
      if (!asset_groups || asset_groups.length === 0) {
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
          console.log("No asset groups found in manifest");
        }
        return spawned_assets;
      }
      const active_groups = asset_groups.filter((group) => group.active);
      for (const group of active_groups) {
        if (progress_callback) {
          progress_callback(`Loading asset group: ${group.name}...`);
        }
        for (const asset_id of group.assets) {
          const asset_data = manifest_manager.get_asset(asset_id);
          if (asset_data) {
            const asset_type = asset_data.asset_type;
            const custom_type = manifest_manager.get_custom_type(asset_type);
            if (custom_type) {
              const position = new THREE.Vector3(
                ((_a2 = asset_data.position) == null ? void 0 : _a2.x) || 0,
                ((_b2 = asset_data.position) == null ? void 0 : _b2.y) || 0,
                ((_c = asset_data.position) == null ? void 0 : _c.z) || 0
              );
              const rotation = new THREE.Euler(
                ((_d = asset_data.rotation) == null ? void 0 : _d.x) || 0,
                ((_e = asset_data.rotation) == null ? void 0 : _e.y) || 0,
                ((_f = asset_data.rotation) == null ? void 0 : _f.z) || 0
              );
              const quaternion = new THREE.Quaternion().setFromEuler(rotation);
              const options = {
                scale: asset_data.scale,
                material: asset_data.material,
                collider: asset_data.collider,
                mass: asset_data.mass,
                ...asset_data.options
              };
              const result = await this.spawn_asset(
                asset_type,
                position,
                quaternion,
                options
              );
              if (result) {
                result.id = asset_id;
                spawned_assets.push(result);
              }
            } else if (BLORKPACK_FLAGS.ASSET_LOGS) {
              console.warn(`Custom type "${asset_type}" not found for asset ${asset_id}`);
            }
          } else if (BLORKPACK_FLAGS.ASSET_LOGS) {
            console.warn(`Asset with ID "${asset_id}" not found in manifest`);
          }
        }
      }
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Spawned ${spawned_assets.length} assets from manifest`);
      }
    } catch (error) {
      console.error("Error spawning asset groups:", error);
    }
    return spawned_assets;
  }
  /**
      * Spawns all assets from the manifest, routing system assets to SystemFactory
      * and handling custom assets directly.
      * 
      * @param {Object} manifest_manager - Instance of ManifestManager
      * @param {Function} progress_callback - Optional callback function for progress updates
      * @returns {Promise<Array>} Array of all spawned assets
      */
  async spawn_manifest_assets(manifest_manager, progress_callback = null) {
    const spawned_assets = [];
    try {
      const system_assets = manifest_manager.get_system_assets();
      const custom_assets = manifest_manager.get_custom_assets();
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Found ${system_assets.length} system assets and ${custom_assets.length} custom assets to spawn`);
      }
      if (system_assets && system_assets.length > 0) {
        if (progress_callback) {
          progress_callback("Loading system assets...");
        }
        const system_factory = SystemFactory.get_instance(this.scene, this.world);
        const system_results = await system_factory.spawn_system_assets(manifest_manager, progress_callback);
        spawned_assets.push(...system_results);
      }
      if (custom_assets && custom_assets.length > 0) {
        if (progress_callback) {
          progress_callback("Loading custom assets...");
        }
        const custom_factory = CustomFactory.get_instance(this.scene, this.world);
        const custom_results = await custom_factory.spawn_custom_assets(manifest_manager, progress_callback);
        spawned_assets.push(...custom_results);
      }
      if (BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log(`Spawned ${spawned_assets.length} total assets from manifest`);
      }
      return spawned_assets;
    } catch (error) {
      console.error("Error spawning manifest assets:", error);
      return spawned_assets;
    }
  }
  /**
      * @deprecated
      * Spawns a scene camera based on the camera configuration from the manifest.
      * This method creates a simple camera without any additional functionality.
      * 
      * @param {Object} camera_config - The camera configuration object from manifest
      * @returns {THREE.PerspectiveCamera} The created camera
      */
  spawn_scene_camera(camera_config) {
    var _a2, _b2, _c;
    if (!camera_config) {
      console.error("No camera configuration provided to spawn_scene_camera");
      return null;
    }
    const camera = new THREE.PerspectiveCamera(
      // Field of view
      camera_config.fov || 75,
      // Default aspect ratio (will be updated when added to scene)
      window.innerWidth / window.innerHeight,
      // Near and far clipping planes
      camera_config.near || 0.1,
      camera_config.far || 1e3
    );
    camera.position.set(
      ((_a2 = camera_config.position) == null ? void 0 : _a2.x) || 0,
      ((_b2 = camera_config.position) == null ? void 0 : _b2.y) || 5,
      ((_c = camera_config.position) == null ? void 0 : _c.z) || 10
    );
    const camera_id = IdGenerator.get_instance().generate_asset_id();
    this.storage.store_static_mesh(camera_id, camera);
    return camera;
  }
  /**
      * Creates a helper visualization for the specified asset type.
      * Used for debugging purposes.
      * 
      * @param {string} asset_type - The type of asset to create a helper for
      * @param {THREE.Object3D} asset - The asset to create helpers for
      * @returns {Promise<Object>} The created helper objects
      */
  async create_helper(asset_type, asset) {
    if (!asset) return null;
    switch (asset_type) {
      case SystemAssetType.SPOTLIGHT.value:
        const { create_spotlight_helper: create_spotlight_helper2 } = await Promise.resolve().then(() => spotlight_spawner);
        return create_spotlight_helper2(this.scene, asset);
      // Add other asset type cases here as needed
      default:
        console.warn(`No helper visualization available for asset type: ${asset_type}`);
        return null;
    }
  }
  /**
      * Removes helper visualizations for the specified asset.
      * 
      * @param {THREE.Object3D} asset - The asset whose helpers should be removed
      * @returns {Promise<void>}
      */
  async despawn_helpers(asset) {
    if (!asset || !asset.userData.debugHelpers) return;
    const { helper, cone } = asset.userData.debugHelpers;
    if (helper && helper.parent) helper.parent.remove(helper);
    if (cone && cone.parent) cone.parent.remove(cone);
    asset.userData.debugHelpers = null;
  }
  /**
      * Updates all helper visualizations to match their associated assets.
      * Called from the main animation loop.
      */
  async update_helpers() {
    const { update_helpers: update_helpers2 } = await Promise.resolve().then(() => spotlight_spawner);
    return update_helpers2(this.scene);
  }
  /**
      * Forces a full update of all helper visualizations on next call.
      * Call this when you know assets have been added or removed.
      */
  async forceHelperUpdate() {
    const { forceSpotlightDebugUpdate } = await Promise.resolve().then(() => spotlight_spawner);
    return forceSpotlightDebugUpdate(this.scene);
  }
  /**
      * Dispose of the spawner instance and clean up resources
      */
  dispose() {
    if (!__privateGet(_AssetSpawner, _instance2)) return;
    CustomFactory.dispose_instance();
    this.scene = null;
    this.world = null;
    this.storage = null;
    this.container = null;
    __privateSet(_AssetSpawner, _disposed2, true);
    __privateSet(_AssetSpawner, _instance2, null);
  }
  /**
   *
   */
  static dispose_instance() {
    if (__privateGet(_AssetSpawner, _instance2)) {
      __privateGet(_AssetSpawner, _instance2).dispose();
    }
  }
};
_instance2 = new WeakMap();
_disposed2 = new WeakMap();
_assetTypes3 = new WeakMap();
_assetConfigs3 = new WeakMap();
__privateAdd(_AssetSpawner, _instance2, null);
__privateAdd(_AssetSpawner, _disposed2, false);
let AssetSpawner = _AssetSpawner;
const DEFAULT_ENVIRONMENT = {
  /**
      * Default gravity configuration
      * Standard Earth gravity is (0, -9.8, 0), but we default to zero gravity
      * to avoid unexpected behavior in scenes
      */
  gravity: {
    x: 0,
    y: 0,
    z: 0
  },
  /**
      * Default ambient light settings
      */
  ambient_light: {
    color: "0xffffff",
    intensity: 0.5
  },
  /**
      * Default fog settings
      */
  fog: {
    enabled: false,
    color: "0xaaaaaa",
    near: 10,
    far: 100
  },
  /**
      * Default background settings
      */
  background: {
    type: "COLOR",
    color_value: "0x000000"
  },
  /**
      * Default greeting data settings
      */
  greeting_data: {
    display: false,
    modal_path: ""
  }
};
const DEFAULT_PHYSICS = {
  enabled: true,
  update_rate: 60,
  substeps: 1,
  debug_draw: false,
  allow_sleep: true,
  linear_sleep_threshold: 0.2,
  angular_sleep_threshold: 0.1,
  sleep_threshold: 0.1,
  max_velocity_iterations: 2,
  max_velocity_friction: 4,
  integration_parameters: {
    dt: 1 / 60,
    erp: 0.8,
    warmstart_coeff: 0.8,
    allowed_linear_error: 1e-3
  }
};
const DEFAULT_RENDERING = {
  shadows: true,
  antialiasing: true,
  tone_mapping_exposure: 1,
  output_encoding: "sRGB"
};
const _ManifestManager = class _ManifestManager {
  /**
   *
   */
  constructor() {
    if (_ManifestManager.instance) {
      return _ManifestManager.instance;
    }
    this.manifest_data = null;
    this.load_promise = null;
    this.is_loaded = false;
    this.successful_manifest_path = null;
    _ManifestManager.instance = this;
  }
  /**
      * Gets or creates the singleton instance of ManifestManager.
      * @returns {ManifestManager} The singleton instance.
      */
  static get_instance() {
    if (!_ManifestManager.instance) {
      _ManifestManager.instance = new _ManifestManager();
    }
    return _ManifestManager.instance;
  }
  /**
      * Gets the path that successfully loaded the manifest
      * @returns {string|null} The successful path or null if manifest hasn't been loaded
      */
  get_successful_manifest_path() {
    return this.successful_manifest_path;
  }
  /**
      * Loads the manifest file from specified path.
      * @param {string} [relativePath='resources/manifest.json'] - Path to the manifest file
      * @returns {Promise<Object>} Promise resolving to the manifest data
      */
  async load_manifest(relativePath = "resources/manifest.json") {
    if (this.is_loaded) {
      return this.manifest_data;
    }
    if (this.load_promise) {
      return this.load_promise;
    }
    const basePath = window.location.pathname.includes("/threejs_site/") ? "/threejs_site" : "";
    const fullPath = `${basePath}/${relativePath}`.replace(/\/+/g, "/");
    console.log(`Loading manifest from: ${fullPath}`);
    try {
      const response = await fetch(fullPath);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      const data = await response.json();
      this.manifest_data = data;
      this.is_loaded = true;
      this.successful_manifest_path = fullPath;
      console.log(
        `
%cManifest Successfully Loaded
%cPath: ${fullPath}
%cThis is the path that worked - you can remove other manifest copies
`,
        "color: green; font-weight: bold; font-size: 1.1em;",
        "color: blue; font-weight: bold;",
        "color: gray; font-style: italic;"
      );
      return data;
    } catch (error) {
      console.error("Failed to load manifest:", error);
      throw error;
    }
  }
  /**
      * Saves the manifest data to a JSON file (for the application creating manifests).
      * @param {string} [path='resources/manifest.json'] - Path where to save the manifest
      * @param {Object} [data=null] - Data to save, or use the current manifest_data if null
      * @returns {Promise<boolean>} Promise resolving to true if save was successful
      */
  async save_manifest(path = "resources/manifest.json", data = null) {
    const data_to_save = data || this.manifest_data;
    if (!data_to_save) {
      throw new Error("No manifest data to save");
    }
    const serialized_data = JSON.stringify(data_to_save, null, 2);
    try {
      if (typeof window !== "undefined" && typeof document !== "undefined") {
        const blob = new Blob([serialized_data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      }
      if (typeof process !== "undefined" && process.versions && process.versions.node) {
        if (typeof require === "function") {
          try {
            const fs = require("fs");
            fs.writeFileSync(path, serialized_data);
            return true;
          } catch (require_error) {
            console.warn("Could not require fs module:", require_error.message);
          }
        }
        console.warn("Cannot directly save files in this Node.js environment.");
        console.warn("To save the manifest, write the following data to a file:");
        console.warn(`Path: ${path}`);
        console.warn("Data:", serialized_data);
        this._save_data = {
          path,
          data: data_to_save
        };
        return false;
      }
      console.warn("Unable to save manifest: Unknown environment");
      console.warn("Manifest data:", serialized_data);
      return false;
    } catch (error) {
      console.error("Error in save_manifest:", error);
      throw error;
    }
  }
  /**
      * Validates the manifest data against expected schema.
      * @param {Object} [data=null] - Data to validate, or use the current manifest_data if null
      * @returns {Object} Validation result with is_valid flag and any errors
      */
  validate_manifest(data = null) {
    const data_to_validate = data || this.manifest_data;
    if (!data_to_validate) {
      return { is_valid: false, errors: ["No manifest data to validate"] };
    }
    const errors = [];
    if (!data_to_validate.manifest_version) {
      errors.push("Missing manifest_version");
    }
    if (!data_to_validate.name) {
      errors.push("Missing name");
    }
    if (data_to_validate.custom_types && Array.isArray(data_to_validate.custom_types)) {
      data_to_validate.custom_types.forEach((type, index) => {
        if (!type.name) {
          errors.push(`custom_types[${index}]: Missing name`);
        }
      });
    }
    if (!data_to_validate.scene_data) {
      errors.push("Missing scene_data");
    }
    return {
      is_valid: errors.length === 0,
      errors
    };
  }
  /**
      * Creates a new empty manifest with default values.
      * @param {string} name - Name of the new manifest
      * @param {string} description - Description of the manifest
      * @returns {Object} The newly created manifest data
      */
  create_new_manifest(name, description) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleDateString();
    const new_manifest = {
      manifest_version: "1.0",
      name: name || "New Manifest",
      description: description || "Created with ManifestManager",
      author: "",
      created_date: timestamp,
      updated_date: timestamp,
      custom_types: [],
      joint_data: {},
      asset_groups: [],
      asset_data: {},
      custom_assets: [],
      system_assets: [],
      scene_data: {
        version: "1.0",
        name: "Main Scene",
        description: "Default scene",
        environment: {
          gravity: {
            x: 0,
            y: 9.8,
            z: 0
          },
          ambient_light: {
            color: "0xffffff",
            intensity: 0.5
          }
        },
        physics: {
          enabled: true,
          update_rate: 60
        },
        rendering: {
          shadows: true,
          antialiasing: true
        }
      }
    };
    this.manifest_data = new_manifest;
    this.is_loaded = true;
    return new_manifest;
  }
  /**
      * Gets the entire manifest data.
      * @returns {Object|null} The manifest data or null if not loaded.
      */
  get_manifest() {
    return this.manifest_data;
  }
  /**
      * Updates the entire manifest data.
      * @param {Object} data - The new manifest data
      */
  set_manifest(data) {
    this.manifest_data = data;
    this.is_loaded = true;
  }
  /**
      * Checks if the manifest is loaded.
      * @returns {boolean} True if the manifest is loaded.
      */
  is_manifest_loaded() {
    return this.is_loaded;
  }
  /**
      * Gets a custom type definition by name.
      * @param {string} type_name - The name of the custom type.
      * @returns {CustomType|null} The custom type definition or null if not found.
      */
  get_custom_type(type_name) {
    var _a2;
    if (!this.is_loaded || !((_a2 = this.manifest_data) == null ? void 0 : _a2.custom_types)) {
      return null;
    }
    return this.manifest_data.custom_types.find((type) => type.name === type_name) || null;
  }
  /**
      * Gets all custom types.
      * @returns {Array<CustomType>|null} Array of custom types or null if manifest not loaded.
      */
  get_all_custom_types() {
    var _a2;
    return this.is_loaded ? ((_a2 = this.manifest_data) == null ? void 0 : _a2.custom_types) || [] : null;
  }
  /**
      * Adds or updates a custom type.
      * @param {CustomType} type_data - The custom type data
      * @returns {boolean} True if successful
      */
  set_custom_type(type_data) {
    if (!this.is_loaded || !type_data.name) {
      return false;
    }
    if (!this.manifest_data.custom_types) {
      this.manifest_data.custom_types = [];
    }
    const existing_index = this.manifest_data.custom_types.findIndex((t) => t.name === type_data.name);
    if (existing_index >= 0) {
      this.manifest_data.custom_types[existing_index] = type_data;
    } else {
      this.manifest_data.custom_types.push(type_data);
    }
    return true;
  }
  /**
      * Gets an asset group by ID.
      * @param {string} group_id - The ID of the asset group.
      * @returns {AssetGroup|null} The asset group or null if not found.
      */
  get_asset_group(group_id) {
    var _a2;
    if (!this.is_loaded || !((_a2 = this.manifest_data) == null ? void 0 : _a2.asset_groups)) {
      return null;
    }
    return this.manifest_data.asset_groups.find((group) => group.id === group_id) || null;
  }
  /**
      * Gets all asset groups.
      * @returns {Array<AssetGroup>|null} Array of asset groups or null if manifest not loaded.
      */
  get_all_asset_groups() {
    var _a2;
    return this.is_loaded ? ((_a2 = this.manifest_data) == null ? void 0 : _a2.asset_groups) || [] : null;
  }
  /**
      * Adds or updates an asset group.
      * @param {AssetGroup} group_data - The asset group data
      * @returns {boolean} True if successful
      */
  set_asset_group(group_data) {
    if (!this.is_loaded || !group_data.id) {
      return false;
    }
    if (!this.manifest_data.asset_groups) {
      this.manifest_data.asset_groups = [];
    }
    const existing_index = this.manifest_data.asset_groups.findIndex((g) => g.id === group_data.id);
    if (existing_index >= 0) {
      this.manifest_data.asset_groups[existing_index] = group_data;
    } else {
      this.manifest_data.asset_groups.push(group_data);
    }
    return true;
  }
  /**
      * Gets an asset by ID.
      * @param {string} asset_id - The ID of the asset.
      * @returns {AssetData|null} The asset data or null if not found.
      */
  get_asset(asset_id) {
    var _a2;
    if (!this.is_loaded || !((_a2 = this.manifest_data) == null ? void 0 : _a2.asset_data)) {
      return null;
    }
    if (typeof this.manifest_data.asset_data === "object" && !Array.isArray(this.manifest_data.asset_data)) {
      return this.manifest_data.asset_data[asset_id] || null;
    }
    if (Array.isArray(this.manifest_data.asset_data)) {
      return this.manifest_data.asset_data.find((asset) => asset.id === asset_id) || null;
    }
    return null;
  }
  /**
      * Gets all assets.
      * @returns {Object<string,AssetData>|Array<AssetData>|null} Assets or null if manifest not loaded.
      */
  get_all_assets() {
    var _a2;
    return this.is_loaded ? ((_a2 = this.manifest_data) == null ? void 0 : _a2.asset_data) || null : null;
  }
  /**
      * Adds or updates an asset.
      * @param {string} asset_id - The ID of the asset
      * @param {AssetData} asset_data - The asset data
      * @returns {boolean} True if successful
      */
  set_asset(asset_id, asset_data) {
    if (!this.is_loaded || !asset_id) {
      return false;
    }
    if (!this.manifest_data.asset_data) {
      this.manifest_data.asset_data = {};
    }
    if (typeof this.manifest_data.asset_data === "object" && !Array.isArray(this.manifest_data.asset_data)) {
      this.manifest_data.asset_data[asset_id] = asset_data;
      return true;
    }
    if (Array.isArray(this.manifest_data.asset_data)) {
      const existing_index = this.manifest_data.asset_data.findIndex((asset) => asset.id === asset_id);
      if (existing_index >= 0) {
        this.manifest_data.asset_data[existing_index] = asset_data;
      } else {
        this.manifest_data.asset_data.push(asset_data);
      }
      return true;
    }
    return false;
  }
  /**
      * Gets the scene data.
      * @returns {SceneData|null} The scene data or null if not loaded.
      */
  get_scene_data() {
    var _a2;
    return this.is_loaded ? ((_a2 = this.manifest_data) == null ? void 0 : _a2.scene_data) || null : null;
  }
  /**
      * Sets the scene data.
      * @param {SceneData} scene_data - The scene data to set
      * @returns {boolean} True if successful
      */
  set_scene_data(scene_data) {
    if (!this.is_loaded) {
      return false;
    }
    this.manifest_data.scene_data = scene_data;
    return true;
  }
  /**
      * Gets the greeting data configuration from the manifest.
      * If not defined in the manifest, returns a default with display set to false.
      * @returns {Object} The greeting data configuration
      */
  get_greeting_data() {
    const scene_data = this.get_scene_data();
    if (scene_data == null ? void 0 : scene_data.greeting_data) {
      return {
        display: scene_data.greeting_data.display === true,
        modal_path: scene_data.greeting_data.modal_path || ""
      };
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("No greeting data found in manifest, using default (display: false)");
    }
    return DEFAULT_ENVIRONMENT.greeting_data;
  }
  /**
      * Gets the auto_throttle setting from the manifest.
      * If not defined in the manifest, returns the default (true).
      * @returns {boolean} Whether automatic resolution throttling is enabled
      */
  get_auto_throttle() {
    const scene_data = this.get_scene_data();
    if (scene_data && "auto_throttle" in scene_data) {
      return scene_data.auto_throttle === true;
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("No auto_throttle setting found in manifest, using default (true)");
    }
    return true;
  }
  /**
      * Gets the gravity configuration from the manifest.
      * If not defined in the manifest, returns the default.
      * @returns {Object} The gravity configuration with x, y, z properties
      */
  get_gravity() {
    var _a2;
    const scene_data = this.get_scene_data();
    if ((_a2 = scene_data == null ? void 0 : scene_data.environment) == null ? void 0 : _a2.gravity) {
      return scene_data.environment.gravity;
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("Using default gravity configuration from blorkpack defaults");
    }
    return DEFAULT_ENVIRONMENT.gravity;
  }
  /**
      * Gets the physics optimization settings from the manifest.
      * If not defined in the manifest, returns the default.
      * @returns {Object} The physics optimization settings
      */
  get_physics_optimization_settings() {
    var _a2;
    const scene_data = this.get_scene_data();
    if ((_a2 = scene_data == null ? void 0 : scene_data.physics) == null ? void 0 : _a2.optimization) {
      return scene_data.physics.optimization;
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("Using default physics optimization settings from blorkpack defaults");
    }
    return DEFAULT_PHYSICS;
  }
  /**
      * Gets the ambient light configuration from the manifest.
      * If not defined in the manifest, returns the default.
      * @returns {Object} The ambient light configuration
      */
  get_ambient_light() {
    var _a2;
    const scene_data = this.get_scene_data();
    if ((_a2 = scene_data == null ? void 0 : scene_data.environment) == null ? void 0 : _a2.ambient_light) {
      return scene_data.environment.ambient_light;
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("Using default ambient light configuration from blorkpack defaults");
    }
    return DEFAULT_ENVIRONMENT.ambient_light;
  }
  /**
      * Gets the fog configuration from the manifest.
      * If not defined in the manifest, returns the default.
      * @returns {Object} The fog configuration
      */
  get_fog() {
    var _a2;
    const scene_data = this.get_scene_data();
    if ((_a2 = scene_data == null ? void 0 : scene_data.environment) == null ? void 0 : _a2.fog) {
      return scene_data.environment.fog;
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("Using default fog configuration from blorkpack defaults");
    }
    return DEFAULT_ENVIRONMENT.fog;
  }
  /**
      * Gets the physics configuration from the manifest.
      * If not defined in the manifest, returns the default.
      * @returns {Object} The physics configuration
      */
  get_physics_config() {
    const scene_data = this.get_scene_data();
    if (scene_data == null ? void 0 : scene_data.physics) {
      return scene_data.physics;
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("Using default physics configuration from blorkpack defaults");
    }
    return DEFAULT_PHYSICS;
  }
  /**
      * Gets the rendering configuration from the manifest.
      * If not defined in the manifest, returns the default.
      * @returns {Object} The rendering configuration
      */
  get_rendering_config() {
    const scene_data = this.get_scene_data();
    if (scene_data == null ? void 0 : scene_data.rendering) {
      return scene_data.rendering;
    }
    if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
      console.debug("Using default rendering configuration from blorkpack defaults");
    }
    return DEFAULT_RENDERING;
  }
  /**
      * Gets the background configuration from the manifest.
      * If not defined in the manifest, returns the default.
      * Validates all fields to ensure they have appropriate values.
      * @returns {Object} The background configuration
      */
  get_background_config() {
    const scene_data = this.get_scene_data();
    let background = DEFAULT_ENVIRONMENT.background;
    if (scene_data == null ? void 0 : scene_data.background) {
      background = scene_data.background;
      if (!["COLOR", "IMAGE", "SKYBOX"].includes(background.type)) {
        if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
          console.debug(`Invalid background type "${background.type}", using default type "${DEFAULT_ENVIRONMENT.background.type}"`);
        }
        background.type = DEFAULT_ENVIRONMENT.background.type;
      }
      if (background.type === "COLOR" && !background.color_value) {
        if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
          console.debug(`Background type is COLOR but color_value is missing, using default value "${DEFAULT_ENVIRONMENT.background.color_value}"`);
        }
        background.color_value = DEFAULT_ENVIRONMENT.background.color_value;
      }
      if (background.type === "IMAGE" && !background.image_path) {
        if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
          console.debug(`Background type is IMAGE but image_path is missing, caller will use fallback image`);
        }
      }
      if (background.type === "SKYBOX") {
        if (!background.skybox) {
          if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
            console.debug(`Background type is SKYBOX but skybox object is missing, using default values enabled: false, skybox_path: ""`);
          }
          background.skybox = { enabled: false, skybox_path: "" };
        } else {
          if (!background.skybox.enabled) {
            if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
              console.debug(`Background type is SKYBOX but skybox.enabled is false, skybox will not be used`);
            }
          } else if (!background.skybox.skybox_path) {
            if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
              console.debug(`Background type is SKYBOX but skybox_path is missing, using default value ""`);
            }
            background.skybox.skybox_path = "";
            background.skybox.enabled = false;
          }
        }
      }
    } else {
      if (typeof BLORKPACK_FLAGS !== "undefined" && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
        console.debug(`Using default background configuration: type "${DEFAULT_ENVIRONMENT.background.type}", color_value "${DEFAULT_ENVIRONMENT.background.color_value}"`);
      }
    }
    return background;
  }
  /**
      * Gets the joint data from the manifest.
      * @returns {Object} The joint data or an empty object if not defined
      */
  get_joint_data() {
    var _a2;
    return ((_a2 = this.manifest_data) == null ? void 0 : _a2.joint_data) || {};
  }
  /**
      * Sets the joint data in the manifest.
      * @param {Object} joint_data - The joint data to set
      */
  set_joint_data(joint_data) {
    if (!this.manifest_data) {
      this.manifest_data = this.create_new_manifest();
    }
    this.manifest_data.joint_data = joint_data;
  }
  /**
      * Gets the custom_assets array from the manifest.
      * @returns {Array} Array of custom assets or an empty array if not defined
      */
  get_custom_assets() {
    var _a2;
    if (BLORKPACK_FLAGS.ASSET_LOGS) {
      console.log("Getting custom assets from manifest...");
    }
    return ((_a2 = this.manifest_data) == null ? void 0 : _a2.custom_assets) || [];
  }
  /**
      * Sets the custom_assets array in the manifest.
      * @param {Array} custom_assets - The custom assets array to set
      */
  set_custom_assets(custom_assets) {
    if (!this.manifest_data) {
      this.manifest_data = this.create_new_manifest();
    }
    this.manifest_data.custom_assets = custom_assets;
  }
  /**
      * Gets the system_assets array from the manifest.
      * @returns {Array} The system assets array (empty array if not found)
      */
  get_system_assets() {
    var _a2;
    if (BLORKPACK_FLAGS.ASSET_LOGS) {
      console.log("Getting system assets from manifest...");
    }
    return ((_a2 = this.manifest_data) == null ? void 0 : _a2.system_assets) || [];
  }
  /**
      * Sets the system_assets array in the manifest.
      * @param {Array} system_assets - The system assets array to set
      */
  set_system_assets(system_assets) {
    if (!this.manifest_data) {
      this.manifest_data = this.create_new_manifest();
    }
    this.manifest_data.system_assets = system_assets;
  }
  /**
      * Gets the camera configuration from the scene_data.
      * @returns {Object} The camera configuration with defaults applied
      */
  get_camera_config() {
    const scene_data = this.get_scene_data();
    const default_camera = {
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 75,
      near: 0.1,
      far: 1e3,
      ui_distance: 25,
      controls: {
        type: "ORBIT",
        enable_damping: true,
        damping_factor: 0.05,
        min_distance: 5,
        max_distance: 30,
        min_polar_angle: -60,
        max_polar_angle: 60,
        enable_zoom: true,
        enable_rotate: true,
        enable_pan: true
      },
      shoulder_lights: {
        enabled: true,
        left: {
          position: { x: -3, y: 2.5, z: 40 },
          rotation: { pitch: 190, yaw: 0 },
          angle: 80,
          max_distance: 0,
          intensity: 2
        },
        right: {
          position: { x: 3, y: 2.5, z: 40 },
          rotation: { pitch: 190, yaw: 0 },
          angle: 80,
          max_distance: 0,
          intensity: 2
        }
      }
    };
    if (!scene_data || !scene_data.default_camera) {
      if (BLORKPACK_FLAGS.MANIFEST_LOGS) {
        console.warn("No camera configuration found in scene_data, using defaults");
      }
      return default_camera;
    }
    const camera_config = { ...default_camera };
    if (scene_data.default_camera.position) {
      camera_config.position = {
        x: scene_data.default_camera.position.x ?? default_camera.position.x,
        y: scene_data.default_camera.position.y ?? default_camera.position.y,
        z: scene_data.default_camera.position.z ?? default_camera.position.z
      };
    }
    if (scene_data.default_camera.target) {
      camera_config.target = {
        x: scene_data.default_camera.target.x ?? default_camera.target.x,
        y: scene_data.default_camera.target.y ?? default_camera.target.y,
        z: scene_data.default_camera.target.z ?? default_camera.target.z
      };
    }
    camera_config.fov = scene_data.default_camera.fov ?? default_camera.fov;
    camera_config.near = scene_data.default_camera.near ?? default_camera.near;
    camera_config.far = scene_data.default_camera.far ?? default_camera.far;
    camera_config.ui_distance = scene_data.default_camera.ui_distance ?? default_camera.ui_distance;
    if (scene_data.default_camera.controls) {
      camera_config.controls = {
        type: scene_data.default_camera.controls.type ?? default_camera.controls.type,
        enable_damping: scene_data.default_camera.controls.enable_damping ?? default_camera.controls.enable_damping,
        damping_factor: scene_data.default_camera.controls.damping_factor ?? default_camera.controls.damping_factor,
        min_distance: scene_data.default_camera.controls.min_distance ?? default_camera.controls.min_distance,
        max_distance: scene_data.default_camera.controls.max_distance ?? default_camera.controls.max_distance,
        min_polar_angle: scene_data.default_camera.controls.min_polar_angle ?? default_camera.controls.min_polar_angle,
        max_polar_angle: scene_data.default_camera.controls.max_polar_angle ?? default_camera.controls.max_polar_angle,
        enable_zoom: scene_data.default_camera.controls.enable_zoom ?? default_camera.controls.enable_zoom,
        enable_rotate: scene_data.default_camera.controls.enable_rotate ?? default_camera.controls.enable_rotate,
        enable_pan: scene_data.default_camera.controls.enable_pan ?? default_camera.controls.enable_pan
      };
    }
    if (scene_data.default_camera.shoulder_lights) {
      camera_config.shoulder_lights = {
        enabled: scene_data.default_camera.shoulder_lights.enabled ?? default_camera.shoulder_lights.enabled
      };
      if (scene_data.default_camera.shoulder_lights.left) {
        camera_config.shoulder_lights.left = { ...default_camera.shoulder_lights.left };
        if (scene_data.default_camera.shoulder_lights.left.position) {
          camera_config.shoulder_lights.left.position = {
            x: scene_data.default_camera.shoulder_lights.left.position.x ?? default_camera.shoulder_lights.left.position.x,
            y: scene_data.default_camera.shoulder_lights.left.position.y ?? default_camera.shoulder_lights.left.position.y,
            z: scene_data.default_camera.shoulder_lights.left.position.z ?? default_camera.shoulder_lights.left.position.z
          };
        }
        if (scene_data.default_camera.shoulder_lights.left.rotation) {
          camera_config.shoulder_lights.left.rotation = {
            pitch: scene_data.default_camera.shoulder_lights.left.rotation.pitch ?? default_camera.shoulder_lights.left.rotation.pitch,
            yaw: scene_data.default_camera.shoulder_lights.left.rotation.yaw ?? default_camera.shoulder_lights.left.rotation.yaw
          };
        }
        camera_config.shoulder_lights.left.angle = scene_data.default_camera.shoulder_lights.left.angle ?? default_camera.shoulder_lights.left.angle;
        camera_config.shoulder_lights.left.max_distance = scene_data.default_camera.shoulder_lights.left.max_distance ?? default_camera.shoulder_lights.left.max_distance;
        camera_config.shoulder_lights.left.intensity = scene_data.default_camera.shoulder_lights.left.intensity ?? default_camera.shoulder_lights.left.intensity;
      }
      if (scene_data.default_camera.shoulder_lights.right) {
        camera_config.shoulder_lights.right = { ...default_camera.shoulder_lights.right };
        if (scene_data.default_camera.shoulder_lights.right.position) {
          camera_config.shoulder_lights.right.position = {
            x: scene_data.default_camera.shoulder_lights.right.position.x ?? default_camera.shoulder_lights.right.position.x,
            y: scene_data.default_camera.shoulder_lights.right.position.y ?? default_camera.shoulder_lights.right.position.y,
            z: scene_data.default_camera.shoulder_lights.right.position.z ?? default_camera.shoulder_lights.right.position.z
          };
        }
        if (scene_data.default_camera.shoulder_lights.right.rotation) {
          camera_config.shoulder_lights.right.rotation = {
            pitch: scene_data.default_camera.shoulder_lights.right.rotation.pitch ?? default_camera.shoulder_lights.right.rotation.pitch,
            yaw: scene_data.default_camera.shoulder_lights.right.rotation.yaw ?? default_camera.shoulder_lights.right.rotation.yaw
          };
        }
        camera_config.shoulder_lights.right.angle = scene_data.default_camera.shoulder_lights.right.angle ?? default_camera.shoulder_lights.right.angle;
        camera_config.shoulder_lights.right.max_distance = scene_data.default_camera.shoulder_lights.right.max_distance ?? default_camera.shoulder_lights.right.max_distance;
        camera_config.shoulder_lights.right.intensity = scene_data.default_camera.shoulder_lights.right.intensity ?? default_camera.shoulder_lights.right.intensity;
      }
    }
    return camera_config;
  }
};
/**
    * IMPORTANT: Always use the getter methods to access manifest data instead of direct access.
    * The getter methods handle null checks and provide default values when properties are missing.
    * This prevents having to do redundant null checks throughout the codebase.
    * 
    * Example:
    * - GOOD: manifest_manager.get_greeting_data().display
    * - BAD:  manifest_manager.get_scene_data()?.greeting_data?.display
    */
__publicField(_ManifestManager, "instance", null);
let ManifestManager = _ManifestManager;
class Pass {
  constructor() {
    this.isPass = true;
    this.enabled = true;
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;
  }
  setSize() {
  }
  render() {
    console.error("THREE.Pass: .render() must be implemented in derived pass.");
  }
  dispose() {
  }
}
const _camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
class FullscreenTriangleGeometry extends BufferGeometry {
  constructor() {
    super();
    this.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    this.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  }
}
const _geometry = new FullscreenTriangleGeometry();
class FullScreenQuad {
  constructor(material) {
    this._mesh = new Mesh(_geometry, material);
  }
  dispose() {
    this._mesh.geometry.dispose();
  }
  render(renderer) {
    renderer.render(this._mesh, _camera);
  }
  get material() {
    return this._mesh.material;
  }
  set material(value) {
    this._mesh.material = value;
  }
}
const CopyShader = {
  name: "CopyShader",
  uniforms: {
    "tDiffuse": { value: null },
    "opacity": { value: 1 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`
  )
};
class ShaderPass extends Pass {
  constructor(shader, textureID) {
    super();
    this.textureID = textureID !== void 0 ? textureID : "tDiffuse";
    if (shader instanceof ShaderMaterial) {
      this.uniforms = shader.uniforms;
      this.material = shader;
    } else if (shader) {
      this.uniforms = UniformsUtils.clone(shader.uniforms);
      this.material = new ShaderMaterial({
        name: shader.name !== void 0 ? shader.name : "unspecified",
        defines: Object.assign({}, shader.defines),
        uniforms: this.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
      });
    }
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    if (this.uniforms[this.textureID]) {
      this.uniforms[this.textureID].value = readBuffer.texture;
    }
    this.fsQuad.material = this.material;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      this.fsQuad.render(renderer);
    }
  }
  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
class MaskPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.clear = true;
    this.needsSwap = false;
    this.inverse = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const context = renderer.getContext();
    const state = renderer.state;
    state.buffers.color.setMask(false);
    state.buffers.depth.setMask(false);
    state.buffers.color.setLocked(true);
    state.buffers.depth.setLocked(true);
    let writeValue, clearValue;
    if (this.inverse) {
      writeValue = 0;
      clearValue = 1;
    } else {
      writeValue = 1;
      clearValue = 0;
    }
    state.buffers.stencil.setTest(true);
    state.buffers.stencil.setOp(context.REPLACE, context.REPLACE, context.REPLACE);
    state.buffers.stencil.setFunc(context.ALWAYS, writeValue, 4294967295);
    state.buffers.stencil.setClear(clearValue);
    state.buffers.stencil.setLocked(true);
    renderer.setRenderTarget(readBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(writeBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this.scene, this.camera);
    state.buffers.color.setLocked(false);
    state.buffers.depth.setLocked(false);
    state.buffers.color.setMask(true);
    state.buffers.depth.setMask(true);
    state.buffers.stencil.setLocked(false);
    state.buffers.stencil.setFunc(context.EQUAL, 1, 4294967295);
    state.buffers.stencil.setOp(context.KEEP, context.KEEP, context.KEEP);
    state.buffers.stencil.setLocked(true);
  }
}
class ClearMaskPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
  }
  render(renderer) {
    renderer.state.buffers.stencil.setLocked(false);
    renderer.state.buffers.stencil.setTest(false);
  }
}
class EffectComposer {
  constructor(renderer, renderTarget) {
    this.renderer = renderer;
    this._pixelRatio = renderer.getPixelRatio();
    if (renderTarget === void 0) {
      const size = renderer.getSize(new Vector2());
      this._width = size.width;
      this._height = size.height;
      renderTarget = new WebGLRenderTarget(this._width * this._pixelRatio, this._height * this._pixelRatio, { type: HalfFloatType });
      renderTarget.texture.name = "EffectComposer.rt1";
    } else {
      this._width = renderTarget.width;
      this._height = renderTarget.height;
    }
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = "EffectComposer.rt2";
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
    this.renderToScreen = true;
    this.passes = [];
    this.copyPass = new ShaderPass(CopyShader);
    this.copyPass.material.blending = NoBlending;
    this.clock = new Clock();
  }
  swapBuffers() {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }
  addPass(pass) {
    this.passes.push(pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  insertPass(pass, index) {
    this.passes.splice(index, 0, pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  removePass(pass) {
    const index = this.passes.indexOf(pass);
    if (index !== -1) {
      this.passes.splice(index, 1);
    }
  }
  isLastEnabledPass(passIndex) {
    for (let i = passIndex + 1; i < this.passes.length; i++) {
      if (this.passes[i].enabled) {
        return false;
      }
    }
    return true;
  }
  render(deltaTime) {
    if (deltaTime === void 0) {
      deltaTime = this.clock.getDelta();
    }
    const currentRenderTarget = this.renderer.getRenderTarget();
    let maskActive = false;
    for (let i = 0, il = this.passes.length; i < il; i++) {
      const pass = this.passes[i];
      if (pass.enabled === false) continue;
      pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass(i);
      pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);
      if (pass.needsSwap) {
        if (maskActive) {
          const context = this.renderer.getContext();
          const stencil = this.renderer.state.buffers.stencil;
          stencil.setFunc(context.NOTEQUAL, 1, 4294967295);
          this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime);
          stencil.setFunc(context.EQUAL, 1, 4294967295);
        }
        this.swapBuffers();
      }
      if (MaskPass !== void 0) {
        if (pass instanceof MaskPass) {
          maskActive = true;
        } else if (pass instanceof ClearMaskPass) {
          maskActive = false;
        }
      }
    }
    this.renderer.setRenderTarget(currentRenderTarget);
  }
  reset(renderTarget) {
    if (renderTarget === void 0) {
      const size = this.renderer.getSize(new Vector2());
      this._pixelRatio = this.renderer.getPixelRatio();
      this._width = size.width;
      this._height = size.height;
      renderTarget = this.renderTarget1.clone();
      renderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  }
  setSize(width, height) {
    this._width = width;
    this._height = height;
    const effectiveWidth = this._width * this._pixelRatio;
    const effectiveHeight = this._height * this._pixelRatio;
    this.renderTarget1.setSize(effectiveWidth, effectiveHeight);
    this.renderTarget2.setSize(effectiveWidth, effectiveHeight);
    for (let i = 0; i < this.passes.length; i++) {
      this.passes[i].setSize(effectiveWidth, effectiveHeight);
    }
  }
  setPixelRatio(pixelRatio) {
    this._pixelRatio = pixelRatio;
    this.setSize(this._width, this._height);
  }
  dispose() {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.copyPass.dispose();
  }
}
const OutputShader = {
  name: "OutputShader",
  uniforms: {
    "tDiffuse": { value: null },
    "toneMappingExposure": { value: 1 }
  },
  vertexShader: (
    /* glsl */
    `
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`
  )
};
class OutputPass extends Pass {
  constructor() {
    super();
    const shader = OutputShader;
    this.uniforms = UniformsUtils.clone(shader.uniforms);
    this.material = new RawShaderMaterial({
      name: shader.name,
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this._outputColorSpace = null;
    this._toneMapping = null;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["toneMappingExposure"].value = renderer.toneMappingExposure;
    if (this._outputColorSpace !== renderer.outputColorSpace || this._toneMapping !== renderer.toneMapping) {
      this._outputColorSpace = renderer.outputColorSpace;
      this._toneMapping = renderer.toneMapping;
      this.material.defines = {};
      if (ColorManagement.getTransfer(this._outputColorSpace) === SRGBTransfer) this.material.defines.SRGB_TRANSFER = "";
      if (this._toneMapping === LinearToneMapping) this.material.defines.LINEAR_TONE_MAPPING = "";
      else if (this._toneMapping === ReinhardToneMapping) this.material.defines.REINHARD_TONE_MAPPING = "";
      else if (this._toneMapping === CineonToneMapping) this.material.defines.CINEON_TONE_MAPPING = "";
      else if (this._toneMapping === ACESFilmicToneMapping) this.material.defines.ACES_FILMIC_TONE_MAPPING = "";
      else if (this._toneMapping === AgXToneMapping) this.material.defines.AGX_TONE_MAPPING = "";
      else if (this._toneMapping === NeutralToneMapping) this.material.defines.NEUTRAL_TONE_MAPPING = "";
      this.material.needsUpdate = true;
    }
    if (this.renderToScreen === true) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      this.fsQuad.render(renderer);
    }
  }
  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
class RenderPass extends Pass {
  constructor(scene, camera, overrideMaterial = null, clearColor = null, clearAlpha = null) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.overrideMaterial = overrideMaterial;
    this.clearColor = clearColor;
    this.clearAlpha = clearAlpha;
    this.clear = true;
    this.clearDepth = false;
    this.needsSwap = false;
    this._oldClearColor = new Color();
  }
  render(renderer, writeBuffer, readBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    let oldClearAlpha, oldOverrideMaterial;
    if (this.overrideMaterial !== null) {
      oldOverrideMaterial = this.scene.overrideMaterial;
      this.scene.overrideMaterial = this.overrideMaterial;
    }
    if (this.clearColor !== null) {
      renderer.getClearColor(this._oldClearColor);
      renderer.setClearColor(this.clearColor, renderer.getClearAlpha());
    }
    if (this.clearAlpha !== null) {
      oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearAlpha(this.clearAlpha);
    }
    if (this.clearDepth == true) {
      renderer.clearDepth();
    }
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear === true) {
      renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    }
    renderer.render(this.scene, this.camera);
    if (this.clearColor !== null) {
      renderer.setClearColor(this._oldClearColor);
    }
    if (this.clearAlpha !== null) {
      renderer.setClearAlpha(oldClearAlpha);
    }
    if (this.overrideMaterial !== null) {
      this.scene.overrideMaterial = oldOverrideMaterial;
    }
    renderer.autoClear = oldAutoClear;
  }
}
const LuminosityHighPassShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "luminosityThreshold": { value: 1 },
    "smoothWidth": { value: 1 },
    "defaultColor": { value: new Color(0) },
    "defaultOpacity": { value: 0 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
  )
};
class UnrealBloomPass extends Pass {
  constructor(resolution, strength, radius, threshold) {
    super();
    this.strength = strength !== void 0 ? strength : 1;
    this.radius = radius;
    this.threshold = threshold;
    this.resolution = resolution !== void 0 ? new Vector2(resolution.x, resolution.y) : new Vector2(256, 256);
    this.clearColor = new Color(0, 0, 0);
    this.renderTargetsHorizontal = [];
    this.renderTargetsVertical = [];
    this.nMips = 5;
    let resx = Math.round(this.resolution.x / 2);
    let resy = Math.round(this.resolution.y / 2);
    this.renderTargetBright = new WebGLRenderTarget(resx, resy, { type: HalfFloatType });
    this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
    this.renderTargetBright.texture.generateMipmaps = false;
    for (let i = 0; i < this.nMips; i++) {
      const renderTargetHorizontal = new WebGLRenderTarget(resx, resy, { type: HalfFloatType });
      renderTargetHorizontal.texture.name = "UnrealBloomPass.h" + i;
      renderTargetHorizontal.texture.generateMipmaps = false;
      this.renderTargetsHorizontal.push(renderTargetHorizontal);
      const renderTargetVertical = new WebGLRenderTarget(resx, resy, { type: HalfFloatType });
      renderTargetVertical.texture.name = "UnrealBloomPass.v" + i;
      renderTargetVertical.texture.generateMipmaps = false;
      this.renderTargetsVertical.push(renderTargetVertical);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
    const highPassShader = LuminosityHighPassShader;
    this.highPassUniforms = UniformsUtils.clone(highPassShader.uniforms);
    this.highPassUniforms["luminosityThreshold"].value = threshold;
    this.highPassUniforms["smoothWidth"].value = 0.01;
    this.materialHighPassFilter = new ShaderMaterial({
      uniforms: this.highPassUniforms,
      vertexShader: highPassShader.vertexShader,
      fragmentShader: highPassShader.fragmentShader
    });
    this.separableBlurMaterials = [];
    const kernelSizeArray = [3, 5, 7, 9, 11];
    resx = Math.round(this.resolution.x / 2);
    resy = Math.round(this.resolution.y / 2);
    for (let i = 0; i < this.nMips; i++) {
      this.separableBlurMaterials.push(this.getSeparableBlurMaterial(kernelSizeArray[i]));
      this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
    this.compositeMaterial = this.getCompositeMaterial(this.nMips);
    this.compositeMaterial.uniforms["blurTexture1"].value = this.renderTargetsVertical[0].texture;
    this.compositeMaterial.uniforms["blurTexture2"].value = this.renderTargetsVertical[1].texture;
    this.compositeMaterial.uniforms["blurTexture3"].value = this.renderTargetsVertical[2].texture;
    this.compositeMaterial.uniforms["blurTexture4"].value = this.renderTargetsVertical[3].texture;
    this.compositeMaterial.uniforms["blurTexture5"].value = this.renderTargetsVertical[4].texture;
    this.compositeMaterial.uniforms["bloomStrength"].value = strength;
    this.compositeMaterial.uniforms["bloomRadius"].value = 0.1;
    const bloomFactors = [1, 0.8, 0.6, 0.4, 0.2];
    this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;
    this.bloomTintColors = [new Vector3(1, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 1)];
    this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;
    const copyShader = CopyShader;
    this.copyUniforms = UniformsUtils.clone(copyShader.uniforms);
    this.blendMaterial = new ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: copyShader.vertexShader,
      fragmentShader: copyShader.fragmentShader,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true
    });
    this.enabled = true;
    this.needsSwap = false;
    this._oldClearColor = new Color();
    this.oldClearAlpha = 1;
    this.basic = new MeshBasicMaterial();
    this.fsQuad = new FullScreenQuad(null);
  }
  dispose() {
    for (let i = 0; i < this.renderTargetsHorizontal.length; i++) {
      this.renderTargetsHorizontal[i].dispose();
    }
    for (let i = 0; i < this.renderTargetsVertical.length; i++) {
      this.renderTargetsVertical[i].dispose();
    }
    this.renderTargetBright.dispose();
    for (let i = 0; i < this.separableBlurMaterials.length; i++) {
      this.separableBlurMaterials[i].dispose();
    }
    this.compositeMaterial.dispose();
    this.blendMaterial.dispose();
    this.basic.dispose();
    this.fsQuad.dispose();
  }
  setSize(width, height) {
    let resx = Math.round(width / 2);
    let resy = Math.round(height / 2);
    this.renderTargetBright.setSize(resx, resy);
    for (let i = 0; i < this.nMips; i++) {
      this.renderTargetsHorizontal[i].setSize(resx, resy);
      this.renderTargetsVertical[i].setSize(resx, resy);
      this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
  }
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    renderer.getClearColor(this._oldClearColor);
    this.oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(this.clearColor, 0);
    if (maskActive) renderer.state.buffers.stencil.setTest(false);
    if (this.renderToScreen) {
      this.fsQuad.material = this.basic;
      this.basic.map = readBuffer.texture;
      renderer.setRenderTarget(null);
      renderer.clear();
      this.fsQuad.render(renderer);
    }
    this.highPassUniforms["tDiffuse"].value = readBuffer.texture;
    this.highPassUniforms["luminosityThreshold"].value = this.threshold;
    this.fsQuad.material = this.materialHighPassFilter;
    renderer.setRenderTarget(this.renderTargetBright);
    renderer.clear();
    this.fsQuad.render(renderer);
    let inputRenderTarget = this.renderTargetBright;
    for (let i = 0; i < this.nMips; i++) {
      this.fsQuad.material = this.separableBlurMaterials[i];
      this.separableBlurMaterials[i].uniforms["colorTexture"].value = inputRenderTarget.texture;
      this.separableBlurMaterials[i].uniforms["direction"].value = UnrealBloomPass.BlurDirectionX;
      renderer.setRenderTarget(this.renderTargetsHorizontal[i]);
      renderer.clear();
      this.fsQuad.render(renderer);
      this.separableBlurMaterials[i].uniforms["colorTexture"].value = this.renderTargetsHorizontal[i].texture;
      this.separableBlurMaterials[i].uniforms["direction"].value = UnrealBloomPass.BlurDirectionY;
      renderer.setRenderTarget(this.renderTargetsVertical[i]);
      renderer.clear();
      this.fsQuad.render(renderer);
      inputRenderTarget = this.renderTargetsVertical[i];
    }
    this.fsQuad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms["bloomStrength"].value = this.strength;
    this.compositeMaterial.uniforms["bloomRadius"].value = this.radius;
    this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;
    renderer.setRenderTarget(this.renderTargetsHorizontal[0]);
    renderer.clear();
    this.fsQuad.render(renderer);
    this.fsQuad.material = this.blendMaterial;
    this.copyUniforms["tDiffuse"].value = this.renderTargetsHorizontal[0].texture;
    if (maskActive) renderer.state.buffers.stencil.setTest(true);
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(readBuffer);
      this.fsQuad.render(renderer);
    }
    renderer.setClearColor(this._oldClearColor, this.oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }
  getSeparableBlurMaterial(kernelRadius) {
    const coefficients = [];
    for (let i = 0; i < kernelRadius; i++) {
      coefficients.push(0.39894 * Math.exp(-0.5 * i * i / (kernelRadius * kernelRadius)) / kernelRadius);
    }
    return new ShaderMaterial({
      defines: {
        "KERNEL_RADIUS": kernelRadius
      },
      uniforms: {
        "colorTexture": { value: null },
        "invSize": { value: new Vector2(0.5, 0.5) },
        // inverse texture size
        "direction": { value: new Vector2(0.5, 0.5) },
        "gaussianCoefficients": { value: coefficients }
        // precomputed Gaussian coefficients
      },
      vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
      fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
    });
  }
  getCompositeMaterial(nMips) {
    return new ShaderMaterial({
      defines: {
        "NUM_MIPS": nMips
      },
      uniforms: {
        "blurTexture1": { value: null },
        "blurTexture2": { value: null },
        "blurTexture3": { value: null },
        "blurTexture4": { value: null },
        "blurTexture5": { value: null },
        "bloomStrength": { value: 1 },
        "bloomFactors": { value: null },
        "bloomTintColors": { value: null },
        "bloomRadius": { value: 0 }
      },
      vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
      fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
    });
  }
}
UnrealBloomPass.BlurDirectionX = new Vector2(1, 0);
UnrealBloomPass.BlurDirectionY = new Vector2(0, 1);
const _vector = new Vector3();
const _viewMatrix = new Matrix4();
const _viewProjectionMatrix = new Matrix4();
const _a = new Vector3();
const _b = new Vector3();
class CSS2DRenderer {
  constructor(parameters = {}) {
    const _this = this;
    let _width, _height;
    let _widthHalf, _heightHalf;
    const cache = {
      objects: /* @__PURE__ */ new WeakMap()
    };
    const domElement = parameters.element !== void 0 ? parameters.element : document.createElement("div");
    domElement.style.overflow = "hidden";
    this.domElement = domElement;
    this.getSize = function() {
      return {
        width: _width,
        height: _height
      };
    };
    this.render = function(scene, camera) {
      if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
      if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
      _viewMatrix.copy(camera.matrixWorldInverse);
      _viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, _viewMatrix);
      renderObject(scene, scene, camera);
      zOrder(scene);
    };
    this.setSize = function(width, height) {
      _width = width;
      _height = height;
      _widthHalf = _width / 2;
      _heightHalf = _height / 2;
      domElement.style.width = width + "px";
      domElement.style.height = height + "px";
    };
    function hideObject(object) {
      if (object.isCSS2DObject) object.element.style.display = "none";
      for (let i = 0, l = object.children.length; i < l; i++) {
        hideObject(object.children[i]);
      }
    }
    function renderObject(object, scene, camera) {
      if (object.visible === false) {
        hideObject(object);
        return;
      }
      if (object.isCSS2DObject) {
        _vector.setFromMatrixPosition(object.matrixWorld);
        _vector.applyMatrix4(_viewProjectionMatrix);
        const visible = _vector.z >= -1 && _vector.z <= 1 && object.layers.test(camera.layers) === true;
        const element = object.element;
        element.style.display = visible === true ? "" : "none";
        if (visible === true) {
          object.onBeforeRender(_this, scene, camera);
          element.style.transform = "translate(" + -100 * object.center.x + "%," + -100 * object.center.y + "%)translate(" + (_vector.x * _widthHalf + _widthHalf) + "px," + (-_vector.y * _heightHalf + _heightHalf) + "px)";
          if (element.parentNode !== domElement) {
            domElement.appendChild(element);
          }
          object.onAfterRender(_this, scene, camera);
        }
        const objectData = {
          distanceToCameraSquared: getDistanceToSquared(camera, object)
        };
        cache.objects.set(object, objectData);
      }
      for (let i = 0, l = object.children.length; i < l; i++) {
        renderObject(object.children[i], scene, camera);
      }
    }
    function getDistanceToSquared(object1, object2) {
      _a.setFromMatrixPosition(object1.matrixWorld);
      _b.setFromMatrixPosition(object2.matrixWorld);
      return _a.distanceToSquared(_b);
    }
    function filterAndFlatten(scene) {
      const result = [];
      scene.traverseVisible(function(object) {
        if (object.isCSS2DObject) result.push(object);
      });
      return result;
    }
    function zOrder(scene) {
      const sorted = filterAndFlatten(scene).sort(function(a, b) {
        if (a.renderOrder !== b.renderOrder) {
          return b.renderOrder - a.renderOrder;
        }
        const distanceA = cache.objects.get(a).distanceToCameraSquared;
        const distanceB = cache.objects.get(b).distanceToCameraSquared;
        return distanceA - distanceB;
      });
      const zMax = sorted.length;
      for (let i = 0, l = sorted.length; i < l; i++) {
        sorted[i].element.style.zIndex = zMax - i;
      }
    }
  }
}
class AppRenderer {
  /**
   *
   */
  constructor(incoming_parent, incoming_camera) {
    __publicField(this, "webgl_renderer");
    __publicField(this, "css_renderer");
    __publicField(this, "composer");
    this.parent = incoming_parent;
    this.camera = incoming_camera;
    this.css_renderer = new CSS2DRenderer();
    this.css_renderer.setSize(window.innerWidth, window.innerHeight);
    this.css_renderer.domElement.style.position = "absolute";
    this.css_renderer.domElement.style.top = "0";
    this.css_renderer.domElement.style.zIndex = "1";
    document.body.appendChild(this.css_renderer.domElement);
    this.webgl_renderer = new THREE.WebGLRenderer({ antialias: true });
    this.webgl_renderer.setSize(window.innerWidth, window.innerHeight);
    this.webgl_renderer.shadowMap.enabled = true;
    this.webgl_renderer.shadowMap.type = THREE.VSMShadowMap;
    this.webgl_renderer.domElement.style.position = "absolute";
    this.webgl_renderer.domElement.style.top = "0";
    this.webgl_renderer.domElement.style.zIndex = "0";
    document.body.appendChild(this.webgl_renderer.domElement);
    this.composer = new EffectComposer(this.webgl_renderer);
    const output_pass = new OutputPass();
    const render_scene = new RenderPass(this.parent, this.camera);
    const bloom_pass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      // Resolution
      1.5,
      // Strength
      0.4,
      // Radius
      1
      // Threshold
    );
    this.composer.addPass(render_scene);
    this.composer.addPass(bloom_pass);
    this.composer.addPass(output_pass);
  }
  // ----- Functions
  /**
   *
   */
  add_event_listener(incoming_event_name, handler_method) {
    this.webgl_renderer.domElement.addEventListener(incoming_event_name, handler_method);
    this.css_renderer.domElement.addEventListener(incoming_event_name, handler_method);
  }
  /**
   *
   */
  remove_event_listener(incoming_event_name, handler_method) {
    this.webgl_renderer.domElement.removeEventListener(incoming_event_name, handler_method);
    this.css_renderer.domElement.removeEventListener(incoming_event_name, handler_method);
  }
  /**
      * Properly disposes of all renderer resources to prevent memory leaks
      */
  dispose() {
    this.webgl_renderer.setAnimationLoop(null);
    if (this.composer) {
      this.composer.passes.forEach((pass) => {
        if (pass.dispose) {
          pass.dispose();
        }
      });
    }
    if (this.webgl_renderer) {
      this.webgl_renderer.dispose();
      if (document.body.contains(this.webgl_renderer.domElement)) {
        document.body.removeChild(this.webgl_renderer.domElement);
      }
    }
    if (this.css_renderer && document.body.contains(this.css_renderer.domElement)) {
      document.body.removeChild(this.css_renderer.domElement);
    }
    this.composer = null;
    this.webgl_renderer = null;
    this.css_renderer = null;
  }
  /**
   *
   */
  render() {
    this.composer.render();
    this.css_renderer.render(this.parent, this.camera);
  }
  /**
      * Force a render. Used by the debug UI for smooth resolution changes.
      */
  forceRender() {
    this.render();
  }
  /**
   *
   */
  resize() {
    this.webgl_renderer.setSize(window.innerWidth, window.innerHeight);
    this.css_renderer.setSize(window.innerWidth, window.innerHeight);
    const bloomPass = this.composer.passes.find((pass) => pass instanceof UnrealBloomPass);
    if (bloomPass) {
      bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    }
  }
  /**
      * Sets the pixel ratio with proper handling of the post-processing pipeline
      * @param {number} ratio - The new pixel ratio
      */
  setPixelRatio(ratio) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "black";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.2s ease-in-out";
    overlay.style.zIndex = "9999";
    overlay.style.pointerEvents = "none";
    document.body.appendChild(overlay);
    const currentBgColor = window.getComputedStyle(document.body).backgroundColor || "black";
    overlay.style.backgroundColor = currentBgColor;
    overlay.offsetHeight;
    overlay.style.opacity = "0.3";
    setTimeout(() => {
      this.webgl_renderer.setPixelRatio(ratio);
      this.composer.setPixelRatio(ratio);
      this.render();
      setTimeout(() => {
        this.render();
        overlay.style.opacity = "0";
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
          this.render();
        }, 250);
      }, 50);
    }, 200);
  }
  // ----- Setters
  /**
   *
   */
  set_animation_loop(incoming_function) {
    this.webgl_renderer.setAnimationLoop(incoming_function);
  }
  // ----- Getters
  /**
      * Returns the WebGL renderer instance
      * @returns {THREE.WebGLRenderer} The WebGL renderer
      */
  get_renderer() {
    return this.webgl_renderer;
  }
}
const THROW_MULTIPLIER = 0.1;
const SHOVE_FORCE = 4;
const ZOOM_AMOUNT = 2;
let current_mouse_pos;
let initial_grab_distance = 15;
let last_position;
let last_time = 0;
let isInitialized = false;
async function initPhysicsUtil() {
  if (isInitialized) return;
  await initThree();
  current_mouse_pos = new THREE.Vector2();
  last_position = new THREE.Vector3();
  new THREE.Vector3();
  isInitialized = true;
}
function findPhysicsBody(object) {
  var _a2, _b2, _c, _d;
  if (!object) return null;
  if (object.physicsBody) return object.physicsBody;
  if ((_a2 = object.userData) == null ? void 0 : _a2.physicsBody) return object.userData.physicsBody;
  if ((_b2 = object.userData) == null ? void 0 : _b2.rootModel) {
    const rootModel = object.userData.rootModel;
    if (rootModel.physicsBody) return rootModel.physicsBody;
    if ((_c = rootModel.userData) == null ? void 0 : _c.physicsBody) return rootModel.userData.physicsBody;
  }
  const bodyPair = AssetStorage.get_instance().get_body_pair_by_mesh(object);
  if (bodyPair) return bodyPair[1];
  let current = object;
  let depth = 0;
  const MAX_DEPTH = 10;
  while (current && depth < MAX_DEPTH) {
    if (current.physicsBody) return current.physicsBody;
    if ((_d = current.userData) == null ? void 0 : _d.physicsBody) return current.userData.physicsBody;
    if (current.parent) {
      current = current.parent;
      depth++;
    } else {
      break;
    }
  }
  return null;
}
function shove_object(incoming_object, incoming_source) {
  if (!isInitialized) {
    console.warn("Physics utils not initialized. Call initPhysicsUtil() first.");
    return;
  }
  const body = findPhysicsBody(incoming_object);
  if (!body) return;
  const camera_position = new THREE.Vector3();
  incoming_source.getWorldPosition(camera_position);
  const interactable_position = new THREE.Vector3();
  incoming_object.getWorldPosition(interactable_position);
  const direction = new THREE.Vector3().subVectors(interactable_position, camera_position).normalize();
  body.applyImpulse(
    { x: direction.x * SHOVE_FORCE, y: direction.y * SHOVE_FORCE, z: direction.z * SHOVE_FORCE },
    true
  );
}
function update_mouse_position(e) {
  if (!isInitialized) return;
  current_mouse_pos.x = e.clientX / window.innerWidth * 2 - 1;
  current_mouse_pos.y = -(e.clientY / window.innerHeight) * 2 + 1;
}
function translate_object(incoming_object, incoming_camera) {
  if (!isInitialized || !incoming_object) return;
  const physicsBody = findPhysicsBody(incoming_object);
  if (!physicsBody) {
    console.warn(`No physics body found for translating: ${incoming_object.name}`);
    return;
  }
  const ray_start = new THREE.Vector3();
  const ray_end = new THREE.Vector3();
  const ray_dir = new THREE.Vector3();
  ray_start.setFromMatrixPosition(incoming_camera.matrixWorld);
  ray_end.set(current_mouse_pos.x, current_mouse_pos.y, 1).unproject(incoming_camera);
  ray_dir.subVectors(ray_end, ray_start).normalize();
  const target_pos = new THREE.Vector3();
  target_pos.copy(ray_start).addScaledVector(ray_dir, initial_grab_distance);
  physicsBody.setTranslation(
    {
      x: target_pos.x,
      y: target_pos.y,
      z: target_pos.z
    },
    true
  );
  const current_time = performance.now();
  if (current_time - last_time > 16) {
    const current_pos = physicsBody.translation();
    last_position.set(current_pos.x, current_pos.y, current_pos.z);
    last_time = current_time;
  }
}
function zoom_object_in() {
  initial_grab_distance += ZOOM_AMOUNT;
}
function zoom_object_out() {
  initial_grab_distance -= ZOOM_AMOUNT;
}
function grab_object(incoming_object, incoming_camera) {
  if (!isInitialized || !incoming_object) return;
  if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`Grabbing ${incoming_object.name}`);
  const physicsBody = findPhysicsBody(incoming_object);
  if (!physicsBody) {
    console.warn(`No physics body found for ${incoming_object.name}`, incoming_object);
    if (BLORKPACK_FLAGS.ACTIVATE_LOGS) {
      console.log("Object properties:", Object.keys(incoming_object));
      console.log("Object userData:", incoming_object.userData);
    }
    return;
  }
  if (BLORKPACK_FLAGS.ACTIVATE_LOGS) {
    console.log(`Successfully found physics body for ${incoming_object.name}`, physicsBody);
  }
  const camera_pos = new THREE.Vector3();
  incoming_camera.getWorldPosition(camera_pos);
  const object_pos = new THREE.Vector3();
  object_pos.copy(physicsBody.translation());
  initial_grab_distance = camera_pos.distanceTo(object_pos);
  last_position.copy(object_pos);
  last_time = performance.now();
  physicsBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
  incoming_object.userData.isMoving = true;
  physicsBody.wakeUp();
}
function release_object(incoming_object) {
  if (!isInitialized || !incoming_object) return;
  const physicsBody = findPhysicsBody(incoming_object);
  if (!physicsBody) {
    console.warn(`No physics body found for release: ${incoming_object.name}`);
    return;
  }
  if (BLORKPACK_FLAGS.ACTIVATE_LOGS) {
    console.log(`Successfully releasing physics body for ${incoming_object.name}`);
  }
  physicsBody.setBodyType(RAPIER.RigidBodyType.Dynamic);
  const current_time = performance.now();
  const time_diff = (current_time - last_time) / 1e3;
  if (time_diff > 0) {
    const current_pos = physicsBody.translation();
    const vel = new THREE.Vector3(
      (current_pos.x - last_position.x) / time_diff,
      (current_pos.y - last_position.y) / time_diff,
      (current_pos.z - last_position.z) / time_diff
    );
    physicsBody.applyImpulse({
      x: vel.x * THROW_MULTIPLIER,
      y: vel.y * THROW_MULTIPLIER,
      z: vel.z * THROW_MULTIPLIER
    }, true);
  }
  physicsBody.setGravityScale(1);
  incoming_object.userData.isMoving = false;
}
const MANIFEST_TYPES = {
  // This empty object helps with imports
};
const RAPIER = createRapierProxy();
const THREE = createThreeProxy();
const AssetUtils = {
  cloneSkinnedMesh: clone
};
async function initRapier() {
  return RAPIER.init();
}
async function initThree() {
  return THREE.init();
}
export {
  AppRenderer,
  AssetActivator,
  AssetSpawner,
  AssetStorage,
  AssetUtils,
  BLORKPACK_FLAGS,
  CustomTypeManager$1 as CustomTypeManager,
  Easing,
  MANIFEST_TYPES,
  ManifestManager,
  RAPIER,
  SystemAssetType,
  THREE,
  Tween,
  ensure_rapier_initialized,
  grab_object,
  initPhysicsUtil,
  initRapier,
  initThree,
  load_rapier,
  load_three,
  release_object,
  shove_object,
  translate_object,
  update as updateTween,
  update_mouse_position,
  zoom_object_in,
  zoom_object_out
};
//# sourceMappingURL=index.js.map
