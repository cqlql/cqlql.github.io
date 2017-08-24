/**
 * 画弧
 *
 * @param {number} sRad
 * @param {number} eRad
 *
 * 返回 path A指令
 * */
import getxyByRad from './getxy-by-rad'
export default function drawArc ({
                                   sRad = 0,
                                   rad,
  r=50,
  ox,oy
                                 }) {

  let eRad = sRad + rad

  // 终点弧度点
  let {x:ex,y:ey} = getxyByRad(eRad,r,ox,oy)

  if (eRad === 2 * Math.PI) ex -= 0.001

  return 'A ' + r + ' ' + r + ', 0, ' + (eRad - sRad > Math.PI ? 1 : 0) + ', 1, ' + ex + ' ' + ey
}
