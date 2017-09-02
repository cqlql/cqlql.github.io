import './weather.css'

import {getWeatherInfo, getCityRank} from '../modules/weather'

let cityName='深圳'

let el = document.getElementById('weather')
el.className = 'weather'
el.innerHTML = `<div class="wtdate"> <span></span></div>
  <div class="wt">
    <div class="wtimg"></div>
    <div class="wtname"></div>
  </div>
  <div class="ot">
    <div class="tp"></div>
    <div class="api"></div>
  </div>`
let wtdate,wtimg,wtname,tp,api
let elems = el.querySelectorAll('.wtdate,.wtimg,.wtname,.tp,.api')
wtdate=elems[0]
wtimg=elems[1]
wtname=elems[2]
tp=elems[3]
api=elems[4]

let update = async function () {

  let wtInfo = await new Promise(function (resolve) {
    getWeatherInfo(cityName, function (d) {
      resolve(d)
    })
  })

  // vm.wtInfo = wtInfo
  wtdate.innerHTML = `${wtInfo.currentDate} <span>${wtInfo.currentWeek}</span>`
  wtimg.innerHTML = `<img src="${wtInfo.icoImg}"/>`
  wtname.innerHTML = wtInfo.name
  tp.innerHTML = `<label>温度</label><span>${wtInfo.tp}°C</span>`


  let rank = await new Promise(function (resolve) {
    getCityRank(cityName, function (d) {
      resolve(d)
    })
  })

  // vm.rank.quality = rank.quality
  api.innerHTML = `<label>空气质量</label><span>${rank.quality}</span>`
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
