
$(function () {
    var c = common,
    m = {};

    //#region 知识点导入
    m.importKnowledgePopup = (function () {
        function treeFnInit(jBox) {
            
            jBox.on({
                'click': function (e) {
                    var target = e.target,
                        eIn;
                    if (target.tagName === 'S') {
                        fold(target.parentElement.parentElement.parentElement);
                        return false;
                    }
                    else if (target.tagName === 'B') {
                        fold(target.parentElement.parentElement);
                    }
                    else if (target.tagName === 'INPUT') {
                        clickInput(target);
                    }
                    else if (target.tagName === 'SPAN' || (target.tagName === 'A' && target.className.indexOf('have') === -1)) {
                        eIn = target.parentElement.getElementsByTagName('input')[0];
                        makeChange(target.parentElement.getElementsByTagName('input')[0]);
                    }
                    else if (target.className.indexOf('item') > -1) {

                        eIn = target.getElementsByTagName('input')[0];
                        makeChange(target.getElementsByTagName('input')[0]);
                    }
                    
                },
                mousedown: function (e) {
                    if (e.target.tagName !== 'SPAN') {
                        return false;
                    }

                }
            });

            function makeChange(eIn) {
                if (eIn.checked) {
                    eIn.checked = false;
                }
                else {
                    eIn.checked = true;

                }
                clickInput(eIn);
            }

            // 折叠\展开
            function fold(eItem) {
                var jItem = $(eItem);
                if (jItem.hasClass('show')) {
                    jItem.removeClass('show');
                }
                else {
                    jItem.addClass('show');
                }
            }

            // 展开
            function unfold(jItem, jListBox) {

                jItem.addClass('show');

                jListBox.find('.list').each(function () {
                    $(this).prev().addClass('show');
                });
            }

            function clickInput(eInput) {
                var jIn = $(eInput),
                    jListBox,
                    jParentListBox,
                    jTempListBox,
                    jItem,
                    allChecked = true;

                jItem = jIn.parent();

                jListBox = jItem.next();

                jParentListBox = jItem.parent();

                if (eInput.checked) {
                    unfold(jItem, jListBox);
                }

                if (jListBox.hasClass('list')) {
                    if (eInput.checked) {
                        jListBox.find('input').prop('checked', true);
                    }
                    else {
                        jListBox.find('input').prop('checked', false);
                    }
                }

                while (jParentListBox.hasClass('list')) {

                    jParentListBox.children().children('input').each(function () {
                        if (!this.checked) {
                            allChecked = false;
                        }
                    });

                    if (allChecked) {
                        jParentListBox.prev().children('input')[0].checked = true;
                    }
                    else {
                        jParentListBox.prev().children('input')[0].checked = false;
                    }

                    allChecked = true;

                    jParentListBox = jParentListBox.parent();


                }
            }

        }

        return function (excuImport) {

            var ajaxTree = (function () {
                var xhr = null;

                function abort() {
                    if (xhr) {
                        xhr.abort();
                        xhr = null;
                    }
                }

                function ajaxTree(params) {
                    xhr = ajaxTreeExcu(params);
                }

                ajaxTree.abort = abort;


                return ajaxTree;

            })();

            var ajaxSelect = (function () {
                var xhr = null;

                function abort() {
                    if (xhr) {
                        xhr.abort();
                        xhr = null;
                    }
                }

                function ajaxSelect(params) {
                    xhr = ajaxSelectExcu(params);
                }

                ajaxSelect.abort = abort;

                return ajaxSelect;

            })();

            c.popup.show({
                title: '导入知识点资源',
                width: 550,
                onCloseBtn: closePopup,
                onShowBefore: function (popup) {
                    popup.jBox.addClass('loading');

                    ajaxSelect({
                        success: function (d) {

                            popup.jBox.removeClass('loading');

                            init(d, popup.jConBox);

                        },
                        error: function () {
                            c.msg(1, '加载知识点失败');
                        },
                        complete: function () {

                        }
                    });

                }

            });

            function closePopup() {
                ajaxSelect.abort();
                ajaxTree.abort();
                c.popup.close();
            }

            function ajaxTreeExcu(params) {
                var success = params.success
                    , complete = params.complete
                    , stopId;

                stopId = setTimeout(function () {
                    success([{
                        "id": 19,
                        "name": "数字",
                        "point_id": 2,
                        "parent_id": 0,
                        "level": 1,
                        "sort": 1,
                        "path": "19",
                        "is_deleted": false,
                        "deleted_on": "0001-01-01T00:00:00",
                        "resource_id": 0,
                        "children": [{
                            "id": 20,
                            "name": "个位数",
                            "point_id": 2,
                            "parent_id": 19,
                            "level": 2,
                            "sort": 1,
                            "path": "19,20",
                            "is_deleted": false,
                            "deleted_on": "0001-01-01T00:00:00",
                            "resource_id": 0,
                            "children": [{
                                "id": 21,
                                "name": "书写",
                                "point_id": 2,
                                "parent_id": 20,
                                "level": 3,
                                "sort": 1,
                                "path": "19,20,21",
                                "is_deleted": false,
                                "deleted_on": "0001-01-01T00:00:00",
                                "resource_id": 5306979169538629000,
                                "children": []
                            }, {
                                "id": 22,
                                "name": "加法",
                                "point_id": 2,
                                "parent_id": 0,
                                "level": 1,
                                "sort": 2,
                                "path": "22",
                                "is_deleted": false,
                                "deleted_on": "0001-01-01T00:00:00",
                                "resource_id": 0,
                                "children": [{
                                    "id": 23,
                                    "name": "十以内",
                                    "point_id": 2,
                                    "parent_id": 22,
                                    "level": 2,
                                    "sort": 1,
                                    "path": "22,23",
                                    "is_deleted": false,
                                    "deleted_on": "0001-01-01T00:00:00",
                                    "resource_id": 0,
                                    "children": []
                                }, {
                                    "id": 24,
                                    "name": "二十以内",
                                    "point_id": 2,
                                    "parent_id": 22,
                                    "level": 2,
                                    "sort": 2,
                                    "path": "22,24",
                                    "is_deleted": false,
                                    "deleted_on": "0001-01-01T00:00:00",
                                    "resource_id": 0,
                                    "children": []
                                }]
                            }]
                        }]
                    }, {
                        "id": 22,
                        "name": "加法",
                        "point_id": 2,
                        "parent_id": 0,
                        "level": 1,
                        "sort": 2,
                        "path": "22",
                        "is_deleted": false,
                        "deleted_on": "0001-01-01T00:00:00",
                        "resource_id": 0,
                        "children": [{
                            "id": 23,
                            "name": "十以内",
                            "point_id": 2,
                            "parent_id": 22,
                            "level": 2,
                            "sort": 1,
                            "path": "22,23",
                            "is_deleted": false,
                            "deleted_on": "0001-01-01T00:00:00",
                            "resource_id": 0,
                            "children": []
                        }, {
                            "id": 24,
                            "name": "二十以内",
                            "point_id": 2,
                            "parent_id": 22,
                            "level": 2,
                            "sort": 2,
                            "path": "22,24",
                            "is_deleted": false,
                            "deleted_on": "0001-01-01T00:00:00",
                            "resource_id": 0,
                            "children": []
                        }]
                    }, {
                        "id": 19,
                        "name": "数字",
                        "point_id": 2,
                        "parent_id": 0,
                        "level": 1,
                        "sort": 1,
                        "path": "19",
                        "is_deleted": false,
                        "deleted_on": "0001-01-01T00:00:00",
                        "resource_id": 0,
                        "children": [{
                            "id": 20,
                            "name": "个位数",
                            "point_id": 2,
                            "parent_id": 19,
                            "level": 2,
                            "sort": 1,
                            "path": "19,20",
                            "is_deleted": false,
                            "deleted_on": "0001-01-01T00:00:00",
                            "resource_id": 0,
                            "children": [{
                                "id": 21,
                                "name": "书写",
                                "point_id": 2,
                                "parent_id": 20,
                                "level": 3,
                                "sort": 1,
                                "path": "19,20,21",
                                "is_deleted": false,
                                "deleted_on": "0001-01-01T00:00:00",
                                "resource_id": 5306979169538629000,
                                "children": []
                            }, {
                                "id": 22,
                                "name": "加法",
                                "point_id": 2,
                                "parent_id": 0,
                                "level": 1,
                                "sort": 2,
                                "path": "22",
                                "is_deleted": false,
                                "deleted_on": "0001-01-01T00:00:00",
                                "resource_id": 0,
                                "children": [{
                                    "id": 23,
                                    "name": "十以内",
                                    "point_id": 2,
                                    "parent_id": 22,
                                    "level": 2,
                                    "sort": 1,
                                    "path": "22,23",
                                    "is_deleted": false,
                                    "deleted_on": "0001-01-01T00:00:00",
                                    "resource_id": 0,
                                    "children": []
                                }, {
                                    "id": 24,
                                    "name": "二十以内",
                                    "point_id": 2,
                                    "parent_id": 22,
                                    "level": 2,
                                    "sort": 2,
                                    "path": "22,24",
                                    "is_deleted": false,
                                    "deleted_on": "0001-01-01T00:00:00",
                                    "resource_id": 0,
                                    "children": []
                                }]
                            }]
                        }]
                    }, {
                        "id": 22,
                        "name": "加法",
                        "point_id": 2,
                        "parent_id": 0,
                        "level": 1,
                        "sort": 2,
                        "path": "22",
                        "is_deleted": false,
                        "deleted_on": "0001-01-01T00:00:00",
                        "resource_id": 0,
                        "children": [{
                            "id": 23,
                            "name": "十以内",
                            "point_id": 2,
                            "parent_id": 22,
                            "level": 2,
                            "sort": 1,
                            "path": "22,23",
                            "is_deleted": false,
                            "deleted_on": "0001-01-01T00:00:00",
                            "resource_id": 0,
                            "children": []
                        }, {
                            "id": 24,
                            "name": "二十以内",
                            "point_id": 2,
                            "parent_id": 22,
                            "level": 2,
                            "sort": 2,
                            "path": "22,24",
                            "is_deleted": false,
                            "deleted_on": "0001-01-01T00:00:00",
                            "resource_id": 0,
                            "children": []
                        }]
                    }]);

                    complete();
                }, 1000);

                return {
                    abort: function () {
                        clearTimeout(stopId);
                        complete();
                    }
                };
            }

            function ajaxSelectExcu(params) {
                var success = params.success
                    , complete = params.complete
                    , stopId;

                stopId = setTimeout(function () {
                    success([{
                        name:'高中数学知识点'
                    }, {
                        name: '初中数学知识点'
                    }]);

                    complete();
                }, 1000);

                return {
                    abort: function () {
                        clearTimeout(stopId);
                        complete();
                    }
                };
            }

            function treeDataHandle(params) {
                var data=params.data,
                    jTreeRow = params.jTreeRow;

                ajaxTree.abort();

                jTreeRow.addClass('loading');

                ajaxTree({
                    data: data,
                    success: function (d) {

                        jTreeRow.html(buildHtml(d));

                        treeFnInit(jTreeRow.children());

                    },
                    error: function () {
                        jTreeRow.html('<div class="error">加载失败</div>');
                    },
                    complete: function () {
                        
                        jTreeRow.removeClass('loading');
                    }
                });
            }

            function init(d, jConBox) {
                var html = '<div class=import-knowledge><div class="sel-row select_s1"><label>知识点：</label><select><option value="1">高中数学知识点<option value="2">初中数学知识点</select><span>【备注】只有末级节点才有知识点资源</span></div><div class="tree-row"></div><div class=btns-s1><button class=button>确定</button><button class="button red">取消</button></div></div>',
                    jBox,
                    jChils,
                    jSelect,
                    jTreeRow,
                     jBtns;

                jConBox.append(html);

                jBox = jConBox.children();

                jChils = jBox.children();

                jSelect = jChils.eq(0).children('select');

                jTreeRow = jChils.eq(1);
               
                jBtns = jChils.eq(2).children();

                jBtns.click(function () {
                    if (jBtns.index(this)) {
                        closePopup();
                    }
                    else {

                        // 待晚上

                        jTreeRow.find('.have').each(function () {
                            console.log($(this).parent());
                        });

                        excuImport();
                    }
                });

                jSelect.change(function () {
                    treeDataHandle({
                        data: { id: jSelect.val() },
                        jTreeRow: jTreeRow
                    });
                });

                treeDataHandle({
                    data: { id: jSelect.val() },
                    jTreeRow: jTreeRow
                });
            }

            function buildHtml(d) {

                var html = '<div class="tree-s1">';

                handle(d);
                
                html += '</div>';

                return html;

                function handle(d) {
                    $.each(d, function (i, l) {

                        if (l.children.length) {
                            html += '<div class="item"><span class="f"><b><s></s></b></span><input type="checkbox"><i></i><span>'+l.name+'</span></div>';

                            html += '<div class="list">';

                            handle(l.children);

                            html += '</div>';
                        }
                        else {
                            html += '<div class="item"><span class="f"></span><input type="checkbox"><i></i><span>' + l.name + '</span>' + (l.resource_id != 0 ? '<a href="" class="have">预览</a>' : '<a>暂无资源</a>') + '</div>';
                        }

                    });
                }
            }
        };

    })();
    //#endregion

    m.importKnowledgePopup(function () {

    });






});