import loadJs from './load-js'
import {Site} from './wtData_v2'
import dateParse from './date-parse'

let {weatherInfo} = Site

function imgInfo({wInfo, wTime}) {
  var icoOnNight = "";
  var bgOnNight = "";
  // 图片名及路径
  var wtObj = weatherInfo.data[wInfo.sk_wt];

  function dayOrNightFn() {
    return wTime.currentHours > wInfo.bi_sr.split(":")[0] && wTime.currentHours < wInfo.bi_ss.split(":")[0] ? '_baitian' : '_yejian';
  }

  switch (wInfo.sk_wt) {
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
  }
  ;

  var icoUrl = weatherInfo.icoUrl;

  var bgImg = icoUrl + wtObj.bg + bgOnNight + ".jpg";
  var icoImg = icoUrl + "TB_" + wtObj.ico + icoOnNight + ".png";

  return {
    bgImg, icoImg,
    name:wtObj.name
  }

}

export default function (cityId,cb) {

  loadJs({
    src: 'http://weather.gtimg.cn/city/'+cityId+'.js',
    // src: 'http://192.168.1.222:8800/demo/20161201_%E5%A4%A9%E6%B0%94_%E5%86%9C%E5%8E%86%E5%B9%B4/backup/01010715.js',
    charset: 'gb2312',
    callback: function () {
      let {year,month,day,weekAbb,weekZh,minute,hours}= dateParse(new Date)

      var wTime = {
        currenttime: [year,month,day].join('.'),
        currentHours: hours,
        currentWeek: weekAbb,
        currentMinute: minute
      };

      var wInfo = __weather_city;

      let {bgImg, icoImg, name} = imgInfo({wInfo, wTime})

          let wtData = {
            currentDate:[year,month,day].join('/'),
            currentWeek:'星期'+weekZh,
            bgImg,
            icoImg,
            name,
            tp:wInfo.sk_tp
          }

          cb(wtData)
    }
  });

}
