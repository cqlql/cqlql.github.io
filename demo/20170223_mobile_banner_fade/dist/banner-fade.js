'use strict';

var babelHelpers = {};




var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();





var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();











































babelHelpers;

var _class$1 = function () {
    function _class(_ref) {
        var count = _ref.count;
        classCallCheck(this, _class);

        this.index = 0;
        this.count = count;
    }

    createClass(_class, [{
        key: "goRight",
        value: function goRight(ex) {
            var index = this.index,
                count = this.count;


            var currIndex = index + 1;

            if (currIndex >= count) {
                currIndex = 0;
            }

            this.index = currIndex;

            ex(index, currIndex);
        }
    }, {
        key: "goLeft",
        value: function goLeft(ex) {
            var index = this.index,
                count = this.count;


            var currIndex = this.index = index - 1;

            if (currIndex < 0) {
                currIndex = count - 1;
            }

            this.index = currIndex;

            ex(index, currIndex);
        }
    }]);
    return _class;
}();

var bannerFade = function (_ref) {
  var el = _ref.el;


  var box = el;
  var imgs = box.children;
  var count = imgs.length;

  if (count < 2) return;

  box.classList.add('animate');

  var changeBase = new _class$1({ count: imgs.length });

  document.querySelector('.btn1').addEventListener('click', function (e) {
    var target = e.target;

    if (target.classList.contains('r')) {

      changeBase.goRight(function (prei, i) {

        imgs[prei].classList.remove('fade-in');
        imgs[i].classList.add('fade-in');
      });
    } else {
      changeBase.goLeft(function (prei, i) {

        imgs[prei].classList.remove('fade-in');
        imgs[i].classList.add('fade-in');
      });
    }
  });
};

module.exports = bannerFade;
