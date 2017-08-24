import getxyByRad from './getxy-by-rad'
import arc from './arc'

/**
 * 返回 d 属性值
 * */
export default function ({
                           // 圆心
                           ox, oy,
                           // 半径
                           r,
                           // 起始弧度
                           sRad,

                           // 弧度大小
                           rad,

                         }) {

  if (r < 0) r = 0

  // 起始弧度点
  let {x: sx, y: sy} = getxyByRad(sRad, r, ox, oy)

  let A = arc({sRad, rad, r, ox, oy})

  let d = `M${ox} ${oy} L${sx} ${sy} ${A} Z`

  return d
}
