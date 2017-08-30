import './index.css'
// import getxyByRad from './getxy-by-rad'
// import pie from './pie'
import getxyByRad from '../../../modules/pie/getxy-by-rad'
import pie from '../../../modules/pie/pie'

function chartPie({data,eachData,labels,tscore}) {

// 圆心
  let ox = 100
  let oy = 60

// 半径
  let r = 45

  // 边框间隙
  let bw = 1

// 底色值
  let bgcs = ['#fff1e7', '#fff5e1', '#ffefef', '#f1f5ff', '#edf7ff']
  let eachBgcs = ['#ffbb87', '#ffc966', '#ffa9ab', '#bbc7ff', '#a3d1ff']
  let lcs = ['#f96902', '#ffad14', '#ff4b4b', '#5980ff', '#5bacfe']

// 起始弧度
  let angOft = 120
  let sRad = Math.PI / 180 * -angOft
  let paths = ''
  let texts = ''
  let lines=''
  data.forEach(function (p, i) {
    let rad = p * Math.PI * 2

    paths += `<path d="${pie({
      ox, oy, r, sRad, rad
    })}"
fill="${bgcs[i % 5]}"
></path>`

    let r2 = (r-3) * (eachData[i])+1.5
    paths += `<path d="${pie({
      ox, oy, r: r2, sRad, rad
    })}"
fill="${eachBgcs[i % 5]}"
></path>`

    // 画边框
    paths += `<path d="${pie({
      ox, oy, r, sRad, rad
    })}"
fill="transparent"
stroke="#fff" stroke-width="${bw}"
></path>`

    // 画线，并记录文本坐标
    let ra = sRad + rad / 2
    let exOft = 3 // 末端折线偏移
    let txOft = 1 // 文本偏移

    if (180 / Math.PI * ra + 90 > 180) {
      exOft = -exOft
      txOft = -txOft
    }
    let lR2 = r2 / 1.2 // 内部饼图线条起始半径，用来算坐标
    let {x: sx, y: sy} = getxyByRad(ra, lR2>1.5?lR2:1.5, ox, oy)// 起始坐标
    let {x: ex, y: ey} = getxyByRad(ra, r+2.5, ox, oy)
    let tx = ex + exOft, ty = ey
    lines += `<polyline points="${sx},${sy} ${ex},${ey} ${tx},${ty}"
fill="none"
stroke="${lcs[i % 5]}"
stroke-width="0.5"
></polyline>`
    // div文本
    // texts += `<div class="lb" style="left:${(tx) / 200 * 100}%;top:${(ty) / 200 * 100}%;"><span style="${exOft > 0 ? '' : 'float:right;'}color:${lcs[i % 5]}">${labels[i]}</span></div>`
    // svg 文本
    texts+=`<text x="${tx+txOft}" y="${ty+2}" font-size="6.5" text-anchor="${exOft>0?'start':'end'}" fill="${lcs[i % 5]}">${labels[i]}</text>`

    sRad += rad
  })

// 总分
// texts += `<div class="tscore">${tscore}分</div>`
texts+=`<text x="${ox}" y="${oy+3}" font-size="6.5" text-anchor="middle" fill="#333" style="font-weight:bold;">${tscore}分</text>`

document.querySelector('.chart-pie').innerHTML=`<svg viewbox="0,0,200,120">
${paths}
<circle cx="${ox}" cy="${oy}" r="${r}" stroke="#e5e5e5" fill="transparent" stroke-width="1.5"/>
${lines}
${texts}</svg>`
  // document.querySelector('.chart-pie').innerHTML = `<!--<svg viewbox="0,0,200,200">${paths}</svg>-->${texts}`
}

window.transmitData = function (baseData) {

  // 扇形占比
  let data = []
  let eachData = []
  let labels = []
  let tscore = 0

  baseData.forEach(function (d) {
    let {weight,score,dimension_name} = d
    let w = weight/100
    let labelTxt
    score=score*1
    if(score<0){
      labelTxt = dimension_name+':未评价'
      score = 0
    } else{
      labelTxt = dimension_name+':'+(score.toFixed(1) * 1)+'分'
    }
    data.push(w)
    labels.push(labelTxt)
    eachData.push(score/100)
    tscore+=score * w
  })

  chartPie({
    data,
    eachData,
    labels,
    tscore:tscore.toFixed(1) * 1
  })
}
