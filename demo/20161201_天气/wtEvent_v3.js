/* 2014-11-19 7:43 */
var simplexhr = {
    doxhr: function (container, url) {
        if (!document.getElementById || !document.createTextNode) { return; }
        simplexhr.outputContainer = document.getElementById(container);
        if (!simplexhr.outputContainer) { return; }
        var request;
        try {
            request = new XMLHttpRequest();
        } catch (error) {
            try {
                request = new ActiveXObject("Microsoft.XMLHTTP");
            } catch (error) {
                return true;
            }
        }
        request.open('get', url, true);
        request.onreadystatechange = function () {
            if (request.readyState == 1) {
                simplexhr.outputContainer.innerHTML = 'loading...';
            }
            if (request.readyState == 4) {
                if (request.status && /200|304/.test(request.status)) {
                    simplexhr.retrieved(request);
                } else {
                    simplexhr.failed(request);
                }
            }
        }
        request.setRequestHeader('If-Modified-Since', 'Wed, 05 Apr 2006 00:00:00 GMT');
        request.send(null);
        return false;
    },
    retrieved: function (requester) {
        var data = requester.responseText;
        simplexhr.outputContainer.innerHTML = data;
        return false;
    },
    failed: function (requester) {
        //alert(requester.status+'的问题！重新刷一下页面试试O(∩_∩)~' );
        return true;
    },
    encode: function (string) {
        return escape(this._utf8_encode(string));
    },
    decode: function (string) {
        return this._utf8_decode(unescape(string));
    },
    _utf8_encode: function (string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    },
    _utf8_decode: function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while (i < utftext.length) {

            c = utftext.charCodeAt(i);

            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if ((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    }
};

//农历
var lunarInfo = {
    wMonth: null,
    wDay: null,

    GetBit: function (m, n) {
        return (m >> n) & 1;
    },

    convertDate: function (year, month, day) {
        var CalendarData = [0x41A95, 0xD4A, 0xDA5, 0x20B55, 0x56A, 0x7155B, 0x25D, 0x92D, 0x5192B, 0xA95, 0xB4A, 0x416AA, 0xAD5, 0x90AB5, 0x4BA, 0xA5B, 0x60A57, 0x52B, 0xA93, 0x40E95];
        var madd = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        var total, m, n, k;
        var isEnd = false;
        var tmp = year;
        total = (tmp - 2001) * 365 + Math.floor((tmp - 2001) / 4) + madd[month] + day - 23;
        if ((year - 1900) % 4 == 0 && month > 1)
            total++;
        for (m = 0; ; m++) {
            k = (CalendarData[m] < 0xfff) ? 11 : 12;
            for (n = k; n >= 0; n--) {
                if (total <= 29 + this.GetBit(CalendarData[m], n)) {
                    isEnd = true;
                    break;
                }
                total = total - 29 - this.GetBit(CalendarData[m], n);
            }
            if (isEnd) break;
        }
        this.wMonth = k - n + 1;
        this.wDay = total;
        if (k == 12) {
            if (this.wMonth == Math.floor(CalendarData[m] / 0x10000) + 1)
                this.wMonth = 1 - this.wMonth;
            if (this.wMonth > Math.floor(CalendarData[m] / 0x10000) + 1)
                this.wMonth--;
        }
    },

    getDateString: function () {
        var numStr = "一二三四五六七八九十";
        var monthStr = "正二三四五六七八九十冬腊";
        var tmp = "";
        if (this.wMonth < 1) {
            tmp += "闰";
            tmp += monthStr.charAt(-this.wMonth - 1);
        }
        else
            tmp += monthStr.charAt(this.wMonth - 1);
        tmp += "月";
        tmp += (this.wDay < 11) ? "初" : ((this.wDay < 20) ? "十" : ((this.wDay < 30) ? "廿" : "卅"));
        if (this.wDay % 10 != 0 || this.wDay == 10)
            tmp += numStr.charAt((this.wDay - 1) % 10);
        return tmp;
    },

    init: function (year, month, day) {
        this.convertDate(year, month, day);
        var backlunar = this.getDateString();
        return backlunar;
    }
}

function weatherInfo() { }

weatherInfo.prototype = {
    getArgs: function () {
        var args = {};
        var query = location.search.substring(1);
        var pairs = query.split("&");
        for (var i = 0; i < pairs.length; i++) {
            var pos = pairs[i].indexOf("=");
            if (pos == -1) continue;
            var argname = pairs[i].substring(0, pos);
            var value = pairs[i].substring(pos + 1);
            value = decodeURIComponent(value);
            args[argname] = value;
        }
        return args;
    },
    //获取准确城市ID
    getCityID: function () {
        var _this = this;
        var proviceName = IPData[2];
        var cityName = IPData[3];
        var cityId = null;

        var _url = window.location.href;
        var mode1 = 'acity';
        var mode2 = 'icity';

        if (_url.indexOf(mode2) != -1) {
            var iPos = _url.indexOf(mode2);
            var txt = _url.substr(iPos);
            cityId = _this.getArgs().icity;
        } else if (_url.indexOf(mode1) != -1) {
            var iPos = _url.indexOf(mode1);
            var txt = _url.substr(iPos);
            var cityTxt = txt.split('.')[0].substr(5);
            //var cityTxt = _this.getArgs().acity;
            cityTxt = simplexhr.decode(cityTxt);
            cityId = cSite.dirCity.city[cityTxt];
            if (cityId == undefined) {
                cityId = cSite.dirCity.defaultCity;
            }
        } else {
            if ((proviceName != '')) {
                if (cityName == '' || cityName == '未知') {
                    cityId = Site.Weather.city[proviceName]['_'];
                } else {
                    cityId = Site.Weather.city[proviceName][cityName];
                }
            } else {
                cityId = Site.Weather.defaultCity;
            }
        }
        return cityId;
    },
    //加载js
    loadJs: function (url, charsetMode, jsName, callback) {
        var script = document.createElement('script');
        script.charset = charsetMode;
        script.id = jsName;
        script.src = url;
        script.type = 'text/javascript';
        var head = document.getElementsByTagName('head')[0];
        head.appendChild(script);
        if (script.attachEvent) {
            script.attachEvent('onreadystatechange', function () {
                if (script.readyState == 4 || script.readyState == 'complete' || script.readyState == 'loaded') {
                    callback();
                }
            });
        } else if (script.addEventListener) {
            script.addEventListener('load', callback, false)
        }
    },
    //删除js
    removeJs: function (jsName) {
        var script = document.getElementById(jsName);
        var head = document.getElementsByTagName('head')[0];
        head.removeChild(script);
    },
    //获取天气信息，例如气温，经度纬度等
    getWeatherInfo: function () {
        var _this = this;
        var cityId = this.getCityID();

        var icoUrl = Site.weatherInfo.icoUrl;
        var ie6 = ! -[1, ] && !window.XMLHttpRequest;
        var H17 = wTime.currentHours < 17;

        /* 城市信息 */
        function getCityInfo(wInfo){
            var cityInfo = $(".mod-today .hd");
            // 城市名
            var cityName = wInfo.bi_name;
            if (cityName.indexOf('(') != -1) {
                cityName = cityName.split('(')[0]
            }
            cityInfo.find(".city").html(cityName);
            // 年月日
            cityInfo.find(".full-date").html(wTime.currenttime + " 星期" + Site.timeWeek[wTime.currentWeek.toLowerCase()] + " 农历" + lunarInfo.init(wTime.currenttime.split('.')[0], (Math.abs(wTime.currenttime.split('.')[1]) - 1), Math.abs(wTime.currenttime.split('.')[2])));
            // 实况
            var cur_day = wTime.currenttime.split(".")[2],
                date = wInfo.sk_rt,
                day = date.split(" ")[0].split("-")[2],
                hour = date.split(" ")[1].split(":")[0],
                skHtml = "",
                skNum = parseInt(cur_day, 10) - day,
                skTime = date.split(" ")[1].split(":")[0] + ":" + date.split(" ")[1].split(":")[1];
            switch(skNum){
                case 1:
                    skHtml = "昨天" + skTime;
                    break;
                case 2:
                    skHtml = "前天" + skTime;
                    break;
                default:
                    skHtml = skTime;
            }
            cityInfo.find(".sk-date").html(skHtml  + " 天气实况");
            
        }

        /* 空气质量排行 */
        function AQIRank(obj){

            $(obj.id).highcharts({
                chart: {
                    type: 'bar',
                    backgroundColor: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        stops: [
                            [0, 'rgb(237, 245, 249)'],
                            [1, 'rgb(237, 245, 249)']
                        ]
                    }
                },
                title: {
                    text: ''
                },
                subtitle: {
                    text: ''
                },
                credits: {
                    text: "",
                    href: ""
                },
                yAxis: {
                    min: 0,
                    title: {
                        text: ''
                    }
                },
                tooltip: {
                    headerFormat: '<div style="text-align:center;">{point.key}</div>',
                    pointFormat: '<div><span style="color:#439cd2;">AQI:</span>{point.y}</div>',
                    footerFormat: '',
                    shared: true,
                    useHTML: true
                },
                plotOptions: {
                    column: {
                        pointPadding: 0.1,
                        borderWidth: 0
                    }
                },
                xAxis: {
                    categories: obj.city
                },
                series: [{
                    color: obj.color,
                    name: obj.time + " 发布",
                    data: obj.data
                }]
            });
        }

        /* 当日天气 */
        function getDayWeather(wInfo, icoUrl, wtObj, bgOnNight, icoOnNight){
            var curW = $("#cur-box");
            if (wInfo.sk_wt) {
                var bgImg = icoUrl + wtObj.bg + bgOnNight +".jpg";
                var icoImg = icoUrl + "TB_" + wtObj.ico + icoOnNight +".png";
                $(".page").css({"background-image": "url(" + bgImg + ")"});
                if (!ie6) {
                    curW.find(".big-ico").html('<img src="' + icoImg + '" /> ');
                } else {
                    curW.find(".big-ico").css({'filter': 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + icoImg + '" ,sizingMethod="noscale")'});
                }
            }
            // 温度
            curW.find(".w-wd").html(wtObj.name + "&nbsp;&nbsp;&nbsp;<span class='wd-num'>" + wInfo.sk_tp + "</span>℃");
            // 湿度
            curW.find(".w-sd").html(Site.windDir[wInfo.sk_wd] + wInfo.sk_wp + "级&nbsp;&nbsp;&nbsp;湿度：" + Math.abs(wInfo.sk_hd) + "%");
            // 空气质量
            var objZL = curW.find(".zl");
            var curZL = curW.find(".w-zl");
            var curAQi = curW.find(".w-aqi");
            var curPM = curW.find(".w-pm");
            var curPM10 = curW.find(".w-pm10");
            var curCO = curW.find(".w-co");
            var curNO2 = curW.find(".w-no2");
            var curO3 = curW.find(".w-o3");

            window.cityrank = function(data){

                // 空气质量参数
                var cityName = [];
                var cityAQI = [];
                var time_point = data[0].time_point.replace(/T|Z/g, " ");

                for(var i = 0, len = data.length;i < len; i ++){
                    if(data[i].id == cityId){
                        objZL.show();
                        curZL.html("空气质量：" + data[i].quality);
                        curAQi.html("AQI：" + data[i].aqi);
                        curPM.html("PM2.5：" + data[i].pm2_5);
                        curPM10.html("PM10：" + data[i].pm10);
                        curCO.html("CO：" + data[i].co);
                        curNO2.html("NO2：" + data[i].no2);
                        curO3.html("O3：" + data[i].o3);

                        // 空气质量背景
                        var qualityBg = "";
                        var isNight =  H17 ? "_baitian" : "_yejian";
                        switch(data[i].quality){
                            case "优":
                            case "良":
                                qualityBg = icoUrl + "youliang" + isNight +".jpg";
                                break;
                            case "轻度污染":
                            case "中度污染":
                            case "重度污染":
                            case "严重污染":
                                qualityBg = icoUrl + "wuran" + isNight +".jpg";
                                break;
                        };
                        $(".quality-page").css({"background-image": "url(" + qualityBg + ")"});

                        // AQI图标
                        var aqiBg = 0;
                        switch(true){
                            case data[i].aqi > 0 && data[i].aqi <= 50:
                                aqiBg = 1;
                                break;
                            case data[i].aqi > 50 && data[i].aqi <= 100:
                                aqiBg = 2;
                                break;
                            case data[i].aqi > 100 && data[i].aqi <= 150:
                                aqiBg = 3;
                                break;
                            case data[i].aqi > 150 && data[i].aqi <= 200:
                                aqiBg = 4;
                                break;
                            case data[i].aqi > 200 && data[i].aqi <= 250:
                                aqiBg = 5;
                                break;
                            case data[i].aqi > 250 && data[i].aqi <= 300:
                                aqiBg = 6;
                                break;
                            case data[i].aqi > 300 && data[i].aqi <= 350:
                                aqiBg = 7;
                                break;
                            case data[i].aqi > 350 && data[i].aqi <= 400:
                                aqiBg = 8;
                                break;
                            case data[i].aqi > 400:
                                aqiBg = 9;
                                break;
                        };
                        var qualityBox = $(".quality-ico-box");
                        var aqiImg = icoUrl + "aqi_" + aqiBg +".png";
                        if (!ie6) {
                            qualityBox.html('<img src="' + aqiImg + '" />');
                        } else {
                            qualityBox.css({'filter': 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + aqiImg + '" ,sizingMethod="noscale")'});
                        }
                        /* 质量指数 */
                        var qualityDom = $("#quality-zhishu p[data-quality]");
                        var qualityOpt =  Site.weatherQuality.data[data[i].quality];
                        // 首要污染物
                        qualityDom.eq(0).html(data[i].primary_pollutant.replace(/,/, "<br />"));
                        // 气象条件
                        //qualityDom.eq(1).html();
                        // 影响人群
                        qualityDom.eq(2).html(qualityOpt.affect);
                        // 爱心提示
                        qualityDom.eq(3).html(qualityOpt.lovetips);

                        $(".mod-today .hd").find(".sk-date-quality").html(data[i].time_point.split("T")[1].substr(0, 5)  + " 空气质量实况");

                    }
                    cityName.push(data[i].area);
                    cityAQI.push(data[i].aqi);

                }

                // 空气质量排行
                if($("#chart-1").length){
                    AQIRank({
                        id: "#chart-1",
                        color: "#98cbea",
                        city: cityName.slice(0, 10),
                        data: cityAQI.slice(0, 10),
                        time: time_point
                    });
                }
                if($("#chart-2").length){
                    AQIRank({
                        id: "#chart-2",
                        color: "#ebba6e",
                        city: cityName.slice(cityName.length - 10),
                        data: cityAQI.slice(cityAQI.length - 10),
                        time: time_point
                    });
                }

                // 天气链接
                curW.find(".link-index").attr({"href": indexName + "?icity=" + cityId});
                curW.find(".link-aqi").attr({"href": qualityName + "?icity=" + cityId});
            };

            // 空气质量详情
            window.city = function(data){
                var dataList = {
                    list: data
                }
                dataList.list.length = data.length-1;
                dataList.list.sort(function(a, b){
                    return b.aqi - a.aqi;
                });
                if($("#quality-temp").length){
                    var html = template('quality-temp', dataList);
                    $("#quality-detail").html(html);
                }
            }

            $.ajax({
                url: "http://weather.gtimg.cn/aqi/cityrank.json",
                dataType: "jsonp",
                jsonpCallback: "cityrank",
                success: function() {}
            });

            $.ajax({
                url: "http://weather.gtimg.cn/aqi/" + cityId + ".json",
                dataType: "jsonp",
                jsonpCallback: "city",
                success: function() {}
            });
        }

        /* 48小时 */
        function get48HWeather(wInfo, dayOrNightFn){
            var icoOnNight = "";
            var h48 = $("#h48-tab");
            var h48Item = h48.find(".item");
            var icoSmall = "";
            var tPointItem = "";
            var isDay = H17;
            /**/
            var tPoint = null;
            var timeBlance = wTime.currenttime.split('.')[0] + '-' + Math.abs(wTime.currenttime.split('.')[1]) + '-' + Math.abs(wTime.currenttime.split('.')[2]);
            if (H17) {
                timeBlance += ' 8:00:00'
            } else {
                timeBlance += ' 20:00:00';
            }
            for (var i = 0; i < 14; i++) {
                if (wInfo.wk['0'][i].ts == timeBlance) {
                    tPoint = i;
                    break;
                }
            }
            //20161021 update
			//var updateTime = wInfo.wk.rt.substr(11);
			var updateTime = wInfo.wk.rt.split(' ')[1];
			updateTime = updateTime.substring(0, updateTime.length - 3);
			h48.find(".update_time").html(updateTime);
            //if(wInfo.wk['0'][tPoint].tmax != "NULL"){
            if(tPoint == null){
                isDay = true;
            }
            //console.log(isDay, H17);
            var h48Day = [
                isDay ? '今天白天' : '今天夜间',
                isDay ? '今天夜间' : '明天白天',
                isDay ? '明天白天' : '明天夜间',
                isDay ? '明天夜间' : '后天白天'
            ];
            //*/
            // info
            for(var i = 0, len = h48Item.length; i < len; i++){
                tPointItem = wInfo.wk['0'][tPoint + i];
                icoOnNight = "";
                // day
                h48Item.eq(i).find(".i-day").html(h48Day[i]);
                // state
                h48Item.eq(i).find(".i-state").html(Site.weatherInfo.data[tPointItem.wt].name);
                h48Item.eq(i).find(".i-wind").html(Site.windPower[tPointItem.wp]);
                // icoSmall
                switch(tPointItem.wt){
                    case "00":
                    case "01":
                    case "03":
                    case "13":
                        //icoOnNight = dayOrNightFn();
                        if(i % 2 != isDay){
                            icoOnNight = "_baitian";
                        }else{
                            icoOnNight = "_yejian";
                        }
                        break;
                };
                
                icoSmall = icoUrl + "TB_" + Site.weatherInfo.data[tPointItem.wt].ico + icoOnNight +"_min.png";
                if (!ie6) {
                    h48Item.eq(i).find(".small-ico").html('<img src="' + icoSmall + '" alt="' + Site.weatherInfo.data[tPointItem.wt].name + '" />');
                } else {
                    h48Item.eq(i).find(".small-ico").css({'filter': 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + icoSmall + '" ,sizingMethod="noscale")'});
                }
                // wd
                h48Item.eq(i).find(".i-wd").html((tPointItem.tmax != "NULL" ? tPointItem.tmax : tPointItem.tmin) + " ℃");
            }
        };

        /* 指数 */
        function ZhiShu(wInfo){
            var objZS = $("#slides-1");
            var zsSplit = objZS.find(".split");
            var spLen = zsSplit.length;
            var zsData = "";
            for(var i = 0; i < 6; i ++){
                for(var j = 0; j < spLen; j++){
                    zsData = Site.weathZhishu["split_" + j][i];
                    for(k in zsData){
                        zsSplit.eq(j).find(".pic").eq(i).html('<img src="' + Site.weathZhishu.icoUrl + k + '.png" />');
                        zsSplit.eq(j).find(".zs-type-1").eq(i).html(zsData[k] + "：" + Site.living[k][wInfo["zs_" + k]].type);
                        zsSplit.eq(j).find(".zs-info-1").eq(i).html(Site.living[k][wInfo["zs_" + k]].info);
                    }
                }
            };
            /* 质量指数 */
            // 气象条件
            $("#quality-zhishu p[data-quality]").eq(1).html(Site.living["kqwr"][wInfo["zs_kqwr"]].info);
        }

        /* 一周天气 */
        function getWeekWeather(wInfo, dayOrNightFn){
            var week = $("#week-tab");
            var wkItem = week.find(".item");
            var weekLink = $(".week-link");
            var h48Link = $(".h48-link");
            var icoSmall = "";
            var tPointItem = "";
            var tPointItem2 = "";
            h48Link.attr({"href": indexName + "?icity=" + cityId});
            weekLink.attr({"href": yztqName + "?icity=" + cityId});

            var tPoint = 1;
            var timeBlance = wTime.currenttime.split('.')[0] + '-' + Math.abs(wTime.currenttime.split('.')[1]) + '-' + Math.abs(wTime.currenttime.split('.')[2]) + ' 20:00:00';
            for (var i = 0; i < 14; i++) {
                if (wInfo.wk['0'][i].ts == timeBlance) {
                    tPoint = i;
                    break;
                }
            }
			//20161021 update
			//var updateTime = wInfo.wk.rt.substr(11);
			var updateTime = wInfo.wk.rt.split(' ')[1];
			updateTime = updateTime.substring(0, updateTime.length - 3);
			week.find(".update_time").html(updateTime);
			
            // info
            var wklen = wkItem.length;
            var storeWeekIndex = 0;
            for (var mn = 0; mn < 7; mn++) {
                if (Site.timeWeekArr[mn] == Site.timeWeek[wTime.currentWeek.toLowerCase()]) {
                    storeWeekIndex = mn;
                    break;
                }
            }
            var weekDay = ['今天白天','今天夜间','明天白天','明天夜间'];
            for (var i = 0; i < 7; i++) {
                // day
                if(i < 2){
                    week.find(".item-" + i*2).find(".i-day").html(weekDay[i*2]);
                    week.find(".item-" + (i*2 + 1)).find(".i-day").html(weekDay[i*2 + 1]);
                }else{
                    week.find(".item-" + i*2).find(".i-day").html("周" + Site.timeWeekArr[storeWeekIndex] + "白天");
                    week.find(".item-" + (i*2 + 1)).find(".i-day").html("周" + Site.timeWeekArr[storeWeekIndex] + "夜间");
                }
                storeWeekIndex ++;
                if (storeWeekIndex > 6) {
                    storeWeekIndex = 0;
                }
            }
            var wdItem = "";
            var icoItem = "";
            for(var i = 0; i < wklen; i++){
                // TODO tPoint 白天1 夜晚0
                icoOnNight = "";
                if(i < 1){
                    if(tPoint == 0){
                        tPointItem = wInfo.wk['0'][tPoint + i];
                    }else{
                        tPointItem = wInfo.wk['0'][tPoint + i - 1];
                    }
                }else{
                    tPointItem = wInfo.wk['0'][tPoint + i - 1];
                }
                if(tPointItem){
                    // state
                    week.find(".item-" + i).find(".i-state").html(Site.weatherInfo.data[tPointItem.wt].name);
                    week.find(".item-" + i).find(".i-wind").html(Site.windPower[tPointItem.wp]);
                    // icoSmall
                    switch(tPointItem.wt){
                        case "00":
                        case "01":
                        case "03":
                        case "13":
                            //icoOnNight = dayOrNightFn();
                            if(i % 2 == 0){
                                icoOnNight = "_baitian";
                            }else{
                                icoOnNight = "_yejian";
                            }
                            break;
                    };
                    icoItem = week.find(".item-" + i).find(".small-ico");
                    icoSmall = icoUrl + "TB_" + Site.weatherInfo.data[tPointItem.wt].ico + icoOnNight +"_min.png";
                    if (!ie6) {
                        icoItem.html('<img src="' + icoSmall + '" />');
                    } else {
                        icoItem.css({'filter': 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + icoSmall + '" ,sizingMethod="noscale")'});
                    }
                    // wd
                    wdItem = week.find(".item-" + i).find(".i-wd");
                    if( i < 1){
                        if(tPoint == 0){
                            wdItem.html(wInfo.sk_tp + " ℃");
                        }else{
                            wdItem.html(tPointItem.tmax + " ℃");
                        }
                    }else{
                        if(tPointItem.tmax != "NULL"){
                            wdItem.html(tPointItem.tmax + " ℃");
                        }else if(tPointItem.tmin != "NULL"){
                            wdItem.html(tPointItem.tmin + " ℃");
                        }else{
                            wdItem.html("暂无");
                        }
                    }
                }
            }
        }

        // 城市接口数据
        this.loadJs('http://weather.gtimg.cn/city/' + cityId + '.js', 'gb2312', 'weatherJs', function () {

            var wInfo = __weather_city;
            var icoOnNight = "";
            var bgOnNight = "";
            // 图片名及路径
            var wtObj = Site.weatherInfo.data[wInfo.sk_wt];

            var curTime = wTime.currentHours + wTime.currentMinute;
            function dayOrNightFn(){
                return wTime.currentHours > wInfo.bi_sr.split(":")[0] && wTime.currentHours < wInfo.bi_ss.split(":")[0] ? '_baitian' : '_yejian';
                //return curTime > wInfo.bi_sr.replace(/:/g,"") && curTime < wInfo.bi_ss.replace(/:/g,"") ? '_baitian' : '_yejian';
            }
            switch(wInfo.sk_wt){
                case "00":
                case "01":
                    icoOnNight = dayOrNightFn();
                    bgOnNight = dayOrNightFn();
                    break;
                case "02":
                case "04":
                case "05":
                case "18":
                case "53":
                    bgOnNight = dayOrNightFn();
                    break;
                case "03":
                case "13":
                    icoOnNight = dayOrNightFn();
                    break;
            };

            // 城市信息
            getCityInfo(wInfo);

            // 当日天气
            getDayWeather(wInfo, icoUrl, wtObj, bgOnNight, icoOnNight);

            // 48H天气
            get48HWeather(wInfo, dayOrNightFn);

            // 指数
            ZhiShu(wInfo);

            // 一周天气
            getWeekWeather(wInfo, dayOrNightFn);

            _this.removeJs('weatherJs');
        });
    }
}
weatherInfo.prototype.getWeatherInfo();/*  |xGv00|2c6433128f2d90b215e6bca6033ea68b */