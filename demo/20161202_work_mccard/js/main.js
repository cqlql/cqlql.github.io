/**
 * Created by cql on 2016/12/5.
 */

// document.documentElement.style.fontSize = (innerWidth / 1080 * 14).toFixed(4) + 'px';

var currentDate = new Date;


var data = {
    year: currentDate.getFullYear(),
    month: (currentDate.getMonth() + 1+'').replace(/^\d$/,'0$&'),
    date: (currentDate.getDate()+'').replace(/^\d$/,'0$&'),
    day: currentDate.getDay(),
    hours: (currentDate.getHours()+'').replace(/^\d$/,'0$&'),
    minutes: (currentDate.getMinutes()+'').replace(/^\d$/,'0$&'),

    weatherIco: '',
    weatherName: ''

};


var vm = new Vue({
    el: '.header',
    data: data,

    computed: {
        ly: function () {
            return toLunarYear(this.year);
        },
        seconds: function () {
            return currentDate.getSeconds();
        }

    }
});

c.loadScript({
    src: 'http://weather.gtimg.cn/city/01010715.js',
    charset: 'gb2312',
    callback: function () {

        var wInfo = __weather_city;
        var icoOnNight = '';
        // 图片名及路径
        var wtObj = c.weatherInfo.data[wInfo.sk_wt];
        var icoUrl = "http://mat1.gtimg.com/weather/2014gaiban/";
        var wTime = {
            // currenttime: '2016.12.08',
            currentHours: currentDate.getHours()
            // currentWeek: 'Thu',
            // currentMinute: '54'
        };

        data.weatherName = c.weatherInfo.data[wInfo.sk_wt].name;

        function dayOrNightFn() {
            return wTime.currentHours > wInfo.bi_sr.split(":")[0] && wTime.currentHours < wInfo.bi_ss.split(":")[0] ? '_baitian' : '_yejian';
        }

        switch (wInfo.sk_wt) {
            case "00":
            case "01":
            case "03":
            case "13":
                icoOnNight = dayOrNightFn();
                break;
        }


        var icoImg = icoUrl + "TB_" + wtObj.ico + icoOnNight + ".png";

        data.weatherIco = icoImg;

    }
});


function toLunarYear(SY) {

    var Gan = "甲乙丙丁戊己庚辛壬癸";
    var Zhi = "子丑寅卯辰巳午未申酉戌亥";

    return cyclical(SY - 1900 + 36);

    function cyclical(num) {
        return (Gan[num % 10] + Zhi[num % 12]);
    }
}