// 城市空气质量

import loadJs from './load-js'

export default function (cb) {

  window.cityrank = function (d) {
    cb(d)
  }

  loadJs({
    src: 'http://weather.gtimg.cn/aqi/cityrank.json',
    charset: 'gb2312',
    callback: function () {

    }
  })
}
