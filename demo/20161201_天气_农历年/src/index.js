import loadJs from './load-js'
import Site from './wtData_v2'

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
    bgImg, icoImg
  }

}

loadJs({
  // src: 'http://weather.gtimg.cn/city/01010715.js',
  src: '../backup/01010715.js',
  charset: 'gb2312',
  callback: function () {
    var wTime = {
      currenttime: '2016.12.08',
      currentHours: '09',
      currentWeek: 'Thu',
      currentMinute: '54'
    };

    var wInfo = __weather_city;

    let {bgImg, icoImg} = imgInfo({wInfo, wTime})

    let wtData = {
      bgImg,
      icoImg,
      tp:wInfo.sk_tp
    }

    console.log(wtData)


  }
});
