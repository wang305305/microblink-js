var ResizeSensor = (function () {

	if (typeof window === "undefined") {
		return null;
	}

	var requestAnimationFrame = window.requestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		function (fn) {
			return window.setTimeout(fn, 20);
		};

	function forEachElement(elements, callback){
		var elementsType = Object.prototype.toString.call(elements);
		var isCollectionTyped = ('[object Array]' === elementsType
			|| ('[object NodeList]' === elementsType)
			|| ('[object HTMLCollection]' === elementsType)
			|| ('[object Object]' === elementsType)
			|| ('undefined' !== typeof jQuery && elements instanceof jQuery) //jquery
			|| ('undefined' !== typeof Elements && elements instanceof Elements) //mootools
		);
		var i = 0, j = elements.length;
		if (isCollectionTyped) {
			for (; i < j; i++) {
				callback(elements[i]);
			}
		} else {
			callback(elements);
		}
	}

	function getElementSize(element) {
		if (!element.getBoundingClientRect) {
			return {
				width: element.offsetWidth,
				height: element.offsetHeight
			}
		}
		var rect = element.getBoundingClientRect();
		return {
			width: Math.round(rect.width),
			height: Math.round(rect.height)
		}
	}

	var ResizeSensor = function(element, callback) {

		var observer;

		function EventQueue() {
			var q = [];
			this.add = function(ev) {
				q.push(ev);
			};
			var i, j;
			this.call = function(sizeInfo) {
				for (i = 0, j = q.length; i < j; i++) {
					q[i].call(this, sizeInfo);
				}
			};
			this.remove = function(ev) {
				var newQueue = [];
				for(i = 0, j = q.length; i < j; i++) {
					if(q[i] !== ev) newQueue.push(q[i]);
				}
				q = newQueue;
			};
			this.length = function() {
				return q.length;
			}
		}

		function attachResizeEvent(element, resized) {
			if (!element) return;
			if (element.resizedAttached) {
				element.resizedAttached.add(resized);
				return;
			}
			element.resizedAttached = new EventQueue();
			element.resizedAttached.add(resized);
			element.resizeSensor = document.createElement('div');
			element.resizeSensor.dir = 'ltr';
			element.resizeSensor.className = 'resize-sensor';
			var style = 'position: absolute; left: -10px; top: -10px; right: 0; bottom: 0; overflow: hidden; z-index: -1; visibility: hidden; max-width: 100%';
			var styleChild = 'position: absolute; left: 0; top: 0; transition: 0s;';
			element.resizeSensor.style.cssText = style;
			element.resizeSensor.innerHTML =
				'<div class="resize-sensor-expand" style="' + style + '">' +
				'<div style="' + styleChild + '"></div>' +
				'</div>' +
				'<div class="resize-sensor-shrink" style="' + style + '">' +
				'<div style="' + styleChild + ' width: 200%; height: 200%"></div>' +
				'</div>';
			element.appendChild(element.resizeSensor);

			var computedStyle = window.getComputedStyle(element);
			var position = computedStyle ? computedStyle.getPropertyValue('position') : null;
			if ('absolute' !== position && 'relative' !== position && 'fixed' !== position) {
				element.style.position = 'relative';
			}

			var expand = element.resizeSensor.childNodes[0];
			var expandChild = expand.childNodes[0];
			var shrink = element.resizeSensor.childNodes[1];

			var dirty, rafId;
			var size = getElementSize(element);
			var lastWidth = size.width;
			var lastHeight = size.height;
			var initialHiddenCheck = true, resetRAF_id;

			var resetExpandShrink = function () {
				expandChild.style.width = '100000px';
				expandChild.style.height = '100000px';

				expand.scrollLeft = 100000;
				expand.scrollTop = 100000;

				shrink.scrollLeft = 100000;
				shrink.scrollTop = 100000;
			};

			var reset = function() {
				if (initialHiddenCheck) {
					if (!expand.scrollTop && !expand.scrollLeft) {
						resetExpandShrink();
						if (!resetRAF_id){
							resetRAF_id = requestAnimationFrame(function(){
								resetRAF_id = 0;
								reset();
							});
						}
						return;
					} else {
						initialHiddenCheck = false;
					}
				}
				resetExpandShrink();
			};
			element.resizeSensor.resetSensor = reset;

			var onResized = function() {
				rafId = 0;
				if (!dirty) return;

				lastWidth = size.width;
				lastHeight = size.height;

				if (element.resizedAttached) {
					element.resizedAttached.call(size);
				}
			};

			var onScroll = function() {
				size = getElementSize(element);
				dirty = size.width !== lastWidth || size.height !== lastHeight;

				if (dirty && !rafId) {
					rafId = requestAnimationFrame(onResized);
				}
				reset();
			};

			var addEvent = function(el, name, cb) {
				if (el.attachEvent) {
					el.attachEvent('on' + name, cb);
				} else {
					el.addEventListener(name, cb);
				}
			};

			addEvent(expand, 'scroll', onScroll);
			addEvent(shrink, 'scroll', onScroll);
			requestAnimationFrame(reset);
		}

		if (typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(function(element){
				forEachElement(element, function (elem) {
					callback.call(
						this,
						{
							width: elem.contentRect.width,
							height: elem.contentRect.height
						}
					);
				});
			});
			if (element !== undefined) {
				forEachElement(element, function(elem){
					observer.observe(elem);
				});
			}
		}
		else {
			forEachElement(element, function(elem){
				attachResizeEvent(elem, callback);
			});
		}

		this.detach = function(ev) {
			if (typeof ResizeObserver != "undefined") {
				forEachElement(element, function(elem){
					observer.unobserve(elem);
				});
			}
			else {
				ResizeSensor.detach(element, ev);
			}
		};

		this.reset = function() {
			element.resizeSensor.resetSensor();
		};
	};

	ResizeSensor.reset = function(element, ev) {
		forEachElement(element, function(elem){
			elem.resizeSensor.resetSensor();
		});
	};

	ResizeSensor.detach = function(element, ev) {
		forEachElement(element, function(elem){
			if (!elem) return;
			if(elem.resizedAttached && typeof ev === "function"){
				elem.resizedAttached.remove(ev);
				if(elem.resizedAttached.length()) return;
			}
			if (elem.resizeSensor) {
				if (elem.contains(elem.resizeSensor)) {
					elem.removeChild(elem.resizeSensor);
				}
				delete elem.resizeSensor;
				delete elem.resizedAttached;
			}
		});
	};
	return ResizeSensor;
})();

export default ResizeSensor;