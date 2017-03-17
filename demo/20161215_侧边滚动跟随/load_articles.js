define(function (require, exports, module) {

    var user = require('./common/com_login');
    var comTip = require('./common/com_tips').tip1;
    var author_focus = require('./common/com_author_focus');
    var send_message = require('./common/com_send_message');
    var comment = require('./common/com_comment');
    require.async('jquery.js', function () {
        //获取文章
        var canload = true;
        var ofsTop = 0;
        var sclTop = 0;

        function loadArticle(uniqueCode, callback) {

            if (canload == true) {
                $(".lphArticle-detail").append('<div class="loadNext"><img src=' + SCRIPT_URL + '/resWeb/images/common/loading.gif /></div>')
                canload = false;
                $.ajax({
                    url: BASE_URL + 'article/ajaxView',
                    dataType: 'json',
                    type: 'get',
                    data: {
                        uniqueCode: uniqueCode,
                    },
                    success: function (data) {
                        $(".lphArticle-detail .loadNext").remove();
                        callback && callback(data);
                        canload = true;
                    },
                    error: function (data) {
                        $(".lphArticle-detail .loadNext").remove();
                        //YP_alert(data)
                    }
                })
            }
        }

        //url
        var App = {
            Init: function () {
                App.State(title, url);
                App.StateListen();
            },
            State: function (title, url) {//无刷新改变URL
                if (window.history.pushState) {
                    window.history.pushState({title: title, url: url}, title, url);
                } else {
                    location.href = url;
                }
                document.title = title;
            },
            StateListen: function () {//监听地址
                var url = location.href.toString().split("/");
                window.addEventListener('popstate', function (e) {
                    if (history.state) {
                        var url = e.state.url;
                        //根据url值进行相应操作
                    }
                }, false);
            }
        };

        var loadArticleInfo = {
            dom: $('.lphArticle-detail'),
            uniqueCode: $('.lphArticle-detail').data('article_unique'),
            articleId: $('.lphArticle-detail').data('article_id'),
            articleUrl: $('.lphArticle-detail').data('article_url'),
            commentType: $('.lphArticle-detail').data("comment_type"),
            seoTitle: $('.lphArticle-detail').data('article_seo_title'),
            seoKeywords: $('.lphArticle-detail').data('article_seo_keywords'),
            seoDescription: $('.lphArticle-detail').data('article_seo_description'),
            load: function () {

                //加载处理文章
                if (loadArticleInfo.uniqueCode != false) {

                    loadArticle(loadArticleInfo.uniqueCode, function (data) {
                        if (data.status == 1) {

                            loadArticleInfo.dom.after(data.html);
                            var html = $('.lphArticle-detail').last();

                            //绑定为下一篇文章的参数
                            loadArticleInfo.dom = html;
                            loadArticleInfo.uniqueCode = html.data('article_unique');
                            loadArticleInfo.articleId = html.data('article_id');
                            loadArticleInfo.articleUrl = html.data('article_url');
                            loadArticleInfo.seoTitle = html.data('article_seo_title');
                            loadArticleInfo.commentType = html.data("comment_type"),
                                loadArticleInfo.seoKeywords = html.data('article_seo_keywords');
                            loadArticleInfo.seoDescription = html.data('article_seo_description');
                            loadArticleInfo.cmtNums = html.data('article_cmtNum');

                            //页面不刷新改变地址栏，并且手动刷新后为更改后的页面
                            App.State(loadArticleInfo.seoTitle, loadArticleInfo.articleUrl);

                            //设置页面的seo
                            $(document).find('meta[name="keywords"]').attr('content', loadArticleInfo.seoKeywords);
                            $(document).find('meta[name="description"]').attr('content', loadArticleInfo.seoDescription);

                            // 设置当前文章的评论数
                            $(".cmtNums p").html(loadArticleInfo.cmtNums);
                            $(".cmtNums").attr("href", '#lph-comment-' + loadArticleInfo.articleId);

                            //加载当前文章的评论
                            $.ajax({
                                url: HOME_URL + 'comment/loadCommentJson?item_id=' + loadArticleInfo.articleId + "&type=" + loadArticleInfo.commentType,
                                dataType: 'jsonp',
                                success: function (data) {

                                    comment.pc(loadArticleInfo.dom)

                                }
                            });

                            //百度分享
                            //window._bd_share_main&&
                            window._bd_share_main.init()

                            $(document).find(".sub_a").hover(function () {
                                $(this).addClass('enter');
                            }, function () {
                                var _this = $(this);
                                _this.removeClass('enter').addClass('leave');
                                setTimeout(function () {
                                    _this.removeClass('leave')
                                }, 500);
                            });

                            $(window).scroll();

                        } else {
                            loadArticleInfo.uniqueCode == false;
                        }
                    })


                }
            },
            changeUrl: function () {

                //  $(document.body).children('.lphArticle-detail').each(function(){

                //     if($(this).offset().top-pageYOffset>window.innerHeight/2){

                //         console.log(this.previousElementSibling.getAttribute('data-article_url'))
                //         history.pushState("", "", this.previousElementSibling.getAttribute('data-article_url'));
                //         return false;

                //     }
                // });
            }
        }


        var excuFrequency = new ExcuFrequency();

        $(window).scroll(function () {

            if ($('body').height() - $(window).scrollTop() - $(window).height() < 800) {

                loadArticleInfo.load();

            }

            //修改地址栏地址
            excuFrequency.excu(function () {
                var childs = $(document.body).children('.lphArticle-detail'),
                    len = childs.length;
                childs.each(function (i) {

                    sideSyn(this);

                    if ($(this).offset().top - pageYOffset > window.innerHeight / 2) {

                        // 此为要显示url 的  div.lphArticle-detail
                        history.pushState('', "", this.previousElementSibling.getAttribute('data-article_url'));
                        //设置页面的seo,title
                        document.title = this.previousElementSibling.getAttribute('data-article_seo_title')
                        $(document).find('meta[name="keywords"]').attr('content', this.previousElementSibling.getAttribute('data-article_seo_keywords'));
                        $(document).find('meta[name="description"]').attr('content', this.previousElementSibling.getAttribute('data-article_seo_description'));
                        // 设置当前文章的评论数
                        $(".cmtNums p").html(this.previousElementSibling.getAttribute('data-article_cmtNum'));

                        $(".cmtNums").attr("href", '#lph-comment-' + this.previousElementSibling.getAttribute('data-article_id'));

                        return false;
                    }
                    else if (i === len - 1) {
                        history.pushState('', "", this.getAttribute('data-article_url'));
                    }

                });
            }, 20);

        });

        function ExcuFrequency() {
            var status = 0;
            this.excu = function (fn, time) {
                if (status) return;
                status = 1;
                setTimeout(function () {
                    fn();
                    status = 0;
                }, time === undefined ? 600 : time);
            }
        }

        function sideSyn(elem) {
            var jWin = $(window);

            function excu(elem) {

                var jMain, jSide, jSidePrent, jSidePrev;

                jMain = elem._data_jMain;

                if (!jMain) {
                    jMain = elem._data_jMain = $(elem.querySelector('.article-left'));

                    jSide = $(elem.querySelector('.article-right')).children().not(':first-child');
                    jSide = elem._data_jSide = $('<div>').appendTo(jSide.parent()).append(jSide);

                    jSidePrev = elem._data_jSidePrev = jSide.prev();
                    jSidePrent = elem._data_jSidePrent = jSide.parent();

                    jSide.css({
                        width: 255
                    });
                }

                jSide = elem._data_jSide;
                jSidePrev = elem._data_jSidePrev;
                jSidePrent = elem._data_jSidePrent;

                var
                    oheight = jSidePrev.innerHeight() + 70,

                    winHeight = jWin.height(),

                    winTop = pageYOffset,
                    winMaxTop = winTop + winHeight,

                    mTop = jMain.offset().top + oheight,
                    mHeight = jMain.innerHeight() - oheight-100,
                    mMaxTop = mHeight + mTop,

                    sHeight = jSide.innerHeight();

                jSidePrent.css({
                    height: mHeight + oheight,
                    'box-sizing': 'border-box',
                    position: 'relative'
                });

                // 判断指定元素是否在显示区域

                if (mTop > winMaxTop || mMaxTop < winTop) {
                    jSide.css({
                        position: 'static'
                    });
                }
                else {

                    // 头部情况
                    if (mTop > winTop && mTop < winMaxTop) {
                        jSide.css({
                            position: 'static'
                        });
                    }
                    // 中部
                    else if (mTop < winTop && mMaxTop > winMaxTop) {


                        // 是否触底
                        if (mMaxTop - winTop < sHeight) {
                            // 触底

                            bottom();

                        }
                        else {
                            jSide.css({
                                position: 'fixed',
                                top: 0
                            });
                        }

                    }
                    // 底部
                    else if (mMaxTop > winTop && mMaxTop < winMaxTop) {
                        bottom();
                    }

                }

                function bottom() {
                    var y = mHeight - sHeight;

                    if (y < 0) {
                        jSide.css({
                            position: 'static'
                        });
                    }
                    else {
                        jSide.css({
                            position: 'absolute',
                            top: y + oheight
                        });
                    }
                }
            }

            sideSyn = excu;

            excu(elem);
        }

    });

});
