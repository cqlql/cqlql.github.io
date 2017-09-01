import './index.css'

import {getWeatherInfo, getCityRank} from '../modules/weather'

let vm,cityName='深圳'

vm = new Vue({
  el: '#weather',
  data: {
    wtInfo: {},
    rank: {quality: ''}
  },
  template: `
    <div class="weather">
  <div class="wtdate">{{wtInfo.currentDate}} <span>{{wtInfo.currentWeek}}</span></div>
  <div class="wt">
    <div class="wtimg"><img :src="wtInfo.icoImg" alt=""></div>
    <div class="wtname">{{wtInfo.name}}</div>
  </div>
  <div class="ot">
    <div class="tp"><label>温度</label><span>{{wtInfo.tp}}°C</span></div>
    <div class="api"><label>空气质量</label><span>{{rank.quality}}</span></div>
  </div>
</div>
    `
})


let update = async function () {

  let wtInfo = await new Promise(function (resolve) {
    getWeatherInfo(cityName, function (d) {
      resolve(d)
    })
  })

  vm.wtInfo = wtInfo

  let rank = await new Promise(function (resolve) {
    getCityRank(cityName, function (d) {
      resolve(d)
    })
  })

  vm.rank.quality = rank.quality

}

function setCity(name) {
  cityName=name
  update()
}

// 每小时更新，可配置
function timeUpdate() {
  // 值为 1000*60 表示每分钟更换
  // 值为 1000*60*60 表示每小时更换
  let time = 1000*60*60

  function ex() {
    update()
  }

  function fn() {

    setTimeout(function () {
      ex()
    },time-(Date.now()%time))// 此处进行了减少误差计算
  }
  fn()
}

update()

timeUpdate()


window.weather = {update,setCity}
