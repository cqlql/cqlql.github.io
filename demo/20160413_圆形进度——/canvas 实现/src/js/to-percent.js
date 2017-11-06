
/**
 * 百分比
 * 解决js中浮点运算问题： 0.57*100=56.99999999999999
 *
 * @param {number|string} num
 * @return {string} 100%
 * */
export default function toPercent (num) {
  return (num + '00').replace(/\.([\d]{2})/, '$1.') * 1
}
