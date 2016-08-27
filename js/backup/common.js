"use strict";

(function() {

    var c = {};

    // 去两头空格
    /**
     去两头空格
     \uFEFF 为出现在开头的特殊字符
    */
    c.trim = function(str) {
        if (str.trim) return str.trim();
        return str.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
    };

    /**
     each循環
        带length的集合对象 或 纯对象
        fn 中 返回false 将跳出
     */   
    c.each = function(obj, fn) {
        var
            key,
            len = obj && obj.length;

        if (len === undefined) {
            for (key in obj) {
                if (fn(key, obj[key]) === false) {
                    break;
                }
            }
        } else {
            for (key = 0; key < len; key++) {
                if (fn(key, obj[key], len) === false) {
                    break;
                }
            }
        }
    };

    // 类型获取
    /*
      @六种基本类型：number string boolean function object array

      @这些类型也能获取[ie678不支持这些]：
        HTMLCollection、HTMLDocument、HTMLTitleElement、HTMLHtmlElement
        这些类型使用typeof 将返回 object
     
     */
    c.getType = function(v) {

        var typeStr = typeof v,
            fullTypeStr;

        if (typeStr === 'object') {
            fullTypeStr = ({}).toString.call(v);
            return /\[object ([^\]]+)\]/.exec(fullTypeStr)[1].toLowerCase();
        } else {
            return typeStr;
        }
    };

    // JSON处理
    c.JSON = {
        // 对象转换为 json数据。解决低端浏览器不支持JSON.stringify
        stringify: function(obj) {
            var data = '',
                getType = c.getType;

            if (getType(obj) === 'object') {
                fn(obj);
                data = '{' + data.substr(0, data.length - 1) + '}';
            } else {
                arrayFn(obj);
                data = '[' + data.substr(0, data.length - 1) + ']';
            }

            return data;

            function fn(obj) {
                var val;
                var type;
                for (var key in obj) {

                    val = obj[key];
                    type = getType(val);

                    if (type === 'object') {
                        data += '"' + key + '":{';
                        fn(val);
                        data = data.substr(0, data.length - 1);
                        data += '},';

                    } else if (type === 'array') {
                        data += '"' + key + '":[';
                        arrayFn(val);
                        data = data.substr(0, data.length - 1);
                        data += '],';
                    } else {
                        data += '"' + key.replace(/"/g, '\\"') + '":"' + val.replace(/"/g, '\\"') + '",';
                    }
                }
            }

            function arrayFn(obj) {
                var val;
                var type;
                for (var key in obj) {

                    val = obj[key];
                    type = getType(val);

                    if (type === 'object') {
                        data += '{';
                        fn(val);
                        data = data.substr(0, data.length - 1);
                        data += '},';
                    } else if (type === 'array') {
                        data += '[';
                        arrayFn(val);
                        data = data.substr(0, data.length - 1);
                        data += '],';
                    } else {
                        data += '"' + val.replace(/"/g, '\\"') + '",';
                    }
                }

            }

        },
        parse: function() {

            }
            // 对象转表单数据
            ,
        formData: function(obj) {
            var data = '',
                getType = c.getType;

            fn(obj);

            return data.substr(1);

            function fn(obj, name) {

                for (var key in obj) {

                    var val = obj[key];
                    var type = getType(val);
                    var newName = name ? name + '[' + key + ']' : key;
                    if (type === 'array' || type === 'object') {
                        fn(val, newName);
                    } else {
                        data += '&' + newName + '=' + encodeURIComponent(val);
                    }
                }
            }
        }
    };

    ajaxFn(c);
    elementClassFn(c);
    getNodeFn(c);
    toNodeFn(c);
    nodeHandleFn(c);

    // ajax
    function ajaxFn(c) {
        c.ajax = function(params) {

            var
                url = params.url,
                data = params.data || null, // post 方法才有参数
                type = params.type || 'get',
                success = params.success || function() {},
                error = params.error || function() {},
                complete = params.complete || function() {},

                xhr = new XMLHttpRequest();

            xhr.addEventListener('readystatechange', onReadystatechange, false);

            xhr.open(type, url);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded;charset=utf-8");
            //xhr.setRequestHeader("Content-type", "application/json");

            //xhr.send(data);
            //xhr.send(JSON.stringify({content:'xxx'}));
            xhr.send(buildFormData(data));

            return xhr;

            function buildFormData(jsonData) {

                var data = '';

                fn(jsonData);

                return data.substr(1);

                function fn(obj, name) {

                    for (var key in obj) {

                        var val = obj[key];
                        var type = getType(val);
                        var newName = name ? name + '[' + key + ']' : key;
                        console.log(type);
                        if (type === 'array' || type === 'object') {
                            fn(val, newName);
                        } else {
                            data += '&' + newName + '=' + val;
                        }
                    }
                }

                function getType(v) {

                    var typeStr = typeof v,
                        fullTypeStr;

                    if (typeStr === 'object') {
                        fullTypeStr = ({}).toString.call(v);
                        return /\[object ([^\]]+)\]/.exec(fullTypeStr)[1].toLowerCase();
                    } else {
                        return typeStr;
                    }
                }

            }

            function onReadystatechange() {
                if (xhr.readyState === 4) {

                    if (xhr.status === 200) {
                        success(xhr.responseText);
                    } else {
                        error(xhr, xhr.status, arguments);
                    }

                    complete();
                }
            }
        };

        c.post = function(params) {

            var
                url = params.url,
                data = params.data || null,
                contentType = params.contentType || 'application/x-www-form-urlencoded',
                success = params.success || function() {},
                error = params.error || function() {},
                complete = params.complete || function() {},

                xhr = new XMLHttpRequest();

            var buildFormData = c.JSON.formData;

            xhr.addEventListener('readystatechange', onReadystatechange, false);

            xhr.open('post', url);

            xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

            xhr.send(dataStringify(data));

            return xhr;

            function onReadystatechange() {
                if (xhr.readyState === 4) {

                    if (xhr.status === 200) {
                        success(xhr.responseText);
                    } else {
                        error(xhr, xhr.status, arguments);
                    }

                    complete();
                }
            }

            function dataStringify(data) {
                if (data) {
                    if (contentType.toLowerCase() === 'application/json') {
                        data = JSON.stringify(data);
                    } else {
                        data = buildFormData(data);
                    }
                }

                return data;
            }
        };

        c.get = function(params) {

            var
                url = params.url,
                data = params.data,
            //contentType = params.contentType || 'application/x-www-form-urlencoded',
                success = params.success || function() {},
                error = params.error || function() {},
                complete = params.complete || function() {},

                xhr = new XMLHttpRequest();

            var buildFormData = c.JSON.formData;

            xhr.addEventListener('readystatechange', onReadystatechange, false);

            xhr.open('get', url + dataStringify(data));

            //xhr.setRequestHeader("Content-type", contentType + ";charset=utf-8");

            xhr.send(null);

            return xhr;

            function onReadystatechange() {
                if (xhr.readyState === 4) {

                    if (xhr.status === 200) {
                        success(xhr.responseText);
                    } else {
                        error(xhr, xhr.status, arguments);
                    }

                    complete();
                }
            }

            function dataStringify(data) {
                if (data) {
                    data = '?' + buildFormData(data);
                } else {
                    data = '';
                }

                return data;
            }
        };
    }

    // className 相关
    function elementClassFn(c) {
        c.hasClass = function(elem, className) {
            if (elem) return (' ' + elem.className + ' ').indexOf(' ' + c.trim(className) + ' ') > -1;
            return false;
        };

        c.addClass = function(elem, className) {

            if (elem.classList) {
                elem.classList.add(className);
            } else if (c.hasClass(elem, className) === false) {
                elem.className = c.trim((elem.className + ' ' + className).replace(/\s{2,}/g, ' '));
            }
        };

        c.removeClass = function(elem, className) {
            if (elem.classList) {
                elem.classList.remove(className);
            } else {
                elem.className = (' ' + elem.className + ' ').replace(' ' + c.trim(className) + ' ', '');
            }
        };
    }

    // 获取
    function getNodeFn(c) {

        // 根据className取
        /**
         根据className取
         @param elem [element] 某祖先元素
         @param className string

         @return array,HTMLCollection 元素集合。旧版浏览器将返回array

         @兼容性 所有浏览器
         */
        c.getElementsByClassName = function(elem, className) {

            if (elem.getElementsByClassName) {
                return elem.getElementsByClassName(className);
            }

            return this.filtrateElementsByClassName(className, elem.getElementsByTagName("*"));
        };

        // 过滤 元素集合 根据className
        /**

         @return array 元素数组
         */
        c.filtrateElementsByClassName = function(elems, className) {

            var array = [];

            //过滤
            for (var i = 0, len = elems.length; i < len; i++) {
                if (this.hasClass(elems[i], className)) array.push(elems[i]);
            }

            return array;
        };

        // 紧邻同辈元素 获取
        /**
         获取某节点 紧邻的 上或下 单个 同辈元素节点

         @param node 节点对象，一般为元素节点
         @param isPrev * [bool] 能代表真假的任意值，默认是假，即下一个，否则上一个

         @return [node] 元素节点 或者为 null

         @compatibility 所有浏览器
         */
        c.siblingElement = function(node, isPrev) {

            var str = isPrev ? "previousSibling" : "nextSibling";

            do {
                node = node[str];
                if (node === null) return null;
            } while (node.nodeType !== 1)

            return node;
        };

    }

    // 字符串等 转node
    function toNodeFn(c) {
        // html -> elem
        /*
         html转对象，返回一个新div，html是此div对象的内容
         */
        c.htmlToElem = function(html) {
            var eTemp = document.createElement('div');
            eTemp.innerHTML = html;
            return eTemp;
        };
        // html -> elems
        c.htmlToElems = function(html) {
            return this.htmlToElem(html).children;
        };

        // html -> 节点对象
        c.htmlToNode = function(html) {
            var elem = document.createElement('div');
            elem.innerHTML = html;
            return elem.childNodes;
        };

        // HTMLCollection,array,html -> fragment
        /*
         @param (HTMLCollection,array,string) HTMLCollection集合，或者元素数组，可以是多个。html可以标签文本随意组合
         @regurn (array) 第一个是片段，第二个是多个节点的数组
         @兼容性 如需支持ie67，需修改其中判断手法，已标注
         */
        c.toFragment = function(newItems) {
            var fragment = document.createDocumentFragment(),
                nodes = [];

            switch (this.getType(newItems)) {
                case 'string':
                    newItems = this.htmlToElem(newItems).childNodes;
                    break;
                default:
                    if (newItems.length === undefined) {
                        newItems = [newItems];
                    }
            }

            if (newItems instanceof HTMLCollection) {
                // 此种判断手法不支持ie67
                // HTMLCollection 集合情况。此集合特性将取一个就会少一个
                for (var i = 0, that, len = newItems.length; i < len; i++) {
                    that = newItems[0];
                    fragment.appendChild(that);
                    nodes.push(that);
                }
            } else {
                this.each(newItems, function(i, that) {
                    fragment.appendChild(that);
                });
                nodes = newItems;
            }

            return [fragment, nodes];
        };
    }

    // node处理。比如 增加、删除、移动文档位置 等等
    function nodeHandleFn(c) {
        // 紧邻元素之后插入
        /*
         @param (element) item 位置元素。将紧邻此元素之后追加
         @param (HTMLCollection,array,html) newItems 追加的元素，可以是多个。html可以标签文本随意组合

         @return (array) 新加的节点集合
         */
        c.insertAfter = function(item, newItems) {
            var params = this.toFragment(newItems);
            elementInsertAfter(item, params[0]);
            return params[1];

            function elementInsertAfter(item, newItem) {
                var next = c.siblingElement(item);

                if (next) {
                    item.parentNode.insertBefore(newItem, next);
                } else {
                    item.parentNode.appendChild(newItem);
                }
            }
        };

        // 追加元素
        /*
         @return array,element 返回添加的元素，单个情况 直接返回元素，多个情况 返回元素集合
         */
        c.appendChildHtml = function(eBox, html) {
            var
                fragment,
                newChild = [],
                chils, len;

            chils = this.htmlToElems(html);

            len = chils.length;

            if (len > 1) {
                fragment = document.createDocumentFragment();

                for (var i = 0, that; i < len; i++) {
                    that = chils[0];
                    fragment.appendChild(that);
                    newChild.push(that);
                }

                eBox.appendChild(fragment);

                return newChild;

            }
            newChild = chils[0];

            eBox.appendChild(newChild);

            return newChild;
        };

        // 追加元素2，全功能
        /*
         内部之后追加，参数2支持节点集合、数组、html字符串，详见 this.toFragment
         */
        c.appendChild = function(eBox, newItems) {
            var params = this.toFragment(newItems);
            eBox.appendChild(params[0]);
            return params[1];
        };

        // 元素删除
        c.removeElement = function(elem) {
            if ('remove' in elem) {
                elem.remove();
            } else {
                elem.parentNode.removeChild(elem);
            }
        };
    }

    window.c = c;

})();